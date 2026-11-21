// ─────────────────────────────────────────────────────────────
// dev/verify-dynreload-deathcam-20261112.js —— 2026-11-12 动态换弹速度 × 死亡时视角(击杀者 killcam) 批验收
//   ① 动态换弹速度 (sf_dynreload, 默认关): 换弹耗时 = 预设耗时 × (已消耗弹量/弹匣容量)。
//     单源 dynReloadFac (00-config); 玩家唯一生产点 19-input tryReload (VM.stateDur) —— VM 动画/
//     读条/3P 镜像/R 加速全按 nt=stateT/stateDur 比例自动跟随 (调研实证无固定时间线); Bot 六处
//     reloadT 起点 (14-bots) 同规 ⇒ 玩家与 Bot 同口径。
//   ② 死亡时视角 (sf_deathcam self/killer, 默认自己): 18-game die() 目标解析 (持枪 Bot=slots /
//     载具 crewBot; 自杀 attacker===this / 环境死 null / 无 slots 对象 ⇒ 回退原镜头) →
//     20-player updateCamera 死亡分支 killcam 档 (specView 让位之后): 前 0.5s 落回原死亡环绕
//     (=现状视角), 到点剪切击杀者背后追尾 (raycast 遮挡/地水下限/dampF) + 画布部分去饱和滤镜 +
//     #kcInd 角标; killcamEnd 单源收账 (showDeploy/endMatch/enterSpecView 三点); 重部署页面
//     时序零改动 (die() 两个 addMatchTimeout 原样钉)。
// 用法: node dev/verify-dynreload-deathcam-20261112.js [--neg] [--only=N]
//   --neg = 阴性对照 (10 补丁, 对认按红名): N1 玩家 stateDur 摘系数 / N2 dynReloadFac 恒 1 /
//   N3 Bot 主动补弹档摘系数 / N4 die() 目标解析摘除 / N5 killcam 相机分支退场 /
//   N6 killcamEnd 滤镜还原摘除 / N7 showDeploy 收账摘除 / N8 设置钮接线摘除 / N9 #kcInd 摘除 /
//   N10 killcam 滤镜不挂。
//   掩盖关系: N5 (分支退场) 掩盖 N10 与 ③ 全部相机/滤镜判据 ⇒ --only 单补丁亲见转红;
//   N4 掩盖 ③ 全部行为判据; N1/N2 掩盖 ② 换弹数值判据。
// 口径: 与 verify-achieve-20261111 同款 boot (真 three + index.html 全脚本链 + startBtn 开局)。
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

// ── 阴性对照 (一律单行锚, 替换体整语句+块注释) ──
const PATCHES_ALL=[
 // N1 病灶还原: 玩家换弹总时长摘动态系数 (⇒ ② 全部数值判据红; ★2026-11-20 火力点坐姿批跟码: 行内公式已收编为 reloadDurOf 单源, 锚跟走 — 摘除语义不变, 步行 VM 换弹分母回到无系数)
 ['js/19-input.js', "VM.stateDur=reloadDurOf(w); // 连杀增益: 换弹加速 (2026-09-11); 动态换弹速度 ×已耗/弹匣 (2026-11-12, 单源 dynReloadFac — VM 动画/读条/3P 镜像按 nt 比例自动跟随)",
  "VM.stateDur=w.def.reload*(player.streakBuff?player.streakBuff.reloadMul:1); /* NEG N1 动态换弹摘除 */"],
 // N2 病灶还原: dynReloadFac 恒 1 (系数公式失效 ⇒ ② 数值判据红; 保留函数体防调用点 ReferenceError 崩探针)
 ['js/00-config.js', 'function dynReloadFac(mag,cap){ if(!DYN_RELOAD||!cap||cap<=0) return 1; const used=cap-Math.max(0,mag); return used<=0?1:clamp(used/cap,0,1); }',
  'function dynReloadFac(mag,cap){ return 1; /* NEG N2 系数恒 1 */ }'],
 // N3 病灶还原: Bot 主动补弹档 (mag<40% 唯二真实变档点之一) 摘系数
 ['js/14-bots.js', 'if(this.mag<this.def.mag*0.4&&this.reloadT<=0&&this.canReload()){ this.reloadT=this.def.reload*dynReloadFac(this.mag,this.def.mag); } // 动态换弹速度 (2026-11-12): 主动补弹档, 系数随已耗浮动 — Bot 侧唯二真实变档点之一',
  'if(this.mag<this.def.mag*0.4&&this.reloadT<=0&&this.canReload()){ this.reloadT=this.def.reload; } /* NEG N3 Bot 摘系数 */'],
 // N4 病灶还原: die() 目标解析摘除 (killcam 永不建立 ⇒ ③ 全部行为判据红)
 ['js/18-game.js', 'if(DEATHCAM_KILLER&&attacker&&attacker!==this){', 'if(false&&DEATHCAM_KILLER&&attacker&&attacker!==this){ // NEG N4 目标解析摘除'],
 // N5 病灶还原: killcam 相机分支退场 (0.5s 剪切/滤镜/角标全死 ⇒ ③ 相机判据红; 掩盖 N10)
 ['js/20-player.js', 'if(p.killcam){', 'if(false&&p.killcam){ // NEG N5 killcam 分支退场'],
 // N6 病灶还原: killcamEnd 滤镜还原摘除 (killcam 结束后画布残灰)
 ['js/20-player.js', "try{ renderer.domElement.style.filter='none'; }catch(e){}", 'try{ }catch(e){ /* NEG N6 滤镜还原摘除 */ }'],
 // N7 病灶还原: showDeploy 收账摘除 (进部署页滤镜/角标/相机账全残留)
 ['js/23-deploy.js', "if(typeof killcamEnd==='function') killcamEnd(); // 死亡时视角=击杀者: killcam 随部署页一次收账 (2026-11-12 批, 相机账/画布滤镜/角标) —— 部署页本身不受该设置影响",
  '/* NEG N7 showDeploy 收账摘除 */'],
 // N8 病灶还原: 动态换弹设置钮接线摘除 (点击不落盘不翻内存 ⇒ ④ 红)
 ['js/22-hud.js', 'DYN_RELOAD=!DYN_RELOAD;', '/* NEG N8 设置钮接线摘除 */'],
 // N9 病灶还原: #kcInd 角标 DOM 摘除 (静态钉红; 游戏侧 getElementById 兜底不崩)
 ['index.html', '<div id="kcInd" class="hidden" data-i18n>☠ 击杀者视角</div>', '<!-- NEG N9 kcInd 摘除 -->'],
 // N10 病灶还原: killcam 滤镜不挂 (镜头切了但无滤镜; 被 N5 掩盖 ⇒ --only 亲见)
 ['js/20-player.js', "if(renderer.domElement.style.filter!=='grayscale(0.62) contrast(1.05) brightness(0.92)') renderer.domElement.style.filter='grayscale(0.62) contrast(1.05) brightness(0.92)'; // killcam 滤镜: 部分去饱和 (全灰过苛), 窗口结束由 killcamEnd 还原 'none' —— 2026-11-13 卡顿批: 恒定串改判等单次写 (旧版每帧重写 style.filter = 死亡期卡顿病灶)",
  '/* NEG N10 滤镜不挂 */'],
];
const _onlyArg=NEG?(process.argv.find(a=>a.startsWith('--only='))||''):'';
const PATCHES=_onlyArg?PATCHES_ALL.filter((p,i)=>String(i+1)===_onlyArg.slice(7)):PATCHES_ALL;
const PATCH_MAP={};
if(NEG) for(const [f,from,to] of PATCHES){
 const s=PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f);
 if(s.indexOf(from)<0) throw new Error('阴性对照锚点未找到: '+f+' :: '+from.slice(0,70));
 PATCH_MAP[f]=s.split(from).join(to);
}
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f));

// ── ① 源码防回退 ─────────────────────────────────────────────
section('① 源码防回退 (设置卡/角标/i18n/单源/六处 Bot 点/收账三点/戳)');
{
const ih=srcOf('index.html'), gf=SRC('dev/_game_files.txt'), i18=srcOf('js/00b-i18n.js'),
      s00=srcOf('js/00-config.js'), s19=srcOf('js/19-input.js'), s14=srcOf('js/14-bots.js'),
      s18=srcOf('js/18-game.js'), s20=srcOf('js/20-player.js'), s21=srcOf('js/21-match.js'),
      s22=srcOf('js/22-hud.js'), s23=srcOf('js/23-deploy.js'),
      css=SRC('css/style.css'), ra=SRC('dev/run-all-verify.js');
assert('index.html: 游戏内容设置两张新卡 (dynReloadBtn/deathCamBtn + 标题)',
 ih.includes('id="dynReloadBtn"')&&ih.includes('id="deathCamBtn"')
 &&ih.includes('<div class="setTitle" data-i18n>动态换弹速度</div>')&&ih.includes('<div class="setTitle" data-i18n>死亡时视角</div>'));
assert('index.html: 两段 setDesc 说明在册 (公式口径/killcam 口径)',
 ih.includes('已消耗弹量÷弹匣容量')&&ih.includes('击杀者的第三人称观战镜头')&&ih.includes('自杀与环境死亡不切换'));
assert('index.html: #kcInd 角标 (blackOv 之前, NEG N9 转)',ih.includes('<div id="kcInd" class="hidden" data-i18n>☠ 击杀者视角</div>')&&ih.indexOf('id="kcInd"')<ih.indexOf('id="blackOv"'));
assert('css: #kcInd 角标样式在册',css.includes('#kcInd')&&css.includes('killcamEnd'));
assert('00b-i18n: 新词条齐 (标签/档位/角标/两段说明)',
 i18.includes("'动态换弹速度':'DYNAMIC RELOAD'")&&i18.includes("'死亡时视角':'DEATH CAMERA'")
 &&i18.includes("'自己':'SELF'")&&i18.includes("'击杀者':'KILLER'")&&i18.includes("'☠ 击杀者视角':'☠ KILLER CAM'")
 &&i18.includes("'开启后实际换弹耗时=预设耗时×(已消耗弹量÷弹匣容量)")&&i18.includes("'击杀者 = 被击杀后先保持原死亡镜头约半秒"));
assert('00-config: 三件单源 (DYN_RELOAD/DEATHCAM_KILLER/dynReloadFac, NEG N2 转)',
 s00.includes("let DYN_RELOAD=localStorage.getItem('sf_dynreload')==='1';")
 &&s00.includes("let DEATHCAM_KILLER=localStorage.getItem('sf_deathcam')==='killer';")
 &&s00.includes('function dynReloadFac(mag,cap){ if(!DYN_RELOAD||!cap||cap<=0) return 1; const used=cap-Math.max(0,mag); return used<=0?1:clamp(used/cap,0,1); }'));
assert('19-input: 玩家换弹总时长乘 dynReloadFac (唯一生产点; NEG N1 转)',
 s19.includes('*dynReloadFac(w.mag,w.def.mag);'));
assert('14-bots: 六处 reloadT 起点全走 dynReloadFac (玩家与 Bot 同规; NEG N3 转)',
 (s14.match(/dynReloadFac\(/g)||[]).length>=6&&s14.includes('*dynReloadFac(this.mag,this.def.mag)')&&s14.includes('*dynReloadFac(b.mag,b.def.mag)'));
assert('18-game: die() 目标解析 (slots/crewBot 双认 + killcam 账; NEG N4 转)',
 s18.includes('this.killcam=null;')&&s18.includes('if(DEATHCAM_KILLER&&attacker&&attacker!==this){')
 &&s18.includes('const kb=(attacker.slots&&attacker.pos)?attacker:((attacker.crewBot&&attacker.crewBot.slots&&attacker.crewBot.pos)?attacker.crewBot:null);'));
assert('20-player: killcam 相机分支 (0.5s 剪切/遮挡/地水下限/滤镜/角标; NEG N5/N10 转)',
 s20.includes('if(p.killcam){')&&s20.includes('p.killcam.t>=0.5')&&s20.includes("renderer.domElement.style.filter='grayscale(0.62) contrast(1.05) brightness(0.92)'")
 &&s20.includes("const kci=document.getElementById('kcInd'); if(kci&&kci.classList.contains('hidden')) kci.classList.remove('hidden');"));
assert('20-player: killcamEnd 收账单源 (滤镜还原+账清+角标藏; NEG N6 转)',
 s20.includes('function killcamEnd(){')&&s20.includes("try{ renderer.domElement.style.filter='none'; }catch(e){}"));
assert('20-player: enterSpecView 收账接线',s20.includes('killcamEnd(); // killcam 随自由观战收账'));
assert('23-deploy: showDeploy 收账接线 (NEG N7 转) + 21-match: endMatch 收账接线',
 s23.includes("if(typeof killcamEnd==='function') killcamEnd(); // 死亡时视角=击杀者: killcam 随部署页一次收账")
 &&s21.includes("if(typeof killcamEnd==='function') killcamEnd(); // killcam 随结算一次收账"));
assert('22-hud: 两设置钮接线 (单钮循环+即时落盘; NEG N8 转)',
 s22.includes("el('dynReloadBtn')")&&s22.includes("localStorage.setItem('sf_dynreload',DYN_RELOAD?'1':'0');")
 &&s22.includes("el('deathCamBtn')")&&s22.includes("localStorage.setItem('sf_deathcam',DEATHCAM_KILLER?'killer':'self');"));
assert('18-game: 重部署时序零改动 (blackOv/showDeploy 两个 addMatchTimeout 原样)',
 s18.includes("addMatchTimeout(()=>{ if(!this.alive){ const bo=document.getElementById('blackOv'); if(bo) bo.style.opacity=0.75; } },dly);")
 &&s18.includes("addMatchTimeout(()=>{ if(!matchOver&&!this.alive&&typeof showDeploy==='function') showDeploy(true); },dly+700);"));
assert('run-all 已登记本探针',ra.includes('verify-dynreload-deathcam-20261112.js'));
assert('版本戳 20261121b: index.html ≥48 处 + __sfStyleVer + _game_files 45 行 + 旧 20261112a 清零',
 [...ih.matchAll(/20261121b/g)].length>=48&&ih.includes("window.__sfStyleVer='20261121b';")
 &&gf.split(/\r?\n/).filter(l=>l.includes('?v=20261121b')).length===45
 &&!ih.includes('20261112a')&&!gf.includes('20261112a'));
}

// ── 沙箱装载 (真 three; 与 verify-achieve-20261111 同款 boot + 自定义存档预置) ──
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
const REAL_THREE=loadRealTHREE(); // 2026-11-19 效率批: three.min.js 解析只做一次 (per-boot WebGLRenderer/prototype 补丁幂等, 复用同一实例; 先例 verify-vehburn-20261109)
const html=SRC('index.html');
const FILES=[...html.matchAll(/src="(js\/[^"?]+)/g)].map(m=>m[1]);
function boot(campIdx,extra){
 const T=REAL_THREE; // 效率批: 解析去重
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
 // 本探针增强: 自动建元素带可观测 classList (Set 实现) —— killcam 分支/killcamEnd 用 classList 显隐 #kcInd,
 // bootstub 原生 classList 是 no-op (contains 恒 false), 断言不可见。其余行为 (style/innerHTML/appendChild) 走原生桩。
 ctx.document=Object.assign({},document,{getElementById:id=>{ if(!byId[id]){ const e=patchStyle(document.createElement('div')); e.id=id; const cls=new Set(['kcSeed'===id?'':'hidden']); cls.delete(''); if(id==='kcInd') cls.add('hidden'); // index.html 里 kcInd 带 class="hidden"
   e.classList={add:c=>cls.add(c),remove:c=>cls.delete(c),toggle:(c,f)=>{ if(f===undefined){ if(cls.has(c)) cls.delete(c); else cls.add(c); } else if(f) cls.add(c); else cls.delete(c); },contains:c=>cls.has(c)};
   e._cls=cls; byId[id]=e; } return byId[id]; }});
 const listeners={};
 const addL=(t,f)=>{ (listeners[t]=listeners[t]||[]).push(f); };
 ctx.addEventListener=addL; ctx.removeEventListener=()=>{};
 ctx.document.addEventListener=addL; ctx.document.removeEventListener=()=>{};
 ctx.window=Object.assign({},window,{addEventListener:addL,removeEventListener(){}});
 ctx.dispatchEvent=ev=>{ if(!ev.preventDefault) ev.preventDefault=()=>{}; if(!ev.stopPropagation) ev.stopPropagation=()=>{}; for(const f of (listeners[ev.type]||[]).slice()) f(ev); return true; };
 ctx.KeyboardEvent=class{ constructor(t,o){ o=o||{}; this.type=t; this.code=o.code; this.repeat=!!o.repeat; } };
 ctx.MouseEvent=class{ constructor(t,o){ o=o||{}; this.type=t; this.button=o.button; } };
 ctx.globalThis=ctx;
 // ★本批坑 (探针新账): 成就批的"同步 setTimeout"桩会令 die() 里 addMatchTimeout(showDeploy) 当帧执行
 //  ⇒ killcamEnd 把刚建立的 killcam 账当帧收掉 = ③-2 假红。实机 setTimeout 异步, 无此问题。
 //  本探针改队列不执行 (贴近 bootstub 原生 no-op 语义) —— 行为链全部直调 (tryReload/damage/updateCamera/showDeploy), 不依赖定时器。
 ctx.__timers=[];
 ctx.setTimeout=(f,ms)=>{ ctx.__timers.push({f:f,ms:ms}); return ctx.__timers.length; };
 ctx.clearTimeout=()=>{};
 ctx.localStorage={_s:Object.assign({sf_campaign:String(campIdx),sf_exp:'0',sf_pseed:'424242'},extra||{}),getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];},get length(){return Object.keys(this._s).length;},key(i){const a=Object.keys(this._s);return i<a.length?a[i]:null;}};
 for(const f of FILES){ vm.runInContext(srcOf(f),ctx,{filename:f}); }
 return ctx;
}
const Gof=(ctx,s)=>vm.runInContext(s,ctx,{timeout:300000});
const Gsafe=(ctx,s)=>{ try{ return {v:Gof(ctx,s)}; }catch(e){ return {err:String(e&&e.message||e).split('\n')[0]}; } };
function startMatch(ctx){
 let err=null;
 try{ Gof(ctx,"document.getElementById('startBtn').onclick();"); }catch(e){ err='start: '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); }
 if(!err) try{ Gof(ctx,"player.team=0; player.cls=0; player.spectator=false; player.alive=true; player.deployed=true; player.protUntil=0; if(typeof rearmPlayerClass==='function') rearmPlayerClass(0);"); }catch(e){ err='playerInit: '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); }
 return err;
}
let IDX=-1;
{ const c0=boot(0); IDX=Gof(c0,'CAMPAIGNS.findIndex(c=>c.id==="normandy")'); }

// ── ② 动态换弹速度 ───────────────────────────────────────────
section('② 动态换弹速度: 默认关=原时长 / 开=预设×已耗÷容量 (玩家链 VM.stateDur 单点)');
{
const ctxOff=boot(IDX);
let e1=startMatch(ctxOff);
assert('②-0 前置: 开局+玩家就位 (默认档 boot, 无 sf_dynreload)',!e1,e1||'');
if(!e1){
 Gof(ctxOff,"player.curW.mag=5; player.curW.reserve=100; if(typeof VM!=='undefined') VM.state='idle'; tryReload(true);");
 assert('②-1 默认关: 半匣换弹=原时长 (garand reload 2.4, 已耗 3/8 不折算)',
  Gof(ctxOff,"VM.state==='reload'&&Math.abs(VM.stateDur-2.4)<1e-6")===true,'stateDur='+Gof(ctxOff,'VM.stateDur'));
 assert('②-2 默认关: dynReloadFac 恒 1 (含半匣 5/8)',Gof(ctxOff,'dynReloadFac(5,8)')===1&&Gof(ctxOff,'DYN_RELOAD')===false);
}
const ctxOn=boot(IDX,{sf_dynreload:'1'});
let e2=startMatch(ctxOn);
assert('②-3 前置: 开局+玩家就位 (sf_dynreload=1 预置档, 载入期读取)',!e2&&Gof(ctxOn,'DYN_RELOAD')===true,e2||'');
if(!e2){
 Gof(ctxOn,"player.curW.mag=5; player.curW.reserve=100; VM.state='idle'; tryReload(true);");
 assert('②-4 开: 已耗 3/8 ⇒ 2.4×3/8=0.9 (NEG N1/N2 转)',
  Gof(ctxOn,"Math.abs(VM.stateDur-2.4*3/8)<1e-6")===true,'stateDur='+Gof(ctxOn,'VM.stateDur'));
 Gof(ctxOn,"VM.state='idle'; player.curW.mag=7; tryReload(true);");
 assert('②-5 开: 已耗 1/8 ⇒ 0.3 (越接近满弹匣越快)',
  Gof(ctxOn,"Math.abs(VM.stateDur-2.4*1/8)<1e-6")===true,'stateDur='+Gof(ctxOn,'VM.stateDur'));
 Gof(ctxOn,"VM.state='idle'; player.curW.mag=0; tryReload(true);");
 assert('②-6 开: 打空 ⇒ 原时长 2.4',
  Gof(ctxOn,"Math.abs(VM.stateDur-2.4)<1e-6")===true,'stateDur='+Gof(ctxOn,'VM.stateDur'));
 assert('②-7 dynReloadFac 单元: 5/8=0.375 · 满匣回退 1 · 空匣=1 · 容量非法=1',
  Gof(ctxOn,'dynReloadFac(5,8)')===0.375&&Gof(ctxOn,'dynReloadFac(8,8)')===1&&Gof(ctxOn,'dynReloadFac(0,8)')===1&&Gof(ctxOn,'dynReloadFac(3,0)')===1,
  'f='+Gof(ctxOn,'dynReloadFac(5,8)')+','+Gof(ctxOn,'dynReloadFac(8,8)'));
 assert('②-8 读条口径自洽: 进度=stateT/stateDur, 剩余秒数=stateDur-stateT (HUD 消费同源自动跟随)',
  Gof(ctxOn,"VM.stateT===0&&(VM.stateDur>0)")===true,'t='+Gof(ctxOn,'VM.stateT'));
}
}

// ── ③ 死亡时视角=击杀者 (killcam 真链) ──────────────────────
section('③ killcam: die() 解析 → 0.5s 原镜头 → 剪切击杀者背后追尾+滤镜+角标 → showDeploy 收账');
{
const ctx3=boot(IDX,{sf_deathcam:'killer'});
const e3=startMatch(ctx3);
assert('③-0 前置: 开局+玩家就位 (sf_deathcam=killer)',!e3&&Gof(ctx3,'DEATHCAM_KILLER')===true,e3||'');
if(!e3){
 Gof(ctx3,"globalThis.__kb=(typeof soldiers!=='undefined'?soldiers:[]).find(function(b){return b&&b.alive&&b.slots&&b.pos&&!b.onVehicle;})||null; if(!__kb){ __kb=new Bot(1,0,'KC探针'); __kb.alive=true; __kb.hp=100; __kb.pos.set(player.pos.x+18,player.pos.y,player.pos.z+6); __kb.yaw=1.1; }");
 assert('③-1 击杀者已就位 (真 Bot 优先, 沙箱无兵时补建最小 Bot)',Gof(ctx3,'!!__kb&&!!__kb.slots')===true);
 Gof(ctx3,"player.damage(999, __kb, false);");
 assert('③-2 真死且 killcam 账已建立 (目标=击杀者本体; NEG N4 转)',
  Gof(ctx3,'player.alive===false&&!!player.killcam&&player.killcam.src===__kb&&player.killcam.t===0')===true);
 // 0.5s 保留期: 落回原死亡镜头 (滤镜/角标都不动)
 Gof(ctx3,'updateCamera(0.1); updateCamera(0.1);');
 assert('③-3 保留期 (t≈0.2<0.5): 画布无滤镜 + 角标仍藏 (现状视角)',
  Gof(ctx3,"renderer.domElement.style.filter==='none'")===true&&Gof(ctx3,'document.getElementById("kcInd")._cls.has("hidden")')===true,
  'filter='+Gof(ctx3,'renderer.domElement.style.filter'));
 // 到点: 剪切进 killcam
 Gof(ctx3,'updateCamera(0.1); updateCamera(0.1); updateCamera(0.1); updateCamera(0.1); updateCamera(0.1);');
 assert('③-4 killcam 期: 画布挂部分去饱和滤镜 (NEG N5/N10 转)',
  String(Gof(ctx3,'renderer.domElement.style.filter')).includes('grayscale')===true,'filter='+Gof(ctx3,'renderer.domElement.style.filter'));
 assert('③-5 killcam 期: #kcInd 角标已显',
  Gof(ctx3,'!document.getElementById("kcInd")._cls.has("hidden")')===true);
 assert('③-6 killcam 期: 相机在击杀者背后近距 (XZ 距 0.5~9m 且位于前向反侧; 首帧剪切+dampF 跟随)',
  Gof(ctx3,'(function(){ var dx=camera.position.x-__kb.pos.x, dz=camera.position.z-__kb.pos.z; var dxz=Math.hypot(dx,dz); var behind=dx*Math.sin(__kb.yaw||0)+dz*Math.cos(__kb.yaw||0); return dxz>0.5&&dxz<9&&behind<0; })()')===true,
  'dxz='+Gof(ctx3,'Math.hypot(camera.position.x-__kb.pos.x,camera.position.z-__kb.pos.z)'));
 assert('③-7 killcam 期: fov 钳到 60 档 (死亡镜头口径) + 注视击杀者',
  Gof(ctx3,'Math.abs(camera.fov-60)<2')===true);
 // 收账: showDeploy (部署页路径)
 Gof(ctx3,'showDeploy(true);');
 assert('③-8 showDeploy 一次收账: 滤镜还原 none + killcam 账清 + 角标藏回 (NEG N6/N7 转)',
  Gof(ctx3,"renderer.domElement.style.filter==='none'")===true&&Gof(ctx3,'player.killcam===null')===true
  &&Gof(ctx3,'document.getElementById("kcInd")._cls.has("hidden")')===true);
 // 自杀 / 环境死 / 无 slots 攻击者 → 永不切
 Gof(ctx3,"player.alive=true; player.hp=100; player.spectator=false; player.damage(999, player, false);");
 assert('③-9 自杀 (attacker===player): 不切 killcam',Gof(ctx3,'player.alive===false&&player.killcam===null')===true);
 Gof(ctx3,"player.alive=true; player.hp=100; player.damage(999, null, false);");
 assert('③-10 环境死 (attacker=null, 坠落/淹水链): 不切 killcam',Gof(ctx3,'player.killcam===null')===true);
 Gof(ctx3,"globalThis.__noSlots={pos:V3(1,2,3)}; player.alive=true; player.hp=100; player.damage(999, __noSlots, false);");
 assert('③-11 无 slots 攻击者 (丧尸等): 不切 killcam (回退原镜头)',Gof(ctx3,'player.killcam===null')===true);
}
// 默认档 (自己): 真击杀也不切
const ctx4=boot(IDX);
const e4=startMatch(ctx4);
if(!e4){
 Gof(ctx4,"globalThis.__kb2=(typeof soldiers!=='undefined'?soldiers:[]).find(function(b){return b&&b.alive&&b.slots&&b.pos&&!b.onVehicle;})||null; if(!__kb2){ __kb2=new Bot(1,0,'KC探针2'); __kb2.alive=true; __kb2.hp=100; __kb2.pos.set(player.pos.x+15,player.pos.y,player.pos.z+4); } player.protUntil=0; player.damage(999, __kb2, false);");
 assert('③-12 默认自己: 被击杀后 killcam 恒 null + 滤镜恒 none',
  Gof(ctx4,'player.alive===false&&player.killcam===null')===true&&Gof(ctx4,"renderer.domElement.style.filter==='none'")===true);
} else assert('③-12 默认自己: (前置失败)',false,e4);
}

// ── ④ 设置钮行为 ────────────────────────────────────────────
section('④ 游戏内容设置: 两单钮循环 (点击翻内存+落盘+即时生效)');
{
const ctx5=boot(IDX);
const e5=startMatch(ctx5);
if(!e5){
 Gof(ctx5,"document.getElementById('dynReloadBtn').onclick();");
 assert('④-1 动态换弹钮: 点击 → DYN_RELOAD=true + sf_dynreload=1 (NEG N8 转)',
  Gof(ctx5,'DYN_RELOAD===true&&localStorage.getItem("sf_dynreload")==="1"')===true);
 Gof(ctx5,"document.getElementById('dynReloadBtn').onclick();");
 assert('④-2 再点回关: DYN_RELOAD=false + sf_dynreload=0 (下次换弹即生效口径)',
  Gof(ctx5,'DYN_RELOAD===false&&localStorage.getItem("sf_dynreload")==="0"')===true);
 Gof(ctx5,"document.getElementById('deathCamBtn').onclick();");
 assert('④-3 死亡视角钮: 点击 → DEATHCAM_KILLER=true + sf_deathcam=killer',
  Gof(ctx5,'DEATHCAM_KILLER===true&&localStorage.getItem("sf_deathcam")==="killer"')===true);
 Gof(ctx5,"document.getElementById('deathCamBtn').onclick();");
 assert('④-4 再点回自己: DEATHCAM_KILLER=false + sf_deathcam=self',
  Gof(ctx5,'DEATHCAM_KILLER===false&&localStorage.getItem("sf_deathcam")==="self"')===true);
} else { assert('④-1 设置钮前置 (开局失败)',false,e5||''); }
}

// ── ⑤ 汇总 ──────────────────────────────────────────────────
section('⑤ 汇总');
console.log(`  正向 ${OK.length} 绿 / ${BAD.length} 红`);
if(BAD.length){ console.log('  红项: '+BAD.join(' · ')); process.exit(1); }
console.log('  verify-dynreload-deathcam-20261112 全绿');
