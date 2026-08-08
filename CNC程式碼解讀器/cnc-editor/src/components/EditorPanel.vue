<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
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

const store = useEditorStore()
const editorContainer = ref(null)
const splitContainer = ref(null)
const splitBody = ref(null)
let view = null
let view2 = null
let activeView = null
const showColorSettings = ref(false)
const splitMode = ref(false)
const splitPct = ref(50)
let draggingDivider = false

function buildExtensions() {
  return [
    basicSetup,
    bookmarkPositionsField,
    keymap.of([...searchKeymap, indentWithTab]),
    highlightSelectionMatches(),
    buildCncLanguage(store.effectiveSyntaxColors),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        store.rawText = update.state.doc.toString()
      }
      if (update.selectionSet) {
        const pos = update.state.selection.main.head
        const line = update.state.doc.lineAt(pos)
        store.currentLine = line.number - 1
      }
      if (update.viewportChanged && update.view === activeView) {
        const from = update.view.viewport.from
        const line = update.state.doc.lineAt(from)
        store.currentLine = line.number - 1
      }
    })
  ]
}

function bookmarkPositions(v) {
  const doc = v.state.doc
  return store.bookmarks.map(lineNum => {
    const clamped = Math.min(lineNum, doc.lines - 1)
    return doc.line(clamped + 1).from
  })
}

function applyBookmarks(v) {
  v.dispatch({ effects: setBookmarksEffect.of(bookmarkPositions(v)) })
}

function createView(container) {
  const state = EditorState.create({
    doc: store.rawText,
    extensions: buildExtensions()
  })
  const v = new EditorView({ state, parent: container })
  if (store.bookmarks.length) {
    applyBookmarks(v)
  }
  v.dom.addEventListener('focusin', () => { activeView = v })
  v.dom.addEventListener('pointerdown', () => { activeView = v })
  return v
}

function initEditor() {
  if (!editorContainer.value) return
  view = createView(editorContainer.value)
  activeView = view
}

function goToLine(lineIndex) {
  if (!view) return
  const target = (splitMode.value && activeView) ? activeView : view
  const pos = target.state.doc.line(lineIndex + 1)
  target.dispatch({
    selection: { anchor: pos.from },
    effects: EditorView.scrollIntoView(pos.from, { y: 'start' })
  })
}

function onSearchResult(results, index) {
  if (!view || index < 0 || !results.length) return
  goToLine(results[index].line)
}

async function toggleSplit() {
  if (splitMode.value) {
    view2?.destroy()
    view2 = null
    splitMode.value = false
    activeView = view
    return
  }
  splitMode.value = true
  await nextTick()
  if (splitContainer.value) {
    view2 = createView(splitContainer.value)
  }
  activeView = view
}

function onDividerDown(e) {
  draggingDivider = true
  e.preventDefault()
  const move = (ev) => {
    if (!draggingDivider || !splitBody.value) return
    const rect = splitBody.value.getBoundingClientRect()
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

function onBodyMouseLeave() {
  if (draggingDivider) {
    draggingDivider = false
  }
}

onMounted(() => {
  store.loadSyntaxColors()
  initEditor()
})

onBeforeUnmount(() => {
  view?.destroy()
  view2?.destroy()
})

watch(() => store.rawText, (newVal) => {
  const views = [view, view2].filter(Boolean)
  for (const v of views) {
    if (newVal !== v.state.doc.toString()) {
      v.dispatch({
        changes: { from: 0, to: v.state.doc.length, insert: newVal }
      })
    }
  }
})

watch(() => store.bookmarks, () => {
  const views = [view, view2].filter(Boolean)
  for (const v of views) {
    applyBookmarks(v)
  }
}, { deep: true })

watch(() => store.effectiveSyntaxColors, async () => {
  const pos = view?.state.selection.main.head ?? 0
  const pos2 = view2?.state.selection.main.head
  const activeWasView2 = activeView === view2
  view?.destroy()
  view2?.destroy()
  view = null
  view2 = null
  if (editorContainer.value) view = createView(editorContainer.value)
  if (splitMode.value && splitContainer.value) view2 = createView(splitContainer.value)
  activeView = activeWasView2 && view2 ? view2 : view
  if (pos <= view.state.doc.length) {
    view.dispatch({ selection: { anchor: pos } })
  }
  if (view2 && pos2 != null && pos2 <= view2.state.doc.length) {
    view2.dispatch({ selection: { anchor: pos2 } })
  }
}, { deep: true })

defineExpose({ onSearchResult, goToLine })
</script>

<template>
  <div class="editor-panel">
    <div class="editor-header">
      <span class="file-name">{{ store.currentFileName || '未開啟檔案' }}</span>
      <div class="editor-actions">
        <SearchBar @search="onSearchResult" />
        <button @click="toggleSplit" :class="{ on: splitMode }">分切</button>
        <button @click="showColorSettings = !showColorSettings">顏色設定</button>
      </div>
    </div>
    <div ref="splitBody" class="editor-body" :class="{ split: splitMode }">
      <div ref="editorContainer" class="editor-pane" :style="splitMode ? { flex: `0 0 ${splitPct}%` } : {}"></div>
      <div v-if="splitMode" class="split-divider" @mousedown="onDividerDown"></div>
      <div v-if="splitMode" ref="splitContainer" class="editor-pane"></div>
    </div>
    <ColorSettings v-if="showColorSettings" @close="showColorSettings = false" />
  </div>
</template>

<style scoped>
.editor-panel { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
.editor-header { display: flex; align-items: center; justify-content: space-between; padding: 4px 12px; background: #181825; border-bottom: 1px solid #313244; }
.file-name { font-size: 13px; color: #a6adc8; }
.editor-actions { display: flex; align-items: center; gap: 6px; }
button.on { background: #89b4fa; color: #11111b; }
.editor-body { flex: 1; overflow: hidden; display: flex; }
.editor-pane { min-width: 0; overflow: hidden; display: flex; }
.editor-body:not(.split) .editor-pane { flex: 1; }
.editor-body.split .editor-pane:last-child { flex: 1; }
.split-divider { flex: 0 0 6px; cursor: col-resize; background: #313244; border-left: 1px solid #45475a; border-right: 1px solid #45475a; }
.split-divider:hover, .split-divider:active { background: #89b4fa66; }
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
