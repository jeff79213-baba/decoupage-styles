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
  fileId: { type: Number, default: null },
  splitMode: { type: Boolean, default: false },
  slotIndex: { type: Number, default: -1 }
})
const emit = defineEmits(['close-slot', 'toggle-dropdown'])
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
const dropActive = ref(false)
let dragDepth = 0

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
  if (fileInfo.value) initEditor()
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

function onHeaderDragStart(e) {
  if (!props.splitMode) return
  e.dataTransfer.setData('text/slot-from', String(props.slotIndex))
  e.dataTransfer.effectAllowed = 'move'
}

function onHeaderDragEnter(e) {
  if (!props.splitMode) return
  const types = e.dataTransfer?.types || []
  if (!types.includes('text/slot-from')) return
  e.preventDefault()
  dragDepth++
  dropActive.value = true
}

function onHeaderDragOver(e) {
  if (!props.splitMode) return
  e.preventDefault()
  if (e.dataTransfer?.types?.includes('text/slot-from')) {
    e.dataTransfer.dropEffect = 'move'
  }
}

function onHeaderDragLeave(e) {
  if (!props.splitMode) return
  if (dragDepth === 0) return
  dragDepth--
  if (dragDepth === 0) dropActive.value = false
}

function onHeaderDrop(e) {
  if (!props.splitMode) return
  e.preventDefault()
  dragDepth = 0
  dropActive.value = false
  const types = e.dataTransfer?.types || []
  if (!types.includes('text/slot-from')) return
  e.stopPropagation()
  const from = parseInt(e.dataTransfer.getData('text/slot-from') || '-1', 10)
  if (!isNaN(from) && from >= 0 && from !== props.slotIndex) {
    store.moveSlot(from, props.slotIndex)
  }
}

defineExpose({ onSearchResult, goToLine })
</script>

<template>
  <div class="editor-panel" :class="{ active: isActive }">
    <div class="editor-header" :class="{ draggable: splitMode, 'drop-target': dropActive }" :draggable="splitMode"
      @dragstart="onHeaderDragStart" @dragenter="onHeaderDragEnter" @dragover="onHeaderDragOver"
      @dragleave="onHeaderDragLeave" @drop="onHeaderDrop">
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
.editor-header.draggable { cursor: grab; }
.editor-header.draggable:active { cursor: grabbing; }
.slot-btn { min-width: 24px; padding: 2px 6px; line-height: 1.2; }
.editor-header.drop-target { box-shadow: inset 0 0 0 2px #89b4fa; }
</style>
