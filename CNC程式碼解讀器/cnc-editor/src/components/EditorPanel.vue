<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
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
const editorContainer = ref(null)
const splitContainer = ref(null)
let view = null
let view2 = null
const showColorSettings = ref(false)
const splitMode = ref(false)

function buildExtensions() {
  return [
    basicSetup,
    keymap.of([...searchKeymap, indentWithTab]),
    highlightSelectionMatches(),
    buildCncLanguage(store.syntaxColors),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        store.rawText = update.state.doc.toString()
      }
      if (update.selectionSet) {
        const pos = update.state.selection.main.head
        const line = update.state.doc.lineAt(pos)
        store.currentLine = line.number - 1
      }
    })
  ]
}

function createView(container) {
  const state = EditorState.create({
    doc: store.rawText,
    extensions: buildExtensions()
  })
  return new EditorView({ state, parent: container })
}

function initEditor() {
  if (!editorContainer.value) return
  view = createView(editorContainer.value)
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

async function toggleSplit() {
  if (splitMode.value) {
    view2?.destroy()
    view2 = null
    splitMode.value = false
    return
  }
  splitMode.value = true
  await nextTick()
  if (splitContainer.value) {
    view2 = createView(splitContainer.value)
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

watch(() => store.syntaxColors, async () => {
  const pos = view?.state.selection.main.head ?? 0
  const pos2 = view2?.state.selection.main.head
  view?.destroy()
  view2?.destroy()
  view = null
  view2 = null
  if (editorContainer.value) view = createView(editorContainer.value)
  if (splitMode.value && splitContainer.value) view2 = createView(splitContainer.value)
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
    <div class="editor-body" :class="{ split: splitMode }">
      <div ref="editorContainer" class="editor-pane"></div>
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
.editor-body { flex: 1; overflow: auto; display: flex; }
.editor-pane { flex: 1; min-width: 0; overflow: hidden; display: flex; }
.editor-body.split .editor-pane + .editor-pane { border-left: 1px solid #313244; }
.editor-body :deep(.cm-editor) { height: 100%; }
.editor-body :deep(.cm-scroller) { overflow: auto; }
</style>
