<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
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
  view = new EditorView({ state, parent: editorContainer.value })
}

function onSearchResult(results, index) {
  if (!view || index < 0 || !results.length) return
  const line = results[index].line
  const pos = view.state.doc.line(line + 1)
  view.dispatch({
    selection: { anchor: pos.from },
    scrollIntoView: true
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
    if (pos <= view.state.doc.length) {
      view.dispatch({ selection: { anchor: pos } })
    }
  }
}, { deep: true })

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
