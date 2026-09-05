// ─────────────────────────────────────────────
// 18-game.js —— 对局状态/玩家对象/小队
// 源: Index.original.html 第 6768-6936 行
// ─────────────────────────────────────────────
'use strict';
let nowT=0, matchOver=false, matchTime=15*60;
let gamePaused=false, nowOff=0; // ESC 暂停: 主循环冻结+游戏时钟停止前进
const tickets=[START_TICKETS,START_TICKETS];
let nadeWarnT=0;
const player = {
isPlayer:true, name:'你', team:0, cls:0,
pos:V3(-118,1,0), vel:V3(), yaw:HPI, pitch:0,
hp:100, alive:false, deployed:false, crouch:false, onGround:true,
spectator:false, flying:false,
stamina:1, sprinting:false, ads:false, holdBreath:false,
mouseDX:0, mouseDY:0, landDip:0, airT:0,
slots:[], curSlot:0, curW:null, nadeCount:2,
fireT:0, bloom:0, lastDmgT:-99, deathT:0,
recoilPitch:0, recoilYaw:0,
kills:0, deaths:0, score:0,
nadeHeld:false, nadeFuse:0, nadeIsSmoke:false, smokeCount:1, onMG:null, resupplyCd:0,
onVehicle:null, onAT:null, onAA:null, atNades:0, nadeIsAT:false, nadeIsIncin:false, incinCount:0, loiter:null, loiterView:0,
suppressV:0, meleeCd:0,
bandages:4, maxBandages:4, bandaging:0, bandResupCd:0, grabAction:null,
eyeH:1.62,
lastFiredT:-99, killerName:'',
suppress(a){ this.suppressV=Math.min(1,this.suppressV+a); },
leanT:0,
damage(amt,attacker,isHead){
if(!this.alive||matchOver||this.spectator) return; // 观战: 完全免伤
this.hp-=amt;
this.lastDmgT=nowT;
if(this.bandaging>0){ this.bandaging=0; showScorePop('包扎被打断!'); }
if(this.useCast){ if(this.useCast.g&&this.useCast.g.user===this) this.useCast.g.user=null; this.useCast=null; showScorePop('使用被打断!'); } // 固定火力点前摇: 中弹打断
AudioSys.hurt();
dmgFlash=Math.min(1,dmgFlash+0.5);
addTrauma(0.25);
if(attacker){
const a=Math.atan2(attacker.pos.x-this.pos.x,attacker.pos.z-this.pos.z);
addDirHit(a);
}
if(this.hp<=0){
this.hp=0;
this.die(attacker,isHead);
}
},
die(attacker,isHead){
this.alive=false;
this.deaths++;
this.deathT=nowT;
tickets[this.team]=Math.max(0,tickets[this.team]-1);
this.killerName=attacker?(attacker.name||'敌军'):'';
this.killerSrc=killSrcLabel(attacker); // 击杀来源: 载具/固定火力点/武器名 (2026-09-04)
if(attacker&&attacker!==this){ attacker.kills=(attacker.kills||0)+1; attacker.score=(attacker.score||0)+100; addKillfeed(attacker,this,false); }
if(typeof resetKillStreak==='function') resetKillStreak(); // 阵亡清空连杀计数
	if(this.onMG){ releaseEmpl(this.onMG,true); this.onMG=null; }
	if(this.onAT){ releaseEmpl(this.onAT,true); this.onAT=null; }
	if(this.onAA){ releaseEmpl(this.onAA,true); this.onAA=null; }
	if(this.onMortar){ releaseEmpl(this.onMortar,true); this.onMortar=null; }
	if(this.loiter){ loiterDetonate(this.loiter,this.loiter.pos.clone()); }
		this.onVehicle=null;
		this.nadeHeld=false;
	// 死亡立刻收起狙击镜, 避免镜片遮罩残留
	this.ads=false; this.holdBreath=false;
	document.getElementById('scopeOv').style.display='none';
document.exitPointerLock&&document.exitPointerLock();
noteDeath(this.pos.x,this.pos.z);
// 玩家布娃娃 + 2秒第三人称死亡镜头
this.deathRag=window.CANNON?spawnRagdoll(this,attacker,isHead):null;
this.deathCamT=this.deathRag?2.2:0.8;
this.deathCamYaw=this.yaw+Math.PI;
this.deathPos=this.pos.clone();
this.deathPos.y+=0.4;
respawnCd=8;
const dly=this.deathRag?2100:900;
setTimeout(()=>{ if(!this.alive) document.getElementById('blackOv').style.opacity=0.75; },dly);
setTimeout(()=>{ if(!matchOver&&!this.alive) showDeploy(true); },dly+700);
},
doMeleeHit(){
const dir=camForward();
const o=camera.position.clone();
const sr=raySoldiers(o,dir,2.6,player);
if(sr){
player._src='刺刀';
sr.sol.damage(110,player,false);
AudioSys.click(500,0.5,0.09);
addTrauma(0.15);
} else {
const wr=raycastWorld(o,dir,2.4);
if(wr){ impactFX(wr.point,wr.normal,wr.kind); AudioSys.click(1800,0.3,0.05); }
}
},
	releaseNade(){
	const dir=camForward();
	const o=camera.position.clone().add(dir.clone().multiplyScalar(0.3));
	if(this.nadeIsIncin){
	player._src='燃烧弹';
	const v=dir.multiplyScalar(13).add(V3(0,2.6,0)).add(this.vel.clone().multiplyScalar(0.4));
	throwNade(this,o,v,1.6,false,false,true);
	this.incinCount--;
	this.nadeIsIncin=false;
	} else if(this.nadeIsSmoke){
	player._src='烟雾弹';
	const v=dir.multiplyScalar(12).add(V3(0,2.4,0)).add(this.vel.clone().multiplyScalar(0.4));
	throwNade(this,o,v,1.8,false,true);
	this.smokeCount--;
	this.nadeIsSmoke=false;
	} else if(this.nadeIsAT){
	player._src='反坦克雷';
	const v=dir.multiplyScalar(12).add(V3(0,2.2,0)).add(this.vel.clone().multiplyScalar(0.4));
	throwNade(this,o,v,1.6,true);
	this.atNades--;
	this.nadeIsAT=false;
	} else {
	player._src='手雷';
	const v=dir.multiplyScalar(15).add(V3(0,2.4,0)).add(this.vel.clone().multiplyScalar(0.4));
	throwNade(this,o,v,this.nadeFuse);
	this.nadeCount--;
	}
AudioSys.metalSlide(0.2,0.08,600,300);
},
finishReload(){
const w=this.curW;
if(!w) return;
const need=w.def.mag-w.mag;
const take=Math.min(need,w.reserve);
w.mag+=take; w.reserve-=take;
},
doGrabResolve(){
if(!this.grabAction) return;
const ga=this.grabAction;
		if(ga.kind==='ammo'||ga.kind==='truck'||ga.kind==='supply'){
		const ac=ga.crate;
		// 补给(弹药箱/运输车/临时补给点): 弹夹+备用+投掷物+绷带全满
		for(const s of this.slots){ s.reserve=s.def.reserve; s.mag=s.def.mag; }
	const gear=clsGear(this.cls,this.team);
	this.nadeCount=gear.nades;
	this.smokeCount=gear.smoke;
	this.incinCount=gear.incin;
	this.atNades=gear.atn;
	this.bandages=this.maxBandages;
this.resupplyCd=ga.kind==='truck'?8:6;
AudioSys.metalSlide(0.3,0.15,500,900);
showScorePop(ga.kind==='truck'?'运输车补给完成':(ga.kind==='supply'?'补充点补给完成':'弹药已补充'));
} else if(ga.kind==='medcrate'){
const c=ga.crate;
this.bandages=this.maxBandages;
c.uses--;
this.bandResupCd=4;
AudioSys.click(900,0.3,0.05);
showScorePop('绷带已补充');
if(c.owner&&c.owner!==this){ c.owner.score=(c.owner.score||0)+10; }
}
this.grabAction=null;
},
};
combatants.push(player);
// ===== 小队指挥系统 =====
const SQUAD={ mode:'follow', pos:V3(), members:[], marker:null };
function squadMarkerInit(){
if(SQUAD.marker) return;
const c=document.createElement('canvas'); c.width=64; c.height=64;
const g=c.getContext('2d');
g.fillStyle='rgba(255,215,90,.95)';
g.beginPath(); g.moveTo(32,58); g.lineTo(14,28); g.lineTo(50,28); g.closePath(); g.fill();
g.strokeStyle='rgba(0,0,0,.7)'; g.lineWidth=3; g.stroke();
g.fillStyle='rgba(255,215,90,.9)'; g.font='bold 22px sans-serif'; g.textAlign='center';
g.fillText('攻',32,22);
SQUAD.marker=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthTest:false}));
SQUAD.marker.scale.set(2.2,2.2,1);
SQUAD.marker.renderOrder=6;
SQUAD.marker.visible=false;
scene.add(SQUAD.marker);
}
function squadOrderMove(){
if(!player.alive||!SQUAD.members.length) return;
const o=camera.position.clone(), d=camForward();
const hit=raycastWorld(o,d,150);
const pt=hit?o.clone().addScaledVector(d,hit.dist):o.clone().addScaledVector(d,90);
pt.y=heightAt(pt.x,pt.z);
SQUAD.mode='move';
SQUAD.pos.copy(pt);
squadMarkerInit();
SQUAD.marker.visible=true;
SQUAD.marker.position.set(pt.x,pt.y+2.1,pt.z);
for(const s of SQUAD.members){ if(s.alive&&!s.onVehicle){ s.decisionT=0; s.repathT=0; s.path=null; } }
showScorePop('小队: 进攻标记位置!');
AudioSys.click(1500,0.3,0.05); AudioSys.click(1100,0.25,0.06);
}
function squadOrderFollow(){
if(!SQUAD.members.length) return;
SQUAD.mode='follow';
if(SQUAD.marker) SQUAD.marker.visible=false;
for(const s of SQUAD.members){ if(s.alive&&!s.onVehicle){ s.decisionT=0; s.repathT=0; } }
showScorePop('小队: 跟我走!');
AudioSys.click(1300,0.3,0.05);
}
