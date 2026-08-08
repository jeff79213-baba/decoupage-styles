<script setup>
import { ref, onMounted } from 'vue'
import { useEditorStore } from '../stores/editor'
const store = useEditorStore()
const emit = defineEmits(['navigate'])
const activeIdx = ref(-1)

function onToolClick(t, i) {
  activeIdx.value = i
  tableRef.value?.focus()
  const line = t.block?.startLine
  if (line) emit('navigate', line - 1)
}

function isActive(t, i) {
  return i === activeIdx.value || (store.currentLine >= 0 && t.block &&
    store.currentLine >= t.block.startLine - 1 && store.currentLine <= t.block.endLine - 1)
}

function move(e) {
  if (!store.tools.length) return
  const last = store.tools.length - 1
  let next = activeIdx.value
  if (e.key === 'ArrowDown') next = activeIdx.value >= last ? 0 : activeIdx.value + 1
  else if (e.key === 'ArrowUp') next = activeIdx.value <= 0 ? last : activeIdx.value - 1
  else return
  e.preventDefault()
  const t = store.tools[next]
  const el = tableRef.value?.querySelectorAll('tbody tr')?.[next]
  el?.scrollIntoView({ block: 'nearest' })
  onToolClick(t, next)
}

const tableRef = ref(null)
onMounted(() => { tableRef.value?.addEventListener('keydown', move) })
</script>

<template>
  <div class="tool-table">
    <div class="tool-header">
      <span>刀號表</span>
      <label class="type-toggle">
        <input type="checkbox" v-model="store.showTypeColumn" />
        顯示加工類型
      </label>
    </div>
    <table v-if="store.tools.length" ref="tableRef" tabindex="0" class="kbd-table">
      <thead>
        <tr>
          <th>N 號</th>
          <th>刀具名稱</th>
          <th>刀桿名稱</th>
          <th v-if="store.showTypeColumn">加工類型</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(t, i) in store.tools" :key="t.n" class="clickable" :class="{ active: isActive(t, i) }" @click="onToolClick(t, i)">
          <td>{{ t.n }}</td>
          <td>{{ t.toolName }}</td>
          <td>{{ t.holderName }}</td>
          <td v-if="store.showTypeColumn">{{ t.type }}</td>
        </tr>
      </tbody>
    </table>
    <div v-else class="empty">請先開啟 NC 檔案</div>
  </div>
</template>

<style scoped>
.tool-table { font-size: 12px; }
.tool-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 13px; font-weight: 600; }
.type-toggle { font-weight: 400; font-size: 12px; display: flex; align-items: center; gap: 4px; cursor: pointer; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 4px 6px; text-align: left; border-bottom: 1px solid #313244; white-space: nowrap; }
th { color: #a6adc8; font-size: 11px; position: sticky; top: 0; background: #181825; }
tr.clickable { cursor: pointer; }
tr.clickable:hover td { background: #31324455; }
tr.active td { background: #89b4fa33; }
tr.active td:first-child { border-left: 3px solid #89b4fa; }
.kbd-table { outline: none; }
.kbd-table:focus tr.active td { background: #89b4fa55; }
.empty { color: #6c7086; padding: 20px; text-align: center; font-size: 13px; }
</style>
