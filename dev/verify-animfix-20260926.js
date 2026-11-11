// ─────────────────────────────────────────────────────────────
// dev/verify-animfix-20260926.js —— 2026-09-26 动画/模型缺陷批验收
//
// 用法: node dev/verify-animfix-20260926.js [--neg]
//   --neg = 阴性对照: 装载前把本批的修复点按文本还原成旧写法, 同一批判据必须报红
//          (证明判据真的在测这些修复, 而不是"改前改后都绿"的空断言)
//
// 覆盖 (与各文件内的 "2026-09-26 A*/B*" 注释逐条对应):
//   A1 匍匐挂点随俯角 (11-soldiers.gunMountOf / 14-bots / 20-player 三处同源)
//   A2 玩家蹲/趴腿脚穿地 (legIKPose 单源, 与 Bot 同值)
//   A3 Bot 站姿腿分支无阻尼 (站/蹲合并按骨盆高插值)
//   A4 布娃娃 base 缩放只作用位置 (站位表同源 ⇒ 七条约束初始误差 0)
//   A5 坦克履带花纹 UV 轴/密度/滚动速率
//   A6 反坦克炮俯角下限 (炮口不再入地)          A9 高射炮操作手站位 (退出炮口扫掠圈)
//   A7 射击孔/窗的 ht (楣上段不再被吃掉)        A8 基地碉堡朝向
//   A10 卡车轮速 / B16 卡车地形姿态             A11 机列机鼻锥半径方向
//   A12 舰船舵节点登记 (字符串吞对象)           B1 架枪锚定 oz 符号
//   B2/B3 换弹左臂 / 开火后坐叠在 IK 之后       B4 棕榈叶长轴 / B5 乌篷鼓面
//   B6 首上板可见 / B7 履带贴地 / B8 座圈通缝 / B9 残血冒烟口
//
// 口径: ① 源码防回退断言 (字符串) ② 沙箱行为断言 (真 three + 真 cannon, 用游戏自己的接口取证)
// ─────────────────────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const NEG=process.argv.includes('--neg');
const OK=[],BAD=[];
function assert(name,cond,detail){ (cond?OK:BAD).push(name); console.log(`  ${cond?'✓':'✗'} ${name}${detail?'  '+detail:''}`); }
function section(t){ console.log('\n══ '+t+' ══'); }
const SRC=f=>fs.readFileSync(path.join(root,f),'utf8');

// ── 阴性对照: 把修复按文本还原 (锚点用修后原文; 找不到就报错, 防止"锚点漂移后静默通过") ──
const PATCHES=[
 ['js/11-soldiers.js','const p=pp||0;\nif(p<=GUN_MOUNT_BLEND0) return st;','const p=pp||0;\nif(true) return st;'],
 ['js/11-soldiers.js','function legIKPose(hp,fy,dz,kneeUp){','function legIKPose(hp,fy,dz,kneeUp){ return null;'],
 ['js/14-bots.js','m.gunG.position.x=dampF(m.gunG.position.x,mo.x,10,dt);','m.gunG.position.x=mo.x;'],
 ['js/20-player.js',"const handKL=(reloading&&!sprint&&!prone)?0:handK;",'const handKL=handK;'],
 ['js/10-viewmodel.js','oz+=(1-Math.cos(rel))*0.45*pin;','oz+=(Math.cos(rel)-1)*0.45*pin;'],
 ['js/12-ragdolls.js','const RAG_POSE=bot.prone?{h:0.22,th:1.50}:(bot.crouch?{h:0.60,th:0.95}:{h:0.97,th:0.0});',
  'const RAG_POSE=(bot.prone?{h:0.22*0.35,th:0}:(bot.crouch?{h:0.97*0.75,th:0}:{h:0.97,th:0}));'],
 ['js/15-vehicles.js','const TB_GAP=0.08;','const TB_GAP=0.14;'],
 ['js/15-vehicles.js','const ringY=roof;','const ringY=roof+0.05;'],
 ['js/15-vehicles.js','const trkGeo=trackBandGeo(S);','const trkGeo=new THREE.BoxGeometry(S.trkW,0.6,L+0.25);'],
 ['js/15-vehicles.js','const whW=trkW-0.02, whY=whR+TB_GAP;','const whW=trkW+0.02, whY=whR+TB_GAP;'],
 ['js/15-vehicles.js','tankBuildSkirt(g,S,M);','g.add(new THREE.Mesh(new THREE.BoxGeometry(0.06,0.8,S.L),M.tone));'],
 ['js/15-vehicles.js','T.trackTex.repeat.set(1,1);\nT.trackTex.rotation=0;','T.trackTex.repeat.set(1,8);\nT.trackTex.rotation=Math.PI/2;'],
 ['js/15-vehicles.js','this.trackTex.offset.y-=this.vel*dt/(this.trackTileLen||1.5);','this.trackTex.offset.y+=this.vel*dt/(this.trackTileLen||1.5);'],
 ['js/15b-trucks.js','const wr=(w.geometry&&w.geometry.parameters&&w.geometry.parameters.radiusTop)||0.45; w.rotation.x+=this.vel*dt/wr;',
  'w.rotation.x+=this.vel*dt*1.6;'],
 ['js/16-aircraft.js','new THREE.CylinderGeometry(FR*0.88,FR*0.46,FL*0.18,10)','new THREE.CylinderGeometry(FR*0.46,FR*0.88,FL*0.18,10)'],
 ['js/15e-navmodels.js',"const rud=nmBox(g,W*0.05,H*0.14,L*0.02,M.dark,0,wl*0.5,freeRear-0.01); rud.name='nmRudder';\nR.nodes.rudder=rud;",
  "R.nodes.rudder=nmBox(g,W*0.05,H*0.14,L*0.02,M.dark,0,wl*0.5,freeRear-0.01).name='nmRudder';"],
 ['js/05a-buildings.js',"ops:[{c:0,w:1.5,b:1.05,h:0.5,type:'slit'}]","ops:[{c:0,w:1.5,b:1.05,h:0.5,ht:H,type:'slit'}]"],
 ['js/05c-layouts.js','Math.atan2(sgn*100,30)','Math.atan2(-sgn*100,30)'],
 ['js/05b-props.js','frond.rotation.set(p+HPI,a,0);','frond.rotation.set(p,a,0);'],
 ['js/05a-buildings.js','cover.rotation.set(0,ry+Math.PI,HPI);',
  "cover.rotation.y=ry+HPI/2;\ncover.rotation.z=0;\ncover.rotation.x=HPI;"],
 ['js/00-config.js','const AT_PITCH_DOWN=0.30;','const AT_PITCH_DOWN=0.55;'],
 ['js/00-config.js','const AA_CREW_DIST=1.95;','const AA_CREW_DIST=0.9;'],
];
const PATCH_MAP={};
if(NEG) for(const [f,from,to] of PATCHES){
  const s=PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f);
  if(s.indexOf(from)<0) throw new Error('阴性对照锚点未找到: '+f+' :: '+from.slice(0,60));
  PATCH_MAP[f]=s.split(from).join(to);
}
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f));

// ── ① 源码防回退 ──────────────────────────────────────────────
section('① 源码防回退 (修好的写法在 / 旧写法不在)');
{
const s11=srcOf('js/11-soldiers.js');
assert('11: 匍匐挂点表就位 (GUN_MOUNT_PRONE + 按俯角混合)',s11.includes('const GUN_MOUNT_PRONE=')&&s11.includes('function gunMountOf(kind,pp)'));
assert('11: 腿部反解单源 (legIKPose + LEG_L1/L2)',s11.includes('function legIKPose(')&&s11.includes('const LEG_L1=0.46, LEG_L2=0.48'));
assert('11: 四个挂枪 API 全部带 pp',s11.includes('function gunGripPoint(kind,rx,ry,rz,pp)')&&s11.includes('function gunAxisPoint(kind,t,rx,ry,rz,pp)')&&s11.includes('const mo=gunMountOf(kind,pp)'));

const s14=srcOf('js/14-bots.js');
assert('14: 腿反解改为薄转发 (公式只有一份)',s14.includes('legIK(hp,fy,dz,kneeUp){ return legIKPose(hp,fy,dz,kneeUp); }')&&!s14.includes('const a=0.46,b=0.48;'));
assert('14: 站/蹲合并为一条 (无第二个写者)',s14.includes('const kw=clamp((0.94-hpNow)/(0.94-0.60),0,1)')&&!s14.includes('} else if(crouch){\nm.legL.hip.rotation.x'));
assert('14: 站姿腿写回全部过 dampF',!s14.includes('m.legL.hip.rotation.x=S*sw-torsoX*0.6;'));
assert('14: 锚点传 pp + 挂点按帧写',s14.includes('gunGripPoint(this.gunKind,gunX_t,gunY_t,gunZ_t,pp)')&&s14.includes('m.gunG.position.x=dampF(m.gunG.position.x,mo.x,10,dt)'));
assert('14: 开火后坐叠在 IK 之后',s14.indexOf('if(handKL>0){ shL=lerp')>0&&s14.indexOf('shR+=Math.sin(m.armR.sh.userData.swing*16)*0.6;')>s14.indexOf('if(handKL>0){ shL=lerp'));

const s20=srcOf('js/20-player.js');
assert('20: 蹲/趴腿走 legIKPose (旧写死值已删)',s20.includes('const LL=legIKPose(hpNow,0.11+')&&!s20.includes('av.legL.hip.rotation.x=dampF(av.legL.hip.rotation.x,-1.05+S*sw*0.5,10,dt);'));
assert('20: 换弹左臂单独取 0 (handKL)',s20.includes('const handKL=(reloading&&!sprint&&!prone)?0:handK;')&&s20.includes('if(handKL>0.001&&typeof gunForePoint'));
assert('20: 开火后坐叠在 IK 之后',s20.indexOf('shR+=fireK*0.62')>s20.indexOf('if(handKL>0.001&&typeof gunForePoint'));
assert('20: 挂点按俯角取 + 匍匐枪身角与 Bot 同式',s20.includes("gunMountOf(av._gunKind||'rifle',pp)")&&s20.includes('let gunX=prone?gunPitch-pp:gunPitch;'));

const s12=srcOf('js/12-ragdolls.js');
assert('12: base 缩放已删 + 站位表 RAG_POSE/ST 就位',!s12.includes('const base=bot.prone?0.35')&&s12.includes('const RAG_POSE=bot.prone?{h:0.22,th:1.50}')&&s12.includes('const ST={torso:0.39'));
assert('12: 死代码 RAG.geo / geoKey 已清',!s12.includes('RAG.geo={')&&!s12.includes('function mkPart(geoKey'));

const s15=srcOf('js/15-vehicles.js');
assert('15: 履带 = 绕轮的带环 (trackBandGeo: 闭合轮廓 + 4 面带), 实心盒写法已退场',
 s15.includes('function trackBandGeo(')&&s15.includes('function tbContour(')&&s15.includes('const trkGeo=trackBandGeo(S);')
 &&!s15.includes('trackBoxPrep(')&&!s15.includes('new THREE.BoxGeometry(S.trkW,S.trkH,L+0.25)'));
assert('15: 花纹沿环向烘焙进 UV (纹理矩阵退出) + 每贴长度由环长现算 + 滚动符号与 UV 方向同向',
 s15.includes('T.trackTex.repeat.set(1,1);')&&s15.includes('T.trackTex.rotation=0;')
 &&s15.includes('T.trackTileLen=trkGeo.userData.tileLen;')
 &&s15.includes('offset.y-=this.vel*dt/(this.trackTileLen||1.5)')&&!s15.includes('offset.y-=this.vel*dt*0.55'));
assert('15: 负重轮在带环之内 (轮宽 < 带宽, 轮心 = 履带中心线, 不再外移穿模)',
 s15.includes('const whW=trkW-0.02, whY=whR+TB_GAP;')&&s15.includes('wh.position.set(sx*S.trkSx,S.whY,lz);')
 &&!s15.includes('WH_OUT')&&!s15.includes('whSx'));
assert('15: 带环外底面贴地 = TB_GAP-TB_TH = 0.03 (与旧履带盒的地面间隙逐位一致)',
 s15.includes('const TB_GAP=0.08;')&&s15.includes('const TB_TH=0.05;')&&s15.includes('const TB_TOP_GAP=0.05;'));
assert('15: 侧裙板 = 独立分片单网格挂在翼板外侧 (tankBuildSkirt), 不再贴履带侧面',
 s15.includes('function tankBuildSkirt(')&&s15.includes('tankBuildSkirt(g,S,M);')&&s15.includes("m.name='skirt'"));
assert('15: 座圈坐在车体顶面 (无 5cm 通缝)',s15.includes('const ringY=roof;')&&!s15.includes('const roof=hullY+hullH/2, ringY=roof+0.05'));
assert('15: 车体盒前缘按首上倾角回收',s15.includes('const back=(Math.abs(S.glacis)>0.02)?S.glacisD*Math.sin(Math.abs(S.glacis)):0;'));
assert('15: 残血冒烟取塔顶高度',s15.includes('const sy=this.pos.y+(this.ringY||1.45)+(this.turretH||0.6)*0.92;'));

const s15b=srcOf('js/15b-trucks.js');
assert('15b: 车轮按几何半径 + 地形姿态',s15b.includes('parameters.radiusTop)||0.45; w.rotation.x+=this.vel*dt/wr;')&&s15b.includes("this.grp.rotation.set(this.suspP||0,this.yaw,this.suspR||0);"));

const s16=srcOf('js/16-aircraft.js');
assert('16: 直列机鼻锥半径方向正确 (根粗尖细)',s16.includes('new THREE.CylinderGeometry(FR*0.88,FR*0.46,FL*0.18,10)'));
const s15e=srcOf('js/15e-navmodels.js');
assert('15e: 舰船舵节点登记为对象 (不再被 .name 吞)',s15e.includes('R.nodes.rudder=rud;')&&s15e.includes("rud.name='nmRudder';"));
// 只看代码行 (本文件的修复注释里引用了旧写法, 直接扫原文会命中注释)
const s15eCode=s15e.split(/\r?\n/).filter(l=>!l.trim().startsWith('//')).join('\n');
assert('15e: 无 `=xxx(...).name=` 链式吞对象',!/=\s*nm[A-Za-z]*\([^;]*\)\.name=/.test(s15eCode));

const s5a=srcOf('js/05a-buildings.js');
assert("05a: 射击孔/窗不再传 ht (楣上段恢复)",!s5a.includes("b:1.05,h:0.5,ht:")&&!s5a.includes("b:1.15,h:0.5,ht:FH")&&s5a.includes("b:1.05,h:0.5,type:'slit'"));
assert('05a: 乌篷鼓面朝上 (轴向仍沿船长)',s5a.includes('cover.rotation.set(0,ry+Math.PI,HPI);'));
const s5c=srcOf('js/05c-layouts.js');
assert('05c: 基地碉堡朝向敌军来向',s5c.includes('Math.atan2(sgn*100,30)')&&s5c.indexOf('Math.atan2(-sgn*100,30)')<0);
const s5b=srcOf('js/05b-props.js');
// ★2026-11-01 锚跟走: 棕榈叶性能批起改 InstancedMesh 逐实例矩阵 (frond 逐实例欧拉退役), 下垂不变量
//   同式迁移为矩阵欧拉 _pmE.set(p+HPI, a, 0,'YXZ') —— 叶长轴=实例局部 Y×len, 俯角 p+HPI 绕 X 不变。
assert('05b: 棕榈叶长轴沿下垂方向',s5b.includes("_pmE.set(p+HPI, a, 0, 'YXZ')"));
const s10=srcOf('js/10-viewmodel.js');
assert('10: 架枪锚定 oz 符号正确',s10.includes('oz+=(1-Math.cos(rel))*0.45*pin;')&&!s10.includes('oz+=(Math.cos(rel)-1)*0.45*pin;'));
const scfg=srcOf('js/00-config.js');
assert('config: AT_PITCH_DOWN / AA_CREW_DIST 单源常量',scfg.includes('const AT_PITCH_DOWN=0.30;')&&scfg.includes('const AA_CREW_DIST=1.95;'));
assert('config: 两条常量被两条驱动路径引用',srcOf('js/20a-seats.js').includes('clamp(p.pitch,-AT_PITCH_DOWN,0.6)')&&srcOf('js/14-bots.js').includes('g.z-AA_CREW_DIST'));
}

// ── ② 沙箱行为 (真 three; 只装测量需要的脚本) ─────────────────
section('② 沙箱行为 (真 three.js)');
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
{
const {ctx,T}=boot(8);
const run=e=>vm.runInContext(e,ctx,{timeout:600000});
// A1: 匍匐挂点必须把枪抬到骨盆之上 (旧值在骨盆之下 0.236m ⇒ 枪口入地)
const m1=run("JSON.stringify(gunMountOf('rifle',1.5))");
const M=JSON.parse(m1);
const dy=M.y*Math.cos(1.5)-M.z*Math.sin(1.5);
assert('A1 匍匐挂点在世界系高于骨盆 (dy>0.05m)',dy>0.05,`实测 dy=${dy.toFixed(4)}m 挂点=${m1}`);
assert('A1 站姿挂点逐位不变 (零漂移)',run("JSON.stringify(gunMountOf('rifle'))")==='{"x":-0.15,"y":0.33,"z":0.26}');
assert('A1 蹲姿挂点仍在站姿档 (插值权 0)',run("JSON.stringify(gunMountOf('rifle',0.14))")==='{"x":-0.15,"y":0.33,"z":0.26}');
// A2/A3: 玩家与 Bot 的蹲/站腿反解必须同值 (单源), 且反解结果随骨盆高变化
const leg=run("JSON.stringify([legIKPose(0.6,0.13,0.16,false),legIKPose(0.94,0.13,0.16,false)])");
const LG=JSON.parse(leg);
assert('A2 legIKPose 可用且随骨盆高变化',LG[0]&&LG[1]&&Math.abs(LG[0].knee-LG[1].knee)>0.5,leg);
// A6: 俯角极限下炮口仍在地面之上 (轴心 0.85, 炮口前缘 2.69)
const muz=0.85-Math.sin(run('AT_PITCH_DOWN'))*2.69;
assert('A6 炮口在俯角极限处仍高于地面',muz>0.02,`炮口高 ${muz.toFixed(3)}m`);
// A9: 操作手站位在炮口扫掠半径 (1.7m) 之外
const aaR=0.85+1.7/2;
assert('A9 高炮操作手在炮口扫掠圈外',run('AA_CREW_DIST')>aaR,`站位 ${run('AA_CREW_DIST')}m > 扫掠 ${aaR}m`);
}
// ── 汇总 ──
console.log(`\n${NEG?'[阴性对照] ':''}验收: ${OK.length} 通过 / ${BAD.length} 失败`);
if(BAD.length) console.log('失败项:\n  - '+BAD.join('\n  - '));
process.exit(BAD.length?1:0);
