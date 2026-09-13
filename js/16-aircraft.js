// ─────────────────────────────────────────────
// 16-aircraft.js —— 飞机/防空炮/坠机残骸
// 源: Index.original.html 第 6207-6607 行
// (2026-09-06 B7a: 切分遗留的 16a-defs.js 死表已删, 数据单源在 00-config FACTIONS[...].planes)
// ─────────────────────────────────────────────
'use strict';
const planes=[], flakShots=[], planeWrecks=[];
function updatePlaneWrecks(dt){
for(let i=planeWrecks.length-1;i>=0;i--){
const w=planeWrecks[i];
if(w.state==='fall'){
w.vel.y-=8.5*dt;
w.pos.addScaledVector(w.vel,dt);
w.roll+=w.rollV*dt;
w.pitch=dampF(w.pitch,-0.9,0.6,dt);
w.yaw+=w.rollV*0.06*dt;
w.m.position.copy(w.pos);
w.m.rotation.order='YXZ';
w.m.rotation.set(-w.pitch,w.yaw,w.roll);
w.smokeT-=dt;
if(w.smokeT<=0){
w.smokeT=0.05;
spawnP(PT.dark,w.pos.x,w.pos.y,w.pos.z,rand(-0.5,0.5),rand(0.5,1.5),rand(-0.5,0.5),1.0,1.6,rand(0.9,1.4),0.7,0.2);
spawnP(PT.flash,w.pos.x,w.pos.y,w.pos.z,rand(-1,1),rand(-1,1),rand(-1,1),rand(0.4,0.7),0.5,0.22,0.9,0,true);
}
const gh=heightAt(w.pos.x,w.pos.z);
if(w.pos.y<=gh+0.6){
// 坠地爆炸: 无差别杀伤 + 留下焦黑残骸
w.state='rest';
w.pos.y=gh+0.45;
explosionFX(w.pos.clone().add(V3(0,0.8,0)));
AudioSys.explosion(w.pos.distanceTo(camera.position)*0.8);
splashDamage(w.pos,w.attacker,-1,9,165,240);
damageStructures(w.pos,8,280);
crater(w.pos.x,w.pos.z,1.6,true);
// 坠机残骸 = 持续火源: 残骸停留期间燃起大火, 点燃周边植被并灼烧靠近者
w.fireSrc=addFireSource(w.pos.x,w.pos.z,w.pos.y+0.8,4.2,w.restT,24,w.attacker||null);
igniteArea(w.pos.x,w.pos.z,3.8,w.attacker||null);
w.m.traverse(o=>{ if(o.isMesh) o.material=wreckMat; });
w.m.rotation.set(rand(-0.15,0.15),w.yaw,rand(-0.4,0.4));
w.m.position.copy(w.pos);
w.col=registerDynCollider(w.pos.x,gh+0.7,w.pos.z,3.6,1.4,3.6);
}
} else if(w.sinking){
// 沉没推进已收敛 queueSink (2026-09-06 B7b/P2-4)
} else {
w.restT-=dt;
w.smokeT-=dt;
if(w.smokeT<=0&&w.restT>6){
w.smokeT=0.16;
spawnP(PT.dark,w.pos.x+rand(-1,1),w.pos.y+0.8,w.pos.z+rand(-1,1),rand(-0.2,0.2),rand(0.8,1.6),rand(-0.2,0.2),0.8,1.5,rand(1.2,2),0.55,0.15);
}
if(w.restT<=0){
// 残骸沉入地下: 开始下沉即熄火(不再是火源), 半沉撤碰撞, 全沉移除 —— 收敛 queueSink (2026-09-06 B7b/P2-4)
w.sinking=true;
if(w.fireSrc){ removeFireSource(w.fireSrc); w.fireSrc=null; }
queueSink({objs:[w.m],rest:0,sink:4,depth:4.6,
onHalf:()=>{ if(w.col){ killDynCollider(w.col); w.col=null; } },
onTick:(dtk,k)=>{ if(k<0.9&&Math.random()<dtk*2) spawnP(PT.dark,w.pos.x+rand(-1.6,1.6),w.m.position.y+rand(0.3,1),w.pos.z+rand(-1.6,1.6),rand(-0.3,0.3),rand(0.4,1),rand(-0.3,0.3),0.6,1.2,rand(0.8,1.3),0.5,0.45); },
onDone:()=>{ scene.remove(w.m); const j=planeWrecks.indexOf(w); if(j>=0) planeWrecks.splice(j,1); }});
}
}
}
}
// 全图最高地形高度: 惰性全图采样一次并缓存 (AI 巡航层与地形规避共用)。
// 有山战役的主峰高度决定 AI 飞机必须飞多高才不会撞山
let TERR_MAX_H=null;
function terrainMaxH(){
if(TERR_MAX_H===null){
TERR_MAX_H=0;
const R=MAP_SIZE/2, st=R/24;
for(let x=-R;x<=R;x+=st)
for(let z=-R;z<=R;z+=st){
const h=heightAt(x,z);
if(h>TERR_MAX_H) TERR_MAX_H=h;
}
}
return TERR_MAX_H;
}
class Plane {
constructor(team,variant){
this.kind='plane';
this.team=team; this.variant=variant||0;
this.def=TEAM_FACTION[team].planes[this.variant];
this.name=this.def.name;
this.hp=this.def.hp; this.maxHp=this.def.hp; this.alive=true;
// 出生固定在己方主基地上空 (2026-09-01 用户指定): 无基地战役回退本阵营主力前出点
const bp=basePos(team);
const sx0=bp.x+rand(-14,14), sz0=bp.z+rand(-14,14);
this.pos=V3(sx0,Math.max(65,heightAt(sx0,sz0)+40),sz0);
this.yaw=team===0?0:Math.PI; this.pitch=0; this.speed=44; this.roll=0;
this.playerDriven=false;
this.crewBot=null; this.pilotBot=null;
this.bombs=this.def.bombs; this.rearmT=0;
this.crew={ name:this.name, team, kills:0, deaths:0, score:0, isPlayer:false, isCrew:true, pos:this.pos, alive:true, lastFiredT:-99, damage(){}, vel:V3() };
this.state='patrol'; this.stateT=rand(6,14);
this.target=null; this.fireT=0; this.bombCd=rand(3,6);
this.evadeT=0; this.evadeDir=1;
this.respawnT=0; this.smokeT=0;
const D=this.def, s=D.size;
const mat=new THREE.MeshLambertMaterial({color:D.col, map:TEX.grime});
this.grp=new THREE.Group();
const fuse=new THREE.Mesh(new THREE.CylinderGeometry(0.28*s,0.4*s,3.6*s,8),mat);
fuse.rotation.x=-HPI; this.grp.add(fuse);
const cowl=new THREE.Mesh(new THREE.CylinderGeometry(0.42*s,0.36*s,0.5*s,8),new THREE.MeshLambertMaterial({color:0x33362e,map:TEX.grime})); // B8/P3-12 整流罩
cowl.rotation.x=-HPI; cowl.position.z=1.6*s; this.grp.add(cowl);
const wing=new THREE.Mesh(new THREE.BoxGeometry(7.6*s,0.1,1.5*s),mat);
wing.position.set(0,-0.05,0.2*s); this.grp.add(wing);
const tail=new THREE.Mesh(new THREE.BoxGeometry(2.6*s,0.08,0.9*s),mat);
tail.position.set(0,0.1,-1.7*s); this.grp.add(tail);
const fin=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.8*s,0.8*s),mat);
fin.position.set(0,0.4*s,-1.7*s); this.grp.add(fin);
// 阵营标识 (2026-09-02 用户指定): 机翼双条纹+垂尾涂队色+尾灯闪烁+悬浮队色三角信标
// 信标: 无视深度遮挡/雾, 恒定世界尺寸4m, 地面玩家远距高空也能一眼辨敌我
const tcCol=TEAM_COL[this.team];
const markMat=new THREE.MeshBasicMaterial({color:tcCol});
for(const sx of [-1.5,1.5]){
const band=new THREE.Mesh(new THREE.BoxGeometry(0.85*s,0.12,1.7*s),markMat);
band.position.set(sx*s,-0.05,0.2*s); this.grp.add(band);
}
fin.material=new THREE.MeshLambertMaterial({color:tcCol});
this.navLight=new THREE.Mesh(new THREE.SphereGeometry(0.1,6,5),markMat);
this.navLight.position.set(0,0.5*s,-1.78*s); this.grp.add(this.navLight);
const bc=document.createElement('canvas'); bc.width=bc.height=64;
const bg7=bc.getContext('2d');
bg7.fillStyle='#'+(((TEAM_COL[this.team]>>>0).toString(16)).padStart(6,'0'));
bg7.strokeStyle='#ffffff'; bg7.lineWidth=7;
bg7.beginPath(); bg7.moveTo(32,5); bg7.lineTo(59,57); bg7.lineTo(5,57); bg7.closePath();
bg7.fill(); bg7.stroke();
this.beaconMat=new THREE.SpriteMaterial({map:new THREE.CanvasTexture(bc),transparent:true,depthTest:false,depthWrite:false});
this.beacon=new THREE.Sprite(this.beaconMat);
this.beacon.scale.set(4,4,1);
this.beacon.position.set(0,3.4,0);
this.beacon.renderOrder=9;
this.grp.add(this.beacon);
const cockpit=new THREE.Mesh(new THREE.SphereGeometry(0.3*s,8,6),new THREE.MeshLambertMaterial({color:0x36404a}));
cockpit.position.set(0,0.3*s,0.3*s); this.grp.add(cockpit);
if(this.variant===1){
for(const sx of [-1.6,1.6]){
const py=new THREE.Mesh(new THREE.SphereGeometry(0.19,6,5),new THREE.MeshLambertMaterial({color:0x24241e}));
py.scale.z=2; py.position.set(sx*s,-0.28,0.2); this.grp.add(py);
}
}
this.prop=new THREE.Mesh(new THREE.BoxGeometry(1.8*s,0.12,0.05),new THREE.MeshLambertMaterial({color:0x1a140e}));
this.prop.position.set(0,0,1.95*s); this.grp.add(this.prop);
this.grp.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
world.add(this.grp);
this.engine=AudioSys.createEngine('plane');
planes.push(this);
}
velVec(){
return V3(Math.sin(this.yaw)*Math.cos(this.pitch),Math.sin(this.pitch),Math.cos(this.yaw)*Math.cos(this.pitch)).multiplyScalar(this.speed);
}
fwdDir(){
return V3(Math.sin(this.yaw)*Math.cos(this.pitch),Math.sin(this.pitch),Math.cos(this.yaw)*Math.cos(this.pitch));
}
fireMGBurst(shooter,spreadMul){
const dir=this.fwdDir();
const sp=0.05*spreadMul;
dir.x+=rand(-sp,sp); dir.y+=rand(-sp,sp)*0.8; dir.z+=rand(-sp,sp); dir.normalize();
const o=this.pos.clone().addScaledVector(dir,2.4);
if(shooter) shooter._src=this.name; // 击杀来源: 战机扫射记入战机名
fireBullet(shooter,o,dir,{dmg:this.def.mgDmg,headMul:1.5,snd:'smg',tracer:1},o);
for(const ep of planes){
if(!ep.alive||ep.team===this.team) continue;
const rel=ep.pos.clone().sub(o); const tp=rel.dot(dir);
if(tp>2&&tp<200){ const d2=rel.lengthSq()-tp*tp; if(d2<3.2*3.2){ ep.takeDmg(this.def.mgDmg*0.7,shooter); if(Math.random()<0.3) spawnP(PT.spark,ep.pos.x,ep.pos.y,ep.pos.z,rand(-2,2),rand(-1,1),rand(-2,2),0.2,0,0.2,1,0,true); } }
}
for(const t of tanks){
if(!t.alive||t.team===this.team) continue;
const r=rayCyl(o,dir,vehHitCyl(t),200);
if(r){ t.takeDmg(3,shooter); break; }
}
for(const t of trucks){
if(!t.alive||t.team===this.team) continue;
const r=rayCyl(o,dir,truckHitCyl(t),200);
if(r){ t.takeDmg(3,shooter); break; }
}
}
dropBomb(shooter){
const m=new THREE.Mesh(new THREE.SphereGeometry(0.26,8,6),new THREE.MeshLambertMaterial({color:0x24241e}));
const p=this.pos.clone().add(V3(0,-1,0));
m.position.copy(p); m.scale.z=1.8; m.castShadow=true; scene.add(m);
const fv=this.velVec();
nades.push({m,pos:p,vel:V3(fv.x*0.85,Math.min(fv.y,0)-4,fv.z*0.85),fuse:6,thrower:shooter||this.crew,team:this.team,bounces:0,spin:V3(1.5,0,0),bomb:true});
AudioSys.metalSlide(0.25,0.12,500,300);
}
update(dt){
if(!this.alive){
	this.respawnT-=dt;
	this.engine.update(0,0);
	// 兵力票归零 → 该队战机封重生 (清场阶段敌方不再补充载具, 2026-09-04)
	if(this.respawnT<=0&&!matchOver&&tickets[this.team]>0){
	// 只有专属飞行员阵亡待命时才能连人带机一起重生
if(this.pilotBot&&!this.pilotBot.alive){
this.respawn();
this.pilotBot.spawnInVehicle(this);
} else if(!this.pilotBot){
this.respawn();
} else {
this.respawnT=3;
}
}
return;
}
const dCam=this.pos.distanceTo(camera.position);
this.engine.update(120+this.speed*1.5, this.playerDriven?0.16:clamp(0.22-dCam/280,0,0.22));
this.prop.rotation.z+=dt*(20+this.speed*0.5);
this.fireT-=dt; this.bombCd-=dt;
if(this.bombs<this.def.bombs){ this.rearmT-=dt; if(this.rearmT<=0){ this.bombs++; this.rearmT=8; } }
if(this.playerDriven){ this.playerFly(dt); }
else if(this.crewBot&&this.crewBot.alive){ this.planeAI(dt); }
else {
// 无人驾驶: 失控坠机
this.pitch=dampF(this.pitch,-0.5,1.2,dt);
this.roll+=0.5*dt;
this.speed=dampF(this.speed,this.def.spd[1],0.8,dt);
}
this.pos.x+=Math.sin(this.yaw)*Math.cos(this.pitch)*this.speed*dt;
this.pos.z+=Math.cos(this.yaw)*Math.cos(this.pitch)*this.speed*dt;
this.pos.y+=Math.sin(this.pitch)*this.speed*dt;
if(this.pos.y>110) this.pitch=Math.min(this.pitch,-0.05);
const lim2=MAP_SIZE/2+140;
if(Math.abs(this.pos.x)>lim2||Math.abs(this.pos.z)>lim2){
const wantYaw=Math.atan2(-this.pos.x,-this.pos.z);
this.yaw=angleLerpTo(this.yaw,wantYaw,(this.playerDriven?1.2:0.6)*dt);
}
this.grp.position.copy(this.pos);
this.grp.rotation.order='YXZ';
this.grp.rotation.set(-this.pitch,this.yaw,this.roll);
this.navLight.visible=Math.sin(nowT*4+this.team*3)>-0.2; // 尾灯闪烁: 队色自发光, 阴天/逆光也可辨
this.beaconMat.opacity=0.6+0.4*Math.sin(nowT*2.6+this.team*2.3); // 悬浮信标脉动 (两队相位不同)
if(this.hp<this.maxHp*0.5){
this.smokeT-=dt;
if(this.smokeT<=0){ this.smokeT=0.06;
spawnP(PT.dark,this.pos.x,this.pos.y,this.pos.z,0,0,0,0.8,1.2,1.2,0.6,0);
}
}
const gh=heightAt(this.pos.x,this.pos.z);
if(this.pos.y<gh+2) this.die(this.lastHitBy||null);
}
planeAI(dt){
this.stateT-=dt;
// ── 地形规避 (修 AI 撞山): 沿航向前方 60/130/200m 三点采样, 预测净空不足即提前拉起,
//    同时向地形更低的一侧转向。旧版只有俯冲/缠斗状态有 14~16m 的临死反应式拉起,
//    巡逻状态完全没有规避 —— 高山地图巡航层 62m 会直接穿山自毁。
//    俯冲攻击用收窄裕度: 允许贴近山顶目标攻击, 但保证来得及拉起 ──
const fx2=Math.sin(this.yaw), fz2=Math.cos(this.yaw);
const gh0=heightAt(this.pos.x,this.pos.z);
const l1=heightAt(this.pos.x+fx2*60,this.pos.z+fz2*60);
const l2=heightAt(this.pos.x+fx2*130,this.pos.z+fz2*130);
const l3=heightAt(this.pos.x+fx2*200,this.pos.z+fz2*200);
// 当前脚下地形也设下限 (峰肩越岭时前方采样可能还低、脚下已顶到)
const need=this.state==='dive'?Math.max(gh0+10,l1+13,l2+9):Math.max(gh0+16,l1+17,l2+13,l3+9);
if(this.pos.y<need){
const yL=this.yaw-0.75, yR=this.yaw+0.75;
const hL=Math.max(heightAt(this.pos.x+Math.sin(yL)*70,this.pos.z+Math.cos(yL)*70),
heightAt(this.pos.x+Math.sin(yL)*140,this.pos.z+Math.cos(yL)*140));
const hR=Math.max(heightAt(this.pos.x+Math.sin(yR)*70,this.pos.z+Math.cos(yR)*70),
heightAt(this.pos.x+Math.sin(yR)*140,this.pos.z+Math.cos(yR)*140));
const side=hL<hR?-1:1;
this.yaw+=side*0.85*dt;
this.roll=dampF(this.roll,-side*0.9,3,dt);
this.pitch=dampF(this.pitch,0.62,4,dt);
this.speed=dampF(this.speed,this.def.spd[1],0.9,dt);
return;
}
if(this.evadeT>0){
this.evadeT-=dt;
this.roll=dampF(this.roll,-this.evadeDir*1.2,3,dt);
this.yaw+=this.evadeDir*0.8*dt;
this.pitch=dampF(this.pitch,0.32,2,dt);
this.speed=dampF(this.speed,this.def.spd[1],1.5,dt);
return;
}
const ep=enemyPlaneAlive(this.team);
if(this.state!=='dive'&&ep&&ep.pos.distanceTo(this.pos)<240&&Math.random()<0.9) this.state='dogfight';
if(this.state==='dogfight'){
if(!ep||!ep.alive){ this.state='patrol'; this.stateT=rand(5,10); this.roll=dampF(this.roll,0,2,dt); return; }
const d=ep.pos.distanceTo(this.pos);
const lead=ep.pos.clone().addScaledVector(ep.velVec(),clamp(d/280,0,0.9));
const wantYaw=Math.atan2(lead.x-this.pos.x,lead.z-this.pos.z);
const dy=angDiff(this.yaw,wantYaw);
this.yaw+=clamp(dy,-1.0*dt,1.0*dt);
this.roll=dampF(this.roll,clamp(-dy*1.6,-1.1,1.1),4,dt);
const dh=Math.hypot(lead.x-this.pos.x,lead.z-this.pos.z);
this.pitch=dampF(this.pitch,clamp(Math.atan2(lead.y-this.pos.y,Math.max(dh,5)),-0.6,0.6),2.5,dt);
this.speed=dampF(this.speed,d>90?this.def.spd[1]:lerp(this.def.spd[0],this.def.spd[1],0.5),1.2,dt);
if(this.fireT<=0&&Math.abs(dy)<0.12&&d<160){
this.fireT=this.def.rof;
this.fireMGBurst(this.crewBot||this.crew,1);
if(Math.random()<0.12) AudioSys.gunshot('smg',this.pos.distanceTo(camera.position),0);
}
if(d>300){ this.state='patrol'; this.stateT=rand(5,10); }
const gh=heightAt(this.pos.x,this.pos.z);
if(this.pos.y<gh+14) this.pitch=Math.max(this.pitch,0.3);
return;
}
if(this.state==='patrol'){
// 巡航层: 有山战役自动抬升到"全图最高地形+42m", 无山维持 62m;
// 巡逻圈半径随地图缩放 (320 图 110m 不变, 800 图≈174m 覆盖全部旗区)
const cruise=Math.max(62,terrainMaxH()+42);
const pr=110*Math.sqrt(MAP_SIZE/320);
const cx=Math.sin(nowT*0.1+this.team*3)*pr, cz=Math.cos(nowT*0.1+this.team*3)*pr;
const wantYaw=Math.atan2(cx-this.pos.x,cz-this.pos.z);
const dy=angDiff(this.yaw,wantYaw);
this.yaw+=clamp(dy,-0.5*dt,0.5*dt);
this.roll=dampF(this.roll,clamp(-dy*1.4,-0.8,0.8),3,dt);
this.pitch=dampF(this.pitch,clamp((cruise-this.pos.y)*0.02,-0.3,0.3),2,dt);
this.speed=dampF(this.speed,48,1,dt);
if(this.stateT<=0){
let best=null,bs=-1e9;
for(const t of tanks){
if(!t.alive||t.team===this.team) continue;
const d=t.pos.distanceTo(this.pos);
if(d<280){ const sc=(this.bombs>0?150:60)-d*0.3+rand(0,30); if(sc>bs){ bs=sc; best=t; } }
}
for(const s of combatants){
if(!s.alive||s.team===this.team||s.onVehicle||s.spectator) continue;
const d=Math.hypot(s.pos.x-this.pos.x,s.pos.z-this.pos.z);
if(d>220) continue;
let sc=40-d*0.25+rand(0,25);
if(s.empUse||s.mgUse) sc+=70;
let cluster=0;
for(const s2 of combatants){ if(s2.alive&&s2.team===s.team&&Math.hypot(s2.pos.x-s.pos.x,s2.pos.z-s.pos.z)<9) cluster++; }
sc+=cluster*16;
if(sc>bs){ bs=sc; best=s; }
}
if(best){ this.target=best; this.state='dive'; this.stateT=7.5; }
else this.stateT=rand(4,8);
}
} else if(this.state==='dive'){
const tgt=this.target;
if(!tgt||!tgt.alive||this.stateT<=0){ this.state='climb'; this.stateT=4; }
else {
const tp=tgt.pos;
const wantYaw=Math.atan2(tp.x-this.pos.x,tp.z-this.pos.z);
const dy=angDiff(this.yaw,wantYaw);
this.yaw+=clamp(dy,-0.9*dt,0.9*dt);
this.roll=dampF(this.roll,clamp(-dy*1.6,-1,1),4,dt);
const dh=Math.hypot(tp.x-this.pos.x,tp.z-this.pos.z);
this.pitch=dampF(this.pitch,clamp(Math.atan2((tp.y+2)-this.pos.y,Math.max(dh,5)),-0.55,0.1),2.5,dt);
this.speed=dampF(this.speed,this.def.spd[1],1,dt);
if(this.fireT<=0&&dh<110&&Math.abs(dy)<0.22&&this.pos.y>12){
this.fireT=this.def.rof;
this.fireMGBurst(this.crewBot||this.crew,1.2);
}
if(this.bombs>0&&this.bombCd<=0&&Math.abs(dy)<0.3){
const h=this.pos.y-tp.y;
const tof=Math.sqrt(Math.max(2*h/9.8,0.01));
if(dh<this.speed*tof*1.08&&dh>this.speed*tof*0.5){
this.bombCd=rand(5,9); this.bombs--;
this.dropBomb(this.crewBot||this.crew);
}
}
const gh=heightAt(this.pos.x,this.pos.z);
if(this.pos.y<gh+16){ this.state='climb'; this.stateT=4; }
}
} else {
this.pitch=dampF(this.pitch,0.4,2,dt);
this.roll=dampF(this.roll,0,2,dt);
this.speed=dampF(this.speed,this.def.spd[1]*0.85,1,dt);
if(this.stateT<=0||this.pos.y>58){ this.state='patrol'; this.stateT=rand(8,16); this.target=null; }
}
}
playerFly(dt){
// 战地式操控: A/D 压坡转向, 鼠标上下控制俯仰, W/S 油门
const turn=(keys.KeyD?1:0)-(keys.KeyA?1:0);
const spdFac=0.62+this.speed*0.006;
this.roll=dampF(this.roll,turn*1.0,3.2,dt);
this.yaw+=-turn*0.92*spdFac*dt - Math.sin(this.roll)*0.12*dt;
// 鼠标俯仰: 相对速率输入(推鼠标持续拉杆)
this.pitch=dampF(this.pitch,clamp(player.pitch,-0.85,0.8),3.6,dt);
player.pitch=clamp(player.pitch,this.pitch-0.35,this.pitch+0.35);
player.yaw=this.yaw+Math.PI;
const thr=(keys.KeyW?1:0)-(keys.KeyS?1:0);
this.speed=clamp(this.speed+thr*13*dt,this.def.spd[0],this.def.spd[1]);
if(mouseDown&&this.fireT<=0&&!matchOver){
this.fireT=this.def.rof*(player.streakBuff?player.streakBuff.reloadMul:1); // 连杀增益: 航炮加速 (2026-09-12)
this.fireMGBurst(player,0.8);
AudioSys.gunshot('smg',0,0);
addTrauma(0.03);
}
if((mouse2Down||keys.KeyB)&&this.bombs>0&&this.bombCd<=0&&!matchOver){
this.bombCd=0.8*(player.streakBuff?player.streakBuff.reloadMul:1); this.bombs--; // 连杀增益: 投弹间隔缩短 (挂弹补给 rearmT 不动, 2026-09-12)
this.dropBomb(player);
}
const gh=heightAt(this.pos.x,this.pos.z);
if(this.pos.y<gh+9&&this.pitch<0.1) nadeWarnT=0.15;
player.pos.copy(this.pos);
player.vel.set(0,0,0);
}
takeDmg(amt,attacker){
if(!this.alive) return;
this.hp-=amt;
this.lastHitBy=attacker;
if(this.playerDriven){ dmgFlash=Math.min(1,dmgFlash+0.3); addTrauma(0.2); }
else if(this.crewBot&&this.hp>0&&this.hp<this.maxHp*0.32){
// 飞行员跳伞逃生
const cb=this.crewBot;
this.crewBot=null;
cb.onVehicle=null;
cb.chuting=true;
cb.pos.set(this.pos.x,Math.max(this.pos.y-2,heightAt(this.pos.x,this.pos.z)+3),this.pos.z);
cb.mesh.root.visible=true;
cb.path=null; cb.state='idle'; cb.target=null;
}
else if(amt>8&&this.evadeT<=0&&Math.random()<0.7){ this.evadeT=rand(1.4,2.6); this.evadeDir=Math.random()<0.5?1:-1; this.state='patrol'; }
if(this.hp<=0) this.die(attacker);
}
die(attacker){
this.alive=false; this.respawnT=rand(35,48); this.crew.alive=false;
if(this.playerDriven){
this.playerDriven=false;
player.onVehicle=null;
player.damage(999,attacker,false);
}
if(this.crewBot){
const cb=this.crewBot;
this.crewBot=null;
cb.onVehicle=null;
cb.damage(999,attacker,false);
}
if(attacker&&attacker.team!==this.team){
attacker.kills=(attacker.kills||0)+1;
// 玩家得分取 registerKillScore 返回值 (含连杀倍率, 2026-09-11); Bot 仍按基础分
if(attacker.isPlayer) attacker.score=(attacker.score||0)+registerKillScore('击落战机',SCORE_TABLE.plane);
else attacker.score=(attacker.score||0)+SCORE_TABLE.plane;
addKillfeed(attacker,{name:this.name,team:this.team,isPlayer:false},false);
}
tickets[this.team]=Math.max(0,tickets[this.team]-TICKET_COST.plane);
explosionFX(this.pos.clone());
AudioSys.explosion(this.pos.distanceTo(camera.position));
// 坠机残骸: 拖着火焰继续坠落, 落地爆炸并留下焦黑残骸
if(this.beacon) this.grp.remove(this.beacon); // 信标不随残骸克隆 (否则残骸静置时悬浮标识隔墙可见)
const wm=this.grp.clone();
if(this.beacon) this.grp.add(this.beacon);
scene.add(wm);
const fv=this.velVec();
planeWrecks.push({
m:wm, pos:this.pos.clone(),
vel:V3(fv.x*0.6,Math.min(fv.y*0.5,2),fv.z*0.6),
yaw:this.yaw, pitch:this.pitch, roll:this.roll,
rollV:rand(-2.5,2.5)+(Math.random()<0.5?1.6:-1.6),
attacker:attacker||null, team:this.team,
state:'fall', smokeT:0, restT:24, col:null
});
this.grp.visible=false;
}
respawn(){
// 重生固定在己方主基地上空 (2026-09-01 用户指定): 无基地战役回退本阵营主力前出点
const bp2=basePos(this.team);
const sx1=bp2.x+rand(-14,14), sz1=bp2.z+rand(-14,14);
this.pos.set(sx1,Math.max(65,heightAt(sx1,sz1)+40),sz1);
this.yaw=this.team===0?0:Math.PI; this.pitch=0; this.roll=0;
this.hp=this.maxHp; this.alive=true; this.crew.alive=true; this.speed=44;
this.state='patrol'; this.stateT=rand(5,10); this.target=null;
this.bombs=this.def.bombs; this.playerDriven=false; this.evadeT=0;
this.crewBot=null;
this.grp.visible=true;
// 己方战机战损重生: 文字播报让玩家知道本方空中支援已回场 (构造函数不走这里, 开局不播报)
if(this.team===player.team) announceVehRespawn(this);
}
}

function enemyPlaneAlive(team){
for(const p of planes) if(p.alive&&p.team!==team) return p;
return null;
}
function fireFlak(gun,shooter,dir){
const o=V3(gun.x,gun.y,gun.z).addScaledVector(dir,1.6); // 弹壳出生炮轴心 (2026-09-06 P2-20: 旧 +0.4 与炮管视觉错位)
AudioSys.gunshot('mg',o.distanceTo(camera.position),0);
spawnP(PT.flash,o.x,o.y,o.z,dir.x*2,dir.y*2,dir.z*2,0.35,3,0.07,1,0,true);
flakShots.push({pos:o.clone(),vel:dir.clone().multiplyScalar(SHELL_SPD),team:shooter.team,owner:shooter,life:2.6}); // 弹速引 SHELL_SPD (2026-09-06 B7a/P2-8)
}
function updateFlak(dt){
for(let i=flakShots.length-1;i>=0;i--){
const f=flakShots[i];
f.life-=dt;
f.pos.addScaledVector(f.vel,dt);
let boom=f.life<=0;
for(const p of planes){
if(!p.alive||p.team===f.team) continue;
if(p.pos.distanceTo(f.pos)<(f.owner&&f.owner.isPlayer?11:8)){
p.takeDmg(f.owner&&f.owner.isPlayer?rand(34,58):rand(20,34),f.owner);
boom=true;
}
}
// 解除"防空炮只能对空": 弹片可命中地面士兵/载具, 触地即爆
if(!boom){
for(const s of combatants){
if(!s.alive||s.onVehicle||s.team===f.team) continue;
if(Math.hypot(s.pos.x-f.pos.x,s.pos.z-f.pos.z)<1.1&&Math.abs((s.pos.y+1)-f.pos.y)<2.2){
s.damage(rand(20,36),f.owner&&f.owner.alive?f.owner:null,false);
boom=true; break;
}
}
}
if(!boom){
for(const t of tanks){
if(!t.alive||t.team===f.team) continue;
if(Math.hypot(t.pos.x-f.pos.x,t.pos.z-f.pos.z)<2.3&&f.pos.y>t.pos.y-0.6&&f.pos.y<t.pos.y+3.2){
t.takeDmg(rand(5,9),f.owner&&f.owner.alive?f.owner:null);
boom=true; break;
}
}
}
if(!boom&&f.pos.y<heightAt(f.pos.x,f.pos.z)) boom=true;
if(boom){
spawnP(PT.dark,f.pos.x,f.pos.y,f.pos.z,0,0.4,0,1.6,2.4,1.6,0.85,0);
spawnP(PT.flash,f.pos.x,f.pos.y,f.pos.z,0,0,0,0.9,5,0.09,1,0,true);
AudioSys.flakPop(f.pos.distanceTo(camera.position));
flakShots.splice(i,1);
}
}
}
