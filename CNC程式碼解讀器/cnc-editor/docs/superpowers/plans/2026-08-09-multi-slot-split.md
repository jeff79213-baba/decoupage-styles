# 三格並排比較與編輯功能實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把並排模式改為可選 2/3 格的獨立格子系統，支援點選切換 active、拖曳換位、下拉替換、空格補位，並修復「位置跳動」既有 bug。

**Architecture:** 三格內容以 store 的 `splitSlotIds`（fileId 或 null）為唯一權威，與 `activeFileId` 完全分離。App.vue 依 `splitCount` 渲染格子列（含空格 div 與下拉選單），EditorPanel 增加 `splitMode`/`slotIndex` prop 提供 header 拖曳與關閉。單格模式維持分頁簽列現況。

**Tech Stack:** Vue 3 (script setup)、Pinia、Vitest、CodeMirror 6。

## Global Constraints

- 專案路徑含中文，PowerShell 下所有路徑必須用雙引號；優先使用絕對路徑。
- 測試指令：`npm.cmd test`（= `vitest run`），在 `CNC程式碼解讀器\cnc-editor` 下執行。
- 建置指令：`npx.cmd vite build`；安裝版：`& .\scripts\build-install.ps1`。
- commit 只在 repo root `C:\Users\TW-10\Documents\firebase雲端資料夾` 執行；**禁止 commit `A.NC`~`D.NC`**（實際加工資料）與其他專案變更。
- 共用 repo `decoupage-styles`；commit 只 stage CNC 相關檔案路徑（`CNC程式碼解讀器/cnc-editor/...`）。
- 既有 12 個 store 測試必須維持通過，不得刪改。
- 不使用任何新套件（HTML5 drag & drop、原生 select 樣式、Pinia 皆已具備）。

---

### Task 1: store 並排格子狀態（splitCount / splitSlotIds / actions）

**Files:**
- Modify: `CNC程式碼解讀器\cnc-editor\src\stores\editor.js`
- Test: `CNC程式碼解讀器\cnc-editor\src\stores\editor.test.js`

**Interfaces:**
- Consumes: 既有 `defineStore('editor', ...)` 結構、`parseNC`。
- Produces（供 Task 2/3 使用）:
  - state: `splitCount` (Number, 0/2/3)、`splitSlotIds` (Array of fileId|null)
  - getter: `splitSlots()` → `[{ id, file }, ...]`，長度 = splitCount
  - actions: `setSplit(count)`、`exitSplit()`、`setSlot(index, fileId)`、`closeSlot(index)`、`moveSlot(from, to)`
  - `addFile` 讀檔完成後填入第一個空格；`removeFile` 使含該 id 的格子變 null

- [ ] **Step 1: 先寫失敗的測試**

在 `editor.test.js` 檔尾（`describe('editor store 多檔狀態')` 之後）新增：

```js
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
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npm.cmd test`
Expected: FAIL — 大量 `store.setSplit is not a function` 與 `store.splitCount` 為 undefined。

- [ ] **Step 3: 在 store 加入 split 狀態與 actions**

在 `CNC程式碼解讀器\cnc-editor\src\stores\editor.js`：

a. `state()` 內（`nextFileId: 1,` 之後）加入：

```js
    splitCount: 0,
    splitSlotIds: [],
```

b. getters 內（`effectiveSyntaxColors() {...}` 之後、`}` 閉合前）加入：

```js
    splitSlots() {
      const out = []
      for (let i = 0; i < this.splitCount; i++) {
        const id = this.splitSlotIds[i] ?? null
        out.push({ id, file: id != null ? this.fileById(id) : null })
      }
      return out
    },
```

c. actions 內新增：

```js
    setSplit(count) {
      if (![2, 3].includes(count)) return
      const arr = this.splitSlotIds.slice(0, count)
      while (arr.length < count) {
        const next = this.files.find(f => !arr.includes(f.id))
        arr.push(next ? next.id : null)
      }
      this.splitSlotIds = arr
      this.splitCount = count
    },

    exitSplit() {
      this.splitCount = 0
      this.splitSlotIds = []
    },

    setSlot(index, fileId) {
      if (index < 0 || index >= this.splitSlotIds.length) return
      if (!this.files.some(f => f.id === fileId)) return
      const arr = this.splitSlotIds.slice()
      const dupIdx = arr.indexOf(fileId)
      if (dupIdx >= 0) arr[dupIdx] = arr[index]
      arr[index] = fileId
      this.splitSlotIds = arr
    },

    closeSlot(index) {
      if (index < 0 || index >= this.splitSlotIds.length) return
      const arr = this.splitSlotIds.slice()
      arr[index] = null
      this.splitSlotIds = arr
    },

    moveSlot(from, to) {
      if (from === to || from < 0 || to < 0) return
      const arr = this.splitSlotIds.slice()
      if (from >= arr.length || to >= arr.length) return
      const [item] = arr.splice(from, 1)
      arr.splice(to, 0, item)
      this.splitSlotIds = arr
    },
```

d. `addFile` 的 `reader.onload` 內（`target.parsed = parseNC(reader.result)` 之後）加入補空格：

```js
        const emptyIdx = this.splitSlotIds.indexOf(null)
        if (emptyIdx >= 0) {
          const arr = this.splitSlotIds.slice()
          arr[emptyIdx] = id
          this.splitSlotIds = arr
        }
```

e. `removeFile` 結尾（`}` 閉合前、整個 action 結束前）加入清空格子：

```js
      const slotIdx = this.splitSlotIds.indexOf(id)
      if (slotIdx >= 0) {
        const arr = this.splitSlotIds.slice()
        arr[slotIdx] = null
        this.splitSlotIds = arr
      }
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npm.cmd test`
Expected: PASS — 既有 12 + 新增 14 = 26 個測試全數通過。

- [ ] **Step 5: 執行 dev build 確認無語法錯誤**

Run: `npx.cmd vite build`
Expected: 成功，無錯誤。

- [ ] **Step 6: Commit**

```bash
git add "CNC程式碼解讀器/cnc-editor/src/stores/editor.js" "CNC程式碼解讀器/cnc-editor/src/stores/editor.test.js"
git commit -m "feat: store 並排格子狀態 - splitCount/splitSlotIds、setSplit/exitSplit/setSlot/closeSlot/moveSlot、addFile 補空格"
```

---

### Task 2: EditorPanel 支援並排 header（splitMode/slotIndex prop、拖曳、關閉、下拉事件）

**Files:**
- Modify: `CNC程式碼解讀器\cnc-editor\src\components\EditorPanel.vue`

**Interfaces:**
- Consumes: store（`activeFileId`、`fileById`、`setActiveFile`、`updateFileText`、`setCurrentLine`）、Task 1 的 `slotIndex`/`splitMode` 語意。
- Produces（供 Task 3 的 App.vue）:
  - props: `fileId: Number|null`、`splitMode: Boolean=false`、`slotIndex: Number=-1`
  - emits: `close-slot`（參數 slotIndex）、`toggle-dropdown`（參數 slotIndex）
  - header 檔名區 `draggable`，`dragstart` 時 `dataTransfer.setData('text/slot-from', String(slotIndex))`
  - 既有 expose `onSearchResult`/`goToLine` 不變

- [ ] **Step 1: 修改 EditorPanel.vue script**

在 `defineProps` 加入：

```js
const props = defineProps({
  fileId: { type: Number, default: null },
  splitMode: { type: Boolean, default: false },
  slotIndex: { type: Number, default: -1 }
})
const emit = defineEmits(['close-slot', 'toggle-dropdown'])
```

`onMounted` 改為（空格 fileId=null 時不建立 view）：

```js
onMounted(() => {
  store.loadSyntaxColors()
  if (fileInfo.value) initEditor()
})
```

在 `defineExpose` 前加入 dragstart handler：

```js
function onHeaderDragStart(e) {
  if (!props.splitMode) return
  e.dataTransfer.setData('text/slot-from', String(props.slotIndex))
  e.dataTransfer.effectAllowed = 'move'
}
```

- [ ] **Step 2: 修改 EditorPanel.vue template 的 header**

把 `<div class="editor-header">` 區塊改為（並排時 header 可拖曳，並加入 ▾ 與 × 按鈕）：

```vue
    <div class="editor-header" :class="{ draggable: splitMode }" :draggable="splitMode" @dragstart="onHeaderDragStart">
      <span class="file-name">{{ fileInfo?.fileName || '未開啟檔案' }}</span>
      <div class="editor-actions">
        <SearchBar @search="onSearchResult" />
        <button @click="showColorSettings = !showColorSettings">顏色設定</button>
        <template v-if="splitMode">
          <button class="slot-btn" title="替換程式" @click.stop="emit('toggle-dropdown', slotIndex)">▾</button>
          <button class="slot-btn" title="關閉此格" @click.stop="emit('close-slot', slotIndex)">×</button>
        </template>
      </div>
    </div>
```

- [ ] **Step 3: 修改 EditorPanel.vue style**

在 scoped style 尾端（`</style>` 前）加入：

```css
.editor-header.draggable { cursor: grab; }
.editor-header.draggable:active { cursor: grabbing; }
.slot-btn { min-width: 24px; padding: 2px 6px; line-height: 1.2; }
```

- [ ] **Step 4: 執行 dev build 確認無語法錯誤**

Run: `npx.cmd vite build`
Expected: 成功，無錯誤。

- [ ] **Step 5: Commit**

```bash
git add "CNC程式碼解讀器/cnc-editor/src/components/EditorPanel.vue"
git commit -m "feat: EditorPanel 支援並排 header - splitMode/slotIndex prop、拖曳、關閉與下拉事件"
```

---

### Task 3: App.vue 並排版面 + 選單 + 空格 + 下拉 + 拖曳落點

**Files:**
- Rewrite: `CNC程式碼解讀器\cnc-editor\src\App.vue`

**Interfaces:**
- Consumes: Task 1 的 `splitCount`/`splitSlots`/`setSplit`/`exitSplit`/`setSlot`/`closeSlot`/`moveSlot`/`addFile`/`removeFile`/`setActiveFile`；Task 2 的 `EditorPanel` 新 props/emits。
- Produces: 並排選單（2/3 格）、格子列（EditorPanel 或空格 div）、每格下拉、拖曳落點處理。單格模式維持分頁簽列現況。

- [ ] **Step 1: 重寫 App.vue script**

完整取代 `<script setup>` 區塊為：

```js
import { ref, reactive, computed } from 'vue'
import { useEditorStore } from './stores/editor'
import EditorPanel from './components/EditorPanel.vue'
import LeftNav from './components/LeftNav.vue'
import SimCanvas from './components/SimCanvas.vue'

const store = useEditorStore()
const editorRefs = reactive({})
const isDragging = ref(false)
const splitMenuOpen = ref(false)
const dropdownForSlot = ref(null)
let dragDepth = 0

function registerEditor(el, fileId) {
  if (el) editorRefs[fileId] = el
  else delete editorRefs[fileId]
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

function toggleSplitMenu() {
  splitMenuOpen.value = !splitMenuOpen.value
}

function chooseSplit(count) {
  store.setSplit(count)
  splitMenuOpen.value = false
  dropdownForSlot.value = null
}

function exitSplit() {
  store.exitSplit()
  splitMenuOpen.value = false
  dropdownForSlot.value = null
}

function slotFiles() {
  return store.files.filter(f => !store.splitSlotIds.includes(f.id))
}

function openDropdown(index) {
  dropdownForSlot.value = dropdownForSlot.value === index ? null : index
}

function selectSlot(index, fileId) {
  store.setSlot(index, fileId)
  dropdownForSlot.value = null
}

function onSlotDrop(index, e) {
  const from = parseInt(e.dataTransfer?.getData('text/slot-from') || '-1')
  if (!isNaN(from) && from >= 0) {
    store.moveSlot(from, index)
  }
  dropdownForSlot.value = null
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
```

- [ ] **Step 2: 重寫 App.vue template**

完整取代 `<template>` 區塊為：

```vue
  <div class="app-layout" @dragenter="onDragEnter" @dragover="onDragOver" @dragleave="onDragLeave" @drop="onDrop">
    <header class="toolbar">
      <h2>CNC 程式編輯平台</h2>
      <div class="toolbar-actions">
        <button @click="store.openFile">開啟檔案</button>
        <button @click="store.saveFile">儲存檔案</button>
        <button @click="store.downloadToolTable" :disabled="!store.tools.length">下載刀號表</button>
        <div class="split-menu-wrap">
          <button @click="toggleSplitMenu" :class="{ on: store.splitCount > 0 }">並排{{ store.splitCount || '' }}</button>
          <div v-if="splitMenuOpen" class="split-menu">
            <div class="split-menu-item" :class="{ sel: store.splitCount === 2 }" @click="chooseSplit(2)">2 格</div>
            <div class="split-menu-item" :class="{ sel: store.splitCount === 3 }" @click="chooseSplit(3)">3 格</div>
            <div v-if="store.splitCount > 0" class="split-menu-item" @click="exitSplit">關閉並排</div>
          </div>
        </div>
      </div>
    </header>
    <div v-if="store.splitCount === 0" class="tabs-bar">
      <div v-for="f in store.files" :key="f.id" class="tab" :class="{ active: f.id === store.activeFileId }" @click="store.setActiveFile(f.id)">
        <span class="tab-name">{{ f.fileName }}</span>
        <span class="tab-close" @click.stop="store.removeFile(f.id)">×</span>
      </div>
      <span v-if="!store.files.length" class="tabs-empty">拖入或開啟 NC 檔案</span>
    </div>
    <div class="main-area">
      <LeftNav @navigate="handleNavigate" />
      <div class="right-area">
        <div v-if="store.splitCount > 0" class="split-body">
          <div v-for="(slot, i) in store.splitSlots" :key="slot.id ?? ('empty-' + i)" class="split-col" @dragover.prevent @drop="onSlotDrop(i, $event)">
            <EditorPanel v-if="slot.file" :key="slot.id" :file-id="slot.id" :split-mode="true" :slot-index="i"
              :ref="(el) => registerEditor(el, slot.id)"
              @close-slot="store.closeSlot(i)" @toggle-dropdown="openDropdown(i)" />
            <div v-else class="empty-slot" @click="openDropdown(i)">
              <span class="empty-text">無程式<br />點此選擇</span>
            </div>
            <div v-if="dropdownForSlot === i" class="slot-dropdown">
              <div v-for="f in slotFiles()" :key="f.id" class="slot-option" @click.stop="selectSlot(i, f.id)">{{ f.fileName }}</div>
              <div v-if="!slotFiles().length" class="slot-option disabled">無其他程式</div>
            </div>
          </div>
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
```

- [ ] **Step 3: 重寫 App.vue style**

完整取代 `<style scoped>` 區塊為：

```css
.app-layout { display: flex; flex-direction: column; height: 100vh; }
.toolbar { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; background: #181825; border-bottom: 1px solid #313244; }
.toolbar h2 { font-size: 16px; font-weight: 600; }
.toolbar-actions { display: flex; gap: 8px; align-items: center; }
.toolbar-actions button.on { background: #89b4fa; color: #11111b; }
.split-menu-wrap { position: relative; }
.split-menu { position: absolute; top: calc(100% + 4px); right: 0; z-index: 30; background: #181825; border: 1px solid #313244; border-radius: 8px; box-shadow: 0 4px 16px #00000066; min-width: 120px; overflow: hidden; }
.split-menu-item { padding: 8px 14px; cursor: pointer; font-size: 13px; color: #a6adc8; }
.split-menu-item:hover { background: #31324455; color: #cdd6f4; }
.split-menu-item.sel { color: #89b4fa; font-weight: 600; }
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
.split-col { flex: 1; min-width: 0; display: flex; flex-direction: column; position: relative; border-right: 1px solid #313244; }
.split-col:last-child { border-right: none; }
.split-col :deep(.editor-panel) { min-width: 0; }
.empty-slot { flex: 1; display: flex; align-items: center; justify-content: center; cursor: pointer; background: #11111b22; }
.empty-slot:hover { background: #31324433; }
.empty-text { color: #6c7086; font-size: 14px; text-align: center; line-height: 1.6; }
.slot-dropdown { position: absolute; top: 34px; right: 8px; z-index: 40; background: #181825; border: 1px solid #313244; border-radius: 8px; box-shadow: 0 4px 16px #00000066; min-width: 160px; max-height: 300px; overflow-y: auto; }
.slot-option { padding: 8px 14px; cursor: pointer; font-size: 13px; color: #a6adc8; white-space: nowrap; }
.slot-option:hover { background: #31324455; color: #cdd6f4; }
.slot-option.disabled { color: #6c7086; cursor: default; }
.no-file { flex: 1; display: flex; align-items: center; justify-content: center; color: #6c7086; font-size: 14px; }
.drop-overlay { position: fixed; inset: 0; z-index: 999; background: #89b4fa22; display: flex; align-items: center; justify-content: center; pointer-events: none; }
.drop-box { background: #181825; border: 2px dashed #89b4fa; border-radius: 12px; padding: 40px 60px; font-size: 18px; color: #89b4fa; }
```

- [ ] **Step 4: 執行 dev build 確認無語法錯誤**

Run: `npx.cmd vite build`
Expected: 成功，無錯誤。

- [ ] **Step 5: 執行全部測試確認未回歸**

Run: `npm.cmd test`
Expected: 26 個測試全數 PASS。

- [ ] **Step 6: Commit**

```bash
git add "CNC程式碼解讀器/cnc-editor/src/App.vue"
git commit -m "feat: 並排 2/3 格版面 - 選單、空格、下拉替換、拖曳換位、單格模式維持分頁簽"
```

---

### Task 4: 建置安裝版並用 CDP 端對端驗證

**Files:**
- 驗證產物：`CNC程式碼解讀器\安裝版\`（由 `scripts/build-install.ps1` 產生）
- 驗證腳本：`C:\Users\TW-10\AppData\Local\Temp\opencode\cdp-split-test.js`

**Interfaces:**
- Consumes: 上述全部修改。

- [ ] **Step 1: 執行全部單元測試**

Run: `npm.cmd test`
Expected: 26 個測試全數 PASS。

- [ ] **Step 2: 建置安裝版**

Run: `npx.cmd vite build`；隨後 `& .\scripts\build-install.ps1`
Expected: 產生 `安裝版\app.js`、`cnc-editor.css`、`index.html` 等。

- [ ] **Step 3: 啟動 dev server 並 CDP 自動化驗證**

啟動 dev server：
```powershell
Start-Process cmd.exe -ArgumentList '/c cd /d "C:\Users\TW-10\Documents\firebase雲端資料夾\CNC程式碼解讀器\cnc-editor" && npx.cmd vite --port 3000 --host'
```

建立 `C:\Users\TW-10\AppData\Local\Temp\opencode\cdp-split-test.js`，內容如下（需確認 `ws` 套件位於該目錄可 require，或改用既有 `cdp-dual-test.js` 的骨架）：

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
  const files = ['A.NC','B.NC','C.NC']
  for (const f of files) {
    console.log('drop', f, ':', await ev(dropInject(f, fs.readFileSync(base+'\\'+f,'utf-8'))))
    await wait(2000)
  }
  console.log('單格 tabs:', await ev(`document.querySelectorAll('.tab').length`))
  console.log('單格顯示 editor:', await ev(`!!document.querySelector('.editor-panel')`))

  console.log('開並排選單:', await ev(`(() => { [...document.querySelectorAll('.toolbar-actions button')].find(b=>b.textContent.includes('並排')).click(); return 'ok' })()`))
  await wait(400)
  console.log('選單出現:', await ev(`!!document.querySelector('.split-menu')`))
  console.log('選 3 格:', await ev(`(() => { [...document.querySelectorAll('.split-menu-item')].find(b=>b.textContent.includes('3 格')).click(); return 'ok' })()`))
  await wait(800)
  console.log('split-col 數:', await ev(`document.querySelectorAll('.split-col').length`))
  console.log('tabs 隱藏:', await ev(`!document.querySelector('.tabs-bar')`))
  console.log('格子檔名:', await ev(`JSON.stringify([...document.querySelectorAll('.split-col .file-name')].map(e=>e.textContent))`))

  console.log('點中格(第2格)切 active:', await ev(`(() => { const p=document.querySelectorAll('.split-col .cm-editor')[1]; p.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); return 'ok' })()`))
  await wait(800)
  console.log('目前程式:', await ev(`document.querySelector('.active-program .ap-name')?.textContent||''`))
  console.log('active 格數(藍線應1格):', await ev(`document.querySelectorAll('.editor-panel.active').length`))

  console.log('第2格 ▾ 下拉:', await ev(`(() => { [...document.querySelectorAll('.split-col .slot-btn')].filter(b=>b.title==='替換程式')[1].click(); return 'ok' })()`))
  await wait(400)
  console.log('下拉選項:', await ev(`JSON.stringify([...document.querySelectorAll('.slot-option')].map(e=>e.textContent))`))
  console.log('替換第2格為 A.NC:', await ev(`(() => { const o=[...document.querySelectorAll('.slot-option')].find(e=>e.textContent.includes('A.NC')); if(!o) return 'no-option'; o.click(); return 'ok' })()`))
  await wait(800)
  console.log('格子檔名:', await ev(`JSON.stringify([...document.querySelectorAll('.split-col .file-name')].map(e=>e.textContent))`))

  console.log('拖曳第1格→第2格:', await ev(`(() => {
    const cols=document.querySelectorAll('.split-col')
    const header=cols[0].querySelector('.editor-header')
    const dt=new DataTransfer()
    const src=new DragEvent('dragstart',{bubbles:true,dataTransfer:dt})
    header.dispatchEvent(src)
    const dropEv=new DragEvent('drop',{bubbles:true,dataTransfer:dt})
    cols[1].dispatchEvent(dropEv)
    return 'ok'
  })()`))
  await wait(800)
  console.log('換位後格子檔名:', await ev(`JSON.stringify([...document.querySelectorAll('.split-col .file-name')].map(e=>e.textContent))`))

  console.log('關閉並排:', await ev(`(() => { [...document.querySelectorAll('.toolbar-actions button')].find(b=>b.textContent.includes('並排')).click(); [...document.querySelectorAll('.split-menu-item')].find(b=>b.textContent.includes('關閉')).click(); return 'ok' })()`))
  await wait(800)
  console.log('單格 tabs 回復:', await ev(`document.querySelectorAll('.tab').length`))
  console.log('單格顯示 editor:', await ev(`!!document.querySelector('.editor-panel')`))
  console.log('例外:', errs.length?errs.join('\n'):'(無)')
  proc.kill();process.exit(0)
})().catch(e=>{console.error('FAIL',e.message);process.exit(1)})
```

執行：
```powershell
node "C:\Users\TW-10\AppData\Local\Temp\opencode\cdp-split-test.js"
```

Expected:
- drop A/B/C → 單格 tabs = 3、單格顯示 1 個 editor
- 開選單 → 選 3 格 → split-col = 3、tabs 隱藏、格子檔名 = `["A.NC","B.NC","C.NC"]`
- 點第 2 格 → 「目前程式」變 B.NC、`.editor-panel.active` = 1
- ▾ 下拉列出未顯示程式（此時為空→顯示「無其他程式」）；若有空格則列出
- 拖曳第 1 格 header 到第 2 格 → 格子順序交換
- 關閉並排 → tabs 回復 3、單格顯示 1 個 editor
- 例外 = (無)

- [ ] **Step 4: 驗證安裝版 file:// 可執行**

```powershell
$out = & "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless --disable-gpu --dump-dom "file:///C:/Users/TW-10/Documents/firebase雲端資料夾/CNC程式碼解讀器/安裝版/index.html" 2>&1 | Out-String
```
Expected: `$out` 含 `app-layout` 與 `split-menu-wrap` class。

- [ ] **Step 5: Commit**

```bash
git add "CNC程式碼解讀器/cnc-editor/src" "CNC程式碼解讀器/cnc-editor/docs" "CNC程式碼解讀器/安裝版/app.js" "CNC程式碼解讀器/安裝版/cnc-editor.css" "CNC程式碼解讀器/安裝版/CNC 程式編輯平台.lnk"
git commit -m "feat: 三格並排比較與編輯功能完成 - 2/3 格選單、點選切 active、拖曳換位、下拉替換、空格補位"
git push origin main
```

> ⚠️ 確認 `git add` 不含 `A.NC`~`D.NC`。

---

## 已知風險與注意事項

- **空格 key**：`slot.id ?? ('empty-' + i)` 確保空格格即使沒有 fileId 也有穩定 key。
- **EditorPanel 空格**：fileId = null 時 onMounted 不 initEditor；App 只對有 file 的 slot 渲染 EditorPanel。
- **拖曳**：HTML5 drag & drop，`text/slot-from` 傳來源 index；落點用 `@drop` 於 `.split-col`；`@dragover.prevent` 必須存在才能觸發 drop。
- **`setSlot` 同檔交換**：避免同一支程式同時出現在兩格。
- **`addFile` 補空格**：只在有空格時填入；並排滿格時新檔只進 files（分頁簽，單格模式可見）。
- **安裝版**：每次修改後必須重新執行 `build-install.ps1`，桌面捷徑才會是新的。
- **共用 repo**：commit 只含 CNC 相關檔案，避免誤 commit 其他專案改動。
