// ─────────────────────────────────────────────────────────────
// dev/verify-restart2-20261114.js —— 2026-11-14 重开局系统性BUG批 (RGRID 脏下标×树篱焦黑×killcam 收账)
//   病灶 (用户实报"一局结束后重开一局: 地图静态/没有载具/UI消失/彻底卡死" + "回主页航拍树篱焦黑"):
//   ① 残骸动态碰撞盒 (Tank.die→registerDynCollider→addBoxCollider) 局内把 BOXES 撑大并把下标写进
//     RGRID.boxCells; restorePristineWorld 只 _wsnTrim 数组不重建索引 —— 2026-11-11 性能批把 NAV.refresh
//     改成"集合变更才重建"后, 23b 的无参调用在 _colIdxDirty=false 时**不重建**, 脏下标带进新一局 ⇒
//     standHeight/raycastWorld/eachBoxNear 喂 BOXES[bi]=undefined 抛 TypeError, 被 24-main 帧级护栏
//     吞掉 = 四症状同根 (startMatch 死在 new Tank 之前=没载具; updateHUD 永不到=UI消失; 帧帧早退=静态/卡死)。
//     修: 23b NAV.refresh(true) 强制重建 (04-collision.js:11 注释承诺的 forceFull 口径) + 查询点脏下标守卫。
//   ② 树篱/枯树/竹丛/蕨丛焦黑 = vanishFlora 换 m.material (_charredFloraMat), 既不进快照也不还原 ⇒
//     回主页航拍焦黑残留。修: WSN.flora 快照补拍 mm (原材质引用) + ⑤ 循环写回。
//   ③ killcam 中回主页: returnToMenu 补第四点收账 (grayscale 滤镜+☠角标不再挂到菜单上)。
// 用法: node dev/verify-restart2-20261114.js [--neg]
//   --neg = 阴性对照 (4 补丁, 全部单行/单串锚; ①段源码断言按惯例读原始文件, NEG 下保持绿, 红全在行为段):
//     N1 23b NAV.refresh(true)→() → ②-4 索引零脏下标 红 (次生: ②-5/③-2 —— N3 同摘时脏下标真炸)
//     N2 23b mm 快照行摘 → ⑤-3 焦黑材质还原 红
//     N3 04-collision eachBoxNear 守卫行摘 → ④-1/④-2 脏下标单测 红 (④-2 经 N1 残留脏盒下标级联)
//     N4 22-hud returnToMenu killcamEnd 行摘 → ⑥-1 killcam 收账 红
// 口径: 与 verify-restart-20261114 同款 boot (真 three + bootstub); 残骸链走真 Tank.die。
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
// bootstub 元素工厂的 classList 是 no-op 版 (contains 恒 false) —— ⑥ kcInd 断言需要真语义, 补 Set 版
// (2026-11-11 成就批同款先例); 只影响本探针沙箱。
document.createElement=(t)=>{ const e=patchStyle(c(t)); if(e&&e.classList&&!e.classList.__sfSet){ const s=new Set();
 e.classList={__sfSet:true,add(...k){ for(const x of k) s.add(x); },remove(...k){ for(const x of k) s.delete(x); },
 toggle(k,v){ if(v===undefined) v=!s.has(k); if(v) s.add(k); else s.delete(k); return v; },contains(k){ return s.has(k); }}; }
 return e; };
document.querySelector=(s)=>patchStyle(q(s));
}

// ── 阴性对照 (全部单行/单串锚, 不吃多行 CRLF 坑) ──
const PATCHES=[
 // N1 病灶还原: 世界还原不强制重建索引 (无参=自适应, _colIdxDirty=false 时脏下标残留)
 ['js/23b-worldrestore.js','NAV.refresh(true);','NAV.refresh();'],
 // N2 病灶还原: flora 快照不拍原材质引用 (焦黑材质档还原失联)
 ['js/23b-worldrestore.js','if(rec.meshes) st.mm=rec.meshes.map(m=>(m&&m.material)?m.material:null);',''],
 // N3 病灶还原: eachBoxNear 脏下标守卫摘除 (守卫行注释全文唯一, 与 raycastWorld 档区分)
 ['js/04-collision.js','if(bi>=BOXES.length) continue;   // ★2026-11-14 重开局批: 脏下标守卫 —— 索引重建前 (23b NAV.refresh(true)) 的窗口期, boxCells 可能仍持越界下标, 喂 fn(undefined) 会在回调里抛 TypeError',''],
 // N4 病灶还原: returnToMenu 不收 killcam 账
 ['js/22-hud.js',"if(typeof killcamEnd==='function') killcamEnd();",''],
];
const PATCH_MAP={};
if(NEG) for(const [f,from,to] of PATCHES){
 const s=PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f);
 if(s.indexOf(from)<0) throw new Error('阴性对照锚点未找到: '+f+' :: '+from.slice(0,70));
 PATCH_MAP[f]=s.split(from).join(to);
}
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f));

// ── ① 源码防回退 ─────────────────────────────────────────────
section('① 源码防回退 (索引重建+脏下标守卫+mm 快照+killcam 收账)');
{
const s23=SRC('js/23b-worldrestore.js'), s04=SRC('js/04-collision.js'), s22=SRC('js/22-hud.js'), shtml=SRC('index.html'), scss=SRC('css/style.css'), s24=SRC('js/24-main.js');
assert('①-1 23b: NAV.refresh(true) 强制重建索引 (★本批核心修点)',s23.includes('NAV.refresh(true);'));
assert('①-2 04-collision: eachBoxNear/eachCylNear/raycastWorld 四处脏下标守卫',
 (s04.split('if(bi>=BOXES.length) continue;').length-1)>=2
 &&s04.includes('if(ci>=CYLS.length) continue;')
 &&s04.includes('if(cy2>=CYLS.length) continue;'));
assert('①-3 23b: flora 快照拍 mm (原材质引用) + 还原写回',
 s23.includes('if(rec.meshes) st.mm=rec.meshes.map(m=>(m&&m.material)?m.material:null);')
 &&s23.includes('if(st.mm&&r.meshes) for(let i=0;i<r.meshes.length;i++){'));
assert('①-4 22-hud: returnToMenu 收 killcamEnd (第四点收账)',s22.includes("if(typeof killcamEnd==='function') killcamEnd();"));
assert('①-5 24-main 首错上屏 loopErrBar (护栏不再静默) + index.html/css 元素在位',
 s24.includes("getElementById('loopErrBar')")&&shtml.includes('<div id="loopErrBar">')&&scss.includes('#loopErrBar'));
}

// ── 沙箱装载 (与 verify-restart-20261114 同款 boot) ──────────
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
G("globalThis.confirm=function(){return true;};");   // 沙箱无 confirm, 测试钉 true (真机原生有)

// ── ② 残骸碰撞盒→世界还原→索引干净 (四症状同根的核心链) ────
section('② 残骸→还原→索引: 打爆坦克 (BOXES 增长+索引登记) → restorePristineWorld → 零脏下标');
let e0=null;
try{ G("document.getElementById('startBtn').onclick(); document.getElementById('hubLaunchBtn').onclick();"); }catch(e){ e0=String(e&&e.stack||e).split('\n').slice(0,3).join(' | '); }
assert('②-1 首局开战 (matchRunning)',!e0&&G('matchRunning')===true,e0||'');
G("for(let i=0;i<90;i++) loop();");
G("globalThis._boxN0=BOXES.length;");
try{ G("globalThis._tk=tanks.find(function(t){return t.alive;}); globalThis._wx=_tk.pos.x; globalThis._wz=_tk.pos.z; _tk.takeDmg(1e6,player,true);"); }catch(e){ e0=String(e&&e.stack||e).split('\n').slice(0,3).join(' | '); }
G("for(let i=0;i<10;i++) loop();");
assert('②-2 坦克残骸注册动态碰撞盒 (BOXES 增长 ≥3)',!e0&&G('BOXES.length')>G('_boxN0'),
 e0||('BOXES '+G('_boxN0')+'→'+G('BOXES.length')));
try{ G("globalThis._r=restorePristineWorld();"); }catch(e){ e0=String(e&&e.stack||e).split('\n').slice(0,3).join(' | '); }
assert('②-3 世界还原成功 (返回 true; BOXES 截回开局长度)',!e0&&G('_r')===true&&G('BOXES.length')===G('_boxN0'),e0||st2());
function st2(){ return 'BOXES='+G('BOXES.length')+'/'+G('_boxN0'); }
const stale=G("(function(){ var n=0; for(var ci=0;ci<RGRID.boxCells.length;ci++){ var a=RGRID.boxCells[ci]; for(var k=0;k<a.length;k++) if(a[k]>=BOXES.length) n++; } for(var ci2=0;ci2<RGRID.cylCells.length;ci2++){ var b=RGRID.cylCells[ci2]; for(var k2=0;k2<b.length;k2++) if(b[k2]>=CYLS.length) n++; } return n; })()");
assert('②-4 ★RGRID 零脏下标 (boxCells/cylCells 全部 < 数组长; N1 靶)',stale===0,'脏下标数='+stale);
const q=G("(function(){ try{ var h=standHeight(_wx,_wz,0); var rc=raycastWorld(V3(_wx,40,_wz),V3(0,-1,0),60); return 'ok:'+(typeof h)+':'+(rc===null||typeof rc==='object'); }catch(e){ return 'throw:'+String(e&&e.message||e); } })()");
assert('②-5 还原后残骸位查询不炸 (standHeight/raycastWorld)',String(q).indexOf('ok:')===0,String(q));

// ── ③ 复开→载具照常刷新 (症状② 的直接判据) ─────────────────
section('③ 复开: startMatch 全程跑完 → 载具/Bot 照常刷新');
try{ G("document.getElementById('hubLaunchBtn').onclick();"); }catch(e){ e0=String(e&&e.stack||e).split('\n').slice(0,3).join(' | '); }
assert('③-1 复开成功 (matchRunning / matchOver 清账)',!e0&&G('matchRunning')===true&&G('matchOver')===false,e0||'');
assert('③-2 ★载具照常刷新 (tanks>0; N1 次生靶: startMatch 被脏下标截断=new Tank 之前死)',G('tanks.length')>0,'tanks='+G('tanks.length'));
G("for(let i=0;i<90;i++) loop();");
assert('③-3 复开后 90 帧稳定 (战局存续, Bot/坦克更新不炸)',G('matchRunning')===true&&G('menuHold')===false,'');

// ── ④ 查询点脏下标守卫单测 (即使索引没重建也不炸) ────────────
section('④ 单测: 人造脏下标 → 查询点守卫 (N3 靶)');
{
const box=G("(function(){ try{ var N=RGRID.N, mid=((N>>1)*N+(N>>1)); var bi=BOXES.length+7; RGRID.boxCells[mid].push(bi); var cell=RGRID.cell, off=RGRID.off; var i=mid%N, j=Math.floor(mid/N); var x=i*cell-off+0.5, z=j*cell-off+0.5; var h=standHeight(x,z,0); var rc=raycastWorld(V3(x,30,z),V3(0,-1,0),50); var ud=null; eachBoxNear(x-1,z-1,x+1,z+1,function(b){ if(b===undefined) ud=true; }); RGRID.boxCells[mid].pop(); return (typeof h==='number'&&rc!==undefined&&!ud)?'ok':'bad:h='+(typeof h)+',ud='+!!ud; }catch(e){ return 'throw:'+String(e&&e.message||e); } })()");
assert('④-1 盒脏下标: standHeight/raycastWorld/eachBoxNear 全不炸且不喂 undefined',box==='ok',box);
const cyl=G("(function(){ try{ var N=RGRID.N, mid=((N>>1)*N+(N>>1)); var ci=CYLS.length+3; RGRID.cylCells[mid].push(ci); var cell=RGRID.cell, off=RGRID.off; var i=mid%N, j=Math.floor(mid/N); var x=i*cell-off+0.5, z=j*cell-off+0.5; var h=standHeight(x,z,0); RGRID.cylCells[mid].pop(); return (typeof h==='number')?'ok':'bad'; }catch(e){ return 'throw:'+String(e&&e.message||e); } })()");
assert('④-2 柱脏下标: standHeight 不炸 (_shCylCb 不读 undefined)',cyl==='ok',cyl);
}

// ── ⑤ 树篱焦黑 → 还原回原材质 (症状⑤) ──────────────────────
section('⑤ 树篱/枯树焦黑材质还原 (N2 靶)');
{
const kind=G("(function(){ var out=null; FLORA_HASH.forEach(function(arr){ (arr||[]).forEach(function(r){ if(!out&&r&&!r.dead&&r.meshes&&r.meshes[0]&&r.meshes[0].material) out=r; }); }); globalThis._hrec=out; return out?out.kind:'NONE'; })()");
assert('⑤-1 图内有 per-mesh 植被 (树篱/枯树/竹丛/蕨丛)',kind!=='NONE','kind='+kind);
if(kind!=='NONE'){
const burnt=G("(function(){ try{ globalThis._origMat=_hrec.meshes[0].material; vanishFlora(_hrec,false,true); return (_hrec.meshes[0].material===_charredFloraMat)?'ok':'bad:材质未换'; }catch(e){ return 'throw:'+String(e&&e.message||e); } })()");
assert('⑤-2 vanishFlora(charred) 换焦黑材质 (_charredFloraMat 单例)',burnt==='ok',burnt);
G("restorePristineWorld();");
const restored=G("(function(){ var m=_hrec.meshes[0].material; var mm=WSN.flora.some(function(st){ return st.r===_hrec&&st.mm&&st.mm.length&&st.mm[0]===_origMat; }); return (m===_origMat&&m!==_charredFloraMat&&mm)?'ok':'bad:mm账='+mm; })()");
assert('⑤-3 ★还原后材质回原始档 (不再是焦黑; N2 靶)',restored==='ok',restored);
}else{
assert('⑤-2 vanishFlora 焦黑换材质 (跳过: 本图无 per-mesh 植被)',true,'本图无样本, 换图跑');
assert('⑤-3 ★还原后材质回原始档 (跳过)',true,'本图无样本, 换图跑');
}
}

// ── ⑥ killcam 中回主页 → 收账 (N4 靶) ───────────────────────
section('⑥ returnToMenu 补 killcam 收账 (N4 靶)');
{
try{ G("matchOver=true; player.killcam={t:1}; renderer.domElement.style.filter='grayscale(0.62)'; document.getElementById('kcInd').classList.remove('hidden'); returnToMenu();"); }catch(e){ e0=String(e&&e.stack||e).split('\n').slice(0,3).join(' | '); }
const kc=G("(function(){ return {f:(renderer.domElement.style.filter||'none'),ind:document.getElementById('kcInd').classList.contains('hidden'),kc:player.killcam===null}; })()");
assert('⑥-1 ★回主页收账: 滤镜还原 none + ☠角标隐藏 + player.killcam 清账 (N4 靶)',
 !e0&&kc.f==='none'&&kc.ind===true&&kc.kc===true,JSON.stringify(kc)+' '+(e0||''));
G("document.getElementById('hubLaunchBtn').onclick(); for(let i=0;i<30;i++) loop();");   // 收尾回战局, 留干净现场
}

// ── 汇总 ─────────────────────────────────────────────────────
console.log('\n──────────────────────────────');
console.log(`  ${NEG?'NEG':'正向'} ${OK.length} 绿 / ${BAD.length} 红`);
if(BAD.length){ console.log('  红名: '+BAD.join(' · ')); process.exitCode=1; }
