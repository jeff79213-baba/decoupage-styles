# CNC 程式碼錯誤偵測與錯誤面板 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 程式輸入後即時偵測 G-code 錯誤（依 FANUC+三菱規則），在 LeftNav「錯誤」分頁顯示列表，錯誤行在編輯器 gutter 顯示標記。

**Architecture:** 新增純函式 `src/utils/codeChecker.js`（輸入 rawText + parseNC 結果 → 輸出問題清單，不依賴 Vue）；store 在 rawText 變更時 debounce 計算並存緩存；LeftNav 新增「錯誤」分頁渲染 ErrorList；EditorPanel 用現有 gutter marker 機制畫錯誤/警告點。

**Tech Stack:** Vue 3 + Pinia + CodeMirror 6（StateField/GutterMarker/lineNumberMarkers）+ Vitest。

## Global Constraints

- 測試指令：`npm.cmd test`（在 `CNC程式碼解讀器\cnc-editor` 下執行），既有 26 個 store 測試必須維持通過，不得刪改
- build 指令：`npx.cmd vite build`（成功、無錯誤）
- 不使用任何新 npm 套件
- 檔案路徑含中文，PowerShell 指令務必雙引號引用
- commit 在 repo root `C:\Users\TW-10\Documents\firebase雲端資料夾`，只 stage CNC 專案檔案，**嚴禁** stage `A.NC`~`D.NC`
- 規則代號、嚴重度、message 文字與 spec 完全一致（見下方規則表）
- 錯誤資訊欄顯示在 LeftNav「錯誤」分頁（不做底部面板、不做浮動視窗）
- 只偵測 active 檔（切檔即切換）；不做跨檔檢查；不自動修復

---

### Task 1: `codeChecker.js` 偵測引擎（純函式 + 單元測試）

**Files:**
- Create: `CNC程式碼解讀器\cnc-editor\src\utils\codeChecker.js`
- Create: `CNC程式碼解讀器\cnc-editor\src\utils\codeChecker.test.js`

**Interfaces:**
- Consumes: 無（獨立純函式）
- Produces: `checkNC({ text, blocks, tools, variables, lineCoords }) → Problem[]`，每筆 `{ line, column, type, code, message }`
  - `type`: `'error' | 'warning' | 'info'`
  - `line`: 1-indexed 行號
  - Task 2 依賴此簽名存 store；Task 4 依賴此簽名渲染
- 同時 export `KNOWN_G_CODES`（陣列）與 `KNOWN_M_CODES`（陣列），供測試驗證

- [ ] **Step 1: 寫失敗測試 `codeChecker.test.js`**

建立 `CNC程式碼解讀器\cnc-editor\src\utils\codeChecker.test.js`：

```js
import { describe, it, expect } from 'vitest'
import { checkNC, KNOWN_G_CODES, KNOWN_M_CODES } from './codeChecker'

function run(text) {
  const lines = text.split('\n')
  const blocks = []
  const tools = []
  const variables = []
  const lineCoords = []
  let currentBlock = null
  let currentCoord = null
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    const lineNum = i + 1
    const nMatch = trimmed.match(/^(N(\d+))\(/)
    if (nMatch) {
      if (currentBlock) blocks.push(currentBlock)
      currentBlock = { n: nMatch[2], nFull: nMatch[1], toolName: '', toolNo: null, hNo: null, dNo: null, startLine: lineNum, endLine: lineNum, gCodes: [], mCodes: [], variables: [] }
    }
    const tMatch = trimmed.match(/T(\d+)M6/)
    if (tMatch && currentBlock) { currentBlock.toolNo = tMatch[1]; currentBlock.hNo = tMatch[1]; currentBlock.dNo = tMatch[1] }
    const vMatches = trimmed.matchAll(/#(\d+)=([-\d.]+)/g)
    for (const m of vMatches) {
      const v = { id: m[1], value: m[2], line: lineNum, block: currentBlock ? currentBlock.nFull : null }
      variables.push(v)
      if (currentBlock) currentBlock.variables.push(v)
    }
    const gMatches = trimmed.matchAll(/G(\d+)/g)
    for (const m of gMatches) { if (currentBlock) currentBlock.gCodes.push(parseInt(m[1])) }
    const mMatches = trimmed.matchAll(/M(\d+)/g)
    for (const m of mMatches) { if (currentBlock) currentBlock.mCodes.push(parseInt(m[1])) }
    if (/G#100/.test(trimmed)) { currentCoord = 'G54~G59' }
    const wMatch = trimmed.match(/G(5[4-9])\b/)
    if (wMatch) currentCoord = `G${wMatch[1]}`
    lineCoords.push(currentCoord)
    if (currentBlock) currentBlock.endLine = lineNum
  }
  if (currentBlock) blocks.push(currentBlock)
  return checkNC({ text, blocks, tools, variables, lineCoords })
}

function hasCode(result, code) {
  return result.some(p => p.code === code)
}

const VALID = [
  '%',
  'O1000',
  'N1(FM-125M-435)(FMA38.1-45)',
  'T1M6',
  '#500=2',
  '#501=53+#500',
  'WHILE[#100LE#501]DO1',
  'G0G90G54X-90.Y145.',
  'G43Z50.H1S350M3',
  'M7',
  'G1X840.F1000',
  '#100=#100+1',
  'END1',
  'G91G28Z0.',
  'M9',
  'M5',
  'M30'
]

describe('codeChecker 規則偵測', () => {
  it('合法 FANUC 程式（A.NC 風格）無誤報', () => {
    const r = run(VALID.join('\n'))
    expect(r.filter(p => p.type === 'error').length).toBe(0)
  })

  it('E-FMT-001 括號未閉合', () => {
    const r = run('N1(FM-125\nT1M6\n')
    const p = r.find(p => p.code === 'E-FMT-001')
    expect(p).toBeTruthy()
    expect(p.line).toBe(1)
    expect(p.type).toBe('error')
  })

  it('E-FMT-002 括號無對應左括', () => {
    expect(hasCode(run('N1)FM-125\n'), 'E-FMT-002')).toBe(true)
  })

  it('E-FMT-003 N 段號重複', () => {
    expect(hasCode(run('N1(T1)\nN1(T2)\n'), 'E-FMT-003')).toBe(true)
  })

  it('E-FMT-004 N 段號非遞增', () => {
    expect(hasCode(run('N5(T1)\nN3(T2)\n'), 'E-FMT-004')).toBe(true)
  })

  it('E-FMT-005 未知 G 碼', () => {
    expect(hasCode(run('G99\n'), 'E-FMT-005')).toBe(true)
  })

  it('E-FMT-006 未知 M 碼', () => {
    expect(hasCode(run('M77\n'), 'E-FMT-006')).toBe(true)
  })

  it('E-FMT-007 行首非法字元', () => {
    expect(hasCode(run('ABC\n'), 'E-FMT-007')).toBe(true)
  })

  it('E-FMT-008 座標缺值', () => {
    expect(hasCode(run('G1X,\n'), 'E-FMT-008')).toBe(true)
  })

  it('E-FMT-009 G 碼多位數字', () => {
    expect(hasCode(run('G100\n'), 'E-FMT-009')).toBe(true)
  })

  it('E-TOOL-001 換刀 M6 缺 T 碼', () => {
    expect(hasCode(run('M6\n'), 'E-TOOL-001')).toBe(true)
  })

  it('預選刀（獨立 T 無 M6）不報錯', () => {
    expect(hasCode(run('T5\n'), 'E-TOOL-001')).toBe(false)
  })

  it('E-TOOL-002 T 刀號與段標題不符', () => {
    expect(hasCode(run('N1(FM-125)\nT2M6\n'), 'E-TOOL-002')).toBe(true)
  })

  it('E-TOOL-003 H 號與刀號不符', () => {
    expect(hasCode(run('N1(FM-125)\nT1M6\nG43Z50.H2\n'), 'E-TOOL-003')).toBe(true)
  })

  it('E-TOOL-004 D 號與刀號不符', () => {
    expect(hasCode(run('N1(FM-125)\nT1M6\nG1G42X1.D2\n'), 'E-TOOL-004')).toBe(true)
  })

  it('E-TOOL-005 使用未定義刀具', () => {
    expect(hasCode(run('T9M6\n'), 'E-TOOL-005')).toBe(true)
  })

  it('E-TOOL-006 D 無 G41/G42', () => {
    expect(hasCode(run('N1(FM-125)\nT1M6\nG1X1.D1\n'), 'E-TOOL-006')).toBe(true)
  })

  it('E-STR-001 WHILE 無 END1', () => {
    expect(hasCode(run('WHILE[#100LE#501]DO1\nG1X1.\n'), 'E-STR-001')).toBe(true)
  })

  it('E-STR-002 END1 無 WHILE', () => {
    expect(hasCode(run('END1\n'), 'E-STR-002')).toBe(true)
  })

  it('E-STR-004 GOTO 目標不存在', () => {
    expect(hasCode(run('GOTO101\n'), 'E-STR-004')).toBe(true)
  })

  it('E-STR-005 變數未定義即使用', () => {
    expect(hasCode(run('#501=53+#999\n'), 'E-STR-005')).toBe(true)
  })

  it('E-STR-006 迴圈變數 #100 未賦值', () => {
    expect(hasCode(run('WHILE[#100LE#501]DO1\nEND1\n'), 'E-STR-006')).toBe(true)
  })

  it('E-MOT-001 同段 G0 與 G1 矛盾', () => {
    expect(hasCode(run('G0G1X1.\n'), 'E-MOT-001')).toBe(true)
  })

  it('E-MOT-002 同段 G41 與 G42 矛盾', () => {
    expect(hasCode(run('G41G42\n'), 'E-MOT-002')).toBe(true)
  })

  it('E-MOT-003 M30 前無回原點', () => {
    expect(hasCode(run('M30\n'), 'E-MOT-003')).toBe(true)
  })

  it('E-MOT-004 使用 G54 前未設定', () => {
    expect(hasCode(run('G54\n'), 'E-MOT-004')).toBe(true)
  })

  it('合法模式不誤報：T0M6 / M01 / G#100 / 括號註解', () => {
    const txt = [
      '%', 'O2000',
      'N1(FM-435)(FMA38.1-45)',
      'T0M6',
      'M01(CHECK T2&T4)',
      '#100=54',
      'WHILE[#100LE#501]DO1',
      'G0G90G#100X-90.',
      'G43Z50.H1S350M3',
      'G1G42X1.D1F300',
      '#100=#100+1',
      'END1',
      'G91G28Z0.',
      'M9', 'M5', 'T0M6', 'M30'
    ].join('\n')
    const errors = run(txt).filter(p => p.type === 'error')
    expect(errors.length).toBe(0)
  })

  it('KNOWN_G_CODES / KNOWN_M_CODES 有內容', () => {
    expect(KNOWN_G_CODES.length).toBeGreaterThan(30)
    expect(KNOWN_M_CODES.length).toBeGreaterThan(10)
    expect(KNOWN_G_CODES).toContain('G54')
    expect(KNOWN_M_CODES).toContain('M30')
  })
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm.cmd test`
Expected: FAIL（`Cannot find module './codeChecker'` 或 checkNC is not a function）

- [ ] **Step 3: 實作 `codeChecker.js`**

建立 `CNC程式碼解讀器\cnc-editor\src\utils\codeChecker.js`：

```js
export const KNOWN_G_CODES = ['G0','G1','G2','G3','G4','G10','G17','G18','G19','G20','G21','G28','G30','G40','G41','G42','G43','G44','G49','G50','G54','G55','G56','G57','G58','G59','G68','G69','G73','G74','G76','G80','G81','G82','G83','G84','G85','G86','G87','G88','G89','G90','G91','G92','G93','G94','G95','G98','G99']
export const KNOWN_M_CODES = ['M0','M1','M2','M3','M4','M5','M6','M7','M8','M9','M30','M98','M99']

function problem(line, code, message, type = 'error', column = 1) {
  return { line, column, type, code, message }
}

export function checkNC({ text, blocks, tools, variables }) {
  const out = []
  const lines = text.split('\n')
  const nFulls = blocks.map(b => b.nFull)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNum = i + 1
    const trimmed = line.trim()

    const openParens = (trimmed.match(/\(/g) || []).length
    const closeParens = (trimmed.match(/\)/g) || []).length
    if (openParens > closeParens) out.push(problem(lineNum, 'E-FMT-001', '括號未閉合'))
    if (closeParens > openParens) out.push(problem(lineNum, 'E-FMT-002', '括號無對應左括號'))

    const nMatch = trimmed.match(/^(N(\d+))\(/)
    const nBodyMatch = trimmed.match(/N(\d+)/)
    if (nBodyMatch && !nMatch && !trimmed.startsWith('N')) {
      // N 出現但非段首：不報（N 在註解內合法），略過
    }

    const allN = [...trimmed.matchAll(/N(\d+)/g)].map(m => m[1])
    if (allN.length > 1) out.push(problem(lineNum, 'E-FMT-003', '同一行出現多個 N 段號'))

    const gMatches = [...trimmed.matchAll(/G(\d+(?:\.\d+)?)/g)].map(m => m[1])
    for (const g of gMatches) {
      const num = g.split('.')[0]
      const full = `G${num}`
      if (num.length > 2) {
        out.push(problem(lineNum, 'E-FMT-009', `G 碼 G${num} 超出控制器範圍`))
      } else if (!KNOWN_G_CODES.includes(full)) {
        out.push(problem(lineNum, 'E-FMT-005', `未知 G 碼 G${num}`))
      }
    }

    const mMatches = [...trimmed.matchAll(/M(\d+)/g)].map(m => m[1])
    for (const m of mMatches) {
      if (!KNOWN_M_CODES.includes(`M${m}`)) {
        out.push(problem(lineNum, 'E-FMT-006', `未知 M 碼 M${m}`))
      }
    }

    const first = trimmed.charAt(0)
    const allowed = ['N','G','M','T','H','D','X','Y','Z','S','F','#','W','E','I','J','K','R','Q','P','(','/','%',';']
    if (trimmed && !allowed.includes(first) && !/^WHILE/i.test(trimmed) && !/^END\d/i.test(trimmed) && !/^GOTO/i.test(trimmed)) {
      out.push(problem(lineNum, 'E-FMT-007', `行首非法字元「${first}」`))
    }

    if (/[XYZW](?![-\d.])/i.test(trimmed) && /[XYZW]/i.test(trimmed.replace(/\([^)]*\)/g, ''))) {
      out.push(problem(lineNum, 'E-FMT-008', '座標值缺數字'))
    }

    const words = trimmed.split(/\s+/)
    if (words.includes('G0') && words.includes('G1')) {
      out.push(problem(lineNum, 'E-MOT-001', '同段同時含 G0 與 G1 矛盾'))
    }
    if (words.includes('G41') && words.includes('G42')) {
      out.push(problem(lineNum, 'E-MOT-002', '同段同時含 G41 與 G42 矛盾'))
    }
  }

  // N 段號重複 / 非遞增（跨行）
  const nList = []
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].trim().match(/^(N(\d+))\(/)
    if (m) nList.push({ num: parseInt(m[2]), line: i + 1 })
  }
  for (let i = 0; i < nList.length; i++) {
    if (nList.filter(n => n.num === nList[i].num).length > 1) {
      out.push(problem(nList[i].line, 'E-FMT-003', `N 段號 N${nList[i].num} 重複`))
    }
  }
  for (let i = 1; i < nList.length; i++) {
    if (nList[i].num <= nList[i - 1].num) {
      out.push(problem(nList[i].line, 'E-FMT-004', `N 段號 N${nList[i].num} 未遞增（前一為 N${nList[i-1].num}）`))
    }
  }

  // 換刀與補正
  for (const b of blocks) {
    for (let ln = b.startLine; ln <= b.endLine; ln++) {
      const l = lines[ln - 1] || ''
      const hasM6 = /M6/i.test(l)
      if (hasM6 && !/T\d+M6/i.test(l) && !/T\d+M06/i.test(l)) {
        out.push(problem(ln, 'E-TOOL-001', '換刀指令 M6 缺少 T 碼'))
      }
    }
    if (b.toolNo) {
      const toolTitleNums = (b.toolName || '').match(/\d+/g)
      const titleNo = toolTitleNums ? toolTitleNums[0] : null
      if (titleNo && titleNo !== b.toolNo) {
        out.push(problem(b.startLine, 'E-TOOL-002', `段 N${b.n} 標題刀具與 T${b.toolNo}M6 不符`))
      }
    }
  }


  const tM6Lines = []
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/T(\d+)M6/i)
    if (m) tM6Lines.push({ no: m[1], line: i + 1 })
  }
  const definedTools = new Set()
  for (const b of blocks) {
    if (b.toolNo) definedTools.add(b.toolNo)
  }
  for (const t of tM6Lines) {
    if (t.no !== '0' && !definedTools.has(t.no)) {
      out.push(problem(t.line, 'E-TOOL-005', `使用未定義刀具 T${t.no}M6`))
    }
  }

  for (const b of blocks) {
    for (let ln = b.startLine; ln <= b.endLine; ln++) {
      const l = lines[ln - 1] || ''
      const hMatch = l.match(/H(\d+)/)
      if (hMatch && b.toolNo && hMatch[1] !== b.toolNo) {
        out.push(problem(ln, 'E-TOOL-003', `H${hMatch[1]} 與刀號 T${b.toolNo} 不符`))
      }
      const dMatch = l.match(/D(\d+)/)
      if (dMatch && b.toolNo && dMatch[1] !== b.toolNo) {
        out.push(problem(ln, 'E-TOOL-004', `D${dMatch[1]} 與刀號 T${b.toolNo} 不符`))
      }
      if (dMatch && !/G41/.test(l) && !/G42/.test(l) && !/G40/.test(l)) {
        out.push(problem(ln, 'E-TOOL-006', `D${dMatch[1]} 無 G41/G42 搭配`))
      }
    }
  }

  // 結構與變數
  let loopDepth = 0
  const definedVars = new Set()
  for (const v of variables) definedVars.add(v.id)
  let whileSeen = false
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim()
    const lineNum = i + 1
    if (/WHILE\[/i.test(l)) {
      if (/DO\d/i.test(l)) {
        loopDepth++
        whileSeen = true
        const doMatch = l.match(/DO(\d)/)
        if (doMatch && doMatch[1] !== '1') {
          out.push(problem(lineNum, 'E-STR-003', `DO 編號與 END 不匹配（DO${doMatch[1]}）`))
        }
        if (!definedVars.has('100')) {
          out.push(problem(lineNum, 'E-STR-006', '迴圈變數 #100 未定義即使用'))
        }
      } else {
        out.push(problem(lineNum, 'E-STR-001', 'WHILE 缺少 DO 標記'))
      }
    }
    if (/^END(\d)/.test(l)) {
      loopDepth = Math.max(0, loopDepth - 1)
      whileSeen = false
    }
    const usedVars = [...l.matchAll(/#(\d+)/g)].map(m => m[1])
    const assigned = l.match(/#(\d+)=/)
    for (const uv of usedVars) {
      if (assigned && assigned[1] === uv) continue
      if (!definedVars.has(uv)) {
        out.push(problem(lineNum, 'E-STR-005', `變數 #${uv} 未定義即使用`))
      }
    }
  }
  if (loopDepth > 0) out.push(problem(lines.length, 'E-STR-001', 'WHILE-DO 無對應 END'))
  if (whileSeen && loopDepth <= 0) {
    // 已配對，不報
  }

  const gotoTargets = [...text.matchAll(/GOTO(\d+)/gi)].map(m => m[1])
  for (const g of gotoTargets) {
    if (!nFulls.some(n => n === `N${g}`) && !nList.some(n => String(n.num) === g)) {
      out.push(problem(0, 'E-STR-004', `GOTO 目標 N${g} 不存在`))
    }
  }

  // 運動與安全
  const fileText = text
  const hasG28 = /G28/.test(fileText)
  const lastM = [...fileText.matchAll(/(M30|M02)/g)].pop()
  if (lastM) {
    const m30Line = fileText.slice(0, lastM.index).split('\n').length
    const afterM30 = fileText.slice(lastM.index + lastM[0].length)
    if (!hasG28) {
      out.push(problem(m30Line, 'E-MOT-003', 'M30 前未回原點（無 G28）'))
    }
  }

  const coordsUsed = new Set()
  for (const w of [...fileText.matchAll(/G(5[4-9])\b/g)]) coordsUsed.add(`G${w[1]}`)
  const coordSetLines = []
  for (let i = 0; i < lines.length; i++) {
    if (/^G5[4-9]\b/.test(lines[i].trim()) || /G5[4-9]\s*[^X]/.test(lines[i].trim())) {
      coordSetLines.push(i + 1)
    }
  }
  for (const c of coordsUsed) {
    if (coordSetLines.length === 0) {
      out.push(problem(1, 'E-MOT-004', `使用座標系 ${c} 但程式未設定`))
    }
  }

  return out
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npm.cmd test`
Expected: 新測試全過，既有 26 個也過（codeChecker.test.js 為新檔案，總數變成 26 + 27 = 53）

- [ ] **Step 5: Commit**

```bash
git add "CNC程式碼解讀器/cnc-editor/src/utils/codeChecker.js" "CNC程式碼解讀器/cnc-editor/src/utils/codeChecker.test.js"
git commit -m "feat: 新增 codeChecker 錯誤偵測引擎（四類規則 + 單元測試）"
```

---

### Task 2: store 整合（debounce 偵測 + errors 狀態）

**Files:**
- Modify: `CNC程式碼解讀器\cnc-editor\src\stores\editor.js`
- Modify: `CNC程式碼解讀器\cnc-editor\src\stores\editor.test.js`

**Interfaces:**
- Consumes: Task 1 的 `checkNC({ text, blocks, tools, variables, lineCoords }) → Problem[]`
- Produces:
  - state `errorsByFile: {}`（key 為 fileId，value 為 Problem[]）
  - state `errorDebounceTimer: null`
  - action `runCheck(fileId)` — 立即同步計算該檔錯誤存入 `errorsByFile[fileId]`
  - action `scheduleCheck(fileId)` — debounce 300ms 後呼叫 `runCheck`
  - getter `errors` — 回傳 `errorsByFile[activeFileId] || []`
  - getter `errorCount` — `errors` 中 type 為 error/warning 的數量
  - Task 3 依賴 `setNav('errors')`；Task 4 依賴 `errors` getter；Task 5 依賴 `errors` getter

- [ ] **Step 1: 寫失敗測試（editor.test.js 新增 describe）**

在 `editor.test.js` 檔尾加入：

```js
describe('editor store 錯誤偵測整合', () => {
  it('scheduleCheck 後 errors getter 有內容', async () => {
    const store = useEditorStore()
    store.$patch({
      files: [{
        id: 1, fileName: 'BAD.NC',
        rawText: 'N1(FM-125\nT1M6\nM30\n',
        parsed: parseNC('N1(FM-125\nT1M6\nM30\n'),
        currentLine: -1, bookmarks: []
      }],
      activeFileId: 1
    })
    store.scheduleCheck(1)
    await new Promise(r => setTimeout(r, 400))
    expect(store.errors.length).toBeGreaterThan(0)
    expect(store.errors.some(p => p.code === 'E-FMT-001')).toBe(true)
  })

  it('errors getter 隨 activeFileId 切換', () => {
    const store = useEditorStore()
    store.$patch({
      files: [
        { id: 1, fileName: 'A.NC', rawText: 'N1(T1)\nT1M6\nM30\n', parsed: parseNC('N1(T1)\nT1M6\nM30\n'), currentLine: -1, bookmarks: [] },
        { id: 2, fileName: 'B.NC', rawText: 'END1\n', parsed: parseNC('END1\n'), currentLine: -1, bookmarks: [] }
      ],
      activeFileId: 1,
      nextFileId: 3
    })
    store.runCheck(1)
    store.runCheck(2)
    expect(store.errors.length).toBe(0)
    store.setActiveFile(2)
    expect(store.errors.some(p => p.code === 'E-STR-002')).toBe(true)
  })

  it('errorCount 只算 error+warning', () => {
    const store = useEditorStore()
    store.$patch({ files: [], activeFileId: null })
    store.errorsByFile[999] = [
      { line: 1, column: 1, type: 'error', code: 'X', message: 'a' },
      { line: 2, column: 1, type: 'warning', code: 'Y', message: 'b' },
      { line: 3, column: 1, type: 'info', code: 'Z', message: 'c' }
    ]
    store.activeFileId = 999
    expect(store.errorCount).toBe(2)
  })

  it('updateFileText 觸發 scheduleCheck', async () => {
    const store = useEditorStore()
    store.$patch({
      files: [{ id: 1, fileName: 'A.NC', rawText: 'M30\n', parsed: parseNC('M30\n'), currentLine: -1, bookmarks: [] }],
      activeFileId: 1,
      nextFileId: 2
    })
    store.updateFileText(1, 'END1\n')
    await new Promise(r => setTimeout(r, 400))
    expect(store.errors.some(p => p.code === 'E-STR-002')).toBe(true)
  })
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npm.cmd test`
Expected: FAIL（`store.scheduleCheck is not a function`）

- [ ] **Step 3: 實作 store 整合**

在 `editor.js` 的 state 加入：

```js
    errorsByFile: {},
    errorDebounceTimer: null,
```

在 import 處加入：

```js
import { checkNC } from '../utils/codeChecker'
```

在 getters 加入（`lines` getter 之後）：

```js
    errors() { return this.errorsByFile[this.activeFileId] || [] },
    errorCount() { return this.errors.filter(p => p.type === 'error' || p.type === 'warning').length },
```

在 actions 加入（`loadSyntaxColors` 之前）：

```js
    runCheck(fileId) {
      const f = this.files.find(f => f.id === fileId)
      if (!f || !f.rawText) {
        this.errorsByFile = { ...this.errorsByFile, [fileId]: [] }
        return
      }
      const parsed = f.parsed || parseNC(f.rawText)
      const problems = checkNC({
        text: f.rawText,
        blocks: parsed.blocks || [],
        tools: parsed.tools || [],
        variables: parsed.variables || [],
        lineCoords: parsed.lineCoords || []
      })
      this.errorsByFile = { ...this.errorsByFile, [fileId]: problems }
    },

    scheduleCheck(fileId) {
      if (this.errorDebounceTimer) clearTimeout(this.errorDebounceTimer)
      this.errorDebounceTimer = setTimeout(() => {
        this.runCheck(fileId)
        this.errorDebounceTimer = null
      }, 300)
    },
```

修改 `updateFileText`：

```js
    updateFileText(fileId, text) {
      const f = this.files.find(f => f.id === fileId)
      if (!f) return
      f.rawText = text
      this.scheduleCheck(fileId)
    },
```

修改 `addFile`（reader.onload 內）加入：

```js
        target.parsed = parseNC(reader.result)
        this.runCheck(id)
```

修改 `setActiveFile` 加入：

```js
      this.setActiveFile(id)
      this.runCheck(id)
```

修改 `removeFile`（splice 後）加入：

```js
      const eb = { ...this.errorsByFile }
      delete eb[id]
      this.errorsByFile = eb
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npm.cmd test`
Expected: 既有 26 + 新 4 + Task 1 的 27 = 57 全過

- [ ] **Step 5: Commit**

```bash
git add "CNC程式碼解讀器/cnc-editor/src/stores/editor.js" "CNC程式碼解讀器/cnc-editor/src/stores/editor.test.js"
git commit -m "feat: store 整合錯誤偵測 - debounce、errors/errorCount getter、檔切換"
```

---

### Task 3: LeftNav 新增「錯誤」分頁 + ErrorList 元件

**Files:**
- Modify: `CNC程式碼解讀器\cnc-editor\src\components\LeftNav.vue`
- Create: `CNC程式碼解讀器\cnc-editor\src\components\ErrorList.vue`

**Interfaces:**
- Consumes: Task 2 的 `store.errors`、`store.errorCount`、`store.setNav('errors')`；既有 `store.setNav`
- Produces:
  - `ErrorList.vue` 元件：props 無；emits `['navigate']`（參數 lineIndex = line - 1）
  - LeftNav 的「錯誤」分頁標籤顯示 `錯誤 N`（N = errorCount）
  - Task 5 無依賴此 Task；Task 4 的 EditorPanel 獨立

- [ ] **Step 1: 建立 `ErrorList.vue`**

```vue
<script setup>
import { computed } from 'vue'
import { useEditorStore } from '../stores/editor'

const store = useEditorStore()
const emit = defineEmits(['navigate'])

const sorted = computed(() => {
  const order = { error: 0, warning: 1, info: 2 }
  return [...store.errors].sort((a, b) => a.line - b.line || order[a.type] - order[b.type])
})

const typeIcon = { error: '⛔', warning: '⚠', info: 'ℹ' }
</script>

<template>
  <div class="error-list">
    <div v-if="!sorted.length" class="error-empty">未偵測到錯誤</div>
    <div v-for="(p, i) in sorted" :key="i" class="error-item" :class="p.type" @click="emit('navigate', p.line - 1)">
      <span class="err-icon">{{ typeIcon[p.type] }}</span>
      <span class="err-line">{{ p.line }}</span>
      <span class="err-msg">{{ p.message }}</span>
    </div>
  </div>
</template>

<style scoped>
.error-list { display: flex; flex-direction: column; gap: 2px; }
.error-empty { color: #6c7086; font-size: 13px; padding: 8px 4px; }
.error-item { display: flex; align-items: center; gap: 6px; padding: 4px 6px; border-radius: 4px; cursor: pointer; font-size: 12px; }
.error-item:hover { background: #31324455; }
.error-item .err-line { color: #6c7086; min-width: 28px; text-align: right; font-family: monospace; }
.error-item.error .err-msg { color: #f38ba8; }
.error-item.warning .err-msg { color: #f9e2af; }
.error-item.info .err-msg { color: #a6adc8; }
</style>
```

- [ ] **Step 2: 修改 `LeftNav.vue`**

script 的 sections 加入 errors，並 import ErrorList：

```js
import ErrorList from './ErrorList.vue'
const sections = [
  { key: 'tools', label: '刀號' },
  { key: 'variables', label: '變數' },
  { key: 'coordinates', label: '座標系' },
  { key: 'errors', label: '錯誤' }
]
```

template 的 nav-content 加入（CoordViewer 行後）：

```vue
      <ErrorList v-if="store.selectedNav === 'errors'" @navigate="emit('navigate', $event)" />
```

nav-item 標籤顯示計數（改 label 綁定）：

```vue
      <div v-for="s in sections" :key="s.key" class="nav-item" :class="{ active: store.selectedNav === s.key }" @click="store.setNav(s.key)">{{ s.key === 'errors' ? `錯誤 ${store.errorCount}` : s.label }}</div>
```

- [ ] **Step 3: 驗證 build**

Run: `npx.cmd vite build`
Expected: 成功無錯誤

- [ ] **Step 4: 跑測試確認無回歸**

Run: `npm.cmd test`
Expected: 57 全過

- [ ] **Step 5: Commit**

```bash
git add "CNC程式碼解讀器/cnc-editor/src/components/LeftNav.vue" "CNC程式碼解讀器/cnc-editor/src/components/ErrorList.vue"
git commit -m "feat: LeftNav 新增錯誤分頁與 ErrorList 元件"
```

---

### Task 4: EditorPanel 錯誤行 gutter 標記

**Files:**
- Modify: `CNC程式碼解讀器\cnc-editor\src\components\EditorPanel.vue`

**Interfaces:**
- Consumes: Task 2 的 `store.errors` getter（active 檔）；現有 `fileInfo` computed（props.fileId 對應檔案）
- Produces: 無對外介面。EditorPanel 在錯誤清單變化時重繪 gutter 標記（view 與 view2 都要）

- [ ] **Step 1: 實作錯誤 marker（沿用 BookmarkDot 模式）**

在 `bookmarkPositionsField` 定義之後加入：

```js
const setErrorsEffect = StateEffect.define()
class ErrorDot extends GutterMarker {
  constructor(level) { super(); this.level = level }
  toDOM() {
    const span = document.createElement('span')
    span.className = `cm-error-dot ${this.level}`
    return span
  }
  eq(other) { return other instanceof ErrorDot && other.level === this.level }
}
const errorPositionsField = StateField.define({
  create: () => [],
  update(positions, tr) {
    positions = positions.map(p => tr.changes.mapPos(p, 1))
    for (const e of tr.effects) {
      if (e.is(setErrorsEffect)) positions = e.value
    }
    return positions
  },
  provide: (f) => lineNumberMarkers.from(f, positions => {
    const ranges = positions.map(p => {
      const level = p.level === 'error' ? 'error' : 'warning'
      return new ErrorDot(level).range(p.pos)
    })
    return RangeSet.of(ranges)
  })
})
```

在 `buildExtensions()` 的 array 內（`bookmarkPositionsField` 後）加入：

```js
    errorPositionsField,
```

在 `applyBookmarks` 之後加入：

```js
function errorPositions(v) {
  const doc = v.state.doc
  const errs = store.errors
  const lines = new Map()
  for (const e of errs) {
    const ln = Math.min(e.line - 1, doc.lines - 1)
    if (!lines.has(ln) || lines.get(ln) === 'warning') {
      lines.set(ln, e.type === 'error' ? 'error' : lines.get(ln) || 'warning')
    }
  }
  return [...lines.entries()].map(([ln, level]) => ({ pos: doc.line(ln + 1).from, level }))
}

function applyErrors(v) {
  v.dispatch({ effects: setErrorsEffect.of(errorPositions(v)) })
}
```

`createView` 內（`applyBookmarks` 之後）加入：

```js
  if (store.errors.length) applyErrors(v)
```

新增 watch（`bookmarks` watch 之後）：

```js
watch(() => store.errors, () => {
  const views = [view, view2].filter(Boolean)
  for (const v of views) applyErrors(v)
}, { deep: true })
```

CSS（`cm-bookmark-dot` 之後）加入：

```css
.editor-pane :deep(.cm-error-dot) {
  display: inline-block;
  margin-left: 3px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  vertical-align: middle;
}
.editor-pane :deep(.cm-error-dot.error) { background: #f38ba8; }
.editor-pane :deep(.cm-error-dot.warning) { background: #f9e2af; }
```

- [ ] **Step 2: 驗證 build**

Run: `npx.cmd vite build`
Expected: 成功無錯誤

- [ ] **Step 3: 跑測試確認無回歸**

Run: `npm.cmd test`
Expected: 57 全過

- [ ] **Step 4: Commit**

```bash
git add "CNC程式碼解讀器/cnc-editor/src/components/EditorPanel.vue"
git commit -m "feat: EditorPanel 錯誤行 gutter 標記（紅點錯誤／橘點警告）"
```

---

### Task 5: 建置安裝版 + CDP 端對端驗證

**Files:**
- 驗證產物：`CNC程式碼解讀器\安裝版\`（由 `scripts/build-install.ps1` 產生）
- 驗證腳本：`C:\Users\TW-10\AppData\Local\Temp\opencode\cdp-codecheck-test.js`

**Interfaces:**
- Consumes: 上述全部修改。

- [ ] **Step 1: 執行全部單元測試**

Run: `npm.cmd test`
Expected: 54 個測試全數 PASS。

- [ ] **Step 2: 建置安裝版**

Run: `npx.cmd vite build`；隨後 `& .\scripts\build-install.ps1`
Expected: 產生 `安裝版\app.js`、`cnc-editor.css`、`index.html` 等。

- [ ] **Step 3: 啟動 dev server 並 CDP 驗證**

啟動 dev server：
```powershell
Start-Process cmd.exe -ArgumentList '/c cd /d "C:\Users\TW-10\Documents\firebase雲端資料夾\CNC程式碼解讀器\cnc-editor" && npx.cmd vite --port 3000 --host'
```

建立 `C:\Users\TW-10\AppData\Local\Temp\opencode\cdp-codecheck-test.js`（沿用既有 `cdp-splitpane-test.js` 骨架，`ws` 在 temp 目錄已可 require）：

```js
const http = require('http')
const { spawn } = require('child_process')
const wsLib = require('ws')
const fs = require('fs')
const base = 'C:\\Users\\TW-10\\Documents\\firebase雲端資料夾\\CNC程式碼解讀器'
const chromePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const port = 9231
function getJSON(url){return new Promise((res,rej)=>{http.get(url,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)))}).on('error',rej)})}
;(async()=>{
  await new Promise(r=>spawn('taskkill',['/F','/IM','msedge.exe'],{stdio:'ignore'}).on('exit',()=>r()))
  const proc=spawn(chromePath,[`--remote-debugging-port=${port}`,'--headless','--disable-gpu','--no-first-run','about:blank'],{stdio:'ignore'})
  await new Promise(r=>setTimeout(r,2500))
  let targets
  for(let i=0;i<10;i++){try{targets=await getJSON(`http://127.0.0.1:${port}/json`);if(targets.length)break}catch(e){}await new Promise(r=>setTimeout(r,500))}
  const page=targets.find(t=>t.type==='page')
  const ws=new wsLib.WebSocket(page.webSocketDebuggerUrl)
  let id=0;const pending=new Map();const listeners=[]
  ws.on('message',data=>{const m=JSON.parse(data.toString());if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.rej(new Error(JSON.stringify(m.error))):p.res(m.result)}else if(m.method)listeners.forEach(cb=>cb(m.method,m.params))})
  await new Promise((res,rej)=>{ws.on('open',res);ws.on('error',rej)})
  const send=(method,params={})=>new Promise((res,rej)=>{const mid=++id;pending.set(mid,{res,rej});ws.send(JSON.stringify({id:mid,method,params}))})
  const on=(m,cb)=>listeners.push((method,params)=>{if(method===m)cb(params)})
  await send('Page.enable');await send('Runtime.enable')
  const errs=[]
  on('Runtime.exceptionThrown',p=>errs.push((p.exceptionDetails?.exception?.description||p.exceptionDetails?.text||'').slice(0,400)))
  await send('Page.navigate',{url:'http://localhost:3000'})
  await new Promise(r=>setTimeout(r,3000))
  const ev=async(expression)=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true});return r.result?.value}
  const wait=ms=>new Promise(r=>setTimeout(r,ms))
  const dropInject = (file, content) => `
    (() => {
      const file = new File([${JSON.stringify(content)}], '${file}', {type:'text/plain'})
      const dt = new DataTransfer()
      dt.items.add(file)
      const app = document.querySelector('.app-layout')
      app.dispatchEvent(new DragEvent('dragenter', {dataTransfer: dt, bubbles: true}))
      app.dispatchEvent(new DragEvent('dragover', {dataTransfer: dt, bubbles: true}))
      app.dispatchEvent(new DragEvent('drop', {dataTransfer: dt, bubbles: true}))
      return 'dropped'
    })()
  `
  const badText = 'N1(FM-125\nT1M6\nG1X.\nM30\n'
  console.log('drop BAD:', await ev(dropInject('BAD.NC', badText)))
  await wait(2000)
  console.log('錯誤分頁標籤:', await ev(`[...document.querySelectorAll('.nav-item')].map(e=>e.textContent)`))
  console.log('切到錯誤分頁:', await ev(`(() => { const it=[...document.querySelectorAll('.nav-item')].find(e=>e.textContent.includes('錯誤')); it.click(); return 'ok' })()`))
  await wait(600)
  console.log('錯誤列表:', await ev(`JSON.stringify([...document.querySelectorAll('.error-item')].map(e=>e.textContent))`))
  console.log('錯誤行數:', await ev(`document.querySelectorAll('.error-item').length`))

  console.log('點第一筆錯誤跳轉:', await ev(`(() => { const it=document.querySelector('.error-item'); if(!it) return 'none'; it.click(); return 'ok' })()`))
  await wait(600)
  console.log('目前行號:', await ev(`(() => { const f=window; return document.querySelector('.active-program .ap-name')?.textContent||'' })()`))

  console.log('錯誤行 gutter 紅點:', await ev(`document.querySelectorAll('.cm-error-dot').length`))
  console.log('紅點等級:', await ev(`JSON.stringify([...document.querySelectorAll('.cm-error-dot')].map(e=>e.className))`))

  console.log('修正後錯誤減少:', await ev(`(() => {
    const cm = document.querySelector('.cm-editor .cm-content')
    cm.dispatchEvent(new InputEvent('input', {bubbles:true}))
    return 'ok'
  })()`))

  console.log('例外:', errs.length?errs.join('\n'):'(無)')
  proc.kill();process.exit(0)
})().catch(e=>{console.error('FAIL',e.message);process.exit(1)})
```

執行：
```powershell
node "C:\Users\TW-10\AppData\Local\Temp\opencode\cdp-codecheck-test.js"
```

Expected:
- 錯誤分頁標籤含「錯誤 N」
- 切到錯誤分頁 → error-item 列出 E-FMT-001（括號未閉合）等
- 點錯誤列 → 跳轉（LeftNav「目前程式」仍為 BAD.NC，無例外即可）
- `.cm-error-dot` 存在且 class 含 `error`
- 例外 = (無)

- [ ] **Step 4: 驗證安裝版 file:// 可執行**

```powershell
$out = & "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless --disable-gpu --dump-dom "file:///C:/Users/TW-10/Documents/firebase雲端資料夾/CNC程式碼解讀器/安裝版/index.html" 2>&1 | Out-String
```
Expected: `$out` 含 `app-layout`；另檢查 `安裝版\app.js` 含字串 `未偵測到錯誤`。

- [ ] **Step 5: Commit（不要 push）**

```bash
git add "CNC程式碼解讀器/cnc-editor/src" "CNC程式碼解讀器/cnc-editor/docs" "CNC程式碼解讀器/安裝版/app.js" "CNC程式碼解讀器/安裝版/cnc-editor.css"
git commit -m "feat: CNC 程式碼錯誤偵測完成 - 即時偵測、錯誤分頁、gutter 標記"
```
> ⚠️ 確認 `git add` 不含 `A.NC`~`D.NC`；`git status` 檢查後 commit。由 dispatcher 在最終 review 後自行 push。

---

## 已知風險與注意事項

- **codeChecker 的 `lineCoords` 參數**：目前規則未用到 lineCoords，但介面保留以便日後擴充座標系規則。
- **E-TOOL-002 判斷**：以段標題刀具名稱的第一個數字對比 T 號；若標題無數字則跳過不報。
- **E-MOT-004 座標系**：`G54` 單獨成行視為「設定座標系」；與其他碼同段時難以精準判斷，先以「程式內曾出現獨立 G5x 行」為準。
- **安裝版**：每次修改後必須重新執行 `build-install.ps1`，桌面捷徑才會是新的。
- **共用 repo**：commit 只含 CNC 相關檔案，避免誤 commit 其他專案改動。
- **debounce 計時器**：`scheduleCheck` 的 timer 存於 store state，多檔同時編輯時後者覆蓋前者；因只顯示 active 檔，可接受。

