// ─────────────────────────────────────────────
// dev/verify-ffkill-firelight-specesc-20261128.js —— 2026-11-28 实机三症状批 (戳 20261128e):
//   ① 炸毁己方坦克没有记录和得分 (用户实报): Tank/Plane/舰艇三处 die 记分块旧门
//      `coFfFire(attacker)||attacker.team!==this.team` 只放行观战火力/异队击毁 —— EXPLO_FF
//      (sf_explo_ff, 默认开) 时代友军爆炸本就伤得到己方载具, 毁己方坦克却零击杀零得分零战报,
//      与步兵 die 链 (18-game, 无队属门) 劈叉。修 = 三处统一改"任何有归属击毁都记账记分",
//      唯一排除=自毁 (attacker===驾驶员本人; 与步兵链 attacker!==this 自炸不给杀同规)。
//      卡车 (15b)/Bot (14)/丧尸 (25)/步兵 (18) 四处本就无队属门, 全库扫描无其它同构写点。
//   ② 上一局工程兵油桶火焰光残留 (用户实报): clearMatchEffects (2026-11-21 P1-14) 清了
//      _fireLightPool 三池但漏了配套**分配槽 _fireAssign** (2026-10-24 性能批"分配槽持久化"),
//      且 _fireCandAlive 的 'fs' 档活判据只看 src.ttl>0 不查 FIRE_SOURCES 成员资格 —— 换局整表
//      清账 (FIRE_SOURCES.length=0) 后旧火源对象的 ttl 冻结不再递减, 旧候选被判"永远活着",
//      新局灯池重建第一帧就被旧候选占位, 上一局火光原位复亮。修 = ①fs 档加成员资格判据
//      (与 smoke/cell 两档对齐) ②23b clearMatchEffects 分配槽随池一并弃。
//   ③ 观战模式下按 ESC 导致重部署页面 UI 残留 (用户实报): 自由观战 (specView) 按 ESC 呼出
//      部署页 (pointerlockchange 丢锁同族, 票尽页面上唯一可用按钮=「观 战」), 「观 战」按钮
//      (deployBtn.onclick 票尽分流) 调 enterSpecView —— 而视模式里 spectator/specView 早已置真,
//      旧进门门 `player.alive||player.spectator` 把重进当非法入**静默早退**: 部署页收不掉、指针
//      不回锁 (24-main 逐帧保活还把按钮钉在「观 战」)。修 = enterSpecView 顶部加幂等重进快路:
//      specView&&!alive ⇒ 只收屏+回锁, 不重放入场段。
// 用法: node dev/verify-ffkill-firelight-specesc-20261128.js [--neg]
// 判据:
//   T0 源码锚 (三任务全量+旧门绝迹负向) + T1-T5 行为断言 (真开局沙箱)。
//   --neg (六补丁, 红名↔补丁): N1 坦克门还原→T0a/T1 / N2 飞机门还原→T0b/T2 / N3 舰艇门还原→T0c /
//      N4 fs 成员资格拆→T0d/T4c/T4d / N5 分配槽重置拆→T0e/T4b/T4d / N6 观战重进快路拆→T0f/T5a。
// 沙箱要点承 verify-ridepose-batch-20261128 (受控时钟 __step 直驱 loop()/listeners 捕获/CANNON 桩)
// 与 verify-specpose-hudresidue-20261122 (部署页 DOM 直调 showDeploy/enterSpecView)。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const stub=require('./_bootstub.js');
require('./_bootpatch.js').patch(stub.sandbox);
{const P=Object.getPrototypeOf(stub.THREE.Group.prototype); if(!P.clear) P.clear=function(){ this.children.length=0; };}
const _ensureStyle=e=>{ if(e&&e.style&&!e.style.setProperty) e.style.setProperty=(k,v)=>{ e.style[k]=v; }; return e; };
{const doc=stub.document,og=doc.getElementById.bind(doc),oc=doc.createElement.bind(doc);
doc.getElementById=id=>_ensureStyle(og(id));
doc.createElement=t=>_ensureStyle(oc(t));}
const CANNON=(()=>{
const V3=stub.THREE.Vector3;
class Quat{constructor(){this.x=0;this.y=0;this.z=0;this.w=1;}set(){return this;}setFromEuler(){return this;}copy(){return this;}}
return {
Vec3:V3,Quaternion:Quat,
World:class{constructor(){this.gravity=new V3();this.broadphase=null;this.solver={iterations:0};this.bodies=[];}addBody(b){this.bodies.push(b);}removeBody(b){const i=this.bodies.indexOf(b);if(i>=0)this.bodies.splice(i,1);}add(b){this.addBody(b);}remove(b){this.removeBody(b);}addConstraint(){}removeConstraint(){}step(){}},
Body:class{constructor(o){Object.assign(this,o||{});this.shapes=[];this.position=new V3();this.velocity=new V3();this.angularVelocity=new V3();this.quaternion=new Quat();this.angularDamping=0;this.linearDamping=0;}addShape(s){this.shapes.push(s);}},
Box:class{},Sphere:class{},Material:class{},ContactMaterial:class{},NaiveBroadphase:class{},
PointToPointConstraint:class{constructor(a,pa,b,pb){this.bodyA=a;this.pivotA=pa;this.bodyB=b;this.pivotB=pb;}},
};})();

const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const FILES=[...html.matchAll(/src="(js\/[^"?]+)/g)].map(m=>m[1]);
console.log('载入清单: 解析 index.html 得 '+FILES.length+' 个脚本');

// ── NEG 阴性对照: 六补丁 (正常跑不启用) ──
const NEG=process.argv.includes('--neg');
const SRC={},PATCH_MAP={};
const NEG_PATCHES=[
// N1 坦克记分门还原 (15-vehicles): 友军毁车回归零记录 ⇒ T1 红 (Δ杀/Δ分/战报全 0) + T0a 红
['js/15-vehicles.js','if(attacker&&attacker!==driver){','if(attacker&&(coFfFire(attacker)||attacker.team!==this.team)){'],
// N2 飞机记分门还原 (16-aircraft): 同上 ⇒ T2 红 + T0b 红
['js/16-aircraft.js','if(attacker&&attacker!==_pilot){','if(attacker&&(coFfFire(attacker)||attacker.team!==this.team)){'],
// N3 舰艇记分门还原 (15d-naval): 行为档无海战图可布 ⇒ T0c 红 (源码锚对账)
['js/15d-naval.js','if(attacker&&attacker!==(this.playerDriven?player:null)){','if(attacker&&(coFfFire(attacker)||attacker.team!==this.team)){'],
// N4 fs 成员资格拆 (08-effects _fireCandAlive): 旧判据 ttl-only 回归 ⇒ T4c 红 (清账后旧候选仍点亮灯) + T0d 红
['js/08-effects.js',"  if(c.kind==='fs') return typeof FIRE_SOURCES!=='undefined'&&FIRE_SOURCES.indexOf(c.src)>=0&&c.src.ttl>0;","  if(c.kind==='fs') return c.src.ttl>0;"],
// N5 分配槽重置拆 (23b clearMatchEffects): 槽里留旧候选 ⇒ T4b 红 (清账后 _fireAssign 非空) + T0e 红
['js/23b-worldrestore.js',"try{ if(typeof _fireAssign!=='undefined') for(let _fai=0;_fai<_fireAssign.length;_fai++) _fireAssign[_fai]=null; }catch(e){}",''],
// N6 观战重进快路拆 (20-player enterSpecView): 静默早退回归 ⇒ T5a 红 (部署页收不掉) + T0f 红
['js/20-player.js','if(player.specView&&!player.alive){','if(false){'],
];
if(NEG) for(const [f,from,to] of NEG_PATCHES){
if(SRC[f]===undefined) SRC[f]=fs.readFileSync(path.join(root,f),'utf8');
if(SRC[f].indexOf(from)<0){ console.log('✗ NEG 锚缺失: '+f+' :: '+JSON.stringify(from.slice(0,60))); process.exit(1); }
PATCH_MAP[f]=(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC[f]).split(from).join(to);
}
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:fs.readFileSync(path.join(root,f),'utf8'));

function boot(campIdx){
for(const k in stub.byId)delete stub.byId[k];
const ctx=vm.createContext(Object.assign({},stub.sandbox));
const listeners={};
const addL=(t,f)=>{ (listeners[t]=listeners[t]||[]).push(f); };
ctx.addEventListener=addL;
ctx.document=Object.assign({},stub.document,{addEventListener:addL,removeEventListener(){}});
ctx.window=Object.assign({},stub.window,{addEventListener:addL,removeEventListener(){}});
ctx.dispatchEvent=ev=>{ if(!ev.preventDefault) ev.preventDefault=()=>{}; if(!ev.stopPropagation) ev.stopPropagation=()=>{}; for(const f of (listeners[ev.type]||[]).slice()) f(ev); return true; };
ctx.KeyboardEvent=class{ constructor(t,o){ o=o||{}; this.type=t; this.code=o.code; this.repeat=!!o.repeat; } };
ctx.MouseEvent=class{ constructor(t,o){ o=o||{}; this.type=t; this.button=o.button; } };
ctx.CANNON=CANNON;
ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
ctx.__T=1000;
ctx.performance={now:()=>ctx.__T};
for(const f of FILES) vm.runInContext(srcOf(f),ctx,{filename:f});
vm.runInContext('var __step=(n)=>{ for(let i=0;i<n;i++){ __T+=16.7; loop(); } };',ctx);
return ctx;
}
const PASS=[];let FAILN=0;
function ok(cond,label){
if(cond){ PASS.push(label); console.log('  ✔ '+label); }
else { FAILN++; console.log((NEG?'  ● [期望红] ':'  ✘ ')+label); }
}
let IDXS=1; { const c0=boot(0); IDXS=vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="stalingrad")',c0); }
const ctx=boot(IDXS);
const G=s=>vm.runInContext(s,ctx);
let err0=null;
try{ G("document.getElementById('startBtn').onclick();"); }catch(e){ err0=String(e&&e.stack||e); }
if(!err0){ try{ G('if(!player.alive||!player.deployed) deployPlayer();'); }catch(e){ err0='deployPlayer: '+String(e&&e.stack||e); } }
if(err0||!G('player.alive')){ console.log('  ✘ 开局/部署失败 '+(err0||'player.alive=false')); process.exit(1); }
ok(html.includes("__sfStyleVer='20261128e'"),'前置: 版本戳 20261128e 在位 (index.html 内联)');

// ══ T0 源码锚 (三任务全量) ══
console.log('T0 源码锚');
const s15=srcOf('js/15-vehicles.js'),s16=srcOf('js/16-aircraft.js'),s15d=srcOf('js/15d-naval.js'),
s08=srcOf('js/08-effects.js'),s23b=srcOf('js/23b-worldrestore.js'),s20=srcOf('js/20-player.js');
// ① 友伤记账 (三处门)
ok(s15.includes('★2026-11-28 友伤记账批')&&s15.includes('if(attacker&&attacker!==driver){'),'T0a ★Tank.die 记分门改"任何有归属击毁"+自毁排除 (15-vehicles)');
ok(s16.includes('const _pilot=this.playerDriven?player:(this.crewBot||null);')&&s16.includes('if(attacker&&attacker!==_pilot){'),'T0b ★Plane.die 记分门同构 (_pilot 清账前取) (16-aircraft)');
ok(s15d.includes('if(attacker&&attacker!==(this.playerDriven?player:null)){'),'T0c ★舰艇 beginDestroy 记分门同构 (15d-naval)');
ok(!s15.includes('attacker&&(coFfFire(attacker)||attacker.team!==this.team)')&&!s16.includes('attacker&&(coFfFire(attacker)||attacker.team!==this.team)')&&!s15d.includes('attacker&&(coFfFire(attacker)||attacker.team!==this.team)'),'T0a2 旧队属门三处绝迹 (负向: coFfFire||异队)');
{ const _fam=['js/15b-trucks.js','js/14-bots.js','js/25-zombies.js','js/18-game.js'].map(f=>fs.readFileSync(path.join(root,f),'utf8'));
ok(_fam.every(s=>!s.includes('coFfFire(attacker)||attacker.team!==this.team')),'T0a3 卡车/Bot/丧尸/步兵四处记账本就无队属门 (回归钉: 全库扫描结论, 不随本批改动)'); }
// ② 火光残留
ok(s08.includes("FIRE_SOURCES.indexOf(c.src)>=0&&c.src.ttl>0")&&s08.includes('★2026-11-28 修 (用户实报"上一局油桶的火焰光残留")'),'T0d ★_fireCandAlive fs 档加 FIRE_SOURCES 成员资格 (08-effects)');
ok(s23b.includes("for(let _fai=0;_fai<_fireAssign.length;_fai++) _fireAssign[_fai]=null;"),'T0e ★clearMatchEffects 分配槽 _fireAssign 随池一并弃 (23b)');
// ③ 观战 ESC 重进
ok(s20.includes('if(player.specView&&!player.alive){')&&s20.indexOf('if(player.specView&&!player.alive){')<s20.indexOf('if(player.alive||player.spectator) return;')&&s20.includes('★2026-11-28 修 (用户实报"观战模式下按 ESC 导致重部署页面 UI 残留")'),'T0f ★enterSpecView 幂等重进快路 (在旧进门门之前) (20-player)');

// ══ T1 友军炸毁己方坦克: 全账记账 (①) ══
console.log('T1 友军炸毁己方坦克 (玩家为击毁者, EXPLO_FF 语义)');
G(`
// 自建坦克+车组 Bot (verify-tankai/ridepose 同款; 开局编制无闲置车)
var __t1t=new Tank(player.team,0);
var __t1b=null; for(const s of soldiers){ if(s.alive&&!s.onVehicle&&!s.onNaval&&!s.zombie){ __t1b=s; break; } }
var __t1ok=!!(__t1t&&__t1b);
if(__t1ok){ localStorage.setItem('sf_deathfx','1'); __t1b.spawnInVehicle(__t1t); }
// 无关兵员搬远角 (车爆点燃植被的火灼烧链不污染 Δ账)
for(const s of soldiers){ if(s.alive&&s!==__t1b&&s!==player) s.pos.set(__t1t.pos.x+400,__t1t.pos.y,__t1t.pos.z+400); }
var __t1={k0:(player.kills||0),s0:(player.score||0),tk0:tickets[player.team],kf0:document.getElementById('killfeed').children.length,ok:__t1ok};
if(__t1.ok){ __t1t.die(player); }   // 友军 (同队玩家) 击毁: 旧门下此路零记录
__t1.k1=(player.kills||0); __t1.s1=(player.score||0); __t1.tk1=tickets[player.team];
__t1.kf1=document.getElementById('killfeed').children.length;
__t1.feed=''; const __kf=document.getElementById('killfeed'); for(const c of __kf.children) __t1.feed+=c.innerHTML;
`);
ok(G('__t1.ok')===true,'T1-prep 己方坦克+车组 Bot 就位');
ok(G('__t1t.alive')===false&&G('__t1b.alive')===false,'T1a 车毁+驾驶员阵亡 (die(player) 直调)');
ok(G('__t1.k1')-G('__t1.k0')===4,'T1b ★Δ杀 = +4 (车体3+驾驶员1; 旧门下=0 — 用户实报本症状)');
ok(G('__t1.s1')-G('__t1.s0')===400,'T1c ★Δ分 = +400 (车体 registerKillScore 300 + 驾驶员 onPlayerKill 100; 旧门下=0)');
ok(G('__t1.tk0')-G('__t1.tk1')===4,'T1d Δ票 = -4 (车体3+驾驶员1; 票账口径本就不设队属门, 回归钉)');
ok(G('__t1.kf1')-G('__t1.kf0')===2,'T1e ★战报 2 行 (驾驶员行+车体行)');
ok(G('__t1.feed').indexOf('乘员×1')>=0||G('__t1.feed').indexOf('crew ×1')>=0,'T1f 车体行乘员数=×1');
ok(G('__t1.feed').indexOf('class="me"')>=0,'T1g 战报击毁者=玩家 (你)');

// ══ T2 友军击落己方战机 (①同构) ══
console.log('T2 友军击落己方战机');
G(`
var __t2p=null; for(const p of planes){ if(p&&p.alive&&p.crewBot&&!p.playerDriven){ __t2p=p; break; } }
var __t2ok=!!__t2p;
killStreakN=0; killStreakT=-99;   // T1 攒的连杀不清 ⇒ registerKillScore 走连杀倍率, Δ分断言失真 (探针账, 非游戏改动)
var __t2={k0:(player.kills||0),s0:(player.score||0),kf0:document.getElementById('killfeed').children.length,ok:__t2ok};
if(__t2.ok){ __t2p.die(player); }
__t2.k1=(player.kills||0); __t2.s1=(player.score||0);
__t2.kf1=document.getElementById('killfeed').children.length;
`);
ok(G('__t2.ok')===true,'T2-prep 己方 AI 战机 (带飞行员) 就位');
ok(G('__t2p.alive')===false,'T2a 机毁');
ok(G('__t2.k1')-G('__t2.k0')===4,'T2b ★Δ杀 = +4 (机体3+飞行员1; 旧门下=0)');
ok(G('__t2.s1')-G('__t2.s0')===400,'T2c ★Δ分 = +400 (击落战机 300 + 飞行员 100)');
ok(G('__t2.kf1')-G('__t2.kf0')===2,'T2d 战报 2 行');

// ══ T3 自毁排除 (attacker===驾驶员不给车体杀) ══
console.log('T3 自毁排除 (与步兵链 attacker!==this 同规)');
G(`
var __t3t=new Tank(player.team,0);
var __t3b=null; for(const s of soldiers){ if(s.alive&&!s.onVehicle&&!s.onNaval&&!s.zombie){ __t3b=s; break; } }
var __t3ok=!!(__t3t&&__t3b);
var __t3={k0:(player.kills||0),ok:__t3ok,delta:-9};
if(__t3ok){
localStorage.setItem('sf_deathfx','1');
__t3b.spawnInVehicle(__t3t);
player.pos.set(__t3t.pos.x,__t3t.pos.y,__t3t.pos.z);   // 玩家=驾驶员 (playerDriven 由 spawnInVehicle? 直置: 走 F 上车同款字段)
player.onVehicle=__t3t; __t3t.playerDriven=true; __t3t.crewBot=null;
__t3t.die(player);                                    // attacker===driver ⇒ 车体杀必须排除 (步兵链自炸同规)
__t3.delta=(player.kills||0)-__t3.k0;
}
`);
ok(G('__t3.ok')===true,'T3-prep 玩家自驾坦克就位');
ok(G('__t3t.alive')===false&&G('player.alive')===false,'T3a 车毁+玩家随车阵亡 (damage(999) 全链)');
ok(G('__t3.delta')===0,'T3b ★自毁 Δ杀 = 0 (车体排除+自炸死亡链 attacker!==this 不给杀; 若回归则=3)');

// ══ T4 油桶火光跨局残留 (②, 独立 boot 防污染) ══
console.log('T4 油桶火光跨局残留 (换局清账)');
const ctx2=boot(IDXS);
const G2=s=>vm.runInContext(s,ctx2);
{ let e2=null;
try{ G2("document.getElementById('startBtn').onclick();"); }catch(_e){ e2=String(_e&&_e.stack||_e); }
if(!e2){ try{ G2('if(!player.alive||!player.deployed) deployPlayer();'); }catch(_e){ e2='deployPlayer: '+String(_e&&_e.stack||_e); } }
if(e2||!G2('player.alive')){ console.log('  ✘ T4 开局/部署失败 '+(e2||'player.alive=false')); process.exit(1); }
}
G2(`
// 复刻用户路径: 油桶殉爆火池 (addFireSource 与 barrelBlast/Tank.die 同参形制, noWx=1 油桶链)
// ★火源放玩家出生点旁 (相机每帧跟玩家回写, 直接 set camera.position 会被 updateCamera 抹回)
var __f4x=player.pos.x+6, __f4z=player.pos.z+6, __f4y=heightAt(__f4x,__f4z)+1.3;
var __f4=addFireSource(__f4x,__f4z,__f4y,3.3,30,22,null,null,1);
__step(3);                                      // 0.2s 扫描首轮把 fs 候选上槽
var __f4pre={lit:false,srcIn:FIRE_SOURCES.indexOf(__f4)>=0};
for(const it of _fireLightPool){ if(it.light.visible) __f4pre.lit=true; }
`);
ok(G2('__f4pre.srcIn')===true,'T4-prep 火源在 FIRE_SOURCES 活账');
ok(G2('__f4pre.lit')===true,'T4-prep 灯池点亮 (fs 候选上槽, 改前同态)');
G2(`
// 换局: clearMatchEffects 整表清账 (23b; 旧火源对象 ttl 从此冻结>0) + 池/槽三清
clearMatchEffects();
var __f4post={assignClean:true,alive:_fireCandAlive({kind:'fs',src:__f4}),lit:false};
for(let i=0;i<_fireAssign.length;i++){ if(_fireAssign[i]) __f4post.assignClean=false; }
__step(2);
for(const it of _fireLightPool){ if(it.light.visible&&it.light.intensity>0) __f4post.lit=true; }
`);
ok(G2('__f4post.assignClean')===true,'T4b ★清账后分配槽 _fireAssign 全空 (N5: 槽里留旧候选)');
ok(G2('__f4post.alive')===false,'T4c ★旧火源候选判死 (fs 活判据=仍在 FIRE_SOURCES 活账; N4: ttl 冻结>0 判活)');
ok(G2('__f4post.lit')===false,'T4d ★新局灯池零点亮 (上一局火光不复亮 — 用户实报本症状)');
ok(G2('FIRE_SOURCES.length')===0,'T4e FIRE_SOURCES 整表清账回归钉 (23b 既有口径)');

// ══ T5 观战 ESC 重部署页残留 (③, 同 ctx2 链上) ══
console.log('T5 观战模式 ESC → 部署页 →「观 战」回观战');
// ★桩坑 (承 specpose 批): 桩 document.querySelectorAll 返回 [] —— showDeploy/enterSpecView 的
//   "收全部 .screen" 循环在沙箱里空转, 部署页永远收不掉 = 假红。喂含真 #deploy + 假屏的表 (探针桩, 非游戏改动)。
// ★桩坑二 (本批新坑): 桩 mkElement 的 classList 是惰性空实现 (add/remove/contains 全 no-op ⇒ contains 恒
//   false) —— 对 #deploy 的显隐断言全部空转, T5-prep "部署页开着" 是虚绿。给 #deploy 换真 Set 版
//   classList, 起始 'hidden' 对齐 index.html 的 class="screen hidden" 基线 (探针桩, 非游戏改动)。
G2(`
var __dep=document.getElementById('deploy');
{ const __ds=new Set(['hidden']);
  __dep.classList={add(c){__ds.add(c);},remove(c){__ds.delete(c);},contains(c){return __ds.has(c);},toggle(c){ __ds.has(c)?__ds.delete(c):__ds.add(c); return __ds.has(c);}}; }
function __mkScr(){ const s=new Set(['hidden']); return {classList:{add(c){s.add(c);},remove(c){s.delete(c);},contains(c){return s.has(c);}}}; }
var __scrA=__mkScr(), __scrB=__mkScr();   // 真实基线: 屏全隐
document.querySelectorAll=function(sel){ return sel==='.screen'?[__dep,__scrA,__scrB]:[]; };
`);
G2(`
// 自由观战态 (票尽 观战 按钮 / enterSpecView 原路径进场的现场)
player.alive=false; player.spectator=true; player.specView=true; player.specWant=null;
player.deployed=true; tickets[player.team]=0;
showDeploy(true);                               // ESC 丢锁同族呼出部署页 (唯一出口=「观 战」按钮)
var __t5={vis:document.getElementById('deploy').classList.contains('hidden')};
__scrA.classList.remove('hidden');              // 探针计: 亮一扇假屏, 验证快路确实跑了整表循环
enterSpecView();                                // 点「观 战」(deployBtn.onclick 票尽分流同函)
__t5.visAfter=document.getElementById('deploy').classList.contains('hidden');
__t5.scrHidden=__scrA.classList.contains('hidden');
`);
ok(G2('__t5.vis')===false,'T5-prep 部署页开着 (ESC 呼出态)');
ok(G2('__t5.visAfter')===true&&G2('__t5.scrHidden')===true,'T5a ★「观 战」收掉部署页 (残留=N6 静默早退; 用户实报本症状)');
ok(G2('player.specView')===true&&G2('player.spectator')===true,'T5b 观战态保持 (重进不重放入场段, 不跳机位)');
G2(`
// 回归钉: 首入路径 (旧门语义) 不受快路影响 — 清回"死了但未观战"现场再进
player.spectator=false; player.specView=false; player.alive=false; player.specWant=null; tickets[player.team]=0;
showDeploy(true);
__scrA.classList.remove('hidden');
enterSpecView();
var __t5b={sv:player.specView,sp:player.spectator,vis:document.getElementById('deploy').classList.contains('hidden'),scrHidden:__scrA.classList.contains('hidden')};
`);
ok(G2('__t5b.sv')===true&&G2('__t5b.sp')===true,'T5c 首入置旗 (spectator/specView 双真) 回归钉');
ok(G2('__t5b.vis')===true&&G2('__t5b.scrHidden')===true,'T5d 首入收部署页回归钉');

console.log('verify-ffkill-firelight-specesc-20261128: PASS='+PASS.length+' FAIL='+FAILN+(NEG?' (--neg)':''));
process.exit(FAILN?1:0);
