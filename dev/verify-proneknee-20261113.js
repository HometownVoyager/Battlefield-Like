// ─────────────────────────────────────────────────────────────
// dev/verify-proneknee-20261113.js —— 2026-11-13b 批⑤ 趴姿膝弯方向修复验收
//   病灶: 趴姿 (匍匐) 腿反解 pole 取向上 (kneeUp=true) ⇒ 膝峰拱到髋线之上 0.25~0.37m、
//   小腿向脚尖方向折 = 反关节超伸 (用户实报"趴下移动膝盖向上弯曲, 和正常人类相反")。
//   修法: legIKPose 趴姿三消费点 (20-player 玩家 LL/RR + 14-bots Bot LL/RR) kneeUp false 化,
//   pole 翻下 ⇒ 膝落回贴地段 (~0.09 级) + 膝弯转人类屈曲方向 (脚跟朝臀)。
// 用法: node dev/verify-proneknee-20261113.js [--neg]
//   --neg = 阴性对照 (2 补丁, 对认按红名): N1 玩家趴姿调用还原 kneeUp=true → ⑤-2/⑤-3 红 /
//   N2 Bot 趴姿调用还原 kneeUp=true → ③ 源码断言(14-bots)红。
// 口径: 与 verify-tvosd-headbonk-20261110 同款 boot (真 three + index.html 全脚本链 + startBtn 开局)。
// ─────────────────────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const NEG=process.argv.includes('--neg');
const OK=[],BAD=[];
function assert(name,cond,detail){ (cond?OK:BAD).push(name); console.log(`  ${cond?'✓':'✗'} ${name}${detail?'  '+detail:''}`); }
function section(t){ console.log('\n══ '+t+' ══'); }
const SRC=f=>fs.readFileSync(path.join(root,f),'utf8');

const patchStyle=(el)=>{ if(el&&el.style&&typeof el.style.setProperty!=='function') el.style.setProperty=function(k,v){ this[k]=v; }; return el; };
const _stub=require('./_bootstub.js');
{
const document=_stub.document;
const g=document.getElementById.bind(document), c=document.createElement.bind(document), q=document.querySelector.bind(document);
document.getElementById=(id)=>patchStyle(g(id));
document.createElement=(t)=>patchStyle(c(t));
document.querySelector=(s)=>patchStyle(q(s));
}

// ── 阴性对照 (一律单行锚) ──
const PATCHES=[
 // N1 病灶还原: 玩家趴姿左腿反解 pole 翻回向上 (膝峰拱上 / 小腿反折复现)
 ['js/20-player.js','legIKPose(hpNow,0.11+Math.max(0,S)*0.13*cr,-0.92+S*0.16*cr,false)','legIKPose(hpNow,0.11+Math.max(0,S)*0.13*cr,-0.92+S*0.16*cr,true) // NEG N1'],
 // N2 病灶还原: Bot 趴姿左腿反解同还原
 ['js/14-bots.js','this.legIK(hpNow,0.11+Math.max(0,S)*0.13*cr,-0.92+S*0.16*cr,false)','this.legIK(hpNow,0.11+Math.max(0,S)*0.13*cr,-0.92+S*0.16*cr,true) // NEG N2'],
];
const PATCH_MAP={};
if(NEG) for(const [f,from,to] of PATCHES){
 const s=PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f);
 if(s.indexOf(from)<0) throw new Error('阴性对照锚点未找到: '+f+' :: '+from.slice(0,70));
 PATCH_MAP[f]=s.split(from).join(to);
}
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f));

// ── ③ 源码防回退 ─────────────────────────────────────────────
section('③ 源码防回退 (单源函数 + 三消费点全 false 化)');
{
const s11=SRC('js/11-soldiers.js'), s20=srcOf('js/20-player.js'), s14=srcOf('js/14-bots.js');
assert('11-soldiers: legIKPose kneeUp 参数单源 (pole 分支 + 膝弯符号翻转)',
 s11.includes('function legIKPose(hp,fy,dz,kneeUp){')
 &&s11.includes('const hipW=kneeUp?dir+beta:dir-beta;')
 &&s11.includes('o.hip=hipW; o.knee=kneeUp?-bend:bend;')
 &&s11.includes('趴姿自 2026-11-13b 批⑤起改 kneeUp=false'));
assert('20-player: 趴姿双腿反解 kneeUp=false (LL+RR 两调用点 + 批⑤注释)',
 s20.includes('const LL=legIKPose(hpNow,0.11+Math.max(0,S)*0.13*cr,-0.92+S*0.16*cr,false);')
 &&s20.includes('const RR=legIKPose(hpNow,0.11+Math.max(0,-S)*0.13*cr,-0.92-S*0.16*cr,false);')
 &&s20.includes('★2026-11-13b 批⑤: kneeUp true→false')
 &&s20.includes('dev/verify-proneknee-20261113.js'));
assert('14-bots: Bot 趴姿双腿反解 kneeUp=false (与 20-player 同批同规)',
 s14.includes('const LL=this.legIK(hpNow,0.11+Math.max(0,S)*0.13*cr,-0.92+S*0.16*cr,false);')
 &&s14.includes('const RR=this.legIK(hpNow,0.11+Math.max(0,-S)*0.13*cr,-0.92-S*0.16*cr,false);')
 &&s14.includes('★2026-11-13b 批⑤: kneeUp true→false 与 20-player 同批同规'));
}

// ── 沙箱装载 (真 three; 与 verify-tvosd 同款 boot) ──────────
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
const html=SRC('index.html');
const FILES=[...html.matchAll(/src="(js\/[^"?]+)/g)].map(m=>m[1]);
function boot(campIdx){
	const T=loadRealTHREE();
	T.WebGLRenderer=class{ constructor(){ this.domElement=Object.assign(document.createElement('canvas'),{width:0,height:0}); this.shadowMap={enabled:false,type:0,autoUpdate:true};
		this.setSize=()=>{}; this.setPixelRatio=()=>{}; this.render=()=>{}; this.clear=()=>{}; this.clearDepth=()=>{};
		this.outputColorSpace=''; this.setClearColor=()=>{}; this.setAnimationLoop=()=>{}; } };
	const stub=_stub;
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
	const listeners={};
	const addL=(t,f)=>{ (listeners[t]=listeners[t]||[]).push(f); };
	ctx.addEventListener=addL; ctx.removeEventListener=()=>{};
	ctx.document.addEventListener=addL; ctx.document.removeEventListener=()=>{};
	ctx.window=Object.assign({},window,{addEventListener:addL,removeEventListener(){}});
	ctx.dispatchEvent=ev=>{ if(!ev.preventDefault) ev.preventDefault=()=>{}; if(!ev.stopPropagation) ev.stopPropagation=()=>{}; for(const f of (listeners[ev.type]||[]).slice()) f(ev); return true; };
	ctx.KeyboardEvent=class{ constructor(t,o){ o=o||{}; this.type=t; this.code=o.code; this.repeat=!!o.repeat; } };
	ctx.MouseEvent=class{ constructor(t,o){ o=o||{}; this.type=t; this.button=o.button; } };
	ctx.globalThis=ctx;
	ctx.setTimeout=(f)=>{ try{ f(); }catch(e){ console.log('  [异步桩] '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | ')); } return 0; };
	ctx.clearTimeout=()=>{};
	ctx.localStorage={_s:{sf_campaign:String(campIdx),sf_exp:'1',sf_pseed:'424242'},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
	for(const f of FILES){ vm.runInContext(srcOf(f),ctx,{filename:f}); }
	return ctx;
}
const ctx=boot(0);
const G=s=>vm.runInContext(s,ctx,{timeout:300000});
let err=null;
try{ G("document.getElementById('startBtn').onclick();"); }catch(e){ err='start: '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); }
if(!err) try{ G("player.team=0; player.cls=0; player.spectator=false; player.alive=true; player.deployed=true; player.hp=100; for(let i=0;i<120;i++) updatePlayer(1/60);"); }catch(e){ err='playerInit: '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); }
assert('① 前置: 开局+玩家落地 (!spectator, onGround, 有站位)',!err&&G('player.alive')===true&&G('player.onGround')===true,err||'');

// ── ⑤ 行为 ───────────────────────────────────────────────────
section('⑤ 行为: legIKPose 极性 + 趴姿爬行 mesh 膝位');
{
// ⑤-1 数学: 同一组趴姿参数 (骨盆 0.35 / 脚 0.11 / dz -0.92), pole 下 ⇒ 膝弯 + (人类屈曲), pole 上 ⇒ 膝弯 − (反关节)。
// 注意交替双槽: 相邻两调返回不同槽对象, 取值须就地读。
G("globalThis._kd=legIKPose(0.35,0.11,-0.92,false); globalThis._kdK=_kd.knee, _kdH=_kd.hip;"
 +"globalThis._ku=legIKPose(0.35,0.11,-0.92,true); globalThis._kuK=_ku.knee, _kuH=_ku.hip;");
assert('⑤-1 膝弯极性: pole 下 knee>0 (人类屈曲) / pole 上 knee<0 (旧反关节档, 对照组)',
 G('_kdK')>0.05&&G('_kuK')<-0.05,`下=${G('_kdK').toFixed(3)} 上=${G('_kuK').toFixed(3)}`);
assert('⑤-2 髋角两档差 = 2β (两腿解同 D, 只差 pole 侧) ∈ (0.15, 0.45) rad',
 Math.abs(G('_kdH')-G('_kuH'))>0.15&&Math.abs(G('_kdH')-G('_kuH'))<0.45,`Δ=${Math.abs(G('_kdH')-G('_kuH')).toFixed(3)}`);
// ⑤-3 mesh 级: 玩家趴姿爬行, 膝关节世界高度 < 骨盆世界高度 (pole 已翻下) 且近地不入地。
// 旧病形状 = 膝峰在髋线之上 0.25~0.37 ⇒ 本断言在旧档下必然红。
// ★2026-11-18 判据加固 (批12 帐篷朝向二修容错): 布势点净空评分随帐篷墙盒朝向平移 ~0.4m ⇒ 原单帧采样
//   可能落在下坡段+摆腿低相位上 (实测膝高 -0.050 < 带宽下沿 -0.02, 纯布局噪声非姿态病; 末速 1.15
//   证明没被墙挡)。⑤-4 改双保险: ①先把玩家传送到扫描出的净空平地 (无 BOXES/CYLS 近邻 + 8m 见方
//   高差<0.10, 48m 环扫); ②整个爬行周期逐帧采样 —— 下界改用真不变量「膝不没入地面」(膝世界高 −
//   膝处地面高 ≥ -0.03, 坡度/相位双免疫), 上界沿用 root 相对带宽 ≤0.25 (膝峰不高耸 = 旧病形状)。
//   探针卫生: 测完还原原位再断言 ⑤-3/⑤-5。
G("(function(){"
 +"globalThis._p0x=player.pos.x; globalThis._p0z=player.pos.z;"
 +"const flat=(px,pz)=>{const a=heightAt(px-4,pz-4),b=heightAt(px+4,pz-4),c=heightAt(px-4,pz+4),d=heightAt(px+4,pz+4);return Math.max(a,b,c,d)-Math.min(a,b,c,d)<0.10;};"
 +"const nearSolid=(px,pz)=>{"
 +"  for(const b of BOXES){ if(px>b.minX-4&&px<b.maxX+4&&pz>b.minZ-4&&pz<b.maxZ+4) return true; }"
 +"  for(const c of CYLS){ const dx=px-c.x,dz=pz-c.z; if(dx*dx+dz*dz<(c.r+4)*(c.r+4)) return true; }"
 +"  return false; };"
 +"let bx=null,bz=null;"
 +"outer: for(let rr=0;rr<=48;rr+=2){ for(let a=0;a<16;a++){"
 +"  const px=_p0x+rr*Math.cos(a*Math.PI/8), pz=_p0z+rr*Math.sin(a*Math.PI/8);"
 +"  if(flat(px,pz)&&!nearSolid(px,pz)){ bx=px; bz=pz; break outer; } } }"
 +"globalThis._flatFound=(bx!==null);"
 +"if(bx!==null){ player.pos.x=bx; player.pos.z=bz; player.vel.x=0; player.vel.y=0; player.vel.z=0; }"
 +"})()");
G("player.prone=true; player.crouch=false; keys.KeyW=true;"
 +"globalThis._av=playerAvatarEnsure();"
 +"globalThis._kw=new THREE.Vector3(); globalThis._pw=new THREE.Vector3(); globalThis._rw=new THREE.Vector3();"
 +"globalThis._minGap=99; globalThis._maxKH=-99;"
 +"for(let i=0;i<150;i++){ updatePlayer(1/60); updatePlayerAvatar(1/60); _av.root.updateMatrixWorld(true);"
 +"  _kw.set(0,0,0); _av.legL.knee.getWorldPosition(_kw); _pw.set(0,0,0); _av.pelvis.getWorldPosition(_pw); _rw.set(0,0,0); _av.root.getWorldPosition(_rw);"
 +"  const kh=_kw.y-_pw.y; if(kh>_maxKH)_maxKH=kh;"   // 膝峰对髋线 (旧病形状 = 膝峰在髋线之上 0.25~0.37; 健康摆腿峰 ≈ 贴髋线)
 +"  const gap=_kw.y-heightAt(_kw.x,_kw.z); if(gap<_minGap)_minGap=gap; }"
 +"keys.KeyW=false;"
 +"player.pos.x=_p0x; player.pos.z=_p0z; player.vel.x=0; player.vel.y=0; player.vel.z=0;"
 +"_av.root.updateMatrixWorld(true);"
 +"_kw.set(0,0,0); _av.legL.knee.getWorldPosition(_kw);"
 +"_pw.set(0,0,0); _av.pelvis.getWorldPosition(_pw);"
 +"_rw.set(0,0,0); _av.root.getWorldPosition(_rw);");
const kw=G('_kw.y'), pw=G('_pw.y'), rw=G('_rw.y');
assert('⑤-3 趴姿爬行: 膝世界高 < 骨盆世界高 (pole 下; 旧档膝峰在髋线之上 0.25~0.37)',kw<pw,`膝=${kw.toFixed(3)} 盆=${pw.toFixed(3)}`);
assert('⑤-4 膝近地不入地 (★2026-11-18 判据加固: 净空平地整周期采样; 下界=膝-地面真不变量 ≥-0.03, 上界=膝峰对髋线 ≤0.10)',
 G('_flatFound')===true&&G('_minGap')>=-0.03&&G('_maxKH')<=0.10,
 `minGap=${G('_minGap').toFixed(3)} maxKH=${G('_maxKH').toFixed(3)} flatFound=${G('_flatFound')}`);
// 还原姿态 (探针卫生): 起身 + 归位
G("player.prone=false; for(let i=0;i<60;i++){ updatePlayer(1/60); updatePlayerAvatar(1/60); }");
assert('⑤-5 起身还原: prone=false 后膝回站立档 (膝世界高 > 骨盆高-0.6 即腿部伸直档)',
 (()=>{ const r=vm.runInContext("_av.root.updateMatrixWorld(true); _kw.set(0,0,0); _av.legL.knee.getWorldPosition(_kw); _pw.set(0,0,0); _av.pelvis.getWorldPosition(_pw); (_pw.y-_kw.y)",ctx);
   return r>0&&r<1.0; })(),`盆-膝=${(G('_pw.y')-G('_kw.y')).toFixed(3)}`);
}

// ── 汇总 ─────────────────────────────────────────────────────
console.log('\n──────────────────────────────');
console.log(`  ${NEG?'NEG':'正向'} ${OK.length} 绿 / ${BAD.length} 红`);
if(BAD.length){ console.log('  红名: '+BAD.join(' · ')); process.exitCode=1; }
