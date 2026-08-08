<script setup>
import { useEditorStore } from '../stores/editor'
const store = useEditorStore()
const emit = defineEmits(['close'])

const items = [
  { key: 'G', label: 'G (準備機能)' },
  { key: 'M', label: 'M (輔助機能)' },
  { key: 'N', label: 'N (區段號碼)' },
  { key: 'X', label: 'X (X 座標)' },
  { key: 'Y', label: 'Y (Y 座標)' },
  { key: 'Z', label: 'Z (Z 座標)' },
  { key: 'S', label: 'S (主軸轉速)' },
  { key: 'F', label: 'F (進給速率)' },
  { key: 'T', label: 'T (刀具號碼)' },
  { key: 'H', label: 'H (刀長補償)' },
  { key: 'D', label: 'D (刀徑補償)' },
  { key: 'variable', label: '# 變數' },
  { key: 'comment', label: '( 註解 )' }
]

function onChange() {
  localStorage.setItem('cnc-syntax-colors', JSON.stringify(store.syntaxColors))
}
</script>

<template>
  <div class="color-settings-overlay" @click.self="emit('close')">
    <div class="color-settings">
      <h3>語法顏色設定</h3>
      <div class="mode-row">
        <button class="mode-btn" :class="{ on: !store.monochrome }" @click="store.setMonochrome(false)">彩色</button>
        <button class="mode-btn" :class="{ on: store.monochrome }" @click="store.setMonochrome(true)">全灰</button>
      </div>
      <p v-if="store.monochrome" class="mode-hint">全灰模式：勾選的語法項目才顯示指定顏色，其餘皆為灰色</p>
      <div class="color-list">
        <div v-for="item in items" :key="item.key" class="color-row">
          <label class="color-label">
            <input v-if="store.monochrome" type="checkbox" :checked="!!store.monoEnabled[item.key]" @change="store.toggleMonoEnabled(item.key)" class="mono-check" />
            {{ item.label }}
          </label>
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
.mode-row { display: flex; gap: 8px; margin-bottom: 12px; }
.mode-btn { flex: 1; padding: 6px 0; border: 1px solid #45475a; border-radius: 4px; background: #313244; color: #cdd6f4; cursor: pointer; font-size: 13px; }
.mode-btn.on { background: #89b4fa; color: #11111b; border-color: #89b4fa; }
.mode-hint { font-size: 11px; color: #6c7086; margin-bottom: 12px; }
.color-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
.color-row { display: flex; align-items: center; justify-content: space-between; }
.color-label { display: flex; align-items: center; gap: 6px; }
.mono-check { width: 14px; height: 14px; accent-color: #89b4fa; }
.color-row input[type="color"] { width: 48px; height: 32px; border: none; background: transparent; cursor: pointer; }
</style>
