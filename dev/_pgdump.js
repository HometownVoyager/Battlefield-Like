// 布局快照 dump (自检用): node dev/_pgdump.js <seed> <out.json>
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
function makeCtx(seed,campIdx){
 const store={sf_campaign:String(campIdx),sf_pseed:String(seed)};
 const ctx=vm.createContext({ console:{log(){},warn(){},error(){}}, location:{search:''},
  localStorage:{_s:store,getItem(k){return (k in this._s)?this._s[k]:null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}},
  window:{},navigator:{maxTouchPoints:0},matchMedia:()=>({matches:false}),
  document:{createElement:()=>({getContext:()=>null,style:{},setAttribute(){}}),addEventListener(){},body:{classList:{add(){},remove(){}}}},
  Math,JSON,Object,Array,Number,String,Boolean,Date,parseInt,parseFloat,isFinite,isNaN});
 for(const f of ['js/00-config.js','js/00c-procgen.js']) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
 return ctx;
}
const PGN=(function(){ const c=makeCtx(1,0); return vm.runInContext('CAMPAIGNS.length-1',c); })();
const seed=parseInt(process.argv[2],10), out=process.argv[3]||('dev/_pgsnap-'+seed+'.json');
const ctx=makeCtx(seed,PGN);
const dump=vm.runInContext(`JSON.stringify({seed:PG.seed,biome:PG.biome,theme:PG.theme,core:PGDATA.core,
 bases:CAMPAIGN.bases,flags:CAMPAIGN.flags,polys:PGDATA.polys,lots:PGDATA.lots,fields:CAMPAIGN.fields,
 woods:PGDATA.woods,rail:PGDATA.rail,river:CAMPAIGN.river,bridges:CAMPAIGN.bridges,delta:CAMPAIGN.delta})`,ctx);
fs.writeFileSync(path.join(root,out),dump);
const d=JSON.parse(dump);
console.log(out,'biome='+d.biome,'theme='+d.theme,'flags='+d.flags.length,'lots='+d.lots.length,
 'polys='+d.polys.length,'rail='+(d.rail?d.rail.length:0),'river='+(d.river?'y':'n'),'fields='+d.fields.length,'woods='+d.woods.length);
