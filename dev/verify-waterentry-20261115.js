// ─────────────────────────────────────────────
// dev/verify-waterentry-20261115.js —— 入水特效/音效批 (2026-11-15)
// 用法: node dev/verify-waterentry-20261115.js [--neg]
// 判据:
//   T1 waterSplash 单元: 粒子档位 —— 基础 5 滴+1 团雾 (spd=0)=6 发; spd=12 加 5 滴+白沫冠 3 发=14 发;
//      big+bubbles=24 发; AudioSys.splash 四参透传 (dist,big,size,spdC)。
//   T2 Bot 入水跃迁 (14-bots moveDir): dry→wet 边沿发 splash, 强度随相邻帧落差 (大落差 scale 顶格 2.2+big);
//      水里连续帧不重发 (_wStatePrev 跃迁账); 出水再入水重发。
//   T3 坦克入水 (15-vehicles update): 车体级 3.4/big/气泡, _wasInWater 跃迁账出水重入重发。
//   T4 卡车入水 (15b): 源码锚 + 行为 (若有 truck) scale 2.6。
//   T5 飞机触水坠机 (16-aircraft update): 先溅后毁 (big=true+气泡+强度随下沉率)。
//   T6 源码防回退锚 (四消费点 + splash 签名 + 音频透传行)。
//   --neg: N1 Bot 边沿拆 / N2 坦克门拆 / N3 飞机溅水拆。
// 场地: 淞沪 (主河深水)。沙箱要点承 verify-airfix-20261114; spy=函数声明重绑 (waterSplash/spawnP 皆
//   function 声明, vm 顶层可重绑, 调用点经全局绑定解析) + AudioSys.splash 属性包裹。
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
// N1 Bot 边沿拆: T2 红水花永不发
['js/14-bots.js','if(WS.state!==wPrev){','if(false){'],
// N2 坦克门拆: T3 红车体溅水永不发
['js/15-vehicles.js','if(inW&&!wasW&&this.alive){','if(false){'],
// N3 飞机溅水拆: T5 红触水坠机无溅
['js/16-aircraft.js','if(typeof waterSplash===\'function\') waterSplash(V3(this.pos.x,wyQ+0.2,this.pos.z),clamp(2.2+spd*0.10,2.2,4.2),true,true,spd);',';'],
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
let IDX=0; { const c0=boot(0); IDX=vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="songhu")',c0); }
const ctx=boot(IDX);
const G=s=>vm.runInContext(s,ctx);
let err0=null;
try{ G("document.getElementById('startBtn').onclick();"); }catch(e){ err0=String(e&&e.stack||e); }
if(!err0){ try{ G('if(!player.alive||!player.deployed) deployPlayer();'); }catch(e){ err0='deployPlayer: '+String(e&&e.stack||e); } }
if(err0||!G('player.alive')){ console.log('  ✘ 开局/部署失败 '+(err0||'player.alive=false')); process.exit(1); }
G('for(const s of soldiers) s.protUntil=0; player.protUntil=0;');
ok(html.includes("__sfStyleVer='20261118a'"),'前置: 版本戳 20261118a 在位 (index.html 内联)');

// ── spy 安装: waterSplash/spawnP 重绑 + AudioSys.splash 包裹 ──
G("const _wsOrig=waterSplash; const _spOrig=spawnP; const _asOrig=AudioSys.splash; _wsCalls=[]; _spN=0; _asCalls=[];"+
"waterSplash=(p,scale,big,bub,spd)=>{ _wsCalls.push({scale:scale,big:!!big,bub:!!bub,spd:spd||0}); _spN=0; _wsOrig(p,scale,big,bub,spd); _wsCalls[_wsCalls.length-1].parts=_spN; };"+
"spawnP=(...a)=>{ _spN++; return _spOrig(...a); };"+
"AudioSys.splash=(d,b,s,sp)=>{ _asCalls.push({d:d,b:!!b,s:s,sp:sp||0}); return _asOrig(d,b,s,sp); };");
ok(G('_wsCalls.length===0')===true,'前置: spy 已挂 (无既有溅水账)');

// ── 深水点 ──
G("_wp=null; { const R=MAP_SIZE/2-40; for(let z=-R;z<=R&&!_wp;z+=6)for(let x=-R;x<=R;x+=6){ const wy=waterYAt(x,z); if(wy<=-1e8) continue; const d=wy-heightAt(x,z,true); if(d>1.9){ _wp={x:x,z:z,wy:wy,d:d}; break; } } }");
ok(G('!!_wp')===true,'场地: 深水点已找到 (depth='+G('_wp?_wp.d.toFixed(2):"-1"')+'m)');

// ══ T1 waterSplash 单元 ══
console.log('T1 waterSplash 单元: 粒子档位 + 音频四参透传');
G("waterSplash(V3(_wp.x,_wp.wy,_wp.z),1,false,false,0); _t1a=_wsCalls[_wsCalls.length-1];");
G("waterSplash(V3(_wp.x,_wp.wy,_wp.z),1,false,false,12); _t1b=_wsCalls[_wsCalls.length-1];");
G("waterSplash(V3(_wp.x,_wp.wy,_wp.z),1.5,true,true,0); _t1c=_wsCalls[_wsCalls.length-1];");
ok(G('_t1a.parts===6')===true,'T1a ★慢速小物: 5 滴+1 团雾 = 6 发 (实得 '+G('_t1a.parts')+')');
ok(G('_t1b.parts===14')===true,'T1b ★spd=12: +5 滴 (0.4/m) + 白沫冠 3 = 14 发 (实得 '+G('_t1b.parts')+')');
ok(G('_t1c.parts===24')===true,'T1c big+bubbles: 10+3 滴+雾+冠+7 气泡 = 24 发 (实得 '+G('_t1c.parts')+')');
G("_as0=_asCalls[1];");
ok(G('_as0&&_as0.sp===12&&_as0.b===false&&Math.abs(_as0.s-1)<0.01')===true,'T1d ★AudioSys.splash 四参透传 (spdC=12/big/size=1) —— 音效强度跟入水速度');

// ══ T2 Bot 入水跃迁 ══
console.log('T2 Bot: dry→wet 边沿溅水 / 连续帧不重发 / 出水重入重发');
G("_bot=soldiers.find(s=>s.alive&&s!==player); _bot.pos.set(_wp.x,_wp.wy+6,_wp.z); _bot._wStatePrev=undefined; _bot._wyPrev=undefined; _wsCalls.length=0; _bot.moveDir(0,0,1/60); _t2a=_wsCalls.length;");
ok(G('_t2a')===0,'T2a 悬在水面 6m 上方 (dry) 不溅 (水花只认湿态边沿)');
G("_bot.pos.y=_wp.wy-0.4; _bot.moveDir(0,0,1/60); _t2b=_wsCalls.length; _c2b=_wsCalls[_wsCalls.length-1]||{};");
ok(G('_t2b===1')===true,'T2b ★入水 (dry→wet) 发一次溅水');
ok(G('_c2b.scale===2.2&&_c2b.big===true')===true,'T2c ★大落差 (6m→水下 0.4m, spd 顶格) scale 2.2 + big —— 强度随入水速度');
ok(G('_c2b.bub===false')===true,'T2d 士兵档不带水下气泡 (气泡=载具/飞机档)');
G("_bot.moveDir(0,0,1/60); _t2e=_wsCalls.length;");
ok(G('_t2e===1')===true,'T2e 连续湿帧不重发 (_wStatePrev 跃迁账)');
G("_bot.pos.y=_wp.wy+3; _bot.moveDir(0,0,1/60); _bot.pos.y=_wp.wy-0.2; _bot.moveDir(0,0,1/60); _t2f=_wsCalls.length;");
ok(G('_t2f===2')===true,'T2f ★出水再入水重发 (第二朵水花)');

// ══ T3 坦克入水 ══
console.log('T3 坦克: 车体级 3.4/big/气泡 + _wasInWater 跃迁账');
G("_tk=tanks.find(t=>t.alive); _tk._wasInWater=undefined; _tk.pos.set(_wp.x,_wp.wy+0.5,_wp.z); _wsCalls.length=0; _tk.update(1/60); _t3a=_wsCalls.length; _c3a=_wsCalls[_wsCalls.length-1]||{};");
ok(G('_t3a===1')===true,'T3a ★坦克入水发一次车体级溅水');
ok(G('_c3a.scale===3.4&&_c3a.big===true&&_c3a.bub===true')===true,'T3b scale 3.4 + big + 水下气泡 (406mm 落水同量级)');
G("_tk.update(1/60); _t3c=_wsCalls.length;");
ok(G('_t3c===1')===true,'T3c 连续帧不重发 (_wasInWater 跃迁账)');

// ══ T4 卡车入水 ══
console.log('T4 卡车');
if(G('trucks.some(t=>t.alive)')){
G("_trErr=null; _tr=trucks.find(t=>t.alive); _tr._wasInWater=undefined; _tr.pos.set(_wp.x,_wp.wy+0.5,_wp.z); _wsCalls.length=0; try{ _tr.update(1/60); }catch(e){ _trErr=String(e&&e.stack||e); } _t4a=_wsCalls.length; _c4a=_wsCalls[_wsCalls.length-1]||{};");
ok(G('_t4a===1&&!_trErr')===true,'T4a 卡车入水发一次溅水'+(G('_trErr')?' (err='+G('_trErr')+')':''));
ok(G('Math.abs(_c4a.scale-2.6)<0.01')===true,'T4b scale 2.6 档 (介于士兵与坦克之间)');
}else{
ok(true,'T4 场上无活卡车 —— 行为档跳过 (源码锚 T6e 兜底)');
}

// ══ T5 飞机触水坠机 ══
console.log('T5 飞机: 先溅后毁');
G("_plErr=null; _pl=planes.find(p=>p.alive); _plOldDie=_pl.die.bind(_pl); _dieN=0; _pl.die=(a,b,c)=>{ _dieN++; }; _pl.pos.set(_wp.x,_wp.wy+1.2,_wp.z); _pl.speed=0; _pl._wyPrev=undefined; _wsCalls.length=0; try{ _pl.update(1/60); }catch(e){ _plErr=String(e&&e.stack||e); } _t5a=_wsCalls.length; _c5a=_wsCalls[_wsCalls.length-1]||{};");
ok(G('_t5a===1&&!_plErr')===true,'T5a ★触水坠机先溅 (水花一次)'+(G('_plErr')?' (err='+G('_plErr')+')':''));
ok(G('_c5a.big===true&&_c5a.bub===true&&_c5a.scale>=2.2&&_c5a.scale<=4.2')===true,'T5b 机级档: big+气泡+scale 2.2~4.2 (实得 '+G('_c5a.scale')+')');
ok(G('_dieN===1')===true,'T5c 溅水后 crash die 照常 (先溅后毁, die 被 spy 接住)');

// ══ T6 源码锚 ══
console.log('T6 源码锚');
const src08=srcOf('js/08-effects.js'),src14=srcOf('js/14-bots.js'),src15=srcOf('js/15-vehicles.js'),src15b=srcOf('js/15b-trucks.js'),src16=srcOf('js/16-aircraft.js');
ok(src08.includes('function waterSplash(p,scale=1,big=false,bubbles=false,spd=0){')===true,'T6a ★waterSplash 五参签名 (spd=入水速度) verbatim');
ok(src08.includes('AudioSys.splash(p.distanceTo(camera.position),big,clamp(scale,0.5,4),spdC);')===true,'T6b 音频透传行 verbatim (scale/spd 双强度)');
ok(src14.includes('const spd=(this._wyPrev!==undefined&&dt>0)?Math.max(0,(this._wyPrev-this.pos.y)/dt):0;')===true,'T6c Bot 落差折算行 verbatim (14-bots)');
ok(src15.includes('waterSplash(V3(this.pos.x,wy+0.1,this.pos.z),3.4,true,true);')===true,'T6d 坦克车体档 verbatim');
ok(src15b.includes('const wasW=!!this._wasInWater;')===true&&src15b.includes('if(inW&&!wasW&&this.alive){')===true,'T6e 卡车跃迁账+门 verbatim');
ok(src16.includes('clamp(2.2+spd*0.10,2.2,4.2)')===true,'T6f 飞机强度随下沉率 verbatim');

console.log('');
console.log('verify-waterentry-20261115: PASS='+PASS.length+' FAIL='+FAILN+(NEG?' (--neg)':''));
if(FAILN>0) process.exit(1);
