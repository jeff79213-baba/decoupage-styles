<script setup>
import { useEditorStore } from '../stores/editor'
import ToolTable from './ToolTable.vue'
import VariableTable from './VariableTable.vue'
import CoordViewer from './CoordViewer.vue'
import ErrorList from './ErrorList.vue'

const store = useEditorStore()
const emit = defineEmits(['navigate'])
const sections = [
  { key: 'tools', label: '刀號' },
  { key: 'variables', label: '變數' },
  { key: 'coordinates', label: '座標系' },
  { key: 'errors', label: '錯誤' }
]
</script>

<template>
  <div class="left-nav">
    <div class="active-program">
      <span class="ap-label">目前程式：</span>
      <span class="ap-name">{{ store.currentFileName || '未開啟' }}</span>
    </div>
    <div class="nav-items">
      <div v-for="s in sections" :key="s.key" class="nav-item" :class="{ active: store.selectedNav === s.key }" @click="store.setNav(s.key)">{{ s.key === 'errors' ? `錯誤 ${store.errorCount}` : s.label }}</div>
    </div>
    <div class="nav-content">
      <ToolTable v-if="store.selectedNav === 'tools'" @navigate="emit('navigate', $event)" />
      <VariableTable v-if="store.selectedNav === 'variables'" @navigate="emit('navigate', $event)" />
      <CoordViewer v-if="store.selectedNav === 'coordinates'" />
      <ErrorList v-if="store.selectedNav === 'errors'" @navigate="emit('navigate', $event)" />
    </div>
  </div>
</template>

<style scoped>
.left-nav { width: 420px; min-width: 420px; max-width: 420px; flex-shrink: 0; display: flex; flex-direction: column; border-right: 1px solid #313244; background: #181825; }
.active-program { display: flex; align-items: center; gap: 4px; padding: 6px 12px; background: #11111b; border-bottom: 1px solid #313244; font-size: 13px; }
.ap-label { color: #6c7086; }
.ap-name { color: #89b4fa; font-weight: 600; }
.nav-items { display: flex; border-bottom: 1px solid #313244; flex-shrink: 0; }
.nav-item { flex: 1; padding: 10px 0; text-align: center; cursor: pointer; font-size: 13px; color: #6c7086; border-bottom: 2px solid transparent; transition: all 0.15s; }
.nav-item.active { color: #89b4fa; border-bottom-color: #89b4fa; }
.nav-item:hover { color: #cdd6f4; }
.nav-content { flex: 1; overflow: auto; padding: 8px; }
</style>
