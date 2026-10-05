// dev/_zfight-tri.js —— 真·三角形级共面/近共面扫描 (世界空间; 与朝向/几何类型/实例化无关)
// 用法: node --stack-size=4000 dev/_zfight-tri.js [campaignId ...]
//
// 载入真 three r152 (dev/vendor/three.min.js) + 桩渲染器 + 完整脚本链, 把 world 与 scene 里每个
// mesh/实例的每个三角形变换到世界空间, 按支撑平面分组, 平面哈希配对, 2D 裁剪求交叠面积。
//   判据一 (严格共面): 同向面, 平面距 < 2cm, 交叠 ≥ 0.012m² —— "两个面重合"的直接来源;
//   判据二 (近共面): 平面距 2~12cm —— 远处 1 LSB 可达 3~7cm (near=0.08/far=900), 这类在远景照样争。
// 输出: 每个根 (world/scene) 的 mesh/三角形/平面记录/配对数; 会闪子集 (同档+双写深度+非反向) 按
//   几何类·材质·朝向·离地 分档; 大网格 (>4000 三角形) 与实例批单独盘点 (这两类此前完全没进判据)。
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const stub=require('./_bootstub.js');
const root=path.resolve(__dirname,'..');
const FILES=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/15g-capmodels.js','js/15h-capital.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/22a-menuart.js','js/23-deploy.js','js/23b-worldrestore.js','js/24-main.js'];
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
// ★裸 THREE 必须是**真 three**: three.min.js 的 UMD 写的是 globalThis.THREE, 而本桩把 globalThis 指到了
//   另一个对象 ⇒ 不补这一行, 游戏脚本拿到的是桩几何(盒 8 顶点/平面全 0), 三角形级判据全是假数。
vm.runInContext('THREE = globalThis.THREE;',ctx,{filename:'bind-three'});
vm.runInContext(RENDERER_STUB,ctx,{filename:'stub-renderer'});
for(const f of FILES) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
return ctx;
}
const G=(ctx,code)=>vm.runInContext(code,ctx);

const PAGE=`
(function(){
// ★ 先把运行期消解队列跑空: 本工具只建场、不跑帧循环, 而单位模型 (坦克/飞机/士兵/炮位…) 是开局才建、
//   由 24-main 每帧 resolveRuntimeSurfaces() 分帧消解的 (每帧 2 个根)。不跑空就会把"还没轮到消解"的
//   模型件对算成残留 (假残留), 与实机状态不符。
(function(){ if(typeof resolveRuntimeSurfaces!=='function'||typeof SURF_RT==='undefined') return;
let miss=0;
for(let i=0;i<600&&miss<2;i++){ const b=SURF_RT.roots; resolveRuntimeSurfaces(); if(SURF_RT.roots===b) miss++; else miss=0; }
})();
const TOL=0.02, TOL2=0.06, MINAREA=0.012;   // 严格共面 2cm / 近共面 12cm / 交叠下限 1.2dm²
const MAXTRI=4000;
const inv={big:[],inst:[]};
const geoCache=new WeakMap();
function localTris(g){
if(geoCache.has(g)) return geoCache.get(g);
const pos=g.attributes&&g.attributes.position; if(!pos){ geoCache.set(g,null); return null; }
const idx=g.index, n=Math.floor((idx?idx.count:pos.count)/3), out=[];
for(let t=0;t<n;t++){
const i0=idx?idx.getX(t*3):t*3, i1=idx?idx.getX(t*3+1):t*3+1, i2=idx?idx.getX(t*3+2):t*3+2;
out.push([pos.getX(i0),pos.getY(i0),pos.getZ(i0), pos.getX(i1),pos.getY(i1),pos.getZ(i1), pos.getX(i2),pos.getY(i2),pos.getZ(i2)]);
}
geoCache.set(g,out); return out;
}
function matName(m){
for(const k in MAT){ if(MAT[k]===m) return k; }
if(!m) return '?';
if(m.map) return m.map.__name||'(贴图材质)';
return m.transparent?'(透明局部材质)':'(局部材质)';
}
function tag(o){
const m=o.material, pr=(o.geometry&&o.geometry.parameters)||{};
let gk='其它';
if(pr.width!==undefined&&pr.depth!==undefined) gk='box';
else if(pr.radius!==undefined&&pr.segments!==undefined) gk='circle';
else if(pr.radiusTop!==undefined) gk='cyl';
else if(pr.radius!==undefined&&pr.height!==undefined) gk='cone';
else if(pr.width!==undefined&&pr.height!==undefined) gk='plane';
else if(pr.tube!==undefined) gk='torus';
else if(pr.radius!==undefined) gk='sphere';
return {gk,mn:matName(m),units:(m&&m.polygonOffset?m.polygonOffsetUnits:0),fac:(m&&m.polygonOffset?m.polygonOffsetFactor:0),
dw:!(m&&m.transparent===true&&m.depthWrite===false),ds:!!(m&&m.side===2)};
}
// 把一组局部三角形按矩阵 M 展开成"平面记录"
function pushObj(out,tris,M,info,name){
const MIID=name;
const e=M.elements;
const V=new Float64Array(tris.length*9);
for(let t=0;t<tris.length;t++){
const tr=tris[t];
for(let k=0;k<3;k++){
const x=tr[k*3], y=tr[k*3+1], z=tr[k*3+2];
V[t*9+k*3]  = e[0]*x+e[4]*y+e[8]*z+e[12];
V[t*9+k*3+1]= e[1]*x+e[5]*y+e[9]*z+e[13];
V[t*9+k*3+2]= e[2]*x+e[6]*y+e[10]*z+e[14];
}
}
const groups=new Map(); const rng=[[1e9,-1e9],[1e9,-1e9],[1e9,-1e9]];
for(let t=0;t<tris.length;t++){
const o9=t*9;
const ax=V[o9],ay=V[o9+1],az=V[o9+2], bx=V[o9+3],by=V[o9+4],bz=V[o9+5], cx=V[o9+6],cy=V[o9+7],cz=V[o9+8];
const ux=bx-ax,uy=by-ay,uz=bz-az, vx=cx-ax,vy=cy-ay,vz=cz-az;
let nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx;
const L=Math.hypot(nx,ny,nz); if(L<1e-9) continue;
nx/=L; ny/=L; nz/=L;
const d=nx*ax+ny*ay+nz*az;
// ★ 键里**不能**带 mesh 号: 带上就变成"只在同一个 mesh 内部配对", 而用户看到的"两个面重合"绝大多数
//   是**不同 mesh** 的面 (贴片 vs 墙/两块板相接)。带 mesh 号的版本实测把整张图报成 0 对 —— 假阴性。
const kk=Math.round(nx*96)+'|'+Math.round(ny*96)+'|'+Math.round(nz*96)+'|'+Math.round(d/0.01);
let gr=groups.get(kk);
if(!gr){
const ux2=Math.abs(nx)<0.9?1:0, uy2=Math.abs(nx)<0.9?0:1, uz2=0;
let vx2=ny*uz2-nz*uy2, vy2=nz*ux2-nx*uz2, vz2=nx*uy2-ny*ux2;
const vl=Math.hypot(vx2,vy2,vz2)||1; vx2/=vl; vy2/=vl; vz2/=vl;
const wx2=ny*vz2-nz*vy2, wy2=nz*vx2-nx*vz2, wz2=nx*vy2-ny*vx2;
gr={n:[nx,ny,nz],d,tris:[],u:[wx2,wy2,wz2],v:[vx2,vy2,vz2]};
groups.set(kk,gr);
}
const pr2=p=>[p[0]*gr.u[0]+p[1]*gr.u[1]+p[2]*gr.u[2], p[0]*gr.v[0]+p[1]*gr.v[1]+p[2]*gr.v[2]];
let a2=pr2([ax,ay,az]), b2=pr2([bx,by,bz]), c2=pr2([cx,cy,cz]);
if((b2[0]-a2[0])*(c2[1]-a2[1])-(b2[1]-a2[1])*(c2[0]-a2[0])<0){ const tm=b2; b2=c2; c2=tm; }
gr.tris.push([a2,b2,c2]);
for(const p of [[ax,ay,az],[bx,by,bz],[cx,cy,cz]]) for(let k=0;k<3;k++){ if(p[k]<rng[k][0]) rng[k][0]=p[k]; if(p[k]>rng[k][1]) rng[k][1]=p[k]; }
}
for(const [kk,gr] of groups) out.push({name,key:kk,n:gr.n,d:gr.d,u:gr.u,v:gr.v,tris:gr.tris,info,aabb:[[rng[0][0],rng[0][1]],[rng[1][0],rng[1][1]],[rng[2][0],rng[2][1]]]});
}
function clipArea(ta,tb){
let poly=ta;
for(let e=0;e<3;e++){
const P=tb[e], Q=tb[(e+1)%3], ex=Q[0]-P[0], ey=Q[1]-P[1], out=[];
for(let i=0;i<poly.length;i++){
const A=poly[i], B=poly[(i+1)%poly.length];
const da=ex*(A[1]-P[1])-ey*(A[0]-P[0]), db=ex*(B[1]-P[1])-ey*(B[0]-P[0]);
if(da>=-1e-9) out.push(A);
if((da>1e-9&&db<-1e-9)||(da<-1e-9&&db>1e-9)){ const t=da/(da-db); out.push([A[0]+(B[0]-A[0])*t, A[1]+(B[1]-A[1])*t]); }
}
poly=out; if(poly.length<3) return 0;
}
let s2=0;
for(let i=1;i+1<poly.length;i++) s2+=Math.abs((poly[i][0]-poly[0][0])*(poly[i+1][1]-poly[0][1])-(poly[i+1][0]-poly[0][0])*(poly[i][1]-poly[0][1]));
return s2/2;
}
function analyze(root0,label,skip){
const recs=[];
const stat={label,meshes:0,tris:0,skipped:0,skippedTri:0,instBatches:0,instObjs:0};
root0.updateMatrixWorld(true);
root0.traverse(o=>{
if(skip&&skip.has(o)) return;
if(o.visible===false) return;
if(!o.isMesh&&!o.isInstancedMesh) return;
const g=o.geometry; if(!g||!g.attributes||!g.attributes.position) return;
const tris=localTris(g); if(!tris) return;
if(o.isInstancedMesh){
stat.instBatches++; stat.instObjs+=o.count;
inv.inst.push([tris.length,o.count,label]);
const im=o.instanceMatrix, n=Math.min(o.count,3000);
for(let i=0;i<n;i++){
const M=new THREE.Matrix4(), im4=new THREE.Matrix4();
im4.fromArray(im.array, i*16);          // 列主序读取 (Matrix4.set 是行主序入参, 用它会丢掉平移)
M.multiplyMatrices(o.matrixWorld,im4);
pushObj(recs,tris,M,tag(o),'inst#'+i);
}
return;
}
if(tris.length>MAXTRI){ stat.skipped++; stat.skippedTri+=tris.length;
if(tris.length>20000) inv.big.push([tris.length,label,matName(o.material),label==='scene'?'scene':'world']);
return; }
stat.meshes++; stat.tris+=tris.length;
pushObj(recs,tris,o.matrixWorld,tag(o),'mesh#'+stat.meshes);
});
const buckets=new Map();
recs.forEach((r,i)=>{ let a=buckets.get(r.key); if(!a){ a=[]; buckets.set(r.key,a); } a.push(i); });
const pairs=[]; const seen=new Set(); let tests=0;
for(const [k,arr] of buckets){
const p=k.split('|').map(Number);
if(!p||p.length<4||p.some(x=>!isFinite(x))) continue;
for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(let c=-1;c<=1;c++)for(let d=-6;d<=6;d++){   /* d 探 ±6 桶 = ±6cm */
const k2=(p[0]+a)+'|'+(p[1]+b)+'|'+(p[2]+c)+'|'+(p[3]+d);
const arr2=buckets.get(k2); if(!arr2) continue;
for(const i of arr){
const A=recs[i];
for(const j of arr2){
if(k2===k&&j<=i) continue;
const B=recs[j];
if(A===B) continue;
const pk=(i<j?i+'_'+j:j+'_'+i);          // ★ 不带 '@1/@2': 同一对记录从两侧各被扫到一次, 带方向后缀会重复计数
if(seen.has(pk)) continue;
const dn=A.n[0]*B.n[0]+A.n[1]*B.n[1]+A.n[2]*B.n[2];
let neg=false;
if(dn>=0.99985) neg=false;
else if(dn<=-0.99985){ if(!(A.info.ds||B.info.ds)){ seen.add(pk); continue; } neg=true; }
else continue;
const dOff=Math.abs(A.d-B.d);
if(dOff>=TOL2) continue;
let aabbOut=false;
for(let ax=0;ax<3;ax++){ if(A.aabb[ax][1]<B.aabb[ax][0]-TOL2||B.aabb[ax][1]<A.aabb[ax][0]-TOL2){ aabbOut=true; break; } }
if(aabbOut) continue;
let area=0;
outer:
for(const ta of A.tris) for(const tb of B.tris){ tests++; const ar=clipArea(ta,tb); if(ar>=MINAREA){ area=ar; break outer; } }
if(area<MINAREA) continue;
seen.add(pk);
pairs.push({A,B,area,dOff,neg});
}
}
}
}
const near=pairs.filter(p=>!p.neg&&p.dOff>=TOL);
const exact=pairs.filter(p=>!p.neg&&p.dOff<TOL);
const both=p=>p.A.info.dw&&p.B.info.dw&&p.A.info.units===p.B.info.units&&p.A.info.fac===p.B.info.fac;
const flick=exact.filter(both), flickNear=near.filter(both);
function byClass(list){
const m=new Map();
for(const p of list){ const k=p.A.info.gk+'×'+p.B.info.gk+' · '+p.A.info.mn+'/'+p.B.info.mn; m.set(k,(m.get(k)||0)+1); }
return [...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10);
}
function byOrient(list){
const m=new Map();
for(const p of list){
const ny=p.A.n[1], c=p.A.aabb, cx=(c[0][0]+c[0][1])/2, cz=(c[2][0]+c[2][1])/2, cy=(c[1][0]+c[1][1])/2;
const gh=(typeof heightAt==='function')?heightAt(cx,cz):0, above=cy-gh;
const kind=(ny>0.9?'朝上':(ny<-0.9?'朝下':(Math.abs(ny)<0.15?'竖直':'倾斜')));
const deep=kind==='朝下'?(above<0.25?'贴地':'悬空'):(above<-0.05?'地下':'地面以上');
m.set(kind+'·'+deep+(p.area<0.05?'·细条':''),(m.get(kind+'·'+deep+(p.area<0.05?'·细条':''))||0)+1);
}
return [...m.entries()].sort((a,b)=>b[1]-a[1]);
}
return {stat,recs:recs.length,pairs:pairs.length,tests,
nExact:exact.length,nNear:near.length,nNeg:pairs.length-exact.length-near.length,
nFlick:flick.length,nFlickNear:flickNear.length,
areaSum:+flick.reduce((a,p)=>a+p.area,0).toFixed(1),
cls:byClass(flick), clsNear:byClass(flickNear), orient:byOrient(flick),
samples:flick.slice(0,8).map(p=>{
const c=r2=>{ const c2=r2.aabb; return '('+((c2[0][0]+c2[0][1])/2).toFixed(1)+','+((c2[1][0]+c2[1][1])/2).toFixed(2)+','+((c2[2][0]+c2[2][1])/2).toFixed(1)+')'; };
return p.A.name+' '+p.A.info.gk+'@'+c(p.A)+'/'+p.A.info.mn+'  ↔  '+p.B.name+' '+p.B.info.gk+'@'+c(p.B)+'/'+p.B.info.mn+' · 交叠 '+p.area.toFixed(2)+'m²';
})};
}
const W=analyze(world,'world'), S=analyze(scene,'scene',new Set([world]));
return {W,S,inv};
})()
`;
const want=process.argv.slice(2);
const list=G(boot(0),'CAMPAIGNS.map((c,i)=>[i,c.id])');
for(const [idx,id] of list){
if(want.length&&!want.includes(id)) continue;
const ctx=boot(idx);
let r;
try{ r=G(ctx,PAGE); }catch(e){ console.log(id.padEnd(10)+' 扫描异常: '+(e&&e.stack?e.stack.split('\n').slice(0,3).join(' | '):e)); continue; }
console.log(`\n=== ${id}`);
for(const A of [r.W,r.S]){
if(!A.recs) continue;
const s=A.stat;
console.log(`  [${s.label}] mesh ${s.meshes} · 三角 ${s.tris} · 平面记录 ${A.recs} · 跳过(>4000三角形) ${s.skipped} 件/${s.skippedTri} 三角 · 实例批 ${s.instBatches} (${s.instObjs} 实例)`);
console.log(`      共面交叠对 ${A.pairs} (严格 ${A.nExact} / 近共面2~12cm ${A.nNear} / 反向双面 ${A.nNeg}) · 裁剪测试 ${A.tests}`);
console.log(`      ★会闪(严格·同档·双写深度) ${A.nFlick} 对 · 交叠面积合计 ${A.areaSum}m² · 近共面条里同档的还有 ${A.nFlickNear} 对`);
for(const [k,n] of A.cls.slice(0,8)) console.log('         '+String(n).padStart(4)+'  '+k);
if(A.orient.length) console.log('         朝向: '+A.orient.map(([k,n])=>k+' '+n).join(' · '));
for(const x of A.samples) console.log('         ↳ '+x);
}
if(r.inv.big.length) console.log('  大网格(>2万三角形): '+r.inv.big.map(x=>x[0]+'三角['+x[1]+']'+x[2]+'@'+x[3]).join(', '));
if(r.inv.inst.length) console.log('  实例批: '+r.inv.inst.slice(0,10).map(x=>x[0]+'三角×'+x[1]+'实例['+x[2]+']').join(', '));
}
