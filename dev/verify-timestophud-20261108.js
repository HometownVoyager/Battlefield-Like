// ─────────────────────────────────────────────────────────────
// dev/verify-timestophud-20261108.js —— 2026-11-08 时停HUD批 (时停中小地图/罗盘随观察者重绘) 验收
//   实机反馈: 时停状态下地图不会更新 —— 10Hz 低频HUD段 (hudSlowT 节流) 旧吃世界 dt, 时停 dt=0 ⇒
//   小地图/罗盘/顶栏彻底停绘, 而观察者本人仍在走动/飞行 (2026-09-27 裁定"冻战场不冻观察者"的 HUD 侧推论)。
//   修法: 24-main updateHUD(dt,pdt) 传观察者帧长; 22-hud 节流钟 hudSlowT-=(pdt===undefined?dt:pdt)。
//   ① 行为: 时停中转动/平移观察者 40 帧 ⇒ drawMinimap/drawCompass 照常重绘 (~10Hz, ≥5 次);
//   ② 对照: 非时停普通帧节流照常 (≥2 次 / 20 帧) —— 修的是"冻结期停绘", 不是把节流拆了;
//   ③ 单实参退化: 旧口径 updateHUD(0) (无第二实参, 旧探针直调同款) 依旧不重绘 —— 退化路径零漂移;
//   ④ 源码钉: 24-main 实参 / 22-hud 签名+节流行 / 版本戳 20261117b。
// 用法: node dev/verify-timestophud-20261108.js [--neg]
//   --neg = 阴性对照 (3 补丁累积应用, 对认按红名): N1 节流行还原 hudSlowT-=dt ⇒ ①行为红;
//           N2 24-main 实参还原 updateHUD(dt) ⇒ ①源码钉红; N3 签名摘 pdt ⇒ ①钉红+①行为红。
//           ②对照与③退化在 NEG 下仍绿 (恢复类断言)。
// 口径: 与 verify-loiterfreeze-20261107 同款 boot (真 three + index.html 全脚本链 + startBtn 开局),
//       观战者部署走 verify-timestopfix 同款咒语 (cls=3 + spectator + specUsed)。
// ─────────────────────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const NEG=process.argv.includes('--neg');
const OK=[],BAD=[];
function assert(name,cond,detail){ (cond?OK:BAD).push(name); console.log(`  ${cond?'✓':'✗'} ${name}${detail?'  '+detail:''}`); }
function section(t){ console.log('\n══ '+t+' ══'); }
const SRC=f=>fs.readFileSync(path.join(root,f),'utf8');

// 桩忠实化 (verify-timestopfix 同款, 本探针要跑 updateHUD): 共享桩的 style 只是 `{}` ⇒ hudStyle 一碰
// 自定义属性 (--gap 之类) 就抛 setProperty is not a function —— 桩不忠实, 不是被测代码的问题。
const patchStyle=(el)=>{ if(el&&el.style&&typeof el.style.setProperty!=='function') el.style.setProperty=function(k,v){ this[k]=v; }; return el; };
const _stub=require('./_bootstub.js');
{
const document=_stub.document;
const g=document.getElementById.bind(document), c=document.createElement.bind(document), q=document.querySelector.bind(document);
document.getElementById=(id)=>patchStyle(g(id));
document.createElement=(t)=>patchStyle(c(t));
document.querySelector=(s)=>patchStyle(q(s));
}

// ── 阴性对照 (单行锚) ──
const PATCHES=[
 // N1 病灶还原: 节流钟退回只吃世界 dt (时停里地图冻死)
 ['js/22-hud.js','hudSlowT-=(pdt===undefined?dt:pdt);','hudSlowT-=dt;'],
 // N2 主循环实参还原: 不传观察者帧长 (沙箱直调带双参的行为判据不受影响, 由源码钉看住)
 ['js/24-main.js','updateHUD(dt,pdt);','updateHUD(dt);'],
 // N3 签名还原: pdt 收不进来 ⇒ 双参调用也退化 (①行为红)
 ['js/22-hud.js','function updateHUD(dt,pdt){','function updateHUD(dt){'],
];
const PATCH_MAP={};
if(NEG) for(const [f,from,to] of PATCHES){
 const s=PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f);
 if(s.indexOf(from)<0) throw new Error('阴性对照锚点未找到: '+f+' :: '+from.slice(0,70));
 PATCH_MAP[f]=s.split(from).join(to);
}
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f));

// ── ① 源码防回退 ─────────────────────────────────────────────
section('① 源码防回退 (修好的写法在 / 旧写法不在)');
{
const s24=srcOf('js/24-main.js'), s22=srcOf('js/22-hud.js');
assert('24 主循环传观察者帧长 (updateHUD(dt,pdt) 恰 1 处)',(s24.match(/updateHUD\(dt,pdt\);/g)||[]).length===1);
assert('22 updateHUD 签名带 pdt (单实参旧调用退化 dt)',s22.includes('function updateHUD(dt,pdt){'));
assert('22 节流钟吃观察者帧长 (新行在 / 旧 hudSlowT-=dt 绝迹)',
 s22.includes('hudSlowT-=(pdt===undefined?dt:pdt);')&&!s22.includes('hudSlowT-=dt;'));
const idx=SRC('index.html'), gf=SRC('dev/_game_files.txt');
assert('版本戳 20261117b: index.html ≥48 处 + __sfStyleVer + _game_files 45 行 + 旧 20261107a 清零 (2026-11-10 海战移除批判据跟码)',
 [...idx.matchAll(/20261117b/g)].length>=48&&idx.includes("window.__sfStyleVer='20261117b';")
 &&gf.split(/\r?\n/).filter(l=>l.includes('?v=20261117b')).length===45
 &&!idx.includes('20261107a')&&!gf.includes('20261107a'));
}

// ── 沙箱装载 (真 three; 与 verify-loiterfreeze 同款 boot) ──────────
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
let IDX=-1;
{ const c0=boot(0); IDX=vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="normandy")',c0); }
const ctx=boot(IDX);
const G=s=>vm.runInContext(s,ctx,{timeout:300000});
let err=null;
try{ G("document.getElementById('startBtn').onclick();"); }catch(e){ err='start: '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); }
if(!err) try{ G("player.team=0; player.cls=3; player.spectator=true; player.specUsed=true; selectedSpawn=-1; deployPlayer();"); }catch(e){ err='specDeploy: '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); }
assert('② 前置: 开局+观战者部署 (spectator, 时停默认关)',!err&&G('player.alive')===true&&G('player.spectator')===true&&G('specTimeFrozen()')===false,err||'');

// ── ② 行为: 时停中观察者走动 ⇒ 小地图/罗盘照常重绘 ──────────────
section('② 时停中重绘: updateHUD(0, 观察者帧长) ×40 帧, 小地图/罗盘 ≥5 次重绘 (旧写 = 0 次)');
{
G("globalThis.mmN=0; globalThis.cpN=0; const _mm0=drawMinimap, _cp0=drawCompass; drawMinimap=function(){ globalThis.mmN++; _mm0(); }; drawCompass=function(){ globalThis.cpN++; _cp0(); };");
G("specTimeToggle();");   // 开时停
assert('②-0 前置: specTimeFrozen=true (世界帧长 0)',G('specTimeFrozen()')===true,'');
G("hudSlowT=0.1; globalThis.mmN=0; globalThis.cpN=0; player.yaw=0; for(let i=0;i<40;i++){ player.yaw+=0.25; player.pos.x+=0.4; updateHUD(0,1/60); }");
const r=G('({mm:mmN,cp:cpN})');
assert('②-1 时停中小地图照常重绘 (40 帧 ≥5 次 ≈10Hz)',r.mm>=5,`次=${r.mm} (旧写 0 次)`);
assert('②-2 时停中罗盘照常重绘 (同一低频段)',r.cp>=5,`次=${r.cp}`);
G("specTimeToggle();");   // 关时停
assert('②-3 前置: 时停已解除',G('specTimeFrozen()')===false,'');
}

// ── ③ 对照: 非时停普通帧节流照常 ─────────────────────────────
section('③ 非时停对照: updateHUD(1/60) ×20 帧 ⇒ 节流照常 (≥2 次; NEG 下仍绿 = 恢复类)');
{
G("hudSlowT=0; globalThis.mmN=0; for(let i=0;i<20;i++){ updateHUD(1/60); }");
const r=G('({mm:mmN})');
assert('③-1 普通帧低频段照常运转 (20 帧 ≥2 次 ≈10Hz)',r.mm>=2,`次=${r.mm}`);
}

// ── ④ 单实参退化: 旧口径 updateHUD(0) 不重绘 (旧探针直调同款, 零漂移) ──
section('④ 单实参退化: updateHUD(0) (无第二实参 ⇒ 退化世界 dt) 冻结帧依旧不重绘');
{
G("hudSlowT=0.1; globalThis.mmN=0; for(let i=0;i<30;i++){ updateHUD(0); }");
const r=G('({mm:mmN})');
assert('④-1 单实参 dt=0 不重绘 (银行账不被误花, 旧探针口径零漂移)',r.mm===0,`次=${r.mm}`);
}

// ── ⑤ 汇总 ──
section('⑤ 汇总');
console.log(`  ${NEG?'NEG':'正向'} ${OK.length} 绿 / ${BAD.length} 红`);
if(BAD.length){ console.log('  红名: '+BAD.join(' · ')); process.exit(1); }
console.log('  verify-timestophud-20261108 全绿');
