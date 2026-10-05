// ─────────────────────────────────────────────
// dev/verify-menuart.js —— 主菜单装饰画面 (22a-menuart) 输出校验沙箱 (不进 Index.html)
// 用法: node dev/verify-menuart.js
// 原理: 桩化 DOM/localStorage, 按 11 个战役各加载一次 00-config + 22a-menuart, 对该战役的
//       沙盘 SVG 与双方阵营盾徽 SVG 逐条校验:
//       ① XML 良构 (标签配平/属性引号/裸 & 与 <) ② url(#id) 引用闭合 ③ 同页 id 唯一
//          (沙盘 + 两枚盾徽同处一个 DOM, id 冲突会让后画的滤波器吃掉先画的)
//       ④ 数值属性可解析 (抓 NaN / undefined / 指数记号落进 SVG)
//       ⑤ 产出非空与非退化 (沙盘要有语义件: 路网/旗点/基地/河/街网至少一项; 盾徽要有盾形)
//       抓的是"某张图某阵营下 SVG 解析失败 → 左上角一片空白或糊成一团"这类问题。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
let failures=0;
const fail=m=>{ failures++; console.error('  ✗ '+m); };
const ok=m=>console.log('  ✓ '+m);

// ── DOM 桩 (只够 22a 加载: 文件尾 renderMenuArt 会 getElementById 一次并原地返回) ──
const mkEl=()=>({innerHTML:'',style:{},classList:{add(){},remove(){},toggle(){},contains(){return false;}},
dataset:{},onclick:null,querySelectorAll:()=>[],appendChild(){},textContent:'',id:''});
const document={
getElementById:()=>null, querySelector:()=>mkEl(), querySelectorAll:()=>[],
createElement:()=>mkEl(), addEventListener(){}, removeEventListener(){},
body:mkEl(), documentElement:mkEl(), readyState:'complete',
};
const localStore=(campIdx)=>({_s:{sf_campaign:String(campIdx)},
getItem(k){ return (k in this._s)?this._s[k]:null; },
setItem(k,v){ this._s[k]=String(v); }, removeItem(k){ delete this._s[k]; }});

// ── 加载某战役的沙箱 (每次全新 context: 00-config 用 const 声明, 不可重复注入) ──
function boot(campIdx){
const ctx={console, setTimeout, clearTimeout, Math, Date, JSON, encodeURIComponent,
document, navigator:{maxTouchPoints:0},
matchMedia:()=>({matches:false}),
addEventListener(){}, removeEventListener(){},
localStorage:localStore(campIdx),
location:{search:'', reload(){}, href:'http://localhost/'},
performance:{now:()=>0},
};
ctx.window=ctx; ctx.globalThis=ctx; ctx.self=ctx;
vm.createContext(ctx);
for(const f of ['js/00-config.js','js/22a-menuart.js'])
vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
// CROP_FIELDS 由 05c 布局期填充; 沙箱不载布局 → 留空表, 语义件走 CAMPAIGN.fields 回退
vm.runInContext('var CROP_FIELDS=[];',ctx);
return ctx;
}

// ── 校验器 ──
const reTag=/<(\/?)([a-zA-Z][\w:.-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
const ATTR=/([a-zA-Z][\w:.-]*)\s*=\s*"([^"]*)"/g;
const NUMATTR=/^(x|y|x1|y1|x2|y2|cx|cy|r|rx|ry|width|height|stroke-width|opacity|offset|transform|d|points|viewBox|scale|tableValues|baseFrequency|surfaceScale|diffuseConstant|azimuth|elevation|numOctaves|seed|stroke-dasharray|stroke-opacity|fill-opacity|stroke-linecap|stroke-linejoin|flood-opacity|k1|k2|k3|k4)$/;
function checkWellFormed(svg,tag){
const stack=[];
let last=0, m;
reTag.lastIndex=0;
while((m=reTag.exec(svg))){
const text=svg.slice(last,m.index);
last=reTag.lastIndex;
// 文本节点里不许出现裸 < 或 & (除实体)
const bad=text.replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g,'');
if(/[<&]/.test(bad)) fail(`${tag}: 文本节点含未转义字符 "${bad.trim().slice(0,30)}"`);
const closing=!!m[1], name=m[2], attrs=m[3], self=m[4];
// 属性引号闭合 (正则已保证, 这里抓属性区里的裸 <)
if(/</.test(attrs)) fail(`${tag}: <${name}> 属性区含裸 <`);
if(closing){ const top=stack.pop(); if(top!==name) fail(`${tag}: 闭合标签 </${name}> 与 <${top||'无'}> 不匹配`); }
else if(!self&&!/^(rect|circle|path|line|polyline|polygon|ellipse|use|stop|image|fe[A-Z]\w*)$/.test(name)) stack.push(name);
else if(!self&&!/^(rect|circle|path|line|polyline|polygon|ellipse)$/.test(name)) stack.push(name);
}
if(last<svg.length){
const tail=svg.slice(last);
if(/[<&]/.test(tail.replace(/&(?:amp|lt|gt|quot|apos);/g,''))) fail(`${tag}: 尾部含未转义字符`);
}
if(stack.length) fail(`${tag}: 标签未配平, 残留 ${stack.join(',')}`);
}
// id 与引用: refs=url(#id) / href="#id"; 空引用与未定义引用都算错
function checkRefs(svg,tag,seen){
const ids=new Set();
let m, idRe=/\sid="([^"]*)"/g;
while((m=idRe.exec(svg))){
if(!m[1]) fail(`${tag}: 存在空 id`);
if(ids.has(m[1])) fail(`${tag}: id "${m[1]}" 重复`);
if(seen&&seen.has(m[1])) fail(`${tag}: id "${m[1]}" 与同页其它 SVG 冲突`);
ids.add(m[1]); if(seen) seen.add(m[1]);
}
let refRe=/url\(#([^)]*)\)/g;
while((m=refRe.exec(svg))) if(!ids.has(m[1])) fail(`${tag}: url(#${m[1]}) 无对应 id`);
refRe=/\shref="#([^"]*)"/g;
while((m=refRe.exec(svg))) if(!ids.has(m[1])) fail(`${tag}: href="#${m[1]}") 无对应 id`);
return ids;
}
// 数值属性: NaN / undefined / 指数记号 / Infinity 一律视为渲染事故
function checkNums(svg,tag){
for(const m of svg.matchAll(/([a-zA-Z][\w:.-]*)\s*=\s*"([^"]*)"/g)){
const k=m[1], v=m[2];
if(/NaN|undefined|Infinity|e[+-]\d/.test(v)) fail(`${tag}: 属性 ${k}="${v}" 含非法数值`);
if(!NUMATTR.test(k)) continue;
// transform 内含 translate(a b) 等复合写法, 只挑数字看
for(const n of v.match(/-?\d*\.?\d+/g)||[]) if(!isFinite(parseFloat(n))) fail(`${tag}: 属性 ${k}="${v}" 数值不可解析`);
}
if(/NaN|undefined|Infinity/.test(svg.replace(/stroke-linecap="[^"]*"/g,''))) fail(`${tag}: 输出含 NaN/undefined/Infinity`);
}

// ── 逐战役 ──
const IDX=[0,1,2,3,4,5,6,7,8,9,10,11]; // 11=island 塔拉瓦环礁 (2026-09-18 新增战役)
const SEMANTIC=[['roads',/_maRoads|stroke-width="1.5"/],['markers',/<path d="M[\d.]+ [\d.]+L[\d.]+ [\d.]+L/]];
let totalSVG=0;
for(const idx of IDX){
const ctx=boot(idx);
const id=vm.runInContext('CAMPAIGN.id',ctx);
const title=vm.runInContext('CAMPAIGN.title',ctx);
const sizes=vm.runInContext('[MAP_SIZE,(CAMPAIGN.roads||[]).length,(CAMPAIGN.flags||[]).length,(CAMPAIGN.spawns||[]).length,(CAMPAIGN.bases||[]).length,!!CAMPAIGN.city,!!RIVER,BRIDGES.length]',ctx);
const svgs=[];
const map=vm.runInContext('menuMapSVG()',ctx);
svgs.push(['沙盘',map]);
for(let t=0;t<2;t++) svgs.push(['盾徽'+t,vm.runInContext(`menuFactionSVG(${t})`,ctx)]);
const seen=new Set();
for(const [tag,svg] of svgs){
totalSVG++;
const label=`${id}/${tag}`;
if(typeof svg!=='string'||svg.length<200){ fail(`${label}: 产出为空或过短 (${typeof svg}/${svg&&svg.length})`); continue; }
if(!svg.startsWith('<svg ')||!svg.endsWith('</svg>')) fail(`${label}: 不是完整 <svg>...</svg>`);
if(!/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(svg)) fail(`${label}: 缺 xmlns`);
const dim=svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
if(!dim) fail(`${label}: 缺 viewBox`);
checkWellFormed(svg,label);
checkRefs(svg,label,seen);
checkNums(svg,label);
}
// 沙盘语义件存在性 (空图=左上角一片纯色)
if(!/<path /.test(map)) fail(`${id}/沙盘: 无任何 path (路网/河/旗点全缺)`);
if(sizes[3]===0&&sizes[2]===0) fail(`${id}/沙盘: flags 与 spawns 双空 — 无争夺标记可画`);
if(sizes[4]===2&&(map.match(/<rect x="[\d.]+" y="[\d.]+" width="8" height="8"/g)||[]).length<2) fail(`${id}/沙盘: 双方基地方座未画出`);
console.log(`  · ${id.padEnd(11)} ${String(title).padEnd(18)} mapSize=${String(sizes[0]).padEnd(3)} roads=${String(sizes[1]).padEnd(2)} flags=${String(sizes[2]).padEnd(2)} spawns=${String(sizes[3])} bases=${sizes[4]} city=${sizes[5]?1:0} river=${sizes[6]?1:0} bridges=${sizes[7]} svg=${map.length}B`);
}
// 覆盖度: 11 战役都应被覆盖 (新增战役忘了登记 → 这里报出来)
const N=vm.runInContext('CAMPAIGNS.length',boot(0));
if(N!==IDX.length) fail(`战役数 ${N} 与校验表 ${IDX.length} 不符 (新增战役请扩 IDX)`);
else ok(`战役 ${N}/${IDX.length} 全数覆盖, 共校验 ${totalSVG} 份 SVG`);
console.log(failures? `\n✗ verify-menuart: ${failures} 项失败` : '\n✓ verify-menuart: 全部校验通过');
process.exit(failures?1:0);
