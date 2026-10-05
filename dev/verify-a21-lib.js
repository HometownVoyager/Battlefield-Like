// ─────────────────────────────────────────────
// dev/verify-a21-lib.js —— 批次 20260921A 独立验收 (verifier) 共用沙箱
//
// 不是探针本体 (不被 run-all-verify 执行, 也不产出断言); 被 dev/verify-a21-a*.js require。
// 口径来源: dev/_bootstub.js 的 THREE/DOM/WebAudio 桩 + dev/tmp-seahud-battery.js 的 "从 index.html 现取脚本表" 装法
//   + dev/verify-tankai.js 的补桩 (Vector3.addScalar/divideScalar、材质 clone/dispose、完整 AC 桩、摘 window.CANNON)。
// 纪律: 只读生产代码, 绝不写 js/。播种随机一律 mulberry32 (不用 Math.random 比数字)。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const {sandbox,document,window}=require('./_bootstub.js');

// ── 桩能力补齐 (与 verify-tankai.js 同源口径; 只在本进程内补, 不动共享桩文件) ──
const V3c=sandbox.THREE.Vector3;
V3c.prototype.addScalar=function(s){ this.x+=s; this.y+=s; this.z+=s; return this; };
V3c.prototype.divideScalar=function(s){ s=s||1; this.x/=s; this.y/=s; this.z/=s; return this; };
V3c.prototype.distanceToSquared=function(v){ return (this.x-v.x)**2+(this.y-v.y)**2+(this.z-v.z)**2; };
V3c.prototype.cross=function(v){ const x=this.y*v.z-this.z*v.y,y=this.z*v.x-this.x*v.z,z=this.x*v.y-this.y*v.x; this.x=x;this.y=y;this.z=z; return this; };
V3c.prototype.negate=function(){ this.x=-this.x;this.y=-this.y;this.z=-this.z; return this; };
V3c.prototype.setLength=function(l){ return this.normalize().multiplyScalar(l); };
V3c.prototype.subVectors=function(a,b){ this.x=a.x-b.x; this.y=a.y-b.y; this.z=a.z-b.z; return this; };
V3c.prototype.addVectors=function(a,b){ this.x=a.x+b.x; this.y=a.y+b.y; this.z=a.z+b.z; return this; };
for(const k of ['MeshLambertMaterial','MeshBasicMaterial','MeshStandardMaterial','MeshPhongMaterial','PointsMaterial','SpriteMaterial']){
	const C=sandbox.THREE[k];
	if(!C||!C.prototype) continue;
	if(!C.prototype.clone) C.prototype.clone=function(){ return new C(Object.assign({},this,{color:this.color})); };
	if(!C.prototype.dispose) C.prototype.dispose=function(){};
}
// 01-audio 的引擎/炮声全量用 AudioParam 斜坡 —— _bootstub 的 AC 只够"建得起图", 这里补一套完整 AC 桩
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
get currentTime(){ return 0; }
get sampleRate(){ return 44100; }
}
sandbox.AudioContext=ACStub; sandbox.window.AudioContext=ACStub; sandbox.window.webkitAudioContext=ACStub;
// _bootstub 的 window.CANNON 是半截桩 (World 只有 add): 12-ragdolls 看到它存在会半途 TypeError。
// 本套探针不测布娃娃 ⇒ 摘掉它, 让 ragInit 走自己的"物理未就绪"早退分支 (与 probe-bots/verify-tankai 同源)。
delete sandbox.window.CANNON;
// _bootstub 的 Object3D.remove() 不把被摘对象的 parent 置空 —— 真 three.js r152 的 remove() 会
// (`object.parent = null`)。这个差异会让 `if(!g.grp.parent) world.add(...)` 这类"从 parent 判在不在场景"
// 的复用路径在沙箱里静默失效 (2026-09-21 A#4 探针实测踩到)。这里按真 three 语义补上 (只让桩更忠实)。
{
	const Obj=sandbox.THREE.Object3D;
	if(Obj&&Obj.prototype&&Obj.prototype.remove){
		const orig=Obj.prototype.remove;
		Obj.prototype.remove=function(m){ const r=orig.call(this,m); if(m&&m.parent===this) m.parent=null; return r; };
	}
	// 真 three.js 的 Object3D.clear() (10-viewmodel 的 vmEquip / 23-deploy 的 deployPlayer 都调它)
	if(Obj&&Obj.prototype&&!Obj.prototype.clear){
		Obj.prototype.clear=function(){ for(const c of this.children.slice()) if(c) c.parent=null; this.children.length=0; return this; };
	}
}

// ── 脚本表: 直接从 index.html 现取 (与真浏览器同序同集合: 含 15c/15d/15f/22a/23b) ──
function scriptList(){
	const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
	const out=[]; const re=/<script src="(js\/[^"?]+)/g; let m;
	while((m=re.exec(html))) out.push(m[1]);
	return out;
}
const FILES=scriptList();

function mulberry32(a){ return function(){ a|=0; a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }

// 只加载 00-config 拿战役索引 (不建世界, 快)
function campIdxOf(id){
	const ctx=vm.createContext(Object.assign({},sandbox));
	ctx.document=document; ctx.window=window; ctx.globalThis=ctx;
	ctx.localStorage={_s:{},getItem:()=>null,setItem(){},removeItem(){}};
	ctx.console={log(){},warn(){},error(){}};
	vm.runInContext(fs.readFileSync(path.join(root,'js/00-config.js'),'utf8'),ctx,{filename:'00-config.js'});
	return vm.runInContext(`CAMPAIGNS.findIndex(c=>c.id==='${id}')`,ctx);
}

// ── bootSome: 只加载给定脚本表 (最小实验用, 快) ──
function bootSome(files,campIdx,opts){
	opts=opts||{};
	const ctx=vm.createContext(Object.assign({},sandbox));
	ctx.document=document; ctx.window=window; ctx.globalThis=ctx;
	if(opts.seed!==undefined){ const M=Object.create(Math); M.random=mulberry32(opts.seed); ctx.Math=M; }
	ctx.localStorage={_s:{sf_campaign:String(campIdx===undefined?0:campIdx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
	ctx.console=opts.quiet===false?console:{log(){},warn(){},error(){}};
	for(const f of files){
		let code=fs.readFileSync(path.join(root,f),'utf8');
		if(opts.mutate&&opts.mutate[f]) code=opts.mutate[f](code);
		vm.runInContext(code,ctx,{filename:f});
	}
	return ctx;
}

// ── boot: 全链加载 (+ 可选开局), 返回 ctx ──
// opts: {seed=42, start=false, diff, quiet=true, mutate:{file:(src)=>src}}
function boot(campIdx,opts){
	opts=opts||{};
	const ctx=vm.createContext(Object.assign({},sandbox));
	ctx.document=document; ctx.window=window; ctx.globalThis=ctx;
	if(opts.seed!==undefined){ const M=Object.create(Math); M.random=mulberry32(opts.seed); ctx.Math=M; }
	ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
	// 加载期世界会往 stdout 打进度: 探针只要自己的断言输出 (warn/error 原样保留, 便于定位真异常)
	ctx.console=opts.quiet===false?console:{log:(...a)=>{ const s=a.map(x=>String(x)).join(' '); if(!/^\[(地形|HUD|NAV|世界|反舰炮位)/.test(s)) console.log(...a); }, warn:console.warn.bind(console), error:console.error.bind(console)};
	for(const f of (opts.files||FILES)){
		let code=fs.readFileSync(path.join(root,f),'utf8');
		if(opts.mutate&&opts.mutate[f]) code=opts.mutate[f](code);
		vm.runInContext(code,ctx,{filename:f});
	}
	if(opts.diff!==undefined) vm.runInContext('SETTINGS.diff='+opts.diff,ctx);
	if(opts.start){
		const st=vm.runInContext(`(()=>{ try{ const b=document.getElementById('startBtn'); if(b&&b.onclick){ b.onclick(); return 'ok'; } return 'no-button'; }catch(e){ return 'ERR '+String(e&&e.stack||e); } })()`,ctx);
		ctx.__start=st;
	}
	return ctx;
}
const run=(ctx,code)=>vm.runInContext(code,ctx);

// 断言器: 与既有探针同款输出 (✓/✗ + 末行汇总 + exit code)
function makeChk(title){
	let checks=0,failures=0;
	const lines=[];
	const chk=(c,m)=>{ checks++; const s=(c?'  ✓ ':'  ✗ ')+m; lines.push(s); console.log(s); if(!c) failures++; };
	const info=m=>{ const s='    '+m; lines.push(s); console.log(s); };
	const done=extra=>{
		const tail=`${title}: ${failures===0?'全部通过 ✓':'存在失败 ✗'} (${checks-failures}/${checks})`+(extra?` ${extra}`:'');
		console.log('\n'+tail); lines.push(tail);
		return failures===0?0:1;
	};
	return {chk,info,done,get failures(){return failures;},get checks(){return checks;},lines};
}
// 读取 git HEAD 版本的某个文件 (本批全部改动都未提交 ⇒ HEAD = 改造前基线)。
// 由 pwsh 预先落在 dev/out/head-*.js (探针内不起子进程, 便于在受限沙箱里也能跑)。
function headSrc(file){
	const p=path.join(root,'dev/out/head-'+file.replace(/[/]/g,'_'));
	if(!fs.existsSync(p)) return null;
	return fs.readFileSync(p,'utf8');
}
module.exports={root,FILES,boot,bootSome,run,campIdxOf,mulberry32,makeChk,headSrc,sandbox,document,window};
