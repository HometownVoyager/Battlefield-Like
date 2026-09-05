// ─────────────────────────────────────────────
// 12-ragdolls.js —— 布娃娃物理/建筑碎块
// 源: Index.original.html 第 4035-4273 行
// ─────────────────────────────────────────────
'use strict';
// ===== 布娃娃尸体 (cannon.js 物理, 加载失败则回退旧倒地动画) =====
const RAG={world:null,list:[],geo:null};
function ragInit(){
if(!window.CANNON||RAG.world) return;
RAG.world=new CANNON.World();
RAG.world.gravity.set(0,-11,0);
RAG.world.broadphase=new CANNON.NaiveBroadphase();
RAG.world.solver.iterations=5;
RAG.geo={
pelvis:new THREE.BoxGeometry(0.4,0.26,0.24),
torso:new THREE.BoxGeometry(0.44,0.5,0.26),
head:new THREE.BoxGeometry(0.2,0.22,0.2),
arm:new THREE.BoxGeometry(0.12,0.56,0.12),
leg:new THREE.BoxGeometry(0.15,0.9,0.15),
};
}
function spawnRagdoll(bot,attacker,isHead){
ragInit();
if(!RAG.world) return false;
if(RAG.list.length>=8) removeRagdoll(RAG.list[0]);
const U=uniformMats[bot.team];
const yaw=bot.yaw, p=bot.pos;
const sn=Math.sin(yaw),cs=Math.cos(yaw);
const loc=(lx,ly,lz)=>[p.x+cs*lx+sn*lz, p.y+ly, p.z-sn*lx+cs*lz];
const base=bot.prone?0.35:bot.crouch?0.75:1;
// 使用阵营制服材质, 保持外观一致
const coatMat=U.coat, pantMat=U.pants, skinMat=U.skin, helmMat=U.helm;
const parts=[];
function mkPart(geoKey,mat,sx,sy,sz,mass,px,py,pz,y){
const mesh=new THREE.Mesh(new THREE.BoxGeometry(sx*2,sy*2,sz*2),mat);
mesh.castShadow=true; scene.add(mesh);
const body=new CANNON.Body({mass});
body.addShape(new CANNON.Box(new CANNON.Vec3(sx,sy,sz)));
body.position.set(px,py,pz); body.quaternion.setFromEuler(0,y,0);
body.angularDamping=0.4; body.linearDamping=0.08;
RAG.world.addBody(body);
parts.push({mesh,body,hy:Math.min(sy,sz)});
return body;
}
let b;
b=mkPart(null,pantMat,0.2,0.13,0.12,6,...loc(0,0.97*base,0),yaw); const pelvis=b;
b=mkPart(null,coatMat,0.22,0.25,0.13,9,...loc(0,1.36*base,0),yaw); const torso=b;
b=mkPart(null,skinMat,0.1,0.11,0.1,2.5,...loc(0,1.76*base,0),yaw); const head=b;
b=mkPart(null,coatMat,0.06,0.28,0.06,2,...loc(-0.31,1.32*base,0),yaw); const armL=b;
b=mkPart(null,coatMat,0.06,0.28,0.06,2,...loc(0.31,1.32*base,0),yaw); const armR=b;
b=mkPart(null,pantMat,0.075,0.45,0.075,4,...loc(-0.12,0.5*base,0),yaw); const legL=b;
b=mkPart(null,pantMat,0.075,0.45,0.075,4,...loc(0.12,0.5*base,0),yaw); const legR=b;
// 头盔: 独立物理体, 死亡时弹开
let helmBody=null, hs2=0.155, hy2=0.16;
const hs=TEAM_FACTION[bot.team].helmet;
if(hs){
if(hs==='pot'){ hs2=0.15; hy2=0.17; }
else if(hs==='ssh'){ hs2=0.152; hy2=0.165; }
else if(hs==='jp'){ hs2=0.142; hy2=0.175; }
else{ hs2=0.13; hy2=0.19; } // cap
const hm=new THREE.Mesh(new THREE.SphereGeometry(hs2,8,6),helmMat);
hm.castShadow=true; scene.add(hm);
const hb2=new CANNON.Body({mass:1.8});
hb2.addShape(new CANNON.Sphere(hs2*0.8));
const hp=loc(0,p.y+1.76*base+hy2,0);
hb2.position.set(hp[0],hp[1],hp[2]); hb2.quaternion.setFromEuler(0,yaw,0);
hb2.angularDamping=0.3; hb2.linearDamping=0.06;
RAG.world.addBody(hb2);
parts.push({mesh:hm,body:hb2,hy:hs2});
helmBody=hb2;
}
const P2P=(A,pa,B,pb)=>{
const c=new CANNON.PointToPointConstraint(A,new CANNON.Vec3(pa[0],pa[1],pa[2]),B,new CANNON.Vec3(pb[0],pb[1],pb[2]));
RAG.world.addConstraint(c);
return c;
};
const cons=[P2P(torso,[0,-0.26,0],pelvis,[0,0.13,0]),P2P(head,[0,-0.13,0],torso,[0,0.27,0]),P2P(armL,[0,0.3,0],torso,[-0.27,0.2,0]),P2P(armR,[0,0.3,0],torso,[0.27,0.2,0]),P2P(legL,[0,0.47,0],pelvis,[-0.12,-0.11,0]),P2P(legR,[0,0.47,0],pelvis,[0.12,-0.11,0])];
// 头盔用松弛约束挂在头上, 可自由旋转
if(helmBody){
const hc=new CANNON.PointToPointConstraint(head,new CANNON.Vec3(0,0.13,0),helmBody,new CANNON.Vec3(0,-hs2*0.5,0));
RAG.world.addConstraint(hc);
cons.push(hc);
}
{ const ptarr=[pelvis,torso,head,armL,armR,legL,legR,helmBody].filter(Boolean);
for(const pt2 of ptarr){
// 尸体继承角色移动惯性 + 被命中方向冲量 + 爆炸额外推力
let ix=rand(-1,1),iz=rand(-1,1),imp=rand(2.2,3.5);
if(attacker&&attacker.pos){
const dx=p.x-attacker.pos.x,dz=p.z-attacker.pos.z;
const dl=Math.hypot(dx,dz)||1;
ix=dx/dl; iz=dz/dl; imp=rand(2.8,5.5);
}
const blastT=window._lastExplosion||0;
const blastDist=window._lastExplosionPos?Math.hypot(p.x-window._lastExplosionPos.x,p.z-window._lastExplosionPos.z):1e9;
if(nowT-blastT<0.3&&blastDist<8){ imp*=1.8+rand(1,2.2); }
if(isHead) imp*=1.4;
pt2.velocity.set(bot.vel.x*0.6+ix*imp*rand(0.7,1.3),rand(0.5,3.5),bot.vel.z*0.6+iz*imp*rand(0.7,1.3));
pt2.angularVelocity.set(rand(-5,5),rand(-4,4),rand(-5,5));
if(blastDist<8){ pt2.velocity.y+=rand(1.5,5); pt2.angularVelocity.set(rand(-9,9),rand(-9,9),rand(-9,9)); }
}
if(isHead){ head.velocity.y+=2.2; head.angularVelocity.set(rand(-9,9),rand(-9,9),rand(-9,9)); }
}
const entry={parts,cons,t:9};
RAG.list.push(entry);
return entry;
}
function removeRagdoll(r){
const i=RAG.list.indexOf(r);
if(i<0) return;
for(const c of r.cons) RAG.world.removeConstraint(c);
for(const p of r.parts){
if(RAG.world.removeBody) RAG.world.removeBody(p.body); else RAG.world.remove(p.body);
scene.remove(p.mesh);
}
RAG.list.splice(i,1);
}
// ===== 建筑碎块物理 (墙体倒塌) =====
const DEBRIS={list:[]};
function spawnDebris(mat,px,py,pz,ry,w,h,d,cx,cz){
if(!window.CANNON) return;
ragInit();
if(!RAG.world) return;
if(DEBRIS.list.length>=96){ removeDebrisEntry(DEBRIS.list.shift()); } // 2026-09-01: 26→96 (墙/屋顶即刻碎块化后单栋建筑碎块量增大)
const mesh2=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
mesh2.castShadow=true;
scene.add(mesh2);
const body=new CANNON.Body({mass:Math.max(2,w*h*d*2.5)});
body.addShape(new CANNON.Box(new CANNON.Vec3(w/2,h/2,d/2)));
body.position.set(px,py,pz);
body.quaternion.setFromEuler(0,ry,0);
body.angularDamping=0.32; body.linearDamping=0.1;
if(RAG.world.addBody) RAG.world.addBody(body); else RAG.world.add(body);
// 从爆心向外倒塌
const dx=px-cx, dz=pz-cz; const dl=Math.hypot(dx,dz)||1;
body.velocity.set(dx/dl*rand(1.2,3.2)+rand(-0.8,0.8), rand(0.3,2), dz/dl*rand(1.2,3.2)+rand(-0.8,0.8));
body.angularVelocity.set(rand(-3,3),rand(-1.5,1.5),rand(-3,3));
DEBRIS.list.push({mesh:mesh2,body,hy:Math.min(h,Math.min(w,d))/2,t:rand(16,24),landed:false});
}
function removeDebrisEntry(e){
if(RAG.world.removeBody) RAG.world.removeBody(e.body); else RAG.world.remove(e.body);
scene.remove(e.mesh);
e.mesh.geometry.dispose();
}
function spawnWallDebris(m,cx,cz){
if(!window.CANNON) return;
const P=m.geometry&&m.geometry.parameters;
if(!P||!(P.width>0&&P.height>0&&P.depth>0)) return; // 参数缺失/桩环境直接跳过 (防 NaN 碎块)
const ry=m.rotation.y||0;
const w=P.width,h=P.height,d=P.depth;
if(!(w*h*d>0.04)) return;
const nx=w>4.6?3:(w>2.4?2:1), ny=h>1.7?2:1;
const cs=Math.cos(ry),sn=Math.sin(ry);
for(let ix=0;ix<nx;ix++)for(let iy=0;iy<ny;iy++){
const cw=(w/nx)*rand(0.72,0.94), ch=(h/ny)*rand(0.72,0.94), cd2=Math.max(0.22,d*rand(0.85,1));
const lx=-w/2+(w/nx)*(ix+0.5);
const ly=-h/2+(h/ny)*(iy+0.5);
spawnDebris(m.material,m.position.x+cs*lx,m.position.y+ly,m.position.z-sn*lx,ry,cw,ch,cd2,cx,cz);
}
}
// 刚体碎块/尸块与建筑的碰撞: 用射线格网就近查询AABB并推出
function ragCollide(b,r){
if(!RGRID.boxCells) return;
const vx=b.velocity.x, vy=b.velocity.y, vz=b.velocity.z;
if(vx*vx+vz*vz<0.15&&Math.abs(vy)<0.8) return;
const {cell,N,off}=RGRID;
const ci=clamp(Math.floor((b.position.x+off)/cell),0,N-1);
const cj=clamp(Math.floor((b.position.z+off)/cell),0,N-1);
const list=RGRID.boxCells[cj*N+ci];
for(let k=0;k<list.length;k++){
const bx2=BOXES[list[k]];
if(bx2.dead) continue;
const px=b.position.x, py=b.position.y, pz=b.position.z;
if(py<bx2.minY-0.05||py>bx2.maxY+0.4) continue;
const cx=clamp(px,bx2.minX,bx2.maxX), cz=clamp(pz,bx2.minZ,bx2.maxZ);
const dx=px-cx, dz=pz-cz;
const d2=dx*dx+dz*dz;
if(d2>=r*r) continue;
// 从上方落到箱顶: 支撑住
if(py>bx2.maxY-0.3&&vy<0){
b.position.y=bx2.maxY+r*0.85;
b.velocity.y*=-0.2; b.velocity.x*=0.8; b.velocity.z*=0.8;
continue;
}
if(d2<1e-8){
const l=Math.min(px-bx2.minX,bx2.maxX-px), rg=Math.min(pz-bx2.minZ,bx2.maxZ-pz);
if(l<rg) b.position.x=(px-bx2.minX<bx2.maxX-px)?bx2.minX-r:bx2.maxX+r;
else b.position.z=(pz-bx2.minZ<bx2.maxZ-pz)?bx2.minZ-r:bx2.maxZ+r;
b.velocity.x*=0.5; b.velocity.z*=0.5;
} else {
const d=Math.sqrt(d2), push=(r-d)/d;
b.position.x+=dx*push; b.position.z+=dz*push;
const vn=(b.velocity.x*dx+b.velocity.z*dz)/Math.max(d2,1e-6);
if(vn<0){ b.velocity.x-=vn*dx*1.35; b.velocity.z-=vn*dz*1.35; }
}
}
}
function updateDebris(dt){
for(let i=DEBRIS.list.length-1;i>=0;i--){
const e=DEBRIS.list[i];
e.t-=dt;
const b=e.body;
const gh=heightAt(b.position.x,b.position.z);
if(b.position.y<gh+e.hy){
b.position.y=gh+e.hy;
const impact=-b.velocity.y;
if(b.velocity.y<0) b.velocity.y*=-0.18;
b.velocity.x*=0.8; b.velocity.z*=0.8;
b.angularVelocity.x*=0.68; b.angularVelocity.y*=0.68; b.angularVelocity.z*=0.68;
if(!e.landed&&impact>2.2){
e.landed=true;
// 落地扬尘
for(let k=0;k<3;k++) spawnP(PT.dirt,b.position.x+rand(-0.4,0.4),gh+0.15,b.position.z+rand(-0.4,0.4),rand(-1.2,1.2),rand(0.4,1.4),rand(-1.2,1.2),rand(0.5,0.8),1.5,rand(0.6,1),0.75,1);
}
}
e.mesh.position.copy(b.position);
e.mesh.quaternion.copy(b.quaternion);
ragCollide(b,Math.max(0.18,e.hy));
if(e.t<=0){ removeDebrisEntry(e); DEBRIS.list.splice(i,1); }
}
}
function updateRagdolls(dt){
if(!RAG.world) return;
if(!RAG.list.length&&!DEBRIS.list.length) return;
RAG.world.step(1/60,Math.min(dt,0.05),2);
for(let i=RAG.list.length-1;i>=0;i--){
const r=RAG.list[i];
r.t-=dt;
for(const p of r.parts){
const b=p.body;
const gh=heightAt(b.position.x,b.position.z);
if(b.position.y<gh+p.hy){
b.position.y=gh+p.hy;
if(b.velocity.y<0) b.velocity.y*=-0.25;
b.velocity.x*=0.85; b.velocity.z*=0.85;
b.angularVelocity.x*=0.78; b.angularVelocity.y*=0.78; b.angularVelocity.z*=0.78;
}
ragCollide(b,0.16);
p.mesh.position.copy(b.position);
p.mesh.quaternion.copy(b.quaternion);
}
if(r.t<=0) removeRagdoll(r);
}
updateDebris(dt);
}
