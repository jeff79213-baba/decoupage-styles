# 烤肉團康支援前線拍照版 v2（數量設定版）實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將已上線的 v1「支援前線」出題器改版：人數無上限、每樣物品改為「數量框＋停用勾」互動模型、移除 40% 機率全員品項。

**Architecture:** 單一 `index.html`（純前端、無外部依賴），合併 `POOL` + `ALL_MEMBERS` 為單一 `ITEMS` 清單（加 `act` 欄位），採 `customQty` Map（方案 A：手動數字優先 + 自動規則補位）。所有核心邏輯在 `<script>` 閉包內，測試以 `vm` + 假 `document` stub 擷取 `<script>` 內容執行並經 `globalThis.__exports` 取得函式參考（let 變數用 getter）。

**Tech Stack:** 純 HTML/CSS/JS，Node.js v26（跑測試），Firebase Hosting（`bbq-support-front-sk`），GitHub Pages（`bbq-support-front`）。

## Global Constraints

- 單一檔案 `index.html`，無外部依賴/CDN。
- 人數：輸入框**不設 `min`/`max`**，完全無限制（0、1、超高皆允許）；預設 10。
- 互動模型「數量框＋停用勾」：數量框 `min=0`（空或 0 = 自動規則；>0 = 直接用該數字）；停用勾預設不打勾（全可出題），打勾 = 完全不出這項。兩者互不連動。
- 出題：從「啟用中」物品隨機取 3~5 樣；`qty = customQty[id] ?? (body ? organQty(peopleCount) : 1)`。
- 全員品項（6 樣）與一般物品同列，`act='member'`，可被隨機選中；**移除 memberBonus / 40% 機率 / 「➕全員題」按鈕**。
- 事件行為：停用勾/數量框/人數變動 → **不重新出題**（僅重繪）；只有「🎲 重新出題」才 `newQuestion()`。
- 全部停用 → 阻止出題並提示「至少啟用一種物品」。
- 複製格式沿用 v1：`🔥 支援前線第 N 題` + 引導 + 物品列（`${emoji} ${qty} ${name}`）+ 結尾。
- 計時器沿用 v1，不變。
- 修改題目（✏️）沿用 v1：目前題目數量可改 1~99。
- UTF-8 無 BOM；中文＋emoji 需正確保存。
- Git 根目錄 = `C:\Users\TW-10\Documents\firebase雲端資料夾`（monorepo）；commit 用相對路徑 `團康遊戲支援前線拍照版題目/...`。獨立 repo clone 在 `C:\Users\TW-10\AppData\Local\Temp\opencode\bbq-support-front-repo`。

---

### Task 1: 重寫 index.html 為 v2 核心邏輯（ITEMS 合併 + customQty + 停用勾 + 人數無上限）

**Files:**
- Modify: `團康遊戲支援前線拍照版題目/index.html`（整份重寫）
- Test: `團康遊戲支援前線拍照版題目/tests/generate.test.mjs`（整份重寫）

**Interfaces:**
- Produces（供 Task 2 的 copy.test.mjs 使用）:`textForLine()`, `round`（let, 經 getter）, `setPeople(v)`, `newQuestion()`, `toggleEnabled(id, el)`, `getItems()`。
- `<script>` 閉包內變數：`ITEMS`（25 樣，含 `act`）、`enabled`（Set, 預設全含）、`customQty`（Map-like object `{id:number}`）、`current`、`round`、`peopleCount`。
- 導出區塊（測試用）：`{ setPeople, generate, newQuestion, organQty, setCustomQty, toggleEnabled, getItems:()=>ITEMS, getCurrent:()=>current, getPeople:()=>peopleCount, getRound:()=>round }`。

- [ ] **Step 1: 重寫測試 `tests/generate.test.mjs`（先寫 failing test）**

以 apply_patch/write 建立（UTF-8，不用 PowerShell 寫）：

```js
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) throw new Error('找不到 <script>');

const src = m[1] + `
globalThis.__exports = {
  setPeople, generate, newQuestion, organQty, setCustomQty, toggleEnabled,
  getItems:()=>ITEMS, getCurrent:()=>current, getPeople:()=>peopleCount, getRound:()=>round
};`;

globalThis.document = {
  getElementById:()=>({style:{},textContent:'',innerHTML:'',value:''}),
  createElement:()=>({select(){},remove(){},value:'',style:{}}),
  body:{appendChild(){}}
};
vm.createContext(globalThis);
vm.runInContext(src, globalThis);

const T   = globalThis.__exports;
globalThis.__exports = undefined;

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.error('FAIL:', msg); failures++; }
  else console.log('PASS:', msg);
}

const organs = new Set(['手','手指','腳','臉']);

// --- 1. 人數無上下限 ---
T.setPeople(0);    T.generate();
assert(T.getPeople() === 0, `人數可設 0 => ${T.getPeople()}`);
T.setPeople(99);   T.generate();
assert(T.getPeople() === 99, `人數可設 99 => ${T.getPeople()}`);
T.setPeople(-3);   T.generate();
assert(T.getPeople() === -3, `人數可設 -3 => ${T.getPeople()}`);
T.setPeople(10);

// --- 2. 出題樣數 3~5、一般=1、器官=30~80%（50 次抽樣）---
let countOK = true, generalOK = true, organOK = true;
for (let i = 0; i < 50; i++) {
  T.generate();
  const n = T.getCurrent().length;
  if (n < 3 || n > 5) countOK = false;
  for (const it of T.getCurrent()) {
    if (organs.has(it.name)) {
      const lo = Math.max(1, Math.round(T.getPeople()*0.3));
      const hi = Math.round(T.getPeople()*0.8);
      if (it.qty < lo || it.qty > hi) organOK = false;
    } else if (it.qty !== 1) generalOK = false;
  }
}
assert(countOK, '50 次抽樣每題皆 3~5 樣');
assert(generalOK, '一般物品數量皆為 1');
assert(organOK, '器官數量皆在 30~80% 範圍');

// --- 3. 手動數字優先：設定後直接用該數字 ---
T.setCustomQty('phone', '5');  // 模擬 input value '5'
let manualOK = true;
for (let i = 0; i < 20; i++) {
  T.generate();
  for (const it of T.getCurrent()) {
    if (it.id === 'phone' && it.qty !== 5) manualOK = false;
  }
}
assert(manualOK, '手機設數字 5 後 20 次抽樣皆用手動 5');
T.setCustomQty('phone', '');   // 清空回自動

// --- 4. 停用勾：停用手機後不出題 ---
T.toggleEnabled('phone', {checked:true});
let phoneAppeared = false;
for (let i = 0; i < 30; i++) { T.generate(); if (T.getCurrent().some(x => x.id==='phone')) phoneAppeared = true; }
assert(!phoneAppeared, '停用手機後 30 次都不出手機');
T.toggleEnabled('phone', {checked:false});

// --- 5. 全員品項可被選中 ---
let memberSeen = false;
for (let i = 0; i < 100; i++) { T.generate(); if (T.getCurrent().some(x => x.name.includes('全員'))) memberSeen = true; }
assert(memberSeen, '100 次抽樣內曾有全員品項被選中');

// --- 6. 全部停用時阻止出題、round 不變 ---
const ids = T.getItems().map(p=>p.id);
ids.forEach(id => T.toggleEnabled(id, {checked:true}));
const roundBefore = T.getRound();
T.newQuestion();
assert(T.getRound() === roundBefore, `全部停用時 newQuestion 不跳題 (round 保持 ${roundBefore})`);
ids.forEach(id => T.toggleEnabled(id, {checked:false}));

// --- 7. 事件不跳題：改人數/停用不觸發 newQuestion ---
const r0 = T.getRound();
T.setPeople(25);
assert(T.getPeople() === 25 && T.getRound() === r0, '改人數不跳題（round 不變）');
T.toggleEnabled('shoe', {checked:true}); T.toggleEnabled('shoe', {checked:false});
assert(T.getRound() === r0, '停用/啟用物品不跳題（round 不變）');

// --- 8. organQty 數學 2000 次抽測 ---
function organQtyRangeOK(people) {
  const lo = Math.max(1, Math.round(people*0.3)), hi = Math.round(people*0.8);
  for (let i=0;i<2000;i++) {
    const q = T.organQty(people);
    if (q < lo || q > hi) return false;
  }
  return true;
}
assert(organQtyRangeOK(1),  'organQty(1)  2000次都在 [1,1]');
assert(organQtyRangeOK(10), 'organQty(10) 2000次都在 [3,8]');
assert(organQtyRangeOK(99), 'organQty(99) 2000次都在 [30,79]');

if (failures) { console.error(`\n共 ${failures} 個失敗`); process.exit(1); }
console.log('\n全部通過 ✅');
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node tests/generate.test.mjs`（workdir = `團康遊戲支援前線拍照版題目`）
Expected: 因 v1 index.html 尚無 `setCustomQty`/`toggleEnabled`/`getItems` → 失敗（如 `ReferenceError: setCustomQty is not defined`）或部分 FAIL。

- [ ] **Step 3: 重寫 `index.html` 為 v2**

整份內容如下（已含 `let round=0` 修正與 v2 全新邏輯）——此為最終版，請**完整覆寫**檔案：

```html
<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>烤肉團康支援前線拍照版題目</title>
<style>
  :root{--bg:#171717;--card:#242424;--line:#3a3a3a;--text:#fff;--muted:#aaa;--accent:#ff9f43;--green:#45d483}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Noto Sans TC","Microsoft JhengHei",sans-serif}
  .wrap{max-width:560px;margin:auto;padding:18px 16px 40px}
  h1{font-size:26px;margin:4px 0 6px}
  .sub{color:var(--muted);font-size:14px;margin-bottom:18px}
  .card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:18px;margin-bottom:14px}
  .row{display:flex;justify-content:space-between;align-items:center;gap:10px}
  .label{color:var(--muted);font-size:14px}
  .round{font-size:14px;color:var(--muted)}
  .question{font-size:20px;font-weight:700;line-height:1.6;margin:12px 0}
  .item{display:flex;align-items:center;gap:10px;padding:6px 0}
  .itemrow{display:flex;align-items:center;gap:10px;padding:6px 0;font-size:16px}
  .itemrow input[type=number]{width:68px;text-align:center;background:#151515;color:white;border:1px solid #444;border-radius:10px;padding:8px;font-size:15px}
  .itemrow small{color:var(--muted);margin-left:auto;font-size:12px}
  .emoji{font-size:22px;width:30px;text-align:center;flex-shrink:0}
  .editbox{display:none;margin-top:14px;border-top:1px solid var(--line);padding-top:14px}
  .editrow{display:grid;grid-template-columns:1fr 90px;gap:8px;margin:8px 0}
  input[type=number],input[type=text]{width:100%;background:#151515;color:white;border:1px solid #444;border-radius:10px;padding:10px;font-size:16px}
  .people{display:flex;align-items:center;gap:10px;margin-top:8px}
  .people input{width:110px;text-align:center;font-size:22px;font-weight:800}
  button{border:0;border-radius:12px;padding:12px 15px;font-size:16px;font-weight:700;cursor:pointer}
  .primary{background:var(--accent);color:#111;width:100%;font-size:19px;padding:15px}
  .secondary{background:#383838;color:#fff}
  .green{background:var(--green);color:#102218}
  .danger{background:#583131;color:#fff}
  .buttons{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:12px}
  .timer{text-align:center;font-size:46px;font-variant-numeric:tabular-nums;font-weight:800;margin:8px 0}
  .timer small{display:block;font-size:13px;color:var(--muted);font-weight:400}
  .tip{font-size:13px;color:var(--muted);line-height:1.6}
  .copied{color:var(--green);font-weight:700;min-height:22px;text-align:center;margin-top:8px}
</style>
</head>
<body>
<div class="wrap">
  <h1>🔥 烤肉團康支援前線</h1>
  <div class="sub">主持人：設定人數 → 勾選物品+填數量 → 隨機出題 → 複製貼到 LINE</div>

  <div class="card">
    <div class="row"><b>👥 人數</b><span class="label" id="countHint"></span></div>
    <div class="people">
      <button class="secondary" onclick="changePeople(-1)">−</button>
      <input id="people" type="number" value="10" onchange="setPeople(this.value)">
      <button class="secondary" onclick="changePeople(1)">＋</button>
    </div>
  </div>

  <div class="card">
    <div class="row"><b>🧺 可用物品</b><button class="secondary" onclick="toggleAll()">全部啟動/取消</button></div>
    <div id="itemList"></div>
    <p class="tip">數量留空或 0＝自動（器官依人數、其餘 1）；輸入數字＝直接用該數量。停用勾＝完全不出這項。</p>
  </div>

  <div class="card">
    <div class="row">
      <b><span id="roundLabel">第 1 題</span></b>
      <span class="round" id="qCount"></span>
    </div>
    <div id="question" class="question"></div>
    <div class="buttons">
      <button class="secondary" onclick="newQuestion()">🎲 重新出題</button>
      <button class="secondary" onclick="toggleEdit()">✏️ 修改題目</button>
    </div>
    <div id="editbox" class="editbox"></div>
    <div class="buttons">
      <button class="primary" onclick="copyQuestion()">📋 複製題目</button>
    </div>
    <div id="copied" class="copied"></div>
  </div>

  <div class="card">
    <div class="row"><b>⏱️ 計時器</b><button class="danger" onclick="resetTimer()">重設</button></div>
    <div class="timer" id="timer">00:00.0<small>完成後按停止</small></div>
    <div class="buttons">
      <button class="secondary" onclick="toggleTimer()" id="timerBtn">開始</button>
      <button class="green" onclick="finishTimer()">🏁 完成</button>
    </div>
  </div>
</div>

<script>
const GENERAL=[
  {id:'hand', emoji:'🤲', name:'手',     per:2,  body:true},
  {id:'finger',emoji:'☝️', name:'手指', per:10, body:true},
  {id:'foot', emoji:'🦶',  name:'腳',    per:2,  body:true},
  {id:'face', emoji:'👤',  name:'臉',    per:1,  body:true},
  {id:'phone',emoji:'📱',  name:'手機',  per:1,  body:false},
  {id:'cap',  emoji:'🧢',  name:'帽子',  per:1,  body:false},
  {id:'glass',emoji:'🕶️', name:'眼鏡',  per:1,  body:false},
  {id:'shoe', emoji:'👟',  name:'鞋子',  per:2,  body:false},
  {id:'drink',emoji:'🥤',  name:'飲料',  per:2,  body:false},
  {id:'beer', emoji:'🍺',  name:'啤酒罐',per:3,  body:false},
  {id:'stick',emoji:'🥢',  name:'筷子',  per:2,  body:false},
  {id:'tongs',emoji:'🍴',  name:'烤肉夾',per:2,  body:false},
  {id:'meat', emoji:'🍖',  name:'烤肉食材',per:3, body:false},
  {id:'spoon',emoji:'🥄',  name:'湯匙',  per:2,  body:false},
  {id:'chair',emoji:'🪑',  name:'椅子',  per:1,  body:false},
  {id:'botl', emoji:'🧴',  name:'瓶子',  per:2,  body:false},
  {id:'plate',emoji:'🍽️', name:'盤子',  per:2,  body:false},
  {id:'tiss', emoji:'🧻',  name:'衛生紙',per:1,  body:false},
  {id:'glove',emoji:'🧤',  name:'手套',  per:2,  body:false},
];
const MEMBERS=[
  {id:'allpic', emoji:'📸', name:'全員合照'},
  {id:'alllove',emoji:'💛', name:'全員比愛心'},
  {id:'allya', emoji:'✌️', name:'全員比 YA'},
  {id:'allgood',emoji:'👍', name:'全員比讚'},
  {id:'alljump',emoji:'🕺', name:'全員跳起來'},
  {id:'allarm', emoji:'🤝', name:'全員手搭肩'},
];
const ITEMS=[...GENERAL,...MEMBERS].map(p=>({...p, act:GENERAL.includes(p)?'general':'member'}));

let peopleCount=10;
let enabled=new Set(ITEMS.map(p=>p.id));       // 預設全部啟用
let customQty={};                               // {id:number}，僅存 >0 的值
let current=[]; // [{emoji,name,qty,body,act,id}]
let round=0;
let running=false, startAt=0, elapsed=0, timerId=null;

function rnd(a,b){return Math.floor(Math.random()*(b-a+1))+a}
function organQty(people){
  return Math.max(1, Math.round(people*0.3 + Math.random()*(people*0.5)));
}
function itemQty(p){
  const c=customQty[p.id];
  if(c && c>0) return c;
  return p.body?organQty(peopleCount):1;
}
function generate(){
  const avail=ITEMS.filter(p=>enabled.has(p.id));
  const n=Math.min(rnd(3,5), avail.length);
  const chosen=[...avail].sort(()=>Math.random()-.5).slice(0,n);
  current=chosen.map(p=>({emoji:p.emoji,name:p.name,qty:itemQty(p),body:p.body,act:p.act,id:p.id}));
}
function render(){
  document.getElementById('roundLabel').textContent='第 '+round+' 題';
  document.getElementById('qCount').textContent=current.length+' 樣物品';
  const lines=[];
  for(const it of current){
    lines.push(`<div class="item"><span class="emoji">${it.emoji}</span><span>${it.qty} ${it.name}</span></div>`);
  }
  document.getElementById('question').innerHTML=lines.join('');
  renderEdit();
}
function renderItems(){
  const box=document.getElementById('itemList');
  box.innerHTML=ITEMS.map(p=>{
    const cap=p.act==='member'?'全員入鏡':(p.body?`${p.per}個/人`:`最多${p.per}個`);
    const val=customQty[p.id]??'';
    return `<div class="itemrow">
      <input type="number" min="0" value="${val}" placeholder="自動" onchange="setCustomQty('${p.id}',this.value)">
      <span class="emoji">${p.emoji}</span>
      <span>${p.name}</span>
      <small><label><input type="checkbox" ${enabled.has(p.id)?'':'checked'} onchange="toggleEnabled('${p.id}',this)">停用</label></small>
    </div>`;
  }).join('');
}
function renderEdit(){
  document.getElementById('editbox').innerHTML=current.map((it,i)=>`
    <div class="editrow">
      <span style="display:flex;align-items:center;gap:8px"><span class="emoji">${it.emoji}</span> ${it.name}</span>
      <input type="number" min="0" max="99" value="${it.qty}" onchange="editQty(${i},this.value)">
    </div>`).join('');
}
// ---------- 事件 ----------
function toggleEnabled(id,el){
  if(el.checked) enabled.delete(id); else enabled.add(id);
  requireOneEnabled();
}
function toggleAll(){
  const allOn=[...ITEMS].every(p=>enabled.has(p.id));
  if(allOn){enabled.clear();} else {enabled=new Set(ITEMS.map(p=>p.id));}
  renderItems();requireOneEnabled();
}
function setCustomQty(id,v){
  const n=parseInt(v,10);
  if(Number.isFinite(n) && n>0) customQty[id]=n; else delete customQty[id];
  renderItems();
}
function requireOneEnabled(){
  if(enabled.size===0){
    document.getElementById('copied').textContent='⚠️ 至少啟用一種物品';
    return false;
  }
  return true;
}
function changePeople(d){
  setPeople(Number(document.getElementById('people').value)+d);
}
function setPeople(v){
  const n=Math.round(Number(v));
  peopleCount=Number.isFinite(n)?n:10;
  document.getElementById('people').value=peopleCount;
  document.getElementById('countHint').textContent=peopleCount+' 人';
}
function newQuestion(){
  if(!requireOneEnabled()) return;
  round++;
  generate();
  render();
  resetTimer();
  document.getElementById('copied').textContent='';
}
function editQty(i,v){
  const n=parseInt(v,10);
  current[i].qty=(Number.isFinite(n)&&n>0&&n<=99)?n:current[i].qty;
  render();
}
function toggleEdit(){
  const e=document.getElementById('editbox');
  e.style.display=e.style.display==='grid'?'none':'grid';
}
function textForLine(){
  const lines=current.map(it=>`${it.emoji} ${it.qty} ${it.name}`).join('\n');
  return `🔥 支援前線第 ${round} 題\n\n請在最快時間內拍照完成：\n\n${lines}\n\n📸 完成後拍照並傳到群組！`;
}
function copyQuestion(){
  const text=textForLine();
  (navigator.clipboard? navigator.clipboard.writeText(text) : Promise.reject())
    .then(()=>{showCopied()})
    .catch(()=>{
      const ta=document.createElement('textarea');
      ta.value=text;document.body.appendChild(ta);ta.select();
      try{document.execCommand('copy')}catch(e){}
      ta.remove();showCopied();
    });
}
function showCopied(){
  const el=document.getElementById('copied');
  el.textContent='✓ 已複製，可以貼到 LINE 群組';
  setTimeout(()=>el.textContent='',2500);
}
// ---------- 計時器 ----------
function updateTimer(){
  const ms=running?performance.now()-startAt:elapsed;
  const sec=ms/1000;
  const m=Math.floor(sec/60), s=Math.floor(sec%60), d=Math.floor((sec%1)*10);
  document.getElementById('timer').innerHTML=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${d}<small>${running?'進行中':'完成後按停止'}</small>`;
}
function toggleTimer(){
  if(running){elapsed=performance.now()-startAt;running=false;clearInterval(timerId);document.getElementById('timerBtn').textContent='開始';updateTimer();return}
  startAt=performance.now()-elapsed;running=true;timerId=setInterval(updateTimer,100);document.getElementById('timerBtn').textContent='停止';
}
function finishTimer(){if(running)toggleTimer()}
function resetTimer(){running=false;clearInterval(timerId);elapsed=0;document.getElementById('timerBtn').textContent='開始';updateTimer()}

newQuestion();renderItems();updateTimer();
</script>
</body>
</html>
```

> 注意 init 行：`newQuestion();renderItems();updateTimer();` — newQuestion 會 `round++`（0→1）並出第一題；變更人數/物品**不再自動重新出題**（this fixes 先前審查發現的「改人數就跳題＋重設計時器」問題）。

- [ ] **Step 4: 跑測試確認通過**

Run: `node tests/generate.test.mjs`
Expected: 全部 PASS + `全部通過 ✅`，0 FAIL。

- [ ] **Step 5: 確認 round 顯示為第 1 題（init 行為）**

用 Node 快速驗證（或直接用 copy test 覆蓋——Task 2）：`newQuestion()` 在 init 執行一次後 `round=1`。

- [ ] **Step 6: Commit**

```bash
git add "團康遊戲支援前線拍照版題目/index.html" "團康遊戲支援前線拍照版題目/tests/generate.test.mjs"
git commit -m "feat: v2 數量設定版（人數無上限 + 數量框/停用勾 + 全員品項可選）"
```

---

### Task 2: 複製文字格式測試 + 驗證（copy.test.mjs v2）

**Files:**
- Modify: `團康遊戲支援前線拍照版題目/tests/copy.test.mjs`（整份重寫）

**Interfaces:**
- Consumes: Task 1 的 `<script>`（`textForLine`, `round`, `setPeople`, `newQuestion`, `toggleEnabled`, `getItems`, `current` 經 getter）。
- Produces: 複製格式驗證；供 Task 3 部署前全域測試。

- [ ] **Step 1: 重寫 `tests/copy.test.mjs`**

> 完整最終版如下（以此為準）：

```js
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dirname,'..','index.html'),'utf8');
const src = html.match(/<script>([\s\S]*?)<\/script>/)[1] +
  '\nglobalThis.__exports={setPeople,generate,newQuestion,toggleEnabled,getItems,textForLine,getCurrent:()=>current,getRound:()=>round};';

globalThis.document = { getElementById:()=>({style:{},textContent:'',innerHTML:'',value:''}), createElement:()=>({select(){},remove(){},value:'',style:{}}), body:{appendChild(){}} };
Object.defineProperty(globalThis,'navigator',{value:{clipboard:{writeText:async t=>{globalThis.__copied=t}}},configurable:true});
vm.createContext(globalThis);
vm.runInContext(src, globalThis);
const __ = globalThis.__exports;
globalThis.__exports = undefined;

// init 後應為第 1 題
if (__.getRound() !== 1) throw new Error(`初始題號應為第 1 題，實際第 ${__.getRound()} 題`);

let lines = __.textForLine();
if (!lines.includes('支援前線第 1 題')) throw new Error('題號格式錯誤');
if (!lines.includes('請在最快時間內拍照完成')) throw new Error('缺少引導文字');
if (!lines.includes('完成後拍照並傳到群組')) throw new Error('缺少結尾');

// 全員品項在題目中可被隨機捕中且帶數量，輸出格式與一般物品相同（無「全員入鏡」標記）
const allmember = __.getItems().filter(p=>p.act==='member');
if (allmember.length !== 6) throw new Error(`全員品項應為 6 樣，實際 ${allmember.length} 樣`);
__.setPeople(10);
let memberSeen = null;
while (!memberSeen) {
  __.newQuestion();
  memberSeen = __.getCurrent().find(it=>it.act==='member') || null;
}
if (!(memberSeen.qty > 0)) throw new Error('全員品項缺少數量');

lines = __.textForLine();
const memberLine = `${memberSeen.emoji} ${memberSeen.qty} ${memberSeen.name}`;
if (!lines.includes(memberLine)) throw new Error(`輸出格式不符：應含「${memberLine}」`);
if (lines.includes('全員入鏡）')) throw new Error('全員品項不應有（全員入鏡）標記');
console.log('副本格式 OK:\n'+lines);
```

- [ ] **Step 2: 跑測試確認通過**

Run: `node tests/copy.test.mjs`
Expected: 輸出 `副本格式 OK:` 及題目文字；無 throw。

- [ ] **Step 3: 跑 combined（兩個測試都過）**

```powershell
node tests\generate.test.mjs
node tests\copy.test.mjs
```
Expected: 兩者皆過。

- [ ] **Step 4: headless Chrome 驗證渲染（複製 index.html 到 ASCII 暫存路徑）**

```powershell
Copy-Item "團康遊戲支援前線拍照版題目\index.html" "C:\Users\TW-10\AppData\Local\Temp\opencode\v2-live.html"
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless --disable-gpu --dump-dom --virtual-time-budget=2000 "file:///C:/Users/TW-10/AppData/Local/Temp/opencode/v2-live.html"
```
Expected output（dump-dom）包含：`<input id="people" type="number" value="10"`（無 max）、`第 1 題`、`class="item"` 的物品列、`type="checkbox"` 的停用勾、數量 input（`min="0"`）。

- [ ] **Step 5: Commit**

```bash
git add "團康遊戲支援前線拍照版題目/tests/copy.test.mjs"
git commit -m "test: v2 複製文字格式驗證（含全員品項）"
```

---

### Task 3: 部署（獨立 repo 同步 + Firebase + Pages 驗證）

**Files:**
- Create/Modify: `C:\Users\TW-10\AppData\Local\Temp\opencode\bbq-support-front-repo\`（獨立 repo clone）內同步更新 `index.html`、`tests\`、`docs\`（含新 v2 spec/plan）
- 部署目標：Firebase `bbq-support-front-sk`（project `opencode-sk`）；GitHub Pages `bbq-support-front`

**Interfaces:**
- Consumes: Task 1/2 完成後的 `index.html` + 兩個測試 + spec/plan 文件。
- Produces: 線上兩站更新。

- [ ] **Step 1: 全測試複跑確認**

```powershell
node tests\generate.test.mjs
node tests\copy.test.mjs
```
Expected: 皆 PASS。

- [ ] **Step 2: 同步到獨立 repo clone**

將 `團康遊戲支援前線拍照版題目\index.html`、`tests\generate.test.mjs`、`tests\copy.test.mjs`、以及 `docs\superpowers\specs\2026-09-23-bbq-photo-challenge-v2-design.md`、`docs\superpowers\plans\2026-09-23-bbq-photo-challenge-v2.md` 複製到 `bbq-support-front-repo\` 對應路徑（firebase.json/.firebaserc/.gitignore 維持不變）。

```powershell
$src="C:\Users\TW-10\Documents\firebase雲端資料夾\團康遊戲支援前線拍照版題目"
$dst="C:\Users\TW-10\AppData\Local\Temp\opencode\bbq-support-front-repo"
Copy-Item "$src\index.html" "$dst\index.html" -Force
Copy-Item "$src\tests\generate.test.mjs" "$dst\tests\generate.test.mjs" -Force
Copy-Item "$src\tests\copy.test.mjs" "$dst\tests\copy.test.mjs" -Force
New-Item -ItemType Directory -Force -Path "$dst\docs\superpowers\specs","$dst\docs\superpowers\plans" | Out-Null
Copy-Item "$src\docs\superpowers\specs\2026-09-23-bbq-photo-challenge-v2-design.md" "$dst\docs\superpowers\specs\" -Force
Copy-Item "$src\docs\superpowers\plans\2026-09-23-bbq-photo-challenge-v2.md" "$dst\docs\superpowers\plans\" -Force
```

- [ ] **Step 3: 獨立 repo 內全測試**

```powershell
node tests\generate.test.mjs
node tests\copy.test.mjs
```
Expected: 皆 PASS（clone 內跑）。

- [ ] **Step 4: 提交並推送獨立 repo**

```bash
git add -A
git commit -m "feat: v2 數量設定版（人數無上限 + 數量框/停用勾 + 全員品項可選）"
git push -u origin main
```

- [ ] **Step 5: Firebase 部署（從獨立 repo clone 目錄）**

```powershell
# 在 bbq-support-front-repo 目錄
firebase deploy --only hosting
```
Expected: 成功，顯示 `https://bbq-support-front-sk.web.app`。

- [ ] **Step 6: 驗證兩個 URL**

```powershell
Invoke-WebRequest "https://bbq-support-front-sk.web.app" -UseBasicParsing | Select StatusCode
Invoke-WebRequest "https://jeff79213-baba.github.io/bbq-support-front/" -UseBasicParsing | Select StatusCode
```
Expected: 兩者 200。且回應內容包含 `<input id="people" type="number" value="10"`、`第 1 題`、`停用`。

- [ ] **Step 7: 網址.txt 確認**

`團康遊戲支援前線拍照版題目\網址.txt` 維持 v1 內容（URL 不變），不需改動。

- [ ] **Step 8: Self-Review**

- firebase.json `site` = `bbq-support-front-sk`、`.firebaserc` default = `opencode-sk`（未改）
- 獨立 repo 僅含本專案檔案；無機密；`let round=0` 存在於部署版
- 兩 URL 200 且為 v2（無 `max="30"`、含停用勾）
- monorepo 有 Task1/2 commit；獨立 repo 有對應 commit 並已 push

---

### Self-Review（整份計畫）

**1. Spec 覆蓋：**
- ✅ 人數無上限：Task 1（HTML 去 max + `setPeople` 無 clamp）+ 測試 1、7
- ✅ 數量框＋停用勾、設定即獨立、手動數字優先：Task 1（`renderItems`、`setCustomQty`、`toggleEnabled`）+ 測試 3、4
- ✅ 未填自動規則（器官 30~80%、其餘 1）：Task 1 `itemQty`/`organQty` + 測試 2、8
- ✅ 全員品項 6 樣併入可選、移除 40%/成員bonus/➕鈕：Task 1（`MEMBERS`+`ITEMS`、render/textForLine 輸出同格式無標記）
- ✅ 事件不跳題：Task 1 `newQuestion` 僅由🎲觸發 + 測試 7
- ✅ 全部停用阻擋：Task 1 `requireOneEnabled` + 測試 6
- ✅ 複製格式（全員品項 `${emoji} ${qty} ${name}` 同格式）：Task 2
- ✅ 計時器沿用：Task 1（未改）
- ✅ 修改題目 1~99：Task 1 `editQty`
- ✅ 跨項目一致型別：`ITEMS` 每項 `{id,emoji,name,per,body,act}`；`enabled`:Set；`customQty`:object；`current` 每項 `{emoji,name,qty,body,act,id}`；`round`:number。

**2. Placeholder scan：** 無 TBD/TODO；所有步驟含完整程式碼。

**3. Type/命名一致性：** `setPeople/generate/newQuestion/organQty/setCustomQty/toggleEnabled/getItems/getCurrent/getPeople/getRound` 在 Task1 測試、Task2 測試、Task3 部署間引用一致。`textForLine` 有輸出。`toggleItem`（現語意＝停用切換）命名保留但行為改變；測試用新的 `toggleEnabled` 名稱，二者對應同一函式——**注意**：`toggleItem` 與 `toggleEnabled` 在 index.html 中為同一個函式的兩個別名會造成重複定義混亂，計畫已統一只用 `toggleEnabled`（見 Task 1 Step 3 原始碼），`toggleItem` 已移除。

> 上述已確認：Task 1 原始碼中事件區只有 `toggleEnabled`（無 `toggleItem`），測試也只用 `toggleEnabled`。型別一致。

---

**執行交接：** 計畫完成。依 AGENTS.md 與 superpowers 規則預設**Subagent-Driven** 執行（每任務新 subagent、任務間審查）。