// ─────────────────────────────────────────────
// 04-collision.js —— 空间索引/射线检测/碰撞移动
// 源: Index.original.html 第 1330-1451 行
// ─────────────────────────────────────────────
'use strict';
const RGRID={ cell:13, N:0, off:(MAP_SIZE+60)/2, boxCells:null, cylCells:null, stampB:null, stampC:null, gen:0 };
function buildSpatialIndex(){
RGRID.N=Math.ceil((MAP_SIZE+60)/RGRID.cell);
const {cell,N,off}=RGRID;
RGRID.boxCells=Array.from({length:N*N},()=>[]);
RGRID.cylCells=Array.from({length:N*N},()=>[]);
BOXES.forEach((b,bi)=>{
const i0=clamp(Math.floor((b.minX+off)/cell),0,N-1), i1=clamp(Math.floor((b.maxX+off)/cell),0,N-1);
const j0=clamp(Math.floor((b.minZ+off)/cell),0,N-1), j1=clamp(Math.floor((b.maxZ+off)/cell),0,N-1);
for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++) RGRID.boxCells[j*N+i].push(bi);
});
CYLS.forEach((c,ci)=>{
const i0=clamp(Math.floor((c.x-c.r+off)/cell),0,N-1), i1=clamp(Math.floor((c.x+c.r+off)/cell),0,N-1);
const j0=clamp(Math.floor((c.z-c.r+off)/cell),0,N-1), j1=clamp(Math.floor((c.z+c.r+off)/cell),0,N-1);
for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++) RGRID.cylCells[j*N+i].push(ci);
});
RGRID.stampB=new Int32Array(BOXES.length+96);
RGRID.stampC=new Int32Array(CYLS.length+16);
stampBLen=RGRID.stampB.length; stampCLen=RGRID.stampC.length; // 与去重戳同步 (见 raycastWorld 的按需扩容)
}
// 去重戳当前容量 (与 RGRID.stampB/stampC 同步; 见 raycastWorld 的按需扩容)
let stampBLen=0, stampCLen=0;
const _rcP=V3(), _rcN=V3();
const _rcResult={dist:0,point:null,normal:null,kind:null}; // 共享结果槽 (2026-09-06 B6/P1-6): 全库 28 调用点均即时消费不长期持有
function raycastWorld(o,dir,maxD){
let best=maxD, bn=null, kind=null;
if(RGRID.boxCells){
// 去重戳容量按需扩容 (2026-09-26): buildSpatialIndex 只按"建索引当时的盒子数 +96"定容, 而
// addBoxCollider 运行期还会持续追加 (工程兵建造/残骸/探针摆件) —— 越出容量的下标在 TypedArray 上
// **静默读成 undefined**, 于是"本代已测过"的去重失效: 同一盒在其覆盖的每个栅格里被重复测试
// (纯冗余, 结果不变 —— 命中判定本身幂等)。一次性补齐容量, 之后只剩一次长度比较。
if(stampBLen<BOXES.length||stampCLen<CYLS.length){ RGRID.stampB=new Int32Array(BOXES.length+512); RGRID.stampC=new Int32Array(CYLS.length+128); stampBLen=RGRID.stampB.length; stampCLen=RGRID.stampC.length; }
const {cell,N,off,boxCells,cylCells,stampB,stampC}=RGRID;
const gen=++RGRID.gen;
let ci=Math.floor((o.x+off)/cell), cj=Math.floor((o.z+off)/cell);
const dx=dir.x, dz=dir.z;
const stepI=dx>0?1:-1, stepJ=dz>0?1:-1;
const tDX=Math.abs(dx)<1e-9?Infinity:cell/Math.abs(dx);
const tDZ=Math.abs(dz)<1e-9?Infinity:cell/Math.abs(dz);
let tMaxX=Math.abs(dx)<1e-9?Infinity:(dx>0?((ci+1)*cell-off-o.x):(o.x-(ci*cell-off)))/Math.abs(dx);
let tMaxZ=Math.abs(dz)<1e-9?Infinity:(dz>0?((cj+1)*cell-off-o.z):(o.z-(cj*cell-off)))/Math.abs(dz);
let t=0, guard=0;
while(t<=best&&guard++<70){
if(ci>=0&&cj>=0&&ci<N&&cj<N){
const idx=cj*N+ci;
const bl=boxCells[idx];
for(let k=0;k<bl.length;k++){
const bi=bl[k];
if(stampB[bi]===gen) continue;
stampB[bi]=gen;
const r=rayBox(o,dir,BOXES[bi],best);
if(r){ best=r.t; bn=r; kind='box'; }
}
const cl=cylCells[idx];
for(let k=0;k<cl.length;k++){
const cy2=cl[k];
if(stampC[cy2]===gen) continue;
stampC[cy2]=gen;
const r=rayCyl(o,dir,CYLS[cy2],best);
if(r){ best=r.t; bn=r; kind='cyl'; }
}
// 2026-09-25 修: 上界应为 ci>=N/cj>=N —— 栅格是 0..N-1, 旧写 ci>N 会多走一格才退出
// (被 guard<70 与内层 `ci>=0&&ci<N` 判断兜住, 只是白跑一轮 DDA; 与 occBlocked 的 `i>=OCC.N` 同口径对齐)
} else if(ci<-1||cj<-1||ci>N-1||cj>N-1) break;
if(tMaxX<tMaxZ){ t=tMaxX; tMaxX+=tDX; ci+=stepI; }
else { t=tMaxZ; tMaxZ+=tDZ; cj+=stepJ; }
}
} else {
for(const b of BOXES){ const r=rayBox(o,dir,b,best); if(r){ best=r.t; bn=r; kind='box'; } }
for(const c of CYLS){ const r=rayCyl(o,dir,c,best); if(r){ best=r.t; bn=r; kind='cyl'; } }
}
if(dir.y<0.35){
let t=0.5;
const step=1.8;
while(t<best){
const x=o.x+dir.x*t, y=o.y+dir.y*t, z=o.z+dir.z*t;
const gh=heightAt(x,z);
if(y<=gh){
let lo=t-step, hi=t;
for(let i=0;i<6;i++){
const m=(lo+hi)/2;
(o.y+dir.y*m<=heightAt(o.x+dir.x*m,o.z+dir.z*m))?hi=m:lo=m;
}
best=hi; bn={nx:0,ny:1,nz:0}; kind='ground';
break;
}
t+=step;
}
}
if(!bn) return null;
_rcP.set(o.x+dir.x*best,o.y+dir.y*best,o.z+dir.z*best);
_rcN.set(bn.nx,bn.ny,bn.nz);
_rcResult.dist=best; _rcResult.point=_rcP; _rcResult.normal=_rcN; _rcResult.kind=kind;
return _rcResult;
}
// ── RGRID 邻近候选遍历 (2026-09-06 B5/P0-2): 移动碰撞/站高/坦克足印查询不再全场景扫描 BOXES/CYLS ──
// 候选集 ⊇ 真命中集 (命中判定仍走各调用方的原精确测试, 结果与全量遍历一致);
// window.RGRID_OFF=true 一键回退旧全量路径 (等价性探针/异常排查用)。
// 使用独立 stamp (RQ) 而非复用射线的 stampB/stampC: 查询回调内可能触发 destroyStructure 等重入逻辑。
const RQ={gen:0,stampB:null,stampC:null};
function rqStamps(){
if(!RQ.stampB||RQ.stampB.length<BOXES.length) RQ.stampB=new Int32Array(BOXES.length+128);
if(!RQ.stampC||RQ.stampC.length<CYLS.length) RQ.stampC=new Int32Array(CYLS.length+32);
}
function eachBoxNear(x0,z0,x1,z1,fn){
if(window.RGRID_OFF||!RGRID.boxCells){
for(let i=0;i<BOXES.length;i++) fn(BOXES[i]);
return;
}
rqStamps();
const gen=++RQ.gen;
const {cell,N,off,boxCells}=RGRID;
const i0=clamp(Math.floor((x0+off)/cell),0,N-1), i1=clamp(Math.floor((x1+off)/cell),0,N-1);
const j0=clamp(Math.floor((z0+off)/cell),0,N-1), j1=clamp(Math.floor((z1+off)/cell),0,N-1);
for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
const bl=boxCells[j*N+i];
for(let k=0;k<bl.length;k++){
const bi=bl[k];
if(bi<RQ.stampB.length){ if(RQ.stampB[bi]===gen) continue; RQ.stampB[bi]=gen; }
fn(BOXES[bi]);
}
}
}
function eachCylNear(x0,z0,x1,z1,fn){
if(window.RGRID_OFF||!RGRID.cylCells){
for(let i=0;i<CYLS.length;i++) fn(CYLS[i]);
return;
}
rqStamps();
const gen=++RQ.gen;
const {cell,N,off,cylCells}=RGRID;
const i0=clamp(Math.floor((x0+off)/cell),0,N-1), i1=clamp(Math.floor((x1+off)/cell),0,N-1);
const j0=clamp(Math.floor((z0+off)/cell),0,N-1), j1=clamp(Math.floor((z1+off)/cell),0,N-1);
for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
const cl=cylCells[j*N+i];
for(let k=0;k<cl.length;k++){
const ci=cl[k];
if(ci<RQ.stampC.length){ if(RQ.stampC[ci]===gen) continue; RQ.stampC[ci]=gen; }
fn(CYLS[ci]);
}
}
}
function collideMove(pos, radius){
// 查询半径=碰撞半径 (推挤只作用于表面距 pos<radius 的盒/柱, 候选矩形再留 0.02 采样余量)
const m=0.02;
eachBoxNear(pos.x-radius-m,pos.z-radius-m,pos.x+radius+m,pos.z+radius+m,b=>{
if(b.dead) return;
if(pos.y+1.7<b.minY||pos.y+0.25>b.maxY) return;
if(b.maxY-pos.y<=0.56) return;
const cx=clamp(pos.x,b.minX,b.maxX), cz=clamp(pos.z,b.minZ,b.maxZ);
let dx=pos.x-cx, dz=pos.z-cz;
const d2=dx*dx+dz*dz;
if(d2<radius*radius){
if(d2<1e-8){
const l=Math.min(pos.x-b.minX,b.maxX-pos.x), rgt=Math.min(pos.z-b.minZ,b.maxZ-pos.z);
if(l<rgt) pos.x = (pos.x-b.minX<b.maxX-pos.x)? b.minX-radius : b.maxX+radius;
else pos.z = (pos.z-b.minZ<b.maxZ-pos.z)? b.minZ-radius : b.maxZ+radius;
} else {
const d=Math.sqrt(d2), push=(radius-d)/d;
pos.x+=dx*push; pos.z+=dz*push;
}
}
});
eachCylNear(pos.x-radius-m,pos.z-radius-m,pos.x+radius+m,pos.z+radius+m,c=>{
if(pos.y+1.7<c.y0||pos.y+0.2>c.y1) return;
let dx=pos.x-c.x, dz=pos.z-c.z;
const rr=c.r+radius, d2=dx*dx+dz*dz;
if(d2<rr*rr&&d2>1e-8){
const d=Math.sqrt(d2), push=(rr-d)/d;
pos.x+=dx*push; pos.z+=dz*push;
}
});
// 大舰舰体 (2026-09-30 阶段五 P4): 舷侧是硬墙 —— 水线以上的部分把步兵挡在外面 (水线以下不挡,
//   游泳者可贴舰底通过; 也避免深水区把玩家夹在舰与礁之间卡死)。走 15h 的局部空间解算,
//   不进全局 BOXES/OCC —— 理由同 standHeight 那一行 (舰在动)。
if(typeof capPushBody==='function') capPushBody(pos,radius);
// ★2026-09-26E (审计 28): 与 15d 同一支世界边缘单源 (旧值 MAP_SIZE/2+8 比网格边界只差 12m ⇒ 贴边即见断崖)
const lim=(typeof WORLD_ACTOR_LIMIT==='number')?WORLD_ACTOR_LIMIT:(MAP_SIZE/2+8);
pos.x=clamp(pos.x,-lim,lim); pos.z=clamp(pos.z,-lim,lim);
}
function standHeight(x,z,curY){
let h=heightAt(x,z);
// 大舰甲板 (2026-09-30 阶段五 P4): 甲板是**移动平台**, 不进 heightAt/BOXES/OCC (舰在动, 逐帧搬盒
//   等于把寻路网格当筛子摇), 而是由 15h 在本行做一次 O(舰数≤4) 的局部矩形查询。语义与下面的盒顶面
//   逐字同规 —— "够得着才抬脚": 在水里看 7m 高的甲板不算站上去 (capDeckY 内部按 CAPITAL_CFG.stepUp 夹),
//   走出甲板矩形则返回 −1e9, 脚下自然变回海床 ⇒ 掉海 (与"走出崖缘"同一条物理路径)。
if(typeof capDeckY==='function'){ const cd=capDeckY(x,z,curY); if(cd>h) h=cd; }
eachBoxNear(x-0.07,z-0.07,x+0.07,z+0.07,b=>{
if(b.dead) return;
if(x>b.minX-0.05&&x<b.maxX+0.05&&z>b.minZ-0.05&&z<b.maxZ+0.05){
if(b.maxY<=curY+0.55&&b.maxY>h) h=b.maxY;
}
});
return h;
}
// 坡度物理 (步兵, 2026-09-12 百团改版, 全战役生效; 玩家/Bot 同规则 —— 纲领第 2 条):
// 上坡 FOOT_SLOPE_SLOW(40°)起减速"手脚并用", FOOT_SLOPE_MAX(65°)以上不可登攀 ——
// 超限段只保留沿等高线分量 (横向恒可走, 无卡死); 下坡不设限: 走出崖缘自然腾空, 摔伤由 fallDamage 结算。
// 仅地面态调用 (腾空/伞降/乘载具不适用); 建筑楼梯不受影响 (heightAt 不含建筑几何)。
const _slopeOut=[0,0];
function slopeGateMove(pos,dx,dz){
_slopeOut[0]=dx; _slopeOut[1]=dz;
const dist=Math.hypot(dx,dz);
if(dist<1e-6) return _slopeOut;
const dh=heightAt(pos.x+dx,pos.z+dz)-heightAt(pos.x,pos.z);
if(dh<=0) return _slopeOut; // 下坡/平地不设限
const sl=dh/dist, kMax=Math.tan(FOOT_SLOPE_MAX*DEG), kSlow=Math.tan(FOOT_SLOPE_SLOW*DEG);
if(sl<=kSlow) return _slopeOut;
if(sl>kMax){
const gx=heightAt(pos.x+1.2,pos.z)-heightAt(pos.x-1.2,pos.z);
const gz=heightAt(pos.x,pos.z+1.2)-heightAt(pos.x,pos.z-1.2);
const gl=Math.hypot(gx,gz);
if(gl>1e-4){
const cx=-gz/gl, cz=gx/gl, t=dx*cx+dz*cz;
_slopeOut[0]=cx*t*0.8; _slopeOut[1]=cz*t*0.8;
}else{ _slopeOut[0]=0; _slopeOut[1]=0; }
return _slopeOut;
}
const f=1-(sl-kSlow)/(kMax-kSlow)*0.72; // 40°→65° 线性减速至 28%
_slopeOut[0]=dx*f; _slopeOut[1]=dz*f;
return _slopeOut;
}
// 严寒庇护判定 (2026-09-05 城市组·斯大林格勒 cold:true): 头顶竖直射线 12m 内有静态遮蔽
// (屋顶/楼板/亭顶/车厢顶) 即算室内 —— 玩家与 Bot 同判定 (raycastWorld 竖直向只测所在格, 开销可忽略)
const _coldO=V3(), _coldD=V3(0,1,0);
function coldSheltered(px,py,pz){
_coldO.set(px,py+1.6,pz);
return !!raycastWorld(_coldO,_coldD,12);
}
