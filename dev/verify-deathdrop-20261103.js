// ─────────────────────────────────────────────
// dev/verify-deathdrop-20261103.js —— 死亡掉落手中雷 + 引信继承读条 (2026-11-03 用户裁定)
// 用法: node dev/verify-deathdrop-20261103.js [--neg]
// 裁定原文: "死亡时手里捏的雷要'掉落在原地'，并继承读条时间"。
// 落地面 (承《排查-射手死亡与在飞弹体-2026-11-03.md》的遗留口径: 手里雷/举雷读条中死亡=唯一真"消失"):
//   ① dropHeldNade 单源 (13-combat): 死亡瞬间手里那颗就地脱手 —— 胸口微抖 + 小抛落, throwNade 同链
//      (弹种/归属/队伍/击杀账与出手件一致, 死者照记击杀);
//   ② 引信继承读条: 玩家普通雷带 nadeFuse **余值** (举起即烧的厨雷账, 烧到 0=已武装 ⇒ 掉地即炸);
//      烟雾/燃烧/反坦克无厨雷账 (nadeFuse=99 哨兵) ⇒ 掉落带各自标准引信, **绝不把哨兵带出去** (否则哑弹);
//   ③ 玩家两态都算"捏着": 持雷 (nadeHeld) + 出手弧 (松手后 VM 仍 'nade'、出手帧未到 —— updateViewModel
//      随 alive 停摆, 死后弧永不走出手帧); 掉落后把 VM 'nade' 态收回 idle, 死后残留弧不得再走出手 (防双雷);
//   ④ Bot 前摇 (state 'nade'/'atnade', nadeAnimT 0.8→0) 按剩余比继承: 越接近出手被杀, 尸体上的雷越烫;
//   ⑤ 受创>25 打断不掉 (人没死雷收回, 2026-10-25 打断网口径不动); 丧尸尸变早退不掉; 载具内不掉。
// 判据 (全部真死亡链 damage(9999)→die, 弹体按引用追踪, 只步进 updateNades):
//   T1 玩家持雷半程厨雷 (nadeFuse=2.0) → 掉落引信**精确等于 2.0** (继承判据核心) + 落地引爆;
//   T2 玩家持雷全熟 (nadeFuse=0, 已武装) → 掉落引信 0, 触地即炸;
//   T3 玩家持烟雾 (nadeFuse=99 哨兵) → 掉落引信=标准 1.8 (★哨兵不带走, 否则永不武装=哑弹);
//   T4 玩家出手弧中阵亡 → 照样掉落 + VM 'nade' 态收回 idle (死后不出手, 防复活双雷);
//   T5 Bot 前摇 nadeAnimT=0.2 (剩 25%) → 掉落引信 = 3.4×0.25 = 0.85 (比例继承);
//   T6 Bot 反坦克雷前摇 → 掉落即武装 (表外弹种, 触地即炸);
//   T7 对照: 玩家/Bot 死时手里没雷 ⇒ 零掉落 (不掉雷的死亡不得凭空生出弹体)。
//   --neg: 五补丁累积注入 (玩家钩拆/弹种继承断/哨兵带走病/比例断/Bot 钩拆), 同批判据必须转红。
// 沙箱要点承 verify-deathflight-20261103 (deployPlayer / protUntil 清账 / CANNON 桩 / 子系统步进 / 引用追踪)。
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
// Q1 玩家普通雷引信继承被拆 (改发全长 3.8): T1/T2/T4 的引信继承判据转红
['js/13-combat.js','throwNade(u,o,v,Math.max(0,u.nadeFuse||0));','throwNade(u,o,v,3.8);'],
// Q2 Bot 前摇比例继承被拆 (改发全长): T5 引信判据转红
['js/13-combat.js','throwNade(u,o,v,3.4*rem);','throwNade(u,o,v,3.4);'],
// Q3 哨兵带走病 (烟雾把 nadeFuse=99 哨兵带出去 ⇒ 永不武装=哑弹): T3 引信+最终离账双红
['js/13-combat.js','throwNade(u,o,v,1.8,false,true);','throwNade(u,o,v,u.nadeFuse,false,true);'],
// Q4a2 玩家打断点掉雷拆掉 (持雷+致命主路径): T1/T2/T3 红
['js/18-game.js','if(this.hp<=0&&this.nadeHeld) dropHeldNade(this);',''],
// Q4a 玩家 die() 掉雷钩整拆 (出手弧/≤25 致命兜底路径): T4 红
['js/18-game.js','if(this.nadeHeld||((typeof VM!==\'undefined\')&&VM&&VM.state===\'nade\'&&(this.nadeThrowT||0)<=0)){','if(false){'],
// Q4b Bot 打断点掉雷拆掉: T5/T6 红
['js/14-bots.js','if(this.hp<=0) dropHeldNade(this); ',''],
];
if(NEG) for(const [f,from,to] of NEG_PATCHES){
if(SRC[f]===undefined) SRC[f]=fs.readFileSync(path.join(root,f),'utf8');
if(SRC[f].indexOf(from)<0){ console.log('✗ NEG 锚缺失: '+f+' :: '+from); process.exit(1); }
PATCH_MAP[f]=(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC[f]).split(from).join(to);
}
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:fs.readFileSync(path.join(root,f),'utf8'));

function boot(campIdx){
for(const k in stub.byId)delete stub.byId[k];
const ctx=vm.createContext(Object.assign({},stub.sandbox));
ctx.document=stub.document; ctx.window=stub.window; ctx.CANNON=CANNON;
ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of FILES) vm.runInContext(srcOf(f),ctx,{filename:f});
return ctx;
}
const PASS=[];let FAILN=0;
function ok(cond,label){
if(cond){ PASS.push(label); console.log('  ✔ '+label); }
else { FAILN++; console.log('  ✘ '+label); }
}
const CAMPI=3; // 淞沪 (deathflight 同源)

const ctx=boot(CAMPI);
const G=s=>vm.runInContext(s,ctx);

let err0=null;
try{ G("document.getElementById('startBtn').onclick();"); }catch(e){ err0=String(e&&e.stack||e); }
if(!err0){ try{ G('if(!player.alive||!player.deployed) deployPlayer();'); }catch(e){ err0='deployPlayer: '+String(e&&e.stack||e); } }
if(err0||!G('player.alive')){ console.log('  ✘ 开局/部署失败 '+(err0||'player.alive=false')); process.exit(1); }
G('for(const s of soldiers) s.protUntil=0; player.protUntil=0;');
ok(G('soldiers.length')>0,'前置: 战场已开局并部署 (soldiers='+G('soldiers.length')+', player.alive='+G('player.alive')+')');

// ── 公用 vm 片段 ──
G(`
function _isLand(x,z){ return heightAt(x,z)>waterYAt(x,z)+0.4; }
function _findClear(o,dist,a0){
for(var da=0.2;da<Math.PI*2;da+=0.25){
var a=a0+da, dx=Math.sin(a),dz=Math.cos(a);
var mid={x:o.x+dx*dist*0.5,z:o.z+dz*dist*0.5}, end={x:o.x+dx*dist,z:o.z+dz*dist};
if(!_isLand(end.x,end.z)||!_isLand(mid.x,mid.z)) continue;
if(raycastWorld(V3(o.x,o.y+1.5,o.z),V3(dx,0,dz),dist)) continue;
if(raycastWorld(V3(o.x,heightAt(o.x,o.z)+0.55,o.z),V3(dx,0,dz),dist)) continue;
return end;
}
return null;
}
function _placeClear(u,a0){ var e=_findClear(u.pos,7,a0); if(!e) return false; u.pos.set(e.x,heightAt(e.x,e.z),e.z); return true; }
function _pickEnemy(){
for(var i=0;i<soldiers.length;i++){ var s=soldiers[i]; if(s.alive&&!s.isPlayer&&s.team!==player.team&&!s.onVehicle&&!s.spectator&&!s.capCrew) return s; }
return null;
}
function _revive(){   // 探针复活 (上一测的死亡链副作用只留票务/计数, 与判据无关)
player.alive=true; player.hp=100; player.protUntil=0; player.nadeThrowT=0;
player.nadeHeld=false; player.nadeIsAT=false; player.nadeIsSmoke=false; player.nadeIsIncin=false;
if(typeof VM!=='undefined'&&VM) VM.state='idle';
}
function _nOf(u){ var n=0; for(var i=0;i<nades.length;i++){ if(nades[i].thrower===u) n++; } return n; }
function _lastNadeOf(u){ for(var i=nades.length-1;i>=0;i--){ if(nades[i].thrower===u) return nades[i]; } return null; }
function _stepToRemoval(nd,cap){ var s=0; while(nades.indexOf(nd)>=0&&s<cap){ updateNades(0.05,0.05); s++; } return s; }
`);

// ══ T1 玩家持雷半程厨雷: 掉落引信精确继承 nadeFuse 余值 ══
console.log('T1 玩家持雷半程 (nadeFuse=2.0): 死亡掉落原地, 引信继承 2.0 (★读条继承判据核心), 落地引爆');
const t1=G(`(function(){
try{
_revive(); if(!_placeClear(player,0.3)) return {err:'无开阔陆地落位'};
if(typeof VM!=='undefined'&&VM){ VM.state='nade'; VM.stateDur=999; } player.nadeHeld=true; player.nadeFuse=2.0; player.nadeIsAT=false; player.nadeIsSmoke=false; player.nadeIsIncin=false;
var E=_pickEnemy(); if(!E) return {err:'无敌方步兵'};
var d0=_nOf(player);
player.damage(9999,E,false);
if(player.alive) return {err:'玩家未死'};
var nd=_lastNadeOf(player); if(!nd) return {err:'无掉落雷'};
var r={delta:_nOf(player)-d0,kind:nd.kind,fuse:nd.fuse,dist:nd.pos.distanceTo(player.pos),
throwerOk:nd.thrower===player,teamOk:nd.team===player.team,armOk:nd.armOnFuse===true,
held:player.nadeHeld,vm:(typeof VM!=='undefined'&&VM)?VM.state:'noVM'};
r.steps=_stepToRemoval(nd,500);
r.removed=nades.indexOf(nd)<0;
r.meshOut=scene.children.indexOf(nd.m)<0;   // 引爆/哑火都摘网格; 落位已保证全程陆地 ⇒ 无哑火歧义
return r;
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t1.err){ ok(false,'T1 异常 '+t1.err); }
else{
ok(t1.delta===1,'T1 恰掉落一颗 (delta='+t1.delta+')');
ok(t1.kind==='frag','T1 弹种=手雷 ('+t1.kind+')');
ok(Math.abs(t1.fuse-2.0)<1e-9,'T1 ★掉落引信精确继承读条余值 ('+t1.fuse+' ≡ 2.0)');
ok(t1.dist<2.5,'T1 掉在原地 (距尸体 '+t1.dist.toFixed(2)+'m)');
ok(t1.throwerOk&&t1.teamOk&&t1.armOk,'T1 归属/队伍/武装账与出手件同链');
ok(!t1.held&&t1.vm==='idle','T1 账目旗已摘 + VM 收回 idle (held='+t1.held+', VM='+t1.vm+')');
ok(t1.removed&&t1.meshOut,'T1 最终离账+网格摘除=真实引爆 (40 步 ≈2.0s=引信烧尽武装+贴地接触, 与读条余值吻合; 步数 '+t1.steps+')');
}

// ══ T2 玩家持雷全熟 (nadeFuse=0 已武装): 掉地即炸 ══
console.log('T2 玩家持雷全熟 (nadeFuse=0, 已武装): 掉落引信 0, 触地即炸 (尸体旁的雷最烫)');
const t2=G(`(function(){
try{
_revive(); if(!_placeClear(player,1.1)) return {err:'无开阔陆地落位'};
if(typeof VM!=='undefined'&&VM){ VM.state='nade'; VM.stateDur=999; } player.nadeHeld=true; player.nadeFuse=0; player.nadeIsAT=false; player.nadeIsSmoke=false; player.nadeIsIncin=false;
var E=_pickEnemy(); if(!E) return {err:'无敌方步兵'};
var d0=_nOf(player);
player.damage(9999,E,false);
if(player.alive) return {err:'玩家未死'};
var nd=_lastNadeOf(player); if(!nd) return {err:'无掉落雷'};
var r={delta:_nOf(player)-d0,fuse:nd.fuse,kind:nd.kind};
r.steps=_stepToRemoval(nd,500);
r.removed=nades.indexOf(nd)<0;
r.meshOut=scene.children.indexOf(nd.m)<0;
return r;
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t2.err){ ok(false,'T2 异常 '+t2.err); }
else{
ok(t2.delta===1&&t2.kind==='frag','T2 恰掉落一颗手雷');
ok(Math.abs(t2.fuse-0)<1e-9,'T2 ★全熟雷掉落引信=0 (已武装, '+t2.fuse+')');
ok(t2.removed&&t2.meshOut&&t2.steps<40,'T2 触地即炸快爆 ('+t2.steps+' 步 = '+(t2.steps*0.05).toFixed(2)+'s + 网格摘除)');
}

// ══ T3 玩家持烟雾 (nadeFuse=99 哨兵): 掉落带标准引信, 哨兵绝不带走 ══
console.log('T3 玩家持烟雾 (nadeFuse=99 哨兵): 掉落引信=标准 1.8 (★哨兵带走=永不武装哑弹)');
const t3=G(`(function(){
try{
_revive(); if(!_placeClear(player,2.2)) return {err:'无开阔陆地落位'};
if(typeof VM!=='undefined'&&VM){ VM.state='nade'; VM.stateDur=999; } player.nadeHeld=true; player.nadeFuse=99; player.nadeIsSmoke=true; player.nadeIsAT=false; player.nadeIsIncin=false;
var E=_pickEnemy(); if(!E) return {err:'无敌方步兵'};
var d0=_nOf(player);
player.damage(9999,E,false);
if(player.alive) return {err:'玩家未死'};
var nd=_lastNadeOf(player); if(!nd) return {err:'无掉落雷'};
var r={delta:_nOf(player)-d0,kind:nd.kind,fuse:nd.fuse,smokeN:nd.smokeN===true};
r.steps=_stepToRemoval(nd,500);
r.removed=nades.indexOf(nd)<0;
return r;
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t3.err){ ok(false,'T3 异常 '+t3.err); }
else{
ok(t3.delta===1&&t3.kind==='smoke'&&t3.smokeN,'T3 恰掉落一颗烟雾弹');
ok(Math.abs(t3.fuse-1.8)<1e-9,'T3 ★掉落引信=标准 1.8, 哨兵 99 未带走 ('+t3.fuse+')');
ok(t3.removed,'T3 最终离账 (引信到点武装 → 接触起爆成烟, '+t3.steps+' 步)');
}

// ══ T4 玩家出手弧中阵亡: 照样掉落 + VM 收弧 (死后不出手, 防复活双雷) ══
console.log('T4 玩家出手弧中阵亡 (松手后出手帧未到): 照掉落 + VM nade 态收回 idle');
const t4=G(`(function(){
try{
_revive(); if(!_placeClear(player,3.4)) return {err:'无开阔陆地落位'};
player.nadeHeld=false; player.nadeFuse=2.5; player.nadeIsAT=false; player.nadeIsSmoke=false; player.nadeIsIncin=false;
if(typeof VM==='undefined'||!VM) return {err:'无 VM'};
VM.state='nade';                                                  // 复刻死亡冻结的出手弧 (24-main 门: alive=false ⇒ 弧永不走出手帧)
var E=_pickEnemy(); if(!E) return {err:'无敌方步兵'};
var d0=_nOf(player);
player.damage(9999,E,false);
if(player.alive) return {err:'玩家未死'};
var nd=_lastNadeOf(player); if(!nd) return {err:'无掉落雷'};
var r={delta:_nOf(player)-d0,kind:nd.kind,fuse:nd.fuse,vm:VM.state};
return r;
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t4.err){ ok(false,'T4 异常 '+t4.err); }
else{
ok(t4.delta===1&&t4.kind==='frag','T4 出手弧中的雷照样掉落 (恰一颗手雷)');
ok(Math.abs(t4.fuse-2.5)<1e-9,'T4 掉落引信继承 ('+t4.fuse+' ≡ 2.5)');
ok(t4.vm==='idle','T4 ★VM nade 态已收回 idle (死后弧不得再走出手, 防复活双雷; VM='+t4.vm+')');
}

// ══ T5 Bot 前摇被杀: 引信按前摇剩余比继承 ══
console.log('T5 Bot 举雷前摇 nadeAnimT=0.2 (剩 25%): 掉落引信 = 3.4×0.25 = 0.85');
const t5=G(`(function(){
try{
var B=_pickEnemy(); if(!B) return {err:'无敌方步兵'};
var spot=_findClear(player.pos,4.5,5.2); if(!spot) return {err:'玩家旁无开阔陆地落位'};  // 巷战敌兵原位四周常无净空, 搬到玩家旁已验证落位
B.pos.set(spot.x,heightAt(spot.x,spot.z),spot.z); B.crouch=false; B.prone=false;
B.state='nade'; B.nadeAnimT=0.2;
var d0=_nOf(B);
B.damage(9999,player,false);
if(B.alive) return {err:'Bot 未死'};
var nd=_lastNadeOf(B); if(!nd) return {err:'无掉落雷'};
var r={delta:_nOf(B)-d0,kind:nd.kind,fuse:nd.fuse,throwerOk:nd.thrower===B};
r.steps=_stepToRemoval(nd,500);
r.removed=nades.indexOf(nd)<0;
r.meshOut=scene.children.indexOf(nd.m)<0;
return r;
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t5.err){ ok(false,'T5 异常 '+t5.err); }
else{
ok(t5.delta===1&&t5.kind==='frag'&&t5.throwerOk,'T5 Bot 前摇中的雷掉落 (恰一颗手雷, 归属=Bot)');
ok(Math.abs(t5.fuse-0.85)<1e-6,'T5 ★掉落引信按前摇剩余比继承 ('+t5.fuse+' ≈ 3.4×0.25=0.85)');
ok(t5.removed&&t5.meshOut,'T5 最终离账+网格摘除=真实引爆 ('+t5.steps+' 步)');
}

// ══ T6 Bot 反坦克雷前摇被杀: 表外弹种掉落即武装 ══
console.log('T6 Bot 反坦克雷前摇 (atnade): 掉落即武装 (表外弹种), 触地即炸');
const t6=G(`(function(){
try{
var B=_pickEnemy(); if(!B) return {err:'无敌方步兵'};
var spot=_findClear(player.pos,4.5,6.1); if(!spot) return {err:'玩家旁无开阔陆地落位'};
B.pos.set(spot.x,heightAt(spot.x,spot.z),spot.z); B.crouch=false; B.prone=false;
B.state='atnade'; B.nadeAnimT=0.5;
var d0=_nOf(B);
B.damage(9999,player,false);
if(B.alive) return {err:'Bot 未死'};
var nd=_lastNadeOf(B); if(!nd) return {err:'无掉落雷'};
var r={delta:_nOf(B)-d0,kind:nd.kind,at:nd.at===true,armOk:nd.armOnFuse===false,fuse:nd.fuse};
r.steps=_stepToRemoval(nd,500);
r.removed=nades.indexOf(nd)<0;
r.meshOut=scene.children.indexOf(nd.m)<0;
return r;
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t6.err){ ok(false,'T6 异常 '+t6.err); }
else{
ok(t6.delta===1&&t6.kind==='at'&&t6.at,'T6 恰掉落一颗反坦克雷');
ok(t6.armOk&&Math.abs(t6.fuse-1.6)<1e-9,'T6 掉落即武装 (表外弹种 armOnFuse=false, 引信 1.6 透传)');
ok(t6.removed&&t6.meshOut,'T6 触地即炸 (离账+网格摘除, '+t6.steps+' 步)');
}

// ══ T7 对照: 死时手里没雷 ⇒ 零掉落 ══
console.log('T7 对照: 玩家/Bot 死时手里没雷 ⇒ 不得凭空生出弹体');
const t7=G(`(function(){
try{
var r={};
_revive(); if(!_placeClear(player,4.5)) return {err:'无开阔陆地落位'};
var E=_pickEnemy(); if(!E) return {err:'无敌方步兵'};
var d0=_nOf(player);
player.damage(9999,E,false);
r.playerDelta=_nOf(player)-d0;
var B=_pickEnemy(); if(!B) return {err:'无敌方步兵(第二)'};
B.state='combat'; B.nadeAnimT=0;
var b0=_nOf(B);
B.damage(9999,player,false);
r.botDelta=_nOf(B)-b0;
return r;
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t7.err){ ok(false,'T7 异常 '+t7.err); }
else{
ok(t7.playerDelta===0,'T7 玩家空手死亡零掉落 (delta='+t7.playerDelta+')');
ok(t7.botDelta===0,'T7 Bot 非前摇死亡零掉落 (delta='+t7.botDelta+')');
}

console.log('────');
console.log('通过 '+PASS.length+' 项, 失败 '+FAILN+' 项'+(NEG?' (阴性对照: 有红=判据具备分辨力)':''));
if(FAILN){ process.exitCode=1; }
else if(NEG){ console.log('✗ 阴性对照全绿 = 判据空转!'); process.exitCode=1; }
