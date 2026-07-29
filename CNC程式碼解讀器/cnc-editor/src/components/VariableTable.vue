<script setup>
import { useEditorStore } from '../stores/editor'
const store = useEditorStore()
</script>

<template>
  <div class="var-table">
    <div class="var-header">變數對應表</div>
    <table v-if="store.variables.length">
      <thead>
        <tr>
          <th>N 區段</th>
          <th>變數</th>
          <th>值</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(v, i) in store.variables" :key="i">
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
th, td { padding: 4px 6px; text-align: left; border-bottom: 1px solid #313244; }
th { color: #a6adc8; font-size: 11px; }
tr:hover td { background: #31324455; }
.empty { color: #6c7086; padding: 20px; text-align: center; font-size: 13px; }
</style>
