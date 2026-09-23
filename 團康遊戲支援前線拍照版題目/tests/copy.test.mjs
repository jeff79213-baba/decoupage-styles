import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dirname,'..','index.html'),'utf8');
const src = html.match(/<script>([\s\S]*?)<\/script>/)[1] +
  '\nglobalThis.__exports={setPeople,generate,newQuestion,toggleEnabled,getItems:()=>ITEMS,textForLine,getCurrent:()=>current,getRound:()=>round};';

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