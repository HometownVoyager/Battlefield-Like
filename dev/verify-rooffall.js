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
BufferGeometry:class{ constructor(){ this.attributes={}; } setAttribute(n,a){ this.attributes[n]=a; return this; } setAttributeX(){return this;} setIndex(){return this;} setFromPoints(){return this;} computeVertexNormals(){return this;} },
BufferAttribute:class{ constructor(a,n){ this.array=a; this.itemSize=n; } },
Float32BufferAttribute:class{},
};
}
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
console.log('--- DESTRUCTIBLES 明细 ---');for(const g of DES){
console.log(`组@(${g.cx.toFixed(1)},${g.cz.toFixed(1)}) hp=${g.hp} dead=${g.dead} boxes=${g.bi.length} meshes=${g.meshes.length} roofRef=${g.roofRef?'有':'无'}`);
}
console.log('--- REG 明细 ---');
for(const b of REG){
console.log(`${b.type}@(${b.x.toFixed(1)},${b.z.toFixed(1)}) ${b.roofY!==undefined&&b.roofY!==null&&b.w!==undefined?`w=${b.w} d=${b.d} roofY=${b.roofY.toFixed(2)}`:''}`);
}
console.log('OK');
if(global.__pfFail) process.exit(1);
