import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useEditorStore } from './editor'
import { parseNC } from '../parsers/ncParser'

function seed(store) {
  store.$patch({
    files: [
      { id: 1, fileName: 'A.NC', rawText: '%\nO1000\nN1(T1)\nT1M6\nM30\n%', parsed: parseNC('%\nO1000\nN1(T1)\nT1M6\nM30\n%'), currentLine: 2, bookmarks: [1] },
      { id: 2, fileName: 'B.NC', rawText: '%\nO2000\nN2(T2)\nT2M6\nM30\n%', parsed: parseNC('%\nO2000\nN2(T2)\nT2M6\nM30\n%'), currentLine: 1, bookmarks: [] }
    ],
    activeFileId: 1,
    nextFileId: 4
  })
}

describe('editor store 多檔狀態', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('activeFile getter 回傳作用中檔', () => {
    const store = useEditorStore()
    seed(store)
    expect(store.activeFile.id).toBe(1)
  })

  it('currentFileName 回傳 active 檔檔名', () => {
    const store = useEditorStore()
    seed(store)
    expect(store.currentFileName).toBe('A.NC')
  })

  it('currentLine 回傳 active 檔的 currentLine', () => {
    const store = useEditorStore()
    seed(store)
    expect(store.currentLine).toBe(2)
  })

  it('bookmarks 回傳 active 檔的 bookmarks', () => {
    const store = useEditorStore()
    seed(store)
    expect(store.bookmarks).toEqual([1])
  })

  it('切換 active 檔後 getter 跟著變', () => {
    const store = useEditorStore()
    seed(store)
    store.setActiveFile(2)
    expect(store.currentFileName).toBe('B.NC')
    expect(store.currentLine).toBe(1)
    expect(store.bookmarks).toEqual([])
  })

  it('setActiveFile 清空搜尋狀態', () => {
    const store = useEditorStore()
    seed(store)
    store.searchResults = [{ line: 0 }]
    store.searchIndex = 0
    store.searchKeyword = 'M30'
    store.setActiveFile(2)
    expect(store.searchResults).toEqual([])
    expect(store.searchIndex).toBe(-1)
    expect(store.searchKeyword).toBe('')
  })

  it('removeFile 關閉 active 檔後 active 轉移鄰近檔', () => {
    const store = useEditorStore()
    seed(store)
    store.removeFile(1)
    expect(store.files.length).toBe(1)
    expect(store.activeFileId).toBe(2)
  })

  it('removeFile 關閉最後一檔後回到無檔案', () => {
    const store = useEditorStore()
    seed(store)
    store.removeFile(1)
    store.removeFile(2)
    expect(store.files.length).toBe(0)
    expect(store.activeFileId).toBe(null)
  })

  it('updateFileText 寫入指定檔 rawText', () => {
    const store = useEditorStore()
    seed(store)
    store.updateFileText(2, 'NEW TEXT')
    expect(store.files.find(f => f.id === 2).rawText).toBe('NEW TEXT')
  })

  it('setCurrentLine 寫入指定檔 currentLine', () => {
    const store = useEditorStore()
    seed(store)
    store.setCurrentLine(2, 5)
    expect(store.files.find(f => f.id === 2).currentLine).toBe(5)
  })

  it('addBookmarks 只影響 active 檔', () => {
    const store = useEditorStore()
    seed(store)
    store.searchResults = [{ line: 3 }]
    store.searchIndex = 0
    store.addBookmarks()
    expect(store.files.find(f => f.id === 1).bookmarks).toContain(3)
    expect(store.files.find(f => f.id === 2).bookmarks).toEqual([])
  })

  it('tools/lines getter 由 activeParsed 供應', () => {
    const store = useEditorStore()
    seed(store)
    expect(store.tools.length).toBeGreaterThan(0)
    expect(store.lines.length).toBeGreaterThan(0)
  })
})

function seedSplit(store) {
  store.$patch({
    files: [
      { id: 1, fileName: 'A.NC', rawText: '%\nO1000\nN1(T1)\nT1M6\nM30\n%', parsed: parseNC('%\nO1000\nN1(T1)\nT1M6\nM30\n%'), currentLine: 2, bookmarks: [1] },
      { id: 2, fileName: 'B.NC', rawText: '%\nO2000\nN2(T2)\nT2M6\nM30\n%', parsed: parseNC('%\nO2000\nN2(T2)\nT2M6\nM30\n%'), currentLine: 1, bookmarks: [] },
      { id: 3, fileName: 'C.NC', rawText: '%\nO3000\nN3(T3)\nT3M6\nM30\n%', parsed: parseNC('%\nO3000\nN3(T3)\nT3M6\nM30\n%'), currentLine: 0, bookmarks: [] }
    ],
    activeFileId: 1,
    nextFileId: 4
  })
}

describe('editor store 並排格子', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('setSplit(2) 建立 2 格並以 files 前兩支填入', () => {
    const store = useEditorStore()
    seedSplit(store)
    store.setSplit(2)
    expect(store.splitCount).toBe(2)
    expect(store.splitSlotIds).toEqual([1, 2])
  })

  it('setSplit(3) 不足時以 null 補格', () => {
    const store = useEditorStore()
    seedSplit(store)
    store.setSplit(3)
    expect(store.splitSlotIds).toEqual([1, 2, 3])
  })

  it('setSplit(3) 只有 2 支時第 3 格為 null', () => {
    const store = useEditorStore()
    seed(store)
    store.setSplit(3)
    expect(store.splitSlotIds).toEqual([1, 2, null])
  })

  it('2→3 格保留前 2 格', () => {
    const store = useEditorStore()
    seed(store)
    store.setSplit(2)
    store.setSplit(3)
    expect(store.splitSlotIds.slice(0, 2)).toEqual([1, 2])
  })

  it('3→2 格截斷且不刪除 files', () => {
    const store = useEditorStore()
    seedSplit(store)
    store.setSplit(3)
    store.setSplit(2)
    expect(store.splitSlotIds).toEqual([1, 2])
    expect(store.files.length).toBe(3)
  })

  it('moveSlot 換位（含空格）', () => {
    const store = useEditorStore()
    seed(store)
    store.setSplit(3)
    store.moveSlot(0, 2)
    expect(store.splitSlotIds).toEqual([2, null, 1])
  })

  it('moveSlot 相同位置不動作', () => {
    const store = useEditorStore()
    seed(store)
    store.setSplit(2)
    store.moveSlot(1, 1)
    expect(store.splitSlotIds).toEqual([1, 2])
  })

  it('setSlot 替換指定格', () => {
    const store = useEditorStore()
    seedSplit(store)
    store.setSplit(2)
    store.setSlot(0, 3)
    expect(store.splitSlotIds).toEqual([3, 2])
  })

  it('setSlot 同檔已在別格時交換避免重複', () => {
    const store = useEditorStore()
    seedSplit(store)
    store.setSplit(2)
    store.setSlot(1, 1)
    expect(store.splitSlotIds).toEqual([2, 1])
  })

  it('closeSlot 變空格且檔案仍在', () => {
    const store = useEditorStore()
    seed(store)
    store.setSplit(2)
    store.closeSlot(0)
    expect(store.splitSlotIds).toEqual([null, 2])
    expect(store.files.length).toBe(2)
  })

  it('removeFile 時含該 id 的格子變空格', () => {
    const store = useEditorStore()
    seed(store)
    store.setSplit(2)
    store.removeFile(2)
    expect(store.splitSlotIds).toEqual([1, null])
  })

  it('exitSplit 回到單格模式', () => {
    const store = useEditorStore()
    seed(store)
    store.setSplit(3)
    store.exitSplit()
    expect(store.splitCount).toBe(0)
    expect(store.splitSlotIds).toEqual([])
  })

  it('splitSlots getter 回傳 {id, file}', () => {
    const store = useEditorStore()
    seed(store)
    store.setSplit(2)
    const slots = store.splitSlots
    expect(slots.length).toBe(2)
    expect(slots[0].id).toBe(1)
    expect(slots[0].file.fileName).toBe('A.NC')
    expect(slots[1].file.fileName).toBe('B.NC')
  })

  it('addFile 讀檔後填入第一個空格', async () => {
    const store = useEditorStore()
    seed(store)
    store.setSplit(3)
    expect(store.splitSlotIds[2]).toBe(null)
    global.FileReader = class {
      readAsText() { this.result = '%\nO4000\nM30\n%'; this.onload() }
    }
    store.addFile({ name: 'D.NC' })
    expect(store.splitSlotIds[2]).toBe(4)
  })
})
