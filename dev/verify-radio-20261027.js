// ─────────────────────────────────────────────────────────────
// dev/verify-radio-20261027.js —— 2026-10-27 通讯仪 (对讲机) 重做 + 第三人称持握修复 批验收
//
// 用法: node dev/verify-radio-20261027.js [--neg]
//   --neg = 阴性对照: 装载前把本批核心改动按文本还原成旧写法, 同一批判据必须报红
//           (锚点用修后原文; 找不到就抛错, 防"锚点漂移后静默通过"; 全部单行锚, 被测文件都是 CRLF)。
//
// 用户 7 项需求第 1 / 1.5 条:
//   ① 通讯仪 3D 模型按参考图 (对讲机参考.jpg) 重做成对讲机 —— 剪影比例 = 实测 (总高 379 / 总宽 162 /
//      上段窄块 45×100 / 天线根 24 / 机身 157×277), 配色对齐阵营, 金属旋钮 + 绿色 LED + 侧面 PTT;
//   1.5 第三人称拿通讯仪时**显示步枪模型 + 播步枪动画** —— 根因: gunKindOf 没有 radio 档, 一路落到
//      末尾的 return 'rifle' ⇒ worldGunModel / GUN_MOUNT_BY_KIND / GUN_MOUNT_PRONE / CARRIED_FWD 全走步枪。
//
// 覆盖:
//   ① 源码防回退: 单源建模 (buildRadioBody / radioPalette 只在 09-weapons 定义, 11-soldiers 调用而非重画) /
//      buildGunModel(key,team) 与唯一调用点的 team 透传 / gunKindOf 的 radio 判定在**最前** /
//      四张表 (挂点·匍匐挂点·前推量·持握姿态) 都有 radio 档 / 姿态机判定只认 gunHoldOf 不认武器名 /
//      第一人称三处位姿 (HIP / ADS / 默认握位) 都有 radio 档
//   ② 第一人称 (真沙箱): buildGunModel('radio',t) 网格数 + 包围盒剪影 (高>0.25 / 宽<0.2 / 深<0.1) +
//      六阵营主色互不相同 + 主色与 FACTIONS[..].coat 同色相 + 天线尖高度 + 非 radio 键逐位不变
//   ③ 第三人称模型: gunKindOf('radio')==='radio' (且各武器档未被带偏) / worldGunModel('radio',t) 与
//      第一人称**同模** (网格数·包围盒·主色全等) / 四阵营模型主色互不相同 / 步枪档网格数不变
//   ④ 挂点表: gunMountOf('radio') 命中 radio 档 (站姿/趴姿各一), x<0 (右手侧) / 前推量 radio 档
//   ⑤ 玩家化身 (真开局 + updatePlayerAvatar 推帧): gunG 下挂的模型是 radio (22 件对讲机, 不是 3 件步枪) /
//      av._gunKind==='radio' / 右手 armIK 反解到机身握点 (残差 <2cm) / 左手**不**抓机 (handKL 0) /
//      换弹与架枪对通讯仪**不生效** (左臂与 gunG 位移零变化) / 趴姿不炸 / 换回步枪后挂点与模型逐位回归 /
//      通讯仪包围盒与头盒·盔盒都不相交 (契约 J 口径)
//   ⑥ 阴性对照自检: --neg 下必须出现红 (判据非空转)
//
// ★ 2026-10-27 Lead 复核后补的四条 (都对应"最容易静默退化"的地方):
//   ①-b 改成**逐调用点**核对 team 透传 (不是数括号个数); ①-h 断言 noReload/noBrace 是 null 安全短路式
//   (hold=null 时与改前表达式恒等 ⇒ 步枪路径逐位不变); ②-h/②-i 断言 team 漏传/非法时**不抛且落中性灰档**
//   (且与六阵营主色都不同 ⇒ 漏传在画面上可辨认, 不会静默伪装成阵营 0); ⑤-k 契约 J 的头/盔盒判据。
//
// 口径: 与 verify-animfix-20261012 / verify-nadecancel-20261025 同款 boot (_bootstub 桩 + 全链 FILES +
//   startBtn.onclick 真开局), 调游戏自己的接口 (buildGunModel / worldGunModel / gunKindOf / gunMountOf /
//   mountGunModel / updatePlayerAvatar / armIK), 不重写第二套建模或姿态机。
// ─────────────────────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const NEG=process.argv.includes('--neg');
const OK=[],BAD=[];
function assert(name,cond,detail){ (cond?OK:BAD).push(name); console.log('  '+(cond?'✓':'✗')+' '+name+(detail?'  '+detail:'')); }
function section(t){ console.log(''); console.log('══ '+t+' ══'); }
const SRC=f=>fs.readFileSync(path.join(root,f),'utf8');

// ── 阴性对照补丁 (每条对应下面一条判据; 锚点 = 修后原文, 全单行) ─────────────────────────
const PATCHES=[
 // A gunKindOf 的 radio 判定退场 (回到"一路落到 return 'rifle'") ⇒ ③ 与 ⑤ 全线红
 ['js/11-soldiers.js', "if(d.radio) return 'radio';", ';'],
 // B worldGunModel 的 radio 分支退场 (回到步枪默认档) ⇒ ③ 模型判据红
 ['js/11-soldiers.js', 'buildRadioBody(g,team);', 'bx(gm,0.05,0.07,0.75,0,0,-0.05,g);'],
 // C 挂点表 radio 档退场 (落回 default) ⇒ ④ 站姿判据红
 ['js/11-soldiers.js', 'radio:{x:-0.17,y:0.40,z:0.30},', ''],
 // D 匍匐挂点 radio 档退场 ⇒ ④ 趴姿判据红
 ['js/11-soldiers.js', 'radio:{x:-0.22,dy:0.12,dz:0.40},', ''],
 // E 前推量 radio 档退场 (落回步枪 0.30) ⇒ ④ 前推量判据红
 // ★2026-11-20 判据跟走 (军刀近战重做批): CARRIED_FWD 追加 sabre:0.10 档 (军刀短, 不吃步枪 0.30),
 //   radio 档语义不变 —— 锚跟码到新行尾。
 ['js/11-soldiers.js', 'mortar:0.30,radio:0.14,pistol:0.06,sabre:0.10};', 'mortar:0.30};'],
 // F 持握表 radio 档退场 (表变空 ⇒ gunHoldOf 恒 null) ⇒ ① 单源判据 + ⑤ 姿态判据红
 ['js/11-soldiers.js', 'const GUN_HOLD_BY_KIND={', 'const GUN_HOLD_BY_KIND={};const _UNUSED_HOLD={'],
 // G 姿态机的持握表接入退场 (回到"四分支按步枪写死") ⇒ ⑤ 姿态判据红
 ['js/20-player.js', "const hold=(typeof gunHoldOf==='function')?gunHoldOf(gkNow):null;", 'const hold=null;'],
 // H 换弹对工具件的门退场 ⇒ ⑤ "通讯仪不播步枪动作" 判据红
 ['js/20-player.js', 'const reloading=(p.reloadT||0)>0&&!(hold&&hold.noReload);', 'const reloading=(p.reloadT||0)>0;'],
 // I 第一人称阵营透传退场 ⇒ ② 阵营配色判据红 (team 恒 undefined ⇒ 六阵营同色)
 ['js/10-viewmodel.js', 'VM.gunParts=buildGunModel(key,team);', 'VM.gunParts=buildGunModel(key);'],
 // J 第一人称 radio 位姿退场 (工具件套用步枪 HIP) ⇒ ① 位姿判据红
 ['js/10-viewmodel.js', 'const hip=d.rocket?HIP_ROCKET:(d.pistol?HIP_PISTOL:(d.radio?HIP_RADIO:HIP));', 'const hip=d.rocket?HIP_ROCKET:(d.pistol?HIP_PISTOL:HIP);'],
];
const PATCH_MAP={};
if(NEG) for(const [f,from,to] of PATCHES){
 const s=PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f);
 if(s.indexOf(from)<0) throw new Error('阴性对照锚点未找到: '+f+' :: '+JSON.stringify(from.slice(0,70)));
 PATCH_MAP[f]=s.split(from).join(to);
}
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f));

// ── ① 源码防回退 ─────────────────────────────────────────────
section('① 源码防回退 (单源纪律 + 四张表 + 位姿)');
{
const s09w=srcOf('js/09-weapons.js'), s11=srcOf('js/11-soldiers.js'), s20=srcOf('js/20-player.js'), s10=srcOf('js/10-viewmodel.js');
// 单源: 建模与配色只有 09-weapons 一处定义; 11-soldiers **调用**它, 不许自己再画一台
const defRadio=(s)=>((s.match(/function buildRadioBody\(/g)||[]).length);
const defPal=(s)=>((s.match(/function radioPalette\(/g)||[]).length);
assert('①-a 建模/配色单源: buildRadioBody 与 radioPalette 各只有一处定义 (在 09-weapons), 11-soldiers 是调用方',
 defRadio(srcOf('js/09-weapons.js'))===1 && defPal(srcOf('js/09-weapons.js'))===1
 && defRadio(s11)===0 && defPal(s11)===0 && s11.includes('buildRadioBody(g,team);'),
 '09w 定义 '+defRadio(s09w)+'/'+defPal(s09w)+' · 11s 定义 '+defRadio(s11)+'/'+defPal(s11));
// ★ Lead 复核 4a: 不是"数括号个数", 而是**逐个生产调用点**核对 —— 定义 1 处 + 调用若干处,
// 每一处调用都必须透传 team (否则第三人称/第一人称拿到 undefined)。探针自己的调用不计入。
const callSites=[];
for(const [f,s] of [['js/09-weapons.js',s09w],['js/10-viewmodel.js',s10],['js/11-soldiers.js',s11],['js/20-player.js',s20]]){
 const re=/buildGunModel\(([^)]*)\)/g; let m;
 while((m=re.exec(s))){ const before=s.slice(Math.max(0,m.index-10),m.index);
  if(/function\s*$/.test(before)) continue;         // 函数定义行, 不是调用点
  callSites.push({f, args:m[1].trim()}); }
}
assert('①-b 第一人称: buildGunModel 收 team, 且**每一个生产调用点**都透传 team (无一处漏传)',
 s09w.includes('function buildGunModel(key,team){')
 && callSites.length>=1 && callSites.every(c=>/^key\s*,\s*team$/.test(c.args)),
 callSites.map(c=>c.f.replace('js/','')+':('+c.args+')').join(' · '));
assert('①-c gunKindOf 的 radio 判定在**最前** (先于 rocket/mortar/atRifle/pistol/auto 与 bar/mg 档)',
 (()=>{ const i=s11.indexOf("if(d.radio) return 'radio';");
  if(i<0) return false;
  for(const m of ['if(d.rocket) return',"if(d.mortar) return","if(d.atRifle) return","if(d.pistol) return","if(d.type==='auto') return","return 'rifle';"]){
   const j=s11.indexOf(m); if(j<0||j<i) return false;
  }
  return true; })());
assert('①-d 四张表都有 radio 档: 站姿挂点 / 匍匐挂点 / 前推量 / 持握姿态',
 /GUN_MOUNT_BY_KIND=\{[\s\S]*?radio:\{x:/.test(s11)
 && /GUN_MOUNT_PRONE=\{[\s\S]*?radio:\{x:/.test(s11)
 && s11.includes('radio:0.14,pistol:0.06,sabre:0.10};')   // 锚已随 2026-11-04 批更新 (追加 pistol 项) + ★2026-11-20 跟走 (追加 sabre:0.10, radio 档语义不变)
 && s11.includes('const GUN_HOLD_BY_KIND={') && /GUN_HOLD_BY_KIND=\{[\s\S]*?radio:\{/.test(s11)
 && s11.includes('function gunHoldOf(kind){'));
assert('①-e 姿态机只认持握表, 不写武器名硬编码 (20-player 里不出现 \'radio\')',
 s20.includes("const hold=(typeof gunHoldOf==='function')?gunHoldOf(gkNow):null;")
 && !s20.includes("'radio'") && !s20.includes('"radio"'));
assert('①-f 第一人称三处位姿都有 radio 档 (HIP / ADS / 默认握位)',
 s10.includes('const HIP_RADIO=') && s10.includes('(d.radio?HIP_RADIO:HIP)')
 && s10.includes('if(d.radio) return { pos:V3(0.10,-0.20,-0.40)')
 && s10.includes('if(d.radio) return side?'));
// ★ Lead 复核 4b: noReload/noBrace 必须写成 **null 安全式** —— hold 为 null (所有枪械) 时
// `p.braced&&!(hold&&hold.noBrace)` 恒等于改前的 `p.braced`, `(p.reloadT||0)>0&&!(hold&&hold.noReload)`
// 恒等于 `(p.reloadT||0)>0` ⇒ 步枪路径**逐位不变**。反过来若写成 `hold.noBrace` 裸引用会抛,
// 写成 `!(hold===null||hold.noBrace)` 这种形式也容易把逻辑判反, 所以这条锚按"短路口"逐字比对。
assert('①-h 工具件两个门都是 null 安全式 (hold=null ⇒ 与改前表达式恒等, 步枪路径逐位不变)',
 s20.includes('if(p.braced&&!(hold&&hold.noBrace)){')
 && s20.includes('const reloading=(p.reloadT||0)>0&&!(hold&&hold.noReload);')
 && s20.includes('if(p.braced&&!(hold&&hold.noBrace)) gunOffY=0.12;')
 // 反向: 三处都必须是 `hold&&hold.noX` 短路式, 不许出现裸引用 `hold.noX` (null 时会抛)
 && (s20.match(/hold&&hold\.no(Brace|Reload)/g)||[]).length===3
 && !/[^&]hold\.no(Brace|Reload)/.test(s20),
 '短路式 '+(s20.match(/hold&&hold\.no(Brace|Reload)/g)||[]).length+' 处');
assert('①-g 参考图剪影比例落到常量 (总高 0.30m · 宽 157/379 · 上段 45×100 · 天线根 24/379)',
 s09w.includes('const RADIO_H=0.30;')
 && s09w.includes('RADIO_BODY_W=RADIO_H*157/379') && s09w.includes('RADIO_BODY_H=RADIO_H*277/379')
 && s09w.includes('RADIO_TOP_W=RADIO_H*45/379') && s09w.includes('RADIO_TOP_H=RADIO_H*100/379')
 && s09w.includes('RADIO_ANT_W=RADIO_H*24/379'));
}

// ── 沙箱装载 (_bootstub 桩 + 全链 FILES; 与 verify-animfix-20261012 同款) ─────────
const {sandbox,document,window}=require('./_bootstub.js');
const V3c=sandbox.THREE.Vector3;
if(!V3c.prototype.addScalar) V3c.prototype.addScalar=function(s){ this.x+=s; this.y+=s; this.z+=s; return this; };
if(!V3c.prototype.divideScalar) V3c.prototype.divideScalar=function(s){ s=s||1; this.x/=s; this.y/=s; this.z/=s; return this; };
if(!V3c.prototype.negate) V3c.prototype.negate=function(){ this.x=-this.x; this.y=-this.y; this.z=-this.z; return this; };
if(!V3c.prototype.cross) V3c.prototype.cross=function(v){ return this.crossVectors(this,v); };
const O3=sandbox.THREE.Object3D;
if(O3&&O3.prototype&&!O3.prototype.clear) O3.prototype.clear=function(){ if(this.children) this.children.length=0; return this; };
for(const k of ['MeshLambertMaterial','MeshBasicMaterial','MeshStandardMaterial','MeshPhongMaterial','PointsMaterial','SpriteMaterial']){
 const C=sandbox.THREE[k]; if(!C||!C.prototype) continue;
 if(!C.prototype.clone) C.prototype.clone=function(){ return new C(Object.assign({},this,{color:this.color})); };
 if(!C.prototype.dispose) C.prototype.dispose=function(){};
}
const AP=()=>({value:0,setValueAtTime(){},setTargetAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}});
const ACStub=class{
 createOscillator(){ return {frequency:AP(),detune:AP(),type:'',start(){},stop(){},connect(){},onended:null}; }
 createGain(){ return {gain:AP(),connect(){},disconnect(){}}; }
 createBuffer(){ return {getChannelData:()=>new Float32Array(16),duration:1,numberOfChannels:1}; }
 createBufferSource(){ return {buffer:null,loop:false,playbackRate:AP(),start(){},stop(){},connect(){}}; }
 createBiquadFilter(){ return {type:'',frequency:AP(),detune:AP(),Q:AP(),connect(){}}; }
 createDynamicsCompressor(){ return {threshold:AP(),ratio:AP(),attack:AP(),release:AP(),connect(){}}; }
 createStereoPanner(){ return {pan:AP(),connect(){}}; }
 resume(){ return Promise.resolve(); } get state(){ return 'running'; } get destination(){ return {}; }
 get currentTime(){ return 0; } get sampleRate(){ return 44100; }
};
sandbox.AudioContext=ACStub; sandbox.window.AudioContext=ACStub; sandbox.window.webkitAudioContext=ACStub;
sandbox.confirm=()=>true;
delete sandbox.window.CANNON;
const FILES=['js/00-config.js','js/00b-i18n.js','js/00c-procgen.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/19b-gamepad.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/22a-menuart.js','js/22b-speclayer.js','js/23-deploy.js','js/23b-worldrestore.js','js/25-zombies.js','js/26-commander.js','js/24-main.js'];
const CAMP=8;   // 草原遭遇 (与 verify-commander / verify-tankai 同图): 标准陆战, 坦克+飞机齐
function boot(campIdx){
 const ctx=vm.createContext(Object.assign({},sandbox));
 ctx.document=document; ctx.window=window; ctx.globalThis=ctx;
 ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
 ctx.console={log:()=>{},warn:()=>{},error:console.error.bind(console)};
 for(const f of FILES){ vm.runInContext(srcOf(f),ctx,{filename:f}); }
 return ctx;
}
let CTX=null;
function run(code){ return vm.runInContext(code,CTX,{timeout:600000}); }

// 沙箱内量测器: 只做"几何/材质读数", 判据在宿主机 (与 verify-a21-j 同一分工)
const MEASURE=`(()=>{
 const bboxOf=(root)=>{ let n=0,mn={x:1e9,y:1e9,z:1e9},mx={x:-1e9,y:-1e9,z:-1e9};
  root.traverse(o=>{ if(!o.isMesh) return; n++;
   const pr=(o.geometry&&o.geometry.parameters)||{}; let hx=0,hy=0,hz=0;
   if(pr.width!==undefined){ hx=pr.width/2; hy=pr.height/2; hz=pr.depth/2; }
   else if(pr.radiusTop!==undefined||pr.radiusBottom!==undefined){
    const r=Math.max(pr.radiusTop||0,pr.radiusBottom||0); hx=r; hy=(pr.height||0)/2; hz=r;
    const rx=o.rotation?Math.abs(o.rotation.x||0):0;
    if(Math.abs(rx-HPI)<0.35){ const t=hy; hy=hx; hz=t; }
   }
   const px=o.position?o.position.x:0, py=o.position?o.position.y:0, pz=o.position?o.position.z:0;
   mn.x=Math.min(mn.x,px-hx); mx.x=Math.max(mx.x,px+hx);
   mn.y=Math.min(mn.y,py-hy); mx.y=Math.max(mx.y,py+hy);
   mn.z=Math.min(mn.z,pz-hz); mx.z=Math.max(mx.z,pz+hz);
  });
  return {n, w:+(mx.x-mn.x).toFixed(4), h:+(mx.y-mn.y).toFixed(4), d:+(mx.z-mn.z).toFixed(4), mn, mx};
 };
 // 主色 = 面积最大的网格的材质色 (机身), 再给出全部不重复色 (阵营识别条/屏幕等)
 const matsOf=(root)=>{ const s=new Set(); let big=null, bigA=-1;
  root.traverse(o=>{ if(!o.isMesh||!o.material||!o.material.color) return;
   const c=o.material.color.getHex?o.material.color.getHex():o.material.color.c;
   s.add(c);
   const pr=(o.geometry&&o.geometry.parameters)||{};
   const a=(pr.width||pr.radiusTop*2||0.001)*(pr.height||pr.radiusTop*2||0.001)*(pr.depth||pr.radiusTop*2||0.001);
   if(a>bigA){ bigA=a; big=c; }
  });
  return {all:[...s], main:big};
 };
 const out={};
 out.kinds={};
 for(const k of ['radio','garand','thompson','bar','bazooka','springfield','p38','kar98zf','stg44','ppsh']) out.kinds[k]=gunKindOf(k);
 out.radioKind=gunKindOf('radio');
 // ① 第一人称 (六阵营) + 第三人称 (四阵营) 同一份建模
 const FAC=['us','ger','sov','jp','kmt','cpc'];
 out.fp={}; out.wp={};
 for(const f of FAC){
  const parts=buildGunModel('radio',f);
  const bb=bboxOf(parts.gun), mm=matsOf(parts.gun);
  out.fp[f]={bb, main:mm.main, all:mm.all.length, top:parts.radioTop?+parts.radioTop.toFixed(4):null};
  const g=worldGunModel('radio',f,'radio');
  const bb2=bboxOf(g), mm2=matsOf(g);
  out.wp[f]={bb:bb2, main:mm2.main, all:mm2.all.length};
 }
 // 第三人称 team 下标入参 (Bot/玩家只有 0/1) 必须与阵营键同色
 out.wpTeam={};
 for(const t of [0,1]){ const g=worldGunModel('radio',t,'radio'); out.wpTeam[t]=matsOf(g).main; }
 // 步枪档零回归: worldGunModel('rifle') 的网格数与包围盒 (改前 3 件)
 out.rifle=bboxOf(worldGunModel('rifle',0,'garand'));
 // ④ 挂点表
 // 2026-11-11 槽位契约跟钉: gunMountOf 返回模块级复用槽 _gm, 连续调用互相覆盖 —— 四档必须就地数值快照,
 // 否则四份引用同槽、serialization 时只剩最后一次调用的值 (④-a/④-c 的 !== 判据会全假)。
 {let _m=gunMountOf('radio'); out.mount={x:_m.x,y:_m.y,z:_m.z};
  _m=gunMountOf('rifle'); out.mountDefault={x:_m.x,y:_m.y,z:_m.z};
  _m=gunMountOf('radio',1.5); out.mountProne={x:_m.x,y:_m.y,z:_m.z};
  _m=gunMountOf('rifle',1.5); out.mountProneDefault={x:_m.x,y:_m.y,z:_m.z};}
 out.fwd={radio:CARRIED_FWD.radio, rifle:CARRIED_FWD.rifle};
 out.hold=gunHoldOf('radio'); out.holdRifle=gunHoldOf('rifle');
 // 天线尖高度 = 模型最高点 (剪影里必须明显高过机身: 上段占 26%)
 out.bodyTopY=null;
 out.pal={}; for(const f of FAC) out.pal[f]=radioPalette(f).bodyHex;
 // 兜底取证 (Lead 复核 4a): 万一某条路径漏传 team, radioPalette 拿到的是 undefined/null/'乱码' ——
 // 这三种都必须**不抛**并落到一个确定的默认档 (深灰军械), 而不是崩掉整条建模链。
 out.palFallback={};
 for(const [k,v] of [['undefined',undefined],['null',null],['num9',9],['str?',{}.zz],['unknownKey','no-such-faction']]){
  try{ const p=radioPalette(v); out.palFallback[k]={ok:true, hex:p.bodyHex}; }
  catch(e){ out.palFallback[k]={ok:false, err:String(e&&e.message||e)}; }
 }
 // 当前战役的两个阵营**键** (TEAM_FACTION 只有对象没有键, 这里反查回键名, 供"两入口同源"判据用)
 out.facKeys=[];
 for(const t of [0,1]){ let k=null; for(const f of FAC) if(FACTIONS[f]===TEAM_FACTION[t]) k=f; out.facKeys.push(k); }
 out.palTeam={t0:radioPalette(0).bodyHex, t1:radioPalette(1).bodyHex};
 out.factionCoat={}; for(const f of FAC) out.factionCoat[f]=FACTIONS[f].coat;
 return JSON.stringify(out);
})()`;

// ── ② 第一人称模型 (真沙箱) ─────────────────────────────────────
section('② 第一人称模型 (真沙箱: 剪影 / 阵营配色 / 天线)');
CTX=boot(CAMP);   // 真开局: 世界/玩家/Bot 全建起来 (⑤ 的玩家化身要 buildSoldierMesh + 姿态机)
const st=run("(()=>{ try{ const b=document.getElementById('startBtn'); if(b&&b.onclick){ b.onclick(); return 'ok'; } return 'no-button'; }catch(e){ return 'ERR '+String(e&&e.stack||e).slice(0,400); } })()");
assert('开局链真路径 startBtn.onclick 无异常',st==='ok',st==='ok'?'':' '+st);
const M=JSON.parse(run(MEASURE));
{
const fp=M.fp, FAC=['us','ger','sov','jp','kmt','cpc'];
assert('②-a buildGunModel(\'radio\') 建出 22 件网格 (旧版 9 件: 盒+面板+旋钮×2+天线+话筒×2)',
 fp.us.bb.n>=20, '实测 '+fp.us.bb.n+' 件');
assert('②-b 剪影是\'高瘦长方体\': 高>0.25 · 宽<0.2 · 深<0.1 (参考图 379 高 × 162 宽 ⇒ 高宽比 2.34)',
 fp.us.bb.h>0.25 && fp.us.bb.w<0.2 && fp.us.bb.d<0.1 && (fp.us.bb.h/fp.us.bb.w)>2.0,
 'h='+fp.us.bb.h+' w='+fp.us.bb.w+' d='+fp.us.bb.d+' 高宽比='+(fp.us.bb.h/fp.us.bb.w).toFixed(2));
// 机身顶面 = 原点(握点) + (机身高 - 握点下移量) = -0.075 + 0.2193 ≈ 0.144; 天线尖由 buildRadioBody 返回。
// 判据: 天线尖必须比机身顶面高 >0.05m (上段占剪影 26% ⇒ 两段式, 不是一整个方盒)。
assert('②-c 天线尖高过机身顶面 >5cm (上段占剪影 26% ⇒ 天线/机身两段式, 不是一整个方盒)',
 fp.us.top!==null && fp.us.top>0.14+0.05,
 '天线尖 y='+fp.us.top);
const mains=FAC.map(f=>fp[f].main);
assert('②-d 六阵营通讯仪主色**互不相同** (阵营配色对齐 coat 派生)',
 new Set(mains).size===FAC.length, FAC.map((f,i)=>f+':#'+mains[i].toString(16)).join(' '));
assert('②-e 主色与阵营 coat 同色相: 每个通道相对 coat 单调压暗且保留色序 (不是\'同一块黑\')',
 (()=>{ let ok=true;
  for(const f of FAC){ const c=M.factionCoat[f], b=M.pal[f];
   const cr=(c>>16)&255, cg=(c>>8)&255, cb=c&255;
   const br=(b>>16)&255, bg=(b>>8)&255, bb=b&255;
   // 压暗 46% 朝 0x2b2b2b: 每个通道都必须落在 [min(c,0x2b), max(c,0x2b)] 内 (线性混合的充要条件)
   for(const [cv,bv] of [[cr,br],[cg,bg],[cb,bb]]){
    const lo=Math.min(cv,0x2b)-1, hi=Math.max(cv,0x2b)+1;
    if(bv<lo||bv>hi) ok=false;
   }
  }
  return ok; })());
// 注意: TEAM_FACTION 由当前战役 (CAMP=8 草原遭遇) 决定, 不一定是 us/ger —— 判据按**同源关系**写:
// radioPalette(0) 必须逐位等于 radioPalette(TEAM_FACTION[0] 的阵营键), 这才是"两个入口同一份配色"。
assert('②-f 阵营键与 team 下标走同一份配色 (radioPalette(0)==radioPalette(TEAM_FACTION[0] 的键), 同源不漂移)',
 M.palTeam.t0===M.pal[M.facKeys[0]] && M.palTeam.t1===M.pal[M.facKeys[1]],
 't0=#'+M.palTeam.t0.toString(16)+'('+M.facKeys[0]+') t1=#'+M.palTeam.t1.toString(16)+'('+M.facKeys[1]+')');
const rg=JSON.parse(run(`(()=>{ const g=buildGunModel('garand',0); let n=0; g.gun.traverse(o=>{ if(o.isMesh) n++; }); return JSON.stringify({n, hasMuzzle:!!g.muzzle}); })()`));
assert('②-g 非 radio 键零回归: buildGunModel(\'garand\') 仍是枪械档 (网格数 >=8 且带 muzzle 锚点)',
 rg.n>=8 && rg.hasMuzzle===true, 'garand 网格 '+rg.n+' 件');
// ★ Lead 复核 4a: team 漏传时的兜底必须**不抛且确定** (默认深灰档), 不许崩掉建模链。
// 同时它必须与"合法阵营色"可区分: 兜底档的取值来自 vmMats.gunL 同族的 0x4a4d52 派生物, 不在六阵营主色集合里
// —— 这样"漏传 team"在画面上是可辨认的 (全员同色), 而不是静默地伪装成某个阵营。
const fbKeys=['undefined','null','num9','str?','unknownKey'];
assert('②-h team 漏传/非法时的兜底: radioPalette(undefined|null|越界下标|乱码) 全部不抛且落到同一档',
 fbKeys.every(k=>M.palFallback[k]&&M.palFallback[k].ok===true)
 && new Set(fbKeys.map(k=>M.palFallback[k].hex)).size===1,
 fbKeys.map(k=>k+':#'+(M.palFallback[k].ok?M.palFallback[k].hex.toString(16):'ERR')).join(' '));
assert('②-i 兜底档与六阵营主色都不同 ⇒ "漏传 team" 在画面上可辨认 (不会伪装成某个阵营)',
 !FAC.some(f=>M.pal[f]===M.palFallback['undefined'].hex)
 && M.palFallback['undefined'].hex!==undefined,
 '兜底 #'+M.palFallback['undefined'].hex.toString(16));
}

// ── ③ 第三人称模型 (同模 + 阵营色) ──────────────────────────────
section('③ 第三人称模型 (worldGunModel radio 档, 与第一人称同模)');
{
const FAC=['us','ger','sov','jp','kmt','cpc'];
assert('③-a gunKindOf(\'radio\')===\'radio\' (根因: 旧版落到 return \'rifle\')',
 M.radioKind==='radio', '实测 '+M.radioKind);
assert('③-b 其它武器档未被带偏 (garand→rifle / thompson·ppsh→smg / bar→mg / bazooka→launcher / springfield·p38·kar98zf·stg44 原档)',
 M.kinds.garand==='rifle' && M.kinds.thompson==='smg' && M.kinds.ppsh==='smg' && M.kinds.bar==='mg'
 && M.kinds.bazooka==='launcher' && M.kinds.springfield==='rifle' && M.kinds.p38==='pistol'   // 锚已随 2026-11-04 批更新: pistol 独立 kind (旧档 'smg' 是本次要修的病根), 其余原档语义不变
 && M.kinds.kar98zf==='rifle' && M.kinds.stg44==='mg',
 JSON.stringify(M.kinds));
assert('③-c 第三人称 radio 模型 = 第一人称同模 (网格数/包围盒三向逐位相同)',
 FAC.every(f=> M.wp[f].bb.n===M.fp[f].bb.n && M.wp[f].bb.w===M.fp[f].bb.w
  && M.wp[f].bb.h===M.fp[f].bb.h && M.wp[f].bb.d===M.fp[f].bb.d),
 'fp('+M.fp.us.bb.n+','+M.fp.us.bb.w+'x'+M.fp.us.bb.h+'x'+M.fp.us.bb.d+') wp('+M.wp.us.bb.n+','+M.wp.us.bb.w+'x'+M.wp.us.bb.h+'x'+M.wp.us.bb.d+')');
const wm=FAC.map(f=>M.wp[f].main);
assert('③-d 四/六阵营第三人称模型主色互不相同 (与第一人称同一份 radioPalette)',
 new Set(wm).size===FAC.length && FAC.every(f=>M.wp[f].main===M.fp[f].main),
 FAC.map((f,i)=>f+':#'+wm[i].toString(16)).join(' '));
assert('③-e team 下标入参也带阵营色 (Bot/玩家只有 0/1; 两人阵营不同 ⇒ 两台不同色的通讯仪)',
 M.wpTeam[0]===M.pal[M.facKeys[0]] && M.wpTeam[1]===M.pal[M.facKeys[1]] && M.wpTeam[0]!==M.wpTeam[1],
 '#'+M.wpTeam[0].toString(16)+' / #'+M.wpTeam[1].toString(16));
assert('③-f 步枪档零回归: worldGunModel(\'rifle\') 仍是 3 件 + 长枪身剪影 (深 >0.8)',
 M.rifle.n===3 && M.rifle.d>0.8, '网格 '+M.rifle.n+' 深 '+M.rifle.d);
}

// ── ④ 挂点表 / 前推量 / 持握表 ─────────────────────────────────
section('④ 挂点表 · 前推量 · 持握表 (单源)');
{
assert('④-a gunMountOf(\'radio\') 命中 radio 档而非 default (站姿)',
 M.mount.x!==M.mountDefault.x && Math.abs(M.mount.x-(-0.17))<1e-9 && Math.abs(M.mount.y-0.40)<1e-9,
 JSON.stringify(M.mount));
assert('④-b 站姿挂点在右手侧 (x<0) 且低于肩关节 (y<0.50) —— 与契约 J 同一口径',
 M.mount.x<0 && M.mount.y<0.50, JSON.stringify(M.mount));
assert('④-c 匍匐挂点也有 radio 档 (与 default 不同; 趴姿不把机子推到臂展外)',
 M.mountProne.x!==M.mountProneDefault.x, JSON.stringify({radio:M.mountProne,def:M.mountProneDefault}));
assert('④-d 前推量 radio 档 = 0.14 (短粗手持件, 不沿用步枪 0.30 ⇒ 否则脱手悬空)',
 M.fwd.radio===0.14 && M.fwd.rifle===0.30, JSON.stringify(M.fwd));
assert('④-e 持握表: radio 有档 (右手 IK 权重 1 / 左手 0 / 不换弹 / 不架枪), 步枪无档 (走原路径)',
 M.hold && M.hold.handK===1 && M.hold.handKL===0 && M.hold.noReload===true && M.hold.noBrace===true
 && M.holdRifle===null, JSON.stringify(M.hold));
}

// ── ⑤ 玩家化身 (真开局 + updatePlayerAvatar 推帧) ────────────────
section('⑤ 玩家化身持通讯仪 (真姿态机推帧: 模型 / 持握 / 不播步枪动作)');
{
const AV=`(()=>{
 const out={};
 // 桩沙箱没有 getWorldPosition ⇒ 用 11-soldiers 的纯算术 _eulerXYZ 复算手的躯干局部位置
 // (与 armIK 的残差复算同一份数学, 不引入第二套量法)
 const handTorso=(sh,elm,shPos)=>{
  const e=_eulerXYZ({x:0,y:-0.32,z:0}, sh.rotation.x, sh.rotation.y, sh.rotation.z);
  const elmT={x:shPos.x+e.x, y:shPos.y+e.y, z:shPos.z+e.z};
  const h=_eulerXYZ({x:0,y:-0.30,z:0}, elm.rotation.x, elm.rotation.y, elm.rotation.z);
  const hr=_eulerXYZ(h, sh.rotation.x, sh.rotation.y, sh.rotation.z);
  return {x:elmT.x+hr.x, y:elmT.y+hr.y, z:elmT.z+hr.z};
 };
 const bboxOf=(root)=>{ let n=0,mn={x:1e9,y:1e9,z:1e9},mx={x:-1e9,y:-1e9,z:-1e9};
  root.traverse(o=>{ if(!o.isMesh) return; n++;
   const pr=(o.geometry&&o.geometry.parameters)||{}; let hx=0,hy=0,hz=0;
   if(pr.width!==undefined){ hx=pr.width/2; hy=pr.height/2; hz=pr.depth/2; }
   else if(pr.radiusTop!==undefined||pr.radiusBottom!==undefined){
    const r=Math.max(pr.radiusTop||0,pr.radiusBottom||0); hx=r; hy=(pr.height||0)/2; hz=r;
    const rx=o.rotation?Math.abs(o.rotation.x||0):0;
    if(Math.abs(rx-HPI)<0.35){ const t=hy; hy=hx; hz=t; }
   }
   mn.x=Math.min(mn.x,o.position.x-hx); mx.x=Math.max(mx.x,o.position.x+hx);
   mn.y=Math.min(mn.y,o.position.y-hy); mx.y=Math.max(mx.y,o.position.y+hy);
   mn.z=Math.min(mn.z,o.position.z-hz); mx.z=Math.max(mx.z,o.position.z+hz);
  });
  return {n, w:+(mx.x-mn.x).toFixed(4), h:+(mx.y-mn.y).toFixed(4), d:+(mx.z-mn.z).toFixed(4)};
 };
 const p=player;
 p.pos.set(0,0,0); p.pos.y=(typeof standHeight==='function')?standHeight(0,0,10):0;
 p.alive=true; p.deployed=true; p.team=0; p.spectator=false;
 p.pitch=0; p.yaw=0; p.ads=false; p.braced=false; p.crouch=false; p.prone=false;
 p.fireAnimT=0; p.reloadT=0; p.nadeThrowT=0; p.meleeT=0; p.landDip=0; p.sprinting=false;
 p.curW={key:'radio',def:WPN_DEFS['radio'],mag:0,reserve:0}; p.slots=[p.curW]; p.curSlot=0;
 const av=playerAvatarEnsure();
 out.avOK=!!av;
 for(let i=0;i<150;i++){ nowT+=1/60; updatePlayerAvatar(1/60); }
 out.gunKind=av._gunKind;
 out.gunInGunG=!!(av._gun&&av._gun.parent===av.gunG);
 out.gunChildren=av.gunG.children.length;
 out.gunBB=av._gun?bboxOf(av._gun):null;
 out.gunRotY=av._gun?+av._gun.rotation.y.toFixed(4):null;
 out.gunPos=av._gun?{x:+av._gun.position.x.toFixed(3),y:+av._gun.position.y.toFixed(3),z:+av._gun.position.z.toFixed(3)}:null;
 out.gunGPos={x:+av.gunG.position.x.toFixed(3),y:+av.gunG.position.y.toFixed(3),z:+av.gunG.position.z.toFixed(3)};
 // 2026-11-11 槽位契约跟钉: 此处到 serialization (line ~474) 之间还有 ~600 帧姿态机 (趴姿 120 帧),
 // _gm 会被覆盖 —— mountWant 必须就地快照数值, 不得持有槽引用跨帧。
 {const _mw=gunMountOf('radio',av.pelvis.rotation.x);
  out.mountWant={x:_mw.x,y:_mw.y,z:_mw.z};}
 const hRt=handTorso(av.armR.sh,av.armR.elm,av.armR.sh.position);
 const hLt=handTorso(av.armL.sh,av.armL.elm,av.armL.sh.position);
 const gp=gunGripPoint('radio',av.gunG.rotation.x,av.gunG.rotation.y,av.gunG.rotation.z,av.pelvis.rotation.x);
 const fp=gunForePoint('radio',av.gunG.rotation.x,av.gunG.rotation.y,av.gunG.rotation.z,av.pelvis.rotation.x);
 out.handRTorso={x:+hRt.x.toFixed(3),y:+hRt.y.toFixed(3),z:+hRt.z.toFixed(3)};
 out.gripTorso={x:+gp.x.toFixed(3),y:+gp.y.toFixed(3),z:+gp.z.toFixed(3)};
 out.handRGrip=+Math.hypot(hRt.x-gp.x,hRt.y-gp.y,hRt.z-gp.z).toFixed(4);
 out.handLFore=+Math.hypot(hLt.x-fp.x,hLt.y-fp.y,hLt.z-fp.z).toFixed(4);
 // 契约 J 口径复用到工具件: 举在胸前的通讯仪不许插进头/盔盒 (第三人称是唯一看得见的视角)。
 // 量法: gunG 的旋转 (YXZ) + mountGunModel 的 carryOffset 与 rotation.y=PI, 把每个件的 8 个角点
 // 折回**躯干局部系**, 再与头盒 (|x|≤0.10, y 0.61..0.83) / 盔盒 (|x|≤0.155, y 0.60..0.95) 求交。
 // 为什么不用 getWorldPosition: 桩沙箱没有它; 而且躯干局部系才是契约 J 判据所在的空间。
 // ★ 必须在**站姿**下量 (所以这段放在换步枪之前): 趴姿的躯干局部系整体前倾 1.5rad, 那时头盒已不在
 //   竖直方向 —— 趴姿另有一条判据 (⑤-j 不抛错 + 匍匐挂点档生效), 两件事分开量才各自有意义。
 (function(){
  if(!av._gun) { out.headOverlap=null; out.helmOverlap=null; return; }
  const co=gunCarryOffset('radio');
  const rx=av.gunG.rotation.x, ry=av.gunG.rotation.y;
  const a=Math.cos(rx),b=Math.sin(rx),c=Math.cos(ry),d=Math.sin(ry);
  const toT=(x,y,z)=>{ const x1=-x+co.x, y1=y+co.y, z1=-z+co.z;
   return {x:c*x1+d*z1+av.gunG.position.x, y:b*d*x1+a*y1-b*c*z1+av.gunG.position.y,
           z:-a*d*x1+b*y1+a*c*z1+av.gunG.position.z}; };
  const mn={x:1e9,y:1e9,z:1e9}, mx={x:-1e9,y:-1e9,z:-1e9};
  av._gun.traverse(o=>{ if(!o.isMesh) return;
   const pr=(o.geometry&&o.geometry.parameters)||{}; let hx=0,hy=0,hz=0;
   if(pr.width!==undefined){hx=pr.width/2;hy=pr.height/2;hz=pr.depth/2;}
   else if(pr.radiusTop!==undefined){const r=Math.max(pr.radiusTop||0,pr.radiusBottom||0);hx=r;hy=(pr.height||0)/2;hz=r;
    const q=Math.abs(o.rotation.x||0); if(Math.abs(q-HPI)<0.35){const t=hy;hy=hx;hz=t;}}
   for(const sx of [-1,1])for(const sy of [-1,1])for(const sz of [-1,1]){
    const p2=toT(o.position.x+sx*hx,o.position.y+sy*hy,o.position.z+sz*hz);
    mn.x=Math.min(mn.x,p2.x);mx.x=Math.max(mx.x,p2.x);
    mn.y=Math.min(mn.y,p2.y);mx.y=Math.max(mx.y,p2.y);
    mn.z=Math.min(mn.z,p2.z);mx.z=Math.max(mx.z,p2.z);
   }
  });
  const ov=(b2)=>{ const x=Math.min(mx.x,b2.mx.x)-Math.max(mn.x,b2.mn.x);
   const y=Math.min(mx.y,b2.mx.y)-Math.max(mn.y,b2.mn.y);
   const z=Math.min(mx.z,b2.mx.z)-Math.max(mn.z,b2.mn.z);
   return (x>0&&y>0&&z>0)?{x:+x.toFixed(3),y:+y.toFixed(3),z:+z.toFixed(3)}:null; };
  out.headOverlap=ov({mn:{x:-0.10,y:0.61,z:-0.10}, mx:{x:0.10,y:0.83,z:0.10}});
  out.helmOverlap=ov({mn:{x:-0.155,y:0.60,z:-0.155}, mx:{x:0.155,y:0.95,z:0.155}});
  out.radioTorso={mn:{x:+mn.x.toFixed(3),y:+mn.y.toFixed(3),z:+mn.z.toFixed(3)},
                  mx:{x:+mx.x.toFixed(3),y:+mx.y.toFixed(3),z:+mx.z.toFixed(3)}};
 })();
 out.armBase={shR:+av.armR.sh.rotation.x.toFixed(3),elR:+av.armR.elm.rotation.x.toFixed(3),
              shL:+av.armL.sh.rotation.x.toFixed(3),elL:+av.armL.elm.rotation.x.toFixed(3)};
 // 换弹 + 架枪对通讯仪必须**不生效** (表里 noReload/noBrace)
 const shL0=av.armL.sh.rotation.x, elL0=av.armL.elm.rotation.x, gy0=av.gunG.position.y, gx0=av.gunG.rotation.x;
 p.reloadT=1.0; p.braced=true;
 for(let i=0;i<90;i++){ nowT+=1/60; updatePlayerAvatar(1/60); }
 out.reloadShLDelta=+(av.armL.sh.rotation.x-shL0).toFixed(4);
 out.reloadElLDelta=+(av.armL.elm.rotation.x-elL0).toFixed(4);
 out.braceYDelta=+(av.gunG.position.y-gy0).toFixed(4);
 out.braceXDelta=+(av.gunG.rotation.x-gx0).toFixed(4);
 // 对照: 换回步枪时同样按住换弹+架枪, 左臂/枪身**必须**动 (证明上面的零变化不是判据空转)
 p.reloadT=0; p.braced=false;
 p.curW={key:'garand',def:WPN_DEFS['garand'],mag:8,reserve:80}; p.slots=[p.curW];
 for(let i=0;i<150;i++){ nowT+=1/60; updatePlayerAvatar(1/60); }
 out.rifleKind=av._gunKind;
 out.rifleBB=av._gun?bboxOf(av._gun):null;
 out.rifleMount={x:+av.gunG.position.x.toFixed(3),y:+av.gunG.position.y.toFixed(3),z:+av.gunG.position.z.toFixed(3)};
 const rshL0=av.armL.sh.rotation.x, rgy0=av.gunG.position.y;
 p.reloadT=1.0; p.braced=true;
 for(let i=0;i<90;i++){ nowT+=1/60; updatePlayerAvatar(1/60); }
 out.rifleReloadShLDelta=+(av.armL.sh.rotation.x-rshL0).toFixed(4);
 out.rifleBraceYDelta=+(av.gunG.position.y-rgy0).toFixed(4);
 p.reloadT=0; p.braced=false;
 // 趴姿不炸 (通讯仪也有匍匐档)
 p.curW={key:'radio',def:WPN_DEFS['radio'],mag:0,reserve:0}; p.slots=[p.curW]; p.prone=true;
 let proneErr=null;
 try{ for(let i=0;i<120;i++){ nowT+=1/60; updatePlayerAvatar(1/60); } }catch(e){ proneErr=String(e&&e.message||e); }
 out.proneErr=proneErr; out.proneKind=av._gunKind;
 out.proneGunPos={x:+av.gunG.position.x.toFixed(3),y:+av.gunG.position.y.toFixed(3),z:+av.gunG.position.z.toFixed(3)};
 p.prone=false;
 return JSON.stringify(out);
})()`;
const A=JSON.parse(run(AV));
assert('⑤-a 玩家化身持通讯仪: gunG 下挂的模型 kind = radio (根因: 旧版挂的是 rifle)',
 A.gunKind==='radio', '实测 '+A.gunKind);
assert('⑤-b gunG 下只有 1 个枪模且就是那个 radio 模型 (22 件对讲机, 不是 3 件步枪)',
 A.gunChildren===1 && A.gunInGunG && A.gunBB && A.gunBB.n>=20 && A.gunBB.h>0.25,
 'children='+A.gunChildren+' 网格='+(A.gunBB?A.gunBB.n:0)+' h='+(A.gunBB?A.gunBB.h:0));
assert('⑤-c 挂点写进 gunG = gunMountOf(\'radio\',pp) 单源 (不残留步枪 default)',
 Math.abs(A.gunGPos.x-A.mountWant.x)<0.002 && Math.abs(A.gunGPos.y-A.mountWant.y)<0.002
 && Math.abs(A.gunGPos.z-A.mountWant.z)<0.002, JSON.stringify({got:A.gunGPos,want:A.mountWant}));
assert('⑤-d 枪模在 gunG 内前推 0.14 + rotation.y=π (mountGunModel 单源, 与 Bot 同一条路径)',
 Math.abs(A.gunPos.z-0.14)<1e-6 && Math.abs(A.gunRotY-Math.PI)<1e-4, JSON.stringify(A.gunPos)+' rotY='+A.gunRotY);
assert('⑤-e 右手被 armIK 反解到机身握点 (残差 <2cm ⇒ 手真在机身上, 不是插在锁骨)',
 A.handRGrip<0.02, '右手→握点 '+A.handRGrip+'m');
assert('⑤-f 左手**不**抓机 (持握表 handKL=0 ⇒ 左臂留在下垂基准, 离护木点远 >0.15m)',
 A.handLFore>0.15, '左手→护木点 '+A.handLFore+'m');
assert('⑤-g 通讯仪不播步枪动作: 按住换弹+架枪 90 帧, 左臂与 gunG 位移**零变化**',
 A.reloadShLDelta===0 && A.reloadElLDelta===0 && A.braceYDelta===0 && A.braceXDelta===0,
 JSON.stringify({shL:A.reloadShLDelta,elL:A.reloadElLDelta,gy:A.braceYDelta,gx:A.braceXDelta}));
assert('⑤-h 对照 (判据非空转): 换回步枪后同样的换弹+架枪**确实**动左臂与枪身',
 Math.abs(A.rifleReloadShLDelta)>0.05 && Math.abs(A.rifleBraceYDelta)>0.05,
 JSON.stringify({shL:A.rifleReloadShLDelta,gy:A.rifleBraceYDelta}));
assert('⑤-i 换回步枪后挂点/模型逐位回归 (kind=rifle, 挂点 -0.15/0.33/0.26, 3 件长枪身)',
 A.rifleKind==='rifle' && Math.abs(A.rifleMount.x-(-0.15))<1e-3 && Math.abs(A.rifleMount.y-0.33)<1e-3
 && Math.abs(A.rifleMount.z-0.26)<1e-3 && A.rifleBB.n===3 && A.rifleBB.d>0.8,
 JSON.stringify(A.rifleMount)+' 网格='+A.rifleBB.n);
assert('⑤-j 趴姿持通讯仪不抛错且 kind 保持 radio (匍匐挂点档生效)',
 A.proneErr===null && A.proneKind==='radio', A.proneErr?A.proneErr:JSON.stringify(A.proneGunPos));
// 契约 J 的"武器包围盒不得与头/颈盒相交"复用到工具件: 举在胸前的通讯仪不许插进头/盔盒。
// 这条是**第三人称唯一可见视角**下的硬约束 (第一人称根本看不到自己的头), 而挂点表正是为它定的
// (y=0.40 而非步枪 0.33 就是为了把机子抬到胸口又不顶到下巴)。
assert('⑤-k 通讯仪包围盒与头盒/盔盒**都不相交** (契约 J 口径, 躯干局部系逐角点量)',
 A.headOverlap===null && A.helmOverlap===null,
 '头盒交 '+JSON.stringify(A.headOverlap)+' · 盔盒交 '+JSON.stringify(A.helmOverlap)
 +' · 机子AABB '+JSON.stringify(A.radioTorso));
}

// ── 汇总 ─────────────────────────────────────────────────────
console.log('');
console.log((NEG?'[阴性对照] ':'')+'verify-radio: '+OK.length+' 通过, '+BAD.length+' 失败');
if(BAD.length){
 console.log('失败项:'); for(const b of BAD) console.log('  ✗ '+b);
 process.exitCode=1;
 if(NEG) console.log('(阴性对照: 有红=判据具备分辨力)');
} else if(NEG){
 console.log('✗ 阴性对照全绿 = 判据空转!');
 process.exitCode=1;
}
