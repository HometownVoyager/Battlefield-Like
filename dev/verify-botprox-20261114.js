// ─────────────────────────────────────────────────────────────
// dev/verify-botprox-20261114.js —— Bot 近距感知批沙箱 (2026-11-14 实机反馈批, 不进 index.html)
// 用法: node dev/verify-botprox-20261114.js [--neg]
// 原理: 复用 dev/_bootstub.js 的桩 (与 verify-botai-20261103 同款), 加载**全部真实脚本**(与
//       index.html 同序 46 文件), 用真起点 startBtn.onclick 开局 (草原遭遇), 再对 14-bots
//       perceive 的两处修复做行为断言。
// 背景 (实机症状): Bot 面对面擦肩走过却像没看见 (2026-11-14 用户实报)。
// 根因×2 (都在 js/14-bots.js perceive):
//   ① RAY_BUDGET (12 发/帧全体共享) 在混战中超订阅, 排在更新序后面的 Bot 每轮 perceive 拿
//      0 发"新目标"射线 —— 面对面的陌生敌人永远进不了 target (2026-11-03 批只修了"当前目标"
//      优先复核, 新目标获取仍饿死) ⇒ 近距强制感知: PROX_SPOT_R(12m) 内的候选射线不吃预算门,
//      超预算也照发 (与"当前目标优先复核"同款超发特权, 照旧入账)。
//   ② 近距脚步感知死代码: heard(d<9) 在 FOV 门**之后**才算 —— 背后贴到 2m 也被朝向门
//      continue ⇒ heardClose 提到 FOV 门之前: 站立/奔跑目标 9m 内全向感知, 蹲行 4m 内
//      (蹲行脚步声减半, 蹲姿潜行从背后接近仍有效)。听枪 (heard 的第二支) 方位不明,
//      保持旧语义不豁免 FOV (gunEvents 兜底块 = 记 lastSeenPos 不锁目标, weather/daynight 钉)。
// 断言 (S1~S10 + T2/T3):
//   S1 ★ 预算耗尽+面对面 8m: 照常索敌 + 超发入账 (used>max, 与优先复核同款证据);
//   S2/S4 ★ 预算耗尽+背后 8m/6m 站立: 索敌 (heardClose 豁免 FOV + 近距豁免预算, 双修同链);
//   S5/S6 ★ 预算充足+背后 8m / 蹲行 3m: 索敌 (单测 FOV 豁免, 不吃预算豁免);
//   守卫: 蹲行背后 6m 不可见 (crouch-aware 4m 门); 墙挡 8m 不可见 (近距射线仍吃世界遮挡);
//         正面 13m+耗尽不可见 / 10m+耗尽可见 (PROX_SPOT_R=12 边界, 远距饿死语义保持, botai-T2 26m 兼容);
//         听枪 60m 背后不锁目标 (gunEvents 兜底语义);
//   T3 源码防回退 (单行锚, 与 CRLF 无关)。
// ─────────────────────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const NEG=process.argv.includes('--neg');
const OK=[],BAD=[];
function assert(name,cond,detail){ (cond?OK:BAD).push(name); console.log(`  ${cond?'✓':'✗'} ${name}${detail?'  '+detail:''}`); }
function section(t){ console.log('\n══ '+t+' ══'); }
const SRC=f=>fs.readFileSync(path.join(root,f),'utf8');

// ── 阴性对照 (锚点用修后原文单行; 找不到就抛错, 防"锚点漂移后静默通过") ──
const PATCHES=[
 // P1 近距强制感知退场 (豁免门摘掉 ⇒ 预算耗尽回到旧饿死 ⇒ S1/S2/S4/S9 红)
 ['js/14-bots.js',
  "}else if(d<PROX_SPOT_R||RAY_BUDGET.used<RAY_BUDGET.maxPerFrame){",
  "}else if(RAY_BUDGET.used<RAY_BUDGET.maxPerFrame){"],
 // P2 heardClose 豁免 FOV 门退场 (回到旧死代码序 ⇒ 背后近距失明 ⇒ S2/S4/S5/S6 红)
 ['js/14-bots.js',
  "if(!isCur&&!this._eSearchLit&&!heardClose&&Math.abs(angDiff(this.yaw,ang))>maxAng) continue;",
  "if(!isCur&&!this._eSearchLit&&Math.abs(angDiff(this.yaw,ang))>maxAng) continue;"],
 // P3 蹲行脚步感知加宽回 9m 全向 (蹲姿潜行失效 ⇒ S3 红)
 ['js/14-bots.js',
  "const heardClose=d<(e.crouch?4:9);",
  "const heardClose=d<9;"],
];
const PATCH_MAP={};
if(NEG) for(const [f,from,to] of PATCHES){
 const s=PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f);
 if(s.indexOf(from)<0) throw new Error('阴性对照锚点未找到: '+f+' :: '+from.slice(0,70));
 PATCH_MAP[f]=s.split(from).join(to);
}
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f));

// ── 桩补丁 (与 verify-botai-20261103 同源) ──
const {sandbox,document,window,byId}=require('./_bootstub.js');
const V3c=sandbox.THREE.Vector3;
if(!V3c.prototype.addScalar) V3c.prototype.addScalar=function(s){ this.x+=s; this.y+=s; this.z+=s; return this; };
if(!V3c.prototype.divideScalar) V3c.prototype.divideScalar=function(s){ s=s||1; this.x/=s; this.y/=s; this.z/=s; return this; };
if(!V3c.prototype.clampScalar) V3c.prototype.clampScalar=function(a,b){ this.x=Math.min(b,Math.max(a,this.x)); this.y=Math.min(b,Math.max(a,this.y)); this.z=Math.min(b,Math.max(a,this.z)); return this; };
if(!V3c.prototype.project) V3c.prototype.project=function(){ this.x=0; this.y=0; this.z=1; return this; };
if(!V3c.prototype.cross) V3c.prototype.cross=function(v){ return this.crossVectors(this,v); };
if(!V3c.prototype.negate) V3c.prototype.negate=function(){ this.x=-this.x; this.y=-this.y; this.z=-this.z; return this; };
for(const k of ['MeshLambertMaterial','MeshBasicMaterial','MeshStandardMaterial','MeshPhongMaterial','PointsMaterial','SpriteMaterial']){
const C=sandbox.THREE[k];
if(!C||!C.prototype) continue;
if(!C.prototype.clone) C.prototype.clone=function(){ return new C(Object.assign({},this,{color:this.color})); };
if(!C.prototype.dispose) C.prototype.dispose=function(){};
}
const O3=sandbox.THREE.Object3D;
if(O3&&O3.prototype&&!O3.prototype.clear) O3.prototype.clear=function(){ if(this.children) this.children.length=0; return this; };
const BA=sandbox.THREE.BufferAttribute;
if(BA&&BA.prototype&&!BA.prototype.setXYZ) BA.prototype.setXYZ=function(i,x,y,z){ if(this.array){ this.array[i*this.itemSize]=x; this.array[i*this.itemSize+1]=y; this.array[i*this.itemSize+2]=z; } return this; };
if(!sandbox.THREE.Line) sandbox.THREE.Line=class extends O3{constructor(g,m){super();this.geometry=g||{};this.material=m||{};this.isLine=true;}};
const AP=()=>({value:0,setValueAtTime(){},setTargetAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}});
const ACStub=class{
createOscillator(){return {frequency:AP(),detune:AP(),type:'',start(){},stop(){},connect(){},onended:null};}
createGain(){return {gain:AP(),connect(){},disconnect(){}};}
createBuffer(){return {getChannelData:()=>new Float32Array(16),duration:1,numberOfChannels:1};}
createBufferSource(){return {buffer:null,loop:false,playbackRate:AP(),start(){},stop(){},connect(){},onended:null};}
createBiquadFilter(){return {type:'',frequency:AP(),detune:AP(),Q:AP(),connect(){}};}
createDynamicsCompressor(){return {threshold:AP(),ratio:AP(),attack:AP(),release:AP(),connect(){}};}
createStereoPanner(){return {pan:AP(),connect(){}};}
resume(){return Promise.resolve();} get state(){ return 'running'; } get destination(){ return {}; }
get currentTime(){ return 0; } get sampleRate(){ return 44100; }
};
sandbox.AudioContext=ACStub; sandbox.window.AudioContext=ACStub; sandbox.window.webkitAudioContext=ACStub;
sandbox.confirm=()=>true;
delete sandbox.window.CANNON;

// 全链文件表 (与 index.html 同序 46 文件, 与 verify-botai-20261103 逐位一致)
const FILES=['js/00-config.js','js/00b-i18n.js','js/00c-procgen.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/19b-gamepad.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/22a-menuart.js','js/22b-speclayer.js','js/23-deploy.js','js/23b-worldrestore.js','js/25-zombies.js','js/26-commander.js','js/24-main.js'];
const CAMP=8;   // 草原遭遇 (与 verify-botai 同图): 标准陆战

const srcOfCtx=f=>{ const s=srcOf(f); return s; };
function boot(campIdx,extraStore){
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document; ctx.window=window;
ctx.localStorage={_s:Object.assign({sf_campaign:String(campIdx)},extraStore||{}),getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
ctx.console={log:(...a)=>{ const s=a.map(x=>String(x)).join(' '); if(!/^\[(地形|HUD|NAV|世界|音频)/.test(s)) console.log(...a); }, warn:console.warn.bind(console), error:console.error.bind(console)};
for(const f of FILES){ vm.runInContext(srcOfCtx(f),ctx,{filename:f}); }
return ctx;
}
let CTX=null;
function run(code){ return vm.runInContext(code,CTX,{timeout:600000}); }
function bootGame(){
CTX=boot(CAMP);
return run(`(()=>{ try{ const b=document.getElementById('startBtn'); if(b&&b.onclick){ b.onclick(); return 'ok'; } return 'no-button'; }catch(e){ return 'ERR '+String(e&&e.stack||e).slice(0,400); } })()`);
}

// ── 沙箱内工具 (★ 顶层 var: 桩的 globalThis 指向共享 sandbox, 写 globalThis.x 不进本 context) ──
const PRELUDE=`var __AI=(function(){
// 造兵: 真构造器 (自动入 soldiers/combatants), 落地即站
function mkBot(team,x,z,name){
const b=new Bot(team,0,name||'靶'); b.alive=true; b.pos.set(x,heightAt(x,z),z); b.vel.set(0,0,0);
b.onVehicle=null; b.spectator=false; b.hp=100; b.reactT=-1; b.decisionT=999; b.perceptT=0.16;
return b;
}
// 找一对"近乎同高 + 全程无静态遮挡"的点: A=(ax,az), B 在其 -Z 方向 len 米处
function openSpot(len){
const lim=MAP_SIZE/2-16;
for(let i=0;i<8000;i++){
const ax=(Math.random()*2-1)*lim, az=(Math.random()*2-1)*lim;
const bx=ax, bz=az-len;
if(Math.abs(bz)>lim) continue;
const ha=heightAt(ax,az), hb=heightAt(bx,bz);
if(Math.abs(ha-hb)>1.0) continue;
if(occBlocked(ax,az)||occBlocked(bx,bz)) continue;
const o=V3(ax,ha+1.62,az), t=V3(bx,hb+1.10,bz);
const d=t.clone().sub(o); const L=d.length(); d.normalize();
if(raycastWorld(o,d,L-0.6)) continue;
return {ax,az,bx,bz,ha,hb};
}
return null;
}
// 实墙 (addBoxCollider 单源, RGRID 增量注册): 横在 (cx,cz), 沿 X 宽 w, 厚 d, 高 h, 底在地面
function mkWall(cx,cz,w,h,d){
const g=heightAt(cx,cz);
addBoxCollider(cx,g+h/2,cz,w,h,d);
}
function clearAll(){
for(const s of soldiers) s.alive=false; soldiers.length=0; combatants.length=0;
tanks.length=0;
try{ for(const p of planes) p.alive=false; planes.length=0; }catch(e){}
SMOKES.length=0; FLARES.length=0;
}
// 造一对"perceive 级净空"的敌对双 Bot: A 在 +Z 端面朝 -Z (yaw=PI), B 在 -Z 方向 len 米处。
// ★先验: 预算充足下 A 必须能索到 B —— openSpot 只验 raycastWorld, perceive 还过烟/庄稼/植被
// (草原图草丛可能吃掉眼线), 不验就座则重摇 (防"选点 6 选 1"式偶发假红)。
function mkPairSpot(len){
for(let k=0;k<40;k++){
const sp=openSpot(len); if(!sp) continue;
const A=mkBot(0,sp.ax,sp.az,'哨'); A.yaw=Math.PI;
const B=mkBot(1,sp.bx,sp.bz,'靶');
nowT=100000+k; RAY_BUDGET.used=0;
A.perceive();
if(A.target===B) return {A,B};
clearAll();
}
return null;
}
// 场景复位: 清目标态 (A.target/lastSeenT/lastSeenPos), 保留位置与朝向由场景自己摆
function resetSpot(A){
A.target=null; A.lastSeenT=-99; A.lastSeenPos.set(0,0,0); A.aimSettle=0;
}
return {mkBot,mkWall,openSpot,clearAll,mkPairSpot,resetSpot};
})();`;
function bootCtx(){
CTX=boot(CAMP);
vm.runInContext(PRELUDE,CTX,{filename:'prelude'});
return run(`(()=>{ try{ const b=document.getElementById('startBtn'); if(b&&b.onclick){ b.onclick(); return 'ok'; } return 'no-button'; }catch(e){ return 'ERR '+String(e&&e.stack||e).slice(0,400); } })()`);
}

// ═════════════════════════════════════════════════════════════
section('① 开局');
const st=bootCtx();
assert('真开局链 startBtn.onclick 无异常',st==='ok',st==='ok'?'':' '+st);

// ═══ S1~S10 近距感知 (近距强制感知 + heardClose 豁免 FOV) ═══
section('S1~S10 近距感知: 预算耗尽下的贴脸/擦肩必被索敌');
{
const r=run(`(()=>{try{
const out={};
const AI=__AI;
// S1 ★ 预算耗尽 + 面对面 8m: 近距射线豁免预算门 ⇒ 索敌 (旧版: 饿死) + 超发入账
{
AI.clearAll();
const pr=AI.mkPairSpot(8); if(!pr) return 'NOPLACE1';
const {A,B}=pr; AI.resetSpot(A);
nowT=2000; RAY_BUDGET.used=RAY_BUDGET.maxPerFrame; // 模拟混战中被前面的 Bot 吃干
A.perceive();
out.s1Acq=A.target===B;
out.s1Overdraw=RAY_BUDGET.used>RAY_BUDGET.maxPerFrame; // 豁免射线照旧入账 (与 _curBlk 超发同款证据)
}
// S2 ★ 预算耗尽 + 背后 8m (站立): heardClose 豁免 FOV + 近距豁免预算 ⇒ 索敌 (旧版: FOV 门死代码)
{
AI.clearAll();
const pr=AI.mkPairSpot(8); if(!pr) return 'NOPLACE2';
const {A,B}=pr; A.yaw=0; AI.resetSpot(A);  // B 在 -Z 8m, yaw=0 ⇒ 背对
nowT=2010; RAY_BUDGET.used=RAY_BUDGET.maxPerFrame;
A.perceive();
out.s2Acq=A.target===B;
}
// S3 守卫: 蹲行背后 6m ⇒ 不可见 (蹲行脚步感知半径 4m, 蹲姿潜行从背后接近仍有效)
{
AI.clearAll();
const pr=AI.mkPairSpot(6); if(!pr) return 'NOPLACE3';
const {A,B}=pr; A.yaw=0; AI.resetSpot(A); B.crouch=true;
nowT=2020; RAY_BUDGET.used=RAY_BUDGET.maxPerFrame;
A.perceive();
out.s3Stealth=A.target===null;
}
// S4 ★ 预算耗尽 + 背后 6m (站立): 索敌 (heardClose 9m 全向)
{
AI.clearAll();
const pr=AI.mkPairSpot(6); if(!pr) return 'NOPLACE4';
const {A,B}=pr; A.yaw=0; AI.resetSpot(A);
nowT=2030; RAY_BUDGET.used=RAY_BUDGET.maxPerFrame;
A.perceive();
out.s4Acq=A.target===B;
}
// S5 ★ 预算充足 + 背后 8m: 索敌 (单测 FOV 豁免, 与预算豁免解耦)
{
AI.clearAll();
const pr=AI.mkPairSpot(8); if(!pr) return 'NOPLACE5';
const {A,B}=pr; A.yaw=0; AI.resetSpot(A);
nowT=2040; RAY_BUDGET.used=0;
A.perceive();
out.s5Acq=A.target===B;
}
// S6 ★ 预算充足 + 蹲行背后 3m: 索敌 (3<4 蹲行感知半径内)
{
AI.clearAll();
const pr=AI.mkPairSpot(3); if(!pr) return 'NOPLACE6';
const {A,B}=pr; A.yaw=0; AI.resetSpot(A); B.crouch=true;
nowT=2050; RAY_BUDGET.used=0;
A.perceive();
out.s6Acq=A.target===B;
}
// S7 守卫: 预算耗尽 + 面对面 8m + 墙 ⇒ 不可见 (近距豁免只豁预算门, 不豁世界遮挡)
{
AI.clearAll();
const pr=AI.mkPairSpot(8); if(!pr) return 'NOPLACE7';
const {A,B}=pr; AI.resetSpot(A);
AI.mkWall((A.pos.x+B.pos.x)/2,(A.pos.z+B.pos.z)/2,5,3.4,0.5);
nowT=2060; RAY_BUDGET.used=RAY_BUDGET.maxPerFrame;
A.perceive();
out.s7WallBlind=A.target===null;
}
// S8 守卫: 预算耗尽 + 正面 13m ⇒ 不可见 (PROX_SPOT_R=12 豁免外, 远距饿死语义保持;
//    同时保 verify-botai-20261103 T2 的 26m 端到端饿死兼容)
{
AI.clearAll();
const pr=AI.mkPairSpot(13); if(!pr) return 'NOPLACE8';
const {A,B}=pr; AI.resetSpot(A);
nowT=2070; RAY_BUDGET.used=RAY_BUDGET.maxPerFrame;
A.perceive();
out.s8FarBlind=A.target===null;
}
// S9 ★ 预算耗尽 + 正面 10m ⇒ 索敌 (10<12 豁免内: 钉 PROX_SPOT_R 覆盖典型擦肩/巷战距离)
{
AI.clearAll();
const pr=AI.mkPairSpot(10); if(!pr) return 'NOPLACE9';
const {A,B}=pr; AI.resetSpot(A);
nowT=2080; RAY_BUDGET.used=RAY_BUDGET.maxPerFrame;
A.perceive();
out.s9NearAcq=A.target===B;
}
// S10 sanity: 预算充足 + 面对面 8m ⇒ 索敌 (基线, 与旧版逐位同)
{
AI.clearAll();
const pr=AI.mkPairSpot(8); if(!pr) return 'NOPLACE10';
const {A,B}=pr; AI.resetSpot(A);
nowT=2090; RAY_BUDGET.used=0;
A.perceive();
out.s10Base=A.target===B;
}
// T2 守卫: 听枪 60m 背后 ⇒ 不锁目标, 只记 lastSeenPos (gunEvents 兜底语义, 与
//    weather/daynight 探针同钉: 听枪方向不明, 不该让 Bot 隔背瞬锁)
{
AI.clearAll();
const pr=AI.mkPairSpot(60); if(!pr) return 'NOPLACE11';
const {A,B}=pr; A.yaw=0; AI.resetSpot(A);
nowT=2100; RAY_BUDGET.used=0;
gunEvents.push({x:B.pos.x,z:B.pos.z,t:nowT-0.1,team:B.team,shooter:B});
A.perceive();
out.t2NoLock=A.target===null;
out.t2Heard=Math.abs(A.lastSeenPos.x-B.pos.x)<0.01&&Math.abs(A.lastSeenPos.z-B.pos.z)<0.01;
}
return out;
}catch(e){ return 'EXC:'+String(e&&e.stack||e).slice(0,500); }})()`);
if(typeof r==='string'){ assert('S 场景搭建',false,r); }
else{
assert('S1 ★ 预算耗尽+面对面 8m: 近距强制感知 ⇒ 照常索敌',r.s1Acq===true);
assert('S1 ★ 豁免射线超发入账 (used>max, 与当前目标优先复核同款证据)',r.s1Overdraw===true);
assert('S2 ★ 预算耗尽+背后 8m 站立: heardClose+近距豁免 ⇒ 索敌 (旧版 FOV 门死代码)',r.s2Acq===true);
assert('S3 守卫 蹲行背后 6m: 不可见 (蹲行感知半径 4m, 蹲姿潜行有效)',r.s3Stealth===true);
assert('S4 ★ 预算耗尽+背后 6m 站立: 索敌',r.s4Acq===true);
assert('S5 ★ 预算充足+背后 8m: 索敌 (单测 FOV 豁免, 与预算豁免解耦)',r.s5Acq===true);
assert('S6 ★ 预算充足+蹲行背后 3m: 索敌 (3<4 半径内)',r.s6Acq===true);
assert('S7 守卫 墙挡 8m+耗尽: 不可见 (豁免只豁预算门, 不豁遮挡)',r.s7WallBlind===true);
assert('S8 守卫 正面 13m+耗尽: 不可见 (豁免外饿死语义保持, botai-T2 26m 兼容)',r.s8FarBlind===true);
assert('S9 ★ 正面 10m+耗尽: 索敌 (PROX_SPOT_R 覆盖内)',r.s9NearAcq===true);
assert('S10 sanity 预算充足+面对面 8m: 索敌 (基线)',r.s10Base===true);
assert('T2 守卫 听枪 60m 背后: 不锁目标',r.t2NoLock===true);
assert('T2 守卫 听枪: lastSeenPos 记到枪声位 (gunEvents 兜底语义)',r.t2Heard===true);
}
}

// ═══ T3 源码防回退 ═══
section('T3 源码防回退 (修好的写法在 / 旧写法不在)');
{
const s=srcOf('js/14-bots.js');
assert('T3-A 近距强制感知常量在场',s.includes('const PROX_SPOT_R=12;'));
assert('T3-A 近距豁免预算门在场 (超预算照发)',
 s.includes('}else if(d<PROX_SPOT_R||RAY_BUDGET.used<RAY_BUDGET.maxPerFrame){'));
assert('T3-A 旧饿死写法不在',!s.includes('}else if(RAY_BUDGET.used<RAY_BUDGET.maxPerFrame){'));
assert('T3-B heardClose 在场 (蹲行 4m/站立 9m)',s.includes('const heardClose=d<(e.crouch?4:9);'));
assert('T3-B heardClose 豁免 FOV 门在场',
 s.includes('if(!isCur&&!this._eSearchLit&&!heardClose&&Math.abs(angDiff(this.yaw,ang))>maxAng) continue;'));
assert('T3-B 旧 FOV 死代码序不在',!s.includes('if(!isCur&&!this._eSearchLit&&Math.abs(angDiff(this.yaw,ang))>maxAng) continue;'));
}

// ═══ 收尾 ═══
console.log('\n─────────────────────────────');
console.log(`通过 ${OK.length} / 总 ${OK.length+BAD.length}`);
if(BAD.length){ console.log('失败清单:'); for(const b of BAD) console.log('  ✗ '+b); }
process.exit(BAD.length?1:0);
