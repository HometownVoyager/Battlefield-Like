// ─────────────────────────────────────────────
// dev/verify-tread-20260927.js —— 坦克行走机构外观验收 (2026-09-28 带环口径重写)
//   ①履带 = 绕轮的**闭合带** (不再是实心盒); ②花纹只在带环外表面、沿环向滚动;
//   ③**侧视图上轮子必须看得见** (带环/裙板都不得盖住轮面); ④裙板 = 独立分片挂翼板外侧
// 用法: node dev/verify-tread-20260927.js
//
// 背景 (用户三次实报, 本批是第三次):
//   ①"现在坦克的履带是水平方向布置和运转的，和现实情况的位相呈垂直" —— 旧版用整张贴图转 90°,
//     只能摆正一面 (±X 侧面), 却把顶/底/前后断面全拧歪 (真实履带在这四个面上都应是**横跨带宽、
//     沿环向排开**);
//   ②"坦克的轮子侧面处仍有履带! 可以是裙甲之类的, 不能是履带" —— 旧版履带是一个 (trkW×1.12×L+0.25)
//     的实心盒, 它的 ±X 面就是行走机构的最外一层, 侧面看整条车下缘都是履带花纹;
//   ③"现在裙甲是一整个侧面且让坦克轮穿模凸出来了 …… 请完全重新设计履带和裙甲" —— 把盒子的 ±X 面
//     改喷装甲板之后, 轮子要露出来就只好横向外移 6cm, 于是从侧板里穿模凸出。
//
// 现口径 (与真实坦克同构, 见 15-vehicles.tankBuildGear 表头): 轮 + 绕轮的**带** + 独立裙板
//   · 带环侧视轮廓 = 接地段直线 + 两端圆弧 (主动轮/诱导轮) + 回程段直线 (+端轮抬起时的切线段);
//   · 花纹只铺在**带环外表面**且在 UV 里沿**环向**排开 ⇒ 整条环同步滚动, 侧面上没有花纹;
//   · 负重轮/端轮都在带环**之内** (轮面比带外沿内收 1cm) ⇒ 侧视 = 一条细带 + 一排清晰的轮;
//   · 裙板是独立分片挂在**翼板外侧** (外沿 = 整车半宽), 下缘停在轮心略上方。
//
// 本探针量的是**行为**(几何/材质/UV, 不是源码文本): 载入真 three r152, 用游戏自己的
//   Tank.prototype.buildMesh 建模, 再逐条量:
//   ① 结构: 两条履带共用一份几何 + 2 段材质 (0=花纹段 / 1=金属段) + 几何是**闭合环**;
//   ② 花纹环向: 花纹段 (段 0) 上花纹条**横跨带宽** (同一环向站位的两顶点 UV.v 相同), 且
//      v 沿环向单调 (接地段 v 随 z 递减 ⇒ 前进时花纹相对车体向后走), 条距 8 条/贴 ∈ [15,24]cm;
//   ③ **侧视可见度** (用户报的核心): 把带环的 ±X 侧面投影到 YZ 平面, 量它对每个负重轮圆面的
//      遮盖率 —— 必须 <25% (只压住轮顶/轮底的两条窄带); 旧版实心盒 = 100% (阴性对照见 ⑨);
//   ④ 不穿模: 轮面外沿 ≤ 带环外沿; 带环内底面 = 轮底 (轮压在带上); 回程段内面高于轮顶 (留悬挂行程);
//   ⑤ 端轮: 带环两端圆弧的半径/圆心 = 端轮半径/圆心 (端轮嵌在环内), 且端轮不是独立 Mesh (烘在几何里);
//   ⑥ 裙板 (skirt>0): 独立单网格 + 分片 (按 z 聚类数 = skirt×2) + 外沿 = halfW + 内面在带环外沿之外
//      + 与翼板不重叠 + 下缘高于轮心;
//   ⑦ 纹理矩阵退出 (repeat=1/rotation=0) + 环长取整贴 (环长/每贴 = 整数 ⇒ 闭合处无缝);
//   ⑧ 滚动方向: 源码的 offset 符号 vs 几何里接地段 dv/dz 的符号必须**同号** (两者都反 = 前进时
//      接地段花纹朝前跑 = 倒转) —— 这条把"符号"与"UV 方向"锁在一起, 单独改哪个都会报红;
//   ⑨ 阴性对照: 用**旧写法** (实心盒 + ±X 面装甲板 + 轮外移) 重跑 ③④ 两条, 必须报红。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const stub=require('./_bootstub.js');
const root=path.resolve(__dirname,'..');
const FILES=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/22a-menuart.js','js/23-deploy.js','js/23b-worldrestore.js','js/24-main.js'];
const RENDERER_STUB=`
class StubRenderer{
constructor(o){ this.domElement=(o&&o.canvas)||document.createElement('canvas'); this.domElement.style=this.domElement.style||{};
this.shadowMap={enabled:false,type:0,autoUpdate:true}; this.info={render:{calls:0,triangles:0},memory:{}};
this.capabilities={isWebGL2:true,getMaxAnisotropy:()=>4,maxTextureSize:4096,maxTextures:16};
this.xr={enabled:false,isPresenting:false,addEventListener(){},removeEventListener(){}}; this.autoClear=true; }
setSize(){} setPixelRatio(){} setViewport(){} setScissor(){} setScissorTest(){} render(){} clear(){} clearDepth(){}
setClearColor(){} setClearAlpha(){} dispose(){} setAnimationLoop(){} compile(){return new Set();}
getContext(){return null;} getRenderTarget(){return null;} setRenderTarget(){} readRenderTargetPixels(){}
copyFramebufferToTexture(){} initTexture(){} resetState(){} getDrawingBufferSize(){return {x:1,y:1};}
getSize(t){ if(t) t.set(1280,720); return {width:1280,height:720}; } getPixelRatio(){return 1;}
}
THREE.WebGLRenderer=StubRenderer;
`;
function boot(campIdx){
for(const k in stub.byId) delete stub.byId[k];
const ctx=vm.createContext(Object.assign({},stub.sandbox));
ctx.document=stub.document; ctx.window=stub.window;
ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
vm.runInContext(fs.readFileSync(path.join(root,'dev/vendor/three.min.js'),'utf8'),ctx,{filename:'three.min.js'});
vm.runInContext('THREE = globalThis.THREE;',ctx,{filename:'bind-three'});
vm.runInContext(RENDERER_STUB,ctx,{filename:'stub-renderer'});
for(const f of FILES) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
return ctx;
}
// ── 取样器 (页内): 真建模 → 几何/UV/材质/站位全量导出 ──
const SAMPLER=`
function __gear(fid,vi){
const D=FACTIONS[fid].tanks[vi], S=tkSpec(D,D.tk);
const T={ def:D, variant:vi, team:0, name:D.name, wheels:[], pos:V3() };
T.buildMesh=Tank.prototype.buildMesh; T.buildMesh.call(T);      // 真·整车建模
const tex=T.trackTex; tex.updateMatrix(); const me=tex.matrix.elements;
const mapUV=(u,v)=>({u:me[0]*u+me[3]*v+me[6], v:me[1]*u+me[4]*v+me[7]});
const bands=[], skirtM=[], fendM=[];
T.grp.traverse(o=>{ if(!o.isMesh) return;
if(o.name==='trackBand') bands.push(o);
else if(o.name==='skirt') skirtM.push(o);
else if(o.name==='fender') fendM.push(o);
});
const pack=o=>{
const g=o.geometry, p=g.attributes.position, n=g.attributes.normal, uv=g.attributes.uv, ix=g.index;
const segOf=[]; for(const gr of g.groups) for(let i=gr.start;i<gr.start+gr.count;i++) segOf[ix.getX(i)]=gr.materialIndex;
const tri=[];
for(let t=0;t<ix.count;t+=3){
const id=[ix.getX(t),ix.getX(t+1),ix.getX(t+2)];
const mi=segOf[id[0]]!==undefined?segOf[id[0]]:0;
const q=[];
for(const i of id){ const m=mapUV(uv.getX(i),uv.getY(i));
q.push({x:+p.getX(i).toFixed(5),y:+p.getY(i).toFixed(5),z:+p.getZ(i).toFixed(5),
nx:+n.getX(i).toFixed(4),ny:+n.getY(i).toFixed(4),nz:+n.getZ(i).toFixed(4),
u:+m.u.toFixed(5),v:+m.v.toFixed(5)}); }
tri.push({mi,x:o.position.x,q});
}
let mnx=1e9,mxx=-1e9,mny=1e9,mxy=-1e9,mnz=1e9,mxz=-1e9;
for(let i=0;i<p.count;i++){ const X=p.getX(i),Y=p.getY(i),Z=p.getZ(i);
mnx=Math.min(mnx,X); mxx=Math.max(mxx,X); mny=Math.min(mny,Y); mxy=Math.max(mxy,Y); mnz=Math.min(mnz,Z); mxz=Math.max(mxz,Z); }
const px=o.position.x,py=o.position.y,pz=o.position.z;
return {pos:[px,py,pz],box:[mnx+px,mxx+px,mny+py,mxy+py,mnz+pz,mxz+pz],tri,
groups:g.groups.map(q=>[q.start,q.count,q.materialIndex]),nTri:ix.count/3,
isBuf:g.type==='BufferGeometry',ud:g.userData?{tileLen:g.userData.tileLen,circ:g.userData.circ,stations:g.userData.stations,tb:g.userData.tb,tbTh:g.userData.tbTh}:null};
};
const mp=(typeof matTone!=='undefined')?1:0;
return {name:D.name,tile:+T.trackTileLen.toFixed(5),bands:bands.map(pack),skirt:skirtM.map(pack),fender:fendM.map(pack),
 tex:{wrapS:tex.wrapS,repX:tex.repeat.x,repY:tex.repeat.y,rot:tex.rotation},
 mats:{n:T.trkMats.length,trackIsMapped:T.trkMats[0].map===tex,darkIsTrack:T.trkMats[1].map===tex},
 S:{L:S.L,hullY:S.hullY,hullH:S.hullH,trkW:S.trkW,trkSx:S.trkSx,whR:S.whR,whN:S.whN,whW:S.whW,whY:S.whY,halfW:S.halfW,fendW:S.fendW,fendY:S.fendY,
    tb:S.tb,tbTh:S.tbTh,skirt:S.skirt},
 wheels:T.wheels.map(w=>({x:w.position.x,y:w.position.y,z:w.position.z,r:w.geometry.parameters.radiusTop,h:w.geometry.parameters.height,lz:w.userData.lz})),
 nMesh:(()=>{let n=0;T.grp.traverse(o=>{if(o.isMesh)n++});return n})()};
}
`;
const ctx=boot(2);
const Q=s=>vm.runInContext(s,ctx);
vm.runInContext(SAMPLER,ctx,{filename:'sampler'});
// ── 断言 ──
let pass=0,fail=0;
const chk=(c,msg)=>{ if(c){ pass++; console.log('  ✓ '+msg); } else { fail++; console.log('  ✗ '+msg); } };
// YZ 平面: 点是否落在三角形内 (用于"带环侧面盖住多少轮面"的量化)
function ptInTri(z,y,t){
const [[az,ay],[bz,by],[cz,cy]]=t.map(p=>[p.z,p.y]);
const d=(by-cy)*(az-cz)+(cz-bz)*(ay-cy);
if(Math.abs(d)<1e-12) return false;
const a=((by-cy)*(z-cz)+(cz-bz)*(y-cy))/d, b=((cy-ay)*(z-cz)+(az-cz)*(y-cy))/d, c=1-a-b;
return a>=-1e-9&&b>=-1e-9&&c>=-1e-9;
}
// 轮面被带环 ±X 侧面遮盖的比例 (网格采样; 圆面内均匀取 N×N)
function wheelCover(sideTris,cy,cz,r,N){
let hit=0, n=0;
for(let i=0;i<N;i++) for(let j=0;j<N;j++){
const z=cz-r+(i+0.5)/N*2*r, y=cy-r+(j+0.5)/N*2*r;
if((z-cz)*(z-cz)+(y-cy)*(y-cy)>r*r) continue;
n++;
if(sideTris.some(t=>ptInTri(z,y,t))) hit++;
}
return n?hit/n:0;
}
const near=(a,b,tol)=>Math.abs(a-b)<=tol;
const TANKS=[['us',0,'M4 谢尔曼'],['us',1,'M26 潘兴'],['ger',0,'四号坦克'],['ger',1,'黑豹'],
 ['sov',0,'T-34/76'],['sov',1,'KV-1'],['jp',0,'九七式'],['jp',1,'一一式'],
 ['kmt',0,'维克斯6吨'],['kmt',1,'T-26'],['cpc',0,'九七式(缴获)'],['cpc',1,'一式(缴获)']];
console.log('── 坦克行走机构 (真 three r152 · 真建模段 Tank.prototype.buildMesh) ──');
for(const [fid,vi,tag] of TANKS){
const r=Q(`__gear('${fid}',${vi})`);
const tb=r.S.tb, b=r.bands[0];
if(!b){ chk(false,tag+' 没有履带带环网格'); continue; }
console.log(`  ${tag} (带宽 ${r.S.trkW.toFixed(3)}m 环长 ${b.ud.circ.toFixed(2)}m 每贴 ${r.tile.toFixed(3)}m 站数 ${b.ud.stations} 网格 ${r.nMesh})`);
// ① 结构
chk(r.bands.length===2&&r.bands[0].ud.circ===r.bands[1].ud.circ, `  ${tag} 两条带环 + 共用几何 (环长一致)`);
chk(b.isBuf, `  ${tag} 履带是自建带环几何 (BufferGeometry), 不是实心盒`);
chk(r.mats.n===2&&r.mats.trackIsMapped&&!r.mats.darkIsTrack, `  ${tag} 2 段材质: [0]=履带花纹 / [1]=金属 (无花纹) [段数=${r.mats.n}]`);
chk(b.groups.length===2&&b.groups[0][2]===0&&b.groups[1][2]===1, `  ${tag} 材质分段 = [花纹段, 金属段] [${JSON.stringify(b.groups.map(g=>g[2]))}]`);
chk(near(b.groups[0][1]/6, b.ud.stations, 1e-6), `  ${tag} 花纹段只覆盖"外表面" (${b.groups[0][1]/6} 个三角 = 站数 ${b.ud.stations} × 2)`);
// ② 花纹环向 (花纹段的 v 只随环向变; 同一站位的两个横向顶点 v 相同 ⇒ 花纹条横跨带宽)
const tread=b.tri.filter(t=>t.mi===0);
let acrossBad=0, dz=0, dv=0;
for(const t of tread){
const L=t.q.filter(p=>p.x<0), R=t.q.filter(p=>p.x>0);
if(L.length&&R.length) for(const a of L){ const bb=R.find(c=>near(c.z,a.z,1e-3)&&near(c.y,a.y,1e-3)); if(bb&&!near(bb.v,a.v,1e-4)) acrossBad++; }
}
// 接地段 (法线朝下、贴在最低处) 的 dv/dz 斜率
const ground=tread.filter(t=>t.q.every(p=>p.ny<-0.9&&near(p.y,tb.yLow-r.S.tbTh,5e-3)));
for(const t of ground){ for(let i=0;i<3;i++)for(let j=i+1;j<3;j++){ const a=t.q[i],bq=t.q[j];
if(!near(a.x,bq.x,1e-4)) continue; const dzp=bq.z-a.z, dvp=bq.v-a.v;
if(Math.abs(dzp)>1e-3){ dz+=Math.abs(dzp); dv+=Math.abs(dvp); } } }
chk(tread.length>0&&acrossBad===0, `  ${tag} 花纹条横跨带宽 (同站位左右两顶点 UV.v 相同) [${tread.length} 个花纹面, 不一致 ${acrossBad}]`);
const dvdz=ground.length?((()=>{ // 用接地段的两个端点站求 v 对 z 的符号
const pts=ground.flatMap(t=>t.q).filter(p=>p.ny<-0.9);
const lo=pts.reduce((a,b)=>b.z<a.z?b:a), hi=pts.reduce((a,b)=>b.z>a.z?b:a);
return (hi.v-lo.v)/((hi.z-lo.z)||1e-9); })()):0;
chk(ground.length>0&&dvdz<0, `  ${tag} 接地段花纹沿车长排开且 v 随 z 递减 (前进时相对车体向后走) [dv/dz=${dvdz.toFixed(4)}]`);
const spacing=r.tile/8;
chk(spacing>0.15&&spacing<0.24, `  ${tag} 条距 ${(spacing*100).toFixed(1)}cm ∈ [15,24]cm`);
// ③ 侧视可见度 (核心判据: 带环侧面不得盖住轮面)
const side=b.tri.filter(t=>t.mi===1&&t.q.some(p=>Math.abs(p.nx)>0.9));
const sideF=side;
let worst=0, worstWh=null;
for(const w of r.wheels.filter(w=>w.x>0)){ const c=wheelCover(sideF.map(t=>t.q.map(p=>({z:p.z,y:p.y}))),w.y,w.z,w.r,26);
if(c>worst){ worst=c; worstWh=w; } }
chk(worst<0.25, `  ${tag} 侧视可见度: 带环侧面盖住负重轮面 ≤25% [实测最大 ${(worst*100).toFixed(1)}% @ z=${worstWh?worstWh.z.toFixed(2):'-'}]`);
// ④ 不穿模 + 几何口径
const trkOut=r.S.trkSx+r.S.trkW/2;
chk(r.wheels.every(w=>Math.abs(w.x)+w.h/2<=trkOut+1e-6), `  ${tag} 轮面外沿 ≤ 带环外沿 (${trkOut.toFixed(3)}) —— 轮在带内, 不穿模`);
chk(r.wheels.every(w=>near(w.y-w.r,tb.yLow,1e-6)), `  ${tag} 带环内底面 = 轮底 (${tb.yLow.toFixed(3)}) —— 轮压在带上`);
chk(near(b.box[2],tb.yLow-r.S.tbTh,1e-6)&&near(b.box[3],tb.yTop+r.S.tbTh,1e-6), `  ${tag} 带环外底面 ${b.box[2].toFixed(3)} / 顶面 ${b.box[3].toFixed(3)} (接地间隙与旧口径一致)`);
{ const fy=r.fender[0]?r.fender[0].box[3]-r.fender[0].box[2]:0;
const y0=r.S.hullY-r.S.hullH/2, y1=r.S.hullY+r.S.hullH/2;
chk(r.fender[0]&&fy>0.05&&fy<0.12&&r.fender[0].box[2]>y0&&r.fender[0].box[3]<y1,
  `  ${tag} 翼板 (0.08 薄板) 贴在车体侧面区间内 [翼板 y ${r.fender[0]?r.fender[0].box[2].toFixed(2)+'~'+r.fender[0].box[3].toFixed(2):'-'}, 车体侧 ${y0.toFixed(2)}~${y1.toFixed(2)}]`); }
chk(tb.yTop-(r.S.whY+r.S.whR)>0.02, `  ${tag} 回程段内面高于轮顶 ${(tb.yTop-(r.S.whY+r.S.whR)).toFixed(3)}m (悬挂上跳不顶出带面)`);
// ⑤ 端轮嵌在带环两端 (几何里能取到半径=端轮半径、圆心=端轮圆心的圆周点)
const circPts=r.S.tb, near2=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const ends=[[circPts.yF,circPts.zF,circPts.rF],[circPts.yR,circPts.zR,circPts.rR]];
let endWheelOk=true, endFit=[];
for(const [cy,cz,cr] of ends){
let best=1e9, hit=null;
for(const p of b.tri.flatMap(t=>t.q)){ if(Math.abs(p.x)>r.S.trkW*0.4) continue;
const d=Math.abs(Math.hypot(p.y-cy,p.z-cz)-cr); if(d<best){ best=d; hit=p; } }
endFit.push(+best.toFixed(4));
if(best>0.02) endWheelOk=false;
}
chk(endWheelOk, `  ${tag} 端轮 (主动轮/诱导轮) 嵌入带环两端圆弧 [半径吻合误差 ${endFit.join('/')}]`);
chk(Math.abs(b.box[5]-(Math.max(tb.zF+tb.rF,tb.cR)+r.S.tbTh))<0.02, `  ${tag} 带环鼻端 = 前伸 ${(b.box[5]-r.S.L/2).toFixed(3)}m (车头外 0.10m)`);
// ⑥ 裙板
if(r.S.skirt>0){
const sk=r.skirt[0];
chk(r.skirt.length===1, `  ${tag} 裙板 = 单个网格 (${r.S.skirt} 片/侧合并: ${sk.nTri} 三角)`);
const zs=[...new Set(sk.tri.flatMap(t=>t.q.map(p=>+p.z.toFixed(3))))].sort((a,b)=>a-b);
let panels=0, prev=null;
for(const z of zs){ if(prev===null||z-prev>0.02) panels++; prev=z; }
chk(panels===r.S.skirt*2, `  ${tag} 裙板分片数 = ${r.S.skirt}×2 [按 z 聚类实测 ${panels}]`);
chk(near(sk.box[1],r.S.halfW,1e-6)&&near(sk.box[0],-r.S.halfW,1e-6), `  ${tag} 裙板外沿 = 整车半宽 ${r.S.halfW.toFixed(3)} (推力框口径单源)`);
chk(Math.abs(sk.box[0])-0.045>trkOut+1e-6, `  ${tag} 裙板内面 ${(Math.abs(sk.box[0])-0.045).toFixed(3)} 在带环外沿 ${trkOut.toFixed(3)} 之外 (不共面/不穿模)`);
chk(sk.box[2]>r.S.whY&&sk.box[2]<r.S.whY+r.S.whR, `  ${tag} 裙板下缘 ${sk.box[2].toFixed(3)} 在轮心与轮顶之间 (露下半截轮)`);
chk(near(sk.box[3],r.S.fendY+0.04,1e-6), `  ${tag} 裙板上缘 ${sk.box[3].toFixed(3)} = 翼板顶面 ${(r.S.fendY+0.04).toFixed(3)} (从翼板下挂, 不高过翼板 —— 2026-09-28 用户实报"太高"修)`);
const fn=r.fender[0];
chk(fn&&Math.abs(fn.box[0])<Math.abs(sk.box[0])-0.045+1e-6, `  ${tag} 翼板外沿 ${fn?Math.abs(fn.box[0]).toFixed(3):'-'} < 裙板内面 ${(Math.abs(sk.box[0])-0.045).toFixed(3)} (两件不重叠)`);
}else{
chk(r.skirt.length===0, `  ${tag} 无裙板档 (skirt=0) ⇒ 不生成裙板网格`);
const fn=r.fender[0];
const fedge=fn?Math.max(Math.abs(fn.box[0]),Math.abs(fn.box[1])):0;
chk(fn&&near(fedge,r.S.halfW,1e-6), `  ${tag} 翼板外沿 = 整车半宽 ${r.S.halfW.toFixed(3)} [实测 ${fedge.toFixed(3)}]`);
}
// ⑦ 纹理矩阵 + 环长取整贴
chk(r.tex.repX===1&&r.tex.repY===1&&r.tex.rot===0, `  ${tag} 纹理矩阵已退出 (repeat=1/rotation=0), 方向全在 UV 里`);
const tiles=b.ud.circ/r.tile;
chk(Math.abs(tiles-Math.round(tiles))<1e-4, `  ${tag} 环长 = 整数贴 (${tiles.toFixed(4)} 贴) ⇒ 闭合处花纹对齐无缝`);
chk(r.wheels.length===2*r.S.whN, `  ${tag} 负重轮 ${r.wheels.length} = 两侧 × ${r.S.whN}`);
chk(r.wheels.every(w=>near(w.r,r.S.whR,1e-9)), `  ${tag} 轮径 = config whR (数据单源)`);
}
// ⑧ 滚动方向: 源码 offset 符号 与 接地段 dv/dz 符号 必须同号
console.log('── ⑧ 滚动方向闭环 (源码符号 × 几何 UV 方向) ──');
{
const src=fs.readFileSync(path.join(root,'js/15-vehicles.js'),'utf8');
const minus=/this\.trackTex\.offset\.y-=\s*this\.vel\*dt\/\(this\.trackTileLen/.test(src);
const plus=/this\.trackTex\.offset\.y\+=\s*this\.vel\*dt\/\(this\.trackTileLen/.test(src);
const r0=Q(`__gear('us',0)`);
const tb0=r0.S.tb, tread=r0.bands[0].tri.filter(t=>t.mi===0);
// 只取"整三角都贴在外底面"的那一对 (接地段闭合面): 用三角级过滤, 免得把第 0 站非反卷副本 (v=0) 混进来
const groundTri=tread.filter(t=>t.q.every(p=>p.ny<-0.9&&near(p.y,tb0.yLow-r0.S.tbTh,5e-3)));
const pts=groundTri.flatMap(t=>t.q);
const lo=pts.reduce((a,b)=>b.z<a.z?b:a), hi=pts.reduce((a,b)=>b.z>a.z?b:a);
const dvdz=(hi.v-lo.v)/((hi.z-lo.z)||1e-9);
// 花纹特征点满足 v(z)+offset ≡ 常数 ⇒ dz = -doffset/dvdz; 前进(vel>0)时要求 dz<0 (相对车体向后)
const k=minus?-1:(plus?1:0);
const dz=-k/dvdz;   // 每单位 vel*dt 的位移方向 (特征点 v(z)+offset≡常数 ⇒ dz=-doffset/dvdz)
chk(k!==0, `  源码 update() 的履带滚动用 ${minus?'offset.y-=':plus?'offset.y+=':'(未找到)'} vel*dt/trackTileLen`);
chk(dvdz<0, `  几何: 接地段 dv/dz = ${dvdz.toFixed(4)} < 0 (v 沿材料流向 = 接地段向后递增)`);
chk(dz<0, `  闭环: 前进时接地段花纹位移方向 = ${dz<0?'向后':'向前'} ⇒ 与地面零打滑 [k=${k} dv/dz=${dvdz.toFixed(4)}]`);
}
// ⑨ 阴性对照: 旧写法 (实心盒 + ±X 面装甲板 + 轮外移)
console.log('── ⑨ 阴性对照 (旧写法: 实心盒履带 + 轮外移 6cm) ──');
{
const neg=Q(`(function(){
const D=FACTIONS.us.tanks[0], S=tkSpec(D,D.tk);
const L=S.L, trkH=Math.max(0.3,S.hullY-S.hullH*0.35+S.hullH*0.97/2-0.03);
const box=new THREE.BoxGeometry(S.trkW,trkH,L+0.25);
// 旧写法: ±X 面 = 一整块装甲板 (占满整个下缘侧面)
const pos=box.attributes.position;
const quad=[];
for(let i=0;i<pos.count;i++) if(near0(pos.getX(i),S.trkW/2)) quad.push({z:pos.getZ(i),y:pos.getY(i)});
function near0(a,b){ return Math.abs(a-b)<1e-6; }
// 侧面矩形 (x=+w/2) 拆两个三角, 平移到世界 (y = trkY)
const trkTop=S.hullY-S.hullH*0.35+S.hullH*0.97/2, trkY=(trkTop+0.03)/2;
const y0=trkY-trkH/2, y1=trkY+trkH/2;
const z0=-(L+0.25)/2, z1=(L+0.25)/2;
const sideTri=[[{z:z0,y:y0},{z:z1,y:y0},{z:z1,y:y1}],[{z:z0,y:y0},{z:z1,y:y1},{z:z0,y:y1}]];
const whX=S.trkSx+0.06;
return {sideTri, whX, trkOut:S.trkSx+S.trkW/2, y0, y1};
})()`);
const w=Q(`(function(){const D=FACTIONS.us.tanks[0],S=tkSpec(D,D.tk);return {y:S.whR+0.06,z:-(S.L/2-0.75),r:S.whR};})()`);
const cov=wheelCover(neg.sideTri,w.y,w.z,w.r,26);
chk(cov>0.9, `  旧写法 (实心盒履带) 侧面盖住轮面 ${(cov*100).toFixed(0)}% ⇒ ③ 判据在旧版上报红`);
chk(neg.whX+w.r>neg.trkOut, `  旧写法把轮外移到 ${neg.whX.toFixed(2)}m ⇒ 轮面外沿 ${(neg.whX+w.r).toFixed(3)} 凸出侧板外沿 ${neg.trkOut.toFixed(3)} ⇒ ④ 判据在旧版上报红`);
}
console.log(`\n合计 ${pass} ✓ / ${fail} ✗`);
process.exit(fail?1:0);
