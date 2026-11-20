// ─────────────────────────────────────────────────────────────
// dev/verify-melee-20261120.js —— 2026-11-20 军刀近战重做批验收
//
// 用法: node dev/verify-melee-20261120.js [--neg]
//   正常 = 全量判据 (T1..T7 + 源码防回退), 必须全绿。
//   --neg = 阴性对照, 四支**各自隔离 boot** (锚=最终代码的逐字行):
//     NEG-A 摘 playerFireTick 里 LMB→startMelee('thrust') 那行 ⇒ "LMB 端到端起手 / 刺恰-45" 定向红
//           (直调 startMelee 的斩照常绿 = 补丁隔离证明);
//     NEG-B 刺击 damage 调用改字面 110 ⇒ "满血单刺不杀" 定向红 (斩/劈 35/70 判据照常绿)。
//     NEG-C 摘 19-input 军刀右键分流门的 startMelee('slash') 行 (★三轮批) ⇒ "RMB 真事件端到端" 定向红
//           (T8 判据: 派发真 mousedown(button=2) 后 VM 停在 idle)。
//     NEG-D 摘 'nade' 投掷弧收尾的还臂行 (★三轮批修1) ⇒ "持刀投弹收尾藏回" 定向红
//           (T9 判据: 收尾后左臂仍可见; X 抢断路径走 steal 块还臂 = 补丁隔离证明照常绿)。
//     NEG-E FP斩 gun.rotation 行回退旧曲线 (偏航符号未翻) ⇒ "斩跨身扫幅/中段立刃" 定向红
//           (T10 判据; 劈立刃通道独立成行 = 补丁隔离证明照常绿)。
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
//   T8 RMB 真事件端到端 (★2026-11-20 三轮批): 真 MouseEvent('mousedown',{button:2}) 派发 → 19-input
//      window 监听 → 军刀分流门 → startMelee('slash') (旧探针 :207 自认"右键 mousedown 不可派发"全走
//      直调, 本支补上真事件链)。
//   T9 持刀投弹左臂 (★2026-11-20 三轮批): 军刀态进 'nade' 左臂必须举起 (修1), 投掷弧走完回 idle
//      (持刀) 左臂藏回; X 抢断取消 (vmAbortAction steal 块统一还臂) 同判据。
//   T10 三式曲线真值 (★2026-11-20 三轮批): FP 逐帧驱动 updateViewModel + 视空间链式欧拉合成
//      (root→sway→inner→gun) —— 斩=刀尖视空间 x 右(+0.45)→左(−0.55)跨身扫/中段放平/rz 立刃/root ry 腰转/
//      手刀同步; 劈=dn 段 rz 立刃 + 斜劈轨迹 + 收势逐位回举刀位; 刺=原曲线回归锁; 3P=gunY 扫幅/gunZ 立刃/
//      gunOffX 握点三路 (20-player 刀件驱动)。
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

// ── 真事件桥 (★2026-11-20 三轮批, T8 RMB 端到端义务): stub 的全局 addEventListener/dispatchEvent
//    是 no-op ⇒ 19-input 的 window mousedown 监听注册不落账, 旧探针因此"右键 mousedown 不可派发"
//    全走 startMelee 直调。这里在 boot 前把 sandbox 的 add/remove/dispatch 换成真账本 (忠实 DOM 语义:
//    dispatchEvent 同步逐个调用处理器), 并补 MouseEvent 构造器。只对 mousedown 派发 (keydown/等仅注册
//    不派发, 不改其它探针的既有行为 —— 它们的 boot 各自独立进程)。
const _EV={};
stub.sandbox.addEventListener=(t,f)=>{(_EV[t]=_EV[t]||[]).push(f);};
stub.sandbox.removeEventListener=(t,f)=>{const a=_EV[t]||[];const i=a.indexOf(f);if(i>=0)a.splice(i,1);};
stub.sandbox.dispatchEvent=e=>{const a=(_EV[e&&e.type]||[]).slice();for(const f of a)f.call(stub.window,e);return true;};
stub.sandbox.MouseEvent=class MouseEvent{constructor(type,o){o=o||{};this.type=type;this.button=o.button||0;
this.clientX=o.clientX||0;this.clientY=o.clientY||0;this.preventDefault=()=>{};this.stopPropagation=()=>{};}};

// ── NEG 阴性对照补丁 (两支, 各自隔离 boot; 锚=最终代码的逐字行, 装载前文本替换) ──
const NEG=process.argv.includes('--neg');
const NEG_PATCHES=[
// NEG-A (index 0): 摘 playerFireTick 里 LMB→startMelee('thrust') 那行 ⇒ LMB 端到端/刺恰-45 定向红
{file:'js/20-player.js',from:"if(!player.fireHeld) startMelee('thrust');",to:""},
// NEG-B (index 1): 刺击 damage 调用改字面 110 ⇒ "满血单刺不杀" (45→110 直接击杀) 定向红
{file:'js/18-game.js',from:"sr.sol.damage(kind==='chop'?def.chopDmg:def.thrustDmg,player,false);",to:"sr.sol.damage(kind==='chop'?def.chopDmg:110,player,false);"},
// NEG-C (index 2): 摘 19-input 军刀右键分流门的 startMelee('slash') 行 ⇒ RMB 真事件端到端 定向红
{file:'js/19-input.js',from:"startMelee('slash');",to:"/*NEG-C*/"},
// NEG-D (index 3): 摘 'nade' 投掷弧收尾的还臂行 (★三轮批修1) ⇒ 持刀投弹收尾藏回 定向红
{file:'js/10-viewmodel.js',from:"if(nt>=1){ VM.state='idle'; g.gun.visible=true; shown.visible=false; vmSndFlags={}; VM.arms.L.visible=!(WPN_DEFS[VM.key]&&WPN_DEFS[VM.key].melee); }   // ★三轮批: 回 idle 按当前武器还臂 (持刀藏/持枪现)",
to:"if(nt>=1){ VM.state='idle'; g.gun.visible=true; shown.visible=false; vmSndFlags={}; }"},
// NEG-E (index 4): FP斩 gun.rotation 行回退旧曲线 (三轮批偏航符号未翻) ⇒ 跨身扫幅/中段立刃 定向红
{file:'js/10-viewmodel.js',from:"g.gun.rotation.set(-0.95*st+0.95*rc,-0.45*w+1.85*st-1.40*rc,-1.05*st+1.05*rc);",
to:"g.gun.rotation.set(-0.55*st+0.55*rc,0.45*w-1.55*st+1.10*rc,-0.55*st+0.55*rc);"},
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
// ── 三式曲线真值采样 (★三轮批 T10): FP 视空间链式欧拉合成 (three.js 'XYZ' 语义 R=Rx·Ry·Rz) + 3P gunG 总角 ──
function _rxyz(e,v){
if(e.length!==undefined) e={x:e[0],y:e[1],z:e[2]};
var cx=Math.cos(e.x),sx=Math.sin(e.x),cy=Math.cos(e.y),sy=Math.sin(e.y),cz=Math.cos(e.z),sz=Math.sin(e.z);
var x=v.x*cz-v.y*sz,y=v.x*sz+v.y*cz,z=v.z;
var x2=x*cy+z*sy,z2=-x*sy+z*cy;
return {x:x2,y:y*cx-z2*sx,z:y*sx+z2*cx};
}
function _fpPt(o,l,mv){                    // mv=true 加位置 (点) / false 纯旋转 (方向)
var p=_rxyz(o.gr,l); if(mv) p={x:p.x+o.gp[0],y:p.y+o.gp[1],z:p.z+o.gp[2]};
p=_rxyz(o.ir,p); if(mv) p={x:p.x+o.ip[0],y:p.y+o.ip[1],z:p.z+o.ip[2]};
p=_rxyz(o.sr,p); if(mv) p={x:p.x+o.sp[0],y:p.y+o.sp[1],z:p.z+o.sp[2]};
p=_rxyz(o.rr,p); if(mv) p={x:p.x+o.rp[0],y:p.y+o.rp[1],z:p.z+o.rp[2]};
return p;
}
function _meleeFP(kind,frames,dur){        // FP: 逐帧 updateViewModel, 刀尖/刀轴/宽面法线视空间真值
_toSabre(); _vmIdle(); player.meleeCd=0;
if(VM.state==='idle') updateViewModel(1/60,player);   // 归一帧: T9 类取消路径会留下上一动作 stale 手位, 真实游戏下一 idle 帧即由 positionHands 复位 (手位基线必须取自真正的 idle 帧)
var HP0=[VM.arms.R.position.x,VM.arms.R.position.y,VM.arms.R.position.z];
var GP0=[VM.gunParts.gun.position.x,VM.gunParts.gun.position.y,VM.gunParts.gun.position.z];
var RR0=[VM.root.rotation.x,VM.root.rotation.y,VM.root.rotation.z];
startMelee(kind);
var TL={x:0,y:0.003,z:-0.65}, rows=[];
for(var i=1;i<=frames;i++){
updateViewModel(1/60,player); player.meleeCd=Math.max(0,player.meleeCd-1/60);
var o={gr:[VM.gunParts.gun.rotation.x,VM.gunParts.gun.rotation.y,VM.gunParts.gun.rotation.z],
gp:[VM.gunParts.gun.position.x,VM.gunParts.gun.position.y,VM.gunParts.gun.position.z],
ir:[VM.inner.rotation.x,VM.inner.rotation.y,VM.inner.rotation.z], ip:[VM.inner.position.x,VM.inner.position.y,VM.inner.position.z],
sr:[VM.sway.rotation.x,VM.sway.rotation.y,VM.sway.rotation.z], sp:[VM.sway.position.x,VM.sway.position.y,VM.sway.position.z],
rr:[VM.root.rotation.x,VM.root.rotation.y,VM.root.rotation.z], rp:[VM.root.position.x,VM.root.position.y,VM.root.position.z]};
var tip=_fpPt(o,TL,true), org=_fpPt(o,{x:0,y:0,z:0},true), nm=_fpPt(o,{x:0,y:1,z:0},false);
var dx=tip.x-org.x,dy=tip.y-org.y,dz=tip.z-org.z,hl=Math.sqrt(dx*dx+dy*dy+dz*dz)||1;
var hp=[VM.arms.R.position.x,VM.arms.R.position.y,VM.arms.R.position.z];
rows.push({nt:i/frames, st:VM.state, tip:tip, elev:Math.asin(Math.max(-1,Math.min(1,dy/hl))),
faceZ:nm.z/(Math.sqrt(nm.x*nm.x+nm.y*nm.y+nm.z*nm.z)||1),
gr:o.gr, gp:o.gp, rr:o.rr, hp:hp});
}
var w=-9,m=9,rzMin=9,ryMn=9,ryMx=-99,rxMn=9,rxMx=-99,devMx=0,mid=null,plat=null,lastM=null,upE=-9,rzDn=9,dnXmn=9,dnXmx=-9,rxVal=9,tzMin=9;
for(var j=0;j<rows.length;j++){ var r=rows[j];
if(r.nt>=0.13&&r.nt<=0.26&&r.tip.x>w) w=r.tip.x;
if(r.nt>0.26&&r.nt<0.97&&r.tip.x<m) m=r.tip.x;
if(r.gr[2]<rzMin) rzMin=r.gr[2];
if(r.rr[1]<ryMn) ryMn=r.rr[1]; if(r.rr[1]>ryMx) ryMx=r.rr[1];
if(r.rr[0]<rxMn) rxMn=r.rr[0]; if(r.rr[0]>rxMx) rxMx=r.rr[0];
if(r.gr[0]<rxVal) rxVal=r.gr[0];
if(r.tip.z<tzMin) tzMin=r.tip.z;
var dh=0; for(var k2=0;k2<3;k2++) dh+=Math.pow((r.hp[k2]-HP0[k2])-(r.gp[k2]-GP0[k2]),2);
if(Math.sqrt(dh)>devMx) devMx=Math.sqrt(dh);
if(Math.abs(r.nt-0.4)<1e-9) mid=r;
if(Math.abs(r.nt-0.6)<1e-9) plat=r;
if(r.st==='melee') lastM=r;
if(r.elev>upE) upE=r.elev;
if(r.nt>=0.31&&r.nt<=0.63){ if(r.gr[2]<rzDn) rzDn=r.gr[2]; if(r.tip.x<dnXmn) dnXmn=r.tip.x; if(r.tip.x>dnXmx) dnXmx=r.tip.x; }
}
var dnMono=true, dnRows=rows.filter(function(r){return r.nt>=0.31&&r.nt<=0.63;});
for(var j2=1;j2<dnRows.length;j2++) if(dnRows[j2].tip.y>=dnRows[j2-1].tip.y+1e-6) dnMono=false;
var resR=0,resP=0;
if(lastM){ for(var k3=0;k3<3;k3++){ resR=Math.max(resR,Math.abs(lastM.rr[k3]-RR0[k3]),Math.abs(lastM.gr[k3])); resP=Math.max(resP,Math.abs(lastM.gp[k3])); } }
return {wPeak:w, swMin:m, midElev:mid?mid.elev:null, midRz:mid?mid.gr[2]:null, platPitch:plat?(plat.rr[0]+plat.gr[0]):null,
faceZmid:mid?mid.faceZ:null, ryAmp:ryMx-ryMn, rxAmp:rxMx-rxMn, devMax:devMx, rzMin:rzMin, upElev:upE,
rzDnPeak:rzDn, dnMono:dnMono, dnXSpan:dnXmx-dnXmn, residRot:resR, residPos:resP, rxValley:rxVal, tipZmin:tzMin};
}
function _meleeP3(kind,frames,dur){        // 3P: updatePlayerAvatar 姿态机, gunG 三轴总角/挂点位移/右肩角
_toSabre(); _vmIdle(); player.meleeCd=0;
var av=playerAvatarEnsure(); for(var q=0;q<30;q++) updatePlayerAvatar(1/60);
var by=av.gunG.rotation.y, bx0=av.gunG.position.x;
player.meleeCd=0; startMelee(kind);
var yMn=9,yMx=-99,zMn=9,dx=-9,shRmn=9,shRmx=-99;
for(var i2=1;i2<=frames;i2++){
updateViewModel(1/60,player); player.meleeCd=Math.max(0,player.meleeCd-1/60); updatePlayerAvatar(1/60);
var gy=av.gunG.rotation.y, gz=av.gunG.rotation.z, gpx=av.gunG.position.x-bx0, sr=av.armR.sh.rotation.x;
if(gy<yMn) yMn=gy; if(gy>yMx) yMx=gy; if(gz<zMn) zMn=gz; if(gpx>dx) dx=gpx;
if(sr<shRmn) shRmn=sr; if(sr>shRmx) shRmx=sr;
}
return {baseY:by, span:yMx-yMn, zMin:zMn, dxMax:dx, shRMin:shRmn, shRMax:shRmx};
}
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

// ── T8 RMB 真事件端到端 ──
section('T8 RMB 真事件端到端: 真 MouseEvent(button=2) 派发 → window 监听 → 军刀分流门 → startMelee(slash)');
const t8=G(`(function(){
try{
var out={};
player.hp=100; player.alive=true; player.meleeCd=0;
_toSabre();
pointerLocked=true;                       // 沙箱没有指针锁 API (loiterfix/specbatch 先例): mousedown 入口有 !pointerLocked 早退
out.preState=VM.state; out.cd0=player.meleeCd;
dispatchEvent(new MouseEvent('mousedown',{button:2}));   // 真事件 → 19-input window mousedown → 军刀分流门
out.state=VM.state; out.kind=VM.meleeKind; out.pKind=player.meleeKind; out.dur=VM.stateDur;
out.cd=player.meleeCd;
_vmSwing(60);
out.endState=VM.state;
return out;
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t8.err){ ok(false,'T8 异常 '+t8.err); }
else{
	ok(t8.preState==='idle','T8 前置: 持刀 idle (state='+t8.preState+')');
	ok(t8.state==='melee'&&t8.kind==='slash'&&t8.pKind==='slash','T8 ★真右键事件起手横斩 (VM.state='+t8.state+', VM.kind='+t8.kind+', player.kind='+t8.pKind+')');
	ok(Math.abs(t8.cd-0.5)<1e-9&&Math.abs(t8.dur-0.5)<1e-9,'T8 节奏随式: 斩 cd=dur=0.5 ('+t8.cd+'/'+t8.dur+')');
	ok(t8.endState==='idle','T8 挥完回 idle (state='+t8.endState+')');
}

// ── T9 持刀投弹左臂 (修1) ──
section('T9 持刀投弹左臂: 军刀态进 nade 左臂举起 / 投掷弧收尾藏回 / X 抢断取消藏回');
const t9=G(`(function(){
try{
var out={};
player.hp=100; player.alive=true; player.meleeCd=0;
_toSabre();
out.preL=VM.arms.L.visible;               // 持刀单手: false (vmEquip 藏左臂)
// 进举雷: 19-input KeyG 同一套账 (VM idle ⇒ 门通过; 旧 2026-09-30 批哨兵口径)
player.nadeCount=2;
VM.state='nade'; VM.stateT=0; VM.stateDur=999;
player.nadeHeld=true; player.nadeFuse=NADE_FUSE_T; player.nadeIsAT=false; player.nadeIsSmoke=false; player.nadeIsIncin=false; vmSndFlags={};
for(var i=0;i<6;i++) updateViewModel(1/60,player);
out.holdState=VM.state;
out.holdL=VM.arms.L.visible;              // ★判据: true (左臂举雷 — 持刀不还臂就是症状③)
out.nadeShown=!!(VM.nadeM&&VM.nadeM.visible);
// 松 G: 19-input KeyG keyup 同套账 (0.55s 投掷弧) → 走完自然收尾回 idle (持刀) ⇒ 左臂藏回
player.nadeHeld=false; VM.stateT=0; VM.stateDur=0.55;
for(var i=0;i<45;i++){ updateViewModel(1/60,player); if(VM.state==='idle') break; }
out.endState=VM.state;
out.endL=VM.arms.L.visible;               // ★判据: false (持刀藏回 — 修1 还臂行)
out.gunBack=!!(VM.gunParts&&VM.gunParts.gun.visible);
// X 抢断取消 (vmAbortAction steal 块统一还臂 = 修1 收口单源): 再举一颗, 读条中 cancelReadBar
// (重置雷账 =2, 上一颗已走真投掷弧被 releaseNade 消耗, 这里只验"取消不消耗")
player.nadeCount=2;
VM.state='nade'; VM.stateT=0; VM.stateDur=999;
player.nadeHeld=true; player.nadeFuse=NADE_FUSE_T;
for(var i=0;i<3;i++) updateViewModel(1/60,player);
out.busy=player.readBarActive();
if(out.busy) player.cancelReadBar('已取消');
out.abortState=VM.state;
out.abortL=VM.arms.L.visible;             // ★判据: false (持刀抢断收尾按当前武器藏回)
out.abortCount=player.nadeCount;          // 雷不消耗 (取消≠投掷)
return out;
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t9.err){ ok(false,'T9 异常 '+t9.err); }
else{
	ok(t9.preL===false,'T9 前置: 持刀单手左臂藏起 (visible='+t9.preL+')');
	ok(t9.holdState==='nade'&&t9.holdL===true,'T9 ★持刀举雷左臂还回 (state='+t9.holdState+', arms.L.visible='+t9.holdL+')');
	ok(t9.nadeShown===true,'T9 雷模在手上 (取证前提, 非空转)');
	ok(t9.endState==='idle'&&t9.endL===false,'T9 ★投掷弧收尾回 idle: 持刀左臂藏回 (state='+t9.endState+', visible='+t9.endL+')');
	ok(t9.gunBack===true,'T9 收尾刀件回手上 (无模型滞留)');
	ok(t9.abortState==='idle'&&t9.abortL===false,'T9 ★X 抢断取消: steal 块统一还臂同判据 (state='+t9.abortState+', visible='+t9.abortL+')');
	ok(t9.abortCount===2,'T9 抢断取消雷不消耗 (nadeCount='+t9.abortCount+')');
}

// ── T10 三式曲线真值 (★三轮批: 斩跨身扫/劈立刃/腰转/手刀同步 + 3P 刀件三路) ──
section('T10 三式曲线真值: FP 视空间合成逐帧采样 + 3P gunG 总角 (曲线族"相位系数和=0"纪律下的大幅化)');
{
const t10s=G('_meleeFP("slash",30,0.5)');
ok(t10s.wPeak>=0.45,'T10 ★FP斩跨身扫①: 引刀段刀尖视空间 x ≥+0.45 (实测 '+t10s.wPeak.toFixed(3)+', 画面右上)');
ok(t10s.swMin<=-0.55,'T10 ★FP斩跨身扫②: 扫击段刀尖 x 谷 ≤−0.55 (实测 '+t10s.swMin.toFixed(3)+', 扫到画面左)');
ok(t10s.midElev>=-0.35&&t10s.midElev<=0,'T10 ★FP斩放平: 扫击中段(0.40)刀轴视空间俯角 ∈[−0.35,0] (实测 '+t10s.midElev.toFixed(3)+', 枪系总俯角@平台 '+t10s.platPitch.toFixed(3)+')');
ok(t10s.midRz<=-0.5,'T10 ★FP斩立刃: 扫击中段 rz ≤−0.5 宽面转离镜头 (实测 '+t10s.midRz.toFixed(3)+', faceZ '+t10s.faceZmid.toFixed(2)+')');
ok(t10s.ryAmp>=0.8,'T10 ★FP斩腰转: root ry 摆幅 ≥0.8rad (实测 '+t10s.ryAmp.toFixed(3)+')');
ok(t10s.devMax<=0.05,'T10 ★FP斩手刀同步: 手-握点偏差峰 ≤0.05m (实测 '+t10s.devMax.toFixed(3)+')');
const t10c=G('_meleeFP("chop",42,0.7)');
ok(t10c.rzDnPeak<=-0.9,'T10 ★FP劈立刃: dn 段 rz 峰值 ≤−0.9 (实测 '+t10c.rzDnPeak.toFixed(3)+')');
ok(t10c.dnMono&&t10c.dnXSpan>=0.08,'T10 ★FP劈斜劈: dn 段 tipY 单调降 + tipX 行程 ≥0.08 (行程 '+t10c.dnXSpan.toFixed(3)+')');
ok(t10c.residRot<=0.02&&t10c.residPos<=0.03,'T10 ★FP劈收势: 逐位回举刀位 (rot 残差 '+t10c.residRot.toFixed(4)+' / pos '+t10c.residPos.toFixed(4)+')');
const t10t=G('_meleeFP("thrust",21,0.35)');
ok(Math.abs(t10t.rxValley+0.874)<=0.01&&t10t.tipZmin<=-1.20&&t10t.tipZmin>=-1.28,
'T10 ★FP刺回归锁: 三轮批不动刺 (rx 谷 '+(+t10t.rxValley).toFixed(3)+' ≈−0.874, tipZ 谷 '+t10t.tipZmin.toFixed(3)+' ∈[−1.28,−1.20])');
const p10s=G('_meleeP3("slash",30,0.5)');
ok(p10s.span>=2.2,'T10 ★3P斩扫幅: gunY 峰谷 ≥2.2rad 相对持握态 (实测 '+p10s.span.toFixed(3)+', 基线 '+p10s.baseY.toFixed(3)+')');
ok(p10s.zMin<=-0.7,'T10 ★3P斩立刃: gunZ 谷 ≤−0.7 (实测 '+p10s.zMin.toFixed(3)+')');
ok(p10s.dxMax>=0.25,'T10 ★3P斩握点: gunOffX 峰 (挂点 x 位移) ≥0.25 (实测 '+p10s.dxMax.toFixed(3)+')');
const p10c=G('_meleeP3("chop",42,0.7)');
ok(p10c.zMin<=-1.0,'T10 ★3P劈立刃: gunZ 谷 ≤−1.0 (实测 '+p10c.zMin.toFixed(3)+')');
}

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
// ★2026-11-20 三轮实机反馈批 防回退锚 (修1/2/3/4/5/6)
ok((s10.match(/VM\.arms\.L\.visible=!\(WPN_DEFS\[VM\.key\]&&WPN_DEFS\[VM\.key\]\.melee\)/g)||[]).length===8,
'修1: 还臂表达式 8 处在位 (abort melee 分支+steal 统一块+nade 哨兵/收尾+bandage/grab/build×2 = 进态可见/退出按武器还原)');
ok(s10.includes('VM.arms.L.visible=true;'),'修1: 四个左手动作态块首进态置真 (nade/bandage/grab/build 共用判据行)');
ok(s10.includes('if(VM.gunParts&&VM.gunParts.gun){ VM.gunParts.gun.position.set(0,0,0); VM.gunParts.gun.rotation.set(0,0,0); }'),
'修3: vmAbortAction melee 抢断分支防御归零 (绝对 set 态绕过自然收尾时残姿冻结)');
ok(s10.includes('if(!d.melee){ rx+=VM.sprintBlend*(d.rocket?0.85:0.5); ry+=VM.sprintBlend*(d.rocket?0.15:0.55); rz-=VM.sprintBlend*(d.rocket?0.05:0.25); }'),
'修4: FP 疾跑附加角军刀豁免 (举刀位不被横甩; 与 3P noSprintCant 同口径)');
ok(s20.includes('if(thrust>0&&nadeK<=0&&!nadeHold){'),
'修2: 3P melee overlay 手雷门 (meleeT 残留不劫持雷姿态)');
ok(s09.includes('const bl=bx(st,0.034*s,0.007*s,0.560*s, 0,0.010*s,-0.315*s,G);')&&
s09.includes('bx(vmMats.gun,0.030*s,0.004*s,0.550*s, 0,0.0045*s,-0.315*s,G).rotation.x=0.02;')&&
s09.includes('bx(st,0.016*s,0.004*s,0.070*s, -0.002*s,0.002*s,-0.620*s,G);'),
'修5: 刀身横截面互换 (宽面法线 ±Y 正对镜头) + 刃口压边条 + 刀尖收薄偏 -X');
ok(s14.includes("const _hold=(this.gunKind==='sabre'&&typeof gunHoldOf==='function')?gunHoldOf(this.gunKind):null;")&&
s14.includes('const gunX_t=gunPitch-pp+(_hold?_hold.gunX:0);   // ★三轮批: 军刀吃持握表 gunX (举刀), 其余 kind=null 加 0 逐位不变'),
'修6: Bot 军刀持握 parity (GUN_HOLD_BY_KIND.sabre 补读, 其余 kind null 逐位不变)');
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

console.log('\n══ NEG-C: 摘 19-input 军刀右键分流门的 startMelee(\'slash\') 行 ⇒ RMB 真事件端到端 定向红 ══');
{
const {G}=bootStart(CAMPI,[2],'NEG-C');
const r=G(`(function(){
try{
var out={};
player.hp=100; player.alive=true; player.meleeCd=0;
_toSabre();
pointerLocked=true;
dispatchEvent(new MouseEvent('mousedown',{button:2}));
out.state=VM.state; out.kind=VM.meleeKind;
return out;
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(r.err){ ok(false,'NEG-C 异常 '+r.err); }
else{
ok(r.state==='melee'&&r.kind==='slash','NEG-C [期望红] RMB 真事件仍起手横斩 (state='+r.state+', kind='+r.kind+')');
}
}

console.log('\n══ NEG-D: 摘 \'nade\' 投掷弧收尾的还臂行 ⇒ 持刀投弹收尾藏回 定向红 ══');
{
const {G}=bootStart(CAMPI,[3],'NEG-D');
const r=G(`(function(){
try{
var out={};
player.hp=100; player.alive=true; player.meleeCd=0;
_toSabre();
player.nadeCount=2;
VM.state='nade'; VM.stateT=0; VM.stateDur=999;
player.nadeHeld=true; player.nadeFuse=NADE_FUSE_T; player.nadeIsAT=false; player.nadeIsSmoke=false; player.nadeIsIncin=false; vmSndFlags={};
for(var i=0;i<6;i++) updateViewModel(1/60,player);
out.holdL=VM.arms.L.visible;              // 进态置真 (块首行, NEG-D 不摘) = 补丁隔离证明
player.nadeHeld=false; VM.stateT=0; VM.stateDur=0.55;
for(var i=0;i<45;i++){ updateViewModel(1/60,player); if(VM.state==='idle') break; }
out.endState=VM.state;
out.endL=VM.arms.L.visible;               // ★NEG-D 判据: 摘还臂行后持刀收尾左臂滞留可见
return out;
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(r.err){ ok(false,'NEG-D 异常 '+r.err); }
else{
ok(r.holdL===true,'NEG-D [期望绿·隔离证明] 持刀举雷进态左臂仍置真 (visible='+r.holdL+')');
ok(r.endState==='idle'&&r.endL===false,'NEG-D [期望红] 持刀投掷弧收尾藏回 (state='+r.endState+', visible='+r.endL+')');
}
}

console.log('\n══ NEG-E: FP斩 gun.rotation 行回退旧曲线 ⇒ 跨身扫幅/中段立刃 定向红 ══');
{
const {G}=bootStart(CAMPI,[4],'NEG-E');
const r=G(`(function(){
try{
var out={};
var s=_meleeFP('slash',30,0.5);
out.wPeak=s.wPeak; out.swMin=s.swMin; out.midRz=s.midRz;
var c=_meleeFP('chop',42,0.7);   // 补丁隔离证明: 劈的立刃/斜劈通道是独立行, 不受斩行回退影响
out.chopRz=c.rzDnPeak; out.chopSpan=c.dnXSpan;
return out;
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(r.err){ ok(false,'NEG-E 异常 '+r.err); }
else{
ok(r.wPeak>=0.45&&r.swMin<=-0.55,'NEG-E [期望红] 斩跨身扫幅 (引刀 '+r.wPeak.toFixed(3)+' / 扫谷 '+r.swMin.toFixed(3)+')');
ok(r.midRz<=-0.5,'NEG-E [期望红] 斩中段立刃 rz ≤−0.5 (rz='+r.midRz.toFixed(3)+')');
ok(r.chopRz<=-0.9&&r.chopSpan>=0.08,'NEG-E [期望绿·隔离证明] 劈立刃/斜劈通道照常 (rz='+r.chopRz.toFixed(3)+', 行程 '+r.chopSpan.toFixed(3)+')');
}
}

console.log('\n────');
console.log('[阴性对照] 通过 '+PASS.length+' 项 (含定向绿隔离证明), 红 '+FAILN+' 项 (红=判据具备分辨力)');
if(FAILN===0){ console.log('✗ 阴性对照全绿 = 判据空转!'); process.exitCode=1; }
else process.exitCode=1;   // 阴性模式固定退出码 1 (与 deathflight/nadecancel 同款口径)
}
