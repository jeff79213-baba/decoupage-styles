<script setup>
import { ref, watch, onMounted, onBeforeUnmount, computed, nextTick } from 'vue'
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

const setErrorsEffect = StateEffect.define()
class ErrorDot extends GutterMarker {
  constructor(level) { super(); this.level = level }
  toDOM() {
    const span = document.createElement('span')
    span.className = `cm-error-dot ${this.level}`
    return span
  }
  eq(other) { return other instanceof ErrorDot && other.level === this.level }
}
const errorPositionsField = StateField.define({
  create: () => [],
  update(positions, tr) {
    positions = positions.map(p => ({ pos: tr.changes.mapPos(p.pos, 1), level: p.level }))
    for (const e of tr.effects) {
      if (e.is(setErrorsEffect)) positions = e.value
    }
    return positions
  },
  provide: (f) => lineNumberMarkers.from(f, positions => {
    const ranges = positions.map(p => {
      const level = p.level === 'error' ? 'error' : 'warning'
      return new ErrorDot(level).range(p.pos)
    })
    return RangeSet.of(ranges)
  })
})

const editorContainer = ref(null)
const splitContainer = ref(null)
let view = null
let view2 = null
const showColorSettings = ref(false)
const splitPane = ref(false)

function buildExtensions() {
  return [
    basicSetup,
    bookmarkPositionsField,
    errorPositionsField,
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

function errorPositions(v) {
  const doc = v.state.doc
  const errs = store.errorsByFile[props.fileId] || []
  const lines = new Map()
  for (const e of errs) {
    const ln = Math.min(e.line - 1, doc.lines - 1)
    if (!lines.has(ln) || lines.get(ln) === 'warning') {
      lines.set(ln, e.type === 'error' ? 'error' : lines.get(ln) || 'warning')
    }
  }
  return [...lines.entries()]
    .map(([ln, level]) => ({ pos: doc.line(ln + 1).from, level }))
    .sort((a, b) => a.pos - b.pos)
}

function applyErrors(v) {
  v.dispatch({ effects: setErrorsEffect.of(errorPositions(v)) })
}

function createView(container) {
  const state = EditorState.create({
    doc: fileInfo.value?.rawText || '',
    extensions: buildExtensions()
  })
  const v = new EditorView({ state, parent: container })
  v.dom.addEventListener('focusin', () => { store.setActiveFile(props.fileId) })
  v.dom.addEventListener('pointerdown', () => { store.setActiveFile(props.fileId) })
  try {
    if (fileInfo.value?.bookmarks?.length) applyBookmarks(v)
    if (store.errorsByFile[props.fileId]?.length) applyErrors(v)
  } catch (e) {
    console.error('gutter 套用失敗:', e)
  }
  return v
}

function initEditor() {
  if (!editorContainer.value) return
  view = createView(editorContainer.value)
}

function destroySplit() {
  view2?.destroy()
  view2 = null
  splitPane.value = false
}

async function toggleSplit() {
  if (splitPane.value) {
    destroySplit()
    return
  }
  splitPane.value = true
  await nextTick()
  if (splitContainer.value) {
    view2 = createView(splitContainer.value)
    if (fileInfo.value?.bookmarks?.length) applyBookmarks(view2)
  }
}

function goToLine(lineIndex) {
  const views = [view, view2].filter(Boolean)
  for (const v of views) {
    const pos = v.state.doc.line(lineIndex + 1)
    v.dispatch({
      selection: { anchor: pos.from },
      effects: EditorView.scrollIntoView(pos.from, { y: 'start' })
    })
  }
}

function onSearchResult(results, index) {
  if (!view || index < 0 || !results.length) return
  goToLine(results[index].line)
}

onMounted(() => {
  store.loadSyntaxColors()
  if (fileInfo.value) initEditor()
})

onBeforeUnmount(() => {
  view?.destroy()
  view2?.destroy()
  view = null
  view2 = null
})

watch(() => fileInfo.value?.rawText, (newVal) => {
  const views = [view, view2].filter(Boolean)
  for (const v of views) {
    if (newVal !== v.state.doc.toString()) {
      v.dispatch({
        changes: { from: 0, to: v.state.doc.length, insert: newVal }
      })
    }
  }
})

watch(() => fileInfo.value?.bookmarks, () => {
  const views = [view, view2].filter(Boolean)
  for (const v of views) applyBookmarks(v)
}, { deep: true })

watch(() => store.errorsByFile[props.fileId], () => {
  const views = [view, view2].filter(Boolean)
  for (const v of views) applyErrors(v)
}, { deep: true })

watch(() => store.effectiveSyntaxColors, async () => {
  const pos = view?.state.selection.main.head ?? 0
  const pos2 = view2?.state.selection.main.head
  view?.destroy()
  view2?.destroy()
  view = null
  view2 = null
  if (editorContainer.value) view = createView(editorContainer.value)
  if (splitPane.value && splitContainer.value) view2 = createView(splitContainer.value)
  if (pos <= view.state.doc.length) {
    view.dispatch({ selection: { anchor: pos } })
  }
  if (view2 && pos2 != null && pos2 <= view2.state.doc.length) {
    view2.dispatch({ selection: { anchor: pos2 } })
  }
}, { deep: true })

function onHeaderDragStart(e) {
  if (!props.splitMode) return
  e.dataTransfer.setData('text/slot-from', String(props.slotIndex))
  e.dataTransfer.effectAllowed = 'move'
}

function onDragStart(e) {
  if (e.target.closest('input, button, select, a')) {
    e.preventDefault()
    e.stopPropagation()
    return
  }
  onHeaderDragStart(e)
}

defineExpose({ onSearchResult, goToLine })
</script>

<template>
  <div class="editor-panel" :class="{ active: isActive }" @pointerdown="store.setActiveFile(props.fileId)">
    <div class="editor-header">
      <div class="header-drag" :class="{ draggable: splitMode }" :draggable="splitMode" @dragstart="onDragStart">
        <span class="file-name">{{ fileInfo?.fileName || '未開啟檔案' }}</span>
        <span v-if="splitMode" class="drag-hint">⋮⋮ 拖曳換位</span>
      </div>
      <div class="editor-actions" @dragstart.stop>
        <SearchBar :file-id="props.fileId" @search="onSearchResult" />
        <button @click="toggleSplit" :class="{ on: splitPane }">分切</button>
        <button @click="showColorSettings = !showColorSettings">顏色設定</button>
        <template v-if="splitMode">
          <button class="slot-btn" title="替換程式" @click.stop="emit('toggle-dropdown', slotIndex)">▾</button>
          <button class="slot-btn" title="關閉此格" @click.stop="emit('close-slot', slotIndex)">×</button>
        </template>
      </div>
    </div>
    <div class="editor-body" :class="{ split: splitPane }">
      <div ref="editorContainer" class="editor-pane"></div>
      <div v-if="splitPane" ref="splitContainer" class="editor-pane"></div>
    </div>
    <ColorSettings v-if="showColorSettings" @close="showColorSettings = false" />
  </div>
</template>

<style scoped>
.editor-panel { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
.editor-header { display: flex; align-items: center; justify-content: space-between; padding: 4px 12px; background: #181825; border-bottom: 1px solid #313244; }
.editor-panel.active .editor-header { background: #1e1e2e; box-shadow: inset 0 2px 0 #89b4fa; }
.header-drag { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; padding-right: 8px; }
.header-drag.draggable { cursor: grab; }
.header-drag.draggable:active { cursor: grabbing; }
.drag-hint { font-size: 11px; color: #6c7086; }
.file-name { font-size: 13px; color: #a6adc8; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.editor-panel.active .file-name { color: #89b4fa; font-size: 14px; }
.editor-actions { display: flex; align-items: center; gap: 6px; }
.editor-body { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
.editor-body.split { flex-direction: row; }
.editor-pane { flex: 1; min-width: 0; overflow: hidden; display: flex; }
.editor-body.split .editor-pane + .editor-pane { border-left: 1px solid #313244; }
.editor-pane :deep(.cm-editor) { height: 100%; flex: 1; }
.editor-pane :deep(.cm-scroller) { overflow: auto; }
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
.editor-pane :deep(.cm-error-dot) {
  display: inline-block;
  margin-left: 3px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  vertical-align: middle;
}
.editor-pane :deep(.cm-error-dot.error) { background: #ef4444; }
.editor-pane :deep(.cm-error-dot.warning) { background: #fab387; }
.slot-btn { min-width: 24px; padding: 2px 6px; line-height: 1.2; }
</style>
