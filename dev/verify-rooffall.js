// ─────────────────────────────────────────────
// dev/verify-rooffall.js —— 屋顶坍塌机制验证 (不进 Index.html)
// 在验证沙箱中运行 00-config.js + 05-world.js, 检查:
//  1) 每栋双坡屋顶房的承重墙组是否都挂到 roofRef;
//  2) 模拟逐个炸墙, 观察残余墙数与屋顶视觉/碰撞带是否一并消失;
//  3) 检查坍塌后屋顶碰撞带是否真正失效(不再留在 BOXES 中挡人/弹)。
//  4) 2026-09-01: 运行期(非silent)倒塌回归 —— 墙毁后屋顶即刻塌落, 坡板/山墙/阶梯带网格
//    必须全部移除 (阶梯带网格残留空中 = 屋顶浮空 bug 的直接断言)。
// 用法: node dev/verify-rooffall.js [campaignIdx]
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'), path=require('path'), vm=require('vm');
const root=path.resolve(__dirname,'..');
const seed=42;
const seg=(ax,az,bx2,bz2,cx,cz2)=>{ const abx=bx2-ax,abz=bz2-az; const t=Math.max(0,Math.min(1,((cx-ax)*abx+(cz2-az)*abz)/(abx*abx+abz*abz||1))); return Math.hypot(cx-(ax+abx*t),cz2-(az+abz*t)); };

function makeThreeStub(){
const Ctx2D=()=>({ fillStyle:'',strokeStyle:'',lineWidth:1,font:'',textAlign:'',
beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},stroke(){},fillRect(){},clearRect(){},fillText(){},arc(){},save(){},restore(){},translate(){},rotate(){},scale(){},closePath(){} });
class P3{ constructor(x=0,y=0,z=0){ this.x=x;this.y=y;this.z=z; } set(x,y,z){this.x=x;this.y=y;this.z=z;return this;} setScalar(s){this.x=s;this.y=s;this.z=s;return this;} normalize(){const l=Math.hypot(this.x,this.y,this.z)||1;this.x/=l;this.y/=l;this.z/=l;return this;} }
class Rot{ constructor(){ this.x=0;this.y=0;this.z=0;this.order='XYZ'; } set(x,y,z){this.x=x;this.y=y;this.z=z;return this;} }
class Quat{ constructor(){ this.x=0;this.y=0;this.z=0;this.w=1; } setFromUnitVectors(){ return this; } identity(){ return this; } setFromEuler(){ return this; } }
class Scl{ constructor(){ this.x=1;this.y=1;this.z=1; } set(x,y,z){this.x=x;this.y=y;this.z=z;return this;} setScalar(s){this.x=s;this.y=s;this.z=s;return this;} }
class Obj3{ constructor(){ this.position=new P3(); this.rotation=new Rot(); this.scale=new Scl(); this.quaternion=new Quat(); this.children=[]; this.parent=null; this.matrix={}; this.castShadow=false; this.receiveShadow=false; this.visible=true; this.renderOrder=0; this.userData={}; this.updateMatrix=()=>{}; }
add(m){ this.children.push(m); m.parent=this; } remove(m){ const i=this.children.indexOf(m); if(i>=0){ this.children.splice(i,1); m.parent=null; } }
traverse(fn){ fn(this); for(const c of this.children) if(c.traverse) c.traverse(fn); } }
class Geo{ constructor(...a){ this.parameters={width:a[0]||1,height:a[1]||1,depth:a[2]||1}; } translate(){return this;} rotateX(){return this;} rotateY(){return this;} setAttribute(n,a){ this.attributes=this.attributes||{}; this.attributes[n]=a; return this; } setIndex(i){ this.index={array:(i&&i.length!==undefined)?i:[]}; return this; } computeVertexNormals(){ return this; } }
class PlaneGeo extends Geo{ constructor(w=1,h=1,sg=1,sh=1){ super(w,h); const gx=(sg||1)+1, gy=(sh||1)+1; this.attributes={position:{count:gx*gy,array:new Float32Array(gx*gy*3),getX:i=>((i%gx)/gx-0.5)*w,getZ:i=>(Math.floor(i/gx)/gy-0.5)*h,getY:()=>0,setY(){},setX(){},setZ(){}}}; this.index=null; } }
return {
Group:class extends Obj3{}, Mesh:class extends Obj3{ constructor(g,m){ super(); this.geometry=g||new Geo(); this.material=m||{}; } },
InstancedMesh:class extends Obj3{ constructor(g,m,n){ super(); this.geometry=g; this.material=m; this.count=n; } setMatrixAt(){} },
Object3D:Obj3, Vector3:P3, Quaternion:Quat, CanvasTexture:class{ constructor(c){ this.image=c; } },
Euler:class{ set(){ return this; } },
Matrix4:class{ compose(){ return this; } },
BoxGeometry:Geo, CylinderGeometry:Geo, PlaneGeometry:PlaneGeo, SphereGeometry:Geo, ConeGeometry:Geo, TorusGeometry:Geo, CircleGeometry:Geo,
MeshLambertMaterial:class{ constructor(o){ Object.assign(this,o||{}); if(!this.color) this.color={set(){}}; } },
MeshBasicMaterial:class{ constructor(o){ Object.assign(this,o||{}); if(!this.color) this.color={set(){}}; } },
BufferGeometry:class{ constructor(){ this.attributes={}; } setAttribute(n,a){ this.attributes[n]=a; return this; } setAttributeX(){return this;} setIndex(){return this;} setFromPoints(){return this;} computeVertexNormals(){return this;} },
BufferAttribute:class{ constructor(a,n){ this.array=a; this.itemSize=n; } },
Float32BufferAttribute:class{},
};
}
function makeTerrain(CAMPAIGN){
// ── 雾林守线副本 (2026-09-13 许特根改版): 北谷(卡尔小径)距离场+堑口遮罩 (与 03-terrain 同构) ──
const WOOD=CAMPAIGN.wood||null;
const STEPPE=CAMPAIGN.steppe||null;
const segW=(px,pz,ax,az,bx,bz)=>{ const abx=bx-ax,abz=bz-az; const t=Math.max(0,Math.min(1,((px-ax)*abx+(pz-az)*abz)/(abx*abx+abz*abz||1))); return Math.hypot(px-(ax+abx*t),pz-(az+abz*t)); };
const woodRavineDist=(x,z)=>{ if(!WOOD||!WOOD.ravine) return 1e9; let gd=1e9; const P=WOOD.ravine.pts; for(let i=0;i<P.length-1;i++){ const d=segW(x,z,P[i][0],P[i][1],P[i+1][0],P[i+1][1]); if(d<gd) gd=d; } return gd; };
const woodRampMask=(x,z)=>{ if(!WOOD||!WOOD.ravine) return 0; let m=0; for(const r of (WOOD.ravine.ramps||[])){ const w2=r.w||5; const d=segW(x,z,r.x0,r.z0,r.x1,r.z1); const k=d<=w2?1:Math.max(0,Math.min(1,1-(d-w2)/5)); if(k>m) m=k; } return m; };
// ── 环礁海域副本 (2026-09-18 塔拉瓦 / ★09-19 四面环海): 岸线距离场 + 离岸/陆上剖面 + 航道 (与 03-terrain 同构) ──
const SEA=CAMPAIGN.sea||null;
const s3f=t=>t*t*(3-2*t);
function shoreZAt(x){
if(!SEA) return 1e9;
const P=SEA.shore;
if(x<=P[0][0]) return P[0][1];
for(let i=0;i<P.length-1;i++){
if(x<=P[i+1][0]){ const t=(x-P[i][0])/((P[i+1][0]-P[i][0])||1); return P[i][1]+(P[i+1][1]-P[i][1])*t; }
}
return P[P.length-1][1];
}
function northZAt(x){
if(!SEA||!SEA.north) return -1e9;
const P=SEA.north;
if(x<=P[0][0]) return P[0][1];
for(let i=0;i<P.length-1;i++){
if(x<=P[i+1][0]){ const t=(x-P[i][0])/((P[i+1][0]-P[i][0])||1); return P[i][1]+(P[i+1][1]-P[i][1])*t; }
}
return P[P.length-1][1];
}
function coastXAt(P,z){
if(!P||!P.length) return 1e9;
if(z<=P[0][0]) return P[0][1];
for(let i=0;i<P.length-1;i++){
if(z<=P[i+1][0]){ const t=(z-P[i][0])/((P[i+1][0]-P[i][0])||1); return P[i][1]+(P[i+1][1]-P[i][1])*t; }
}
return P[P.length-1][1];
}
// 单支岸线有符号距离: 跨度内=垂距 / 越出端点=到端点的欧氏距离 (2026-09-19 修"角落的海太浅"; 与 03-terrain 同构)
function coastDist(P,t,v,side){
const n=P.length;
if(n<2||t<=P[0][0]){ const dv=v-P[0][1]; return (side*dv>=0?1:-1)*Math.hypot(t-P[0][0],dv); }
if(t>=P[n-1][0]){ const dv=v-P[n-1][1]; return (side*dv>=0?1:-1)*Math.hypot(t-P[n-1][0],dv); }
for(let i=0;i<n-1;i++){
if(t<=P[i+1][0]){
const t0=P[i][0], t1=P[i+1][0];
const vc=P[i][1]+(P[i+1][1]-P[i][1])*((t-t0)/((t1-t0)||1));
return side*(v-vc);
}
}
return side*(v-P[n-1][1]);
}
function shoreDist(x,z){
if(!SEA) return 1e9;
const fs=coastDist(SEA.shore,x,z,1);
const fn=SEA.north?coastDist(SEA.north,x,z,-1):-1e9;
const dw=SEA.west?coastDist(SEA.west,z,x,-1):-1e9;
const de=SEA.east?coastDist(SEA.east,z,x,1):-1e9;
if(fs<=0&&fn<=0&&dw<=0&&de<=0){ let m=fs; if(fn>m)m=fn; if(dw>m)m=dw; if(de>m)m=de; return m; }
let best=1e18;
if(fs>0) best=fs;
if(fn>0&&fn<best) best=fn;
if(dw>0&&dw<best) best=dw;
if(de>0&&de<best) best=de;
return best;
}
function seaChannelMask(x,z){
if(!SEA||!SEA.channels) return 0;
let m=0;
for(const c of SEA.channels){ if(c.z0!==undefined&&z<c.z0) continue; const d=Math.abs(x-c.x); const k=d<=c.w?1:Math.max(0,Math.min(1,1-(d-c.w)/6)); if(k>m) m=k; }
return m;
}
function seaDepthOfD(x,z,d){
const S=SEA;
// 全海图 (P4 opensea): 无离岸剖面表 ⇒ 均匀海盆深 (与 03-terrain 同一支守卫; 副本必须同源)
if(!S||!S.shelf) return (S&&S.deep)?S.deep:26;
const A=S.shelf.d*S.shelf.rate;
const B=A+(S.reef.d1-S.reef.d0)*S.reef.rate;
const C=B+(S.edge.d1-S.edge.d0)*S.edge.rate;
const D=C+(S.slope.d1-S.slope.d0)*S.slope.rate;
let dep;
if(d<=S.shelf.d) dep=d*S.shelf.rate;
else if(d<=S.reef.d1) dep=A+(d-S.reef.d0)*S.reef.rate;
else if(d<=S.edge.d1) dep=B+(d-S.edge.d0)*S.edge.rate;
else if(d<=S.slope.d1) dep=C+(d-S.slope.d0)*S.slope.rate;
else dep=D+(d-S.basin.d0)*S.basin.rate;
const cm=seaChannelMask(x,z);
if(cm>0){ const ramp=s3f(Math.max(0,Math.min(1,(d-5)/10))); dep=dep+(Math.max(dep,2.45)-dep)*cm*ramp; }
return dep;
}
function seaDepthAt(x,z){
if(!SEA) return 0;
const d=shoreDist(x,z);
return d>0?seaDepthOfD(x,z,d):0;
}
function seaLandH(x,z,u){
const S=SEA;
const hSand=S.sand.u*S.sand.rate;
const hRidge=hSand+(S.ridge.u1-S.ridge.u0)*S.ridge.rate;
const hBench=hRidge+(S.bench.u1-S.bench.u0)*S.bench.rate;
let h;
if(u<=S.sand.u) h=u*S.sand.rate;
else if(u<=S.ridge.u1) h=hSand+(u-S.ridge.u0)*S.ridge.rate;
else if(u<=S.bench.u1) h=hRidge+(u-S.bench.u0)*S.bench.rate;
else{
const H=S.hill;
const hill=H.a*Math.sin(x*0.0125+0.7)*Math.cos(z*0.0115-0.4)+H.b*Math.sin(x*0.031-1.1)*Math.sin(z*0.028+0.6)+H.c*Math.sin(x*0.09+2.2)*Math.cos(z*0.083+1.1);
const g=s3f(Math.max(0,Math.min(1,(u-S.bench.u1)/30)));   // 出背坡台地后渐起 (bias 保证内陆不落海平面以下)
h=hBench+(H.bias+hill)*g+S.uplift.h*s3f(Math.max(0,Math.min(1,(u-S.uplift.u0)/S.uplift.span)));
}
if(S.heads) for(const hd of S.heads){ const dd=Math.hypot(x-hd.x,z-hd.z); if(dd<hd.r) h+=hd.h*s3f(1-dd/hd.r); }
if(S.knoll){ const dd=Math.hypot(x-S.knoll.x,z-S.knoll.z); if(dd<S.knoll.r) h+=S.knoll.h*s3f(1-dd/S.knoll.r); }
const rx=Math.max(S.runway.x0-x,0,x-S.runway.x1), rz=Math.max(S.runway.z0-z,0,z-S.runway.z1);
const rd=Math.hypot(rx,rz);
if(rd<20) h+=(S.runway.h-h)*s3f(Math.max(0,Math.min(1,1-rd/20)));
return h;
}
function rectDist(x,z,x0,z0,x1,z1){ const dx=Math.max(x0-x,0,x-x1), dz=Math.max(z0-z,0,z-z1); return Math.hypot(dx,dz); }
const WATER_SURF=[];
function waterSurfReg(x,z,wy,hw){ WATER_SURF.push({x,z,wy,hw}); }
function waterSurfRegStrip(samples,hw){ for(const s of samples) WATER_SURF.push({x:s.x,z:s.z,wy:s.wy,hw}); } // 2026-09-28C 补同步: 水面批在 03-terrain 新增, 本副本漏了 ⇒ buildWorld ReferenceError
function waterYAt(x,z){ let wy=-1e9; if(SEA&&shoreDist(x,z)>0) wy=SEA.level; return wy; }
function waterDepthAt(x,z){ const wy=waterYAt(x,z); if(wy<=-1e8) return -1e9; return wy-heightAt(x,z,true); }
// 通用水体判据 (★2026-09-26 P2-18): 05c 的野树/草丛门会调 03-terrain 的 inWaterBody
function inWaterBody(x,z){ const wy=waterYAt(x,z); return wy>-1e8&&heightAt(x,z,true)<wy-0.05; }
function inSeaAt(x,z){ return !!SEA&&shoreDist(x,z)>0; }
function rawH(x,z){
// 03-terrain 副本 (2026-09-10 三图改造): 淞沪/百团/莫斯科语义表驱动
const DELTA=CAMPAIGN.delta||null, LOESS=CAMPAIGN.loess||null, ALPINE=CAMPAIGN.alpine||null;
const s3=t=>t*t*(3-2*t);
const segD=(px,pz,ax,az,bx,bz)=>{ const abx=bx-ax,abz=bz-az; const t=Math.max(0,Math.min(1,((px-ax)*abx+(pz-az)*abz)/(abx*abx+abz*abz||1))); return Math.hypot(px-(ax+abx*t),pz-(az+abz*t)); };
switch(CAMPAIGN.terr){
case 'urban': return 0.45*Math.sin(x*0.03)*Math.cos(z*0.028)+0.25*Math.sin(x*0.09+1)*Math.sin(z*0.07+0.5);
case 'delta':{
let h=0.55*Math.sin(x*0.018)*Math.cos(z*0.02)+0.35*Math.sin(x*0.06+2)*Math.sin(z*0.05+1)-0.15;
if(DELTA){
if(DELTA.ridges){ for(const r of DELTA.ridges){ const d=segD(x,z,r.x0,r.z0,r.x1,r.z1); if(d<2.2) h+=1.35*s3(1-d/2.2); } }
if(DELTA.paddy){ for(const p of DELTA.paddy){ const mx=(x-p.x0)*(x-p.x1), mz=(z-p.z0)*(z-p.z1); if(mx<=0&&mz<=0){ const dE=Math.min(x-p.x0,p.x1-x,z-p.z0,p.z1-z); if(dE>1.5) h-=0.65; else h-=0.65*s3(dE/1.5); } } }
if(DELTA.ponds){ for(const pd of DELTA.ponds){ const d=Math.hypot(x-pd.x,z-pd.z); if(d<pd.r+1.2){ const k=Math.max(0,Math.min(1,1-d/(pd.r+1.2))); h-=(pd.t==='lotus'?0.55:0.75)*s3(k); } } }
for(const ch of DELTA.channels){ for(let i=0;i<ch.length-1;i++){ const d=segD(x,z,ch[i][0],ch[i][1],ch[i+1][0],ch[i+1][1]); if(d<DELTA.w) h-=(DELTA.d||1.35)*s3(1-d/DELTA.w); } }
if(DELTA.landmark){ const L=DELTA.landmark; const d=Math.hypot(x-L.x,z-L.z); if(d<14) h+=0.3*s3(1-d/14); }
}
return h;
}
case 'loess':{
// 2026-09-12 立体化副本: 川地基底+塬面高台+黄土峁+深沟三段剖面(沟底/崩积坡/陡崖)+坡道堑口+渡台 (与 03-terrain rawHeight 同构)
const base=1.5*Math.sin(x*0.016+0.5)*Math.cos(z*0.019)+0.8*(1-Math.abs(Math.sin(x*0.028+z*0.011+1)))+0.4*Math.sin(x*0.09+3)*Math.cos(z*0.08+1.2)+0.6;
let h=base;
if(LOESS){
if(LOESS.terraces){ for(const t2 of LOESS.terraces){ const dx=Math.max(t2.x0-x,0,x-t2.x1), dz=Math.max(t2.z0-z,0,z-t2.z1); h+=(t2.h-h)*s3(Math.max(0,Math.min(1,1-Math.hypot(dx,dz)/14))); } }
if(LOESS.maos){ for(const m2 of LOESS.maos){ const d=Math.hypot(x-m2.x,z-m2.z); if(d<m2.r){ const k=1-d/m2.r, mh=base+m2.h*k*(2-k); if(mh>h) h=mh; } } }
const W=LOESS.w||14, D=LOESS.d||14, GB=LOESS.bottom||3, TE=LOESS.talus||12;
let gd=1e9;
for(const g of LOESS.gullies){ for(let i=0;i<g.length-1;i++){ const d=segD(x,z,g[i][0],g[i][1],g[i+1][0],g[i+1][1]); if(d<gd) gd=d; } }
if(gd<W){
let dep;
if(gd<GB) dep=D;
else if(gd<TE) dep=D-8*s3((gd-GB)/(TE-GB));
else dep=(D-8)*(1-s3((gd-TE)/(W-TE)));
if(LOESS.ramps){ let rm=0; for(const r of LOESS.ramps){ const w2=r.w||9; const d=segD(x,z,r.x0,r.z0,r.x1,r.z1); const k=d<=w2?1:Math.max(0,Math.min(1,1-(d-w2)/5)); if(k>rm) rm=k; } dep*=1-0.88*rm; }
h-=dep;
}
if(LOESS.benches){ for(const b2 of LOESS.benches){ const dx=Math.max(b2.x0-x,0,x-b2.x1), dz=Math.max(b2.z0-z,0,z-b2.z1); h+=(b2.h-h)*s3(Math.max(0,Math.min(1,1-Math.hypot(dx,dz)/12))); } }
}
return h;
}
case 'jungle': return 2.3*Math.sin(x*0.014)*Math.cos(z*0.017+1)+1.25*Math.sin(x*0.05+1.2)*Math.sin(z*0.043+2)+0.5*Math.sin(x*0.12+3)*Math.cos(z*0.1);
case 'deepjungle': return 1.9*Math.sin(x*0.016+0.3)*Math.cos(z*0.014+2)+1.0*Math.sin(x*0.045+0.7)*Math.sin(z*0.05+1.4)+0.4*Math.sin(x*0.11+1)*Math.cos(z*0.1+0.6);
case 'alpine':{
const base=1.2*Math.sin(x*0.021)*Math.cos(z*0.024)+0.7*Math.sin(x*0.052+1.7)*Math.sin(z*0.043+0.6)+0.35*Math.sin(x*0.11+3.1)*Math.cos(z*0.09+1.2);
if(ALPINE){
let bd=1e9,bh=0;
const R=ALPINE.ridges[0],RH=ALPINE.ridgeH;
for(let i=0;i<R.length-1;i++){
const abx=R[i+1][0]-R[i][0],abz=R[i+1][1]-R[i][1];
const t=Math.max(0,Math.min(1,((x-R[i][0])*abx+(z-R[i][1])*abz)/(abx*abx+abz*abz||1)));
const d=Math.hypot(x-(R[i][0]+abx*t),z-(R[i][1]+abz*t));
if(d<bd){ bd=d; bh=RH[i]+(RH[i+1]-RH[i])*t; }
}
const s=s3(Math.max(0,Math.min(1,1-bd/70)));
return base+s*s*bh;
}
return base;
}
case 'steppe': return 0.9*Math.sin(x*0.017+0.4)*Math.cos(z*0.015+1.2)+0.45*Math.sin(x*0.052+1.5)*Math.sin(z*0.045+0.8)+0.18*Math.sin(x*0.14+2)*Math.cos(z*0.12+0.4);
	case 'woods':{ // 2026-09-13 许特根副本: 林间缓丘+北谷(卡尔小径)三段剖面+堑口 (与 03-terrain 同构)
	const base=0.95*Math.sin(x*0.018+0.8)*Math.cos(z*0.017+1.4)+0.5*Math.sin(x*0.05+2)*Math.sin(z*0.045+1)+0.22*Math.sin(x*0.11+1)*Math.cos(z*0.09+2.4);
	if(!WOOD||!WOOD.ravine) return base;
	const W2=WOOD.ravine, D2=W2.d||8.5, GB=W2.bottom||5, TE=W2.talus||12;
	const gd=woodRavineDist(x,z);
	if(gd>=W2.w) return base;
	let dep;
	if(gd<GB) dep=D2;
	else if(gd<TE) dep=D2-5.2*s3((gd-GB)/(TE-GB));
	else dep=(D2-5.2)*(1-s3((gd-TE)/(W2.w-TE)));
	dep*=1-0.88*woodRampMask(x,z);
	return base-dep*(1+0.06*Math.sin(x*0.012+2)); }
case 'island':{ // 2026-09-18 塔拉瓦副本: 海床(负高度)+陆上剖面同一支岸线距离场 (与 03-terrain rawHeight 同构)
if(!SEA) return 0;
{ const d=shoreDist(x,z); if(d>0) return -seaDepthAt(x,z); return seaLandH(x,z,-d); } }
case 'mountain':{ const m=1-Math.exp(-(z*z)/(14*14)); const r1=1-Math.abs(Math.sin(x*0.018+z*0.006)),r2=1-Math.abs(Math.sin(z*0.038-x*0.004+1.3)); return m*(r1*r1*4.4+r2*2.2)+0.5*Math.sin(x*0.045+1)*Math.cos(z*0.05+0.7); }
default: return 1.4*Math.sin(x*0.021)*Math.cos(z*0.024)+0.9*Math.sin(x*0.052+1.7)*Math.sin(z*0.043+0.6)+0.5*Math.sin(x*0.11+3.1)*Math.cos(z*0.09+1.2);
}
}
const FLATS=[];
for(const b of CAMPAIGN.bases) FLATS.push({x:b.x,z:b.z,r:20,h:(CAMPAIGN.terr==='loess'||CAMPAIGN.terr==='woods'||CAMPAIGN.terr==='island')?rawH(b.x,b.z):rawH(b.x,b.z)*0.55});
for(const f of CAMPAIGN.flags) FLATS.push({x:f.x,z:f.z,r:f.r+12,h:(CAMPAIGN.terr==='loess'||CAMPAIGN.terr==='woods'||CAMPAIGN.terr==='island')?rawH(f.x,f.z):rawH(f.x,f.z)*0.55});
if(WOOD&&WOOD.village){ const V=WOOD.village; FLATS.push({x:V.x,z:V.z,r:V.r,h:rawH(V.x,V.z)}); } // 许特根: 岭上村台地 (全高)
for(const s of (CAMPAIGN.spawns||[])) FLATS.push({x:s.x,z:s.z,r:8,h:rawH(s.x,s.z)*0.55});
// 草原库尔斯克改版 (2026-09-13): 车站(站房/站台/水塔群)/风车/农庄需整片平地 (全高, 同岭上村口径)
if(STEPPE&&STEPPE.station){ const T2=STEPPE.station; FLATS.push({x:T2.x,z:T2.z,r:26,h:rawH(T2.x,T2.z)}); }
if(STEPPE&&STEPPE.village){ const V2=STEPPE.village; FLATS.push({x:V2.x,z:V2.z,r:V2.r,h:rawH(V2.x,V2.z)}); }
if(STEPPE&&STEPPE.mill){ const M3=STEPPE.mill; FLATS.push({x:M3.x,z:M3.z,r:9,h:rawH(M3.x,M3.z)}); }
const TRENCHES=(CAMPAIGN.trench||[]).map(t=>({x1:t[0],z1:t[1],x2:t[2],z2:t[3]}));
// 03-terrain 副本: 建筑地基平台 PADS (2026-09-20) —— 定向矩形硬平台, 矩形内恒等于楼面, 外接 ramp 米裙坡
const PADS=[];
function addPad(x,z,ry,hw,hd,ramp,h){
const reach=Math.hypot(hw,hd)+ramp+0.001;
PADS.push({x,z,ry,hw,hd,ramp,h,cs:Math.cos(ry),sn:Math.sin(ry),reach2:reach*reach});
}
function padHeight(x,z,h){
const n=PADS.length;
if(!n) return h;
let plat=null, platC=1e9;
for(let k=0;k<n;k++){
const p=PADS[k];
const dx=x-p.x, dz=z-p.z;
if(dx*dx+dz*dz>p.reach2) continue;
const lx=dx*p.cs-dz*p.sn, lz=dx*p.sn+dz*p.cs;
if(Math.abs(lx)<=p.hw&&Math.abs(lz)<=p.hd){ const c=dx*dx+dz*dz; if(c<platC){ platC=c; plat=p; } }
}
if(plat) return plat.h;
for(let k=0;k<n;k++){
const p=PADS[k];
const dx=x-p.x, dz=z-p.z;
if(dx*dx+dz*dz>p.reach2) continue;
const lx=dx*p.cs-dz*p.sn, lz=dx*p.sn+dz*p.cs;
const ax=Math.abs(lx)-p.hw, az=Math.abs(lz)-p.hd;
if(ax<=0&&az<=0) continue;
const d=Math.hypot(ax>0?ax:0,az>0?az:0);
if(d>=p.ramp) continue;
const s1=1-d/p.ramp;
h+=(p.h-h)*s1*s1*(3-2*s1);
}
return h;
}
const RIVER={moscow:{pts:[[-320,-238],[-180,-262],[-40,-246],[120,-268],[320,-244]],w:9,ice:true},
burma:{pts:[[-165,62],[-70,32],[-8,62],[60,12],[120,42],[165,22]],w:8,ice:false},
songhu:{pts:[[-165,-52],[-80,-42],[0,-58],[80,-32],[165,-42]],w:7,ice:false,d:2.8},
hukawng:{pts:[[-30,-320],[-8,-224],[-16,-120],[-4,-10],[8,100],[-10,215],[4,320]],w:26,ice:false,d:14,ford:{x:-3.3,z:172,r:26}}}[CAMPAIGN.id]||null; // 2026-09-12 巨桥改版副本同步 (与 00-config 同源)
const DELTA=CAMPAIGN.delta||null;
const DELTA_CHANS=(DELTA&&DELTA.channels)||[];
const BRIDGES=CAMPAIGN.bridges||(CAMPAIGN.bridge?[CAMPAIGN.bridge]:[]);
const BRIDGE=BRIDGES[0]||null;
const _deckMap=new Map();
function bridgeDeckY(B){
const b=B||BRIDGE; if(!b) return 0;
if(b.deckY!==undefined) return b.deckY; // 栈桥 (kind='pier', 2026-09-18): 绝对桥面高
if(!_deckMap.has(b)){ const dx=Math.sin(b.yaw),dz=Math.cos(b.yaw); const e=b.len/2+3; _deckMap.set(b,Math.max(heightAt(b.x-dx*e,b.z-dz*e),heightAt(b.x+dx*e,b.z+dz*e))); }
return _deckMap.get(b);
}
function heightAt(x,z,noBridge){
let h=rawH(x,z);
for(const f of FLATS){ const d=Math.hypot(x-f.x,z-f.z); if(d<f.r){ const s1=1-d/f.r; const s=s1*s1*(3-2*s1); h+=(f.h-h)*s; } }
// 03-terrain 副本: 诺曼底博卡日下沉土路 (田块表存在即启用)
if((CAMPAIGN.fields||[]).length){ const rd=roadDist(x,z); if(rd<4){ const k=1-rd/4; h-=0.45*k*k*(3-2*k); } }
for(const t of TRENCHES){ const d=seg(t.x1,t.z1,t.x2,t.z2,x,z); if(d<2.4){ const k=1-d/2.4; h-=1.3*k*k*(3-2*k); } }
if(RIVER){ let rd=1e9; const P=RIVER.pts; for(let i=0;i<P.length-1;i++){ const d=seg(P[i][0],P[i][1],P[i+1][0],P[i+1][1],x,z); if(d<rd) rd=d; } if(rd<RIVER.w){ const k=1-rd/RIVER.w; h-=(RIVER.ice?1.2:(RIVER.d||1.9))*k*k*(3-2*k)*(1-0.92*fordAt(x,z)); } } // ford 滩心下切 8% (同 03-terrain 本体)
h=padHeight(x,z,h); // 03-terrain 副本: 建筑地基平台 (2026-09-20) —— 室内无坑/门槛零落差
if(!noBridge&&BRIDGES.length){ const dy=onBridge(x,z); if(dy!==false&&dy>h) h=dy; }
return h;
}
function onBridge(x,z,m=0){
let hit=false;
for(const B of BRIDGES){
const lx=x-B.x,lz=z-B.z; const ax=lx*Math.sin(B.yaw)+lz*Math.cos(B.yaw); const pv=lx*Math.cos(B.yaw)-lz*Math.sin(B.yaw);
if(Math.abs(ax)<B.len/2+m&&Math.abs(pv)<B.w/2+m){ const dy=bridgeDeckY(B); hit=(hit===false)?dy:Math.max(hit,dy); }
}
return hit;
}
function fordAt(x,z){ if(!RIVER||!RIVER.ford) return 0; const F=RIVER.ford; const d=Math.hypot(x-F.x,z-F.z); if(d>=F.r+9) return 0; if(d<=F.r) return 1; const k2=1-(d-F.r)/9; return k2*k2*(3-2*k2); }
function inRiverChannel(x,z){ if(!RIVER||!(RIVER.d>2)) return false; if(onBridge(x,z)!==false) return false; if(fordAt(x,z)>0.5) return false; const P=RIVER.pts; for(let i=0;i<P.length-1;i++){ if(seg(P[i][0],P[i][1],P[i+1][0],P[i+1][1],x,z)<RIVER.w*0.8) return true; } return false; }
function inShallowChannel(x,z){
if(onBridge(x,z)!==false) return false;
if(fordAt(x,z)>0.5) return true;
if(RIVER&&!(RIVER.d>2)){ const P=RIVER.pts; for(let i=0;i<P.length-1;i++){ if(seg(P[i][0],P[i][1],P[i+1][0],P[i+1][1],x,z)<RIVER.w*0.75) return true; } }
if(DELTA_CHANS.length){ for(const ch of DELTA_CHANS){ for(let i=0;i<ch.length-1;i++){ if(seg(ch[i][0],ch[i][1],ch[i+1][0],ch[i+1][1],x,z)<(DELTA.w||3.4)*0.8) return true; } } }
if(DELTA&&DELTA.ponds){ for(const pd of DELTA.ponds){ if(Math.hypot(x-pd.x,z-pd.z)<pd.r) return true; } }
return false;
}
function roadDist(x,z){ let d=CAMPAIGN.sineRoad?Math.abs(z-3*Math.sin(x*0.02)):1e9; for(const r of CAMPAIGN.roads) d=Math.min(d,seg(r[0],r[1],r[2],r[3],x,z)); return d; }
return {heightAt,roadDist,inRiverChannel,inShallowChannel,onBridge,FLATS,PADS,addPad,padHeight,bridgeDeckY,woodRavineDist,woodRampMask,shoreZAt,northZAt,coastXAt,shoreDist,seaDepthAt,seaChannelMask,seaLandH,rectDist,waterYAt,waterDepthAt,waterSurfReg,inSeaAt,inWaterBody};
}
function runCampaign(campIdx){
const THREE=makeThreeStub();
const sandbox={
console,Math,JSON,location:{search:'?seed='+seed},
localStorage:{_s:{sf_campaign:String(campIdx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=v;}},
navigator:{},
document:{createElement:(t)=>t==='canvas'?({width:0,height:0,getContext:()=>({fillStyle:'',strokeStyle:'',lineWidth:1,font:'',textAlign:'',beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},stroke(){},fillRect(){},clearRect(){},fillText(){},arc(){},save(){},restore(){},translate(){},rotate(){},scale(){}})}):({})},
};
sandbox.globalThis=sandbox;
sandbox.THREE=THREE;
sandbox.scene=new THREE.Group();
sandbox.MAT={stone:{},wood:{},woodDark:{},roof:{},plaster:{},brick:{},sandbag:{},hay:{},metal:{},metalDark:{},bark:{},leaves:{},rubble:{}};
sandbox.TEX={leaves:{}};
sandbox.svgApply=(tex)=>tex; // SVG 精修桩: 轻量沙箱不载 02-scene, 贴图原样返回
sandbox.addSnowCap=()=>{};
sandbox.makeTex=()=>({});
sandbox.wires=[];
sandbox.OCC={res:1,N:0,off:180,data:null};
sandbox.TRENCHES=[];
sandbox.BOXES=[]; sandbox.CYLS=[];
sandbox.addBoxCollider=(cx,cy,cz,w,h,d)=>{ const b={minX:cx-w/2,minY:cy-h/2,minZ:cz-d/2,maxX:cx+w/2,maxY:cy+h/2,maxZ:cz+d/2,gh:0,dead:false}; sandbox.BOXES.push(b); return b; };
sandbox.RIVER=null; sandbox.BRIDGE=null; sandbox.GAMEMODE='conquest';
sandbox.camera={position:{x:0,y:0,z:0}};
sandbox.player={alive:true,pos:{x:0,z:0}};
sandbox.AudioSys={explosion(){}}; sandbox.addTrauma=()=>{}; sandbox.spawnP=()=>{}; sandbox.PT={};
sandbox.spawnWallDebris=()=>{};
sandbox.TAU=Math.PI*2; sandbox.HPI=Math.PI/2;
const ctx=vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root,'js/00-config.js'),'utf8'),ctx,{filename:'js/00-config.js'});
const CAMP=vm.runInContext('CAMPAIGN',ctx);
const terr=makeTerrain(CAMP);
ctx.heightAt=terr.heightAt; ctx.roadDist=terr.roadDist; ctx.sineRoadZ=(x)=>3*Math.sin(x*0.02);
ctx.inRiverChannel=terr.inRiverChannel; ctx.onBridge=terr.onBridge; ctx.inShallowChannel=terr.inShallowChannel;
ctx.FLATS=terr.FLATS; ctx.bridgeDeckY=terr.bridgeDeckY;
// 建筑地基平台 (2026-09-20): 03-terrain 副本的 PADS/addPad 注入沙箱 (05-world foundation 调用)
ctx.PADS=terr.PADS; if(!(typeof process!=='undefined'&&process.env&&process.env.PADS_OFF)) ctx.addPad=terr.addPad; // PADS_OFF=1: negative control (old terrain without building pads)
// 环礁语义 (2026-09-18 塔拉瓦批): SEA + 岸线距离场/水深/水面 同构注入 (05b/05c 布局期共读)
ctx.SEA=CAMP.sea||null; ctx.shoreZAt=terr.shoreZAt; ctx.northZAt=terr.northZAt; ctx.coastXAt=terr.coastXAt; ctx.shoreDist=terr.shoreDist; ctx.seaDepthAt=terr.seaDepthAt;
ctx.seaChannelMask=terr.seaChannelMask; ctx.seaLandH=terr.seaLandH; ctx.rectDist=terr.rectDist;
ctx.waterYAt=terr.waterYAt; ctx.waterDepthAt=terr.waterDepthAt; ctx.inSea=terr.inSeaAt; ctx.inWaterBody=terr.inWaterBody;
ctx.WATER_SURF=[]; ctx.waterSurfReg=(x,z,wy,hw)=>{ ctx.WATER_SURF.push({x,z,wy,hw}); };
ctx.waterSurfRegStrip=(samples,hw)=>{ for(const s of samples) ctx.WATER_SURF.push({x:s.x,z:s.z,wy:s.wy,hw}); }; // 2026-09-28C 补同步 (水面批漏了本副本)
ctx.DELTA=CAMP.delta||null; ctx.DELTA_CHANS=(CAMP.delta&&CAMP.delta.channels)||[];
ctx.LOESS=CAMP.loess||null; ctx.ALPINE=CAMP.alpine||null;
ctx.WOOD=CAMP.wood||null; ctx.woodRavineDist=terr.woodRavineDist; ctx.woodRampMask=terr.woodRampMask; // 许特根: 北谷副本注入 (2026-09-13)
ctx.BRIDGES=CAMP.bridges||(CAMP.bridge?[CAMP.bridge]:[]);
ctx.BRIDGE=ctx.BRIDGES[0]||null;
// 03-terrain 的农田系统全局 (沙箱未加载本体, 同公式注入): 田块表+查田块
ctx.RURAL_FIELDS=CAMP.fields||[];
ctx.fieldAt=(x,z)=>{ for(const f of ctx.RURAL_FIELDS){ if(x>=f.x0&&x<=f.x1&&z>=f.z0&&z<=f.z1) return f; } return null; };
// 2026-09-05 城市组桩: CITY/streetDist (03-terrain 同构, 供 05c buildWorld 植被让位)
ctx.CITY=CAMP.city||null;
ctx.streetDist=(x,z)=>{ const CT=CAMP.city; if(!CT) return 1e9; let bd=1e9; for(const s of CT.streets){ if(x>=s.x0&&x<=s.x1&&z>=s.z0&&z<=s.z1) return 0; const dx=Math.max(s.x0-x,0,x-s.x1), dz=Math.max(s.z0-z,0,z-s.z1); const d=Math.hypot(dx,dz); if(d<bd) bd=d; } return bd; };
ctx.cityUrban=(x,z)=>{ const CT=CAMP.city; if(!CT) return false; if(CT.blocks) for(const s2 of CT.blocks){ if(x>=s2.x0&&x<=s2.x1&&z>=s2.z0&&z<=s2.z1) return true; } if(CT.yard&&x>=CT.yard.x0&&x<=CT.yard.x1&&z>=CT.yard.z0&&z<=CT.yard.z1) return true; return false; };

// 05-world 已切分: 框架 → 建筑实例 → 道具植被 → 布局/组装 (顺序不可变)
vm.runInContext(fs.readFileSync(path.join(root,'js/04b-fire.js'),'utf8'),ctx,{filename:'js/04b-fire.js'});
vm.runInContext(fs.readFileSync(path.join(root,'js/05-world.js'),'utf8'),ctx,{filename:'js/05-world.js'});
vm.runInContext(fs.readFileSync(path.join(root,'js/05a-buildings.js'),'utf8'),ctx,{filename:'js/05a-buildings.js'});
vm.runInContext(fs.readFileSync(path.join(root,'js/05b-props.js'),'utf8'),ctx,{filename:'js/05b-props.js'});
vm.runInContext(fs.readFileSync(path.join(root,'js/05c-layouts.js'),'utf8'),ctx,{filename:'js/05c-layouts.js'});
return {ctx,CAMP};
}
// ── 测试主体 ──
const idx=process.argv[2]!==undefined?parseInt(process.argv[2]):7;
const {ctx,CAMP}=runCampaign(idx);
const DES=vm.runInContext('DESTRUCTIBLES',ctx);
const REG=vm.runInContext('BUILD_REG',ctx);
const BOXES=vm.runInContext('BOXES',ctx);
const destroy=vm.runInContext('destroyStructure',ctx);
const world=vm.runInContext('world',ctx);
console.log(`== ${CAMP.id} (${CAMP.layout}) 可毁组=${DES.length} ==`);
// 收集所有挂 roofRef 的墙组, 按 ref 归组
const byRef=new Map();
for(const g of DES){
if(g.roofRef&&!g.dead){ if(!byRef.has(g.roofRef)) byRef.set(g.roofRef,[]); byRef.get(g.roofRef).push(g); }
}
console.log(`带屋顶引用的存活墙组数=${byRef.size} 组`);
let roofIdx=0;
for(const [ref,gs] of byRef){
roofIdx++;
const alive0=gs.length;
const meshes0=ref.m.filter(m=>m.parent).length;
console.log(`\n[屋顶#${roofIdx}] 支撑墙组=${alive0} 存活视觉部件=${meshes0} 带条目=${ref.bands?ref.bands.length:0} ref.dead=${ref.dead} done=${ref.done}`);
for(let i=0;i<gs.length;i++){
destroy(gs[i],true);
const alive=gs.filter(g=>!g.dead).length;
const vis=ref.m.filter(m=>m.parent).length;
const bands=ref.bands||[];
const bAlive=bands.filter(b=>!b.dead).length;
console.log(`  炸第${i+1}墙 → 残余墙=${alive} 屋顶视觉=${vis} 带/部件活着=${bAlive} done=${ref.done}`);
}
if(!ref.done) console.log('  ⚠ 全部墙炸完屋顶仍未消失 !!');
else if(ref.m.some(m=>m.parent)) console.log('  ⚠ done=true 但仍有视觉部件在世 !!');
}
// 检查坍塌后残留碰撞体: 屋顶带以"mesh"形式存于 bands 时 killBox 是否真正杀掉了碰撞盒
let leak=0;
for(const g of DES){
if(!g.roofRef||!g.roofRef.done) continue;
const bands=g.roofRef.bands||[];
for(const b of bands){
if(b.minX!==undefined&&b.minX<99990) leak++; // 真实碰撞盒还活着
}
}
console.log(`\n残留碰撞盒(应≥4/屋顶的斜坡带盒): ${leak}   (注意: bands 里混存的是 mesh 还是 box 需看此数)`);
// ── 2026-09-01 运行期倒塌回归(非silent, 新语义): 墙毁→屋顶即刻碎块塌落,
//    坡板/山墙(ref.m) 与 阶梯带网格(band.mesh) 必须全部从场景移除 —— 屋顶浮空 bug 的直接断言 ──
{
const rt=runCampaign(idx);
const D2=vm.runInContext('DESTRUCTIBLES',rt.ctx);
const destroyRT=vm.runInContext('destroyStructure',rt.ctx);
const byRef2=new Map();
for(const g of D2){ if(g.roofRef&&!g.dead){ if(!byRef2.has(g.roofRef)) byRef2.set(g.roofRef,[]); byRef2.get(g.roofRef).push(g); } }
let rtFail=0,rtRoofs=0,rtWalls=0;
for(const [ref,gs] of byRef2){
 rtRoofs++;
 for(let i=0;i<gs.length;i++){
 if(ref.done) break;
 destroyRT(gs[i],false);
 rtWalls++;
 }
 if(!ref.done){ console.log('  ⚠ RT: 全部墙炸完屋顶未坍塌 !!'); rtFail++; continue; }
 const visM=(Array.isArray(ref.m)?ref.m:[ref.m]).filter(m=>m&&m.parent).length;
 let visB=0; const seenB=new Set();
 for(const b of (ref.bands||[])){ if(b&&b.mesh&&b.mesh.parent&&!seenB.has(b.mesh)){ seenB.add(b.mesh); visB++; } }
 const bAlive=(ref.bands||[]).filter(b=>!b.dead).length;
 if(visM||visB||bAlive){ console.log(`  ⚠ RT: 坍塌后残留 坡板/山墙=${visM} 阶梯带网格=${visB} 活碰撞带=${bAlive} (屋顶浮空) !!`); rtFail++; }
}
console.log(`运行期倒塌(非silent): ${rtRoofs} 处屋顶 / 摧毁 ${rtWalls} 面墙 → 残留 ${rtFail} 处 ${rtFail===0?'✓':'✗'}`);
}
// ── 2026-09-05 用户实机反馈回归: 整楼拆光后二楼/三楼楼板与楼梯不得浮空 ——
//    ruinBlock 层间楼板+踏步楼梯 / 红十月走台已挂入塌顶链 (碰撞盒带 building 标记):
//    全部墙组炸完后, 每栋多层建筑/厂房的挂牌构件必须全部死盒 (网格随 killBox 离场) ──
{
const allIds=vm.runInContext('CAMPAIGNS.map(c=>c.id)',ctx);
const cityIdxs=[];
allIds.forEach((id,i)=>{ if(id==='stalingrad'||id==='berlin') cityIdxs.push(i); });
let pf=0, checked=0;
for(const ci of cityIdxs){
const r2=runCampaign(ci);
const D3=vm.runInContext('DESTRUCTIBLES',r2.ctx);
const BX3=vm.runInContext('BOXES',r2.ctx);
const RG3=vm.runInContext('BUILD_REG',r2.ctx);
const des3=vm.runInContext('destroyStructure',r2.ctx);
for(const g of D3){ if(g.roofRef&&!g.dead) des3(g,false); } // 全拆 → 每栋必塌顶
for(const reg of RG3){
const slabs=BX3.filter(b=>b.building===reg);
if(!slabs.length) continue;
checked++;
const alive=slabs.filter(b=>!b.dead).length;
if(alive){ console.log(`  ⚠ ${r2.CAMP.id} ${reg.type}@(${reg.x.toFixed(0)},${reg.z.toFixed(0)}) 塌顶后浮空构件=${alive}`); pf+=alive; }
}
}
console.log(`楼板/楼梯煎饼断言: ${checked} 栋多层/厂房, 塌顶后浮空构件 ${pf} ${pf===0?'✓':'✗'}`);
global.__pfFail=pf;
}
// 建筑登记: 每栋可毁房的 roofY
for(const b of REG){
if(['cnHouse','ruinedHouse','logCabin'].includes(b.type)){
const near=DES.filter(g=>g.roofRef&&!g.dead&&Math.hypot(g.cx-b.x,g.cz-b.z)<Math.max(b.w,b.d));
console.log(`${b.type}@(${b.x.toFixed(0)},${b.z.toFixed(0)}) roofY=${b.roofY&&b.roofY.toFixed(2)} 附近带顶墙组=${near.length}`);
}
}
// ── 2026-09-05 用户实机反馈回归: "振金楼"修复 —— 任一楼层被掏空(该层剩≤1面墙)必须整楼坍塌。
//    (前提天然受检: 墙组没挂 roofRef 或 block 墙组缺 wFloor 标记 → 本断言收不到多层楼/楼层计数失效而失败;
//     旧行为 8~12 组墙须拆到剩≤2 才塌 = 轰掉整面可见墙楼不塌) ──
{
const allIds2=vm.runInContext('CAMPAIGNS.map(c=>c.id)',ctx);
const cityIdxs2=[];
allIds2.forEach((id,i)=>{ if(id==='stalingrad'||id==='berlin') cityIdxs2.push(i); });
let nB=0, nFail=0;
for(const ci of cityIdxs2){
const r3=runCampaign(ci);
const D4=vm.runInContext('DESTRUCTIBLES',r3.ctx);
const des4=vm.runInContext('destroyStructure',r3.ctx);
const byR=new Map();
for(const g of D4){
if(!g.roofRef||g.dead||g.wFloor===undefined) continue;
if(!byR.has(g.roofRef)) byR.set(g.roofRef,[]);
byR.get(g.roofRef).push(g);
}
for(const [ref,gs] of byR){
const floors=[...new Set(gs.map(g=>g.wFloor))].sort((a,b)=>a-b);
if(floors.length<2) continue; // 单层厂房走原 ≤2 规则, 不测掏空
nB++;
const gut=gs.filter(g=>g.wFloor===floors[0]);
for(const g of gut) des4(g,false); // 掏空最底层
if(!ref.done){ console.log(`  ⚠ ${r3.CAMP.id} ${floors.length}层楼掏空底层(${gut.length}面墙)后仍未坍塌 (振金)`); nFail++; }
}
}
console.log(`楼层掏空坍塌断言: ${nB} 栋多层楼, 未塌 ${nFail} ${nFail===0?'✓':'✗'}`);
global.__pfFail=(global.__pfFail||0)+nFail;
}
// ── 2026-09-05 用户实机反馈回归: 竖向承重链 —— 毁掉某层一面墙, 正上方楼层的同面墙必须随之垮塌
//    (修"二楼墙浮空": 底层墙被打掉后上层同面墙失去支承仍挂在原位) ──
{
const allIds3=vm.runInContext('CAMPAIGNS.map(c=>c.id)',ctx);
const cityIdxs3=[];
allIds3.forEach((id,i)=>{ if(id==='stalingrad'||id==='berlin') cityIdxs3.push(i); });
let nC=0, nFail=0;
for(const ci of cityIdxs3){
const r4=runCampaign(ci);
const D5=vm.runInContext('DESTRUCTIBLES',r4.ctx);
const des5=vm.runInContext('destroyStructure',r4.ctx);
for(const g of D5){
if(g.dead||g.wFloor!==0||!g.wallAbove||g.wallAbove.dead) continue;
nC++;
des5(g,false); // 毁底层一面墙
if(!g.dead){ console.log(`  ⚠ ${r4.CAMP.id} 底层墙未死?`); nFail++; continue; }
if(!g.wallAbove.dead){ console.log(`  ⚠ ${r4.CAMP.id} 毁${g.wFloor}层墙 → 上层同面墙仍存活 (竖向承重链断裂)`); nFail++; continue; }
if(g.wallAbove.wallAbove&&!g.wallAbove.wallAbove.dead){ console.log(`  ⚠ ${r4.CAMP.id} 三层楼竖向链在第二级断裂`); nFail++; }
break; // 每图抽一栋验证即可
}
}
console.log(`竖向承重链断言: ${nC} 栋抽样, 断裂 ${nFail} ${nFail===0?'✓':'✗'}`);
global.__pfFail=(global.__pfFail||0)+nFail;
}
// ── 2026-09-06 P1-2: 柏林地铁凉亭平顶挂链断言 —— 只炸凉亭三面墙 → 顶必塌、无浮空构件
//    (旧版平顶是裸 solidBox 无挂链: 墙炸光后 2.6m 石顶+雪帽悬空且可站人; 修=手造 roofRef 挂三墙组) ──
{
let pvFail=0, pvN=0;
const allIds5=vm.runInContext('CAMPAIGNS.map(c=>c.id)',ctx);
allIds5.forEach((id,i)=>{ if(id==='berlin'){
const r5=runCampaign(i);
const D5=vm.runInContext('DESTRUCTIBLES',r5.ctx);
const BX5=vm.runInContext('BOXES',r5.ctx);
const RG5=vm.runInContext('BUILD_REG',r5.ctx);
const des5=vm.runInContext('destroyStructure',r5.ctx);
for(const reg of RG5){
if(reg.type!=='metro') continue;
pvN++;
const slabBs=BX5.filter(b=>b.building===reg);
if(!slabBs.length){ console.log(`  ⚠ berlin metro 平顶碰撞盒未挂 building 标记`); pvFail++; continue; }
// 凉亭承重墙 = roofRef.bands 与平顶盒有交集的存活墙组; 只炸它们 (不触其他建筑)
const walls=D5.filter(g=>g.roofRef&&!g.dead&&g.roofRef.bands.some(b=>slabBs.includes(b)));
if(walls.length<2){ console.log(`  ⚠ berlin metro 承重墙识别异常 (${walls.length} 组)`); pvFail++; continue; }
for(const g of walls) des5(g,false);
const ref=walls[0].roofRef;
if(!ref.done){ console.log(`  ⚠ berlin 凉亭三墙全毁 → 平顶仍未坍塌 (挂链失效)`); pvFail++; }
const alive=slabBs.filter(b=>!b.dead).length;
if(alive){ console.log(`  ⚠ berlin 凉亭塌顶后浮空平顶碰撞盒=${alive}`); pvFail+=alive; }
const visAlive=(Array.isArray(ref.m)?ref.m:[ref.m]).filter(m=>m&&m.parent).length;
if(visAlive){ console.log(`  ⚠ berlin 凉亭塌顶后平顶视觉网格仍在场 (${visAlive})`); pvFail+=visAlive; }
}
}});
console.log(`凉亭平顶挂链断言: ${pvN} 处 metro, 浮空/未塌 ${pvFail} ${pvFail===0?'✓':'✗'}`);
global.__pfFail=(global.__pfFail||0)+pvFail;
}
// ── ★2026-09-19 用户实机反馈回归: ① 椰子木掩体的顶部盖板/覆沙层/原木横条必须随墙塌落
//    (旧版四墙 destr:true 但顶盖与横条不挂链 ⇒ 墙炸光后顶盖浮空 —— 截图就是它);
//    ② 塔顶平台的防空炮必须随平台一起消失 (旧版炮挂在 world 上不动 ⇒ 塔塌后炮悬空还能被操作) ──
{
const allIds6=vm.runInContext('CAMPAIGNS.map(c=>c.id)',ctx);
let lbFail=0, lbN=0, aaFail=0, aaN=0;
allIds6.forEach((id,i)=>{
const r6=runCampaign(i);
const D6=vm.runInContext('DESTRUCTIBLES',r6.ctx);
const des6=vm.runInContext('destroyStructure',r6.ctx);
const RG6=vm.runInContext('BUILD_REG',r6.ctx);
// ① 椰子木掩体: 找到挂在 logBunker 上的屋顶链 (按登记坐标就近匹配), 炸光承重墙 → 顶盖+横条必须离场
for(const reg of RG6){
if(reg.type!=='logbunker') continue;
lbN++;
const ref=D6.map(g=>g.roofRef).find(rf=>rf&&rf.m&&rf.m.length&&rf.carry&&rf.carry.some(w=>Math.hypot(w.cx-reg.x,w.cz-reg.z)<3.5));
if(!ref){ console.log(`  ⚠ ${id} logBunker@(${reg.x.toFixed(0)},${reg.z.toFixed(0)}) 顶部未挂坍塌链 (墙塌后顶盖必浮空)`); lbFail++; continue; }
const before=(Array.isArray(ref.m)?ref.m:[ref.m]).filter(m=>m&&m.parent).length;
for(const wg of ref.carry.slice()) if(!wg.dead) des6(wg,false);
const after=(Array.isArray(ref.m)?ref.m:[ref.m]).filter(m=>m&&m.parent).length;
if(!ref.done){ console.log(`  ⚠ ${id} logBunker@(${reg.x.toFixed(0)},${reg.z.toFixed(0)}) 四墙炸光仍未塌顶`); lbFail++; }
if(after){ console.log(`  ⚠ ${id} logBunker@(${reg.x.toFixed(0)},${reg.z.toFixed(0)}) 塌顶后仍有 ${after}/${before} 件顶部构件浮空`); lbFail+=after; }
}
// ② 塔顶防空炮: 塌塔顶平台 → AAGUNS 里挂在该平台上的炮必须 dead 且网格离场
const AA6=vm.runInContext('typeof AAGUNS!=="undefined"?AAGUNS:[]',r6.ctx);
const deckGuns=AA6.filter(g=>g&&g.deck);
aaN+=deckGuns.length;
for(const g of deckGuns){
if(g.dead) continue;
const ref=g.deck;
for(const wg of (ref.carry||[]).slice()) if(!wg.dead) des6(wg,false);
if(!g.dead){ console.log(`  ⚠ ${id} 塔顶平台塌了但防空炮仍存活 @(${g.x.toFixed(0)},${g.z.toFixed(0)}) —— 会浮空`); aaFail++; }
else if(g.grp&&g.grp.parent){ console.log(`  ⚠ ${id} 防空炮已标 dead 但视觉网格仍挂在场 (浮空)`); aaFail++; }
}
});
console.log(`掩体顶盖随墙塌断言: ${lbN} 处椰子木掩体, 浮空/未塌 ${lbFail} ${lbFail===0?'✓':'✗'}`);
console.log(`塔顶防空炮随平台消失断言: ${aaN} 门平台炮, 浮空 ${aaFail} ${aaFail===0?'✓':'✗'}`);
global.__pfFail=(global.__pfFail||0)+lbFail+aaFail;
}
console.log('--- DESTRUCTIBLES 明细 ---');for(const g of DES){
console.log(`组@(${g.cx.toFixed(1)},${g.cz.toFixed(1)}) hp=${g.hp} dead=${g.dead} boxes=${g.bi.length} meshes=${g.meshes.length} roofRef=${g.roofRef?'有':'无'}`);
}
console.log('--- REG 明细 ---');
for(const b of REG){
console.log(`${b.type}@(${b.x.toFixed(1)},${b.z.toFixed(1)}) ${b.roofY!==undefined&&b.roofY!==null&&b.w!==undefined?`w=${b.w} d=${b.d} roofY=${b.roofY.toFixed(2)}`:''}`);
}
console.log('OK');
if(global.__pfFail) process.exit(1);
