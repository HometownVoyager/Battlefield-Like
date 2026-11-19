// ─────────────────────────────────────────────────────────────
// dev/verify-loiterfreeze-20261107.js —— 2026-11-07 实机反馈批 (巡飞弹操控定身×退场吞空格×小地图弹体中心) 验收
//   ① 操控巡飞弹期间本体定身: 观战悬停态原地悬停 (旧写 specFlightMove 消费同一份输入 ⇒ 按空格本体上升)
//   ② 气动飞行中发射 ⇒ 就地切悬停并清速度 (旧写 = 背追档里"自己一个人向前飞出", 实测 3s 飞 36m)
//   ③ 退场吞空格边沿: 操控退场瞬间仍按着空格 ⇒ 本体松开前不吃残跳/残升/残加速
//     (旧写实测: 弹死后按住空格在步行态反复起跳 = 用户实报"在地上不停跳跃"; 悬停态残升)
//   ④ 小地图: 弹体菱形标记常显 (不开大地图也可见) + 操控中以弹体为中心/朝向 (本体箭头挪实际位置)
//   ⑤ C/Z/X 姿态键操控中定身 + 面板提示 "本体定身" + 版本戳 20261120b
// 用法: node dev/verify-loiterfreeze-20261107.js [--neg]
//   --neg = 阴性对照: 单行锚还原旧写法, 行为判据必须报红 (9 处补丁, 累积应用, 对认按红名)。
// 口径: 与 verify-flyaim-loiterkey-20261106 同款 boot (真 three + index.html 全脚本链 + startBtn 开局)。
// 预期 NEG 红名: ②悬停定身(N1) + ②气动切悬停(N2) + ③退场不跳(N3/N4) + ③b悬停残升(N6) + ③c松开重按(N5)
//   + ①小地图源码钉(N7/N8) + ①源码钉(N9)。恢复类断言 (⑤回归: 普通跳/悬停升照常) 在 NEG 下仍绿。
// ─────────────────────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const NEG=process.argv.includes('--neg');
const OK=[],BAD=[];
function assert(name,cond,detail){ (cond?OK:BAD).push(name); console.log(`  ${cond?'✓':'✗'} ${name}${detail?'  '+detail:''}`); }
function section(t){ console.log('\n══ '+t+' ══'); }
const SRC=f=>fs.readFileSync(path.join(root,f),'utf8');

// ── 阴性对照 (单行锚; 20-player/22-hud 为 CRLF 混存 —— 一律单行锚规避行尾) ──
const PATCHES=[
 // N1 定身分支退回旧"观战飞行保持机动" (①②病根复现: 悬停空格=本体上升 / 气动空格=前飞)
 ['js/20-player.js','if(p.spectator&&p.flying){ p.stamina=1; p.vel.x=dampF(p.vel.x,0,8,dt); p.vel.y=dampF(p.vel.y,0,8,dt); p.vel.z=dampF(p.vel.z,0,8,dt); updateInteractHint(); return; }',
  'if(p.spectator&&p.flying){ p.stamina=1; specFlightMove(p,dt); updateInteractHint(); return; }'],
 // N2 fireLoiter 气动切悬停退场 (发射后本体沿视线继续 40m/s 前飞)
 ['js/13-combat.js','if(shooter.flying&&shooter.flyAero){ shooter.flyAero=false; shooter.vel.set(0,0,0); shooter._aeroSpd=0; }',''],
 // N3 退场吞空格边沿退场 (弹死后按住空格 → 本体连跳/残升复现; 两处同锚)
 ['js/13-combat.js','if(player.loiter===d){ player.loiter=null; player._ltSpace=!!keys.Space; }','if(player.loiter===d){ player.loiter=null; }'],
 // N4 跳跃门摘吞边沿 (同上, 步行态路径; ★2026-11-14 跟码: 批③给门尾加了 !headGrazeBlocked(p.pos), 锚跟到新门文本)
 ['js/20-player.js','if(keys.Space&&!p._ltSpace&&!cmdLock&&p.onGround&&p.stamina>0.1&&!headGrazeBlocked(p.pos)','if(keys.Space&&!cmdLock&&p.onGround&&p.stamina>0.1&&!headGrazeBlocked(p.pos)'],
 // N5 帧首清零退场 (退场吞边沿旗永不清 ⇒ 松开重按也跳不了, "松开恢复"判据红)
 ['js/20-player.js','if(!keys.Space) p._ltSpace=false;',''],
 // N6 悬停升摘吞边沿 (退场后按住空格悬停残升复现; 悬停升/自由飞行升两处同锚)
 ['js/20-player.js','if(keys.Space&&!p._ltSpace) ty+=1;','if(keys.Space) ty+=1;'],
 // N7 小地图中心回本体 (操控中地图不再以弹体为中心; 小地图+海军包装层两处同锚)
 ['js/22-hud.js','const lt=(player.alive&&player.loiter&&!player.loiter.dead)?player.loiter:null;',
  'const lt=null;'],
 // N8 小地图弹体标记摘除 (不开大地图看不到弹体复现)
 ['js/22-hud.js',"mmC.fillStyle='#3ee8d8'; mmC.fillRect(-4.5,-4.5,9,9);",''],
 // N9 气动加速摘吞边沿 (退场后按住空格再进气动直接 40 冲刺)
 ['js/20-player.js','const spd=dampF(p._aeroSpd||13,((keys.Space&&!p._ltSpace)?40:13),2.2,dt);','const spd=dampF(p._aeroSpd||13,(keys.Space?40:13),2.2,dt);'],
];
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
const s20=srcOf('js/20-player.js'), s13=srcOf('js/13-combat.js'), s19=srcOf('js/19-input.js'), s22=srcOf('js/22-hud.js'), i18n=srcOf('js/00b-i18n.js');
const cnt=(s,re)=>(s.match(re)||[]).length;
assert('20 定身分支在 (悬停态速度阻尼归零+无重力+不积分位移)',
 s20.includes('if(p.spectator&&p.flying){ p.stamina=1; p.vel.x=dampF(p.vel.x,0,8,dt); p.vel.y=dampF(p.vel.y,0,8,dt); p.vel.z=dampF(p.vel.z,0,8,dt); updateInteractHint(); return; }'));
assert('20 旧"观战飞行保持机动"分支绝迹',!s20.includes('{ p.stamina=1; specFlightMove(p,dt); updateInteractHint(); return; }'));
assert('20 _ltSpace 清零上提帧首 (全文恰 1 处, 且在 meleeCd 行之后)',
 cnt(s20,/if\(!keys\.Space\) p\._ltSpace=false;/g)===1
 &&s20.indexOf('if(!keys.Space) p._ltSpace=false;')>s20.indexOf('p.meleeCd-=dt; p.resupplyCd-=dt;'));
assert('20 跳跃门含 !p._ltSpace (★2026-11-14 跟码; 11-18b 起姿态分流: 站姿 headGrazeBlocked / 蹲趴 headJumpBlocked)',
  s20.includes('if(keys.Space&&!p._ltSpace&&!cmdLock&&p.onGround&&p.stamina>0.1&&_jumpOkay)')
  &&/headGrazeBlocked\(p\.pos\)/.test(s20)&&/headJumpBlocked\(p\.pos,_jumpHH/.test(s20));
assert('20 悬停升门含 !p._ltSpace (两处: 悬停+自由飞行)',cnt(s20,/if\(keys\.Space&&!p\._ltSpace\) ty\+=1;/g)===2);
assert('20 气动加速门含 !p._ltSpace',s20.includes('((keys.Space&&!p._ltSpace)?40:13)'));
assert('13 fireLoiter 气动→悬停切换在 (清速度+_aeroSpd)',
 s13.includes('if(shooter.flying&&shooter.flyAero){ shooter.flyAero=false; shooter.vel.set(0,0,0); shooter._aeroSpd=0; }'));
assert('13 退场吞空格边沿 (detonate+despawn 两处)',cnt(s13,/if\(player\.loiter===d\)\{ player\.loiter=null; player\._ltSpace=!!keys\.Space; \}/g)===2);
assert('19 C/Z/X 姿态键操控中定身',
 s19.includes("if(e.code==='KeyC'&&!player.loiter){")&&s19.includes("if(e.code==='KeyZ'&&!player.loiter&&!player.onMG")&&s19.includes("if(e.code==='KeyX'&&!player.loiter){"));
assert('22 小地图中心/朝向跟弹体 (小地图+海军包装层两处同布)',
 cnt(s22,/const lt=\(player\.alive&&player\.loiter&&!player\.loiter\.dead\)\?player\.loiter:null;/g)===2
 &&cnt(s22,/const cx=player\.alive\?\(lt\?lt\.pos\.x:player\.pos\.x\):0/g)===2
 &&cnt(s22,/const rot=player\.alive\?\(lt\?lt\.yaw:player\.yaw\):0;/g)===2);
assert('22 小地图弹体菱形标记在 (不开大地图也可见)',
 s22.includes("const [lpx,lpy]=toMap(player.loiter.pos.x,player.loiter.pos.z);")
 &&s22.includes("mmC.fillStyle='#3ee8d8'; mmC.fillRect(-4.5,-4.5,9,9);"));
assert('22 本体箭头挪实际位置+相对朝向 / 机器箭头 rot 单源',
 s22.includes('const _pp=toMap(player.pos.x,player.pos.z); mmC.translate(_pp[0],_pp[1]); mmC.rotate(rot-player.yaw);')
 &&s22.includes('mmC.rotate(-(pl.yaw)+rot+Math.PI);'));
assert('22 面板提示含"本体定身" / i18n 新键在旧键已摘',
 s22.includes("t2('鼠标 制导 · 左键 自爆 · 空格 加速 · 右键 开镜 · U 切换视角 · 本体定身')")
 &&i18n.includes("'鼠标 制导 · 左键 自爆 · 空格 加速 · 右键 开镜 · U 切换视角 · 本体定身':")
 &&!i18n.includes("'鼠标 制导 · 左键 自爆 · 空格 加速 · 右键 开镜 · U 切换视角':"));
const idx=SRC('index.html'), gf=SRC('dev/_game_files.txt');
assert('版本戳 20261120b: index.html ≥48 处 + __sfStyleVer + _game_files 45 行 + 旧 20261106b 清零 (2026-11-10 海战移除批判据跟码)',
 [...idx.matchAll(/20261120b/g)].length>=48&&idx.includes("window.__sfStyleVer='20261120b';")
 &&gf.split(/\r?\n/).filter(l=>l.includes('?v=20261120b')).length===45
 &&!idx.includes('20261106b')&&!gf.includes('20261106b'));
}

// ── 沙箱装载 (真 three; 与 verify-flyaim 同款 boot) ──────────
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
	createBufferSource(){ return {buffer:null,loop:false,playbackRate:AP(),start(){},stop(){},connect(){}}; }
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
	ctx.localStorage={_s:{sf_campaign:String(campIdx),sf_pseed:'424242'},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
	for(const f of FILES){ vm.runInContext(srcOf(f),ctx,{filename:f}); }
	return ctx;
}
let IDX=-1;
{ const c0=boot(0); IDX=vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="normandy")',c0); }
function bootStart(campIdx,label){
const ctx=boot(campIdx);
const G=s=>vm.runInContext(s,ctx,{timeout:300000});
let err=null;
try{ G("document.getElementById('startBtn').onclick();"); }catch(e){ err='start: '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); }
if(!err){ try{ G('if(!player.alive||!player.deployed) deployPlayer();'); }catch(e){ err='deploy: '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); } }
if(!err) try{ G('for(const s of soldiers) s.protUntil=0; player.protUntil=0;'); }catch(e){}
if(!err) try{ G('for(const s of soldiers){ if(!s.isPlayer&&!s.zombie){ s.pos.x+=800; s.pos.z+=800; s.pos.y=heightAt(s.pos.x,s.pos.z); if(s.path) s.path.length=0; } }'); }catch(e){}
assert(label+' 开局+部署',!err&&G('player.alive')===true,err||'');
return {ctx,G};
}
const A=bootStart(IDX,'② 开局');
// 控帧小工具: updatePlayer + updateLoiters (弹活着才更)
A.G("globalThis._step=(n)=>{ for(let i=0;i<n;i++){ updatePlayer(1/60); if(player.loiter&&!player.loiter.dead) updateLoiters(1/60,1/60); } };");
A.G("globalThis._reset=()=>{ if(player.loiter&&!player.loiter.dead) loiterDespawn(player.loiter); player.loiter=null; player._ltClick=false; player._ltRClick=false; player._ltSpace=false; keys.Space=false; mouseDown=false; mouse2Down=false; player.loiterView=0; player.flying=false; player.flyAero=false; player._aeroSpd=0; player.spectator=true; player.alive=true; player.crouch=false; player.prone=false; player.thirdPerson=false; player.ads=false; player.yaw=0; player.pitch=0; player.vel.set(0,0,0); player.chute=false; };");

// ── ② 悬停定身: 操控中按空格, 本体不上升 ──
section('② 操控定身: 悬停态按空格 → 本体原地悬停 (旧写 1.5s 上升 ~13m)');
{
A.G("globalThis._reset(); player.flying=true; player.flyAero=false; player.onGround=false; player.pos.y=heightAt(player.pos.x,player.pos.z)+60;");
A.G("fireLoiter(player,new THREE.Vector3(player.pos.x,player.pos.y,player.pos.z-2),new THREE.Vector3(0,0,-1));");
const y0=A.G('player.pos.y');
A.G("keys.Space=true; _step(90);");
const r=A.G("({dy:player.pos.y-"+y0.toFixed(2)+",fly:player.flying,aero:player.flyAero,spd:Math.hypot(player.vel.x,player.vel.y,player.vel.z),live:!!(player.loiter&&!player.loiter.dead)})");
assert('②-1 按住空格 90 帧 → 本体 Δy<0.5 (旧写 +13m)',Math.abs(r.dy)<0.5,`Δy=${r.dy.toFixed(2)} flying=${r.fly}`);
assert('②-2 悬停态保持 (flying=true, flyAero=false), 弹仍活',r.fly===true&&r.aero===false&&r.live===true,JSON.stringify(r));
}

// ── ③ 气动发射 → 就地切悬停清速度 ──
section('③ 气动飞行 + 空格加速中发射 → 本体切悬停清速度 (旧写 3s 前飞 36m)');
{
A.G("globalThis._reset(); player.flying=true; player.flyAero=true; player.onGround=false; player.pos.y=heightAt(player.pos.x,player.pos.z)+60; player._aeroSpd=13; keys.Space=true;");
A.G("for(let i=0;i<30;i++) specFlightMove(player,1/60);");   // 先沿视线加速到 ~40
const p0=A.G("({x:player.pos.x,z:player.pos.z,spd:player._aeroSpd})");
A.G("fireLoiter(player,new THREE.Vector3(player.pos.x,player.pos.y-0.5,player.pos.z-2),new THREE.Vector3(0,0,-1));");
const sw=A.G("({aero:player.flyAero,v:Math.hypot(player.vel.x,player.vel.y,player.vel.z)})");
A.G("_step(60);");
const p1=A.G("({x:player.pos.x,z:player.pos.z})");
const d=Math.hypot(p1.x-p0.x,p1.z-p0.z);
assert('③-1 发射瞬间气动→悬停 (flyAero=false) 且速度清零 (<0.5)',sw.aero===false&&sw.v<0.5,`flyAero=${sw.aero} |v|=${sw.v.toFixed(2)} (发射前气动 ${p0.spd.toFixed(0)} m/s)`);
assert('③-2 操控 60 帧 → 本体水平位移 <1.5m (旧写 36m)',d<1.5,`d=${d.toFixed(2)}m`);
}

// ── ④ 退场吞空格: 弹死瞬间按住空格 → 步行态不起跳, 松开重按才跳 ──
section('④ 退场吞空格 (步行): 按住空格引爆 → 不吃残跳; 松开重按恢复 (旧写"在地上不停跳跃")');
{
A.G("globalThis._reset(); player.flying=false; player.flyAero=false; player.onGround=true; player.pos.y=heightAt(player.pos.x,player.pos.z);");
A.G("keys.Space=true; fireLoiter(player,new THREE.Vector3(player.pos.x,player.pos.y+1.62,player.pos.z),new THREE.Vector3(Math.sin(0.6)*0,Math.sin(0.6),-Math.cos(0.6)).normalize()); ");
const live=A.G("!!(player.loiter&&!player.loiter.dead)");
A.G("_step(30);");
const j0=A.G("({onG:player.onGround,v:player.vel.y})");
A.G("if(player.loiter&&!player.loiter.dead) loiterDetonate(player.loiter,player.loiter.pos.clone());");
A.G("_step(90);");
const j1=A.G("({jumped:player.vel.y>1.5,y:player.pos.y-heightAt(player.pos.x,player.pos.z)})");
A.G("keys.Space=false; _step(3); keys.Space=true; _step(8);");
const j2=A.G('player.vel.y>1.5');
assert('④-1 操控中按住空格 30 帧 → 不起跳 (onGround 保持)',live&&j0.onG===true&&Math.abs(j0.v)<0.5,`live=${live} onG=${j0.onG} vy=${j0.v.toFixed(2)}`);
assert('④-2 引爆后仍按住空格 90 帧 → 不起跳 (旧写连跳不止)',j1.jumped===false,`vy 峰值态 jumped=${j1.jumped} 离地=${j1.y.toFixed(2)}m`);
assert('④-3 松开再按 → 跳跃恢复 (吞边沿只吞一次)',j2===true,`vy=${A.G('player.vel.y').toFixed(2)}`);
}

// ── ④b 退场吞空格 (悬停): 按住空格引爆 → 悬停不残升; 松开重按恢复 ──
section('④b 退场吞空格 (悬停): 引爆后按住空格 → 不残升; 松开重按恢复');
{
A.G("globalThis._reset(); player.flying=true; player.flyAero=false; player.onGround=false; player.pos.y=heightAt(player.pos.x,player.pos.z)+60;");
A.G("keys.Space=true; fireLoiter(player,new THREE.Vector3(player.pos.x,player.pos.y,player.pos.z-2),new THREE.Vector3(0,0,-1));");
A.G("_step(20);");
const y0=A.G('player.pos.y');
A.G("if(player.loiter&&!player.loiter.dead) loiterDetonate(player.loiter,player.loiter.pos.clone());");
A.G("_step(60);");
const dy=A.G("player.pos.y-"+y0.toFixed(2));
A.G("keys.Space=false; _step(3); keys.Space=true; _step(15);");
const rise=A.G('player.vel.y>1');
assert('④b-1 引爆后仍按住空格 60 帧 → 悬停不残升 (Δy<0.5, 旧写阻尼向 +11m/s)',Math.abs(dy)<0.5,`Δy=${dy.toFixed(2)}`);
assert('④b-2 松开再按 → 悬停升恢复',rise===true,`vy=${A.G('player.vel.y').toFixed(2)}`);
}

// ── ⑤ 回归: 无巡飞弹时跳跃/悬停升/气动加速逐位不变 ──
section('⑤ 回归: 无操控边界时旧行为零漂移');
{
A.G("globalThis._reset(); player.flying=false; player.onGround=true; player.pos.y=heightAt(player.pos.x,player.pos.z); keys.Space=false; _step(3);");
A.G("keys.Space=true; _step(2);");
const j=A.G("({vy:player.vel.y,onG:player.onGround})");
assert('⑤-1 普通跳跃照常 (按空格 2 帧内起跳 vy>4, 重力未衰减掉峰值)',j.vy>4&&j.onG===false,`vy=${j.vy.toFixed(2)} onG=${j.onG}`);
A.G("globalThis._reset(); player.flying=true; player.flyAero=false; player.onGround=false; player.pos.y=heightAt(player.pos.x,player.pos.z)+60; keys.Space=false; _step(3);");
A.G("keys.Space=true; _step(20);");
const h=A.G('({vy:player.vel.y,rise:player.pos.y-heightAt(player.pos.x,player.pos.z)})');
assert('⑤-2 悬停升照常 (无吞边沿窗, 按空格上升)',h.vy>2&&h.rise>0.2,`vy=${h.vy.toFixed(2)} rise=${h.rise.toFixed(2)}m`);
A.G("globalThis._reset(); player.flying=true; player.flyAero=true; player.onGround=false; player.pos.y=heightAt(player.pos.x,player.pos.z)+60; player._aeroSpd=13; keys.Space=false; _step(3);");
A.G("keys.Space=true; for(let i=0;i<45;i++) specFlightMove(player,1/60);");
const a=A.G('player._aeroSpd');
assert('⑤-3 气动空格加速照常 (45 帧阻尼向 40)',a>25,`_aeroSpd=${a.toFixed(1)}`);
}

// ── ⑥ 小地图: 操控中 drawMinimap 冒烟 (含海军包装层) + 弹体标记源码钉 ──
section('⑥ 小地图: 操控中冒烟 + 弹体标记常显');
{
A.G("globalThis._reset(); player.flying=true; player.flyAero=false; player.onGround=false; player.pos.y=heightAt(player.pos.x,player.pos.z)+60;");
A.G("fireLoiter(player,new THREE.Vector3(player.pos.x,player.pos.y,player.pos.z-2),new THREE.Vector3(0,0,-1));");
let err=null;
try{ A.G('_step(5); drawMinimap();'); }catch(e){ err=String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); }
assert('⑥-1 操控中 drawMinimap() 不抛 (含海军包装层同布)',err===null,err||'');
assert('⑥-2 弹体标记画在 toMap 投影上 (操控中=地图中心)',A.G("!!(player.loiter&&!player.loiter.dead)")===true,'');
}

// ── ⑦ 汇总 ──
section('⑦ 汇总');
console.log(`  正向 ${OK.length} 绿 / ${BAD.length} 红`);
if(BAD.length){ console.log('  红名: '+BAD.join(' · ')); process.exit(1); }
console.log('  verify-loiterfreeze-20261107 全绿');
