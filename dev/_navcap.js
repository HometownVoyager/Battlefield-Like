// dev/_navcap.js —— 海战载具命中上限量测 (临时探针): 对每个 specKey 打印
//   旧上限 hullH*1.05 / 模型实测顶面 (网格顶点最大 y, 世界系) / dims.hullY,hullH,H / dims.turretY,dims.turretH
// 用法: node dev/_navcap.js
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const SRC=f=>fs.readFileSync(path.join(root,f),'utf8');
const HEAD=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js',
'js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js',
'js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js',
'js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/15g-capmodels.js','js/15h-capital.js','js/16-aircraft.js',
'js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js',
'js/22a-menuart.js','js/23-deploy.js','js/23b-worldrestore.js','js/24-main.js'];
const {sandbox,document,window}=require('./_bootstub.js');
require('./_bootpatch.js').patch(sandbox);
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document; ctx.window=window; ctx.globalThis=ctx;
ctx.location={search:'?seed=42',href:'http://localhost/index.html',hostname:'localhost',protocol:'http:'};
ctx.localStorage={_s:{sf_campaign:'11'},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
ctx.console={log(){},warn(){},error(){}};
for(const f of HEAD){ try{ vm.runInContext(SRC(f),ctx,{filename:f}); }catch(e){ console.log('load err '+f+': '+e.message); } }
const out=vm.runInContext(`(()=>{
const rows=[];
for(const k of Object.keys(NAVAL_SPEC)){
 const S=NAVAL_SPEC[k];
 let M=null; try{ M=navBuildModel(S)||null; }catch(e){ rows.push({k,err:String(e&&e.message)}); continue; }
 const g=M.grp;
 // 世界系顶点最大 y (遍历网格顶点; 非索引/索引都读 position)
 let top=-1e9, nMesh=0;
 g.traverse(o=>{
  if(!o.isMesh||!o.geometry||!o.geometry.attributes||!o.geometry.attributes.position) return;
  nMesh++;
  const a=o.geometry.attributes.position.array;
  // 简化: 只取该网格自身坐标系下的 y 上界 + 父链 y 之和 (两级足够: 15e 的装配是 位置平移 无缩放)
  let ly=-1e9;
  for(let i=1;i<a.length;i+=3) if(a[i]>ly) ly=a[i];
  let py=0, p=o; while(p){ py+=(p.position&&p.position.y)||0; p=p.parent; }
  if(ly+py>top) top=ly+py;
 });
 const d=M.dims||{};
 rows.push({k,kind:S.kind,hullH:S.hullH,oldCap:Math.round(S.hullH*1.05*1000)/1000,
  modelTop:Math.round(top*1000)/1000,nMesh,
  hullY:d.hullY,H:d.H,roof:d.roof,deckY:d.deckY,
  tY:d.turretY,tH:d.turretH,turretTop:(d.turretY!==undefined&&d.turretH!==undefined)?Math.round((d.turretY+d.turretH)*1000)/1000:undefined,
  vehCap:(typeof VEH_HIT_TOP!=='undefined'?VEH_HIT_TOP:'(无)')});
}
return rows; })()`,ctx);
console.log('specKey\tkind\thullH\t旧上限hullH*1.05\t模型顶面\thullY\tH\troof\tturretY\tturretH\t塔顶\t坦克口径');
for(const r of out){
 if(r.err){ console.log(r.k+'\tERR '+r.err); continue; }
 console.log([r.k,r.kind,r.hullH,r.oldCap,r.modelTop,r.hullY,r.H,r.roof,r.tY,r.tH,r.turretTop,r.vehCap].join('\t'));
 console.log('   网格数 '+r.nMesh+'  deckY='+r.deckY);
}
