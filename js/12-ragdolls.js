// ─────────────────────────────────────────────
// 12-ragdolls.js —— 布娃娃物理/建筑碎块
// 源: Index.original.html 第 4035-4273 行
// ─────────────────────────────────────────────
'use strict';
// ===== 布娃娃尸体 (cannon.js 物理, 加载失败则回退旧倒地动画) =====
// (2026-09-26 A4 顺手清: RAG.geo 那 7 个 BoxGeometry 是死代码 —— 自古无人读, mkPart 当场 new 自己的几何;
//  几何是逐具 dispose 的 (见 removeRagdoll), 共享的只有材质。历史交付文档不改。)
const RAG={world:null,list:[]};
function ragInit(){
if(!window.CANNON||RAG.world) return;
RAG.world=new CANNON.World();
RAG.world.gravity.set(0,-11,0);
RAG.world.broadphase=new CANNON.NaiveBroadphase();
RAG.world.solver.iterations=5;
}
function spawnRagdoll(bot,attacker,isHead){
ragInit();
if(!RAG.world) return false;
if(RAG.list.length>=8) removeRagdoll(RAG.list[0]);
const U=uniformMats[bot.team];
const yaw=bot.yaw, p=bot.pos;
const sn=Math.sin(yaw),cs=Math.cos(yaw);
const loc=(lx,ly,lz)=>[p.x+cs*lx+sn*lz, p.y+ly, p.z-sn*lx+cs*lz];
// ── 初始装配 (2026-09-26 A4 修): 站位表与下面 cons 的 P2P 锚点**同源**, 部件朝向与站位同一旋转 ⇒
// 六条约束的初始误差恒为 0 (刚体装配)。姿态取死时姿态, 与角色动画的 (骨盆高, 躯干俯角) 同档:
//   站 (0.97, 0) / 蹲 (0.60, 0.95) / 趴 (0.22, 1.50)。
// 旧版是 `base=bot.prone?0.35:bot.crouch?0.75:1` —— **只压位置**, 不压形状也不压锚点 ⇒ 躯干约束初错
// 0.25m、腿 0.42m、头 0.26m。GSSolver 的 Baumgarte 项 (B=-g·a, a≈14@60fps) 把这笔位置误差换算成弹射
// 速度 (与下面头盔那条注释里记的飞天放大器是同一个), 趴姿尸体那一下"往上跳 0.25m"就是它。
// 蹲姿取俯角 0.95 而非 0: 布娃娃没有膝关节, 半蹲的刚体骨架表达不了, 但按 0.95 折下去时**脚端正好落在
// 地面** (0.60-0.92·cos0.95≈0.06m) —— 尸体顺着死时的高度向前扑倒, 而不是先被弹一下再倒。
const RAG_POSE=bot.prone?{h:0.22,th:1.50}:(bot.crouch?{h:0.60,th:0.95}:{h:0.97,th:0.0});
const cp=Math.cos(RAG_POSE.th), sp2=Math.sin(RAG_POSE.th);
// 站位 → 世界: 先 Rx(th) (躯干俯角把"沿身体向上"转成"向前"), 再 Ry(yaw) (与 loc 同规)。
// 部件朝向 = 同一个复合旋转, 用 cannon 自己的 setFromEuler(th,yaw,0,'YXZ') 表达 (= Ry(yaw)·Rx(th),
// 与上面 locP 逐项对应; 已用 dev/_cannon.js 实测 vmult(局部 +Y) == locP 的站位方向)。
// ⚠ 不要改成手工 new CANNON.Quaternion()+setFromAxisAngle+mult: 本仓多个沙箱的 CANNON 是半截桩
//   (没有 Quaternion 构造器), 一旦在生成路径上构造就会让那些探针整片报"运行期异常"。
//   原先这里的两处写死姿态 (趴 0.35/蹲 0.75 的压缩) 同理只在位置层生效 —— 见上面的说明。
const qSet=(q)=>{ q.setFromEuler(RAG_POSE.th,yaw,0,'YXZ'); return q; };
const locP=(lx,ly,lz)=>loc(lx, ly*cp-lz*sp2, ly*sp2+lz*cp);
// 站位 (相对骨盆, 与 cons 里的 P2P 锚点逐条对应): 躯干 +0.39 · 头 +0.79 · 臂 +0.35 · 腿 -0.47
const ST={torso:0.39, head:0.79, arm:0.35, leg:-0.47, armX:0.31, legX:0.12};
// 使用阵营制服材质, 保持外观一致
const coatMat=U.coat, pantMat=U.pants, skinMat=U.skin, helmMat=U.helm;
const parts=[];
// (2026-09-26 A4 顺手清: 首参 geoKey 自古无人用, 删掉 —— 每具尸体当场 new 自己的几何)
function mkPart(mat,sx,sy,sz,mass,px,py,pz){
const mesh=new THREE.Mesh(new THREE.BoxGeometry(sx*2,sy*2,sz*2),mat);
mesh.castShadow=true; scene.add(mesh);
const body=new CANNON.Body({mass});
body.addShape(new CANNON.Box(new CANNON.Vec3(sx,sy,sz)));
body.position.set(px,py,pz); qSet(body.quaternion);
body.angularDamping=0.4; body.linearDamping=0.08;
RAG.world.addBody(body);
parts.push({mesh,body,hy:Math.min(sy,sz)});
return body;
}
const H=RAG_POSE.h;
let b;
b=mkPart(pantMat,0.2,0.13,0.12,6,...locP(0,H,0)); const pelvis=b;
b=mkPart(coatMat,0.22,0.25,0.13,9,...locP(0,H+ST.torso,0)); const torso=b;
b=mkPart(skinMat,0.1,0.11,0.1,2.5,...locP(0,H+ST.head,0)); const head=b;
b=mkPart(coatMat,0.06,0.28,0.06,2,...locP(-ST.armX,H+ST.arm,0)); const armL=b;
b=mkPart(coatMat,0.06,0.28,0.06,2,...locP(ST.armX,H+ST.arm,0)); const armR=b;
b=mkPart(pantMat,0.075,0.45,0.075,4,...locP(-ST.legX,H+ST.leg,0)); const legL=b;
b=mkPart(pantMat,0.075,0.45,0.075,4,...locP(ST.legX,H+ST.leg,0)); const legR=b;
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
const hp=locP(0,H+ST.head+hy2,0); // 头盔=头部件之上 hy2 (2026-09-12 修复: 原写法把 p.y 重复累加, 头盔初始悬空≈海拔高度, 与头的 P2P 约束初始误差经求解器换算成 ~14×g 的弹射速度 → 坡地/高地死亡尸体飞天; 2026-09-26 A4: 站位改用同一张 ST 表, 腿/蹲/趴三态都不再产生初错)
hb2.position.set(hp[0],hp[1],hp[2]); qSet(hb2.quaternion);
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
// (2026-09-26 A4: 锚点按"装配即零误差"重算 —— 臂/腿/头盔三处原本各差 0.072/0.110/0.048m, 同样是初错
//  进求解器被换算成弹射冲量。现在七条约束的初始间距都是 0, 与上面 ST 站位表逐条对应。)
const cons=[P2P(torso,[0,-0.26,0],pelvis,[0,0.13,0]),P2P(head,[0,-0.13,0],torso,[0,0.27,0]),P2P(armL,[0,0.24,0],torso,[-ST.armX,0.2,0]),P2P(armR,[0,0.24,0],torso,[ST.armX,0.2,0]),P2P(legL,[0,0.47,0],pelvis,[-ST.legX,0,0]),P2P(legR,[0,0.47,0],pelvis,[ST.legX,0,0])];
// 头盔用松弛约束挂在头上, 可自由旋转
if(helmBody){
const hc=new CANNON.PointToPointConstraint(head,new CANNON.Vec3(0,0.13,0),helmBody,new CANNON.Vec3(0,0.13-hy2,0));
RAG.world.addConstraint(hc);
cons.push(hc);
}
{ const ptarr=[pelvis,torso,head,armL,armR,legL,legR,helmBody].filter(Boolean);
for(const pt2 of ptarr){
// 尸体继承角色移动惯性 + 被命中方向冲量 (旧"爆炸额外推力"死分支已删: window._lastExplosion 全库无写入, 2026-09-06 D3=a)
let ix=rand(-1,1),iz=rand(-1,1),imp=rand(2.2,3.5);
if(attacker&&attacker.pos){
const dx=p.x-attacker.pos.x,dz=p.z-attacker.pos.z;
const dl=Math.hypot(dx,dz)||1;
ix=dx/dl; iz=dz/dl; imp=rand(2.8,5.5);
}
if(isHead) imp*=1.4;
pt2.velocity.set(bot.vel.x*0.6+ix*imp*rand(0.7,1.3),rand(0.5,3.5),bot.vel.z*0.6+iz*imp*rand(0.7,1.3));
pt2.angularVelocity.set(rand(-5,5),rand(-4,4),rand(-5,5));
}
if(isHead){ head.velocity.y+=2.2; head.angularVelocity.set(rand(-9,9),rand(-9,9),rand(-9,9)); }
}
const entry={parts,cons,t:9,bodies:parts.map(p=>p.body)};
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
// 几何逐具回收 (2026-09-25 修): 每具尸体的 7~8 个 Box/Sphere 几何都是 spawnRagdoll 当场 new 的
// (材质才是共享的 U.coat/pants/skin/helm —— 只能删几何, 删材质会打穿全队制服)。旧版只 scene.remove,
// 几何留在 GPU 上: 一局打下来几百具尸体 = 几百个几何常驻, 就地重开也收不回。同文件 removeDebrisEntry 本是这个写法。
const g=p.mesh&&p.mesh.geometry;
if(g&&typeof g.dispose==='function') g.dispose();
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
DEBRIS.list.push({mesh:mesh2,body,hy:Math.min(h,Math.min(w,d))/2,t:rand(16,24),landed:false,bodies:[body]});
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
// ── 大舰甲板: 布娃娃/碎块的落地支撑 + 随舰搬运 (2026-10-01 实机修) ──
// 实机源: 用户报"船体移动的时候不会带着上面的人一起移动"。人的搬运早就有 (15h capRideCollect/capRideApply),
//   但**尸体与碎块**这条链没人管: 它们的落地高度只读 heightAt (纯地形), 甲板是移动平台不在其中 ⇒
//   甲板上被击毙的 Bot 整具穿过舰体掉进海里; 就算撑住了, 舰一开走尸体也留在原地。
//   ①支撑: 改问 15h 的 capDeckShipAt ("哪艘舰的甲板托着这个点", 唯一判据表, 与 standHeight 的
//     capDeckY 同表) —— 无舰/不在甲板/在水线以下时逐位退化为 heightAt, 陆战路径零变化。
//   ②随舰: 按**质心**把整具刚体做一次刚性平移 —— 只加位移, 不动 velocity (逐件重投影或改速度都会变成
//     约束方程的误差, 被求解器换算成弹射速度, 见下面 :245 "尸体起飞"那条教训)。位移由 15h 的
//     capCarryDelta 给 (上一帧位姿 → 当前位姿), 与乘员搬运 capRideApply 同一条口径且无状态。
const _ragC={x:0,z:0};
function ragDeckGround(x,y,z){
const h=heightAt(x,z);
if(typeof capDeckShipAt==='function'){
const s=capDeckShipAt(x,z,y);
if(s) return s.pos.y+s.deck.y;
}
return h;
}
function ragDeckCarry(bodies){
if(!bodies.length||typeof capCarryDelta!=='function') return;
let cx=0,cy=0,cz=0;
for(let i=0;i<bodies.length;i++){ const p=bodies[i].position; cx+=p.x; cy+=p.y; cz+=p.z; }
const inv=1/bodies.length; cx*=inv; cy*=inv; cz*=inv;
const s=capDeckShipAt(cx,cz,cy);   // 注意实参序: (x, z, curY) —— 与 capDeckY 同规
if(!s) return;
capCarryDelta(s,cx,cz,_ragC);
const ddx=_ragC.x-cx, ddz=_ragC.z-cz;
if(ddx||ddz) for(let i=0;i<bodies.length;i++){ bodies[i].position.x+=ddx; bodies[i].position.z+=ddz; }
}
function updateDebris(dt){
for(let i=DEBRIS.list.length-1;i>=0;i--){
const e=DEBRIS.list[i];
e.t-=dt;
const b=e.body;
ragDeckCarry(e.bodies);
const gh=ragDeckGround(b.position.x,b.position.y,b.position.z);
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
ragDeckCarry(r.bodies);          // 甲板上的尸体: 先随舰平移, 再做落地支撑 (支撑判据自然取到新甲板面)
for(const p of r.parts){
const b=p.body;
const gh=ragDeckGround(b.position.x,b.position.y,b.position.z);
// 坡地安全 (2026-09-12, 尸体起飞修复配套): ①阈值按坡度放宽 —— 贴坡部件的法向半厚不变,
//   竖直可沉深度=hy/cosθ, 原平地阈值在坡上会逐帧垂直抬起贴坡部件; ②浅层接触用速度式
//   地面支撑而非位置锚定, 部件可被约束正常拖动, 落地姿态更平稳; ③深埋 (翻滚插入坡面)
//   才限幅抬出 —— 整步位置传送会成为约束方程的位置误差, 被 GSSolver 的 Baumgarte 项
//   (B=-g·a, a≈14@60fps) 换算成弹射速度 (本次"起飞"bug 的放大器), 故限幅
const rgE=0.35;
const rgx=(heightAt(b.position.x+rgE,b.position.z)-heightAt(b.position.x-rgE,b.position.z))/(2*rgE);
const rgz=(heightAt(b.position.x,b.position.z+rgE)-heightAt(b.position.x,b.position.z-rgE))/(2*rgE);
const rgL=Math.sqrt(1+rgx*rgx+rgz*rgz);
const pen=gh+p.hy*rgL-b.position.y; // 竖直下沉深度
if(pen>0){
if(pen>0.1){
b.position.y+=Math.min(pen,0.06);
if(b.velocity.y<0) b.velocity.y*=-0.25;
}else{
b.velocity.y=b.velocity.y*0.85+Math.min(pen*240,45)*dt;
}
b.velocity.x*=0.6; b.velocity.z*=0.6;
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
