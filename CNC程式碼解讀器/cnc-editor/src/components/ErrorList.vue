<script setup>
import { computed } from 'vue'
import { useEditorStore } from '../stores/editor'

const store = useEditorStore()
const emit = defineEmits(['navigate'])

const sorted = computed(() => {
  const order = { error: 0, warning: 1, info: 2 }
  return [...store.errors].sort((a, b) => a.line - b.line || order[a.type] - order[b.type])
})

const typeIcon = { error: '⛔', warning: '⚠', info: 'ℹ' }
</script>

<template>
  <div class="error-list">
    <div v-if="!sorted.length" class="error-empty">未偵測到錯誤</div>
    <div v-for="(p, i) in sorted" :key="i" class="error-item" :class="p.type" @click="emit('navigate', p.line - 1)">
      <span class="err-icon">{{ typeIcon[p.type] }}</span>
      <span class="err-line">{{ p.line }}</span>
      <span class="err-msg">{{ p.message }}</span>
    </div>
  </div>
</template>

<style scoped>
.error-list { display: flex; flex-direction: column; gap: 2px; }
.error-empty { color: #6c7086; font-size: 13px; padding: 8px 4px; }
.error-item { display: flex; align-items: center; gap: 6px; padding: 4px 6px; border-radius: 4px; cursor: pointer; font-size: 12px; }
.error-item:hover { background: #31324455; }
.error-item .err-line { color: #6c7086; min-width: 28px; text-align: right; font-family: monospace; }
.error-item.error .err-msg { color: #f38ba8; }
.error-item.warning .err-msg { color: #f9e2af; }
.error-item.info .err-msg { color: #a6adc8; }
</style>
