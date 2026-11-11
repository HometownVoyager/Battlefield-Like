// ─────────────────────────────────────────────────────────────
// dev/verify-vehburnfix-20261110.js —— 2026-11-10 烧毁漂移批验收
//   ★实机报告: "载具 hp<10% 起火后自然掉血到损毁的瞬间, 模型位置漂移一次"。
//   病根: 坦克 update 中段 (燃烧账) 触发 die() 后**没有就地 return** —— 死亡当帧继续走完
//   下方移动/碰撞段, 而 die() 刚注册了 3 个自身残骸碰撞盒 (registerDynCollider, ±1.9m 沿车体轴),
//   底盘碰撞段三圆 (±1.95, r1.55) 圆心正落在自己的残骸盒内 ⇒ "圆心在盒内沿最浅轴整体顶出"分支
//   把车体从自己的残骸里推出去 (双 pass 累计 ~2m+)。中弹死亡的 die() 发生在 update 之外, 从不漂移
//   —— 只有 update 内段杀车 (燃烧/激流/涉水) 会踩中。15b-trucks/15d-naval 当年就带 return, 坦克漏了。
//   修复三处: ①15-vehicles 燃烧账 { die; return; } ②15-vehicles 燃烧账后 if(!this.alive) return;
//   (兜住激流/涉水两处 takeDmg 中段死亡) ③16-aircraft 燃烧账 { die; return; } (本处还会同帧
//   二次 die: 撞地/机-舰检查再炸一遍 = 双残骸+双战报+双票, die 无重入门)。
// 用法: node dev/verify-vehburnfix-20261110.js [--neg] [--only=N1|N2|N3]
//   --neg = 全部阴性补丁同时应用 (对认按红名↔补丁): N1 坦克燃烧 return 摘除 / N2 alive 守卫摘除 /
//   N3 飞机燃烧 return 摘除。--only=X = 只应用单个补丁 (单补丁亲验用, 与 verify-loiterview 同款)。
//   N1→判据 ① (烧毁漂移) 转红; N2→判据 ② (激流死亡漂移) 转红; N3→判据 ③ (飞机双残骸) 转红。
// 口径: 与 verify-vehburn-20261109 同款 boot (真 three + index.html 全脚本链 + startBtn 开局)。
// ─────────────────────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const NEG=process.argv.includes('--neg');
const ONLY=(process.argv.find(a=>a.startsWith('--only='))||'').split('=')[1]||null;
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

// ── 阴性对照 (一律单行锚; 15-vehicles 为纯 LF 文件 — 本批 od 验过 — 故 N2 允许两行锚) ──
const BURN_RET='if(this.hp<=0){ this.die(this.burnBy||null); return; }';
const PATCHES=[
 // N1 病灶还原: 坦克燃烧账 return 摘除 (死亡当帧继续走碰撞段 ⇒ 判据①烧毁漂移转红)
 ['js/15-vehicles.js',BURN_RET,'if(this.hp<=0) this.die(this.burnBy||null); // NEG N1'],
 // N2 病灶还原: 激流/涉水死亡停帧守卫摘除 (⇒ 判据②激流漂移转红)。两行锚: `if(!this.alive) return;`
 // 在本文件有两处 (takeDmg 早退同文), 单行锚会误伤 takeDmg 的合法早退。
 ['js/15-vehicles.js','// (能在这里看到 !alive 的必是本帧刚死的: 顶部死车分支早退, 活车不受影响)\nif(!this.alive) return;','// NEG N2\nif(this.alive&&false) return;'],
 // N3 病灶还原: 飞机燃烧账 return 摘除 (低空烧毁同帧二次 die ⇒ 判据③双残骸转红)
 ['js/16-aircraft.js',BURN_RET,'if(this.hp<=0) this.die(this.burnBy||null); // NEG N3'],
];
const PATCH_MAP={};
const applyPatch=(list)=>{ for(const [f,from,to] of list){
 const s=PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f);
 if(s.indexOf(from)<0) throw new Error('阴性对照锚点未找到: '+f+' :: '+from.slice(0,70));
 PATCH_MAP[f]=s.split(from).join(to);
}};
if(NEG) applyPatch(PATCHES);
if(ONLY){ const p=PATCHES.find(p=>p[0]+'::'+p[1].slice(0,20)===ONLY||p[0].endsWith(ONLY)||ONLY===('N'+(PATCHES.indexOf(p)+1)));
 if(!p) throw new Error('--only 未匹配补丁: '+ONLY); applyPatch([p]); }
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f));

// ── ① 源码防回退 ─────────────────────────────────────────────
section('① 源码防回退 (修好的写法在 / 旧写法不在)');
{
const s15=srcOf('js/15-vehicles.js'), s16=srcOf('js/16-aircraft.js'),
      s15b=SRC('js/15b-trucks.js'), s15d=SRC('js/15d-naval.js');
assert('15-vehicles: 燃烧账烧毁就地停帧 { die; return; } (与 15b/15d 同款)',s15.includes(BURN_RET));
assert('15-vehicles: 激流/涉水中段死亡停帧守卫 (燃烧账后 if(!this.alive) return;)',
 s15.includes('// 激流/涉水两处 takeDmg 同样能在 update 中段触发 die() —— 同一漂移病根, 死亡当帧一并停帧。')
 &&s15.includes('\nif(!this.alive) return;\n'));
assert('16-aircraft: 机体烧毁就地停帧 { die; return; } (防同帧二次 die)',s16.includes(BURN_RET));
assert('15b-trucks/15d-naval: 燃烧账 return 既有钉 (当年就带, 回归锚)',s15b.includes(BURN_RET)&&s15d.includes(BURN_RET));
}

// ── 沙箱装载 (真 three; 与 verify-vehburn-20261109 同款 boot) ──────────
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
assert('② 前置: 开局+玩家就位',!err&&G('typeof tanks==="object"&&tanks.length>0')===true,err||'');

// ── ③ 行为: 烧毁瞬间零漂移 (★实机报告主判据) ──────────────────
section('③ 烧毁瞬间零漂移: 燃烧至损毁当帧 pos/grp.position 逐位不动');
{
G("globalThis.T1=tanks.find(t=>t.alive&&t.team===0); T1.crewBot=null; T1.claimBot=null; T1.playerDriven=false; T1.vel=0;");
// 挑一块净空平地 (中心格 occ 空 + 3.5m 内无高盒/高圆柱 + 无河/深水 + 他车 9m 外) 再落车。
// ★盒检查必须扩到 3.5m (三圆 ±1.95 + 推挤半径 1.55): 只查中心格的话, 2m 外一面墙就会让圆心
// "已在盒内"被整体顶出 (顶出量=半墙宽+1.55 ⇒ 一次十几米), 静置期就漂走造成假红/假绿。
G("globalThis._sp=(function(){ for(let z=-300;z<=300;z+=6){ for(let x=-300;x<=300;x+=6){"
 +"if(occBlocked(x,z)||inRiverChannel(x,z)||(typeof waterDepthAt==='function'&&waterDepthAt(x,z)>0.3)) continue;"
 +"const h=heightAt(x,z); if(Math.abs(heightAt(x+2,z)-h)>0.45||Math.abs(heightAt(x,z+2)-h)>0.45) continue;"
 +"let boxBad=false; eachBoxNear(x-3.5,z-3.5,x+3.5,z+3.5,b=>{ if(!b.dead&&b.maxY-b.gh>0.7) boxBad=true; });"
 +"if(boxBad) continue;"
 +"let cylBad=false; eachCylNear(x-3.5,z-3.5,x+3.5,z+3.5,c=>{ if(!c.dead&&c.r>=0.3&&c.y1-c.y0>1.3) cylBad=true; });"
 +"if(cylBad) continue;"
 +"let tankNear=false; for(const t of tanks){ if(t!==T1&&t.alive&&Math.hypot(t.pos.x-x,t.pos.z-z)<9){ tankNear=true; break; } }"
 +"if(tankNear) continue; return {x,z}; } } return null; })();");
// yaw 钉 0.7: 旧病灶的"圆心在盒内顶出"方向随车体轴翻转 —— 三个残骸盒的推挤在某些 yaw 下互相抵消
// (rear/center 顶向 -轴, front 顶向 +轴), 不钉 yaw 的话 NEG 对照可能偶发假绿 (0.000m)。
G("if(_sp){ T1.pos.set(_sp.x,heightAt(_sp.x,_sp.z),_sp.z); T1.pos.y=heightAt(_sp.x,_sp.z); T1.yaw=0.7; }");
G("for(let i=0;i<120;i++) T1.update(1/60);"); // 先静置 2s: 挪位后 vel 衰减+悬挂收敛, 基线取"已停稳"车
G("T1.hp=T1.maxHp*0.02; T1.burning=true; T1.burnBy=null;");
G("globalThis._p0=T1.pos.clone(); globalThis._g0=T1.grp.position.clone(); globalThis._dead=false;");
G("for(let i=0;i<400;i++){ T1.update(1/60); if(!T1.alive){ globalThis._dead=true; break; } }");
assert('③-1 燃烧至损毁发生 (alive=false, 残骸碰撞盒已注册 ×3)',G('_dead')===true&&G('T1.wreckBs&&T1.wreckBs.length===3')===true);
assert('③-2 ★损毁当帧车体零漂移 (die() 后不再走碰撞段: pos 与死亡前逐位一致)',
 G('T1.pos.distanceTo(_p0)')<0.001,G('T1.pos.distanceTo(_p0).toFixed(3)')+'m  (旧病灶 0.5~8m, 随 yaw 几何)');
assert('③-3 ★损毁当帧模型组零漂移 (grp.position 同样逐位一致)',
 G('T1.grp.position.distanceTo(_g0)')<0.001,G('T1.grp.position.distanceTo(_g0).toFixed(3)')+'m');
}

// ── ④ 行为: 激流/涉水中段死亡零漂移 (alive 守卫) ─────────────
section('④ 激流中段死亡零漂移: takeDmg 在 update 中段触发 die() 同样停帧');
{
// normandy 主河 d≤2 无激流 ⇒ 激流判据在 songhu (d=2.8, 2026-09-12 加深档) 沙箱跑 (与 vehburn ④b 同款子boot)
const SEA=boot(vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="songhu")',ctx));
const GS=s=>vm.runInContext(s,SEA,{timeout:300000});
GS("document.getElementById('startBtn').onclick();");
GS("player.team=0; player.cls=0; player.spectator=false; player.alive=true; player.deployed=true;");
GS("globalThis._rv=null; for(let z=-360;z<=360&&!_rv;z+=4){ for(let x=-360;x<=360;x+=4){ if(inRiverChannel(x,z)&&heightAt(x,z)<waterYAt(x,z)){ _rv={x,z}; break; } } }");
if(!GS('_rv')){
console.log('  ⊘ songhu 未扫到深水河道点, 激流判据跳过 (源码钉已覆盖)');
}else{
GS("globalThis.T2=tanks.find(t=>t.alive&&t.team===0); T2.crewBot=null; T2.claimBot=null; T2.playerDriven=false;");
GS("T2.pos.set(_rv.x,heightAt(_rv.x,_rv.z),_rv.z); T2.pos.y=heightAt(_rv.x,_rv.z); T2.vel=0; T2.hp=0.1; T2.burning=false;");
GS("globalThis._rp0=T2.pos.clone(); globalThis._rdead=false; for(let i=0;i<5;i++){ T2.update(1/60); if(!T2.alive){ globalThis._rdead=true; break; } }");
assert('④-1 激流中段死亡发生 (alive=false)',GS('_rdead')===true);
assert('④-2 ★死亡当帧零漂移 (alive 守卫停帧: pos 与死亡前逐位一致)',GS('T2.pos.distanceTo(_rp0)')<0.001,
 GS('T2.pos.distanceTo(_rp0).toFixed(3)')+'m');
}
}

// ── ⑤ 行为: 飞机低空烧毁单次 die (无双残骸/双票) ─────────────
section('⑤ 飞机低空烧毁: 单次 die (残骸 +1, 不因撞地检查同帧二炸)');
{
G("globalThis.P1=planes.find(p=>p.alive); globalThis._pw0=planeWrecks.length;");
// crewBot 摘除+pitch 归零: 防地形规避 AI 在燃烧期内拉起越出 gh+2 (AI 一拉起, 旧病灶的同帧二炸就永不触发)
G("if(P1){ P1.crewBot=null; P1.playerDriven=false; P1.pitch=0; P1.roll=0; P1.hp=P1.maxHp*0.0001; P1.burning=true; P1.burnBy=null; P1.pos.y=planeFloorY(P1.pos.x,P1.pos.z)+1; globalThis._pdead=false; for(let i=0;i<400;i++){ P1.update(1/60); if(!P1.alive){ globalThis._pdead=true; break; } } }");
assert('⑤-1 机体烧毁发生 (alive=false)',G('!!P1&&_pdead')===true);
assert('⑤-2 ★残骸只生成一架 (同帧撞地检查不二次 die: die 无重入门, 靠 return 停帧)',
 G('planeWrecks.length-_pw0')===1,G('planeWrecks.length-_pw0')+' 架 (旧病灶=2)');
}

// ── ⑥ 汇总 ──
section('⑥ 汇总');
console.log(`  ${NEG?('NEG'+(ONLY?'['+ONLY+']':'')):'正向'} ${OK.length} 绿 / ${BAD.length} 红`);
if(BAD.length){ console.log('  红名: '+BAD.join(' · ')); process.exit(1); }
console.log('  verify-vehburnfix-20261110 全绿');
