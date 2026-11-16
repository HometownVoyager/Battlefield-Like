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
// dev/verify-vehmodels.js —— 载具剪影建模验收探针 (不进 Index.html)
// 用法: node dev/verify-vehmodels.js
// 口径 (2026-09-20 I2 批): 按国家/车型差异化坦克与飞机模型 —— 六型坦克可辨识剪影 + 四型主力战机翼展比。
//
// 原理: 自造"可测量 THREE 桩" (BoxGeometry/CylinderGeometry/SphereGeometry 记录参数),
//       用 vm 只加载 00-config.js + 15-vehicles.js + 16-aircraft.js (建模段最小集),
//       直接 Tank.prototype.buildMesh.call(伪对象) / Plane.prototype.buildMesh.call(伪对象)
//       构建模型 —— 不启动整局游戏, 不碰 AI/物理。
// 量的是: 逐网格世界包围盒累加 (欧拉 XYZ 近似, 与 dev/audit-gunmodels.js 同源),
//       三角面数按 three.js 几何公式解析计算 (Box 12; Cylinder 2seg+caps; Sphere 2w(h-1))。
//
// 断言:
//   ① 六型坦克"尺寸向量"(长L/宽W/高H) 两两不完全相同
//   ② 日系九七式 vs 苏 T-34 / 德四号: 尺寸向量三分量相对差全部 >8% (且均值 >8%)
//   ③ 美/德/苏/日 炮塔形状签名 (几何种类直方图 + 外壳长宽比) 两两不同
//   ④ 四种主力战机 (P-51/BF-109/La-5/零式) 翼展÷机身长 比值两两不同 (相对差 ≥2%)
//   ⑤ 红线: 每个模型的包围盒三分量相对"改造前实测基线" 均 ≤±15%
//   ⑥ 接口契约: this.wheels 仍是 Mesh 数组 (userData sx/lz/vy/baseY); turretG/pitchG 存在且炮轴世界高 1.93
//                (update() 里 muzzle 的 1.93 是硬编码, 不可漂移); barrelTip 与炮管前端对齐 ≤0.45m;
//                Plane 仍有 prop/navLight/beacon/grp
//   ⑦ 无外部资源: 两文件内不出现任何 Loader / 图片模型扩展名 / http 链接
//   ⑧ 涂装分档: 六型轻坦出现 ≥3 种分档, 且 camo 分档车体 ≥3 个不同颜色
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');

// ── 改造前实测基线 (2026-09-20 改造前, 用本探针在同一桩上对旧建模段 (15-vehicles 共用 BoxGeometry /
//    16-aircraft 单一矩形翼) 实测; 即"±15% 红线"的比较基准, 供 ⑤ 断言与报告逐型偏差百分比) ──
// 结构: '阵营:变体' -> [L(z 长), W(x 宽), H(y 高)]  (米; 飞机为 size 缩放后的世界尺寸)
const BASELINE={
tanks:{'us:0':[7.541,3.99,2.42],'us:1':[9.201,3.99,2.42],'ger:0':[7.741,3.99,2.42],'ger:1':[9.501,3.99,2.42],
 'sov:0':[7.691,3.99,2.42],'sov:1':[9.051,3.99,2.42],'jp:0':[6.941,3.99,2.42],'jp:1':[8.051,3.99,2.42],
 'kmt:0':[6.641,3.99,2.42],'kmt:1':[7.601,3.99,2.42],'cpc:0':[6.941,3.99,2.42],'cpc:1':[8.051,3.99,2.42]},
planes:{'us:0':[4.125,7.6,1.22],'us:1':[4.863,8.968,1.44],'ger:0':[4.125,7.6,1.22],'ger:1':[4.863,8.968,1.44],
 'sov:0':[4.125,7.6,1.22],'sov:1':[4.945,9.12,1.464],'jp:0':[3.961,7.296,1.171],'jp:1':[4.617,8.512,1.366],
 'kmt:0':[4.043,7.448,1.196],'kmt:1':[4.33,7.98,1.31],'cpc:0':[4.617,8.512,1.366],'cpc:1':[4.74,8.74,1.403]},
};

// ══════════════ 可测量 THREE 桩 ══════════════
let GEO_SEQ=0;
function triCount(type,a){
if(type==='Box') return 12;
if(type==='Cylinder'){ const seg=Math.max(3,a[3]||8), hs=Math.max(1,a[4]||1), open=!!a[5];
const top=(a[0]||0)>0?seg:0, bot=(a[1]||0)>0?seg:0;
return 2*seg*hs+(open?0:top+bot); }
if(type==='Sphere'){ const w=Math.max(3,a[1]||8), h=Math.max(2,a[2]||6); return 2*w*(h-1); }
if(type==='Plane'){ const sw=Math.max(1,a[2]||1), sh=Math.max(1,a[3]||1); return 2*sw*sh; }
if(type==='Circle') return Math.max(3,a[1]||8);
if(type==='Ring') return 2*Math.max(3,a[2]||8);
if(type==='Torus') return 2*Math.max(3,a[2]||8)*Math.max(3,a[3]||6);
return 0;
}
function halfExt(type,a){
if(type==='Box') return [a[0]/2,a[1]/2,a[2]/2];
if(type==='Cylinder'){ const r=Math.max(a[0]||0,a[1]||0); return [r,(a[2]||0)/2,r]; }
if(type==='Sphere'){ const r=a[0]||0; return [r,r,r]; }
if(type==='Plane'){ const r=a[0]||0; return [r,a[1]||0,r]; } // 轴沿 Z: [w/2,0,h/2] 近似
if(type==='Circle'||type==='Ring'){ const r=Math.max(a[0]||0,a[1]||0); return [r,r,r]; }
return [0,0,0];
}
function makeTHREE(){
class V3{ constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
set(x,y,z){this.x=x;this.y=y;this.z=z;return this;} setScalar(s){this.x=this.y=this.z=s;return this;}
copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;} clone(){return new V3(this.x,this.y,this.z);} }
class Ev{ constructor(){this.x=0;this.y=0;this.z=0;this.order='XYZ';}
set(x,y,z,o){this.x=x;this.y=y;this.z=z;if(o)this.order=o;return this;} setFromEuler(){return this;} }
class Geo{
constructor(type,args){ this.id=++GEO_SEQ; this.type=type; this.args=args; this.tris=triCount(type,args);
this.half=halfExt(type,args); this.off=[0,0,0]; this.rots=[]; this.parameters={type,args}; }
translate(x,y,z){ this.off[0]+=x; this.off[1]+=y; this.off[2]+=z; return this; }
rotateX(a){ this.rots.push(['x',a]); return this; } rotateY(a){ this.rots.push(['y',a]); return this; }
rotateZ(a){ this.rots.push(['z',a]); return this; }
setAttribute(){return this;} setIndex(){return this;} computeVertexNormals(){return this;} dispose(){} }
class Obj3{
constructor(){ this.id=++GEO_SEQ; this.position=new V3(); this.rotation=new Ev(); this.scale=new V3(1,1,1);
this.children=[]; this.parent=null; this.visible=true; this.userData={}; this.isMesh=false; this.name='';
this.castShadow=false; this.receiveShadow=false; this.renderOrder=0; }
add(m){ this.children.push(m); m.parent=this; return this; }
remove(m){ const i=this.children.indexOf(m); if(i>=0){ this.children.splice(i,1); m.parent=null; } return this; }
traverse(fn){ fn(this); for(const c of this.children) c.traverse(fn); }
updateMatrix(){} }
class Mesh extends Obj3{ constructor(g,m){ super(); this.geometry=g; this.material=m||{}; this.isMesh=true; } }
class Group extends Obj3{}
class Sprite extends Obj3{ constructor(m){ super(); this.material=m||{}; } }
function deepClone(o){
const c=Object.create(Object.getPrototypeOf(o));
for(const k of Object.keys(o)) c[k]=o[k];
c.position=new V3(o.position.x,o.position.y,o.position.z);
c.rotation=new Ev().set(o.rotation.x,o.rotation.y,o.rotation.z,o.rotation.order);
c.scale=new V3(o.scale.x,o.scale.y,o.scale.z);
c.userData=Object.assign({},o.userData);
c.children=[]; c.parent=null;
for(const ch of o.children){ const cc=deepClone(ch); cc.parent=c; c.children.push(cc); }
return c;
}
for(const C of [Mesh,Group,Sprite]) C.prototype.clone=function(){ return deepClone(this); };
class Mat{ constructor(o){ Object.assign(this,o||{}); const c=o&&o.color;
this.color={ _v:c===undefined?0xffffff:c, getHexString(){ return ('000000'+(this._v>>>0).toString(16)).slice(-6); }, set(){}, setRGB(){} }; } }
const mk=type=>class extends Geo{ constructor(...a){ super(type,a); } };
// 2026-09-28: 履带带环/侧裙板改用自建 BufferGeometry (逐面法线/UV, 见 15-vehicles.tbBuilder) ⇒ 桩必须
// 认得它: 位置属性 = 精确采样点集, 索引数/3 = 三角数 (旧桩遇到 BufferGeometry 会当成空几何 ⇒ 包围盒
// 与网格数双双失真)。属性对象按真 three 的 getX/getY/getZ + array 口径。
class BufAttr{
constructor(arr,item){ this.array=arr; this.itemSize=item||3; this.count=arr.length/this.itemSize; this.needsUpdate=false; }
getX(i){ return this.array[i*this.itemSize]; } getY(i){ return this.array[i*this.itemSize+1]; } getZ(i){ return this.array[i*this.itemSize+2]; }
setX(i,v){ this.array[i*this.itemSize]=v; } setY(i,v){ this.array[i*this.itemSize+1]=v; } setZ(i,v){ this.array[i*this.itemSize+2]=v; }
}
class BufGeo{
constructor(){ this.id=++GEO_SEQ; this.type='Buffer'; this.args=[]; this.attributes={}; this.index=null; this.groups=[]; this.parameters={}; this.rots=[]; this.off=[0,0,0]; }
setAttribute(n,a){ this.attributes[n]=a; return this; } getAttribute(n){ return this.attributes[n]; }
setIndex(a){ this.index=a; return this; }
clearGroups(){ this.groups.length=0; return this; } addGroup(s,c,m){ this.groups.push({start:s,count:c,materialIndex:m}); return this; }
computeVertexNormals(){ return this; } dispose(){}
translate(x,y,z){ return this; } rotateX(){ return this; } rotateY(){ return this; } rotateZ(){ return this; }
get triCount(){ const n=this.index?(this.index.array?this.index.array.length:this.index.count||0):0; return n/3; }
get tris(){ return this.triCount; }
get localPts(){
const a=this.attributes.position&&this.attributes.position.array; if(!a) return [[0,0,0]];
const out=[]; for(let i=0;i<a.length;i+=3){ out.push([a[i],a[i+1],a[i+2]]); if(out.length>4096) break; } return out;
}
}
return { Vector3:V3, Euler:Ev, Object3D:Obj3, Group, Mesh, Sprite, BufferGeometry:BufGeo,
BufferAttribute:BufAttr, Float32BufferAttribute:BufAttr, Uint16BufferAttribute:BufAttr, Uint32BufferAttribute:BufAttr,
BoxGeometry:mk('Box'), CylinderGeometry:mk('Cylinder'), SphereGeometry:_FF17Sph(mk('Sphere')),
// ConeGeometry(radius,height,seg) 归一化成 CylinderGeometry(0,radius,height,seg) 口径 (three.js 里 Cone = Cylinder 的特例)
ConeGeometry:class extends Geo{ constructor(r=1,h=1,seg=8,...rest){ super('Cylinder',[0,r,h,seg,...rest]); this.wasCone=true; } },
PlaneGeometry:mk('Plane'), CircleGeometry:mk('Circle'), RingGeometry:mk('Ring'), TorusGeometry:mk('Torus'),
MeshLambertMaterial:Mat, MeshBasicMaterial:Mat, MeshStandardMaterial:Mat, MeshPhongMaterial:Mat,
SpriteMaterial:Mat, PointsMaterial:Mat,
CanvasTexture:class{ constructor(c){ this.image=c; this.needsUpdate=false; this.repeat=new V3(1,1,1); this.offset=new V3(); } clone(){ return new THREE.CanvasTexture(this.image); } dispose(){} },
MathUtils:{clamp:(v,a,b)=>v<a?a:(v>b?b:v)},
RepeatWrapping:1000, DoubleSide:2 };
}

// ══════════════ 沙箱 ══════════════
const mkTex=()=>({ wrapS:0,wrapT:0,needsUpdate:false,repeat:{x:1,y:1,set(x,y){this.x=x;this.y=y;}},
offset:{x:0,y:0}, clone(){ return mkTex(); }, dispose(){} });
function mkCanvas(){
const ctx2d=new Proxy({},{ get(t,k){ if(k in t) return t[k]; return ()=>{}; }, set(t,k,v){ t[k]=v; return true; } });
return { width:64,height:64, getContext:()=>ctx2d };
}
const THREE=makeTHREE();
function makeSandbox(){
const s={
console, Math, JSON, Date, THREE,
TEX:{grime:mkTex(), metalBrush:mkTex(), track:mkTex(), cloth:mkTex()},
world:{ added:[], add(m){ this.added.push(m); } },
FLAGS:[], AudioSys:{ createEngine:()=>({update(){}}) },
localStorage:{ _s:{}, getItem(k){ return this._s[k]??null; }, setItem(k,v){ this._s[k]=String(v); }, removeItem(k){ delete this._s[k]; } },
navigator:{ maxTouchPoints:0, userAgent:'node' },
document:{ createElement:t=>t==='canvas'?mkCanvas():{ style:{}, addEventListener(){}, appendChild(){}, setAttribute(){}, innerHTML:'', textContent:'' },
createElementNS:()=>mkCanvas(), getElementById:()=>({style:{},addEventListener(){},innerHTML:'',textContent:'',appendChild(){}}),
querySelector:()=>({style:{},addEventListener(){}}), querySelectorAll:()=>[], body:{appendChild(){},style:{}}, head:{appendChild(){}} },
window:{ addEventListener(){}, removeEventListener(){}, innerWidth:1280, innerHeight:720 },
performance:{ now:()=>Date.now() }, requestAnimationFrame:()=>0, cancelAnimationFrame:()=>{},
setTimeout:()=>0, clearTimeout:()=>{}, setInterval:()=>0, clearInterval:()=>{},
};
s.globalThis=s; s.window.document=s.document;
return s;
}
const sandbox=makeSandbox();
const ctx=vm.createContext(sandbox);
function load(f){ vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f}); }
load('js/00-config.js');
load('js/15-vehicles.js');
load('js/16-aircraft.js');
const API=vm.runInContext('({FACTIONS,Tank,Plane,TEAM_COL})',ctx);

// ══════════════ 包围盒量测 ══════════════
function rotEuler(e){
const cx=Math.cos(e.x),sx=Math.sin(e.x),cy=Math.cos(e.y),sy=Math.sin(e.y),cz=Math.cos(e.z),sz=Math.sin(e.z);
const rx=[1,0,0, 0,cx,-sx, 0,sx,cx], ry=[cy,0,sy, 0,1,0, -sy,0,cy], rz=[cz,-sz,0, sz,cz,0, 0,0,1];
const mul=(A,B)=>{ const C=new Array(9); for(let i=0;i<3;i++)for(let j=0;j<3;j++){ let t=0; for(let k=0;k<3;k++) t+=A[i*3+k]*B[k*3+j]; C[i*3+j]=t; } return C; };
return mul(mul(rx,ry),rz);
}
const IDENT=[1,0,0, 0,1,0, 0,0,1];
// 局部采样点集 —— 精确包围盒用: 盒=8 角; 圆柱/圆锥=上下底 n 个顶点 (与 three.js 顶点生成同式 x=r·sinθ,z=r·cosθ);
// 球=±r (旋转不改变球的 AABB); 其余退化为外接盒 8 角
function localPoints(g){
if(g.type==='Buffer') return g.localPts;   // 自建几何: 位置属性即精确采样点 (2026-09-28 履带带环/侧裙板)
const a=g.args, pts=[];
const corners=()=>{ for(const sx of[-1,1])for(const sy of[-1,1])for(const sz of[-1,1]) pts.push([sx*g.half[0],sy*g.half[1],sz*g.half[2]]); };
if(g.type==='Cylinder'||g.type==='Cone'){
const seg=Math.max(3,a[3]||8), hh=(a[2]||0)/2, rt=a[0]||0, rb=a[1]||0;
for(let k=0;k<seg;k++){ const th=2*Math.PI*k/seg, sn=Math.sin(th), cs=Math.cos(th);
pts.push([rt*sn,hh,rt*cs]); pts.push([rb*sn,-hh,rb*cs]); }
}else if(g.type==='Sphere'){ const r=a[0]||0; pts.push([-r,-r,-r],[r,r,r]); }
else corners();
return pts;
}
function gather(root,skip){
const out=[];
const rec=(o,px,py,pz,rx,ry,rz)=>{
if(skip&&skip.has(o)) return;
const x=px+o.position.x, y=py+o.position.y, z=pz+o.position.z;
const ex=rx+o.rotation.x, ey=ry+o.rotation.y, ez=rz+o.rotation.z;
if(o.isMesh&&o.geometry){ out.push({o,x,y,z,e:{x:ex,y:ey,z:ez},s:{x:o.scale.x,y:o.scale.y,z:o.scale.z}}); }
for(const c of o.children) rec(c,x,y,z,ex,ey,ez);
};
rec(root,0,0,0,0,0,0);
return out;
}
function measure(root,skip,onlyMesh){
let ms=gather(root,skip);
if(onlyMesh) ms=ms.filter(m=>m.o===onlyMesh);
if(!ms.length) return null;
let mn=[1e9,1e9,1e9], mx=[-1e9,-1e9,-1e9], tri=0;
const meshColors=new Set(), kinds=[], boxes=[];
for(const m of ms){
const g=m.o.geometry;
tri+=g.tris;
const col=m.o.material&&m.o.material.color?m.o.material.color.getHexString():'------';
meshColors.add(col);
// 几何自身旋转 (调用序累积) → 采样点集 → 偏移 → 网格缩放 → 网格旋转
let R=IDENT;
for(const [ax,a] of g.rots) R=mul(R,rotEuler(ax==='x'?{x:a,y:0,z:0}:ax==='y'?{x:0,y:a,z:0}:{x:0,y:0,z:a}));
const sx2=Math.abs(m.s.x), sy2=Math.abs(m.s.y), sz2=Math.abs(m.s.z);
const cx=m.x+g.off[0]*m.s.x, cy=m.y+g.off[1]*m.s.y, cz=m.z+g.off[2]*m.s.z;
const RM=rotEuler(m.e);
const bmn=[1e9,1e9,1e9], bmx=[-1e9,-1e9,-1e9];
for(const p of localPoints(g)){
const lx=R[0]*p[0]+R[1]*p[1]+R[2]*p[2], ly=R[3]*p[0]+R[4]*p[1]+R[5]*p[2], lz=R[6]*p[0]+R[7]*p[1]+R[8]*p[2];
const qx=lx*sx2, qy=ly*sy2, qz=lz*sz2;
const wx=cx+RM[0]*qx+RM[1]*qy+RM[2]*qz;
const wy=cy+RM[3]*qx+RM[4]*qy+RM[5]*qz;
const wz=cz+RM[6]*qx+RM[7]*qy+RM[8]*qz;
mn[0]=Math.min(mn[0],wx); mn[1]=Math.min(mn[1],wy); mn[2]=Math.min(mn[2],wz);
mx[0]=Math.max(mx[0],wx); mx[1]=Math.max(mx[1],wy); mx[2]=Math.max(mx[2],wz);
bmn[0]=Math.min(bmn[0],wx); bmn[1]=Math.min(bmn[1],wy); bmn[2]=Math.min(bmn[2],wz);
bmx[0]=Math.max(bmx[0],wx); bmx[1]=Math.max(bmx[1],wy); bmx[2]=Math.max(bmx[2],wz);
}
boxes.push({mn:bmn,mx:bmx,type:g.type,args:g.args,col:col===undefined?'-':col});
// 形状签名用: 几何种类 (Box/Cylinder(seg)/Sphere(w,h)/...)
if(g.type==='Cylinder'||g.type==='Cone') kinds.push((g.type==='Cone'?'K':(g.args[0]>0&&g.args[1]>0?'C':'K'))+(g.args[3]||8));
else if(g.type==='Sphere') kinds.push('S'+(g.args[1]||8));
else kinds.push(g.type[0]);
}
return { tri, n:ms.length, meshes:ms, boxes,
W:mx[0]-mn[0], H:mx[1]-mn[1], L:mx[2]-mn[2],
minY:mn[1], maxY:mx[1], zMin:mn[2], zMax:mx[2],
colors:[...meshColors].sort(), kinds:kinds.sort().join('') };
}

// ══════════════ 构建 ══════════════
function buildTank(key,vi){
const f={ def:API.FACTIONS[key].tanks[vi], variant:vi, team:0, wheels:[] };
API.Tank.prototype.buildMesh.call(f);
return f;
}
function buildPlane(key,vi){
const f={ def:API.FACTIONS[key].planes[vi], variant:vi, team:0 };
API.Plane.prototype.buildMesh.call(f);
return f;
}
const FKEYS=['us','ger','sov','jp','kmt','cpc'];
const FNAME={us:'美 us',ger:'德 ger',sov:'苏 sov',jp:'日 jp',kmt:'国 kmt',cpc:'八路 cpc'};
const OK=[],BAD=[];
function assert(name,cond,detail){ (cond?OK:BAD).push(name+(detail?` (${detail})`:''));
console.log(`  ${cond?'✓':'✗'} ${name}${detail?`  ${detail}`:''}`); }
const f2=v=>v.toFixed(2), f3=v=>v.toFixed(3);
const rel=(a,b)=>Math.abs(a-b)/Math.max(1e-9,Math.abs(b));

// ── 坦克量测 ──
const tankRows=[], tankM={};
for(const k of FKEYS){
tankM[k]=[];
for(let v=0;v<API.FACTIONS[k].tanks.length;v++){
const f=buildTank(k,v);
const full=measure(f.grp);
const casing=measure(f.turretG,new Set([f.pitchG])); // 炮塔外壳 (不含火炮) —— 剪影比对的基准件
const wheel=f.wheels[0], wg=wheel&&wheel.geometry;
const axisY=f.turretG.position.y+f.pitchG.position.y;
const gunFront=f.barrelMesh?measure(f.grp,null,f.barrelMesh).zMax:full.zMax;
const row={ k, v, def:f.def, name:f.def.name, heavy:!!f.def.heavy, tri:full.tri, n:full.n,
L:full.L, W:full.W, H:full.H, minY:full.minY,
tur:{ W:casing.W, L:casing.L, H:casing.H, tri:casing.tri, kinds:casing.kinds, colors:casing.colors },
sig:`${casing.kinds}|${(casing.W/casing.L).toFixed(2)}x${(casing.H/casing.L).toFixed(2)}`,
wheels:f.wheels.length, wheelR:wg?Math.max(wg.args[0],wg.args[1]):0, baseY:wheel?wheel.userData.baseY:0,
halfW:f.halfW, axisY, barrelTip:f.barrelTip, gunFront, colors:full.colors, tk:f.def.tk||null };
tankM[k].push(row); tankRows.push(row);
}
}

// ── 飞机量测 ──
const planeRows=[], planeM={};
for(const k of FKEYS){
planeM[k]=[];
for(let v=0;v<API.FACTIONS[k].planes.length;v++){
const f=buildPlane(k,v);
const full=measure(f.grp);
const row={ k,v,def:f.def,name:f.def.name,tri:full.tri,n:full.n,
L:full.L,W:full.W,H:full.H,minY:full.minY,
ratio:full.W/full.L, colors:full.colors,
hasProp:!!(f.prop&&f.prop.isMesh), hasLight:!!f.navLight, hasBeacon:!!f.beacon,
propZ:f.prop?f.prop.position.z:null, beaconY:f.beacon?f.beacon.position.y:null, pl:f.def.pl||null };
planeM[k].push(row); planeRows.push(row);
}
}

// ══════════════ 报告 ══════════════
console.log('\n═══ 六型坦克 (轻/主战档) ═══');
console.log('阵营      | 车型            | 三角面 | 网格 |   长L |   宽W |   高H | 炮塔宽×长×高      | 炮塔形状签名        | 负重轮 | 涂装色');
for(const r of tankRows){
if(r.v!==0) continue;
console.log(`${FNAME[r.k].padEnd(8)} | ${r.name.padEnd(14)} | ${String(r.tri).padStart(6)} | ${String(r.n).padStart(4)} | ${f2(r.L).padStart(6)} | ${f2(r.W).padStart(6)} | ${f2(r.H).padStart(6)} | ${(f2(r.tur.W)+'×'+f2(r.tur.L)+'×'+f2(r.tur.H)).padEnd(17)} | ${r.sig.padEnd(19)} | ${String(r.wheels).padStart(6)} | ${r.colors.length}`);
}
console.log('\n═══ 六型坦克 (重坦档, 同档位加长加宽) ═══');
console.log('阵营      | 车型            | 三角面 | 网格 |   长L |   宽W |   高H | 炮塔宽×长×高');
for(const r of tankRows){
if(r.v!==1) continue;
console.log(`${FNAME[r.k].padEnd(8)} | ${r.name.padEnd(14)} | ${String(r.tri).padStart(6)} | ${String(r.n).padStart(4)} | ${f2(r.L).padStart(6)} | ${f2(r.W).padStart(6)} | ${f2(r.H).padStart(6)} | ${f2(r.tur.W)+'×'+f2(r.tur.L)+'×'+f2(r.tur.H)}`);
}
console.log('\n═══ 十二型战机 ═══');
console.log('阵营      | 机型            | 三角面 | 网格 | 翼展W | 机身长L | 翼展/机身 | 机鼻     | 翼尖');
for(const r of planeRows){
console.log(`${FNAME[r.k].padEnd(8)} | ${r.name.padEnd(14)} | ${String(r.tri).padStart(6)} | ${String(r.n).padStart(4)} | ${f2(r.W).padStart(5)} | ${f2(r.L).padStart(7)} | ${r.ratio.toFixed(3).padStart(9)} | ${String(r.pl?r.pl.nose:'-').padEnd(8)} | ${String(r.pl?r.pl.tip:'-')}`);
}
console.log('\n═══ 机腹/机翼挂架等细节 (变体档) ═══');
console.log('阵营      | 机型            | 三角面 | 网格 | 翼展/机身 | 螺旋桨 z | 信标 y');
for(const r of planeRows){
if(r.v!==1) continue;
console.log(`${FNAME[r.k].padEnd(8)} | ${r.name.padEnd(14)} | ${String(r.tri).padStart(6)} | ${String(r.n).padStart(4)} | ${r.ratio.toFixed(3).padStart(9)} | ${f2(r.propZ).padStart(8)} | ${f2(r.beaconY).padStart(6)}`);
}

// ── 单模型逐件倾印 (排查几何用): VM_DUMP=jp:0 或 VM_DUMP=us:1:plane ──
const dumpKey=process.env.VM_DUMP;
if(dumpKey){
const [dk,dv,kind]=dumpKey.split(':');
const f=(kind==='plane')?buildPlane(dk,parseInt(dv||'0',10)):buildTank(dk,parseInt(dv||'0',10));
const mm=measure(f.grp);
console.log(`\n=== ${dumpKey} FULL DUMP (按 z 排序) ===  L=${f3(mm.L)} W=${f3(mm.W)} H=${f3(mm.H)} minY=${f3(mm.minY)}`);
mm.boxes.map((b,i)=>({i,...b})).sort((a,b)=>a.mn[2]-b.mn[2]).forEach(b=>{
console.log(`  #${b.i} ${b.type}(${b.args.slice(0,4).map(x=>typeof x==='number'?x.toFixed(2):x).join(',')}) x${f3(b.mn[0])}..${f3(b.mx[0])} y${f3(b.mn[1])}..${f3(b.mx[1])} z${f3(b.mn[2])}..${f3(b.mx[2])} #${b.col}`);
});
}

if(!BASELINE){
console.log('\n[CAPTURE 模式] BASELINE 未填写 —— 以上为当前实测; 把下面 JSON 粘进文件顶部后重跑即启用 ⑤ 红线断言:');
const cap={tanks:{},planes:{}};
for(const r of tankRows) cap.tanks[`${r.k}:${r.v}`]=[+r.L.toFixed(3),+r.W.toFixed(3),+r.H.toFixed(3)];
for(const r of planeRows) cap.planes[`${r.k}:${r.v}`]=[+r.L.toFixed(3),+r.W.toFixed(3),+r.H.toFixed(3)];
console.log(JSON.stringify(cap));
process.exit(0);
}

// ══════════════ 断言 ══════════════
const LIGHT=FKEYS.map(k=>tankM[k][0]);
console.log('\n═══ 尺寸偏差 (vs 改造前基线, 红线 ≤±15%) ═══');
console.log('坦克      | 车型            |   Δ长L |   Δ宽W |   Δ高H');
for(const r of tankRows){
const b=BASELINE.tanks[`${r.k}:${r.v}`]||[r.L,r.W,r.H];
const p=(cur,base)=>{ const d=(cur-base)/base*100; return ((d>=0?'+':'')+d.toFixed(1)+'%').padStart(7); };
console.log(`${FNAME[r.k].padEnd(8)} | ${r.name.padEnd(14)} | ${p(r.L,b[0])} | ${p(r.W,b[1])} | ${p(r.H,b[2])}   (旧 ${b.map(x=>x.toFixed(2)).join('/')} → 新 ${[r.L,r.W,r.H].map(x=>x.toFixed(2)).join('/')})`);
}
console.log('战机      | 机型            |   Δ长L |   Δ宽W |   Δ高H');
for(const r of planeRows){
const b=BASELINE.planes[`${r.k}:${r.v}`]||[r.L,r.W,r.H];
const p=(cur,base)=>{ const d=(cur-base)/base*100; return ((d>=0?'+':'')+d.toFixed(1)+'%').padStart(7); };
console.log(`${FNAME[r.k].padEnd(8)} | ${r.name.padEnd(14)} | ${p(r.L,b[0])} | ${p(r.W,b[1])} | ${p(r.H,b[2])}   (旧 ${b.map(x=>x.toFixed(2)).join('/')} → 新 ${[r.L,r.W,r.H].map(x=>x.toFixed(2)).join('/')})`);
}
console.log('\n═══ 派生量单源核对 (Lead 裁决①轮径 / ②推力框) ═══');
console.log('阵营      | 车型            | config whR | 几何 radiusTop | 滚动速率 新/旧 | 实测半宽 | 推力框 hx | Δhx vs 旧 2.05');
for(const r of tankRows){
const whR=r.tk?r.tk.whR:0;
const rate=0.36/whR; // 旧: ω=v/0.36 (硬编码); 新: ω=v/几何半径
const hx=Math.max(2.05,r.halfW);
console.log(`${FNAME[r.k].padEnd(8)} | ${r.name.padEnd(14)} | ${f3(whR).padStart(10)} | ${f3(r.wheelR).padStart(14)} | ${((rate>=1?'+':'')+((rate-1)*100).toFixed(1)+'%').padStart(14)} | ${f3(r.W/2).padStart(8)} | ${f3(hx).padStart(9)} | ${((hx-2.05)*1000>=0?'+':'')+((hx-2.05)*1000).toFixed(1)+'mm'}`);
}

console.log('\n═══ 断言 ═══');
// ① 六型坦克尺寸向量两两不同
let dup=[];
for(let i=0;i<LIGHT.length;i++) for(let j=i+1;j<LIGHT.length;j++){
const a=LIGHT[i],b=LIGHT[j];
if(rel(a.L,b.L)<1e-3&&rel(a.W,b.W)<1e-3&&rel(a.H,b.H)<1e-3) dup.push(`${a.k}/${b.k}`);
}
assert('① 六型坦克尺寸向量两两不完全相同',dup.length===0,dup.length?`重复: ${dup.join(',')}`:'6 型全互异');
// ② 日系 vs 苏/德 三分量 >8%
const jp=tankM.jp[0];
for(const other of ['sov','ger']){
const o=tankM[other][0];
const comps=[rel(jp.L,o.L),rel(jp.W,o.W),rel(jp.H,o.H)];
const mean=comps.reduce((a,b)=>a+b,0)/3;
assert(`② 日系九七式 明显小于 ${FNAME[other]} (长/宽/高 三分量差 >8%)`,comps.every(c=>c>0.08)&&mean>0.08,
`长L差 ${(comps[0]*100).toFixed(1)}% 宽W差 ${(comps[1]*100).toFixed(1)}% 高H差 ${(comps[2]*100).toFixed(1)}% 均值 ${(mean*100).toFixed(1)}%`);
}
// ③ 美/德/苏/日炮塔形状签名两两不同
let sdup=[];
const four=['us','ger','sov','jp'].map(k=>tankM[k][0]);
for(let i=0;i<four.length;i++) for(let j=i+1;j<four.length;j++)
if(four[i].sig===four[j].sig) sdup.push(`${four[i].k}/${four[j].k}`);
assert('③ 美/德/苏/日 炮塔形状签名两两不同',sdup.length===0,sdup.length?`重复: ${sdup.join(',')}`:four.map(r=>`${r.k}=${r.sig}`).join(' '));
// ④ 四型主力战机翼展/机身长比值两两不同
const fourPl=['us','ger','sov','jp'].map(k=>planeM[k][0]);
let pbad=[];
for(let i=0;i<fourPl.length;i++) for(let j=i+1;j<fourPl.length;j++){
const rr=rel(fourPl[i].ratio,fourPl[j].ratio);
if(rr<0.02) pbad.push(`${fourPl[i].name}/${fourPl[j].name}=${(rr*100).toFixed(1)}%`);
}
assert('④ 四型主力战机翼展÷机身长 两两不同 (相对差 ≥2%)',pbad.length===0,
pbad.length?pbad.join(' '):fourPl.map(r=>`${r.name}=${r.ratio.toFixed(3)}`).join(' '));
// ⑤ 红线 ±15%
let breach=[];
for(const r of tankRows){
const b=BASELINE.tanks[`${r.k}:${r.v}`];
if(!b) { breach.push(`${r.k}:${r.v} 无基线`); continue; }
[[r.L,b[0],'L'],[r.W,b[1],'W'],[r.H,b[2],'H']].forEach(([cur,base,ax])=>{
const d=rel(cur,base); if(d>0.15) breach.push(`${r.k}:${r.v}${ax} ${(d*100).toFixed(1)}%`); });
}
for(const r of planeRows){
const b=BASELINE.planes[`${r.k}:${r.v}`];
if(!b){ breach.push(`${r.k}:${r.v} 无基线`); continue; }
[[r.L,b[0],'L'],[r.W,b[1],'W'],[r.H,b[2],'H']].forEach(([cur,base,ax])=>{
const d=rel(cur,base); if(d>0.15) breach.push(`${r.k}:${r.v}${ax} ${(d*100).toFixed(1)}%`); });
}
assert('⑤ 全部模型包围盒三分量 vs 改造前基线 ≤±15%',breach.length===0,breach.length?breach.join(' '):'12 坦克 + 12 飞机全部在 ±15% 内');
// ⑥ 接口契约
let cbad=[];
for(const r of [...tankRows]){
const f={};
if(!(r.wheels>0)) cbad.push(`${r.k}:${r.v} wheels 空`);
if(r.wheelR<=0||!(r.baseY>0)) cbad.push(`${r.k}:${r.v} 轮参数`);
if(Math.abs(r.axisY-1.93)>0.02) cbad.push(`${r.k}:${r.v} 炮轴高 ${r.axisY.toFixed(3)}≠1.93`);
if(!(r.minY>=-0.05&&r.minY<=0.30)) cbad.push(`${r.k}:${r.v} 离地间隙 minY=${r.minY.toFixed(2)}`);
if(r.gunFront>0&&Math.abs(r.barrelTip-r.gunFront)>0.45) cbad.push(`${r.k}:${r.v} barrelTip=${r.barrelTip.toFixed(2)} vs 管口 ${r.gunFront.toFixed(2)}`);
// Lead 裁决①/② 派生量单源校验: 轮径来自几何=config whR; 推力框半宽 this.halfW=实测半宽
if(r.tk&&Math.abs(r.wheelR-r.tk.whR)>1e-6) cbad.push(`${r.k}:${r.v} 几何轮径 ${r.wheelR} ≠ config whR ${r.tk.whR}`);
if(!r.halfW||Math.abs(r.halfW-r.W/2)>0.02) cbad.push(`${r.k}:${r.v} halfW=${(r.halfW||0).toFixed(3)} vs 实测半宽 ${(r.W/2).toFixed(3)}`);
}
for(const r of planeRows){
if(!r.hasProp) cbad.push(`${r.k}:${r.v} 无 prop`);
if(!r.hasLight) cbad.push(`${r.k}:${r.v} 无 navLight`);
if(!r.hasBeacon) cbad.push(`${r.k}:${r.v} 无 beacon`);
if(Math.abs((r.beaconY||0)-3.4)>1e-6) cbad.push(`${r.k}:${r.v} beacon y≠3.4`);
}
assert('⑥ 接口契约 (wheels/turretG/pitchG/炮轴 1.93/barrelTip/prop/navLight/beacon)',cbad.length===0,cbad.length?cbad.join(' '):'全部通过');
// ⑦ 无外部资源
let ext=[];
for(const file of ['js/15-vehicles.js','js/16-aircraft.js']){
const src=fs.readFileSync(path.join(root,file),'utf8');
const m=src.match(/TextureLoader|GLTFLoader|OBJLoader|FBXLoader|\.png\b|\.jpe?g\b|\.glb\b|\.gltf\b|\.fbx\b|https?:\/\//g);
if(m) ext.push(`${file}: ${[...new Set(m)].join(',')}`);
}
assert('⑦ 建模段无外部资源引用 (Loader/图片/模型/URL)',ext.length===0,ext.join(' ')||'纯程序化几何');
// ⑧ 涂装分档: 三档齐备, 且每型实际出现的"涂装用色"恰等于其档位 (plain=col / two=col+colT / camo=col+colT+colA)
const tiers=[...new Set(LIGHT.map(r=>r.tk&&r.tk.paint))];
const tierWant={plain:1,two:2,camo:3};
const paintBad=[];
for(const r of LIGHT){
const pal=[r.def.col,r.def.colT,(r.tk||{}).colA].filter(v=>v!==undefined).map(v=>('000000'+(v>>>0).toString(16)).slice(-6));
const got=pal.filter(c=>r.colors.includes(c));
if(got.length!==tierWant[r.tk&&r.tk.paint]) paintBad.push(`${r.name} ${r.tk&&r.tk.paint} 期望${tierWant[r.tk&&r.tk.paint]}色 实得${got.length} [${pal.join(',')}]`);
}
assert('⑧ 涂装分档 ≥3 档, 且每档实际用色数 = 档位 (plain1/two2/camo3)',tiers.length>=3&&paintBad.length===0,
`分档 ${tiers.join('/')} (${tiers.length} 档)`+(paintBad.length?` 不符: ${paintBad.join('; ')}`:' 逐型吻合'));
// ⑨ draw call 护栏 (Lead 裁决③): 网格数上限, 下一批若继续加件会立刻看到代价 —— 我们的性能护栏, 不是玩法断言
const TANK_MESH_CAP=36, PLANE_MESH_CAP=20; // 现况: 坦克 22~33 (德系迷彩条最多; 2026-09-28 起裙板/端轮合并进带环几何, 上限从 36 降到 33), 战机 14~18
const over=[...tankRows.filter(r=>r.n>TANK_MESH_CAP).map(r=>`${r.name} ${r.n}>${TANK_MESH_CAP}`),
 ...planeRows.filter(r=>r.n>PLANE_MESH_CAP).map(r=>`${r.name} ${r.n}>${PLANE_MESH_CAP}`)];
const tMax=Math.max(...tankRows.map(r=>r.n)), pMax=Math.max(...planeRows.map(r=>r.n));
assert(`⑨ 网格数 (≈draw call) 护栏: 坦克 ≤${TANK_MESH_CAP} / 战机 ≤${PLANE_MESH_CAP}`,over.length===0,
over.length?over.join(' '):`实测最大 坦克 ${tMax} / 战机 ${pMax}; 全 24 型网格数 ${tankRows.map(r=>r.n).join(',')} / ${planeRows.map(r=>r.n).join(',')}`);

console.log(`\n结果: ${OK.length} 通过 / ${BAD.length} 失败`);
if(BAD.length) console.log('失败项:\n  - '+BAD.join('\n  - '));
process.exit(BAD.length?1:0);
