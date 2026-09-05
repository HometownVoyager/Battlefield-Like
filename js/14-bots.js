// ─────────────────────────────────────────────
// 14-bots.js —— Bot AI类
// 源: Index.original.html 第 4478-5636 行
// ─────────────────────────────────────────────
'use strict';
class Bot {
constructor(team,cls,name){
this.team=team; this.name=name;
this.isPlayer=false;
this.pos=V3(); this.vel=V3();
this.yaw=0; this.pitch=0; this.visYaw=0;
this.hp=100; this.alive=false; this.crouch=false;
this.mesh=buildSoldierMesh(team,name);
this.gun=null; this.gunKind=null;
this.setClass(cls);
this.state='idle';
this.path=null; this.pathI=0; this.repathT=0;
this.objective=null; this.defendPt=null;
this.target=null; this.lastSeenPos=V3(); this.lastSeenT=-99;
this.aimSettle=0; this.reactT=0;
this.reloadT=0; this.boltT=0;
this.fireT=0; this.burstLeft=0; this.burstPause=0;
this.nadeCd=rand(4,10); this.nadeAnimT=0; this.pendingNade=null;
this.suppression=0; this.coverPt=null; this.coverT=0;
this.smokeCd=rand(18,28);
this.prone=false; this.flinchT=0;
this.aimErrX=0; this.aimErrY=0; this.wanderSeed=rand(0,9);
// 侧移方向记忆: 侧移延续同侧, 不左右换向蹦 (反复横移修复)
this.slideDir=Math.random()<0.5?1:-1; this.slideCd=0;
// 火情规避 (04b-fire.fireThreat): 逃命剩余时间/扫描节拍/逃生航向
this.fireFleeT=0; this.fireScanT=rand(0,0.22); this.fleeYaw=0;
// 战斗机动层 (批次①重构): 性格攻击性 + 持续机动(驻停/侧移/跃进) + 掩体探头循环
this.aggro=rand(0.35,1);
this.man='hold'; this.manT=0; this.stance='crouch'; this.pushPt=null;
this.peekPhase='in'; this.peekT=0; this.peekNext=0; this.peekPos=null; this.peekSide=0;
this.supFireT=0; this.lastHitT=-9;
this.coverCd=0; this.lastCover=null; // 掩体重进冷却+粘滞: 防止在多个掩体间来回蹦
this.decisionT=rand(0,0.4); this.perceptT=rand(0,0.15);
this.tickSkip=0; this.tickAcc=0;
this.kills=0; this.deaths=0; this.score=0;
this.respawnT=0; this.deathAnimT=0;
this.stuckT=0; this.lastPos=V3(); this.moveIntent=false;
this.unstickT=0; this.unstickDir=1; this.lastUnstickP=null;
this.empUse=null; this.empT=0;
this.emCast=null; // 固定火力点使用前摇 (与玩家同规 2026-09-02): {kind,g,t,dur}
this.lastFiredT=-99; this.animT=rand(0,9);
this.mgUse=null; this.mgT=0;
this.mortUse=null; this.mortT=0;
this.meleeT=0;
this.onVehicle=null; this.targetVeh=null; this.chuting=false;
this.pilotOf=null;
this.bandageT=0; this.medkitT=0;
this.speedMul=rand(0.92,1.08);
combatants.push(this); soldiers.push(this);
}
setClass(cls){
this.cls=cls;
const wset=TEAM_FACTION[this.team].cls[cls];
this.wpnKey=wset[0];
this.def=WPN_DEFS[this.wpnKey];
this.slots=wset.map(k=>({key:k,def:WPN_DEFS[k],mag:WPN_DEFS[k].mag,reserve:WPN_DEFS[k].reserve}));
this.mag=this.def.mag;
this.pMag=this.slots[1]?this.slots[1].def.mag:0;
this.pReloadT=0;
this.nades=CLASSES[cls].nades;
this.smokes=CLASSES[cls].smoke||0;
this.atn=cls===2?4:(cls===5?(TEAM_FACTION[this.team].atn5||3)*2:0);
this.maxBandages=cls===4?12:4;
this.bandages=this.maxBandages;
const kind=gunKindOf(this.wpnKey);
if(kind!==this.gunKind||this.wgKey!==this.wpnKey){
if(this.gun) this.mesh.gunG.remove(this.gun);
this.gunKind=kind; this.wgKey=this.wpnKey;
this.gun=worldGunModel(kind,this.team,this.wpnKey);
this.mesh.gunG.add(this.gun);
// 枪口朝向角色正前方(+z), 枪托收在肩前
this.gun.position.set(0,-0.02,kind==='launcher'?0.2:kind==='atr'?0.24:0.3);
this.gun.rotation.order='YXZ';
this.gun.rotation.y=Math.PI;
}
}
spawn(){
this.setClass(CLS_POOL[randi(0,CLS_POOL.length-1)]);
const sp=pickSpawnFor(this.team);
const fp=findFreeSpawn(sp.x,sp.z);
this.pos.set(fp[0], 0, fp[1]);
this.pos.y=standHeight(this.pos.x,this.pos.z,10);
this.hp=100; this.alive=true; this.crouch=false; this.prone=false;
this.ragdolled=false;
this.mag=this.def.mag; this.reloadT=0; this.suppression=0;
this.target=null; this.lastSeenT=-99; this.path=null;
this.state='idle'; this.mgUse=null; this.empUse=null; this.mortUse=null; this.unstickT=0;
this.man='hold'; this.manT=0; this.pushPt=null; this.stance='crouch';
this.peekPhase='in'; this.peekPos=null; this.coverPt=null; this.supFireT=0;
this.coverCd=0; this.slideCd=0; this.lastCover=null;
this.fireFleeT=0; this.fireScanT=rand(0,0.22);
this.onVehicle=null; this.targetVeh=null; this.chuting=false; this.emCast=null;
this.bandageT=0;
this.mesh.root.visible=true;
this.mesh.root.rotation.set(0,0,0);
this.mesh.pelvis.position.y=0.94;
this.pickObjective();
}
spawnInVehicle(v){
this.hp=100; this.alive=true; this.crouch=false; this.prone=false;
this.ragdolled=false;
this.mag=this.def.mag; this.reloadT=0; this.suppression=0;
this.target=null; this.lastSeenT=-99; this.path=null;
this.state='idle'; this.mgUse=null; this.empUse=null; this.mortUse=null; this.unstickT=0;
this.man='hold'; this.manT=0; this.pushPt=null; this.peekPhase='in'; this.peekPos=null; this.coverPt=null; this.supFireT=0;
this.coverCd=0; this.slideCd=0; this.lastCover=null;
this.chuting=false; this.bandageT=0; this.deathDir=0;
this.respawnT=0;
this.mesh.root.visible=false;
this.mesh.root.rotation.set(0,0,0);
this.mesh.pelvis.position.y=0.94;
this.onVehicle=v; v.crewBot=this;
this.pos.copy(v.pos);
}
enterVehicle(v){
if(v.crewBot||v.playerDriven) return;
v.crewBot=this; v.claimBot=null;
this.onVehicle=v;
this.targetVeh=null; this.path=null;
this.state='idle';
this.crouch=false; this.prone=false; this.bandageT=0;
if(this.mgUse){ releaseEmpl(this.mgUse,true); this.mgUse=null; }
if(this.empUse){ releaseEmpl(this.empUse,true); this.empUse=null; }
if(this.mortUse){ releaseEmpl(this.mortUse,true); this.mortUse=null; }
if(this.emCast){ if(this.emCast.g&&this.emCast.g.user===this) this.emCast.g.user=null; this.emCast=null; }
this.mesh.root.visible=false;
}
dismountVehicle(bailing){
const v=this.onVehicle;
this.onVehicle=null; this.chuting=false;
if(v){
if(v.crewBot===this) v.crewBot=null;
v.noEnterT=nowT+(bailing?12:6);
let px=v.pos.x+3.2, pz=v.pos.z;
for(const off of [[3.2,0],[-3.2,0],[0,4],[0,-4],[4,4]]){
const qx=v.pos.x+off[0], qz=v.pos.z+off[1];
if(!occBlocked(qx,qz)){ px=qx; pz=qz; break; }
}
this.pos.set(px,0,pz);
this.pos.y=standHeight(px,pz,v.pos.y+2);
}
this.mesh.root.visible=true;
this.path=null; this.state='idle'; this.decisionT=0; this.targetVeh=null;
this.man='hold'; this.manT=0; this.pushPt=null; this.peekPhase='in'; this.peekPos=null; this.coverPt=null;
this.coverCd=0; this.slideCd=0; this.lastCover=null; this.emCast=null;
if(bailing){ this.suppression=0.9; }
}
eyePos(){ return V3(this.pos.x,this.pos.y+(this.prone?0.5:this.crouch?1.15:1.62),this.pos.z); }
noticeThreat(enemy){
if(!enemy||!enemy.alive) return;
if(!this.target||nowT-this.lastSeenT>2.5){
this.lastSeenPos.copy(enemy.pos);
if(nowT-this.lastSeenT>4) this.lastSeenT=nowT-2.8;
}
}
damage(amt,attacker,isHead){
if(!this.alive) return;
this.hp-=amt;
this.lastHitT=nowT;
this.suppression=Math.min(1.6,this.suppression+0.45);
this.aimSettle=Math.max(0.1,this.aimSettle-0.4);
if(attacker&&attacker.team!==this.team&&!attacker.spectator){ // 观战者的攻击不会引来还击锁定
this.noticeThreat(attacker);
if(!this.target&&!attacker.isCrew&&!attacker.onVehicle&&Math.random()<0.8){
this.target=attacker;
this.lastSeenPos.copy(attacker.pos);
this.lastSeenT=nowT-1.2;
this.reactT=DIFF_TABLE[SETTINGS.diff].react*rand(0.5,1);
}
}
if(this.hp<=0) this.die(attacker,isHead);
}
die(attacker,isHead){
this.alive=false; this.deaths++;
this.deathAnimT=0.6;
this.respawnT=rand(7,11);
this.bandageT=0; this.chuting=false;
// 清理战斗残留: 尸体不再携带交战状态/目标/机动 (调试层与探针口径一致)
this.state='idle'; this.target=null; this.pushPt=null; this.coverPt=null;
this.man='hold'; this.manT=0; this.peekPhase='in'; this.peekPos=null; this.supFireT=0;
this.coverCd=0; this.slideCd=0; this.lastCover=null; this.emCast=null;
noteDeath(this.pos.x,this.pos.z);
// 布娃娃尸体 (cannon可用时)
this.ragdolled=window.CANNON?spawnRagdoll(this,attacker,isHead):false;
if(this.ragdolled) this.mesh.root.visible=false;
if(this.targetVeh){ if(this.targetVeh.claimBot===this) this.targetVeh.claimBot=null; this.targetVeh=null; }
if(this.onVehicle){ if(this.onVehicle.crewBot===this) this.onVehicle.crewBot=null; this.onVehicle=null; }
if(this.mgUse){ releaseEmpl(this.mgUse,true); this.mgUse=null; }
if(this.empUse){ releaseEmpl(this.empUse,true); this.empUse=null; }
if(this.mortUse){ releaseEmpl(this.mortUse,true); this.mortUse=null; }
if(this.emCast){ if(this.emCast.g&&this.emCast.g.user===this) this.emCast.g.user=null; this.emCast=null; }
tickets[this.team]=Math.max(0,tickets[this.team]-1);
if(attacker){
attacker.kills=(attacker.kills||0)+1;
attacker.score=(attacker.score||0)+100;
addKillfeed(attacker,this,isHead);
if(attacker.isPlayer){ onPlayerKill(this,isHead); }
}
if(this.pos.distanceTo(camera.position)<30&&Math.random()<0.5) AudioSys.hurt();
}
pickObjective(){
// 攻防模式: 任意旗点可直接占领, Bot 与玩家规则一致 —— 动态选择最近的非己方/争夺中旗点
// 破袭模式: 进攻方扑向最近未毁补给库, 防守方前往驻守
if(GAMEMODE==='demolition'){
const d=nearestDepot(this.pos.x,this.pos.z);
this.objective=d?{id:d.id,x:d.x,z:d.z,r:14,owner:this.team===ATK?DEF:this.team,cap:0,capTeam:-1,gy:heightAt(d.x,d.z)}:FLAGS[0];
this.defendPt=null;
this.repathT=Math.min(this.repathT,0.5);
return;
}
if(GAMEMODE==='clash'){
// 遭遇战: 无旗点 —— 目标=敌方前哨/敌基地, 双方相向推进在中线发生遭遇
const cands=spawnPtsOf(1-this.team).map(s=>({x:s.x,z:s.z}));
cands.push({x:BASES[1-this.team].x,z:BASES[1-this.team].z});
let best=null,bestScore=-1e9;
for(const c of cands){
let sc=-Math.hypot(c.x-this.pos.x,c.z-this.pos.z)*0.6+rand(0,45);
// 友军聚集惩罚: 目标点附近己方越多越分散改道
for(const s of soldiers){
if(s!==this&&s.alive&&s.team===this.team&&Math.hypot(s.pos.x-c.x,s.pos.z-c.z)<18) sc-=14;
}
if(sc>bestScore){ bestScore=sc; best=c; }
}
this.objective=best?{id:'X',x:best.x,z:best.z,r:14,owner:1-this.team,cap:0,capTeam:-1,gy:heightAt(best.x,best.z)}:null;
this.defendPt=null;
this.repathT=0;
return;
}
if(GAMEMODE==='convoy'){
// 劫道: 护运方跟随最近存活卡车, 劫道方驻守己方伏击点
const escT=(CAMPAIGN.convoy&&CAMPAIGN.convoy.escortTeam!==undefined)?CAMPAIGN.convoy.escortTeam:1;
if(this.team===escT){
let best=null,bd=1e9;
for(const t of trucks){
if(!t.alive) continue;
const d=Math.hypot(t.pos.x-this.pos.x,t.pos.z-this.pos.z);
if(d<bd){ bd=d; best=t; }
}
this.objective=best?{id:'T',x:best.pos.x+rand(-4,4),z:best.pos.z+rand(-4,4),r:12,owner:this.team,cap:0,capTeam:-1,gy:heightAt(best.pos.x,best.pos.z)}:null;
}else{
let best=null,bd=1e9;
for(const c of spawnPtsOf(this.team)){
const d=Math.hypot(c.x-this.pos.x,c.z-this.pos.z)+rand(0,22);
if(d<bd){ bd=d; best=c; }
}
this.objective=best?{id:'A',x:best.x,z:best.z,r:14,owner:1-this.team,cap:0,capTeam:-1,gy:heightAt(best.x,best.z)}:null;
}
this.defendPt=null;
this.repathT=0;
return;
}
let best=null,bestScore=-1e9;
for(const f of FLAGS){
let sc=0;
const d=Math.hypot(this.pos.x-f.x,this.pos.z-f.z);
sc-=d*0.6;
if(f.owner!==this.team) sc+=90;
if(f.owner===this.team&&f.capTeam!==-1&&f.capTeam!==this.team) sc+=140;
if(f.capTeam===this.team&&f.cap>0.05&&d<55) sc+=130;
let cnt=0;
for(const s of soldiers) if(s.alive&&s.team===this.team&&s.objective===f) cnt++;
sc-=cnt*26;
sc+=rand(0,30);
if(sc>bestScore){ bestScore=sc; best=f; }
}
this.objective=best;
this.defendPt=null;
this.repathT=0;
}
perceive(){
const diff=DIFF_TABLE[SETTINGS.diff];
const viewD=95*diff.visMul;
let best=null,bestD=1e9;
const eye=this.eyePos();
for(const e of combatants){
if(!e.alive||e.team===this.team||e.onVehicle||e.spectator) continue; // 观战者不被索敌
const dx=e.pos.x-this.pos.x, dz=e.pos.z-this.pos.z;
const d=Math.hypot(dx,dz);
if(d>viewD) continue;
const ang=Math.atan2(dx,dz);
const isCur=(e===this.target&&nowT-this.lastSeenT<3);
if(!isCur&&Math.abs(angDiff(this.yaw,ang))>1.15) continue;
const heard=d<9||(e.lastFiredT&&nowT-e.lastFiredT<1.5&&d<70);
if(!isCur&&!heard&&d>viewD*0.85&&e.crouch) continue;
const tp=V3(e.pos.x,e.pos.y+(e.crouch?1.0:1.4),e.pos.z);
const dir=tp.clone().sub(eye); const dist=dir.length(); dir.normalize();
const blockHit=raycastWorld(eye,dir,dist);
if(blockHit&&blockHit.dist<dist-0.6) continue;
// 烟雾遮蔽: bot 无法看穿烟墙
if(SMOKES.length&&smokeBlocksLOS(eye.x,eye.y,eye.z,tp.x,tp.y,tp.z)) continue;
// 高杆庄稼遮蔽: 视线穿入作物田(交点低于作物顶)视为隐蔽; 子弹仍可穿透(与烟雾同一套逻辑)
if(CROP_FIELDS.length&&cropBlocksLOS(eye.x,eye.y,eye.z,tp.x,tp.y,tp.z)) continue;
if(d<bestD){ best=e; bestD=d; }
}
if(best){
if(this.target!==best||nowT-this.lastSeenT>2){
if(this.target!==best){
this.reactT=DIFF_TABLE[SETTINGS.diff].react*rand(0.7,1.4);
// 拟人"甩枪": 换目标瞬间带初始偏差, 随后收敛
this.aimErrX=rand(-1,1)*0.055*DIFF_TABLE[SETTINGS.diff].spreadMul;
this.aimErrY=rand(-0.6,0.6)*0.04*DIFF_TABLE[SETTINGS.diff].spreadMul;
}
this.target=best;
}
this.lastSeenPos.copy(best.pos);
this.lastSeenT=nowT;
this.aimSettle=Math.min(1,this.aimSettle+0.16);
} else {
this.aimSettle=Math.max(0.2,this.aimSettle-0.1);
if(this.target&&(!this.target.alive||nowT-this.lastSeenT>8)) this.target=null;
}
if(!this.target){
for(const ev of gunEvents){
if(ev.team===this.team) continue;
const d=Math.hypot(ev.x-this.pos.x,ev.z-this.pos.z);
if(d<65&&nowT-ev.t<0.4&&ev.shooter&&ev.shooter.alive){
this.lastSeenPos.set(ev.x,0,ev.z);
if(nowT-this.lastSeenT>4) this.lastSeenT=nowT-3.5;
}
}
}
}
decide(){
const engaged=this.target&&nowT-this.lastSeenT<4;
const seenNow=this.target&&nowT-this.lastSeenT<1.6;
const distT=engaged?Math.hypot(this.target.pos.x-this.pos.x,this.target.pos.z-this.pos.z):0;
if(this.empUse){
const g=this.empUse;
let done=false;
if(g.kind==='at'){ const t=enemyTankNear(this,150); if(!t) done=true; }
else { if(!enemyPlaneAlive(this.team)) done=true; }
this.empT-=0.5;
if(done||this.empT<=0||(engaged&&distT<8)){ releaseEmpl(g,true); this.empUse=null; }
else return;
}
if(this.mgUse){
this.mgT-=0.5;
// 解除回旋限制后不再按朝向判断威胁, 只看是否仍有交战目标
const stillThreat=engaged&&distT>6;
if(this.mgT<=0||(engaged&&distT<7)||(!stillThreat&&this.mgT<12)){ releaseEmpl(this.mgUse,true); this.mgUse=null; }
else return;
}
// 固定火力点使用前摇期间: 原地操作, 不机动不换目标 (与玩家同规)
if(this.emCast){ this.state='defend'; this.path=null; return; }
// 小队指令: 最高优先级, 只有敌人近身(20m内)才暂缓执行
if(this.inSquad&&!(engaged&&distT<20)){
if(SQUAD.mode==='move'){
const d=Math.hypot(SQUAD.pos.x-this.pos.x,SQUAD.pos.z-this.pos.z);
if(d>7){
this.state='advance';
if(!this.path||this.repathT<=0){ this.setPathTo(SQUAD.pos.x+rand(-4,4),SQUAD.pos.z+rand(-4,4)); this.repathT=rand(2,3); }
return;
}
if(!engaged){
this.state='defend';
if(Math.random()<0.12) this.setPathTo(SQUAD.pos.x+rand(-5,5),SQUAD.pos.z+rand(-5,5));
return;
}
}
else if(SQUAD.mode==='follow'&&player.alive&&!player.onVehicle){
const d=Math.hypot(player.pos.x-this.pos.x,player.pos.z-this.pos.z);
if(d>10){
this.state='advance';
if(!this.path||this.repathT<=0){ this.setPathTo(player.pos.x+rand(-3,3),player.pos.z+rand(-3,3)); this.repathT=rand(1.2,2); }
return;
}
if(!engaged){
this.state='defend';
this.crouch=player.crouch&&d<6;
return;
}
}
}
const eTank=enemyTankNear(this,120);
// 筒子自动打坦克
if(this.cls===5&&eTank&&eTank.alive&&this.slots&&this.slots[0]&&this.slots[0].def.rocket){
const w2=this.slots[0];
if(w2.mag>0&&this.fireT<=0&&this.reloadT<=0&&Math.hypot(eTank.pos.x-this.pos.x,eTank.pos.z-this.pos.z)<65){
const eye2=this.eyePos();
const dir2=V3(eTank.pos.x-eye2.x,eTank.pos.y+1.2-eye2.y,eTank.pos.z-eye2.z).normalize();
const chk=raycastWorld(eye2,dir2,65);
if(!chk||chk.dist>50){
this.lastFiredT=nowT;
fireRocket(this,eye2,dir2,w2.def,V3(eTank.pos.x,eTank.pos.y,eTank.pos.z));
w2.mag=0; this.mag=0; this.fireT=3.6;
}}}
// 反坦克枪手打坦克 (PTRD/博伊斯/九七式自动炮)
if(this.cls===5&&eTank&&eTank.alive&&this.def.atRifle&&this.mag>0&&this.fireT<=0&&this.reloadT<=0&&this.boltT<=0){
const dTk=Math.hypot(eTank.pos.x-this.pos.x,eTank.pos.z-this.pos.z);
if(dTk<95){
const eye2=this.eyePos();
const dir2=V3(eTank.pos.x-eye2.x,eTank.pos.y+1.3-eye2.y,eTank.pos.z-eye2.z).normalize();
const chk=raycastWorld(eye2,dir2,dTk);
if(!chk||chk.dist>dTk-3){
this.yaw=Math.atan2(eTank.pos.x-this.pos.x,eTank.pos.z-this.pos.z);
const er2=0.012*DIFF_TABLE[SETTINGS.diff].spreadMul;
dir2.x+=rand(-er2,er2); dir2.y+=rand(-er2,er2)*0.5; dir2.z+=rand(-er2,er2); dir2.normalize();
const muzz=eye2.clone().addScaledVector(dir2,0.9);
this._src=this.def.name||''; // 击杀来源: 当前武器名
fireBullet(this,eye2,dir2,this.def,muzz);
this.mag--;
this.mesh.armR.sh.userData.swing=0.15;
this.fireT=60/this.def.rpm*rand(1.2,1.8);
if(this.def.type==='bolt') this.boltT=this.def.boltT||1.2;
if(this.mag<=0) this.reloadT=this.def.reload;
this.prone=dTk>30;
}
}
}

if(eTank){
const dTank=Math.hypot(eTank.pos.x-this.pos.x,eTank.pos.z-this.pos.z);
if(this.atn>0&&this.nadeCd<=0&&dTank<26){
this.state='atnade'; this.nadeAnimT=0.8; this.atTankTarget=eTank;
return;
}
if(dTank<130){
for(const g of ATGUNS){
if(!empReady(g)) continue; // 占用中/上炮冷却中(下炮后EMP_REARM_T秒)
if(Math.hypot(g.x-this.pos.x,g.z-this.pos.z)<16){
// 解除朝向限制: 炮塔可360°回旋, 就近即可上炮; 使用前摇与玩家同规 (0.9s原地操作); 前摇期间即占位
g.user=this;
this.emCast={kind:'at',g,t:0,dur:0.9}; this.state='defend'; this.path=null;
return;
}
}
}
if(this.cls===2&&this.atn>0&&dTank<55&&!engaged){
this.state='hunt';
if(!this.path||this.repathT<=0){
this.setPathTo(eTank.pos.x+rand(-8,8),eTank.pos.z+rand(-8,8));
this.repathT=2.5;
}
return;
}
if(dTank<32&&this.cls!==2&&this.state!=='cover'&&Math.random()<0.5){
const cp=this.findCoverFrom(eTank.pos);
if(cp){ this.state='cover'; this.coverPt=cp; this.coverT=rand(2.5,5); this.setPathTo(cp.x,cp.z); return; }
}
}
const ePlane=enemyPlaneAlive(this.team);
if(ePlane&&!engaged&&!this.inSquad&&Math.random()<0.4){
for(const g of AAGUNS){
if(!empReady(g)) continue;
if(Math.hypot(g.x-this.pos.x,g.z-this.pos.z)<15){
g.user=this;
this.emCast={kind:'aa',g,t:0,dur:0.9}; this.state='defend'; this.path=null; // 使用前摇与玩家同规
return;
}
}
}
if(seenNow){
if(distT<2.6){ this.state='melee'; return; }
if(this.state==='cover'&&this.coverPt){
// 掩体驻留: 探头循环接管交战, 不被机动层打断 (旧版0.4s就跳出掩体)
if(this.coverT>0.4&&(this.reloadT>0||this.suppression>0.55||this.hp<50)) return;
}
// 受压制时丢烟雾遮蔽后撤
if(this.smokes>0&&this.smokeCd<=0&&this.suppression>1.0&&Math.random()<0.55){
const eye=this.eyePos();
const dir=V3(this.lastSeenPos.x-this.pos.x,0,this.lastSeenPos.z-this.pos.z).normalize();
this._src='烟雾弹';
throwNade(this,eye,dir.multiplyScalar(7).add(V3(0,3,0)),1.6,false,true);
this.smokes--; this.smokeCd=rand(20,32);
this.mesh.armR.sh.userData.swing=0.4;
}
	// 重伤/换弹/被压: 进掩体 (到位后进入探头循环); 刚离开掩体有重进冷却——否则会在掩体间来回蹦(反复横移主因)
	if((this.reloadT>0.3||this.suppression>1.05||this.hp<32)&&Math.random()<0.8){
	if(this.state!=='cover'||!this.coverPt){
	const cp=this.pickCoverNow();
	if(cp){ this.enterCover(cp,rand(1.4,2.6)+(this.reloadT>0?this.def.reload:0)); return; }
	if(this.coverCd>0&&this.hp>=32) return; // 冷却中无处可回: 原地坚持还击
	} else return;
	}
if(this.nades>0&&this.nadeCd<=0&&distT>9&&distT<30){
const hidden=nowT-this.lastSeenT>1.2;
let cluster=0;
for(const e of combatants) if(e.alive&&e.team!==this.team&&e.pos.distanceTo(this.target.pos)<7) cluster++;
if((hidden&&Math.random()<0.5)||(cluster>=2&&Math.random()<0.4)){
this.state='nade'; this.nadeAnimT=0.8;
return;
}
}
	// 机动未到期且局势未恶化: 延续当前机动 (防抖——不再每0.5s重抽姿态; 掩体状态除外; 驻停不被压制打断)
	if(this.state!=='cover'&&this.manT>0&&(this.suppression<1.1||this.man==='hold')&&(this.man==='hold'||this.man==='slide'||(this.man==='push'&&this.pushPt))){ this.state='combat'; this.coverPt=null; return; }
// 选新机动: 攻击性=性格×难度, 情境加成 (对手被压/刚停火/局部人多/目标旗在争夺)
const aggrD=[0.65,1,1.3][SETTINGS.diff];
let allies=0;
for(const s of soldiers){ if(s!==this&&s.alive&&s.team===this.team&&!s.onVehicle){ const dd2=(s.pos.x-this.pos.x)**2+(s.pos.z-this.pos.z)**2; if(dd2<400) allies++; } }
const tSup=this.target.suppression||0;
const tStop=nowT-(this.target.lastFiredT||-9);
let pushP=0.10*this.aggro*aggrD;
if(tSup>0.7) pushP+=0.30;
if(tStop>1.1&&tStop<3.5) pushP+=0.22;
if(allies>0) pushP+=Math.min(0.26,allies*0.13);
const fo=this.objective;
if(fo&&distT<55&&(fo.owner!==this.team||(fo.capTeam!==-1&&fo.capTeam!==this.team))) pushP+=0.22;
pushP=Math.min(pushP,0.85);
this.state='combat'; this.coverPt=null;
if(distT>14&&this.suppression<0.9&&Math.random()<pushP){
// 跃进: 借前出掩体逐段逼近 (掩体间跃进)
const pc=this.findCoverToward(this.target.pos.x,this.target.pos.z);
this.man='push'; this.manT=rand(2.6,4.0);
if(pc){ this.pushPt={x:pc.x,z:pc.z}; this.setPathTo(pc.x,pc.z); }
else { this.pushPt={x:this.pos.x+(this.target.pos.x-this.pos.x)*0.45,z:this.pos.z+(this.target.pos.z-this.pos.z)*0.45}; this.path=null; }
this.repathT=rand(2.5,3.5);
this.crouch=false; this.prone=false; this.stance='stand';
return;
}
	if(this.suppression>0.85||this.hp<55){
	// 压制下撤入掩体 (统一入口: 粘滞优先/冷却门控); 无掩体可进时按冷却侧移或原地蹲住还击
	const cp=this.pickCoverNow();
	if(cp){ this.enterCover(cp,rand(1.6,2.8)); return; }
	if(this.slideCd<=0){
	// 侧移脱离火力线: 方向延续不换边 + 冷却, 替代旧版无限左右蹦
	this.man='slide'; this.manT=rand(0.7,1.0); this.slideCd=rand(2.5,4.0);
	this.stance='crouch'; this.crouch=true; this.prone=false;
	} else {
	this.man='hold'; this.manT=rand(0.8,1.4);
	this.stance='crouch'; this.crouch=true; this.prone=false;
	}
	return;
	}
	if(distT<13&&this.slideCd<=0&&Math.random()<0.38*aggrD){
	// 近战侧移: 一次有界横移 (带冷却)
	this.man='slide'; this.manT=rand(0.7,1.1); this.slideCd=rand(2.5,4.0);
	return;
	}
	// 驻停射击: 姿态按距离/压制选定; 连续驻停保持原姿态 (防蹲站闪烁), 到期由 decide 重抽
	const wasHold=this.man==='hold';
	this.man='hold'; this.manT=rand(1.2,2.2);
	const ns=distT>40?(this.suppression>0.5||this.cls===3?'prone':'crouch')
	:distT>22?(this.cls===3?'prone':(Math.random()<0.7?'crouch':'stand'))
	:(this.suppression>0.9?'crouch':'stand');
	if(!(wasHold&&Math.random()<0.85)) this.stance=ns;
	return;
}
// 火力压制: 目标刚消失(0.6~2.6s)时朝最后目击位补点射
if(this.target&&this.target.alive&&this.mag>this.def.mag*0.25&&this.suppression>0.2&&nowT-this.lastSeenT>0.5&&nowT-this.lastSeenT<2.6&&Math.random()<0.35) this.supFireT=rand(0.5,1.0);
// 掩体内换弹/压制冷却: 视线断了也不贸然冲出去 (探头循环在 update 中继续)
if(this.state==='cover'&&this.coverPt&&this.coverT>0.4&&(this.reloadT>0||this.suppression>0.55||this.hp<50)&&nowT-this.lastSeenT<9) return;
if(this.target&&nowT-this.lastSeenT<9){
this.state='hunt';
if(!this.path||this.repathT<=0){ this.setPathTo(this.lastSeenPos.x+rand(-3,3),this.lastSeenPos.z+rand(-3,3)); this.repathT=3; }
return;
}
this.target=null;
// 脱战后打绷带
if(this.hp<=60&&this.bandages>0&&this.bandageT<=0&&nowT-this.lastSeenT>4){
this.bandageT=2.6; this.path=null;
return;
}
// 破袭: 进攻方接近补给库时用手雷炸毁
if(GAMEMODE==='demolition'&&this.team===ATK){
const dp=nearestDepot(this.pos.x,this.pos.z);
if(dp&&this.nades>0&&this.nadeCd<=0){
const dd=Math.hypot(dp.x-this.pos.x,dp.z-this.pos.z);
if(dd<26){
this.state='nade'; this.nadeAnimT=0.8;
this.lastSeenPos.set(dp.x,0,dp.z);
return;
}
}
}
// 附近有空载具时上车 (专属飞行员与小队成员除外)
if(!this.pilotOf&&!this.inSquad){
for(const tv of tanks){
if(!tv.alive||tv.team!==this.team||tv.crewBot||tv.playerDriven) continue;
if((tv.noEnterT||0)>nowT) continue;
if(tv.hp<tv.maxHp*0.4) continue;
if(tv.claimBot&&tv.claimBot.alive&&tv.claimBot!==this&&tv.claimBot.targetVeh===tv&&nowT-(tv.claimT||0)<8) continue;
const dv=Math.hypot(tv.pos.x-this.pos.x,tv.pos.z-this.pos.z);
if(dv<85){
tv.claimBot=this;
tv.claimT=nowT;
this.targetVeh=tv;
this.state='toVehicle';
if(!this.path||this.repathT<=0){ this.setPathTo(tv.pos.x,tv.pos.z); this.repathT=2.2; }
return;
}
}
}
// 医护兵放置医疗箱
if(this.cls===4&&(this.medkitT||0)<=nowT){
let allies=0;
for(const s of soldiers){
if(s!==this&&s.alive&&s.team===this.team&&!s.onVehicle&&Math.hypot(s.pos.x-this.pos.x,s.pos.z-this.pos.z)<14) allies++;
}
let hasOwn=false;
// 同队 5m 内已有医疗箱即视为"已放" (placeMedkit 会刷新复用, 不再叠放扎堆)
for(const c of MED_CRATES){
if(c.team===this.team&&c.uses>0&&c.life>0&&Math.hypot(c.x-this.pos.x,c.z-this.pos.z)<5){ hasOwn=true; break; }
}
if(allies>=1&&!hasOwn){
placeMedkit(this,this.pos.x+Math.sin(this.yaw)*0.9,this.pos.z+Math.cos(this.yaw)*0.9);
this.medkitT=nowT+35;
}
}
if(!this.objective||Math.random()<0.06) this.pickObjective();
const f=this.objective;
if(!f) return; // 无旗点模式兜底: 目标缺失时本帧只维持索敌与射击
const dObj=Math.hypot(this.pos.x-f.x,this.pos.z-f.z);
if(dObj<f.r*0.85){
this.state='defend';
// 迫击炮兵: 防守时架设迫击炮 (炮口朝敌方基地)
if(this.cls===6&&!this.mortarPlaced&&!this.mortUse&&!this.mgUse&&!this.empUse&&Math.random()<0.35){
const eb=basePos(1-this.team);
const dyaw=Math.atan2(eb.x-this.pos.x,eb.z-this.pos.z);
if(deployMortar(this,this.pos.x+Math.sin(dyaw)*1.3,this.pos.z+Math.cos(dyaw)*1.3,dyaw)){
this.decisionT=rand(0.5,1);
}
}
// 空闲迫击炮: 防守Bot就近上炮 (迫击炮兵优先; 使用前摇与玩家同规)
if(!this.mortUse&&!this.mgUse&&!this.empUse&&Math.random()<(this.cls===6?0.5:0.12)){
for(const mo of MORTARS){
if(!mo.alive||!empReady(mo)) continue;
if(Math.hypot(mo.x-this.pos.x,mo.z-this.pos.z)<(this.cls===6?18:11)){
mo.user=this;
this.emCast={kind:'mortar',g:mo,t:0,dur:0.9}; this.state='defend'; this.path=null;
return;
}
}
}
if(!this.mgUse&&Math.random()<0.25){
for(const mg of MG42S){
if(!empReady(mg)) continue;
if(Math.hypot(mg.x-this.pos.x,mg.z-this.pos.z)<14){
mg.user=this;
this.emCast={kind:'mg',g:mg,t:0,dur:0.9}; this.state='defend'; this.path=null; // 使用前摇与玩家同规
return;
}
}
}
if(!this.defendPt||Math.random()<0.3){
let best=null,bd=1e9;
for(const cp of coverPoints){
if(fireThreat(cp.x,cp.z,2.8)) continue; // 驻守点避开火线 (2026-09-02 火情规避)
const d=Math.hypot(cp.x-f.x,cp.z-f.z);
// 掩体限制在旗圈以内: 守方站在圈内才能真正阻断敌方占领
if(d<f.r*0.85){
const dd=d+rand(0,14);
if(dd<bd){ bd=dd; best=cp; }
}
}
this.defendPt=best||{x:f.x+rand(-6,6),z:f.z+rand(-6,6)};
this.setPathTo(this.defendPt.x,this.defendPt.z);
}
} else {
this.state='advance';
if(!this.path||this.repathT<=0){
this.setPathTo(f.x+rand(-6,6),f.z+rand(-6,6));
this.repathT=rand(4,7);
}
}
}
findCover(){
const threat=this.target?this.target.pos:this.lastSeenPos;
return this.findCoverFrom(threat);
}
// 掩体粘滞: 刚用过的掩体仍在附近且仍挡弹 → 直接回它, 不再挑新方块 (防掩体间来回蹦)
// 冷却期(刚出掩体)只有就在原掩体旁(≤3m, 相当于刚探头出来)才允许缩回; 走远了等冷却
reuseCover(){
const lc=this.lastCover; if(!lc) return null;
const dMe=Math.hypot(lc.x-this.pos.x,lc.z-this.pos.z);
if(dMe>10) return null;
if(this.coverCd>0&&dMe>3) return null;
const threat=this.target?this.target.pos:this.lastSeenPos;
const dist=Math.hypot(lc.x-threat.x,lc.z-threat.z);
if(dist<2) return null;
const org=V3(threat.x,Math.max(threat.y,heightAt(threat.x,threat.z))+1.5,threat.z);
const dir=V3(lc.x-threat.x,(heightAt(lc.x,lc.z)+0.9)-org.y,lc.z-threat.z).normalize();
const hit=raycastWorld(org,dir,dist);
return (hit&&hit.dist<=dist-0.8)?lc:null;
}
// 掩体选择统一入口: 粘滞优先; 冷却期且非重伤不挑新掩体
pickCoverNow(){
const rc=this.reuseCover();
if(rc) return rc;
if(this.coverCd>0&&this.hp>=32) return null;
return this.findCover();
}
// 掩体评分: 挡弹(硬性) + 可探头还击(加分) + 距离; 候选评估设上限防 raycast 超支 (按30v30预算)
findCoverFrom(threat){
const cands=[];
for(const cp of coverPoints){
const d=Math.hypot(cp.x-this.pos.x,cp.z-this.pos.z);
if(d<2.2||d>26) continue;
if(fireThreat(cp.x,cp.z,2.8)) continue; // 火线上的掩体不进 (2026-09-02 火情规避)
cands.push([d,cp]);
}
if(!cands.length) return null;
cands.sort((a,b)=>a[0]-b[0]);
let best=null,bd=1e9,n=0;
for(const [d,cp] of cands){
if(++n>12) break;
const dist=Math.hypot(cp.x-threat.x,cp.z-threat.z);
const org=V3(threat.x,Math.max(threat.y,heightAt(threat.x,threat.z))+1.5,threat.z);
const dir=V3(cp.x-threat.x,(heightAt(cp.x,cp.z)+0.9)-org.y,cp.z-threat.z).normalize();
const hit=raycastWorld(org,dir,dist);
if(!hit||hit.dist>dist-0.8) continue; // 挡不住威胁视线的不算掩体
let sc=d-rand(0,6);
if(this.peekLOS(cp.x,cp.z,threat,false)) sc-=3.5; // 站立可越顶还击的"活掩体"
if(sc<bd){ bd=sc; best=cp; }
if(sc<4) break; // 已足够好, 提前收工
}
return best;
}
// 前出掩体: 位于自己与威胁之间、显著更接近威胁且可挡弹 —— 掩体间跃进的落脚点
findCoverToward(tx,tz){
const dMe=Math.hypot(tx-this.pos.x,tz-this.pos.z);
const cands=[];
for(const cp of coverPoints){
const d=Math.hypot(cp.x-this.pos.x,cp.z-this.pos.z);
if(d<6||d>22) continue;
if(Math.hypot(tx-cp.x,tz-cp.z)>dMe-4) continue;
if(fireThreat(cp.x,cp.z,2.8)) continue; // 跃进落点不选火线 (2026-09-02 火情规避)
cands.push([d,cp]);
}
if(!cands.length) return null;
cands.sort((a,b)=>a[0]-b[0]);
let best=null,bd=1e9,n=0;
for(const [d,cp] of cands){
if(++n>10) break;
const dist=Math.hypot(cp.x-tx,cp.z-tz);
const org=V3(tx,heightAt(tx,tz)+1.5,tz);
const dir=V3(cp.x-tx,(heightAt(cp.x,cp.z)+0.9)-org.y,cp.z-tz).normalize();
const hit=raycastWorld(org,dir,dist);
if(!hit||hit.dist>dist-0.8) continue;
const sc=d+rand(0,3);
if(sc<bd){ bd=sc; best=cp; }
if(sc<8) break;
}
return best;
}
// 从(px,pz)能否看到tp —— 决定探头方式 (侧出1.15m蹲姿 / 原地越顶站姿)
peekLOS(px,pz,tp,stand){
const py=heightAt(px,pz)+(stand?1.62:1.15);
const ty=Math.max(tp.y,heightAt(tp.x,tp.z))+1.3;
const dir=V3(tp.x-px,ty-py,tp.z-pz);
const d=dir.length(); if(d<0.5) return true;
dir.normalize();
const hit=raycastWorld(V3(px,py,pz),dir,d);
return !hit||hit.dist>d-0.7;
}
// 选探头位: 固定一侧出溜(探头方向记忆, 不再左右换边), 被挡才试另一侧; 再不行试越顶站姿
pickPeekSide(){
const tp=(this.target&&this.target.alive)?this.target.pos:this.lastSeenPos;
const base=Math.atan2(tp.x-this.coverPt.x,tp.z-this.coverPt.z);
if(!this.peekSide) this.peekSide=Math.random()<0.5?1:-1;
const sides=[this.peekSide,-this.peekSide];
for(const s of sides){
const px=this.coverPt.x+Math.sin(base+HPI*s)*1.15;
const pz=this.coverPt.z+Math.cos(base+HPI*s)*1.15;
if(occBlocked(px,pz)) continue;
if(this.peekLOS(px,pz,tp,false)){ this.peekSide=s; return {x:px,z:pz,stand:false}; }
}
if(this.peekLOS(this.coverPt.x,this.coverPt.z,tp,true)) return {x:this.coverPt.x,z:this.coverPt.z,stand:true};
return null;
}
// 进掩体统一入口: 初始化探头循环
enterCover(cp,dur){
this.state='cover';
this.coverPt={x:cp.x,z:cp.z};
this.coverT=dur;
this.peekPhase='in'; this.peekPos=null; this.peekNext=nowT+rand(0.5,1.2);
this.prone=false;
this.setPathTo(cp.x,cp.z);
}
setPathTo(x,z){
if(NAV.budget<=0){ this.repathT=Math.min(this.repathT>0?this.repathT:0.3,0.3); return; }
NAV.budget--;
this.path=NAV.findPath(this.pos.x,this.pos.z,x,z);
this.pathI=0;
this.moveIntent=!!this.path;
}
update(dt){
if(!this.alive){
this.deathAnimT-=dt;
if(!this.ragdolled){
const k=clamp(1-Math.max(this.deathAnimT,0)/0.6,0,1);
if(k<=1){
if(!this.deathDir) this.deathDir=Math.random()<0.5?1:-1;
this.mesh.root.rotation.x=-HPI*k*this.deathDir;
this.mesh.pelvis.position.y=lerp(0.94,0.2,k);
this.mesh.tag.visible=false;
}
}
	this.respawnT-=dt;
	if(this.respawnT<2.5&&this.mesh.root.visible) this.mesh.root.visible=false;
	// 兵力票归零 → 该队封重生 (清场阶段敌方不再补充新兵, 2026-09-04)
	if(this.respawnT<=0&&!matchOver&&tickets[this.team]>0){
if(this.pilotOf){ /* 专属飞行员: 等待战机复活后随机载入 */ }
else { this.deathDir=0; this.spawn(); }
}
return;
}
// 乘员: 藏在载具里, 位置同步
if(this.onVehicle){
const v=this.onVehicle;
if(!v.alive||v.crewBot!==this){ this.onVehicle=null; this.mesh.root.visible=true; }
else {
this.pos.copy(v.pos); this.vel.set(0,0,0);
this.suppression=Math.max(0,this.suppression-dt*0.5);
this.target=null;
return;
}
}
// 跳伞下落 (bot)
if(this.chuting){
this.vel.set(0,0,0);
this.pos.y-=7*dt;
if(!this.chuteMesh){ this.chuteMesh=mkChuteForBot(); this.mesh.root.add(this.chuteMesh); this.chuteMesh.position.set(0,2.5,0); }
const gh=standHeight(this.pos.x,this.pos.z,this.pos.y);
if(this.pos.y<=gh){
this.pos.y=gh; this.chuting=false; this.decisionT=0;
if(this.chuteMesh){ this.mesh.root.remove(this.chuteMesh); this.chuteMesh=null; }
}
	this.updateMesh(dt,0);
	return;
}
// ── 固定火力点使用前摇 (2026-09-02 用户指定: Bot与玩家同规): 计时完成才认领, 占位被夺/报废即取消 ──
if(this.emCast){
const ec=this.emCast;
if((ec.g.user&&ec.g.user!==this)||(ec.kind==='mortar'&&!ec.g.alive)){
if(ec.g.user===this) ec.g.user=null;
this.emCast=null;
}
else{
ec.t+=dt;
if(ec.t>=ec.dur){
const g2=ec.g;
this.emCast=null;
if(g2.user===this){
this.state='defend'; this.path=null;
if(ec.kind==='mg'){ this.mgUse=g2; this.mgT=rand(14,24); this.pos.x=g2.x-Math.sin(g2.face)*0.8; this.pos.z=g2.z-Math.cos(g2.face)*0.8; }
else if(ec.kind==='mortar'){ this.mortUse=g2; this.mortT=rand(14,24); this.pos.x=g2.x-Math.sin(g2.face)*0.8; this.pos.z=g2.z-Math.cos(g2.face)*0.8; }
else if(ec.kind==='at'){ this.empUse=g2; this.empT=rand(18,30); this.pos.x=g2.x-Math.sin(g2.face)*1.2; this.pos.z=g2.z-Math.cos(g2.face)*1.2; }
else if(ec.kind==='aa'){ this.empUse=g2; this.empT=rand(14,24); this.pos.x=g2.x; this.pos.z=g2.z-0.9; }
this.decisionT=0;
}else{ if(g2.user===this) g2.user=null; }
}
}
}
// ── 火情规避 (优先级高于包扎/工事/战术机动): 火线逼近先逃命 ──
this.fireFleeT-=dt;
this.fireScanT-=dt;
if(this.fireScanT<=0){
this.fireScanT=0.22;
const ft=fireThreat(this.pos.x,this.pos.z,2.0);
if(ft){
this.fireFleeT=0.75;
// 逃生航向: 背离最近火心, 逐级侧偏选无火可立的落点 (全堵则直背火冲, moveDir 内还有二次避障)
const back=Math.atan2(-ft.dx,-ft.dz);
this.fleeYaw=back;
for(const da of [0,0.6,-0.6,1.2,-1.2,1.9,-1.9]){
const px=this.pos.x+Math.sin(back+da)*2.4, pz=this.pos.z+Math.cos(back+da)*2.4;
if(!occBlocked(px,pz)&&!fireThreat(px,pz,0.8)){ this.fleeYaw=back+da; break; }
}
// 逃命弃置: 火上的机枪/迫击炮/火炮手离炮, 包扎打断, 掩体驻留作废
if(this.mgUse){ releaseEmpl(this.mgUse,true); this.mgUse=null; }
if(this.mortUse){ releaseEmpl(this.mortUse,true); this.mortUse=null; }
if(this.empUse){ releaseEmpl(this.empUse,true); this.empUse=null; }
if(this.emCast){ if(this.emCast.g&&this.emCast.g.user===this) this.emCast.g.user=null; this.emCast=null; }
if(this.bandageT>0) this.bandageT=0;
if(this.state==='cover'){
this.lastCover=this.coverPt; this.coverCd=rand(3.5,6);
this.coverPt=null; this.state='combat'; this.man='hold'; this.manT=rand(0.8,1.4);
}
this.crouch=false; this.prone=false;
}
}
// ── 严寒失温 (2026-09-05 城市组·斯大林格勒, 玩家/Bot 同判定): 露天静止 COLD_OFF 秒起掉血,
//    冻僵后强迫重抽机动 (起身挪窝) —— 掩体驻留/驻停作废, 与火情逃命同款打断; 室内/载具/工事位豁免 ──
if(CAMPAIGN.cold&&!this.onVehicle){
this.coldScanT=(this.coldScanT||0)-dt;
if(this.coldScanT<=0){
this.coldScanT=0.3;
this.coldShelt=coldSheltered(this.pos.x,this.pos.y,this.pos.z);
}
const coldBusy=this.mgUse||this.empUse||this.mortUse||this.emCast||this.chuting;
const coldMoved=Math.hypot(this.vel.x,this.vel.z)>0.6;
if(coldMoved||coldBusy||this.coldShelt){
this.coldT=0; this.coldAcc=0;
}else{
this.coldT=(this.coldT||0)+dt;
if(this.coldT>COLD_OFF){
this.coldAcc=(this.coldAcc||0)+COLD_DMG*dt;
if(this.coldAcc>=1){ const d=Math.floor(this.coldAcc); this.coldAcc-=d; this.damage(d,null,false); }
// 冻僵反应: 原地驻停超过阈值 → 作废掩体驻留, 强迫侧移/跃进取暖 (部分重置计时防连冻)
if(this.coldT>COLD_OFF+2&&(this.state==='cover'||this.man==='hold')){
this.coldT=COLD_OFF-4;
if(this.state==='cover'){ this.lastCover=this.coverPt; this.coverCd=rand(3.5,6); this.coverPt=null; this.state='combat'; }
this.man='slide'; this.manT=rand(1.2,2); this.slideDir=Math.random()<0.5?-1:1;
this.crouch=false; this.prone=false;
}
}
}
}
// 包扎中
if(this.bandageT>0&&!this.mgUse&&!this.empUse){
this.bandageT-=dt;
this.vel.set(0,0,0);
this.crouch=true;
if(this.bandageT<=0){
this.bandages=Math.max(0,this.bandages-1);
this.hp=Math.min(100,this.hp+45);
this.crouch=false;
}
this.updateMesh(dt,0);
return;
}
this.perceptT-=dt;
if(this.perceptT<=0){ this.perceptT=0.16; this.perceive(); }
// 分心去做别的事时释放坦克占用, 避免空车被永久锁定
if(this.targetVeh&&this.state!=='toVehicle'){ if(this.targetVeh.claimBot===this) this.targetVeh.claimBot=null; this.targetVeh=null; }
this.decisionT-=dt;
if(this.decisionT<=0&&!(this.state==='nade'&&this.nadeAnimT>0)){ this.decisionT=rand(0.35,0.6); this.decide(); }
this.suppression=Math.max(0,this.suppression-dt*0.35);
this.nadeCd-=dt; this.repathT-=dt; this.reactT-=dt;
this.smokeCd-=dt;
// 甩枪偏差随时间收敛(命中修正)
this.aimErrX*=Math.pow(0.18,dt); this.aimErrY*=Math.pow(0.18,dt);
if(this.reloadT>0){
this.reloadT-=dt;
if(this.reloadT<=0){
this.mag=this.def.mag;
if(this.slots&&this.slots[0]) this.slots[0].mag=this.slots[0].def.mag;
}
}
if(this.pReloadT>0){
this.pReloadT-=dt;
if(this.pReloadT<=0&&this.slots[1]) this.pMag=this.slots[1].def.mag;
}
if(this.boltT>0) this.boltT-=dt;
if(this.fireT>0) this.fireT-=dt;
if(this.burstPause>0) this.burstPause-=dt;
if(this.supFireT>0) this.supFireT-=dt;
if(this.coverCd>0) this.coverCd-=dt;
if(this.slideCd>0) this.slideCd-=dt;
if(this.target&&this.target.onVehicle) this.target=null;
const engaged=this.target&&this.target.alive&&nowT-this.lastSeenT<4;
if(this.empUse){ this.updateEmplacement(dt); return; }
if(this.mgUse){
const mg=this.mgUse;
this.crouch=false; this.prone=false;
this.vel.set(0,0,0);
this.pos.x=mg.x-Math.sin(mg.face)*0.85;
this.pos.z=mg.z-Math.cos(mg.face)*0.85;
this.pos.y=standHeight(this.pos.x,this.pos.z,this.pos.y+1);
if(engaged){
const tp=this.target.pos;
const wantYaw=Math.atan2(tp.x-mg.x,tp.z-mg.z);
// 解除回旋限制: 机枪可360°转向目标
this.yaw=angleLerpTo(this.yaw,wantYaw,4*dt);
mg.yaw.rotation.y=angDiff(mg.face,this.yaw);
const dy=(tp.y+1.2)-(mg.y);
const dh=Math.hypot(tp.x-mg.x,tp.z-mg.z);
mg.pitch.rotation.x=-clamp(Math.atan2(dy,dh),-0.7,0.45);
mg.fireT-=dt; // 射速间隔在炮上: 换人不重置 (与玩家同规)
if(this.reactT<=0&&mg.fireT<=0&&mg.heat<1){
const mdef2=mg.def||{rpm:1100,dmg:26,heatPS:0.012};
mg.fireT=60/mdef2.rpm;
mg.heat+=mdef2.heatPS;
const eye=V3(mg.x,mg.y+0.1,mg.z);
const dir=V3(tp.x-eye.x,tp.y+1.1+rand(-0.4,0.4)-eye.y,tp.z-eye.z).normalize();
const spread=0.02*(this.suppression+0.7);
dir.x+=rand(-spread,spread); dir.y+=rand(-spread,spread); dir.z+=rand(-spread,spread); dir.normalize();
const muzzle=V3(mg.x+dir.x*1.3,mg.y+0.1+dir.y*1.3,mg.z+dir.z*1.3);
const mgDef={dmg:mdef2.dmg,headMul:1.8,snd:'mg',tracer:2,vehDmg:2.5};
this._src=mdef2.name||'重机枪'; // 击杀来源: 固定机枪座名称
fireBullet(this,eye,dir,mgDef,muzzle);
}
}
mg.heat=Math.max(0,mg.heat-dt*0.15);
this.updateMesh(dt,0);
return;
}
if(this.mortUse){
const mo=this.mortUse;
this.mortT-=dt; mo.cd-=dt;
this.crouch=true; this.prone=false;
this.vel.set(0,0,0);
this.pos.x=mo.x-Math.sin(mo.face)*0.85;
this.pos.z=mo.z-Math.cos(mo.face)*0.85;
this.pos.y=standHeight(this.pos.x,this.pos.z,this.pos.y+1);
this.yaw=angleLerpTo(this.yaw,mo.face,4*dt);
if(mo.cd<=0){
// 选target: 已知敌人暴露点 > 敌占/被夺旗点(附近无友军)
let tx=null,tz=null;
if(this.target&&this.target.alive&&nowT-this.lastSeenT<6){
const d=Math.hypot(this.lastSeenPos.x-mo.x,this.lastSeenPos.z-mo.z);
if(d>26&&d<130){ tx=this.lastSeenPos.x; tz=this.lastSeenPos.z; }
}
if(tx===null){
let bd=1e9;
for(const f2 of FLAGS){
if(f2.owner===this.team&&!(f2.capTeam!==-1&&f2.capTeam!==this.team)) continue;
const d=Math.hypot(f2.x-mo.x,f2.z-mo.z);
if(d<26||d>130||d>=bd) continue;
let allyNear=false;
for(const s2 of soldiers){ if(s2.alive&&s2.team===this.team&&Math.hypot(s2.pos.x-f2.x,s2.pos.z-f2.z)<12){ allyNear=true; break; } }
if(allyNear) continue;
bd=d; tx=f2.x; tz=f2.z;
}
}
if(tx!==null){
mo.cd=rand(4.2,6.5);
const sx=tx+rand(-7,7), sz=tz+rand(-7,7);
const dH=Math.hypot(sx-mo.x,sz-mo.z);
const tof=clamp(dH/42,1.8,4.2);
const v=V3((sx-mo.x)/tof,0.5*9.8*tof,(sz-mo.z)/tof);
const nPos=V3(mo.x,mo.y+0.25,mo.z);
this._src='迫击炮'; // 击杀来源: 固定迫击炮
const shell=new THREE.Mesh(nadeGeoAT,vmMats.gun); shell.position.copy(nPos); scene.add(shell);
nades.push({m:shell,pos:nPos.clone(),vel:v,fuse:9,thrower:this,team:this.team,spin:V3(3,0,0.5),bounces:0,mortar:true});
AudioSys.mortarThunk(this.pos.distanceTo(camera.position));
spawnP(PT.dark,mo.x,mo.y+0.4,mo.z,0,1.4,0,0.5,1.6,0.6,0.5,0.2);
mo.tube.rotation.x=0.5;
} else mo.cd=1.4;
}
mo.tube.rotation.x=dampF(mo.tube.rotation.x,0.62,5,dt);
// 敌人逼近/压制/时间到: 离炮
const engagedClose=this.target&&this.target.alive&&nowT-this.lastSeenT<3&&Math.hypot(this.target.pos.x-this.pos.x,this.target.pos.z-this.pos.z)<14;
if(this.mortT<=0||engagedClose||this.suppression>1.2){
releaseEmpl(mo,true); this.mortUse=null; // 离炮: 上炮冷却
}
this.updateMesh(dt,0);
return;
}
if(this.state==='melee'&&engaged){
const d=Math.hypot(this.target.pos.x-this.pos.x,this.target.pos.z-this.pos.z);
this.faceTo(this.target.pos,dt,7);
if(d>1.6){ this.moveDir(Math.atan2(this.target.pos.x-this.pos.x,this.target.pos.z-this.pos.z),4.4,dt); }
this.meleeT-=dt;
if(d<2.3&&this.meleeT<=0){
this.meleeT=1.1;
setTimeout(()=>{
if(this.alive&&this.target&&this.target.alive){
const dd=Math.hypot(this.target.pos.x-this.pos.x,this.target.pos.z-this.pos.z);
if(dd<2.6){ this.target.damage(70,this,false); AudioSys.click(500,0.4,0.08); }
}
},380);
this.mesh.armR.sh.userData.swing=0.4;
}
this.updateMesh(dt,Math.hypot(this.vel.x,this.vel.z));
return;
}
if(this.state==='atnade'){
const tk=this.atTankTarget;
if(!tk||!tk.alive){ this.state='idle'; this.nadeAnimT=0; }
else {
this.faceTo(tk.pos,dt,6);
this.vel.set(0,0,0);
this.nadeAnimT-=dt;
this.mesh.armR.sh.userData.swing=0.6;
if(this.nadeAnimT<=0){
this.atn--; this.nadeCd=rand(8,14);
if(this.cls===5&&this.def.rocket&&this.slots[0]&&this.mag<=0){ this.reloadT=this.def.reload; }
const eye=this.eyePos();
const lead=V3(tk.pos.x+Math.sin(tk.yaw)*tk.vel*0.5,tk.pos.y+0.8,tk.pos.z+Math.cos(tk.yaw)*tk.vel*0.5);
const dist=eye.distanceTo(lead);
const tof=clamp(dist/12,0.7,1.8);
const vel=lead.sub(eye).multiplyScalar(1/tof);
vel.y+=0.5*9.8*tof;
this._src='反坦克雷';
throwNade(this,eye,vel,1.6,true);
this.state='combat';
}
this.updateMesh(dt,0);
return;
}
}
if(this.state==='nade'){
this.faceTo(this.lastSeenPos,dt,5);
this.vel.set(0,0,0);
this.nadeAnimT-=dt;
this.mesh.armR.sh.userData.swing=0.6;
if(this.nadeAnimT<=0){
this.nades--; this.nadeCd=rand(13,22);
const eye=this.eyePos();
const tgt=V3(this.lastSeenPos.x+rand(-2,2),heightAt(this.lastSeenPos.x,this.lastSeenPos.z),this.lastSeenPos.z+rand(-2,2));
const dist=eye.distanceTo(tgt);
const tof=clamp(dist/13,0.75,1.9);
const vel=tgt.sub(eye).multiplyScalar(1/tof);
vel.y+=0.5*9.8*tof;
this._src='手雷';
throwNade(this,eye,vel);
this.state='combat';
}
this.updateMesh(dt,0);
return;
}
let speed=0, moveYaw=this.yaw;
let wantMove=false;
if(this.state==='cover'&&this.coverPt){
const d=Math.hypot(this.coverPt.x-this.pos.x,this.coverPt.z-this.pos.z);
if(d>1.2){
wantMove=true; speed=4.8;
moveYaw=this.followPath(dt)??Math.atan2(this.coverPt.x-this.pos.x,this.coverPt.z-this.pos.z);
this.crouch=false; this.prone=false;
} else {
this.coverT-=dt;
if(this.mag<this.def.mag*0.4&&this.reloadT<=0){ this.reloadT=this.def.reload; }
if(this.hp<50&&this.bandages>0&&this.bandageT<=0&&this.reloadT<=0&&this.coverT>1.2){ this.bandageT=2.2; }
// 探头循环: 蹲瞄(藏) → 侧出/越顶射击1~1.7s → 缩回 (实现旧版遗留未用的 peekT)
if(this.peekPhase==='in'){
this.crouch=true; this.prone=false;
if(this.target&&this.target.alive&&nowT-this.lastSeenT<8&&nowT>=this.peekNext&&this.coverT>0.4&&(nowT-this.lastHitT>0.7||this.suppression<0.9)){
const side=this.pickPeekSide();
if(side){ this.peekPhase='out'; this.peekT=rand(1.0,1.7); this.peekPos=side; }
else this.peekNext=nowT+rand(1.2,2.0);
}
} else {
this.peekT-=dt;
this.crouch=!this.peekPos.stand; this.prone=false;
const dp=Math.hypot(this.peekPos.x-this.pos.x,this.peekPos.z-this.pos.z);
if(dp>0.55){ wantMove=true; speed=2.4; moveYaw=Math.atan2(this.peekPos.x-this.pos.x,this.peekPos.z-this.pos.z); }
if(this.peekT<=0||(nowT-this.lastHitT<0.25&&this.suppression>1.0)||!this.target||!this.target.alive){
this.peekPhase='in'; this.peekPos=null; this.peekNext=nowT+rand(1.2,2.4);
}
}
if(this.coverT<=0){
this.state='combat'; this.man='hold'; this.manT=rand(0.8,1.5);
this.stance=this.suppression>0.8?'crouch':'stand';
// 出掩体记录: 记住这个掩体+重进冷却 (再受压时优先回这里, 不在方块间蹦)
this.lastCover=this.coverPt; this.coverCd=rand(3.5,6); this.coverPt=null;
}
}
}
else if(this.state==='combat'){
const seen=!!(this.target&&this.target.alive&&nowT-this.lastSeenT<1.6);
if(this.man==='push'&&this.pushPt){
// 掩体间跃进: 冲向的前出掩体, 到位转驻停 (decide 再决定下一段跃进); 到不了也限时收敛, 防无限磨蹭
this.manT-=dt;
const dP=Math.hypot(this.pushPt.x-this.pos.x,this.pushPt.z-this.pos.z);
this.crouch=false; this.prone=false;
if(dP<1.4||this.manT<=0){
this.man='hold'; this.manT=rand(1.0,2.0); this.pushPt=null; this.stance='crouch';
} else {
const my=this.followPath(dt);
moveYaw=my!==null?my:Math.atan2(this.pushPt.x-this.pos.x,this.pushPt.z-this.pos.z);
wantMove=true;
speed=this.suppression>1.0?3.8:5.2;
if(this.suppression>1.0) this.crouch=true;
}
} else if(this.man==='slide'){
this.manT-=dt;
if(!seen){ this.man='hold'; this.stance='crouch'; }
else {
// 侧移方向延续 (slideDir 出生时定, 不换边), 到期转驻停; 冷却由 decide 门控
const toT=Math.atan2(this.target.pos.x-this.pos.x,this.target.pos.z-this.pos.z);
moveYaw=toT+HPI*this.slideDir;
wantMove=true; speed=3.2;
this.crouch=this.suppression>0.5; this.prone=false;
}
if(this.manT<=0){ this.man='hold'; this.manT=rand(0.8,1.6); this.stance=this.suppression>0.9?'crouch':'stand'; }
} else {
// 驻停: 姿态保持; manT 到期后由 decide 重抽机动 (旧版0.3s地板导致永远不重抽→推进欲望被吞)
this.manT-=dt;
this.crouch=this.stance==='crouch';
this.prone=this.stance==='prone';
}
}
else if(this.state==='hunt'){
const my=this.followPath(dt);
if(my!==null){ moveYaw=my; wantMove=true; speed=this.suppression>0.5?2.4:3.4;
// 受压制时蛇形接近
if(this.suppression>0.25) moveYaw+=Math.sin(nowT*2.2+this.wanderSeed*4)*0.4;
this.crouch=this.suppression>0.8;
}
else if(this.target&&Math.hypot(this.lastSeenPos.x-this.pos.x,this.lastSeenPos.z-this.pos.z)<5){
// 到达最后目击点: 原地环视搜索 (旧版到点后傻站不动)
this.crouch=this.suppression>0.5;
this.scanT=(this.scanT||0)-dt;
if(this.scanT<=0){ this.scanT=rand(1.2,2.2); this.scanYaw=this.yaw+rand(-1.5,1.5); }
this.yaw=angleLerpTo(this.yaw,this.scanYaw??this.yaw,2.2*dt);
}
this.prone=false;
}
else if(this.state==='advance'){
const my=this.followPath(dt);
if(my!==null){ moveYaw=my; wantMove=true; speed=this.suppression>0.6?3.0:5.0;
if(this.suppression>0.25) moveYaw+=Math.sin(nowT*2.0+this.wanderSeed*4)*0.35;
}
this.crouch=false; this.prone=false;
}
else if(this.state==='toVehicle'){
const tv=this.targetVeh;
if(!tv||!tv.alive||tv.crewBot||tv.playerDriven||tv.hp<tv.maxHp*0.4){ this.state='idle'; this.targetVeh=null; if(tv&&tv.claimBot===this) tv.claimBot=null; }
else {
tv.claimT=nowT;
const d=Math.hypot(tv.pos.x-this.pos.x,tv.pos.z-this.pos.z);
if(d<3.8){ this.enterVehicle(tv); return; }
const my=this.followPath(dt);
moveYaw=my!==null?my:Math.atan2(tv.pos.x-this.pos.x,tv.pos.z-this.pos.z);
wantMove=true; speed=5.2;
this.crouch=false; this.prone=false;
}
}
else if(this.state==='defend'){
const my=this.followPath(dt);
if(my!==null){ moveYaw=my; wantMove=true; speed=2.6; }
else {
this.crouch=Math.random()<0.002?!this.crouch:this.crouch;
if(!engaged){
this.scanT=(this.scanT||0)-dt;
if(this.scanT<=0){ this.scanT=rand(2,4); this.scanYaw=this.yaw+rand(-1.6,1.6); }
this.yaw=angleLerpTo(this.yaw,this.scanYaw??this.yaw,1.2*dt);
}
}
}
// 逃命覆盖: 火线上不做战术机动, 背火疾跑脱身 (瞄准/还击由下方 faceTo 独立处理, 不中断)
if(this.fireFleeT>0){
wantMove=true; moveYaw=this.fleeYaw; speed=5.7;
this.crouch=false; this.prone=false; this.stance='stand';
}
if(wantMove){ this.moveDir(moveYaw,speed*this.speedMul,dt); } else { this.vel.x*=0.7; this.vel.z*=0.7; }
if(wantMove&&this.unstickT<=0){
this.stuckT+=dt;
if(this.stuckT>0.9){
// 阈值收紧: 人群里缓慢挪动(>0.45m/0.9s)不算卡住, 不再触发侧蹿
if(this.pos.distanceTo(this.lastPos)<0.45){
// 脱困侧蹿: 方向延续(同侧原地再卡才换向)——旧版每次随机换向=左右猛蹿, 基地人群/方块间看起来在反复横移
this.unstickT=rand(0.3,0.45);
const progressed=!this.lastUnstickP||this.pos.distanceTo(this.lastUnstickP)>1.5;
if(!progressed) this.unstickDir=-this.unstickDir;
this.lastUnstickP=this.pos.clone();
// 连续3次脱困仍无真进展: 在路径前插一个垂直绕行点 (堵墙/窄缝兜底, A*盲区之外的保底)
this.stuckN=progressed?0:(this.stuckN||0)+1;
let detoured=false;
if(this.stuckN>=3){
const s=this.unstickDir;
const dx=this.pos.x+Math.sin(this.yaw+HPI*s)*7, dz=this.pos.z+Math.cos(this.yaw+HPI*s)*7;
if(!occBlocked(dx,dz)&&NAV.lineClear(this.pos.x,this.pos.z,dx,dz)){
if(this.path){ this.path.unshift([dx,dz]); this.pathI=0; }
else this.setPathTo(dx,dz);
// 绕行保护期: 防止小队/目标点重寻路立刻覆盖刚插入的绕行点
this.repathT=rand(2,3);
detoured=true;
}
this.stuckN=0;
}
if(!detoured){ this.path=null; this.repathT=0; }
}
this.lastPos.copy(this.pos);
this.stuckT=0;
}
} else if(!wantMove) this.stuckT=0;
	if(this.target&&this.target.alive&&nowT-this.lastSeenT<1.6){
	// 拟人转身: 刚发现目标转得慢, 瞄稳后跟枪快
	this.faceTo(this.target.pos,dt,4+this.aimSettle*3.5);
	} else if(this.target&&nowT-this.lastSeenT<8){
	this.faceTo(this.lastSeenPos,dt,4);
	} else if(wantMove){
	this.yaw=angleLerpTo(this.yaw,moveYaw,5*dt);
	}
	// 开火窗口: 目标在视野内(0.6s)正常射击; 刚丢失(压制窗口)朝最后目击位补射; 探头出位才从掩体开枪
	// (修复旧版: 目标消失后仍朝其"实时坐标"扫射4秒的穿墙泼弹)
	const tgtVis=this.target&&this.target.alive&&nowT-this.lastSeenT<0.6;
	const fireGate=!(this.state==='cover'&&this.peekPhase!=='out');
	if((tgtVis||this.supFireT>0)&&fireGate&&this.reactT<=0&&this.reloadT<=0&&this.boltT<=0){
	const tp=tgtVis?this.target.pos:this.lastSeenPos;
const dT=Math.hypot(tp.x-this.pos.x,tp.z-this.pos.z);
const wantYaw=Math.atan2(tp.x-this.pos.x,tp.z-this.pos.z);
// 远距离要求瞄得更正才开枪
const aimGate=dT>50?0.08:(dT>25?0.11:0.16);
	if(Math.abs(angDiff(this.yaw,wantYaw))<aimGate){
	if(!tgtVis){
	// 压制射击: 朝最后目击位泼点射 (筒子/迫击炮保留弹药)
	if(!this.def.rocket&&!this.def.mortar&&this.mag>0){
	this.shootAtPos(V3(tp.x+rand(-1.6,1.6),tp.y+rand(0.2,1.4),tp.z+rand(-1.6,1.6)));
	this.fireT=this.def.type==='auto'?60/this.def.rpm:rand(0.55,0.95);
	this.supFireT-=0.4;
	}
	}
	else if(this.def.rocket||(this.def.mortar&&dT<22)){
// 反坦克兵/迫击炮兵近距离改用手枪自卫
if(this.pReloadT<=0&&this.fireT<=0){
if(this.pMag<=0){ this.pReloadT=this.slots[1]?this.slots[1].def.reload:2; }
else {
this.shootAt(this.target,this.slots[1].def);
this.fireT=(60/this.slots[1].def.rpm)*rand(1.4,2.4);
}
}
}
else if(this.def.mortar){
// 迫击炮曲射: 朝最后目击位吊射, 无需直瞄
if(this.mag>0&&this.fireT<=0&&dT>22&&dT<100){
const eye=this.eyePos();
const tx=this.lastSeenPos.x+rand(-7,7), tz=this.lastSeenPos.z+rand(-7,7);
const dist2=Math.hypot(tx-this.pos.x,tz-this.pos.z);
const tof=clamp(dist2/15,1.7,3.4);
const v=V3((tx-eye.x)/tof,0,(tz-eye.z)/tof);
v.y=0.5*9.8*tof;
const m=new THREE.Mesh(nadeGeoAT,vmMats.gun);
m.position.copy(eye); scene.add(m);
nades.push({m,pos:eye.clone(),vel:v,fuse:9,thrower:this,team:this.team,spin:V3(4,0,1),bounces:0,mortar:true});
AudioSys.mortarThunk(this.pos.distanceTo(camera.position));
this.mag--;
this.fireT=rand(4.5,6.5);
if(this.mag<=0) this.reloadT=this.def.reload;
this.mesh.armR.sh.userData.swing=0.3;
this.crouch=true;
}
}
else if(this.def.type==='auto'){
if(this.mag>0&&this.burstPause<=0){
// 距离化点射节奏: 近距离长点射泼弹, 远距离两三发短点
if(this.burstLeft<=0){ this.burstLeft=dT>45?randi(2,3):(dT>18?randi(3,5):randi(5,9)); }
if(this.fireT<=0){
this.shootAt(this.target);
this.fireT=60/this.def.rpm;
if(--this.burstLeft<=0) this.burstPause=dT>45?rand(0.8,1.6):(dT>18?rand(0.5,1.0):rand(0.25,0.55));
}
}
} else {
if(this.mag>0&&this.fireT<=0){
this.shootAt(this.target);
this.fireT=this.def.type==='bolt'?0.1:(dT>40?rand(0.6,1.1):rand(0.4,0.75));
if(this.def.type==='bolt') this.boltT=this.def.boltT||1.0;
}
}
}
}
if(this.mag<=0&&this.reloadT<=0){ this.reloadT=this.def.reload*rand(1,1.25); }
this.updateMesh(dt,Math.hypot(this.vel.x,this.vel.z));
}
updateEmplacement(dt){
const g=this.empUse;
this.crouch=false; this.prone=false;
this.vel.set(0,0,0);
this.pos.y=standHeight(this.pos.x,this.pos.z,this.pos.y+1);
g.cd-=dt;
if(g.kind==='at'){
this.pos.x=g.x-Math.sin(g.face)*1.2;
this.pos.z=g.z-Math.cos(g.face)*1.2;
const tk=enemyTankNear(this,160);
if(tk){
const wantYaw=Math.atan2(tk.pos.x-g.x,tk.pos.z-g.z);
// 解除回旋钳制: 360°转向目标
const rel=angDiff(g.face,wantYaw);
g.yaw.rotation.y=dampF(g.yaw.rotation.y,rel,4,dt);
this.yaw=g.face+g.yaw.rotation.y;
const dh=Math.hypot(tk.pos.x-g.x,tk.pos.z-g.z);
const pit=clamp(Math.atan2((tk.pos.y+1.2)-g.y,dh),-0.55,0.6);
g.pitch.rotation.x=dampF(g.pitch.rotation.x,-pit,4,dt);
if(Math.abs(angDiff(g.face+g.yaw.rotation.y,wantYaw))<0.05&&g.cd<=0&&this.reactT<=0){
g.cd=5.2+rand(0,1.4);
const dir=V3(Math.sin(this.yaw)*Math.cos(pit),Math.sin(pit),Math.cos(this.yaw)*Math.cos(pit));
const er=0.02*DIFF_TABLE[SETTINGS.diff].spreadMul;
dir.x+=rand(-er,er); dir.y+=rand(-er,er)*0.6; dir.z+=rand(-er,er); dir.normalize();
const o=V3(g.x,g.y+0.25,g.z).addScaledVector(dir,2.6);
const chk=raycastWorld(o,dir,dh);
if(!chk||chk.dist>dh-4){
AudioSys.cannon(o.distanceTo(camera.position)*1.3);
spawnP(PT.flash,o.x,o.y,o.z,dir.x*3,dir.y*3,dir.z*3,0.8,8,0.1,1,0,true);
spawnP(PT.dark,o.x,o.y,o.z,dir.x*2,1,dir.z*2,0.8,2.5,0.8,0.7,0.5);
shells.push({pos:o.clone(),vel:dir.clone().multiplyScalar(150),team:this.team,owner:this,life:3,kind:'at',trail:0});
this.lastFiredT=nowT;
	} else g.cd=3.5; // 被墙/地形挡住打不中: 较长间隔重试, 避免"连续开炮"观感
}
}
} else {
this.pos.x=g.x; this.pos.z=g.z-0.9;
const pl=enemyPlaneAlive(this.team);
if(pl){
const lead=pl.pos.clone();
const dist=lead.distanceTo(V3(g.x,g.y,g.z));
const tof=dist/150;
lead.x+=Math.sin(pl.yaw)*Math.cos(pl.pitch)*pl.speed*tof*0.5+rand(-25,25);
lead.z+=Math.cos(pl.yaw)*Math.cos(pl.pitch)*pl.speed*tof*0.5+rand(-25,25);
lead.y+=Math.sin(pl.pitch)*pl.speed*tof*0.5+rand(-8,8);
const wantYaw=Math.atan2(lead.x-g.x,lead.z-g.z);
g.yaw.rotation.y=angleLerpTo(g.yaw.rotation.y,wantYaw,3*dt);
this.yaw=g.yaw.rotation.y;
const dh=Math.hypot(lead.x-g.x,lead.z-g.z);
const pit=clamp(Math.atan2(lead.y-g.y,Math.max(dh,3)),-0.45,1.35);
g.pitch.rotation.x=dampF(g.pitch.rotation.x,-pit,5,dt);
if(g.cd<=0&&dist<220){
g.cd=0.62;
const dir=V3(Math.sin(wantYaw)*Math.cos(pit),Math.sin(pit),Math.cos(wantYaw)*Math.cos(pit));
const er=0.05*DIFF_TABLE[SETTINGS.diff].spreadMul;
dir.x+=rand(-er,er); dir.y+=rand(-er,er)*0.7; dir.z+=rand(-er,er); dir.normalize();
fireFlak(g,this,dir);
this.lastFiredT=nowT;
}
}
}
this.updateMesh(dt,0);
}
followPath(dt){
if(!this.path||this.pathI>=this.path.length){ this.path=null; return null; }
const wp=this.path[this.pathI];
const dx=wp[0]-this.pos.x, dz=wp[1]-this.pos.z;
if(dx*dx+dz*dz<1.44){ this.pathI++; return this.followPath(dt); }
return Math.atan2(dx,dz);
}
moveDir(yaw,speed,dt){
if(this.unstickT>0){
this.unstickT-=dt;
yaw+=HPI*this.unstickDir;
speed=Math.min(speed,2.2); // 脱困侧蹿限速: 大步幅侧跳看起来就是反复横移
} else {
const probe=(a)=>{
const px=this.pos.x+Math.sin(a)*1.1, pz=this.pos.z+Math.cos(a)*1.1;
if(occBlocked(px,pz)) return false;
// 膝高射线兜底: 半埋矮石/矮坎低于占用格门槛( maxY<gh+0.5 ), 占用格看不见但物理挡人
const low=raycastWorld(V3(this.pos.x,this.pos.y+0.35,this.pos.z),V3(Math.sin(a),0,Math.cos(a)),1.1);
return !low;
};
if(!probe(yaw)){
let found=false;
for(const da of [0.55,-0.55,1.1,-1.1,1.65,-1.65]){
if(probe(yaw+da)){ yaw+=da; found=true; break; }
}
if(!found) yaw+=Math.PI*(Math.random()<0.5?0.5:-0.5);
}
}
	const cr=this.prone?0.28:this.crouch?0.5:1;
	const wf=nowT-(this.wireT||-9)<0.3?0.42:1;
	// 深谷激流: 涉水大幅减速并持续受创 (寻路本不走河道, 误入/被冲入时尽快脱身)
	const riv=inRiverChannel(this.pos.x,this.pos.z);
	if(riv) this.damage(8*dt,null,false);
	this.vel.x=Math.sin(yaw)*speed*cr*wf*(riv?0.4:1);
	this.vel.z=Math.cos(yaw)*speed*cr*wf*(riv?0.4:1);
this.pos.x+=this.vel.x*dt;
this.pos.z+=this.vel.z*dt;
collideMove(this.pos,0.4);
const gh=standHeight(this.pos.x,this.pos.z,this.pos.y+0.6);
this.pos.y=dampF(this.pos.y,gh,20,dt);
}
faceTo(p,dt,rate){
const wantYaw=Math.atan2(p.x-this.pos.x,p.z-this.pos.z);
this.yaw=angleLerpTo(this.yaw,wantYaw,rate*dt);
const dy=(p.y+1.3)-(this.pos.y+1.5);
const dh=Math.hypot(p.x-this.pos.x,p.z-this.pos.z);
this.pitch=dampF(this.pitch,Math.atan2(dy,Math.max(dh,0.1)),8,dt);
}
shootAt(tgt,def2){
const aimP=V3(tgt.pos.x,tgt.pos.y+(tgt.prone?0.32:tgt.crouch?0.9:1.25)+rand(-0.12,0.2),tgt.pos.z);
if(tgt.vel){ aimP.x+=tgt.vel.x*rand(0,0.12); aimP.z+=tgt.vel.z*rand(0,0.12); }
this.aimShot(aimP,def2,tgt.vel?Math.hypot(tgt.vel.x,tgt.vel.z):0);
}
// 对固定点射击 (压制/补射): 无预判
shootAtPos(p,def2){
this.aimShot(V3(p.x,p.y,p.z),def2,0);
}
aimShot(aimP,def2,tSpd){
if(def2) this.pMag--;
else this.mag--;
const useDef=def2||this.def;
this._src=(useDef&&useDef.name)||''; // 击杀来源: 当前武器名 (含自选手枪/固定点武器)
const diff=DIFF_TABLE[SETTINGS.diff];
const eye=this.eyePos();
const dir=aimP.sub(eye).normalize();
const dHor=Math.hypot(aimP.x-this.pos.x,aimP.z-this.pos.z);
let err=(1.7-this.aimSettle)*diff.spreadMul*(1+this.suppression*1.0)*(this.crouch?0.75:1)*0.016;
err*=1+clamp((tSpd||0)/5,0,1.2)*0.85;
if(def2) err*=1.3;
if(this.prone) err*=0.55;
else if(Math.hypot(this.vel.x,this.vel.z)<0.4&&this.crouch&&(this.state==='defend'||this.state==='cover')) err*=0.6;
if(dHor<15) err*=1.4;
else if(dHor<28) err*=1.15;
if(this.target&&this.target.isPlayer&&this.target.sprinting) err*=1.2;
dir.x+=rand(-err,err); dir.y+=rand(-err,err)*0.7; dir.z+=rand(-err,err);
// 拟人瞄准: 甩枪初始偏差 + 缓慢呼吸漂移 (沿视线的横向/纵向)
const sideX=dir.z, sideZ=-dir.x;
const wob=(Math.sin(nowT*1.5+this.wanderSeed*3)+Math.sin(nowT*2.7+this.wanderSeed)*0.5)*0.011*(1.4-this.aimSettle);
dir.x+=sideX*(this.aimErrX+wob); dir.z+=sideZ*(this.aimErrX+wob);
dir.y+=this.aimErrY+Math.sin(nowT*1.1+this.wanderSeed*2)*0.007*(1.4-this.aimSettle);
dir.normalize();
const muzzleP=eye.clone().addScaledVector(V3(Math.sin(this.yaw),this.pitch*0.5,Math.cos(this.yaw)).normalize(),0.7);
muzzleP.y-=0.12;
fireBullet(this,eye,dir,useDef,muzzleP);
this.mesh.armR.sh.userData.swing=0.12;
}
updateMesh(dt,speed){
const m=this.mesh;
m.root.position.copy(this.pos);
m.root.rotation.set(0,this.yaw,0);
const engaged=(this.target&&nowT-this.lastSeenT<4.5)||this.mgUse||this.empUse;
const prone=this.prone, crouch=this.crouch&&!prone;
const sprint=speed>4.4&&!engaged&&!prone;
const pelY=prone?0.22:crouch?0.6:0.94;
m.pelvis.position.y=dampF(m.pelvis.position.y,pelY,10,dt);
const torsoX=prone?1.5:crouch?0.14:(sprint?0.3:0.05);
m.pelvis.rotation.x=dampF(m.pelvis.rotation.x,torsoX,8,dt);
const pp=m.pelvis.rotation.x;
// 侧身站姿(枪手姿态)
const blade=prone?0.08:sprint?0:(engaged?0.5:0.3);
m.pelvis.rotation.y=dampF(m.pelvis.rotation.y,-blade,7,dt);
m.headG.rotation.y=-m.pelvis.rotation.y*0.85;
this.animT+=dt*(3+speed*1.9);
const t=this.animT, S=Math.sin(t);
const sw=prone?clamp(speed/1.2,0,1)*0.35:clamp(speed/4,0,1.3)*0.62;
if(prone){
// 匍匐: 双腿伸直贴地拖在身后, 爬行时交替蹬腿
m.legL.hip.rotation.x=dampF(m.legL.hip.rotation.x,0.04+S*sw*0.5,10,dt);
m.legR.hip.rotation.x=dampF(m.legR.hip.rotation.x,0.04-S*sw*0.5,10,dt);
m.legL.knee.rotation.x=dampF(m.legL.knee.rotation.x,0.08+Math.max(0,S)*sw*0.9,10,dt);
m.legR.knee.rotation.x=dampF(m.legR.knee.rotation.x,0.08+Math.max(0,-S)*sw*0.9,10,dt);
} else if(crouch){
m.legL.hip.rotation.x=dampF(m.legL.hip.rotation.x,-1.05+S*sw*0.5,10,dt);
m.legR.hip.rotation.x=dampF(m.legR.hip.rotation.x,-0.5-S*sw*0.5,10,dt);
m.legL.knee.rotation.x=dampF(m.legL.knee.rotation.x,1.3,10,dt);
m.legR.knee.rotation.x=dampF(m.legR.knee.rotation.x,0.95,10,dt);
} else {
m.legL.hip.rotation.x=S*sw-torsoX*0.6;
m.legR.hip.rotation.x=-S*sw-torsoX*0.6;
m.legL.knee.rotation.x=Math.max(0,-S)*sw*1.5+0.06;
m.legR.knee.rotation.x=Math.max(0,S)*sw*1.5+0.06;
}
const rl=this.reloadT>0;
// 持枪姿态: shX=肩前后摆, shY=肩水平转, shZ=肩外展(横向), el=肘弯
let shR,elR,shL,elL,shRy=0,shLy=0,shRz=0,shLz=0;
if(prone){
// 匍匐: 双肘撑地, 小臂抬起托枪在面前, 手不插入地面, 爬行时交替前伸
shR=-1.42+S*sw*0.32; elR=-1.15; shRz=-0.2;
shL=-1.3-S*sw*0.32; elL=-1.25; shLz=0.42;
if(rl){ shL=-1.1+Math.sin(nowT*7)*0.1; elL=-1.0; }
}
else if(engaged){
// 据枪瞄准: 右手扳机位, 左手横伸托护木
const ap=clamp(this.pitch,-0.7,0.7);
shR=-0.55-ap*0.85; elR=-1.6; shRz=-0.28;
shL=-1.35-ap*0.85; elL=-0.14; shLz=0.55;
} else if(sprint){
// 疾跑: 枪侧向横端在胸前, 双手保持握枪, 随步幅轻微起伏
shR=-0.62+S*0.07; elR=-1.05; shRy=0.3; shRz=-0.12;
shL=-0.78-S*0.07; elL=-1.05; shLy=0.55; shLz=0.35;
} else {
// 低持枪警戒: 枪口斜向下, 双手仍在枪上
shR=-0.42; elR=-1.3; shRz=-0.24;
shL=-1.08; elL=-0.28; shLz=0.5;
}
if(rl&&!sprint&&!prone){ shL=-0.8+Math.sin(nowT*7)*0.13; elL=-1.45; shLz=0.18; }
// 侧身补偿: 躯干扭转后手臂仍指向枪身
shRy+=-m.pelvis.rotation.y*0.85;
shLy+=-m.pelvis.rotation.y*0.85;
if(m.armR.sh.userData.swing>0){
m.armR.sh.userData.swing-=dt;
shR+=Math.sin(m.armR.sh.userData.swing*16)*0.6;
}
m.armR.sh.rotation.x=dampF(m.armR.sh.rotation.x,shR,11,dt);
m.armR.el.rotation.x=dampF(m.armR.el.rotation.x,elR,11,dt);
m.armL.sh.rotation.x=dampF(m.armL.sh.rotation.x,shL,11,dt);
m.armL.el.rotation.x=dampF(m.armL.el.rotation.x,elL,11,dt);
m.armL.sh.rotation.y=dampF(m.armL.sh.rotation.y,shLy,8,dt);
m.armR.sh.rotation.y=dampF(m.armR.sh.rotation.y,shRy,8,dt);
m.armL.sh.rotation.z=dampF(m.armL.sh.rotation.z,shLz,9,dt);
m.armR.sh.rotation.z=dampF(m.armR.sh.rotation.z,shRz,9,dt);
m.gunG.rotation.y=dampF(m.gunG.rotation.y,-m.pelvis.rotation.y+(sprint?0.95:0),9,dt);
m.gunG.rotation.z=dampF(m.gunG.rotation.z,sprint?0.16:0,8,dt);
this.gun.rotation.y=Math.PI;
// 匍匐时枪身反向补偿躯干俯角, 保持枪口朝前
const gunPitch=(engaged||this.mgUse||this.empUse)?-clamp(this.pitch,-0.7,0.7):(sprint?0.3:0.25);
m.gunG.rotation.x=prone?gunPitch-pp+0.1:gunPitch;
const headTgt=(engaged?-clamp(this.pitch,-0.6,0.6)*0.7:0)+(prone?-0.08-pp:-torsoX*0.5);
m.headG.rotation.x=dampF(m.headG.rotation.x,headTgt,9,dt);
if(this.flinchT>0){ this.flinchT-=dt; m.torsoG.rotation.z=Math.sin(this.flinchT*40)*0.07; }
else m.torsoG.rotation.z*=Math.pow(0.001,dt);
m.tag.visible=this.team===player.team&&this.pos.distanceTo(camera.position)<60;
}
}
// ─────────────────────────────────────────────
// BotDebug —— 实验模式 AI 调试层 (KeyP 切换, 仅供实机调参, 可整体移除)
// 头顶标签: 状态/机动/探头/性格/血量; 地面线: 当前寻路路径
// ─────────────────────────────────────────────
const DBG_STATE={idle:'待机',advance:'推进',defend:'防守',combat:'交战',hunt:'搜索',cover:'掩体',melee:'近战',nade:'手雷',atnade:'炸药',toVehicle:'上车'};
const BotDebug={
on:false,
toggle(){
this.on=!this.on;
for(const b of soldiers){
if(this.on) this.ensure(b);
if(b.dbgTag) b.dbgTag.visible=false;
if(b.dbgLine) b.dbgLine.visible=false;
}
showScorePop('AI调试: '+(this.on?'开 (P 关闭)':'关'));
},
ensure(b){
if(b.dbgTag) return;
const c=document.createElement('canvas'); c.width=256; c.height=48;
b.dbgCanvas=c;
b.dbgTag=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthTest:false}));
b.dbgTag.scale.set(2.4,0.45,1); b.dbgTag.position.y=2.5; b.dbgTag.renderOrder=6; b.dbgTag.visible=false;
b.mesh.root.add(b.dbgTag);
const g=new THREE.BufferGeometry();
g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(34*3),3));
b.dbgLine=new THREE.Line(g,new THREE.LineBasicMaterial({color:b.team===0?0x66aaff:0xff5544,transparent:true,opacity:0.85,depthTest:false}));
b.dbgLine.renderOrder=6; b.dbgLine.frustumCulled=false; b.dbgLine.visible=false;
scene.add(b.dbgLine);
b.dbgUpdT=0;
},
update(dt){
if(!this.on) return;
let i=0;
for(const b of soldiers){
if(!b.dbgTag) this.ensure(b);
if(!b.alive){ if(b.dbgTag) b.dbgTag.visible=false; if(b.dbgLine) b.dbgLine.visible=false; continue; }
const near=b.pos.distanceTo(camera.position)<75;
b.dbgTag.visible=near;
b.dbgUpdT-=dt;
if(near&&b.dbgUpdT<=0){
b.dbgUpdT=0.25+(i%5)*0.03;
this.drawTag(b);
this.drawPath(b);
}
i++;
}
},
drawTag(b){
const g=b.dbgCanvas.getContext('2d'); g.clearRect(0,0,256,48);
g.font='bold 22px sans-serif'; g.textAlign='center';
const st=DBG_STATE[b.state]||b.state;
const mn=b.state==='combat'?(b.man==='push'?'·跃进':b.man==='slide'?'·侧移':'·驻停'):'';
const pk=b.state==='cover'?(b.peekPhase==='out'?'·探头':'·隐蔽'):'';
const txt=st+mn+pk+' 凶'+b.aggro.toFixed(1)+' 血'+Math.round(b.hp);
g.strokeStyle='rgba(0,0,0,.9)'; g.lineWidth=5; g.strokeText(txt,128,31);
g.fillStyle=b.team===player.team?'#9fe8ff':'#ffb0a0'; g.fillText(txt,128,31);
b.dbgTag.material.map.needsUpdate=true;
},
drawPath(b){
const pos=b.dbgLine.geometry.attributes.position;
let n=0;
if(b.pos.distanceTo(camera.position)<90&&b.path&&b.pathI<b.path.length){
pos.setXYZ(n++,b.pos.x,b.pos.y+0.15,b.pos.z);
for(let k=b.pathI;k<b.path.length&&n<34;k++){
const wp=b.path[k];
pos.setXYZ(n++,wp[0],heightAt(wp[0],wp[1])+0.25,wp[1]);
}
}
if(n>1){ pos.needsUpdate=true; b.dbgLine.geometry.setDrawRange(0,n); b.dbgLine.visible=true; }
else b.dbgLine.visible=false;
},
};
