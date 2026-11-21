// ─────────────────────────────────────────────────────────────
// dev/verify-cmdbatch2-20261027.js —— 2026-10-26 指挥官反馈批 (7 项用户需求) 验收
//
// 用法: node dev/verify-cmdbatch2-20261027.js [--neg]
//   --neg = 阴性对照: 装载前把本批核心改动按文本还原成旧写法, 同一批判据必须报红。
//
// 对应用户 7 项反馈:
//   ① 指挥读条非常驻 (满格且未减速时隐藏) + 上移 bottom:186px 避开 #capPanel 占领文字
//   ② 布势期取消右键退出 (画布右键在 mapDeploy 下无操作; 出口只剩确认按钮/Esc/触屏按钮)
//   ③ 编制就近聚组 (贪心最近邻替换数组序切片) + 重生向组内存活成员质心集中 (cmdSquadSpawnNear)
//   ④ 指挥官局解散玩家私人小队 (cmdDisbandPlayerSquad/cmdOrbatAdopt/cmdSquadRestore,
//      盖章/进布势两条路径收编, cmdDeployUndo 还编)
//   ⑤ 指挥官兵种卡金铜描边 + 新模式说明行 (.classCard.cmdCard / .cmdMode + i18n 闭环)
//   ⑥ 指挥地图「缺右边一块」= 视图探出世界边界 (cmdViewClamp 钳制);
//      「变明变暗」= globalAlpha 经 continue 泄漏 + wrap .92 透出战场 (画笔恒 1 + 不透明底)
//   ⑦ 选中唯一高亮, 其余厚灰 ('#8f948b' 本体 + rgba 垫层, 弃用 globalAlpha 压暗)
//
// 口径: 与 verify-commander-20261026 / verify-cmdui-20261027 同款 boot (_bootstub 桩 + 全链 FILES
//   + startBtn.onclick 真开局), 调游戏自己的接口, 不重写第二套状态机。
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
 // A 读条常驻退场: 删掉按需显隐门 ⇒ 非常驻判据红
 ['js/26-commander.js',
  "const costly=cmdSlowCostly();\nif(!(drain||CMD.slowOn||(costly&&CMD.focus<CMD_TIME.FOCUS_MAX-0.01))){\nif(wrap) wrap.style.display='none';\nreturn;\n}",
  ";"],
 // B 布势右键退场: 恢复旧写 (布势右键=确认开战) ⇒ 右键无操作判据红
 ['js/26-commander.js',
  "if(CMD.mapDeploy) return;\ncmdMapToggle();\nreturn;",
  "cmdMapToggle();\nreturn;"],
 // C 就近聚组退场: 聚合循环永不执行 ⇒ 组员不被分尽, 聚组判据红
 ['js/26-commander.js',
  "while(members.length<want&&un.length){",
  "for(let _neg=0;_neg<0;_neg++){"],
 // D 集中生成退场: 14-bots 不再采用集中落点 ⇒ cmdSquadSpawnNear 判据红
 ['js/14-bots.js',
  "if(np) lp={x:np.x,z:np.z,laneDx:lp.laneDx,laneDz:lp.laneDz};",
  ";"],
 // E 盖章收编退场: cmdLockStamp 不再解散/收编/还原 ⇒ 私人小队互斥判据红
 ['js/26-commander.js',
  "if(CMD.lockedDir==='in'){ cmdOrbatAdopt(cmdDisbandPlayerSquad()); }\nelse if(CMD.lockedDir==='out'){ cmdSquadRestore(); }",
  ";"],
 // F 撤销还编退场: cmdDeployUndo 不再调 cmdSquadRestore ⇒ 还编判据红
 ['js/23-deploy.js',
  "if(typeof cmdSquadRestore==='function'){ try{ cmdSquadRestore(); }catch(e){} }",
  ";"],
 // G 视图钳制退场: 钳制体清空 ⇒ 世界边界判据红
 ['js/26-commander.js',
  "CMD.view.cx=Math.max(-lim,Math.min(lim,CMD.view.cx));\nCMD.view.cz=Math.max(-lim,Math.min(lim,CMD.view.cz));",
  ";"],
 // H alpha 卫生退场: 删掉画笔恒 1 的跨帧自愈 ⇒ 卫生判据红
 ['js/26-commander.js',
  "c.globalAlpha=1;   // ★跨帧画笔状态自愈 (2026-10-26 反馈批): 上一帧任何残留 alpha 都不许污染本帧底图/蒙版/旗点",
  ";"],
 // I 厚灰退场: 未选中回到队色 ⇒ 厚灰判据红
 ['js/26-commander.js',
  "const col=hl?cmdUnitColor(u):'#8f948b';",
  "const col=cmdUnitColor(u);"],
 // J 兵种卡标识退场: 卡片不再带 cmdCard 类 (语法等价空替, 不炸 boot) ⇒ 模式标识判据红
 ['js/22-hud.js',
  "(i===5?' cmdCard':'')",
  "(i===5?'':'')"],
 // K 换局 _disbanded 残留: 换局不清解散账 ⇒ 复位判据红
 ['js/26-commander.js',
  "CMD._disbanded=null;   // 私人小队解散账 (反馈批用户需求 4): 换局作废 —— SQUAD.members 由换局链自己清",
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
const s26=srcOf('js/26-commander.js');
assert('①1 读条按需显隐门在 (满格且未减速时隐藏; 免费档按 slowOn 判)',
 s26.includes('if(!(drain||CMD.slowOn||(costly&&CMD.focus<CMD_TIME.FOCUS_MAX-0.01))){')
 &&s26.includes('const costly=cmdSlowCostly();'));
const s26nc=s26.replace(/\/\/[^\n]*/g,'');   // 剥行注释: 根因说明会逐字引用旧写法, 不剥会自伤 (verify-cmdui 同教训)
assert('①2 读条上移出 #capPanel 顶缘 (bottom:186px), 旧 15.5% 退场',
 s26nc.includes('bottom:186px')&&!s26nc.includes('bottom:15.5%'));
assert('①3 布势期画布右键无操作 (mapDeploy 早退在 cmdMapToggle 之前), 战斗期右键退出保留',
 /\}else if\(e\.button===2\)\{[\s\S]{0,300}?if\(CMD\.mapDeploy\) return;[\s\S]{0,120}?cmdMapToggle\(\);/.test(s26)
 &&s26.includes('if(CMD.mapOn&&CMD.mapDeploy){ cmdDeployConfirm(); return; }'));
assert('①4 编制就近聚组 (贪心最近邻), 旧下标切片退场',
 s26nc.includes('while(members.length<want&&un.length){')
 &&!s26nc.includes('foot.filter((_,i)=>i%g===gi)'));
assert('①5 集中生成单源 cmdSquadSpawnNear (存活成员质心锚 + 落点闸), 14-bots spawn 接线',
 s26.includes('function cmdSquadSpawnNear(bot){')
 &&s26.includes('if(typeof occBlocked===\'function\'&&occBlocked(wx,wz)) continue;')
 &&/if\(this\.cmdGrp&&this\.cmdGrp\.kind==='inf'&&typeof cmdSquadSpawnNear===/.test(SRC('js/14-bots.js'))
 &&SRC('js/14-bots.js').includes('let lp=pickSpawnPoint(this.team,sp);'));
assert('①6 私人小队互斥三件单源 + 盖章/进布势/撤销三路接线',
 s26.includes('function cmdDisbandPlayerSquad(){')
 &&s26.includes('function cmdOrbatAdopt(bots){')
 &&s26.includes('function cmdSquadRestore(){')
 &&s26.includes('cmdOrbatAdopt(cmdDisbandPlayerSquad());')
 &&SRC('js/23-deploy.js').includes('cmdSquadRestore();'));
assert('①7 画笔 alpha 卫生: 绘制起步恒 1 + 循环出口复位 + 单位循环不再用 globalAlpha 压暗',
 s26.includes('c.globalAlpha=1;   // ★跨帧画笔状态自愈')
 &&s26.includes('c.globalAlpha=1;   // ★循环出口复位')
 &&!s26.includes('c.globalAlpha=dim;'));
assert('①8 视图世界边界钳制 (cmdViewClamp) + cmdMapDraw 单点收口调用',
 s26.includes('function cmdViewClamp(S,k){')
 &&/const k=cmdMapPxPerM\(\);\s*\n\s*cmdViewClamp\(S,k\);/.test(s26.replace(/\r/g,'')));
assert('①9 wrap 底不透明 (变明变暗的透出路径), 四周窄缝设计不受影响',
 s26.replace(/\/\/[^\n]*/g,'').includes('background:rgb(10,14,8)')
 &&!s26.replace(/\/\/[^\n]*/g,'').includes('rgba(10,14,8,.92)'));   // 剥注释: 根因说明里逐字引用了旧写法
assert('①10 未选中单位厚灰 (#8f948b 本体 + 垫层), 队色只留给选中',
 s26.includes("const col=hl?cmdUnitColor(u):'#8f948b';")
 &&s26.includes('rgba(140,146,138,.38)'));
assert('①11 换局清解散账', s26.includes('CMD._disbanded=null;'));
const s22=srcOf('js/22-hud.js');
assert('①12 兵种卡: 指挥官卡带 cmdCard 类 + 新模式说明行',
 s22.includes("(i===5?' cmdCard':'')")&&s22.includes('class="cmdMode"'));
const scss=srcOf('css/style.css');
assert('①13 CSS: .classCard.cmdCard 金铜描边 + .cmdMode 说明行样式',
 scss.includes('.classCard.cmdCard { border:2px solid #d8b25a;')&&scss.includes('.classCard.cmdCard .cmdMode'));
const i18n=srcOf('js/00b-i18n.js');
assert('①14 i18n 新键配英文 (词典闭环)',
 i18n.includes("'新模式 · 指挥官: 右键开指挥地图统一步/坦/空 · E/F/R 下令 · 左键集火 · V 减速':"));
const sidx=SRC('index.html');
assert('①15 版本戳已升 20261122a (48 处 ?v= + __sfStyleVer) (2026-11-10 海战移除批判据跟码)',
 (sidx.match(/20261122a/g)||[]).length>=48&&sidx.includes("__sfStyleVer='20261122a'"));
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
if(BA&&BA.prototype&&!BA.prototype.setXYZ) BA.prototype.setXYZ=function(i,x,y,z){ if(this.array){ this.array[i*this.itemSize]=x; this.array[i*3+2]=z; } return this; };
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
const CAMP=8;   // 草原 (verify-commander-20261026 同款): 标准征服陆图, 指挥官开放
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

// ── ③ 开局链 + 编制就近聚组 (用户需求 3 前半) ────────────────
{
section('③ 开局真路径 + 编制就近聚组');
CTX=boot(CAMP);
const st=run(`(()=>{ try{ const b=document.getElementById('startBtn'); if(b&&b.onclick){ b.onclick(); return 'ok'; } return 'no-button'; }catch(e){ return 'ERR '+String(e&&e.stack||e).slice(0,400); } })()`);
assert('开局链真路径 startBtn.onclick 无异常',st==='ok',st==='ok'?'':' '+st);
const g=run(`(()=>{ const out={};
out.orbat=!!(CMD.orbat&&CMD.orbat.squads.length);
// 就近聚组对照实验: 两个相距 ~85m 的紧凑簇 (A: (20,20) 附近 / B: (-60,-60) 附近), 8 人 → 2 组 4/4。
// 旧下标切片会把两簇的人匀进两组; 新聚组必须整簇整簇地分。
const real=soldiers.slice();
const mk=(x,z)=>({team:player.team,alive:true,onVehicle:null,pilotOf:null,inSquad:null,capCrew:null,zombie:false,pos:{x,z},cmdGrp:null});
const fakes=[];
for(let i=0;i<4;i++) fakes.push(mk(20+i*1.5,20+(i%2)*1.5));
for(let i=0;i<4;i++) fakes.push(mk(-60-i*1.5,-60+(i%2)*1.5));
soldiers.length=0; for(const f of fakes) soldiers.push(f);
CMD.orbat=null;
const ob=cmdOrbatBuild();
out.nGroups=ob.squads.length;
out.sizes=ob.squads.map(s=>s.members.length);
out.allAssigned=ob.squads.every(s=>s.members.every(b=>b.cmdGrp===s));
// 簇纯度: 每组内最大两两距离 < 10m (簇半径 ~2m), 且不同组的人不同簇 (组心距 > 70m)
out.pure=ob.squads.every(s=>{
let mx=0;
for(let i=0;i<s.members.length;i++)for(let j=i+1;j<s.members.length;j++){
const a=s.members[i].pos,b=s.members[j].pos;
mx=Math.max(mx,Math.hypot(a.x-b.x,a.z-b.z));
}
return mx<10;
});
if(ob.squads.length>=2){
const c0=cmdUnitCenter(ob.squads[0]),c1=cmdUnitCenter(ob.squads[1]);
out.groupSep=c0&&c1?Math.hypot(c0.x-c1.x,c0.z-c1.z):0;
}
// 还原真实兵册并重建编制 (给后续小节一个干净状态)
soldiers.length=0; for(const r of real) soldiers.push(r);
CMD.orbat=null; cmdOrbatBuild();
out.realSquads=CMD.orbat?CMD.orbat.squads.length:0;
return out; })()`);
assert('开局即建编制',g.orbat===true);
assert('就近聚组: 双簇场景 8 人 → 2 组且整簇整簇地分 (组内两两 <10m, 组间距 >70m)',
 g.nGroups===2&&g.pure===true&&g.allAssigned===true&&(g.groupSep||0)>70,JSON.stringify(g));
assert('真实兵册重建编制正常 (换簇实验不污染后续)',(g.realSquads||0)>=1);
}

// ── ④ 集中生成单源 (用户需求 3 后半) ─────────────────────────
{
section('④ 重生集中生成 (cmdSquadSpawnNear)');
const sp=run(`(()=>{ const out={};
CMD.orbat=CMD.orbat||cmdOrbatBuild();
const bot={team:player.team,alive:true,onVehicle:null,pilotOf:null,inSquad:null,capCrew:null,zombie:false,pos:{x:0,z:0},cmdGrp:null};
const mate={team:player.team,alive:true,onVehicle:null,pilotOf:null,inSquad:null,capCrew:null,zombie:false,pos:{x:100,z:100},cmdGrp:null};
const u={kind:'inf',id:0,members:[bot,mate],order:{mode:'free',x:0,z:0},ratio:null};
bot.cmdGrp=u; mate.cmdGrp=u;
CMD.orbat.squads.push(u);
// ①组内有活人 → 落点向质心 (mate 位置) 集中: 6~9m 环 + NAV.spawnSpot ≤12m 平移, 允差 25m
const p1=cmdSquadSpawnNear(bot);
out.near=!!p1&&Math.hypot(p1.x-100,p1.z-100)<25;
// ②全组死光 (除自己) → null = 维持常规落点
mate.alive=false;
out.deadGroup=(cmdSquadSpawnNear(bot)===null);
// ③无编制 → null (零回归门)
bot.cmdGrp=null;
out.noGrp=(cmdSquadSpawnNear(bot)===null);
// 清理实验单位
CMD.orbat.squads.pop();
return out; })()`);
assert('组内有活人 → 落点集中到成员质心附近 (25m 允差)',sp.near===true,JSON.stringify(sp));
assert('全组死光 → null (回常规落点, 不空投进死人堆)',sp.deadGroup===true);
assert('无编制 → null (非指挥官链路零回归)',sp.noGrp===true);
}

// ── ⑤ 私人小队互斥: 盖章收编 / 撤销还编 (用户需求 4) ─────────
{
section('⑤ 私人小队互斥 (disband → adopt → restore)');
const q=run(`(()=>{ const out={};
CMD.orbat=CMD.orbat||cmdOrbatBuild();
const mk=()=>({team:player.team,alive:true,onVehicle:null,pilotOf:null,inSquad:true,capCrew:null,zombie:false,pos:{x:player.pos.x+5,z:player.pos.z+5},cmdGrp:null,mesh:{tag:{material:{color:{set(){}}}}}});
const fakes=[mk(),mk(),mk()];
const orig=SQUAD.members.slice();
SQUAD.members.length=0; for(const f of fakes) SQUAD.members.push(f);
const infCount=()=>CMD.orbat.squads.reduce((a,s)=>a+s.members.length,0);
const before=infCount();
// ①进布势 = 解散收编 (cmdDeployOpen 内的接线)
CMD.lockedDir=null; CMD.deploySeen=false;
cmdDeployOpen();
out.disbanded=SQUAD.members.length===0;
out.adopted=infCount()===before+3;
out.grped=fakes.every(f=>f.cmdGrp&&f.inSquad===false);
out.disbandedLedger=CMD._disbanded&&CMD._disbanded.length===3;
out.deploySeen=CMD.mapOn===true&&CMD.mapDeploy===true;
// ②撤销布势 = 原样还编 (23-deploy cmdDeployUndo 的接线)
cmdDeployUndo();
out.restored=SQUAD.members.length===3&&fakes.every(f=>f.inSquad===true&&f.cmdGrp===null);
out.orbatBack=infCount()===before;
out.lockNull=CMD.lockedDir===null;
// ③盖章 'out' 路径的还原是幂等的 (SQUAD 已有人 → 零操作)
cmdLockStamp(0);
out.outStamp=CMD.lockedDir==='out'&&SQUAD.members.length===3;
// ④盖章 'in' 路径: 解散 + 收编 (幂等二连)
CMD.lockedDir=null;
cmdLockStamp(5);
out.inStamp=CMD.lockedDir==='in'&&SQUAD.members.length===0&&infCount()===before+3;
cmdLockStamp(5);
out.stampIdempotent=infCount()===before+3;
// ⑤再走一次还原链 (撤销后改选其他兵种的完整路径)
cmdSquadRestore();
out.restore2=SQUAD.members.length===3&&infCount()===before;
cmdSquadRestore();
out.restoreIdempotent=SQUAD.members.length===3;
// 还原现场: 真实小队回去, 实验单位出编
SQUAD.members.length=0; for(const r of orig) SQUAD.members.push(r);
CMD._disbanded=null;
CMD.orbat=null; cmdOrbatBuild();
return out; })()`);
assert('进布势 = 解散私人小队 + 收编进编制 (cmdDeployOpen 接线)',
 q.disbanded===true&&q.adopted===true&&q.grped===true&&q.disbandedLedger===true&&q.deploySeen===true,JSON.stringify(q));
assert('撤销布势 = 原样还编 (cmdDeployUndo 接线, 空组就地摘除)',
 q.restored===true&&q.orbatBack===true&&q.lockNull===true);
assert("盖章 'out' → 还原幂等 (SQUAD 已有人 = 零操作)",q.outStamp===true);
assert("盖章 'in' → 解散 + 收编, 重复盖章幂等",q.inStamp===true&&q.stampIdempotent===true);
assert('还原链可重复 + 幂等',q.restore2===true&&q.restoreIdempotent===true);
}

// ── ⑥ 指挥读条按需显隐 (用户需求 1) ──────────────────────────
{
section('⑥ 指挥读条 HUD (非常驻 + 不压占领条)');
const h=run(`(()=>{ const out={};
const p=player; p.cls=5; p.alive=true; p.deployed=true;
CMD.lockedDir='in';
const wrapEl=()=>document.getElementById('cmdFocusWrap');
// 满格 + 未减速 → 隐藏 (常驻病根)
CMD.focus=CMD_TIME.FOCUS_MAX;
cmdFocusHudTick(false);
const w0=wrapEl();
out.hiddenAtFull=!w0||w0.style.display==='none';
// 恢复中 (focus 未满) → 显示
CMD.focus=3;
cmdFocusHudTick(false);
const w1=wrapEl();
out.shownRecharge=!!w1&&w1.style.display==='block';
// 减速中 (drain) → 显示 + 黄条
cmdFocusHudTick(true);
out.shownDrain=!!w1&&w1.style.display==='block';
// 免费档: focus 满也应在减速进行中显示 (无收支档的可见性)。stub 桩的 getElementById 会自动造元素
// (与 cmdMapInit 同款坑), cssText 分支被短路, 位置断言由源码钉 ①2 承担; 这里只断 display 账。
CMD_SETTINGS.focusCost=false; CMD.focus=CMD_TIME.FOCUS_MAX; CMD.slowOn=false;
cmdFocusHudTick(false);
out.hiddenFreeIdle=(!w1&&true)||w1.style.display==='none';
CMD.slowOn=true;
cmdFocusHudTick(false);
out.shownFreeSlow=w1.style.display==='block';
CMD.slowOn=false; CMD_SETTINGS.focusCost=true;
// 非指挥官 → 隐藏
p.cls=0; cmdFocusHudTick(false);
out.hiddenNonCmd=w1.style.display==='none';
p.cls=5;
return out; })()`);
assert('满格且未减速 → 隐藏 (非常驻)',h.hiddenAtFull===true,JSON.stringify(h));
assert('恢复中 / 减速中 → 显示',h.shownRecharge===true&&h.shownDrain===true);
assert('免费档: 非减速满格隐藏 / 减速进行中显示 (无收支档的可见性账)',h.hiddenFreeIdle===true&&h.shownFreeSlow===true);
assert('非指挥官 → 隐藏 (零回归)',h.hiddenNonCmd===true);
}

// ── ⑦ 视图世界边界钳制 (用户需求 6 缺块) ─────────────────────
{
section('⑦ cmdViewClamp 世界边界钳制');
const c=run(`(()=>{ const out={};
const MH=(typeof MAP_SIZE!=='undefined'?MAP_SIZE:320)/2+30;
out.MH=MH;
// 战斗档 scale=1: 半窗 = MH/2 → 中心钳在 ±MH/2
CMD.view={cx:9999,cz:-9999,scale:1};
cmdViewClamp(800,800/MH);
out.battle=[Math.round(CMD.view.cx),Math.round(CMD.view.cz)];
out.battleOk=Math.abs(CMD.view.cx)<=MH/2+1e-6&&Math.abs(CMD.view.cz)<=MH/2+1e-6;
// 界内视图不动 (跟手不被钳坏)
CMD.view={cx:3,cz:-4,scale:1};
cmdViewClamp(800,800/MH);
out.inner=(CMD.view.cx===3&&CMD.view.cz===-4);
// 布势档 0.46: 窗口盖满世界 → 居中 (画布每像素都在底图内)
CMD.view={cx:50,cz:50,scale:0.46};
cmdViewClamp(800,0.46*800/MH);
out.deploy=(CMD.view.cx===0&&CMD.view.cz===0);
return out; })()`);
assert('战斗档: 探出边界的视图钳回 ±(MH-半窗) —— 缺块几何上不可能',c.battleOk===true,`MH=${c.MH} view=${JSON.stringify(c.battle)}`);
assert('界内视图不被钳坏 (跟手零漂移)',c.inner===true);
assert('布势档 (窗口盖满世界) → 居中, 与整图适配口径一致',c.deploy===true);
}

// ── ⑧ 换局复位清解散账 ───────────────────────────────────────
{
section('⑧ 换局复位');
const r=run(`(()=>{ const out={};
CMD._disbanded=[{cmdGrp:null}];
cmdResetMatch();
out.cleared=CMD._disbanded===null;
out.orbatGone=CMD.orbat===null;
out.lockGone=CMD.lockedDir===null;
return out; })()`);
assert('cmdResetMatch 清 _disbanded/orbat/lockedDir (换局零残留)',
 r.cleared===true&&r.orbatGone===true&&r.lockGone===true,JSON.stringify(r));
}

// ── 收官 ─────────────────────────────────────────────────────
console.log(`\n──── verify-cmdbatch2-20261027: ${OK.length} 通过 / ${BAD.length} 失败 ${NEG?'(阴性对照 — 预期全红)':''} ────`);
if(BAD.length){ console.log('失败项:\n - '+BAD.join('\n - ')); }
process.exit(BAD.length?(NEG?0:1):0);
