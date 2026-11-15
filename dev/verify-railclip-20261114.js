// ─────────────────────────────────────────────────────────────
// dev/verify-railclip-20261114.js —— 2026-11-14 批③ 护栏穿墙修复 (通用化) 验收
//   病灶: 站护栏顶起跳, 头部探进上方屋面板/顶棚 (护栏高与顶棚净高的多种搭配), 旧横推门
//   (HEAD_GRAZE 6cm 窗 + minY>头顶线压回) 把人横推/压甩出护栏外 = 穿墙出屋 (用户实报先报
//   红砖两层小楼, 后报"似乎大部分有护栏的都有这个问题" ⇒ 通用化)。
//   修法三件: ① collideMove 横推双门改"眼线 skip" (盒/柱底面高于眼线 pos.y+1.5 = 头顶上方
//   几何, 横推永不作为, 压回分支整体删除) ② headGrazeBlocked 跳跃预检窗改 (pos.y+1.5, pos.y+1.7]
//   —— 头探进顶棚 0~0.2m 档起跳被就地拦下 ③ 05a 塔台顶棚整体抬 0.6 (站护栏余量 0.07)。
//   护栏安全判据: rail_top ≤ ceiling_bottom−1.7 ⇒ 站护栏头部不探棚, 起跳由 headCeilClamp 穿越窗接管。
// 用法: node dev/verify-railclip-20261114.js [--neg]
//   --neg = 阴性对照 (3 补丁): N1 盒门眼线还原头顶线 (1.7) → ③-6 红 / N2 柱门眼线还原 → ③-8 红 /
//   N3 跳跃预检窗收窄回旧 6cm 档 (pos.y+1.64) → ③-4 红。负对照 (胸墙照推/自由跳) 各模式恒绿。
// 口径: 与 verify-tvosd-headbonk-20261110 同款 boot + 合成盒就位法 (RGRID_OFF 全扫, 测后摘盒)。
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
 // N1 病灶还原: 横推盒门眼线 (1.5) → 头顶线 (1.7) —— 眼线以上盒横推重新作为 (旧穿墙档)
 ['js/04-collision.js','if(pos.y+1.5<b.minY||pos.y+0.25>b.maxY) return;','if(pos.y+1.7<b.minY||pos.y+0.25>b.maxY) return; // NEG N1'],
 // N2 病灶还原: 横推柱门眼线 → 头顶线
 ['js/04-collision.js','if(pos.y+1.5<c.y0||pos.y+0.2>c.y1) return;   // ★2026-11-14 批③改: 上界 HEAD_GRAZE线→眼线 (与 _cmBoxCb 同规)','if(pos.y+1.7<c.y0||pos.y+0.2>c.y1) return; // NEG N2'],
 // N3 病灶还原: 跳跃预检窗收窄回旧 6cm 档 (1.5→1.64) —— 头探棚 0~0.2m 档预检放空 = 起跳撞棚横推。
 // ★from 串必须吃满整行到 hit=Infinity: 源行是 "_hcS.prevHead=pos.y+1.5; _hcS.hit=Infinity;" 同行,
 //   只锚前半段会把 hit 复位一起注释掉 ⇒ headGrazeBlocked 带陈旧 hit 恒 true (NEG 实录 hit=0.00)。
 ['js/04-collision.js','pos.y+1.5; _hcS.hit=Infinity;','pos.y+1.64; _hcS.hit=Infinity; // NEG N3'],
];
const PATCH_MAP={};
if(NEG) for(const [f,from,to] of PATCHES){
 const s=PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f);
 if(s.indexOf(from)<0) throw new Error('阴性对照锚点未找到: '+f+' :: '+from.slice(0,70));
 PATCH_MAP[f]=s.split(from).join(to);
}
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f));

// ── ① 源码防回退 ─────────────────────────────────────────────
section('① 源码防回退 (碰撞门 + 塔台抬顶 + 护栏判据)');
{
const s04=SRC('js/04-collision.js'), s05a=SRC('js/05a-buildings.js'), s20=SRC('js/20-player.js');
assert('04-collision: 横推双门眼线 skip (盒+柱) + 旧压回分支已删 + HEAD_GRAZE 留名',
 s04.includes('if(pos.y+1.5<b.minY||pos.y+0.25>b.maxY) return;')
 &&s04.includes('if(pos.y+1.5<c.y0||pos.y+0.2>c.y1)')
 &&s04.includes('const HEAD_GRAZE=0.06;')
 &&!s04.includes('pos.y=b.minY-1.7;')   // 带分号 = 代码形态; 注释引述 "(pos.y=b.minY-1.7)," 不含
 &&!s04.includes('pos.y=c.y0-1.7;'));
assert('04-collision: 跳跃预检窗 (pos.y+1.5, pos.y+1.7] (2026-11-14 批③改窗)',
 s04.includes('_hcS.head=pos.y+1.7;')&&s04.includes('_hcS.prevHead=pos.y+1.5;'));
assert('20-player: 跳跃门吃 headGrazeBlocked (起跳预检接线)',
 s20.includes('!headGrazeBlocked(p.pos)'));
assert('05a-buildings: 塔台顶棚整体抬 0.6 (柱 2.9 / 顶板 2.81, 站护栏 0.95 余量 0.07)',
 s05a.includes('mesh(boxGeo(0.16,2.9,0.16),MAT.woodDark,p[0],deckTop+1.45,p[1]);')
 &&s05a.includes('CYLS.push({x:p[0],z:p[1],r:0.1,y0:deckTop,y1:deckTop+2.9});')
 &&s05a.includes('addSnowCap(solidBox(MAT.woodDark,4.2,0.18,4.2,rp[0],deckTop+2.81,rp[1],ry));')
 &&s05a.includes('★2026-11-14 批③通用化: 顶棚整体抬 0.6'));
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
assert('② 前置: 开局+玩家落地',!err&&G('player.onGround')===true,err||'');

// ── ③ 行为: 护栏档三场景 (塔台抬顶档 / 头探棚档 / 眼线 skip 通用档) ──
section('③ 行为: 站护栏顶起跳不出屋 (合成几何, 测后摘盒)');
{
// 场地: 以玩家出生位为中心搭"护栏顶 + 屋面板"两盒 (旧写以世界原点为中心 ⇒ 没罩住玩家 = 假绿)。
// 选点: 出生位若被环境几何罩住 (基地工事), 向东步进找净空点再搭台。
// ★判据用**测试高度** (_p0+0.95 站护栏) 的宽窗 (y+1.4, y+1.75] 自扫 —— 旧写用 headGrazeBlocked 在
//   出生高度探, 而断言在抬高 0.95 后判, 两高度带的窗完全不同 (NEG 实录: 选点提前停在污染点);
//   宽窗覆盖所有补丁档 (正窗 (y+1.5,y+1.7] / N3 窄窗 (y+1.64,y+1.7] 都是其子带), 补丁无关。
// ★RGRID_OFF 在选点之前开: 选点与断言同走全扫, 免网格/全扫口径差。
G("globalThis._p0=player.pos.y; window.RGRID_OFF=true;"
 +"globalThis._winHit=(px,py,pz)=>{ let hit=false;"
 +"eachBoxNear(px-0.5,pz-0.5,px+0.5,pz+0.5,b=>{ if(!b.dead&&b.minY>py+1.4&&b.minY<=py+1.75){"
   +"const cx=Math.max(b.minX,Math.min(px,b.maxX)), cz=Math.max(b.minZ,Math.min(pz,b.maxZ));"
   +"const dx=px-cx, dz=pz-cz; if(dx*dx+dz*dz<0.25) hit=true; } });"
 +"eachCylNear(px-0.5,pz-0.5,px+0.5,pz+0.5,c=>{ if(c.y0>py+1.4&&c.y0<=py+1.75){"
   +"const dx=px-c.x, dz=pz-c.z; if(dx*dx+dz*dz<(c.r+0.5)*(c.r+0.5)) hit=true; } });"
 +"return hit; };"
 +"globalThis._jx=1e9; globalThis._jz=0; globalThis._baseZ=player.pos.z;"
 +"outerLoop:"
 +"for(let dz=-15;dz<=15;dz+=3){"
 +"for(let k=0;k<=21;k++){"
   +"const cx=player.pos.x+((k%2===1)?((k+1)/2)*3:-(k/2)*3);"   // 蛇形: 0,+3,-3,+6,-6…±63m
   +"if(!_winHit(cx,_p0+0.95,_baseZ+dz)){ _jx=cx; _jz=_baseZ+dz; break outerLoop; } } }"
 +"if(_jx===1e9){ _jx=player.pos.x; _jz=player.pos.z; }"        // 全图无净空 (不该发生): 就地搭台让断言暴露
 +"globalThis._n0=BOXES.length;"
 +"globalThis._rail={minX:_jx-0.25,maxX:_jx+0.25,minZ:_jz-0.25,maxZ:_jz+0.25,minY:_p0+0.75,maxY:_p0+0.95,dead:false};"
 +"globalThis._roof={minX:_jx-3,maxX:_jx+3,minZ:_jz-3,maxZ:_jz+3,minY:_p0+2.72,maxY:_p0+2.81,dead:false};"
 +"BOXES.push(_rail,_roof);"
 +"player.pos.set(_jx,_p0+0.95,_jz); player.vel.set(0,0,0); player.onGround=true;");
// ③-1 站护栏 (塔台档): 跳跃预检窗不误拦 (头 2.65 离棚底 2.72 有余量 0.07, 预检窗 (2.45,2.65] 不含 2.72)
assert('③-1 塔台档站护栏: headGrazeBlocked=false (抬顶后余量 0.07, 预检不误拦)',G('headGrazeBlocked(player.pos)')===false,
 (()=>{ const w=G("(()=>{ headGrazeBlocked(player.pos); const hit=_hcS.hit, ph=_hcS.prevHead, hd=_hcS.head;"
   +"let out='hit='+hit.toFixed(2)+' 窗=('+ph.toFixed(2)+','+hd.toFixed(2)+']';"
   +"if(isFinite(hit)){ for(let i=0;i<BOXES.length;i++){ const b=BOXES[i]; if(!b.dead&&b.minY===hit){"
     +"out+=' ←B[minX'+b.minX.toFixed(1)+' maxX'+b.maxX.toFixed(1)+' minZ'+b.minZ.toFixed(1)+' maxZ'+b.maxZ.toFixed(1)+' i'+i+']'; break; } }"
     +"for(let i=0;i<CYLS.length;i++){ const c=CYLS[i]; if(c.y0===hit){ out+=' ←C[x'+c.x.toFixed(1)+' z'+c.z.toFixed(1)+' r'+c.r.toFixed(2)+' i'+i+']'; break; } } }"
   +"return out; })()"); const site=G('_jx===1e9?"fallback":_jx.toFixed(1)'); return 'px='+G('player.pos.x').toFixed(1)+' pz='+G('player.pos.z').toFixed(1)+' site_jx='+site+' py='+G('player.pos.y').toFixed(3)+' | '+w; })());
// ③-2 起跳: headCeilClamp 穿越窗接管, 头顶钳位在棚底-1.7 = p0+1.02, 全程无横推 (不出护栏)
G("keys.Space=true; globalThis._maxY=-1e9; globalThis._maxD=0;"
 +"for(let i=0;i<120;i++){ updatePlayer(1/60); if(player.pos.y>_maxY)_maxY=player.pos.y;"
 +"_maxD=Math.max(_maxD,Math.abs(player.pos.x-_jx),Math.abs(player.pos.z-_jz)); } keys.Space=false;");
assert('③-2 护栏顶起跳: 头顶钳位 (max ≤ 棚底-1.7+1e-4, 永不探棚)',G('_maxY')<=G('_p0+2.72-1.7+1e-4')&&G('_maxY')>G('_p0+0.97'),`maxY=${G('_maxY').toFixed(3)} 上限=${G('_p0+1.02').toFixed(3)}`);
assert('③-3 全程无横向挤出 (|dx|,|dz| ≤ 0.05m —— 旧版此处被屋面板横推甩出护栏)',G('_maxD')<=0.05,`maxD=${G('_maxD').toFixed(3)}`);
// 档 B = 头探棚 0~0.2m (红砖两楼旧档): 棚底 p0+2.50 (站头 2.65 探入 0.15) —— 正落在改窗差异带
// (新窗 (2.45,2.65] 含 2.50 ⇒ 拦; 旧 6cm 窗 [2.59,2.65] 不含 ⇒ 放行起跳撞棚横推 = 旧穿墙形状)。
G("globalThis._roof2={minX:_jx-3,maxX:_jx+3,minZ:_jz-3,maxZ:_jz+3,minY:_p0+2.50,maxY:_p0+2.59,dead:false}; BOXES.push(_roof2);"
 +"player.vel.set(0,0,0); player.pos.set(_jx,_p0+0.95,_jz); player.onGround=true;");
assert('③-4 头探棚 0.15m 档 (站头 2.65 vs 棚底 2.50): headGrazeBlocked=true (起跳就地拦下)',G('headGrazeBlocked(player.pos)')===true);
// ③-5 探入档起跳: 预检拦下 ⇒ 全程不离开站位零横推 (旧窗放空的形状 = 起跳穿越撞棚被压回 0.80 下潜)
G("globalThis._pMaxY=-1e9; globalThis._pMinY=1e9; globalThis._pMaxD=0; keys.Space=true;"
 +"for(let i=0;i<60;i++){ updatePlayer(1/60); if(player.pos.y>_pMaxY)_pMaxY=player.pos.y;"
 +"if(player.pos.y<_pMinY)_pMinY=player.pos.y;"
 +"_pMaxD=Math.max(_pMaxD,Math.abs(player.pos.x-_jx),Math.abs(player.pos.z-_jz)); } keys.Space=false;"
 +"player.vel.set(0,0,0); player.pos.set(_jx,_p0+0.95,_jz); player.onGround=true;");
assert('③-5 探入档起跳被拦 (全程 pos.y ≥ 站位-1e-4 不起跳不下潜; 零横推 ≤0.05)',G('_pMinY')>=G('_p0+0.95')-1e-4&&G('_pMaxD')<=0.05,`minY=${G('_pMinY').toFixed(3)} maxD=${G('_pMaxD').toFixed(3)}`);
G("BOXES.splice(BOXES.indexOf(_roof2),1);");
// 眼线 skip 通用档 (独立场地 site2 = 站位东侧 2.5m, 自动净空搜索 —— 站位处我的护栏盒本身就是
// 胸高带障碍, 会推 probe): 盒/柱底放进改窗差异带 (眼线 1.5, 旧头顶线 1.7] —— 新门 skip (零作为),
// N1/N2 还原旧门后不 skip (推离) ⇒ 亲见转红。site2 只跑 collideMove 直调, 不吃地形高程。
G("globalThis._s2=0; for(let k=0;k<40;k++){ globalThis._spx=_jx+2.5+k*2;"
 +"globalThis._sp={x:_spx,y:_p0+0.2,z:_jz}; collideMove(_sp,0.42);"
 +"if(Math.abs(_sp.x-_spx)<=1e-9&&Math.abs(_sp.z-_jz)<=1e-9){ _s2=_spx; break; } }"
 +"if(!_s2){ _s2=_jx+2.5; }"
 +"globalThis._ov={minX:_s2-0.6,maxX:_s2+0.6,minZ:_jz-0.6,maxZ:_jz+0.6,minY:_p0+1.75,maxY:_p0+2.6,dead:false}; BOXES.push(_ov);"
 +"globalThis._cp={x:_s2,y:_p0+0.2,z:_jz}; collideMove(_cp,0.42);");
assert('③-6 眼线以上盒 (底进差异带 1.55): collideMove 零作为 (x/y/z 全零位移)',Math.abs(G('_cp.x-_s2'))<=1e-9&&Math.abs(G('_cp.z-_jz'))<=1e-9&&Math.abs(G('_cp.y-_p0-0.2'))<=1e-9,`dx=${G('_cp.x-_s2')} dy=${G('_cp.y-_p0-0.2')} dz=${G('_cp.z-_jz')}`);
// 负对照: 胸墙 (眼线以下) 照推 —— skip 门不豁免落地墙。
G("globalThis._wall={minX:_jx+0.3,maxX:_jx+3,minZ:_jz-3,maxZ:_jz+3,minY:_p0-1,maxY:_p0+1.4,dead:false}; BOXES.push(_wall);"
 +"globalThis._wp={x:_jx,y:_p0+0.2,z:_jz}; collideMove(_wp,0.42);");
assert('③-7 负对照: 胸墙照常横推 (推离至半径 0.42 外)',G('_wp.x')<=G('_jx')+0.3-0.42+1e-6,`x=${G('_wp.x').toFixed(3)}`);
// 柱门同规 (CYLS): 柱摆在 site2 东 0.7 (圆心不进 probe, 真实 gameplay 形状; 推离判定 = 柱面+半径 0.92)。
G("BOXES.splice(BOXES.indexOf(_ov),1); BOXES.splice(BOXES.indexOf(_wall),1);"
 +"globalThis._c0=CYLS.length; CYLS.push({x:_s2+0.7,z:_jz,r:0.5,y0:_p0+1.75,y1:_p0+2.6});"
 +"globalThis._cq={x:_s2,y:_p0+0.2,z:_jz}; collideMove(_cq,0.42);");
assert('③-8 眼线以上柱 (底进差异带 1.55): collideMove 零作为 (柱门同规)',Math.abs(G('_cq.x-_s2'))<=1e-9&&Math.abs(G('_cq.z-_jz'))<=1e-9,`dx=${G('_cq.x-_s2')} dz=${G('_cq.z-_jz')}`);
G("CYLS.push({x:_s2+0.7,z:_jz,r:0.5,y0:_p0,y1:_p0+1.2});"
 +"globalThis._wq={x:_s2,y:_p0+0.2,z:_jz}; collideMove(_wq,0.42);");
assert('③-9 负对照: 眼线以下柱照推 (推离至柱面+半径 0.92 外)',G('_wq.x')<=G('_s2')+0.7-0.5-0.42+1e-6,`x=${G('_wq.x').toFixed(3)}`);
// 卫生: 摘盒摘柱 + 玩家归位 + 网格还原
G("CYLS.splice(CYLS.length-2,2); BOXES.splice(BOXES.indexOf(_roof),1); BOXES.splice(BOXES.indexOf(_rail),1);"
 +"player.pos.set(_jx,_p0,_jz); player.vel.set(0,0,0); player.onGround=true; window.RGRID_OFF=false;");
assert('③-10 探针卫生: 测试盒/柱全摘 (BOXES/CYLS.length 还原)',G('BOXES.length')===G('_n0')&&G('CYLS.length')===G('_c0'),`盒=${G('BOXES.length')}/${G('_n0')} 柱=${G('CYLS.length')}/${G('_c0')}`);
}

// ── 汇总 ─────────────────────────────────────────────────────
console.log('\n──────────────────────────────');
console.log(`  ${NEG?'NEG':'正向'} ${OK.length} 绿 / ${BAD.length} 红`);
if(BAD.length){ console.log('  红名: '+BAD.join(' · ')); process.exitCode=1; }
