<script setup>
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
</script>

<template>
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
</template>

<style scoped>
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
</style>
