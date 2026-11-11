// ─────────────────────────────────────────────
// dev/verify-judgment-20261101.js —— 判定批 (2026-11-01) 三项修复验证 (不进 Index.html)
// 用法: node dev/verify-judgment-20261101.js
// 背景 (本轮判定面自查, 三项):
//   ① 玩家死亡击杀播报丢爆头标识: 18-game die() 旧硬编码 addKillfeed(attacker,this,false) ——
//      Bot die 链 (14-bots) 传 isHead, 唯独"玩家被爆头击杀"时播报永远不出 ☠。修 = 爆头位透传 (!!isHead)。
//   ② 反坦克雷链爆挂浏览器时钟: mineBlast 邻近链爆用 setTimeout(120~300ms) —— Esc 暂停 / K 时停期间
//      照常到点, 冻结的战场里链爆照样炸人 (与 2026-10-28 丧尸近战 setTimeout→dt 账同族病)。
//      修 = MINE_CHAIN 游戏时钟账, updateMineTriggers(dt) 逐帧消费 (24-main 传世界帧长)。
//   ③ 出生保护"开火即解除"契约漏洞: 清账只挂在 fireBullet, 而 火箭筒 fireRocket / 坦克主炮 fireCannon /
//      反坦克炮 emplATFire / 迫击炮 emplMortarShell 都不走 fireBullet ⇒ 部署落地 2s 保护期内照样开火
//      ("无敌帧内不许输出"漏了直接出膛口; 注释宣称"唯一出膛口"≠实现)。修 = 四处同契约补清账。
// 判据:
//   T1 爆头致死 → 播报首行含 ☠; 普通致死 → 含 ✕ 且不含 ☠ (同一次 die 链为播出源, 直接 damage 触发)。
//   T2 链爆账行为: mineBlast → 3m 内邻近雷入账 MINE_CHAIN; updateMineTriggers(0) 冻结不消费;
//      dt>0 消费后邻近雷 dead; 旧 setTimeout 链串在 15-vehicles 源码中绝迹。
//   T3 四条直接出膛口开火即清 protUntil (fireRocket/emplATFire/emplMortarShell 行为判据 + fireCannon
//      行为判据), fireBullet 原清账仍在 (13-combat 内出现 ≥4 处, 15-vehicles ≥1 处)。
// 载入清单: 运行时解析 index.html 的 script 标签 (2026-09-28 教训: 清单与实载不一致 = 盲区假绿)。
// 沙箱要点同 verify-killattr: 开局后 deployPlayer / 裸全局 CANNON 挂 ctx / 探针全清 protUntil。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const stub=require('./_bootstub.js');
require('./_bootpatch.js').patch(stub.sandbox);
// Obj3.clear 桩补齐 (deployPlayer 的 UI 清理会调; 真 THREE 有 Group.clear)
{const P=Object.getPrototypeOf(stub.THREE.Group.prototype); if(!P.clear) P.clear=function(){ this.children.length=0; };}
// style.setProperty 桩补齐 (22-hud.hudStyle 的 CSSOM 写法)
const _ensureStyle=e=>{ if(e&&e.style&&!e.style.setProperty) e.style.setProperty=(k,v)=>{ e.style[k]=v; }; return e; };
{const doc=stub.document,og=doc.getElementById.bind(doc),oc=doc.createElement.bind(doc);
doc.getElementById=id=>_ensureStyle(og(id));
doc.createElement=t=>_ensureStyle(oc(t));}
// CANNON 桩 (与 verify-killattr 同源): die 链 spawnRagdoll 需要
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

function boot(campIdx){
for(const k in stub.byId)delete stub.byId[k];
const ctx=vm.createContext(Object.assign({},stub.sandbox));
ctx.document=stub.document; ctx.window=stub.window; ctx.CANNON=CANNON;
ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of FILES) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
return ctx;
}
const PASS=[];let FAILN=0;
function ok(cond,label){
if(cond){ PASS.push(label); console.log('  ✔ '+label); }
else { FAILN++; console.log('  ✘ '+label); }
}
const CAMPI=3; // 淞沪 (verify-killattr 同源: 有坦克有步兵)

const ctx=boot(CAMPI);
const G=s=>vm.runInContext(s,ctx);

// ── 开局 + 部署 (verify-killattr 同源) ──
let err0=null;
try{ G("document.getElementById('startBtn').onclick();"); }catch(e){ err0=String(e&&e.stack||e); }
if(!err0){ try{ G('if(!player.alive||!player.deployed) deployPlayer();'); }catch(e){ err0='deployPlayer: '+String(e&&e.stack||e); } }
if(err0||!G('player.alive')){ console.log('  ✘ 开局/部署失败 '+(err0||'player.alive=false')); process.exit(1); }
G('for(const s of soldiers) s.protUntil=0; player.protUntil=0;'); // 出生保护: 免伤会吞掉受击/击杀链, 探针全清
ok(G('soldiers.length')>0&&G('tanks.length')>0,'前置: 战场已开局并部署 (soldiers='+G('soldiers.length')+', tanks='+G('tanks.length')+')');

// ══ T1 玩家死亡播报的爆头位透传 (bug ①) ══
console.log('T1 玩家被爆头击杀 → 播报 ☠; 普通击杀 → ✕ (18-game die → addKillfeed)');
const t1=G(`(function(){
try{
function _pickEnemy(){
for(var i=0;i<soldiers.length;i++){ var s=soldiers[i]; if(s.alive&&!s.isPlayer&&s.team!==player.team&&!s.onVehicle&&!s.spectator) return s; }
return null;
}
function _revive(){ player.alive=true; player.hp=100; player.deathCamT=0; }
function _topFeed(){ var k=document.getElementById('killfeed'); return k.children.length?k.children[0].innerHTML:''; }
var E=_pickEnemy(); if(!E) return {err:'无敌方步兵'};
var out={};
_revive();
player.protUntil=0;
player.damage(999,E,true);                 // 爆头致死
out.headRow=_topFeed(); out.headKills=E.kills;
_revive();
player.protUntil=0;
player.damage(999,E,false);                // 普通致死
out.bodyRow=_topFeed();
return out;
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t1.err){ ok(false,'T1 异常 '+t1.err); }
else{
ok(t1.headRow&&t1.headRow.indexOf('☠')>=0,'T1a 爆头致死播报含 ☠ → "'+(t1.headRow||'').replace(/<[^>]+>/g,'')+'"');
ok(t1.headKills>=1,'T1b 击杀者击杀数入账 (E.kills='+t1.headKills+')');
ok(t1.bodyRow&&t1.bodyRow.indexOf('✕')>=0&&t1.bodyRow.indexOf('☠')<0,'T1c 普通致死播报为 ✕ 不带 ☠');
}

// ══ T2 反坦克雷链爆挂游戏时钟 (bug ②) ══
console.log('T2 链爆账 MINE_CHAIN: dt=0 冻结 / dt>0 消费; 旧 setTimeout 链绝迹');
const t2=G(`(function(){
try{
var out={};
var m0=MINES.length;                        // 淞沪无雷区: 底数为 0 (不扰动真实雷)
var fake=[{x:200,z:200,g0:0,mesh:null,dead:false},
          {x:200.8,z:200.4,g0:0,mesh:null,dead:false},   // 3m 内: 应入账
          {x:220,z:200,g0:0,mesh:null,dead:false}];      // 20m 外: 不入账
for(var i=0;i<fake.length;i++) MINES.push(fake[i]);
mineBlast(MINES[m0]);
out.queued=MINE_CHAIN.length;               // 期望 1 (仅 3m 内的邻近雷)
out.firstDead=MINES[m0].dead;
var drained0=true;
for(var f=0;f<30;f++){ updateMineTriggers(0); if(MINE_CHAIN.length===0){ drained0=false; break; } }   // dt=0: 整列停住
out.frozenStillQueued=(MINE_CHAIN.length===out.queued);
out.frozenTargetAlive=!fake[1].dead;
var guard=0;
while(MINE_CHAIN.length>0&&guard++<200) updateMineTriggers(0.2);   // dt>0: 消费完
out.chainDrained=(MINE_CHAIN.length===0);
out.chainedDead=fake[1].dead;
out.farAlive=!fake[2].dead;
MINES.length=m0;                            // 还原
return out;
}catch(e){ return {err:String(e&&e.stack||e),MINESl:MINES.length}; }
})()`);
if(t2.err){ ok(false,'T2 异常 '+t2.err); }
else{
ok(t2.queued===1,'T2a 链爆只入账 3m 内邻近雷 (queued='+t2.queued+')');
ok(t2.firstDead===true,'T2b 首雷当场引爆');
ok(t2.frozenStillQueued&&t2.frozenTargetAlive,'T2c dt=0 (时停/布势) 链爆账冻结不消费、目标存活');
ok(t2.chainDrained&&t2.chainedDead,'T2d dt>0 消费完 → 邻近雷被链爆');
ok(t2.farAlive===true,'T2e 20m 外的雷不受连锁');
}
{ // 静态: 旧 setTimeout 链在 15-vehicles 源码绝迹
const src15=fs.readFileSync(path.join(root,'js/15-vehicles.js'),'utf8');
ok(src15.indexOf('setTimeout(()=>{ if(!n2.dead) mineBlast')<0,'T2f 旧 setTimeout 链爆串已绝迹 (15-vehicles)');
ok(src15.indexOf('MINE_CHAIN.push({m:n2')>=0,'T2g 新链爆账入队点在位 (mineBlast)');
ok(src15.indexOf('updateMineTriggers(dt)')>=0,'T2h 主循环按世界帧长传参 (24-main)');
}

// ══ T3 直接出膛口的出生保护清账 (bug ③) ══
console.log('T3 开火即解除出生保护: fireRocket / emplATFire / emplMortarShell / fireCannon');
const t3=G(`(function(){
try{
var out={};
// T3a 火箭筒: 不走 fireBullet 的直接出膛口
var sh1={protUntil:nowT+5,team:player.team,_src:'',lastFiredT:-9,isPlayer:false,name:'火箭手'};
var s0=shells.length;
fireRocket(sh1,V3(player.pos.x,player.pos.y+1.5,player.pos.z),V3(0.3,0,0.95).normalize(),{atDmg:320,name:'测试火箭'},null);
out.rocketCleared=!sh1.protUntil;
out.rocketShell=(shells.length===s0+1);
if(shells.length>s0) shells.pop();
// T3b 反坦克炮
var sh2={protUntil:nowT+5,team:player.team,_src:'',lastFiredT:-9,isPlayer:false};
var s1=shells.length;
emplATFire({x:player.pos.x,y:player.pos.y+1,z:player.pos.z,cd:0},sh2,V3(0,0,1));
out.atCleared=!sh2.protUntil;
out.atShell=(shells.length===s1+1);
if(shells.length>s1) shells.pop();
// T3c 迫击炮 (弹体进 nades)
var sh3={protUntil:nowT+5,team:player.team,_src:'',lastFiredT:-9,isPlayer:false};
var n0=nades.length;
emplMortarShell({x:player.pos.x,y:player.pos.y+1,z:player.pos.z},sh3,player.pos.x+30,player.pos.z+30);
out.mortarCleared=!sh3.protUntil;
out.mortarNade=(nades.length===n0+1);
if(nades.length>n0){ var nn=nades.pop(); if(nn&&nn.m) scene.remove(nn.m); }
// T3d 坦克主炮 (真 Tank 实例: AI 车 crewBot 为射手)
var tk=null;
for(var i=0;i<tanks.length;i++){ if(tanks[i].alive&&!tanks[i].playerDriven&&tanks[i].crewBot){ tk=tanks[i]; break; } }
if(!tk) return {err:'无可用 AI 坦克',a:out};
var s2=shells.length;
tk.crewBot.protUntil=nowT+5;
tk.cannonCd=0;
tk.fireCannon();
out.cannonCleared=!tk.crewBot.protUntil;
out.cannonShell=(shells.length===s2+1);
if(shells.length>s2) shells.pop();
return out;
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t3.err){ ok(false,'T3 异常 '+t3.err); }
else{
ok(t3.rocketCleared&&t3.rocketShell,'T3a fireRocket 开火即清保护 + 弹体入膛');
ok(t3.atCleared&&t3.atShell,'T3b emplATFire 开火即清保护 + 弹体入膛');
ok(t3.mortarCleared&&t3.mortarNade,'T3c emplMortarShell 开火即清保护 + 弹体入膛');
ok(t3.cannonCleared&&t3.cannonShell,'T3d 坦克 fireCannon 开火即清保护 (crewBot) + 弹体入膛');
}
{ // 静态: fireBullet 原清账仍在, 四处新清账同契约在位
const src13=fs.readFileSync(path.join(root,'js/13-combat.js'),'utf8');
const cnt=(src13.match(/if\(shooter&&shooter\.protUntil\) shooter\.protUntil=0;/g)||[]).length;
ok(cnt>=4,'T3e 13-combat 清账出现 '+cnt+' 处 (fireBullet 原有 + 火箭/AT炮/迫击炮 三处新增)');
const src15=fs.readFileSync(path.join(root,'js/15-vehicles.js'),'utf8');
ok((src15.match(/shooter\.protUntil=0/g)||[]).length>=1,'T3f 15-vehicles 坦克主炮清账在位');
}

console.log('\n──── 判定批 2026-11-01: '+PASS.length+' 通过 / '+FAILN+' 失败 ────');
process.exit(FAILN?1:0);
