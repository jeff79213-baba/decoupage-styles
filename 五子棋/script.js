/* ============================================================
   照片編輯器
   ============================================================ */
class PhotoEditor {
  constructor(canvasId, fileInputId, zoomSliderId, zoomValId, confirmBtnId, statusId, playerIndex) {
    this.canvas    = document.getElementById(canvasId);
    this.ctx       = this.canvas.getContext('2d');
    this.fileInput = document.getElementById(fileInputId);
    this.zoomSlider= document.getElementById(zoomSliderId);
    this.zoomVal   = document.getElementById(zoomValId);
    this.confirmBtn= document.getElementById(confirmBtnId);
    this.statusEl  = document.getElementById(statusId);
    this.playerIndex = playerIndex;

    this.image   = null;
    this.zoom    = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.confirmed = false;

    this.CX = 75;
    this.CY = 75;
    this.R  = 68;

    this.dragging = false;
    this.dragSX = 0;
    this.dragSY = 0;
    this.dragOX = 0;
    this.dragOY = 0;

    this._bind();
    this._drawEmpty();
    this.onConfirm = null;
    this.storageKey = 'gomoku_p' + (playerIndex + 1);
    this._loadFromStorage();
  }

  _bind() {
    this.fileInput.addEventListener('change', (e) => this._onUpload(e));

    this.zoomSlider.addEventListener('input', () => {
      this.zoom = parseFloat(this.zoomSlider.value);
      this.zoomVal.textContent = this.zoom.toFixed(1) + 'x';
      this._render();
    });

    this.canvas.addEventListener('mousedown', (e) => this._dragStart(e));
    this.canvas.addEventListener('mousemove', (e) => this._dragMove(e));
    this.canvas.addEventListener('mouseup',   () => this._dragEnd());
    this.canvas.addEventListener('mouseleave', () => this._dragEnd());

    this.canvas.addEventListener('touchstart', (e) => this._dragStart(e), {passive:false});
    this.canvas.addEventListener('touchmove',  (e) => this._dragMove(e), {passive:false});
    this.canvas.addEventListener('touchend',   () => this._dragEnd());

    this.confirmBtn.addEventListener('click', () => this._confirm());
  }

  _onUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        this.image = img;
        this.zoom = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.confirmed = false;
        this.zoomSlider.value = 1;
        this.zoomVal.textContent = '1.0x';
        this.statusEl.textContent = '調整縮放/拖曳位置後按確定';
        this.statusEl.className = 'p-status editing';
        this._render();
        this._saveToStorage();
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  _getPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scale = this.canvas.width / rect.width;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * scale, y: (clientY - rect.top) * scale };
  }

  _inCircle(p) {
    const dx = p.x - this.CX, dy = p.y - this.CY;
    return dx*dx + dy*dy <= this.R * this.R;
  }

  _dragStart(e) {
    if (!this.image) return;
    e.preventDefault();
    const p = this._getPos(e);
    if (!this._inCircle(p)) return;
    this.dragging = true;
    this.dragSX = p.x;
    this.dragSY = p.y;
    this.dragOX = this.offsetX;
    this.dragOY = this.offsetY;
  }

  _dragMove(e) {
    if (!this.dragging) return;
    e.preventDefault();
    const p = this._getPos(e);
    const dx = (p.x - this.dragSX) / this.R;
    const dy = (p.y - this.dragSY) / this.R;
    this.offsetX = Math.max(-1, Math.min(1, this.dragOX + dx));
    this.offsetY = Math.max(-1, Math.min(1, this.dragOY + dy));
    this._render();
  }

  _dragEnd() {
    this.dragging = false;
  }

  _drawEmpty() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, 150, 150);
    ctx.fillStyle = '#2a2a3a';
    ctx.beginPath();
    ctx.arc(this.CX, this.CY, this.R, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#555';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('尚未上傳', this.CX, this.CY);
    ctx.strokeStyle = '#0f3460';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(this.CX, this.CY, this.R, 0, Math.PI*2);
    ctx.stroke();
  }

  _render() {
    if (!this.image) { this._drawEmpty(); return; }
    const ctx = this.ctx;
    ctx.clearRect(0, 0, 150, 150);
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.CX, this.CY, this.R, 0, Math.PI*2);
    ctx.clip();
    this._drawPhoto(ctx, this.image, this.zoom, this.offsetX, this.offsetY,
                    this.CX, this.CY, this.R);
    ctx.restore();
    ctx.strokeStyle = this.confirmed ? '#52b788' : '#0f3460';
    ctx.lineWidth = this.confirmed ? 3 : 2;
    ctx.beginPath();
    ctx.arc(this.CX, this.CY, this.R, 0, Math.PI*2);
    ctx.stroke();
    if (this.confirmed) {
      ctx.fillStyle = '#52b788';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('\u2713', this.CX, this.CY);
    }
  }

  _drawPhoto(ctx, img, zoom, ox, oy, cx, cy, r) {
    const base = Math.min(img.width, img.height);
    const crop = base / zoom;
    const sx = (img.width  - crop) / 2 + ox * (img.width  - crop) / 2;
    const sy = (img.height - crop) / 2 + oy * (img.height - crop) / 2;
    ctx.drawImage(img, sx, sy, crop, crop, cx - r, cy - r, r*2, r*2);
  }

  _saveToStorage() {
    if (!this.image) return;
    const data = {
      imageData: this.image.src,
      zoom: this.zoom,
      offsetX: this.offsetX,
      offsetY: this.offsetY,
      confirmed: this.confirmed
    };
    try { localStorage.setItem(this.storageKey, JSON.stringify(data)); }
    catch (e) { /* quota exceeded */ }
  }

  _loadFromStorage() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data.imageData) return;
      this.zoom = data.zoom || 1;
      this.offsetX = data.offsetX || 0;
      this.offsetY = data.offsetY || 0;
      this.confirmed = !!data.confirmed;
      this.zoomSlider.value = this.zoom;
      this.zoomVal.textContent = this.zoom.toFixed(1) + 'x';
      this.statusEl.textContent = this.confirmed ? '\u2713 已套用' : '調整縮放/拖曳位置後按確定';
      this.statusEl.className = this.confirmed ? 'p-status confirmed' : 'p-status editing';
      const img = new Image();
      img.onload = () => {
        this.image = img;
        this._render();
      };
      img.src = data.imageData;
    } catch (e) { /* ignore */ }
  }

  _confirm() {
    if (!this.image) {
      this.statusEl.textContent = '請先上傳照片！';
      return;
    }
    this.confirmed = true;
    this.statusEl.textContent = '\u2713 已套用';
    this.statusEl.className = 'p-status confirmed';
    this._render();
    if (this.onConfirm) this.onConfirm();
    this._saveToStorage();
  }

  getCropParams() {
    if (!this.image || !this.confirmed) return null;
    return { image: this.image, zoom: this.zoom, offsetX: this.offsetX, offsetY: this.offsetY };
  }
}

/* ============================================================
   五子棋遊戲
   ============================================================ */
const BOARD = 15;
const EMPTY = 0, P1 = 1, P2 = 2;

class GomokuGame {
  constructor(canvasId, turnId, winnerId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx    = this.canvas.getContext('2d');
    this.turnEl = document.getElementById(turnId);
    this.winnerEl = document.getElementById(winnerId);

    this.cellSize = 50;
    this.pad      = 30;
    this.pr       = 22;
    this.boardPx  = (BOARD - 1) * this.cellSize;
    this.canvas.width  = this.boardPx + this.pad * 2;
    this.canvas.height = this.boardPx + this.pad * 2;

    this.board  = [];
    this.turn   = P1;
    this.history= [];
    this.over   = false;
    this.hover  = null;

    this._init();
    this._bind();
  }

  setCropProviders(p1Provider, p2Provider) {
    this._cropP1 = p1Provider;
    this._cropP2 = p2Provider;
  }

  _init() {
    this.board = Array.from({length: BOARD}, () => Array(BOARD).fill(EMPTY));
    this.turn = P1;
    this.history = [];
    this.over = false;
    this.hover = null;
    this.winnerEl.textContent = '';
    this._draw();
    this._updateTurn();
  }

  _bind() {
    this.canvas.addEventListener('click', (e) => this._click(e));
    this.canvas.addEventListener('mousemove', (e) => this._hover(e));
    this.canvas.addEventListener('mouseleave', () => { this.hover = null; this._draw(); });
    document.getElementById('newGameBtn').addEventListener('click', () => this._init());
    document.getElementById('undoBtn').addEventListener('click', () => this._undo());
  }

  _gridPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = this.canvas.width  / rect.width;
    const sy = this.canvas.height / rect.height;
    const x = (e.clientX - rect.left) * sx;
    const y = (e.clientY - rect.top)  * sy;
    const col = Math.round((x - this.pad) / this.cellSize);
    const row = Math.round((y - this.pad) / this.cellSize);
    if (row < 0 || row >= BOARD || col < 0 || col >= BOARD) return null;
    const px = this.pad + col * this.cellSize;
    const py = this.pad + row * this.cellSize;
    if (Math.hypot(x-px, y-py) > this.cellSize * 0.45) return null;
    return { row, col };
  }

  _click(e) {
    if (this.over) return;
    const pos = this._gridPos(e);
    if (!pos) return;
    const { row, col } = pos;
    if (this.board[row][col] !== EMPTY) return;

    this.board[row][col] = this.turn;
    this.history.push({ row, col, player: this.turn });

    if (this._checkWin(row, col, this.turn)) {
      this.over = true;
      this._draw();
      const name = this.turn === P1 ? '玩家 1 \u25CF' : '玩家 2 \u25CB';
      this.winnerEl.textContent = '\uD83C\uDFC6 ' + name + ' \u52DD\u5229\uFF01';
      this.turnEl.textContent = '\uD83C\uDFC6 ' + name + ' \u52DD\u5229\uFF01';
      return;
    }

    if (this._full()) {
      this.over = true;
      this._draw();
      this.winnerEl.textContent = '\uD83E\uDD1D \u5E73\u5C40\uFF01';
      this.turnEl.textContent = '\uD83E\uDD1D \u5E73\u5C40\uFF01';
      return;
    }

    this.turn = this.turn === P1 ? P2 : P1;
    this._draw();
    this._updateTurn();
  }

  _hover(e) {
    if (this.over) { this.hover = null; this._draw(); return; }
    const pos = this._gridPos(e);
    if (pos && this.board[pos.row][pos.col] === EMPTY) this.hover = pos;
    else this.hover = null;
    this._draw();
  }

  _checkWin(row, col, player) {
    const dirs = [[1,0],[0,1],[1,1],[1,-1]];
    for (const [dr, dc] of dirs) {
      let cnt = 1;
      for (let i = 1; i < 5; i++) {
        const r = row + dr*i, c = col + dc*i;
        if (r<0||r>=BOARD||c<0||c>=BOARD||this.board[r][c]!==player) break;
        cnt++;
      }
      for (let i = 1; i < 5; i++) {
        const r = row - dr*i, c = col - dc*i;
        if (r<0||r>=BOARD||c<0||c>=BOARD||this.board[r][c]!==player) break;
        cnt++;
      }
      if (cnt >= 5) return true;
    }
    return false;
  }

  _full() {
    return this.board.every(row => row.every(c => c !== EMPTY));
  }

  _undo() {
    if (this.history.length === 0) return;
    if (this.over) {
      this.over = false;
      this.winnerEl.textContent = '';
    }
    const last = this.history.pop();
    this.board[last.row][last.col] = EMPTY;
    this.turn = last.player;
    this._draw();
    this._updateTurn();
  }

  _updateTurn() {
    const s = this.turn === P1 ? '\u25CF' : '\u25CB';
    const n = this.turn === P1 ? '玩家 1' : '玩家 2';
    this.turnEl.textContent = '\u8F2A\u5230: ' + s + ' ' + n;
  }

  _draw() {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;

    ctx.fillStyle = '#c48a4a';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#b87a3a';
    ctx.lineWidth = 0.5;
    for (let y = 0; y < H; y += 4) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let i = 0; i < BOARD; i++) {
      const p = this.pad + i * this.cellSize;
      ctx.beginPath(); ctx.moveTo(this.pad, p); ctx.lineTo(this.pad + this.boardPx, p); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p, this.pad); ctx.lineTo(p, this.pad + this.boardPx); ctx.stroke();
    }

    ctx.fillStyle = '#333';
    const stars = [[3,3],[3,7],[3,11],[7,3],[7,7],[7,11],[11,3],[11,7],[11,11]];
    for (const [r, c] of stars) {
      const x = this.pad + c * this.cellSize, y = this.pad + r * this.cellSize;
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI*2); ctx.fill();
    }

    for (let r = 0; r < BOARD; r++)
      for (let c = 0; c < BOARD; c++)
        if (this.board[r][c] !== EMPTY)
          this._drawPiece(ctx, this.pad + c*this.cellSize, this.pad + r*this.cellSize, this.board[r][c]);

    if (this.hover) {
      const x = this.pad + this.hover.col * this.cellSize;
      const y = this.pad + this.hover.row * this.cellSize;
      ctx.globalAlpha = 0.35;
      this._drawPiece(ctx, x, y, this.turn);
      ctx.globalAlpha = 1;
    }

    ctx.strokeStyle = '#5a3a1a';
    ctx.lineWidth = 3;
    ctx.strokeRect(this.pad-5, this.pad-5, this.boardPx+10, this.boardPx+10);
  }

  _drawPiece(ctx, x, y, player) {
    const r = this.pr;
    const crop = player === P1
      ? (this._cropP1 ? this._cropP1() : null)
      : (this._cropP2 ? this._cropP2() : null);

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI*2);
    ctx.clip();

    if (crop && crop.image) {
      const img = crop.image;
      const zoom = crop.zoom;
      const ox = crop.offsetX, oy = crop.offsetY;
      const base = Math.min(img.width, img.height);
      const cropSize = base / zoom;
      const sx = (img.width  - cropSize) / 2 + ox * (img.width  - cropSize) / 2;
      const sy = (img.height - cropSize) / 2 + oy * (img.height - cropSize) / 2;
      ctx.drawImage(img, sx, sy, cropSize, cropSize, x - r, y - r, r*2, r*2);
    } else {
      ctx.fillStyle = player === P1 ? '#222' : '#eee';
      ctx.fill();
    }
    ctx.restore();

    ctx.strokeStyle = player === P1 ? '#000' : '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r - 0.5, 0, Math.PI*2);
    ctx.stroke();
  }

  _drawThumb(canvasId, player) {
    const c = document.getElementById(canvasId);
    if (!c) return;
    const ctx = c.getContext('2d');
    const cx = 24, cy = 24, r = 21;
    ctx.clearRect(0, 0, 48, 48);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI*2);
    ctx.clip();

    const crop = player === P1
      ? (this._cropP1 ? this._cropP1() : null)
      : (this._cropP2 ? this._cropP2() : null);

    if (crop && crop.image) {
      const img = crop.image;
      const zoom = crop.zoom;
      const ox = crop.offsetX, oy = crop.offsetY;
      const base = Math.min(img.width, img.height);
      const cropSize = base / zoom;
      const sx = (img.width  - cropSize) / 2 + ox * (img.width  - cropSize) / 2;
      const sy = (img.height - cropSize) / 2 + oy * (img.height - cropSize) / 2;
      ctx.drawImage(img, sx, sy, cropSize, cropSize, cx - r, cy - r, r*2, r*2);
    } else {
      ctx.fillStyle = player === P1 ? '#222' : '#eee';
      ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = player === P1 ? '#000' : '#fff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI*2);
    ctx.stroke();
  }

  _updateThumbs() {
    this._drawThumb('gsThumb1', P1);
    this._drawThumb('gsThumb2', P2);
  }
}

/* ============================================================
   階段切換
   ============================================================ */
const editingPhase = document.getElementById('editingPhase');
const gamePhase    = document.getElementById('gamePhase');
const app          = document.getElementById('app');
const startBtn     = document.getElementById('startGameBtn');
const startStatus  = document.getElementById('startStatus');
const backBtn      = document.getElementById('backEditBtn');

function checkBothConfirmed() {
  const ok = ed1.confirmed && ed2.confirmed;
  startBtn.disabled = !ok;
  startStatus.textContent = ok
    ? '兩人都已準備好！點擊「開始對戰」'
    : '請兩人各自上傳照片並按「確定套用」';
  startStatus.style.color = ok ? '#52b788' : '#aaa';
}

function enterGame() {
  editingPhase.style.display = 'none';
  gamePhase.style.display    = 'block';
  app.classList.add('game-mode');
  game._init();
  game._updateThumbs();
}

function exitGame() {
  gamePhase.style.display    = 'none';
  editingPhase.style.display = 'block';
  app.classList.remove('game-mode');
  checkBothConfirmed();
}

/* ============================================================
   啟動
   ============================================================ */
const ed1 = new PhotoEditor('preview1','upload1','zoom1','zoom1-val','confirm1','status1',0);
const ed2 = new PhotoEditor('preview2','upload2','zoom2','zoom2-val','confirm2','status2',1);

const game = new GomokuGame('boardCanvas','turnIndicator','winnerMsg');

game.setCropProviders(
  () => ed1.getCropParams(),
  () => ed2.getCropParams()
);

ed1.onConfirm = () => { checkBothConfirmed(); game._draw(); game._updateThumbs(); };
ed2.onConfirm = () => { checkBothConfirmed(); game._draw(); game._updateThumbs(); };

checkBothConfirmed();

startBtn.addEventListener('click', enterGame);
backBtn.addEventListener('click', exitGame);
