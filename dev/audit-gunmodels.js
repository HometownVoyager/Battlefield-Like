// ─────────────────────────────────────────────
// dev/audit-gunmodels.js —— 武器模型接合间隙审计沙箱 (不进 Index.html)
// 用法: node dev/audit-gunmodels.js
// 原理: 最小 THREE 桩 + vm 上下文求值 09-weapons.js, 对每把武器调用
//       buildGunModel, 用逐叶节点世界包围盒找: 悬空零件 / z 向接缝间隙 /
//       枪口预留点与枪管前端的对齐情况。
// 注意: 包围盒是几何近似 (圆柱按外接盒), 结论用于指引人工修模。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'), path=require('path'), vm=require('vm');
const root=path.resolve(__dirname,'..');

// ── 带位置/欧拉的 THREE 桩 (不重算矩阵, 直接递归累加) ──
function makeThreeStub(){
class P3{ constructor(x=0,y=0,z=0){ this.x=x;this.y=y;this.z=z; }
set(x,y,z){ this.x=x;this.y=y;this.z=z; return this; } }
class Rot{ constructor(){ this.x=0;this.y=0;this.z=0; } set(x,y,z){ this.x=x;this.y=y;this.z=z; return this; } }
class Obj3{
constructor(){ this.position=new P3(); this.rotation=new Rot(); this.scale={x:1,y:1,z:1,set(){return this;},setScalar(){return this;}}; this.children=[]; this.parent=null; this.visible=true; }
add(m){ this.children.push(m); m.parent=this; }
traverse(fn){ fn(this); for(const c of this.children) if(c.traverse) c.traverse(fn); }
}
class Geo{ constructor(type,...a){ const p={type,args:a};
if(type==='BoxGeometry'){ p.hw=a[0]/2; p.hh=a[1]/2; p.hd=a[2]/2; }
else if(type==='CylinderGeometry'){ p.r=Math.max(a[0]||0,a[1]||0); p.hh=a[2]/2; }
else if(type==='SphereGeometry'){ p.r=a[0]||0; p.hh=0; }
this.parameters=p; }
translate(){ return this; } rotateX(){ return this; } rotateY(){ return this; }
}
class Mesh extends Obj3{ constructor(g,m){ super(); this.geometry=g||new Geo('BoxGeometry',1,1,1); this.material=m||{}; this.isMesh=true; } }
class Group extends Obj3{ }
class Material{ constructor(o){ Object.assign(this,o||{}); const c=o&&o.color;
this.color={ _v:c===undefined?0xffffff:c, getHexString(){ return ('000000'+this._v.toString(16)).slice(-6); }, set(){}, setRGB(){} }; } }
return { Group, Mesh, Object3D:Obj3,
BoxGeometry:class extends Geo{ constructor(...a){ super('BoxGeometry',...a); } },
CylinderGeometry:class extends Geo{ constructor(...a){ super('CylinderGeometry',...a); } },
SphereGeometry:class extends Geo{ constructor(...a){ super('SphereGeometry',...a); } },
PlaneGeometry:class extends Geo{ constructor(...a){ super('PlaneGeometry',...a); } },
ConeGeometry:class extends Geo{ constructor(...a){ super('ConeGeometry',...a); } },
MeshLambertMaterial:Material, SpriteMaterial:Material, CanvasTexture:class{constructor(c){this.image=c;}}, Vector3:P3 };
}
const THREE=makeThreeStub();

// 欧拉 XYZ 旋转矩阵 (column-major 数组, 只读用)
function rotEuler(e){
const cx=Math.cos(e.x),sx=Math.sin(e.x),cy=Math.cos(e.y),sy=Math.sin(e.y),cz=Math.cos(e.z),sz=Math.sin(e.z);
const rx=[1,0,0, 0,cx,-sx, 0,sx,cx];
const ry=[cy,0,sy, 0,1,0, -sy,0,cy];
const rz=[cz,-sz,0, sz,cz,0, 0,0,1];
const mul=(A,B)=>{ const C=[0,0,0,0,0,0,0,0,0]; for(let i=0;i<3;i++)for(let j=0;j<3;j++){ let s=0; for(let k=0;k<3;k++) s+=A[i*3+k]*B[k*3+j]; C[i*3+j]=s; } return C; };
return mul(mul(rx,ry),rz);
}
function bboxOf(dims){
if(dims.type==='BoxGeometry') return [dims.hw,dims.hh,dims.hd];
if(dims.type==='CylinderGeometry') return [dims.r,dims.hh,dims.r]; // 轴沿 Y
if(dims.type==='SphereGeometry') return [dims.r,dims.r,dims.r];
return [0.5,0.5,0.5];
}
function auditModel(model){
// 递归: 孩子位置在父的局部系中; 欧拉角直接累加 (嵌套组极少, 近似够用)
const list=[];
const rec=(obj,px,py,pz,rx,ry,rz)=>{
const x=px+obj.position.x, y=py+obj.position.y, z=pz+obj.position.z;
const ex=rx+obj.rotation.x, ey=ry+obj.rotation.y, ez=rz+obj.rotation.z;
if(obj.isMesh&&obj.geometry){
const dims=obj.geometry.parameters;
const [hw,hh,hd]=bboxOf(dims);
const R=rotEuler({x:ex,y:ey,z:ez});
let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
for(const sx of[-1,1])for(const sy of[-1,1])for(const sz of[-1,1]){
const lx=sx*hw,ly=sy*hh,lz=sz*hd;
const wx=x+R[0]*lx+R[1]*ly+R[2]*lz;
const wy=y+R[3]*lx+R[4]*ly+R[5]*lz;
const wz=z+R[6]*lx+R[7]*ly+R[8]*lz;
mn[0]=Math.min(mn[0],wx);mn[1]=Math.min(mn[1],wy);mn[2]=Math.min(mn[2],wz);
mx[0]=Math.max(mx[0],wx);mx[1]=Math.max(mx[1],wy);mx[2]=Math.max(mx[2],wz);
}
list.push({mn,mx,mat:obj.material&&obj.material.color?obj.material.color.getHexString():'?',type:obj.geometry.constructor.name,args:dims.args});
}
for(const c of obj.children) rec(c,x,y,z,ex,ey,ez);
};
rec(model,0,0,0,0,0,0);
return list;
}

// ── 沙箱加载 09a-defs.js + 09-weapons.js ──
// (2026-08-24 切分: WPN_DEFS 数据表在 09a-defs.js, 模型代码在 09-weapons.js)
const src=fs.readFileSync(path.join(root,'js','09a-defs.js'),'utf8')
+'\n'+fs.readFileSync(path.join(root,'js','09-weapons.js'),'utf8');
const ctx={ THREE, HPI:Math.PI/2, TAU:Math.PI*2,
V3:(x=0,y=0,z=0)=>({x,y,z,set(a,b,c){this.x=a;this.y=b;this.z=c;return this;}}),
TEX:{wood:{},woodDark:{}}, TEAM_FACTION:[{sleeve:0x4d5240},{sleeve:0x4a4d52}],
console, Math };
vm.createContext(ctx);
vm.runInContext(src+'\n;this.__exp={WPN_DEFS,buildGunModel};',ctx);

function overlapQ(a,b,eps=0.001){
return a.mn[0]<b.mx[0]-eps&&b.mn[0]<a.mx[0]-eps
&& a.mn[1]<b.mx[1]-eps&&b.mn[1]<a.mx[1]-eps
&& a.mn[2]<b.mx[2]-eps&&b.mn[2]<a.mx[2]-eps;
}
function zGap(a,b){
const xyOver=a.mn[0]<b.mx[0]&&b.mn[0]<a.mx[0]&&a.mn[1]<b.mx[1]&&b.mn[1]<a.mx[1];
if(!xyOver) return null;
if(a.mx[2]<=b.mn[2]) return b.mn[2]-a.mx[2];
if(b.mx[2]<=a.mn[2]) return a.mn[2]-b.mx[2];
return 0;
}
function fmt(a){ return '['+a.map(n=>n.toFixed(3)).join(',')+']'; }
function brief(b){ return `${b.type}${b.args?`(${b.args.slice(0,3).map(x=>typeof x==='number'?x.toFixed(3):x).join(',')})`:''}@z${b.mn[2].toFixed(2)}..${b.mx[2].toFixed(2)},y${b.mn[1].toFixed(2)}..${b.mx[1].toFixed(2)}`; }

const dumpKey=process.env.AUDIT_KEY;
for(const key of Object.keys(ctx.__exp.WPN_DEFS)){
if(dumpKey&&key!==dumpKey) continue;
const parts=ctx.__exp.buildGunModel(key);
const bbs=auditModel(parts.gun);
if(!bbs.length) continue;
if(dumpKey){
console.log(`\n=== ${key} FULL DUMP (按 z 排序) ===`);
bbs.map((b,i)=>({i,...b})).sort((a,b)=>a.mn[2]-b.mn[2]).forEach((b,i)=>{
console.log(`  #${b.i} ${b.type}${b.args?`(${b.args.slice(0,3).map(x=>typeof x==='number'?x.toFixed(3):x).join(',')})`:''} x${b.mn[0].toFixed(3)}..${b.mx[0].toFixed(3)} y${b.mn[1].toFixed(3)}..${b.mx[1].toFixed(3)} z${b.mn[2].toFixed(3)}..${b.mx[2].toFixed(3)} (c#${b.mat})`);
});
continue;
}
const floats=[];
for(let i=0;i<bbs.length;i++){
let hit=false;
for(let j=0;j<bbs.length;j++){ if(i!==j&&overlapQ(bbs[i],bbs[j])){ hit=true; break; } }
if(!hit) floats.push(i);
}
const seams=[];
for(let i=0;i<bbs.length;i++)for(let j=i+1;j<bbs.length;j++){
const g=zGap(bbs[i],bbs[j]);
if(g!==null&&g>0.004) seams.push({i,j,g});
}
let frontZ=1e9;
for(const b of bbs) frontZ=Math.min(frontZ,b.mn[2]);
const mz=parts.muzzle?parts.muzzle.z:0;
console.log(`\n=== ${key} — ${bbs.length} 件`+(floats.length?` | 悬空${floats.length}`:'')+(seams.length?` | 接缝${seams.length}`:'')+(mz>frontZ+0.02?` | 枪口前置${(mz-frontZ).toFixed(3)}`:'')+' ===');
if(floats.length) console.log('  FLOATS: '+floats.map(i=>`#${i} ${brief(bbs[i])}`).join('  |  '));
if(seams.length){
const top=seams.sort((a,b)=>b.g-a.g).slice(0,6);
console.log('  SEAMS: '+top.map(s=>`#${s.i}-#${s.j} gap=${s.g.toFixed(3)}  ${brief(bbs[s.i])} ↔ ${brief(bbs[s.j])}`).join('\n         '));
}
if(mz>frontZ+0.02) console.log(`  MUZZLE: 预留 z=${mz.toFixed(3)} 超出前端 z=${frontZ.toFixed(3)}`);
}
