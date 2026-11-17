// ─────────────────────────────────────────────────────────────
// dev/verify-aircollide-20261110.js —— 2026-11-10 空情三虫批验收
//   ① 空中撞楼: 机体扫掠线段 (旧位→新位) vs BOXES/CYLS 相交 = 撞楼机毁
//     (旧版只查 planeFloorY 地形/水面地板 ⇒ 飞机直穿楼房/塔/烟囱; 树/柳/竹=foliage 豁免)
//   ② 坠地机毁人亡: Plane.die(attacker,crash) — 坠地/撞楼/撞机传 crash=true ⇒ 玩家不走
//     AUTO_EXIT_VEH 自动跳伞 (旧版坠地瞬间还开伞 = "过于非人类"); 火力系机毁 (被击落/烧毁) 照旧可跳伞
//   ③ 空中撞机双亡: updatePlaneCollisions(dt) — 心距<机体半径和 (1.7×size) 且相对速度收拢>2m/s
//     ⇒ 双方 die(crash=true) 同时机毁人亡; 收拢门豁免同速并行编队/出生相邻; dt<=0 (时停/布势) 不判
// 用法: node dev/verify-aircollide-20261110.js [--neg] [--only=N]
//   --neg = 阴性对照 (6 补丁, 对认按红名): N1 扫掠命中分支摘除 / N2 crash 豁免摘除 (die 门) /
//   N3 坠地档摘除 (调用点) / N4 撞机早退摘除 / N5 收拢门摘除 / N6 foliage 豁免摘除。
//   --only=N = 只打第 N 个补丁 (N5 被 N4 掩盖 / N6 被 N1 掩盖, 须单补丁亲见转红)。
// 口径: 与 verify-vehburn-20261109 同款 boot (真 three + index.html 全脚本链 + startBtn 开局);
//   场地自适应扫描 (空旷走廊/孤立树, 不钉具体坐标 ⇒ 对布局随机免疫, mgSpot 教训)。
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
// --only=N = 只打第 N 个补丁 (N5 被 N4 掩盖: 撞机函数早退在收拢门之前; N6 被 N1 掩盖:
//   扫掠命中分支摘除后 foliage 豁免无从致死 — 累积掩盖, 单补丁亲见转红, loiterview 批先例)
const PATCHES_ALL=[
 // N1 病灶还原: 扫掠命中分支摘除 (飞机重新穿楼)
 ['js/16-aircraft.js','if(_plSwHit.on){','if(false){ // NEG N1'],
 // N2 病灶还原: die crash 豁免摘除 (坠地/撞楼/撞机重新跳伞)
 ['js/16-aircraft.js','else if(!crash&&AUTO_EXIT_VEH&&player.alive&&typeof autoExitWreck===\'function\'){ autoExitWreck(this,true); }','else if(AUTO_EXIT_VEH&&player.alive&&typeof autoExitWreck===\'function\'){ autoExitWreck(this,true); } // NEG N2'],
 // N3 病灶还原: 坠地调用点摘除 crash 档
 ['js/16-aircraft.js','if(this.pos.y<gh+2) this.die(this.lastHitBy||null,true); // crash 档 (三虫批②): 坠地=机毁人亡, 不再自动跳伞','if(this.pos.y<gh+2) this.die(this.lastHitBy||null); // NEG N3'],
 // N4 病灶还原: 撞机函数整体早退 (空中重新互穿)
 ['js/16-aircraft.js','if(!(dt>0)||planes.length<2) return;','return; if(!(dt>0)||planes.length<2) return; // NEG N4'],
 // N5 病灶还原: 收拢门摘除 (同速并行编队也判撞)
 ['js/16-aircraft.js','if((_plColVa.x-_plColVb.x)*dx+(_plColVa.y-_plColVb.y)*dy+(_plColVa.z-_plColVb.z)*dz<=PLANE_COL_CLOSE) continue;','if(false) continue; // NEG N5'],
 // N6 病灶还原: foliage 豁免摘除 (掠树即死)
 ['js/16-aircraft.js','if(c.dead||c.foliage||_plSwHit.on) return;','if(c.dead||_plSwHit.on) return; // NEG N6'],
];
const _onlyArg=NEG?(process.argv.find(a=>a.startsWith('--only='))||''):''; // '5'/'6'...
const PATCHES=_onlyArg?PATCHES_ALL.filter((p,i)=>String(i+1)===_onlyArg.slice(7)):PATCHES_ALL;
const PATCH_MAP={};
if(NEG) for(const [f,from,to] of PATCHES){
 const s=PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f);
 if(s.indexOf(from)<0) throw new Error('阴性对照锚点未找到: '+f+' :: '+from.slice(0,70));
 PATCH_MAP[f]=s.split(from).join(to);
}
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f));

// ── ① 源码防回退 ─────────────────────────────────────────────
section('① 源码防回退 (修好的写法在 / 旧写法不在)');
{
const s16=SRC('js/16-aircraft.js'), s05b=SRC('js/05b-props.js'), s24=SRC('js/24-main.js'),
      s22=SRC('js/22-hud.js'), ih=SRC('index.html'), gf=SRC('dev/_game_files.txt');
assert('16-aircraft: die(attacker,crash,bld) 签名 + crash 豁免门 (!crash&&AUTO_EXIT_VEH) + 注记 (2026-11-14 跟码: 撞楼档第三参)',
 s16.includes('die(attacker,crash,bld){')&&s16.includes('else if(!crash&&AUTO_EXIT_VEH&&player.alive')
 &&s16.includes('crash 档豁免 (2026-11-10 三虫批②)'));
assert('16-aircraft: 坠地调用点带 crash 档 + 撞楼调用点带 crash+bld 档 (2026-11-14 跟码: 撞楼 die(...,true,true), 坠地 die(...,true) 恰一处)',
 s16.includes('if(this.pos.y<gh+2) this.die(this.lastHitBy||null,true);')
 &&(s16.match(/this\.die\(this\.lastHitBy\|\|null,true\);/g)||[]).length===1
 &&s16.includes('this.die(this.lastHitBy||null,true,true);'));
assert('16-aircraft: 撞楼扫掠三件套 (_plSwTake/盒回调/柱回调) + foliage 豁免门 + 机鼻余量',
 s16.includes('function _plSwTake(r){')&&s16.includes('function _plSwBoxCb(b){')&&s16.includes('function _plSwCylCb(c){')
 &&s16.includes('if(c.dead||c.foliage||_plSwHit.on) return;')&&s16.includes('_swmv+this.def.size*1.5'));
assert('16-aircraft: update 内扫掠块 (起点捕获 + reach + eachBoxNear/eachCylNear + 命中即 die+return)',
 s16.includes('const _swx0=this.pos.x, _swy0=this.pos.y, _swz0=this.pos.z;')
 &&s16.includes('eachBoxNear(Math.min(_swx0,this.pos.x)-_mrg')&&s16.includes('eachCylNear(Math.min(_swx0,this.pos.x)-_mrg')
 &&(s16.match(/if\(_plSwHit\.on\)\{\r?\n/g)||[]).length>=1);
assert('16-aircraft: updatePlaneCollisions 单源 (BODY_K=1.7 / CLOSE=2 / fwdDir 速度槽零分配 / 双 die crash 档)',
 s16.includes('const PLANE_COL_BODY_K=1.7, PLANE_COL_CLOSE=2;')
 &&s16.includes('function updatePlaneCollisions(dt){')&&s16.includes('if(!(dt>0)||planes.length<2) return;')
 &&s16.includes('const aPilot=a.playerDriven?player:(a.crewBot||a.crew);')
 &&s16.includes('a.die(bPilot,true);')&&s16.includes('b.die(aPilot,true);'));
assert('05b-props: foliage 标记恰好四处 (树/枯树/垂柳/竹)',(s05b.match(/foliage:true/g)||[]).length===4);
assert('24-main: 撞机接线在飞机循环之后 (世界帧长 dt 门)',s24.includes('updatePlaneCollisions(dt); // 空中撞机'));
assert('22-hud: sf_autoexit 注记跟走 (crash 档不读开关)',s22.includes('坠地/撞楼/空中撞机时**不**读此开关'));
assert('版本戳 20261118c: index.html ≥48 处 + __sfStyleVer + _game_files 45 行 + 旧 20261110a 清零 (判据跟码: 本批 a→b)',
 [...ih.matchAll(/20261118c/g)].length>=48&&ih.includes("window.__sfStyleVer='20261118c';")
 &&gf.split(/\r?\n/).filter(l=>l.includes('?v=20261118c')).length===45
 &&!ih.includes('20261110a')&&!gf.includes('20261110a'));
}

// ── 沙箱装载 (真 three; 与 verify-vehburn 同款 boot) ──────────
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
	ctx.localStorage={_s:{sf_campaign:String(campIdx),sf_exp:'0',sf_pseed:'424242'},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
	for(const f of FILES){ vm.runInContext(srcOf(f),ctx,{filename:f}); }
	return ctx;
}
let IDX=-1;
{ const c0=boot(0); IDX=vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="normandy")',c0); }
const ctx=boot(IDX);
const G=s=>vm.runInContext(s,ctx,{timeout:300000});
let err=null;
try{ G("document.getElementById('startBtn').onclick();"); }catch(e){ err='start: '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); }
if(!err) try{ G("player.team=0; player.cls=0; player.spectator=false; player.alive=true; player.deployed=true;"); }catch(e){ err='playerInit: '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); }
assert('② 前置: 开局+玩家就位+飞机编制',!err&&G('typeof planes==="object"&&planes.length>=2')===true,err||'');

// ── ② 场地: 自适应空旷走廊 (对布局随机免疫) ──────────────────
section('② 场地: 自适应空旷走廊 CF (38m 直走廊, 无盒无柱地形平缓)');
{
G("globalThis.CF=null; { const R=MAP_SIZE/2-70; const tallBox=(x0,z0,x1,z1,gy)=>{ for(const b of BOXES){ if(b.dead) continue; if(b.maxX<x0||b.minX>x1||b.maxZ<z0||b.minZ>z1) continue; if(b.maxY>gy-0.4&&b.minY<gy+1.5) return true; } return false; }; const tallCyl=(x0,z0,x1,z1,gy)=>{ for(const c of CYLS){ if(c.dead||c.foliage) continue; if(c.x<x0-(c.r+1.5)||c.x>x1+(c.r+1.5)||c.z<z0-(c.r+1.5)||c.z>z1+(c.r+1.5)) continue; if(c.y1>gy-0.4&&c.y0<gy+1.5) return true; } return false; }; for(let z=-R;z<=R&&CF===null;z+=13)for(let x=-R;x<=R-44;x+=13){ const gh=heightAt(x,z); if(gh<1||gh>45) continue; if(occBlocked(x,z)) continue; let flat=true; for(let xx=x-4;xx<=x+40&&flat;xx+=3){ if(Math.abs(heightAt(xx,z)-gh)>2) flat=false; } if(!flat) continue; if(tallBox(x-6,z-6,x+40,z+6,gh+5)) continue; if(tallCyl(x-6,z-6,x+40,z+6,gh+5)) continue; CF={x:x,z:z,gh:gh}; break; } }");
assert('②-1 空旷走廊已找到 (三虫批①/③ 行为测试场地; 只挡够到飞行高度 gh+5 的障碍 — 矮篱笆/树丛从机腹上方掠过)',G('!!CF')===true,G('CF?("x="+CF.x.toFixed(0)+" z="+CF.z.toFixed(0)+" gh="+CF.gh.toFixed(1)):"全图无满足段"'));
}

// ── ③ 行为: 空中撞楼 ────────────────────────────────────────
section('③ 空中撞楼: 合成碰撞盒 30m 正前方, 平飞撞入 = 机毁 (非坠地档)');
{
G("globalThis._dsCalls=0; { const _ds=damageStructures; damageStructures=function(p,r,a,t){ globalThis._dsCalls++; return _ds(p,r,a,t); }; }");
G("globalThis.B1=addBoxCollider(CF.x+30,CF.gh+5,CF.z,8,10,8); globalThis.PB=planes.find(p=>p.alive); PB.playerDriven=true; PB.crewBot=null; player.pitch=0; PB.pos.set(CF.x,CF.gh+5,CF.z); PB.yaw=Math.PI/2; PB.pitch=0; PB.speed=40; PB.fctl.bank=0; PB.fctl.pitchT=0; globalThis._wr0=planeWrecks.length; globalThis._pd=false;");
G("player.onVehicle=null; for(let i=0;i<70;i++){ PB.update(1/60); if(!PB.alive){ globalThis._pd=true; break; } }");
assert('③-1 平飞撞楼机毁 (70 帧内 alive=false; NEG N1 转: 穿楼而过仍活)',G('_pd')===true);
assert('③-2 死于撞楼而非坠地 (亡位高度 > 当地地面+2.5 — 坠地门是 gh+2)',G('PB.pos.y')>G('heightAt(PB.pos.x,PB.pos.z)+2.5'),
 'y='+G('PB.pos.y').toFixed(1)+' 地='+G('heightAt(PB.pos.x,PB.pos.z)+2.5').toFixed(1));
assert('③-3 撞楼结构受创 (damageStructures 被调 ≥1; NEG N1 转 0)',G('_dsCalls')>=1,'调 '+G('_dsCalls')+' 次');
assert('③-4 残骸已交接 (+1, die 原子隐藏链)',G('planeWrecks.length')===G('_wr0')+1);
G("killDynCollider(B1);");
}

// ── ④ 行为: foliage 豁免 (树干不撞死人) ─────────────────────
section('④ foliage 豁免: 孤立树干正中穿越 = 存活穿过 (NEG N6 转: 掠树即死)');
{
G("globalThis.TR=null; for(const t of TREE_LIVE){ if(!t.alive||t.dead||!t.cyl||t.cyl.dead) continue; if((t.s||1)*4<3.4) continue; let ok=true; for(const b of BOXES){ if(b.dead) continue; const dx=Math.max(b.minX-t.x,0,t.x-b.maxX), dz=Math.max(b.minZ-t.z,0,t.z-b.maxZ); if(dx*dx+dz*dz<64){ ok=false; break; } } if(!ok) continue; for(const c of CYLS){ if(c.dead||c===t.cyl) continue; const dx=c.x-t.x, dz=c.z-t.z; if(dx*dx+dz*dz<36){ ok=false; break; } } if(!ok) continue; if(Math.abs(heightAt(t.x-3,t.z)-t.g0)>0.3||Math.abs(heightAt(t.x+3,t.z)-t.g0)>0.3) continue; TR=t; break; }"); // ④-1 柱隔离半径 6m (36): 覆盖穿越走廊全程+机鼻扫掠余量 (3m 只护树心, 走廊末端邻柱会被最后一帧机鼻余量误杀)
assert('④-1 孤立树候选已找到',G('!!TR')===true,G('TR?("x="+TR.x.toFixed(0)+" z="+TR.z.toFixed(0)+" s="+(TR.s||1).toFixed(2)):"无候选 (normandy 树/孤立度不足)"'));
G("if(TR){ globalThis._PT=planes.find(p=>p.alive); globalThis._PT.playerDriven=true; globalThis._PT.crewBot=null; player.pitch=0; globalThis._PT.pos.set(TR.x-3,TR.g0+3.0,TR.z); globalThis._PT.yaw=Math.PI/2; globalThis._PT.pitch=0; globalThis._PT.speed=40; globalThis._PT.fctl.bank=0; globalThis._PT.fctl.pitchT=0; for(let i=0;i<10;i++){ globalThis._PT.update(1/60); if(!globalThis._PT.alive) break; } globalThis._ptAlive=globalThis._PT.alive; globalThis._ptPast=globalThis._PT.alive&&globalThis._PT.pos.x>TR.x+0.4; } else { globalThis._ptAlive=false; globalThis._ptPast=false; }"); // 手柄一律 globalThis._PT (裸名 PT 已被 08-effects.js 顶层 const PT 粒子贴图表遮蔽 — 探针坑)
assert('④-2 正中穿越树干存活且已穿过 (foliage 豁免; NEG N6 转: 死在树位)',G('_ptAlive')===true&&G('_ptPast')===true,
 G('_ptPast')?'已穿过':'未穿过');
}

// ── ⑤ 行为: 坠地机毁人亡 / 火力系照旧跳伞 ───────────────────
section('⑤ crash 档: 坠地=机毁人亡 (AUTO_EXIT_VEH 开也不跳伞); 火力系机毁照旧跳伞 (对照)');
{
G("AUTO_EXIT_VEH=true; player.alive=true; player.spectator=false; player.chute=false; globalThis.PC=planes[1]; PC.respawn(); PC.playerDriven=true; PC.crewBot=null; PC.alive=true; player.onVehicle=PC; player.pitch=-0.2;");
G("PC.pos.set(CF.x+20,CF.gh+2.3,CF.z); PC.yaw=Math.PI/2; PC.pitch=-0.2; PC.speed=40; globalThis._pcDead=false; for(let i=0;i<90;i++){ PC.update(1/60); if(!PC.alive){ globalThis._pcDead=true; break; } }");
assert('⑤-1 坠地机毁发生 (90 帧内; NEG N2/N3 转: 落地瞬间开伞存活)',G('_pcDead')===true);
assert('⑤-2 crash 档人亡 (player.alive=false; NEG N2/N3 转: 存活)',G('player.alive')===false);
assert('⑤-3 crash 档不开伞 (chute=false; NEG N2/N3 转: chute=true)',G('player.chute')!==true);
G("globalThis._PD=planes[3]; globalThis._PD.respawn(); globalThis._PD.playerDriven=true; globalThis._PD.crewBot=null; globalThis._PD.alive=true; globalThis._PD.pos.set(CF.x,80,CF.z); globalThis._PD.yaw=0; globalThis._PD.pitch=0; globalThis._PD.speed=30; player.alive=true; player.spectator=false; player.chute=false; player.onVehicle=globalThis._PD; AUTO_EXIT_VEH=true;"); // 手柄 globalThis._PD (防裸名遮蔽, 同 PT 坑)
G("globalThis._PD.takeDmg(999,null);");
assert('⑤-4 对照: 火力系机毁 (被击落) 自动跳伞照旧 (NEG 下仍绿)',G('player.alive')===true&&G('player.chute')===true&&G('player.onVehicle')===null);
G("player.chute=false; player.onGround=true; player.onVehicle=null;");
}

// ── ⑥ 行为: 空中撞机 ────────────────────────────────────────
section('⑥ 空中撞机: 迎头对冲双亡 (残骸×2/票×2/互记击杀) + crash 档 + 收拢门 + 时停门');
{
G("globalThis.PA=planes[0]; PA.respawn(); PA.playerDriven=false; PA.crewBot=null; PA.alive=true; globalThis.PB2=planes[2]; PB2.respawn(); PB2.playerDriven=false; PB2.crewBot=null; PB2.alive=true;");
// D1: 迎头对冲 (相向 40+40=80m/s 收拢, 心距 2m < 3.4m 判距)
G("PA.pos.set(CF.x,80,CF.z); PA.yaw=Math.PI/2; PA.pitch=0; PA.speed=40; PB2.pos.set(CF.x+2,80,CF.z); PB2.yaw=-Math.PI/2; PB2.pitch=0; PB2.speed=40; globalThis._tkA=tickets[PA.team]; globalThis._tkB=tickets[PB2.team]; globalThis._wrD=planeWrecks.length; PA.crew.kills=0; PB2.crew.kills=0; updatePlaneCollisions(1/60);");
assert('⑥-1 迎头对冲双亡 (NEG N4 转: 双活互穿)',G('!PA.alive&&!PB2.alive')===true);
assert('⑥-2 双残骸 (+2)',G('planeWrecks.length')===G('_wrD')+2);
assert('⑥-3 双票各-TICKET_COST.plane (机毁人亡全链; 装备票口径 plane=3, 判据跟码)',G('tickets[PA.team]')===G('_tkA-TICKET_COST.plane')&&G('tickets[PB2.team]')===G('_tkB-TICKET_COST.plane'),
 'A '+G('tickets[PA.team]')+'/'+G('_tkA')+'  B '+G('tickets[PB2.team]')+'/'+G('_tkB'));
assert('⑥-4 互记击杀 (归因=对方机组; 同队互撞 die 内 ff 门不记分)',G('PA.crew.kills===1&&PB2.crew.kills===1')===true,
 'PA.crew='+G('PA.crew.kills')+' PB2.crew='+G('PB2.crew.kills'));
// D2: crash 档 — 玩家座机撞机 = 机毁人亡不跳伞 (AUTO_EXIT_VEH 开)
G("PA.respawn(); PB2.respawn(); PA.playerDriven=true; PA.crewBot=null; PA.alive=true; PB2.playerDriven=false; PB2.crewBot=null; PB2.alive=true; AUTO_EXIT_VEH=true; player.alive=true; player.spectator=false; player.chute=false; player.onVehicle=PA;");
G("PA.pos.set(CF.x,80,CF.z); PA.yaw=Math.PI/2; PA.pitch=0; PA.speed=40; PB2.pos.set(CF.x+2,80,CF.z); PB2.yaw=-Math.PI/2; PB2.pitch=0; PB2.speed=40; updatePlaneCollisions(1/60);");
assert('⑥-5 撞机 crash 档: 玩家机毁人亡不跳伞 (NEG N2/N4 转: 跳伞/双活)',G('player.alive')===false&&G('player.chute')!==true&&G('player.onVehicle')===null);
G("player.onVehicle=null;");
// E: 收拢门 — 同速并行编队 (相对速度≈0) 不判撞
G("PA.respawn(); PB2.respawn(); PA.playerDriven=false; PB2.playerDriven=false; PA.crewBot=null; PB2.crewBot=null; PA.alive=true; PB2.alive=true;");
G("PA.pos.set(CF.x,80,CF.z); PA.yaw=Math.PI/2; PA.pitch=0; PA.speed=40; PB2.pos.set(CF.x,80,CF.z+2); PB2.yaw=Math.PI/2; PB2.pitch=0; PB2.speed=40; updatePlaneCollisions(1/60);");
assert('⑥-6 收拢门: 同速并行编队不判撞 (双活; NEG N5 转: 判撞双亡)',G('PA.alive&&PB2.alive')===true);
// F: 时停门 — dt=0 不产生新事件 (重叠+相向也绝不判; 先复活 — E 段在 --only=5 下会双亡)
G("PA.respawn(); PB2.respawn(); PA.alive=true; PB2.alive=true; PA.pos.set(CF.x,80,CF.z); PA.yaw=Math.PI/2; PA.pitch=0; PA.speed=40; PB2.pos.set(CF.x+2,80,CF.z); PB2.yaw=-Math.PI/2; PB2.pitch=0; PB2.speed=40; updatePlaneCollisions(0);");
assert('⑥-7 时停门: dt=0 不判撞 (冻结战场不产生新事件)',G('PA.alive&&PB2.alive')===true);
}

// ── ⑦ 汇总 ──
section('⑦ 汇总');
console.log(`  ${NEG?'NEG':'正向'} ${OK.length} 绿 / ${BAD.length} 红`);
if(BAD.length){ console.log('  红名: '+BAD.join(' · ')); process.exit(1); }
console.log('  verify-aircollide-20261110 全绿');
