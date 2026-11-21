// ─────────────────────────────────────────────
// dev/verify-20261118c.js —— 低弹变红×严寒天气分级批 (2026-11-18 用户令):
//   ①低弹变红: 现有子弹数 ≤ 弹匣总容量/2 (向下取整) 即红 —— 22-hud magN 色, 旧 25% 阈值作废 (用户令逐字)
//   ②严寒天气分级: 失温参数进 WEATHER_CFG.coldOff/coldDmg (R7 单源纪律: 消费点读 WX_CFG 字段禁字符串比较)
//     雪图四级阶梯: 晴 40/1 < 细雪 30/1 < 中雪 25/2 (本图缺省档=现行值零回归) < 暴风雪 15/3
//   ③火焰驱寒: nearWarmFire (04b-fire) —— 取暖半径 r+1.5m/竖向门 2.5m, 寒意 4 倍速消退不积累 (玩家/Bot 同参)
//   ④载具免疫: onVehicle/炮位/chute/flying/loiter/useCast 既有 coldBusy 豁免保留 (车内不积寒)
//   ⑤冻僵倒计时: 失温掉血行内 <span.cccd> ⏱ 按 hp/cDmg 估算距冻死秒数 (回血被 lastDmgT 压住=估算成立);
//     sf_coldcd 可关 (游戏内容设置"严寒倒计时"卡, 改档即时生效)
//   ⑥受冻特效: #coldFx 四角结霜+冷晕 (coldFxDrive 单源缓动, 变了才写) + .freezing 亮度脉冲 + 近火退散;
//     #coldTip 既有槽位内嵌倒计时 (零新增 UI 面 = 不与任何现有 HUD 重叠)
// 用法: node dev/verify-20261118c.js [--neg]
//   --neg = 阴性对照: 六补丁同时累积应用, 行为/源码判据必须报红 (对认按红名↔补丁):
//     N1 nearWarmFire 定义短路 → T3d/T4 红 (火焰驱寒失效: 火边照旧积寒掉血)
//     N2 摘玩家天气分级 (_wx=null) → T3e/T3f 红 (暴风雪/细雪档回落 COLD_OFF/COLD_DMG 兜底)
//     N3 摘 Bot 驱寒分支 → T5b 红 (Bot 火边不回暖)
//     N4 摘倒计时渲染行 → T3b 红 (失温行不再含冻僵倒计时)
//     N5 摘掉血期特效驱动 → T3a 红 (#coldFx 停在积寒渐变 ≤0.46, 不进 0.55 掉血档)
//     N6 弹药阈值回旧 25% → T1b 红 (4/8 弹匣不再红)
// ★沙箱注: _bootstub classList 全 no-op ⇒ 探针给 #coldFx 注 Set 版 classList 再断言挂/摘;
//   冷块在 updatePlayer 地面分支内 ⇒ 全部行为钉走真 _step(1/60) 步进, 不直调伪函数;
//   nowT 沙箱不推进 ⇒ 自然回血 gate (nowT-lastDmgT>6) 恒 false = 倒计时估算不受回血污染。
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
const css=fs.readFileSync(path.join(root,'css/style.css'),'utf8');
const FILES=[...html.matchAll(/src="(js\/[^"?]+)/g)].map(m=>m[1]);

// ── NEG 阴性对照: 六补丁 (正常跑不启用; --neg 全部累积应用) ──
const NEG=process.argv.includes('--neg');
const SRC={},PATCH_MAP={};
const NEG_PATCHES=[
// N1 nearWarmFire 定义短路 → T3d/T4 红
['js/04b-fire.js','function nearWarmFire(x,y,z,pad){','function nearWarmFire(x,y,z,pad){return false;'],
// N2 摘玩家天气分级 → T3e/T3f 红 (回落 COLD_OFF/COLD_DMG 兜底)
['js/20-player.js','const _wx=(typeof WX_CFG!==\'undefined\'&&WX_CFG)?WX_CFG:null;','const _wx=null;'],
// N3 摘 Bot 驱寒分支 → T5b 红
['js/14-bots.js','}else if(typeof nearWarmFire===\'function\'&&nearWarmFire(this.pos.x,this.pos.y,this.pos.z)){','}else if(false){'],
// N4 摘倒计时渲染行 → T3b 红 (★替换保 if/else 结构: 直换 ';' 会让后随 else 悬空炸语法)
['js/20-player.js','if(COLD_CD_SHOW) coldHudShow(`❄ <b>失温中</b> -${cDmg}/秒 · <span class="ccd">⏱ 冻僵倒计时 ${Math.max(1,Math.ceil(Math.max(0,p.hp)/cDmg))}s</span> · 快移动/进屋/近火取暖!`);','if(false)0;'],
// N5 摘掉血期特效驱动 → T3a 红 (opacity 停在积寒渐变 ≤0.46)
['js/20-player.js','coldFxDrive(dt,0.55,true);',';'],
// N6 弹药阈值回旧 25% → T1b 红
// ★2026-11-20 判据跟走 (军刀近战重做批): 低弹红门加 !w.def.melee (军刀 mag=0 ⇒ 不排除就 0<=floor(0/2) 恒红),
//   枪械阈值语义不变 —— 阴性锚跟码到新片段。
['js/22-hud.js',"(!player.onMG&&!w.def.melee&&w.mag<=Math.floor(w.def.mag/2))?'#ff7060':'#eee'","(!player.onMG&&w.mag<=Math.max(2,w.def.mag*0.25))?'#ff7060':'#eee'"],
];
if(NEG) for(const [f,from,to] of NEG_PATCHES){
if(SRC[f]===undefined) SRC[f]=fs.readFileSync(path.join(root,f),'utf8');
if(SRC[f].indexOf(from)<0){ console.log('✗ NEG 锚缺失: '+f+' :: '+from.slice(0,60)); process.exit(1); }
PATCH_MAP[f]=(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC[f]).split(from).join(to);
}
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:fs.readFileSync(path.join(root,f),'utf8'));

function boot(campIdx,extraLs){
for(const k in stub.byId)delete stub.byId[k];
const ctx=vm.createContext(Object.assign({},stub.sandbox));
ctx.document=stub.document; ctx.window=stub.window; ctx.CANNON=CANNON;
ctx.localStorage={_s:Object.assign({sf_campaign:String(campIdx)},extraLs||{}),getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of FILES) vm.runInContext(srcOf(f),ctx,{filename:f});
return ctx;
}
const PASS=[];let FAILN=0;
function ok(cond,label){
if(cond){ PASS.push(label); console.log('  ✔ '+label); }
else { FAILN++; console.log('  ✘ '+label); }
}

// ══ T0 版本戳 ══
console.log('T0 版本戳 20261122b');
{
const stamps=[...html.matchAll(/20261122b/g)].length;
ok(stamps>=48&&html.includes("window.__sfStyleVer='20261122b';")
&&html.includes('css/style.css?v=20261122b')
&&!html.includes('20261118b'),'T0a ★版本戳 20261122b: index.html '+stamps+' 处 + __sfStyleVer + css 链 + 旧 20261118b 清零');
const gf=fs.readFileSync(path.join(root,'dev/_game_files.txt'),'utf8');
const gl=gf.split(/\r?\n/).filter(l=>l.includes('?v='));
ok(gl.length===45&&gl.every(l=>l.endsWith('?v=20261122b'))&&!gf.includes('20261118b'),'T0b ★_game_files.txt 45 行全 20261122b (旧戳清零)');
}

// ══ T1 批① 低弹变红 ══
console.log('T1 批① 低弹变红 (≤弹匣/2 向下取整)');
{
const s22=srcOf('js/22-hud.js');
ok(s22.includes("hudStyle('magN','color',(!player.onMG&&!w.def.melee&&w.mag<=Math.floor(w.def.mag/2))?'#ff7060':'#eee');")
&&!s22.includes('w.def.mag*0.25'),'T1a ★源码钉: 新阈值 floor(弹匣/2) 在位 + 旧 25% 阈值绝迹');
// 行为钉: 真 updateHUD 写 #magN 色
const IDX_S=(()=>{ const c0=boot(0); return vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="stalingrad")',c0); })();
const ctx1=boot(IDX_S);
const G1=s=>vm.runInContext(s,ctx1);
let err1=null;
try{ G1("document.getElementById('startBtn').onclick(); if(!player.alive||!player.deployed) deployPlayer();"); }catch(e){ err1=String(e&&e.stack||e); }
if(err1||!G1('player.alive')){ console.log('  ✘ 开局失败 '+err1); process.exit(1); }
G1('player.curW={key:"probe_rifle",def:{name:"试枪",mode:"半自动",mag:8},mag:4,reserve:9}; player.onMG=null; clearWeaponHUDCache();');
G1('updateHUD(1/60)');
const c4=ctx1.document.getElementById('magN').style.color;
G1('player.curW.mag=5; updateHUD(1/60)');
const c5=ctx1.document.getElementById('magN').style.color;
G1('player.curW.def.mag=30; player.curW.mag=15; updateHUD(1/60)');
const c15=ctx1.document.getElementById('magN').style.color;
G1('player.curW.mag=16; updateHUD(1/60)');
const c16=ctx1.document.getElementById('magN').style.color;
ok(c4==='#ff7060'&&c5==='#eee','T1b ★行为钉 updateHUD: 8 发弹匣 4 发=红 / 5 发=常规 (实测 '+c4+'/'+c5+')');
ok(c15==='#ff7060'&&c16==='#eee','T1c ★行为钉: 30 发弹匣 15 发=红 (恰=floor 半) / 16 发=常规 (实测 '+c15+'/'+c16+')');
G1('player.onMG=true; player.curW.mag=0; updateHUD(1/60)');
const cmg=ctx1.document.getElementById('magN').style.color;
ok(cmg==='#eee','T1d 机枪档 ∞ 不吃红 (实测 '+cmg+')');
}

// ══ T2 批② 天气分级表 ══
console.log('T2 严寒天气分级 (WEATHER_CFG.coldOff/coldDmg)');
{
const ctx2=boot(0);
const G2=s=>vm.runInContext(s,ctx2);
const tbl=G2('JSON.stringify(Object.fromEntries(Object.entries(WEATHER_CFG).map(([k,v])=>[k,v.coldOff+"/"+v.coldDmg])))');
ok(tbl.includes('"clear":"40/1"')&&tbl.includes('"snowLight":"30/1"')&&tbl.includes('"snowMid":"25/2"')
&&tbl.includes('"snowBlizzard":"15/3"')&&tbl.includes('"overcast":"25/2"')&&tbl.includes('"rain":"25/2"')&&tbl.includes('"storm":"25/2"'),
'T2a ★七档逐位: 晴 40/1 < 细雪 30/1 < 中雪 25/2 (缺省=现行) < 暴风雪 15/3; 非雪档 25/2 (=现行)');
const s20=srcOf('js/20-player.js'),s14=srcOf('js/14-bots.js');
ok(s20.includes('_wx.coldOff')&&s20.includes('_wx.coldDmg')&&s14.includes('_wx.coldOff')&&s14.includes('_wx.coldDmg')
&&!s20.includes("WEATHER_EFF==='")&&!s14.includes("WEATHER_EFF==='"),'T2b ★R7 消费点: 玩家/Bot 读 WX_CFG.coldOff/coldDmg 字段 + 两文件零字符串比较');
const IDXS=vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="stalingrad")',ctx2);
ok(G2('WEATHER_CFG[calcWeatherEff("stalingrad",undefined)].coldOff+" "+WEATHER_CFG[calcWeatherEff("stalingrad",undefined)].coldDmg')==='25 2'
&&G2('calcWeatherEff("stalingrad",undefined)')==='snowMid','T2c ★零回归: 冷图缺省天气=snowMid → 25/2 = 现行值逐位');
}

// ══ T3 玩家失温行为 (stalingrad 真步进) ══
const IDX_S=(()=>{ const c0=boot(0); return vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="stalingrad")',c0); })();
const ctx=boot(IDX_S);
const G=s=>vm.runInContext(s,ctx);
let err0=null;
try{ G("document.getElementById('startBtn').onclick();"); }catch(e){ err0=String(e&&e.stack||e); }
if(!err0){ try{ G('if(!player.alive||!player.deployed) deployPlayer();'); }catch(e){ err0='deployPlayer: '+String(e&&e.stack||e); } }
if(err0||!G('player.alive')){ console.log('  ✘ 开局/部署失败 '+(err0||'player.alive=false')); process.exit(1); }
G('for(const s of soldiers) s.protUntil=0; player.protUntil=0; player.spectator=false;');

console.log('T3 玩家失温行为 (updatePlayer 真步进, 斯大林格勒)');
{
// 露天净空点扫描 (coldSheltered=头顶 12m 射线)
const spot=G('(function(){for(let x=-120;x<=120;x+=6){for(let z=-120;z<=120;z+=6){const y=terrainSurfaceY(x,z); if(isFinite(y)&&!coldSheltered(x,y,z)) return {x:x,y:y,z:z};}}return null;})()');
if(!spot){ console.log('  ✘ 露天净空点扫描失败'); process.exit(1); }
G('player.pos.x='+spot.x+'; player.pos.y='+spot.y+'; player.pos.z='+spot.z+';');
G('var _step=(n)=>{ for(let i=0;i<n;i++){ player.vel.x=0; player.vel.z=0; updatePlayer(1/60); } };');
G('var _run=(n)=>{ for(let i=0;i<n;i++){ player.vel.x=2; updatePlayer(1/60); } };');
G('player._coldT=0; player._coldAcc=0; player.hp=100;');
const fx=stub.document.getElementById('coldFx');
fx.classList={_s:new Set(),toggle(k,v){ if(v===undefined){ this._s.has(k)?this._s.delete(k):this._s.add(k); } else { v?this._s.add(k):this._s.delete(k); } },contains(k){ return this._s.has(k); },add(k){ this._s.add(k); },remove(k){ this._s.delete(k); }};
G('_step(1520)');   // 25.33s > 缺省档 cOff=25
const cT=Number(G('player._coldT'));
const hpA=Number(G('player.hp'));
G('_step(120)');    // 再 2s 掉血期
const hpB=Number(G('player.hp'));
const tip=G('document.getElementById("coldTip").innerHTML');
const fxO=Number(fx.style.opacity||0);
ok(cT>25,'T3a-1 ★露天静止 25.3s 起冻越阈 (snowMid 缺省档 cOff=25; 掉血在 T3a-2 校验)');
ok((hpA-hpB)>=3&&(hpA-hpB)<=5,'T3a-2 ★掉血速率=2/s (2s 掉 '+(hpA-hpB).toFixed(0)+')');
ok(tip.includes('失温中')&&/-2\/秒/.test(tip),'T3a-3 ★失温提示行在位 (-2/秒)');
ok(fxO>0.5&&fx.classList.contains('freezing'),'T3a-4 ★受冻特效: #coldFx opacity '+fxO.toFixed(2)+' (掉血档 0.55) + .freezing 脉冲挂档');
ok(tip.includes('冻僵倒计时')&&/\d+s/.test(tip),'T3b-1 ★冻僵倒计时在位 (sf_coldcd 默认开)');
G('COLD_CD_SHOW=false; _step(1)');
const tip2=G('document.getElementById("coldTip").innerHTML');
ok(!tip2.includes('冻僵倒计时')&&tip2.includes('失温中'),'T3b-2 ★开关关=只留提示文字 (倒计时片消失)');
G('COLD_CD_SHOW=true; _step(1)');
// 移动豁免
G('player._coldT=0; player._coldAcc=0; _run(60)');
ok(Number(G('player._coldT'))===0,'T3c ★移动豁免 (>0.6m/s 即清账, 60 tick 后 coldT=0)');
G('player.pos.x='+spot.x+'; player.pos.z='+spot.z+'; player.vel.x=0; player.vel.z=0;');
// 近火驱寒: 先回冻态再落火圈
G('player._coldT=0; player._coldAcc=0; _step(1530)');   // 回到 25.5s 冻态
const hpC=Number(G('player.hp'));
G('FIRE_SOURCES.push({x:player.pos.x+1,z:player.pos.z,y:player.pos.y+0.3,r:3,ttl:999,dps:0,attacker:null,acc:0,smk:0,igniteT:0,follow:null,noWx:1})');
const cT0=Number(G('player._coldT'));
G('_step(120)');
const cT1=Number(G('player._coldT'));
const hpD=Number(G('player.hp'));
const tip3=G('document.getElementById("coldTip").innerHTML');
ok((cT0-cT1)>=6,'T3d-1 ★火焰驱寒: 火圈边 2s 寒意 '+cT0.toFixed(1)+'→'+cT1.toFixed(1)+' (4 倍速消退 ≥6)');
ok(hpC===hpD,'T3d-2 ★取暖期不再掉血 (hp '+hpC.toFixed(0)+'→'+hpD.toFixed(0)+')');
ok(tip3.includes('近火取暖'),'T3d-3 ★取暖提示行在位 (🔥 近火取暖 · 寒意消退)');
ok(!fx.classList.contains('freezing'),'T3d-4 ★取暖期 .freezing 摘档 (脉冲停)');
G('FIRE_SOURCES.pop()');
// 暴风雪档 15/3
G('WX_CFG=WEATHER_CFG.snowBlizzard; player._coldT=0; player._coldAcc=0; player.hp=80; _step(920)');
const hpE=Number(G('player.hp'));
G('_step(120)');
const hpF=Number(G('player.hp'));
const tipB=G('document.getElementById("coldTip").innerHTML');
ok(Number(G('player._coldT'))>15&&hpE<80,'T3e-1 ★暴风雪档: 15.3s 起冻 (cOff=15)');
ok((hpE-hpF)===6,'T3e-2 ★暴风雪掉血=3/s (2s 掉 '+(hpE-hpF).toFixed(0)+')');
ok(/-3\/秒/.test(tipB),'T3e-3 ★提示行 -3/秒');
// 细雪档 30/1
G('WX_CFG=WEATHER_CFG.snowLight; player._coldT=0; player._coldAcc=0; player.hp=80; _step(1780)');
const hpG=Number(G('player.hp'));
G('_step(120)');
const hpH=Number(G('player.hp'));
ok(Number(G('player._coldT'))>28&&hpG===80,'T3f-1 ★细雪档: 29.7s 未起冻 (cOff=30, hp 不动)');
ok(Number(G('player._coldT'))>30&&(hpG-hpH)>=1&&(hpG-hpH)<=2,'T3f-2 ★细雪 31.7s 起冻掉血=1/s (跨阈后 1.67s → 掉 '+(hpG-hpH).toFixed(0)+')');
G('WX_CFG=WEATHER_CFG.snowMid; player._coldT=0; player._coldAcc=0;');
// 观战收尾 (死亡/观战期特效与提示一并收): 收尾挂在 updatePlayer 生死早退**之前** (冷块在地面分支, 死亡/观战到不了那)
G('player._coldT=25; _step(1); player.spectator=true; _step(240)');
ok(G('document.getElementById("coldTip").style.display')==='none'&&Number(stub.document.getElementById('coldFx').style.opacity||0)<0.05,'T3g ★观战/死亡期收尾: 提示隐藏+结霜衰净 (顺带修旧版死亡残留)');
G('player.spectator=false; player._coldT=0; player._coldAcc=0;');
}

// ══ T4 nearWarmFire 真值表 ══
console.log('T4 nearWarmFire 火焰驱寒查询 (04b-fire)');
{
const n0=G('FIRE_SOURCES.length');
G('FIRE_SOURCES.push({x:10,z:0,y:1,r:3,ttl:999,dps:0,attacker:null,acc:0,smk:0,igniteT:0,follow:null,noWx:0})');
ok(G('nearWarmFire(12,1,0)')===true,'T4a ★圈内 (净距 2 ≤ r3+pad1.5) true');
ok(G('nearWarmFire(15.5,1,0)')===false,'T4b ★圈外 (净距 5.5 > 4.5) false');
ok(G('nearWarmFire(12,10,0)')===false,'T4c ★竖向门 (dy=9 > 2.5) false — 桥下火不暖桥上人');
G('FIRE_SOURCES[FIRE_SOURCES.length-1].ttl=0');
ok(G('nearWarmFire(12,1,0)')===false,'T4d ★ttl≤0 火源跳过');
G('FIRE_SOURCES.length='+n0);
}

// ══ T5 Bot 同规 ══
console.log('T5 Bot 严寒同规 (14-bots 源码钉)');
{
const s14=srcOf('js/14-bots.js');
ok(s14.includes('const cOff=(_wx&&_wx.coldOff)||COLD_OFF;')&&s14.includes('const cDmg=(_wx&&_wx.coldDmg)||COLD_DMG;'),'T5a ★Bot 失温阈值/掉血吃天气分级 (与玩家同参)');
ok(s14.includes("nearWarmFire(this.pos.x,this.pos.y,this.pos.z)")&&s14.includes('this.coldT=Math.max(0,(this.coldT||0)-dt*4); this.coldAcc=0;'),'T5b ★Bot 近火驱寒分支在位 (4 倍速消退不积累)');
ok(s14.includes('if(this.coldT>cOff+2&&(this.state===\'cover\'||this.man===\'hold\'))'),'T5c ★冻僵反应判据随 cOff 缩放');
}

// ══ T6 设置卡 ══
console.log('T6 游戏内容设置「严寒倒计时」卡');
{
ok(/id="mGameplaySet"[\s\S]*?id="coldCdBtn"/.test(html),'T6a ★index.html: 游戏内容设置面板内 coldCdBtn 卡片在位');
ok(html.includes('id="coldCdBtn"')&&html.includes('严寒倒计时'),'T6b ★卡片标题+按钮在位');
const s22=srcOf('js/22-hud.js'),s00=fs.readFileSync(path.join(root,'js/00-config.js'),'utf8');
ok(s22.includes("localStorage.getItem('sf_coldcd')")&&s22.includes('COLD_CD_SHOW=!COLD_CD_SHOW;'),'T6c ★22-hud wiring: sf_coldcd 落盘+内存旗翻转');
ok(s00.includes("let COLD_CD_SHOW=localStorage.getItem('sf_coldcd')!=='0';"),'T6d ★00-config 初值读盘 (缺省开)');
// ★点击先于 T6e 的对照 boot: boot() 会清空共享 stub.byId ⇒ ctx3 一 boot, byId 就换成 ctx3 的元素壳,
//   再点钮就点到 ctx3 的 handler 上了 (首版 T6f 假红根因 — 沙箱跨 boot 元素壳共享坑)。
ok(G('COLD_CD_SHOW')===true,'T6f-1 初值开');
G("document.getElementById('coldCdBtn').onclick()");
ok(G('COLD_CD_SHOW')===false&&G("localStorage.getItem('sf_coldcd')")==='0','T6f-2 ★点击→关+落盘 0');
G("document.getElementById('coldCdBtn').onclick()");
ok(G('COLD_CD_SHOW')===true&&G("localStorage.getItem('sf_coldcd')")==='1','T6f-3 ★再点→开+落盘 1');
ok(G('document.getElementById("coldCdBtn").textContent').includes('开'),'T6f-4 ★按钮标签同步');
const ctx3=boot(IDX_S,{sf_coldcd:'0'});
ok(vm.runInContext('COLD_CD_SHOW',ctx3)===false,'T6e ★sf_coldcd=0 存档 → 默认关');
}

// ══ T7 受冻特效 ══
console.log('T7 受冻特效 #coldFx');
{
ok(/#coldFx \{ position:absolute/.test(css)&&css.includes('#coldFx.freezing')&&css.includes('@keyframes coldPulse')&&css.includes('#coldTip .ccd'),'T7a ★style.css: #coldFx 四角结霜+冷晕 + .freezing 脉冲 + .ccd 倒计时片在位');
ok(html.includes('<div id="coldFx"></div>'),'T7b ★index.html: #coldFx 在位 (#ui 内, 菜单/部署期随层隐藏)');
ok(html.indexOf('<div id="coldFx"></div>')>html.indexOf('<div id="vig"></div>')&&html.indexOf('<div id="coldFx"></div>')<html.indexOf('<div id="scopeOv">'),'T7c ★叠层序: vig 之上 scopeOv 之下 (文档序=同 z 叠放)');
// 行为: 单源缓动 + 变了才写 + Set classList 挂/摘
const fx2=stub.document.getElementById('coldFx');
fx2.style.opacity='0'; fx2.classList={_s:new Set(),toggle(k,v){ if(v===undefined){ this._s.has(k)?this._s.delete(k):this._s.add(k); } else { v?this._s.add(k):this._s.delete(k); } },contains(k){ return this._s.has(k); },add(k){ this._s.add(k); },remove(k){ this._s.delete(k); }};
G('for(let i=0;i<90;i++) coldFxDrive(1/60,0.55,true)');
const o1=Number(fx2.style.opacity||0);
ok(Math.abs(o1-0.55)<0.05&&fx2.classList.contains('freezing'),'T7d ★coldFxDrive: 1.5s 收敛 0.55 (实测 '+o1.toFixed(2)+') + freezing 挂档');
G('for(let i=0;i<240;i++) coldFxDrive(1/60,0,false)');
const o2=Number(fx2.style.opacity||0);
ok(o2<0.05&&!fx2.classList.contains('freezing'),'T7e ★目标 0 → 4s 衰净 + freezing 摘档 (实测 '+o2.toFixed(3)+')');
G('coldFxDrive(1/60,0,false); coldFxDrive(1/60,0,false)');
ok(Number(fx2.style.opacity||0)===o2,'T7f ★变了才写纪律: 稳态后不再落 DOM (同值幂等)');
}

console.log('verify-20261122b: PASS='+PASS.length+' FAIL='+FAILN+(NEG?' (--neg)':''));
process.exit(FAILN>0?1:0);
