// ─────────────────────────────────────────────────────────────
// dev/verify-vehburn-20261109.js —— 2026-11-09 四项批验收
//   ① 载具残血起火: hp<maxHp×10% 点火 (follow 火源 dps=0), 燃烧账每秒烧 maxHp×1%/s ⇒ ≤10s 烧毁,
//     正常受创照常, 起火禁自修, respawn 复位; 击杀归因=点燃者 burnBy
//   ② Bot 对齐: 坦克乘员起火即 dismountVehicle(true) 弃车; 舰艇 Bot 起火 crewOut 弃船; 飞行员 32% 先跳
//   ③ 警告 #vehBurnTip: onVehicle/onNaval 任一座驾 burning → 显红字, 脱险/烧毁即隐
//   ④ "自动脱离载具" (sf_autoexit 默认关): Tank.die/Plane.die 玩家分支 autoExitWreck (下车落位 / 跳伞)
//   ⑤ "游戏中显示详细操作" (sf_ctlhints 默认开): 关=modeLine/多键明细/clsTip/部署键位提示全隐,
//     单键交互入口 (F 使用X/F 进入X) 与状态信息保留
//   ⑥ 页签排序: #mSet 内 操作方式→语言→性能与画面→游戏内容 (用户裁定 2026-11-09)
// 用法: node dev/verify-vehburn-20261109.js [--neg]
//   --neg = 阴性对照 (8 补丁, 对认按红名): N1 坦克点火摘除 / N2 坦克燃烧账摘除 (hp-=0) /
//   N3 Tank.die 自动脱离摘除 / N4 modeLine 门摘除 / N5 vehBurnTip 恒隐 / N6 Bot 弃车摘除 /
//   N7 舰艇弃船摘除 / N8 页签顺序钉反转 (性能与画面标签改名)。恢复类断言 (默认关照旧死) 在 NEG 下仍绿。
// 口径: 与 verify-timestophud-20261108 同款 boot (真 three + index.html 全脚本链 + startBtn 开局)。
// ─────────────────────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const NEG=process.argv.includes('--neg');
const OK=[],BAD=[];
function assert(name,cond,detail){ (cond?OK:BAD).push(name); console.log(`  ${cond?'✓':'✗'} ${name}${detail?'  '+detail:''}`); }
function section(t){ console.log('\n══ '+t+' ══'); }
const LC=require('./_loadcache.js'); // 2026-11-19 效率批: 读盘 memo
const SRC=f=>LC.src(root,f);

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
 // N1 病灶还原: 坦克 takeDmg 点火检查摘除 (不点火 ⇒ 烧毁/警告链全断)
 ['js/15-vehicles.js','if(typeof vehBurnIgnite===\'function\'&&!this.burning&&this.hp>0&&this.hp<this.maxHp*VEH_BURN_FRAC) vehBurnIgnite(this,attacker);','; // NEG N1'],
 // N2 病灶还原: 坦克燃烧账摘除 (hp-=0 ⇒ 永不烧毁)
 ['js/15-vehicles.js','this.hp-=this.maxHp*VEH_BURN_FRAC/VEH_BURN_TIME*dt;','this.hp-=0; // NEG N2'],
 // N3 病灶还原: Tank.die 自动脱离分支摘除 (开=仍随车死)
 ['js/15-vehicles.js','else if(AUTO_EXIT_VEH&&player.alive&&typeof autoExitWreck===\'function\'){ autoExitWreck(this,false); }','else if(false&&AUTO_EXIT_VEH){ autoExitWreck(this,false); } // NEG N3'],
 // N4 病灶还原: modeLine 门摘除 (关了仍显模式说明)
 ['js/22-hud.js','if(!SHOW_CTL_HINTS) modeLine=\'\';','if(false) modeLine=\'\'; // NEG N4'],
 // N5 病灶还原: 起火警告恒隐
 ['js/22-hud.js','const _bv=(player.onVehicle&&player.onVehicle.alive&&player.onVehicle.burning)||(player.onNaval&&player.onNaval.alive&&player.onNaval.burning);','const _bv=false; // NEG N5'],
 // N6 病灶还原: Bot 起火弃车摘除
 ['js/14-bots.js','if(v.burning&&v.kind===\'tank\'){','if(v.burning&&v.kind===\'tank\'&&false){ // NEG N6'],
 // N7 病灶还原: 舰艇 Bot 起火弃船摘除
 ['js/15d-naval.js','if(!this._burnCrewOut&&this.crewBot&&!this.playerDriven){ this._burnCrewOut=true; this.crewOut(); }','if(false&&this.crewBot&&!this.playerDriven){ this._burnCrewOut=true; this.crewOut(); } // NEG N7'],
 // N8 页签顺序钉反转: 性能与画面标签改名 ⇒ 顺序断言红
 ['index.html','>性能与画面</div>','>性能与画面X</div>'],
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
const s00=SRC('js/00-config.js'), s04=SRC('js/04b-fire.js'), s15=SRC('js/15-vehicles.js'),
      s16=SRC('js/16-aircraft.js'), s15b=SRC('js/15b-trucks.js'), s15d=SRC('js/15d-naval.js'),
      s14=SRC('js/14-bots.js'), s20=SRC('js/20-player.js'), s22=SRC('js/22-hud.js'),
      s23=SRC('js/23-deploy.js'), s26=SRC('js/26-commander.js'), s19=SRC('js/19-input.js'),
      s18=SRC('js/00b-i18n.js'), ih=srcOf('index.html'), css=SRC('css/style.css');
const igniteLine='if(typeof vehBurnIgnite===\'function\'&&!this.burning&&this.hp>0&&this.hp<this.maxHp*VEH_BURN_FRAC) vehBurnIgnite(this,attacker);';
const burnTick='this.hp-=this.maxHp*VEH_BURN_FRAC/VEH_BURN_TIME*dt;';
assert('00-config: VEH_BURN_FRAC/VEH_BURN_TIME + 两开关单源 (sf_ctlhints 默认开 / sf_autoexit 默认关)',
 s00.includes('const VEH_BURN_FRAC=0.10, VEH_BURN_TIME=10;')
 &&s00.includes('let SHOW_CTL_HINTS=localStorage.getItem(\'sf_ctlhints\')!==\'0\';')
 &&s00.includes('let AUTO_EXIT_VEH=localStorage.getItem(\'sf_autoexit\')===\'1\';'));
assert('04b-fire: vehBurnIgnite 单源 + follow 火源 (dps=0) + 飞机不带火源',
 s04.includes('function vehBurnIgnite(v,attacker){')
 &&s04.includes('v.kind!==\'plane\'&&typeof addFireSource===\'function\'')
 &&s04.includes('{ship:v,an:{position:{x:0,y:1.3,z:0}}}'));
assert('坦克四件套: takeDmg 点火 + update 燃烧账 + 自修门 !burning + respawn 复位',
 s15.includes(igniteLine)&&s15.includes(burnTick)
 &&s15.includes('!this.playerDriven&&!this.crewBot&&!this.burning&&')
 &&s15.includes('if(this.burning||this.burnBy||this.burnSrc){'));
assert('飞机三件套: 点火 + 燃烧账(带粒子) + respawn 复位 + 飞行员 32% 先于起火线',
 s16.includes(igniteLine)&&s16.includes(burnTick)&&s16.includes('this.burnFxT')
 &&s16.includes('this.burning=false; this.burnBy=null; this.burnSrc=null; this.burnFxT=0;')
 &&s16.includes('this.hp<this.maxHp*0.32'));
assert('卡车: takeDmg 点火 + update 燃烧账',s15b.includes(igniteLine)&&s15b.includes(burnTick));
assert('舰艇五件套: 点火 + 燃烧账 + Bot 起火弃船 crewOut + beginDestroy 掐火源 + respawn 复位',
 s15d.includes(igniteLine)&&s15d.includes(burnTick)
 &&s15d.includes('if(!this._burnCrewOut&&this.crewBot&&!this.playerDriven){ this._burnCrewOut=true; this.crewOut(); }')
 &&s15d.includes('if(this.burnSrc) removeFireSource(this.burnSrc);')
 &&s15d.includes('this.burning=false; this.burnBy=null; this._burnCrewOut=false;'));
assert('14-bots: 坦克乘员起火即弃车 (dismountVehicle(true); 2026-11-14 跟码: 加 dt>0 门 —— 冻结世界不弃车)',s14.includes('if(v.burning&&v.kind===\'tank\'&&dt>0){')&&s14.includes('this.dismountVehicle(true);'));
assert('20-player: autoExitWreck 单源 (坦克落位 + 飞机跳伞两分支)',
 s20.includes('function autoExitWreck(v,bail){')&&s20.includes('p.chute=true; p.onGround=false;')
 &&s20.includes('showScorePop(\'座驾被毁 · 已自动脱离\')')&&s20.includes('showScorePop(\'跳伞! 自动脱离\')'));
assert('die 接线: Tank.die/Plane.die 玩家分支 autoExitWreck (观战 specRideEject 分支不动) (2026-11-10 跟码: 飞机支加 !crash 门 —— 坠地机毁人亡不跳伞, 三蟲抓①)',
 s15.includes('else if(AUTO_EXIT_VEH&&player.alive&&typeof autoExitWreck===\'function\'){ autoExitWreck(this,false); }')
 &&s16.includes('else if(!crash&&AUTO_EXIT_VEH&&player.alive&&typeof autoExitWreck===\'function\'){ autoExitWreck(this,true); }'));
assert('22-hud: vehBurnTip 驱动 (onVehicle/onNaval 双座驾) + 两开关接线',
 s22.includes("hudShow('vehBurnTip',true)")&&s22.includes('⚠ 载具起火! 即将损毁 —— 快脱离!')
 &&s22.includes("localStorage.setItem('sf_ctlhints'")&&s22.includes("localStorage.setItem('sf_autoexit'")
 &&s22.includes("el('showCtlHintsBtn')")&&s22.includes("el('autoExitVehBtn')"));
assert('22-hud: SHOW_CTL_HINTS 隐藏面 (nadeN×4 行 / modeLine 门 / 观战键位行 / braceInd / navalSeatHud) (2026-11-10 跟码: 大舰炮位 nadeN 行随移除批下架)',
 (s22.match(/SHOW_CTL_HINTS\?t2\('主炮\[左键\]/g)||[]).length===2
 
 &&s22.includes("hudText('nadeN',SHOW_CTL_HINTS?t2('鼠标 制导 · 左键 自爆")
 &&s22.includes("if(!SHOW_CTL_HINTS) modeLine='';")
 &&s22.includes('SHOW_CTL_HINTS&&player.spectator&&!player.specViewHost')
 &&s22.includes('!player.onVehicle&&SHOW_CTL_HINTS){ hudShow(\'braceInd\',true)')
 &&s22.includes('if(nadeN){ const v=SHOW_CTL_HINTS?'));
assert('20-player: SHOW_CTL_HINTS 隐藏面 (clsTip 整块 + 幽灵/舰艇/飞机/坦克/迫击炮五明细行) — 交互入口保留 (2026-11-10 跟码: 大舰炮位行/甲板层随移除批下架)',
 s20.includes('if(typeof SHOW_CTL_HINTS!==\'undefined\'&&!SHOW_CTL_HINTS) tt=\'\';')
 &&(s20.match(/详细操作开关/g)||[]).length>=6
 &&s20.includes('if(!SHOW_CTL_HINTS){ elm.style.display=\'none\'; return; } // 详细操作开关')
 &&s20.includes("t2('<b>F</b> 补充弹药')"));
assert('23-deploy/26-commander/19-input: 部署键位提示/指挥官提示/建造选择受开关管',
 s23.includes('if(p.spectator&&SHOW_CTL_HINTS) showScorePop(\'调试模式')
 &&s23.includes('if(SHOW_CTL_HINTS){')&&s23.includes('if(p.cls===4) showScorePop')
 &&s26.includes('if(typeof SHOW_CTL_HINTS!==\'undefined\'&&!SHOW_CTL_HINTS) return;')
 &&s19.includes("if(SHOW_CTL_HINTS) showScorePop(t2('建造选择"));
assert('index.html: #vehBurnTip 元素 + 两开关按钮 + i18n 词条 + CSS 规则',
 ih.includes('<div id="vehBurnTip"></div>')&&ih.includes('id="showCtlHintsBtn"')&&ih.includes('id="autoExitVehBtn"')
 &&s18.includes('\'游戏中显示详细操作\':\'SHOW IN-GAME CONTROL TIPS\'')&&s18.includes('\'自动脱离载具\':\'AUTO-EXIT DESTROYED VEHICLE\'')
 &&s18.includes('\'⚠ 载具起火! 即将损毁 —— 快脱离!\':')
 &&css.includes('#vehBurnTip {'));
const iCtrl=ih.indexOf('>操作方式<'), iLang=ih.indexOf('>语言 / Language<'), iPerf=ih.indexOf('>性能与画面<'), iGame=ih.indexOf('>游戏内容<');
assert('页签顺序: 操作方式→语言→性能与画面→游戏内容 (用户裁定)',iCtrl>=0&&iLang>iCtrl&&iPerf>iLang&&iGame>iPerf,
 `idx 控=${iCtrl} 语=${iLang} 性=${iPerf} 游=${iGame}`);
const idx0=SRC('index.html'), gf=SRC('dev/_game_files.txt');
assert('版本戳 20261122a: index.html ≥48 处 + __sfStyleVer + _game_files 45 行 + 旧 20261109b 清零 (2026-11-10 海战移除批判据跟码)',
 [...idx0.matchAll(/20261122a/g)].length>=48&&idx0.includes("window.__sfStyleVer='20261122a';")
 &&gf.split(/\r?\n/).filter(l=>l.includes('?v=20261122a')).length===45
 &&!idx0.includes('20261109b')&&!gf.includes('20261109b'));
}

// ── 沙箱装载 (真 three; 与 verify-timestophud 同款 boot) ──────────
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
const REAL_THREE=loadRealTHREE(); // 效率批: three.min.js 解析只做一次 (per-boot 补丁幂等, 复用同一实例)
function boot(campIdx){
	const T=REAL_THREE;
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
	ctx.localStorage={_s:{sf_campaign:String(campIdx),sf_exp:'0',sf_pseed:'424242'},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
	const SCR_OF=boot._scr||(boot._scr={}); // 效率批: 编译缓存 (PATCH_MAP 阴性文本同样只编一次; NEG 补丁在 boot 前就位)
	for(const f of FILES){ let sc=SCR_OF[f]; if(!sc){ sc=new vm.Script(srcOf(f),{filename:f}); SCR_OF[f]=sc; } sc.runInContext(ctx); }
	return ctx;
}
let IDX=-1;
{ // 效率批: 只查战役序号 → 轻量 ctx 只载 00-config (先例 verify-roofghost idxOf), 免一次真 THREE 全链 boot
const c0=vm.createContext({console:{log(){},warn(){},error(){}},location:{search:''},localStorage:{_s:{},getItem:()=>null,setItem(){},removeItem(){}},window:{},navigator:{},Math,JSON,Object,Array,Number,String,Boolean,Date,parseInt,parseFloat});
LC.script(root,'js/00-config.js').runInContext(c0);
IDX=vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="normandy")',c0); }
const ctx=boot(IDX);
const G=s=>vm.runInContext(s,ctx,{timeout:300000});
let err=null;
try{ G("document.getElementById('startBtn').onclick();"); }catch(e){ err='start: '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); }
if(!err) try{ G("player.team=0; player.cls=0; player.spectator=false; player.alive=true; player.deployed=true;"); }catch(e){ err='playerInit: '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); }
assert('② 前置: 开局+玩家就位',!err&&G('typeof tanks==="object"&&tanks.length>0')===true,err||'');

// ── ② 行为: 点火阈值 ─────────────────────────────────────────
section('② 点火阈值: ≥10% 不点火 / <10% 点火 (follow 火源, 归因=点燃者)');
{
G("globalThis.T1=tanks.find(t=>t.alive&&t.team===0); globalThis.BURN_ATK=soldiers.find(b=>b.alive&&b.team===1)||{team:1,pos:{x:0,y:0,z:0}};");
G("T1.hp=T1.maxHp*0.5; T1.burning=false; T1.takeDmg(2,BURN_ATK,true);");
assert('②-1 半血挨打不点火 (hp≥10%)',G('T1.burning')!==true);
G("T1.hp=T1.maxHp*0.10+2; T1.takeDmg(4,BURN_ATK,true);");   // → hp = maxHp*0.10-2 < 10%
assert('②-2 hp 跌破 10% 点火 (burning=true)',G('T1.burning')===true);
assert('②-3 点燃者归因 burnBy=BURN_ATK',G('T1.burnBy===BURN_ATK')===true);
assert('②-4 follow 火源已挂 (dps=0, 锚=本车)',G('T1.burnSrc&&T1.burnSrc.follow&&T1.burnSrc.follow.ship===T1&&T1.burnSrc.dps===0')===true);
assert('②-5 飞机/大舰除外口径: 飞机不带 follow 火源 (源码钉)',SRC('js/04b-fire.js').includes("v.kind!=='plane'&&typeof addFireSource==='function'"));
}

// ── ③ 行为: 燃烧账 (掉血/禁自修/烧至损毁/正常受创照常/复位) ──
section('③ 燃烧账: 每秒掉血不回血 → ≤10s 烧毁 → respawn 复位; 正常受创照常');
{
// 清成真"无人闲置车" (crewBot=null/lastDmgT 老账) —— 若自修门失效, +2.5%/s 回血会盖过 -1%/s 燃烧 ⇒ 净上升被断言抓出
G("T1.crewBot=null; T1.claimBot=null; T1.playerDriven=false; T1.hp=T1.maxHp*0.30; T1.lastDmgT=-9999; globalThis._hp0=T1.hp; for(let i=0;i<60;i++) T1.update(1/60);");
assert('③-1 起火中无人车持续掉血 (自修被禁: 60 帧净减)',G('T1.hp')<G('_hp0'),`hp ${G('_hp0').toFixed(1)}→${G('T1.hp').toFixed(1)}`);
G("T1.hp=T1.maxHp*0.02; globalThis._dead=false; for(let i=0;i<400;i++){ T1.update(1/60); if(!T1.alive){ globalThis._dead=true; break; } }");
assert('③-2 燃烧至损毁 (≤400 帧 = 6.7s 内 alive=false)',G('_dead')===true);
G("globalThis.T2=tanks.find(t=>t.alive&&t.team===0&&t!==T1); T2.hp=T2.maxHp; T2.burning=false; T2.takeDmg(100,null,true);");
assert('③-3 正常受创照常结算 (无起火时 hp=maxHp-100)',G('T2.hp')===G('T2.maxHp-100'),`hp=${G('T2.hp')}`);
G("T1.respawn(true,true);");
assert('③-4 respawn 复位 (burning/burnBy/burnSrc 清账)',G('T1.burning===false&&T1.burnBy===null&&T1.burnSrc===null&&T1.alive===true')===true);
}

// ── ④ 行为: 飞机烧毁 + 坦克 Bot 对齐 ────────────────────────
section('④ 飞机烧至损毁 + 坦克乘员起火即弃车');
{
G("globalThis.P1=planes.find(p=>p.alive); if(P1){ P1.hp=P1.maxHp*0.02; P1.burning=true; P1.burnBy=null; globalThis._pdead=false; for(let i=0;i<400;i++){ P1.update(1/60); if(!P1.alive){ globalThis._pdead=true; break; } } }");
assert('④-1 机体燃烧至损毁 (≤400 帧)',G('!!P1&&_pdead')===true);
G("globalThis.T3=tanks.find(t=>t.alive&&t.team===0); globalThis.B1=soldiers.find(b=>b.alive&&b.team===0&&b!==player);");
G("if(T3&&B1){ B1.onVehicle=T3; T3.crewBot=B1; T3.playerDriven=false; T3.burning=true; T3.alive=true; B1.update(1/60); }");
assert('④-2 坦克乘员起火即弃车 (onVehicle=null)',G('!!T3&&!!B1&&B1.onVehicle===null')===true);
}

// ── ④b 行为: 舰艇 Bot 弃船 (海战图沙箱: normandy 无 navalCraft) ──
section('④b 舰艇 Bot 起火弃船 (海战图沙箱)');
{
const SEA=boot(vm.runInContext('CAMPAIGNS.findIndex(c=>!!c.sea)',ctx));
const GS=s=>vm.runInContext(s,SEA,{timeout:300000});
GS("document.getElementById('startBtn').onclick();");
GS("player.team=0; player.cls=0; player.spectator=false; player.alive=true; player.deployed=true;");
GS("globalThis.N1=navalCraft.find(n=>n.alive); globalThis.B2=soldiers.find(b=>b.alive&&b.team===(N1?N1.team:0)&&b!==player);");
GS("if(N1&&B2){ B2.onVehicle=N1; N1.crewBot=B2; N1.playerDriven=false; N1.burning=true; N1.update(1/60); }");
assert('④b-1 舰艇 Bot 起火弃船 (crewOut: crewBot=null 落水)',GS('!!N1&&!!B2&&N1.crewBot===null')===true,
 'N1='+(GS('!!N1')?'有':'无')+' navalCraft');
}

// ── ⑤ 行为: 起火警告 ────────────────────────────────────────
section('⑤ 起火警告: 座驾 burning → #vehBurnTip 显红字, 脱险即隐');
{
G("globalThis.T4=tanks.find(t=>t.alive&&t.team===0); player.onVehicle=T4; player.spectator=false; T4.burning=true; T4.alive=true; hudSlowT=0; updateHUD(1/60);");
assert('⑤-1 座驾起火 → vehBurnTip 显示',G("document.getElementById('vehBurnTip').style.display")==='block');
G("T4.burning=false; hudSlowT=0; updateHUD(1/60);");
assert('⑤-2 脱险 (不起火) → vehBurnTip 隐藏',G("document.getElementById('vehBurnTip').style.display")==='none');
G("player.onVehicle=null;");
}

// ── ⑥ 行为: 自动脱离载具 ────────────────────────────────────
section('⑥ 自动脱离载具: 开=车毁下车/机毁跳伞; 默认关=照旧车毁人亡');
{
G("AUTO_EXIT_VEH=true; player.alive=true; player.spectator=false; globalThis.T5=tanks.find(t=>t.alive&&t.team===0); globalThis._pvHp=player.hp;");
G("player.onVehicle=T5; T5.playerDriven=true; T5.crewBot=null; T5.alive=true; T5.burning=false; T5.die(BURN_ATK);");
assert('⑥-1 开: 车毁玩家存活脱离 (onVehicle 清 + 人活着)',G('player.alive===true&&player.onVehicle===null')===true);
assert('⑥-2 开: 落位车旁 (≤7m, occBlocked 探针兜位含斜向)',G('player.pos.distanceTo(T5.pos)<=7')===true,G('player.pos.distanceTo(T5.pos).toFixed(1)')+'m');
G("player.alive=true; AUTO_EXIT_VEH=false; globalThis.T6=tanks.find(t=>t.alive&&t.team===0&&t!==T5);");
G("player.onVehicle=T6; T6.playerDriven=true; T6.crewBot=null; T6.alive=true; T6.burning=false; T6.die(BURN_ATK);");
assert('⑥-3 默认关: 照旧车毁人亡 (恢复类, NEG 下仍绿)',G('player.alive')===false);
G("player.alive=true; AUTO_EXIT_VEH=true; globalThis.P2=planes.find(p=>p.alive);");
G("if(P2){ player.onVehicle=P2; P2.playerDriven=true; P2.die(BURN_ATK); }");
assert('⑥-4 开: 机毁跳伞 (chute=true + 存活)',G('!!P2&&player.alive===true&&player.chute===true&&player.onVehicle===null')===true);
G("player.chute=false; player.onGround=true; player.alive=true;");
}

// ── ⑦ 行为: 详细操作开关 ────────────────────────────────────
section('⑦ 详细操作开关: 关=modeLine/多键明细隐藏; 单键交互入口与状态保留');
{
G("SHOW_CTL_HINTS=false; player.onVehicle=T4; player.spectator=false; T4.alive=true; hudSlowT=0; updateHUD(1/60);");
assert('⑦-1 关: 顶部模式说明隐藏 (tickets 无"占满全部旗点")',G("!document.getElementById('tickets').innerHTML.includes('占满全部旗点')")===true,
 G("document.getElementById('tickets').innerHTML.slice(0,60)"));
assert('⑦-2 关: 坦克多键明细行隐藏 (nadeN 空串)',G("document.getElementById('nadeN').textContent")==='',`"${G("document.getElementById('nadeN').textContent")}"`);
G("SHOW_CTL_HINTS=true; hudSlowT=0; updateHUD(1/60);");
assert('⑦-3 开: 模式说明照常显示',G("document.getElementById('tickets').innerHTML.includes('占满全部旗点')")===true);
assert('⑦-4 开: 坦克明细行照常 (nadeN 含 主炮)',G("document.getElementById('nadeN').textContent.includes('主炮')")===true);
G("player.onVehicle=null;");
}

// ── ⑧ 汇总 ──
section('⑧ 汇总');
console.log(`  ${NEG?'NEG':'正向'} ${OK.length} 绿 / ${BAD.length} 红`);
if(BAD.length){ console.log('  红名: '+BAD.join(' · ')); process.exit(1); }
console.log('  verify-vehburn-20261109 全绿');
