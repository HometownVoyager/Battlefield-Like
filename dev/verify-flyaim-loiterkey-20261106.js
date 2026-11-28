// ─────────────────────────────────────────────────────────────
// dev/verify-flyaim-loiterkey-20261106.js —— 2026-11-06 飞行瞄准×巡飞弹改键批验收
//   ① 观战飞行(气动 H / 悬停 双击空格)右键 = 瞄准 ADS (键鼠/触屏/手柄三门摘 !player.flying)
//   ② 气动飞行加速 右键→空格 (specFlightMove 读 keys.Space)
//   ③ 巡飞弹: 加速 右键→空格 (_ltSpace 吞边沿, 与 _ltRClick 同构) + 视角切换 F→U
//     + 右键按住 = 开镜放大 (fov 85/70 → LOITER_ZOOM_FOV=30, 强制第一人称, 弹体同 TV 档藏)
//     + TV 灵敏度跟当前 fov (camera.fov/74, 开镜等比收窄)
// 用法: node dev/verify-flyaim-loiterkey-20261106.js [--neg]
//   --neg = 阴性对照: 装载前把本批核心改动按单行锚还原成旧写法, 行为判据必须报红 (14 处补丁, 累积应用, 对认按红名)。
// 口径: 与 verify-parity-20261103 同款 boot (真 three + index.html 全脚本链 + startBtn 开局);
//   键位行为经注入的可记录 addEventListener/dispatchEvent 桩走**真键鼠处理链** (keydown/mousedown/mouseup);
//   弹体与玩家全程抬到高空 (heightAt+80), 避开命中检测/触地自爆干扰。
// 预期 NEG 红名: 源码节 ~13 条 + ②-1 + ③-1 + ④-1 + ⑤-1/⑤-3 + ⑥-4/⑥-5/⑥-6 (恢复类断言 ⑥-7~9 仍绿)。
// ─────────────────────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const NEG=process.argv.includes('--neg');
const OK=[],BAD=[];
function assert(name,cond,detail){ (cond?OK:BAD).push(name); console.log(`  ${cond?'✓':'✗'} ${name}${detail?'  '+detail:''}`); }
function section(t){ console.log('\n══ '+t+' ══'); }
const SRC=f=>fs.readFileSync(path.join(root,f),'utf8');

// ── 阴性对照 (单行锚; 19-input/13-combat 为纯 LF, 两行锚用 \n; 20-player 整文件 CRLF —— 全部用单行锚规避行尾) ──
const PATCHES=[
 // 19-input: ADS 门复活 flying 排除 (飞行中右键不再瞄准)
 ['js/19-input.js','if(player.alive&&!player.loiter&&!player.onMG&&!player.onVehicle&&!player.onNaval&&!player.onAT&&!player.onAA&&!player.onMortar&&!player.onBattery&&!player.capitalGun) player.ads=true;',
  'if(player.alive&&!player.loiter&&!player.flying&&!player.onMG&&!player.onVehicle&&!player.onNaval&&!player.onAT&&!player.onAA&&!player.onMortar&&!player.onBattery&&!player.capitalGun) player.ads=true;'],
 // 19-input: KeyU 制导分支退场 (视角切换退回 F 语义由下一条一并复活)
 ['js/19-input.js',"if(e.code==='KeyU'){ if(player.loiter){ player.loiterView=player.loiterView?0:1; AudioSys.click(1400,0.25,0.05); } else if(player.onNaval) navalCycleView(); else toggleThirdPerson(); }",
  "if(e.code==='KeyU'){ if(player.onNaval) navalCycleView(); else toggleThirdPerson(); }"],
 // 19-input: KeyF 恢复旧 loiter 分支 (两行锚, \n; 本文件纯 LF)
 ['js/19-input.js','// 巡飞弹视角切换已挪 U (2026-11-06 飞行瞄准批); 制导中按 F 落 tryInteract 在其第一行被 loiter 门吞掉, 无误触\ntryInteract();',
  'if(player.loiter){ player.loiterView=player.loiterView?0:1; AudioSys.click(1400,0.25,0.05); }\nelse tryInteract();'],
 // 20-player: 气动加速回 mouse2Down
 ['js/20-player.js','const spd=dampF(p._aeroSpd||13,((keys.Space&&!p._ltSpace)?40:13),2.2,dt);','const spd=dampF(p._aeroSpd||13,(mouse2Down?40:13),2.2,dt);'],
 // 20-player: 相机开镜判定退场 (放大不再强制第一人称)
 ['js/20-player.js','const third=lz?0:p.loiterView;','const third=p.loiterView;'],
 // 20-player: fov 目标回档位值 (开镜不收窄)
 ['js/20-player.js','const tgtFov=lz?LOITER_ZOOM_FOV:(third?70:85);','const tgtFov=third?70:85;'],
 // 20-player: _ltSpace 清零退场 (吞边沿卡死)
 ['js/20-player.js','if(!keys.Space) p._ltSpace=false;',''],
 // 13-combat: boost 回 mouse2Down
 ['js/13-combat.js','const boost=keys.Space&&!player._ltSpace;','const boost=mouse2Down&&!player._ltRClick;'],
 // 13-combat: fireLoiter 吞空格退场 (发射瞬间按住空格即加速)
 ['js/13-combat.js','player._ltClick=true; player._ltRClick=true; player._ltSpace=!!keys.Space;','player._ltClick=true; player._ltRClick=true;'],
 // 13-combat: 灵敏度回 85/74 (开镜灵敏度不收窄)
 ['js/13-combat.js','(camera.fov/74)','(85/74)'],
 // 13-combat: 弹体可见性回旧式 (开镜中弹体不再藏)
 ['js/13-combat.js','d.mesh.visible=!(player.alive&&(!player.loiterView||lz));','d.mesh.visible=!(player.alive&&!player.loiterView);'],
 // 24-main: 触屏 ADS 门复活 flying
 ['js/24-main.js','if(player.alive&&!player.loiter&&!player.onMG&&!player.onVehicle&&!player.onNaval&&!player.onAT&&!player.onAA&&!player.onMortar&&!player.onBattery&&!player.specViewHost) player.ads=true;',
  'if(player.alive&&!player.loiter&&!player.flying&&!player.onMG&&!player.onVehicle&&!player.onNaval&&!player.onAT&&!player.onAA&&!player.onMortar&&!player.onBattery&&!player.specViewHost) player.ads=true;'],
 // 19b: 手柄 ADS 门复活 flying
 ['js/19b-gamepad.js','if(player.alive&&!player.loiter&&!player.onMG&&!player.onVehicle&&!player.onNaval&&!player.onAT&&!player.onAA&&!player.onMortar&&!player.onBattery&&!player.specViewHost) player.ads=true;',
  'if(player.alive&&!player.loiter&&!player.flying&&!player.onMG&&!player.onVehicle&&!player.onNaval&&!player.onAT&&!player.onAA&&!player.onMortar&&!player.onBattery&&!player.specViewHost) player.ads=true;'],
 // 22-hud: 面板提示回旧串 (源码级)
 ['js/22-hud.js',"hudText('nadeN',t2('鼠标 制导 · 左键 自爆 · 空格 加速 · 右键 开镜 · U 切换视角 · 本体定身'));","hudText('nadeN',t2('鼠标 制导 · 左键 自爆 · 右键 加速 · F 切换视角'));"],
];
const PATCH_MAP={};
if(NEG) for(const [f,from,to] of PATCHES){
 const s=PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f);
 if(s.indexOf(from)<0) throw new Error('阴性对照锚点未找到: '+f+' :: '+from.slice(0,70));
 PATCH_MAP[f]=s.split(from).join(to);
}
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f));

// ── ① 源码防回退 ──────────────────────────────────────────────
section('① 源码防回退 (修好的写法在 / 旧写法不在)');
{
const s19=srcOf('js/19-input.js');
assert('19 ADS 门无 !player.flying (两种观战飞行右键=瞄准), 保留 !player.loiter (2026-11-10 跟码: capitalGun 项随大舰子系统下架摘除)',
 s19.includes('if(player.alive&&!player.loiter&&!player.onMG&&!player.onVehicle&&!player.onNaval&&!player.onAT&&!player.onAA&&!player.onMortar&&!player.onBattery) player.ads=true;')
 &&!s19.includes('&&!player.flying&&!player.onMG&&!player.onVehicle&&!player.onNaval&&!player.onAT'));
assert('19 KeyU: 制导中切弹体视角 (loiter 门在 onNaval 之前)',
 s19.includes("if(e.code==='KeyU'){ if(player.loiter){ player.loiterView=player.loiterView?0:1; AudioSys.click(1400,0.25,0.05); } else if(player.onNaval) navalCycleView(); else toggleThirdPerson(); }"));
assert('19 KeyF 纯交互 (旧 loiter 分支已摘)',
 s19.includes('tryInteract();\n}')
 &&!s19.includes('if(player.loiter){ player.loiterView=player.loiterView?0:1; AudioSys.click(1400,0.25,0.05); }\nelse tryInteract();'));
assert('19 气动飞行提示 = 空格加速 (旧右键加速串已摘)',
 s19.includes("showScorePop('气动飞行 · 沿视线前飞 · 空格加速 · 俯冲触地落地');")
 &&!s19.includes('右键加速 · 俯冲触地落地'));

const s20=srcOf('js/20-player.js');
assert('20 气动加速读 keys.Space (旧 mouse2Down 写法已摘)',
 s20.includes('const spd=dampF(p._aeroSpd||13,((keys.Space&&!p._ltSpace)?40:13),2.2,dt);')
 &&!s20.includes('const spd=dampF(p._aeroSpd||13,(mouse2Down?40:13),2.2,dt);'));
assert('20 loiter 相机: 开镜判定 lz + 强制第一人称 third + LOITER_ZOOM_FOV',
 s20.includes('const LOITER_ZOOM_FOV=30;')
 &&s20.includes('const lz=mouse2Down&&!p._ltRClick;')
 &&s20.includes('const third=lz?0:p.loiterView;')
 &&s20.includes('const tgtFov=lz?LOITER_ZOOM_FOV:(third?70:85);')
 &&(s20.match(/camera\.fov=dampF\(camera\.fov,tgtFov,8,dt\);/g)||[]).length===2);
assert('20 制导分支 _ltSpace 清零与 _ltRClick 同构',
 s20.includes('if(!keys.Space) p._ltSpace=false;'));
assert('20 顶栏提示 = 空格加速/右键开镜/U 切换视角 (旧串已摘)',
 s20.includes("<b>空格</b> 加速 · <b>右键</b> 开镜 · <b>鼠标</b> 制导 · <b>U</b> 切换视角")
 &&!s20.includes('<b>右键</b> 加速 · <b>鼠标</b> 制导 · <b>F</b> 切换视角'));

const s13=srcOf('js/13-combat.js');
assert('13 boost 读 keys.Space&&!_ltSpace (旧 mouse2Down&&!_ltRClick 已摘)',
 s13.includes('const boost=keys.Space&&!player._ltSpace;')
 &&!s13.includes('const boost=mouse2Down&&!player._ltRClick;'));
assert('13 fireLoiter 吞发射瞬间按住的空格 (_ltSpace=!!keys.Space)',
 s13.includes('player._ltClick=true; player._ltRClick=true; player._ltSpace=!!keys.Space;'));
assert('13 TV 灵敏度跟当前 fov (camera.fov/74, 旧 85/74 已摘)',
 s13.includes('*(camera.fov/74)')&&!s13.includes('*(85/74)'));
assert('13 弹体可见性含开镜态 (loiterView||lz)',
 s13.includes('const lz=mouse2Down&&!player._ltRClick;')
 &&s13.includes('d.mesh.visible=!(player.alive&&(!player.loiterView||lz));'));

assert('24 触屏 ADS 门无 !player.flying',
 !srcOf('js/24-main.js').includes('&&!player.flying&&!player.onMG&&!player.onVehicle&&!player.onNaval&&!player.onAT&&!player.onAA&&!player.onMortar&&!player.onBattery&&!player.specViewHost'));
assert('19b 手柄 ADS 门无 !player.flying',
 !srcOf('js/19b-gamepad.js').includes('&&!player.flying&&!player.onMG&&!player.onVehicle&&!player.onNaval&&!player.onAT&&!player.onAA&&!player.onMortar&&!player.onBattery&&!player.specViewHost'));
assert('22 面板提示 = 空格 加速 · 右键 开镜 · U 切换视角',
 srcOf('js/22-hud.js').includes("t2('鼠标 制导 · 左键 自爆 · 空格 加速 · 右键 开镜 · U 切换视角 · 本体定身')"));
const i18n=srcOf('js/00b-i18n.js');
assert('i18n 新键在 / 旧键已摘 (制导提示/气动弹窗/顶栏)',
 i18n.includes("'鼠标 制导 · 左键 自爆 · 空格 加速 · 右键 开镜 · U 切换视角 · 本体定身':")
 &&i18n.includes("'气动飞行 · 沿视线前飞 · 空格加速 · 俯冲触地落地':")
 &&!i18n.includes("'鼠标 制导 · 左键 自爆 · 右键 加速 · F 切换视角':")
 &&!i18n.includes("'气动飞行 · 沿视线前飞 · 右键加速 · 俯冲触地落地':"));

// 版本戳 (本批升 20261128b: index.html 全量 + __sfStyleVer + _game_files 全行)
const idx=SRC('index.html'), gf=SRC('dev/_game_files.txt');
const stamps=[...idx.matchAll(/20261128b/g)].length;
assert('版本戳 20261128b: index.html ≥48 处 + __sfStyleVer + _game_files 45 行 + 旧 20261106a 清零 (2026-11-10 海战移除批判据跟码)',
 stamps>=48&&idx.includes("window.__sfStyleVer='20261128b';")
 &&gf.split(/\r?\n/).filter(l=>l.includes('?v=20261128b')).length===45
 &&!idx.includes('20261106a')&&!gf.includes('20261106a'));
}

// ── 沙箱装载 (真 three; 与 verify-parity 同款 boot + 可记录事件桩) ─────
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
	const stub=require('./_bootstub.js');
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
	createBufferSource(){ return {buffer:null,loop:false,playbackRate:AP(),start(){},stop(){},connect(){}}; }
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
	// 事件桩: 记录型 addEventListener + dispatchEvent + 事件类 —— 键鼠处理链走真 handler
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
	ctx.localStorage={_s:{sf_campaign:String(campIdx),sf_pseed:'424242'},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
	for(const f of FILES){ let code=srcOf(f); vm.runInContext(code,ctx,{filename:f}); }
	return {ctx,T};
}
let IDX=-1;
{ const c0=boot(0); IDX=vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="normandy")',c0.ctx); }

function bootStart(campIdx,label){
const {ctx}=boot(campIdx);
const G=s=>vm.runInContext(s,ctx,{timeout:300000});
let err=null;
try{ G("document.getElementById('startBtn').onclick();"); }catch(e){ err='start: '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); }
if(!err){ try{ G('if(!player.alive||!player.deployed) deployPlayer();'); }catch(e){ err='deploy: '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); } }
if(!err) try{ G('for(const s of soldiers) s.protUntil=0; player.protUntil=0;'); }catch(e){}
if(!err) try{ G('for(const s of soldiers){ if(!s.isPlayer&&!s.zombie){ s.pos.x+=800; s.pos.z+=800; s.pos.y=heightAt(s.pos.x,s.pos.z); if(s.path) s.path.length=0; } }'); }catch(e){}
assert(label+' 开局+部署',!err&&G('player.alive')===true,err||'');
return {ctx,G};
}

// ── ② 气动飞行: 空格加速 / 右键不再加速 ──
section('② 气动飞行 (H) 加速键 = 空格 (normandy 真开局)');
const A=bootStart(IDX,'② 开局');
{
A.G("player.spectator=true; player.alive=true; player.flying=true; player.flyAero=true; player.crouch=false; player.prone=false; player.onGround=false; player.thirdPerson=false; player.ads=false; player.yaw=0; player.pitch=0; player.pos.y=heightAt(player.pos.x,player.pos.z)+80; player.vel.set(0,2.5,0); player._aeroSpd=13;");
const r1=A.G("(()=>{ keys.Space=true; for(let i=0;i<45;i++) specFlightMove(player,1/60); return player._aeroSpd; })()");
assert('②-1 按住空格 45 帧 → 气动速度阻尼向 40 (>25)',r1>25,'_aeroSpd='+r1.toFixed(1));
const r2=A.G("(()=>{ keys.Space=false; mouse2Down=true; player._aeroSpd=13; for(let i=0;i<45;i++) specFlightMove(player,1/60); const v=player._aeroSpd; mouse2Down=false; return v; })()");
assert('②-2 按住右键 45 帧 → 不再加速 (保持≈13, 旧写法会冲到 ~31)',r2<14.5,'_aeroSpd='+r2.toFixed(1));
}

// ── ③ 飞行中右键 = 瞄准 (真 mousedown/mouseup 链) + 第三人称强制第一人称 ──
section('③ 观战飞行右键 = 瞄准 ADS (dispatch 真事件链)');
{
A.G("player.flying=true; player.flyAero=true; pointerLocked=true;");
A.G("dispatchEvent(new MouseEvent('mousedown',{button:2}));");
const a1=A.G("({ads:player.ads===true,m2:mouse2Down===true,plk:pointerLocked===true,map:typeof cmdMapUIOpen==='function'?cmdMapUIOpen():'nf',svh:player.specViewHost||null,sv:player.specView||null,rba:(typeof player.readBarActive==='function')?player.readBarActive():'nf',gates:{loiter:!!player.loiter,oV:!!player.onVehicle,oMG:!!player.onMG,oN:!!player.onNaval,oAT:!!player.onAT,oAA:!!player.onAA,oM:!!player.onMortar,oB:!!player.onBattery,cG:!!player.capitalGun}})");
A.G("dispatchEvent(new MouseEvent('mouseup',{button:2}));");
const a2=A.G('player.ads===false && mouse2Down===false');
assert('③-1 气动飞行中 mousedown 右键 → player.ads=true, mouseup 复位',a1.ads&&a1.m2&&a2,JSON.stringify(a1));
const a3=A.G("(()=>{ player.thirdPerson=true; player.ads=true; const off=thirdPersonOn()===false; player.ads=false; const on=thirdPersonOn()===true; player.thirdPerson=false; return {off,on}; })()");
assert('③-2 飞行+第三人称+ADS → thirdPersonOn()=false (强制第一人称), 松开恢复',a3.off&&a3.on,JSON.stringify(a3));
}

// ── ④ 巡飞弹: KeyU 切视角 / KeyF 无操作 ──
section('④ 巡飞弹视角切换 F→U (dispatch 真事件链)');
{
A.G("(()=>{ player.loiter=null; player._ltClick=false; player._ltRClick=false; player._ltSpace=false; keys.Space=false; mouseDown=false; mouse2Down=false; player.loiterView=0; fireLoiter(player,new THREE.Vector3(player.pos.x,player.pos.y,player.pos.z-2),new THREE.Vector3(0,0,-1)); })()");
const b0=A.G('!!player.loiter && player.loiterView===0 && player._ltRClick===true');
A.G("dispatchEvent(new KeyboardEvent('keydown',{code:'KeyU'})); dispatchEvent(new KeyboardEvent('keyup',{code:'KeyU'}));");
const b1=A.G('player.loiterView===1');
A.G("dispatchEvent(new KeyboardEvent('keydown',{code:'KeyU'})); dispatchEvent(new KeyboardEvent('keyup',{code:'KeyU'}));");
const b2=A.G('player.loiterView===0');
assert('④-1 KeyU 在制导中翻转弹体视角 (0→1→0)',b0&&b1&&b2,`fire=${b0} u1=${b1} u2=${b2}`);
const b3=A.G("(()=>{ dispatchEvent(new KeyboardEvent('keydown',{code:'KeyF'})); dispatchEvent(new KeyboardEvent('keyup',{code:'KeyF'})); return player.loiterView===0 && !!player.loiter; })()");
assert('④-2 制导中 KeyF 无操作 (tryInteract 首行 loiter 门吞掉, 视角/弹不变)',b3===true,String(b3));
}

// ── ⑤ 巡飞弹加速 = 空格 + _ltSpace 吞边沿 ──
section('⑤ 巡飞弹加速键 = 空格 (吞边沿同构 _ltRClick)');
{
// 场景1: 发射时空格未按 → 按住空格加速
A.G("(()=>{ keys.Space=false; mouse2Down=false; player.loiter=null; fireLoiter(player,new THREE.Vector3(player.pos.x,player.pos.y,player.pos.z-2),new THREE.Vector3(0,0,-1)); })()");
const c0=A.G('player._ltSpace===false');
A.G("(()=>{ keys.Space=true; for(let i=0;i<45;i++) updateLoiters(1/60,1/60); })()");
const c1=A.G('player.loiter.spd');
assert('⑤-1 发射(空格未按)→按住空格 45 帧 → 弹速阻尼向 40 (>25)',c0&&c1>25,`flag=${c0} spd=${c1.toFixed(1)}`);
// 场景2: 发射瞬间空格按住 → 吞边沿, 完整松开前不加速
A.G("(()=>{ keys.Space=false; for(let i=0;i<3;i++) updateLoiters(1/60,1/60); player.loiter=null; keys.Space=true; fireLoiter(player,new THREE.Vector3(player.pos.x,player.pos.y,player.pos.z-2),new THREE.Vector3(0,0,-1)); })()");
const c2=A.G('player._ltSpace===true');
A.G("(()=>{ for(let i=0;i<45;i++) updateLoiters(1/60,1/60); })()");
const c3=A.G('player.loiter.spd');
assert('⑤-3 发射瞬间空格按住 → _ltSpace 吞边沿, 45 帧不加速 (<14.5)',c2&&c3<14.5,`flag=${c2} spd=${c3.toFixed(1)}`);
// 松开一帧清旗 (真实清账路径 = updatePlayer 制导分支, 非 updateLoiters) → 再按加速
A.G("(()=>{ keys.Space=false; updatePlayer(1/60); keys.Space=true; for(let i=0;i<45;i++) updateLoiters(1/60,1/60); })()");
const c4=A.G('player.loiter.spd');
assert('⑤-4 完整松开一次后空格恢复加速 (>25)',c4>25,'spd='+c4.toFixed(1));
keys_reset(A);
}
function keys_reset(A){ A.G("keys.Space=false; mouseDown=false; mouse2Down=false; player._ltClick=false; player._ltRClick=false; player._ltSpace=false;"); }

// ── ⑥ 开镜放大: fov 30 + 强制第一人称 + 弹体同 TV 档藏 ──
section('⑥ 巡飞弹右键开镜 (fov→30, 强制第一人称, 藏弹体)');
{
A.G("keys.Space=false; mouse2Down=false; player._ltRClick=false; player._ltSpace=false; player.loiterView=1; camera.fov=85;");
A.G("(()=>{ for(let i=0;i<40;i++){ updateLoiters(1/60,1/60); updateCamera(1/60); } })()");
const d1=A.G("({fov:camera.fov,dist:camera.position.distanceTo(player.loiter.pos),vis:player.loiter.mesh.visible})");
assert('⑥-4 第三人称档·未开镜 → fov→70, 背追≈6.8m, 弹体可见',
 Math.abs(d1.fov-70)<3&&d1.dist>4&&d1.vis===true,`fov=${d1.fov.toFixed(1)} dist=${d1.dist.toFixed(2)} vis=${d1.vis}`);
A.G("(()=>{ mouse2Down=true; for(let i=0;i<40;i++){ updateLoiters(1/60,1/60); updateCamera(1/60); } })()");
const d2=A.G("({fov:camera.fov,dist:camera.position.distanceTo(player.loiter.pos),vis:player.loiter.mesh.visible})");
assert('⑥-5 按住右键开镜 → fov 收窄到 30 (<35)',d2.fov<35,'fov='+d2.fov.toFixed(1));
assert('⑥-6 开镜强制第一人称 (相机贴弹鼻 <1.5m)',d2.dist<1.5,'dist='+d2.dist.toFixed(2));
assert('⑥-7 开镜中弹体隐藏 (单写者判据含 lz)',d2.vis===false,'vis='+d2.vis);
A.G("(()=>{ mouse2Down=false; for(let i=0;i<40;i++){ updateLoiters(1/60,1/60); updateCamera(1/60); } })()");
const d3=A.G("({fov:camera.fov,dist:camera.position.distanceTo(player.loiter.pos),vis:player.loiter.mesh.visible,lv:player.loiterView})");
assert('⑥-8 松开右键 → 恢复原第三人称档 (fov→70, 背追, 弹体可见, loiterView 不被改写)',
 Math.abs(d3.fov-70)<3&&d3.dist>4&&d3.vis===true&&d3.lv===1,`fov=${d3.fov.toFixed(1)} dist=${d3.dist.toFixed(2)} vis=${d3.vis} lv=${d3.lv}`);
A.G("player.loiter=null;");
}

console.log('\n' + (BAD.length? `✗ ${BAD.length} 红 / ${OK.length} 绿` : `✓ 全绿 (${OK.length})`));
if(BAD.length){ process.exitCode=1; if(NEG) console.log('(阴性对照: 有红=判据具备分辨力)'); }
else if(NEG){ console.log('✗ 阴性对照全绿 = 判据空转!'); process.exitCode=1; }
