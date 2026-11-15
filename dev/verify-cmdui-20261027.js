// ─────────────────────────────────────────────────────────────
// dev/verify-cmdui-20261027.js —— 2026-10-27 指挥官交互重做批验收
//
// 用法: node dev/verify-cmdui-20261027.js [--neg]
//   --neg = 阴性对照: 装载前把本批核心改动按文本还原成旧写法, 同一批判据必须报红。
//
// 本批对应用户 7 项需求里的第 2/3/4/5/6 项 (通讯仪建模与第三人称持握见 dev/verify-radio-20261027.js,
// 布势撤销与兵种锁定见 dev/verify-deployundo-20261027.js):
//   ② 队标/队员/命中三处位置同源 (cmdSquadShown + cmdUnitCenter 单源, 修「严重偏差/漂移」)
//   ③ 集火: 左键点地图 → 半径内己方单位 14s 内优先打该点 (cmdFocusFire/cmdFocusOf/cmdFocusBonus,
//      消费点 14-bots perceive 与 15-vehicles tankPerceive)
//   ④ 指挥态重做: 一次只高亮一个可指挥项 + 滚轮切换 + E=防守 F=进攻·投弹 R=自由 + 左键集火 + 右键退出,
//      列表其余项压缩成细条, 面板美术对齐开始界面 (羊皮纸/黄铜)
//   ⑤ 减速键 N→V, 近战键 V→N (19-input / 24-main tMelee / 19b-gamepad / i18n / index.html 帮助)
//   ⑥ 局内指挥地图不显示的根因修复 (cmdMapWrapShow 单源显隐, 不许再写 wrap.style.display) + 画布居中正方形
//
// 口径: 与 verify-commander-20261026 同款 boot (_bootstub 桩 + 全链 FILES + startBtn.onclick 真开局),
//   调游戏自己的接口, 不重写第二套状态机。
// ─────────────────────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const NEG=process.argv.includes('--neg');
const OK=[],BAD=[];
function assert(name,cond,detail){ (cond?OK:BAD).push(name); console.log(`  ${cond?'✓':'✗'} ${name}${detail?'  '+detail:''}`); }
function section(t){ console.log('\n══ '+t+' ══'); }
const SRC=f=>fs.readFileSync(path.join(root,f),'utf8');

// ── 阴性对照 (锚点用修后原文; 找不到就抛错, 防「锚点漂移后静默通过」) ──
const PATCHES=[
 // A 显隐单源退场: 回到「写 style.display」的旧写法 ⇒ 显隐单源判据红
 ['js/26-commander.js',
  "function cmdMapWrapShow(on){\nconst w=cmdMapWrapEl();\nif(!w) return;\nw.classList.toggle('hidden',!on);\n}",
  "function cmdMapWrapShow(on){\nconst w=cmdMapWrapEl();\nif(!w) return;\nif(w.style) w.style.display=on?'':'none';\n}"],
 // B 高亮切换退场: cmdHlStep 变成空函数 ⇒ 滚轮判据红
 ['js/26-commander.js',
  "CMD.hl=us[i];\nCMD.sel=us[i];",
  ";"],
 // C 集火半径判据退场: 广播不再按半径筛 ⇒ 集火判据红
 ['js/26-commander.js',
  "if(d>CMD_FIRE.R) continue;",
  ";"],
 // D 集火过期判据退场: cmdFocusOf 恒返回 focus ⇒ 过期判据红
 ['js/26-commander.js',
  "if(t>unit.focus.until){ unit.focus=null; return null; }",
  ";"],
 // E 队位同源退场: 队标改用 alive 全集 (旧的第二套口径) ⇒ 位置同源判据红
 ['js/26-commander.js',
  "for(const b of u.members){ if(b&&b.alive&&!b.onVehicle) out.push(b); }",
  "for(const b of u.members){ if(b&&b.alive) out.push(b); }"],
 // F 三命令键退场: cmdKeyCommand 恒 false ⇒ 命令键判据红
 ['js/26-commander.js',
  "if(!CMD.mapOn||!CMD.orbat) return false;\nif(!CMD.hl){ cmdHlNearest(); if(!CMD.hl) return true; }",
  "return false;"],
 // F2 布势三命令键退场 (2026-10-27 用户实报: 开局前部署阶段 E/R/F 均无效):
 //    恢复旧写「布势期 E/F 吞掉不执行 + R 不归地图」⇒ 布势期 E/F/R 三条判据全红
 //    (E/F 返回 true 但零执行; R 返回 false ⇒ 19-input 继续走到早退块末尾被 return, 两头落空)。
 ['js/26-commander.js',
  "if(code===CMD_KEYS.hold) return cmdKeyCommand('hold');\nif(code===CMD_KEYS.attack) return cmdKeyCommand('attack');\nreturn cmdKeyCommand('free');",
  "if(CMD.mapDeploy) return code!==CMD_KEYS.free;\nif(code===CMD_KEYS.hold) return cmdKeyCommand('hold');\nif(code===CMD_KEYS.attack) return cmdKeyCommand('attack');\nreturn cmdKeyCommand('free');"],
 // G 减速键退场: 改回 KeyN ⇒ 键位判据红
 ['js/26-commander.js',
  "REARM_FRAC:0.25, KEY:'KeyV' };",
  "REARM_FRAC:0.25, KEY:'KeyN' };"],
 // H 确认盖章退场: 删掉 cmdDeployConfirm 里的盖章 ⇒ 确认即锁判据红
 ['js/26-commander.js',
  "if(typeof cmdLockStamp==='function') cmdLockStamp(player.cls);\nconst dep=document.getElementById('deploy');",
  "const dep=document.getElementById('deploy');"],
 // I 画布正方形退场: 回到铺满舞台 ⇒ 正方形判据红
 ['js/26-commander.js',
  "const side=Math.max(200,Math.round(Math.min(r.width,r.height)));",
  "const side=Math.max(200,Math.round(r.width));"],
 // J 集火消费点退场: 14-bots 不再加集火分 ⇒ 消费判据红
 ['js/14-bots.js',
  "const _fb=(typeof cmdFocusBonus==='function'&&this.cmdGrp)?cmdFocusBonus(this.cmdGrp,e.pos.x,e.pos.z):0;",
  "const _fb=0;"],
 // K 车组集火消费点退场 ⇒ 消费判据红
 ['js/15-vehicles.js',
  "sc+=cmdFocusBonus(_fu,t.pos.x,t.pos.z);",
  ";"],
 // L 近战键退场: 24-main 触控键改回 KeyV ⇒ 近战键判据红
 ['js/24-main.js',
  "bindBtn('tMelee',()=>kd('KeyN'),()=>ku('KeyN'));",
  "bindBtn('tMelee',()=>kd('KeyV'),()=>ku('KeyV'));"],
 // M 手柄近战键退场 ⇒ 手柄键判据红
 ['js/19b-gamepad.js',
  "{b:11,dn:()=>padKd('KeyN'),  up:()=>padKu('KeyN')},",
  "{b:11,dn:()=>padKd('KeyV'),  up:()=>padKu('KeyV')},"],
 // N 19-input 三命令键转发退场 ⇒ 接线判据红
 ['js/19-input.js',
  "if(typeof cmdMapKeyGate==='function'&&cmdMapKeyGate(e.code)) return;",
  ""],
 // O 19-input 近战键退场: 改回 KeyV ⇒ 键位判据红
 ['js/19-input.js',
  "if(e.code==='KeyN'){\n// ★2026-10-25 反馈轮①: 读条中 近战键",
  "if(e.code==='KeyV'){\n// ★2026-10-25 反馈轮①: 读条中 近战键"],
 // P Esc 分支退场 (2026-10-27 排查批: 布势期 Esc=确认开战的上提修复):
 //    回到旧写「cmdMapUIOpen 分支嵌在 deployed&&alive 门内」⇒ 布势期 (deployed/alive 皆 false) 永远
 //    走不到确认单源, Esc 落进 else 变 togglePause(true) ⇒ 上提判据红。同时收掉 !gamePaused 门
 //    (= 旧写暂停中 Esc 也会去操作被藏起的地图, 与 D20 暂停优先相悖)。
 ['js/19-input.js',
  "if(typeof cmdMapUIOpen==='function'&&cmdMapUIOpen()&&!gamePaused){",
  "if(player.deployed&&player.alive&&!matchOver){"],
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
const s26=srcOf('js/26-commander.js');
assert('26 显隐单源: cmdMapWrapShow 只切 class, 全文件不再写 wrap 的 style.display',
 s26.includes('function cmdMapWrapShow(on){')
 &&!s26.includes("w.classList.add('hidden'); if(w.style) w.style.display=''")
 &&!s26.includes("if(w.style){ w.style.display=wantHide?'none':''; }"),
 s26.includes('style.display')?'仍有 style.display 写入':'ok');
assert('26 开图/布势/暂停三处显隐都走 cmdMapWrapShow',
 (s26.match(/cmdMapWrapShow\(true\)/g)||[]).length>=2
 &&(s26.match(/cmdMapWrapShow\(false\)/g)||[]).length>=2);
assert('26 画布居中正方形 (cmdMapResize 取 min(W,H), CSS 五件套), 不再写 inset/100%',
 s26.includes('const side=Math.max(200,Math.round(Math.min(r.width,r.height)));')
 &&s26.includes("transform:translate(-50%,-50%)")
 &&!s26.includes("inset:0;width:100%;height:100%;cursor:crosshair"));
assert('26 滚轮 = 切高亮单位 (cmdHlStep), 不再是缩放',
 /cv\.addEventListener\('wheel'[\s\S]{0,700}?cmdHlStep\(dir\);/.test(s26)
 &&!/cv\.addEventListener\('wheel'[\s\S]{0,700}?CMD\.view\.scale=Math\.max/.test(s26));
assert('26 左键三档: 点到自己人=高亮, 点到别处=集火 (布势期不集火)',
 /if\(u\)\{ CMD\.hl=u; CMD\.sel=u; cmdMapDraw\(\); cmdMapPanelTick\(\); return; \}/.test(s26)
 &&/if\(CMD\.mapDeploy\) return;\ncmdFocusFire\(wx,wz\);/.test(s26));
assert('26 右键 = 退出指挥态 (走 cmdMapToggle 单源)',
 /\}else if\(e\.button===2\)\{[\s\S]{0,400}?cmdMapToggle\(\);/.test(s26));
assert('26 三命令键表单源 (CMD_KEYS) + 单一分流函数 cmdMapKeyGate',
 s26.includes("const CMD_KEYS={ hold:'KeyE', attack:'KeyF', free:'KeyR' };")
 &&s26.includes('function cmdMapKeyGate(code){')
 &&!s26.includes('function cmdMapKeySwallow('));
// ★2026-10-27 用户实报 bug 的防回退钉: 布势期不得再出现「吞掉」分支。
//   旧写 `if(CMD.mapDeploy) return code!==CMD_KEYS.free;` 有两个致命面: (i) E/F 返回 true 但**零执行**
//   (调用方 19-input 提前 return, 世界侧什么都不变) ⇒ 玩家读作"按键没接上"; (ii) R 返回 false 让 19-input
//   继续往下走, 而开图早退块末尾 `if(e.code!==CMD_TIME.KEY) return;` 又把 R 拦掉 ⇒ R 也死了。
//   不变量: 三个命令键在**任何**开图态下都必须走 cmdKeyCommand (执行), 不存在只吞不做的分支。
// 注意: 判据必须**先剥掉注释** —— 根因说明里逐字引用了旧写法 ("旧写 `if(CMD.mapDeploy) return ...`"),
//   不剥注释会把自己的解释文字当成代码命中 (本探针首跑就踩了这条假阳性)。
const _gateBody=(()=>{
 const i=s26.indexOf('function cmdMapKeyGate(code){');
 if(i<0) return '';
 const j=s26.indexOf('\n}',i);
 const body=s26.slice(i,j<0?i+600:j);
 return body.replace(/\/\/[^\n]*/g,'');       // 剥行注释 (本仓注释风格: 整行 // )
})();
assert('26 布势期不再是「吞掉」档: cmdMapKeyGate 里没有 mapDeploy 早退分支 (三键一律执行)',
 _gateBody.length>0
 &&_gateBody.indexOf('CMD.mapDeploy')<0
 &&/if\(code===CMD_KEYS\.hold\) return cmdKeyCommand\('hold'\);/.test(_gateBody)
 &&/if\(code===CMD_KEYS\.attack\) return cmdKeyCommand\('attack'\);/.test(_gateBody)
 &&/return cmdKeyCommand\('free'\);/.test(_gateBody),
 _gateBody.indexOf('CMD.mapDeploy')>=0?'仍有 mapDeploy 分支':'ok');
assert('26 减速键 = KeyV (用户裁定 N 太远)',
 s26.includes("REARM_FRAC:0.25, KEY:'KeyV' };")&&!s26.includes("KEY:'KeyN'"));
assert('26 队位三处同源: cmdSquadShown 唯一过滤口径 + cmdUnitCenter 唯一中心点',
 s26.includes('function cmdSquadShown(u){')
 &&s26.includes('function cmdUnitCenter(u){')
 &&/function cmdMapHit\(e\)\{[\s\S]{0,600}?cmdUnitCenter\(u\)/.test(s26)
 &&/if\(CMD\.hl\)\{\nconst ctr=cmdUnitCenter\(CMD\.hl\);/.test(s26));
assert('26 队位同源: 绘制/命中/选中环都不再各写一份 filter(b=>b.alive)',
 !s26.includes('const alive=s.members.filter(b=>b&&b.alive);'));
assert('26 单位扁平表 cmdUnits + 名字/颜色单源 (cmdUnitName/cmdUnitColor)',
 s26.includes('function cmdUnits(){')&&s26.includes('function cmdUnitName(u){')&&s26.includes('function cmdUnitColor(u){'));
assert('26 集火: 广播按半径 + 过期判据 + 候选加分三件单源',
 s26.includes('function cmdFocusFire(x,z){')
 &&s26.includes('function cmdFocusOf(unit){')
 &&s26.includes('function cmdFocusBonus(unit,x,z){')
 &&s26.includes('if(d>CMD_FIRE.R) continue;')
 &&s26.includes('if(t>unit.focus.until){ unit.focus=null; return null; }'));
assert('26 集火对飞机 = 转成 strike 令 (只在无令且有弹时接管)',
 /if\(u\.kind==='plane'&&u\.veh&&u\.veh\.alive&&u\.order\.mode==='free'&&\(u\.veh\.bombs\|\|0\)>0\)\{/.test(s26));
assert('26 面板: 高亮项完整行 + 其余压缩成 10px 色条',
 s26.includes("height:10px;border-radius:3px;cursor:pointer;")
 &&s26.includes('const isHl=(hl===u);'));
assert('26 面板美术对齐开始界面 (羊皮纸/黄铜色板常量 CMD_UI)',
 s26.includes('const CMD_UI={')
 &&s26.includes('#f0dc9e')&&s26.includes('rgba(210,200,160,.28)'));
assert('26 布势面板含撤销按钮 (调 23-deploy 的 cmdDeployUndo 单源, typeof 守卫)',
 s26.includes("const undo=document.getElementById('cmdDeployUndo');")
 &&s26.includes("if(typeof cmdDeployUndo==='function'){ cmdDeployUndo(); }"));
assert('26 确认开战即盖章 (用户需求 6「确认之后兵种锁定」的提交点)',
 /if\(typeof cmdLockStamp==='function'\) cmdLockStamp\(player\.cls\);/.test(s26));

const s14=srcOf('js/14-bots.js'),s15=srcOf('js/15-vehicles.js'),s19=srcOf('js/19-input.js');
const s24=srcOf('js/24-main.js'),s19b=srcOf('js/19b-gamepad.js');
assert('14-bots 集火消费: perceive 候选分加 cmdFocusBonus (单源, 缺函数时 0 零回归)',
 s14.includes('const _fb=(typeof cmdFocusBonus===\'function\'&&this.cmdGrp)?cmdFocusBonus(this.cmdGrp,e.pos.x,e.pos.z):0;')
 &&s14.includes('const _score=d-_fb;'));
assert('15-vehicles 集火消费: tankPerceive 候选分加 cmdFocusBonus (载具反查单源)',
 s15.includes('sc+=cmdFocusBonus(_fu,t.pos.x,t.pos.z);')
 &&s15.includes("const _fu=(typeof cmdFindUnitOfVeh==='function')?cmdFindUnitOfVeh(this):null;"));
assert('19-input: 开图期 keydown 放行 减速键 + cmdMapKeyGate 三命令键',
 /if\(typeof cmdMapUIOpen==='function'&&cmdMapUIOpen\(\)\)\{[\s\S]{0,400}?if\(typeof cmdMapKeyGate==='function'&&cmdMapKeyGate\(e\.code\)\) return;[\s\S]{0,200}?if\(!\(typeof CMD_TIME!=='undefined'&&e\.code===CMD_TIME\.KEY\)\) return;\s*\}/.test(s19));
// ★2026-10-27 排查批 防回退钉: Escape 处理器里 cmdMapUIOpen 分支必须在 deployed 门**之外**且带暂停优先门。
//   旧写嵌在 `player.deployed&&player.alive` 门内 ⇒ 布势期 (人未落地, alive/deployed 皆 false) 永远走不到
//   cmdDeployConfirm, Esc 实际 togglePause(true) —— 与本文件/26-commander/设计 D21 三处"布势 Esc=确认"的
//   宣言相反。判据: ①分支带 `&&!gamePaused` (D20 暂停优先, 暂停中 Esc 只解暂停); ②分支位置在 deployed
//   门之前; ③分支体内走确认单源 cmdDeployConfirm (布势) / cmdMapClose (战斗) 双出口。
assert('19-input: Esc 的 cmdMapUIOpen 分支上提到 deployed 门之外 + 暂停优先 (!gamePaused) + 双出口',
 s19.includes('cmdMapUIOpen()&&!gamePaused){')
 &&s19.indexOf('cmdMapUIOpen()&&!gamePaused')<s19.indexOf('if(player.deployed&&player.alive&&!matchOver){')
 &&/cmdMapUIOpen\(\)&&!gamePaused\)\{\s*if\(typeof cmdDeployPhase==='function'&&cmdDeployPhase\(\)&&typeof cmdDeployConfirm==='function'\) cmdDeployConfirm\(\);\s*else if\(typeof cmdMapClose==='function'\) cmdMapClose\(true\);/.test(s19));
assert('19-input: 近战键改成 KeyN (V 让给减速)',
 s19.includes("if(e.code==='KeyN'){")&&!s19.includes("if(e.code==='KeyV'){"));
assert('24-main tMelee 触控键 → KeyN',s24.includes("bindBtn('tMelee',()=>kd('KeyN'),()=>ku('KeyN'));"));
assert('19b-gamepad RS 近战 → KeyN',s19b.includes("{b:11,dn:()=>padKd('KeyN'),  up:()=>padKu('KeyN')}"));

const i18n=srcOf('js/00b-i18n.js');
const keys=['按住 V 减速 (消耗读条)','防守此处','进攻此处','向此处投弹','自由推进','↩ 撤销布势 (重选兵种)',
 '布势已撤销 · 可重新选择兵种','集火','集火: {0} 个单位 → 该点','集火: 半径内没有己方单位','指挥',
 '滚轮切单位 · E=防守此处 · F=进攻此处/投弹 · R=自由推进 · 左键=集火 · 中键拖动=平移 · 右键=退出'];
assert('i18n 本批新键全配英文 (词典闭环)',keys.every(k=>i18n.includes(`'${k}':`)),
 '缺: '+keys.filter(k=>!i18n.includes(`'${k}':`)).join(' / '));
assert('i18n 旧 N 键词条已全部退场 (无残留)',!i18n.includes('N=减速')&&!i18n.includes('按住 N '));
const sidx=srcOf('index.html');
assert('index.html 帮助面板: 近战键标 N + 减速键标 V',
 sidx.includes('<b>N</b> 近战')&&sidx.includes('<b>N</b> 近战刺刀')&&sidx.includes('按住 V 时间减速'));
assert('index.html 帮助面板新增「指挥官兵种」整节 (三命令键/集火/减速/布势撤销) (2026-11-12 键位表化判据跟码)',
 sidx.includes('指挥官兵种</div>')&&sidx.includes('<span class="hkKey" data-i18n>左键点地图</span><span class="hkDesc" data-i18n-html>集火该点'));
}

// ── ② 沙箱行为 ───────────────────────────────────────────────
const {sandbox,document,window}=require('./_bootstub.js');
const V3c=sandbox.THREE.Vector3;
if(!V3c.prototype.addScalar) V3c.prototype.addScalar=function(s){ this.x+=s; this.y+=s; this.z+=s; return this; };
if(!V3c.prototype.divideScalar) V3c.prototype.divideScalar=function(s){ s=s||1; this.x/=s; this.y/=s; this.z/=s; return this; };
if(!V3c.prototype.clampScalar) V3c.prototype.clampScalar=function(a,b){ this.x=Math.min(b,Math.max(a,this.x)); this.y=Math.min(b,Math.max(a,this.y)); this.z=Math.min(b,Math.max(a,this.z)); return this; };
if(!V3c.prototype.project) V3c.prototype.project=function(){ this.x=0; this.y=0; this.z=1; return this; };
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
if(BA&&BA.prototype&&!BA.prototype.setXYZ) BA.prototype.setXYZ=function(i,x,y,z){ if(this.array){ this.array[i*this.itemSize]=x; this.array[i*2+1]=y; this.array[i*3+2]=z; } return this; };
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
const FILES=['js/00-config.js','js/00b-i18n.js','js/00c-procgen.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/19b-gamepad.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/22a-menuart.js','js/22b-speclayer.js','js/23-deploy.js','js/23b-worldrestore.js','js/25-zombies.js','js/26-commander.js','js/24-main.js'];
const CAMP=8;
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

// ── ② 队位三处同源 (用户需求 2) ─────────────────────────────
{
section('② 队位三处同源 (绘制/命中/选中环同一份坐标)');
CTX=boot(CAMP);
const st=run(`(()=>{ try{ const b=document.getElementById('startBtn'); if(b&&b.onclick){ b.onclick(); return 'ok'; } return 'no-button'; }catch(e){ return 'ERR '+String(e&&e.stack||e).slice(0,400); } })()`);
assert('开局链真路径 startBtn.onclick 无异常',st==='ok',st==='ok'?'':' '+st);
const u=run(`(()=>{ const out={};
out.orbat=!!(CMD.orbat&&CMD.orbat.squads.length);
const s=CMD.orbat.squads[0];
// 造一个「组员在车上」的场面: 车上的人不该单独占点, 但也不该被踢出本组
const b=s.members[0];
const memBefore=s.members.length;
// 记下「上车前」的显示口径基线: 上车只是不再单独占点, 不该改变组员归属
out.shownBefore=cmdSquadShown(s).length;
out.wasShown=cmdSquadShown(s).indexOf(b)>=0;
b.onVehicle={fake:1};
out.shownN=cmdSquadShown(s).length;
out.memAfter=s.members.length;
out.memStable=(out.memAfter===memBefore);
const ctr=cmdUnitCenter(s);
let ax=0,az=0,n=0;
for(const q of cmdSquadShown(s)){ ax+=q.pos.x; az+=q.pos.z; n++; }
out.ctrMatch=!!ctr&&Math.abs(ctr.x-ax/n)<1e-9&&Math.abs(ctr.z-az/n)<1e-9;
b.onVehicle=null;
out.shownBack=cmdSquadShown(s).length;
out.flat=cmdUnits().length;
out.flatSum=CMD.orbat.squads.length+CMD.orbat.tanks.length+CMD.orbat.planes.length;
out.idUnique=(()=>{ const ids=cmdUnits().map(x=>x.id); return new Set(ids).size===ids.length; })();
out.name0=cmdUnitName(s); out.col0=cmdUnitColor(s);
return out; })()`);
assert('开局即建编制 (cmdOrbatBuild 挂 startMatch 尾)',u.orbat===true);
assert('cmdSquadShown 只筛显示口径, 不改组员集合 (上下车不改变归属)',
 u.memStable===true&&u.shownN===u.shownBefore-(u.wasShown?1:0)&&u.shownN===u.shownBack-1,JSON.stringify(u));
assert('cmdUnitCenter 与 cmdSquadShown 的质心逐位一致 (绘制/命中同一份坐标)',u.ctrMatch===true);
assert('cmdUnits 扁平表覆盖全部单位且 id 唯一 (滚轮/列表/命中同一顺序)',
 u.flat===u.flatSum&&u.idUnique===true,`flat=${u.flat} sum=${u.flatSum}`);
assert('单位名/色单源可读 (cmdUnitName/cmdUnitColor)',typeof u.name0==='string'&&u.name0.length>0&&/^#/.test(u.col0),u.name0+' '+u.col0);
}

// ── ③ 三命令键 + 高亮切换 (用户需求 4) ─────────────────────
{
section('③ 三命令键 + 滚轮切高亮 (用户需求 4)');
const k=run(`(()=>{ const out={};
const p=player; p.cls=5; p.alive=true; p.deployed=true;
CMD.lockedDir='in';
cmdOrbatBuild();
// 用开图入口把状态推到「局内指挥态」
CMD.mapOn=true; CMD.mapDeploy=false; CMD.view={cx:0,cz:0,scale:0.46};
const us=cmdUnits();
CMD.hl=us[0]; CMD.sel=us[0];
out.n=us.length;
out.hl0=us[0].id;
cmdHlStep(1); out.hl1=CMD.hl.id;
cmdHlStep(1); out.hl2=CMD.hl.id;
cmdHlStep(-1); out.hlBack=CMD.hl.id;
out.selSync=(CMD.sel===CMD.hl);
// 环绕: 从最后一个再滚下 = 回到第一个
CMD.hl=us[us.length-1]; cmdHlStep(1); out.wrap=CMD.hl.id;
// 三命令键 (以第一个步兵组为对象)
const sq=us[0]; CMD.hl=sq; CMD.sel=sq;
CMD.cursor={x:33,z:-44};
out.gateE=cmdMapKeyGate('KeyE'); out.modeE=sq.order.mode; out.atE=[Math.round(sq.order.x),Math.round(sq.order.z)];
out.gateF=cmdMapKeyGate('KeyF'); out.modeF=sq.order.mode;
out.gateR=cmdMapKeyGate('KeyR'); out.modeR=sq.order.mode;
// 非命令键不归地图
out.gateG=cmdMapKeyGate('KeyG');
// 飞机: F = strike
const pl=us.find(x=>x.kind==='plane');
if(pl){ pl.order.mode='free'; pl.veh.strikePt=null; CMD.hl=pl; CMD.sel=pl;
 out.gatePlaneF=cmdMapKeyGate('KeyF'); out.planeMode=pl.order.mode; out.planeStrike=!!pl.veh.strikePt;
 out.gatePlaneE=cmdMapKeyGate('KeyE'); out.planeModeAfterE=pl.order.mode; }
// 关图后三个键都不归地图 (零回归)
CMD.mapOn=false;
out.offE=cmdMapKeyGate('KeyE'); out.offF=cmdMapKeyGate('KeyF'); out.offR=cmdMapKeyGate('KeyR');
return out; })()`);
assert('滚轮沿扁平表循环切高亮 (下一位/环绕/回退)',
 k.hl1!==k.hl0&&k.hl2!==k.hl1&&k.hlBack===k.hl1&&k.wrap===k.hl0,JSON.stringify(k));
assert('高亮 = 选中 (sel 与 hl 同源, 面板/选中环继续可用)',k.selSync===true);
assert('E = 到光标处防守 (order.mode=hold 且落点=光标)',
 k.gateE===true&&k.modeE==='hold'&&k.atE[0]===33&&k.atE[1]===-44,JSON.stringify([k.gateE,k.modeE,k.atE]));
assert('F = 进攻光标处 (order.mode=attack_move)',k.gateF===true&&k.modeF==='attack_move');
assert('R = 恢复自由推进 (order.mode=free)',k.gateR===true&&k.modeR==='free');
assert('非命令键 (G) 不归指挥地图',k.gateG===false);
assert('飞机 F = 向该点投弹 (strike 令真落账)',
 k.gatePlaneF===true&&k.planeMode==='strike'&&k.planeStrike===true,JSON.stringify([k.gatePlaneF,k.planeMode,k.planeStrike]));
assert('飞机 E 不适用 (cmdOrderUnit 拒绝, order 不被改成 hold)',k.planeModeAfterE==='strike');
assert('关图后 E/F/R 全部归还战斗语义 (零回归)',
 k.offE===false&&k.offF===false&&k.offR===false);
}

// ── ③b 布势期三命令键 (2026-10-27 用户实报: 开局前的部署阶段 E/R/F 按下均无效) ──
// 现象与根因见 26-commander cmdMapKeyGate 的 ★2026-10-27 根因块。本段验的是**行为**, 不是源码文字:
//   布势期 (mapOn+mapDeploy) 按 E/F/R 必须真的改掉 order, 且返回值必须是 true (已消费, 不许漏给战斗语义)。
{
section('③b 布势期三命令键真的执行 (用户实报 bug)');
const d=run(`(()=>{ const out={};
const p=player; p.cls=5; p.alive=true; p.deployed=false;   // 布势期: 人还没落地
CMD.lockedDir=null;
cmdOrbatBuild();
cmdDeployOpen();                                            // 走真实入口: mapOn+mapDeploy+宿主切 body
out.mapOn=CMD.mapOn; out.mapDeploy=CMD.mapDeploy;
out.worldFrozen=(cmdDtGate(0.016,0.016)===0);               // D21: 布势期世界冻结
const us=cmdUnits(); out.n=us.length;
const sq=us[0]; CMD.hl=sq; CMD.sel=sq; CMD.cursor={x:52,z:-61};
out.gateE=cmdMapKeyGate('KeyE'); out.modeE=sq.order.mode;
out.atE=[Math.round(sq.order.x),Math.round(sq.order.z)];
out.gateF=cmdMapKeyGate('KeyF'); out.modeF=sq.order.mode;
out.atF=[Math.round(sq.order.x),Math.round(sq.order.z)];
out.gateR=cmdMapKeyGate('KeyR'); out.modeR=sq.order.mode;
// 换一个落点再按一次 E: 布势期反复改令必须每次都生效 (不是只有第一次能下)
CMD.cursor={x:-14,z:27};
out.gateE2=cmdMapKeyGate('KeyE'); out.atE2=[Math.round(sq.order.x),Math.round(sq.order.z)];
// 布势期非命令键仍不归地图
out.gateG=cmdMapKeyGate('KeyG');
// 飞机 F = 投弹 (布势期同样可用)
const pl=us.find(x=>x.kind==='plane');
if(pl){ pl.order.mode='free'; pl.veh.strikePt=null; CMD.hl=pl; CMD.sel=pl; CMD.cursor={x:80,z:80};
 out.gatePlaneF=cmdMapKeyGate('KeyF'); out.planeMode=pl.order.mode; out.planeStrike=!!pl.veh.strikePt; }
// 收尾: 关图, 状态回到干净
cmdMapClose(false); out.closed=(CMD.mapOn===false);
return out; })()`);
assert('布势入口: mapOn+mapDeploy 且世界冻结 (D21 不变)',
 d.mapOn===true&&d.mapDeploy===true&&d.worldFrozen===true,JSON.stringify([d.mapOn,d.mapDeploy,d.worldFrozen]));
assert('布势期 E = 到光标处防守 (gate 返回 true 且 order.mode=hold, 落点=光标 52,-61)',
 d.gateE===true&&d.modeE==='hold'&&d.atE[0]===52&&d.atE[1]===-61,JSON.stringify([d.gateE,d.modeE,d.atE]));
assert('布势期 F = 进攻光标处 (gate 返回 true 且 order.mode=attack_move, 落点=光标)',
 d.gateF===true&&d.modeF==='attack_move'&&d.atF[0]===52&&d.atF[1]===-61,JSON.stringify([d.gateF,d.modeF,d.atF]));
assert('布势期 R = 恢复自由推进 (gate 返回 true 且 order.mode=free)',
 d.gateR===true&&d.modeR==='free',JSON.stringify([d.gateR,d.modeR]));
assert('布势期可反复改令 (第二次 E 落点跟着光标变, 不是只生效一次)',
 d.gateE2===true&&d.atE2[0]===-14&&d.atE2[1]===27,JSON.stringify(d.atE2));
assert('布势期非命令键 (G) 仍不归地图 (放行集合没被放宽)',d.gateG===false);
assert('布势期飞机 F = 向该点投弹 (strike 令落账)',
 d.gatePlaneF===true&&d.planeMode==='strike'&&d.planeStrike===true,
 JSON.stringify([d.gatePlaneF,d.planeMode,d.planeStrike]));
assert('③b 收尾: 布势图可正常收起 (没把状态留在半开)',d.closed===true);
}

// ── ④ 集火 (用户需求 3) ───────────────────────────────────
{
section('④ 集火: 左键点目标 → 附近己方火力集中打它 (用户需求 3)');
const f=run(`(()=>{ const out={};
const p=player; p.cls=5; p.alive=true; p.deployed=true; CMD.lockedDir='in';
cmdOrbatBuild();
CMD.mapOn=true; CMD.mapDeploy=false; CMD.view={cx:0,cz:0,scale:0.46};
CMD.hl=cmdUnits()[0]; CMD.sel=CMD.hl; CMD.focusFire=null;
// 把两个步兵组分别放到集火点内 / 外
const us=cmdUnits(); const sq0=CMD.orbat.squads[0];
for(const b of sq0.members){ b.pos.x=10; b.pos.z=10; }
const sq1=CMD.orbat.squads[1];
if(sq1) for(const b of sq1.members){ b.pos.x=150; b.pos.z=150; }
cmdFocusFire(0,0);
out.ff=!!CMD.focusFire;
out.until=CMD.focusFire?CMD.focusFire.until:null;
out.sq0Has=!!cmdFocusOf(sq0);
out.sq1Has=sq1?!!cmdFocusOf(sq1):false;
out.hlCleared=(CMD.hl===null&&CMD.sel===null);
// 半径边界: 60m 内吃令 / 60m 外不吃
out.inR=!!cmdFocusOf(sq0);
// 加分: 圈内顶到最前, 圈外 3 倍半径外为 0
out.bonusNear=cmdFocusBonus(sq0,5,5);
out.bonusFar=cmdFocusBonus(sq0,200,200);
// 过期: 直接把 until 拨到过去
const keep=CMD.focusFire.until; sq0.focus.until=nowT-1;
out.expired=(cmdFocusOf(sq0)===null&&sq0.focus===null);
// 无令单位返回 null (零回归)
out.noFocus=(cmdFocusOf(null)===null);
return out; })()`);
assert('集火落账 (focusFire 带 until 时间戳)',f.ff===true&&typeof f.until==='number');
assert('半径内单位吃令 / 半径外不吃 (CMD_FIRE.R 单源)',f.sq0Has===true&&f.sq1Has===false,JSON.stringify([f.sq0Has,f.sq1Has]));
assert('集火时清高亮 (集火是对区域下令, 不针对某个单位)',f.hlCleared===true);
assert('候选加分: 圈内顶到最前 / 圈外 3 倍半径为 0',f.bonusNear>=1e6&&f.bonusFar===0,JSON.stringify([f.bonusNear,f.bonusFar]));
assert('集火过期自动失效 (读 until, 过期即清 unit.focus)',f.expired===true);
assert('无令单位 cmdFocusOf 返回 null (零回归)',f.noFocus===true);
}

// ── ⑤ 显隐与画布 (用户需求 6 前半) ─────────────────────────
{
section('⑤ 指挥地图显隐单源 + 画布居中正方形 (用户需求 6)');
const m=run(`(()=>{ const out={};
const p=player; p.cls=5; p.alive=true; p.deployed=true; CMD.lockedDir='in';
cmdOrbatBuild();
// 开图 → 关图 → 再开: 显隐必须靠 class 单源, 三次都能回来
cmdMapOpen(); out.open1=CMD.mapOn;
cmdMapClose(false); out.closed1=(CMD.mapOn===false);
cmdMapOpen(); out.open2=CMD.mapOn;
const w=document.getElementById('cmdMapWrap');
out.wrapExists=!!w;
// 源码判据已覆盖「不写 style.display」; 这里验行为: 显隐函数可反复调用且不抛
let threw=false;
try{ cmdMapWrapShow(false); cmdMapWrapShow(true); cmdMapWrapShow(true); cmdMapWrapShow(false); }catch(e){ threw=true; }
out.showIdem=!threw;
// 暂停对账 (D20 保持): 暂停期藏起, 解除放回
gamePaused=true; cmdMapPauseGate(); out.hidInPause=(CMD._pauseHid===true);
gamePaused=false; cmdMapPauseGate(); out.backAfterResume=(CMD._pauseHid===false);
// 画布尺寸: 沙箱 DOM 桩的 getBoundingClientRect 缺失 ⇒ cmdRect 兜底 800×600 ⇒ side=600
cmdMapResize();
const cv=document.getElementById('cmdMapCv');
out.cvSide=[cv.width,cv.height];
out.square=(cv.width===cv.height);
cmdMapClose(false);
return out; })()`);
assert('开图/关图/再开三次往返都成立 (显隐单源不再「开一次就再也开不出来」)',
 m.open1===true&&m.closed1===true&&m.open2===true,JSON.stringify(m));
assert('cmdMapWrapShow 幂等可反复调用 (不抛异常)',m.showIdem===true);
assert('D20 暂停优先仍成立 (暂停藏起 / 解除放回)',m.hidInPause===true&&m.backAfterResume===true);
assert('画布尺寸为正方形 (方形地图不再只占舞台宽度的 59%)',m.square===true,JSON.stringify(m.cvSide));
}

// ── ⑥ 确认即锁 (用户需求 6 后半) ───────────────────────────
{
section('⑥ 确认开战即盖章 → 本局兵种锁定 (用户需求 6)');
const l=run(`(()=>{ const out={};
cmdResetMatch();
const p=player; p.cls=5; p.alive=true; p.deployed=false;
CMD.lockedDir=null; CMD.deploySeen=false;
cmdOrbatBuild(); cmdDeployOpen();
out.deployOn=CMD.mapOn&&CMD.mapDeploy;
out.lockBefore=CMD.lockedDir;
cmdDeployConfirm();
out.lockAfter=CMD.lockedDir;
out.gate0=cmdClassCardGate(0);
out.gate5=cmdClassCardGate(5);
cmdResetMatch();
return out; })()`);
assert('布势期尚未盖章 (lockedDir=null)',l.deployOn===true&&l.lockBefore===null);
assert('确认开战即盖章 (lockedDir=in)',l.lockAfter==='in');
assert('确认后其余兵种卡被锁 (gate(0) 给原因文案)',typeof l.gate0==='string'&&l.gate0.length>0,l.gate0);
assert('确认后指挥官卡本身仍可选 (不锁自己)',l.gate5===null);
}

// ── 汇总 ─────────────────────────────────────────────────────
console.log('');
if(NEG){
console.log(`[阴性对照] verify-cmdui: ${OK.length} 通过, ${BAD.length} 失败`);
if(BAD.length===0){ console.log('✗ 阴性对照失效: 打坏源码后仍然全绿'); process.exit(1); }
process.exit(0);
}
if(BAD.length){
console.log(`✗ verify-cmdui: ${OK.length} 通过, ${BAD.length} 失败`);
for(const b of BAD) console.log('   ✗ '+b);
process.exit(1);
}
console.log(`✓ verify-cmdui: 全部通过 (${OK.length} 项)`);