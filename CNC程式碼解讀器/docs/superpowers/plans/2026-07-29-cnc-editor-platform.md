# CNC 編輯平台 Implementation Plan

> **For agentic workers:** Use subagent-driven-development to implement task-by-task.

**Goal:** Build a web-based CNC NC code editor with tool/variable/coordinate analysis and 2D path simulation.

**Architecture:** Vue 3 + Vite SPA with Pinia store. CodeMirror 6 for editing/syntax highlighting. Canvas for path simulation. File API for open/save.

**Tech Stack:** Vite, Vue 3 (Composition API), Pinia, CodeMirror 6, Canvas API

## Global Constraints

- No external UI library — pure CSS layout
- All parsing done client-side (no backend)
- Color settings persist in localStorage
- File open/save use browser File API only
- Everything in a single Vite project under `CNC程式碼解讀器/cnc-editor/`

---

### Task 1: Project Scaffolding

**Files:**
- Create: `cnc-editor/package.json`
- Create: `cnc-editor/vite.config.js`
- Create: `cnc-editor/index.html`
- Create: `cnc-editor/src/main.js`
- Create: `cnc-editor/src/App.vue`

- [ ] **Step 1: Create directory structure**

Run: `mkdir -p cnc-editor/src/components cnc-editor/src/stores cnc-editor/src/parsers cnc-editor/src/utils`

- [ ] **Step 2: Create package.json**

```json
{
  "name": "cnc-editor",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "vue": "^3.5",
    "pinia": "^2.2",
    "codemirror": "^6.0",
    "@codemirror/state": "^6.5",
    "@codemirror/view": "^6.35",
    "@codemirror/language": "^6.10",
    "@codemirror/commands": "^6.8",
    "@codemirror/search": "^6.5"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.2",
    "vite": "^6.0"
  }
}
```

- [ ] **Step 3: Create vite.config.js**

```js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: { port: 3000 }
})
```

- [ ] **Step 4: Create index.html**

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CNC 程式編輯平台</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #app { height: 100%; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #1e1e2e; color: #cdd6f4; }
    button { cursor: pointer; padding: 6px 14px; border: none; border-radius: 4px; background: #45475a; color: #cdd6f4; font-size: 13px; }
    button:hover { background: #585b70; }
    input, select { padding: 4px 8px; border: 1px solid #45475a; border-radius: 4px; background: #313244; color: #cdd6f4; font-size: 13px; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 5: Create src/main.js**

```js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
```

- [ ] **Step 6: Create src/App.vue**

```vue
<script setup>
import { useEditorStore } from './stores/editor'
import EditorPanel from './components/EditorPanel.vue'
import LeftNav from './components/LeftNav.vue'
import SimCanvas from './components/SimCanvas.vue'

const store = useEditorStore()
</script>

<template>
  <div class="app-layout">
    <header class="toolbar">
      <h2>CNC 程式編輯平台</h2>
      <div class="toolbar-actions">
        <button @click="store.openFile">開啟檔案</button>
        <button @click="store.saveFile">儲存檔案</button>
        <button @click="store.downloadToolTable" :disabled="!store.tools.length">下載刀號表</button>
      </div>
    </header>
    <div class="main-area">
      <LeftNav />
      <div class="right-area">
        <EditorPanel />
        <SimCanvas />
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-layout { display: flex; flex-direction: column; height: 100vh; }
.toolbar { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; background: #181825; border-bottom: 1px solid #313244; }
.toolbar h2 { font-size: 16px; font-weight: 600; }
.toolbar-actions { display: flex; gap: 8px; }
.main-area { display: flex; flex: 1; overflow: hidden; }
.right-area { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
</style>
```

- [ ] **Step 7: Install and verify**

Run: `cd cnc-editor && npm install`
Run: `cd cnc-editor && npx vite --port 3000 &`
Expected: Dev server starts, visit http://localhost:3000 shows header with buttons

---

### Task 2: NC File Parser

**Files:**
- Create: `cnc-editor/src/parsers/ncParser.js`
- Test (manual): Use sample NC files to verify

- [ ] **Step 1: Create ncParser.js**

```js
export function parseNC(text) {
  const lines = text.split('\n')
  const tools = []
  const variables = []
  const coordinates = []
  let blocks = []
  let currentBlock = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNum = i + 1
    const trimmed = line.trim()

    // Detect N-block start (e.g., N1, N101, N201)
    const nMatch = trimmed.match(/^(N(\d+))\(/)
    if (nMatch) {
      if (currentBlock) blocks.push(currentBlock)
      const nNumber = nMatch[2]
      const parenContent = trimmed.match(/\(([^)]+)\)/g) || []
      const toolName = parenContent[0] ? parenContent[0].slice(1, -1) : ''
      const holderName = parenContent[1] ? parenContent[1].slice(1, -1) : ''
      currentBlock = {
        n: nNumber,
        nFull: nMatch[1],
        toolName,
        holderName,
        toolNo: null,
        hNo: null,
        dNo: null,
        startLine: lineNum,
        endLine: lineNum,
        variables: [],
        gCodes: [],
        mCodes: []
      }
    }

    // Detect T#M6 (tool change)
    const tMatch = trimmed.match(/T(\d+)M6/)
    if (tMatch && currentBlock) {
      currentBlock.toolNo = tMatch[1]
      currentBlock.hNo = tMatch[1]
      currentBlock.dNo = tMatch[1]
    }

    // Detect H# or D#
    const hMatch = trimmed.match(/H(\d+)/)
    if (hMatch && currentBlock) currentBlock.hNo = hMatch[1]
    const dMatch = trimmed.match(/D(\d+)/)
    if (dMatch && currentBlock) currentBlock.dNo = dMatch[1]

    // Detect variables #xxx=value
    const vMatch = trimmed.matchAll(/#(\d+)=([-\d.]+)/g)
    for (const m of vMatch) {
      const v = { id: m[1], value: m[2], line: lineNum, block: currentBlock ? currentBlock.nFull : null }
      variables.push(v)
      if (currentBlock) currentBlock.variables.push(v)
    }

    // Detect G-codes
    const gMatch = trimmed.matchAll(/G(\d+)/g)
    for (const m of gMatch) {
      if (currentBlock) currentBlock.gCodes.push(parseInt(m[1]))
    }

    // Detect M-codes
    const mMatch = trimmed.matchAll(/M(\d+)/g)
    for (const m of mMatch) {
      if (currentBlock) currentBlock.mCodes.push(parseInt(m[1]))
    }

    // Detect work coordinates G54-G59
    const wMatch = trimmed.match(/G(5[4-9])\b/)
    if (wMatch) {
      const existing = coordinates.find(c => c.code === wMatch[1])
      if (!existing) coordinates.push({ code: wMatch[1], line: lineNum })
    }

    // Detect G#100 (dynamic coordinate)
    if (/G#100\b/.test(trimmed)) {
      const existing = coordinates.find(c => c.code === '#100')
      if (!existing) {
        // compute range from #500, #501 variables
        const var500 = variables.find(v => v.id === '500')
        const var501 = variables.find(v => v.id === '501')
        const start = var500 ? 54 : '#100'
        const end = var501 ? 53 + parseInt(var500?.value || 0) : '#100'
        coordinates.push({ code: `G${start}~G${end}`, dynamic: true, line: lineNum })
      }
    }

    if (currentBlock) currentBlock.endLine = lineNum
  }
  if (currentBlock) blocks.push(currentBlock)

  // Build tools array from blocks
  for (const b of blocks) {
    if (b.toolNo) {
      // Determine machining type from tool name
      let type = '其他'
      const upper = (b.toolName || '').toUpperCase()
      if (/^FM|^FEM/.test(upper)) type = '面銑'
      else if (/^EM/.test(upper)) type = '輪廓銑'
      else if (/^CDR/.test(upper)) type = '定點鑽'
      else if (/^DR/.test(upper)) type = '鑽孔'
      else if (/^TAP/.test(upper)) type = '攻牙'
      else if (/^SEM/.test(upper)) type = '端銑'
      else if (/^FOM/.test(upper)) type = '成型銑'
      else if (/^SDR/.test(upper)) type = '階梯鑽'
      else if (/^AM/.test(upper)) type = '角度銑'
      else if (/^TM/.test(upper)) type = '螺紋銑'

      tools.push({
        n: b.nFull,
        toolNo: b.toolNo,
        toolName: b.toolName,
        holderName: b.holderName,
        type,
        hNo: b.hNo,
        dNo: b.dNo,
        variables: b.variables,
        block: b
      })
    }
  }

  return { blocks, tools, variables, coordinates, rawText: text, lines }
}
```

- [ ] **Step 2: Manual verification**

Create a small test snippet and run `node -e` to test parsing.

---

### Task 3: Pinia Editor Store

**Files:**
- Create: `cnc-editor/src/stores/editor.js`

- [ ] **Step 1: Create editor store**

```js
import { defineStore } from 'pinia'
import { parseNC } from '../parsers/ncParser'

export const useEditorStore = defineStore('editor', {
  state: () => ({
    rawText: '',
    parsed: null,
    currentFileName: '',
    selectedNav: 'tools', // tools | variables | coordinates
    searchKeyword: '',
    searchResults: [],
    searchIndex: -1,
    showTypeColumn: true,
    syntaxColors: {
      gCode: '#89b4fa',
      mCode: '#f38ba8',
      nBlock: '#cba6f7',
      variable: '#fab387',
      comment: '#6c7086',
      default: '#cdd6f4'
    }
  }),

  getters: {
    tools: (state) => state.parsed?.tools || [],
    variables: (state) => state.parsed?.variables || [],
    coordinates: (state) => state.parsed?.coordinates || [],
    lines: (state) => state.parsed?.lines || [],
    blocks: (state) => state.parsed?.blocks || []
  },

  actions: {
    async openFile() {
      return new Promise((resolve) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.nc,.txt'
        input.onchange = (e) => {
          const file = e.target.files[0]
          if (!file) return
          this.currentFileName = file.name
          const reader = new FileReader()
          reader.onload = () => {
            this.rawText = reader.result
            this.parsed = parseNC(this.rawText)
            this.searchKeyword = ''
            this.searchResults = []
            this.searchIndex = -1
            resolve()
          }
          reader.readAsText(file, 'utf-8')
        }
        input.click()
      })
    },

    saveFile() {
      if (!this.rawText) return
      const blob = new Blob([this.rawText], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = this.currentFileName || 'program.nc'
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
    },

    prevSearch() {
      if (this.searchResults.length === 0) return
      this.searchIndex = this.searchIndex <= 0 ? this.searchResults.length - 1 : this.searchIndex - 1
    },

    setNav(section) {
      this.selectedNav = section
    },

    updateSyntaxColor(category, color) {
      this.syntaxColors[category] = color
      localStorage.setItem('cnc-syntax-colors', JSON.stringify(this.syntaxColors))
    },

    loadSyntaxColors() {
      try {
        const saved = localStorage.getItem('cnc-syntax-colors')
        if (saved) this.syntaxColors = { ...this.syntaxColors, ...JSON.parse(saved) }
      } catch {}
    }
  }
})
```

---

### Task 4: Editor Panel (CodeMirror Integration)

**Files:**
- Create: `cnc-editor/src/components/EditorPanel.vue`

- [ ] **Step 1: Create EditorPanel.vue**

```vue
<script setup>
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { useEditorStore } from '../stores/editor'
import { buildCncLanguage } from '../parsers/cncLanguage'
import SearchBar from './SearchBar.vue'
import ColorSettings from './ColorSettings.vue'

const store = useEditorStore()
const editorRef = ref(null)
const editorContainer = ref(null)
let view = null
const showColorSettings = ref(false)

function buildExtensions() {
  return [
    basicSetup,
    keymap.of([...searchKeymap, indentWithTab]),
    highlightSelectionMatches(),
    buildCncLanguage(store.syntaxColors),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        store.rawText = update.state.doc.toString()
        store.parsed = null // will re-parse
      }
    })
  ]
}

function initEditor() {
  if (!editorContainer.value) return
  const state = EditorState.create({
    doc: store.rawText,
    extensions: buildExtensions()
  })
  view = new EditorView({
    state,
    parent: editorContainer.value
  })
}

onMounted(() => {
  store.loadSyntaxColors()
  initEditor()
})

onBeforeUnmount(() => {
  view?.destroy()
})

watch(() => store.rawText, (newVal) => {
  if (view && newVal !== view.state.doc.toString()) {
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: newVal }
    })
  }
})

watch(() => store.syntaxColors, () => {
  if (view) {
    const pos = view.state.selection.main.head
    view.destroy()
    const state = EditorState.create({
      doc: store.rawText,
      extensions: buildExtensions()
    })
    view = new EditorView({ state, parent: editorContainer.value })
    view.dispatch({ selection: { anchor: pos } })
  }
}, { deep: true })

function onSearchResult(results, index) {
  if (!view || index < 0 || !results.length) return
  const line = results[index].line
  const pos = view.state.doc.line(line + 1)
  view.dispatch({
    selection: { anchor: pos.from },
    scrollIntoView: true,
    effects: EditorView.scrollIntoView(pos.from, { y: 'center' })
  })
}

defineExpose({ onSearchResult })
</script>

<template>
  <div class="editor-panel">
    <div class="editor-header">
      <span class="file-name">{{ store.currentFileName || '未開啟檔案' }}</span>
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
.file-name { font-size: 13px; color: #a6adc8; }
.editor-actions { display: flex; align-items: center; gap: 6px; }
.editor-body { flex: 1; overflow: auto; }
.editor-body :deep(.cm-editor) { height: 100%; }
.editor-body :deep(.cm-scroller) { overflow: auto; }
</style>
```

- [ ] **Step 2: Create CNC language parser for CodeMirror**

Create: `cnc-editor/src/parsers/cncLanguage.js`

```js
import { StreamLanguage } from '@codemirror/language'

export function buildCncLanguage(colors) {
  return StreamLanguage.define({
    startState: () => ({}),
    token(stream) {
      // Skip whitespace
      if (stream.eatSpace()) return null

      // Comments ( ... )
      if (stream.match(/\([^)]*\)/)) return 'comment'

      // Variables #100, #500, etc.
      if (stream.match(/#\d+/)) return 'variable'

      // N-blocks N1, N101, etc.
      if (stream.match(/N\d+/)) return 'nBlock'

      // G-codes
      if (stream.match(/G\d+/)) return 'gCode'

      // M-codes
      if (stream.match(/M\d+/)) return 'mCode'

      // T-code, H-code, D-code
      if (stream.match(/[THD]\d+/)) return 'toolCode'

      // Advance one character
      stream.next()
      return null
    }
  })
}
```

- [ ] **Step 3: Update index.html to add CodeMirror theme styles**

Append to the `<style>` in index.html:

```css
.cm-editor { height: 100%; font-size: 14px; }
.cm-editor.cm-focused { outline: none; }
.cm-editor .cm-gutters { background: #181825; border-right: 1px solid #313244; color: #585b70; }
.cm-editor .cm-activeLineGutter { background: #313244; }
.cm-editor .cm-activeLine { background: #31324455; }
.cm-editor .cm-cursor { border-left-color: #cdd6f4; }
.cm-editor .cm-selectionBackground { background: #45475a88 !important; }
.ͼ1 .cm-scroller { font-family: 'Cascadia Code', 'JetBrains Mono', 'Consolas', monospace; }
```

---

### Task 5: SearchBar Component

**Files:**
- Create: `cnc-editor/src/components/SearchBar.vue`

- [ ] **Step 1: Create SearchBar.vue**

```vue
<script setup>
import { ref, computed } from 'vue'
import { useEditorStore } from '../stores/editor'

const store = useEditorStore()
const keyword = ref('')
const emit = defineEmits(['search'])

function doSearch() {
  store.search(keyword.value)
  if (store.searchResults.length > 0) {
    emit('search', store.searchResults, store.searchIndex)
  }
}

function nextResult() {
  store.nextSearch()
  if (store.searchResults.length > 0) {
    emit('search', store.searchResults, store.searchIndex)
  }
}

function prevResult() {
  store.prevSearch()
  if (store.searchResults.length > 0) {
    emit('search', store.searchResults, store.searchIndex)
  }
}

const resultLabel = computed(() => {
  if (!store.searchResults.length) return ''
  return `${store.searchIndex + 1}/${store.searchResults.length}`
})
</script>

<template>
  <div class="search-bar">
    <input
      v-model="keyword"
      placeholder="搜尋..."
      @keyup.enter="doSearch"
      @keyup.escape="keyword=''; doSearch()"
    />
    <button @click="doSearch" :disabled="!keyword">搜尋</button>
    <span v-if="resultLabel" class="result-count">{{ resultLabel }}</span>
    <button @click="prevResult" :disabled="!store.searchResults.length">▲</button>
    <button @click="nextResult" :disabled="!store.searchResults.length">▼</button>
  </div>
</template>

<style scoped>
.search-bar { display: flex; align-items: center; gap: 4px; }
.search-bar input { width: 160px; }
.result-count { font-size: 12px; color: #a6adc8; min-width: 36px; text-align: center; }
</style>
```

---

### Task 6: ColorSettings Component

**Files:**
- Create: `cnc-editor/src/components/ColorSettings.vue`

- [ ] **Step 1: Create ColorSettings.vue**

```vue
<script setup>
import { useEditorStore } from '../stores/editor'
const store = useEditorStore()
const emit = defineEmits(['close'])

const items = [
  { key: 'gCode', label: 'G-Code' },
  { key: 'mCode', label: 'M-Code' },
  { key: 'nBlock', label: 'N 區段' },
  { key: 'variable', label: '變數' },
  { key: 'comment', label: '註解' },
  { key: 'default', label: '預設文字' }
]

function onChange() {
  localStorage.setItem('cnc-syntax-colors', JSON.stringify(store.syntaxColors))
}
</script>

<template>
  <div class="color-settings-overlay" @click.self="emit('close')">
    <div class="color-settings">
      <h3>語法顏色設定</h3>
      <div class="color-list">
        <div v-for="item in items" :key="item.key" class="color-row">
          <label>{{ item.label }}</label>
          <input type="color" v-model="store.syntaxColors[item.key]" @change="onChange" />
        </div>
      </div>
      <button @click="emit('close')">關閉</button>
    </div>
  </div>
</template>

<style scoped>
.color-settings-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.color-settings {
  background: #1e1e2e; border: 1px solid #313244; border-radius: 8px;
  padding: 24px; min-width: 300px;
}
.color-settings h3 { margin-bottom: 16px; }
.color-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
.color-row { display: flex; align-items: center; justify-content: space-between; }
.color-row input { width: 48px; height: 32px; border: none; background: transparent; cursor: pointer; }
</style>
```

---

### Task 7: LeftNav + ToolTable

**Files:**
- Create: `cnc-editor/src/components/LeftNav.vue`
- Create: `cnc-editor/src/components/ToolTable.vue`
- Create: `cnc-editor/src/components/VariableTable.vue`
- Create: `cnc-editor/src/components/CoordViewer.vue`

- [ ] **Step 1: Create LeftNav.vue**

```vue
<script setup>
import { useEditorStore } from '../stores/editor'
import ToolTable from './ToolTable.vue'
import VariableTable from './VariableTable.vue'
import CoordViewer from './CoordViewer.vue'

const store = useEditorStore()
const sections = [
  { key: 'tools', label: '刀號' },
  { key: 'variables', label: '變數' },
  { key: 'coordinates', label: '座標系' }
]
</script>

<template>
  <div class="left-nav">
    <div class="nav-items">
      <div
        v-for="s in sections"
        :key="s.key"
        class="nav-item"
        :class="{ active: store.selectedNav === s.key }"
        @click="store.setNav(s.key)"
      >{{ s.label }}</div>
    </div>
    <div class="nav-content">
      <ToolTable v-if="store.selectedNav === 'tools'" />
      <VariableTable v-if="store.selectedNav === 'variables'" />
      <CoordViewer v-if="store.selectedNav === 'coordinates'" />
    </div>
  </div>
</template>

<style scoped>
.left-nav {
  width: 320px; min-width: 280px; display: flex; flex-direction: column;
  border-right: 1px solid #313244; background: #181825;
}
.nav-items { display: flex; border-bottom: 1px solid #313244; }
.nav-item {
  flex: 1; padding: 10px 0; text-align: center; cursor: pointer;
  font-size: 13px; color: #6c7086; border-bottom: 2px solid transparent; transition: all 0.15s;
}
.nav-item.active { color: #89b4fa; border-bottom-color: #89b4fa; }
.nav-item:hover { color: #cdd6f4; }
.nav-content { flex: 1; overflow-y: auto; padding: 8px; }
</style>
```

- [ ] **Step 2: Create ToolTable.vue**

```vue
<script setup>
import { useEditorStore } from '../stores/editor'
const store = useEditorStore()
</script>

<template>
  <div class="tool-table">
    <div class="tool-header">
      <span>刀號表</span>
      <label class="type-toggle">
        <input type="checkbox" v-model="store.showTypeColumn" />
        顯示加工類型
      </label>
    </div>
    <table v-if="store.tools.length">
      <thead>
        <tr>
          <th>N 號</th>
          <th>刀具名稱</th>
          <th>刀桿名稱</th>
          <th v-if="store.showTypeColumn">加工類型</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="t in store.tools" :key="t.n">
          <td>{{ t.n }}</td>
          <td>{{ t.toolName }}</td>
          <td>{{ t.holderName }}</td>
          <td v-if="store.showTypeColumn">{{ t.type }}</td>
        </tr>
      </tbody>
    </table>
    <div v-else class="empty">請先開啟 NC 檔案</div>
  </div>
</template>

<style scoped>
.tool-table { font-size: 12px; }
.tool-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 13px; font-weight: 600; }
.type-toggle { font-weight: 400; font-size: 12px; display: flex; align-items: center; gap: 4px; cursor: pointer; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 4px 6px; text-align: left; border-bottom: 1px solid #313244; white-space: nowrap; }
th { color: #a6adc8; font-size: 11px; position: sticky; top: 0; background: #181825; }
tr:hover td { background: #31324455; }
.empty { color: #6c7086; padding: 20px; text-align: center; font-size: 13px; }
</style>
```

- [ ] **Step 3: Create VariableTable.vue**

```vue
<script setup>
import { useEditorStore } from '../stores/editor'
const store = useEditorStore()
</script>

<template>
  <div class="var-table">
    <div class="var-header">變數對應表</div>
    <table v-if="store.variables.length">
      <thead>
        <tr>
          <th>N 區段</th>
          <th>變數</th>
          <th>值</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(v, i) in store.variables" :key="i">
          <td>{{ v.block || '-' }}</td>
          <td>#{{ v.id }}</td>
          <td>{{ v.value }}</td>
        </tr>
      </tbody>
    </table>
    <div v-else class="empty">無變數資料</div>
  </div>
</template>

<style scoped>
.var-table { font-size: 12px; }
.var-header { font-size: 13px; font-weight: 600; margin-bottom: 8px; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 4px 6px; text-align: left; border-bottom: 1px solid #313244; }
th { color: #a6adc8; font-size: 11px; position: sticky; top: 0; background: #181825; }
tr:hover td { background: #31324455; }
.empty { color: #6c7086; padding: 20px; text-align: center; font-size: 13px; }
</style>
```

- [ ] **Step 4: Create CoordViewer.vue**

```vue
<script setup>
import { ref, computed, onMounted } from 'vue'
import { useEditorStore } from '../stores/editor'
const store = useEditorStore()
const canvasRef = ref(null)

function drawCoordDiagram() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)

  // Draw grid
  ctx.strokeStyle = '#313244'
  ctx.lineWidth = 1
  for (let x = 0; x <= w; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
  }
  for (let y = 0; y <= h; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
  }

  // Draw origin
  ctx.fillStyle = '#6c7086'
  ctx.font = '11px sans-serif'
  ctx.fillText('(0,0)', 4, h - 6)

  // Draw each coordinate system
  const coords = store.coordinates
  const colors = ['#89b4fa', '#a6e3a1', '#f9e2af', '#f38ba8', '#cba6f7', '#94e2d5']
  coords.forEach((c, i) => {
    const x = 40 + (i * 50) % (w - 80)
    const y = 40 + Math.floor((i * 50) / (w - 80)) * 50
    ctx.fillStyle = colors[i % colors.length]
    ctx.fillRect(x - 2, y - 2, 4, 4)
    ctx.font = '11px sans-serif'
    ctx.fillText(c.code, x + 6, y + 4)
  })
}

onMounted(drawCoordDiagram)
</script>

<template>
  <div class="coord-viewer">
    <div class="coord-header">座標系</div>
    <table v-if="store.coordinates.length">
      <thead>
        <tr><th>座標系</th><th>行號</th></tr>
      </thead>
      <tbody>
        <tr v-for="c in store.coordinates" :key="c.code">
          <td>{{ c.code }}</td>
          <td>{{ c.line }}</td>
        </tr>
      </tbody>
    </table>
    <div v-else class="empty">無座標系資料</div>
    <canvas ref="canvasRef" width="260" height="180" class="coord-canvas"></canvas>
  </div>
</template>

<style scoped>
.coord-viewer { font-size: 12px; }
.coord-header { font-size: 13px; font-weight: 600; margin-bottom: 8px; }
table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
th, td { padding: 4px 6px; text-align: left; border-bottom: 1px solid #313244; }
th { color: #a6c8; font-size: 11px; }
tr:hover td { background: #31324455; }
.coord-canvas { width: 100%; height: auto; border: 1px solid #313244; border-radius: 4px; }
.empty { color: #6c7086; padding: 20px; text-align: center; font-size: 13px; }
</style>
```

---

### Task 8: 2D Path Simulator (Canvas)

**Files:**
- Create: `cnc-editor/src/utils/simulator.js`
- Create: `cnc-editor/src/components/SimCanvas.vue`

- [ ] **Step 1: Create simulator.js**

```js
export function simulatePath(lines, blocks) {
  const paths = []
  let currentX = 0, currentY = 0, currentZ = 0
  let isCutting = false
  let compSide = null // 41=left, 42=right

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toUpperCase().trim()
    if (!line || line.startsWith('(') || line.startsWith(';')) continue

    // Parse X, Y, Z, I, J, F values
    const xMatch = line.match(/X(-?[\d.]+)/)
    const yMatch = line.match(/Y(-?[\d.]+)/)
    const zMatch = line.match(/Z(-?[\d.]+)/)
    const gMatch = line.match(/G0?\d+/)
    const gCode = gMatch ? parseInt(gMatch[0].replace('G', '')) : null

    // Cutter compensation
    if (line.includes('G41')) compSide = 41
    if (line.includes('G42')) compSide = 42
    if (line.includes('G40')) compSide = null

    const newX = xMatch ? parseFloat(xMatch[1]) : currentX
    const newY = yMatch ? parseFloat(yMatch[1]) : currentY
    const newZ = zMatch ? parseFloat(zMatch[1]) : currentZ

    // G0 = rapid (not cutting), G1 = cutting
    if (gCode === 0) {
      isCutting = false
      // Still draw as dashed
      if (xMatch || yMatch) {
        paths.push({ x1: currentX, y1: currentY, x2: newX, y2: newY, cutting: false })
      }
    } else if (gCode === 1 || gCode === null) {
      // G1 or motion without explicit G-code (modal)
      isCutting = true
      if (xMatch || yMatch) {
        paths.push({ x1: currentX, y1: currentY, x2: newX, y2: newY, cutting: true, comp: compSide })
      }
    }

    // Canned cycles (G81, G83, G84, etc.) - use XY as points
    if ([81, 82, 83, 84, 85, 86, 87].includes(gCode)) {
      paths.push({ x1: newX, y1: newY, x2: newX, y2: newY, cutting: false, cycle: true })
    }

    currentX = newX
    currentY = newY
    currentZ = gCode !== 0 ? newZ : currentZ // Z updates only on non-rapid
  }

  return paths
}
```

- [ ] **Step 2: Create SimCanvas.vue**

```vue
<script setup>
import { ref, watch, onMounted, computed } from 'vue'
import { useEditorStore } from '../stores/editor'
import { simulatePath } from '../utils/simulator'

const store = useEditorStore()
const canvasRef = ref(null)
const paths = ref([])
let scale = 1
let offsetX = 0, offsetY = 0
let isDragging = false, dragStartX = 0, dragStartY = 0

const hasData = computed(() => store.rawText && store.lines.length > 0)

function updateSimulation() {
  if (!hasData.value) return
  paths.value = simulatePath(store.lines, store.blocks)
  drawPaths()
}

function computeBounds() {
  if (!paths.value.length) return { minX: -100, maxX: 100, minY: -100, maxY: 100 }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const p of paths.value) {
    minX = Math.min(minX, p.x1, p.x2)
    maxX = Math.max(maxX, p.x1, p.x2)
    minY = Math.min(minY, p.y1, p.y2)
    maxY = Math.max(maxY, p.y1, p.y2)
  }
  const pad = Math.max((maxX - minX) * 0.1, (maxY - minY) * 0.1, 10)
  return { minX: minX - pad, maxX: maxX + pad, minY: minY - pad, maxY: maxY + pad }
}

function drawPaths() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)

  if (!paths.value.length) {
    ctx.fillStyle = '#6c7086'
    ctx.font = '14px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('請開啟 NC 檔案以顯示路徑', w / 2, h / 2)
    return
  }

  const bounds = computeBounds()
  const rangeX = bounds.maxX - bounds.minX
  const rangeY = bounds.maxY - bounds.minY
  scale = Math.min(w / rangeX, h / rangeY) * 0.85

  // Center offset
  offsetX = (w - (bounds.maxX + bounds.minX) * scale) / 2
  offsetY = (h + (bounds.maxY + bounds.minY) * scale) / 2

  function toScreen(x, y) {
    return [x * scale + offsetX, -y * scale + offsetY]
  }

  // Grid
  ctx.strokeStyle = '#313244'
  ctx.lineWidth = 0.5
  const gridStep = 50
  const gStartX = Math.floor(bounds.minX / gridStep) * gridStep
  const gStartY = Math.floor(bounds.minY / gridStep) * gridStep
  for (let gx = gStartX; gx <= bounds.maxX; gx += gridStep) {
    const [sx] = toScreen(gx, 0)
    ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, h); ctx.stroke()
  }
  for (let gy = gStartY; gy <= bounds.maxY; gy += gridStep) {
    const [, sy] = toScreen(0, gy)
    ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(w, sy); ctx.stroke()
  }

  // Draw paths
  for (const p of paths.value) {
    const [x1, y1] = toScreen(p.x1, p.y1)
    const [x2, y2] = toScreen(p.x2, p.y2)

    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)

    if (p.cycle) {
      // Cycle points as small circles
      ctx.fillStyle = '#f9e2af'
      ctx.arc(x2, y2, 3, 0, Math.PI * 2)
      ctx.fill()
      continue
    }

    if (p.cutting) {
      ctx.strokeStyle = p.comp ? '#a6e3a1' : '#89b4fa'
      ctx.lineWidth = 2
      ctx.setLineDash([])
    } else {
      ctx.strokeStyle = '#585b70'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
    }
    ctx.stroke()
  }

  // Draw origin marker
  const [ox, oy] = toScreen(0, 0)
  ctx.fillStyle = '#f38ba8'
  ctx.beginPath()
  ctx.arc(ox, oy, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#f38ba8'
  ctx.font = '11px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('(0,0)', ox + 6, oy + 4)
}

// Handle mouse events for pan/zoom
function onMouseDown(e) {
  isDragging = true
  dragStartX = e.offsetX - offsetX
  dragStartY = e.offsetY - offsetY
}

function onMouseMove(e) {
  if (!isDragging) return
  offsetX = e.offsetX - dragStartX
  offsetY = e.offsetY - dragStartY
  drawPaths()
}

function onMouseUp() { isDragging = false }

function onWheel(e) {
  e.preventDefault()
  const delta = e.deltaY > 0 ? 0.9 : 1.1
  scale *= delta
  drawPaths()
}

watch(() => store.rawText, () => {
  setTimeout(updateSimulation, 100)
})

onMounted(() => {
  const canvas = canvasRef.value
  if (canvas) {
    canvas.width = canvas.clientWidth
    canvas.height = canvas.clientHeight
  }
  if (hasData.value) updateSimulation()
})

function onResize() {
  const canvas = canvasRef.value
  if (canvas) {
    canvas.width = canvas.clientWidth
    canvas.height = canvas.clientHeight
    drawPaths()
  }
}

import { onBeforeUnmount } from 'vue'
onMounted(() => {
  window.addEventListener('resize', onResize)
  onResize()
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <div class="sim-panel">
    <div class="sim-header">2D 路徑模擬</div>
    <canvas
      ref="canvasRef"
      class="sim-canvas"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="onMouseUp"
      @wheel.prevent="onWheel"
    ></canvas>
    <div class="sim-hint">拖曳平移 | 滾輪縮放</div>
  </div>
</template>

<style scoped>
.sim-panel {
  height: 240px; min-height: 180px; border-top: 1px solid #313244;
  display: flex; flex-direction: column; background: #11111b;
}
.sim-header {
  padding: 4px 12px; font-size: 12px; font-weight: 600;
  background: #181825; border-bottom: 1px solid #313244;
}
.sim-canvas { flex: 1; cursor: grab; width: 100%; }
.sim-canvas:active { cursor: grabbing; }
.sim-hint { font-size: 11px; color: #6c7086; padding: 2px 12px; text-align: right; }
</style>
```

---

### Task 9: Wire Everything Together & Test

**Files:**
- Modify: `cnc-editor/src/App.vue`

- [ ] **Step 1: Update App.vue to pass search results to editor**

Replace the template section in App.vue:

```vue
<script setup>
import { ref } from 'vue'
import { useEditorStore } from './stores/editor'
import EditorPanel from './components/EditorPanel.vue'
import LeftNav from './components/LeftNav.vue'
import SimCanvas from './components/SimCanvas.vue'

const store = useEditorStore()
const editorRef = ref(null)

function handleSearch(results, index) {
  editorRef.value?.onSearchResult(results, index)
}
</script>

<template>
  <div class="app-layout">
    <header class="toolbar">
      <h2>CNC 程式編輯平台</h2>
      <div class="toolbar-actions">
        <button @click="store.openFile">開啟檔案</button>
        <button @click="store.saveFile">儲存檔案</button>
        <button @click="store.downloadToolTable" :disabled="!store.tools.length">下載刀號表</button>
      </div>
    </header>
    <div class="main-area">
      <LeftNav />
      <div class="right-area">
        <EditorPanel ref="editorRef" />
        <SimCanvas />
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Run dev server and test**

Run: `cd cnc-editor && npx vite --port 3000 --host`
Expected: App loads, click "開啟檔案" selects A.NC, editor shows content with syntax highlighting, left nav shows tool table, canvas shows path simulation.

- [ ] **Step 3: Test search & label navigation**

Type "N1" in search bar, press Enter. Verify results count shows, up/down buttons cycle through matches.

- [ ] **Step 4: Test color settings**

Click "顏色設定", change a color, verify editor updates.

- [ ] **Step 5: Test file save**

Edit some text, click "儲存檔案", verify download works.

- [ ] **Step 6: Test download tool table**

Click "下載刀號表", verify .txt file has correct content.
