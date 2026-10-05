// ─────────────────────────────────────────────
// dev/render-aamodel.js —— 7d-乙 防空炮建模重做: 离线渲染候选方案图 (先出图纪律, 用户定稿后才动 17-emplacements)
// 用法: node dev/render-aamodel.js
// 输出: dev/_aaopt-{A,B,C}-{iso,side,front}.png (三个候选) + dev/_aacur-{iso,side,front}.png (现役基线)
// 口径: 与 render-model.js 同源 —— 真 three 沙箱 (dev/vendor/three.min.js + 全链载入), 正交投影 + z 缓冲
//   + Lambert 着色; 光栅段直接取自 render-model.js (单一实现, 不另写一份)。
// 候选一律遵守运行时硬约束 (17-emplacements.aaGun 的群组结构/尺寸包线):
//   grp(y=-1.15 为地面) > yaw > pitch(y=0.1, 炮管沿 +z, 炮口离炮心 ~1.6-1.9m);
//   俯仰判据 -0.45..1.35 rad 下炮口不得切基座; 击杀圆柱 r0.7 / 高 1.4 —— 模型横向 ≤0.7, 高 ≤~1.45。
// ─────────────────────────────────────────────
const fs=require('fs'),path=require('path'),vm=require('vm'),zlib=require('zlib');
const root=path.resolve(__dirname,'..');
// ── 光栅段: 取自 render-model.js (从履带贴图函数到 PNG 写盘), 参数化后逐视图调用 ──
const rmsrc=fs.readFileSync(path.join(__dirname,'render-model.js'),'utf8');
const RASTER=rmsrc.slice(rmsrc.indexOf('// ── 合成履带贴图的样子'));
const rmstub=rmsrc.slice(rmsrc.indexOf('const RENDERER_STUB='),rmsrc.indexOf('// ── 采集: 世界三角'));
const stub=require('./_bootstub.js'); // boot() 闭包要用的沙箱桩 (render-model 同源)
eval(rmsrc.slice(rmsrc.indexOf("const FILES=['js/00-config.js'"),rmsrc.indexOf("'];",rmsrc.indexOf("const FILES=['js/00-config.js'"))+3).replace('const FILES=','FILES=')); // FILES 声明为全局 (boot 闭包按名取用, 不能是字符串)
eval(rmstub); // RENDERER_STUB + boot(campIdx) (闭包同源)
// ── 任意 Group 三角采集 (改自 render-model __collectGhost, 无履带贴图) ──
const COLLECT_GRP=`
function __collectGrp(grp){
grp.updateMatrixWorld(true);
const tris=[];
const V=new THREE.Vector3();
grp.traverse(o=>{
if(!o.isMesh) return;
const ge=o.geometry, p=ge.attributes.position, n=ge.attributes.normal;
const idx=ge.index?ge.index.array:null; const cnt=idx?idx.length:p.count;
const m=Array.isArray(o.material)?o.material[0]:o.material;
const col=(m&&m.color)?m.color.getHex():0x888888;
for(let t=0;t<cnt;t+=3){
const ids=idx?[idx[t],idx[t+1],idx[t+2]]:[t,t+1,t+2];
const P=[],N=[];
for(const i of ids){
V.set(p.getX(i),p.getY(i),p.getZ(i)).applyMatrix4(o.matrixWorld); P.push([V.x,V.y,V.z]);
V.set(n.getX(i),n.getY(i),n.getZ(i)).applyMatrix3(new THREE.Matrix3().getNormalMatrix(o.matrixWorld)).normalize(); N.push([V.x,V.y,V.z]);
}
tris.push({P,N,U:[[0,0],[0,0],[0,0]],col,isTrk:false,emi:(m&&m.emissive)?m.emissive.getHex():0,nm:o.name});
}
});
return tris;
}
`;
// ── 三个候选建造器 (真 THREE, 在沙箱内执行; 群组契约与 aaGun 一致) ──
const BUILDERS=`
function __aaBox(grp,mat,w,h,d,x,y,z,rx,ry,rz){
const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
m.position.set(x,y,z); if(rx)m.rotation.x=rx; if(ry)m.rotation.y=ry; if(rz)m.rotation.z=rz;
grp.add(m); return m;
}
function __aaCyl(grp,mat,rt,rb,h,x,y,z,rx,ry,rz,seg){
const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg||10),mat);
m.position.set(x,y,z); if(rx)m.rotation.x=rx; if(ry)m.rotation.y=ry; if(rz)m.rotation.z=rz;
grp.add(m); return m;
}
// 方案A —— 单管 40mm Bofors 风: 长身管+炮口制退器, 大防盾, 座椅, 三脚撑+圆座圈
function __aaOptA(){
const gun=vmMats.gun, gunL=vmMats.gunL, metal=MAT.metal;
const grp=new THREE.Group(); grp.position.set(0,1.15,0);
grp.rotation.order='YXZ';
const yaw=new THREE.Group(); grp.add(yaw);
const pitch=new THREE.Group(); pitch.position.y=0.1; yaw.add(pitch);
// 基座 (grp 直挂): 圆座圈 + 三根撑脚 + 立柱
__aaCyl(grp,metal,0.85,0.95,0.14,0,-1.08,0,0,0,0,14);
for(let k=0;k<3;k++){
const a=k*Math.PI*2/3;
__aaBox(grp,metal,1.7,0.09,0.2,Math.sin(a)*0.62,-1.0,Math.cos(a)*0.62,0,-a,0);
}
__aaCyl(grp,gunL,0.17,0.26,0.9,0,-0.64,0,0,0,0,10);
// yaw: 大防盾 (单宽板, 炮管居中穿过) + 座椅 (带支撑柱)
__aaBox(yaw,gunL,1.0,0.62,0.05,0,0.36,0.2,-0.12,0,0);
__aaBox(yaw,gun,0.34,0.07,0.36,-0.48,-0.06,-0.3,0,0,0);
__aaBox(yaw,gun,0.34,0.42,0.07,-0.48,0.15,-0.46,0.15,0,0);
__aaCyl(yaw,metal,0.035,0.045,0.55,-0.48,-0.35,-0.32,0,0,0,8);
__aaCyl(yaw,gun,0.035,0.035,0.34,0.3,0.3,0.05,0.9,0,0,8); // 瞄具
// pitch: 摇架 + 复进筒 + 长身管 + 炮口制退器 + 弹夹
__aaBox(pitch,gun,0.28,0.28,0.9,0,0,0.32,0,0,0);
__aaCyl(pitch,metal,0.045,0.045,0.7,0,-0.17,0.45,Math.PI/2,0,0,8);
__aaCyl(pitch,gun,0.042,0.052,1.7,0,0,1.1,Math.PI/2,0,0,10);
__aaCyl(pitch,gun,0.062,0.062,0.2,0,0,1.88,Math.PI/2,0,0,10);
__aaBox(pitch,gunL,0.16,0.15,0.24,0.18,0.14,0.12,0,0,0);
return grp;
}
// 方案B —— 四联 20mm Flakvierling 风: 轮式拖车底盘, 2×2 四身管, 后座座椅
function __aaOptB(){
const gun=vmMats.gun, gunL=vmMats.gunL, metal=MAT.metal;
const grp=new THREE.Group(); grp.position.set(0,1.15,0);
grp.rotation.order='YXZ';
const yaw=new THREE.Group(); grp.add(yaw);
const pitch=new THREE.Group(); pitch.position.y=0.1; yaw.add(pitch);
// 底盘: 轮轴 + 双轮 + 引杆 + 立柱
__aaCyl(grp,metal,0.045,0.045,1.6,0,-0.8,0,0,0,Math.PI/2,8);
__aaCyl(grp,gunL,0.3,0.3,0.12,-0.8,-0.8,0,0,0,Math.PI/2,14);
__aaCyl(grp,gunL,0.3,0.3,0.12,0.8,-0.8,0,0,0,Math.PI/2,14);
__aaBox(grp,metal,0.07,0.07,1.2,0,-0.82,-0.95,-0.08,0,0);
__aaCyl(grp,gunL,0.15,0.22,0.85,0,-0.66,0,0,0,0,10);
// yaw: 后座座椅 (带支撑柱) + 小盾
__aaBox(yaw,gun,0.36,0.07,0.38,0,-0.02,-0.55,0,0,0);
__aaBox(yaw,gun,0.36,0.4,0.07,0,0.2,-0.71,0.16,0,0);
__aaCyl(yaw,metal,0.03,0.04,0.5,0,-0.3,-0.55,0,0,0,8);
__aaBox(yaw,gunL,0.46,0.32,0.06,0,0.3,0.42,-0.16,0,0);
// pitch: 炮箱 + 2×2 四身管 + 双弹鼓
__aaBox(pitch,gun,0.42,0.36,0.55,0,0,0.14,0,0,0);
for(const sx of [-0.065,0.065]) for(const sy of [-0.06,0.06])
__aaCyl(pitch,gun,0.026,0.03,1.55,sx,sy,1.02,Math.PI/2,0,0,8);
__aaCyl(pitch,gunL,0.09,0.09,0.16,-0.24,0.05,0.2,Math.PI/2,0,0,10);
__aaCyl(pitch,gunL,0.09,0.09,0.16,0.24,0.05,0.2,Math.PI/2,0,0,10);
return grp;
}
// 方案C —— 双联 37mm 演化 (保留现役双管身份): X 十字撑 + 双斜盾 + 双座椅 + 双弹匣
function __aaOptC(){
const gun=vmMats.gun, gunL=vmMats.gunL, metal=MAT.metal;
const grp=new THREE.Group(); grp.position.set(0,1.15,0);
grp.rotation.order='YXZ';
const yaw=new THREE.Group(); grp.add(yaw);
const pitch=new THREE.Group(); pitch.position.y=0.1; yaw.add(pitch);
// 基座: X 十字撑 + 圆座圈 + 立柱
__aaCyl(grp,metal,0.8,0.9,0.14,0,-1.08,0,0,0,0,14);
__aaBox(grp,metal,1.9,0.09,0.17,0,-1.0,0,0,Math.PI/4,0);
__aaBox(grp,metal,1.9,0.09,0.17,0,-1.0,0,0,-Math.PI/4,0);
__aaCyl(grp,gunL,0.18,0.27,0.92,0,-0.62,0,0,0,0,10);
// yaw: 双盾并排 (微角) + 双座椅 (带支撑柱)
__aaBox(yaw,gunL,0.54,0.56,0.05,-0.28,0.32,0.22,-0.1,0.08,0);
__aaBox(yaw,gunL,0.54,0.56,0.05,0.28,0.32,0.22,-0.1,-0.08,0);
__aaBox(yaw,gun,0.3,0.07,0.34,-0.5,-0.04,-0.3,0,0,0);
__aaBox(yaw,gun,0.3,0.42,0.07,-0.5,0.17,-0.45,0.16,0,0);
__aaCyl(yaw,metal,0.03,0.04,0.55,-0.5,-0.32,-0.32,0,0,0,8);
__aaBox(yaw,gun,0.3,0.07,0.34,0.5,-0.04,-0.3,0,0,0);
__aaBox(yaw,gun,0.3,0.42,0.07,0.5,0.17,-0.45,0.16,0,0);
__aaCyl(yaw,metal,0.03,0.04,0.55,0.5,-0.32,-0.32,0,0,0,8);
// pitch: 双炮摇架 + 双身管 + 双复进筒 + 双弹匣
__aaBox(pitch,gun,0.52,0.3,0.8,0,0,0.28,0,0,0);
for(const sx of [-0.14,0.14]){
__aaCyl(pitch,gun,0.048,0.056,1.6,sx,0,1.05,Math.PI/2,0,0,10);
__aaCyl(pitch,metal,0.04,0.04,0.62,sx,-0.16,0.42,Math.PI/2,0,0,8);
__aaBox(pitch,gunL,0.14,0.16,0.22,sx*1.9,0.1,0.05,0,0,0);
}
return grp;
}
`;
// ── 渲染 ──
const ctx=boot(2);
const Q=s=>vm.runInContext(s,ctx);
Q(COLLECT_GRP);
Q(BUILDERS);
// 现役基线: 取场上第一门活高炮的真 grp
const curGrp=Q('(function(){ for(const g of AAGUNS){ if(g&&!g.dead&&g.kind==="aa"&&g.grp) return g.grp; } return null; })()');
const jobs=[];
if(curGrp) for(const v of ['iso','side','front']) jobs.push(['aacur',Q(`__collectGrp(AAGUNS.find(g=>!g.dead&&g.kind==="aa"&&g.grp).grp)`),v]);
else console.log('(!) 场上无现役高炮可采 (基线图跳过)');
for(const [nm,fn] of [['A','__aaOptA()'],['B','__aaOptB()'],['C','__aaOptC()']])
for(const v of ['iso','side','front'])
jobs.push([nm,Q(`__collectGrp(${fn})`),v]);
for(const [nm,tris,view] of jobs){
new Function('tris','VIEW','F','V','root','fs','path','zlib',RASTER)(tris,view,'aa'+nm,0,root,fs,path,zlib);
}
console.log('候选方案图输出完毕 (dev/_aaopt-*.png 现役基线 dev/_aacur-*.png)');
