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
	case 'mountain':{ // 03-terrain 副本: 谷地走廊+两侧山坡伏击带 (roadDist 相对公式)
	const rd=roadDist(x,z);
	const s3=t=>t*t*(3-2*t);
	const side=s3(Math.max(0,Math.min(1,(rd-5)/16)));
	const rim=s3(Math.max(0,Math.min(1,(rd-21)/11)));
	const rn=1+0.35*Math.sin(x*0.024+z*0.01+1)+0.2*Math.sin(x*0.055-z*0.03+0.7);
	return 0.4*Math.sin(x*0.05)+0.2*Math.sin(x*0.12+2)+side*9*rn+rim*7*rn; }
	case 'xuefeng':{ const ri=ridgeInfo(x,z); const dh=Math.max(0,Math.min(1,1-ri.d/230)); const s=dh*dh*(3-2*dh); const foot=3.5+2.2*Math.sin(x*0.02+0.7)*Math.cos(z*0.018+1)+1.4*Math.sin(x*0.043+2)*Math.sin(z*0.037+0.8)+2.8*Math.sin(x*0.014+1.2)*Math.cos(z*0.016+0.9)+1.7*Math.sin(x*0.031+2.4)*Math.sin(z*0.027+1.1)+0.9*Math.sin(x*0.061+0.4)*Math.cos(z*0.055+2); const sp1=Math.hypot(x+215,z-95), sp2=Math.hypot(x-245,z+85); const spur=24*Math.exp(-sp1*sp1/(2*70*70))+30*Math.exp(-sp2*sp2/(2*80*80)); return foot+s*s*ridgeH(ri.t)+spur+s*1.4*Math.sin(x*0.06+1)*Math.cos(z*0.055)+s*0.8*Math.sin(x*0.11+3)*Math.cos(z*0.09+1.2); }
	case 'taihang':{ // 03-terrain 副本: 西南平原+双峰夹峙 (西峰72m/主峰118m, 垭口交接, 山体风化噪声)
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
for(const s of (CAMPAIGN.spawns||[])) FLATS.push({x:s.x,z:s.z,r:CAMPAIGN.layout==='canyon'?6:8,h:rawH(s.x,s.z)*0.55});
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
// 03-terrain 副本: 柏林地铁下沉广场 (2026-09-05 城市组)
const METRO=(CAMPAIGN.city&&CAMPAIGN.city.metro)||null;
if(METRO){ const d=Math.hypot(x-METRO.x,z-METRO.z); if(d<METRO.r){ const k=1-d/METRO.r; h-=METRO.d*k*k*(3-2*k); } }
// 03-terrain 副本: 诺曼底博卡日下沉土路 (田块表存在即启用)
if((CAMPAIGN.fields||[]).length){ const rd=roadDist(x,z); if(rd<4){ const k=1-rd/4; h-=0.45*k*k*(3-2*k); } }
for(const t of TRENCHES){ const d=seg(t.x1,t.z1,t.x2,t.z2,x,z); if(d<2.4){ const k=1-d/2.4; h-=1.3*k*k*(3-2*k); } }
if(RIVER){ let rd=1e9; const P=RIVER.pts; for(let i=0;i<P.length-1;i++){ const d=seg(P[i][0],P[i][1],P[i+1][0],P[i+1][1],x,z); if(d<rd) rd=d; } if(rd<RIVER.w){ const k=1-rd/RIVER.w; h-=(RIVER.ice?1.2:(RIVER.d||1.9))*k*k*(3-2*k); } }
if(!noBridge&&BRIDGE&&onBridge(x,z)){ const dy=bridgeDeckY(); if(dy>h) h=dy; }
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
function onBridge(x,z,m=0){ if(!BRIDGE) return false; const lx=x-BRIDGE.x,lz=z-BRIDGE.z; const ax=lx*Math.sin(BRIDGE.yaw)+lz*Math.cos(BRIDGE.yaw); const pv=lx*Math.cos(BRIDGE.yaw)-lz*Math.sin(BRIDGE.yaw); return Math.abs(ax)<BRIDGE.len/2+m&&Math.abs(pv)<BRIDGE.w/2+m; }
function inRiverChannel(x,z){ if(!RIVER||!(RIVER.d>2)) return false; if(onBridge(x,z)) return false; const P=RIVER.pts; for(let i=0;i<P.length-1;i++){ if(seg(P[i][0],P[i][1],P[i+1][0],P[i+1][1],x,z)<RIVER.w*0.8) return true; } return false; }
function roadDist(x,z){ let d=CAMPAIGN.sineRoad?Math.abs(z-3*Math.sin(x*0.02)):1e9; for(const r of CAMPAIGN.roads) d=Math.min(d,seg(r[0],r[1],r[2],r[3],x,z)); return d; }
return {heightAt,roadDist,streetDist,cityUrban,inRiverChannel,onBridge,FLATS,bridgeDeckY};
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
const CAMP=vm.runInContext('CAMPAIGN',ctx);
const terr=makeTerrain(CAMP);
ctx.heightAt=terr.heightAt; ctx.roadDist=terr.roadDist; ctx.sineRoadZ=(x)=>3*Math.sin(x*0.02); ctx.streetDist=terr.streetDist; ctx.cityUrban=terr.cityUrban;
ctx.inRiverChannel=terr.inRiverChannel; ctx.onBridge=terr.onBridge;
ctx.FLATS=terr.FLATS; ctx.bridgeDeckY=terr.bridgeDeckY;
// 03-terrain 的城市语义全局 (沙箱未加载本体, 同构注入): CITY 常量供 05c/05a 使用
ctx.CITY=CAMP.city||null;
ctx.METRO=(CAMP.city&&CAMP.city.metro)||null;
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
if(!reg.length&&CAMPAIGN.layout!=='canyon') errs.push('BUILD_REG 为空——布局未生成任何建筑');
// 8) 诺曼底围田树篱: 不得侵入旗点净空圈 (布局期已按 r+7 避让, 此处兜底)
if(vm.runInContext('RURAL_HEDGES',ctx).length){
for(const f of flags){
for(const h of vm.runInContext('RURAL_HEDGES',ctx)){
if(Math.hypot(h.x-f.x,h.z-f.z)<f.r+6) errs.push(`围田树篱 (${h.x.toFixed(1)},${h.z.toFixed(1)}) 侵入旗点「${f.id}」净空圈`);
}
}
}
// 9) 雪峰山: 复刻 OCC(建筑→门口→圆柱→陡坡→走廊打通, 与 03-terrain 同序) → 5m 寻路格洪水填充
if(CAMPAIGN.id==='xuefeng'&&bases.length>=2){
const terr2=makeTerrain(CAMPAIGN);
const H=(x,z)=>terr2.heightAt(x,z);
const MS=vm.runInContext('MAP_SIZE',ctx);
const off=(MS+40)/2, N=Math.ceil(MS+40)+1;
const occ=new Uint8Array(N*N);
const mrect=(x0,z0,x1,z1)=>{const i0=Math.max(0,Math.floor(x0+off)),i1=Math.min(N-1,Math.ceil(x1+off));const j0=Math.max(0,Math.floor(z0+off)),j1=Math.min(N-1,Math.ceil(z1+off));for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++) occ[j*N+i]=1;};
for(const bx of vm.runInContext('BOXES',ctx)){
if(bx.dead) continue;
const gh=H((bx.minX+bx.maxX)/2,(bx.minZ+bx.maxZ)/2);
if(bx.maxY<gh+0.5||bx.minY>gh+1.75) continue;
mrect(bx.minX-0.6,bx.minZ-0.6,bx.maxX+0.6,bx.maxZ+0.6);
}
for(const cl of vm.runInContext('NAV_CLEARS',ctx)){
const i0=Math.max(0,Math.floor(cl.x-cl.r+off)),i1=Math.min(N-1,Math.ceil(cl.x+cl.r+off));
const j0=Math.max(0,Math.floor(cl.z-cl.r+off)),j1=Math.min(N-1,Math.ceil(cl.z+cl.r+off));
for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const xx=i-off,zz=j-off;if((xx-cl.x)*(xx-cl.x)+(zz-cl.z)*(zz-cl.z)<=cl.r*cl.r) occ[j*N+i]=0;}
}
const mcirc=(x,z,rr)=>{const i0=Math.max(0,Math.floor(x-rr+off)),i1=Math.min(N-1,Math.ceil(x+rr+off));const j0=Math.max(0,Math.floor(z-rr+off)),j1=Math.min(N-1,Math.ceil(z+rr+off));for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const xx=i-off,zz=j-off;if((xx-x)*(xx-x)+(zz-z)*(zz-z)<=rr*rr) occ[j*N+i]=1;}};
for(const c of vm.runInContext('CYLS',ctx)){
if(c.r<0.28) continue;
mcirc(c.x,c.z,c.r+0.6);
}
// 陡坡阻断 (8×8 厚墙) → 走廊打通 (公路/战壕/旗圈/基地圈最后清)
const step=4, th=0.95;
for(let j=4;j<N-4;j+=step)for(let i=4;i<N-4;i+=step){
const x=i-off,z=j-off;
const hx=Math.abs(H(x+step,z)-H(x-step,z))/(2*step);
const hz=Math.abs(H(x,z+step)-H(x,z-step))/(2*step);
if(Math.max(hx,hz)>th){
for(let k=-2;k<=5;k++)for(let l=-2;l<=5;l++){const jj=j+l,ii=i+k;if(jj>=0&&jj<N&&ii>=0&&ii<N) occ[jj*N+ii]=1;}
}
}
const clearC=(x,z,r)=>{const i0=Math.max(0,Math.floor(x-r+off)),i1=Math.min(N-1,Math.ceil(x+r+off));const j0=Math.max(0,Math.floor(z-r+off)),j1=Math.min(N-1,Math.ceil(z+r+off));for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const xx=i-off,zz=j-off;if((xx-x)*(xx-x)+(zz-z)*(zz-z)<=r*r) occ[j*N+i]=0;}};
for(const rd of CAMPAIGN.roads){const l=Math.hypot(rd[2]-rd[0],rd[3]-rd[1])||1;for(let u=0;u<=1;u+=5/l) clearC(rd[0]+(rd[2]-rd[0])*u,rd[1]+(rd[3]-rd[1])*u,9);}
for(const t of (CAMPAIGN.trench||[])){const l=Math.hypot(t[2]-t[0],t[3]-t[1])||1;for(let u=0;u<=1;u+=4/l) clearC(t[0]+(t[2]-t[0])*u,t[1]+(t[3]-t[1])*u,4.5);}
for(const f of flags) clearC(f.x,f.z,f.r+8);
for(const b of bases) clearC(b.x,b.z,26);
const SP=5, NN=Math.floor(MS/SP)+1, NOFF=MS/2;
const oc1=(x,z)=>{const i=Math.round(x+off),j=Math.round(z+off);if(i<0||j<0||i>=N||j>=N) return true;return occ[j*N+i]===1;};
const ok=new Uint8Array(NN*NN);
const sx=Math.round((bases[0].x+NOFF)/SP), sz=Math.round((bases[0].z+NOFF)/SP);
if(oc1(bases[0].x,bases[0].z)) errs.push('雪峰山: 西基地中心落入陡坡阻断格');
else{
ok[sz*NN+sx]=1; const que=[[sx,sz]]; let qi=0;
while(qi<que.length){
const [ix,iz]=que[qi++];
for(const dy of [-1,0,1])for(const dx of [-1,0,1]){
if(!dx&&!dy) continue;
const nx=ix+dx,nz=iz+dy;
if(nx<0||nz<0||nx>=NN||nz>=NN||ok[nz*NN+nx]) continue;
if(oc1(nx*SP-NOFF,nz*SP-NOFF)) continue;
ok[nz*NN+nx]=1; que.push([nx,nz]);
}
}
}
const reach=(x,z)=>{const i=Math.round((x+NOFF)/SP),j=Math.round((z+NOFF)/SP);return i>=0&&j>=0&&i<NN&&j<NN&&ok[j*NN+i]===1;};
if(!reach(bases[1].x,bases[1].z)) errs.push('雪峰山: 西基地→东基地 寻路不连通');
for(const f of flags){ if(!reach(f.x,f.z)) errs.push(`雪峰山: 旗点「${f.id}」(${f.x},${f.z}) 从西基地不可达`); }
}
// 12) 城市组断言 (2026-09-05 城市组·斯大林格勒/柏林):
//     建筑足迹不侵占街道矩形 / 多层可上楼(楼梯数) / 地标存在 / 地铁下沉量 / 电车残骸
const CT=CAMPAIGN.city;
if(CT){
const SD=1.0; // 街缘容差 (B_FOOT 已含 1.0 余量, 合计≥2m 净距)
for(const s of CT.streets){
for(const f of foots){
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
if(!types.includes('metro')) errs.push('柏林: 缺少地铁入口亭 (BUILD_REG type=metro)');
const M=CT.metro;
if(M){
const hc=ctx.heightAt(M.x,M.z), he=ctx.heightAt(M.x,M.z+M.r+3);
if(hc>he-0.5) errs.push(`柏林: 地铁下沉不足 (中心 ${hc.toFixed(2)} vs 外缘 ${he.toFixed(2)})`);
}
if(types.filter(t=>t==='block').length<4) errs.push(`柏林: 沿街多层公寓不足 (${types.filter(t=>t==='block').length} < 4)`);
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
if(fp1===fp3) errs.push('种子42与种子7布局完全相同——种子未生效');
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
