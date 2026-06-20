// ===== CONSTANTS =====
const SHAPES = ['circle', 'triangle', 'square', 'star', 'diamond'];
const SHAPE_LABELS = { circle: '●', triangle: '▲', square: '■', star: '★', diamond: '◆' };
const COLORS = ['#ff6b6b', '#4ecdc4', '#ffd93d', '#6c5ce7', '#a8e6cf', '#ff8a5c', '#3dc1d3', '#f8a5c2', '#63cdda', '#cf6a87'];

// ===== PROJECT DATA =====
let project = {
  stage: { width: 1000, height: 700 },
  dancers: [],
  bars: [],
  bpm: 120,
  currentBarIndex: 0,
  currentPage: 0,
  isPlaying: false,
  playTimer: null,
  view: { scale: 1, panX: 0, panY: 0 }
};

// ===== STATE =====
let dragState = null;
let detailMode = false;
let detailBarIndex = -1;
let detailKeyframeIndex = 0;
let detailKeyframes = [];
let pinchState = null;
let isPinching = false;
const BARS_PER_PAGE = 8;
const BEATS_PER_BAR = 8;
let newBarCallback = null;

// ===== DOM REFS =====
const canvas = document.getElementById('stageCanvas');
const ctx = canvas.getContext('2d');
const detailCanvas = document.getElementById('detailCanvas');
const dCtx = detailCanvas.getContext('2d');
const dancerList = document.getElementById('dancerList');
const tlBars = document.getElementById('tlBars');
const tlPageInfo = document.getElementById('tlPageInfo');
const barTitle = document.getElementById('barTitle');
const bpmSlider = document.getElementById('bpmSlider');
const bpmLabel = document.getElementById('bpmLabel');
const btnPlay = document.getElementById('btnPlay');
const stageW = document.getElementById('stageW');
const stageH = document.getElementById('stageH');

// ===== HELPERS =====
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// ===== VIEW TRANSFORM HELPERS =====
function clientToCanvas(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / rect.width;
  const sy = canvas.height / rect.height;
  return { x: (clientX - rect.left) * sx, y: (clientY - rect.top) * sy };
}

function screenToWorld(screenX, screenY) {
  const v = project.view;
  return {
    x: (screenX - v.panX) / v.scale,
    y: (screenY - v.panY) / v.scale
  };
}

// ===== DRAW SHAPES =====
function drawShape(ctx, x, y, r, shape, color, alpha) {
  alpha = alpha || 1;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();

  switch (shape) {
    case 'circle':
      ctx.arc(x, y, r, 0, Math.PI * 2);
      break;
    case 'triangle':
      ctx.moveTo(x, y - r);
      ctx.lineTo(x - r * 0.866, y + r * 0.5);
      ctx.lineTo(x + r * 0.866, y + r * 0.5);
      ctx.closePath();
      break;
    case 'square':
      ctx.rect(x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6);
      break;
    case 'star': {
      for (let i = 0; i < 10; i++) {
        const angle = (i * Math.PI * 2) / 10 - Math.PI / 2;
        const radius = i % 2 === 0 ? r : r * 0.4;
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    case 'diamond':
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r * 0.7, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r * 0.7, y);
      ctx.closePath();
      break;
  }

  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawDancerLabel(ctx, x, y, name, alpha) {
  alpha = alpha || 1;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(name, x, y + 22);
  ctx.restore();
}

// ===== PROJECT INIT =====
function initProject() {
  if (project.dancers.length === 0) {
    addDancer('舞者A', COLORS[0], 'circle');
    addDancer('舞者B', COLORS[1], 'triangle');
    addDancer('舞者C', COLORS[2], 'square');
  }
  if (project.bars.length === 0) {
    for (let i = 1; i <= 8; i++) addBar(i);
  }
  project.currentBarIndex = 0;
  project.currentPage = 0;
}

// ===== DANCER MANAGEMENT =====
function addDancer(name, color, shape) {
  const d = { id: uid(), name: name || '舞者', color: color || COLORS[0], shape: shape || 'circle' };
  project.dancers.push(d);
  project.bars.forEach(bar => {
    bar.positions[d.id] = { x: project.stage.width / 2, y: project.stage.height / 2 };
    if (bar.keyframes) {
      bar.keyframes.forEach(kf => {
        if (!kf.positions[d.id]) {
          kf.positions[d.id] = { x: project.stage.width / 2, y: project.stage.height / 2 };
        }
      });
    }
  });
  return d;
}

function removeDancer(id) {
  project.dancers = project.dancers.filter(d => d.id !== id);
  project.bars.forEach(bar => {
    delete bar.positions[id];
    if (bar.keyframes) {
      bar.keyframes.forEach(kf => delete kf.positions[id]);
    }
  });
  renderAll();
}

function updateDancer(id, data) {
  const d = project.dancers.find(d => d.id === id);
  if (d) Object.assign(d, data);
  renderAll();
}

// ===== BAR MANAGEMENT =====
function addBar(number, copyFromLast) {
  let positions;
  if (copyFromLast && project.bars.length > 0) {
    const lastBar = project.bars[project.bars.length - 1];
    positions = JSON.parse(JSON.stringify(lastBar.positions));
  } else {
    positions = {};
    project.dancers.forEach(d => {
      positions[d.id] = { x: project.stage.width / 2, y: project.stage.height / 2 };
    });
  }
  const bar = {
    id: uid(),
    number: number || project.bars.length + 1,
    positions: positions,
    keyframes: [{ beat: 1, positions: JSON.parse(JSON.stringify(positions)) }]
  };
  project.bars.push(bar);
  return bar;
}

function removeBar(index) {
  if (project.bars.length <= 1) return;
  project.bars.splice(index, 1);
  project.bars.forEach((b, i) => b.number = i + 1);
  if (project.currentBarIndex >= project.bars.length) {
    project.currentBarIndex = project.bars.length - 1;
  }
  renderAll();
}

// ===== CANVAS RENDERING =====
function resizeCanvas() {
  const wrap = document.getElementById('stageWrap');
  if (!wrap) return;
  const rect = wrap.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
}

function renderStage() {
  resizeCanvas();
  const w = canvas.width, h = canvas.height;
  const bar = project.bars[project.currentBarIndex];
  if (!bar) return;

  ctx.clearRect(0, 0, w, h);

  // background
  ctx.fillStyle = '#0a0a18';
  ctx.fillRect(0, 0, w, h);

  // apply view transform
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(project.view.panX, project.view.panY);
  ctx.scale(project.view.scale, project.view.scale);

  // stage area (centered with padding)
  const padding = 40;
  const sw = w - padding * 2;
  const sh = h - padding * 2;
  const sx = padding;
  const sy = padding;

  // stage floor
  ctx.fillStyle = '#1a1a2e';
  ctx.shadowColor = 'rgba(78, 205, 196, 0.1)';
  ctx.shadowBlur = 20;
  ctx.fillRect(sx, sy, sw, sh);
  ctx.shadowBlur = 0;

  // grid
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  const gridSize = 50;
  for (let x = 0; x <= project.stage.width; x += gridSize) {
    const px = sx + (x / project.stage.width) * sw;
    ctx.beginPath();
    ctx.moveTo(px, sy);
    ctx.lineTo(px, sy + sh);
    ctx.stroke();
  }
  for (let y = 0; y <= project.stage.height; y += gridSize) {
    const py = sy + (y / project.stage.height) * sh;
    ctx.beginPath();
    ctx.moveTo(sx, py);
    ctx.lineTo(sx + sw, py);
    ctx.stroke();
  }

  // center cross
  ctx.strokeStyle = 'rgba(78, 205, 196, 0.15)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 6]);
  const cx = sx + sw / 2;
  const cy = sy + sh / 2;
  ctx.beginPath();
  ctx.moveTo(cx, sy);
  ctx.lineTo(cx, sy + sh);
  ctx.moveTo(sx, cy);
  ctx.lineTo(sx + sw, cy);
  ctx.stroke();
  ctx.setLineDash([]);

  // stage border
  ctx.strokeStyle = 'rgba(78, 205, 196, 0.3)';
  ctx.lineWidth = 2;
  ctx.strokeRect(sx, sy, sw, sh);

  // front edge (thicker line at bottom = audience side)
  ctx.strokeStyle = 'rgba(78, 205, 196, 0.5)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(sx, sy + sh);
  ctx.lineTo(sx + sw, sy + sh);
  ctx.stroke();

  // "觀眾" label
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('⬇ 觀眾席', sx + sw / 2, sy + sh + 16);

  // draw dancers
  Object.keys(bar.positions).forEach(dancerId => {
    const dancer = project.dancers.find(d => d.id === dancerId);
    if (!dancer) return;
    const pos = bar.positions[dancerId];
    if (!pos) return;

    const px = sx + (pos.x / project.stage.width) * sw;
    const py = sy + (pos.y / project.stage.height) * sh;
    const r = Math.min(18, Math.min(sw, sh) * 0.025);

    drawShape(ctx, px, py, r, dancer.shape, dancer.color, 1);
    drawDancerLabel(ctx, px, py, dancer.name, 1);
  });

  ctx.restore();

  // bar title
  barTitle.textContent = `第 ${bar.number} 小節`;
}

function renderMiniBar(cvs, bar, dancers) {
  const w = cvs.width, h = cvs.height;
  const c = cvs.getContext('2d');
  c.clearRect(0, 0, w, h);

  const pad = 4;
  const sw = w - pad * 2;
  const sh = h - pad * 2;

  // stage bg
  c.fillStyle = '#16162a';
  c.fillRect(pad, pad, sw, sh);

  // stage border
  c.strokeStyle = 'rgba(255,255,255,0.15)';
  c.lineWidth = 1;
  c.strokeRect(pad, pad, sw, sh);

  dancers.forEach(dancer => {
    const pos = bar.positions[dancer.id];
    if (!pos) return;
    const px = pad + (pos.x / project.stage.width) * sw;
    const py = pad + (pos.y / project.stage.height) * sh;
    const r = Math.max(3, Math.min(sw, sh) * 0.035);
    drawShape(c, px, py, r, dancer.shape, dancer.color, 0.8);
  });
}

function renderTimeline() {
  const totalPages = Math.max(1, Math.ceil(project.bars.length / BARS_PER_PAGE));
  if (project.currentPage >= totalPages) project.currentPage = totalPages - 1;

  const startIdx = project.currentPage * BARS_PER_PAGE;
  const endIdx = Math.min(startIdx + BARS_PER_PAGE, project.bars.length);

  tlBars.innerHTML = '';
  for (let i = startIdx; i < endIdx; i++) {
    const bar = project.bars[i];
    const div = document.createElement('div');
    div.className = 'tl-bar' + (i === project.currentBarIndex ? ' active' : '');
    div.dataset.index = i;

    const num = document.createElement('span');
    num.className = 'tl-bar-num';
    num.textContent = bar.number;
    div.appendChild(num);

    const cvs = document.createElement('canvas');
    cvs.className = 'tl-bar-canvas';
    cvs.width = 68;
    cvs.height = 48;
    div.appendChild(cvs);

    renderMiniBar(cvs, bar, project.dancers);

    let _tapTimer = null;
    div.addEventListener('click', () => {
      if (_tapTimer) {
        clearTimeout(_tapTimer); _tapTimer = null;
        openDetail(i);
      } else {
        _tapTimer = setTimeout(() => { _tapTimer = null; selectBar(i); }, 280);
      }
    });

    tlBars.appendChild(div);
  }

  tlPageInfo.textContent = `${project.currentPage + 1} / ${totalPages}`;
}

function renderDancerList() {
  dancerList.innerHTML = '';
  project.dancers.forEach(dancer => {
    const div = document.createElement('div');
    div.className = 'dancer-item';
    div.dataset.id = dancer.id;

    // icon
    const icon = document.createElement('div');
    icon.className = 'dancer-icon';
    const ic = document.createElement('canvas');
    ic.width = 24;
    ic.height = 24;
    icon.appendChild(ic);
    drawShape(ic.getContext('2d'), 12, 12, 9, dancer.shape, dancer.color, 1);

    // name
    const name = document.createElement('span');
    name.className = 'dancer-name';
    name.textContent = dancer.name;

    // color picker
    const cp = document.createElement('input');
    cp.type = 'color';
    cp.className = 'color-picker';
    cp.value = dancer.color;
    cp.addEventListener('input', e => {
      updateDancer(dancer.id, { color: e.target.value });
    });

    // shape select
    const ss = document.createElement('select');
    ss.className = 'shape-select';
    SHAPES.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = SHAPE_LABELS[s];
      if (s === dancer.shape) opt.selected = true;
      ss.appendChild(opt);
    });
    ss.addEventListener('change', e => {
      updateDancer(dancer.id, { shape: e.target.value });
    });

    // delete
    const del = document.createElement('button');
    del.textContent = '✕';
    del.addEventListener('click', e => {
      e.stopPropagation();
      if (project.dancers.length > 1) removeDancer(dancer.id);
    });

    const ctrl = document.createElement('div');
    ctrl.className = 'dancer-controls';
    ctrl.appendChild(cp);
    ctrl.appendChild(ss);
    ctrl.appendChild(del);

    div.appendChild(icon);
    div.appendChild(name);
    div.appendChild(ctrl);

    // drag
    div.addEventListener('pointerdown', e => {
      if (e.target !== del && e.target !== cp && e.target !== ss) {
        startDragFromSidebar(e, dancer);
      }
    });
    div.addEventListener('touchstart', e => {
      if (e.target !== del && e.target !== cp && e.target !== ss) {
        startDragFromSidebar(e, dancer);
      }
    }, { passive: false });

    dancerList.appendChild(div);
  });
}

function renderAll() {
  renderDancerList();
  renderStage();
  renderTimeline();
}

// ===== BAR SELECTION =====
function selectBar(index) {
  if (index < 0 || index >= project.bars.length) return;
  project.currentBarIndex = index;
  renderAll();
}

function goToBar(delta) {
  const idx = project.currentBarIndex + delta;
  if (idx >= 0 && idx < project.bars.length) {
    selectBar(idx);
  }
}

// ===== DRAG & DROP =====
function startDragFromSidebar(e, dancer) {
  if (dragState) return;
  e.preventDefault();
  const ghost = document.createElement('div');
  ghost.className = 'drag-ghost';
  const gc = document.createElement('canvas');
  gc.width = 48;
  gc.height = 48;
  ghost.appendChild(gc);
  drawShape(gc.getContext('2d'), 24, 24, 18, dancer.shape, dancer.color, 1);
  document.body.appendChild(ghost);

  dragState = {
    type: 'new',
    dancerId: dancer.id,
    ghost: ghost,
    offsetX: 24,
    offsetY: 24
  };

  moveGhost(e);
}

function moveGhost(e) {
  if (!dragState) return;
  const g = dragState.ghost;
  const x = e.clientX || (e.touches && e.touches[0].clientX);
  const y = e.clientY || (e.touches && e.touches[0].clientY);
  if (x !== undefined) g.style.left = x + 'px';
  if (y !== undefined) g.style.top = y + 'px';
}

function endDrag(e) {
  if (!dragState) return;
  const x = e.clientX || (e.changedTouches && e.changedTouches[0].clientX);
  const y = e.clientY || (e.changedTouches && e.changedTouches[0].clientY);

  if (dragState.ghost) {
    document.body.removeChild(dragState.ghost);
  }

  // check if drop on canvas
  const rect = canvas.getBoundingClientRect();
  if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
    const cc = clientToCanvas(x, y);
    const wc = screenToWorld(cc.x, cc.y);

    const padding = 40;
    const sw = canvas.width - padding * 2;
    const sh = canvas.height - padding * 2;

    const stageX = ((wc.x - padding) / sw) * project.stage.width;
    const stageY = ((wc.y - padding) / sh) * project.stage.height;

    const bar = project.bars[project.currentBarIndex];
    bar.positions[dragState.dancerId] = { x: stageX, y: stageY };

    if (bar.keyframes) {
      bar.keyframes.forEach(kf => {
        if (kf.positions[dragState.dancerId]) {
          kf.positions[dragState.dancerId] = { x: stageX, y: stageY };
        }
      });
    }

    renderAll();
  }

  dragState = null;
}

// ===== CANVAS DRAG & DOUBLE-TAP ZOOM RESET =====
let canvasDrag = null;
let lastTapTime = 0;
let lastTapPos = null;

canvas.addEventListener('pointerdown', e => {
  if (project.isPlaying || isPinching) return;

  const cc = clientToCanvas(e.clientX, e.clientY);
  const wc = screenToWorld(cc.x, cc.y);

  // double-tap detection for zoom reset
  const now = Date.now();
  if (lastTapPos && (now - lastTapTime < 350) &&
      Math.abs(wc.x - lastTapPos.x) < 30 && Math.abs(wc.y - lastTapPos.y) < 30) {
    lastTapTime = 0; lastTapPos = null;
    project.view.scale = 1; project.view.panX = 0; project.view.panY = 0;
    renderStage();
    return;
  }
  lastTapTime = now;
  lastTapPos = { x: wc.x, y: wc.y };

  // dancer hit test
  const hit = hitTestDancer(wc.x, wc.y);
  if (hit) {
    canvasDrag = { dancerId: hit.dancerId };
    canvas.style.cursor = 'grabbing';
    canvas.setPointerCapture(e.pointerId);
  }
});

canvas.addEventListener('pointermove', e => {
  if (!canvasDrag || isPinching) return;
  const cc = clientToCanvas(e.clientX, e.clientY);
  const wc = screenToWorld(cc.x, cc.y);

  const padding = 40;
  const sw = canvas.width - padding * 2;
  const sh = canvas.height - padding * 2;

  const stageX = ((wc.x - padding) / sw) * project.stage.width;
  const stageY = ((wc.y - padding) / sh) * project.stage.height;

  const bar = project.bars[project.currentBarIndex];
  bar.positions[canvasDrag.dancerId] = { x: stageX, y: stageY };

  renderStage();
});

canvas.addEventListener('pointerup', e => {
  if (canvasDrag && !isPinching) {
    canvasDrag = null;
    canvas.style.cursor = 'default';
    renderAll();
  }
});

canvas.addEventListener('pointercancel', e => {
  canvasDrag = null;
  canvas.style.cursor = 'default';
});

// ===== PINCH TO ZOOM (touch only) =====
canvas.addEventListener('touchstart', e => {
  if (e.touches.length >= 2) {
    isPinching = true;
    canvasDrag = null;
    canvas.style.cursor = 'default';
    e.preventDefault();
    const t = e.touches;
    pinchState = {
      baseDist: Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY),
      baseScale: project.view.scale,
      basePanX: project.view.panX,
      basePanY: project.view.panY,
      baseMidX: (t[0].clientX + t[1].clientX) / 2,
      baseMidY: (t[0].clientY + t[1].clientY) / 2
    };
  }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  if (!pinchState || e.touches.length < 2) { e.preventDefault(); return; }
  e.preventDefault();
  const t = e.touches;
  const dist = Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const midX = (t[0].clientX + t[1].clientX) / 2;
  const midY = (t[0].clientY + t[1].clientY) / 2;

  const newScale = clamp(pinchState.baseScale * (dist / pinchState.baseDist), 0.2, 5);

  const cc = clientToCanvas(midX, midY);
  const wc = screenToWorld(cc.x, cc.y);
  project.view.scale = newScale;
  project.view.panX = cc.x - wc.x * newScale;
  project.view.panY = cc.y - wc.y * newScale;

  renderStage();
}, { passive: false });

canvas.addEventListener('touchend', e => {
  if (e.touches.length < 2) {
    isPinching = false;
    pinchState = null;
  }
});

function hitTestDancer(x, y) {
  const bar = project.bars[project.currentBarIndex];
  if (!bar) return null;

  const padding = 40;
  const sw = canvas.width - padding * 2;
  const sh = canvas.height - padding * 2;
  const sx = padding, sy = padding;

  const hitRadius = 25;

  for (let i = project.dancers.length - 1; i >= 0; i--) {
    const dancer = project.dancers[i];
    const pos = bar.positions[dancer.id];
    if (!pos) continue;

    const px = sx + (pos.x / project.stage.width) * sw;
    const py = sy + (pos.y / project.stage.height) * sh;
    const dx = x - px, dy = y - py;

    if (dx * dx + dy * dy < hitRadius * hitRadius) {
      return { dancerId: dancer.id, px, py };
    }
  }
  return null;
}

// ===== GLOBAL POINTER EVENTS =====
document.addEventListener('pointermove', moveGhost);
document.addEventListener('pointerup', endDrag);

// Touch events for sidebar drag
document.addEventListener('touchmove', e => {
  if (dragState) {
    moveGhost(e);
    e.preventDefault();
  }
}, { passive: false });

document.addEventListener('touchend', e => {
  if (dragState) endDrag(e);
});
document.addEventListener('touchcancel', e => {
  if (dragState) {
    if (dragState.ghost) document.body.removeChild(dragState.ghost);
    dragState = null;
  }
});

// ===== PLAYBACK =====
function togglePlay() {
  if (project.isPlaying) {
    stopPlay();
  } else {
    startPlay();
  }
}

function startPlay() {
  if (project.bars.length === 0) return;
  project.isPlaying = true;
  btnPlay.textContent = '⏸';
  btnPlay.classList.add('playing');
  project.currentBarIndex = 0;
  renderAll();

  const tickDuration = (60000 / project.bpm) / 4;
  let globalBeat = 0;
  let totalBeats = project.bars.length * BEATS_PER_BAR;

  project.playTimer = setInterval(() => {
    if (globalBeat >= totalBeats) { stopPlay(); return; }

    const barIdx = Math.floor(globalBeat / BEATS_PER_BAR);
    const beatInBar = globalBeat % BEATS_PER_BAR;
    const bar = project.bars[barIdx];
    if (!bar) { globalBeat++; return; }

    if (barIdx !== project.currentBarIndex) {
      project.currentBarIndex = barIdx;
      renderTimeline();
    }

    // interpolate between keyframes within this bar
    const kfs = bar.keyframes || [];
    if (kfs.length > 1) {
      let prevKF = kfs[0], nextKF = kfs[kfs.length - 1];
      for (let i = 0; i < kfs.length - 1; i++) {
        if (beatInBar + 1 >= kfs[i].beat && beatInBar + 1 < kfs[i + 1].beat) {
          prevKF = kfs[i]; nextKF = kfs[i + 1]; break;
        }
      }
      const range = nextKF.beat - prevKF.beat;
      const t = range > 0 ? clamp((beatInBar + 1 - prevKF.beat) / range, 0, 1) : 0;

      project.dancers.forEach(d => {
        const p1 = prevKF.positions[d.id];
        const p2 = nextKF.positions[d.id];
        if (p1 && p2) {
          bar.positions[d.id] = {
            x: lerp(p1.x, p2.x, t),
            y: lerp(p1.y, p2.y, t)
          };
        }
      });
    }

    renderStage();
    barTitle.textContent = `第 ${bar.number} 小節・${beatInBar + 1}拍`;
    globalBeat++;
  }, tickDuration);
}

function stopPlay() {
  project.isPlaying = false;
  btnPlay.textContent = '▶';
  btnPlay.classList.remove('playing');
  if (project.playTimer) {
    clearInterval(project.playTimer);
    project.playTimer = null;
  }
  renderAll();
}

// ===== DETAIL MODE =====
function openDetail(barIndex) {
  if (barIndex < 0 || barIndex >= project.bars.length) return;
  detailMode = true;
  detailBarIndex = barIndex;
  detailKeyframeIndex = 0;

  const bar = project.bars[barIndex];
  if (!bar.keyframes || bar.keyframes.length === 0) {
    bar.keyframes = [{ beat: 1, positions: JSON.parse(JSON.stringify(bar.positions)) }];
  }
  detailKeyframes = bar.keyframes;

  document.getElementById('detailOverlay').classList.remove('hidden');
  document.getElementById('detailBarTitle').textContent = `第 ${bar.number} 小節`;

  renderDetailCanvas();
  renderBeatTrack();
}

function closeDetail() {
  detailMode = false;
  document.getElementById('detailOverlay').classList.add('hidden');
  renderAll();
}

function renderDetailCanvas() {
  const rect = document.getElementById('detailContent').getBoundingClientRect();
  detailCanvas.width = rect.width;
  detailCanvas.height = rect.height;

  const w = detailCanvas.width, h = detailCanvas.height;
  const bar = project.bars[detailBarIndex];
  if (!bar) return;

  dCtx.clearRect(0, 0, w, h);

  // background
  dCtx.fillStyle = '#0a0a18';
  dCtx.fillRect(0, 0, w, h);

  const padding = 40;
  const sw = w - padding * 2;
  const sh = h - padding * 2;
  const sx = padding, sy = padding;

  // stage
  dCtx.fillStyle = '#1a1a2e';
  dCtx.shadowColor = 'rgba(78, 205, 196, 0.1)';
  dCtx.shadowBlur = 20;
  dCtx.fillRect(sx, sy, sw, sh);
  dCtx.shadowBlur = 0;

  // grid
  dCtx.strokeStyle = 'rgba(255,255,255,0.04)';
  dCtx.lineWidth = 1;
  for (let x = 0; x <= project.stage.width; x += 50) {
    const px = sx + (x / project.stage.width) * sw;
    dCtx.beginPath();
    dCtx.moveTo(px, sy);
    dCtx.lineTo(px, sy + sh);
    dCtx.stroke();
  }
  for (let y = 0; y <= project.stage.height; y += 50) {
    const py = sy + (y / project.stage.height) * sh;
    dCtx.beginPath();
    dCtx.moveTo(sx, py);
    dCtx.lineTo(sx + sw, py);
    dCtx.stroke();
  }

  dCtx.strokeStyle = 'rgba(78, 205, 196, 0.3)';
  dCtx.lineWidth = 2;
  dCtx.strokeRect(sx, sy, sw, sh);

  // draw movement paths
  if (detailKeyframes.length > 1) {
    const kf = detailKeyframes;
    project.dancers.forEach(dancer => {
      dCtx.strokeStyle = dancer.color + '40';
      dCtx.lineWidth = 2;
      dCtx.setLineDash([5, 5]);
      dCtx.beginPath();
      kf.forEach((frame, fi) => {
        const pos = frame.positions[dancer.id];
        if (!pos) return;
        const px = sx + (pos.x / project.stage.width) * sw;
        const py = sy + (pos.y / project.stage.height) * sh;
        fi === 0 ? dCtx.moveTo(px, py) : dCtx.lineTo(px, py);
      });
      dCtx.stroke();
      dCtx.setLineDash([]);
    });
  }

  // draw dancers (current keyframe)
  const kf = detailKeyframes[detailKeyframeIndex] || detailKeyframes[0];
  if (kf) {
    project.dancers.forEach(dancer => {
      const pos = kf.positions[dancer.id];
      if (!pos) return;
      const px = sx + (pos.x / project.stage.width) * sw;
      const py = sy + (pos.y / project.stage.height) * sh;
      const r = Math.min(22, Math.min(sw, sh) * 0.03);

      // highlight selected keyframe
      drawShape(dCtx, px, py, r, dancer.shape, dancer.color, 1);
      drawDancerLabel(dCtx, px, py, dancer.name, 1);
    });
  }

  // beat info
  const currentKF = detailKeyframes[detailKeyframeIndex];
  document.getElementById('detailBeatInfo').textContent = currentKF ? `第 ${currentKF.beat} 拍` : '';
}

function renderBeatTrack() {
  const container = document.getElementById('beatMarkers');
  container.innerHTML = '';

  for (let i = 1; i <= BEATS_PER_BAR; i++) {
    const div = document.createElement('div');
    div.className = 'beat-marker';
    div.textContent = i;
    div.dataset.beat = i;

    const hasKeyframe = detailKeyframes.some(kf => kf.beat === i);
    if (hasKeyframe) div.classList.add('active');

    div.addEventListener('click', () => selectBeat(i));
    container.appendChild(div);
  }

  // indicator
  const kf = detailKeyframes[detailKeyframeIndex];
  if (kf) {
    const pct = ((kf.beat - 1) / (BEATS_PER_BAR - 1)) * 100;
    document.getElementById('beatIndicator').style.left = pct + '%';
  }
}

function selectBeat(beat) {
  const idx = detailKeyframes.findIndex(kf => kf.beat === beat);
  if (idx >= 0) {
    detailKeyframeIndex = idx;
    renderDetailCanvas();
    renderBeatTrack();
  }
}

function addKeyframe() {
  const bar = project.bars[detailBarIndex];
  if (!bar) return;

  // find next available beat
  const usedBeats = detailKeyframes.map(kf => kf.beat);
  let newBeat = 1;
  for (let b = 1; b <= BEATS_PER_BAR; b++) {
    if (!usedBeats.includes(b)) { newBeat = b; break; }
  }

  // copy positions from last keyframe
  const lastKF = detailKeyframes[detailKeyframeIndex] || detailKeyframes[0];
  const positions = {};
  project.dancers.forEach(d => {
    positions[d.id] = lastKF.positions[d.id] ? { ...lastKF.positions[d.id] } : { x: project.stage.width / 2, y: project.stage.height / 2 };
  });

  detailKeyframes.push({ beat: newBeat, positions });
  detailKeyframes.sort((a, b) => a.beat - b.beat);
  detailKeyframeIndex = detailKeyframes.findIndex(kf => kf.beat === newBeat);

  // sync bar.positions with keyframe 0
  bar.positions = JSON.parse(JSON.stringify(detailKeyframes[0].positions));

  renderDetailCanvas();
  renderBeatTrack();
}

function removeKeyframe() {
  if (detailKeyframes.length <= 1) return;
  detailKeyframes.splice(detailKeyframeIndex, 1);
  if (detailKeyframeIndex >= detailKeyframes.length) {
    detailKeyframeIndex = detailKeyframes.length - 1;
  }
  renderDetailCanvas();
  renderBeatTrack();
}

// Drag on detail canvas
let detailDrag = null;

detailCanvas.addEventListener('pointerdown', e => {
  const rect = detailCanvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (detailCanvas.width / rect.width);
  const y = (e.clientY - rect.top) * (detailCanvas.height / rect.height);

  const kf = detailKeyframes[detailKeyframeIndex];
  if (!kf) return;

  const padding = 40;
  const sw = detailCanvas.width - padding * 2;
  const sh = detailCanvas.height - padding * 2;
  const sx = padding, sy = padding;
  const hitRadius = 25;

  for (let i = project.dancers.length - 1; i >= 0; i--) {
    const dancer = project.dancers[i];
    const pos = kf.positions[dancer.id];
    if (!pos) continue;

    const px = sx + (pos.x / project.stage.width) * sw;
    const py = sy + (pos.y / project.stage.height) * sh;
    const dx = x - px, dy = y - py;

    if (dx * dx + dy * dy < hitRadius * hitRadius) {
      detailDrag = { dancerId: dancer.id };
      detailCanvas.style.cursor = 'grabbing';
      return;
    }
  }
});

detailCanvas.addEventListener('pointermove', e => {
  if (!detailDrag) return;
  const rect = detailCanvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (detailCanvas.width / rect.width);
  const y = (e.clientY - rect.top) * (detailCanvas.height / rect.height);

  const padding = 40;
  const sw = detailCanvas.width - padding * 2;
  const sh = detailCanvas.height - padding * 2;
  const sx = padding, sy = padding;

  const stageX = ((x - sx) / sw) * project.stage.width;
  const stageY = ((y - sy) / sh) * project.stage.height;

  const kf = detailKeyframes[detailKeyframeIndex];
  if (kf && kf.positions[detailDrag.dancerId]) {
    kf.positions[detailDrag.dancerId] = { x: stageX, y: stageY };
    renderDetailCanvas();
  }
});

detailCanvas.addEventListener('pointerup', () => {
  if (detailDrag) {
    detailDrag = null;
    detailCanvas.style.cursor = 'default';
    renderDetailCanvas();
  }
});

detailCanvas.addEventListener('pointerleave', () => {
  if (detailDrag) {
    detailDrag = null;
    detailCanvas.style.cursor = 'default';
  }
});

// ===== EXPORT / IMPORT =====
function exportProject() {
  const data = JSON.stringify({
    stage: project.stage,
    dancers: project.dancers,
    bars: project.bars.map(b => ({
      number: b.number,
      positions: b.positions,
      keyframes: b.keyframes
    })),
    bpm: project.bpm
  }, null, 2);

  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `舞蹈編排_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importProject(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      project.stage = data.stage || { width: 1000, height: 700 };
      project.dancers = data.dancers || [];
      project.bars = data.bars || [];
      project.bpm = data.bpm || 120;
      project.currentBarIndex = 0;
      project.currentPage = 0;
      stopPlay();

      // migrate old format
      project.bars.forEach(b => {
        if (!b.keyframes) {
          b.keyframes = [{ beat: 1, positions: JSON.parse(JSON.stringify(b.positions)) }];
        }
      });

      bpmSlider.value = project.bpm;
      bpmLabel.textContent = project.bpm;
      stageW.value = project.stage.width;
      stageH.value = project.stage.height;

      project.stage = {
        width: parseInt(stageW.value),
        height: parseInt(stageH.value)
      };

      renderAll();
    } catch (err) {
      alert('匯入失敗：檔案格式錯誤');
    }
  };
  reader.readAsText(file);
}

// ===== EVENT BINDING =====
document.addEventListener('DOMContentLoaded', () => {
  initProject();
  renderAll();

  // Toolbar
  document.getElementById('btnFirst').addEventListener('click', () => selectBar(0));
  document.getElementById('btnPrev').addEventListener('click', () => goToBar(-1));
  document.getElementById('btnPlay').addEventListener('click', togglePlay);
  document.getElementById('btnNext').addEventListener('click', () => goToBar(1));
  document.getElementById('btnLast').addEventListener('click', () => selectBar(project.bars.length - 1));

  bpmSlider.addEventListener('input', e => {
    project.bpm = parseInt(e.target.value);
    bpmLabel.textContent = project.bpm;
  });

  // Export / Import
  document.getElementById('btnExport').addEventListener('click', exportProject);

  document.getElementById('btnImport').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', e => {
      if (e.target.files[0]) importProject(e.target.files[0]);
    });
    input.click();
  });

  // Timeline
  document.getElementById('tlPrev').addEventListener('click', () => {
    if (project.currentPage > 0) {
      project.currentPage--;
      renderTimeline();
    }
  });

  document.getElementById('tlNext').addEventListener('click', () => {
    const totalPages = Math.ceil(project.bars.length / BARS_PER_PAGE);
    if (project.currentPage < totalPages - 1) {
      project.currentPage++;
      renderTimeline();
    }
  });

  document.getElementById('delBar').addEventListener('click', () => {
    if (project.bars.length > 1) removeBar(project.currentBarIndex);
  });

  document.getElementById('addBar').addEventListener('click', () => {
    const num = project.bars.length + 1;
    document.getElementById('newBarNum').textContent = num;
    document.getElementById('newBarOverlay').classList.remove('hidden');
    newBarCallback = copyFromLast => {
      addBar(num, copyFromLast);
      project.currentBarIndex = project.bars.length - 1;
      renderAll();
      document.getElementById('newBarOverlay').classList.add('hidden');
    };
  });

  // Add dancer
  document.getElementById('addDancer').addEventListener('click', () => {
    const num = project.dancers.length + 1;
    const color = COLORS[(project.dancers.length) % COLORS.length];
    const shape = SHAPES[project.dancers.length % SHAPES.length];
    addDancer(`舞者${String.fromCharCode(64 + num)}`, color, shape);
    renderAll();
  });

  // Stage size
  stageW.addEventListener('input', e => {
    project.stage.width = parseInt(e.target.value);
    renderStage();
  });

  stageH.addEventListener('input', e => {
    project.stage.height = parseInt(e.target.value);
    renderStage();
  });

  // Detail mode
  document.getElementById('detailClose').addEventListener('click', closeDetail);
  document.getElementById('detailAddKey').addEventListener('click', addKeyframe);
  document.getElementById('detailDelKey').addEventListener('click', removeKeyframe);

  // New bar dialog
  document.getElementById('newBarCopy').addEventListener('click', () => {
    if (newBarCallback) newBarCallback(true);
  });
  document.getElementById('newBarEmpty').addEventListener('click', () => {
    if (newBarCallback) newBarCallback(false);
  });
  document.getElementById('newBarCancel').addEventListener('click', () => {
    document.getElementById('newBarOverlay').classList.add('hidden');
    newBarCallback = null;
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === ' ') { e.preventDefault(); togglePlay(); }
    if (e.key === 'ArrowLeft') goToBar(-1);
    if (e.key === 'ArrowRight') goToBar(1);
    if (e.key === 'Escape' && detailMode) closeDetail();
  });

  // Resize
  window.addEventListener('resize', () => {
    if (detailMode) {
      renderDetailCanvas();
    } else {
      renderStage();
    }
  });
});
