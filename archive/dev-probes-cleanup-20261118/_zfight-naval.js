// dev/_zfight-naval.js —— 海战载具 (15e navBuildModel) 模型内共面闪烁扫描 + 消解前后对比
// 用法: node --stack-size=4000 dev/_zfight-naval.js [campaignId]
//
// 背景: 用户实机截图报"船顶部一直图层打架"。艇体是 15e 的**箱体拼装** (干舷三段 + 甲板三段 + 舰桥…),
//   甲板段顶面 = 干舷段顶面同高 ⇒ 天生共面。本工具按真三角形分组 (同 _zfight-tri 口径) 逐对量:
//   ① 消解前有多少对"同档双写深度"的共面片 (会闪的);
//   ② resolveModelSurfaces(root) 之后还剩多少 (验证模型级消解器对艇体是否有效);
//   ③ 每对打印件名/材质/法轴/平面差/交叠面积 —— 直接指出是哪两块板在打架。
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
const TOL=0.02, TOL2=0.06, MINAREA=0.012, MAXTRI=4000;
const out=[];
function matTag(m){
if(!m) return '?';
const nm=(m.map&&m.map.__name)?('map:'+m.map.__name):(m.map?'map':'-');
const col=(m.color&&m.color.getHex)?('#'+m.color.getHex().toString(16).padStart(6,'0')):'-';
const po=m.polygonOffset===true?('off'+m.polygonOffsetFactor+'/'+m.polygonOffsetUnits):'off-';
return nm+' '+col+' '+po;
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
function namePath(o,stop){
const s=[]; let t=o;
while(t&&t!==stop){ s.push(t.name||('('+(t.type||'?')+')')); t=t.parent; }
return s.reverse().join('/');
}
// 扫描一个根: 返回会闪对 (同档双写深度的共面片对)
function scan(r){
r.updateMatrixWorld(true);
const recs=[];
r.traverse(o=>{
if(o.visible===false||o.count!==undefined||!o.isMesh) return;
const g=o.geometry,m=o.material; if(!g||!m||!g.attributes||!g.attributes.position) return;
if(Array.isArray(m)) return;
const t=localTris(g); if(!t||!t.length||t.length>MAXTRI) return;
const e=o.matrixWorld.elements;
const groups=new Map(); const bb=[[1e9,-1e9],[1e9,-1e9],[1e9,-1e9]];
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
for(const q of P) for(let k=0;k<3;k++){ if(q[k]<gr.bb[k][0]) gr.bb[k][0]=q[k]; if(q[k]>gr.bb[k][1]) gr.bb[k][1]=q[k]; }
}
for(const [,gr] of groups) recs.push({mesh:o,mat:m,n:gr.n,d:gr.d,tris:gr.tris,bb:gr.bb,
name:namePath(o,r),tag:matTag(m),dw:!(m.transparent===true&&m.depthWrite===false),
units:m.polygonOffset===true?(m.polygonOffsetUnits||0):0,fac:m.polygonOffset===true?(m.polygonOffsetFactor||0):0,
ds:m.side===2,
ctr:(()=>{ const e2=o.matrixWorld.elements; return [e2[12],e2[13],e2[14]]; })()});
});
const pairs=[];
for(let i=0;i<recs.length;i++) for(let j=i+1;j<recs.length;j++){
const A=recs[i],B=recs[j];
if(A.mesh===B.mesh) continue;
const dn=A.n[0]*B.n[0]+A.n[1]*B.n[1]+A.n[2]*B.n[2];
let opp=false;
if(dn>=0.99985) opp=false;
else if(dn<=-0.99985){ if(!(A.ds||B.ds)) continue; opp=true; }
else continue;
const dOff=opp?Math.abs(A.d+B.d):Math.abs(A.d-B.d);
if(dOff>=TOL) continue;
let o2=false; for(let k=0;k<3;k++){ if(A.bb[k][1]<B.bb[k][0]-TOL2||B.bb[k][1]<A.bb[k][0]-TOL2){ o2=true; break; } }
if(o2) continue;
let area=0;
outer: for(const ta of A.tris) for(const tb of B.tris){ const ar=clipArea(ta,tb); if(ar>=MINAREA){ area=ar; break outer; } }
if(area<MINAREA) continue;
if(!A.dw||!B.dw) continue;
const sep=(A.units!==B.units||A.fac!==B.fac);
const ax=(()=>{ const a=[Math.abs(A.n[0]),Math.abs(A.n[1]),Math.abs(A.n[2])]; const k=a[0]>=a[1]&&a[0]>=a[2]?0:(a[1]>=a[2]?1:2); return a[k]>0.9998?k:-1; })();
pairs.push({A,B,area,ax,opp,dOff,sep,plane:-(opp?-A.d:A.d)});
}
return pairs;
}
function fmt(p){
const axs=['X','Y','Z'][p.ax]||'斜';
return p.A.name+' ['+p.A.tag+'] ↔ '+p.B.name+' ['+p.B.tag+'] · 法轴'+axs+(p.opp?'(反向)':'(同向)')
+' · 平面差 '+(p.dOff*1000).toFixed(1)+'mm · 交叠 '+p.area.toFixed(3)+'m² · 平面 y='+p.plane.toFixed(3)
+' · 档 '+p.A.units+'/'+p.A.fac+' vs '+p.B.units+'/'+p.B.fac+(p.sep?' [已分开]':' [★同档=会闪]');
}
for(const k of ['lvt','kami','pt','gyorai']){
const S=(typeof NAVAL_SPEC!=='undefined')?NAVAL_SPEC[k]:null;
if(!S||typeof navBuildModel!=='function'){ out.push({k,err:'无 spec 或 navBuildModel'}); continue; }
let M=null;
try{ M=navBuildModel(S); }catch(e){ out.push({k,err:'navBuildModel 抛错: '+(e&&e.message)}); continue; }
const r=M.grp;
const before=scan(r);
const cnt=m=>{ const s=new Set(); r.traverse(o=>{ if(o.isMesh&&o.material) s.add(o.material); }); return s.size; };
const mats0=cnt();
let msg='';
try{ if(typeof resolveModelSurfaces==='function'){ const st=resolveModelSurfaces(r,'艇-'+k); msg=(typeof _lastModelLog==='string')?_lastModelLog:''; } }
catch(e){ msg='消解抛错: '+(e&&e.message); }
const after=scan(r);
out.push({k,name:S.name,kind:S.kind,L:S.hullL,W:S.hullW,H:S.hullH,deckY:(M.dims&&M.dims.deckY),
mats:mats0,before:before.map(fmt),after:after.map(fmt),
beforeN:before.length,afterN:after.length,msg,
beforeArea:+before.reduce((a,p)=>a+p.area,0).toFixed(3),afterArea:+after.reduce((a,p)=>a+p.area,0).toFixed(3)});
}
// ── 运行期拾取验证 (2026-09-27M 修的 NAVALS→navalCraft 就是这条链) ──
// 复刻实机路径: 建模 → 挂进 world → 塞进 navalCraft → 跑运行期队列 → 看艇根有没有被处理
(function(){
if(typeof resolveRuntimeSurfaces!=='function'||typeof SURF_RT==='undefined'){ out.push({k:'rt',err:'无运行期消解器'}); return; }
const r0=SURF_RT.roots, leveled0=SURF_RT.leveled;
const MB=navBuildModel(NAVAL_SPEC.pt);
world.add(MB.grp);
navalCraft.push({grp:MB.grp});
let miss=0;
for(let i=0;i<600&&miss<2;i++){ const b=SURF_RT.roots; resolveRuntimeSurfaces(); if(SURF_RT.roots===b) miss++; else miss=0; }
const lv=new Map();
MB.grp.traverse(o=>{ if(!o.isMesh||!o.material||Array.isArray(o.material)) return;
const m=o.material, u=(m.polygonOffset===true)?(m.polygonOffsetUnits||0):0;
const key=(m.map&&m.map.__name)?m.map.__name:'(noMap)';
const e=lv.get(key)||new Set(); e.add(u); lv.set(key,e); });
out.push({k:'rt',roots0:r0,roots1:SURF_RT.roots,leveled:leveled0,
matUnits:[...lv.entries()].map(([k,v])=>k+':'+[...v].join('/')).join(' ')});
})();
return out;
})()
`;
const want=process.argv.slice(2);
const list=vm.runInContext('CAMPAIGNS.map((c,i)=>[i,c.id])',boot(0));
const idx=(want[0]&&list.find(l=>l[1]===want[0]))?list.find(l=>l[1]===want[0])[0]:list.find(l=>l[1]==='island')[0];
const ctx=boot(idx);
let r;
try{ r=vm.runInContext(PAGE,ctx,{filename:'naval'}); }
catch(e){ console.log('异常: '+(e&&e.stack?e.stack.split('\n').slice(0,5).join('\n'):e)); process.exit(1); }
for(const o of r){
if(o.err){ console.log(`\n=== ${o.k}  ${o.err}`); continue; }
if(o.k==='rt'){ console.log('\n=== 运行期拾取: SURF_RT.roots '+o.roots0+' → '+o.roots1+' (累计落档 '+o.leveled+')'); console.log('    艇上各贴图的档位: '+o.matUnits); continue; }
console.log(`\n=== ${o.k}  ${o.name}  (L${o.L} W${o.W} H${o.H} deckY=${o.deckY})  材质 ${o.mats}`);
console.log(`    消解前 ${o.beforeN} 对 / ${o.beforeArea}m²   消解后 ${o.afterN} 对 / ${o.afterArea}m²`);
if(o.msg) console.log('    '+o.msg);
for(const s of o.before) console.log('    [前] '+s);
for(const s of o.after) console.log('    [后] '+s);
}
