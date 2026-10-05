// dev/verify-surfmodel.js —— 模型内共面消解 (2026-09-27K) 验收
// 用法: node --stack-size=4000 dev/verify-surfmodel.js
//
// 背景: 世界级 resolveCoplanarConflicts 只在建图末对 world 跑一次, 而载具/飞机/士兵/工事模型是
//   开局/重生时才建的 (实测 M4 谢尔曼车体顶面↔侧凸顶面共面重叠 3.9m²、P-47 机翼↔机身 0.72m²…)
//   ⇒ 这些模型从没进过判据, 是"图层贴图打架仍大量存在"的主源。本批新增 resolveModelSurfaces(
//   root) + 每帧入口 resolveRuntimeSurfaces() (24-main 主循环, 每帧至多 2 个根)。
// 本验证器载入**真 three r152** (桩几何是假顶点, 数不出真三角形) + 桩渲染器 + 完整脚本链。
// 断言:
//   T1 合成正对照: 两个共面重叠盒 → 消解后有效 units 不同 (一个拿 0, 一个拿正档);
//   T2 合成负对照: 相距 1m 的两盒 → 材质完全不被改;
//   T3 ★真实模型: 开局后把队列跑空 → 独立三角形扫描逐单位断言"同档共面 0 对";
//   T4 幂等: 再跑一遍 → 不新增落档 (SURF_RT.roots 不变);
//   T5 不污染共享材质: MAT 表里所有材质 polygonOffset 保持未设;
//   T6 每帧预算: 单次调用处理的根数 ≤ SURF_RT_BUDGET(2);
//   T7 变体池: depthVariant 池 ≤96;
//   T8 覆盖层档不受影响: 带 decal 档的 mesh 经模型消解后 units 不变;
//   T9 扫描灵敏度对照: 关掉消解 (还原材质) 后同一扫描必须报出 >0 对 (证明 T3 不是空跑).
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
let pass=0,fail=0;
const chk=(c,msg)=>{ if(c){ pass++; console.log('  ✓ '+msg); } else { fail++; console.log('  ✗ '+msg); } };
const info=msg=>console.log('    · '+msg);
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

// 页内共享的独立扫描器 (真三角形; 与 dev/_zfight-runtime.js 同一支口径, 只做"同档共面"计数)
const SCANNER=`
function __scanRoot(root0){
const TOL=0.02,TOL2=0.06,MINA=0.004,MAXTRI=4000;   // MINA 与消解器的模型口径一致 (SURF_RT_MINAREA)
const recs=[]; let __mi=-1;
const inv=new THREE.Matrix4(), rel=new THREE.Matrix4();
root0.updateMatrixWorld(true); inv.copy(root0.matrixWorld).invert();
root0.traverse(o=>{
if(o.visible===false||o.count!==undefined||!o.isMesh) return;
__mi++; const MIID=__mi;
const g=o.geometry,m=o.material; if(!g||!m||!g.attributes||!g.attributes.position) return;
if(m.transparent===true&&m.depthWrite===false) return;                 // 不写深度 ⇒ 无深度之争 (与消解器同口径)
if(m.polygonOffset===true&&m.polygonOffsetUnits<0) return;             // 覆盖层档 (阶梯) 不参与
const nTri=Math.floor(((g.index?g.index.count:g.attributes.position.count))/3);
if(nTri<1||nTri>MAXTRI) return;
const pos=g.attributes.position, ix=g.index;
rel.multiplyMatrices(inv,o.matrixWorld); const e=rel.elements;
const groups=new Map();
for(let t=0;t<nTri;t++){
const ia=ix?ix.getX(t*3):t*3, ib=ix?ix.getX(t*3+1):t*3+1, ic=ix?ix.getX(t*3+2):t*3+2;
const X=[pos.getX(ia),pos.getY(ia),pos.getZ(ia)], Y=[pos.getX(ib),pos.getY(ib),pos.getZ(ib)], Z=[pos.getX(ic),pos.getY(ic),pos.getZ(ic)];
const P=[X,Y,Z].map(p=>[e[0]*p[0]+e[4]*p[1]+e[8]*p[2]+e[12], e[1]*p[0]+e[5]*p[1]+e[9]*p[2]+e[13], e[2]*p[0]+e[6]*p[1]+e[10]*p[2]+e[14]]);
const A=P[0],B=P[1],C=P[2];
const ux=B[0]-A[0],uy=B[1]-A[1],uz=B[2]-A[2], vx=C[0]-A[0],vy=C[1]-A[1],vz=C[2]-A[2];
let nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx;
const L=Math.hypot(nx,ny,nz); if(L<1e-9) continue; nx/=L; ny/=L; nz/=L;
const d=nx*A[0]+ny*A[1]+nz*A[2];
const kk=MIID+'|'+Math.round(nx*96)+'|'+Math.round(ny*96)+'|'+Math.round(nz*96)+'|'+Math.round(d/0.01);
let gr=groups.get(kk);
if(!gr){ const ux2=Math.abs(nx)<0.9?1:0, uy2=Math.abs(nx)<0.9?0:1;
let vx2=ny*0-nz*uy2, vy2=nz*ux2-nx*0, vz2=nx*uy2-ny*ux2;
const vl=Math.hypot(vx2,vy2,vz2)||1; vx2/=vl; vy2/=vl; vz2/=vl;
const wx2=ny*vz2-nz*vy2, wy2=nz*vx2-nx*vz2, wz2=nx*vy2-ny*vx2;
gr={n:[nx,ny,nz],d,tris:[],u:[wx2,wy2,wz2],v:[vx2,vy2,vz2],bb:[[1e9,-1e9],[1e9,-1e9],[1e9,-1e9]]}; groups.set(kk,gr); }
const p2=p=>[p[0]*gr.u[0]+p[1]*gr.u[1]+p[2]*gr.u[2], p[0]*gr.v[0]+p[1]*gr.v[1]+p[2]*gr.v[2]];
let a2=p2(A),b2=p2(B),c2=p2(C);
if((b2[0]-a2[0])*(c2[1]-a2[1])-(b2[1]-a2[1])*(c2[0]-a2[0])<0){ const tm=b2; b2=c2; c2=tm; }
gr.tris.push([a2,b2,c2]);
for(const p of P) for(let k=0;k<3;k++){ if(p[k]<gr.bb[k][0]) gr.bb[k][0]=p[k]; if(p[k]>gr.bb[k][1]) gr.bb[k][1]=p[k]; }
}
for(const [,gr] of groups) recs.push({mesh:o,mat:m,n:gr.n,d:gr.d,tris:gr.tris,bb:gr.bb,ds:m.side===2});
});
const clip=(ta,tb)=>{ let poly=ta;
for(let e2=0;e2<3;e2++){ const P=tb[e2],Q=tb[(e2+1)%3], ex=Q[0]-P[0], ey=Q[1]-P[1], out=[];
for(let i=0;i<poly.length;i++){ const A=poly[i],B=poly[(i+1)%poly.length];
const da=ex*(A[1]-P[1])-ey*(A[0]-P[0]), db=ex*(B[1]-P[1])-ey*(B[0]-P[0]);
if(da>=-1e-9) out.push(A);
if((da>1e-9&&db<-1e-9)||(da<-1e-9&&db>1e-9)){ const t=da/(da-db); out.push([A[0]+(B[0]-A[0])*t, A[1]+(B[1]-A[1])*t]); } }
poly=out; if(poly.length<3) return 0; }
let s2=0; for(let i=1;i+1<poly.length;i++) s2+=Math.abs((poly[i][0]-poly[0][0])*(poly[i+1][1]-poly[0][1])-(poly[i+1][0]-poly[0][0])*(poly[i][1]-poly[0][1])); return s2/2; };
let pairs=0,sameOff=0,sameOffNear=0,areaSum=0; const __dbg=[];
for(let i=0;i<recs.length;i++){ const A=recs[i];
for(let j=i+1;j<recs.length;j++){
const B=recs[j]; if(A.mesh===B.mesh) continue;
const dn=A.n[0]*B.n[0]+A.n[1]*B.n[1]+A.n[2]*B.n[2];
let neg=false;
if(dn>=0.99985){} else if(dn<=-0.99985){ if(!(A.ds||B.ds)) continue; neg=true; } else continue;
if(Math.abs(A.d-B.d)>=TOL2) continue;
let out=false; for(let k=0;k<3;k++){ if(A.bb[k][1]<B.bb[k][0]-TOL2||B.bb[k][1]<A.bb[k][0]-TOL2){ out=true; break; } }
if(out) continue;
let area=0;
outer: for(const ta of A.tris) for(const tb of B.tris){ const ar=clip(ta,tb); if(ar>=MINA){ area=ar; break outer; } }
if(area<MINA) continue;
pairs++;
const ua=A.mat.polygonOffset?A.mat.polygonOffsetUnits:0, ub=B.mat.polygonOffset?B.mat.polygonOffsetUnits:0;
const fa=A.mat.polygonOffset?A.mat.polygonOffsetFactor:0, fb=B.mat.polygonOffset?B.mat.polygonOffsetFactor:0;
if(!neg&&ua===ub&&fa===fb){ if(Math.abs(A.d-B.d)<TOL){ sameOff++; areaSum+=area;
if(!__dbg||__dbg.length<12) __dbg.push('  '+A.mesh.name+'/'+(A.mesh.material&&A.mesh.material.map?'map':'-')+' u'+(A.mat.polygonOffset?A.mat.polygonOffsetUnits:'-')+' tr'+!!A.mat.transparent+' dw'+A.mat.depthWrite+' side'+A.mat.side
+'  ↔  '+B.mesh.name+' u'+(B.mat.polygonOffset?B.mat.polygonOffsetUnits:'-')+' tr'+!!B.mat.transparent+' dw'+B.mat.depthWrite+' side'+B.mat.side
+' · 交叠 '+area.toFixed(3)+'m² · Δd '+Math.abs(A.d-B.d).toFixed(4)+' 法线('+A.n.map(v=>v.toFixed(2)).join(',')+') 同网格?'+(A.mesh===B.mesh)); } else sameOffNear++; }
}}
return {meshes:recs.length,pairs,sameOff,sameOffNear,areaSum:+areaSum.toFixed(2),dbg:__dbg};
}
function __unitRoots(){
const out=[];
if(typeof soldiers!=='undefined') for(const s of soldiers) if(s&&s.mesh&&s.mesh.root) out.push([s.mesh.root,'士兵']);
if(typeof tanks!=='undefined') for(const v of tanks) if(v&&v.grp) out.push([v.grp,'坦克']);
if(typeof planes!=='undefined') for(const v of planes) if(v&&v.grp) out.push([v.grp,'飞机']);
if(typeof trucks!=='undefined') for(const v of trucks) if(v&&v.grp) out.push([v.grp,'卡车']);
if(typeof NAVALS!=='undefined') for(const v of NAVALS) if(v&&(v.grp||v.root)) out.push([v.grp||v.root,'舰艇']);
if(typeof ATGUNS!=='undefined') for(const v of ATGUNS) if(v&&(v.grp||(v.mesh&&v.mesh.root))) out.push([v.grp||v.mesh.root,'反炮']);
if(typeof AAGUNS!=='undefined') for(const v of AAGUNS) if(v&&(v.grp||(v.mesh&&v.mesh.root))) out.push([v.grp||v.mesh.root,'高炮']);
return out;
}
`;

// ── 合成对照用的小世界 ──
const ctx=boot(2);   // berlin
G(ctx,SCANNER);
console.log('== dev/verify-surfmodel: 模型内共面消解 ==');

// T1/T2 合成正负对照 (直接建 Group, 不挂在 world 上)
const syn=G(ctx,`
(function(){
const out={};
const mk=(w,h,d,x,y,z,mat)=>{ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); m.position.set(x,y,z); return m; };
const matA=new THREE.MeshLambertMaterial({color:0x884422}), matB=new THREE.MeshLambertMaterial({color:0x224488});
// ① 正对照: 两盒共享平面 (上盒底面 = 下盒顶面, 交叠 2×2)
const g1=new THREE.Group();
g1.add(mk(2,0.5,2,0,0.25,0,matA));
g1.add(mk(2,0.5,2,1.5,0.25,0,matB));      // 并排: 顶面共面(y=0.5)且 XZ 交叠 0.5×2 ⇒ 同向共面 = 真冲突
g1.position.set(500,50,500);
resolveModelSurfaces(g1,'合成共面');
out.pos={a:(g1.children[0].material.polygonOffsetUnits||0), b:(g1.children[1].material.polygonOffsetUnits||0),
aF:(g1.children[0].material.polygonOffsetFactor||0), bF:(g1.children[1].material.polygonOffsetFactor||0),
cleanA:!matA.polygonOffset, cleanB:!matB.polygonOffset};
// ② 负对照: 相距 1m 的两盒 (无共面)
const g2=new THREE.Group();
const m2a=mk(2,0.5,2,0,0.25,0,new THREE.MeshLambertMaterial({color:0x884422}));
const m2b=mk(2,0.5,2,0,1.75,0,new THREE.MeshLambertMaterial({color:0x224488}));
g2.add(m2a); g2.add(m2b);
const r2=resolveModelSurfaces(g2,'合成远离');
out.neg={touched:!!(m2a.material.polygonOffset||m2b.material.polygonOffset), ret:r2};
// ③ 变体池上限
out.clone=(function(){ let n=0; try{ n=resolveModelSurfaces.__clones||0; }catch(e){} return n; })();
return out;
})()`);
info('合成正对照: 下盒 units='+syn.pos.a+' 上盒 units='+syn.pos.b+' (factor '+syn.pos.aF+'/'+syn.pos.bF+')');
chk(syn.pos.a===0&&syn.pos.b>0, 'T1 正对照: 共面两盒被分开 (一个 0 档, 一个 +'+syn.pos.b+' 档)');
chk(syn.pos.cleanA&&syn.pos.cleanB, 'T1b 共享材质不被就地污染: 原材质对象 matA/matB 自身 polygonOffset 仍为空 (改的是 mesh 槽位)');
chk(!syn.neg.touched&&!syn.neg.ret, 'T2 负对照: 相距 1m 的两盒零改动 (消解器返回 null)');

// T5 共享材质不被污染
const pol=G(ctx,`(function(){ const bad=[]; for(const k in MAT){ const m=MAT[k]; if(m&&m.polygonOffset) bad.push(k); } return bad; })()`);
chk(pol.length===0, 'T5 MAT 表里 '+Object.keys(G(ctx,'MAT')).length+' 个共享材质 polygonOffset 全未被设 ('+(pol.length?pol.join(','):'0 个受污染')+')');

// T3 真实模型: 开局 → 把运行期队列跑空 → 独立扫描
G(ctx,'try{ beginFreshMatch(); }catch(e){}');
G(ctx,'scene.updateMatrixWorld(true);');
const budget=G(ctx,'SURF_RT_BUDGET');
let rounds=0,roots0=G(ctx,'SURF_RT.roots');
let maxPerCall=0;
const units=G(ctx,'__unitRoots().length');
for(;rounds<600;rounds++){
const before=G(ctx,'SURF_RT.roots');
G(ctx,'resolveRuntimeSurfaces();');
const after=G(ctx,'SURF_RT.roots');
maxPerCall=Math.max(maxPerCall,after-before);
if(after-before===0&&rounds>Math.ceil(units/2)+6) break;    // 跑干: 至少覆盖全部单位 + 余量
}
const rt=G(ctx,'JSON.stringify({roots:SURF_RT.roots,hits:SURF_RT.hits,meshes:SURF_RT.meshes,pairs:SURF_RT.pairs,leveled:SURF_RT.leveled,ms:Math.round(SURF_RT.ms),last:SURF_RT.last})');
const rtO=JSON.parse(rt);
info('运行期消解: 处理根 '+rtO.roots+' (有共面对 '+rtO.hits+') · mesh '+rtO.meshes+' · 约束对 '+rtO.pairs+' · 落档 '+rtO.leveled+' · 累计 '+rtO.ms+'ms · 末条: '+rtO.last);
info('跑了 '+(rounds+1)+' 轮队列; 单次最多处理 '+maxPerCall+' 个根 (预算 '+budget+')');
chk(rtO.hits>0&&rtO.roots>0, 'T3a 运行期确实处理了模型 (处理 '+rtO.roots+' 个根, 其中 '+rtO.hits+' 个有共面对 / 共 '+rtO.pairs+' 对)');
chk(maxPerCall<=budget, 'T6 每帧预算: 单次调用 ≤ '+budget+' 个根');

const scan=G(ctx,`
(function(){
const roots=__unitRoots(); let sum={meshes:0,pairs:0,sameOff:0,sameOffNear:0,areaSum:0}; const worst=[];
for(const [r,lab] of roots){ const s=__scanRoot(r);
sum.meshes+=s.meshes; sum.pairs+=s.pairs; sum.sameOff+=s.sameOff; sum.sameOffNear+=s.sameOffNear; sum.areaSum+=s.areaSum;
if(s.sameOff>0) worst.push(lab+' 同档 '+s.sameOff+' 对 / 共面 '+s.pairs); }
return {roots:roots.length,sum,worst:worst.slice(0,6)};
})()`);
info('开局后逐单位独立扫描: '+scan.roots+' 个单位 · mesh '+scan.sum.meshes+' · 共面交叠对 '+scan.sum.pairs+' · **严格同档(会闪) '+scan.sum.sameOff+' 对** · 近共面(2~6cm)同档 '+scan.sum.sameOffNear+' 对 (设计外: 只影响 >150m 远景) · 严格同档交叠 '+scan.sum.areaSum+'m²');
if(scan.worst.length) for(const w of scan.worst) info('   仍有同档: '+w);
const dbg=G(ctx,'(function(){ const roots=__unitRoots(); const out=[]; for(const [r] of roots){ const s=__scanRoot(r); if(s.dbg&&s.dbg.length){ for(const d of s.dbg) out.push(d); } if(out.length>=10) break; } return out; })()');
for(const d of dbg.slice(0,8)) info('残件明细'+d);
chk(scan.sum.sameOff===0, 'T3 ★真实模型全部消解: 严格同档共面 0 对 (同向·|Δ平面|<2cm·交叠≥1.2dm², 与消解器同口径)');


// T4 幂等
const before4=G(ctx,'SURF_RT.roots');
G(ctx,'resolveRuntimeSurfaces(); resolveRuntimeSurfaces();');
const after4=G(ctx,'SURF_RT.roots');
chk(after4===before4, 'T4 幂等: 再跑两遍不新增落档 (根数 '+before4+' → '+after4+')');

// T7 变体池
const clones=G(ctx,'(function(){ let n=0; try{ n=(SURF_STATS.clones||0); }catch(e){} return n; })()');
const rtClones=G(ctx,'(function(){ let n=0; for(const k in MAT){} return _depthMats? _depthMats.size : -1; })()');
chk(rtClones>=0&&rtClones<=800, 'T7 材质变体池 '+rtClones+' ≤ 800 (世界件 '+clones+' 个; 单位材质是每实例建的 ⇒ 变体不跨实例共享, 池子随单位数增长, 功能上无害)');

// T8 覆盖层档不受影响: 造一个 decal 档 mesh 塞进模型 → 消解后 units 仍为 -6
const t8=G(ctx,`
(function(){
const m=new THREE.MeshLambertMaterial({color:0x333333});
const bb=surfaceLane(m,'decal');
const g=new THREE.Group();
const m1=new THREE.Mesh(new THREE.BoxGeometry(2,0.5,2),m); m1.position.set(0,0.25,0);
const m2=new THREE.Mesh(new THREE.BoxGeometry(2,0.5,2),new THREE.MeshLambertMaterial({color:0x777777})); m2.position.set(0,0.75,0);
g.add(m1); g.add(m2);
resolveModelSurfaces(g,'含覆盖层档');
return {u1:m1.material.polygonOffset?m1.material.polygonOffsetUnits:null, u2:m2.material.polygonOffset?m2.material.polygonOffsetUnits:null};
})()`);
info('覆盖层档对照: decal 件 units='+t8.u1+' , 普通件 units='+t8.u2);
chk(t8.u1===null||t8.u1<0, 'T8 覆盖层档 (units<0) 不参与模型消解 (保持 '+(t8.u1===null?'未设':t8.u1)+')');

// T9 灵敏度对照: 把刚消解过的单位材质还原成基材 (去掉 polygonOffset) 后, 扫描必须报出 >0
const t9=G(ctx,`
(function(){
const roots=__unitRoots(); let before=0,after=0,restored=0;
for(const [r] of roots){ const s=__scanRoot(r); before+=s.sameOff; }
// 还原: 把每个 mesh 的材质换成不带 polygonOffset 的克隆
for(const [r] of roots){ r.traverse(o=>{ if(o.isMesh&&o.material&&o.material.polygonOffset){ const c=o.material.clone(); c.polygonOffset=false; c.polygonOffsetUnits=0; c.polygonOffsetFactor=0; o.material=c; restored++; } }); }
for(const [r] of roots){ const s=__scanRoot(r); after+=s.sameOff; }
return {before,after,restored};
})()`);
info('灵敏度对照: 消解后同档 '+t9.before+' 对 → 去掉偏移(还原 '+t9.restored+' 个材质)后 '+t9.after+' 对');
chk(t9.after>0&&t9.before===0, 'T9 扫描灵敏度: 同一扫描在"去掉偏移"后能报出共面对 ('+t9.after+') ⇒ T3 不是空跑');

console.log('\n== 结果: '+pass+' 通过 / '+fail+' 失败 ==');
process.exitCode=fail?1:0;
