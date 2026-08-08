<script setup>
import { ref } from 'vue'
import { useEditorStore } from '../stores/editor'
const store = useEditorStore()
const emit = defineEmits(['navigate'])
const activeIdx = ref(-1)

function onVarClick(v, i) {
  activeIdx.value = i
  tableRef.value?.focus()
  if (v.line) emit('navigate', v.line - 1)
}

function isActive(v, i) {
  if (i === activeIdx.value) return true
  if (activeIdx.value >= 0) return false
  return store.currentLine >= 0 && v.line === store.currentLine + 1
}

function move(e) {
  if (!store.variables.length) return
  const last = store.variables.length - 1
  let next = activeIdx.value
  if (e.key === 'ArrowDown') next = activeIdx.value >= last ? 0 : activeIdx.value + 1
  else if (e.key === 'ArrowUp') next = activeIdx.value <= 0 ? last : activeIdx.value - 1
  else return
  e.preventDefault()
  const v = store.variables[next]
  const el = tableRef.value?.querySelectorAll('tbody tr')?.[next]
  el?.scrollIntoView({ block: 'nearest' })
  onVarClick(v, next)
}

const tableRef = ref(null)
</script>

<template>
  <div class="var-table">
    <div class="var-header">變數對應表</div>
    <table v-if="store.variables.length" ref="tableRef" tabindex="0" class="kbd-table" @keydown="move">
      <thead>
        <tr>
          <th>N 區段</th>
          <th>變數</th>
          <th>值</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(v, i) in store.variables" :key="i" class="clickable" :class="{ active: isActive(v, i) }" @click="onVarClick(v, i)">
          <td>{{ v.block || '-' }}</td>
          <td>#{{ v.id }}</td>
          <td>{{ v.value }}</td>
        </tr>
      </tbody>
    </table>
    <div v-else class="empty">無變數資料</div>
  </div>
</template>

<style scoped>
.var-table { font-size: 12px; }
.var-header { font-size: 13px; font-weight: 600; margin-bottom: 8px; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 4px 6px; text-align: left; border-bottom: 1px solid #313244; white-space: nowrap; }
th { color: #a6adc8; font-size: 11px; }
tr.clickable { cursor: pointer; }
tr.clickable:hover td { background: #31324455; }
tr.active td { background: #89b4fa33; }
tr.active td:first-child { border-left: 3px solid #89b4fa; }
.kbd-table { outline: none; }
.kbd-table:focus tr.active td { background: #89b4fa55; }
.empty { color: #6c7086; padding: 20px; text-align: center; font-size: 13px; }
</style>
