import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dirname,'..','index.html'),'utf8');
const src = html.match(/<script>([\s\S]*?)<\/script>/)[1] +
  '\nglobalThis.__exports={textForLine,current,round,setPeople,newQuestion};';

globalThis.document = { getElementById:()=>({style:{},textContent:'',innerHTML:''}), createElement:()=>({select(){},remove(){}}), body:{appendChild(){}} };
Object.defineProperty(globalThis,'navigator',{value:{clipboard:{writeText:async t=>{globalThis.__copied=t}}},configurable:true});
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