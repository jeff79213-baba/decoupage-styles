<script setup>
import { useEditorStore } from '../stores/editor'
import ToolTable from './ToolTable.vue'
import VariableTable from './VariableTable.vue'
import CoordViewer from './CoordViewer.vue'

const store = useEditorStore()
const sections = [
  { key: 'tools', label: '刀號' },
  { key: 'variables', label: '變數' },
  { key: 'coordinates', label: '座標系' }
]
</script>

<template>
  <div class="left-nav">
    <div class="nav-items">
      <div v-for="s in sections" :key="s.key" class="nav-item" :class="{ active: store.selectedNav === s.key }" @click="store.setNav(s.key)">{{ s.label }}</div>
    </div>
    <div class="nav-content">
      <ToolTable v-if="store.selectedNav === 'tools'" />
      <VariableTable v-if="store.selectedNav === 'variables'" />
      <CoordViewer v-if="store.selectedNav === 'coordinates'" />
    </div>
  </div>
</template>

<style scoped>
.left-nav { width: 320px; min-width: 280px; display: flex; flex-direction: column; border-right: 1px solid #313244; background: #181825; }
.nav-items { display: flex; border-bottom: 1px solid #313244; }
.nav-item { flex: 1; padding: 10px 0; text-align: center; cursor: pointer; font-size: 13px; color: #6c7086; border-bottom: 2px solid transparent; transition: all 0.15s; }
.nav-item.active { color: #89b4fa; border-bottom-color: #89b4fa; }
.nav-item:hover { color: #cdd6f4; }
.nav-content { flex: 1; overflow-y: auto; padding: 8px; }
</style>
