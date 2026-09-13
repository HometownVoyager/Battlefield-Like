// ─────────────────────────────────────────────
// 04b-fire.js —— 可燃植被/火焰蔓延/树木倒伏/火源系统
// 载入顺序约束: 必须在 05c-layouts 之前 (buildWorld 在脚本载入期执行,
// tree()/bush() 等布置函数要向本模块的燃料表注册); 对 08-effects 的
// spawnP/PT 与 13/15/16 的实体表只在运行期函数体内引用, 无载入期依赖。
// ─────────────────────────────────────────────
'use strict';
// ===== 火焰网格: 全图均匀格子 (3m), 记录燃料量/燃烧态/受热 =====
// 燃料在世界构建期由植被注册: 灌木/草丛/庄稼/树篱/竹林/枯树; 树木单独按对象管理。
// 火源 (坦克残骸/坠机/燃烧弹) 点燃格子 → 格子烧完自身燃料并向邻格积热 → 蔓延。
const FRES=3;
const FN=Math.ceil((MAP_SIZE+40)/FRES)+1;
const FOFF=(MAP_SIZE+40)/2;
const FUEL=new Float32Array(FN*FN);
const FHEAT=new Float32Array(FN*FN);
const FBURN=new Float32Array(FN*FN);   // >0 = 燃烧已持续秒数
const FEXPIRE=new Float32Array(FN*FN); // 燃烧寿命上限(秒): 燃烧弹点燃的格提前强制熄灭, 蔓延继承 (0=不限, 残骸/树木火)
const FATT=new Array(FN*FN).fill(null); // 点火者 (击杀归属)
const FIRE_ACTIVE=[];                  // 正在燃烧的格子索引
const HEATED=[];                       // 受热但未燃的格子 (需要衰减)
const FIRE_SOURCES=[];                 // 持续火源: 坦克残骸/坠机
const FUEL_MAX=1.15;
const fCellI=(x,z)=>{
const i=clamp(Math.floor((x+FOFF)/FRES),0,FN-1), j=clamp(Math.floor((z+FOFF)/FRES),0,FN-1);
return j*FN+i;
};
function fuelAdd(x,z,amt){
const ci=fCellI(x,z);
if(FUEL[ci]<FUEL_MAX) FUEL[ci]=Math.min(FUEL_MAX,FUEL[ci]+amt);
}
// 火格 → 占用网格: 燃烧期间记占用, Bot/坦克寻路绕开火线 (buildOccupancy 重建时恢复)
function occMarkFire(ci){
if(!OCC.data) return;
const fx=(ci%FN)*FRES-FOFF, fz=Math.floor(ci/FN)*FRES-FOFF;
const i0=clamp(Math.floor((fx-1.4+OCC.off)/OCC.res),0,OCC.N-1), i1=clamp(Math.ceil((fx+1.4+OCC.off)/OCC.res),0,OCC.N-1);
const j0=clamp(Math.floor((fz-1.4+OCC.off)/OCC.res),0,OCC.N-1), j1=clamp(Math.ceil((fz+1.4+OCC.off)/OCC.res),0,OCC.N-1);
for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++) OCC.data[j*OCC.N+i]=1;
}
let fireNavT=0;
function igniteCell(ci,attacker,lifeCap){
if(FUEL[ci]<=0.05||FBURN[ci]>0) return;
FBURN[ci]=0.001;
FATT[ci]=attacker||null;
FEXPIRE[ci]=lifeCap||0;
FIRE_ACTIVE.push(ci);
HEATED.push(ci);
occMarkFire(ci);
if(fireNavT<=0) fireNavT=5;
}
function igniteArea(x,z,r,attacker,lifeCap){
const ci0=fCellI(x,z), n=Math.ceil(r/FRES);
const cx0=ci0%FN, cz0=Math.floor(ci0/FN);
for(let dj=-n;dj<=n;dj++)for(let di=-n;di<=n;di++){
const i=clamp(cx0+di,0,FN-1), j=clamp(cz0+dj,0,FN-1);
const ci=j*FN+i;
if(FUEL[ci]<=0.05||FBURN[ci]>0) continue;
const wx=(ci%FN)*FRES-FOFF+FRES/2, wz=j*FRES-FOFF+FRES/2;
const dx=wx-x, dz=wz-z;
if(dx*dx+dz*dz<=(r+1.4)*(r+1.4)) igniteCell(ci,attacker,lifeCap);
}
}
// ===== 持续火源 (坦克残骸/坠机残骸): 自身喷射火焰 + 点燃周围植被 + 灼烧圈内单位 =====
function addFireSource(x,z,y,r,ttl,dps,attacker){
const s={x,z,y,r,ttl,dps,attacker:attacker||null,acc:0,smk:0,igniteT:0};
FIRE_SOURCES.push(s);
return s; // 返回源对象: 残骸开始沉入地下时 removeFireSource 提前熄火
}
function removeFireSource(s){
if(!s) return;
const i=FIRE_SOURCES.indexOf(s);
if(i>=0) FIRE_SOURCES.splice(i,1);
}
// ===== 火情查询 (Bot 躲避/选点用): 距最近燃烧格/火源圈的净距 < clear 即视为威胁 =====
// 返回 {dx,dz} 指向最近火心的向量 (bot 据此背火逃离), 无火 null。clear=需保持的净距(m):
// bot 逃命触发 2.0 / 掩体与驻守点过滤 2.8 (格心半宽~2, 即距格心 >4.8m 才算安全落点)
function fireThreat(x,z,clear){
let bd=1e9, bx=0, bz=0;
const n=Math.ceil((clear+3)/FRES);
const ci0=fCellI(x,z), cx0=ci0%FN, cz0=Math.floor(ci0/FN);
for(let dj=-n;dj<=n;dj++)for(let di=-n;di<=n;di++){
const i=cx0+di, j=cz0+dj;
if(i<0||j<0||i>=FN||j>=FN) continue;
const ci=j*FN+i;
if(FBURN[ci]<=0) continue;
const fx=(ci%FN)*FRES-FOFF+FRES/2, fz=j*FRES-FOFF+FRES/2;
const dd=Math.hypot(x-fx,z-fz)-2.0;
if(dd<bd){ bd=dd; bx=fx; bz=fz; }
}
for(const s of FIRE_SOURCES){
const dd=Math.hypot(x-s.x,z-s.z)-s.r;
if(dd<bd){ bd=dd; bx=s.x; bz=s.z; }
}
if(bd>clear) return null;
return {dx:bx-x, dz:bz-z};
}
const TREE_LIVE=[];        // 活树记录 (flushTreeBatch 回填实例索引); 数组本体仅沙箱断言读 (verify-fire/verify-sink), 逐树状态走 floraHash
const FLORA_HASH=new Map(); // 3m 格 → 植被记录数组 (碾压/爆炸/点燃查询)
function floraHashAdd(rec){
const ci=fCellI(rec.x,rec.z);
let arr=FLORA_HASH.get(ci);
if(!arr){ arr=[]; FLORA_HASH.set(ci,arr); }
arr.push(rec);
}
function floraNear(x,z,r,cb){
const ci0=fCellI(x,z), n=Math.ceil(r/FRES);
const cx0=ci0%FN, cz0=Math.floor(ci0/FN);
for(let dj=-n;dj<=n;dj++)for(let di=-n;di<=n;di++){
const i=clamp(cx0+di,0,FN-1), j=clamp(cz0+dj,0,FN-1);
const arr=FLORA_HASH.get(j*FN+i);
if(!arr) continue;
for(const rec of arr){ if(!rec.dead) cb(rec); }
}
}
function killCyl(c){
if(!c) return;
c.dead=true; c.r=0; c.y1=c.y0-1;
}
// ===== 灌木: 两片交叉叶面 (并入独立 InstancedMesh), 无碰撞, 可燃/可碾 =====
const BUSH_BATCH=[];
const BUSH_LIVE=[];        // 灌木记录: 逐株状态经 floraHash 供燃烧/碾压读写; 数组本体仅沙箱断言读 (verify-fire/verify-sink)
function bush(x,z,s=1){
if(!propFree(x,z,0.8*s)) return;
propTake(x,z,0.8*s);
const g0=heightAt(x,z)-0.05;
const yaw0=wr(0,Math.PI);
const inst=[[yaw0,wr(-0.2,0.2),s*wr(0.4,0.58)],[yaw0+HPI+wr(-0.2,0.2),wr(-0.25,0.1),s*wr(0.4,0.58)]];
BUSH_BATCH.push({x,z,s,g0,inst});
fuelAdd(x,z,1.0);
}
let BUSH_IM=null;
function flushBushes(){
if(!BUSH_BATCH.length) return;
const n=BUSH_BATCH.length;
BUSH_IM=new THREE.InstancedMesh(treeLeafGeo,MAT.leaves,n*2);
BUSH_IM.castShadow=false; BUSH_IM.receiveShadow=false;
BUSH_IM.frustumCulled=false;
const _m=new THREE.Matrix4(), _p=new THREE.Vector3(), _q=new THREE.Quaternion(), _e=new THREE.Euler(), _s=new THREE.Vector3();
BUSH_BATCH.forEach((b,bi)=>{
const rec={kind:'bush',x:b.x,z:b.z,s:b.s,g0:b.g0,im:BUSH_IM,li0:bi*2,alive:true,dead:false};
b.inst.forEach(([ry,rx,ls],k)=>{
_p.set(b.x,b.g0+0.62*b.s,b.z);
_e.set(rx,ry,0); _q.setFromEuler(_e); _s.setScalar(ls);
_m.compose(_p,_q,_s);
BUSH_IM.setMatrixAt(bi*2+k,_m);
});
BUSH_LIVE.push(rec);
floraHashAdd(rec);
});
world.add(BUSH_IM);
BUSH_BATCH.length=0;
}
// ===== 灌木散布: 各布局通用 (密度随主题草量/画质缩放), 避开道路/河道/田块/旗点/建筑 =====
const BURN_INST=[]; // {im, byCell:Map} —— 烧毁后按格隐藏的实例批 (草丛/庄稼)
function scatterBushes(){
if(CAMPAIGN.city) return; // 城市组: 无灌木 (瓦砾/街垒为掩体语言)
const q=SETTINGS.quality===0?0.6:(SETTINGS.quality===1?0.85:1);
const n=Math.round(150*THEME.grassMul*q);
const TR3=MAP_SIZE/2-10;
let placed=0;
for(let i=0;i<n*3&&placed<n;i++){
const x=wr(-TR3,TR3), z=wr(-TR3,TR3);
if(roadDist(x,z)<5) continue;
if(inRiverChannel(x,z)) continue;
if(RURAL_FIELDS.length&&fieldAt(x,z)) continue;
if(CROP_FIELDS.length) { // 庄稼软遮蔽田内不落灌木 (保持田块整洁)
let inCrop=false;
for(const f of CROP_FIELDS){ if(x>f.x0-1&&x<f.x1+1&&z>f.z0-1&&z<f.z1+1){ inCrop=true; break; } }
if(inCrop) continue;
}
let near=false;
for(const f of CAMPAIGN.flags){ if(Math.hypot(x-f.x,z-f.z)<f.r+6){ near=true; break; } }
if(near) continue;
if(!freeSpot(x,z,1.2)) continue;
bush(x,z,wr(0.8,1.5));
placed++;
}
flushBushes();
}
// 注册草丛/庄稼实例批: 烧毁时按格零缩放隐藏
function registerBurnableInst(im,byCell){
BURN_INST.push({im,byCell,dirty:false});
}
// ===== 植被消失 (烧尽/被炸/被碾): 碰撞即死, 视觉残留 → 停留一段时间后沉入地下消失 =====
// 各类植被沉入深度 (盖过自身高度): 灌木矮/竹丛高
const FLORA_SINK_DEPTH={bush:1.9,fern:1.6,hedge:3.8,dead:4.6,bamboo:8.4};
function vanishFlora(rec,blasted){
if(rec.dead) return;
rec.dead=true; rec.alive=false;
if(rec.box) killBox(rec.box);
if(rec.cyl){ killCyl(rec.cyl); if(typeof markNavDirty==='function') markNavDirty(); }
// 视觉残留: 停留数秒后沉入地下 (残株逐渐没入土中, 全沉后删除)
if(rec.kind==='bush'&&rec.im){
queueSink({inst:{im:rec.im,idxs:[rec.li0,rec.li0+1]},depth:FLORA_SINK_DEPTH.bush,rest:rand(4,8),sink:2.2});
} else if(rec.meshes){
const ms=rec.meshes.filter(m=>m&&m.parent);
if(ms.length) queueSink({objs:ms,depth:FLORA_SINK_DEPTH[rec.kind]||3.2,rest:rand(4,8),sink:2.4});
}
const gy=heightAt(rec.x,rec.z);
for(let k=0;k<(blasted?6:4);k++){
spawnP(blasted?PT.dirt:PT.smoke,rec.x+rand(-0.5,0.5),gy+rand(0.2,0.9),rec.z+rand(-0.5,0.5),rand(-1.2,1.2),rand(0.6,1.8),rand(-1.2,1.2),rand(0.3,0.6),0.8,rand(0.4,0.8),0.8,blasted?4:0.5);
}
if(blasted) for(let k=0;k<3;k++) spawnP(PT.spark,rec.x,gy+0.5,rec.z,rand(-3,3),rand(1,4),rand(-3,3),0.12,-0.05,rand(0.2,0.4),1,6,true);
}
// ===== 树木倒伏 =====
const FALLING=[];      // 倒伏动画中的树
const BURNING_TREES=[]; // 树冠着火的树
function treeFall(tr,dx,dz){
if(tr.fall||!tr.alive) return;
tr.alive=false;
killCyl(tr.cyl);
const l=Math.hypot(dx,dz);
if(l<0.05){ const a=rand(0,TAU); dx=Math.sin(a); dz=Math.cos(a); }
else { dx/=l; dz/=l; }
tr.fall={t:0,dx,dz,dur:rand(0.9,1.2)*(0.7+0.35*tr.s),hit:false}; // 大树惯性大, 倒得略慢
FALLING.push(tr);
const gy=tr.g0+0.25;
for(let k=0;k<5;k++) spawnP(PT.dirt,tr.x+rand(-0.6,0.6),gy,tr.z+rand(-0.6,0.6),dx*rand(1,2.5)+rand(-1,1),rand(0.5,1.5),dz*rand(1,2.5)+rand(-1,1),rand(0.25,0.5),0.7,rand(0.5,0.9),0.85,3);
// 不触发寻路重建: 倒树不挡路, 残干占位留到下次重建自然放行 (碾林/连倒时避免高频 rebake)
}
function treeIgnite(tr,attacker){
if(tr.burnT>=0||(!tr.alive&&!tr.fall)) return;
if(tr.burnT<0){
tr.burnT=0;
tr.burnDur=rand(2.6,4.4);
tr.igniter=attacker||null;
tr.fT=0; tr.iT=0;
BURNING_TREES.push(tr);
}
}
let _fm=null,_fp=null,_fs=null,_fq=null,_fq2=null,_fa=null,_fe=null,_fc=null,_charCol=null;
function fireTmp(){
if(_fm) return;
_fm=new THREE.Matrix4(); _fp=new THREE.Vector3(); _fs=new THREE.Vector3();
_fq=new THREE.Quaternion(); _fq2=new THREE.Quaternion(); _fa=new THREE.Vector3();
_fe=new THREE.Euler(); _fc=new THREE.Vector3(); _charCol=new THREE.Color(0x241d16);
}
function treeInstanceMatrices(tr,th,dy=0){
fireTmp();
// 绕根部水平轴旋转: 轴=(dz,0,-dx) —— 树冠倒向 (dx,dz); dy=整体垂直偏移 (残骸沉入地下用)
// 2026-09-12 修复: 锚点位置与实例姿态必须同转 —— 旧版只旋转锚点、姿态恒竖直,
// 倒伏全程树干/叶面保持直立沿弧线"滑行", 观感诡异; 现按同一轴角写出旋转四元数
// (trunk 直接套用, 叶面 premultiply 叠加在原朝向之上), 呈现真实翻倒。
const ax=_fa.set(tr.fall.dz,0,-tr.fall.dx);
_fq.setFromAxisAngle(ax,th);
const cs=Math.cos(th), sn=Math.sin(th);
const px=tr.x, py=tr.g0, pz=tr.z;
const rot=(ox,oy,oz,out)=>{
out.set(
px+ox*cs+(ax.y*oz-ax.z*oy)*sn+ax.x*(ax.x*ox+ax.y*oy+ax.z*oz)*(1-cs),
py+oy*cs+(ax.z*ox-ax.x*oz)*sn+ax.y*(ax.x*ox+ax.y*oy+ax.z*oz)*(1-cs),
pz+oz*cs+(ax.x*oy-ax.y*ox)*sn+ax.z*(ax.x*ox+ax.y*oy+ax.z*oz)*(1-cs)
);
return out;
};
const im=TREE_IM.trunks;
rot(0,2.2*tr.s,0,_fp); _fp.y+=dy;
_fm.compose(_fp,_fq,_fs.setScalar(tr.s));
im.setMatrixAt(tr.ti,_fm);
const lm=TREE_IM.leaves;
if(!tr.charred) for(let i=0;i<3;i++){
rot(0,(3.4+i*0.6)*tr.s,0,_fp); _fp.y+=dy;
_fe.set(tr.lf[i][1],tr.lf[i][0],0);
_fq2.setFromEuler(_fe);
_fq2.premultiply(_fq);
_fm.compose(_fp,_fq2,_fs.setScalar(tr.lf[i][2]));
lm.setMatrixAt(tr.li+i,_fm);
}
im.instanceMatrix.needsUpdate=true;
lm.instanceMatrix.needsUpdate=true;
// 燃烧树冠世界坐标 (火焰跟随)
rot(0,3.6*tr.s,0,_fc); _fc.y+=dy;
tr.cx=_fc.x; tr.cy=_fc.y; tr.cz=_fc.z;
}
// 触地瞬间: 树冠沿线扬尘 + 近距离镜头轻震 (倒伏的"重量感")
function treeFallImpact(tr){
const f=tr.fall, gy=tr.g0+0.25, reach=3.4*tr.s;
for(let k=0;k<6;k++){
const rr=reach*rand(0.55,1.05);
spawnP(PT.dirt,tr.x+f.dx*rr+rand(-0.8,0.8),gy+rand(0.1,0.5),tr.z+f.dz*rr+rand(-0.8,0.8),f.dx*rand(0.5,1.4)+rand(-0.8,0.8),rand(0.4,1.1),f.dz*rand(0.5,1.4)+rand(-0.8,0.8),rand(0.3,0.6),0.8,rand(0.5,0.9),0.85,3);
}
spawnP(PT.smoke,tr.x+f.dx*reach*0.7,gy+0.5,tr.z+f.dz*reach*0.7,f.dx*0.4,0.7,f.dz*0.4,1.2,1.6,rand(0.9,1.4),0.5,0.1);
if(Math.hypot(tr.x-camera.position.x,tr.z-camera.position.z)<25&&typeof addTrauma==='function') addTrauma(0.08);
}
function updateFallingTrees(dt){
for(let i=FALLING.length-1;i>=0;i--){
const tr=FALLING[i];
const f=tr.fall;
f.t+=dt;
let th;
if(f.t<f.dur){
const k=f.t/f.dur;
// 角加速 (重力矩随倾角增大越倒越快) 但掺 25% 线性项: 纯 k² 起步前 ~0.4s 倾角近乎为零,
// 观感像"碾压后隔了很久才倒"; 现接触后 0.2s 内即可见树头倾斜
th=1.5*k*(0.75*k+0.25);
}else{
if(!f.hit){ f.hit=true; treeFallImpact(tr); }
// 触地回弹: 树冠砸地后树干小幅回弹震荡并快速衰减 (只向直立侧回弹, 避免砸进地里)
const u=f.t-f.dur;
th=clamp(1.5-0.09*Math.exp(-3.5*u)*Math.sin(10.5*u),1.32,1.5);
}
treeInstanceMatrices(tr,th);
if(f.t>=f.dur+0.7){
tr.restCrown={x:tr.cx||tr.x,y:tr.cy||tr.g0+3.4*tr.s,z:tr.cz||tr.z};
FALLING.splice(i,1);
// 倒树残骸登记沉入: 原地停留一段时间后连干带冠沉入地下 (见 updateTreeSinks)
scheduleTreeSink(tr);
}
}
}
// ===== 倒树残骸沉入: 停留 16~22s 后 3.6s 匀速沉入地下, 全沉后实例零缩放删除 =====
const TREE_SINKS=[];
function scheduleTreeSink(tr){
if(tr.sinkQ) return;
tr.sinkQ=true;
TREE_SINKS.push({tr,t:0,rest:rand(16,22),dur:3.6});
}
function updateTreeSinks(dt){
for(let i=TREE_SINKS.length-1;i>=0;i--){
const s=TREE_SINKS[i];
s.t+=dt;
if(s.t<s.rest) continue;
const k=Math.min(1,(s.t-s.rest)/s.dur);
treeInstanceMatrices(s.tr,1.5,-3.6*k);
if(k>=1){
// 全沉: 树干/叶面实例零缩放删除, 记录标死 (floraNear 不再返回该树)
fireTmp();
_fm.makeScale(0,0,0);
TREE_IM.trunks.setMatrixAt(s.tr.ti,_fm);
const lm=TREE_IM.leaves;
for(let k2=0;k2<3;k2++) lm.setMatrixAt(s.tr.li+k2,_fm);
TREE_IM.trunks.instanceMatrix.needsUpdate=true;
lm.instanceMatrix.needsUpdate=true;
s.tr.dead=true;
TREE_SINKS.splice(i,1);
}
}
}
function updateBurningTrees(dt){
fireTmp();
for(let i=BURNING_TREES.length-1;i>=0;i--){
const tr=BURNING_TREES[i];
tr.burnT+=dt;
const crown=(tr.restCrown||(tr.fall?{x:tr.cx||tr.x,y:tr.cy||tr.g0+2,z:tr.cz||tr.z}:{x:tr.x,y:tr.g0+3.6*tr.s,z:tr.z}));
tr.fT-=dt;
if(tr.fT<=0){
tr.fT=rand(0.1,0.2);
if(crown.y!==undefined&&Math.hypot(crown.x-camera.position.x,crown.z-camera.position.z)<110){
// 树冠火同样加大火头 (与地面植被火焰观感一致)
spawnP(PT.flash,crown.x+rand(-0.8,0.8)*tr.s,crown.y+rand(-0.4,0.6),crown.z+rand(-0.8,0.8)*tr.s,rand(-0.4,0.4),rand(1.2,2.4),rand(-0.4,0.4),rand(1.0,1.7),1.7,rand(0.3,0.55),0.85,-1,true);
if(Math.random()<0.4) spawnP(PT.dark,crown.x,crown.y+1,crown.z,rand(-0.4,0.4),rand(1,2),rand(-0.4,0.4),1.0,1.7,rand(1.2,2),0.5,0.1);
}
}
tr.iT-=dt;
if(tr.iT<=0){
tr.iT=0.5;
igniteArea(tr.x,tr.z,2.2,tr.igniter);
}
if(!tr.fall&&tr.burnT>tr.burnDur){
const a=rand(0,TAU);
treeFall(tr,Math.sin(a),Math.cos(a));
}
	if(tr.fall&&!FALLING.includes(tr)&&tr.burnT>tr.burnDur+2.6){
	// 烧尽: 树冠消失, 树干焦黑留在原地 (残骸随后与倒树一同沉入地下)
	const lm=TREE_IM.leaves;
	for(let k2=0;k2<3;k2++){ _fm.makeScale(0,0,0); lm.setMatrixAt(tr.li+k2,_fm); }
	lm.instanceMatrix.needsUpdate=true;
	TREE_IM.trunks.setColorAt(tr.ti,_charCol);
	TREE_IM.trunks.instanceColor.needsUpdate=true;
	tr.charred=true;
	spawnP(PT.smoke,tr.x,tr.g0+0.5,tr.z,0,1,0,1.4,2,rand(1.5,2.5),0.6,0.1);
	BURNING_TREES.splice(i,1);
	scheduleTreeSink(tr);
	}
}
}
// ===== 爆炸对植被: 近处树直接吹倒 (倒向背离爆心), 中距累积伤害, 灌木类直接炸没 =====
function explosionFlora(p,radius){
if(radius<=0) return;
const hits=[];
floraNear(p.x,p.z,radius+3,rec=>hits.push(rec));
for(const rec of hits){
const d=Math.hypot(rec.x-p.x,rec.z-p.z);
if(rec.kind==='tree'){
if(!rec.alive) continue;
if(d<radius*0.75+0.9){
treeFall(rec,rec.x-p.x+rand(-0.5,0.5),rec.z-p.z+rand(-0.5,0.5));
}else if(d<radius+2.6){
rec.dmg=(rec.dmg||0)+1;
if(rec.dmg>=2){
const a=rand(0,TAU);
treeFall(rec,Math.sin(a),Math.cos(a));
}
}
}else if(d<radius*0.85){
vanishFlora(rec,true);
}
}
}
// ===== 坦克碾压: 车体碰到树/枯树 → 撞倒/碾碎; 灌木直接碾没 =====
// 距离度量与 15-vehicles 的三圆碰撞模型对齐 (舱段 ±1.95 + 圆半径 1.55):
// 取"树干中心到车体轴向舱段的垂距"。旧版按坦克中心到树心的距离判定 (阈值~2.2m),
// 而树干圆柱在车头圆处 (中心距 ~3.5-3.8m) 就把坦克拦停减速 —— 正面冲撞永远够不到
// 碾压半径, 只有侧身擦过 (圆柱推挤沿径向、不减速前进) 才偶发触发, 行为不一致。
// 现改为车体接触即撞倒: 阈值略大于圆柱拦截半径 (1.5+c.r), 同帧先碾倒再杀碰撞体,
// 正面/侧面/倒车行为一致。倒向 = 车辆运动方向 (倒车撞树则向车尾倒)。
function floraCrushTank(t){
if(Math.abs(t.vel)<0.8) return;
const sn=Math.sin(t.yaw), cs=Math.cos(t.yaw);
const hits=[];
floraNear(t.pos.x,t.pos.z,4.5,rec=>hits.push(rec));
const mv=Math.sign(t.vel)||1;
let hitAny=false;
for(const rec of hits){
const rx=rec.x-t.pos.x, rz=rec.z-t.pos.z;
const aRaw=rx*sn+rz*cs;
const aC=clamp(aRaw,-1.95,1.95);
const d=Math.hypot(rx-sn*aC,rz-cs*aC);
// 各向异性接触半径: 树在舱段端点之外 (正对车头/车尾) 用鼻端精确半径 1.55 (与三圆碰撞模型一致,
// 不提前压树); 树在车身侧旁用 1.9 (贴合履带/挡泥板视觉半宽 ~2.0, 旧版侧擦可碾的量级)
const rad=(Math.abs(aRaw)>1.95?1.55:1.9);
if(rec.kind==='tree'){
if(!rec.alive) continue;
if(d<rad+0.35*rec.s){
treeFall(rec,sn*mv+rand(-0.2,0.2),cs*mv+rand(-0.2,0.2));
hitAny=true;
spawnP(PT.dirt,rec.x,rec.g0+0.6,rec.z,rand(-1.5,1.5),rand(1,3),rand(-1.5,1.5),0.3,0.6,0.5,0.85,3);
}
}else if(rec.kind==='dead'){
// 枯树 (无叶枯木): 一碰即碎 —— 同样按车体接触判定, 不再被树干圆柱拦在触碰距离外
if(d<rad+0.3){
vanishFlora(rec,false);
hitAny=true;
spawnP(PT.dirt,rec.x,rec.g0+0.5,rec.z,rand(-1.5,1.5),rand(1,2.5),rand(-1.5,1.5),0.3,0.6,0.5,0.85,3);
}
}else if(d<2.0){
vanishFlora(rec,false);
hitAny=true;
}
}
if(hitAny){
t.vel*=0.94;
t.suspPV=(t.suspPV||0)-Math.sign(t.vel)*0.12;
if(t.playerDriven&&typeof addTrauma==='function') addTrauma(0.1);
}
}
// ===== 火焰网格主更新 =====
const FFX=new Float32Array(FN*FN); // 每格火苗喷发计时
let fireDmgT=0, fireFlameN=0;
function updateFires(dt){
fireFlameN=0;
// ── 持续火源 ──
for(let i=FIRE_SOURCES.length-1;i>=0;i--){
const s=FIRE_SOURCES[i];
s.ttl-=dt;
if(s.ttl<=0){ FIRE_SOURCES.splice(i,1); continue; }
s.acc-=dt;
if(s.acc<=0){
s.acc=rand(0.08,0.16);
const dCam=Math.hypot(s.x-camera.position.x,s.z-camera.position.z);
if(dCam<130){
spawnP(PT.flash,s.x+rand(-0.8,0.8),s.y+rand(0,0.6),s.z+rand(-0.8,0.8),rand(-0.3,0.3),rand(1.4,2.6),rand(-0.3,0.3),rand(0.6,1.1),1.6,rand(0.25,0.45),0.9,-1,true);
if(Math.random()<0.5) spawnP(PT.dark,s.x+rand(-0.7,0.7),s.y+0.8,s.z+rand(-0.7,0.7),rand(-0.3,0.3),rand(1,2),rand(-0.3,0.3),0.9,1.7,rand(1.2,2.2),0.55,0.1);
if(SETTINGS.quality>=1&&Math.random()<0.5) spawnP(PT.spark,s.x,s.y+0.4,s.z,rand(-2,2),rand(2,5),rand(-2,2),0.1,-0.03,rand(0.3,0.7),1,4,true);
}
}
s.igniteT-=dt;
if(s.igniteT<=0){
s.igniteT=0.7;
igniteArea(s.x,s.z,s.r*0.85,s.attacker);
}
}
// ── 燃烧格子: 耗燃料/积热蔓延/视觉 ──
for(let i=FIRE_ACTIVE.length-1;i>=0;i--){
const ci=FIRE_ACTIVE[i];
let age=FBURN[ci]+dt;
FBURN[ci]=age;
FUEL[ci]-=dt*0.12;
// 寿命上限: 燃烧弹火系到点强制熄灭 (满燃料格自然烧尽需 ~8.4-9.6s, 上限使其提前熄火)
if(FEXPIRE[ci]>0&&age>=FEXPIRE[ci]) FUEL[ci]=0;
const cx=(ci%FN)*FRES-FOFF+FRES/2, cz=Math.floor(ci/FN)*FRES-FOFF+FRES/2;
// 向 8 邻格积热 (斜向减半): 受热≥0.8 且有燃料 → 蔓延
// 参数按"稀草也能成链"校验: 邻格净受热≈0.6/s, 草格烧尽前(~2-4s)必引燃下一格
const cxi=ci%FN, czi=(ci/FN)|0;
for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){
if(!di&&!dj) continue;
const ni=cxi+di, nj=czi+dj;
if(ni<0||nj<0||ni>=FN||nj>=FN) continue;
const nj2=nj*FN+ni;
if(FBURN[nj2]>0||FUEL[nj2]<=0.05) continue;
if(!FHEAT[nj2]) HEATED.push(nj2);
FHEAT[nj2]+=dt*(di&&dj?0.42:0.85);
if(FHEAT[nj2]>=0.8) igniteCell(nj2,FATT[ci],FEXPIRE[ci]);
}
// 视觉: 距相机近时喷火苗 (每格独立计时, 每帧总量限流)
FFX[ci]-=dt;
if(age>0.12&&FFX[ci]<=0&&fireFlameN<14){
const dCam=Math.hypot(cx-camera.position.x,cz-camera.position.z);
if(dCam<95){
FFX[ci]=rand(0.14,0.32);
fireFlameN++;
const gy=heightAt(cx,cz);
const inten=clamp(FUEL[ci],0.25,1);
// 2026-09-02 植被火焰加大: 火头体积/蹿升速度/滞空提升, 燃烧观感更醒目 (与燃烧弹缩短存在时间配合)
spawnP(PT.flash,cx+rand(-1.1,1.1),gy+rand(0.15,0.8),cz+rand(-1.1,1.1),rand(-0.3,0.3),rand(1.2,2.6)*inten+0.6,rand(-0.3,0.3),rand(0.8,1.3)*inten+0.4,1.6,rand(0.32,0.55),0.85,-1.4,true);
if(Math.random()<0.3) spawnP(PT.dark,cx,gy+0.8,cz+rand(-0.5,0.5),rand(-0.3,0.3),rand(0.8,1.6),rand(-0.3,0.3),0.95,1.7,rand(1,1.8),0.45,0.1);
else if(SETTINGS.quality>=1&&Math.random()<0.35) spawnP(PT.spark,cx,gy+0.4,cz,rand(-1.5,1.5),rand(1.5,4),rand(-1.5,1.5),0.09,-0.03,rand(0.25,0.55),1,3,true);
}
}
// 烧尽: 清格 + 该格植被视觉消失 (草丛/灌木/庄稼/枯树等)
if(FUEL[ci]<=0){
FUEL[ci]=0; FBURN[ci]=0; FHEAT[ci]=0;
FEXPIRE[ci]=0;
FATT[ci]=null;
FIRE_ACTIVE[i]=FIRE_ACTIVE[FIRE_ACTIVE.length-1]; FIRE_ACTIVE.pop();
const cx2=(ci%FN)*FRES-FOFF+FRES/2, cz2=Math.floor(ci/FN)*FRES-FOFF+FRES/2;
const gy2=heightAt(cx2,cz2);
if(Math.hypot(cx2-camera.position.x,cz2-camera.position.z)<90){
spawnP(PT.dark,cx2,gy2+0.5,cz2,rand(-0.2,0.2),rand(0.8,1.4),rand(-0.2,0.2),1.0,1.8,rand(1.4,2.2),0.5,0.1);
}
	// 草丛/庄稼实例: 烧尽后残株停留数秒, 随后沉入地下消失 (原为零缩放瞬隐)
	for(const bi of BURN_INST){
	const arr=bi.byCell.get(ci);
	if(arr&&arr.length){
	queueSink({inst:{im:bi.im,idxs:arr},depth:1.6,rest:rand(3.5,6.5),sink:2.0});
	bi.byCell.delete(ci);
	}
	}
// 格内灌木等对象植被消失
const arr=FLORA_HASH.get(ci);
if(arr) for(const rec of arr) if(!rec.dead&&rec.kind!=='tree') vanishFlora(rec,false);
if(fireNavT<=0) fireNavT=5;
}
}
// ── 受热衰减 ──
for(let i=HEATED.length-1;i>=0;i--){
const ci=HEATED[i];
if(FBURN[ci]>0){ FHEAT[ci]=0; HEATED[i]=HEATED[HEATED.length-1]; HEATED.pop(); continue; }
FHEAT[ci]-=dt*0.25;
if(FHEAT[ci]<=0){ FHEAT[ci]=0; HEATED[i]=HEATED[HEATED.length-1]; HEATED.pop(); }
}
// ── 火点燃树木: 低频扫描燃烧格附近树冠 (树不占燃料格, 由格子引燃) ──
fireDmgT-=dt;
if(fireDmgT<=0){
fireDmgT=0.4;
treeIgnitePass();
fireDamageTick();
}
if(fireNavT>0){
fireNavT-=dt;
if(fireNavT<=0&&typeof markNavDirty==='function') markNavDirty();
}
// 倒树/沉树残骸动画 (与火同帧推进, 避免在 24-main 另挂更新点)
updateTreeSinks(dt);
}
function treeIgnitePass(){
const seen=new Set();
for(const ci of FIRE_ACTIVE){
const cx=(ci%FN)*FRES-FOFF+FRES/2, cz=Math.floor(ci/FN)*FRES-FOFF+FRES/2;
floraNear(cx,cz,3.2,rec=>{
if(rec.kind!=='tree'||seen.has(rec)) return;
seen.add(rec);
const d=Math.hypot(rec.x-cx,rec.z-cz);
if(d<3.0&&rec.alive&&rec.burnT<0) treeIgnite(rec,FATT[ci]);
});
}
}
// 火焰伤害: 燃烧格/火源圈内的步兵 (含玩家) 与坦克持续掉血, 击杀归点火者
function fireDamageTick(){
for(const s of combatants){
if(!s.alive||s.onVehicle) continue;
let att=null, fireDmg=0;
const ci0=fCellI(s.pos.x,s.pos.z);
const cxi=ci0%FN, czi=(ci0/FN)|0;
for(let dj=-1;dj<=1&&!fireDmg;dj++)for(let di=-1;di<=1;di++){
const ni=cxi+di, nj=czi+dj;
if(ni<0||nj<0||ni>=FN||nj>=FN) continue;
const ci=nj*FN+ni;
if(FBURN[ci]<=0) continue;
const cx=(ci%FN)*FRES-FOFF+FRES/2, cz=Math.floor(ci/FN)*FRES-FOFF+FRES/2;
if(Math.hypot(s.pos.x-cx,s.pos.z-cz)<2.7){ fireDmg=5.2; att=FATT[ci]; break; }
}
if(!fireDmg){
for(const fs of FIRE_SOURCES){
if(Math.hypot(s.pos.x-fs.x,s.pos.z-fs.z)<fs.r+0.4&&Math.abs((s.pos.y||0)-fs.y)<3.5){ fireDmg=fs.dps*0.4; att=fs.attacker; break; }
}
}
if(!fireDmg) continue;
s.damage(fireDmg,att,false);
if(s.isPlayer){ addTrauma(0.12); }
if(Math.hypot(s.pos.x-camera.position.x,s.pos.z-camera.position.z)<80){
const gy=s.pos.y||heightAt(s.pos.x,s.pos.z);
spawnP(PT.flash,s.pos.x+rand(-0.25,0.25),gy+rand(0.5,1.3),s.pos.z+rand(-0.25,0.25),rand(-0.3,0.3),rand(1,2),rand(-0.3,0.3),rand(0.4,0.7),1.2,rand(0.25,0.4),0.9,-1,true);
}
}
for(const t of tanks){
if(!t.alive) continue;
let onFire=false, att=null;
for(const fs of FIRE_SOURCES){
if(Math.hypot(t.pos.x-fs.x,t.pos.z-fs.z)<fs.r+1.6){ onFire=true; att=fs.attacker; break; }
}
if(!onFire){
const ci=fCellI(t.pos.x,t.pos.z);
const cxi=ci%FN, czi=(ci/FN)|0;
for(let dj=-1;dj<=1&&!onFire;dj++)for(let di=-1;di<=1;di++){
const ni=cxi+di, nj=czi+dj;
if(ni<0||nj<0||ni>=FN||nj>=FN) continue;
const ci2=nj*FN+ni;
if(FBURN[ci2]>0&&FUEL[ci2]>0){ onFire=true; att=FATT[ci2]; break; }
}
}
if(onFire) t.takeDmg(3,att);
}
}

// ═══════════ 树爆 (2026-09-13 许特根雾林 woodline 专属环境机制) ═══════════
// 历史原型: 许特根森林战役的标志性杀伤 —— 炮弹在树梢高度空爆, 弹片/木刺自上而下泼洒,
// 林冠下暴露人员无处可躲, 唯有顶盖(建筑/碉堡/掩体=coldSheltered 同判定)与壕沟(低于炸点地面
// TREEBURST.deep 米)能保命; 防火带开阔地无树冠, 炸点不落在那 (安全带, 但暴露于直射火)。
// 玩家与 Bot 一视同仁 (同质化纲领第2条): Bot 经 tbThreat 逃离弹着圈 (与火情规避同一路径);
// 玩家有 prep 秒炮弹啸音 + HUD 红字预警。炸点只落在旗圈/走廊热区附近, 开局 6s 后首轮。
const TB_THREATS=[];  // 活动弹着威胁 {x,z,r,t} (t=剩余秒) —— Bot 逃离/选点过滤用
let tbT=6;            // 开局 6s 后第一轮齐射
const TB_PENDING=[];  // 在途炮弹 {x,z,t}
function tbThreat(x,z,clear){
let bd=1e9, bx=0, bz=0;
for(const s of TB_THREATS){
const dd=Math.hypot(x-s.x,z-s.z)-s.r;
if(dd<bd){ bd=dd; bx=s.x; bz=s.z; }
}
if(bd>clear) return null;
return {dx:bx-x, dz:bz-z};
}
// 遮蔽判定: 头顶有静态顶盖 (建筑/碉堡/掩体) 或身处壕沟/弹坑底 (低于炸点地面 deep 米)
function tbSheltered(px,py,pz,gy){
if(coldSheltered(px,py,pz)) return true;
return (py||0)<=gy-TREEBURST.deep;
}
// 热区: 旗圈附近 (拉锯焦点) + 中线走廊随机点 —— 树爆只落在战区, 后方基地不受袭扰
function tbPickZone(){
const fs=CAMPAIGN.flags;
const f=fs[Math.floor(Math.random()*fs.length)];
if(Math.random()<0.75) return {x:f.x+rand(-26,26), z:f.z+rand(-26,26)};
return {x:rand(-180,180), z:rand(-90,90)};
}
function updateTreeBursts(dt){
if(!CAMPAIGN.wood) return;
// 在途炮弹倒计时 → 引爆
for(let i=TB_PENDING.length-1;i>=0;i--){
const s=TB_PENDING[i];
s.t-=dt;
if(s.t>0) continue;
TB_PENDING.splice(i,1);
tbDetonate(s.x,s.z);
}
// 威胁寿命衰减
for(let i=TB_THREATS.length-1;i>=0;i--){
TB_THREATS[i].t-=dt;
if(TB_THREATS[i].t<=0) TB_THREATS.splice(i,1);
}
// 玩家 HUD 红字预警: 在途弹着圈内的暴露人员 (每帧判定, 独立元素 #tbTip —— 不与严寒提示互抢)
if(player&&player.alive&&!player.onVehicle&&typeof tbHudShow==='function'){
let warn=false;
for(const s of TB_PENDING){
const d=Math.hypot(s.x-player.pos.x,s.z-player.pos.z);
if(d<TREEBURST.r*1.3&&!tbSheltered(player.pos.x,player.pos.y,player.pos.z,heightAt(player.pos.x,player.pos.z))){ warn=true; break; }
}
if(warn) tbHudShow('⚠ 树爆! 弹片自树冠泼下 — 找顶盖(建筑/碉堡)或卧倒壕沟');
else tbHudHide();
}
// 齐射生成
tbT-=dt;
if(tbT>0) return;
tbT=rand(TREEBURST.minGap,TREEBURST.maxGap);
const cz=tbPickZone();
const nShells=Math.round(rand(TREEBURST.shells[0],TREEBURST.shells[1]));
for(let k=0;k<nShells;k++){
const a=Math.random()*TAU, rr=Math.random()*TREEBURST.spread;
TB_PENDING.push({x:cz.x+Math.sin(a)*rr, z:cz.z+Math.cos(a)*rr, t:TREEBURST.prep+k*TREEBURST.gap});
}
// 炮击预警: 玩家在热区附近 → 啸音提示 (齐射一次); 弹着圈内的玩家另有 HUD 红字 (每帧段)
if(player&&player.alive){
const dNear=Math.min.apply(null,TB_PENDING.map(s=>Math.hypot(s.x-player.pos.x,s.z-player.pos.z)));
if(dNear<260) AudioSys.mortarThunk(clamp(dNear,12,160));
}
}
function tbDetonate(x,z){
const gy=heightAt(x,z), by=gy+TREEBURST.h;
const dCam=Math.hypot(x-camera.position.x,z-camera.position.z);
// 视觉: 林冠空爆闪光+黑烟 + 下落木刺火星 + 地面尘环 (距相机 200m 限流)
if(dCam<200){
spawnP(PT.flash,x,by,z,rand(-1,1),rand(0.5,1.5),rand(-1,1),rand(2.2,3.2),1.8,rand(0.4,0.6),0.95,-1,true);
for(let k=0;k<5;k++){
spawnP(PT.dark,x+rand(-2,2),by+rand(-1,1),z+rand(-2,2),rand(-2,2),rand(-0.5,1),rand(-2,2),rand(1.2,2),1.9,rand(1.2,2.2),0.5,0.1);
}
if(SETTINGS.quality>=1){
for(let k=0;k<8;k++){
spawnP(PT.spark,x+rand(-1.5,1.5),by+rand(-1,1),z+rand(-1.5,1.5),rand(-6,6),rand(-9,-3),rand(-6,6),0.12,-0.06,rand(0.5,0.9),0.8,4,true);
}
}
spawnP(PT.dark,x,gy+0.6,z,0,rand(1.2,2),0,rand(1.8,2.6),1.9,rand(1,1.6),0.4,0.1);
}
if(dCam<180) AudioSys.explosion(dCam);
// 留疤: 小弹坑 (运行期 crater, 不涉种子)
if(typeof crater==='function'&&dCam<150) crater(x,z,1.5,true);
// 杀伤: 半径内暴露人员 (玩家+Bot 一视同仁; 载具内乘员由车体承伤), 中心线性平方衰减
for(const s of combatants){
if(!s.alive||s.onVehicle) continue;
const d=Math.hypot(s.pos.x-x,s.pos.z-z);
if(d>=TREEBURST.r) continue;
if(tbSheltered(s.pos.x,s.pos.y,s.pos.z,gy)) continue;
const k=1-d/TREEBURST.r;
s.damage(TREEBURST.dmg*k*k,null,false);
if(s.isPlayer) addTrauma(0.3);
}
for(const t of tanks){
if(!t.alive) continue;
const d=Math.hypot(t.pos.x-x,t.pos.z-z);
if(d>=TREEBURST.r) continue;
const k=1-d/TREEBURST.r;
t.takeDmg(TREEBURST.tankDmg*k*k,null);
}
// 弹着威胁登记: Bot 在圈内逃离 6s (复用火情规避路径)
TB_THREATS.push({x,z,r:TREEBURST.r+4,t:6});
}

// 树爆 HUD (#tbTip): 独立于严寒提示 (双方各用各的元素, 状态键比较防重复写 DOM)
function tbHudShow(line){
const elm=document.getElementById('tbTip');
if(!elm) return;
if(elm._line!==line){ elm._line=line; elm.innerHTML=line; elm.style.display='block'; }
}
function tbHudHide(){
const elm=document.getElementById('tbTip');
if(elm&&elm._line){ elm._line=null; elm.style.display='none'; }
}
