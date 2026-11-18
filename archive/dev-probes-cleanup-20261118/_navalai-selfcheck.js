// ─────────────────────────────────────────────────────────────────────────────
// dev/_navalai-selfcheck.js —— task-4 海战 Bot AI 三层自检 (naval-ai 自证, 只读探针)
// 用法: node dev/_navalai-selfcheck.js [--quick]
//   --quick  缩短推演 (艇进近 25s / 两栖 60s / 闪现 20s×3) —— 开发期快跑, 验收不要用
//
// 判据 (共享任务板 task-4 验收证据, 逐项对应):
//   ① 艇 Bot 能在 60s 内完成"从海上集结点到礁盘外"的进近 —— 报轨迹采样与耗时 (每 5s 一行);
//   ② 两栖车 Bot 能上岸并转入陆战交战 (≥1 次开火) —— 报上岸时刻/位置与开火明细;
//   ②b 反舰炮位 batteryAI 海面索敌 + 提前量 + 弹药节奏 (开火走 15f 的 batteryFire);
//   ③ 鱼雷窗口判定的舷角/距离过滤生效 —— 打印 (舷角 × 距离) 判定表与"为什么不开火";
//   ④ 连续 3 局无 >3m 的非重生单帧位移 —— 复用 dev/probe-botflash.js 的逐帧位移口径与分类;
//   ⑤ 载具对象零污染 —— 两栖车陆战复用的 shim 不在 craft 上留 AI 私有字段 (Lead 裁定③)。
//
// 【窗口口径】CSTEP 的 dt 轮转 [1/60,1/30,1/20] (与 probe-spawn/probe-botflash 同一支 STEP_FN 口径),
// 平均 1/30 s/帧 ⇒ 帧数 = 秒数 × 30; 每节都报"实际推演秒数"(由 nowT 差分), 不拿帧数冒充实测时间。
//
// 【15d/15f 替身】15d-naval.js / 15f-battery.js 与本任务并行开发, 本文件按 §11.3/§11.5 冻结契约写了一个
// **替身实现** (STUB 段) 注入沙箱: 载具物理(吃水/浅水/搁浅/浮航)、navalNear/navalCraft、以及 15d 的
// "NavalCraft.update 驱动 boatAI/amphAI" 接线形态 (先决策后积分)、batteryFire 唯一开火入口 (15f 不自行索敌)。
// 因此本自检验证的是**AI 决策层 + 冻结接口契约**; 15d/15f 落盘后同一套 AI 函数无需改动即由它们驱动
// (Lead 已裁定帧戳幂等, 双跑也不会重复决策)。
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const ROOT=path.resolve(__dirname,'..');
const QUICK=process.argv.indexOf('--quick')>=0;
// 只跑指定小节 (开发期迭代用): node dev/_navalai-selfcheck.js --only=1,3
const ONLY=(()=>{ const a=process.argv.find(x=>x.indexOf('--only=')===0); if(!a) return null;
return a.slice(7).split(',').map(s=>s.trim()).filter(Boolean); })();
const want=id=>(!ONLY||ONLY.indexOf(id)>=0);
const CASE=(()=>{ const a=process.argv.find(x=>x.indexOf('--case=')===0); return a?parseInt(a.slice(7)):0; })();
// ── ① 的判据常量 (探针侧口径; NAV_AI_LOOP 会与沙箱里 NAV_AI.looppNeed 实测对账, 不一致即报) ──
const LOOP_DEPART=120;   // "离开出生湾"判据: 离出生点位移阈值 (m) —— 出生湾半径量级 (集结点离岸 78m, 湾口 ~150m)
const DEPART_T=60;       // 限时 (s)
const ENG_CAP=45;        // engage 帧占比上限 (%): 轮换制下理论值 ≈ engBout/(engBout+E[engCd]) ≈ 34%
const ADV_FLOOR=30;      // 隔离档"推进/追击"帧占比下限 (%): 默认相位必须真的是会师推进 (实测 39~48%)
const NAV_AI_LOOP=38;    // 反极限环"20s 窗口净位移下限" (m) = 14-bots NAV_AI.looppNeed

// ── 复用 probe-spawn.js 的沙箱桩与 boot() (只取 REPORT_FN 之前的头部) ──
const headSrc=fs.readFileSync(path.join(__dirname,'probe-spawn.js'),'utf8');
const HEAD=headSrc.slice(0,headSrc.indexOf('const REPORT_FN='));
const host=vm.createContext({require,console,process,__dirname,module:{exports:{}},exports:{}});
vm.runInContext(HEAD,host,{filename:'probe-spawn-head.js'});
const boot=vm.runInContext('boot',host);
const hostMath=vm.runInContext('Math',host);
// 可播种 PRNG (与 probe-botflash/probe-slope 同款): 同种子 = 同一批随机事件, 前后可比
function seedRandom(seed){
let rs=seed>>>0;
hostMath.random=()=>{ rs=(rs+0x6D2B79F5)>>>0; let t=rs; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; };
}
const ISLAND=11;                      // 塔拉瓦环礁 (00-config CAMPAIGNS 第 12 项 = 现役 12 图)
const STEPPE=8;                       // 草原库尔斯克 (无海战载具, 做闪现基线)
const srcFp=f=>{ try{ return crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT,f))).digest('hex').slice(0,8); }catch(e){ return 'n/a'; } };
// 探针侧的最短弧差 (Node 进程里没有沙箱的 angDiff; 语义逐字相同)
const wrapPi=d=>{ while(d>Math.PI)d-=2*Math.PI; while(d<-Math.PI)d+=2*Math.PI; return d; };
const f1=v=>Number(v).toFixed(1);
const line=t=>console.log(t);

// ── 15d/15f 契约替身 (注入沙箱; 无模板插值, 全部纯源码) ──────────────────────
const STUB_SRC=`
const navalCraft=[], torpedoes=[];
const NAVAL_STUB_LOG={main:0,sec:0,mg:0,torp:0,batFire:0,frames:0,hits:0,aiFrames:0,driveCalls:0,aiFifteenF:0,batFire15f:0};
class NavalCraft{
constructor(specKey,team,ord){
const sp=NAVAL_SPEC[specKey];
this.spec=sp; this.team=team; this.ord=ord; this.kind=sp.kind; this.name=sp.name;
this.pos=V3(0,0,0); this.yaw=0; this.vel=0; this.hp=sp.hp; this.maxHp=sp.hp; this.alive=true; this.flood=0;
this.state='run'; this.turretYaw=0; this.turretPitch=0; this.driverBot=null; this.crewBot=null;
this.playerDriven=false; this.torpAmmo=sp.torpedo|0; this.aiDrive=true;
this.mainT=0; this.secT=0; this.torpT=0; this.fwdIn=0; this.turnIn=0; this._dt=1/60;
navalCraft.push(this);
}
// 与 15d 同构的 update: 先让 AI 决策, 再积分 (驱动权在这里, 14-bots 不另起循环)
update(dt){
if(!this.alive) return;
this._dt=dt;
if(!this.playerDriven&&this.aiDrive!==false&&(this.driverBot||this.crewBot)){
NAVAL_STUB_LOG.aiFrames++;                                   // "这一帧是否真调用 boatAI/amphAI" 计数器
if(this.kind==='boat') boatAI(this,dt); else amphAI(this,dt);
}
if(this.mainT>0) this.mainT-=dt;
if(this.secT>0) this.secT-=dt;
if(this.torpT>0) this.torpT-=dt;
const sp=this.spec;
const wade=(sp.wadeDepth||0);
let rate=sp.turn, spdMul=1;
const dep=waterDepthAt(this.pos.x,this.pos.z);
if(this.kind==='amph'&&dep<wade){
// 履带态 (§3.5): 水深 < wadeDepth ⇒ 完全走陆上物理 —— 不吃浮航折扣、也不判"硬搁浅"
// (吃水 0.40 的两栖车在 0~0.4m 冲滩带上必然"坐"在沙面上, 这正是它冲滩的方式; 见 15d §3.5 契约)
this.state='run';
let wantT=this.fwdIn*(this.fwdIn>0?sp.spd:sp.rev);
const accT=3.0*dt;
if(this.vel<wantT) this.vel=Math.min(wantT,this.vel+accT); else this.vel=Math.max(wantT,this.vel-accT);
this.pos.x+=Math.sin(this.yaw)*this.vel*dt;
this.pos.z+=Math.cos(this.yaw)*this.vel*dt;
this.pos.y=heightAt(this.pos.x,this.pos.z);
} else {
if(this.kind==='amph'&&dep>=wade){ spdMul=sp.wadeSpdMul||0.45; rate*=(sp.wadeTurnMul||0.5); }
// ★ 与 15d-naval.js:284 逐字同口径: yaw -= inTurn*turn*dt*(fwd<0?-1:1)
// (turn=+1 = 右转 = yaw 减小。此前本替身写成 yaw += turn*…, 与真 15d 相反 ⇒ 自检假绿; 已按真实现对齐)
this.yaw-=this.turnIn*rate*dt*(this.fwdIn<0?-1:1);
const draft=sp.draft0+this.flood*0.5;
let want=this.fwdIn*(this.fwdIn>0?sp.spd:sp.rev)*spdMul;
if(dep<draft){ this.state='ground'; want*=(this.fwdIn<0?(NAVAL_CFG.groundingRevMul||0.6):0); }
else if(dep<draft+NAVAL_CFG.shallowPad){ this.state='run'; want*=NAVAL_CFG.shallowSpdMul; this.hp-=NAVAL_CFG.shallowScrub*dt; }
else this.state='run';
const acc=2.4*dt;
if(this.vel<want) this.vel=Math.min(want,this.vel+acc); else this.vel=Math.max(want,this.vel-acc);
this.pos.x+=Math.sin(this.yaw)*this.vel*dt;
this.pos.z+=Math.cos(this.yaw)*this.vel*dt;
// 与 15d _integrate 逐字同口径的图幅钳位 (缺了它, 替身里的艇会跑到图外 —— 探针会读到现实中不存在的
// "离岸 271m / 坐标 −460" 这种数, 把规避/收拢行为评估得比真机更悲观)
{ const lim=MAP_SIZE/2+6; this.pos.x=clamp(this.pos.x,-lim,lim); this.pos.z=clamp(this.pos.z,-lim,lim); }
this.pos.y=waterYAt(this.pos.x,this.pos.z)-draft;
}
if(this.hp<=0) this.die(null);
}
drive(fwd,turn,dt){ NAVAL_STUB_LOG.driveCalls++; this.fwdIn=clamp(fwd,-1,1); this.turnIn=clamp(turn,-1,1); }
turretAimAt(x,z){
const want=angDiff(this.yaw,Math.atan2(x-this.pos.x,z-this.pos.z));
this.turretYaw=angleLerpTo(this.turretYaw,want,(this.spec.tRate||2)*(this._dt||1/60));
this.turretPitch=0;
}
turretAimDir(){ const a=this.yaw+(this.turretYaw||0); return V3(Math.sin(a),Math.sin(this.turretPitch||0),Math.cos(a)); }
aimDir(){ return this.turretAimDir(); }
muzzle(nm){ return V3(this.pos.x+Math.sin(this.yaw)*2.2,this.pos.y+1.3,this.pos.z+Math.cos(this.yaw)*2.2); }
fireMain(dir){
if(this.mainT>0||!this.alive) return false;
this.mainT=this.spec.main.rof; NAVAL_STUB_LOG.main++;
const d=(dir?dir.clone():this.aimDir()).normalize();
shells.push({pos:this.muzzle().clone(),vel:d.multiplyScalar(this.spec.main.spd),team:this.team,owner:this.driverBot||this,life:3,kind:'tank',dmgV:this.spec.main.dmg,trail:0});
return true;
}
fireSecondary(dir){
if(this.secT>0||!this.alive||!this.spec.secondary) return false;
this.secT=this.spec.secondary.rof; NAVAL_STUB_LOG.sec++;
const d=(dir?dir.clone():this.aimDir()).normalize();
fireBullet(this.driverBot||this,this.muzzle(),d,MG_BULLET_DEF,this.muzzle());
return true;
}
fireMG(dir){
if(this.secT>0||!this.alive) return false;
this.secT=0.1; NAVAL_STUB_LOG.mg++;
const d=(dir?dir.clone():this.aimDir()).normalize();
fireBullet(this.driverBot||this,this.muzzle(),d,MG_BULLET_DEF,this.muzzle());
return true;
}
fireTorpedo(side,aimDir){
if(this.torpT>0||!this.alive||this.torpAmmo<=0) return false;
this.torpT=1.2; this.torpAmmo--; NAVAL_STUB_LOG.torp++;
const d=(aimDir?aimDir.clone():V3(Math.sin(this.yaw),0,Math.cos(this.yaw))).normalize();
torpedoes.push({pos:this.muzzle().clone(),vel:d.multiplyScalar(this.spec.torpSpd),team:this.team,life:this.spec.torpRange/this.spec.torpSpd,owner:this.driverBot||this,dmg:this.spec.torpDmg});
return true;
}
takeDmg(amt,attacker,ap){
if(!this.alive) return;
this.hp-=amt; this.flood+=amt*this.spec.floodK;
if(this.flood>1||this.hp<=0) this.die(attacker);
}
die(attacker){ if(!this.alive) return; this.alive=false; this.state='wreck'; this.crewOut(); }
crewOut(){
const b=this.crewBot;
this.crewBot=null; this.driverBot=null;
if(b){ if(b.onVehicle===this) b.onVehicle=null; b.pos.copy(this.pos); b.mesh.root.visible=true; }
}
respawn(x,z,yaw){
this.alive=true; this.state='run'; this.hp=this.maxHp; this.flood=0;
this.pos.set(x,0,z); this.pos.y=waterYAt(x,z)-this.spec.draft0;
this.yaw=yaw||0; this.vel=0; this.fwdIn=0; this.turnIn=0;
}
}
function navalNear(x,z,r,team){
let best=null,bd=r;
for(const c of navalCraft){
if(!c||!c.alive||c.state==='sinking'||c.state==='wreck') continue;
if(team!==undefined&&c.team!==team) continue;
const d=Math.hypot(c.pos.x-x,c.pos.z-z);
if(d<bd){ bd=d; best=c; }
}
return best;
}
function navalCount(team,kind){ return navalCraft.filter(c=>c.alive&&(team===undefined||c.team===team)&&(kind===undefined||c.kind===kind)).length; }
function navalHitCyl(n){ const r=(n.kind==='boat')?3.2:(n.spec.hullW*0.5+0.4); return {x:n.pos.x,z:n.pos.z,r:r,y0:n.pos.y-1,y1:n.pos.y+2.2}; }
function shellHitNaval(s){ return false; }
function torpedoHitTest(p,team,dmg){ return false; }
function updateNaval(dt){
NAVAL_STUB_LOG.frames++;
for(const c of navalCraft) if(c.alive) c.update(dt);
for(let i=torpedoes.length-1;i>=0;i--){
const t=torpedoes[i];
t.life-=dt;
if(t.life<=0){ torpedoes.splice(i,1); continue; }
t.pos.x+=t.vel.x*dt; t.pos.z+=t.vel.z*dt;
t.pos.y=waterYAt(t.pos.x,t.pos.z)-0.3;
let hit=null;
for(const c of navalCraft){
if(!c.alive||c.team===t.team) continue;
const cyl=navalHitCyl(c);
if(Math.hypot(c.pos.x-t.pos.x,c.pos.z-t.pos.z)<cyl.r+1.2){ hit=c; break; }
}
if(hit){ NAVAL_STUB_LOG.hits++; hit.takeDmg(t.dmg,t.owner,true); torpedoes.splice(i,1); continue; }
if(waterDepthAt(t.pos.x,t.pos.z)<0.35){ torpedoes.splice(i,1); continue; }
}
}
// ── 15f 替身: Battery 只做状态/朝向承载, 索敌开火专责 batteryAI (Lead 冻结) ──
const BATTERIES=[];
class Battery{
constructor(cfg,x,z,face){
this.key=cfg.key; this.x=x; this.z=z; this.y=heightAt(x,z); this.face=face;
this.hp=600; this.maxHp=600; this.alive=true; this.cd=rand(3,6); this.user=null; this.team=1;
this.grp=new THREE.Group(); this.yaw=new THREE.Group(); this.pitch=new THREE.Group(); this.grp.add(this.yaw); this.yaw.add(this.pitch);
BATTERIES.push(this);
}
update(dt){}
takeDmg(a){ if(!this.alive) return; this.hp-=a; if(this.hp<=0) this.die(); }
die(){ this.alive=false; }
}
function buildBatteries(){
if(!SEA||!SEA.batteries) return;
for(const cfg of SEA.batteries){
const ax=cfg.anchor[0], az=cfg.anchor[1];
const l=Math.hypot(ax,az)||1, ix=-ax/l, iz=-az/l;
let x=ax+ix*(cfg.inshore||16), z=az+iz*(cfg.inshore||16);
if(typeof findClearSpot==='function'){ const sp=findClearSpot(x,z,6,2.0); if(sp){ x=sp[0]; z=sp[1]; } }
new Battery(cfg,x,z,Math.atan2(-ix,-iz));
}
}
function batteryNear(x,z,r){
let best=null,bd=r;
for(const b of BATTERIES){ if(!b.alive) continue; const d=Math.hypot(b.x-x,b.z-z); if(d<bd){ bd=d; best=b; } }
return best;
}
function batteryFire(b,dir,owner){
if(!b||!b.alive) return false;
NAVAL_STUB_LOG.batFire++;
const o=V3(b.x,b.y+1.5,b.z).addScaledVector(dir,2.7);
shells.push({pos:o.clone(),vel:dir.clone().normalize().multiplyScalar(SHELL_SPD_NAVAL),team:(b.team!==undefined?b.team:1),owner:owner||b,life:3,kind:'tank',dmgV:320,trail:0});
return true;
}
// 15f 契约替身 (2026-09-21A A#9 版): 岸炮 AI 整支归 15f (15f-battery.js:620 batteryAI), 且**无人不开炮**
// (g.manned = user||crewBot)。14-bots 自 A#9 起**不再声明 batteryAI、也不再驱动岸炮** —— 本替身用来核对
// "本文件不重复驱动" + "15f 侧仍能驱动" 两件事, 并断言 14-bots 里没有同名全局残留。
function batteryAI15f(b,dt){
NAVAL_STUB_LOG.aiFifteenF++;
if(!b||!b.alive) return;
if(!(b.user||b.crewBot)) return;                     // A#9: 无人不开炮
if(typeof navalCraft==='undefined'||!navalCraft.length) return;
let tgt=null,bd=1e9;
for(const c of navalCraft){
if(!c||!c.alive||c.team===b.team) continue;
const d=Math.hypot(c.pos.x-b.x,c.pos.z-b.z);
if(d<bd){ bd=d; tgt=c; }
}
if(!tgt) return;
const dir=V3(tgt.pos.x-b.x,0,tgt.pos.z-b.z).normalize();
NAVAL_STUB_LOG.batFire15f++;
if(typeof batteryFire==='function') batteryFire(b,dir,b.crewBot||b.user);
}
function updateBatteries(dt){ for(const b of BATTERIES){ if(b) batteryAI15f(b,dt); } }
`;
// ── 探针辅助 (只读; 替身模式与"真 15d"模式共用 —— §⑨ 载真文件时同样要用它们) ──
const PROBE_SRC=`
function __navSnap(){
return navalCraft.map(c=>{
const ai=navalAIDebug(c)||{};
return {key:c.spec.key,team:c.team,ord:c.ord,alive:c.alive,state:c.state,
x:+c.pos.x.toFixed(1),y:+c.pos.y.toFixed(2),z:+c.pos.z.toFixed(1),vel:+c.vel.toFixed(2),
yaw:+c.yaw.toFixed(2),fwd:+(c.fwdIn||0).toFixed(2),torp:c.torpAmmo,hp:+c.hp.toFixed(0),
dep:+waterDepthAt(c.pos.x,c.pos.z).toFixed(2),sd:+shoreDist(c.pos.x,c.pos.z).toFixed(1),
mode:ai.mode||'',tgt:ai.tgt?(ai.tgt.kind||'craft'):''};
});
}
function __spawnNaval(specKey,team,ord,cls){
const sp=NAVAL_SPEC[specKey];
const mu=(SEA&&SEA.muster&&SEA.muster[team])||{x:0,z:(team?-250:250),face:(team?0:Math.PI)};
const c=new NavalCraft(specKey,team,ord);
const lat=(ord%2?1:-1)*ord*22;
c.pos.set(mu.x+Math.cos(mu.face)*lat,0,mu.z-Math.sin(mu.face)*lat);
c.pos.y=waterYAt(c.pos.x,c.pos.z)-sp.draft0;
c.yaw=mu.face;
const b=new Bot(team,(cls===undefined?1:cls),'海战'+sp.key+'_'+team+'_'+ord);
b.spawnInVehicle(c);
c.driverBot=b;
return {n:navalCraft.length-1,bot:soldiers.length-1};
}
function __craftKeys(){
const out=[];
for(const c of navalCraft) out.push(Object.keys(c).sort().join(','));
return out;
}
function __stubLog(){ return Object.assign({},(typeof NAVAL_STUB_LOG!=='undefined')?NAVAL_STUB_LOG:{}); }
function __lanes(){ return (SEA&&SEA.lanes)||[]; }
function __now(){ return nowT; }
function __batSnap(){
return BATTERIES.map(b=>({key:b.key,alive:b.alive,cd:+b.cd.toFixed(2),
yaw:+((b.face||0)+((b.yaw&&b.yaw.rotation)?b.yaw.rotation.y:0)).toFixed(3),
pitch:+((b.pitch&&b.pitch.rotation)?b.pitch.rotation.x:0).toFixed(3)}));
}
function __botSnap(i){
const b=soldiers[i];
if(!b) return null;
return {alive:b.alive,swim:!!b.swim,wading:!!b.wading,onV:!!b.onVehicle,
x:+b.pos.x.toFixed(1),z:+b.pos.z.toFixed(1),y:+b.pos.y.toFixed(2),
dep:+waterDepthAt(b.pos.x,b.pos.z).toFixed(2),sd:+shoreDist(b.pos.x,b.pos.z).toFixed(1)};
}
// ── ⑦ 对齐复算夹具 (逐字复刻 dev/verify-naval.js 的 aiTrial 口径) ──
function __quietBatteries(){ let n=0; for(const b of BATTERIES){ b.alive=false; n++; } return n; }
function __spawnAt(specKey,team,x,z,yaw,cls){
const c=new NavalCraft(specKey,team,0);
c.pos.set(x,0,z); c.pos.y=waterYAt(x,z)-c.spec.draft0; c.yaw=yaw; c.vel=0;
c.driverBot=null; c.crewBot=null; c.aiDrive=true; c.playerDriven=false;
const b=new Bot(team,(cls===undefined?0:cls),'对齐探针'+specKey);
b.spawnInVehicle(c); b.alive=true; b.hp=100; b.pos.set(c.pos.x,c.pos.y||0,c.pos.z);
if(!c.driverBot) c.driverBot=b;
return {n:navalCraft.length-1,bot:soldiers.length-1};
}
function __spawnNoAI(specKey,team,x,z,yaw){          // "无 AI"对照: 不挂车组 ⇒ 没有人调 drive
const c=new NavalCraft(specKey,team,0);
c.pos.set(x,0,z); c.pos.y=waterYAt(x,z)-c.spec.draft0; c.yaw=yaw; c.vel=0;
c.driverBot=null; c.crewBot=null;
return navalCraft.length-1;
}
// verifier 的 step 口径: 只推载具/炮弹, 不跑步兵 AI, 岸炮静默
function __stepQuiet(frames,collect,dtFixed){
for(let f=0;f<frames;f++){
const dt=dtFixed||1/60;
nowT+=dt;
if(typeof updateNaval==='function') updateNaval(dt);
updateShells(dt);
if(collect) collect(f);
}
}
function __craftCore(i){
const c=navalCraft[i]; if(!c) return null;
return {alive:c.alive,state:c.state,hp:+c.hp.toFixed(0),x:+c.pos.x.toFixed(1),z:+c.pos.z.toFixed(1),
vel:+c.vel.toFixed(2),fwd:+(c.fwdIn||0).toFixed(2),turn:+(c.turnIn||0).toFixed(2),
sd:+shoreDist(c.pos.x,c.pos.z).toFixed(1),dep:+waterDepthAt(c.pos.x,c.pos.z).toFixed(2)};
}
function __modeOf(i){ const ai=navalAIDebug(navalCraft[i]); return ai?ai.mode:null; }
function __laneOf(i){ const ai=navalAIDebug(navalCraft[i]); return (ai&&ai.lane)?ai.lane.bay:null; }
function __approachOf(i){ const ai=navalAIDebug(navalCraft[i]); return (ai&&ai.approach)?{x:+ai.approach.x.toFixed(1),z:+ai.approach.z.toFixed(1)}:null; }
`;

// ── 主循环替身 (与 24-main 同序, 并接上 updateNaval/updateBatteries) ──────────
const CSTEP_SRC=`
(()=>{
const DTS=[1/60,1/30,1/20];
return function step(frames,collect){
for(let f=0;f<frames;f++){
const dt=DTS[f%3];
nowT+=dt;
gunEvents=gunEvents.filter(e=>nowT-e.t<0.6);
NAV.budget=2;
updateNavDirty(dt);
updateSmokes(dt);
for(const s of soldiers){
s.tickAcc+=dt; s.tickSkip--;
if(!s.alive||s.onVehicle||s.tickSkip<=0){
const useDt=Math.min(s.tickAcc,0.15);
s.update(useDt);
s.tickAcc=0;
const d2p=s.pos.distanceTo(camera.position);
s.tickSkip=d2p>110?3:d2p>60?2:1;
}
}
for(const t of tanks) t.update(dt);
if(typeof updateNaval==='function') updateNaval(dt);
if(typeof updateBatteries==='function') updateBatteries(dt);
updateShells(dt); updateNades(dt); updateFlags(dt);
if(collect) collect(dt);
}
};
})()`;

// ── 建局: boot → 开局 → 注入替身 → 造炮位 ────────────────────────────────────
// opts.real15 = true: **不注入替身**, 改把真实的 js/15e-navmodels.js + js/15d-naval.js 载入同一沙箱 ——
//   用来验收"真炮塔 360° 回转 + 炮口取 muzzles.main" 这条只在真实现里存在的路径 (§⑨)。
//   probe-spawn 的文件表本来不含 15d/15e/15f (海战批三个文件是后加的), 这里就地补载; 顺序 15e→15d 与
//   index.html:335-336 一致 (15d 构造器调用 15e 的 navBuildModel, 倒序会在 TDZ 里抛错)。
function makeGame(ci,seed,opts){
seedRandom(seed);
const o=opts||{};
const game=boot(ci);
const startR=vm.runInContext("(()=>{try{const b=document.getElementById('startBtn'); if(b&&b.onclick){b.onclick(); return 'ok';} return 'no-btn';}catch(e){return 'ERR '+e;}})()",game);
if(startR!=='ok') throw new Error('开局失败: '+startR);
if(o.real15){
vm.runInContext(fs.readFileSync(path.join(ROOT,'js','15e-navmodels.js'),'utf8'),game,{filename:'js/15e-navmodels.js'});
vm.runInContext(fs.readFileSync(path.join(ROOT,'js','15d-naval.js'),'utf8'),game,{filename:'js/15d-naval.js'});
// 15f 只为了给 updateBatteries/buildBatteries 提供真身 (本节不测岸炮); 载入失败不影响 ⑨ 的结论
try{ vm.runInContext(fs.readFileSync(path.join(ROOT,'js','15f-battery.js'),'utf8'),game,{filename:'js/15f-battery.js'}); }catch(e){ line('  [注] 真 15f 未载入 ('+(e&&e.message)+') —— 本节不依赖它'); }
}else{
// 替身恒注入 (不造载具时就是"无海战"基线; 15d/15f 未落盘, 探针自己提供冻结契约 API)
vm.runInContext(STUB_SRC,game,{filename:'15d-15f-stub.js'});
}
vm.runInContext('if(typeof buildBatteries==="function") buildBatteries();',game);
vm.runInContext(PROBE_SRC,game,{filename:'nav-probe-helpers.js'});
const step=vm.runInContext(CSTEP_SRC,game,{filename:'cstep.js'});
return {
game,step,
campaign:vm.runInContext('({id:CAMPAIGN.id,mode:GAMEMODE,bots:soldiers.length})',game),
snap:vm.runInContext('__navSnap',game),
spawnNaval:(k,t,o,c)=>vm.runInContext('__spawnNaval',game)(k,t,o,c),
keys:vm.runInContext('__craftKeys',game),
log:vm.runInContext('__stubLog',game),
lanes:vm.runInContext('__lanes',game),
nowT:vm.runInContext('__now',game),
dbg:vm.runInContext('navalAIDebug',game),
crafts:vm.runInContext('navalCraft',game),
bats:vm.runInContext('BATTERIES',game),
batSnap:vm.runInContext('__batSnap',game),
soldiers:vm.runInContext('soldiers',game),
camera:vm.runInContext('camera',game),
};
}

// ═══════════════ ③ 鱼雷窗口过滤表 (纯判定, 不依赖载具) ═══════════════
function torpTable(){
line('');
line('════ ③ 鱼雷窗口判定过滤表 (舷角 × 距离; torpSpd=26 m/s, torpRange=900m, 目标 10 m/s 沿视线外逃) ════');
const g=makeGame(ISLAND,4242);
const tbl=vm.runInContext(`(()=>{
const rows=[];
const sh={pos:V3(0,0,0),yaw:0,vel:14.5,spec:{torpSpd:26,torpRange:900}};
for(const brgDeg of [0,15,30,45,60,75,90,105,120,150,180]){
for(const dist of [60,120,200,300,450,600,700]){
const brg=brgDeg*Math.PI/180;
const t={pos:V3(Math.sin(brg)*dist,0,Math.cos(brg)*dist),yaw:brg,vel:10};
const w=navTorpWindow(sh,t);
rows.push({brg:brgDeg,dist:dist,aspect:+(w.aspect*180/Math.PI).toFixed(1),tof:+w.tof.toFixed(2),side:w.side,ok:w.ok,why:w.why});
}
}
return rows;
})()`,g.game);
const brgs=[...new Set(tbl.map(r=>r.brg))];
for(const b of brgs){
const cells=tbl.filter(x=>x.brg===b).map(r=>String(r.dist).padStart(4)+'m:'+(r.ok?'★发射':('✗'+r.why)));
line('  舷角 '+String(b).padStart(3)+'° | '+cells.join('  '));
}
const okN=tbl.filter(r=>r.ok).length;
line('  ── 合计 '+tbl.length+' 组: 可发射 '+okN+' 组 ('+(okN/tbl.length*100).toFixed(1)+'%)');
line('  ── side 编码核对 (冻结口径 0=左舷/1=右舷): '+tbl.filter(r=>r.ok).map(r=>r.brg+'°→side'+r.side).join(' '));
const aspectIn=r=>r.aspect>=30&&r.aspect<=90;
const distIn=r=>r.dist>=120&&r.dist<=600;
const inBand=tbl.filter(r=>aspectIn(r)&&distIn(r));
const badAspect=tbl.filter(r=>!aspectIn(r)&&r.ok);
const badDist=tbl.filter(r=>aspectIn(r)&&!distIn(r)&&r.ok);
line('  ── 舷角带外组合 '+tbl.filter(r=>!aspectIn(r)).length+' 组, 其中误发射 '+badAspect.length+' 组 (期望 0)');
line('  ── 距离带外组合 (舷角带内) '+tbl.filter(r=>aspectIn(r)&&!distIn(r)).length+' 组, 其中误发射 '+badDist.length+' 组 (期望 0)');
line('  ── 带内 (舷角∈[30,90] 且 距离∈[120,600]) '+inBand.length+' 组: 可发射 '+inBand.filter(r=>r.ok).length+
' 组; 未发射原因 = '+[...new Set(inBand.filter(r=>!r.ok).map(r=>r.why))].join(' / ')+' (提前量/射程解算不成立, 属合法拒绝)');
const why={};
for(const r of tbl) why[r.why]=(why[r.why]||0)+1;
line('  ── 过滤原因分布: '+Object.entries(why).sort((a,b)=>b[1]-a[1]).map(x=>x[0]+'×'+x[1]).join('  '));
line('  ── 边界 8 例 (29/30/90/91° 与 119/120/600/601m; 静止目标 → 只验舷角/距离两条边界):');
const edge=[[29,300,false],[30,300,true],[90,300,true],[91,300,false],[60,119,false],[60,120,true],[60,600,true],[60,601,false]];
const edgeRows=vm.runInContext(`(()=>{
const sh={pos:V3(0,0,0),yaw:0,vel:14.5,spec:{torpSpd:26,torpRange:900}};
const out=[];
const cases=[[29,300],[30,300],[90,300],[91,300],[60,119],[60,120],[60,600],[60,601]];
for(const cs of cases){
const brg=cs[0]*Math.PI/180;
const w=navTorpWindow(sh,{pos:V3(Math.sin(brg)*cs[1],0,Math.cos(brg)*cs[1]),yaw:brg,vel:0});
out.push({brg:cs[0],dist:cs[1],ok:w.ok,why:w.why});
}
return out;
})()`,g.game);
let pass=0;
for(let i=0;i<edgeRows.length;i++){
const r=edgeRows[i], want=edge[i][2];
const good=(r.ok===want);
if(good) pass++;
line('     '+String(r.brg).padStart(3)+'° / '+String(r.dist).padStart(3)+'m  → '+(r.ok?'发射':'拒绝')+'  ('+r.why+')  期望='+(want?'发射':'拒绝')+'  '+(good?'✓':'✗'));
}
line('  ⇒ 边界通过 '+pass+'/'+edgeRows.length);
const rc=(pass===edgeRows.length&&badAspect.length===0&&badDist.length===0&&inBand.some(r=>r.ok));
line('③ 结果: '+(rc?'PASS':'FAIL'));
return {pass:rc,total:tbl.length,okN,bandIn:inBand.length,bandInOK:inBand.filter(r=>r.ok).length,
outAspectBad:badAspect.length,outDistBad:badDist.length,edgePass:pass,edgeN:edgeRows.length};
}

// ═══════════════ ① 艇 Bot 进近 ═══════════════
function boatApproach(){
line('');
line('════ ① 艇 AI 全盘优化: 离开出生湾 + 跨图会师推进 + 敌艇相遇 + 无原地极限环 ════');
line('  判据 (任务板 task-2 验收 1/2): ① 离出生点位移 > '+LOOP_DEPART+'m (限 '+DEPART_T+'s 内);');
line('  ② 向敌方海域推进 (到敌方集结点方位圈的角距单调下降) + 双方艇最短距离收敛 (首次 <340m);');
line('  ③ engage 帧占比 ≤ '+ENG_CAP+'% (隔离档, 关岸炮); ④ 隔离档"推进/追击"帧占比 ≥ '+ADV_FLOOR+'% (默认相位=会师推进);');
line('  ⑤ 无原地极限环: 任一 20s 窗口内净位移 ≥ '+NAV_AI_LOOP+'m (反极限环看门狗阈值 + 余量)。');
const SECS=QUICK?40:120;
const res=[];
// 用例: [说明, 我方(team0)艇, 敌方(team1)艇] —— 同局双艇推演 (验收 2 要求"双侧艇同时推演")
const cases=[
['美军 PT vs 日军 九三式', 'pt', 'gyorai'],
['美军 九三式 vs 日军 PT', 'gyorai', 'pt']]
.filter((c,i)=>!CASE||CASE===i+1);
for(const [name,keyA,keyB] of cases){
const g=makeGame(ISLAND,7777+(keyA==='pt'?0:13));
// 判据常量对账: 探针侧 NAV_AI_LOOP 必须等于沙箱里 14-bots 的 NAV_AI.looppNeed (口径漂移立刻可见)
const aiLoop=vm.runInContext('NAV_AI.looppNeed',g.game);
const aiBout=vm.runInContext('NAV_AI.engBout',g.game);
const aiCd=vm.runInContext('NAV_AI.engCd',g.game);
line('     [对账] 沙箱 NAV_AI: looppNeed='+aiLoop+' (探针 '+NAV_AI_LOOP+') engBout='+aiBout+' engCd=['+aiCd+'] 理论 engage 占比 ≈ '+
(aiBout/(aiBout+(aiCd[0]+aiCd[1])/2)*100).toFixed(0)+'%'+(aiLoop===NAV_AI_LOOP?'  ✓':'  ✗ 口径不一致'));
const spA=g.spawnNaval(keyA,0,0,1);
const spB=g.spawnNaval(keyB,1,0,1);
const cA=g.crafts[spA.n], cB=g.crafts[spB.n];
const startA={x:cA.pos.x,z:cA.pos.z}, startB={x:cB.pos.x,z:cB.pos.z};
const d0=Math.hypot(startA.x-startB.x,startA.z-startB.z);
let aiA=null,aiB=null;
const t0=g.nowT();
let tDepart=-1, tMeet=-1, minD=1e9, maxDispA=0, grounded=0, minSd=1e9, loopBad=0, loopWorst=0;
const modes={A:{},B:{}};
let samples=[], lastSamp=-99;
// 角距 (到敌方集结点方位): 推进判据 —— 用"艇方位 → 敌方位"的角距, 与 navEnemyBearing 同源
// ★ muster 表从沙箱里读出来 (Node 侧没有 SEA); 这就是"不写死坐标"的探针侧表达 —— 表改了探针跟着变。
const MUSTER=vm.runInContext('(SEA&&SEA.muster)||null',g.game);
const angGap=(x,z,team)=>{ const em=MUSTER&&MUSTER[1-team]; if(!em) return null;
return Math.abs(wrapPi(Math.atan2(em.x,em.z)-Math.atan2(x,z))); };
let gap0=null, gapEnd=null;
// 反极限环看门狗复算: 每帧记录 (t,x,z), 事后按 20s 窗口求净位移 (独立于 AI 内部 trk, 属外部复算)
const hist=[];
g.step(Math.round(SECS*30),()=>{
if(!aiA) aiA=g.dbg(cA);
if(!aiB) aiB=g.dbg(cB);
const sA=g.snap()[spA.n], sB=g.snap()[spB.n];
if(!sA||!sB||!aiA||!aiB) return;
const t=g.nowT()-t0;
const d=Math.hypot(sA.x-sB.x,sA.z-sB.z);
if(d<minD) minD=d;
if(tMeet<0&&d<340) tMeet=t;
const dispA=Math.hypot(sA.x-startA.x,sA.z-startA.z);
if(dispA>maxDispA) maxDispA=dispA;
if(tDepart<0&&dispA>LOOP_DEPART) tDepart=t;
if(sA.state==='ground'||sB.state==='ground') grounded++;
if(sA.sd<minSd) minSd=sA.sd;
if(sB.sd<minSd) minSd=sB.sd;
modes.A[sA.mode]=(modes.A[sA.mode]||0)+1;
modes.B[sB.mode]=(modes.B[sB.mode]||0)+1;
const g0=angGap(sA.x,sA.z,0);
if(g0!==null){ if(gap0===null) gap0=g0; gapEnd=g0; }
hist.push({t,x:sA.x,z:sA.z});
if(t-lastSamp>=5){ lastSamp=t; samples.push({t:+t.toFixed(1),ax:+sA.x.toFixed(0),az:+sA.z.toFixed(0),bx:+sB.x.toFixed(0),bz:+sB.z.toFixed(0),
d:+d.toFixed(0),sdA:+sA.sd.toFixed(0),depA:+sA.dep.toFixed(1),mA:sA.mode,mB:sB.mode,dispA:+dispA.toFixed(0)}); }
});
// 外部复算"20s 窗口净位移" (不看 AI 内部状态): 任一窗口 < NAV_AI_LOOP 即判定原地打转
for(let i=0;i<hist.length;i++){
let mx=0;
for(let j=i;j<hist.length&&hist[j].t-hist[i].t<=20;j++){
const dd=Math.hypot(hist[j].x-hist[i].x,hist[j].z-hist[i].z); if(dd>mx) mx=dd;
}
if(hist[i].t+20>hist[hist.length-1].t) break;                  // 尾部不足 20s 的窗口不计
if(mx<NAV_AI_LOOP){ loopBad++; if(loopWorst<mx) loopWorst=mx; }
}
const simT=+(g.nowT()-t0).toFixed(1);
const nA=Object.values(modes.A).reduce((a,b)=>a+b,0), nB=Object.values(modes.B).reduce((a,b)=>a+b,0);
const engA=(modes.A.engage||0)/Math.max(1,nA), advA=((modes.A.advance||0)+(modes.A.patrol||0))/Math.max(1,nA);
const engB=(modes.B.engage||0)/Math.max(1,nB), advB=((modes.B.advance||0)+(modes.B.patrol||0))/Math.max(1,nB);
line('  ── '+name+'  (种子 '+7777+', 实际推演 '+simT+'s, 同局双艇)');
line('     ★离湾: 我方离出生点位移 '+maxDispA.toFixed(0)+'m'+(tDepart>=0?('  t='+tDepart.toFixed(1)+'s ✓(≤'+DEPART_T+'s)'):'  ✗ 全程未超过 '+LOOP_DEPART+'m')+
'   峰值离岸外最小离岸='+(minSd>1e8?'n/a':minSd.toFixed(1)+'m')+'  搁浅帧='+grounded);
line('     ★相遇: 起始间距 '+d0.toFixed(1)+'m → 最短 '+minD.toFixed(1)+'m'+
(tMeet>=0?('   首次 <340m: t='+tMeet.toFixed(1)+'s ✓'):'   ✗ 全程未进入 340m'));
line('     ★推进: 到敌方集结点方位角距 '+f1(gap0*180/Math.PI)+'° → '+f1(gapEnd*180/Math.PI)+'°'+
((gapEnd!==null&&gap0!==null&&gapEnd<gap0)?' (下降=在向敌方海域推进 ✓)':' (未下降)'));
line('     ★相位占比: 我方 engage='+(engA*100).toFixed(0)+'% advance/patrol='+(advA*100).toFixed(0)+'%  '+
JSON.stringify(modes.A)+'   敌方 engage='+(engB*100).toFixed(0)+'% advance='+(advB*100).toFixed(0)+'%');
line('     ★极限环复算 (外部, 不看 AI 内部状态): 不足 20s 净位移的窗口 = '+loopBad+' 个 (期望 0; 最差 '+(loopBad?loopWorst.toFixed(0)+'m':'—')+')');
for(const sm of samples.slice(0,18)) line('       t='+String(sm.t).padStart(5)+'s  A('+String(sm.ax).padStart(5)+','+String(sm.az).padStart(5)+') sd='+String(sm.sdA).padStart(4)+' 深'+String(sm.depA).padStart(5)+
'  B('+String(sm.bx).padStart(5)+','+String(sm.bz).padStart(5)+')  间距='+String(sm.d).padStart(4)+'m  位移='+String(sm.dispA).padStart(4)+'m  '+sm.mA+'/'+sm.mB);
if(samples.length>18) line('       … 共 '+samples.length+' 个采样');
const ok=(tDepart>=0&&tDepart<=DEPART_T&&tMeet>=0&&loopBad===0&&grounded===0&&gapEnd<gap0);
res.push({name,tDepart,tMeet,minD,maxDispA,engA,advA,loopBad,grounded,gap0,gapEnd,ok,simT});
}
// ── 隔离档 (关掉 4 门岸炮): 相位占比必须在"没有岸炮干扰"的条件下量 ──
// 为什么分开量: 实战档里 4 门岸炮全程压制, evade 会占掉一半帧 (那是设计内的弹着规避, 不是状态机失控);
// 拿实战档判"engage 占比"会把"躲炮弹"误算成"没轮换"。这与 ⑦ 夹具的 setQuiet 同一纪律。
const resQ=[];
for(const [name,keyA,keyB] of cases){
const g=makeGame(ISLAND,7777+(keyA==='pt'?0:13));
vm.runInContext('__quietBatteries();',g.game);
const spA=g.spawnNaval(keyA,0,0,1);
const spB=g.spawnNaval(keyB,1,0,1);
const modes={A:{},B:{}};
const t0=g.nowT();
g.step(Math.round(60*30),()=>{
const sA=g.snap()[spA.n], sB=g.snap()[spB.n];
if(!sA||!sB) return;
modes.A[sA.mode]=(modes.A[sA.mode]||0)+1;
modes.B[sB.mode]=(modes.B[sB.mode]||0)+1;
});
const nA=Object.values(modes.A).reduce((a,b)=>a+b,0), nB=Object.values(modes.B).reduce((a,b)=>a+b,0);
const engA=(modes.A.engage||0)/Math.max(1,nA), advA=((modes.A.advance||0)+(modes.A.patrol||0)+(modes.A.hunt||0))/Math.max(1,nA);
const engB=(modes.B.engage||0)/Math.max(1,nB);
// 隔离档判据: ① engage ≤ ENG_CAP (轮换制的硬上限; 理论值 ≈34%); ② 推进/追击 ≥ ADV_FLOOR (默认相位真的是会师);
//   ③ 两侧都真的打过岸轰 (engA+engB>0 ⇒ 不是"谁都没进过 engage"的空转通过)。
const okQ=(engA<=ENG_CAP/100&&advA>=ADV_FLOOR/100&&(engA+engB)>0);
line('  ── [隔离档 关岸炮 60s] '+name+'  相位: 我方 engage='+(engA*100).toFixed(0)+'% 推进/追击='+(advA*100).toFixed(0)+'%  '+
JSON.stringify(modes.A)+'   敌方 engage='+(engB*100).toFixed(0)+'%  '+(okQ?'✓':'✗'));
resQ.push({name,engA,advA,engB,ok:okQ});
}
const pass=res.every(r=>r.ok)&&resQ.every(r=>r.ok);
line('① 结果: '+(pass?'PASS':'FAIL')+'  (实战档 '+res.filter(r=>r.ok).length+'/'+res.length+
' 例 同时满足 离湾/相遇/无极限环; 隔离档(关岸炮) '+resQ.filter(r=>r.ok).length+'/'+resQ.length+' 例 相位轮换达标)');
line('   对照 (旧行为, 来自 dev/out/navalai-selfcheck-full.txt): engage=4199/4200 帧 (99.98%), 目标 battery=1799/1800 帧,');
line('   艇在出生湾内往返 (t=0..55s 位置都在 ±120m 内) ⇒ "一局双方的船基本遇不到"。');
return {pass,cases:res.map((r,i)=>({用例:r.name,离湾秒:+r.tDepart.toFixed(1),相遇秒:+r.tMeet.toFixed(1),最短距离:+r.minD.toFixed(1),
位移:+r.maxDispA.toFixed(0),engage占比:+(r.engA*100).toFixed(0),极限环窗口:r.loopBad,搁浅帧:r.grounded,
隔离档_engage占比:+(resQ[i].engA*100).toFixed(0),隔离档_推进占比:+(resQ[i].advA*100).toFixed(0)}))};
}

// ═══════════════ ② 两栖车上岸 + 开火 ═══════════════
function amphLanding(){
line('');
line('════ ② 两栖车 Bot: 上岸 + 转入陆战交战 (≥1 次开火) ════');
const SECS=QUICK?60:150;
const g=makeGame(ISLAND,31415);
const sp=g.spawnNaval('lvt',0,0,5);           // 车组用反装甲兵档 (cls5)
const sp2=g.spawnNaval('kami',1,0,5);         // 敌方两栖车: 给陆战层一个对等目标, 也验证双向
const t0=g.nowT();
let landT=-1, firstFireT=-1, firesBeforeLand=0, maxDep=-9, minDep=99, trail=[], lastSamp=-99, grounded=0;
g.step(Math.round(SECS*30),()=>{
const t=g.nowT()-t0;
const s=g.snap()[sp.n];
if(!s) return;
const lg=g.log();
if(maxDep<s.dep) maxDep=s.dep;
if(s.dep<minDep) minDep=s.dep;
if(s.state==='ground') grounded++;
if(landT<0&&s.dep<0.55){ landT=t; firesBeforeLand=lg.main; }
if(landT>=0&&firstFireT<0&&lg.main>firesBeforeLand) firstFireT=t;
if(t-lastSamp>=10){ lastSamp=t; trail.push({t:+t.toFixed(0),dep:s.dep,x:s.x,z:s.z,mode:s.mode,state:s.state,main:lg.main}); }
});
const lg=g.log();
const firesAfterLand=lg.main-firesBeforeLand;
const sL=g.snap()[sp.n], s2=g.snap()[sp2.n];
line('  ── LVT(A)-1 (team0, 车组=cls5) 实际推演 '+f1(g.nowT()-t0)+'s');
line('     航程水深: 最大 '+maxDep.toFixed(2)+'m / 最小 '+minDep.toFixed(2)+'m (wadeDepth=0.55 ⇒ <0.55 即履带态/上岸)  搁浅帧='+grounded);
line('     上岸时刻: '+(landT>=0?('t='+landT.toFixed(1)+'s'):'未上岸')+'   上岸前主炮射击 '+firesBeforeLand+' 次');
line('     上岸后主炮射击: '+firesAfterLand+' 次   首次开火时刻: '+(firstFireT>=0?('t='+firstFireT.toFixed(1)+'s'):'无'));
line('     武器调用总数: 主炮='+lg.main+' 机炮='+lg.sec+' 机枪='+lg.mg+' 鱼雷='+lg.torp+' (两栖车 torpedo=0 ⇒ 鱼雷应恒 0)');
line('     己方车结束: 存活='+sL.alive+' 状态='+sL.state+' 位置=('+sL.x+','+sL.z+') 水深='+sL.dep+' 离岸='+sL.sd+' 模式='+sL.mode+' 血量='+sL.hp);
line('     敌方车(カミ)结束: 存活='+s2.alive+' 状态='+s2.state+' 位置=('+s2.x+','+s2.z+') 水深='+s2.dep+' 模式='+s2.mode+' 血量='+s2.hp);
for(const x of trail.slice(0,16)) line('       t='+String(x.t).padStart(4)+'s  ('+String(x.x).padStart(7)+','+String(x.z).padStart(7)+')  水深='+String(x.dep).padStart(6)+'m  '+x.state+'/'+x.mode+'  主炮累计='+x.main);
if(trail.length>16) line('       … 共 '+trail.length+' 个采样');
const ok=(landT>=0&&firesAfterLand>=1&&lg.torp===0);
line('② 结果: '+(ok?'PASS':'FAIL')+'  (上岸='+(landT>=0)+', 上岸后开火='+firesAfterLand+' 次, 两栖车鱼雷恒 0='+(lg.torp===0)+')');
return {pass:ok,landT,firesAfterLand,lg};
}

// ═══════════════ ②b 岸炮 AI 移交核对 (2026-09-21A 裁定: 岸炮 AI 归 15f) ═══════════════
// 本项不再断言"14-bots 的 batteryAI 开了几炮" —— 那个口径已被 A#9「无人不开炮」取代, 且该函数已从
// 14-bots.js 删除 (方案 B: 消除与 15f:620 的同名全局冲突)。现在只核对三件事:
//   ① 14-bots 里没有 batteryAI 残留 (页面作用域 typeof batteryAI === 'undefined');
//   ② 本文件的帧钩**不驱动岸炮** (手动触发一帧帧钩, 15f 侧 AI 调用计数不变) —— 防"两边各自驱动";
//   ③ 15f 侧仍能驱动 (正常 step 一帧后计数增加) + A#9 语义 (无人操炮 ⇒ 0 次开火)。
function batteryRuns(){
line('');
line('════ ②b 岸炮 AI 移交核对 (岸炮 AI 已移交 15f; A#9「无人不开炮」) ════');
const g=makeGame(ISLAND,2718);
const sp=g.spawnNaval('pt',0,0,1);
const typeAI=vm.runInContext('typeof batteryAI',g.game);
const before=g.log().aiFifteenF;
// ② 手动触发本文件帧钩 (绕过 15d/15f 的 update): 岸炮不应被它驱动
vm.runInContext('nowT+=0.02; navalAIFrameTick();',g.game);
const afterHook=g.log().aiFifteenF;
// ③ 正常一帧 (含 15f 的 updateBatteries) 作为正对照
g.step(1,()=>{});
const afterStep=g.log().aiFifteenF;
const lg=g.log();
const bats=g.batSnap();
line('  ── 14-bots 作用域内 typeof batteryAI = '+typeAI+'   (期望 "undefined": 同名全局冲突已消除)');
line('  ── 15f 侧 AI 调用计数: 触发本文件帧钩前='+before+' → 帧钩后='+afterHook+' → 正常一帧后='+afterStep);
line('  ── 4 门炮位: '+bats.length+' 门, 存活 '+bats.filter(b=>b.alive).length+'  (A#9: 无人操炮 ⇒ 开火次数应为 0)');
line('  ── batteryFire 调用='+lg.batFire+' 次, 15f 侧 AI 判定开火='+lg.batFire15f+' 次');
line('  ── 我方 PT 艇: 存活='+g.snap()[sp.n].alive+' 位置=('+g.snap()[sp.n].x+','+g.snap()[sp.n].z+') 离岸='+g.snap()[sp.n].sd+'m');
const ok=(typeAI==='undefined'&&afterHook===before&&afterStep>before&&lg.batFire===0);
line('②b 结果: '+(ok?'PASS':'FAIL')+'  (无同名残留='+(typeAI==='undefined')+', 帧钩不驱动岸炮='+(afterHook===before)+
', 15f 侧仍驱动='+(afterStep>before)+', A#9 无人不开炮='+(lg.batFire===0)+')');
return {pass:ok,aiFifteenF:afterStep,hookDelta:afterHook-before,batFire:lg.batFire};
}

// ═══════════════ ④ 闪现取证 (probe-botflash 口径) ═══════════════
function flashRuns(){
line('');
line('════ ④ 连续 3 局无 >3m 非重生单帧位移 (dev/probe-botflash.js 同口径) ════');
const SECS=QUICK?20:60;
const JUMP=3;
const runs=[
['局1 island 带海战载具',ISLAND,11111,true],
['局2 island 带海战载具',ISLAND,22222,true],
['局3 island 带海战载具',ISLAND,33333,true],
['基线 steppe 无海战载具',STEPPE,44444,false]];
const out=[];
for(const [name,ci,seed,withNaval] of runs){
const g=makeGame(ci,seed);
if(withNaval){
for(let t=0;t<2;t++){                       // §11.7 编制: 每队 2 两栖车 + 3 艇
for(let i=0;i<2;i++) g.spawnNaval(t===0?'lvt':'kami',t,i,1);
for(let i=0;i<3;i++) g.spawnNaval(t===0?'pt':'gyorai',t,i,1);
}
}
const soldiers=g.soldiers, camera=g.camera;
const snap=b=>({x:b.pos.x,y:b.pos.y,z:b.pos.z,alive:!!b.alive,vis:!!b.mesh.root.visible,onV:!!b.onVehicle,
em:!!b.emCast,mg:!!b.mgUse,emp:!!b.empUse,mo:!!b.mortUse,st:b.state});
const classify=(p,c)=>{
if(!p.alive&&c.alive) return '重生(alive F→T)';
if(p.em&&(c.mg||c.emp||c.mo)) return '炮位前摇结束瞬移';
if(c.mg&&!p.mg) return '上机枪位';
if(c.emp&&!p.emp) return '上反坦克/防空炮位';
if(c.mo&&!p.mo) return '上迫击炮位';
if(p.onV&&!c.onV) return '下车位移';
if(p.vis&&!c.vis) return '隐藏(死亡/上车)';
if(!p.vis&&c.vis) return '现身(下车/脱离载具)';
if(p.vis&&c.vis&&p.alive&&c.alive) return '★真·可见闪现';
return '其他';
};
const prev=[];
const events=[]; let frames=0, simT=0, maxD=0, moves=0, totalTravel=0;
const t0=g.nowT();
g.step(Math.round(SECS*30),()=>{
frames++; simT=g.nowT()-t0;
for(let k=0;k<soldiers.length;k++){
const b=soldiers[k]; if(!b) continue;
const c=snap(b), p=prev[k];
if(p){
const dh=Math.hypot(c.x-p.x,c.z-p.z);
if(dh>1e-9){ moves++; totalTravel+=dh; if(dh>maxD) maxD=dh; }
if(dh>JUMP){
const dCam=Math.hypot(c.x-camera.position.x,c.z-camera.position.z);
events.push({n:b.name,team:b.team,tm:+simT.toFixed(2),d:+dh.toFixed(2),cause:classify(p,c),
aB:p.alive,aA:c.alive,vB:p.vis,vA:c.vis,oB:p.onV,oA:c.onV,dCam:+dCam.toFixed(0),
pB:[+p.x.toFixed(1),+p.z.toFixed(1)],pA:[+c.x.toFixed(1),+c.z.toFixed(1)],st:p.st+'→'+c.st});
}
}
prev[k]=c;
}
});
const notSpawn=events.filter(e=>e.cause!=='重生(alive F→T)');
const visNonSpawn=notSpawn.filter(e=>e.vB&&e.vA&&e.aB&&e.aA);
const byCause={};
for(const e of events) byCause[e.cause]=(byCause[e.cause]||0)+1;
const alive=g.soldiers.filter(b=>b.alive).length;
const onV=g.soldiers.filter(b=>b.onVehicle).length;
out.push({name,ci,seed,frames,simT,maxD,events:events.length,notSpawn:notSpawn.length,visNonSpawn:visNonSpawn.length,byCause,alive,onV,totalTravel,moves,list:notSpawn});
line('  ── '+name+'  (战役#'+ci+' '+g.campaign.id+'/'+g.campaign.mode+', seed='+seed+', 实际推演 '+f1(simT)+'s, bot='+soldiers.length+')');
line('     帧数='+frames+' 单帧位移峰值='+maxD.toFixed(2)+'m  位移样本='+moves+' 累计='+totalTravel.toFixed(0)+'m');
line('     >'+JUMP+'m 事件='+events.length+' (非重生 '+notSpawn.length+', 前后可见且存活 '+visNonSpawn.length+')  存活='+alive+'/'+soldiers.length+' 载具上='+onV);
const causes=Object.entries(byCause).sort((a,b)=>b[1]-a[1]);
if(causes.length) line('     分类: '+causes.map(x=>x[0]+'×'+x[1]).join('  '));
for(const e of notSpawn.slice(0,8)) line('       t='+String(e.tm).padStart(6)+'s '+e.n+' 队'+e.team+' d='+e.d+'m '+e.pB+'→'+e.pA+' '+e.cause+' a='+(e.aB?'T':'F')+'→'+(e.aA?'T':'F')+' vis='+(e.vB?'T':'F')+'→'+(e.vA?'T':'F')+' onV='+(e.oB?'T':'F')+'→'+(e.oA?'T':'F')+' dCam='+e.dCam+' st='+e.st);
}
const pass=out.every(r=>r.notSpawn===0);
line('④ 结果: '+(pass?'PASS':'FAIL')+'  ('+out.filter(r=>r.notSpawn===0).length+'/'+out.length+' 局 非重生 >3m 事件为 0; 可见闪现合计 '+
out.reduce((a,r)=>a+r.visNonSpawn,0)+')');
return {pass,runs:out.map(r=>({name:r.name,notSpawn:r.notSpawn,vis:r.visNonSpawn,maxD:r.maxD,events:r.events}))};
}

// ═══════════════ ⑤ 载具对象零污染断言 (Lead 裁定③) ═══════════════
function purityCheck(){
line('');
line('════ ⑤ 载具对象零污染: 两栖车陆战复用 shim 不在 craft 上留 AI 字段 ════');
const g=makeGame(ISLAND,9090);
const sp=g.spawnNaval('lvt',0,0,5);
const before=g.keys()[sp.n];
const t0=g.nowT();
g.step(Math.round(60*30),()=>{});
const after=g.keys()[sp.n];
const bSet=new Set(before.split(',')), aSet=new Set(after.split(','));
const added=[...aSet].filter(k=>!bSet.has(k));
const removed=[...bSet].filter(k=>!aSet.has(k));
line('  craft 自有键: 推演前 '+bSet.size+' 个 → 推演后 '+aSet.size+' 个  (实际推演 '+f1(g.nowT()-t0)+'s)');
line('  新增键: '+(added.length?added.join(','):'(无)')+'   删除键: '+(removed.length?removed.join(','):'(无)'));
const allowed=['__aiBoatTick','__aiAmphTick','driverBot','crewBot'];   // 帧戳(Lead 硬裁定 §11.9②) + 接线字段
const bad=added.filter(k=>allowed.indexOf(k)<0);
line('  允许的接线/帧戳字段: '+allowed.join(','));
line('  ⇒ '+(bad.length?('FAIL 出现非允许字段: '+bad.join(',')):'PASS 载具对象无 AI 私有字段残留'));
line('  结束状态: 存活='+g.snap()[sp.n].alive+' 状态='+g.snap()[sp.n].state+' 模式='+g.snap()[sp.n].mode+' 位置=('+g.snap()[sp.n].x+','+g.snap()[sp.n].z+')');
return {pass:bad.length===0,added};
}

// ═══════════════ ⑥ 乘员落水 → 游泳标志 (naval-hull 实测缺陷 + Lead 裁定) ═══════════════
function swimCheck(){
line('');
line('════ ⑥ 乘员落水 → 游泳态 (naval-hull 实测: 不动则不置位; Lead 裁定在 Bot.update 对账) ════');
const g=makeGame(ISLAND,6001);
const sp=g.spawnNaval('pt',0,0,1);
const botSnap=vm.runInContext('__botSnap',g.game);
vm.runInContext('navalCraft['+sp.n+'].takeDmg(99999,null,true);',g.game);   // 打沉 → crewOut() 落水
const t0=g.nowT();
let sawSwim=0, total=0, startSd=null, endSd=null, minSd=1e9, drySwim=0;
g.step(Math.round(40*30),()=>{
const b=botSnap(sp.bot);
if(!b||!b.alive) return;
total++;
if(b.swim) sawSwim++;
if(b.swim&&b.dep<=1.35&&b.sd<0) drySwim++;                  // 反例: 陆上/浅水被误判游泳
if(b.dep>1.35){ if(startSd===null) startSd=b.sd; endSd=b.sd; if(b.sd<minSd) minSd=b.sd; }
});
const b=botSnap(sp.bot);
line('  艇沉没 → crewOut 落水; 实际推演 '+f1(g.nowT()-t0)+'s  采样帧='+total+'  其中 swim=true '+sawSwim+' 帧 ('+(total?(sawSwim/total*100).toFixed(0):0)+'%)');
line('  落水点离岸='+(startSd===null?'n/a':startSd.toFixed(1)+'m')+' → 结束离岸='+(endSd===null?'n/a':endSd.toFixed(1)+'m')+'  全程最小离岸='+(minSd>1e8?'n/a':minSd.toFixed(1)+'m')+' (递减=在朝岸游)');
line('  结束: alive='+b.alive+' swim='+b.swim+' wading='+b.wading+' onVehicle='+b.onV+' 位置=('+b.x+','+b.z+') 水深='+b.dep+' 离岸='+b.sd);
line('  反例核对: "陆上/浅水却 swim=true" 帧数 = '+drySwim+' (期望 0)');
const ok=(sawSwim>0&&drySwim===0);
line('⑥ 结果: '+(ok?'PASS':'FAIL'));
return {pass:ok,sawSwim,total,drySwim};
}

// ═══════════════ ⑦ 与 verifier 夹具对齐复算 (红线 7 对质) ═══════════════
function alignRecount(){
line('');
line('════ ⑦ 对齐复算: verifier 起点 [0,-250] (北湾) vs 本方集结点 —— 逐字复刻 dev/verify-naval.js aiTrial ════');
line('  夹具口径: 受控单台载具 + crew() 挂 driverBot + 岸炮静默(setQuiet) + step 只推载具/炮弹(不跑步兵)');
line('           tReach = 首次 shoreDist ≤ 45m; 另报 minShore / 搁浅帧 / 每帧状态机名 / "是否真调用 AI" 计数。');
const rows=[];
const cases=[
{tag:'⑦A',name:'verifier 夹具: pt team0 起点(0,-250) 朝岛心 70s',key:'pt',team:0,x:0,z:-250},
{tag:'⑦B',name:'verifier 夹具: lvt team0 起点(0,-250) 朝岛心 70s',key:'lvt',team:0,x:0,z:-250},
{tag:'⑦C',name:'对照(我方口径): pt team0 起点=muster[0](0,250) 70s',key:'pt',team:0,x:0,z:250},
{tag:'⑦D',name:'对照(我方口径): lvt team0 起点=muster[0](0,250) 70s',key:'lvt',team:0,x:0,z:250}];
for(const cs of cases){
const g=makeGame(ISLAND,8123);
vm.runInContext('__quietBatteries();',g.game);                 // 与 verifier 一致: 关岸炮, 隔离火力干扰
const spawned=vm.runInContext(`__spawnAt(${JSON.stringify(cs.key)},${cs.team},${cs.x},${cs.z},Math.atan2(${-cs.x},${-cs.z}),1)`,g.game);
const core=vm.runInContext('__craftCore',g.game), modeOf=vm.runInContext('__modeOf',g.game);
const laneOf=vm.runInContext('__laneOf',g.game), appOf=vm.runInContext('__approachOf',g.game);
const start=core(spawned.n);
const total=Math.round(70*60);
const modes={}; let minShore=1e9, groundFrames=0, tReach=null, landT=null, fireBefore=0, firstGround=null, trail=[];
const t0=g.nowT();
vm.runInContext('__stepQuiet',g.game)(total,()=>{
const s=core(spawned.n); if(!s) return;
const t=g.nowT()-t0;
const m=modeOf(spawned.n); if(m) modes[m]=(modes[m]||0)+1;
if(s.sd<minShore) minShore=s.sd;
if(s.state==='ground'){ groundFrames++; if(!firstGround) firstGround={t:+t.toFixed(1),sd:s.sd,dep:s.dep,mode:m,fwd:s.fwd}; }
if(tReach===null&&s.sd<=45) tReach=+t.toFixed(1);
if(cs.key==='lvt'&&landT===null&&s.dep<0.55){ landT=+t.toFixed(1); fireBefore=g.log().main; }
const sec=Math.round(t);
if(sec%10===0&&(trail.length===0||trail[trail.length-1].t!==sec)) trail.push({t:sec,sd:s.sd,dep:s.dep,mode:m,state:s.state});
});
const s=core(spawned.n), lg=g.log();
const firesAfter=(landT!==null)?(lg.main-fireBefore):0;
line('  ── '+cs.tag+' '+cs.name);
line('     起点: 离岸='+start.sd+'m 水深='+start.dep+'m 艏向=朝岛心  结束: 离岸='+s.sd+'m 水深='+s.dep+'m 状态='+s.state+' 位置=('+s.x+','+s.z+')');
line('     minShore='+minShore.toFixed(1)+'m  搁浅帧='+groundFrames+'/'+total+'  tReach(≤45m)='+(tReach===null?'未到达':tReach+'s')+
(cs.key==='lvt'?('  上岸(水深<0.55)='+(landT===null?'未上岸':landT+'s')+'  上岸后主炮开火='+firesAfter+' 次'):''));
line('     选湾='+(laneOf(spawned.n)||'无')+'  进近点='+JSON.stringify(appOf(spawned.n))+
'  AI真调用帧='+lg.aiFrames+'  drive调用='+lg.driveCalls);
line('     状态机帧分布='+JSON.stringify(modes));
if(firstGround) line('     ★首次搁浅: t='+firstGround.t+'s 离岸='+firstGround.sd+'m 水深='+firstGround.dep+'m 相位='+firstGround.mode+' fwd='+firstGround.fwd);
line('     轨迹(每10s: 离岸/相位): '+trail.map(x=>'t'+x.t+' '+x.sd+'m/'+x.mode).join('  '));
rows.push({tag:cs.tag,key:cs.key,minShore:+minShore.toFixed(1),groundFrames,tReach,landT,firesAfter,
aiFrames:lg.aiFrames,driveCalls:lg.driveCalls,modes,startSd:start.sd,endSd:s.sd,lane:laneOf(spawned.n)});
}
// ⑦E 反证: 同一位置不挂车组 ⇒ 没有人调 drive ⇒ 不动 (证明"动了就一定是 AI 或夹具在驱动")
{
const g=makeGame(ISLAND,8123);
vm.runInContext('__quietBatteries();',g.game);
const idx=vm.runInContext('__spawnNoAI("pt",0,0,-250,0)',g.game);
const core=vm.runInContext('__craftCore',g.game);
const a=core(idx);
vm.runInContext('__stepQuiet',g.game)(Math.round(70*60),()=>{});
const b=core(idx), lg=g.log();
line('  ── ⑦E 反证: 同起点 pt 不挂车组 (driverBot=null): 位移='+Math.hypot(b.x-a.x,b.z-a.z).toFixed(2)+
'm  AI调用帧='+lg.aiFrames+' drive调用='+lg.driveCalls+' (期望: 全 0 —— 没有 AI 就没人驱动)');
}
const A=rows[0], B=rows[1], C=rows[2], D=rows[3];
const okA=(A.groundFrames===0&&A.minShore>30&&A.aiFrames>0);
const okC=(C.groundFrames===0&&C.aiFrames>0);
const okB=(B.landT!==null&&B.firesAfter>=1);
const okD=(D.landT!==null&&D.firesAfter>=1);
line('⑦ 判读:');
line('   A 艇从北湾起步(verifier 夹具): 不搁浅='+(A.groundFrames===0?'✓':'✗')+' minShore='+A.minShore+'m'+
'   ⇒ 若成立, 说明"17.2m 触底"不是当前 boatAI 的行为');
line('   B 两栖车从北湾起步: 70s 内上岸='+(B.landT!==null?'✓':'✗(绕岛距离不够: 该起点不是本方集结点)'));
line('   C/D 对照(本方集结点起步): 艇不搁浅='+(C.groundFrames===0?'✓':'✗')+' 两栖车 70s 上岸并开火='+((D.landT!==null&&D.firesAfter>=1)?'✓':'✗'));
line('⑦ 结果: '+((okA&&okC&&okB&&okD)?'PASS':(okA&&okC?'PARTIAL(见 B 说明)':'FAIL')));
return {pass:okA&&okC,rows};
}

// ═══════════════ ⑧ 友军火力回归 (coastal-battery 实报) + 岸上工事归属过滤 ═══════════════
// 三层断言 (任务板 task-2 验收 3):
//   ① 日军艇对**自家反舰炮位**永不索敌 (batteryNear 第 4 参队别过滤) —— 2026-09-20 已修;
//   ② 美军艇能索敌日军炮位 (正对照, 证明不是"全都索不到"的假阴性);
//   ③ ★ ATGUNS 目标帧数 = 0 (双方) —— 根因⑤: 17-emplacements:34 的 ATGUNS 压表不带 team, 旧代码把
//      "无 team" 读成"中立可打", 于是双方艇都去轰自己阵线里的反坦克炮。现在 navFortTeam 判定不出归属
//      一律跳过 ⇒ 断言必须逐帧为 0。**按对象身份判** (ai.tgt.obj 是否在 ATGUNS 里), 不按 kind 字符串判。
function friendlyFireCheck(){
line('');
line('════ ⑧ 岸上目标归属过滤: 自家炮位 0 帧 / 反坦克炮 (无归属字段) 0 帧 ════');
const rows=[];
for(const [label,team,key] of [['日军 九三式艇 team1 (不得索敌自家炮位)',1,'gyorai'],['美军 PT 艇 team0 (正对照: 必须能索敌日军炮位)',0,'pt']]){
const g=makeGame(ISLAND,5150+team);
const spawned=vm.runInContext(`__spawnAt(${JSON.stringify(key)},${team},-235,70,Math.atan2(235,-70),1)`,g.game);
const craft=g.crafts[spawned.n];
// 身份判定辅助: ai.tgt.obj 属于哪张表 (在沙箱里算, 避免跨 vm 传对象)
vm.runInContext('__tgtClass=function(o){ if(!o) return null; if(typeof ATGUNS!=="undefined"&&ATGUNS.indexOf(o)>=0) return "atgun";'+
' if(typeof MG42S!=="undefined"&&MG42S.indexOf(o)>=0) return "mg42"; if(typeof MORTARS!=="undefined"&&MORTARS.indexOf(o)>=0) return "mortar";'+
' if(typeof BATTERIES!=="undefined"&&BATTERIES.indexOf(o)>=0) return "battery"; if(typeof soldiers!=="undefined"&&soldiers.indexOf(o)>=0) return "inf"; return "?"; };',g.game);
let bat=0,fort=0,inf=0,none=0,frames=0,atgun=0,mg42=0,mortar=0,unknown=0,own=0;
g.step(Math.round(60*30),()=>{
frames++;
const ai=g.dbg(craft);
const k=ai.tgt?ai.tgt.kind:null;
if(k==='battery') bat++; else if(k==='fort') fort++; else if(k==='inf') inf++; else none++;
if(ai.tgt){
const cls=vm.runInContext('__tgtClass',g.game)(ai.tgt.obj);
if(cls==='atgun') atgun++; else if(cls==='mg42') mg42++; else if(cls==='mortar') mortar++;
// 归属复算: 目标是自家/本队可用的工事吗 (navFortTeam 在沙箱里)
const ft=vm.runInContext('navFortTeam',g.game)(ai.tgt.obj);
if(ft!==null&&ft===team) own++;
if(cls==='?'||cls===null) unknown++;
}
});
const nearBat=vm.runInContext('(()=>{let bd=1e9,k="";for(const b of BATTERIES){if(!b||!b.alive)continue;const d=Math.hypot(b.x-(-235),b.z-70);if(d<bd){bd=d;k=b.key;}}return {d:+bd.toFixed(1),key:k};})()',g.game);
line('  ── '+label+'  起点(-235,70) 60s, 最近日军炮位='+nearBat.key+' 距离 '+nearBat.d+'m (射程 340m 内 ⇒ 不是假阴性)');
line('     目标类型帧分布: battery='+bat+'  fort='+fort+'  inf='+inf+'  无目标='+none+'  / 共 '+frames+' 帧');
line('     工事身份细分: ATGUNS='+atgun+'  MG42S='+mg42+'  MORTARS='+mortar+'  身份未知='+unknown+'   其中"索敌自家工事"帧='+own);
const okBat=(team===1)?(bat===0):(bat>0);
const ok=(atgun===0&&own===0&&unknown===0&&okBat);
line('     '+(team===1?'日军艇索敌自家炮位帧 = 0':'美军艇索敌日军炮位帧 > 0')+' → '+(okBat?'✓':'✗')+
'   ATGUNS (无 team 字段) 目标帧 = '+atgun+' (期望 0) → '+(atgun===0?'✓':'✗')+
'   自家工事目标帧 = '+own+' (期望 0) → '+(own===0?'✓':'✗'));
rows.push({label,team,bat,fort,inf,frames,atgun,mg42,mortar,own,unknown,ok});
}
const pass=rows.every(r=>r.ok);
line('⑧ 结果: '+(pass?'PASS':'FAIL'));
return {pass,rows};
}

// ═══════════════ ⑨ 真炮塔 360° + 玩家炮手观测链 (真 15d/15e, 非替身) ═══════════════
// 任务板 task-2 验收 4: "给艇一个正后方目标, 炮塔在 ≤3s 内转到并开火 (打印 turretYaw 轨迹, 无 ±π 跳变)"。
// ★ 为什么必须真文件: 前八节用的是探针自带的 15d 替身 (probe-spawn 的文件表不含 15d/15e/15f), 替身里
//   turretAimAt 只有 5 行, 证明不了真实现。本节把 js/15e-navmodels.js + js/15d-naval.js 就地载入沙箱
//   (顺序与 index.html:335-336 一致), 于是以下路径全部是真代码: navBuildModel 的真炮塔 / turretAimWorld
//   的连续回转 / muzzles.main 的 getWorldPosition / _syncModel 的炮管隐藏。
// ★ 沙箱补 three.js API: probe-spawn 的 Object3D 桩没有 getWorldPosition/updateMatrixWorld, 而
//   navalMuzzleWorld/navalSightWorld 的"锚点优先"路径正需要它们。这里补一个最小实现 (T·Ry·Rx·Rz 链),
//   语义与 three r152 的 Object3D.getWorldPosition 一致 —— 不补的话本节只能验到解析兜底路径。
const O3_PATCH=`
(function(){
const P=THREE.Object3D.prototype;
// 沙箱桩补 V3 缺的两个方法 (真 three 的 Vector3 都有; 桩少了它们会挡住相机/瞄准路径)
const V=THREE.Vector3.prototype;
if(!V.negate) V.negate=function(){ this.x=-this.x; this.y=-this.y; this.z=-this.z; return this; };
if(!V.dot) V.dot=function(v){ return this.x*v.x+this.y*v.y+this.z*v.z; };
if(!V.sub) V.sub=function(v){ this.x-=v.x; this.y-=v.y; this.z-=v.z; return this; };
function rotM(r){
const cy=Math.cos(r.y||0), sy=Math.sin(r.y||0), cx=Math.cos(r.x||0), sx=Math.sin(r.x||0), cz=Math.cos(r.z||0), sz=Math.sin(r.z||0);
// R = Ry·Rx·Rz (three 的 'YXZ' 序; 本仓载具/炮塔只用到 Y 与 X, Z 保留以防万一)
return [cy*cz+sy*sx*sz, -cy*sz+sy*sx*cz, sy*cx,
        cx*sz,           cx*cz,          -sx,
        -sy*cz+cy*sx*sz,  sy*sz+cy*sx*cz, cy*cx];
}
function mul(a,b){
const o=new Array(9);
for(let i=0;i<3;i++)for(let j=0;j<3;j++){ let s=0; for(let k=0;k<3;k++) s+=a[i*3+k]*b[k*3+j]; o[i*3+j]=s; }
return o;
}
P.updateMatrixWorld=function(){ return this; };   // 真实现是缓存矩阵; 本桩按需现算, 无需缓存
P.getWorldPosition=function(v){
const chain=[]; let o=this;
while(o){ chain.push(o); o=o.parent; }
let m=[1,0,0,0,1,0,0,0,1], x=0,y=0,z=0;
for(let i=chain.length-1;i>=0;i--){
const n=chain[i], p=n.position||{x:0,y:0,z:0}, r=n.rotation||{x:0,y:0,z:0};
x+=m[0]*p.x+m[1]*p.y+m[2]*p.z; y+=m[3]*p.x+m[4]*p.y+m[5]*p.z; z+=m[6]*p.x+m[7]*p.y+m[8]*p.z;
m=mul(m,rotM(r));
}
v.x=x; v.y=y; v.z=z; return v;
};
})();`;
function realTurret(){
line('');
line('════ ⑨ 真炮塔 360° 回转 + 炮手观测链 (真 js/15e + js/15d, 非替身) ════');
const g=makeGame(ISLAND,20260921,{real15:true});
vm.runInContext(O3_PATCH,g.game,{filename:'o3-patch.js'});
// 造一台真 PT 艇 (15d 构造器 → 15e navBuildModel 真模型 → 世界锚点/炮口全部真实)
const info=vm.runInContext(`(()=>{
const S=NAVAL_SPEC.pt;
const c=new NavalCraft('pt',0,0);
c.pos.set(0,waterYAt(0,250)-S.draft0,250); c.yaw=0; c.vel=0; c.driverBot=null; c.crewBot=null;
c.playerDriven=false; c.aiDrive=false;      // 本节自己驱动炮塔, 不让 AI 抢
const sp=c.spec;
const sight=navalSightWorld(c);
const mz=navalMuzzleWorld(c,'main');
const g0=navGunOrigin(c);
return {idx:navalCraft.length-1,
 specTur:sp.tur?JSON.stringify(sp.tur):'null', sightH:(sp.sightH===undefined?'(缺)':sp.sightH),
 turretG:!!c.turretG, pitchG:!!c.pitchG, mainGisTurret:(c.mainG===c.turretG),
 muzzleMain:!!(c.muzzles&&c.muzzles.main),
 dims:c.dims?{turretY:+c.dims.turretY.toFixed(3),turretH:+c.dims.turretH.toFixed(3),sightY:+c.dims.sightY.toFixed(3),deckY:+c.dims.deckY.toFixed(3)}:null,
 sight:{x:+sight.x.toFixed(2),y:+sight.y.toFixed(2),z:+sight.z.toFixed(2),src:sight.src},
 muzzle:{x:+mz.x.toFixed(2),y:+mz.y.toFixed(2),z:+mz.z.toFixed(2)},
 gunOrigin:{x:+g0.x.toFixed(2),y:+g0.y.toFixed(2),z:+g0.z.toFixed(2)},
 posY:+c.pos.y.toFixed(2),
 deckY:+((sp.hullY||0)+(sp.hullH||0)*0.5).toFixed(2),
 muzzleDist:+Math.hypot(mz.x-c.pos.x,mz.z-c.pos.z).toFixed(2)};
})()`,g.game);
line('  ── 真 15d/15e 建出的 PT 艇: turretG='+info.turretG+' pitchG='+info.pitchG+' mainG===turretG='+info.mainGisTurret+' muzzles.main='+info.muzzleMain);
line('     spec.tur='+info.specTur+'  spec.sightH='+info.sightH+'  dims='+JSON.stringify(info.dims));
line('     观瞄点 (navalSightWorld) = ('+info.sight.x+','+info.sight.y+','+info.sight.z+')  档位='+info.sight.src+
'  ⇒ 镜心高于**主甲板** '+(info.sight.y-info.posY-info.dims.deckY).toFixed(2)+'m (主甲板世界 y='+(info.posY+info.dims.deckY).toFixed(2)+
', 艇体几何中心 y='+(info.posY+info.deckY).toFixed(2)+' —— 两者差 '+(info.deckY-info.dims.deckY).toFixed(2)+'m, 别混用)');
line('     炮口 (muzzles.main → getWorldPosition) = ('+info.muzzle.x+','+info.muzzle.y+','+info.muzzle.z+
')  距艇体中心水平 '+info.muzzleDist+'m  (解析兜底会给出艇体中心+1.8m ⇒ 距离≈0, 故 >2m 即证明走的是锚点路径)');
line('     navGunOrigin (14-bots 的炮口原点) = ('+info.gunOrigin.x+','+info.gunOrigin.y+','+info.gunOrigin.z+')'+
'  ⇒ AI 的提前量起算点 = 真炮口 = '+((Math.hypot(info.gunOrigin.x-info.muzzle.x,info.gunOrigin.y-info.muzzle.y,info.gunOrigin.z-info.muzzle.z)<0.01)?'✓':'✗'));
// ── 360° 回转: 正后方目标 (艇艏 yaw=0, 目标 (0,150) 在正艉) ──
const tur=vm.runInContext(`(()=>{
const c=navalCraft[${info.idx}];
const ai=navAIS(c);
const dt=1/60, TX=0, TZ=150, TY=1.0;
const want=angDiff(c.yaw,Math.atan2(TX-c.pos.x,TZ-c.pos.z));   // 期望的炮塔局部角 ≈ ±π (正后方)
const trace=[]; let maxStep=0, tAlign=-1, tFire=-1, shells0=shells.length, prev=c.turretYaw;
for(let f=0;f<Math.round(3.2*60);f++){
nowT+=dt;
const fired=navBoatShoot(c,ai,dt,TX,TY,TZ,0.22);             // 与 AI 实战同一入口 (含转塔 + 门控 + 开火)
const step=Math.abs(c.turretYaw-prev); prev=c.turretYaw;
if(step>maxStep) maxStep=step;
if(tAlign<0&&Math.abs(angDiff(c.turretYaw,want))<=0.02) tAlign=(f+1)*dt;
if(tFire<0&&fired) tFire=(f+1)*dt;
if(f%6===0||f<12) trace.push({f:f,t:+((f+1)*dt).toFixed(2),y:+c.turretYaw.toFixed(3),wrapped:+(angDiff(0,c.turretYaw)).toFixed(3)});
}
const tRate=c.spec.tRate;
return {want:+want.toFixed(3),yaw:+c.turretYaw.toFixed(3),wrapped:+angDiff(0,c.turretYaw).toFixed(3),
tAlign:+tAlign.toFixed(2),tFire:+tFire.toFixed(2),maxStep:+maxStep.toFixed(4),bound:+(tRate*dt*1.5).toFixed(4),
tRate:tRate,shells:shells.length-shells0,trace:trace};
})()`,g.game);
line('  ── ★炮塔 360°: 正后方目标 (世界方位 '+tur.want+' rad ≈ 180°) → turretYaw 终值 '+tur.yaw+
' (归一化 '+tur.wrapped+')  对齐耗时 t='+tur.tAlign+'s  (≤3s ⇒ '+(tur.tAlign>=0&&tur.tAlign<=3?'✓':'✗')+')');
line('     开火耗时 t='+tur.tFire+'s  本次推演新发射炮弹 '+tur.shells+' 发 (期望 ≥1 ⇒ '+(tur.shells>=1?'✓':'✗')+')');
line('     逐帧步进上界: max|Δ turretYaw|='+tur.maxStep+' rad ≤ tRate*dt*1.5='+tur.bound+' (tRate='+tur.tRate+
')  ⇒ 无 ±π/2π 跳变 '+(tur.maxStep<=tur.bound?'✓':'✗'));
line('     turretYaw 轨迹 (每 0.1s; wrapped=归一化到 (-π,π] 的同一角度):');
line('       '+tur.trace.slice(0,14).map(x=>'t'+x.t+':'+x.y).join('  '));
line('       '+tur.trace.slice(14,28).map(x=>'t'+x.t+':w'+x.wrapped).join('  '));
// ── 观瞄点降级链 (spec.tur/sightH 缺失时的兜底读数, 逐档打印) ──
const fb=vm.runInContext(`(()=>{
const S=NAVAL_SPEC.pt;
const D={deckY:1.66,turretY:1.89,turretH:0.88,sightY:2.76};
const base={pos:V3(0,0,250),yaw:0,nodes:{},grp:null};
const out=[];
out.push(Object.assign({tag:'① dims 齐全 (15e 在链上)'},(function(){const c=Object.assign({},base,{spec:S,dims:D});
const w=navalSightWorld(c); return {src:w.src,y:+w.y.toFixed(2)};})()));
out.push(Object.assign({tag:'② 无 dims, 有 spec.sightH'},(function(){const c=Object.assign({},base,{spec:S,dims:null});
const w=navalSightWorld(c); return {src:w.src,y:+w.y.toFixed(2)};})()));
out.push(Object.assign({tag:'③ 无 sightH, 有 dims.turretY/H'},(function(){const c=Object.assign({},base,{spec:Object.assign({},S,{sightH:undefined}),dims:D});
const w=navalSightWorld(c); return {src:w.src,y:+w.y.toFixed(2)};})()));
out.push(Object.assign({tag:'④ spec.tur=null 且无 dims (纯 hullH 推算)'},(function(){const c=Object.assign({},base,{spec:Object.assign({},S,{tur:null,sightH:undefined}),dims:null});
const w=navalSightWorld(c); return {src:w.src,y:+w.y.toFixed(2)};})()));
return out;
})()`,g.game);
line('  ── 观瞄点降级链 (WS1 字段缺失时必须优雅降级, 不许 undefined):');
for(const r of fb) line('       '+r.tag+' → 档位='+r.src+'  镜心世界 y='+r.y);
// ── 玩家炮手观测链: C 三态 + 相机/开镜/隐藏炮管 ──
const pv=vm.runInContext(`(()=>{
const c=navalCraft[${info.idx}];
player.onNaval=c; player.onVehicle=null; player.alive=true; player.deployed=true;
c.playerDriven=true; c.driverBot=null; c.crewBot=null;
player.navalCd={main:0,sec:0,torp:0}; player.navalFire={torp:0};
player.pitch=0; player.thirdPerson=true; player.navalGun=false;
player.yaw=c.yaw+Math.PI;
const camFwd=()=>[-Math.sin(camera.rotation.y)*Math.cos(camera.rotation.x),Math.sin(camera.rotation.x),-Math.cos(camera.rotation.y)*Math.cos(camera.rotation.x)];
const bow=[Math.sin(c.yaw),0,Math.cos(c.yaw)];
// 与 24-main 同序推帧: updatePlayer → updateCamera → (…) → updateNaval
// ★ 必须带上 updateNaval: 15d 的 _syncModel (炮管隐藏) 与武器冷却递减都在它里面 —— 只调相机分支会漏掉这两件。
const tick=(n)=>{ for(let i=0;i<(n||1);i++){ updatePlayerNaval(1/60); updateCamera(1/60); updateNaval(1/60); } };
const out={};
// ① 第三人称 (追尾): 相机必须在艉后, 且视线朝艏 —— 这是 2026-09-21 修的 π 反向 (旧实现相机在艏前 12.8m 朝艉)
tick(4);
let f=camFwd();
out.tp={behind:+((camera.position.x-c.pos.x)*bow[0]+(camera.position.z-c.pos.z)*bow[2]).toFixed(2),
dot:+(f[0]*bow[0]+f[2]*bow[2]).toFixed(3),fov:+camera.fov.toFixed(1),
scope:document.getElementById('scopeOv').style.display};
// ② C → 炮手镜
navalCycleView();
out.cycle1={third:player.thirdPerson,gun:!!player.navalGun};
tick(45);
// ★ 机位断言必须在**同一帧内**取观瞄点: 24-main 的序是 updateCamera → … → updateNaval, 而 updateNaval 里的
//   _attitude/_syncModel 会改 grp 的浮态变换 ⇒ 帧间取点会带上"一帧浮态差"(6.35m 力臂上 ≈1.1m, 那是物理滞后,
//   不是机位错)。这里补一帧 updatePlayerNaval+updateCamera, 在 updateNaval 之前立刻复算观瞄点。
updatePlayerNaval(1/60); updateCamera(1/60);
const sight=navalSightWorld(c);
f=camFwd();
const a=c.yaw+(c.turretYaw||0), tp=c.turretPitch||0;
const tdir=[Math.sin(a)*Math.cos(tp),Math.sin(tp),Math.cos(a)*Math.cos(tp)];
out.gun={distToSight:+Math.hypot(camera.position.x-sight.x,camera.position.y-sight.y,camera.position.z-sight.z).toFixed(3),
dotTurret:+(f[0]*tdir[0]+f[1]*tdir[1]+f[2]*tdir[2]).toFixed(4),
fov:+camera.fov.toFixed(1),scope:document.getElementById('scopeOv').style.display,
pitchGVisible:!!(c.pitchG&&c.pitchG.visible),turretYaw:+c.turretYaw.toFixed(3)};
// 炮手镜开火: 相机中心射线汇聚路径 (20a 未改) —— 用真实 fireMain 计数
const s0=shells.length; player.navalCd.main=0; c.cannonCd=0; mouseDown=true;
updatePlayerNaval(1/60); mouseDown=false;
out.gunFire={shells:shells.length-s0};
// ③ C → 艏向第一人称
navalCycleView(); out.cycle2={third:player.thirdPerson,gun:!!player.navalGun};
tick(45);
f=camFwd();
out.bow={ahead:+((camera.position.x-c.pos.x)*bow[0]+(camera.position.z-c.pos.z)*bow[2]).toFixed(2),
dot:+(f[0]*bow[0]+f[2]*bow[2]).toFixed(3),fov:+camera.fov.toFixed(1),
scope:document.getElementById('scopeOv').style.display};
// ④ C → 回第三人称
navalCycleView(); out.cycle3={third:player.thirdPerson,gun:!!player.navalGun};
// ⑤ 下艇复位: 炮手镜开关必须被清 (navalSeatRelease 主路径 + 22-hud 兜底)
player.navalGun=true; navalSeatRelease();
out.release={gun:!!player.navalGun,onNaval:player.onNaval};
player.navalGun=false;
return out;
})()`,g.game);
const okTP=(pv.tp.behind<0&&pv.tp.dot>0.9&&pv.tp.scope==='none');
const okGun=(pv.gun.distToSight<0.05&&pv.gun.dotTurret>0.999&&pv.gun.fov<40&&pv.gun.scope==='block'&&!pv.gun.pitchGVisible&&pv.gunFire.shells>=1);
const okBow=(pv.bow.ahead>0&&pv.bow.dot>0.9&&pv.bow.scope==='none');
const okCycle=(pv.cycle1.third===false&&pv.cycle1.gun===true&&pv.cycle2.third===false&&pv.cycle2.gun===false&&
pv.cycle3.third===true&&pv.cycle3.gun===false&&pv.release.gun===false&&!pv.release.onNaval);
line('  ── ★玩家观测链 (C 三态):');
line('     ① 第三人称: 相机沿艏向偏移 '+(pv.tp.behind<0?pv.tp.behind+'m (在艉后 ✓)':pv.tp.behind+'m (在艏前 ✗)')+
'  视线·艏向='+pv.tp.dot+' fov='+pv.tp.fov+' #scopeOv='+pv.tp.scope+'  → '+(okTP?'✓':'✗'));
line('     ② 炮手镜: 机位距观瞄点 '+pv.gun.distToSight+'m  视线·炮塔指向='+pv.gun.dotTurret+' fov='+pv.gun.fov+
' #scopeOv='+pv.gun.scope+' 炮管可见='+pv.gun.pitchGVisible+' 镜内开火='+pv.gunFire.shells+' 发  → '+(okGun?'✓':'✗'));
line('     ③ 艏向第一人称: 相机沿艏向偏移 '+pv.bow.ahead+'m  视线·艏向='+pv.bow.dot+' fov='+pv.bow.fov+'  → '+(okBow?'✓':'✗'));
line('     ④ C 三态循环: 追尾→'+JSON.stringify(pv.cycle1)+'→'+JSON.stringify(pv.cycle2)+'→'+JSON.stringify(pv.cycle3)+
'  下艇复位 gun='+pv.release.gun+' onNaval='+pv.release.onNaval+'  → '+(okCycle?'✓':'✗'));
const ok360=(tur.tAlign>=0&&tur.tAlign<=3&&tur.shells>=1&&tur.maxStep<=tur.bound);
const okMuzzle=(info.turretG&&info.pitchG&&info.muzzleMain&&info.muzzleDist>2);
const pass=(ok360&&okMuzzle&&okTP&&okGun&&okBow&&okCycle);
line('⑨ 结果: '+(pass?'PASS':'FAIL')+'  (360°回转+开火='+(ok360?'✓':'✗')+' 真炮塔/炮口锚点='+(okMuzzle?'✓':'✗')+
' 第三人称='+(okTP?'✓':'✗')+' 炮手镜='+(okGun?'✓':'✗')+' 艏向FP='+(okBow?'✓':'✗')+' C三态='+(okCycle?'✓':'✗')+')');
return {pass,info,tur,pv,fb};
}

// ═══════════════ 汇总 ═══════════════
line('══════════════════════════════════════════════════════════════════════');
line('海战 Bot AI 三层自检 · task-2 全盘优化批 · naval-ai');
line('源文件指纹: js/14-bots.js='+srcFp('js/14-bots.js')+'  js/15d-naval.js='+srcFp('js/15d-naval.js')+'  js/15e-navmodels.js='+srcFp('js/15e-navmodels.js')+'  js/00-config.js='+srcFp('js/00-config.js'));
line('模式: '+(QUICK?'--quick (缩短推演, 仅开发期用)':'完整验收')+'   沙箱: dev/probe-spawn.js 头部复用 (island=#11, steppe=#8)');
line('══════════════════════════════════════════════════════════════════════');
let r3,r1,r2,r2b,r4,r5,r6,r7,r8,r9;
const t0=Date.now();
try{ r3=want('3')?torpTable():{pass:true,skipped:true}; }catch(e){ line('③ 异常: '+(e&&e.stack||e)); r3={pass:false}; }
try{ r1=want('1')?boatApproach():{pass:true,skipped:true}; }catch(e){ line('① 异常: '+(e&&e.stack||e)); r1={pass:false}; }
try{ r2=want('2')?amphLanding():{pass:true,skipped:true}; }catch(e){ line('② 异常: '+(e&&e.stack||e)); r2={pass:false}; }
try{ r2b=want('2b')?batteryRuns():{pass:true,skipped:true}; }catch(e){ line('②b 异常: '+(e&&e.stack||e)); r2b={pass:false}; }
try{ r6=want('6')?swimCheck():{pass:true,skipped:true}; }catch(e){ line('⑥ 异常: '+(e&&e.stack||e)); r6={pass:false}; }
try{ r5=want('5')?purityCheck():{pass:true,skipped:true}; }catch(e){ line('⑤ 异常: '+(e&&e.stack||e)); r5={pass:false}; }
try{ r7=want('7')?alignRecount():{pass:true,skipped:true}; }catch(e){ line('⑦ 异常: '+(e&&e.stack||e)); r7={pass:false}; }
try{ r8=want('8')?friendlyFireCheck():{pass:true,skipped:true}; }catch(e){ line('⑧ 异常: '+(e&&e.stack||e)); r8={pass:false}; }
try{ r9=want('9')?realTurret():{pass:true,skipped:true}; }catch(e){ line('⑨ 异常: '+(e&&e.stack||e)); r9={pass:false}; }
try{ r4=want('4')?flashRuns():{pass:true,skipped:true}; }catch(e){ line('④ 异常: '+(e&&e.stack||e)); r4={pass:false}; }
line('');
line('══════════════════════════════════════════════════════════════════════');
line('验收汇总:');
line('  ① 艇离湾+会师+轮换   : '+(r1&&r1.pass?'PASS':'FAIL')+'   '+JSON.stringify(r1&&r1.cases||[]));
line('  ② 两栖车上岸+开火      : '+(r2&&r2.pass?'PASS':'FAIL')+'   上岸 t='+(r2&&r2.landT>=0?r2.landT.toFixed(1)+'s':'未上岸')+' 上岸后开火='+(r2&&r2.firesAfterLand)+' 次');
line('  ②b 岸炮 AI 移交        : '+(r2b&&r2b.pass?'PASS':'FAIL')+'   无同名残留+帧钩不驱动+15f仍驱动+A#9无人不开炮  (15f侧调用='+(r2b&&r2b.aiFifteenF)+', 帧钩增量='+(r2b&&r2b.hookDelta)+', batteryFire='+(r2b&&r2b.batFire)+')');
line('  ③ 鱼雷窗口过滤        : '+(r3&&r3.pass?'PASS':'FAIL')+'   带内 '+(r3&&r3.bandInOK)+'/'+(r3&&r3.bandIn)+' 可发射, 带外误发 舷角'+(r3&&r3.outAspectBad)+'/距离'+(r3&&r3.outDistBad)+', 边界 '+(r3&&r3.edgePass)+'/'+(r3&&r3.edgeN));
line('  ④ 3 局无 >3m 非重生位移: '+(r4&&r4.pass?'PASS':'FAIL')+'   '+JSON.stringify((r4&&r4.runs||[]).map(x=>({局:x.name.split(' ')[0],事件:x.events,非重生:x.notSpawn,可见闪现:x.vis,峰值:x.maxD}))));
line('  ⑤ 载具对象零污染      : '+(r5&&r5.pass?'PASS':'FAIL')+'   新增非允许字段='+JSON.stringify((r5&&r5.added)||[]));
line('  ⑥ 乘员落水游泳态      : '+(r6&&r6.pass?'PASS':'FAIL')+'   swim=true 帧='+(r6&&r6.sawSwim)+'/'+(r6&&r6.total)+', 陆上误判='+(r6&&r6.drySwim));
line('  ⑦ 夹具对齐复算        : '+(r7&&r7.pass?'PASS':'FAIL')+'   '+JSON.stringify((r7&&r7.rows||[]).map(x=>({例:x.tag,minShore:x.minShore,搁浅帧:x.groundFrames,tReach:x.tReach,上岸:x.landT,开火:x.firesAfter,AI帧:x.aiFrames}))));
line('  ⑧ 归属过滤/友伤        : '+(r8&&r8.pass?'PASS':'FAIL')+'   '+JSON.stringify((r8&&r8.rows||[]).map(x=>({队:x.team,炮位帧:x.bat,ATGUNS帧:x.atgun,自家工事帧:x.own,ok:x.ok}))));
line('  ⑨ 真炮塔360°+炮手链   : '+(r9&&r9.pass?'PASS':'FAIL')+'   '+(r9&&r9.tur?('正后方对齐 t='+r9.tur.tAlign+'s 开火 t='+r9.tur.tFire+'s maxΔ='+r9.tur.maxStep+'≤'+r9.tur.bound+' 炮手镜fov='+r9.pv.gun.fov+' 机位误差='+r9.pv.gun.distToSight+'m'):'(跳过)'));
line('  总判定: '+((r1&&r1.pass&&r2&&r2.pass&&r2b&&r2b.pass&&r3&&r3.pass&&r4&&r4.pass&&r5&&r5.pass&&r6&&r6.pass&&r7&&r7.pass&&r8&&r8.pass&&r9&&r9.pass)?'PASS':'FAIL')+'   wall='+(Date.now()-t0)+'ms');
