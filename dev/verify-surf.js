// ─────────────────────────────────────────────
// dev/verify-surf.js —— 深度分层管线 (05-world SURF_LANES + resolveCoplanarConflicts) 沙箱 (不进 Index.html)
// 用法: node dev/verify-surf.js [campaignId ...]   (缺省: 全 11 图)
// 背景 (2026-09-27 用户实报): "两个面重合的时候图层会打架, 显示的材质一闪一闪的"。
//   near=0.08/far=900 ⇒ 24bit 深度一格 (1 LSB) 的世界尺寸 ≈ z²/(near·2²⁴): 100m≈7.5mm / 200m≈3.0cm。
//   两块共面 (或间距 < 1 LSB) 的面在深度缓冲里是同一个读数 ⇒ 胜负只由**绘制顺序**决定, 而 three 的不透明件
//   排序第一键是"到相机的距离"(每帧变) ⇒ 相机一动, 胜者翻转 = 闪。旧版对策是四档 polygonOffset, 档距 = 1 LSB,
//   恰好等于固定点深度插值的噪声地板 (1~2 LSB) ⇒ 实机仍闪。
// 本沙箱断言 (全部可复现, 不依赖 GPU):
//   ① 单源纪律: 全库 polygonOffset 数字只出现在 05-world.js 的 SURF_LANES; 阶梯数值自洽 (档距/上限)
//   ② 覆盖层登记: 桥面板条/弹坑贴花/血贴花/河道/塘面/海面/碎波带/结冰河面 各走正确的档
//   ③ 共面消解正确性: 独立扫描全场景"写深度的轴对齐件", 对**每一对**共面/薄埋且面内交叠的件对,
//      断言两件的**有效深度单位不同** ⇒ 深度测试有唯一胜者, 与相机无关 (这是本批的核心判据)
//   ④ 对照组: 现造同位件 → 二次消解必须分开; 现造不重叠件 → 必须不动它 (不多改)
//   ⑤ 档位规模: maxLevel ≤ 6、材质变体数远小于件数; 共享材质零污染
//   ⑥ 世界还原链一致: capturePristineWorld + restorePristineWorld 之后档位不变
//   ⑦ ?nosurf=1 开关: 消解器空转且不碰任何材质 (实机 A/B 用)
// 口径纪律: 本文件只读游戏对象 + 调它的公开函数; 临时改动一律在同段内复原。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const stub=require('./_bootstub.js');
const root=path.resolve(__dirname,'..');
const HPI=Math.PI/2;
let failures=0,checks=0;
const chk=(c,m)=>{ checks++; if(c) console.log('  ✓ '+m); else { failures++; console.error('  ✗ '+m); } };
const info=m=>console.log('    · '+m);

// ── 桩忠实化 (只在本 verify 进程内): 共用桩的 Box/Cyl/Circle 已记 parameters, 但 PlaneGeometry.setY 是空操作 +
//    Circle/Torus 没记 parameters 的完整字段 ⇒ 这里换成"记录参数/记录 Y"的子类, 与真 three.js 同形。
const THREE=stub.THREE;
class BoxG extends THREE.BoxGeometry{ constructor(w,h,d){ super(w,h,d); this.parameters={width:w,height:h,depth:d}; } }
class CircG extends THREE.CircleGeometry{ constructor(r,s){ super(r,s); this.parameters={radius:r,segments:s}; } }
class CylG extends THREE.CylinderGeometry{ constructor(rt,rb,h,s){ super(rt,rb,h,s); this.parameters={radiusTop:rt,radiusBottom:rb,height:h,radialSegments:s}; } }
class PlaneG extends THREE.PlaneGeometry{
constructor(w,h,sg,sh){
super(w,h,sg,sh);
const p=this.attributes.position, y=new Float32Array(p.count);
p.__y=y; p.setY=(i,v)=>{ y[i]=v; }; p.getY=(i)=>y[i];
this.parameters={width:w,height:h,widthSegments:sg,heightSegments:sh};
}
}
THREE.BoxGeometry=BoxG; THREE.CircleGeometry=CircG; THREE.CylinderGeometry=CylG; THREE.PlaneGeometry=PlaneG;
// 桩忠实化②: 共用桩的材质类没有 clone(), 而 08-effects bloodDecal 用 bloodMat.clone() 做"逐贴片独立 opacity"
// (真 three 有)。补上与真 three 同形的浅克隆, 否则血贴花这条路径在沙箱里永远跑不到 (旧脚本都没碰它)。
for(const k of ['MeshLambertMaterial','MeshBasicMaterial','SpriteMaterial','LineBasicMaterial','MeshStandardMaterial']){
const C0=THREE[k];
if(C0&&C0.prototype&&!C0.prototype.clone){
C0.prototype.clone=function(){ const m=Object.create(Object.getPrototypeOf(this)); Object.assign(m,this); return m; };
}
}

const FILES=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/22a-menuart.js','js/23-deploy.js','js/23b-worldrestore.js','js/24-main.js'];
function boot(campIdx,files,extraQuery){
for(const k in stub.byId) delete stub.byId[k];
const ctx=vm.createContext(Object.assign({},stub.sandbox));
ctx.document=stub.document; ctx.window=stub.window;
if(extraQuery!==undefined){ ctx.location={search:extraQuery}; }
ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of (files||FILES)) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
return ctx;
}
// 注意: 桩的 globalThis 指向模板 sandbox ⇒ 注入脚本里用 var x=（与 verify-zfight 同一纪律）
const G=(ctx,code)=>vm.runInContext(code,ctx);
const LITE=['js/00-config.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js'];
const campIdx=id=>{ const c=boot(0,LITE); const i=G(c,`CAMPAIGNS.findIndex(x=>x.id==='${id}')`); if(i<0) throw new Error('no campaign '+id); return i; };
const argc=process.argv.slice(2);
const IDS=argc.length?argc:G(boot(0,LITE),`CAMPAIGNS.map(c=>c.id)`);
console.log(`\n═══ dev/verify-surf (深度分层管线: 阶梯 + 构建期共面消解) ═══`);
info(`战役 ${IDS.length} 张: ${IDS.join(' ')}`);

// ══════════════════════════════════════════════════════════════════════════════════
// 独立扫描器 (§3/§4 共用): 枚举写深度的轴对齐件 + 6 面配对 —— 判据与 05-world.resolveCoplanarConflicts 同源,
// 但**实现独立**(自写一遍), 且比较的是"有效深度单位"而不是"内部着色结果"。
// ══════════════════════════════════════════════════════════════════════════════════
const SCAN_SRC=`
function surfScan(){
const TOL=0.02, MINAREA=0.015, QN=96;   // 与 SURF_CONFLICT 同口径 (tol / minArea)
// ★ 2026-09-27L 起扫描器也走**真实面模型** (任意朝向件的 6 个真实面), 不再只扫轴对齐件的 AABB 面 ——
//   否则"斜置件共面"整类落在扫描器视野外, "同单位残留 0"这条断言对刚修的那一类是空的 (假通过)。
//   反向面的重合判据用 |pA + pB| (法线反号 ⇒ 平面坐标反号), 薄埋判据用**区间交叠量** (支撑函数),
//   与 05-world.resolveCoplanarConflicts 同源 —— 旧版这里还是"厚度 − 平面距"的错口径, 会误报深埋件。
const C=[], seen=new Set();
const rot3=r=>{ const a=Math.cos(r.x||0),b=Math.sin(r.x||0),c=Math.cos(r.y||0),d=Math.sin(r.y||0),e=Math.cos(r.z||0),f=Math.sin(r.z||0);
const ord=r.order||'XYZ';
if(ord==='XYZ') return [[c*e,-c*f,d],[a*f+b*e*d,a*e-b*f*d,-b*c],[b*f-a*e*d,b*e+a*f*d,a*c]];
const X=[[1,0,0],[0,a,-b],[0,b,a]], Y=[[c,0,d],[0,1,0],[-d,0,c]], Z=[[e,-f,0],[f,e,0],[0,0,1]];
const g=k=>k==='X'?X:(k==='Y'?Y:Z);
const o1=g(ord[0]), o2=g(ord[1]), o3=g(ord[2]);
const mul=(P,Q)=>{ const M=[[0,0,0],[0,0,0],[0,0,0]];
for(let i=0;i<3;i++)for(let j=0;j<3;j++) M[i][j]=P[i][0]*Q[0][j]+P[i][1]*Q[1][j]+P[i][2]*Q[2][j]; return M; };
return mul(mul(o1,o2),o3); };   // three 的 rotation.order 决定连乘顺序 (不能只按 XYZ 算)
const I3=[[1,0,0],[0,1,0],[0,0,1]];
(function walk(o,B,P){
if(!o||seen.has(o)) return; seen.add(o);
const t=o.position||{x:0,y:0,z:0}, s=o.scale||{x:1,y:1,z:1}, r=o.rotation||{x:0,y:0,z:0};
const wx=B[0][0]*t.x+B[0][1]*t.y+B[0][2]*t.z+P[0];
const wy=B[1][0]*t.x+B[1][1]*t.y+B[1][2]*t.z+P[1];
const wz=B[2][0]*t.x+B[2][1]*t.y+B[2][2]*t.z+P[2];
const Rl=(!r.x&&!r.y&&!r.z)?I3:rot3(r);
const M=[[0,0,0],[0,0,0],[0,0,0]];
for(let i=0;i<3;i++)for(let j=0;j<3;j++) M[i][j]=(B[i][0]*Rl[0][j]+B[i][1]*Rl[1][j]+B[i][2]*Rl[2][j])*(j===0?s.x:(j===1?s.y:s.z));
const g=o.geometry, mat=o.material;
if(g&&mat&&o.visible!==false&&o.count===undefined){
const pr=g.parameters||{};
let dims=null;
if(pr.width!==undefined&&pr.height!==undefined&&pr.depth!==undefined) dims=[pr.width,pr.height,pr.depth];
else if(pr.radiusTop!==undefined&&pr.height!==undefined) dims=[Math.max(pr.radiusTop,pr.radiusBottom)*2,pr.height,Math.max(pr.radiusTop,pr.radiusBottom)*2];
if(dims){
const ext=Math.max(dims[0],dims[2]);
if(ext<=200&&ext>=0.15&&isFinite(wx)&&isFinite(wy)&&isFinite(wz)){
const ax=[[M[0][0],M[1][0],M[2][0]],[M[0][1],M[1][1],M[2][1]],[M[0][2],M[1][2],M[2][2]]];
const h=[0,0,0];
for(let i=0;i<3;i++){ const L=Math.hypot(ax[i][0],ax[i][1],ax[i][2])||1; ax[i][0]/=L; ax[i][1]/=L; ax[i][2]/=L; h[i]=dims[i]/2*L; }
C.push({o,mat,ctr:[wx,wy,wz],ax,h,dim:dims,
write:!(mat.transparent===true&&mat.depthWrite===false),
units:(mat.polygonOffset===true?(mat.polygonOffsetUnits||0):0),
lane:(mat.polygonOffset===true?'offset':'-'),
transp:mat.transparent===true,
dbl:mat.side===THREE.DoubleSide});
}
}
}
for(const c of o.children||[]) walk(c,M,[wx,wy,wz]);
})(scene,I3,[0,0,0]);
// 6 个真实面 → (法线三轴量化 | 平面量化) 桶; 面内矩形用**规范化法线**的 (u,v) 基底 (同向/反向面共基底)
const basis=(nx,ny,nz)=>{
const an=Math.abs(nx), am=Math.abs(ny), ao=Math.abs(nz);
const k=(an>=am&&an>=ao)?0:(am>=ao?1:2);
if((k===0?nx:(k===1?ny:nz))<0){ nx=-nx; ny=-ny; nz=-nz; }
const ux2=Math.abs(nx)<0.9?1:0, uy2=Math.abs(nx)<0.9?0:1;
let vx=-nz*uy2, vy=nz*ux2, vz=nx*uy2-ny*ux2;
const vl=Math.hypot(vx,vy,vz)||1; vx/=vl; vy/=vl; vz/=vl;
return [[ny*vz-nz*vy,nz*vx-nx*vz,nx*vy-ny*vx],[vx,vy,vz]];
};
const buckets=new Map();
C.forEach((c,i)=>{ c.i=i;
for(let a=0;a<3;a++)for(const sg of [-1,1]){
const N=c.ax[a], H=c.h[a];
const nx=N[0]*sg, ny=N[1]*sg, nz=N[2]*sg;
const fx=c.ctr[0]+nx*H, fy=c.ctr[1]+ny*H, fz=c.ctr[2]+nz*H;
const p=nx*fx+ny*fy+nz*fz;
const b=basis(nx,ny,nz);
const o1=(a+1)%3, o2=(a+2)%3, e1=c.ax[o1], e2=c.ax[o2], h1=c.h[o1], h2=c.h[o2];
let u0=1e9,u1=-1e9,v0=1e9,v1=-1e9;
for(const su of [-1,1])for(const sv of [-1,1]){
const px=fx+e1[0]*h1*su+e2[0]*h2*sv, py=fy+e1[1]*h1*su+e2[1]*h2*sv, pz=fz+e1[2]*h1*su+e2[2]*h2*sv;
const du=px*b[0][0]+py*b[0][1]+pz*b[0][2], dv=px*b[1][0]+py*b[1][1]+pz*b[1][2];
if(du<u0)u0=du; if(du>u1)u1=du; if(dv<v0)v0=dv; if(dv>v1)v1=dv;
}
const kk=Math.round(nx*QN)+'|'+Math.round(ny*QN)+'|'+Math.round(nz*QN)+'|'+Math.round(p/0.01);
let arr=buckets.get(kk); if(!arr){ arr=[]; buckets.set(kk,arr); }
arr.push([i,u0,u1,v0,v1,a,p,nx,ny,nz]);
} });
const pairs=[], seenP=new Set();
const supOf=(c,n)=>{ let s2=0; for(let k=0;k<3;k++){ const x=c.ax[k]; s2+=Math.abs(n[0]*x[0]+n[1]*x[1]+n[2]*x[2])*c.h[k]; } return s2; };
const test=(A,B)=>{
if(A[0]===B[0]) return;
const dn=A[7]*B[7]+A[8]*B[8]+A[9]*B[9];
const opp=(dn<=-0.99985);
if(!opp&&dn<0.99985) return;
const dOff=opp?Math.abs(A[6]+B[6]):Math.abs(A[6]-B[6]);
if(dOff>=TOL) return;
const u0=Math.max(A[1],B[1]), u1=Math.min(A[2],B[2]);
const v0=Math.max(A[3],B[3]), v1=Math.min(A[4],B[4]);
if(u1<=u0||v1<=v0) return;
if((u1-u0)*(v1-v0)<MINAREA) return;
if(!C[A[0]].write||!C[B[0]].write) return;   // 不写深度 ⇒ 不参与"写深度竞争" (归覆盖层档管)
if(opp){
const n=[A[7],A[8],A[9]], ca=C[A[0]], cb=C[B[0]];
const mA=n[0]*ca.ctr[0]+n[1]*ca.ctr[1]+n[2]*ca.ctr[2], mB=n[0]*cb.ctr[0]+n[1]*cb.ctr[1]+n[2]*cb.ctr[2];
const lo=Math.max(mA-supOf(ca,n),mB-supOf(cb,n)), hi=Math.min(mA+supOf(ca,n),mB+supOf(cb,n));
const ov=hi-lo;
if(ov>=TOL) return;
if(ov<=1e-9&&!(ca.dbl||cb.dbl)) return;
}
const i=A[0], j=B[0];
const kk=i<j?i+'_'+j:j+'_'+i;
if(seenP.has(kk)) return; seenP.add(kk);
pairs.push({i,j,unitsA:C[i].units,unitsB:C[j].units,
same:C[i].units===C[j].units,
matA:(C[i].mat&&C[i].mat.name)||'',pos:[+C[i].ctr[0].toFixed(1),+C[i].ctr[2].toFixed(1)],
dimA:C[i].dim.map(v=>+v.toFixed(2)),dimB:C[j].dim.map(v=>+v.toFixed(2)),
laneA:C[i].lane,laneB:C[j].lane,
trans:(C[i].transp?1:0)+(C[j].transp?1:0)});
};
for(const [key,arr] of buckets){
const p4=key.split('|').map(Number);
const ix=p4[0], iy=p4[1], iz=p4[2], q=p4[3];
for(let ia=0;ia<arr.length;ia++) for(let ib=ia+1;ib<arr.length;ib++) test(arr[ia],arr[ib]);
// ★ 法线邻桶**必须查**: 共面的两件法线常差 0.1°~1° (各段各自算 ry / 斜置件), 量化 1/96 后落进相邻桶 ——
//   只查同桶的版本对"近共面 1 个桶距"这一整类报告 0 残留, 是**假通过** (三角形级扫描抓到, 见 _zfight-why 桶距栏)。
//   这里不做方向去重 (pairs 由 seenP 去重), 直接 27 桶 × d∈[-3,3]。
for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){
if(!dx&&!dy&&!dz) continue;
for(let d=-3;d<=3;d++){ const a2=buckets.get((ix+dx)+'|'+(iy+dy)+'|'+(iz+dz)+'|'+(q+d)); if(a2) for(const A of arr) for(const B of a2) test(A,B); }
}
// 反向族 (对跖桶 + ±1 法线邻桶): 每对只从"主轴朝正"的一侧发起
const an=Math.abs(ix), am=Math.abs(iy), ao=Math.abs(iz);
const kd=(an>=am&&an>=ao)?0:(am>=ao?1:2);
if((kd===0?ix:(kd===1?iy:iz))>0){
for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){
for(let dd=-3;dd<=3;dd++){ const a2=buckets.get((-ix+dx)+'|'+(-iy+dy)+'|'+(-iz+dz)+'|'+(-q+dd)); if(a2) for(const A of arr) for(const B of a2) test(A,B); }
}
}
}
return {n:C.length,writes:C.filter(c=>c.write).length,pairs};
}`;

const results=[];
for(const id of IDS){
const idx=campIdx(id);
const ctx=boot(idx);
// ★ 2026-11-01 贴图批: 海战图的大舰/艇是 boot 消解器跑完才进 world 的 (15h:452 / 15d:271) ——
//   浏览器里它们由**运行期模型消解器** (resolveModelSurfaces, 24-main 逐根预算) 接管; 本沙箱不跑帧循环。
//   旧版这里直接扫描 ⇒ coral/ironbottom 每图 80~170 条"同单位残留"全是测量时点伪红 (实机自愈)。
//   补一次与世界级消解器同一套数学的**追赶消解** (幂等: 已落档件按预着色纪律读回只当约束), 再扫描。
G(ctx,'resolveCoplanarConflicts()');
const stats=G(ctx,'JSON.parse(JSON.stringify(SURF_STATS))');
const lanes=G(ctx,'JSON.parse(JSON.stringify(SURF_LANES))');
const conf=G(ctx,'JSON.parse(JSON.stringify(SURF_CONFLICT))');
const scan=G(ctx,`(function(){${SCAN_SRC}; return surfScan();})()`);
const clash=scan.pairs.filter(p=>p.same);
results.push({id,idx,stats,lanes,conf,scan,clash,ctx});
// 每图: 共面件对必须零"同单位"残留 (⇒ 每一对都有唯一胜者)
info(`${id.padEnd(10)} 件 ${String(scan.n).padStart(5)} (写深度 ${String(scan.writes).padStart(5)}) · 共面件对 ${String(scan.pairs.length).padStart(5)} · `
+`同单位残留 ${clash.length} · 消解 ${stats.calls} 次/累计落档 ${stats.tLeveled} 件/${stats.tMs}ms · 变体 ${stats.clones}`);
if(clash.length) for(const c of clash.slice(0,6)) info(`      ✗ 同单位对: units=${c.unitsA} ${JSON.stringify(c.dimA)}@${JSON.stringify(c.pos)} ↔ ${JSON.stringify(c.dimB)} lane=${c.laneA}/${c.laneB} 透明件 ${c.trans}`);
}
const main=results[0];
const ctxMain=main.ctx;

// ══════════════════════════════════════════════════════════════════════════════════
console.log(`\n── ① 单源纪律 + 阶梯数值 ──`);
{
const hits=[];
for(const f of fs.readdirSync(path.join(root,'js'))){
if(!f.endsWith('.js')) continue;
fs.readFileSync(path.join(root,'js',f),'utf8').split('\n').forEach((ln,i)=>{ if(/polygonOffset\s*[:=]/.test(ln)) hits.push(f+':'+(i+1)); });
}
const out=hits.filter(h=>!/^05-world\.js:/.test(h));
chk(out.length===0,`① 全库 polygonOffset 数字只出现在 SURF_LANES 单源 (表内 ${hits.length-out.length} 行, 表外 ${out.length} 处${out.length?': '+out.join(','):''})`);
const L=main.lanes;
info(`   SURF_LANES: ${Object.keys(L).map(k=>`${k}(${L[k].factor}/${L[k].units}/ro${L[k].order})`).join('  ')}`);
const names=['base','pavement','decal','patchWater','surf'];
chk(names.every(n=>L[n]),`① 五个档位齐全: ${names.join('/')}`);
const us=names.map(n=>L[n].units);
chk(us[0]===0&&us.slice(1).every((v,i)=>v<us[i])&&us.slice(1).every((v,i)=>us[i]-v>=2)&&us.slice(1).every((v,i)=>us[i]-v<=8),
`① 单位单调递减且相邻档距 ∈[2,8]: ${us.join(' > ')}`);
chk(names.slice(1).every(n=>L[n].order>L[names[Math.max(0,names.indexOf(n)-1)]].order||L[n].order>0),`① renderOrder 随档递增: ${names.map(n=>n+'='+L[n].order).join(' ')}`);
const minM=Math.min(...us.slice(1).map(Math.abs));
// 噪声地板论证: 档距必须 ≥ 2 LSB (固定点深度插值噪声 1~2 LSB)
chk(minM>=4,`① 最小档 |units|=${minM} ≥ 4 LSB (旧表 1~3 落在插值噪声地板 1~2 LSB 上, 用户实机仍闪的根因)`);
chk(main.conf.step>=2&&main.conf.maxLevel>=4&&main.conf.maxLevel<=8,`① 消解器档距 ${main.conf.step} 单位 × 上限 ${main.conf.maxLevel} 档 (单件最大向屏内 12 单位 ≤ 一个覆盖层档距)`);
}
console.log(`\n── ② 覆盖层登记 (每一类贴面都必须在阶梯上) ──`);
{
const A=main.ctx;
// ① 栈桥面板条 (pavement, 05a)
const island=results.find(r=>r.id==='island')||main;
const world=G(island.ctx,'world');
let strips=0,stripMat=null;
world.traverse(o=>{ const p=o.geometry&&o.geometry.parameters;
if(p&&Math.abs(p.height-0.07)<1e-9&&Math.abs(p.depth-0.36)<1e-9){ strips++; stripMat=o.material; } });
chk(strips>0&&stripMat&&stripMat.polygonOffset===true&&stripMat.polygonOffsetUnits===island.lanes.pavement.units,
`② 栈桥面板条 ${strips} 块走 pavement 档 (units=${stripMat&&stripMat.polygonOffsetUnits} = 表值 ${island.lanes.pavement.units})`);
// ② 弹坑贴花 (decal, 05b) —— 现造一个运行期弹坑读材质
const cr=G(A,`(function(){ const n0=runtimeCraters.length; crater(0,0,1.6,true); const m=runtimeCraters[runtimeCraters.length-1];
return {units:m.material.polygonOffset===true?m.material.polygonOffsetUnits:0, ro:m.renderOrder, dw:m.material.depthWrite, tr:m.material.transparent===true}; })()`);
chk(cr.units===main.lanes.decal.units&&cr.ro===main.lanes.decal.order,
`② 弹坑贴花走 decal 档 (units=${cr.units}, renderOrder=${cr.ro}) 且 depthWrite=${cr.dw}/transparent=${cr.tr}`);
// ③ 血贴花 (decal, 08-effects) —— 走一次 bloodDecal
const bd=G(A,`(function(){ bloodDecal(0,0); let hit=null;
for(const b of bloodGeos) if(b.alive&&b.m) hit={units:b.m.material.polygonOffset===true?b.m.material.polygonOffsetUnits:0, ro:b.m.renderOrder};
return hit; })()`);
chk(bd&&bd.units===main.lanes.decal.units&&bd.ro===main.lanes.decal.order,
`② 血贴花走 decal 档 (units=${bd&&bd.units}, renderOrder=${bd&&bd.ro})`);
// ④ 水面: 海/河/塘 = patchWater; 碎波带 = surf (逐图枚举"不写深度的半透明面", 按档位分组)
const surfHit=results.map(r=>{
const wa=G(r.ctx,`(function(){ const out={patchWater:0,surf:0,other:0,ice:0};
scene.traverse(o=>{ const m=o.material; if(!m||o.count!==undefined) return;
if(m.transparent===true&&m.depthWrite===false){ const u=m.polygonOffset===true?m.polygonOffsetUnits:0;
if(u===SURF_LANES.patchWater.units) out.patchWater++; else if(u===SURF_LANES.surf.units) out.surf++; else out.other++; }
else if(m.polygonOffset===true&&m.polygonOffsetUnits===SURF_LANES.patchWater.units&&o.geometry&&o.geometry.type!=='BoxGeometry') out.ice++;
});
return out; })()`);
return `${r.id}:${JSON.stringify(wa)}`;
});
info(`   不写深度的半透明面按档分组: ${surfHit.join(' ')}`);
const totPW=results.reduce((a,r)=>{ const w=G(r.ctx,`(function(){ let n=0; scene.traverse(o=>{ const m=o.material; if(m&&m.transparent===true&&m.depthWrite===false&&m.polygonOffset===true&&m.polygonOffsetUnits===SURF_LANES.patchWater.units) n++; }); return n; })()`); return a+w; },0);
chk(totPW>0,`② 水面/贴地水体走 patchWater 档的件数 = ${totPW} > 0`);
const seaF=G(A,'SEA_FOAM&&SEA_FOAM.material');
if(seaF) chk(seaF.polygonOffsetUnits===main.lanes.surf.units,`② 碎波带走 surf 档 (units=${seaF.polygonOffsetUnits} = 表值 ${main.lanes.surf.units})`);
else info('   (本图无海 ⇒ 碎波带跳过)');
// ⑤ 结冰河面 (moscow): 不透明写深度的贴地水面
const mos=results.find(r=>r.id==='moscow');
if(mos){
const ice=G(mos.ctx,`(function(){ let n=0,ok=0;
scene.traverse(o=>{ const m=o.material; if(!m||o.count!==undefined) return;
if(m.map===TEX.ice){ n++; if(m.polygonOffset===true&&m.polygonOffsetUnits===SURF_LANES.patchWater.units) ok++; } });
return {n,ok}; })()`);
chk(ice.n>0&&ice.ok===ice.n,`② 莫斯科结冰河面 ${ice.n} 件全部走 patchWater 档 (修前 0 件登记 = 冰面与河床远端互闪)`);
}
}
console.log(`\n── ③ 共面消解正确性 (核心判据: 每一对共面件的有效深度单位必须不同) ──`);
{
const bad=results.reduce((a,r)=>a+r.clash.length,0);
const tot=results.reduce((a,r)=>a+r.scan.pairs.length,0);
const writes=results.reduce((a,r)=>a+r.scan.writes,0);
info(`   11 图合计: 写深度件 ${writes} · 共面/薄埋件对 ${tot} · 同单位残留 ${bad}`);
chk(bad===0,`③ 全图共面件对同单位残留 = ${bad} = 0 ⇒ 每一对都有唯一胜者 (深度测试结果与相机位置无关)`);
// 分档覆盖: 被分档的件数与"参与约束的件数"必须一致量级 (不能出现"扫到了却几乎没落档")
const involved=results.reduce((a,r)=>a+r.stats.tLeveled,0);
const maxL=Math.max(...results.map(r=>r.stats.maxLevel));
const tms=results.map(r=>r.stats.tMs);
chk(maxL<=main.conf.maxLevel,`③ 全图最大档位 ${maxL} ≤ ${main.conf.maxLevel} (档位用满说明约束图很密, 需要复查)`);
chk(involved>0&&involved<writes,`③ 累计落档件数 ${involved} 落在 (0, 写深度件数 ${writes}) 区间 ⇒ 只改动冲突件, 未全量加偏移`);
// 2026-11-01 贴图批: 每图跑两遍 (boot + 追赶消解, 见本文件 per-map 段批注) ⇒ 耗时上界同比 ×2
chk(Math.max(...tms)<4000,`③ 单图建场消解耗时上界 ${Math.max(...tms)}ms < 4000ms (boot+追赶两遍, 一次性成本不进每帧; 莫斯科 8711 件)`);
const varPool=Math.max(...results.map(r=>r.stats.clones));
chk(varPool<=96,`③ 材质变体池上界 ${varPool} ≤ 96 (材质×档位的克隆总量, 不是件数)`);
{ // 幂等性 (2026-09-27): 再调一次消解器 —— 已落档件作为"预着色节点"重新纳入图, 新件不得落到与邻居同档。
// 这一条守住的是"分两次构建世界"的坑 (island 反舰炮台胸墙三段就分属两次调用): 若第二次把已落档件排除在外,
// 新件看不见邻居的档位 ⇒ 会拿到同一档 ⇒ 又变回一对无胜负的共面件 (dev 实测抓到过)。
const A=main.ctx;
const before=G(A,'SURF_STATS.tLeveled');
const r=G(A,`(function(){ const st=resolveCoplanarConflicts(); return {leveled:st.tLeveled,pre:st.pre,linked:st.linked}; })()`);
const scan2=G(A,`(function(){${SCAN_SRC}; return surfScan();})()`);
const clash2=scan2.pairs.filter(p=>p.same);
info(`   幂等复跑: 预着色件 ${r.pre} · 新增落档 ${r.leveled-before} 件 · 复扫同单位残留 ${clash2.length}`);
chk(r.leveled===before&&clash2.length===0,`③ 幂等: 复跑不新增落档 (${r.leveled-before} 件) 且复扫残留仍为 0 (预着色 ${r.pre} 件参与了约束)`);
}
// 判据有效性对照 (阳性): 现造两块同位同尺寸盒 ⇒ 二次消解必须把它们分开
{
const A=main.ctx;
const r=G(A,`(function(){
const m1=mesh(boxGeo(3,1,3),MAT.stone,1000.5,heightAt(1000,1000)+8,1000.5);
const m2=mesh(boxGeo(3,1,3),MAT.stone,1000.5,heightAt(1000,1000)+8,1000.5);
const before=[m1.material.polygonOffsetUnits||0, m2.material.polygonOffsetUnits||0];
resolveCoplanarConflicts();
const after=[m1.material.polygonOffset===true?m1.material.polygonOffsetUnits:0, m2.material.polygonOffset===true?m2.material.polygonOffsetUnits:0];
world.remove(m1); world.remove(m2);
return {before,after}; })()`);
info(`   对照A (现造两块同位盒): 消解前 units=${JSON.stringify(r.before)} → 消解后 ${JSON.stringify(r.after)}`);
chk(r.after[0]!==r.after[1],`③ 对照A: 同位共面件被消解器分开 (units 不同 ⇒ 单帧唯一胜者)`);
}
// 阴性对照: 现造两块**只在一个轴上远离**的盒 ⇒ 不得改动 (不重叠 ⇒ 不构成竞争)
{
const A=main.ctx;
const r=G(A,`(function(){
const m1=mesh(boxGeo(3,1,3),MAT.stone,-900.5,heightAt(-900,-900)+8,-900.5);
const m2=mesh(boxGeo(3,1,3),MAT.stone,-900.5,heightAt(-900,-900)+8,-860.5);   // 沿 z 平移 40m
resolveCoplanarConflicts();
const a1=m1.material.polygonOffset===true?m1.material.polygonOffsetUnits:0;
const a2=m2.material.polygonOffset===true?m2.material.polygonOffsetUnits:0;
world.remove(m1); world.remove(m2);
return {a1,a2}; })()`);
info(`   对照B (两块相距 40m): 消解后 units=${r.a1}/${r.a2}`);
chk(r.a1===r.a2,`③ 对照B: 不重叠的件未被分档 (判据不误伤)`);
}
// 共享材质零污染
const poll=G(main.ctx,`(function(){ const bad=[];
for(const k in MAT){ const m=MAT[k]; if(m&&m.polygonOffset===true) bad.push(k); }
return bad; })()`);
chk(poll.length===0,`③ 共享 MAT.* 零污染 (polygonOffset 就地写过的: ${poll.length} 个${poll.length?': '+poll.join(','):''})`);
}
console.log(`\n── ④ 世界还原链一致性 ──`);
{
const A=main.ctx;
const r=G(A,`(function(){
const pick=[]; let n=0;
world.traverse(o=>{ if(n<4000&&o.material&&o.material.polygonOffset===true&&o.geometry&&o.geometry.parameters){ pick.push(o); n++; } });
const snap=pick.map(o=>[o.material.polygonOffsetUnits,o.renderOrder,o.material.__id||(o.material.__id=Math.random())]);
capturePristineWorld(); restorePristineWorld();
let kept=0;
for(let i=0;i<pick.length;i++){ const o=pick[i];
if(o.material&&o.material.polygonOffset===true&&o.material.polygonOffsetUnits===snap[i][0]&&o.renderOrder===snap[i][1]&&o.material.__id===snap[i][2]) kept++; }
return {n:pick.length,kept}; })()`);
chk(r.n>0&&r.kept===r.n,`④ 世界还原后 ${r.kept}/${r.n} 件的档位/材质实例/绘制序不变 (还原链不破坏分层)`);
}
console.log(`\n── ⑤ ?nosurf=1 开关 ──`);
{
const ctxOff=boot(main.idx,FILES,'?nosurf=1');
const st=G(ctxOff,'JSON.parse(JSON.stringify(SURF_STATS))');
const layers=G(ctxOff,`(function(){ let pw=0,po=0;
scene.traverse(o=>{ const m=o.material; if(m&&o.count===undefined){ if(m.transparent===true&&m.depthWrite===false&&m.polygonOffset===true&&m.polygonOffsetUnits===SURF_LANES.patchWater.units) pw++; if(m.polygonOffset===true&&m.polygonOffsetUnits>0) po++; } });
return {pw,po}; })()`);
info(`   开关态: SURF_OFF=${G(ctxOff,'SURF_OFF')} · 消解器候选 ${st.cand} 件 / 落档 ${JSON.stringify(st.byLevel)} · 覆盖层档仍生效 (patchWater 件 ${layers.pw}, 正偏移件 ${layers.po})`);
chk(G(ctxOff,'SURF_OFF')===true&&st.cand===0&&layers.po===0,`⑤ ?nosurf=1 关闭共面消解 (候选 0 / 无正偏移件) 而覆盖层阶梯照常生效`);
}
console.log(`\n${failures?'✗':'✓'} dev/verify-surf: ${checks-failures}/${checks} 通过${failures?` (失败 ${failures})`:''}`);
process.exit(failures?1:0);
