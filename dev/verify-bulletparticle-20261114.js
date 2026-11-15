// ─────────────────────────────────────────────────────────────
// dev/verify-bulletparticle-20261114.js —— 2026-11-14 批⑥ 曳光截面方→圆验收
//   病灶: 打出的子弹粒子总是方形 (用户实报) —— tracerGeo 是 BoxGeometry(0.035,0.035,1.6),
//   从正后方 (射手视角沿弹道看) 侧影恒为 0.035 方块, 与"圆柱弹体/圆形光点"的预期不符。
//   修法: 改 8 段圆柱 CylinderGeometry(0.0175,0.0175,1.6,8,1) + 一次性 rotateX(HPI) 把圆柱
//   Y 轴烘到 Z 轴 (配 spawnTracer lookAt 的 +Z 弹道朝向约定); 半径 0.0175 与旧盒半宽一致,
//   池化 Mesh 复用与 340m/s 步进回池逻辑不动。
// 用法: node dev/verify-bulletparticle-20261114.js [--neg]
//   --neg = 阴性对照 (1 补丁): N1 曳光几何还原方盒 → 几何断言 ⑥-1/⑥-2 红。
// 口径: 与 verify-tvosd-headbonk-20261110 同款 boot; 行为断言直调 spawnTracer (单源出膛口)。
// ─────────────────────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const NEG=process.argv.includes('--neg');
const OK=[],BAD=[];
function assert(name,cond,detail){ (cond?OK:BAD).push(name); console.log(`  ${cond?'✓':'✗'} ${name}${detail?'  '+detail:''}`); }
function section(t){ console.log('\n══ '+t+' ══'); }
const SRC=f=>fs.readFileSync(path.join(root,f),'utf8');

const patchStyle=(el)=>{ if(el&&el.style&&typeof el.style.setProperty!=='function') el.style.setProperty=function(k,v){ this[k]=v; }; return el; };
const _stub=require('./_bootstub.js');
{
const document=_stub.document;
const g=document.getElementById.bind(document), c=document.createElement.bind(document), q=document.querySelector.bind(document);
document.getElementById=(id)=>patchStyle(g(id));
document.createElement=(t)=>patchStyle(c(t));
document.querySelector=(s)=>patchStyle(q(s));
}

// ── 阴性对照 (一律单行锚) ──
const PATCHES=[
 // N1 病灶还原: 曳光几何还原方盒 (方形侧影复现)
 ['js/08-effects.js','const tracerGeo=new THREE.CylinderGeometry(0.0175,0.0175,1.6,8,1); tracerGeo.rotateX(HPI);','const tracerGeo=new THREE.BoxGeometry(0.035,0.035,1.6); // NEG N1'],
];
const PATCH_MAP={};
if(NEG) for(const [f,from,to] of PATCHES){
 const s=PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f);
 if(s.indexOf(from)<0) throw new Error('阴性对照锚点未找到: '+f+' :: '+from.slice(0,70));
 PATCH_MAP[f]=s.split(from).join(to);
}
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f));

// ── ① 源码防回退 ─────────────────────────────────────────────
section('① 源码防回退 (圆柱几何 + 旧方盒绝迹)');
{
const s08=srcOf('js/08-effects.js');
assert('08-effects: tracerGeo = 8 段圆柱 r0.0175 长1.6 + rotateX(HPI) 烘 Z 轴 (批⑥注释在)',
 s08.includes('const tracerGeo=new THREE.CylinderGeometry(0.0175,0.0175,1.6,8,1); tracerGeo.rotateX(HPI);')
 &&s08.includes('★2026-11-14 批⑥: 曳光截面方→圆'));
assert('08-effects: 旧方盒曳光绝迹 (0.035 方盒不再用于 tracer)',
 !s08.includes('BoxGeometry(0.035,0.035,1.6)'));
assert('08-effects: 池化与步进账不动 (tracerPool 复用 + 340m/s 回池)',
 s08.includes('const tracers=[], tracerPool=[];')
 &&s08.includes('const spd=340;')
 &&s08.includes('t.traveled+=step;')
 &&s08.includes('if(t.traveled>=t.max){ t.m.visible=false; tracerPool.push(t.m); tracers.splice(i,1); continue; }'));
}

// ── 沙箱装载 (真 three; 与 verify-tvosd 同款 boot) ──────────
function loadRealTHREE(){
	const m={exports:{}};
	const s={console,Math,JSON,Date,module:m,exports:m.exports,self:null,globalThis:null,
		window:{addEventListener(){},removeEventListener(){},devicePixelRatio:1},
		document:{createElementNS:()=>({style:{}}),createElement:()=>({style:{},getContext:()=>null})},
		navigator:{userAgent:'node'},requestAnimationFrame:()=>0,cancelAnimationFrame(){},performance:{now:()=>Date.now()},
		setTimeout:()=>0,clearTimeout(){},URL:{createObjectURL(){return ''},revokeObjectURL(){}},Blob:function(){},Image:function(){},
	};
	s.self=s; s.globalThis=s;
	vm.createContext(s);
	vm.runInContext(fs.readFileSync(path.join(root,'dev/vendor/three.min.js'),'utf8'),s,{filename:'dev/vendor/three.min.js'});
	return m.exports;
}
const html=SRC('index.html');
const FILES=[...html.matchAll(/src="(js\/[^"?]+)/g)].map(m=>m[1]);
function boot(campIdx){
	const T=loadRealTHREE();
	T.WebGLRenderer=class{ constructor(){ this.domElement=Object.assign(document.createElement('canvas'),{width:0,height:0}); this.shadowMap={enabled:false,type:0,autoUpdate:true};
		this.setSize=()=>{}; this.setPixelRatio=()=>{}; this.render=()=>{}; this.clear=()=>{}; this.clearDepth=()=>{};
		this.outputColorSpace=''; this.setClearColor=()=>{}; this.setAnimationLoop=()=>{}; } };
	const stub=_stub;
	const sandbox=stub.sandbox,document=stub.document,window=stub.window;
	sandbox.THREE=T; sandbox.window.THREE=T;
	const V3c=T.Vector3;
	if(!V3c.prototype.addScalar) V3c.prototype.addScalar=function(s){ this.x+=s; this.y+=s; this.z+=s; return this; };
	if(!V3c.prototype.divideScalar) V3c.prototype.divideScalar=function(s){ s=s||1; this.x/=s; this.y/=s; this.z/=s; return this; };
	T.Object3D.prototype.clear=function(){ this.children.length=0; return this; };
	const AP=()=>({value:0,setValueAtTime(){},setTargetAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}});
	class ACStub{
	createOscillator(){ return {frequency:AP(),detune:AP(),type:'',start(){},stop(){},connect(){},onended:null}; }
	createGain(){ return {gain:AP(),connect(){},disconnect(){}}; }
	createBuffer(){ return {getChannelData:()=>new Float32Array(16),duration:1,numberOfChannels:1}; }
	createBufferSource(){ return {buffer:null,loop:false,playbackRate:AP(),start(){},stop(){},connect(){},onended:null}; }
	createBiquadFilter(){ return {type:'',frequency:AP(),detune:AP(),Q:AP(),connect(){}}; }
	createDynamicsCompressor(){ return {threshold:AP(),ratio:AP(),attack:AP(),release:AP(),connect(){}}; }
	createStereoPanner(){ return {pan:AP(),connect(){}}; }
	resume(){ return Promise.resolve(); } get state(){ return 'running'; } get destination(){ return {}; }
	get currentTime(){ return 0; } get sampleRate(){ return 44100; }
	}
	sandbox.AudioContext=ACStub; sandbox.window.AudioContext=ACStub; sandbox.window.webkitAudioContext=ACStub;
	delete sandbox.window.CANNON;
	const byId={};
	const ctx=vm.createContext(Object.assign({},sandbox));
	ctx.document=Object.assign({},document,{getElementById:id=>{ if(!byId[id]){ byId[id]=document.createElement('div'); byId[id].id=id; } return byId[id]; }});
	const listeners={};
	const addL=(t,f)=>{ (listeners[t]=listeners[t]||[]).push(f); };
	ctx.addEventListener=addL; ctx.removeEventListener=()=>{};
	ctx.document.addEventListener=addL; ctx.document.removeEventListener=()=>{};
	ctx.window=Object.assign({},window,{addEventListener:addL,removeEventListener(){}});
	ctx.dispatchEvent=ev=>{ if(!ev.preventDefault) ev.preventDefault=()=>{}; if(!ev.stopPropagation) ev.stopPropagation=()=>{}; for(const f of (listeners[ev.type]||[]).slice()) f(ev); return true; };
	ctx.KeyboardEvent=class{ constructor(t,o){ o=o||{}; this.type=t; this.code=o.code; this.repeat=!!o.repeat; } };
	ctx.MouseEvent=class{ constructor(t,o){ o=o||{}; this.type=t; this.button=o.button; } };
	ctx.globalThis=ctx;
	ctx.setTimeout=(f)=>{ try{ f(); }catch(e){ console.log('  [异步桩] '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | ')); } return 0; };
	ctx.clearTimeout=()=>{};
	ctx.localStorage={_s:{sf_campaign:String(campIdx),sf_exp:'1',sf_pseed:'424242'},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
	for(const f of FILES){ vm.runInContext(srcOf(f),ctx,{filename:f}); }
	return ctx;
}
const ctx=boot(0);
const G=s=>vm.runInContext(s,ctx,{timeout:300000});
let err=null;
try{ G("document.getElementById('startBtn').onclick();"); }catch(e){ err='start: '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); }
if(!err) try{ G("player.team=0; player.cls=0; player.spectator=false; player.alive=true; player.deployed=true; player.hp=100;"); }catch(e){ err='playerInit: '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); }
assert('② 前置: 开局+玩家就位',!err&&G('typeof spawnTracer==="function"')===true,err||'');

// ── ⑥ 行为: 出膛曳光几何 ─────────────────────────────────────
section('⑥ 行为: spawnTracer 出膛曳光 = 圆柱截面 + 弹道朝向 + 池化回池');
{
// ⑥-1 直调单源出膛口 spawnTracer (玩家位沿 -Z 打 80m), 检查活体曳光的几何参数与包围盒。
G("globalThis._t0={x:player.pos.x,y:player.pos.y+1.4,z:player.pos.z};"
 +"spawnTracer(new THREE.Vector3(_t0.x,_t0.y,_t0.z),new THREE.Vector3(0,0,-1),80,player);"
 +"globalThis._tr=tracers[0]; _tr.m.geometry.computeBoundingBox();"
 +"globalThis._bb=_tr.m.geometry.boundingBox, _gp=_tr.m.geometry.parameters;");
const gp=G('_gp');
assert('⑥-1 活体曳光 = 圆柱 (radiusTop=radiusBottom=0.0175, 8 段, 高 1.6)',
 gp&&gp.radiusTop===0.0175&&gp.radiusBottom===0.0175&&gp.radialSegments===8&&gp.height===1.6,
 gp?`r=${gp.radiusTop} seg=${gp.radialSegments} h=${gp.height}`:'无 parameters');
// ⑥-2 包围盒: 长轴在 Z (rotateX(HPI) 已把圆柱 Y 轴烘到 Z) —— 截面 0.035×0.035 → 从正后方看是
//   8 边形圆 (对径 0.035), 不是方块; 旧方盒同包围盒但侧面恒方块, 圆柱才对。
const bb=G('_bb');
assert('⑥-2 包围盒长轴在 Z (1.6) / 截面 X·Y 各 0.035 (rotateX 已烘)',
 bb&&Math.abs((bb.max.z-bb.min.z)-1.6)<1e-6&&Math.abs((bb.max.x-bb.min.x)-0.035)<1e-6&&Math.abs((bb.max.y-bb.min.y)-0.035)<1e-6,
 bb?`z=${(bb.max.z-bb.min.z).toFixed(3)} x=${(bb.max.x-bb.min.x).toFixed(3)} y=${(bb.max.y-bb.min.y).toFixed(3)}`:'无 bb');
// ⑥-3 弹道朝向: three.js 普通物体 lookAt 是**本地 +Z 指向目标** (相机才是 -Z) —— 弹头侧 +Z 对准 dir。
// 判据用**手写四元数向量旋转** (v' = v + w·t + q×t, t = 2·q×v, 纯算术零库调用 —— 沙箱向量桩
// applyQuaternion 失真/欧拉分解不唯一 双坑都绕开): q=(0,1,0,0) 转 (0,0,1) ⇒ 期望 (0,0,-1)。
G("(()=>{ const q=_tr.m.quaternion, vx=0, vy=0, vz=1;"
 +"const tx=2*(q.y*vz-q.z*vy), ty=2*(q.z*vx-q.x*vz), tz=2*(q.x*vy-q.y*vx);"
 +"globalThis._fx=vx+q.w*tx+(q.y*tz-q.z*ty); globalThis._fy=vy+q.w*ty+(q.z*tx-q.x*tz); globalThis._fz=vz+q.w*tz+(q.x*ty-q.y*tx); })()");
assert('⑥-3 lookAt 朝向: 本地 +Z 经四元数旋转 ≈ dir (0,0,-1) (弹头指向射向)',
 (()=>{ const fx=G('_fx'), fy=G('_fy'), fz=G('_fz');
   return Math.abs(fz+1)<1e-5&&Math.abs(fx)<1e-5&&Math.abs(fy)<1e-5; })(),
 `fwd=(${G('_fx').toFixed(4)},${G('_fy').toFixed(4)},${G('_fz').toFixed(4)}) q=(${G('_tr.m.quaternion.x').toFixed(3)},${G('_tr.m.quaternion.y').toFixed(3)},${G('_tr.m.quaternion.z').toFixed(3)},${G('_tr.m.quaternion.w').toFixed(3)})`);
// ⑥-4 步进回池: 340m/s × 1s ≥ 80m → 当帧回池 (池化复用链不动)。
G("globalThis._p0n=tracerPool.length; updateTracers(1,1);");
assert('⑥-4 步进回池: traveled≥max 当帧回池 (tracers 空 / pool +1)',
 G('tracers.length')===0&&G('tracerPool.length')===G('_p0n')+1,`tracers=${G('tracers.length')} pool=${G('tracerPool.length')}/${G('_p0n')}`);
// ⑥-5 复用: 第二发出膛直接吃池里的 Mesh (零 new) —— 池化档复用同一条圆柱几何。
G("spawnTracer(new THREE.Vector3(_t0.x,_t0.y,_t0.z),new THREE.Vector3(0,0,-1),80,player);");
assert('⑥-5 池化复用: 第二发出膛吃池 (tracers=1, 几何仍是圆柱)',
 G('tracers.length')===1&&G('tracers[0].m.geometry.parameters.radialSegments')===8,`tracers=${G('tracers.length')}`);
G("updateTracers(1,1);");
assert('⑥-6 探针卫生: 曳光清空',G('tracers.length')===0&&G('tracerPool.length')===G('_p0n')+1,`pool=${G('tracerPool.length')}/${G('_p0n')}`);
}

// ── 汇总 ─────────────────────────────────────────────────────
console.log('\n──────────────────────────────');
console.log(`  ${NEG?'NEG':'正向'} ${OK.length} 绿 / ${BAD.length} 红`);
if(BAD.length){ console.log('  红名: '+BAD.join(' · ')); process.exitCode=1; }
