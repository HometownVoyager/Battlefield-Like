// ─────────────────────────────────────────────
// dev/probe-frameprofile-20261113.js —— 主循环帧剖析 (诊断工具, 恒 0 退出, 不进 run-all 套件)
// 用法: node dev/probe-frameprofile-20261113.js [--camp N] [--frames N] [--interval µs]
// 原理: 复用 _bootstub 桩载入全部真实脚本 → startBtn 开局 → deployPlayer 落地 → 受控时钟
//       (sandbox.performance.now 由本探针接管, 每帧 +16.666ms) 驱动**完整 loop()** (含 HUD/相机/
//       特效/渲染管线调用, 不只是 STEP_FN 子集), 期间用 V8 CPU profiler 按 200µs 采样,
//       聚合**函数自耗时** (self time) top 榜 —— 渲染器/音频桩是 no-op, 本探针量的是 JS 逻辑层
//       每帧真实成本; 渲染侧 (draw call/材质/阴影) 另见 probe-renderstat。
// 附带: THREE 高频类构造计数 (Vector3/Euler/Quaternion/Matrix4/Mesh/Material/Geo) 分建图期/
//       预热期/采样期三窗统计, GC 压力按分配率读数。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),inspector=require('inspector');
const root=path.resolve(__dirname,'..');
const {THREE,document,window,sandbox,byId}=require('./_bootstub.js');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const html=read('index.html');
const FILES=[...html.matchAll(/<script src="(js\/[^"?]+)\?v=[^"]*"/g)].map(m=>m[1]);

// ── 参数 ──
let CAMP=0,FRAMES=900,INTERVAL=200;
for(let i=2;i<process.argv.length;i++){
if(process.argv[i]==='--camp') CAMP=parseInt(process.argv[++i]);
else if(process.argv[i]==='--frames') FRAMES=parseInt(process.argv[++i]);
else if(process.argv[i]==='--interval') INTERVAL=parseInt(process.argv[++i]);
}

// ── THREE 构造计数 (载入前装好, 分窗读数) ──
// ★prototype 补丁必须打在**包装前**的原始类上: 下面 WRAP 会把 THREE.Euler 换成 extends 包装类,
//   而 _bootstub 的 Obj3 闭包内 new Euler() 用的是原始类 —— 包装后再补就补到包装类 prototype
//   上, 实例原型链根本不经过它 (本探针首跑实测踩中: g.clip.rotation.clone 炸)。
if(!THREE.Euler.prototype.clone) THREE.Euler.prototype.clone=function(){ const e=new THREE.Euler(); e.x=this.x; e.y=this.y; e.z=this.z; e.order=this.order; return e; };
if(!THREE.Euler.prototype.copy) THREE.Euler.prototype.copy=function(e){ this.x=e.x; this.y=e.y; this.z=e.z; this.order=e.order||this.order; return this; };
// 真 THREE Material 有 clone —— 08-effects bloodDecal 逐贴片克隆材质 (血贴片互不覆盖 opacity) 依赖它。
for(const _mn of ['MeshLambertMaterial','MeshBasicMaterial','MeshStandardMaterial','MeshPhongMaterial','PointsMaterial','SpriteMaterial','LineBasicMaterial']){
const _MC=THREE[_mn];
if(_MC&&!_MC.prototype.clone) _MC.prototype.clone=function(){ const c=new _MC(Object.assign({},this)); if(this.color&&this.color.getHex) c.color=new THREE.Color(this.color.getHex()); return c; };
}
const alloc={};
const WRAP=['Vector3','Vector2','Vector4','Euler','Quaternion','Matrix4','Color','Mesh','Group','Sprite','BoxGeometry','CylinderGeometry','SphereGeometry','PlaneGeometry','BufferGeometry','MeshLambertMaterial','MeshBasicMaterial','MeshStandardMaterial','MeshPhongMaterial','PointsMaterial','SpriteMaterial','LineBasicMaterial','CanvasTexture','Texture','PointLight','SpotLight'];
for(const nm of WRAP){
const O=THREE[nm]; if(!O) continue;
try{
THREE[nm]=class extends O{constructor(...a){super(...a);alloc[nm]=(alloc[nm]||0)+1;}};
}catch(e){}
}
// ── 受控时钟: 接管 sandbox.performance.now (载入 24-main 的 lastT 与每帧 now 都走它) ──
let fakeT=Date.now();
sandbox.performance.now=()=>fakeT;
const FRAME_MS=1000/60;
const tickClock=()=>{ fakeT+=FRAME_MS; };

// ── 桩忠实化补丁 (探针侧, 不动共享 _bootstub) ──
// 真 THREE.Object3D 有 clear() (移除全部子件) —— 10-viewmodel vmEquip 的 VM.inner.clear() 依赖它;
// 真 AudioContext 的 OscillatorNode 有 detune —— 01-audio 引擎链 osc2.detune.value 依赖它。
THREE.Object3D.prototype.clear=function(){ const c=this.children.slice(); for(const m of c) this.remove(m); };
const AC0=sandbox.AudioContext;
const _param=p=>{ if(p&&!p.setTargetAtTime) p.setTargetAtTime=function(){return this;}; return p; };
const ACW=class extends AC0{
createOscillator(){ const o=super.createOscillator(); if(!o.detune) o.detune={value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}}; _param(o.frequency); _param(o.detune); return o; }
createGain(){ const g=super.createGain(); _param(g.gain); return g; }
createBufferSource(){ const s=super.createBufferSource(); _param(s.playbackRate); return s; }
createBiquadFilter(){ const f=super.createBiquadFilter(); _param(f.frequency); return f; }
};
sandbox.AudioContext=ACW; sandbox.window.AudioContext=ACW; sandbox.window.webkitAudioContext=ACW;

// 真 DOM CSSStyleDeclaration 有 setProperty —— 22-hud hudStyle 对 '-' 前缀属性走 setProperty (桩的 style 是裸对象)。
// 桩元素由闭包内 mkElement 惰性创建 ⇒ 只能包装 document 的三个创建入口逐个补。
const _mkStyle=e=>{ if(e&&e.style&&!e.style.setProperty) e.style.setProperty=function(p,v){ this[p]=v; }; return e; };
const _gEBI=document.getElementById, _cEl=document.createElement, _qSel=document.querySelector;
document.getElementById=id=>_mkStyle(_gEBI(id));
document.createElement=t=>_mkStyle(_cEl(t));
document.querySelector=s=>_mkStyle(_qSel(s));
// 裸名 CANNON (12-ragdolls ragInit 直接引用; _bootstub 只给了 window.CANNON) —— 完整 loop 交战死人必进布娃娃链。
// _bootstub 的 CANNON 是半截桩 (World 无 gravity/step, Body 无 position) ⇒ 本探针给**最小可积分**假物理:
// 重力积分自由体; 地面支撑/阻尼由游戏侧 updateRagdolls 的 pen 修正自己处理 (12-ragdolls:280-293),
// 约束不求解 (姿态不模拟) —— 对测 updateRagdolls 的 JS 成本 (每部件每帧 5×heightAt) 保真。
const _CV3=class{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;}clone(){return new _CV3(this.x,this.y,this.z);}length(){return Math.hypot(this.x,this.y,this.z);}normalize(){const l=this.length()||1;this.x/=l;this.y/=l;this.z/=l;return this;}scale(s){this.x*=s;this.y*=s;this.z*=s;return this;}vadd(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;}vsub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this;}cross(v){const x=this.y*v.z-this.z*v.y,y=this.z*v.x-this.x*v.z,z=this.x*v.y-this.y*v.x;this.x=x;this.y=y;this.z=z;return this;}dot(v){return this.x*v.x+this.y*v.y+this.z*v.z;}negate(){this.x=-this.x;this.y=-this.y;this.z=-this.z;return this;}unit(){return this.normalize();}almostZero(){return false;}};
const _CQ=class{constructor(){this.x=0;this.y=0;this.z=0;this.w=1;}set(x,y,z,w){this.x=x;this.y=y;this.z=z;this.w=w;return this;}setFromAxisAngle(){return this;}setFromEuler(){return this;}copy(v){this.x=v.x;this.y=v.y;this.z=v.z;this.w=v.w!==undefined?v.w:1;return this;}mult(){return new _CQ();}normalize(){return this;}conjugate(){return this;}inverse(){return this;}}
const _CBody=class{constructor(o={}){this.mass=o.mass||0;this.collisionFilterGroup=o.collisionFilterGroup||0;this.collisionFilterMask=o.collisionFilterMask||0;this.position=new _CV3();this.velocity=new _CV3();this.angularVelocity=new _CV3();this.quaternion=new _CQ();this.shapes=[];this.userData=null;this.sleepState=0;this.linearDamping=0;this.angularDamping=0;this.type=this.mass>0?1:0;}
addShape(s){this.shapes.push(s);return this;} sleep(){return this;} wakeUp(){return this;} sleepTick(){return false;} applyImpulse(){return this;} applyForce(){return this;} updateMassProperties(){return this;} getVelocityAtWorldPoint(v,out){return out?out.copy(this.velocity):this.velocity.clone();}};
const _CWorld=class{constructor(){this.gravity=new _CV3(0,-9.82,0);this.bodies=[];this.constraints=[];this.solver={iterations:5};this.broadphase=null;this.allowSleep=false;}
add(b){this.addBody(b);} addBody(b){this.bodies.push(b);} removeBody(b){const i=this.bodies.indexOf(b);if(i>=0)this.bodies.splice(i,1);} addConstraint(c){this.constraints.push(c);} removeConstraint(c){const i=this.constraints.indexOf(c);if(i>=0)this.constraints.splice(i,1);}
step(fdt,dt){ const h=(fdt||dt||1/60); for(const b of this.bodies){ if(!b.mass) continue; b.velocity.y-=11*h; b.position.x+=b.velocity.x*h; b.position.y+=b.velocity.y*h; b.position.z+=b.velocity.z*h; } }};
sandbox.CANNON={World:_CWorld,Body:_CBody,Box:class{constructor(hv){this.halfExtents=hv;}},Sphere:class{constructor(r){this.radius=r;}},Vec3:_CV3,Quaternion:_CQ,PointToPointConstraint:class{constructor(){}},NaiveBroadphase:class{}};

function boot(campIdx){
for(const k in byId) delete byId[k];
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document; ctx.window=window;
ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return (k in this._s)?this._s[k]:null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of FILES) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
return ctx;
}
for(const k in alloc) alloc[k]=0;          // 只统计建图期之后 (建图期一次性, 不反映每帧)
const t0=Date.now();
const ctx=boot(CAMP);
const buildMs=Date.now()-t0;
const buildAlloc={}; for(const k in alloc) buildAlloc[k]=alloc[k];

// ── 开局 + 部署 ──
const start=vm.runInContext(`(()=>{try{const b=document.getElementById('startBtn');if(b&&b.onclick)b.onclick();else return 'no-onclick';return 'ok';}catch(e){return 'ERR:'+String(e&&e.message||e);}})()`,ctx);
let deployed='skipped';
if(start==='ok'){
deployed=vm.runInContext(`(()=>{try{if(typeof deployPlayer!=='function') return 'no-fn';deployPlayer();return player.deployed?'ok':'not-deployed';}catch(e){return 'ERR:'+String(e&&e.message||e);}})()`,ctx);
}
console.log('== 帧剖析 #'+CAMP+' ==  开局:'+start+' 部署:'+deployed+' 建图期 '+buildMs+'ms (load+buildWorld+快照)');

// ── 主循环驱动器 ──
ctx.__tick=()=>tickClock();
const drive=(frames)=>{ for(let f=0;f<frames;f++){ tickClock(); vm.runInContext('loop()',ctx); } };

// ── 预热: AI 展开/首波交火/换弹账等进入稳态 ──
const warm=120;
drive(warm);
for(const k in alloc) alloc[k]=0;   // 分窗: 预热结束清零 → 采样窗读每帧均摊

// ── CPU profiler 采样 ──
const session=new inspector.Session();
session.connect();
const post=(m,p)=>new Promise((res,rej)=>session.post(m,p,(e,r)=>e?rej(e):res(r)));
(async()=>{
await post('Profiler.enable');
await post('Profiler.setSamplingInterval',{interval:INTERVAL});
await post('Profiler.start');
const h0=process.memoryUsage().heapUsed;
const t1=Date.now();
drive(FRAMES);
const wall=Date.now()-t1;
const h1=process.memoryUsage().heapUsed;
const {profile}=await post('Profiler.stop');
session.disconnect();

// ── 聚合 self time ──
const agg=new Map();
for(const n of profile.nodes){
const cf=n.callFrame||{};
const url=(cf.url||'').replace(/\\/g,'/');
if(!n.hitCount) continue;
const key=(cf.functionName||'(anonymous)')+' @ '+(url?url+':'+((cf.lineNumber||0)+1):'(vm)');
agg.set(key,(agg.get(key)||0)+n.hitCount);
}
const totalHits=[...agg.values()].reduce((a,b)=>a+b,0);
const selfMs=h=>h*INTERVAL/1000;
const rows=[...agg.entries()].map(([k,h])=>({k,ms:selfMs(h),pct:100*h/totalHits})).sort((a,b)=>b.ms-a.ms);
console.log('\n== 采样窗: '+FRAMES+' 帧 wall='+wall+'ms ⇒ '+(wall/FRAMES).toFixed(2)+' ms/帧 (沙箱 JS 逻辑层, 渲染/音频为桩) ==');
console.log('总采样 '+totalHits+' hits × '+INTERVAL+'µs ⇒ 有账时长 '+(totalHits*INTERVAL/1000).toFixed(0)+'ms');
console.log('\n-- Top 40 函数自耗时 (self) --');
for(let i=0;i<Math.min(40,rows.length);i++){
const r=rows[i];
console.log(String((i+1)).padStart(3)+'. '+r.ms.toFixed(1).padStart(7)+'ms  '+r.pct.toFixed(1).padStart(5)+'%  '+r.k);
}

// ── 场上规模快照 (供解读占比) ──
const scale=vm.runInContext(`({soldiers:soldiers.length,alive:soldiers.filter(s=>s.alive).length,tanks:tanks.length,planes:planes.length,shells:shells.length,nades:nades.length,smokes:SMOKES.length,particles:particles.length,boxes:BOXES.length,world:world?world.length:-1,tracers:tracers.length,player:player.alive,nowT:Math.round(nowT)})`,ctx);
console.log('\n-- 采样窗末规模 -- '+JSON.stringify(scale));

// ── 分配率 (采样窗内, 每帧均摊) ──
console.log('\n-- THREE 构造分配/帧 (采样窗 '+FRAMES+' 帧) --');
const ar=[...Object.entries(alloc)].filter(([k,v])=>v>FRAMES*0.5).sort((a,b)=>b[1]-a[1]);
for(const [k,v] of ar) console.log('  '+k.padEnd(22)+ (v/FRAMES).toFixed(1)+' /帧');
console.log('  heapUsed Δ='+(h1-h0>0?'+':'')+((h1-h0)/1048576).toFixed(1)+'MB ('+FRAMES+' 帧, 含探针自身, 仅趋势参考)');

// ── 建图期分配对照 ──
console.log('\n-- 建图期分配 (一次性) --');
const ba=[...Object.entries(buildAlloc)].filter(([k,v])=>v>1000).sort((a,b)=>b[1]-a[1]).slice(0,10);
for(const [k,v] of ba) console.log('  '+k.padEnd(22)+v);
console.log('\n诊断工具恒 0 退出。');
process.exit(0);
})().catch(e=>{ console.error('profiler 失败: '+String(e&&e.stack||e)); process.exit(0); });
