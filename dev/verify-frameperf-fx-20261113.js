// ─────────────────────────────────────────────
// dev/verify-frameperf-fx-20261113.js —— 2026-11-13 特效/战斗层性能批 沙箱探针
// 覆盖:
//   T-A  04b-fire 火焰视觉粒子全局预算门 (fireFxOK/FIRE_FX_BUDGET_STEPS): ≥8 火源驱动 loop(),
//        每帧火粒子 spawn 预算不超档位上限且预算确实绷紧; 火种伤害账照常走 (对圈内目标持续掉血)
//   T-B  12-ragdolls 静止结算门: 真实击杀链 (damage→die→spawnRagdoll) 杀 ≥6 兵 → 落定后冻结
//        (heightAt 计数停涨 / 部件位姿定格) + 活跃帽 (≤RAG_ACTIVE_MAX) + 外部冲量解冻 (再触碰回动)
//   T-C  13-combat/10-viewmodel 分配槽位化: fireBullet 驱动基准上 THREE.Vector3 构造计数较
//        "槽位回退"的阴性对照上下文下降 (阴性对照 = dev/verify-animfix 同款源码回补手法)
//   T-D  实例矩阵局部上传 (04b fireImDirty / 08 sinkImDirty) 源码断言 + vendor three 部分上传后
//        updateRange.count 自动复位的正确性判据 + 粒子=Sprite 无共享 BufferAttribute 结构判据 (不适用报告)
//   T-E  04b-fire 生物燃烧隔帧交错: dt 累积钟下 DPS 逐位不变 (0.4s 伤害跳) + 粒子采样频次减半
// 风格: dev/verify-perfreg-20261111.js (boot 动态清单 + ok/near); 假 CANNON/受控时钟/WRAP 计数抄
//       dev/probe-frameprofile-20261113.js。恒 0 退出 (判据读 ✗ 计数)。
// 用法: node dev/verify-frameperf-fx-20261113.js
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const {THREE,document,window,sandbox,byId}=require('./_bootstub.js');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const html=read('index.html');
const FILES=[...html.matchAll(/<script src="(js\/[^"?]+)\?v=[^"]*"/g)].map(m=>m[1]);

// ── 桩忠实化补丁 (探针侧, 与 probe-frameprofile 同款, 不动共享 _bootstub) ──
if(!THREE.Euler.prototype.clone) THREE.Euler.prototype.clone=function(){ const e=new THREE.Euler(); e.x=this.x; e.y=this.y; e.z=this.z; e.order=this.order; return e; };
if(!THREE.Euler.prototype.copy) THREE.Euler.prototype.copy=function(e){ this.x=e.x; this.y=e.y; this.z=e.z; this.order=e.order||this.order; return this; };
for(const _mn of ['MeshLambertMaterial','MeshBasicMaterial','MeshStandardMaterial','MeshPhongMaterial','PointsMaterial','SpriteMaterial','LineBasicMaterial']){
const _MC=THREE[_mn];
if(_MC&&!_MC.prototype.clone) _MC.prototype.clone=function(){ const c=new _MC(Object.assign({},this)); if(this.color&&this.color.getHex) c.color=new THREE.Color(this.color.getHex()); return c; };
}
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
const _mkStyle=e=>{ if(e&&e.style&&!e.style.setProperty) e.style.setProperty=function(p,v){ this[p]=v; }; return e; };
const _gEBI=document.getElementById, _cEl=document.createElement, _qSel=document.querySelector;
document.getElementById=id=>_mkStyle(_gEBI(id));
document.createElement=t=>_mkStyle(_cEl(t));
document.querySelector=s=>_mkStyle(_qSel(s));

// ── THREE 构造计数 (载入前 WRAP, 分窗读数) ──
const alloc={};
const WRAP=['Vector3','Vector2','Vector4','Euler','Quaternion','Matrix4','Color','Mesh','Group','Sprite','BoxGeometry','CylinderGeometry','SphereGeometry','PlaneGeometry','BufferGeometry','MeshLambertMaterial','MeshBasicMaterial','MeshStandardMaterial','MeshPhongMaterial','PointsMaterial','SpriteMaterial','LineBasicMaterial','CanvasTexture','Texture','PointLight','SpotLight'];
for(const nm of WRAP){
const O=THREE[nm]; if(!O) continue;
try{ THREE[nm]=class extends O{constructor(...a){super(...a);alloc[nm]=(alloc[nm]||0)+1;}}; }catch(e){}
}

// ── 受控时钟 ──
let fakeT=Date.now();
sandbox.performance.now=()=>fakeT;
const FRAME_MS=1000/60;
const tickClock=()=>{ fakeT+=FRAME_MS; };

// ── 最小可积分假 CANNON (抄 probe-frameprofile-20261113: 重力积分自由体, 地面支撑由游戏侧 pen 修正处理) ──
const _CV3=class{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;}clone(){return new _CV3(this.x,this.y,this.z);}length(){return Math.hypot(this.x,this.y,this.z);}normalize(){const l=this.length()||1;this.x/=l;this.y/=l;this.z/=l;return this;}scale(s){this.x*=s;this.y*=s;this.z*=s;return this;}vadd(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;}vsub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this;}cross(v){const x=this.y*v.z-this.z*v.y,y=this.z*v.x-this.x*v.z,z=this.x*v.y-this.y*v.x;this.x=x;this.y=y;this.z=z;return this;}dot(v){return this.x*v.x+this.y*v.y+this.z*v.z;}negate(){this.x=-this.x;this.y=-this.y;this.z=-this.z;return this;}unit(){return this.normalize();}almostZero(){return false;}};
const _CQ=class{constructor(){this.x=0;this.y=0;this.z=0;this.w=1;}set(x,y,z,w){this.x=x;this.y=y;this.z=z;this.w=w;return this;}setFromAxisAngle(){return this;}setFromEuler(){return this;}copy(v){this.x=v.x;this.y=v.y;this.z=v.z;this.w=v.w!==undefined?v.w:1;return this;}mult(){return new _CQ();}normalize(){return this;}conjugate(){return this;}inverse(){return this;}};
const _CBody=class{constructor(o={}){this.mass=o.mass||0;this.collisionFilterGroup=o.collisionFilterGroup||0;this.collisionFilterMask=o.collisionFilterMask||0;this.position=new _CV3();this.velocity=new _CV3();this.angularVelocity=new _CV3();this.quaternion=new _CQ();this.shapes=[];this.userData=null;this.sleepState=0;this.linearDamping=0;this.angularDamping=0;this.type=this.mass>0?1:0;}
addShape(s){this.shapes.push(s);return this;} sleep(){return this;} wakeUp(){return this;} sleepTick(){return false;} applyImpulse(){return this;} applyForce(){return this;} updateMassProperties(){return this;} getVelocityAtWorldPoint(v,out){return out?out.copy(this.velocity):this.velocity.clone();}};
const _CWorld=class{constructor(){this.gravity=new _CV3(0,-9.82,0);this.bodies=[];this.constraints=[];this.solver={iterations:5};this.broadphase=null;this.allowSleep=false;}
add(b){this.addBody(b);} addBody(b){this.bodies.push(b);} removeBody(b){const i=this.bodies.indexOf(b);if(i>=0)this.bodies.splice(i,1);} addConstraint(c){this.constraints.push(c);} removeConstraint(c){const i=this.constraints.indexOf(c);if(i>=0)this.constraints.splice(i,1);}
step(fdt,dt){ const h=(fdt||dt||1/60); for(const b of this.bodies){ if(!b.mass) continue; b.velocity.y-=11*h; b.position.x+=b.velocity.x*h; b.position.y+=b.velocity.y*h; b.position.z+=b.velocity.z*h; } }};
sandbox.CANNON={World:_CWorld,Body:_CBody,Box:class{constructor(hv){this.halfExtents=hv;}},Sphere:class{constructor(r){this.radius=r;}},Vec3:_CV3,Quaternion:_CQ,PointToPointConstraint:class{constructor(){}},NaiveBroadphase:class{}};

function boot(campIdx,srcPatch){
for(const k in byId) delete byId[k];
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document; ctx.window=window;
ctx.near=near; ctx.isFinite=isFinite;
ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return (k in this._s)?this._s[k]:null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of FILES){
let src=fs.readFileSync(path.join(root,f),'utf8');
if(srcPatch&&srcPatch[f]) src=srcPatch[f](src);
vm.runInContext(src,ctx,{filename:f});
}
return ctx;
}
function startGame(ctx){
return vm.runInContext(`(()=>{try{const b=document.getElementById('startBtn');if(b&&b.onclick)b.onclick();else return false;return true;}catch(e){return 'ERR:'+String(e&&e.message||e);}})()`,ctx);
}
function deploy(ctx){
return vm.runInContext(`(()=>{try{if(typeof deployPlayer!=='function') return 'no-fn';deployPlayer();return player.deployed?'ok':'not-deployed';}catch(e){return 'ERR:'+String(e&&e.message||e);}})()`,ctx);
}
const drive=(ctx,frames)=>{ for(let f=0;f<frames;f++){ tickClock(); vm.runInContext('loop()',ctx); } };
const G=(ctx,code)=>vm.runInContext(code,ctx);

let PASS=0,FAILS=0;
function ok(cond,label){ if(cond){ PASS++; console.log('  ✔ '+label); } else { FAILS++; console.log('  ✘ '+label); } }
function near(a,b,eps){ return Math.abs(a-b)<=(eps||1e-9); }

console.log('── T0 载入清单 (index.html 动态对账) ──');
{
const onDisk=fs.readdirSync(path.join(root,'js')).sort();
ok(FILES.length>=40,'T0 实载脚本 '+FILES.length+' 个 (动态解析)');
ok(onDisk.every(f=>FILES.indexOf('js/'+f)>=0),'T0 js/ 目录无漏载 ('+onDisk.length+' 个文件)');
}

// ════ 主上下文 (修后源码) ════
const ctx=boot(0);
ok(startGame(ctx)===true,'T0 #0 startGame (世界已建)');
ok(deploy(ctx)==='ok','T0 deployPlayer 落地');
drive(ctx,120);   // 预热: AI 展开/交火账进入稳态

// ── spawnP / heightAt 全局计数包装 (包一层函数计数; 探针侧重绑, 生产码零感知) ──
G(ctx,`
var __spN=0; var __spFlash=0; var __hN=0;
const __spOrig=spawnP, __hOrig=heightAt, __wyOrig=waterYAt;
spawnP=function(t,x,y,z,vx,vy,vz,s,g,l,o,gr,ad,sp2){ __spN++; if(t===PT.flash||t===PT.flame) __spFlash++; return __spOrig(t,x,y,z,vx,vy,vz,s,g,l,o,gr,ad,sp2); };   // ★2026-11-19 火焰重做批: 火苗改走 PT.flame, 火粒计数随码 (窗口 [100,240] 口径不变)
heightAt=function(x,z,nb){ __hN++; return __hOrig(x,z,nb); };
`);

console.log('── T-E 生物燃烧隔帧交错 (dt 累积钟: DPS 不变 + 采样频次减半) ──');
{
G(ctx,`
var __te={};
FIRE_SOURCES.length=0; FIRE_ACTIVE.length=0; HEATED.length=0; FBURN.fill(0); FHEAT.fill(0);
waterYAt=function(x,z){ return -1e9; };   // 本测试局部: 免疫水面灭火分支 (窗后恢复 __wyOrig)
const v={alive:true,team:1,isPlayer:false,spectator:false,onVehicle:false,onNaval:false,
pos:V3(camera.position.x+2,0,camera.position.z+2),damage(d,a,h){ __te.dmg=(__te.dmg||0)+d; __te.ticks=(__te.ticks||0)+1; },noticeThreat(){}};
combatants.push(v); __te.victim=v;
const mul=(typeof WX_CFG!=='undefined'&&WX_CFG.fireDmgMul!==undefined)?WX_CFG.fireDmgMul:1;
__te.mul=mul;
if(typeof igniteCreature==='function') igniteCreature(v,null);
__te.burn0=v.burnTimer;
`);
// 半窗 A: dt=1/60 × 600 帧 (10s) — DPS 账 (burnTimer 补到 99: 3.5s 自然熄火会把窗口截到 ~8 跳)
G(ctx,`__te.victim.burnTimer=99; __te.victim.burnTickT=0.4; __te.dmg=0; __te.ticks=0;`);
for(let i=0;i<600;i++) G(ctx,'updateFires(1/60)');
const teA=G(ctx,'__te');
// 半窗 B: updateFires(0) × 600 — 每帧预算重置 + 交错奇偶推进, dt=0 不烧账只显采样频次
G(ctx,`__te.victim.burnTimer=99; __te.victim.burnTickT=0.4; __spFlash=0;`);
for(let i=0;i<600;i++) G(ctx,'updateFires(0)');
const teB=G(ctx,'({spF:__spFlash, spN:__spN})');
G(ctx,`combatants.splice(combatants.indexOf(__te.victim),1); waterYAt=__wyOrig;`);
ok(teA.burn0>0,'T-E igniteCreature 写入燃烧账 (burnTimer='+teA.burn0.toFixed(2)+')');
ok(teA.ticks>=23&&teA.ticks<=27,'T-E 10s 伤害跳数 '+teA.ticks+' ∈ [23,27] (0.4s 周期, dt 累积钟逐位等价)');
ok(near(teA.dmg/Math.max(1,teA.ticks),3.2*teA.mul,1e-6),'T-E 每跳伤害 '+(teA.ticks?(teA.dmg/teA.ticks).toFixed(4):'?')+' ≈ 3.2×天气乘子('+teA.mul+')');
ok(Math.abs(teA.dmg-25*3.2*teA.mul)<=3.2*3,'T-E 10s 总伤 '+teA.dmg.toFixed(1)+' ≈ 25 跳×3.2×'+teA.mul+' (DPS 总量不变, ±3 跳容差)');
ok(teB.spF>=100&&teB.spF<=240,'T-E 火焰粒子采样频次减半: 600 帧窗火粒 spawn(PT.flash|PT.flame)='+teB.spF+' ∈ [100,240] (旧每帧账 ≈330, 交错后半频 ≈165)');
}

console.log('── T-C 分配槽位化: fireBullet 驱动基准 (修后 vs 槽位回退阴性对照) ──');
// 阴性对照源码补丁 (verify-animfix 手法): 把本批槽位写法回填成旧 V3/clone 写法
const PATCH13=(s)=>{
const R=(from,to,cnt)=>{ const c=s.split(from).length-1; if(c!==(cnt||1)) throw new Error('NEG 锚点未找到('+c+'): '+from.slice(0,60)); s=s.split(from).join(to); };
R('const hitP=_fbHit.set(origin.x+dir.x*sr.t,origin.y+dir.y*sr.t,origin.z+dir.z*sr.t);',
  'const hitP=V3(origin.x+dir.x*sr.t,origin.y+dir.y*sr.t,origin.z+dir.z*sr.t);');
R('const hp2=_fbHit.set(origin.x+dir.x*endD,origin.y+dir.y*endD,origin.z+dir.z*endD);',
  'const hp2=V3(origin.x+dir.x*endD,origin.y+dir.y*endD,origin.z+dir.z*endD);');
R('waterSplash(_fbHit.set(origin.x+dir.x*wallD,origin.y+dir.y*wallD,origin.z+dir.z*wallD),0.55);',
  'waterSplash(V3(origin.x+dir.x*wallD,origin.y+dir.y*wallD,origin.z+dir.z*wallD),0.55);');
R('const rv=camRight(_fbR);','const rv=camRight();');
// ★2026-11-25 判据跟码: 遮挡双槽抽进 explosionCoverMul 单源 (原步兵圈两处 → 现单源函数一处)
R(`const dir=_exDir.set(tx-p.x,ty-p.y,tz-p.z), dist=dir.length();
if(!(dist>0.6)) return 1;
dir.multiplyScalar(1/dist);
const block=raycastWorld(_exOrg.set(p.x,p.y+0.25,p.z),dir,dist);`,
  `const dir=V3(tx-p.x,ty-p.y,tz-p.z), dist=dir.length();
if(!(dist>0.6)) return 1;
dir.multiplyScalar(1/dist);
const block=raycastWorld(V3(p.x,p.y+0.25,p.z),dir,dist);`,1);
R(`const eye=_emplA.set(mg.x,mg.y+EMPL_MG_EYE,mg.z);
const muzz=_emplB.copy(eye).addScaledVector(dir,EMPL_MG_MUZ);`,
  `const eye=V3(mg.x,mg.y+EMPL_MG_EYE,mg.z);
const muzz=eye.clone().addScaledVector(dir,EMPL_MG_MUZ);`);
R('const o=_emplA.set(g.x,g.y,g.z).addScaledVector(dir,2.7);','const o=V3(g.x,g.y,g.z).addScaledVector(dir,2.7);');
return s;
};
const PATCH10=(s)=>{
const R=(from,to)=>{ const c=s.split(from).length-1; if(c!==1) throw new Error('NEG 锚点未找到('+c+'): '+from.slice(0,60)); s=s.split(from).join(to); };
// 10-viewmodel 是 CRLF: 多行锚点显式按 \r\n 拼接 (不得混入裸 \n, 否则锚点永不命中)
R([ '// C (2026-11-13): 默认握位缓存 —— positionHands 每帧两次调用, 旧版每次新建 {pos:V3,rot:V3}。',
'// 返回值全库只读 (position.copy/.set 与 vmPalmOf 读字段, 无写入者), 按 key+side 缓存单例 ⇒ 常态每帧 -6 个分配。',
'const _vmHandCache={};',
'function vmHandDefault(key,side){',
"const ck=key+(side?'|L':'|R');",
'let c=_vmHandCache[ck];',
'if(c) return c;',
'c=vmHandDefaultBuild(key,side);',
'_vmHandCache[ck]=c;',
'return c;',
'}',
'function vmHandDefaultBuild(key,side){' ].join('\r\n'),
  'function vmHandDefault(key,side){' );
if(s.indexOf('C (2026-11-13): 默认握位缓存')>=0) throw new Error('PATCH10 未生效');
return s;
};
let ctxOld=null,oldErr='';
try{
ctxOld=boot(0,{'js/13-combat.js':PATCH13,'js/10-viewmodel.js':PATCH10});
startGame(ctxOld); deploy(ctxOld); drive(ctxOld,60);
}catch(e){ oldErr=String(e&&e.message||e); }
ok(!!ctxOld,'T-C 阴性对照上下文 (槽位回退源码) 构建成功'+(oldErr?' — '+oldErr:''));
const bench=(c)=>{
return G(c,`(()=>{
// 选"确认命中"的射手/目标对: 预跑一次 raySoldiers, 只有真命中才进基准 (否则弹道被掩体截停,
// hitP/hp2 分支不跑, 阴性对照的差值就只剩不可见的桩内 clone — camRight() 的 clone 是 _bootstub
// 裸 V3 类, 不经 THREE.Vector3 包装, WRAP 计数器看不见)。野战 natural pair 无 LOS 时,
// 把两名兵传送到玩家身边开阔点面对面 (保证 hitP 分支确定跑)。
const alive=soldiers.filter(s=>s.alive&&!s.spectator&&!s.onVehicle);
if(alive.length<2) return {err:'no-shooter'};
const def=WPN_DEFS['stg44']||WPN_DEFS['rifle']||Object.values(WPN_DEFS)[0];
// 射手/目标必须**敌对**: raySoldiers 对同队做命中过滤 (与 fireBullet 命中管线同口径), 同队对永远空手
const t0=alive.filter(s=>s.team===0), t1=alive.filter(s=>s.team!==0);
const A=t0.length?t0:t1, B=t0.length?t1:t0;
if(!A.length||!B.length) return {err:'no-teams'};
let sh=null,tg=null,o=null,dir=null,bd=1e9;
const tryPair=(a,b)=>{
const ao=V3(a.pos.x,a.pos.y+1.5,a.pos.z);
const d=Math.hypot(b.pos.x-a.pos.x,b.pos.z-a.pos.z);
if(d<0.5||d>60) return;
const ad=V3(b.pos.x-ao.x,(b.pos.y+1.1)-ao.y,b.pos.z-ao.z).normalize();
const wr=raycastWorld(ao,ad,d);
if(wr) return;
const sr=raySoldiers(ao,ad,d+1,a);
if(sr&&sr.sol===b&&d<bd){ sh=a; tg=b; o=ao; dir=ad; bd=d; }
};
for(const a of A.slice(0,10)) for(const b of B.slice(0,10)) tryPair(a,b);
if(!sh){
// 传送布点: 玩家东西两侧 4m (贴地 → 兜底抬高 2m), 8m 水平视线, 敌对双方 ⇒ 命中确定
const a=A[0], b=B[0];
const px=player.pos.x, pz=player.pos.z;
const gyA=heightAt(px+4,pz), gyB=heightAt(px-4,pz);
a.pos.set(px+4,gyA,pz); a.prone=false; a.crouch=false;
b.pos.set(px-4,gyB,pz); b.prone=false; b.crouch=false;
tryPair(a,b);
if(!sh){ a.pos.set(px+4,gyA+2,pz); b.pos.set(px-4,gyB+2,pz); tryPair(a,b); }
}
if(!sh) return {err:'no-los-pair'};
let hits=0;
tg.damage=function(){hits++;};   // 计数基准免误杀 + 命中计数 (2700 发全部走命中分支, 血特效/账户照跑)
for(let it=0;it<90;it++){
for(let k=0;k<30;k++){ fireBullet(sh,o,dir,def,null); if(typeof gunEvents!=='undefined') gunEvents.length=0; }
}
return {ok:true,d:bd,hits:hits,tr:tracers.length};
})()`);
};
let vNew=0,vOld=0,detNew=null,detOld=null;
{
for(const k in alloc) alloc[k]=0;
detNew=bench(ctx);
vNew=alloc.Vector3||0;
}
if(ctxOld){
for(const k in alloc) alloc[k]=0;
detOld=bench(ctxOld);
vOld=alloc.Vector3||0;
}
console.log('  [T-C] 90 帧 × 30 发 fireBullet 驱动: 修后 Vector3='+vNew+' (hits='+(detNew&&detNew.hits)+') / 回退对照 Vector3='+vOld+' (hits='+(detOld&&detOld.hits)+', tracers='+(detOld&&detOld.tr)+') (Δ='+(vOld-vNew)+', 靶距='+(detNew&&detNew.d!=null?detNew.d.toFixed(1):'?')+'m)');
ok(detNew&&detNew.ok===true,'T-C 驱动基准就绪 (修后射手/目标就位, hits='+(detNew&&detNew.hits)+')');
if(ctxOld) ok(detOld&&detOld.ok===true&&detOld.hits>=2000,'T-C 阴性对照同样命中驱动 (hits='+(detOld&&detOld.hits)+' — 两侧同几何同命中数, 差值只来自分配)');
ok(vOld>vNew&&((vOld-vNew)>=2000),'T-C Vector3 构造计数下降: '+(vOld-vNew)+' 个/2700 发 ≥2000 (camRight 槽 + 命中点槽, 每发 ≥1 个)');

console.log('── T-A 火焰视觉粒子全局预算门 (10 火源 × 4s loop) ──');
{
G(ctx,`
var __ta={};
const FX=60, FZ=40;
const gy0=heightAt(FX,FZ);
player.pos.set(FX+6,gy0+2,FZ); player.vel.set(0,0,0);   // 玩家/相机贴火场 (dCam<95 视觉门内)
for(let i=0;i<10;i++){
const sx=FX+i*5, sz=FZ;
const ci0=fCellI(sx,sz);
for(let dj=-2;dj<=2;dj++)for(let di=-2;di<=2;di++){
const ci=(Math.floor(ci0/FN)+dj)*FN+(ci0%FN+di);
FUEL[ci]=1.15;
}
addFireSource(sx,sz,heightAt(sx,sz)+0.5,4,999,22,null);
}
var __taV={alive:true,team:1,isPlayer:false,spectator:false,onVehicle:false,onNaval:false,
pos:V3(FX+1,heightAt(FX+1,FZ),FZ),damage(d,a,h){ __ta.dmg=(__ta.dmg||0)+d; __ta.dmgN=(__ta.dmgN||0)+1; },noticeThreat(){}};
combatants.push(__taV); __ta.victim=__taV;
__ta.maxFx=0; __ta.capHits=0; __ta.maxSp=0; __ta.spRef=spawnP;
`);
G(ctx,`__ta.budget=FIRE_FX_BUDGET_STEPS[SETTINGS.fxMaxIdx]||26;`);
const budget=G(ctx,'__ta.budget');
G(ctx,`__spN=0;`);
const frames=240;
let maxFx=0,capHits=0,maxSp=0;
for(let f=0;f<frames;f++){
tickClock();
vm.runInContext('loop()',ctx);
const r=G(ctx,'({fx:_fireFxN,sp:__spN,spf:__spFlash})');
if(r.fx>maxFx) maxFx=r.fx;
if(r.fx>=budget) capHits++;
if(r.sp>maxSp) maxSp=r.sp;
G(ctx,'__spN=0;');
}
const ta=G(ctx,'({dmg:__ta.dmg,dmgN:__ta.dmgN})');
console.log('  [T-A] 预算档='+budget+' / 240 帧内每帧火粒子预算峰值='+maxFx+' / 绷紧帧='+capHits+' / 单帧 spawnP 总数峰值='+maxSp+' (含枪口焰等非火)');
ok(maxFx<=budget,'T-A 每帧火粒子预算峰值 '+maxFx+' ≤ 档位上限 '+budget+' (标准档 26)');
ok(capHits>=1,'T-A 预算确实绷紧 ('+capHits+'/'+frames+' 帧触顶 — 10 火源+蔓延格+树冠火场景)');
ok(ta.dmgN>=4&&ta.dmg>0,'T-A 火种伤害账照常走: '+ta.dmgN+' 跳共 '+ta.dmg.toFixed(1)+' 伤害 (预算门只省视觉粒子)');
G(ctx,`combatants.splice(combatants.indexOf(__ta.victim),1); __ta.victim=null;
// 灭火清场 (T-B 的 heightAt 归因需要安静世界): 火格/火源/受热/燃烧树全清
FIRE_SOURCES.length=0; FIRE_ACTIVE.length=0; HEATED.length=0; FBURN.fill(0); FHEAT.fill(0); FEXPIRE.fill(0);
BURNING_TREES.length=0;`);
}

console.log('── T-B 布娃娃静止结算门 (真实击杀链 ×8 → 冻结/帽/解冻) ──');
{
G(ctx,`var __tb={};`);   // 顶层 var: 后续单行 G 片段要读 (IIFE 内 var 是函数域)
const r=G(ctx,`(()=>{
while(RAG.list.length) removeRagdoll(RAG.list[0]);   // 预热交火的旧尸体 settle 进度不可控 (偶发拖过 400 帧窗), 先清场 → 冻结归因只覆盖本步新杀的 8 具
const alive=soldiers.filter(s=>s.alive&&!s.spectator);
__tb.killed=Math.min(8,alive.length);
for(let i=0;i<__tb.killed;i++) alive[i].damage(999,player,false);
// 真实击杀链完成 → 清场停战 (不再有新死亡/新布娃娃, 保证归因干净)
soldiers.length=0; tanks.length=0; trucks.length=0; planes.length=0;
shells.length=0; nades.length=0;
__tb.total=RAG.list.length;
__tb.act0=RAG.list.filter(r=>!r.frozen).length;
return {killed:__tb.killed,total:__tb.total,act0:__tb.act0};
})()`);
ok(r.killed>=6,'T-B 真实击杀链 (damage→die→spawnRagdoll) 杀了 '+r.killed+' 个兵 (≥6)');
ok(r.total>=6,'T-B RAG.list 入账 '+r.total+' 具 (≥6)');
ok(r.act0<=6,'T-B 活跃布娃娃数量帽生效: 杀 8 兵当场活跃 '+r.act0+' ≤ RAG_ACTIVE_MAX(6) (超出最旧的立即冻结)');
// 全部落定冻结
let allFrozen=false;
for(let f=0;f<400;f++){
tickClock(); vm.runInContext('loop()',ctx);
if(G(ctx,'RAG.list.length>0&&RAG.list.every(r=>r.frozen)')){ allFrozen=true; break; }
}
ok(allFrozen,'T-B 400 帧内全部布娃娃进入静止冻结 (位置增量 <2.5mm 持续 2.5s)');
if(allFrozen){
// 冻结窗: heightAt 计数 + 位姿定格
G(ctx,`__tb.h0=__hN; __tb.r0=RAG.list[RAG.list.length-1];
__tb.snap=__tb.r0.parts.map(p=>({x:p.body.position.x,y:p.body.position.y,z:p.body.position.z}));`);
for(let f=0;f<90;f++){ tickClock(); vm.runInContext('loop()',ctx); }
const fr=G(ctx,`({
hD:__hN-__tb.h0,
maxMove:Math.max.apply(null,__tb.r0.parts.map((p,i)=>Math.hypot(p.body.position.x-__tb.snap[i].x,p.body.position.y-__tb.snap[i].y,p.body.position.z-__tb.snap[i].z))),
n:RAG.list.length
})`);
ok(fr.maxMove<1e-6,'T-B 冻结具部件位姿定格 (90 帧最大漂移 '+fr.maxMove.toExponential(2)+'m < 1e-6 — 旧版持续微颤)');
// 解冻窗: 外部冲量 (模拟爆炸/车辆再触碰写 velocity, 水平推 = 真实爆炸推/碾压方向) → 解冻回动
// (竖直向下 poke 会沉进地面又被 pen 修正推回原位, 终点位移≈0 — 水平推让尸体滑到新落点)
G(ctx,`__tb.h1=__hN; __tb.r0.parts[0].body.velocity.x=7; __tb.r0.parts[0].body.velocity.z=2; __tb.r0.parts[0].body.velocity.y=-1;`);   // 不显式 thaw: 只写 velocity, 验 B④ 预扫 —— 冻结具任一部件被外部写速度 (爆炸推/车辆碰) 即自动解冻
let stillUnfrozen=false;
for(let f=0;f<90;f++){
tickClock(); vm.runInContext('loop()',ctx);
if(f===30) stillUnfrozen=!G(ctx,'__tb.r0.frozen');
}
const ac=G(ctx,`({
hD:__hN-__tb.h1,
move:Math.hypot(__tb.r0.parts[0].body.position.x-__tb.snap[0].x,__tb.r0.parts[0].body.position.y-__tb.snap[0].y,__tb.r0.parts[0].body.position.z-__tb.snap[0].z)
})`);
console.log('  [T-B] 90 帧窗 heightAt: 冻结=' + fr.hD + ' / 解冻=' + ac.hD + ' (Δ=' + (ac.hD-fr.hD) + ', 每帧 Δ=' + ((ac.hD-fr.hD)/90).toFixed(1) + ')');
ok(stillUnfrozen===true,'T-B 外部冲量解冻生效 (poke velocity 后 30 帧仍处活跃结算)');
ok((ac.hD-fr.hD)>=1350,'T-B heightAt 计数停涨: 解冻窗比冻结窗多 '+(ac.hD-fr.hD)+' 次 ≥1350 (每帧 ~35 = 7 部件×5 次 heightAt 全停)');
ok(ac.move>0.05,'T-B 解冻后位置重新变化 (部件位移 '+ac.move.toFixed(3)+'m > 0.05 — 再触碰回动)');
// 再冻结
let refrozen=false;
for(let f=0;f<400;f++){
tickClock(); vm.runInContext('loop()',ctx);
if(G(ctx,'__tb.r0.frozen===true')){ refrozen=true; break; }
}
ok(refrozen,'T-B 解冻再落定后重新冻结 (冻结门可重复进出)');
}
}

console.log('── T-D 实例矩阵局部上传 (源码断言 + 结构判据) ──');
{
const f04=read('js/04b-fire.js'), f08=read('js/08-effects.js'), lib=read('lib/three.min.js');
ok(f04.includes('function fireImDirty(')&&f04.includes('a.updateRange.offset=a._upMin*16'),'T-D 04b 树批局部上传单源 fireImDirty 在场 (updateRange offset/count 标脏)');
ok(!f04.includes('instanceMatrix.needsUpdate=true'),'T-D 04b 全量 instanceMatrix.needsUpdate 全库绝迹 (倒伏/烧尽/沉入 5 处全改局部)');
ok(f04.includes('fireImDirty(imT.instanceMatrix,tr.wi,1)')&&f04.includes('if(!tr.charred) fireImDirty(imL.instanceMatrix,tr.wi*19,19)'),'T-D 乔木/柳实例批写后按脏段标脏 (charred 跳过叶面不虚标)');
ok(f08.includes('function sinkImDirty(')&&f08.includes('sinkImDirty(job.inst.im.instanceMatrix,job._upMin,job._upN)'),'T-D 08 沉入任务局部上传 sinkImDirty 接线 (queueSink 登记脏段)');
ok(f08.includes('im.instanceMatrix.updateRange.count=-1'),'T-D endSinkJob 零缩放收尾复位全量上传 (局部区间不吃收尾写)');
ok(lib.includes('s.subarray(a.offset,a.offset+a.count)),a.count=-1)'),'T-D vendor three r152 实证: 部分上传后 updateRange.count 自动复位 -1 ⇒ 23b 世界还原/建图全量写回不残留旧区间 (正确性判据)');
ok(f08.includes('new THREE.Sprite(new THREE.SpriteMaterial'),'T-D 粒子=逐个 THREE.Sprite (无共享 BufferAttribute ⇒ 粒子 Points 的 updateRange 局部化**不适用**, 结构判据留档)');
}

console.log('── T-E/A 源码结构断言 (预算门 + 交错钟 + 槽位纪律) ──');
{
const f04=read('js/04b-fire.js'), f13=read('js/13-combat.js'), f10=read('js/10-viewmodel.js'), f12=read('js/12-ragdolls.js');
ok(f04.includes('const FIRE_FX_BUDGET_STEPS=[26,14,44]')&&f04.includes('function fireFxOK()'),'T-A 预算门单源 (档位表 26/14/44 随 fxMaxIdx)');
ok((f04.match(/fireFxOK\(\)/g)||[]).length>=8,'T-A 预算门接线 ≥8 站点 (火源/火格/树冠/生物DOT/火伤闪光), 伤害账零接线');
ok(f04.includes('_burnFrame^=1')&&f04.includes('&&window.BURN_NO_STAGGER)&&((si+_burnFrame)&1)===0) continue;')&&f04.includes('s._burnAcc=(s._burnAcc||0)+dt;'),'T-E 交错钟: 下标奇偶交错 + _burnAcc dt 累积 (无 setTimeout)');
ok(f04.includes('if(!creatureIgnitable(s)||!s.burnTimer||s.burnTimer<=0) continue;'),'T-E 判据串逐位保留 (verify-fixbatch-20261104b 锚不破)');
ok(f13.includes('const _fbHit=V3()')&&f13.includes('const hitP=_fbHit.set(')&&f13.includes('const rv=camRight(_fbR)'),'T-C fireBullet 命中点/水花点/camRight 槽位化');
ok(f13.includes('const dir=_exDir.set(')&&f13.includes('raycastWorld(_exOrg.set('),'T-C explodeAt/splashDamage 逐受害者遮挡射线双槽 (方向/起点分离不互踩)');
ok(f13.includes("spawnTracer(origin.clone().addScaledVector(dir,1.2),dir,Math.max(1,endD-1.5),shooter)"),'T-C 曳光出膛点保留 origin.clone() (verify-timestopfix T8 字面契约锚, 明示不槽位化)');
ok(f10.includes('const _ovL={pos:V3(0,0,0),rot:V3(0,0,0)}')&&f10.includes('const _vmHandCache={}')&&f10.includes('_vmKf'),'T-C viewmodel override/握位缓存/关键帧槽位化');
ok(f12.includes('function freezeRagdoll(r)')&&f12.includes('function thawRagdoll(r)')&&f12.includes('const RAG_ACTIVE_MAX=6;'),'T-B 冻结/解冻/活跃帽单源在场');
ok(f04.includes('window.FIRE_FX_UNLIMITED')&&f04.includes('window.BURN_NO_STAGGER')&&f12.includes('window.RAG_NO_FREEZE')&&f04.includes('window.IM_FULL_UPLOAD')&&read('js/08-effects.js').includes('window.IM_FULL_UPLOAD'),'回退旗在场: FIRE_FX_UNLIMITED(A)/BURN_NO_STAGGER(E)/RAG_NO_FREEZE(B)/IM_FULL_UPLOAD(D, 双文件) 一键回旧口径');
ok(f12.includes('b.position.x=s2.x; b.position.y=s2.y; b.position.z=s2.z;'),'T-B 冻结=位姿快照回贴 (不依赖 cannon sleep 语义)');
}

console.log('\n【正向】 ✓ '+PASS+' / ✗ '+FAILS+'  (恒 0 退出)');
process.exit(0);
