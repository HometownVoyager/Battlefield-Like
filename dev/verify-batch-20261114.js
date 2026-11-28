// ─────────────────────────────────────────────
// dev/verify-batch-20261114.js —— 票数×冻结世界AI行动×音频冻结账×兵力票池四项批 (2026-11-14)
// 用法: node dev/verify-batch-20261114.js [--neg]
// 四项:
//   ①飞机票数 (用户裁定, AskUserQuestion 未应答按"改为3"唯一变化口径落地):
//     有人战机整体占 TICKET_COST.plane(3) 票 = 机体 (plane-1) 2 + 驾驶员 1 (Bot.die 既有 -1);
//     空机 (含飞行员先跳伞) 照旧整机 3; 跳伞驾驶员单独阵亡照常 -1 (全寿命上限仍 4)。
//     旧账 = 机体 3 + 驾驶员 1 = 4 票/架。TICKET_COST.plane 常量不动 (勿硬编码 3, aircollide 批纪律)。
//     ★20261128b 批C裁定: 统一4票取代20261114口径 —— 玩家驾机/AI 有人机死亡总账一律 4 票 (机体整收
//     plane(3) + 驾驶员各自既有 -1, 与玩家驾机死亡同账); 本文件 T1a/A1/N1 已按判据跟走改钉统一口径。
//   ②冻结世界 AI 不得行动 (用户实报"时停中残血坦克乘员主动下车"):
//     ②a 坦克乘员起火弃车加 dt>0 门 (14-bots; 乘员 Bot 走 onVehicle 旁路每帧都进 update, 旧判定不吃 dt
//         ⇒ 时停里照常弃车; 现在 dt=0 只挂 burning 账不动人, 解冻后第一帧照常弃车);
//     ②b 飞行员 <32% 跳伞同族: takeDmg 里时停只挂 _bailPend, 解冻后 update(dt>0) 消费 _bailCrew 单源
//         (跳伞块从 takeDmg 内联抽出; respawn 复位 _bailPend; 死亡链不走此门照常)。
//   ③音频冻结账升级 (用户实报"时停时暂停, 引擎声照常轰鸣, 是一系列系统性BUG"):
//     24-main 喂入从 specTimeFrozen() 改权威世界冻结账 (rdt>0&&dt<=0)∨暂停∨结算∨菜单。
//     旧口径两洞: ①暂停洞 —— specTimeActive() 要求 !gamePaused ⇒ 暂停期喂入恒 false,
//     setTimeFrozenMute(false) 把引擎增益恢复 lastVol (先时停再暂停 = 照常轰鸣);
//     ②布势洞 —— cmdDtGate 布势冻结回 0 从没进过音频账。
//   ④兵力票池倍率选择加回大厅 (旧版主菜单 hmulBtn 行随菜单改版被删, 机制单源一直在):
//     index.html #hubHmulSeg ×0.5/×1/×2 + 22-hud 接线写 sf_hmul; startGame 开局读档 (83/165/330)。
// 判据: T1 票数 (有人机 die Δ票=TICKET_COST.plane+1★20261128b 统一4票 / 空机 Δ照旧★ / 驾驶员确实阵亡);
//   T2 坦克乘员 (时停冻结 10 帧仍在车上★ / 解冻 8 帧内弃车 / 无时停对照照常弃车);
//   T3 飞行员跳伞 (时停里挂账不跳★ / 冻结帧账不动 / 解冻 3 帧内补跳 / 无时停对照立即跳);
//   T4 音频冻结账 (时停转静音★ / 稳态零写入 / 时停+暂停不再恢复轰鸣★ / 暂停解除仍静 / 解冻还原
//     lastVol / 布势冻结转静音★ / 布势解除还原);
//   T5 兵力票池 (index.html 段控件锚 / 22-hud 接线锚 / sf_hmul 0.5/1/缺省 → 83/165/330 端到端);
//   T6 源码防回退锚 (A1~A5 与 NEG 补丁一一对应)。
//   --neg: 五补丁累积注入, 判据必须转红 (红名↔补丁对认: N1→T1a+A1 红; N2→T2 时停判据+A2 红;
//     N3→T3 挂账判据+A3 红; N4→T4 暂停/布势判据+A4 红; N5→T5b+A5 红; 其余判据在 NEG 下照绿)。
// 沙箱要点承 verify-specneut-20261113 (boot/SRC/PATCH_MAP/真开局+deployPlayer/protUntil 清账);
//   受控时钟直驱 loop() 承 verify-nightgear-20261105 (__T+=16.7; loop(); —— 时停/喂入账只在主循环生效);
//   观战时停入口承 verify-timestophud-20261108 (player.spectator=true + specTimeToggle)。
//   ★G 串内探针全局一律裸名隐式全局 (与游戏 function/var 同一真全局; globalThis 前缀与裸名混读不可靠)。
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
Box:class{},Sphere:class{},Material:class{},ContactMaterial:class{},NaiveBroadphase:class{},PointToPointConstraint:class{},
};})();

const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const FILES=[...html.matchAll(/src="(js\/[^"?]+)/g)].map(m=>m[1]);
console.log('载入清单: 解析 index.html 得 '+FILES.length+' 个脚本');

// ── NEG 阴性对照: 五补丁累积注入 (正常跑不启用) ──
const NEG=process.argv.includes('--neg');
const SRC={},PATCH_MAP={};
const NEG_PATCHES=[
// N1 ①拆: 有人机回 20261114 折让账 (机体2+驾驶员1=3票) ★20261128b 批C裁定: 统一4票取代20261114口径: T1a+A1 红
//   (两段链式: 折让式引用的 hadCrew 已随统一口径退场, 先在 crewBot 判定行前重挂声明再还原折让算式)
['js/16-aircraft.js','if(this.crewBot){','if(this.crewBot){ var hadCrew=!!this.crewBot;'],
['js/16-aircraft.js','tickets[this.team]=Math.max(0,tickets[this.team]-TICKET_COST.plane);','tickets[this.team]=Math.max(0,tickets[this.team]-(hadCrew?TICKET_COST.plane-1:TICKET_COST.plane));'],
// N2 ②a拆: 弃车 dt 门摘 (时停里照常下车): T2 时停判据+A2 红
['js/14-bots.js',"if(v.burning&&v.kind==='tank'&&dt>0){","if(v.burning&&v.kind==='tank'){"],
// N3 ②b拆: 跳伞挂账摘 (时停里立即跳): T3 挂账判据+A3 红
['js/16-aircraft.js','if(typeof specTimeFrozen===\'function\'&&specTimeFrozen()) this._bailPend=true;','if(false) this._bailPend=true;'],
// N4 ③拆: 喂入回旧口径 (只认 specTimeFrozen): T4 暂停/布势判据+A4 红
['js/24-main.js','AudioSys.setTimeFrozenMute((rdt>0&&dt<=0)||gamePaused||matchOver||menuHold);','AudioSys.setTimeFrozenMute(typeof specTimeFrozen===\'function\'&&specTimeFrozen());'],
// N5 ④拆: 大厅接线摘 (选择器死UI): T5b+A5 红
['js/22-hud.js','const hmulButtons=document.querySelectorAll(\'#hubHmulSeg button\');','const hmulButtons=document.querySelectorAll(\'#hubHmulSegX button\');'],
];
if(NEG) for(const [f,from,to] of NEG_PATCHES){
if(SRC[f]===undefined) SRC[f]=fs.readFileSync(path.join(root,f),'utf8');
if(SRC[f].indexOf(from)<0){ console.log('✗ NEG 锚缺失: '+f+' :: '+from); process.exit(1); }
PATCH_MAP[f]=(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC[f]).split(from).join(to);
}
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:fs.readFileSync(path.join(root,f),'utf8'));
const rawOf=f=>fs.readFileSync(path.join(root,f),'utf8');

function boot(campIdx,store){
for(const k in stub.byId)delete stub.byId[k];
const ctx=vm.createContext(Object.assign({},stub.sandbox));
ctx.document=stub.document; ctx.window=stub.window; ctx.CANNON=CANNON;
ctx.localStorage={_s:Object.assign({sf_campaign:String(campIdx)},store||{}),getItem(k){return (k in this._s)?this._s[k]:null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
ctx.__T=1000;
ctx.performance={now:()=>ctx.__T};
for(const f of FILES) vm.runInContext(srcOf(f),ctx,{filename:f});
vm.runInContext('var __step=(n)=>{ for(let i=0;i<n;i++){ __T+=16.7; loop(); } };',ctx);
return ctx;
}
const PASS=[];let FAILN=0;
function ok(cond,label){
if(cond){ PASS.push(label); console.log('  ✔ '+label); }
else { FAILN++; console.log('  ✘ '+label); }
}

// ═════ 前置: 真开局 + 部署 + 清出生保护 ═════
const ctx=boot(3);
const G=s=>vm.runInContext(s,ctx);
let err0=null;
try{ G("document.getElementById('startBtn').onclick();"); }catch(e){ err0=String(e&&e.stack||e); }
if(!err0){ try{ G('if(!player.alive||!player.deployed) deployPlayer();'); }catch(e){ err0='deployPlayer: '+String(e&&e.stack||e); } }
if(err0||!G('player.alive')){ console.log('  ✘ 开局/部署失败 '+(err0||'player.alive=false')); process.exit(1); }
G('for(const s of soldiers) s.protUntil=0; player.protUntil=0;');
ok(G('soldiers.length')>0,'前置: 战场已开局并部署 (soldiers='+G('soldiers.length')+', tanks='+G('tanks.length')+', planes='+G('planes.length')+')');

// ═════ T1 ①飞机票数: 有人机整体 3 票 ═════
console.log('T1 ① 飞机票数 (★20261128b 批C裁定统一4票: 有人机 = 机体 plane(3) + 驾驶员 1, 与玩家驾机同账; 空机照旧整机 3)');
{
const r=G(`
(function(){
var out={};
var _B=null; for(var i=0;i<soldiers.length;i++){ var s=soldiers[i]; if(s.alive&&!s.isPlayer&&!s.onVehicle&&!s.spectator){ _B=s; break; } }
out.gotBot=!!_B;
out.planeCost=TICKET_COST.plane;
// T1a 有人机: 造一架带驾驶员的 (变体 0), 直接 die(null) 走全链 (残骸交接+乘员死亡链)
var _P=new Plane(0); planes.push(_P); _P.respawn(); _P.crewBot=_B; _B.onVehicle=_P; _P.playerDriven=false;
var _t0=tickets[0];
_P.die(null);
out.crewedDelta=_t0-tickets[0];
out.pilotDead=!!_B&&!_B.alive;
// T1b 空机: 无 crewBot, Δ 照旧整机
var _P2=new Plane(0); planes.push(_P2); _P2.respawn();
var _t1=tickets[0];
_P2.die(null);
out.emptyDelta=_t1-tickets[0];
return out;
})()
`);
ok(r&&r.gotBot&&r.planeCost===3,'前置: 拿到自由 Bot 且 TICKET_COST.plane===3 (单源, 不硬编码)');
ok(r&&r.crewedDelta===TICKET_COST_PLANE_SAFE(r)+1,'T1a 有人机 die Δ票 = '+r.crewedDelta+' (期望 = TICKET_COST.plane+1='+(r.planeCost+1)+' = 机体3+驾驶员1 ★20261128b 批C裁定: 统一4票取代20261114口径; 与玩家驾机死亡同账)');
ok(r&&r.pilotDead,'T1a 驾驶员随 die 链确实阵亡 (Bot.die -1 照常)');
ok(r&&r.emptyDelta===r.planeCost,'T1b 空机 die Δ票 = '+r.emptyDelta+' (期望 = TICKET_COST.plane, 照旧不变)');
}
function TICKET_COST_PLANE_SAFE(r){ return r.planeCost; }

// ═════ T2 ②a 坦克乘员起火弃车: 冻结世界不动人 ═════
console.log('T2 ②a 坦克乘员起火弃车 (dt>0 门: 时停冻结不弃车, 解冻第一帧照常弃车)');
{
const r=G(`
(function(){
var out={};
var _tk=null; for(var i=0;i<tanks.length;i++){ if(tanks[i].alive&&!tanks[i].crewBot){ _tk=tanks[i]; break; } }
if(!_tk){ for(var j=0;j<tanks.length;j++){ if(tanks[j].alive){ _tk=tanks[j]; break; } } }
var _cb=null; for(var k=0;k<soldiers.length;k++){ var s=soldiers[k]; if(s.alive&&!s.isPlayer&&!s.onVehicle&&!s.spectator){ _cb=s; break; } }
var _atk=null; for(var m=0;m<soldiers.length;m++){ var s2=soldiers[m]; if(s2.alive&&!s2.isPlayer&&s2!==_cb&&!s2.onVehicle&&!s2.spectator){ _atk=s2; break; } }
out.gotTank=!!_tk; out.gotBot=!!_cb; out.gotAtk=!!_atk;
if(!_tk||!_cb||!_atk) return out;
globalThis._tk2=_tk; globalThis._cb2=_cb; globalThis._atk2=_atk;
_cb.onVehicle=_tk; _tk.crewBot=_cb; _cb.pos.copy(_tk.pos);
player.spectator=true; player.alive=true;
specTimeReset(); var _on=specTimeToggle();   // 开时停
out.frozenOn=!!_on&&specTimeFrozen()===true;
__step(3);                                    // 消费 tickAcc 残余 (冻结帧)
vehBurnIgnite(_tk,_atk);
out.ignited=_tk.burning===true;
__step(10);                                   // 冻结世界跑 10 帧
out.stillMountedDuringFreeze=(_cb.onVehicle===_tk)&&(_tk.crewBot===_cb);
specTimeToggle();                             // 关时停
__step(8);
out.dismountAfterUnfreeze=(_cb.onVehicle===null)||(_tk.crewBot!==_cb);
// 对照: 无时停 (正常世界) 照常弃车 —— 换一辆车 + 换一个 Bot
var _tk3=null; for(var n=0;n<tanks.length;n++){ if(tanks[n].alive&&tanks[n]!==_tk&&tanks[n].burning!==true){ _tk3=tanks[n]; break; } }
var _cb3=null; for(var q=0;q<soldiers.length;q++){ var s3=soldiers[q]; if(s3.alive&&!s3.isPlayer&&s3!==_cb&&!s3.onVehicle&&!s3.spectator){ _cb3=s3; break; } }
out.gotCtrl=!!_tk3&&!!_cb3;
if(_tk3&&_cb3){
_cb3.onVehicle=_tk3; _tk3.crewBot=_cb3; _cb3.pos.copy(_tk3.pos);
vehBurnIgnite(_tk3,_atk);
__step(6);
out.ctrlDismount=(_cb3.onVehicle===null)||(_tk3.crewBot!==_cb3);
}
player.spectator=false;
return out;
})()
`);
ok(r&&r.gotTank&&r.gotBot&&r.gotAtk,'前置: 拿到坦克/乘员/攻击者 Bot');
ok(r&&r.frozenOn,'前置: 观战时停已开 (specTimeFrozen)');
ok(r&&r.ignited,'前置: vehBurnIgnite 点燃 (burning=true)');
ok(r&&r.stillMountedDuringFreeze,'T2a 冻结 10 帧乘员仍在车上 (onVehicle 保持; 旧账此处已弃车)');
ok(r&&r.dismountAfterUnfreeze,'T2b 解冻 8 帧内照常弃车 (dt>0 门放行)');
ok(r&&(!r.gotCtrl||r.ctrlDismount),'T2c 对照: 无时停正常世界照常弃车 (dt 门不破坏既有行为)');
}

// ═════ T3 ②b 飞行员跳伞挂账: 时停里不跳, 解冻补跳 ═════
console.log('T3 ②b 飞行员 <32% 跳伞 (时停挂 _bailPend, 解冻 update(dt>0) 消费 _bailCrew 单源)');
{
const r=G(`
(function(){
var out={};
var _P=null; for(var i=0;i<planes.length;i++){ if(planes[i].alive){ _P=planes[i]; break; } }
if(!_P){ _P=new Plane(0); planes.push(_P); _P.respawn(); }
var _B=null; for(var k=0;k<soldiers.length;k++){ var s=soldiers[k]; if(s.alive&&!s.isPlayer&&!s.onVehicle&&!s.spectator&&!s.chuting){ _B=s; break; } }
var _atk=null; for(var m=0;m<soldiers.length;m++){ var s2=soldiers[m]; if(s2.alive&&!s2.isPlayer&&s2!==_B&&!s2.onVehicle&&!s2.spectator){ _atk=s2; break; } }
out.gotPlane=!!_P; out.gotBot=!!_B; out.gotAtk=!!_atk;
if(!_P||!_B||!_atk) return out;
globalThis._P3=_P; globalThis._B3=_B;
_P.respawn(); _P.playerDriven=false; _P.aiPilotOn=false; _P.crewBot=_B; _B.onVehicle=_P;
player.spectator=true; player.alive=true;
specTimeReset(); var _on=specTimeToggle();
out.frozenOn=!!_on&&specTimeFrozen()===true;
_P.hp=_P.maxHp*0.3;
_P.takeDmg(4,_atk);
out.pendSet=_P._bailPend===true&&_P.crewBot===_B&&_B.chuting!==true;
__step(3);
out.pendStaysFrozen=_P._bailPend===true&&_P.crewBot===_B;
specTimeToggle();
__step(3);
out.bailedAfterUnfreeze=(_P.crewBot===null)&&(_B.chuting===true)&&(_P._bailPend===false);
// 对照: 无时停立即跳
var _P4=null; for(var n=0;n<planes.length;n++){ if(planes[n].alive&&planes[n]!==_P&&planes[n]._bailPend!==true){ _P4=planes[n]; break; } }
var _B4=null; for(var q=0;q<soldiers.length;q++){ var s3=soldiers[q]; if(s3.alive&&!s3.isPlayer&&s3!==_B&&!s3.onVehicle&&!s3.spectator&&!s3.chuting){ _B4=s3; break; } }
out.gotCtrl=!!_P4&&!!_B4;
if(_P4&&_B4){
_P4.respawn(); _P4.playerDriven=false; _P4.aiPilotOn=false; _P4.crewBot=_B4; _B4.onVehicle=_P4;
_P4.hp=_P4.maxHp*0.3;
_P4.takeDmg(4,_atk);
out.ctrlImmediateBail=(_P4.crewBot===null)&&(_B4.chuting===true);
}
player.spectator=false;
return out;
})()
`);
ok(r&&r.gotPlane&&r.gotBot&&r.gotAtk,'前置: 拿到飞机/机组 Bot/攻击者 Bot');
ok(r&&r.frozenOn,'前置: 观战时停已开');
ok(r&&r.pendSet,'T3a 时停里 takeDmg(<32%) 只挂账不跳 (_bailPend=true, crewBot 仍在, 未开伞)');
ok(r&&r.pendStaysFrozen,'T3b 冻结帧账不动 (不消费不跳伞)');
ok(r&&r.bailedAfterUnfreeze,'T3c 解冻 3 帧内补跳 (crewBot 摘除 + 开伞 + 账清)');
ok(r&&(!r.gotCtrl||r.ctrlImmediateBail),'T3d 对照: 无时停照旧立即跳 (挂账不破坏既有行为)');
}

// ═════ T4 ③音频冻结账: 时停+暂停不再轰鸣 ═════
console.log('T4 ③ 24-main 权威冻结账 → setTimeFrozenMute (时停/暂停/布势三态引擎增益写入序列)');
{
const r=G(`
(function(){
var out={};
player.spectator=true; player.alive=true;
var _e=AudioSys.createEngine('tank'); _e.update(60,0.2);
out.lastVol=_e.lastVol;
var _ag=[]; var _gp=_e.nodes.g.gain; var _os=_gp.setTargetAtTime.bind(_gp);
_gp.setTargetAtTime=function(f,t,s){ _ag.push(f); _os(f,t,s); };
globalThis._ag=_ag;
specTimeReset(); __step(5);
out.normalQuiet=_ag.length===0;                       // 常速: 无喂入翻转 ⇒ 我这台引擎零写入
specTimeToggle(); __step(2);                          // 开时停: 喂入翻转 → 过渡写 0
out.freezeMute=_ag.length>=1&&_ag[_ag.length-1]===0;
var _n1=_ag.length; __step(10);
out.steadyNoWrite=_ag.length===_n1;                   // 稳态零写入 (状态账不变不写)
gamePaused=true; __step(5);
out.pauseStaysMuted=_ag.length===_n1&&_ag[_ag.length-1]===0;   // ★暂停洞: 旧账此处恢复 lastVol
gamePaused=false; __step(3);
out.unpauseStaysMuted=_ag.length===_n1&&_ag[_ag.length-1]===0;
specTimeToggle(); __step(2);                          // 关时停: 还原 lastVol
out.unfreezeRestore=_ag.length===_n1+1&&_ag[_ag.length-1]===_e.lastVol;
var _odg=cmdDtGate; cmdDtGate=function(r,d){return 0;}; __step(3);   // 布势/K冻结等价: dt=0
out.cmdFreezeMute=_ag.length===_n1+2&&_ag[_ag.length-1]===0;
cmdDtGate=_odg; __step(3);
out.cmdUnfreezeRestore=_ag.length===_n1+3&&_ag[_ag.length-1]===_e.lastVol;
// 真布势门: CMD.mapOn&&mapDeploy ⇒ cmdDtGate 回 0 (纯函数断言, 不进 cmdMapTick)
CMD.mapOn=true; CMD.mapDeploy=true;
out.realCmdGateZero=cmdDtGate(0.016,0.016)===0;
CMD.mapOn=false; CMD.mapDeploy=false;
player.spectator=false;
return out;
})()
`);
ok(r&&r.lastVol===0.2,'前置: 引擎节点已建, lastVol=0.2');
ok(r&&r.normalQuiet,'T4a 常速零翻转零写入');
ok(r&&r.freezeMute,'T4b 时停开启: 喂入翻转 → 引擎增益过渡写 0 (静音)');
ok(r&&r.steadyNoWrite,'T4c 稳态零 WebAudio 写入 (状态账)');
ok(r&&r.pauseStaysMuted,'T4d ★时停+暂停: 引擎保持静音 (旧账此处恢复 lastVol=照常轰鸣)');
ok(r&&r.unpauseStaysMuted,'T4e 暂停解除 (时停仍开): 仍静音');
ok(r&&r.unfreezeRestore,'T4f 时停关闭: 按 lastVol 还原');
ok(r&&r.cmdFreezeMute,'T4g ★布势冻结 (dt=0): 引擎转静音 (旧账此态从没进过音频账)');
ok(r&&r.cmdUnfreezeRestore,'T4h 布势解除: 还原 lastVol');
ok(r&&r.realCmdGateZero,'T4i 真布势门: CMD.mapOn&&mapDeploy ⇒ cmdDtGate 回 0 (权威账的 dt 来源)');
}

// ═════ T5 ④兵力票池倍率: 大厅段控件 + 开局读档 ═════
console.log('T5 ④ 兵力票池倍率 (index.html #hubHmulSeg + 22-hud 接线 + startGame 读 sf_hmul)');
{
const sIdx=rawOf('index.html');
ok(sIdx.includes('id="hubHmulSeg"')&&sIdx.includes('data-h="0.5"')&&sIdx.includes('data-h="1"')&&sIdx.includes('data-h="2"'),
'T5a index.html: 大厅兵力票池段控件就位 (×0.5/×1/×2)');
ok(sIdx.indexOf('hubHmulSeg')<sIdx.indexOf('hubDiffSeg'),'T5a-2 段控件位于战场规模与战斗难度之间 (规模行之后)');
const s22=rawOf('js/22-hud.js');
ok(s22.includes("querySelectorAll('#hubHmulSeg button')")&&s22.includes("sf_hmul"),
'T5b 22-hud: 大厅接线就位 (读按钮+写 sf_hmul)');
const cases=[['0.5',null],['1',null],[null,null]];
for(const [hm] of cases){
const store=hm?{sf_hmul:hm}:{};
const c2=boot(1,store);   // 斯大林格勒 (conquest 对称票): 攻势图 startMatch 会对守方票 ×1.25, 不能当倍率判据
vm.runInContext("document.getElementById('startBtn').onclick();",c2);
const exp=vm.runInContext('Math.round(START_TICKETS*(parseFloat('+(hm?"'"+hm+"'":'null')+")||2)/2)",c2);
const t0=vm.runInContext('tickets[0]',c2), t1=vm.runInContext('tickets[1]',c2);
ok(t0===exp&&t1===exp,'T5c 开局票池 sf_hmul='+(hm||'缺省')+' ⇒ 双方 '+t0+' 票 (期望 '+exp+' = Math.round(START_TICKETS×'+(hm||2)+'/2))');
}
}

// ═════ T6 源码防回退锚 (与 NEG 补丁一一对应) ═════
console.log('T6 源码防回退锚 (A1~A5 ↔ N1~N5)');
ok(srcOf('js/16-aircraft.js').includes('tickets[this.team]-TICKET_COST.plane);')&&!srcOf('js/16-aircraft.js').includes('hadCrew?TICKET_COST.plane-1'),'A1 有人机机体账整收算式在/折让已退场 (↔N1) ★20261128b 批C裁定: 统一4票取代20261114口径');
ok(srcOf('js/14-bots.js').includes("if(v.burning&&v.kind==='tank'&&dt>0){"),'A2 弃车 dt>0 门在 (↔N2)');
ok(srcOf('js/16-aircraft.js').includes("if(typeof specTimeFrozen==='function'&&specTimeFrozen()) this._bailPend=true;"),'A3 跳伞挂账门在 (↔N3)');
ok(srcOf('js/24-main.js').includes('AudioSys.setTimeFrozenMute((rdt>0&&dt<=0)||gamePaused||matchOver||menuHold);'),'A4 权威冻结账喂入在 (↔N4)');
ok(srcOf('js/22-hud.js').includes("querySelectorAll('#hubHmulSeg button')"),'A5 大厅兵力票池接线在 (↔N5)');

// ═════ 收尾 ═════
console.log('');
console.log('══════════════════════════════════════');
console.log((FAILN===0?'✅ 全过 ':('❌ '+FAILN+' 红 '))+'· 过 '+PASS.length+' 条'+(NEG?' (NEG 阴性对照: 期望红名=N1~N5 对应判据)':''));
if(FAILN>0) process.exit(1);
