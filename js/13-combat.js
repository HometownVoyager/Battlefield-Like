// ─────────────────────────────────────────────
// 13-combat.js —— 射击/火箭/手雷/爆炸伤害
// 源: Index.original.html 第 4274-4477 行
// ─────────────────────────────────────────────
'use strict';
function raySoldiers(o,dir,maxD,shooter){
let best=null,bestT=maxD;
for(const s of combatants){
if(!s.alive||s===shooter||s.onVehicle) continue;
if(shooter&&s.team===shooter.team) continue;
const eyeY=s.pos.y+(s.prone?0.5:s.crouch?1.15:1.62);
const hx=s.pos.x-o.x, hy=eyeY+0.06-o.y, hz=s.pos.z-o.z;
const tProj=hx*dir.x+hy*dir.y+hz*dir.z;
if(tProj>0.2&&tProj<bestT){
const px=o.x+dir.x*tProj-s.pos.x, py=o.y+dir.y*tProj-(eyeY+0.06), pz=o.z+dir.z*tProj-s.pos.z;
if(px*px+py*py+pz*pz<0.26*0.26){ best={sol:s,t:tProj,head:true}; bestT=tProj; continue; }
}
const c={x:s.pos.x,z:s.pos.z,r:s.prone?0.5:0.38,y0:s.pos.y,y1:s.pos.y+(s.prone?0.6:s.crouch?1.25:1.55)};
const r=rayCyl(o,dir,c,bestT);
if(r){ best={sol:s,t:r.t,head:false}; bestT=r.t; }
}
return best;
}
function fireRocket(shooter,origin,dir,def,vis){
const vel=dir.clone().multiplyScalar(85);
shells.push({pos:origin.clone(),vel,team:shooter.team,owner:shooter,life:3.6,kind:'at',dmgV:def.atDmg||320,trail:0,rocket:true});
spawnP(PT.flash,origin.x,origin.y,origin.z, dir.x*2,dir.y*2,dir.z*2, 0.6,6,0.1,1,0,true);
spawnP(PT.dark,origin.x,origin.y,origin.z, dir.x*2+rand(-1,1),1.5,dir.z*2+rand(-1,1), 0.9,2.5,0.8,0.7,0.5);
AudioSys.cannon(origin.distanceTo(camera.position));
shooter.lastFiredT=nowT;
}
function fireBullet(shooter,origin,dir,def,visMuzzle){
const maxD=400;
const wr=raycastWorld(origin,dir,maxD);
let wallD=wr?wr.dist:maxD;
// 子弹可命中坦克/卡车: 阻挡弹道并溅火花, 重型子弹(vehDmg)刮掉少量装甲
let hitTank=null, hitTruck=null, tankD=1e9, truckD=1e9;
for(const t of tanks){
if(!t.alive) continue;
const r=rayCyl(origin,dir,vehHitCyl(t),wallD);
if(r){ wallD=r.t; hitTank=t; tankD=r.t; }
}
for(const t of trucks){
if(!t.alive) continue;
const r=rayCyl(origin,dir,truckHitCyl(t),wallD);
if(r){ wallD=r.t; hitTruck=t; truckD=r.t; }
}
const sr=raySoldiers(origin,dir,wallD,shooter);
let endD;
if(sr){
endD=sr.t;
const hitP=V3(origin.x+dir.x*sr.t,origin.y+dir.y*sr.t,origin.z+dir.z*sr.t);
bloodFX(hitP);
let dmg=def.dmg*(sr.head?def.headMul:1);
if(!shooter.isPlayer) dmg*=DIFF_TABLE[SETTINGS.diff].dmgMul;
dmg*=clamp(1-Math.max(0,sr.t-40)/220,0.45,1);
sr.sol.damage(dmg,shooter,sr.head);
if(shooter.isPlayer) onPlayerHit(sr.sol,sr.head);
} else if(hitTank||hitTruck){
endD=wallD;
const hp2=V3(origin.x+dir.x*endD,origin.y+dir.y*endD,origin.z+dir.z*endD);
spawnP(PT.spark,hp2.x,hp2.y,hp2.z,rand(-2,2),rand(1,3),rand(-2,2),0.15,0,rand(0.1,0.18),1,6,true);
if(Math.random()<0.3) AudioSys.ricochet(hp2.distanceTo(camera.position));
const veh=(hitTruck&&truckD<=tankD)?hitTruck:hitTank;
if(def.vehDmg&&veh&&veh.team!==shooter.team){
// 2026-09-02: 反坦克枪(atRifle)子弹按反装甲全额, 其余机枪/步枪子弹刮装甲按 TANK_ARMOR 减免
veh.takeDmg(def.vehDmg,shooter,def.atRifle);
if(shooter.isPlayer&&Math.random()<0.2) AudioSys.hitmarkSnd(false);
}
} else if(wr){
endD=wr.dist;
impactFX(wr.point,wr.normal,wr.kind);
} else endD=maxD;
if(Math.random()<1/(def.tracer||3)) spawnTracer(origin.clone().addScaledVector(dir,1.2),dir,Math.max(1,endD-1.5));
if(visMuzzle) muzzleFXWorld(visMuzzle,dir);
const dCam=origin.distanceTo(camera.position);
const rv=camRight();
const pan=clamp(rv.dot(V3(origin.x-camera.position.x,0,origin.z-camera.position.z).normalize()),-1,1);
if(!shooter.isPlayer) AudioSys.gunshot(def.snd,dCam,pan*0.7);
if(!shooter.isPlayer&&shooter.team!==player.team&&player.alive){
const relX=player.pos.x-origin.x, relY=player.pos.y+1.5-origin.y, relZ=player.pos.z-origin.z;
const tp=relX*dir.x+relY*dir.y+relZ*dir.z;
if(tp>2&&tp<endD){
const cx=origin.x+dir.x*tp-player.pos.x, cy=origin.y+dir.y*tp-(player.pos.y+1.5), cz=origin.z+dir.z*tp-player.pos.z;
const d2=cx*cx+cy*cy+cz*cz;
if(d2<4){ AudioSys.whizz(); player.suppress(0.35); }
}
}
for(const s of soldiers){
if(shooter.spectator) break; // 观战开火不压制/不惊动士兵
if(!s.alive||s.team===shooter.team) continue;
const relX=s.pos.x-origin.x, relY=s.pos.y+1.4-origin.y, relZ=s.pos.z-origin.z;
const tp=relX*dir.x+relY*dir.y+relZ*dir.z;
if(tp>2&&tp<endD+1){
const cx=origin.x+dir.x*tp-s.pos.x, cy=origin.y+dir.y*tp-(s.pos.y+1.4), cz=origin.z+dir.z*tp-s.pos.z;
if(cx*cx+cy*cy+cz*cz<6){ s.suppression=Math.min(1.6,s.suppression+0.35); s.noticeThreat(shooter); }
}
}
if(!shooter.spectator) gunEvents.push({x:origin.x,z:origin.z,team:shooter.team,t:nowT,shooter}); // 观战开火不产生枪声事件
shooter.lastFiredT=nowT;
}
// ===== 固定火力点开火单源 (2026-09-06 B4/P1-1: 玩家 20a-seats 与 Bot 14-bots 共用一份弹道/冷却/特效) =====
// 机枪座: 冷却与热量在炮上(换人不重置); 散布/后坐等输入差异由调用方在 dir 上先行处理
const EMPL_MG_EYE=0.12, EMPL_MG_MUZ=1.35; // 枪管中线高度与炮口前移 (旧 Bot 0.1/1.3 vs 玩家 0.12/1.35 已统一)
function emplMGFire(mg,shooter,dir){
const mdef=mg.def||EMPL_MG_DEF;
mg.fireT=60/mdef.rpm;
mg.heat+=mdef.heatPS;
const eye=V3(mg.x,mg.y+EMPL_MG_EYE,mg.z);
const muzz=eye.clone().addScaledVector(dir,EMPL_MG_MUZ);
shooter._src=mdef.name||'重机枪'; // 击杀来源: 固定机枪座名称
fireBullet(shooter,eye,dir,mgBulletDef(mdef),muzz);
muzzleFXWorld(muzz,dir);
}
// 迫击炮: 单源弹道 (tof=clamp(dH/42,1.8,4.2) 高抛解) + 弹体创建; 音效/烟/ trauma 与冷却档由调用方处理
// 高抛弹道速度解 (2026-09-06 B7a/P2-10: 炮位/手持两套公式参数化, tof 由调用方按武器档决定)
function mortarVel(ox,oz,tx,tz,tof){
return V3((tx-ox)/tof,0.5*9.8*tof,(tz-oz)/tof);
}
function emplMortarShell(mo,shooter,tx,tz){
const dH=Math.hypot(tx-mo.x,tz-mo.z);
const tof=clamp(dH/42,1.8,4.2);
const v=mortarVel(mo.x,mo.z,tx,tz,tof);
shooter._src='迫击炮'; // 击杀来源: 固定迫击炮
const nPos=V3(mo.x,mo.y+0.25,mo.z);
const shell=new THREE.Mesh(nadeGeoAT,vmMats.gun); shell.position.copy(nPos); scene.add(shell);
nades.push({m:shell,pos:nPos.clone(),vel:v,fuse:9,thrower:shooter,team:shooter.team,spin:V3(3,0,0.5),bounces:0,mortar:true});
spawnP(PT.dark,mo.x,mo.y+0.4,mo.z,0,1.4,0,0.5,1.6,0.6,0.5,0.2);
}
// 反坦克炮: 单源开炮 (炮口前移统一 2.7、弹壳出生 g.y —— 旧 Bot +0.25/2.6 vs 玩家 +0.25/2.7 分叉已统一);
// 弹速引 SHELL_SPD (15-vehicles 常量, B7a 单源化同口径); LOS 检查只 Bot 需要, 留在 Bot 调用方
function emplATFire(g,shooter,dir){
g.cd=5.2+rand(0,1.4); // 炮上冷却, 换人不重置
const o=V3(g.x,g.y,g.z).addScaledVector(dir,2.7);
shooter._src='反坦克炮';
AudioSys.cannon(o.distanceTo(camera.position));
spawnP(PT.flash,o.x,o.y,o.z,dir.x*3,dir.y*3,dir.z*3,0.85,8.5,0.1,1,0,true);
spawnP(PT.dark,o.x,o.y,o.z,dir.x*2,1,dir.z*2,0.85,2.55,0.85,0.7,0.5);
shells.push({pos:o.clone(),vel:dir.clone().multiplyScalar(SHELL_SPD),team:shooter.team,owner:shooter,life:3,kind:'at',trail:0});
shooter.lastFiredT=nowT;
}
const nades=[];
const nadeGeoUS=new THREE.SphereGeometry(0.06,8,6);
const nadeGeoGER=new THREE.CylinderGeometry(0.035,0.035,0.24,8);
const nadeGeoAT=new THREE.CylinderGeometry(0.06,0.075,0.3,8);
const nadeGeoSmoke=new THREE.CylinderGeometry(0.048,0.048,0.13,8);
const smokeCanMat=new THREE.MeshLambertMaterial({color:0x8a9088});
const incinCanMat=new THREE.MeshLambertMaterial({color:0xa8402a});
function throwNade(thrower,origin,vel,fuse,at,smoke,incin){
const m=new THREE.Mesh(smoke?nadeGeoSmoke:(at?nadeGeoAT:(TEAM_FACTION[thrower.team].nade==='egg'?nadeGeoUS:nadeGeoGER)),incin?incinCanMat:(smoke?smokeCanMat:(at?vmMats.gunL:vmMats.nade)));
m.castShadow=true;
m.position.copy(origin);
scene.add(m);
nades.push({m,pos:origin.clone(),vel:vel.clone(),fuse:fuse!==undefined?fuse:3.4,thrower,team:thrower.team,spin:V3(rand(-6,6),rand(-6,6),rand(-6,6)),bounces:0,at:!!at,smokeN:!!smoke,incinN:!!incin});
}
function updateNades(dt){
for(let i=nades.length-1;i>=0;i--){
const n=nades[i];
n.fuse-=dt;
if(n.fuse<=0){
scene.remove(n.m);
nades.splice(i,1);
nadeExplode(n);
continue;
}
n.vel.y-=9.8*dt;
const nx=n.pos.x+n.vel.x*dt, ny=n.pos.y+n.vel.y*dt, nz=n.pos.z+n.vel.z*dt;
let bounced=false;
// 2026-09-06 B5/P0-2: 手雷撞盒全量扫描改 RGRID 邻近候选 (±0.06 判定 + 0.02 采样余量);
// 原实现命中首个盒即 break —— 以 bounced 旗复刻, 候选次序差异由等价探针覆盖
eachBoxNear(nx-0.08,nz-0.08,nx+0.08,nz+0.08,b=>{
if(bounced) return;
if(nx>b.minX-0.06&&nx<b.maxX+0.06&&ny>b.minY-0.06&&ny<b.maxY+0.06&&nz>b.minZ-0.06&&nz<b.maxZ+0.06){
const dl=Math.min(nx-b.minX,b.maxX-nx), dv=Math.min(ny-b.minY,b.maxY-ny), dd=Math.min(nz-b.minZ,b.maxZ-nz);
if(dv<=dl&&dv<=dd){ n.vel.y*=-0.4; n.vel.x*=0.7; n.vel.z*=0.7; }
else if(dl<=dd){ n.vel.x*=-0.5; } else { n.vel.z*=-0.5; }
bounced=true;
}
});
if(n.at||n.bomb||n.mortar){
for(const t of tanks){
if(!t.alive||t.team===n.team) continue;
if(Math.hypot(nx-t.pos.x,nz-t.pos.z)<2.6&&ny<t.pos.y+2.6){ n.fuse=0; bounced=false; break; }
}
for(const t of trucks){
if(!t.alive||t.team===n.team) continue;
if(Math.hypot(nx-t.pos.x,nz-t.pos.z)<2.6&&ny<t.pos.y+2.6){ n.fuse=0; bounced=false; break; }
}
}
const gh=heightAt(nx,nz);
if(ny<=gh+0.05){
n.pos.y=gh+0.05;
if(n.vel.y<-0.5) bounced=true;
n.vel.y*=-0.38;
n.vel.x*=0.68; n.vel.z*=0.68;
n.spin.multiplyScalar(0.6);
}
n.pos.set(nx,Math.max(ny,gh+0.05),nz);
if(bounced&&(n.at||n.bomb||n.mortar)){ n.fuse=Math.min(n.fuse,0.02); }
else if(bounced&&n.bounces++<4) AudioSys.nadeBounce(n.pos.distanceTo(camera.position));
n.m.position.copy(n.pos);
n.m.rotation.x+=n.spin.x*dt; n.m.rotation.y+=n.spin.y*dt; n.m.rotation.z+=n.spin.z*dt;
if(n.team!==player.team&&player.alive&&n.pos.distanceTo(player.pos)<7) nadeWarnT=0.2;
}
}
function nadeExplode(n){
if(n.incinN){
spawnSmokeCloud(n.pos,true,n.thrower);
return;
}
if(n.smokeN){
spawnSmokeCloud(n.pos,false,n.thrower);
return;
}
if(n.mortar){
explosionFXSmall(n.pos);
AudioSys.explosion(n.pos.distanceTo(camera.position)*0.85);
splashDamage(n.pos,n.thrower,n.team,7.5,135,150);
damageStructures(n.pos,7,210);
crater(n.pos.x,n.pos.z,1.3,true);
return;
}
if(n.at){
spawnP(PT.flash,n.pos.x,n.pos.y+0.4,n.pos.z,0,2,0,2.4,15,0.14,1,0,true);
for(let i=0;i<7;i++) spawnP(PT.dark,n.pos.x,n.pos.y+0.4,n.pos.z,rand(-2,2),rand(1,4),rand(-2,2),1.0,2.4,rand(0.8,1.4),0.85,0.6);
AudioSys.explosion(n.pos.distanceTo(camera.position));
splashDamage(n.pos,n.thrower,n.team,5,95,340,true); // 反坦克炸药: 反装甲全额
damageStructures(n.pos,5,130);
crater(n.pos.x,n.pos.z,1.1,true);
} else if(n.bomb){
explosionFX(n.pos);
AudioSys.explosion(n.pos.distanceTo(camera.position)*0.7);
splashDamage(n.pos,n.thrower,n.team,9.5,170,260);
damageStructures(n.pos,9,340);
explodeAt(n.pos,n.thrower);
} else {
explodeAt(n.pos,n.thrower);
}
}
function explodeAt(p,attacker){
explosionFX(p);
AudioSys.explosion(p.distanceTo(camera.position));
damageStructures(p,4.5,45);
for(const s of combatants){
if(!s.alive||s.onVehicle) continue;
const d=Math.hypot(s.pos.x-p.x,(s.pos.y+0.9)-p.y,s.pos.z-p.z);
if(d<9){
const dir=V3(s.pos.x-p.x,s.pos.y+0.9-p.y,s.pos.z-p.z).normalize();
const block=raycastWorld(V3(p.x,p.y+0.25,p.z),dir,d);
let dmg=(1-d/9)*135;
if(block&&block.dist<d-0.5) dmg*=0.25;
if(s.team===attacker.team&&s!==attacker) dmg*=0.0;
if(dmg>2){
s.damage(dmg,attacker,false);
if(s.isPlayer){ addTrauma(clamp(dmg/60,0.3,1)); }
}
}
if(s.isPlayer){
const d2=p.distanceTo(camera.position);
if(d2<20) addTrauma(clamp(1.2-d2/22,0.1,0.9));
}
}
for(const s of soldiers){
if(!s.alive) continue;
if(Math.hypot(s.pos.x-p.x,s.pos.z-p.z)<40&&attacker.team!==s.team) s.noticeThreat(attacker);
}
}
// ===== 巡飞弹 (实验模式): 火箭筒发射小型无人机, 飞行中玩家进入TV制导视角 =====
const loiterEng=AudioSys.createEngine('plane');
function buildLoiterMesh(){
const g=new THREE.Group();
const bodyMat=new THREE.MeshLambertMaterial({color:0x6a705c});
const darkMat=new THREE.MeshLambertMaterial({color:0x3c4038});
// 机身(机头朝 -Z 与相机前向一致) + 光学头罩 + 主翼 + 尾翼 + 尾推螺旋桨
const body=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.09,0.72,8),bodyMat);
body.rotation.x=HPI; g.add(body);
const nose=new THREE.Mesh(new THREE.SphereGeometry(0.075,8,6),new THREE.MeshLambertMaterial({color:0x1c2226}));
nose.position.z=-0.4; g.add(nose);
const wing=new THREE.Mesh(new THREE.BoxGeometry(1.15,0.02,0.2),bodyMat);
wing.position.z=-0.05; g.add(wing);
const tail=new THREE.Mesh(new THREE.BoxGeometry(0.42,0.02,0.12),bodyMat);
tail.position.z=0.32; g.add(tail);
const fin=new THREE.Mesh(new THREE.BoxGeometry(0.02,0.2,0.14),darkMat);
fin.position.set(0,0.1,0.32); g.add(fin);
const prop=new THREE.Mesh(new THREE.BoxGeometry(0.02,0.3,0.015),darkMat);
prop.position.z=0.42; g.add(prop);
g.userData.prop=prop;
g.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
return g;
}
function fireLoiter(shooter,origin,dir){
if(player.loiter) return null;
const mesh=buildLoiterMesh();
mesh.position.copy(origin);
scene.add(mesh);
const d={ pos:origin.clone(), yaw:shooter.yaw, pitch:shooter.pitch, mesh,
owner:shooter, team:shooter.team, life:24, t:0, spd:13, trail:0, dead:false, grace:0.8 };
player.loiter=d;
// 吞掉发射时按住的鼠标: 松开后左键才重新作为"自爆"/右键才作为"加速"触发, 避免刚出膛就误操作
player._ltClick=true; player._ltRClick=true;
player.loiterView=0;
d.mesh.visible=false; // 默认弹头第一视角: 隐藏弹体 (F 切第三人称时恢复显示)
VM.root.visible=false;
const ov=document.getElementById('tvOv');
if(ov) ov.style.display='block';
loiterEng.update(150,0.2);
if(!shooter.spectator) gunEvents.push({x:origin.x,z:origin.z,team:shooter.team,t:nowT,shooter}); // 观战发射不上报枪声
return d;
}
function loiterForward(d){
const cp=Math.cos(d.pitch);
return V3(-Math.sin(d.yaw)*cp, Math.sin(d.pitch), -Math.cos(d.yaw)*cp);
}
// 不分敌我溅射: 圈内所有步兵(含发射者与友军)、坦克/卡车/飞机(含友军)一律受伤
// 溅射单源 (2026-09-06 B7b/P2-6: 旧 splashDamage(15-vehicles,队伤) 与 splashDamageFF(13-combat,无差别) 90% 同构合并;
// team=-1 ⇒ 无差别(FF): 不吃队伤豁免、载具衰减下限 20、含飞机圈; team 传队号 ⇒ 同队免伤、衰减下限 10、不含飞机圈)
function splashDamage(p,attacker,team,radius,dmgMax,dmgVeh,ap){
const ff=team===-1||team===undefined;
const vehFloor=ff?20:10;
for(const s of combatants){
if(!s.alive||s.onVehicle) continue;
if(!ff&&s.team===team&&s!==attacker) continue; // 不误伤队友, 但炸自己会受伤
const d=Math.hypot(s.pos.x-p.x,(s.pos.y+0.9)-p.y,s.pos.z-p.z);
if(d<radius) s.damage(lerp(dmgMax,10,d/radius),attacker,false);
}
for(const t of tanks){
if(!t.alive||(!ff&&t.team===team)) continue;
const d=t.pos.distanceTo(p);
if(d<radius+2.5) t.takeDmg(lerp(dmgVeh,vehFloor,d/(radius+2.5)),attacker,ap);
}
for(const t of trucks){
if(!t.alive||(!ff&&t.team===team)) continue;
const d=t.pos.distanceTo(p);
if(d<radius+2.5) t.takeDmg(lerp(dmgVeh,vehFloor,d/(radius+2.5)),attacker);
}
if(ff) for(const pl of planes){
if(!pl.alive) continue;
const d=pl.pos.distanceTo(p);
if(d<radius+3) pl.takeDmg(lerp(dmgVeh,20,d/(radius+3)),attacker);
}
if(player.alive&&p.distanceTo(camera.position)<18) addTrauma(0.5);
}
function updateLoiters(dt){
const d=player.loiter;
if(!d||d.dead) return;
d.t+=dt; d.life-=dt;
// 右键加速: 尾推引擎全速冲刺 (3×巡航 13=40 m/s), 松开后回落到巡航速度 (转向角速度不变, 高速下盘旋半径更大)
const boost=mouse2Down&&!player._ltRClick;
d.spd=dampF(d.spd, boost?40:13, boost?2.2:3.0, dt);
// TV制导: 机体以有限角速度转向玩家视角方向; 轻微低头模拟持续巡航
const rateYaw=1.9, ratePitch=1.4;
d.yaw+=clamp(angDiff(d.yaw,player.yaw),-rateYaw*dt,rateYaw*dt);
d.pitch+=clamp(clamp(player.pitch,-1.2,1.2)-d.pitch,-ratePitch*dt,ratePitch*dt)-0.06*dt;
const dir=loiterForward(d);
const step=d.spd*dt;
d.trail-=dt;
if(d.trail<=0){
d.trail=0.05;
spawnP(PT.smoke,d.pos.x,d.pos.y,d.pos.z, rand(-0.2,0.2),rand(0,0.4),rand(-0.2,0.2), 0.28,0.5,0.5,0.4,0);
}
if(d.mesh.userData.prop) d.mesh.userData.prop.rotation.z+=dt*(40+(d.spd-13)*2.4);
loiterEng.update(140+d.t*6+(d.spd-13)*4,0.2);
if(d.grace>0){
// 出膛保护: 起步 0.8s 不做命中检测, 并强制贴地爬升 ——
// 贴身山坡/沙袋/掩体发射 (陡坡地形常见) 不会第一帧就击中近物自爆
d.grace-=dt;
d.pos.x+=dir.x*step; d.pos.y+=dir.y*step; d.pos.z+=dir.z*step;
const gh=heightAt(d.pos.x,d.pos.z);
if(d.pos.y<gh+0.35) d.pos.y=gh+0.35;
}else{
// 命中检测: 静态体 / 坦克 / 飞机 / 士兵 (不分敌我, 友军单位同样会挡住弹体)
let hitD=step+0.45, hitTank=null, hitSol=null, hitPlane=null, hit=null;
const wr=raycastWorld(d.pos,dir,hitD);
if(wr){ hitD=wr.dist; hit=wr; }
for(const t of tanks){
if(!t.alive) continue;
const r=rayCyl(d.pos,dir,vehHitCyl(t),hitD);
if(r){ hitD=r.t; hitTank=t; hitSol=null; hitPlane=null; hit=r; }
}
// 空中目标: 弹体航迹与机体圆柱相交即碰炸 (飞机即使悬停/迎头相撞也按最近距离判定)
for(const pl of planes){
if(!pl.alive) continue;
const r=rayCyl(d.pos,dir,{x:pl.pos.x,z:pl.pos.z,r:2.3*pl.def.size,y0:pl.pos.y-1.2*pl.def.size,y1:pl.pos.y+1.2*pl.def.size},hitD);
if(r){ hitD=r.t; hitPlane=pl; hitTank=null; hitSol=null; hit=r; }
}
const sr=raySoldiers(d.pos,dir,hitD,null);
if(sr){ hitD=sr.t; hitSol=sr.sol; hitTank=null; hitPlane=null; hit=sr; }
// 观战模式: 弹体永不"正常命中" —— 触物/触地一律静默消失, 只有左键手动起爆
if(hit&&d.owner&&d.owner.spectator){ loiterDespawn(d); return; }
if(hit){
const hp2=V3(d.pos.x+dir.x*hitD,d.pos.y+dir.y*hitD,d.pos.z+dir.z*hitD);
loiterDetonate(d,hp2,hitTank,hitSol,hitPlane);
return;
}
// 未命中: 只按本帧步长精确前进 (不再把命中检测的0.45m前瞻也算进位移)
d.pos.x+=dir.x*step; d.pos.y+=dir.y*step; d.pos.z+=dir.z*step;
const nx=d.pos.x, ny=d.pos.y, nz=d.pos.z;
if(ny<=heightAt(nx,nz)+0.12){
if(d.owner&&d.owner.spectator){ loiterDespawn(d); return; } // 观战: 触地即消失, 不炸
loiterDetonate(d,V3(nx,heightAt(nx,nz)+0.3,nz)); return;
}
// 贴近判定兜底: 高速掠过/迎头撞击时单帧射线可能穿过机身, 距离足够近即碰炸
for(const pl of planes){
if(pl.alive&&d.pos.distanceTo(pl.pos)<2.2*pl.def.size+0.4){
if(d.owner&&d.owner.spectator){ loiterDespawn(d); return; }
loiterDetonate(d,d.pos.clone(),null,null,pl); return;
}
}
}
const nx=d.pos.x, nz=d.pos.z;
if(Math.abs(nx)>MAP_SIZE/2-2||Math.abs(nz)>MAP_SIZE/2-2||d.life<=0){
if(d.owner&&d.owner.spectator){ loiterDespawn(d); return; } // 观战: 到期/出界同样静默消失
loiterDetonate(d,d.pos.clone()); return;
}
d.mesh.position.copy(d.pos);
d.mesh.rotation.order='YXZ';
d.mesh.rotation.set(d.pitch,d.yaw,Math.sin(nowT*2.2)*0.05);
}
function loiterDetonate(d,p,directTank,directSol,directPlane){
if(d.dead) return;
d.dead=true;
d.mesh.visible=true;
scene.remove(d.mesh);
if(player.loiter===d) player.loiter=null;
VM.root.visible=true;
const ov=document.getElementById('tvOv');
if(ov) ov.style.display='none';
loiterEng.stop();
if(!matchOver){
explosionFX(p);
AudioSys.explosion(p.distanceTo(camera.position)*0.8);
// 攻顶战斗部: 不分敌我的大范围高伤害爆炸 (含发射者自己与友军)
splashDamage(p,d.owner,-1,9.5,240,560,true); // 巡飞弹: 反装甲全额, 无差别 (单源 splashDamage team=-1)
damageStructures(p,9,300);
crater(p.x,p.z,1.6,true);
if(directTank) directTank.takeDmg(900,d.owner,true); // 巡飞弹直击: 反装甲全额
if(directPlane) directPlane.takeDmg(900,d.owner);
if(directSol) directSol.damage(400,d.owner,false);
}
if(player.alive&&player.curW&&player.curW.mag<=0&&player.curW.reserve>0) setTimeout(tryReload,450);
}
// 观战模式巡飞弹退场: 不爆炸不伤害, 收回TV视角 (仅观战使用 —— 手动左键才是观战唯一引爆方式)
function loiterDespawn(d){
if(d.dead) return;
d.dead=true;
d.mesh.visible=true;
scene.remove(d.mesh);
if(player.loiter===d) player.loiter=null;
VM.root.visible=true;
const ov=document.getElementById('tvOv');
if(ov) ov.style.display='none';
loiterEng.stop();
}
