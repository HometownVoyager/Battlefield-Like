// ─────────────────────────────────────────────
// dev/verify-audio2-20261115.js —— 全套音效重制批 (2026-11-15)
// 用法: node dev/verify-audio2-20261115.js [--neg]
// 判据:
//   T1 契约不破: 闸门 bypass Set 原样 / naval 段逐字锚 (navalAudioTick 定义+挂 api / navalAudEngine
//      只写 osc.type·osc2.detune·lp.frequency) / splash 四参签名 / 引擎节点名 osc·osc2·g·lp 原样保留。
//   T2 引擎三层化: osc3 次八度 + ns→nbp→ng2 纹理噪声支路在册; update 频率三振荡器齐写; stop 真停不炸。
//   T3 splash 重制层: 裂响带通 f0 公式 (尺寸/速度双调制) / 咕咚滑音 / spd>6 嘶声 / big 回浪 —— 源码锚。
//   T4 枪声/爆炸重制层: 第二裂响带通 (P.crack*1.6) / 中频"体"层 (P.body*7+520) / 次声重锤 58→18Hz。
//   T5 行为: init 后 splash 四参不炸; createEngine 三层节点在册 + update + stop 无异常;
//      audioDebug 只读视图在册; 海战 audioDebug 同在册。
//   --neg: N1 引擎节点表拆 (T2 osc3 红) / N2 splash 签名回退 (T3a 锚红) / N3 bypass 摘 setUnderwater (T1a 红)。
// 沙箱要点承 verify-airfix-20261114; AudioContext 桩 (_bootstub) 足以跑 AudioSys.init。
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

// ── NEG 阴性对照: 三补丁累积注入 (正常跑不启用) ──
const NEG=process.argv.includes('--neg');
const SRC={},PATCH_MAP={};
const NEG_PATCHES=[
// N1 引擎节点表拆 (osc3/ns 摘除): T2a/T2b 红
['js/01-audio.js','e.nodes={osc,osc2,g,lp,osc3,ns,nbp,ng2};','e.nodes={osc,osc2,g,lp};'],
// N2 splash 签名回退 (spd 参摘除): T3a 红
['js/01-audio.js','function splash(dist=0, big=false, size=1, spd=0){','function splash(dist=0, big=false){'],
// N3 bypass 摘 setUnderwater (闸门面残缺): T1a 红
['js/01-audio.js',"'createEngine','setUnderwater'","'createEngine'"],
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
let IDX=0; { const c0=boot(0); IDX=vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="normandy")',c0); }
const ctx=boot(IDX);
const G=s=>vm.runInContext(s,ctx);
let err0=null;
try{ G("document.getElementById('startBtn').onclick();"); }catch(e){ err0=String(e&&e.stack||e); }
if(!err0){ try{ G('if(!player.alive||!player.deployed) deployPlayer();'); }catch(e){ err0='deployPlayer: '+String(e&&e.stack||e); } }
if(err0||!G('player.alive')){ console.log('  ✘ 开局/部署失败 '+(err0||'player.alive=false')); process.exit(1); }
ok(html.includes("__sfStyleVer='20261115b'"),'前置: 版本戳 20261115b 在位 (index.html 内联)');

// ══ T1 契约不破 ══
console.log('T1 契约: bypass Set / naval 段 / splash 签名');
const src01=srcOf('js/01-audio.js');
ok(src01.includes("const bypass=new Set(['init','resume','setVol','setAmbientMute','stopAll','restoreAll','isSilenced','audioDebug','createEngine','setUnderwater','updateWeatherAmbient','setTimeFrozenMute','audioTimeFrozen']);")===true,'T1a ★闸门 bypass Set 13 键 verbatim (静音/冻结账契约面)');
ok(src01.includes('function navalAudioTick(dt,ownDt){')===true&&src01.includes('api.navalAudioTick=navalAudioTick;')===true,'T1b naval 段: navalAudioTick(dt,ownDt) 定义 + 挂 api 双锚 verbatim');
ok(src01.includes('if(n.osc&&n.osc.type!==undefined&&n.osc.type!==T.type) n.osc.type=T.type;')===true&&src01.includes('n.osc2.detune.setTargetAtTime(T.det,t0,0.3);')===true&&src01.includes('n.lp.frequency.setTargetAtTime(T.lp,t0,0.25);')===true,'T1c navalAudEngine 只写 osc.type/osc2.detune/lp.frequency 三处 verbatim (海战音色塑形契约)');
ok(src01.includes('function splash(dist=0, big=false, size=1, spd=0){')===true,'T1d ★splash 四参签名 verbatim (旧调用 splash(dist,big) 全兼容)');
ok(src01.includes('e.nodes.osc.frequency.setTargetAtTime(freq,t0,0.12);')===true&&src01.includes('e.nodes.osc2.frequency.setTargetAtTime(freq*0.5,t0,0.12);')===true,'T1e 引擎 osc/osc2 频率写法原样 (节点名契约面)');

// ══ T2 引擎三层化 ══
console.log('T2 引擎: osc3 次八度 + 纹理噪声支路');
ok(src01.includes('e.nodes={osc,osc2,g,lp,osc3,ns,nbp,ng2};')===true,'T2a ★节点表含 osc3/ns/nbp/ng2 verbatim');
ok(src01.includes("if(e.nodes.osc3) e.nodes.osc3.frequency.setTargetAtTime(freq*0.25,t0,0.12);")===true,'T2b update 次八度随转速 (freq*0.25) verbatim');
ok(src01.includes("if(e.nodes.ng2) e.nodes.ng2.gain.setTargetAtTime(e.lastVol*(e.kind==='plane'?0.5:0.35),t0,0.12);")===true,'T2c 纹理噪声电平随音量 (plane 0.5/其余 0.35) verbatim');

// ══ T3/T4 重制层源码锚 ══
console.log('T3/T4 重制层锚');
ok(src01.includes('const f0=(big?2300:2900)/Math.sqrt(sz)*(1+spC*0.012);')===true,'T3a ★splash 裂响 f0 双调制 (尺寸降/速度抬) verbatim');
ok(src01.includes('if(spC>6){')===true&&src01.includes('gr.gain.setValueAtTime(0.0001,t0+0.18);')===true,'T3b 嘶声门 (spd>6) + 大物回浪 (+0.18s 低通拍岸) 双层在册');
ok((src01.match(/bp1b/g)||[]).length>=2,'T4a 枪声第二裂响带通 bp1b (P.crack*1.6) 在册');
ok(src01.includes('bm.frequency.value=P.body*7+520;')===true,'T4b 枪声中频体层 (P.body*7+520) verbatim');
ok(src01.includes('o.frequency.setValueAtTime(58,t0); o.frequency.exponentialRampToValueAtTime(18,t0+1.4);')===true,'T4c ★爆炸次声重锤 (58→18Hz/1.4s) verbatim');

// ══ T5 行为 ══
console.log('T5 行为: init/splash/engine 全链');
G("_initErr=null; try{ if(typeof AudioSys.init==='function') AudioSys.init(); }catch(e){ _initErr=String(e&&e.stack||e); }");
ok(G('_initErr')===null,'T5-prep AudioSys.init 无异常 (AudioContext 桩)');
let errT5=null;
try{ G("AudioSys.splash(12,true,2.2,18); AudioSys.splash(3,false,0.8,0);"); }catch(e){ errT5=String(e&&e.stack||e); }
ok(errT5===null,'T5a ★splash 四参调用无异常 (大物高速档+士兵慢速档)');
G("_engErr=null; _eng=null; try{ if(AudioSys.isSilenced&&AudioSys.isSilenced()) AudioSys.restoreAll(); if(AudioSys.setTimeFrozenMute) AudioSys.setTimeFrozenMute(false); _eng=AudioSys.createEngine('tank'); _eng.update(30,0.1); _eng.update(42,0.15); _nd=_eng.nodes; _eng.stop(); }catch(e){ _engErr=String(e&&e.stack||e); }");
ok(G('_engErr')===null,'T5b createEngine+update×2+stop 无异常'+(G('_engErr')?' ('+G('_engErr')+')':''));
ok(G('_nd&&!!_nd.osc3&&!!_nd.ns&&!!_nd.nbp&&!!_nd.ng2')===true,'T5c ★运行期节点表: osc3/ns/nbp/ng2 四新节点真实在册 (stop 前快照)');
ok(G('_nd&&!!_nd.osc&&!!_nd.osc2&&!!_nd.g&&!!_nd.lp')===true,'T5d 契约节点 osc/osc2/g/lp 同在册 (旧消费方不受影响)');
ok(G("typeof AudioSys.audioDebug==='function'")===true,'T5e audioDebug 只读视图在册 (闸门后注册)');
ok(G("typeof AudioSys.isSilenced==='function'&&typeof AudioSys.setTimeFrozenMute==='function'")===true,'T5f 静默/冻结账 API 在册');

console.log('');
console.log('verify-audio2-20261115: PASS='+PASS.length+' FAIL='+FAILN+(NEG?' (--neg)':''));
if(FAILN>0) process.exit(1);
