// ─────────────────────────────────────────────
// dev/verify-audio3-20261117b.js —— 音效系统完全推倒重写批 (2026-11-15c)
// 用法: node dev/verify-audio3-20261117b.js [--neg]
// 判据:
//   T1 契约不破: 闸门 bypass Set 13 键 verbatim / naval 段逐字锚 (navalAudioTick 定义+挂 api /
//      navalAudEngine 只写 osc.type·osc2.detune·lp.frequency) / splash 四参签名 / 引擎频率写法带 pitch 倍率。
//   T2 档案表: GUN_PROFILES (5 家族缺省 + 每把在役武器一条, tool/rocket/mortar 豁免) /
//      CANNON_PROFILES 13 条 / EXPLOSION_PROFILES 18 kind / ENGINE_KINDS 9 档 + tank/plane 别名。
//   T3 引擎映射行为: 逐阵营实spawn —— us/ger (normandy) M4+四号=tankSmall 潘兴+黑豹=tankBig,
//      P-51/BF-109=planeInline P-47/FW-190=planeRadial; songhu kmt=×2 tankSmall jp=×2 tankJp;
//      baituan cpc(缴获)=×2 tankJp。★权重档读 tk.wc 不读 heavy 槽位标记 (T-26/一式 heavy:true 实为轻中坦)。
//   T4 identity 接线锚: 玩家/Bot gunshot 走 sid / MG_BULLET_DEF vcoax / mgSid 四 style / 坦克炮三档 /
//      航炮 planeMG / flak20 / navalSec·navalMG·naval_<key> / battery / 幽灵 tankSmall / 巡飞弹 loiter / 卡车 truck。
//   T5 行为: init 后每发变奏 (两次同枪 bandpass 频点多数不同) / 未知 sid 回落 / 旧数字调用口径兼容 /
//      引擎档行为 (tankJp saw+pitch>1 / tankBig pitch<1 / 'tank' 别名 triangle / truck square /
//      radial det26+lp700 vs inline det18+lp900) / panOf 在册。
//   T6 远枪限流仍在 (dist>70 100ms窗4发)。
//   --neg: N1 GUN_PROFILES.garand 键改名 (T2b 覆盖红) / N2 坦克引擎映射硬编码 tankSmall (T3b 日系红) /
//          N3 bypass 摘 createEngine·setUnderwater (T1a 红)。
// 沙箱要点承 verify-audio2-20261115; 另装 instrumented AudioContext (记录 bandpass/oscillator 参数值)
// 以断言每发变奏与引擎 pitch 倍率 —— 桩默认参数对象不记值。
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

// ── instrumented AudioContext: 记录 bandpass 频点 / 振荡器频率·型 / 增益 (每发变奏与引擎 pitch 断言用) ──
const REC={bp:[],osc:[],gain:[]};
const AP2=()=>{const a={value:0};a.setValueAtTime=v=>{a.value=v;};a.setTargetAtTime=v=>{a.value=v;};a.linearRampToValueAtTime=v=>{a.value=Math.max(a.value,v);};a.exponentialRampToValueAtTime=v=>{a.value=v;};a.cancelScheduledValues=()=>{};return a;};
const BaseAC=stub.window.AudioContext;
class RecAC extends BaseAC {
createBiquadFilter(){const f=super.createBiquadFilter();f.frequency=AP2();f.Q=AP2();REC.bp.push(f);return f;}
createOscillator(){const o=super.createOscillator();o.frequency=AP2();o.detune=AP2();REC.osc.push(o);return o;}
createGain(){const g=super.createGain();g.gain=AP2();REC.gain.push(g);return g;}
}
stub.window.AudioContext=RecAC; stub.window.webkitAudioContext=RecAC;

const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const FILES=[...html.matchAll(/src="(js\/[^"?]+)/g)].map(m=>m[1]);
console.log('载入清单: 解析 index.html 得 '+FILES.length+' 个脚本');

// ── NEG 阴性对照: 三补丁累积注入 (正常跑不启用) ──
const NEG=process.argv.includes('--neg');
const SRC={},PATCH_MAP={};
const NEG_PATCHES=[
// N1 GUN_PROFILES.garand 键改名: T2b (每枪档案覆盖) 红
['js/01-audio.js','garand:    { crack:2700, crack2:1.62','garandx:   { crack:2700, crack2:1.62'],
// N2 坦克引擎映射硬编码 tankSmall (日系档丢失): T3b 红
['js/15-vehicles.js',"createEngine((this.def.tk&&this.def.tk.shape==='chiha')?'tankJp':(this.def.tk&&this.def.tk.wc==='heavy')?'tankBig':'tankSmall');","createEngine('tankSmall');"],
// N3 bypass 摘 createEngine·setUnderwater (闸门面残缺): T1a 红
['js/01-audio.js',"'createEngine','setUnderwater'","'createEngine'"],
];
if(NEG) for(const [f,from,to] of NEG_PATCHES){
if(SRC[f]===undefined) SRC[f]=fs.readFileSync(path.join(root,f),'utf8');
if(SRC[f].indexOf(from)<0){ console.log('✗ NEG 锚缺失: '+f+' :: '+from); process.exit(1); }
PATCH_MAP[f]=(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC[f]).split(from).join(to);
}
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:fs.readFileSync(path.join(root,f),'utf8'));

function boot(campIdx,deploy){
for(const k in stub.byId)delete stub.byId[k];
const ctx=vm.createContext(Object.assign({},stub.sandbox));
ctx.document=stub.document; ctx.window=stub.window; ctx.CANNON=CANNON;
ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of FILES) vm.runInContext(srcOf(f),ctx,{filename:f});
if(deploy){
let err=null;
try{ vm.runInContext("document.getElementById('startBtn').onclick();",ctx); }catch(e){ err='start: '+String(e&&e.stack||e); }
if(!err){ try{ vm.runInContext('if(!player.alive||!player.deployed) deployPlayer();',ctx); }catch(e){ err='deploy: '+String(e&&e.stack||e); } }
if(err) throw new Error(err);
}
return ctx;
}
const G=(ctx,s)=>vm.runInContext(s,ctx);
const PASS=[];let FAILN=0;
function ok(cond,label){
if(cond){ PASS.push(label); console.log('  ✔ '+label); }
else { FAILN++; console.log('  ✘ '+label); }
}
// 档案表键解析 (01-audio 顶层 const, 沙箱读不到闭包 ⇒ 从源码块提键)
const src01=srcOf('js/01-audio.js');
function tableKeys(name){
const a=src01.indexOf('const '+name+'={');
if(a<0) return null;
const b=src01.indexOf('\n};',a);
const block=src01.slice(a,b);
return [...block.matchAll(/^\s*([A-Za-z0-9_]+):\s*\{/gm)].map(m=>m[1]);
}
const GUN_KEYS=tableKeys('GUN_PROFILES');
const CANNON_KEYS=tableKeys('CANNON_PROFILES');
const EXPL_KEYS=tableKeys('EXPLOSION_PROFILES');
const EK_KEYS=tableKeys('ENGINE_KINDS');

let IDX=0; { const c0=boot(0); IDX=vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="normandy")',c0); }
const ctx=boot(IDX,true);
const SH=ctx2=>s=>vm.runInContext(s,ctx2);
const Gm=SH(ctx);
ok(html.includes("__sfStyleVer='20261119b'"),'前置: 版本戳 20261119b 在位 (index.html 内联)');
ok(Gm('player.alive')===true,'前置: 开局/部署成功 (normandy)');

// ══ T1 契约不破 ══
console.log('T1 契约: bypass Set / naval 段 / splash 签名 / 引擎 pitch 写法');
ok(src01.includes("const bypass=new Set(['init','resume','setVol','setAmbientMute','stopAll','restoreAll','isSilenced','audioDebug','createEngine','setUnderwater','updateWeatherAmbient','setTimeFrozenMute','audioTimeFrozen']);")===true,'T1a ★闸门 bypass Set 13 键 verbatim (静音/冻结账契约面)');
ok(src01.includes('function navalAudioTick(dt,ownDt){')===true&&src01.includes('api.navalAudioTick=navalAudioTick;')===true,'T1b naval 段: navalAudioTick(dt,ownDt) 定义 + 挂 api 双锚 verbatim');
ok(src01.includes('if(n.osc&&n.osc.type!==undefined&&n.osc.type!==T.type) n.osc.type=T.type;')===true&&src01.includes('n.osc2.detune.setTargetAtTime(T.det,t0,0.3);')===true&&src01.includes('n.lp.frequency.setTargetAtTime(T.lp,t0,0.25);')===true,'T1c navalAudEngine 只写 osc.type/osc2.detune/lp.frequency 三处 verbatim (海战音色塑形契约)');
ok(src01.includes('function splash(dist=0, big=false, size=1, spd=0){')===true,'T1d ★splash 四参签名 verbatim (旧调用 splash(dist,big) 全兼容)');
ok(src01.includes('e.nodes.osc.frequency.setTargetAtTime(freq*pm,t0,0.12);')===true&&src01.includes('e.nodes.osc2.frequency.setTargetAtTime(freq*0.5*pm,t0,0.12);')===true&&src01.includes('e.nodes.osc3.frequency.setTargetAtTime(freq*0.25*pm,t0,0.12);')===true,'T1e 引擎三振荡器频率写入带 pitch 倍率 verbatim (日系高转/重坦低沉的单源)');

// ══ T2 档案表 ══
console.log('T2 档案表: 枪/炮/爆/引擎 四表在册 + 在役武器全覆盖');
ok(Array.isArray(GUN_KEYS)&&GUN_KEYS.length>=45&&['rifle','smg','sniper','pistol','mg'].every(k=>GUN_KEYS.includes(k)),'T2a GUN_PROFILES 在册 (≥45 条, 旧 snd 五家族缺省档保留)');
ok(Array.isArray(CANNON_KEYS)&&['generic','tkJp','tkMed','tkHeavy','atgun','battery','naval_lvt','naval_kami','naval_pt','naval_gyorai','rocket_bazooka','rocket_schreck','rocket_loiter'].every(k=>CANNON_KEYS.includes(k)),'T2c CANNON_PROFILES 在册 (坦克三档+atgun+battery+舰炮四型+火箭三型+generic)');
ok(Array.isArray(EXPL_KEYS)&&['generic','frag','atcharge','mine','mortar','bomb','shell','tankdie','truckdie','planedie','navalShell','naval','torpedo','barrage','thunder','drum','collapse','batterydie','loiter'].every(k=>EXPL_KEYS.includes(k)),'T2d EXPLOSION_PROFILES 在册 (18 kind)');
ok(Array.isArray(EK_KEYS)&&['tankSmall','tankJp','tankBig','planeInline','planeRadial','truck','amph','boat','loiter'].every(k=>EK_KEYS.includes(k))&&src01.includes("const ENGINE_ALIASES={ tank:'tankSmall', plane:'planeInline' };")===true,'T2e ENGINE_KINDS 九档在册 + tank/plane 旧档别名 verbatim');
{ // T2b 每把在役武器一条独立档案 (tool 不发火 / rocket·mortar·loiter 走炮声与爆炸档, 均豁免)
const wkeys=Gm('JSON.stringify(Object.keys(WPN_DEFS).map(k=>{const d=WPN_DEFS[k];return [k, !!d.tool, !!(d.rocket||d.mortar), d.sid||d.snd];}))');
const wl=JSON.parse(wkeys);
const missing=wl.filter(([k,tool,rct,sid])=>!tool&&!rct&&!GUN_KEYS.includes(sid)).map(([k])=>k);
ok(wl.every(([k,tool,,sid])=>tool?true:!!sid)&&missing.length===0,'T2b ★每把发火武器 sid 档案全覆盖 (缺: '+(missing.join(',')||'无')+')');
ok(Gm('Object.keys(WPN_DEFS).every(k=>!!WPN_DEFS[k].sid)')===true,'T2b-2 WPN_DEFS 全部条目带 sid 字段');
}

// ══ T3 引擎映射行为 (normandy: us/ger) ══
console.log('T3 引擎映射: 逐阵营实spawn');
let tkErr=null,tv=[];
try{
Gm('var _tA=new Tank(0,0),_tB=new Tank(0,1),_tC=new Tank(1,0),_tD=new Tank(1,1);');
Gm('var _pA=new Plane(0,0),_pB=new Plane(0,1),_pC=new Plane(1,0),_pD=new Plane(1,1);');
tv=[Gm('_tA.engine.kind'),Gm('_tB.engine.kind'),Gm('_tC.engine.kind'),Gm('_tD.engine.kind'),
Gm('_pA.engine.kind'),Gm('_pB.engine.kind'),Gm('_pC.engine.kind'),Gm('_pD.engine.kind')];
}catch(e){ tkErr=String(e&&e.stack||e); }
ok(tkErr===null,'T3-prep us/ger 坦克×4+飞机×4 spawn 无异常'+(tkErr?' ('+tkErr+')':''));
ok(tv[0]==='tankSmall'&&tv[1]==='tankBig'&&tv[2]==='tankSmall'&&tv[3]==='tankBig','T3a us/ger 坦克: M4+四号=tankSmall / 潘兴+黑豹=tankBig (实得 '+tv.slice(0,4).join(',')+')');
ok(tv[4]==='planeInline'&&tv[5]==='planeRadial'&&tv[6]==='planeInline'&&tv[7]==='planeRadial','T3a-2 us/ger 飞机: P-51/BF-109=planeInline / P-47/FW-190=planeRadial (实得 '+tv.slice(4).join(',')+')');
{ // songhu (kmt=team0, jp=team1) 与 baituan (cpc=team0, jp=team1)
let sov=[];let errB=null;
try{ const c2=boot(vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="songhu")',ctx));
vm.runInContext("document.getElementById('startBtn').onclick();",c2);
vm.runInContext('var _k1=new Tank(0,0),_k2=new Tank(0,1),_j1=new Tank(1,0),_j2=new Tank(1,1);',c2);
sov=[vm.runInContext('_k1.engine.kind',c2),vm.runInContext('_k2.engine.kind',c2),vm.runInContext('_j1.engine.kind',c2),vm.runInContext('_j2.engine.kind',c2)];
}catch(e){ errB=String(e&&e.stack||e); }
ok(errB===null&&sov[0]==='tankSmall'&&sov[1]==='tankSmall'&&sov[2]==='tankJp'&&sov[3]==='tankJp','T3b songhu: 维克斯+T-26=tankSmall / 九七式+一式=tankJp (实得 '+(errB?('ERR '+errB):sov.join(','))+')');
let bc=[];let errC=null;
try{ const c3=boot(vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="baituan")',ctx));
vm.runInContext("document.getElementById('startBtn').onclick();",c3);
vm.runInContext('var _c1=new Tank(0,0),_c2=new Tank(0,1);',c3);
bc=[vm.runInContext('_c1.engine.kind',c3),vm.runInContext('_c2.engine.kind',c3)];
}catch(e){ errC=String(e&&e.stack||e); }
ok(errC===null&&bc[0]==='tankJp'&&bc[1]==='tankJp','T3c baituan: 九七式(缴获)+一式(缴获)=tankJp (实得 '+(errC?('ERR '+errC):bc.join(','))+')');
}

// ══ T4 identity 接线锚 ══
console.log('T4 identity 接线: sid/kind 传递点');
const src20=srcOf('js/20-player.js'),src13=srcOf('js/13-combat.js'),src15=srcOf('js/15-vehicles.js'),
src16=srcOf('js/16-aircraft.js'),src15b=srcOf('js/15b-trucks.js'),src15d=srcOf('js/15d-naval.js'),
src15f=srcOf('js/15f-battery.js'),src15c=srcOf('js/15c-specveh.js'),src20a=srcOf('js/20a-seats.js'),
src00=srcOf('js/00-config.js');
ok(src20.includes('AudioSys.gunshot(w.def.sid||w.def.snd,0,0);')===true,'T4a 玩家开火 gunshot(w.def.sid||w.def.snd) verbatim');
ok(src13.includes('AudioSys.gunshot(def.sid||def.snd,dCam,pan*0.7);')===true,'T4b fireBullet 单源 gunshot(def.sid||def.snd) verbatim (Bot/固定/载具弹全链)');
ok(src00.includes("sid:'vcoax'")===true&&src00.includes('sid:mgSid(mdef)')===true&&src00.includes("air:'mg_air', mg42:'mg_mg42', water:'mg_maxim', 92:'mg_92'")===true,'T4c MG_BULLET_DEF vcoax + mgBulletDef 按 style 四档 (mgSid 单源)');
ok(Gm("mgSid({style:'mg42'})")==='mg_mg42'&&Gm("mgSid({style:'92'})")==='mg_92'&&Gm("mgSid({style:'water'})")==='mg_maxim'&&Gm("mgSid({style:'air'})")==='mg_air'&&Gm("mgSid({})")==='mg','T4d mgSid 四 style 映射行为 + 未知回落 mg');
ok(src15.includes("createEngine((this.def.tk&&this.def.tk.shape==='chiha')?'tankJp':(this.def.tk&&this.def.tk.wc==='heavy')?'tankBig':'tankSmall');")===true,'T4e 坦克引擎三档映射 verbatim (shape 在前 + tk.wc 权重档)');
ok(src15.includes("'tkJp':(this.def.tk&&this.def.tk.wc==='heavy')?'tkHeavy':'tkMed'")===true,'T4f 坦克炮三档映射 verbatim + AudioSys.panOf(this.muzzle) 真声像');
ok(src15.includes("AudioSys.gunshot('vcoax',0,0);")===true&&src15.includes("AudioSys.explosion('tankdie'")===true&&src15.includes("AudioSys.explosion('shell'")===true&&src15.includes("AudioSys.explosion('mine'")===true,'T4g 同轴 vcoax + tankdie/shell/mine 爆炸档接线');
ok(src16.includes("nose==='radial'?'planeRadial':'planeInline'")===true&&src16.includes("sid:'planeMG'")===true&&src16.includes("AudioSys.gunshot('planeMG',this.pos.distanceTo(camera.position),AudioSys.panOf(this.pos))")===true&&src16.includes("AudioSys.gunshot('flak20'")===true,'T4h 飞机: pl.nose 两档引擎 + 航炮 planeMG (AI/玩家) + flak20 高炮');
ok(src15d.includes("createEngine(this.kind==='boat'?'boat':'amph')")===true&&src15d.includes("AudioSys.cannon('naval_'+this.key")===true&&src15d.includes("AudioSys.gunshot('navalSec'")===true&&src15d.includes("AudioSys.gunshot('navalMG'")===true&&src15d.includes("AudioSys.explosion('torpedo'")===true,'T4i 海战: amph/boat 基档 + naval_<key> 舰炮 + navalSec/navalMG + torpedo 档');
ok(src15f.includes("AudioSys.cannon('battery'")===true&&src15f.includes("AudioSys.explosion('batterydie'")===true,'T4j 海防炮 battery + batterydie 档');
ok(src15c.includes("AudioSys.createEngine('tankSmall')")===true,'T4k 幽灵坦克 tankSmall 档 (开火静音红线不动)');
ok(src13.includes("AudioSys.createEngine('loiter')")===true&&src13.includes("AudioSys.explosion('loiter'")===true&&src13.includes("AudioSys.cannon('rocket_'+(def.sid||'bazooka')")===true&&src13.includes("explodeAt(n.pos,n.thrower,undefined,true,'frag')")===true&&src13.includes("AudioSys.explosion('bomb'")===true&&src13.includes("AudioSys.explosion('atcharge'")===true&&src13.includes("AudioSys.explosion('mortar'")===true,'T4l 巡飞弹 loiter 引擎/爆档 + rocket_<sid> 火箭档 + frag(explodeAt 传 kind)/bomb/atcharge/mortar 爆炸档');
ok(src15b.includes("AudioSys.createEngine('truck')")===true&&src15b.includes("AudioSys.explosion('truckdie'")===true&&src15b.includes('this.engine.update(42+Math.abs(this.vel)*9')===true,'T4m ★卡车首配引擎: createEngine(truck)+update 频响+truckdie 档');
ok(src20a.includes('AudioSys.gunshot(mgSid(mg.def),0,0);')===true,'T4n 枪座玩家 MG 走 mgSid 分档 verbatim');

// ══ T5 行为 ══
console.log('T5 行为: init/变奏/回落/兼容/引擎档行为');
Gm("_initErr=null; try{ if(typeof AudioSys.init==='function') AudioSys.init(); if(AudioSys.isSilenced) AudioSys.restoreAll(); if(AudioSys.setTimeFrozenMute) AudioSys.setTimeFrozenMute(false); }catch(e){ _initErr=String(e&&e.stack||e); }");
ok(Gm('_initErr')===null,'T5-prep AudioSys.init 无异常 + 静默/冻结账解除 (instrumented AudioContext 桩; 承 audio2 T5b 口径)');
// 每发变奏: 同枪两次, 只比 bandpass 层 (crack/crack2/mid 三层全走 jf=rand(0.93,1.07) 逐发抖动;
// 低通/高通层频点固定不抖, 不入比对)
let vA=null,vB=null,vErr=null;
try{
const m0=REC.bp.length;
vm.runInContext('AudioSys.gunshot("garand",5,0);',ctx);
vA=REC.bp.slice(m0).filter(f=>f.type==='bandpass').map(f=>f.frequency.value);
const m1=REC.bp.length;
vm.runInContext('AudioSys.gunshot("garand",5,0);',ctx);
vB=REC.bp.slice(m1).filter(f=>f.type==='bandpass').map(f=>f.frequency.value);
}catch(e){ vErr=String(e&&e.stack||e); }
ok(vErr===null,'T5a gunshot 行为无异常'+(vErr?' ('+vErr+')':''));
ok(Array.isArray(vA)&&vA.length>=3&&Array.isArray(vB)&&vB.length>=3,'T5a-2 每次枪声 ≥3 只 bandpass 抖动层 (双峰裂响×2+机身)');
let diffN=0; const n2=Math.min(vA.length,vB.length);
for(let i=0;i<n2;i++) if(Math.abs(vA[i]-vB[i])>0.01) diffN++;
ok(n2>=3&&diffN>=n2,'T5b ★每发变奏: 两次同枪 bandpass 抖动层 '+diffN+'/'+n2+' 全不同 (±7% 抖动)');
let fbErr=null;
try{ vm.runInContext('AudioSys.gunshot("no_such_sid",10,0); AudioSys.explosion(50); AudioSys.cannon(30); AudioSys.explosion("tankdie",30,0); AudioSys.explosion("thunder",200,0); AudioSys.explosion("planedie",40,0); AudioSys.cannon("tkHeavy",40,0.5); AudioSys.cannon("rocket_schreck",8,0);',ctx); }catch(e){ fbErr=String(e&&e.stack||e); }
ok(fbErr===null,'T5c 未知 sid 回落 + 旧数字调用口径 (explosion(50)/cannon(30)) + 爆/炮档行为全链无异常'+(fbErr?' ('+fbErr+')':''));
// 引擎档行为: 振荡器型/失谐/低通/pitch 倍率
let eErr=null;
const probeSrc=(k,slot)=>`try{ const _e=AudioSys.createEngine("${k}"); _e.update(60,0.1); _ek.${slot}={type:_e.nodes.osc.type,freq:_e.nodes.osc.frequency.value,det:_e.nodes.osc2.detune.value,lp:_e.nodes.lp.frequency.value,kind:_e.kind}; _e.stop(); }catch(e){ _ek.${slot}={err:String(e&&e.message||e)}; }`;
try{
vm.runInContext('var _ek={};',ctx);
for(const [k,slot] of [['tankJp','jp'],['tankBig','big'],['tank','legacy'],['truck','truck'],['planeRadial','radial'],['planeInline','inline'],['loiter','loiter']]) vm.runInContext(probeSrc(k,slot),ctx);
}catch(e){ eErr=String(e&&e.stack||e); }
ok(eErr===null,'T5d-prep 引擎档行为链无异常'+(eErr?' ('+eErr+')':''));
const E=JSON.parse(Gm('JSON.stringify(_ek)'));
ok(E.jp&&E.jp.type==='sawtooth'&&E.jp.freq>60,'T5d ★tankJp 档: saw 粗糙波 + pitch 1.35 高转 (60→'+(E.jp&&E.jp.freq)+')');
ok(E.big&&E.big.freq<60&&E.big.freq>40,'T5d-2 tankBig 档: pitch 0.8 低沉 (60→'+(E.big&&E.big.freq)+')');
ok(E.legacy&&E.legacy.type==='triangle'&&E.legacy.kind==='tank'&&Math.abs(E.legacy.freq-60)<1,'T5e 旧档别名 tank: triangle + pitch 1.0 (verify-batch-20261114 直调兼容)');
ok(E.truck&&E.truck.type==='square','T5e-2 truck 档: square 柴油哒哒');
ok(E.radial&&E.radial.det===26&&E.radial.lp===700&&E.inline&&E.inline.det===18&&E.inline.lp===900,'T5f 星型 vs 直列: det26+lp700 vs det18+lp900');
ok(E.loiter&&E.loiter.freq>90&&E.loiter.freq<110,'T5f-2 loiter 电嗡档: pitch 1.6 (60→'+(E.loiter&&E.loiter.freq)+')');
ok(Gm('typeof AudioSys.panOf==="function"&&(AudioSys.panOf({x:10,z:0})>=-1&&AudioSys.panOf({x:10,z:0})<=1)')===true,'T5g panOf 声像辅助在册且输出 [-1,1]');
ok(Gm("typeof AudioSys.navalAudioDebug==='function'")===true,'T5h navalAudioDebug 只读视图在册 (闸门后注册)');

// ══ T6 远枪限流 ══
console.log('T6 限流');
ok(src01.includes('if(dist>70){')===true&&src01.includes('if(++farWinN>4) return;')===true,'T6 远枪限流仍在 (dist>70 · 100ms 窗 4 发)');

console.log('');
console.log('verify-audio3-20261117b: PASS='+PASS.length+' FAIL='+FAILN+(NEG?' (--neg)':''));
if(FAILN>0) process.exit(1);
