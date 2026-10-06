// ─────────────────────────────────────────────
// dev/verify-weather.js —— 天气系统批沙箱 (2026-10-05, 不进 index.html)
// 用法: node dev/verify-weather.js
// 原理: 复用 dev/_bootstub.js 桩, 以不同 sf_weather/sf_campaign/sf_daynight 存档各 boot 一遍全部真实脚本,
//       断言《天气系统设计纲要.md》§9 的验收判据 (解析表/零回归指纹/衰减/索敌/闪电R4/小地图/火势/纪律)。
// 断言 (T1~T7):
//   T1 解析表 (§9.1): 14 图 × 跟随地图 → WEATHER_EFF=身份档 (雪图→snowMid); 四档映射在雪族
//      (斯大林格勒+莫斯科) 与常规族 (诺曼底/淞沪/缅甸/百团) 逐档断言 —— 解析分支只依赖
//      (身份值, 雪族布尔) 两个输入, 两族覆盖即全表覆盖;
//   T2 零回归指纹 (§9.2/R1/R2): 全图 跟随地图+白天 fogFar/fogNear/太阳/半球/粒子 = 硬编码期望
//      (晴/阴/中雪=校准值逐位; 雨族=R1 明示例外的 §4.1 终版: far 0.4/0.25/0.23, near 0.5/0.35);
//      晴朗档三图 (=clear 基线全系数 1 无粒子); 斯大林格勒'小雨'→snowMid 与跟随地图逐位同值 (R1 样本);
//      ironbottom 只断解析+小地图 (夜锁图视觉归 verify-daynight);
//   T3 衰减 (§9.3/R5): kar98/stg44 衰减系数 晴朗 vs 暴雨对照 (公式复刻自 09a-defs 规格注释,
//      参数从沙箱 WPN_DEFS 读); fallS 内伤害不变 (×1); WX_CFG.fallEMul 逐档;
//   T4 索敌/听枪/吸附 (§9.4): 暴雨昼 45m 见/60m 不见 (95×0.55); 夜+暴雨 20m 见/40m 不见
//      (95×0.55×0.55); 夜+暴雨 照明弹 36m 补亮可见 (乘子叠加次序不变); 听枪 夜+暴雨 60m 闻/72m 不闻
//      (105×0.65, 目标不可见 ⇒ 纯听觉路径); 吸附 130m 晴吸/暴雨不吸 (170×0.65=110.5) + 100m 暴雨仍吸
//      (吸附/照明弹三例放百团净空地形 —— 诺曼底树篱的植被软遮蔽/静态遮挡是地形干扰, 非天气变量);
//   T5 闪电红线 (§9.5/R4): 暴风雪 (斯大林格勒'暴雨') lightningT 不减/stormFlash 恒 0;
//      细雪/中雪 WX_CFG.lightning=false 且不触发; 缅甸 (暴雨身份) 闪电链照常 (stormFlash>0);
//   T6 小地图合成 (§9.6): 诺曼底'暴雨' 昼 90/2.5 (80 常显/95 隐/开火显形/过期隐), 夜 60/2.5 + 观战旁路;
//      百团晴朗全显 (WX_MM_NEAR=0); ironbottom 夜规 60/2.5 原样 (阴不叠加雨规);
//   T7 静态接线 + R7 全库审计 (§9.7): 消费点子串逐条 (含 15-vehicles 车长视距, verify-daynight 表之外的
//      天气新消费点); 全库 js (去行注释) 无 WEATHER===/!== 字符串比较; WEATHER_CFG 七档齐全;
//      火势: FIRE_SPREAD===0.8×fireMul 逐档 (浮点容差) + 行为学双格引燃 (晴朗 ~1.9s / 小雨 ~5s /
//      暴雨 8s 不引燃, 积热追不上冷却) + 三常数未动 (阈值/冷却/燃料) 子串断言 (追加裁定);
//      载入清单 = index.html 实载脚本逐条同序 (动态对账, 不写死数量)。
// 探针坑实录: ①仓库 CRLF —— 行尾残留 \r 而 JS 正则 . 不匹配 \r、$ 不认 \r ⇒ /\/\/.*$/ 剥注释整条失配
//   (R7 审计假阳性; 用 [\s\S] 贪婪到行尾); ②stormFlash 置 1 后同帧即衰减 (1-dt*3.2) ⇒ 断言 f>0.9 非 ===1;
//   ③FIRE_SPREAD=0.8×0.35 浮点 ≠ 字面 0.28 ⇒ 乘积断言用容差; ④粒子 count 从 position.array.length/3 取
//   (stub 无 count 语义); ⑤吸附/照明弹行为学对地形敏感 (植被软遮蔽/静态遮挡), 放百团净空档。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const {sandbox,document,window,byId}=require('./_bootstub.js');
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
//    实载脚本数在 T7 里从 index.html 动态解析对账, 不写死数字) ──
const FILES=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/15g-capmodels.js','js/15h-capital.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/19b-gamepad.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/22a-menuart.js','js/22b-speclayer.js','js/23-deploy.js','js/23b-worldrestore.js','js/24-main.js'];
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
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
const store=Object.assign({sf_campaign:'4'},o.store||{});   // 缺省百团 (晴) = 天气干净档
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

// ── 期望值 (硬编码 = 设计规格; 不从被测代码推导) ──
// 格式 [eff, fogFar, fogNear, sun, hemi, precipN] —— §3 解析表 + §4.1 终版 (R1 明示例外含 0.4/0.25/0.23;
// sun/hemi 2026-10-05 口追⑧ 重调: 全非晴档压暗, 阴/暴 hemiMul 1.15→0.9/0.72 等)
const WX_SPEC={
normandy:['overcast',1,1,0.5,0.9,0],
stalingrad:['snowMid',0.85,1,0.85,0.9,620],
berlin:['overcast',1,1,0.5,0.9,0],
songhu:['rain',0.4,0.5,0.55,0.85,460],
baituan:['clear',1,1,1,1,0],
burma:['storm',0.25,0.35,0.42,0.72,2800],
moscow:['snowMid',0.85,1,0.85,0.9,620],
hukawng:['rain',0.4,0.5,0.55,0.85,460],
steppe:['clear',1,1,1,1,0],
woodline:['overcast',1,1,0.5,0.9,0],
canyon:['overcast',1,1,0.5,0.9,0],
island:['clear',1,1,1,1,0],
coral:['clear',1,1,1,1,0],
ironbottom:['overcast',1,1,0.5,0.9,0],
};
const CLEAR_SPEC=['clear',1,1,1,1,0];
// 四档映射覆盖集: [图索引, sf_weather, eff 期望] —— 雪族 2 图 × 全四档 + 常规族 4 图抽样
const TIER_COVER=[[0,'clear','clear'],[0,'overcast','overcast'],[0,'rain','rain'],[0,'storm','storm'],
[1,'clear','clear'],[1,'overcast','snowLight'],[1,'rain','snowMid'],[1,'storm','snowBlizzard'],
[6,'storm','snowBlizzard'],[3,'overcast','overcast'],[5,'clear','clear']];
const WM_SNAP=`(()=>{try{
const q=SETTINGS.quality;
return {
id:CAMPAIGN.id, eff:WEATHER_EFF, snow:WX_SNOW_MAP, ref:WX_CFG===WEATHER_CFG[WEATHER_EFF],
fogMul:WX_CFG.fogFarMul, fogNearMul:WX_CFG.fogNearMul, fogFar:scene.fog.far, fogNear:dryFogNear(),
q, fmul:THEME.fogMul||1, size:CAMPAIGN.mapSize||320,
sunI:sun.intensity, tSunI:THEME.sunI, hemiI:hemi.intensity, tHemiI:THEME.hemi[2],
ptype:precipObj?(precipObj.isLine?'rain':'snow'):null,   // stub: LineSegments.isLine (非 isLineSegments)
plen:precipObj?precipObj.geometry.attributes.position.array.length:0,
fallE:WX_CFG.fallEMul, fireMul:WX_CFG.fireMul, mmN:WX_MM_NEAR, mmF:WX_MM_FIRE,
lightning:WX_CFG.lightning,
};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`;
function checkSnap(r,spec,tag){
if(typeof r==='string'){ exc(tag,r); return false; }
ok(r.ref,tag+' WX_CFG 单源指针 (===WEATHER_CFG[WEATHER_EFF])');
ok(r.eff===spec[0],tag+' WEATHER_EFF='+spec[0]+' (得 '+r.eff+')');
ok(r.fogMul===spec[1]&&r.fogNearMul===spec[2],tag+' fogFarMul/fogNearMul = '+spec[1]+'/'+spec[2]);
const base=(r.q===0?240:(r.q===1?340:420));
ok(r.fogFar===((base*spec[1])*r.fmul)*((r.size>=640)?1.35:1),tag+' fogFar 复刻逐位 ('+r.fogFar+')');
ok(r.fogNear===40*spec[2],tag+' fogNear 复刻逐位 ('+r.fogNear+'m)');
ok(r.sunI===r.tSunI*spec[3],tag+' sun = THEME.sunI×'+spec[3]);
ok(r.hemiI===r.tHemiI*spec[4],tag+' hemi = THEME.hemi[2]×'+spec[4]);
if(spec[5]===0) ok(r.ptype===null&&r.plen===0,tag+' 无降水粒子');
else if(spec[5]&&spec[0].indexOf('snow')===0) ok(r.ptype==='snow'&&r.plen/3===spec[5],tag+' 雪粒子 '+spec[5]);
else ok(r.ptype==='rain'&&r.plen/3===spec[5]*2,tag+' 雨粒子 '+spec[5]+' 段 ('+(spec[5]*2)+' 顶点)');
return true;
}

// ═════ T1+T2 解析表 + 零回归指纹 ═════
function t1t2(){
console.log('T1/T2 解析表 + 零回归指纹: 全图 跟随地图+白天 (硬编码期望)');
const ids=VM(boot({}),'CAMPAIGNS.map(c=>c.id).join(",")').split(',');
ok(ids.length===Object.keys(WX_SPEC).length,'T1 图数与规格表条数一致 ('+ids.length+') —— 新增战役须补 WX_SPEC');
let ctxIron=null,ctxStalMap=null;
for(let i=0;i<ids.length;i++){
const spec=WX_SPEC[ids[i]];
if(!spec){ ok(false,'T1 图 '+ids[i]+' 无规格条目 (补 WX_SPEC)'); continue; }
const ctx=boot({store:{sf_campaign:String(i)}});
const r=VM(ctx,WM_SNAP);
const tag='T1['+i+']'+ids[i];
if(ids[i]==='ironbottom'){
// 夜锁图: 只断解析 + 雪族 + 小地图合成 (白天指纹对夜锁图无意义, 视觉校准归 verify-daynight)
if(typeof r==='string'){ exc(tag,r); }
else{
ok(r.ref&&r.eff==='overcast'&&r.snow===false,tag+' 解析=overcast + 单源指针');
ok(r.mmN===60&&r.mmF===2.5,tag+' 小地图 = 夜规 60/2.5 (overcast 无雨规不叠加)');
}
ctxIron=ctx; continue;
}
if(checkSnap(r,spec,tag)){
ok(r.snow===(ids[i]==='stalingrad'||ids[i]==='moscow'),tag+' 雪族判据 WX_SNOW_MAP');
}
if(ids[i]==='stalingrad') ctxStalMap=ctx;
}
console.log('T2 晴朗档 (R2 =clear 基线) + 雪图映射样本');
for(const [idx,wid] of [[3,'clear'],[5,'clear'],[1,'clear']]){
const ctx=boot({store:{sf_campaign:String(idx),sf_weather:wid}});
const r=VM(ctx,WM_SNAP);
checkSnap(r,CLEAR_SPEC,'T2['+ids[idx]+']'+wid)
&&ok(r.eff==='clear','T2['+ids[idx]+']'+wid+' 生效档=clear (雪图=雪停: 地面雪归 THEME 不在此层)');
}
// R1 样本: 斯大林格勒 '小雨'→snowMid, 与跟随地图逐位同值
{
const r=VM(boot({store:{sf_campaign:'1',sf_weather:'rain'}}),WM_SNAP);
const rm=typeof ctxStalMap!=='undefined'&&ctxStalMap?VM(ctxStalMap,WM_SNAP):null;
if(typeof r==='string'||!rm||typeof rm==='string'){ exc('T2 R1样本',r||(rm||'ctx 缺')); }
else{
ok(r.eff==='snowMid','T2 ★ R1 样本: 斯大林格勒 小雨 → snowMid');
ok(r.fogFar===rm.fogFar&&r.fogNear===rm.fogNear&&r.sunI===rm.sunI&&r.hemiI===rm.hemiI&&r.plen===rm.plen,
'T2 ★ R1 样本: 视觉与跟随地图(原 snow 校准值)逐位同值');
}
}
// 细雪样本: 斯大林格勒 '多云'→snowLight (新调档)
{
const r=VM(boot({store:{sf_campaign:'1',sf_weather:'overcast'}}),WM_SNAP);
checkSnap(r,['snowLight',0.9,0.8,0.55,0.95,370],'T2 斯大林格勒 多云→细雪')
&&ok(r.lightning===false,'T2 细雪档无闪电旗标');
}
// 暴风雪样本: 斯大林格勒 '暴雨'→snowBlizzard (R4 + 终版雾)
{
const r=VM(boot({store:{sf_campaign:'1',sf_weather:'storm'}}),WM_SNAP);
checkSnap(r,['snowBlizzard',0.23,0.35,0.45,0.8,3600],'T2 斯大林格勒 暴雨→暴风雪')
&&ok(r.lightning===false,'T2 暴风雪无闪电旗标 (R4)');
}
}

// ═════ T3 衰减 (R5) ═════
function t3(){
console.log('T3 衰减: fallEMul 晴朗 vs 暴雨 (公式复刻, 参数读武器表)');
const snap=`(({kfb:WPN_DEFS.kar98.fallS,ke:WPN_DEFS.kar98.fallE,kf:WPN_DEFS.kar98.fallF,
sfb:WPN_DEFS.stg44.fallS,se:WPN_DEFS.stg44.fallE,sf:WPN_DEFS.stg44.fallF,mul:WX_CFG.fallEMul}))`;
const rc=VM(boot({store:{sf_campaign:'0',sf_weather:'clear'}}),snap);
const rs=VM(boot({store:{sf_campaign:'0',sf_weather:'storm'}}),snap);
if(typeof rc==='string'||typeof rs==='string'){ exc('T3',rc||rs); return; }
const fall=(t,fb,fe,ff,mul)=>{ const e=fe*mul; return 1+(ff-1)*Math.min(1,Math.max(0,(t-fb)/Math.max(1,e-fb))); };
ok(rc.mul===1,'T3 晴朗 fallEMul=1 (逐位不改衰减)');
ok(rs.mul===0.6,'T3 暴雨 fallEMul=0.6');
ok(rc.kfb===70&&rc.ke===260&&Math.abs(rc.kf-0.8)<1e-12,'T3 kar98 70/260/0.8 (规格注释一致)');
ok(rc.sfb===38&&rc.se===180&&Math.abs(rc.sf-0.5)<1e-12,'T3 stg44 38/180/0.5');
ok(fall(rc.kfb-5,rc.kfb,rc.ke,rc.kf,rc.mul)===1&&fall(rs.kfb-5,rs.kfb,rs.ke,rs.kf,rs.mul)===1,'T3 fallS 内伤害不变 (两档 ×1)');
const k150c=fall(150,rc.kfb,rc.ke,rc.kf,rc.mul), k150s=fall(150,rs.kfb,rs.ke,rs.kf,rs.mul);
const s120c=fall(120,rc.sfb,rc.se,rc.sf,rc.mul), s120s=fall(120,rs.sfb,rs.se,rs.sf,rs.mul);
ok(Math.abs(k150c-(1+(rc.kf-1)*((150-70)/190)))<1e-12,'T3 kar98@150m 晴朗系数 = 规格曲线 ('+k150c.toFixed(4)+')');
ok(Math.abs(k150s-(1+(rs.kf-1)*((150-70)/86)))<1e-12,'T3 kar98@150m 暴雨系数 = 收距曲线 ('+k150s.toFixed(4)+', fe 260→156)');
ok(Math.abs(s120c-(1+(rc.sf-1)*((120-38)/142)))<1e-12,'T3 stg44@120m 晴朗系数 ('+s120c.toFixed(4)+')');
ok(Math.abs(s120s-0.5)<1e-12,'T3 stg44@120m 暴雨系数 = 地板 0.5 ('+s120s.toFixed(4)+', fe 180→108, 120m 已越收距点)');
ok(k150s<k150c&&s120s<s120c,'T3 暴雨同距伤害 ≤ 晴朗 (衰减更狠)');
}

// ═════ T4 索敌/听枪/吸附 (§9.4) ═════
function t4(){
console.log('T4 感知: 暴雨昼/夜 索敌·照明弹次序·听枪·吸附');
// 昼+暴雨 (诺曼底): viewD=95×0.55=52.25 —— 索敌两例放诺曼底 (纯距离判定, 无地形干扰)
const rd=VM(boot({store:{sf_campaign:'0',sf_weather:'storm'}}),`(()=>{try{
nowT=100; __AA.clearTroops(); __AA.clearVehicles();
const res={};
{
let seen45=false;
for(let t2=0;t2<3&&!seen45;t2++){   // 随机落点偶发撞植被软遮蔽 (~1/20 布局指纹口径): 三点取一成
const sp=__AA.openSpot(45); if(!sp) continue;
const A=__AA.mkBot(0,sp.ax,sp.az,'哨'); A.yaw=Math.PI;
const B=__AA.mkBot(1,sp.bx,sp.bz,'靶');
A.perceive(); seen45=A.target===B;
__AA.clearTroops(); __AA.clearVehicles();
}
res.seen45=seen45;
}
__AA.clearTroops(); __AA.clearVehicles();
{
const sp=__AA.openSpot(60); if(!sp) return 'NOPLACE2';
const A=__AA.mkBot(0,sp.ax,sp.az,'哨2'); A.yaw=Math.PI;
const B=__AA.mkBot(1,sp.bx,sp.bz,'靶2');
A.perceive(); res.seen60=A.target===B;
}
return res;
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof rd==='string'){ exc('T4昼暴雨',rd); }
else{
ok(rd.seen45===true,'T4 昼+暴雨: 45m 索敌可见 (52.25 内)');
ok(rd.seen60===false,'T4 昼+暴雨: 60m 不可见 (95×0.55)');
}
// 吸附三例放百团净空地形 (诺曼底树篱的静态遮挡/植被软遮蔽是地形干扰, 非天气变量):
// 晴朗 130m 吸 (170>130) / 暴雨 130m 不吸 (110.5<130) / 暴雨 100m 吸 (110.5>100)
const aimSnap=(spLen)=>`(()=>{try{
nowT=100; __AA.clearTroops(); __AA.clearVehicles();
const sp=__AA.openSpot(${spLen}); if(!sp) return 'NOPLACE';
const A=__AA.mkBot(0,sp.ax,sp.az,'哨'); A.yaw=Math.PI;
const B=__AA.mkBot(1,sp.bx,sp.bz,'靶');   // 候选靶 (探针坑⑥: 清场后必须补靶, 空表=吸附空转假阴性)
SETTINGS.aim=1;
const T=V3(sp.bx,sp.hb+1.10,sp.bz), O=V3(sp.ax,sp.ha+1.6,sp.az);
const d0=T.clone().sub(O); d0.normalize();
// 近失方向 = 绕 Y 轴定角旋转 0.008rad (旧 +0.008 平移法偏角随 d0 朝向漂移 ⇒ 随机翻车)
const _c=Math.cos(0.008), _s=Math.sin(0.008);
const miss=V3(d0.x*_c-d0.z*_s, d0.y, d0.x*_s+d0.z*_c).normalize();
const a0=AIM_ASSIST.assisted;
aimAssistDir(O,miss,'hip',{team:0,ff:true});
return AIM_ASSIST.assisted>a0;
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`;
const aClear=VM(boot({store:{sf_campaign:'4',sf_weather:'clear'}}),aimSnap(130));
const aStorm130=VM(boot({store:{sf_campaign:'4',sf_weather:'storm'}}),aimSnap(130));
const aStorm100=VM(boot({store:{sf_campaign:'4',sf_weather:'storm'}}),aimSnap(100));
if(typeof aClear==='string') exc('T4晴吸附',aClear); else ok(aClear===true,'T4 晴朗昼: 130m 吸附生效 (基线 170)');
if(typeof aStorm130==='string') exc('T4暴雨吸附130',aStorm130); else ok(aStorm130===false,'T4 昼+暴雨: 130m 吸附不生效 (170×0.65=110.5)');
if(typeof aStorm100==='string') exc('T4暴雨吸附100',aStorm100); else ok(aStorm100===true,'T4 昼+暴雨: 100m 吸附仍生效 (只缩距离不破分档)');
// 夜+暴雨 (百团): viewD=95×0.55×0.55=28.74; 照明弹补亮次序; 听枪 105×0.65=68.25
const rn=VM(boot({store:{sf_campaign:'4',sf_weather:'storm',sf_daynight:'night'}}),`(()=>{try{
nowT=100; __AA.clearTroops(); __AA.clearVehicles();
const res={};
{
const sp=__AA.openSpot(20); if(!sp) return 'NOPLACE';
const A=__AA.mkBot(0,sp.ax,sp.az,'哨'); A.yaw=Math.PI;
const B=__AA.mkBot(1,sp.bx,sp.bz,'靶');
A.perceive(); res.seen20=A.target===B;
}
__AA.clearTroops(); __AA.clearVehicles();
{
const sp=__AA.openSpot(40); if(!sp) return 'NOPLACE2';
const A=__AA.mkBot(0,sp.ax,sp.az,'哨2'); A.yaw=Math.PI;
const B=__AA.mkBot(1,sp.bx,sp.bz,'靶2');
A.perceive(); res.seen40=A.target===B;
}
__AA.clearTroops(); __AA.clearVehicles();
// 照明弹补亮: 36m 夜+暴雨不可见 (28.74) → 弹下可见 (28.74×1.4=40.24) —— 乘子叠加次序不变 (R6)
{
const sp=__AA.openSpot(36); if(!sp) return 'NOPLACE3';
const A=__AA.mkBot(0,sp.ax,sp.az,'哨3'); A.yaw=Math.PI;
const B=__AA.mkBot(1,sp.bx,sp.bz,'靶3');
A.perceive(); res.flare0=A.target===B;
FLARES.push({x:B.pos.x,z:B.pos.z,gy:B.pos.y,y:50,lit:1,sp:null,disc:null});
A.target=null; A.lastSeenT=-99; A.perceive();
res.flare1=A.target===B;
res.lit=nightLitMul(B.pos.x,B.pos.y,B.pos.z);
FLARES.length=0;
}
__AA.clearTroops(); __AA.clearVehicles();
// 听枪 (gunEvents 路径 65×1.5×0.65=63.375): 目标不可见 ⇒ 纯听觉: 60m 闻 / 72m 不闻
{
const sp=__AA.openSpot(60); if(!sp) return 'NOPLACE4';
const A=__AA.mkBot(0,sp.ax,sp.az,'哨4'); A.yaw=Math.PI;
const B=__AA.mkBot(1,sp.bx,sp.bz,'靶4');
gunEvents.push({x:B.pos.x,z:B.pos.z,t:nowT,team:1,shooter:B});
A.perceive();
res.heard60=A.target===null&&Math.abs(A.lastSeenPos.x-B.pos.x)<1&&Math.abs(A.lastSeenPos.z-B.pos.z)<1;
}
__AA.clearTroops(); __AA.clearVehicles();
{
const sp=__AA.openSpot(72); if(!sp) return 'NOPLACE5';
const A=__AA.mkBot(0,sp.ax,sp.az,'哨5'); A.yaw=Math.PI;
const B=__AA.mkBot(1,sp.bx,sp.bz,'靶5');
A.lastSeenPos.set(999,0,999);
gunEvents.push({x:B.pos.x,z:B.pos.z,t:nowT,team:1,shooter:B});
A.perceive();
res.heard72=Math.abs(A.lastSeenPos.x-B.pos.x)<1&&Math.abs(A.lastSeenPos.z-B.pos.z)<1;
}
return res;
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof rn==='string'){ exc('T4夜暴雨',rn); }
else{
ok(rn.seen20===true,'T4 夜+暴雨: 20m 可见 (28.74 内)');
ok(rn.seen40===false,'T4 夜+暴雨: 40m 不可见 (95×0.55×0.55)');
ok(rn.flare0===false&&rn.flare1===true&&rn.lit===1.4,'T4 夜+暴雨: 照明弹 36m 补亮可见 (×flareLitView, 乘子次序不变 R6)');
ok(rn.heard60===true,'T4 夜+暴雨: 60m 枪声入账 (63.4 内, 人不可见)');
ok(rn.heard72===false,'T4 夜+暴雨: 72m 枪声不入账');
}
}

// ═════ T5 闪电红线 (R4) ═════
function t5(){
console.log('T5 闪电红线: 暴风雪/细雪/中雪 不触发, 缅甸(暴雨) 照常');
const bliz=VM(boot({store:{sf_campaign:'1',sf_weather:'storm'}}),`(()=>{try{
nowT=100; lightningT=0.01; stormFlash=0;
updateWeather(0.05);
const t1=lightningT, f1=stormFlash;
updateWeather(25);
return {eff:WEATHER_EFF, lg:WX_CFG.lightning, t1, f1, t2:lightningT, f2:stormFlash};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof bliz==='string'){ exc('T5暴风雪',bliz); }
else{
ok(bliz.eff==='snowBlizzard'&&bliz.lg===false,'T5 暴风雪: WX_CFG.lightning=false');
ok(bliz.t1===0.01&&bliz.t2===0.01&&bliz.f1===0&&bliz.f2===0,'T5 暴风雪: lightningT 不减 / stormFlash 恒 0 (R4)');
}
for(const [wx,eff] of [['overcast','snowLight'],['rain','snowMid']]){
const r=VM(boot({store:{sf_campaign:'1',sf_weather:wx}}),`(()=>{try{
nowT=100; lightningT=0.01; stormFlash=0;
updateWeather(0.5);
return {eff:WEATHER_EFF, lg:WX_CFG.lightning, t:lightningT, f:stormFlash};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof r==='string'){ exc('T5 '+wx,r); continue; }
ok(r.eff===eff&&r.lg===false&&r.t===0.01&&r.f===0,'T5 '+eff+': 无闪电链 (t 不减/flash 0)');
}
// 缅甸 (暴雨身份): 闪电链照常 —— stormFlash 置 1 后**同帧**即衰减 1-dt*3.2 ⇒ 断言 f>0.9 (探针坑②)
const st=VM(boot({store:{sf_campaign:'5'}}),`(()=>{try{
nowT=100; lightningT=0.01; stormFlash=0;
updateWeather(0.05);
return {eff:WEATHER_EFF, lg:WX_CFG.lightning, f:stormFlash, tReset:lightningT};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof st==='string'){ exc('T5缅甸',st); }
else ok(st.eff==='storm'&&st.lg===true&&st.f>0.8&&st.f<1&&st.tReset>=7,'T5 缅甸(暴雨): 闪电链照常 (flash='+st.f.toFixed(2)+' 同帧已衰减, cd 重置 ≥7)');
}

// ═════ T6 小地图合成 (§9.6) ═════
function t6(){
console.log('T6 小地图合成: nearR 取较小 / fireT 取较长');
const rd=VM(boot({store:{sf_campaign:'0',sf_weather:'storm'}}),`(()=>{try{
nowT=100;
player.spectator=false; player.alive=true; player.pos.set(0,0,0);
const res={n:WX_MM_NEAR,f:WX_MM_FIRE,v80:mmEnemyVis(80,0),v95:mmEnemyVis(95,0),
vFire:mmEnemyVis(95,0,nowT-1),vOld:mmEnemyVis(95,0,nowT-9)};
player.spectator=true; res.vSpec=mmEnemyVis(900,0); player.spectator=false;
return res;
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof rd==='string'){ exc('T6昼',rd); }
else{
ok(rd.n===90&&rd.f===2.5,'T6 昼+暴雨: 合成 90/2.5');
ok(rd.v80===true&&rd.v95===false&&rd.vFire===true&&rd.vOld===false,'T6 昼+暴雨: 80 常显 / 95 隐 / 开火显形 / 过期隐');
ok(rd.vSpec===true,'T6 观战旁路=全显');
}
const rn=VM(boot({store:{sf_campaign:'0',sf_weather:'storm',sf_daynight:'night'}}),`(()=>{try{
nowT=100;
player.spectator=false; player.alive=true; player.pos.set(0,0,0);
const res={n:WX_MM_NEAR,f:WX_MM_FIRE,v40:mmEnemyVis(40,0),v90:mmEnemyVis(90,0),vFire:mmEnemyVis(90,0,nowT-1)};
return res;
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof rn==='string'){ exc('T6夜',rn); }
else ok(rn.n===60&&rn.f===2.5&&rn.v40===true&&rn.v90===false&&rn.vFire===true,
'T6 夜+暴雨: 合成 60/2.5 (夜规全盖: nearR 取较小 60, fireT 取较长 2.5)');
}

// ═════ T7 静态接线 + R7 审计 + 火势 + 纪律 ═════
function t7(){
console.log('T7 静态接线 / R7 全库审计 / 火势 (追加裁定) / 载入清单');
const s00=read('js/00-config.js'), s02=read('js/02-scene.js'), s04=read('js/04b-fire.js'),
s08=read('js/08-effects.js'), s01=read('js/01-audio.js'), s13=read('js/13-combat.js'),
s14=read('js/14-bots.js'), s15=read('js/15-vehicles.js'), s22=read('js/22-hud.js'),
html=read('index.html'), i18n=read('js/00b-i18n.js');
ok(s00.includes('const WX_IDENTITY=')&&s00.includes('const WEATHER_EFF=')&&s00.includes('const WEATHER_CFG=')&&s00.includes('const WX_CFG=WEATHER_CFG[WEATHER_EFF]'),'T7 00-config: 身份表/解析/七档表/WX_CFG 单源四件');
ok(s00.includes('const WX_MM_NEAR=')&&s00.includes('const WX_MM_FIRE='),'T7 00-config: 小地图合成单源');
ok((s00.match(/fireMul:\d/g)||[]).length===7,'T7 00-config: fireMul 七档齐全');
ok((s00.match(/fogNearMul:\d/g)||[]).length===7,'T7 00-config: fogNearMul 七档齐全 (渐变口径)');
ok(s02.includes('*WX_CFG.fogFarMul*')&&s02.includes('40*WX_CFG.fogNearMul*'),'T7 02-scene: 雾距/雾起双接线');
ok(s08.includes("WX_CFG.precip==='rain'")&&s08.includes("WX_CFG.precip==='snow'")&&s08.includes('WX_CFG.precipN')&&s08.includes('WX_CFG.precipFall'),'T7 08-effects: 粒子种类/粒数/落速收编');
ok(s08.includes('*WX_CFG.sunMul')&&s08.includes('*WX_CFG.hemiMul'),'T7 08-effects: 天光折扣收编');
ok(s08.includes('if(WX_CFG.lightning===true){'),'T7 08-effects: 闪电门 = WX_CFG.lightning===true (R4 落点)');
ok(s01.includes('WX_CFG.audioLevel>0')&&s01.includes('WX_CFG.wind'),'T7 01-audio: 雨声/风声分支收编');
ok(s13.includes('(def.fallE||220)*WX_CFG.fallEMul'),'T7 13-combat: 衰减 fallE 收距单点');
ok(s13.indexOf('WX_CFG.fallEMul')<s13.indexOf('dmg>HEAD_CAP'),'T7 13-combat: HEAD_CAP 仍在衰减之后 (R5)');
ok(s13.includes('*WX_CFG.aimMul'),'T7 13-combat: 辅瞄距离乘子');
ok((s14.match(/WX_CFG\.viewDMul/g)||[]).length===1&&(s14.match(/WX_CFG\.hearGunMul/g)||[]).length===2&&(s14.match(/WX_CFG\.rangeMul/g)||[]).length===3,'T7 14-bots: 索敌×1/听枪×2/交火半径×3 消费点计数');
ok(s15.includes('WX_CFG.viewDMul'),'T7 15-vehicles: 车长视距乘子 (登记项)');
ok(s22.includes('WX_MM_NEAR<=0')&&s22.includes('WX_MM_FIRE')&&s22.includes("localStorage.getItem('sf_weather')"),'T7 22-hud: mmEnemyVis 合成消费 + sf_weather 接线');
ok((html.match(/class="optBtn wxBtn"/g)||[]).length===5&&html.includes('id="wxHint"'),'T7 index.html: 五天气按钮 + 提示位');
ok(i18n.includes("'跟随地图':'Map Default'")&&i18n.includes("'晴朗':'Clear'")&&i18n.includes("'雪停':'Snow Ends'")&&i18n.includes("'暴风雪':'Blizzard'")&&i18n.includes("'本图={0}':'Map: {0}'"),'T7 词典: 天气五钮+雪图变体+提示 (双语)');
// R7: 全库 js (去行注释) 禁 WEATHER===/!== 字符串比较
// 探针坑①: 仓库 CRLF —— 行尾残留 \r, JS 正则 . 不匹配 \r 且 $ 不认 \r ⇒ /\/\/.*$/ 整条失配,
//   注释里的反例字符串逃过剥离 ⇒ 假阳性。用 [\s\S] 贪婪到行字符串末尾 (吞掉 \r)。
{
const dir=path.join(root,'js');
let bad=0, files=0;
for(const f of fs.readdirSync(dir)){
if(!f.endsWith('.js')) continue;
files++;
const src=fs.readFileSync(path.join(dir,f),'utf8');
const code=src.split('\n').map(l=>l.replace(/\/\/[\s\S]*$/,'')).join('\n');
if(/WEATHER\s*(===|!==)/.test(code)){ bad++; console.log('      违规: '+f); }
}
ok(bad===0,'T7 ★ R7 全库审计: '+files+' 个 js 文件零 WEATHER===/!== 字符串比较 (单源收编完成)');
}
// 火势: 常量/单点/三常数未动
ok(s04.includes('const FIRE_SPREAD_NERF=0.8;')&&s04.includes('const FIRE_SPREAD=FIRE_SPREAD_NERF*WX_CFG.fireMul;'),'T7 04b-fire: 总削×天气 合成常量单源');
ok(s04.includes('FHEAT[nj2]+=dt*(di&&dj?0.42:0.85)*FIRE_SPREAD;'),'T7 04b-fire: 积热率单消费点 (R9)');
ok(s04.includes('FHEAT[nj2]>=0.8) igniteCell')&&s04.includes('FHEAT[ci]-=dt*0.25')&&s04.includes('FUEL[ci]-=dt*0.12'),'T7 04b-fire: 阈值0.8/冷却0.25/燃料0.12 三常数未动 (R9)');
// 火势行为学: 双格引燃 晴朗 ~1.9s / 小雨 ~5s / 暴雨 8s 不引燃
// 探针坑③: FIRE_SPREAD=0.8×0.35 浮点 ≠ 字面 0.28 ⇒ 乘积断言用容差
const fireSnap=`(()=>{try{
nowT=100;
FIRE_ACTIVE.length=0; HEATED.length=0; FIRE_SOURCES.length=0;
FUEL.fill(0); FHEAT.fill(0); FBURN.fill(0); FEXPIRE.fill(0);
const ci=fCellI(0,0), cj=ci+1;
FUEL[ci]=1; FUEL[cj]=1;
igniteCell(ci,null,0);
let tSp=-1;
for(let k=1;k<=80;k++){ updateFires(0.1); if(tSp<0&&FBURN[cj]>0) tSp=k*0.1; }
return {spread:FBURN[cj]>0, tSp, mul:FIRE_SPREAD, fm:WX_CFG.fireMul};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`;
const fClear=VM(boot({store:{sf_campaign:'4',sf_weather:'clear'}}),fireSnap);
const fRain=VM(boot({store:{sf_campaign:'4',sf_weather:'rain'}}),fireSnap);
const fStorm=VM(boot({store:{sf_campaign:'4',sf_weather:'storm'}}),fireSnap);
if(typeof fClear==='string'||typeof fRain==='string'||typeof fStorm==='string'){ exc('T7火势',fClear||fRain||fStorm); }
else{
ok(Math.abs(fClear.mul-0.8)<1e-9&&fClear.fm===1,'T7 火势: 晴朗 FIRE_SPREAD=0.8 (总削后新基线, R1 明示例外)');
ok(fClear.spread===true&&fClear.tSp>0&&fClear.tSp<=3,'T7 火势: 晴朗邻格 '+fClear.tSp+'s 引燃 (0.43/s 净积热)');
ok(Math.abs(fRain.mul-0.48)<1e-9&&fRain.spread===true&&fRain.tSp>fClear.tSp,'T7 火势: 小雨 '+(fRain.tSp||'-')+'s 引燃 (明显更慢, 成链)');
ok(Math.abs(fStorm.mul-0.28)<1e-9&&fStorm.spread===false,'T7 火势: 暴雨 8s 不引燃 (0.238/s < 冷却 0.25, 火不成链)');
}
// 载入清单对账
{
const htmlScripts=(html.match(/<script src="js\/[^"?]*\?v=[^"]*"/g)||[])
.map(s=>s.replace(/<script src="/,'').replace(/"$/,'').split('?')[0]);
const match=htmlScripts.length===FILES.length&&htmlScripts.every((f,i)=>f===FILES[i]);
ok(match,'T7 载入清单 = index.html 实载脚本逐条同序 ('+FILES.length+' 个, 动态对账)');
}
}

// ═════ T8 天体/天穹/雾色/云层 (2026-10-05 实机反馈批 口追⑥⑦⑧) ═════
// 规格 [sunVis,moonVis,starVis,skyGrey,skyLum,fogDim,cloudN,cloudOpMul,expoMul] —— 纲要 §4.3 (口追⑨ 加 expoMul)
const CELEST_SPEC={
clear:[1,1,1,0,1,1,9,1,1],
overcast:[0,0.25,0.15,0.55,1,0.85,20,1.15,0.9],
rain:[0,0.1,0,0.7,0.85,0.7,30,1.25,0.8],
storm:[0,0,0,0.8,0.55,0.55,42,1.4,0.7],
snowLight:[0.5,0.5,0.5,0.3,1.05,0.9,16,1.05,0.95],
snowMid:[0.3,0.25,0.2,0.45,1,0.9,24,1.15,0.9],
snowBlizzard:[0,0,0,0.8,0.9,0.75,42,1.4,0.72],
};
// 场景快照: 天体识别 = 位置(-380,480,±) + scale(太阳220/月110/月斑110), 云 = transparent 精灵且 scale≥150;
// 星 = 260 点 Points (STAR_N=260×3 顶点)。雾色断言: 桩 Color.getHex 直返构造原数 ⇒ 精确复刻。
// 口追⑨: 另读 renderer.toneMappingExposure (曝光=昼1.05/夜0.72 ×expoMul) 与 sun.castShadow (影随盘)。
// 注意: 局部改名 sunSp —— 避免遮蔽全局方向光 sun (castShadow 从全局读)。
const CE_SNAP=`(()=>{try{
const kids=scene.children||[];
let sunSp=null,moon=null,spots=null,stars=null,clouds=0;
for(const o of kids){
if(!o) continue;
if(o.isPoints){ if(o.geometry&&o.geometry.attributes&&o.geometry.attributes.position&&o.geometry.attributes.position.array.length===780) stars=o; continue; }
if(!o.isSprite) continue;
const x=o.position.x, y=o.position.y, sx=o.scale.x;
if(Math.abs(x+380)<1&&Math.abs(y-480)<1){
if(sx>150) sunSp=o;
else if(Math.abs(o.position.z-170)<1) moon=o;   // 月盘 z=170 (月斑 z=169, 云带 y≤300 不相扰)
else if(Math.abs(o.position.z-169)<1) spots=o;
continue; }
if(o.material&&o.material.transparent===true&&sx>=150) clouds++;
}
return {eff:WEATHER_EFF,night:NIGHT_MODE,keys:Object.keys(WX_CFG).length,
sunOp:sunSp?sunSp.material.opacity:null, sunShow:sunSp?sunSp.visible:null,
moonOp:moon?moon.material.opacity:null, moonShow:moon?moon.visible:null,
spotsOp:spots?spots.material.opacity:null, spotsShow:spots?spots.visible:null,
starOp:stars?stars.material.opacity:null, starShow:stars?stars.visible:null,
clouds, fogHex:scene.fog.color.getHex(), fbase:(NIGHT_MODE?nightFogColor(THEME.fog):THEME.fog),
expo:renderer.toneMappingExposure, sh:sun.castShadow};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`;
const _dimHex=(h,w)=>{ if(w>=1) return h; const r=(h>>16)&255,g=(h>>8)&255,b=h&255;
return ((Math.round(r*w)<<16)|(Math.round(g*w)<<8)|Math.round(b*w))>>>0; };
function t8(){
console.log('T8 天体/天穹/雾色/云层/曝光: 口追⑥ 太阳当空照·圆月明星 / ⑦ 云层密度 / ⑧ 亮度链 / ⑨ 影随盘+曝光');
// T8.a 规格表逐档对账
{
const s00=read('js/00-config.js');
let n=0;
for(const k in CELEST_SPEC){
const c=CELEST_SPEC[k], row=WX_CFG_ROW(s00,k);
if(!row){ ok(false,'T8.a '+k+' 行缺失'); continue; }
const got=[/sunVis:([\d.]+)/,/moonVis:([\d.]+)/,/starVis:([\d.]+)/,/skyGrey:([\d.]+)/,/skyLum:([\d.]+)/,/fogDim:([\d.]+)/,/cloudN:(\d+)/,/cloudOpMul:([\d.]+)/,/expoMul:([\d.]+)/].map(re=>{const m=row.match(re);return m?+m[1]:null;});
const bad=c.some((v,i)=>got[i]===null||Math.abs(got[i]-v)>1e-9);
if(!bad) n++;
else ok(false,'T8.a '+k+' 九字段漂移: 得 '+got.join('/')+' 期望 '+c.join('/'));
}
ok(n===7,'T8.a 七档 视觉九字段逐档对账 (硬编码规格)');
ok((s00.match(/sunVis:[\d.]+/g)||[]).length===7&&(s00.match(/fogDim:[\d.]+/g)||[]).length===7&&(s00.match(/skyLum:[\d.]+/g)||[]).length===7&&(s00.match(/expoMul:[\d.]+/g)||[]).length===7,'T8.a 00-config: sunVis/fogDim/skyLum/expoMul 各七档 (注释无冒号数字不误计)');
}
// T8.b 静态接线: 02-scene 消费点
{
const s02=read('js/02-scene.js');
ok(s02.includes('function _skyGreyMix(s,w,lum)')&&(s02.match(/_skyGreyMix\(st\[/g)||[]).length===5&&s02.includes('WX_CFG.skyLum'),'T8.b 02-scene: 天穹渐变五站灰度×亮度 (_skyGreyMix/st[]×5/skyLum)');
ok(s02.includes('function _fogDimCol(')&&s02.includes('_fogDimCol(_fogBase,WX_CFG.fogDim)'),'T8.b 02-scene: 雾色亮度乘子单点 (口追⑧)');
ok((s02.match(/=WX_CFG\.sunVis/g)||[]).length===1&&(s02.match(/=WX_CFG\.moonVis/g)||[]).length===2&&(s02.match(/=0\.85\*WX_CFG\.starVis|=WX_CFG\.starVis/g)||[]).length>=1,'T8.b 02-scene: 太阳盘×1/月盘+月斑×2/星空 接线');
ok(s02.includes('WX_CFG.cloudN')&&s02.includes('WX_CFG.cloudOpMul')&&s02.includes('255*Math.min(1,WX_CFG.skyLum)*(1-0.35*WX_CFG.skyGrey)'),'T8.b 02-scene: 云层数量/浓度/云朵灰化 (口追⑦⑧)');
ok(s02.includes('(NIGHT_MODE?NIGHT_CFG.exposure:1.05)*WX_CFG.expoMul'),'T8.b 02-scene: 曝光 = 昼1.05/夜0.72 ×expoMul (口追⑨)');
ok(s02.includes('sun.castShadow = NIGHT_MODE?true:WX_CFG.sunVis>=0.5'),'T8.b 02-scene: 影随盘 castShadow = sunVis≥0.5, 夜档不受门 (口追⑨)');
}
// T8.c 行为学: 七种 boot 的场景实测 (细雪=影随盘阈值边界: sunVis 0.5 恰好留影)
const cases=[
['T8.c 晴·昼 (百团)', {store:{sf_campaign:'4',sf_weather:'clear'}}, {eff:'clear',night:false,sunOp:1,sunShow:true,clouds:9,sh:true}],
['T8.c 阴·昼 (诺曼底)', {store:{sf_campaign:'0'}}, {eff:'overcast',night:false,sunOp:0,sunShow:false,clouds:20,sh:false}],
['T8.c 暴·昼 (缅甸)', {store:{sf_campaign:'5'}}, {eff:'storm',night:false,sunOp:0,sunShow:false,clouds:42,sh:false}],
['T8.c 细雪·昼 (斯大林格勒)', {store:{sf_campaign:'1',sf_weather:'overcast'}}, {eff:'snowLight',night:false,sunOp:0.5,sunShow:true,clouds:16,sh:true}],
['T8.c 中雪·昼 (斯大林格勒)', {store:{sf_campaign:'1'}}, {eff:'snowMid',night:false,sunOp:0.3,sunShow:true,clouds:24,sh:false}],
['T8.c 晴·夜 (百团)', {store:{sf_campaign:'4',sf_weather:'clear',sf_daynight:'night'}}, {eff:'clear',night:true,moonOp:1,spotsOp:1,starOp:0.85,starShow:true,clouds:9,sh:true}],
['T8.c 阴·夜 (诺曼底)', {store:{sf_campaign:'0',sf_daynight:'night'}}, {eff:'overcast',night:true,moonOp:0.25,spotsOp:0.25,starOp:0.1275,starShow:true,clouds:20,sh:true}],
];
for(const [tag,bopt,want] of cases){
const r=VM(boot(bopt),CE_SNAP);
if(typeof r==='string'){ exc(tag,r); continue; }
ok(r.keys===27,tag+' WEATHER_CFG 27 字段 (18 基础+9 视觉)');
ok(r.eff===want.eff&&r.night===want.night,tag+' 档位/昼夜正确 ('+r.eff+(r.night?'·夜':'·昼')+')');
if(want.sunOp!==undefined){
ok(r.sunOp===want.sunOp&&r.sunShow===want.sunShow,tag+' 太阳盘 opacity='+r.sunOp+' visible='+r.sunShow+' (期望 '+want.sunOp+'/'+want.sunShow+')');
ok(r.moonOp===null&&r.spotsOp===null&&r.starOp===null,tag+' 夜档天体昼间不存在 (moon/spots/stars = null)');
}
if(want.moonOp!==undefined){
ok(r.moonOp===want.moonOp&&r.spotsOp===want.spotsOp,tag+' 月盘/月斑 opacity='+r.moonOp+'/'+r.spotsOp);
ok(r.starOp!==null&&Math.abs(r.starOp-want.starOp)<1e-9&&r.starShow===want.starShow,tag+' 星空 opacity='+r.starOp+' visible='+r.starShow);
ok(r.moonShow===(want.moonOp>0),tag+' 月盘 visible 随 moonVis 归零');
}
ok(r.clouds===want.clouds,tag+' 云数='+r.clouds+' (期望 '+want.clouds+')');
const expFog=_dimHex(r.fbase,r.eff==='clear'?1:CELEST_SPEC[r.eff][5]);
ok(r.fogHex===expFog,tag+' 雾色=fogDim 复刻逐位 ('+r.fogHex.toString(16)+')');
const expExpo=(r.night?0.72:1.05)*(r.eff==='clear'?1:CELEST_SPEC[r.eff][8]);
ok(Math.abs(r.expo-expExpo)<1e-9,tag+' 曝光='+(r.night?'夜0.72':'昼1.05')+'×expoMul='+r.expo+' (口追⑨)');
ok(r.sh===want.sh,tag+' castShadow='+r.sh+' (影随盘 sunVis≥0.5, 夜档不受门)');
}
// T8.d 晴档零回归: 雾色原值 + 云参数原样 + 曝光原值 (rand 流消耗数不变)
{
const r=VM(boot({store:{sf_campaign:'4',sf_weather:'clear'}}),CE_SNAP);
ok(r.fbase===r.fogHex,'T8.d 晴档 fogDim=1 → 雾色原值逐位 (零回归)');
ok(r.clouds===9&&r.sunOp===1,'T8.d 晴档云 9/太阳盘 ×1 (现状逐位)');
ok(r.expo===1.05,'T8.d 晴档 expoMul=1 → 曝光 1.05 原值逐位 (零回归)');
}
}
function WX_CFG_ROW(s00,k){
const m=s00.match(new RegExp('\\n'+k+'\\s*:\\s*\\{[^\\n]*\\}'));
return m?m[0]:null;
}

// ═════ T9 雨雪顶面终结 (2026-10-06 用户实机反馈"有房顶的室内也漏雨雪") ═════
//   高空净空相机 + 注入合成件 (水平顶面/竖墙/无网格纯碰撞体/已毁板) 各一件:
//   ① scanRainCovers 只收"带网格的水平面板"; ② 顶面投影下方 35s 推演无粒子头部 (室内不漏雨/雪);
//   ③ 投影外粒子照旧自由落到盒底 (顶外行为零回归); ④ 顶面标 dead (killBox 口径) → 重扫摘除,
//   同样推演投影下方出现粒子 (塌了漏雨)。雨 (LineSegments 头端判据) 与雪 (Points) 双路径。
function t9(){
console.log('T9 雨雪顶面终结: 只收水平带网格面 / 室内不漏 / 塌顶漏雨 / 顶外零回归');
const INJ=`camera.position.set(40,40,40);
const roof={minX:34,maxX:46,minY:48.4,maxY:49.0,minZ:34,maxZ:46,mesh:{}};
const wall={minX:60,maxX:61,minY:32,maxY:52,minZ:60,maxZ:61,mesh:{}};
const nocol={minX:-10,maxX:-2,minY:48.4,maxY:49.0,minZ:-10,maxZ:-2};
const deadSlab={minX:-10,maxX:-2,minY:48.4,maxY:49.0,minZ:20,maxZ:32,mesh:{},dead:true};
BOXES.push(roof,wall,nocol,deadSlab);
rainCoverT=0; updateWeather(0.016);`;
const r=VM(boot({store:{sf_campaign:'0',sf_weather:'rain'}}),`(()=>{try{
${INJ}
const inCovers=RAIN_COVERS.indexOf(roof)>=0;
const rejects=RAIN_COVERS.indexOf(wall)<0&&RAIN_COVERS.indexOf(nocol)<0&&RAIN_COVERS.indexOf(deadSlab)<0;
const under=(wx,wy,wz)=>wy<roof.maxY&&wx>=roof.minX&&wx<=roof.maxX&&wz>=roof.minZ&&wz<=roof.maxZ;
let leakDry=0, outsideLow=0;
for(let i=0;i<700;i++){ updateWeather(0.05);
const px=precipObj.position.x,py=precipObj.position.y,pz=precipObj.position.z;
const arr=precipObj.geometry.attributes.position.array;
for(let f=0;f<arr.length;f+=6){   // 每段 6 浮点, 头端在 [f..f+2]
const wy=arr[f+1]+py, wx=arr[f]+px, wz=arr[f+2]+pz;
if(under(wx,wy,wz)) leakDry++;
if(wy<roof.minY&&(wx<roof.minX||wx>roof.maxX||wz<roof.minZ||wz>roof.maxZ)) outsideLow++;
}}
roof.dead=true; rainCoverT=0; updateWeather(0.016);
const gone=RAIN_COVERS.indexOf(roof)<0;
let leakWet=0;
for(let i=0;i<700;i++){ updateWeather(0.05);
const px=precipObj.position.x,py=precipObj.position.y,pz=precipObj.position.z;
const arr=precipObj.geometry.attributes.position.array;
for(let f=0;f<arr.length;f+=6){
const wy=arr[f+1]+py, wx=arr[f]+px, wz=arr[f+2]+pz;
if(under(wx,wy,wz)) leakWet++;
}}
return {inCovers,rejects,dryOK:leakDry===0,outOK:outsideLow>0,gone,wetOK:leakWet>0,leakDry,leakWet};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof r==='string'){ exc('T9雨',r); }
else{
ok(r.inCovers,'T9雨 顶面收编: 水平带网格面板进 RAIN_COVERS');
ok(r.rejects,'T9雨 拒收: 竖墙(厚薄比)/无网格纯碰撞体/已毁板 都不收');
ok(r.dryOK,'T9雨 顶面投影下方 35s 内无粒子头部 (室内不漏雨, 拒收样本 '+r.leakDry+')');
ok(r.outOK,'T9雨 顶面投影外粒子照旧自由落到盒底 (顶外行为零回归)');
ok(r.gone,'T9雨 顶面 dead (killBox 口径) → 重扫后摘除');
ok(r.wetOK,'T9雨 塌顶后同样推演投影下方出现粒子 (塌了漏雨, 样本 '+r.leakWet+')');
}
const rs=VM(boot({store:{sf_campaign:'1',sf_weather:'rain'}}),`(()=>{try{
${INJ}
const under=(wx,wy,wz)=>wy<roof.maxY&&wx>=roof.minX&&wx<=roof.maxX&&wz>=roof.minZ&&wz<=roof.maxZ;
let leakDry=0;
for(let i=0;i<700;i++){ updateWeather(0.05);
const px=precipObj.position.x,py=precipObj.position.y,pz=precipObj.position.z;
const arr=precipObj.geometry.attributes.position.array;
for(let f=0;f<arr.length;f+=3){   // 雪点: 每 3 浮点一个
const wy=arr[f+1]+py, wx=arr[f]+px, wz=arr[f+2]+pz;
if(under(wx,wy,wz)) leakDry++;
}}
roof.dead=true; rainCoverT=0; updateWeather(0.016);
let leakWet=0;
for(let i=0;i<700;i++){ updateWeather(0.05);
const px=precipObj.position.x,py=precipObj.position.y,pz=precipObj.position.z;
const arr=precipObj.geometry.attributes.position.array;
for(let f=0;f<arr.length;f+=3){
const wy=arr[f+1]+py, wx=arr[f]+px, wz=arr[f+2]+pz;
if(under(wx,wy,wz)) leakWet++;
}}
return {eff:WEATHER_EFF,dryOK:leakDry===0,wetOK:leakWet>0};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof rs==='string'){ exc('T9雪',rs); }
else{
ok(rs.eff==='snowMid','T9雪 雪图映射档生效 (斯大林格勒 rain→snowMid)');
ok(rs.dryOK,'T9雪 顶面投影下方 35s 内无雪点 (室内不漏雪)');
ok(rs.wetOK,'T9雪 塌顶后投影下方出现雪点 (塌了漏雪)');
}
}

console.log('═══ verify-weather 天气系统批沙箱 ═══');
t1t2(); t3(); t4(); t5(); t6(); t7(); t8(); t9();
console.log('═══ 结果: '+PASS+' 过 / '+FAILS+' 挂 ═══');
process.exit(FAILS?1:0);
