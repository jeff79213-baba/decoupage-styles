# 雙程式比較與編輯功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 CNC 編輯平台能同時載入兩支程式、各自獨立編輯，分頁簽切換或左右並排比較，左側欄位跟隨作用中程式，並以高亮明顯標示目前作用程式。

**Architecture:** store 由單一檔案狀態改為 `files[]` 陣列 + `activeFileId`，所有 getter（tools/variables/coordinates/lines/blocks/lineCoords/currentLine/bookmarks）改由 active 檔供應。EditorPanel 改為接收 `fileId` prop 的單檔元件（移除內部 split 邏輯），並排由 App.vue 掛兩個 EditorPanel 實例實作。

**Tech Stack:** Vue 3.5 + Pinia + CodeMirror 6 + Vite 6 + Vitest

## Global Constraints

- 專案根目錄：`CNC程式碼解讀器/cnc-editor/`（工作目錄 `C:\Users\TW-10\Documents\firebase雲端資料夾`）
- 所有新增/修改檔案只限於 CNC 專案內，commit 只 stage CNC 相關檔案，**不 commit** `A.NC~D.NC` 測試檔
- 安裝版 build 流程：`npx vite build` 後執行 `scripts/build-install.ps1`（產出至 `../安裝版/`）
- localStorage keys 維持現有前綴 `cnc-`
- 不引入新套件，除測試需加 `vitest`、`jsdom`（devDependencies）
- 中文檔名/內容一律 UTF-8

---

### Task 1: 建立 Vitest 測試框架與 store 測試骨架

**Files:**
- Modify: `cnc-editor/package.json`
- Create: `cnc-editor/vitest.config.js`
- Create: `cnc-editor/src/stores/editor.test.js`

**Interfaces:**
- Consumes: 既有 `src/stores/editor.js`、`src/parsers/ncParser.js`
- Produces: `npm test`（= `vitest run`）可執行；`editor.test.js` 內含 `seed()` helper 與佔位測試（Task 2 會實作 store 後通過）

- [ ] **Step 1: 在 package.json 加入測試腳本與 devDependencies**

編輯 `cnc-editor/package.json`，在 `scripts` 加入 `"test": "vitest run"`，在 `devDependencies` 加入：

```json
    "vitest": "^3.0.0",
    "jsdom": "^26.0.0"
```

- [ ] **Step 2: 建立 vitest.config.js**

Create `cnc-editor/vitest.config.js`：

```js
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom'
  }
})
```

- [ ] **Step 3: 建立 store 測試骨架（先寫會失敗的測試）**

Create `cnc-editor/src/stores/editor.test.js`：

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useEditorStore } from './editor'
import { parseNC } from '../parsers/ncParser'

function seed(store) {
  store.$patch({
    files: [
      { id: 1, fileName: 'A.NC', rawText: '%\nO1000\nN1(T1)\nM30\n%', parsed: parseNC('%\nO1000\nN1(T1)\nM30\n%'), currentLine: 2, bookmarks: [1] },
      { id: 2, fileName: 'B.NC', rawText: '%\nO2000\nN2(T2)\nM30\n%', parsed: parseNC('%\nO2000\nN2(T2)\nM30\n%'), currentLine: 1, bookmarks: [] }
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
```

- [ ] **Step 4: 執行測試確認失敗**

Run: `npm test`
Expected: FAIL — `setActiveFile` is not a function（因 store 尚未改為多檔），且 `activeFile` getter 不存在。

- [ ] **Step 5: Commit**

```bash
git add cnc-editor/package.json cnc-editor/vitest.config.js cnc-editor/src/stores/editor.test.js
git commit -m "test: 建立 Vitest 測試框架與多檔 store 測試骨架"
```

---

### Task 2: store 多檔化重構

**Files:**
- Rewrite: `cnc-editor/src/stores/editor.js`

**Interfaces:**
- Consumes: 既有 `src/parsers/ncParser.js`（`parseNC`）
- Produces（供後續 Task 使用）:
  - state: `files[{id, fileName, rawText, parsed, currentLine, bookmarks}]`、`activeFileId`、`nextFileId`
  - getters: `activeFile`、`activeParsed`、`tools`、`variables`、`coordinates`、`lines`、`blocks`、`lineCoords`、`currentFileName`、`currentLine`、`bookmarks`、`fileById(id)`、`effectiveSyntaxColors`
  - actions: `addFile(file)`、`setActiveFile(id)`、`removeFile(id)`、`updateFileText(fileId, text)`、`setCurrentLine(fileId, line)`、`openFile()`、`saveFile()`、`downloadToolTable()`、`search(keyword)`、`nextSearch()`、`prevSearch()`、`goToLine(lineIndex)`、`addBookmarks()`、`removeBookmark(line)`、`clearBookmarks()`、`setNav(section)`、`updateSyntaxColor(category, color)`、`setMonochrome(enabled)`、`toggleMonoEnabled(category)`、`loadSyntaxColors()`

- [ ] **Step 1: 重寫 editor.js 為多檔結構**

Rewrite `cnc-editor/src/stores/editor.js` 為以下內容（**完整取代現有檔案**）：

```js
import { defineStore } from 'pinia'
import { parseNC } from '../parsers/ncParser'

export const useEditorStore = defineStore('editor', {
  state: () => ({
    files: [],
    activeFileId: null,
    nextFileId: 1,
    selectedNav: 'tools',
    searchKeyword: '',
    searchResults: [],
    searchIndex: -1,
    showTypeColumn: true,
    monochrome: false,
    monoEnabled: {},
    syntaxColors: {
      G: '#89b4fa',
      M: '#f38ba8',
      N: '#cba6f7',
      variable: '#fab387',
      comment: '#6c7086',
      X: '#a6e3a1',
      Y: '#94e2d5',
      Z: '#f38ba8',
      S: '#f9e2af',
      F: '#fab387',
      T: '#cba6f7',
      H: '#89dceb',
      D: '#eba0ac'
    }
  }),

  getters: {
    activeFile: (state) => state.files.find(f => f.id === state.activeFileId) || null,
    fileById: (state) => (id) => state.files.find(f => f.id === id) || null,
    activeParsed() { return this.activeFile?.parsed || null },
    tools() { return this.activeParsed?.tools || [] },
    variables() { return this.activeParsed?.variables || [] },
    coordinates() { return this.activeParsed?.coordinates || [] },
    lines() { return this.activeParsed?.lines || [] },
    blocks() { return this.activeParsed?.blocks || [] },
    lineCoords() { return this.activeParsed?.lineCoords || [] },
    currentFileName() { return this.activeFile?.fileName || '' },
    currentLine() { return this.activeFile?.currentLine ?? -1 },
    bookmarks() { return this.activeFile?.bookmarks || [] },
    effectiveSyntaxColors() {
      if (!this.monochrome) return this.syntaxColors
      const gray = { G: '#6c7086', M: '#6c7086', N: '#6c7086', X: '#6c7086', Y: '#6c7086', Z: '#6c7086', S: '#6c7086', F: '#6c7086', T: '#6c7086', H: '#6c7086', D: '#6c7086', variable: '#6c7086', comment: '#6c7086' }
      const out = { ...gray }
      for (const key of Object.keys(this.monoEnabled)) {
        if (this.monoEnabled[key] && this.syntaxColors[key]) {
          out[key] = this.syntaxColors[key]
        }
      }
      return out
    }
  },

  actions: {
    addFile(file) {
      const id = this.nextFileId++
      const rec = { id, fileName: file.name, rawText: '', parsed: null, currentLine: -1, bookmarks: [] }
      this.files.push(rec)
      this.setActiveFile(id)
      const reader = new FileReader()
      reader.onload = () => {
        rec.rawText = reader.result
        rec.parsed = parseNC(reader.result)
      }
      reader.readAsText(file, 'utf-8')
    },

    setActiveFile(id) {
      if (!this.files.some(f => f.id === id)) return
      this.activeFileId = id
      this.searchKeyword = ''
      this.searchResults = []
      this.searchIndex = -1
    },

    removeFile(id) {
      const idx = this.files.findIndex(f => f.id === id)
      if (idx < 0) return
      this.files.splice(idx, 1)
      if (this.activeFileId === id) {
        if (this.files.length) {
          this.setActiveFile(this.files[Math.max(0, idx - 1)].id)
        } else {
          this.activeFileId = null
          this.searchKeyword = ''
          this.searchResults = []
          this.searchIndex = -1
        }
      }
    },

    updateFileText(fileId, text) {
      const f = this.files.find(f => f.id === fileId)
      if (!f) return
      f.rawText = text
    },

    setCurrentLine(fileId, line) {
      const f = this.files.find(f => f.id === fileId)
      if (f) f.currentLine = line
    },

    async openFile() {
      return new Promise((resolve) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.nc,.txt'
        input.onchange = (e) => {
          const file = e.target.files[0]
          if (!file) return
          this.addFile(file)
          resolve()
        }
        input.click()
      })
    },

    saveFile() {
      const f = this.activeFile
      if (!f || !f.rawText) return
      const blob = new Blob([f.rawText], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = f.fileName || 'program.nc'
      a.click()
      URL.revokeObjectURL(url)
    },

    downloadToolTable() {
      const tools = this.tools
      if (!tools.length) return
      let text = 'N號\t刀具名稱\t刀桿名稱'
      if (this.showTypeColumn) text += '\t加工類型'
      text += '\n' + '='.repeat(60) + '\n'
      for (const t of tools) {
        text += `${t.n}\t${t.toolName}\t${t.holderName}`
        if (this.showTypeColumn) text += `\t${t.type}`
        text += '\n'
      }
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = (this.currentFileName || 'program').replace('.nc', '') + '_刀號表.txt'
      a.click()
      URL.revokeObjectURL(url)
    },

    search(keyword) {
      this.searchKeyword = keyword
      if (!keyword) {
        this.searchResults = []
        this.searchIndex = -1
        return
      }
      const results = []
      const lines = this.lines
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(keyword)) {
          results.push({ line: i, text: lines[i].trim() })
        }
      }
      this.searchResults = results
      this.searchIndex = results.length > 0 ? 0 : -1
    },

    nextSearch() {
      if (this.searchResults.length === 0) return
      this.searchIndex = (this.searchIndex + 1) % this.searchResults.length
      this.currentLine = this.searchResults[this.searchIndex].line
    },

    prevSearch() {
      if (this.searchResults.length === 0) return
      this.searchIndex = this.searchIndex <= 0 ? this.searchResults.length - 1 : this.searchIndex - 1
      this.currentLine = this.searchResults[this.searchIndex].line
    },

    goToLine(lineIndex) {
      const f = this.activeFile
      if (f) f.currentLine = lineIndex
      this.searchResults = [{ line: lineIndex, text: this.lines[lineIndex] }]
      this.searchIndex = 0
    },

    addBookmarks() {
      const f = this.activeFile
      if (!f || !this.searchResults.length) return
      for (const r of this.searchResults) {
        if (!f.bookmarks.includes(r.line)) f.bookmarks.push(r.line)
      }
      f.bookmarks.sort((a, b) => a - b)
    },

    removeBookmark(line) {
      const f = this.activeFile
      if (!f) return
      f.bookmarks = f.bookmarks.filter(l => l !== line)
    },

    clearBookmarks() {
      const f = this.activeFile
      if (f) f.bookmarks = []
    },

    setNav(section) {
      this.selectedNav = section
    },

    updateSyntaxColor(category, color) {
      this.syntaxColors[category] = color
      localStorage.setItem('cnc-syntax-colors', JSON.stringify(this.syntaxColors))
    },

    setMonochrome(enabled) {
      this.monochrome = enabled
      localStorage.setItem('cnc-monochrome', JSON.stringify(enabled))
    },

    toggleMonoEnabled(category) {
      this.monoEnabled[category] = !this.monoEnabled[category]
      localStorage.setItem('cnc-mono-enabled', JSON.stringify(this.monoEnabled))
    },

    loadSyntaxColors() {
      try {
        const saved = localStorage.getItem('cnc-syntax-colors')
        if (saved) this.syntaxColors = { ...this.syntaxColors, ...JSON.parse(saved) }
        const mono = localStorage.getItem('cnc-monochrome')
        if (mono != null) this.monochrome = JSON.parse(mono)
        const monoEnabled = localStorage.getItem('cnc-mono-enabled')
        if (monoEnabled) this.monoEnabled = JSON.parse(monoEnabled)
      } catch {}
    }
  }
})
```

> 注意：`nextSearch`/`prevSearch` 中的 `this.currentLine = ...` 透過 getter 設值——getter 不可直接賦值。因此這兩個 action 需改為寫入 activeFile：
> `const f = this.activeFile; if (f) f.currentLine = this.searchResults[this.searchIndex].line`

- [ ] **Step 2: 修正 nextSearch/prevSearch 寫入 activeFile.currentLine**

在重寫後的 `editor.js` 中，`nextSearch` 與 `prevSearch` 的 `this.currentLine = ...` 改為：

```js
    nextSearch() {
      if (this.searchResults.length === 0) return
      this.searchIndex = (this.searchIndex + 1) % this.searchResults.length
      const f = this.activeFile
      if (f) f.currentLine = this.searchResults[this.searchIndex].line
    },

    prevSearch() {
      if (this.searchResults.length === 0) return
      this.searchIndex = this.searchIndex <= 0 ? this.searchResults.length - 1 : this.searchIndex - 1
      const f = this.activeFile
      if (f) f.currentLine = this.searchResults[this.searchIndex].line
    },
```

- [ ] **Step 3: 執行測試確認通過**

Run: `npm test`
Expected: PASS（11 個測試全數通過）

- [ ] **Step 4: 執行既有 dev build 確認無語法錯誤**

Run: `npx vite build`
Expected: 成功，無錯誤。

- [ ] **Step 5: Commit**

```bash
git add cnc-editor/src/stores/editor.js
git commit -m "refactor: store 多檔化 - files[] + activeFileId，所有 getter 由 activeParsed 供應"
```

---

### Task 3: EditorPanel 改為單檔元件

**Files:**
- Rewrite: `cnc-editor/src/components/EditorPanel.vue`

**Interfaces:**
- Consumes: 上一個 Task 的 store（`fileById(id)`、`setActiveFile(id)`、`updateFileText(fileId, text)`、`setCurrentLine(fileId, line)`、`activeFileId`）、既有 `SearchBar.vue`、`ColorSettings.vue`、`buildCncLanguage`、CodeMirror APIs
- Produces: `<EditorPanel :file-id="number" />` — 顯示單一檔案的編輯器，focus/click 時呼叫 `store.setActiveFile(fileId)`；expose `{ onSearchResult, goToLine }`
- App.vue 以 `:key="f.id"` 掛載，確保每次 fileId 固定不會替換

- [ ] **Step 1: 重寫 EditorPanel.vue 為單檔元件**

Rewrite `cnc-editor/src/components/EditorPanel.vue` 為以下內容（**完整取代現有檔案**）：

```vue
<script setup>
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState, StateEffect, StateField } from '@codemirror/state'
import { keymap, GutterMarker, lineNumberMarkers } from '@codemirror/view'
import { RangeSet } from '@codemirror/state'
import { indentWithTab } from '@codemirror/commands'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { useEditorStore } from '../stores/editor'
import { buildCncLanguage } from '../parsers/cncLanguage'
import SearchBar from './SearchBar.vue'
import ColorSettings from './ColorSettings.vue'

const props = defineProps({
  fileId: { type: Number, default: null }
})
const store = useEditorStore()

const isActive = computed(() => store.activeFileId === props.fileId)
const fileInfo = computed(() => store.fileById(props.fileId))

const setBookmarksEffect = StateEffect.define()
class BookmarkDot extends GutterMarker {
  toDOM() {
    const span = document.createElement('span')
    span.className = 'cm-bookmark-dot'
    return span
  }
  eq(other) { return other instanceof BookmarkDot }
}
const bookmarkPositionsField = StateField.define({
  create: () => [],
  update(positions, tr) {
    positions = positions.map(p => tr.changes.mapPos(p, 1))
    for (const e of tr.effects) {
      if (e.is(setBookmarksEffect)) positions = e.value
    }
    return positions
  },
  provide: (f) => lineNumberMarkers.from(f, positions => {
    const ranges = positions.map(p => new BookmarkDot().range(p))
    return RangeSet.of(ranges)
  })
})

const editorContainer = ref(null)
let view = null
const showColorSettings = ref(false)

function buildExtensions() {
  return [
    basicSetup,
    bookmarkPositionsField,
    keymap.of([...searchKeymap, indentWithTab]),
    highlightSelectionMatches(),
    buildCncLanguage(store.effectiveSyntaxColors),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        store.updateFileText(props.fileId, update.state.doc.toString())
      }
      if (update.selectionSet) {
        const pos = update.state.selection.main.head
        const line = update.state.doc.lineAt(pos)
        store.setCurrentLine(props.fileId, line.number - 1)
      }
      if (update.viewportChanged) {
        const from = update.view.viewport.from
        const line = update.state.doc.lineAt(from)
        store.setCurrentLine(props.fileId, line.number - 1)
      }
    })
  ]
}

function bookmarkPositions(v) {
  const doc = v.state.doc
  const marks = fileInfo.value?.bookmarks || []
  return marks.map(lineNum => {
    const clamped = Math.min(lineNum, doc.lines - 1)
    return doc.line(clamped + 1).from
  })
}

function applyBookmarks(v) {
  v.dispatch({ effects: setBookmarksEffect.of(bookmarkPositions(v)) })
}

function createView(container) {
  const state = EditorState.create({
    doc: fileInfo.value?.rawText || '',
    extensions: buildExtensions()
  })
  const v = new EditorView({ state, parent: container })
  if (fileInfo.value?.bookmarks?.length) {
    applyBookmarks(v)
  }
  v.dom.addEventListener('focusin', () => { store.setActiveFile(props.fileId) })
  v.dom.addEventListener('pointerdown', () => { store.setActiveFile(props.fileId) })
  return v
}

function initEditor() {
  if (!editorContainer.value) return
  view = createView(editorContainer.value)
}

function goToLine(lineIndex) {
  if (!view) return
  const target = view
  const pos = target.state.doc.line(lineIndex + 1)
  target.dispatch({
    selection: { anchor: pos.from },
    effects: EditorView.scrollIntoView(pos.from, { y: 'start' })
  })
}

function onSearchResult(results, index) {
  if (!isActive.value || !view || index < 0 || !results.length) return
  goToLine(results[index].line)
}

onMounted(() => {
  store.loadSyntaxColors()
  initEditor()
})

onBeforeUnmount(() => {
  view?.destroy()
  view = null
})

watch(() => fileInfo.value?.rawText, (newVal) => {
  if (view && newVal !== view.state.doc.toString()) {
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: newVal }
    })
  }
})

watch(() => fileInfo.value?.bookmarks, () => {
  if (view) applyBookmarks(view)
}, { deep: true })

watch(() => store.effectiveSyntaxColors, async () => {
  if (!view) return
  const pos = view.state.selection.main.head
  view.destroy()
  view = null
  if (editorContainer.value) view = createView(editorContainer.value)
  if (pos <= view.state.doc.length) {
    view.dispatch({ selection: { anchor: pos } })
  }
}, { deep: true })

defineExpose({ onSearchResult, goToLine })
</script>

<template>
  <div class="editor-panel" :class="{ active: isActive }">
    <div class="editor-header">
      <span class="file-name">{{ fileInfo?.fileName || '未開啟檔案' }}</span>
      <div class="editor-actions">
        <SearchBar @search="onSearchResult" />
        <button @click="showColorSettings = !showColorSettings">顏色設定</button>
      </div>
    </div>
    <div ref="editorContainer" class="editor-body"></div>
    <ColorSettings v-if="showColorSettings" @close="showColorSettings = false" />
  </div>
</template>

<style scoped>
.editor-panel { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
.editor-header { display: flex; align-items: center; justify-content: space-between; padding: 4px 12px; background: #181825; border-bottom: 1px solid #313244; }
.editor-panel.active .editor-header { background: #1e1e2e; box-shadow: inset 0 2px 0 #89b4fa; }
.file-name { font-size: 13px; color: #a6adc8; font-weight: 600; }
.editor-panel.active .file-name { color: #89b4fa; font-size: 14px; }
.editor-actions { display: flex; align-items: center; gap: 6px; }
.editor-body { flex: 1; overflow: hidden; display: flex; }
.editor-body :deep(.cm-editor) { height: 100%; flex: 1; }
.editor-body :deep(.cm-scroller) { overflow: auto; }
.editor-body :deep(.cm-gutterElement) { position: relative; }
.editor-body :deep(.cm-bookmark-dot) {
  display: inline-block;
  margin-left: 3px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #f9e2af;
  vertical-align: middle;
}
</style>
```

> 注意：移除了舊版的 `view2`、`splitMode`、`splitPct`、`activeView`、分隔條邏輯——這些將由 App.vue 的並排模式取代。

- [ ] **Step 2: 執行 dev build 確認無語法錯誤**

Run: `npx vite build`
Expected: 成功，無錯誤。

- [ ] **Step 3: Commit**

```bash
git add cnc-editor/src/components/EditorPanel.vue
git commit -m "refactor: EditorPanel 改為單檔元件 - 接收 fileId prop，focus 時設為 active"
```

---

### Task 4: App.vue 分頁簽列 + 並排模式 + active 標示

**Files:**
- Rewrite: `cnc-editor/src/App.vue`
- Modify: `cnc-editor/src/components/LeftNav.vue`（頂部加「目前程式」標示）

**Interfaces:**
- Consumes: store（`files`、`activeFileId`、`setActiveFile`、`removeFile`、`addFile`、`openFile`、`saveFile`、`downloadToolTable`）、`EditorPanel`（`fileId` prop、ref expose）
- Produces: 分頁簽列、並排模式（左右兩格 EditorPanel）、active 高亮、左側「目前程式」標示

- [ ] **Step 1: 重寫 App.vue**

Rewrite `cnc-editor/src/App.vue` 為以下內容（**完整取代現有檔案**）：

```vue
<script setup>
import { ref, reactive, computed } from 'vue'
import { useEditorStore } from './stores/editor'
import EditorPanel from './components/EditorPanel.vue'
import LeftNav from './components/LeftNav.vue'
import SimCanvas from './components/SimCanvas.vue'

const store = useEditorStore()
const editorRefs = reactive({})
const isDragging = ref(false)
const splitMode = ref(false)
const splitPct = ref(50)
let dragDepth = 0
let draggingDivider = false

function registerEditor(el, fileId) {
  if (el) editorRefs[fileId] = el
  else delete editorRefs[fileId]
}

const splitPair = computed(() => {
  const files = store.files
  if (!files.length) return { left: null, right: null }
  const activeIdx = files.findIndex(f => f.id === store.activeFileId)
  if (activeIdx < 0) return { left: files[0], right: files[1] || null }
  const right = files.find((f, i) => i !== activeIdx) || null
  return { left: files[activeIdx], right }
})

function onDividerDown(e) {
  draggingDivider = true
  e.preventDefault()
  const move = (ev) => {
    if (!draggingDivider) return
    const body = document.querySelector('.split-body')
    if (!body) return
    const rect = body.getBoundingClientRect()
    const pct = ((ev.clientX - rect.left) / rect.width) * 100
    splitPct.value = Math.min(85, Math.max(15, pct))
  }
  const up = () => {
    draggingDivider = false
    window.removeEventListener('mousemove', move)
    window.removeEventListener('mouseup', up)
  }
  window.addEventListener('mousemove', move)
  window.addEventListener('mouseup', up)
}

function handleSearch(results, index) {
  const el = editorRefs[store.activeFileId]
  el?.onSearchResult(results, index)
}

function handleNavigate(lineIndex) {
  store.goToLine(lineIndex)
  const el = editorRefs[store.activeFileId]
  el?.goToLine(lineIndex)
}

function onDragEnter(e) {
  e.preventDefault()
  if (e.dataTransfer?.types?.includes('Files')) {
    dragDepth++
    isDragging.value = true
  }
}

function onDragOver(e) {
  e.preventDefault()
}

function onDragLeave(e) {
  e.preventDefault()
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) isDragging.value = false
}

function onDrop(e) {
  e.preventDefault()
  dragDepth = 0
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) store.addFile(file)
}
</script>

<template>
  <div class="app-layout" @dragenter="onDragEnter" @dragover="onDragOver" @dragleave="onDragLeave" @drop="onDrop">
    <header class="toolbar">
      <h2>CNC 程式編輯平台</h2>
      <div class="toolbar-actions">
        <button @click="store.openFile">開啟檔案</button>
        <button @click="store.saveFile">儲存檔案</button>
        <button @click="store.downloadToolTable" :disabled="!store.tools.length">下載刀號表</button>
        <button @click="splitMode = !splitMode" :class="{ on: splitMode }">並排</button>
      </div>
    </header>
    <div class="tabs-bar">
      <div v-for="f in store.files" :key="f.id" class="tab" :class="{ active: f.id === store.activeFileId }" @click="store.setActiveFile(f.id)">
        <span class="tab-name">{{ f.fileName }}</span>
        <span class="tab-close" @click.stop="store.removeFile(f.id)">×</span>
      </div>
      <span v-if="!store.files.length" class="tabs-empty">拖入或開啟 NC 檔案</span>
    </div>
    <div class="main-area">
      <LeftNav @navigate="handleNavigate" />
      <div class="right-area">
        <div v-if="splitMode && splitPair.left && splitPair.right" class="split-body">
          <EditorPanel :key="splitPair.left.id" :file-id="splitPair.left.id" :ref="(el) => registerEditor(el, splitPair.left.id)" :style="{ flex: `0 0 ${splitPct}%` }" />
          <div class="split-divider" @mousedown="onDividerDown"></div>
          <EditorPanel :key="splitPair.right.id" :file-id="splitPair.right.id" :ref="(el) => registerEditor(el, splitPair.right.id)" :style="{ flex: 1 }" />
        </div>
        <EditorPanel v-else-if="store.activeFileId" :key="store.activeFileId" :file-id="store.activeFileId" :ref="(el) => registerEditor(el, store.activeFileId)" />
        <div v-else class="no-file">請拖入或開啟 NC 檔案</div>
        <SimCanvas />
      </div>
    </div>
    <div v-if="isDragging" class="drop-overlay">
      <div class="drop-box">放開以開啟 NC 檔案</div>
    </div>
  </div>
</template>

<style scoped>
.app-layout { display: flex; flex-direction: column; height: 100vh; }
.toolbar { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; background: #181825; border-bottom: 1px solid #313244; }
.toolbar h2 { font-size: 16px; font-weight: 600; }
.toolbar-actions { display: flex; gap: 8px; }
.toolbar-actions button.on { background: #89b4fa; color: #11111b; }
.tabs-bar { display: flex; align-items: stretch; background: #11111b; border-bottom: 1px solid #313244; min-height: 34px; overflow-x: auto; }
.tab { display: flex; align-items: center; gap: 6px; padding: 0 12px; cursor: pointer; color: #a6adc8; font-size: 13px; border-right: 1px solid #313244; white-space: nowrap; }
.tab:hover { background: #31324455; }
.tab.active { background: #89b4fa; color: #11111b; font-weight: 600; }
.tab-close { font-size: 14px; color: inherit; padding: 0 2px; border-radius: 3px; }
.tab-close:hover { background: #00000033; }
.tabs-empty { padding: 8px 12px; color: #6c7086; font-size: 13px; }
.main-area { display: flex; flex: 1; overflow: hidden; }
.right-area { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
.split-body { display: flex; flex: 1; overflow: hidden; min-height: 0; }
.split-body :deep(.editor-panel) { min-width: 0; }
.split-divider { flex: 0 0 6px; background: #313244; cursor: col-resize; border-left: 1px solid #45475a; border-right: 1px solid #45475a; }
.split-divider:hover, .split-divider:active { background: #89b4fa66; }
.no-file { flex: 1; display: flex; align-items: center; justify-content: center; color: #6c7086; font-size: 14px; }
.drop-overlay { position: fixed; inset: 0; z-index: 999; background: #89b4fa22; display: flex; align-items: center; justify-content: center; pointer-events: none; }
.drop-box { background: #181825; border: 2px dashed #89b4fa; border-radius: 12px; padding: 40px 60px; font-size: 18px; color: #89b4fa; }
</style>
```

> 注意：`EditorPanel` 以 `:ref` callback 註冊到 `editorRefs[fileId]`，使搜尋/導覽能定位到正確的編輯器實例。

- [ ] **Step 2: 在 LeftNav 頂部加入「目前程式」標示**

修改 `cnc-editor/src/components/LeftNav.vue` 的 `<template>`，在 `<div class="left-nav">` 最上方（`nav-items` 之前）插入：

```vue
    <div class="active-program">
      <span class="ap-label">目前程式：</span>
      <span class="ap-name">{{ store.currentFileName || '未開啟' }}</span>
    </div>
```

並在 `<style scoped>` 加入：

```css
.active-program { display: flex; align-items: center; gap: 4px; padding: 6px 12px; background: #11111b; border-bottom: 1px solid #313244; font-size: 13px; }
.ap-label { color: #6c7086; }
.ap-name { color: #89b4fa; font-weight: 600; }
```

- [ ] **Step 3: 執行 dev build 確認無語法錯誤**

Run: `npx vite build`
Expected: 成功，無錯誤。

- [ ] **Step 4: Commit**

```bash
git add cnc-editor/src/App.vue cnc-editor/src/components/LeftNav.vue
git commit -m "feat: 分頁簽列與並排模式 - 多檔載入、active 高亮、左側目前程式標示"
```

---

### Task 5: 更新 SimCanvas 與驗證測試框架

**Files:**
- Modify: `cnc-editor/src/components/SimCanvas.vue`

**Interfaces:**
- Consumes: store getters（`rawText`→改為 `activeFile?.rawText`）、`currentLine`、`lines`、`lineCoords`、`blocks`、`coordinates`
- Produces: 無外部介面

- [ ] **Step 1: 修正 SimCanvas 的 rawText 參照**

`cnc-editor/src/components/SimCanvas.vue` 現有 `store.rawText` 引用（第 39 行 `if (!store.rawText ...)`、第 255 行 `if (store.rawText) updateSimulation()`）需改為 `store.activeFile?.rawText`。`watch(() => store.rawText, ...)` 改為 `watch(() => store.activeFile?.rawText, ...)`。

找到並取代下列區塊：

```js
  if (!store.rawText || !store.lines.length) { allPaths = []; drawPaths(); return }
```
→
```js
  if (!store.activeFile?.rawText || !store.lines.length) { allPaths = []; drawPaths(); return }
```

```js
watch(() => store.rawText, () => setTimeout(updateSimulation, 100))
```
→
```js
watch(() => store.activeFile?.rawText, () => setTimeout(updateSimulation, 100))
```

```js
  if (store.rawText) updateSimulation()
```
→
```js
  if (store.activeFile?.rawText) updateSimulation()
```

- [ ] **Step 2: 執行 dev build 確認無語法錯誤**

Run: `npx vite build`
Expected: 成功，無錯誤。

- [ ] **Step 3: Commit**

```bash
git add cnc-editor/src/components/SimCanvas.vue
git commit -m "fix: SimCanvas 改用 activeFile.rawText 追蹤作用中程式"
```

---

### Task 6: 建置安裝版並用 CDP 端對端驗證

**Files:**
- 驗證產物：`../安裝版/`（由 `scripts/build-install.ps1` 產生）

**Interfaces:**
- Consumes: 上述全部修改
- Produces: 可雙擊執行的安裝版

- [ ] **Step 1: 執行全部單元測試**

Run: `npm test`
Expected: 11 個測試全數 PASS。

- [ ] **Step 2: 建置安裝版**

Run: `npx vite build`；隨後 `& .\scripts\build-install.ps1`
Expected: 產生 `../安裝版/app.js`、`cnc-editor.css`、`index.html` 等。

- [ ] **Step 3: CDP 自動化驗證（雙程式流程）**

在 `C:\Users\TW-10\AppData\Local\Temp\opencode\` 建立 `cdp-dual-test.js`，驗證以下流程（可複用既有 `cdp-bookmark-dot.js` 的骨架，載入 `http://localhost:3000`）：

1. drop A.NC → 分頁簽顯示 1 個「A.NC」、active 分頁高亮、左側「目前程式：A.NC」
2. 再 drop B.NC → 分頁簽 2 個、active 切到 B.NC
3. 在 B 搜尋「M30」→ 上標籤 → B 的行號欄出現小點
4. 切回 A 分頁 → A 沒有標籤小點（bookmarks 獨立）
5. 在 A 搜尋「G54」→ 上標籤 → A 出現小點；切到 B，B 的小點仍在
6. 點「並排」→ 左右兩格各顯示 A、B；點右格 → 左側「目前程式」切到對應檔名
7. 檢查無 `Runtime.exceptionThrown`

Expected: 以上各步驟回傳預期值，無例外。

- [ ] **Step 4: 驗證安裝版 file:// 可執行**

用 Edge headless `--dump-dom "file:///C:/Users/TW-10/Documents/firebase雲端資料夾/CNC程式碼解讀器/安裝版/index.html"`，確認 DOM 含 `CNC 程式編輯平台`、`cnc-editor` 相關 class。

- [ ] **Step 5: Commit**

```bash
git add cnc-editor/src cnc-editor/docs cnc-editor/package.json cnc-editor/vitest.config.js "CNC程式碼解讀器/安裝版"
git commit -m "feat: 雙程式比較與編輯功能完成 - 多檔載入、分頁、並排、active 標示"
git push origin main
```

> ⚠️ 確認 `git add` 不含 `A.NC~D.NC`。

---

## 已知風險與注意事項

- **EditorPanel 的重建時機**：App.vue 用 `:key="fileId"` 掛載，切換 active 檔時單一模式會重建 editor（doc 換掉）。這是預期行為。
- **並排分隔條**：App.vue 以 `mousedown/mousemove/mouseup` 調整 `splitPct`（15%~85%），左右格 flex 寬度跟著變。
- **`nextSearch/prevSearch`**：已改為寫入 `activeFile.currentLine`，避免 getter 賦值錯誤。
- **`updateFileText` 不重 parse**：編輯時僅更新 rawText（與現有行為一致），`parsed` 在 `addFile` 讀檔時計算一次，避免輸入卡頓。
- **安裝版**：每次修改後必須重新執行 `build-install.ps1`，桌面捷徑才會是新的。
- **共用 repo**：commit 只含 CNC 相關檔案，避免誤commit早餐點餐機等其他專案改動。
