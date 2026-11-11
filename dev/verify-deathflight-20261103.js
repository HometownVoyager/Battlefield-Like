// ─────────────────────────────────────────────
// dev/verify-deathflight-20261103.js —— 射手死亡弹道留存契约 (2026-11-03 用户报"一死弹体原地消失")
// 用法: node dev/verify-deathflight-20261103.js [--neg]
// 背景 (用户实报): "玩家/Bot 一死, 扔出的手雷、发射的巡飞弹、子弹等就原地消失了?"
// 代码审计结论 (本批留档, 见《排查-射手死亡与在飞弹体-2026-11-03.md》): 现状**已经**是用户要的口径 ——
//   ① 手雷/烟雾/燃烧/反坦克炸药/迫击炮弹/航弹: 出手即入全局 nades[] 账, updateNades 无投掷者存活门;
//   ② 坦克炮/火箭弹/反坦克炮/舰炮/岸炮: 全局 shells[] 账, updateShells 无 owner 存活门;
//   ③ 子弹: fireBullet 是即时射线 (出膛当帧结算), 不存在"在飞的子弹";
//   ④ 高炮弹 flakShots[] / 鱼雷 torpedoes[]: 同样无 owner 存活门;
//   ⑤ 巡飞弹: 挂 player.loiter, 玩家 die() 内早有 `if(this.loiter){ loiterDetonate(this.loiter,...) }` 原地引爆行
//      (Bot 无巡飞弹兵种, 不存在"Bot 的巡飞弹")。
//   唯一会"消失"的雷 = 死时还在手里/举雷读条中 (未出手) —— 死亡打断读条是既有设计 (2026-10-25/11-03 批), 不在本批范围。
// 本探针把"死亡不改弹道"契约钉进回归 (全部走真创建路径 + 真死亡链):
//   T1 手雷: Bot throwNade 出手 → 击杀射手 → 弹体仍在账/仍在积分, 引信武装后落地**引爆**移除 (而非无声消失);
//   T2 火箭弹: fireRocket 出膛 → 击杀射手 → shells 账内照飞照积分 (life 照衰减);
//   T3 巡飞弹: fireLoiter 玩家真发射路径 → 制导飞行 → 击杀玩家 → loiterDetonate 原地起爆
//      (d.dead=true / player.loiter 回收 / 弹体网格摘出场景 / 溅射结算真实执行)。
//   --neg 阴性对照: 把用户报的病**注入** (死后清弹 / 死后清炮弹 / die() 静默弃巡飞弹) ⇒ 同批判据必须转红 (证明分辨力)。
// 沙箱要点 (承 verify-killattr): ①开局后须 deployPlayer(); ②裸全局 CANNON 挂 ctx; ③出生保护清 protUntil;
//   ④弹道窗口只步进对应子系统 (不步进全世界 ⇒ Bot 索敌/环境流不污染计数); ⑤弹体按引用追踪 (环境雷/弹不干扰)。
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
// CANNON 桩 (与 verify-killattr 同源): die→spawnRagdoll 需要 World/Body 等
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

// ── NEG 阴性对照: 注入"用户报的病" (正常跑不启用) ──
const NEG=process.argv.includes('--neg');
const SRC={},PATCH_MAP={};
const NEG_PATCHES=[
// ① nades: 投掷者一死即在途清弹 (用户报的手雷消失病)
['js/13-combat.js','const n=nades[i];',
 'const n=nades[i]; if(n.thrower&&!n.thrower.alive){ scene.remove(n.m); nades.splice(i,1); continue; }'],
// ② shells: 射手一死即在途清炮弹 (用户报的火箭弹/炮弹消失病)
['js/15-vehicles.js','const s=shells[i];',
 'const s=shells[i]; if(s.owner&&!s.owner.alive){ shells.splice(i,1); continue; }'],
// ③ die(): 静默弃弹不引爆 (用户报的巡飞弹消失病)
['js/18-game.js','if(this.loiter){ loiterDetonate(this.loiter,this.loiter.pos.clone()); }',''],
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
const CAMPI=3; // 淞沪 (verify-killattr 同源: 攻防图, 有坦克有步兵)

const ctx=boot(CAMPI);
const G=s=>vm.runInContext(s,ctx);

// ── 开局 + 部署 ──
let err0=null;
try{ G("document.getElementById('startBtn').onclick();"); }catch(e){ err0=String(e&&e.stack||e); }
if(!err0){ try{ G('if(!player.alive||!player.deployed) deployPlayer();'); }catch(e){ err0='deployPlayer: '+String(e&&e.stack||e); } }
if(err0||!G('player.alive')){ console.log('  ✘ 开局/部署失败 '+(err0||'player.alive=false')); process.exit(1); }
G('for(const s of soldiers) s.protUntil=0; player.protUntil=0;'); // 出生保护 0.5s: 免伤会吞掉整条击杀链, 全清
ok(G('soldiers.length')>0,'前置: 战场已开局并部署 (soldiers='+G('soldiers.length')+', player.alive='+G('player.alive')+')');

// ── 公用 vm 片段 ──
G(`
function _isLand(x,z){ return heightAt(x,z)>waterYAt(x,z)+0.4; }   // 入水弹=哑火, 全程陆地
function _findClear(o,dist,a0){                                     // 开阔且全程陆地的射向 (每轮旋转防原地打转)
for(var da=0.2;da<Math.PI*2;da+=0.25){
var a=a0+da, dx=Math.sin(a),dz=Math.cos(a);
var mid={x:o.x+dx*dist*0.5,z:o.z+dz*dist*0.5}, end={x:o.x+dx*dist,z:o.z+dz*dist};
if(!_isLand(end.x,end.z)||!_isLand(mid.x,mid.z)) continue;
if(raycastWorld(V3(o.x,o.y+1.5,o.z),V3(dx,0,dz),dist)) continue;   // 眼高射线
if(raycastWorld(V3(o.x,heightAt(o.x,o.z)+0.55,o.z),V3(dx,0,dz),dist)) continue; // 弹道高度射线
return end;
}
return null;
}
function _pickEnemy(){
for(var i=0;i<soldiers.length;i++){ var s=soldiers[i]; if(s.alive&&!s.isPlayer&&s.team!==player.team&&!s.onVehicle&&!s.spectator&&!s.capCrew) return s; }
return null;
}
`);

// ══ T1 手雷: 射手死亡 → 弹体照飞照炸 ══
console.log('T1 手雷: Bot 出手 → 击杀射手 → 弹体仍在账/仍在积分, 武装后落地引爆 (而非消失)');
const t1=G(`(function(){
try{
var B=_pickEnemy(); if(!B) return {err:'无敌方步兵'};
var spot=_findClear(player.pos,14,0); if(!spot) return {err:'无开阔陆地落位'};
B.pos.set(spot.x,heightAt(spot.x,spot.z),spot.z); B.crouch=false; B.prone=false;
var n0=nades.length;
throwNade(B,V3(B.pos.x,B.pos.y+1.5,B.pos.z),V3(0,4.5,0),9,false,false,false); // fuse=9: 观测窗口内不武装
if(nades.length!==n0+1) return {err:'出手未入账 nades.length='+(nades.length-n0)};
var nd=nades[nades.length-1];
if(nd.thrower!==B) return {err:'账目 thrower 不符'};
var p0={x:nd.pos.x,y:nd.pos.y,z:nd.pos.z};
for(var i=0;i<6;i++) updateNades(0.05,0.05);                       // 死前 0.3s: 弹体在积分
var mv0=Math.hypot(nd.pos.x-p0.x,nd.pos.y-p0.y,nd.pos.z-p0.z);
B.damage(9999,player,false);                                       // 击杀射手 (真死亡链)
if(B.alive) return {err:'射手未死'};
var inAcc1=nades.indexOf(nd)>=0;
for(var i=0;i<20;i++) updateNades(0.05,0.05);                      // 死后 1.0s
var inAcc2=nades.indexOf(nd)>=0;
var steps=0; while(nades.indexOf(nd)>=0&&steps<500){ updateNades(0.05,0.05); steps++; }
return {mv0:mv0,inAcc1:inAcc1,inAcc2:inAcc2,removed:nades.indexOf(nd)<0,steps:steps,
        land:_isLand(B.pos.x,B.pos.z),bounces:nd.bounces};
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t1.err){ ok(false,'T1 异常 '+t1.err); }
else{
ok(t1.land,'T1 落位全程陆地 (排除入水哑火歧义)');
ok(t1.mv0>0.2,'T1 死前弹体在积分 (0.3s 位移 '+t1.mv0.toFixed(2)+'m)');
ok(t1.inAcc1,'T1 击杀射手当帧弹体仍在账');
ok(t1.inAcc2,'T1 ★射手死后 1s 弹体仍在账 (用户报"原地消失"的判据点)');
ok(t1.removed,'T1 弹体最终离账 (武装后触地引爆路径, '+t1.steps+' 步)');
}

// ══ T2 火箭弹: 射手死亡 → shells 账内照飞 ══
console.log('T2 火箭弹: fireRocket 出膛 → 击杀射手 → 照飞照积分 (life 照衰减)');
const t2=G(`(function(){
try{
var B2=_pickEnemy(); if(!B2) return {err:'无敌方步兵'};
var home=_findClear(player.pos,16,0.5); if(!home) return {err:'无开阔陆地落位'};
B2.pos.set(home.x,heightAt(home.x,home.z),home.z); B2.crouch=false; B2.prone=false;
for(var att=0;att<6;att++){
var end=_findClear(B2.pos,30,att*0.9); if(!end) continue;
var dh=V3(end.x-B2.pos.x,0,end.z-B2.pos.z).normalize();
var dir=V3(dh.x,0.55,dh.z).normalize();                            // 抬仰角: 观测窗口内不撞任何近物
fireRocket(B2,V3(B2.pos.x,B2.pos.y+1.5,B2.pos.z),dir,WPN_DEFS.bazooka,null);
var sh=shells[shells.length-1];
if(!sh||!sh.rocket||sh.owner!==B2) return {err:'出膛账目不符'};
var p0={x:sh.pos.x,y:sh.pos.y,z:sh.pos.z};
updateShells(0.05,0.05);
if(shells.indexOf(sh)<0) continue;                                 // 早起撞物 → 换方位重试
B2.damage(9999,player,false);
if(B2.alive) return {err:'射手未死'};
updateShells(0.05,0.05); updateShells(0.05,0.05);                  // 死后再飞 0.1s
var alive=shells.indexOf(sh)>=0;
var mv=Math.hypot(sh.pos.x-p0.x,sh.pos.y-p0.y,sh.pos.z-p0.z);
if(alive&&mv>12) return {ok:true,mv:mv,life:sh.life,att:att};
}
return {err:'6 个方位均未取得死后在飞样本'};
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t2.err){ ok(false,'T2 异常 '+t2.err); }
else{
ok(true,'T2 ★射手死后火箭弹仍在账且已飞 '+t2.mv.toFixed(1)+'m (life 余 '+t2.life.toFixed(2)+'s, 第'+(t2.att+1)+'方位)');
}

// ══ T3 巡飞弹: 玩家死亡 → loiterDetonate 原地起爆 ══
console.log('T3 巡飞弹: fireLoiter 真发射 → 制导飞行 → 击杀玩家 → 原地起爆 (非静默消失)');
const t3=G(`(function(){
try{
if(!player.alive) return {err:'玩家已死 (前置破坏)'};
if(player.loiter) return {err:'已有在飞巡飞弹'};
var d=null,mv=0,att=-1;
for(att=0;att<6;att++){                                            // 6 方位重试 (T2 同款): 朝向若 1.1m 内有静体/士兵,
if(player.loiter) return {err:'上一枚未回收'};                       // updateLoiters 会在裹探针前早起爆 ⇒ 换方位
player.yaw=att*(Math.PI/3); player.pitch=0.1;
var r=fireLoiter(player,V3(player.pos.x,player.pos.y+1.5,player.pos.z),null);
if(!r||player.loiter!==r) return {err:'fireLoiter 未挂账'};
d=r;
if(d.owner!==player) return {err:'owner 不符'};
var q0={x:d.pos.x,y:d.pos.y,z:d.pos.z};
for(var i=0;i<4;i++) updateLoiters(0.05,0.05);                     // 出膛保护期照积分
if(d.dead) continue;                                               // 早起撞物 (探针未裹 splash) ⇒ 弃这枚换方位
mv=Math.hypot(d.pos.x-q0.x,d.pos.y-q0.y,d.pos.z-q0.z);
break;
}
if(!d||d.dead) return {err:'6 个方位均未取得裹探针前的在飞样本'};
var sdN0=(typeof globalThis.__sdN==='number')?globalThis.__sdN:0;
var _sd=splashDamage; globalThis.__sdN=0;
splashDamage=function(){ globalThis.__sdN++; return _sd.apply(null,arguments); }; // 溅射结算探针 (包裹至 die 结算窗口)
var E=_pickEnemy(); if(!E) return {err:'无敌方步兵作击杀来源'};
player.damage(9999,E,false);                                       // 玩家真死亡链
var sdN=globalThis.__sdN; splashDamage=_sd;
return {mv:mv,att:att,playerDead:!player.alive,matchOver:matchOver,
        dead:d.dead,released:player.loiter===null,
        meshOut:scene.children.indexOf(d.mesh)<0,sdN:sdN};
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t3.err){ ok(false,'T3 异常 '+t3.err); }
else{
ok(t3.mv>0.5,'T3 弹体制导飞行中 (0.2s 位移 '+t3.mv.toFixed(2)+'m)');
ok(t3.playerDead,'T3 玩家已阵亡 (真 die 链)');
ok(!t3.matchOver,'T3 非对局结束 (排除 matchOver 静默档)');
ok(t3.dead,'T3 ★loiterDetonate 已原地起爆 (d.dead=true; 用户要的口径, 旧码既有)');
ok(t3.released,'T3 player.loiter 已回收');
ok(t3.meshOut,'T3 弹体网格已摘出场景');
ok(t3.sdN>=1,'T3 起爆溅射结算真实执行 (splashDamage ×'+t3.sdN+', 第'+(t3.att+1)+'方位)');
}

console.log('────');
console.log('通过 '+PASS.length+' 项, 失败 '+FAILN+' 项'+(NEG?' (阴性对照: 有红=判据具备分辨力)':''));
if(FAILN){ process.exitCode=1; }
else if(NEG){ console.log('✗ 阴性对照全绿 = 判据空转!'); process.exitCode=1; }
