// ─────────────────────────────────────────────
// dev/verify-buildings.js —— 建筑系统不变量验证沙箱 (不进 Index.html)
// 用法: node dev/verify-buildings.js
// 原理: 用最小 THREE/TEX 桩 + 复刻的地形高度场, 在 vm 上下文按真实加载顺序
//       求值 00-config.js → 05-world.js, 然后对 BOXES/CYLS/NAV_CLEARS/
//       B_FOOT/BUILD_REG/STAIRS 执行几何不变量断言。
// 注意: 高度场是 03-terrain.js 的复刻副本(仅供验证), 断言失败时先查本体逻辑。
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
class Obj3{ constructor(){ this.position=new P3(); this.rotation=new Rot(); this.scale=new Scl(); this.quaternion=new Quat(); this.children=[]; this.parent=null; this.matrix={}; this.castShadow=false; this.receiveShadow=false; this.visible=true; this.renderOrder=0; this.updateMatrix=()=>{}; }
add(m){ this.children.push(m); m.parent=this; } remove(m){ const i=this.children.indexOf(m); if(i>=0){ this.children.splice(i,1); m.parent=null; } }
traverse(fn){ fn(this); for(const c of this.children) if(c.traverse) c.traverse(fn); } }
class Geo{ constructor(...a){ this.parameters={width:a[0]||1,height:a[1]||1,depth:a[2]||1}; } translate(){return this;} rotateX(){return this;} rotateY(){return this;} }
return {
Group:class extends Obj3{}, Mesh:class extends Obj3{ constructor(g,m){ super(); this.geometry=g||new Geo(); this.material=m||{}; } },
InstancedMesh:class extends Obj3{ constructor(g,m,n){ super(); this.geometry=g; this.material=m; this.count=n; } setMatrixAt(){} },
Object3D:Obj3, Vector3:P3, Quaternion:Quat, CanvasTexture:class{ constructor(c){ this.image=c; } },
Euler:class{ set(){ return this; } },
Matrix4:class{ compose(){ return this; } },
BoxGeometry:Geo, CylinderGeometry:Geo, PlaneGeometry:Geo, SphereGeometry:Geo, ConeGeometry:Geo, TorusGeometry:Geo, CircleGeometry:Geo,
MeshLambertMaterial:class{ constructor(o){ Object.assign(this,o||{}); if(!this.color) this.color={set(){}}; } },
MeshBasicMaterial:class{ constructor(o){ Object.assign(this,o||{}); if(!this.color) this.color={set(){}}; } },
BufferGeometry:class{ constructor(){ this.attributes={}; } setAttribute(n,a){ this.attributes[n]=a; return this; } setIndex(){return this;} setFromPoints(){return this;} computeVertexNormals(){return this;} },
BufferAttribute:class{ constructor(a,n){ this.array=a; this.itemSize=n; } },
Float32BufferAttribute:class{},
};
}
// ── 地形高度场复刻 (03-terrain.js 验证用拷贝; 函数结构一致) ──
function makeTerrain(CAMPAIGN){
// ── 雪峰山: 主山脊线峰谷参数场 (03-terrain 副本, 须在 rawH/FLATS 之前) ──
const XF_RIDGE=[[-400,40],[-260,15],[-100,-15],[80,-30],[260,-5],[400,55]];
const XF_SEGS=[]; let XF_LEN=0;
{let cum=0,prev=null;for(const p of XF_RIDGE){if(prev){const l=Math.hypot(p[0]-prev[0],p[1]-prev[1]);XF_SEGS.push({ax:prev[0],az:prev[1],bx:p[0],bz:p[1],l,l0:cum});cum+=l;}prev=p;}XF_LEN=cum;}
function ridgeInfo(x,z){let bd=1e9,bt=0;for(const s of XF_SEGS){const abx=s.bx-s.ax,abz=s.bz-s.az;const t=Math.max(0,Math.min(1,((x-s.ax)*abx+(z-s.az)*abz)/(abx*abx+abz*abz||1)));const px=s.ax+abx*t,pz=s.az+abz*t;const d=Math.hypot(x-px,z-pz);if(d<bd){bd=d;bt=(s.l0+s.l*t)/XF_LEN;}}return{d:bd,t:bt};}
const xfGauss=(t,c,w)=>{const u=(t-c)/w;return Math.exp(-0.5*u*u);};
function ridgeH(t){let h=0;for(const c of [[0.20,44,0.055],[0.50,112,0.075],[0.84,52,0.06]])h+=c[1]*xfGauss(t,c[0],c[2]);for(const c of [[0.32,27,0.05],[0.655,31,0.05]])h+=c[1]*xfGauss(t,c[0],c[2]);return h;}
function rawH(x,z){
switch(CAMPAIGN.terr){
case 'urban': return 0.45*Math.sin(x*0.03)*Math.cos(z*0.028)+0.25*Math.sin(x*0.09+1)*Math.sin(z*0.07+0.5);
case 'delta': return 0.55*Math.sin(x*0.018)*Math.cos(z*0.02)+0.35*Math.sin(x*0.06+2)*Math.sin(z*0.05+1)-0.15;
case 'loess': return 3.8*Math.sin(x*0.018+0.5)*Math.cos(z*0.021)+2.0*(1-Math.abs(Math.sin(x*0.03+z*0.012+1)))+0.8*Math.sin(x*0.1+3)*Math.cos(z*0.09+1.2)-0.6;
case 'jungle': return 2.3*Math.sin(x*0.014)*Math.cos(z*0.017+1)+1.25*Math.sin(x*0.05+1.2)*Math.sin(z*0.043+2)+0.5*Math.sin(x*0.12+3)*Math.cos(z*0.1);
case 'deepjungle': return 1.9*Math.sin(x*0.016+0.3)*Math.cos(z*0.014+2)+1.0*Math.sin(x*0.045+0.7)*Math.sin(z*0.05+1.4)+0.4*Math.sin(x*0.11+1)*Math.cos(z*0.1+0.6);
case 'alpine':{ const r1=1-Math.abs(Math.sin(x*0.021+z*0.009)),r2=1-Math.abs(Math.sin(z*0.026-x*0.007+1.3)),r3=1-Math.abs(Math.sin((x+z)*0.014+2.6)); return r1*r1*6.5+r2*r2*4.2+r3*r3*2.5+1.3*Math.sin(x*0.05)*Math.cos(z*0.045)-2.6; }
case 'steppe': return 0.9*Math.sin(x*0.017+0.4)*Math.cos(z*0.015+1.2)+0.45*Math.sin(x*0.052+1.5)*Math.sin(z*0.045+0.8)+0.18*Math.sin(x*0.14+2)*Math.cos(z*0.12+0.4);
case 'woods': return 1.1*Math.sin(x*0.02+0.8)*Math.cos(z*0.019+1.4)+0.55*Math.sin(x*0.06+2)*Math.sin(z*0.055+1)+0.25*Math.sin(x*0.13+1)*Math.cos(z*0.11+2.4);
case 'mountain':{ const m=1-Math.exp(-(z*z)/(14*14)); const r1=1-Math.abs(Math.sin(x*0.018+z*0.006)),r2=1-Math.abs(Math.sin(z*0.038-x*0.004+1.3)); return m*(r1*r1*4.4+r2*2.2)+0.5*Math.sin(x*0.045+1)*Math.cos(z*0.05+0.7); }
case 'xuefeng':{ const ri=ridgeInfo(x,z); const dh=Math.max(0,Math.min(1,1-ri.d/230)); const s=dh*dh*(3-2*dh); const foot=3.5+2.2*Math.sin(x*0.02+0.7)*Math.cos(z*0.018+1)+1.4*Math.sin(x*0.043+2)*Math.sin(z*0.037+0.8)+2.8*Math.sin(x*0.014+1.2)*Math.cos(z*0.016+0.9)+1.7*Math.sin(x*0.031+2.4)*Math.sin(z*0.027+1.1)+0.9*Math.sin(x*0.061+0.4)*Math.cos(z*0.055+2); const sp1=Math.hypot(x+215,z-95), sp2=Math.hypot(x-245,z+85); const spur=24*Math.exp(-sp1*sp1/(2*70*70))+30*Math.exp(-sp2*sp2/(2*80*80)); return foot+s*s*ridgeH(ri.t)+spur+s*1.4*Math.sin(x*0.06+1)*Math.cos(z*0.055)+s*0.8*Math.sin(x*0.11+3)*Math.cos(z*0.09+1.2); }
case 'taihang':{ // 03-terrain 副本: 西南平原+双峰夹峙 (西峰72m/主峰118m, 垭口交接)
const mt=(cx,cz,H,R)=>{ const d=Math.hypot(x-cx,z-cz); const dh=Math.max(0,Math.min(1,1-d/R)); return H*dh*dh*(3-2*dh); };
const hM=mt(-135,15,72,135)+mt(30,-60,118,185)+mt(200,-120,78,135);
const base=1.5+0.9*Math.sin(x*0.017+0.4)*Math.cos(z*0.015+1.2)+0.45*Math.sin(x*0.052+1.5)*Math.sin(z*0.045+0.8)+0.22*Math.sin(x*0.12+2)*Math.cos(z*0.1+0.4);
const sN=0.5*Math.sin(x*0.06+1)*Math.cos(z*0.055)+0.3*Math.sin(x*0.11+3)*Math.cos(z*0.09+1.2);
return base+hM+Math.min(4,1+hM*0.09)*sN; }
default: return 1.4*Math.sin(x*0.021)*Math.cos(z*0.024)+0.9*Math.sin(x*0.052+1.7)*Math.sin(z*0.043+0.6)+0.5*Math.sin(x*0.11+3.1)*Math.cos(z*0.09+1.2);
}
}
const FLATS=[];
for(const b of CAMPAIGN.bases) FLATS.push({x:b.x,z:b.z,r:20,h:(CAMPAIGN.terr==='xuefeng'||CAMPAIGN.terr==='taihang')?rawH(b.x,b.z):rawH(b.x,b.z)*0.55});
for(const f of CAMPAIGN.flags) FLATS.push({x:f.x,z:f.z,r:f.r+12,h:(CAMPAIGN.terr==='xuefeng'||CAMPAIGN.terr==='taihang')?rawH(f.x,f.z):rawH(f.x,f.z)*0.55});
for(const s of (CAMPAIGN.spawns||[])) FLATS.push({x:s.x,z:s.z,r:8,h:rawH(s.x,s.z)*0.55});
if(CAMPAIGN.terr==='rolling') FLATS.push({x:0,z:0,r:34,h:rawH(0,0)*0.55});
const TRENCHES=(CAMPAIGN.trench||[]).map(t=>({x1:t[0],z1:t[1],x2:t[2],z2:t[3]}));
const RIVER={moscow:{pts:[[-165,-70],[-60,-34],[20,-48],[90,-92],[165,-120]],w:9,ice:true},
burma:{pts:[[-165,62],[-70,32],[-8,62],[60,12],[120,42],[165,22]],w:8,ice:false},
songhu:{pts:[[-165,-52],[-80,-42],[0,-58],[80,-32],[165,-42]],w:7,ice:false},
hukawng:{pts:[[-48,-165],[-26,-95],[-4,-25],[6,45],[24,115],[44,165]],w:10,ice:false,d:5}}[CAMPAIGN.id]||null;
const BRIDGE=CAMPAIGN.bridge||null;
let _deck=null;
function bridgeDeckY(){ if(_deck===null){ const B=BRIDGE; const dx=Math.sin(B.yaw),dz=Math.cos(B.yaw); const e=B.len/2+3; _deck=Math.max(heightAt(B.x-dx*e,B.z-dz*e),heightAt(B.x+dx*e,B.z+dz*e)); } return _deck; }
function heightAt(x,z,noBridge){
let h=rawH(x,z);
for(const f of FLATS){ const d=Math.hypot(x-f.x,z-f.z); if(d<f.r){ const s1=1-d/f.r; const s=s1*s1*(3-2*s1); h+=(f.h-h)*s; } }
// 03-terrain 副本: 诺曼底博卡日下沉土路 (田块表存在即启用)
if((CAMPAIGN.fields||[]).length){ const rd=roadDist(x,z); if(rd<4){ const k=1-rd/4; h-=0.45*k*k*(3-2*k); } }
for(const t of TRENCHES){ const d=seg(t.x1,t.z1,t.x2,t.z2,x,z); if(d<2.4){ const k=1-d/2.4; h-=1.3*k*k*(3-2*k); } }
if(RIVER){ let rd=1e9; const P=RIVER.pts; for(let i=0;i<P.length-1;i++){ const d=seg(P[i][0],P[i][1],P[i+1][0],P[i+1][1],x,z); if(d<rd) rd=d; } if(rd<RIVER.w){ const k=1-rd/RIVER.w; h-=(RIVER.ice?1.2:(RIVER.d||1.9))*k*k*(3-2*k); } }
if(!noBridge&&BRIDGE&&onBridge(x,z)){ const dy=bridgeDeckY(); if(dy>h) h=dy; }
return h;
}
function onBridge(x,z,m=0){ if(!BRIDGE) return false; const lx=x-BRIDGE.x,lz=z-BRIDGE.z; const ax=lx*Math.sin(BRIDGE.yaw)+lz*Math.cos(BRIDGE.yaw); const pv=lx*Math.cos(BRIDGE.yaw)-lz*Math.sin(BRIDGE.yaw); return Math.abs(ax)<BRIDGE.len/2+m&&Math.abs(pv)<BRIDGE.w/2+m; }
function inRiverChannel(x,z){ if(!RIVER||!(RIVER.d>2)) return false; if(onBridge(x,z)) return false; const P=RIVER.pts; for(let i=0;i<P.length-1;i++){ if(seg(P[i][0],P[i][1],P[i+1][0],P[i+1][1],x,z)<RIVER.w*0.8) return true; } return false; }
function roadDist(x,z){ let d=CAMPAIGN.sineRoad?Math.abs(z-3*Math.sin(x*0.02)):1e9; for(const r of CAMPAIGN.roads) d=Math.min(d,seg(r[0],r[1],r[2],r[3],x,z)); return d; }
return {heightAt,roadDist,inRiverChannel,onBridge,FLATS,bridgeDeckY};
}
function runCampaign(campIdx){
const errors=[];
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
// 05-world 依赖的 FLATS/heightAt 等(通常是 03-terrain 提供):
const CAMP=vm.runInContext('CAMPAIGN',ctx);
const terr=makeTerrain(CAMP);
ctx.heightAt=terr.heightAt; ctx.roadDist=terr.roadDist;
ctx.inRiverChannel=terr.inRiverChannel; ctx.onBridge=terr.onBridge;
ctx.FLATS=terr.FLATS; ctx.bridgeDeckY=terr.bridgeDeckY;
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
// ── 断言 ──
const B=vm.runInContext('BOXES',ctx), NCL=vm.runInContext('NAV_CLEARS',ctx);
const BF=vm.runInContext('B_FOOT',ctx), REG=vm.runInContext('BUILD_REG',ctx), ST=vm.runInContext('STAIRS',ctx);
const xz=(b,x,z)=>x>b.minX&&x<b.maxX&&z>b.minZ&&z<b.maxZ;
const camp=vm.runInContext('CAMPAIGN',ctx);
const boxes=vm.runInContext('BOXES',ctx), cyls=vm.runInContext('CYLS',ctx);
// 1) 足迹两两不重叠
for(let i=0;i<BF.length;i++)for(let j=i+1;j<BF.length;j++){
const a=BF[i],b=BF[j];
if(a.x0<b.x1&&a.x1>b.x0&&a.z0<b.z1&&a.z1>b.z0) errors.push(`footprint overlap #${i} vs #${j} @${a.x0.toFixed(0)},${a.z0.toFixed(0)}`);
}
// 2) 门: 宽度≥1.4 / 三米内 NAV_CLEARS≥1.2 / 通道净空(人高带 g0+0.56~g0+1.8)
for(const bld of REG){
for(const d of bld.doors){
if(d.w<1.4) errors.push(`${bld.type}@${bld.x.toFixed(0)},${bld.z.toFixed(0)} 门宽 ${d.w.toFixed(2)}<1.4`);
if(!NCL.some(n=>Math.hypot(n.x-d.x,n.z-d.z)<1.2&&n.r>=1.2)) errors.push(`${bld.type}@${bld.x.toFixed(0)},${bld.z.toFixed(0)} 门口缺 NAV_CLEARS≥1.2`);
for(const off of [-1.1,-0.7,-0.4,0,0.4,0.7,1.1]){
const px=d.x+d.dx*off, pz=d.z+d.dz*off;
for(const b of boxes){
if(b.dead||!xz(b,px,pz)) continue;
if(b.maxY>d.g0+0.56&&b.minY<d.g0+1.8){ errors.push(`${bld.type}@(${bld.x.toFixed(0)},${bld.z.toFixed(0)}) 门(${d.x.toFixed(1)},${d.z.toFixed(1)})off=${off}(y${d.g0.toFixed(2)}) 被堵 y=${b.minY.toFixed(2)}..${b.maxY.toFixed(2)} xz=${b.minX.toFixed(1)}..${b.maxX.toFixed(1)},${b.minZ.toFixed(1)}..${b.maxZ.toFixed(1)}`); break; }
}
}
}
}
// 3) 楼梯: 步高≤0.45 / 登顶落点支撑面=顶面 / 落点头顶净高≥1.7
for(const s of ST){
if(s.sr>0.45) errors.push(`楼梯步高 ${s.sr.toFixed(3)}>0.45 @${s.x.toFixed(0)},${s.z.toFixed(0)}`);
let sup=ctx.heightAt(s.x,s.z);
for(const b of boxes){ if(b.dead||!xz(b,s.x,s.z)) continue; if(b.maxY<=s.topY+0.55&&b.maxY>sup) sup=b.maxY; }
if(Math.abs(sup-s.topY)>0.12) errors.push(`楼梯登顶 @${s.x.toFixed(1)},${s.z.toFixed(1)} 支撑面=${sup.toFixed(2)}≠顶面=${s.topY.toFixed(2)}`);
for(const b of boxes){ if(b.dead||!xz(b,s.x,s.z)) continue; if(b.maxY<=s.topY+0.15) continue; if(b.minY<s.topY+1.7){ errors.push(`楼梯登顶 @${s.x.toFixed(1)},${s.z.toFixed(1)} 头顶被挡 y=${b.minY.toFixed(2)}..${b.maxY.toFixed(2)}`); break; } }
}
// 4) 屋顶碰撞存在 (roofY=碰撞带/平顶顶面)
for(const bld of REG){
if(bld.roofY==null) continue;
let found=false;
for(const b of boxes){ if(b.dead) continue;
const cx2=(b.minX+b.maxX)/2, cz2=(b.minZ+b.maxZ)/2;
if(Math.hypot(cx2-bld.x,cz2-bld.z)>Math.max(bld.w,bld.d)/2+2.5) continue;
if(b.maxY>bld.roofY-0.45&&b.maxY<bld.roofY+0.45){ found=true; break; } }
if(!found) errors.push(`${bld.type}@${bld.x.toFixed(0)},${bld.z.toFixed(0)} 屋顶碰撞缺失 (roofY=${bld.roofY&&bld.roofY.toFixed(2)})`);
if(bld.towerRoofY){ let tf=false; for(const b of boxes){ if(b.dead) continue; const cx2=(b.minX+b.maxX)/2, cz2=(b.minZ+b.maxZ)/2; if(Math.hypot(cx2-bld.x,cz2-(bld.z-10.6))>5) continue; if(b.maxY>bld.towerRoofY-0.45&&b.maxY<bld.towerRoofY+0.45){ tf=true; break; } } if(!tf) errors.push('教堂钟塔顶碰撞缺失'); }
}
// 5) 建筑落地: 四角有从地面以下起头的实体 (链式裙墙端点容差0.45m; 瞭望塔用腿柱, 跳过)
for(const bld of REG){
if(bld.type==='watchtower'||bld.type==='tramWreck') continue; // 电车残骸=车体坐坞(轮组/底盘没入坡地), 非建筑地基规则
const cs=Math.cos(bld.ry),sn=Math.sin(bld.ry);
for(const [kx,kz] of [[-1,-1],[1,-1],[1,1],[-1,1]]){
const px=bld.x+kx*(bld.w/2)*cs+kz*(bld.d/2)*sn, pz=bld.z-kx*(bld.w/2)*sn+kz*(bld.d/2)*cs;
const gh=ctx.heightAt(px,pz);
let ok=false;
for(const b of boxes){ if(b.dead) continue;
const coverX=px>b.minX-0.45&&px<b.maxX+0.45, coverZ=pz>b.minZ-0.45&&pz<b.maxZ+0.45;
if(!coverX||!coverZ) continue;
if(b.minY<=gh+0.15&&b.maxY>=gh-0.4){ ok=true; break; } }
if(!ok) errors.push(`${bld.type}@${bld.x.toFixed(0)},${bld.z.toFixed(0)} 角(${kx},${kz})悬空 gh=${gh.toFixed(2)}`);
}
}
// 6) 2026-09-05 用户实机反馈回归: 多层建筑四角竖缝 —— 前后墙必须伸满全宽咬住侧墙包络
// (局部缝点 (±(hw-t/2-0.03), ±hd) 于底层半墙高必须被活碰撞盒覆盖; 旧 ±(hw-t) 留 t/2 透缝)
{
const TT={block:0.42,factory:0.5}, MIDY={block:1.45,factory:3.4};
for(const bld of REG){
const t=TT[bld.type]; if(!t) continue;
const cs=Math.cos(bld.ry),sn=Math.sin(bld.ry), hw=bld.w/2, hd=bld.d/2, my=bld.floor+MIDY[bld.type];
for(const kx of [-1,1])for(const kz of [-1,1]){
const lx=kx*(hw-t/2-0.03), lz=kz*hd;
const px=bld.x+lx*cs+lz*sn, pz=bld.z-lx*sn+lz*cs;
let ok=false;
for(const b of boxes){ if(b.dead) continue;
if(px>b.minX&&px<b.maxX&&my>b.minY&&my<b.maxY&&pz>b.minZ&&pz<b.maxZ){ ok=true; break; } }
if(!ok) errors.push(`${bld.type}@${bld.x.toFixed(0)},${bld.z.toFixed(0)} 角缝(${kx>=0?'东':'西'},${kz>=0?'南':'北'}) 前后墙未咬住侧墙`);
}
}
}
// 7) 2026-09-05 用户实机反馈回归: 电车残骸端门必须真正可入 (旧版"门洞"被 2.0m 实心箱堵死)
for(const bld of REG){
if(bld.type!=='tramWreck') continue;
const cs=Math.cos(bld.ry),sn=Math.sin(bld.ry);
for(const kz of [-1,1]){
const lz=kz*5.0, my=bld.floor+1.0;
const px=bld.x+lz*sn, pz=bld.z+lz*cs;
for(const b of boxes){ if(b.dead) continue;
if(px>b.minX&&px<b.maxX&&my>b.minY&&my<b.maxY&&pz>b.minZ&&pz<b.maxZ){ errors.push(`电车残骸@${bld.x.toFixed(0)},${bld.z.toFixed(0)} 端门被实心箱堵死`); break; }
}
}
}
// 8) 2026-09-06 P1-3: 红十月厂区铁路支线对位 —— 双轨线段不得穿入围墙墙段, 不得穿入高构圆柱(烟囱)
//    (旧版豁口 [103,107] 与东轨 107.75 错位 2m=钢轨穿墙; 烟囱 L(17.5) 双轨穿基座; 吊罐 L(17) 正压轨心)
for(const bld of REG){
if(bld.type!=='factory') continue;
const ryC=Math.cos(bld.ry), ryS=Math.sin(bld.ry);
const Lf=(lx,lz)=>[bld.x+lx*ryC+lz*ryS, bld.z-lx*ryS+lz*ryC];
let hitWall=0, samples=0;
for(const rx of [17-0.75,17+0.75]){ // 轨距 ±0.75 (局部 x)
for(let lz=-32;lz<=32;lz+=0.25){ // ±32 覆盖南北围墙行 (z=-70/-8) 的轨线穿越点
const p=Lf(rx,lz);
const sy=ctx.heightAt(p[0],p[1])+0.12; // 轨面高 (轨 mesh 无碰撞; 平板车底 g0+0.225 在采样面之上, 车轮为近地圆柱另查)
samples++;
for(const b of boxes){ if(b.dead) continue;
if(p[0]>b.minX&&p[0]<b.maxX&&sy>b.minY&&sy<b.maxY&&p[1]>b.minZ&&p[1]<b.maxZ){ hitWall++; break; }
}
}
const pA=Lf(rx,-30), pB=Lf(rx,30);
for(const c of cyls){
if(c.y1-c.y0<4) continue; // 只查高构圆柱 (烟囱 h15); 车轮 r0.4 近地豁免
const d=seg(pA[0],pA[1],pB[0],pB[1],c.x,c.z);
if(d<c.r+0.15) errors.push(`红十月烟囱基座@(${c.x.toFixed(1)},${c.z.toFixed(1)}) r=${c.r} 侵入轨线 (净距 ${d.toFixed(2)}<${(c.r+0.15).toFixed(2)})`);
}
}
if(hitWall>0) errors.push(`红十月铁路支线: ${hitWall}/${samples} 轨面采样点落在活碰撞盒内 (轨穿墙/实物)`);
}
return {camp,errors,stats:{camps:vm.runInContext('CAMPAIGNS.length',ctx),boxes:boxes.length,cyls:cyls.length,nav:NCL.length,foot:BF.length,stairs:ST.length,reg:REG.length,meshes:vm.runInContext('world.children.length',ctx)}};
}
let totalFail=0;
const campCount=runCampaign(0).stats.camps;
for(let i=0;i<campCount;i++){
const r=runCampaign(i);
const ok=r.errors.length===0;
console.log(`${r.camp.id.padEnd(10)} ${r.camp.layout.padEnd(11)} ${ok?'PASS':'FAIL'}  boxes=${r.stats.boxes} cyls=${r.stats.cyls} nav=${r.stats.nav} foot=${r.stats.foot} stairs=${r.stats.stairs} regs=${r.stats.reg} meshes=${r.stats.meshes}`);
for(const e of r.errors){ console.log('   ✗ '+e); totalFail++; }
}
console.log(totalFail===0?'ALL BUILDING INVARIANTS PASSED':`FAILED: ${totalFail} error(s)`);
process.exit(totalFail===0?0:1);
