// ─────────────────────────────────────────────
// dev/verify-zombie2-20261007.js —— 丧尸第二轮 (反坦克压力/事件波/预设图/全域刷/绕行/火力支援) 沙箱探针
// 用法: node dev/verify-zombie2-20261007.js
// 判据:
//   T1 幻影敌旗修复: procgen solo 开局后 FLAGS 全中立 (无 owner===1);
//   T2 主基地居中 (procgen solo): BASES[0]≈村镇核心 (PGDATA.core), 双基地同点;
//   T3 主基地居中 (预设图 solo): normandy BASES[0]≈中央旗旁 + spawns 清空;
//   T4 ZOMBIE_MODE 放宽: normandy+solo→'solo'; canyon/coral→'' (守点无从谈起/海图排除);
//   T5 载具守家: driveAI 丧尸分支 → objective._zv 驻车位 (贴基地, 非真旗);
//   T6 扒车: 围车→cling 挂车→伤车→_zClingN→高速甩落;
//   T7 机枪贴身死角: 2.5m 丧尸不被同轴选目标; 20m 重尸被选 + 主炮解锁 (bruteOK);
//   T8 自爆尸: 贴车引信→爆炸伤车+伤人+zSweep 退场;
//   T9 事件波: 静默→嘶吼预警→大波连刷 (ZOMBIES 增量);
//   T10 参数钉: cap1=75 / every1=0.85 / boomer 配置 / surge 配置;
//   T11 非丧尸回归: normandy assault 基地不居中/旗照常归属/turretAI 指纹含 ZOMBIE 门;
//   T12 全域散布刷怪: 刷出样本中存在距玩家 >70m 的落点 (包围主题, 60% far 域);
//   T13 侧向绕行: 贴墙卡住丧尸 zDetourT 被置位 (绕 0.8s);
//   T14/T15 火力支援指纹: 迫击炮/飞机目标选择段含丧尸分支;
//   T16 基地附属建筑 (全局): normandy 基地旁 25m 内有 cnHouse/logCabin 落档。
// 载入清单: 运行时解析 index.html (与 verify-zombie 同源, 不写死文件数)。
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
try{ G("document.getElementById('startBtn').onclick();"); }catch(e){ err='start: '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); }
if(!err){ try{ G('if(!player.alive||!player.deployed) deployPlayer();'); }catch(e){ err='deploy: '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); } }
if(!err) try{ G('for(const s of soldiers) s.protUntil=0; player.protUntil=0;'); }catch(e){}
// 探针豁免: 非玩家 Bot 平移 +800m (bootStart 同款, 感知圈外), 不改 alive/fieldCount
if(!err) try{ G('for(const s of soldiers){ if(!s.isPlayer&&!s.zombie){ s.pos.x+=800; s.pos.z+=800; s.pos.y=heightAt(s.pos.x,s.pos.z); if(s.path) s.path.length=0; } }'); }catch(e){}
ok(!err&&G('player.alive')===true,label+' 开局+部署');
if(err) console.log('     '+err);
return {ctx,G};
}
// 图索引 (运行时解析, 不写死)
const IDX={};
{const c0=boot(0,null);
for(const id of ['procgen','normandy','canyon','coral']) IDX[id]=vm.runInContext(`CAMPAIGNS.findIndex(c=>c.id==="${id}")`,c0);
}
console.log('── T4 ZOMBIE_MODE 放宽 (不开局, 载入期判据) ──');
{
const gN=boot(IDX.normandy,'solo');
ok(vm.runInContext('ZOMBIE_MODE',gN)==='solo','T4 normandy+solo → ZOMBIE_MODE=solo (预设陆地图开放)');
const gC=boot(IDX.canyon,'solo');
ok(vm.runInContext('ZOMBIE_MODE',gC)==='','T4 canyon (劫道, 无基地) → 空');
const gS=boot(IDX.coral,'solo');
ok(vm.runInContext('ZOMBIE_MODE',gS)==='','T4 coral (海战) → 空');
}
console.log('── T16 基地附属建筑 (全局要素, 普通对战即生效) ──');
{
const gN=boot(IDX.normandy,null);
ok(vm.runInContext('BUILD_REG.some(r=>(r.type==="cnHouse"||r.type==="logCabin")&&Math.hypot(r.x-BASES[0].x,r.z-BASES[0].z)<25)',gN),'T16 normandy 基地旁 25m 内有民居/木屋落档');
ok(vm.runInContext('BUILD_REG.some(r=>(r.type==="cnHouse"||r.type==="logCabin")&&Math.hypot(r.x-BASES[1].x,r.z-BASES[1].z)<25)',gN),'T16 双方基地都有 (对称)');
}
console.log('── T3 主基地居中 (预设图 solo, 不开局) ──');
{
const gN=boot(IDX.normandy,'solo');
ok(vm.runInContext('BASES[0].x',gN)!==-142,'T3 normandy solo 基地不再在 (-142,0)');
ok(vm.runInContext('Math.hypot(BASES[0].x-3,BASES[0].z-8)<15',gN),'T3 normandy solo 基地≈中央旗 C(3,8) 教堂旁 (<15m)');
ok(vm.runInContext('CAMPAIGN.spawns.length',gN)===0,'T3 solo spawns (攻方前出营) 清空');
ok(vm.runInContext('Math.hypot(BASES[0].x-BASES[1].x,BASES[0].z-BASES[1].z)<0.01',gN),'T3 双基地同点 (队1兜底)');
}
console.log('── T11 非丧尸回归 (normandy assault, 无 zsub) ──');
{
const {G}=bootStart(IDX.normandy,null,'T11');
ok(G('ZOMBIE_MODE')==='','T11 ZOMBIE_MODE 空');
ok(G('BASES[0].x')===-142&&G('BASES[0].z')===0,'T11 基地原位 (-142,0) 不居中');
ok(G('!CAMPAIGN.spawns||CAMPAIGN.spawns.length>0'),'T11 spawns 未被清 (normandy 本无该字段, 有则保留)');
ok(G('FLAGS.some(f=>f.owner===0)&&FLAGS.some(f=>f.owner===1)'),'T11 旗点照常归属 (攻防开局态势)');
ok(G('Tank.prototype.turretAI.toString().includes("ZOMBIE_MODE")&&Tank.prototype.turretAI.toString().includes("bruteOK")'),'T11 turretAI 指纹: ZOMBIE 门在场 (白天路径逐位包裹)');
ok(G('Tank.prototype.driveAI.toString().includes("_zv")'),'T11 driveAI 指纹: 丧尸分支在场 (else 链隔离)');
ok(G('Plane.prototype.planeAI.toString().includes("ZOMBIE_MODE")'),'T11 planeAI 指纹: 丧尸群候选带 ZOMBIE 门 (白天零变化)');
}
console.log('── 单队生存 (procgen · solo) ──');
const {ctx,G}=bootStart(IDX.procgen,'solo','T0');
ok(G('ZOMBIE_MODE')==='solo','T0 ZOMBIE_MODE=solo');
console.log('── T1 幻影敌旗修复 ──');
ok(G('FLAGS.every(f=>f.owner===-1)'),'T1 solo 开局后 FLAGS 全中立 (无 owner=1 幻影旗)');
ok(G('FLAGS.every(f=>f.own===undefined)'),'T1 own 字段已删 (05c solo 口径)');
console.log('── T2 主基地居中 (procgen) ──');
ok(G('Math.hypot(BASES[0].x-PGDATA.core.x,BASES[0].z-PGDATA.core.z)<12'),'T2 BASES[0]≈村镇核心 (<12m)');
ok(G('Math.hypot(BASES[0].x-BASES[1].x,BASES[0].z-BASES[1].z)<0.01'),'T2 双基地同点');
ok(G('Math.hypot(BASES[0].x-CAMPAIGN.bases[0].x,BASES[0].z-CAMPAIGN.bases[0].z)<0.01'),'T2 CAMPAIGN.bases 同步改写 (00c)');
console.log('── T10 参数钉 (提量+事件波+自爆尸) ──');
ok(G('ZCFG.ramp.capPeak')===110&&G('ZCFG.ramp.everyPeak')===0.45,'T10 提量: capPeak=110 / everyPeak=0.45 (2026-10-11 曲线批钉)');
ok(G('ZCFG.surge.firstT')===60&&G('ZCFG.surge.tele')===6&&G('ZCFG.surge.n0')===20&&G('ZCFG.surge.n1')===30,'T10 事件波配置 (firstT60/tele6/波量 20~30, 2026-10-11 批钉)');
ok(G('ZCFG.boomer.hp')===70&&G('ZCFG.boomer.vehDmg')===180&&G('ZCFG.zp.boomerKill')===25,'T10 自爆尸配置 (hp70/车伤180/ZP25)');
console.log('── T5 载具守家 ──');
{
G('var tk=new Tank(0,0); var cb=new Bot(0,0,"车组"); cb.spawnInVehicle(tk); tk.thinkCD=0; tk.repathT=0; tk.driveAI(0.05);');
ok(G('!!tk.objective&&tk.objective._zv===true'),'T5 driveAI 目标=驻车位 (_zv 标记)');
ok(G('Math.hypot(tk.objective.x-BASES[0].x,tk.objective.z-BASES[0].z)<=30'),'T5 驻车位贴基地 (≤30m 外环)');
ok(G('!FLAGS.some(f=>f===tk.objective)'),'T5 不以真旗为目标');
G('tk.driveAI(0.8); tk.driveAI(0.8);');
ok(G('tk.objective&&tk.objective._zv===true'),'T5 thinkCD 重选后仍守家 (不漂移到旗点评分)');
}
console.log('── T6 扒车链 ──');
{
// 玩家挪远 (丧尸 sight 28m 外): 让丧尸"只看见车"
G('player.pos.x+=100; player.pos.z+=60; player.pos.y=heightAt(player.pos.x,player.pos.z);');
G('tk.vel=0; tk.pos.set(BASES[0].x+50,heightAt(BASES[0].x+50,BASES[0].z),BASES[0].z); tk.yaw=0;');
G('var zw=spawnZombie(tk.pos.x+2.6,tk.pos.z,"walker");');
G('for(var i=0;i<7;i++){ nowT+=0.1; zw.update(0.1); }');   // 0.7s: 覆盖 zVehT2 初始节流 (rand 0~0.4)
ok(G('zw.clingVeh===tk'),'T6 围车→贴车 2.6m 进 cling (挂车)');
ok(G('zw.brain==="cling"'),'T6 brain=cling');
const hp0=G('tk.hp');
G('zw.clingDmgT=0;');
G('for(var i=0;i<16;i++){ nowT+=0.1; zw.update(0.1); }');   // 1.6s: 首口 0.5s + 1.0s 节拍 ≥2 口
ok(G('tk.hp')<hp0,'T6 扒车伤车 (免装甲直伤)');
ok(G('tk.hp')>hp0-40,'T6 车伤节流正确 (1.6s ≤ 3 口 walker)');
G('tk.update(0.016);');
ok(G('tk._zClingN')>=1,'T6 _zClingN 统计 ≥1 (减速驱动)');
G('tk.vel=9;');
// 甩落断言: 高速车旁丧尸"被甩落→立刻又扒回"是合法循环 (tk 静止假车速) —— 包装 zEndCling 计数甩落次数;
// 自伤 15 在 zEndCling **之后**扣 (包装点读到的是扣前血), 故血量走循环后验。
G('var _ec=Zombie.prototype.zEndCling, tossN=0;'+
'Zombie.prototype.zEndCling=function(){ if(this.clingVeh) tossN++; return _ec.call(this); };');
G('for(var i=0;i<9;i++){ nowT+=0.1; zw.update(0.1); }');
ok(G('tossN')>0,'T6 车速 9>4.5 持续 0.6s → 甩落发生过 (计数 '+G('tossN')+')');
ok(G('zw.hp')<100,'T6 甩落带小伤 (15, 循环后验血 '+G('zw.hp')+')');
G('Zombie.prototype.zEndCling=_ec;');
ok(G('zw.alive')===true,'T6 反复扒甩不死 (甩落伤 15 不致死)');
}
console.log('── T7 机枪死角 + 主炮对重尸 ──');
{
G('tk.vel=0; tk.crewBot=cb; tk.tTarget=null; tk.tMemT=0; tk.retargetT=0; tk.aiPerT=0;');
G('var zf=spawnZombie(tk.pos.x+2.5,tk.pos.z+0.4,"walker"); zf.clingVeh=tk;');
G('tk.tankPerceive(0.05); tk.turretAI(0.05);');
ok(G('tk.tTarget')===null,'T7 贴车 2.5m 丧尸进机枪死角 (tTarget 空)');
G('tk.tTarget=null; tk.retargetT=0; var zb2=spawnZombie(tk.pos.x+20,tk.pos.z,"brute");');
G('tk.tankPerceive(0.05); tk.turretAI(0.05);');
ok(G('tk.tTarget===zb2'),'T7 20m 重尸被选为目标');
G('tk.aimReact=0; tk.aiReact=0; tk.cannonCd=0; tk.turretPitch=0;');
// 2026-10-28 判据跟走: 固定 +x 方位在 10-24 田带批后会被庄稼/地形挡住 losOK 链 (开火预检含
// raycast+烟雾+庄稼+友军走廊) ⇒ 主炮 0.6s 退避不出膛。改环搜 32 方位取"弹道三查全清"的落点。
G('var _za3=0; { var _mv=tk.muzzle; for(var a2=0;a2<32;a2++){ var an2=a2*0.196; var fx2=tk.pos.x+Math.sin(an2)*20, fz2=tk.pos.z+Math.cos(an2)*20; var gy2=heightAt(fx2,fz2); var dir2=V3(fx2-_mv.x,(gy2+1.2)-_mv.y,fz2-_mv.z); var dd2=dir2.length()||1; dir2.normalize(); var bl2=raycastWorld(_mv,dir2,dd2); if((!bl2||bl2.dist>dd2-3.5)&&!(CROP_FIELDS.length&&cropBlocksLOS(_mv.x,_mv.y,_mv.z,fx2,gy2+1.2,fz2))){ _za3=an2; break; } } }');
G('var zb2c=ZOMBIES.indexOf(zb2); if(zb2c>=0) ZOMBIES.splice(zb2c,1); zb2.pos.set(tk.pos.x+Math.sin(_za3)*20,heightAt(tk.pos.x+Math.sin(_za3)*20,tk.pos.z+Math.cos(_za3)*20),tk.pos.z+Math.cos(_za3)*20); ZOMBIES.push(zb2);');
G('var ay=Math.atan2(zb2.pos.x-tk.pos.x,zb2.pos.z-tk.pos.z); tk.turretYaw=angDiff(tk.yaw,ay);');
const sh0=G('shells.length');
G('for(var fi2=0;fi2<12&&shells.length==='+sh0+';fi2++){ tk.cannonCd=0; tk.aimReact=0; tk.aiReact=0; tk.turretAI(0.05); }');
ok(G('shells.length')>sh0,'T7 主炮对重尸解锁 (bruteOK, dh>14, 环搜通视方位)');
}
console.log('── T8 自爆尸 ──');
{
G('tk.vel=0;');
const thp0=G('tk.hp');
// vb 放 bo 冲刺侧 (不隔坦克): bo 在 tk-3.0, vb 放 tk-5.2/z+1.2 → 距 bo ≈2.4m 无遮挡。
// new Bot 不自动激活 (构造 alive=false) —— 手动激活成活靶, 感知/爆炸才会认它。
G('var vb=new Bot(player.team,0,"工兵"); vb.alive=true; vb.hp=100; vb.maxHp=100; vb.pos.set(tk.pos.x-5.2,heightAt(tk.pos.x-5.2,tk.pos.z+1.2),tk.pos.z+1.2);');
const vhp0=G('vb.hp'), zn0=G('ZOMBIES.length');
G('var bo=spawnZombie(tk.pos.x-3.0,tk.pos.z,"boomer");');
G('for(var i=0;i<6;i++){ nowT+=0.1; bo.update(0.1); }');   // 0.6s: 覆盖扫描节流 → 起引信
ok(G('bo.fuseT')>0,'T8 贴目标 3m 内起引信 (0.8s)');
G('for(var i=0;i<9;i++){ nowT+=0.15; bo.update(0.15); }');   // 1.35s > 引信 0.8s
ok(G('tk.hp')<thp0-100,'T8 引爆伤车 (180×衰减 >100)');
ok(G('vb.hp')<vhp0,'T8 爆圈伤及 2.4m 内步兵 (explodeAt)');
G('zSweep();');
ok(G('ZOMBIES.length')===zn0+1-1,'T8 自爆尸 zSweep 后退场 (spawn+1, 引爆-1)');
ok(G('bo.alive')===false,'T8 自爆后 alive=false');
}
console.log('── T8b 被杀殉爆 + 近战三维门 (2026-10-28 修复批, 指导 §4.3) ──');
{
const {G:Gb}=bootStart(IDX.procgen,'solo','T8b');
// ① 自爆尸被枪弹击毙 → 当场殉爆 (旧版 die 无 boomer 分支 = 静默消失, 指导§一.3)
Gb('var vb2=new Bot(player.team,0,"工兵"); vb2.alive=true; vb2.hp=100; vb2.maxHp=100; vb2.pos.set(player.pos.x-2.5,heightAt(player.pos.x-2.5,player.pos.z),player.pos.z);');
const vhp0b=Gb('vb2.hp');
Gb('var bo2=spawnZombie(player.pos.x-4.5,player.pos.z,"boomer"); bo2._riseT=0;');
Gb('bo2.damage(999,player,false);');   // 枪弹击毙
ok(Gb('bo2.alive')===false,'T8b 自爆尸被击毙退场');
ok(Gb('vb2.hp')<vhp0b,'T8b 被杀殉爆: 4.5m 处 2.5m 内步兵吃爆圈 (旧版不爆)');
// ② 近战 dt 账 + Y 轴三维门: 高台 (>1.8m) 不再隔空抓杀 (红线2)
Gb('var zw3=spawnZombie(player.pos.x+1.2,player.pos.z+1.2,"walker"); zw3._riseT=0;');
const php0b=Gb('player.hp');
Gb('zw3.pos.set(player.pos.x+1.2,player.pos.y+3.0,player.pos.z+1.2); zw3.zMelee(player);');
for(let i=0;i<8;i++) Gb('zw3.update(0.05);');   // 0.4s > 0.38s 延时账
ok(Gb('player.hp')===php0b,'T8b 近战 Y 轴门: 3m 高差隔空不受伤 (旧版纯水平判距)');
Gb('zw3.meleeT=0; zw3.pos.y=player.pos.y; zw3.zMelee(player);');
for(let i=0;i<8;i++) Gb('zw3.update(0.05);');
ok(Gb('player.hp')<php0b,'T8b 同面贴脸照常命中 (dt 账 0.38s 经 update 结算)');
}
console.log('── T9 事件波 + T12 全域散布 ──');
{
const {G:G9}=bootStart(IDX.procgen,'solo','T9a');
// Bot 拉回 (zAnchor 质心不能被 +800 豁免拉飞 → 刷怪环出图)
G9('for(const s of soldiers){ if(!s.isPlayer&&!s.zombie){ s.pos.x-=800; s.pos.z-=800; s.pos.y=heightAt(s.pos.x,s.pos.z); } }');
const zn0=G9('ZOMBIES.length');
G9('zombieMatchStart();');                      // 复位导演 (zSurgeT=0: 过 firstT 即可预警)
G9('zSurviveT=89.5;');
for(let i=0;i<14;i++) G9('nowT+=0.5; zombieFrameTick(0.5);');   // 7s: 89.5→90 触发预警(6s)→96 大波
ok(G9('zSurgeState')>=2||G9('ZOMBIES.length')>zn0,'T9 嘶吼预警→大波状态机推进');
for(let i=0;i<20;i++) G9('nowT+=0.5; zombieFrameTick(0.5);');   // 再推 10s: 波内 0.35s/只 连刷
const zn1=G9('ZOMBIES.length');
ok(zn1>0,'T9 事件波实际刷出丧尸 ('+zn1+' 只在场)');
ok(G9('ZOMBIES.every(z=>z.zSpdMul===ZCFG.surge.spdMul||z.zSpdMul===1)'),'T9 波内移速乘子合法 (1.25 或常规 1)');
// T12 全域散布: 劫持 spawnZombie 记录刷出坐标 (出生点即刷域样本, 不受后续走位干扰)
G9('var born=[]; var _sz=spawnZombie; spawnZombie=function(x,z,k){ born.push([x,z]); return _sz(x,z,k); };');
G9('var px0=player.pos.x, pz0=player.pos.z;');
for(let i=0;i<40;i++) G9('nowT+=0.5; zombieFrameTick(0.5);');   // 再推 20s 常规刷怪
ok(G9('born.length')>4,'T12 常规刷怪样本充足 ('+G9('born.length')+' 只)');
ok(G9('born.some(p=>Math.hypot(p[0]-px0,p[1]-pz0)>70)'),'T12 存在 >70m 远域落点 (全域散布 60% far 域)');
ok(G9('born.every(p=>Math.hypot(p[0]-px0,p[1]-pz0)>=28)'),'T12 全部落点不进 28m 内圈');
}
console.log('── T13 侧向绕行 ──');
{
// 找墙: occBlocked 点的开阔侧 (任一 ±x/±z 2.4m 放行) —— 丧尸放开阔侧, 锚点=墙心 → 游荡撞墙 → 绕行
G('var wall=null,wx=0,wz=0;'+
'outer: for(var sx=-160;sx<160;sx+=6) for(var sz2=-160;sz2<160;sz2+=6){'+
' if(!occBlocked(sx,sz2)) continue;'+
' const sides=[[2.6,0],[-2.6,0],[0,2.6],[0,-2.6]];'+
' for(const s of sides){ if(!occBlocked(sx+s[0],sz2+s[1])){ wx=sx+s[0]*0.55; wz=sz2+s[1]*0.55; wall={x:sx,z:sz2}; break outer; } }'+
'}');
ok(G('!!wall'),'T13 找到墙边摆位点 (occBlocked 邻域)');
// 锚点=穿墙延伸 20m (远目标才进游荡移动分支; 锚点贴脸 1.4m 会掉进"原地晃"分支)
G('var zwt=spawnZombie(wx,wz,"walker"); zwt._cx=wx+(wall.x-wx)*20; zwt._cz=wz+(wall.z-wz)*20; zwt.zPerT=9; zwt.zVehT2=9;');
// 绕行层的触发前提 = Bot.moveDir 的 ±0.55~1.65rad 侧移避障**全向堵死** (实墙贴靠会滑步逃出卡住阈值,
// 这是 moveDir 既有的一线避障)。探针把 moveDir mock 成零位移 = 确定性复现"彻底卡死",
// 验证的是本批新增的**卡住检测+侧向选择+zDir 注入**逻辑块 (moveDir 物理属既有子系统, 不在本批范围)。
G('zwt.moveDir=function(){ this.vel.x=0; this.vel.z=0; };'+
'var detourHit=0, detAOK=true, prevT=0;'+
'for(var i=0;i<40;i++){ prevT=zwt.zDetourT; zwt.update(0.05);'+
' if(prevT<=0&&zwt.zDetourT>0){ detourHit++;'+
'  var ad=function(a,b){ var d=Math.abs(a-b)%6.2832; return d>3.14159?6.2832-d:d; };'+
'  var lf=zwt.yaw-1.5708, rg=zwt.yaw+1.5708, bk=zwt.yaw+3.14159;'+
'  if(Math.min(ad(zwt.zDetourA,lf),ad(zwt.zDetourA,rg),ad(zwt.zDetourA,bk))>0.05) detAOK=false; } }');
ok(G('detourHit')>0,'T13 全向堵死触发侧向绕行 (zDetourT 置位 '+G('detourHit')+' 次)');
ok(G('detAOK')===true,'T13 绕行方向 ∈ {±90°, 掉头} (侧向选择合法)');
ok(G('zwt.zDir(0.123)===zwt.zDetourA'),'T13 zDir 单点注入 (绕行期方向被接管)');
ok(G('zwt.alive')===true,'T13 绕行不死不毁 (40 帧存活)');
}
console.log('── T14/T15 火力支援指纹 (迫击炮/飞机索敌尸群) ──');
{
ok(G('String(Bot.prototype.update).includes("ZOMBIE_MODE")&&String(Bot.prototype.update).includes("bn>=3")'),'T14 迫击炮开火判定含尸群分支 (≥3 只成群)');
ok(G('Plane.prototype.planeAI.toString().includes("ZOMBIES")&&Plane.prototype.planeAI.toString().includes("cluster")'),'T15 飞机巡逻候选含尸潮密度评分');
}
console.log('── T17/T18 新游戏泄漏 + 丧尸票数对等 (2026-10-07d 实报双BUG) ──');
{
// T17: 丧尸页「开始新游戏」必须整页重载 (ZOMBIE_MODE 是载入期常量, 基地居中/旗点中立已烙进世界, 就地翻不回来)
ok(G('String(startNewGame).includes("sf_zsub")&&String(startNewGame).includes("sf_mzstart")&&String(startNewGame).includes("location.reload")'),
'T17 startNewGame 丧尸页清子模式+直达键重载 (不再就地重开成丧尸)');
// T18: 攻防守方 ×1.25 兵力倾斜只在标准模式; 丧尸模式 (尸潮=共同威胁) 初始票数两军对等
ok(G('String(applyFlagOwnership).includes("ZOMBIE_MODE?1:1.25")'),'T18 守方票数倾斜带丧尸豁免 (ZOMBIE_MODE?1:1.25)');
}
console.log('\n══ verify-zombie2-20261007: '+pass+' 通过 / '+fail+' 失败 ══');
if(fails.length) console.log('失败项:\n - '+fails.join('\n - '));
process.exit(fail?1:0);
