import { describe, it, expect } from 'vitest'
import { parseNC } from './ncParser'

describe('ncParser 刀號解析', () => {
  it('支援 M06（零前導）寫法', () => {
    const p = parseNC('%\nN20(TAP-M6*1)(BT50-TPM316)\nT20M06\nM30\n%')
    expect(p.tools[0].toolNo).toBe('20')
    expect(p.blocks[0].toolNo).toBe('20')
  })

  it('支援 MO6（字母 O）寫法', () => {
    const p = parseNC('%\nN10(CDR-3M)\nT10MO6\nM30\n%')
    expect(p.tools[0].toolNo).toBe('10')
  })

  it('T0M6（卸刀）不寫入 toolNo', () => {
    const p = parseNC('%\nN3(FM-125-WS)(FMA38.1-45)\nT3M6\nG91G28Z0\nT0M6\nM30\n%')
    expect(p.blocks[0].toolNo).toBe('3')
    expect(p.tools.map(t => t.toolNo)).toEqual(['3'])
  })

  it('回零段 尾段 T..M6 不覆蓋原刀號', () => {
    const p = parseNC('%\nN26(DR-7.9)(ER25-150)\nT26M6\nG91G28Z0\nT2M6\nM30\n%')
    expect(p.blocks[0].toolNo).toBe('26')
    expect(p.tools.map(t => t.toolNo)).toEqual(['26'])
  })

  it('block 內已有刀號不重覆覆蓋', () => {
    const p = parseNC('%\nN1(FM-125)(FMA)\nT1M6\nT8M6\nM30\n%')
    expect(p.blocks[0].toolNo).toBe('1')
    expect(p.tools.map(t => t.toolNo)).toEqual(['1'])
  })
})