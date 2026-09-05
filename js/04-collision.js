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
}
const _rcP=V3(), _rcN=V3();
const _rcResult={dist:0,point:null,normal:null,kind:null}; // 共享结果槽 (2026-09-06 B6/P1-6): 全库 28 调用点均即时消费不长期持有
function raycastWorld(o,dir,maxD){
let best=maxD, bn=null, kind=null;
if(RGRID.boxCells){
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
} else if(ci<-1||cj<-1||ci>N||cj>N) break;
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
const lim=MAP_SIZE/2+8;
pos.x=clamp(pos.x,-lim,lim); pos.z=clamp(pos.z,-lim,lim);
}
function standHeight(x,z,curY){
let h=heightAt(x,z);
eachBoxNear(x-0.07,z-0.07,x+0.07,z+0.07,b=>{
if(b.dead) return;
if(x>b.minX-0.05&&x<b.maxX+0.05&&z>b.minZ-0.05&&z<b.maxZ+0.05){
if(b.maxY<=curY+0.55&&b.maxY>h) h=b.maxY;
}
});
return h;
}
// 严寒庇护判定 (2026-09-05 城市组·斯大林格勒 cold:true): 头顶竖直射线 12m 内有静态遮蔽
// (屋顶/楼板/亭顶/车厢顶) 即算室内 —— 玩家与 Bot 同判定 (raycastWorld 竖直向只测所在格, 开销可忽略)
const _coldO=V3(), _coldD=V3(0,1,0);
function coldSheltered(px,py,pz){
_coldO.set(px,py+1.6,pz);
return !!raycastWorld(_coldO,_coldD,12);
}
