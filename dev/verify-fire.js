// ─────────────────────────────────────────────
// dev/verify-fire.js —— 植被燃烧/火焰蔓延/树木倒伏机制验证 (不进 Index.html)
// 在验证沙箱中运行 00-config + 04b-fire + 05-world/05a/05b/05c (与浏览器载入顺序一致),
// 检查:
//  1) 世界构建后燃料格/活树/灌木/可燃实例批均已登记;
//  2) 点燃一个燃料格 → 火焰向邻格蔓延 → 燃料耗尽后全部熄灭;
//  3) 树木: 点燃 → 树冠着火 → 倒伏 → 碰撞体即杀 → 烧尽焦黑退场;
//  4) 爆炸掀树/炸没灌木, 坦克碾压撞树;
//  5) 火焰对格内士兵持续伤害且击杀归点火者; 火源 (残骸) 点燃周边并按时退场。
// 用法: node dev/verify-fire.js [campaignIdx...]
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
class Quat{ constructor(){ this.x=0;this.y=0;this.z=0;this.w=1; } setFromUnitVectors(){ return this; } identity(){ this.x=0;this.y=0;this.z=0;this.w=1; return this; } setFromEuler(){ return this; } setFromAxisAngle(){ return this; } premultiply(){ return this; } multiply(){ return this; } }
class Scl{ constructor(){ this.x=1;this.y=1;this.z=1; } set(x,y,z){this.x=x;this.y=y;this.z=z;return this;} setScalar(s){this.x=s;this.y=s;this.z=s;return this;} }
class Obj3{ constructor(){ this.position=new P3(); this.rotation=new Rot(); this.scale=new Scl(); this.quaternion=new Quat(); this.children=[]; this.parent=null; this.matrix={}; this.castShadow=false; this.receiveShadow=false; this.visible=true; this.renderOrder=0; this.frustumCulled=true; this.userData={}; this.updateMatrix=()=>{}; }
add(m){ this.children.push(m); m.parent=this; } remove(m){ const i=this.children.indexOf(m); if(i>=0){ this.children.splice(i,1); m.parent=null; } }
traverse(fn){ fn(this); for(const c of this.children) if(c.traverse) c.traverse(fn); } }
class Geo{ constructor(...a){ this.parameters={width:a[0]||1,height:a[1]||1,depth:a[2]||1}; } translate(){return this;} rotateX(){return this;} rotateY(){return this;} setAttribute(n,a){ this.attributes=this.attributes||{}; this.attributes[n]=a; return this; } setIndex(i){ this.index={array:(i&&i.length!==undefined)?i:[]}; return this; } computeVertexNormals(){ return this; } }
class PlaneGeo extends Geo{ constructor(w=1,h=1,sg=1,sh=1){ super(w,h); const gx=(sg||1)+1, gy=(sh||1)+1; this.attributes={position:{count:gx*gy,array:new Float32Array(gx*gy*3),getX:i=>((i%gx)/gx-0.5)*w,getZ:i=>(Math.floor(i/gx)/gy-0.5)*h,getY:()=>0,setY(){},setX(){},setZ(){}}}; this.index=null; } }
class M4{ constructor(){ this._zero=false; } compose(){ return this; } makeScale(x,y,z){ this._zero=(x===0&&y===0&&z===0); return this; } }
class Col{ constructor(h){ this.h=h; } setHex(h){ this.h=h; return this; } set(){ return this; } }
class IM extends Obj3{ constructor(g,m,n){ super(); this.geometry=g; this.material=m; this.count=n; this.mats=[]; this.instanceMatrix={needsUpdate:false}; this.instanceColor=null; }
setMatrixAt(i,m){ this.mats[i]=m; } setColorAt(i,c){ this.instanceColor=this.instanceColor||{needsUpdate:false}; } }
return {
Group:class extends Obj3{}, Mesh:class extends Obj3{ constructor(g,m){ super(); this.geometry=g||new Geo(); this.material=m||{}; } },
InstancedMesh:IM, Object3D:Obj3, Vector3:P3, Quaternion:Quat, CanvasTexture:class{ constructor(c){ this.image=c; } },
Euler:class{ set(){ return this; } },
Matrix4:M4, Color:Col,
BoxGeometry:Geo, CylinderGeometry:Geo, PlaneGeometry:PlaneGeo, SphereGeometry:Geo, ConeGeometry:Geo, TorusGeometry:Geo, CircleGeometry:Geo,
MeshLambertMaterial:class{ constructor(o){ Object.assign(this,o||{}); if(!this.color) this.color=new Col(0xffffff); } },
MeshBasicMaterial:class{ constructor(o){ Object.assign(this,o||{}); if(!this.color) this.color={set(){}}; } },
BufferGeometry:class{ constructor(){ this.attributes={}; } setAttribute(n,a){ this.attributes[n]=a; return this; } setIndex(){return this;} setFromPoints(){return this;} computeVertexNormals(){return this;} },
BufferAttribute:class{ constructor(a,n){ this.array=a; this.itemSize=n; } },
Float32BufferAttribute:class{},
};
}
function makeTerrain(CAMPAIGN){
// ── 03-terrain 副本 (与 dev/verify-rooffall.js 同源): 高度场/道路/河道 ──
// ── 雾林守线副本 (2026-09-13 许特根改版): 北谷(卡尔小径)距离场+堑口遮罩 (与 03-terrain 同构) ──
const WOOD=CAMPAIGN.wood||null;
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
// ★2026-09-26E: 05c _waterStrip 改调条带登记 (相邻采样点成段) —— 本沙箱只做布局, 水面表为空, 同义补桩
function waterSurfRegStrip(samples,hw){ for(const s of samples) WATER_SURF.push({x:s.x,z:s.z,wy:s.wy,hw}); }
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
// 03-terrain 副本: 柏林地铁下沉 (2026-09-09 站厅 halls[]/隧道矩形 + 广场圆, 深度取 max)
const METRO=(CAMPAIGN.city&&CAMPAIGN.city.metro)||null;
const METRO_FALL=0.4;
const METRO_RECTS=[]; // 03-terrain 副本: 站厅表 + 隧道 (共读 config.metro)
if(METRO){ for(const h of (METRO.halls||[])) METRO_RECTS.push(h); if(METRO.tunnel) METRO_RECTS.push(METRO.tunnel); }
function metroDep(x,z){
if(!METRO) return 0;
let dep=0;
const d0=Math.hypot(x-METRO.x,z-METRO.z);
if(d0<METRO.r){ const k=1-d0/METRO.r; dep=Math.max(dep,METRO.d*k*k*(3-2*k)); }
for(const s of METRO_RECTS){
if(!s) continue;
const dx=Math.max(s.x0-x,0,x-s.x1), dz=Math.max(s.z0-z,0,z-s.z1);
const dd=Math.hypot(dx,dz);
if(dd<METRO_FALL){ const k=1-dd/METRO_FALL; dep=Math.max(dep,(s.d||METRO.d)*k*k*(3-2*k)); }
}
return dep;
}
function heightAt(x,z,noBridge){
let h=rawH(x,z);
for(const f of FLATS){ const d=Math.hypot(x-f.x,z-f.z); if(d<f.r){ const s1=1-d/f.r; const s=s1*s1*(3-2*s1); h+=(f.h-h)*s; } }
if(METRO) h-=metroDep(x,z); // 03-terrain 副本: 地铁站厅/通道下沉
if((CAMPAIGN.fields||[]).length&&!CAMPAIGN.city){ const rd=roadDist(x,z); if(rd<4){ const k=1-rd/4; h-=0.45*k*k*(3-2*k); } } // !CITY 门控同 03-terrain 本体 (2026-09-06)
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
function runCampaign(idx){
const THREE=makeThreeStub();
const sandbox={
console,Math,JSON,location:{search:'?seed='+seed},
localStorage:{_s:{sf_campaign:String(idx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=v;}},
navigator:{},
document:{createElement:(t)=>t==='canvas'?({width:0,height:0,getContext:()=>Ctx2D()}):({})},
};
function Ctx2D(){ return { fillStyle:'',strokeStyle:'',lineWidth:1,font:'',textAlign:'',beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},stroke(){},fillRect(){},clearRect(){},fillText(){},arc(){},save(){},restore(){},translate(){},rotate(){},scale(){},closePath(){} }; }
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
sandbox.camera={position:{x:0,y:20,z:0}};
sandbox.player={alive:true,isPlayer:true,team:0,pos:{x:0,y:0,z:0},damage(){},noticeThreat(){}};
sandbox.combatants=[]; sandbox.soldiers=[]; sandbox.tanks=[]; sandbox.planes=[];
sandbox.AudioSys={explosion(){},gunshot(){},click(){},hurt(){}};
sandbox.addTrauma=()=>{};
sandbox.spawnP=()=>{};
sandbox.PT={smoke:1,dark:1,flash:1,blood:1,dirt:1,spark:1};
sandbox.spawnWallDebris=()=>{};
sandbox.TAU=Math.PI*2; sandbox.HPI=Math.PI/2;
sandbox.nowT=0;
sandbox.matchOver=false;
const ctx=vm.createContext(sandbox);
const load=(f)=>vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
load('js/00-config.js');
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
ctx.WATER_SURF=[]; ctx.waterSurfReg=(x,z,wy,hw)=>{ ctx.WATER_SURF.push({x,z,wy,hw}); }; ctx.waterSurfRegStrip=(samples,hw)=>{ for(const s of samples) ctx.WATER_SURF.push({x:s.x,z:s.z,wy:s.wy,hw}); };
ctx.DELTA=CAMP.delta||null; ctx.DELTA_CHANS=(CAMP.delta&&CAMP.delta.channels)||[];
ctx.LOESS=CAMP.loess||null; ctx.ALPINE=CAMP.alpine||null;
ctx.WOOD=CAMP.wood||null; ctx.woodRavineDist=terr.woodRavineDist; ctx.woodRampMask=terr.woodRampMask; // 许特根: 北谷副本注入 (2026-09-13)
ctx.BRIDGES=CAMP.bridges||(CAMP.bridge?[CAMP.bridge]:[]);
ctx.BRIDGE=ctx.BRIDGES[0]||null;
ctx.RURAL_FIELDS=CAMP.fields||[];
ctx.fieldAt=(x,z)=>{ for(const f of ctx.RURAL_FIELDS){ if(x>=f.x0&&x<=f.x1&&z>=f.z0&&z<=f.z1) return f; } return null; };
// 2026-09-05 城市组桩: CITY/streetDist (03-terrain 同构, 供 05c buildWorld 植被让位)
ctx.CITY=CAMP.city||null;
ctx.METRO=(CAMP.city&&CAMP.city.metro)||null; // 2026-09-09 柏林地铁下沉区: freeSpot 让位用
ctx.METRO_RECTS=(()=>{ const M2=CAMP.city&&CAMP.city.metro, a=[]; if(M2){ for(const h of (M2.halls||[])) a.push(h); if(M2.tunnel) a.push(M2.tunnel); } return a; })(); // 2026-09-09 修复: 沙箱漏注入 → freeSpot 地铁让位在沙箱里失效
ctx.streetDist=(x,z)=>{ const CT=CAMP.city; if(!CT) return 1e9; let bd=1e9; for(const s of CT.streets){ if(x>=s.x0&&x<=s.x1&&z>=s.z0&&z<=s.z1) return 0; const dx=Math.max(s.x0-x,0,x-s.x1), dz=Math.max(s.z0-z,0,z-s.z1); const d=Math.hypot(dx,dz); if(d<bd) bd=d; } return bd; };
ctx.cityUrban=(x,z)=>{ const CT=CAMP.city; if(!CT) return false; if(CT.blocks) for(const s2 of CT.blocks){ if(x>=s2.x0&&x<=s2.x1&&z>=s2.z0&&z<=s2.z1) return true; } if(CT.yard&&x>=CT.yard.x0&&x<=CT.yard.x1&&z>=CT.yard.z0&&z<=CT.yard.z1) return true; if(CT.metro){ if(Math.hypot(x-CT.metro.x,z-CT.metro.z)<CT.metro.r) return true; for(const s2 of ctx.METRO_RECTS) if(x>=s2.x0&&x<=s2.x1&&z>=s2.z0&&z<=s2.z1) return true; } return false; };

// 与浏览器 index.html 载入顺序一致: 04b-fire 在 05-world 之前, 05c (buildWorld 载入期执行) 在最后
// 本沙箱不载入 08-effects: 沉入系统 (queueSink/updateWreckSinks/finishSinkJob) 以 no-op 桩代替,
// 真实游戏中由 08-effects 提供, 04b 仅在运行期调用
ctx.queueSink=(job)=>job; ctx.updateWreckSinks=()=>{}; ctx.finishSinkJob=()=>{};
load('js/04b-fire.js');
load('js/05-world.js');
load('js/05a-buildings.js');
load('js/05b-props.js');
load('js/05c-layouts.js');
return {ctx,CAMP};
}
// ─────────────────────────────────────────────
const idxs=process.argv.slice(2).map(s=>parseInt(s)).filter(n=>!isNaN(n));
const list=idxs.length?idxs:[0,5];
let failures=0;
const fail=(msg)=>{ console.log('  ✘ '+msg); failures++; };
const ok=(msg)=>console.log('  ✔ '+msg);
for(const idx of list){
const {ctx,CAMP}=runCampaign(idx);
console.log(`\n======== ${CAMP.id} (${CAMP.layout}) ========`);
const G=(n)=>vm.runInContext(n,ctx);
const TREE_LIVE=G('TREE_LIVE'), BUSH_LIVE=G('BUSH_LIVE'), FLORA_HASH=G('FLORA_HASH'),
FUEL=G('FUEL'), FBURN=G('FBURN'), FHEAT=G('FHEAT'), FN=G('FN'), FRES=G('FRES'), FOFF=G('FOFF'),
FIRE_ACTIVE=G('FIRE_ACTIVE'), FIRE_SOURCES=G('FIRE_SOURCES'), BURN_INST=G('BURN_INST'),
fCellI=G('fCellI'), igniteArea=G('igniteArea'), updateFires=G('updateFires'),
updateFallingTrees=G('updateFallingTrees'), updateBurningTrees=G('updateBurningTrees'),
explosionFlora=G('explosionFlora'), floraCrushTank=G('floraCrushTank'),
treeIgnite=G('treeIgnite'), addFireSource=G('addFireSource');
const FALLING=G('FALLING'), BURNING_TREES=G('BURNING_TREES');
// 1) 构建期登记
let fuelCells=0, fuelSum=0;
for(let i=0;i<FUEL.length;i++){ if(FUEL[i]>0.05){ fuelCells++; fuelSum+=FUEL[i]; } }
const instCells=BURN_INST.reduce((a,b)=>a+b.byCell.size,0);
console.log(`燃料格=${fuelCells} 燃料总量=${fuelSum.toFixed(1)} 活树=${TREE_LIVE.length} 灌木=${BUSH_LIVE.length} 实例批=${BURN_INST.length}(覆盖${instCells}格)`);
if(fuelCells<=0) fail('无任何燃料格');
else ok('燃料已登记');
if(TREE_LIVE.length<=0) fail('无活树记录');
if(BURN_INST.length<=0) fail('无可燃实例批 (草丛/庄稼)');
// 2) 蔓延: 找燃料最密的格子点燃, 模拟 60s
const cc=(ci)=>[(ci%FN)*FRES-FOFF+FRES/2, Math.floor(ci/FN)*FRES-FOFF+FRES/2];
let best=-1,bestN=0;
for(let i=0;i<FN*FN;i++){
if(FUEL[i]<=0.05) continue;
const ci0=i%FN, cj0=(i/FN)|0; let n=0;
for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){
const ni=ci0+di,nj=cj0+dj;
if(ni<0||nj<0||ni>=FN||nj>=FN) continue;
if(FUEL[nj*FN+ni]>0.05) n++;
}
if(n>bestN){ bestN=n; best=i; }
}
if(best<0||bestN<4){ fail('找不到可蔓延的密集燃料区, 跳过蔓延测试'); }
else{
const [bx,bz]=cc(best);
const attacker={team:0,isPlayer:true,kills:0,score:0,alive:true,pos:{x:bx,y:0,z:bz}};
igniteArea(bx,bz,1,attacker);
const seed0=FIRE_ACTIVE.length;
let maxBurning=0;
// 观察窗 (2026-09-20 修): 旧版写死 1200 步 = 60s。I5 植被加密批把 island 的燃料场从 720 格/494.6
// 放大到 3977 格/2793.7 (灌木/椰林立项都进燃料表), 同一把火的烧尽时间从 9.7s 拉到 73.0s ⇒ 60s 窗口
// 会误报"火未熄灭"。这里改为**跑到熄灭为止**(上限 FIRE_WATCH_MAX 秒), 断言仍是"必须烧尽" ——
// 放宽的是观察时间而不是判定标准; 真·烧不尽(燃料无限/蔓延不停)仍会 FAIL。
const FIRE_WATCH_MAX=600;
let burnOutT=-1;
for(let s=0;s<FIRE_WATCH_MAX/0.05;s++){
updateFires(0.05);
if(FIRE_ACTIVE.length>maxBurning) maxBurning=FIRE_ACTIVE.length;
if(FIRE_ACTIVE.length===0){ burnOutT=(s+1)*0.05; break; }
}
console.log(`点燃${seed0}格 → 峰值燃烧=${maxBurning}格, ${burnOutT>=0?('烧尽用时 '+burnOutT.toFixed(1)+'s'):('观察窗 '+FIRE_WATCH_MAX+'s 内未烧尽, 存活火='+FIRE_ACTIVE.length)}`);
// 天气感知判据 (2026-10-05 口追①②: 天气压火 + 总体削弱): FIRE_SPREAD=总削0.8×WX_CFG.fireMul。
// 积热率 = 0.85×FIRE_SPREAD (正交邻格) vs 冷却率 0.25 —— 重档 (暴雨/暴风雪 fireMul 0.35 ⇒ 0.238/s)
// 积热追不上冷却, 火不成链是**设计行为** (同判据见 verify-weather T7); 其余档维持旧不变量"密集燃料区必成链"。
const FIRE_SPREAD_G=G('FIRE_SPREAD');
const netRate=0.85*FIRE_SPREAD_G-0.25;
if(netRate<=0){
if(maxBurning>seed0) fail('重档天气仍成链 (fireMul 未生效?)');
else ok(`重档天气火被压制 (积热 ${(0.85*FIRE_SPREAD_G).toFixed(3)}/s < 冷却 0.25/s, 峰值=${maxBurning}格, 设计行为)`);
}
else if(maxBurning<seed0+2) fail('火焰未蔓延 (峰值≤点燃数)');
else ok('火焰可向邻格蔓延');
if(FIRE_ACTIVE.length>0) fail('燃料耗尽后火未熄灭 (观察窗 '+FIRE_WATCH_MAX+'s 用尽)');
else ok('燃料烧尽后火焰自灭');
}
// 3) 树木: 点燃→倒伏→焦黑退场
{
const tr=TREE_LIVE.find(t=>t.alive&&t.burnT<0);
if(!tr){ fail('无可用活树做燃烧测试'); }
else{
treeIgnite(tr,null);
if(!BURNING_TREES.includes(tr)) fail('点燃后未进入燃烧列表');
let fell=false, charred=false;
for(let s=0;s<400;s++){ updateBurningTrees(0.05); updateFallingTrees(0.05); updateFires(0.05); if(tr.fall) fell=true; if(!BURNING_TREES.includes(tr)){ charred=true; break; } }
if(!fell) fail('树冠着火后未倒伏');
else ok('燃烧的树会倒下');
if(!tr.cyl||tr.cyl.r!==0) fail('倒伏后树干碰撞体未移除 (r='+(tr.cyl&&tr.cyl.r)+')');
else ok('倒伏后树干碰撞体即杀');
if(!charred) fail('燃烧树未烧尽退场');
else ok('烧尽后退场 (树冠消失/树干焦黑)');
}
}
// 4) 爆炸掀树 + 炸没灌木
{
const tr=TREE_LIVE.find(t=>t.alive);
if(tr){
explosionFlora({x:tr.x+1.2,y:0,z:tr.z},5);
if(!tr.fall) fail('近距爆炸未掀倒树木');
else ok('爆炸掀倒近距树木');
for(let s=0;s<120;s++) updateFallingTrees(0.05);
if(FALLING.length) fail('倒伏动画未结束 (FALLING=' + FALLING.length + ')');
else ok('倒伏动画收敛');
}
const bush=BUSH_LIVE.find(b=>!b.dead);
if(bush){
explosionFlora({x:bush.x,y:0,z:bush.z},4);
if(!bush.dead) fail('爆炸未摧毁灌木');
else ok('爆炸炸没灌木');
}
}
// 4b) 枯树/椰树: 近距爆炸立即倒伏 (倒向背离爆心) + 残骸登记沉入 (2026-09-26 用户报"这两类没有乔木那样
//     被炸到就向爆心反方向倒下" ⇒ 旧版此二类走 vanishFlora = 原地消失, 本节就是该行为的判据)
{
const pick=(kind)=>{
let r=null;
for(const arr of FLORA_HASH.values()){
for(const rec of arr){
if(rec.kind===kind&&rec.alive&&!rec.dead&&!rec.fall&&rec.meshes&&rec.meshes.length&&rec.meshes[0].parent){ r=rec; break; }
}
if(r) break;
}
return r;
};
for(const kind of ['dead','palm']){
const label=(kind==='dead'?'枯树':'椰树');
const rec=pick(kind);
if(!rec){ console.log('  ⚠ 本布局无'+label+', 跳过其倒伏测试'); continue; }
const bx=rec.x-1.2, bz=rec.z;                       // 爆心在株心西侧 1.2m (半径 5 ⇒ 近距档 4.65)
const m0=rec.meshes[0];
const p0={x:m0.position.x,z:m0.position.z}, q0w=m0.quaternion?m0.quaternion.w:1;
explosionFlora({x:bx,y:0,z:bz},5);
if(!rec.fall) fail(label+' 近距爆炸未倒伏 (旧版此二类直接 vanish=原地消失)');
else ok(label+' 近距爆炸立即倒伏');
if(rec.dead) fail(label+' 被当作"炸没"处理 (dead=true, 无倒伏残骸)');
else ok(label+' 走倒伏/沉入链 (dead 仍为 false)');
if(rec.cyl&&rec.cyl.r!==0) fail(label+' 倒伏后树干碰撞体未移除 (r='+rec.cyl.r+')');
else ok(label+' 倒伏后树干碰撞体即杀');
if(rec.fall){
const f0=rec.fall;
// 倒向判据: 倒向单位向量与"爆心→株心"同向 (背离爆心)
const dot=f0.dx*(rec.x-bx)+f0.dz*(rec.z-bz);
if(dot<=0.1) fail(label+' 倒向错误 (未背离爆心: dir·(株-爆)='+dot.toFixed(2)+')');
else ok(label+' 倒向背离爆心 (dot='+dot.toFixed(2)+')');
for(let s=0;s<120;s++) updateFallingTrees(0.05);
if(FALLING.includes(rec)) fail(label+' 倒伏动画未收敛');
else ok(label+' 倒伏动画收敛');
if(!rec.sinkQ) fail(label+' 倒伏残骸未登记沉入 (会永久留在场上)');
else ok(label+' 倒伏残骸已登记沉入 (16~22s 后 3.6s 沉入)');
// 姿态真的被改写: 枯树 (网格绕根平移) 看 x/z, 椰树 (整组绕根翻转) 看四元数
if(m0.position&&(m0.position.x!==p0.x||m0.position.z!==p0.z)) ok(label+' 网格位置已被改写 (倒伏可见)');
else if(m0.quaternion&&m0.quaternion.w!==q0w) ok(label+' 网格姿态已被改写 (倒伏可见)');
else fail(label+' 倒伏后网格变换无任何变化 (动画空转)');
// 阴性对照: 已倒伏株再挨一发 ⇒ 不重登记 (同一残骸只挂一个沉入任务)
explosionFlora({x:bx,y:0,z:bz},5);
if(rec.fall!==f0) fail(label+' 已倒伏株被二次登记 (同一残骸挂两个沉入任务 ⇒ y 基线互踩会跳变)');
else ok(label+' 已倒伏株不响应后续爆炸 (沉入任务唯一)');
}
}
// 阳性对照: 灌木仍走"炸没" —— 证明上面对枯树/椰树的加宽没有把整张表误并进倒伏口径
const bw=BUSH_LIVE.find(b=>!b.dead);
if(bw){
explosionFlora({x:bw.x,y:0,z:bw.z},4);
if(!bw.dead) fail('灌木未被炸没 (倒伏口径误并)');
else ok('灌木仍走"炸没" (倒伏口径未外溢)');
}
}
// 5) 坦克碾压 (2026-09-12 改为车体舱段接触判定: 正面/侧面/倒车一致)
{
const tr=TREE_LIVE.find(t=>t.alive);
if(tr){
// 侧身: 树在坦克侧面 2m (旧版唯一能触发碾压的姿态, 应保持可碾)
const tank={pos:{x:tr.x+2,y:0,z:tr.z},vel:3,yaw:0};
floraCrushTank(tank);
if(!tr.fall) fail('坦克侧身擦过未撞倒树 (舱段垂距=2.0, 阈值='+(1.75+0.35*tr.s).toFixed(2)+')');
else ok('坦克侧身擦过撞倒树');
for(let s=0;s<120;s++) updateFallingTrees(0.05);
// 正面: 车头正前方 3.6m 直冲 (旧版被树干圆柱拦停在 3.8m 外永远够不到, 必须可碾)
const tr2=TREE_LIVE.find(t=>t.alive&&!t.fall);
if(tr2){
const tank2={pos:{x:tr2.x,y:0,z:tr2.z-3.6},vel:3,yaw:0}; // yaw=0 → 朝 +z 冲向树
floraCrushTank(tank2);
if(!tr2.fall) fail('坦克正面冲撞未撞倒树 (车头接触, 阈值='+(1.75+0.35*tr2.s).toFixed(2)+')');
else ok('坦克正面冲撞撞倒树 (旧版拦停盲区已修)');
for(let s=0;s<120;s++) updateFallingTrees(0.05);
}
// 倒车: 车尾撞树 → 树应向车尾方向倒 (与运动方向一致)
const tr3=TREE_LIVE.find(t=>t.alive&&!t.fall);
if(tr3){
const tank3={pos:{x:tr3.x,y:0,z:tr3.z-3.6},vel:-3,yaw:0};
floraCrushTank(tank3);
if(!tr3.fall) fail('倒车撞树未触发碾压');
else{
const fx=tr3.fall.dx, fz=tr3.fall.dz; // 车尾方向 = (0,-1) 附近
if(fz>0.3) fail('倒车撞树倒向错误 (倒向车头侧: dz='+fz.toFixed(2)+')');
else ok('倒车撞树向车尾方向倒');
}
for(let s=0;s<120;s++) updateFallingTrees(0.05);
}
// 枯树 (无叶): 车体一碰即碎 —— 只取**仍直立**的枯树 (2026-09-26 起倒伏中的枯树残骸走各自的沉入任务,
// 不再被"碾碎"二次登记, 见 04b floraCrushTank 的 alive===false 早退; 判据要跟着选直立株)
let drec=null;
for(const arr of FLORA_HASH.values()){ for(const rec of arr){ if(rec.kind==='dead'&&!rec.dead&&rec.alive!==false){ drec=rec; break; } } if(drec) break; }
if(!drec) console.log('  ⚠ 本布局无枯树, 跳过枯树碾压');
else{
const tank4={pos:{x:drec.x+2,y:0,z:drec.z},vel:3,yaw:0};
floraCrushTank(tank4);
if(!drec.dead) fail('枯树未被坦克碾碎 (舱段垂距=2.0, 阈值=2.05)');
else{
ok('枯树可被坦克碾碎 (碰撞体即杀)');
if(!drec.cyl||drec.cyl.r!==0) fail('枯树碾碎后树干碰撞体未移除');
}
}
}
}
// 6) 火焰伤害 + 击杀归属
{
// 找一个远离已燃区的燃料格
let ci=-1;
for(let i=0;i<FN*FN;i+=7){ if(FUEL[i]>0.3&&FBURN[i]===0){ const [x,z]=cc(i); if(Math.hypot(x,z)>60){ ci=i; break; } } }
if(ci<0){ console.log('  ⚠ 无独立燃料格, 跳过伤害测试'); }
else{
const [x,z]=cc(ci);
const attacker={team:0,isPlayer:false,kills:0,score:0,alive:true,pos:{x,y:0,z}};
const calls=[];
const fake={alive:true,team:1,isPlayer:false,onVehicle:false,pos:{x,y:0,z},damage(a,att){calls.push([a,att]);},noticeThreat(){}};
ctx.combatants.push(fake);
igniteArea(x,z,0.5,attacker);
updateFires(0.4); // fireDmgT 首帧即触发
ctx.combatants.length=0;
if(!calls.length) fail('格内士兵未受火焰伤害');
else{
if(Math.abs(calls[0][0]-5.2)>0.01) fail('火焰每跳伤害异常: '+calls[0][0]);
else ok('火焰持续伤害生效 ('+calls[0][0].toFixed(1)+'/跳)');
if(calls[0][1]!==attacker) fail('击杀归属错误');
else ok('击杀归点火者');
}
}
}
// 7) 火源: 点燃周边 + 按时退场
{
let ci=-1;
for(let i=0;i<FN*FN;i+=5){ if(FUEL[i]>0.3&&FBURN[i]===0){ ci=i; break; } }
if(ci<0){ console.log('  ⚠ 无燃料格, 跳过火源测试'); }
else{
const [x,z]=cc(ci);
addFireSource(x,z,1,4,0.5,22,null);
for(let s=0;s<10;s++) updateFires(0.05);
if(FBURN[ci]<=0) fail('火源未点燃周边燃料格');
else ok('火源 (残骸) 点燃周边植被');
for(let s=0;s<14;s++) updateFires(0.05);
if(FIRE_SOURCES.length) fail('火源到期未退场');
else ok('火源按时熄灭退场');
}
}
// 8) 数值健全
let nan=0;
for(let i=0;i<FUEL.length;i++) if(!isFinite(FUEL[i])||!isFinite(FHEAT[i])) nan++;
if(nan) fail('燃料/受热数组出现非有限值 ×'+nan);
else ok('数值健全 (无NaN/Inf)');
}
console.log(failures?`\n✘ ${failures} 项未通过`:'\n全部通过 ✔');
process.exit(failures?1:0);
