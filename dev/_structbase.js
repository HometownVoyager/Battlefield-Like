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
// Geo = 盒几何桩: parameters 形状沿用旧版 (probe-struct 等按 width/height/depth 认盒), 另补
//   type='BoxGeometry' 与真实的 24 顶点 uv 属性 (每面 0..1 铺满整面) —— 05-world.uvGeo 的贴图密度归一
//   要靠 attributes.uv + clone() 才能在本体同构地跑起来 (dev/verify-uvscale.js 校验用)。
class Geo{ constructor(...a){ this.type='BoxGeometry'; this.parameters={width:a[0]||1,height:a[1]||1,depth:a[2]||1};
const uv=new Float32Array(48); for(let f=0;f<6;f++){ const o=f*8; uv[o]=0;uv[o+1]=1; uv[o+2]=1;uv[o+3]=1; uv[o+4]=0;uv[o+5]=0; uv[o+6]=1;uv[o+7]=0; }
this.attributes={ uv:{ array:uv, itemSize:2, count:24, needsUpdate:false } }; }
clone(){ const g=new Geo(this.parameters.width,this.parameters.height,this.parameters.depth); g.attributes.uv.array=this.attributes.uv.array.slice(); return g; }
translate(){return this;} rotateX(){return this;} rotateY(){return this;} setAttribute(n,a){ this.attributes[n]=a; return this; } setIndex(i){ this.index={array:(i&&i.length!==undefined)?i:[]}; return this; } computeVertexNormals(){ return this; } }
// 非盒几何桩: 只改 type (uvGeo 据此跳过), parameters 形状保持旧版不变 (probe-struct 的柱体识别依赖它)
class NonBoxGeo extends Geo{ constructor(t,...a){ super(...a); this.type=t; }
// clone 必须保类型: 基类 clone() 用 new Geo(...) 会把 type 翻成 BoxGeometry —— 2026-11-01 贴图批里
//   uvGeo 的圆柱失败路径曾把这种类型翻转的克隆顶替给网格, 探针"非盒构件"判据被静默清空 (假绿)。
clone(){ const g=new NonBoxGeo(this.type,this.parameters.width,this.parameters.height,this.parameters.depth); if(this.attributes&&this.attributes.uv) g.attributes.uv.array=this.attributes.uv.array.slice(); return g; } }
class PlaneGeo extends Geo{ constructor(w=1,h=1,sg=1,sh=1){ super(w,h); this.type='PlaneGeometry'; const gx=(sg||1)+1, gy=(sh||1)+1; this.attributes={position:{count:gx*gy,array:new Float32Array(gx*gy*3),getX:i=>((i%gx)/gx-0.5)*w,getZ:i=>(Math.floor(i/gx)/gy-0.5)*h,getY:()=>0,setY(){},setX(){},setZ(){}}}; this.index=null; } }
return {
Group:class extends Obj3{}, Mesh:class extends Obj3{ constructor(g,m){ super(); this.geometry=g||new Geo(); this.material=m||{}; } },
InstancedMesh:class extends Obj3{ constructor(g,m,n){ super(); this.geometry=g; this.material=m; this.count=n; } setMatrixAt(){} },
Object3D:Obj3, Vector3:P3, Quaternion:Quat, CanvasTexture:class{ constructor(c){ this.image=c; } },
Euler:class{ set(){ return this; } },
Matrix4:class{ compose(){ return this; } },
BoxGeometry:Geo, CylinderGeometry:class extends NonBoxGeo{ constructor(...a){ super('CylinderGeometry',...a); } },
PlaneGeometry:PlaneGeo, SphereGeometry:class extends NonBoxGeo{ constructor(...a){ super('SphereGeometry',...a); } },
ConeGeometry:class extends NonBoxGeo{ constructor(...a){ super('ConeGeometry',...a); } },
TorusGeometry:class extends NonBoxGeo{ constructor(...a){ super('TorusGeometry',...a); } },
CircleGeometry:class extends NonBoxGeo{ constructor(...a){ super('CircleGeometry',...a); } },
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
	// ★ 2026-09-20 补 default (与 03-terrain 本体同构): 旧副本漏了 default, 诺曼底(terr:'rolling')
	//    落进 default 之外的空白 ⇒ rawH 返回 undefined, 整张图高度场 NaN, 该图全部高度相关断言静默失效。
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
h=padHeight(x,z,h); // 03-terrain 副本: 建筑地基平台 (2026-09-20, foundation 登记 → 室内无坑/门槛零落差); 排在壕沟/河道下切之后(同本体)
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
// 通用水体判据 (★2026-09-26 P2-18): 05c 的野树/草丛门会调 03-terrain 的 inWaterBody
function inWaterBody(x,z){ const wy=waterYAt(x,z); return wy>-1e8&&heightAt(x,z,true)<wy-0.05; }
return {heightAt,roadDist,streetDist,cityUrban,inRiverChannel,inShallowChannel,onBridge,fordAt,FLATS,PADS,addPad,padHeight,bridgeDeckY,woodRavineDist,woodRampMask,shoreZAt,northZAt,coastXAt,coastDist,shoreDist,seaDepthAt,seaChannelMask,seaLandH,rectDist,waterYAt,waterDepthAt,inSea,inWaterBody};
}
function runCampaign(campIdx,seedN){
const THREE=makeThreeStub();
const sandbox={
console,Math,JSON,location:{search:'?seed='+seedN},
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
// 贴图密度表 (00-config.UV_DENSITY) 挂到沙箱材质桩: 与 02-scene.js 里那行**同一份表**, 不复制数值 ——
// 05-world.uvGeo 读 mat.uvRef, 沙箱不挂表就整条归一化路径空跑 (dev/verify-uvscale.js 会失去意义)。
{ const UV=vm.runInContext('UV_DENSITY',ctx);
for(const k in UV) if(sandbox.MAT[k]) sandbox.MAT[k].uvRef=UV[k]; }
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
module.exports={runCampaign,makeThreeStub,makeTerrain,seg};
