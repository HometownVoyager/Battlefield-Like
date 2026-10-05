// ─────────────────────────────────────────────
// dev/verify-loiterfix-20260928.js —— 巡飞弹制导重做 + 击落视觉交接原子化 (2026-09-28, 不进 index.html)
// 用法: node dev/verify-loiterfix-20260928.js
// 起因 (用户实报, 三条):
//   ① "现在巡飞弹转向十分生硬还随机失控，原因不明。"
//   ② "被巡飞弹击毁的飞机会挂在天上固定不动。"
//   ③ "材质问题仍十分严重。" (抹灰面: 棕色圆点 + 毛线状"裂纹" —— 见 verify-matseam 的抹灰段)
// 原理: 复用 dev/_bootstub.js 的桩 + CANNON 半截桩, 加载**全部真脚本**(与 index.html 同序),
//       真起点 startBtn.onclick() 开局 → 观战者部署 → 全程走游戏内真入口
//       (fireLoiter / updateLoiters / loiterDetonate / loiterDespawn / Plane.die / updatePlaneWrecks /
//        specTimeConsume / specTimeShotDt), 不复制被测逻辑。
// 断言:
//   L1 ★ 制导 = 鼠标直控: 增量→姿态逐位等于解析式 · 本体角不领先 (同一量) · 松手不再拐 · 不再持续下沉 ·
//      角速度上限仍在 · 19-input 制导期间只记账 (真 mousemove 事件派发) · 结束清账;
//   L2 ★ 击落原子性: 正常路径 (隐藏本体 + 残骸坠落) + **记分链抛异常时仍原子** (阴性对照: 旧顺序
//      会让"死而不隐"的飞机留在空中 —— 判据是源码顺序 + 打断后的行为两面);
//   L3 时停口径: 观察者自己的弹照飞照杀, 残骸随战场冻结、解除后照常落地 (与"冻的是战场"同一条)。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const {sandbox,document,window,byId}=require('./_bootstub.js');
require('./_bootpatch.js').patch(sandbox);
// 桩能力补齐 (与 verify-timestopfix 同源; 缺了会在 vmEquip/相机链直接抛)
const _O3=sandbox.THREE.Object3D, _V3=sandbox.THREE.Vector3, _BA=sandbox.THREE.BufferAttribute;
if(_O3&&_O3.prototype&&!_O3.prototype.clear) _O3.prototype.clear=function(){ if(this.children) this.children.length=0; return this; };
if(!_V3.prototype.negate) _V3.prototype.negate=function(){ this.x=-this.x; this.y=-this.y; this.z=-this.z; return this; };
if(!_V3.prototype.cross) _V3.prototype.cross=function(v){ return this.crossVectors(this,v); };
if(_BA&&_BA.prototype&&!_BA.prototype.setXYZ) _BA.prototype.setXYZ=function(i,x,y,z){ if(this.array){ this.array[i*this.itemSize]=x; this.array[i*this.itemSize+1]=y; this.array[i*this.itemSize+2]=z; } return this; };
sandbox.confirm=()=>true;
const handlers={};
sandbox.addEventListener=(t,f)=>{ (handlers[t]=handlers[t]||[]).push(f); };
sandbox.removeEventListener=()=>{};
const patchStyle=(el)=>{ if(el&&el.style&&typeof el.style.setProperty!=='function') el.style.setProperty=function(k,v){this[k]=v;}; return el; };
{ const g=document.getElementById.bind(document),c=document.createElement.bind(document),q=document.querySelector.bind(document);
  document.getElementById=(id)=>patchStyle(g(id)); document.createElement=(t)=>patchStyle(c(t)); document.querySelector=(s)=>patchStyle(q(s)); }
// CANNON 半截桩 (与 verify-destruct-20260927N 同口径; 够 ragInit/spawnRagdoll 跑通)
class Quat{constructor(){this.x=0;this.y=0;this.z=0;this.w=1;} set(x,y,z,w){this.x=x;this.y=y;this.z=z;this.w=w;return this;} setFromEuler(){return this;} copy(q){Object.assign(this,q);return this;}}
const CANNON_STUB={Vec3:_V3,Quaternion:Quat,
World:class{constructor(){this.gravity=new _V3();this.broadphase=null;this.solver={iterations:0};this.bodies=[];}addBody(b){this.bodies.push(b);}removeBody(b){const i=this.bodies.indexOf(b);if(i>=0)this.bodies.splice(i,1);}add(b){this.addBody(b);}remove(b){this.removeBody(b);}addConstraint(){}removeConstraint(){}step(){}},
Body:class{constructor(o){Object.assign(this,o||{});this.shapes=[];this.position=new _V3();this.velocity=new _V3();this.angularVelocity=new _V3();this.quaternion=new Quat();}addShape(s){this.shapes.push(s);}},
Box:class{},Sphere:class{},Material:class{},ContactMaterial:class{},NaiveBroadphase:class{},PointToPointConstraint:class{}};
if(window) window.CANNON=CANNON_STUB;
const FILES=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/15g-capmodels.js','js/15h-capital.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/22a-menuart.js','js/22b-speclayer.js','js/23-deploy.js','js/23b-worldrestore.js','js/24-main.js'];
function load(ctx,file){ vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file}); }
function boot(){
for(const k in byId) delete byId[k];
for(const k in handlers) delete handlers[k];
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document; ctx.window=window; ctx.CANNON=CANNON_STUB;
ctx.__evH=handlers;   // 事件捕获表透进 VM: L1 在沙箱内派发真 mousemove 后要读它 (Node 侧闭包变量 VM 里不可见)
ctx.localStorage={_s:{sf_campaign:'0',sf_exp:'1'},getItem(k){return (k in this._s)?this._s[k]:null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of FILES) load(ctx,f);
try{ vm.runInContext(`document.getElementById('startBtn').onclick();`,ctx); }catch(e){ console.log('  开局异常: '+e); }
return ctx;
}
const ctx=boot();
const VM=(x)=>vm.runInContext(x,ctx);
const SRC={};
const read=(rel)=>{ if(!(rel in SRC)) SRC[rel]=fs.readFileSync(path.join(root,rel),'utf8'); return SRC[rel]; };
let PASS=0, FAILS=0;
const ok=(c,msg)=>{ if(c){ PASS++; console.log('  ✔ '+msg); } else { FAILS++; console.log('  ✘ '+msg); } };
const note=(s)=>console.log('  · '+s);
const EXC=(tag,e)=>{ FAILS++; console.log('  ✘ '+tag+' 推演异常: '+String((e&&e.stack)||e)); };

console.log('══ 巡飞弹制导重做 + 击落交接原子化 (dev/verify-loiterfix-20260928.js) ══');

// ═════ L1 制导 = 鼠标直控 ═════
console.log('L1 ★ TV 制导: 鼠标直接驱动弹体 (不再"弹体追本体角")');
{
const r=VM(`(()=>{try{
if(typeof specTimeReset==='function') specTimeReset();
player.team=0; player.cls=3; player.spectator=true; player.specUsed=true; selectedSpawn=-1; deployPlayer();
player.spectator=false;
const d=fireLoiter(player,V3(0,60,0),V3(0,0,-1));
d.grace=0; d.life=9999; d.spd=13;
const sens=0.0022*((typeof SETTINGS!=='undefined'&&SETTINGS.sens)||1)*(85/74);
const rateYaw=2.5, ratePitch=1.9, DT=1/60;
const hold=()=>{ d.pos.set(0,60,0); updateLoiters(DT,DT); };
// ① 一帧 +100px 横甩: 期望 yaw += clamp(-100*sens, ±rate*DT)
const y0=d.yaw; player.tvDX=100; player.tvDY=0; hold();
const y1=d.yaw;
const exp1=clamp(-100*sens,-rateYaw*DT,rateYaw*DT);
// ② 上限: 一帧 5000px
const y1b=d.yaw; player.tvDX=5000; hold(); const y2=d.yaw;
// ③ 松手 (零输入) 120 帧: 姿态不许再动
const y3=d.yaw, p3=d.pitch;
for(let f=0;f<120;f++) hold();
const y4=d.yaw, p4=d.pitch;
// ③b 阴性对照: 用**旧公式**在同一状态下继续推 (d 追 player.yaw 且本体角领先), 量"松手后还会拐多少"
const dYawOld=(yy,pp)=>{ yy+=clamp(angDiff(yy,pp.yaw),-1.9*DT,1.9*DT); return yy; };
let yOld=d.yaw; const pLead={yaw:d.yaw-1.1};                    // 模拟"甩枪多出的 1.1rad 存在本体角里"
for(let f=0;f<180;f++) yOld=dYawOld(yOld,pLead);
const oldResidual=Math.abs(angDiff(yOld,d.yaw));                // 旧公式 3s 内继续偏转的弧长
// ④ 俯仰不再持续下沉: 1200 帧零输入 (20s)
const p5=d.pitch;
for(let f=0;f<1200;f++) hold();
const p6=d.pitch;
// ⑤ 本体姿态 = 弹体姿态 (同一量)
const same=(d.yaw===player.yaw)&&(Math.abs(player.pitch-d.pitch)<1e-9);
// ⑥ 19-input 真事件: 制导期间 movementX 只进 tvDX, 本体 yaw 不变
pointerLocked=true;   // 沙箱没有指针锁 API: 19-input 入口有 !pointerLocked 早退, 这里模拟已锁定
const kd=__evH.mousemove||[];
player.tvDX=0; player.tvDY=0;
const py0=player.yaw, pp0=player.pitch;
for(const f of kd) f({movementX:37,movementY:-12,preventDefault(){},stopPropagation(){}});
const ev={tvDX:player.tvDX,tvDY:player.tvDY,yawMoved:player.yaw!==py0,pitchMoved:player.pitch!==pp0};
// ⑦ 结束清账: 引爆后 tvDX/tvDY 归零
player.tvDX=99; player.tvDY=-99; loiterDetonate(d,d.pos.clone());
const cleared={x:player.tvDX,y:player.tvDY,dead:d.dead};
return {exp1,step1:y1-y0,cap2:y2-y1,capExp:rateYaw*DT,restYaw:Math.abs(y4-y3),restPitch:Math.abs(p4-p3),
oldResidual,drift20s:p6-p5,same,ev,cleared,sens,
mousemoveHandlers:kd.length};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof r==='string'){ EXC('L1',r); } else {
ok(Math.abs(r.step1-r.exp1)<1e-12, `L1 增量→姿态逐位等于解析式 (100px → ${r.step1.toFixed(5)} rad, 期望 ${r.exp1.toFixed(5)} = clamp(-100·sens) @sens=${r.sens.toFixed(6)})`);
ok(Math.abs(Math.abs(r.cap2)-r.capExp)<1e-12&&r.cap2<0, `L1 角速度上限仍在: 一帧 5000px 只走 ${r.cap2.toFixed(5)} rad = −rateYaw·dt (movementX 为正 ⇒ yaw 负向), 超出部分**丢弃**`);
ok(r.restYaw<1e-12&&r.restPitch<1e-12, `L1 ★ 松手即停: 零输入 120 帧姿态逐位不变 (Δyaw=${r.restYaw}, Δpitch=${r.restPitch}) —— 旧公式在同一状态还要再拐 ${r.oldResidual.toFixed(2)} rad (3s 内)`);
ok(Math.abs(r.drift20s)<0.02, `L1 ★ 不再持续下沉: 零输入 20s 的俯仰漂移 ${r.drift20s.toFixed(4)} rad (旧版那句 -0.06rad/s 的低头在直控下会变成 20s 沉 1.2rad)`);
ok(r.same===true, 'L1 本体姿态跟随弹体 (player.yaw===d.yaw): 视角与弹体是同一个量, 退出 TV 视角时画面不跳');
ok(r.mousemoveHandlers>0&&r.ev.tvDX===37*r.mousemoveHandlers&&r.ev.tvDY===-12*r.mousemoveHandlers&&!r.ev.yawMoved&&!r.ev.pitchMoved,
`L1 19-input 真事件: 制导期间 ${r.mousemoveHandlers} 个 mousemove 处理器把 movement 记进 tvDX/tvDY (${r.ev.tvDX}/${r.ev.tvDY}), 本体 yaw/pitch **未动**`);
ok(r.cleared.x===0&&r.cleared.y===0&&r.cleared.dead===true, 'L1 制导结束清账: 引爆后 tvDX/tvDY=0 (下一枚出膛不会先"拐一下")');
}
}

// ═════ L2 击落交接原子性 ═════
console.log('L2 ★ 击落: 视觉交接 (隐藏本体 + 挂残骸) 在记分/DOM/布娃娃之**前**, 且整段副作用可失败');
{
// 源码顺序: die() 体内 this.grp.visible=false 必须早于 registerKillScore / cb.damage
const s16=read('js/16-aircraft.js');
const iDie=s16.indexOf('die(attacker){');
const iHide=s16.indexOf('this.grp.visible=false;',iDie);
const iPush=s16.indexOf('planeWrecks.push(',iDie);
const iScore=s16.indexOf("registerKillScore('击落战机'",iDie);
const iCrew=s16.indexOf('cb.damage(999,attacker,false);',iDie);
const iTry=s16.indexOf('try{',iDie), iCatch=s16.indexOf('}catch(e){',iDie);
ok(iHide>iDie&&iPush>iDie&&iPush<iScore&&iHide<iScore&&iHide<iCrew&&iTry<iScore&&iCatch>iScore,
`L2 源码顺序: 残骸入表(#${iPush-iDie}) 与 隐藏本体(#${iHide-iDie}) 都早于 记分(#${iScore-iDie})/布娃娃(#${iCrew-iDie}), 副作用整段在 try(#${iTry-iDie})…catch(#${iCatch-iDie}) 内`);
const r=VM(`(()=>{try{
specTimeReset();
planeWrecks.length=0;
for(const q of planes){ q.alive=true; q.hp=q.maxHp; q.grp.visible=true; }
const pl=planes.find(p=>p.alive);
pl.pos.set(0,70,0); pl.pitch=0; pl.roll=0; pl.yaw=0; pl.speed=44; pl.hp=pl.maxHp;
// 正常路径: 弹体直击 (非观战口径, 走 directPlane)
player.spectator=false;
const d=fireLoiter(player,V3(0,70,-8),V3(0,0,1));
d.grace=0;
const w0=planeWrecks.length;
let thrown=null;
try{ loiterDetonate(d,pl.pos.clone(),null,null,pl); }catch(e){ thrown=String((e&&e.message)||e); }
const good={thrown,alive:pl.alive,vis:pl.grp.visible,w:planeWrecks.length-w0,wmVis:planeWrecks.length?planeWrecks[planeWrecks.length-1].m.visible:null};
const ys=[]; for(let f=0;f<300;f++){ updatePlaneWrecks(1/60); ys.push(+planeWrecks[planeWrecks.length-1].pos.y.toFixed(2)); }
good.y0=ys[0]; good.yEnd=ys[299]; good.state=planeWrecks[planeWrecks.length-1].state;
// ★ 打断记分链 (模拟真 DOM/cannon 在那一环抛异常): showKillPop 抛 ⇒ die() 的副作用段失败
planeWrecks.length=0;
const pl2=planes.find(p=>p!==pl)||pl;
pl2.alive=true; pl2.hp=pl2.maxHp; pl2.grp.visible=true; pl2.pos.set(60,70,0); pl2.pitch=0; pl2.yaw=0; pl2.speed=44;
const savedPop=showKillPop;
let killed=true;
showKillPop=function(){ throw new Error('模拟记分/DOM 链异常'); };
const d2=fireLoiter(player,V3(60,70,-8),V3(0,0,1)); d2.grace=0;
const w1=planeWrecks.length;
let esc=null;
try{ loiterDetonate(d2,pl2.pos.clone(),null,null,pl2); }catch(e){ esc=String((e&&e.message)||e); }
const bad={esc,alive:pl2.alive,vis:pl2.grp.visible,w:planeWrecks.length-w1};
for(let f=0;f<300;f++) updatePlaneWrecks(1/60);
bad.yEnd=planeWrecks.length?+planeWrecks[planeWrecks.length-1].pos.y.toFixed(2):'gone';
bad.state=planeWrecks.length?planeWrecks[planeWrecks.length-1].state:'gone';
showKillPop=savedPop;
return {good,bad};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof r==='string'){ EXC('L2',r); } else {
const g=r.good;
ok(g.thrown===null&&g.alive===false&&g.vis===false&&g.w===1&&g.wmVis===true,
`L2 正常路径: 击毁即"本体已隐(false) + 残骸入表(+${g.w}) + 残骸模型可见(${g.wmVis})", 无异常`);
ok(g.y0===g.yEnd-0||g.yEnd<g.y0&&g.state==='fall'||g.state==='rest'||g.state==='sinking', `L2 正常路径: 残骸真的在落 (y ${g.y0} → ${g.yEnd}, 状态 ${g.state})`);
ok(g.y0>5&&g.yEnd<g.y0-40, `L2 正常路径: 4s 内坠落 ${(g.y0-g.yEnd).toFixed(1)}m (残骸物理未被改动)`);
const b=r.bad;
ok(b.esc===null,'L2 ★ 记分链抛异常时**不逃逸**: die() 内部消化 (旧顺序: 异常会带着"已死但可见"的飞机冒到主循环)');
ok(b.alive===false&&b.vis===false&&b.w===1, `L2 ★ 异常路径仍完成交接: 本体已隐(${!b.vis}) + 残骸入表(+${b.w}) —— 旧顺序下这两条都是红的 (飞机挂在天上)`) ;
ok(b.state==='fall'||b.state==='rest'||b.state==='sinking', `L2 ★ 异常路径的残骸照落 (yEnd=${b.yEnd}, 状态 ${b.state})`);
note('负面口径 (记录): 记分/战报那一笔会随异常丢掉 —— 单位状态不受影响是首要的; console.warn 留痕。');
}
}

// ═════ L3 时停口径 ═════
console.log('L3 时停: 观察者自己的弹照飞照杀, 残骸随战场冻结 (与"冻的是战场, 不是观察者"同一条)');
{
const r=VM(`(()=>{try{
planeWrecks.length=0;
player.team=0; player.cls=3; player.spectator=true; player.specUsed=true; selectedSpawn=-1; deployPlayer();
if(!SPEC_TIME.paused) specTimeToggle();
const pl=planes.find(p=>p.alive)||planes[0];
pl.alive=true; pl.hp=pl.maxHp; pl.grp.visible=true; pl.pos.set(-60,70,0); pl.pitch=0; pl.roll=0; pl.yaw=0; pl.speed=44;
const d=fireLoiter(player,V3(-60,70,-8),V3(0,0,1)); d.grace=0;
const p0=d.pos.clone();
for(let f=0;f<30;f++) updateLoiters(specTimeConsume(1/60),1/60);
const flew=+p0.distanceTo(d.pos).toFixed(2);
loiterDetonate(d,d.pos.clone(),null,null,pl);           // 命中即爆: 伤害/击毁不受时停影响 (观察者自己的弹)
const w=planeWrecks.length;
const y0=+planeWrecks[w-1].pos.y.toFixed(3);
for(let f=0;f<120;f++) updatePlaneWrecks(specTimeConsume(1/60));
const y1=+planeWrecks[w-1].pos.y.toFixed(3);
specTimeReset();
for(let f=0;f<300;f++) updatePlaneWrecks(1/60);
const y2=planeWrecks.length?+planeWrecks[w-1].pos.y.toFixed(2):'gone';
return {flew,alive:pl.alive,vis:pl.grp.visible,w,y0,y1,y2,state:planeWrecks.length?planeWrecks[w-1].state:'gone'};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof r==='string'){ EXC('L3',r); } else {
ok(r.flew>2&&r.alive===false&&r.vis===false&&r.w>=1, `L3 时停中观察者的弹照飞 (${r.flew}m) 照杀 (奸灭成立, 本体已隐)`);
ok(r.y0===r.y1, `L3 残骸随**战场**冻结: 世界帧长=0 时 y 逐位不变 (${r.y0}) —— 与冻结的爆炸粒子同一口径`);
ok(r.y2!=='gone'&&r.y2<r.y0-30, `L3 解除时停后照常落地 (${r.y0} → ${r.y2}, 状态 ${r.state}) —— 冻的是"那一刻的战场", 不是把残骸废掉`);
}
}

console.log('\n合计: '+PASS+' 通过 / '+FAILS+' 失败');
if(FAILS) process.exitCode=1; else console.log('全部通过 ✔');
