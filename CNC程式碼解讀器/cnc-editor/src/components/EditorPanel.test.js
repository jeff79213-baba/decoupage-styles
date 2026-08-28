import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import EditorPanel from './EditorPanel.vue'
import { useEditorStore } from '../stores/editor'
import { parseNC } from '../parsers/ncParser'

function makeWrapper(props) {
  return mount(EditorPanel, {
    props,
    global: {
      stubs: { SearchBar: true, ColorSettings: true }
    }
  })
}

describe('EditorPanel 錯誤標記', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} })
  })

  it('載入有錯誤的檔案後顯示錯誤標記，切換到無錯誤檔案後清除', async () => {
    const store = useEditorStore()
    store.$patch({
      files: [
        { id: 1, fileName: 'BAD.NC', rawText: 'END1\n', parsed: parseNC('END1\n'), currentLine: -1, bookmarks: [] },
        { id: 2, fileName: 'GOOD.NC', rawText: '%\nO1000\nN1(T1)\nT1M6\nG28\nM30\n%', parsed: parseNC('%\nO1000\nN1(T1)\nT1M6\nG28\nM30\n%'), currentLine: -1, bookmarks: [] }
      ],
      activeFileId: 1,
      nextFileId: 3
    })
    store.runCheck(1)
    store.runCheck(2)

    const wrapper = makeWrapper({ fileId: 1 })
    expect(wrapper.vm).toBeTruthy()
    expect(store.errorsByFile[1].length).toBeGreaterThan(0)
    expect(store.errorsByFile[2]).toEqual([])
  })
})
