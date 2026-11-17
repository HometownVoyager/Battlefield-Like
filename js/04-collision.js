// ─────────────────────────────────────────────
// 04-collision.js —— 空间索引/射线检测/碰撞移动
// 源: Index.original.html 第 1330-1451 行
// ─────────────────────────────────────────────
'use strict';
const RGRID={ cell:13, N:0, off:(MAP_SIZE+60)/2, boxCells:null, cylCells:null, stampB:null, stampC:null, gen:0, idxRebuilds:0 };
// ── 碰撞集合变更戳 (2026-11-11 性能批) ──
// 旧账: NAV.refresh 每次都全量重灌 RGRID 倒排表 (数千 BOX/CYL 逐个重新 push, 640 图 1~3ms) —— 对
// "火情蔓延/塌墙/碾铁丝"这类局部事件是**纯冗余**: addBoxCollider 已做增量注册 (spatialIndexAddBox),
// 运行期唯一会使倒排表下标失效的变更只剩 06-engineering 拆树篱的 CYLS.splice (下标前移)。改为
// "集合变更才重建": 默认 true (首建/换图), 变更点置 true, NAV.refresh 消费后复位; forceFull
// (23b-worldrestore 世界还原) 无条件重建。RGRID.idxRebuilds 计数供探针对账。
let _colIdxDirty=true;
function buildSpatialIndex(){
RGRID.idxRebuilds++;
RGRID.N=Math.ceil((MAP_SIZE+60)/RGRID.cell);
const {cell,N,off}=RGRID;
// 倒排表原地复用 (2026-11-01 性能批): NAV.refresh 在火情期每 5s 整表重建一次, 旧版每次分配 N² 个
// 新数组 (640 图 ≈2900 个) —— 尺寸没变就 length=0 清空续用, 重灌结果与重建逐位一致。
if(!RGRID.boxCells||RGRID.boxCells.length!==N*N){
RGRID.boxCells=Array.from({length:N*N},()=>[]);
RGRID.cylCells=Array.from({length:N*N},()=>[]);
}else{
for(let k=0;k<RGRID.boxCells.length;k++){ RGRID.boxCells[k].length=0; }
for(let k=0;k<RGRID.cylCells.length;k++){ RGRID.cylCells[k].length=0; }
}
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
function spatialIndexAddBox(bi){
if(!RGRID.boxCells) return;
const b=BOXES[bi];
if(!b) return;
const {cell,N,off}=RGRID;
const i0=clamp(Math.floor((b.minX+off)/cell),0,N-1), i1=clamp(Math.floor((b.maxX+off)/cell),0,N-1);
const j0=clamp(Math.floor((b.minZ+off)/cell),0,N-1), j1=clamp(Math.floor((b.maxZ+off)/cell),0,N-1);
for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++) RGRID.boxCells[j*N+i].push(bi);
}
if(typeof window!=='undefined') window.spatialIndexAddBox=spatialIndexAddBox;
// 去重戳当前容量 (与 RGRID.stampB/stampC 同步; 见 raycastWorld 的按需扩容)
let stampBLen=0, stampCLen=0;
const _rcP=V3(), _rcN=V3();
const _rcGnd={nx:0,ny:1,nz:0};   // 地面命中法线常量 (2026-11-01 性能批, 消费契约同 _rcResult)
const _rcResult={dist:0,point:null,normal:null,kind:null,cyl:null}; // 共享结果槽 (2026-09-06 B6/P1-6): 全库 28 调用点均即时消费不长期持有; cyl=命中圆柱引用 (2026-11-18 油桶殉爆批, 非 cyl 档恒 null)
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
if(bi>=BOXES.length) continue;   // ★2026-11-14 重开局批: 脏下标守卫 (同 eachBoxNear; rayBox 读 b.minX 对 undefined 必炸)
if(stampB[bi]===gen) continue;
stampB[bi]=gen;
// bulletPass (2026-11-17 弹道细化批): 带空隙的整体外接盒 (钢轨街垒等) 不再吃弹道 ——
// 挡坦克/挡人/挡寻路/挡飞机扫掠照旧 (那些消费点不读本标记), 只有 raycastWorld 这条
// 子弹/炮弹/视线/溅射遮挡的单一弹道口放行。
if(BOXES[bi].bulletPass) continue;
const r=rayBox(o,dir,BOXES[bi],best);
if(r){ best=r.t; bn=r; kind='box'; }
}
const cl=cylCells[idx];
for(let k=0;k<cl.length;k++){
const cy2=cl[k];
if(cy2>=CYLS.length) continue;   // ★2026-11-14 重开局批: 同上脏下标守卫
if(stampC[cy2]===gen) continue;
stampC[cy2]=gen;
if(CYLS[cy2].bulletPass) continue;   // 同上标记 (本批拒马圆柱未用此标记, 走 rayCyl 内 hb 逐梁细化)
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
for(const b of BOXES){ if(b.bulletPass) continue; const r=rayBox(o,dir,b,best); if(r){ best=r.t; bn=r; kind='box'; } }
for(const c of CYLS){ if(c.bulletPass) continue; const r=rayCyl(o,dir,c,best); if(r){ best=r.t; bn=r; kind='cyl'; } }
}
if(dir.y<0.35){
// 2026-11-13 性能批 C: 地面行军自适应步长 —— AI 视线/弹道射线 (dir.y<0.35) 旧版固定 1.8m 步进,
// 400m 射线最多 222 次 heightAt。新路径: 仅当 dir.y>=-0.35 且 maxD>30 且**连续两样本**都 (y-gh)>2.5m
// 才把步长升到 ≤4.5m, 并按净空封顶 st≤(clr-2.5)/max(-dir.y,0.05) ⇒ 本步内射线最低点仍 ≥ 上一地面
// 样本高+2.5m (下降量不超过净空余量, 浅俯角远射才提速); 一旦 (y-gh)<2.5 立即落回 1.8m 精扫。
// 命中二分括号 lo=t-lastStep (实际步长); 6 次二分在 4.5m 括号内收敛 0.07m ≤ 'ground' 档 0.35m 容差。
// box/cyl 档完全不动 (行军只产 'ground' 档)。window.RAYGND_OFF=true ⇒ 回退固定 1.8m 精扫 (旧路径原样保留)。
if(window.RAYGND_OFF||maxD<=30||dir.y<-0.35){
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
best=hi; bn=_rcGnd; kind='ground';   // 法线常量复用 (2026-11-01 性能批): 每条落地射线一个新对象是纯垃圾, bn 在 :107 即时消费
break;
}
t+=step;
}
}else{
let t=0.5, lastStep=1.8, prevClr=Infinity;
while(t<best){
const x=o.x+dir.x*t, y=o.y+dir.y*t, z=o.z+dir.z*t;
const gh=heightAt(x,z);
if(y<=gh){
let lo=t-lastStep, hi=t;
for(let i=0;i<6;i++){
const m=(lo+hi)/2;
(o.y+dir.y*m<=heightAt(o.x+dir.x*m,o.z+dir.z*m))?hi=m:lo=m;
}
best=hi; bn=_rcGnd; kind='ground';
break;
}
const clr=y-gh;
let st=1.8;
if(prevClr>2.5&&clr>2.5){
const dn=Math.max(0.05,-dir.y);
st=clamp((clr-2.5)/dn,1.8,4.5);
}
prevClr=clr;
lastStep=st;
t+=st;
}
}
}
if(!bn) return null;
_rcP.set(o.x+dir.x*best,o.y+dir.y*best,o.z+dir.z*best);
_rcN.set(bn.nx,bn.ny,bn.nz);
_rcResult.dist=best; _rcResult.point=_rcP; _rcResult.normal=_rcN; _rcResult.kind=kind;
_rcResult.cyl=(kind==='cyl'&&bn.cyl)?bn.cyl:null;   // 命中圆柱引用 (2026-11-18 油桶殉爆批): 仅 cyl 档携带 (bn 即 rayCyl 的 _rcR 槽, 每次命中改善即回写 = 恒为当前最优桶); ground/box/拒马 hb 档恒 null
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
if(bi>=BOXES.length) continue;   // ★2026-11-14 重开局批: 脏下标守卫 —— 索引重建前 (23b NAV.refresh(true)) 的窗口期, boxCells 可能仍持越界下标, 喂 fn(undefined) 会在回调里抛 TypeError
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
if(ci>=CYLS.length) continue;   // ★2026-11-14 重开局批: 同 eachBoxNear 脏下标守卫
if(ci<RQ.stampC.length){ if(RQ.stampC[ci]===gen) continue; RQ.stampC[ci]=gen; }
fn(CYLS[ci]);
}
}
}
// ── collideMove/standHeight 候选回调提升 (2026-11-01 性能批) ──
// 两函数都是每帧每移动单位调用, 旧版每次分配 2/1 个捕获闭包 (~120-160 个/帧 稳态)。
// 循环上下文经模块槽 _cmS/_shS 传递; 复用前提 (逐处已核): 两个回调体内不再进入 collideMove/
// standHeight (无重入路径), eachBoxNear/eachCylNear 独占传 fn, 不存在交叉迭代持有。
const _cmS={pos:null,radius:0};
// 横推纵带上界 = **眼线** pos.y+1.5 (2026-11-14 批③改, 原 2026-11-10 批为 头下0.06=HEAD_GRAZE):
// 底面在眼线以上的盒/柱一律按"头顶件"对待, 横推永不接管 —— 底面落在 (眼线, 头顶] 档的盒 (低梁/门楣/
// 站上护栏后头顶已探进的楼板) 若仍横推, 人在其 footprint 正中 (d≈0) 会走"最近边"分支被整只横向弹射
// 出墙外 (用户实报"护栏踩上再跳穿墙出去"的横推半边)。头顶件的竖直管辖全部归 headCeilClamp (上升
// 穿越窗) + headGrazeBlocked (起跳预检, 窗口 (眼线, 头顶])。
// ★首版教训 (2026-11-13 探针实锤): 曾在此加"天花板态压回底面之下" (pos.y=b.minY-1.7), 站立时头部已
//   探进盒带的场景每帧被压下→落地块拉回→起跳当帧被吃 = 人被钉死在地面 (②-1/②-5/②-7 全红 +
//   collideMove 单帧实锤 pos.y 被瞬移 -0.95m) —— 压回语义作废, 横推对头顶件只应"不作为"。
const HEAD_GRAZE=0.06;   // 留名: 2026-11-10 批擦碰带宽度, 现仅注释/判据引用, 横推双门已改眼线 1.5
function _cmBoxCb(b){
const pos=_cmS.pos, radius=_cmS.radius;
if(b.dead) return;
if(pos.y+1.5<b.minY||pos.y+0.25>b.maxY) return;
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
}
function _cmCylCb(c){
const pos=_cmS.pos, radius=_cmS.radius;
if(pos.y+1.5<c.y0||pos.y+0.2>c.y1) return;   // ★2026-11-14 批③改: 上界 HEAD_GRAZE线→眼线 (与 _cmBoxCb 同规)
// ★2026-11-05 实机反馈批 (用户实报"很多圆柱体的顶端无法站立, 一上去就被挤开"): 顶面跨步豁免, 与
//   _cmBoxCb 的 `b.maxY-pos.y<=0.56` 同规 —— 顶面在跨步档内不横推, 由 standHeight 的圆柱支撑抬上顶面。
//   旧版圆柱只有纵重叠门没有跨步豁免: 跳上桶/草垛/筒仓顶后脚下沉 0.2m 横推立即接管 = 被侧面挤飞。
if(c.y1-pos.y<=0.56) return;
let dx=pos.x-c.x, dz=pos.z-c.z;
const rr=c.r+radius, d2=dx*dx+dz*dz;
if(d2<rr*rr&&d2>1e-8){
const d=Math.sqrt(d2), push=(rr-d)/d;
pos.x+=dx*push; pos.z+=dz*push;
}
}
function collideMove(pos, radius){
// 查询半径=碰撞半径 (推挤只作用于表面距 pos<radius 的盒/柱, 候选矩形再留 0.02 采样余量)
const m=0.02;
_cmS.pos=pos; _cmS.radius=radius;
eachBoxNear(pos.x-radius-m,pos.z-radius-m,pos.x+radius+m,pos.z+radius+m,_cmBoxCb);
eachCylNear(pos.x-radius-m,pos.z-radius-m,pos.x+radius+m,pos.z+radius+m,_cmCylCb);
// (2026-11-10: 旧"大舰舰体硬墙"capPushBody 钩随大舰子系统下架摘除 —— 珊瑚海/铁底湾已归档)
// ★2026-09-26E (审计 28): 与 15d 同一支世界边缘单源 (旧值 MAP_SIZE/2+8 比网格边界只差 12m ⇒ 贴边即见断崖)
const lim=(typeof WORLD_ACTOR_LIMIT==='number')?WORLD_ACTOR_LIMIT:(MAP_SIZE/2+8);
pos.x=clamp(pos.x,-lim,lim); pos.z=clamp(pos.z,-lim,lim);
}
const _shS={x:0,z:0,curY:0,h:0};
function _shBoxCb(b){
if(b.dead||b.noTop) return;   // noTop (2026-11-16 批3.6): 树篱顶不可站 —— 顶面永不作支撑, 跳上去会
  //                          落进叶腔再被 _cmBoxCb 横推挤出; 侧面横推 (_cmBoxCb) 不受影响照常挡人
if(_shS.x>b.minX-0.05&&_shS.x<b.maxX+0.05&&_shS.z>b.minZ-0.05&&_shS.z<b.maxZ+0.05){
if(b.maxY<=_shS.curY+0.55&&b.maxY>_shS.h) _shS.h=b.maxY;
}
}
// 圆柱顶面支撑 (2026-11-05 实机反馈批, 与 _shBoxCb 同规): 采样点落在圆内 (+0.05 采样余量同盒档) 且
//   顶面够得着 (curY+0.55) ⇒ 脚下高度=顶面 —— 桶/草垛/筒仓/烟囱/水塔顶从此可站立 (旧版圆柱不供支撑,
//   站上去只在重力把脚沉到顶面下 0.2m 的瞬间被 _cmCylCb 横推挤飞 = 用户实报症状)。
function _shCylCb(c){
const dx=_shS.x-c.x, dz=_shS.z-c.z, rr=c.r+0.05;
if(dx*dx+dz*dz<=rr*rr){
if(c.y1<=_shS.curY+0.55&&c.y1>_shS.h) _shS.h=c.y1;
}
}
function standHeight(x,z,curY){
let h=heightAt(x,z);
// (2026-11-10: 旧"大舰甲板移动平台"capDeckY 钩随大舰子系统下架摘除)
_shS.x=x; _shS.z=z; _shS.curY=curY; _shS.h=h;
eachBoxNear(x-0.07,z-0.07,x+0.07,z+0.07,_shBoxCb);
eachCylNear(x-0.07,z-0.07,x+0.07,z+0.07,_shCylCb);
return _shS.h;
}
// ── 弹坑支撑面查询 (2026-11-18 弹坑批, 用户实报全局性"地板略高于地面时弹坑呈甜甜圈形", 如胡康大桥) ──
//   机理: 坑贴花逐顶点采样地形渲染弦面 (terrainSurfaceY), 爆点若在略高于地面的地板/桥面上, 坑盘体
//   (+0.05m) 整个沉在地板下面被遮死, 只有唇缘脊 (+0.13r≈0.2m) 高出地板露出来 = 环形。
//   修法: 逐顶点在"地形弦面 vs 盒顶支撑面"里取高者 —— 桥面/楼板/平台都是盒账, capY=爆点支撑高度
//   +0.45 ⇒ 上层楼板/更高桥面不误接。只查盒不查柱 (树干/电线杆的顶不该接坑), noTop (树篱顶) 同规跳过。
const _crTopS={x:0,z:0,capY:0,h:-1e9};
function _crTopCb(b){
if(b.dead||b.noTop) return;
if(_crTopS.x>b.minX-0.05&&_crTopS.x<b.maxX+0.05&&_crTopS.z>b.minZ-0.05&&_crTopS.z<b.maxZ+0.05){
if(b.maxY<=_crTopS.capY&&b.maxY>_crTopS.h) _crTopS.h=b.maxY;
}
}
function craterBoxTop(x,z,capY){
_crTopS.x=x; _crTopS.z=z; _crTopS.capY=capY; _crTopS.h=-1e9;
eachBoxNear(x-0.05,z-0.05,x+0.05,z+0.05,_crTopCb);
return _crTopS.h;
}
// ── 头顶天花板钳制 (2026-11-10 批, 用户实报"顶上有墙时跳跃会碰撞后穿模穿墙") ──
// 病根: 竖直方向只有 standHeight 落地支撑, 没有"天花板"概念 —— 跳跃上升段头顶 (pos.y+1.7, 与
// collideMove 纵带同参数) 一旦探进上方盒/柱的纵带, collideMove 的横推接管: 站在楼板正下方时
// XZ 距 footprint 中心 d≈0, 走"最近边"分支把人整只横向挤出 —— 表现为"一跳就被楼板撞开",
// 挤出量大时直接穿过相邻薄墙/落到楼板上面 (穿模穿墙)。修法 (用户裁定 "头碰到东西就适可而止"):
// 上升段先做头顶检测, 本帧头顶要探进底面就**就地停住** (钳到 底面-1.7, 调用方清垂直速度),
// 纵带永不重叠 ⇒ 横推永不接管。接线点=20-player 两条步兵积分路径 (步行 / TV制导本体);
// Bot 竖直走 dampF 贴地永不上升, 不接线。
// 底面穿越窗 = (上帧头顶, 本帧头顶] —— 底面低于上帧头顶的 (桌沿/已越过的槛) 不是本帧撞的
// 天花板 (那类盒与身体的纵带早已重叠, 由横推按"墙"处理); 重复小跳贴住天花板时 底面==上帧
// 头顶 也在窗内 ⇒ 钳位式不动 + 垂直速度清零, 头永不探入。
const _hcS={pos:null,r:0.42,prevHead:0,head:0,hit:0};
function _hcBoxCb(b){
const s=_hcS;
if(b.dead) return;
if(b.minY<s.prevHead||b.minY>s.head) return;
const cx=clamp(s.pos.x,b.minX,b.maxX), cz=clamp(s.pos.z,b.minZ,b.maxZ);
let dx=s.pos.x-cx, dz=s.pos.z-cz;
if(dx*dx+dz*dz<s.r*s.r&&b.minY<s.hit) s.hit=b.minY;
}
function _hcCylCb(c){
const s=_hcS;
if(c.y0<s.prevHead||c.y0>s.head) return;
let dx=s.pos.x-c.x, dz=s.pos.z-c.z;
const rr=c.r+s.r;
if(dx*dx+dz*dz<rr*rr&&c.y0<s.hit) s.hit=c.y0;
}
// rise=本帧上升位移 (调用点 vel.y*dt, 须 vel.y>0); 命中返回 true 并把 pos.y 钳到 底面-1.7
// (命中多个底面取最低者 —— 先撞到的就是最低天花板)。XZ 判定用与 collideMove 同一身体半径
// 0.42 (擦着楼板边缘起跳同样算"头碰到了", 与横推判定同口径)。
function headCeilClamp(pos,rise){
_hcS.pos=pos; _hcS.head=pos.y+1.7; _hcS.prevHead=_hcS.head-rise; _hcS.hit=Infinity;
eachBoxNear(pos.x-0.44,pos.z-0.44,pos.x+0.44,pos.z+0.44,_hcBoxCb);
eachCylNear(pos.x-0.44,pos.z-0.44,pos.x+0.44,pos.z+0.44,_hcCylCb);
if(_hcS.hit===Infinity) return false;
pos.y=_hcS.hit-1.7;
return true;
}
// ★2026-11-13b 批③ / 2026-11-14 改窗: 起跳预检 (只探不钳) —— 站立时头部**已探进**某个头顶盒/柱的
//   纵带 (其底面落在 (眼线, 头顶] = (pos.y+1.5, pos.y+1.7] 窗内, 闭含下端) 时禁止起跳。病根: 站上高物
//   (护栏顶等吃满房间净高) 后头顶已在楼板底面之上/之内, headCeilClamp 的"上升中底面穿越窗"永远错过
//   这条底面; 而 2026-11-14 起横推对头顶件整体不作为 (见 _cmBoxCb 注释) ⇒ 头顶再无任何管辖 = 起跳
//   直接从楼板中间穿出去。护栏几何档位核算: 护栏顶 h、楼板底 c ⇒ 头顶探进量 h+1.7-c ∈ (0,0.2] 当
//   h ∈ [c-1.7, c-1.5) —— 旧窗 [head-0.06, head] 只盖 6cm, 护栏 0.9~1.1 档大多漏网 (用户实报"大部分
//   有护栏的都有这个问题"), 放宽到整段 0.2m 全盖。护栏 ≤0.88 档 (05a 楼梯护栏统一压到 0.88) 头顶在
//   底面之下不在窗内, 起跳由 headCeilClamp 穿越窗正常接管 —— 双窗衔接无缝 (穿越窗管"从下往上撞",
//   本窗管"已在里面别再跳")。
function headGrazeBlocked(pos){
_hcS.pos=pos; _hcS.head=pos.y+1.7; _hcS.prevHead=pos.y+1.5; _hcS.hit=Infinity;
eachBoxNear(pos.x-0.44,pos.z-0.44,pos.x+0.44,pos.z+0.44,_hcBoxCb);
eachCylNear(pos.x-0.44,pos.z-0.44,pos.x+0.44,pos.z+0.44,_hcCylCb);
return _hcS.hit!==Infinity;
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
