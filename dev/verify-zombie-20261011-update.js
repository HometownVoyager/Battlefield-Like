// ─────────────────────────────────────────────
// dev/verify-zombie-20261011-update.js
// 丧尸模式 2026-10-11 更新综合验证探针:
//   1. 12 分钟 (720s) 时限与四阶段
//   2. 压力曲线平滑 (前1分钟温和 → 1分钟次高压 → 10分钟缓慢登顶 → 10~12分钟顶峰压迫)
//   3. 难度分档 (新兵 / 老兵 / 精英) 影响刷怪上下限、频率、变体解锁与事件波规模
//   4. 全员死亡转化为丧尸规则 (新兵不生效 / 老兵10m生效 / 精英2m生效), 包含Bot与玩家
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
function boot(diff=1){
for(const k in stub.byId)delete stub.byId[k];
const ctx=vm.createContext(Object.assign({},stub.sandbox));
ctx.document=stub.document; ctx.window=stub.window; ctx.CANNON=CANNON;
ctx.setTimeout=(f)=>{ try{ f(); }catch(e){} return 0; };
ctx.clearTimeout=()=>{};
ctx.localStorage={_s:{sf_campaign:'0',sf_zsub:'solo',sf_diff:String(diff)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of FILES) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
return ctx;
}
let pass=0,fail=0;const fails=[];
function ok(cond,label){ if(cond){pass++;console.log('  ✔ '+label);} else {fail++;fails.push(label);console.log('  ✘ '+label);} }

console.log('═══ 1. 验证 12 分钟时限与阶段设置 ═══');
{
 const ctx=boot(1);
 const G=s=>vm.runInContext(s,ctx);
 ok(G('ZCFG.surviveT')===720,'ZCFG.surviveT 基准为 720 秒 (12分钟)');
 ok(G('ZCFG.solo.surviveT')===720,'ZCFG.solo.surviveT 为 720 秒');
 ok(G('ZCFG.teams.surviveT')===720,'ZCFG.teams.surviveT 为 720 秒');
 ok(JSON.stringify(G('ZCFG.phaseTimes'))==='[0,180,360,540]','四阶段时间点为 0, 180, 360, 540 秒');
 ok(G('ZCFG.phaseNames.length')===4,'阶段名共 4 个');
}

console.log('═══ 2. 验证难度分档配置与曲线模型 ═══');
{
 for(let d=0;d<=2;d++){
  const ctx=boot(d);
  const G=s=>vm.runInContext(s,ctx);
  const name=d===0?'新兵':d===1?'老兵':'精英';
  const P=G('getZDiffCfg()');
  ok(P!=null,`${name} 难度配置成功获取`);
  // 验证两段曲线
  // t=0
  G('zSurviveT=0;');
  const cap0=G('getZCurrentCap()');
  const ev0=G('getZCurrentInterval()');
  ok(cap0===P.cap0,`${name} t=0 上限等于 cap0 (${cap0})`);
  ok(Math.abs(ev0-P.every0)<0.001,`${name} t=0 刷新间隔等于 every0 (${ev0})`);

  // t=60 (1分钟，进入次高压)
  G('zSurviveT=60;');
  const cap60=G('getZCurrentCap()');
  const ev60=G('getZCurrentInterval()');
  ok(cap60===P.capSub,`${name} t=60 上限等于 capSub (${cap60})`);
  ok(Math.abs(ev60-P.everySub)<0.001,`${name} t=60 刷新间隔等于 everySub (${ev60})`);

  // t=330 (中间缓慢爬坡)
  G('zSurviveT=330;');
  const capMid=G('getZCurrentCap()');
  ok(capMid>cap60&&capMid<P.capPeak,`${name} t=330 上限平滑处于次高压与顶峰之间 (${capMid})`);

  // t=600 (10分钟，登顶)
  G('zSurviveT=600;');
  const cap600=G('getZCurrentCap()');
  const ev600=G('getZCurrentInterval()');
  ok(cap600===P.capPeak,`${name} t=600 上限等于 capPeak (${cap600})`);
  ok(Math.abs(ev600-P.everyPeak)<0.001,`${name} t=600 刷新间隔等于 everyPeak (${ev600})`);

  // t=700 (10~12分钟，维持顶峰)
  G('zSurviveT=700;');
  const cap700=G('getZCurrentCap()');
  ok(cap700===P.capPeak,`${name} t=700 维持顶峰上限 (${cap700})`);
 }

 // 验证精英难度上限 > 老兵 > 新兵
 const ctxRec=boot(0), ctxVet=boot(1), ctxEli=boot(2);
 const cR=vm.runInContext('getZDiffCfg().capPeak',ctxRec);
 const cV=vm.runInContext('getZDiffCfg().capPeak',ctxVet);
 const cE=vm.runInContext('getZDiffCfg().capPeak',ctxEli);
 ok(cR<cV&&cV<cE,`各难度峰值上限阶梯递增: 新兵(${cR}) < 老兵(${cV}) < 精英(${cE})`);

 // 验证丧尸基础近战伤害与移速保持一致未加成
 ok(vm.runInContext('ZCFG.meleeDmg',ctxRec)===45&&vm.runInContext('ZCFG.meleeDmg',ctxEli)===45,'丧尸近战伤害保持 45 未加成');
 ok(vm.runInContext('ZCFG.walker.spd',ctxRec)===1.85&&vm.runInContext('ZCFG.walker.spd',ctxEli)===1.85,'丧尸移动速度保持基准未加成');
}

console.log('═══ 3. 验证全员死亡转化为丧尸规则契约 ═══');
{
 // 新兵: 永不生效
 const ctx0=boot(0);
 const G0=s=>vm.runInContext(s,ctx0);
 G0('zSurviveT=0;'); ok(!G0('isFullInfectionActive()'),'新兵 t=0 全域感染不生效');
 G0('zSurviveT=150;'); ok(!G0('isFullInfectionActive()'),'新兵 t=150 全域感染不生效');
 G0('zSurviveT=650;'); ok(!G0('isFullInfectionActive()'),'新兵 t=650 全域感染不生效');

 // 老兵: 10分钟后 (600s) 生效
 const ctx1=boot(1);
 const G1=s=>vm.runInContext(s,ctx1);
 G1('zSurviveT=0;'); ok(!G1('isFullInfectionActive()'),'老兵 t=0 全域感染不生效');
 G1('zSurviveT=599;'); ok(!G1('isFullInfectionActive()'),'老兵 t=599 全域感染不生效');
 G1('zSurviveT=600;'); ok(G1('isFullInfectionActive()'),'老兵 t=600 全域感染生效');
 G1('zSurviveT=710;'); ok(G1('isFullInfectionActive()'),'老兵 t=710 全域感染生效');

 // 精英: 2分钟后 (120s) 生效
 const ctx2=boot(2);
 const G2=s=>vm.runInContext(s,ctx2);
 G2('zSurviveT=0;'); ok(!G2('isFullInfectionActive()'),'精英 t=0 全域感染不生效');
 G2('zSurviveT=119;'); ok(!G2('isFullInfectionActive()'),'精英 t=119 全域感染不生效');
 G2('zSurviveT=120;'); ok(G2('isFullInfectionActive()'),'精英 t=120 全域感染生效');
 G2('zSurviveT=500;'); ok(G2('isFullInfectionActive()'),'精英 t=500 全域感染生效');
}

console.log('═══ 4. 验证阵亡转化联动（Bot 与玩家） ═══');
{
 const ctx=boot(2); // 精英难度
 const G=s=>vm.runInContext(s,ctx);
 G('beginFreshMatch(); if(!player.alive||!player.deployed) deployPlayer();');
 G('zInit=true;');

 // 情况 A: 前 2 分钟 (未激活全域感染), 非丧尸击杀 Bot 不尸变
 G('zSurviveT=30;');
 const zCount0=G('ZOMBIES.length');
 G('var testBot=soldiers.find(s=>!s.isPlayer&&!s.zombie&&s.alive&&!s.onVehicle&&!s.pilotOf);');
 G('testBot.damage(9999,null,false);');
 ok(G('ZOMBIES.length')===zCount0,'全域感染前: Bot 非丧尸死因不尸变');

 // 情况 B: 超过 2 分钟 (精英激活全域感染), 任何死因 (例如 attacker=null) Bot 原地尸变
 G('zSurviveT=150;');
 ok(G('isFullInfectionActive()')===true,'确认已进入全域感染期');
 G('var testBot2=soldiers.find(s=>!s.isPlayer&&!s.zombie&&s.alive&&!s.onVehicle&&!s.pilotOf);');
 const zCount1=G('ZOMBIES.length');
 G('testBot2.damage(9999,null,false); flushZombieInfections();');
 ok(G('ZOMBIES.length')===zCount1+1,'全域感染后: Bot 任何死亡方式 (attacker=null) 均转化为丧尸 (+1)');

 // 情况 C: 玩家死亡留尸
 // 在全域感染期，玩家即使被非丧尸击杀/自杀 (attacker=null) 也会在原地留尸
 const zCount2=G('ZOMBIES.length');
 G('player.damage(9999,null,false); flushZombieInfections();');
 ok(G('ZOMBIES.length')===zCount2+1,'全域感染后: 玩家任何死亡方式原地生成丧尸 (+1)');

 // 验证 HUD 与广播
 G('updateZpHud();');
 ok(G('zHudEl.textContent.includes("全域感染")'),'HUD 顶部显示 [全域感染] 状态');
}

console.log(`\n══ 结果统计: ${pass} 通过 / ${fail} 失败 ══`);
if(fail>0){ console.log('失败列表:\n'+fails.join('\n')); process.exit(1); }
