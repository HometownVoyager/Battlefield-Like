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
tr.fall={t:0,dx,dz,dur:rand(0.9,1.3)};
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
const ax=_fa.set(tr.fall.dz,0,-tr.fall.dx);
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
_fm.compose(_fp,_fq.identity(),_fs.setScalar(tr.s));
im.setMatrixAt(tr.ti,_fm);
const lm=TREE_IM.leaves;
for(let i=0;i<3;i++){
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
function updateFallingTrees(dt){
for(let i=FALLING.length-1;i>=0;i--){
const tr=FALLING[i];
const f=tr.fall;
f.t+=dt;
const k=Math.min(1,f.t/f.dur);
treeInstanceMatrices(tr,1.5*k*k);
if(f.t>=f.dur+0.25){
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
// ===== 坦克碾压: 行进中撞上树 → 顺势撞倒; 灌木直接碾没 =====
function floraCrushTank(t){
if(Math.abs(t.vel)<0.8) return;
const sn=Math.sin(t.yaw), cs=Math.cos(t.yaw);
const hits=[];
floraNear(t.pos.x,t.pos.z,4.5,rec=>hits.push(rec));
for(const rec of hits){
const d=Math.hypot(rec.x-t.pos.x,rec.z-t.pos.z);
if(rec.kind==='tree'){
if(!rec.alive) continue;
if(d<1.85+0.35*rec.s){
treeFall(rec,sn+rand(-0.2,0.2),cs+rand(-0.2,0.2));
t.vel*=0.965;
spawnP(PT.dirt,rec.x,rec.g0+0.6,rec.z,rand(-1.5,1.5),rand(1,3),rand(-1.5,1.5),0.3,0.6,0.5,0.85,3);
}
}else if(d<2.0){
vanishFlora(rec,false);
}
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
