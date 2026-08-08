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
