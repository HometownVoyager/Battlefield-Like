// ─────────────────────────────────────────────────────────────
// dev/verify-deployundo-20261027.js —— 2026-10-27 需求「布势撤销 + 重选兵种 / 确认后兵种锁定」验收
//
// 用法: node dev/verify-deployundo-20261027.js [--neg]
//   --neg = 阴性对照: 装载前把本批核心改动按文本还原成旧写法, 同一批判据必须报红。
//
// 被测 (用户 7 项需求第 6 项后半段):
//   「在选择指挥官并进入布势状态下, 允许撤销布局 + 退出并重选兵种; 确认之后兵种锁定不可更换。」
//
// 覆盖:
//   ① 源码锚: 23-deploy 的 cmdDeployUndo 单源五步 (收图走 cmdMapClose(false) / 配比按实际重算 /
//     deployed 复位 / lockedDir 复位 / showDeploy 单源叫回部署页 + hl·sel·cursor·focusFire 临时账归零)
//     + 22-hud 的锁定态对账接线 (updateHUD 里 syncClassCardLock, 判据签名变了才刷)
//     + 23-deploy syncClassCardLock 单源 (判据 = cmdClassCardGate + 整备门)
//   ② 撤销链真行为 (真沙箱, startBtn 真开局): 布势 → 确认 (盖章 'in') → 撤销
//     ⇒ mapOn/mapDeploy=false ∧ lockedDir===null ∧ player.deployed===false ∧ 部署页回来 ∧
//        cmdClassCardGate(0)/(5) 都回 null (撤销后能重选) ∧ 宿主搬回 #ui
//   ③ 配比复位: 布势里改配比 (真调 setClass 改过组员 cls) → 撤销 ⇒ s.ratio 与成员实际分布逐项相等
//   ④ 确认后锁定: 确认开战即盖章 (lockedDir='in') ⇒ cmdClassCardGate(0) 返回非 null 且文案正确;
//     未盖章时 cmdClassCardGate(5) 返回 null; 盖章后 cmdClassCardGate(5) 仍 null (指挥官卡自身可重进布势)
//   ⑤ 撤销后重选: 撤销 → 选他种 → 再确认 ⇒ 盖章 'out' 且指挥官卡被拦 ('本局未选指挥官')
//   ⑥ 落地后不可换: deployPlayer 后 lockedDir 仍 'in', 门仍拦; 死亡重生再部署不改变方向 (幂等)
//   ⑦ 边界: 已落地时 cmdDeployUndo 拒绝执行 (返回 false 且不动任何账)
//   ⑧ 回归对账: 非指挥官局 cmdDeployUndo 不炸 / 关图路径与 cmdDeployConfirm 仍各自成立
//
// 口径: 与 verify-commander-20261026 同款 boot (_bootstub 桩 + 全链 FILES + startBtn.onclick 真开局),
//   调游戏自己的接口 (cmdDeployOpen/cmdDeployConfirm/cmdDeployUndo/cmdRatioAdj/cmdClassCardGate/
//   cmdLockStamp/deployPlayer), 不重写第二套状态机。
// ─────────────────────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const NEG=process.argv.includes('--neg');
const OK=[],BAD=[];
function assert(name,cond,detail){ (cond?OK:BAD).push(name); console.log(`  ${cond?'✓':'✗'} ${name}${detail?'  '+detail:''}`); }
function section(t){ console.log('\n══ '+t+' ══'); }
const SRC=f=>fs.readFileSync(path.join(root,f),'utf8');

// ── 阴性对照 (锚点用修后原文; 找不到就抛错, 防"锚点漂移后静默通过"; 全单行锚避开 CRLF 坑) ──
const PATCHES=[
 // A 撤销时不再复位 R10 锁定方向 (⇒ 撤销后仍被锁死, ②⑤ 判据红)
 ['js/23-deploy.js',
  "if(typeof CMD!=='undefined'&&CMD){ CMD.lockedDir=null; }",
  ";"],
 // B 撤销时不再把玩家打回"未落地" (⇒ 部署页显示「返 回 战 斗」, ② 判据红)
 ['js/23-deploy.js',
  "if(typeof player!=='undefined'&&player){ player.deployed=false; }",
  ";"],
 // C 撤销时不再复位配比 (⇒ ③ 判据红: 期望配比与实际分布脱钩)
 ['js/23-deploy.js',
  "s.ratio=null;                     // 清掉缓存 ⇒ cmdRatioOf 下一次按成员当前 cls 重建 (单源统计在 26-commander)",
  ";"],
 // D 撤销时不再叫回部署页 (⇒ ② 判据红: 只剩 3D 画面, 玩家点不到出口)
 ['js/23-deploy.js',
  "if(typeof showDeploy==='function') showDeploy(false);",
  ";"],
 // E 撤销不再收图 (⇒ ② 判据红: mapOn/mapDeploy 仍 true, 世界仍冻结)
 ['js/23-deploy.js',
  "if(typeof cmdMapClose==='function'){ cmdMapClose(false); }",
  ";"],
 // F 撤销不再清「这次看图」临时账 (⇒ ① 源码锚 + ② hl 判据红)
 ['js/23-deploy.js',
  "if(typeof CMD!=='undefined'&&CMD){ CMD.hl=null; CMD.sel=null; CMD.cursor=null; CMD.focusFire=null; }",
  ";"],
 // G 22-hud 不再做锁定态对账 (⇒ ① 接线锚 + ④ 卡片样式判据红)
 ['js/22-hud.js',
  "if(_sig!==_classLockSig){ _classLockSig=_sig; syncClassCardLock(); }",
  ";"],
 // H syncClassCardLock 不再按 R10 门判锁 (⇒ ④ 卡片 locked 样式判据红)
 ['js/23-deploy.js',
  "const cmdLocked=(typeof cmdClassCardGate==='function')?cmdClassCardGate(i):null;",
  "const cmdLocked=null;"],
 // I 撤销的落地边界门退场 (⇒ ⑦ 判据红: 已落地的人被踢回未落地)
 ['js/23-deploy.js',
  "if(typeof player!=='undefined'&&player&&player.deployed) return false;",
  ";"],
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
const s23=srcOf('js/23-deploy.js'),s22=srcOf('js/22-hud.js');
assert('23-deploy 撤销单源就位: 全局 cmdDeployUndo 存在且五步齐备',
 s23.includes('function cmdDeployUndo(){')
 &&s23.includes("if(typeof cmdMapClose==='function'){ cmdMapClose(false); }")
 &&s23.includes('s.ratio=null;')
 &&s23.includes("if(typeof player!=='undefined'&&player){ player.deployed=false; }")
 &&s23.includes("if(typeof CMD!=='undefined'&&CMD){ CMD.lockedDir=null; }")
 &&s23.includes("if(typeof showDeploy==='function') showDeploy(false);"));
// 判据只取**代码行** (先剔注释): 注释里必须能写清"为什么不能自己写 CMD.mapOn=false", 那不是缺陷。
const s23code=s23.split('\n').filter(l=>!/^\s*\/\//.test(l)).join('\n');
assert('23-deploy 撤销收图走 cmdMapClose(false) 单源 (代码里不自己写 CMD.mapOn=false ⇒ 宿主搬运不被跳过)',
 s23.includes("if(typeof cmdMapClose==='function'){ cmdMapClose(false); }")
 &&!/function cmdDeployUndo\(\)\{[\s\S]{0,600}CMD\.mapOn=false/.test(s23code));
assert('23-deploy 撤销清「这次看图」四项临时账 (hl/sel/cursor/focusFire 与 26 的进图归零同源)',
 s23.includes('CMD.hl=null; CMD.sel=null; CMD.cursor=null; CMD.focusFire=null;'));
assert('23-deploy 撤销有落地边界门 (已落地拒绝执行, 不把战斗中的人踢回未落地)',
 s23.includes("if(typeof player!=='undefined'&&player&&player.deployed) return false;"));
assert('23-deploy 撤销带中文反馈 pop (文案键与 00b-i18n 词典对齐)',
 s23.includes("showScorePop(t2('布势已撤销 · 可重新选择兵种'))"));
// 卡片锁定样式: 单源函数 + 两个触发点 (showDeploy 打开页 / 22-hud 逐帧对账)
assert('23-deploy 卡锁样式单源 syncClassCardLock (顶层函数, 不是嵌在 showDeploy 里)',
 /^function syncClassCardLock\(\)\{/m.test(s23)
 &&s23.includes("const cmdLocked=(typeof cmdClassCardGate==='function')?cmdClassCardGate(i):null;"));
assert('showDeploy 复用该单源 (不再自己内联一份锁定样式)',
 (s23.match(/const cmdLocked=\(typeof cmdClassCardGate==='function'\)\?cmdClassCardGate\(i\):null;/g)||[]).length===1
 &&s23.includes('syncClassCardLock();'));
assert('22-hud 锁定态对账接线 (updateHUD 里按签名变化调 23-deploy 单源, 稳态零 DOM 写入)',
 s22.includes('let _classLockSig=null;')
 &&s22.includes("if(typeof syncClassCardLock==='function'){")
 &&s22.includes("if(_sig!==_classLockSig){ _classLockSig=_sig; syncClassCardLock(); }")
 &&s22.includes("const _sig=(typeof CMD!=='undefined'&&CMD?String(CMD.lockedDir):'-')"));
assert('22-hud 兵种卡点击仍过 R10 门 (cmdClassCardGate 单源, 未新增第二道门)',
 s22.includes('const gate=cmdClassCardGate(i);')
 &&s22.includes("showScorePop(t2('指挥官')+': '+t2(gate));"));
}

// ── 沙箱装载 (_bootstub 桩; 与 verify-commander 同款) ─────────
const {sandbox,document,window}=require('./_bootstub.js');
const V3c=sandbox.THREE.Vector3;
if(!V3c.prototype.addScalar) V3c.prototype.addScalar=function(s){ this.x+=s; this.y+=s; this.z+=s; return this; };
if(!V3c.prototype.divideScalar) V3c.prototype.divideScalar=function(s){ s=s||1; this.x/=s; this.y/=s; this.z/=s; return this; };
if(!V3c.prototype.clampScalar) V3c.prototype.clampScalar=function(a,b){ this.x=Math.min(b,Math.max(a,this.x)); this.y=Math.min(b,Math.max(a,this.y)); this.z=Math.min(b,Math.max(a,this.z)); return this; };
if(!V3c.prototype.cross) V3c.prototype.cross=function(v){ return this.crossVectors(this,v); };
if(!V3c.prototype.negate) V3c.prototype.negate=function(){ this.x=-this.x; this.y=-this.y; this.z=-this.z; return this; };
for(const k of ['MeshLambertMaterial','MeshBasicMaterial','MeshStandardMaterial','MeshPhongMaterial','PointsMaterial','SpriteMaterial']){
const C=sandbox.THREE[k];
if(!C||!C.prototype) continue;
if(!C.prototype.clone) C.prototype.clone=function(){ return new C(Object.assign({},this,{color:this.color})); };
if(!C.prototype.dispose) C.prototype.dispose=function(){};
}
const O3=sandbox.THREE.Object3D;
if(O3&&O3.prototype&&!O3.prototype.clear) O3.prototype.clear=function(){ if(this.children) this.children.length=0; return this; };
const BA=sandbox.THREE.BufferAttribute;
if(BA&&BA.prototype&&!BA.prototype.setXYZ) BA.prototype.setXYZ=function(i,x,y,z){ return this; };
if(!sandbox.THREE.Line) sandbox.THREE.Line=class extends O3{constructor(g,m){super();this.geometry=g||{};this.material=m||{};this.isLine=true;}};
const AP=()=>({value:0,setValueAtTime(){},setTargetAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}});
const ACStub=class{
createOscillator(){return {frequency:AP(),detune:AP(),type:'',start(){},stop(){},connect(){},onended:null};}
createGain(){return {gain:AP(),connect(){},disconnect(){}};}
createBuffer(){return {getChannelData:()=>new Float32Array(16),duration:1,numberOfChannels:1};}
createBufferSource(){return {buffer:null,loop:false,playbackRate:AP(),start(){},stop(){},connect(){}};}
createBiquadFilter(){return {type:'',frequency:AP(),detune:AP(),Q:AP(),connect(){}};}
createDynamicsCompressor(){return {threshold:AP(),ratio:AP(),attack:AP(),release:AP(),connect(){}};}
createStereoPanner(){return {pan:AP(),connect(){}};}
resume(){return Promise.resolve();} get state(){ return 'running'; } get destination(){ return {}; }
get currentTime(){ return 0; } get sampleRate(){ return 44100; }
};
sandbox.AudioContext=ACStub; sandbox.window.AudioContext=ACStub; sandbox.window.webkitAudioContext=ACStub;
sandbox.confirm=()=>true;
delete sandbox.window.CANNON;

// 全链文件表 (与 index.html 同序)
const FILES=['js/00-config.js','js/00b-i18n.js','js/00c-procgen.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/19b-gamepad.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/22a-menuart.js','js/22b-speclayer.js','js/23-deploy.js','js/23b-worldrestore.js','js/25-zombies.js','js/26-commander.js','js/24-main.js'];
const CAMP=8;   // 草原遭遇 (与 verify-commander 同图): 标准陆战, 坦克+飞机齐, 无海战编制

function boot(campIdx){
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document; ctx.window=window;
ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
ctx.console={log:(...a)=>{ const s=a.map(x=>String(x)).join(' '); if(!/^\[(地形|HUD|NAV|世界|音频)/.test(s)) console.log(...a); }, warn:console.warn.bind(console), error:console.error.bind(console)};
for(const f of FILES){ vm.runInContext(srcOf(f),ctx,{filename:f}); }
return ctx;
}

let CTX=null;
function run(code){ return vm.runInContext(code,CTX,{timeout:600000}); }
function bootGame(){
CTX=boot(CAMP);
const st=run(`(()=>{ try{ const b=document.getElementById('startBtn'); if(b&&b.onclick){ b.onclick(); return 'ok'; } return 'no-button'; }catch(e){ return 'ERR '+String(e&&e.stack||e).slice(0,400); } })()`);
return st;
}
// ── ② 撤销链真行为 ───────────────────────────────────────────
{
section('② 撤销链真行为 (布势 → 确认 → 撤销, 真沙箱)');
const st=bootGame();
assert('开局链真路径 startBtn.onclick 无异常',st==='ok',st==='ok'?'':' '+st);
const r=run(`(()=>{ const out={};
// 归零到"选兵阶段 + 本图开放指挥官"的干净起点
cmdResetMatch();
player.spectator=false; if('specWant' in player) player.specWant=null;
player.cls=5; player.alive=false; player.deployed=false;
matchOver=false; gamePaused=false; menuHold=false;
cmdOrbatBuild();
// 布势期: 开图 (挂 body) + 冻结 + deploySeen
cmdDeployOpen();
out.depOpen={mapOn:CMD.mapOn,mapDeploy:CMD.mapDeploy,host:document.getElementById('cmdMapWrap').parentNode===document.body,freeze:cmdDtGate(0.016,0.016)===0,seen:CMD.deploySeen};
out.preLock=CMD.lockedDir;
// 确认开战 = 语义提交点 ⇒ 盖章 'in' (26-commander cmdDeployConfirm)
cmdDeployConfirm();
out.afterConfirm={mapOn:CMD.mapOn,mapDeploy:CMD.mapDeploy,lockedDir:CMD.lockedDir,deployed:player.deployed,
  host:document.getElementById('cmdMapWrap').parentNode===document.getElementById('ui'),
  gate0:cmdClassCardGate(0),gate5:cmdClassCardGate(5),unfreeze:cmdDtGate(0.016,0.016)!==0};
// 撤销 = 这次选择作废
out.undoRet=cmdDeployUndo();
out.afterUndo={mapOn:CMD.mapOn,mapDeploy:CMD.mapDeploy,lockedDir:CMD.lockedDir,deployed:player.deployed,
  gate0:cmdClassCardGate(0),gate5:cmdClassCardGate(5),
  depHidden:document.getElementById('deploy').classList.contains('hidden'),
  host:document.getElementById('cmdMapWrap').parentNode===document.getElementById('ui'),
  wrapHidden:document.getElementById('cmdMapWrap').classList.contains('hidden'),
  hl:(CMD.hl===null||CMD.hl===undefined),sel:(CMD.sel===null||CMD.sel===undefined),
  cursor:(CMD.cursor===null||CMD.cursor===undefined),focusFire:(CMD.focusFire===null||CMD.focusFire===undefined),
  deployBtn:document.getElementById('deployBtn').style.display,resumeBtn:document.getElementById('resumeBtn').style.display};
return out; })()`);
assert('布势开在 body (inDeploy 压制网外) + 世界冻结 + deploySeen',
 r.depOpen.mapOn===true&&r.depOpen.mapDeploy===true&&r.depOpen.host===true&&r.depOpen.freeze===true&&r.depOpen.seen===true,
 JSON.stringify(r.depOpen));
assert('布势期未盖章 (lockedDir===null)',r.preLock===null,String(r.preLock));
assert("确认开战 = 盖章单源 'in' (26-commander cmdDeployConfirm) + 收图解冻 + 宿主搬回 #ui",
 r.afterConfirm.mapOn===false&&r.afterConfirm.mapDeploy===false&&r.afterConfirm.lockedDir==='in'
 &&r.afterConfirm.host===true&&r.afterConfirm.unfreeze===true,JSON.stringify(r.afterConfirm));
assert('确认后未落地即锁定: cmdClassCardGate(0) 返回非 null (验收书核心断言)',
 r.afterConfirm.gate0!==null,String(r.afterConfirm.gate0));
assert('确认后指挥官卡自身仍可选 (可重进布势调配比)',r.afterConfirm.gate5===null,String(r.afterConfirm.gate5));
assert('撤销返回 true 且五份账全归位: mapOn/mapDeploy=false ∧ lockedDir===null ∧ player.deployed===false',
 r.undoRet===true&&r.afterUndo.mapOn===false&&r.afterUndo.mapDeploy===false
 &&r.afterUndo.lockedDir===null&&r.afterUndo.deployed===false,JSON.stringify(r.afterUndo));
assert('撤销后兵种卡全部重新可选: cmdClassCardGate(0)===null ∧ cmdClassCardGate(5)===null (lead 指定断言)',
 r.afterUndo.gate0===null&&r.afterUndo.gate5===null,
 'gate0='+r.afterUndo.gate0+' gate5='+r.afterUndo.gate5);
assert('撤销后部署页回来 (showDeploy 单源: #deploy 可见 + 「部 署」按钮在场 / 「返 回 战 斗」收起)',
 r.afterUndo.depHidden===false&&r.afterUndo.deployBtn==='inline-block'&&r.afterUndo.resumeBtn==='none',
 JSON.stringify({dep:r.afterUndo.depHidden,deploy:r.afterUndo.deployBtn,resume:r.afterUndo.resumeBtn}));
// 只断言**宿主** (parentNode 在桩 DOM 里是真语义); wrap 的 hidden 类断言不了 ——
// _bootstub 的 classList.contains 恒 false (见文件头说明), 那条判据交给真浏览器探针 (dev/probe-deployundo-20261027.js)。
assert('撤销后地图宿主搬回 #ui (复用 cmdMapClose 的搬运, 不滞留 body)',r.afterUndo.host===true);
assert('撤销后「这次看图」四项临时账归零 (hl/sel/cursor/focusFire)',
 r.afterUndo.hl&&r.afterUndo.sel&&r.afterUndo.cursor&&r.afterUndo.focusFire,JSON.stringify(r.afterUndo));
}

// ── ②b 撤销清初始令 (2026-10-27 排查批) ──────────────────────
// 虫点: cmdDeployUndo 复位了配比/锁章/看图账/私人小队, 唯独没清布势期 E/F/R 下的初始令 ——
// 撤销后改选普通兵种, 玩家不再是指挥官 (开不了图), 这批幽灵令却照常被 AI 消费, 打满整局无人能取消。
// 判据: 布势期用真入口 cmdOrderUnit 下 hold/attack_move/strike → cmdDeployUndo → 全单位归 free
// 且飞机 strike 任务账 (strikePt/strikeT0) 同清 (与 cmdOrderUnit free 分支的同生同灭口径一致)。
{
section('②b 撤销布势把初始令一并作废 (cmdOrbatClearOrders 单源)');
bootGame();
const r=run(`(()=>{ const out={};
cmdResetMatch();
player.spectator=false; if('specWant' in player) player.specWant=null;
player.cls=5; player.alive=false; player.deployed=false;
matchOver=false; gamePaused=false; menuHold=false;
cmdOrbatBuild();
cmdDeployOpen();
const us=cmdUnits();
out.units=us.length;
const tk=us.find(u=>u.kind==='tank'), pl=us.find(u=>u.kind==='plane');
if(us[0]) cmdOrderUnit(us[0],'hold',120,64);
if(tk) cmdOrderUnit(tk,'attack_move',50,-30);
if(pl) cmdOrderUnit(pl,'strike',10,10);
const modeOf=u=>u&&u.order&&u.order.mode;
out.pre={sq:modeOf(us[0]),tk:modeOf(tk),pl:modeOf(pl),
  strikePt:!!(pl&&pl.veh&&pl.veh.strikePt),strikeT0:!!(pl&&pl.veh&&pl.veh.strikeT0!==undefined)};
out.undo=cmdDeployUndo();
const us2=cmdUnits();
const tk2=us2.find(u=>u.kind==='tank'), pl2=us2.find(u=>u.kind==='plane');
out.post={sq:modeOf(us2[0]),tk:modeOf(tk2),pl:modeOf(pl2),
  strikePt:!!(pl2&&pl2.veh&&pl2.veh.strikePt),strikeT0:!!(pl2&&pl2.veh&&pl2.veh.strikeT0!==undefined)};
cmdResetMatch();
return out; })()`);
assert('撤销前初始令在账 (hold / attack_move / strike + strikeT0)',
 r.units>0&&r.pre.sq==='hold'&&(!r.pre.tk||r.pre.tk==='attack_move')&&(!r.pre.pl||r.pre.pl==='strike')
 &&(!r.pre.pl||r.pre.strikePt===true&&r.pre.strikeT0===true),JSON.stringify(r.pre));
assert('撤销后全令归 free + 飞机 strikePt/strikeT0 清账 (幽灵令不带进下一份选择)',
 r.undo===true&&r.post.sq==='free'&&(!r.post.tk||r.post.tk==='free')&&(!r.post.pl||r.post.pl==='free')
 &&(!r.post.pl||(r.post.strikePt===false&&r.post.strikeT0===false)),JSON.stringify(r.post));
}

// ── ③ 配比复位 ───────────────────────────────────────────────
{
section('③ 撤销时兵种配比按当前实际 cls 复位');
const r=run(`(()=>{ const out={};
cmdResetMatch();
player.spectator=false; player.cls=5; player.alive=false; player.deployed=false;
matchOver=false; gamePaused=false; menuHold=false;
cmdOrbatBuild();
const s=CMD.orbat.squads[0];
out.hasSquad=!!s;
if(s){
const base=cmdRatioOf(s).slice();
out.base=base; out.members=s.members.length;
// 真改配比: 把第 0 类挪一个到第 1 类 (cmdRatioAdj 内部 cmdRatioApply 会真调 setClass 改组员 cls)
cmdRatioAdj(s,0,-1); cmdRatioAdj(s,1,1);
out.edited=cmdRatioOf(s).slice();
// 记下编辑后的**实际**分布 (成员 cls 统计, 与 cmdRatioOf 的期望值应当已经相等 —— 布势的语义)
const act=[0,0,0,0,0]; for(const b of s.members){ const ci=(b&&typeof b.cls==='number'&&b.cls>=0&&b.cls<5)?(b.cls|0):-1; if(ci>=0) act[ci]++; }
out.actualAfterEdit=act;
// 模拟"配比读数被外部改动"(撤销前先把它拧成一份与事实不符的值, 才能验出撤销真的重算了)
s.ratio=[s.members.length,0,0,0,0];
out.stale=s.ratio.slice();
cmdDeployOpen();
out.undo=cmdDeployUndo();
out.afterRatio=cmdRatioOf(s).slice();
const act2=[0,0,0,0,0]; for(const b of s.members){ const ci=(b&&typeof b.cls==='number'&&b.cls>=0&&b.cls<5)?(b.cls|0):-1; if(ci>=0) act2[ci]++; }
out.actualAfterUndo=act2;
out.sum=out.afterRatio.reduce((a,b)=>a+b,0);
}
return out; })()`);
assert('沙箱里存在可测的步兵组 (cmdOrbatBuild 真建编制)',r.hasSquad===true);
assert('布势改配比真改到组员 cls (期望值==实际分布, 布势语义自洽)',
 r.edited&&r.edited.every((v,i)=>v===r.actualAfterEdit[i]),JSON.stringify({edited:r.edited,actual:r.actualAfterEdit}));
assert('撤销把配比按**当前实际 cls** 重算 (不复位成旧值/不保留被拧坏的读数)',
 r.afterRatio&&r.afterRatio.every((v,i)=>v===r.actualAfterUndo[i])
 &&r.afterRatio.every((v,i)=>v===r.edited[i]),
 JSON.stringify({stale:r.stale,afterUndo:r.afterRatio,actual:r.actualAfterUndo}));
assert('撤销后配比合计仍等于组内人数 (守恒)',r.sum===r.members,`sum=${r.sum} members=${r.members}`);
}
// ── ④ 兵种锁定链路 (确认后 / 落地后 / 死亡重生) ──────────────
{
section('④ 兵种锁定链路: 确认即盖章 → 落地幂等 → 死亡重生不变向');
const r=run(`(()=>{ const out={};
cmdResetMatch();
player.spectator=false; if('specWant' in player) player.specWant=null;
player.cls=5; player.alive=false; player.deployed=false;
matchOver=false; gamePaused=false; menuHold=false;
selectedSpawn=-1;
cmdOrbatBuild();
// 未盖章时: 指挥官卡可选 (基线, 证明门不是恒拦)
out.fresh5=cmdClassCardGate(5); out.fresh0=cmdClassCardGate(0);
// 确认开战 ⇒ 盖章 'in'
cmdDeployOpen(); cmdDeployConfirm();
out.confirmLock=CMD.lockedDir;
out.confirmGate0=cmdClassCardGate(0); out.confirmGate1=cmdClassCardGate(1); out.confirmGate5=cmdClassCardGate(5);
// 落地 (deployPlayer 里 cmdLockStamp 幂等: 已有 lockedDir 就 return)
deployPlayer();
out.landLock=CMD.lockedDir; out.landDeployed=player.deployed; out.landCls=player.cls;
out.landGate0=cmdClassCardGate(0);
// 落地后死亡重生再部署: 方向不变 (整局双向锁)
player.alive=false; player.deployed=false; deployPlayer();
out.reLock=CMD.lockedDir; out.reCls=player.cls;
// 反向: 选他种后确认 ⇒ 'out', 指挥官卡被拦
cmdResetMatch(); player.alive=false; player.deployed=false; player.cls=2;
cmdOrbatBuild();
cmdDeployOpen(); cmdDeployConfirm();
out.outLock=CMD.lockedDir; out.outGate5=cmdClassCardGate(5); out.outGate0=cmdClassCardGate(0);
cmdResetMatch();
return out; })()`);
assert('未盖章时指挥官卡/步兵卡都可选 (门不是恒拦, 对照组)',
 r.fresh5===null&&r.fresh0===null,JSON.stringify({g5:r.fresh5,g0:r.fresh0}));
assert("确认开战即盖章 'in' (提交点语义, 无需等落地)",r.confirmLock==='in',String(r.confirmLock));
assert('确认后 cmdClassCardGate(0)/(1) 返回非 null 且文案=「本局已锁定指挥官」',
 r.confirmGate0==='本局已锁定指挥官'&&r.confirmGate1==='本局已锁定指挥官',
 JSON.stringify({g0:r.confirmGate0,g1:r.confirmGate1}));
assert('确认后指挥官卡自身仍可选 (可重进布势调布局)',r.confirmGate5===null,String(r.confirmGate5));
assert('落地后锁定方向不变 (deployPlayer 的 cmdLockStamp 幂等, 不覆盖已盖的章)',
 r.landLock==='in'&&r.landDeployed===true&&r.landCls===5&&r.landGate0==='本局已锁定指挥官',
 JSON.stringify({lock:r.landLock,cls:r.landCls,g0:r.landGate0}));
assert("死亡重生再部署: 方向仍 'in' (整局双向锁, R10)",
 r.reLock==='in'&&r.reCls===5,JSON.stringify({lock:r.reLock,cls:r.reCls}));
assert("选他种后确认 ⇒ 盖章 'out' 且指挥官卡被拦 ('本局未选指挥官'), 其余卡自由",
 r.outLock==='out'&&r.outGate5==='本局未选指挥官'&&r.outGate0===null,
 JSON.stringify({lock:r.outLock,g5:r.outGate5,g0:r.outGate0}));
}

// ── ⑤ 撤销后重选兵种 (完整往返) ──────────────────────────────
{
section('⑤ 撤销 → 重选兵种 → 再确认 (完整往返, 用户需求原文)');
const r=run(`(()=>{ const out={};
cmdResetMatch();
player.spectator=false; player.cls=5; player.alive=false; player.deployed=false;
matchOver=false; gamePaused=false; menuHold=false; selectedSpawn=-1;
cmdOrbatBuild();
// 第一轮: 选指挥官 → 布势 → 确认 → 撤销
cmdDeployOpen(); cmdDeployConfirm();
out.round1Lock=CMD.lockedDir;
out.undo=cmdDeployUndo();
out.afterUndoLock=CMD.lockedDir;
// 撤销后重选他种 (模拟点兵种卡: 门必须先放行, 再由 onclick 写 player.cls)
out.regate=cmdClassCardGate(2);
player.cls=2;
// 第二轮: 再确认 ⇒ 应盖 'out' (玩家改主意了, 撤销让这次改主意成立)
cmdDeployOpen(); cmdDeployConfirm();
out.round2Lock=CMD.lockedDir;
out.round2Gate5=cmdClassCardGate(5); out.round2Gate2=cmdClassCardGate(2);
// 第二轮也能撤销 (可反复往返, 不是一次性)
out.undo2=cmdDeployUndo();
out.afterUndo2=CMD.lockedDir;
cmdResetMatch();
return out; })()`);
assert('第一轮确认盖章 in → 撤销回 null (撤章与盖章成对, 单源只有 CMD.lockedDir)',
 r.round1Lock==='in'&&r.undo===true&&r.afterUndoLock===null,
 JSON.stringify({r1:r.round1Lock,undo:r.undo,after:r.afterUndoLock}));
assert('撤销后他种卡门放行 (gate(2)===null) ⇒ 玩家真能重选兵种',r.regate===null,String(r.regate));
assert("重选后再确认 ⇒ 盖章 'out' (撤销使改主意生效) 且指挥官卡被拦",
 r.round2Lock==='out'&&r.round2Gate5==='本局未选指挥官'&&r.round2Gate2===null,
 JSON.stringify({lock:r.round2Lock,g5:r.round2Gate5,g2:r.round2Gate2}));
assert('可反复往返: 第二轮撤销同样回 null (撤销不是一次性开关)',
 r.undo2===true&&r.afterUndo2===null,JSON.stringify({u:r.undo2,a:r.afterUndo2}));
}

// ── ⑥ 落地边界 + 零回归 ──────────────────────────────────────
{
section('⑥ 落地边界门 / 非指挥官零回归');
const r=run(`(()=>{ const out={};
cmdResetMatch();
player.spectator=false; player.cls=5; player.alive=true; player.deployed=true;
matchOver=false; gamePaused=false; menuHold=false; selectedSpawn=-1;
cmdOrbatBuild();
cmdLockStamp(5);
// 已落地 ⇒ 撤销必须拒绝且不动任何账 (不能把战斗中的人踢回未落地)
const before={lock:CMD.lockedDir,dep:player.deployed,on:CMD.mapOn,deploy:CMD.mapDeploy};
out.ret=cmdDeployUndo();
out.after={lock:CMD.lockedDir,dep:player.deployed,on:CMD.mapOn,deploy:CMD.mapDeploy};
out.before=before;
// 非指挥官局 (cls=0, lockedDir=null) 撤销不炸 (边界: 没有布势也该是安全的 no-op)
cmdResetMatch(); player.cls=0; player.alive=false; player.deployed=false;
out.plainRet=(()=>{ try{ return cmdDeployUndo(); }catch(e){ return 'ERR '+String(e&&e.message); } })();
out.plainLock=CMD.lockedDir; out.plainDep=player.deployed;
// 非指挥官局确认链不受影响 (布势入口只有指挥官卡, 这里验 confirm 本身仍安全)
out.confirmSafe=(()=>{ try{ cmdDeployConfirm(); return true; }catch(e){ return 'ERR '+String(e&&e.message); } })();
cmdResetMatch();
return out; })()`);
assert('已落地时 cmdDeployUndo 拒绝执行 (返回 false, 不动 lockedDir/deployed/mapOn)',
 r.ret===false&&r.after.lock===r.before.lock&&r.after.dep===true&&r.after.on===r.before.on,
 JSON.stringify({ret:r.ret,before:r.before,after:r.after}));
assert('非指挥官局 (无布势) 调 cmdDeployUndo 不抛异常且保持未落地',
 r.plainRet!=='ERR'&&String(r.plainRet).indexOf('ERR')!==0&&r.plainLock===null&&r.plainDep===false,
 JSON.stringify({ret:r.plainRet,lock:r.plainLock,dep:r.plainDep}));
assert('非指挥官局 cmdDeployConfirm 仍安全 (零回归: 该函数不在布势态也被其它路径调)',r.confirmSafe===true);
}
// ── ⑦ 卡片锁定样式单源 (showDeploy 与对账两条触发点都走同一函数) ──
{
section('⑦ 兵种卡锁定样式: 单源函数 + 两条触发路径');
const r=run(`(()=>{ const out={};
cmdResetMatch();
player.spectator=false; player.cls=5; player.alive=false; player.deployed=false;
matchOver=false; gamePaused=false; menuHold=false; selectedSpawn=-1;
cmdOrbatBuild();
// 打开部署页: 未盖章 ⇒ 全部卡可选 (无 locked 类)
showDeploy(false);
out.fresh=cmdClassCardGate(0);
// 确认 ⇒ 盖章 'in'; 就地调单源刷新 (沙箱里 document.querySelectorAll 恒 [] ⇒ 无法数 DOM,
// 因此这里验"函数可调且判据正确"这层, 样式落地由真浏览器探针覆盖)
cmdDeployOpen(); cmdDeployConfirm();
out.lockAfterConfirm=CMD.lockedDir;
out.syncSafe=(()=>{ try{ syncClassCardLock(); return true; }catch(e){ return 'ERR '+String(e&&e.message); } })();
out.syncType=typeof syncClassCardLock;
// 撤销后再刷: 门已复位 ⇒ 不应再锁
cmdDeployUndo();
out.lockAfterUndo=CMD.lockedDir;
out.syncSafe2=(()=>{ try{ syncClassCardLock(); return true; }catch(e){ return 'ERR '+String(e&&e.message); } })();
out.gateAfterUndo=cmdClassCardGate(0);
cmdResetMatch();
return out; })()`);
assert('syncClassCardLock 是全局单源函数 (22-hud 的 typeof 守卫能取到)',r.syncType==='function',String(r.syncType));
assert('单源函数在未盖章/盖章/撤销后三种状态下都不抛异常 (判据与写 DOM 分离, 沙箱 2d/空 DOM 桩下安全)',
 r.syncSafe===true&&r.syncSafe2===true,JSON.stringify({a:r.syncSafe,b:r.syncSafe2}));
assert("确认盖章后单源函数的判据输入已就位 (lockedDir==='in' ⇒ 非指挥官卡应锁)",
 r.lockAfterConfirm==='in',String(r.lockAfterConfirm));
assert('撤销后同一函数的判据输入复位 (lockedDir===null ⇒ 不锁, gate(0)===null)',
 r.lockAfterUndo===null&&r.gateAfterUndo===null,
 JSON.stringify({lock:r.lockAfterUndo,g0:r.gateAfterUndo}));
}

// ── ⑧ 回归对账 ───────────────────────────────────────────────
{
section('⑧ 回归对账: 既有链路未被打断');
const s23=srcOf('js/23-deploy.js'),s22=srcOf('js/22-hud.js'),s26=srcOf('js/26-commander.js');
assert('cmdDeployConfirm 的收图语义未变 (先 cmdMapClose 再清 mapDeploy, 宿主搬运不跳过)',
 s26.includes('function cmdDeployConfirm(){')
 &&s26.indexOf('cmdMapClose(false);')<s26.indexOf('CMD.mapDeploy=false;'));
assert('showDeploy 仍是部署界面唯一入口 (只此一处摘 #deploy 的 hidden)',
 (s23.match(/el\('deploy'\)\.classList\.remove\('hidden'\)/g)||[]).length===1);
assert('deployPlayer 的 R10 盖章调用未动 (落地仍是盖章点之一, 与确认盖章同源幂等)',
 s23.includes("if(typeof cmdLockStamp==='function') cmdLockStamp(p.cls);"));
// 取函数体用"起点→return true;"切片 (正则到第一个 `\n}` 会被函数内的 if 块提前截断)
const _undoBody=(()=>{
 const i=s23.indexOf('function cmdDeployUndo(){');
 if(i<0) return '';
 const j=s23.indexOf('return true;',i);
 return j<0?'':s23.slice(i,j);
})();
// 先剔注释行再数调用 —— 函数里的说明注释本身要能提 showDeploy( 讲清来龙去脉, 那不是第二处调用
const _undoCode=_undoBody.split('\n').filter(l=>!/^\s*\/\//.test(l)).join('\n');
assert('撤销不绕过 showDeploy 单源 (代码里恰好一次 showDeploy 调用, 不手写部署页 DOM)',
 _undoCode.split('showDeploy(').length===2
 &&!_undoCode.includes("el('deploy').classList"));
assert('22-hud 未新增第二道兵种卡门 (只有既有的 cmdClassCardGate 调用)',
 (s22.match(/cmdClassCardGate\(/g)||[]).length===1);
}

// ── 汇总 ─────────────────────────────────────────────────────
console.log(`\n${NEG?'[阴性对照] ':''}verify-deployundo: ${OK.length} 通过, ${BAD.length} 失败`);
if(BAD.length){ console.log('失败项:'); for(const b of BAD) console.log('  ✗ '+b); process.exit(1); }
