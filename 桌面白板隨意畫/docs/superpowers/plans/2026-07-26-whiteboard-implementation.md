# 桌面白板隨意畫 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-file HTML whiteboard drawing tool with pen, eraser, photo background, download, and clipboard capture.

**Architecture:** Single `index.html` with inline CSS + JS, using dual layered `<canvas>` elements (bgCanvas for background image/color, drawCanvas for drawing strokes). Pure client-side, no dependencies.

**Tech Stack:** HTML5 Canvas 2D API, vanilla JS, localStorage for persistence.

**Global Constraints:**
- All code in one `index.html` file
- No external libraries or CDN dependencies
- Pure offline, no network required
- Must work in modern browsers (Chrome, Edge, Firefox)
- Icons use SVG inline or emoji fallback

---

### Task 1: HTML Structure & CSS Layout

**Files:**
- Create: `C:\Users\TW-10\Documents\firebase雲端資料夾\桌面白板隨意畫\index.html`

**Interfaces:**
- Produces: HTML skeleton with toolbar and dual-canvas container, ready for JS in Task 2

- [ ] **Step 1: Write the HTML skeleton**

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>桌面白板隨意畫</title>
<style>
/* CSS here */
</style>
</head>
<body>
<!-- Toolbar -->
<!-- Canvas container -->
<script>
/* JS here */
</script>
</body>
</html>
```

- [ ] **Step 2: Write CSS**

The CSS should:
- `* { margin: 0; padding: 0; box-sizing: border-box; }`
- Body: full viewport, flex column, `#f0f0f0` background
- Toolbar: flex row, wrap, gap 8px, padding 10px, `#fff` bg, box-shadow
- Tool buttons: 40x40px, border 1px solid `#ddd`, border-radius 6px, cursor pointer, font-size 18px, flex center, bg `#fafafa`
- Active/selected button: `#007aff` border, `#e8f0fe` bg
- Color inputs: 36x36px, border none, cursor pointer, padding 0
- Range input: width 100px
- Canvas container: flex 1, position relative, overflow hidden, margin 8px
- Both canvases: position absolute, top 0, left 0, width 100%, height 100%
- `bg-canvas` z-index 1, `draw-canvas` z-index 2

- [ ] **Step 3: Write toolbar HTML**

Toolbar groups from left to right:
- Pen button (svg pencil icon)
- Eraser button (svg eraser icon)
- Separator |
- Color input (pen color)
- Range input (brush size 1-50)
- Separator |
- File input (hidden, accept image/*) + upload button (svg image icon)
- Color input (bg color, default #ffffff)
- Separator |
- Clear drawing button (svg trash icon)
- New canvas button (svg file icon)
- Separator |
- Download button (svg download icon)
- Copy button (svg clipboard icon)

- [ ] **Step 4: Verify the file opens in browser**

Open `index.html` in browser, confirm toolbar renders and canvas area is visible.

---

### Task 2: Canvas Drawing Engine

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: HTML structure from Task 1 (toolbar buttons, canvas elements)
- Produces: `drawCanvas` with mouse event handlers, `bgCanvas` with fill/drawImage

- [ ] **Step 1: Add JS canvas setup**

```js
const bgCanvas = document.getElementById('bgCanvas');
const drawCanvas = document.getElementById('drawCanvas');
const bgCtx = bgCanvas.getContext('2d');
const ctx = drawCanvas.getContext('2d');

function resizeCanvases() {
  const container = document.querySelector('.canvas-container');
  const w = container.clientWidth;
  const h = container.clientHeight;
  [bgCanvas, drawCanvas].forEach(c => {
    c.width = w;
    c.height = h;
  });
  // redraw bg after resize
  renderBg();
}
window.addEventListener('resize', resizeCanvases);
resizeCanvases();
```

- [ ] **Step 2: Add drawing state variables**

```js
let isDrawing = false;
let tool = 'pen'; // 'pen' | 'eraser'
let penColor = '#000000';
let penSize = 3;
let eraserSize = 20;
let bgColor = '#ffffff';
let bgImage = null; // Image object or null
```

- [ ] **Step 3: Add mouse event handlers for drawing**

```js
function getPos(e) {
  const rect = drawCanvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

drawCanvas.addEventListener('mousedown', (e) => {
  isDrawing = true;
  const pos = getPos(e);
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y);
});

drawCanvas.addEventListener('mousemove', (e) => {
  if (!isDrawing) return;
  const pos = getPos(e);
  const size = tool === 'eraser' ? eraserSize : penSize;
  ctx.lineWidth = size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = penColor;
  }
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();
});

drawCanvas.addEventListener('mouseup', () => {
  isDrawing = false;
  ctx.closePath();
  saveState();
});

drawCanvas.addEventListener('mouseleave', () => {
  isDrawing = false;
  ctx.closePath();
});
```

- [ ] **Step 4: Add bgCanvas rendering**

```js
function renderBg() {
  bgCtx.fillStyle = bgColor;
  bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
  if (bgImage) {
    const iw = bgImage.width;
    const ih = bgImage.height;
    const cw = bgCanvas.width;
    const ch = bgCanvas.height;
    const scale = Math.max(cw/iw, ch/ih);
    const sw = iw * scale;
    const sh = ih * scale;
    const sx = (cw - sw) / 2;
    const sy = (ch - sh) / 2;
    bgCtx.drawImage(bgImage, sx, sy, sw, sh);
  }
}
```

- [ ] **Step 5: Wire toolbar buttons to state**

```js
// Pen / Eraser toggle
document.getElementById('penBtn').addEventListener('click', () => {
  tool = 'pen';
  document.getElementById('penBtn').classList.add('active');
  document.getElementById('eraserBtn').classList.remove('active');
});
document.getElementById('eraserBtn').addEventListener('click', () => {
  tool = 'eraser';
  document.getElementById('eraserBtn').classList.add('active');
  document.getElementById('penBtn').classList.remove('active');
});

// Pen color
document.getElementById('penColor').addEventListener('input', (e) => {
  penColor = e.target.value;
});

// Pen size
document.getElementById('penSize').addEventListener('input', (e) => {
  penSize = parseInt(e.target.value);
  document.getElementById('sizeLabel').textContent = e.target.value;
});

// Bg color
document.getElementById('bgColor').addEventListener('input', (e) => {
  bgColor = e.target.value;
  renderBg();
});
```

---

### Task 3: Photo Upload, Clear, New Canvas

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: canvas setup and drawing engine from Task 2
- Produces: photo upload, clear drawing, new canvas functions

- [ ] **Step 1: Photo upload handler**

```js
document.getElementById('uploadBtn').addEventListener('click', () => {
  document.getElementById('fileInput').click();
});
document.getElementById('fileInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      bgImage = img;
      renderBg();
      saveState();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
  e.target.value = '';
});
```

- [ ] **Step 2: Clear drawing (full erase)**

```js
document.getElementById('clearBtn').addEventListener('click', () => {
  ctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  saveState();
});
```

- [ ] **Step 3: New canvas**

```js
document.getElementById('newBtn').addEventListener('click', () => {
  bgImage = null;
  bgColor = '#ffffff';
  document.getElementById('bgColor').value = '#ffffff';
  ctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  renderBg();
  saveState();
});
```

---

### Task 4: Download, Copy, Persistence

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: drawing engine from Task 2, clear/new functions from Task 3
- Produces: download PNG, copy to clipboard, localStorage save/load

- [ ] **Step 1: Download PNG**

```js
document.getElementById('downloadBtn').addEventListener('click', () => {
  const tmp = document.createElement('canvas');
  tmp.width = bgCanvas.width;
  tmp.height = bgCanvas.height;
  const tmpCtx = tmp.getContext('2d');
  tmpCtx.drawImage(bgCanvas, 0, 0);
  tmpCtx.drawImage(drawCanvas, 0, 0);
  tmp.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'whiteboard.png';
    a.click();
    URL.revokeObjectURL(url);
  });
});
```

- [ ] **Step 2: Copy to clipboard**

```js
document.getElementById('copyBtn').addEventListener('click', async () => {
  const tmp = document.createElement('canvas');
  tmp.width = bgCanvas.width;
  tmp.height = bgCanvas.height;
  const tmpCtx = tmp.getContext('2d');
  tmpCtx.drawImage(bgCanvas, 0, 0);
  tmpCtx.drawImage(drawCanvas, 0, 0);
  tmp.toBlob(async (blob) => {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
    } catch (err) {
      alert('複製失敗，請使用下載功能');
    }
  });
});
```

- [ ] **Step 3: Save state to localStorage**

```js
function saveState() {
  // save drawing layer
  localStorage.setItem('whiteboard-draw', drawCanvas.toDataURL());
  // save background
  const bgData = {
    color: bgColor,
    image: bgImage ? bgCanvas.toDataURL() : null
  };
  localStorage.setItem('whiteboard-bg', JSON.stringify(bgData));
}
```

- [ ] **Step 4: Load state from localStorage**

```js
function loadState() {
  const drawData = localStorage.getItem('whiteboard-draw');
  if (drawData) {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
    };
    img.src = drawData;
  }
  const bgData = JSON.parse(localStorage.getItem('whiteboard-bg'));
  if (bgData) {
    if (bgData.color) {
      bgColor = bgData.color;
      document.getElementById('bgColor').value = bgColor;
    }
    if (bgData.image) {
      const img = new Image();
      img.onload = () => {
        bgImage = img;
        renderBg();
      };
      img.src = bgData.image;
    } else {
      renderBg();
    }
  } else {
    renderBg();
  }
}
```

- [ ] **Step 5: Call loadState after canvas setup**

Add `loadState();` after `resizeCanvases();` in the initialization.

Add `window.addEventListener('beforeunload', saveState);` for auto-save on close.

---

### Task 5: Desktop Shortcut

**Files:**
- Create: `C:\Users\TW-10\Desktop\桌面白板隨意畫.url`

- [ ] **Step 1: Create shortcut file**

Create a `.url` file on the desktop pointing to the `index.html` file.

```
[InternetShortcut]
URL=file:///C:/Users/TW-10/Documents/firebase雲端資料夾/桌面白板隨意畫/index.html
IconIndex=0
```

- [ ] **Step 2: Verify shortcut works**

Double-click the shortcut on desktop to confirm the whiteboard opens in the default browser.
