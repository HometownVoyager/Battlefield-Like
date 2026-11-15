// ─────────────────────────────────────────────────────────────
// dev/verify-batch-20261030.js —— 2026-10-30 五项批验收
//   ① 票尽观战部署放行 (specWillBe 单源 + 四门)   ② 同键再按=极少加快 (BAR_PRESS_BOOST=2.5%)
//   ③ 其他动作键打断=双击确认 (BAR_ARM_WIN=0.5s, barStealArmed 单源)   ④ 中性观战结算 (END_SVG_SPEC)
//   ⑤ 迫击炮削弱 (半径 7.5→5.25 / 步兵伤 135→100 / 玩家 CD 3.2→4.5 / Bot CD 4.2~6.5→6~9 / 结构半径 7→5)
//
// 用法: node dev/verify-batch-20261030.js [--neg]
//   --neg = 阴性对照: 装载前把本批核心改动按文本还原成旧写法, 同一批判据必须报红。
//
// 用户裁定 (2026-10-30):
//   ① 观战开关开着 (specWant/spectator) 时票尽不禁部署 —— 观战部署不耗票、不影响清场判定 (fieldCount
//      不计观战者); specWant=false 显式关 / 未设 → 照旧禁用。
//   ② 读条中同键再按不取消, 每次推进该读条总时长 2.5% (包扎H/回收6/拆除B/前摇F/换弹R; 举雷同键重按
//      维持原语义=无效果)。
//   ③ 读条中按其他动作键: 0.5s 内连按**同一键**两次才真抢 (第一次只在读条上亮"再按一次打断");
//      X / 左键 / 受击>25 / 移动打断保持单击; "确认起步才抢"纪律原样保留 (第二次按时起步失败不白丢读条)。
//   ④ 观战局结算: 图标=观战之眼, 标题「对 局 结 束」(draw 配色), 副标题末段=胜方阵营; 战绩卡等全保留。
//   ⑤ 迫击炮标准档削弱 + 半径 5.25 + 伤害 100 (载具 150 / 射程不动)。
//
// 覆盖:
//   A 源码锚: ① specWillBe 单源 + 四处门 + 票尽双文案 / ② 同键加速五处 (H/B/6/F/R) + 常量单源 /
//     ③ barStealArmed 单源 + cancelReadBar/四处自然走完清账 + 全动作键双击门 (19-input×11·06×2·20×14) +
//     HUD "再按一次打断" 提示 / ④ END_SVG_SPEC + endMatch 观战分支 + i18n / ⑤ 迫击炮四处数值
//   B 沙箱行为 (真 three): barStealArmed 武装矩阵 (首按不抢/换键重记/窗内确认/过期重记/无读条直通) /
//     R 同键加速推进量 / F 前摇同键加速 (占位保留不取消) / specWillBe 四态矩阵 + 票尽非观战部署拦截 /
//     迫击炮爆炸参数 (splashDamage/damageStructures 间谍)
// ─────────────────────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const NEG=process.argv.includes('--neg');
const OK=[],BAD=[];
function assert(name,cond,detail){ (cond?OK:BAD).push(name); console.log(`  ${cond?'✓':'✗'} ${name}${detail?'  '+detail:''}`); }
function section(t){ console.log('\n══ '+t+' ══'); }
const SRC=f=>fs.readFileSync(path.join(root,f),'utf8');

// ── 阴性对照 (锚点用修后原文; 找不到就抛错, 防"锚点漂移后静默通过"; 单行锚) ──
const PATCHES=[
 // ① specWillBe 哑化: 四门全禁 → 票尽观战部署判据转红 (2026-11-01 锚跟走: 回退分支补 !specView)
 ['js/18-game.js',
  "specWillBe(){ return (typeof this.specWant==='boolean')?this.specWant:(!!this.spectator&&!this.specView); },",
  "specWillBe(){ return false; },"],
 ['js/23-deploy.js',
  "if(tickets[p.team]<=0&&!p.specWillBe()){",
  "if(tickets[p.team]<=0){"],
 // ② 同键加速退场: H 包扎推进归零 / B·6 拆除回收回到"再按取消" / R 加速行删掉 / F 前摇推进归零
 ['js/19-input.js',
  "const _bb=BANDAGE_T*BAR_PRESS_BOOST;",
  "const _bb=0;"],
 ['js/19-input.js',
  "if(player.demolish){ player.demolish.t+=DEMOLISH_T*BAR_PRESS_BOOST; }",
  "if(player.demolish){ stopDemolish(player); }"],
 ['js/19-input.js',
  "} else if(player.demolish&&player.demolish.mortar){ player.demolish.t+=DEMOLISH_T*BAR_PRESS_BOOST; }",
  "} else if(player.demolish&&player.demolish.mortar){ stopDemolish(player); }"],
 ['js/19-input.js',
  "if(VM.state==='reload'){ VM.stateT=Math.min(VM.stateDur,(VM.stateT||0)+VM.stateDur*BAR_PRESS_BOOST); return; }",
  "if(VM.state==='reload') return;"],
 ['js/20-player.js',
  "player.useCast.t+=player.useCast.dur*BAR_PRESS_BOOST;",
  "player.useCast.t=player.useCast.t;"],
 // ③ 双击确认退场: barStealArmed 恒武装 (确认分支不可达) → 首按判据转红; G 键门回旧单键抢
 ['js/18-game.js',
  "if(this.barArmKey===key&&nowT-this.barArmT<BAR_ARM_WIN){ this.barArmKey=null; return true; }",
  "if(false){ return true; }"],
 ['js/19-input.js',
  "if(ok&&!sameHeld){ if(!player.barStealArmed('KeyG')) return; player.stealBar(); }   // ★2026-10-30 读条交互批: 打断双击确认",
  "if(ok&&!sameHeld) player.stealBar();"],
 // ③ HUD 提示退场
 ['js/22-hud.js',
  "db.lb.textContent=rb.lab+((player.barArmKey&&nowT-player.barArmT<BAR_ARM_WIN)?'　▶ '+t2('再按一次打断'):'')",
  "db.lb.textContent=rb.lab"],
 // ④ 观战结算退场: _specMatch 恒 false → 胜负图标照旧
 ['js/21-match.js',
  "const win=winner===player.team, draw=winner===-1, _specMatch=!REC.counted;",
  "const win=winner===player.team, draw=winner===-1, _specMatch=false;"],
 // ⑤ 迫击炮数值回旧
 ['js/13-combat.js',
  "splashDamage(n.pos,n.thrower,(n.thrower&&n.thrower.spectator)?-1:n.team,5.25,100,150,false,'explo');",
  "splashDamage(n.pos,n.thrower,(n.thrower&&n.thrower.spectator)?-1:n.team,7.5,135,150,false,'explo');"],
 ['js/20a-seats.js',
  "m.cd=4.5*(p.streakBuff?p.streakBuff.reloadMul:1); m.cdMax=m.cd;",
  "m.cd=3.2*(p.streakBuff?p.streakBuff.reloadMul:1); m.cdMax=m.cd;"],
 ['js/14-bots.js',
  "mo.cd=rand(6,9);",
  "mo.cd=rand(4.2,6.5);"],
];
const PATCH_MAP={};
if(NEG) for(const [f,from,to] of PATCHES){
 const s=PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f);
 if(s.indexOf(from)<0) throw new Error('阴性对照锚点未找到: '+f+' :: '+from.slice(0,70));
 PATCH_MAP[f]=s.split(from).join(to);
}
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f));

// ── ① 源码防回退 ──────────────────────────────────────────────
section('① 票尽观战部署放行 (源码锚)');
{
const s18=srcOf('js/18-game.js');
assert('18 specWillBe 单源 = 本次部署解决后的观战态 (specWant 布尔优先, 未设回落 spectator 且排除视模式)',
 s18.includes("specWillBe(){ return (typeof this.specWant==='boolean')?this.specWant:(!!this.spectator&&!this.specView); },"));
const s23=srcOf('js/23-deploy.js');
assert('23 部署页票尽换字「观 战」(未开调试观战), 旧无条件禁用门退场',
 s23.includes("const _specBtn=(_exh&&!player.specWillBe())?'观 战':'部 署';")
 &&s23.includes("el('deployBtn').disabled=false;")
 &&!s23.includes("el('deployBtn').disabled=tickets[player.team]<=0&&!player.specWillBe();"));
assert('23 deployPlayer 早退门放行观战 (不放行"票尽复活成普通步兵")',
 s23.includes("if(tickets[p.team]<=0&&!p.specWillBe()){ addKillMsg('兵力已耗尽 · 本方无法再部署',p.team); return; }"));
assert('23 票尽三文案 (调试观战=入场提示 / 视模式=返回观战 / 无=自由观战指引)',
 s23.includes("const _note=player.specWillBe()?'⚠ 己方兵力已耗尽 · 部署将以调试观战身份入场':(player.specView?'⚠ 自由观战中 · 点「观战」返回观战视角':'⚠ 己方兵力已耗尽 · 点「观战」进入自由观战 · 等待清场结算');"));
const s22=srcOf('js/22-hud.js');
assert('22 deployBtn onclick: 票尽未开调试 ⇒ enterSpecView, 其余走部署 (respawnCd/matchOver 门原样)',
 s22.includes('if(tickets[player.team]<=0&&!player.specWillBe()){')
 &&s22.includes("if(typeof enterSpecView==='function') enterSpecView();"));
const s24=srcOf('js/24-main.js');
assert('24 死亡页每帧保活: 票尽 ⇒ 可用+「观 战」标签, 其余 disabled=respawnCd (2026-11-14 跟码: 调试模式冷却放行尾)',
 s24.includes('if(tickets[player.team]<=0&&!player.specWillBe()){')
 &&s24.includes("_sp.setAttribute('data-i18n','观 战')")
 &&s24.includes('btn.disabled=respawnCd>0&&!(player.spectator||player.specWillBe());'));
assert('i18n 新词条 (观战部署文案 + 结算中性组)',
 srcOf('js/00b-i18n.js').includes("'⚠ 己方兵力已耗尽 · 部署将以调试观战身份入场'")
 &&srcOf('js/00b-i18n.js').includes("'对 局 结 束':'MATCH OVER'"));
}

// ── ②③ 源码防回退 ────────────────────────────────────────────
section('②③ 读条交互批 (源码锚)');
{
const s00=srcOf('js/00-config.js');
assert('00 常量单源 BAR_ARM_WIN=0.5 / BAR_PRESS_BOOST=0.025',
 s00.includes('const BAR_ARM_WIN=0.5;')&&s00.includes('const BAR_PRESS_BOOST=0.025;'));
const s18=srcOf('js/18-game.js');
assert('18 barStealArmed 单源: 无读条直通清账 / 窗内同键确认 / 首按只记账不抢',
 s18.includes('barArmKey:null, barArmT:-9,')
 &&s18.includes('if(!this.readBarActive()){ this.barArmKey=null; return true; }')
 &&s18.includes('if(this.barArmKey===key&&nowT-this.barArmT<BAR_ARM_WIN){ this.barArmKey=null; return true; }')
 &&s18.includes('this.barArmKey=key; this.barArmT=nowT;'));
assert('18 cancelReadBar 顺手清打断确认账 (读条收尾=账目出口)',
 s18.includes('this.barArmKey=null;   // ★2026-10-30: 读条收尾顺手清打断确认账'));
assert('18 stealBar / cancelReadBar / readBarActive 原样 (★2026-10-25 纪律不回退)',
 s18.includes('stealBar(){ if(this.readBarActive()) this.cancelReadBar(null,true); },')
 &&s18.includes('const nadeHold=this.nadeHeld, rl=(typeof VM!==\'undefined\'&&VM.state===\'reload\');'));
const s19=srcOf('js/19-input.js');
assert('19 同键再按=加速不取消: 包扎 H (倒计时+VM 动画双账同步, 钳 0.01 交给 tick 结算)',
 s19.includes('const _bb=BANDAGE_T*BAR_PRESS_BOOST;')
 &&s19.includes('player.bandaging=Math.max(0.01,player.bandaging-_bb);')
 &&s19.includes("if(VM.state==='bandage') VM.stateT=Math.min(VM.stateDur,(VM.stateT||0)+_bb);"));
assert('19 同键再按=加速不取消: 拆除 B / 迫击炮回收 6 (推进 DEMOLISH_T 的 2.5%), 旧 stopDemolish 退场',
 (s19.match(/player\.demolish\.t\+=DEMOLISH_T\*BAR_PRESS_BOOST;/g)||[]).length===2
 &&!s19.includes('if(player.demolish){ stopDemolish(player); }'));
assert('19 同键再按=加速不取消: 换弹 R (推进 stateDur 的 2.5%), 旧"R 不重启"判据升级不回退',
 s19.includes("if(VM.state==='reload'){ VM.stateT=Math.min(VM.stateDur,(VM.stateT||0)+VM.stateDur*BAR_PRESS_BOOST); return; }"));
assert('19 打断双击门 11 处 (N/G/3/4×2/6×2/H/B/R/SW)',
 (s19.match(/player\.barStealArmed\(/g)||[]).length===11,
 `实测 ${(s19.match(/player\.barStealArmed\(/g)||[]).length} 处`);
assert('19 换枪双击门用 SW+槽位 (Digit1↔槽0 一一对应, 连按同一键=连按同一标识)',
 s19.includes("if(!player.barStealArmed('SW'+i)) return;"));
assert('19 X 取消 / 左键取消(举雷除外) / 系统自动换弹不抢 三条旧口径原样',
 s19.includes("if(player.readBarActive()){ player.cancelReadBar('已取消'); return; }")
 &&s19.includes("if(e.button===0&&player.readBarActive()&&!(typeof VM!=='undefined'&&(VM.state==='nade'&&player.nadeHeld||VM.state==='reload'))){") /* ★2026-11-13 批跟码: 换弹中左键豁免 */
 &&s19.includes('if(!viaKey) return;'));
const s20=srcOf('js/20-player.js');
assert('20 F 交互栈双击门 7 处 (2026-11-10 跟码: 原钉 14 处 —— 大舰甲板层跳海/上炮塔/补弹/登机×2/并靠登舰/甲板炮等 7 处随大舰子系统下架摘除)',
 (s20.match(/player\.barStealArmed\('KeyF'\)/g)||[]).length===7,
 `实测 ${(s20.match(/player\.barStealArmed\('KeyF'\)/g)||[]).length} 处`);
assert('20 前摇 useCast 同键 F=加速不取消 (占位保留), 旧"使用已取消"取消体退场',
 s20.includes('player.useCast.t+=player.useCast.dur*BAR_PRESS_BOOST;')
 &&!s20.includes("showScorePop('使用已取消');"));
assert('20 自然走完清账: 包扎完成 / 前摇完成 (barArmKey=null)',
 (s20.match(/p\.barArmKey=null;/g)||[]).length===2);
const s06=srcOf('js/06-engineering.js');
assert('06 回收起步双击门 (找到炮=确认起步, 门在 stealBar 之前) + 建造起步双击门 (全部早退之后, 不置 pendingBuild)',
 s06.includes("if(pl.isPlayer&&player.readBarActive()){ if(!player.barStealArmed('Digit6')) return; player.stealBar(); }")
 &&s06.includes("if(!player.barStealArmed('KeyB')) return;"));
assert('06 拆除/回收自然走完清账 + 双弹窗文案改"加快"口径',
 s06.includes('if(pl.isPlayer) pl.barArmKey=null;')
 &&s06.includes('拆除中: {0} … (受击/移动取消 · 再按B加快)')
 &&s06.includes('回收中: 迫击炮 … (受击/移动取消 · 再按6加快)'));
const s10=srcOf('js/10-viewmodel.js');
assert('10 换弹自然走完清账 (finishReload 同一行)',
 s10.includes('VM.state=\'idle\'; vmSndFlags={}; player.barArmKey=null; VM.mirrorHost=false; player.finishReload();'));
const s22=srcOf('js/22-hud.js');
assert('22 读条武装态提示 (▶ 再按一次打断, BAR_ARM_WIN 窗内显示)',
 s22.includes("?'　▶ '+t2('再按一次打断'):''"));
assert('i18n 打断提示与新弹窗词条',
 srcOf('js/00b-i18n.js').includes("'再按一次打断':'Press again to interrupt'")
 &&srcOf('js/00b-i18n.js').includes("'回收中: 迫击炮 … (受击/移动取消 · 再按6加快)'"));
}

// ── ④ 源码防回退 ──────────────────────────────────────────────
section('④ 中性观战结算 (源码锚)');
{
const s21=srcOf('js/21-match.js');
assert('21 END_SVG_SPEC 观战之眼 (钢灰, 非胜负配色)',
 s21.includes('const END_SVG_SPEC=`<svg')&&s21.includes('#6b7a88'));
assert('21 观战局判据与 recCommit 同源 (!_REC.counted)',
 s21.includes('const win=winner===player.team, draw=winner===-1, _specMatch=!REC.counted;'));
assert('21 图标三分支: 观战 SPEC / 平局 DRAW / 胜 WIN / 负 LOSE',
 s21.includes("document.getElementById('endIcon').innerHTML=_specMatch?END_SVG_SPEC:(draw?END_SVG_DRAW:(win?END_SVG_WIN:END_SVG_LOSE));"));
assert('21 观战标题「对 局 结 束」走 draw 中性配色; 非观战胜负标题原样',
 s21.includes("if(_specMatch){ title.textContent=t('对 局 结 束'); title.className='draw'; }")
 &&s21.includes("title.textContent=draw?t('平  局'):(win?t('胜  利'):t('战  败'));"));
assert('21 副标题末段: 观战=胜方阵营 (平局=平局), 非观战=己方阵营',
 s21.includes("const _facTail=_specMatch?(draw?t('平局'):t('胜方')+' '+t(TEAM_FACTION[winner].short)):t(TEAM_FACTION[player.team].short);"));
assert('i18n 结算中性组 (平局/Winner:/对局结束)',
 srcOf('js/00b-i18n.js').includes("'平局':'Draw'")
 &&srcOf('js/00b-i18n.js').includes("'胜方':'Winner:'"));
}

// ── ⑤ 源码防回退 ──────────────────────────────────────────────
section('⑤ 迫击炮削弱 (源码锚)');
{
const s13=srcOf('js/13-combat.js');
assert('13 迫击炮爆圈: 半径 7.5→5.25 / 步兵 135→100 / 载具 150 与 ap=false 不动',
 s13.includes("splashDamage(n.pos,n.thrower,(n.thrower&&n.thrower.spectator)?-1:n.team,5.25,100,150,false,'explo');")
 &&!s13.includes('7.5,135,150'));
assert('13 结构圈随爆径 7→5 (伤害 210 不动)',
 s13.includes('damageStructures(n.pos,5,210,n.thrower);'));
const s20a=srcOf('js/20a-seats.js');
assert('20a 玩家迫击炮 CD 3.2→4.5 (含 heatFill 分母兜底), 连杀增益保留',
 s20a.includes('m.cd=4.5*(p.streakBuff?p.streakBuff.reloadMul:1); m.cdMax=m.cd;')
 &&s20a.includes('m.cdMax||4.5'));
const s14=srcOf('js/14-bots.js');
assert('14 Bot 迫击炮 CD rand(4.2,6.5)→rand(6,9)',
 s14.includes('mo.cd=rand(6,9);')&&!s14.includes('mo.cd=rand(4.2,6.5)'));
assert('00 爆圈注释随削弱更账 (5.25)',
 srcOf('js/00-config.js').includes('迫击炮 (5.25, 2026-10-30 用户裁定削弱)'));
}

// ── 沙箱装载 (真 three; 与 verify-nadecancel-20261025 同款) ─────
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

// ── ⑥ barStealArmed 武装矩阵 ──
section('⑥ 打断双击确认 (barStealArmed 行为)');
const m1=run(`(()=>{ const out={};
const p=player;
p.alive=true; p.isPlayer=true; p.spectator=false;
p.slots=[{key:'thompson',def:WPN_DEFS.thompson,mag:3,reserve:90},{key:'kar98',def:WPN_DEFS.kar98,mag:1,reserve:9}];
p.curSlot=0; p.curW=p.slots[0]; vmEquip('thompson',0);
p.curW.mag=0; p.curW.reserve=60;
VM.state='idle'; VM.stateT=0; VM.stateDur=0;
p.cancelReadBar(null,true);
out.idlePass=p.barStealArmed('KeyG');            // 无读条: 直通放行 + 清账
out.idleArmKey=p.barArmKey;
tryReload(true);                                  // 起一条真换弹
out.readActive=p.readBarActive(); out.state=VM.state;
out.arm1=p.barStealArmed('KeyG');                // 首按: 只记账
out.armKey1=p.barArmKey; out.stateA1=VM.state; out.activeA1=p.readBarActive();
out.rearm=p.barStealArmed('Digit3');             // 换键: 重记
out.armKey2=p.barArmKey;
out.confirm=p.barStealArmed('Digit3');           // 窗内同键: 放行
out.armKeyAfter=p.barArmKey;
out.rearm2=p.barStealArmed('KeyG');              // 再武装
nowT+=0.6;                                        // 出窗 (BAR_ARM_WIN=0.5)
out.expired=p.barStealArmed('KeyG');             // 过期: 重记
out.armKeyExp=p.barArmKey;
out.confirmInWin=p.barStealArmed('KeyG');        // 再按: 放行
return out; })()`);
assert('⑥ 无读条时 barStealArmed 恒放行且不残留记账',m1.idlePass===true&&m1.idleArmKey===null);
assert('⑥ 换弹读条就位 (取证前提)',m1.readActive===true&&m1.state==='reload');
assert('⑥ 首按只武装: 返回 false + 记键 KeyG, 读条原样未抢',m1.arm1===false&&m1.armKey1==='KeyG'&&m1.stateA1==='reload'&&m1.activeA1===true);
assert('⑥ 换键重记 (Digit3 覆盖 KeyG)',m1.rearm===false&&m1.armKey2==='Digit3');
assert('⑥ 窗内同键再按=放行 + 账清空',m1.confirm===true&&m1.armKeyAfter===null);
assert('⑥ 出窗 (0.6s>0.5s) 后同键不确认, 重记后再按才放行',m1.rearm2===false&&m1.expired===false&&m1.armKeyExp==='KeyG'&&m1.confirmInWin===true);

// ── ⑦ R 同键加速 ──
section('⑦ 同键再按=极少加快 (行为)');
const m2=run(`(()=>{ const out={};
const p=player;
p.slots=[{key:'thompson',def:WPN_DEFS.thompson,mag:3,reserve:90},{key:'kar98',def:WPN_DEFS.kar98,mag:1,reserve:9}];
p.curSlot=0; p.curW=p.slots[0]; vmEquip('thompson',0);
p.curW.mag=0; p.curW.reserve=60;
VM.state='idle'; VM.stateT=0; VM.stateDur=0;
p.cancelReadBar(null,true);
tryReload(true);
out.dur=VM.stateDur; out.t0=VM.stateT; out.state0=VM.state;
tryReload(true);                                  // 同键重按 R = 加速 (不重启不取消)
out.t1=VM.stateT; out.state1=VM.state;
out.exp=out.t0+VM.stateDur*BAR_PRESS_BOOST;
return out; })()`);
assert('⑦ 换弹中重按 R: 状态保持 reload (不取消不重启)',m2.state0==='reload'&&m2.state1==='reload'&&m2.dur>0);
assert('⑦ 推进量 = stateDur × 2.5% (BAR_PRESS_BOOST 单源)',
 Math.abs(m2.t1-m2.exp)<1e-9,`t0=${m2.t0.toFixed(4)} t1=${m2.t1.toFixed(4)} exp=${m2.exp.toFixed(4)}`);

// ── ⑧ F 前摇同键加速 ──
section('⑧ 前摇 useCast 同键 F 加速 (行为)');
const m3=run(`(()=>{ const out={};
const p=player;
p.alive=true; p.isPlayer=true; p.spectator=false;
p.onBattery=null; p.onNaval=null; p.onCapital=null; p.useCast=null; p.loiter=null;
VM.state='idle'; VM.stateT=0; VM.stateDur=0;
const fakeG={user:p,alive:true};
p.useCast={kind:'mg',g:fakeG,t:0.3,dur:EM_CAST_DUR};
tryInteract();                                    // 前摇中再按 F = 加速 (旧版: 取消上机)
out.kept=!!p.useCast; out.t=p.useCast?p.useCast.t:null;
out.userKept=fakeG.user===p;
out.exp=0.3+EM_CAST_DUR*BAR_PRESS_BOOST;
return out; })()`);
assert('⑧ 前摇中再按 F: 前摇保留不取消 (占位不释放)',m3.kept===true&&m3.userKept===true);
assert('⑧ 前摇推进量 = dur × 2.5% (自 0.3s 起)',m3.t!==null&&Math.abs(m3.t-m3.exp)<1e-9,`t=${m3.t} exp=${m3.exp.toFixed(4)}`);

// ── ⑨ specWillBe 矩阵 + 票尽拦截 ──
section('⑨ 票尽观战部署门 (行为)');
const m4=run(`(()=>{ const out={}; const p=player;
p.team=0; p.alive=true; p.deployed=false;
p.specWant=true; p.spectator=false; out.a=p.specWillBe();   // 待生效意图=开 → 放行
p.specWant=false; p.spectator=true; out.b=p.specWillBe();   // 显式关 → 不放行 (不得票尽复活成普通步兵)
p.specWant=null; p.spectator=true; out.c=p.specWillBe();    // 已是观战者 → 放行
p.specWant=null; p.spectator=false; out.d=p.specWillBe();   // 无意图 → 不放行
const tk0=tickets[0]; tickets[0]=0;
window.__km=[]; const _km=addKillMsg; addKillMsg=(m,tm)=>{window.__km.push(String(m));};
p.alive=false; p.deployed=false; p.specWant=null; p.spectator=false;
deployPlayer();                                             // 票尽+非观战意图 = 拦
out.blocked=player.deployed; out.km=window.__km.slice();
addKillMsg=_km; tickets[0]=tk0;
return out; })()`);
assert('⑨ specWillBe: specWant=true → true / specWant=false → false / null+spectator → true / 全无 → false',
 m4.a===true&&m4.b===false&&m4.c===true&&m4.d===false,
 `a=${m4.a} b=${m4.b} c=${m4.c} d=${m4.d}`);
assert('⑨ 票尽+非观战意图: deployPlayer 拦下 (不落地) 且弹"兵力已耗尽"战报',
 !m4.blocked&&m4.km.some(m=>m.indexOf('兵力已耗尽')>=0),`km=${m4.km.join(' | ')}`);

// ── ⑩ 迫击炮爆炸参数 (间谍) ──
section('⑩ 迫击炮削弱 (行为)');
const m5=run(`(()=>{ const out={cap:[]};
const _sd=splashDamage, _ds=damageStructures;
splashDamage=function(pos,att,team,r,d1,d2,ap,tag){ out.cap.push(['splash',r,d1,d2,ap]); };
damageStructures=function(pos,r,amt,att){ out.cap.push(['struct',r,amt]); };
nadeExplode({mortar:true,pos:new THREE.Vector3(0,1,0),thrower:player,team:player.team||0,src:'迫击炮'});
splashDamage=_sd; damageStructures=_ds;
return out; })()`);
assert('⑩ 迫击炮爆圈 = 半径 5.25 / 步兵 100 / 载具 150 / 非反装甲',
 m5.cap.length>=1&&m5.cap[0][0]==='splash'&&m5.cap[0][1]===5.25&&m5.cap[0][2]===100&&m5.cap[0][3]===150&&m5.cap[0][4]===false,
 `cap=${JSON.stringify(m5.cap[0])}`);
assert('⑩ 结构伤害圈 = 半径 5 / 伤害 210',m5.cap.length>=2&&m5.cap[1][0]==='struct'&&m5.cap[1][1]===5&&m5.cap[1][2]===210,
 `cap=${JSON.stringify(m5.cap[1])}`);

console.log('\n' + (BAD.length? `✗ ${BAD.length} 红 / ${OK.length} 绿` : `✓ 全绿 (${OK.length})`));
if(BAD.length){ process.exitCode=1; if(NEG) console.log('(阴性对照: 有红=判据具备分辨力)'); }
else if(NEG){ console.log('✗ 阴性对照全绿 = 判据空转!'); process.exitCode=1; }
}
