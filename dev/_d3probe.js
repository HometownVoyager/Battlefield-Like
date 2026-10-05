// ─────────────────────────────────────────────
// dev/_d3probe.js —— D3 重立案诊断探针 (2026-09-28 批次③): "该归一而未归一"的全量扫描
// 用法: node --stack-size=4000 dev/_d3probe.js [战役idx] [半径m=40]
//
// 背景: 09-28E 修了 _matShade/depthVariant 克隆丢 uvRef, verify-uvref 全绿, 但用户实机仍报
//   "全部不可破坏建筑墙体 + 谷仓房顶材质严重不一致" ⇒ 病根在 09-28E 盲区。本探针不区分病因,
//   直接量**结果**: 每个世界网格的每个面, 实际贴图密度 (面尺寸/UV跨度×repeat) 对比登记密度
//   (mat.uvRef / UV_DENSITY), 偏差 >10% 即"拉伸面"。同时清点同屏亮度变体 (perm/dmg 克隆色)。
// 口径:
//   · BoxGeometry: 六面各自 uv 跨度应为 尺寸/uvRef —— 用 parameters + 每面实测 UV 跨度双算, 取实测。
//   · 非盒几何 (Cylinder/Cone/Plane...): uvGeo 结构性不归一 —— 单列统计 (密度跨度), 这是候选病根①。
//   · 材质数组 (multi-material): markPermPieces/_matShade 对数组的行为是静默失效 —— 候选病根②, 单列。
//   · 亮度变体: 收集 (贴图名, colorHex) 对 —— 同一贴图同屏几种色 = "整体偏色"可读性的量化。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const stub=require('./_bootstub.js');
const root=path.resolve(__dirname,'..');
const CAMP=parseInt(process.argv[2]||'0',10), RAD=parseFloat(process.argv[3]||'40');
const FILES=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/15g-capmodels.js','js/15h-capital.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/22a-menuart.js','js/23-deploy.js','js/23b-worldrestore.js','js/24-main.js'];
const RENDERER_STUB=`
class StubRenderer{
constructor(o){ this.domElement=(o&&o.canvas)||document.createElement('canvas'); this.domElement.style=this.domElement.style||{};
this.shadowMap={enabled:false,type:0,autoUpdate:true}; this.info={render:{calls:0,triangles:0},memory:{}};
this.capabilities={isWebGL2:true,getMaxAnisotropy:()=>4,maxTextureSize:4096,maxTextures:16};
this.xr={enabled:false,isPresenting:false,addEventListener(){},removeEventListener(){}}; this.autoClear=true; }
setSize(){} setPixelRatio(){} setViewport(){} setScissor(){} setScissorTest(){} render(){} clear(){} clearDepth(){}
setClearColor(){} setClearAlpha(){} dispose(){} setAnimationLoop(){} compile(){return new Set();}
getContext(){return null;} getRenderTarget(){return null;} setRenderTarget(){} readRenderTargetPixels(){}
copyFramebufferToTexture(){} initTexture(){} resetState(){} getDrawingBufferSize(){return {x:1,y:1};}
getSize(t){ if(t) t.set(1280,720); return {width:1280,height:720}; } getPixelRatio(){return 1;}
}
THREE.WebGLRenderer=StubRenderer;
`;
function boot(campIdx){
for(const k in stub.byId) delete stub.byId[k];
const ctx=vm.createContext(Object.assign({},stub.sandbox));
ctx.document=stub.document; ctx.window=stub.window;
ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
vm.runInContext(fs.readFileSync(path.join(root,'dev/vendor/three.min.js'),'utf8'),ctx,{filename:'three.min.js'});
vm.runInContext('THREE = globalThis.THREE;',ctx,{filename:'bind-three'});
vm.runInContext(RENDERER_STUB,ctx,{filename:'stub-renderer'});
for(const f of FILES) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
return ctx;
}
const SCAN=`
function __scan(cx,cz,rad){
const TNAME=new Map();
for(const k in TEX) if(TEX[k]&&typeof TEX[k]==='object') TNAME.set(TEX[k],k);
const out=[];
world.updateMatrixWorld(true);
world.traverse(o=>{
if(!o.isMesh||o.isInstancedMesh) return;
const g=o.geometry; if(!g||!g.attributes||!g.attributes.position||!g.attributes.uv) return;
const m=o.material;
const mats=Array.isArray(m)?m:[m];
if(mats.some(mm=>mm&&mm.transparent)) return;
o.updateWorldMatrix(true,false);
const wp=new THREE.Vector3();
g.computeBoundingBox();
const bb=g.boundingBox;
wp.copy(bb.getCenter(new THREE.Vector3())).applyMatrix4(o.matrixWorld);
const d2=(wp.x-cx)*(wp.x-cx)+(wp.z-cz)*(wp.z-cz);
if(d2>rad*rad) return;
const scl=new THREE.Vector3();
o.matrixWorld.decompose(new THREE.Vector3(),new THREE.Quaternion(),scl);
const pos=g.attributes.position, uv=g.attributes.uv;
const idx=g.index?g.index.array:null;
const cnt=idx?idx.length:pos.count;
// 每三角: 世界边长 / uv 跨度×repeat ⇒ 密度; 汇总到 (texname|uvRef|permTier|geoType)
const rec=(mm)=>{
const tn=(mm&&mm.map&&TNAME.get(mm.map))||null;
return {tn:tn||'(无贴图)',uvRef:(mm&&mm.uvRef!==undefined)?mm.uvRef:null,
perm:!!(mm&&mm.permTier),dmg:(mm&&mm.dmgTier)||0,
off:(mm&&mm.polygonOffsetUnits)||0,
col:(mm&&mm.color&&typeof mm.color.toArray==='function')?(function(){const a=mm.color.toArray().map(v=>Math.round(v*255));return (a[0]<<16|a[1]<<8|a[2]).toString(16).padStart(6,'0');})():'?',
matName:(mm&&mm._matName)||null};
};
const agg=new Map();
for(let t=0;t<cnt;t+=3){
const ids=idx?[idx[t],idx[t+1],idx[t+2]]:[t,t+1,t+2];
let mi=0;
if(g.groups&&g.groups.length&&Array.isArray(m)){
for(const gr of g.groups){ if(ids[0]>=gr.start&&ids[0]<gr.start+gr.count){ mi=gr.materialIndex; break; } }
}
const mm=mats[mi]||mats[0];
if(!mm||!mm.map) continue;
const key=mi;
if(!agg.has(key)) agg.set(key,{mm,duMin:1e9,duMax:-1e9,dvMin:1e9,dvMax:-1e9,n:0});
const A=agg.get(key);
// 面密度: 三角最长边的世界长 / 其 uv 跨度 (×repeat → 米/贴)
const P=[],U=[];
for(const i of ids){
P.push([pos.getX(i)*scl.x,pos.getY(i)*scl.y,pos.getZ(i)*scl.z]);
U.push([uv.getX(i),uv.getY(i)]);
}
let best=0,bi=0,bj=1;
for(let a=0;a<3;a++)for(let b2=a+1;b2<3;b2++){
const l=Math.hypot(P[a][0]-P[b2][0],P[a][1]-P[b2][1],P[a][2]-P[b2][2]);
if(l>best){best=l;bi=a;bj=b2;}
}
const du=Math.abs(U[bi][0]-U[bj][0])*(mm.map.repeat?mm.map.repeat.x:1);
const dv=Math.abs(U[bi][1]-U[bj][1])*(mm.map.repeat?mm.map.repeat.y:1);
if(best<0.25||du<1e-4||dv<1e-4) continue;   // 小件/退化边不进统计
const dU=best/du, dV=best/dv;
A.duMin=Math.min(A.duMin,dU); A.duMax=Math.max(A.duMax,dU);
A.dvMin=Math.min(A.dvMin,dV); A.dvMax=Math.max(A.dvMax,dV);
A.n++;
}
for(const [mi,A] of agg){
const tag=rec(A.mm);
out.push({geo:g.type,pos:[+wp.x.toFixed(1),+wp.y.toFixed(1),+wp.z.toFixed(1)],
tn:tag.tn,uvRef:tag.uvRef,perm:tag.perm,dmg:tag.dmg,off:tag.off,col:tag.col,
duMin:+A.duMin.toFixed(2),duMax:+A.duMax.toFixed(2),dvMin:+A.dvMin.toFixed(2),dvMax:+A.dvMax.toFixed(2),n:A.n});
}
});
return out;
}
`;
const ctx=boot(CAMP);
const Q=s=>vm.runInContext(s,ctx);
Q(SCAN);
console.log(`战役 #${CAMP} (${Q('CAMPAIGN.title||CAMPAIGN.id')})  扫描半径 ${RAD}m (全图中心)` );
const rows=Q(`__scan(0,0,10000)`);
console.log(`网格材质组总数: ${rows.length}`);
// ── ① 按 (贴图, uvRef, perm, geo) 聚合: 密度跨度 ──
const agg=new Map();
for(const r of rows){
const k=`${r.tn}|uvRef=${r.uvRef}|perm=${r.perm?1:0}|${r.geo}`;
if(!agg.has(k)) agg.set(k,{k,n:0,duMin:1e9,duMax:-1e9,dvMin:1e9,dvMax:-1e9,ex:r});
const A=agg.get(k); A.n++;
A.duMin=Math.min(A.duMin,r.duMin); A.duMax=Math.max(A.duMax,r.duMax);
A.dvMin=Math.min(A.dvMin,r.dvMin); A.dvMax=Math.max(A.dvMax,r.dvMax);
}
console.log('\n── ① 密度聚合 (贴图|uvRef|perm|几何): 组数  米/贴U跨度  米/贴V跨度 ──');
const sorted=[...agg.values()].sort((a,b)=>b.n-a.n);
for(const A of sorted){
console.log(`  ${A.k}  ×${A.n}  U[${A.duMin}~${A.duMax}]  V[${A.dvMin}~${A.dvMax}]`);
}
// ── ② 拉伸面: 有 uvRef 登记但实测密度偏离 >10%, 或同贴图组内跨度 >15% ──
console.log('\n── ② 拉伸嫌疑 (有 uvRef 而密度偏离 / 无 uvRef 但属建筑材质) ──');
let flagged=0;
for(const A of sorted){
const m=A.k.match(/^(.+)\|uvRef=(null|\d+(?:\.\d+)?)\|perm=(\d)\|(.+)$/);
if(!m) continue;
const tn=m[1],uvr=m[2]==='null'?null:parseFloat(m[2]),geo=m[4];
const BUILD=['brick','plaster','stone','wood','woodDark','roof','roofDark','tile','hay'];
const isB=BUILD.includes(tn);
if(uvr!==null){
const lo=Math.min(A.duMin,A.dvMin),hi=Math.max(A.duMax,A.dvMax);
if(hi>uvr*1.1+0.05||lo<uvr*0.9-0.05){
console.log(`  [偏] ${A.k}  ×${A.n}  U[${A.duMin}~${A.duMax}] V[${A.dvMin}~${A.dvMax}]  登记=${uvr}  例@(${A.ex.pos})`);
flagged++;
}
}else if(isB&&geo!=='BoxGeometry'){
console.log(`  [非盒] ${A.k}  ×${A.n}  U[${A.duMin}~${A.duMax}] V[${A.dvMin}~${A.dvMax}]  例@(${A.ex.pos})`);
flagged++;
}
}
if(!flagged) console.log('  (无)');
// ── ③ 亮度变体清点: 同贴图下的不同 color ──
console.log('\n── ③ 同贴图颜色变体 (整体偏色可读性) ──');
const cols=new Map();
for(const r of rows){
if(!cols.has(r.tn)) cols.set(r.tn,new Map());
const c=cols.get(r.tn);
const k=r.col+(r.perm?'(perm)':'')+(r.dmg?'(dmg'+r.dmg+')':'');
c.set(k,(c.get(k)||0)+1);
}
for(const [tn,c] of [...cols].sort((a,b)=>b[1].size-a[1].size)){
if(c.size<2) continue;
console.log(`  ${tn}: ${[...c.entries()].map(([k,n])=>k+'×'+n).join('  ')}`);
}
