// ─────────────────────────────────────────────
// dev/_wreck-selfcheck.js —— 三件残骸模型/材质重建自检 (不进 Index.html, 不在 run-all-verify 清单内)
// 用法:
//   node dev/_wreck-selfcheck.js --capture   只捕获改造前基线 (模型量测 + 13 图布局指纹哈希) → 打印待粘贴常量
//   node dev/_wreck-selfcheck.js             全量自检 (模型量测 + 6 车型签名 + 水线分带 + 布局零漂移)
//   node dev/_wreck-selfcheck.js --models    只跑模型层 (A/C/D)
//   node dev/_wreck-selfcheck.js --fp        只跑布局指纹 (B)
//
// 为什么这样写 (2026-09-20 wreck-art):
//  ① 布局指纹的**唯一漂移源**是 05-world 的全局确定性随机流 `_wstate` (wr/wri/wRand)。
//     三件函数改造前的全局取数次数 = tankWreck 1 (炮塔转角) / planeWreck 0 / landingCraft 1 (横倾);
//     groundFit/propFree/propTake/freeSpot 取数 0。⇒ 本自检把"取数次数不变"做成源码级断言 (C),
//     再把"指纹逐字节不变"做成运行时断言 (B) —— 两者合起来才是"零漂移"的证据链。
//  ② 布局指纹只含 BOXES/CYLS/NAV_CLEARS/B_FOOT/PROPS/STAIRS/BUILD_REG/AMMO_CRATES/TREE_LIVE/DEPOTS/FLAGS,
//     不含 world 网格/coverPoints。故重建只许动"视觉网格", 碰撞盒与 prop 调用必须逐字不动 (C 断言)。
//  ③ 指纹计算**复用 dev/verify-layouts.js 本体**(截断其测试主体后取 runCampaign/layoutFp),
//     不另抄一份地形副本 —— 单源纪律: 沙箱与本体算法永远同构。
//  ④ 模型量测用自造"可测量 THREE 桩"(记录几何类型/参数 + 精确矩阵), 与 dev/verify-vehmodels.js 同源手法。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'), path=require('path'), vm=require('vm'), crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const CAP=process.argv.includes('--capture');
const ONLY_MODELS=process.argv.includes('--models');
const ONLY_FP=process.argv.includes('--fp');

// ══════════════ 基线 (改造前实测, 由 --capture 生成) ══════════════
// files: 捕获时刻各源文件 sha256 前 16 位 —— 用于把"指纹变了"归因到具体文件 (队友并发改 05c/00-config 时不被误判)
// ⚠ 队友并发写会改 files 里的哈希: 那不代表漂移, 只代表"该文件自捕获起被动过"; 判漂移一律看 fp.
const BASELINE={
captured:"2026-09-20T12:27",
files:{"js/00-config.js":"5008406ea25d0cf8","js/05-world.js":"18e693143958ac94","js/05a-buildings.js":"c2ae52b04924b96d","js/05b-props.js":"f7c8e1e324f1ff6c","js/05c-layouts.js":"545791479ac2652e","js/04b-fire.js":"ff9c42a96c90cb77","dev/verify-layouts.js":"3fb9e55f491a0ec4"},
fp:{"normandy":{"fpLen":265480,"fpSha":"2485e4c46d7c1fad"},"stalingrad":{"fpLen":206080,"fpSha":"17386d498b237fc2"},"berlin":{"fpLen":403698,"fpSha":"8d21fe1c5746d487"},"songhu":{"fpLen":253447,"fpSha":"04f095a2254aae27"},"baituan":{"fpLen":350223,"fpSha":"9a095a102c0feb60"},"burma":{"fpLen":75169,"fpSha":"801d8fca8baf903e"},"moscow":{"fpLen":582776,"fpSha":"a07ebd8575147d7b"},"hukawng":{"fpLen":464736,"fpSha":"a676c16c8fb4a45e"},"steppe":{"fpLen":121873,"fpSha":"80e2d078b43d7137"},"woodline":{"fpLen":307593,"fpSha":"c5b6cedcb0ab5189"},"canyon":{"fpLen":23848,"fpSha":"a8eb706a451df602"},"island":{"fpLen":282850,"fpSha":"c7a5ad6c4cac184e"}},
// 改造前实测 (三件 = 3 盒 / 7 网格 / 9 网格; 坦克六车型包围盒 L 全等 6.07 ⇒ 签名间距 0.1% = "太简陋"的量化证据)
models:{"tankWreck":{"L":6.068675505570324,"W":3.025593776053401,"H":2.2853140660793905,"n":3,"mats":{"2e2c28+tex":3},"parts":{"?":3},"boxesAdded":1,"propsAdded":1},"planeWreck":{"L":7.16899313649392,"W":9.665313153532665,"H":2.4687620610060366,"n":7,"mats":{"35322c+tex":2,"6e6a5e+tex":4,"------+flat":1},"parts":{"?":7},"boxesAdded":1,"propsAdded":1},"landingCraft":{"L":14.333610854544785,"W":3.4021696477553625,"H":2.6139565120187336,"n":9,"mats":{"4a5240+tex":4,"2f342c+tex":2,"------+flat":3},"parts":{"?":9},"boxesAdded":1,"propsAdded":1}},
};
// 三件函数改造前的"全局随机取数次数" (wr/wri/wRand 合计) —— 源码级断言的红线
const RNG_REDLINE={tankWreck:1,planeWreck:0,landingCraft:1};
// 碰撞/prop 口径红线: 每件的 addBoxCollider / propTake / propFree / freeSpot / coverPoints.push 次数
const CALL_REDLINE={
tankWreck:{addBoxCollider:1,propTake:1,propFree:1,freeSpot:1,coverPoints:1},
planeWreck:{addBoxCollider:1,propTake:1,propFree:1,freeSpot:1,coverPoints:1},
landingCraft:{addBoxCollider:1,propTake:1,propFree:1,freeSpot:1,coverPoints:1},
};

// ══════════════ 通用: sha256 ══════════════
const clamp=(v,a,b)=>v<a?a:(v>b?b:v);   // 与 00-config 同名工具 (本文件在 Node 侧复算, 不依赖游戏全局)
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const shaFile=f=>{ try{ return sha(fs.readFileSync(path.join(root,f))).slice(0,16); }catch(e){ return 'MISSING'; } };
const TRACK_FILES=['js/00-config.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/04b-fire.js','dev/verify-layouts.js'];

// ══════════════ ① 复用 verify-layouts 本体的指纹机 ══════════════
// 截断在测试主体 (const idx=process.argv[2]) 之前, 再把 runCampaign/layoutFp 暴露到 globalThis。
function loadFingerprintAPI(){
const src=fs.readFileSync(path.join(root,'dev/verify-layouts.js'),'utf8');
const cut=src.indexOf('const idx=process.argv[2]');
if(cut<0) throw new Error('verify-layouts.js 结构变了: 找不到测试主体锚点 const idx=process.argv[2]');
const body=src.slice(0,cut)+'\n;globalThis.__VL={runCampaign,layoutFp,checkLayout,makeTerrain,seed};';
const s={console,process,require,Buffer,__dirname:path.join(root,'dev'),__filename:path.join(root,'dev/verify-layouts.js')};
s.globalThis=s;
const c=vm.createContext(s);
vm.runInContext(body,c,{filename:'dev/verify-layouts.js[head]'});
return vm.runInContext('__VL',c);
}
// 逐战役布局指纹 (与 verify-layouts 逐字节同一份字符串) + 残骸网格账 (性能红线 #10 的量化依据)
const WK_OLD={tank:3,plane:7,landingCraft:9};   // 改造前每件网格数 (实测: 3 盒 / 7 网格 / 9 网格)
function fingerprints(VL){
const n=vm.runInContext('CAMPAIGNS',VL.runCampaign(0,VL.seed).ctx).length;
const out=[];
for(let i=0;i<n;i++){
const r=VL.runCampaign(i,VL.seed);
const fp=VL.layoutFp(r.ctx);
const g=k=>vm.runInContext(k,r.ctx).length;
// 残骸网格账: 按 grp.userData.wkRole 归组, 逐件数网格 (含子组)
const wc=vm.runInContext(`(()=>{ const o={tank:0,plane:0,landingCraft:0},n={tank:0,plane:0,landingCraft:0};
for(const c of world.children){ const role=c.wkRole||(c.userData&&c.userData.wkRole); if(!role) continue;
 n[role]++; let k=0; c.traverse(x=>{ if(x.geometry) k++; }); o[role]+=k; }   // 沙箱桩没有 isMesh ⇒ 用 geometry 判定
return {o,n,world:world.children.length}; })()`,r.ctx);
let add=0; for(const k in wc.o) add+=wc.o[k]-WK_OLD[k]*wc.n[k];
out.push({i,id:r.CAMP.id,fpLen:fp.length,fpSha:sha(fp).slice(0,16),wk:wc,addMeshes:add,
counts:`boxes=${g('BOXES')} cyls=${g('CYLS')} nav=${g('NAV_CLEARS')} props=${g('PROPS')} regs=${g('BUILD_REG')}`});
}
return out;
}

// ══════════════ ② 可测量 THREE 桩 (精确矩阵, 记录几何类型/参数) ══════════════
function makeMeasuredTHREE(){
let SEQ=0;
// 几何: 记录 type + args + three 风格 parameters; clone 不复制 attributes (uvGeo 会优雅退化为原样返回)
const PARAM={
Box:(a)=>({width:a[0],height:a[1],depth:a[2]}),
Cylinder:(a)=>({radiusTop:a[0],radiusBottom:a[1],height:a[2],radialSegments:a[3]||8}),
Sphere:(a)=>({radius:a[0],widthSegments:a[1]||8,heightSegments:a[2]||6}),
Plane:(a)=>({width:a[0],height:a[1]}),
Circle:(a)=>({radius:a[0],segments:a[1]||8}),
Torus:(a)=>({radius:a[0],tube:a[1],radialSegments:a[2]||8,tubularSegments:a[3]||6}),
};
class Geo{
constructor(type,args){ this.id=++SEQ; this.type=type+'Geometry'; this.args=args; this.parameters=PARAM[type](args);
this.attributes={}; this.offs=[0,0,0]; this.rots=[]; }
translate(x,y,z){ this.offs[0]+=x; this.offs[1]+=y; this.offs[2]+=z; return this; }
rotateX(a){ this.rots.push(['x',a]); return this; } rotateY(a){ this.rots.push(['y',a]); return this; }
rotateZ(a){ this.rots.push(['z',a]); return this; }
setAttribute(n,v){ this.attributes[n]=v; return this; } setIndex(){ return this; } computeVertexNormals(){ return this; }
clone(){ const g=new Geo(this.type.replace('Geometry',''),this.args.slice()); g.offs=this.offs.slice(); g.rots=this.rots.slice(); return g; }
dispose(){} }
const mk=t=>class extends Geo{ constructor(...a){ super(t,a); } };
class V3{ constructor(x=0,y=0,z=0){ this.x=x;this.y=y;this.z=z; }
set(x,y,z){ this.x=x;this.y=y;this.z=z; return this; } setScalar(s){ this.x=s;this.y=s;this.z=s; return this; }
copy(v){ this.x=v.x;this.y=v.y;this.z=v.z; return this; } clone(){ return new V3(this.x,this.y,this.z); } normalize(){ return this; } }
class Ev{ constructor(){ this.x=0;this.y=0;this.z=0;this.order='XYZ'; }
set(x,y,z,o){ this.x=x;this.y=y;this.z=z; if(o) this.order=o; return this; } setFromEuler(){ return this; } }
class Scl{ constructor(){ this.x=1;this.y=1;this.z=1; } set(x,y,z){ this.x=x;this.y=y;this.z=z; return this; }
setScalar(s){ this.x=s;this.y=s;this.z=s; return this; } }
class Obj3{
constructor(){ this.id=++SEQ; this.position=new V3(); this.rotation=new Ev(); this.scale=new Scl();
this.quaternion={setFromUnitVectors(){return this;},identity(){return this;}}; this.children=[]; this.parent=null;
this.userData={}; this.isMesh=false; this.name=''; this.castShadow=false; this.receiveShadow=false;
this.visible=true; this.renderOrder=0; }
add(m){ this.children.push(m); m.parent=this; return this; }
remove(m){ const i=this.children.indexOf(m); if(i>=0){ this.children.splice(i,1); m.parent=null; } return this; }
traverse(fn){ fn(this); for(const c of this.children) c.traverse(fn); }
updateMatrix(){} }
class Mesh extends Obj3{ constructor(g,m){ super(); this.geometry=g||new Geo('Box',[1,1,1]); this.material=m||{}; this.isMesh=true; } }
class InstancedMesh extends Mesh{ constructor(g,m,n){ super(g,m); this.count=n||1; } setMatrixAt(){} }
class Mat{ constructor(o){ Object.assign(this,o||{}); const c=o&&o.color;
this.color={ _v:c===undefined?0xffffff:c, getHexString(){ return ('000000'+((this._v>>>0)&0xffffff).toString(16)).slice(-6); }, set(){}, setRGB(){} }; } }
const T={ Vector3:V3, Euler:Ev, Object3D:Obj3, Group:class extends Obj3{}, Mesh, InstancedMesh,
BoxGeometry:mk('Box'), CylinderGeometry:mk('Cylinder'), SphereGeometry:mk('Sphere'),
ConeGeometry:class extends Geo{ constructor(r=1,h=1,seg=8){ super('Cylinder',[0,r,h,seg]); this.wasCone=true; } },
PlaneGeometry:mk('Plane'), CircleGeometry:mk('Circle'), TorusGeometry:mk('Torus'),
MeshLambertMaterial:Mat, MeshBasicMaterial:Mat, MeshStandardMaterial:Mat, MeshPhongMaterial:Mat,
CanvasTexture:class{ constructor(c){ this.image=c; this.needsUpdate=false; this.repeat=new V3(1,1,1); } clone(){ return this; } dispose(){} },
Quaternion:class{ setFromUnitVectors(){ return this; } }, Matrix4:class{ compose(){ return this; } },
BufferGeometry:class{ constructor(){ this.attributes={}; } setAttribute(n,v){ this.attributes[n]=v; return this; } setIndex(){return this;} computeVertexNormals(){return this;} },
Float32BufferAttribute:class{ constructor(a,i){ this.array=a; this.itemSize=i; } },
BufferAttribute:class{ constructor(a,i){ this.array=a; this.itemSize=i; } },
RepeatWrapping:1000, DoubleSide:2, MathUtils:{clamp:(v,a,b)=>v<a?a:(v>b?b:v)},
};
return T;
}
// 材质 → 分件标签 (颜色/贴图/uvRef); 贴图带 _wkName 时按名记录 (TEX 就位模拟用)
function matKey(m){ if(!m) return 'none';
const c=m.color?m.color.getHexString():'------';
const tn=m.map&&m.map._wkName;
return `${c}+${tn||(m.map?'tex':'flat')}${m.uvRef?('@'+m.uvRef):''}`; }

// ══════════════ ③ 精确包围盒 (父→子矩阵链, 支持 Euler order) ══════════════
const I3=[1,0,0,0,1,0,0,0,1];
function mul(A,B){ const C=new Array(9); for(let i=0;i<3;i++)for(let j=0;j<3;j++){ let t=0; for(let k=0;k<3;k++) t+=A[i*3+k]*B[k*3+j]; C[i*3+j]=t; } return C; }
function rotM(e){
const cx=Math.cos(e.x),sx=Math.sin(e.x),cy=Math.cos(e.y),sy=Math.sin(e.y),cz=Math.cos(e.z),sz=Math.sin(e.z);
const RX=[1,0,0, 0,cx,-sx, 0,sx,cx], RY=[cy,0,sy, 0,1,0, -sy,0,cy], RZ=[cz,-sz,0, sz,cz,0, 0,0,1];
const o=e.order||'XYZ';
if(o==='YXZ') return mul(mul(RY,RX),RZ);
if(o==='ZYX') return mul(mul(RZ,RY),RX);
if(o==='YZX') return mul(mul(RY,RZ),RX);
if(o==='ZXY') return mul(mul(RZ,RX),RY);
if(o==='XZY') return mul(mul(RX,RZ),RY);
return mul(mul(RX,RY),RZ);
}
// 几何采样点 → 局部 AABB (圆柱/圆锥用环点, 球用 ±r, 盒用 8 角) —— 旋转下的真实包围盒
function geoPoints(g){
const a=g.args, S=[], push=p=>S.push(p);
if(g.type==='CylinderGeometry'){
const seg=Math.max(3,a[3]||8), hh=(a[2]||0)/2, rt=a[0]||0, rb=a[1]||0;
for(let k=0;k<seg;k++){ const th=2*Math.PI*k/seg, sn=Math.sin(th), cs=Math.cos(th);
push([rt*sn,hh+rt*0,rt*cs]); push([rb*sn,-hh,rb*cs]); }
if(a[0]>0) push([0,hh,0]); if(a[1]>0) push([0,-hh,0]);
}else if(g.type==='SphereGeometry'){ const r=a[0]||0; push([-r,-r,-r]); push([r,r,r]); }
else if(g.type==='PlaneGeometry'){ const w=(a[0]||0)/2,h=(a[1]||0)/2; push([-w,-h,0]); push([w,h,0]); }
else if(g.type==='CircleGeometry'||g.type==='TorusGeometry'){ const r=(a[0]||0)+((a[1])||0); push([-r,-r,-r]); push([r,r,r]); }
else { const w=(a[0]||0)/2,h=(a[1]||0)/2,d=(a[2]||0)/2;
for(const sx of[-1,1])for(const sy of[-1,1])for(const sz of[-1,1]) push([sx*w,sy*h,sz*d]); }
return S;
}
// 遍历: 返回 [{mesh, matrix, worldPos}] (矩阵 = 父链旋转 × 自身缩放前的朝向)
function gather(root){
const out=[];
const rec=(o,P,pos)=>{
const R=mul(P,rotM(o.rotation));
const p=[pos[0]+o.position.x,pos[1]+o.position.y,pos[2]+o.position.z];
if(o.isMesh&&o.geometry) out.push({o,R,p,s:o.scale});
for(const c of o.children) rec(c,R,p);
};
rec(root,I3,[0,0,0]);
return out;
}
function measure(root){
const ms=gather(root);
let mn=[1e9,1e9,1e9], mx=[-1e9,-1e9,-1e9];
const mats=new Map(), parts=new Map(), tags=new Map(), per=[];
for(const m of ms){
const g=m.o.geometry, mk2=matKey(m.o.material);
mats.set(mk2,(mats.get(mk2)||0)+1);
const tag=(m.o.wkPart)||(m.o.userData&&m.o.userData.wkPart)||'?';
parts.set(tag,(parts.get(tag)||0)+1);
const bt=(m.o.wkBand)||(m.o.userData&&m.o.userData.wkBand); if(bt) tags.set(bt,m);
// 几何自身旋转 (translate/rotateX/Y/Z) 先作用到采样点
let P=I3;
for(const [ax,ang] of (g.rots||[])) P=mul(P,rotM(ax==='x'?{x:ang,order:'XYZ'}:ax==='y'?{y:ang,order:'XYZ'}:{z:ang,order:'XYZ'}));
const o2=g.offs||[0,0,0];
const RM=mul(m.R,P);
const sc=m.s;
const bmn=[1e9,1e9,1e9], bmx=[-1e9,-1e9,-1e9];
for(let q of geoPoints(g)){
q=[(q[0]+o2[0])*sc.x,(q[1]+o2[1])*sc.y,(q[2]+o2[2])*sc.z];
const wx=m.p[0]+RM[0]*q[0]+RM[1]*q[1]+RM[2]*q[2];
const wy=m.p[1]+RM[3]*q[0]+RM[4]*q[1]+RM[5]*q[2];
const wz=m.p[2]+RM[6]*q[0]+RM[7]*q[1]+RM[8]*q[2];
if(wx<mn[0])mn[0]=wx; if(wy<mn[1])mn[1]=wy; if(wz<mn[2])mn[2]=wz;
if(wx>mx[0])mx[0]=wx; if(wy>mx[1])mx[1]=wy; if(wz>mx[2])mx[2]=wz;
if(wx<bmn[0])bmn[0]=wx; if(wy<bmn[1])bmn[1]=wy; if(wz<bmn[2])bmn[2]=wz;
if(wx>bmx[0])bmx[0]=wx; if(wy>bmx[1])bmx[1]=wy; if(wz>bmx[2])bmx[2]=wz;
}
per.push({tag,mk:mk2,minX:bmn[0],maxX:bmx[0],minY:bmn[1],maxY:bmx[1],minZ:bmn[2],maxZ:bmx[2]});
}
return {n:ms.length, mats, parts, bands:tags, per,
W:mx[0]-mn[0], H:mx[1]-mn[1], L:mx[2]-mn[2], min:mn, max:mx,
minY:mn[1], maxY:mx[1]};
}
// 取"最后加入 world 的网格"的根组 (三件函数都是先 new Group 再加 world)
function lastRoot(ctx){
const kids=vm.runInContext('world.children',ctx);
return kids[kids.length-1];
}

// ══════════════ ④ 模型层沙箱 (00-config + 05-world + 05a + 05b, 平地面, 无占位表) ══════════════
// 平地面 heightAt()=0 + 空 PROPS/B_FOOT ⇒ 量测只反映模型本身, 与战役地形解耦 (前后对照才可比)。
// 战役取塔拉瓦 (index 11): 唯一有 SEA (landingCraft 水线分带要用 SEA.level) 的战役。
function buildModels(withTex){
const VL=loadFingerprintAPI();
const THREE=makeMeasuredTHREE();
const mkTex=()=>({ wrapS:0,wrapT:0,needsUpdate:false,repeat:{x:1,y:1,set(x,y){this.x=x;this.y=y;}},
offset:{x:0,y:0},anisotropy:1,colorSpace:0,clone(){ return mkTex(); },dispose(){} });
const mkCanvas=()=>({ width:64,height:64,getContext:()=>new Proxy({},{ get(t,k){ return (k in t)?t[k]:()=>{}; }, set(t,k,v){ t[k]=v; return true; } }) });
const sandbox={
console,Math,JSON,Date,THREE,require,
location:{search:'?seed=42'},
localStorage:{ _s:{sf_campaign:'11'}, getItem(k){ return this._s[k]??null; }, setItem(k,v){ this._s[k]=String(v); }, removeItem(k){ delete this._s[k]; } },
navigator:{maxTouchPoints:0,userAgent:'node'},
document:{ createElement:t=>t==='canvas'?mkCanvas():{style:{},addEventListener(){},appendChild(){},setAttribute(){},innerHTML:'',textContent:''},
createElementNS:()=>mkCanvas(),getElementById:()=>({style:{},addEventListener(){},innerHTML:'',textContent:'',appendChild(){}}),
querySelector:()=>({style:{},addEventListener(){}}),querySelectorAll:()=>[],body:{appendChild(){},style:{}},head:{appendChild(){}} },
window:{addEventListener(){},removeEventListener(){},innerWidth:1280,innerHeight:720},
performance:{now:()=>Date.now()},requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},
setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{},
TAU:Math.PI*2,HPI:Math.PI/2,
seed:42,
};
sandbox.globalThis=sandbox; sandbox.window.document=sandbox.document;
const ctx=vm.createContext(sandbox);
const run=src=>vm.runInContext(src,ctx,{filename:'<inline>'});
const load=f=>vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
// 世界框架桩: scene / MAT / TEX / 碰撞表 / 地形 (平地面)
sandbox.scene=new THREE.Group();
sandbox.MAT={stone:{},wood:{},woodDark:{},roof:{},plaster:{},brick:{},sandbag:{},hay:{},metal:{},metalDark:{},bark:{},leaves:{},rubble:{}};
sandbox.TEX={leaves:mkTex(),grime:mkTex(),metalBrush:mkTex(),cloth:mkTex(),track:mkTex()};
if(withTex) // TEX 就位模拟: naval-model 在 02-scene 追加的 6 张程序化贴图 —— 验证"贴图落地即自动生效, 零代码改动"
for(const k of ['rust','paintPeel','scorch','waterline','barnacle','deckWood']){ const t=mkTex(); t._wkName=k; sandbox.TEX[k]=t; }
sandbox.svgApply=t=>t; sandbox.addSnowCap=()=>{}; sandbox.makeTex=()=>mkTex();
sandbox.wires=[]; sandbox.OCC={res:1,N:0,off:180,data:null}; sandbox.TRENCHES=[];
sandbox.BOXES=[]; sandbox.CYLS=[]; sandbox.PROPS=[]; sandbox.B_FOOT=[]; sandbox.NAV_CLEARS=[];
sandbox.BUILD_REG=[]; sandbox.AMMO_CRATES=[]; sandbox.TREE_LIVE=[]; sandbox.DEPOTS=[]; sandbox.RURAL_HEDGES=[];
sandbox.DESTRUCTIBLES=[]; sandbox.STAIRS=[]; sandbox.FLAGS=[]; sandbox.BASES=[];
sandbox.addBoxCollider=(cx,cy,cz,w,h,d)=>{ const b={minX:cx-w/2,minY:cy-h/2,minZ:cz-d/2,maxX:cx+w/2,maxY:cy+h/2,maxZ:cz+d/2,gh:0,dead:false}; sandbox.BOXES.push(b); return b; };
sandbox.RIVER=null; sandbox.BRIDGE=null; sandbox.BRIDGES=[]; sandbox.GAMEMODE='conquest';
sandbox.camera={position:{x:0,y:0,z:0}}; sandbox.player={alive:true,pos:{x:0,z:0}};
sandbox.AudioSys={explosion(){},createEngine:()=>({update(){}})}; sandbox.addTrauma=()=>{}; sandbox.spawnP=()=>{}; sandbox.PT={};
sandbox.spawnWallDebris=()=>{}; sandbox.rand=(a,b)=>a+Math.random()*(b-a); sandbox.clamp=(v,a,b)=>v<a?a:(v>b?b:v);
sandbox.heightAt=()=>0; sandbox.roadDist=()=>1e9; sandbox.streetDist=()=>1e9; sandbox.cityUrban=()=>false;
sandbox.inRiverChannel=()=>false; sandbox.inShallowChannel=()=>false; sandbox.onBridge=()=>false; sandbox.fordAt=()=>0;
sandbox.METRO_RECTS=[]; sandbox.RURAL_FIELDS=[]; sandbox.fieldAt=()=>null;
sandbox.UV_DENSITY={}; sandbox.CROP_FIELDS=[];
load('js/00-config.js');
sandbox.SEA=run('CAMPAIGN.sea||null');
sandbox.TEAM_FACTION=run('TEAM_FACTION'); sandbox.TEAM_COL=run('TEAM_COL'); sandbox.FACTIONS=run('FACTIONS');
load('js/05-world.js');
load('js/05a-buildings.js');
load('js/05b-props.js');
return {ctx,THREE,run,load,sandbox};
}

// ══════════════ ⑤ 三件模型量测 ══════════════
// 包络外只许放"半埋扁平碎件"(顶面 ≤flat) —— 立体件伸出碰撞盒 ⇒ 玩家能从它里穿过去 (硬掩体口径破防)。
const FLAT_TAGS=['wheelThrown','trackGround','ashMound','hatchLost','skirtFallen','barrelFallen','ramp','rampSand',
'gearWheel','debrisBlade','debrisPlate'];
// 包络: 与三个 addBoxCollider 的半尺寸一致 (ry=0 时的 XZ)
// landingCraft ① hx=1.72 而非盒半宽 1.65: 舷顶缘纵梁/护舷本来就在盒外沿 4~7cm (改造前实测 W=3.40 > 盒宽 3.3, 属既有口径);
//   ② hz=8.25 而非盒半长 5.20: 硬掩体盒 10.4 只覆盖艇体, **放落的跳板与绞盘缆**必然落在盒外沙上
//   (改造前既有口径: 旧跳板 z=-6.6/顶面高 0.75m, 旧缆 z=-6.4; 新版同位置但顶面 0.39m、缆更细 ⇒ 严格优于改造前)。
//   ⇒ 本项以"不得比改造前更宽/更高"为准, 判据是"立体件不得越出盒外且高于 flat"。
const ENVELOPE={tankWreck:{hx:1.50,hz:2.80,flat:0.30},planeWreck:{hx:3.75,hz:3.20,flat:0.30},landingCraft:{hx:1.72,hz:8.25,flat:0.45}};
function envelopeViolations(mm,env){
const bad=[], buried=[];
for(const p of mm.per){
const outside=Math.max(-p.minX,p.maxX)>env.hx+0.02||Math.max(-p.minZ,p.maxZ)>env.hz+0.02;
if(!outside) continue;
if(p.maxY<=0.02){ buried.push(p); continue; }               // 整件已入土 ⇒ 玩家踩在沙上, 走不过去也看不见
if(FLAT_TAGS.includes(p.tag)&&p.maxY<=env.flat) continue;   // 半埋扁平碎件: 允许 (可踏过)
bad.push(p);
}
return bad;
}
// 核心包围盒 (剔除半埋碎件): 六车型"两两可辨"看的是车体/炮塔/炮管的剪影, 不是散落碎件的外沿
const CORE_EXCLUDE=['wheelThrown','trackGround','ashMound','hatchLost','skirtFallen','barrelFallen','ramp','rampSand'];
function coreBox(mm){
let mn=[1e9,1e9,1e9], mx=[-1e9,-1e9,-1e9];
for(const p of mm.per){
if(CORE_EXCLUDE.includes(p.tag)) continue;
mn[0]=Math.min(mn[0],p.minX); mx[0]=Math.max(mx[0],p.maxX);
mn[1]=Math.min(mn[1],p.minY); mx[1]=Math.max(mx[1],p.maxY);
mn[2]=Math.min(mn[2],p.minZ); mx[2]=Math.max(mx[2],p.maxZ);
}
return {W:mx[0]-mn[0], H:mx[1]-mn[1], L:mx[2]-mn[2]};
}
function measureOne(M,call){
const ctx=M.ctx;
// 逐件独立量测: 清空占位表 (三件都必须能被放在同一点上, 否则第二件会被 propFree 正当地拒绝)
vm.runInContext('PROPS.length=0; B_FOOT.length=0;',ctx);
const before=vm.runInContext('world.children.length',ctx);
const beforeBoxes=vm.runInContext('BOXES.length',ctx);
const beforeProps=vm.runInContext('PROPS.length',ctx);
vm.runInContext(call,ctx);
const after=vm.runInContext('world.children.length',ctx);
if(after===before) return null; // 被 propFree/freeSpot 拒绝
const root=lastRoot(ctx);
const mm=measure(root);
mm.boxesAdded=vm.runInContext('BOXES.length',ctx)-beforeBoxes;
mm.propsAdded=vm.runInContext('PROPS.length',ctx)-beforeProps;
return mm;
}
function fmt(n,d=2){ return Number(n).toFixed(d); }

function runModels(){
let M;
try{ M=buildModels(); }catch(e){ console.log('  ✗ 模型沙箱加载失败: '+e.message); return {fail:1}; }
const ctx=M.ctx;
const Q=s=>vm.runInContext(s,ctx);
const F=Q('FACTIONS');
const rows=[];
let fail=0;
// ── 三件: 改造后量测 (缺省车型/机型兜底) ──
const cases=[
{name:'tankWreck', call:'tankWreck(0,0,0)'},
{name:'planeWreck', call:'planeWreck(0,0,0)'},
{name:'landingCraft', call:'landingCraft(0,0,0)'},
];
if(process.argv.includes('--dump')){
const want=(process.argv[process.argv.indexOf('--dump')+1]||'tankWreck');
const call=(cases.find(c=>c.name===want)||cases[0]).call;
const mm=measureOne(M,call);
console.log(`\n[DUMP ${want}] HPI=${Q('HPI')} TAU=${Q('TAU')} SEA=${JSON.stringify(Q('typeof SEA!==\"undefined\"&&SEA?SEA.level:null'))}`);
for(const p of [...mm.per].sort((a,b)=>a.tag<b.tag?-1:1))
console.log(`  ${p.tag.padEnd(16)} x ${fmt(p.minX,2)}..${fmt(p.maxX,2)}  y ${fmt(p.minY,2)}..${fmt(p.maxY,2)}  z ${fmt(p.minZ,2)}..${fmt(p.maxZ,2)}  ${p.mk}`);
return {fail:0};
}
console.log('\n── ① 三件模型量测 (平地面 ry=0, 包围盒 = 长L/D 宽W 高H) ──');
for(const c of cases){
let mm=null,err='';
try{ mm=measureOne(M,c.call); }catch(e){ err=e.message; }
if(err){ console.log(`  ✗ ${c.name}: 构建抛错 ${err}`); fail++; continue; }
if(!mm){ console.log(`  ✗ ${c.name}: 未放置 (占位被拒)`); fail++; continue; }
rows.push({name:c.name,mm});
const b=BASELINE.models[c.name];
const cmp=b?`  改造前 L${fmt(b.L,2)} W${fmt(b.W,2)} H${fmt(b.H,2)} | 网格${b.n} | 材质${Object.keys(b.mats).length}`:'  (无改造前基线)';
console.log(`  ${c.name.padEnd(13)} L=${fmt(mm.L)} W=${fmt(mm.W)} H=${fmt(mm.H)}  网格=${mm.n}  材质分件=${mm.mats.size}  碰撞盒+${mm.boxesAdded} prop+${mm.propsAdded}`);
console.log(`    构造分件: ${[...mm.parts.entries()].map(([k,v])=>k+'×'+v).join(' ')}`);
console.log(`    材质分件: ${[...mm.mats.entries()].map(([k,v])=>k+'×'+v).join(' ')}`);
// 硬掩体包络体检: 立体件伸出碰撞盒 ⇒ 玩家能穿模
const env=ENVELOPE[c.name], bad=envelopeViolations(mm,env);
if(bad.length){ console.log(`    ✗ 包络越界 (立体件伸出碰撞盒 ⇒ 玩家可从它里穿过): ${bad.slice(0,8).map(p=>`${p.tag}(x${fmt(p.maxX,1)}..${fmt(p.minX,1)} z${fmt(p.maxZ,1)} y底${fmt(p.minY,2)}..顶${fmt(p.maxY,2)})`).join(' ')}`); fail++; }
else console.log(`    ✔ 包络体检: 立体件全在 ±${env.hx}/${env.hz} 内, 盒外仅半埋碎件 (顶面≤${env.flat})`);
const tall=[...mm.per].sort((a,b)=>b.maxY-a.maxY).slice(0,4);
console.log(`    最高 4 件: ${tall.map(p=>`${p.tag}@${fmt(p.maxY,2)}m`).join(' ')}`);
console.log(`    对照:${cmp}`);
}
// ── 6 车型签名 ──
console.log('\n── ② 六车型坦克残骸两两可辨 (签名 = 包围盒 + 网格 + 材质色集) ──');
const kinds=[['us',0],['ger',0],['sov',0],['jp',0],['kmt',0],['cpc',0]];
const sigs=[];
for(const [f,v] of kinds){
const def=F[f].tanks[v];
const call=`tankWreck(0,0,0,FACTIONS['${f}'].tanks[${v}])`;
const mm=measureOne(M,call);
if(!mm){ console.log(`  ✗ ${def.name} 构建失败`); fail++; continue; }
const cb=coreBox(mm);
const colors=[...mm.mats.keys()].map(k=>k.split('+')[0]);
sigs.push({key:`${f}:${v}`,name:def.name,shape:def.tk.shape,tur:def.tk.tur.shape,
v:[cb.L,cb.W,cb.H,mm.n,mm.mats.size,new Set(colors).size],
colors,mm,cb});
const envb=envelopeViolations(mm,ENVELOPE.tankWreck);
if(envb.length){ console.log(`  ✗ ${def.name}: 包络越界 ${envb.map(p=>p.tag).join(',')}`); fail++; }
console.log(`  ${def.name.padEnd(12)} ${(def.tk.shape+'/'+def.tk.tur.shape).padEnd(18)} 核心 L=${fmt(cb.L)} W=${fmt(cb.W)} H=${fmt(cb.H)} 网格=${mm.n} 材质=${mm.mats.size} 色=${new Set(colors).size}`);
}
// 两两间距: 数值向量分量相对差均值 + 色集差异
let worst=null;
for(let i=0;i<sigs.length;i++)for(let j=i+1;j<sigs.length;j++){
const a=sigs[i],b=sigs[j];
let acc=0;
for(let k=0;k<6;k++){ const hi=Math.max(Math.abs(a.v[k]),Math.abs(b.v[k]))||1; acc+=Math.abs(a.v[k]-b.v[k])/hi; }
const num=acc/6*100;
const sa=new Set(a.colors), sb=new Set(b.colors);
let inter=0; for(const x of sa) if(sb.has(x)) inter++;
const jac=1-inter/(sa.size+sb.size-inter||1);
const d=Math.max(num,jac*100);
if(!worst||d<worst.d) worst={d,a:a.name,b:b.name,num,jac:jac*100};
}
console.log(`  两两最小间距: ${worst?fmt(worst.d,1)+'%  ('+worst.a+' ↔ '+worst.b+': 几何 '+fmt(worst.num,1)+'% / 色集 '+fmt(worst.jac,1)+'%)':'n/a'}`);
if(!worst||worst.d<3){ console.log(`  ✗ 最小间距 <3% —— 两两可辨不成立`); fail++; }
else console.log(`  ✔ 两两可辨 (最小间距 ${fmt(worst.d,1)}% ≥3%)`);
// ── 水线分带 ──
console.log('\n── ③ 登陆艇三层水线分带 × SEA.level ──');
const sea=Q('SEA'); const seaLv=sea?sea.level:0;
console.log(`  SEA.level=${seaLv}`);
// 直接量测落地件的分带 (tank/plane 无分带)
const lc=rows.find(r=>r.name==='landingCraft');
if(!lc||!lc.mm.bands.size){ console.log('  ✗ landingCraft 未打 wkBand 标记 (无法量水线)'); fail++; }
else for(const [tag,m] of lc.mm.bands){
const y=measureBandY(m);
console.log(`  ${tag.padEnd(9)} 世界高 y=${fmt(y)}  Δ(相对 SEA.level)=${fmt(y-seaLv,2)}m  ${y>seaLv?'[水上]':'[水下]'}`);
}
// ③b 真实滩头三条艇 (塔拉瓦实际调用点, 05c-layouts:1593-1595): 用 verify-layouts 的地形复刻现算 fit.y,
//    再核对分带世界高 —— 平地面只验逻辑, 这一节验的是"实机上三条艇的水线各自落在正确一侧"。
{
const VL=loadFingerprintAPI();
const r11=VL.runCampaign(11,VL.seed);   // island = 塔拉瓦
const terr=VL.makeTerrain(r11.CAMP);
const seaLv=(r11.CAMP.sea&&r11.CAMP.sea.level!==undefined)?r11.CAMP.sea.level:0;
const S=(x,d)=>[x,terr.shoreZAt(x)+d];
const sites=[[...S(-58,-2),0.10],[...S(64,-3),-0.16],[...S(8,2.5),0.04]];
let wlFail=0;
for(let i=0;i<sites.length;i++){
const [x,z,ry]=sites[i];
const cs=Math.cos(ry), sn=Math.sin(ry);
const hx0=terr.heightAt(x-cs*5.4,z+sn*5.4), hx1=terr.heightAt(x+cs*5.4,z-sn*5.4);
const hz0=terr.heightAt(x-sn*1.7,z-cs*1.7), hz1=terr.heightAt(x+sn*1.7,z+cs*1.7);
const fy=(hx0+hx1+hz0+hz1)/4;
const pitch=-Math.atan2(hz1-hz0,2*1.7), roll=Math.atan2(hx1-hx0,2*5.4);
const k=Math.cos(pitch)*Math.cos(roll);              // YXZ 序下局部 (0,y,0) 的世界高系数
const yWL=clamp(seaLv-fy,-0.20,1.28);
const hB=clamp(1.48-(yWL+0.11),0.12,0.60), hN=clamp((yWL-0.11)+0.34,0.12,0.70);
const yBleach=fy+(yWL+0.11+hB/2)*k, yRust=fy+yWL*k, yBarn=fy+(yWL-0.11-hN/2)*k;
const okBleach=yBleach>seaLv, okBarn=yBarn<seaLv, okRust=Math.abs(yRust-seaLv)<0.06;
if(!(okBleach&&okBarn&&okRust)) wlFail++;
console.log(`  艇#${i+1}(${x.toFixed(0)},${z.toFixed(0)}) 岸距${(z-terr.shoreZAt(x)).toFixed(1)}m fit.y=${fy.toFixed(2)} yWL=${yWL.toFixed(2)} → 晒褪${yBleach.toFixed(2)}${okBleach?'↑':'✗'} 锈带${yRust.toFixed(2)}${okRust?'≈':'✗'} 藤壶${yBarn.toFixed(2)}${okBarn?'↓':'✗'}  (SEA.level=${seaLv})`);
}
if(wlFail){ console.log(`  ✗ 有 ${wlFail} 条艇的水线分带落在错误一侧`); fail++; }
else console.log(`  ✔ 三条实机艇: 晒褪带均在水上、锈带跨 SEA.level、藤壶带均在水下`);
}
// ③c TEX 就位模拟: 把 naval-model 将要追加的 6 张贴图注入沙箱, 验证材质自动改绑、无需改一行代码
//     (没有这 6 张图时按 role 退回 TEX.grime/metalBrush, 模型照样完整可看)
{
let MT=null;
try{ MT=buildModels(true); }catch(e){ console.log(`  (TEX 模拟沙箱构建失败: ${e.message})`); }
if(MT){
const want=['rust','paintPeel','scorch','waterline','barnacle','deckWood'];
const used=new Set();
for(const c of [{n:'tankWreck',call:'tankWreck(0,0,0)'},{n:'planeWreck',call:'planeWreck(0,0,0)'},{n:'landingCraft',call:'landingCraft(0,0,0)'}]){
const mm=measureOne(MT,c.call);
if(!mm){ console.log(`  ✗ TEX 模拟: ${c.n} 未构建`); fail++; continue; }
const texs=new Set();
for(const k of mm.mats.keys()){ const parts=k.split('+')[1].split('@')[0]; if(want.includes(parts)){ texs.add(parts); used.add(parts); } }
console.log(`  ${c.n.padEnd(13)} 绑定新贴图: ${[...texs].sort().join(' ')}`);
}
const miss=want.filter(w=>!used.has(w));
if(miss.length){ console.log(`  ✗ TEX 模拟: 有 ${miss.length} 张贴图未被任何残骸材质消费 (${miss.join(',')}) ⇒ 程序化贴图白做`); fail++; }
else console.log(`  ✔ TEX 就位模拟: 6 张新贴图全部被三件残骸材质消费, 贴图落地即生效 (无需改残骸代码)`);
}
}
return {fail};
}
// 单条分带的世界高 (带中心: 几何参数高度 ± 矩阵) —— 分带是盒/薄板, 取 AABB 中心
function measureBandY(m){
const RM=m.R, sc=m.s, g=m.o.geometry;
const hh=(g.type==='BoxGeometry')?(g.args[1]||0)/2*sc.y:0;
const o2=g.offs||[0,0,0];
const y0=m.p[1]+RM[3]*o2[0]+RM[4]*(o2[1]-hh)+RM[5]*o2[2];
const y1=m.p[1]+RM[3]*o2[0]+RM[4]*(o2[1]+hh)+RM[5]*o2[2];
return (y0+y1)/2;
}

// ══════════════ ⑥ 源码级红线断言 (取数次数 + 碰撞口径) ══════════════
function extractFn(src,name){
const i=src.indexOf('function '+name+'(');
if(i<0) return null;
let d=0,j=src.indexOf('{',i);
for(let k=j;k<src.length;k++){
if(src[k]==='{') d++;
else if(src[k]==='}'){ d--; if(!d) return src.slice(i,k+1); }
}
return null;
}
function countIn(body,pat){ const m=body.match(pat); return m?m.length:0; }
function runStatic(){
console.log('\n── ④ 源码级红线 (全局取数次数 / 碰撞口径) ──');
let fail=0;
const S5b=fs.readFileSync(path.join(root,'js/05b-props.js'),'utf8');
const S5a=fs.readFileSync(path.join(root,'js/05a-buildings.js'),'utf8');
for(const [name,src] of [['tankWreck',S5b],['landingCraft',S5b],['planeWreck',S5a]]){
const body=extractFn(src,name);
if(!body){ console.log(`  ✗ ${name}: 未找到函数体`); fail++; continue; }
const rng=countIn(body,/\b(wr|wri|wRand)\s*\(/g);
const calls={};
for(const k of ['addBoxCollider','propTake','propFree','freeSpot']) calls[k]=countIn(body,new RegExp('\\b'+k+'\\s*\\(','g'));
calls.coverPoints=countIn(body,/coverPoints\.push\s*\(/g);
const bad=[];
if(rng!==RNG_REDLINE[name]) bad.push(`全局取数 ${rng}≠${RNG_REDLINE[name]}`);
for(const k in CALL_REDLINE[name]) if(calls[k]!==CALL_REDLINE[name][k]) bad.push(`${k} ${calls[k]}≠${CALL_REDLINE[name][k]}`);
for(const k of ['solidBox','CYLS','BOXES','NAV_CLEARS']){
if(new RegExp('\\b'+k+'\\s*[.(]').test(body)) bad.push(`出现 ${k} (会改布局指纹)`);
}
if(bad.length){ console.log(`  ✗ ${name}: ${bad.join(' / ')}`); fail++; }
else console.log(`  ✔ ${name}: 全局取数=${rng} addBoxCollider=${calls.addBoxCollider} propTake=${calls.propTake} propFree=${calls.propFree} freeSpot=${calls.freeSpot} coverPoints=${calls.coverPoints} 无 solidBox/CYLS/BOXES`);
}
// ⑨ 波场单源接线 (Lead 追加项): 浮标必须与水面载具共读 00-config 的 seaWaveOffset (位置相位),
//    且 buoy() 里那次 wr(0,TAU) **必须保留** —— 删它会打漂 _wstate, 12 图布局指纹整体漂移。
{
const buoyBody=extractFn(S5b,'buoy'), upBody=extractFn(S5b,'updateBuoys');
const bad=[];
if(!buoyBody||!/\bwr\s*\(\s*0\s*,\s*TAU\s*\)/.test(buoyBody)) bad.push('buoy() 丢失保留取数 wr(0,TAU)');
if(!upBody||!/seaWaveOffset\s*\(/.test(upBody)) bad.push('updateBuoys 未走 seaWaveOffset (浪场单源断链)');
if(upBody&&/Math\.sin\(\s*nowT\s*\*\s*1\.3/.test(upBody)) bad.push('updateBuoys 仍留着旧的第二条 sin() 浪');
if(bad.length){ console.log(`  ✗ 波场接线: ${bad.join(' / ')}`); fail++; }
else console.log(`  ✔ 波场单源: updateBuoys → seaWaveOffset(位置相位) ; buoy 的 wr(0,TAU) 保留取数未动`);
}
return fail;
}

// ══════════════ ⑦ 布局指纹零漂移 ══════════════
function runFp(){
console.log('\n── ⑤ 13 图布局指纹零漂移 (与改造前基线逐字节对比) ──');
const VL=loadFingerprintAPI();
const rows=fingerprints(VL);
let fail=0;
// 源文件归因 (队友并发改 05c/00-config 时, 别把漂移算到残骸头上)
const changed=TRACK_FILES.filter(f=>BASELINE.files[f]&&BASELINE.files[f]!==shaFile(f));
if(BASELINE.files['js/05b-props.js']) console.log(`  捕获后发生变化的源文件: ${changed.length?changed.join(', '):'(无)'}`);
for(const r of rows){
const b=BASELINE.fp[r.id];
const ok=b&&b.fpSha===r.fpSha;
if(!b) fail++;
else if(!ok) fail++;
console.log(`  ${r.id.padEnd(11)} fp=${String(r.fpLen).padStart(7)} sha=${r.fpSha} ${b?(ok?'✔ 与基线一致':'✗ 漂移! 基线 '+(b.fpLen+'/'+b.fpSha)):'(无基线)'}  ${r.counts}`);
console.log(`              残骸 tank×${r.wk.n.tank}(网格${r.wk.o.tank}) plane×${r.wk.n.plane}(网格${r.wk.o.plane}) 艇×${r.wk.n.landingCraft}(网格${r.wk.o.landingCraft}) ⇒ 视觉网格 ${r.addMeshes>=0?'+':''}${r.addMeshes} vs 改造前, world 总网格 ${r.wk.world}`);
}
if(CAP) return rows;
if(fail) console.log(`  ✗ 布局指纹: ${fail} 图不一致`);
else console.log(`  ✔ 布局指纹: ${rows.length} 图逐字节一致`);
return rows;
}

// ══════════════ 主流程 ══════════════
console.log('══ 残骸三件自检 (dev/_wreck-selfcheck.js) ══');
if(CAP){
const VL=loadFingerprintAPI();
const rows=fingerprints(VL);
const files={}; for(const f of TRACK_FILES) files[f]=shaFile(f);
let models={};
try{
const M=buildModels();
for(const c of [{name:'tankWreck',call:'tankWreck(0,0,0)'},{name:'planeWreck',call:'planeWreck(0,0,0)'},{name:'landingCraft',call:'landingCraft(0,0,0)'}]){
const mm=measureOne(M,c.call);
if(mm) models[c.name]={L:mm.L,W:mm.W,H:mm.H,n:mm.n,mats:Object.fromEntries(mm.mats),parts:Object.fromEntries(mm.parts),boxesAdded:mm.boxesAdded,propsAdded:mm.propsAdded};
}
}catch(e){ console.log('  (模型量测失败: '+e.message+')'); }
const fp={}; for(const r of rows) fp[r.id]={fpLen:r.fpLen,fpSha:r.fpSha};
console.log('\n// ── 把下面这段粘进 BASELINE ──');
console.log('const BASELINE='+JSON.stringify({captured:new Date().toISOString().slice(0,16),files,fp,models},null,0)+';');
process.exit(0);
}
let fail=0;
if(!ONLY_FP){ fail+=runModels().fail; fail+=runStatic(); }
if(!ONLY_MODELS) runFp();
console.log(fail? `\n✗ 自检未通过 (${fail} 项)` : '\n✔ 自检全部通过');
process.exit(fail?1:0);
