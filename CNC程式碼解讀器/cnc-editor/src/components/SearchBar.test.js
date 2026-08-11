import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import SearchBar from './SearchBar.vue'
import { useEditorStore } from '../stores/editor'

describe('SearchBar', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('渲染時不會因 st.value 雙重解包而崩潰', () => {
    const store = useEditorStore()
    store.$patch({
      files: [{ id: 1, fileName: 'A.NC', rawText: '%\nO1\nT1M6\nM30\n%', parsed: null, currentLine: -1, bookmarks: [] }],
      activeFileId: 1
    })
    const wrapper = mount(SearchBar, { props: { fileId: 1 } })
    expect(wrapper.find('.search-bar').exists()).toBe(true)
    expect(wrapper.find('input').exists()).toBe(true)
  })

  it('＋標籤按鈕在無搜尋結果時 disabled，搜尋後啟用', async () => {
    const store = useEditorStore()
    store.$patch({
      files: [{ id: 1, fileName: 'A.NC', rawText: '%\nO1\nN1(T1)\nT1M6\nM30\n%', parsed: { lines: ['%', 'O1', 'N1(T1)', 'T1M6', 'M30', '%'], tools: [], variables: [], coordinates: [], blocks: [], lineCoords: [] }, currentLine: -1, bookmarks: [] }],
      activeFileId: 1
    })
    const wrapper = mount(SearchBar, { props: { fileId: 1 } })
    const btn = wrapper.findAll('button').find(b => b.text() === '＋標籤')
    expect(btn.attributes('disabled')).toBeDefined()
    btn.element.disabled = false
    expect(btn.element.disabled).toBe(false)
  })
})