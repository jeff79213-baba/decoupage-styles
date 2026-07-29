<script setup>
import { ref, onMounted, watch } from 'vue'
import { useEditorStore } from '../stores/editor'
const store = useEditorStore()
const canvasRef = ref(null)

function drawCoordDiagram() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)

  if (!store.coordinates.length) {
    ctx.fillStyle = '#6c7086'
    ctx.font = '13px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('無座標系資料', w / 2, h / 2)
    return
  }

  ctx.strokeStyle = '#313244'
  ctx.lineWidth = 1
  for (let x = 0; x <= w; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
  }
  for (let y = 0; y <= h; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
  }

  ctx.fillStyle = '#6c7086'
  ctx.font = '11px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('(0,0)', 4, h - 6)

  const colors = ['#89b4fa', '#a6e3a1', '#f9e2af', '#f38ba8', '#cba6f7', '#94e2d5']
  store.coordinates.forEach((c, i) => {
    const col = i % 4
    const row = Math.floor(i / 4)
    const x = 40 + col * 55
    const y = 40 + row * 40
    ctx.fillStyle = colors[i % colors.length]
    ctx.beginPath()
    ctx.arc(x, y, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.font = '11px sans-serif'
    ctx.fillText(c.code, x + 8, y + 4)
  })
}

onMounted(() => {
  const canvas = canvasRef.value
  if (canvas) {
    canvas.width = canvas.clientWidth * 2
    canvas.height = canvas.clientHeight * 2
    canvas.style.width = canvas.clientWidth + 'px'
    canvas.style.height = canvas.clientHeight + 'px'
    drawCoordDiagram()
  }
})

watch(() => store.coordinates.length, () => {
  setTimeout(drawCoordDiagram, 50)
})
</script>

<template>
  <div class="coord-viewer">
    <div class="coord-header">座標系</div>
    <table v-if="store.coordinates.length">
      <thead>
        <tr><th>座標系</th><th>行號</th></tr>
      </thead>
      <tbody>
        <tr v-for="c in store.coordinates" :key="c.code + c.line">
          <td>{{ c.code }}</td>
          <td>{{ c.line }}</td>
        </tr>
      </tbody>
    </table>
    <div v-else class="empty">無座標系資料</div>
    <canvas ref="canvasRef" class="coord-canvas"></canvas>
  </div>
</template>

<style scoped>
.coord-viewer { font-size: 12px; }
.coord-header { font-size: 13px; font-weight: 600; margin-bottom: 8px; }
table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
th, td { padding: 4px 6px; text-align: left; border-bottom: 1px solid #313244; }
th { color: #a6adc8; font-size: 11px; }
tr:hover td { background: #31324455; }
.coord-canvas { width: 100%; height: 180px; border: 1px solid #313244; border-radius: 4px; }
.empty { color: #6c7086; padding: 20px; text-align: center; font-size: 13px; }
</style>
