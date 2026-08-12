import { describe, it, expect } from 'vitest'
import { checkNC, KNOWN_G_CODES, KNOWN_M_CODES } from './codeChecker'
import { parseNC } from '../parsers/ncParser'

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

  it('N 段號非遞增不報錯（FANUC 允許廠商自定順序）', () => {
    expect(run('N5(T1)\nN3(T2)\n').some(p => p.code === 'E-FMT-004')).toBe(false)
  })

  it('問題輸出按行號遞增排序（gutter RangeSet 需要）', () => {
    const probs = run('N2(FM-125)\nN1(T1)\nG999\nM77\n')
    const lines = probs.map(p => p.line)
    expect([...lines].sort((a, b) => a - b)).toEqual(lines)
  })

  it('E-FMT-005 未知 G 碼', () => {
    expect(hasCode(run('G6\n'), 'E-FMT-005')).toBe(true)
  })

  it('G99 為合法 G 碼不觸發 E-FMT-005', () => {
    expect(hasCode(run('G99\n'), 'E-FMT-005')).toBe(false)
  })

  it('G00/G01 前導零正規化不誤報', () => {
    expect(hasCode(run('G00G01X10.\n'), 'E-FMT-005')).toBe(false)
    expect(hasCode(run('G00G01X10.\n'), 'E-FMT-009')).toBe(false)
  })

  it('G101（臥式旋轉參數）為合法 G 碼不誤報', () => {
    expect(hasCode(run('G101\n'), 'E-FMT-005')).toBe(false)
    expect(hasCode(run('G101\n'), 'E-FMT-009')).toBe(false)
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
    const p = run('G100\n').find(p => p.code === 'E-FMT-009')
    expect(p).toBeTruthy()
    expect(p.type).toBe('warning')
  })

  it('註解內含 M 碼不誤報 E-FMT-006', () => {
    expect(hasCode(run('(Z-90,M10)\n'), 'E-FMT-006')).toBe(false)
  })

  it('註解內含 G 碼不誤報 E-FMT-009', () => {
    expect(hasCode(run('(G101B0;)\n'), 'E-FMT-009')).toBe(false)
    expect(hasCode(run('(G101B0;)\n'), 'E-FMT-005')).toBe(false)
  })

  it('E-TOOL-001 換刀 M6 缺 T 碼', () => {
    expect(hasCode(run('M6\n'), 'E-TOOL-001')).toBe(true)
  })

  it('預選刀（獨立 T 無 M6）不報錯', () => {
    expect(hasCode(run('T5\n'), 'E-TOOL-001')).toBe(false)
  })

  it('E-TOOL-002 T 刀號與段標題不符', () => {
    const p = run('N1(T1)\nT2M6\n').find(p => p.code === 'E-TOOL-002')
    expect(p).toBeTruthy()
    expect(p.type).toBe('warning')
  })

  it('E-TOOL-002 標題為型號（含字母）不誤報', () => {
    expect(hasCode(run('N1(FM-125)\nT1M6\n'), 'E-TOOL-002')).toBe(false)
  })

  it('E-TOOL-003 H 號與刀號不符', () => {
    const p = run('N1(FM-125)\nT1M6\nG43Z50.H2\n').find(p => p.code === 'E-TOOL-003')
    expect(p).toBeTruthy()
    expect(p.type).toBe('warning')
  })

  it('E-TOOL-004 D 號與刀號不符', () => {
    const p = run('N1(FM-125)\nT1M6\nG1G42X1.D2\n').find(p => p.code === 'E-TOOL-004')
    expect(p).toBeTruthy()
    expect(p.type).toBe('warning')
  })

  it('E-TOOL-005 使用未定義刀具', () => {
    expect(hasCode(run('T9M6\n'), 'E-TOOL-005')).toBe(true)
  })

  it('E-TOOL-006 D 無 G41/G42', () => {
    const p = run('N1(FM-125)\nT1M6\nG1X1.D1\n').find(p => p.code === 'E-TOOL-006')
    expect(p).toBeTruthy()
    expect(p.type).toBe('warning')
  })

  it('標題括號內 D 碼（提醒補正）不誤報 E-TOOL-004/006', () => {
    const r = run('N10(D12)\nT12M6\nG1X1.\n')
    const tool004 = r.find(p => p.code === 'E-TOOL-004')
    const tool006 = r.find(p => p.code === 'E-TOOL-006')
    expect(tool004).toBeFalsy()
    expect(tool006).toBeFalsy()
  })

  it('一般括號註解內 D 碼不誤報', () => {
    const r = run('N1(FM-125)\nT1M6\nG1X1.\n(D2皗主軸補正)\n')
    expect(hasCode(r, 'E-TOOL-004')).toBe(false)
    expect(hasCode(r, 'E-TOOL-006')).toBe(false)
  })

  it('E-STR-001 WHILE 無 END1', () => {
    expect(hasCode(run('WHILE[#100LE#501]DO1\nG1X1.\n'), 'E-STR-001')).toBe(true)
  })

  it('E-STR-002 END1 無 WHILE', () => {
    expect(hasCode(run('END1\n'), 'E-STR-002')).toBe(true)
  })

  it('E-STR-004 GOTO 目標不存在', () => {
    const p = run('N1(T1)\nGOTO101\n').find(p => p.code === 'E-STR-004')
    expect(p).toBeTruthy()
    expect(p.line).toBe(2)
  })

  it('E-STR-004 裸 N 標記可作為 GOTO 目標不報', () => {
    expect(hasCode(run('N100\nGOTO100\n'), 'E-STR-004')).toBe(false)
  })

  it('E-STR-005 變數未定義即使用', () => {
    expect(hasCode(run('#501=53+#999\n'), 'E-STR-005')).toBe(true)
  })

  it('E-STR-005 系統變數 #1000/#5000 不誤報', () => {
    expect(hasCode(run('#1000\n'), 'E-STR-005')).toBe(false)
    expect(hasCode(run('#5000\n'), 'E-STR-005')).toBe(false)
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
    const p = run('M30\n').find(p => p.code === 'E-MOT-003')
    expect(p).toBeTruthy()
    expect(p.type).toBe('warning')
  })

  it('E-MOT-004 使用 G54 但無設定行', () => {
    const p = run('G0G90G54X1.\n').find(p => p.code === 'E-MOT-004')
    expect(p).toBeTruthy()
    expect(p.line).toBe(1)
    expect(p.type).toBe('warning')
  })

  it('E-MOT-004 裸 G54 單獨行視為設定不報', () => {
    expect(hasCode(run('G54\n'), 'E-MOT-004')).toBe(false)
  })

  it('E-MOT-004 有設定行後使用不報', () => {
    expect(hasCode(run('G54\nG0G90G54X1.\n'), 'E-MOT-004')).toBe(false)
  })

  it('E-TOOL-007 H 碼無 G43', () => {
    const p = run('N1(T1)\nT1M6\nG1X1.H1\n').find(p => p.code === 'E-TOOL-007')
    expect(p).toBeTruthy()
    expect(p.type).toBe('info')
  })

  it('E-TOOL-007 有 G43 不報', () => {
    expect(hasCode(run('N1(T1)\nT1M6\nG43Z50.H1\n'), 'E-TOOL-007')).toBe(false)
  })

  it('E-STR-007 G#100 動態座標系超出範圍', () => {
    const p = run('#100=7\nG#100X10.\n').find(p => p.code === 'E-STR-007')
    expect(p).toBeTruthy()
    expect(p.type).toBe('warning')
  })

  it('E-STR-007 G#100 值在合法範圍不報', () => {
    expect(hasCode(run('#100=54\nG#100X10.\n'), 'E-STR-007')).toBe(false)
  })

  it('E-MOT-005 Z 進給前無 M3/M4', () => {
    const p = run('G1Z-2.\n').find(p => p.code === 'E-MOT-005')
    expect(p).toBeTruthy()
    expect(p.type).toBe('warning')
  })

  it('E-MOT-005 先前有 M3 不報', () => {
    expect(hasCode(run('M3\nG1Z-2.\n'), 'E-MOT-005')).toBe(false)
  })

  it('E-MOT-006 迴圈內定義且未修改的變數', () => {
    const p = run('WHILE[#100LE#501]DO1\n#200=1\nEND1\n').find(p => p.code === 'E-MOT-006')
    expect(p).toBeTruthy()
    expect(p.type).toBe('info')
  })

  it('E-MOT-006 迴圈內有修改不報', () => {
    expect(hasCode(run('WHILE[#100LE#501]DO1\n#200=1\n#200=#200+1\nEND1\n'), 'E-MOT-006')).toBe(false)
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
    expect(KNOWN_G_CODES).toContain('G99')
    expect(KNOWN_G_CODES).toContain('G53')
    expect(KNOWN_M_CODES).toContain('M30')
    expect(KNOWN_M_CODES).toContain('M19')
  })
})

describe('codeChecker 整合測試（真實 parseNC）', () => {
  it('A.NC 風格樣本無 error 誤報（G00/G01/G99/註解帶碼/T0M6 結尾/N 號亂序/WHILE-END1）', () => {
    const txt = [
      '%',
      'O1154(CGJ1-005-V0)',
      '(B3101=A-G54-G59)',
      '#500=2',
      '#501=53+#500',
      'N8(FM-125M-435)(FMA38.1-45)',
      'T1M6',
      '#100=54',
      'WHILE[#100LE#501]DO1',
      'G0G90G#100X-90.Y145.',
      'G43Z50.H1S350M3',
      'G1X840.F1000',
      '#100=#100+1',
      'END1',
      'M9',
      'M5',
      '(Z0,M6)',
      'N4(EM-25M-5K-R-B)(SLA25-105)',
      'T4M6',
      'G90G00G#100X900.Y-213.',
      'G43H4Z50.S1400M3',
      'G01Z-2.7F1700',
      'G99G81R3.Z-2.2F200.',
      'G80',
      'N3(FM-125-WS)(FMA38.1-45)',
      'T3M6',
      'G91G28Z0.',
      'G91G28X0.Y0.',
      'T0M6',
      'M30',
      '%'
    ].join('\n')
    const parsed = parseNC(txt)
    const result = checkNC({
      text: txt,
      blocks: parsed.blocks,
      tools: parsed.tools,
      variables: parsed.variables,
      lineCoords: parsed.lineCoords
    })
    expect(result.filter(p => p.type === 'error').length).toBe(0)
  })
})
