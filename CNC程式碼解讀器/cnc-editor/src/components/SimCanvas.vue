<script setup>
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue'
import { useEditorStore } from '../stores/editor'
import { simulatePath, getPositionAtLine } from '../utils/simulator'

const store = useEditorStore()
const canvasRef = ref(null)
let allPaths = []
let scale = 1
let offsetX = 0, offsetY = 0
let isDragging = false, dragStartX = 0, dragStartY = 0
const selectedCoord = ref('')

const activeBlock = computed(() => {
  if (store.currentLine < 0 || !store.blocks.length) return null
  return store.blocks.find(b => store.currentLine >= b.startLine - 1 && store.currentLine <= b.endLine - 1) || null
})

const visiblePaths = computed(() => {
  if (!activeBlock.value || !allPaths.length) return []
  const start = activeBlock.value.startLine - 1
  const end = activeBlock.value.endLine - 1
  return allPaths.filter(p => p.line >= start && p.line <= end)
})

const currentPathIndex = computed(() => {
  if (!visiblePaths.value.length || store.currentLine < 0) return -1
  return visiblePaths.value.findIndex(p => p.line === store.currentLine)
})

const coordPaths = computed(() => {
  if (!selectedCoord.value || !allPaths.length) return []
  return allPaths.filter(p => p.coord === selectedCoord.value)
})

const coordColors = ['#89b4fa', '#a6e3a1', '#f9e2af', '#f38ba8', '#cba6f7', '#94e2d5', '#fab387', '#eba0ac']

function updateSimulation() {
  if (!store.activeFile?.rawText || !store.lines.length) { allPaths = []; drawPaths(); return }
  allPaths = simulatePath(store.lines, store.lineCoords)
  drawPaths()
}

function computeBounds(paths) {
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
  ctx.save()
  const dpr = devicePixelRatio || 1
  ctx.scale(dpr, dpr)
  const cw = w / dpr
  const ch = h / dpr

  if (!allPaths.length) {
    ctx.fillStyle = '#6c7086'
    ctx.font = '14px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('請開啟 NC 檔案以顯示路徑', cw / 2, ch / 2)
    ctx.restore()
    return
  }

  let displayPaths
  let colorByBlock = false
  if (selectedCoord.value) {
    displayPaths = coordPaths.value
    colorByBlock = true
  } else {
    displayPaths = visiblePaths.value.length ? visiblePaths.value : allPaths
  }

  const bounds = computeBounds(displayPaths)
  const rangeX = bounds.maxX - bounds.minX
  const rangeY = bounds.maxY - bounds.minY
  scale = Math.min(cw / rangeX, ch / rangeY) * 0.85

  offsetX = (cw - (bounds.maxX + bounds.minX) * scale) / 2
  offsetY = (ch + (bounds.maxY + bounds.minY) * scale) / 2

  const toScreen = (x, y) => [x * scale + offsetX, -y * scale + offsetY]

  ctx.strokeStyle = '#313244'
  ctx.lineWidth = 0.5
  const gridStep = 50
  const gxStart = Math.floor(bounds.minX / gridStep) * gridStep
  const gyStart = Math.floor(bounds.minY / gridStep) * gridStep
  for (let gx = gxStart; gx <= bounds.maxX; gx += gridStep) {
    const [sx] = toScreen(gx, 0)
    ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, ch); ctx.stroke()
  }
  for (let gy = gyStart; gy <= bounds.maxY; gy += gridStep) {
    const [, sy] = toScreen(0, gy)
    ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(cw, sy); ctx.stroke()
  }

  const blockColorFor = (p) => {
    const idx = store.blocks.findIndex(b => p.line >= b.startLine - 1 && p.line <= b.endLine - 1)
    return coordColors[(idx >= 0 ? idx : 0) % coordColors.length]
  }

  const drawSegment = (p, color, width, dash) => {
    if (p.cycle) {
      const [cx, cy] = toScreen(p.x2, p.y2)
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(cx, cy, 3, 0, Math.PI * 2)
      ctx.fill()
      return
    }
    const [x1, y1] = toScreen(p.x1, p.y1)
    const [x2, y2] = toScreen(p.x2, p.y2)
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.setLineDash(dash || [])
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
    ctx.setLineDash([])
  }

  if (selectedCoord.value) {
    for (const p of displayPaths) {
      if (p.cutting) {
        drawSegment(p, blockColorFor(p), 2, [])
      } else {
        drawSegment(p, '#585b70', 1, [4, 4])
      }
    }
  } else if (activeBlock.value && visiblePaths.value.length) {
    for (let i = 0; i < visiblePaths.value.length; i++) {
      const p = visiblePaths.value[i]
      const isCurrent = (i === currentPathIndex.value)
      if (isCurrent) {
        drawSegment(p, '#f9e2af', 4, [])
      } else if (p.cutting) {
        drawSegment(p, p.comp ? '#a6e3a1' : '#89b4fa', 2, [])
      } else {
        drawSegment(p, '#585b70', 1, [4, 4])
      }
    }
  } else {
    for (const p of allPaths) {
      if (p.cutting) {
        drawSegment(p, p.comp ? '#a6e3a1' : '#89b4fa', 1.5, [])
      } else {
        drawSegment(p, '#585b70', 0.8, [4, 4])
      }
    }
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

  if (store.currentLine >= 0 && store.lines.length && !selectedCoord.value) {
    const pos = getPositionAtLine(store.lines, store.currentLine)
    const [px, py] = toScreen(pos.x, pos.y)
    ctx.save()
    ctx.fillStyle = '#f9e2af'
    ctx.strokeStyle = '#f38ba8'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(px, py, 6, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#11111b'
    ctx.font = 'bold 9px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('●', px, py)
    ctx.restore()
  }
  ctx.restore()
}

function mousePos(e) {
  const rect = canvasRef.value.getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

function onMouseDown(e) {
  isDragging = true
  const p = mousePos(e)
  dragStartX = p.x - offsetX
  dragStartY = p.y - offsetY
}

function onMouseMove(e) {
  if (!isDragging) return
  const p = mousePos(e)
  offsetX = p.x - dragStartX
  offsetY = p.y - dragStartY
  drawPaths()
}

function onMouseUp() { isDragging = false }

function onWheel(e) {
  e.preventDefault()
  scale *= e.deltaY > 0 ? 0.9 : 1.1
  drawPaths()
}

watch(() => store.activeFile?.rawText, () => setTimeout(updateSimulation, 100))

watch(() => store.currentLine, () => { drawPaths() })

watch(selectedCoord, () => { drawPaths() })

let resizeObserver = null

function fitCanvas() {
  const canvas = canvasRef.value
  if (!canvas) return
  const parent = canvas.parentElement
  if (!parent) return
  const w = parent.clientWidth
  const h = parent.clientHeight
  canvas.width = w * devicePixelRatio
  canvas.height = h * devicePixelRatio
  canvas.style.width = w + 'px'
  canvas.style.height = h + 'px'
  drawPaths()
}

onMounted(() => {
  resizeObserver = new ResizeObserver(fitCanvas)
  if (canvasRef.value?.parentElement) {
    resizeObserver.observe(canvasRef.value.parentElement)
  }
  fitCanvas()
  if (store.activeFile?.rawText) updateSimulation()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})
</script>

<template>
  <div class="sim-panel">
    <div class="sim-header">
      <span>2D 路徑模擬</span>
      <select v-model="selectedCoord" class="coord-select">
        <option value="">全部座標系</option>
        <option v-for="c in store.coordinates" :key="c.code" :value="c.code">{{ c.code }}</option>
      </select>
    </div>
    <canvas ref="canvasRef" class="sim-canvas" @mousedown="onMouseDown" @mousemove="onMouseMove" @mouseup="onMouseUp" @mouseleave="onMouseUp" @wheel.prevent="onWheel"></canvas>
    <div class="sim-hint">拖曳平移 | 滾輪縮放 | 座標系模式以顏色區分加工區域</div>
  </div>
</template>

<style scoped>
.sim-panel { flex: 0 0 35%; min-height: 150px; border-top: 1px solid #313244; display: flex; flex-direction: column; background: #11111b; }
.sim-header { padding: 4px 12px; font-size: 12px; font-weight: 600; background: #181825; border-bottom: 1px solid #313244; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.coord-select { font-size: 12px; padding: 2px 6px; background: #313244; color: #cdd6f4; border: 1px solid #45475a; border-radius: 4px; }
.sim-canvas { flex: 1; cursor: grab; width: 100%; }
.sim-canvas:active { cursor: grabbing; }
.sim-hint { font-size: 11px; color: #6c7086; padding: 2px 12px; text-align: right; }
</style>
