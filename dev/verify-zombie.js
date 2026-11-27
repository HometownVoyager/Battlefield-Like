// ─────────────────────────────────────────────
// dev/verify-zombie.js —— 丧尸模式沙箱探针 (2026-10-06 设计定稿 §5)
// 用法: node dev/verify-zombie.js
// 判据:
//   T1 实体注册: Zombie 入 soldiers/combatants, team=2, zombie 旗标, 三变体参数;
//   T2 脑 FSM: 游荡→见人奔跑(含墙体遮挡) / 迁怒(受击转攻击者) / 丢失(到期回游荡);
//   T3 感染链: Bot 被尸杀 → 原地尸变 (+1 丧尸 / respawnT=1e9 / 零票务 / 不出布娃娃);
//   T4 近战: 高伤害送达 (setTimeout 同步桩) + 挥击节拍;
//   T5 ZP: 击杀普通尸+15 / 重尸+40 / 占旗钩子在 21-match (此处测 pzGain 通道);
//   T6 工事血量: registerFortHP 登记 DESTRUCTIBLES → damageStructures 打死 → dead;
//   T7 导演: 三阶段表 + zombieFrameTick 无抛;
//   T8 玩家死亡留尸 (裁定③) 且走正常死亡流程 (扣票);
//   T9 单队模式: 敌队零编制; T10 多队模式完整开局 + 导演无抛; T11 非 procgen 图零副作用。
// 载入清单: 运行时解析 index.html (verify-killattr 同源教训: 清单与实载不一致 = 盲区假绿)。
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
function boot(campIdx,zsub){
for(const k in stub.byId)delete stub.byId[k];
const ctx=vm.createContext(Object.assign({},stub.sandbox));
ctx.document=stub.document; ctx.window=stub.window; ctx.CANNON=CANNON;
ctx.setTimeout=(f)=>{ try{ f(); }catch(e){ console.log('  [异步桩] '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | ')); } return 0; };
ctx.clearTimeout=()=>{};
ctx.localStorage={_s:{sf_campaign:String(campIdx),sf_pseed:'424242',...(zsub?{sf_zsub:zsub}:{})},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of FILES) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
return ctx;
}
let pass=0,fail=0;const fails=[];
function ok(cond,label){ if(cond){pass++;console.log('  ✔ '+label);} else {fail++;fails.push(label);console.log('  ✘ '+label);} }
function bootStart(campIdx,zsub,label){
const ctx=boot(campIdx,zsub);
const G=s=>vm.runInContext(s,ctx);
let err=null;
try{ G("beginFreshMatch();"); }catch(e){ err='start: '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); }
// 2026-10-07d: 丧尸页「开始新游戏」(startBtn→startNewGame) 改为清子模式+整页重载 (ZOMBIE_MODE 是载入期常量,
// 就地重开仍是丧尸 = 用户实报的泄漏)。沙箱 reload 是 no-op ⇒ 探针开局改走 beginFreshMatch 直入 (标准图同款语义)。
if(!err){ try{ G('if(!player.alive||!player.deployed) deployPlayer();'); }catch(e){ err='deploy: '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); } }
if(!err) try{ G('for(const s of soldiers) s.protUntil=0; player.protUntil=0;'); }catch(e){}
// 2026-10-07b: Bot 常驻基地防区 (zDefPosts 环 9~22m) —— 测试丧尸 34m 感知圈必捞到 Bot, T2/T4 漂移。
// 探针豁免: 非玩家 Bot 平移 +800m (超出感知/听觉), 不改 alive/fieldCount; T12 断言前再拉回。
if(!err) try{ G('for(const s of soldiers){ if(!s.isPlayer&&!s.zombie){ s.pos.x+=800; s.pos.z+=800; s.pos.y=heightAt(s.pos.x,s.pos.z); if(s.path) s.path.length=0; } }'); }catch(e){}
ok(!err&&G('player.alive')===true,label+' 开局+部署', );
if(err) console.log('     '+err);
return {ctx,G};
}
// procgen 序号
{
const c0=boot(0,null);
var PGIDX=vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="procgen")',c0);
}
console.log('── T11 先行: 非 procgen 图零副作用 (normandy) ──');
{
const {G}=bootStart(0,null,'T11');
ok(G('ZOMBIE_MODE')===''&&G('TEAM_FACTION.length')===2,'T11 ZOMBIE_MODE 空 / TEAM_FACTION 双队');
ok(G('BUILD_MENU.length')===6,'T11 建造菜单保持 6 件 (判据跟走 2026-11-28 碾桶批④b: 工兵菜单加油桶件, 5→6)');
ok(G('ZOMBIES.length')===0,'T11 无丧尸实体');
}
console.log('── 单队模式 (procgen · solo) ──');
const {ctx,G}=bootStart(PGIDX,'solo','T0');
ok(G('ZOMBIE_MODE')==='solo','T0 ZOMBIE_MODE=solo');
ok(G('TEAM_FACTION.length')===3&&G('uniformMats.length')===3,'T0 丧尸假想队/制服档挂上 (team2)');
ok(G('fieldCount(1)')===0,'T9 单队: 敌队零编制');
ok(G('player.pz|0')===200,'T5 ZP 开局 200');
console.log('── T1 实体注册 ──');
// 摆尸点: 环搜"occBlocked 放行 + 丧尸感知射线同源通视"的确定方位 —— 射线必须**逐字复刻** 25-zombies
// 感知公式 (眼=z.pos.y+1.5, 目标=player.pos.y+1.4 斜线): v2 地形有高差, 从玩家侧打水平线的旧判据会误放行。
G('var zw0=null; for(var a=0;a<24&&!zw0;a++){ var aa=a*0.42; var fx=player.pos.x+Math.sin(aa)*10, fz=player.pos.z+Math.cos(aa)*10; if(occBlocked(fx,fz)) continue; var zy=heightAt(fx,fz); var ddx=player.pos.x-fx, ddz=player.pos.z-fz, ddd=Math.hypot(ddx,ddz); var dy=((player.pos.y+1.4)-(zy+1.5))/Math.max(ddd,0.1); var bl=raycastWorld(V3(fx,zy+1.5,fz),V3(ddx/ddd,dy,ddz/ddd),ddd); if(bl&&bl.dist<ddd-0.6) continue; zw0=spawnZombie(fx,fz,"walker"); }');
ok(G('!!zw0'),'T1 摆尸点就位 (通视方位)');
ok(G('zw0.zombie===true&&zw0.team===2&&zw0.alive===true&&zw0.hp===100'),'T1 普通尸: zombie/team2/hp100');
ok(G('soldiers.indexOf(zw0)>=0&&combatants.indexOf(zw0)>=0'),'T1 入 soldiers/combatants (命中/小地图复用)');
G('var zr=spawnZombie(player.pos.x+40,player.pos.z,"runner"), zb=spawnZombie(player.pos.x-40,player.pos.z,"brute");');
ok(G('zr.hp===60&&zb.hp===380'),'T1 变体参数: 跑者60/重尸380');
console.log('── T2 脑 FSM ──');
G('var zsx=zw0.pos.x, zsy=zw0.pos.y, zsz=zw0.pos.z;');   // 摆位点 (射线门已验) —— 游荡会挪走, 断言前归位
for(let i=0;i<8;i++) G('zw0.update(0.05);');   // 8×0.05=0.4s: 必覆盖 zPerT∈(0,0.22] 初始节流 (rand 流随布局漂, 3 次会漏)
G('zw0.pos.set(zsx,zsy,zsz); zw0.zPerT=0; zw0.update(0.05);');   // 归位+清节流: 用已验通视方位做一次感知
ok(G('zw0.brain')==='chase','T2 见人 (8.5m) → 奔跑追击');
G('var zw1=zr;');   // 跑者 (原始落点 player+40)
// 摆到 zw0 对侧 40m (2026-10-28 去偶发): 距人 40 (>sightRunner 34) 且距 zw0 ≥50 (>连锁唤醒半径 40)
// —— 断言只验"自身感知不及", 原固定落点会被 zw0 的 zAlertHorde 链偶发唤醒成 chase (约 1/3 布局)。
G('var _aw=Math.atan2(player.pos.x-zw0.pos.x,player.pos.z-zw0.pos.z); var _ax=player.pos.x+Math.sin(_aw)*40, _az=player.pos.z+Math.cos(_aw)*40; zr.pos.set(_ax,heightAt(_ax,_az),_az); zr.brain="shamble"; zr.zTgt=null; zr.aggroT=0;');
G('zr.update(0.05);');
ok(G('zr.brain')==='shamble','T2 40m 外跑者维持游荡 (视距 34 不及)');
G('zr._riseT=0; zr.damage(10,player,false);');   // 初生免伤 (_riseT=1.2, 2026-10-11 批) 会吞直伤 —— 探针先清免疫窗再验迁怒
ok(G('zr.zTgt===player&&zr.brain==="chase"'),'T2 迁怒: 受击仇恨立即转攻击者');
G('zr.aggroT=0; zr.update(0.05);');
ok(G('zr.zTgt===null&&zr.brain==="shamble"'),'T2 丢失: 迁怒到期 → 回游荡');
console.log('── T3 感染链 ──');
{
const t0=G('tickets[0]'), zN=G('ZOMBIES.length');
G('var b0=soldiers.find(s=>!s.isPlayer&&s.team===player.team&&s.alive&&!s.onVehicle&&s.pilotOf==null); b0.damage(999,zw0,false);');
G('flushZombieInfections();');   // 感染走 PENDING_INFECTIONS 延迟队列 (防同帧双杀, 2026-10-11 批) —— 探针手动冲刷替代 frameTick
ok(G('b0.alive')===false,'T3 Bot 被尸杀 → 阵亡');
ok(G('b0.respawnT')>0&&G('b0.respawnT')<100,'T3 respawnT 进正常倒计时 (允许消耗票数重生)');
ok(G('b0.mesh.root.visible')===false,'T3 本体隐藏');
ok(G('ZOMBIES.length')===zN+1,'T3 原地尸变 (+1 丧尸)');
ok(G('tickets[0]')===t0-1,'T3 扣除兵力票 (消耗票数重生)');
}
console.log('── T4 近战 ──');
{
const hp0=G('player.hp');
G('zw0.pos.set(player.pos.x+1.2,player.pos.y,player.pos.z+1.2); zw0.zMelee(player);');   // 贴脸 (判距 2.6m 内)
// 2026-10-28 批: 伤害延时改 dt 驱动 (_pendAtk 0.38s, 红线2 禁 setTimeout) —— 旧"同步异步桩"失效,
// 探针改用 update 积分冲账 (8×0.05=0.4s 覆盖 0.38s 延时; 结算带 dy<1.8 三维门, 贴脸同面 dy=0 放行)。
for(let i=0;i<8;i++) G('zw0.update(0.05);');
ok(G('player.hp')<=hp0-40&&G('player.hp')>0,'T4 挥击伤害送达 (45, dt 账 0.38s 经 update 结算)');
ok(G('zw0.meleeT')>0,'T4 攻击间隔置位 (1.1s 节拍)');
G('player.hp=100;');
}
console.log('── T5 ZP 记账 ──');
{
const pz0=G('player.pz|0');
G('zw2=spawnZombie(player.pos.x+20,player.pos.z,"walker"); zw2._riseT=0; zw2.damage(999,player,false);');   // 清初生免伤窗 (2026-10-11 批)
ok(G('player.pz|0')===pz0+15,'T5 击杀普通尸 +15');
G('zb._riseT=0; zb.damage(999,player,false);');
ok(G('player.pz|0')===pz0+15+40,'T5 击杀重尸 +40');
G('pzGain(100);');
ok(G('player.pz|0')===pz0+15+40+100,'T5 pzGain 通道 (占旗钩子同款)');
}
console.log('── T6 工事血量 ──');
// T7 防区点断言先行 (2026-10-28): T6 会在玩家 9m 环上造沙袋 —— 与 zDefPosts 的 9~22m 驻点环同带,
// 后验会把"探针自己造的沙袋"算进 occBlocked ⇒ 断言顺序脆弱。防区点只依赖 BASES+OCC, 提前验。
ok(G('zDefPosts(0).length>=4&&zDefPosts(0).every(p=>!occBlocked(p.x,p.z))'),'T7 守基地防区点 (zDefPosts 可站立)');
{
const code=`
var _f=null,_g=null;
for(var a=0;a<16&&!_g;a++){
var aa=a*0.7, fx=player.pos.x+Math.sin(aa)*9, fz=player.pos.z+Math.cos(aa)*9;
if(occBlocked(fx,fz)) continue;
var bi0=BOXES.length;
if(!sandbagWall(fx,fz,4,aa)) continue;
_g=registerFortHP({type:'sandbag',tx:fx,tz:fz,meshes:[]},bi0);
_f={x:fx,z:fz,a:aa};
}
`;
G(code);
ok(G('!!_g&&_g.hp===300&&_g.bi.length>0'),'T6 沙袋登记血量组 (hp300, 盒入组)');
G('try{ damageStructures(V3(_f.x,heightAt(_f.x,_f.z)+0.5,_f.z),2.5,9999,null); }catch(e){ __fErr=String(e); }');
ok(G('typeof __fErr==="undefined"||__fErr===undefined'),'T6 damageStructures 全链无抛');
ok(G('_g.dead===true'),'T6 9999 伤害 → 工事组 dead');
}
console.log('── T7 导演 ──');
{
ok(G('!ZCFG.phases&&!!ZCFG.ramp&&ZCFG.ramp.cap0===30&&ZCFG.ramp.capPeak===110&&ZCFG.ramp.everyPeak<0.5&&ZCFG.phaseTimes.length===4&&ZDIFF_PROFILES.length===3')&&G('ZCFG.solo.surviveT')===720,'T7 持续尸潮: 两段平滑爬坡+档位标签+单队12min+难度三分档 (2026-10-11 曲线批)');
// 锚点隔离: 人类暂只剩玩家 (Bot 出 combatants) ⇒ 刷怪环绕玩家, 断言确定
G('var _cabs=combatants.filter(c=>!c.isPlayer&&!c.zombie); for(const c of _cabs){ const i=combatants.indexOf(c); if(i>=0) combatants.splice(i,1); }');
G('var _z0=ZOMBIES.length; zInit=true; zSurviveT=0; zSpawnCd=0; zombieFrameTick(0.05);');
ok(G('ZOMBIES.length')===G('_z0')+1,'T7 持续导演: 一帧必出尸');
ok(G('(()=>{ const z=ZOMBIES[ZOMBIES.length-1]; let dm=1e9; for(const c of combatants){ if(!c.alive||c.zombie||c.onVehicle||(c.isPlayer&&c.spectator)) continue; dm=Math.min(dm,Math.hypot(c.pos.x-z.pos.x,c.pos.z-z.pos.z)); } return dm>=28; })()'),'T7 刷点不进 28m 内圈 (2026-10-07d: 60% 全域散布, 上限不再限 62)');
G('zSurviveT=540; zSpawnCd=0; zombieFrameTick(0.05);');
ok(Math.abs(G('zSpawnCd')-G('getZCurrentInterval()'))<1e-6,'T7 540s 刷间隔=难度档插值 getZCurrentInterval (2026-10-11 分档批)');
ok(G('(()=>{const _zdp=zDefPosts(0); return _zdp.length>=4;})()'),'T7 守基地防区点 ≥4 (可站立判据已提前至 T6 前)');
G('for(const c of _cabs) combatants.push(c);');
let err=null; try{ G('zombieFrameTick(0.05); zombieFrameTick(0.05);'); }catch(e){ err=String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); }
ok(!err,'T7 zombieFrameTick 无抛'+(err?' :: '+err:''));
}
console.log('── T12 守基地 (2026-10-07b 二次裁定) ──');
{
// Bot 拉回基地圈再选目标 (bootStart 曾平移 +800m): objective 全=防区虚拟旗 id守, 贴己方基地, 无 Bot 以真旗为目标
G('for(const s of soldiers){ if(!s.isPlayer&&!s.zombie&&s.alive&&!s.onVehicle&&!s.pilotOf){ const k=soldiers.indexOf(s)*2.1; var _bx=BASES[player.team].x, _bz=BASES[player.team].z; s.pos.set(_bx+Math.sin(k)*15, heightAt(_bx+Math.sin(k)*15,_bz+Math.cos(k)*15), _bz+Math.cos(k)*15); s.objective=null; if(s.path) s.path.length=0; } }');
G('for(const s of soldiers){ if(!s.isPlayer&&!s.zombie&&s.alive&&!s.onVehicle&&!s.pilotOf) s.pickObjective(); }');
ok(G('soldiers.filter(s=>!s.isPlayer&&!s.zombie&&s.alive&&!s.onVehicle&&!s.pilotOf).length>0'),'T12 可选目标 Bot 在场');
ok(G('soldiers.filter(s=>!s.isPlayer&&!s.zombie&&s.alive&&!s.onVehicle&&!s.pilotOf).every(s=>s.objective&&s.objective.id==="守")'),'T12 Bot 目标全=守区虚拟旗 (不跑旗)');
ok(G('soldiers.filter(s=>!s.isPlayer&&!s.zombie&&s.alive&&!s.onVehicle&&!s.pilotOf).every(s=>{const b=BASES[s.team];return Math.hypot(s.objective.x-b.x,s.objective.z-b.z)<=26;})'),'T12 守区贴基地 (≤26m)');
ok(G('FLAGS.every(f=>!soldiers.some(s=>!s.isPlayer&&!s.zombie&&s.alive&&s.objective===f))'),'T12 无 Bot 以真旗为目标');
}
console.log('── T8 玩家死亡留尸 (裁定③) ──');
{
const zN=G('ZOMBIES.length'), t0=G('tickets[0]');
G('player.damage(9999,zw0,false);');   // 尸源击杀 (2026-10-28 判据跟走): 10-11 批感染门只认"丧尸击杀/全域感染" —— 无来源死亡不留尸
G('flushZombieInfections();');   // 同 T3: 感染队列由 frameTick 冲刷, 探针手动冲 (2026-10-11 批)
ok(G('ZOMBIES.length')===zN+1,'T8 玩家死亡原地 +1 丧尸');
ok(G('tickets[0]')===t0-1,'T8 正常死亡流程照走 (扣票)');
ok(G('player.alive')===false,'T8 玩家阵亡 (死亡/重部署链不受影响)');
}
console.log('── T10 多队模式完整开局 ──');
{
const {G:G2}=bootStart(PGIDX,'teams','T10');
G2('zombieFrameTick(0.05);');
ok(G2('fieldCount(0)')>0&&G2('fieldCount(1)')>0,'T10 双队均有人 (对抗编制完整)');
ok(G2('ZOMBIE_MODE')==='teams','T10 ZOMBIE_MODE=teams');
}
console.log('\n══ verify-zombie: '+pass+' 通过 / '+fail+' 失败 ══');
if(fails.length) console.log('失败项:\n - '+fails.join('\n - '));
process.exit(fail?1:0);
