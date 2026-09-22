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