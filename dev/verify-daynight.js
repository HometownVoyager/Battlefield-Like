// ─────────────────────────────────────────────
// dev/verify-daynight.js —— 昼夜模式批沙箱 (2026-10-05, 不进 index.html)
// 用法: node dev/verify-daynight.js
// 原理: 复用 dev/_bootstub.js 桩, 以不同 sf_daynight/sf_campaign 存档**各 boot 一遍全部真实脚本**,
//       断言"夜档生效 / 白天零回归"两个方向 (昼夜设计 §3.3 红线)。
// 断言 (T1~T5):
//   T1 白天零回归: sf_daynight 缺省 boot 百团(晴) —— NIGHT_MODE=false, exposure 1.05 / 雾色雾距 /
//      hemi/sun 原值 / 无星星 / vmScene 灯原值 / 枪口·爆炸灯距离原值 / maTint 原对象恒等 / mmEnemyVis 恒 true;
//   T2 夜档视觉: sf_daynight=night boot 百团(晴) —— exposure/fog(色向夜蓝 mix+雾距×0.55)/hemi/sun 月光档/
//      星星 Points 在场 / vmScene 灯 ×vmLightMul / 枪口·爆炸灯 ×flashRangeMul / maTint 压暗副本;
//      天气×夜: 诺曼底(overcast) sun=THEME.sunI×0.30×0.55 (顺序钉死); ironbottom 锁夜(R5): sf_daynight=day
//      仍 NIGHT_MODE=true, overcast×夜双乘即校准样本;
//   T3 感知/信息: Bot 索敌 85m 昼见/夜不见, 65m 夜+照明弹补亮可见, 探照灯照中 ×searchView 且无视 FOV 门;
//      听枪 96m 昼不闻/夜闻 (65/70 ×1.5); aim assist 130m 昼吸/夜不吸 (只缩 range); 小地图夜规
//      60m 常显 / 开火 2.5s 显形 / 观战旁路全显; nightLitMul 单源 (照明半径 1.4 / 半径外 1);
//   T4 N2 装备行为: 大灯 AI 状态机(行进开灯/交战关灯/玩家车 L 自管) + 真灯池 ≤2; 旗点照明弹生命周期
//      (normandy 攻防旗点建弹, 相位可拨, 燃烧窗口可见/熄灭不可见); 探照灯: 登记表→光柱构建→照中玩家
//      记 _searchLitT; 飞机翼尖红绿夜航灯 (仅夜档创建, 左右反相闪);
//   T5 静态接线: 消费点表逐条子串断言 (不写死行号; 探针纪律: FILES 与 index.html 实载同序一致)。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const {sandbox,document,window,byId}=require('./_bootstub.js');
// ── 桩补丁 (夜档新用到件: Color.lerp/getHex + SpotLight; PointLight 补 distance 形参) ──
const _Color=sandbox.THREE.Color;
if(!_Color.prototype.getHex){
_Color.prototype.getHex=function(){ const c=typeof this.c==='number'?this.c:0; return c; };
}
if(!_Color.prototype.lerp){
const _p=h=>{ h=typeof h==='number'?h:parseInt(String(h).replace('#',''),16)||0; return [(h>>16)&255,(h>>8)&255,h&255]; };
_Color.prototype.lerp=function(target,a){
const c0=_p(this.c), c1=_p(target&&target.c!==undefined?target.c:target);
const mix=c0.map((v,i)=>Math.round(v+(c1[i]-v)*a));
this.c=(mix[0]<<16)|(mix[1]<<8)|mix[2];
return this;
};
}
if(!sandbox.THREE.SpotLight){
sandbox.THREE.SpotLight=class extends sandbox.THREE.Object3D{
constructor(c,i,d,a,p,dec){ super(); this.color=c; this.intensity=i||0; this.distance=d||0; this.angle=a||0; this.penumbra=p||0; this.decay=dec||1; this.castShadow=false; this.visible=true;
this.target=new sandbox.THREE.Object3D(); this.target.updateMatrixWorld=()=>{}; }
};
}
sandbox.THREE.PointLight=class extends sandbox.THREE.Object3D{
constructor(c,i,d,dec){ super(); this.color=c; this.intensity=i||0; this.distance=d||0; this.decay=dec||1; this.castShadow=false; }
};
// ── 全链文件表 (与 index.html 实载同序; 探针纪律: 载入清单漂移 = 假绿, 改 index.html 必同步这里;
//    实载脚本数在 T5 里从 index.html 动态解析对账, 不写死数字) ──
const FILES=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/19b-gamepad.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/22a-menuart.js','js/22b-speclayer.js','js/23-deploy.js','js/23b-worldrestore.js','js/24-main.js'];
// index.html 实载脚本数对账 (T5): FILES.length 必须等于 html 里的 <script src="js/...">
const read=(f)=>fs.readFileSync(path.join(root,f),'utf8');
function load(ctx,file){ vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file}); }
const PRELUDE=`var __AA=(function(){
function mkBot(team,x,z,name){
const b=new Bot(team,0,name||'靶'); b.alive=true; b.pos.set(x,heightAt(x,z),z); b.vel.set(0,0,0);
b.onVehicle=null; b.spectator=false; b.hp=100; b.lastFiredT=-99;
return b;
}
function openSpot(len){
const lim=MAP_SIZE/2-16;
for(let i=0;i<6000;i++){
const ax=(Math.random()*2-1)*lim, az=(Math.random()*2-1)*lim;
const bx=ax, bz=az-len;
if(Math.abs(bz)>lim) continue;
const ha=heightAt(ax,az), hb=heightAt(bx,bz);
if(Math.abs(ha-hb)>1.0) continue;
if(occBlocked(ax,az)||occBlocked(bx,bz)) continue;
const o=V3(ax,ha+1.6,az), t=V3(bx,hb+1.10,bz);
const d=t.clone().sub(o); const L=d.length(); d.normalize();
if(raycastWorld(o,d,Math.max(0.1,L-0.6))) continue;
return {ax,az,bx,bz,ha,hb};
}
return null;
}
function clearTroops(){ for(const s of soldiers) s.alive=false; soldiers.length=0; combatants.length=0; }
function clearVehicles(){ for(const t of tanks) t.alive=false; for(const t of trucks) t.alive=false;
try{ for(const p of planes) p.alive=false; }catch(e){} }
return {mkBot,openSpot,clearTroops,clearVehicles};
})();`;
function boot(opts){
const o=opts||{};
for(const k in byId) delete byId[k];
const store=Object.assign({sf_campaign:'4'},o.store||{});   // 缺省百团 (晴, 破袭) = 天气干净档
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document; ctx.window=window;
ctx.localStorage={_s:store,getItem(k){return (k in this._s)?this._s[k]:null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of FILES) load(ctx,f);
vm.runInContext(PRELUDE,ctx,{filename:'prelude'});
return ctx;
}
const VM=(ctx,expr)=>vm.runInContext(expr,ctx);
let PASS=0,FAILS=0;
function ok(cond,label){ if(cond){ PASS++; console.log('  ✔ '+label); } else { FAILS++; console.log('  ✘ '+label); } }
function exc(tag,e){ ok(false,tag+' 推演异常: '+String(e&&e.stack||e)); }
const START=`document.getElementById('startBtn').onclick();`;
function enter(ctx){
const err=VM(ctx,`(()=>{try{ ${START} }catch(e){ return String(e&&e.message||e); } return null; })()`);
if(err){ ok(false,'开局 (真路径 startBtn.onclick): '+err); return false; }
return true;
}

// ═════ T1 白天零回归 ═════
function t1(){
console.log('T1 白天零回归: 缺省 boot 百团(晴) —— 全部原值');
const ctx=boot({});
const r=VM(ctx,`(()=>{try{
const dayFar=(()=>{const q=SETTINGS.quality;return (q===0?240:(q===1?340:420))*WX_CFG.fogFarMul*(THEME.fogMul||1)*((CAMPAIGN.mapSize||320)>=640?1.35:1);})();
return {
nm:NIGHT_MODE, isN:isNight(),
exp:renderer.toneMappingExposure,
fogHex:scene.fog.color.getHex(), themeFog:THEME.fog, fogFar:scene.fog.far, dayFar, fogNear:dryFogNear(),
hemi:hemi.intensity, hemiI:THEME.hemi[2],
sunI:sun.intensity, sunC:sun.color.getHex(), themeSunC:THEME.sun, themeSunI:THEME.sunI,
points:scene.children.filter(o=>o.isPoints).length,
vmH:vmScene.children[0].intensity, vmD:vmScene.children[1].intensity,
flashD:flashLight.distance, muzD:VM.muzzleLight.distance,
tint:maTint(), chinaRef:MA_TINT[CAMPAIGN.theme],
mmFar:mmEnemyVis(player.pos.x+200,player.pos.z),
mmNear:mmEnemyVis(player.pos.x+10,player.pos.z),
cfgKeys:Object.keys(NIGHT_CFG).length, gearKeys:Object.keys(NIGHT_GEAR).length
};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof r==='string'){ exc('T1',r); return; }
ok(r.nm===false&&r.isN===false,'T1 NIGHT_MODE=false / isNight()=false (缺省白天)');
ok(r.exp===1.05,'T1 toneMappingExposure 1.05 逐位');
ok(r.fogHex===r.themeFog,'T1 雾色 = THEME.fog 原值');
ok(r.fogFar===r.dayFar&&r.fogNear===40,'T1 雾距 = dryFogFar() 原公式 / fogNear 40');
ok(r.hemi===r.hemiI,'T1 hemi = THEME.hemi[2] 原值');
ok(r.sunI===r.themeSunI&&r.sunC===r.themeSunC,'T1 sun 原色原强度');
ok(r.points===0,'T1 场景无星星 Points (晴图白天也无降水粒子)');
ok(r.vmH===0.9&&r.vmD===1.6,'T1 vmScene 灯 0.9/1.6 原值');
ok(r.flashD===26&&r.muzD===3,'T1 爆炸灯 26 / 枪口灯 3 原距离');
ok(r.tint===r.chinaRef,'T1 maTint() 返回原主题对象 (恒等, 未压暗)');
ok(r.mmFar===true&&r.mmNear===true,'T1 mmEnemyVis 白天恒 true (2026-09-06 全显裁定不动)');
ok(r.cfgKeys>=16&&r.gearKeys>=10,'T1 NIGHT_CFG/NIGHT_GEAR 单源表在场');
}

// ═════ T2 夜档视觉 ═════
function t2(){
console.log('T2 夜档视觉: 百团(晴) 夜 boot + 诺曼底(阴) 天气×夜 + ironbottom 锁夜');
const ctx=boot({store:{sf_campaign:'4',sf_daynight:'night'}});
const r=VM(ctx,`(()=>{try{
const q=SETTINGS.quality;
const dayFar=(q===0?240:(q===1?340:420))*WX_CFG.fogFarMul*(THEME.fogMul||1)*((CAMPAIGN.mapSize||320)>=640?1.35:1);
const ec=new THREE.Color(THEME.fog); ec.lerp(new THREE.Color(0x101a28),NIGHT_CFG.fogMix);
return {
nm:NIGHT_MODE, exp:renderer.toneMappingExposure, expCfg:NIGHT_CFG.exposure,
fogHex:scene.fog.color.getHex(), fogExp:ec.getHex(),
fogFar:scene.fog.far, farExp:dayFar*NIGHT_CFG.fogFarMul, fogNear:dryFogNear(), fogNearE:40*NIGHT_CFG.fogNearMul,
hemi:hemi.intensity, hemiExp:THEME.hemi[2]*NIGHT_CFG.hemiMul,
sunI:sun.intensity, sunIExp:THEME.sunI*NIGHT_CFG.sunMul, sunC:sun.color.getHex(), moonC:NIGHT_CFG.moonCol,
points:scene.children.filter(o=>o.isPoints).length,
skyHas:!!(SKY&&SKY.material&&SKY.material.map),
vmH:vmScene.children[0].intensity, vmHE:0.9*NIGHT_CFG.vmLightMul,
vmD:vmScene.children[1].intensity, vmDE:1.6*NIGHT_CFG.vmLightMul,
flashD:flashLight.distance, flashE:26*NIGHT_CFG.flashRangeMul,
muzD:VM.muzzleLight.distance, muzE:3*NIGHT_CFG.flashRangeMul,
tint:maTint(), lo0:MA_TINT[CAMPAIGN.theme].lo, lo1:maTint().lo, tintOrig:maTint()===MA_TINT[CAMPAIGN.theme],
};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof r==='string'){ exc('T2百团',r); return; }
ok(r.nm===true,'T2 NIGHT_MODE=true (sf_daynight=night)');
ok(r.exp===r.expCfg,'T2 exposure = NIGHT_CFG.exposure (0.72 覆盖 1.05)');
ok(r.fogHex===r.fogExp,'T2 雾色 = THEME.fog 向夜蓝 mix (独立复算一致)');
ok(r.fogFar===r.farExp&&r.fogNear===r.fogNearE,'T2 雾距 ×fogFarMul / 雾起 ×fogNearMul');
ok(r.hemi===r.hemiExp,'T2 hemi ×hemiMul (0.45, 比 nightsea 满月 0.55 更暗)');
ok(r.sunI===r.sunIExp&&r.sunC===r.moonC,'T2 sun = 月光档 (×sunMul, 冷蓝固定色)');
ok(r.points>=1,'T2 星星 Points 在场');
ok(r.skyHas,'T2 夜空渐变球在场 (夜档用 nightsea 色板基线, 静态断言见 T5)');
ok(r.vmH===r.vmHE&&r.vmD===r.vmDE,'T2 vmScene 灯 ×vmLightMul (枪不独亮)');
ok(r.flashD===r.flashE&&r.muzD===r.muzE,'T2 爆炸/枪口灯距离 ×flashRangeMul');
ok(r.tint!==undefined&&r.lo1!==r.lo0&&r.tintOrig===false,'T2 maTint 夜档返回压暗副本 (非原对象/非原色)');
// 天气×夜 (顺序钉死): 诺曼底 overcast (期望值引用 WX_CFG 档值 —— 钉的是复合次序, 不钉档位数字)
const rn=VM(boot({store:{sf_campaign:'0',sf_daynight:'night'}}),`(()=>{try{
return {nm:NIGHT_MODE, sunI:sun.intensity, sunE:THEME.sunI*NIGHT_CFG.sunMul*WX_CFG.sunMul, hemi:hemi.intensity, hemiE:THEME.hemi[2]*NIGHT_CFG.hemiMul*WX_CFG.hemiMul, sm:WX_CFG.sunMul, hm:WX_CFG.hemiMul};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof rn==='string'){ exc('T2诺曼底',rn); } else {
ok(rn.nm===true&&rn.sunI===rn.sunE&&rn.hemi===rn.hemiE,'T2 ★ 天气×夜: overcast 在夜档系数之上再乘 (sun×'+rn.sm+' / hemi×'+rn.hm+', 顺序钉死)');
}
// ironbottom 锁夜 (R5): sf_daynight=day 仍强制夜
const ri=VM(boot({store:{sf_campaign:'13',sf_daynight:'day'}}),`(()=>{try{
return {nm:NIGHT_MODE, id:CAMPAIGN.id, sunI:sun.intensity, sunE:THEME.sunI*NIGHT_CFG.sunMul*WX_CFG.sunMul, hemi:hemi.intensity, hemiE:THEME.hemi[2]*NIGHT_CFG.hemiMul*WX_CFG.hemiMul};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof ri==='string'){ exc('T2铁底',ri); } else {
ok(ri.nm===true&&ri.id==='ironbottom','T2 ★ R5 锁夜: sf_daynight=day 时 ironbottom 仍 NIGHT_MODE=true');
ok(ri.sunI===ri.sunE&&ri.hemi===ri.hemiE,'T2 ★ 校准样本: overcast×夜双乘 (ironbottom 不过黑按此调)');
}
}

// ═════ T3 感知 / 信息 ═════
function t3(){
console.log('T3 感知/信息: 索敌/补亮/照中/听枪/吸附/小地图 (昼 vs 夜)');
// 3a 白天基线
const rd=VM(boot({store:{sf_campaign:'4'}}),`(()=>{try{
nowT=100;
__AA.clearTroops(); __AA.clearVehicles();
const sp=__AA.openSpot(85); if(!sp) return 'NOPLACE';
const A=__AA.mkBot(0,sp.ax,sp.az,'哨'); A.yaw=Math.PI;
const B=__AA.mkBot(1,sp.bx,sp.bz,'靶');
A.perceive();
const seen85=A.target===B;
// 听枪: B 开火 (96m 档在夜 boot 里测, 这里测白天 96m 不闻的另一面 —— 复用同点位太远, 单独算)
return {seen85};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof rd==='string'){ exc('T3白天',rd); } else ok(rd.seen85===true,'T3 昼: 85m 索敌可见 (viewD=95)');
// 3b 夜档
const ctx=boot({store:{sf_campaign:'4',sf_daynight:'night'}});
const rn=VM(ctx,`(()=>{try{
nowT=100;
__AA.clearTroops(); __AA.clearVehicles();
const res={};
// 索敌: 85m 夜不见 (95×0.55=52.25)
{
const sp=__AA.openSpot(85); if(!sp) return 'NOPLACE';
const A=__AA.mkBot(0,sp.ax,sp.az,'哨'); A.yaw=Math.PI;
const B=__AA.mkBot(1,sp.bx,sp.bz,'靶');
A.perceive(); res.seen85=A.target===B;
// 探照灯照中: viewD ×searchView 且无视 FOV 门 (A 面向 +Z, 靶在 -Z, FOV 本来挡死)
B._searchLitT=nowT; A.yaw=0; A.target=null; A.lastSeenT=-99;
A.perceive(); res.searchSeen=A.target===B;
B._searchLitT=-99;
}
// 照明弹补亮: 65m 夜不见 → 假照明弹盖在靶上 → 可见 (52.25×1.4=73.15)
{
__AA.clearTroops(); __AA.clearVehicles();   // 逐块清场: 上一块的 Bot 随机落位可能更近且可见, 会把 A.target 抢走 (实测 ~1/3 偶发)
const sp=__AA.openSpot(65); if(!sp) return 'NOPLACE2';
const A=__AA.mkBot(0,sp.ax,sp.az,'哨2'); A.yaw=Math.PI;
const B=__AA.mkBot(1,sp.bx,sp.bz,'靶2');
A.perceive(); res.seen65flame0=A.target===B;
FLARES.push({x:B.pos.x,z:B.pos.z,gy:B.pos.y,y:50,lit:1,sp:null,disc:null});
A.target=null; A.lastSeenT=-99; A.perceive();
res.seen65flame1=A.target===B;
res.litCenter=nightLitMul(B.pos.x,B.pos.y,B.pos.z);
res.litFar=nightLitMul(B.pos.x+200,B.pos.y,B.pos.z);
res.litCfg=NIGHT_GEAR.flareLitView;
FLARES.length=0;
}
// 听枪: 96m —— 白天 (65) 不闻 / 夜 (97.5) 闻; 两档都不可见 (>95)
{
__AA.clearTroops(); __AA.clearVehicles();   // 同上: 逐块清场防跨块偷靶
const sp=__AA.openSpot(96); if(!sp) return 'NOPLACE3';
const A=__AA.mkBot(0,sp.ax,sp.az,'哨3'); A.yaw=Math.PI;
const B=__AA.mkBot(1,sp.bx,sp.bz,'靶3');
B.lastFiredT=nowT-0.1;
gunEvents.push({x:B.pos.x,z:B.pos.z,t:nowT,team:1,shooter:B});
A.perceive(); res.heardNight=Math.abs(A.lastSeenPos.x-B.pos.x)<1&&Math.abs(A.lastSeenPos.z-B.pos.z)<1;
res.seenNight96=A.target===B;   // 96>52.25 ⇒ 不可见 (排除"看到"假阳性)
}
// 小地图夜规
{
player.spectator=false; player.alive=true; player.pos.set(0,0,0);
res.mm40=mmEnemyVis(40,0);
res.mm90=mmEnemyVis(90,0);
res.mmFire=mmEnemyVis(90,0,nowT-1);
res.mmOldFire=mmEnemyVis(90,0,nowT-9);
player.spectator=true;
res.mmSpec=mmEnemyVis(900,0);
player.spectator=false;
}
return res;
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof rn==='string'){ exc('T3夜',rn); return; }
ok(rn.seen85===false,'T3 夜: 85m 索敌不可见 (×0.55 实战档)');
ok(rn.searchSeen===true,'T3 夜: 探照灯照中 ×searchView 且无视 FOV 门 (背向也咬上)');
ok(rn.seen65flame0===false&&rn.seen65flame1===true,'T3 夜: 65m 不可见 → 照明弹半径内可见 (×flareLitView)');
ok(rn.litCenter===rn.litCfg&&rn.litFar===1,'T3 nightLitMul 单源: 半径内 1.4 / 半径外 1');
ok(rn.heardNight===true&&rn.seenNight96===false,'T3 夜: 96m 枪声入账 (65×1.5) 而人不可见 (开火暴露≠看见)');
ok(rn.mm40===true&&rn.mm90===false&&rn.mmFire===true&&rn.mmOldFire===false,'T3 夜: 小地图 60m 常显 / 90m 隐 / 开火 2.5s 显形 / 过期隐');
ok(rn.mmSpec===true,'T3 夜: 观战旁路=全显 (R3)');
// 3c 听枪白天阴性 (96m 不闻) + aim assist 昼吸/夜不吸
const rc=VM(boot({store:{sf_campaign:'4'}}),`(()=>{try{
nowT=100;
__AA.clearTroops(); __AA.clearVehicles();
const sp=__AA.openSpot(96); if(!sp) return 'NOPLACE';
const A=__AA.mkBot(0,sp.ax,sp.az,'哨'); A.yaw=Math.PI;
const B=__AA.mkBot(1,sp.bx,sp.bz,'靶');
B.lastFiredT=nowT-0.1;
gunEvents.push({x:B.pos.x,z:B.pos.z,t:nowT,team:1,shooter:B});
A.perceive();
const heardDay=Math.abs(A.lastSeenPos.x-B.pos.x)<1&&Math.abs(A.lastSeenPos.z-B.pos.z)<1;
// aim assist: 130m 近失误 —— 白天 (range 170) 吸, 夜 (110.5) 不吸
SETTINGS.aim=1;
const T=V3(sp.bx,sp.hb+1.10,sp.bz), O=V3(sp.ax,sp.ha+1.6,sp.az);
const d0=T.clone().sub(O); const L0=d0.length(); d0.normalize();
const miss=V3(d0.x+0.008,d0.y,d0.z).normalize();
const a0=AIM_ASSIST.assisted;
aimAssistDir(O,miss,'hip',{team:0,ff:true});
const dayAssisted=AIM_ASSIST.assisted>a0;
return {heardDay,dayAssisted};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof rc==='string'){ exc('T3昼听枪/吸附',rc); } else {
ok(rc.heardDay===false,'T3 昼: 96m 枪声不入账 (65 原值)');
ok(rc.dayAssisted===true,'T3 昼: aim assist 130m 生效 (range 170)');
}
const ra=VM(boot({store:{sf_campaign:'4',sf_daynight:'night'}}),`(()=>{try{
nowT=100;
__AA.clearTroops(); __AA.clearVehicles();
const sp=__AA.openSpot(130); if(!sp) return 'NOPLACE';
const T=V3(sp.bx,sp.hb+1.10,sp.bz), O=V3(sp.ax,sp.ha+1.6,sp.az);
const d0=T.clone().sub(O); d0.normalize();
const miss=V3(d0.x+0.008,d0.y,d0.z).normalize();
SETTINGS.aim=1;
const a0=AIM_ASSIST.assisted;
aimAssistDir(O,miss,'hip',{team:0,ff:true});
return AIM_ASSIST.assisted>a0;
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof ra==='string'){ exc('T3夜吸附',ra); } else ok(ra===false,'T3 夜: aim assist 130m 不吸 (170×0.65=110.5, 只缩距离不破分档)');
}

// ═════ T4 N2 装备行为 ═════
function t4(){
console.log('T4 N2 装备: 大灯状态机/灯池、照明弹生命周期、探照灯、翼尖夜航灯');
const ctx=boot({store:{sf_campaign:'0',sf_daynight:'night'}});   // 诺曼底: 攻防(旗点照明弹)+阴天
if(!enter(ctx)) return;
const r=VM(ctx,`(()=>{try{
nowT=500;
const res={};
__AA.clearTroops(); __AA.clearVehicles();
// 大灯 AI 状态机 (clearVehicles 杀过全场, 取一辆复活当样车)
const t=tanks[0];
if(!t) return 'NOTANK';
t.alive=true; t.isAI=true; t.playerDriven=false; t.tTarget=null; t.tMemT=0;
t.pos.set(camera.position.x+10,camera.position.y,camera.position.z);   // 挪进真灯竞选半径 (<headRealR=75)
nightGearTick(1/60);
res.aiOn=t.lightsOn===true;
res.aiHlBuilt=!!(t._hl&&t._hl.grp);
t.tTarget={}; t.tMemT=1;      // 交战 → 关灯
nightGearTick(1/60);
res.aiOffEngaged=t.lightsOn===false;
t.tTarget=null; t.tMemT=0;
t.playerDriven=true; t.lightsOn=false;   // 玩家接管: AI 不再代管, L 自管
nightGearTick(1/60);
res.playerFree=vehHeadlightToggle(t)===true&&t.lightsOn===true;
nightGearTick(1/60);                     // toggle 后再 tick 一次, 真灯池按新状态竞选
// 真灯池: ≤headRealN*2 (2026-11-01 每台左右灯口各 1 盏), 全部 visible 且强度>0 的数量不超预算 (1 辆开灯车在场)
res.poolN=_hlPool.length===NIGHT_GEAR.headRealN*2;
res.poolVis=_hlPool.map(s=>!!s.visible);
res.poolUsedN=_hlPool.filter(s=>s.visible).length;
res.tLights=!!t.lightsOn;
res.tNear=t.pos.distanceTo(camera.position);
// 照明弹 (攻防图旗点): 生命周期
res.flareN=FLARES.length>0;
if(res.flareN){
const fl=FLARES[0];
// ★2026-11-05 判据跟走 (时停照明弹批): 照明弹相位钟换 _ngT (nightGearTick 战斗钟, 时停冻结),
//   nowT 不再是它的表盘 —— 拨相一律拨 _ngT (代码侧 fl.t0 也只与 _ngT 相减)。
fl.t0=_ngT-1;                // 拨到燃烧第 1s (p=(_ngT-t0)%period=1 < flareBurn)
nightGearTick(1/60);
res.flareLit=!!(fl.sp&&fl.sp.visible===true&&fl.lit>0&&fl.disc&&fl.disc.visible===true);
fl.t0=_ngT-(NIGHT_GEAR.flarePeriod+NIGHT_GEAR.flareBurn+1);   // 熄灭窗
nightGearTick(1/60);
res.flareDark=!!(fl.sp&&fl.sp.visible===false&&fl.lit===0);
}
// 探照灯: 登记→构建→照中 (摆位按当帧真实光柱方向 _searchDir, 不硬算 az)
SEARCHLIGHTS.length=0; _searchBeams.length=0;
SEARCHLIGHTS.push({x:player.pos.x+40,z:player.pos.z,y:player.pos.y+3,az0:0,phase:0});
nowT=701;
nightGearTick(1/60);
res.sBeam=_searchBeams.length===1;
_searchDir(SEARCHLIGHTS[0],_sDir);
player.pos.set(SEARCHLIGHTS[0].x+_sDir.x*30, SEARCHLIGHTS[0].y+_sDir.y*30-1.0, SEARCHLIGHTS[0].z+_sDir.z*30);
player.alive=true; player.spectator=false;
player._searchLitT=-99;
nightGearTick(1/60);          // 同一 nowT ⇒ 同一 az ⇒ 光柱扫过玩家
res.sHit=(player._searchLitT===701);
// 翼尖夜航灯 (仅夜档创建)
try{ const p=new Plane(0,0);
res.wingN=!!(p.wingNavL&&p.wingNavR);
p.grp.visible=false; }catch(e){ res.wingN='EXC:'+String(e&&e.message||e); }
return res;
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof r==='string'){ exc('T4',r); return; }
ok(r.aiOn===true,'T4 大灯 AI: 行进开灯');
ok(r.aiHlBuilt===true,'T4 大灯: 挂点组件随开灯惰性构建 (_hl.grp)');
ok(r.aiOffEngaged===true,'T4 大灯 AI: 交战关灯 (简单状态机)');
ok(r.playerFree===true,'T4 大灯: 玩家车不受 AI 代管, L 自管');
ok(r.poolN===true&&r.poolUsedN===2,'T4 真 SpotLight 池 ≤headRealN*2 且在用 (1 车=左右两盏, 池='+JSON.stringify(r.poolVis)+' 用='+r.poolUsedN+' tLights='+r.tLights+' 近='+r.tNear+')');
ok(r.flareN===true,'T4 照明弹: 攻防图旗点建弹 (相位走 Math.random 不进种子)');
ok(r.flareLit===true,'T4 照明弹: 燃烧窗=光点+地面亮斑可见 (lit>0)');
ok(r.flareDark===true,'T4 照明弹: 熄灭窗全部隐藏');
ok(r.sBeam===true,'T4 探照灯: 登记表 → 光柱惰性构建');
ok(r.sHit===true,'T4 探照灯: 光柱扫过玩家记 _searchLitT (Bot 侧 ×searchView+无视FOV 由 T3 消费)');
ok(r.wingN===true,'T4 飞机翼尖红/绿夜航灯 (仅夜档创建)');
}

// ═════ T6 车毁拆灯 (2026-10-05 bugfix: 开灯车被毁, 残骸上不得残留黑锥/发光点) ═════
function t6(){
console.log('T6 车毁拆灯: die/沉没链在焦黑化 traverse 前调 vehHeadlightKill (单源)');
const ctx=boot({store:{sf_campaign:'0',sf_daynight:'night'}});
if(!enter(ctx)) return;
const r=VM(ctx,`(()=>{try{
nowT=900;
const res={};
__AA.clearTroops(); __AA.clearVehicles();
const t=tanks[0];
if(!t) return 'NOTANK';
t.alive=true; t.isAI=true; t.playerDriven=false; t.crewBot=null; t.tTarget=null; t.tMemT=0;
t.pos.set(camera.position.x+10,camera.position.y,camera.position.z);
nightGearTick(1/60);
res.lit=t.lightsOn===true;
const hl=t._hl, coneMat=hl&&hl.cone.material;
res.built=!!(hl&&hl.grp&&hl.grp.parent===t.grp);
// 既有惯例 (verify-strongpoint 同款): 沙箱音频桩不建 ramp 曲线 ⇒ die 链里的爆炸音效置空, 只推演逻辑
if(typeof AudioSys!=='undefined') AudioSys.explosion=function(){};
t.die(null);                       // 真实死亡链 (attacker=null ⇒ 不走击杀播报分支)
res.killed=t._hl===null&&t.lightsOn===false;
res.detached=t.grp.children.indexOf(hl.grp)<0;  // 摘出 children ⇒ 黑化 traverse (走 children 链) 够不着光锥
res.coneUntouched=hl.cone.material===coneMat;   // 拆灯在前 ⇒ 焦黑化 traverse 够不着光锥
nightGearTick(1/60);
res.deadFiltered=!t.alive;
res.poolFree=_hlPool.every(s=>!s.visible);      // 死车退出竞选 ⇒ 真灯池清空
return res;
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof r==='string'){ exc('T6',r); return; }
ok(r.lit===true,'T6 前置: 样车行进开灯 (AI 状态机)');
ok(r.built===true,'T6 前置: _hl 灯组建在 veh.grp 下');
ok(r.killed===true,'T6 Tank.die: _hl 拆除 + lightsOn 复位');
ok(r.detached===true,'T6 Tank.die: 灯组从 grp 物理摘除 (黑化 traverse 够不着)');
ok(r.coneUntouched===true,'T6 Tank.die: 光锥材质未被 wreckMat 覆写 (无黑锥)');
ok(r.deadFiltered===true&&r.poolFree===true,'T6 死车退出灯池竞选 (真 SpotLight 不照残骸)');
const s15b=read('js/15b-trucks.js'), s15d=read('js/15d-naval.js'), s8t6=read('js/08-effects.js');
ok(s8t6.includes('function vehHeadlightKill'),'T6 08-effects: vehHeadlightKill 单源');
ok(s15b.includes('vehHeadlightKill(this)'),'T6 15b-trucks: Truck.die 接线');
ok(s15d.includes('vehHeadlightKill(this)'),'T6 15d-naval: beginDestroy 沉没链接线');
ok(s15d.includes('if(o.isMesh&&o.userData.mat0) o.material=o.userData.mat0'),'T6 15d-naval: 重生还原 mat0 (拆灯不进账, 两不相扰)');
}

// ═════ T5 静态接线 ═════
function t5(){
console.log('T5 静态接线: 消费点表逐条 (子串断言, 不写死行号)');
const html=read('index.html'), i18n=read('js/00b-i18n.js');
const s2=read('js/02-scene.js'), s8=read('js/08-effects.js'), s13=read('js/13-combat.js'),
s14=read('js/14-bots.js'), s15=read('js/15-vehicles.js'), s16=read('js/16-aircraft.js'),
s19=read('js/19-input.js'), s22=read('js/22-hud.js'), s22a=read('js/22a-menuart.js'),
s24=read('js/24-main.js'), s00=read('js/00-config.js'), s05a=read('js/05a-buildings.js'),
s05c=read('js/05c-layouts.js'), s01=read('js/01-audio.js'), s10=read('js/10-viewmodel.js');
ok(html.includes('class="optBtn dnBtn" data-dn="day"')&&html.includes('data-dn="night"'),'T5 index.html: 昼/夜按钮');
ok(html.includes('id="dnLock"'),'T5 index.html: 锁夜提示位');
ok(s22.includes("sf_daynight")&&s22.includes("dnBtn")&&s22.includes("CAMPAIGN.id==='ironbottom'"),'T5 22-hud: sf_daynight 存档 + ironbottom 置灰锁夜');
ok(s00.includes('const NIGHT_CFG={')&&s00.includes('const NIGHT_MODE=')&&s00.includes('function isNight()'),'T5 00-config: NIGHT_CFG/NIGHT_MODE/isNight 单源三件');
ok(s00.includes('const SEARCHLIGHTS=[]'),'T5 00-config: 探照灯登记表单源');
ok(s2.includes('NIGHT_MODE?NIGHT_CFG.exposure')||s2.includes('if(NIGHT_MODE) renderer.toneMappingExposure'),'T5 02-scene: exposure 夜档覆盖');
ok(s2.includes('NIGHT_CFG.fogFarMul')&&s2.includes('NIGHT_CFG.fogNearMul')&&s2.includes('nightFogColor'),'T5 02-scene: 雾距/雾起/雾色三接线');
ok(s2.includes('THEMES.nightsea.sky')&&s2.includes('if(!NIGHT_MODE){'),'T5 02-scene: 夜空基线 nightsea + 太阳光晕白天分支');
ok((s2.match(/NIGHT_CFG.vmLightMul/g)||[]).length>=2,'T5 02-scene: vmScene 两盏灯都乘 vmLightMul');
ok(s8.includes('_nSun')&&s8.includes('_nHemi'),'T5 08-effects: 天气×夜相乘 (顺序钉死)');
ok(s8.includes('NIGHT_MODE?26*NIGHT_CFG.flashRangeMul:26'),'T5 08-effects: 爆炸灯夜档距离');
ok(s10.includes('NIGHT_MODE?3*NIGHT_CFG.flashRangeMul:3'),'T5 10-viewmodel: 枪口灯夜档距离');
ok(s14.includes('NIGHT_CFG.viewDMul')&&s14.includes('NIGHT_CFG.hearGunMul'),'T5 14-bots: 索敌/听声夜档系数');
ok((s14.match(/NIGHT_CFG\.rangeMul/g)||[]).length>=3,'T5 14-bots: 三处独立交火半径 (botEngageR/EMPL_AA/huntR) 全登记');
ok(s14.includes('nightLitMul')&&s14.includes('_searchLitT'),'T5 14-bots: 照明弹补亮 + 探照灯照中消费');
ok(s13.includes('NIGHT_CFG.aimMul'),'T5 13-combat: aim assist 夜档只缩距离');
ok((s22.match(/mmEnemyVis\(/g)||[]).length>=9,'T5 22-hud: mmEnemyVis 单源 (定义+两图四块消费)');
ok(s22a.includes('nightsea:')&&s22a.includes('_maDim'),'T5 22a: MA_TINT 补 nightsea + 夜档压暗');
ok(s01.includes('NIGHT_MODE'),'T5 01-audio: 鸟鸣夜档静音');
ok(s16.includes('if(NIGHT_MODE){')&&s16.includes('wingNavL'),'T5 16-aircraft: 翼尖夜航灯仅夜档创建');
ok(s15.includes('NIGHT_GEAR.headExpo'),'T5 15-vehicles: 开灯敌车暴露判据 (tankPerceive)');
ok(s19.includes("KeyL")&&s19.includes('vehHeadlightToggle')&&s19.includes('NIGHT_MODE'),'T5 19-input: L 键大灯 (夜档门控)');
ok(s24.includes("nightGearTick(dt)")&&s24.includes('NIGHT_MODE&&typeof nightGearTick'),'T5 24-main: 装备总入口 (夜档门控)');
ok(s05a.includes('SEARCHLIGHTS.push')&&s05c.includes('SEARCHLIGHTS.push'),'T5 05a/05c: 静态探照灯位登记');
ok(i18n.includes("'昼夜'")&&i18n.includes("'黑夜'")&&i18n.includes('大灯开启'),'T5 词典: 昼夜钮/大灯提示');
{ // 载入清单对账: FILES 与 index.html 实载 js 脚本逐条同序一致 (动态解析, 不写死数字)
const htmlScripts=(html.match(/<script src="js\/[^"?]*\?v=[^"]*"/g)||[])
.map(s=>s.replace(/<script src="/,'').replace(/"$/,'').split('?')[0]);
const match=htmlScripts.length===FILES.length&&htmlScripts.every((f,i)=>f===FILES[i]);
ok(match,'T5 载入清单 = index.html 实载脚本逐条同序 ('+FILES.length+' 个, 动态对账)');
}
}

console.log('═══ verify-daynight 昼夜模式批沙箱 ═══');
t1(); t2(); t3(); t4(); t6(); t5();
console.log('═══ 结果: '+PASS+' 过 / '+FAILS+' 挂 ═══');
process.exit(FAILS?1:0);
