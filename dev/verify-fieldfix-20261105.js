// ─────────────────────────────────────────────
// dev/verify-fieldfix-20261105.js —— 实机反馈三虫批 沙箱 (2026-11-05, 不进 index.html)
// 用法: node dev/verify-fieldfix-20261105.js [--neg]
//   --neg = 阴性对照: 装载前把本批核心改动按文本还原成旧写法, 同一批判据必须报红。
// 原理: 复用 dev/_bootstub.js 桩 + 受控时钟直驱 24-main loop(), 诺曼底 夜/晴 各 boot 一遍全部真实脚本。
// 断言 (T1~T3 + T5 静态):
//   T1 第三人称手电光锥锚定 (用户实报"开手电切第三人称, 光锥漂移到别处"): 病根 = 士兵 truncateConeMesh
//      的 fz 实参误传 baseL*0.5 (那是满长静止位, 不是灯口前向偏移) ⇒ 锥体几何以中点居中时顶点被抬到
//      灯口前 effL/2, 满长整体前漂 11m。判据 = 运行期不变量: 锥可见时 |position.z - scale.x*baseL/2|
//      ≈ 0 (fz=0 语义), 对任何遮挡档位都成立; 旧写法恒差 baseL/2=11 必红。玩家 avatar (20-player) 与
//      Bot (14-bots) 两处调用方各测一份。
//   T2 巡飞弹TV视角本体 (用户实报"巡飞弹视角看不到玩家本体"): 病根 = updateCamera 顶部每帧
//      playerAvatarHide() 而 updatePlayerAvatar 只在步行第三人称分支调用 ⇒ TV制导提前 return 后本体
//      恒隐。判据 = fireLoiter 后 avatar.root.visible===true 且钉在发射位、TV 相机仍在弹体上。
//   T3 圆柱顶端站立 (用户实报"很多圆柱体的顶端无法站立, 一上去就被挤开"): 病根 = _cmCylCb 只有纵重叠
//      门没有 _cmBoxCb 的 0.56 跨步豁免 + standHeight 只查盒不查柱 ⇒ 站上顶后脚下沉 0.2m 即被横推挤飞。
//      判据 = 跨步档不横推 / standHeight 圆柱顶面支撑 / 圆外不支撑 / 高柱仍是墙 (豁免不误放行)。
//   T5 静态接线: 单行源码钉 (不写死行号) + 载入清单与 index.html 实载同序对账 + 版本戳。
// 阴性补丁 N1~N5 → 预期红: N1=T1 玩家不变量+T5钉 / N2=T1 Bot不变量 / N3=T2 本体在场+钉位 /
//   N4=T3 跨步豁免 / N5=T3 standHeight 支撑 (T3-A1 现状对照与 T3-A5 高柱对照须保持绿 = 对照组)。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const NEG=process.argv.includes('--neg');
const OK=[],BAD=[];
function assert(name,cond,detail){ (cond?OK:BAD).push(name); console.log(`  ${cond?'✓':'✗'} ${name}${detail?'  '+detail:''}`); }
function section(t){ console.log('\n══ '+t+' ══'); }
const SRC=f=>{ const p=PATCH_MAP[f]; return p!==undefined?p:fs.readFileSync(path.join(root,f),'utf8'); };

// ── 阴性对照 (锚点 = 修后原文; 找不到就抛错) ──
const PATCHES=[
 // N1 玩家 avatar 手电锥 fz 退回 baseL*0.5 ⇒ 光锥前漂 11m (本批病根复现)
 ['js/20-player.js',
  'truncateConeMesh(av.flGrp.flCone,av.flGrp.baseL||14,occD,0);',
  'truncateConeMesh(av.flGrp.flCone,av.flGrp.baseL||14,occD,(av.flGrp.baseL||14)*0.5);'],
 // N2 Bot 手电锥 fz 同病同退
 ['js/14-bots.js',
  'truncateConeMesh(m.flGrp.flCone,m.flGrp.baseL||14,occD,0);',
  'truncateConeMesh(m.flGrp.flCone,m.flGrp.baseL||14,occD,(m.flGrp.baseL||14)*0.5);'],
 // N3 巡飞弹视角本体显示退回 ⇒ TV制导期间本体恒隐 (单行锚: 仓库行尾混用, 多行锚必失配)
 ['js/20-player.js',
  '\t\tupdatePlayerAvatar(dt);',
  ''],
 // N4 圆柱横推退回 (去掉跨步豁免) ⇒ 站顶被挤飞复现
 ['js/04-collision.js',
  'if(c.y1-pos.y<=0.56) return;',
  ''],
 // N5 standHeight 圆柱支撑退回 ⇒ 柱顶无脚下高度
 ['js/04-collision.js',
  'eachCylNear(x-0.07,z-0.07,x+0.07,z+0.07,_shCylCb);',
  ''],
];
const PATCH_MAP={};
if(NEG) for(const [f,from,to] of PATCHES){
 const s=PATCH_MAP[f]!==undefined?PATCH_MAP[f]:fs.readFileSync(path.join(root,f),'utf8');
 if(!s.includes(from)) throw new Error('NEG 锚失配 ('+f+'): '+from.slice(0,60));
 PATCH_MAP[f]=s.split(from).join(to);
}

// ── 桩补丁 (与 verify-nightgear-20261105 同源) ──
const {sandbox,document,window,byId}=require('./_bootstub.js');
const _Color=sandbox.THREE.Color;
const V3c=sandbox.THREE.Vector3;
if(!V3c.prototype.negate) V3c.prototype.negate=function(){ this.x=-this.x; this.y=-this.y; this.z=-this.z; return this; };
if(!V3c.prototype.lengthSq) V3c.prototype.lengthSq=function(){ return this.x*this.x+this.y*this.y+this.z*this.z; };
if(!_Color.prototype.getHex){ _Color.prototype.getHex=function(){ const c=typeof this.c==='number'?this.c:0; return c; }; }
if(!_Color.prototype.lerp){
const _p=h=>{ h=typeof h==='number'?h:parseInt(String(h).replace('#',''),16)||0; return [(h>>16)&255,(h>>8)&255,h&255]; };
_Color.prototype.lerp=function(target,a){
const c0=_p(this.c), c1=_p(target&&target.c!==undefined?target.c:target);
const mix=c0.map((v,i)=>Math.round(v+(c1[i]-v)*a));
this.c=(mix[0]<<16)|(mix[1]<<8)|mix[2];
return this;
};
}
if(!sandbox.THREE.SpotLight){
sandbox.THREE.SpotLight=class extends sandbox.THREE.Object3D{
constructor(c,i,d,a,p,dec){ super(); this.color=c; this.intensity=i||0; this.distance=d||0; this.angle=a||0; this.penumbra=p||0; this.decay=dec||1; this.castShadow=false; this.visible=true;
this.target=new sandbox.THREE.Object3D(); this.target.updateMatrixWorld=()=>{}; }
};
}
sandbox.THREE.PointLight=class extends sandbox.THREE.Object3D{
constructor(c,i,d,dec){ super(); this.color=c; this.intensity=i||0; this.distance=d||0; this.decay=dec||1; this.castShadow=false; }
};
for(const _mk of ['MeshBasicMaterial','MeshLambertMaterial','MeshPhongMaterial','MeshStandardMaterial','SpriteMaterial','Material']){
const M=sandbox.THREE[_mk];
if(M&&M.prototype&&!M.prototype.clone) M.prototype.clone=function(){ const c=Object.create(Object.getPrototypeOf(this)); Object.assign(c,this); return c; };
}
const O3=sandbox.THREE.Object3D;
if(O3&&O3.prototype&&!O3.prototype.clear) O3.prototype.clear=function(){ if(this.children) this.children.length=0; return this; };
const Q4=sandbox.THREE.Quaternion;
if(Q4&&Q4.prototype){
if(!Q4.prototype.copy) Q4.prototype.copy=function(q){ this.x=q.x; this.y=q.y; this.z=q.z; this.w=(q.w!==undefined)?q.w:1; return this; };
if(!Q4.prototype.setFromEuler) Q4.prototype.setFromEuler=function(){ return this; };
}
if(!sandbox.THREE.Line) sandbox.THREE.Line=class extends O3{constructor(g,m){super();this.geometry=g||{};this.material=m||{};this.isLine=true;}};
const BA=sandbox.THREE.BufferAttribute;
if(BA&&BA.prototype&&!BA.prototype.setXYZ) BA.prototype.setXYZ=function(i,x,y,z){ if(this.array){ this.array[i*this.itemSize]=x; this.array[i*this.itemSize+1]=y; this.array[i*this.itemSize+2]=z; } return this; };
const AP=()=>({value:0,setValueAtTime(){},setTargetAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}});
const ACStub=class{
createOscillator(){return {frequency:AP(),detune:AP(),type:'',start(){},stop(){},connect(){},onended:null};}
createGain(){return {gain:AP(),connect(){},disconnect(){}};}
createBuffer(){return {getChannelData:()=>new Float32Array(16),duration:1,numberOfChannels:1};}
createBufferSource(){return {buffer:null,loop:false,playbackRate:AP(),start(){},stop(){},connect(){},onended:null};}
createBiquadFilter(){return {type:'',frequency:AP(),detune:AP(),Q:AP(),connect(){}};}
createDynamicsCompressor(){return {threshold:AP(),ratio:AP(),attack:AP(),release:AP(),connect(){}};}
createStereoPanner(){return {pan:AP(),connect(){}};}
resume(){return Promise.resolve();} get state(){return 'running';} get destination(){return {};}
get currentTime(){return 0;} get sampleRate(){return 44100;}
};
sandbox.AudioContext=ACStub; sandbox.window.AudioContext=ACStub; sandbox.window.webkitAudioContext=ACStub;
sandbox.confirm=()=>true;
const handlers={};
sandbox.addEventListener=(t,f)=>{ (handlers[t]=handlers[t]||[]).push(f); };

// ── 全链文件表 (与 index.html 实载同序; T5 动态对账, 不写死数字) ──
const FILES=['js/00-config.js','js/00b-i18n.js','js/00c-procgen.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/19b-gamepad.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/22a-menuart.js','js/22b-speclayer.js','js/23-deploy.js','js/23b-worldrestore.js','js/25-zombies.js','js/26-commander.js','js/27-achievements.js','js/24-main.js'];
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
function load(ctx,file){ vm.runInContext(SRC(file),ctx,{filename:file}); }

function boot(store){
for(const k in byId) delete byId[k];
for(const k in handlers) delete handlers[k];
const patchStyle=(el)=>{ if(el&&el.style&&!el.style.setProperty) el.style.setProperty=(k,v)=>{ el.style[k]=v; }; return el; };
const docH=new Proxy(document,{get(t,k){
if(k==='createElement'||k==='createElementNS') return (...a)=>patchStyle(t[k](...a));
if(k==='getElementById') return (id)=>patchStyle(t.getElementById(id));
return t[k];
}});
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=docH; ctx.window=window;
ctx.localStorage={_s:Object.assign({sf_campaign:'0',sf_exp:'1'},store||{}),getItem(k){return (k in this._s)?this._s[k]:null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
ctx.CANNON=(window&&window.CANNON)||{Body:class{constructor(o){Object.assign(this,o||{});}},World:class{add(){}},Box:class{},Sphere:class{},Vec3:sandbox.THREE.Vector3,Material:class{},ContactMaterial:class{}};
ctx.__T=1000;
ctx.performance={now:()=>ctx.__T};
for(const f of FILES) load(ctx,f);
ctx.__key=(code)=>{ for(const f of (handlers.keydown||[])) f({code,repeat:false,preventDefault(){},stopPropagation(){}}); };
try{ vm.runInContext(`document.getElementById('startBtn').onclick();`,ctx); }catch(e){ console.log('  开局异常: '+e); }
vm.runInContext(`var __step=(n)=>{ for(let i=0;i<n;i++){ __T+=16.7; loop(); } };
var __coneOK=(c)=>{ const bl=(c.parent&&c.parent.baseL)?c.parent.baseL:22; return Math.abs(c.position.z-c.scale.x*bl*0.5)<1e-3; };`,ctx);
return ctx;
}
const VM=(ctx,expr)=>vm.runInContext(expr,ctx);

// 部署样板: spectator=true (调试观战, 夜图自动持手电) / 缺省普通兵
const SPEC_DEPLOY=`(()=>{try{
player.team=0; player.cls=3; player.spectator=true; player.specUsed=true; selectedSpawn=-1; deployPlayer();
pointerLocked=true;
return {alive:player.alive,spec:player.spectator,night:NIGHT_MODE,fl:player.flashlight};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`;
const PLAIN_DEPLOY=`(()=>{try{
player.team=0; player.cls=3; player.spectator=false; player.specUsed=false; selectedSpawn=-1; deployPlayer();
pointerLocked=true;
return {alive:player.alive,spec:player.spectator};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`;

// ═════ T1 第三人称手电光锥锚定 ═════
// 不变量 (fz=0 语义, 对任意遮挡档位成立): 锥可见时 |position.z - scale.x*baseL/2| < 1e-3 (ctx 侧 __coneOK)。
// 旧写法 (fz=baseL/2) 恒差 baseL/2=11 —— 满长时 z=22 vs 修后 11, 一眼可辨。
function t1(){
section('T1 第三人称手电光锥: 玩家 avatar + Bot 两处调用方, 不变量 |z-sx·baseL/2|≈0 (fz=0)');
const ctx=boot({sf_daynight:'night'});
const dep=VM(ctx,SPEC_DEPLOY);
assert('T1 前置: 夜图观战部署 (alive+自动持手电)',typeof dep==='object'&&dep.alive===true&&dep.fl===true,JSON.stringify(dep));
if(typeof dep!=='object') return;
VM(ctx,`var __px0=player.pos.x, __pz0=player.pos.z;`);
// ── 玩家 avatar 侧: 切第三人称, 换位到"锥可见"的采样点 (脚部射线不被近距遮挡) ──
VM(ctx,`player.thirdPerson=true; __step(3)`);
const avOk=VM(ctx,`(()=>{try{
const av=playerAvatar;
if(!av||!av.flGrp) return {err:'no avatar/flGrp'};
return {vis:av.flGrp.visible, cone:!!av.flGrp.flCone, baseL:av.flGrp.baseL||0};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
assert('T1 ★ 玩家: 第三人称灯组在场 (flGrp.visible)',avOk&&avOk.vis===true&&avOk.cone===true,JSON.stringify(avOk));
let invBad=0,visN=0;
for(let k=1;k<=10&&!visN;k++){                       // 环形换位采样: 找到锥可见的点位即停
const r=VM(ctx,`(function(){ try{
const a=${k}*0.9, px=__px0+Math.cos(a)*${6+k}, pz=__pz0+Math.sin(a)*${6+k};
player.pos.x=px; player.pos.z=pz; player.pos.y=heightAt(px,pz);
__step(2);
const c=playerAvatar&&playerAvatar.flGrp&&playerAvatar.flGrp.flCone;
if(!c) return {err:'nocone'};
if(!c.visible) return {vis:false};
return {vis:true, ok:__coneOK(c), z:+c.position.z.toFixed(4), sx:+c.scale.x.toFixed(4)};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof r==='object'&&r.vis===true){ visN++; if(r.ok===false) invBad++; }
}
assert('T1 ★ 玩家: 光锥不变量成立 (可见帧全过, 采样≥1)',visN>=1&&invBad===0,'可见帧='+visN+' 违例='+invBad);
// ── Bot 侧 (胸高射线, 确定性更强): 实例级钉住开灯 AI (被测对象是 updateMesh 的锥截断, 不是 AI 开关)。
// 逐帧采样: 战场是活的 (交战/阵亡会写 flashlight=false), 每步回满血+换位+重开灯, 取任一可见帧判不变量;
// 可见帧判据与旧写法的分辨力: 旧写法 z 恒多 baseL/2=11 (满长 22 vs 11) —— 部分帧可见即红。
const botR=VM(ctx,`(function(){ try{
const b=soldiers.find(s=>!s.isPlayer&&s.alive&&s.mesh&&s.mesh.flGrp);
if(!b) return {err:'no bot with flGrp'};
b.updateFlashlightAI=function(){ this.flashlight=true; };   // 实例级: AI 开关不在本批改动面
b.crouch=false; b.prone=false; b.inCover=false;
let found=false, spotX=0, spotZ=0;
for(let i=0;i<24&&!found;i++){
const a=i*0.7, px=__px0+Math.cos(a)*(8+i), pz=__pz0+Math.sin(a)*(8+i);
b.pos.x=px; b.pos.z=pz; b.pos.y=heightAt(px,pz);
const eye=_pvEye.set(px,b.pos.y+1.28,pz), dir=_pvD.set(Math.sin(b.yaw),0,Math.cos(b.yaw));
const hit=raycastWorld(eye,dir,b.mesh.flGrp.baseL||14);
if(!hit||hit.dist>=(b.mesh.flGrp.baseL||14)){ found=true; spotX=px; spotZ=pz; }
}
let visN=0, bad=0, lastHp=0;
for(let i=0;i<12;i++){
b.hp=100; b.flashlight=true;
b.pos.x=spotX; b.pos.z=spotZ; b.pos.y=heightAt(spotX,spotZ);
__step(1);
lastHp=b.hp;
const c=b.mesh.flGrp&&b.mesh.flGrp.flCone;
if(b.alive&&b.mesh.flGrp.visible&&c&&c.visible){ visN++; if(!__coneOK(c)) bad++; }
}
return {found, alive:b.alive, hp:lastHp, fl:b.flashlight, visN, bad, baseL:b.mesh.flGrp.baseL||0};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
assert('T1 前置: Bot 样本就位 (存活+净空点)',botR&&typeof botR==='object'&&botR.alive===true&&botR.found===true,JSON.stringify(botR));
assert('T1 ★ Bot: 光锥不变量成立 (可见帧≥1 且无违例)',botR&&botR.visN>=1&&botR.bad===0,JSON.stringify(botR));
}

// ═════ T2 巡飞弹TV视角本体 ═════
function t2(){
section('T2 巡飞弹TV制导视角: 本体照常在场 (updateCamera loiter 分支补 updatePlayerAvatar)');
const ctx=boot({});                          // 晴天白天即可 (巡飞弹与昼夜无关)
const dep=VM(ctx,PLAIN_DEPLOY);
assert('T2 前置: 普通部署 cls3 (实验模式=巡飞弹兵)',typeof dep==='object'&&dep.alive===true&&dep.spec===false,JSON.stringify(dep));
if(typeof dep!=='object') return;
const r=VM(ctx,`(function(){ try{
const d=fireLoiter(player,V3(player.pos.x,player.pos.y+1.4,player.pos.z),V3(0,0,-1));
if(!d||!player.loiter) return {err:'fireLoiter 未建立 loiter'};
__step(5);
const av=playerAvatar;
const lp=player.loiter.pos;
const camD=Math.hypot(camera.position.x-lp.x,camera.position.y-lp.y,camera.position.z-lp.z);
return {loiter:!!player.loiter, avVis:av?av.root.visible:null,
        dx:av?+Math.abs(av.root.position.x-player.pos.x).toFixed(4):null,
        dz:av?+Math.abs(av.root.position.z-player.pos.z).toFixed(4):null,
        camD:+camD.toFixed(3)};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
assert('T2 前置: 巡飞弹在导 (fireLoiter)',r&&typeof r==='object'&&r.loiter===true,JSON.stringify(r));
if(!r||typeof r!=='object') return;
assert('T2 ★ TV制导中: 玩家本体在场 (avatar.root.visible)',r.avVis===true,'avVis='+r.avVis);
assert('T2 ★ 本体钉在发射位 (avatar 写位跟手)',r.dx!==null&&r.dx<0.05&&r.dz<0.05,'dx='+r.dx+' dz='+r.dz);
assert('T2 ★ TV 相机仍在弹体上 (不回肉体视角)',r.camD!==null&&r.camD<2.0,'camD='+r.camD);
}

// ═════ T3 圆柱顶端站立 ═════
function t3(){
section('T3 圆柱顶端: 跨步豁免 (不横推) + standHeight 顶面支撑 + 高柱对照');
const ctx=boot({});
VM(ctx,`window.RGRID_OFF=true;`);            // 直查全表, 免网格桩 (等价路径, 04-collision 官方回退开关)
const spot=VM(ctx,`(function(){ try{
// 搜平地净空点: 3m 内无盒/柱 + 2m 内地形平缓
for(let i=0;i<80;i++){
const a=i*0.83, d=20+i*3.1, x=Math.cos(a)*d, z=Math.sin(a)*d;
let blocked=false;
for(const b of BOXES){ if(b.dead) continue;
 if(x>b.minX-3&&x<b.maxX+3&&z>b.minZ-3&&z<b.maxZ+3){ blocked=true; break; } }
if(!blocked) for(const c of CYLS){ const dx=x-c.x,dz=z-c.z; if(dx*dx+dz*dz<9){ blocked=true; break; } }
if(blocked) continue;
const g0=heightAt(x,z), g1=heightAt(x+2,z), g2=heightAt(x,z+2);
if(Math.abs(g0-g1)>0.35||Math.abs(g0-g2)>0.35) continue;
return {x,z,g:g0};
}
return {err:'no clear spot'};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
assert('T3 前置: 净空平地点',spot&&typeof spot==='object'&&!spot.err,JSON.stringify(spot));
if(!spot||spot.err) return;
VM(ctx,`var __cx=${spot.x}, __cz=${spot.z}, __g=${spot.g};
CYLS.push({x:__cx,z:__cz,r:1.2,y0:__g,y1:__g+1.4});   // 草垛档 (05b:912 同档: r1.15/h1.4)
CYLS.push({x:__cx+14,z:__cz,r:0.8,y0:heightAt(__cx+14,__cz),y1:heightAt(__cx+14,__cz)+9}); // 高筒对照`);
const A1=VM(ctx,`(function(){ try{
const p=V3(__cx+0.9,__g,__cz);                // 顶-脚=1.4 > 0.56 跨步档 ⇒ 柱面仍是墙 (对照)
collideMove(p,0.42);
const d=Math.hypot(p.x-__cx,p.z-__cz);
return {pushed:d>1.2, d:+d.toFixed(3)};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
assert('T3 对照: 跨步档外的柱面照常横推 (未误放行)',A1&&A1.pushed===true,JSON.stringify(A1));
const A2=VM(ctx,`(function(){ try{
const p=V3(__cx+0.9,__g+1.1,__cz);            // 顶-脚=0.3 ≤ 0.56 ⇒ 跨步档不横推 ★
const x0=p.x,z0=p.z;
collideMove(p,0.42);
return {moved:Math.abs(p.x-x0)>1e-6||Math.abs(p.z-z0)>1e-6};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
assert('T3 ★ 跨步档内不横推 (旧版在此被挤飞)',A2&&A2.moved===false,JSON.stringify(A2));
const A3=VM(ctx,`(function(){ try{
const h=standHeight(__cx,__cz,__g+1.1+0.6);   // 采样在圆心, 顶面够得着 ⇒ 脚下=顶面 ★
return {h:+h.toFixed(4), want:+(__g+1.4).toFixed(4)};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
assert('T3 ★ standHeight 圆柱顶面支撑 (站得住)',A3&&Math.abs(A3.h-A3.want)<1e-3,JSON.stringify(A3));
const A4=VM(ctx,`(function(){ try{
const h=standHeight(__cx+1.6,__cz,__g+1.7);   // 采样出圈 (r+0.05=1.25 < 1.6) ⇒ 不支撑 (脚下=该点地形)
const t=heightAt(__cx+1.6,__cz);
return {h:+h.toFixed(4), terrain:+t.toFixed(4)};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
assert('T3 圆外采样不支撑 (走出缘自然掉落)',A4&&Math.abs(A4.h-A4.terrain)<0.01,JSON.stringify(A4));
const A5=VM(ctx,`(function(){ try{
const p=V3(__cx+14+0.9,heightAt(__cx+14,__cz),__cz);   // 高筒顶-脚=9m ⇒ 照常是墙 (豁免不误放行)
collideMove(p,0.42);
const d=Math.hypot(p.x-(__cx+14),p.z-__cz);
return {pushed:d>0.8, d:+d.toFixed(3)};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
assert('T3 对照: 高筒侧面照常横推',A5&&A5.pushed===true,JSON.stringify(A5));
}

// ═════ T5 静态接线 ═════
function t5(){
section('T5 静态接线: 单行源码钉 + 载入清单对账 + 版本戳');
const pins=[
 ['js/20-player.js','玩家手电锥 fz=0 (灯口即 flGrp 原点)','truncateConeMesh(av.flGrp.flCone,av.flGrp.baseL||14,occD,0);'],
 ['js/14-bots.js','Bot 手电锥 fz=0 (同批同修)','truncateConeMesh(m.flGrp.flCone,m.flGrp.baseL||14,occD,0);'],
 ['js/20-player.js','巡飞弹视角本体显示接线','updatePlayerAvatar(dt);'],
 ['js/04-collision.js','圆柱横推跨步豁免 (与 _cmBoxCb 同规)','if(c.y1-pos.y<=0.56) return;'],
 ['js/04-collision.js','standHeight 圆柱支撑回调','function _shCylCb(c){'],
 ['js/04-collision.js','standHeight 圆柱查询接线','eachCylNear(x-0.07,z-0.07,x+0.07,z+0.07,_shCylCb);'],
];
for(const [f,label,needle] of pins) assert('T5 '+f+' :: '+label,SRC(f).includes(needle),SRC(f).includes(needle)?'':'缺锚: '+needle.slice(0,50));
// 巡飞分支接线顺序钉: updateCamera 顶部 playerAvatarHide() 之后、p.chute 分支之前必须是 updatePlayerAvatar(dt)
const src20=SRC('js/20-player.js');
const iCam=src20.indexOf('function updateCamera(dt){');
const iHide=src20.indexOf('playerAvatarHide();',iCam);
const iLoiter=src20.indexOf('if(p.loiter&&p.alive){',iCam);
const iChute=src20.indexOf('if(p.chute){',iLoiter);
assert('T5 顺序钉: loiter 分支内 (hide 之后 / chute 之前) 有 updatePlayerAvatar(dt)',
 iCam>=0&&iHide>=0&&iLoiter>iHide&&iChute>iLoiter&&src20.slice(iLoiter,iChute).includes('updatePlayerAvatar(dt)'));
// 载入清单对账 (动态解析, 不写死数字)
const htmlScripts=(html.match(/<script src="js\/[^"?]*\?v=[^"]*"/g)||[]).map(x=>x.replace(/<script src="/,'').replace(/"$/,'').split('?')[0]);
assert('T5 载入清单 = index.html 实载脚本逐条同序 ('+FILES.length+' 个)',JSON.stringify(htmlScripts)===JSON.stringify(FILES));
// 版本戳
const stamps=[...html.matchAll(/20261122a/g)];
const stampSet=[...new Set(stamps.map(m=>m[0]))];
assert('T5 版本戳 20261122a 全量唯一 (2026-11-10 海战移除批判据跟码)',stamps.length>40&&stampSet.length===1&&html.includes("window.__sfStyleVer='20261122a';"),'×'+stamps.length);
const gf=fs.readFileSync(path.join(root,'dev/_game_files.txt'),'utf8');
assert('T5 dev/_game_files.txt 同步升戳',gf.includes('v=20261122a')&&!gf.includes('20261105a'));
}

t1(); t2(); t3(); t5();
console.log('\n──────────────────────────────────');
console.log((NEG?'[阴性对照] ':'')+'PASS '+OK.length+' / FAIL '+BAD.length);
if(BAD.length){ console.log('红账:\n - '+BAD.join('\n - ')); process.exit(1); }
