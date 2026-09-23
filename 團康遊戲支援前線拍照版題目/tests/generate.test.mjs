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

const sharedEl = {style:{},textContent:'',innerHTML:'',value:''};
globalThis.document = {
  getElementById:()=>sharedEl,
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

// --- 8. 手動數字勝過器官公式：body 器官手動優先 ---
T.setPeople(10);
T.setCustomQty('hand', '3');
let manualOrgOK = true;
for (let i = 0; i < 20; i++) {
  T.generate();
  for (const it of T.getCurrent()) {
    if (it.id === 'hand' && it.qty !== 3) manualOrgOK = false;
  }
}
assert(manualOrgOK, '手(器官)設數字 3 後 20 次抽樣皆用手動 3');
T.setCustomQty('hand', '');

// --- 9. 設 0 回復自動：自訂數量清除 ---
T.setCustomQty('shoe', '4');
let shoeManualOK = true;
for (let i = 0; i < 30; i++) {
  T.generate();
  for (const it of T.getCurrent()) {
    if (it.id === 'shoe' && it.qty !== 4) shoeManualOK = false;
  }
}
assert(shoeManualOK, '鞋子設數字 4 後 30 次抽樣皆用手動 4');
T.setCustomQty('shoe', '0');
let shoeAutoOK = false;
for (let i = 0; i < 100; i++) {
  T.generate();
  for (const it of T.getCurrent()) {
    if (it.id === 'shoe' && it.qty === 1) shoeAutoOK = true;
  }
}
assert(shoeAutoOK, '鞋子改設 0 後 100 次內出現自動值 1（手動 4 已清除）');

// --- 10. 全部停用寫入警告、重新啟用後 #copied 自癒清空 ---
document.getElementById('copied').textContent = '';
const allIds = T.getItems().map(p=>p.id);
allIds.forEach(id => T.toggleEnabled(id, {checked:true}));
assert(document.getElementById('copied').textContent.includes('至少啟用'), '全部停用後 #copied 顯示「至少啟用一種物品」警告');
T.toggleEnabled('phone', {checked:false});
assert(document.getElementById('copied').textContent === '', '重新啟用一項後警告訊息自癒清空');
allIds.forEach(id => T.toggleEnabled(id, {checked:false}));

// --- 11. organQty 數學 2000 次抽測 ---
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
