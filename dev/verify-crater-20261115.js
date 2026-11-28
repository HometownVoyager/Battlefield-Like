// ─────────────────────────────────────────────
// dev/verify-crater-20261115.js —— 自适应弹坑批 (2026-11-15, 二轮修"只露黑弧")
// 用法: node dev/verify-crater-20261115.js [--neg]
// 病根 (用户实报"炸了之后没有在地表显示, 只露出几个弧形的黑色"):
//   ① 旧顶点采 heightAt, 而渲染地形是 terrainRenderY 在节点格上的线性三角化弦面 —— 曲率段
//      (地基裙摆 ramp/壕沟/道路下切) 弦面比解析值高 0.3~1.2m ⇒ 弹坑整片沉在渲染面之下,
//      深度测试把坑体全吃掉, 只有抬升的唇缘露出来 = 黑弧。
//   ② 一轮修的索引绕向 (a,b,a+1) 法线朝下 —— 从上看全被背面剔除。
// 修: 03-terrain 新增 terrainSurfaceY 单源 (与 TERRAIN_CHUNKS 同格同对角的弦面高度) + 05b 顶点
//   改采 terrainSurfaceY + 绕向翻正 (a,a+1,b)/(a+1,b+1,b)。
// 判据:
//   T1 几何契约: BufferGeometry 125 顶点 (5 环×25)/索引 576/mesh y=0 恒等旋转/贴花档材质
//      (polygonOffset -6/renderOrder 2/不写深度)/法线全朝上。
//   T2 ★贴地不变式: 每个顶点世界高度 ≥ terrainSurfaceY(顶点 x,z)+0.04 —— 任何位置弹坑都不会
//      沉进渲染面之下 (黑弧病根的数学反演)。
//   T3 terrainSurfaceY 单元: 格点处与 terrainRenderY 严格相等; 格内点落在四角包络内。
//   T4 36 上限 shift 账 + 源码锚 (绕向/采样行/无 Torus rim/explosionFX 调用点 verbatim)。
//   --neg: N1 绕向翻回朝下 (T1e 红) / N2 抬升摘除 (T2 红) / N3 shift 账摘除 (T4a 红)。
// 沙箱要点: 桩 Geo.setIndex/computeVertexNormals 是空转 —— 本探针照 Group.clear 先例补真实现
//   (真算叉积法线), 否则绕向/法线判据测不了。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const stub=require('./_bootstub.js');
require('./_bootpatch.js').patch(stub.sandbox);
{const P=Object.getPrototypeOf(stub.THREE.Group.prototype); if(!P.clear) P.clear=function(){ this.children.length=0; };}
// ── 桩补真: setIndex 存索引 / computeVertexNormals 真算 (面法线叉积累加+归一) ──
{const GP=stub.THREE.BufferGeometry.prototype;
GP.setIndex=function(ix){ this.index=ix; return this; };
GP.computeVertexNormals=function(){
const pos=this.attributes.position, idx=this.index&&this.index.length?this.index:null;
const n=new Float32Array(pos.array.length);
if(pos&&pos.array){
const A=pos.array;
const tri=(i0,i1,i2)=>{
const ax=A[i0*3],ay=A[i0*3+1],az=A[i0*3+2],bx=A[i1*3],by=A[i1*3+1],bz=A[i1*3+2],cx=A[i2*3],cy=A[i2*3+1],cz=A[i2*3+2];
const nx=(by-ay)*(cz-az)-(bz-az)*(cy-ay), ny=(bz-az)*(cx-ax)-(bx-ax)*(cz-az), nz=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
n[i0*3]+=nx;n[i0*3+1]+=ny;n[i0*3+2]+=nz;n[i1*3]+=nx;n[i1*3+1]+=ny;n[i1*3+2]+=nz;n[i2*3]+=nx;n[i2*3+1]+=ny;n[i2*3+2]+=nz;
};
if(idx){ for(let k=0;k<idx.length;k+=3) tri(idx[k],idx[k+1],idx[k+2]); }
else { const vn=A.length/3; for(let k=0;k+2<vn;k+=3) tri(k,k+1,k+2); }
for(let k=0;k<n.length;k+=3){
const l=Math.hypot(n[k],n[k+1],n[k+2])||1; n[k]/=l;n[k+1]/=l;n[k+2]/=l;
}
}
this.attributes.normal={array:n,itemSize:3,count:n.length};
return this;
};}
const _ensureStyle=e=>{ if(e&&e.style&&!e.style.setProperty) e.style.setProperty=(k,v)=>{ e.style[k]=v; }; return e; };
{const doc=stub.document,og=doc.getElementById.bind(doc),oc=doc.createElement.bind(doc);
doc.getElementById=id=>_ensureStyle(og(id));
doc.createElement=t=>_ensureStyle(oc(t));}
const CANNON=(()=>{
const V3=stub.THREE.Vector3;
class Quat{constructor(){this.x=0;this.y=0;this.z=0;this.w=1;}set(){return this;}setFromEuler(){return this;}copy(){return this;}}
return {
Vec3:V3,Quaternion:Quat,
World:class{constructor(){this.gravity=new V3();this.broadphase=null;this.solver={iterations:0};this.bodies=[];}addBody(b){this.bodies.push(b);}removeBody(b){const i=this.bodies.indexOf(b);if(i>=0)this.bodies.splice(i,1);}add(b){this.addBody(b);}remove(b){this.removeBody(b);}addConstraint(){}removeConstraint(){}step(){}},
Body:class{constructor(o){Object.assign(this,o||{});this.shapes=[];this.position=new V3();this.velocity=new V3();this.angularVelocity=new V3();this.quaternion=new Quat();this.angularDamping=0;this.linearDamping=0;}addShape(s){this.shapes.push(s);}},
Box:class{},Sphere:class{},Material:class{},ContactMaterial:class{},NaiveBroadphase:class{},PointToPointConstraint:class{},
};})();

const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const FILES=[...html.matchAll(/src="(js\/[^"?]+)/g)].map(m=>m[1]);
console.log('载入清单: 解析 index.html 得 '+FILES.length+' 个脚本');

// ── NEG 阴性对照: 三补丁累积注入 (正常跑不启用) ──
const NEG=process.argv.includes('--neg');
const SRC={},PATCH_MAP={};
const NEG_PATCHES=[
// N1 绕向翻回朝下 (一轮修的坏写法): T1e 法线朝下红
['js/05b-props.js','idx.push(a,a+1,b,a+1,b+1,b);','idx.push(a,b,a+1,b,b+1,a+1);'],
// N2 抬升摘除 (顶点贴弦面无余量): T2 不变式红 (★20261121c 跟码: 7fb72eb 弹坑生命周期批把 +0.05 拆成 vr 默认档, 锚跟码)
['js/05b-props.js','let ySup=tY, vr=0.05;','let ySup=tY, vr=0;'],
// N3 36 上限 shift 账摘除: T4a 红 (★20261121c 跟码: shift 行已补逐坑 dispose, NEG 锚跟新行)
['js/05b-props.js','if(runtimeCraters.length>36){ const old=runtimeCraters.shift(); old.geometry.dispose(); old.material.dispose(); world.remove(old); }',';'],
];
if(NEG) for(const [f,from,to] of NEG_PATCHES){
if(SRC[f]===undefined) SRC[f]=fs.readFileSync(path.join(root,f),'utf8');
if(SRC[f].indexOf(from)<0){ console.log('✗ NEG 锚缺失: '+f+' :: '+from); process.exit(1); }
PATCH_MAP[f]=(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC[f]).split(from).join(to);
}
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:fs.readFileSync(path.join(root,f),'utf8'));

function boot(campIdx){
for(const k in stub.byId)delete stub.byId[k];
const ctx=vm.createContext(Object.assign({},stub.sandbox));
ctx.document=stub.document; ctx.window=stub.window; ctx.CANNON=CANNON;
ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of FILES) vm.runInContext(srcOf(f),ctx,{filename:f});
return ctx;
}
const PASS=[];let FAILN=0;
function ok(cond,label){
if(cond){ PASS.push(label); console.log('  ✔ '+label); }
else { FAILN++; console.log('  ✘ '+label); }
}
let IDX=0; { const c0=boot(0); IDX=vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="normandy")',c0); }
const ctx=boot(IDX);
const G=s=>vm.runInContext(s,ctx);
let err0=null;
try{ G("document.getElementById('startBtn').onclick();"); }catch(e){ err0=String(e&&e.stack||e); }
if(!err0){ try{ G('if(!player.alive||!player.deployed) deployPlayer();'); }catch(e){ err0='deployPlayer: '+String(e&&e.stack||e); } }
if(err0||!G('player.alive')){ console.log('  ✘ 开局/部署失败 '+(err0||'player.alive=false')); process.exit(1); }
ok(html.includes("__sfStyleVer='20261128d'"),'前置: 版本戳 20261128d 在位 (index.html 内联)');

// ── 平坦场地 (法线判据需要平地) ──
G("_sp=null; { const R=MAP_SIZE/2-60; for(let z=-R;z<=R&&!_sp;z+=7)for(let x=-R;x<=R;x+=7){ const gh=heightAt(x,z); if(gh<1||gh>40) continue; if(occBlocked(x,z)) continue; let flat=true; for(let dx=-3;dx<=3;dx+=3)for(let dz=-3;dz<=3;dz+=3){ if(Math.abs(heightAt(x+dx,z+dz)-gh)>0.3) flat=false; } if(!flat) continue; _sp={x:x,z:z,gh:gh}; break; } }");
ok(G('!!_sp')===true,'场地: 平坦空地已找到 (gh='+G('_sp?_sp.gh.toFixed(2):"-1"')+'m)');

// ══ T1 几何契约 ══
console.log('T1 几何: 125 顶点/索引 576/恒等旋转/贴花档/法线朝上');
G("runtimeCraters.length=0; crater(_sp.x,_sp.z,1.6,true); _cm=runtimeCraters[runtimeCraters.length-1]; _cg=_cm.geometry; _cp=_cg.attributes.position.array; _cn=_cg.attributes.normal.array;");
ok(G('_cp.length/3')===125,'T1a ★BufferGeometry 125 顶点 (5 环×25, 旧共享圆盘 31 顶点已废) (实得 '+G('_cp.length/3')+')');
ok(G('_cg.index&&_cg.index.length')===576,'T1b 索引 576 (24 段×4 环×6)');
ok(G('_cm.position.y===0&&_cm.rotation.x===0&&_cm.rotation.y===0&&_cm.rotation.z===0')===true,'T1c mesh y=0 恒等旋转 (顶点自带世界高度 —— 旧按法线整体倾斜已废)');
ok(G('_cm.material.polygonOffset===true&&_cm.material.polygonOffsetUnits===-6&&_cm.renderOrder===2')===true,'T1d ★贴花档材质 (decal lane: units -6 + mesh renderOrder 2, verify-surf ② 契约)');
ok(G('_cm.material.depthWrite===false&&_cm.material.transparent===true')===true,'T1d-2 不写深度/透明 (贴花层契约)');
ok(G('(function(){ let m=1, z=0; for(let k=1;k<_cn.length;k+=3){ if(Math.abs(_cn[k])+Math.abs(_cn[k-1])+Math.abs(_cn[k+1])<1e-9){ z++; continue; } if(_cn[k]<m) m=_cn[k]; } _zN=z; return m; })()')>0.7,'T1e ★法线全朝上 (非零法线 min ny>0.7, 实测 '+G('(function(){ let m=1; for(let k=1;k<_cn.length;k+=3){ if(Math.abs(_cn[k])+Math.abs(_cn[k-1])+Math.abs(_cn[k+1])<1e-9) continue; if(_cn[k]<m) m=_cn[k]; } return m; })()').toFixed(3)+' —— 环0 接缝重复中心点是退化三角形, 法线=0 不参与渲染)');
ok(G('_zN')<=1,'T1e-2 零长法线 ≤1 (仅接缝重复中心点)');

// ══ T2 贴地不变式 ══
console.log('T2 贴地不变式: 顶点恒在渲染弦面之上');
G("_minM=1e9; for(let k=0;k<_cp.length;k+=3){ const wx=_sp.x+_cp[k], wz=_sp.z+_cp[k+2], wy=_cp[k+1]; const m=wy-terrainSurfaceY(wx,wz); if(m<_minM) _minM=m; }");
ok(G('_minM')>=0.045,'T2a ★每顶点 ≥ terrainSurfaceY+0.04 (最小余量 '+G('_minM.toFixed(4)')+'m) —— 坑体永不沉进渲染面之下');
ok(G('_minM')<0.35,'T2b 余量有界 (≤0.35: 唇缘 0.13r 不飞) —— 说明弹坑不是整片抬到半空');
ok(G('(function(){ let m=1e9; for(let k=0;k<_cp.length;k+=3){ const wx=_sp.x+_cp[k], wz=_sp.z+_cp[k+2], wy=_cp[k+1]; const m2=wy-heightAt(wx,wz); if(m2<m) m=m2; } return m; })()')>-0.05,'T2c 对照: 平地上 heightAt 与弦面重合 (余量同量级)');

// ══ T3 terrainSurfaceY 单元 ══
console.log('T3 terrainSurfaceY: 格点严格相等 + 格内包络');
G("_trs=TRS; _eq=true; for(const [i,j] of [[3,4],[9,7],[15,12],[20,3]]){ const x=_trs.x0+i*_trs.dx, z=_trs.z0+j*_trs.dx; if(Math.abs(terrainSurfaceY(x,z)-terrainRenderY(x,z))>1e-9) _eq=false; }");
ok(G('_eq')===true,'T3a ★格点处 terrainSurfaceY ≡ terrainRenderY (容差 1e-9: 同一格网同一插值)');
G("_in=true; { const x=_trs.x0+5.37*_trs.dx, z=_trs.z0+8.61*_trs.dx; const i=Math.floor(5.37), j=Math.floor(8.61); const c=[terrainRenderY(_trs.x0+i*_trs.dx,_trs.z0+j*_trs.dx),terrainRenderY(_trs.x0+(i+1)*_trs.dx,_trs.z0+j*_trs.dx),terrainRenderY(_trs.x0+i*_trs.dx,_trs.z0+(j+1)*_trs.dx),terrainRenderY(_trs.x0+(i+1)*_trs.dx,_trs.z0+(j+1)*_trs.dx)]; const sy=terrainSurfaceY(x,z); if(sy<Math.min(...c)-1e-6||sy>Math.max(...c)+1e-6) _in=false; }");
ok(G('_in')===true,'T3b 格内点落在四角双线性包络内 (弦面语义)');

// ══ T4 上限账 + 源码锚 ══
console.log('T4 36 上限 + 源码锚');
G("for(let k=0;k<40;k++) crater(_sp.x+0.3*k,_sp.z,0.8,true);");
ok(G('runtimeCraters.length')===36,'T4a ★runtimeCraters 36 上限 shift 账 (verify-worldrestore 契约) (实得 '+G('runtimeCraters.length')+')');
const src05b=srcOf('js/05b-props.js'),src08=srcOf('js/08-effects.js'),src03=srcOf('js/03-terrain.js');
ok(src05b.includes('idx.push(a,a+1,b,a+1,b+1,b);')===true,'T4b ★绕向锚 verbatim (法线朝上)');
ok(src05b.includes('const surfY=(typeof terrainSurfaceY===\'function\')?terrainSurfaceY:heightAt;')===true,'T4c ★弦面采样单源锚 verbatim (黑弧病根修复)');
ok(src05b.includes('const SEG=24,RINGS=4,R2=r*1.18;')===true,'T4d 剖面常量锚 (唇缘峰 0.8r/外沿 1.18r 熔回) verbatim');
ok(src05b.indexOf('function crater(')<src05b.indexOf('function crate(')&&src05b.slice(src05b.indexOf('function crater('),src05b.indexOf('function crate(')).includes('Torus')===false,'T4e 唇缘 Torus rim 已废 ( crater 区段无 TorusGeometry)');
ok(src08.includes('if(!noCrater&&p.y-heightAt(p.x,p.z)<2.2) crater(p.x,p.z,rand(1.2,1.7),true,p.y);')===true,'T4f explosionFX 调用点 verbatim (verify-airfix T1 契约)');
ok(src03.includes('function terrainSurfaceY(x,z){')===true,'T4g terrainSurfaceY 单源在 03-terrain verbatim');

console.log('');
console.log('verify-crater-20261115: PASS='+PASS.length+' FAIL='+FAILN+(NEG?' (--neg)':''));
if(FAILN>0) process.exit(1);
