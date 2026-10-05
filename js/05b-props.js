// ─────────────────────────────────────────────
// 05b-props.js —— 道具/植被 (占位互斥表 PROPS 见 05-world.js)
// 2026-08-24 由 05-world.js 切分: 原第 781-965 行 + 植被 1159-1183 行
// ═══════════ 道具 / 植被 (原样保留, 随机数改 wr 以支持种子) ═══════════
// ── 共享材质 (2026-09-26 性能批) ──
// 下面这几处旧版是**逐实例 new THREE.MeshLambertMaterial({color:…})** —— 棕榈果 ~1500 个 (塔拉瓦 386 株)、
// 竹杆 ~1000 根 (胡康)、雷区警示桩、弹坑土埂若干。全库无任何材质写点 (无 material.color/opacity 改动,
// 已 grep 核实), 故按颜色提到模块级共享**渲染结果逐像素相同**, 但省掉上千个材质对象,
// 并让渲染器的"连续同材质"判定生效 (同一材质的相邻 draw call 不再重复上传 uniforms/切状态)。
const MAT_PALM_NUT=new THREE.MeshLambertMaterial({color:0x6a5a34});
const MAT_BAMBOO=new THREE.MeshLambertMaterial({color:0x7a9448});
const MAT_MARK_RED=new THREE.MeshLambertMaterial({color:0xb83028});
const MAT_CRATER_RIM=new THREE.MeshLambertMaterial({color:0x5d5344});

// ═══════════ 庄稼软遮蔽 (诺曼底农田): 可穿行/子弹穿透/只遮 Bot 视线 (仿烟雾 smokeBlocksLOS) ═══════════
// CROP_FIELDS 条目: {x0,x1,z0,z1,h} —— 世界 AABB + 作物顶高(相对地面); 由 05c 摆作物时填充
const CROP_FIELDS=[];
function cropBlocksLOS(ax,ay,az,bx,by,bz){
for(const f of CROP_FIELDS){
const dx=bx-ax, dz=bz-az;
const L2=dx*dx+dz*dz;
if(L2<1e-6) continue;
// 视线线段与作物矩形的 XZ 平面相交, 求进入参数 t0
let t0=0, t1=1, ok=true;
for(const [p,d,lo,hi] of [[ax,dx,f.x0,f.x1],[az,dz,f.z0,f.z1]]){
if(Math.abs(d)<1e-9){
if(p<lo||p>hi){ ok=false; break; }
}else{
let ta=(lo-p)/d, tb=(hi-p)/d;
if(ta>tb){ const tmp=ta; ta=tb; tb=tmp; }
if(ta>t0) t0=ta;
if(tb<t1) t1=tb;
if(t0>t1){ ok=false; break; }
}
}
if(!ok) continue;
// 视线凡在田内任一点低于作物顶即被遮挡: 线段 y(t) 线性, 区间两端取 min 即可 (单点判定会漏斜射)
const px=ax+dx*((t0+t1)/2), pz=az+dz*((t0+t1)/2);
const topY=heightAt(px,pz)+f.h;
const yA=ay+(by-ay)*t0, yB=ay+(by-ay)*t1;
if(yA<topY||yB<topY) return true;
}
return false;
}
function sandbagWall(x,z,len,ry,h=1.0,reg=true){
// reg=false: 固定火力点的掩护墙随炮位整机登记, 不再单独占位 (避免同机两圈互斥)
if(reg){
if(!propFree(x,z,len*0.5+0.7)) return null;
propTake(x,z,len*0.5+0.7);
}
// 分段贴合坡面: 单段≈2.6m 各取当地坡度倾斜, 段间微搭 0.16 补缝, 长墙顺坡起伏
const segN=Math.max(1,Math.round(len/2.6)), seg=len/segN;
const cs=Math.cos(ry), sn=Math.sin(ry);
let m=null;
for(let i=0;i<segN;i++){
const c=-len/2+seg*(i+0.5);
const px=x+cs*c, pz=z-sn*c;
const fit=groundFit(px,pz,ry,seg/2+0.05,0.4);
m=solidBox(MAT.sandbag,seg+0.16,h,0.75,px,fit.y+h/2,pz,ry,null,true); // crush: 坦克可碾
applyFit(m,ry,fit);
}
coverPoints.push({x:x-Math.sin(ry)*1.4, z:z-Math.cos(ry)*1.4});
coverPoints.push({x:x+Math.sin(ry)*1.4, z:z+Math.cos(ry)*1.4});
return m;
}
function hedgehog(x,z){
if(!propFree(x,z,1.35)) return;
propTake(x,z,1.35);
const g0=heightAt(x,z);
for(let i=0;i<3;i++){
const b=mesh(boxGeo(0.22,2.4,0.22),MAT.metalDark,x,g0+0.75,z);
b.rotation.set(wr(-0.5,0.5)+ (i*1.1), 0, 0.7+i*0.5);
}
CYLS.push({x,z,r:0.85,y0:g0,y1:g0+1.5});
coverPoints.push({x:x+wr(-1,1),z:z+wr(-1,1)});
}
// 铁丝网 (工程兵建造): 无硬碰撞, 进入者减速+刮伤
const wireMat=new THREE.MeshLambertMaterial({color:0x3c3a34});
// 铁丝网注册表 (原在 06-engineering, 2026-09-05 前移: 布局构建期 defWorks 调 barbedWire 早于 06 加载)
const wires=[];
function barbedWire(x,z,ry=0,len=3.6,builder=null){
// 占位互斥: 桩端到墙外的整条带登记, 被占则放弃 (旧版不查互斥, 铁丝网会插进沙袋/医疗箱)
if(!propFree(x,z,len*0.5+0.5)) return null;
propTake(x,z,len*0.5+0.5);
// 整组随坡: 桩/铁丝弦沿坡面倾斜 (碰撞仍按 XZ 圆形判定, 见 wires 使用处)
const fit=groundFit(x,z,ry,len/2,0.25);
const grp=new THREE.Group();
grp.position.set(x,fit.y,z);
grp.rotation.order='YXZ';
grp.rotation.set(fit.pitch,ry,fit.roll);
world.add(grp);
for(const t of [-len/2,0,len/2]){
const st=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.045,1.15,5),MAT.woodDark);
st.position.set(t,0.55,0);
st.rotation.z=wr(-0.14,0.14); st.rotation.x=wr(-0.1,0.1);
st.castShadow=true;
grp.add(st);
}
for(const hy of [0.3,0.62,0.95]){
const wr2=new THREE.Mesh(new THREE.CylinderGeometry(0.014,0.014,len,4),wireMat);
wr2.rotation.z=HPI;
wr2.position.y=hy;
grp.add(wr2);
}
for(let i=0;i<4;i++){
const dg=new THREE.Mesh(new THREE.CylinderGeometry(0.011,0.011,0.95,3),wireMat);
dg.position.set(wr(-len/2+0.4,len/2-0.4),0.6,wr(-0.2,0.2));
dg.rotation.z=HPI+wr(-0.8,0.8);
dg.rotation.y=wr(-0.4,0.4);
grp.add(dg);
}
const w={x,z,r:Math.max(1.5,len*0.5),grp,builder,alive:true};
wires.push(w);
return w;
}
const treeTrunkGeo=new THREE.CylinderGeometry(0.22,0.34,4.4,7);
const treeLeafGeo=new THREE.PlaneGeometry(5,5);
// 树木实例批: tree() 只登记占位/碰撞并把变换收进 TREE_BATCH, buildWorld 末尾 flushTreeBatch()
// 把全图树合并为 树干/叶面 2 个 InstancedMesh —— 山地大图单图 2000+ 棵, 逐棵 mesh 会产生上万 draw call。
// 随机数消耗顺序与旧逐棵实现完全一致(每棵 10 次 wr), 保证各布局随机序列不漂移。
// 活树记录同步进 TREE_LIVE (04b-fire): 燃烧/倒伏按对象管理, 实例矩阵运行期改写。
let TREE_IM={trunks:null,leaves:null};
const TREE_BATCH=[];
function tree(x,z,s=1){
if(!propFree(x,z,0.9*s)) return;
propTake(x,z,0.9*s);
const g0=heightAt(x,z)-0.25*s; // 树干竖直, 根部下沉掩住坡地底缘
// 三片叶面 60° 均布(±小抖动): 旧实现各自随机 yaw, 两片常近乎平行重合
const yaw0=wr(0,Math.PI);
const lf=[];
for(let i=0;i<3;i++){
lf.push([yaw0+i*Math.PI/3+wr(-0.12,0.12), wr(-0.25,0.25), s*wr(0.8,1.15)]); // [yaw, 俯仰, 均匀缩放]
}
TREE_BATCH.push({x,z,s,g0,lf});
const cyl={x,z,r:0.35*s,y0:g0,y1:g0+4*s};
CYLS.push(cyl);
TREE_LIVE.push({kind:'tree',x,z,s,g0,lf,ti:TREE_BATCH.length-1,li:(TREE_BATCH.length-1)*3,cyl,alive:true,dead:false,burnT:-1,burnDur:0,dmg:0,fall:null,igniter:null,fT:0,iT:0,cx:x,cy:g0+3.6*s,cz:z,restCrown:null});
floraHashAdd(TREE_LIVE[TREE_LIVE.length-1]);
}
function flushTreeBatch(){
if(!TREE_BATCH.length) return;
const n=TREE_BATCH.length;
const trunks=new THREE.InstancedMesh(treeTrunkGeo,MAT.bark,n);
const leaves=new THREE.InstancedMesh(treeLeafGeo,MAT.leaves,n*3);
trunks.castShadow=true; trunks.receiveShadow=true;      // 与旧逐棵 mesh 的阴影设置一致
leaves.castShadow=false; leaves.receiveShadow=false;
trunks.frustumCulled=false; leaves.frustumCulled=false; // 实例批按整图包围盒剔除, 关闭以防树群消失
const _m=new THREE.Matrix4(), _p=new THREE.Vector3(), _qT=new THREE.Quaternion(), _qL=new THREE.Quaternion(), _e=new THREE.Euler(), _s=new THREE.Vector3();
TREE_BATCH.forEach((t,ti)=>{
_p.set(t.x,t.g0+2.2*t.s,t.z); _s.setScalar(t.s);
_m.compose(_p,_qT,_s); trunks.setMatrixAt(ti,_m);
t.lf.forEach(([ry,rx,ls],i)=>{
_p.set(t.x,t.g0+(3.4+i*0.6)*t.s,t.z);
_e.set(rx,ry,0); _qL.setFromEuler(_e); _s.setScalar(ls);
_m.compose(_p,_qL,_s); leaves.setMatrixAt(ti*3+i,_m);
});
});
world.add(trunks); world.add(leaves);
TREE_IM={trunks,leaves};
TREE_BATCH.length=0;
}
function deadTree(x,z){
if(!propFree(x,z,0.75)) return;
propTake(x,z,0.75);
const g0=heightAt(x,z)-0.25;
const t=mesh(new THREE.CylinderGeometry(0.14,0.3,3.6,6),MAT.woodDark,x,g0+1.8,z);
t.rotation.z=wr(-0.15,0.15);
const b1=mesh(new THREE.CylinderGeometry(0.05,0.1,1.6,5),MAT.woodDark,x+0.5,g0+3,z); b1.rotation.z=-0.9;
const cyl={x,z,r:0.3,y0:g0,y1:g0+3.4};
CYLS.push(cyl);
fuelAdd(x,z,0.9);
const rec={kind:'dead',x,z,g0,meshes:[t,b1],cyl,alive:true,dead:false};
floraHashAdd(rec);
}
// 垂柳 (淞沪水乡): 沿河/塘软遮蔽 —— 可穿行, 不挡弹, 轮廓一眼江南
// 空间账: 干高 2.8, 冠幅 ~3.5 下垂至 ~0.6m (站隐不全遮); 根部圆柱 r0.35
// 2026-09-12 实机修复: 旧版冠部=3 片平面绿盒悬空像飞毯; 改为多层小叶簇+自然垂条
function willowTree(x,z){
if(!propFree(x,z,1.4)||!freeSpot(x,z,1.0)) return;
propTake(x,z,1.4);
const g0=heightAt(x,z)-0.2;
// 主干 (微倾, 高 2.8)
const trunk=mesh(new THREE.CylinderGeometry(0.16,0.30,2.8,7),MAT.bark,x,g0+1.4,z);
trunk.rotation.z=wr(-0.06,0.06);
// 主枝: 3 根斜出 (从干顶分叉)
for(let i=0;i<3;i++){
const a=i*TAU/3+wr(-0.3,0.3);
const bx=x+Math.cos(a)*0.5, bz=z+Math.sin(a)*0.5;
const m=mesh(boxGeo(0.10,1.4,0.10),MAT.bark,bx,g0+3.2,bz,a);
m.rotation.order='YXZ'; m.rotation.z=wr(0.3,0.5);
}
// 冠部: 多层小叶簇 (非平面大盒, 而是 6~8 片小叶面交错)
for(let i=0;i<7;i++){
const a=wr(0,TAU), r=wr(0.3,1.2), h=wr(2.6,3.6);
const px=x+Math.cos(a)*r, pz=z+Math.sin(a)*r;
const m=mesh(boxGeo(wr(0.8,1.4),0.12,wr(0.6,1.1)),MAT.leaves||MAT.wood,px,g0+h,pz,wr(0,TAU),false,false);
m.rotation.order='YXZ'; m.rotation.x=wr(-0.3,0.3); m.rotation.z=wr(-0.2,0.2);
}
// 垂条: 10~14 条细长条自冠部下垂 (纯视觉, 不挡弹)
for(let i=0;i<12;i++){
const a=wr(0,TAU), r=wr(0.5,1.6);
const px=x+Math.cos(a)*r, pz=z+Math.sin(a)*r;
const topY=g0+wr(2.8,3.4);
const len=wr(1.6,2.4);
const m=mesh(boxGeo(0.06,len,0.06),MAT.leaves||MAT.wood,px,topY-len/2,pz,0,false,false);
m.rotation.order='YXZ';
m.rotation.z=wr(-0.15,0.15); m.rotation.x=wr(-0.1,0.1);
}
CYLS.push({x,z,r:0.35,y0:g0,y1:g0+2.8});
}
const craterGeo=new THREE.CircleGeometry(1,20);
const craterMat=new THREE.MeshLambertMaterial({color:0x4a4238,transparent:true,opacity:0.85,depthWrite:false,map:TEX.crater}); // 2026-09-06 B8/P3-12: 焦土径向贴图取代纯色
const runtimeCraters=[];
function crater(x,z,r,runtime=false){
if(!runtime){
if(!propFree(x,z,r*0.5+0.6)) return;
propTake(x,z,r*0.5+0.6);
}
const m=mesh(craterGeo,craterMat,x,heightAt(x,z)+0.03,z,0,false,true);
m.quaternion.setFromUnitVectors(_FWD,terrNormal(x,z)); m.scale.setScalar(r);
// 贴花登记 (2026-09-27 深度分层): 弹坑是**贴**在地形面上的图 —— 走 decal 档 (深度偏移 + renderOrder 同源)。
// 为什么必须登记: 地形网格局部起伏 ±2cm, 100m 处 1 LSB≈7.5mm ⇒ 弹坑与地形面的深度差只剩 1~3 LSB,
// 远景弹坑会随相机闪 (旧版这里的裸 renderOrder=1 只管透明件之间的顺序, 管不了深度测试)。
if(typeof surfaceLane==='function') surfaceLane(m,'decal'); else m.renderOrder=1;
if(runtime){
runtimeCraters.push(m);
if(runtimeCraters.length>36){ const old=runtimeCraters.shift(); world.remove(old); }
return;
}
const rim=mesh(new THREE.TorusGeometry(r*0.8,r*0.14,6,14),MAT_CRATER_RIM,x,heightAt(x,z)+0.05,z);
rim.quaternion.setFromUnitVectors(_FWD,terrNormal(x,z));
}
function crate(x,z,s=1,ry=0){
if(!propFree(x,z,1.05*s)) return;
propTake(x,z,1.05*s);
const fit=groundFit(x,z,ry,s/2,s/2);
const m=solidBox(MAT.wood,s,s,s,x,fit.y+s/2,z,ry,null,true); // crush: 坦克可碾
applyFit(m,ry,fit);
coverPoints.push({x:x+wr(-1.3,1.3),z:z+wr(-1.3,1.3)});
}
function barrel(x,z){
if(!propFree(x,z,0.85)) return;
propTake(x,z,0.85);
const g0=heightAt(x,z);
const m=mesh(new THREE.CylinderGeometry(0.42,0.42,1.1,10),MAT.metal,x,g0+0.55,z);
m.quaternion.setFromUnitVectors(_UP,terrNormal(x,z));
// 2026-09-27N (A3): 挂 mesh + explosive 标记 —— 爆炸/连锁引爆时连视觉一起摘掉并结算小爆。
// 旧版只登记几何 (x/z/y0/y1), 既无 crush 也无移除路径 ⇒ 挡子弹的油桶永远炸不掉、碾不掉。
CYLS.push({x,z,r:0.45,y0:g0,y1:g0+1.1,mesh:m,explosive:true});
}
function stoneWall(x1,z1,x2,z2,h=1.15){
const dx=x2-x1,dz=z2-z1;
const len=Math.hypot(dx,dz), ry=Math.atan2(dx,dz)+HPI;
const steps=Math.ceil(len/4);
for(let i=0;i<steps;i++){
const t0=(i+0.5)/steps;
const x=x1+dx*t0, z=z1+dz*t0;
if(!freeSpot(x,z,1.6)||!propFree(x,z,1.6)) continue; // freeSpot: 段避开建筑足迹(原只查道具互斥, 石墙会穿房)
propTake(x,z,1.6);
const fit=groundFit(x,z,ry,len/steps/2+0.05,0.3);
const m=solidBox(MAT.stone,Math.min(4.2,len/steps+0.16),h,0.55,x,fit.y+h/2,z,ry,null,true); // crush: 坦克可碾
applyFit(m,ry,fit);
}
coverPoints.push({x:(x1+x2)/2+dz/len*1.4,z:(z1+z2)/2-dx/len*1.4});
coverPoints.push({x:(x1+x2)/2-dz/len*1.4,z:(z1+z2)/2+dx/len*1.4});
}
// 2026-09-02 树篱实心方形材质: 原透明叶面贴图(有机团块感) → 方形修剪绿篱硬块 (用户指定"材质改为方形")
// 同日贴图优化: 平色 → TEX.hedge 修剪绿篱叶簇纹理 (02-scene), 保留方形体块
const hedgeMat=new THREE.MeshLambertMaterial({map:TEX.hedge});
function hedgerow(x1,z1,x2,z2){
const dx=x2-x1,dz=z2-z1;
const len=Math.hypot(dx,dz), ry=Math.atan2(dx,dz)+HPI;
const steps=Math.ceil(len/4);
for(let i=0;i<steps;i++){
const t0=(i+0.5)/steps;
const x=x1+dx*t0+wr(-0.4,0.4), z=z1+dz*t0+wr(-0.4,0.4);
// 互斥半径 1.7: 步距≈3.6m>3.4 —— 旧版 2.4 会使相邻段互相拒绝, 树篱变成断点墙
if(!freeSpot(x,z,2.4)||!propFree(x,z,1.7)) continue;
propTake(x,z,1.7);
const g0=heightAt(x,z);
const h=wr(2.2,3.0);
const fit=groundFit(x,z,ry,2.2,1.1);
const m=mesh(boxGeo(4.4,h,2.2),hedgeMat,x,fit.y+h/2,z,ry);
applyFit(m,ry,fit);
// 碰撞盒留存: 树篱段被烧尽/炸毁/坦克碾过时随视觉一并移除 (killBox / crushCoverBox)
const box=addBoxCollider(x,g0+h/2,z, Math.abs(Math.sin(ry))>0.5?2.2:4.4, h, Math.abs(Math.sin(ry))>0.5?4.4:2.2);
box.mesh=m; box.crush=true; // 2026-09-02 坦克直接碾过树篱
fuelAdd(x,z,1.1);
const rec={kind:'hedge',x,z,g0,meshes:[m],box,alive:true,dead:false};
box.flora=rec;
floraHashAdd(rec);
}
}
function rubblePile(x,z,r){
if(!propFree(x,z,r*0.9+0.5)) return;
propTake(x,z,r*0.9+0.5);
const g0=heightAt(x,z);
for(let i=0;i<6;i++){
const bx=x+wr(-r,r)*0.7, bz=z+wr(-r,r)*0.7;
const s=wr(0.5,1.4);
const m=mesh(boxGeo(s,s*0.7,s),wr(0,1)<0.5?MAT.rubble:MAT.brick,bx,g0+s*0.3,bz,wr(0,3));
m.rotation.x=wr(-0.3,0.3);
}
mesh(new THREE.SphereGeometry(r*0.8,10,6),MAT.rubble,x,g0-r*0.35,z);
CYLS.push({x,z,r:r*0.65,y0:g0,y1:g0+r*0.5});
coverPoints.push({x:x+r,z}); coverPoints.push({x:x-r,z});
}
// 倒木 (丛林): 圆柱长轴沿坡面走向贴合两端地面
function fallenLog(x,z,ry){
if(!propFree(x,z,2.3)) return;
propTake(x,z,2.3);
const g0=heightAt(x,z);
const dx=-Math.cos(ry), dz=Math.sin(ry); // 同下方碰撞盒的旧朝向约定 (长轴沿 (−cos,sin))
const h1=heightAt(x+dx*2.25,z+dz*2.25), h2=heightAt(x-dx*2.25,z-dz*2.25);
const lg=mesh(new THREE.CylinderGeometry(0.28,0.34,4.5,7),MAT.bark,x,(h1+h2)/2+0.32,z);
lg.quaternion.setFromUnitVectors(_UP,_N.set(dx,(h1-h2)/4.5,dz).normalize());
const bl=addBoxCollider(x,g0+0.3,z,Math.abs(Math.cos(ry))*4+0.6,0.6,Math.abs(Math.sin(ry))*4+0.6);
bl.mesh=lg; bl.crush=true; // 2026-09-02 坦克可碾过倒木
coverPoints.push({x:x+Math.sin(ry+HPI)*1.2,z:z+Math.cos(ry+HPI)*1.2});
}
// 战壕装饰: 沿沟沿沙包胸墙 + 弹药箱 + 掩体点
function decorateTrenches(){
for(const t of TRENCHES){
const len=Math.hypot(t.x2-t.x1,t.z2-t.z1);
if(len<1) continue;
const dx=(t.x2-t.x1)/len, dz=(t.z2-t.z1)/len;
const px=-dz, pz=dx;
const ry=Math.atan2(-dz,dx);
const n=Math.max(1,Math.floor(len/6));
for(let i=0;i<=n;i++){
const tt=i/n;
const cx=t.x1+(t.x2-t.x1)*tt, cz=t.z1+(t.z2-t.z1)*tt;
coverPoints.push({x:cx,z:cz});
if(i<n&&i%2===0&&freeSpot(cx+px*3.0+dx*3,cz+pz*3.0+dz*3,1.5)) sandbagWall(cx+px*3.0+dx*3,cz+pz*3.0+dz*3,4,ry);
if(i<n&&i%3===1&&freeSpot(cx-px*3.0+dx*3,cz-pz*3.0+dz*3,1.5)) sandbagWall(cx-px*3.0+dx*3,cz-pz*3.0+dz*3,4,ry);
}
if(freeSpot(t.x1-dx*2+px*1.2,t.z1-dz*2+pz*1.2,1)) crate(t.x1-dx*2+px*1.2,t.z1-dz*2+pz*1.2,1.1,ry);
if(freeSpot(t.x2+dx*2-px*1.2,t.z2+dz*2-pz*1.2,1)) barrel(t.x2+dx*2-px*1.2,t.z2+dz*2-pz*1.2);
}
}
// 植被: 竹丛/蕨类 (胡康河谷布局用, 原布局段移入) —— 均登记可燃 (烧尽后整丛消失)
function bambooClump(x,z){
if(!propFree(x,z,1.15)) return;
propTake(x,z,1.15);
const g0=heightAt(x,z)-0.2;
const n=wri(3,5);
// 竹=细长绿杆, 不挂树木那种大叶子贴图; 碰撞半径压到0.3(坦克压过≠隐形墙)
const meshes=[];
for(let i=0;i<n;i++){
const ox=wr(-0.5,0.5), oz=wr(-0.5,0.5);
const h=wr(4.5,7);
const c=mesh(new THREE.CylinderGeometry(0.03,0.045,h,5),MAT_BAMBOO,x+ox,g0+h/2,z+oz);
c.rotation.z=wr(-0.08,0.08);
meshes.push(c);
}
const cyl={x,z,r:0.3,y0:g0,y1:g0+5.5};
CYLS.push(cyl);
fuelAdd(x,z,1.0);
floraHashAdd({kind:'bamboo',x,z,g0,meshes,cyl,alive:true,dead:false});
}
function fernClump(x,z){
if(!propFree(x,z,0.55)) return;
propTake(x,z,0.55);
const g0=heightAt(x,z);
const yaw0=wr(0,Math.PI);
const meshes=[];
for(let i=0;i<4;i++){
const lf=mesh(treeLeafGeo,MAT.leaves,x+wr(-0.7,0.7),g0+wr(0.25,0.7),z+wr(-0.7,0.7),yaw0+i*Math.PI/4+wr(-0.15,0.15),false,false);
lf.rotation.x=wr(-0.5,-0.15);
lf.scale.setScalar(wr(0.3,0.5));
meshes.push(lf);
}
fuelAdd(x,z,0.5);
floraHashAdd({kind:'fern',x,z,g0,meshes,alive:true,dead:false});
}
// ═══════════ 城市组硬掩体 (2026-09-05 城市组·斯大林格勒/柏林) ═══════════
// 与诺曼底"软硬分层"对应的城市版: 钢/铁=不可碾不可燃的硬掩体, 木/沙袋照旧可碾可燃 ——
// 全部走 propFree/propTake 占位链 + coverPoints (Bot 当掩体用) + 实体碰撞 (挡人挡弹挡寻路)
// 钢轨街垒: 十字交叉钢轨+枕木底梁+顶横杆 —— 坦克不可碾 (无 crush 标记), 只可绕行或绕击,
// 街道路喉的经典障碍 (柏林街垒网/斯大林格勒街口共用)
function railBarricade(x,z,ry){
if(!propFree(x,z,1.7)||!freeSpot(x,z,1.7)) return; // freeSpot: 避开建筑足迹
propTake(x,z,1.7);
const fit=groundFit(x,z,ry,1.4,0.6);
const cs=Math.cos(ry), sn=Math.sin(ry);
// 枕木底梁 (半埋)
solidBox(MAT.woodDark,2.8,0.28,0.9,x,fit.y+0.10,z,ry);
// 两根钢轨在街垒立面内交叉成 X —— 2026-09-05 用户实机反馈: 旧版倾角 HPI*0.9 几乎平躺
// (像两根倒落的电线杆, 顶杆悬空)。现从竖直向两侧倾 0.66rad, 全高 2.3m, 下端扎进枕木。
for(const sgn of [-1,1]){
const r=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,2.9,6),MAT.metalDark);
r.position.set(x,fit.y+1.15,z);
r.rotation.order='YXZ';
r.rotation.y=ry;
r.rotation.z=sgn*0.66;
r.castShadow=true;
world.add(r);
}
// 交叉点横杆 (系在 X 腰部, 齐平相交)
const bar=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,2.3,6),MAT.metalDark);
bar.position.set(x,fit.y+1.15,z);
bar.rotation.z=HPI; bar.rotation.y=ry;
bar.castShadow=true;
world.add(bar);
// 碰撞: 实体盒 (坦克不可碾 —— 不挂 crush)
addBoxCollider(x,fit.y+1.05,z, Math.abs(sn)>0.5?1.1:2.6, 2.1, Math.abs(sn)>0.5?2.6:1.1);
coverPoints.push({x:x+cs*1.6,z:z-sn*1.6},{x:x-cs*1.6,z:z+sn*1.6});
}
// ══════════════════════════════════════════════════════════════════════
// 残骸造型工具箱 (2026-09-20 残骸三件重做: tankWreck / planeWreck / landingCraft 共用)
// 【为什么自带取数】05-world 的 wr()/wri() 走全局确定性流 _wstate, 而布局指纹 (dev/verify-layouts.js)
//   由该流推进到哪一步决定 —— 残骸里多抽一次随机数, 后面**所有**道具/植被/建筑的位置全漂。
//   故残骸的一切造型抖动一律走本工具箱的**本地哈希 PRNG** (由 x,z,ry,salt 派生, 不碰全局流):
//   同一坐标两次构建逐字节一致, 布局指纹零漂移 (dev/_wreck-selfcheck.js 逐图哈希核对)。
//   ★ 红线: 工具箱与三个残骸函数内不得出现 wr/wri/wRand —— 静态断言把关。
// 【为什么材质挂 uvRef】05-world.uvGeo 按 mat.uvRef (米/张贴图) 归一面 UV。残骸零件从 0.03m 的铰链销
//   到 10.4m 的艇体跨两个数量级, 不归一会让锈斑/水线在艇体上被拉成一整片纯色 (旧版"池沼"的成因之一)。
// ══════════════════════════════════════════════════════════════════════
function wkRand(x,z,ry,salt){
const ix=Math.round(x*64)|0, iz=Math.round(z*64)|0, iy=Math.round(ry*512)|0;
let s=(Math.imul(ix,73856093)^Math.imul(iz,19349663)^Math.imul(iy,83492791)^Math.imul(salt|0,2654435761))|0;
if(!s) s=0x9e3779b9;
const f=()=>{ s=(s+0x6D2B79F5)|0; let t=Math.imul(s^(s>>>15),1|s); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; };
f.r=(a,b)=>a+f()*(b-a);
f.i=(a,b)=>a+Math.floor(f()*(b-a+1));
f.pick=arr=>arr[Math.min(arr.length-1,Math.floor(f()*arr.length))];
f.chance=p=>f()<p;
return f;
}
// 残骸材质分件: 一件 = 一档材质 (色相 + 贴图 + uvRef); 同档跨车复用同一实例 (不逐车 new)
// 贴图未就位时退回 TEX.grime/metalBrush (白底) ⇒ 色相由 color 单独承担, 不引入任何外部资源。
const WK_MAT={};
function wkMat(role,tint,tex,uvRef){
const k=role+'|'+tint+'|'+uvRef;
let m=WK_MAT[k];
if(m) return m;
m=new THREE.MeshLambertMaterial({color:tint, map:tex||TEX.grime});
m.uvRef=uvRef;
WK_MAT[k]=m;
return m;
}
// 一台残骸的材质盘 —— col/colT/colA 取自 00-config 载具定义: 涂装分档在残骸上就体现为"没烧透的那一块"
function wkPaint(col,colT,colA){
const c0=col!==undefined?col:0x4a5240;
return {
burnt:wkMat('burnt',0x2b2823,TEX.scorch,1.7),      // 烧黑钢 (0x1e1c18 系提亮: 纯黑在 Lambert 下丢剪影)
rust: wkMat('rust', 0x7d5535,TEX.rust,1.2),        // 锈蚀
steel:wkMat('steel',0x767770,TEX.metalBrush,0.8),  // 裸钢机件 (轮/轴/铰链)
alu:  wkMat('alu',  0xa9adb2,TEX.metalBrush,0.8),  // 裸铝 (飞机未烧透的蒙皮)
soil: wkMat('soil', 0x211a13,TEX.grime,2.6),       // 焦土
paint:wkMat('paint',c0,TEX.paintPeel,1.1),         // 残留原涂装 (最有信息量的一件)
paintT:wkMat('paintT',colT!==undefined?colT:c0,TEX.paintPeel,1.1),
camo: colA!==undefined?wkMat('camo',colA,TEX.paintPeel,1.1):null,
wood: wkMat('wood',0x6a583c,TEX.deckWood,1.1),     // 艇甲板木
bleach:wkMat('bleach',0xa2a6a2,TEX.waterline,1.4), // 水线以上: 晒褪色
wl:   wkMat('wl',   0x7a4a2a,TEX.waterline,1.0),   // 水线锈带
barn: wkMat('barn', 0x475439,TEX.barnacle,1.0),    // 水线以下: 藤壶藻绿
};
}
// 零件: 建网格 + 挂 wkPart 标签 (自检探针按件统计) + uvGeo 归一面 UV
// ★ 为什么直挂属性而不是 userData.wkPart: 本仓 30+ 个 dev 沙箱桩里多数 Obj3 没有 userData
//   (只有 dev/verify-layouts.js 补过一行), 直挂属性对任何桩都安全, 不把残骸的正确性押在别人的桩上。
function wkPart(grp,geo,mat,x,y,z,rx,ry,rz,tag){
const m=new THREE.Mesh(uvGeo(geo,mat),mat);
m.position.set(x,y,z);
if(rx||ry||rz) m.rotation.set(rx||0,ry||0,rz||0);
m.wkPart=tag;
grp.add(m);
return m;
}
// 残骸"硬掩体包络": tankWreck 实体盒 5.6×3.0 (半 2.8/1.5)。立体件一律落在包络内;
// 包络外只许放**半埋地面的扁平碎件** (顶面 ≤0.28m) —— 地面碎件本来就可踏过, 与硬掩体口径不冲突。
const WK_IN_X=1.44, WK_IN_Z=2.74, WK_FLAT=0.28;
// 当前战役主力车型池: 攻方轻/重两型; 两栖登陆战役 (有 SEA) 再并入守方轻坦 ——
// 史实: 塔拉瓦滩头同时躺着美军谢尔曼与日军九七式, 同图多台残骸因此型别各异 (由本地哈希择型, 位置确定)。
function wkTankPool(){
const A=TEAM_FACTION[0], B=TEAM_FACTION[1];
const pool=[A.tanks[0],A.tanks[1]];
if(typeof SEA!=='undefined'&&SEA&&B&&B.tanks&&B.tanks[0]) pool.push(B.tanks[0]);
return pool;
}
// 第 4 参归一化 (两种传法都收): ① 完整载具定义 FACTIONS[f].tanks[i] (.tk/.hullL/.barrelL/.col/.colT)
//   ② 裸 tk 规格 (.shape/.hullW/...) —— 后者按当前战役主力车型补齐整车长/炮管长/涂装 (尺寸仍单源)。
function wkTankDef(o){
const base=wkTankPool()[0];
if(!o) return base;
if(o.tk||o.hullL!==undefined){
const tk=o.tk||o;
return {tk, hullL:o.hullL!==undefined?o.hullL:base.hullL, barrelL:o.barrelL!==undefined?o.barrelL:base.barrelL,
 col:o.col!==undefined?o.col:base.col, colT:o.colT!==undefined?o.colT:base.colT, name:o.name||''};
}
return {tk:o, hullL:base.hullL, barrelL:base.barrelL, col:base.col, colT:base.colT, name:''};
}
// 烧毁坦克残骸 (全图最大的单件硬掩体, 不可碾不可毁): 2026-09-20 残骸重做 ——
//   按 00-config 的 tk 剪影规格出**按国家/车型各异**的残骸 (炮塔档/车体轮廓/负重轮数/侧裙/涂装分档全部同源);
//   构造: 履带断裂散落 / 负重轮脱落滚离 / 发动机舱盖掀开 / 炮塔座圈错位或整塔翻倒在侧 / 舱门敞开 / 炮管弯折垂落;
//   材质分件: 烧黑钢 + 锈蚀 + **剥落漆露出原涂装一角** + 焦土 (见 wkPaint)。
// 【空间账 (与改造前同一套口径)】车体实体盒 5.6×1.9×3.0 (ry 交换) + coverPoints 两点 —— 逐字不动;
//   视觉件全部落在该盒的 XZ 投影内 (立体件) 或为包络外的半埋扁平碎件 (顶面≤0.28m)。
// 【取数红线】只保留既有那 1 次 wr(-0.5,0.5) (炮塔随机转角); 其余抖动全走 wkRand (本地哈希)。
function tankWreck(x,z,ry,tkIn){
if(!propFree(x,z,3.4)||!freeSpot(x,z,3.3)) return; // freeSpot: 避开建筑足迹
propTake(x,z,3.4);
const fit=groundFit(x,z,ry,3.2,1.8);
const grp=new THREE.Group();
grp.position.set(x,fit.y,z);
grp.rotation.order='YXZ';
grp.rotation.set(fit.pitch,ry,fit.roll);
grp.wkRole='tank';   // 角色标记 (直挂属性: 自检/性能账逐图统计残骸网格数; 不依赖任何桩的 userData)
world.add(grp);
const R=wkRand(x,z,ry,0x51a7);
const D=tkIn?wkTankDef(tkIn):wkTankDef(R.pick(wkTankPool()));
const T=D.tk, M=wkPaint(D.col,D.colT,T.colA);
const camo=(T.paint==='camo')&&M.camo;         // 涂装分档 camo: 额外迷彩残条
// ── 尺寸账 (全部由 tk 派生, 不做整体缩放 —— 免得"大车配小炮塔"的剪影错位) ──
const L=Math.min((D.hullL||5.8)*0.90,5.2);                       // 车体长 (实体盒半长 2.8)
const HW=clamp((T.hullW!==undefined?T.hullW:2.5)*0.90,1.86,2.55); // 车体宽 (实体盒半宽 1.5)
const HH=T.hullH!==undefined?T.hullH:0.95;
const gl=T.glacis!==undefined?T.glacis:-0.5;
const whR=T.whR!==undefined?T.whR:0.36;
const barR=T.barR!==undefined?T.barR:0.12;
const HB=0.16, CY=HB+HH/2, roof=HB+HH;         // 悬挂烧塌 ⇒ 车体坐沉 (车底离地 0.16)
const rotSgn=R.chance(0.5)?1:-1;               // 本件"哪一侧被炸开"
// ── ① 车体: 主装甲盒 + 首上倾斜板 + 尾板 (+ 铸造侧凸) ──
wkPart(grp,boxGeo(HW,HH,L),M.burnt,0,CY,0,0,0,0,'hull');
if(Math.abs(gl)>0.02){ // 首上: 按 tk.glacis 自前下棱向后上铺板 (T-34 大倾角/四号近垂直/九七小倾角 = 第一眼车型)
// 板心按"投影长的一半"后移 ⇒ 前缘恒贴车体鼻端, 倾角越小越平 (近垂直档不会探出碰撞盒)
const ga=Math.abs(gl), gd=HH*1.35, ca=Math.cos(ga), sa=Math.sin(ga);
wkPart(grp,boxGeo(HW*0.98,0.15,gd),M.burnt,0,CY-HH/2+gd*sa/2+0.03,L/2-gd*ca/2-0.04,gl,0,0,'glacis');
}
wkPart(grp,boxGeo(HW*0.98,HH*0.45,0.5),M.rust,0,CY+HH*0.10,-L/2+0.16,-0.45,0,0,'rearPlate');
if((T.sponson||0)>0) // 谢尔曼/潘兴: 铸造侧凸宽肩 —— 残骸上也读得出"宽肩车体"
wkPart(grp,boxGeo(HW+T.sponson*2,HH*0.38,L*0.60),M.rust,0,CY+HH*0.22,-L*0.05,0,0,0,'sponson');
// ── ② 发动机舱: 格栅外露 + 舱盖掀开折起 (烧毁坦克最好认的一处) ──
{
const ehL=L*0.30, ez=-L/2+0.30+ehL/2;
wkPart(grp,boxGeo(HW*0.84,0.05,ehL),M.steel,0,roof+0.02,ez,0,0,0,'engineGrille');
for(let i=0;i<3;i++) wkPart(grp,boxGeo(HW*0.66,0.05,0.09),M.steel,0,roof+0.06,ez-ehL*0.30+i*ehL*0.30,0,0,0,'grilleBar');
const hp=ehL*0.80, ha=1.02+R.r(-0.10,0.10);          // 盖板绕舱口前缘向前上方折起 (整个落在车体长度内)
const hz=ez+ehL/2, hcz=hz-hp/2*Math.cos(ha), hcy=roof+hp/2*Math.sin(ha);
wkPart(grp,boxGeo(HW*0.86,0.09,hp),M.rust,0,hcy,hcz,ha,0,0,'engineHatch');
}
// ── ③ 行走机构: 残存履带贴车侧 + 断裂履带散落 + 负重轮脱落滚离 ──
for(const sx of [-1,1]){
// 轮系外沿必须留在碰撞盒 (±1.5) 内: 轮心 1.16 + 半宽·cos + 半径·sin ≈ 1.37
const wx=sx*Math.min(HW/2+0.06,WK_IN_X-0.28);
wkPart(grp,boxGeo(0.30,0.26,L*0.30),M.rust,wx,HB+0.13,-L*0.16,0,0,0,'trackHull');     // 残存履带段
wkPart(grp,boxGeo(0.30,0.22,L*0.18),M.rust,wx,HB+0.10,L*0.30,0,0,R.r(-0.10,0.10),'trackHull');
wkPart(grp,new THREE.CylinderGeometry(whR*0.85,whR*0.85,0.26,10),M.steel,wx,whR*0.86,L/2-0.30,0,0,HPI,'sprocket'); // 主动轮
wkPart(grp,new THREE.CylinderGeometry(whR*0.75,whR*0.75,0.24,10),M.steel,wx,whR*0.80,-L/2+0.34,0,0,HPI,'idler');   // 诱导轮
for(let i=0;i<2;i++) // 残存负重轮 (卡在轮位、歪斜)
wkPart(grp,new THREE.CylinderGeometry(whR,whR,0.30,12),M.steel,wx-R.r(0,0.05),whR*0.88+R.r(-0.05,0.05),
 -L*0.24+i*L*0.36,0,0,HPI+R.r(-0.16,0.16),'wheelFixed');
}
for(let i=0;i<2;i++) // 脱落滚离的负重轮: 平躺半埋 (轴向竖直 ⇒ 顶面只有轮胎厚度 = 扁平碎件)
wkPart(grp,new THREE.CylinderGeometry(whR,whR,0.26,12),M.rust,
 clamp(rotSgn*R.r(1.10,1.75),-2.3,2.3),0.10,clamp(R.r(-2.1,1.7),-2.5,2.5),0,R.r(0,TAU),0,'wheelThrown');
const nTrk=2+(R.chance(0.5)?1:0);
for(let i=0;i<nTrk;i++) // 断裂履带散落地面的段 (半埋: 顶面 0.13)
wkPart(grp,boxGeo(0.34,0.13,R.r(1.1,2.0)),M.rust,
 clamp((R.chance(0.5)?1:-1)*R.r(1.05,1.55),-2.3,2.3),0.065,clamp(R.r(-2.3,2.3),-2.5,2.5),0,R.r(-0.7,0.7),0,'trackGround');
if((T.skirt||0)>0){ // 四号/黑豹: 侧裙板 (Schürzen) —— 2~3 片歪挂 + 1 片落地
const n=Math.min(3,T.skirt|0);
for(let i=0;i<n;i++){
const sx=(i%2)?1:-1, sk=Math.min(HW/2+0.15,WK_IN_X-0.08);
wkPart(grp,boxGeo(0.05,HH*0.70,L*0.22),M.rust,sx*sk,HB+HH*0.52,R.r(-L*0.32,L*0.30),0,0,sx*R.r(0.18,0.42),'skirt');
}
wkPart(grp,boxGeo(L*0.24,0.05,HH*0.70),M.rust,clamp(rotSgn*R.r(1.2,1.7),-2.3,2.3),0.06,R.r(-1.8,1.8),0,R.r(0,TAU),0,'skirtFallen');
}
// ── ④ 炮塔: 按 tk.tur.shape 走六档 (与 15-vehicles 剪影工厂同一套离散档, 残骸上仍认得出车型) ──
const TU=T.tur||{};
const tS=TU.shape||'round', tW=TU.w!==undefined?TU.w:2.2, tL=TU.l!==undefined?TU.l:2.4, tH=TU.h!==undefined?TU.h:0.72;
const cupH=Math.max(T.cupH!==undefined?T.cupH:0.22,0.14);   // 指挥塔高 (日系小塔/德系大塔的剪影差就在这一件)
const tYaw=wr(-0.5,0.5);                              // ★ 既有那 1 次全局取数 (炮塔随机转角) —— 原样保留
// 转角按碰撞盒宽度反算预算后使用: 炮塔 2.4~2.9m 长, 转 θ 后 X 半宽 =(tW/2)cosθ+(tL/2)sinθ ⇒ θ 必须 ≤0.18
// (旧建模硬用 ±0.5 ⇒ 半宽 1.56 > 盒半宽 1.5, 炮塔角伸出盒外 6cm —— 玩家贴脸能从塔角穿过去)
const tOrn=R.chance(0.42);                            // 整塔翻倒变体 (本地哈希: 同一坐标恒定)
const tYawW=tYaw*(tOrn?0.18:0.36);                    // 倒扣档再收紧 (翻倒后 tL 更易甩到 X 向)
const tOff=R.r(0.10,0.24)*(R.chance(0.5)?1:-1);       // 座圈错位
const ringY=roof+0.05;                                // 座圈 = 车体顶面 +0.05 (与 15-vehicles 的 ringY 同源)
const tg=new THREE.Group(); grp.add(tg);
const R0=tL/2;
{
// 塔体 (六档)
if(tS==='round'||tS==='smallRound'){
wkPart(tg,new THREE.CylinderGeometry(R0*0.86,R0,tH*0.88,14),M.paintT,0,tH*0.44,0,0,0,0,'turret');
wkPart(tg,new THREE.CylinderGeometry(R0*0.60,R0*0.86,tH*0.14,14),M.paintT,0,tH*0.93,0,0,0,0,'turretCap');
if(tS==='smallRound') wkPart(tg,boxGeo(tW*0.86,tH*0.46,tL*0.22),M.paintT,0,tH*0.30,-R0*0.92,0,0,0,'turretBustle');
}else if(tS==='hex'||tS==='hexLong'){
wkPart(tg,new THREE.CylinderGeometry(R0*0.86,R0,tH,6),M.paintT,0,tH/2,0,0,Math.PI/6,0,'turret');
if(tS==='hexLong') wkPart(tg,boxGeo(tW*0.72,tH*0.42,0.36),M.paintT,0,tH*0.30,-R0-0.14,0,0,0,'turretBustle');
}else{ // box (四号/黑豹) 与 vickers (维克斯/T-26) 都由直壁箱体派生, 靠尺寸档区分
wkPart(tg,boxGeo(tW,tH,tL),M.paintT,0,tH/2,0,0,0,0,'turret');
wkPart(tg,boxGeo(tW*0.96,tH*0.55,0.40),M.paintT,0,tH*0.42,tL/2-0.05,-0.30,0,0,'turretFront');
wkPart(tg,boxGeo(tW*0.90,tH*0.44,0.34),M.paintT,0,tH*0.30,-tL/2-0.12,0,0,0,'turretBustle');
}
// 指挥塔 (cupH 档)
const cupR=Math.max(0.20,Math.min(0.34,cupH*1.3));
wkPart(tg,new THREE.CylinderGeometry(cupR,cupR,cupH,10),M.paintT,tW*0.22,tH+cupH*0.5-0.02,-tL*0.24,0,0,0,'cupola');
// 炮盾 (谢尔曼/潘兴走铸造圆盾, 其余走方盾 —— 与剪影工厂同判据)
const mh=Math.max(0.46,tH*0.78);
if(tS==='round'&&T.shape==='sherman') wkPart(tg,new THREE.CylinderGeometry(mh*0.5,mh*0.5,0.44,12),M.steel,0,tH*0.52,tL/2+0.12,HPI,0,0,'mantlet');
else wkPart(tg,boxGeo(Math.max(0.62,tW*0.40),mh,0.44),M.paintT,0,tH*0.52,tL/2+0.12,0,0,0,'mantlet');
// 塔侧剥落漆: 炮塔走 paintT 第二色 ⇒ 露出的漆皮是本车原色 col (涂装分档在残骸上的读法)
wkPart(tg,boxGeo(0.03,tH*0.46,Math.max(0.30,tL*0.34)),M.paint,-(tW/2+0.015),tH*0.52,-tL*0.16,0,0,0,'paintChipTurret');
}
// 炮管: 分段折弯垂落 (根部仍在炮盾上, 前段探出后即低头扎进沙里) —— "弯折垂落"
// ★ 俯角预算怎么来的: 炮管挂在 tg (座圈高 ringY≈1.2m) 上, 起点世界高 ≈1.6m; 硬掩体盒半长只有 2.8m,
//   炮塔前沿已在 z≈1.5 ⇒ 炮管**全部**水平行程只有 ≈1.2m, 而管长 3.3~4.3m ⇒ 平均俯角必须 ≈55°。
//   角度取小了就是旧建模那样"炮管平伸到盒外 0.5m / 高 1.13m"——玩家从炮管中段穿过去 (实测旧 tip z=3.24)。
//   长管用 4 段 (T-34 3.4 / 黑豹 4.3 / 潘兴 4.1) 摊平落差, 短管 3 段。
const bLen=D.barrelL!==undefined?D.barrelL:3.2, nSeg=bLen>3.8?4:3, segL=bLen/nSeg;
let bp=[0,tH*0.52,tL/2+0.34], ba=R.r(0.55,0.65);
if(tOrn){ // 整塔翻倒: 炮管在座圈处折断, 塔上只留一截弯管头
wkPart(tg,new THREE.CylinderGeometry(barR*1.05,barR,0.62,8),M.burnt,0,tH*0.52,tL/2+0.45,HPI+0.55,0,0,'barrelStump');
}else{
for(let i=0;i<nSeg;i++){
if(bp[1]+ringY<0.05) break;  // 已触地/入土: 后面的段不再建 (埋在地下的圆柱看不见, 只白烧 draw call 且撑大包围盒)
ba+=(i?(i===1?R.r(0.75,0.95):R.r(0.25,0.40)):0);   // 第 2 段起急剧折下 (弯折点), 之后沿垂向插进沙里
const dir=[0,-Math.sin(ba),Math.cos(ba)], r0=barR*(1-i*0.07);
wkPart(tg,new THREE.CylinderGeometry(r0,r0*0.94,segL,8),M.burnt,
 bp[0]+dir[0]*segL/2,bp[1]+dir[1]*segL/2,bp[2]+dir[2]*segL/2,HPI+ba,0,0,'barrel'+(i+1));
bp=[bp[0]+dir[0]*segL,bp[1]+dir[1]*segL,bp[2]+dir[2]*segL];
}
if(T.brake&&bp[1]+ringY>-0.05) wkPart(tg,new THREE.CylinderGeometry(barR*1.45,barR*1.45,0.42,8),M.burnt,bp[0],bp[1],bp[2],HPI+ba,0,0,'muzzleBrake');
wkPart(tg,new THREE.CylinderGeometry(0.045,0.05,0.9,6),M.steel,Math.min(0.42,tW*0.24),tH*0.42,tL/2+0.42,HPI,0,0,'coax');
}
// 塔的落位: 座圈错位 (常规) 或 **整塔翻倒** (绕 X 翻 180° 倒扣在车体后段甲板上, 再向一侧翻倒压进车体)。
// ★ 为什么不能"整塔落在车旁沙地上": 硬掩体实体盒只有 3.0m 宽 × 5.6m 长 (半 1.5/2.8),
//   一台 2.4~2.9m 宽的炮塔横躺在车旁必然伸出盒外 ⇒ 玩家会从炮塔里穿过去。
//   规则②要求碰撞口径逐字不变, 故"翻倒"必须在盒内落地 —— 倒扣在甲板上 + 侧滚压进车体是唯一的自洽解。
if(!tOrn){
tg.position.set(tOff,ringY,(TU.ringZ!==undefined?TU.ringZ:0)+R.r(-0.18,0.18));
tg.rotation.set(R.r(-0.05,0.05),tYawW,R.r(-0.09,0.09));
}else{
const roll=rotSgn*R.r(0.18,0.30);   // 侧滚上限 0.30rad: 再大塔角就伸出 1.5m 半宽 (见上)
tg.position.set(clamp(tOff*0.5,-0.10,0.10),roof+(tH+cupH)*0.96,clamp(-L*0.16,-0.95,-0.5));
tg.rotation.set(Math.PI+R.r(-0.12,0.12),tYawW,roll);
// 折断的主炮管落在车侧沙地上 (半埋: 圆柱躺倒, 顶面 = 2×barR ≈ 0.24 ≤ 0.28)
wkPart(grp,new THREE.CylinderGeometry(barR,barR*0.92,bLen*0.62,8),M.burnt,
 clamp(rotSgn*R.r(0.95,1.25),-WK_IN_X+0.3,WK_IN_X-0.3),barR+0.02,
 clamp(R.r(-2.0,0.3),-2.4,2.4),HPI,0,R.r(-0.45,0.45),'barrelFallen');
}
// ── ⑤ 舱门: 掀开 2 处 (驾驶员/车长) + 掀掉落地 1 片 ──
{
const dh=Math.min(0.55,HW*0.30), hp2=dh*1.5;
wkPart(grp,boxGeo(dh,0.07,hp2),M.rust,-HW*0.28,roof+0.03+hp2/2*Math.sin(1.15),L*0.30,1.15+R.r(-0.15,0.15),0,0,'hatchOpen');
wkPart(grp,boxGeo(dh,0.07,hp2),M.rust,HW*0.30,roof+0.03+hp2/2*Math.sin(0.55),L*0.18,0.55+R.r(-0.15,0.15),0,R.r(-0.2,0.2),'hatchAjar');
wkPart(grp,boxGeo(dh*1.2,0.06,dh*1.7),M.burnt,clamp(rotSgn*R.r(1.25,1.85),-2.2,2.2),0.055,
 clamp(R.r(-2.2,2.0),-2.5,2.5),0,R.r(0,TAU),0,'hatchLost');
}
// ── ⑥ 剥落漆: 没烧透的那几块露出原涂装 (残骸上"这是哪一国的车"的唯一线索) ──
for(let i=0;i<3;i++){
const sx=(i%2)?1:-1;
wkPart(grp,boxGeo(0.03,HH*R.r(0.30,0.52),L*R.r(0.12,0.22)),M.paint,sx*(HW/2+0.015),CY+R.r(-0.10,0.18),
 R.r(-L*0.34,L*0.28),0,0,0,'paintChip');
}
if(camo) for(let i=0;i<2;i++)
wkPart(grp,boxGeo(0.03,HH*0.30,L*0.10),M.camo,(i?1:-1)*(HW/2+0.015),CY+HH*0.12,R.r(-L*0.3,L*0.2),0,0,0,'camoChip');
// ── ⑦ 焦土: 爆燃后的灰堆 (低矮土丘, 埋在车体四周地面上; 纯视觉, 与既有弹坑/沙痕同口径: 不设碰撞) ──
for(let i=0;i<3;i++){
const a=R.r(0,TAU);
wkPart(grp,boxGeo(R.r(0.55,0.95),0.16,R.r(0.55,0.95)),M.soil,
 clamp(Math.cos(a)*R.r(1.2,1.9),-2.4,2.4),0.02,clamp(Math.sin(a)*R.r(1.4,2.3),-2.6,2.6),0,R.r(0,TAU),0,'ashMound');
}
grp.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
// 碰撞: 车体实体盒 (无 crush/无 dGroup —— 永久掩体, 子弹/视线/寻路一致)
addBoxCollider(x,fit.y+0.95,z, Math.abs(Math.sin(ry))>0.5?5.6:3.0, 1.9, Math.abs(Math.sin(ry))>0.5?3.0:5.6);
coverPoints.push({x:x+Math.cos(ry)*2.4,z:z-Math.sin(ry)*2.4},{x:x-Math.cos(ry)*2.4,z:z+Math.sin(ry)*2.4});
}
// 钢坯垛 (红十月厂房内): 两层钢锭 —— 坦克碾不动的推进节奏掩体
function ingotStack(x,z,ry){
if(!propFree(x,z,1.3)) return;
propTake(x,z,1.3);
const fit=groundFit(x,z,ry,1.2,0.6);
solidBox(MAT.metalDark,1.5,0.85,0.95,x,fit.y+0.425,z,ry);
const cs=Math.cos(ry),sn=Math.sin(ry);
mesh(boxGeo(0.42,0.4,1.5),MAT.metalDark,x+sn*0.34,fit.y+1.05,z+cs*0.34,ry+wr(-0.1,0.1));
coverPoints.push({x:x+cs*1.5,z:z-sn*1.5},{x:x-cs*1.5,z:z+sn*1.5});
}
// 机器底座 (厂房/锅炉房): 砖基座+卧式锅炉+烟管 —— 硬掩体 (2026-09-05 可读性重做:
// 旧版=深色方箱+细管, 与其他杂物无法区分)
function machineBlock(x,z,ry){
if(!propFree(x,z,1.8)) return;
propTake(x,z,1.8);
const fit=groundFit(x,z,ry,1.4,1.4);
const cs=Math.cos(ry), sn=Math.sin(ry);
// 砖基座 (自带碰撞)
solidBox(MAT.brick,2.3,0.85,1.6,x,fit.y+0.425,z,ry); // 基座深 1.9→1.6 (2026-09-06 P2-18: 原嵌入厂房纵墙内面 0.15m)
// 卧式锅炉 (视觉圆柱 + 实体碰撞盒)
const b=new THREE.Mesh(new THREE.CylinderGeometry(0.82,0.82,2.1,9),MAT.metal);
b.rotation.order='YXZ';
b.rotation.y=ry; b.rotation.z=HPI;
b.position.set(x,fit.y+1.62,z);
b.castShadow=true;
world.add(b);
addBoxCollider(x,fit.y+1.55,z,Math.abs(sn)>0.5?1.8:2.2,1.6,Math.abs(sn)>0.5?2.2:1.8);
// 烟管 + 阀杆
mesh(new THREE.CylinderGeometry(0.15,0.15,1.7,7),MAT.metalDark,x+sn*0.5,fit.y+2.9,z+cs*0.5);
mesh(boxGeo(0.3,0.5,0.3),MAT.metalDark,x-sn*0.7,fit.y+2.35,z-cs*0.7,ry);
coverPoints.push({x:x+wr(-2,2),z:z+wr(-2,2)});
}
// 电车轨道 (斯大林格勒主街): 双轨+枕木+架空线 —— 轨面贴地不设碰撞 (0.1m 可碾过),
// 线杆细柱有碰撞; 全部沿 avenue 轴向铺设
function tramRails(x0,x1,z){
for(let x=x0;x<x1-2;x+=4){
const xm=x+2, g0=heightAt(xm,z);
mesh(boxGeo(4,0.1,0.12),MAT.metalDark,xm,g0+0.05,z-0.75,0,false,true);
mesh(boxGeo(4,0.1,0.12),MAT.metalDark,xm,g0+0.05,z+0.75,0,false,true);
mesh(boxGeo(4,0.14,0.5),MAT.woodDark,xm,g0+0.02,z,0,false,true);
}
// 架空线: 线杆立轨道一侧, 横臂自杆位横跨到轨道正上方, 接触线沿街串起各横臂
// (2026-09-05 修"浮空长条": 旧横臂 boxGeo(2.4,0.09,0.09) 长边顺轨道, 悬在轨心上方
//  与侧面 2.6m 的线杆互不接触, 看似无意义浮空条)
let prevArm=null; // 上一根横臂的挂线点 {x,g}
for(let x=x0+12;x<x1-6;x+=30){
const pz=z+2.6, g0=heightAt(x,pz);
mesh(new THREE.CylinderGeometry(0.09,0.12,6.2,6),MAT.metalDark,x,g0+3.1,pz);
mesh(boxGeo(0.09,0.09,3.3),MAT.metalDark,x,g0+5.9,z+0.95,0,false,true); // 横臂: z+2.6(杆)→z-0.7(过轨)
CYLS.push({x,z:pz,r:0.13,y0:g0,y1:g0+6.2});
if(prevArm){
const segL=x-prevArm.x;
mesh(boxGeo(segL,0.05,0.05),MAT.metalDark,(x+prevArm.x)/2,(g0+prevArm.g)/2+5.82,z,0,false,true);
}
prevArm={x,g:g0};
}
}
// ═══════════ 柏林街道家具 (2026-09-09 加密批次: 用户实机反馈"城内太过于空荡") ═══════════
// 烧毁轿车残骸: 车体+车厢+四轮 —— 可碾轻掩体 (crush), 城市街道的密度骨架
function carWreck(x,z,ry){
if(!propFree(x,z,2.2)||!freeSpot(x,z,2.1)) return; // freeSpot: 避开建筑足迹/地铁下沉区
propTake(x,z,2.2);
const fit=groundFit(x,z,ry,1.9,1.0);
const dark=new THREE.MeshLambertMaterial({color:0x3a3229,map:TEX.grime});
const grp=new THREE.Group();
grp.position.set(x,fit.y,z);
grp.rotation.order='YXZ';
grp.rotation.set(fit.pitch,ry,fit.roll);
world.add(grp);
const body=new THREE.Mesh(boxGeo(1.75,0.72,4.2),dark); body.position.y=0.62; grp.add(body);
const cab=new THREE.Mesh(boxGeo(1.6,0.62,1.9),dark); cab.position.set(0,1.24,-0.25); grp.add(cab);
for(const [wx,wz] of [[-0.82,1.35],[0.82,1.35],[-0.82,-1.35],[0.82,-1.35]]){
const wh=new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.34,0.22,8),MAT.metalDark);
wh.position.set(wx,0.34,wz); wh.rotation.z=HPI; grp.add(wh);
}
grp.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
const bb=addBoxCollider(x,fit.y+0.62,z, Math.abs(Math.sin(ry))>0.5?4.2:1.75, 1.24, Math.abs(Math.sin(ry))>0.5?1.75:4.2);
bb.crush=true; // 坦克可碾 (轻掩体: 挡人挡弹, 不挡坦克)
coverPoints.push({x:x+Math.cos(ry)*1.5,z:z-Math.sin(ry)*1.5},{x:x-Math.cos(ry)*1.5,z:z+Math.sin(ry)*1.5});
}
// 街灯 (柏林街灯): 铸铁杆+弯臂+灯罩 —— 细高件, 坦克可碾平 (crush); ry 决定灯臂朝向
function lampPost(x,z,ry=0){
if(!propFree(x,z,0.9)||!freeSpot(x,z,0.8)) return;
propTake(x,z,0.9);
const g0=heightAt(x,z), h=5.0;
const cs=Math.cos(ry), sn=Math.sin(ry);
mesh(new THREE.CylinderGeometry(0.07,0.11,h,7),MAT.metalDark,x,g0+h/2,z);
mesh(boxGeo(0.72,0.08,0.08),MAT.metalDark,x+cs*0.32,g0+h-0.05,z-sn*0.32,ry,false,true);
mesh(boxGeo(0.34,0.3,0.34),MAT.metalDark,x+cs*0.64,g0+h-0.22,z-sn*0.64,ry,false,true);
const bb=addBoxCollider(x,g0+h/2,z,0.26,h,0.26);
bb.crush=true;
}
// 碎石堆 (街边建筑塌落的瓦砾带): 纯视觉+软掩体 —— 便宜 (6 盒), 用于成片铺街
function debrisLine(x0,z0,x1,z1,step){
const len=Math.hypot(x1-x0,z1-z0), n=Math.max(1,Math.round(len/step));
for(let i=0;i<n;i++){
const t=(i+0.5)/n, px=x0+(x1-x0)*t+wr(-1.4,1.4), pz=z0+(z1-z0)*t+wr(-1.4,1.4);
if(!freeSpot(px,pz,1.6)) continue;
rubblePile(px,pz,wr(1.4,2.2));
}
}
// ═══════════ 地貌组道具 (2026-09-10: 百团铁路专线) ═══════════
// 铁路线: 双轨+枕木, 沿 (x0,z0)→(x1,z1) 铺设 —— 轨面贴地不设碰撞 (0.08m 可碾过)
function railLine(x0,z0,x1,z1){
const len=Math.hypot(x1-x0,z1-z0)||1;
const ux=(x1-x0)/len, uz=(z1-z0)/len;
const ry=Math.atan2(ux,uz);
const step=3.5;
for(let u=0;u<len;u+=step){
const px=x0+ux*(u+step/2), pz=z0+uz*(u+step/2);
const g0=heightAt(px,pz);
// 枕木 (垂直轨向)
mesh(boxGeo(2.4,0.12,0.5),MAT.woodDark,px,g0+0.03,pz,ry,false,true);
// 双轨
for(const side of [-0.72,0.72]){
const rx=px+Math.cos(ry)*side, rz=pz-Math.sin(ry)*side;
mesh(boxGeo(0.1,0.1,step+0.1),MAT.metalDark,rx,g0+0.1,rz,ry,false,true);
}
}
}
// 平板车残骸: 硬掩体, 坦克不可碾 (无 crush) —— 破袭目标感
function railFlatcar(x,z,ry){
if(!propFree(x,z,3.5)||!freeSpot(x,z,3.2)) return;
propTake(x,z,3.5);
const fit=groundFit(x,z,ry,5.5,1.6);
const cs=Math.cos(ry), sn=Math.sin(ry);
// 车架
solidBox(MAT.woodDark,2.2,0.35,5.8,x,fit.y+0.55,z,ry);
// 平板面
mesh(boxGeo(2.0,0.12,5.5),MAT.wood,x,fit.y+0.78,z,ry,false,true);
// 车轮 (圆柱)
for(const u of [-2.0,2.0]){
for(const v of [-0.85,0.85]){
const wx=x+sn*u+cs*v, wz=z+cs*u-sn*v;
mesh(new THREE.CylinderGeometry(0.32,0.32,0.18,8),MAT.metalDark,wx,fit.y+0.32,wz).rotation.z=HPI;
}
}
// 车端挡板
for(const sgn of [-1,1]){
const px=x+sn*sgn*2.7, pz=z+cs*sgn*2.7;
mesh(boxGeo(2.1,0.7,0.12),MAT.woodDark,px,fit.y+1.1,pz,ry,false,true);
}
coverPoints.push({x:x+cs*1.4,z:z-sn*1.4},{x:x-cs*1.4,z:z+sn*1.4});
}

// ═══════════ 反坦克雷区 (2026-09-13 草原库尔斯克改版) ═══════════
// 史实: 苏军大纵深防御第一层 —— 雷带铺在防线带接近侧 (东面), 缺口走廊断开 (通道留给装甲,
// 野外的装甲进来就挨炸 = "坦克屠宰场"的引门带)。地雷=半埋深色圆盘 + 每隔数枚红白警示桩
// (史实苏军自家雷区有标桩)。无碰撞体 (可步行通过, 步兵不触发 —— 本图只做反坦克雷);
// 触发/引爆链在 15-vehicles (坦克/运输车碾压 → AT 爆炸 + 邻近链爆)。
const MINES=[]; // 运行态: {x,z,g,mesh,dead}
function atMine(x,z,marker){
if(!propFree(x,z,0.6)) return false;
const g0=heightAt(x,z);
const m=new THREE.Mesh(new THREE.CylinderGeometry(0.26,0.3,0.14,10),MAT.metalDark);
m.position.set(x,g0+0.05,z);
m.castShadow=false;
world.add(m);
MINES.push({x,z,g0,mesh:m,dead:false});
if(marker){
// 红白警示桩 (约每 4 枚一枚, 标出雷带走向)
mesh(new THREE.CylinderGeometry(0.045,0.055,1.05,6),MAT.woodDark,x+0.55,g0+0.52,z+0.55);
mesh(new THREE.CylinderGeometry(0.062,0.062,0.22,6),MAT_MARK_RED,x+0.55,g0+0.72,z+0.55);
CYLS.push({x:x+0.55,z:z+0.55,r:0.07,y0:g0,y1:g0+1.05});
}
return true;
}
// ═══════════ 太平洋岛屿组道具 (2026-09-18 塔拉瓦环礁批) ═══════════
// 椰树: 高瘦带倾角的树干 (6.6~9.6m) + 8~10 片羽状叶自干顶外斜下垂 + 椰果.
// 空间账: 树干 r0.34 为唯一直立碰撞 (冠部不设碰撞 = 子弹可穿叶而过, 与"树叶不挡弹"同口径);
//   根部下沉 0.15 掩底缘; 可燃 (fuelAdd 1.0 → 烧到该格即起火)
function palm(x,z,s=1){
if(!propFree(x,z,0.95*s)) return;
propTake(x,z,0.95*s);
const g0=heightAt(x,z)-0.15;
const h=(6.6+wr(0,3.0))*s;
const lean=wr(0.03,0.13), leanA=wr(0,TAU);
const grp=new THREE.Group();
grp.position.set(x,g0,z);
grp.rotation.order='YXZ';
grp.rotation.set(lean*Math.sin(leanA),wr(0,TAU),lean*Math.cos(leanA));
world.add(grp);
const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.30,h,7),MAT.bark);
trunk.position.y=h/2; grp.add(trunk);
grp.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
const n=8+wri(0,2);
for(let i=0;i<n;i++){
const a=i*TAU/n+wr(-0.18,0.18);
const len=wr(2.2,3.4)*s, p=wr(0.30,0.72);            // p = 自水平下垂角
const dir={x:Math.sin(a)*Math.cos(p), y:-Math.sin(p), z:Math.cos(a)*Math.cos(p)};
const frond=new THREE.Mesh(boxGeo(0.46,len,0.09),MAT.leaves);
frond.position.set(dir.x*len*0.5, h+dir.y*len*0.5, dir.z*len*0.5);
frond.rotation.order='YXZ';
// ★ 2026-09-26 B4 修: 叶片**长轴 = 盒子的局部 Y** (boxGeo(0.46宽, len长, 0.09薄)), 而旧写法
//   rotation.set(p,a,0) 把 +Y 映到 (sin a·sin p, cos p, cos a·sin p) —— 与 dir 给出的下垂方向
//   (sin a·cos p, -sin p, cos a·cos p) 恰好差 90°: 叶柄横着朝侧上方伸, 沿下垂方向的倒是叶片的**薄轴**
//   (0.09) ⇒ 整圈叶子像插在树顶的一排横杠。改成 p+HPI 后 +Y 精确落回 dir (sin(p+HPI)=cos p,
//   cos(p+HPI)=-sin p): 长轴沿下垂方向, 叶片平面仍由"水平切向 × 下垂向"张成 (与旧版同一张面, 只转 90°)。
frond.rotation.set(p+HPI,a,0);
grp.add(frond);
}
for(let i=0;i<wri(3,5);i++){
const a=wr(0,TAU), r=wr(0.18,0.34);
const nut=new THREE.Mesh(new THREE.SphereGeometry(0.15,6,5),MAT_PALM_NUT);
nut.position.set(Math.sin(a)*r,h-0.24,Math.cos(a)*r);
grp.add(nut);
}
const cyl={x,z,r:0.34*s,y0:g0,y1:g0+h};
CYLS.push(cyl);
fuelAdd(x,z,1.0);
floraHashAdd({kind:'palm',x,z,g0,meshes:[grp],cyl,alive:true,dead:false});
}
// 珊瑚礁石 (礁盘/浅水): 半露水面的珊瑚头 —— 涉水者的天然掩体 (史实塔拉瓦礁盘上遍布珊瑚头)
function reefRock(x,z,s=1){
if(!propFree(x,z,1.35*s)) return;
propTake(x,z,1.35*s);
const g0=heightAt(x,z);
const grp=new THREE.Group();
grp.position.set(x,g0,z);
world.add(grp);
const mat=new THREE.MeshLambertMaterial({color:0xa89878,map:TEX.grime});
for(let i=0;i<3+wri(0,2);i++){
const r=wr(0.5,1.1)*s;
const m=new THREE.Mesh(new THREE.SphereGeometry(r,7,5),mat);
m.position.set(wr(-0.8,0.8)*s,r*wr(0.25,0.6),wr(-0.8,0.8)*s);
m.rotation.set(wr(0,1),wr(0,3),wr(0,1));
m.scale.set(1,wr(0.5,0.8),1);
grp.add(m);
}
grp.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
CYLS.push({x,z,r:1.15*s,y0:g0,y1:g0+1.4*s});
coverPoints.push({x:x+1.3*s,z:z});
}
// 反登陆木桩 (潮间带/礁盘): 斜插椰木桩, 坦克不可碾 (无 crush) —— 登陆艇与两栖车的航路障碍
function beachPost(x,z,ry){
if(!propFree(x,z,0.75)) return;
propTake(x,z,0.75);
const g0=heightAt(x,z);
const h=wr(2.2,3.0);
const m=mesh(new THREE.CylinderGeometry(0.16,0.20,h,6),MAT.woodDark,x,g0+h*0.42,z);
m.rotation.order='YXZ';
m.rotation.set(wr(0.25,0.5),ry+wr(-0.3,0.3),wr(-0.2,0.2));
CYLS.push({x,z,r:0.28,y0:g0,y1:g0+h*0.8});
}
// 航道浮标 (登陆航道标示; 纯视觉: 随浪起伏, 无碰撞 —— 不挡游泳/日后不挡船)
const BUOYS=[];
function buoy(x,z,col=0xc23a2a){
const m=mesh(new THREE.CylinderGeometry(0.34,0.5,1.1,8),new THREE.MeshLambertMaterial({color:col,map:TEX.grime}),x,SEA.level+0.35,z);
mesh(new THREE.CylinderGeometry(0.05,0.05,0.95,5),MAT.metalDark,x,SEA.level+1.2,z,0,false,false);
BUOYS.push({m,x,z,ph:wr(0,TAU)}); // ★ ph 保留取数 (已不参与浪涌计算): 删掉这一次全局取数会打漂 _wstate ⇒ 布局指纹整体漂移
}
// 浪涌: 与 15d 的水面载具共读 00-config 的**波场单源** seaWaveOffset (位置相位) ——
// 旧版各写一条 sin() 是两套浪, 玩家会看到艇与浮标不同步地上下。艇的横摇用同一相位的导数式 (sin(ph+0.5)) 保持同波次。
function updateBuoys(dt){
// 2026-09-26E (审计 36): 相位改读 seaClock (见 00-config 的声明) —— 与 updateSea 同一支钟
const T=(typeof seaClock==="number")?seaClock:nowT;
for(const b of BUOYS){
const ph=T*NAVAL_CFG.waveFreq+b.x*NAVAL_CFG.waveKx+b.z*NAVAL_CFG.waveKz;
b.m.position.y=SEA.level+0.35+seaWaveOffset(b.x,b.z,T);
b.m.rotation.z=Math.sin(ph+0.5)*0.09;
}
}
// 搁浅登陆艇残骸 (希金斯艇 LCVP 形制, 滩头地标/大件硬掩体): 艇艏跳板放落在湿沙上, 半搁浅微倾 ——
// 空间账 (与改造前同一套口径): 实体盒 10.4×1.8×3.3 (ry 交换) + coverPoints 三点, 逐字不动;
//   舷高 1.6 (蹲姿全掩蔽/站姿可越顶射击), 跳板 3.0 宽放落至 ~12° 坡; 坦克不可碾 (无 crush)。
// 艇体朝向 (与 05c 三处滩头摆放一致, 不改调用点): 艇艏 = 局部 -Z (陆侧, 跳板放落湿沙) / 艇艉 = +Z (海侧, 机舱+舵+三叶桨)。
//   旧注释"放落的跳板 (向 +z 海侧)"与代码 z=-6.6 自相矛盾 —— 跳板本就在艇艏(陆侧), 按真实朝向建。
// 2026-09-20 残骸重做 (用户"太池沼"的直接落点): LCVP 真实构造 + **三层水线污**。
// 取数红线: 只保留既有那 1 次 wr(-0.05,0.05) (半搁浅横倾); 其余抖动全走 wkRand (本地哈希)。
function landingCraft(x,z,ry){
if(!propFree(x,z,5.6)||!freeSpot(x,z,5.2)) return;
propTake(x,z,5.6);
const fit=groundFit(x,z,ry,5.4,1.7);
const sn=Math.sin(ry), cs=Math.cos(ry);
const grp=new THREE.Group();
grp.position.set(x,fit.y,z);
grp.rotation.order='YXZ';
grp.rotation.set(fit.pitch,ry,fit.roll+wr(-0.05,0.05));   // ★ 既有那 1 次全局取数 (半搁浅横倾) —— 原样保留
grp.wkRole='landingCraft';   // 角色标记 (直挂属性)
world.add(grp);
const R=wkRand(x,z,ry,0x1c0f);
const rotSgn=R.chance(0.5)?1:-1;                           // 本艇"哪一侧被撞坏" (逐艇不同, 同一坐标恒定)
const M=wkPaint(0x4a5240,0x2f342c);                        // 舰体橄榄绿 / 舱内深色 / 水线三带
// ── ① 艇体: 四段 (艏收窄 + 舯体 + 艉收窄) 替代旧版单一长方体; 龙骨/艇底视觉下延到吃水线以下 ──
wkPart(grp,boxGeo(3.30,1.50,6.20),M.paint,0,0.78,0.10,0,0,0,'hullMid');
wkPart(grp,boxGeo(2.55,1.50,2.30),M.paint,0,0.78,-4.05,0,0,0,'hullBow');
wkPart(grp,boxGeo(3.05,1.50,2.00),M.paint,0,0.78,4.20,0,0,0,'hullStern');
for(const sx of [1,-1]) // 艏部收窄的侧板 (梯形艏: LCVP 剪影的第一辨识点)
wkPart(grp,boxGeo(0.12,1.46,2.55),M.paint,sx*1.10,0.78,-3.95,0,-sx*0.30,0,'bowFlare');
wkPart(grp,boxGeo(2.60,0.55,8.60),M.rust,0,-0.12,0.20,0,0,0,'keel');   // 艇底/龙骨 (没入沙线以下)
// ── ② 舷侧肋骨外露 (肋板横线) + 舷顶缘纵梁 + 缆桩 + 护舷 ──
for(const sx of [1,-1]){
for(let i=0;i<3;i++) // 外露横肋线 (焊接肋骨/纵桁, 舷侧最好认的一组细节; 与舷板齐平, 不越出艇宽)
wkPart(grp,boxGeo(0.05,0.06,6.30),M.rust,sx*1.640,0.44+i*0.36,0.10,0,0,0,'ribLine');
for(let i=0;i<2;i++) // 竖肋
wkPart(grp,boxGeo(0.06,1.30,0.10),M.rust,sx*1.640,0.80,-2.10+i*3.90,0,0,0,'ribVert');
}
for(const sx of [1,-1]) // 舷顶缘纵梁 (原 rail 尺寸/位置逐字保留 —— 剪影不变)
wkPart(grp,boxGeo(0.16,0.42,10.40),M.paint,sx*1.62,1.70,0,0,0,0,'gunwale');
for(const sx of [1,-1]) for(const cz of [-3.30,3.10]) // 缆桩 (系缆柱 + 桩头)
{
wkPart(grp,boxGeo(0.18,0.26,0.18),M.steel,sx*1.55,1.96,cz,0,0,0,'cleat');
wkPart(grp,boxGeo(0.26,0.06,0.26),M.steel,sx*1.55,2.12,cz,0,0,0,'cleatHead');
}
for(const sx of [1,-1]) // 护舷 (半圆木, 挂在水线附近)
wkPart(grp,new THREE.CylinderGeometry(0.11,0.11,1.90,8),M.wood,sx*1.615,0.52,1.30,HPI,0,0,'fender');
// ── ③ 舱内: 敞口货舱 + 座椅横梁 + 横向构架 ──
// ★ 可见性口径: 艇体是**实心盒**, 腔内的东西一概看不见 —— 旧版 well (2.6×0.5×7.2 @y1.6) 就是靠
//   "深色箱顶高出舷缘 0.3m"读作敞口货舱。这里沿用同一手法并加高一层: 货舱顶 1.73 (舷缘 1.53) + 其上的横梁/座板。
wkPart(grp,boxGeo(2.85,0.62,6.60),M.burnt,0,1.42,-0.10,0,0,0,'hold');       // 敞口货舱 (深色内腔)
for(let i=0;i<3;i++){
const sz=-2.30+i*2.15;
wkPart(grp,boxGeo(3.12,0.12,0.16),M.rust,0,1.76,sz+0.55,0,0,0,'frame');     // 横向构架 (顶在舷缘上)
wkPart(grp,boxGeo(2.45,0.09,0.24),M.wood,0,1.84,sz,0,0,0,'seatBeam');       // 座椅横梁 (跨在构架上)
}
// ── ④ 艇艏跳板 + 铰链 + 绞盘缆 (跳板放落湿沙) ──
wkPart(grp,boxGeo(2.90,0.16,3.00),M.rust,0,0.12,-6.69,-0.12,0,0,'ramp');    // 放落的跳板 (坡 ~7°)
wkPart(grp,boxGeo(3.40,0.10,3.20),M.burnt,0,0.02,-6.95,-0.10,0,0,'rampSand');// 跳板压出的湿沙痕
wkPart(grp,boxGeo(2.60,0.12,0.14),M.steel,0,0.32,-5.28,0,0,0,'hingeBar');   // 铰链座
for(const sx of [1,-1]) wkPart(grp,new THREE.CylinderGeometry(0.05,0.05,0.34,6),M.steel,sx*1.10,0.32,-5.28,0,0,HPI,'hingePin');
wkPart(grp,new THREE.CylinderGeometry(0.17,0.17,0.60,10),M.steel,0,1.86,-4.60,0,0,HPI,'winchDrum'); // 绞盘
wkPart(grp,boxGeo(0.52,0.36,0.40),M.rust,0,1.60,-4.60,0,0,0,'winchFrame');
for(const sx of [1,-1]) wkPart(grp,new THREE.CylinderGeometry(0.028,0.028,3.55,5),M.steel,sx*1.15,0.55,-6.35,HPI-0.12,0,0,'cable');
// ── ⑤ 艇艏机枪座 (座圈 + 断管机枪 + 弹药箱) ──
wkPart(grp,new THREE.CylinderGeometry(0.13,0.16,0.55,8),M.steel,0.95,1.85,-3.55,0,0,0,'mgPedestal');
wkPart(grp,boxGeo(0.52,0.07,0.52),M.steel,0.95,2.14,-3.55,0,0,0,'mgRing');
wkPart(grp,new THREE.CylinderGeometry(0.05,0.06,1.05,6),M.burnt,0.95,2.28,-3.98,HPI+0.30,0,0,'mgBarrel');
wkPart(grp,boxGeo(0.30,0.24,0.20),M.rust,0.95,2.22,-3.10,0,0,0,'mgAmmo');
// ── ⑥ 艇艉: 机舱 (盖半开) + 排气管 + 舵 + 三叶螺旋桨 ──
wkPart(grp,boxGeo(1.80,1.00,1.50),M.paint,0,2.10,5.40,0,0,0,'engineRoom');
wkPart(grp,boxGeo(1.30,0.07,0.95),M.rust,0,2.50,5.15,0.30+R.r(0,0.25),0,0,'engineHatch');   // 机舱盖掀开角度逐艇不同
wkPart(grp,new THREE.CylinderGeometry(0.08,0.09,0.52,6),M.steel,0.62,2.50,4.95,0.10+R.r(0,0.18),0,0,'exhaust');
wkPart(grp,boxGeo(0.10,0.90,0.70),M.steel,0,0.55,5.62,0,0,rotSgn*R.r(0.10,0.26),'rudder'); // 舵被撞歪的一侧逐艇不同
wkPart(grp,new THREE.CylinderGeometry(0.09,0.09,0.26,8),M.steel,0,0.55,5.82,HPI,0,0,'propHub');
{ // 三叶螺旋桨: 每叶独立扭角, 随机一叶弯折 (残骸辨识点; 逐艇不同, 同一坐标恒定)
const bent=R.i(0,2);
for(let i=0;i<3;i++){
const a=i*TAU/3, br=0.30, bend=(i===bent)?0.42:0;
wkPart(grp,boxGeo(0.11,0.58,0.05),M.steel,Math.sin(a)*br,0.55+Math.cos(a)*br,5.82,-a+bend,0.5,0,'propBlade');
}
}
// ── ⑦ 半搁浅微倾造成的艇体损伤 (外掀的舷板: 哪一侧/哪一段逐艇不同) ──
wkPart(grp,boxGeo(0.06,0.70,1.25),M.rust,rotSgn*R.r(1.40,1.50),1.05+R.r(-0.12,0.12),R.r(-2.20,0.40),0.10,0,rotSgn*R.r(0.32,0.48),'hullTorn');
// ── ⑧ 三层水线污 (用户"太池沼"的主因) ──
// 基准 = 海平面在**组内局部高度** yWL = SEA.level - fit.y: 水线锈带跨水线 ±0.11, 晒褪带其上, 藤壶藻绿其下。
// 为什么按海平面而不是按地面算: 污带记录的是"这条艇浮着时泡在哪", 与它现在搁在沙上的高低无关 ——
//   同时保证三条带相对 SEA.level 的位置天然正确 (自检逐艇量世界高: 上带>level, 锈带跨 level, 下带<level)。
const seaLv=(typeof SEA!=='undefined'&&SEA)?SEA.level:0;
const yWL=clamp(seaLv-fit.y,-0.20,1.28);
const hBleach=clamp(1.48-(yWL+0.11),0.12,0.60);
const hBarn=clamp((yWL-0.11)+0.34,0.12,0.70);
const yBleachC=yWL+0.11+hBleach/2, yBarnC=yWL-0.11-hBarn/2;
for(const sx of [1,-1]){
const bx=sx*1.675;
const b1=wkPart(grp,boxGeo(0.035,0.22,8.40),M.wl,bx,yWL,0.60,0,0,0,'bandWl');                        // 水线锈带
const b2=wkPart(grp,boxGeo(0.035,hBleach,8.40),M.bleach,bx,yBleachC,0.60,0,0,0,'bandBleach');         // 水上: 晒褪色
const b3=wkPart(grp,boxGeo(0.035,hBarn,8.40),M.barn,bx,yBarnC,0.60,0,0,0,'bandBarn');                // 水下: 藤壶藻绿
// 自检探针 (dev/_wreck-selfcheck.js) 只量右舷这三条: 三层水线的世界高必须分居 SEA.level 两侧
if(sx>0){ b1.wkBand='rust'; b2.wkBand='bleach'; b3.wkBand='barnacle'; }
}
wkPart(grp,boxGeo(3.20,0.22,0.035),M.wl,0,yWL,5.22,0,0,0,'bandWlStern');                             // 艉封板同带
grp.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
addBoxCollider(x,fit.y+0.9,z, Math.abs(sn)>0.5?10.4:3.3, 1.8, Math.abs(sn)>0.5?3.3:10.4);
coverPoints.push({x:x+cs*2.6,z:z-sn*2.6},{x:x-cs*2.6,z:z+sn*2.6},{x:x+cs*7.4,z:z-sn*7.4});
}
// 沉船残骸 (深水区地标/水下掩体): 搁在 4~7m 海床上的驳船, 潜泳时的参照物与掩体
function sunkenWreck(x,z,ry){
if(!propFree(x,z,5)) return;
propTake(x,z,5);
const g0=heightAt(x,z);
const grp=new THREE.Group();
grp.position.set(x,g0,z);
grp.rotation.order='YXZ';
grp.rotation.set(0,ry,wr(-0.12,0.12));
world.add(grp);
const dark=new THREE.MeshLambertMaterial({color:0x3c4038,map:TEX.grime});
const hull=new THREE.Mesh(boxGeo(3.4,1.6,9.5),dark); hull.position.y=0.8; grp.add(hull);
const deck=new THREE.Mesh(uvGeo(boxGeo(3.0,0.2,8.0),MAT.metalDark),MAT.metalDark); deck.position.y=1.7; grp.add(deck);
const bow=new THREE.Mesh(boxGeo(2.4,1.2,2.6),dark); bow.position.set(0,0.9,-5.4); bow.rotation.y=0.32; grp.add(bow);
const mast=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.16,4.2,6),MAT.metalDark);
mast.position.set(0.3,3.3,2.2); mast.rotation.z=0.55; grp.add(mast);
grp.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
addBoxCollider(x,g0+0.85,z, Math.abs(Math.sin(ry))>0.5?9.5:3.4, 1.7, Math.abs(Math.sin(ry))>0.5?3.4:9.5);
coverPoints.push({x,z});
}
