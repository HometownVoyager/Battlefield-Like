// ─────────────────────────────────────────────────────────────
// dev/verify-animfix-20261012.js —— 2026-10-12 左臂朝向 + 读条取消/互斥 批验收
//
// 用法: node dev/verify-animfix-20261012.js [--neg]
//   --neg = 阴性对照: 装载前把本批的两个核心修复按文本还原成旧写法, 同一批判据必须报红
//          (证明判据真的在测这两处, 而不是"改前改后都绿"的空断言)
//
// 用户实报:
//   ① "很多动作仍然有左臂太靠右, 看起来左臂长在右肩上" (举例: 补给箱取弹药 / 火箭筒换弹)
//   ② "打绷带等读条动作进行时会被取弹药等其他行动强行打断, 但不要出现模型滞留; 同时可以点击 X 取消"
//
// 覆盖:
//   A 左臂朝向  (10-viewmodel): 六处动作覆盖位姿全部过 vmHandLFix 单源; 袖管(肩端)落到掌心左侧,
//                                掌心落点与旧字面量逐位一致 (手不滑走, 只把袖管转到画面左下)
//   B 读条互斥  (18-game/20-player): readBarActive/readBarBusy/cancelReadBar 单源;
//                                别的行动抢走身体 ⇒ 包扎按"被打断"收账 (不再一路 tick 到满、照样回血)
//   C 读条取消  (18-game/19-input/22-hud): X 键 / 左键 / H 再按 / ✕ 按钮 四条路都走同一个出口;
//                                取消后 VM 的绷带卷/缠臂环/持刀左臂全部收起 (无模型滞留)
//
// 口径: ① 源码防回退断言 (字符串) ② 沙箱行为断言 (真 three, 用游戏自己的接口 + 真 updatePlayer 推帧)
// ─────────────────────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const NEG=process.argv.includes('--neg');
const OK=[],BAD=[];
function assert(name,cond,detail){ (cond?OK:BAD).push(name); console.log(`  ${cond?'✓':'✗'} ${name}${detail?'  '+detail:''}`); }
function section(t){ console.log('\n══ '+t+' ══'); }
const SRC=f=>fs.readFileSync(path.join(root,f),'utf8');

// ── 阴性对照: 把修复按文本还原 (锚点用修后原文; 找不到就抛错, 防"锚点漂移后静默通过") ──
const PATCHES=[
 // A 左臂: 袖管归位退化成恒等映射 (= 2026-10-05 那版行为: rotY 0 / 包扎 +1.2 / 物理换匣 -0.17 全部原样)
 // 注: 锚点写成**单行** —— 本仓 10-viewmodel/20-player/22-hud 是 CRLF, 18-game/19-input 是 LF,
 //     带 \n 的多行锚点会挑行尾 (阴性对照会"锚点未找到"地假红)。
 ['js/10-viewmodel.js',
  'if(r.y<=-0.6&&r.y>=-1.05) return pose;',
  'if(true) return pose;'],
 // B 互斥闸: 包扎 tick 退回"只认自己走完"
 ['js/20-player.js',
  "if(p.readBarBusy()) p.cancelReadBar('包扎被打断!');",
  "if(false) p.cancelReadBar('包扎被打断!');"],
 // C 取消单源: 不再收模型层残留
 ['js/18-game.js',
  "if(typeof vmAbortAction==='function') vmAbortAction();   // 模型层先收",
  "if(false) vmAbortAction();   // 模型层先收"],
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
const s10=srcOf('js/10-viewmodel.js');
assert('10-A 左臂基准角单源 (VM_LARM_Y 落在合法带内)',
 s10.includes('const VM_LARM_Y=-0.95;'));
assert('10-A vmHandLSnap / vmHandLFix 单源就位 (掌心保点 = vmPalmOf 反解腕位)',
 s10.includes('function vmHandLSnap(pose){')&&s10.includes('if(r.y<=-0.6&&r.y>=-1.05) return pose;')
 &&s10.includes('function vmHandLFix(px,py,pz,rx,ry,rz){')// 2026-11-13 C 项: vmHandLFix 改标量入参+_ovL 槽 (单源链不变)
 &&s10.includes('return vmHandLSnap(_ovL);'));
// 左下置弹匣的**物理**换匣 (BAR/百式 = side=1 的左手持匣) 也过袖管归位 —— 它的 rotY 是解算出来的
// (-0.09~-0.24), 不过这一道就还是"左臂在画面右半"
assert('10-A 左手持匣路径 (vmHoldPose side=1) 同样过袖管归位',
 s10.includes('if(hg.side) handLOverride=vmHandLSnap(hp); else handROverride=hp;'));
// 六处动作覆盖位姿必须全部过单源: grab/火箭筒换弹/旧版换匣×2/建锤/举雷 + 包扎
const fixCount=(s10.match(/handLOverride=vmHandLFix\(/g)||[]).length;
assert('10-A 六处动作覆盖位姿全部走 vmHandLFix (无一处裸字面量)',fixCount>=6,`实测 ${fixCount} 处`);
assert('10-A 包扎位姿同样走单源 (旧版 armRotY=+1.2 已退场)',
 s10.includes('const armL=vmHandLFix(-0.08,-0.035,-0.05,0.12,1.2,0.08);')
 &&!s10.includes('let armPos=V3(-0.125,-0.038,-0.05), armRotY=1.2;'));
// 2026-11-13 C 项: 包扎右臂改 _ovR 槽位写法 (vmWristFor 同式反解, rot 仍是 0.28+cosφ·0.20 正角带)
assert('10-A 包扎右臂袖管朝向正角+掌心精确解算就位',
 s10.includes('const rRot=_ovR.rot; rRot.set(0.28+Math.cos(phi)*0.20, 0.74+Math.sin(phi)*0.08, -0.06);')
 &&s10.includes('handROverride=_ovR; _ovR.pos.copy(vmWristFor(rPalm.x,rPalm.y,rPalm.z,rRot.x,rRot.y,rRot.z));'));
assert('10-C vmAbortAction / vmBandageHide 收尾单源就位',
 s10.includes('function vmAbortAction(){')&&s10.includes('function vmBandageHide(){'));
assert('10-C 包扎分支的自行打断也走残留收尾单源',
 s10.includes('vmBandageHide(); vmSndFlags={};'));

const s18=srcOf('js/18-game.js');
assert('18-B readBarActive / readBarBusy / cancelReadBar 三件单源就位 (锚已随 2026-10-25 举雷/换弹扩容批更新, 语义不变=取消网单源仍在)',
 s18.includes('readBarActive(){ return this.bandaging>0||!!this.demolish||!!this.useCast')
 &&s18.includes("||(typeof VM!=='undefined'&&((VM.state==='nade'&&this.nadeHeld)||VM.state==='reload')); }")
 &&s18.includes('readBarBusy(){')&&s18.includes('cancelReadBar(msg,quiet){'));
assert('18-B cancelReadBar 收账目 + 调模型层 vmAbortAction',
 s18.includes("if(typeof vmAbortAction==='function') vmAbortAction();")
 &&s18.includes("if(this.demolish){ if(typeof stopDemolish==='function') stopDemolish(this,true);")
 &&s18.includes("if(this.useCast){ if(this.useCast.g&&this.useCast.g.user===this) this.useCast.g.user=null;"));
assert('18-B 受击打断改走取消单源 (旧版三行裸清字段已退场; 2026-11-03 死亡掉雷批把单行拆块插入掉雷行, 锚跟码)',
 s18.includes('if(amt>READBAR_DMG_GATE&&this.readBarActive()){')
 &&s18.includes("this.cancelReadBar(this.bandaging>0?'包扎被打断!':")
 &&!s18.includes("if(this.bandaging>0){ this.bandaging=0; showScorePop('包扎被打断!'); }"));
assert('18-B 死亡链也收读条 (与动作计时同规)',
 s18.includes("if(this.readBarActive()) this.cancelReadBar(null,true);"));

const s20=srcOf('js/20-player.js');
assert('20-B 包扎 tick 按"身体被占用"判定打断',
 s20.includes("if(p.readBarBusy()) p.cancelReadBar('包扎被打断!');"));
assert('20-B 前摇反过来收掉包扎 (两条进度条不同时跑)',
 s20.includes("if(p.bandaging>0) p.cancelReadBar('包扎被打断!');"));

const s19=srcOf('js/19-input.js');
assert('19-C X 键读条中 = 取消 (撑枪语义让位)',
 s19.includes("if(player.readBarActive()){ player.cancelReadBar('已取消'); return; }"));
assert('19-C H 再按 = 极少加快不取消 (★2026-10-30 判据跟走: 用户裁定"同键再按=加速", 旧"取消包扎"口径退场; 取消仍有 X/左键/受击>25)',
 s19.includes('if(player.bandaging>0){')
 &&s19.includes('const _bb=BANDAGE_T*BAR_PRESS_BOOST;')
 &&s19.includes('player.bandaging=Math.max(0.01,player.bandaging-_bb);')
 &&!s19.includes("player.cancelReadBar('包扎已取消');"));
assert('19-C 读条中左键 = 取消且**吞掉这次点击** (不顺势走火; 锚已随 2026-10-25 批更新: 举雷待发除外——左键非有意取消, 收雷只走 X/✕)',
 s19.includes("if(e.button===0&&player.readBarActive()&&!(typeof VM!=='undefined'&&(VM.state==='nade'&&player.nadeHeld||VM.state==='reload'))){")&&s19.includes("player.cancelReadBar('已取消');\nreturn;\n}\nif(e.button===0) mouseDown=true;")); /* ★2026-11-13 批跟码: 换弹中左键豁免 (用户令④), 举雷例外保留 */
assert('19-C 包扎读条时长走 BANDAGE_T 单源 (2.6 字面量已收)',
 s19.includes('player.bandaging=BANDAGE_T;')&&s19.includes('VM.stateDur=BANDAGE_T;'));

const s22=srcOf('js/22-hud.js');
assert('22-C 读条条覆盖包扎/拆除/前摇三条',
 s22.includes('player.bandaging>0?{lab:t2(\'包扎中: {0}s\'')&&s22.includes('player.demolish?{lab:')
 &&s22.includes('player.useCast?{lab:t2(EMCAST'));
assert('22-C ✕ 按钮可点 (pointer-events:auto) 且走取消单源 + 不冒泡重锁指针',
 s22.includes("btn.id='castCancelBtn';")&&s22.includes("btn.textContent='✕';")&&s22.includes('pointer-events:auto;cursor:pointer;')
 &&s22.includes("player.cancelReadBar('已取消'); }")&&s22.includes('e.stopPropagation();'));
assert('22-C 换局复位也收读条残留',
 s22.includes("if(player.readBarActive()) player.cancelReadBar(null,true);"));

const s23=srcOf('js/23-deploy.js');
assert('23-C 再部署复位也收读条残留',
 s23.includes("if(p.readBarActive()) p.cancelReadBar(null,true);"));

const scfg=srcOf('js/00-config.js');
assert('config BANDAGE_T=2.6 单源就位',scfg.includes('const BANDAGE_T=2.6;'));
const si18n=srcOf('js/00b-i18n.js');
assert('i18n 新增读条文案全部有英文键',
 ["'包扎已取消'","'使用已取消'","'已被其他行动打断'","'包扎中: {0}s'","'取消 (X / 左键)'","'使用中: 迫击炮 …'","'使用中: 火力点 …'"]
  .every(k=>si18n.includes(k+':')));
// 版本戳: index.html 全量同一戳 (2026-10-24b 批起 js/css 统一为一枚, 与 verify-text.js 同口径)
const sh=SRC('index.html');
const stamps=[...sh.matchAll(/\?v=([0-9a-z]+)/g)].map(m=>m[1]);
const stampSet=[...new Set(stamps)].sort();
assert('index.html 版本戳全量唯一 20261118c',
 stamps.length>40&&stampSet.join(',')==='20261118c'
 &&stamps.filter(s=>s==='20261118c').length>44,`戳集合=${stampSet.join(' / ')} ×${stamps.length}`);
}

// ── 沙箱装载 (真 three) ───────────────────────────────────────
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
	ctx.window=window; ctx.globalThis=ctx;
	ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
	for(const f of FILES){ let code=srcOf(f); vm.runInContext(code,ctx,{filename:f}); }
	return {ctx,T};
}

// 沙箱内: 摆某个动作态 + 量左臂两端 (袖管肩端 z=+0.25 / 掌心 z=-VM_PALM_L)
// ★ 掌心"逐位不变"必须量**臂组父坐标系**里的点, 不能量世界系: 根姿态里有一项呼吸摆动
//   (oy+=sin(performance.now()*1.4)*0.0022) 是**挂钟时间**的函数, 两次调用差几毫秒就差 ~2mm ——
//   量世界系会把"上一毫秒的呼吸相位"当成"手滑走了" (真浏览器探针第一版就是这么假红的)。
//   父坐标系把 root/sway/recoil 整条祖先链的时变项一起约掉, 剩下的才是腕位反解本身的误差。
// ★ mode = fixed (修后) / legacy (按回旧字面量) / snapoff (关掉袖管归位, 用于"物理换匣路径"的页内阴性对照)。
const SBOX_HELPERS=`
function __vmArm(){
VM.inner.updateMatrixWorld(true);
const az=z=>VM.arms.L.localToWorld(new THREE.Vector3(0,0,z));
const sl=az(0.25), pa=az(-VM_PALM_L);
const par=VM.arms.L.parent; par.updateMatrixWorld(true);
const pp=par.worldToLocal(pa.clone());
const azR=z=>VM.arms.R.localToWorld(new THREE.Vector3(0,0,z));
const slR=azR(0.25), paR=azR(-VM_PALM_L);
const ppR=par.worldToLocal(paR.clone());
return {sl:[sl.x,sl.y,sl.z], pa:[pa.x,pa.y,pa.z], pl:[pp.x,pp.y,pp.z], ry:VM.arms.L.rotation.y,
        slR:[slR.x,slR.y,slR.z], paR:[paR.x,paR.y,paR.z], plR:[ppR.x,ppR.y,ppR.z], ryR:VM.arms.R.rotation.y,
        state:VM.state};
}
function __vmPose(key,st,k,mode){
const d=WPN_DEFS[key];
player.curW={key:key,def:d,mag:d.mag,reserve:d.reserve};
player.ads=false; player.sprinting=false; player.crouch=false; player.prone=false;
player.onGround=true; player.braced=false; player.leanT=0; player.landDip=0;
player.vel.set(0,0,0); player.holdBreath=false;
player.nadeHeld=false; player.bandaging=0; player.pendingBuild=null; player.grabAction=null;
vmEquip(key,0);
const dur=st==='reload'?(d.reload||2.5):(st==='grab'?0.85:BANDAGE_T);
VM.state=st; VM.stateDur=dur; VM.stateT=k*dur;
if(st==='grab') player.grabAction={kind:'ammo',crate:{x:0,z:0}};
if(mode==='snapoff'){ window.__snapSaved=vmHandLSnap; vmHandLSnap=p=>p; }   // 页内阴性对照: 关掉袖管归位
for(let i=0;i<30;i++){
VM.stateT=k*dur;
if(st==='bandage') player.bandaging=dur*(1-k);
updateViewModel(1/60,player);
}
if(mode==='legacy'){   // 页内阴性对照: 按回 2026-10-05 那版旧字面量 (腕位 + 旧姿态角)
const LG={grab:[[-0.04,-0.08,-0.22],[0.4,0,0]],rocketreload:[[-0.04,-0.09,-0.24],[0.42,0,0]],
bandage:[[-0.08,-0.035,-0.05],[0.12,1.2,0.08]]}[st==='reload'&&d.rocket?'rocketreload':st];
if(LG){ VM.arms.L.position.set(LG[0][0],LG[0][1],LG[0][2]); VM.arms.L.rotation.set(LG[1][0],LG[1][1],LG[1][2]); }
}
const r=__vmArm();
if(window.__snapSaved){ vmHandLSnap=window.__snapSaved; window.__snapSaved=null; }
return r;
}
function __vmLegacy(p,r){   // 左臂按回旧字面量 (腕位 + 旧姿态角), 仅供手工对照 (自动化判据走 __vmPose 的 legacy 模式)
VM.arms.L.position.set(p[0],p[1],p[2]);
VM.arms.L.rotation.set(r[0],r[1],r[2]);
return __vmArm();
}
`;
{
const {ctx}=boot(8);
const run=e=>vm.runInContext(SBOX_HELPERS+'\n'+e,ctx,{timeout:600000});

// ── ② 左臂朝向: 同一动作态下 修后 vs 旧字面量 的三点对照 ─────────
section('② 左臂朝向 (真 three; 修后比旧字面量/关归位对照)');
const CASES=[
 {n:'取弹药 (grab · 补给箱/弹药箱)',key:'kar98',st:'grab',k:0.5,lg:'grab'},
 {n:'火箭筒换弹 (bazooka reload)',key:'bazooka',st:'reload',k:0.55,lg:'rocketreload'},
 {n:'包扎 (bandage)',key:'kar98',st:'bandage',k:0.5,lg:'bandage'},
];
for(const c of CASES){
 const fix=run(`JSON.stringify(__vmPose(${JSON.stringify(c.key)},${JSON.stringify(c.st)},${c.k},'fixed'))`);
 const F=JSON.parse(fix);
 const lgRaw=run(`JSON.stringify(__vmPose(${JSON.stringify(c.key)},${JSON.stringify(c.st)},${c.k},'legacy'))`);
 const L=JSON.parse(lgRaw);
 const dPalm=Math.max(...[0,1,2].map(i=>Math.abs(F.pl[i]-L.pl[i])));
 assert(`② ${c.n}: 左臂 rotY 落在合法带 [-1.05,-0.6]`,
  F.ry<=-0.6&&F.ry>=-1.05,`rotY=${F.ry.toFixed(3)} (旧字面量 ${L.ry.toFixed(3)})`);
 assert(`② ${c.n}: 袖管肩端在掌心**左侧** (不再像长在右肩)`,
  F.sl[0]<F.pa[0],`肩端 x=${F.sl[0].toFixed(3)} < 掌心 x=${F.pa[0].toFixed(3)}`);
 assert(`② ${c.n}: 袖管肩端出到画面左半 (x<0) —— 旧写法在右半 (x>0)`,
  F.sl[0]<0&&L.sl[0]>0,`修后 ${F.sl[0].toFixed(3)} vs 旧 ${L.sl[0].toFixed(3)}`);
 assert(`② ${c.n}: 掌心落点逐位不变 (手不从道具上滑走)`,
  dPalm<1e-9,`父坐标系最大偏差 ${dPalm.toExponential(2)}m  掌心=(${F.pa.map(v=>v.toFixed(3)).join(',')})`);
}
// ②c 包扎右臂归位: 肩端必须在画面右半 (x>0, 绝不再偏左/负数), rotY 落在合法正角带 [+0.60, +0.90]
{
 const bF=JSON.parse(run(`JSON.stringify(__vmPose('kar98','bandage',0.5,'fixed'))`));
 assert('②c 包扎右臂: 袖管肩端出到画面右半 (x>0, 不再扎根左肩)',
  bF.slR[0]>0, `肩端 x=${bF.slR[0].toFixed(3)}`);
 assert('②c 包扎右臂: rotY 落在合法正角带 [+0.60, +0.90] (指向右下方)',
  bF.ryR>=0.60&&bF.ryR<=0.90, `rotY=${bF.ryR.toFixed(3)}`);
}
// ②b 左下置弹匣的**物理**换匣 (BAR / 百式): 这条路径的位姿是 vmHoldPose 解算的 (没有旧字面量可对照),
//    判据 = 逐相位袖管都在左半 + 掌心与"关掉归位"逐位一致 (页内阴性对照证明它本来真的在右半)。
for(const w of ['bar','type100']){
 let worst=-9, worstK=0, dMax=0, raw=[];
 for(const k of [0.15,0.3,0.5,0.7,0.9]){
  const F=JSON.parse(run(`JSON.stringify(__vmPose(${JSON.stringify(w)},'reload',${k},'fixed'))`));
  const U=JSON.parse(run(`JSON.stringify(__vmPose(${JSON.stringify(w)},'reload',${k},'snapoff'))`));
  const d=Math.max(...[0,1,2].map(i=>Math.abs(F.pl[i]-U.pl[i])));
  if(F.sl[0]>worst){ worst=F.sl[0]; worstK=k; }
  dMax=Math.max(dMax,d); raw.push(`k=${k}:修后${F.sl[0].toFixed(3)}/关归位${U.sl[0].toFixed(3)}`);
 }
 const U0=JSON.parse(run(`JSON.stringify(__vmPose(${JSON.stringify(w)},'reload',0.3,'snapoff'))`));
 assert(`②b ${w} 物理换匣: 逐相位 (0.15/0.3/0.5/0.7/0.9) 袖管都在画面左半`,
  worst<0,`最差相位 k=${worstK} 肩端 x=${worst.toFixed(3)}  ${raw.join('  ')}`);
 assert(`②b ${w} 物理换匣: 关掉归位后袖管确实在画面右半 (阴性对照, 证明判据非空转)`,
  U0.sl[0]>0,`关归位 k=0.3 肩端 x=${U0.sl[0].toFixed(3)}`);
 assert(`②b ${w} 物理换匣: 掌心落点逐位不变 (归位只转袖管不动手)`,
  dMax<1e-9,`父坐标系最大偏差 ${dMax.toExponential(2)}m`);
}
// 默认握位回归: 未覆盖时 (vmEquip 后 positionHands) 左臂仍应是负角基准
{
 const def=JSON.parse(run(`(()=>{ vmEquip('kar98',0); player.curW={key:'kar98',def:WPN_DEFS['kar98'],mag:5,reserve:50};
  player.ads=false; player.sprinting=false; player.nadeHeld=false; player.bandaging=0;
  for(let i=0;i<8;i++) updateViewModel(1/60,player); return JSON.stringify(__vmArm()); })()`));
 assert('② 默认握位左臂仍是负角 (2026-10-05 的修不被本批改坏)',
  def.ry<=-0.6&&def.ry>=-1.05&&def.sl[0]<0,`rotY=${def.ry.toFixed(3)} 肩端 x=${def.sl[0].toFixed(3)}`);
}

// ── ③ 读条: 互斥打断 + 取消 (真 updatePlayer 推帧) ───────────────
section('③ 读条互斥与取消 (真 updatePlayer 推帧)');
const CLEARSPOT=`(()=>{ let spot=null;
for(let i=0;i<900&&!spot;i++){
const x=player.pos.x+(Math.random()*160-80), z=player.pos.z+(Math.random()*160-80);
const gh=heightAt(x,z);
if(waterYAt(x,z)>-1e8) continue;
if(Math.abs(gh-heightAt(x+6,z))>0.35||Math.abs(gh-heightAt(x,z+6))>0.35) continue;
let blocked=false;
for(let a=0;a<8;a++){ const dx=Math.sin(a*Math.PI/4), dz=Math.cos(a*Math.PI/4);
if(raycastWorld(V3(x,gh+1.2,z),V3(dx,0,dz),10)){ blocked=true; break; } }
if(!blocked) spot={x,z,gh};
} return spot; })()`;

// ③-1 读条中 F 取弹药抢走 VM.state ⇒ 下一帧按"被打断"收账, 不留模型 + 不回血
const steal=run(`(()=>{ const out={};
const spot=${CLEARSPOT}; if(!spot) return {noSpot:true};
window.__pops=[]; showScorePop=t=>{window.__pops.push(t);};
vmEquip('kar98',0);
const p=player;
p.pos.set(spot.x,spot.gh,spot.z); p.vel.set(0,0,0); p.alive=true; p.deployed=true; p.spectator=false;
p.hp=50; p.bandages=4; p.crouch=false; p.prone=false; p.ads=false; p.braced=false;
p.onGround=true; p.onVehicle=null; p.onMG=null; p.onAT=null; p.onAA=null; p.onMortar=null; p.onBattery=null;
p.loiter=null; p.grabAction=null; p.useCast=null; p.pendingBuild=null; p.chute=false; p.flying=false;
p.sprinting=false; p.leanT=0; p.landDip=0; p.stamina=1; p.suppressV=0; p.bloom=0; p.fireT=0;
p.lastDmgT=nowT;   // 关掉"脱战自然回血" (否则 hpGain 里混进 4HP/s 的呼吸回血, 判据不干净)
p.team=0; p.nadeHeld=false;
// 读条走到中段 (nt≈0.4): 绷带卷要 nt>0.14 才显形 —— 这也正是"读条被打断"的真实时刻
const mid=BANDAGE_T*0.4;
p.bandaging=BANDAGE_T-mid; VM.state='bandage'; VM.stateT=mid; VM.stateDur=BANDAGE_T;
for(let i=0;i<4;i++) updateViewModel(1/60,p);
out.modelBefore=!!(VM.bandageM&&VM.bandageM.visible);
out.wrapBefore=!!(VM.arms.L.userData.wrap&&VM.arms.L.userData.wrap.visible);
out.busyIdle=p.readBarBusy();                      // 无别人抢 ⇒ false
// 模拟 tryInteract 的弹药箱分支 (真代码就是这么写的): 抢 VM.state 但不碰 bandaging
p.grabAction={kind:'ammo',crate:{x:0,z:0}};
VM.state='grab'; VM.stateT=0; VM.stateDur=0.85; vmSndFlags={};
out.busyStolen=p.readBarBusy();                    // 被抢 ⇒ true
const hp0=p.hp;
let err='';
for(let i=0;i<40;i++){ try{ updatePlayer(1/60,1/60); }catch(ex){ err=ex.message; break; } }
out.err=err;
out.bandaging=+p.bandaging.toFixed(3);
out.hpGain=+(p.hp-hp0).toFixed(2);
out.bandLeft=p.bandages;
out.modelAfter=!!(VM.bandageM&&VM.bandageM.visible);
out.wrapAfter=!!(VM.arms.L.userData.wrap&&VM.arms.L.userData.wrap.visible);
out.state=VM.state;
out.pops=window.__pops.slice();
return out; })()`);
assert('③-1 沙箱找到净空场地 (判据非空转)',steal&&!steal.noSpot);
if(steal&&!steal.noSpot){
 assert('③-1 包扎读条中绷带卷 + 缠臂环确实在手上 (取证前提)',steal.modelBefore===true&&steal.wrapBefore===true);
 assert('③-1 无别人抢时 readBarBusy()=false (闸门不会误伤自己的读条)',steal.busyIdle===false);
 assert('③-1 被取弹药抢走 VM.state 后 readBarBusy()=true',steal.busyStolen===true);
 assert('③-1 真 updatePlayer 推帧全程无异常',steal.err==='',steal.err||'ok');
 assert('③-1 读条按"被打断"收账 (bandaging 归零, 不再一路 tick 到满)',steal.bandaging===0,`bandaging=${steal.bandaging}`);
 assert('③-1 被打断**不回血也不扣绷带** (没白拿 45 点)',steal.hpGain===0&&steal.bandLeft===4,`hp+${steal.hpGain} 绷带 ${steal.bandLeft}/4`);
 assert('③-1 绷带卷已收起 (无模型滞留)',steal.modelAfter===false);
 assert('③-1 缠臂环已收起 (无模型滞留)',steal.wrapAfter===false);
 assert('③-1 抢走状态的**新动作没被误杀** (VM.state 仍是 grab)',steal.state==='grab',`state=${steal.state}`);
 assert('③-1 打断文案只播一次且是"包扎被打断!"',
  steal.pops.filter(t=>t==='包扎被打断!').length===1,JSON.stringify(steal.pops));
}

// ③-2 cancelReadBar 单源: 三条读条各收各的账 + 模型层一起收; 不误伤刚上手的新动作
const canc=run(`(()=>{ const out={};
vmEquip('kar98',0);
const p=player; p.alive=true; p.isPlayer=true; p.hp=50; p.bandages=4;
window.__pops=[]; showScorePop=t=>{window.__pops.push(t);};
p.bandaging=BANDAGE_T; VM.state='bandage'; VM.stateT=0; VM.stateDur=BANDAGE_T;
for(let i=0;i<4;i++) updateViewModel(1/60,p);
out.activeBand=p.readBarActive();
const hit=p.cancelReadBar('包扎已取消');
out.hit=hit; out.bandaging=p.bandaging; out.state=VM.state;
out.model=!!(VM.bandageM&&VM.bandageM.visible); out.wrap=!!(VM.arms.L.userData.wrap&&VM.arms.L.userData.wrap.visible);
out.pops=window.__pops.slice();
// 刚起的新动作 (VM.state='grab') 不该被收尾函数顺手清掉
VM.state='grab'; VM.stateT=0; VM.stateDur=0.85; p.grabAction={kind:'ammo',crate:{x:0,z:0}};
p.cancelReadBar('已取消');
out.grabKept=(VM.state==='grab'&&!!p.grabAction);
p.grabAction=null; VM.state='idle';
// 持刀态: 左臂整条被藏 + 刀可见 ⇒ 取消必须还回来
VM.state='melee'; VM.stateT=0; VM.stateDur=0.5; VM.knifeM.visible=true; VM.arms.L.visible=false;
p.cancelReadBar('已取消');
out.melee=(VM.state==='idle'&&VM.arms.L.visible===true&&VM.knifeM.visible===false);
// 拆除读条 (账在 06-engineering 的 stopDemolish)
p.demolish={b:{type:'sandbag'},t:0.5,mortar:false};
out.activeDem=p.readBarActive(); p.cancelReadBar('拆除已取消'); out.demolish=(p.demolish===null);
// 前摇 (账在 20-player 的 useCast, 占位要交还)
const g={user:p}; p.useCast={kind:'mg',g:g,t:0.3,dur:EM_CAST_DUR};
out.activeCast=p.readBarActive(); p.cancelReadBar('使用已取消');
out.cast=(p.useCast===null&&g.user===null);
out.idleActive=p.readBarActive();
out.popsAll=window.__pops.slice();
return out; })()`);
assert('③-2 包扎/拆除/前摇三条都被 readBarActive 认 (取消按钮的显隐前提)',
 canc.activeBand===true&&canc.activeDem===true&&canc.activeCast===true&&canc.idleActive===false);
assert('③-2 取消包扎: 计时归零 + VM 回 idle + 绷带卷/缠臂环收起',
 canc.hit===true&&canc.bandaging===0&&canc.state==='idle'&&canc.model===false&&canc.wrap===false);
assert('③-2 取消包扎播"包扎已取消" (文案走同一条出口)',canc.pops.includes('包扎已取消'),JSON.stringify(canc.pops));
assert('③-2 取消不误伤**刚上手的新动作** (VM.state=grab 与 grabAction 保住)',canc.grabKept===true);
assert('③-2 取消持刀态: 左臂显隐还回来 + 刀收起',canc.melee===true);
assert('③-2 取消拆除读条: demolish 走 stopDemolish 单源清空',canc.demolish===true);
assert('③-2 取消前摇: useCast 清空且**炮位占位交还** (g.user=null)',canc.cast===true);

// ③-3 受击打断也走同一个出口 (旧版只清字段 ⇒ 模型滞留)
const dmg=run(`(()=>{ const out={};
vmEquip('kar98',0);
const p=player; p.alive=true; p.isPlayer=true; p.hp=80; p.spectator=false; p.bandages=4;
window.__pops=[]; showScorePop=t=>{window.__pops.push(t);};
p.bandaging=BANDAGE_T; VM.state='bandage'; VM.stateT=0; VM.stateDur=BANDAGE_T;
for(let i=0;i<4;i++) updateViewModel(1/60,p);
out.before=!!(VM.bandageM&&VM.bandageM.visible);
p.damage(26,null,false);   // ★2026-10-25 反馈轮②: 受击打断门槛=单次>25, 7 不再打断
out.bandaging=p.bandaging; out.state=VM.state; out.after=!!(VM.bandageM&&VM.bandageM.visible);
out.wrap=!!(VM.arms.L.userData.wrap&&VM.arms.L.userData.wrap.visible);
out.pops=window.__pops.slice();
return out; })()`);
assert('③-3 中弹打断: bandaging 归零 + VM 回 idle + 模型收起 (与按键取消同源)',
 dmg.before===true&&dmg.bandaging===0&&dmg.state==='idle'&&dmg.after===false&&dmg.wrap===false);
assert('③-3 中弹打断文案仍是"包扎被打断!"',dmg.pops.includes('包扎被打断!'),JSON.stringify(dmg.pops));
}

// ── 汇总 ──
console.log(`\n${NEG?'[阴性对照] ':''}验收: ${OK.length} 通过 / ${BAD.length} 失败`);
if(BAD.length) console.log('失败项:\n  - '+BAD.join('\n  - '));
process.exit(BAD.length?1:0);
