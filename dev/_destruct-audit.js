// dev/_destruct-audit.js —— 破坏子系统审计取值 (只读: 组几何/命中口径/代价/碎块预算)
// 用法: node --stack-size=4000 dev/_destruct-audit.js [map...]
// 取值口径全部复用游戏内真函数 (damageStructures 的距离式 / killBox 的兄弟扫描 / spawnWallDebris 的碎块表),
// 不做二次近似 —— 数字直接来自被测代码。
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const stub=require('./_bootstub.js');
const root=path.resolve(__dirname,'..');
const THREE=stub.THREE;
class BoxG extends THREE.BoxGeometry{ constructor(w,h,d){ super(w,h,d); this.parameters={width:w,height:h,depth:d}; } }
class CircG extends THREE.CircleGeometry{ constructor(r,s){ super(r,s); this.parameters={radius:r,segments:s}; } }
class CylG extends THREE.CylinderGeometry{ constructor(rt,rb,h,s){ super(rt,rb,h,s); this.parameters={radiusTop:rt,radiusBottom:rb,height:h,radialSegments:s}; } }
class PlaneG extends THREE.PlaneGeometry{ constructor(w,h,sg,sh){ super(w,h,sg,sh); const p=this.attributes.position,y=new Float32Array(p.count); p.__y=y; p.setY=(i,v)=>{y[i]=v;}; p.getY=(i)=>y[i]; this.parameters={width:w,height:h,widthSegments:sg,heightSegments:sh}; } }
THREE.BoxGeometry=BoxG; THREE.CircleGeometry=CircG; THREE.CylinderGeometry=CylG; THREE.PlaneGeometry=PlaneG;
// CANNON 全桩: 破坏路径会走到 12-ragdolls (ragInit/spawnDebris) —— 桩只记账不做积分,
// 目的是让 spawnWallDebris 真的跑完 (碎块数/淘汰数才是要测的量)。
class V3{ constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;} set(x,y,z){this.x=x;this.y=y;this.z=z;return this;} copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;} }
class Quat{ constructor(){this.x=0;this.y=0;this.z=0;this.w=1;} set(x,y,z,w){this.x=x;this.y=y;this.z=z;this.w=w;return this;} setFromEuler(){return this;} copy(q){Object.assign(this,q);return this;} }
const CANNON_STUB={
Vec3:V3,Quaternion:Quat,
World:class{ constructor(){ this.gravity=new V3(); this.broadphase=null; this.solver={iterations:0}; this.bodies=[]; }
addBody(b){ this.bodies.push(b); } removeBody(b){ const i=this.bodies.indexOf(b); if(i>=0) this.bodies.splice(i,1); }
add(b){ this.addBody(b); } remove(b){ this.removeBody(b); } addConstraint(){} removeConstraint(){} step(){} },
Body:class{ constructor(o){ Object.assign(this,o||{}); this.shapes=[];
this.position=new V3(); this.velocity=new V3(); this.angularVelocity=new V3(); this.quaternion=new Quat();
this.angularDamping=0; this.linearDamping=0; } addShape(s){ this.shapes.push(s); } },
Box:class{}, Sphere:class{}, Material:class{}, ContactMaterial:class{}, NaiveBroadphase:class{}, PointToPointConstraint:class{},
};
const FILES=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/22a-menuart.js','js/23-deploy.js','js/23b-worldrestore.js','js/24-main.js'];
function boot(i){
for(const k in stub.byId) delete stub.byId[k];
const ctx=vm.createContext(Object.assign({},stub.sandbox));
ctx.document=stub.document; ctx.window=stub.window; ctx.CANNON=CANNON_STUB;
ctx.localStorage={_s:{sf_campaign:String(i)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of FILES) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
return ctx;
}
const c0=boot(0);
const G=(c,s)=>vm.runInContext(s,c);
const ids=G(c0,'CAMPAIGNS.map(c=>c.id)');
const targets=process.argv.slice(2).length?process.argv.slice(2):['berlin','moscow','island'];
console.log('图         组 成员   盒数 永久件 可碾件 | 最大组 成员/网格/hp/水平跨度/竖直 | 【旧口径对照】R7.5 落点空放 R10 落点空放 | 幻影命中 | 摧毁 比较次 耗时 碎块净增');
console.log('  ★ 2026-09-27N: 「落点空放」列是**旧判据**(爆点到组心平面距)的静态几何统计 —— 破坏机制批已把判据改成');
console.log('    「到最近成员碰撞盒的三维距离 + 一层楼竖直门限」(05-world.boxDist3 / STRUCT_HIT), 本列只作改前对照保留;');
console.log('    新判据下的空放率由 dev/verify-destruct-20260927N.js 的 T1 用真入口实测 (当前 0 空放)。');
for(const id of targets){
const idx=G(c0,`CAMPAIGNS.findIndex(x=>x.id==='${id}')`);
if(idx<0){ console.log(id.padEnd(10)+' (未知地图)'); continue; }
const ctx=boot(idx);
const r=G(ctx,`
(function(){
const G=DESTRUCTIBLES;
const stat=[];
let memberTotal=0;
for(const g of G){
let minX=1e9,maxX=-1e9,minZ=1e9,maxZ=-1e9,minY=1e9,maxY=-1e9,n=0;
const boxes=[];
for(const i of g.bi){ const b=BOXES[i]; if(!b) continue;
minX=Math.min(minX,b.minX); maxX=Math.max(maxX,b.maxX); minZ=Math.min(minZ,b.minZ); maxZ=Math.max(maxZ,b.maxZ);
minY=Math.min(minY,b.minY); maxY=Math.max(maxY,b.maxY); n++;
boxes.push({cx:(b.minX+b.maxX)/2,cz:(b.minZ+b.maxZ)/2,hx:(b.maxX-b.minX)/2,hz:(b.maxZ-b.minZ)/2});
}
memberTotal+=n;
const meshes=new Set(); for(const i of g.bi){ const b=BOXES[i]; if(b&&b.mesh) meshes.add(b.mesh); }
stat.push({n,g,hp:g.hp,dead:g.dead?1:0,boxes,meshes:meshes.size,
spanX:maxX-minX,spanZ:maxZ-minZ,spanY:maxY-minY});
}
stat.sort((a,b)=>b.n-a.n);
if(!stat.length) return {empty:1,n:G.length,members:0,boxes:BOXES.length};
// 永久件 = BOXES 里既不属于任何可毁组、也不可被坦克碾毁的碰撞盒 (炮弹/爆炸对它完全无效)
let perm=0,crushOnly=0;
for(const b of BOXES){ if(!b||b.dead) continue; if(b.dGroup) continue; if(b.crush) crushOnly++; else perm++; }
const hps=stat.filter(s=>!s.dead).map(s=>s.hp).sort((a,b)=>a-b);
const hpHist={};
for(const h of hps) hpHist[h]=(hpHist[h]||0)+1;
// ── 命中口径: 落点 = 该组自己的某个成员盒中心 ──
// 游戏内判据 (05-world damageStructures): d=hypot(g.cx-p.x, g.cz-p.z); 命中当且仅当 d < R。
// 只要"成员盒到组心的平面距 ≥ R", 炮弹正中这块墙也一点血都不掉。
const Rs=[7.5,10];
const miss={};
for(const R of Rs){ let hit=0,missed=0,groups=0; for(const s of stat){ if(s.dead) continue; let m=0;
for(const b of s.boxes){ const d=Math.hypot(s.g.cx-b.cx,s.g.cz-b.cz); if(d<R) hit++; else { missed++; m++; } }
if(m) groups++; }
miss[R]={hit,missed,groups}; }
// ── 幻影命中: 采样落点, 统计"组被判命中、但组里没有任何盒在爆点 10m 内" ──
const allBoxes=[];
for(const s of stat){ for(const b of s.boxes) allBoxes.push(b); }
const stepB=Math.max(1,Math.floor(allBoxes.length/260));
const samples=[]; for(let i=0;i<allBoxes.length;i+=stepB) samples.push(allBoxes[i]);
let hits=0,phantom=0,hitG=0,hitMax=0,missSamp=0;
for(const p of samples){ let nh=0,nh7=0;
for(const s of stat){ if(s.dead) continue;
const d=Math.hypot(s.g.cx-p.cx,s.g.cz-p.cz);
if(d>=10) continue; hits++; nh++;
if(d<7.5) nh7++;
let near=false; for(const b of s.boxes){ const dx=Math.max(0,Math.abs(p.cx-b.cx)-b.hx), dz=Math.max(0,Math.abs(p.cz-b.cz)-b.hz); if(dx*dx+dz*dz<100){ near=true; break; } }
if(!near) phantom++; }
hitG+=nh; hitMax=Math.max(hitMax,nh); if(!nh7) missSamp++; }
// ── 单面血量: hp/成员 (同一张图里"每块墙有多厚"差多少) ──
const perBox=stat.filter(s=>!s.dead).map(s=>s.hp/Math.max(1,s.n)).sort((a,b)=>a-b);
const pbMin=perBox.length?perBox[0]:0, pbMax=perBox.length?perBox[perBox.length-1]:0, pbMed=perBox.length?perBox[Math.floor(perBox.length/2)]:0;
// ── 摧毁代价: 最大组的 killBox 兄弟扫描 (killBox 每杀一格全表扫一遍找同网格兄弟) ──
const big=stat[0];
const cmp=big.n*BOXES.length;
const t0=Date.now();
let killed=0,debBefore=0,debAfter=0;
if(big&&!big.dead){
debBefore=DEBRIS.list.length;
destroyStructure(big.g,false,null);
killed=big.n; debAfter=DEBRIS.list.length;
}
const ms=Date.now()-t0;
// ── 整栋拆除: 取承重链最长的一栋 (roofRef.carry 最多), 逐组摧毁 ──
// 量三件事: ①一栋楼的碎块量 (对比 DEBRIS 上限 96) ②拆完后同楼还有多少墙组"活着" (半塌楼)
// ③这些残余墙的盒有没有"悬空" (底面无支撑: 下方 0.6m 内无他盒、且底面离地 >0.5m)
let bldWalls=0,bldDeb=0,bldRest=0,bldRestBox=0,floatG=0,floatBox=0; const floatSample=[];
try{
const refs=[];
for(const s of stat){ const ref=s.g.roofRef; if(ref&&refs.indexOf(ref)<0) refs.push(ref); }
refs.sort((a,b)=>(b.carry?b.carry.length:0)-(a.carry?a.carry.length:0));
if(refs.length){
const ref=refs[0];
ref.carry=ref.carry||[];
bldWalls=ref.carry.length;
const d0=DEBRIS.list.length;
for(const g of ref.carry){ if(g&&!g.dead) destroyStructure(g,false,null); }
bldDeb=DEBRIS.list.length-d0;
// 残余: 该楼 (按平面位置聚类近似: 与已拆组 cx/cz 8m 内) 仍 alive 的组
const cxs=ref.carry.map(g=>g?g.cx:0), czs=ref.carry.map(g=>g?g.cz:0);
for(const s of stat){
if(s.dead) continue;
let near=false; for(let i=0;i<cxs.length;i++){ if(Math.hypot(s.g.cx-cxs[i],s.g.cz-czs[i])<8){ near=true; break; } }
if(!near) continue;
bldRest++; bldRestBox+=s.n;
}
// 浮空检查 (窄口径, 只抓玩家真会看见的"整组悬空"): 组底高出自身足迹下地形 2.5m,
// 且下方 1.2m 内没有任何**别的组**的盒 (XZ 相交) 顶着 —— 坡地裙墙遮住的悬空不算 (裙墙=视觉件, 常规形态)。
const alive=[];
for(const b of BOXES){ if(b&&!b.dead&&b.maxX<90000) alive.push(b); }
for(const s of stat){
if(s.dead) continue;
let bot=1e9,ground=1e9;
for(const i of s.g.bi){ const b=BOXES[i]; if(!b||b.dead||b.maxX>90000) continue;
bot=Math.min(bot,b.minY); ground=Math.min(ground,heightAt((b.minX+b.maxX)/2,(b.minZ+b.maxZ)/2));
}
if(bot-ground<2.5) continue;
let sup=false;
for(const i of s.g.bi){ const b=BOXES[i]; if(!b||b.dead||b.maxX>90000) continue;
for(const o of alive){ if(o===b) continue;
if(o.minX>b.maxX-0.2||o.maxX<b.minX+0.2) continue;
if(o.minZ>b.maxZ-0.2||o.maxZ<b.minZ+0.2) continue;
if(o.maxY<=b.minY+0.05&&o.maxY>b.minY-1.2){ sup=true; break; }
}
if(sup) break;
}
if(!sup){ floatG++; floatBox+=1;
if(floatSample.length<5) floatSample.push([+s.g.cx.toFixed(1),+s.g.cz.toFixed(1),+bot.toFixed(1),+ground.toFixed(1),s.n,s.g.hp,s.g.wFloor===undefined?'-':s.g.wFloor]); }
}
}
}catch(e){ bldDeb=-1; }
let meshesTop=0; for(const s of stat.slice(0,3)) meshesTop+=s.meshes;
return {n:G.length,members:memberTotal,boxes:BOXES.length,perm,crushOnly,
bigN:big.n,bigMesh:big.meshes,bigHp:big.hp,spanX:+big.spanX.toFixed(1),spanZ:+big.spanZ.toFixed(1),spanY:+big.spanY.toFixed(1),
hpHist:hps.slice(-6),miss7:miss[7.5],miss10:miss[10],samples:samples.length,hits,phantom,
hitAvg:+(hitG/Math.max(1,samples.length)).toFixed(1),hitMax,missSamp,
pbMin:+pbMin.toFixed(1),pbMax:+pbMax.toFixed(1),pbMed:+pbMed.toFixed(1),
bldWalls,bldDeb,bldRest,bldRestBox,floatG,floatBox,floatSample,
cmp,ms,killed,debBefore,debAfter,meshesTop,debCap:(typeof DEBRIS!=='undefined'?96:0)};
})()`);
if(r.empty){ console.log(id.padEnd(10)+' 0 组可破坏物 (该图 DESTRUCTIBLES 为空) · 碰撞盒 '+r.boxes); continue; }
const m7=r.miss7,m10=r.miss10,tot7=Math.max(1,m7.hit+m7.missed);
const pct7=(m7.missed/tot7*100).toFixed(1), pct10=(m10.missed/Math.max(1,m10.hit+m10.missed)*100).toFixed(1);
const phPct=(r.phantom/Math.max(1,r.hits)*100).toFixed(1);
console.log(`${id.padEnd(10)} ${String(r.n).padStart(3)} ${String(r.members).padStart(5)} ${String(r.boxes).padStart(6)} ${String(r.perm).padStart(6)} ${String(r.crushOnly).padStart(6)} | ${String(r.bigN).padStart(4)}/${String(r.bigMesh).padStart(3)}/${String(r.bigHp).padStart(4)}/${String(r.spanX).padStart(5)}×${String(r.spanZ).padStart(5)}/${String(r.spanY).padStart(5)} | ${String(m7.missed).padStart(5)}(${pct7}%) ${String(m10.missed).padStart(5)}(${pct10}%) | ${String(r.phantom).padStart(4)}/${String(r.hits).padStart(5)}(${phPct}%) | ${String(r.cmp).padStart(8)} ${String(r.ms).padStart(4)}ms ${String(r.debAfter-r.debBefore).padStart(4)}`);
console.log(`           组hp分布(高6档) ${JSON.stringify(r.hpHist)} · 采样落点 ${r.samples} · 前三组碎块潜量 ${r.meshesTop} (碎块上限 ${r.debCap}) · 命中但组心≥R 的组数 R7.5=${m7.groups}/R10=${m10.groups}`);
console.log(`           单面血量 hp/盒 中位${r.pbMed} 最低${r.pbMin} 最高${r.pbMax} · 每次爆炸命中组数 均${r.hitAvg} 峰${r.hitMax} (${r.samples} 个采样落点里 ${r.missSamp} 个连 7.5m 内的组都没有)`);
console.log(`           整栋拆除: 承重墙 ${r.bldWalls} 组 → 碎块 ${r.bldDeb} 块 (上限 ${r.debCap}) · 全图悬空盒 ${r.floatBox} (${r.floatG} 组) ${JSON.stringify(r.floatSample)}`);
}
