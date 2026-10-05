// ─────────────────────────────────────────────
// dev/verify-killattr.js —— 击杀来源归因 + 受击方向弧验证 (不进 Index.html)
// 用法: node dev/verify-killattr.js
// 背景 (2026-09-29 用户实报三缺陷):
//   ① 巴祖卡击杀步兵, 播报显示柯尔特 M1911 —— 玩家火箭分支提前 return 走不到 _src 行, 且标签挂
//      在射手身上、击杀结算才读 ⇒ 弹在飞时射手又开别的枪就记错;
//   ② 坦克被"STG44/M1911 击毁" —— 这两把枪没有 vehDmg 打不动坦克; 真凶是延迟杀伤弹体 (火箭/迫击
//      炮弹等), 结算时射手身上的标签已被后续开火覆盖。(取证: 普通手雷走 explodeAt, 本就伤不到坦克)
//   ③ 受击方向弧生成时算一次写死, 玩家转向后不重算。
// 修复口径 (2026-09-29 用户裁定): 弹体自带 src 标签 + 命中/爆炸结算前重盖章; 方向弧定格世界方位、
//   每帧只随玩家朝向重算 (updateDirHits)。
// 判据:
//   T1 玩家火箭: 旧 _src=手枪 → 发射即盖章巴祖卡; 飞行中被手枪覆盖 → 命中重盖章, 播报 [巴祖卡 M9];
//   T2 Bot 火箭→坦克: 射手飞行中"切枪打步枪" → 车毁播报 [坦克杀手], 绝无 M1911/STG;
//   T3 迫击炮弹→坦克 (真创建点 emplMortarShell): 飞行中射手打 STG → 车毁播报 [迫击炮], 绝无 STG;
//   T4 throwNade 四档弹体标签映射 (手雷/反坦克炸药/烟雾弹/燃烧弹);
//   T5 方向弧: 受击生成 _wAng; 玩家转向 1rad 后 updateDirHits 重算, 屏上相对角恰随动 -1rad
//      (rel=worldAng-yaw+PI, yaw+1 ⇒ rel-1 —— 弧反向滑动保持指向真实世界方位); 同侧合并仍续期;
//   T6 updateHUD 逐帧段携带弧运行不抛 (22-hud → 21-match.updateDirHits 接线)。
// 载入清单: 运行时解析 index.html 的 script 标签 (2026-09-28 教训: 清单与实载不一致 = 盲区假绿)。
// 沙箱要点 (取证自 _killattr-dbg/-dbg2): ①开局后玩家未部署, 须先 deployPlayer(); ②裸全局 CANNON 要
//   挂 ctx (window.CANNON 在 vm 里不是全局 —— ragdoll 链 ragInit 直接引用); ③选点必须避开水面
//   (heightAt≤waterYAt 即河床, 弹体入水=哑火) 且每轮尝试**旋转起始方位** (首个开阔方位可能正对着
//   一辆吞弹不死的坦克, 固定角度重试=原地打转); ④deploy 后 0.5s 出生保护生效中, 受击判据前清
//   player.protUntil; ⑤22-hud.hudStyle 调 style.setProperty, DOM 桩要补。
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
// CANNON 桩 (与 _destruct-audit 同源): ragInit/spawnRagdoll 需要 World.gravity/Body.addShape 等
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
const CAMPI=3; // 淞沪 (verify-wipe 同源: 攻防图, 有坦克有步兵)

const ctx=boot(CAMPI);
const G=s=>vm.runInContext(s,ctx);

// ── 开局 + 部署 (取证: startBtn 后玩家 alive=false, 须 deployPlayer) ──
let err0=null;
try{ G("document.getElementById('startBtn').onclick();"); }catch(e){ err0=String(e&&e.stack||e); }
if(!err0){ try{ G('if(!player.alive||!player.deployed) deployPlayer();'); }catch(e){ err0='deployPlayer: '+String(e&&e.stack||e); } }
if(err0||!G('player.alive')){ console.log('  ✘ 开局/部署失败 '+(err0||'player.alive=false')); process.exit(1); }
G('for(const s of soldiers) s.protUntil=0; player.protUntil=0;'); // 出生保护 0.5s (玩家/Bot 同口径): 免伤会吞掉整条受击/击杀链, 探针全清
ok(G('soldiers.length')>0&&G('tanks.length')>0,'前置: 战场已开局并部署 (soldiers='+G('soldiers.length')+', tanks='+G('tanks.length')+')');

// ── 公用 vm 片段 ──
G(`
function _isLand(x,z){ return heightAt(x,z)>waterYAt(x,z)+0.4; }   // 河床/水面判据: 入水弹=哑火
function _findClear(o,dist,a0){                                     // 开阔且全程陆地的射向; a0=起始方位 (每轮旋转防原地打转)
for(var da=0.2;da<Math.PI*2;da+=0.25){
var a=a0+da, dx=Math.sin(a),dz=Math.cos(a);
var mid={x:o.x+dx*dist*0.5,z:o.z+dz*dist*0.5}, end={x:o.x+dx*dist,z:o.z+dz*dist};
if(!_isLand(end.x,end.z)||!_isLand(mid.x,mid.z)) continue;
// 双高度清空: 眼高射线 (人视角) + 低位射线 (弹道飞行高度 y≈0.9 —— 沙袋/矮墙挡弹不挡眼)
if(raycastWorld(V3(o.x,o.y+1.5,o.z),V3(dx,0,dz),dist)) continue;
if(raycastWorld(V3(o.x,heightAt(o.x,o.z)+0.55,o.z),V3(dx,0,dz),dist)) continue;
return end;
}
return null;
}
function _feed(){
var k=document.getElementById('killfeed'),out=[];
for(var i=0;i<k.children.length;i++) out.push(k.children[i].innerHTML);
return out.join(' || ');
}
function _pickEnemy(){
for(var i=0;i<soldiers.length;i++){ var s=soldiers[i]; if(s.alive&&!s.isPlayer&&s.team!==player.team&&!s.onVehicle&&!s.spectator) return s; }
return null;
}
function _pickTank(team){
for(var i=0;i<tanks.length;i++){ var t=tanks[i]; if(t.alive&&t.team!==team) return t; }
return null;
}
`);

// ══ T1 玩家火箭 (bug ①) ══
console.log('T1 玩家火箭击杀步兵 → 播报 [巴祖卡 M9] (发射即盖章 + 命中重盖章)');
const t1=G(`(function(){
try{
var E=_pickEnemy(); if(!E) return {err:'无敌方步兵'};
var n0=0; for(const s of soldiers) if(!s.alive) n0++;
var stamp=null,anyDead=false,feed='';
for(var att=0;att<8&&!anyDead;att++){
var spot=_findClear(player.pos,18,att*0.9); if(!spot) return {err:'无开阔陆地射向'};
E.pos.set(spot.x,heightAt(spot.x,spot.z),spot.z); E.crouch=false; E.prone=false;
var d=V3(E.pos.x-player.pos.x,(E.pos.y+1.2)-(player.pos.y+1.5),E.pos.z-player.pos.z).normalize();
player._src='柯尔特 M1911';            // 旧账: 先前打过手枪 (原 bug 的复现前置)
fireRocket(player,V3(player.pos.x,player.pos.y+1.5,player.pos.z),d,WPN_DEFS.bazooka,null);
if(!stamp) stamp=player._src;           // 修复点①: 发射即盖章
player._src='柯尔特 M1911';            // 最恶劣时序: 弹在飞时又补了一枪手枪
for(var i=0;i<60;i++){ updateShells(0.05,0.05); var nd=0; for(const s of soldiers) if(!s.alive) nd++; if(nd>n0){ anyDead=true; break; } }
}
return {stamp:stamp,anyDead:anyDead,feed:_feed()};
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t1.err){ ok(false,'T1 异常 '+t1.err); }
else{
ok(t1.stamp==='巴祖卡 M9','T1 发射即盖章: _src="巴祖卡 M9" (旧码此处仍是手枪名)');
// 判据落在"归因"上: 火箭沿线最近者吃弹 (可能是指定的 E, 也可能是挡在走廊里的路人敌兵), 谁死不重要, 播报必须记在火箭头上
ok(t1.anyDead,'T1 火箭击杀敌方步兵 (沿线最近者)');
ok(t1.feed.indexOf('巴祖卡 M9')>=0,'T1 播报含 [巴祖卡 M9]');
ok(t1.feed.indexOf('M1911')<0,'T1 播报不含 M1911');
}

// ══ T2 Bot 火箭→坦克 (bug ② 之 M1911 案) ══
console.log('T2 Bot 火箭击毁坦克 → 播报 [坦克杀手] (飞行中切枪也不串账)');
const t2=G(`(function(){
try{
var B=_pickEnemy(); if(!B) return {err:'无敌方步兵'};
var T=_pickTank(B.team); if(!T) return {err:'无敌方坦克'};
var dead=false,feed='';
for(var att=0;att<6&&!dead;att++){
var spot=_findClear(T.pos,25,att*0.9); if(!spot) return {err:'坦克旁无开阔陆地'};
B.pos.set(spot.x,heightAt(spot.x,spot.z),spot.z); B.crouch=false; B.prone=false;
T.hp=120;                                // 预伤: 保证一发火箭必毁 (不改变归因链路)
var d=V3(T.pos.x-B.pos.x,(T.pos.y+1.2)-(B.pos.y+1.5),T.pos.z-B.pos.z).normalize();
B._src='柯尔特 M1911';                  // 旧账
fireRocket(B,V3(B.pos.x,B.pos.y+1.5,B.pos.z),d,WPN_DEFS.schreck,null);
B._src='STG 44';                        // 飞行中又打了一梭步枪
for(var i=0;i<60;i++){ updateShells(0.05,0.05); if(!T.alive) break; }
dead=!T.alive;
}
return {dead:dead,feed:_feed()};
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t2.err){ ok(false,'T2 异常 '+t2.err); }
else{
ok(t2.dead,'T2 火箭击毁坦克');
ok(t2.feed.indexOf('坦克杀手 RPzB54')>=0,'T2 播报含 [坦克杀手 RPzB54]');
ok(t2.feed.indexOf('M1911')<0&&t2.feed.indexOf('STG')<0,'T2 播报不含 M1911/STG');
}

// ══ T3 迫击炮弹→坦克 (bug ② 之 STG 案; 真创建点 emplMortarShell) ══
console.log('T3 迫击炮弹击毁坦克 → 播报 [迫击炮] (飞行中射手打 STG 也不串账)');
const t3=G(`(function(){
try{
var Gd=_pickEnemy(); if(!Gd) return {err:'无敌方步兵'};
var T=_pickTank(Gd.team); if(!T) return {err:'无敌方坦克'};
T.hp=30;                                 // 预伤: 一发迫击炮的非AP车伤 (≈0.3×130+) 足以补刀
var mx=T.pos.x-15, mz=T.pos.z-15;
var mo={x:mx,y:heightAt(mx,mz)+1.2,z:mz};
emplMortarShell(mo,Gd,T.pos.x,T.pos.z);  // 真创建路径: 盖 _src='迫击炮' + 弹体 src
var stamp0=Gd._src;
Gd._src='STG 44';                        // 弹道飞行期间射手又打了一梭 STG (原 bug 的串账源)
for(var k=0;k<120;k++){ updateNades(0.05,0.05); if(!T.alive) break; }
return {stamp0:stamp0,dead:!T.alive,src:Gd._src,feed:_feed()};
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t3.err){ ok(false,'T3 异常 '+t3.err); }
else{
ok(t3.stamp0==='迫击炮','T3 真创建点已盖 _src=[迫击炮] + 弹体自带 src');
ok(t3.dead,'T3 迫击炮弹击毁坦克');
ok(t3.feed.indexOf('迫击炮')>=0,'T3 播报含 [迫击炮]');
ok(t3.feed.indexOf('STG')<0,'T3 播报不含 STG');
ok(t3.src==='迫击炮','T3 射手 _src 已被重盖回 [迫击炮]');
}

// ══ T4 throwNade 标签映射 ══
console.log('T4 throwNade 四档弹体标签');
const t4=G(`(function(){
try{
var who=_pickEnemy(); if(!who) return {err:'无敌方步兵'};
var n0=nades.length;
throwNade(who,V3(who.pos.x,who.pos.y+1.5,who.pos.z),V3(0,0.1,0),9,false,false,false);
throwNade(who,V3(who.pos.x,who.pos.y+1.5,who.pos.z),V3(0,0.1,0),9,true,false,false);
throwNade(who,V3(who.pos.x,who.pos.y+1.5,who.pos.z),V3(0,0.1,0),9,false,true,false);
throwNade(who,V3(who.pos.x,who.pos.y+1.5,who.pos.z),V3(0,0.1,0),9,false,false,true);
var got=[];
for(var i=n0;i<nades.length;i++) got.push(nades[i].src);
nades.length=n0;                         // 拆走测试弹, 不让它真炸
return {got:got};
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t4.err){ ok(false,'T4 异常 '+t4.err); }
else{
ok(t4.got.join(',')==='手雷,反坦克炸药,烟雾弹,燃烧弹','T4 标签映射 手雷/反坦克炸药/烟雾弹/燃烧弹 (got: '+t4.got.join(',')+')');
}

// ══ T5 受击方向弧 (bug ③) ══
console.log('T5 方向弧: 定格世界方位, 每帧随玩家朝向重算');
const t5=G(`(function(){
try{
var H=_pickEnemy(); if(!H) return {err:'无敌方步兵'};
var spot=_findClear(player.pos,8,0); if(!spot) return {err:'无开阔位'};
H.pos.set(spot.x,heightAt(spot.x,spot.z),spot.z);
player.protUntil=0;                      // deploy 后 0.5s 出生保护生效中: 受击判据前清掉 (只挡敌伤)
player.hp=Math.max(player.hp,80);
var box=document.getElementById('dirHits');
var n0=box.children.length;
player.damage(6,H,false);
if(box.children.length<=n0) return {err:'受击未生成弧'};
var d=box.children[box.children.length-1];
var w0=d._wAng, r0=-parseFloat(/rotate\\(([-0-9.]+)rad\\)/.exec(d.style.transform)[1]);
player.yaw+=1.0;                         // 玩家转头 1rad
updateDirHits();
var r1=-parseFloat(/rotate\\(([-0-9.]+)rad\\)/.exec(d.style.transform)[1]);
// 合并: 同侧再吃一弹 → 不新增弧, _wAng 续期
var nM=box.children.length;
player.damage(6,H,false);
var merged=(box.children.length===nM);
var d2=box.children[box.children.length-1];
return {w0:w0,r0:r0,r1:r1,merged:merged,wM:d2._wAng};
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t5.err){ ok(false,'T5 异常 '+t5.err); }
else{
// rel=worldAng-yaw+PI, 屏上角 r=rel (解析还原); yaw+1 ⇒ rel-1 ⇒ 弧反向滑动 1rad 而世界指向不变
ok(Math.abs((t5.r1-t5.r0)+1.0)<1e-6,'T5 转向 1rad 后弧屏上相对角随动 -1rad (旧码恒定不动) — r0='+t5.r0.toFixed(4)+' r1='+t5.r1.toFixed(4));
ok(t5.merged,'T5 同侧合并仍生效 (弧数不增)');
ok(Math.abs(t5.wM-t5.w0)<1e-6,'T5 合并后续用最新世界方位');
}

// ══ T6 updateHUD 逐帧段接线 ══
console.log('T6 updateHUD 携带方向弧逐帧运行');
let t6err=null;
try{ for(let i=0;i<3;i++) G('updateHUD(0.016);'); }catch(e){ t6err=String(e&&e.stack||e); }
ok(!t6err,'T6 updateHUD(带弧) 不抛 '+(t6err||''));

console.log('────');
console.log('通过 '+PASS.length+' 项, 失败 '+FAILN+' 项');
process.exit(FAILN?1:0);
