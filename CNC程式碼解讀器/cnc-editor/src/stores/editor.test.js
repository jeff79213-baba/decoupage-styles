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
    nextFileId: 3
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
