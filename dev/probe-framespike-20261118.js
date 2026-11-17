// ─────────────────────────────────────────────
// dev/probe-framespike-20261118.js —— 逐帧尖峰剖析 (诊断工具, 恒 0 退出, 不进 run-all 套件)
// 用法: node dev/probe-framespike-20261118.js [--camp N] [--frames N] [--warm N]
// 与 probe-frameprofile-20261113 (V8 采样, 平均自耗时) 互补: 本探针给**逐帧 wall time 直方图 +
// 最慢帧的逐系统归因** —— 平均剖析看不见的"偶发尖帧"(NAV 大批/粒子重建/世界扫描) 在这里现形。
// 原理: 复用 _bootstub 桩载入全部真实脚本 → 开局落地 → 受控时钟每帧 +16.666ms 驱动完整 loop();
//       在沙箱内把顶层 update* 函数与实体 update 方法用耗时探针包一层 (宿主 hrtime.bigint),
//       逐帧读回各函数耗时, 保留最慢帧的分解。
// 注意: 包桩本身有 ~0.2µs/调用 开销, 绝对值略有放大, 排名与尖峰归因不受影响。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const {THREE,document,window,sandbox,byId}=require('./_bootstub.js');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const html=read('index.html');
const FILES=[...html.matchAll(/<script src="(js\/[^"?]+)\?v=[^"]*"/g)].map(m=>m[1]);

let CAMP=0,FRAMES=900,WARM=150;
for(let i=2;i<process.argv.length;i++){
if(process.argv[i]==='--camp') CAMP=parseInt(process.argv[++i]);
else if(process.argv[i]==='--frames') FRAMES=parseInt(process.argv[++i]);
else if(process.argv[i]==='--warm') WARM=parseInt(process.argv[++i]);
}

// ── 与 frameprofile 同款桩补丁 (忠实化) ──
if(!THREE.Euler.prototype.clone) THREE.Euler.prototype.clone=function(){ const e=new THREE.Euler(); e.x=this.x; e.y=this.y; e.z=this.z; e.order=this.order; return e; };
if(!THREE.Euler.prototype.copy) THREE.Euler.prototype.copy=function(e){ this.x=e.x; this.y=e.y; this.z=e.z; this.order=e.order||this.order; return this; };
for(const _mn of ['MeshLambertMaterial','MeshBasicMaterial','MeshStandardMaterial','MeshPhongMaterial','PointsMaterial','SpriteMaterial','LineBasicMaterial']){
const _MC=THREE[_mn];
if(_MC&&!_MC.prototype.clone) _MC.prototype.clone=function(){ const c=new _MC(Object.assign({},this)); if(this.color&&this.color.getHex) c.color=new THREE.Color(this.color.getHex()); return c; };
}
THREE.Object3D.prototype.clear=function(){ const c=this.children.slice(); for(const m of c) this.remove(m); };
let fakeT=Date.now();
sandbox.performance.now=()=>fakeT;
const FRAME_MS=1000/60;
const tickClock=()=>{ fakeT+=FRAME_MS; };
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
const _CV3=class{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;}clone(){return new _CV3(this.x,this.y,this.z);}length(){return Math.hypot(this.x,this.y,this.z);}normalize(){const l=this.length()||1;this.x/=l;this.y/=l;this.z/=l;return this;}scale(s){this.x*=s;this.y*=s;this.z*=s;return this;}vadd(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;}vsub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this;}cross(v){const x=this.y*v.z-this.z*v.y,y=this.z*v.x-this.x*v.z,z=this.x*v.y-this.y*v.x;this.x=x;this.y=y;this.z=z;return this;}dot(v){return this.x*v.x+this.y*v.y+this.z*v.z;}negate(){this.x=-this.x;this.y=-this.y;this.z=-this.z;return this;}unit(){return this.normalize();}almostZero(){return false;}};
const _CQ=class{constructor(){this.x=0;this.y=0;this.z=0;this.w=1;}set(x,y,z,w){this.x=x;this.y=y;this.z=z;this.w=w;return this;}setFromAxisAngle(){return this;}setFromEuler(){return this;}copy(v){this.x=v.x;this.y=v.y;this.z=v.z!==undefined?v.z:0;this.w=v.w!==undefined?v.w:1;return this;}mult(){return new _CQ();}normalize(){return this;}conjugate(){return this;}inverse(){return this;}}
const _CBody=class{constructor(o={}){this.mass=o.mass||0;this.collisionFilterGroup=o.collisionFilterGroup||0;this.collisionFilterMask=o.collisionFilterMask||0;this.position=new _CV3();this.velocity=new _CV3();this.angularVelocity=new _CV3();this.quaternion=new _CQ();this.shapes=[];this.userData=null;this.sleepState=0;this.linearDamping=0;this.angularDamping=0;this.type=this.mass>0?1:0;}
addShape(s){this.shapes.push(s);return this;} sleep(){return this;} wakeUp(){return this;} sleepTick(){return false;} applyImpulse(){return this;} applyForce(){return this;} updateMassProperties(){return this;} getVelocityAtWorldPoint(v,out){return out?out.copy(this.velocity):this.velocity.clone();}};
const _CWorld=class{constructor(){this.gravity=new _CV3(0,-9.82,0);this.bodies=[];this.constraints=[];this.solver={iterations:5};this.broadphase=null;this.allowSleep=false;}
add(b){this.addBody(b);} addBody(b){this.bodies.push(b);} removeBody(b){const i=this.bodies.indexOf(b);if(i>=0)this.bodies.splice(i,1);} addConstraint(c){this.constraints.push(c);} removeConstraint(c){const i=this.constraints.indexOf(c);const j=this.constraints.indexOf(c);if(j>=0)this.constraints.splice(j,1);}
step(fdt,dt){ const h=(fdt||dt||1/60); for(const b of this.bodies){ if(!b.mass) continue; b.velocity.y-=11*h; b.position.x+=b.velocity.x*h; b.position.y+=b.velocity.y*h; b.position.z+=b.velocity.z*h; } }};
sandbox.CANNON={World:_CWorld,Body:_CBody,Box:class{constructor(hv){this.halfExtents=hv;}},Sphere:class{constructor(r){this.radius=r;}},Vec3:_CV3,Quaternion:_CQ,PointToPointConstraint:class{constructor(){}},NaiveBroadphase:class{}};

function boot(campIdx){
for(const k in byId) delete byId[k];
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document; ctx.window=window;
ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return (k in this._s)?this._s[k]:null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of FILES) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
ctx.__hrt=()=>process.hrtime.bigint();
return ctx;
}
const ctx=boot(CAMP);
const start=vm.runInContext(`(()=>{try{const b=document.getElementById('startBtn');if(b&&b.onclick)b.onclick();else return 'no-onclick';return 'ok';}catch(e){return 'ERR:'+String(e&&e.message||e);}})()`,ctx);
let deployed='skipped';
if(start==='ok'){
deployed=vm.runInContext(`(()=>{try{if(typeof deployPlayer!=='function') return 'no-fn';deployPlayer();return player.deployed?'ok':'not-deployed';}catch(e){return 'ERR:'+String(e&&e.message||e);}})()`,ctx);
}
console.log('== 帧尖峰剖析 #'+CAMP+' ==  开局:'+start+' 部署:'+deployed);

// ── 沙箱内装桩: 顶层 update* 函数 + 实体 update 方法 → __spyTot(全程累计) 与 __spyFrm(本帧累计, 宿主逐帧清) ──
vm.runInContext(`
var __spyTot={}, __spyFrm={};
const __G=(function(){return this;})(); // ★沙箱 globalThis 被 bootstub 普通对象遮蔽 (11-17 批入档坑), 用非严格函数 this 拿真全局
function __wrap(name){
const f=__G[name]; if(typeof f!=='function') return;
const w=function(){
const t0=__hrt(); const n=name;
try{ return f.apply(this,arguments); }
finally{ const d=Number(__hrt()-t0)/1000; __spyTot[n]=(__spyTot[n]||0)+d; __spyFrm[n]=(__spyFrm[n]||0)+d; }
};
try{ Object.defineProperty(w,'name',{value:name}); }catch(e){}
__G[name]=w;
}
const FNS=['updatePlayer','updateCamera','updateHUD','updateWeather','updateFires','updateCraters','updateShells','updateFlak','updateNades','updateLoiters','updateParticles','updateTracers','updateCasings','updateSmokes','updateFlags','updateSpots','updateMedCrates','updateBloodDecals','updateDemolish','updateRisers','updateWires','updateNavDirty','updateViewModel','specViewTick','updateUnderwaterFx','updateSea','updateSunShadow','resolveRuntimeSurfaces','updatePlaneCollisions','updateTrucks','updateMineTriggers','updateSupplyPoints','updateTreeBursts','updateWindRotors','updateFallingTrees','updateBurningTrees','updatePlaneWrecks','updateWreckSinks','updateRagdolls','updateSpecVeh','updateNaval','updateBatteries','zombieFrameTick','nightGearTick','updateGamepad','updateScoreboard','refreshDeployList','drawDeployMap','updateMenuCamera','thirdPersonFovTick','specViewHudTick','cmdFrameTick','ACHupdateDummy'];
for(const n of FNS) __wrap(n);
if(typeof ACH!=='undefined'&&ACH&&typeof ACH.update==='function'){ const f=ACH.update; ACH.update=function(){ const t0=__hrt(); try{ return f.apply(this,arguments); } finally{ const d=Number(__hrt()-t0)/1000; __spyTot['ACH.update']=(__spyTot['ACH.update']||0)+d; __spyFrm['ACH.update']=(__spyFrm['ACH.update']||0)+d; } }; }
// 实体方法 (原型级): 士兵 Bot.update / updateMesh, 坦克 Tank.update, 飞机 Plane.update
function __wrapProto(obj,label,meth){
const p=Object.getPrototypeOf(obj); if(!p||typeof p[meth]!=='function') return;
const f=p[meth];
p[meth]=function(){
const t0=__hrt();
try{ return f.apply(this,arguments); }
finally{ const d=Number(__hrt()-t0)/1000; const n=label; __spyTot[n]=(__spyTot[n]||0)+d; __spyFrm[n]=(__spyFrm[n]||0)+d; }
};
}
if(soldiers.length) __wrapProto(soldiers[0],'Bot.update','update');
if(soldiers.length) __wrapProto(soldiers[0],'Bot.updateMesh','updateMesh');
if(tanks.length) __wrapProto(tanks[0],'Tank.update','update');
if(tanks.length) __wrapProto(tanks[0],'Tank.tankPerceive','tankPerceive');
if(tanks.length) __wrapProto(tanks[0],'Tank.driveAI','driveAI');
if(tanks.length) __wrapProto(tanks[0],'Tank.turretAI','turretAI');
if(planes.length) __wrapProto(planes[0],'Plane.update','update');
// ── 高频助手只做**调用计数** (零失真), 与 V8 self-time 配合算单次成本 ──
var __cnt={};
const COUNTS=['heightAt','raycastWorld','eachBoxNear','eachCylNear','standHeight','tankSurfH','tankRideH','waterDepthAt','inRiverWater','findPath','floraCrushTank','vehiclePushTanks','vehiclePushSoldiers','waterYAt'];
for(const cn of COUNTS){ const cf=__G[cn]; if(typeof cf!=='function') continue; __G[cn]=function(){ __cnt[cn]=(__cnt[cn]||0)+1; return cf.apply(this,arguments); }; }
`,ctx);

const spy=vm.runInContext('__spyFrm',ctx);
const clearSpy=()=>{ for(const k in spy) spy[k]=0; };

ctx.__tick=()=>tickClock();
const drive=(frames)=>{ for(let f=0;f<frames;f++){ tickClock(); vm.runInContext('loop()',ctx); } };
for(let f=0;f<WARM;f++){ tickClock(); vm.runInContext('loop()',ctx); }
vm.runInContext('for(const k in __spyTot) delete __spyTot[k];',ctx); // 均摊账只计采样窗

// ── 逐帧采样 ──
const frameMs=[],frameSpy=[];
let over16=0,over33=0,over8=0,sum=0;
for(let f=0;f<FRAMES;f++){
clearSpy();
tickClock();
const t0=process.hrtime.bigint();
vm.runInContext('loop()',ctx);
const ms=Number(process.hrtime.bigint()-t0)/1e6;
frameMs.push(ms); sum+=ms;
if(ms>8) over8++;
if(ms>16.6) over16++;
if(ms>33) over33++;
const snap={}; for(const k in spy) if(spy[k]>0.01) snap[k]=spy[k];
frameSpy.push(snap);
}

// ── 汇总 ──
const sorted=[...frameMs].sort((a,b)=>a-b);
const pct=p=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))].toFixed(2);
console.log('采样 '+FRAMES+' 帧: mean='+(sum/FRAMES).toFixed(2)+'ms p50='+pct(0.5)+' p90='+pct(0.9)+' p99='+pct(0.99)+' max='+Math.max(...frameMs).toFixed(2)+'ms');
console.log('>8ms: '+over8+' 帧 ('+(100*over8/FRAMES).toFixed(1)+'%)  >16.6ms: '+over16+' 帧  >33ms: '+over33+' 帧');
console.log('天气档: '+((typeof WX_CFG!=='undefined'&&WX_CFG)?(WX_CFG.precip||'none'):'?'));

// 逐函数全程均摊
const tot=vm.runInContext('JSON.parse(JSON.stringify(__spyTot))',ctx);
const totRows=Object.entries(tot).map(([k,v])=>({k,us:v/FRAMES})).sort((a,b)=>b.us-a.us);
console.log('\n-- 逐函数均摊 µs/帧 (包桩含调用开销) --');
for(let i=0;i<Math.min(30,totRows.length);i++) console.log('  '+totRows[i].us.toFixed(1).padStart(8)+'µs  '+totRows[i].k);

// 最慢 12 帧归因
const idx=frameMs.map((v,i)=>[v,i]).sort((a,b)=>b[0]-a[0]).slice(0,12);
console.log('\n-- 最慢 12 帧逐系统归因 (µs) --');
for(const [ms,i] of idx){
const s=frameSpy[i];
const rows=Object.entries(s).map(([k,v])=>({k,v})).sort((a,b)=>b.v-a.v).slice(0,6);
const rest=Object.values(s).reduce((a,b)=>a+b,0);
console.log('  帧#'+i+' '+ms.toFixed(1)+'ms | '+rows.map(r=>r.k+':'+r.v.toFixed(0)).join(' ')+(rest<ms*1000?' | 未包桩其余≈'+(ms*1000-rest).toFixed(0)+'µs':''));
}

// 每帧调用计数 (采样窗后半 300 帧, 避开偶发)
const cnt0=vm.runInContext('__cnt',ctx);
for(let f=0;f<300;f++){ tickClock(); vm.runInContext('loop()',ctx); for(const k in cnt0) cnt0[k]=0; }
const cntAcc={};
for(let f=0;f<300;f++){ tickClock(); vm.runInContext('loop()',ctx); for(const k in cnt0) cntAcc[k]=(cntAcc[k]||0)+cnt0[k]; for(const k in cnt0) cnt0[k]=0; }
console.log('\n-- 每帧调用次数 (300 帧均摊) --');
const cntRows=Object.entries(cntAcc).map(([k,v])=>({k,n:v/300})).sort((a,b)=>b.n-a.n);
for(const r of cntRows) console.log('  '+r.n.toFixed(1).padStart(8)+' 次/帧  '+r.k);

// 场上规模
const scale=vm.runInContext(`({soldiers:soldiers.length,alive:soldiers.filter(s=>s.alive).length,tanks:tanks.length,planes:planes.length,shells:shells.length,particles:particles.length,boxes:BOXES.length,craters:runtimeCraters.length,fires:(typeof FIRES!=='undefined')?FIRES.length:-1,wreck:(typeof WRECKS!=='undefined')?WRECKS.length:-1,player:player.alive})`,ctx);
console.log('\n-- 采样窗末规模 -- '+JSON.stringify(scale));
console.log('\n诊断工具恒 0 退出。');
process.exit(0);
