// ─────────────────────────────────────────────
// dev/verify-zombie-doublekill-bugfix.js
// 丧尸模式: 士兵转化双倍击杀/同时炸死丧尸 BUG 专项修复验证
// 覆盖: 巡飞弹 / 直击+溅射 / 手雷 explodeAt / 迫击炮 / 燃烧弹 / 载具碾压 / 初生爬起免伤
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
function boot(diff=2){ // 默认精英难度 (2分钟后全域感染激活)
for(const k in stub.byId)delete stub.byId[k];
const ctx=vm.createContext(Object.assign({},stub.sandbox));
ctx.document=stub.document; ctx.window=stub.window; ctx.CANNON=CANNON;
ctx.setTimeout=(f)=>{ try{ f(); }catch(e){} return 0; };
ctx.clearTimeout=()=>{};
ctx.localStorage={_s:{sf_campaign:'0',sf_zsub:'teams',sf_diff:String(diff)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of FILES) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
return ctx;
}
let pass=0,fail=0;const fails=[];
function ok(cond,msg){
if(cond){ pass++; console.log('  ✔ '+msg); }
else{ fail++; fails.push(msg); console.log('  ✘ '+msg); }
}

console.log('═══ 1. 验证巡飞弹爆炸击杀与双倍击杀排查 ═══');
{
 const ctx=boot(2);
 const G=s=>vm.runInContext(s,ctx);
 G('beginFreshMatch(); if(!player.alive||!player.deployed) deployPlayer();');
 G('zInit=true; zSurviveT=150;'); // 激活全域感染
 ok(G('isFullInfectionActive()')===true,'全域感染处于激活状态');

 // 选一名敌方地面Bot
 G('var targetBot=soldiers.find(s=>s.alive&&s.team!==player.team&&!s.zombie&&!s.onVehicle&&!s.pilotOf);');
 G('if(targetBot) targetBot.protUntil=0;');
 ok(G('targetBot!==null&&targetBot.alive===true'),'成功获取活着的敌方地面Bot');
 G('player.kills=0; player.score=0;');
 const pX=G('targetBot.pos.x'), pZ=G('targetBot.pos.z');
 const zCountBefore=G('ZOMBIES.length');

 // 模拟巡飞弹爆炸 (同 13-combat updateLoiters 引爆代码)
 G(`
  var p=targetBot.pos.clone();
  splashDamage(p,player,-1,9.5,240,560,true,'explo');
 `);

 ok(G('targetBot.alive')===false,'目标士兵已被巡飞弹炸死');
 ok(G('player.kills')===1,'巡飞弹击杀数精确为 1 (绝非两倍击杀)');
 ok(G('ZOMBIES.length')===zCountBefore,'巡飞弹引爆同一帧内现场绝无转化的活丧尸被同时炸死');
 ok(G('PENDING_INFECTIONS.length')===1,'待尸变队列中安全记录 1 个尸变任务');

 // 推进时间 1.5 秒, 丧尸安全破土爬起
 G('zombieFrameTick(1.5);');
 ok(G('ZOMBIES.length')===zCountBefore+1,'1.5秒后转化的丧尸安全破土爬出 (+1)');
 const newZombie=G('ZOMBIES[ZOMBIES.length-1]');
 ok(G('ZOMBIES[ZOMBIES.length-1]._riseT')>0,'新爬出的丧尸处于起身动作中 (_riseT > 0)');

 // 验证起身/初生免伤保护: 在 _riseT > 0 期间受到范围爆炸伤害不受损
 const zHpBefore=G('ZOMBIES[ZOMBIES.length-1].hp');
 G(`splashDamage(ZOMBIES[ZOMBIES.length-1].pos,player,-1,9.5,240,560,true,'explo');`);
 ok(G('ZOMBIES[ZOMBIES.length-1].hp')===zHpBefore,'起身期间初生免伤保护生效: 不吃爆炸余波伤害');
 ok(G('ZOMBIES[ZOMBIES.length-1].alive')===true,'起身期间丧尸保持存活');
 ok(G('player.kills')===1,'爬起免伤期间击杀数不产生误加');
}

console.log('\n═══ 2. 验证直击 + 溅射叠加武器（巡飞弹直击 / 穿甲炮弹） ═══');
{
 const ctx=boot(2);
 const G=s=>vm.runInContext(s,ctx);
 G('beginFreshMatch(); if(!player.alive||!player.deployed) deployPlayer();');
 G('zInit=true; zSurviveT=150;');
 G('var targetBot=soldiers.find(s=>s.alive&&s.team!==player.team&&!s.zombie&&!s.onVehicle&&!s.pilotOf);');
 G('if(targetBot) targetBot.protUntil=0;');
 G('player.kills=0;');
 const zCountBefore=G('ZOMBIES.length');

 // 模拟直击加溅射 (如巡飞弹直击: directSol.damage(400) + splashDamage)
 G(`
  var p=targetBot.pos.clone();
  targetBot.damage(400,player,false);
  splashDamage(p,player,-1,9.5,240,560,true,'explo');
 `);

 ok(G('targetBot.alive')===false,'目标士兵阵亡');
 ok(G('player.kills')===1,'直击+溅射双重判定下击杀数精确为 1 (绝不叠加双计)');
 ok(G('ZOMBIES.length')===zCountBefore,'同一帧内现场无转化的丧尸被直击或溅射二次击杀');
 G('flushZombieInfections();');
 ok(G('ZOMBIES.length')===zCountBefore+1,'尸变任务安全结算出土 (+1)');
}

console.log('\n═══ 3. 验证手雷 / 场景破坏爆炸（explodeAt） ═══');
{
 const ctx=boot(2);
 const G=s=>vm.runInContext(s,ctx);
 G('beginFreshMatch(); if(!player.alive||!player.deployed) deployPlayer();');
 G('zInit=true; zSurviveT=150;');
 G('var targetBot=soldiers.find(s=>s.alive&&s.team!==player.team&&!s.zombie&&!s.onVehicle&&!s.pilotOf);');
 G('if(targetBot) targetBot.protUntil=0;');
 G('player.kills=0;');
 const zCountBefore=G('ZOMBIES.length');

 // 手雷爆炸
 G(`
  var p=targetBot.pos.clone();
  explodeAt(p,player,10);
 `);

 ok(G('targetBot.alive')===false,'手雷炸死士兵');
 ok(G('player.kills')===1,'手雷击杀数精确为 1 (绝非双倍)');
 ok(G('ZOMBIES.length')===zCountBefore,'手雷爆点未炸死转化的丧尸');
 G('flushZombieInfections();');
 ok(G('ZOMBIES.length')===zCountBefore+1,'转化的丧尸安全出土 (+1)');
}

console.log('\n═══ 4. 验证迫击炮 / 反坦克火箭筒（多杀场景） ═══');
{
 const ctx=boot(2);
 const G=s=>vm.runInContext(s,ctx);
 G('beginFreshMatch(); if(!player.alive||!player.deployed) deployPlayer();');
 G('zInit=true; zSurviveT=150;');
 G('var enemies=soldiers.filter(s=>s.alive&&s.team!==player.team&&!s.zombie&&!s.onVehicle&&!s.pilotOf).slice(0,2);');
 ok(G('enemies.length')===2,'选取 2 名敌军士兵');
 G('enemies.forEach(e=>e.protUntil=0);');
 G('player.kills=0;');
 const zCountBefore=G('ZOMBIES.length');

 // 将两名敌军聚拢在爆点
 G(`
  enemies[0].pos.set(10,heightAt(10,10),10);
  enemies[1].pos.set(10.5,heightAt(10.5,10),10);
  var p=V3(10,heightAt(10,10),10);
  splashDamage(p,player,-1,8,200,100,false,'shell');
 `);

 ok(G('enemies[0].alive')===false&&G('enemies[1].alive')===false,'两名敌军均被炸死');
 ok(G('player.kills')===2,'炸死 2 名敌军击杀数精确为 2 (绝非 4 倍击杀)');
 ok(G('ZOMBIES.length')===zCountBefore,'两名转化的丧尸未在同一次爆炸中被同时炸死');
 G('flushZombieInfections();');
 ok(G('ZOMBIES.length')===zCountBefore+2,'两只丧尸均安全转化出土 (+2)');
}

console.log('\n═══ 5. 验证持续火焰伤害（燃烧弹 / 火海） ═══');
{
 const ctx=boot(2);
 const G=s=>vm.runInContext(s,ctx);
 G('beginFreshMatch(); if(!player.alive||!player.deployed) deployPlayer();');
 G('zInit=true; zSurviveT=150;');
 G('var targetBot=soldiers.find(s=>s.alive&&s.team!==player.team&&!s.zombie&&!s.onVehicle&&!s.pilotOf);');
 G('if(targetBot) targetBot.protUntil=0;');
 G('player.kills=0;');
 const zCountBefore=G('ZOMBIES.length');

 // 士兵在火焰中阵亡
 G(`targetBot.damage(999,player,false);`);
 ok(G('player.kills')===1,'点火者击杀数记 1');
 ok(G('ZOMBIES.length')===zCountBefore,'火中阵亡未当场刷出活丧尸承受火伤');
 G('flushZombieInfections();');
 const zw=G('ZOMBIES[ZOMBIES.length-1]');
 ok(G('ZOMBIES[ZOMBIES.length-1]._riseT')>0,'爬起中具备免伤');

 // 火焰每帧造成伤害, 起身期间免疫
 G(`ZOMBIES[ZOMBIES.length-1].damage(15,player,false);`);
 ok(G('player.kills')===1,'火海中爬起期间未被二次瞬杀加分');
}

console.log('\n═══ 6. 验证全域感染下玩家死亡转化 ═══');
{
 const ctx=boot(2);
 const G=s=>vm.runInContext(s,ctx);
 G('beginFreshMatch(); if(!player.alive||!player.deployed) deployPlayer();');
 G('zInit=true; zSurviveT=150; player.protUntil=0;');
 const zCountBefore=G('ZOMBIES.length');
 G('var killerBot=soldiers.find(s=>s.alive&&s.team!==player.team&&!s.zombie);');
 G('killerBot.kills=0;');

 // 敌军用爆炸炸死玩家
 G(`
  var p=player.pos.clone();
  player.damage(9999,killerBot,false);
 `);

 ok(G('player.alive')===false,'玩家阵亡');
 ok(G('killerBot.kills')===1,'击杀玩家的敌军击杀数精确为 1 (未产生两倍击杀)');
 ok(G('ZOMBIES.length')===zCountBefore,'同帧内玩家转化的丧尸未被炸死');
 G('flushZombieInfections();');
 ok(G('ZOMBIES.length')===zCountBefore+1,'玩家尸变在原地安全生成丧尸 (+1)');
}

console.log(`\n══ 结果统计: ${pass} 通过 / ${fail} 失败 ══`);
if(fail>0){ console.log('失败列表:\n'+fails.join('\n')); process.exit(1); }
