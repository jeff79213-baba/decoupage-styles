<script setup>
import { ref, computed } from 'vue'
import { useEditorStore } from '../stores/editor'

const store = useEditorStore()
const props = defineProps({
  fileId: { type: Number, required: true }
})
const keyword = ref('')
const emit = defineEmits(['search'])

const st = computed(() => store.searchState(props.fileId))

function doSearch() {
  store.search(props.fileId, keyword.value)
  if (st.value.results.length > 0) {
    emit('search', st.value.results, st.value.index)
  }
}

function nextResult() {
  if (!st.value.results.length && keyword.value) {
    doSearch()
  }
  if (!st.value.results.length) return
  store.nextSearch(props.fileId)
  emit('search', st.value.results, st.value.index)
}

function prevResult() {
  if (!st.value.results.length && keyword.value) {
    doSearch()
  }
  if (!st.value.results.length) return
  store.prevSearch(props.fileId)
  emit('search', st.value.results, st.value.index)
}

const resultLabel = computed(() => {
  if (!st.value.results.length) return ''
  return `${st.value.index + 1}/${st.value.results.length}`
})
</script>

<template>
  <div class="search-bar">
    <input v-model="keyword" placeholder="搜尋..." @keyup.enter="doSearch" @keyup.escape="keyword=''; doSearch()" />
    <button @click="doSearch" :disabled="!keyword">搜尋</button>
    <span v-if="resultLabel" class="result-count">{{ resultLabel }}</span>
    <button @click="prevResult">▲</button>
    <button @click="nextResult">▼</button>
    <button @click="store.addBookmarks(props.fileId)" :disabled="!st.results.length">＋標籤</button>
    <button @click="store.clearBookmarks(props.fileId)" :disabled="!store.fileById(props.fileId)?.bookmarks?.length">清除標籤</button>
  </div>
</template>

<style scoped>
.search-bar { display: flex; align-items: center; gap: 4px; }
.search-bar input { width: 160px; }
.result-count { font-size: 12px; color: #a6adc8; min-width: 36px; text-align: center; }
</style>
