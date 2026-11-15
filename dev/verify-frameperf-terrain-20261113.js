// ─────────────────────────────────────────────
// dev/verify-frameperf-terrain-20261113.js —— 2026-11-13 地形/碰撞热链性能批 沙箱等价探针
// 覆盖 (修复: 03-terrain.js 线段特征空间桶 + hgridClear 首触桶化 / 04-collision.js raycastWorld
//       地面行军自适应步长):
//  T1 hgridClear 新(Fast) vs 旧实现留档(Slow) 逐点对照 —— 6 图各 ≥2000 点:
//     旧值≤0 (带内/贴带, 唯一行为相关区) 断言 === 逐位; 两侧均>0 (快路区, 唯一消费方只判 >0)
//     断言 new≥old>0 (符号一致, 新不更小)。另断言缓存二次读一致。
//  T2 heightAt 快路 vs 全路 (HGRID_OFF) 逐位 === —— 6 图各 1200 点 × noBridge 两档:
//     快路区格上 快路=rawHeight 与 全路=rawHeight+修正 全等 ⇒ 快路判定/带 PAD 论证全链实证。
//  T3 rawHeight / heightAt 全路径 的 SEG_OFF 前后逐位 === —— 桶化候选集 vs 旧全扫 (A 项硬判据)。
//  T4 roadDist/gullyDist/rampMask 探针侧全扫参考对照 (阈值内 === 逐位 / 阈值外同越界语义)。
//  T5 raycastWorld 旧(RAYGND_OFF) vs 新: 同 null 或同 kind; 'ground' 档 |Δdist|≤0.35; box/cyl 档
//     dist 逐位 ===; 包一层 heightAt 计数器报每条射线 heightAt 调用数前后对比 (0/3/4 三图)。
//  T6 活帧 heightAt 调用数/帧 前后对比 (完整 loop() 驱动, camp 0/4 各 120 帧)。
//  T7 源码断言: 回退旗与留档函数在位 (SEG_OFF/ROAD_OFF/GULLY_OFF/RAMP_OFF/HGRID_OFF/RAYGND_OFF/
//     hgridClearSlow/hgridClearFast)。
// 用法: node dev/verify-frameperf-terrain-20261113.js [--camps 0,1,2,3,4,5] [--rays 0,3,4]
// 纪律: 载入清单从 index.html ?v= 动态解析; boot 用 _bootstub + localStorage sf_campaign。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const {THREE,document,window,sandbox,byId}=require('./_bootstub.js');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const html=read('index.html');
const FILES=[...html.matchAll(/<script src="(js\/[^"?]+)\?v=[^"]*"/g)].map(m=>m[1]);

// ── 参数 ──
let CAMPS=[0,1,2,3,4,5], RAYCAMPS=[0,3,4];
for(let i=2;i<process.argv.length;i++){
if(process.argv[i]==='--camps') CAMPS=process.argv[++i].split(',').map(Number);
else if(process.argv[i]==='--rays') RAYCAMPS=process.argv[++i].split(',').map(Number);
}

// ── 桩忠实化补丁 (抄 probe-frameprofile-20261113; 完整 loop() 需要) ──
// ★prototype 补丁必须打在包装前的原始类上 (本探针不做 alloc 包装, 直接补原类)。
if(!THREE.Euler.prototype.clone) THREE.Euler.prototype.clone=function(){ const e=new THREE.Euler(); e.x=this.x; e.y=this.y; e.z=this.z; e.order=this.order; return e; };
if(!THREE.Euler.prototype.copy) THREE.Euler.prototype.copy=function(e){ this.x=e.x; this.y=e.y; this.z=e.z; this.order=e.order||this.order; return this; };
for(const _mn of ['MeshLambertMaterial','MeshBasicMaterial','MeshStandardMaterial','MeshPhongMaterial','PointsMaterial','SpriteMaterial','LineBasicMaterial']){
const _MC=THREE[_mn];
if(_MC&&!_MC.prototype.clone) _MC.prototype.clone=function(){ const c=new _MC(Object.assign({},this)); if(this.color&&this.color.getHex) c.color=new THREE.Color(this.color.getHex()); return c; };
}
if(!THREE.Object3D.prototype.clear) THREE.Object3D.prototype.clear=function(){ const c=this.children.slice(); for(const m of c) this.remove(m); };
const AC0=sandbox.AudioContext;
const _param=p=>{ if(p&&!p.setTargetAtTime) p.setTargetAtTime=function(){return this;}; return p; };
const ACW=class extends AC0{
createOscillator(){ const o=super.createOscillator(); if(!o.detune) o.detune={value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}}; _param(o.frequency); _param(o.detune); return o; }
createGain(){ const g=super.createGain(); _param(g.gain); return g; }
createBufferSource(){ const s=super.createBufferSource(); _param(s.playbackRate); return s; }
createBiquadFilter(){ const f=super.createBiquadFilter(); _param(f.frequency); return f; }
};
sandbox.AudioContext=ACW; sandbox.window.AudioContext=ACW; sandbox.window.webkitAudioContext=ACW;
const _mkStyle=e=>{ if(e&&e.style&&!e.style.setProperty) e.style.setProperty=function(p,v){ this[p]=v; }; return e; };
const _gEBI=document.getElementById, _cEl=document.createElement, _qSel=document.querySelector;
document.getElementById=id=>_mkStyle(_gEBI(id));
document.createElement=t=>_mkStyle(_cEl(t));
document.querySelector=s=>_mkStyle(_qSel(s));
// 最小可积分 CANNON 假物理 (完整 loop() 交战死人进布娃娃链; 同 probe-frameprofile 口径)
const _CV3=class{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;}clone(){return new _CV3(this.x,this.y,this.z);}length(){return Math.hypot(this.x,this.y,this.z);}normalize(){const l=this.length()||1;this.x/=l;this.y/=l;this.z/=l;return this;}scale(s){this.x*=s;this.y*=s;this.z*=s;return this;}vadd(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;}vsub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this;}cross(v){const x=this.y*v.z-this.z*v.y,y=this.z*v.x-this.x*v.z,z=this.x*v.y-this.y*v.x;this.x=x;this.y=y;this.z=z;return this;}dot(v){return this.x*v.x+this.y*v.x+this.z*v.z;}negate(){this.x=-this.x;this.y=-this.y;this.z=-this.z;return this;}unit(){return this.normalize();}almostZero(){return false;}};
_CV3.prototype.dot=function(v){return this.x*v.x+this.y*v.y+this.z*v.z;};
const _CQ=class{constructor(){this.x=0;this.y=0;this.z=0;this.w=1;}set(x,y,z,w){this.x=x;this.y=y;this.z=z;this.w=w;return this;}setFromAxisAngle(){return this;}setFromEuler(){return this;}copy(v){this.x=v.x;this.y=v.y;this.z=v.z;this.w=v.w!==undefined?v.w:1;return this;}mult(){return new _CQ();}normalize(){return this;}conjugate(){return this;}inverse(){return this;}};
const _CBody=class{constructor(o={}){this.mass=o.mass||0;this.collisionFilterGroup=o.collisionFilterGroup||0;this.collisionFilterMask=o.collisionFilterMask||0;this.position=new _CV3();this.velocity=new _CV3();this.angularVelocity=new _CV3();this.quaternion=new _CQ();this.shapes=[];this.userData=null;this.sleepState=0;this.linearDamping=0;this.angularDamping=0;this.type=this.mass>0?1:0;}
addShape(s){this.shapes.push(s);return this;} sleep(){return this;} wakeUp(){return this;} sleepTick(){return false;} applyImpulse(){return this;} applyForce(){return this;} updateMassProperties(){return this;} getVelocityAtWorldPoint(v,out){return out?out.copy(this.velocity):this.velocity.clone();}};
const _CWorld=class{constructor(){this.gravity=new _CV3(0,-9.82,0);this.bodies=[];this.constraints=[];this.solver={iterations:5};this.broadphase=null;this.allowSleep=false;}
add(b){this.addBody(b);} addBody(b){this.bodies.push(b);} removeBody(b){const i=this.bodies.indexOf(b);if(i>=0)this.bodies.splice(i,1);} addConstraint(c){this.constraints.push(c);} removeConstraint(c){const i=this.constraints.indexOf(c);if(i>=0)this.constraints.splice(i,1);}
step(fdt,dt){ const h=(fdt||dt||1/60); for(const b of this.bodies){ if(!b.mass) continue; b.velocity.y-=11*h; b.position.x+=b.velocity.x*h; b.position.y+=b.velocity.y*h; b.position.z+=b.velocity.z*h; } }};
sandbox.CANNON={World:_CWorld,Body:_CBody,Box:class{constructor(hv){this.halfExtents=hv;}},Sphere:class{constructor(r){this.radius=r;}},Vec3:_CV3,Quaternion:_CQ,PointToPointConstraint:class{constructor(){}},NaiveBroadphase:class{}};

// ── 受控时钟 (loop() 驱动用) ──
let fakeT=Date.now();
sandbox.performance.now=()=>fakeT;
const FRAME_MS=1000/60;
const tickClock=()=>{ fakeT+=FRAME_MS; };

function boot(campIdx){
for(const k in byId) delete byId[k];
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document; ctx.window=window;
ctx.near=near; ctx.isFinite=isFinite; // 探针助手注入 (vm 上下文不继承宿主全局)
ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return (k in this._s)?this._s[k]:null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of FILES) load(ctx,f);
return ctx;
}
function load(ctx,file){ vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file}); }
function startGame(ctx){
return vm.runInContext(`(()=>{try{const b=document.getElementById('startBtn');if(b&&b.onclick)b.onclick();else return false;return true;}catch(e){return 'ERR:'+String(e&&e.message||e);}})()`,ctx);
}
function deploy(ctx){
return vm.runInContext(`(()=>{try{if(typeof deployPlayer!=='function') return 'no-fn';deployPlayer();return player.deployed?'ok':'not-deployed';}catch(e){return 'ERR:'+String(e&&e.message||e);}})()`,ctx);
}
let PASS=0,FAILS=0;
function ok(cond,label){ if(cond){ PASS++; console.log('  ✔ '+label); } else { FAILS++; console.log('  ✘ '+label); } }
function near(a,b,eps){ return Math.abs(a-b)<=(eps||1e-9); }
// 可复现随机 (mulberry32)
function rng(seed){ let a=seed>>>0; return function(){ a|=0; a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }

console.log('── T0 载入清单 (index.html 动态对账) ──');
{
const onDisk=fs.readdirSync(path.join(root,'js')).sort();
ok(FILES.length>=40,'T0 实载脚本 '+FILES.length+' 个 (动态解析)');
ok(onDisk.every(f=>FILES.indexOf('js/'+f)>=0),'T0 js/ 目录无漏载 ('+onDisk.length+' 个文件)');
}

console.log('── T7 源码断言 (回退旗/留档函数在位) ──');
{
const t3=read('js/03-terrain.js'), t4=read('js/04-collision.js');
ok(t3.includes('window.SEG_OFF')&&t3.includes('window.ROAD_OFF')&&t3.includes('window.GULLY_OFF')&&t3.includes('window.RAMP_OFF'),'T7 A 项回退旗 SEG_OFF/ROAD_OFF/GULLY_OFF/RAMP_OFF 落码');
ok(t3.includes('function hgridClearSlow(iI,jJ)')&&t3.includes('function hgridClearFast(iI,jJ)')&&t3.includes('window.HGRID_OFF?hgridClearSlow(iI,jJ):hgridClearFast(iI,jJ)'),'T7 B 项 hgridClearSlow/Fast 拆分 + HGRID_OFF 委托落码');
ok(t4.includes('window.RAYGND_OFF||maxD<=30||dir.y<-0.35'),'T7 C 项 RAYGND_OFF 回退旗落码 (box/cyl 档前置不动)');
}

// ── 每图等价验证 ──
const CAMP_NAMES=['normandy','stalingrad','berlin','songhu','baituan','burma'];
const t1stats={}, t4stats={}, t5stats={};
for(const CAMP of CAMPS){
const nm=CAMP_NAMES[CAMP]||('#'+CAMP);
console.log('── T1/T2/T3 ['+nm+'] boot+开局 ──');
const ctx=boot(CAMP);
const start=startGame(ctx);
ok(start===true,'['+nm+'] startGame');
const lim=vm.runInContext('MAP_SIZE/2-15',ctx);
const anchors=vm.runInContext(`(()=>{const a=[];for(const f of CAMPAIGN.flags) a.push([f.x,f.z]);for(const b of CAMPAIGN.bases) a.push([b.x,b.z]);for(const s of (CAMPAIGN.spawns||[])) a.push([s.x,s.z]);for(const r of CAMPAIGN.roads) a.push([(r[0]+r[2])/2,(r[1]+r[3])/2]);return a;})()`,ctx);
const R1=rng(0x9E3779B9^(CAMP*2654435761));
// 玩法区撒点: 60% 全图均匀 + 40% 锚点抖动 (±40m)
function samplePoint(rr){
let x,z;
if(anchors.length&&rr()<0.4){ const a=anchors[(rr()*anchors.length)|0]; x=a[0]+(rr()*2-1)*40; z=a[1]+(rr()*2-1)*40; }
else{ x=(rr()*2-1)*lim; z=(rr()*2-1)*lim; }
return [x,z];
}

// T1: hgridClear Fast vs Slow (2200 点) —— 每点先清 HGRID 缓存取新鲜 float64 值对照
// (缓存回读是 Float32Array 存储值 = fround(首次计算值), 旧实现同此行为, 不参与 Fast/Slow 对照)
{
const N=2200; let bitOK=0, caseB=0, cacheOK=0, bad=[];
for(let i=0;i<N;i++){
const [x,z]=samplePoint(R1);
const res=vm.runInContext(`(()=>{
const x=${x}, z=${z};
const iI=Math.max(0,Math.min(HGRID.N-1,Math.floor((x+HGRID.off)/HGRID.res)));
const jJ=Math.max(0,Math.min(HGRID.N-1,Math.floor((z+HGRID.off)/HGRID.res)));
HGRID.data=null;                 // 清缓存: 取新鲜 float64 的 Fast 值做逐位对照
const o=hgridClearSlow(iI,jJ);   // 旧实现 (纯 float64)
const n1=hgridClear(iI,jJ);      // 新实现 (首次计算, float64, 已写入缓存)
const n2=hgridClear(iI,jJ);      // 缓存回读 (float32 存储)
return {o,n1,n2};
})()`,ctx);
if(res.n2===Math.fround(res.n1)) cacheOK++;
const signBand=(res.o<=0||res.n1<=0);
if(signBand){ if(res.o===res.n1) bitOK++; else if(bad.length<5) bad.push({x,z,o:res.o,n:res.n1,viol:'band-bit'}); }
else{ if(res.n1>0&&res.n1>=res.o) caseB++; else if(bad.length<5) bad.push({x,z,o:res.o,n:res.n1,viol:'far-sign'}); }
}
t1stats[nm]={bitOK,caseB,cacheOK,N,bad};
ok(bad.length===0,'T1['+nm+'] hgridClear Fast/Slow (新鲜值): 带内/贴带逐位 === '+bitOK+' 点 · 快路区 new≥old>0 '+caseB+' 点 · 无违规'+(bad.length?(' 违例样本 '+JSON.stringify(bad)):''));
ok(cacheOK===N,'T1['+nm+'] 缓存回读 = fround(首算值) ('+cacheOK+'/'+N+')');
}

// T2: heightAt 快路 vs 全路逐位 (1200 点 × noBridge 两档)
{
const N=1200; let okc=0; const bad=[];
for(let i=0;i<N;i++){
const [x,z]=samplePoint(R1);
const res=vm.runInContext(`(()=>{
const x=${x}, z=${z};
window.HGRID_OFF=false;
const a1=heightAt(x,z,false), a2=heightAt(x,z,true);
window.HGRID_OFF=true;
const b1=heightAt(x,z,false), b2=heightAt(x,z,true);
window.HGRID_OFF=false;
const c1=heightAt(x,z,false);
return {a1,a2,b1,b2,c1};
})()`,ctx);
if(res.a1===res.b1&&res.a2===res.b2&&res.c1===res.a1) okc++;
else if(bad.length<5) bad.push({x,z,a1:res.a1,b1:res.b1,a2:res.a2,b2:res.b2,c1:res.c1});
}
ok(bad.length===0,'T2['+nm+'] heightAt 快路/全路 (HGRID_OFF) 逐位 === ('+okc+'/'+N+' 点 × noBridge 两档 + 缓存回读)'+(bad.length?(' 违例 '+JSON.stringify(bad)):''));
}

// T3: rawHeight / heightAt(全路) 的 SEG_OFF 前后逐位 (1500 点)
{
const N=1500; let okr=0, okh=0; const badr=[], badh=[];
for(let i=0;i<N;i++){
const [x,z]=samplePoint(R1);
const res=vm.runInContext(`(()=>{
const x=${x}, z=${z};
window.SEG_OFF=false;
const r1=rawHeight(x,z);
window.HGRID_OFF=true;   // heightAt 强制全路, 隔离 A 项变量
const h1=heightAt(x,z,true);
window.SEG_OFF=true;
const r2=rawHeight(x,z);
const h2=heightAt(x,z,true);
window.SEG_OFF=false; window.HGRID_OFF=false;
return {r1,r2,h1,h2};
})()`,ctx);
if(res.r1===res.r2) okr++; else if(badr.length<5) badr.push({x,z,r1:res.r1,r2:res.r2});
if(res.h1===res.h2) okh++; else if(badh.length<5) badh.push({x,z,h1:res.h1,h2:res.h2});
}
ok(badr.length===0,'T3['+nm+'] rawHeight SEG_OFF 前后逐位 === ('+okr+'/'+N+')'+(badr.length?(' 违例 '+JSON.stringify(badr)):''));
ok(badh.length===0,'T3['+nm+'] heightAt 全路径 SEG_OFF 前后逐位 === ('+okh+'/'+N+')'+(badh.length?(' 违例 '+JSON.stringify(badh)):''));
}

// T4: roadDist/gullyDist/rampMask 探针侧全扫参考对照 (1500 点)
{
const N=1500; let okr=0,okg=0,okm=0; const badr=[],badg=[],badm=[];
const hasLoess=vm.runInContext('!!(LOESS&&LOESS.gullies)',ctx);
for(let i=0;i<N;i++){
const [x,z]=samplePoint(R1);
const res=vm.runInContext(`(()=>{
const x=${x}, z=${z};
const newRd=roadDist(x,z);
let refRd=CAMPAIGN.sineRoad?Math.abs(z-sineRoadZ(x)):1e9;
for(const r of CAMPAIGN.roads){ const d=segDist(x,z,r[0],r[1],r[2],r[3]); if(d<refRd) refRd=d; }
return {newRd,refRd};
})()`,ctx);
if(res.refRd<=32){ if(res.newRd===res.refRd) okr++; else if(badr.length<4) badr.push({x,z,o:res.refRd,n:res.newRd}); }
else{ if(res.newRd>32) okr++; else if(badr.length<4) badr.push({x,z,o:res.refRd,n:res.newRd,viol:'far'}); }
if(hasLoess){
const res2=vm.runInContext(`(()=>{
const x=${x}, z=${z};
const nG=gullyDist(x,z), nM=rampMask(x,z);
let rG=1e9; for(const g of LOESS.gullies){ for(let i2=0;i2<g.length-1;i2++){ const d=segDist(x,z,g[i2][0],g[i2][1],g[i2+1][0],g[i2+1][1]); if(d<rG) rG=d; } }
let rM=0; for(const r of LOESS.ramps){ const w=r.w||9; const d=segDist(x,z,r.x0,r.z0,r.x1,r.z1); const k=d<=w?1:clamp(1-(d-w)/5,0,1); if(k>rM) rM=k; }
return {nG,nM,rG,rM};
})()`,ctx);
const Wg=vm.runInContext('LOESS.w||14',ctx);
if(res2.rG<=Wg+2.2){ if(res2.nG===res2.rG) okg++; else if(badg.length<4) badg.push({x,z,o:res2.rG,n:res2.nG}); }
else{ if(res2.nG>Wg+2.2) okg++; else if(badg.length<4) badg.push({x,z,o:res2.rG,n:res2.nG,viol:'far'}); }
if(res2.nM===res2.rM) okm++; else if(badm.length<4) badm.push({x,z,o:res2.rM,n:res2.nM});
}else{ okg++; okm++; }
}
ok(badr.length===0,'T4['+nm+'] roadDist 参考: 阈值内(≤32) 逐位 === / 阈值外同越界 ('+okr+'/'+N+')'+(badr.length?(' 违例 '+JSON.stringify(badr)):''));
ok(badg.length===0,'T4['+nm+'] gullyDist 参考: 阈值内(≤W+2.2) 逐位 === / 阈值外同越界 ('+okg+'/'+N+')'+(badg.length?(' 违例 '+JSON.stringify(badg)):''));
ok(badm.length===0,'T4['+nm+'] rampMask 参考核对: 全域逐位 === ('+okm+'/'+N+')'+(badm.length?(' 违例 '+JSON.stringify(badm)):''));
}
// T5: raycastWorld 旧(RAYGND_OFF) vs 新 + 每条射线 heightAt 计数 (仅 RAYCAMPS)
// 随机数全部在 host 侧抽取后以字面量注入 ⇒ 对照/计数用的是同一条射线
if(RAYCAMPS.indexOf(CAMP)>=0){
const NRAYS=520;
const t4s={nullOK:0,gndOK:0,gndFail:0,boxOK:0,nullMis:0,kindMis:0,bad:[]};
const cnt={old:0,new:0};
for(let i=0;i<NRAYS;i++){
const [x,z]=samplePoint(R1);
const az=R1()*6.283185307179586, dy=-0.9+R1()*1.2, oH=R1()*5, mD=20+R1()*380;
const res=vm.runInContext('(()=>{const x='+x+', z='+z+';'+
'const az='+az+', dy='+dy+', hz=Math.sqrt(Math.max(0,1-dy*dy));'+
'const o=new THREE.Vector3(x, heightAt(x,z)+1.2+'+oH+', z);'+
'const d=new THREE.Vector3(Math.cos(az)*hz, dy, Math.sin(az)*hz);'+
'const maxD='+mD+';'+
'window.RAYGND_OFF=true;'+
'const r1=raycastWorld(o,d,maxD); const s1=r1?{dist:r1.dist,kind:r1.kind}:null;'+
'window.RAYGND_OFF=false;'+
'const r2=raycastWorld(o,d,maxD); const s2=r2?{dist:r2.dist,kind:r2.kind}:null;'+
'return {s1,s2};})()',ctx);
// heightAt 计数: host 侧把 __h0/__hn 写进 ctx (vm 内可见全局), 同一条射线新旧各计一次
ctx.__h0=vm.runInContext('heightAt',ctx);
vm.runInContext('heightAt=function(px,pz,nb){__hn++;return __h0(px,pz,nb);}',ctx);
ctx.__hn=0;
vm.runInContext('(()=>{window.RAYGND_OFF=true;'+
'const o=new THREE.Vector3('+x+', heightAt('+x+','+z+')+1.2+'+oH+', '+z+');'+
'const az='+az+', dy='+dy+', hz=Math.sqrt(Math.max(0,1-dy*dy));'+
'raycastWorld(o,new THREE.Vector3(Math.cos(az)*hz,dy,Math.sin(az)*hz),'+mD+');})()',ctx);
const cOld=vm.runInContext('__hn',ctx);
ctx.__hn=0;
vm.runInContext('(()=>{window.RAYGND_OFF=false;'+
'const o=new THREE.Vector3('+x+', heightAt('+x+','+z+')+1.2+'+oH+', '+z+');'+
'const az='+az+', dy='+dy+', hz=Math.sqrt(Math.max(0,1-dy*dy));'+
'raycastWorld(o,new THREE.Vector3(Math.cos(az)*hz,dy,Math.sin(az)*hz),'+mD+');})()',ctx);
const cNew=vm.runInContext('__hn',ctx);
vm.runInContext('heightAt=__h0; window.RAYGND_OFF=false;',ctx);
cnt.old+=cOld; cnt.new+=cNew;
const a=res.s1,b=res.s2;
if(a===null&&b===null){ t4s.nullOK++; continue; }
if((a===null)!==(b===null)){ t4s.nullMis++; if(t4s.bad.length<6) t4s.bad.push({x,z,a,b}); continue; }
if(a.kind!==b.kind){ t4s.kindMis++; if(t4s.bad.length<6) t4s.bad.push({x,z,a,b}); continue; }
if(a.kind==='ground'){ if(Math.abs(a.dist-b.dist)<=0.35) t4s.gndOK++; else{ t4s.gndFail++; if(t4s.bad.length<6) t4s.bad.push({x,z,a,b}); } }
else{ if(a.dist===b.dist) t4s.boxOK++; else{ t4s.kindMis++; if(t4s.bad.length<6) t4s.bad.push({x,z,a,b,viol:'box-bit'}); } }
}
t4stats[nm]=t4s;
ok(t4s.nullMis===0&&t4s.kindMis===0&&t4s.gndFail===0,'T5['+nm+'] raycast 新旧: 同null '+t4s.nullOK+' · ground |Δ|≤0.35 '+t4s.gndOK+' · box/cyl 逐位 '+t4s.boxOK+' · 违例 '+(t4s.nullMis+t4s.kindMis+t4s.gndFail)+(t4s.bad.length?(' 样本 '+JSON.stringify(t4s.bad)):''));
t5stats[nm]={oldAvg:cnt.old/NRAYS,newAvg:cnt.new/NRAYS};
console.log('  · T5['+nm+'] heightAt 调用/射线: 旧 '+cnt.old/NRAYS+' → 新 '+cnt.new/NRAYS);
}

// T6: 活帧 heightAt 调用数/帧 (完整 loop, camp 0/4)
if(CAMP===0||CAMP===4){
const dep=deploy(ctx);
const warmN=vm.runInContext('typeof loop===\'function\'',ctx);
if(dep==='ok'&&warmN){
const drive=(frames)=>{ for(let f=0;f<frames;f++){ tickClock(); vm.runInContext('loop()',ctx); } };
drive(60); // 预热进稳态
ctx.__h0=vm.runInContext('heightAt',ctx); ctx.__hn=0;
vm.runInContext('heightAt=function(x,z,nb){__hn++;return __h0(x,z,nb);}',ctx);
drive(120);
const newAvg=vm.runInContext('__hn/120',ctx);
vm.runInContext('heightAt=__h0;',ctx);
vm.runInContext('window.RAYGND_OFF=true;',ctx);
ctx.__hn=0;
vm.runInContext('heightAt=function(x,z,nb){__hn++;return __h0(x,z,nb);}',ctx);
drive(120);
const oldAvg=vm.runInContext(`(()=>{
const n=__hn; heightAt=__h0; window.RAYGND_OFF=false;
return n/120;
})()`,ctx);
t5stats[nm+'-frame']={oldAvg,newAvg};
console.log('  · T6['+nm+'] heightAt 调用/帧 (120 帧活局): 旧 '+oldAvg.toFixed(1)+' → 新 '+newAvg.toFixed(1));
ok(newAvg<=oldAvg*1.02,'T6['+nm+'] 活帧 heightAt 调用数不高于旧路径 (新 '+newAvg.toFixed(1)+' ≤ 旧 '+oldAvg.toFixed(1)+'×1.02)');
}else{
console.log('  · T6['+nm+'] 跳过 (deploy=' + dep + ' / loop=' + warmN + ')');
}
}
}

// ── 汇总 ──
console.log('\n══ 汇总 ══');
for(const k in t1stats){ const s=t1stats[k]; console.log('T1 '+k+': 带内逐位 '+s.bitOK+' / 快路区 '+s.caseB+' / 缓存 '+s.cacheOK+' (N='+s.N+')'); }
for(const k in t5stats){ const s=t5stats[k]; console.log('T5/T6 '+k+': 旧 '+s.oldAvg.toFixed(2)+' → 新 '+s.newAvg.toFixed(2)+' (heightAt 调用均摊)'); }
console.log('\n【正向】 ✓ '+PASS+' / ✗ '+FAILS);
if(FAILS>0) process.exit(1);
