// ★2026-11-17: 05b _hedgeBlobGeo (叶团重做) 真读 SphereGeometry 的 position/uv/index 三数组
// ⇒ 无数组局部桩全体炸桩 (桩不忠实, 非被测代码问题)。局部桩表升级忠实经纬球
// (与 _bootstub._SphereGeo2 同形同序, extends 本文件的 Geo 保 no-op 方法面)。
function _FF17Sph(Base){ return class extends Base{constructor(r=1,ws=8,hs=6){super(r,ws,hs);if(!this.attributes) this.attributes={};if(!this.parameters) this.parameters={};
ws=Math.max(3,ws|0); hs=Math.max(2,hs|0);
const pos=[],uv=[],idx=[];
for(let iy=0;iy<=hs;iy++){ const v=iy/hs;
for(let ix=0;ix<=ws;ix++){ const u=ix/ws;
pos.push(-r*Math.cos(u*Math.PI*2)*Math.sin(v*Math.PI), r*Math.cos(v*Math.PI), r*Math.sin(u*Math.PI*2)*Math.sin(v*Math.PI));
uv.push(u,1-v);}}
for(let iy=0;iy<hs;iy++)for(let ix=0;ix<ws;ix++){ const a=iy*(ws+1)+ix+1, b=a-1, c=(iy+1)*(ws+1)+ix, d=c+1;
if(iy!==0) idx.push(a,b,d);
if(iy!==hs-1) idx.push(b,c,d);}
this.attributes.position={count:pos.length/3,array:new Float32Array(pos),getX:i=>pos[i*3],getY:i=>pos[i*3+1],getZ:i=>pos[i*3+2]};
this.attributes.uv={count:uv.length/2,array:new Float32Array(uv)};
this.attributes.normal={count:pos.length/3,array:new Float32Array(pos.length)};
this.index={array:new Uint16Array(idx)};
this.parameters={radius:r,widthSegments:ws,heightSegments:hs};
}dispose(){}};}
// ─────────────────────────────────────────────
// dev/verify-layouts.js —— 布局层沙箱 (不进 Index.html)
// 用法: node dev/verify-layouts.js [战役序号]   (默认全部战役)
// 原理: 与 verify-buildings 同构——最小 THREE 桩 + 复刻地形高度场, 按真实加载顺序
//       求值 00-config → 05-world → 05a-buildings → 05b-props → 05c-layouts
//       (buildWorld 随 05c 加载执行), 然后逐战役检查:
//        ① 种子确定性: ?seed=42 两遍布局指纹完全一致, 种子 42 与 7 布局不同;
//        ② 不变量: 建筑足迹不压旗点 / 道具两两占位互斥 / 道具不入建筑足迹 /
//            每旗·每基地各有弹药箱(大桥旗在桥面) / 桥轴 NAV_CLEARS 通行带 /
//            破袭模式补给库=每旗一处且 hp=720, 其他模式无补给库;
//        ③ 各战役布局统计表 (box/cyl/nav/foot/props/stairs/regs/trees/ammo/depot)。
// 注意: ①MG42/工事由 06-engineering 加载期放置, 不在本沙箱范围;
//       ②地形高度场是 03-terrain 的复刻副本(仅供验证), 断言失败时先查本体逻辑。
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
class Quat{ constructor(){ this.x=0;this.y=0;this.z=0;this.w=1; } setFromUnitVectors(){ return this; } identity(){ return this; } setFromEuler(){ return this; } }
class Rot{ constructor(){ this.x=0;this.y=0;this.z=0;this.order='XYZ'; } set(x,y,z){this.x=x;this.y=y;this.z=z;return this;} }
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
BoxGeometry:Geo, CylinderGeometry:Geo, PlaneGeometry:PlaneGeo, SphereGeometry:_FF17Sph(Geo), ConeGeometry:Geo, TorusGeometry:Geo, CircleGeometry:Geo,
MeshLambertMaterial:class{ constructor(o){ Object.assign(this,o||{}); if(!this.color) this.color={set(){}}; } },
MeshBasicMaterial:class{ constructor(o){ Object.assign(this,o||{}); if(!this.color) this.color={set(){}}; } },
BufferGeometry:class{ constructor(){ this.attributes={}; } setAttribute(n,a){ this.attributes[n]=a; return this; } setIndex(){return this;} setFromPoints(){return this;} computeVertexNormals(){return this;} },
BufferAttribute:class{ constructor(a,n){ this.array=a; this.itemSize=n; } },
Float32BufferAttribute:class{},
};
}
// ── 地形高度场复刻 (03-terrain.js 验证用拷贝; 函数结构一致) ──
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
}// 03-terrain 副本 (2026-11-15): 厅坑压平 + 隧道带桥式抬升 —— 与 03-terrain 同源 (旗标期采样, 广场碟保留、明坑/street 矩形短路)。

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
function weatherAt1(x,z){ return 0; }
function rawH(x,z){
// 语义表 (03-terrain 副本): 淞沪/百团/莫斯科 —— 与本体 rawHeight 同构
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
	case 'mountain':{ // 03-terrain 副本: 谷地走廊+两侧山坡伏击带 (roadDist 相对公式)
	const rd=roadDist(x,z);
	const s3=t=>t*t*(3-2*t);
	const side=s3(Math.max(0,Math.min(1,(rd-5)/16)));
	const rim=s3(Math.max(0,Math.min(1,(rd-21)/11)));
	const rn=1+0.35*Math.sin(x*0.024+z*0.01+1)+0.2*Math.sin(x*0.055-z*0.03+0.7);
	return 0.4*Math.sin(x*0.05)+0.2*Math.sin(x*0.12+2)+side*9*rn+rim*7*rn; }
	case 'opensea':{ // P4 全海图副本 (与 03-terrain rawHeight 同构): 无陆地, 均匀深海盆
	const D=(SEA&&SEA.deep)?SEA.deep:26;
	const n=Math.sin(x*0.017)*Math.cos(z*0.013)*2.4+Math.sin((x+z)*0.009)*1.6;
	return -(D+n);
	}
	case 'island':{ // 2026-09-18 塔拉瓦副本: 海床(负高度)+陆上剖面同一支岸线距离场 (与 03-terrain rawHeight 同构)
	if(!SEA) return 0;
	const d=shoreDist(x,z);
	if(d>0) return -seaDepthAt(x,z);
	return seaLandH(x,z,-d); }
	default:
	return 1.4*Math.sin(x*0.021)*Math.cos(z*0.024)
	+ 0.9*Math.sin(x*0.052+1.7)*Math.sin(z*0.043+0.6)
	+ 0.5*Math.sin(x*0.11+3.1)*Math.cos(z*0.09+1.2);
	}
}
const FLATS=[];
// 塔拉瓦环礁: 旗点/基地平台取全高 (0.55 系数会把滩头旗点削到海平面以下 —— 同 loess/woods 口径)
const fullH2=CAMPAIGN.terr==='loess'||CAMPAIGN.terr==='woods'||CAMPAIGN.terr==='island';
for(const b of CAMPAIGN.bases) FLATS.push({x:b.x,z:b.z,r:20,h:fullH2?rawH(b.x,b.z):rawH(b.x,b.z)*0.55});
for(const f of CAMPAIGN.flags) FLATS.push({x:f.x,z:f.z,r:f.r+12,h:fullH2?rawH(f.x,f.z):rawH(f.x,f.z)*0.55});
if(WOOD&&WOOD.village){ const V=WOOD.village; FLATS.push({x:V.x,z:V.z,r:V.r,h:rawH(V.x,V.z)}); } // 许特根: 岭上村台地 (全高)
for(const s of (CAMPAIGN.spawns||[])) FLATS.push({x:s.x,z:s.z,r:CAMPAIGN.layout==='canyon'?6:8,h:rawH(s.x,s.z)*0.55});
// 草原库尔斯克改版 (2026-09-13): 车站(站房/站台/水塔群)/风车/农庄需整片平地 (全高, 同岭上村口径)
if(STEPPE&&STEPPE.station){ const T2=STEPPE.station; FLATS.push({x:T2.x,z:T2.z,r:26,h:rawH(T2.x,T2.z)}); }
if(STEPPE&&STEPPE.village){ const V2=STEPPE.village; FLATS.push({x:V2.x,z:V2.z,r:V2.r,h:rawH(V2.x,V2.z)}); }
if(STEPPE&&STEPPE.mill){ const M3=STEPPE.mill; FLATS.push({x:M3.x,z:M3.z,r:9,h:rawH(M3.x,M3.z)}); }
if(CAMPAIGN.terr==='rolling') FLATS.push({x:0,z:0,r:34,h:rawH(0,0)*0.55});
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
const TRENCHES=(CAMPAIGN.trench||[]).map(t=>({x1:t[0],z1:t[1],x2:t[2],z2:t[3]}));
const RIVER={moscow:{pts:[[-320,-238],[-180,-262],[-40,-246],[120,-268],[320,-244]],w:9,ice:true},
burma:{pts:[[-165,62],[-70,32],[-8,62],[60,12],[120,42],[165,22]],w:8,ice:false},
songhu:{pts:[[-165,-52],[-80,-42],[0,-58],[80,-32],[165,-42]],w:7,ice:false,d:2.8},
hukawng:{pts:[[-22.8,-212],[-4.8,-133],[-9.5,-71.3],[-2.4,-5.9],[4.8,59.4],[-5.9,127.7],[5.3,212]],w:26,ice:false,d:14,ford:{x:-2,z:102.1,r:26}}}[CAMPAIGN.id]||null; // 2026-09-12 巨桥改版副本同步 (与 00-config 同源); 2026-11-14 缩图批同步
const DELTA=CAMPAIGN.delta||null;
const DELTA_CHANS=(DELTA&&DELTA.channels)||[];
const BRIDGES=CAMPAIGN.bridges||(CAMPAIGN.bridge?[CAMPAIGN.bridge]:[]);
const BRIDGE=BRIDGES[0]||null;
const _deckMap=new Map();
function bridgeDeckY(B){
const b=B||BRIDGE; if(!b) return 0;
if(b.deckY!==undefined) return b.deckY; // 栈桥 (kind='pier', 2026-09-18): 绝对桥面高, 副本同步
if(!_deckMap.has(b)){ const dx=Math.sin(b.yaw),dz=Math.cos(b.yaw); const e=b.len/2+3; _deckMap.set(b,Math.max(heightAt(b.x-dx*e,b.z-dz*e),heightAt(b.x+dx*e,b.z+dz*e))); }
return _deckMap.get(b);
}
function heightAt(x,z,noBridge){
let h=rawH(x,z);
for(const f of FLATS){ const d=Math.hypot(x-f.x,z-f.z); if(d<f.r){ const s1=1-d/f.r; const s=s1*s1*(3-2*s1); h+=(f.h-h)*s; } }
// 03-terrain 副本: 诺曼底博卡日下沉土路 (田块表存在即启用)
if((CAMPAIGN.fields||[]).length&&!CAMPAIGN.city){ const rd=roadDist(x,z); if(rd<4){ const k=1-rd/4; h-=0.45*k*k*(3-2*k); } } // !CITY 门控同 03-terrain 本体 (2026-09-06)
for(const t of TRENCHES){ const d=seg(t.x1,t.z1,t.x2,t.z2,x,z); if(d<2.4){ const k=1-d/2.4; h-=1.3*k*k*(3-2*k); } }
if(RIVER){ let rd=1e9; const P=RIVER.pts; for(let i=0;i<P.length-1;i++){ const d=seg(P[i][0],P[i][1],P[i+1][0],P[i+1][1],x,z); if(d<rd) rd=d; } if(rd<RIVER.w){ const k=1-rd/RIVER.w; h-=(RIVER.ice?1.2:(RIVER.d||1.9))*k*k*(3-2*k)*(1-0.92*fordAt(x,z)); } } // ford 滩心下切 8% (同 03-terrain 本体)
h=padHeight(x,z,h); // 03-terrain 副本: 建筑地基平台 (2026-09-20) —— 室内无坑/门槛零落差
if(!noBridge&&BRIDGES.length){ const dy=onBridge(x,z); if(dy!==false&&dy>h) h=dy; }
return h;
}
// 03-terrain 副本: 城市街道距离 (2026-09-05 城市组, 布局建筑避让用)
function streetDist(x,z){
const CT=CAMPAIGN.city;
if(!CT) return 1e9;
let bd=1e9;
for(const s of CT.streets){
if(x>=s.x0&&x<=s.x1&&z>=s.z0&&z<=s.z1) return 0;
const dx=Math.max(s.x0-x,0,x-s.x1), dz=Math.max(s.z0-z,0,z-s.z1);
const d=Math.hypot(dx,dz);
if(d<bd) bd=d;
}
return bd;
}
// 03-terrain 副本: 城市建成区 (街块+厂区; 植被全域让位用)
function cityUrban(x,z){
const CT=CAMPAIGN.city;
if(!CT) return false;
if(CT.blocks) for(const s of CT.blocks){ if(x>=s.x0&&x<=s.x1&&z>=s.z0&&z<=s.z1) return true; }
if(CT.yard&&x>=CT.yard.x0&&x<=CT.yard.x1&&z>=CT.yard.z0&&z<=CT.yard.z1) return true;
return false;
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
// 03-terrain 副本: 矩形距离 (环礁跑道/规划判定用)
function rectDist(x,z,x0,z0,x1,z1){ const dx=Math.max(x0-x,0,x-x1), dz=Math.max(z0-z,0,z-z1); return Math.hypot(dx,dz); }
// 03-terrain 副本: 水面查询 (环礁=海平面; 河道/支流/鱼塘=05c 渲染时登记的采样表) —— 本沙箱只做布局, 采样表为空
const WATER_SURF=[];
const WATER_CELLS=new Map();
function waterSurfReg(x,z,wy,hw){ WATER_SURF.push({x,z,wy,hw}); }
// ★2026-09-26E: 05c _waterStrip 改调条带登记 (相邻采样点成段) —— 本沙箱只做布局, 水面表为空, 同义补桩
function waterSurfRegStrip(samples,hw){ for(const s of samples) WATER_SURF.push({x:s.x,z:s.z,wy:s.wy,hw}); }
function waterYAt(x,z){
let wy=-1e9;
if(SEA&&shoreDist(x,z)>0) wy=SEA.level;
return wy;
}
function waterDepthAt(x,z){
const wy=waterYAt(x,z);
if(wy<=-1e8) return -1e9;
return wy-heightAt(x,z,true);
}
function inSea(x,z){ return !!SEA&&shoreDist(x,z)>0; }
// 03-terrain 副本: 通用水体判据 (★2026-09-26 P2-18 新增 —— 05c 的野树/草丛门会调它; 本沙箱的水面采样表为空,
// 只有 SEA 图能命中, 与真实现一致: 其余图的水面由 05c 渲染期 waterSurfReg 登记后才存在)
function inWaterBody(x,z){
const wy=waterYAt(x,z);
return wy>-1e8&&heightAt(x,z,true)<wy-0.05;
}
return {heightAt,roadDist,streetDist,cityUrban,inRiverChannel,inShallowChannel,onBridge,fordAt,FLATS,PADS,addPad,padHeight,bridgeDeckY,woodRavineDist,woodRampMask,shoreZAt,northZAt,coastXAt,coastDist,shoreDist,seaDepthAt,seaChannelMask,seaLandH,rectDist,waterYAt,waterDepthAt,inSea,inWaterBody};
}
function runCampaign(campIdx,seedN){
const THREE=makeThreeStub();
const sandbox={
console,Math,JSON,location:{search:'?seed='+seedN+'&pseed='+seedN},
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
// procgen 数据阶段 (2026-10-07b 补载: 旧清单缺 00c ⇒ layoutProcgen 报 PGDATA is not defined,
// 又是"探针载入清单与实载不一致"盲区 —— 00c 对非 procgen 图自守零执行)
vm.runInContext(fs.readFileSync(path.join(root,'js/00c-procgen.js'),'utf8'),ctx,{filename:'js/00c-procgen.js'});
const CAMP=vm.runInContext('CAMPAIGN',ctx);
const terr=makeTerrain(CAMP);
ctx.heightAt=terr.heightAt; ctx.roadDist=terr.roadDist; ctx.sineRoadZ=(x)=>3*Math.sin(x*0.02); ctx.streetDist=terr.streetDist; ctx.cityUrban=terr.cityUrban;
ctx.inRiverChannel=terr.inRiverChannel; ctx.onBridge=terr.onBridge; ctx.inShallowChannel=terr.inShallowChannel;
ctx.fordAt=terr.fordAt; // 胡康徒涉滩强度场 (2026-09-12, 断言环带检验用)
ctx.FLATS=terr.FLATS; ctx.bridgeDeckY=terr.bridgeDeckY;
// 建筑地基平台 (2026-09-20): 03-terrain 副本的 PADS/addPad 注入沙箱 (05-world foundation 调用)
ctx.PADS=terr.PADS; if(!(typeof process!=='undefined'&&process.env&&process.env.PADS_OFF)) ctx.addPad=terr.addPad; // PADS_OFF=1: negative control (old terrain without building pads)
// 环礁语义 (2026-09-18 塔拉瓦批): SEA + 岸线距离场/水深/水面查询 同构注入 (05b/05c/04b 布局期共读)
ctx.SEA=CAMP.sea||null;
ctx.shoreZAt=terr.shoreZAt; ctx.northZAt=terr.northZAt; ctx.coastXAt=terr.coastXAt; ctx.shoreDist=terr.shoreDist; ctx.seaDepthAt=terr.seaDepthAt;
ctx.seaChannelMask=terr.seaChannelMask; ctx.seaLandH=terr.seaLandH; ctx.rectDist=terr.rectDist;
ctx.waterYAt=terr.waterYAt; ctx.waterDepthAt=terr.waterDepthAt; ctx.inSea=terr.inSea; ctx.inWaterBody=terr.inWaterBody;
ctx.WATER_SURF=[]; ctx.WATER_CELLS=new Map(); ctx.waterSurfReg=(x,z,wy,hw)=>{ ctx.WATER_SURF.push({x,z,wy,hw}); }; ctx.waterSurfRegStrip=(samples,hw)=>{ for(const s of samples) ctx.WATER_SURF.push({x:s.x,z:s.z,wy:s.wy,hw}); };
// 地貌语义表 + 多桥 (2026-09-10 三图改造): 沙箱未加载 03-terrain 本体, 同构注入
ctx.DELTA=CAMP.delta||null; ctx.DELTA_CHANS=(CAMP.delta&&CAMP.delta.channels)||[];
ctx.LOESS=CAMP.loess||null; ctx.ALPINE=CAMP.alpine||null;
ctx.WOOD=CAMP.wood||null; ctx.woodRavineDist=terr.woodRavineDist; ctx.woodRampMask=terr.woodRampMask; // 许特根: 北谷副本注入 (2026-09-13)
ctx.BRIDGES=CAMP.bridges||(CAMP.bridge?[CAMP.bridge]:[]);
ctx.BRIDGE=ctx.BRIDGES[0]||null;
// 03-terrain 的城市语义全局 (沙箱未加载本体, 同构注入): CITY 常量供 05c/05a 使用
ctx.CITY=CAMP.city||null;
// 03-terrain 的农田系统全局 (沙箱未加载本体, 同公式注入): 田块表+查田块
ctx.RURAL_FIELDS=CAMP.fields||[];
ctx.fieldAt=(x,z)=>{ for(const f of ctx.RURAL_FIELDS){ if(x>=f.x0&&x<=f.x1&&z>=f.z0&&z<=f.z1) return f; } return null; };
// 05-world 已切分: 框架 → 建筑实例 → 道具植被 → 布局/组装 (顺序不可变)
vm.runInContext(fs.readFileSync(path.join(root,'js/04b-fire.js'),'utf8'),ctx,{filename:'js/04b-fire.js'});
vm.runInContext(fs.readFileSync(path.join(root,'js/05-world.js'),'utf8'),ctx,{filename:'js/05-world.js'});
// 注册序号: 便于在失败报告里区分"道具先放/建筑后放"的时序问题
let _gseq=0;
for(const arrName of ['B_FOOT','PROPS']){
const arr=vm.runInContext(arrName,ctx);
const origPush=arr.push;
arr.push=function(x){ x._i=arr.length; x._seq=_gseq++; return origPush.call(arr,x); };
}
if(process.env.BUGTRACE){
vm.runInContext('propTake=function(x,z,r){ const st=(new Error()).stack.split("\\n").slice(2,4).join(" "); PROPS.push({x,z,r,src:st.replace(/at /g,"")}); };',ctx);
}
vm.runInContext(fs.readFileSync(path.join(root,'js/05a-buildings.js'),'utf8'),ctx,{filename:'js/05a-buildings.js'});
vm.runInContext(fs.readFileSync(path.join(root,'js/05b-props.js'),'utf8'),ctx,{filename:'js/05b-props.js'});
vm.runInContext(fs.readFileSync(path.join(root,'js/05c-layouts.js'),'utf8'),ctx,{filename:'js/05c-layouts.js'});
return {ctx,CAMP,onBridge:terr.onBridge};
}
// 布局指纹: 世界构建的全部布局层输出 (种子确定性的核对对象)
function layoutFp(ctx){
const s=[];
for(const b of vm.runInContext('BOXES',ctx)) s.push(`B${b.minX.toFixed(2)},${b.minY.toFixed(2)},${b.minZ.toFixed(2)},${b.maxX.toFixed(2)},${b.maxY.toFixed(2)},${b.maxZ.toFixed(2)}${b.dead?1:0}`);
for(const c of vm.runInContext('CYLS',ctx)) s.push(`C${c.x.toFixed(2)},${c.z.toFixed(2)},${c.r.toFixed(2)}`);
for(const n of vm.runInContext('NAV_CLEARS',ctx)) s.push(`N${n.x.toFixed(2)},${n.z.toFixed(2)},${n.r.toFixed(2)}`);
for(const f of vm.runInContext('B_FOOT',ctx)) s.push(`F${f.x0.toFixed(2)},${f.x1.toFixed(2)},${f.z0.toFixed(2)},${f.z1.toFixed(2)}`);
for(const p of vm.runInContext('PROPS',ctx)) s.push(`P${p.x.toFixed(2)},${p.z.toFixed(2)},${p.r.toFixed(2)}`);
for(const st of vm.runInContext('STAIRS',ctx)) s.push(`S${st.x.toFixed(2)},${st.z.toFixed(2)},${st.topY.toFixed(2)}`);
for(const r of vm.runInContext('BUILD_REG',ctx)) s.push(`R${r.type} ${r.x.toFixed(2)},${r.z.toFixed(2)},${r.ry.toFixed(2)}`);
for(const a of vm.runInContext('AMMO_CRATES',ctx)) s.push(`A${a.x.toFixed(2)},${a.z.toFixed(2)}`);
for(const t of vm.runInContext('TREE_LIVE',ctx)) s.push(`T${t.x.toFixed(2)},${t.z.toFixed(2)}`);
for(const d of vm.runInContext('DEPOTS',ctx)) s.push(`D${d.id}${d.x.toFixed(2)},${d.z.toFixed(2)}${d.g?d.g.hp:0}`);
for(const f of vm.runInContext('FLAGS',ctx)) s.push(`E${f.id}${f.x.toFixed(2)},${f.z.toFixed(2)},${f.r.toFixed(2)}`);
return s.join('\n');
}
// 布局不变量: 返回错误信息数组
function checkLayout(r){
const errs=[];
const ctx=r.ctx;
const CAMPAIGN=r.CAMP;
const flags=vm.runInContext('FLAGS',ctx);
const reg=vm.runInContext('BUILD_REG',ctx);
const foots=vm.runInContext('B_FOOT',ctx);
const props=vm.runInContext('PROPS',ctx);
const ammos=vm.runInContext('AMMO_CRATES',ctx);
const depots=vm.runInContext('DEPOTS',ctx);
const ncls=vm.runInContext('NAV_CLEARS',ctx);
const mode=vm.runInContext('GAMEMODE',ctx);
const B=vm.runInContext('BRIDGE',ctx);
const onBridge=(x,z,m=0)=>B&&(function(){ const lx=x-B.x,lz=z-B.z; const ax=lx*Math.sin(B.yaw)+lz*Math.cos(B.yaw); const pv=lx*Math.cos(B.yaw)-lz*Math.sin(B.yaw); return Math.abs(ax)<B.len/2+m&&Math.abs(pv)<B.w/2+m; })();
// 1) 建筑足迹不压旗点 (按 BUILD_REG 逐一重算足迹矩形, margin=0.6 ≈ 旗杆/旗布穿墙阈值)
for(const f of flags)for(let bi=0;bi<reg.length;bi++){
const b=reg[bi];
const cs=Math.abs(Math.cos(b.ry)),sn=Math.abs(Math.sin(b.ry));
const ex=(b.w*cs+b.d*sn)/2+0.6, ez=(b.w*sn+b.d*cs)/2+0.6;
if(f.x>b.x-ex&&f.x<b.x+ex&&f.z>b.z-ez&&f.z<b.z+ez) errs.push(`旗点「${f.id}」(${f.x},${f.z}) 被建筑 REG#${bi} ${b.type}@(${b.x.toFixed(0)},${b.z.toFixed(0)}) 覆盖`);
}
// 2) 道具/植被 占位两两互斥 (propTake 半径链, 容差 0.05)
for(let i=0;i<props.length;i++)for(let j=i+1;j<props.length;j++){
const a=props[i],b=props[j];
if(Math.hypot(a.x-b.x,a.z-b.z)<a.r+b.r-0.05) errs.push(`道具互斥破坏 #${i}(${a.x.toFixed(1)},${a.z.toFixed(1)},r${a.r})↔#${j}(${b.x.toFixed(1)},${b.z.toFixed(1)},r${b.r})`);
}
// 3) 道具不入建筑足迹 (破袭补给库的预占足迹除外——箱堆/沙袋就摆在那里)
// 破袭补给库的预占足迹(以矩形中心=补给库中心)豁免——箱堆/沙袋就摆在那里
// 2026-09-05: 先于足迹登记的道具同样豁免 (红十月厂房内部设备: 钢坯垛/机器/钢水包先放, 足迹后登记)
const depotSites=new Set(depots.map(d=>d.x.toFixed(1)+','+d.z.toFixed(1)));
for(const p of props)for(const f of foots){
if(p._seq!==undefined&&f._seq!==undefined&&p._seq<f._seq) continue;
if(depotSites.has(((f.x0+f.x1)/2).toFixed(1)+','+((f.z0+f.z1)/2).toFixed(1))) continue;
if(p.x>f.x0&&p.x<f.x1&&p.z>f.z0&&p.z<f.z1){ errs.push(`道具#${p._i}(${p.x.toFixed(1)},${p.z.toFixed(1)},r${p.r}) 进入足迹#${f._i} ${f.x0.toFixed(0)}..${f.x1.toFixed(0)},${f.z0.toFixed(0)}..${f.z1.toFixed(0)}`); break; }
}
// 4) 弹药箱: 每旗≤16m(环扫描兜底最远15m), 每基地≤10m; 大桥旗点弹药箱必须在桥面上
for(const f of flags){
if(!ammos.some(c=>Math.hypot(c.x-f.x,c.z-f.z)<=16)) errs.push(`旗点「${f.id}」附近无弹药箱`);
if(onBridge(f.x,f.z,4)&&!ammos.some(c=>onBridge(c.x,c.z,0.5))) errs.push(`大桥旗点「${f.id}」的弹药箱不在桥面上`);
}
const bases=vm.runInContext('BASES',ctx);
for(let i=0;i<bases.length;i++){
if(!ammos.some(c=>Math.hypot(c.x-bases[i].x,c.z-bases[i].z)<=10)) errs.push(`基地#${i}(${bases[i].x},${bases[i].z}) 附近无弹药箱`);
}
// 5) 大桥: NAV_CLEARS 沿桥轴贯通 (每半段至少1个)
if(B){
const half=ncls.filter(n=>onBridge(n.x,n.z,0));
let uPos=0,uNeg=0;
for(const n of half){
const lx=n.x-B.x,lz=n.z-B.z;
const u=lx*Math.sin(B.yaw)+lz*Math.cos(B.yaw);
if(u>0.5) uPos++; else if(u<-0.5) uNeg++;
}
if(half.length<4) errs.push(`桥轴 NAV_CLEARS 通行带不足 (${half.length}<4)`);
if(uPos<1||uNeg<1) errs.push(`桥轴通行带未贯通两端 (u+=${uPos}, u-=${uNeg})`);
}
// 6) 破袭: 每旗一处补给库(hp=720), 其他模式不得有补给库
if(mode==='demolition'){
if(depots.length!==flags.length) errs.push(`补给库数量 ${depots.length}≠旗数 ${flags.length}`);
for(const f of flags){
const d=depots.find(d=>Math.hypot(d.x-f.x,d.z-f.z)<0.5);
if(!d) errs.push(`旗点「${f.id}」缺补给库`);
else if(!d.g||d.g.hp!==720||d.g.dead) errs.push(`旗点「${f.id}」补给库异常 (hp=${d.g&&d.g.hp}, dead=${d.g&&d.g.dead})`);
}
}else if(depots.length>0) errs.push(`非破袭模式出现 ${depots.length} 处补给库`);
// 7) 每战役至少1栋登记建筑 (断崖公路=纯自然伏击峡谷, 刻意无建筑)
// opensea (P4 2026-09-30): 全海图**没有陆地**, 布局按设计只放海面件 (浮标/浪花) —— 建筑为空是正确态。
//   与 canyon 同一档豁免 (那张图是无建筑遭遇战图)。'canyon' 之外的图仍必须出建筑。
if(!reg.length&&CAMPAIGN.layout!=='canyon'&&CAMPAIGN.terr!=='opensea') errs.push('BUILD_REG 为空——布局未生成任何建筑');
// 8) 诺曼底围田树篱: 不得侵入旗点净空圈 (布局期已按 r+7 避让, 此处兜底)
if(vm.runInContext('RURAL_HEDGES',ctx).length){
for(const f of flags){
for(const h of vm.runInContext('RURAL_HEDGES',ctx)){
if(Math.hypot(h.x-f.x,h.z-f.z)<f.r+6) errs.push(`围田树篱 (${h.x.toFixed(1)},${h.z.toFixed(1)}) 侵入旗点「${f.id}」净空圈`);
}
}
}
// 12) 城市组断言 (2026-09-05 城市组·斯大林格勒/柏林):
//     建筑足迹不侵占街道矩形 / 多层可上楼(楼梯数) / 地标存在 / 电车残骸
const CT=CAMPAIGN.city;
if(CT){
const SD=1.0; // 街缘容差 (B_FOOT 已含 1.0 余量, 合计≥2m 净距)
for(const s of CT.streets){
for(const f of foots){
if(f.sw) continue; // 2026-11-15: stoneWall 段落足迹可有意横街 (柏林街6十字墙=11-14 批既定口径"旧版同款"), 布局探针豁免
if(f.x0<s.x1-SD&&f.x1>s.x0+SD&&f.z0<s.z1-SD&&f.z1>s.z0+SD){
errs.push(`城市: 建筑足迹#${f._i} (${f.x0.toFixed(0)}..${f.x1.toFixed(0)},${f.z0.toFixed(0)}..${f.z1.toFixed(0)}) 侵入街道 (${s.x0},${s.z0})..(${s.x1},${s.z1})`);
}
}
}
const stairs=vm.runInContext('STAIRS',ctx);
if(stairs.length<4) errs.push(`城市: 楼梯数 ${stairs.length} < 4 (沿街多层可上楼语义缺失)`);
const types=reg.map(b=>b.type);
if(CAMPAIGN.id==='stalingrad'){
if(!types.includes('factory')) errs.push('斯大林格勒: 缺少红十月工厂地标 (BUILD_REG type=factory)');
if(types.filter(t=>t==='tramWreck').length<2) errs.push('斯大林格勒: 电车残骸不足 2 节');
}
if(CAMPAIGN.id==='berlin'){
if(types.filter(t=>t==='block').length<4) errs.push(`柏林: 沿街多层公寓不足 (${types.filter(t=>t==='block').length} < 4)`);
// ── 2026-09-09 柏林点位改版断言 (用户实机反馈"点位一条线 + 地图太小 + 没有地标") ──
if(!types.includes('reichstag')) errs.push('柏林: 缺少国会大厦地标 (BUILD_REG type=reichstag)');
if(!types.includes('flaktower')) errs.push('柏林: 缺少防空塔地标 (BUILD_REG type=flaktower)');
const zs=flags.map(f=>f.z), xs=flags.map(f=>f.x);
const zSpan=Math.max(...zs)-Math.min(...zs), xSpan=Math.max(...xs)-Math.min(...xs);
// 2026-11-14 缩图批: 阈值按 360 图实测重写 (×0.85 余量), 语义不变 —— 锚已随 2026-11-14 缩图批更新+语义不变
// (实测: zSpan 222.8 / xSpan 191.3 / minFD 81.0 / 站间距 56.3 / 城区建筑 59)
if(zSpan<189) errs.push(`柏林: 旗点南北跨度 ${zSpan.toFixed(0)}<189 —— 又回到"一条线"`);
if(xSpan<162) errs.push(`柏林: 旗点东西跨度 ${xSpan.toFixed(0)}<162`);
let minFD=1e9;
for(let i=0;i<flags.length;i++)for(let j=i+1;j<flags.length;j++) minFD=Math.min(minFD,Math.hypot(flags[i].x-flags[j].x,flags[i].z-flags[j].z));
if(minFD<68) errs.push(`柏林: 最近两旗间距 ${minFD.toFixed(0)}<68 (点位过密)`);
// 防空塔顶高炮平台登记 (05a flakTower → 17-emplacements aaGun yDeck)
const fd=vm.runInContext('FLAK_DECKS',ctx);
if(!fd.length) errs.push('柏林: 防空塔顶平台未登记 (FLAK_DECKS 空)');
else if(fd[0].y-ctx.heightAt(fd[0].x,fd[0].z)<8) errs.push(`柏林: 防空塔顶平台高度异常 (${fd[0].y.toFixed(2)})`);
// ── 2026-09-09 加密批次断言 (用户实机反馈"柏林城内太过于空荡") ──
const nFac=types.filter(t=>t==='facade').length, nTer=types.filter(t=>t==='terrace').length;
if(nFac+nTer<15) errs.push(`柏林: 沿街街墙不足 (facade ${nFac} + terrace ${nTer} < 15) —— 城内又空了`);
const nCity=types.filter(t=>['facade','terrace','block','ruinedHouse','twoStory'].includes(t)).length;
if(nCity<50) errs.push(`柏林: 城区建筑总数 ${nCity} < 50 (2026-11-14 缩图批实测 59×0.85 余量; 旧 640 图基线 83) —— 加密批次语义不变`);
// 国会大厦不可破坏 (2026-09-09 用户定案: 残穹壳全塌后浮空 → 整楼改永久件)
{
const R=reg.find(b=>b.type==='reichstag');
if(R){
if(!R.indestr) errs.push('柏林: 国会大厦未标记 indestr (应为不可破坏地标)');
// 2026-11-14 缩图批: 判定域由"锚点 26m 圆"改为 BUILD_REG 足迹矩形 (语义不变: 楼体内不得有可毁组 ——
//   旧 640 图前庭残墙距锚 33m 在圆外; 缩图+定向后残墙贴楼南脸 2.5m, 圆判据会误伤楼外可毁件)
const DES=vm.runInContext('DESTRUCTIBLES',ctx);
{
const cs=Math.abs(Math.cos(R.ry)),sn=Math.abs(Math.sin(R.ry));
const ex=(R.w*cs+R.d*sn)/2+0.5, ez=(R.w*sn+R.d*cs)/2+0.5;
const near=DES.filter(g=>!g.dead&&g.cx>R.x-ex&&g.cx<R.x+ex&&g.cz>R.z-ez&&g.cz<R.z+ez);
if(near.length) errs.push(`柏林: 国会大厦不可破坏断言失败 —— 足迹内有 ${near.length} 个可毁组 (全塌后残穹壳会浮空)`);
}
}
}
}
// ── 2026-09-12 莫斯科城市边缘改版断言 (用户实机反馈"地图像极其偏僻的山村+总体仍是单线夺点") ──
if(CAMPAIGN.id==='moscow'){
if(!types.includes('factory')) errs.push('莫斯科: 缺少厂区地标 (BUILD_REG type=factory)');
if(types.filter(t=>t==='tramWreck').length<1) errs.push('莫斯科: 主街电车残骸缺失');
const zs2=flags.map(f=>f.z), xs2=flags.map(f=>f.x);
const zSpan2=Math.max(...zs2)-Math.min(...zs2), xSpan2=Math.max(...xs2)-Math.min(...xs2);
// 2026-11-14 缩图批: 阈值按 360 图实测重写 (×0.85 余量), 语义不变 —— 锚已随 2026-11-14 缩图批更新+语义不变
// (实测: zSpan 184.6 / xSpan 227.8 / minFD 89.9 / 城区建筑 76)
if(zSpan2<156) errs.push(`莫斯科: 旗点南北跨度 ${zSpan2.toFixed(0)}<156 —— 又回到"一条线"`);
if(xSpan2<193) errs.push(`莫斯科: 旗点东西跨度 ${xSpan2.toFixed(0)}<193 (城市边缘纵深不足)`);
let minFD2=1e9;
for(let i=0;i<flags.length;i++)for(let j=i+1;j<flags.length;j++) minFD2=Math.min(minFD2,Math.hypot(flags[i].x-flags[j].x,flags[i].z-flags[j].z));
if(minFD2<76) errs.push(`莫斯科: 最近两旗间距 ${minFD2.toFixed(0)}<76 (点位过密)`);
const nCity2=types.filter(t=>['facade','terrace','block','ruinedHouse','twoStory'].includes(t)).length;
if(nCity2<64) errs.push(`莫斯科: 城区建筑总数 ${nCity2} < 64 (2026-11-14 缩图批实测 76×0.85 余量; 旧 640 图基线 114) —— 城市边缘不该是空场撒楼`);
}
}
// ── 2026-09-12 胡康巨桥改版断言 (用户指令: "总体仍是单线夺点…大桥远不够大, 这个地图的主题就应当是巨大的大桥")
//    (注意: 在 if(CT) 城市组包裹之外 —— 胡康无 city 语义, 放里面永远不会执行) ──
if(CAMPAIGN.id==='hukawng'){
// ① 巨桥规格: 双桥表, 主桥跨≥70/面宽≥12/kind=grand, 北桥 kind=stone
const BRH=vm.runInContext('BRIDGES',ctx);
if(BRH.length!==2) errs.push(`胡康: 桥数 ${BRH.length}≠2 (主桥+北石桥, 三路渡河少一路)`);
const GB=BRH[0];
if(!GB||GB.len<70||GB.w<12) errs.push(`胡康: 主桥规格不足 (len=${GB&&GB.len}, w=${GB&&GB.w}, 巨桥需≥70/≥12)`);
if(GB&&GB.kind!=='grand') errs.push('胡康: 主桥 kind 应为 grand (grandBridge)');
if(BRH[1]&&BRH[1].kind!=='stone') errs.push('胡康: 北桥 kind 应为 stone (stoneBridge 复用)');
// ② 深谷净空: 主桥桥心河床低于两岸 ≥8m (抓"谷太浅/桥顺河躺")
const hAt=ctx.heightAt, oB=ctx.onBridge;
if(GB){
if(oB(GB.x,GB.z)===false) errs.push('胡康: 主桥桥心不在桥面矩形内 (onBridge 失配)');
const midBed=hAt(GB.x,GB.z,true);
const dxx=Math.sin(GB.yaw), dzz=Math.cos(GB.yaw);
const bank1=hAt(GB.x-dxx*(GB.len/2+3),GB.z-dzz*(GB.len/2+3),true);
const bank2=hAt(GB.x+dxx*(GB.len/2+3),GB.z+dzz*(GB.len/2+3),true);
const clr=Math.min(bank1,bank2)-midBed;
if(clr<8) errs.push(`胡康: 主桥下净空不足 (床 ${midBed.toFixed(1)} vs 岸 ${Math.min(bank1,bank2).toFixed(1)}, 落差 ${clr.toFixed(1)}<8)`);
}
// ③ 登塔梯: ≥2 部顶面高于桥面 6m 的梯 (塔顶制高), 登顶支撑齐平 (盒顶面口径同 verify-buildings #3)
const stH=vm.runInContext('STAIRS',ctx);
const dyH=GB?ctx.bridgeDeckY(GB):0;
const boxesH=vm.runInContext('BOXES',ctx);
const twSt=stH.filter(s=>GB&&s.topY>dyH+6);
if(twSt.length<2) errs.push(`胡康: 登塔梯不足 (${twSt.length}<2, 塔顶制高缺失)`);
const xzH=(b,x,z)=>x>b.minX&&x<b.maxX&&z>b.minZ&&z<b.maxZ;
for(const s of twSt){
let sup=hAt(s.x,s.z);
for(const b of boxesH){ if(b.dead||!xzH(b,s.x,s.z)) continue; if(b.maxY<=s.topY+0.55&&b.maxY>sup) sup=b.maxY; }
if(Math.abs(sup-s.topY)>0.12) errs.push(`胡康: 塔梯登顶 @${s.x.toFixed(1)},${s.z.toFixed(1)} 支撑面=${sup.toFixed(2)}≠顶面=${s.topY.toFixed(2)}`);
// 2026-09-12 实机修复回归: 梯脚不得在激流影响区 (河距口径=桥轴坐标 |u|, 旧版梯道线掉进深切带)
if(ctx.inRiverChannel(s.fx,s.fz)) errs.push(`胡康: 塔梯梯脚 @${s.fx.toFixed(0)},${s.fz.toFixed(0)} 在激流影响区`);
}
// ④ 徒涉滩: 滩心=非激流+浅水, 滩外上游河心仍激流 (南线渡口存在且范围不失控)
const RvH=vm.runInContext('RIVER',ctx);
if(RvH&&RvH.ford){
const F=RvH.ford;
if(ctx.inRiverChannel(F.x,F.z)) errs.push('胡康: 徒涉滩心仍判激流 (inRiverChannel 未豁免)');
if(!ctx.inShallowChannel(F.x,F.z)) errs.push('胡康: 徒涉滩心不判浅水 (inShallowChannel 未生效)');
// 环带点 (d=r/2): ford 范围真实存在的灵敏检验 (只测滩心的话, r 缩到 0 中心点仍豁免, 测不出)
const FR={x:F.x+13,z:F.z}; // 固定 13m 偏移 (设计 r 的一半): 不随 r 缩水
if(ctx.fordAt?ctx.fordAt(FR.x,FR.z)<1:false) errs.push('胡康: 徒涉滩环带 fordAt<1 (ford 半径失效)');
if(ctx.inRiverChannel(FR.x,FR.z)) errs.push('胡康: 徒涉滩环带仍判激流 (ford 范围不足)');
const bedF=hAt(F.x,F.z,true);
const bankF=Math.max(hAt(F.x-RvH.w-2,F.z,true),hAt(F.x+RvH.w+2,F.z,true)); // 岸顶取横断面两侧 max (河向取样会取到河床)
if(bankF-bedF>3.2||bankF-bedF<0.4) errs.push(`胡康: 滩心水 dip ${(bankF-bedF).toFixed(2)} 出可涉窗 (0.4~3.2)`);
const upF={x:F.x,z:F.z-64};
if(!ctx.inRiverChannel(upF.x,upF.z)) errs.push('胡康: 滩外上游河心不判激流 (渡滩范围失控)');
}
// ⑤ 三路扇面: 旗点跨度 (告别一条线) + 桥心旗在主桥上
// 2026-11-14 缩图批: 阈值按 380 图实测重写 (×0.85 余量), 语义不变 —— 锚已随 2026-11-14 缩图批更新+语义不变
// (实测: zSpan 225.6 / xSpan 201.9; 巨桥三旗为桥集群保持原坐标, 外圈四旗 ×0.59375)
const zs3=flags.map(f=>f.z), xs3=flags.map(f=>f.x);
const zSpan3=Math.max(...zs3)-Math.min(...zs3), xSpan3=Math.max(...xs3)-Math.min(...xs3);
if(zSpan3<191) errs.push(`胡康: 旗点南北跨度 ${zSpan3.toFixed(0)}<191 —— 又回到"一条线"`);
if(xSpan3<171) errs.push(`胡康: 旗点东西跨度 ${xSpan3.toFixed(0)}<171 (扇面不足)`);
if(GB&&!flags.some(f=>Math.abs(f.x-GB.x)<2&&Math.abs(f.z-GB.z)<2)) errs.push('胡康: 桥心旗「大桥」不在主桥桥心');
}
// ── 2026-09-13 雾林守线许特根改版断言 (用户指令: "总体仍是单线夺点, 太小同时没有任何特色, 能见度极低不错但不够")
//    (与胡康块同级 —— woodline 无 city 语义, 放城市组包裹内永远不会执行)
if(CAMPAIGN.id==='woodline'){
const hW=ctx.heightAt;
// ① 三路扇面: 旗点跨度 (旧版 5 旗一线 x 跨仅 146 —— 大图扇面必须读出纵深与两翼)
// 2026-11-14 缩图批: 阈值按 360 图实测重写 (×0.85 余量), 语义不变 —— 锚已随 2026-11-14 缩图批更新+语义不变
// (实测: zSpan 178.9 / xSpan 216.5; 最近旗距 58.8 = 西墙缺口↔坝路枢纽)
const zsW=flags.map(f=>f.z), xsW=flags.map(f=>f.x);
const zSpanW=Math.max(...zsW)-Math.min(...zsW), xSpanW=Math.max(...xsW)-Math.min(...xsW);
if(zSpanW<152) errs.push(`雾林: 旗点南北跨度 ${zSpanW.toFixed(0)}<152 —— 又回到"一条线"`);
if(xSpanW<184) errs.push(`雾林: 旗点东西跨度 ${xSpanW.toFixed(0)}<184 (360 图纵深不足)`);
let minFW=1e9;
for(let i=0;i<flags.length;i++)for(let j=i+1;j<flags.length;j++) minFW=Math.min(minFW,Math.hypot(flags[i].x-flags[j].x,flags[i].z-flags[j].z));
if(minFW<50) errs.push(`雾林: 最近两旗间距 ${minFW.toFixed(0)}<50 (点位过密)`);
// ② 北谷(卡尔小径): 谷深真实存在 (谷底低于两岸≥6m) + 车辆堑口纵坡可过 (相邻 8m 采样高差≤1.6m)
// 2026-11-14 缩图批: 谷线采样点 (-60,164)→(-33.8,92.3) (×0.5625); 岸点偏移 ±(w+6) 为剖面相对量不动
const WDv=vm.runInContext('WOOD',ctx);
if(!WDv||!WDv.ravine){ errs.push('雾林: WOOD.ravine 语义表缺失 (北谷不存在)'); }
else{
const btm=hW(-33.8,92.3), bankL=hW(-33.8,92.3-WDv.ravine.w-6), bankR=hW(-33.8,92.3+WDv.ravine.w+6);
if(Math.min(bankL,bankR)-btm<6) errs.push(`雾林: 北谷谷深不足 (底 ${btm.toFixed(1)} vs 岸 ${Math.min(bankL,bankR).toFixed(1)})`);
const VR=WDv.ravine.ramps[0];
if(!VR||VR.w<7) errs.push('雾林: 车辆堑口缺失或过窄 (坦克无法过谷)');
else{
let maxStep=0;
for(let u=VR.z0;u<VR.z1;u+=8){
const dh=Math.abs(hW(VR.x,u+8)-hW(VR.x,u));
if(dh>maxStep) maxStep=dh;
}
if(maxStep>1.6) errs.push(`雾林: 车辆堑口纵坡过陡 (相邻8m高差 ${maxStep.toFixed(2)}>1.6, 坦克爬不过)`);
}
}
// ③ 西墙带: 龙牙双排存在 (带内混凝土块≥86) + 永备火力点≥3 + 缺口走廊净空 (唯一装甲通道不得被堵)
// 2026-11-14 缩图批: 带长 268→150.8 齿数近半 (实测 101), 阈值 100→86 (实测×0.85); 走廊扫描盒 x146..164→82.1..92.3 (围绕缩后带 82.3..91.3), z±6 中段宽度不动;
//   加 !crush 过滤 (倒木 crush=true 坦克可碾, 与草原缺口判据同源 —— 随机倒木偶入走廊缘不再假红)
const boxesW=vm.runInContext('BOXES',ctx);
const BW=CAMPAIGN.wood.belt;
const teeth=boxesW.filter(b=>!b.dead&&b.minX>BW.x0-4&&b.maxX<BW.x1+4&&Math.abs((b.minZ+b.maxZ)/2)>BW.gapZ-2&&b.maxY-b.minY>0.7&&b.maxY-b.minY<1.6).length;
if(teeth<86) errs.push(`雾林: 西墙龙牙不足 (${teeth}<86, 双排带缺失)`);
const regW=vm.runInContext('BUILD_REG',ctx);
const beltBunk=regW.filter(b2=>b2.type==='bunker'&&b2.x>BW.x0&&b2.x<BW.x0+30).length;
if(beltBunk<3) errs.push(`雾林: 西墙带永备火力点不足 (${beltBunk}<3, 节节设防缺火力点)`);
const jam=boxesW.filter(b2=>!b2.dead&&!b2.crush&&b2.maxX>82.1&&b2.minX<92.3&&b2.maxZ>-6&&b2.minZ<6&&b2.maxY-b2.minY>0.4); // 走廊内任何高度>0.4 的不可碾实体盒都算堵 (阴性验证: 单颗龙牙也必须抓到) —— 2026-11-14 缩图批窗口 82.1..92.3 + !crush
if(jam.length) errs.push(`雾林: 西墙缺口装甲走廊被堵 (${jam.length} 个实体盒侵入 x82.1..92.3/z±6 —— 坦克过不去)`);
// ④ 岭上村: 教堂地标立在村台 (纵深据点+树爆庇护所) —— 2026-11-14 缩图批: 锚 (60,-160)→(33.8,-90), 搜索半径 42 为窗口 (教堂相对偏移 ~16m 不缩) 不动
if(!regW.some(b2=>b2.type==='church'&&Math.hypot(b2.x-33.8,b2.z+90)<42)) errs.push('雾林: 岭上村缺教堂地标 (BUILD_REG type=church @村台)');
// ⑤ 卡尔小径坦克坟场: 谷底残骸≥2 (史实: 装甲瓶颈的残骸线) —— 2026-11-14 缩图批: 统计窗 z 140..180→78.8..101.3 / x -90..130→-50.6..73.1 (围绕缩后谷线与 kallWrecks)
const kallWreck=boxesW.filter(b2=>!b2.dead&&b2.maxY-b2.minY>1.4&&b2.minZ>78.8&&b2.maxZ<101.3&&b2.minX>-50.6&&b2.maxX<73.1&&b2.maxY-b2.minY<2.6).length;
if(kallWreck<2) errs.push(`雾林: 谷底坦克残骸不足 (${kallWreck}<2, 卡尔小径坟场缺失)`);
// ⑥ 灌丛软遮蔽带: CROP_FIELDS≥5 (林下渗透路线的 Bot 视线遮蔽)
const cfW=vm.runInContext('CROP_FIELDS',ctx);
if(cfW.length<5) errs.push(`雾林: 灌丛软遮蔽带不足 (${cfW.length}<5, 林下无遮蔽语义)`);
}
// ── 2026-09-13 草原遭遇库尔斯克改版断言 (用户四项裁定: 无旗+可争夺强点 / 车站铁路+风车+坟场村社 / 全套纵深防线+雷区+麦田火 / 节制版炮火犁地)
// 2026-11-14 缩图批: 阈值按 360 图实测重写 (×0.85 余量), 语义不变 —— 锚已随 2026-11-14 缩图批更新+语义不变
// (实测: zSpan 166.0 / xSpan 184.5; 最近强点距 72.7 = 北原哨↔风车磨坊; 龙牙窗内 186 件含缺口火力点/炮位部件)
if(CAMPAIGN.id==='steppe'){
const hS=ctx.heightAt;
// ① 三路扇面: 强点南北跨度≥141 / 东西跨度≥156 (终结旧版"一条对角线"), 最近两强点间距≥61
const spS=CAMPAIGN.spawns||[];
const xsS=spS.map(s=>s.x), zsS=spS.map(s=>s.z);
if(Math.max(...zsS)-Math.min(...zsS)<141) errs.push(`草原: 强点南北跨度 ${(Math.max(...zsS)-Math.min(...zsS)).toFixed(0)}<141 —— 又回到"一条线"`);
if(Math.max(...xsS)-Math.min(...xsS)<156) errs.push(`草原: 强点东西跨度 ${(Math.max(...xsS)-Math.min(...xsS)).toFixed(0)}<156 (360 图纵深不足)`);
let minFS=1e9;
for(let i=0;i<spS.length;i++)for(let j=i+1;j<spS.length;j++) minFS=Math.min(minFS,Math.hypot(spS[i].x-spS[j].x,spS[i].z-spS[j].z));
if(minFS<61) errs.push(`草原: 最近两强点间距 ${minFS.toFixed(0)}<61 (点位过密)`);
if(spS.length!==7) errs.push(`草原: 强点数 ${spS.length}≠7 (苏3/德3/车站中立)`);
if(CAMPAIGN.matchMin!==22) errs.push('草原: matchMin≠22 (对局时长未覆盖 15 分钟默认)');
// ② 东带防线: 龙牙双排存在 (≥114) + 三缺口装甲走廊净空 (走廊内任何高度>0.4 实体盒都算堵)
// 2026-11-14 缩图批: 带长 255→143.4 齿数近半 (本沙箱载荷实测 134 = 齿 ~80 + 铁丝网等带缘件; 全链路含 17-emplacements 约 186), 阈值 120→114 (实测×0.85)
const boxesS=vm.runInContext('BOXES',ctx);
const BS=CAMPAIGN.steppe.belt;
const teethS=boxesS.filter(b=>!b.dead&&b.minX>BS.x0-4&&b.maxX<BS.x1+8&&b.maxY-b.minY>0.7&&b.maxY-b.minY<1.6).length;
if(teethS<114) errs.push(`草原: 防线龙牙不足 (${teethS}<114, 双排带缺失)`);
for(const g of BS.gaps){
// 走廊净空测可通行中段 (内缩 7m): 两翼战壕/机枪贴走廊边缘是设计意图 (步兵侧射位), 不算堵
const jamS=boxesS.filter(b2=>!b2.dead&&!b2.crush&&b2.maxX>BS.x0-4&&b2.minX<BS.x1+8&&b2.maxZ>g[0]+7&&b2.minZ<g[1]-7&&b2.maxY-b2.minY>0.4); // 只抓不可碾实体 (沙袋/箱桶可碾不算堵)
if(jamS.length){ for(const jb of jamS.slice(0,4)) console.log(`JAM z${g[0]}: c=(${((jb.minX+jb.maxX)/2).toFixed(1)},${((jb.minY+jb.maxY)/2).toFixed(1)},${((jb.minZ+jb.maxZ)/2).toFixed(1)}) size=${(jb.maxX-jb.minX).toFixed(1)}x${(jb.maxY-jb.minY).toFixed(1)}x${(jb.maxZ-jb.minZ).toFixed(1)}`); errs.push(`草原: 装甲走廊 z${g[0]}..${g[1]} 被堵 (${jamS.length} 个实体盒) —— 坦克过不去`); }
}
// ③ 雷区: ≥40 枚 + 不压公路 (roadDist≥5) + 不进缺口走廊
const MINESv=vm.runInContext('MINES',ctx);
if(MINESv.length<40) errs.push(`草原: 反坦克雷不足 (${MINESv.length}<40, 雷区带缺失)`);
const rdS=vm.runInContext('roadDist',ctx);
for(const m of MINESv){ if(rdS(m.x,m.z)<5){ errs.push(`草原: 地雷压公路 @(${m.x.toFixed(0)},${m.z.toFixed(0)}) —— Bot 主通道踩雷`); break; } }
for(const m of MINESv){ if(BS.gaps.some(g=>m.z>g[0]&&m.z<g[1])){ errs.push(`草原: 地雷堵缺口走廊 @(${m.x.toFixed(0)},${m.z.toFixed(0)})`); break; } }
// ④ 车站: 站房(terrace)+货栈(depot) 立于站区 + 水塔四腿 (CYLS)
const regS=vm.runInContext('BUILD_REG',ctx);
const stX=CAMPAIGN.steppe.station.x, stZ=CAMPAIGN.steppe.station.z;
if(!regS.some(r=>r.type==='terrace'&&Math.hypot(r.x-stX,r.z-stZ)<30)) errs.push('草原: 车站缺站房 (BUILD_REG type=terrace @站区)');
const flatS=boxesS.filter(b=>!b.dead&&b.maxY-b.minY>0.3&&b.maxY-b.minY<0.6&&Math.abs(b.minX-(stX-17))<3.5&&(b.minZ-stZ>-60)&&(b.maxZ-stZ)<60).length;
if(flatS<3) errs.push(`草原: 调车场平板车不足 (${flatS}<3, 侧线缺失)`);
const cylsS=vm.runInContext('CYLS',ctx);
const wtLegs=cylsS.filter(c2=>Math.abs(c2.x-(stX+9))<6&&Math.abs(c2.z-(stZ+14))<6&&c2.y1-c2.y0>5).length;
if(wtLegs<4) errs.push(`草原: 水塔腿柱不足 (${wtLegs}<4)`);
// ⑤ 强点工事: 每个强点圈内沙袋/箱桶 props≥3 (可争夺强点必须有掩护)
const propsS=vm.runInContext('PROPS',ctx);
for(const s of spS){
const n3=propsS.filter(pp=>Math.hypot(pp.x-s.x,pp.z-s.z)<s.r).length
+regS.filter(r2=>Math.hypot(r2.x-s.x,r2.z-s.z)<s.r).length; // 村社等强点的掩护含建筑 (农庄=木屋/谷仓)
if(n3<3){ errs.push(`草原: 强点「${s.name}」圈内掩护不足 (props+建筑 ${n3}<3)`); break; }
}
// ⑥ 麦田带: CROP_FIELDS≥6 (七月金黄麦田, 可燃软遮蔽) ⑦ 装甲坟场: 残骸盒≥4
// 2026-11-14 缩图批: 坟场残骸统计窗 x 60..180/z -185..-100 → 33.8..101.3 / -104.1..-56.3 (围绕缩后残骸带 wrecks x 42.8..91.7, z -92.3..-72)
const cfS=vm.runInContext('CROP_FIELDS',ctx);
if(cfS.length<6) errs.push(`草原: 麦田带不足 (${cfS.length}<6)`);
const wreckS=boxesS.filter(b=>!b.dead&&b.maxY-b.minY>1.4&&b.minX>33.8&&b.maxX<101.3&&b.minZ>-104.1&&b.maxZ<-56.3).length;
if(wreckS<4) errs.push(`草原: 装甲坟场残骸不足 (${wreckS}<4)`);
}
// ── 2026-09-18 塔拉瓦环礁断言 (海滩+海 / 三路扇面 / 载具预留空间逻辑账) ──
if(CAMPAIGN.id==='island'){
const hI=ctx.heightAt;
const sZI=ctx.shoreZAt, sdI=ctx.seaDepthAt;
const SV=CAMPAIGN.sea;
if(!SV){ errs.push('环礁: CAMPAIGN.sea 语义表缺失'); }
else{
// ① 三路扇面: 旗点跨度/最近旗距/数量 (与柏林·胡康同口径)
const xsI=flags.map(f=>f.x), zsI=flags.map(f=>f.z);
const xSpanI=Math.max(...xsI)-Math.min(...xsI), zSpanI=Math.max(...zsI)-Math.min(...zsI);
if(xSpanI<340) errs.push(`环礁: 旗点东西跨度 ${xSpanI.toFixed(0)}<340 (两岬角制高没拉开 —— 四面环海后岛宽≈424m)`);
if(zSpanI<190) errs.push(`环礁: 旗点南北跨度 ${zSpanI.toFixed(0)}<190 (滩头到纵深不够)`);
let minFI=1e9;
for(let i=0;i<flags.length;i++)for(let j=i+1;j<flags.length;j++) minFI=Math.min(minFI,Math.hypot(flags[i].x-flags[j].x,flags[i].z-flags[j].z));
if(minFI<90) errs.push(`环礁: 最近两旗间距 ${minFI.toFixed(0)}<90`);
if(flags.length!==7) errs.push(`环礁: 旗点数 ${flags.length}≠7 (三路扇面)`);
// 缩岛 (四面环海) 后纵深 240m: 对局时长同步下调到 20 分钟 (原 22 分钟是 390m 纵深的 640 图)
if(CAMPAIGN.matchMin!==20) errs.push('环礁: matchMin≠20');
// ② 攻方开局两翼: assault 自动就近拆分 → 最近的 2 旗必须是东西滩头 (扇面出发阵地, 不是中线单点)
{
const atkB=CAMPAIGN.bases[CAMPAIGN.atk||0];
const sorted=[...flags].sort((a,b)=>Math.hypot(a.x-atkB.x,a.z-atkB.z)-Math.hypot(b.x-atkB.x,b.z-atkB.z));
const ids=sorted.slice(0,2).map(f=>f.id).sort().join(',');
if(ids!=='东滩头,西滩头') errs.push(`环礁: 攻方开局两旗=${ids} (期望"东滩头,西滩头" —— 否则开局不是两翼扇面)`);
}
// ③ 滩头剖面: 岸线=0 等高线 / 冲滩 1:18 / 礁盘平台 1.15~1.35 (涉水可站立) / 礁缘陡坎 / 深海盆地
// (取样 x=-30: 避开两条登陆航道 (x=-64/70±19) 与基地/旗点平整圈, 读到的是原生剖面)
{
const x0=-30, z0=sZI(x0);
const hLand=hI(x0,z0-2), hSea=hI(x0,z0+2);     // 岸线两侧: 陆侧微正, 海侧微负
if(Math.abs(hLand)>0.35||Math.abs(hSea)>0.35) errs.push(`环礁: 岸线不在 0 等高线 (陆侧 ${hLand.toFixed(2)} / 海侧 ${hSea.toFixed(2)})`);
const d22=sdI(x0,z0+22), d30=sdI(x0,z0+30), d43=sdI(x0,z0+43), d120=sdI(x0,z0+120);
if(Math.abs(d22-1.22)>0.2) errs.push(`环礁: 冲滩带 22m 处水深 ${d22.toFixed(2)} (期望≈1.22, 1:18 缓坡供日后冲滩)`);
if(d30<1.05||d30>1.35) errs.push(`环礁: 礁盘平台水深 ${d30.toFixed(2)} 不在 1.05~1.35 (涉水带: 站得住又读得出礁盘)`);
if(d43<3.0) errs.push(`环礁: 礁缘陡坎不足 (43m 处水深 ${d43.toFixed(2)}<3.0, 登陆艇不会搁浅)`);
if(d120<8.0) errs.push(`环礁: 深海盆地过浅 (120m 处 ${d120.toFixed(2)}<8.0, 潜泳空间不足)`);
// 陆上剖面: 干沙滩→沙丘脊(+2.3)→背坡台地
const u14=hI(x0,z0-14), u22=hI(x0,z0-22), u34=hI(x0,z0-34);
if(Math.abs(u14-0.78)>0.25) errs.push(`环礁: 干沙滩 14m 处高程 ${u14.toFixed(2)} (期望≈0.78)`);
if(u22-u14<1.2) errs.push(`环礁: 沙丘脊不明显 (脊 ${u22.toFixed(2)} - 滩 ${u14.toFixed(2)} < 1.2 —— 读不出第一道防线)`);
if(u34<u22) errs.push(`环礁: 沙丘脊到背坡台地反而下降 (${u22.toFixed(2)}→${u34.toFixed(2)})`);
}
// ④ 登陆航道: 走廊内切深到 ≥2.2m, 走廊外 (偏 25m) 仍是礁盘浅水 —— 日后登陆艇的唯一深水通路
// (★09-19 航道带 z0 海域限定: 只在南湾侧生效, 北湾不得被同一条 x 竖带再切一道 —— 下面显式验北侧)
for(const ch of SV.channels){
const zc=sZI(ch.x);
const inCh=sdI(ch.x,zc+30), outCh=sdI(ch.x+ch.w+20,zc+30);
if(inCh<2.2) errs.push(`环礁: 航道 x=${ch.x} 未切深 (30m 处水深 ${inCh.toFixed(2)}<2.2)`);
if(outCh>1.6) errs.push(`环礁: 航道 x=${ch.x} 外侧礁盘过深 (${outCh.toFixed(2)}>1.6 —— 礁盘平台被普遍挖深, 涉水带没了)`);
if(ch.z0!==undefined){
const zn=ctx.northZAt(ch.x);
const inN=sdI(ch.x,zn-30);
if(inN>1.6) errs.push(`环礁: 航道 x=${ch.x} 的切深串到北湾 (北侧 30m 处水深 ${inN.toFixed(2)}>1.6 —— 航道必须限定海域)`);
}
}
// ⑤ 长栈桥 (载具预留空间逻辑账): 桥面绝对值 2.45 / 桥下净空 ≥2.0 (潜泳可穿) / 桥根踏步顶面=桥面 / NAV 贯通
{
const B=CAMPAIGN.bridges.find(b=>b.kind==='pier');
if(!B) errs.push('环礁: 缺长栈桥 (bridges kind=pier)');
else{
const dy=ctx.bridgeDeckY(B);
if(Math.abs(dy-2.45)>0.05) errs.push(`环礁: 栈桥 deckY=${dy} (期望 2.45)`);
const onDeck=hI(B.x,B.z);
if(Math.abs(onDeck-2.45)>0.05) errs.push(`环礁: heightAt 未把栈桥面当可行走面 (${onDeck.toFixed(2)} ≠ 2.45)`);
const clear=dy-0.32-(SV.level);           // 桥面厚 0.32, 海平面 0
if(clear<2.0) errs.push(`环礁: 栈桥下净空 ${clear.toFixed(2)}<2.0 (潜泳穿不过)`);
const stI=vm.runInContext('STAIRS',ctx).filter(s2=>Math.hypot(s2.x-B.x,s2.z-B.z)<B.len/2+8);
if(!stI.some(s2=>Math.abs(s2.topY-2.45)<0.06)) errs.push('环礁: 栈桥根踏步顶面与桥面不齐平 (登桥会卡步)');
const navI=vm.runInContext('NAV_CLEARS',ctx).filter(n2=>Math.abs(n2.x-B.x)<8&&n2.z>B.z-B.len/2-4&&n2.z<B.z+B.len/2+4);
if(navI.length<4) errs.push(`环礁: 栈桥面 NAV 通行带不足 (${navI.length}<4, Bot 上不了栈桥)`);
}
}
// ⑥ 珊瑚跑道台地: 平整 (矩形内高差≤0.35) 且台面高 ≈7.6
{
const R=SV.runway;
let mn=1e9,mx=-1e9;
for(let x=R.x0+5;x<=R.x1-5;x+=6)for(let z=R.z0+5;z<=R.z1-5;z+=6){ const h=hI(x,z); if(h<mn)mn=h; if(h>mx)mx=h; }
if(mx-mn>0.35) errs.push(`环礁: 跑道台地不平 (高差 ${(mx-mn).toFixed(2)}>0.35)`);
if(Math.abs((mn+mx)/2-7.6)>0.6) errs.push(`环礁: 跑道台面高程 ${((mn+mx)/2).toFixed(2)} (期望≈7.6)`);
const regR=vm.runInContext('BUILD_REG',ctx);
const apFlag=flags.find(f=>f.id==='机场');
const twr=regR.find(r=>r.type==='controltower');
if(!twr) errs.push('环礁: 缺塔台 (BUILD_REG type=controltower)');
else if(apFlag&&Math.hypot(twr.x-apFlag.x,twr.z-apFlag.z)>32) errs.push(`环礁: 塔台离机场旗 ${Math.hypot(twr.x-apFlag.x,twr.z-apFlag.z).toFixed(0)}m (>32 —— 会战枢纽的观察/防空位不落在旗圈)`);
if(regR.filter(r=>r.type==='hangar').length<2) errs.push('环礁: 机库不足 2 座 (可毁大件)');
}
// ⑦ 礁盘反登陆障碍带: 潮间带~礁盘 (离岸 6~36m) 内的不可碾硬障碍 ≥20 —— 且**不堵登陆航道**
{
const boxesI=vm.runInContext('BOXES',ctx), cylsI=vm.runInContext('CYLS',ctx);
const inReef=(x,z)=>{ const d=ctx.shoreDist(x,z); return d>6&&d<36; };
let nObs=0;
for(const b of boxesI){ if(b.dead) continue; const cx2=(b.minX+b.maxX)/2, cz2=(b.minZ+b.maxZ)/2; if(!inReef(cx2,cz2)) continue; if(b.crush) continue; if(b.maxY-b.minY<0.5) continue; nObs++; }
for(const c of cylsI){ if(inReef(c.x,c.z)&&c.r>0.25&&c.y1-c.y0>0.6) nObs++; }
if(nObs<20) errs.push(`环礁: 礁盘反登陆障碍不足 (${nObs}<20 —— 礁盘必须读得出"障碍带")`);
for(const ch of SV.channels){
const cw=ch.w-4;  // 航道净宽 (去掉边界噪声)
let jam=0;
for(const b of boxesI){ if(b.dead||b.crush) continue; const cx2=(b.minX+b.maxX)/2, cz2=(b.minZ+b.maxZ)/2; if(Math.abs(cx2-ch.x)<cw&&inReef(cx2,cz2)&&b.maxY-b.minY>0.4) jam++; }
for(const c of cylsI){ if(Math.abs(c.x-ch.x)<cw&&inReef(c.x,c.z)&&c.r>0.3&&c.y1-c.y0>0.6) jam++; }
if(jam) errs.push(`环礁: 登陆航道 x=${ch.x} 被障碍堵 (${jam} 件) —— 日后登陆艇进不来`);
}
}
// ⑧ 旗点全在陆上 (不被海水淹): 每旗离岸 ≥10m 且站立面高于海平面
for(const f of flags){
const d=ctx.shoreDist(f.x,f.z);
if(d>-10) errs.push(`环礁: 旗点「${f.id}」离岸 ${(-d).toFixed(0)}m (<10m —— 旗杆站水里)`);
if(hI(f.x,f.z)<SV.level+0.4) errs.push(`环礁: 旗点「${f.id}」站立面 ${hI(f.x,f.z).toFixed(2)} 低于海平面+0.4 (会被淹)`);
}
// ⑨ 地标与工事: 灯塔 (含环廊登顶) / 木碉堡群 / 岸防炮位 / 日机残骸 / 沉船 / 登陆艇残骸
{
const regI=vm.runInContext('BUILD_REG',ctx);
if(!regI.some(r=>r.type==='lighthouse'&&Math.hypot(r.x+180,r.z-164)<20)) errs.push('环礁: 西南岬缺灯塔地标');
if(!regI.some(r=>r.type==='coastalpit')) errs.push('环礁: 缺岸防炮位 (coastalPit)');
const nLB=regI.filter(r=>r.type==='logbunker').length;
if(nLB<6) errs.push(`环礁: 椰子木掩体不足 (${nLB}<6)`);
const nPit=regI.filter(r=>r.type==='coastalpit').length;
if(nPit<3) errs.push(`环礁: 岸防/纵深炮位不足 (${nPit}<3)`);
const stI=vm.runInContext('STAIRS',ctx);
if(!stI.some(s2=>Math.hypot(s2.x+180,s2.z-164)<12&&s2.topY>9.4)) errs.push('环礁: 灯塔环廊不可登顶 (无 topY≈10 的梯道落点)');
if(!stI.some(s2=>Math.hypot(s2.x+58,s2.z+66)<10&&s2.topY>7.0)) errs.push('环礁: 塔台顶不可登 (无 topY≈7.6 的梯道落点)');
// 灯塔不可摧毁 (2026-09-19 用户裁定): 灯塔墙组不得进 DESTRUCTIBLES (否则会被炸塌 → 环廊观察所消失)
{
const dstrI=vm.runInContext('DESTRUCTIBLES',ctx);
const lh=regI.find(r=>r.type==='lighthouse');
let hit=null;
for(const g of dstrI){
if(lh&&Math.hypot(g.cx-lh.x,g.cz-lh.z)<8){ hit=g; break; }
}
if(hit) errs.push(`环礁: 灯塔仍可摧毁 (DESTRUCTIBLES 内有 @${hit.cx.toFixed(0)},${hit.cz.toFixed(0)} 的结构组)`);
if(lh&&!lh.indestr) errs.push('环礁: 灯塔 BUILD_REG 未标 indestr');
}
const boxesI2=vm.runInContext('BOXES',ctx);
const wreckI=boxesI2.filter(b=>!b.dead&&b.maxY-b.minY>1.4&&b.maxY-b.minY<2.2&&ctx.shoreDist((b.minX+b.maxX)/2,(b.minZ+b.maxZ)/2)>-6).length;
if(wreckI<2) errs.push(`环礁: 滩头登陆艇残骸不足 (${wreckI}<2)`);
const sinkI=boxesI2.filter(b=>!b.dead&&b.maxY-b.minY>1.4&&b.maxY-b.minY<2.2&&ctx.shoreDist((b.minX+b.maxX)/2,(b.minZ+b.maxZ)/2)>60).length;
if(sinkI<2) errs.push(`环礁: 深水沉船残骸不足 (${sinkI}<2, 潜泳缺地标/掩体)`);
}
// ⑩ 椰林: 椰树记录 ≥200 (太平洋岛屿的识别特征; 椰树走 FLORA_HASH 可燃记录, 不入 TREE_LIVE 实例批)
{
const fhI=vm.runInContext('FLORA_HASH',ctx);
let palms=0;
for(const arr of fhI.values()) for(const rec of arr) if(rec.kind==='palm') palms++;
if(palms<200) errs.push(`环礁: 椰树不足 (${palms}<200 —— 一眼辨识度不足)`);
}
// ⑪ 深水占用格: 海侧深水必须记"水障(2)" 且浅水礁盘不记 (Bot 不走海 / 涉水可通行)
{
const OCCv=vm.runInContext('OCC',ctx);
if(OCCv&&OCCv.data){
const idxOf=(x,z)=>{ const i=Math.round((x+OCCv.off)/OCCv.res), j=Math.round((z+OCCv.off)/OCCv.res); return (i<0||j<0||i>=OCCv.N||j>=OCCv.N)?-1:j*OCCv.N+i; };
const zc=sZI(0);
const deep=idxOf(0,zc+90), reef=idxOf(0,zc+30), beach=idxOf(0,zc-20);
if(deep>=0&&OCCv.data[deep]!==2) errs.push(`环礁: 深水格未记水障 (值=${OCCv.data[deep]} ≠2)`);
if(reef>=0&&OCCv.data[reef]===2) errs.push('环礁: 礁盘浅水被误记水障 (涉水通道被 Bot 寻路封死)');
if(beach>=0&&OCCv.data[beach]===2) errs.push('环礁: 干沙滩被误记水障');
}
}
// ⑬ 四面环海 (★2026-09-19 用户裁定): 陆地是居中孤岛 —— 四个正方向全是海, **图四角必须是深海盆**,
//    且"离岸 ≤55m 内必达可通航深水"要在 72 条方位线上处处成立 (环岛通航环带绕岛一周不断)。
//    海域 ≥60% 且可通航深水 (>2.5m) ≥40% —— 这是"给海战足够发挥空间和影响力"的可检验口径。
{
const dP=ctx.shoreDist, sdP=ctx.seaDepthAt;
for(const [px,pz,nm] of [[0,300,'南'],[0,-300,'北'],[-300,0,'西'],[300,0,'东']]){
if(dP(px,pz)<80) errs.push(`环礁: ${nm}面不是海 (${px},${pz}) 离岸 ${(-dP(px,pz)).toFixed(0)}m <80`);
}
for(const [px,pz] of [[-320,-320],[320,-320],[-320,320],[320,320]]){
const dp=sdP(px,pz);
if(dp<8) errs.push(`环礁: 图角 (${px},${pz}) 水深 ${dp.toFixed(2)}<8 (角落的海太浅 —— 距离场越出岸线端点必须换端点距离)`);
}
let nT=0,seaT=0,deepT=0;
for(let x=-316;x<=316;x+=8)for(let z=-316;z<=316;z+=8){ nT++; if(dP(x,z)>0){ seaT++; if(sdP(x,z)>2.5) deepT++; } }
const frS=seaT/nT, fdS=deepT/nT;
if(frS<0.60) errs.push(`环礁: 海域占比 ${(frS*100).toFixed(0)}% <60% (四面环海不足)`);
if(fdS<0.40) errs.push(`环礁: 可通航深水占比 ${(fdS*100).toFixed(0)}% <40% (水域载具没地方跑)`);
// 环岛通航: 沿岸线各点向**本岸海侧法线**出海 40m 的整条闭合带必须处处 ≥32m 垂直离岸距离
// (剖面 32m ⇒ 水深 >3.1m) —— 即"环岛通航环带绕岛一周不断, 舰船可绕岛机动、可择湾逼近"。
// 度量用 shoreDist (到最近岸的垂直距离), 不用方位射线: 射线与斜岸斜交/在图角切薄水条都会虚报。
{
const coasts=vm.runInContext('seaCoastLines()',ctx);
let nPt=0, bad=null;
for(const co of coasts){
for(const p of co.pts){
nPt++;
const qx=p[0]+co.ox*40, qz=p[1]+co.oz*40;
if(Math.abs(qx)>318||Math.abs(qz)>318){ if(!bad) bad=[p,'环带出图']; continue; }
const dq=dP(qx,qz);
if(dq<32&&!bad) bad=[p,`离岸仅 ${dq.toFixed(1)}m (另一支岸线太近/出图)`];
}
}
if(nPt<40) errs.push(`环礁: 岸线闭合环点数不足 (${nPt}<40)`);
if(bad) errs.push(`环礁: 环岛通航环带断裂 @(${bad[0][0].toFixed(0)},${bad[0][1].toFixed(0)}) —— ${bad[1]}`);
}
}
// ⑭ 陆上语义不被海水污染: 建筑/椰树/战壕一律不得落进海里
// (shoreDist>0 = 海侧; 这里要求至少 1.5m 干陆; 战壕折线含 {rel:[岸名,a,d]} 现算形式 → 端点必须向陆)
{
const regW=vm.runInContext('BUILD_REG',ctx);
for(const r2 of regW){
const dw=ctx.shoreDist(r2.x,r2.z);
if(dw>-1.5){ errs.push(`环礁: 建筑 ${r2.type} 落水/贴水 @(${r2.x.toFixed(0)},${r2.z.toFixed(0)}) shoreDist=${dw.toFixed(1)}m`); break; }
}
const fhW=vm.runInContext('FLORA_HASH',ctx);
let wet=null;
for(const arr of fhW.values()) for(const rec of arr) if(rec.kind==='palm'&&ctx.shoreDist(rec.x,rec.z)>-1.5){ wet=rec; break; }
if(wet) errs.push(`环礁: 椰树落水/贴水 @(${wet.x.toFixed(0)},${wet.z.toFixed(0)}) shoreDist=${ctx.shoreDist(wet.x,wet.z).toFixed(1)}m`);
// 战壕 (含 rel 现算): 端点与中点都必须 ≥3m 干陆 (rel 的 d 是"入陆距离", 写错符号会把壕沟开到海里)
{
const pull=(a,d)=>[a, ctx.shoreZAt(a)-d];
let bad=null;
for(const t of (CAMPAIGN.trench||[])){
let p1,p2;
if(t&&t.rel){
const [c,a1,d1,a2,d2]=t.rel;
const f=(a,d)=>c==='shore'?[a,ctx.shoreZAt(a)-d]:c==='north'?[a,ctx.northZAt(a)+d]:
c==='west'?[ctx.coastXAt(SV.west,a)+d,a]:[ctx.coastXAt(SV.east,a)-d,a];
p1=f(a1,d1); p2=f(a2,d2);
}else{ p1=[t[0],t[1]]; p2=[t[2],t[3]]; }
for(const [px,pz] of [p1,p2,[(p1[0]+p2[0])/2,(p1[1]+p2[1])/2]]){
if(ctx.shoreDist(px,pz)>-3){ bad=[px,pz,ctx.shoreDist(px,pz)]; break; }
}
if(bad) break;
}
if(bad) errs.push(`环礁: 战壕端点/中点落在水线附近 @(${bad[0].toFixed(0)},${bad[1].toFixed(0)}) shoreDist=${bad[2].toFixed(1)}m (rel 的 d 应为"入陆距离">0)`);
}
}
// ⑮ 内陆不得低于海平面 (四面环海后内陆离岸距离变小: 缓丘负半周必须被 bias 顶住, 否则出现"干洼地")
{
let low=null;
for(let x=-300;x<=300;x+=10)for(let z=-300;z<=300;z+=10){
if(ctx.shoreDist(x,z)<-25&&hI(x,z)<0.2){ low=[x,z,hI(x,z)]; break; }
}
if(low) errs.push(`环礁: 陆上出现低于海平面的洼地 @(${low[0]},${low[1]}) h=${low[2].toFixed(2)}`);
}
// ⑫ 调试输出 (ISLE_DBG=1)
if(process.env.ISLE_DBG){
console.log('--- ISLE DBG ---');
{
let nT=0,seaT=0,deepT=0;
for(let x=-316;x<=316;x+=8)for(let z=-316;z<=316;z+=8){ nT++; const dd=ctx.shoreDist(x,z); if(dd>0){ seaT++; if(ctx.seaDepthAt(x,z)>2.5) deepT++; } }
console.log(`  海面占比 ${(seaT/nT*100).toFixed(0)}%  可通航深水(>2.5m) ${(deepT/nT*100).toFixed(0)}%`);
for(const f of flags) console.log(`  ${f.id} (${f.x},${f.z}) shoreDist=${ctx.shoreDist(f.x,f.z).toFixed(1)} h=${hI(f.x,f.z).toFixed(2)}`);
for(const [px,pz] of [[0,300],[-300,0],[300,0],[0,-300],[-320,-320],[320,320],[-296,188],[296,188]]) console.log(`  探点(${px},${pz}) shoreDist=${ctx.shoreDist(px,pz).toFixed(1)} depth=${ctx.seaDepthAt(px,pz).toFixed(2)} h=${hI(px,pz).toFixed(2)}`);
}
const zq=sZI(-60);
for(const u of [0,8,14,22,34,60]) console.log(`  u=${u} h=${hI(-60,zq-u).toFixed(2)}`);
for(const d of [0,10,22,30,36,43,60,120]) console.log(`  d=${d} depth=${sdI(-60,zq+d).toFixed(2)}`);
const R2=SV.runway;
console.log('  runway',JSON.stringify(R2),'sample h=',hI(0,-30).toFixed(2),hI(20,-100).toFixed(2),hI(-4,44).toFixed(2));
const stD=vm.runInContext('STAIRS',ctx);
console.log('  STAIRS:',stD.map(s2=>`(${s2.x.toFixed(0)},${s2.z.toFixed(0)},top=${s2.topY.toFixed(1)})`).join(' '));
const fh=vm.runInContext('FLORA_HASH',ctx);
let nPalm=0; for(const arr of fh.values()) for(const rec of arr) if(rec.kind==='palm') nPalm++;
console.log('  palms in FLORA_HASH =',nPalm,' TREE_LIVE=',vm.runInContext('TREE_LIVE',ctx).length);
}
}
}
return errs;
}
// ── 测试主体 ──
const idx=process.argv[2]!==undefined?parseInt(process.argv[2]):-1;
const probe=runCampaign(0,seed);
const campCount=vm.runInContext('CAMPAIGNS',probe.ctx).length;
const range=idx>=0&&idx<campCount?[idx]:Array.from({length:campCount},(_,k)=>k);
let allErr=0, allOk=0;
for(const i of range){
const r1=runCampaign(i,42), r2=runCampaign(i,42), r3=runCampaign(i,7);
const fp1=layoutFp(r1.ctx), fp2=layoutFp(r2.ctx), fp3=layoutFp(r3.ctx);
const errs=[];
if(fp1!==fp2) errs.push(`种子42两次布局指纹不一致 (len ${fp1.length} vs ${fp2.length})`);
if(fp1===fp3&&r1.CAMP.terr!=='opensea') errs.push('种子42与种子7布局完全相同——种子未生效');   // ★2026-10-04: opensea 布局全要素来自配置 (旗点/弹药箱舰体局部锚+舰编制, 无植被无建筑), 本就种子无关 —— ironbottom 换 nightsea(treeN 0) 后不再有随机摆树消耗种子, 断言对此类图收窄
errs.push(...checkLayout(r1));
const g=(x)=>vm.runInContext(x,r1.ctx).length;
const meta=r1.CAMP;
const tag=`${meta.id.padEnd(10)} ${meta.layout.padEnd(12)} ${String(meta.mode||'').padEnd(8)} destr=${g('DESTRUCTIBLES')}`;
if(process.env.DUMP){
const rcts=vm.runInContext('B_FOOT',r1.ctx);
const regs=vm.runInContext('BUILD_REG',r1.ctx);
const prps=vm.runInContext('PROPS',r1.ctx);
const fls=vm.runInContext('FLAGS',r1.ctx);
console.log('--- FLAGS ---');
for(const f of fls) console.log(`  ${f.id} (${f.x},${f.z}) r${f.r}`);
console.log('--- B_FOOT / REG ---');
for(let i=0;i<rcts.length;i++){ const f=rcts[i]; const rp=regs.find(r=>Math.abs(r.x-(f.x0+f.x1)/2)<0.01&&Math.abs(r.z-(f.z0+f.z1)/2)<0.01); console.log(`  FOOT#${f._i} seq${f._seq} ${f.x0.toFixed(1)}..${f.x1.toFixed(1)},${f.z0.toFixed(1)}..${f.z1.toFixed(1)} ${rp?('= '+rp.type):''}`); }
console.log('--- PROPS ---');
for(const p of prps) console.log(`  PROP#${p._i} seq${p._seq} (${p.x.toFixed(1)},${p.z.toFixed(1)}) r${p.r.toFixed(2)}${p.src?('  ← '+p.src):''}`);
}
if(errs.length){
allErr+=errs.length;
console.log(`${tag}\n  boxes=${g('BOXES')} cyls=${g('CYLS')} nav=${g('NAV_CLEARS')} foot=${g('B_FOOT')} props=${g('PROPS')} stairs=${g('STAIRS')} regs=${g('BUILD_REG')} trees=${g('TREE_LIVE')} ammo=${g('AMMO_CRATES')} depot=${g('DEPOTS')} hedges=${g('RURAL_HEDGES')}  fp=${fp1.length}`);
for(const e of errs) console.log('  ✗ '+e);
}else{
allOk++;
console.log(`${tag}\n  boxes=${g('BOXES')} cyls=${g('CYLS')} nav=${g('NAV_CLEARS')} foot=${g('B_FOOT')} props=${g('PROPS')} stairs=${g('STAIRS')} regs=${g('BUILD_REG')} trees=${g('TREE_LIVE')} ammo=${g('AMMO_CRATES')} depot=${g('DEPOTS')} hedges=${g('RURAL_HEDGES')}  fp=${fp1.length}  PASS`);
}
}
console.log(allErr? `\nLAYOUT FAILURES: ${allErr}` : `\nALL LAYOUT CHECKS PASSED`);
process.exit(allErr?1:0);
