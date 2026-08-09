export const KNOWN_G_CODES = ['G0','G1','G2','G3','G4','G10','G17','G18','G19','G20','G21','G28','G30','G40','G41','G42','G43','G44','G49','G50','G54','G55','G56','G57','G58','G59','G68','G69','G73','G74','G76','G80','G81','G82','G83','G84','G85','G86','G87','G88','G89','G90','G91','G92','G93','G94','G95','G98','G99']
export const KNOWN_M_CODES = ['M0','M1','M2','M3','M4','M5','M6','M7','M8','M9','M30','M98','M99']

function problem(line, code, message, type = 'error', column = 1) {
  return { line, column, type, code, message }
}

function stripComments(s) {
  return s.replace(/\([^)]*\)/g, '')
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
      const norm = String(parseInt(num, 10))
      if (num.length > 2) {
        out.push(problem(lineNum, 'E-FMT-009', `G 碼 G${num} 超出控制器範圍`))
      } else if (!KNOWN_G_CODES.includes(`G${norm}`)) {
        out.push(problem(lineNum, 'E-FMT-005', `未知 G 碼 G${num}`))
      }
    }

    const mMatches = [...trimmed.matchAll(/M(\d+)/g)].map(m => m[1])
    for (const m of mMatches) {
      const num = String(parseInt(m, 10))
      if (!KNOWN_M_CODES.includes(`M${num}`)) {
        out.push(problem(lineNum, 'E-FMT-006', `未知 M 碼 M${m}`))
      }
    }

    const first = trimmed.charAt(0)
    const allowed = ['N','G','M','T','H','D','X','Y','Z','S','F','#','W','E','I','J','K','R','Q','P','(','/','%',';','O']
    if (trimmed && !allowed.includes(first) && !/^WHILE/i.test(trimmed) && !/^END\d/i.test(trimmed) && !/^GOTO/i.test(trimmed)) {
      out.push(problem(lineNum, 'E-FMT-007', `行首非法字元「${first}」`))
    }

    if (!/^WHILE/i.test(trimmed) && /[XYZW](?![-\d.])/i.test(trimmed) && /[XYZW]/i.test(stripComments(trimmed))) {
      out.push(problem(lineNum, 'E-FMT-008', '座標值缺數字'))
    }

    const motCodes = new Set(gMatches.map(g => parseInt(g, 10)))
    if (motCodes.has(0) && motCodes.has(1)) {
      out.push(problem(lineNum, 'E-MOT-001', '同段同時含 G0 與 G1 矛盾'))
    }
    if (motCodes.has(41) && motCodes.has(42)) {
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
      out.push(problem(nList[i].line, 'E-FMT-004', `N 段號 N${nList[i].num} 未遞增（前一為 N${nList[i-1].num}）`, 'warning'))
    }
  }

  // 換刀與補正
  for (let i = 0; i < lines.length; i++) {
    const code = stripComments(lines[i])
    const hasM6 = /M6/i.test(code)
    if (hasM6 && !/T\d+M6/i.test(code) && !/T\d+M06/i.test(code)) {
      out.push(problem(i + 1, 'E-TOOL-001', '換刀指令 M6 缺少 T 碼'))
    }
  }
  for (const b of blocks) {
    if (b.toolNo && b.toolNo !== '0') {
      const titleLine = lines[b.startLine - 1] || ''
      const tInTitle = titleLine.match(/\(T(\d+)\)/)
      if (!tInTitle) continue
      const titleNo = tInTitle[1]
      if (titleNo !== b.toolNo) {
        out.push(problem(b.startLine, 'E-TOOL-002', `段 N${b.n} 標題刀具與 T${b.toolNo}M6 不符`, 'warning'))
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
    for (let ln = b.startLine; ln <= b.endLine; ln++) {
      const tm = (lines[ln - 1] || '').match(/T(\d+)M6/i)
      if (tm && tm[1] !== '0') definedTools.add(tm[1])
    }
  }
  for (const t of tM6Lines) {
    if (t.no !== '0' && !definedTools.has(t.no)) {
      out.push(problem(t.line, 'E-TOOL-005', `使用未定義刀具 T${t.no}M6`))
    }
  }

  for (const b of blocks) {
    if (!b.toolNo || b.toolNo === '0') continue
    let blockHasG43 = false
    for (let ln = b.startLine; ln <= b.endLine; ln++) {
      const bl = lines[ln - 1] || ''
      if (/G43/i.test(stripComments(bl))) blockHasG43 = true
    }
    let hSeen = false
    let hLine = -1
    for (let ln = b.startLine; ln <= b.endLine; ln++) {
      const l = lines[ln - 1] || ''
      if (/^(WHILE|END\d|GOTO)/i.test(l.trim())) continue
      const hMatch = l.match(/H(\d+)/)
      if (hMatch && hMatch[1] !== b.toolNo) {
        out.push(problem(ln, 'E-TOOL-003', `H${hMatch[1]} 與刀號 T${b.toolNo} 不符`))
      }
      const dMatch = l.match(/D(\d+)/)
      if (dMatch && dMatch[1] !== b.toolNo) {
        out.push(problem(ln, 'E-TOOL-004', `D${dMatch[1]} 與刀號 T${b.toolNo} 不符`))
      }
      if (dMatch && !/G41/.test(l) && !/G42/.test(l) && !/G40/.test(l)) {
        out.push(problem(ln, 'E-TOOL-006', `D${dMatch[1]} 無 G41/G42 搭配`))
      }
      if (hMatch && !hSeen) { hSeen = true; hLine = ln }
    }
    if (hSeen && !blockHasG43) {
      out.push(problem(hLine, 'E-TOOL-007', 'H 碼出現但該段無 G43 補正', 'info'))
    }
  }

  // 結構與變數
  let loopDepth = 0
  const definedVars = new Set()
  for (const v of variables) definedVars.add(v.id)
  for (let i = 0; i < lines.length; i++) {
    const am = lines[i].match(/#(\d+)=/)
    if (am) definedVars.add(am[1])
  }
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
      if (!whileSeen) {
        out.push(problem(lineNum, 'E-STR-002', 'END 無對應 WHILE'))
      }
      loopDepth = Math.max(0, loopDepth - 1)
      whileSeen = false
    }
    if (/^WHILE\[/i.test(l)) continue
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

  // E-STR-007: G#100 動態座標系範圍
  for (const m of [...text.matchAll(/G#(\d+)/g)]) {
    const varId = m[1]
    const v = variables.find(x => x.id === varId)
    if (v) {
      const val = parseInt(v.value, 10)
      if (!Number.isNaN(val)) {
        const inRange = (val >= 54 && val <= 59) || val >= 300
        if (!inRange) {
          const lineNum = text.slice(0, m.index).split('\n').length
          out.push(problem(lineNum, 'E-STR-007', `動態座標系 G#${varId} 值 ${val} 超出座標系範圍（54~59 或 300+）`, 'warning'))
        }
      }
    }
  }

  // E-STR-004: GOTO 目標檢查
  for (const m of [...text.matchAll(/GOTO(\d+)/gi)]) {
    const g = m[1]
    if (!nFulls.some(n => n === `N${g}`) && !nList.some(n => String(n.num) === g)) {
      const gotoLine = text.slice(0, m.index).split('\n').length
      out.push(problem(gotoLine, 'E-STR-004', `GOTO 目標 N${g} 不存在`))
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

  const codeText = stripComments(text)
  const coordsUsed = new Set()
  for (const w of [...codeText.matchAll(/G(5[4-9])\b/g)]) coordsUsed.add(`G${w[1]}`)
  const coordSetLines = []
  for (let i = 0; i < lines.length; i++) {
    const stripped = stripComments(lines[i])
    if (/G5[4-9]\s*P\d/i.test(stripped)) {
      coordSetLines.push(i + 1)
    }
  }
  for (const c of coordsUsed) {
    if (coordSetLines.length === 0) {
      out.push(problem(1, 'E-MOT-004', `使用座標系 ${c} 但程式未設定`))
    }
  }

  // E-MOT-005: Z 進給（G1/G01）前無 M3/M4
  let spindleOn = false
  for (let i = 0; i < lines.length; i++) {
    const codeLine = stripComments(lines[i])
    if (/M0?[34](?!\d)/i.test(codeLine)) spindleOn = true
    if (/G0?1(?!\d)/i.test(codeLine) && /Z/i.test(codeLine) && !spindleOn) {
      out.push(problem(i + 1, 'E-MOT-005', 'Z 進給前未開啟主軸（無 M3/M4）', 'warning'))
    }
  }

  // E-MOT-006: WHILE 迴圈內定義且未修改的變數
  const firstAssignLine = new Map()
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/#(\d+)=/)
    if (m && !firstAssignLine.has(m[1])) firstAssignLine.set(m[1], i)
  }
  const loopStack = []
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim()
    if (/^WHILE\[/i.test(l)) {
      loopStack.push(i)
    } else if (/^END\d/.test(l)) {
      const startIdx = loopStack.pop()
      if (startIdx === undefined) continue
      const assignCount = new Map()
      for (let j = startIdx + 1; j < i; j++) {
        const bl = lines[j]
        for (const lm of [...bl.matchAll(/#(\d+)=/g)]) {
          const id = lm[1]
          const rec = assignCount.get(id) || { count: 0, selfRef: false }
          rec.count++
          const rhs = bl.slice(lm.index + lm[0].length)
          if (new RegExp(`#${id}(?!\\d)`).test(rhs)) rec.selfRef = true
          assignCount.set(id, rec)
        }
      }
      for (const [id, rec] of assignCount) {
        const first = firstAssignLine.get(id)
        const definedInLoop = first >= startIdx + 1 && first < i
        if (definedInLoop && rec.count === 1 && !rec.selfRef) {
          out.push(problem(startIdx + 1, 'E-MOT-006', `迴圈內變數 #${id} 定義後未修改，可能無限迴圈`, 'info'))
        }
      }
    }
  }

  return out
}
