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
class Obj3{ constructor(){ this.position=new P3(); this.rotation=new Rot(); this.scale=new Scl(); this.quaternion=new Quat(); this.children=[]; this.parent=null; this.matrix={}; this.castShadow=false; this.receiveShadow=false; this.visible=true; this.renderOrder=0; this.frustumCulled=true; this.updateMatrix=()=>{}; }
add(m){ this.children.push(m); m.parent=this; } remove(m){ const i=this.children.indexOf(m); if(i>=0){ this.children.splice(i,1); m.parent=null; } }
traverse(fn){ fn(this); for(const c of this.children) if(c.traverse) c.traverse(fn); } }
class Geo{ constructor(...a){ this.parameters={width:a[0]||1,height:a[1]||1,depth:a[2]||1}; } translate(){return this;} rotateX(){return this;} rotateY(){return this;} }
class PlaneGeo extends Geo{ constructor(w=1,h=1,sg=1,sh=1){ super(w,h); const gx=(sg||1)+1, gy=(sh||1)+1; this.attributes={position:{count:gx*gy,array:new Float32Array(gx*gy*3),getX:i=>((i%gx)/gx-0.5)*w,getZ:i=>(Math.floor(i/gx)/gy-0.5)*h,getY:()=>0,setY(){},setX(){},setZ(){}}}; } }
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
case 'mountain':{ const m=1-Math.exp(-(z*z)/(14*14)); const r1=1-Math.abs(Math.sin(x*0.018+z*0.006)),r2=1-Math.abs(Math.sin(z*0.038-x*0.004+1.3)); return m*(r1*r1*4.4+r2*2.2)+0.5*Math.sin(x*0.045+1)*Math.cos(z*0.05+0.7); }
default: return 1.4*Math.sin(x*0.021)*Math.cos(z*0.024)+0.9*Math.sin(x*0.052+1.7)*Math.sin(z*0.043+0.6)+0.5*Math.sin(x*0.11+3.1)*Math.cos(z*0.09+1.2);
}
}
const FLATS=[];
for(const b of CAMPAIGN.bases) FLATS.push({x:b.x,z:b.z,r:20,h:(CAMPAIGN.terr==='loess'||CAMPAIGN.terr==='woods')?rawH(b.x,b.z):rawH(b.x,b.z)*0.55});
for(const f of CAMPAIGN.flags) FLATS.push({x:f.x,z:f.z,r:f.r+12,h:(CAMPAIGN.terr==='loess'||CAMPAIGN.terr==='woods')?rawH(f.x,f.z):rawH(f.x,f.z)*0.55});
if(WOOD&&WOOD.village){ const V=WOOD.village; FLATS.push({x:V.x,z:V.z,r:V.r,h:rawH(V.x,V.z)}); } // 许特根: 岭上村台地 (全高)
for(const s of (CAMPAIGN.spawns||[])) FLATS.push({x:s.x,z:s.z,r:8,h:rawH(s.x,s.z)*0.55});
const TRENCHES=(CAMPAIGN.trench||[]).map(t=>({x1:t[0],z1:t[1],x2:t[2],z2:t[3]}));
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
return {heightAt,roadDist,inRiverChannel,inShallowChannel,onBridge,FLATS,bridgeDeckY,woodRavineDist,woodRampMask};
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
for(let s=0;s<1200;s++){ updateFires(0.05); if(FIRE_ACTIVE.length>maxBurning) maxBurning=FIRE_ACTIVE.length; }
console.log(`点燃${seed0}格 → 峰值燃烧=${maxBurning}格, 60s后存活火=${FIRE_ACTIVE.length}`);
if(maxBurning<seed0+2) fail('火焰未蔓延 (峰值≤点燃数)');
else ok('火焰可向邻格蔓延');
if(FIRE_ACTIVE.length>0) fail('燃料耗尽后火未熄灭');
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
// 枯树 (无叶): 车体一碰即碎
let drec=null;
for(const arr of FLORA_HASH.values()){ for(const rec of arr){ if(rec.kind==='dead'&&!rec.dead){ drec=rec; break; } } if(drec) break; }
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
