// ─────────────────────────────────────────────
// dev/_bootpatch.js —— 共享桩能力补齐 (2026-09-22 抽出: 原本只写在 verify-seabatch.js 里, 探针再抄一遍)
// 用法: const {sandbox,document,window}=require('./_bootstub.js'); require('./_bootpatch.js').patch(sandbox);
//       ← 必须在装载任何 js/ 脚本**之前**调用 (补的是 THREE/AudioContext 这些被脚本直接摸的接口)
// 口径: 这些补丁补的是**桩能力**, 不是被测代码 —— 缺了会把"桩不足"误报成真失败
//   (历史上踩过: _bootstub 缺 isMesh ⇒ 所有靠 o.isMesh 的运行时分支在沙箱里静默走空、探针数网格数为 0)。
// ─────────────────────────────────────────────
'use strict';
function patch(sandbox){
	// ── Vector3 的两个方法 (03-terrain/05-world 的计算链直接调) ──
	const V3c=sandbox.THREE.Vector3;
	if(V3c&&V3c.prototype){
		if(!V3c.prototype.addScalar) V3c.prototype.addScalar=function(s){ this.x+=s; this.y+=s; this.z+=s; return this; };
		if(!V3c.prototype.divideScalar) V3c.prototype.divideScalar=function(s){ s=s||1; this.x/=s; this.y/=s; this.z/=s; return this; };
	}
	// ── 材质 clone/dispose ──
	for(const k of ['MeshLambertMaterial','MeshBasicMaterial','MeshStandardMaterial','MeshPhongMaterial','PointsMaterial','SpriteMaterial']){
		const C=sandbox.THREE[k];
		if(!C||!C.prototype) continue;
		if(!C.prototype.clone) C.prototype.clone=function(){ return new C(Object.assign({},this,{color:this.color})); };
		if(!C.prototype.dispose) C.prototype.dispose=function(){};
	}
	// ── AudioContext: 摧毁链/武器链会调 frequency.exponentialRampToValueAtTime 等, 缺一个就抛 ──
	const AP=()=>({value:0,setValueAtTime(){},setTargetAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}});
	class ACStub{
		createOscillator(){ return {frequency:AP(),detune:AP(),type:'',start(){},stop(){},connect(){},onended:null}; }
		createGain(){ return {gain:AP(),connect(){},disconnect(){}}; }
		createBuffer(){ return {getChannelData:()=>new Float32Array(16),duration:1,numberOfChannels:1}; }
		createBufferSource(){ return {buffer:null,loop:false,playbackRate:AP(),start(){},stop(){},connect(){},onended:null}; }
		createBiquadFilter(){ return {type:'',frequency:AP(),detune:AP(),Q:AP(),connect(){}}; }
		createDynamicsCompressor(){ return {threshold:AP(),ratio:AP(),attack:AP(),release:AP(),connect(){}}; }
		createStereoPanner(){ return {pan:AP(),connect(){}}; }
		resume(){ return Promise.resolve(); }
		get state(){ return 'running'; }
		get destination(){ return {}; }
	}
	sandbox.AudioContext=ACStub;
	if(sandbox.window){ sandbox.window.AudioContext=ACStub; sandbox.window.webkitAudioContext=ACStub; }
	// ── Euler 桩缺 copy/clone → 10-viewmodel 换弹收尾要记弹匣/弹夹的静止旋转 (rotation.clone) ──
	//    (2026-10-05 补: 缺这一个方法 = "桩不足"被报成 updateViewModel 抛错)
	const _Eu=sandbox.THREE.Euler;
	if(_Eu&&_Eu.prototype){
		if(!_Eu.prototype.copy) _Eu.prototype.copy=function(e){ this.x=e.x; this.y=e.y; this.z=e.z; if(e.order) this.order=e.order; return this; };
		if(!_Eu.prototype.clone) _Eu.prototype.clone=function(){ const e=new _Eu(); e.x=this.x; e.y=this.y; e.z=this.z; e.order=this.order; return e; };
	}
	// ── InstancedMesh 桩缺 instanceMatrix.array → 08-effects 的 queueSink 会读 undefined ──
	const _IM=sandbox.THREE.InstancedMesh;
	if(_IM){
		const _arr=new Float32Array(16*64);
		sandbox.THREE.InstancedMesh=class extends _IM{ constructor(g,m,c){ super(g,m,c); this.instanceMatrix={array:_arr}; } };
	}
	return sandbox;
}
module.exports={patch};
