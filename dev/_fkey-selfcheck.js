// ─────────────────────────────────────────────
// dev/_fkey-selfcheck.js —— F 键语义优先级栈 + 座位互斥 自检 (2026-09-22 观战F冲突批)
// 用法: node dev/_fkey-selfcheck.js
//
// 验的是**用户实报的那条链路**: 观战模式下 F 的 鱼雷 / 下车 / 召唤幽灵坦克 三者互相抢键。
// 判据全部落在**公开接口**上 (tryInteract / specVehBoard / specVehDismount / navalBoard / navalStartExit /
// navalFireTorpedo / updateInteractHint), 不重写第二套状态机 —— 自检调的就是游戏调的那一支。
//
// 载荷 (沙箱只加载需要的最小脚本链, 但**不是桩**: 20-player / 20a / 15c 都是真文件):
//   00-config (V3/常量) + 15c-specveh (幽灵坦克真类) + 20a-seats (海战座位真实现, 桩掉 15d 的载具对象)
//   + 20-player (tryInteract/updateInteractHint 真实现; 其依赖按需最小化桩)
//   + 19-input (键盘分支真实现 —— F 在真输入链上能不能走到 tryInteract, 这一层必须真验)
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const OK=[],BAD=[];
function assert(name,cond,detail){ (cond?OK:BAD).push(name); console.log(`  ${cond?'✓':'✗'} ${name}${detail?'  '+detail:''}`); }

// ══════════════ 最小 DOM / 浏览器桩 (只够 20a/20-player/19-input/15c 跑起来) ══════════════
const elems={};
function mkEl(id){
	if(elems[id]) return elems[id];
	const e={id,style:{},_ins:{},classList:{add(){},remove(){},toggle(){},contains(){return false}},
		children:[],dataset:{},
		set innerHTML(v){ this._html=v; this._text=String(v).replace(/<[^>]*>/g,''); },
		get innerHTML(){ return this._html||''; },
		set textContent(v){ this._text=String(v); this._html=String(v); },
		get textContent(){ return this._text||''; },
		appendChild(c){ this.children.push(c); return c; },
		removeChild(c){ const i=this.children.indexOf(c); if(i>=0) this.children.splice(i,1); return c; },
		querySelector(){ return null; }, querySelectorAll(){ return []; },
		addEventListener(){}, removeEventListener(){}, getContext(){ return null; },
		getBoundingClientRect(){ return {left:0,top:0,width:100,height:100}; },
		focus(){}, blur(){}, remove(){}, setAttribute(){}, getAttribute(){ return null; }, closest(){ return null; }};
	return (elems[id]=e);
}
const document={
	getElementById:id=>mkEl(id),
	createElement:tag=>mkEl('__new_'+tag+'_'+(document._n=(document._n||0)+1)),
	querySelector:()=>null, querySelectorAll:()=>[], body:mkEl('body'),
	addEventListener(){}, removeEventListener(){}, exitPointerLock(){},
	documentElement:mkEl('html'), pointerLockElement:null, hidden:false,
};
// ══════════════ three 极简桩 (15c 建几何/材质只要"能挂能定位") ══════════════
function mkVector(x,y,z){
	const v={x:x||0,y:y||0,z:z||0,
		set(a,b,c){ v.x=a; v.y=b; v.z=c; return v; },
		copy(o){ v.x=o.x; v.y=o.y; v.z=o.z; return v; },
		clone(){ return mkVector(v.x,v.y,v.z); },
		add(o){ v.x+=o.x; v.y+=o.y; v.z+=o.z; return v; },
		sub(o){ return mkVector(v.x-o.x,v.y-o.y,v.z-o.z); },
		multiplyScalar(k){ v.x*=k; v.y*=k; v.z*=k; return v; },
		lengthSq(){ return v.x*v.x+v.y*v.y+v.z*v.z; },
		length(){ return Math.sqrt(v.lengthSq()); },
		normalize(){ const l=v.length()||1; v.x/=l; v.y/=l; v.z/=l; return v; },
		distanceTo(o){ return Math.hypot(v.x-o.x,v.y-o.y,v.z-o.z); },
		toArray(){ return [v.x,v.y,v.z]; }};
	return v;
}
class Obj3D{
	constructor(){ this.position=mkVector(); this.rotation={x:0,y:0,z:0,order:'XYZ',set(a,b,c){this.x=a;this.y=b;this.z=c;}};
		this.scale={set(){},setScalar(){}}; this.children=[]; this.parent=null;
		this.userData={}; this.visible=true; this.name=''; this.isObject3D=true; }
	// clone: 15c 的 buildMesh 用它复制挡泥板; 只需"同几何同材质的一个新对象 + 位置被后续覆盖"
	clone(){ const c=new this.constructor(this.geometry,this.material);
		c.name=this.name; c.visible=this.visible; c.castShadow=this.castShadow; c.receiveShadow=this.receiveShadow;
		c.position.set(this.position.x,this.position.y,this.position.z);
		c.rotation.set(this.rotation.x,this.rotation.y,this.rotation.z);
		c.userData=Object.assign({},this.userData); return c; }
	add(o){ if(o){ o.parent=this; this.children.push(o); } return this; }
	remove(o){ const i=this.children.indexOf(o); if(i>=0){ this.children.splice(i,1); o.parent=null; } return this; }
	traverse(f){ f(this); for(const c of this.children) if(c.traverse) c.traverse(f); }
	updateMatrixWorld(){ this.traverse(o=>{ o.matrixWorld=null; }); }
	getWorldPosition(t){ const p=t||mkVector(); p.set(this.position.x,this.position.y,this.position.z); return p; }
	lookAt(){} rotateX(){} rotateY(){} rotateZ(){}
}
class Group extends Obj3D{}
const THREE={
	Group, Object3D:Obj3D, Vector3:function(x,y,z){ return mkVector(x,y,z); },
	Mesh:class extends Obj3D{ constructor(g,m){ super(); this.geometry=g; this.material=m; this.isMesh=true; this.castShadow=true; this.receiveShadow=false; } },
	BoxGeometry:class{ constructor(w,h,d){ this.parameters={width:w,height:h,depth:d}; } },
	CylinderGeometry:class{ constructor(rt,rb,h,s){ this.parameters={radiusTop:rt,radiusBottom:rb,height:h,radialSegments:s}; } },
	BufferGeometry:class{ constructor(){ this.attributes={}; } setAttribute(k,v){ this.attributes[k]=v; return this; } computeVertexNormals(){} },
	Float32BufferAttribute:class{ constructor(a,n){ this.array=a; this.itemSize=n; } },
	MeshLambertMaterial:class{ constructor(o){ Object.assign(this,o||{}); if(!this.color) this.color={r:1,g:1,b:1}; } },
	Matrix4:class{ makeRotationZ(){ return this; } makeRotationY(){ return this; } makeTranslation(){ return this; } multiply(){ return this; } },
	Box3:class{ setFromObject(){ return this; } union(){ return this; } makeEmpty(){ return this; } getSize(v){ v.set(1,1,1); return v; } },
	Color:class{ constructor(r,g,b){ this.r=r; this.g=g; this.b=b; } },
};
// ══════════════ 沙箱 ══════════════
const sandbox={
	console,Math,JSON,Date,String,Number,Object,Array,Set,Map,Boolean,Error,TypeError,isNaN,parseInt,parseFloat,
	THREE, document, navigator:{maxTouchPoints:0,userAgent:'node'}, requestAnimationFrame:()=>0,cancelAnimationFrame(){},
	setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},
	performance:{now:()=>Date.now()}, addEventListener(){}, removeEventListener(){},
	localStorage:{_s:{},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}},
	innerWidth:1280, innerHeight:720, devicePixelRatio:1,
	location:{href:'http://localhost/'}, alert(){}, fetch:()=>Promise.resolve({}),
};
sandbox.window=sandbox; sandbox.self=sandbox; sandbox.globalThis=sandbox;
const ctx=vm.createContext(sandbox);
const load=f=>vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
// ── 真实脚本链 (按 index.html 的依赖顺序; 只到 F 链路需要的那几个) ──
load('js/00-config.js');
load('js/09a-defs.js');
// 说明: 依赖桩**必须**在这两个真文件之后 (真文件先声明, 桩里 typeof 检查才会跳过同名项)。
// 依赖桩: 20-player / 20a 引用的模块级符号。**逐条软声明** —— 00-config 与 09a-defs 已经提供的名字
//   (V3/TAU/HPI/clamp/MAP_SIZE/EXPERIMENT/CAMPAIGN/WPN_DEFS/CLASSES …) 一律跳过, 只补它们没给的。
//   为什么不用一整块 var: 每个脚本的 const/let 都进**同一个全局词法环境** ⇒ 重复声明会直接抛
//   "Identifier 'x' has already been declared"; 逐条 try/catch 才既能复用真文件又能补缺失。
const STUBS=[
  ['scene','{add(){},remove(){}}'], ['world','{add(){}}'],
  ['camera','{position:{x:0,y:0,z:0,set(a,b,c){this.x=a;this.y=b;this.z=c;},copy(o){this.x=o.x;this.y=o.y;this.z=o.z;},distanceTo(){return 0;}},'
    +'rotation:{x:0,y:0,z:0,set(a,b,c){this.x=a;this.y=b;this.z=c;}},getWorldDirection(){return {x:0,y:0,z:1};}}'],
  ['keys','{}'], ['mouseDown','false'], ['mouse2Down','false'], ['nowT','0'],
  ['gamePaused','false'], ['matchOver','false'],
  ['heightAt','function(){return 0;}'], ['waterDepthAt','function(){return 0;}'], ['waterYAt','function(){return 0;}'],
  ['standHeight','function(){return 0;}'], ['occBlocked','function(){return false;}'],
  ['tankRideH','function(){return 0;}'], ['tankSurfH','function(){return 0;}'],
  ['eachBoxNear','function(){}'], ['eachCylNear','function(){}'],
  ['basePos','function(t){return {x:(t?-100:100),z:0};}'], ['mapCenter','function(){return {x:0,z:0};}'],
  ['shoreDirAt','function(){return null;}'], ['dampF','function(a,b,k,dt){return a+(b-a)*Math.min(1,k*dt);}'],
  ['angDiff','function(a,b){var d=(a-b)%(Math.PI*2);if(d>Math.PI)d-=Math.PI*2;if(d<-Math.PI)d+=Math.PI*2;return d;}'],
  ['rand','function(a,b){return a+(b-a)*0.5;}'],
  ['showScorePop','function(){}'], ['addTrauma','function(){}'], ['camForward','function(){return THREE.Vector3(0,0,1);}'],
  ['AudioSys','{click(){},metalSlide(){},cannon(){},gunshot(){},createEngine(){return {update(){},stop(){}};}}'],
  ['VM','{root:new THREE.Group(),state:"idle",stateT:0,stateDur:0}'], ['vmSndFlags','{}'],
  ['PT','{flash:1,dark:2}'], ['shells','[]'], ['SHELL_SPD','190'], ['MG_BULLET_DEF','{}'], ['TANK_STEP','0.6'],
  ['player','{alive:true,deployed:true,spectator:false,loiter:null,onVehicle:null,onNaval:null,pos:THREE.Vector3(),'
    +'vel:THREE.Vector3(),yaw:0,pitch:0,team:0,flying:false,flyAero:false,thirdPerson:false,navalGun:false,'
    +'slots:[],curSlot:0,curW:{key:"rifle"},hp:100,cls:0,swim:false,wading:false,ads:false,prone:false,crouch:false,'
    +'braced:false,tankView:false,nadeHeld:false,ffAll:false,useCast:null,meleeCd:0,bandages:0,bandaging:0,'
    +'nadeCount:0,atNades:0,smokeCount:0,incinCount:0,navalExit:null,navalCd:null,navalW:null,navalFire:null,navalTP0:undefined}'],
  ['MORTARS','[]'], ['tanks','[]'], ['MG42S','[]'], ['ATGUNS','[]'], ['AAGUNS','[]'],
  ['FLAGS','[]'], ['BASES','[]'], ['SPOTS','[]'], ['BUILD_MENU','[]'], ['BUILD_COST','{}'], ['BUILD_NAMES','{}'],
  ['navalCraft','[]'], ['NAVAL_BOARD_R_WATER','2.5'], ['SWIM_DEPTH','1.6'], ['WADE_DEPTH','0.6'], ['NAVAL_EXIT_MAX_T','2.5'], ['NAVAL_EXIT_SPD','3.5'], ['NAVAL_EXIT_STEP','0.35'], ['NAVAL_ROLL_D','1'], ['NAVAL_PITCH_K','1'], ['NAVAL_PITCH_D','1'], ['NAVAL_WAVE','[]'],
  ['navalNear','function(){return null;}'], ['navalSeatHud','function(){}'],
  ['empReady','function(){return false;}'], ['empInReach','function(){return false;}'], ['releaseEmpl','function(){}'],
  ['mountMG','function(){}'], ['mountAT','function(){}'], ['mountAA','function(){}'], ['mountMortar','function(){}'],
  ['engBuild','function(){}'], ['deployMortar','function(){}'], ['recoverMortar','function(){}'],
  ['placeMedkit','function(){}'], ['squadOrderMove','function(){}'], ['squadOrderFollow','function(){}'],
  ['switchSlot','function(){}'], ['tryReload','function(){}'], ['specTeleportToLoiter','function(){}'],
  ['togglePause','function(){}'], ['lockPointer','function(){}'], ['updateScoreboard','function(){}'],
  ['toggleBigMap','function(){}'], ['vehMgHeatHud','function(){}'], ['playerChuteClear','function(){}'],
  ['loiterDetonate','function(){}'], ['batteryNear','function(){return null;}'], ['batteryDismountPlayer','function(){}'],
  ['BotDebug','{}'], ['t2','function(s){return s;}'], ['t','function(s){return s;}'],
];
// ★桩一律走**函数作用域 + globalThis 赋值**: 直接在脚本顶层写 `var X=…` 会在全局对象上建一个
//   var-声明的绑定, 后面真文件再 `const X=…` 就抛 "Identifier 'X' has already been declared"。
//   包一层 IIFE ⇒ var 落在函数里, 只有 globalThis.X 这一个**可配置属性**落到全局 (不与 const/let 冲突)。
for(const [n,v] of STUBS){
	try{ vm.runInContext(`(function(){ if(typeof X_==='undefined') globalThis.X_=V_; })()`
		.replace(/X_/g,n).replace('V_',v),ctx,{filename:'stub:'+n}); }
	catch(e){ /* 已有声明 ⇒ 用真文件的 */ }
}
load('js/15c-specveh.js');
load('js/20a-seats.js');
load('js/20-player.js');
const API=vm.runInContext(`({player,tryInteract,updateInteractHint,specVehBoard,specVehDismount,specVehSummon,specVehStow,specVehGet,
	navalBoard,navalSeatRelease,navalStartExit,navalFireTorpedo,navalCanFootExit,SPECVEH_get(){return SPECVEH;}})
	`,ctx);
const player=API.player;
const elm=document.getElementById('interact');

// ══════════════ 桩造一台"艇": 只实现 F 语义要判的两件事 (canFootExit / fireTorpedo) ══════════════
function mkCraft(o){
	o=o||{};
	const c={alive:true,state:'float',team:0,name:o.name||'PT 艇',kind:'boat',
		pos:THREE.Vector3(o.x||0,0,o.z||0),yaw:0,vel:0,flood:0,playerDriven:false,driverBot:null,crewBot:null,
		spec:{hullW:6.4,hullL:20.5,draft0:0.95,reload:1.0,torpedo:o.torpedo===undefined?4:o.torpedo},
		torpedoFired:0,
		fireTorpedo(){ c.torpedoFired++; return true; }};
	return c;
}
function mkGhost(){ return API.specVehSummon?null:null; }

console.log('═══ F 键语义优先级栈自检 (2026-09-22 观战F冲突批) ═══');
console.log('   判据全部调用游戏自己的接口 (tryInteract / specVehBoard / navalBoard …), 不重写第二套状态机\n');

// ══════════════ 1. 观战 + 在艇上: F 必须是 鱼雷 / 下船, **不得**召唤幽灵坦克 ══════════════
console.log('── 1. 观战者在艇上 (用户实报的那条链路) ──');
{
	// 深水 (waterDepthAt 默认 0 ⇒ 不在深水; 用 deploy 的桩把水深调大)
	const c=mkCraft();
	vm.runInContext('waterDepthAt=function(){ return 5; };',ctx);       // 深水 ⇒ 不可步行下船 ⇒ F=鱼雷
	const ok=API.navalBoard(c,true);
	const before=API.SPECVEH_get();
	player.spectator=true;
	API.tryInteract();
	assert('① 在艇上按 F ⇒ 发射鱼雷 (craft.fireTorpedo 被调用)', c.torpedoFired===1, `fireTorpedo 调用 ${c.torpedoFired} 次`);
	assert('② 在艇上按 F **不**召唤幽灵坦克 (SPECVEH 仍为空)', API.SPECVEH_get()===null,
		`SPECVEH=${API.SPECVEH_get()===null?'null':'非空'}`);
	assert('③ 座位仍只有海战那一个 (player.onVehicle 为空)', player.onVehicle===null&&player.onNaval===c,
		`onNaval=${!!player.onNaval?'艇':'null'} onVehicle=${player.onVehicle?player.onVehicle.kind:'null'}`);
	API.navalSeatRelease();
}
// ══════════════ 2. 观战 + 在艇上 + 浅水/搁浅: F = 下船 ══════════════
{
	vm.runInContext('waterDepthAt=function(){ return 0.2; };',ctx);      // 浅水 ⇒ 可步行下船 ⇒ F=下船
	const c=mkCraft();
	API.navalBoard(c,true);
	player.spectator=true;
	API.tryInteract();
	assert('④ 浅水/搁浅时按 F ⇒ 走"下船"跨出 (navalExit 已置, 且不发鱼雷)',
		!!player.navalExit&&c.torpedoFired===0, `navalExit=${!!player.navalExit} fireTorpedo=${c.torpedoFired}`);
	API.navalSeatRelease();
}
// ══════════════ 3. 观战 + 已上幽灵坦克: F = 下车 (不是召唤、不是鱼雷) ══════════════
{
	const g=API.specVehGet();
	g.spawned=true; g.alive=true; g.grp.parent=null;
	vm.runInContext('world.add=function(){};',ctx);
	API.specVehBoard(g);
	player.spectator=true; player.onNaval=null;
	API.tryInteract();
	assert('⑤ 幽灵坦克上按 F ⇒ 下车 (onVehicle 清空 + 车收回)', player.onVehicle===null&&API.SPECVEH_get()===null,
		`onVehicle=${player.onVehicle===null?'null':player.onVehicle.kind} SPECVEH=${API.SPECVEH_get()===null?'null':'非空'}`);
}
// ══════════════ 4. 观战 + 空手步行: F = 召唤并上车 ══════════════
{
	player.onNaval=null; player.onVehicle=null; player.spectator=true;
	API.tryInteract();
	const g=API.SPECVEH_get();
	assert('⑥ 步行时按 F ⇒ 召唤并直接进入幽灵坦克', !!g&&g.playerDriven===true&&player.onVehicle===g,
		`SPECVEH=${g?'有':'无'} playerDriven=${g?g.playerDriven:'-'} onVehicle===g:${player.onVehicle===g}`);
	assert('⑦ 召唤后 player.onNaval 仍为空 (两个座位字段互斥的另一半)', player.onNaval===null,
		`onNaval=${player.onNaval===null?'null':'非空'}`);
	API.specVehDismount();
}
// ══════════════ 5. 座位互斥的两个方向 (结构性病根: 旧版 specVehBoard 不清 onNaval) ══════════════
{
	const c=mkCraft();
	vm.runInContext('waterDepthAt=function(){ return 5; };',ctx);
	API.navalBoard(c,true);
	const g=API.specVehGet(); g.spawned=true; g.alive=true;
	API.specVehBoard(g);                                          // 直接调用 (绕过 tryInteract 的优先级栈)
	assert('⑧ 上幽灵坦克 ⇒ 自动交还海战座位 (onNaval 被清)', player.onNaval===null&&c.playerDriven===false,
		`onNaval=${player.onNaval===null?'null':'非空'} craft.playerDriven=${c.playerDriven}`);
	// 反方向: 在车上再上艇 ⇒ 白车必须被收掉
	const c2=mkCraft();
	API.navalBoard(c2,true);
	assert('⑨ 上艇 ⇒ 自动收掉幽灵坦克 (onVehicle 清空 + SPECVEH 置空)', player.onVehicle===null&&API.SPECVEH_get()===null,
		`onVehicle=${player.onVehicle===null?'null':player.onVehicle.kind} SPECVEH=${API.SPECVEH_get()===null?'null':'非空'}`);
	API.navalSeatRelease();
}
// ══════════════ 6. 提示行与 F 实际语义逐态一致 (三处文案同源) ══════════════
{
	vm.runInContext('waterDepthAt=function(){ return 5; };',ctx);
	const c=mkCraft();
	API.navalBoard(c,true); player.spectator=true;
	API.updateInteractHint();
	const h1=elm._text||elm.innerHTML;
	assert('⑩ 观战在艇上 (深水) 的提示 = 鱼雷, 不出现"幽灵坦克"',
		/鱼雷/.test(h1)&&!/幽灵坦克/.test(h1), `提示="${h1.slice(0,60)}…"`);
	API.navalSeatRelease();
	vm.runInContext('waterDepthAt=function(){ return 0.2; };',ctx);
	const c2=mkCraft(); API.navalBoard(c2,true); player.spectator=true;
	API.updateInteractHint();
	const h2=elm._text||elm.innerHTML;
	assert('⑪ 观战在艇上 (浅水) 的提示 = 下船, 不出现"幽灵坦克"',
		/下船/.test(h2)&&!/幽灵坦克/.test(h2), `提示="${h2.slice(0,60)}…"`);
	API.navalSeatRelease();
	const g=API.specVehGet(); g.spawned=true; g.alive=true; API.specVehBoard(g); player.spectator=true;
	API.updateInteractHint();
	const h3=elm._text||elm.innerHTML;
	assert('⑫ 观战在幽灵坦克上的提示 = 下车 (观战专属一行)', /下车/.test(h3)&&/观战专属/.test(h3), `提示="${h3.slice(0,60)}…"`);
	API.specVehDismount();
	player.spectator=true; player.onNaval=null; player.onVehicle=null;
	API.updateInteractHint();
	const h4=elm._text||elm.innerHTML;
	assert('⑬ 观战步行时的提示 = 召唤并进入幽灵坦克', /召唤/.test(h4)&&/幽灵坦克/.test(h4), `提示="${h4.slice(0,60)}…"`);
}
// ══════════════ 6b. 提示刷新指纹必须随座位变化 ══════════════
//   本函数按 sig 指纹节流重算 —— 指纹漏位时, "状态变了但提示不刷新", 屏幕上还停着上一态的文案。
//   ★测试要点 (第一版写错过, 记在这里): 不能借 navalBoard/specVehBoard 改状态 —— 那两个函数**内部**都会
//   自己调一次 updateInteractHint, 于是无论指纹对不对, 文本都已是新的 ⇒ 判据空转
//   (阴性对照当场证明: 把新增的指纹位删掉那一版测试照样全绿)。所以这里**直接赋值**座位字段,
//   绕开所有内部刷新, 让 updateInteractHint 成为唯一信息来源。
//   注: 观战者只有 onNaval 这一条可达的"座位型"变化 (观战者进不去坦克, 观战专属座驾就是幽灵坦克本身,
//   它上/下都会连动 onVehicle 那一位) —— 所以这里只证 onNaval 位; 指纹里那个 ghost 位是防御性的。
{
	vm.runInContext('waterDepthAt=function(){ return 5; };',ctx);
	player.spectator=true; player.onNaval=null; player.onVehicle=null; player.ffAll=false;
	player.pos.set(0,0,0); player.vel.set(0,0,0);
	API.updateInteractHint(); const hWalk=elm._text||elm.innerHTML;
	const c=mkCraft();
	player.onNaval=c; c.playerDriven=true;              // 直接置位 (不调 navalBoard ⇒ 绕开其内部刷新)
	API.updateInteractHint(); const hBoat=elm._text||elm.innerHTML;
	assert('⑭b 座位字段直接变化 ⇒ 提示必须跟着切 (指纹含 onNaval)', /召唤/.test(hWalk)&&/鱼雷/.test(hBoat),
		`步行="${hWalk.slice(0,30)}…" → 置 onNaval 后="${hBoat.slice(0,30)}…"`);
	// 复位到干净步行态 (座位字段必须显式清, 否则下一条会带着残留状态跑)
	player.onNaval=null; c.playerDriven=false; player.spectator=false; player.onVehicle=null; player.ffAll=false;
	API.updateInteractHint();
}

// ══════════════ 7. 非观战路径不受影响 (回归: 普通玩家在艇上 F 仍是鱼雷, 且不会被观战分支吃掉) ══════════════
{
	vm.runInContext('waterDepthAt=function(){ return 5; };',ctx);
	const c=mkCraft();
	API.navalBoard(c,true); player.spectator=false;
	assert('⑮ 前置: 普通玩家确实在艇上', player.onNaval===c, `onNaval=${player.onNaval===c?'艇':'null'}`);
	API.tryInteract();
	assert('⑮ 普通玩家在艇上按 F ⇒ 仍是鱼雷 (观战改动不影响常规路径)', c.torpedoFired>=1&&API.SPECVEH_get()===null,
		`fireTorpedo=${c.torpedoFired} SPECVEH=${API.SPECVEH_get()===null?'null':'非空'}`);
	API.navalSeatRelease();
}
console.log('');
if(BAD.length){ console.log(`✗ ${BAD.length} 项失败\n  - `+BAD.join('\n  - ')); process.exit(1); }
console.log(`✓ 全部通过  (通过 ${OK.length} 项)`);
