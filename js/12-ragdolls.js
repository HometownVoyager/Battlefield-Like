// ─────────────────────────────────────────────
// 12-ragdolls.js —— 布娃娃物理/建筑碎块
// 源: Index.original.html 第 4035-4273 行
// ─────────────────────────────────────────────
'use strict';
// ===== 布娃娃尸体 (cannon.js 物理, 加载失败则回退旧倒地动画) =====
// (2026-09-26 A4 顺手清: RAG.geo 那 7 个 BoxGeometry 是死代码 —— 自古无人读, mkPart 当场 new 自己的几何;
//  几何是逐具 dispose 的 (见 removeRagdoll), 共享的只有材质。历史交付文档不改。)
const RAG={world:null,list:[]};
// ═══ 2026-11-13 性能批 B: 布娃娃静止结算门 ═══
// 现状账: updateRagdolls 每部件每帧 5×heightAt (地面 1 + 坡度差分 4) + world.step + ragCollide + 矩阵同步,
// 尸体落定后 ( usually <2s) 这些全是纯浪费 —— 8 具尸体 ≈ 300 次 heightAt/帧。门设计:
//   ① 冻结 = 记录全部件位姿快照; 冻结期跳过 heightAt/pen 修正/ragCollide/矩阵同步, 每帧把刚体位姿
//      **回贴快照** (world.step 是整世界一次调用躲不掉, 让它积分完再钉回 ⇒ 零漂移; 不依赖 cannon 的
//      sleep 语义, 对真 cannon/沙箱桩/任何假物理都成立);
//   ② 静止判据 = 全部件逐帧位移 < 2.5mm 持续 2.5s (Baumgarte 微颤 ~0.1mm/帧, 落定即过门; 尸体不再
//      微颤 = 与旧持续抖动的唯一可感差异, 观感等同"定格");
//   ③ 活跃帽 = RAG_ACTIVE_MAX 具 —— 超帽把"已接近静止 (stillT>0.5s) 的最旧一具"立即冻结 (没有半静止的
//      才冻最旧的), 尸体视觉保留在场, t 到期照常移除; 与 spawnRagdoll 开头既有的 8 具总量帽并行;
//   ④ 解冻 = 冻结期每帧探一次部件速度, 任一部件 > 0.9m/s 判"外部冲量" (爆炸推/车辆碰/脚本 poke) ⇒
//      解冻一具回到完整结算。既有代码已无爆炸推尸体的直接入口 (window._lastExplosion 死分支 2026-09-06
//      D3 删除), 本钩按"任何现在/将来写 body.velocity 的路径都被它接住"的口径守住既有交互面;
//      thawRagdoll 为顶层函数 (跨文件可调), 玩家死亡镜头 (20-player 读 parts[0].body.position) 读的是
//      每帧回贴的快照位姿, 冻结不影响它。
const RAG_STILL_T=2.5;
const RAG_STILL_D2=6.25e-6;   // (0.0025m)²/帧
const RAG_ACTIVE_MAX=6;
const RAG_THAW_V2=0.81;       // (0.9m/s)²
function freezeRagdoll(r){
if(!r||r.frozen) return;
r.frozen=true; r.stillT=0;
r.snap=r.parts.map(p=>({x:p.body.position.x,y:p.body.position.y,z:p.body.position.z,
qx:p.body.quaternion.x,qy:p.body.quaternion.y,qz:p.body.quaternion.z,qw:p.body.quaternion.w}));
}
function thawRagdoll(r){
if(!r||!r.frozen) return;
r.frozen=false; r.stillT=0; r.snap=null;
for(let k=0;k<r.parts.length;k++){ const b=r.parts[k].body,l=r.last[k];
l[0]=b.position.x; l[1]=b.position.y; l[2]=b.position.z; }
}
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
const body=new CANNON.Body({mass,collisionFilterGroup:0,collisionFilterMask:0});
body.addShape(new CANNON.Box(new CANNON.Vec3(sx,sy,sz)));
body.position.set(px,py,pz); qSet(body.quaternion);
body.angularDamping=0.4; body.linearDamping=0.08;
// ★2026-11-04b 时停批 (用户实报: 时停里被击杀的 Bot / 被炸的建筑"直接隐身消失", 取消时停才显现):
//   旧版网格创建后要等 updateRagdolls(dt>0) 才把刚体位姿贴给网格, 而时停 dt=0 时那条链首行早退
//   ⇒ 新生成的尸体/碎块整具停在场景原点 (视野外), 看起来就是"隐身"。生成当帧即贴初始位姿。
//   quaternion.copy 带守卫: 部分沙箱 CANNON/THREE 桩不带 copy, 位置同步不依赖它 (真 THREE 恒有)。
mesh.position.copy(body.position);
if(mesh.quaternion&&mesh.quaternion.copy) mesh.quaternion.copy(body.quaternion);
RAG.world.addBody(body);
parts.push({mesh,body,hy:Math.min(sy,sz)});
return body;
}
const H=RAG_POSE.h;
let b;
b=mkPart(pantMat,0.2,0.13,0.12,6,...locP(0,H,0)); const pelvis=b;
b=mkPart(coatMat,0.22,0.25,0.13,9,...locP(0,H+ST.torso,0)); const torso=b;
// 背包随躯干 (2026-11-16 批7, 用户实报"布娃娃背后的背包会消失, 要粘在背上不要乱动"): 活人模型的
// 背包是 torsoG 里的匿名盒 (11-soldiers.js, 0.3×0.34×0.14 背在身后 z=-0.18, 无引用带出), 布娃娃重建
// 7 件裸身体时没带它 + 原模型整体隐藏 ⇒ 死亡瞬间背包凭空消失。修法 = 躯干 mesh 的**子网格**: 躯干
// 刚体每帧 position/quaternion 写进 mesh, 子网格自动继承全部翻滚/冻结位姿 = "粘在背上", 零新增
// 刚体/约束/更新代码 (独立刚体档会"被撞飞不粘背", 与需求相反)。几何随 removeRagdoll 的 traverse 回收。
{
const tMesh=parts[parts.length-1].mesh;
const bpG=new THREE.BoxGeometry(0.3,0.34,0.14);
const bpM=new THREE.Mesh(bpG,pantMat);
bpM.position.set(0,0.02,-0.16);   // 躯干半深 0.13, 背包半深 0.07 @ z=-0.16 ⇒ 后缘 -0.23 贴背微嵌入
bpM.castShadow=false;
tMesh.add(bpM);
}
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
const hb2=new CANNON.Body({mass:1.8,collisionFilterGroup:0,collisionFilterMask:0});
hb2.addShape(new CANNON.Sphere(hs2*0.8));
const hp=locP(0,H+ST.head+hy2,0); // 头盔=头部件之上 hy2 (2026-09-12 修复: 原写法把 p.y 重复累加, 头盔初始悬空≈海拔高度, 与头的 P2P 约束初始误差经求解器换算成 ~14×g 的弹射速度 → 坡地/高地死亡尸体飞天; 2026-09-26 A4: 站位改用同一张 ST 表, 腿/蹲/趴三态都不再产生初错)
hb2.position.set(hp[0],hp[1],hp[2]); qSet(hb2.quaternion);
hb2.angularDamping=0.3; hb2.linearDamping=0.06;
hm.position.copy(hb2.position);   // 2026-11-04b 时停批: 生成当帧贴初始位姿 (同 mkPart)
if(hm.quaternion&&hm.quaternion.copy) hm.quaternion.copy(hb2.quaternion);
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
const entry={parts,cons,t:9,bodies:parts.map(p=>p.body),frozen:false,stillT:0,
last:parts.map(p=>[p.body.position.x,p.body.position.y,p.body.position.z])};
RAG.list.push(entry);
// ★2026-11-13 性能批 B③: 活跃布娃娃数量帽 —— 超帽立即冻结最旧的 (优先挑已接近静止的)。
//   冻结只是停结算, 尸体网格/碰撞体摘除链 (removeRagdoll) 与 t 到期路径照旧。
let _act=0;
for(let i2=0;i2<RAG.list.length;i2++) if(!RAG.list[i2].frozen) _act++;
while(_act>RAG_ACTIVE_MAX&&!window.RAG_NO_FREEZE){   // 回退旗 (B): RAG_NO_FREEZE=关活跃帽
let pick=-1;
for(let i2=0;i2<RAG.list.length;i2++){ const r2=RAG.list[i2]; if(!r2.frozen&&(r2.stillT||0)>0.5){ pick=i2; break; } }
if(pick<0) for(let i2=0;i2<RAG.list.length;i2++){ if(!RAG.list[i2].frozen){ pick=i2; break; } }
if(pick<0) break;
freezeRagdoll(RAG.list[pick]);
_act--;
}
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
// ★2026-11-16 批7: traverse 回收 —— 躯干 mesh 带背包子网格后, 旧的单层 geometry.dispose 会漏掉它。
if(p.mesh) p.mesh.traverse(o=>{ const g=o&&o.geometry; if(g&&typeof g.dispose==='function') g.dispose(); });
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
// ★2026-11-11 性能批: 碎块不再投影。一栋大墙坍塌一次塞满 96 块 (上限即满), 主+阴影两遍 = +192 draw
// call 恰好压在"炸楼瞬间"; 小件碎块的地面影子肉眼收益≈0, 换掉的是坍塌当帧的半条阴影 pass。
mesh2.castShadow=false;
scene.add(mesh2);
const body=new CANNON.Body({mass:Math.max(2,w*h*d*2.5),collisionFilterGroup:0,collisionFilterMask:0});
body.addShape(new CANNON.Box(new CANNON.Vec3(w/2,h/2,d/2)));
body.position.set(px,py,pz);
body.quaternion.setFromEuler(0,ry,0);
body.angularDamping=0.32; body.linearDamping=0.1;
mesh2.position.copy(body.position);   // 2026-11-04b 时停批: 生成当帧贴初始位姿 (dt=0 时 updateDebris 不跑)
if(mesh2.quaternion&&mesh2.quaternion.copy) mesh2.quaternion.copy(body.quaternion);
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
if(!P||!(P.width>0&&P.height>0&&P.depth>0)){
// ★2026-11-17 批7 (用户实报"水泥墩子被毁直接消失"): 非盒几何 (圆柱锅炉/烟囱/圆锥锥体一类) 旧版在此
//   直接跳过 ⇒ 这类件被毁只有尘没有 CANNON 碎块。兜底: 按世界包围盒 (Box3.setFromObject, 免管
//   rotation.z 竖立圆柱的局部轴) 均布切块抛出, 材质取原 mesh, 2×2×2 块数上限防 96 池被单件灌满。
//   桩环境 (THREE.Box3 缺失/几何异常) 静默跳过, 行为与旧版一致。
if(!m.geometry||typeof THREE==='undefined'||typeof THREE.Box3!=='function') return;
try{
const bb=new THREE.Box3().setFromObject(m);
const w=bb.max.x-bb.min.x, h=bb.max.y-bb.min.y, d=bb.max.z-bb.min.z;
if(!(w>0.3&&h>0.2&&d>0.3&&w*h*d>0.06)) return;
const nx=Math.max(1,Math.min(2,Math.round(w/1.2))), ny=Math.max(1,Math.min(2,Math.round(h/1.4))), nz=Math.max(1,Math.min(2,Math.round(d/1.2)));
for(let ix=0;ix<nx;ix++)for(let iy=0;iy<ny;iy++)for(let iz=0;iz<nz;iz++){
const cw=Math.max(0.22,(w/nx)*rand(0.7,0.95)), ch=Math.max(0.2,(h/ny)*rand(0.7,0.95)), cd=Math.max(0.22,(d/nz)*rand(0.7,0.95));
spawnDebris(m.material,bb.min.x+w*(ix+0.5)/nx,bb.min.y+h*(iy+0.5)/ny,bb.min.z+d*(iz+0.5)/nz,0,cw,ch,cd,cx,cz);
}
}catch(e){}
return;
}
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
// ── (2026-11-10: 旧"大舰甲板布娃娃支撑/随舰搬运"段随大舰子系统下架摘除 ——
//    ragDeckGround 退化为纯 heightAt, ragDeckCarry 整支移除; 原文见 archive/naval-coral-ironbottom-20261110/) ──
const _ragC={x:0,z:0};
function ragDeckGround(x,y,z){
return heightAt(x,z);
}
function updateDebris(dt){
for(let i=DEBRIS.list.length-1;i>=0;i--){
const e=DEBRIS.list[i];
e.t-=dt;
const b=e.body;
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
if(!RAG.world||dt<=0) return;
if(!RAG.list.length&&!DEBRIS.list.length) return;
// ★2026-11-13 性能批 B④: 冻结具预扫 —— 外部冲量检测 (解冻) 或保持冻结。
//   world.step 在下方整世界跑一次, 冻结具只能在 step 前后做文章: 探速 (外部 poke 的 velocity 留在
//   体上直到这里) + step 后位姿回贴 (下方冻结分支)。
for(let i=0;i<RAG.list.length;i++){
const r=RAG.list[i];
if(!r.frozen) continue;
for(let k=0;k<r.parts.length;k++){
const v=r.parts[k].body.velocity;
if(v.x*v.x+v.y*v.y+v.z*v.z>RAG_THAW_V2){ thawRagdoll(r); break; }
}
}
RAG.world.step(1/60,Math.min(dt,0.05),4);
for(let i=RAG.list.length-1;i>=0;i--){
const r=RAG.list[i];
r.t-=dt;
if(r.frozen){
// 冻结: 位姿钉回快照 (step 的重力/约束积分被整帧抹平 ⇒ 零漂移), 不做 heightAt/坡度/ragCollide/矩阵同步
const snap=r.snap;
for(let k=0;k<r.parts.length;k++){
const b=r.parts[k].body, s2=snap[k];
b.position.x=s2.x; b.position.y=s2.y; b.position.z=s2.z;
b.quaternion.x=s2.qx; b.quaternion.y=s2.qy; b.quaternion.z=s2.qz; b.quaternion.w=s2.qw;
const v=b.velocity; v.x=0; v.y=0; v.z=0;
const av=b.angularVelocity; av.x=0; av.y=0; av.z=0;
}
if(r.t<=0) removeRagdoll(r);
continue;
}
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
// ★2026-11-13 性能批 B②: 静止检测 —— 全部件逐帧位移都够小就累计 stillT, 达 RAG_STILL_T 冻结
//   (跳过此后的 heightAt×5/部件/帧 + ragCollide + 矩阵同步; 冻结后网格停在最终姿态, 尸体不再微颤)
let maxD2=0;
for(let k=0;k<r.parts.length;k++){
const b=r.parts[k].body, l=r.last[k];
const dx=b.position.x-l[0], dy=b.position.y-l[1], dz=b.position.z-l[2];
const d2=dx*dx+dy*dy+dz*dz;
if(d2>maxD2) maxD2=d2;
l[0]=b.position.x; l[1]=b.position.y; l[2]=b.position.z;
}
if(maxD2<RAG_STILL_D2) r.stillT+=dt; else r.stillT=0;
if(r.stillT>=RAG_STILL_T&&!window.RAG_NO_FREEZE) freezeRagdoll(r);   // 回退旗 (B): RAG_NO_FREEZE=关静止冻结 (旧全活跃结算口径)
if(r.t<=0) removeRagdoll(r);
}
updateDebris(dt);
}
