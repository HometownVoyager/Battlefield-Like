// ─────────────────────────────────────────────
// dev/verify-loiterview-20261106.js —— 巡飞弹背追三虫批 沙箱 (2026-11-06, 不进 index.html)
// 用法: node dev/verify-loiterview-20261106.js [--neg]
//   --neg = 阴性对照: 装载前把本批核心改动按文本还原成旧写法, 同一批判据必须报红。
// 原理: 复用 dev/_bootstub.js 桩 + 受控时钟直驱 24-main loop(), 诺曼底 夜/晴 各 boot 一遍全部真实脚本。
// 用户三报 (2026-11-05 深夜截图):
//   ① "手电筒打开状态下的背视角下的巡飞弹, 光柱会保持在第一人称的相对位置, 希望把光柱的起点位置改为
//      巡飞弹本身的位置" —— 病根: playerFlashlightTick 不分档全按相机锚 (o=camera.position+偏移,
//      cone.quaternion=camera.quaternion), 而巡飞弹 F 背追档时 thirdPersonOn() 被 !p.loiter 互斥门排除
//      ⇒ tp=false, 光柱照常显示但钉在背追相机前 (机位在弹体后上方 6.8m)。修 = ltBack 档 (正在操控巡飞弹
//      且 loiterView=1) 整链锚弹体: 起点=弹体(+弹鼻前 0.4m), 朝向=弹鼻 (loiterForward); TV 弹头档相机
//      就钉在弹体上, 维持相机锚 (第一人称观感零变化)。
//   ② "现在巡飞弹在其他视角下可见吗? 我希望是可见的" —— 病根: 弹体可见性三处零散写 (fireLoiter 出膛
//      visible=false; 只有 updateCamera 的 loiter 两分支能翻回来), 而那个分支的门是 p.loiter&&p.alive
//      ⇒ 真观战 (alive=false) 自由视角 / 死亡镜头里弹体**永隐**。修 = 可见性收拢单写者 (updateLoiters
//      末尾): 唯一隐藏态 = "镜头真的在弹鼻上" (player.alive && !(player.loiterView||lz), lz=开镜放大
//      强制第一视角, 与 20-player 相机分支同判据), 其余视角一律可见。
//      (F 背追档本来就可见, 用户截图为证; 本修把"其它一切视角"也兜住。)
//   ③ "巡飞弹视角内转向会带着本体一起转向, 需要修复" —— 病根: 13-combat updateLoiters 制导期间
//      player.yaw=d.yaw / player.pitch=... 持续把弹体姿态回写本体 (旧判据"视角与弹体是同一个量"被用户
//      裁定推翻)。修 = 制导中不回写; 2026-11-06 二次裁定 (用户实报"引爆/消失后玩家朝向仍是弹体末向"):
//      退场 (引爆/静默消失/T 弃弹) 也**不写**本体角 —— 本体角自发射起纹丝不动, 退场后停在发射时朝向
//      (11-05 批"退场一次性对齐"撤销)。verify-loiterfix-20260928 L1 判据已跟码修钉 (notFollowed +
//      退场保持发射向 两条新断言; L1 走引爆路, 本探针 T2 走静默消失路, 两退场路径都有判据)。
// 断言:
//   T1 背追档手电锚弹体: 光柱起点=弹体(≤0.6m)且远离相机(>3m) / 真 SpotLight 锚弹体 / 溢光随弹 /
//      TV 档维持相机锚 (≤1.0m, 行为不变钉) / 回 TV 再贴相机。
//   T2 制导转向只掰弹体 (d.yaw/d.pitch 位移>0.02) + 本体角逐位不动 + 退场保持发射时朝向 (本体角不被退场链触碰)。
//   T3 弹体可见性单写者: TV 藏 / F 背追显 / 回 TV 再藏 / alive=false (真观战自由视角·死亡镜头) 显 ★。
//   T5 静态接线: 单行源码钉 + 旧写法绝迹钉 (updateLoiters 无 player.yaw= 写 / updateCamera loiter 分支
//      无 mesh.visible 写) + 载入清单与 index.html 实载同序对账 + 版本戳 20261128e。
// 阴性补丁 (累积应用, 红名↔补丁对认):
//   N1 = T1 背追档三条红 (ltBack 分支退回相机锚)      N2 = T2 退场污染红 (清账行注回对齐写 = 11-06 病灶复现)
//   N3 = T2 本体不随转红 (旧跟随行原样插回)           N4a/N4b = T3 背追显+alive=false 显两条红
//     (fireLoiter 初始 visible=false + updateLoiters 单写者拆除; TV 藏仍绿 = 判据分辨率对照)
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
// --only=N1,N2 可单补丁亲验 (累积应用时 N2 的行为级红会被 N3 掩盖: 跟随行插回后退场前 player.yaw 本来就===d.yaw)
const PATCHES=[
 // N1 背追档锚定退回相机锚 ⇒ 光柱悬回相机前 (本批①病根复现)
 ['N1','js/08-effects.js',
  'if(ltBack){ fwd=_pfF.copy(loiterForward(lt)); eye=lt.pos; }',
  'if(ltBack){ fwd=camForward(_pfF); eye=camera.position; }'],
 // N2 退场对齐写原样注回 (两处同锚: detonate+despawn; 注回的正是 11-06 二次裁定撤销的 11-05 病灶) ⇒ 引爆/消失后本体角被掰到弹体末向
 //   (2026-11-07 定身批: 清账行追加了 _ltSpace 退场吞边沿, 锚跟码修钉 —— 注回串不含吞边沿 = 同时还原本批前状态)
 ['N2','js/13-combat.js',
  'if(player.loiter===d){ player.loiter=null; player._ltSpace=!!keys.Space; }',
  'if(player.loiter===d){ player.loiter=null; player.yaw=d.yaw; player.pitch=clamp(d.pitch,-1.45,1.45); }'],
 // N3 旧"本体跟随"原样插回 ⇒ 制导中转向带着本体一起转 (本批③病根复现)
 ['N3','js/13-combat.js',
  'd.pitch=clamp(d.pitch,-1.2,1.2);                     // 弹体俯仰包线 (与旧版对目标角的上限同档)',
  'd.pitch=clamp(d.pitch,-1.2,1.2);                     // 弹体俯仰包线 (与旧版对目标角的上限同档)\nplayer.yaw=d.yaw; player.pitch=clamp(d.pitch,-1.45,1.45);'],
 // N4a 出膛初始可见性退回硬写 false ⇒ 真观战出膛即隐
 ['N4a','js/13-combat.js',
  'd.mesh.visible=!(shooter.alive&&!player.loiterView);',
  'd.mesh.visible=false;'],
 // N4b 可见性单写者拆除 ⇒ 背追档/alive=false 没人翻回来 (本批②病根复现)
 ['N4b','js/13-combat.js',
  'd.mesh.visible=!(player.alive&&(!player.loiterView||lz));\n',
  ''],
];
const PATCH_MAP={};
if(NEG){
const ONLY=process.argv.find(a=>a.startsWith('--only='));
const tags=ONLY?ONLY.slice(7).split(','):null;
for(const [tag,f,from,to] of PATCHES){
 if(tags&&!tags.includes(tag)) continue;
 const s=PATCH_MAP[f]!==undefined?PATCH_MAP[f]:fs.readFileSync(path.join(root,f),'utf8');
 if(!s.includes(from)) throw new Error('NEG 锚失配 ('+f+'): '+from.slice(0,60));
 PATCH_MAP[f]=s.split(from).join(to);
}
}

// ── 桩补丁 (与 verify-fieldfix-20261105 同源) ──
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
var __d3=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);`,ctx);
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

// ═════ T1 巡飞弹背追档手电锚弹体 ═════
function t1(){
section('T1 巡飞弹背追档手电: 光柱/真灯/溢光锚到弹体本身 (TV 弹头档维持相机锚, 行为不变)');
const ctx=boot({sf_daynight:'night'});
const dep=VM(ctx,SPEC_DEPLOY);
assert('T1 前置: 夜图调试观战部署 (alive+自动持手电)',typeof dep==='object'&&dep.alive===true&&dep.fl===true,JSON.stringify(dep));
if(typeof dep!=='object') return;
const r=VM(ctx,`(function(){ try{
{const B=MAP_SIZE/2-8;                        // 探针围栏③ (须在 fireLoiter **之前**: d.pos=origin.clone() 出膛即定,
 if(Math.abs(player.pos.x)>B) player.pos.x=B*Math.sign(player.pos.x);   //   弹道=本体朝向 (fireLoiter 忽略 dir 参) ⇒ 贴图缘部署+朝外朝向
 if(Math.abs(player.pos.z)>B) player.pos.z=B*Math.sign(player.pos.z);}  //   = OOB 分支 (不受 grace 豁免) 静默清账, 2026-11-06 run 实录 ×2
const d=fireLoiter(player,V3(player.pos.x,player.pos.y+1.4,player.pos.z),V3(0,0,-1));
if(!d||!player.loiter) return {err:'fireLoiter 未建立 loiter'};
const loiterAtFire=!!player.loiter;          // 判据锚: 出膛即采样 (旧版在窗口末尾才采 ⇒ 前置假红)
d.grace=9999; d.life=9999;                    // 探针围栏: 本窗口不测命中/地形/到期 (specweapon 批"走廊清空"同族坑)
__step(4);                                    // TV 弹头档: 相机就钉在弹体上 (相机锚 = 原行为)
const cone=_playerFlCone, fl=_playerFlashlight, spill=_playerFlSpill;
if(!cone||!fl) return {err:'手电链未就绪 (cone/fl 不存在)'};
const tv={coneVis:cone.visible, coneCam:+__d3(cone.position,camera.position).toFixed(3)};
player.loiterView=1; __step(4);               // F 背追档: 整链应锚到弹体本身 ★
const lp={x:d.pos.x,y:d.pos.y,z:d.pos.z};
const back={coneVis:cone.visible,
 coneM:+__d3(cone.position,lp).toFixed(3), coneCam:+__d3(cone.position,camera.position).toFixed(3),
 flM:+__d3(fl.position,lp).toFixed(3), spillM:spill?+__d3(spill.position,lp).toFixed(3):null};
player.loiterView=0; __step(2);               // 回 TV: 再贴相机
const tv2={coneVis:cone.visible, coneCam:+__d3(cone.position,camera.position).toFixed(3)};
return {loiter:loiterAtFire, loiterEnd:!!player.loiter, dDead:d.dead,
 dPos:{x:+d.pos.x.toFixed(1),y:+d.pos.y.toFixed(1),z:+d.pos.z.toFixed(1)},
 aliveEnd:player.alive, mouseEnd:(typeof mouseDown!=='undefined')?!!mouseDown:null, tv,back,tv2};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
assert('T1 前置: 巡飞弹在导 (fireLoiter, 出膛即采样)',r&&typeof r==='object'&&!r.err&&r.loiter===true,JSON.stringify(r));
if(!r||typeof r!=='object'||r.err) return;
assert('T1 TV弹头档: 光柱可见且贴相机 (≤1.0m, 原行为不变钉)',r.tv.coneVis===true&&r.tv.coneCam<=1.0,'coneCam='+r.tv.coneCam);
assert('T1 ★ 背追档: 光柱可见',r.back.coneVis===true,'vis='+r.back.coneVis);
assert('T1 ★ 背追档: 光柱起点=弹体本身 (距弹心≤0.6m)',r.back.coneM<=0.6,'coneM='+r.back.coneM);
assert('T1 ★ 背追档: 光柱不再悬在相机前 (距相机>3m)',r.back.coneCam>3,'coneCam='+r.back.coneCam);
assert('T1 ★ 背追档: 真 SpotLight 锚弹体 (≤0.6m)',r.back.flM<=0.6,'flM='+r.back.flM);
assert('T1 ★ 背追档: 近景溢光随弹 (≤2m)',r.back.spillM!==null&&r.back.spillM<=2,'spillM='+r.back.spillM);
assert('T1 回TV档: 光柱重新贴相机 (≤1.0m)',r.tv2.coneVis===true&&r.tv2.coneCam<=1.0,'coneCam='+r.tv2.coneCam);
}

// ═════ T2 制导中本体不随转 + 退场一次性对齐 ═════
function t2(){
section('T2 制导转向只掰弹体, 本体角纹丝不动; 退场保持发射时朝向');
const ctx=boot({});                          // 晴天白天即可
const dep=VM(ctx,PLAIN_DEPLOY);
assert('T2 前置: 普通部署 cls3 (实验模式=巡飞弹兵)',typeof dep==='object'&&dep.alive===true&&dep.spec===false,JSON.stringify(dep));
if(typeof dep!=='object') return;
const r=VM(ctx,`(function(){ try{
player.pos.set(0,heightAt(0,0)+1.5,0);        // 探针围栏② (须在 fireLoiter **之前**: 弹位=出膛时本体位+弹道=本体朝向随机
const d=fireLoiter(player,V3(player.pos.x,player.pos.y+1.4,player.pos.z),V3(0,0,-1));
if(!d||!player.loiter) return {err:'fireLoiter 未建立 loiter'};
d.grace=9999; d.life=9999;                    // 探针围栏: 同 T1 (窗口内不测命中/到期, 屏蔽布局偶发早起爆)
__step(1);
const y0=player.yaw, p0=player.pitch, dy0=d.yaw, dp0=d.pitch;
player.tvDX=3000; player.tvDY=1500;          // 远超角速度上限: 截断后仍必有位移
__step(2);
const steer={dYaw:+(d.yaw-dy0).toFixed(6), dPitch:+(d.pitch-dp0).toFixed(6),
 bodyYaw:+(player.yaw-y0).toFixed(9), bodyPitch:+(player.pitch-p0).toFixed(9)};
player.tvDX=0; player.tvDY=0;
loiterDespawn(d);                            // 静默退场 (与 T 键同一退场链)
const exit={loiterNull:player.loiter===null,
 keptYaw:player.yaw===y0, keptPitch:player.pitch===p0};   // 退场保持发射时朝向 (2026-11-06 二次裁定; y0/p0 捕获于转向前 = 发射朝向)
return {steer,exit};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
assert('T2 前置: 巡飞弹在导 (fireLoiter)',r&&typeof r==='object'&&!r.err,JSON.stringify(r));
if(!r||typeof r!=='object'||r.err) return;
assert('T2 ★ 鼠标增量确实掰动弹体 (|Δyaw|>0.02 / |Δpitch|>0.02, movementX为正⇒yaw负向)',Math.abs(r.steer.dYaw)>0.02&&Math.abs(r.steer.dPitch)>0.02,JSON.stringify(r.steer));
assert('T2 ★ 本体角逐位不动 (转向不再带着本体一起转)',r.steer.bodyYaw===0&&r.steer.bodyPitch===0,'bodyYaw='+r.steer.bodyYaw+' bodyPitch='+r.steer.bodyPitch);
assert('T2 ★ 退场清账 (player.loiter=null)',r.exit.loiterNull===true,'');
assert('T2 ★ 退场保持发射时朝向 (引爆/消失不写本体角, 2026-11-06 二次裁定: 朝向=发射时朝向)',r.exit.keptYaw===true&&r.exit.keptPitch===true,'keptYaw='+r.exit.keptYaw+' keptPitch='+r.exit.keptPitch);
}

// ═════ T3 弹体可见性单写者 ═════
function t3(){
section('T3 弹体可见性单写者: 唯一隐藏态 = TV弹头档/开镜放大(lz), 其余一切视角可见');
const ctx=boot({});
const dep=VM(ctx,PLAIN_DEPLOY);
assert('T3 前置: 普通部署 cls3',typeof dep==='object'&&dep.alive===true,JSON.stringify(dep));
if(typeof dep!=='object') return;
const r=VM(ctx,`(function(){ try{
player.pos.set(0,heightAt(0,0)+1.5,0);        // 探针围栏② (须在 fireLoiter **之前**, 同 T2: OOB 不受 grace 豁免)
const d=fireLoiter(player,V3(player.pos.x,player.pos.y+1.4,player.pos.z),V3(0,0,-1));
if(!d||!player.loiter) return {err:'fireLoiter 未建立 loiter'};
d.grace=9999; d.life=9999;                    // 探针围栏: 同 T1 (纯可见性采样, 不测命中/到期)
__step(2);
const tv=d.mesh.visible;                     // TV 弹头档 ⇒ 藏 (镜头就在弹鼻上)
player.loiterView=1; __step(2);
const back=d.mesh.visible;                   // F 背追档 ⇒ 显
player.loiterView=0; __step(2);
const tv2=d.mesh.visible;                    // 回 TV ⇒ 再藏
player.alive=false; __step(2);               // 死亡镜头 / 真观战自由视角 ⇒ 显 ★ (旧版永隐)
const dead=d.mesh.visible;
return {tv,back,tv2,dead};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
assert('T3 前置: 巡飞弹在导 (fireLoiter)',r&&typeof r==='object'&&!r.err,JSON.stringify(r));
if(!r||typeof r!=='object'||r.err) return;
assert('T3 ★ TV弹头档: 弹体隐藏',r.tv===false,'tv='+r.tv);
assert('T3 ★ F背追档: 弹体可见',r.back===true,'back='+r.back);
assert('T3 回TV档: 再隐藏',r.tv2===false,'tv2='+r.tv2);
assert('T3 ★ alive=false (真观战自由视角/死亡镜头): 弹体可见 (旧版 fireLoiter 的 false 没人翻回来)',r.dead===true,'dead='+r.dead);
}

// ═════ T5 静态接线 ═════
function t5(){
section('T5 静态接线: 单行源码钉 + 旧写法绝迹钉 + 载入清单对账 + 版本戳');
const pins=[
 ['js/13-combat.js','出膛初始可见性 = 单写者同式 (真观战出膛即可见)','d.mesh.visible=!(shooter.alive&&!player.loiterView);'],
 ['js/13-combat.js','弹体可见性单写者 (updateLoiters 末尾, 含开镜 lz 门)','d.mesh.visible=!(player.alive&&(!player.loiterView||lz));'],
 ['js/08-effects.js','背追档识别门 (loiterView)','const ltBack=!!(lt&&player.loiterView);'],
 ['js/08-effects.js','背追档手电锚弹体 (起点/朝向=弹鼻)','if(ltBack){ fwd=_pfF.copy(loiterForward(lt)); eye=lt.pos; }'],
 ['js/08-effects.js','光柱起点=弹鼻光学头罩前','if(ltBack){ o.addScaledVector(fwd,0.4); }'],
 ['js/08-effects.js','光柱姿态随弹体','cone.rotation.set(lt.pitch,lt.yaw,0);'],
 ['js/08-effects.js','vm 灯制导中同步熄','vml.visible=!tp&&!lt;'],
];
for(const [f,label,needle] of pins) assert('T5 '+f+' :: '+label,SRC(f).includes(needle),SRC(f).includes(needle)?'':'缺锚: '+needle.slice(0,50));
// 旧写法绝迹钉 ①: updateLoiters 内 (弹体俯仰包线行 → dir=loiterForward 之间) 不再有任何本体角回写
const src13=SRC('js/13-combat.js');
const iPk=src13.indexOf('d.pitch=clamp(d.pitch,-1.2,1.2);');
const iDir=src13.indexOf('const dir=loiterForward(d);',iPk);
assert('T5 绝迹钉: updateLoiters 制导段无 player.yaw= 回写 (旧跟随行已删)',iPk>=0&&iDir>iPk&&!src13.slice(iPk,iDir).includes('player.yaw='));
// 退场对齐写绝迹钉 (2026-11-06 二次裁定): 13-combat 全文无"弹体角写本体"的退场对齐字样
const nAlign=src13.split('player.yaw=d.yaw').length-1;
assert('T5 绝迹钉: 13-combat 全文无退场对齐写点 (引爆/静默消失/T 弃弹三路都不写本体角)',nAlign===0,'×'+nAlign);
// 旧写法绝迹钉 ②: updateCamera loiter 分支 (hide 之后 / chute 之前) 不再写弹体 visible
const src20=SRC('js/20-player.js');
const iCam=src20.indexOf('function updateCamera(dt){');
const iLoiter=src20.indexOf('if(p.loiter&&p.alive){',iCam);
const iChute=src20.indexOf('if(p.chute){',iLoiter);
assert('T5 绝迹钉: updateCamera loiter 分支无 d.mesh.visible= 写 (单写者收拢)',iCam>=0&&iLoiter>iCam&&iChute>iLoiter&&!src20.slice(iLoiter,iChute).includes('d.mesh.visible='));
// 载入清单对账 (动态解析, 不写死数字)
const htmlScripts=(html.match(/<script src="js\/[^"?]*\?v=[^"]*"/g)||[]).map(x=>x.replace(/<script src="/,'').replace(/"$/,'').split('?')[0]);
assert('T5 载入清单 = index.html 实载脚本逐条同序 ('+FILES.length+' 个)',JSON.stringify(htmlScripts)===JSON.stringify(FILES));
// 版本戳
const stamps=[...html.matchAll(/20261128e/g)];
const stampSet=[...new Set(stamps.map(m=>m[0]))];
assert('T5 版本戳 20261128e 全量唯一 (2026-11-10 海战移除批判据跟码)',stamps.length>40&&stampSet.length===1&&html.includes("window.__sfStyleVer='20261128e';"),'×'+stamps.length);
const gf=fs.readFileSync(path.join(root,'dev/_game_files.txt'),'utf8');
assert('T5 dev/_game_files.txt 同步升戳',gf.includes('v=20261128e')&&!gf.includes('20261105b'));
}

t1(); t2(); t3(); t5();
console.log('\n──────────────────────────────────');
console.log((NEG?'[阴性对照] ':'')+'PASS '+OK.length+' / FAIL '+BAD.length);
if(BAD.length){ console.log('红账:\n - '+BAD.join('\n - ')); process.exit(1); }
