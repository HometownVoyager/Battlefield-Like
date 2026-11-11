// ─────────────────────────────────────────────────────────────
// dev/verify-specview-20261101.js —— 真附身呈现层批 (2026-11-01) + 实机修复轮 (2026-11-02) 验收
//   ① 宿主模型第一人称收纳: ★buildSoldierMesh 返回**包装对象**, 真身是 .root —— 2026-11-02 实机修复:
//     旧写 h.mesh.visible 是普通对象闲散属性 (three.js 不读) ⇒ 宿主模型从未被藏掉 = 两个身体/枪怼脸/
//     相机钻进头盔黑屏 (用户实机截图 582/583/584/585/587 实证)。五处写点全改 .root + 还原守卫
//     (阵亡不还原=布娃娃接管 / 登车登艇不还原=车内自管)。
//   ② 姿态旗镜像: updateCamera 步行分支在 specViewTick 之后仍会把 p.eyeH 往玩家自身姿态阻尼 ⇒
//     prone/crouch 一并镜像到 player (dbgSpecPossess 存 / dbgSpecDetach·deployPlayer·换局还原)。
//   ③ HUD 换宿主心: 血条/弹药面板(curW 镜像)/低血晕影/绷带行/压制晕影 (22-hud _hv/_hhp)。
//   ④ 反馈链不记分: 宿主出膛=vmFireKick+微震镜 (13-combat) / 宿主命中=白档 / 宿主击杀=红档+音
//     (onHostKill 单源, 14-bots·25-zombies 两门) —— 附身只读借眼, 玩家战绩一分不沾。
//   ⑤ 👁 指示条按罗盘实测底边重定位 (固定 top:84px 压罗盘, 实机 587 实证) + 脱离键两模式分文案。
//   ⑥ ★2026-11-02 实机修复轮②: 调试附身鼠标吞键门 (mousedown 独立监听器, 右键曾照旧 player.ads=true
//     ⇒ FP 视角宿主的枪做出瞄准动作, 用户实机报) + 手柄/触屏 ADS 同门; 👁 指示条全屏层门
//     (重部署页/暂停罩/结算页开着即收起 —— body 挂件 z-index:40 高于 .screen:20, 用户实机报)。
//
// 用法: node dev/verify-specview-20261101.js [--neg]
//   --neg = 阴性对照: 装载前把本批核心改动按文本还原成旧写法, 同一批判据必须报红。
// ─────────────────────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const NEG=process.argv.includes('--neg');
const OK=[],BAD=[];
function assert(name,cond,detail){ (cond?OK:BAD).push(name); console.log(`  ${cond?'✓':'✗'} ${name}${detail?'  '+detail:''}`); }
function section(t){ console.log('\n══ '+t+' ══'); }
const SRC=f=>fs.readFileSync(path.join(root,f),'utf8');

// ── 阴性对照 (锚点用修后原文; 找不到就抛错; 单行锚, 源文件 CRLF 不跨行) ──
const PATCHES=[
 // ① 宿主模型收纳退场 = 实机两身体病根复现
 ['js/20-player.js',
  "function svHostModelRestore(){ const h=player.specViewHost; if(h&&h.alive&&!h.onVehicle&&!h.onNaval&&h.mesh&&h.mesh.root) h.mesh.root.visible=true; }",
  "function svHostModelRestore(){ const h=player.specViewHost; if(h&&h.mesh) h.mesh.visible=true; }"],
 ['js/20-player.js',
  "if(h.mesh&&h.mesh.root) h.mesh.root.visible=(typeof thirdPersonOn==='function')?thirdPersonOn():false;",
  "if(h.mesh) h.mesh.visible=true;"],
 ['js/20-player.js',
  "if(h.mesh&&h.mesh.root) h.mesh.root.visible=false;",
  "if(h.mesh) h.mesh.visible=true;"],
 // ② 视角半圈/弹药镜像/姿态旗退场 (split/join 命中调试+视模式两处)
 ['js/20-player.js',
  "player.yaw=(h.yaw||0)+Math.PI; player.pitch=h.pitch||0;",
  "player.yaw=(h.yaw||0); player.pitch=h.pitch||0;"],
 ['js/20-player.js',
  "svHostWeaponMirror(h);   // 宿主当前武器单源 (2026-11-04): curW 钉定 + VM 换枪 (含副武器), specViewPossess 同源",
  "player.curW=player.curW;"],
 ['js/20-player.js',
  "player.prone=!!h.prone; player.crouch=!!h.crouch;",
  ""],
 // ③ 还原单源路由退场 (再部署路径回旧无效写)
 ['js/23-deploy.js',
  "if(typeof svHostModelRestore==='function') svHostModelRestore();   // 真附身: 宿主模型收纳还原 (再部署顶替脱离单源; 显隐守卫单源 2026-11-02: mesh 是包装对象, 真身 .root)",
  "if(p.specViewHost.mesh) p.specViewHost.mesh.visible=true;"],
 // ④ 反馈链退场: 宿主出膛钩 / 宿主击杀门 / 击杀红档音
 ['js/13-combat.js',
  "player&&player.specViewHost&&player.specViewHost===shooter",
  "player&&!player.specView&&player.specViewHost&&player.specViewHost===shooter"],
 ['js/14-bots.js',
  "else if(typeof player!=='undefined'&&player&&attacker===player.specViewHost&&typeof onHostKill==='function'){ onHostKill(); }",
  ""],
 ['js/21-match.js',
  "if(nowT-_lastKillSndT>=0.25){ _lastKillSndT=nowT; AudioSys.hitmarkSnd(true); }",
  ""],
 // ⑤ HUD 换宿主心退场 / 指示条重定位退场 / 附身键吞退场
 ['js/22-hud.js',
  "const _hv=(player.specViewHost&&player.specViewHost.alive)?player.specViewHost:null;",
  "const _hv=null;"],
 ['js/22-hud.js',
  "const _cp=document.getElementById('compass');",
  "const _cp=null;"],
 ['js/19-input.js',
  "if(player.specViewHost&&e.code!=='KeyU'){",
  "if(false){"],
 // ⑥b ★2026-11-02 实机修复轮: 鼠标吞键门 / 三输入端 ADS 门 / 全屏层指示条门 退场
 ['js/19-input.js',
  "if(player.specViewHost) return;",
  ";"],
 ['js/19b-gamepad.js',
  "&&!player.onBattery&&!player.specViewHost) player.ads=true;",
  "&&!player.onBattery) player.ads=true;"],
 ['js/24-main.js',
  "&&!player.onBattery&&!player.specViewHost) player.ads=true;",
  "&&!player.onBattery) player.ads=true;"],
 ['js/22-hud.js',
  "if(_svOverlayOpen()){ if(_svInd.style.display!=='none') _svInd.style.display='none'; return; }",
  ";"],
];
const PATCH_MAP={};
if(NEG) for(const [f,from,to] of PATCHES){
 const s=PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f);
 if(s.indexOf(from)<0) throw new Error('阴性对照锚点未找到: '+f+' :: '+from.slice(0,70));
 PATCH_MAP[f]=s.split(from).join(to);
}
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f));

// ── ① 源码防回退: 附身管线核心 (20-player) ────────────────────
section('① 附身管线核心 (源码锚)');
{
const s20=srcOf('js/20-player.js');
assert('20 svHostModelRestore: .root 真身 + 阵亡/登车登艇三守卫 (★2026-11-02 实机修复)',
 s20.includes("function svHostModelRestore(){ const h=player.specViewHost; if(h&&h.alive&&!h.onVehicle&&!h.onNaval&&h.mesh&&h.mesh.root) h.mesh.root.visible=true; }"));
assert('20 调试附身逐帧收纳: FP 收 / 3P (U) 还原, 写 .root 而非包装对象',
 s20.includes("if(h.mesh&&h.mesh.root) h.mesh.root.visible=(typeof thirdPersonOn==='function')?thirdPersonOn():false;"));
assert('20 视模式附身: 宿主模型恒收 (.root)',
 s20.includes("if(h.mesh&&h.mesh.root) h.mesh.root.visible=false;"));
assert('20 姿态旗镜像 (prone/crouch 随宿主, updateCamera eyeTgt 阻尼口径)',
 s20.includes('player.prone=!!h.prone; player.crouch=!!h.crouch;')
 &&s20.includes('player.eyeH=h.prone?0.48:h.crouch?1.12:1.62;'));
assert('20 本体冻结门 + avatar 顶部门 (冻结位不双跑, 屏上无第二具玩家身体)',
 s20.includes('if(p.specViewHost) return;')
 &&s20.includes('if(player.specViewHost){ playerAvatarHide(); return null; }'));
assert('20 角系换算 +π 两处 (调试/视模式), Bot 前向(sin,cos)⇒相机系',
 (s20.match(/player\.yaw=\(h\.yaw\|\|0\)\+Math\.PI; player\.pitch=h\.pitch\|\|0;/g)||[]).length===2);
assert('20 弹药面板镜像 curW 钉宿主主武器两处 + _svCurW 账 (specViewPossess 存/两脱离还原)',
 (s20.match(/svHostWeaponMirror\(h\);/g)||[]).length===2
 &&s20.includes('if(player._svCurW===undefined) player._svCurW=player.curW;')
 &&(s20.match(/player\._svCurW=undefined;   \/\/ 弹药面板镜像账还原/g)||[]).length===2);
assert('20 调试附身存观察位含姿态旗 (pr/cr), 脱离随观察位还原',
 s20.includes('tp:!!player.thirdPerson,pr:!!player.prone,cr:!!player.crouch,vmKey:VM.key}')
 &&s20.includes('player.thirdPerson=!!s.tp; player.prone=!!s.pr; player.crouch=!!s.cr;'));
assert('20 视模式眼位=脚底+姿态高 (与 14-bots eyePos 同式)',
 s20.includes('player.pos.set(h.pos.x,h.pos.y+(h.prone?0.5:h.crouch?1.15:1.62),h.pos.z);'));
assert('20 两模式死亡/登载具自动脱离四门 (尸体不还原模型/车内自管显隐)',
 (s20.match(/if\(!h\.alive\)\{ (dbgSpecDetach\(\)|specViewDetach\(false\)); showScorePop/g)||[]).length===2
 &&(s20.match(/if\(h\.onVehicle\|\|h\.onNaval\)\{ (dbgSpecDetach\(\)|specViewDetach\(false\)); showScorePop/g)||[]).length===2);
assert('20 换弹镜像: 宿主 reloadT>0 且弹匣未满 ⇒ VM 进 reload (★2026-11-03 收编进 svHostActionMirror 单源, 两模式共用; 打断=reloadT 归零而弹匣未满 ⇒ vmAbortAction 同帧收)',
 s20.includes('function svHostActionMirror(h){')
 &&s20.includes("if(VM.state==='idle'&&!(h.slots&&h.slots[0]&&h.slots[0].mag>=h.slots[0].def.mag)){")
 &&s20.includes('VM.state=\'reload\'; VM.stateT=0; VM.stateDur=Math.max(0.3,h.reloadT); vmSndFlags={}; VM.mirrorHost=true;')
 &&(s20.match(/svHostActionMirror\(h\);/g)||[]).length>=2);
assert('20 svHostFireFx 走 vmFireKick 单源 + 微震镜',
 s20.includes("if(typeof vmFireKick!=='function'||!VM.gunParts) return;")&&s20.includes('vmFireKick();')&&s20.includes('addTrauma(0.1);'));
}

// ── ② 源码防回退: HUD 换宿主心 + 呈现层接线 ───────────────────
section('② HUD 换心与呈现层 (源码锚)');
{
const s22=srcOf('js/22-hud.js');
assert('22 血条/体力/低血晕影读宿主 (_hv/_hhp 单源, Bot 无体力账⇒恒满)',
 s22.includes('const _hv=(player.specViewHost&&player.specViewHost.alive)?player.specViewHost:null;')
 &&s22.includes('const _hhp=_hv?_hv.hp:player.hp;')
 &&s22.includes("hudText('hpNum',Math.ceil(_hhp));")
 &&s22.includes("hudStyle('stamBar','width',((_hv?1:player.stamina)*100)+'%');")
 &&s22.includes("hudStyle('lowOv','opacity',_hv?(_hhp<35?(1-_hhp/35)*0.85:0):(player.alive&&player.hp<35?(1-player.hp/35)*0.85:0));"));
assert('22 绷带行换宿主 (★2026-11-03 弹药账对齐: 宿主雷账随绷带一并显示)',
 s22.includes("hudText('nadeN',_hv?(t2('绷带[H] ×{0}',_hv.bandages||0)")
 &&s22.includes("_hv.nades>0?' · '+t2('手雷 ×{0}',_hv.nades):''"));
assert('22 顶栏观战词条附身中隐藏 (左键可开火与只读借眼矛盾; ★2026-11-09 批: 行再纳 SHOW_CTL_HINTS 门)',
 s22.includes('((SHOW_CTL_HINTS&&player.spectator&&!player.specViewHost)?'));
assert('22 显隐矩阵: 附身保留准星/血条/弹药, 收镜筒/雷弧/交互/枪械热量',
 s22.includes("const _SV_HUD_HIDE=['crosshair','hitmark','nadeArc','ammoPanel','healthPanel','interact','heatWrap','scopeOv'];")
 &&s22.includes("const _SV_HUD_HIDE_POS=['nadeArc','interact','scopeOv','heatWrap'];"));
assert('22 👁 指示条按罗盘实测底边重定位 (★2026-11-02: 固定 top:84px 压罗盘)',
 s22.includes("const _cp=document.getElementById('compass');")
 &&s22.includes("_svInd.style.top=(Math.round(_r.bottom)+10)+'px';"));
assert('22 脱离键两模式分文案 (视模式=右键 / 调试=E) + i18n 词条',
 s22.includes("player.specView?t('右键脱离'):t('E 脱离')")
 &&srcOf('js/00b-i18n.js').includes("'右键脱离':'RMB detach'")
 &&srcOf('js/00b-i18n.js').includes("'E 脱离':'E detach'")
 &&srcOf('js/00b-i18n.js').includes("'👁 附身 · {0} ({1}) · {2} {3}/{4} · {5}'"));
assert('22 关调试走脱离单源 / 换局复位含镜像账与姿态旗',
 s22.includes("if(player.specViewHost&&typeof dbgSpecDetach==='function') dbgSpecDetach();")
 &&s22.includes('player.specView=false; player.specViewHost=null; player.specViewSpd=14; player._svCurW=undefined; player.prone=false; player.crouch=false;'));
const s23=srcOf('js/23-deploy.js');
assert('23 再部署: 脱离单源路由 + 镜像账/姿态旗清账',
 s23.includes("if(typeof svHostModelRestore==='function') svHostModelRestore();")
 &&s23.includes('p.specViewHost=null; p._svSaved=null; p._svCurW=undefined; p.thirdPerson=false; p.prone=false; p.crouch=false;'));
const s19=srcOf('js/19-input.js');
assert('19 附身中战斗/交互键一律吞 (只读借眼; U/J/K 放行, keyup 不经过不留死账)',
 s19.includes("if(player.specViewHost&&e.code!=='KeyU'){"));
assert('19 ★鼠标吞键门 (调试附身 mousedown 早退: 键盘吞键门管不到鼠标这条独立监听器, 右键曾照旧进 ADS)',
 s19.includes('调试附身中鼠标也归"只读借眼"')
 &&s19.includes('if(player.specViewHost) return;')
 &&s19.indexOf('if(player.specViewHost) return;')<s19.indexOf('player.readBarActive()&&!(typeof VM'));
assert('19b 手柄 LT 瞄准门 + 24 触屏瞄准门: 附身中不进 ADS (三输入端同门)',
 srcOf('js/19b-gamepad.js').includes('&&!player.onBattery&&!player.specViewHost) player.ads=true;')
 &&srcOf('js/24-main.js').includes('&&!player.onBattery&&!player.specViewHost) player.ads=true;'));
assert('22 ★👁 指示条全屏层门: 重部署/暂停/结算任一开着即收起 (body 挂件 z-index:40 > .screen:20), 关闭后 _svIndShow 单源复显+重定位',
 s22.includes('function _svOverlayOpen(){')
 &&s22.includes("if(_svOverlayOpen()){ if(_svInd.style.display!=='none') _svInd.style.display='none'; return; }")
 &&s22.includes('function _svIndShow(){'));
const s24=srcOf('js/24-main.js');
assert('24 specViewTick 每帧旁路 (updatePlayer 之后 / updateCamera 之前)',
 s24.includes("if(typeof specViewTick==='function') specViewTick(pdt);"));
assert('15c 幽灵坦克召唤朝向玩家 (yaw+π 同角系口径)',
 srcOf('js/15c-specveh.js').includes('specVehPlaceNear(player.pos.x,player.pos.z,player.yaw+Math.PI);'));
}

// ── ③ 源码防回退: 命中/击杀反馈链 (只读不记分) ────────────────
section('③ 反馈链不记分 (源码锚)');
{
const s13=srcOf('js/13-combat.js');
assert('13 宿主出膛 = svHostFireFx (★2026-11-03 两模式统一: 视模式附身同吃出膛反馈, 旧 !player.specView 门绝迹)',
 s13.includes("if(typeof player!=='undefined'&&player&&player.specViewHost&&player.specViewHost===shooter&&typeof svHostFireFx==='function') svHostFireFx(def);")
 &&!s13.includes('!player.specView&&player.specViewHost'));
assert('13 宿主命中三档白档 (士兵/对空刮血/装甲刮血)',
 s13.includes("else if(typeof player!=='undefined'&&player&&shooter===player.specViewHost&&sr.sol.alive&&typeof onPlayerHit==='function') onPlayerHit(sr.sol,sr.head);")
 &&(s13.match(/else if\(typeof player!=='undefined'&&player&&shooter===player\.specViewHost&&typeof onPlayerHitVeh==='function'\) onPlayerHitVeh\(\);/g)||[]).length===2);
const s14=srcOf('js/14-bots.js');
assert('14 宿主受击 = 附身者的屏 (红闪+微震镜+来向弧, 与玩家 damage 同套, die 判定前)',
 s14.includes('if(typeof player!==\'undefined\'&&player&&this===player.specViewHost){')
 &&s14.includes('if(typeof addDmgFlash===\'function\') addDmgFlash(Math.min(0.5,0.2+amt*0.004));')
 &&s14.includes('if(typeof addTrauma===\'function\') addTrauma(0.15);')
 &&s14.includes('if(attacker&&typeof addDirHit===\'function\') addDirHit(Math.atan2(attacker.pos.x-this.pos.x,attacker.pos.z-this.pos.z));'));
assert('14 宿主击杀 → onHostKill (不记分门)',
 s14.includes("else if(typeof player!=='undefined'&&player&&attacker===player.specViewHost&&typeof onHostKill==='function'){ onHostKill(); }"));
assert('25 丧尸同门 (宿主杀丧尸红档无分)',
 srcOf('js/25-zombies.js').includes("else if(typeof player!=='undefined'&&player&&attacker===player.specViewHost&&typeof onHostKill==='function'){ onHostKill(); }"));
assert('21 onHostKill 单源: 红档+0.25s 节流音, 不进 onPlayerKill 记分链',
 srcOf('js/21-match.js').includes('function onHostKill(){\nhmShow(_hitCls,true);\nif(nowT-_lastKillSndT>=0.25){ _lastKillSndT=nowT; AudioSys.hitmarkSnd(true); }\n}'));   // 该文件此段是 LF 行尾 (仓库混用, 锚按实情)
}

// ── 沙箱装载 (真 three; 与 verify-batch-20261030 同款) ─────
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
const FILES=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/23-deploy.js','js/24-main.js'];
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
	ctx.window=window; ctx.globalThis=ctx;
	ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
	for(const f of FILES){ let code=srcOf(f); vm.runInContext(code,ctx,{filename:f}); }
	return {ctx,T};
}

{
const {ctx}=boot(8);
const run=e=>vm.runInContext(e,ctx,{timeout:600000});

// ── ④ 调试附身: 钉位/换装/收纳/脱离 (行为, 假宿主) ──
section('④ 调试附身矩阵 (行为)');
const t1=run(`(()=>{ const out={};
const p=player;
p.alive=true; p.isPlayer=true; p.spectator=true; p.specView=false; p.specViewHost=null; p._svSaved=null;
p.pos.set(100,50,100); p.yaw=0.3; p.pitch=-0.2;
p.slots=[{key:'kar98',def:WPN_DEFS.kar98,mag:5,reserve:50}]; p.curSlot=0; p.curW=p.slots[0]; vmEquip('kar98',0);
p.prone=false; p.crouch=false; p.thirdPerson=false;
const fake={alive:true,onVehicle:null,onNaval:null,capCrew:false,name:'假宿主',team:0,
 pos:new THREE.Vector3(10,2,30),prone:false,crouch:true,yaw:1.2,pitch:0.3,
 mesh:{root:new THREE.Group()},slots:[{key:'thompson',def:WPN_DEFS.thompson,mag:3,reserve:90}],
 suppression:0.4,reloadT:0,bandages:2,hp:77};
dbgSpecPossess(fake);
out.host=(player.specViewHost===fake);
out.savedKept0=(player._svSaved&&player._svSaved.x===100);
out.vmKey=VM.key; out.vmVis=VM.root.visible;
specViewTick(0.016);
out.pin=(player.pos.x===10&&player.pos.y===2&&player.pos.z===30);          // 钉脚底
out.yaw=Math.abs(player.yaw-(1.2+Math.PI))<1e-9; out.pitch=(player.pitch===0.3);
out.yawV=player.yaw; out.pitchV=player.pitch; out.eyeHV=player.eyeH; out.posV=[player.pos.x,player.pos.y,player.pos.z];
out.eyeH=(player.eyeH===1.12); out.mCrouch=(player.crouch===true); out.mProne=(player.prone===false);
out.hidden=(fake.mesh.root.visible===false);                                // ★FP ⇒ 宿主模型必须收纳 (.root)
out.curW=(player.curW===fake.slots[0]); out.sup=(player.suppressV===0.4);
const sx=player._svSaved.x;
dbgSpecPossess(fake); out.savedKept=(player._svSaved.x===sx);               // 二次 Q 换目标: 观察位账不覆盖
player.thirdPerson=true; specViewTick(0.016); out.third=(fake.mesh.root.visible===true);
player.thirdPerson=false; specViewTick(0.016); out.fpAgain=(fake.mesh.root.visible===false);
dbgSpecDetach();
out.detHost=(player.specViewHost===null);
out.dpos=[player.pos.x,player.pos.y,player.pos.z]; out.dpitch=player.pitch; out.dvm=VM.key;
out.dcurW=(player.curW===p.slots[0]); out.dsv=player._svCurW; out.dhost=fake.mesh.root.visible;
out.dstance=[player.crouch,player.prone];
out.back=(player.pos.x===100&&player.pos.y===50&&player.pos.z===100&&player.pitch===-0.2);
out.backVm=(VM.key==='kar98'); out.curWBack=(player.curW===p.slots[0]); out.svClear=(player._svCurW===undefined);
out.hostVis=(fake.mesh.root.visible===true);                                // 活人/未登车 ⇒ 还原
out.stanceBack=(player.crouch===false&&player.prone===false);
return out; })()`);
assert('④ 附身挂账 + VM 换宿主枪 + 观察位保存',t1.host===true&&t1.savedKept0===true&&t1.vmKey==='thompson'&&t1.vmVis===true,
 `vmKey=${t1.vmKey}`);
assert('④ 逐帧钉位: 脚底/yaw+π/pitch/姿态旗镜像 (蹲姿 eyeH=1.12)',t1.pin===true&&t1.yaw===true&&t1.pitch===true&&t1.eyeH===true&&t1.mCrouch===true&&t1.mProne===true,
 `pos=${JSON.stringify(t1.posV)} yaw=${t1.yawV} pitch=${t1.pitchV} eyeH=${t1.eyeHV} mC=${t1.mCrouch} mP=${t1.mProne}`);
assert('④ ★FP 宿主模型收纳 (.root 真身, 实机两身体病根)',t1.hidden===true);
assert('④ 弹药面板镜像 curW→宿主主武器 + 压制晕影随宿主',t1.curW===true&&t1.sup===true);
assert('④ 二次 Q 换目标不覆盖观察位账',t1.savedKept===true);
assert('④ U 第三人称: 宿主模型还原 (屏上唯一身体=宿主)',t1.third===true&&t1.fpAgain===true);
assert('④ E 脱离: 全账还原 (观察位/VM/curW/_svCurW/姿态旗) + 宿主模型还原',
 t1.detHost===true&&t1.back===true&&t1.backVm===true&&t1.curWBack===true&&t1.svClear===true&&t1.hostVis===true&&t1.stanceBack===true,
 `det=${t1.detHost} back=${t1.back} vm=${t1.backVm} curW=${t1.curWBack} sv=${t1.svClear} host=${t1.hostVis} stance=${t1.stanceBack} raw=${JSON.stringify(t1.dpos)} p=${t1.dpitch}`);

// ── ⑤ 自动脱离门 + 还原守卫 + 视模式附身 (行为) ──
section('⑤ 死亡/登车自动脱离 + 守卫 (行为)');
const t2=run(`(()=>{ const out={};
const p=player;
p.alive=true; p.spectator=true; p.specView=false; p.specViewHost=null; p._svSaved=null;
p.pos.set(100,50,100); p.yaw=0.3; p.pitch=-0.2; p.prone=false; p.crouch=false;
const mk=()=>({alive:true,onVehicle:null,onNaval:null,capCrew:false,name:'假宿主',team:0,
 pos:new THREE.Vector3(10,2,30),prone:true,crouch:false,yaw:0.5,pitch:0,
 mesh:{root:new THREE.Group()},slots:[{key:'thompson',def:WPN_DEFS.thompson,mag:3,reserve:90}],
 suppression:0,reloadT:0,bandages:1,hp:80});
const f1=mk(); dbgSpecPossess(f1); specViewTick(0.016);
out.proneEye=(player.eyeH===0.48); out.proneFlag=(player.prone===true);
f1.alive=false;                                                             // 宿主阵亡 ⇒ 自动脱离+还原, 尸体模型**不**还原 (布娃娃接管)
specViewTick(0.016);
out.deadDetach=(player.specViewHost===null);
out.deadMesh=(f1.mesh.root.visible===false);                                // ★alive 守卫: 不把尸体亮回来
out.deadBack=(player.pos.x===100);
const f2=mk();
dbgSpecPossess(f2); specViewTick(0.016);
f2.onVehicle={};                                                            // 登车 ⇒ 自动脱离, 车内自管显隐 ⇒ 守卫不还原
specViewTick(0.016);
out.vehDetach=(player.specViewHost===null);
out.vehMesh=(f2.mesh.root.visible===false);
const f3=mk(); f3.onVehicle=null; f3.onNaval=null;
p.alive=false; p.specView=true; p.specViewHost=null;                        // 视模式 (死者): 眼位=脚底+姿态高, 模型恒收
specViewPossess(f3); specViewTick(0.016);
out.vEye=(player.pos.y===2.5); out.vMesh=(f3.mesh.root.visible===false);
out.vCurW=(player.curW===f3.slots[0]);
out.vYaw=Math.abs(player.yaw-(0.5+Math.PI))<1e-9;
f3.alive=false; specViewTick(0.016);                                        // 宿主阵亡 ⇒ 回自由观战
out.vDeadDetach=(player.specViewHost===null);
out.vDeadMesh=(f3.mesh.root.visible===false);
return out; })()`);
assert('⑤ 卧姿宿主: eyeH=0.48 + 姿态旗镜像',t2.proneEye===true&&t2.proneFlag===true);
assert('⑤ 宿主阵亡 ⇒ 自动脱离还原观察位, 尸体模型不还原 (alive 守卫)',
 t2.deadDetach===true&&t2.deadMesh===true&&t2.deadBack===true);
assert('⑤ 宿主登车 ⇒ 自动脱离, 模型不还原 (车内自管显隐守卫)',t2.vehDetach===true&&t2.vehMesh===true);
assert('⑤ 视模式附身: 眼位=脚底+卧姿0.5 / yaw+π / 模型恒收 / curW 镜像',
 t2.vEye===true&&t2.vYaw===true&&t2.vMesh===true&&t2.vCurW===true);
assert('⑤ 视模式宿主阵亡 ⇒ 回自由观战 (尸体模型仍收)',t2.vDeadDetach===true&&t2.vDeadMesh===true);

// ── ⑥ HUD 显隐矩阵 + 换弹镜像 + svHostFireFx (行为) ──
section('⑥ HUD/VM 镜像 (行为)');
const t3=run(`(()=>{ const out={};
const p=player;
p.alive=true; p.spectator=true; p.specView=false; p.specViewHost=null; p._svSaved=null;
p.pos.set(100,50,100);
p.slots=[{key:'kar98',def:WPN_DEFS.kar98,mag:5,reserve:50}]; p.curW=p.slots[0]; vmEquip('kar98',0);
const fake={alive:true,onVehicle:null,onNaval:null,capCrew:false,name:'假宿主',team:0,
 pos:new THREE.Vector3(10,2,30),prone:false,crouch:false,yaw:0,pitch:0,
 mesh:{root:new THREE.Group()},slots:[{key:'thompson',def:WPN_DEFS.thompson,mag:1,reserve:90}],
 suppression:0,reloadT:2.5,bandages:1,hp:80};
dbgSpecPossess(fake); specViewTick(0.016);
out.rlState=VM.state; out.rlDur=VM.stateDur;                                // 宿主换弹 ⇒ VM 换弹动画镜像 (时长=宿主剩余)
specViewHudTick();
out.xh=document.getElementById('crosshair').style.display;                  // 附身保留准星
out.scope=document.getElementById('scopeOv').style.display;                 // 收镜筒
out.interact=document.getElementById('interact').style.display;             // 收交互提示
VM.state='idle'; VM.stateT=0; VM.stateDur=0; VM.recoilV=0; VM.kickV=0;
svHostFireFx(WPN_DEFS.thompson);                                            // 宿主出膛 = vmFireKick 单源
out.kick=(VM.recoilV>0&&VM.kickV>0);
dbgSpecDetach();
out.det=(player.specViewHost===null);
return out; })()`);
assert('⑥ 宿主换弹 → VM.state=reload 时长=宿主剩余 (走玩家既有换弹管线)',
 t3.rlState==='reload'&&Math.abs(t3.rlDur-2.5)<1e-9,`state=${t3.rlState} dur=${t3.rlDur}`);
assert('⑥ HUD 显隐矩阵: 附身保留准星 / 收镜筒与交互提示',
 t3.xh===''&&t3.scope==='none'&&t3.interact==='none',`xh=${t3.xh} scope=${t3.scope} interact=${t3.interact}`);
assert('⑥ svHostFireFx = vmFireKick 后坐+枪口焰 (不记分不进连杀)',t3.kick===true&&t3.det===true);

// ── ⑦ 全屏层指示条门 (行为: gamePaused 旗路径; .screen 类路径沙箱 querySelectorAll=[]) ──
section('⑦ 指示条全屏层门 (行为)');
const t4=run(`(()=>{ const out={};
const getInd=()=>{ for(const c of document.body.children){ if(c&&c.id==='specViewInd') return c; } return null; };   // _svInd 是 createElement+appendChild 建的, 不在 byId 表 (getElementById 会另造新壳)
const p=player;
p.alive=true; p.spectator=true; p.specView=false; p.specViewHost=null; p._svSaved=null;
p.pos.set(100,50,100);
const fake={alive:true,onVehicle:null,onNaval:null,capCrew:false,name:'假宿主',team:0,
 pos:new THREE.Vector3(10,2,30),prone:false,crouch:false,yaw:0,pitch:0,
 mesh:{root:new THREE.Group()},slots:[{key:'thompson',def:WPN_DEFS.thompson,mag:3,reserve:90}],
 suppression:0,reloadT:0,bandages:1,hp:80};
dbgSpecPossess(fake); specViewHudTick();
out.shown=(getInd()?getInd().style.display:null);
gamePaused=true; specViewHudTick();                                         // Esc+Esc 暂停 ⇒ 👁 收起 (不再压在暂停罩上方)
out.paused=(getInd()?getInd().style.display:null);
gamePaused=false; specViewHudTick();                                        // 恢复 ⇒ 复显 (走 _svIndShow 单源, 带重定位)
out.resumed=(getInd()?getInd().style.display:null);
dbgSpecDetach(); specViewHudTick();
out.detached=(getInd()?getInd().style.display:null);          // 脱离 ⇒ 收起 (进位 else 分支)
return out; })()`);
assert('⑦ gamePaused ⇒ 👁 收起 / 恢复 ⇒ 复显 / 脱离 ⇒ 收起',t4.shown==='block'&&t4.paused==='none'&&t4.resumed==='block'&&t4.detached==='none',
 JSON.stringify(t4));

console.log('\n' + (BAD.length? `✗ ${BAD.length} 红 / ${OK.length} 绿` : `✓ 全绿 (${OK.length})`));
if(BAD.length){ process.exitCode=1; if(NEG) console.log('(阴性对照: 有红=判据具备分辨力)'); }
else if(NEG){ console.log('✗ 阴性对照全绿 = 判据空转!'); process.exitCode=1; }
}
