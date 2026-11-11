// ─────────────────────────────────────────────
// dev/verify-ffneutral-20261109.js —— 投掷手雷中立 × 观战武器中立 (2026-11-09 用户两项需求+三条裁定)
// 用法: node dev/verify-ffneutral-20261109.js [--neg]
// 裁定原文: ①"所有投掷性手雷都应当是中立的, 会同时杀伤友军和敌军"
//           ②"观战模式下的所有枪械也应当都是中立的, 命中的时候会杀伤友军和敌军"
// 三条裁定: A 仅爆炸伤害中立 —— 触发引信仍只认敌方 (武装雷碰友军穿过去, 落地才炸);
//           B 击杀照常记分 —— 归因链不加同队门 (友军击杀照加 kills/score);
//           C 座位武器不含 —— 观战者坐真实载具 (舰船座位 onNaval / 大舰甲板炮位 capitalGun) 开火维持原队伍口径。
// 落地面:
//   ① frag: explodeAt 加 noFF 参, 手雷 frag 分支传 true (boomer殉爆/航弹叠爆/钢水包不传=旧口径, 丧尸同队×0 不动);
//   ② 反坦克炸药: nadeExplode 溅射 team 传 -1 (与地雷/油桶/巡飞弹手动引爆同约定; 引信不动);
//   ③ 观战本尊: coFfFire 加 shooter.spectator 门 (步兵弹道/载具刮痕/艇舰射线门同源), 座位排除 onNaval+capitalGun
//      (其余座位对观战不可达: 固定炮位 tryInteract ③ 挡住, 真坦克/真飞机"不得征用真载具"挡住; 幽灵坦克 ffAll 覆盖);
//   ④ 观战本尊火箭: fireRocket 盖章 shooter.spectator?-1:team;
//   ⑤ 观战本尊手持迫击炮: nadeExplode mortar 分支 thrower.spectator?-1:team (不在弹体上盖章 —— 保住敌雷接近
//      警告与载具触发圈旧口径; Bot 迫击炮逐位不变);
//   ⑥ 瞄准吸附 ff 门跟走: {ff:!!(p.ffSpecSniper||p.spectator)} —— 吸附对象集与子弹可命中集同口径 (吸附契约)。
// 红线 (阴性): 非观战玩家枪/火箭/手持迫击炮/航弹仍敌我过滤; 附身宿主开火=宿主 Bot 的弹不中立; Bot 迫击炮不动。
// 判据:
//   T1 frag 一颗炸三点: 友军掉血★+敌军掉血+自炸照旧(s!==attacker); T1b 友军击杀照记 player.kills (裁定 B);
//   T2 反坦克炸药炸友军掉血★ (team=-1 过 ff 门);
//   T3 触发引信仍只认敌方 (裁定 A): nadeContactTarget 友军躯干不认/敌方查询认友军/敌兵仍合法目标;
//   T4 观战本尊普通步枪伤友军★ (raySoldiers+fireBullet 端到端); 非观战阴性; 附身宿主开火不中立 (红线);
//   T5 观战本尊火箭弹 team=-1★; 非观战 team=player.team (阴性);
//   T6 观战本尊手持迫击炮炸友军掉血★; 非观战玩家阴性; Bot 迫击炮同队免伤不动+敌军照伤;
//   T7 coFfFire 判据矩阵 (spectator 门/座位排除/两旗旧语义保留);
//   T8 座位不泄漏 (裁定 C): 观战+onNaval/capitalGun 时 raySoldiers 仍过滤友军, 摘座位恢复;
//   T9 源码防回退锚 (与 NEG 补丁一一对应)。
//   --neg: 七补丁累积注入 (同队×0 回灌/frag noFF 拆/AT雷-1 回灌/spectator 门拆/火箭盖章拆/迫击炮门拆/吸附 ff 拆), 判据必须转红。
// 沙箱要点承 verify-deathdrop-20261103 (boot/SRC/PATCH_MAP/真开局+deployPlayer/protUntil 清账/引用追踪)。
// 摆位纪律: 射击类判据用 _stageShot 重试环 —— 地形通视+载具净空 (fireBullet 里坦/卡/艇是硬挡弹目标,
//   先于士兵收窄 wallD)+射线前沿身份 (shooter=null 查询不分敌我, 最前沿必须是靶子本人), 任一不满足换角重摆。
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

// ── NEG 阴性对照: 七补丁累积注入 (正常跑不启用) ──
const NEG=process.argv.includes('--neg');
const SRC={},PATCH_MAP={};
const NEG_PATCHES=[
// N1 同队×0 回灌 (noFF 门拆): T1 frag 友军红
['js/13-combat.js','if(!noFF&&attacker&&s.team===attacker.team&&s!==attacker) dmg*=0.0;','if(attacker&&s.team===attacker.team&&s!==attacker) dmg*=0.0;'],
// N2 frag 分支 noFF 实参拆: T1 红 (双保险 —— 注入回旧调用形态)
['js/13-combat.js','explodeAt(n.pos,n.thrower,undefined,true);','explodeAt(n.pos,n.thrower);'],
// N3 反坦克炸药 -1 回灌: T2 红
['js/13-combat.js',"splashDamage(n.pos,n.thrower,-1,5.5,95,340,true,'explo');","splashDamage(n.pos,n.thrower,n.team,5.5,95,340,true,'explo');"],
// N4 coFfFire spectator 门拆: T4/T7/T8 红
['js/13-combat.js','return !!(shooter.spectator&&!shooter.onNaval&&!shooter.capitalGun);','return false;'],
// N5 火箭盖章拆: T5 红
['js/13-combat.js','team:(shooter.spectator?-1:shooter.team),owner:shooter,life:3.6','team:shooter.team,owner:shooter,life:3.6'],
// N6 手持迫击炮门拆: T6 红
['js/13-combat.js',"(n.thrower&&n.thrower.spectator)?-1:n.team,5.25,100,150,false,'explo');","n.team,5.25,100,150,false,'explo');"],
// N7 吸附 ff 门拆: T9 锚红
['js/20-player.js','ff:!!(p.ffSpecSniper||p.spectator)});','ff:!!p.ffSpecSniper});'],
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
const CAMPI=3; // 淞沪 (deathdrop 同源, 陆战开阔)

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
function _placeClear(u,dist){ var e=_findClear(u.pos,dist,0.3); if(!e) return false; u.pos.set(e.x,heightAt(e.x,e.z),e.z); return true; }
function _heal(u){ u.alive=true; u.hp=100; u.onVehicle=null; u.spectator=false; u.prone=false; u.crouch=false; u.protUntil=0; }
function _pickFriend(){
for(var i=0;i<soldiers.length;i++){ var s=soldiers[i]; if(s.alive&&!s.isPlayer&&s.team===player.team&&!s.onVehicle&&!s.spectator&&!s.capCrew) return s; }
return null;
}
function _pickEnemy(){
for(var i=0;i<soldiers.length;i++){ var s=soldiers[i]; if(s.alive&&!s.isPlayer&&s.team!==player.team&&!s.onVehicle&&!s.spectator&&!s.capCrew) return s; }
return null;
}
// 以 (ax,az) 为圆心把 u 摆到 dist 外的陆地格 (逐角重试, 避开水面/头顶遮挡)
function _placeNear(u,ax,az,dist,a0){
for(var k=0;k<24;k++){
var a=a0+k*0.26, dx=Math.sin(a), dz=Math.cos(a);
var x=ax+dx*dist, z=az+dz*dist;
if(!_isLand(x,z)) continue;
if(raycastWorld(V3(x,heightAt(x,z)+0.55,z),V3(0,1,0),3)) continue;
u.pos.set(x,heightAt(x,z),z); return true;
}
return false;
}
function _chest(u){ return V3(u.pos.x,u.pos.y+1.1,u.pos.z); }
function _los(a,b){ return !raycastWorld(a,V3(b.x-a.x,b.y-a.y,b.z-a.z).normalize(),a.distanceTo(b)); }
// 射线上的坦/卡净空 (fireBullet 里它们是硬挡弹目标, 先于士兵收窄 wallD —— 摆位必须避开)
function _vehFree(o,d,maxD){
for(var i=0;i<tanks.length;i++){ var t=tanks[i]; if(!t.alive) continue; if(rayCyl(o,d,vehHitCyl(t,{}),maxD)) return false; }
for(var j=0;j<trucks.length;j++){ var u=trucks[j]; if(!u.alive) continue; if(rayCyl(o,d,truckHitCyl(u,{}),maxD)) return false; }
return true;
}
// 摆人+摆出一条干净射线: 地形通视+载具净空+射线前沿身份 (shooter=null 查询不分敌我, 最前沿必须是靶子本人)
function _stageShot(u,ax,ay,az,dist,a0){
for(var k=0;k<16;k++){
var a=a0+k*0.4, dx=Math.sin(a), dz=Math.cos(a);
var x=ax+dx*dist, z=az+dz*dist;
if(!_isLand(x,z)) continue;
if(raycastWorld(V3(x,heightAt(x,z)+0.55,z),V3(0,1,0),3)) continue;
u.pos.set(x,heightAt(x,z),z);
var o=V3(ax,ay,az), d=V3(u.pos.x-o.x,(u.pos.y+1.1)-o.y,u.pos.z-o.z);
var dl=d.length(); if(dl<0.5) continue; d.multiplyScalar(1/dl);
if(raycastWorld(o,d,dl)) continue;
if(!_vehFree(o,d,dl+0.5)) continue;
var sr=raySoldiers(o,d,dl+2,null);
if(!(sr&&sr.sol===u)) continue;
return {o:o,d:d,dist:dl};
}
return null;
}
function _stepToRemoval(nd,cap){ var s=0; while(nades.indexOf(nd)>=0&&s<cap){ updateNades(0.05,0.05); s++; } return s; }
function _throwFrag(fuse){ player._src='手雷'; throwNade(player,V3(player.pos.x,player.pos.y+1.4,player.pos.z),V3(0.1,-0.5,0.1),fuse); return nades[nades.length-1]; }
function _throwAT(){ player._src='反坦克炸药'; throwNade(player,V3(player.pos.x,player.pos.y+1.4,player.pos.z),V3(0.1,-0.5,0.1),1.6,true); return nades[nades.length-1]; }
function _reviveP(){ player.alive=true; player.hp=100; player.protUntil=0; player.nadeHeld=false; player.nadeFuse=0; player.spectator=false; player.specViewHost=null; player.onNaval=null; player.capitalGun=null; player.ffAll=false; player.ffSpecSniper=false; if(typeof VM!=='undefined'&&VM) VM.state='idle'; }
`);

// ══ T1 frag 一颗炸三点: 友军掉血★ / 敌军掉血 / 自炸照旧 ══
console.log('T1 投掷手雷中立: 普通雷在脚下引爆 —— 友军/敌军/自己 同圈同伤 (noFF)');
const t1=G(`(function(){
try{
_reviveP(); if(!_placeClear(player,6)) return {err:'无开阔陆地落位'};
var F=_pickFriend(), E=_pickEnemy(); if(!F||!E) return {err:'缺友军/敌军步兵'};
_heal(F); _heal(E);
if(!_placeNear(F,player.pos.x,player.pos.z,3,0.5)) return {err:'友军落位失败'};
if(!_placeNear(E,player.pos.x,player.pos.z,4.5,2.6)) return {err:'敌军落位失败'};
var hpF=F.hp, hpE=E.hp, hpP=player.hp;
var nd=_throwFrag(0);                     // fuse=0 ⇒ 出手即武装, 触地即炸
if(!nd||nd.kind!=='frag') return {err:'弹种不对 '+(nd&&nd.kind)};
var steps=_stepToRemoval(nd,200);
return {removed:nades.indexOf(nd)<0,steps:steps,hpF:F.hp,hpE:E.hp,hpP:player.hp,hpF0:hpF,hpE0:hpE,hpP0:hpP};
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t1.err){ ok(false,'T1 异常 '+t1.err); }
else{
ok(t1.removed,'T1 手雷真实引爆离账 (步数 '+t1.steps+')');
ok(t1.hpF<t1.hpF0,'T1 ★友军掉血 (100 → '+t1.hpF.toFixed(1)+') —— 投掷手雷中立核心判据');
ok(t1.hpE<t1.hpE0,'T1 敌军照常掉血 ('+t1.hpE0+' → '+t1.hpE.toFixed(1)+')');
ok(t1.hpP<t1.hpP0,'T1 自炸照旧 (s!==attacker 例外未动: '+t1.hpP0+' → '+t1.hpP+')');
}

// ══ T1b 友军击杀照常记分 (裁定 B: 归因链无同队门) ══
console.log('T1b 友军击杀照常记分: frag 炸死友军 → player.kills 照加 (不加同队门)');
const t1b=G(`(function(){
try{
_reviveP(); if(!_placeClear(player,6)) return {err:'无开阔陆地落位'};
var F=_pickFriend(); if(!F) return {err:'缺友军步兵'};
_heal(F); F.hp=1;
if(!_placeNear(F,player.pos.x,player.pos.z,3,0.9)) return {err:'友军落位失败'};
for(var i=0;i<soldiers.length;i++){ var s=soldiers[i]; if(s!==F&&s.alive&&!s.isPlayer){ s.pos.x+=500; s.pos.z+=500; } }   // 搬开旁观单位: kills 是精确计数断言, 爆圈 10m 内不得有别人
var k0=player.kills;
var nd=_throwFrag(0);                     // 走真雷链 nadeExplode→explodeAt(noFF); 直接调 explodeAt 不带 noFF 仍是同队×0 (boomer/丧尸旧口径), 测的不是手雷分支
if(!nd||nd.kind!=='frag') return {err:'弹种不对'};
_stepToRemoval(nd,200);
return {removed:nades.indexOf(nd)<0,dead:!F.alive,k0:k0,k1:player.kills};
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t1b.err){ ok(false,'T1b 异常 '+t1b.err); }
else{
ok(t1b.removed&&t1b.dead,'T1b 友军被 frag 炸死 (真雷链 nadeExplode→explodeAt(noFF))');
ok(t1b.k1===t1b.k0+1,'T1b ★友军击杀照记分 (kills '+t1b.k0+' → '+t1b.k1+', 裁定 B: 不加同队门)');
}

// ══ T2 反坦克炸药: 溅射中立 (team=-1) ══
console.log('T2 反坦克炸药中立: 炸友军掉血 (nadeExplode 传 -1, 与地雷/油桶同约定)');
const t2=G(`(function(){
try{
_reviveP(); if(!_placeClear(player,6)) return {err:'无开阔陆地落位'};
var F=_pickFriend(); if(!F) return {err:'缺友军步兵'};
_heal(F);
if(!_placeNear(F,player.pos.x,player.pos.z,3,1.2)) return {err:'友军落位失败'};
var hpF=F.hp;
var nd=_throwAT();
if(!nd||!nd.at) return {err:'弹种不对 at='+(nd&&nd.at)};
var steps=_stepToRemoval(nd,200);
return {removed:nades.indexOf(nd)<0,steps:steps,hpF:F.hp,hpF0:hpF};
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t2.err){ ok(false,'T2 异常 '+t2.err); }
else{
ok(t2.removed,'T2 反坦克炸药真实引爆离账 (步数 '+t2.steps+')');
ok(t2.hpF<t2.hpF0,'T2 ★友军掉血 (100 → '+t2.hpF.toFixed(1)+') —— AT 雷溅射中立核心判据');
}

// ══ T3 触发引信仍只认敌方 (裁定 A) ══
console.log('T3 引信口径 (裁定 A): nadeContactTarget 友军躯干不认 —— 武装雷碰友军不引爆, 落地才炸');
const t3=G(`(function(){
try{
_reviveP();
var F=_pickFriend(), E=_pickEnemy(); if(!F||!E) return {err:'缺友军/敌军步兵'};
_heal(F); _heal(E);
if(!_placeNear(F,player.pos.x,player.pos.z,3,0.2)) return {err:'友军落位失败'};
if(!_placeNear(E,player.pos.x,player.pos.z,3,2.2)) return {err:'敌军落位失败'};
var rF=nadeContactTarget(F.pos.x,F.pos.y+1.1,F.pos.z,player.team,player);
var rFx=nadeContactTarget(F.pos.x,F.pos.y+1.1,F.pos.z,1-player.team,player);
var rE=nadeContactTarget(E.pos.x,E.pos.y+1.1,E.pos.z,player.team,player);
return {friendIgnored:rF===null,friendSeenByEnemyQuery:rFx===F,enemySeen:rE===E};
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t3.err){ ok(false,'T3 异常 '+t3.err); }
else{
ok(t3.friendIgnored,'T3 ★友军躯干不是合法引爆目标 (碰友军穿过去, 裁定 A)');
ok(t3.friendSeenByEnemyQuery,'T3 敌方查询下友军躯干可命中 (team 门仍在函数内, 不是被删)');
ok(t3.enemySeen,'T3 敌兵仍是合法引爆目标 (敌我判定未拆)');
}

// ══ T4 观战本尊普通步枪伤友军★ + 非观战/附身宿主 双阴性 ══
console.log('T4 观战本尊普通步枪伤友军 (coFfFire spectator 门) + 非观战阴性 + 附身宿主红线');
const t4=G(`(function(){
try{
_reviveP(); if(!_placeClear(player,10)) return {err:'无开阔陆地落位'};
var F=_pickFriend(), E=_pickEnemy(); if(!F||!E) return {err:'缺友军/敌军步兵'};
_heal(F); _heal(E);
var st=_stageShot(F,player.pos.x,player.pos.y+1.1,player.pos.z,12,0.4);
if(!st) return {err:'无干净射界 (12m 全被地形/载具/人挡)'};
var o=st.o, dir=st.d;
var DEF={dmg:40,headMul:1.9,snd:'mg',tracer:1,vehDmg:0};
var hpF0=F.hp;
fireBullet(player,o,dir,DEF,null);
var hpF1=F.hp;
player.spectator=true;
var sr1=raySoldiers(o,dir,60,player);
fireBullet(player,o,dir,DEF,null);
var hpF2=F.hp;
player.spectator=false;
// 附身宿主红线: 宿主 Bot 的弹不中立 —— 另一名友军站在宿主枪口前也不掉血
var F2=null; for(var i=0;i<soldiers.length;i++){ var s=soldiers[i]; if(s!==F&&s.alive&&!s.isPlayer&&s.team===player.team&&!s.onVehicle&&!s.spectator&&!s.capCrew){ F2=s; break; } }
if(!F2) return {err:'缺第二名友军'};
_heal(F2);
var st2=_stageShot(F2,F.pos.x,F.pos.y+1.1,F.pos.z,2.5,1.1);
if(!st2) return {err:'宿主靶无干净射界'};
player.specViewHost=F;
var srHost=raySoldiers(st2.o,st2.d,60,F);
fireBullet(F,st2.o,st2.d,DEF,null);
var hpF2after=F2.hp;
// 宿主打敌军照常 (开火能力本身没坏)
var st3=_stageShot(E,F.pos.x,F.pos.y+1.1,F.pos.z,10,2.0);
if(!st3) return {err:'敌军靶无干净射界'};
var hpE0=E.hp;
fireBullet(F,st3.o,st3.d,DEF,null);
var hpE1=E.hp;
player.specViewHost=null;
return {plainClean:hpF1===hpF0,specHits:!!(sr1&&sr1.sol===F),hpF2:hpF2,hpF0:hpF0,
hostFiltered:!(srHost&&srHost.sol===F2),hpF2after:hpF2after,hostEnemyDmg:hpE1<hpE0};
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t4.err){ ok(false,'T4 异常 '+t4.err); }
else{
ok(t4.plainClean,'T4 阴性: 非观战玩家普通步枪打友军不掉血 (hp 保持 '+t4.hpF0+', 敌我过滤未被写死拆掉)');
ok(t4.specHits,'T4 ★观战本尊: raySoldiers 命中友军 (spectator 门放开同队过滤)');
ok(t4.hpF2<t4.hpF0,'T4 ★观战本尊普通步枪伤友军 ('+t4.hpF0+' → '+t4.hpF2+') —— 观战武器中立核心判据');
ok(t4.hostFiltered&&t4.hpF2after===100,'T4 红线: 附身宿主 Bot 的弹不中立 (友军靶 hp='+t4.hpF2after+')');
ok(t4.hostEnemyDmg===true,'T4 宿主开火能力未坏 (敌军靶真掉血)');
}

// ══ T5 观战本尊火箭弹 team=-1★ / 非观战阴性 ══
console.log('T5 观战本尊火箭: fireRocket 盖章 spectator?-1:team (幽灵坦克 team:-1 同约定)');
const PTEAM=G('player.team');
const t5=G(`(function(){
try{
_reviveP(); if(!_placeClear(player,6)) return {err:'无开阔陆地落位'};
var DEF={name:'火箭筒',atDmg:320};
var o=V3(player.pos.x,player.pos.y+1.4,player.pos.z), d=V3(0,0,-1);
fireRocket(player,o,d,DEF,null);
var t0=shells[shells.length-1].team; shells.pop();
player.spectator=true;
fireRocket(player,o,d,DEF,null);
var t1=shells[shells.length-1].team; var owner1=shells[shells.length-1].owner===player; shells.pop();
player.spectator=false;
return {t0:t0,t1:t1,owner1:owner1};
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t5.err){ ok(false,'T5 异常 '+t5.err); }
else{
ok(t5.t0===PTEAM,'T5 阴性: 非观战火箭 team=player.team ('+t5.t0+')');
ok(t5.t1===-1&&t5.owner1,'T5 ★观战本尊火箭 team=-1 (owner=player) —— 下游命中/溅射链全通中立口径');
}

// ══ T6 观战本尊手持迫击炮中立★ + 非观战/Bot 双阴性 ══
console.log('T6 手持迫击炮: 观战本尊溅射中立 (nadeExplode 门) + 非观战玩家/Bot 迫击炮不动');
const t6=G(`(function(){
try{
_reviveP(); if(!_placeClear(player,6)) return {err:'无开阔陆地落位'};
var F=_pickFriend(), F2=null, E=_pickEnemy(); if(!F||!E) return {err:'缺友军/敌军步兵'};
for(var i=0;i<soldiers.length;i++){ var s=soldiers[i]; if(s!==F&&s.alive&&!s.isPlayer&&s.team===player.team&&!s.onVehicle&&!s.spectator&&!s.capCrew){ F2=s; break; } }
if(!F2) return {err:'缺第二名友军'};
_heal(F); _heal(F2); _heal(E);
// ① 观战本尊
player.spectator=true;
if(!_placeNear(F,player.pos.x,player.pos.z,2,0.3)) return {err:'友军落位失败'};
var hpF0=F.hp;
nadeExplode({pos:V3(F.pos.x,F.pos.y+0.3,F.pos.z),thrower:player,team:player.team,mortar:true,src:'迫击炮'});
var specDmg=F.hp<hpF0;
var hpFAfter=F.hp;
player.spectator=false;
// ② 非观战玩家 (同位置换回非观战)
_heal(F);
var hpF1=F.hp;
nadeExplode({pos:V3(F.pos.x,F.pos.y+0.3,F.pos.z),thrower:player,team:player.team,mortar:true,src:'迫击炮'});
var plainNoDmg=F.hp===hpF1;
// ③ Bot 迫击炮: 同队免伤不动 + 敌军照伤
_heal(F2);
if(!_placeNear(F2,F.pos.x,F.pos.z,2,1.7)) return {err:'Bot靶落位失败'};
var hpF2=F2.hp;
nadeExplode({pos:V3(F2.pos.x,F2.pos.y+0.3,F2.pos.z),thrower:F,team:F.team,mortar:true,src:'迫击炮'});
var botAllySafe=F2.hp===hpF2;
var hpE=E.hp;
nadeExplode({pos:V3(E.pos.x,E.pos.y+0.3,E.pos.z),thrower:F,team:F.team,mortar:true,src:'迫击炮'});
var botEnemyDmg=E.hp<hpE;
return {specDmg:specDmg,hpF0:hpF0,hpFAfter:hpFAfter,plainNoDmg:plainNoDmg,botAllySafe:botAllySafe,botEnemyDmg:botEnemyDmg};
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t6.err){ ok(false,'T6 异常 '+t6.err); }
else{
ok(t6.specDmg,'T6 ★观战本尊手持迫击炮炸友军掉血 (100 → '+t6.hpFAfter.toFixed(1)+') —— mortar 溅射中立核心判据');
ok(t6.plainNoDmg,'T6 阴性: 非观战玩家手持迫击炮同队免伤不动');
ok(t6.botAllySafe,'T6 阴性: Bot 迫击炮同队免伤不动 (thrower 非 spectator 走 n.team)');
ok(t6.botEnemyDmg,'T6 Bot 迫击炮打敌军照常 (开火能力没坏)');
}

// ══ T7 coFfFire 判据矩阵 ══
console.log('T7 coFfFire 矩阵: spectator 门 / 座位排除 / 两旗旧语义保留');
const t7=G(`(function(){
try{
return {
plain:coFfFire({}),
spec:coFfFire({spectator:true}),
naval:coFfFire({spectator:true,onNaval:{}}),
ghost:coFfFire({spectator:true,ffAll:true}),
ffAll:coFfFire({ffAll:true}),
ffSniper:coFfFire({ffSpecSniper:true}),
nullIn:coFfFire(null)
};
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t7.err){ ok(false,'T7 异常 '+t7.err); }
else{
ok(t7.plain===false,'T7 非观战无旗 → false (旧口径)');
ok(t7.spec===true,'T7 ★观战本尊 → true (新门)');
ok(t7.naval===false,'T7 ★观战+真实座位(onNaval) → false (裁定 C 座位排除) (2026-11-10 跟码: capitalGun 项随大舰子系统下架摘除)');
ok(t7.ghost===true,'T7 观战+ffAll(幽灵坦克) → true (旗优先, 幽灵坦克不依赖 spectator 门)');
ok(t7.ffAll===true&&t7.ffSniper===true,'T7 ffAll/ffSpecSniper 单独为真 → true (两旗旧语义逐位保留)');
ok(t7.nullIn===false,'T7 null 射手 → false');
}

// ══ T8 座位不泄漏 (裁定 C, 真玩家态) ══
console.log('T8 座位不泄漏: 观战者坐真实座位时 raySoldiers 仍过滤友军, 摘座位恢复');
const t8=G(`(function(){
try{
_reviveP(); if(!_placeClear(player,10)) return {err:'无开阔陆地落位'};
var F=_pickFriend(); if(!F) return {err:'缺友军步兵'};
_heal(F);
var st=_stageShot(F,player.pos.x,player.pos.y+1.1,player.pos.z,12,2.9);
if(!st) return {err:'无干净射界'};
player.spectator=true;
var specFree=!!(raySoldiers(st.o,st.d,60,player)&&raySoldiers(st.o,st.d,60,player).sol===F);
player.onNaval={team:player.team};
var navalFiltered=!(raySoldiers(st.o,st.d,60,player)&&raySoldiers(st.o,st.d,60,player).sol===F);
player.onNaval=null;
var restored=!!(raySoldiers(st.o,st.d,60,player)&&raySoldiers(st.o,st.d,60,player).sol===F);
player.spectator=false;
return {specFree:specFree,navalFiltered:navalFiltered,restored:restored};
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t8.err){ ok(false,'T8 异常 '+t8.err); }
else{
ok(t8.specFree,'T8 前置: 步行观战 raySoldiers 认友军 (门在工作)');
ok(t8.navalFiltered,'T8 ★观战+舰船座位(onNaval) → 友军重新被过滤 (座位武器不借 spectator 门, 裁定 C)');
ok(t8.restored,'T8 摘座位立刻恢复 (排除门跟座位态走, 不是一次性)');
}

// ══ T9 源码防回退锚 ══
console.log('T9 源码防回退锚 (与 NEG 七补丁一一对应)');
{
const s13=srcOf('js/13-combat.js'), s20=srcOf('js/20-player.js');
ok(s13.includes('function explodeAt(p,attacker,R,noFF)'),'T9 锚1 explodeAt noFF 形参在位');
ok(s13.includes('explodeAt(n.pos,n.thrower,undefined,true);'),'T9 锚2 frag 分支 noFF 实参在位');
ok(s13.includes("splashDamage(n.pos,n.thrower,-1,5.5,95,340,true,'explo');"),'T9 锚3 AT 雷溅射 -1 在位');
ok(s13.includes('return !!(shooter.spectator&&!shooter.onNaval);'),'T9 锚4 coFfFire spectator 门+座位排除在位 (2026-11-10 跟码: capitalGun 项随大舰子系统下架摘除)');
ok(s13.includes('team:(shooter.spectator?-1:shooter.team)'),'T9 锚5 fireRocket 盖章门在位');
ok(s13.includes("(n.thrower&&n.thrower.spectator)?-1:n.team,5.25,100,150,false,'explo');"),'T9 锚6 手持迫击炮门在位');
ok(s20.includes('ff:!!(p.ffSpecSniper||p.spectator)});'),'T9 锚7 吸附 ff 门跟走在位 (20-player)');
}

console.log('────');
console.log('通过 '+PASS.length+' 项, 失败 '+FAILN+' 项'+(NEG?' (阴性对照: 有红=判据具备分辨力)':''));
if(FAILN){ process.exitCode=1; }
else if(NEG){ console.log('✗ 阴性对照全绿 = 判据空转!'); process.exitCode=1; }
