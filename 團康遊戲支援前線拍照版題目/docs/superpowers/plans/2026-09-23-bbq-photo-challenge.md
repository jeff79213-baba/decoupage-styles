# 烤肉支援前線拍照版出題器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立可執行的 `index.html` 出題器，主持人設定人數、勾選可用物品後隨機出題，複製題目貼到 LINE 群組。

**Architecture:** 單一 HTML 檔案（純前端、無外部依賴）。物品資料用陣列定義，含「器官類 / 一般類」標記；出題從「已勾選物品」隨機挑 3~5 樣，器官類數量=人數×30~80%，一般類數量=1，40% 機率附加全員品項。沿用原版深色 UI 與計時器。

**Tech Stack:** 原生 HTML/CSS/JavaScript，Node.js 跑單元測試，headless Chrome 做驗證。

## Global Constraints

- 檔案必須儲存為 `index.html`（修正 `.txt` 無法執行的根因）
- 人數範圍 2~30，預設 10
- 身體器官四樣：☝️手指、🤲手、🦶腳、👤臉，數量 = 人數 × 30~80%，四捨五入且最少 1
- 一般物品數量固定 = 1
- 每題從已勾選清單隨機出 3~5 樣一般物品
- 40% 機率自動附加 1 個全員入鏡品項；另有「➕全員題」按鈕手動新增
- 所有物品預設全勾選，取消勾選的不會出題
- 修改題目：數量可手動改（範圍 1~99）
- 複製格式固定（見 spec）：複製後貼 LINE 群組可讀
- 保留計時器（開始/停止/完成/重設）

---

### Task 1: 建立 index.html 骨架與核心資料結構

**Files:**
- Create: `index.html`（完整頁面含 CSS、HTML 結構、JS 資料）
- Test: `tests/generate.test.mjs`（抽離 JS 邏輯層的單元測試）

**Interfaces:**
- Produces: 全域函式 `rnd(a,b)`、`pick(arr)`、`organQty(people)`、`generate()`、`render()`、`renderItems()`、`renderEdit()`；全域變數 `POOL`、`ALL_MEMBERS`、`peopleCount`、`checkedItems`、`current`、`round'。

- [ ] **Step 1: 建立專案資料夾結構與測試檔**

建立 `tests/generate.test.mjs`：

```js
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// 擷取 index.html 內 <script> 內容
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) throw new Error('找不到 <script>');

// 在 vm 用假 document 執行，並匯出閉包內函式（let 變數用 getter 讀取目前值）
const src = m[1] + `
globalThis.__exports = {
  setPeople, generate, newQuestion, addAll, toggleItem, organQty,
  getCurrent:()=>current, getPeople:()=>peopleCount, getChecked:()=>checkedItems
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

// organNames / generalNames helper
const organs = new Set(['手指','手','腳','臉']);
function organChecks(people) {
  const lo = Math.max(1, Math.round(people*0.3));
  const hi = Math.round(people*0.8);
  return T.getCurrent()
    .filter(x => organs.has(x.name))
    .every(x => x.qty >= lo && x.qty <= hi);
}

// --- 1. 人數邊界：2人與30人，器官數量落在 30~80% 內 ---
T.setPeople(2); T.generate();
assert(organChecks(2), `2人器官數量在 [1,2] => ${JSON.stringify(T.getCurrent())}`);

T.setPeople(30); T.generate();
assert(organChecks(30), `30人器官數量在 [9,24] => ${JSON.stringify(T.getCurrent())}`);

// --- 2. 出題樣數 3~5、一般物品=1、器官合規（50 次抽樣）---
let countOK = true, generalOK = true, organOK = true;
for (let i = 0; i < 50; i++) {
  T.generate();
  const n = T.getCurrent().length;
  if (n < 3 || n > 5) countOK = false;
  for (const it of T.getCurrent()) {
    if (!organs.has(it.name) && it.qty !== 1) generalOK = false;
  }
  if (!organChecks(T.getPeople())) organOK = false;
}
assert(countOK, '50 次抽樣每題皆 3~5 樣');
assert(generalOK, '一般物品數量皆為 1');
assert(organOK, '器官數量皆在 30~80% 範圍');

// --- 3. 取消勾選就不出題 ---
T.toggleItem('phone', {checked:false});
let phoneAppeared = false;
for (let i = 0; i < 30; i++) { T.generate(); if (T.getCurrent().some(x => x.name==='手機')) phoneAppeared = true; }
assert(!phoneAppeared, '取消勾選手機後 30 次都不出手機');
T.toggleItem('phone', {checked:true});

// --- 4. organQty 數學 2000 次抽測（直接用匯出的函式）---
function organQtyRangeOK(people) {
  const lo = Math.max(1, Math.round(people*0.3)), hi = Math.round(people*0.8);
  for (let i=0;i<2000;i++) {
    const q = T.organQty(people);
    if (q < lo || q > hi) return false;
  }
  return true;
}
assert(organQtyRangeOK(2), 'organQty(2) 2000次都在 [1,2]');
assert(organQtyRangeOK(10), 'organQty(10) 2000次都在 [3,8]');
assert(organQtyRangeOK(30), 'organQty(30) 2000次都在 [9,24]');

if (failures) { console.error(`\n共 ${failures} 個失敗`); process.exit(1); }
console.log('\n全部通過 ✅');
```

> 註：`setPeople` 會呼叫 `newQuestion()`（含 `getElementById`），故上方已提供假 `document` stub；`performance` 由 Node ≥16 原生提供，`setInterval` 僅在計時器啟動時使用，測試不執行計時器。

- [ ] **Step 2: 建立 index.html（骨架 + 資料 + 邏輯）**

建立 `index.html`，完整內容如下（此為最終完整檔，Task 2~4 只做功能補強）：

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
  .checkitem{display:flex;align-items:center;gap:10px;padding:4px 0;font-size:16px}
  .checkitem input{width:20px;height:20px;accent-color:var(--accent)}
  .checkitem small{color:var(--muted);margin-left:auto;font-size:12px}
  .emoji{font-size:22px;width:30px;text-align:center;flex-shrink:0}
  .editbox{display:none;margin-top:14px;border-top:1px solid var(--line);padding-top:14px}
  .editrow{display:grid;grid-template-columns:1fr 90px;gap:8px;margin:8px 0}
  input[type=number],input[type=text]{width:100%;background:#151515;color:white;border:1px solid #444;border-radius:10px;padding:10px;font-size:16px}
  .people{display:flex;align-items:center;gap:10px;margin-top:8px}
  .people input{width:90px;text-align:center;font-size:22px;font-weight:800}
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
  .rowbtn{display:flex;gap:9px;margin:0 0 10px}
</style>
</head>
<body>
<div class="wrap">
  <h1>🔥 烤肉團康支援前線</h1>
  <div class="sub">主持人：設定人數 → 勾選可用物品 → 隨機出題 → 複製貼到 LINE</div>

  <div class="card">
    <div class="row"><b>👥 人數</b><span class="label" id="countHint"></span></div>
    <div class="people">
      <button class="secondary" onclick="changePeople(-1)">−</button>
      <input id="people" type="number" min="2" max="30" value="10" onchange="setPeople(this.value)">
      <button class="secondary" onclick="changePeople(1)">＋</button>
    </div>
  </div>

  <div class="card">
    <div class="row"><b>✅ 可用物品</b><button class="secondary" onclick="toggleAll()">全選/全不選</button></div>
    <div id="itemList"></div>
    <p class="tip">器官類（手指/手/腳/臉）數量依人數隨機；其餘物品數量固定 1。取消勾選就不會出。</p>
  </div>

  <div class="card">
    <div class="row">
      <b><span id="roundLabel">第 1 題</span></b>
      <span class="round" id="qCount"></span>
    </div>
    <div id="question" class="question"></div>
    <div class="buttons">
      <button class="secondary" onclick="newQuestion()">🎲 重新出題</button>
      <button class="secondary" onclick="addAll()">📸 加全員題</button>
    </div>
    <div class="buttons">
      <button class="primary" onclick="copyQuestion()">📋 複製題目</button>
      <button class="secondary" onclick="toggleEdit()">✏️ 修改題目</button>
    </div>
    <div id="editbox" class="editbox"></div>
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
const POOL=[
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
const ALL_MEMBERS=[
  {emoji:'📸', name:'全員合照'},
  {emoji:'💛', name:'全員比愛心'},
  {emoji:'✌️', name:'全員比 YA'},
  {emoji:'👍', name:'全員比讚'},
  {emoji:'🕺', name:'全員跳起來'},
  {emoji:'🤝', name:'全員手搭肩'},
];

let peopleCount=10;
let checkedItems=new Set(POOL.map(p=>p.id));
let current=[]; // [{emoji,name,qty,body,member?}]
let memberBonus=null; // 全員品項
let round=1;
let running=false, startAt=0, elapsed=0, timerId=null;

function rnd(a,b){return Math.floor(Math.random()*(b-a+1))+a}
function pick(arr){return arr[Math.floor(Math.random()*arr.length)]}
function organQty(people){
  return Math.max(1, Math.round(people*0.3 + Math.random()*(people*0.5)));
}
function generate(){
  const avail=POOL.filter(p=>checkedItems.has(p.id));
  const n=Math.min(rnd(3,5), avail.length);
  const chosen=[...avail].sort(()=>Math.random()-.5).slice(0,n);
  current=chosen.map(p=>{
    const qty=p.body?organQty(peopleCount):1;
    return {emoji:p.emoji,name:p.name,qty,body:p.body,id:p.id};
  });
  memberBonus = Math.random()<0.4? pick(ALL_MEMBERS) : null;
}
function render(){
  document.getElementById('roundLabel').textContent='第 '+round+' 題';
  document.getElementById('qCount').textContent=current.length+' 樣物品';
  const lines=[];
  for(const it of current){
    lines.push(`<div class="item"><span class="emoji">${it.emoji}</span><span>${it.qty} ${it.name}</span></div>`);
  }
  if(memberBonus){
    lines.push(`<div class="item"><span class="emoji">📸</span><span>${memberBonus.name}（全員入鏡）</span></div>`);
  }
  document.getElementById('question').innerHTML=lines.join('');
  renderEdit();
}
function renderItems(){
  const box=document.getElementById('itemList');
  box.innerHTML=POOL.map(p=>{
    const checked=checkedItems.has(p.id)?'checked':'';
    const cap=p.body?`⛽${p.per}個/人`:`最多${p.per}個`;
    return `<label class="checkitem"><input type="checkbox" ${checked} onchange="toggleItem('${p.id}',this)"><span class="emoji">${p.emoji}</span><span>${p.name}</span><small>${cap}</small></label>`;
  }).join('');
}
function renderEdit(){
  document.getElementById('editbox').innerHTML=current.map((it,i)=>`
    <div class="editrow">
      <span style="display:flex;align-items:center;gap:8px"><span class="emoji">${it.emoji}</span> ${it.name}</span>
      <input type="number" min="1" max="99" value="${it.qty}" onchange="editQty(${i},this.value)">
    </div>`).join('');
}
// ---------- 事件 ----------
function toggleItem(id,el){
  if(el.checked) checkedItems.add(id); else checkedItems.delete(id);
  requireOneChecked();
}
function toggleAll(){
  const allOn=[...POOL].every(p=>checkedItems.has(p.id));
  if(allOn){checkedItems=new Set();} else {checkedItems=new Set(POOL.map(p=>p.id));}
  renderItems();newQuestion();
}
function requireOneChecked(){
  if(checkedItems.size===0){
    document.getElementById('copied').textContent='⚠️ 至少勾選一種物品';
    return false;
  }
  return true;
}
function changePeople(d){
  setPeople(Number(document.getElementById('people').value)+d);
}
function setPeople(v){
  peopleCount=Math.max(2,Math.min(30,Math.round(Number(v)||10)));
  document.getElementById('people').value=peopleCount;
  document.getElementById('countHint').textContent=peopleCount+' 人';
  newQuestion();
}
function newQuestion(){
  if(!requireOneChecked()) return;
  round++;
  generate();
  render();
  resetTimer();
  document.getElementById('copied').textContent='';
}
function addAll(){
  if(!memberBonus) memberBonus=pick(ALL_MEMBERS);
  else memberBonus=pick(ALL_MEMBERS);
  render();
  document.getElementById('copied').textContent='';
}
function editQty(i,v){current[i].qty=Math.max(1,Math.min(99,Number(v)||1));render()}
function toggleEdit(){
  const e=document.getElementById('editbox');
  e.style.display=e.style.display==='grid'?'none':'grid';
}
function textForLine(){
  const lines=current.map(it=>`${it.emoji} ${it.qty} ${it.name}`).join('\n');
  const memberLine=memberBonus?`\n📸 ${memberBonus.name}（全員入鏡）`:'';
  return `🔥 支援前線第 ${round} 題\n\n請在最快時間內拍照完成：\n\n${lines}${memberLine}\n\n📸 完成後拍照並傳到群組！`;
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

generate();render();renderItems();updateTimer();setPeople(peopleCount);
</script>
</body>
</html>
```

- [ ] **Step 3: 將 index.html 另存為 UTF-8 並驗證編碼**

用 PowerShell 讀回確認無 BOM、UTF-8 正常：

```powershell
$b = [System.IO.File]::ReadAllBytes((Resolve-Path 'index.html'))
($b[0..2] | ForEach-Object { $_.ToString('X2') }) -join ' '
# 期望輸出開頭為 3C 21 64（即 <!d……），代表無 BOM 的正常 UTF-8
```

- [ ] **Step 4: 執行單元測試**

Run: `node tests/generate.test.mjs`
Expected: `全部通過 ✅`，無任何 `FAIL:` 出現。

- [ ] **Step 5: Commit**

```bash
git add 團康遊戲支援前線拍照版題目/index.html 團康遊戲支援前線拍照版題目/tests/generate.test.mjs
git commit -m "feat: 烤肉支援前線拍照版出題器（人數+勾選+器官隨機數量）"
```

---

### Task 2: 以 headless Chrome 驗證實際生成與複製功能

**Files:**
- Test: 無新檔，用 headless Chrome 直接驗證

**Interfaces:**
- Consumes: Task 1 產生的 `index.html`

- [ ] **Step 1: 用 headless Chrome 開啟 index.html，檢查題目有渲染**

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless --disable-gpu --dump-dom --virtual-time-budget=2000 "file:///C:/Users/TW-10/Documents/firebase%E9%9B%B2%E7%AB%AF%E8%B3%87%E6%96%99%E5%A4%BE/%E5%9C%98%E5%BA%B7%E9%81%8A%E6%88%B2%E6%94%AF%E6%8F%B4%E5%89%8D%E7%B7%9A%E6%8B%8D%E7%85%A7%E7%89%88%E9%A1%8C%E7%9B%AE/index.html" 2>$null
```

（若 URL 編碼失敗，先複製到暫存 ASCII 路徑測試）期望輸出包含 `<div id="question" class="question">` 且下一行包含 `<div class="item">…x 樣物品。</div>`、`10 人`、勾選 checkbox。

- [ ] **Step 2: 用 PowerShell 驗證複製文字格式**

撰寫測試腳本 `tests/copy.test.mjs`，模擬 `navigator.clipboard` 並擷取 `textForLine()`：

```js
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dirname,'..','index.html'),'utf8');
const src = html.match(/<script>([\s\S]*?)<\/script>/)[1] +
  '\nglobalThis.__exports={textForLine,current,round,setPeople,newQuestion};';

globalThis.document = { getElementById:()=>({style:{},textContent:'',innerHTML:''}), createElement:()=>({select(){},remove(){}}), body:{appendChild(){}} };
globalThis.navigator = { clipboard: { writeText: async t => { globalThis.__copied = t; } } };
vm.createContext(globalThis);
vm.runInContext(src, globalThis);
const __ = globalThis.__exports;

// 人數設定 & 出題
__.setPeople(10);
const lines = __.textForLine();
if (!lines.includes('支援前線第 2 題')) throw new Error('題號格式錯誤');
if (!lines.includes('請在最快時間內拍照完成')) throw new Error('缺少引導文字');
if (!lines.includes('完成後拍照並傳到群組')) throw new Error('缺少結尾');
console.log('副本格式 OK:\n'+lines);
```

Run: `node tests/copy.test.mjs`
Expected: 輸出 `副本格式 OK:` 及其後的完整題目文字。

- [ ] **Step 3: Commit**

```bash
git add 團康遊戲支援前線拍照版題目/tests/copy.test.mjs
git commit -m "test: 複製文字格式驗證"
```

---

### Task 3: 修正 `.txt` 舊檔並清理

**Files:**
- Rename: 刪除舊 `chatgpt內碼.txt`（內容已過時、無法執行）
- Keep: `index.html`

- [ ] **Step 1: 刪除舊的 .txt 檔**

```powershell
Remove-Item "chatgpt內碼.txt"
```

- [ ] **Step 2: 確認目錄最終狀態**

```powershell
Get-ChildItem -Recurse -File | Select-Object FullName,Length
```

期望列出 `index.html`、`tests\generate.test.mjs`、`tests\copy.test.mjs`、`docs\…`（無 `.txt`）。

- [ ] **Step 3: Commit**

```bash
git rm "團康遊戲支援前線拍照版題目/chatgpt內碼.txt"
git commit -m "chore: 移除無法執行的舊 .txt 原始檔"
```

---

### Task 4: 部署到 Firebase Hosting / GitHub Pages

**Files:**
- Create: `firebase.json`、`.firebaserc`、`.gitignore`
- Create: `網址.txt`

- [ ] **Step 1: 檢查 site 名稱衝突**

```powershell
firebase hosting:sites:list --project opencode-sk
```

- [ ] **Step 2: 建立 firebase.json / .firebaserc / .gitignore**

`firebase.json`：
```json
{
  "hosting": {
    "site": "bbq-support-front-sk",
    "public": ".",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**", "tests/**", "docs/**", "*.txt"]
  }
}
```

`.firebaserc`：
```json
{
  "projects": { "default": "opencode-sk" },
  "targets": { "opencode-sk": { "hosting": { "bbq-support-front": ["bbq-support-front-sk"] } } }
}
```

`.gitignore`：
```
node_modules/
.firebase/
*.log
```

- [ ] **Step 3: 建立 Firebase Hosting site（若不存在）**

```powershell
firebase hosting:sites:create bbq-support-front-sk --project opencode-sk
```

- [ ] **Step 4: 部署**

```powershell
firebase deploy --only hosting
```

- [ ] **Step 5: 建立網址.txt**

```
GitHub: https://github.com/jeff79213-baba/<repo>
GitHub Pages: https://jeff79213-baba.github.io/<repo>/
Firebase: https://bbq-support-front-sk.web.app
```

- [ ] **Step 6: Commit**

```bash
git add 團康遊戲支援前線拍照版題目/firebase.json 團康遊戲支援前線拍照版題目/.firebaserc 團康遊戲支援前線拍照版題目/.gitignore 團康遊戲支援前線拍照版題目/網址.txt
git commit -m "deploy: 支援前線拍照版部署設定與網址"
```

---

### Self-Review

**1. Spec 覆蓋檢查：**
- ✅ `.txt` → `index.html`：Task 1 建立、Task 3 刪除舊檔
- ✅ 人數 2~30 預設 10：Task 1 `setPeople` clamp
- ✅ 器官 30~80%：`organQty` + Task 1 測試
- ✅ 一般物品=1：Task 1 測試
- ✅ 3~5 樣隨機：Task 1 測試
- ✅ 40% 全員品項 + 手動加全員題：`memberBonus`、`addAll`、`➕全員題`按鈕
- ✅ 全勾選可取消：`checkedItems`、`toggleAll`
- ✅ 修改數量 1~99：`editQty`
- ✅ 複製格式 & LINE：`copyQuestion` + Task 2 測試
- ✅ 計時器：沿用原版

**2. Placeholder scan:** 無 TBD/TODO，所有步驟含實際程式碼。

**3. Type consistency：** `POOL` 欄位 `id/emoji/name/per/body`；`checkedItems` 為 Set；`current` 每項 `{emoji,name,qty,body,id}`；`memberBonus` 為 `{emoji,name}` 或 null。`generate/render/renderItems/renderEdit/newQuestion/addAll/editQty/setPeople/changePeople/toggleItem/toggleAll/copyQuestion/textForLine` 在 Task 1 定義、Task 2/4 引用一致。