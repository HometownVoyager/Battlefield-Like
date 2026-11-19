// ─────────────────────────────────────────────────────────────
// dev/verify-melee-20261120.js —— 2026-11-20 军刀近战重做批验收
//
// 用法: node dev/verify-melee-20261120.js [--neg]
//   正常 = 全量判据 (T1..T7 + 源码防回退), 必须全绿。
//   --neg = 阴性对照, 两支**各自隔离 boot** (锚=最终代码的逐字行):
//     NEG-A 摘 playerFireTick 里 LMB→startMelee('thrust') 那行 ⇒ "LMB 端到端起手 / 刺恰-45" 定向红
//           (直调 startMelee 的斩照常绿 = 补丁隔离证明);
//     NEG-B 刺击 damage 调用改字面 110 ⇒ "满血单刺不杀" 定向红 (斩/劈 35/70 判据照常绿)。
//
// 用户裁定 (不可改): 近战=切枪模式 (N 键切第 3 槽军刀, 无拔刀动画); 左键刺 / 右键斩 / 中键劈;
//   标准档伤害 刺45 / 斩35 (扇形多目标) / 劈70 —— 满血 100 的兵三种都杀不死; 节奏 刺0.35s / 斩0.5s / 劈0.7s;
//   Bot 近战伤害对齐 45 且归因 '军刀'。
//
// 覆盖:
//   T1 切槽: switchSlot(2) → 军刀槽 / VM 直接 idle (无 draw) / FP 剑可见; 切回槽0 枪恢复 (draw 回归);
//      Digit1/2 同入口正常; _lastGunSlot 记账正确 (军刀槽不入账)。
//   T2 三式伤害 (经真 startMelee → VM 推进 → vmPlayOnce → doMeleeHit 链): 满血敌兵 2m 前三连击
//      刺→恰-45 且存活 / 斩→恰-35 / 劈→死; 三个满血新兵各吃一式全部存活 (单式都杀不死)。
//   T3 节奏: 起手 meleeCd===对应时长; 挥砍中再 startMelee 无效; 逐帧扣完可再出手; LMB 端到端起手。
//   T4 扇形: 前方 ±30° 两敌同吃 35; 正后方敌不吃。
//   T5 归因: 劈死敌兵 (真 Bot damage→die 链) → 击杀来源 '军刀'。
//   T6 3P: gunKindOf/worldGunModel/av._gunKind + 四表 (MOUNT/HOLD/PRONE/CARRIED_FWD) 源码登记。
//   T7 Bot 近战: 真实触发 (state='melee'+贴脸+update 步进) → 玩家恰 -45 且 bot._src==='军刀'。
//
// 口径: 照 verify-deathflight-20261103 loader 骨架 (stub three + 忠实 CANNON 桩 + index.html 全脚本链
//   + 淞沪开局 + startBtn/deployPlayer/protUntil=0); 靶兵摆位/冻结手法照抄 verify-crushhead-20261103
//   (可挪 pos, 伤害走真 damage 链, 禁 setTimeout); 瞄准照抄 verify-aimassist (沙箱 camForward 恒 -Z ⇒
//   直接摆 camera.position, 靶兵放 -Z 前方); 几何判型只读 geometry.parameters。
// ─────────────────────────────────────────────────────────────
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
// CANNON 桩 (与 verify-deathflight 同源): die→spawnRagdoll 需要 World/Body 等
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
const SRC=f=>fs.readFileSync(path.join(root,f),'utf8');

// ── NEG 阴性对照补丁 (两支, 各自隔离 boot; 锚=最终代码的逐字行, 装载前文本替换) ──
const NEG=process.argv.includes('--neg');
const NEG_PATCHES=[
// NEG-A (index 0): 摘 playerFireTick 里 LMB→startMelee('thrust') 那行 ⇒ LMB 端到端/刺恰-45 定向红
{file:'js/20-player.js',from:"if(!player.fireHeld) startMelee('thrust');",to:""},
// NEG-B (index 1): 刺击 damage 调用改字面 110 ⇒ "满血单刺不杀" (45→110 直接击杀) 定向红
{file:'js/18-game.js',from:"sr.sol.damage(kind==='chop'?def.chopDmg:def.thrustDmg,player,false);",to:"sr.sol.damage(kind==='chop'?def.chopDmg:110,player,false);"},
];
function boot(campIdx,patchIdxs){
const PATCH_MAP={};
for(const pi of (patchIdxs||[])){
const p=NEG_PATCHES[pi],s=SRC(p.file);
if(s.indexOf(p.from)<0){ console.log('✗ NEG 锚缺失: '+p.file+' :: '+p.from); process.exit(1); }
PATCH_MAP[p.file]=s.split(p.from).join(p.to);
}
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f));
for(const k in stub.byId)delete stub.byId[k];
const ctx=vm.createContext(Object.assign({},stub.sandbox));
ctx.document=stub.document; ctx.window=stub.window; ctx.CANNON=CANNON;
ctx.localStorage={_s:{sf_campaign:String(campIdx),sf_pseed:'424242'},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of FILES) vm.runInContext(srcOf(f),ctx,{filename:f});
return ctx;
}
const PASS=[];let FAILN=0;
function ok(cond,label){
if(cond){ PASS.push(label); console.log('  ✔ '+label); }
else { FAILN++; console.log('  ✘ '+label); }
}
function section(t){ console.log('\n══ '+t+' ══'); }
const CAMPI=3; // 淞沪 (deathflight 同源: 攻防图, 有坦克有步兵)

// ── 公用 vm 片段 (每 boot 注入): 靶场选址 + 靶兵工厂 + VM 推帧助手 ──
const HELPERS=`
function _isLand(x,z){ return heightAt(x,z)>waterYAt(x,z)+0.4; }
// 三条射线 (前向 -Z / ±30° 扇边) 在 3m 内都净空 + 地形平缓 (2m 落差 <0.5) 才算合格靶场
// (camForward 桩恒 -Z ⇒ 靶兵只能摆 -Z 前方, 场地只能挑"前方净空"的点)
function _rangeClear(x,z){
if(!_isLand(x,z)||!_isLand(x,z-2.4)) return false;
if(Math.abs(heightAt(x,z-2)-heightAt(x,z))>0.5) return false;
var eye=V3(x,heightAt(x,z)+1.62,z);
var dirs=[V3(0,0,-1),V3(Math.sin(Math.PI/6),0,-Math.cos(Math.PI/6)),V3(-Math.sin(Math.PI/6),0,-Math.cos(Math.PI/6))];
for(var i=0;i<dirs.length;i++){ if(raycastWorld(eye,dirs[i],3)) return false; }
return true;
}
function _findRange(){
var cx=player.pos.x, cz=player.pos.z;
for(var r=0;r<26;r++){ for(var a=0;a<12;a++){
var x=cx+Math.sin(a*Math.PI/6)*(4+r*2), z=cz+Math.cos(a*Math.PI/6)*(4+r*2);
if(_rangeClear(x,z)) return {x:x,z:z};
} }
return null;
}
// 靶兵工厂: 真契约假兵 (damage 走血账→置亡; crushhead mkS 同款), 只入 combatants 不入 soldiers (不走 AI)
// y 缺省取玩家脚下地面 (与相机同基准 ⇒ raySoldiers 头球/身柱判定稳健, 不吃 ≤0.5m 的地形落差)
function _mkTarget(x,z,team,y){ return {alive:true,team:team,pos:V3(x,y!==undefined?y:heightAt(x,z),z),hp:100,
crouch:false,prone:false,onVehicle:false,spectator:false,zombie:false,isPlayer:false,lastAtk:null,
damage:function(amt,attacker,isHead){ if(!this.alive) return; this.hp-=amt; this.lastAtk=attacker; if(this.hp<=0) this.alive=false; }}; }
// VM 推帧助手: updateViewModel 逐帧 + updatePlayer 口径的 meleeCd 衰减 (挥完即 idle)
function _vmSwing(frames){ for(var i=0;i<(frames||60);i++){ updateViewModel(1/60,player); player.meleeCd=Math.max(0,player.meleeCd-1/60); } }
function _vmIdle(){ for(var i=0;i<50;i++){ if(VM.state==='idle') break; updateViewModel(1/60,player); } }
// LMB 端到端 (两帧: 第一帧起手 fireHeld=true, 第二帧 mouseDown=false 清扳机 —— 复现真实点击/松开)
function _lmb(){ mouseDown=true; playerFireTick(1/60,true); mouseDown=false; playerFireTick(1/60,true); }
// 切军刀槽的可靠路径: 先把 draw/其他 VM 态走完 (switchSlot 的 VM 态门 + draw 非读条 ⇒ 只有 idle 能换)
function _toSabre(){ _vmIdle(); if(player.curSlot!==2) switchSlot(2,true); _vmIdle(); }
function _toSlot(i){ _vmIdle(); if(player.curSlot!==i) switchSlot(i,true); _vmIdle(); }
// 靶场摆位: 玩家挪到净空靶场中心 + 相机=眼位 (aimassist 手法)
function _place(rng){ player.pos.set(rng.x,heightAt(rng.x,rng.z),rng.z);
player.yaw=Math.PI; player.pitch=0; player.crouch=false; player.prone=false; player.sprinting=false;
camera.position.set(player.pos.x,player.pos.y+1.62,player.pos.z); }
`;
function bootStart(campIdx,patchIdxs,label){
const ctx=boot(campIdx,patchIdxs);
const G=s=>vm.runInContext(s,ctx);
let err=null;
try{ G("document.getElementById('startBtn').onclick();"); }catch(e){ err='start: '+String(e&&e.stack||e); }
if(!err){ try{ G('if(!player.alive||!player.deployed) deployPlayer();'); }catch(e){ err='deploy: '+String(e&&e.stack||e); } }
if(!err) try{ G('for(const s of soldiers) s.protUntil=0; player.protUntil=0;'); }catch(e){}
if(err||G('player.alive')!==true){ console.log('  ✘ '+label+' 开局/部署失败 '+(err||'player.alive=false')); process.exit(1); }
G(HELPERS);
return {ctx,G};
}

// ═══════════════════ 正常模式: 全量判据 ═══════════════════
if(!NEG){
const {G}=bootStart(CAMPI,null,'正常');
section('前置');
ok(G('player.alive')===true,'战场已开局并部署 (soldiers='+G('soldiers.length')+', player.alive=true)');
ok(G('player.slots.length')===3&&G('player.slots[2]&&player.slots[2].key')==='sabre',
'部署即带军刀第 3 槽 (slots='+G('player.slots.length')+', slots[2].key='+G('player.slots[2]&&player.slots[2].key')+')');

// ── T1 切槽 ──
section('T1 切槽: switchSlot(2) → 军刀槽 / 无 draw / FP 剑可见; 切回槽0 枪恢复; _lastGunSlot 记账');
G('for(var i=0;i<40;i++) updateViewModel(1/60,player);');   // 先把部署自带的拔枪动画走完 (draw 0.45s)
G('switchSlot(2,true);');
const t1=G(`(()=>{
var out={};
out.slot=player.curSlot; out.key=player.curW&&player.curW.key;
out.state=VM.state;                      // 军刀无拔刀动画 ⇒ 直接 idle (不进 draw)
var g=VM.gunParts;
out.gunVisible=!!(g&&g.gun&&g.gun.visible);
out.meshN=0; out.bladeDepth=0;
if(g&&g.gun){ g.gun.traverse(function(o){ if(o.isMesh&&o.geometry&&o.geometry.parameters){ out.meshN++;
if(o.geometry.parameters.depth>0.4) out.bladeDepth=o.geometry.parameters.depth; } }); }
out.armLHidden=VM.arms&&!VM.arms.L.visible;   // 单手持刀: 左臂整条藏
// 切回槽0 (Digit1 同一入口): 枪恢复 + 拔枪动画回归 (sabre 特例只属于军刀)
_vmIdle(); switchSlot(0,true);
out.backSlot=player.curSlot; out.backKey=player.curW&&player.curW.key; out.backState=VM.state;
out.last0=player._lastGunSlot;
// Digit2 正常 + 记账: 最后枪槽=1, 军刀槽(2)自身不入账
_vmIdle(); switchSlot(1,true);
out.subSlot=player.curSlot; out.last1=player._lastGunSlot;
_vmIdle(); switchSlot(2,true);
out.meleeSlot=player.curSlot; out.lastAfter2=player._lastGunSlot;
// N 键的目标槽表达式与源码同字面 (本行即 19-input KeyN 分支那行的复算)
out.nTarget=(player.curSlot===2?(player._lastGunSlot||0):2);
return out; })()`);
ok(t1.slot===2&&t1.key==='sabre','T1 切到军刀槽 (curSlot='+t1.slot+', curW.key='+t1.key+')');
ok(t1.state==='idle','T1 ★无拔刀动画: 装备后 VM 直接 idle (state='+t1.state+')');
ok(t1.gunVisible===true&&t1.meshN>=4&&t1.bladeDepth>0.4,'T1 FP 剑可见且长刃在 (mesh='+t1.meshN+', 刃深='+t1.bladeDepth+')');
ok(t1.armLHidden===true,'T1 单手持刀: 左臂藏起');
ok(t1.backSlot===0&&t1.backKey!=='sabre','T1 切回槽0 枪恢复 ('+t1.backKey+')');
ok(t1.backState==='draw','T1 枪械拔枪动画回归 (state='+t1.backState+' — sabre 特例仅军刀)');
ok(t1.last0===0&&t1.subSlot===1&&t1.last1===1,'T1 _lastGunSlot 记账: 槽0→0, 槽1→1 (Digit1/2 同入口正常)');
ok(t1.meleeSlot===2&&t1.lastAfter2===1,'T1 军刀槽不入账 (切槽2 后 _lastGunSlot 仍='+t1.lastAfter2+')');
ok(t1.nTarget===1,'T1 N 目标槽表达式 = '+t1.nTarget+' (军刀槽⇒切回最后枪槽)');
ok(SRC('js/19-input.js').includes('switchSlot(player.curSlot===2?(player._lastGunSlot||0):2,true);'),
'T1 源码锚: KeyN 分支单行切槽 (旧刺刀瞬刺整段已退役)');

// ── T2 三式伤害 ──
section('T2 三式伤害: 真 LMB→startMelee→VM 推进→vmPlayOnce→doMeleeHit 链 (满血单式都杀不死)');
const rng=G('_findRange()');
ok(!!rng,'T2 前置: 找到 -Z 向净空靶场 '+(rng?('('+rng.x.toFixed(0)+','+rng.z.toFixed(0)+')'):''));
if(!rng){ console.log('  ✘ 无靶场, 后续伤害判据跳过'); process.exit(1); }
// combatants 隔离 (crushhead 手法): 只留玩家 + 测试靶, 用后还原 —— 场上 Bot 不污染扇形/射线判定
G('globalThis.__cbSave=combatants.slice(); combatants.length=0; combatants.push(player);');
const t2=G(`(function(){
try{
var out={};
_place(RANGE);
player.hp=100; player.alive=true;
_toSabre();                               // 确保手里是军刀且 VM idle
var gy=heightAt(RANGE.x,RANGE.z);         // 靶兵统一站玩家脚下地面高度 (与相机同基准, 判定稳健)
var B1=_mkTarget(player.pos.x,player.pos.z-2,1,gy); combatants.push(B1);
// ── 刺: 走真 LMB 链 (mouseDown → playerFireTick 分流 → startMelee) ──
_lmb();
out.lmbState=VM.state; out.lmbKind=VM.meleeKind;
_vmSwing(60);
out.afterThrust={hp:B1.hp,alive:B1.alive};
// ── 斩: startMelee 单源 (右键 mousedown 不可派发, 起手同源) ──
startMelee('slash');
out.slashCd=player.meleeCd; out.slashDur=VM.stateDur;
_vmSwing(60);
out.afterSlash={hp:B1.hp,alive:B1.alive};
// ── 劈: 三连击收尾 (45+35=80 已伤 ⇒ 70 必死) ──
startMelee('chop');
out.chopCd=player.meleeCd;
_vmSwing(70);
out.afterChop={hp:B1.hp,alive:B1.alive};
combatants.splice(combatants.indexOf(B1),1);
// ── 单式击杀面: 三个满血新兵各吃一式, 全部存活 (逐个上靶逐个撤, 射线不被同位残留靶截胡) ──
var B2=_mkTarget(player.pos.x,player.pos.z-2,1,gy); combatants.push(B2);
_lmb(); _vmSwing(60);
out.soloThrust={hp:B2.hp,alive:B2.alive};
combatants.splice(combatants.indexOf(B2),1);
var B3=_mkTarget(player.pos.x,player.pos.z-2,1,gy); combatants.push(B3);
startMelee('slash'); _vmSwing(60);
out.soloSlash={hp:B3.hp,alive:B3.alive};
combatants.splice(combatants.indexOf(B3),1);
var B4=_mkTarget(player.pos.x,player.pos.z-2,1,gy); combatants.push(B4);
startMelee('chop'); _vmSwing(70);
out.soloChop={hp:B4.hp,alive:B4.alive};
combatants.splice(combatants.indexOf(B4),1);
return out;
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`.replace(/RANGE/g,JSON.stringify(rng)));
if(t2.err){ ok(false,'T2 异常 '+t2.err); }
else{
ok(t2.lmbState==='melee'&&t2.lmbKind==='thrust','T2 LMB 端到端起手 (VM.state='+t2.lmbState+', kind='+t2.lmbKind+')');
ok(t2.afterThrust.hp===55&&t2.afterThrust.alive===true,'T2 ★刺 = 恰 -45 且存活 (hp='+t2.afterThrust.hp+')');
ok(t2.afterSlash.hp===20&&t2.afterSlash.alive===true,'T2 ★斩 = 恰 -35 (45+35, hp='+t2.afterSlash.hp+')');
ok(t2.afterChop.alive===false,'T2 ★劈收尾三连击致死 (45+35+70)');
ok(t2.soloThrust.hp===55&&t2.soloThrust.alive===true,'T2 ★满血单刺不杀 (hp='+t2.soloThrust.hp+')');
ok(t2.soloSlash.hp===65&&t2.soloSlash.alive===true,'T2 ★满血单斩不杀 (hp='+t2.soloSlash.hp+')');
ok(t2.soloChop.hp===30&&t2.soloChop.alive===true,'T2 ★满血单劈不杀 (70<100, hp='+t2.soloChop.hp+')');
ok(Math.abs(t2.slashCd-0.5)<1e-9&&Math.abs(t2.chopCd-0.7)<1e-9,'T2 节奏随式: 斩 cd=0.5 / 劈 cd=0.7 ('+t2.slashCd+'/'+t2.chopCd+')');
}

// ── T3 节奏 ──
section('T3 节奏: meleeCd===对应时长 / 挥砍中再起手无效 / 扣完可再出手');
const t3=G(`(function(){
try{
var out={};
player.hp=100; player.alive=true; player.meleeCd=0;
_toSabre();
startMelee('thrust');
out.cd=player.meleeCd; out.kind=VM.meleeKind; out.pKind=player.meleeKind; out.pDur=player.meleeDur;
out.state=VM.state;
// 挥砍中 (VM.state!=='idle' 且 cd>0) 再 startMelee 必须无效
startMelee('slash');
out.midState=VM.state; out.midKind=VM.meleeKind; out.midCd=player.meleeCd;
// 逐帧扣完 (updateViewModel 推动画 + updatePlayer 口径的 cd 衰减), 走完可接下一式
_vmSwing(40);
out.endState=VM.state; out.endCd=player.meleeCd;
startMelee('slash');
out.nextKind=VM.meleeKind; out.nextState=VM.state;
_vmSwing(60);
out.nextEnd=VM.state;
// 枪械态门外证: 手里是枪 (vmEquip draw 态) ⇒ startMelee 落空
_vmIdle(); switchSlot(0,true);
startMelee('thrust');
out.gunBlock=(VM.state!=='melee'&&VM.state==='draw');   // 未进 melee (draw 态原样)
_toSabre();
return out;
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t3.err){ ok(false,'T3 异常 '+t3.err); }
else{
ok(Math.abs(t3.cd-0.35)<1e-9&&t3.kind==='thrust'&&t3.pKind==='thrust'&&Math.abs(t3.pDur-0.35)<1e-9,
'T3 刺起手: cd=0.35 且 meleeKind/meleeDur 双账就位 (cd='+t3.cd+')');
ok(t3.state==='melee','T3 起手进 VM melee 态');
ok(t3.midKind==='thrust'&&t3.midState==='melee'&&Math.abs(t3.midCd-0.35)<1e-9,'T3 ★挥砍中再 startMelee 无效 (kind 仍='+t3.midKind+', cd 未动)');
ok(t3.endState==='idle'&&t3.endCd<=0,'T3 逐帧扣完: 回 idle 且 cd 耗尽 (cd='+t3.endCd.toFixed(3)+')');
ok(t3.nextKind==='slash'&&t3.nextState==='melee','T3 扣完可再出手 (接了斩)');
ok(t3.nextEnd==='idle','T3 斩走完回 idle');
ok(t3.gunBlock===true,'T3 非军刀手持 startMelee 落空 (VM 未进 melee)');
}

// ── T4 扇形 ──
section('T4 扇形: 前方 ±30° 两敌同吃 35; 正后方敌不吃 (120° 扇)');
const t4=G(`(function(){
try{
var out={}; var s30=Math.sin(Math.PI/6), c30=Math.cos(Math.PI/6);
var L=_mkTarget(player.pos.x+s30*2,player.pos.z-c30*2,1,player.pos.y);
var R=_mkTarget(player.pos.x-s30*2,player.pos.z-c30*2,1,player.pos.y);
var BK=_mkTarget(player.pos.x,player.pos.z+2,1,player.pos.y);   // 正后方 (+Z)
combatants.push(L); combatants.push(R); combatants.push(BK);
player.meleeCd=0; _vmIdle();
startMelee('slash'); _vmSwing(60);
out.L={hp:L.hp,alive:L.alive}; out.R={hp:R.hp,alive:R.alive}; out.BK={hp:BK.hp,alive:BK.alive};
return out;
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t4.err){ ok(false,'T4 异常 '+t4.err); }
else{
ok(t4.L.hp===65&&t4.R.hp===65,'T4 ★±30° 两敌同吃 35 (L hp='+t4.L.hp+', R hp='+t4.R.hp+')');
ok(t4.BK.hp===100&&t4.BK.alive===true,'T4 ★正后方敌不吃 (hp='+t4.BK.hp+')');
}

// ── T5 归因 ──
section('T5 归因: 劈死敌兵 (真 Bot damage→die 链) → 击杀来源 军刀');
const t5=G(`(function(){
try{
var out={};
var B=null;
for(var i=0;i<soldiers.length;i++){ var s=soldiers[i];
if(s.alive&&!s.isPlayer&&s.team!==player.team&&!s.onVehicle&&!s.spectator&&!s.capCrew&&!s.zombie){ B=s; break; } }
if(!B) return {err:'无敌方真 Bot'};
// 摆位: 真兵挪到军刀前方 2m (crushhead 手法: 只挪 pos, 伤害走真 damage→die 链), 预设 30 血让劈必死;
// y 取玩家脚下地面 (与相机同基准 ⇒ raySoldiers 头球判定稳健, 不吃 2m 内的地形落差)。
// 真 Bot 被隔离清场摘出了 combatants ⇒ 判定窗口临时推回 (结算候选集与子弹同源, 缺席=永远打不中)
B.pos.set(player.pos.x,player.pos.y,player.pos.z-2);
combatants.push(B);
B.crouch=false; B.prone=false; B.onVehicle=false; B.spectator=false; B.protUntil=0; B.hp=30;
player.meleeCd=0; _vmIdle();
startMelee('chop'); _vmSwing(70);
out.dead=!B.alive; out.src=player._src; out.label=killSrcLabel(player);
return out;
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t5.err){ ok(false,'T5 异常 '+t5.err); }
else{
ok(t5.dead===true,'T5 劈 (70) 对 30 血真兵致死 (真 die 链)');
ok(t5.src==='军刀'&&t5.label==='军刀','T5 ★击杀来源 = 军刀 (player._src='+t5.src+', killSrcLabel='+t5.label+')');
}

// ── T6 3P ──
section('T6 3P: gunKindOf / worldGunModel / av._gunKind + 四表源码登记');
const t6=G(`(function(){
try{
var out={};
out.kind=gunKindOf('sabre');
var wg=worldGunModel('sabre',0,'sabre');
out.wgChildren=wg.children.length;
out.wgBlade=0;
wg.traverse(function(o){ if(o.isMesh&&o.geometry&&o.geometry.parameters&&o.geometry.parameters.depth>out.wgBlade) out.wgBlade=o.geometry.parameters.depth; });
// 玩家化身换模型链: 切军刀槽后推一帧 3P 姿态机 ⇒ av._gunKind 跟上
_toSabre();
for(var i=0;i<3;i++) updatePlayerAvatar(1/60);
var av=playerAvatarEnsure();
out.gunKind=av._gunKind;
out.gunChildren=(av._gun&&av._gun.children)?av._gun.children.length:0;
_toSlot(0);
return out;
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t6.err){ ok(false,'T6 异常 '+t6.err); }
else{
ok(t6.kind==='sabre','T6 ★gunKindOf(sabre)=sabre (get='+t6.kind+')');
ok(t6.wgChildren>0&&t6.wgBlade>0.7,'T6 ★worldGunModel(sabre) 建出非空长刃 (children='+t6.wgChildren+', 刃深='+t6.wgBlade.toFixed(3)+')');
ok(t6.gunKind==='sabre','T6 ★switchSlot(2) 后 av._gunKind=sabre (get='+t6.gunKind+')');
ok(t6.gunChildren>0,'T6 3P 挂载网格非空 (children='+t6.gunChildren+')');
}
{
const s11=SRC('js/11-soldiers.js');
ok(s11.includes('sabre:{x:-0.16,y:0.34,z:0.28}')&&s11.includes('sabre:{x:-0.22,dy:0.12,dz:0.40}')
&&s11.includes('sabre:{\nshR:-0.52')&&s11.includes('sabre:0.10'),
'T6 ★四表登记: GUN_MOUNT_BY_KIND / GUN_MOUNT_PRONE / GUN_HOLD_BY_KIND / CARRIED_FWD 全有 sabre 项 (漏登记落 rifle 档)');
ok(s11.includes("if(d.melee) return 'sabre';"),'T6 gunKindOf 前置 melee 判据 (认 def.melee, 不认键名)');
}

// ── T7 Bot 近战 ──
section('T7 Bot 近战: 真实触发 (state=melee+贴脸+update 步进) → 玩家恰 -45 且 _src=军刀');
const t7=G(`(function(){
try{
var out={};
var B=null;
for(var i=0;i<soldiers.length;i++){ var s=soldiers[i];
if(s.alive&&!s.isPlayer&&s.team!==player.team&&!s.onVehicle&&!s.spectator&&!s.capCrew&&!s.zombie){ B=s; break; } }
if(!B) return {err:'无敌方真 Bot'};
// 冻结 AI 副作用 (crushhead 手法): 清掉所有"别在 melee 分支早退"的占用位
B.mortUse=null; B.mgUse=null; B.empUse=null; B.batUse=null; B.emCast=null; B.pilotOf=null;
B.emplPinT=0; B.inSquad=false; B.onVehicle=false; B.capCrew=false;
B.state='melee'; B.target=player; B.lastSeenT=nowT; B.meleeT=0;
B.pos.set(player.pos.x,player.pos.y,player.pos.z-2);
B.crouch=false; B.prone=false; B.protUntil=0;
player.hp=100; player.alive=true; player.protUntil=0;
B.update(1/60); B.update(1/60);
out.pend=!!B._pendMelee; out.pendT=B._pendMelee?B._pendMelee.t:-1;
for(var i=0;i<40;i++){ if(!B._pendMelee) break; B.update(1/60); }
out.settled=!B._pendMelee;
out.hp=player.hp; out.src=B._src; out.dead=!player.alive;
return out;
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t7.err){ ok(false,'T7 异常 '+t7.err); }
else{
ok(t7.pend===true&&t7.pendT>0&&t7.pendT<=0.39,'T7 melee 态起手挂延时账 (_pendMelee.t='+t7.pendT.toFixed(2)+', dt 驱动非 setTimeout)');
ok(t7.settled===true,'T7 延时账逐帧扣完并结算');
ok(Math.abs(t7.hp-55)<1e-6&&t7.dead===false,'T7 ★玩家恰 -45 且存活 (hp='+t7.hp+')');
ok(t7.src==='军刀','T7 ★bot._src = 军刀 (get='+t7.src+')');
}
ok(SRC('js/14-bots.js').includes("this._src='军刀'; mt.damage(45,this,false);"),
'T7 源码锚: Bot 近战 45 + 军刀归因 (旧 70 已退场)');

// ── 源码防回退 (关键单源/数值) ──
section('源码防回退');
{
const s09a=SRC('js/09a-defs.js'), s19=SRC('js/19-input.js'), s18=SRC('js/18-game.js'),
s20=SRC('js/20-player.js'), s23=SRC('js/23-deploy.js'), s10=SRC('js/10-viewmodel.js'),
s09=SRC('js/09-weapons.js'), s22=SRC('js/22-hud.js'), si18n=SRC('js/00b-i18n.js'),
s11=SRC('js/11-soldiers.js'), s14=SRC('js/14-bots.js');
ok(s09a.includes('sabre:{ name:\'军刀\'')&&s09a.includes('thrustDmg:45, slashDmg:35, chopDmg:70')
&&s09a.includes('thrustT:0.35, slashT:0.5, chopT:0.7, range:2.6')&&s09a.includes('melee:true'),
'定义: WPN_DEFS.sabre 三式伤害/节奏/射程单源 (45/35/70 · 0.35/0.5/0.7 · 2.6)');
ok(s19.includes('function startMelee(kind){')&&s19.includes('p.meleeKind=kind; p.meleeDur=dur;'),
'起手: startMelee 三式单源 (VM.kind + player.kind/dur 双账)');
ok(s19.includes('if(player.alive&&player.curW&&player.curW.def&&player.curW.def.melee')&&
s19.includes("startMelee('slash');")&&s19.includes("startMelee('chop');"),
'输入: RMB=横斩 / MMB=竖劈 分流在位 (LMB 分流在 20-player, 由 NEG-A 钉)');
ok(s18.includes('doMeleeHit(kind){')&&s18.includes("player._src='军刀';")
&&s18.includes('s.damage(def.slashDmg,player,false);')&&s18.includes('def.range'),
'结算: doMeleeHit(kind) 三式 + 军刀归因 + 扇形多目标在位');
ok(s18.includes('meleeKind:null, meleeDur:0,'),'结算: player.meleeKind/meleeDur 字段初始化');
ok(s20.includes("if(!p.spectator) p.slots.push({key:'sabre',def:WPN_DEFS.sabre,mag:0,reserve:0});")
&&s23.includes("if(!p.spectator) p.slots.push({key:'sabre',def:WPN_DEFS.sabre,mag:0,reserve:0});"),
'第三槽: 部署/再装填两处 push 互指同源 (观战不加, Bot setClass 不加)');
ok(s10.includes('if(WPN_DEFS[key]&&WPN_DEFS[key].melee){')&&s10.includes("VM.state='idle'; VM.stateT=0; VM.stateDur=0;")&&
s10.includes('VM.arms.L.visible=false;'),
'FP: vmEquip 军刀特例 (不进 draw / 单手藏左臂)');
ok(s09.includes('function buildSabreBody(G,scale){')&&s09.includes('buildSabreBody(G,1);')&&
s11.includes('buildSabreBody(g,1.35);'),
'建模: 军刀单源 buildSabreBody (FP=1.0 / 3P=1.35 两视角同件形)');
ok(s22.includes('if(w.def.melee){')&&s22.includes("hudText('magN','—');")&&
s22.includes('!player.onMG&&!w.def.melee&&w.mag<=Math.floor(w.def.mag/2)'),
'HUD: 军刀分支 (magN=— / 低弹红门排除 melee, 否则 0<=floor(0/2) 恒红)');
ok(si18n.includes("'军刀':'Sabre',")&&si18n.includes("'近战 · 左键刺 / 右键斩 / 中键劈':"),
'i18n: 军刀名/三式模式串中英配对登记; N 说明行改军刀语义');
ok(!s19.includes("VM.state='melee'; VM.stateT=0; VM.stateDur=0.5; player.meleeCd=0.7;"),
'退役: 旧 KeyN 刺刀瞬刺整段不在 (0.5s 直起手/0.7s 冷却写法已退)');
ok(!s14.includes('mt.damage(70,this,false);'),'退役: Bot 近战 70 伤害写法已退 (对齐 45)');
}

// combatants 还原 (隔离收尾)
G('combatants.length=0; for(var i=0;i<globalThis.__cbSave.length;i++) combatants.push(globalThis.__cbSave[i]);');

console.log('\n────');
console.log('通过 '+PASS.length+' 项, 失败 '+FAILN+' 项');
if(FAILN) process.exitCode=1;
}

// ═══════════════════ 阴性对照: 两支各自隔离 boot, 恰好定向红 ═══════════════════
if(NEG){
const rng0=(bootStart(CAMPI,null,'NEG 选址').G('_findRange()'));
if(!rng0){ console.log('  ✘ NEG 无靶场'); process.exit(1); }

console.log('\n══ NEG-A: 摘 playerFireTick LMB→startMelee(\'thrust\') 行 ⇒ LMB 起手/刺伤害 定向红 ══');
{
const {G}=bootStart(CAMPI,[0],'NEG-A');
G('globalThis.__cbSave=combatants.slice(); combatants.length=0; combatants.push(player);');
const r=G(`(function(){
try{
var out={};
_place(RANGE); player.hp=100; player.alive=true;
_toSabre();
var gy=heightAt(RANGE.x,RANGE.z);
var B1=_mkTarget(player.pos.x,player.pos.z-2,1,gy); combatants.push(B1);
_lmb(); _vmSwing(60);
out.lmbState=VM.state; out.b1hp=B1.hp;
// 补丁隔离证明: 直调 startMelee (右键/中键同源) 不受 NEG-A 影响
player.meleeCd=0; _vmIdle();
startMelee('slash'); _vmSwing(60);
out.slashHp=B1.hp;
return out;
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`.replace(/RANGE/g,JSON.stringify(rng0)));
if(r.err){ ok(false,'NEG-A 异常 '+r.err); }
else{
ok(r.lmbState==='melee','NEG-A [期望红] LMB 端到端起手 (state='+r.lmbState+')');
ok(r.b1hp===55,'NEG-A [期望红] 刺 = 恰 -45 (hp='+r.b1hp+')');
ok(r.slashHp===65,'NEG-A [期望绿·隔离证明] 直调 startMelee 的斩仍 -35 (hp='+r.slashHp+')');
}
}

console.log('\n══ NEG-B: 刺击 damage 改字面 110 ⇒ 满血单刺不杀 定向红 ══');
{
const {G}=bootStart(CAMPI,[1],'NEG-B');
G('globalThis.__cbSave=combatants.slice(); combatants.length=0; combatants.push(player);');
const r=G(`(function(){
try{
var out={};
_place(RANGE); player.hp=100; player.alive=true;
_toSabre();
var gy=heightAt(RANGE.x,RANGE.z);
var B2=_mkTarget(player.pos.x,player.pos.z-2,1,gy); combatants.push(B2);
_lmb(); _vmSwing(60);
out.b2={hp:B2.hp,alive:B2.alive};
combatants.splice(combatants.indexOf(B2),1);
// 补丁隔离证明: 斩/劈仍走 def 表值 35/70 (逐靶上靶逐靶撤, 射线不被同位残留靶截胡)
var B3=_mkTarget(player.pos.x,player.pos.z-2,1,gy); combatants.push(B3);
player.meleeCd=0; _vmIdle();
startMelee('slash'); _vmSwing(60);
out.slashHp=B3.hp;
combatants.splice(combatants.indexOf(B3),1);
var B4=_mkTarget(player.pos.x,player.pos.z-2,1,gy); combatants.push(B4);
player.meleeCd=0; _vmIdle();
startMelee('chop'); _vmSwing(70);
out.chopHp=B4.hp;
combatants.splice(combatants.indexOf(B4),1);
return out;
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`.replace(/RANGE/g,JSON.stringify(rng0)));
if(r.err){ ok(false,'NEG-B 异常 '+r.err); }
else{
ok(r.b2.hp===55&&r.b2.alive===true,'NEG-B [期望红] 满血单刺不杀 (hp='+r.b2.hp+', alive='+r.b2.alive+')');
ok(r.slashHp===65,'NEG-B [期望绿·隔离证明] 斩仍恰 -35 (hp='+r.slashHp+')');
ok(r.chopHp===30,'NEG-B [期望绿·隔离证明] 劈仍恰 -70 (hp='+r.chopHp+')');
}
}

console.log('\n────');
console.log('[阴性对照] 通过 '+PASS.length+' 项 (含定向绿隔离证明), 红 '+FAILN+' 项 (红=判据具备分辨力)');
if(FAILN===0){ console.log('✗ 阴性对照全绿 = 判据空转!'); process.exitCode=1; }
else process.exitCode=1;   // 阴性模式固定退出码 1 (与 deathflight/nadecancel 同款口径)
}
