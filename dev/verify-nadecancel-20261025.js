// ─────────────────────────────────────────────────────────────
// dev/verify-nadecancel-20261025.js —— 2026-10-25 举雷/换弹读条化 + 补给弹药改账 批验收
//                                        (含同日反馈轮: 交互抢占打断 + 受创>25 打断门)
//
// 用法: node dev/verify-nadecancel-20261025.js [--neg]
//   --neg = 阴性对照: 装载前把本批核心改动按文本还原成旧写法, 同一批判据必须报红。
//
// 用户裁定 (2026-10-25):
//   ① "拿起手雷/换弹就无法取消, 这不好" —— 举雷待发/换弹并入读条取消网 (X / ✕ / 受击打断 / 抢态收尾);
//   ② 拿取物资仍是原时机, 子弹账改为 reserve=备用上限+弹夹容量 (有意超上限), 不再直接填满弹夹;
//   ③ 反馈轮① "打断其实是指在读条的时候做其他的交互动作会打断读条" —— 动作/交互入口确认起步后
//      stealBar() 抢占 (换枪/装填/举雷/包扎/近战/建造拆除/F 交互栈); 同键重按不抢 (R 不重启换弹、
//      同种雷重举不重烧引信); 系统侧自动换弹 (无 viaKey) 不得抢走玩家举着的雷;
//   ④ 反馈轮② "受伤打断机制改为会被高于25的单次伤害打断" —— READBAR_DMG_GATE=25 单源,
//      单次 >25 (判在减免后的最终 amt) 才打断; ≤25 刮伤不再打断。
//
// 覆盖:
//   A 源码锚: readBarActive 扩容 / cancelReadBar 账目旗先取后收 / stealBar 单源 / 受击打断门+两条新文案 /
//     vmAbortAction 收举雷+换弹 / vmReloadRestore 单源 / NADE_FUSE_T + READBAR_DMG_GATE 单源 /
//     HUD 读条链两条新条目 + 换弹座位门 / tryReload·switchSlot viaKey 抢占 / 四投掷键 sameHeld 守卫 /
//     20-player F 交互栈 14 处 stealBar / 06 建造 1 处 / i18n 新键
//   B 沙箱行为 (真 three): 举雷 X 取消 (雷不消耗·模型收回) / 举雷受创 25 不断·26 打断 / 换弹 X 取消
//     (弹药不结算·弹匣归位) / 换弹自然走完 (回归) / 换弹受创 26 打断·25 不断·R 重按不重启 /
//     doGrabResolve 新弹药账 / 交互抢占 (换枪打断换弹·R 打断举雷·系统 R 不抢·stealBar 安静·H 抢包扎)
//
// 口径: 与 verify-animfix-20261012 同款 boot (真 three + 全 FILES 链), 调用游戏自己的接口
//   (tryReload / switchSlot / player.damage / player.stealBar / player.cancelReadBar / player.doGrabResolve),
//   不重写第二套状态机。
// ─────────────────────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const NEG=process.argv.includes('--neg');
const OK=[],BAD=[];
function assert(name,cond,detail){ (cond?OK:BAD).push(name); console.log(`  ${cond?'✓':'✗'} ${name}${detail?'  '+detail:''}`); }
function section(t){ console.log('\n══ '+t+' ══'); }
const SRC=f=>fs.readFileSync(path.join(root,f),'utf8');
const BAR_PRESS_BOOST=Number((SRC('js/00-config.js').match(/const BAR_PRESS_BOOST=([0-9.]+)/)||[])[1]);   // ★2026-10-30 判据跟走: 探针侧从源码解析 (0.025), 不写死第二份

// ── 阴性对照 (锚点用修后原文; 找不到就抛错, 防"锚点漂移后静默通过"; 单行锚, 10-viewmodel 是 CRLF) ──
const PATCHES=[
 // A 取消网退场: readBarActive 不再认举雷/换弹 (X 门 / 受击打断 / 抢态三路一起断)
 ['js/18-game.js',
  "||(typeof VM!=='undefined'&&((VM.state==='nade'&&this.nadeHeld)||VM.state==='reload')); }",
  "; }"],
 // B 补给弹药账退场: 回到"直接填满弹夹 + 备用顶满"
 ['js/18-game.js',
  "for(const s of this.slots){ s.reserve=s.def.reserve+s.def.mag; }",
  "for(const s of this.slots){ s.reserve=s.def.reserve; s.mag=s.def.mag; }"],
 // C 模型层退场: vmAbortAction 不再收换弹/举雷 (取消后弹匣滞留半路 / 雷模滞留)
 ['js/10-viewmodel.js',
  "else if(st==='reload'){ vmReloadRestore(); steal=true; }",
  "else if(false){ vmReloadRestore(); steal=true; }"],
 ['js/10-viewmodel.js',
  "else if(st==='nade'&&VM.stateDur>10){ if(VM.nadeM) VM.nadeM.visible=false; steal=true; }",
  "else if(false){ if(VM.nadeM) VM.nadeM.visible=false; steal=true; }"],
 // E 反馈轮②退场: 受击打断回到"任意伤害都打断" (25/6 门槛判据必须转红)
 ['js/18-game.js',
  "if(amt>READBAR_DMG_GATE&&this.readBarActive())",
  "if(this.readBarActive())"],
 // F 反馈轮①退场: stealBar 变空壳 (所有交互抢占行为判据转红)
 ['js/18-game.js',
  "stealBar(){ if(this.readBarActive()) this.cancelReadBar(null,true); },",
  "stealBar(){ },"],
 // G tryReload 抢占退场 (★2026-10-30 判据跟走: 打断改双击确认 + 同键重按=加速): R 加速与双击门一并退场,
 //   终态 (举雷中双击 R 收雷再装填) 在阴性下转红 —— 单靠 H 补丁 (viaKey 行变 return) 已让整条路径恒 return
 ['js/19-input.js',
  "if(VM.state==='reload'){ VM.stateT=Math.min(VM.stateDur,(VM.stateT||0)+VM.stateDur*BAR_PRESS_BOOST); return; }",
  "if(VM.state==='reload') return;"],
 ['js/19-input.js',
  "if(!player.barStealArmed('KeyR')) return;",
  ""],
 // H switchSlot 抢占退场: 回到"非 idle/fire 一律不换枪" (换枪打断换弹判据转红)
 ['js/19-input.js',
  "if(!viaKey) return;",
  "return;"],
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
const s18=srcOf('js/18-game.js');
assert('18 readBarActive 认举雷(VM nade+nadeHeld)与换弹(VM reload)',
 s18.includes("||(typeof VM!=='undefined'&&((VM.state==='nade'&&this.nadeHeld)||VM.state==='reload')); }"));
assert('18 cancelReadBar 账目旗在 vmAbortAction **之前**取 (模型层一收 VM.state 就回 idle, 事后判必扑空)',
 s18.includes('const nadeHold=this.nadeHeld, rl=(typeof VM!==\'undefined\'&&VM.state===\'reload\');')
 &&s18.includes("if(nadeHold){ this.nadeHeld=false; any=true; }")
 &&s18.includes('if(rl){ any=true; }'));
assert('18 stealBar 抢占单源就位 (安静收当前读条, 交互入口共用)',
 s18.includes('stealBar(){ if(this.readBarActive()) this.cancelReadBar(null,true); },'));
assert('18 受击打断门 = 单次 amt>READBAR_DMG_GATE 才打断 (反馈轮②), 两条新文案保留',
 s18.includes('if(amt>READBAR_DMG_GATE&&this.readBarActive()){')
 &&s18.includes("this.cancelReadBar(this.bandaging>0?'包扎被打断!':")
 &&s18.includes("'举雷被打断!'")&&s18.includes("'换弹被打断!'"));
assert('18 补给弹药账 = 备用上限+弹夹容量, 旧"直接填满弹夹"写法已退场',
 s18.includes('for(const s of this.slots){ s.reserve=s.def.reserve+s.def.mag; }')
 &&!s18.includes('for(const s of this.slots){ s.reserve=s.def.reserve; s.mag=s.def.mag; }'));

const s10=srcOf('js/10-viewmodel.js');
assert('10 vmReloadRestore 单源就位 (弹匣/弹夹/火箭弹/枪栓/拉机柄/滑轨 六件归位)',
 s10.includes('function vmReloadRestore(){')
 &&s10.includes('if(g.mag&&g.mag.userData.p0){ g.mag.position.copy(g.mag.userData.p0);')
 &&s10.includes('if(g.slide) g.slide.position.z=g.slide.userData.z0??-0.02;'));
assert('10 换弹自然走完 (nt>=1) 与被中止走同一份 vmReloadRestore (定义+两处调用=3 次; ★2026-10-30 判据跟走: 走完顺手清打断确认账 barArmKey; ★2026-11-03 跟码: 走完同帧清镜像标记 mirrorHost)',
 (s10.match(/vmReloadRestore\(\)/g)||[]).length===3
 &&s10.includes('VM.state=\'idle\'; vmSndFlags={}; player.barArmKey=null; VM.mirrorHost=false; player.finishReload();'));
assert('10 vmAbortAction 收举雷 (仅哨兵持雷段, 出手弧不误杀) 与换弹',
 s10.includes("else if(st==='nade'&&VM.stateDur>10){ if(VM.nadeM) VM.nadeM.visible=false; steal=true; }")
 &&s10.includes("else if(st==='reload'){ vmReloadRestore(); steal=true; }"));
assert('10 栓 z0 改无条件下捕获 + slide 静止位 z0 捕获 (三把手枪静止位各不同, 不能写死)',
 s10.includes('if(g.bolt) g.bolt.position.z=g.bolt.userData.z0??(g.bolt.userData.z0=g.bolt.position.z);')
 &&s10.includes('if(g.slide) g.slide.userData.z0??(g.slide.userData.z0=g.slide.position.z);')
 &&!s10.includes('if(g.bolt&&!g.boltHandle) g.bolt.position.z='));

const s19=srcOf('js/19-input.js');
assert('19 举雷引信全长走 NADE_FUSE_T 单源 (3.8 字面量已收)',
 s19.includes('player.nadeFuse=NADE_FUSE_T;')&&!s19.includes('player.nadeFuse=3.8;'));
assert('19 左键取消**举雷除外** (收雷只有 X/✕ 两条有意路径; ★2026-11-13 批跟码: 换弹(reload)也豁免——换弹中左键不再取消, 举雷例外保留)',
 s19.includes("if(e.button===0&&player.readBarActive()&&!(typeof VM!=='undefined'&&(VM.state==='nade'&&player.nadeHeld||VM.state==='reload'))){"));
assert('19 tryReload 带 viaKey 抢占 (读条中 R=打断再装填, 系统自动换弹不带; ★2026-10-30 判据跟走: 打断=双击确认 + 同键重按=极少加快)',
 s19.includes('function tryReload(viaKey){')
 &&s19.includes('if(!viaKey) return;')
 &&s19.includes("if(VM.state==='reload'){ VM.stateT=Math.min(VM.stateDur,(VM.stateT||0)+VM.stateDur*BAR_PRESS_BOOST); return; }")
 &&s19.includes("if(!player.barStealArmed('KeyR')) return;")
 &&s19.includes('player.stealBar();'));
assert('19 switchSlot 带 viaKey 抢占 (读条中 1/2/4=打断再换枪)',
 s19.includes('function switchSlot(i,viaKey){')
 &&(s19.match(/switchSlot\((?:0|1|player\.slots\.findIndex\(s=>s&&s\.def\.rocket\)),true\)/g)||[]).length>=5);
assert('19 按键侧 tryReload(true) 三处 (主/游泳/艇上)',
 (s19.match(/tryReload\(true\)/g)||[]).length>=3);
assert('19 四投掷键 sameHeld 守卫 (同键重按不抢=不重烧引信, 异读条/异种雷才抢占)',
 s19.includes('const sameHeld=player.nadeHeld&&!player.nadeIsAT&&!player.nadeIsSmoke&&!player.nadeIsIncin;')
 &&s19.includes('const sameHeld=player.nadeHeld&&player.nadeIsAT;')
 &&s19.includes('const sameHeld=player.nadeHeld&&player.nadeIsSmoke;')
 &&s19.includes('const sameHeld=player.nadeHeld&&player.nadeIsIncin;'));
assert('19 V 近战/ H 包扎读条抢占前缀 (除 VM 态外全门先过=确认会起步才抢, 空按不白丢读条; ★2026-10-30 判据跟走: 抢占前多一道双击确认门 barStealArmed)',
 s19.includes('if(!player.onMG&&!player.onVehicle&&!player.onAT&&!player.onAA&&!player.onMortar&&player.meleeCd<=0){\nif(!player.barStealArmed(\'KeyN\')) return;\nplayer.stealBar();')
 &&s19.includes('const okH=player.bandages>0&&player.hp<100&&!player.onVehicle&&!player.onMG&&!player.onAT&&!player.onAA&&!player.loiter;\nif(okH){ if(!player.barStealArmed(\'KeyH\')) return; player.stealBar(); }'));

const s20=srcOf('js/20-player.js');
const steal20=(s20.match(/player\.stealBar\(\);/g)||[]).length;
assert('20 F 交互栈 stealBar 全覆盖 (2026-11-10 跟码: 原钉 14 处 —— 大舰甲板层等 7 处随大舰子系统下架摘除)',
 steal20>=7,`实测 ${steal20} 处`);
const s06=srcOf('js/06-engineering.js');
assert('06 建造抢态入口升级 (全部早退之后=确认起造才抢)',s06.includes('player.stealBar();'));

const s22=srcOf('js/22-hud.js');
assert('22 HUD 读条链新增举雷条 (普通雷=引信倒数, 分母 NADE_FUSE_T)',
 s22.includes('VM.state===\'nade\'&&player.nadeHeld')
 &&s22.includes('k:clamp(1-Math.max(0,player.nadeFuse)/_fuseT,0,1)'));
assert('22 HUD 读条链新增换弹条 + 座位门 (上车后 VM 冻结不显示)',
 s22.includes("VM.state==='reload'&&!_seated")
 &&s22.includes("t2('换弹中: {0}s',Math.max(0,(VM.stateDur||0)-(VM.stateT||0)).toFixed(1))"));

const scfg=srcOf('js/00-config.js');
assert('config NADE_FUSE_T=3.8 + READBAR_DMG_GATE=25 双单源就位 (00-config)',
 scfg.includes('const NADE_FUSE_T=3.8;')&&scfg.includes('const READBAR_DMG_GATE=25;'));
const si18n=srcOf('js/00b-i18n.js');
assert('i18n 新增举雷/换弹读条文案全部有英文键',
 ["'手雷 · 引信 {0}s · X 收回'","'反坦克雷 · X 收回'","'烟雾弹 · X 收回'","'燃烧弹 · X 收回'","'手雷 · X 收回'","'换弹中: {0}s'","'举雷被打断!'","'换弹被打断!'"]
  .every(k=>si18n.includes(k+':')));
assert('i18n 说明行随反馈轮改文 (受创>25/改做其他动作会打断)',
 si18n.includes('单次受创>25或改做其他动作会打断')&&si18n.includes('单次受创>25会打断'));
}

// ── 沙箱装载 (真 three; 与 verify-animfix-20261012 同款) ─────
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

// ── ② 举雷: X 取消 / 受创 25 不断·26 打断 (雷不消耗, 模型收回) ──
section('② 举雷待发并入取消网 (真沙箱)');
const nade=run(`(()=>{ const out={pops:[]};
vmEquip('kar98',0);
const p=player; p.alive=true; p.isPlayer=true; p.spectator=false; p.hp=90; p.protUntil=0;
window.__pops=[]; showScorePop=t=>{window.__pops.push(t);};
p.nadeCount=2; p.nadeHeld=false;
VM.state='idle'; VM.stateT=0; VM.stateDur=0;
// 起手: 与 19-input KeyG 同一套账 (哨兵 999 + 引信全长)
VM.state='nade'; VM.stateT=0; VM.stateDur=999;
p.nadeHeld=true; p.nadeFuse=NADE_FUSE_T; p.nadeIsAT=false; p.nadeIsSmoke=false; p.nadeIsIncin=false; vmSndFlags={};
for(let i=0;i<6;i++) updateViewModel(1/60,p);
out.holdState=VM.state; out.active=p.readBarActive();
out.nadeShown=!!(VM.nadeM&&VM.nadeM.visible);
// X 键路径 = readBarActive 门 + cancelReadBar 单源 (19-input KeyX 的原句)
if(p.readBarActive()) p.cancelReadBar('已取消');
out.afterState=VM.state; out.afterHeld=p.nadeHeld; out.afterActive=p.readBarActive();
out.nadeCount=p.nadeCount;
out.nadeHidden=!(VM.nadeM&&VM.nadeM.visible); out.gunBack=!!(VM.gunParts&&VM.gunParts.gun.visible);
// 受创 25 (=门槛, 不该打断) → 受创 6 (刮伤, 不该打断) → 受创 26 (>25, 打断): 同一颗雷连吃三发
VM.state='nade'; VM.stateT=0; VM.stateDur=999;
p.nadeHeld=true; p.nadeFuse=1.2;
for(let i=0;i<3;i++) updateViewModel(1/60,p);
p.damage(25,{team:1,pos:new THREE.Vector3(1,0,4)},false);
out.g25State=VM.state; out.g25Held=p.nadeHeld; out.g25Fuse=p.nadeFuse;
p.damage(6,{team:1,pos:new THREE.Vector3(1,0,4)},false);
out.g6State=VM.state; out.g6Held=p.nadeHeld;
p.damage(26,{team:1,pos:new THREE.Vector3(1,0,4)},false);
out.dmgState=VM.state; out.dmgHeld=p.nadeHeld; out.dmgCount=p.nadeCount;
out.pops=window.__pops.slice();
return out; })()`);
assert('② 举雷期 readBarActive()=true (X 门/读条显隐的前提)',nade.active===true);
assert('② 举雷期雷模在手上 (取证前提, 非空转)',nade.nadeShown===true&&nade.holdState==='nade');
assert('② X 取消: VM 回 idle + nadeHeld 摘除 + readBarActive 归 false',
 nade.afterState==='idle'&&nade.afterHeld===false&&nade.afterActive===false);
assert('② X 取消: 雷回袋不消耗 (nadeCount 仍 2)',nade.nadeCount===2,`nadeCount=${nade.nadeCount}`);
assert('② X 取消: 雷模收起 + 枪回到手上 (无模型滞留)',nade.nadeHidden===true&&nade.gunBack===true);
assert('② 受创 25 (=门槛) 与 6 (刮伤) 都不断: 雷仍持、状态原样',
 nade.g25State==='nade'&&nade.g25Held===true&&nade.g25Fuse===1.2&&nade.g6State==='nade'&&nade.g6Held===true,
 `fuse=${nade.g25Fuse}`);
assert('② 受创 26 (>25) 打断: 举雷被打断 (雷不消耗)',nade.dmgState==='idle'&&nade.dmgHeld===false&&nade.dmgCount===2);
assert('② 受击打断文案 = "举雷被打断!" (且只此一条, 25/6 两发不产生文案)',
 nade.pops.includes('举雷被打断!')&&nade.pops.filter(x=>x.includes('打断')).length===1,JSON.stringify(nade.pops));

// ── ③ 换弹: X 取消 / 自然走完(回归) / 受创 26 打断·25 不断·R 重按不重启 ──
section('③ 换弹并入取消网 (真沙箱)');
const rl=run(`(()=>{ const out={pops:[]};
vmEquip('thompson',0);
const p=player; p.alive=true; p.isPlayer=true; p.spectator=false; p.hp=90; p.protUntil=0;
p.onMG=null; p.onVehicle=null; p.onAT=null; p.onAA=null; p.streakBuff=null;
window.__pops=[]; showScorePop=t=>{window.__pops.push(t);};
p.slots=[{key:'thompson',def:WPN_DEFS.thompson,mag:3,reserve:90}]; p.curW=p.slots[0]; p.curSlot=0;
// 走游戏自己的换弹入口 tryReload (19-input R 键原函数)
VM.state='idle'; VM.stateT=0; VM.stateDur=0;
tryReload();
out.started=(VM.state==='reload'); out.dur=VM.stateDur;
// 推到一半 (thompson reload 2.5s ⇒ 75 帧 ≈ 1.25s): 弹匣正被搬在半路
for(let i=0;i<75;i++) updateViewModel(1/60,p);
const g=VM.gunParts;
out.magMidDisplaced=(g.mag&&g.mag.userData.p0)?g.mag.position.distanceTo(g.mag.userData.p0)>0.02:null;
// X 取消 (readBarActive 门 + cancelReadBar, KeyX 原句)
out.activeMid=p.readBarActive();
if(p.readBarActive()) p.cancelReadBar('已取消');
out.cancelState=VM.state;
out.magRestored=(g.mag&&g.mag.userData.p0)?g.mag.position.distanceTo(g.mag.userData.p0)<0.001:null;
out.magVisible=g.mag?g.mag.visible===true:null;
out.magA=p.curW.mag; out.resA=p.curW.reserve;
// 自然走完 (回归: finishReload 只在自然走完那条路)
p.curW.mag=3; p.curW.reserve=90;
VM.state='idle'; VM.stateT=0; VM.stateDur=0;
tryReload();
for(let i=0;i<160;i++) updateViewModel(1/60,p);
out.doneState=VM.state; out.magB=p.curW.mag; out.resB=p.curW.reserve;
// 受创 25 不断 → 26 打断
p.curW.mag=3; p.curW.reserve=90;
VM.state='idle'; VM.stateT=0; VM.stateDur=0;
tryReload();
for(let i=0;i<30;i++) updateViewModel(1/60,p);
p.damage(25,{team:1,pos:new THREE.Vector3(1,0,4)},false);
out.g25State=VM.state; out.g25Mag=p.curW.mag;
p.damage(26,{team:1,pos:new THREE.Vector3(1,0,4)},false);
out.dmgState=VM.state; out.magC=p.curW.mag; out.resC=p.curW.reserve;
// R 重按 (同键不抢): 重开一次换弹推 30 帧, 再 tryReload(true) —— stateT 不得归零
p.curW.mag=3; p.curW.reserve=90;
VM.state='idle'; VM.stateT=0; VM.stateDur=0;
tryReload(true);
for(let i=0;i<30;i++) updateViewModel(1/60,p);
out.reT0=VM.stateT; out.reDur=VM.stateDur;
tryReload(true);
out.reT1=VM.stateT; out.reState=VM.state;
out.pops=window.__pops.slice();
return out; })()`);
assert('③ tryReload 起手 (VM=reload, dur=2.5s 原口径)',rl.started===true&&Math.abs(rl.dur-2.5)<0.01);
assert('③ 换弹中弹匣确实离位 (取证前提, 非空转)',rl.magMidDisplaced===true);
assert('③ 换弹中 readBarActive()=true (X 门的前提)',rl.activeMid===true);
assert('③ X 取消: VM 回 idle + 弹匣归位且可见 (无缺匣滞留)',
 rl.cancelState==='idle'&&rl.magRestored===true&&rl.magVisible===true);
assert('③ X 取消: 弹药不结算 (mag 仍 3 / reserve 仍 90)',
 rl.magA===3&&rl.resA===90,`mag=${rl.magA} res=${rl.resA}`);
assert('③ 自然走完照旧: mag 3→30 / reserve 90→63 (回归底线)',
 rl.doneState==='idle'&&rl.magB===30&&rl.resB===63,`mag=${rl.magB} res=${rl.resB}`);
assert('③ 受创 25 (=门槛) 不断: 换弹照跑',rl.g25State==='reload'&&rl.g25Mag===3);
assert('③ 受创 26 (>25) 打断: 换弹中止且弹药不结算',rl.dmgState==='idle'&&rl.magC===3&&rl.resC===90);
assert('③ 受击打断文案 = "换弹被打断!" (只此一条)',
 rl.pops.includes('换弹被打断!')&&rl.pops.filter(x=>x.includes('打断')).length===1,JSON.stringify(rl.pops));
assert('③ R 重按不重启 (同键不抢; ★2026-10-30 判据跟走: 同键重按=极少加快, 推进 stateDur×BAR_PRESS_BOOST 而非原样)',
 rl.reState==='reload'&&rl.reT0>0&&Math.abs(rl.reT1-(rl.reT0+rl.reDur*BAR_PRESS_BOOST))<1e-9,`T0=${rl.reT0} T1=${rl.reT1}`);

// ── ④ 拿取物资: 子弹新账 (备用上限+弹夹容量, 不填弹夹) ─────────
section('④ 补给弹药新账 (真沙箱)');
const grab=run(`(()=>{ const out={};
const p=player; p.alive=true; p.isPlayer=true; p.cls=0; p.team=0; p.bandages=1;
p.nadeCount=0; p.atNades=0; p.smokeCount=0; p.incinCount=0;
p.slots=[{key:'thompson',def:WPN_DEFS.thompson,mag:2,reserve:7},{key:'kar98',def:WPN_DEFS.kar98,mag:1,reserve:9}];
p.curW=p.slots[0]; p.curSlot=0;
p.grabAction={kind:'ammo',crate:{x:0,z:0}};
p.doGrabResolve();
out.a=p.slots[0]; out.b=p.slots[1];
out.bandages=p.bandages; out.nades=p.nadeCount; out.grabCleared=(p.grabAction===null);
return out; })()`);
assert('④ 汤普森: reserve 7→330 (=备用上限300+弹夹30, 有意超上限), 弹夹 2 原样不填',
 grab.a.reserve===330&&grab.a.mag===2,`mag=${grab.a.mag} res=${grab.a.reserve}`);
assert('④ Kar98: reserve 9→105 (=100+5), 弹夹 1 原样',
 grab.b.reserve===105&&grab.b.mag===1,`mag=${grab.b.mag} res=${grab.b.reserve}`);
assert('④ 投掷物+绷带仍全满 (只改子弹账)',grab.bandages===grab.nades&&grab.bandages>0&&grab.grabCleared===true,
 `绷带=${grab.bandages} 雷=${grab.nades}`);

// ── ⑤ 反馈轮①: 交互动作抢占读条 ──────────────────────────────
section('⑤ 交互抢占 (真沙箱, 反馈轮①)');
const itc=run(`(()=>{ const out={pops:[]};
vmEquip('thompson',0);
const p=player; p.alive=true; p.isPlayer=true; p.spectator=false; p.hp=90; p.protUntil=0;
p.onMG=null; p.onVehicle=null; p.onAT=null; p.onAA=null; p.onNaval=null; p.onMortar=null; p.capitalGun=null; p.loiter=null;
p.streakBuff=null; p.meleeCd=0; p.bandages=2; p.nadeCount=2;
window.__pops=[]; showScorePop=t=>{window.__pops.push(t);};
p.slots=[{key:'thompson',def:WPN_DEFS.thompson,mag:3,reserve:90},{key:'kar98',def:WPN_DEFS.kar98,mag:1,reserve:9}];
p.curSlot=0; p.curW=p.slots[0];
// (a) 换弹中 1/2 换枪 = 打断换弹再换枪 (switchSlot viaKey)
VM.state='idle'; VM.stateT=0; VM.stateDur=0;
tryReload(true);
for(let i=0;i<30;i++) updateViewModel(1/60,p);
out.aPrev=VM.state;
switchSlot(1,true);   // ★2026-10-30 双击确认: 首按=武装 (不打断, 仍在换弹)
out.aArm=VM.state;
switchSlot(1,true);   // 窗内同键再按=确认打断 → 换枪起步
out.aState=VM.state; out.aSlot=p.curSlot; out.aKey=p.curW&&p.curW.key;
out.aMag=p.slots[0].mag; out.aRes=p.slots[0].reserve;
// (b) 举雷中 R (按键) = 收雷再装填; 顺带验证 stealBar 安静 (无"已取消"弹出)
VM.state='idle'; VM.stateT=0; VM.stateDur=0;
p.curSlot=0; p.curW=p.slots[0]; vmEquip('thompson',0);
VM.state='nade'; VM.stateT=0; VM.stateDur=999;
p.nadeHeld=true; p.nadeFuse=NADE_FUSE_T; p.nadeIsAT=false; p.nadeIsSmoke=false; p.nadeIsIncin=false; vmSndFlags={};
const popsBefore=window.__pops.length;
tryReload(true);   // ★2026-10-30 双击确认: 首按=武装 (雷还在, 不换弹)
out.bArmState=VM.state; out.bArmHeld=p.nadeHeld;
tryReload(true);   // 窗内同键再按=确认打断 → 收雷再装填
out.bState=VM.state; out.bHeld=p.nadeHeld; out.bNades=p.nadeCount; out.bQuiet=(window.__pops.length===popsBefore);
// (c) 举雷中系统自动换弹 (无 viaKey) = 不得抢走雷
VM.state='idle'; VM.stateT=0; VM.stateDur=0;
p.curSlot=0; p.curW=p.slots[0]; vmEquip('thompson',0);
VM.state='nade'; VM.stateT=0; VM.stateDur=999;
p.nadeHeld=true; p.nadeFuse=1.0; vmSndFlags={};
tryReload();
out.cState=VM.state; out.cHeld=p.nadeHeld; out.cFuse=p.nadeFuse;
// (d) 包扎读条被交互抢占 (V/H/F 共用的 stealBar 单源, 直接测)
VM.state='idle'; VM.stateT=0; VM.stateDur=0;
p.curSlot=0; p.curW=p.slots[0]; vmEquip('thompson',0);
p.bandaging=BANDAGE_T; VM.state='bandage'; VM.stateT=0; VM.stateDur=BANDAGE_T;
p.stealBar();
out.dBand=p.bandaging; out.dState=VM.state;
out.pops=window.__pops.slice();
return out; })()`);
assert('⑤(a) 换弹中 1/2 换枪: 首按只武装不打断 (仍 reload), 再按=打断换弹 (VM 进拔枪态 draw) 且枪真换到 kar98, 汤普森弹药不结算',
 itc.aPrev==='reload'&&itc.aArm==='reload'&&itc.aState==='draw'&&itc.aSlot===1&&itc.aKey==='kar98'&&itc.aMag===3&&itc.aRes===90,
 `prev=${itc.aPrev} arm=${itc.aArm} state=${itc.aState} slot=${itc.aSlot} key=${itc.aKey} mag=${itc.aMag} res=${itc.aRes}`);
assert('⑤(b) 举雷中按 R: 首按只武装 (雷还在), 再按=雷收回不消耗 (nadeCount 仍 2) 且换弹接续起步, stealBar 安静无文案',
 itc.bArmState==='nade'&&itc.bArmHeld===true&&itc.bState==='reload'&&itc.bHeld===false&&itc.bNades===2&&itc.bQuiet===true,
 `arm=${itc.bArmState}/${itc.bArmHeld} state=${itc.bState} nades=${itc.bNades}`);
assert('⑤(c) 举雷中系统自动换弹 (无 viaKey): 雷不被抢 (持雷态原样、引信未动)',
 itc.cState==='nade'&&itc.cHeld===true&&Math.abs(itc.cFuse-1.0)<0.001,`fuse=${itc.cFuse}`);
assert('⑤(d) 包扎被交互抢占: bandaging 清零 + VM 回 idle (无绷带卷滞留)',
 itc.dBand===0&&itc.dState==='idle');

console.log('\n' + (BAD.length? `✗ ${BAD.length} 红 / ${OK.length} 绿` : `✓ 全绿 (${OK.length})`));
if(BAD.length){ process.exitCode=1; if(NEG) console.log('(阴性对照: 有红=判据具备分辨力)'); }
else if(NEG){ console.log('✗ 阴性对照全绿 = 判据空转!'); process.exitCode=1; }
}
