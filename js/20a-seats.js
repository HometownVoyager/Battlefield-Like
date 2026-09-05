// ─────────────────────────────────────────────
// 20a-seats.js —— 玩家座驾/工事操作: 坦克/飞机/迫击炮/反坦克炮/防空炮/重机枪
// 2026-08-24 由 20-player.js 切分: 原第 388-609 行 (玩家本体/交互/相机仍在 20-player.js)
// ─────────────────────────────────────────────
'use strict';
// 2026-09-06 B6/P2-26: 座驾 HUD 元素引用缓存 (原每帧多次 getElementById)
const seatElm=id=>updatePlayerTank._els[id]||(updatePlayerTank._els[id]=document.getElementById(id));
function updatePlayerTank(dt){
const p=player, t=p.onVehicle;
if(!t.alive){ p.onVehicle=null; return; }
if(t.kind==='plane') return; // 飞机由Plane.update驱动
const fwd=(keys.KeyW?1:0)-(keys.KeyS?1:0);
const turn=(keys.KeyD?1:0)-(keys.KeyA?1:0);
t.vel=dampF(t.vel,fwd<0?-t.def.rev:fwd*t.def.spd,2.5,dt);
t.yaw-=turn*t.def.turn*dt*(fwd<0?-1:1);
const wantTY=angDiff(t.yaw,p.yaw+Math.PI);
t.turretYaw=angleLerpTo(t.turretYaw,wantTY,t.def.tRate*dt);
let wantPitch=clamp(p.pitch,-0.12,0.32);
if(p.tankView){
// 炮手镜: 测距并抬炮补偿弹道下坠
const cd=camForward(), co=camera.position.clone();
let D=320;
const wr2=raycastWorld(co,cd,D);
if(wr2) D=wr2.dist;
for(const t2 of tanks){
if(t2===t||!t2.alive) continue;
const r2=rayCyl(co,cd,{x:t2.pos.x,z:t2.pos.z,r:2.3,y0:t2.pos.y,y1:t2.pos.y+2.6},D);
if(r2) D=r2.t;
}
	wantPitch=clamp(p.pitch+SHELL_G*D/(2*SHELL_SPD*SHELL_SPD),-0.12,0.35);
}
t.turretPitch=dampF(t.turretPitch,wantPitch,6,dt);
p.fireT-=dt;
// 准星汇聚: 主炮朝相机瞄准点开火
if(mouseDown&&t.cannonCd<=0&&!matchOver){ t.fireCannon(); }
// 同轴机枪(右键)
if(mouse2Down&&!matchOver){
const cd=camForward();
const co=camera.position.clone();
let aimD=200;
const wr=raycastWorld(co,cd,aimD);
if(wr) aimD=wr.dist;
const aimP=co.addScaledVector(cd,aimD);
const dir=aimP.sub(t.coaxMuzzle()).normalize();
if(dir.dot(t.aimDir())>0.85){
dir.x+=rand(-0.012,0.012); dir.y+=rand(-0.009,0.009); dir.z+=rand(-0.012,0.012); dir.normalize();
t.firePlayerMG(dir);
}
}
p.pos.copy(t.pos);
p.vel.set(0,0,0);
// 2026-09-06 B6/P2-26: DOM 引用缓存 + 落点 pip 10Hz 节流 (原每帧 36 步弹道迭代+射线+2 次 getElementById)

if(nowT-updatePlayerTank._pipT>=0.1){
updatePlayerTank._pipT=nowT;
const pip=seatElm('tankPip');
{
const sp2=t.aimDir().multiplyScalar(SHELL_SPD);
const simP=t.muzzle.clone();
let hitP=null;
for(let i=0;i<36;i++){
	sp2.y-=SHELL_G*0.1;
const step=sp2.length()*0.1;
const dirN=sp2.clone().normalize();
const wr=raycastWorld(simP,dirN,step);
if(wr){ hitP=simP.clone().addScaledVector(dirN,wr.dist); break; }
simP.addScaledVector(dirN,step);
if(simP.y<heightAt(simP.x,simP.z)){ hitP=simP.clone(); break; }
}
if(!hitP) hitP=simP;
const v=hitP.project(camera);
if(v.z<1){
pip.style.display='block';
pip.style.left=((v.x*0.5+0.5)*innerWidth)+'px';
pip.style.top=((1-(v.y*0.5+0.5))*innerHeight)+'px';
} else pip.style.display='none';
}
// 同轴机枪准星: 从摄像机出发避免自碰撞
{
let mgSrc=camera.position.clone();
let mgDir=camForward();
let mgD=180;
const mgw=raycastWorld(mgSrc.clone().addScaledVector(mgDir,2.5),mgDir,mgD);
let mgHit;
if(mgw) mgHit=mgSrc.addScaledVector(mgDir,mgw.dist+2.5); else mgHit=mgSrc.clone().addScaledVector(mgDir,mgD);
const mgv=mgHit.project(camera);
const mpip=seatElm('mgPip');
if(mgv.z<1){
mpip.style.display='block';
mpip.style.left=((mgv.x*0.5+0.5)*innerWidth)+'px';
mpip.style.top=((1-(mgv.y*0.5+0.5))*innerHeight)+'px';
} else mpip.style.display='none';
}
}
const _heat=seatElm('heatFill');
_heat.style.width=(clamp(1-t.cannonCd/t.def.reload,0,1)*100)+'%';
_heat.style.background=t.cannonCd<=0?'#8fd18f':'linear-gradient(90deg,#e8c56a,#e83a1a)';
updateInteractHint();
}
updatePlayerTank._els={}; updatePlayerTank._pipT=0;
function updatePlayerPlane(dt){
const p=player, pl=p.onVehicle;
if(!pl.alive){ p.onVehicle=null; return; }
seatElm('heatFill').style.width=(pl.bombs/pl.def.bombs*100)+'%';
seatElm('heatFill').style.background='#9fc0e8';
updateInteractHint();
}
function updatePlayerMortar(dt){
const p=player, m=p.onMortar;
// 解除 ±0.6rad 回旋限制: 炮身 360° 随动视角
const rel=angDiff(m.face+Math.PI,p.yaw);
p.yaw=m.face+Math.PI+rel;
p.pitch=clamp(p.pitch,0.55,1.35);
p.pos.x=m.x-Math.sin(m.face+rel)*0.85;
p.pos.z=m.z-Math.cos(m.face+rel)*0.85;
p.pos.y=standHeight(p.pos.x,p.pos.z,p.pos.y+1); p.vel.set(0,0,0);
m.grp.rotation.y=m.face+rel;
m.cd-=dt;
const dir=camForward();
const vo=V3(m.x+dir.x*60,m.y+dir.y*60,m.z+dir.z*60);
// 落点指示圈: 实时显示炮弹落点
mortarMarker.visible=true;
mortarMarker.position.set(vo.x,heightAt(vo.x,vo.z)+0.07,vo.z);
mortarMarker.rotation.y+=dt*1.2;
const mscale=0.85+Math.sin(nowT*3.2)*0.08;
mortarMarker.scale.setScalar(mscale);
if(mouseDown&&m.cd<=0&&!matchOver){
m.cd=3.2; // 玩家冷却档 (Bot AI rand(4.2,6.5) 显式节奏分叉)
emplMortarShell(m,p,vo.x,vo.z); // 弹道/弹体/击杀来源/炮口烟单源 (13-combat)
AudioSys.metalSlide(0.35,0.18,140,50);
addTrauma(0.12);
}
// 炮管俯仰随视角(高抛→炮管更竖直), 开火后阻尼回位
m.tube.rotation.x=dampF(m.tube.rotation.x,0.62-(p.pitch-0.95)*0.3,5,dt);
seatElm('heatFill').style.width=(clamp(1-m.cd/3.2,0,1)*100)+'%';
updateInteractHint();
}
function updatePlayerAT(dt){
const p=player, g=p.onAT;
g.cd-=dt;
	// 解除水平角度限制: 炮塔可360°回旋, 俯仰放宽到能打到斜坡下/近处的目标
	const rel=angDiff(g.face+Math.PI,p.yaw);
	p.yaw=g.face+Math.PI+rel;
	p.pitch=clamp(p.pitch,-0.55,0.6);
g.yaw.rotation.y=rel;
g.pitch.rotation.x=-p.pitch;
p.pos.x=g.x-Math.sin(g.face)*AT_CREW_DIST; // 站位单源常量 (00-config; P2-19: 旧 1.3 嵌进后方沙袋墙 0.35m)
p.pos.z=g.z-Math.cos(g.face)*AT_CREW_DIST;
p.pos.y=standHeight(p.pos.x,p.pos.z,p.pos.y+1);
p.vel.set(0,0,0);
if(mouseDown&&g.cd<=0&&!matchOver){
const dir=camForward();
emplATFire(g,p,dir); // 冷却/炮口/弹速/特效/击杀来源单源 (13-combat, 与 Bot 同一份)
addTrauma(0.45);
}
seatElm('heatFill').style.width=(clamp(1-g.cd/4.5,0,1)*100)+'%';
updateInteractHint();
}
function updatePlayerAA(dt){
const p=player, g=p.onAA;
g.cd-=dt;
// 解除"防空炮只能对空": 俯仰可下压平射, 弹片同时可命中地面士兵/载具
p.pitch=clamp(p.pitch,-0.45,1.35);
g.yaw.rotation.y=p.yaw+Math.PI;
g.pitch.rotation.x=-p.pitch;
p.pos.x=g.x; p.pos.z=g.z-0.9;
p.pos.y=standHeight(p.pos.x,p.pos.z,p.pos.y+1);
p.vel.set(0,0,0);
// 提前量指示圈
const pip=seatElm('leadPip');
let ep=null,bd=1e9;
for(const pl2 of planes){ if(pl2.alive&&pl2.team!==p.team){ const d=pl2.pos.distanceTo(V3(g.x,g.y,g.z)); if(d<bd){ bd=d; ep=pl2; } } }
if(ep&&bd<280){
const tof=bd/150;
const lead=ep.pos.clone().addScaledVector(ep.velVec(),tof);
const v=lead.project(camera);
if(v.z<1&&Math.abs(v.x)<1.1&&Math.abs(v.y)<1.1){
pip.style.display='block';
pip.style.left=((v.x*0.5+0.5)*innerWidth)+'px';
pip.style.top=((1-(v.y*0.5+0.5))*innerHeight)+'px';
} else pip.style.display='none';
} else pip.style.display='none';
if(mouseDown&&g.cd<=0&&!matchOver){
g.cd=EMPL_AA_CD; // 与 Bot 同档单源 (D1=c)
p._src='防空炮'; // 击杀来源: 固定防空炮
const dir=camForward();
fireFlak(g,p,dir);
addTrauma(0.1);
p.recoilPitch+=0.004;
p.lastFiredT=nowT;
}
seatElm('heatFill').style.width=(clamp(1-g.cd/EMPL_AA_CD,0,1)*100)+'%';
updateInteractHint();
}
function updatePlayerMG(dt){
const p=player, mg=p.onMG;
// 解除水平角度限制: 机枪可360°回旋; 俯仰放宽可压向坡下近距目标
p.pitch=clamp(p.pitch,-0.7,0.45);
p.pos.y=standHeight(p.pos.x,p.pos.z,p.pos.y+1);
p.vel.set(0,0,0);
mg.yaw.rotation.y=angDiff(mg.face+Math.PI,p.yaw);
mg.pitch.rotation.x=-p.pitch*0.9;
mg.fireT-=dt;
mg.heat=Math.max(0,mg.heat-dt*(mouseDown?0:0.22)); // 玩家散热档 0.22 且开火不散 (Bot 0.15 常散=显式节奏分叉)
if(mouseDown&&mg.fireT<=0&&mg.heat<1&&!matchOver){
const dir=camForward();
const spread=0.011+mg.heat*0.015; // 玩家输入散布 (随热量; Bot 走 0.02*(suppression+0.7))
const rv=camRight(), uv=rv.clone().cross(dir).negate();
dir.addScaledVector(rv,rand(-spread,spread)).addScaledVector(uv,rand(-spread,spread)).normalize();
p.recoilPitch+=0.0022;
p.pitch=clamp(p.pitch+0.0012,-0.7,0.45);
p.yaw+=rand(-1,1)*0.0018;
addTrauma(0.06);
AudioSys.gunshot('mg',0,0);
emplMGFire(mg,p,dir); // 弹道/冷却/热量/特效/击杀来源单源 (13-combat, 与 Bot 同一份; headMul 统一 1.9)
if(mg.heat>=1){ AudioSys.metalSlide(0.4,0.3,400,200); } // 过热提示: emplMGFire 内已累加热量
}
seatElm('heatFill').style.width=(mg.heat*100)+'%';
updateInteractHint();
}
