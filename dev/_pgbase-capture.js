// ─────────────────────────────────────────────
// dev/_pgbase-capture.js —— 农村群系(farm)基线指纹抓取 (2026-10-07e 群系化批)
// 在 00c 群系化改造**之前**运行: 用当前代码抓 N 个种子的结构全量 JSON,
// 供 verify-procgen 在改造后逐位比对 (farm 同种子零漂移承诺的回归锚)。
// 群系哈希公式必须与 00-config PG_BIOMES 抽取一致 (splitmix32 终混, 键序 farm/town/water)。
// 用法: node dev/_pgbase-capture.js
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
function biomeOf(seed){
 let h=(seed^0x9E3779B9)>>>0;
 h=(Math.imul(h,0x85EBCA6B)^(h>>>13))>>>0;
 h=(Math.imul(h,0xC2B2AE35)^(h>>>16))>>>0;
 return ['farm','town','water'][h%3];
}
// 先探 procgen 序号 (末位战役) —— CAMPAIGN 在 00-config 执行期绑定, sf_campaign 必须先于载入就位
const PGN=(function(){ const c=makeCtx(null,0); return vm.runInContext('CAMPAIGNS.length-1',c); })();
function makeCtx(seed,campIdx){
 const store={sf_campaign:String(campIdx!==undefined?campIdx:PGN)};
 if(seed!==null&&seed!==undefined) store.sf_pseed=String(seed);
 const ctx=vm.createContext({
  console:{log(){},warn(){},error(){}},
  location:{search:''},
  localStorage:{_s:store,getItem(k){return (k in this._s)?this._s[k]:null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}},
  window:{},navigator:{maxTouchPoints:0},matchMedia:()=>({matches:false}),
  document:{createElement:()=>({getContext:()=>null,style:{},setAttribute(){}}),addEventListener(){},body:{classList:{add(){},remove(){}}}},
  Math,JSON,Object,Array,Number,String,Boolean,Date,parseInt,parseFloat,isFinite,isNaN,
 });
 for(const f of ['js/00-config.js','js/00c-procgen.js']){
  vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
 }
 return ctx;
}
// 种子池: 既有探针 7 种子 + 连号扫描补齐每群系覆盖
const baseSeeds=[12345,777,90210,424242,555555,1,999999];
const byBiome={farm:[],town:[],water:[]};
for(const s of baseSeeds) byBiome[biomeOf(s)].push(s);
for(let s=100001;byBiome.farm.length<12||byBiome.town.length<4||byBiome.water.length<4;s+=1){
 const b=biomeOf(s);
 if(byBiome[b].length<12) byBiome[b].push(s);
 if(s>400000) break;
}
const all=Array.from(new Set([].concat(byBiome.farm,byBiome.town,byBiome.water))).sort((a,b)=>a-b);
const snap={_meta:{refreeze:'2026-10-24e 战区田带+高草丛批三钉 (含 fieldTpl/grass; 2026-10-07b 逐位承诺由设计变更链废止)',captured:new Date().toISOString().slice(0,10),hash:'splitmix32(0x9E3779B9,0x85EBCA6B,0xC2B2AE35)%3, 键序farm/town/water',biomes:byBiome},seeds:{}};
for(const s of all){
 const ctx=makeCtx(s);
 const fp=vm.runInContext('JSON.stringify({theme:PG.theme,flags:CAMPAIGN.flags,bases:CAMPAIGN.bases,roads:CAMPAIGN.roads,fields:CAMPAIGN.fields,lots:PGDATA.lots,polys:PGDATA.polys,settleS:PGDATA.settles,woods:PGDATA.woods,singles:PGDATA.singles,hgrid:PGDATA.hgrid,seed:PGDATA.seed,skeleton:PGDATA.skeleton,size:PGDATA.size,fieldTpl:PGDATA.fieldTpl,grass:PGDATA.grass})',ctx);
 snap.seeds[String(s)]={biome:biomeOf(s),theme:JSON.parse(fp).theme,size:JSON.parse(fp).size,fp};
 console.log('seed '+s+' biome='+biomeOf(s)+' theme='+JSON.parse(fp).theme+' bytes='+fp.length);
}
fs.writeFileSync(path.join(root,'dev','_pgfarm-baseline.json'),JSON.stringify(snap));
console.log('OK → dev/_pgfarm-baseline.json ('+all.length+' seeds, farm='+byBiome.farm.length+' town='+byBiome.town.length+' water='+byBiome.water.length+')');
