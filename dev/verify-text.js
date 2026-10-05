// ─────────────────────────────────────────────
// dev/verify-text.js —— 文本资源体检 (2026-09-18b 编码事故后新增, 不进 Index.html)
// 用法: node dev/verify-text.js
// 断言: ① 全仓文本文件均为合法 UTF-8 (无替换字符/无非法字节) ② index.html 的静态 i18n 文案
//       全部在 00b-i18n 词典里有中文原文键 (裸 data-i18n 节点靠"首见盖章"取键, 漏一条就漏译)
//       ③ index.html 的 js 引用与 js/ 目录一一对应 (不多不少) 且版本戳唯一
// 背景: 用 PowerShell Get-Content/Set-Content 改过 index.html 一次, 本机默认按 GBK 解码 UTF-8,
//       一趟就把整份 HTML 二次编码损坏且**不可逆** —— 本脚本是那次事故的常驻防线 (纲领 §八 陷阱 23)。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
let FAIL=0;
const ok=(n,c,d)=>{ if(c) console.log('  ✔ '+n+(d?'  ('+d+')':'')); else { FAIL++; console.log('  ✗ '+n+'  '+(d||'')); } };
const dec=new TextDecoder('utf-8',{fatal:true});
function walk(dir,out){
for(const e of fs.readdirSync(dir,{withFileTypes:true})){
if(e.name==='.git'||e.name==='node_modules'||e.name==='.zcode') continue;
// dev/out = 探针产物的落地目录 (截图 / 报告 / PowerShell Tee-Object 抓的日志), 是**构建垃圾**不是源文本:
// 它们常被 `... | Tee-Object -FilePath dev/out/x.txt` 以本机默认 GBK 写出, 天然不是 UTF-8。
// 本脚本的目的是守"人改坏的源文件", 把产物目录一起扫会稳定误报 (2026-09-20 复核)。
if(e.name==='out'&&path.basename(dir)==='dev') continue;
const p=path.join(dir,e.name);
if(e.isDirectory()) walk(p,out);
else if(/\.(js|css|html|md|json|txt)$/.test(e.name)) out.push(p);
}
return out;
}
console.log('== 文本资源体检 (dev/verify-text.js) ==');
// ① 编码
const files=walk(root,[]);
const bad=[];
for(const f of files){
let txt;
try{ txt=dec.decode(fs.readFileSync(f)); }
catch(e){ bad.push(path.relative(root,f)+' (非法 UTF-8)'); continue; }
const n=txt.split('\uFFFD').length-1;
if(n) bad.push(path.relative(root,f)+' ('+n+' 个替换字符)');
}
ok('① 全仓文本文件编码合法 (UTF-8 无替换字符)', bad.length===0, files.length+' 个文件'+(bad.length?(' 异常: '+bad.join(', ')):''));
// ② i18n 键闭环
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const dict=fs.readFileSync(path.join(root,'js/00b-i18n.js'),'utf8');
const keys=new Set();
for(const m of html.matchAll(/<([a-z0-9]+)([^>]*\bdata-i18n(?:-html)?(?:="")?[^>]*)>([\s\S]*?)<\/\1>/g)){
const inner=m[3].replace(/\s+/g,' ').trim();
if(inner&&inner.length<600) keys.add(inner);
}
const miss=[...keys].filter(k=>dict.indexOf("'"+k+"'")<0);
ok('② index.html 静态文案在词典里有键', miss.length===0, keys.size+' 条'+(miss.length?(' 缺: '+miss.map(k=>JSON.stringify(k.slice(0,60))).join(', ')):''));
// ③ 脚本链与版本戳
const listed=[...html.matchAll(/<script src="js\/([^"?]+)\?v=([^"]+)"/g)];
const names=listed.map(m=>m[1]).sort();
const stamps=[...new Set(listed.map(m=>m[2]))];
const onDisk=fs.readdirSync(path.join(root,'js')).sort();
const missing=onDisk.filter(f=>names.indexOf(f)<0);
const extra=names.filter(f=>onDisk.indexOf(f)<0);
ok('③ index.html 的 js 引用与 js/ 目录一一对应', missing.length===0&&extra.length===0,
listed.length+' 个 script'+(missing.length?(' 漏: '+missing.join(',')):'')+(extra.length?(' 多: '+extra.join(',')):''));
ok('③ 全部 js/css 引用同一版本戳', stamps.length===1, stamps.join(','));
console.log(FAIL?('\n✗ verify-text: '+FAIL+' 项失败'):'\n✓ verify-text: 全部通过');
process.exit(FAIL?1:0);
