// ─────────────────────────────────────────────────────────────
// dev/verify-seatbar-20261120.js —— 2026-11-20 火力点坐姿批 (不下车包扎/原位换弹) 验收
//
// 用法: node dev/verify-seatbar-20261120.js [--neg]
//   正常 = 全量判据 (T1..T5 + 源码防回退), 必须全绿。
//   --neg = 阴性对照, 两支**各自隔离 boot** (锚=最终代码的逐字行):
//     NEG-A okH 行恢复 !onMG/!onAT/!onAA ⇒ "MG 座位上 H 起步包扎" 定向红 (硬挡前身回归);
//           mortar 座位起步+完成照常绿 = 补丁隔离证明。
//     NEG-B readBarActive 摘 ||this.seatReload>0 ⇒ "seatReload 中 barStealArmed('KeyH') 首按 false"
//           定向红 (打断链回归: 首按直通=双击确认约定失效);
//           包扎读条中 barStealArmed('KeyR') 首按仍 false = 补丁隔离证明。
//
// 用户裁定 (不可改): 乘坐**固定火力点** (onMG/onAT/onAA/onMortar/onBattery 五旗) 可以**不下车**完成
//   换弹与包扎; 打断走既有**连按两次 (双击确认)** 约定 (barStealArmed 单源); 载具 (onVehicle)/艇船
//   (onNaval)/巡飞 (loiter) 一律维持现状不放开。
//   固定火力点没有弹药账户 —— "换弹"= 玩家**随身武器 curW** 的原位换弹 (账挂 player.seatReload),
//   完成结算复用 finishReload。
//
// 覆盖:
//   T1 坐着包扎: 五旗逐一座位 (各造假对象, 直挂旗标照 verify-aimassist:394 范式) → H 起步 →
//      逐帧推进不被打断 → 完成 +45/绷带-1/VM 归位 idle → 再按 H 能再次起步; 全程座位旗标未变。
//      MG (前身=硬挡) 与 mortar (前身=起步即断) 两类旧病灶都真踩到。
//   T2 原位换弹: curW 半匣+有备弹 → tryReload(true) → seatReload 起步 (时长=reloadDurOf 单源) →
//      逐帧推进 → mag/reserve 按 finishReload 语义结算; 弹满/无备弹不起步; 过程中左键不取消且
//      座位开火 tick 不炸; X 即时清账; 下车下一 tick 静默清账。
//   T3 双击打断约定: seatReload 中 barStealArmed('KeyH') 首按 false/窗内二按 true → H 双击包扎替换
//      换弹; R 同键加速 (余时-2.5% 钳 0.01); 坐着包扎中 R 双击 → 换弹替换包扎。
//   T4 收账继承: cancelReadBar 静默清账 / 死亡 die() 清账 / readBarActive 认账 (源码+行为)。
//   T5 HUD: rb 链 seatReload 分支显示 ('原位换弹' 词条+宽度>0), _seated 门不挡它。
//
// 口径: loader 骨架照 verify-melee-20261120 (stub + 忠实 CANNON 桩 + index.html 全脚本链 + 淞沪开局
//   + startBtn/deployPlayer/protUntil=0); 造假座位对象照 verify-aimassist:394-415 (直挂旗标不走 F,
//   字段按 20a-seats/15f 各座位 tick 实际读取补齐); 键盘/鼠标经 listeners 捕获真派发 (dynreload/
//   proneknee 同款), pointerLocked 直置 (combathub/specthird 先例: 同 realm 可写); soldiers 清空冻结
//   AI (步进 updatePlayer 期间无流弹打断读条 — 判据要确定性)。
// ─────────────────────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const stub=require('./_bootstub.js');
require('./_bootpatch.js').patch(stub.sandbox);
// Obj3.clear 桩补齐 (deployPlayer 的 UI 清理会调; 真 THREE 有 Group.clear)
{const P=Object.getPrototypeOf(stub.THREE.Group.prototype); if(!P.clear) P.clear=function(){ this.children.length=0; };}
// style.setProperty 桩补齐 (22-hud.hudStyle 的 CSSOM 写法; T5 要跑 updateHUD)
const _ensureStyle=e=>{ if(e&&e.style&&!e.style.setProperty) e.style.setProperty=(k,v)=>{ e.style[k]=v; }; return e; };
{const doc=stub.document,og=doc.getElementById.bind(doc),oc=doc.createElement.bind(doc);
doc.getElementById=id=>_ensureStyle(og(id));
doc.createElement=t=>_ensureStyle(oc(t));}
// V3 桩忠实化 (T2 要跑 updatePlayerMG 的 mouseDown 开火支): 真 THREE.Vector3 有 cross/negate
// (20a-seats 机枪散布算 uv=_scA.copy(rv).cross(dir).negate()), 桩缺 ⇒ 开火支一碰即抛。
// 语义: cross(v)=this×v (crossVectors(this,v)); negate=原位取反。其余链路 (addScaledVector/normalize) 桩已有。
{const VP=stub.THREE.Vector3.prototype;
if(!VP.cross) VP.cross=function(v){ return this.crossVectors(this,v); };
if(!VP.negate) VP.negate=function(){ this.x=-this.x; this.y=-this.y; this.z=-this.z; return this; };}
// CANNON 桩 (与 verify-melee 同源): die→spawnRagdoll 需要 World/Body 等 (T4 死亡清账走真 die 链)
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
// NEG-A (index 0): okH 恢复旧三旗 ⇒ MG/AT/AA 座位 H 起步被硬挡 (前身行为回归) 定向红
{file:'js/19-input.js',from:'const okH=player.bandages>0&&player.hp<100&&!player.onVehicle&&!player.loiter;',
to:'const okH=player.bandages>0&&player.hp<100&&!player.onVehicle&&!player.onMG&&!player.onAT&&!player.onAA&&!player.loiter;'},
// NEG-B (index 1): readBarActive 摘 seatReload 项 ⇒ seatReload 中 barStealArmed 首按直通 (双击确认失效) 定向红
{file:'js/18-game.js',from:'||!!this.vehRepair||this.seatReload>0',to:'||!!this.vehRepair'},
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
// listeners 捕获 (dynreload/proneknee 同款): keydown/mousedown 真派发用; document/window 各给**本 boot 私有副本**
// (stub.document 是跨 boot 共享单例, 直接挂会串场 — 每支隔离 boot 的监听表必须各是各的)
const listeners={};
const addL=(t,f)=>{ (listeners[t]=listeners[t]||[]).push(f); };
ctx.addEventListener=addL;
ctx.document=Object.assign({},stub.document,{addEventListener:addL,removeEventListener(){}});
ctx.window=Object.assign({},stub.window,{addEventListener:addL,removeEventListener(){}});
ctx.dispatchEvent=ev=>{ if(!ev.preventDefault) ev.preventDefault=()=>{}; if(!ev.stopPropagation) ev.stopPropagation=()=>{}; for(const f of (listeners[ev.type]||[]).slice()) f(ev); return true; };
ctx.KeyboardEvent=class{ constructor(t,o){ o=o||{}; this.type=t; this.code=o.code; this.repeat=!!o.repeat; } };
ctx.MouseEvent=class{ constructor(t,o){ o=o||{}; this.type=t; this.button=o.button; } };
ctx.CANNON=CANNON;
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
const CAMPI=3; // 淞沪 (melee 同源: 攻防图, 有坦克有步兵)

// ── 公用 vm 片段 (每 boot 注入): 座位造假/主链步进/播报捕获 ──
const HELPERS=`
// 五旗清单与旗标名 (与 19-input/20-player/22-hud 的火力点五旗逐字同序)
var SEAT_KINDS=['mg','at','aa','mortar','battery'];
var SEAT_FLAG={mg:'onMG',at:'onAT',aa:'onAA',mortar:'onMortar',battery:'onBattery'};
// 造假座位对象 (verify-aimassist:394 范式; 字段按 20a-seats updatePlayerMG/AT/AA/Mortar 与
// 15f updatePlayerBattery 实际读取补齐 — cd 顶满防止 mouseDown 误开火, grp/tube/yaw/pitch 给可写 rotation)
function _mkSeat(kind){
var px=player.pos.x, py=player.pos.y, pz=player.pos.z;
if(kind==='mg') return {x:px,y:py,z:pz,face:0,yaw:{rotation:{x:0,y:0}},pitch:{rotation:{x:0}},heat:0,fireT:0,alive:true,user:null,def:null};
if(kind==='at') return {x:px,y:py,z:pz,face:0,cd:99,cdMax:99,alive:true,user:null,yaw:{rotation:{x:0,y:0}},pitch:{rotation:{x:0}}};
if(kind==='aa') return {x:px,y:py,z:pz,cd:99,cdMax:99,alive:true,user:null,yaw:{rotation:{x:0,y:0}},pitch:{rotation:{x:0}}};
if(kind==='mortar') return {x:px,y:py,z:pz,face:0,cd:99,cdMax:99,alive:true,user:null,grp:{rotation:{x:0,y:0}},tube:{rotation:{x:0}}};
return {x:px,y:py,z:pz,face:0,cd:99,cdMax:99,alive:true,user:null,yaw:{rotation:{x:0,y:0}},pitch:{rotation:{x:0}}};   // battery
}
// 直挂旗标上/下座位 (不走 F — aimassist 同款; 返回座位对象供"旗标未变"断言)
function _seat(kind){ var s=_mkSeat(kind); player[SEAT_FLAG[kind]]=s; return s; }
function _unseat(kind){ player[SEAT_FLAG[kind]]=null; }
// 主链逐帧步进: updatePlayer (包扎 tick / 原位换弹 tick / 座位分派全在里面); updateViewModel 座位上
// 本就该停 (24-main 座位门), 这里不补推 — 与实机口径一致。
function _step(n){ for(var i=0;i<(n||1);i++) updatePlayer(1/60,1/60); }
// 真键派发 (keydown+keyup 成对; 19-input 的键处理器是边沿触发)
function _key(code){ dispatchEvent(new KeyboardEvent('keydown',{code:code})); dispatchEvent(new KeyboardEvent('keyup',{code:code})); }
function _mdown(){ dispatchEvent(new MouseEvent('mousedown',{button:0})); }
function _mup(){ dispatchEvent(new MouseEvent('mouseup',{button:0})); }
// 播报捕获 (animfix 手法): 断言"被打断/完成/已取消"文案用
function _popsOn(){ window.__pops=[]; showScorePop=function(t){ window.__pops.push(String(t)); }; }
function _pops(){ return (window.__pops||[]).slice(); }
// 玩家态复位: 读条/座位/武器账全清 (每用例隔离, 防跨用例残账)
function _reset(){
var p=player;
p.alive=true; p.deployed=true; p.spectator=false; p.specView=false; p.specViewHost=null;
p.hp=50; p.bandages=4; p.bandaging=0; p.seatReload=0; p.seatReloadDur=0;
p.onVehicle=null; p.onMG=null; p.onAT=null; p.onAA=null; p.onMortar=null; p.onBattery=null; p.onNaval=null;
p.loiter=null; p.grabAction=null; p.useCast=null; p.vehRepair=null; p.demolish=null;
p.crouch=false; p.prone=false; p.braced=false; p.flying=false; p.swim=false; p.chute=false;
p.nadeHeld=false; p.meleeCd=0; p.lastDmgT=nowT; p.barArmKey=null; p.protUntil=0;
if(typeof VM!=='undefined'){ VM.state='idle'; VM.stateT=0; VM.stateDur=0; if(VM.root) VM.root.visible=true; }
if(typeof vmAbortAction==='function') vmAbortAction();
}
// 半匣换弹起步 (T2/T3/T4 共用): curW 半匣 + 有备弹 → tryReload(true) → 返回起步时长
function _startSeatReload(){
var w=player.curW;
w.mag=Math.min(3,w.def.mag-1); w.reserve=60;
tryReload(true);
return player.seatReloadDur;
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
G('pointerLocked=true;');   // 键鼠派发的前置门 (19-input: !player.alive||!pointerLocked 早退)
// 冻结 AI: 步进 updatePlayer 期间不允许流弹打断读条 (判据要确定性; 本探针不需要真 Bot)
G('globalThis.__solSave=soldiers.slice(); soldiers.length=0;');
G(HELPERS);
return {ctx,G};
}

// ═══════════════════ 正常模式: 全量判据 ═══════════════════
if(!NEG){
const {G}=bootStart(CAMPI,null,'正常');
section('前置');
ok(G('player.alive')===true,'战场已开局并部署 (soldiers 冻结='+G('soldiers.length')+', player.alive=true)');
ok(G('typeof player.seatReload!=="undefined"&&typeof player.seatReloadDur!=="undefined"')===true,
'player.seatReload/seatReloadDur 字段就位 (18-game 工厂)');

// ── T1 坐着包扎 ──
const SEAT_KINDS=['mg','at','aa','mortar','battery'];   // 火力点五旗 (与 HELPERS 内 SEAT_KINDS 同一份, Node 侧驱动循环)
const SEAT_FLAG={mg:'onMG',at:'onAT',aa:'onAA',mortar:'onMortar',battery:'onBattery'};
section('T1 坐着包扎: 五旗逐一座位 → H 起步 → 逐帧推进不被打断 → 完成 +45/VM 归位 → 再按 H 能再次起步 (不下车)');
for(let si=0;si<SEAT_KINDS.length;si++){
const kind=SEAT_KINDS[si];
const tag={mg:'MG (前身=okH 硬挡)',at:'AT',aa:'AA',mortar:'mortar (前身=readBarBusy 起步即断)',battery:'battery (旧版键门吞 H)'}[kind];
const r=G(`(function(){
try{
var out={};
_reset(); _popsOn();
var seat=_seat('${kind}');
_key('KeyH');
out.started=player.bandaging>0;
out.vmState=VM.state;
out.flagOn=player['${SEAT_FLAG[kind]}']===seat;
_step(170);   // 2.83s > BANDAGE_T 2.6s
out.pops=_pops();
out.interrupted=out.pops.indexOf('包扎被打断!')>=0;
out.completed=out.pops.indexOf('包扎完成 +45')>=0;
out.hp=player.hp; out.bandages=player.bandages;
out.vmIdle=VM.state==='idle';
out.flagStill=player['${SEAT_FLAG[kind]}']===seat;
// 回归门: 再按 H 能再次起步 (VM 归位后座位上可连做)
_key('KeyH');
out.restarted=player.bandaging>0;
// 清场: 收读条 + 摘座位 + 一步静默 (不让残账漏进下一座)
player.cancelReadBar(null,true);
_unseat('${kind}');
_step(1);
out.afterSeat=player['${SEAT_FLAG[kind]}'];
return out;
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(r.err){ ok(false,'T1['+tag+'] 异常 '+r.err); continue; }
ok(r.started===true,'T1['+tag+'] H 起步包扎 (bandaging>0, VM.state='+r.vmState+')');
ok(r.vmState==='bandage','T1['+tag+'] VM 进 bandage 态');
ok(r.flagOn===true,'T1['+tag+'] 座位旗标在 (造假座位已挂)');
ok(r.interrupted===false&&r.completed===true,'T1['+tag+'] ★逐帧推进不被打断且完成 (打断播报='+(r.interrupted?'有':'无')+', 完成+45='+(r.completed?'有':'无')+')');
ok(r.bandages===3,'T1['+tag+'] 绷带 4→3');
ok(r.hp===95,'T1['+tag+'] 恰 +45 (50→'+r.hp+')');
ok(r.vmIdle===true,'T1['+tag+'] ★VM 归位 idle (座位上 24-main 不收 VM 账, 完成块代收)');
ok(r.flagStill===true,'T1['+tag+'] ★全程座位旗标未变 (不下车)');
ok(r.restarted===true,'T1['+tag+'] ★再按 H 能再次起步 (VM 卡 bandage 的回归门)');
ok(r.afterSeat===null,'T1['+tag+'] 清场: 座位已摘');
}

// ── T2 原位换弹 ──
section('T2 原位换弹: 半匣+有备弹起步 → 逐帧推进 → finishReload 结算; 弹满/无备弹不起步; 左键不取消/座位开火不炸; X 清账; 下车静默清账');
{
const r=G(`(function(){
try{
var out={};
_reset(); _popsOn();
var seat=_seat('mg');
var w=player.curW;
var dur=_startSeatReload();
out.started=player.seatReload>0&&player.seatReloadDur>0;
out.dur=dur; out.defReload=w.def.reload;
out.vmState=VM.state;
// 结算前快照
var mag0=w.mag, res0=w.reserve;
var need=w.def.mag-mag0, take=Math.min(need,res0);
out.take=take;
// 逐帧推进到完成 (260 帧 = 4.33s, 覆盖全部步枪 reload 时长)
_step(260);
out.afterSeatReload=player.seatReload; out.afterDur=player.seatReloadDur;
out.mag=w.mag; out.reserve=w.reserve;
out.expMag=mag0+take; out.expRes=res0-take;
// 弹满不起步
w.mag=w.def.mag; w.reserve=55;
tryReload(true);
out.fullBlocked=player.seatReload===0&&player.seatReloadDur===0;
// 无备弹不起步
w.mag=1; w.reserve=0;
tryReload(true);
out.noResBlocked=player.seatReload===0&&player.seatReloadDur===0;
// 过程中左键不取消 (mousedown 豁免) 且座位开火 tick 不炸 (aimassist 造假字段)
w.mag=3; w.reserve=55;
tryReload(true);
out.reloadMid=player.seatReload;
var heat0=seat.heat;
_mdown();                       // 左键: 豁免分支 → 不取消, mouseDown=true 落给座位开火
out.afterClickSeatReload=player.seatReload;
var ex='';
try{ mouseDown=true; updatePlayerMG(1/60); updatePlayerMG(1/60); }catch(e2){ ex=String(e2&&e2.message||e2); }
mouseDown=false; _mup();
out.fireErr=ex;
out.fired=seat.heat>heat0;      // 热量涨了 = 点击真落给了座位开火 tick
out.noCancelPop=_pops().indexOf('已取消')<0;
// X 即时清账
_key('KeyX');
out.xCleared=player.seatReload===0&&player.seatReloadDur===0;
out.xPop=_pops().indexOf('已取消')>=0;
// 下车 (清旗标) 下一 tick 静默清账 (无弹损失 — mag/reserve 不动)
w.mag=3; w.reserve=55;
tryReload(true);
out.mid2=player.seatReload>0;
_popsOn();                      // 重开捕获: 断言"静默"
player.onMG=null;
_step(2);
out.dismountCleared=player.seatReload===0&&player.seatReloadDur===0;
out.magUntouched=w.mag===3&&w.reserve===55;
out.silent=_pops().indexOf('已取消')<0&&_pops().indexOf('换弹被打断!')<0;
_unseat('mg');
return out;
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(r.err){ ok(false,'T2 异常 '+r.err); }
else{
ok(r.started===true,'T2 原位换弹起步 (seatReload>0 且 seatReloadDur>0)');
ok(Math.abs(r.dur-r.defReload)<1e-9,'T2 ★时长=reloadDurOf 单源 (dur='+r.dur.toFixed(3)+' = w.def.reload '+r.defReload.toFixed(3)+' — streakBuff 空 + dynReloadFac 1)');
ok(r.vmState!=='reload'&&r.vmState==='idle','T2 VM 无份 (state='+r.vmState+' — 账在 player 不在 VM)');
ok(r.afterSeatReload===0&&r.afterDur===0,'T2 逐帧推进到完成 (账清零)');
ok(r.mag===r.expMag&&r.reserve===r.expRes,'T2 ★结算=finishReload 语义 (mag '+r.mag+'/'+r.expMag+', reserve '+r.reserve+'/'+r.expRes+', take='+r.take+')');
ok(r.fullBlocked===true,'T2 ★弹满不起步');
ok(r.noResBlocked===true,'T2 ★无备弹不起步');
ok(Math.abs(r.afterClickSeatReload-r.reloadMid)<1e-9,'T2 ★左键不取消 (seatReload 逐位不变: '+r.reloadMid.toFixed(3)+')');
ok(r.fireErr===''&&r.fired===true,'T2 ★座位开火 tick 不炸且真开火 (err='+(r.fireErr||'无')+', 热量涨='+r.fired+')');
ok(r.noCancelPop===true,'T2 左键无"已取消"播报');
ok(r.xCleared===true&&r.xPop===true,'T2 ★X 即时清账 (cancelReadBar 单源, 播"已取消")');
ok(r.mid2===true&&r.dismountCleared===true,'T2 ★下车下一 tick 清账 (五旗全空=打断)');
ok(r.magUntouched===true,'T2 下车打断无弹损失 (mag/reserve 不动)');
ok(r.silent===true,'T2 下车打断静默 (无播报 — 与"换弹被打断!"文案链区分)');
}
}

// ── T3 双击打断约定 ──
section('T3 双击打断: seatReload 中 barStealArmed 首按 false/二按 true; H 双击包扎替换换弹; R 同键加速 (钳 0.01); 包扎中 R 双击换弹替换包扎');
{
const r=G(`(function(){
try{
var out={};
_reset(); _popsOn();
_seat('mg');
var w=player.curW;
_startSeatReload();
// barStealArmed 单源行为 (不打断不起步, 只探针问询)
out.arm1=player.barStealArmed('KeyH');
out.arm2=player.barStealArmed('KeyH');
// H 双击: 打断换弹 → 包扎 (barStealArmed 已被上面两次问询清账, 真派发重新双击)
_key('KeyH'); _key('KeyH');
out.bandaging=player.bandaging>0;
out.seatReloadGone=player.seatReload===0&&player.seatReloadDur===0;
out.vmBandage=VM.state==='bandage';
// 收包扎, 再起一次换弹测 R 同键加速
player.cancelReadBar(null,true);
w.mag=3; w.reserve=55;
tryReload(true);
var d0=player.seatReload, dur0=player.seatReloadDur;
tryReload(true);   // 同键加速: 余时 - dur*2.5%
var exp=Math.max(0.01,d0-dur0*0.025);
out.accelExp=exp; out.accelGot=player.seatReload;
// 钳 0.01: 余时已低于一步加速量时不再向下击穿
player.seatReload=0.005;
tryReload(true);
out.clampGot=player.seatReload;
// 坐着包扎中 R 双击 = 打断包扎再换弹 (包扎被替换)
w.mag=3; w.reserve=55; player.seatReload=0; player.seatReloadDur=0;
_key('KeyH'); _key('KeyH');   // 双击起步包扎 (首按被换弹账武装, 二按确认)
out.band2=player.bandaging>0;
_key('KeyR'); _key('KeyR');   // 双击确认打断包扎 → 原位换弹
out.bandGone=player.bandaging===0;
out.reloadBack=player.seatReload>0&&player.seatReloadDur>0;
out.vmIdleAfter=VM.state==='idle';
_unseat('mg');
return out;
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(r.err){ ok(false,'T3 异常 '+r.err); }
else{
ok(r.arm1===false&&r.arm2===true,'T3 ★seatReload 中 barStealArmed(\'KeyH\'): 首按 false (只武装) / 窗内二按 true (确认) — 双击约定单源');
ok(r.bandaging===true&&r.seatReloadGone===true&&r.vmBandage===true,'T3 ★H 双击: 换弹被打断, 包扎替换起步 (seatReload 清零, VM bandage)');
ok(Math.abs(r.accelGot-r.accelExp)<1e-9,'T3 ★R 同键加速: 余时 -2.5% ('+r.accelGot.toFixed(4)+' = exp '+r.accelExp.toFixed(4)+')');
ok(Math.abs(r.clampGot-0.01)<1e-9,'T3 加速钳 0.01 (0.005 → '+r.clampGot+')');
ok(r.band2===true,'T3 包扎再次起步 (H 双击, 首按被残账武装不影响)');
ok(r.bandGone===true&&r.reloadBack===true&&r.vmIdleAfter===true,'T3 ★包扎中 R 双击: 包扎被替换为原位换弹 (bandaging=0, seatReload>0, VM idle)');
}
}

// ── T4 收账继承 ──
section('T4 收账继承: cancelReadBar 静默/死亡 die() 清账/readBarActive 认账 (源码+行为)');
{
const r=G(`(function(){
try{
var out={};
_reset(); _seat('mg');
_startSeatReload();
out.active=player.readBarActive();
// cancelReadBar quiet: 收账无播报
_popsOn();
var hit=player.cancelReadBar(null,true);
out.hit=hit===true;
out.cleared=player.seatReload===0&&player.seatReloadDur===0;
out.quiet=_pops().length===0;
out.inactive=player.readBarActive()===false;
// 死亡 die() 路径: 读条随死亡一次收口 (真 die 链)
_startSeatReload();
out.active2=player.readBarActive();
player.die(null);
out.dead=player.alive===false;
out.deadCleared=player.seatReload===0&&player.seatReloadDur===0;
out.seatReleased=player.onMG===null;   // die 的座位交还链 (releaseEmpl)
_unseat('mg');
return out;
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(r.err){ ok(false,'T4 异常 '+r.err); }
else{
ok(r.active===true,'T4 ★readBarActive 认账 (seatReload>0 ⇒ true — X/受击门/双击确认的前提)');
ok(r.hit===true&&r.cleared===true,'T4 cancelReadBar 清账 (any=true)');
ok(r.quiet===true,'T4 cancelReadBar quiet 无播报');
ok(r.inactive===true,'T4 清账后 readBarActive 归 false');
ok(r.active2===true,'T4 死亡前读条在 (取证前提)');
ok(r.dead===true&&r.deadCleared===true,'T4 ★die() 路径清账 (读条随死亡一次收口)');
ok(r.seatReleased===true,'T4 die 座位交还链原样 (onMG=null)');
}
ok(SRC('js/18-game.js').includes('||!!this.vehRepair||this.seatReload>0'),'T4 源码锚: readBarActive 含 seatReload 项');
}

// ── T5 HUD ──
section('T5 HUD: rb 链 seatReload 分支显示 (原位换弹词条+宽度>0), _seated 门不挡它');
{
const r=G(`(function(){
try{
var out={};
_reset(); _popsOn();
var seat=_seat('mg');
var w=player.curW;
w.mag=3; w.reserve=55;
tryReload(true);
out.started=player.seatReload>0;
_step(40);   // 起步瞬间的进度恰为 0% (k=1-余/总) — 先推 40 帧再画条, 宽度判据才有分辨力
updateHUD(1/60,1/60);   // 22-hud 读条臂逐帧段
var db=window._demolishBar;
out.shown=db.wrap.style.display;
out.lab=db.lb.textContent;
out.width=parseFloat(db.fill.style.width)||0;
out.seat=player.onMG===seat;
_unseat('mg');
return out;
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(r.err){ ok(false,'T5 异常 '+r.err); }
else{
ok(r.started===true&&r.seat===true,'T5 前置: MG 座位上原位换弹中 (起步=是, 座位在=是)');
ok(r.shown==='block','T5 读条臂显示 (display='+r.shown+')');
ok(r.lab.indexOf('原位换弹')>=0,'T5 ★词条含"原位换弹" (lab="'+r.lab+'")');
ok(r.width>0&&r.width<100,'T5 ★进度宽度>0 (width='+r.width.toFixed(1)+'% — 座位上不被 _seated 门挡; 若走 VM 分支会被 !_seated 藏掉)');
}
}

// ── 源码防回退 (关键单源/数值/语义) ──
section('源码防回退');
{
const s18=SRC('js/18-game.js'), s19=SRC('js/19-input.js'), s20=SRC('js/20-player.js'),
s22=SRC('js/22-hud.js'), si18n=SRC('js/00b-i18n.js');
ok(s18.includes('seatReload:0, seatReloadDur:0,'),'18: player.seatReload/seatReloadDur 字段初始化');
ok(s18.includes('readBarActive(){ return this.bandaging>0||!!this.demolish||!!this.useCast||!!this.vehRepair||this.seatReload>0'),
'18: readBarActive 认 seatReload 账 (取消网扩容)');
ok(s18.includes("readBarBusy(){ return !this.alive||!!this.onVehicle||!!this.onNaval||!!this.loiter||!!this.grabAction||(typeof VM!=='undefined'&&VM.state!=='bandage'); },"),
'18: readBarBusy 摘五旗 (坐固定火力点不再构成包扎打断; 载具/艇船/巡飞/取弹/VM 抢态全保留)');
ok(s18.includes('if(this.seatReload>0||this.seatReloadDur>0){ this.seatReload=0; this.seatReloadDur=0; any=true; }'),
'18: cancelReadBar 收 seatReload 账 (X/受击>25/死亡/stealBar/换局全自动继承)');
ok(s19.includes('function reloadDurOf(w){')&&s19.includes('return w.def.reload*(player.streakBuff?player.streakBuff.reloadMul:1)*dynReloadFac(w.mag,w.def.mag);'),
'19: reloadDurOf 时长单源 (步行/坐姿两处共用)');
ok(s19.includes('const okH=player.bandages>0&&player.hp<100&&!player.onVehicle&&!player.loiter;'),
'19: okH 摘三旗 (火力点五座放行包扎; onVehicle/loiter 维持硬挡)');
ok(s19.includes('if(!w||player.onVehicle) return;'),'19: tryReload 座位门只留载具 (不新增 onNaval — 海战维持现状)');
ok(s19.includes("if((player.onMG||player.onAT||player.onAA||player.onMortar||player.onBattery)&&(typeof VM!=='undefined'&&VM.state==='reload')){ VM.state='idle'; vmSndFlags={}; }"),
'19: 冻账收编 (上车前遗留的 VM 换弹静默收掉, 弹不结算)');
ok(s19.includes('if(player.seatReload>0){ player.seatReload=Math.max(0.01,player.seatReload-player.seatReloadDur*BAR_PRESS_BOOST); return; }')
&&s19.includes('player.seatReload=d; player.seatReloadDur=d;'),
'19: 火力点分支 (同键加速钳 0.01 + 时长单源起步)');
ok(s19.includes('VM.stateDur=reloadDurOf(w);'),'19: 步行收尾时长行改调单源 (行内公式退场)');
ok((s19.match(/barStealArmed\('KeyR'\)/g)||[]).length===1,'19: barStealArmed(\'KeyR\') 恰 1 处 (双击确认单源不重复)');
ok(s19.includes("if(e.button===0&&player.readBarActive()&&!(typeof VM!=='undefined'&&(VM.state==='nade'&&player.nadeHeld||VM.state==='reload'))&&!(player.seatReload>0||((player.onMG||player.onAT||player.onAA||player.onMortar||player.onBattery)&&player.bandaging>0))){"),
'19: mousedown 左键豁免扩坐姿两支 (原位换弹/五旗包扎 — 座位开炮不取消读条)');
ok(s19.includes("if(e.code==='KeyF'){ tryInteract(); return; }")&&s19.includes("else if(e.code!=='KeyH'&&e.code!=='KeyR') return;"),
'19: 岸防炮键门放行 H/R (旧版整段吞键 = 炮位上 H/R 死键, 与五旗裁定矛盾)');
ok(s20.includes('if(p.seatReload>0){')&&s20.includes('if(!(p.onMG||p.onAT||p.onAA||p.onMortar||p.onBattery)){ p.seatReload=0; p.seatReloadDur=0; }')
&&s20.includes('p.finishReload();'),
'20: seatReload tick 在座位早退之前 (下车=静默清账; 完成结算复用 finishReload)');
ok(s20.includes("if((p.onMG||p.onAT||p.onAA||p.onMortar||p.onBattery)&&(typeof VM!=='undefined')&&VM.state==='bandage'){"),
'20: 包扎完成块补 VM 归位 (座位上 24-main 不跑 updateViewModel — 不归位则下次 H 起不了步)');
ok(s22.includes(":player.seatReload>0?{lab:t2('原位换弹: {0}s'")&&s22.includes("VM.state==='reload'&&!_seated"),
'22: rb 链 seatReload 分支在位且不吃 _seated 门 (VM 换弹分支的座位门保持)');
ok(si18n.includes("'原位换弹: {0}s':'In-place reload: {0}s'"),'i18n: 原位换弹词条中英配对');
ok(si18n.includes("'调试模式不可在战地整备中切换':'Debug mode cannot be toggled during field refit'"),
'i18n: ④批欠账补齐 (调试模式战地整备拦截提示 EN)');
}

console.log('\n────');
console.log('通过 '+PASS.length+' 项, 失败 '+FAILN+' 项');
if(FAILN) process.exitCode=1;
}

// ═══════════════════ 阴性对照: 两支各自隔离 boot, 恰好定向红 ═══════════════════
if(NEG){

console.log('\n══ NEG-A: okH 恢复 !onMG/!onAT/!onAA ⇒ MG 包扎起步 定向红 ══');
{
const {G}=bootStart(CAMPI,[0],'NEG-A');
const r=G(`(function(){
try{
var out={};
// MG (硬挡前身): H 起步必须失败
_reset(); _popsOn();
_seat('mg');
_key('KeyH');
out.mgStarted=player.bandaging>0;
_unseat('mg');
// 补丁隔离证明: mortar 不在旧三旗里, 起步+完成照常 (readBarBusy 新口径未被本补丁碰)
_reset(); _popsOn();
_seat('mortar');
_key('KeyH');
out.mtStarted=player.bandaging>0;
_step(170);
out.mtPops=_pops();
out.mtDone=out.mtPops.indexOf('包扎完成 +45')>=0&&out.mtPops.indexOf('包扎被打断!')<0;
out.mtIdle=VM.state==='idle';
_unseat('mortar');
return out;
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(r.err){ ok(false,'NEG-A 异常 '+r.err); }
else{
ok(r.mgStarted===true,'NEG-A [期望红] MG 座位上 H 起步包扎 (硬挡前身回归)');
ok(r.mtStarted===true&&r.mtDone===true&&r.mtIdle===true,'NEG-A [期望绿·隔离证明] mortar 起步+完成+VM 归位照常 (旧三旗补丁碰不到的座位)');
}
}

console.log('\n══ NEG-B: readBarActive 摘 seatReload 项 ⇒ 打断链 (barStealArmed 首按只武装) 定向红 ══');
{
const {G}=bootStart(CAMPI,[1],'NEG-B');
const r=G(`(function(){
try{
var out={};
_reset(); _popsOn();
_seat('mg');
_startSeatReload();
out.active=player.readBarActive();
// 首按必须只武装 (false) — 摘账后 readBarActive 假 ⇒ barStealArmed 直通 true = 双击确认失效
out.arm1=player.barStealArmed('KeyH');
// 补丁隔离证明: 包扎读条 (bandaging) 的账仍被认 — R 首按仍只武装
player.cancelReadBar(null,true);
_key('KeyH'); _key('KeyH');   // 双击起步包扎
out.bandOn=player.bandaging>0;
out.armR=player.barStealArmed('KeyR');
player.cancelReadBar(null,true);
_unseat('mg');
return out;
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(r.err){ ok(false,'NEG-B 异常 '+r.err); }
else{
ok(r.active===true,'NEG-B [期望红] readBarActive 认 seatReload 账');
ok(r.arm1===false,'NEG-B [期望红] seatReload 中 barStealArmed(\'KeyH\') 首按只武装 (false)');
ok(r.bandOn===true&&r.armR===false,'NEG-B [期望绿·隔离证明] 包扎读条链照常 (bandaging 起步 + R 首按仍 false)');
}
}

console.log('\n────');
console.log('[阴性对照] 通过 '+PASS.length+' 项 (含定向绿隔离证明), 红 '+FAILN+' 项 (红=判据具备分辨力)');
if(FAILN===0){ console.log('✗ 阴性对照全绿 = 判据空转!'); }
process.exitCode=1;   // 阴性模式固定退出码 1 (与 melee/nadecancel 同款口径)
}
