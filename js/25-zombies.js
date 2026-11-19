'use strict';
// ─────────────────────────────────────────────
// 25-zombies.js —— 丧尸模式 (2026-10-06 设计定稿 §3, 用户七裁定)
// 载入序: 23b-worldrestore 之后、24-main 之前 (24 主循环每帧调 zombieFrameTick)。
// 架构: Zombie extends Bot (入 soldiers/combatants ⇒ 命中检测/小地图/布娃娃全链复用),
//       覆写 setClass(无枪械链)/damage/die(零票务)/update(自绘脑FSM)/updateMesh(双臂前伸)。
// 票务红线: 学 capCrew (14-bots die ★2026-10-04 F1) —— 丧尸/感染零票务副作用, 不进 fieldCount/占领/wipe。
// 裁定口径: ①游荡→见人奔跑→被打迁怒→丢失回游荡 ②只能近战高伤 ③被尸杀 Bot 原地尸变 ④玩家死亡走正常
//           流程但原地留尸 ⑤三变体 ⑥三阶段连续压迫+决战潮 ⑦单队撑时/多队活到最后 ⑧工事可被拆。
// 2026-10-07d 批 (用户四裁定: 扒车+自爆尸 / 提量+事件波 / 中立旗=ZP / 分两批):
//   ▸ 反坦克压力: 丧尸把载具当"大型猎物" —— 围车(besiege)→扒车(cling) 持续伤车 + 卡履带减速
//     (_zClingN, 15-vehicles 消费) + 车速>阈值甩落; 同轴机枪 3.4m 贴身死角 (turretAI 消费);
//     主炮对重尸解锁 (dh>14 防自炸)。碾压仍有效, 原则"停桩=车被慢慢拆掉" (State of Decay 口径)。
//   ▸ 自爆尸 (boomer): 第四变体, 靠近人/车 0.8s 引信 → explodeAt 对人 + 直伤载具 + 丧尸连锁。
//   ▸ 事件波 (surge, L4D 峰谷口径): 预警嘶吼 6s → 定向大波连刷 (runner 概率×1.6 + 移速×1.25)。
//   ▸ 提量: cap1 42→60 / every1 1.15→0.9 (rampT 540 不变)。
// ─────────────────────────────────────────────
const ZTEAM=2;                       // 丧尸假想队 (00-config 已按 ZOMBIE_MODE 给 TEAM_FACTION/uniformMats 挂档)
const ZOMBIES=[];
const PENDING_INFECTIONS=[];         // 待尸变队列: 阵亡后延迟苏醒 (防范围爆炸/巡飞弹/手雷同帧二次炸死双倍击杀)
const zStats={killed:0};             // 本局丧尸被消灭总数 (结算页 endTickets 丧尸行消费, 2026-10-07c)
const _zEye=V3(), _zDir=V3();        // 感知复用槽 (本文件自备, 不借 14-bots 的 _pvEye)
const ZCFG={
 ticketBleedRate:2.0,  // 全员覆灭但有票数时的自然流失速率 (2票/秒, 2026-10-11 用户裁定)
 aggroHold:6,          // 迁怒持续 (裁定: 被打→仇恨转攻击者)
 sight:28, sightRunner:34,
 meleeDmg:45, bruteDmg:80, bruteStructMul:3, meleeCd:1.1,
 chaseSpd:3.85,
 walker:{spd:1.85,hp:100}, runner:{spd:2.2,hp:60}, brute:{spd:1.1,hp:380,scale:1.12},
 // 自爆尸 (2026-10-07d): t=解锁秒 / p=刷出概率 / fuse=引信秒 / boomR=爆圈(对人) / vehDmg=贴身车伤(免装甲)
 //   / chainR=丧尸连锁半径 / runMul=引信冲刺倍率。hp 70: 步枪一两发点掉, 但贴身即引爆 —— 逼玩家保持距离。
 boomer:{spd:1.9,hp:70,t:180,p:0.06,fuse:0.8,boomR:7,vehDmg:180,chainR:6,runMul:1.5},
 zp:{kill:15,bruteKill:40,boomerKill:25,flag:100,start:200},
 solo:{surviveT:720}, teams:{surviveT:720}, surviveT:720,
 // 持续尸潮 (2026-10-11 用户需求: 挺过时限改 12 分钟, 曲线平滑, 难度挂钩):
 //   前1分钟温和期 → 1分钟后进入次高压 → 10分钟到达顶峰保持至12分钟通关。
 //   由 ZDIFF_PROFILES 分档控制不同难度 (新兵/老兵/精英) 的上下限、刷新间隔、变体解锁与事件波规模。
 ramp:{every0:1.8,everySub:1.0,everyPeak:0.45,cap0:30,capSub:55,capPeak:110,runnerT:60,bruteT:260,boomerT:180,runP:0.22,bruteP:0.13,boomP:0.06},
 // 事件波 (基准老兵档默认, 具体由 getZDiffCfg 动态覆写)
 surge:{firstT:60,everyMin:40,everyMax:65,tele:6,n0:20,n1:30,runMul:1.8,spdMul:1.35},
 // 扒车口径 (2026-10-07d): 环车半径 / 贴车距离(≤进 cling) / 每 tick 车伤 (walker/runner/brute, 免装甲直伤,
 //   tick 1.0s) / 甩落车速门 + 需持续秒。标定: 5 walker 围攻满血四号(1200) ≈ 80s 拆掉; 机动碾压/甩落可清。
 cling:{scanR:12,atR:2.8,dps:{walker:3,runner:2.5,brute:12},tossSpd:4.5,tossT:0.6},
 // HUD 档位标签 (纯强度刻度, 与刷怪解耦): 3/6/9 分钟换档名, 9~12 分钟为决战潮
 phaseTimes:[0,180,360,540],
 phaseNames:['尸潮渐起','围攻','白热','决战潮'],
};
// 难度分档档案 (2026-10-11 需求2 用户确认: 丧尸单体伤害与移速保持基准不变, 仅影响数量/刷新/解锁时机与事件波规模)
const ZDIFF_PROFILES = [
 // 0: 新兵 (Recruit)
 {
  cap0:20, capSub:40, capPeak:80,
  every0:2.2, everySub:1.4, everyPeak:0.65,
  runnerT:90, bruteT:360, boomerT:240,
  runP:0.15, bruteP:0.08, boomP:0.04,
  surge:{firstT:75,everyMin:50,everyMax:75,tele:6,n0:14,n1:20,runMul:1.5,spdMul:1.35}
 },
 // 1: 老兵 (Veteran)
 {
  cap0:30, capSub:55, capPeak:110,
  every0:1.8, everySub:1.0, everyPeak:0.45,
  runnerT:60, bruteT:260, boomerT:180,
  runP:0.22, bruteP:0.13, boomP:0.06,
  surge:{firstT:60,everyMin:40,everyMax:65,tele:6,n0:20,n1:30,runMul:1.8,spdMul:1.35}
 },
 // 2: 精英 (Elite)
 {
  cap0:40, capSub:70, capPeak:135,
  every0:1.4, everySub:0.8, everyPeak:0.32,
  runnerT:35, bruteT:180, boomerT:120,
  runP:0.30, bruteP:0.18, boomP:0.08,
  surge:{firstT:45,everyMin:32,everyMax:50,tele:6,n0:28,n1:40,runMul:2.0,spdMul:1.35}
 },
];
function getZDiffCfg(){
 const d=(typeof SETTINGS!=='undefined'&&SETTINGS.diff!==undefined)?clamp(SETTINGS.diff,0,2):1;
 return ZDIFF_PROFILES[d]||ZDIFF_PROFILES[1];
}
function getZCurrentCap(){
 const P=getZDiffCfg();
 if(zSurviveT<=60){
  const k=Math.max(0,zSurviveT/60);
  return Math.round(P.cap0+(P.capSub-P.cap0)*k);
 }
 if(zSurviveT<=600){
  const k=Math.min(1,(zSurviveT-60)/540);
  return Math.round(P.capSub+(P.capPeak-P.capSub)*k);
 }
 return P.capPeak;
}
function getZCurrentInterval(){
 const P=getZDiffCfg();
 if(zSurviveT<=60){
  const k=Math.max(0,zSurviveT/60);
  return P.every0+(P.everySub-P.every0)*k;
 }
 if(zSurviveT<=600){
  const k=Math.min(1,(zSurviveT-60)/540);
  return P.everySub+(P.everyPeak-P.everySub)*k;
 }
 return P.everyPeak;
}
// 全员死亡转化为丧尸规则判定 (2026-10-11 用户需求4):
// 新兵难度永不生效; 老兵难度 10 分钟后 (剩余 2 分钟时起) 生效; 精英难度 2 分钟后 (剩余 10 分钟时起) 生效。
function isFullInfectionActive(){
 if(typeof ZOMBIE_MODE==='undefined'||!ZOMBIE_MODE) return false;
 const d=(typeof SETTINGS!=='undefined'&&SETTINGS.diff!==undefined)?SETTINGS.diff:1;
 if(d===0) return false;           // 新兵: 永不生效
 if(d===1) return zSurviveT>=600; // 老兵: 10分钟后生效 (剩余2分钟时起)
 if(d===2) return zSurviveT>=120; // 精英: 2分钟后生效 (剩余10分钟时起)
 return false;
}
if(typeof window!=='undefined') window.isFullInfectionActive=isFullInfectionActive;
// ═══ Zombie 实体 ═══
class Zombie extends Bot{
constructor(x,z,kind){
 super(ZTEAM,0,'丧尸');
 this.zombie=true;
 this.kind=ZCFG[kind]?kind:'walker';
 const K=ZCFG[this.kind];
 this.zSpd=K.spd; this.maxHp=K.hp; this.hp=K.hp;
 this.alive=true; this.crouch=false; this.prone=false;
 this.pos.set(x,heightAt(x,z),z);
 this.yaw=rand(0,6.283);
 this.brain='shamble'; this.zTgt=null; this.aggroT=0;
 this.meleeT=0; this._swingT=0; this._zSeenT=-9; this.zPerT=rand(0,0.22);
 this.clusterT=rand(0,3); this._cx=x; this._cz=z;
 // 2026-10-07d: 扒车/自爆状态。zSpdMul=事件波移速乘子; clingVeh=所扒载具(置位期间免 vehiclePushSoldiers
 // 推离, 15-vehicles 单源豁免); fuseT≥0=自爆尸引信倒计时。
 this.zSpdMul=1; this.clingVeh=null; this.clingT=0; this.clingLx=0; this.clingLz=0;
 this.clingDmgT=0; this._tossT=0; this.zVehT=null; this.zVehT2=rand(0,0.4); this.fuseT=-1; this._chargePos=null;
 this.zDetourT=0; this.zDetourA=0;   // 侧向绕行 (2026-10-07d): 卡墙先蹭墙滑步, 绕不动才砸工事
 this.zPathCd=0; this._pendAtk=null; // 2026-10-28 修复批: NAV 寻路冷却 / 近战伤害延时账 (dt 驱动, 红线2 禁真实时钟)
 this.groanT=rand(1.5,5); this._riseT=1.2; this._lx=x; this._lz=z; this._blkT=0;
 if(this.mesh&&this.mesh.tag) this.mesh.tag.visible=false;
 if(this.kind==='brute'&&this.mesh) this.mesh.root.scale.set(K.scale,K.scale,K.scale);
 // 自爆尸标记: 腹部"脓包"球 (共享几何 + 独立材质 —— 独立即为单源: 全库只有这里建它)
 if(this.kind==='boomer'&&this.mesh&&this.mesh.root){
  if(!Zombie._boomGeo){ Zombie._boomGeo=new THREE.SphereGeometry(0.34,10,8); Zombie._boomMat=new THREE.MeshLambertMaterial({color:0xb9c93e,emissive:0x2a3208}); }
  const b=new THREE.Mesh(Zombie._boomGeo,Zombie._boomMat);
  b.position.set(0,1.02,0.24); this.mesh.root.add(b); this._boomBall=b;
 }
}
setClass(cls){ this.cls=0; }   // 丧尸无枪械/换装链: 压掉 Bot.setClass 的 TEAM_FACTION/WPN_DEFS 消费
damage(amt,attacker,isHead){
 if(!this.alive) return;
 if(attacker&&attacker.zombie) return;                      // 尸不伤尸
 if(this._riseT>0) return;                                  // ★ 起身/初生阶段免伤保护 (防爆炸余波/巡飞弹/火海同帧二次瞬杀)
 this.hp-=amt;
 this.flinchT=0.25;
 // 迁怒 (裁定③): 受击瞬间仇恨立即转移到攻击者 (无视视距)
 if(attacker&&!attacker.zombie){ this.zTgt=attacker; this.aggroT=nowT+ZCFG.aggroHold; this.brain='chase'; }
 if(typeof zAlertHorde==='function') zAlertHorde(this.pos.x,this.pos.z,attacker,40); // 连锁唤醒周围 40m 游荡丧尸
 if(this.hp<=0) this.die(attacker,isHead);
}
die(attacker,isHead){
 this.alive=false; this.zTgt=null; this._chargePos=null; this._pendAtk=null; this.deaths++;
 this.clingVeh=null; this.fuseT=-1; this.zVehT=null;   // 扒车/引信随死终结 (布娃娃接管表现)
 zStats.killed++;                   // 结算页"已消灭"计数 (2026-10-07c)
 // 零票务 (红线): 不扣 tickets / 不 noteDeath / 不进 wipe 计数 —— fieldCount 只认 team 0/1
 if(window.CANNON&&!deathFallMode()){ this.ragdolled=spawnRagdoll(this,attacker,isHead); if(this.ragdolled) this.mesh.root.visible=false; }   // 2026-11-20 批⑦: 就地倒下档走 else 既有 deathAnimT 倒地
 else { this.deathAnimT=0.6; }
 if(attacker){
  attacker.kills=(attacker.kills||0)+1;
  if(!attacker.isPlayer) attacker.score=(attacker.score||0)+SCORE_TABLE.kill;
  else if(typeof player!=='undefined'&&player&&attacker===player.specViewHost&&typeof onHostKill==='function'){ onHostKill(); }   // 真附身: 宿主杀丧尸红档 (无分, 2026-11-01)
  else { addKillfeed(attacker,this,isHead); onPlayerKill(this,isHead); }   // ZP 结算在 onPlayerKill
 }
 // 自爆尸殉爆 (2026-10-28 修复, 指导 §4.3(2)): 无论是引信到期 (zBoom 自杀支)、被枪弹击毙还是被
 // 连锁炸死, 一律当场起爆 —— 殉爆记在击杀者账上 (爆炸对人的归因走 explodeAt 的 src), 尸体照常退场。
 if(this.kind==='boomer') this.zBoomBlast(attacker||null);
 this._zGone=nowT+0.2;
}
update(dt){
 if(!this.alive) return;
 // 近战伤害延时结算 (2026-10-28 修复, 指导 §4.3(1)): 旧 setTimeout(380) 脱离游戏主时钟 —— 暂停
 // (K 时停/布势帧长门) 期间照常到点受创。改挂实例账 _pendAtk 由 dt 积分驱动; 结算时补齐**三维门**
 // (水平 <2.6 且高度差 dy<1.8) —— 旧判据只有水平距离, 隔着数米高台/楼板的"隔空抓杀"病根在此。
 if(this._pendAtk){
  this._pendAtk.timer-=dt;
  if(this._pendAtk.timer<=0){
   const t=this._pendAtk.tgt; this._pendAtk=null;
   if(t&&t.alive&&!t.zombie){
    const dx=t.pos.x-this.pos.x, dz=t.pos.z-this.pos.z, dy=Math.abs(t.pos.y-this.pos.y);
    if(Math.hypot(dx,dz)<2.6&&dy<1.8){
     const dmg=(this.kind==='brute')?ZCFG.bruteDmg:ZCFG.meleeDmg;
     t.damage(dmg,this,false);
     if(AudioSys.click) AudioSys.click(320,0.5,0.1);
    }
   }
  }
 }
 // 低吼 (一次性合成音, 无循环源 ⇒ endMatch stopAll 链零负担)
 this.groanT-=dt;
 if(this.groanT<=0){ this.groanT=rand(2.5,6.5); const d=this.pos.distanceTo(camera.position); if(d<48&&AudioSys.zgroan) AudioSys.zgroan(d); }
 // 丢失仇恨 (裁定③): 目标死/超距/迁怒到期 → 回游荡
 if(this.zTgt){
  const t=this.zTgt;
  const d=Math.hypot(t.pos.x-this.pos.x,t.pos.z-this.pos.z);
  const gone=!t.alive||t.zombie||d>46||nowT>this.aggroT||(t.isPlayer&&(t.spectator||!t.alive));
  if(gone){ this.zTgt=null; this.brain='shamble'; }
 } else if(this._chargePos&&nowT>this.aggroT){
  this._chargePos=null; this.brain='shamble';
 }
 // 感知 (0.22s 节流, 裁定②): 视距内最近人类 → 奔跑追击 (无 FOV 门: 尸不转头; 烟/庄稼遮蔽复用)
 this.zPerT-=dt;
 if(this.zPerT<=0){
  this.zPerT=0.22;
  const visR=(this.kind==='runner')?ZCFG.sightRunner:ZCFG.sight;
  let best=null,bd=1e9;
  for(const c of combatants){
   if(!c.alive||c.zombie||c.onVehicle) continue;
   if(c.isPlayer&&c.spectator) continue;
   const dx=c.pos.x-this.pos.x,dz=c.pos.z-this.pos.z;
   const d=Math.hypot(dx,dz);
   if(d>visR||d>=bd) continue;
   const ty=c.pos.y+(c.crouch?1.0:1.4);
   if(SMOKES.length&&smokeBlocksLOS(this.pos.x,this.pos.y+1.5,this.pos.z,c.pos.x,ty,c.pos.z)) continue;
   if(CROP_FIELDS.length&&cropBlocksLOS(this.pos.x,this.pos.y+1.5,this.pos.z,c.pos.x,ty,c.pos.z)) continue;
   // 墙体遮挡 (与 Bot perceive 同口径 raycastWorld): 丧尸不透视房屋
   const _dy=(ty-(this.pos.y+1.5))/Math.max(d,0.1);
   const _bl=raycastWorld(_zEye.set(this.pos.x,this.pos.y+1.5,this.pos.z),_zDir.set(dx/d,_dy,dz/d),d);
   if(_bl&&_bl.dist<d-0.6) continue;
   bd=d; best=c;
  }
  if(best){
   const enterChase=(this.brain!=='chase');
   // ★2026-11-03 修 (实机"丧尸对火力点 gunner 完全忽视"主根因之一): 旧门 zTgt!==best 让"重见同一个目标"
   //   永远救不回 chase —— 钉死在炮位的 gunner 一拍没看见被丢 (见下) 后, 丧尸从旁边走过去也不理。
   //   现在只要视野里有人就回 chase (同目标/新目标一视同仁)。
   if(this.brain!=='chase') this.brain='chase';
   if(!this.zTgt||bd<Math.hypot(this.zTgt.pos.x-this.pos.x,this.zTgt.pos.z-this.pos.z)-2) this.zTgt=best;
   if(this.zTgt===best) this.aggroT=nowT+ZCFG.aggroHold;   // 视线保持=刷新仇恨窗 (否则 aggroT 到期先在 zTgt 分支掉, 靠 0.22s 后的重锁续命)
   this._chargePos=null;
   this._zSeenT=nowT;
   if(enterChase&&typeof zAlertHorde==='function') zAlertHorde(this.pos.x,this.pos.z,best,40);
  } else if(this.brain==='chase'&&nowT-this._zSeenT>6){
   // ★2026-11-03 修 (主根因之二): 旧式 (this.zTgt?0:this._zSeenT) 在 zTgt 存活时恒为 nowT-0>6 —— 页面墙钟
   //   开局 6s 后恒真 ⇒ 追击中**一拍**没看见立即丢恨回游荡, 注释宣称的"脱见 6s"实际宽限=0s。真给 6s。
   this.brain='shamble';   // 追击中脱见 6s → 丢恨回游荡 (迁怒目标仍在则由 zTgt 分支接管)
  }
 }
  // 聚集点 (3s 重算): 存活人类质心 —— 多队时挑选离自身最近的队伍质心, 绝不跨队伍平均至地图中心无人区 (2026-10-10)
  this.clusterT-=dt;
  if(this.clusterT<=0){
   this.clusterT=rand(2.6,3.4);
   let t0x=0,t0z=0,n0=0, t1x=0,t1z=0,n1=0;
   for(const c of combatants){
    if(!c.alive||c.zombie||c.onVehicle) continue;
    if(c.isPlayer&&c.spectator) continue;
    if(c.team===0){ t0x+=c.pos.x; t0z+=c.pos.z; n0++; }
    else if(c.team===1){ t1x+=c.pos.x; t1z+=c.pos.z; n1++; }
   }
   if(n0>0&&n1>0){
    const d0=Math.hypot(t0x/n0-this.pos.x,t0z/n0-this.pos.z);
    const d1=Math.hypot(t1x/n1-this.pos.x,t1z/n1-this.pos.z);
    if(d0<=d1){ this._cx=t0x/n0; this._cz=t0z/n0; }
    else { this._cx=t1x/n1; this._cz=t1z/n1; }
   }else if(n0>0){ this._cx=t0x/n0; this._cz=t0z/n0; }
   else if(n1>0){ this._cx=t1x/n1; this._cz=t1z/n1; }
   else { this._cx=0; this._cz=0; }
  }

 // 载具猎物扫描 (2026-10-07d, 0.5s 节流): 扫描半径内最近活载具 (tanks+trucks)。
 // 人优先: chase 目标健在时不打断 (先扑能咬到的); 目标丢失/游荡态才转围车。boomer 对人/车都起引信。
 this.zVehT2-=dt;
 if(this.zVehT2<=0){
  this.zVehT2=0.5;
  if(!this.zTgt||!this.zTgt.alive){
   this.zVehT=null;
   let bd=ZCFG.cling.scanR;
   const scan=list=>{ if(typeof list==='undefined'||!list) return;
    for(const v of list){ if(!v||!v.alive) continue;
     const d=Math.hypot(v.pos.x-this.pos.x,v.pos.z-this.pos.z);
     if(d<bd){ bd=d; this.zVehT=v; } } };
   scan(typeof tanks!=='undefined'?tanks:null);
   scan(typeof trucks!=='undefined'?trucks:null);
  }
 }
 // 行为层 (2026-10-07d 优先级: 自爆引信 > 扒车 cling > 追人 chase > 围车 besiege > 游荡 shamble)
 let wantSpd=0;
 if(this.fuseT>=0){
  // 自爆尸引信: 朝最近目标 (人>车>人味) 全速冲刺, 到点即爆 (zBoomTick 内终结)
  const B=ZCFG.boomer;
  let tx=this._cx, tz=this._cz;
  if(this.zTgt&&this.zTgt.alive){ tx=this.zTgt.pos.x; tz=this.zTgt.pos.z; }
  else if(this.zVehT&&this.zVehT.alive){ tx=this.zVehT.pos.x; tz=this.zVehT.pos.z; }
  const bdx=tx-this.pos.x, bdz=tz-this.pos.z;
  this.yaw=angleLerpTo(this.yaw,Math.atan2(bdx,bdz),6*dt);
  wantSpd=this.zSpd*B.runMul*this.zSpdMul;
  this.moveDir(this.zDir(this.yaw),wantSpd,dt);
  this._swingT=0.2;
  this.fuseT-=dt;
  if(this.fuseT<=0) this.zBoom();
 } else if(this.clingVeh){
  this.zClingTick(dt);   // 扒车中: 跟挂点/伤车/甩落判定 (自足分支, 不走路)
 } else if(this.brain==='chase'&&this.zTgt){
  const t=this.zTgt;
  const dx=t.pos.x-this.pos.x, dz=t.pos.z-this.pos.z, d=Math.hypot(dx,dz);
  this.faceTo(t.pos,dt,6);
  wantSpd=((this.kind==='runner')?ZCFG.runner.spd+1.6:(this.kind==='brute')?ZCFG.brute.spd+0.6:ZCFG.chaseSpd)*this.zSpdMul;
  if(d>1.9) this.moveDir(this.zDir(Math.atan2(dx,dz)),wantSpd,dt);
  else { this.vel.x*=0.6; this.vel.z*=0.6; }
  if(this.kind==='boomer'&&d<3.0) this.zFuse();       // 自爆尸: 贴人即引信 (不近战)
  else if(d<2.2) this.zMelee(t);
 } else if(this.brain==='chase'&&this._chargePos){
  const cp=this._chargePos;
  const dx=cp.x-this.pos.x, dz=cp.z-this.pos.z, d=Math.hypot(dx,dz);
  this.yaw=angleLerpTo(this.yaw,Math.atan2(dx,dz),6*dt);
  wantSpd=ZCFG.chaseSpd*this.zSpdMul;
  if(d>2.5) this.moveDir(this.zDir(Math.atan2(dx,dz)),wantSpd,dt);
  else { this._chargePos=null; this.brain='shamble'; }
 } else if(this.zVehT&&this.zVehT.alive){
  // 围车 besiege (2026-10-07d): 朝载具推进; boomer 到 3.2m 起爆, 其余贴车进 cling
  const v=this.zVehT;
  const dx=v.pos.x-this.pos.x, dz=v.pos.z-this.pos.z, d=Math.hypot(dx,dz);
  this.faceTo(v.pos,dt,6);
  const fuseD=(this.kind==='boomer')?3.2:ZCFG.cling.atR+0.4;
  if(d>fuseD){ wantSpd=this.zSpd*(this.kind==='boomer'?1.15:1)*this.zSpdMul; this.moveDir(this.zDir(Math.atan2(dx,dz)),wantSpd,dt); }
  else if(this.kind==='boomer') this.zFuse();
  else this.zCling(v);
 } else {
  const dx=this._cx-this.pos.x, dz=this._cz-this.pos.z, d=Math.hypot(dx,dz);
  if(d>6){
   const want=Math.atan2(dx,dz)+Math.sin(nowT*0.7+this.wanderSeed)*0.55;   // 游荡摆头 (低智力口径)
   this.yaw=angleLerpTo(this.yaw,want,3*dt);
   wantSpd=this.zSpd*this.zSpdMul;
   this.moveDir(this.zDir(this.yaw),wantSpd,dt);
  } else { this.vel.x*=0.7; this.vel.z*=0.7; this.yaw+=dt*0.3; }
 }
 // 卡住 → 绕行/拆工事 (2026-10-07d 用户: "连绕路都不会"): 卡 0.55s 先侧向绕 —— ±90° 里挑
 // occBlocked 放行的一侧绕 0.8s (方向经 zDir() 注入行为层, 不双移); 绕完仍卡 (>1.6s) 才抡臂砸前方
 // 结构 (重尸 3×) —— 低智力但有最基本的贴墙滑步。
 if(wantSpd>1){
  const moved=Math.hypot(this.pos.x-this._lx,this.pos.z-this._lz);
  if(moved<wantSpd*dt*0.25+0.01) this._blkT+=dt; else this._blkT=Math.max(0,this._blkT-dt*2);
  if(this.zDetourT>0) this.zDetourT-=dt;
 if(this._blkT>0.55&&this.zDetourT<=0){
  const lft=this.yaw-HPI, rgt=this.yaw+HPI;
  const lOK=!occBlocked(this.pos.x+Math.sin(lft)*2.4,this.pos.z+Math.cos(lft)*2.4);
  const rOK=!occBlocked(this.pos.x+Math.sin(rgt)*2.4,this.pos.z+Math.cos(rgt)*2.4);
  this.zDetourA=(lOK&&rOK)?(Math.random()<0.5?lft:rgt):(lOK?lft:(rOK?rgt:this.yaw+Math.PI));
  this.zDetourT=0.8;
 }
 // NAV 局部寻路 (2026-10-28 修复, 指导 §4.2(2)): 蹭墙滑步仍卡 (>1.0s) 且目标在 8m 外时, 借 NAV.findPath
 // 取前 2~3 个路标拐过建筑转角, 之后切回直线冲锋。不做每帧 A*: 冷却 6s/只 + 全局每帧 3 次预算
 // (尸潮百只同帧撞墙时把寻路错峰, 其余只半秒后重试)。
 this.zPathCd-=dt;
 if(this._blkT>1.0&&this.zDetourT<=0&&this.zPathCd<=0&&typeof NAV!=='undefined'&&NAV.findPath){
  const tx=(this.zTgt&&this.zTgt.alive)?this.zTgt.pos.x:this._cx;
  const tz=(this.zTgt&&this.zTgt.alive)?this.zTgt.pos.z:this._cz;
  if(Math.hypot(tx-this.pos.x,tz-this.pos.z)>8){
   if(zPathWinT!==nowT){ zPathWinT=nowT; zPathWinN=0; }
   if(zPathWinN>=3){ this.zPathCd=0.5; }
   else{
    zPathWinN++;
    const wp=NAV.findPath(this.pos.x,this.pos.z,tx,tz);
    this.zPathCd=6;
    if(wp&&wp.length>1){
     const k=Math.min(2,wp.length-1);
     this._chargePos={x:wp[k][0],z:wp[k][1]};
     this.brain='chase';
     this.aggroT=nowT+ZCFG.aggroHold;
     this._zSeenT=nowT;   // 寻路充能同 zAlertHorde 口径: 刷 6s chase 窗, 免感知节拍当场打回 shamble
     this._blkT=0; this.zDetourT=0;
    }
   }
  }
 }
  if(this._blkT>1.6&&this.zDetourT<=0){
   this._blkT=0; this._swingT=0.4;
   const px=this.pos.x+Math.sin(this.yaw)*1.3, pz=this.pos.z+Math.cos(this.yaw)*1.3;
   const amt=(this.kind==='brute')?ZCFG.meleeDmg*ZCFG.bruteStructMul:ZCFG.meleeDmg;
   damageStructures(V3(px,this.pos.y+1,pz),2.0,amt,this);
  }
 } else { this._blkT=0; this.zDetourT=0; }
 this._lx=this.pos.x; this._lz=this.pos.z;
 this.updateMesh(dt,Math.hypot(this.vel.x,this.vel.z));
}
zDir(a){ return this.zDetourT>0?this.zDetourA:a; }   // 绕行方向注入 (单点过滤, 行为层不双移)
zMelee(t){
 if(this.meleeT>0) return;
 this.meleeT=ZCFG.meleeCd; this._swingT=0.4;
 // 伤害延时挂账 (2026-10-28): 结算在 update() 头部 _pendAtk 支 —— dt 驱动 + 三维门, 不再用 setTimeout
 this._pendAtk={tgt:t,timer:0.38};
}
// ── 扒车链 (2026-10-07d): 贴车 → cling(挂点跟随+周期伤车) → 车速甩落/时限松手 ──
// 豁免链: clingVeh 置位期间 vehiclePushSoldiers 不推 (15-vehicles 单源), 故能"挂得住";
// 伤车走 takeDmg(...,ap=true) 免装甲直伤 + 盖 lastDmgT 停掉"无人检修回血"。
zCling(v){
 this.clingVeh=v; this.brain='cling';
 this.clingLx=(Math.random()<0.5?-1:1)*1.9;       // 车侧挂点 (局部): 半宽+0.3 一线
 this.clingLz=rand(-2.0,2.0);
 this.clingT=rand(4,7); this.clingDmgT=0.5; this._tossT=0;
}
zClingTick(dt){
 const v=this.clingVeh, C=ZCFG.cling;
 if(!v||!v.alive){ this.zEndCling(); return; }
 // 跟挂点: 车体局部 → 世界 (yaw 旋转), 贴车侧
 const sn=Math.sin(v.yaw), cs=Math.cos(v.yaw);
 this.pos.set(v.pos.x+cs*this.clingLx+sn*this.clingLz, v.pos.y+0.15, v.pos.z-sn*this.clingLx+cs*this.clingLz);
 this.yaw=v.yaw+(this.clingLx>=0?-HPI:HPI);       // 面向车身
 this.clingDmgT-=dt;
 if(this.clingDmgT<=0&&typeof v.takeDmg==='function'){
  this.clingDmgT=1.0;
  this._swingT=0.4;
  v.takeDmg(C.dps[this.kind]||C.dps.walker,this,true);
  v.lastDmgT=nowT;
 }
 // 甩落: 车速持续超门 → 摔下带小伤 —— 机动碾压/急加速是玩家解围正解
 if(Math.abs(v.vel||0)>C.tossSpd){
  this._tossT+=dt;
  if(this._tossT>=C.tossT){
   this.zEndCling();
   this.damage(15,null,false);
   const a=rand(0,6.2832);
   this.pos.x+=Math.cos(a)*1.4; this.pos.z+=Math.sin(a)*1.4;
   return;
  }
 } else this._tossT=Math.max(0,this._tossT-dt);
 this.clingT-=dt;
 if(this.clingT<=0) this.zEndCling();   // 扒够了松手歇口气 (给机枪/队友拆头窗口)
}
zEndCling(){ this.clingVeh=null; this.brain='shamble'; this.zVehT=null; this._tossT=0; }
// ── 自爆尸 (2026-10-07d): 贴人/贴车 0.8s 引信 → 对人 explodeAt + 直伤载具 + 丧尸连锁 ──
zFuse(){
 if(this.fuseT>=0) return;
 this.fuseT=ZCFG.boomer.fuse;
 if(AudioSys.zgroan) AudioSys.zgroan(this.pos.distanceTo(camera.position));
 if(typeof spawnP==='function') spawnP(PT.flash,this.pos.x,this.pos.y+1.2,this.pos.z,0,1,0,0.6,4,0.25,1,0,true);
}
zBoom(){
 if(!this.alive) return;
 const B=ZCFG.boomer;
 const boomTgt=(this.zTgt&&this.zTgt.alive&&!this.zTgt.zombie)?this.zTgt:null;
 this.alive=false; this.zTgt=null; this.deaths++; this._zGone=nowT+0.2;   // 自我退场: 无击杀者/无 ZP/无布娃娃
 if(this.mesh&&this.mesh.root) this.mesh.root.visible=false;
 this.zBoomBlast(this);   // 引信到期的归因主体=自己 (旧口径不变); 爆圈/伤车/连锁在 zBoomBlast 单源
 if(typeof zAlertHorde==='function') zAlertHorde(this.pos.x,this.pos.z,boomTgt,40); // 自爆起爆唤醒周围 40m 游荡丧尸
}
// 爆圈单源 (2026-10-28): 引信到期 (zBoom) 与被杀殉爆 (die) 共用 —— 对人 explodeAt + 载具直伤 + 丧尸连锁。
// src=归因主体 (zBoom 传自己 / die 传击杀者, 链式殉爆 die(null) 传 null 退化为自归因)。
zBoomBlast(src){
 const B=ZCFG.boomer;   // 2026-11-13 fix: hoisted to fn scope - chain loop below reads B.chainR but old decl sat inside if(!this._boomDone) block (ReferenceError on every boomer blast)
 if(!this._boomDone){
  this._boomDone=true;
  const p=V3(this.pos.x,this.pos.y+0.9,this.pos.z);
  explodeAt(p,src||this,B.boomR);
  // 载具直伤 (explodeAt 不伤车 — 手雷契约单源不动): 9m 内线性衰减, 免装甲
  const hitVeh=list=>{ if(typeof list==='undefined'||!list) return;
   for(const v of list){ if(!v||!v.alive||typeof v.takeDmg!=='function') continue;
    const d=Math.hypot(v.pos.x-this.pos.x,v.pos.z-this.pos.z);
    if(d<9) v.takeDmg(B.vehDmg*(1-d/12),this,true); } };
  hitVeh(typeof tanks!=='undefined'?tanks:null);
  hitVeh(typeof trucks!=='undefined'?trucks:null);
 }
 // 丧尸连锁: explodeAt 同队 ×0 + Zombie.damage 尸不伤尸 ⇒ 绕开两者直扣血 (die(null) 无击杀者)。
 // 连锁炸死别的自爆尸 → 它们的 die() 再各自殉爆 (alive 守卫保证每只只炸一次, 链有限步终结)。
 for(const z of ZOMBIES){
  if(z===this||!z.alive) continue;
  const d=Math.hypot(z.pos.x-this.pos.x,z.pos.z-this.pos.z);
  if(d<B.chainR){ z.hp-=(1-d/B.chainR)*90; if(z.hp<=0) z.die(null,false); }
 }
}
// 双臂前伸 + 正常腿部动画 (裁定: 腿正常走, 双臂总向前探) —— 自绘轻量姿态, 不走 Bot 枪械姿态分支
updateMesh(dt,speed){
 const m=this.mesh;
 m.root.position.copy(this.pos);
 m.root.rotation.set(0,this.yaw,0);
 m.pelvis.position.y=dampF(m.pelvis.position.y,0.94,10,dt);
 m.pelvis.rotation.x=dampF(m.pelvis.rotation.x,0.18,8,dt);     // 尸体前倾
 m.pelvis.rotation.y=dampF(m.pelvis.rotation.y,0,7,dt);
 m.headG.rotation.y=0;
 // 尸变起身 (0.9s): 从地里爬起 + 屈膝
 if(this._riseT>0){
  this._riseT-=dt;
  const k=clamp(1-Math.max(this._riseT,0)/1.2,0,1);
  m.root.position.y-=1.1*(1-k);
  m.pelvis.position.y=Math.min(m.pelvis.position.y,0.3+0.64*k);
 }
 this.animT+=dt*(2.2+speed*1.9);
 const t=this.animT,S=Math.sin(t);
 const sw=clamp(speed/4,0,1.3)*0.62;
 const hpNow=m.pelvis.position.y;
 const LL=this.legIK(hpNow,0.03+Math.max(0,S)*0.3*sw,S*0.45*sw,false);
 const RR=this.legIK(hpNow,0.03+Math.max(0,-S)*0.3*sw,-S*0.45*sw,false);
 const pp=m.pelvis.rotation.x;
 m.legL.hip.rotation.x=dampF(m.legL.hip.rotation.x,LL.hip-pp,10,dt);
 m.legR.hip.rotation.x=dampF(m.legR.hip.rotation.x,RR.hip-pp,10,dt);
 m.legL.knee.rotation.x=dampF(m.legL.knee.rotation.x,LL.knee,10,dt);
 m.legR.knee.rotation.x=dampF(m.legR.knee.rotation.x,RR.knee,10,dt);
 // 双臂前伸: 肩前举 ~85° 交叠探前, 随步频轻摆; 挥击窗口右臂下劈
 const reach=HPI*0.94+Math.sin(t*0.5)*0.06;
 let rSw=reach+Math.sin(t)*0.05;
 if(this._swingT>0){ this._swingT-=dt; rSw=reach-0.35+1.1*(1-Math.max(this._swingT,0)/0.4); }
 m.armR.sh.rotation.x=dampF(m.armR.sh.rotation.x,-rSw,10,dt);
 m.armL.sh.rotation.x=dampF(m.armL.sh.rotation.x,-reach-Math.sin(t)*0.05,10,dt);
 m.armR.sh.rotation.z=dampF(m.armR.sh.rotation.z,0.14,8,dt);
 m.armL.sh.rotation.z=dampF(m.armL.sh.rotation.z,-0.14,8,dt);
 m.armR.elm.rotation.x=dampF(m.armR.elm.rotation.x,-0.18,8,dt);
 m.armL.elm.rotation.x=dampF(m.armL.elm.rotation.x,-0.18,8,dt);
}
}
// ═══ 感染链 ═══
// Bot 被丧尸击杀 → 原地尸变 (14-bots die() 头部钩子调进来; 玩家版本在 18-game die 尾部)
// 2026-10-11 用户裁定修复: 允许消耗票数重生, 感染扣除兵力票, 重置 respawnT 进重生循环;
// 人类尸体转为丧尸 (不留布娃娃死尸), 场上无存活人员但有票数时进入票数自然流失状态。
function zombieInfect(sol,attacker){
 const isZAttacker=attacker&&attacker.zombie;
 const fullActive=typeof isFullInfectionActive==='function'&&isFullInfectionActive();
 if(!isZAttacker&&!fullActive) return;
 sol.alive=false;
 sol.deaths=(sol.deaths||0)+1;
 sol.deathAnimT=0;
 let rag=null;
 if(window.CANNON&&typeof spawnRagdoll==='function'&&!deathFallMode()){   // 2026-11-20 批⑦: 就地倒下档走 else 既有倒地
  rag=spawnRagdoll(sol,attacker,false);
 }
 if(rag){
  sol.ragdolled=true;
  sol.mesh.root.visible=false;
 } else {
  sol.ragdolled=false;
  sol.deathAnimT=1.5;
 }
 sol.respawnT=rand(7,11); // 允许消耗票数重生 (2026-10-11 用户裁定: 仍可消耗票数重生; 2026-11-10 capCrew 分支随大舰子系统下架摘除)
 if(sol.mgUse){ releaseEmpl(sol.mgUse,true); sol.mgUse=null; }
 if(sol.empUse){ releaseEmpl(sol.empUse,true); sol.empUse=null; }
 if(sol.mortUse){ releaseEmpl(sol.mortUse,true); sol.mortUse=null; }
 if(sol.batUse){ sol.releaseBattery(); }
 if(sol.targetVeh){ if(sol.targetVeh.claimBot===sol) sol.targetVeh.claimBot=null; sol.targetVeh=null; }
 if(sol.onVehicle){ if(sol.onVehicle.crewBot===sol) sol.onVehicle.crewBot=null; sol.onVehicle=null; }
 if(typeof sol.chuteClear==='function') sol.chuteClear();
 sol.state='idle'; sol.target=null; sol.pushPt=null; sol.coverPt=null;
 if(typeof noteDeath==='function') noteDeath(sol.pos.x,sol.pos.z);
 tickets[sol.team]=Math.max(0,tickets[sol.team]-1); // 丧尸转化扣除兵力票 (消耗票数重生)
 if(attacker){
  attacker.kills=(attacker.kills||0)+1;
  if(!attacker.isPlayer) attacker.score=(attacker.score||0)+SCORE_TABLE.kill;
  else { addKillfeed(attacker,sol,false); onPlayerKill(sol,false); }
  if(!attacker.isPlayer&&typeof addKillfeed==='function') addKillfeed(attacker,sol,false);
 }
 queueZombieInfect(sol.pos.x,sol.pos.z,Math.random()<0.18?'runner':'walker',1.4,rag,sol);
}
function queueZombieInfect(x,z,kind,delay=1.4,ragRef=null,solRef=null){
 PENDING_INFECTIONS.push({x,z,kind:kind||'walker',t:Math.max(0.1,delay),rag:ragRef||null,sol:solRef||null});
}
function flushZombieInfections(){
 while(PENDING_INFECTIONS.length>0){
  const inf=PENDING_INFECTIONS.shift();
  if(inf.rag&&typeof removeRagdoll==='function') removeRagdoll(inf.rag);
  if(inf.sol&&inf.sol.mesh&&inf.sol.mesh.root) inf.sol.mesh.root.visible=false;
  const zw=spawnZombie(inf.x,inf.z,inf.kind);
  if(zw) zw._riseT=1.2;
 }
}
if(typeof window!=='undefined'){
 window.queueZombieInfect=queueZombieInfect;
 window.flushZombieInfections=flushZombieInfections;
}

function spawnZombie(x,z,kind){
 const zw=new Zombie(x,z,kind);
 ZOMBIES.push(zw);
 return zw;
}
// ═══ 连锁唤醒 (Horde Call / Aggro Alert, 2026-10-09 需求1) ═══
// 当丧尸受到伤害、进入追击 chase、或自爆 boomer 起爆时, 唤醒周围 40m 内处于游荡 shamble 的其他丧尸
function zAlertHorde(srcX,srcZ,target,radius=40){
 const nearH=zNearestHuman(srcX,srcZ);
 const t=(target&&target.alive&&!target.zombie)?target:(nearH&&Math.hypot(nearH.pos.x-srcX,nearH.pos.z-srcZ)<80?nearH:null);
 for(const z of ZOMBIES){
  if(!z||!z.alive||z.brain!=='shamble') continue;
  const d=Math.hypot(z.pos.x-srcX,z.pos.z-srcZ);
  if(d>radius) continue;
  if(t&&t.alive&&!t.zombie){
   z.zTgt=t;
   z._chargePos=null;
   z.aggroT=nowT+ZCFG.aggroHold;
   z.brain='chase';
   z._zSeenT=nowT;
   z.yaw=Math.atan2(t.pos.x-z.pos.x,t.pos.z-z.pos.z);
  } else {
   z.zTgt=null;
   z._chargePos={x:srcX,z:srcZ};
   z.aggroT=nowT+ZCFG.aggroHold;
   z.brain='chase';
   z._cx=srcX;
   z._cz=srcZ;
   z.clusterT=4;
   z.yaw=Math.atan2(srcX-z.pos.x,srcZ-z.pos.z);
  }
 }
}
// ═══ 刷怪导演 (持续尸潮, 2026-10-07b 撤三大波) ═══
let zInit=false,zSurviveT=0,zPhase=-1,zSpawnCd=2,zSweepT=0.5;
// NAV 局部寻路全局限流 (2026-10-28): 每帧最多 3 次 findPath (nowT 换帧即重置), 错峰百尸同帧撞墙
let zPathWinT=-1,zPathWinN=0;
// 事件波状态机 (2026-10-07d): 0=静默期(倒计时) / 1=预警嘶吼(tele 秒) / 2=大波连刷(zSurgeLeft 只)
let zSurgeState=0,zSurgeT=0,zSurgeLeft=0,zSurgeCd=0;
let zFullInfectWarned=false;
const zElim=[false,false];
let zHudEl=null,zHudT=0;
function zombieMatchStart(){
 zInit=true; zSurviveT=0; zPhase=-1; zSpawnCd=2; zElim[0]=zElim[1]=false;
 zSurgeState=0; zSurgeT=0; zSurgeLeft=0; zSurgeCd=0;   // zSurgeT=0: 过 firstT 后立即可预警 (首次波不被静默期再拖 90s)
 zFullInfectWarned=false;
 ZOMBIES.length=0;
 PENDING_INFECTIONS.length=0;
 zStats.killed=0;
 player.pz=ZCFG.zp.start;
 if(!zHudEl){
  zHudEl=document.getElementById('zHudEl');
  if(!zHudEl){
   zHudEl=document.createElement('div');
   zHudEl.id='zHudEl';
   zHudEl.className='zombie-hud-pill';
   const tb=document.getElementById('topBar');
   const cp=document.getElementById('compass');
   if(tb&&cp) tb.insertBefore(zHudEl,cp);
   else {
    const ui=document.getElementById('ui');
    if(ui) ui.appendChild(zHudEl); else document.body.appendChild(zHudEl);
   }
  }
 }
 if(zHudEl){
  zHudEl.classList.remove('hidden');
  zHudEl.style.display='inline-block';
 }
 const tEl=document.getElementById('timeTxt');
 if(tEl) tEl.style.display='none';
 updateZpHud();
 addKillMsg(t('☣ 尸潮将至 · 守住基地, 撑到最后'),0);
}
function zPhaseNow(){
 let pi=0;
 for(let i=0;i<ZCFG.phaseTimes.length;i++) if(zSurviveT>=ZCFG.phaseTimes[i]) pi=i;
 return pi;
}
// 环人刷怪 (2026-10-07b): 锚点=存活人类质心 (压力跟着人走); 半径 38~62m 环带, 距每个人 ≥28m,
// occBlocked 拒绝; 候选打分偏好"从最近人类视线被遮挡"的落点 (从房子/树后冒出来, 不凭空刷在眼前)。
function zAnchor(){
 // 按队伍分别统计存活人类 (2026-10-10: 修复双队时均值质心落入地图中央无人区缺陷)
 const teamsAlive=[[],[]];
 for(const c of combatants){
  if(!c.alive||c.zombie||c.onVehicle||(c.isPlayer&&c.spectator)) continue;
  if(c.team===0||c.team===1) teamsAlive[c.team].push(c);
 }
 const candTeams=[0,1].filter(t=>teamsAlive[t].length>0);
 if(!candTeams.length){
  return (typeof BASES!=='undefined'&&BASES[player.team])?{x:BASES[player.team].x,z:BASES[player.team].z}:{x:0,z:0};
 }
 // 单队模式直接取该队; 双队对抗时随机挑选一支仍有存活人类的队伍作为本轮施压目标, 严禁跨队伍求几何平均
 const tgtTeam=candTeams[Math.floor(Math.random()*candTeams.length)];
 const members=teamsAlive[tgtTeam];
 let sx=0,sz=0;
 for(const m of members){ sx+=m.pos.x; sz+=m.pos.z; }
 return {x:sx/members.length,z:sz/members.length};
}
function zTrySpawn(surge){
 const R1=(typeof MAP_SIZE==='number'?MAP_SIZE:640)/2-10;
 const A=zAnchor(), P=getZDiffCfg();
 // 变体解锁 (随时间与难度): runner / brute / boomer 开始出现; 事件波内 runner 概率 ×runMul
 const rr=Math.random();
 const bruteP=(zSurviveT>=P.bruteT)?P.bruteP*Math.min(1,(zSurviveT-P.bruteT)/180):0;
 const runP=(zSurviveT>=P.runnerT)?P.runP*Math.min(1,(zSurviveT-P.runnerT)/120)*(surge?P.surge.runMul:1):0;
 const boomP=(zSurviveT>=P.boomerT)?P.boomP*Math.min(1,(zSurviveT-P.boomerT)/120):0;
 let kind='walker';
 if(rr<bruteP) kind='brute'; else if(rr<bruteP+runP) kind='runner'; else if(rr<bruteP+runP+boomP) kind='boomer';
 // 刷域 (2026-10-09 需求1 重构): 全域无意义远散布降至 25%, 75% 集中在 28~52m 近场环带 (优选遮挡物后); 事件波恒近环 28~52m
 const far=!surge&&Math.random()<0.25;
 let best=null,bestSc=-1e9;
 for(let a=0;a<14;a++){
  const ang=(a/14)*6.2832+rand(0,0.4);
  const rD=far?rand(30,R1*0.85):rand(28,52);
  const x=A.x+Math.cos(ang)*rD, z=A.z+Math.sin(ang)*rD;
  if(Math.abs(x)>R1||Math.abs(z)>R1) continue;
  if(occBlocked(x,z)) continue;
  let dMin=1e9,nH=0;
  for(const c of combatants){ if(!c.alive||c.zombie||c.onVehicle||(c.isPlayer&&c.spectator)) continue; nH++;
   const d=Math.hypot(c.pos.x-x,c.pos.z-z); if(d<dMin) dMin=d; }
  if(nH===0||dMin<28) continue;                     // 不刷进人堆 (近身圈留给 melee 判定)
  // 打分: 近场候选距最近人 34~46m 最优; 全域候选均匀随机; 视线被遮挡仍是大加分
  let sc=far?rand(0,10):-Math.abs(dMin-40)*1.4;
  const c0=zNearestHuman(x,z);
  if(c0){
   const eyeY=c0.pos.y+1.5, ty=heightAt(x,z)+1.2;
   const dd=Math.hypot(c0.pos.x-x,c0.pos.z-z);
   const bl=raycastWorld(_zEye.set(c0.pos.x,eyeY,c0.pos.z),_zDir.set((x-c0.pos.x)/dd,(ty-eyeY)/dd,(z-c0.pos.z)/dd),dd);
   if(bl&&bl.dist<dd-0.8) sc+=26;                  // 藏在遮挡后
  }
  if(sc>bestSc){ bestSc=sc; best={x,z}; }
 }
 if(!best) return false;
 const zw=spawnZombie(best.x,best.z,kind);
 if(surge) zw.zSpdMul=P.surge.spdMul;            // 波内移速 ×1.35 (峰谷的"峰")
 return true;
}
function zNearestHuman(x,z){
 let b=null,bd=1e9;
 for(const c of combatants){ if(!c.alive||c.zombie||c.onVehicle||(c.isPlayer&&c.spectator)) continue;
  const d=Math.hypot(c.pos.x-x,c.pos.z-z); if(d<bd){ bd=d; b=c; } }
 return b;
}
// 守基地防区 (2026-10-07b 单源, 14-bots pickObjective 消费): 己方基地周边一圈驻点 ——
// 半径 9~22m 12 个方位槽, occBlocked/基地建筑回避, 落点高度走 heightAt。懒计算每队一次 (BUILDS 前亦可用)。
const _zDefCache=[null,null];
function zDefPosts(team){
 if(_zDefCache[team]) return _zDefCache[team];
 const b=(typeof BASES!=='undefined'&&BASES[team])?BASES[team]:{x:0,z:0};
 const posts=[];
 for(let i=0;i<12;i++){
  const ang=(i/12)*6.2832;
  for(const rD of [13,19,9]){
   const x=b.x+Math.cos(ang)*rD, z=b.z+Math.sin(ang)*rD;
   // 先取整再过门 (2026-10-28): 消费端/判据读的是取整后的存储点 —— 浮点角在 .5 格边界上会让
   // "原始点可站 / 存储点隔壁格被结构边距堵死" 翻格 (sin(5π/6)≈0.4999… 实录)。门对存储点自洽。
   const rx=Math.round(x*10)/10, rz=Math.round(z*10)/10;
   if(!occBlocked(rx,rz)){ posts.push({x:rx,z:rz}); break; }
  }
 }
 // 兜底补点同样过 occBlocked 门 (2026-10-28 修复): 单队基地贴村核心时 9~22m 环常被建筑占满,
 // 旧版盲推 rand±8 会把 Bot 防区点推进墙里 (站桩卡死)。12 次尝试内找空位, 全堵才退回盲推。
 let _bf=0;
 while(posts.length<4&&_bf<12){
  _bf++;
  const bx=Math.round((b.x+rand(-8,8))*10)/10, bz=Math.round((b.z+rand(-8,8))*10)/10;
  if(!occBlocked(bx,bz)) posts.push({x:bx,z:bz});
 }
 while(posts.length<4) posts.push({x:b.x+rand(-8,8),z:b.z+rand(-8,8)});
 _zDefCache[team]=posts;
 return posts;
}
// 载具驻车位 (2026-10-07d 单源, 15-vehicles driveAI 消费): 己方基地外环 15~26m 车位 —— 比步兵驻点
// (9~22m) 外扩一圈, 不挡步兵站位; occBlocked + 深水双门 (塔拉瓦/海岛图基地临水)。方位槽与步兵驻点
// 错开半槽 (+0.26rad) 避免车人同向扎堆。懒计算每队一次。
const _zVehCache=[null,null];
function zVehPosts(team){
 if(_zVehCache[team]) return _zVehCache[team];
 const b=(typeof BASES!=='undefined'&&BASES[team])?BASES[team]:{x:0,z:0};
 const posts=[];
 for(let i=0;i<12;i++){
  const ang=(i/12)*6.2832+0.26;
  for(const rD of [22,17,26]){
   // 先取整再过门 (2026-10-28, 同 zDefPosts): 门对存储点自洽, 免 .5 格边界翻格
   const rx=Math.round((b.x+Math.cos(ang)*rD)*10)/10, rz=Math.round((b.z+Math.sin(ang)*rD)*10)/10;
   if(occBlocked(rx,rz)) continue;
   if(typeof waterDepthAt==='function'&&typeof VEH_WATER_DEPTH!=='undefined'&&waterDepthAt(rx,rz)>VEH_WATER_DEPTH) continue;
   posts.push({x:rx,z:rz}); break;
  }
 }
 // 兜底补点同主环口径 (2026-10-28): occBlocked + 深水双门 (旧盲推会把坦克车位推进墙里/河里)
 let _bf=0;
 while(posts.length<4&&_bf<12){
  _bf++;
  const bx=Math.round((b.x+rand(-20,20))*10)/10, bz=Math.round((b.z+rand(-20,20))*10)/10;
  if(occBlocked(bx,bz)) continue;
  if(typeof waterDepthAt==='function'&&typeof VEH_WATER_DEPTH!=='undefined'&&waterDepthAt(bx,bz)>VEH_WATER_DEPTH) continue;
  posts.push({x:bx,z:bz});
 }
 while(posts.length<4) posts.push({x:b.x+rand(-20,20),z:b.z+rand(-20,20)});
 _zVehCache[team]=posts;
 return posts;
}
function zSweep(){
 // 退场清扫: 死透的丧尸从三表摘除 + 摘 mesh (布娃娃已接管尸体表现)
 for(let i=ZOMBIES.length-1;i>=0;i--){
  const z=ZOMBIES[i];
  if(z._zGone!==undefined&&nowT>z._zGone+0.2){
   ZOMBIES.splice(i,1);
   let si=soldiers.indexOf(z); if(si>=0) soldiers.splice(si,1);
   let ci=combatants.indexOf(z); if(ci>=0) combatants.splice(ci,1);
   if(z.mesh&&z.mesh.root&&z.mesh.root.parent) z.mesh.root.parent.remove(z.mesh.root);
  }
 }
}
function updateZpHud(){
 if(!zHudEl) return;
 const pi=Math.max(0,zPhaseNow());
 let mid;
 if(ZOMBIE_MODE==='solo'){
  const surviveLimit=(ZCFG.solo&&ZCFG.solo.surviveT)||720;
  const rem=Math.max(0,surviveLimit-zSurviveT);
  const mm=Math.floor(rem/60), ss=Math.floor(rem%60);
  const mms=(mm<10?'0':'')+mm, sss=(ss<10?'0':'')+ss;
  mid=t('撑过 {0}:{1}',mms,sss);
 } else {
  const alive=(!zElim[0]?1:0)+(!zElim[1]?1:0);
  mid=t('存活 {0} 队 · 活到最后',String(alive));
 }
 const infBadge=isFullInfectionActive()?' · ☣ '+t('全域感染'):'';
 zHudEl.textContent='☣ '+(player.pz|0)+' ZP · '+t(ZCFG.phaseNames[pi])+' · '+mid+infBadge;
}
function zombieFrameTick(dt){
 if(!zInit||matchOver||(typeof matchRunning!=='undefined'&&!matchRunning)) return;
 zSurviveT+=dt;
 // 待尸变队列驱动 (防同帧范围爆炸二次炸死/双倍击杀)
 if(PENDING_INFECTIONS.length>0){
  for(let i=PENDING_INFECTIONS.length-1;i>=0;i--){
   const inf=PENDING_INFECTIONS[i];
   inf.t-=dt;
   if(inf.t<=0){
    PENDING_INFECTIONS.splice(i,1);
    if(inf.rag&&typeof removeRagdoll==='function') removeRagdoll(inf.rag);
    if(inf.sol&&inf.sol.mesh&&inf.sol.mesh.root) inf.sol.mesh.root.visible=false;
    const zw=spawnZombie(inf.x,inf.z,inf.kind);
    if(zw){
     zw._riseT=1.2;
     if(AudioSys&&AudioSys.zgroan) AudioSys.zgroan(Math.hypot(zw.pos.x-camera.position.x,zw.pos.z-camera.position.z));
    }
   }
  }
 }
 const pi=zPhaseNow();
 if(pi!==zPhase){
  zPhase=pi;
  addKillMsg(t('☣ 尸潮阶段 · {0}',t(ZCFG.phaseNames[pi])),1);
 }
 // 全域感染警报触发 (2026-10-11 用户需求4)
 if(!zFullInfectWarned&&isFullInfectionActive()){
  zFullInfectWarned=true;
  addKillMsg(t('☣ ⚠ 灾变恶化 · 尸毒彻底失控! 战场上所有阵亡人员都将原地尸变!'),1);
  if(AudioSys.zgroan) AudioSys.zgroan(0);
 }
 // 持续强度爬坡 (2026-10-11 曲线平滑 + 难度分档): 间隔与上限随时间两段平滑过渡
 const curCap=getZCurrentCap();
 zSpawnCd-=dt;
 if(zSpawnCd<=0){
  zSpawnCd=getZCurrentInterval();
  if(ZOMBIES.length<curCap) zTrySpawn();
 }
 // 事件波 (2026-10-07d / 2026-10-11 难度分档): 静默期→嘶吼预警→定向大波连刷
 const P=getZDiffCfg(), S=P.surge;
 if(zSurviveT>S.firstT){
  if(zSurgeState===0){
   zSurgeT-=dt;
   if(zSurgeT<=0){
    zSurgeState=1; zSurgeT=S.tele;
    addKillMsg(t('☣ 远处传来嘶吼…… 大股尸潮正在聚集!'),1);
    if(AudioSys.zgroan) AudioSys.zgroan(0);
   }
  } else if(zSurgeState===1){
   zSurgeT-=dt;
   if(zSurgeT<=0){
    zSurgeState=2; zSurgeLeft=Math.round(rand(S.n0,S.n1)); zSurgeCd=0;
    addKillMsg(t('☣ 尸潮来袭!'),1);
   }
  } else {
   zSurgeCd-=dt;
   if(zSurgeCd<=0&&zSurgeLeft>0){
    zSurgeCd=0.25;
    const capNow=curCap+18;
    if(ZOMBIES.length<capNow&&zTrySpawn(true)) zSurgeLeft--;
   }
   if(zSurgeLeft<=0){ zSurgeState=0; zSurgeT=rand(S.everyMin,S.everyMax); }
  }
 }
 zSweepT-=dt; if(zSweepT<=0){ zSweepT=0.5; zSweep(); }
 // 工事拆毁对账: 血量组已死 → BUILDS 条目下线 (拆除退款不再认它)
 for(const b of BUILDS){ if(b.zhpG&&b.zhpG.dead&&b.alive) b.alive=false; }
 const surviveLimit=(ZCFG.solo&&ZCFG.solo.surviveT)||720;
 if(ZOMBIE_MODE==='solo'){
  if(zSurviveT>=surviveLimit&&matchEndPending===null&&!matchOver) requestEnd(player.team);
 } else {
  // 双队对抗: 成为存活到最后的队伍 (淘汰判定解绑 tickets <= 0, 12分钟时限不直接判胜)
  const elim0=typeof isTeamEliminated==='function'?isTeamEliminated(0):(tickets[0]<=0&&fieldCount(0)===0);
  const elim1=typeof isTeamEliminated==='function'?isTeamEliminated(1):(tickets[1]<=0&&fieldCount(1)===0);
  for(let tt=0;tt<2;tt++){
   const elim=tt===0?elim0:elim1;
   if(!zElim[tt]&&elim){
    zElim[tt]=true;
    addKillMsg(t('☣ ⚠ {0} 全员覆灭 · 已被淘汰出局',t(TEAM_NAME[tt])));
   }
  }
  if(matchEndPending===null&&!matchOver){
   if(elim0&&elim1){
    requestEnd(-1);
   } else if(elim0){
    requestEnd(1);
   } else if(elim1){
    requestEnd(0);
   }
  }
 }
 zHudT-=dt; if(zHudT<=0){ zHudT=0.25; updateZpHud(); }
}
// ═══ ZP 经济 (裁定④): 击杀丧尸 +15/+40, 占领旗点 +100 (占领钩子在 21-match), 商店在 06-engineering ═══
function pzGain(n){
 player.pz=Math.max(0,(player.pz===undefined?ZCFG.zp.start:player.pz)+n);
}
// ═══ 工事商店件 + 工事血量 (裁定④/⑧) ═══
if(ZOMBIE_MODE){
BUILD_MENU.push('tower','ammoc');                 // 商店新件进建造轮选 (06-engineering 菜单单源)
BUILD_NAMES.tower='瞭望塔'; BUILD_NAMES.ammoc='弹药箱';
BUILD_TIME.tower=3.2; BUILD_TIME.ammoc=1.6;
}
const ZFORT_HP={sandbag:300,wire:100,hedge:150,mg:400,medkit:200,tower:500,ammoc:150};
// engBuildExec 调入: 把本次建造的新增碰撞盒 (BOXES[bi0..]) 登记为轻量可破坏组 —— 与 05a dBegin/dEnd
// 同一数据形状 (bi=BOXES 索引 + dGroup 回指针 + structBounds 包围盒), 命中/拆毁全走既有单源。
function registerFortHP(entry,bi0){
 const g={meshes:[],bi:[],hp:ZFORT_HP[entry.type]||200,cx:entry.tx,cz:entry.tz,n:0,dead:false,build:entry};
 for(let i=bi0;i<BOXES.length;i++){ if(BOXES[i].dead) continue; g.bi.push(i); BOXES[i].dGroup=g; g.n++; }
 if(!g.n) return null;
 g.meshes=(entry.meshes||[]).filter(m=>m&&m.isMesh);
 DESTRUCTIBLES.push(g);
 structBounds(g);
 entry.zhpG=g;
 return g;
}
