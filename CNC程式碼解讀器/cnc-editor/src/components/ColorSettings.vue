<script setup>
import { useEditorStore } from '../stores/editor'
const store = useEditorStore()
const emit = defineEmits(['close'])

const items = [
  { key: 'gCode', label: 'G-Code' },
  { key: 'mCode', label: 'M-Code' },
  { key: 'nBlock', label: 'N 區段' },
  { key: 'variable', label: '變數' },
  { key: 'comment', label: '註解' },
  { key: 'default', label: '預設文字' }
]

function onChange() {
  localStorage.setItem('cnc-syntax-colors', JSON.stringify(store.syntaxColors))
}
</script>

<template>
  <div class="color-settings-overlay" @click.self="emit('close')">
    <div class="color-settings">
      <h3>語法顏色設定</h3>
      <div class="color-list">
        <div v-for="item in items" :key="item.key" class="color-row">
          <label>{{ item.label }}</label>
          <input type="color" :value="store.syntaxColors[item.key]" @input="store.syntaxColors[item.key] = $event.target.value; onChange()" />
        </div>
      </div>
      <button @click="emit('close')">關閉</button>
    </div>
  </div>
</template>

<style scoped>
.color-settings-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.color-settings {
  background: #1e1e2e; border: 1px solid #313244; border-radius: 8px;
  padding: 24px; min-width: 300px;
}
.color-settings h3 { margin-bottom: 16px; font-size: 15px; }
.color-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
.color-row { display: flex; align-items: center; justify-content: space-between; }
.color-row input { width: 48px; height: 32px; border: none; background: transparent; cursor: pointer; }
</style>
