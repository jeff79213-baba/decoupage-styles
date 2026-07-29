<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useEditorStore } from '../stores/editor'
import { simulatePath } from '../utils/simulator'

const store = useEditorStore()
const canvasRef = ref(null)
let paths = []
let scale = 1
let offsetX = 0, offsetY = 0
let isDragging = false, dragStartX = 0, dragStartY = 0

function updateSimulation() {
  if (!store.rawText || !store.lines.length) return
  paths = simulatePath(store.lines)
  drawPaths()
}

function computeBounds() {
  if (!paths.length) return { minX: -100, maxX: 100, minY: -100, maxY: 100 }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const p of paths) {
    if (p.x1 < minX) minX = p.x1; if (p.x1 > maxX) maxX = p.x1
    if (p.x2 < minX) minX = p.x2; if (p.x2 > maxX) maxX = p.x2
    if (p.y1 < minY) minY = p.y1; if (p.y1 > maxY) maxY = p.y1
    if (p.y2 < minY) minY = p.y2; if (p.y2 > maxY) maxY = p.y2
  }
  const pad = Math.max((maxX - minX) * 0.1, (maxY - minY) * 0.1, 10)
  return { minX: minX - pad, maxX: maxX + pad, minY: minY - pad, maxY: maxY + pad }
}

function drawPaths() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)

  if (!paths.length) {
    ctx.fillStyle = '#6c7086'
    ctx.font = '14px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('請開啟 NC 檔案以顯示路徑', w / 2, h / 2)
    return
  }

  const bounds = computeBounds()
  const rangeX = bounds.maxX - bounds.minX
  const rangeY = bounds.maxY - bounds.minY
  scale = Math.min(w / rangeX, h / rangeY) * 0.85

  offsetX = (w - (bounds.maxX + bounds.minX) * scale) / 2
  offsetY = (h + (bounds.maxY + bounds.minY) * scale) / 2

  const toScreen = (x, y) => [x * scale + offsetX, -y * scale + offsetY]

  ctx.strokeStyle = '#313244'
  ctx.lineWidth = 0.5
  const gridStep = 50
  const gxStart = Math.floor(bounds.minX / gridStep) * gridStep
  const gyStart = Math.floor(bounds.minY / gridStep) * gridStep
  for (let gx = gxStart; gx <= bounds.maxX; gx += gridStep) {
    const [sx] = toScreen(gx, 0)
    ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, h); ctx.stroke()
  }
  for (let gy = gyStart; gy <= bounds.maxY; gy += gridStep) {
    const [, sy] = toScreen(0, gy)
    ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(w, sy); ctx.stroke()
  }

  for (const p of paths) {
    const [x1, y1] = toScreen(p.x1, p.y1)
    const [x2, y2] = toScreen(p.x2, p.y2)

    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)

    if (p.cycle) {
      ctx.fillStyle = '#f9e2af'
      ctx.arc(x2, y2, 3, 0, Math.PI * 2)
      ctx.fill()
      continue
    }

    if (p.cutting) {
      ctx.strokeStyle = p.comp ? '#a6e3a1' : '#89b4fa'
      ctx.lineWidth = 2
      ctx.setLineDash([])
    } else {
      ctx.strokeStyle = '#585b70'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
    }
    ctx.stroke()
  }

  const [ox, oy] = toScreen(0, 0)
  ctx.fillStyle = '#f38ba8'
  ctx.beginPath()
  ctx.arc(ox, oy, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#f38ba8'
  ctx.font = '11px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('(0,0)', ox + 6, oy + 4)
}

function onMouseDown(e) {
  isDragging = true
  dragStartX = e.offsetX - offsetX
  dragStartY = e.offsetY - offsetY
}

function onMouseMove(e) {
  if (!isDragging) return
  offsetX = e.offsetX - dragStartX
  offsetY = e.offsetY - dragStartY
  drawPaths()
}

function onMouseUp() { isDragging = false }

function onWheel(e) {
  e.preventDefault()
  scale *= e.deltaY > 0 ? 0.9 : 1.1
  drawPaths()
}

watch(() => store.rawText, () => setTimeout(updateSimulation, 100))

function onResize() {
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * 2
  canvas.height = rect.height * 2
  canvas.style.width = rect.width + 'px'
  canvas.style.height = rect.height + 'px'
  drawPaths()
}

onMounted(() => {
  window.addEventListener('resize', onResize)
  onResize()
  if (store.rawText) updateSimulation()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <div class="sim-panel">
    <div class="sim-header">2D 路徑模擬</div>
    <canvas ref="canvasRef" class="sim-canvas" @mousedown="onMouseDown" @mousemove="onMouseMove" @mouseup="onMouseUp" @mouseleave="onMouseUp" @wheel.prevent="onWheel"></canvas>
    <div class="sim-hint">拖曳平移 | 滾輪縮放</div>
  </div>
</template>

<style scoped>
.sim-panel { height: 240px; min-height: 180px; border-top: 1px solid #313244; display: flex; flex-direction: column; background: #11111b; }
.sim-header { padding: 4px 12px; font-size: 12px; font-weight: 600; background: #181825; border-bottom: 1px solid #313244; }
.sim-canvas { flex: 1; cursor: grab; width: 100%; }
.sim-canvas:active { cursor: grabbing; }
.sim-hint { font-size: 11px; color: #6c7086; padding: 2px 12px; text-align: right; }
</style>
