// ─────────────────────────────────────────────────────────────
// dev/verify-restart-20261114.js —— 2026-11-14 批④ 回主页再开局失效修复验收
//   病灶 (用户实报"回主页后再开新对局没反应/多点几次才进, 时好时坏"): 沙箱全链路诊断 (repro
//   八支) 证明两条复开逻辑路径本身都干净 ⇒ 实机失效的两种形状都是**异常击穿**:
//   ① startMatch 中途抛 ⇒ startGame 尾部旗标 (menuHold/matchOver/matchRunning/showDeploy) 永不执行
//     ⇒ 菜单僵住; 半初始化状态下再点 = 时好时坏。
//   ② 主循环帧体逐帧抛 ⇒ rAF 链虽在最前重排, 函数体中途炸 ⇒ 世界更新+渲染全跳 ⇒ 画面僵死但 DOM 活。
//   修法 (双护栏): ① startGame 对 startMatch(+zombie 钩) try/catch, 尾部旗标保底执行 (22-hud)
//     ② loop 帧体 rAF 之后整段 try/catch, 节流告警 (前3帧带栈, 后每600帧心跳) + 兜底渲染 (24-main)。
// 用法: node dev/verify-restart-20261114.js [--neg]
//   --neg = 阴性对照 (2 补丁): N1 startGame 护栏摘除 → 段④ 护栏A 红 / N2 loop 护栏摘除 → 段⑤ 护栏B 红。
// 口径: 与 verify-tvosd-headbonk-20261110 同款 boot; confirm 沙箱钉 true (真机原生有)。
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
 // N1 病灶还原: startGame 护栏整块摘除 (裸调 startMatch, 异常击穿 startGame ⇒ 尾部旗标不落)。
 // ★22-hud 全 CRLF 锚须 \r\n; ★from 必须吃满整块到 catch 尾 —— 只摘 try{ 会留孤儿 catch 炸语法。
 ['js/22-hud.js','\ttry{\r\n\tresetMatchState(); // 清场播报/倒计时复位 (2026-09-06 B7b/P2-14: 21-match 暴露的唯一入口)\r\n\tresetPlayerForNewMatch(); // 玩家回到"未落地"状态 (2026-09-16 二批修: 否则新一局沿用上一局的活人状态)\r\n// ★2026-11-14 批④护栏: startMatch 若中途抛异常, 下方开局尾部旗标 (menuHold/matchOver/matchRunning/\r\n//   showDeploy(false)) 就永远不会执行 ⇒ 真机表现为"点开始没反应/菜单僵住", 再点几次靠半初始化状态\r\n//   时好时坏 (用户实报④的第二种症状形状)。这里只护栏不清账: 异常打日志带栈, 尾部旗标照常落,\r\n//   局面保持可玩而不是僵死在菜单。\r\n\tstartMatch();\r\n\tif(ZOMBIE_MODE&&typeof zombieMatchStart===\'function\') zombieMatchStart(); // 丧尸模式: ZP 初始/HUD/导演复位 (2026-10-06)\r\n\t}catch(e){ console.warn(\'[startGame] 开局链中途异常 (已护栏, 局面继续):\', e&&e.stack||e); }',
 '\tresetMatchState(); // NEG N1\r\n\tresetPlayerForNewMatch();\r\n\tstartMatch();\r\n\tif(ZOMBIE_MODE&&typeof zombieMatchStart===\'function\') zombieMatchStart();'],
 // N2 病灶还原: loop 帧级护栏摘除 (try→普通块 + 整段 catch 删除, 异常击穿函数体)。★纯 LF, 双补丁同文件链式。
 ['js/24-main.js','try{\nconst now=performance.now();','{ // NEG N2\nconst now=performance.now();'],
 ['js/24-main.js','}catch(e){\n_loopErrN++;\nif(_loopErrN<=3||_loopErrN%600===0) console.warn(\'[主循环] 帧内异常 (已护栏, 第\'+_loopErrN+\'帧次):\', e&&e.stack||e);\n// ★2026-11-14 重开局批: 首错上屏 —— 帧级护栏把异常从"报错可见"变成"世界冻结/没载具/UI停更"的静默病\n// (2026-11-12~14 四症状同根掩盖数日)。首错只提示一次不重复刷新, 技术文案不做 i18n; body 直挂件不进 #ui,\n// HUD 停更/隐藏时依然可见。\nif(_loopErrN===1){\ntry{ const lb=document.getElementById(\'loopErrBar\'); if(lb){ lb.textContent=\'⚠ 帧异常(已护栏): \'+(e&&e.message||e); lb.style.display=\'block\'; } }catch(_e){}\n}\ntry{ if(!document.hidden&&typeof renderer!==\'undefined\'&&renderer) renderer.render(scene,camera); }catch(_e){} // 兜底渲染: 场景主相机一帧, 不画 VM 层 (其状态可能是抛错根源)\n}','} // NEG N2 catch 摘除'],
];
const PATCH_MAP={};
if(NEG) for(const [f,from,to] of PATCHES){
 const s=PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f);
 if(s.indexOf(from)<0) throw new Error('阴性对照锚点未找到: '+f+' :: '+from.slice(0,70));
 PATCH_MAP[f]=s.split(from).join(to);
}
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f));

// ── ① 源码防回退 ─────────────────────────────────────────────
section('① 源码防回退 (双护栏接线)');
{
const s22=SRC('js/22-hud.js'), s24=SRC('js/24-main.js');
assert('22-hud: startGame 开局链护栏 (try 罩住 resetMatchState/resetPlayerForNewMatch, 尾部旗标保底; ★CRLF 锚, 2026-11-14f 批扩围)',
 s22.includes('\ttry{\r\n\tresetMatchState();')
 &&s22.includes('\tstartMatch();\r\n\tif(ZOMBIE_MODE&&typeof zombieMatchStart===\'function\') zombieMatchStart(); // 丧尸模式: ZP 初始/HUD/导演复位 (2026-10-06)\r\n\t}catch(e){ console.warn(\'[startGame] 开局链中途异常 (已护栏, 局面继续):\', e&&e.stack||e); }'));
assert('24-main: loop 帧级护栏 (rAF 后整段 try + 节流计数 + 兜底渲染 + 首错上屏 loopErrBar, 2026-11-14f 批)',
 s24.includes('var _loopErrN=0;')
 &&s24.includes('try{\nconst now=performance.now();')
 &&s24.includes('_loopErrN++;')
 &&s24.includes('if(_loopErrN<=3||_loopErrN%600===0) console.warn(')
 &&s24.includes("try{ if(!document.hidden&&typeof renderer!=='undefined'&&renderer) renderer.render(scene,camera); }catch(_e){}")
 &&s24.includes("getElementById('loopErrBar')"));
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
const st=()=>G("JSON.stringify({menuHold:menuHold,run:matchRunning,over:matchOver,boxes:BOXES.length,kids:scene.children.length})");
G("globalThis.confirm=function(){return true;};");   // 沙箱无 confirm, 测试钉 true (真机原生有)

// ── ② 行为: 首局→回主页→复开 链路 ──────────────────────────
section('② 行为: 首局→部署→回主页→复开 (同图就地路径)');
{
let e1=null;
try{ G("document.getElementById('startBtn').onclick(); document.getElementById('hubLaunchBtn').onclick();"); }catch(e){ e1=String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); }
assert('②-1 首局开战 (matchRunning, 世界就位)',!e1&&G('matchRunning')===true,e1||st());
G("globalThis._n0=BOXES.length; globalThis._k0=scene.children.length; for(let i=0;i<120;i++) loop();");
try{ G("returnToMenu();"); }catch(e){ e1=String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); }
assert('②-2 回主页 (menuHold=true, 对局仍在后台)',!e1&&G('menuHold')===true&&G('matchRunning')===true,e1||st());
try{ G("document.getElementById('hubLaunchBtn').onclick();"); }catch(e){ e1=String(e&&e.stack||e).split('\n').slice(0,3).join(' | '); }
assert('②-3 复开成功 (menuHold=false / matchRunning=true / 尾部旗标齐)',
 !e1&&G('menuHold')===false&&G('matchRunning')===true&&G('matchOver')===false,e1||st());
G("for(let i=0;i<120;i++) loop();");
// scene.children 随战况随机增长 (弹壳/粒子/尸堆, 种子不可复现) ⇒ 存活带判据; 翻倍病形状 = ≥2×基线。
assert('②-4 复开后世界不翻倍 (BOXES 精确还原; scene 在存活带 0.5~1.6×, 翻倍=≥2×基线)',
 G('BOXES.length')===G('_n0')&&(G('scene.children.length')>G('_k0')*0.5)&&(G('scene.children.length')<G('_k0')*1.6),
 `boxes=${G('BOXES.length')}/${G('_n0')} kids=${G('scene.children.length')}/基线${G('_k0')}`);
}

// ── ③ 行为: matchOver 路径复开 (结算后回主页再开) ───────────
section('③ 行为: matchOver→回主页→复开 (结算路径)');
{
G("matchOver=true; returnToMenu();");
try{ G("document.getElementById('hubLaunchBtn').onclick();"); }catch(e){ G._e3=String(e&&e.stack||e).split('\n').slice(0,3).join(' | '); }
assert('③-1 结算后复开成功 (matchOver 清账 + 战局重启)',
 G('menuHold')===false&&G('matchRunning')===true&&G('matchOver')===false,G('globalThis._e3'||''));
G("for(let i=0;i<60;i++) loop();");
assert('③-2 复开后帧跑正常 (战局存续)',G('matchRunning')===true);
}

// ── ④ 行为: 护栏 A —— startMatch 中途抛, 尾部旗标保底 ───────
section('④ 行为: 护栏A startGame (startMatch 抛 ⇒ 尾部旗标仍落)');
{
G("returnToMenu(); globalThis._sm=startMatch; startMatch=function(){ throw new Error('NEG: startMatch 中途抛'); };");
let thrown=false;
try{ G("startGame();"); }catch(e){ thrown=true; }
assert('④-1 startGame 不击穿 (护栏吃掉 startMatch 异常, startGame 正常返回)',!thrown);
assert('④-2 尾部旗标保底 (menuHold=false / matchRunning=true / matchOver=false)',
 G('menuHold')===false&&G('matchRunning')===true&&G('matchOver')===false,st());
G("startMatch=_sm; startGame(); for(let i=0;i<30;i++) loop();");   // 还原真身 + 干净重开 (护栏B 前提)
assert('④-3 还原后干净重开 (战局存续, 世界正常)',G('matchRunning')===true&&G('menuHold')===false,st());
}

// ── ⑤ 行为: 护栏 B —— 帧内异常, 主循环不击穿 ────────────────
section('⑤ 行为: 护栏B loop (逐帧异常 ⇒ 主循环吞掉并继续)');
{
// updateRisers 是 loop 帧体的无守卫直调点 (24-main 正常分支), 每帧必经 ⇒ 抛它 = 帧体逐帧击穿。
G("globalThis._ur=updateRisers; updateRisers=function(){ throw new Error('NEG: 帧内异常'); }; globalThis._err0=_loopErrN;");
let escaped=null;
try{ G("for(let i=0;i<60;i++) loop();"); }catch(e){ escaped=String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); }
assert('⑤-1 异常不击穿主循环 (60 帧全跑, 无异常逃出 loop)',!escaped,escaped||'');
assert('⑤-2 节流计数器记账 (_loopErrN += 60)',G('_loopErrN')===G('_err0')+60,`_loopErrN=${G('_loopErrN')} / ${G('_err0')}`);
G("updateRisers=_ur; for(let i=0;i<30;i++) loop();");   // 还原后帧体恢复全量执行
assert('⑤-3 还原后帧体恢复 (战局存续, 世界仍在更新)',G('matchRunning')===true&&G('menuHold')===false,st());
}

// ── 汇总 ─────────────────────────────────────────────────────
console.log('\n──────────────────────────────');
console.log(`  ${NEG?'NEG':'正向'} ${OK.length} 绿 / ${BAD.length} 红`);
if(BAD.length){ console.log('  红名: '+BAD.join(' · ')); process.exitCode=1; }
