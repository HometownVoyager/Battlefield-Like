// ─────────────────────────────────────────────
// 05b-props.js —— 道具/植被 (占位互斥表 PROPS 见 05-world.js)
// 2026-08-24 由 05-world.js 切分: 原第 781-965 行 + 植被 1159-1183 行
// ═══════════ 道具 / 植被 (原样保留, 随机数改 wr 以支持种子) ═══════════
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
const craterGeo=new THREE.CircleGeometry(1,20);
const craterMat=new THREE.MeshLambertMaterial({color:0x4a4238,transparent:true,opacity:0.85,depthWrite:false});
const runtimeCraters=[];
function crater(x,z,r,runtime=false){
if(!runtime){
if(!propFree(x,z,r*0.5+0.6)) return;
propTake(x,z,r*0.5+0.6);
}
const m=mesh(craterGeo,craterMat,x,heightAt(x,z)+0.03,z,0,false,true);
m.quaternion.setFromUnitVectors(_FWD,terrNormal(x,z)); m.scale.setScalar(r);
m.renderOrder=1;
if(runtime){
runtimeCraters.push(m);
if(runtimeCraters.length>36){ const old=runtimeCraters.shift(); world.remove(old); }
return;
}
const rim=mesh(new THREE.TorusGeometry(r*0.8,r*0.14,6,14),new THREE.MeshLambertMaterial({color:0x5d5344}),x,heightAt(x,z)+0.05,z);
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
CYLS.push({x,z,r:0.45,y0:g0,y1:g0+1.1});
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
const mound=mesh(new THREE.SphereGeometry(r*0.8,10,6),MAT.rubble,x,g0-r*0.35,z);
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
const c=mesh(new THREE.CylinderGeometry(0.03,0.045,h,5),new THREE.MeshLambertMaterial({color:0x7a9448}),x+ox,g0+h/2,z+oz);
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
// 烧毁坦克残骸: 黑化车体+歪斜炮塔+垂落炮管 —— 全图最大的单件硬掩体 (不可碾不可毁)
function tankWreck(x,z,ry){
if(!propFree(x,z,3.4)||!freeSpot(x,z,3.3)) return; // freeSpot: 避开建筑足迹
propTake(x,z,3.4);
const fit=groundFit(x,z,ry,3.2,1.8);
const grp=new THREE.Group();
grp.position.set(x,fit.y,z);
grp.rotation.order='YXZ';
grp.rotation.set(fit.pitch,ry,fit.roll);
world.add(grp);
const dark=new THREE.MeshLambertMaterial({color:0x2e2c28,map:TEX.grime});
const hull=new THREE.Mesh(boxGeo(3.0,1.15,5.6),dark); hull.position.y=0.75; grp.add(hull);
const tur=new THREE.Mesh(boxGeo(2.2,0.8,2.6),dark); tur.position.set(0.3,1.7,-0.3); tur.rotation.y=wr(-0.5,0.5); grp.add(tur);
const brl=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.11,3.6,7),dark);
brl.rotation.x=HPI+0.35; brl.position.set(0.3,1.75,1.55); grp.add(brl);
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
solidBox(MAT.brick,2.3,0.85,1.9,x,fit.y+0.425,z,ry);
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
