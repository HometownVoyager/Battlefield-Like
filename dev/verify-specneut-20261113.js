// ─────────────────────────────────────────────
// dev/verify-specneut-20261113.js —— 观战中立×七项修复批 (2026-11-13)
// 用法: node dev/verify-specneut-20261113.js [--neg]
// 七项:
//   ①观战小队中立: 14-bots 小队指令块 spectator 门 (旧门只有 follow 的 player.alive, 调试观战 alive=true
//     ⇒ 小队跟幽灵满图跑; move 分支连 alive 门都没有) + 22-hud 小队HUD 观战隐藏 + 小地图/大地图/部署图
//     着色单源 solMapDotColor (观战本队不再画小队白点, 一律阵营蓝; 敌方照常 mmEnemyVis 后红)。
//   ②观战武器中立补全 (coFfFire 只保护过 3 条路径的历史缺口):
//     对空链 planeHitTest excludeTeam 观战放行 (观战连狙/幽灵坦克同轴机枪可打"开局己方"飞机);
//     投掷物出手盖章 thrower.spectator?-1:team (反坦克炸药/航弹/手持迫击炮弹的 nadeStep 载具触发圈
//     三处 + 接触引信对双方都认; 爆炸溅射 2026-11-09 批已中立);
//     载具击杀归因三处 (Tank/Plane/NavalCraft.die) attacker 门收进 coFfFire (观战步战火力毁"己方"
//     载具照常记分/播报/vehKills —— 旧门只认 ffAll)。
//   ③飞机残骸建筑扫掠: updatePlaneWrecks fall 段旧位→新位 rayBox/rayCyl (复用存活机 _plSw* 共享槽),
//     命中就地迫降贴面 (不打 crater; die 后 0.6s 内不补第二声爆炸/溅射) + Plane.update 撞楼死亡位
//     拉回命中面前 0.5m (旧版残骸出生在帧末积分位, 机鼻余量命中时可能已嵌墙 ⇒ rayBox 盒内不再报命中
//     = 永久穿楼)。
//   ④Q附身门: 幽灵坦克驾驶/巡飞弹操控/座位态不吃附身 (19-input 键位门 + dbgSpecPossess 第二道门,
//     旧版两套视角同帧叠加 = 严重错位)。
//   ⑤换弹中左键不再取消 (与按 R 同义; 举雷左键例外保留; VM.state!=='idle' 本就打不出枪, 不吞键)。
//   ⑥投掷物世界模型放大 NADE_WORLD_SCALE 1.5→2.5 (出手件+三人称手持同乘; 一人称手上件不跟放)。
//   ⑦出生离边门 SPAWN_EDGE_MARGIN=20 (00-config 单源): 17-emplacements spawnEdgeOk/spawnEdgeClamp
//     单源 + pickSpawnPoint 候选闸/最终保险 + findFreeSpawn + NAV.spawnSpot + cmdSquadSpawnNear +
//     开局小队铺开 —— "特定朝向房子×世界边缘"楔缝免疫。
// 判据: T1 着色单源矩阵; T2 小队跟随行为级 (干净场地 直调 decide, NAV.budget/RAY_BUDGET 手动复位);
//   T3 对空端到端 (spectator/ffAll 伤己方机★ + 非观战阴性); T4 AT雷直击己方坦克 (空中触发★/地面触发阴性);
//   T5 击杀归因 (观战 Plane.die(player) kills+1★ / 非观战阴性); T6 残骸楼顶迫降 (合成盒+落顶高度);
//   T7 撞楼死亡位拉回 (残骸出生在墙面外★); T8 Q附身门 (座位/巡飞弹拒★+正常路径未坏);
//   T9 readBarActive 语义 (reload 在读条网上); T10 出生离边 (语义/兜底钳回/贴边 spot 全链);
//   T11 源码防回退锚 (与 NEG 补丁一一对应)。
//   --neg: 十四补丁累积注入, 判据必须转红。
// 沙箱要点承 verify-ffneutral-20261109 (boot/SRC/PATCH_MAP/真开局+deployPlayer/引用追踪);
//   行为级摆位承 verify-aircollide-20261110 (CF 走廊搜索/合成碰撞盒/直调 update)。
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

// ── NEG 阴性对照: 十四补丁累积注入 (正常跑不启用) ──
const NEG=process.argv.includes('--neg');
const SRC={},PATCH_MAP={};
const NEG_PATCHES=[
// N1 小队 spectator 门拆: T2 红
['js/14-bots.js','if(this.inSquad&&!player.spectator&&!(engaged&&distT<20)){','if(this.inSquad&&!(engaged&&distT<20)){'],
// N2 对空链 excludeTeam 观战放行拆: T3 红
['js/13-combat.js','planeHitTest(origin,dir,wallD,coFfFire(shooter)?-1:shooter.team);','planeHitTest(origin,dir,wallD,shooter.team);'],
// N3 投掷物出手 team=-1 盖章拆: T4 红
['js/13-combat.js','thrower,team:(thrower.spectator?-1:thrower.team),','thrower,team:thrower.team,'],
// N4 载具击杀归因记账拆 (战机+坦克两处): T5 红 (★2026-11-28 友伤记账批跟走: 门已改"任何有归属击毁
//   +自毁排除" — from 换新门行, to 仍回 2026-11-13 前的 ffAll||异队 窄门, 观战步战火力毁车不再记分=T5 红)
['js/16-aircraft.js','if(attacker&&attacker!==_pilot){','if(attacker&&(attacker.ffAll||attacker.team!==this.team)){'],
['js/15-vehicles.js','if(attacker&&attacker!==driver){','if(attacker&&(attacker.ffAll||attacker.team!==this.team)){'],
// N5 残骸建筑扫掠拆: T6 红 (穿楼落地)
['js/16-aircraft.js','if(_wkmv>0.01){','if(false){'],
// N6 撞楼死亡位拉回拆: T7 红 (残骸出生在墙内)
['js/16-aircraft.js','this.pos.set(_plSwHit.x-_plSwD.x*0.5,_plSwHit.y-_plSwD.y*0.5,_plSwHit.z-_plSwD.z*0.5);',';'],
// N7 19-input Q 附身接线拆: T11 锚13 红 (拒绝门收拢 20-player 单点, 19-input 块不留三态门)
['js/19-input.js','if(b) dbgSpecPossess(b);','if(false) dbgSpecPossess(b);'],
// N8 dbgSpecPossess 第二道门拆: T8 红
['js/20-player.js','if(player.onVehicle||player.onNaval||player.loiter){','if(false){'],
// N9 换弹左键豁免拆: T11 锚红
['js/19-input.js',"(VM.state==='nade'&&player.nadeHeld||VM.state==='reload'))","(VM.state==='nade'&&player.nadeHeld))"],
// N10 出生离边门拆 (语义+钳回): T10 红
['js/17-emplacements.js','return Math.abs(x)<=l&&Math.abs(z)<=l;','return true;'],
['js/17-emplacements.js','return [clamp(x,-l,l),clamp(z,-l,l)];','return [x,z];'],
// N11 观战着色分支拆 + 小队HUD门拆: T1/T11 红
['js/22-hud.js',"if(player.spectator) return (s.team===player.team)?'#5a9eff':'#ff5040';","if(false) return '#ffffff';"],
['js/22-hud.js','if(SQUAD.members.length&&player.deployed&&!player.spectator){','if(SQUAD.members.length&&player.deployed){'],
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
const CAMPI=3; // 淞沪 (ffneutral 同源, 陆战开阔)

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
function _heal(u){ u.alive=true; u.hp=100; u.onVehicle=null; u.spectator=false; u.prone=false; u.crouch=false; u.protUntil=0; }
function _pickFriend(){
for(var i=0;i<soldiers.length;i++){ var s=soldiers[i]; if(s.alive&&!s.isPlayer&&s.team===player.team&&!s.onVehicle&&!s.spectator) return s; }
return null;
}
// 干净走廊: 地形通视 + 坦/卡/艇净空 + 无兵 (fireBullet 里它们都是先于对空判定的硬挡弹/截停目标)
function _corridor(o,maxD){
for(var k=0;k<28;k++){
var a=0.31+k*0.224, dx=Math.sin(a), dz=Math.cos(a);
var d=V3(dx,0,dz);
if(raycastWorld(V3(o.x,o.y+0.2,o.z),d,maxD)) continue;
var vehFree=true, i;
for(i=0;i<tanks.length&&vehFree;i++){ var t=tanks[i]; if(t.alive&&rayCyl(o,d,vehHitCyl(t,{}),maxD)) vehFree=false; }
for(i=0;i<trucks.length&&vehFree;i++){ var u=trucks[i]; if(u.alive&&rayCyl(o,d,truckHitCyl(u,{}),maxD)) vehFree=false; }
if(!vehFree) continue;
if(raySoldiers(o,d,maxD,null)) continue;
if(typeof navalCraft!=='undefined'){ for(i=0;i<navalCraft.length;i++){ var c=navalCraft[i]; if(c&&c.alive){ var wx=c.pos.x-o.x, wz=c.pos.z-o.z; var tt=wx*dx+wz*dz; if(tt>0&&tt<maxD){ var px2=o.x+dx*tt, pz2=o.z+dz*tt; if(Math.hypot(px2-c.pos.x,pz2-c.pos.z)<8) vehFree=false; } } } if(!vehFree) continue; }
return d;
}
return null;
}
// 远离全部旗点的开阔陆地点 (小队跟随判据用: 目的地不可能恰好落在玩家身边)
function _farSpot(minD){
var R=MAP_SIZE/2-45;
for(var z=-R;z<=R;z+=11) for(var x=-R;x<=R;x+=11){
if(!_isLand(x,z)||occBlocked(x,z)) continue;
if(raycastWorld(V3(x,heightAt(x,z)+0.55,z),V3(0,1,0),3)) continue;
var ok2=true;
for(var i=0;i<FLAGS.length;i++){ if(Math.hypot(FLAGS[i].x-x,FLAGS[i].z-z)<minD){ ok2=false; break; } }
if(ok2) return {x:x,z:z};
}
return null;
}
// 步进雷到离账, 包装 nadeExplode 直接抓爆点 (splice 后 nd.pos 不可再读, 逐步快照会差一步)
function _stepNade(nd,cap){
var sN=0, blow=null;
var _oe=nadeExplode;
nadeExplode=function(n){ blow={x:n.pos.x,y:n.pos.y,z:n.pos.z}; return _oe(n); };
while(nades.indexOf(nd)>=0&&sN<cap){ updateNades(0.05,0.05); sN++; }
nadeExplode=_oe;
return {steps:sN,blow:blow};
}
// NAV.findPath 返回 [x,z] 数组对的数组 (14-bots followPath 用 wp[0]/wp[1]) —— 归一化成 {x,z}
function _pathEnd(p){
var n=null;
if(p&&p.pts&&p.pts.length) n=p.pts[p.pts.length-1];
else if(p&&p.nodes&&p.nodes.length) n=p.nodes[p.nodes.length-1];
else if(Array.isArray(p)&&p.length) n=p[p.length-1];
if(!n) return null;
if(Array.isArray(n)) return {x:n[0],z:n[1]};
return {x:n.x,z:n.z};
}
function _armOK(){ RAY_BUDGET.used=0; NAV.budget=99; }
`);

// ══ T1 着色单源矩阵 ══
console.log('T1 solMapDotColor 单源: 观战本队不再画小队白点 (一律阵营蓝), 非观战逐位保留');
const t1=G(`(function(){
try{
var sq={team:player.team,inSquad:true}, fr={team:player.team,inSquad:false}, en={team:1-player.team,inSquad:false}, zb={zombie:true,team:2};
player.spectator=false;
var r={plainSq:solMapDotColor(sq),plainFr:solMapDotColor(fr),plainEn:solMapDotColor(en),zb:solMapDotColor(zb)};
player.spectator=true;
r.specSq=solMapDotColor(sq); r.specFr=solMapDotColor(fr); r.specEn=solMapDotColor(en);
player.spectator=false;
return r;
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t1.err){ ok(false,'T1 异常 '+t1.err); }
else{
ok(t1.plainSq==='#ffffff','T1 非观战: 小队成员白点 (旧口径保留)');
ok(t1.plainFr==='#5a9eff'&&t1.plainEn==='#ff5040'&&t1.zb==='#9ecfa0','T1 非观战: 同队蓝/敌红/僵尸灰青 (旧口径保留)');
ok(t1.specSq==='#5a9eff','T1 ★观战: 小队成员不再白点 (阵营蓝 '+t1.specSq+') —— 白点特权视角取消核心判据');
ok(t1.specFr==='#5a9eff'&&t1.specEn==='#ff5040','T1 观战: 本队蓝/敌方照常红 (双方等权可见)');
}

// ══ T2 小队不跟随 (行为级) ══
console.log('T2 观战小队不跟随: 干净场地 直调 decide —— follow/move 两分支都不再听令, 非观战照常跟');
const t2=G(`(function(){
try{
var B=_pickFriend(); if(!B) return {err:'缺友军步兵'};
var FS=_farSpot(55); if(!FS) return {err:'无远离旗点的开阔地'};
// 清场: 别的兵/车全搬走 (存原位, 测后还原) —— kills/路径判据不容旁观单位
var saved=[];
for(var i=0;i<soldiers.length;i++){ var s=soldiers[i]; if(s!==B&&s!==player&&s.alive){ saved.push([s,s.pos.x,s.pos.y,s.pos.z]); s.pos.x+=500; s.pos.z+=500; } }
var savedV=[];
for(i=0;i<tanks.length;i++){ var t2v=tanks[i]; if(t2v.alive){ savedV.push([t2v,t2v.pos.x,t2v.pos.y,t2v.pos.z]); t2v.pos.x+=500; t2v.pos.z+=500; } }
for(i=0;i<trucks.length;i++){ var tv=trucks[i]; if(tv.alive){ savedV.push([tv,tv.pos.x,tv.pos.y,tv.pos.z]); tv.pos.x+=500; tv.pos.z+=500; } }
var oldMembers=SQUAD.members.slice(), oldMode=SQUAD.mode, oldInSquad=B.inSquad;
SQUAD.members=[B]; B.inSquad=true;
player.pos.set(FS.x,heightAt(FS.x,FS.z),FS.z); player.onVehicle=null;
var bx=FS.x+14, bz=FS.z+4;   // d≈14.6>10: follow 分支的 d>10 门必须真进来 (9.5m 会落到 defend)
B.pos.set(bx,heightAt(bx,bz),bz);
player.alive=true; player.spectator=false; player.specViewHost=null;
var out={};
// 对照组: 非观战 follow → 路径指向玩家 (小队门没把正常指挥写死)
SQUAD.mode='follow'; B.path=null; B.repathT=0; _armOK(); B.decide();
var pe=_pathEnd(B.path);
out.ctrlFollow=!!(pe&&Math.hypot(pe.x-player.pos.x,pe.z-player.pos.z)<9);
out.ctrlState=B.state;
// 观战 follow → 不再路径指向玩家
player.spectator=true; B.path=null; B.repathT=0; _armOK(); B.decide();
pe=_pathEnd(B.path);
out.specFollow=!(pe&&Math.hypot(pe.x-player.pos.x,pe.z-player.pos.z)<9);
out.specPathNullOr=(pe===null)?'null':'far'+Math.round(Math.hypot(pe.x-player.pos.x,pe.z-player.pos.z));
// 观战 move (标点进攻) → 不再冲标记点
SQUAD.mode='move'; SQUAD.pos={x:player.pos.x,z:player.pos.z};
B.path=null; B.repathT=0; _armOK(); B.decide();
pe=_pathEnd(B.path);
out.specMove=!(pe&&Math.hypot(pe.x-SQUAD.pos.x,pe.z-SQUAD.pos.z)<9);
// 还原
player.spectator=false;
SQUAD.members=oldMembers; SQUAD.mode=oldMode; B.inSquad=oldInSquad;
for(i=0;i<saved.length;i++){ saved[i][0].pos.x=saved[i][1]; saved[i][0].pos.y=saved[i][2]; saved[i][0].pos.z=saved[i][3]; }
for(i=0;i<savedV.length;i++){ savedV[i][0].pos.x=savedV[i][1]; savedV[i][0].pos.y=savedV[i][2]; savedV[i][0].pos.z=savedV[i][3]; }
return out;
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t2.err){ ok(false,'T2 异常 '+t2.err); }
else{
ok(t2.ctrlFollow===true,'T2 对照: 非观战 follow → 路径指向玩家 (门没把正常指挥写死; state='+t2.ctrlState+')');
ok(t2.specFollow===true,'T2 ★观战 follow → 不再路径指向玩家 ('+t2.specPathNullOr+') —— 跟幽灵满图跑修复核心判据');
ok(t2.specMove===true,'T2 ★观战 move (标点进攻) → 不再冲标记点 (move 分支旧无 alive 门)');
}

// ══ T3 对空中立: 观战/幽灵坦克(ffAll) 可打"开局己方"飞机 ══
console.log('T3 对空中立: planeHitTest excludeTeam 观战放行 —— 观战连狙/幽灵坦克同轴可命中己方飞机');
const t3=G(`(function(){
try{
var pl=planes.find(function(p){return p.team===player.team;});
if(!pl) return {err:'缺本队飞机'};
pl.alive=true; pl.playerDriven=false; pl.crewBot=null; pl.hp=pl.maxHp||100; pl.pitch=0;
var o=V3(player.pos.x,player.pos.y+1.2,player.pos.z);
var dir=_corridor(o,45); if(!dir) return {err:'无干净空中走廊'};
var pp=o.clone().addScaledVector(dir,40);
pl.pos.set(pp.x,pp.y,pp.z);
var DEF={dmg:5,headMul:1.9,snd:'mg',tracer:1,vehDmg:6};
var out={};
var hp0=pl.hp;
player.spectator=true;
fireBullet(player,o,dir,DEF,null);
out.specHit=pl.hp<hp0; out.specHp=pl.hp;
pl.hp=pl.maxHp||100;
player.spectator=false;
fireBullet(player,o,dir,DEF,null);
out.plainNoHit=pl.hp===(pl.maxHp||100);
pl.hp=pl.maxHp||100;
player.ffAll=true;   // 幽灵坦克同轴口径: fireBullet(player,...) + ffAll (coFfFire 真)
fireBullet(player,o,dir,DEF,null);
out.ffAllHit=pl.hp<(pl.maxHp||100);
player.ffAll=false;
pl.hp=pl.maxHp||100;
return out;
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t3.err){ ok(false,'T3 异常 '+t3.err); }
else{
ok(t3.specHit===true,'T3 ★观战本尊子弹命中"开局己方"飞机 (hp → '+t3.specHp.toFixed(1)+') —— 对空中立核心判据');
ok(t3.plainNoHit===true,'T3 阴性: 非观战玩家子弹对己方飞机照旧免疫 (excludeTeam 门未被写死拆掉)');
ok(t3.ffAllHit===true,'T3 ★幽灵坦克口径 (ffAll): 同轴机枪同链命中己方飞机');
}

// ══ T4 反坦克雷直击"己方"载具 ══
console.log('T4 AT雷直击: 观战出手 team=-1 ⇒ 载具触发圈对双方都认 (空中触发), 非观战照旧穿过去落地炸');
const t4=G(`(function(){
try{
var tk=null; for(var i=0;i<tanks.length;i++){ if(tanks[i].team===player.team){ tk=tanks[i]; break; } }
if(!tk) return {err:'缺本队坦克'};
var tkTeam=tk.team;
// ★2026-11-17b 判据加固: hp 100→500 —— ① 的观战 AT雷 (splashDamage 载具 340 ap, 圈缘命中 ≈185) 原本会把
// 100hp 的车当场炸毁, die() 当场注册的 3 只 2.5×1.9×2.5 残骸盒 (registerDynCollider) 正好躺在 ② 的弹道走廊里:
// 旧代码单步 0.45m 一脚踩进残骸盒心 0.44m 才爆 (爆点落盒内 y=0.59, 离地 0.10 巧过 <0.3 代理), 新代码子步
// 采样在盒面就爆 (0.32) 被误判"没落地"。让车活过 ① (只掉血不摧毁), ② 才是干净地对着"活着的友军坦克"测
// 载具圈认队 —— 活车不注册 RGRID 盒, 走廊净空, 落地才炸的判据才成立。
tk.alive=true; tk.hp=500; tk.playerDriven=false;
// 清场: 其它坦/卡搬走 (触发圈 2.6m 不容旁观车)
var savedV=[];
for(i=0;i<tanks.length;i++){ var t2v=tanks[i]; if(t2v!==tk&&t2v.alive){ savedV.push([t2v,t2v.pos.x,t2v.pos.y,t2v.pos.z]); t2v.pos.x+=500; t2v.pos.z+=500; } }
for(i=0;i<trucks.length;i++){ var tv=trucks[i]; if(tv.alive){ savedV.push([tv,tv.pos.x,tv.pos.y,tv.pos.z]); tv.pos.x+=500; tv.pos.z+=500; } }
// 摆坦克在玩家正前 5m 开阔陆地
var o=V3(player.pos.x,player.pos.y+1.4,player.pos.z);
var dir=null, tx=0, tz=0;
for(var k=0;k<28&&!dir;k++){
var a=0.17+k*0.224, dx=Math.sin(a), dz=Math.cos(a);
tx=player.pos.x+dx*5; tz=player.pos.z+dz*5;
if(!_isLand(tx,tz)||occBlocked(tx,tz)) continue;
if(raycastWorld(V3(tx,heightAt(tx,tz)+0.55,tz),V3(0,1,0),3)) continue;
// ★2026-11-17b 判据加固: 弹道走廊净空 —— 出手点沿 dir 0.75~6m 采样带内不得有低空盒 (旧判据只查摆车点,
// 走廊里有墙体/残骸盒时 AT雷撞面 0.32m 高度即爆被判"没落地"。撞墙/撞残骸即炸本是表外弹种老口径 (触发判据④),
// 子步采样 (2026-11-17 批2.ex 隧穿防护) 让爆点从"穿进盒里 0.44m 的内部点"挪到盒面=更诚实; 阴性组要测的
// 是"载具圈不认友军", 走廊必须净空, 落地高度 <0.3 才是有效代理)。带顶 1.6m 覆盖全程弹道 (1.4 出手→0.05 落地)。
var flyClear=true;
for(var m=0.75;m<=6&&flyClear;m+=0.75){
var sx=player.pos.x+dx*m, sz=player.pos.z+dz*m, sg=heightAt(sx,sz);
eachBoxNear(sx-0.5,sz-0.5,sx+0.5,sz+0.5,function(b){ if(b.minY<sg+1.6&&b.maxY>sg+0.05) flyClear=false; });
}
if(!flyClear) continue;
if(Math.abs(heightAt(tx,tz)-heightAt(player.pos.x,player.pos.z))>1) continue;
dir=V3(dx,0,dz);
}
if(!dir){ for(i=0;i<savedV.length;i++){ savedV[i][0].pos.x=savedV[i][1]; savedV[i][0].pos.y=savedV[i][2]; savedV[i][0].pos.z=savedV[i][3]; } return {err:'无摆坦克的开阔地'}; }
tk.pos.set(tx,heightAt(tx,tz),tz);
var out={};
// ① 观战: 空中触发 (触发圈命中时 ny 高于地面)
player.spectator=true;
player._src='反坦克炸药';
throwNade(player,o,V3(dir.x*9,-0.5,dir.z*9),9,true);
var nd=nades[nades.length-1];
var r1=_stepNade(nd,240);
out.specAirBlow=!!(r1.blow&&r1.blow.y-heightAt(r1.blow.x,r1.blow.z)>0.5);
out.specBlowH=r1.blow?(r1.blow.y-heightAt(r1.blow.x,r1.blow.z)):null;
out.specTankDmg=tk.hp<500;
out.specSteps=r1.steps;
// ② 非观战阴性: 同一条弹道不空中触发, 落地才炸 (车活着: 圈认队判据真成立, 且无残骸盒污染走廊)
tk.hp=500;
player.spectator=false;
player._src='反坦克炸药';
throwNade(player,o,V3(dir.x*9,-0.5,dir.z*9),9,true);
nd=nades[nades.length-1];
var r2=_stepNade(nd,240);
out.plainGroundBlow=!!(r2.blow&&r2.blow.y-heightAt(r2.blow.x,r2.blow.z)<0.3);
out.plainBlowH=r2.blow?(r2.blow.y-heightAt(r2.blow.x,r2.blow.z)):null;
out.plainSteps=r2.steps;
// 还原
tk.team=tkTeam; tk.hp=100;
for(i=0;i<savedV.length;i++){ savedV[i][0].pos.x=savedV[i][1]; savedV[i][0].pos.y=savedV[i][2]; savedV[i][0].pos.z=savedV[i][3]; }
return out;
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t4.err){ ok(false,'T4 异常 '+t4.err); }
else{
ok(t4.specAirBlow===true,'T4 ★观战 AT雷空中直击己方坦克触发 (步数 '+t4.specSteps+', 触发点高于地面) —— 直击中立核心判据');
ok(t4.specTankDmg===true,'T4 观战 AT雷爆炸伤到己方坦克 (hp 500 → '+t4.specTankDmg+' 已掉血, 溅射 -1 链; 只掉血不摧毁=无残骸盒污染)');
ok(t4.plainGroundBlow===true,'T4 阴性: 非观战 AT雷对己方坦克照旧穿过 (步数 '+t4.plainSteps+', 落地才炸)');
}

// ══ T5 载具击杀归因: 观战步战火力照常记分 ══
// ★2026-11-28 友伤记账批跟走: 门改"任何有归属击毁+自毁排除" (attacker!==_pilot) —— 观战/非观战毁"己方"
//   载具**都记账** (旧"非观战不记分"阴性随 EXPLO_FF 时代推翻), 见下方阴性翻转注释。
console.log('T5 击杀归因: Plane.die(attacker) 记账门 —— 观战毁"己方"战机 kills+3, 非观战同账+3');
const t5=G(`(function(){
try{
var pl=planes.find(function(p){return p.team===player.team;});
if(!pl) return {err:'缺本队飞机'};
pl.alive=true; pl.playerDriven=false; pl.crewBot=null; pl.hp=100;
var k0=player.kills;
player.spectator=true;
pl.die(player);
var specK=player.kills;
pl.alive=true;   // die 置 false, 复位再测阴性
player.spectator=false;
pl.die(player);
var plainK=player.kills;
pl.alive=true;
return {k0:k0,specK:specK,plainK:plainK};
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t5.err){ ok(false,'T5 异常 '+t5.err); }
else{
ok(t5.specK===t5.k0+3,'T5 ★观战火力毁"己方"战机照常记分 (kills '+t5.k0+' → '+t5.specK+') —— 归因补齐核心判据 (判据跟走 2026-11-28 票账批: Plane.die 车体杀+3, 旧口径+1)');
// ★2026-11-28 友伤记账批跟走 (用户实报"炸毁己方坦克没有记录和得分"): 旧阴性"非观战毁己方载具不记分"
//   是 11-13 当年"观战中立"批的口径, 随 EXPLO_FF 时代友军爆炸可伤己方载具与步兵链无队属门记账被本批
//   **有意推翻** (空机 attacker!==_pilot=null ⇒ +3)。阴性改为"与观战档同账"。
ok(t5.plainK===t5.specK+3,'T5 阴性翻转: 非观战毁己方战机**照常记账** +3 (kills '+t5.specK+' → '+t5.plainK+'; 20261128c 友伤记账批, 旧"不记分"口径作废)');
}

// ══ T6 残骸建筑扫掠: 楼顶迫降 ══
console.log('T6 残骸扫掠: 下落残骸撞合成盒顶 = 就地迫降贴顶 (旧版整只穿楼落地)');
const t6=G(`(function(){
try{
var o=V3(player.pos.x,player.pos.y,player.pos.z);
var spot=null;
for(var k=0;k<40&&!spot;k++){
var a=0.11+k*0.157, x=o.x+Math.sin(a)*26, z=o.z+Math.cos(a)*26;
if(!_isLand(x,z)||occBlocked(x,z)) continue;
var gh=heightAt(x,z);
if(raycastWorld(V3(x,gh+0.55,z),V3(0,1,0),4)) continue;
spot={x:x,z:z,gh:gh};
}
if(!spot) return {err:'无开阔摆盒地'};
var top=spot.gh+6;
globalThis._wkB=addBoxCollider(spot.x,spot.gh+3,spot.z,6,6,6);   // 顶面 = gh+6
var wm=new THREE.Group();
planeWrecks.push({m:wm,pos:V3(spot.x,top+4,spot.z),vel:V3(0,-9,0),yaw:0,pitch:0,roll:0,rollV:0,
attacker:null,team:0,state:'fall',smokeT:1,restT:24,col:null,size:3,ageT:2});
var w=planeWrecks[planeWrecks.length-1];
for(var f=0;f<120&&w.state==='fall';f++) updatePlaneWrecks(1/60);
var out={state:w.state,y:w.pos.y,top:top,gh:spot.gh,inXZ:Math.abs(w.pos.x-spot.x)<4.5&&Math.abs(w.pos.z-spot.z)<4.5};
killBox(globalThis._wkB);
var idx=planeWrecks.indexOf(w); if(idx>=0){ scene.remove(w.m); planeWrecks.splice(idx,1); }
return out;
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t6.err){ ok(false,'T6 异常 '+t6.err); }
else{
ok(t6.state==='rest','T6 残骸已停止下落 (state=rest)');
ok(t6.y>t6.top-0.6,'T6 ★残骸贴在楼顶 (y='+t6.y.toFixed(2)+' vs 顶='+t6.top.toFixed(2)+', 地面档应是 gh+0.45='+(t6.gh+0.45).toFixed(2)+') —— 穿楼修复核心判据');
ok(t6.inXZ,'T6 迫降点在盒投影内 (不偏出建筑)');
}

// ══ T7 撞楼死亡位拉回: 残骸出生在墙面外 ══
console.log('T7 死亡位拉回: 撞楼 die 时残骸出生位 = 命中面前 0.5m (旧版=帧末积分位, 已嵌墙 ⇒ 永久穿楼)');
const t7=G(`(function(){
try{
// 空旷走廊搜索 (承 aircollide ②, 放宽: 深水面走廊也算 —— 海面必平, 淞沪海面够宽):
// 陆地段要平 (起伏 ≤3m), 水面段 floor=waterY; 两类都要求无够到飞行高度的盒/柱
var R=MAP_SIZE/2-70, CF=null;
var tallBox=function(x0,z0,x1,z1,gy){ for(var i=0;i<BOXES.length;i++){ var b=BOXES[i]; if(b.dead) continue; if(b.maxX<x0||b.minX>x1||b.maxZ<z0||b.minZ>z1) continue; if(b.maxY>gy-0.4&&b.minY<gy+1.5) return true; } return false; };
var tallCyl=function(x0,z0,x1,z1,gy){ for(var j=0;j<CYLS.length;j++){ var c=CYLS[j]; if(c.dead||c.foliage) continue; if(c.x<x0-(c.r+1.5)||c.x>x1+(c.r+1.5)||c.z<z0-(c.r+1.5)||c.z>z1+(c.r+1.5)) continue; if(c.y1>gy-0.4&&c.y0<gy+1.5) return true; } return false; };
for(var z=-R;z<=R&&CF===null;z+=7) for(var x=-R;x<=R-40;x+=7){
var gh=heightAt(x,z), wy=waterYAt(x,z);
var isWater=(wy>-1e8&&wy>gh+0.5);
var fl=isWater?wy:gh;
if(fl<0.2||fl>45) continue;
if(!isWater){
if(occBlocked(x,z)) continue;
var flat=true;
for(var xx=x-3;xx<=x+38&&flat;xx+=3){ if(Math.abs(heightAt(xx,z)-fl)>3) flat=false; }
if(!flat) continue;
}
if(tallBox(x-6,z-6,x+40,z+6,fl+5)) continue;
if(tallCyl(x-6,z-6,x+40,z+6,fl+5)) continue;
CF={x:x,z:z,fl:fl};
}
if(!CF) return {err:'无空旷走廊'};
var face=CF.x+26;   // 盒近面 (盒心 CF.x+30, 半宽 4)
globalThis._pbB=addBoxCollider(CF.x+30,CF.fl+5,CF.z,8,10,8);
var PB=null; for(var i=0;i<planes.length;i++){ if(planes[i].alive){ PB=planes[i]; break; } }
if(!PB) return {err:'缺存活飞机'};
PB.respawn(); PB.alive=true; PB.playerDriven=false; PB.crewBot=null;
PB.pos.set(face-0.3,CF.fl+5,CF.z); PB.yaw=Math.PI/2; PB.pitch=0; PB.roll=0; PB.speed=40;
if(PB.fctl){ PB.fctl.bank=0; PB.fctl.pitchT=0; }
var wr0=planeWrecks.length;
for(var f=0;f<70&&PB.alive;f++) PB.update(1/60);
var out={dead:!PB.alive,wrN:planeWrecks.length-wr0,face:face};
if(planeWrecks.length>wr0){
var w=planeWrecks[planeWrecks.length-1];
out.wx=w.pos.x; out.wy=w.pos.y;
out.outside=w.pos.x<face+0.01;
out.aboveGround=w.pos.y>CF.fl+2.5;
}
killBox(globalThis._pbB);
return out;
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t7.err){ ok(false,'T7 异常 '+t7.err); }
else{
ok(t7.dead===true,'T7 平飞撞楼机毁 (aircollide ③-1 同判据, 确认场景成立)');
ok(t7.wrN===1,'T7 残骸恰好 +1 (die 原子交接未受影响)');
ok(t7.outside===true,'T7 ★残骸出生位在墙面外 (x='+t7.wx.toFixed(2)+' < 近面 '+t7.face.toFixed(2)+') —— 旧版≈帧末位已嵌墙 +0.07, 拉回后 -0.5');
ok(t7.aboveGround===true,'T7 亡位仍在墙高 (y='+t7.wy.toFixed(1)+' > 地面+2.5), 拉回未把撞楼改成坠地');
}

// ══ T8 Q附身门: 座位/巡飞弹态拒绝, 正常路径未坏 ══
console.log('T8 Q附身门: 幽灵坦克驾驶/巡飞弹操控中 dbgSpecPossess 直接拒绝, 摘除后正常附身照常');
const t8=G(`(function(){
try{
var b=_pickFriend(); if(!b) return {err:'缺可附身 Bot'};
_heal(b);
if(typeof VM!=='undefined'&&VM) VM.state='idle';
player.spectator=true; player.alive=true; player.specViewHost=null;
var out={};
player.onVehicle={kind:'ghost'};
dbgSpecPossess(b);
out.ghostBlocked=player.specViewHost===null;
player.onVehicle=null;
player.loiter={};
dbgSpecPossess(b);
out.loiterBlocked=player.specViewHost===null;
player.loiter=null;
dbgSpecPossess(b);
out.normalOK=player.specViewHost===b;
if(player.specViewHost) dbgSpecDetach();
out.detached=player.specViewHost===null;
player.spectator=false;
return out;
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t8.err){ ok(false,'T8 异常 '+t8.err); }
else{
ok(t8.ghostBlocked===true,'T8 ★幽灵坦克驾驶态 (onVehicle) → 拒绝附身 (视角叠加病根门)');
ok(t8.loiterBlocked===true,'T8 ★巡飞弹操控态 (loiter) → 拒绝附身');
ok(t8.normalOK===true,'T8 步行观战正常附身路径未坏 (specViewHost 挂上)');
ok(t8.detached===true,'T8 附身后正常脱离还原 (E 路径未受影响)');
}

// ══ T9 readBarActive 语义: 换弹在读条网上 (左键豁免的判据基础) ══
console.log('T9 readBarActive: VM.state=reload ⇒ 在读条 (19-input 左键分支据此豁免, 不再走 cancelReadBar)');
const t9=G(`(function(){
try{
if(typeof VM==='undefined'||!VM) return {err:'缺 VM'};
player.nadeHeld=false;
VM.state='reload'; VM.stateT=1; VM.stateDur=5;
var inBar=player.readBarActive();
VM.state='idle';
var offBar=player.readBarActive();
return {inBar:inBar,offBar:offBar};
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t9.err){ ok(false,'T9 异常 '+t9.err); }
else{
ok(t9.inBar===true,'T9 换弹中 readBarActive()=true (读条网口径未变)');
ok(t9.offBar===false,'T9 空闲时 readBarActive()=false');
}

// ══ T10 出生离边门 ══
console.log('T10 出生离边: spawnEdgeOk 语义 + findFreeSpawn 兜底钳回 + 贴边 spot 全链不出边带');
const t10=G(`(function(){
try{
var lim=MAP_SIZE/2-4-SPAWN_EDGE_MARGIN;
var out={lim:lim};
out.okInside=spawnEdgeOk(0,0)===true;
out.okBoundary=spawnEdgeOk(lim,0)===true;
out.okOutside=spawnEdgeOk(lim+0.5,0)===false;
out.okHardEdge=spawnEdgeOk(MAP_SIZE/2-4,0)===false;
var fs=findFreeSpawn(MAP_SIZE/2-2,0);
out.findFreeIn=Math.max(Math.abs(fs[0]),Math.abs(fs[1]))<=lim+0.01;
out.findFreeVal=fs[0].toFixed(1);
var ns=NAV.spawnSpot(MAP_SIZE/2-2,0,24);
out.navSpotIn=Math.max(Math.abs(ns[0]),Math.abs(ns[1]))<=lim+0.01;
var ps=pickSpawnPoint(player.team,{x:MAP_SIZE/2+30,z:0,r:12});
out.pickIn=!!(ps&&Math.max(Math.abs(ps.x),Math.abs(ps.z))<=lim+0.01);
out.pickVal=ps?ps.x.toFixed(1):'null';
var pn=pickSpawnPoint(player.team,{x:0,z:0,r:12});
out.pickNormal=!!pn;
return out;
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t10.err){ ok(false,'T10 异常 '+t10.err); }
else{
ok(t10.okInside&&t10.okBoundary&&t10.okOutside&&t10.okHardEdge,'T10 ★spawnEdgeOk 语义 (带内 ✓ 边界 ✓ 带外 ✗ 活动极限 ✗; lim='+t10.lim+')');
ok(t10.findFreeIn===true,'T10 ★findFreeSpawn 贴边兜底钳回边带 (x='+t10.findFreeVal+' ≤ '+t10.lim+')');
ok(t10.navSpotIn===true,'T10 ★NAV.spawnSpot 搬迁不出边带');
ok(t10.pickIn===true,'T10 ★pickSpawnPoint 超边 spot 全链 (候选闸+兜底钳回) 落点在带内 (x='+t10.pickVal+')');
ok(t10.pickNormal===true,'T10 正常点位出生不受影响 (中心 spot 照常出点)');
}

// ══ T11 源码防回退锚 ══
console.log('T11 源码防回退锚 (与 NEG 十四补丁一一对应)');
{
const s14=srcOf('js/14-bots.js'),s22=srcOf('js/22-hud.js'),s23=srcOf('js/23-deploy.js'),
s13=srcOf('js/13-combat.js'),s15=srcOf('js/15-vehicles.js'),s16=srcOf('js/16-aircraft.js'),
s15d=srcOf('js/15d-naval.js'),s19=srcOf('js/19-input.js'),s20=srcOf('js/20-player.js'),
s09=srcOf('js/09-weapons.js'),s17=srcOf('js/17-emplacements.js'),s07=srcOf('js/07-nav.js'),
s26=srcOf('js/26-commander.js'),s00=srcOf('js/00-config.js');
ok(s14.includes('if(this.inSquad&&!player.spectator&&!(engaged&&distT<20)){'),'T11 锚1 14-bots 小队 spectator 门在位');
ok(s22.includes('function solMapDotColor(s){')&&s22.includes("if(player.spectator) return (s.team===player.team)?'#5a9eff':'#ff5040';"),'T11 锚2 22-hud 着色单源+观战分支在位');
ok(s22.includes('if(SQUAD.members.length&&player.deployed&&!player.spectator){'),'T11 锚3 22-hud 小队HUD 观战隐藏在位');
ok(s23.includes("(typeof solMapDotColor==='function')?solMapDotColor(s):")&&s23.includes("(typeof spawnEdgeOk!=='function'||spawnEdgeOk(wx,wz))"),'T11 锚4 23-deploy 部署图着色单源+小队铺开离边门在位');
ok(s13.includes('planeHitTest(origin,dir,wallD,coFfFire(shooter)?-1:shooter.team);'),'T11 锚5 13-combat 对空链观战放行在位');
ok(s13.includes('thrower,team:(thrower.spectator?-1:thrower.team),'),'T11 锚6 13-combat 投掷物出手中立盖章在位');
// ★2026-11-28 友伤记账批跟走: 三处门改"任何有归属击毁+自毁排除" (attacker!==driver/_pilot/船上玩家)
//   — 旧 coFfFire||异队 锚随之退役, 新锚保住同一语义 (有归属毁车必记账, 观战火力记分语义由新门自然覆盖)
ok(s15.includes('if(attacker&&attacker!==driver){'),'T11 锚7 15-vehicles 坦克归因记账门在位 (20261128c 跟走)');
ok(s16.includes('if(attacker&&attacker!==_pilot){'),'T11 锚8 16-aircraft 战机归因记账门在位 (20261128c 跟走)');
ok(s15d.includes('if(attacker&&attacker!==(this.playerDriven?player:null)){'),'T11 锚9 15d-naval 舰艇归因记账门在位 (20261128c 跟走)');
ok(s16.includes('if(_wkmv>0.01){')&&s16.includes('_plSwHit.t=_wkmv+(w.size||3)*1.5;'),'T11 锚10 16-aircraft 残骸建筑扫掠在位');
ok(s16.includes('this.pos.set(_plSwHit.x-_plSwD.x*0.5,_plSwHit.y-_plSwD.y*0.5,_plSwHit.z-_plSwD.z*0.5);'),'T11 锚11 16-aircraft 撞楼死亡位拉回在位');
ok(s16.includes('size:this.def.size, ageT:0')&&s16.includes("if(w.state==='fall'&&w.pos.y<=gh+0.6){"),'T12 锚12 残骸 size/ageT 账+地面档 state 门在位');
ok(s19.includes("if(e.code==='KeyQ'&&typeof dbgSpecPossess==='function')")&&s19.includes('if(b) dbgSpecPossess(b);'),'T11 锚13 19-input Q 附身接线在位 (拒绝门收拢 20-player 单点=锚15; 19-input 块无三态门保 timestopfix T8 契约)');
ok(s19.includes("(VM.state==='nade'&&player.nadeHeld||VM.state==='reload'))"),'T11 锚14 19-input 换弹左键豁免在位');
ok(s20.includes('if(player.onVehicle||player.onNaval||player.loiter){'),'T11 锚15 20-player dbgSpecPossess 第二道门在位');
ok(s20.includes('team:(p.spectator?-1:p.team)'),'T11 锚16 20-player 手持迫击炮中立盖章在位');
ok(s09.includes('const NADE_WORLD_SCALE=2.5;'),'T11 锚17 09-weapons 出手件放大 2.5 在位');
ok(s17.includes('function spawnEdgeOk(x,z){')&&s17.includes('if(!spawnEdgeOk(px,pz)){ _spawnDiag.rejEdge++; continue; }')&&s17.includes('return spawnEdgeClamp(x,z);')&&s17.includes('if(!spawnEdgeOk(best.x,best.z)){'),'T11 锚18 17-emplacements 离边门四处 (单源/候选闸/兜底钳回/最终保险) 在位');
ok(s07.includes("(typeof spawnEdgeOk!=='function'||spawnEdgeOk(x,z))")&&s07.includes("if(typeof spawnEdgeOk==='function'&&!spawnEdgeOk(px,pz)) continue;"),'T11 锚19 07-nav spawnSpot 离边门在位');
ok(s26.includes("if(typeof spawnEdgeOk==='function'&&!spawnEdgeOk(wx,wz)) continue;"),'T11 锚20 26-commander 编制生成离边门在位');
ok(s00.includes('const SPAWN_EDGE_MARGIN=20;'),'T11 锚21 00-config SPAWN_EDGE_MARGIN 单源在位');
}

console.log('────');
console.log('通过 '+PASS.length+' 项, 失败 '+FAILN+' 项'+(NEG?' (阴性对照: 有红=判据具备分辨力)':''));
if(FAILN){ process.exitCode=1; }
else if(NEG){ console.log('✗ 阴性对照全绿 = 判据空转!'); process.exitCode=1; }
