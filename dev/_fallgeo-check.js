// ─────────────────────────────────────────────
// dev/_fallgeo-check.js —— 枯树/椰树倒伏的**真几何**取证 (2026-09-26 枯树/椰树倒伏批)
// 为什么另立一个: dev/verify-fire.js 的 THREE 桩里 Quaternion 的 setFromAxisAngle/premultiply 是空转,
// 而本条改动的核心恰恰是"手算四元数 R⊗q0 把整株绕根部翻倒" —— 桩里只能证明"字段被写了",
// 不能证明"树真的倒向爆心反方向、且是刚体翻转"。本脚本改用仓库自带的真 three.js r152
// (dev/vendor/three.min.js, 与 index.html 的 CDN 同版), 从世界坐标直接量:
//   ① 倒向: 干顶局部 +Y 的世界方向是否 ≈ 背离爆心的水平单位向量 (两象限各一例, 抓方向符号错);
//   ② 倒伏量: 椰冠落点水平位移 ≈ 株高·sin(1.5) 且 y ≈ 株高·cos(1.5) + 根高 (真躺下, 不是滑走/站着);
//   ③ 刚体性: 枯树两件之间的相对距离在全程不变 (只平移不转姿态 / 只转姿态不平移 都会被这条抓出);
//   ④ 根部不动: 根锚点 (rec.x, rec.g0, rec.z) 在倒伏前后是同一世界点;
//   ⑤ 阴性对照 (故障注入): 把倒向符号取反 ⇒ ① 必须报红 (证明判据不是空转)。
// 用法: node dev/_fallgeo-check.js
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'), path=require('path'), vm=require('vm');
const root=path.resolve(__dirname,'..');

// ── 真 three r152 ──
const ctx0={console,Math,Date,JSON,Float32Array,Uint8Array,Uint16Array,parseInt,parseFloat,isNaN,document:{createElement:()=>({width:0,height:0,getContext:()=>({})})}};
ctx0.globalThis=ctx0; vm.createContext(ctx0);
vm.runInContext(fs.readFileSync(path.join(root,'dev/vendor/three.min.js'),'utf8'),ctx0,{filename:'dev/vendor/three.min.js'});
const THREE=ctx0.THREE;
if(!THREE||!THREE.REVISION) throw new Error('three.min.js 未挂上 THREE');

// ── 04b-fire 的最小载入环境 (只补它真正引用的全局; 08-effects 的沉入系统用记录桩) ──
const sandbox={
console,Math,JSON,Date,parseInt,parseFloat,isNaN,Float32Array,Uint8Array,Uint16Array,Object,Array,Set,Map,String,Number,Boolean,Error,RegExp,
THREE, MAP_SIZE:640,
clamp:(v,a,b)=>v<a?a:(v>b?b:v),
rand:(a,b)=>a+Math.random()*(b-a),
heightAt:()=>0,
camera:{position:{x:9999,y:30,z:9999}},     // 远离战场 ⇒ treeFallImpact 的镜头轻震不触发
spawnP:()=>{}, PT:{dirt:1,smoke:1,flash:1,spark:1,dark:1},
addTrauma:()=>{},
queueSink:(job)=>{ job.t=0; job.phase=0; job.half=false; return job; },
SINK_RECORD:[],                              // queueSink 桩的记录口
TREEBURST:{r:12,dmg:30,tankDmg:40},          // 树爆参数 (04b 尾部 TB 用; 本脚本不触发树爆)
};
sandbox.globalThis=sandbox;
const ctx=vm.createContext(sandbox);
const load=(f)=>vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
load('js/04b-fire.js');
const G=(n)=>vm.runInContext(n,ctx);
const floraHashAdd=G('floraHashAdd'), explosionFlora=G('explosionFlora'),
      updateFallingTrees=G('updateFallingTrees'), FALLING=G('FALLING');

let failures=0;
const ok=(m)=>console.log('  ✔ '+m);
const fail=(m)=>{ console.log('  ✘ '+m); failures++; };
// 与 23b/08 无关: 本脚本不跑还原链, 只量倒伏几何

// ── 造株: 椰树 = 1 个 Group (干 + 冠), 枯树 = 2 件独立网格 (与 05b-props 同构) ──
const world=new THREE.Group();
function makePalm(x,z,h,leanA){
const grp=new THREE.Group();
grp.position.set(x,0,z);
grp.rotation.order='YXZ';
grp.rotation.set(0.08*Math.sin(leanA),1.1,0.08*Math.cos(leanA));   // 与 05b palm() 同样的"带倾角+随机朝向"
world.add(grp);
const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.30,h,7),{});
trunk.position.y=h/2; grp.add(trunk);                              // 干顶在 (0,h,0) (局部)
const frond=new THREE.Mesh(new THREE.BoxGeometry(0.46,3,0.09),{});
frond.position.set(0,h,0); grp.add(frond);                         // 冠 (量它即可量干顶)
const cyl={x,z,r:0.34,y0:0,y1:h};
const rec={kind:'palm',x,z,g0:0,meshes:[grp],cyl,alive:true,dead:false};
world.add(grp);
floraHashAdd(rec);
return rec;
}
function makeDead(x,z){
const t=new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.3,3.6,6),{});
t.position.set(x,1.8,z);
const b1=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.1,1.6,5),{});
b1.position.set(x+0.5,3,z); b1.rotation.z=-0.9;
world.add(t); world.add(b1);
const rec={kind:'dead',x,z,g0:0,meshes:[t,b1],cyl:{x,z,r:0.3,y0:0,y1:3.4},alive:true,dead:false};
floraHashAdd(rec);
return rec;
}
// 干顶/冠 的世界位置 (Group 局部原点即根: grp.position + q·(0,h,0))
const palmTip=(rec,h,out)=>out.copy(new THREE.Vector3(0,h,0)).applyQuaternion(rec.meshes[0].quaternion).add(rec.meshes[0].position);
const trunkAxis=(rec,out)=>{ const v=out.set(0,1,0); v.applyQuaternion(rec.meshes[0].quaternion); const p=rec.meshes[0].parent; if(p&&p!==world){ const q=new THREE.Quaternion(); p.getWorldQuaternion(q); v.applyQuaternion(q); } return v; };

const v=new THREE.Vector3(), v2=new THREE.Vector3();
function runFall(rec,blastX,blastZ,radius=5){
// 爆心 → 株心 的方向 = 期望倒向 (水平单位向量)
const ex=rec.x-blastX, ez=rec.z-blastZ, el=Math.hypot(ex,ez);
const ux=ex/el, uz=ez/el;
const rootBefore=v.set(rec.x,rec.g0,rec.z).clone();
const dBefore=(rec.meshes.length>1)?rec.meshes[0].position.distanceTo(rec.meshes[1].position):null;
explosionFlora({x:blastX,y:0,z:blastZ},radius);
if(!rec.fall) return {err:'未触发倒伏'};
for(let s=0;s<160&&FALLING.includes(rec);s++) updateFallingTrees(0.05);
const h=(rec.cyl.y1-rec.cyl.y0);   // 注意: cyl 已被 killCyl 改过 ⇒ 用记录里的值不靠谱, 见下方调用点的传参
return {ux,uz,rootBefore,dBefore,h};
}
// killCyl 会把 cyl.y1 改掉 ⇒ 株高在这里按造株时的常量写死
const PALM_H=8, DEAD_H=3.4;

console.log('\n======== 枯树/椰树倒伏·真 three 几何取证 ========');
// ── 用例 1/2: 椰树, 爆心分别在西侧 / 南侧 (两象限, 抓方向符号错) ──
for(const [tag,px,pz,bx,bz] of [['爆心在西 (−x)',40,40,36,40],['爆心在南 (−z)',100,100,100,96]]){
const rec=makePalm(px,pz,PALM_H,0.7);
const r=runFall(rec,bx,bz);
if(r.err){ fail('椰树['+tag+'] '+r.err); continue; }
const tip=palmTip(rec,PALM_H,v2.clone());
const dx=tip.x-rec.x, dz=tip.z-rec.z;
const dot=(dx*r.ux+dz*r.uz)/Math.hypot(dx,dz);        // 落点方向与"背离爆心"的余弦
const wantH=PALM_H*Math.sin(1.5);                     // ≈7.98
if(dot>0.9) ok('椰树['+tag+'] 冠落点背离爆心 (cos='+dot.toFixed(3)+')');
else fail('椰树['+tag+'] 冠落点方向错 (cos='+dot.toFixed(3)+' dir='+dx.toFixed(1)+','+dz.toFixed(1)+' want='+r.ux.toFixed(2)+','+r.uz.toFixed(2)+')');
if(Math.hypot(dx,dz)>wantH*0.85&&Math.hypot(dx,dz)<wantH*1.15) ok('椰树['+tag+'] 冠落点水平位移='+Math.hypot(dx,dz).toFixed(2)+'m ≈ 株高·sin1.5='+wantH.toFixed(2)+'m (真倒下)');
else fail('椰树['+tag+'] 冠落点水平位移异常 '+Math.hypot(dx,dz).toFixed(2)+'m (期望≈'+wantH.toFixed(2)+'m)');
if(tip.y<1.6) ok('椰树['+tag+'] 冠落点高度 '+tip.y.toFixed(2)+'m (≈株高·cos1.5=0.57, 已落地)');
else fail('椰树['+tag+'] 冠仍在半空 y='+tip.y.toFixed(2)+'m (未真倒下)');
const axis=trunkAxis(rec,v);
if(axis.y<0.35) ok('椰树['+tag+'] 干轴已放平 (干轴·竖直='+axis.y.toFixed(3)+')');
else fail('椰树['+tag+'] 干轴仍近竖直 (y='+axis.y.toFixed(3)+')');
if(Math.abs(rec.meshes[0].position.x-rec.x)<1e-9&&Math.abs(rec.meshes[0].position.z-rec.z)<1e-9) ok('椰树['+tag+'] 根锚点未平移 (绕根翻转, 不是整株滑走)');
else fail('椰树['+tag+'] 根锚点被平移 ('+rec.meshes[0].position.x.toFixed(3)+','+rec.meshes[0].position.z.toFixed(3)+')');
}
// ── 用例 3: 枯树 (两件独立网格) — 方向 / 刚体性 / 根部不动 ──
{
const rec=makeDead(80,80);
const r=runFall(rec,80-4,80);
if(r.err) fail('枯树 '+r.err);
else{
const axis=trunkAxis(rec,v);
const dot=axis.x*r.ux+axis.z*r.uz;
if(dot>0.9) ok('枯树 干轴指向背离爆心 (cos='+dot.toFixed(3)+')');
else fail('枯树 干轴方向错 (cos='+dot.toFixed(3)+')');
const dAfter=rec.meshes[0].position.distanceTo(rec.meshes[1].position);
if(Math.abs(dAfter-r.dBefore)<1e-6) ok('枯树 两件间距全程不变 ('+r.dBefore.toFixed(4)+' → '+dAfter.toFixed(4)+') = 刚体翻转');
else fail('枯树 两件间距变了 ('+r.dBefore.toFixed(4)+' → '+dAfter.toFixed(4)+') = 只有一件动了');
const bx=rec.meshes[0].position.x, bz=rec.meshes[0].position.z;
if(bx>rec.x+1.2&&Math.abs(bz-rec.z)<0.6) ok('枯树 干身已向爆心反方向倒出 ('+(bx-rec.x).toFixed(2)+'m)');
else fail('枯树 干身位移异常 (Δx='+(bx-rec.x).toFixed(2)+', Δz='+(bz-rec.z).toFixed(2)+')');
}
}
// ── 用例 4: 阴性对照 (故障注入) —— 把倒向符号取反, 上面那条"背离爆心"必须报红 ──
{
const rec=makePalm(120,120,PALM_H,0.3);
explosionFlora({x:120-4,y:0,z:120},5);
if(!rec.fall) fail('阴性对照: 未触发倒伏 (无法验证判据敏感度)');
else{
rec.fall.dx=-rec.fall.dx; rec.fall.dz=-rec.fall.dz;   // 注入: 倒向反转 (= 朝爆心倒)
for(let s=0;s<160&&FALLING.includes(rec);s++) updateFallingTrees(0.05);
const tip=palmTip(rec,PALM_H,v2.clone());
const dx=tip.x-rec.x, dz=tip.z-rec.z;
const dot=(dx*1+dz*0)/Math.hypot(dx,dz);   // 期望(修复后)方向 = +x (单位向量)
if(dot<0.9) ok('阴性对照: 倒向反转后判据确实报红 (cos='+dot.toFixed(3)+' ⇒ 判据对方向敏感, 非空转)');
else fail('阴性对照失效: 倒向反转了判据仍通过 (cos='+dot.toFixed(3)+')');
}
}
console.log(failures?('\n✘ '+failures+' 项未通过'):'\n全部通过 ✔');
process.exit(failures?1:0);
