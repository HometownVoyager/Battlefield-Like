// ─────────────────────────────────────────────
// dev/_navalcrew-selfcheck.js —— task-5 (naval-crew) 六项自检 (2026-09-20N 海战批)
//
// 用法: node dev/_navalcrew-selfcheck.js
// 覆盖 (逐条对应 task-5 的【自检】段):
//   ① 上艇/游泳贴近两种距离阈值的判定表   (陆上 4.5m / 水上 2.5m, 用户裁定①)
//   ② 驾驶/主炮/机炮/鱼雷全通             (走 20-player 的真实分派链 updatePlayer → updatePlayerNaval)
//   ③ 下艇无 >0.5m 单帧位移               (限速跨出, 严禁 pos.set 硬瞬移 —— 2026-09-20 闪现修复口径)
//   ④ 开局实数: 每队 2 坦克 + 2 两栖车 + 3 艇, 全图 1 飞机 (走真实的 23-deploy startMatch)
//   ⑤ 其余 11 图 0 海战载具               (同链路上把 NavalCraft 桩注入后仍为 0 —— 这才是真的在测 SEA 守卫)
//   ⑥ HUD/海图符号/炮台播报/对局退场清理  (22-hud 追加段)
//
// 沙箱边界 (诚实声明): 本文件走 dev/_bootstub.js 的 THREE/DOM 桩, 验的是**本写入域五个文件的逻辑与数值**;
//   真 DOM/CSS/WebGL 与真输入链部分在 verifier 的 dev/probe-naval.js (真浏览器 + CDP) 里。
//
// 为什么注入一份 NavalCraft 桩: 15d-naval 是队友的并行模块 (签名冻结在定稿 §11.3)。本套件要断言的是
//   **玩家链/编制/HUD** 而不是队友的实现细节, 故:
//     · 桩按冻结签名实现 (constructor(specKey,team,ord) / pos / yaw / vel / hp / maxHp / alive / flood /
//       state / spec / kind / name / grp / torpAmmo / playerDriven / driverBot / crewBot / muzzle / aimDir /
//       turretAimAt / drive / fireMain / fireSecondary / fireMG / fireTorpedo / respawn / crewOut),
//       并把每次调用记进 calls{} 供断言;
//     · 15d 真落盘时本套件**不加载**它 (避免把队友的进行中状态算进我的自检); 隔离性由"只加载 20a/20-player/
//       19-input/23-deploy/22-hud"保证。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const {sandbox,document,window,byId}=require('./_bootstub.js');
delete window.CANNON; // 12-ragdolls 见到 window.CANNON 会走物理分支并半道崩 (与 verify-tankai/verify-naval 同口径)
// ★真键位闸门回放 (2026-09-20N, Lead 裁定): "玩家能否做到 X" 的断言必须从**真输入入口**走一遍 ——
//   19-input 用全局 addEventListener('keydown'/'mousedown', ...) 注册处理器, 而 _bootstub 把它桩成空函数,
//   于是"直调 tryInteract"的用例会绕过输入闸门 (verifier 真浏览器探针抓到的正是这一层: 游泳态 KeyF 被 return 吞掉)。
//   这里把处理器记录下来, 自检用合成事件逐个回调 ⇒ 真走 键盘事件 → 输入闸门 → tryInteract → 座位 全链。
let CUR_HANDLERS={};
sandbox.addEventListener=(t,fn)=>{ (CUR_HANDLERS[t]=CUR_HANDLERS[t]||[]).push(fn); };
sandbox.window.addEventListener=sandbox.addEventListener;
sandbox.removeEventListener=()=>{};
// ——— 桩能力补丁 (与 dev/verify-naval.js 同一份: 缺了就会把"桩不支持"误报成实现缺陷) ———
const V3c=sandbox.THREE.Vector3;
V3c.prototype.addScalar=function(s){ this.x+=s; this.y+=s; this.z+=s; return this; };
V3c.prototype.divideScalar=function(s){ s=s||1; this.x/=s; this.y/=s; this.z/=s; return this; };
// 真 THREE 有 negate, 桩没有; 载具相机分支 (既有坦克相机与本批海战相机同一写法) 依赖它 —— 补上,
// 否则会把"桩缺口"误报成实现缺陷 (与 verify-naval 的补丁同性质)。
V3c.prototype.negate=function(){ this.x=-this.x; this.y=-this.y; this.z=-this.z; return this; };
V3c.prototype.subVectors=function(a,b){ this.x=a.x-b.x; this.y=a.y-b.y; this.z=a.z-b.z; return this; };
V3c.prototype.copy=function(v){ this.x=v.x; this.y=v.y; this.z=v.z; return this; };
V3c.prototype.project=function(){ return this; };
V3c.prototype.setFromMatrixPosition=function(){ return this; };
// 真 THREE 的 Group 有 clear(), 桩没有; 10-viewmodel 的 vmEquip 依赖它 (部署界面选载具出生必经) —— 补上,
// 否则会把"桩缺口"报成部署链缺陷 (与 verify-* 系列的桩补丁同性质)。
{
const G=sandbox.THREE.Group;
if(G&&G.prototype&&typeof G.prototype.clear!=='function') G.prototype.clear=function(){ if(this.children) this.children.length=0; return this; };
}
for(const k of ['MeshLambertMaterial','MeshBasicMaterial','MeshStandardMaterial','MeshPhongMaterial','PointsMaterial','SpriteMaterial']){
const C=sandbox.THREE[k];
if(!C||!C.prototype) continue;
if(!C.prototype.clone) C.prototype.clone=function(){ return new C(Object.assign({},this,{color:this.color})); };
if(!C.prototype.dispose) C.prototype.dispose=function(){};
}
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
sandbox.AudioContext=ACStub; window.AudioContext=ACStub; window.webkitAudioContext=ACStub;

const CAMP_ISLAND=11;   // CAMPAIGNS 顺序: 0..10 其余战役, 11 = island(塔拉瓦)
const NAV_FILES=['js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js'];
const HEAD=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15g-capmodels.js','js/15h-capital.js','js/15c-specveh.js'];
const TAIL=['js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/23-deploy.js','js/24-main.js'];

// ── NavalCraft 桩 (定稿 §11.3 冻结签名的最小实现 + 调用记录) ──
const STUB=`
class NavalCraft{
constructor(specKey,team,ord){
this.spec=NAVAL_SPEC[specKey]; this.key=specKey; this.team=team; this.ord=ord||0;
this.kind=this.spec.kind; this.name=this.spec.name;
this.pos=V3(0,0,0); this.yaw=0; this.vel=0; this.hp=this.spec.hp; this.maxHp=this.spec.hp;
this.alive=true; this.flood=0; this.state='run'; this.turretYaw=0; this.turretPitch=0;
this.driverBot=null; this.crewBot=null; this.playerDriven=false;
this.torpAmmo=this.spec.torpedo||0; this.respawnT=0;
this.calls={drive:0,main:0,sec:0,mg:0,torp:0,aim:0,lastFwd:0,lastTurn:0};
this.grp=new THREE.Group();
navalCraft.push(this);
}
drive(f,t,dt){
this.calls.drive++; this.calls.lastFwd=f; this.calls.lastTurn=t;
this.vel=f*this.spec.spd;
this.yaw-=t*this.spec.turn*dt*(f<0?-1:1);
this.pos.x+=Math.sin(this.yaw)*this.vel*dt; this.pos.z+=Math.cos(this.yaw)*this.vel*dt;
if(f===0){ this.vel=0; }
}
muzzle(nm){ return V3(this.pos.x+Math.sin(this.yaw)*2,this.pos.y+1,this.pos.z+Math.cos(this.yaw)*2); }
aimDir(){ return V3(Math.sin(this.yaw),0,Math.cos(this.yaw)); }
turretAimAt(x,z){ this.calls.aim++; this.turretYaw=angDiff(this.yaw,Math.atan2(x-this.pos.x,z-this.pos.z)); return true; }
fireMain(d){ this.calls.main++; this.lastDir=d&&d.x!==undefined?[+d.x.toFixed(3),+d.y.toFixed(3),+d.z.toFixed(3)]:null; return true; }
fireSecondary(d){ this.calls.sec++; return true; }
fireMG(d){ this.calls.mg++; return true; }
fireTorpedo(side){ if(this.torpAmmo<=0) return false; this.torpAmmo--; this.calls.torp++; this.calls.lastTorpSide=side===undefined?'auto':side; return true; }
takeDmg(a){ this.hp-=a; if(this.hp<=0) this.die(); }
die(){ this.alive=false; this.state='wreck'; }
respawn(){ this.alive=true; this.state='run'; this.hp=this.maxHp; this.flood=0; this.torpAmmo=this.spec.torpedo||0; }
crewOut(){}
}
const navalCraft=[];
function navalNear(x,z,r,team){
let b=null,bd=r+1e-9;
for(const c of navalCraft){
if(!c||!c.alive||c.state==='sinking'||c.state==='wreck') continue;
if(team!==undefined&&team!==null&&c.team!==team) continue;
// ★与真 15d 逐式同口径 (15d-naval.js:960-969): r 是**艇体距** = 中心距 - hullW/2, 不是中心距。
//   verifier 真浏览器探针已按这条口径校过 ("对 LVT 中心 3.0m 其实只有艇体距 1.375m, 上艇本来就是对的"),
//   桩若用中心距, 自检的阈值表就会与实机差 1.6~3.2m (典型假绿)。
const d=Math.hypot(c.pos.x-x,c.pos.z-z)-((c.spec&&c.spec.hullW)||0)*0.5;
if(d<bd){ bd=d; b=c; }
}
return b;
}
function navalCount(team,kind){ return navalCraft.filter(c=>c.team===team&&(kind===undefined||c.kind===kind)).length; }
function navalHitCyl(c){ return {x:c.pos.x,z:c.pos.z,r:c.kind==='boat'?3.2:1.8,y0:c.pos.y,y1:c.pos.y+2}; }
function shellHitNaval(){ return false; }
function torpedoHitTest(){ return null; }
function updateNaval(dt){}
`;

// ── VM 内测试台 ──
const PRELUDE=`globalThis.__T=(function(){
const pops=[];
const J=o=>JSON.parse(JSON.stringify(o));
function deps(){
return {updatePlayerNaval:typeof updatePlayerNaval,navalBoard:typeof navalBoard,navalSeatRelease:typeof navalSeatRelease,
navalCanFootExit:typeof navalCanFootExit,navalFireTorpedo:typeof navalFireTorpedo,navalBoardRadius:typeof navalBoardRadius,
navalNearestBoardable:typeof navalNearestBoardable,sfNavalMapSymbols:typeof sfNavalMapSymbols,navalSeatHud:typeof navalSeatHud,
navalHudTick:typeof navalHudTick,NavalCraft:typeof NavalCraft,onNavalField:'onNaval' in player};
}
// ① 编制实数 (走真实 23-deploy startMatch)
function counts(){
const tk={},pl={}; let plN=0;
try{ for(const t of tanks) tk[t.team]=(tk[t.team]||0)+1; }catch(e){}
try{ for(const p of planes){ pl[p.team]=(pl[p.team]||0)+1; plN++; } }catch(e){}
const nv=[];
try{ for(const c of navalCraft) nv.push({key:c.key,team:c.team,kind:c.kind,ord:c.ord,
x:+c.pos.x.toFixed(1),z:+c.pos.z.toFixed(1),yaw:+c.yaw.toFixed(3),crew:!!(c.crewBot||c.driverBot)}); }catch(e){}
return {campaign:CAMPAIGN.id,tanks:tk,planes:pl,planeN:plN,naval:nv,navalN:nv.length,muster:J(SEA&&SEA.muster||null)};
}
// 确定性布点 (全部走 03-terrain 单源)
function findPt(pred,step){
step=step||8;
for(let x=-300;x<=300;x+=step) for(let z=-300;z<=300;z+=step){ if(pred(x,z)) return {x,z}; }
return null;
}
function landPt(){ return findPt((x,z)=>waterDepthAt(x,z)<0); }
function deepPt(){ return findPt((x,z)=>waterDepthAt(x,z)>=3.4); }
// ② 上艇阈值判定表 (陆上/水上 × 三档距离)
function boardTable(){
const p=player, L=landPt(), W=deepPt();
const c=navalCraft.find(x=>x.kind==='amph')||navalCraft[0];
const rows=[];
for(const cs of [[3.0,L,'陆上'],[4.4,L,'陆上'],[4.6,L,'陆上'],[2.0,W,'水上'],[2.4,W,'水上'],[2.6,W,'水上']]){
const dist=cs[0], pt=cs[1], tag=cs[2];
navalSeatRelease();
c.team=player.team; c.alive=true; c.state='run'; c.playerDriven=false; c.torpAmmo=c.spec.torpedo||0;
c.pos.set(pt.x,0,pt.z);
const hw=((c.spec&&c.spec.hullW)||0)*0.5;         // 布点用**艇体距** (与 15d navalNear 同口径)
p.pos.set(pt.x+hw+dist,0,pt.z); p.pos.y=standHeight(p.pos.x,p.pos.z,10);
p.alive=true; p.deployed=true; p.swim=false;
const dep=+waterDepthAt(p.pos.x,p.pos.z).toFixed(2);
const r=navalBoardRadius();
const near=navalNearestBoardable();
const same=!!near&&near===c;
let boarded=false;
if(same) boarded=!!navalBoard(near,true);
if(boarded) navalSeatRelease();
rows.push({tag,dist,center:+(hw+dist).toFixed(2),hw,depth:dep,radius:r,nearSame:same,boarded});
}
return {rows,land:L,deep:W};
}
// ③ 驾驶/开火全通 (走真实分派链) + 座位不变量 + 相机
function armPlayer(){          // 模拟 deployPlayer 的武器槽初始化 (否则 curW 本来就是 null, 测不出"暂存/交还")
const k0=Object.keys(WPN_DEFS)[0];
player.slots=[{key:k0,def:WPN_DEFS[k0],mag:WPN_DEFS[k0].mag,reserve:WPN_DEFS[k0].reserve}];
player.curSlot=0; player.curW=player.slots[0];
return k0;
}
function driveFire(){
const p=player;
navalSeatRelease();
const wkey=armPlayer();
const c=navalCraft.find(x=>x.kind==='boat')||navalCraft[0];
const W=deepPt();
c.team=player.team; c.alive=true; c.state='run'; c.playerDriven=false;
c.torpAmmo=c.spec.torpedo||0;
c.calls={drive:0,main:0,sec:0,mg:0,torp:0,aim:0,lastFwd:0,lastTurn:0};
c.pos.set(W.x,0,W.z); p.pos.set(W.x,0,W.z); p.alive=true; p.deployed=true;
const boarded=navalBoard(c,true);
const stash={curWNull:p.curW===null,stashKey:p.navalW&&p.navalW.key};
const tp0=p.thirdPerson;
keys.KeyW=true; keys.KeyD=true;
for(let i=0;i<10;i++) updatePlayer(1/60);
const midFwd=c.calls.lastFwd, midTurn=c.calls.lastTurn;   // 驾驶帧期间的输入 (松键后会被 0 覆盖)
keys.KeyW=false; keys.KeyD=false;
mouseDown=true; updatePlayer(1/60); mouseDown=false;
mouse2Down=true; updatePlayer(1/60); mouse2Down=false;
const torpA=c.calls.torp;
tryInteract();                       // 水上 F = 鱼雷 (自动选管)
const torpB=c.calls.torp;
tryInteract();                       // 冷却中再按: 不应再发射 (节奏闸门)
const torpC=c.calls.torp;
const inv={onNaval:p.onNaval===c,onVehicleNull:p.onVehicle===null,curWNull:p.curW===null,
glued:Math.hypot(p.pos.x-c.pos.x,p.pos.z-c.pos.z)<0.001,swimOff:!p.swim,thirdPerson:p.thirdPerson===true,aimCalled:c.calls.aim>0};
const hud={wname:document.getElementById('wname').textContent,wmode:document.getElementById('wmode').textContent,
magN:document.getElementById('magN').textContent,resN:document.getElementById('resN').textContent,
nadeN:document.getElementById('nadeN').textContent,heat:document.getElementById('heatFill').style.width,
ammo:document.getElementById('ammoPanel').style.display,panel:_navalPanel?_navalPanel.wrap.style.display:'(none)',
panelBar:_navalPanel?_navalPanel.bar.style.width:'(none)',panelInfo:_navalPanel?_navalPanel.info.textContent:'(none)'};
updateCamera(1/60);
const camTP={d:+camera.position.distanceTo(c.pos).toFixed(2),y:+camera.position.y.toFixed(2)};
p.thirdPerson=false; updateCamera(1/60);
const camFP={d:+camera.position.distanceTo(c.pos).toFixed(2),y:+camera.position.y.toFixed(2)};
p.thirdPerson=tp0;
const mainDirOk=!!c.lastDir;
navalSeatRelease();
const curWAfter=p.curW&&p.curW.key;
return {boarded,drive:c.calls.drive,midFwd,midTurn,main:c.calls.main,sec:c.calls.sec,
mg:c.calls.mg,torp0:torpA,torp1:torpB,torp2:torpC,torpAmmo:c.torpAmmo,torpSide:c.calls.lastTorpSide,
mainDir:mainDirOk?c.lastDir:null,inv,stash,wkey,curWAfter,hud,camTP,camFP,boatVel:+c.vel.toFixed(2)};
}
// ④ 下艇限速跨出: 逐帧位移统计 + 座位交还
function exitRun(){
const p=player;
navalSeatRelease();
armPlayer();
const c=navalCraft.find(x=>x.kind==='boat')||navalCraft[0];
const W=deepPt();
c.team=player.team; c.alive=true; c.state='ground';   // 搁浅 ⇒ 可步行下船 (用户裁定③)
c.playerDriven=false;
c.pos.set(W.x,0,W.z); p.pos.set(W.x,0,W.z); p.alive=true; p.deployed=true;
navalBoard(c,true);
const canFoot=navalCanFootExit(c);
tryInteract();                                        // 搁浅态 F = 下船 (不是鱼雷)
const started=!!p.navalExit;
const p0={x:p.pos.x,y:p.pos.y,z:p.pos.z};
let maxStep=0, maxFrame=0, frames=0, prev={x:p.pos.x,y:p.pos.y,z:p.pos.z};
while(p.onNaval&&frames<300){
updatePlayer(1/60); frames++;
const d3=Math.hypot(p.pos.x-prev.x,p.pos.y-prev.y,p.pos.z-prev.z);
const dh=Math.hypot(p.pos.x-prev.x,p.pos.z-prev.z);
if(d3>maxStep) maxStep=d3;
if(dh>maxFrame) maxFrame=dh;
prev={x:p.pos.x,y:p.pos.y,z:p.pos.z};
}
const moved=Math.hypot(p.pos.x-p0.x,p.pos.z-p0.z);
const deepHere=waterDepthAt(p.pos.x,p.pos.z)>SWIM_DEPTH;
return {canFoot,started,frames,maxStep:+maxStep.toFixed(4),maxHoriz:+maxFrame.toFixed(4),
released:p.onNaval===null,onVehicle:p.onVehicle===null,curWBack:!!p.curW,moved:+moved.toFixed(2),
thirdPersonRestored:p.thirdPerson===tp0Saved(),exitLeft:!!p.navalExit,deepHere};
function tp0Saved(){ return false; }   // 站位: 仅用于读数, 不做断言
}
// ⑤ 弃船 (沉没链): 载具 sinking → 玩家落水且座位交还
function bailRun(){
const p=player;
navalSeatRelease();
const c=navalCraft.find(x=>x.kind==='amph')||navalCraft[0];
const W=deepPt();
c.team=player.team; c.alive=true; c.state='run'; c.playerDriven=false;
c.pos.set(W.x,0,W.z); p.pos.set(W.x,0,W.z); p.alive=true; p.deployed=true;
navalBoard(c,true);
c.state='sinking'; c.alive=false;
let maxStep=0,frames=0,prev={x:p.pos.x,y:p.pos.y,z:p.pos.z};
while(p.onNaval&&frames<400){
updatePlayer(1/60); frames++;
const d3=Math.hypot(p.pos.x-prev.x,p.pos.y-prev.y,p.pos.z-prev.z);
if(d3>maxStep) maxStep=d3;
prev={x:p.pos.x,y:p.pos.y,z:p.pos.z};
}
return {frames,maxStep:+maxStep.toFixed(4),released:p.onNaval===null,
floatY:+(p.pos.y-(waterYAt(p.pos.x,p.pos.z)-1.32)).toFixed(2),depth:+waterDepthAt(p.pos.x,p.pos.z).toFixed(2)};
}
// ⑥ HUD 收面板 / 海图符号 / 炮台播报
function hudRelease(){
const p=player;
armPlayer();
const c=navalCraft.find(x=>x.alive&&x.kind==='boat')||navalCraft[0];
const W=deepPt();
c.team=p.team; c.alive=true; c.state='run'; c.playerDriven=false;
c.pos.set(W.x,0,W.z); p.pos.set(W.x,0,W.z); p.alive=true; p.deployed=true;
navalBoard(c,true);
const before={ammo:document.getElementById('ammoPanel').style.display,panel:_navalPanel?_navalPanel.wrap.style.display:''};
navalSeatRelease();
const after={ammo:document.getElementById('ammoPanel').style.display,panel:_navalPanel?_navalPanel.wrap.style.display:''};
return {before,after};
}
function mapSym(){
const rec=[];
const mk=()=>({save(){},restore(){},beginPath(){},closePath(){},fill(){rec.push('F');},stroke(){},
translate(x,y){rec.push('T'+x.toFixed(1)+','+y.toFixed(1));},rotate(a){rec.push('R'+a.toFixed(3));},
moveTo(){},lineTo(){},fillRect(){rec.push('FR');},strokeRect(){},fillStyle:'',strokeStyle:'',lineWidth:1});
const ctx=mk();
const toMap=(x,z)=>[100+x*0.1,100+z*0.1];
const n=sfNavalMapSymbols(toMap,ctx,190,0);
const alive=navalCraft.filter(c=>c.alive).length;
const c0=navalCraft.find(c=>c.alive);
const expT='T'+(100+c0.pos.x*0.1).toFixed(1)+','+(100+c0.pos.z*0.1).toFixed(1);
return {n,alive,first:rec[0],expT,fill:rec.filter(s=>s==='F').length,total:rec.length};
}
function batteryPop(){
globalThis.showScorePop=function(m){ pops.push(String(m)); };
const restore=globalThis.showScorePop;
globalThis.BATTERIES=[{alive:true},{alive:true}];
navalHudTick(1/60);           // 首见: 只记账
const n0=pops.length;
globalThis.BATTERIES[1].alive=false;
navalHudTick(1/60);           // 存活位 true→false: 播报一次
const n1=pops.length;
navalHudTick(1/60);           // 再 tick 不重复播报
const n2=pops.length;
return {first:n0,afterKill:n1,afterAgain:n2,msg:pops[pops.length-1]||'',hasBatteries:'object'===typeof BATTERIES};
}
// ⑦ 对局退场清理 (包装 retireMatchActors)
function retire(){
const p=player;
navalSeatRelease();
const c=navalCraft.find(x=>x.alive)||navalCraft[0];
if(c){ c.playerDriven=true; c.driverBot={onVehicle:c,onNaval:c}; }
const before={naval:navalCraft.length,onNaval:p.onNaval};
retireMatchActors();
return {before,after:navalCraft.length,onNaval:p.onNaval,tanks:tanks.length,planes:planes.length,
grpDetached:!(c&&c.grp&&c.grp.parent),botUnbound:!(c&&c.driverBot)};
}
// ⑥c 部署界面选艇出生 → 直接在集结点进驾驶位 (与 F 上艇共用 navalBoard)
function deployIntoNaval(){
const p=player;
navalSeatRelease();
const list=(typeof deployVehList==='function')?deployVehList(p.team):null;
if(!list) return {ok:false,why:'no-deployVehList'};
const idx=list.findIndex(v=>(v.kind==='boat'||v.kind==='amph')&&v.alive);   // 只选存活的 (前面的用例打沉过一台)
if(idx<0) return {ok:false,why:'no-naval-in-list',len:list.length};
const c=list[idx];
if(!c.crewBot&&!c.driverBot) c.crewBot={onVehicle:c};   // 前面的用例可能已把车组请下车, 这里造一个可断言的初始态
const hadCrew=!!(c.crewBot||c.driverBot);
selectedSpawn='V'+idx;
let err=null;
try{ deployPlayer(); }catch(e){ err=String(e&&e.message||e); }
return {ok:!err,err,idx,kind:c.kind,hadCrew,
onNaval:p.onNaval===c,onVehicleNull:p.onVehicle===null,playerDriven:!!c.playerDriven,
glued:Math.hypot(p.pos.x-c.pos.x,p.pos.z-c.pos.z)<0.001,crewCleared:!(c.crewBot||c.driverBot),curWNull:p.curW===null};
}
function setAliveCounts(){ return {alive:navalCraft.filter(c=>c.alive).length}; }
// ═════ 真键位闸门用例 (2026-09-20N, Lead 裁定: "玩家能否做到 X"必须从真输入入口走一遍) ═════
// 合成事件 → 19-input 的 keydown/mousedown 处理器 → 输入闸门 → tryInteract → 座位。
// 教训来源: verifier 真浏览器探针实测"水上 2.2m 按 F 不上艇", 根因是 19-input 游泳分支把 KeyF 吞了 ——
// 而本套件原先直调 tryInteract/座位 API, 绕过了那一层, 所以没暴露 (断言必须走真入口)。
function keyDown(code){
const hs=(globalThis.__HANDLERS||{})['keydown']||[];
for(const h of hs) h({code,repeat:false,preventDefault(){},stopPropagation(){},button:0});
return hs.length;                                  // >0 才说明处理器真的注册过 (否则"封禁"断言会假通过)
}
function keyUp(code){
const hs=(globalThis.__HANDLERS||{})['keyup']||[];
for(const h of hs) h({code,preventDefault(){},stopPropagation(){}});
return hs.length;
}
function keyEv(code){ const n=keyDown(code); keyUp(code); return n; }   // 一次"点按"
function mouseEv(down,button){
const t=down?'mousedown':'mouseup';
const hs=(globalThis.__HANDLERS||{})[t]||[];
for(const h of hs) h({button:button||0,preventDefault(){},stopPropagation(){}});
return hs.length;
}
function bindPlayer(){                               // 真输入链前置: 指针锁定 + 已部署存活 + 两把枪槽
pointerLocked=true;
const ks=Object.keys(WPN_DEFS);
player.slots=[{key:ks[0],def:WPN_DEFS[ks[0]],mag:WPN_DEFS[ks[0]].mag,reserve:WPN_DEFS[ks[0]].reserve},
{key:ks[1],def:WPN_DEFS[ks[1]],mag:WPN_DEFS[ks[1]].mag,reserve:WPN_DEFS[ks[1]].reserve}];
player.curSlot=0; player.curW=player.slots[0];
player.alive=true; player.deployed=true; player.hp=100;
player.nadeHeld=false; player.prone=false; player.braced=false; player.grabAction=null; player.useCast=null;
VM.state='idle';
return ks;
}
// 把测试艇单独留下, 其余载具挪走并置死 —— 否则"最近的可上载具"可能命中上一用例留在同一布点的另一台
// (自检里这类"两台艇叠在同一点"会让 nearSame=false, 是典型的测试串扰, 不是实现缺陷)
function isolate(c,pt){
for(const o of navalCraft){ if(o===c) continue; o.alive=false; o.playerDriven=false;
o.pos.set(pt.x+600,0,pt.z+600); if(o.grp) o.grp.position.set(o.pos.x,0,o.pos.z); }
c.alive=true; c.team=player.team; c.state='run'; c.playerDriven=false;
c.pos.set(pt.x,0,pt.z); if(c.grp) c.grp.position.set(pt.x,0,pt.z);
}
// ① 上艇阈值 —— 全部经合成 F 键 (陆上 3.0 可上 / 4.6 不可上; 水上 2.2 可上 / 3.0 不可上)
function gateBoardTable(){
const p=player, L=landPt(), W=deepPt();
const c=navalCraft.find(x=>x.kind==='amph')||navalCraft[0];
bindPlayer();
const rows=[];
for(const cs of [[3.0,L,'陆上'],[4.6,L,'陆上'],[2.2,W,'水上'],[3.0,W,'水上']]){
const dist=cs[0], pt=cs[1], tag=cs[2];
navalSeatRelease();
isolate(c,pt);
c.state='run';
const hw2=((c.spec&&c.spec.hullW)||0)*0.5;
p.pos.set(pt.x+hw2+dist,0,pt.z); p.pos.y=standHeight(p.pos.x,p.pos.z,10);   // 布点用艇体距 (与 navalNear 同口径)
p.alive=true; p.deployed=true; p.vel.set(0,0,0);
p.swim=false; p.onGround=false;
// 让 20-player 自己算出真实水体态 (游泳/涉水) —— 这样连 p.swim 都是链路算出来的
updatePlayer(1/60);
const swimBefore=p.swim, depth=+waterDepthAt(p.pos.x,p.pos.z).toFixed(2);
const handlers=keyEv('KeyF');
const boarded=p.onNaval===c;
const seat=!!p.onNaval;
if(seat) navalSeatRelease();
rows.push({tag,dist,center:+(hw2+dist).toFixed(2),depth,swimBefore,handlers,boarded,seat});
}
return rows;
}
// ② 游泳态纪律: 只额外放行 F, 1/2/R 保持放行, 开火/投掷/卧倒/近战/工事继续封禁
function gateSwimDiscipline(){
const p=player, W=deepPt();
bindPlayer();
const c=navalCraft.find(x=>x.kind==='boat')||navalCraft[0];
navalSeatRelease();
isolate(c,W);
c.torpLeft=c.spec.torpedo||0;
p.pos.set(W.x+2.2,0,W.z); p.pos.y=standHeight(p.pos.x,p.pos.z,10);
p.vel.set(0,0,0); p.swim=false; p.onGround=false;
updatePlayer(1/60);                                  // 链路自算: 深水 ⇒ p.swim=true
const swim=p.swim;
const h=[];
const before={slot:p.curSlot,vm:VM.state,prone:p.prone,nade:p.nadeHeld,curW:p.curW&&p.curW.key};
h.push(keyEv('KeyZ')); const proneAfter=p.prone;
h.push(keyEv('KeyV')); const vmAfter=VM.state;
h.push(keyEv('KeyG')); const nadeAfter=p.nadeHeld;
h.push(keyEv('KeyB'));                               // 工事/医疗箱: 游泳态不该触发 (B 在游泳分支外)
p.curW.mag=0; h.push(keyEv('KeyR')); const vmReload=VM.state;
VM.state='idle';                                     // 换枪要求 VM.state 为 idle (K 用例会把 VM 置成 reload)
h.push(keyEv('Digit2')); const slotAfter=p.curSlot;
VM.state='idle';                                     // vmEquip 会占住 VM 状态, 换回 1 号槽前先放开 (真机是动画播完)
h.push(keyEv('Digit1')); const slotBack=p.curSlot;
const handlersMax=Math.max.apply(null,h);
// F: 游泳态必须能上艇 (本用例的核心)
const near=navalNearestBoardable();
const diag={dist:+Math.hypot(c.pos.x-p.pos.x,c.pos.z-p.pos.z).toFixed(2),
nearSame:!!near&&near===c,nearKey:near?near.key:null,radius:navalBoardRadius(),
depth:+waterDepthAt(p.pos.x,p.pos.z).toFixed(2),grab:!!p.grabAction,useCast:!!p.useCast,swimAtPress:p.swim};
const boarded=keyEv('KeyF')>0&&p.onNaval===c;
p.curW=player.slots[player.curSlot];
if(p.onNaval) navalSeatRelease();
return {swim,handlersMax,before,after:{prone:proneAfter,vm:vmAfter,nade:nadeAfter,vmReload,slotAfter,slotBack},diag,
proneBanned:proneAfter===false,meleeBanned:vmAfter==='idle',nadeBanned:nadeAfter===false,
switchOK:slotAfter===1&&slotBack===0,reloadOK:vmReload==='reload',boarded};
}
// ③ 驾驶/开火也走真鼠标闸门 (mousedown/mouseup → mouseDown/mouse2Down → updatePlayerNaval)
function gateFire(){
const p=player, W=deepPt();
bindPlayer();
const c=navalCraft.find(x=>x.kind==='boat'||x.spec.secondary)||navalCraft[0];
navalSeatRelease();
isolate(c,W);
c.calls={drive:0,main:0,sec:0,mg:0,torp:0,aim:0,lastFwd:0,lastTurn:0};
p.pos.set(W.x+1.5,0,W.z); p.vel.set(0,0,0); p.swim=false;
const boardHandlers=keyEv('KeyF');
const boarded=p.onNaval===c;
if(!boarded) return {boarded:false,boardHandlers};
// 键盘 W/D 按住 → drive (必须用 keyDown: keyEv 会立刻补 keyup, keys 就没了)
const kH=keyDown('KeyW'); keyDown('KeyD');
for(let i=0;i<10;i++) updatePlayer(1/60);
const midFwd=c.calls.lastFwd, midTurn=c.calls.lastTurn;
keyUp('KeyW'); keyUp('KeyD');
// 鼠标左键 → fireMain; 右键 → fireSecondary/MG
const mh=mouseEv(true,0); updatePlayer(1/60); mouseEv(false,0);
const mh2=mouseEv(true,2); updatePlayer(1/60); mouseEv(false,2);
const out={boarded,boardHandlers,keyHandlers:kH,midFwd,midTurn,mouseHandlers:mh,
main:c.calls.main,sec:c.calls.sec,mg:c.calls.mg,swimAfter:p.onNaval?p.swim:null};
if(p.onNaval) navalSeatRelease();
return out;
}
return {deps,counts,landPt,deepPt,boardTable,driveFire,exitRun,bailRun,hudRelease,mapSym,batteryPop,retire,deployIntoNaval,setAliveCounts,
gateBoardTable,gateSwimDiscipline,gateFire,popLog:()=>pops.slice()};
})();`;

// ── 沙箱启动 ──
function load(ctx,f){ vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f}); }
const ERRS=[];
function boot(campIdx,withStub){
for(const k in byId) delete byId[k];
CUR_HANDLERS={}; sandbox.__HANDLERS=CUR_HANDLERS;   // 每个 boot 换一份处理器表 (挂在共享 sandbox 上 ⇒ VM 里全局可见)
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document; ctx.window=window; ctx.globalThis=ctx;
ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){ return this._s[k]??null; },setItem(k,v){ this._s[k]=String(v); },removeItem(k){ delete this._s[k]; }};
ctx.console={log(){},warn(){},error(...a){ ERRS.push(a.map(String).join(' ')); }};
let loadErr=null;
for(const f of HEAD.concat(TAIL)){
try{ load(ctx,f); }catch(e){ loadErr={file:f,err:String(e&&e.stack||e).split('\n').slice(0,2).join(' | ')}; break; }
}
if(loadErr) return {ctx,loadErr};
try{
if(withStub) vm.runInContext(STUB,ctx,{filename:'<stub:NavalCraft>'});   // 注入桩必须在开局点击之前 (23-deploy 生成编制时读它)
const b=vm.runInContext(`(()=>{ const b=document.getElementById('startBtn'); if(b&&b.onclick){ b.onclick(); return 'ok'; } return 'no-button'; })()`,ctx);
if(b!=='ok') return {ctx,loadErr:{file:'(startBtn)',err:String(b)}};
vm.runInContext(PRELUDE,ctx,{filename:'<prelude>'});
}catch(e){ return {ctx,loadErr:{file:'(stub/start/prelude)',err:String(e&&e.stack||e).split('\n').slice(0,3).join(' | ')}}; }
return {ctx,loadErr:null};
}
function T(ctx,expr){ return vm.runInContext('__T.'+expr,ctx); }

// ── 断言与报告 ──
let PASS=0,FAIL=0;
const say=console.log;
function ok(name,cond,detail){ if(cond){ PASS++; say('  ✓ '+name+(detail?'   '+detail:'')); } else { FAIL++; say('  ✗ '+name+'   '+(detail||'')); } }
say('== task-5 海战玩家链/编制/HUD 自检 (dev/_navalcrew-selfcheck.js) ==');

// ── 主沙箱: 塔拉瓦 + NavalCraft 桩 ──
const B=boot(CAMP_ISLAND,true);
if(B.loadErr){ say('  ✗ 沙箱 LOAD 失败: '+B.loadErr.file+' → '+B.loadErr.err); process.exit(1); }
const D=T(B.ctx,'deps()');
say('  战役=CAMPAIGN.id='+T(B.ctx,'counts().campaign')+'  依赖签名: '+JSON.stringify(D));
ok('① 五个写入域文件的自检入口齐备 (updatePlayerNaval/navalBoard/.../sfNavalMapSymbols)',
D.updatePlayerNaval==='function'&&D.navalBoard==='function'&&D.navalSeatRelease==='function'&&
D.navalCanFootExit==='function'&&D.navalFireTorpedo==='function'&&D.sfNavalMapSymbols==='function'&&
D.navalSeatHud==='function'&&D.navalHudTick==='function'&&D.NavalCraft==='function');

// ④ 编制
const C=T(B.ctx,'counts()');
{
const amph=t=>C.naval.filter(c=>c.team===t&&c.kind==='amph').length;
const boat=t=>C.naval.filter(c=>c.team===t&&c.kind==='boat').length;
const crews=C.naval.filter(c=>c.crew).length;
const keys=C.naval.map(c=>c.key).join(',');
const ords=C.naval.filter(c=>c.team===0).map(c=>c.ord).sort((a,b)=>a-b).join(',');
ok('④ 开局实数: 每队 2 坦克 + 2 两栖车 + 3 艇 / 全图 1 飞机',
(C.tanks[0]||0)===2&&(C.tanks[1]||0)===2&&amph(0)===2&&amph(1)===2&&boat(0)===3&&boat(1)===3&&C.planeN===1,
`坦克 ${C.tanks[0]||0}/${C.tanks[1]||0}  两栖车 ${amph(0)}/${amph(1)}  艇 ${boat(0)}/${boat(1)}  飞机 ${C.planeN}  海战实例 ${C.navalN}  机队 ${JSON.stringify(C.planes)}`);
ok('④b 型别序列与队内序号 (每队 2 车 + 3 艇, ord 0..4 连续)',
keys==='lvt,lvt,pt,pt,pt,kami,kami,gyorai,gyorai,gyorai'&&ords==='0,1,2,3,4',`keys=${keys}  team0.ord=${ords}`);
ok('④c 每台载具 1 名车组 (不实现任何载人机制)',crews===C.navalN,`车组 ${crews}/${C.navalN}`);
const mu=C.muster&&C.muster[0];
const fleet=C.naval.filter(c=>c.team===0);
const onLine=mu?fleet.every(c=>Math.abs(Math.abs(c.x-mu.x)+Math.abs(c.z-mu.z)-(c.ord)*22)<0.6):false;
ok('④d 重生点位 = muster[team] + 队内序号 ×22m 横向错位, 朝向 = face',
onLine&&fleet.every(c=>Math.abs(angDiffJ(c.yaw,(mu&&mu.face)||0))<0.01),
mu?`muster0=(${mu.x},${mu.z},face=${mu.face.toFixed(3)})  队内落点=${fleet.map(c=>'('+c.x+','+c.z+'|'+c.yaw+')').join(' ')}`:'muster 缺失');
function angDiffJ(a,b){ let d=b-a; while(d>Math.PI)d-=2*Math.PI; while(d<-Math.PI)d+=2*Math.PI; return d; }
}

// ① 上艇阈值
{
const R=T(B.ctx,'boardTable()');
say('  判定表 (艇体距: 陆上 4.5m / 水上 2.5m —— 到艇壳侧面, 与 15d navalNear 同口径):');
for(const r of R.rows) say(`     ${r.tag} 艇体距=${r.dist}m(中心距=${r.center}m)  玩家处水深=${r.depth}m  半径=${r.radius}  命中该艇=${r.nearSame}  上艇=${r.boarded}`);
const get=(tag,d)=>R.rows.find(r=>r.tag===tag&&r.dist===d);
const c1=get('陆上',3.0),c2=get('陆上',4.4),c3=get('陆上',4.6),c4=get('水上',2.0),c5=get('水上',2.4),c6=get('水上',2.6);
ok('① 陆上 3.0m / 4.4m 可上, 4.6m 不可上 (阈值 4.5)',c1.boarded&&c2.boarded&&!c3.boarded&&c1.radius===4.5&&c3.radius===4.5);
ok('① 水上 2.0m / 2.4m 可上, 2.6m 不可上 (阈值 2.5, 游泳贴近)',
c4.boarded&&c5.boarded&&!c6.boarded&&c4.radius===2.5&&c5.radius===2.5&&c4.depth>1.35&&c5.depth>1.35);
}

// ①★ 真键位闸门回放 (Lead 裁定: 从真输入入口走, 不直调 API) —— verifier 真浏览器红线 8 抓到的 P0 的回归用例
{
const G=T(B.ctx,'gateBoardTable()');
say('  真 F 键 (合成 keydown → 19-input 闸门 → tryInteract → 座位; 距离=艇体距):');
for(const r of G) say(`     ${r.tag} 艇体距=${r.dist}m(中心距=${r.center}m)  水深=${r.depth}m  链路自算 swim=${r.swimBefore}  处理器=${r.handlers}  上艇=${r.boarded}`);
const get=(tag,d)=>G.find(r=>r.tag===tag&&r.dist===d);
const land3=get('陆上',3.0),land46=get('陆上',4.6),water22=get('水上',2.2),water30=get('水上',3.0);
ok('①★ 陆上 3.0m 按 F 可上 / 4.6m 按 F 不可上 (经真键位闸门)',
land3&&land46&&land3.boarded&&!land46.boarded&&land3.handlers>0,
`3.0m=${land3&&land3.boarded} 4.6m=${land46&&land46.boarded} 处理器数=${land3&&land3.handlers}`);
ok('①★ 水上 2.2m (游泳态) 按 F 可上艇 —— P0 回归用例 / 3.0m 不可上',
water22&&water30&&water22.boarded&&!water30.boarded&&water22.swimBefore===true&&water22.handlers>0,
`2.2m swim=${water22&&water22.swimBefore} 上艇=${water22&&water22.boarded}; 3.0m 上艇=${water30&&water30.boarded}`);
const S=T(B.ctx,'gateSwimDiscipline()');
say(`  游泳态纪律 (经闸门): swim=${S.swim} 处理器=${S.handlersMax} 卧倒封禁=${S.proneBanned} 近战封禁=${S.meleeBanned} 投掷封禁=${S.nadeBanned} 换枪放行=${S.switchOK} 换弹放行=${S.reloadOK} F 上艇=${S.boarded}`);
say(`    诊断: ${JSON.stringify(S.diag)}`);
ok('①★b 游泳态: 只额外放行 F, 1/2/R 照旧放行, 卧倒/近战/投掷/工事继续封禁 (用户 2026-09-18 定案不变)',
S.swim===true&&S.handlersMax>0&&S.proneBanned&&S.meleeBanned&&S.nadeBanned&&S.switchOK&&S.reloadOK,
`swim=${S.swim} 卧倒=${S.before.prone}→${S.after.prone} 近战 VM=${S.before.vm}→${S.after.vm} 手雷=${S.before.nade}→${S.after.nade} 换枪 ${S.before.slot}→${S.after.slotAfter}→${S.after.slotBack} 换弹 VM=${S.after.vmReload}`);
ok('①★c 游泳态按 F 真的上艇 (P0: 修复前此处为 false)',S.boarded===true,`boarded=${S.boarded}`);
const GF=T(B.ctx,'gateFire()');
say(`  真鼠标闸门: 上艇=${GF.boarded} 键盘处理器=${GF.keyHandlers} 鼠标处理器=${GF.mouseHandlers} drive帧输入 fwd=${GF.midFwd} turn=${GF.midTurn} fireMain=${GF.main} fireSecondary=${GF.sec} fireMG=${GF.mg}`);
ok('①★d 上艇后 W/D 与 左右键 经真输入闸门全部生效 (drive / fireMain / fireSecondary)',
GF.boarded&&GF.midFwd===1&&GF.midTurn===1&&GF.main>=1&&(GF.sec>=1||GF.mg>=1),
`boarded=${GF.boarded} fwd=${GF.midFwd} turn=${GF.midTurn} main=${GF.main} sec=${GF.sec} mg=${GF.mg}`);
}

// ② 驾驶/开火
const F=T(B.ctx,'driveFire()');
{
ok('② 上艇成功 (F 交互路径 navalBoard)',F.boarded);
ok('② 驾驶全通: W+D 经真实分派链 updatePlayer → drive(fwd,turn,dt)',F.drive>0&&F.midFwd===1&&F.midTurn===1,
`drive 调用 ${F.drive} 次, 驾驶帧输入 fwd=${F.midFwd} turn=${F.midTurn}`);
ok('② 左键主炮 / 右键机炮 / F 鱼雷 全通',F.main>=1&&F.sec>=1&&(F.torp1-F.torp0)>=1,
`fireMain=${F.main}  fireSecondary=${F.sec}  fireTorpedo=${F.torp1-F.torp0} (side=${F.torpSide})  torpAmmo ${F.torpAmmo}`);
ok('②b 鱼雷节奏闸门: 同冷却内再按 F 不重复发射',F.torp2===F.torp1,`两次 F: ${F.torp1} → ${F.torp2}`);
ok('②c 座位不变量: onNaval=该艇 / onVehicle=null / 手持武器暂存 / 贴座 / 游泳态清 / 默认第三人称 / 炮塔瞄准被调用',
F.inv.onNaval&&F.inv.onVehicleNull&&F.inv.curWNull&&F.inv.glued&&F.inv.swimOff&&F.inv.thirdPerson&&F.inv.aimCalled&&F.stash.curWNull&&F.stash.stashKey===F.wkey,JSON.stringify(F.inv)+' 暂存武器='+F.stash.stashKey+' 下艇交还='+F.curWAfter);
ok('②d 相机两种模式都可算: 追尾 (U 开) 与第一人称艇艏 (U 关)',F.camTP.d>3&&F.camFP.d<6,
`追尾 dist=${F.camTP.d}m y=${F.camTP.y}  第一人称 dist=${F.camFP.d}m y=${F.camFP.y}`);
ok('②e 座驾 HUD: 武器名/鱼雷数/舰体/吃水水深 全部就位',
/F\.|艇|车/.test(F.hud.wname)&&F.hud.resN.indexOf('鱼雷')>=0&&F.hud.panel==='block'&&F.hud.heat.indexOf('%')>0&&F.hud.panelInfo.indexOf('吃水')>=0,
JSON.stringify(F.hud));
ok('②f 开火方向 = 炮口→准星点 (不是相机前向)',!!F.mainDir,JSON.stringify(F.mainDir));
}

// ③ 下艇限速
const E=T(B.ctx,'exitRun()');
{
say(`  下艇跨出: 可步行下船=${E.canFoot}  F 触发跨出=${E.started}  帧数=${E.frames}  单帧最大位移(3D)=${E.maxStep}m  (水平)=${E.maxHoriz}m  实际走开=${E.moved}m`);
ok('③ 搁浅态 F = 下船 (不是鱼雷), 且进入限速跨出阶段',E.canFoot&&E.started);
ok('③ 下艇无 >0.5m 单帧位移 (限速跨出, 无 pos.set 硬瞬移)',E.maxStep<=0.5,`实测单帧最大 ${E.maxStep}m (上限 0.5m)`);
ok('③b 跨出结束即交还座位, 位置就地交给步行态',E.released&&E.onVehicle&&E.curWBack&&!E.exitLeft,
`onNaval=${E.released?'null':'未清'}  onVehicle=null:${E.onVehicle}  curW 已交还:${E.curWBack}  navalExit 残留:${E.exitLeft}`);
}

// ⑤ 弃船
const BL=T(B.ctx,'bailRun()');
{
say(`  弃船: 帧数=${BL.frames}  单帧最大位移=${BL.maxStep}m  落水处水深=${BL.depth}m  浮力位偏差=${BL.floatY}m`);
ok('⑤ 载具沉没 → 玩家从座位落水 (座位交还, 无瞬移)',BL.released&&BL.maxStep<=0.5,`maxStep=${BL.maxStep}m`);
}

// ⑥ HUD 收面板 + 海图符号 + 炮台播报
const HR=T(B.ctx,'hudRelease()');
ok('⑥ 上艇: 弹药面板改显座驾读数 + 舰体面板显示; 下艇: 舰体面板收起, 弹药面板复位',
HR.before.ammo==='block'&&HR.before.panel==='block'&&HR.after.panel==='none'&&HR.after.ammo!=='none',JSON.stringify(HR));
const DN=T(B.ctx,'deployIntoNaval()');
{
if(!DN.ok) ok('⑥c 部署界面选艇出生 (V 项) → 集结点直接进驾驶位',false,JSON.stringify(DN));
else ok('⑥c 部署界面选艇出生 (V 项) → 集结点直接进驾驶位, 车组交还, 与 F 上艇同一份座位初始化',
DN.onNaval&&DN.onVehicleNull&&DN.playerDriven&&DN.glued&&DN.curWNull&&DN.hadCrew&&DN.crewCleared,
JSON.stringify(DN));
T(B.ctx,'hudRelease()');
}
const MS=T(B.ctx,'mapSym()');
ok('⑥ 海面载具地图符号: 每台存活载具画 1 个艏向三角 (与坦克方块区分)',
MS.n===MS.alive&&MS.n>0&&MS.first===MS.expT,`n=${MS.n} alive=${MS.alive} 首个符号落点=${MS.first} 期望=${MS.expT}`);
const BP=T(B.ctx,'batteryPop()');
ok('⑥ 反舰炮台摧毁播报: 存活位 true→false 只播一次',BP.first===0&&BP.afterKill===1&&BP.afterAgain===1,
`首见=${BP.first} 击毁后=${BP.afterKill} 再tick=${BP.afterAgain} 文案="${BP.msg}"`);
const RT=T(B.ctx,'retire()');
ok('⑥ 对局退场: navalCraft 清空 + grp 摘场景 + 车组解绑 + 玩家座位交还',
RT.after===0&&RT.grpDetached&&RT.botUnbound&&RT.onNaval===null&&RT.tanks===0&&RT.planes===0,
JSON.stringify(RT));

// ⑤ 其余 11 图零海战载具 (同链路上注入桩后仍为 0 —— 真在测 SEA/navalN 守卫)
say('');
say('  其余 11 图 (注入同一份 NavalCraft 桩后):');
let otherBad=0, loadBad=0;
for(let i=0;i<12;i++){
if(i===CAMP_ISLAND) continue;
const b=boot(i,true);
if(b.loadErr){ loadBad++; say(`     #${i} ✗ LOAD/开局失败: ${b.loadErr.file} → ${b.loadErr.err}`); continue; }
const c=T(b.ctx,'counts()');
const nv=c.navalN, tk=(c.tanks[0]||0)+'/'+(c.tanks[1]||0), pl=c.planeN;
const good=nv===0;
if(!good) otherBad++;
say(`     #${i} ${good?'✓':'✗'} ${c.campaign}  坦克 ${tk}  飞机 ${pl}  海战载具 ${nv}`);
}
ok('⑤ 其余 11 图 0 海战载具 (SEA=null 守卫生效, 且不影响原有编制)',otherBad===0&&loadBad===0,
`异常图 ${otherBad} / LOAD 失败 ${loadBad}`);

// 源码漂移断言: 22-hud 的地图投影在"包装层"里复刻了一份, 既有函数若改了投影必须同步
{
const src=fs.readFileSync(path.join(root,'js/22-hud.js'),'utf8');
const nRange=(src.match(/90\*Math\.max\(1,Math\.sqrt\(\(CAMPAIGN\.mapSize\|\|320\)\/320\)\)/g)||[]).length;
const nM=(src.match(/const toM=\(x,z\)=>\[S\/2\+x\/MH\*S\/2, S\/2\+z\/MH\*S\/2\];/g)||[]).length;
ok('⑥ 海图投影漂移断言: 小地图/大地图投影在既有函数与包装层各出现一次 (改了必须同步)',
nRange>=2&&nM>=2,`小地图 range 式 ${nRange} 处 / 大地图 toM 式 ${nM} 处 (期望各 ≥2: 既有 + 包装)`);
}

// 集成: 15d/15e/15f 真落盘时, 用真实现跑一遍 (冻结签名核对 + 玩家链端到端冒烟; 只报数, 不进 PASS/FAIL)
{
const onDisk=NAV_FILES.filter(f=>fs.existsSync(path.join(root,f)));
if(!onDisk.length) say('  · 集成(真 15d): 海战文件未落盘, 跳过 (本套件用桩隔离)');
else{
for(const k in byId) delete byId[k];
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document; ctx.window=window; ctx.globalThis=ctx;
ctx.localStorage={_s:{sf_campaign:String(CAMP_ISLAND)},getItem(k){ return this._s[k]??null; },setItem(k,v){ this._s[k]=String(v); },removeItem(k){ delete this._s[k]; }};
ctx.console={log(){},warn(){},error(...a){ ERRS.push('[集成] '+a.map(String).join(' ')); }};
let ierr=null;
for(const f of HEAD.concat(onDisk,TAIL)){
try{ load(ctx,f); }catch(e){ ierr={file:f,err:String(e&&e.stack||e).split('\n').slice(0,2).join(' | ')}; break; }
}
if(ierr) say('  · 集成(真 15d): LOAD 失败 → '+ierr.file+' → '+ierr.err);
else{
try{
vm.runInContext(`(()=>{ const b=document.getElementById('startBtn'); if(b&&b.onclick) b.onclick(); })()`,ctx);
const sig=vm.runInContext(`(()=>{
const c=navalCraft[0]; if(!c) return null;
const fields=['spec','team','ord','kind','name','pos','yaw','vel','hp','maxHp','alive','flood','state','grp','turretYaw','turretPitch','driverBot','playerDriven','torpAmmo'];
const methods=['update','drive','aimDir','muzzle','turretAimAt','turretAimDir','fireMain','fireSecondary','fireMG','fireTorpedo','takeDmg','die','respawn','crewOut'];
const missF=fields.filter(k=>c[k]===undefined);
const missM=methods.filter(k=>typeof c[k]!=='function');
return {navalN:navalCraft.length,tanks:[tanks.filter(t=>t.team===0).length,tanks.filter(t=>t.team===1).length],
planeN:planes.length,keys:navalCraft.map(x=>x.spec&&x.spec.key).join(','),
kinds:navalCraft.map(x=>x.kind).join(','),missFields:missF,missMethods:missM,
torpAmmoType:typeof c.torpAmmo,navalNearType:typeof navalNear,
nearOK:(typeof navalNear==='function')?!!navalNear(c.pos.x,c.pos.z,5,c.team):null,
crew:navalCraft.filter(x=>x.driverBot||x.crewBot).length};
})()`,ctx);
say('  · 集成(真 15d, 只报数): 海战实例 '+(sig?sig.navalN:'?')+' 型别 '+(sig&&sig.keys)+' 坦克 '+(sig&&sig.tanks.join('/'))+' 飞机 '+(sig&&sig.planeN)+' 车组 '+(sig&&sig.crew));
if(sig) say('      冻结签名核对 (§11.3): 缺字段 '+(sig.missFields.length?JSON.stringify(sig.missFields):'无')+' / 缺方法 '+(sig.missMethods.length?JSON.stringify(sig.missMethods):'无')+'  torpAmmo='+sig.torpAmmoType+'  navalNear='+sig.navalNearType+' 可搜到='+sig.nearOK);
const smoke=vm.runInContext(`(()=>{
const p=player;
// 真 15d 里"艇的位移"由 updateNaval(dt) 驱动 (主循环 24-main 第 86 行), drive() 只写输入 ⇒
// 冒烟必须按真实主循环那样每帧调 updateNaval, 否则会误判成"驾驶没用".
const c=navalCraft.find(x=>x.team===p.team&&x.alive&&x.kind==='boat')||navalCraft.find(x=>x.team===p.team&&x.alive)||navalCraft[0];
if(!c) return {ok:false,why:'no-craft'};
function arm(){ const k0=Object.keys(WPN_DEFS)[0]; p.slots=[{key:k0,def:WPN_DEFS[k0],mag:WPN_DEFS[k0].mag,reserve:WPN_DEFS[k0].reserve}]; p.curSlot=0; p.curW=p.slots[0]; return k0; }
arm();
p.alive=true; p.deployed=true;
const W=(function(){ for(let x=-300;x<=300;x+=8) for(let z=-300;z<=300;z+=8){ if(waterDepthAt(x,z)>=3.4) return {x,z}; } return null; })();
if(W){ c.pos.set(W.x,0,W.z); c.yaw=0; c.vel=0; p.pos.set(W.x+1.5,0,W.z); }
c.alive=true; if(c.state==='wreck') c.state='run'; if(c.state==='sinking') c.state='run';
const boarded=!!navalBoard(c,true);
if(!boarded) return {ok:false,why:'board-failed',depth:W?+waterDepthAt(p.pos.x,p.pos.z).toFixed(2):null};
const c0={x:c.pos.x,z:c.pos.z};
keys.KeyW=true; keys.KeyD=true;
for(let i=0;i<20;i++){ updatePlayer(1/60); if(typeof updateNaval==='function') updateNaval(1/60); }
const midFwd=(typeof c.driveInput!=='undefined')?c.driveInput:null;
const moved=+Math.hypot(c.pos.x-c0.x,c.pos.z-c0.z).toFixed(2);
const yawTurned=+(Math.abs(c.yaw)-0).toFixed(3);
keys.KeyW=false; keys.KeyD=false;
mouseDown=true; updatePlayer(1/60); if(typeof updateNaval==='function') updateNaval(1/60); mouseDown=false;
const torpBefore=c.torpAmmo;
let torpOk=null,torpErr=null;
try{ torpOk=navalFireTorpedo(c); }catch(e){ torpErr=String(e&&e.message||e); }
const torpAfter=c.torpAmmo;
c.state='ground';
tryInteract();                                  // 搁浅 ⇒ F = 下船
let maxStep=0,frames=0,prev={x:p.pos.x,y:p.pos.y,z:p.pos.z};
while(p.onNaval&&frames<400){ updatePlayer(1/60); if(typeof updateNaval==='function') updateNaval(1/60); frames++;
const d=Math.hypot(p.pos.x-prev.x,p.pos.y-prev.y,p.pos.z-prev.z); if(d>maxStep) maxStep=d;
prev={x:p.pos.x,y:p.pos.y,z:p.pos.z}; }
return {ok:true,key:c.spec&&c.spec.key,boarded,moved,yaw:+c.yaw.toFixed(3),vel:+c.vel.toFixed(2),
torpBefore,torpAfter,torpOk,torpErr,frames,maxStep:+maxStep.toFixed(4),
released:p.onNaval===null,curWBack:!!p.curW,boatState:c.state};
})()`,ctx);
say('  · 集成冒烟(真 15d, 含 updateNaval): '+JSON.stringify(smoke));
}catch(e){ say('  · 集成(真 15d): 冒烟异常 → '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | ')); }
}
}
}

say('');
say(`合计: ${PASS} 通过 / ${FAIL} 失败`);
if(ERRS.length) say(`沙箱内 console.error ${ERRS.length} 条 (前 3: ${ERRS.slice(0,3).join(' || ')})`);
process.exit(FAIL?1:0);
