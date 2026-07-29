<script setup>
import { ref, computed } from 'vue'
import { useEditorStore } from '../stores/editor'

const store = useEditorStore()
const keyword = ref('')
const emit = defineEmits(['search'])

function doSearch() {
  store.search(keyword.value)
  if (store.searchResults.length > 0) {
    emit('search', store.searchResults, store.searchIndex)
  }
}

function nextResult() {
  store.nextSearch()
  if (store.searchResults.length > 0) {
    emit('search', store.searchResults, store.searchIndex)
  }
}

function prevResult() {
  store.prevSearch()
  if (store.searchResults.length > 0) {
    emit('search', store.searchResults, store.searchIndex)
  }
}

const resultLabel = computed(() => {
  if (!store.searchResults.length) return ''
  return `${store.searchIndex + 1}/${store.searchResults.length}`
})
</script>

<template>
  <div class="search-bar">
    <input v-model="keyword" placeholder="搜尋..." @keyup.enter="doSearch" @keyup.escape="keyword=''; doSearch()" />
    <button @click="doSearch" :disabled="!keyword">搜尋</button>
    <span v-if="resultLabel" class="result-count">{{ resultLabel }}</span>
    <button @click="prevResult" :disabled="!store.searchResults.length">▲</button>
    <button @click="nextResult" :disabled="!store.searchResults.length">▼</button>
  </div>
</template>

<style scoped>
.search-bar { display: flex; align-items: center; gap: 4px; }
.search-bar input { width: 160px; }
.result-count { font-size: 12px; color: #a6adc8; min-width: 36px; text-align: center; }
</style>
