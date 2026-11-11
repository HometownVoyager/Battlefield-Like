// ─────────────────────────────────────────────────────────────
// dev/verify-botai-20261103.js —— Bot AI 机制优化批沙箱 (2026-11-03 实机反馈批, 不进 index.html)
// 用法: node dev/verify-botai-20261103.js [--neg]
// 原理: 复用 dev/_bootstub.js 的桩 (与 verify-commander-20261026 同款), 加载**全部真实脚本**(与
//       index.html 同序 46 文件), 用真起点 startBtn.onclick 开局 (草原遭遇: 标准陆战), 再对 14-bots
//       的七个修复点做行为断言。
// 背景 (实机附身观战三症状):
//   ① "好几个人挤在一起, 卡在一起, 不知道在干什么" —— 全库无士兵-士兵推挤 + 掩体/驻点无占用概念
//      + 目标 6% 随机换导致半路掉头 ⇒ E 软分离 / F 驻点占用账 / H 目标粘滞
//   ② "隔着墙对目标开火 (可破坏和不可破坏墙都有)" —— RAY_BUDGET 耗尽时 perceive 对当前目标**零检测
//      直接沿用旧通视** ⇒ 开火门永远开着; 机枪座断视后最长 3.4s 朝实时坐标泼弹; 火箭筒 65m 定长
//      预检与目标实际距离脱钩 ⇒ A 当前目标优先复核 / B 机枪开火预检+压制 / C 火箭筒预检收紧
//   ③ "士兵在坦克面前向坦克挤, 但就是上不了坦克" —— VEH_BOARD_R(2.7, 车心) < 推挤边界(车壳半长+0.83)
//      对所有坦克成立 ⇒ 首尾方向几何性上不了车 ⇒ I 贴壳判定 + 顶壳 6s 超时拉黑
// 断言 (T1~T9):
//   T1 ★ perceive 当前目标优先复核: 预算耗尽+墙 ⇒ lastSeenT 不再刷新 (_curBlk=true);
//      预算耗尽+无墙 ⇒ 优先射线照发, lastSeenT 照常刷新 (旧版两个方向都错);
//   T2 ★ 端到端: 墙+预算耗尽下连续 update, lastSeenT 持续冻结 (旧版逐帧刷新 = 隔墙开火根因);
//   T3 ★ 机枪座: 可见+墙 ⇒ 开火瞬间预检拦截 (emplMGFire 不出膛+fireT=0.12);
//      断视 1.5s (<2.5s) ⇒ 改压最后目击位 (emplMGFire 出膛, 压制语义);
//   T4 ★ 火箭筒: 58m 目标+53m 墙 ⇒ 不发 (旧版 65m 定长预检 dist>50 会放行 = 隔墙发火箭);
//      无墙 58m ⇒ 照发;
//   T5 ★ 上车贴壳: 兵站在旧推挤边界 (车壳前 0.83m, 旧门 d<2.7 外) ⇒ 一帧上车;
//      远处 (2.6m) 不上不计时; 贴壳带 1.15m 却被顶住 ⇒ 6s 超时放弃+拉黑 12s (decide 不再认领);
//   T6 ★ 士兵间软分离: 重叠双方各推一半收敛到 BOT_SEP_R; 死人/观战者/楼上下/俯卧不推;
//      玩家只被让路; update 全链里也生效 (阴性: 摘掉调用点 ⇒ 原地不动);
//   T7 ★ 驻点占用账: 队友意向 (coverPt) / 现位都计数, 远了不计; 三处消费点源码在场;
//   T8 ★ 目标粘滞: objHoldT>0 时 300 拍 decide 零换目标; 归零后 120 拍内必换 (6% 门);
//      己方旗被夺 ⇒ 粘滞期也立刻紧急重选;
//   T9 源码防回退: 七修的写法在场 / 旧写法不在 (单行锚, 与 CRLF 无关)。
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
 // A 当前目标优先复核退场 (循环内门摘掉 ⇒ 预算耗尽时回到旧"沿用旧通视" ⇒ T1墙/T2 红)
 ['js/14-bots.js',
  "if(this._curBlk) continue;",
  ";"],
 // B 机枪开火预检退场 (预检恒放行 ⇒ 可见+墙也出膛 ⇒ T3拦截 红)
 ['js/14-bots.js',
  "if(chk&&chk.dist<dh-0.8) mg.fireT=0.12;",
  "if(false) mg.fireT=0.12;"],
 // C 火箭筒预检回退旧 65m 定长口径 (58m 目标+53m 墙: 旧口径 dist≈53>50 放行 ⇒ T4红)
 ['js/14-bots.js',
  "if(!chk||chk.dist>dTk-3){",
  "if(!chk||chk.dist>50){"],
 // I 上车贴壳门退场 (恒不上 ⇒ T5一帧上车 红)
 ['js/14-bots.js',
  "if(_surf<0.55){ this.enterVehicle(tv); return; }",
  "if(false){ this.enterVehicle(tv); return; }"],
 // E 软分离调用点退场 (update 全链不再推开 ⇒ T6全链 红)
 ['js/14-bots.js',
  "if(!this.emCast&&!this.onVehicle&&!this.chuting&&!this.exitSlide&&this.state!=='melee') _soldierSep(this);",
  ";"],
 // F 驻点占用账退场 (评分不再加罚 ⇒ 源码锚红)
 ['js/14-bots.js',
  "sc+=coverCrowdAt(this,cp.x,cp.z)*5;",
  ";"],
 // H 目标粘滞退场 (回到旧 6% 无条件随机换 ⇒ T8粘滞 红)
 ['js/14-bots.js',
  "if(!_fo||(_fo.owner===this.team&&_fo.capTeam!==-1&&_fo.capTeam!==this.team)||(this.objHoldT<=0&&Math.random()<0.06)) this.pickObjective();",
  "if(!this.objective||Math.random()<0.06) this.pickObjective();"],
];
const PATCH_MAP={};
if(NEG) for(const [f,from,to] of PATCHES){
 const s=PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f);
 if(s.indexOf(from)<0) throw new Error('阴性对照锚点未找到: '+f+' :: '+from.slice(0,70));
 PATCH_MAP[f]=s.split(from).join(to);
}
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f));

// ── 桩补丁 (与 verify-commander-20261026 同源) ──
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

// 全链文件表 (与 index.html 同序 46 文件, 与 verify-commander-20261026 逐位一致)
const FILES=['js/00-config.js','js/00b-i18n.js','js/00c-procgen.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/19b-gamepad.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/22a-menuart.js','js/22b-speclayer.js','js/23-deploy.js','js/23b-worldrestore.js','js/25-zombies.js','js/26-commander.js','js/24-main.js'];
const CAMP=8;   // 草原遭遇 (与 verify-commander 同图): 标准陆战, 坦克齐, 无海战编制

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
// 高墙 (从地面起 h 米, 用于保挡起伏地带的眼线) —— 与 mkWall 同一实现, 语义别名
function mkWallTall(cx,cz,w,h,d){ mkWall(cx,cz,w,h,d); }
// 假坦克 (够 decide 认领门/toVehicle 分支/enterVehicle 用): 不 buildMesh 不进编制
function mkTank(team,x,z,hullL){
const t={kind:'tank',alive:true,team,x:0,y:0,z:0,pos:V3(x,heightAt(x,z),z),yaw:0,
hp:100,maxHp:100,def:{hullL:hullL||6.9,name:'靶车'},halfW:1.3,
crewBot:null,playerDriven:false,claimBot:null,noEnterT:0,claimT:0};
tanks.push(t);
return t;
}
function clearAll(){
for(const s of soldiers) s.alive=false; soldiers.length=0; combatants.length=0;
tanks.length=0;
try{ for(const p of planes) p.alive=false; planes.length=0; }catch(e){}
SMOKES.length=0; FLARES.length=0;
}
return {mkBot,mkWall,mkWallTall,mkTank,openSpot,clearAll};
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

// ═══ T1 perceive 当前目标优先复核 (A修) ═══
section('T1 perceive 当前目标优先复核 (预算耗尽也照查当前目标)');
{
const r=run(`(()=>{try{
const out={};
__AI.clearAll();
const sp1=__AI.openSpot(30); if(!sp1) return 'NOPLACE1';
// 场1: 预算耗尽 + 无墙 ⇒ 优先射线照发, lastSeenT 照常刷新 (旧版: 耗尽即沿用旧态不刷新)
const A1=__AI.mkBot(0,sp1.ax,sp1.az,'哨1'); A1.yaw=Math.PI;
const B1=__AI.mkBot(1,sp1.bx,sp1.bz,'靶1');
nowT=1000; A1.perceive();
out.acq1=A1.target===B1; out.lst1=A1.lastSeenT;
nowT=1002; RAY_BUDGET.used=RAY_BUDGET.maxPerFrame; // 耗尽
A1.perceive();
out.acqRefresh=A1.lastSeenT===1002;               // ★新口径: 优先射线不吃预算, 照常确认可见
out.budgetOver=RAY_BUDGET.used>RAY_BUDGET.maxPerFrame; // 优先射线确实超发 (带优先权的证据)
// 场2: 预算耗尽 + 墙 ⇒ _curBlk=true, lastSeenT 冻结 (旧版: 零检测沿用旧通视 ⇒ 隔墙开火根因)
__AI.clearAll();
const sp2=__AI.openSpot(30); if(!sp2) return 'NOPLACE2';
const A2=__AI.mkBot(0,sp2.ax,sp2.az,'哨2'); A2.yaw=Math.PI;
const B2=__AI.mkBot(1,sp2.bx,sp2.bz,'靶2');
RAY_BUDGET.used=0; // 场1 的优先射线超发不污染本场 (update 外不会自动复位)
nowT=2000; A2.perceive();
out.acq2=A2.target===B2;
__AI.mkWall((sp2.ax+sp2.bx)/2,(sp2.az+sp2.bz)/2,5,3.4,0.5); // 目视确认后落墙 (可破坏/不可破坏同面)
nowT=2002; RAY_BUDGET.used=RAY_BUDGET.maxPerFrame;
A2.perceive();
out.curBlk=A2._curBlk===true;
out.lstFrozen=A2.lastSeenT===2000;                // ★新口径: 不再隔墙刷新 lastSeenT
// 场3: 预算充足 + 墙 ⇒ 同样冻结 (复核口径与预算无关; Δt 须 <3s 记忆门内, isCur 才走复核分支)
const A3=A2; nowT=2001.5; RAY_BUDGET.used=0;
A3.perceive();
out.curBlk2=A3._curBlk===true;
out.lstFrozen2=A3.lastSeenT===2000;
return out;
}catch(e){ return 'EXC:'+String(e&&e.stack||e).slice(0,500); }})()`);
if(typeof r==='string'){ assert('T1 场景搭建',false,r); }
else{
assert('T1 无墙30m可索敌',r.acq1===true);
assert('T1 ★ 预算耗尽+无墙: 当前目标优先射线照发 ⇒ lastSeenT 照常刷新',r.acqRefresh===true,'used='+r.budgetOver);
assert('T1 ★ 优先射线确实超发预算 (带优先权的证据)',r.budgetOver===true);
assert('T1 无墙30m可索敌 (场2)',r.acq2===true);
assert('T1 ★ 预算耗尽+墙: _curBlk=true',r.curBlk===true);
assert('T1 ★ 预算耗尽+墙: lastSeenT 冻结 (旧版隔墙刷新=开火门常开)',r.lstFrozen===true);
assert('T1 ★ 预算充足+墙: 同样冻结 (复核口径与预算无关)',r.curBlk2===true&&r.lstFrozen2===true);
}
}

// ═══ T2 端到端: 墙+预算耗尽连续 update ═══
section('T2 端到端 (墙+预算耗尽下连续 update, lastSeenT 持续冻结)');
{
const r=run(`(()=>{try{
const out={};
__AI.clearAll();
const sp=__AI.openSpot(26); if(!sp) return 'NOPLACE';
const A=__AI.mkBot(0,sp.ax,sp.az,'哨E'); A.yaw=Math.PI;
const B=__AI.mkBot(1,sp.bx,sp.bz,'靶E');
nowT=3000; A.perceive();
out.acq=A.target===B;
__AI.mkWall((sp.ax+sp.bx)/2,(sp.az+sp.bz)/2,5,3.4,0.5);
RAY_BUDGET.maxPerFrame=0; // 全场饥饿 (比真实乱斗更狠: 连别人的 12 发都没有)
out.refreshed=0;
for(let k=1;k<=20;k++){
nowT=3000+k*0.2;
A.update(0.2);
if(A.lastSeenT>=nowT-0.001) out.refreshed++;
}
RAY_BUDGET.maxPerFrame=12;
out.targetKept=A.target===B;        // 8s 内不清目标 (语义: 记忆, 不是可见)
out.frozenMostly=out.refreshed===0; // ★全程零刷新 = 开火门 (lastSeenT<0.6) 全程关闭
return out;
}catch(e){ return 'EXC:'+String(e&&e.stack||e).slice(0,500); }})()`);
if(typeof r==='string'){ assert('T2 场景搭建',false,r); }
else{
assert('T2 墙落前可索敌',r.acq===true);
assert('T2 ★ 墙+全场饥饿: 20 拍 (4s) 零刷新 ⇒ 开火门全程关闭',r.frozenMostly===true,'refreshed='+r.refreshed);
assert('T2 目标 8s 记忆语义不变 (不清目标, 只断视)',r.targetKept===true);
}
}

// ═══ T3 机枪座开火预检 + 压制 (B修) ═══
section('T3 机枪座: 可见+墙 ⇒ 预检拦截 / 断视 ⇒ 压最后目击位');
{
const r=run(`(()=>{try{
const out={};
__AI.clearAll();
const _oldFire=emplMGFire; let calls=0;
emplMGFire=(g,s,d)=>{ calls++; };
try{
const sp=__AI.openSpot(24); if(!sp) return 'NOPLACE';
const A=__AI.mkBot(0,sp.ax,sp.az,'机枪手'); A.yaw=Math.PI;
const B=__AI.mkBot(1,sp.bx,sp.bz,'靶M');
const mg={x:sp.ax,y:heightAt(sp.ax,sp.az),z:sp.az,face:0,yaw:{rotation:{y:0}},pitch:{rotation:{x:0}},fireT:0,heat:0};
A.mgUse=mg; A.emplPinT=0;
// 场1: 可见无墙 ⇒ 照常出膛
nowT=4000; A.target=B; A.lastSeenT=nowT; A.lastSeenPos.copy(B.pos);
A.update(0.05);
out.visFire=calls>0;
// 场2: 可见 (<0.6s) + 墙 ⇒ 开火瞬间预检拦截: 不出膛 + fireT=0.12 短退避
__AI.mkWall((sp.ax+sp.bx)/2,(sp.az+sp.bz)/2,5,3.4,0.5);
calls=0; mg.fireT=0;
nowT=4002; A.target=B; A.lastSeenT=nowT; A.lastSeenPos.copy(B.pos);
A.update(0.05);
out.blockedNoFire=calls===0;
out.blockedBackoff=mg.fireT===0.12;
// 场3: 断视 1.5s (<2.5s) + 墙 ⇒ 改压最后目击位: 出膛 (压制语义, 弹道自己撞墙)
calls=0; mg.fireT=0;
nowT=4004; A.target=B; A.lastSeenT=nowT-1.5; A.lastSeenPos.copy(B.pos);
A.update(0.05);
out.suppressFire=calls>0;
}finally{ emplMGFire=_oldFire; }
return out;
}catch(e){ return 'EXC:'+String(e&&e.stack||e).slice(0,500); }})()`);
if(typeof r==='string'){ assert('T3 场景搭建',false,r); }
else{
assert('T3 机枪可见无墙照常出膛',r.visFire===true);
assert('T3 ★ 可见+墙: 开火瞬间预检拦截, 不再朝墙泼弹',r.blockedNoFire===true);
assert('T3 ★ 被挡短退避 fireT=0.12 (不烧每帧预检射线)',r.blockedBackoff===true);
assert('T3 ★ 断视<2.5s: 改压最后目击位 (压制弹, 与步枪 supFireT 同语义)',r.suppressFire===true);
}
}

// ═══ T4 火箭筒预检收紧 (C修) ═══
section('T4 火箭筒: 58m 目标 + 53m 墙 ⇒ 不发 (旧 65m 定长口径会放行)');
{
const r=run(`(()=>{try{
const out={};
__AI.clearAll();
const _oldFR=fireRocket; let calls=0;
fireRocket=(s,o,d,def,v)=>{ calls++; };
try{
const mk=(x,z)=>{ const b=__AI.mkBot(0,x,z,'筒子'); b.cls=3; b.slots=[{key:'at',def:{rocket:true,name:'火箭筒'},mag:1}]; b.fireT=0; b.reloadT=0; b.boltT=0; b.switchVisualGun=()=>{}; return b; };
const lim=MAP_SIZE/2-20;
// 找一条 116m 平坦直带 (每 4m 采样高差 ≤2 且无静态遮挡): 保证 58m 射界净空 + 53m 处的墙真能挡住眼线
let ax=0,az=0,found=false;
for(let i=0;i<12000&&!found;i++){
ax=(Math.random()*2-1)*lim; az=(Math.random()*2-1)*lim;
if(Math.abs(az-116)>lim) continue;
let ok=true,gmin=1e9,gmax=-1e9;
for(let s=0;s<=116;s+=4){
const zz=az-s;
if(occBlocked(ax,zz)){ ok=false; break; }
const g=heightAt(ax,zz);
if(g<gmin) gmin=g; if(g>gmax) gmax=g;
}
if(!ok||gmax-gmin>2) continue;
found=true;
}
if(!found) return 'NOPLACE1';
const T1=__AI.mkTank(1,ax,az-58);
const R1=mk(ax,az); R1.yaw=Math.PI; R1.switchVisualGun=()=>{}; // 桩: 假 key 无真枪模 (修的不是表现层)
nowT=5000; R1.decide();
out.c1=calls===1&&R1.slots[0].mag===0;
// 场2: 同距 + 53m 处横墙 ⇒ 预检收紧: 不发 (旧口径: 打 65m 定长, 墙在 53m ⇒ dist≈53>50 放行 = 隔墙发火箭)
calls=0;
tanks.length=0;                       // 清场1的 T1: 它停在 R1 的靶位, 会以 0m/58m 抢走 eTank
const T2=__AI.mkTank(1,ax,az-58);     // R2 的靶: 58m (与场1同距)
const R2=mk(ax,az); R2.yaw=Math.PI;   // R2 与 R1 同起点
__AI.mkWall(ax,az-53,5,14,0.5);       // 墙在 R2 前方 53m (距 T2 5m); 平坦带+14m 高墙保挡
nowT=5002; R2.decide();
out.c2=calls===0&&R2.slots[0].mag===1;
}finally{ fireRocket=_oldFR; }
return out;
}catch(e){ return 'EXC:'+String(e&&e.stack||e).slice(0,500); }})()`);
if(typeof r==='string'){ assert('T4 场景搭建',false,r); }
else{
assert('T4 ★ 无墙 58m: 照发 (火力不误伤)',r.c1===true);
assert('T4 ★ 58m 目标+53m 墙: 收紧后不发 (旧口径 dist>50 会放行 = 隔墙发火箭)',r.c2===true);
}
}

// ═══ T5 上车贴壳 + 顶壳超时 (I修) ═══
section('T5 上车: 贴壳即上 (旧门 2.7m 够不到) / 顶壳 6s 超时拉黑');
{
const r=run(`(()=>{try{
const out={};
__AI.clearAll();
const bx=0,bz=0;
const gy=heightAt(bx,bz);
// I1: 兵站在旧推挤边界 (车壳前 0.83m = vehiclePushSoldiers 顶人位), 车心距 4.35m — 旧门 d<2.7 够不到
const tv1=__AI.mkTank(0,bx,bz,6.9); tv1.yaw=0;   // yaw=0: 车体轴线 = ±Z
const P1=__AI.mkBot(0,bx,bz-4.35,'兵1');
P1.state='toVehicle'; P1.targetVeh=tv1; tv1.claimBot=P1;
nowT=6000; P1.update(0.05);
out.board=P1.onVehicle===tv1&&tv1.crewBot===P1&&P1.state==='idle';
// I2: 远处 (车壳外 2.6m) ⇒ 不上车也不起计时
const tv2=__AI.mkTank(0,bx+40,bz,6.9); tv2.yaw=0;
const P2=__AI.mkBot(0,bx+40,bz-6.5,'兵2');
P2.state='toVehicle'; P2.targetVeh=tv2; tv2.claimBot=P2;
nowT=6002; P2.update(0.05);
out.farNoBoard=P2.onVehicle===null&&P2.state==='toVehicle';
out.farNoTimer=P2.vehGoT===0;
// I3: 贴壳带 1.15m 却被顶住 (moveDir/pushToward 桩死模拟"夹在墙/车之间") ⇒ 6s 超时放弃+拉黑 12s
const tv3=__AI.mkTank(0,bx-40,bz,6.9); tv3.yaw=0;
const P3=__AI.mkBot(0,bx-40,bz-5.05,'兵3');
P3.state='toVehicle'; P3.targetVeh=tv3; tv3.claimBot=P3;
P3.moveDir=()=>{}; P3.pushToward=()=>0; P3.followPath=()=>null;
nowT=6100;
for(let k=0;k<7;k++){ nowT=6100+k+1; P3.update(1.0); }
out.timeoutGiveUp=P3.state==='idle'&&P3.targetVeh===null&&tv3.claimBot===null;
out.blacklisted=P3.vehFailV===tv3&&P3.vehFailT===nowT+12;
// I3b: 拉黑期内 decide 不再认领同一辆 (防 yo-yo)
P3.moveDir=null; P3.pushToward=null; P3.followPath=null;
P3.decide();
out.noYo=P3.targetVeh!==tv3;
return out;
}catch(e){ return 'EXC:'+String(e&&e.stack||e).slice(0,500); }})()`);
if(typeof r==='string'){ assert('T5 场景搭建',false,r); }
else{
assert('T5 ★ 贴壳 0.45m (旧推挤边界内侧): 一帧上车 (旧门 d=4.35>2.7 永远够不到)',r.board===true);
assert('T5 车壳外 2.6m: 不上车',r.farNoBoard===true);
assert('T5 远处不起顶壳计时 (vehGoT 只在贴壳带累计)',r.farNoTimer===true);
assert('T5 ★ 顶壳 6s 超时: 放弃认领归建 (state=idle/claim 清账)',r.timeoutGiveUp===true);
assert('T5 ★ 该车拉黑 12s (vehFailV/vehFailT)',r.blacklisted===true);
assert('T5 ★ 拉黑期内 decide 不再认领同一辆 (防无限 yo-yo)',r.noYo===true);
}
}

// ═══ T6 士兵间软分离 (E修) ═══
section('T6 士兵间软分离: 对称各推一半 / 死人·观战·楼上下·俯卧不推 / 玩家只被让路');
{
const r=run(`(()=>{try{
const out={};
__AI.clearAll();
const lim=MAP_SIZE/2-16;
let gx=0,gz=0,found=false;
for(let i=0;i<8000&&!found;i++){
gx=(Math.random()*2-1)*lim; gz=(Math.random()*2-1)*lim;
if(!occBlocked(gx,gz)&&!occBlocked(gx+0.3,gz)) found=true;
}
if(!found) return 'NOPLACE';
const g0=heightAt(gx,gz);
// a) 重叠 0.3m: 各推一半, 收敛到 BOT_SEP_R=0.85
const A=__AI.mkBot(0,gx,gz,'甲'); const B=__AI.mkBot(0,gx+0.3,gz,'乙');
const bx0=B.pos.x;
_soldierSep(A);
out.aPush=Math.abs(A.pos.x-(gx-0.22))<0.01;         // 推 0.22 (限幅)
out.bStill=B.pos.x===bx0;                            // 只推自己
_soldierSep(B);
out.aDist=Math.hypot(A.pos.x-B.pos.x,A.pos.z-B.pos.z);
out.converge=out.aDist>0.6&&out.aDist<0.86;          // 0.3+0.22+0.22=0.74
// b) 死人不推
A.pos.set(gx,g0,gz);
B.alive=false;
const ax0=A.pos.x; _soldierSep(A);
out.deadSkip=A.pos.x===ax0;
B.alive=true;
// c) 观战者不推
B.spectator=true; _soldierSep(A); out.specSkip=A.pos.x===ax0; B.spectator=false;
// d) 楼上下 (|dy|>1.6) 不推
B.pos.set(gx+0.3,g0+3,gz); _soldierSep(A); out.floorSkip=A.pos.x===ax0; B.pos.set(gx+0.3,g0,gz);
// e) 俯卧推力减半 (0.55 缝 ×0.5 对称 ×0.5 俯卧 = 0.1375)
A.prone=true; _soldierSep(A);
out.proneHalf=Math.abs((ax0-A.pos.x)-0.1375)<0.01; A.prone=false;
// f) 玩家只被让路
A.pos.set(gx,g0,gz);
player.alive=true; player.spectator=false; player.onVehicle=null; player.capCrew=null;
player.pos.set(gx+0.3,g0,gz);
const px0=player.pos.x; _soldierSep(A);
out.playerSafe=player.pos.x===px0&&A.pos.x<gx;       // A 被推离玩家, 玩家不动
// g) update 全链生效: 重叠两人各跑一拍 update, 距离拉开
__AI.clearAll();
const C=__AI.mkBot(0,gx,gz,'丙'); const D=__AI.mkBot(0,gx+0.3,gz,'丁');
nowT=7000; C.update(0.05); D.update(0.05);
out.viaUpdate=Math.hypot(C.pos.x-D.pos.x,C.pos.z-D.pos.z)>0.45;
return out;
}catch(e){ return 'EXC:'+String(e&&e.stack||e).slice(0,500); }})()`);
if(typeof r==='string'){ assert('T6 场景搭建',false,r); }
else{
assert('T6 ★ 重叠推离 0.22m (限幅)',r.aPush===true);
assert('T6 ★ 只推自己 (对方这拍不动, 对称靠双方各跑一遍)',r.bStill===true);
assert('T6 ★ 双方各跑一遍后收敛到分离半径 (0.6~0.85m)',r.converge===true,'d='+r.aDist.toFixed(2));
assert('T6 死人不推',r.deadSkip===true);
assert('T6 观战者不推',r.specSkip===true);
assert('T6 楼上下 (|dy|>1.6) 不推',r.floorSkip===true);
assert('T6 ★ 俯卧推力减半 (0.1375=0.275×0.5)',r.proneHalf===true);
assert('T6 ★ 玩家只被让路不被推',r.playerSafe===true);
assert('T6 ★ update 全链里分离生效 (阴性对照走 --neg 摘调用点)',r.viaUpdate===true);
}
}

// ═══ T7 驻点占用账 (F修) ═══
section('T7 驻点占用账: 意向/现位都计数 + 三处消费点源码在场');
{
const r=run(`(()=>{try{
const out={};
__AI.clearAll();
const lim=MAP_SIZE/2-16;
let gx=0,gz=0,found=false;
for(let i=0;i<8000&&!found;i++){
gx=(Math.random()*2-1)*lim; gz=(Math.random()*2-1)*lim;
if(!occBlocked(gx,gz)) found=true;
}
if(!found) return 'NOPLACE';
const A=__AI.mkBot(0,gx+30,gz+30,'账主');
const B=__AI.mkBot(0,gx-30,gz-30,'占位');
// a) 队友意向 (coverPt) 在点旁 ⇒ 计 1
B.coverPt={x:gx,z:gz}; B.defendPt=null; B.pushPt=null;
out.intent=coverCrowdAt(A,gx,gz)===1;
// b) 意向三字段互斥不重复计 (同一个人只算一次)
B.coverPt={x:gx,z:gz}; B.defendPt={x:gx,z:gz}; B.pushPt={x:gx,z:gz};
out.once=coverCrowdAt(A,gx,gz)===1;
// c) 意向挪走 + 人站在点旁 ⇒ 现位计 1
B.coverPt=null; B.defendPt=null; B.pushPt=null;
B.pos.set(gx,heightAt(gx,gz),gz);
out.present=coverCrowdAt(A,gx,gz)===1;
// d) 人挪远 ⇒ 0
B.pos.set(gx-30,heightAt(gx-30,gz-30),gz-30);
out.far=coverCrowdAt(A,gx,gz)===0;
// e) 敌队不计
B.team=1; B.pos.set(gx,heightAt(gx,gz),gz);
out.enemySkip=coverCrowdAt(A,gx,gz)===0;
B.team=0;
return out;
}catch(e){ return 'EXC:'+String(e&&e.stack||e).slice(0,500); }})()`);
const s14=srcOf('js/14-bots.js');
if(typeof r==='string'){ assert('T7 场景搭建',false,r); }
else{
assert('T7 ★ 队友意向 (coverPt) 计数',r.intent===true);
assert('T7 ★ 同一人三字段同点只计一次',r.once===true);
assert('T7 ★ 现位计数',r.present===true);
assert('T7 人挪远不计',r.far===true);
assert('T7 敌队不计 (只数同队)',r.enemySkip===true);
}
assert('T7 ★ 消费点三处在场 (defendPt×9 / findCoverFrom×5 / findCoverToward×5)',
 s14.includes('const dd=d+rand(0,14)+coverCrowdAt(this,cp.x,cp.z)*9;')
 &&s14.includes('sc+=coverCrowdAt(this,cp.x,cp.z)*5;')
 &&s14.includes('const sc=d+rand(0,3)+coverCrowdAt(this,cp.x,cp.z)*5;'));
}

// ═══ T8 目标粘滞 (H修) ═══
section('T8 目标粘滞: 粘滞期零换目标 / 归零恢复 6% 门 / 己方旗被夺紧急重选');
{
const r=run(`(()=>{try{
const out={};
__AI.clearAll();
const A=__AI.mkBot(0,10,10,'粘滞');
A.pickObjective=(function(){ const orig=Bot.prototype.pickObjective.bind(A); let n=0;
return function(){ n++; orig(); A._pickN=n; };})();
A.pickObjective(); // 先拿一个真目标 (clash 模式: 合成敌点)
out.hasObj=!!A.objective;
// a) 粘滞期 (objHoldT>0): 300 拍 decide 零换目标 (旧版 6%/拍 ⇒ 期望 ~18 次)
A.objHoldT=999; A._pickN=0;
for(let k=0;k<300;k++){ nowT=8000+k*0.4; A.decide(); }
out.holdZero=A._pickN===0;
// b) 归零: 恢复随机换门 (120 拍 ×6% ⇒ P(0)=0.94^120≈5e-4)
let picks=0;
for(let k=0;k<120;k++){ A.decide(); A.objHoldT=0; picks=A._pickN; }
out.freePicks=picks>=1;
// c) 己方旗被夺: 粘滞期也立刻紧急重选
A.objective={id:'T',x:A.pos.x+40,z:A.pos.z,r:14,owner:A.team,cap:0,capTeam:1-A.team,gy:0};
A.objHoldT=999; A._pickN=0;
nowT=9000; A.decide();
out.urgent=A._pickN>=1;
return out;
}catch(e){ return 'EXC:'+String(e&&e.stack||e).slice(0,500); }})()`);
if(typeof r==='string'){ assert('T8 场景搭建',false,r); }
else{
assert('T8 目标在手',r.hasObj===true);
assert('T8 ★ 粘滞期 300 拍零换目标 (旧版 ~18 次 = 半路掉头往返根因)',r.holdZero===true);
assert('T8 ★ 粘滞归零后恢复 6% 随机换门',r.freePicks===true);
assert('T8 ★ 己方旗被夺: 粘滞期也立刻紧急重选',r.urgent===true);
}
}

// ═══ T9 源码防回退 ═══
section('T9 源码防回退 (修好的写法在 / 旧写法不在)');
{
const s=srcOf('js/14-bots.js');
assert('T9-A 当前目标优先复核在场 (循环外复核+循环内消费)',
 s.includes('this._curBlk=blk;')&&s.includes('if(this._curBlk) continue;')
 &&s.includes('const bh=raycastWorld(eye,dir0,dist0);'));
assert('T9-A 旧"复用上一周期通视"写法不在',!s.includes('复用上一周期通视状态'));
assert('T9-B 机枪开火预检在场',s.includes('const chk=raycastWorld(eye,dir,dh);')&&s.includes('const mgVis=nowT-this.lastSeenT<0.6;'));
assert('T9-C 火箭筒预检收紧在场 (打到目标实际距离, 3m 裕量)',
 s.includes('const chk=raycastWorld(eye2,dir2,dTk);')&&s.includes('if(!chk||chk.dist>dTk-3){'));
assert('T9-C 旧 65m 定长写法不在',!s.includes('raycastWorld(eye2,dir2,65)'));
assert('T9-E 软分离在场 (单源+调用点)',
 s.includes('function _soldierSep(b){')&&s.includes('_soldierSep(this);')
 &&s.includes('const BOT_SEP_R=0.85, BOT_SEP_MAX=0.22;'));
assert('T9-F 驻点占用账在场 (单源+三消费)',s.includes('function coverCrowdAt(self,x,z){'));
assert('T9-H 目标粘滞在场 (选定即承诺+计时衰减+紧急门)',
 s.includes('this.objHoldT=rand(4,7);')&&s.includes('if(this.objHoldT>0) this.objHoldT-=dt;')
 &&s.includes('if(!_fo||(_fo.owner===this.team&&_fo.capTeam!==-1&&_fo.capTeam!==this.team)||(this.objHoldT<=0&&Math.random()<0.06)) this.pickObjective();'));
assert('T9-H 旧无条件 6% 换目标写法不在',!s.includes('if(!this.objective||Math.random()<0.06) this.pickObjective();'));
assert('T9-I 贴壳判定+超时拉黑在场 (几何与 15-vehicles 推挤同源同参)',
 s.includes('if(_surf<0.55){ this.enterVehicle(tv); return; }')
 &&s.includes('const _hL=((tv.def&&tv.def.hullL)?tv.def.hullL:4.6)/2+0.45;')
 &&s.includes('if(this.vehFailV===tv&&nowT<this.vehFailT) continue;')
 &&s.includes('this.vehFailV=tv; this.vehFailT=nowT+12;'));
assert('T9-I 旧 VEH_BOARD_R 车心门写法不在',!s.includes('if(d<VEH_BOARD_R){ this.enterVehicle(tv); return; }'));
}

// ── 汇总 ─────────────────────────────────────────────────────
console.log(`\n${NEG?'[阴性对照] ':''}verify-botai-20261103: ${OK.length} 通过, ${BAD.length} 失败`);
if(BAD.length){ console.log('失败项:'); for(const b of BAD) console.log('  ✗ '+b); process.exit(1); }
process.exit(0);
