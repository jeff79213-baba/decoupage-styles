<script setup>
import { ref } from 'vue'
import { useEditorStore } from './stores/editor'
import EditorPanel from './components/EditorPanel.vue'
import LeftNav from './components/LeftNav.vue'
import SimCanvas from './components/SimCanvas.vue'

const store = useEditorStore()
const editorRef = ref(null)
const isDragging = ref(false)
let dragDepth = 0

function handleSearch(results, index) {
  editorRef.value?.onSearchResult(results, index)
}

function handleNavigate(lineIndex) {
  store.goToLine(lineIndex)
  editorRef.value?.goToLine(lineIndex)
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
  if (file) store.loadFile(file)
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
      </div>
    </header>
    <div class="main-area">
      <LeftNav @navigate="handleNavigate" />
      <div class="right-area">
        <EditorPanel ref="editorRef" @search="handleSearch" />
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
.main-area { display: flex; flex: 1; overflow: hidden; }
.right-area { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
.drop-overlay { position: fixed; inset: 0; z-index: 999; background: #89b4fa22; display: flex; align-items: center; justify-content: center; pointer-events: none; }
.drop-box { background: #181825; border: 2px dashed #89b4fa; border-radius: 12px; padding: 40px 60px; font-size: 18px; color: #89b4fa; }
</style>
