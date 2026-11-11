// dev/_zfight-why.js —— 残留共面条"为什么没被消解"的归因扫描
// 用法: node --stack-size=4000 dev/_zfight-why.js [campaignId ...]
//
// 判据与 _zfight-tri.js 相同 (真顶点→支撑平面分组→2D 裁剪), 但每个平面记录**保留源对象引用**,
// 于是可以对每一对残留问一句: 世界级消解器 (05-world resolveCoplanarConflicts) 的哪一条过滤把它放过了?
//   世界级消解器的口径 (读源码): 只收 `g.parameters` 有尺寸的件 (box/cyl/disc/plane), 无 tilt
//   (rotation.x/z 全零, 含祖先), 世界 AABB 最长边 ∈ [0.15, 200], 写深度, 且非"覆盖层档"(units<0);
//   然后用**件的世界 AABB 的 6 个轴对齐面**做共面判定 —— 真三角形与 AABB 面不等价 ⇒ 斜置面漏检.
// 归因档 (每对逐侧判, 取"最先命中"的一条): tilt / 无参数几何 / 超尺寸 / 不写深度 / 覆盖层档 /
//   AABB面不符 (真面不是该件的轴对齐面) / 世界级未覆盖(不在 world 下) / 面积<minArea / 无归因(应被消解却没消解)
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
const PAGE=`
(function(){
// ★ 先把运行期消解队列跑空: 本工具只建场、不跑帧循环, 而单位模型 (坦克/飞机/士兵/炮位…) 是开局才建、
//   由 24-main 每帧 resolveRuntimeSurfaces() 分帧消解的 (每帧 2 个根)。不跑空就会把"还没轮到消解"的
//   模型件对算成残留 (假残留), 与实机状态不符。
(function(){ if(typeof resolveRuntimeSurfaces!=='function'||typeof SURF_RT==='undefined') return;
let miss=0;
for(let i=0;i<600&&miss<2;i++){ const b=SURF_RT.roots; resolveRuntimeSurfaces(); if(SURF_RT.roots===b) miss++; else miss=0; }
})();
const TOL=0.02, TOL2=0.06, MINAREA=0.012, MAXTRI=4000;
const cfg=SURF_CONFLICT;
function matName(m){
for(const k in MAT){ if(MAT[k]===m) return k; }
if(!m) return '?';
if(m.map) return (m.map.__name||'(贴图材质)');
return m.transparent?'(透明局部)':'(局部材质)';
}
// 祖先链: 是否有 tilt (rotation.x/z) / 名字路径
function chain(o){
const names=[]; let t=o, tilt=false, worldUnder=false, vis=true, ry=0;
while(t){ if(t===world) worldUnder=true;
if(t.rotation){ if(Math.abs(t.rotation.x||0)>1e-6||Math.abs(t.rotation.z||0)>1e-6) tilt=true; ry+=t.rotation.y||0; }
if(t.visible===false) vis=false;
if(names.length<6) names.push(t.name||(t.type==='Group'?'G':'')+(t===world?'[world]':''));
t=t.parent; }
return {path:names.reverse().join('/'),tilt,worldUnder,vis,ry};
}
const geoCache=new WeakMap();
function localTris(g){
if(geoCache.has(g)) return geoCache.get(g);
const pos=g.attributes&&g.attributes.position; if(!pos) return null;
const idx=g.index, n=Math.floor((idx?idx.count:pos.count)/3), a=[];
for(let t=0;t<n;t++){
const i0=idx?idx.getX(t*3):t*3, i1=idx?idx.getX(t*3+1):t*3+1, i2=idx?idx.getX(t*3+2):t*3+2;
a.push([pos.getX(i0),pos.getY(i0),pos.getZ(i0), pos.getX(i1),pos.getY(i1),pos.getZ(i1), pos.getX(i2),pos.getY(i2),pos.getZ(i2)]);
}
geoCache.set(g,a); return a;
}
scene.updateMatrixWorld(true);
const recs=[];
scene.traverse(o=>{
if(o.visible===false||o.count!==undefined||!o.isMesh) return;
const g=o.geometry,m=o.material; if(!g||!m||!g.attributes||!g.attributes.position) return;
const t=localTris(g); if(!t||!t.length||t.length>MAXTRI) return;
const e=o.matrixWorld.elements;
const groups=new Map(); const rng=[[1e9,-1e9],[1e9,-1e9],[1e9,-1e9]];
for(const tr of t){
const P=[];
for(let k=0;k<3;k++){ const x=tr[k*3],y=tr[k*3+1],z=tr[k*3+2];
P.push([e[0]*x+e[4]*y+e[8]*z+e[12], e[1]*x+e[5]*y+e[9]*z+e[13], e[2]*x+e[6]*y+e[10]*z+e[14]]); }
const [A,B,C]=P;
const ux=B[0]-A[0],uy=B[1]-A[1],uz=B[2]-A[2], vx=C[0]-A[0],vy=C[1]-A[1],vz=C[2]-A[2];
let nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx;
const L=Math.hypot(nx,ny,nz); if(L<1e-9) continue; nx/=L;ny/=L;nz/=L;
const d=nx*A[0]+ny*A[1]+nz*A[2];
const kk=Math.round(nx*96)+'|'+Math.round(ny*96)+'|'+Math.round(nz*96)+'|'+Math.round(d/0.01);
let gr=groups.get(kk);
if(!gr){
const ux2=Math.abs(nx)<0.9?1:0, uy2=Math.abs(nx)<0.9?0:1;
let vx2=-nz*uy2, vy2=nz*ux2, vz2=nx*uy2-ny*ux2;
const vl=Math.hypot(vx2,vy2,vz2)||1; vx2/=vl;vy2/=vl;vz2/=vl;
const wx2=ny*vz2-nz*vy2, wy2=nz*vx2-nx*vz2, wz2=nx*vy2-ny*vx2;
gr={n:[nx,ny,nz],d,u:[wx2,wy2,wz2],v:[vx2,vy2,vz2],tris:[],bb:[[1e9,-1e9],[1e9,-1e9],[1e9,-1e9]]}; groups.set(kk,gr);
}
const p2=p=>[p[0]*gr.u[0]+p[1]*gr.u[1]+p[2]*gr.u[2], p[0]*gr.v[0]+p[1]*gr.v[1]+p[2]*gr.v[2]];
let a2=p2(A), b2=p2(B), c2=p2(C);
if((b2[0]-a2[0])*(c2[1]-a2[1])-(b2[1]-a2[1])*(c2[0]-a2[0])<0){ const tm=b2; b2=c2; c2=tm; }
gr.tris.push([a2,b2,c2]);
for(const q of P) for(let k=0;k<3;k++){ if(q[k]<rng[k][0]) rng[k][0]=q[k]; if(q[k]>rng[k][1]) rng[k][1]=q[k];
if(q[k]<gr.bb[k][0]) gr.bb[k][0]=q[k]; if(q[k]>gr.bb[k][1]) gr.bb[k][1]=q[k]; }
}
const ch=chain(o), pr=g.parameters||{};
let dims=null;
if(pr.width!==undefined&&pr.height!==undefined&&pr.depth!==undefined) dims=[pr.width,pr.height,pr.depth];
else if(pr.radius!==undefined&&pr.height!==undefined) dims=[pr.radius*2,pr.height,pr.radius*2];
else if(pr.radius!==undefined) dims=[pr.radius*2,0.001,pr.radius*2];
else if(pr.width!==undefined&&pr.height!==undefined) dims=[pr.width,pr.height,0.001];
const po=m.polygonOffset===true, preLvl=(po&&m.polygonOffsetFactor===0&&m.polygonOffsetUnits>0)?Math.round(m.polygonOffsetUnits/cfg.step):0;
// 世界轴 + 半尺寸 (含缩放): 与消解器同一口径 (从 matrixWorld 取, 真 three 才有)
const e2=o.matrixWorld.elements;
const ax=[[e2[0],e2[1],e2[2]],[e2[4],e2[5],e2[6]],[e2[8],e2[9],e2[10]]];
const hh=[0,0,0];
if(dims) for(let i=0;i<3;i++){ const L=Math.hypot(ax[i][0],ax[i][1],ax[i][2])||1; ax[i][0]/=L; ax[i][1]/=L; ax[i][2]/=L; hh[i]=dims[i]/2*L; }
const info={obj:o,mat:m,mn:matName(m),ax,h:hh,ctr:[e2[12],e2[13],e2[14]],
gk:(pr.width!==undefined&&pr.depth!==undefined)?'box':(pr.radiusTop!==undefined?'cyl':(pr.radius!==undefined?'round':(pr.width!==undefined?'plane':'自定义'))),
po,units:po?m.polygonOffsetUnits:0,fac:po?m.polygonOffsetFactor:0,preLvl,dims,hasParams:!!(pr.width!==undefined||pr.radius!==undefined||pr.radiusTop!==undefined),
dw:!(m.transparent===true&&m.depthWrite===false),ds:m.side===2,ch,
aabb:[[1e9,-1e9],[1e9,-1e9],[1e9,-1e9]]};
// 该 mesh 的世界 AABB (按几何包围盒×世界矩阵近似 = three 的 Box3 口径)
const bb=new THREE.Box3().setFromObject(o);
info.aabb=[[bb.min.x,bb.max.x],[bb.min.y,bb.max.y],[bb.min.z,bb.max.z]];
for(const [,gr] of groups){
recs.push({info,n:gr.n,d:gr.d,tris:gr.tris,aabb:gr.bb,mesh:o});
}
});
function clipArea(ta,tb){
let poly=ta;
for(let e=0;e<3;e++){
const P=tb[e], Q=tb[(e+1)%3], ex=Q[0]-P[0], ey=Q[1]-P[1], o2=[];
for(let i=0;i<poly.length;i++){
const A=poly[i], B=poly[(i+1)%poly.length];
const da=ex*(A[1]-P[1])-ey*(A[0]-P[0]), db=ex*(B[1]-P[1])-ey*(B[0]-P[0]);
if(da>=-1e-9) o2.push(A);
if((da>1e-9&&db<-1e-9)||(da<-1e-9&&db>1e-9)){ const t=da/(da-db); o2.push([A[0]+(B[0]-A[0])*t, A[1]+(B[1]-A[1])*t]); }
}
poly=o2; if(poly.length<3) return 0;
}
let s2=0;
for(let i=1;i+1<poly.length;i++) s2+=Math.abs((poly[i][0]-poly[0][0])*(poly[i+1][1]-poly[0][1])-(poly[i+1][0]-poly[0][0])*(poly[i][1]-poly[0][1]));
return s2/2;
}
// 归因: 世界级消解器会不会收这件? (全部命中项都记下来, 不取第一个)
function why(info){
const f=[];
if(!info.ch.worldUnder) f.push('不在world下');
if(!info.dw) f.push('不写深度');
if(info.po&&info.preLvl<=0) f.push('覆盖层档');
if(!info.hasParams||!info.dims) f.push('无参数几何(合并/自定义几何)');
else { const ext=Math.max(info.dims[0],info.dims[2]); if(ext>200) f.push('超大件'); else if(ext<0.15) f.push('超小件'); }
return f.length?f.join('+'):'-';
}
// 现版消解器 (真实面模型, 2026-09-27L) 能不能看见这一对? 逐条复刻它的判据
function sees(A,B){
const a=A.info,b=B.info;
if(a.ch.tilt===undefined) return false;
if(!a.hasParams||!b.hasParams||!a.dims||!b.dims) return false;
const ext=x=>Math.max(x.dims[0],x.dims[2]);
if(ext(a)>200||ext(a)<0.15||ext(b)>200||ext(b)<0.15) return false;
if(!a.dw||!b.dw) return false;
if(a.po&&a.preLvl<=0) return false;
if(b.po&&b.preLvl<=0) return false;
const TOL=cfg.tol, MINA=cfg.minArea;
const faces=c=>{
const out=[];
for(let i=0;i<3;i++)for(const s of [-1,1]){
const N=c.ax[i], H=c.h[i];
const n=[N[0]*s,N[1]*s,N[2]*s];
const fc=[c.ctr[0]+n[0]*H, c.ctr[1]+n[1]*H, c.ctr[2]+n[2]*H];
const p=n[0]*fc[0]+n[1]*fc[1]+n[2]*fc[2];
const o1=(i+1)%3,o2=(i+2)%3;
let lo=[1e9,1e9],hi=[-1e9,-1e9];
for(const su of [-1,1])for(const sv of [-1,1]){
const q=[0,1,2].map(k=>fc[k]+c.ax[o1][k]*c.h[o1]*su+c.ax[o2][k]*c.h[o2]*sv);
for(let k=0;k<2;k++){ const d=q[k]; if(d<lo[k])lo[k]=d; if(d>hi[k])hi[k]=d; }
}
out.push({n,p,fc,i,s,lo,hi});
}
return out;
};
const supOf=(c,n)=>{ let s2=0; for(let k=0;k<3;k++){ const x=c.ax[k]; s2+=Math.abs(n[0]*x[0]+n[1]*x[1]+n[2]*x[2])*c.h[k]; } return s2; };
const FA=faces(a), FB=faces(b);
for(const x of FA) for(const y of FB){
const dn=x.n[0]*y.n[0]+x.n[1]*y.n[1]+x.n[2]*y.n[2];
const opp=(dn<=-0.99985);
if(!opp&&dn<0.99985) continue;
const dOff=opp?Math.abs(x.p+y.p):Math.abs(x.p-y.p);
if(dOff>TOL+1e-6) continue;
// 面内矩形: 用规范基底投影 (此处直接比较"两矩形在各自基底下的范围"近似为轴对齐——够用于归因)
if(x.lo[0]>=y.hi[0]||y.lo[0]>=x.hi[0]||x.lo[1]>=y.hi[1]||y.lo[1]>=x.hi[1]) continue;
if(opp){
const mA=x.n[0]*a.ctr[0]+x.n[1]*a.ctr[1]+x.n[2]*a.ctr[2], mB=x.n[0]*b.ctr[0]+x.n[1]*b.ctr[1]+x.n[2]*b.ctr[2];
const lo=Math.max(mA-supOf(a,x.n),mB-supOf(b,x.n)), hi=Math.min(mA+supOf(a,x.n),mB+supOf(b,x.n));
const ov=hi-lo;
if(ov>=TOL) continue;
if(ov<=1e-9&&!(a.ds||b.ds)) continue;
}
// 桶距: 消解器按 (法线三轴量化 1/96 | 平面量化 1cm) 建桶, 同向只查 d=0..3 / 反向只查 dd=-3..3,
// 且法线**只在桶边界(wide)时才查邻桶** —— 这里回报"这一对落在几个桶之外", 用来区分真漏检与量化盲区
const bn=(v)=>Math.round(v*96);
const nb=[Math.abs(bn(x.n[0])-bn(y.n[0])),Math.abs(bn(x.n[1])-bn(y.n[1])),Math.abs(bn(x.n[2])-bn(y.n[2]))];
const binN=Math.max(nb[0],nb[1],nb[2]);
const binD=Math.abs(Math.round((opp?-x.p:x.p)/0.01)-Math.round(y.p/0.01));
const fr=v=>Math.abs(Math.abs(v*96-Math.round(v*96))-0.5)<1e-6;
const wide=(fr(x.n[0])||fr(x.n[1])||fr(x.n[2])||fr(y.n[0])||fr(y.n[1])||fr(y.n[2]));
const nOff=+(Math.acos(Math.min(1,Math.abs(dn)))*180/Math.PI).toFixed(3);
return {binN,binD,wide,nOff,dOff,opp};
}
return null;
}
const pairs=[];
for(let i=0;i<recs.length;i++) for(let j=i+1;j<recs.length;j++){
const A=recs[i],B=recs[j];
if(A.mesh===B.mesh) continue;
const dn=A.n[0]*B.n[0]+A.n[1]*B.n[1]+A.n[2]*B.n[2];
let neg=false;
if(dn>=0.99985) neg=false;
else if(dn<=-0.99985){ if(!(A.info.ds||B.info.ds)) continue; neg=true; }
else continue;
const dOff=Math.abs(A.d-B.d);
if(dOff>=TOL) continue;
let o=false; for(let k=0;k<3;k++){ if(A.aabb[k][1]<B.aabb[k][0]-TOL2||B.aabb[k][1]<A.aabb[k][0]-TOL2){ o=true; break; } }
if(o) continue;
let area=0;
outer: for(const ta of A.tris) for(const tb of B.tris){ const ar=clipArea(ta,tb); if(ar>=MINAREA){ area=ar; break outer; } }
if(area<MINAREA) continue;
if(!A.info.dw||!B.info.dw) continue;
if(A.info.units!==B.info.units||A.info.fac!==B.info.fac) continue;   // 已被消解器分开 ⇒ 不算残留
const ax=(()=>{ const a=[Math.abs(A.n[0]),Math.abs(A.n[1]),Math.abs(A.n[2])]; const k=a[0]>=a[1]&&a[0]>=a[2]?0:(a[1]>=a[2]?1:2); return a[k]>0.9998?k:-1; })();
const sv=sees(A,B);
pairs.push({A,B,area,ax,wa:why(A.info),wb:why(B.info),sees:!!sv,sv,dOff,neg});
}
const svTxt=p=>{
if(!p.sv) return '';
const s2=' 桶距(法线'+p.sv.binN+' 平面'+p.sv.binD+' 夹角'+p.sv.nOff+'°';
return s2+(p.sv.opp?' 反向)':')');
};
const tally=new Map();
for(const p of pairs){
const k=(p.wa==='-'?'收':p.wa)+' | '+(p.wb==='-'?'收':p.wb)+' · 几何可见='+(p.sees?'是':'否')+svTxt(p);
tally.set(k,(tally.get(k)||0)+1);
}
const byReason=new Map();
for(const p of pairs){
for(const w of [p.wa,p.wb]) for(const r of w.split('+')) byReason.set(r,(byReason.get(r)||0)+1);
}
const top=[...pairs].sort((a,b)=>b.area-a.area).slice(0,16).map(p=>
p.A.info.ch.path+'@('+p.A.info.ctr.map(v=>v.toFixed(1)).join(',')+') ['+p.A.info.gk+'/'+p.A.info.mn+'] ↔ '+p.B.info.ch.path+'@('+p.B.info.ctr.map(v=>v.toFixed(1)).join(',')+') ['+p.B.info.gk+'/'+p.B.info.mn+'] · 交叠 '+p.area.toFixed(3)+'m² · 法轴 '+p.ax+' · 几何可见='+(p.sees?'是':'否')+svTxt(p)+' · 归因 A='+p.wa+' / B='+p.wb);
return {n:pairs.length,area:+pairs.reduce((a,p)=>a+p.area,0).toFixed(2),
tally:[...tally.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12),
byReason:[...byReason.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12),top};
})()
`;
const want=process.argv.slice(2);
const list=vm.runInContext('CAMPAIGNS.map((c,i)=>[i,c.id])',boot(0));
for(const [idx,id] of list){
	if(want.length&&!want.includes(id)) continue;
	const ctx=boot(idx);
	let r;
	try{ r=vm.runInContext(PAGE,ctx,{filename:'why'}); }catch(e){ console.log(id.padEnd(10)+' 异常: '+(e&&e.stack?e.stack.split('\n').slice(0,3).join(' | '):e)); continue; }
	console.log(`\n=== ${id}  残留会闪对 ${r.n} · 交叠合计 ${r.area}m²`);
	for(const [k,n] of r.tally) console.log('   配对归因 '+String(n).padStart(4)+'  '+k);
	for(const [k,n] of r.byReason) console.log('   单侧归因 '+String(n).padStart(4)+'  '+k);
	for(const x of r.top) console.log('   ↳ '+x);
}
