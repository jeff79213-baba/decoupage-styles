<script setup>
import { useEditorStore } from '../stores/editor'
const store = useEditorStore()
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
    <table v-if="store.tools.length">
      <thead>
        <tr>
          <th>N 號</th>
          <th>刀具名稱</th>
          <th>刀桿名稱</th>
          <th v-if="store.showTypeColumn">加工類型</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="t in store.tools" :key="t.n">
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
tr:hover td { background: #31324455; }
.empty { color: #6c7086; padding: 20px; text-align: center; font-size: 13px; }
</style>
