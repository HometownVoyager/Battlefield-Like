// ─────────────────────────────────────────────
// dev/_bldview.js —— 建筑外观离线渲染器 (纯 Node, 真 three + 桩渲染器 + 全脚本链)
// 用法: node --stack-size=4000 dev/_bldview.js [战役idx=0] [类型=twoStory] [序号=0] [视图=front|iso|side]
//       类型按 BUILD_REG.type 前缀匹配 (barn/twoStory/block/church/ruinedHouse/silkFactory...)
// 输出: dev/_bld-<类型><序号>-<视图>.png + 终端打印目标建筑逐件材质/UV密度清单
//
// 为什么有这个 (2026-09-28, 用户实报"不可破坏建筑各部分材质一致性差劲, 像挨了涂鸦"):
//   UV 密度审计 (_uvdensity-audit) 只能证明"同一材质密度一致", 证明不了"看到的画面一致" ——
//   render-model.js 的教训: 数值全对, 只有"看一张图"暴露。本工具把浏览器实际显示的 **SVG 精修贴图**
//   (SVGTEX[name].make() 的图形层逐元素 + feTurbulence 噪声层按同参数程序化重建) 栅格化成像素,
//   对真 three 建出的世界做透视软件渲染, 让沙箱复现实机观感。
// 口径: 与 render-model.js 同源 (boot 全链 → 收集三角 → 手写 PNG); 贴图采样 = UV×repeat 取色,
//   材质 color 与顶点色做乘法, Lambert 直射+半球光。噪声层是近似重建 (非 feTurbulence 逐位一致),
//   图形层 (砖块/石块/板条/瓦片) 与 SVG 元素一一对应 —— 判断"图案尺度/接缝/色斑"足够。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),zlib=require('zlib');
const stub=require('./_bootstub.js');
const root=path.resolve(__dirname,'..');
const CAMP=parseInt(process.argv[2]||'0',10), TYPE=process.argv[3]||'twoStory', IDXC=parseInt(process.argv[4]||'0',10), VIEW=process.argv[5]||'front';
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
vm.runInContext('THREE = globalThis.THREE;',ctx,{filename:'bind-three'});
vm.runInContext(RENDERER_STUB,ctx,{filename:'stub-renderer'});
for(const f of FILES) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
return ctx;
}
// ── 收集目标附近的世界三角 ──
const COLLECT=`
function __collect(cx,cz,rad){
world.updateMatrixWorld(true);
const TNAME=new Map();
for(const k in TEX) if(TEX[k]&&typeof TEX[k]==='object') TNAME.set(TEX[k],k);
const V=new THREE.Vector3(), N3=new THREE.Matrix3();
const tris=[];
world.traverse(o=>{
if(!o.isMesh||o.isInstancedMesh||o.isPoints||o.isLine) return;
const g=o.geometry, m=o.material; if(!g||!m) return;
const mats=Array.isArray(m)?m:[m];
if(mats.some(mm=>mm.transparent||mm.opacity<1)) return;
const tname=(mats[0]&&mats[0].map&&TNAME.get(mats[0].map))||null;
if(tname==='leaves') return;
const p=g.attributes.position; if(!p) return;
const uvA=g.attributes.uv, clA=g.attributes.color, nA=g.attributes.normal;
const idx=g.index?g.index.array:null;
const cnt=idx?idx.length:p.count;
const segOf=[];
if(g.groups&&g.groups.length&&Array.isArray(m)) for(const gr of g.groups) for(let i=gr.start;i<gr.start+gr.count;i++) segOf[idx?idx[i]:i]=gr.materialIndex;
if(!o.matrixWorld) o.updateWorldMatrix(true,false);
const col=mats[0]&&mats[0].color?mats[0].color:0xffffff;
const crep=mats[0]&&mats[0].map?mats[0].map.repeat:{x:1,y:1};
for(let t=0;t<cnt;t+=3){
const ids=idx?[idx[t],idx[t+1],idx[t+2]]:[t,t+1,t+2];
const mi=segOf[ids[0]]!==undefined?segOf[ids[0]]:0;
const mm=mats[mi]||mats[0];
const P=[],U=[],C=[];
let mx=0,my=0,mz=0;
for(const i of ids){
V.set(p.getX(i),p.getY(i),p.getZ(i)).applyMatrix4(o.matrixWorld);
P.push([V.x,V.y,V.z]); mx+=V.x; my+=V.y; mz+=V.z;
U.push(uvA?[uvA.getX(i),uvA.getY(i)]:[0,0]);
}
mx/=3; my/=3; mz/=3;
const d2=(mx-cx)*(mx-cx)+(mz-cz)*(mz-cz);
if(d2>rad*rad) continue;
const nrm=mm&&mm.color?mm.color:(col||0xffffff);
tris.push({P,U,nrm,vc:clA?1:0,
v0:clA?[clA.getX(ids[0]),clA.getY(ids[0]),clA.getZ(ids[0])]:null,
v1:clA?[clA.getX(ids[1]),clA.getY(ids[1]),clA.getZ(ids[1])]:null,
v2:clA?[clA.getX(ids[2]),clA.getY(ids[2]),clA.getZ(ids[2])]:null,
tn:mm&&mm.map&&TNAME.get(mm.map)||null,
rep:mm&&mm.map?[mm.map.repeat.x,mm.map.repeat.y]:[1,1]});
}
});
return tris;
}
`;
// ── 目标建筑信息 ──
const ctx=boot(CAMP);
const Q=s=>vm.runInContext(s,ctx);
Q(COLLECT);
console.log(`战役 #${CAMP} (${Q('CAMPAIGN.title||CAMPAIGN.id')})  seed=${Q('WORLD_SEED')}`);
const reg=Q(`JSON.stringify(BUILD_REG.map(b=>({type:b.type,x:+b.x.toFixed(1),z:+b.z.toFixed(1),w:b.w||0,d:b.d||0,floor:+(b.floor||0).toFixed(2),indestr:!!b.indestr})))`);
const buildings=JSON.parse(reg).filter(b=>b.type.startsWith(TYPE));
if(!buildings.length){ console.error('BUILD_REG 里无此类型: '+TYPE+'  现有: '+[...new Set(JSON.parse(reg).map(b=>b.type))].join(',')); process.exit(1); }
const B=buildings[Math.min(IDXC,buildings.length-1)];
console.log(`目标: ${B.type}#${IDXC} @ (${B.x},${B.z})  ${B.w}×${B.d}  indestr=${B.indestr}`);
const rad=Math.max(B.w,B.d)*1.35+8;
const tris=Q(`__collect(${B.x},${B.z},${rad})`);
console.log(`采集三角 ${tris.length} (半径 ${rad.toFixed(0)}m)`);
// ── 逐件清单 (同位置同尺寸去重) ──
{
const seen=new Map();
for(const t of tris){
if(!t.tn) continue;
const w=Math.hypot(t.P[1][0]-t.P[0][0],t.P[1][1]-t.P[0][1],t.P[1][2]-t.P[0][2]);
const key=t.tn+'|'+t.P.map(p=>p.map(v=>+v.toFixed(1)).join(',')).join(';');
if(seen.has(key)) continue; seen.set(key,1);
}
}
// ── SVG 贴图栅格化 (浏览器显示版) ──
function hexOrRgb(s){
if(!s||s==='none') return null;
let m=/rgba?\(([^)]+)\)/.exec(s);
if(m){ const p=m[1].split(',').map(v=>parseFloat(v)); return [p[0],p[1],p[2],p[3]===undefined?1:p[3]]; }
m=/^#([0-9a-f]{6})$/i.exec(s.trim());
if(m) return [parseInt(m[1].slice(0,2),16),parseInt(m[1].slice(2,4),16),parseInt(m[1].slice(4,6),16),1];
m=/^#([0-9a-f]{3})$/i.exec(s.trim());
if(m) return [parseInt(m[1][0]+m[1][0],16),parseInt(m[1][1]+m[1][1],16),parseInt(m[1][2]+m[1][2],16),1];
return null;
}
// 平铺 value 噪声 (近似 feTurbulence fractalNoise: 每通道独立, 格点 hash + 双线性, 周期取整保证可平铺)
function makeNoise(fx,fy,oct,size){
const latt=[];
for(let o=0;o<oct;o++){
const f=Math.max(2,Math.round(size*(o===0?Math.max(fx,fy):Math.max(fx,fy)*Math.pow(2,o))));
const g=new Float32Array(f*f*3);
let s=(o*2654435761+12345)>>>0;
for(let i=0;i<f*f*3;i++){ s=(s*1664525+1013904223)>>>0; g[i]=(s&0xffff)/0xffff; }
latt.push({f,g});
}
return (x,y)=>{
let r=0,g2=0,b=0,norm=0;
for(let o=0;o<oct;o++){
const L=latt[o], f=L.f;
const xx=x/size*f, yy=y/size*f;
const x0=Math.floor(xx), y0=Math.floor(yy);
const tx=xx-x0, ty=yy-y0;
const at=(i,j,c)=>L.g[(((j%f+f)%f)*f+((i%f+f)%f))*3+c];
const sm=t=>t*t*(3-2*t);
const sx=sm(tx), sy=sm(ty);
for(let c=0;c<3;c++){
const a=at(x0,y0,c)+(at(x0+1,y0,c)-at(x0,y0,c))*sx;
const b2=at(x0,y0+1,c)+(at(x0+1,y0+1,c)-at(x0,y0+1,c))*sx;
const v=a+(b2-a)*sy;
if(c===0)r+=v; else if(c===1)g2+=v; else b+=v;
}
norm+=1;
}
return [r/norm,g2/norm,b/norm];
};
}
function rasterSVG(name){
const e=Q(`(function(){ const saved=Math.random; Math.random=(function(){let s=${(name.length*7919+IDXC*104729+CAMP+99991)>>>0};return function(){s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff;};})(); try{ return SVGTEX[${JSON.stringify(name)}]?SVGTEX[${JSON.stringify(name)}].make():null; } finally{ Math.random=saved; } })()`);
if(e===null||e===undefined) return null;
const W=e.w||256,H=e.h||256;
const buf=new Float32Array(W*H*4);
const base=/fill="(#[0-9a-f]{3,6}|rgba?\([^"]*\))"[^>]*width="100%"/.exec(e.body||e);
const put=(x,y,r,g,b,a)=>{
if(x<0||y<0||x>=W||y>=H) return;
const i=(y*W+x)*4, oa=buf[i+3];
const na=a+oa*(1-a);
if(na<=0) return;
buf[i]=(r*a+buf[i]*oa*(1-a))/na; buf[i+1]=(g*a+buf[i+1]*oa*(1-a))/na; buf[i+2]=(b*a+buf[i+2]*oa*(1-a))/na; buf[i+3]=na;
};
const fillPoly=(pts,col,op)=>{
if(!col||pts.length<2) return;
let y0=1e9,y1=-1e9;
for(const p of pts){ y0=Math.min(y0,p[1]); y1=Math.max(y1,p[1]); }
y0=Math.max(0,Math.floor(y0)); y1=Math.min(H-1,Math.ceil(y1));
for(let y=y0;y<=y1;y++){
const xs=[];
for(let i=0;i<pts.length;i++){
const a=pts[i], b=pts[(i+1)%pts.length];
if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y)) xs.push(a[0]+(y-a[1])/(b[1]-a[1])*(b[0]-a[0]));
}
xs.sort((p,q)=>p-q);
for(let k=0;k+1<xs.length;k+=2){
const xa=Math.max(0,Math.round(xs[k])), xb=Math.min(W-1,Math.round(xs[k+1]));
for(let x=xa;x<=xb;x++) put(x,y,col[0],col[1],col[2],op*(col[3]===undefined?1:col[3]));
}
}
};
const strokePoly=(pts,col,wid,op,close)=>{
if(!col||!pts.length) return;
const hw=Math.max(0.5,wid/2);
const segs=close?[...pts,pts[0]]:pts;
for(let i=0;i+1<segs.length;i++){
const a=segs[i], b=segs[i+1];
const x0=Math.max(0,Math.floor(Math.min(a[0],b[0])-hw)), x1=Math.min(W-1,Math.ceil(Math.max(a[0],b[0])+hw));
const y0=Math.max(0,Math.floor(Math.min(a[1],b[1])-hw)), y1=Math.min(H-1,Math.ceil(Math.max(a[1],b[1])+hw));
const dx=b[0]-a[0], dy=b[1]-a[1], L2=dx*dx+dy*dy||1;
for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
const t=clamp(((x-a[0])*dx+(y-a[1])*dy)/L2,0,1);
const px=a[0]+dx*t, py=a[1]+dy*t;
const d=Math.hypot(x-px,y-py);
if(d<=hw) put(x,y,col[0],col[1],col[2],op*(col[3]===undefined?1:col[3]));
}
}
};
const ellipseF=(cx,cy,rx,ry,col,op)=>{
if(!col) return;
const y0=Math.max(0,Math.floor(cy-ry)), y1=Math.min(H-1,Math.ceil(cy+ry));
for(let y=y0;y<=y1;y++){
const t=(y-cy)/ry; if(Math.abs(t)>1) continue;
const hx=rx*Math.sqrt(1-t*t);
for(let x=Math.max(0,Math.round(cx-hx));x<=Math.min(W-1,Math.round(cx+hx));x++) put(x,y,col[0],col[1],col[2],op*(col[3]===undefined?1:col[3]));
}
};
// 解析 filter 定义 (feTurbulence baseFrequency/numOctaves + feColorMatrix 的 rgb/s/bias)
const filters=new Map();
{
const reF=/<filter id="([^"]+)"[^>]*>(.*?)<\/filter>/gs;
let m;
while((m=reF.exec(e.body||e))){
const tb=/feTurbulence[^>]*baseFrequency="([\d.]+)(?:\s+([\d.]+))?"[^>]*numOctaves="(\d+)"/.exec(m[2]);
const cm=/feColorMatrix[^>]*values="([^"]+)"/.exec(m[2]);
if(!tb||!cm) continue;
const v=cm[1].trim().split(/\s+/).map(Number);
filters.set(m[1],{fx:parseFloat(tb[1]),fy:tb[2]!==undefined?parseFloat(tb[2]):parseFloat(tb[1]),oct:+tb[3],R:v[4],G:v[9],B:v[14],s:v[12],bias:v[19]});
}
}
const grad=new Map(); // url(#id) → 兜底色
{
const reG=/<radialGradient id="([^"]+)"[^>]*>(.*?)<\/radialGradient>/gs;
let m; while((m=reG.exec(e.body||e))){
const stops=[...m[2].matchAll(/stop-color="(rgb\([^)]*\)|#[0-9a-f]{3,6})"/g)].map(s=>hexOrRgb(s[1]));
if(stops.length) grad.set(m[1],stops[Math.floor(stops.length/2)]);
}
}
const body=e.body||e;
// 逐元素顺序绘制 (rect/line/ellipse/circle/path; rect 带 filter= 的走噪声层)
const reEl=/<(rect|line|ellipse|circle|path)\b([^>]*?)\/?>(?:<\/\1>)?/g;
let em;
while((em=reEl.exec(body))){
const tag=em[1], at=em[2];
const attr=k=>{ const m2=new RegExp(k+'="([^"]*)"').exec(at); return m2?m2[1]:null; };
const tr=attr('transform');
let ox=0,oy=0;
if(tr){ const mt=/translate\(([-\d.]+)[ ,]+([-\d.]+)\)/.exec(tr); if(mt){ ox=parseFloat(mt[1]); oy=parseFloat(mt[2]); } }
const op=attr('opacity')?parseFloat(attr('opacity')):1;
const fil=attr('filter');
if(fil){
const id=/url\(#([^)]+)\)/.exec(fil);
const F=id&&filters.get(id[1]);
if(F){
const nz=makeNoise(F.fx,F.fy,F.oct,Math.max(W,H));
const op2=(attr('opacity')?parseFloat(attr('opacity')):1);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
const c=nz(x+0.5,y+0.5);
let a=F.s*(c[0]+c[1]+c[2])+F.bias;
a=clamp(a,0,1)*op2;
if(a>0.003) put(x,y,F.R*255,F.G*255,F.B*255,a);
}
}
continue;
}
const fillS=attr('fill');
const fill=fillS&&fillS.startsWith('url(')?null:hexOrRgb(fillS);
const fillG=fillS&&fillS.startsWith('url(')?grad.get(/url\(#([^)]+)\)/.exec(fillS)[1]):null;
const stroke=hexOrRgb(attr('stroke'));
const sw=attr('stroke-width')?parseFloat(attr('stroke-width')):1;
if(tag==='rect'){
if(fillS&&fillS.startsWith('url(#')) { /* 渐变兜底 */ }
const x=(parseFloat(attr('x')||'0'))+ox, y=(parseFloat(attr('y')||'0'))+oy;
const w2=attr('width')==='100%'?W:parseFloat(attr('width')||'0');
const h2=attr('height')==='100%'?H:parseFloat(attr('height')||'0');
if(fill||fillG) fillPoly([[x,y],[x+w2,y],[x+w2,y+h2],[x,y+h2]],fill||fillG,op);
if(stroke){ strokePoly([[x,y],[x+w2,y],[x+w2,y+h2],[x,y+h2]],stroke,sw,op,true); }
}else if(tag==='line'){
const x1=parseFloat(attr('x1'))+ox,y1=parseFloat(attr('y1'))+oy,x2=parseFloat(attr('x2'))+ox,y2=parseFloat(attr('y2'))+oy;
strokePoly([[x1,y1],[x2,y2]],stroke||fill,sw,op,false);
}else if(tag==='ellipse'||tag==='circle'){
const cx=(parseFloat(attr('cx')||'0'))+ox, cy=(parseFloat(attr('cy')||'0'))+oy;
const rx=tag==='circle'?parseFloat(attr('r')):parseFloat(attr('rx')), ry2=tag==='circle'?parseFloat(attr('r')):parseFloat(attr('ry'));
ellipseF(cx,cy,rx,ry2,fill||fillG,op);
if(stroke) strokePoly([[cx-rx,cy],[cx,cy-ry2],[cx+rx,cy],[cx,cy+ry2]],stroke,sw,op,true);
}else if(tag==='path'){
const d=attr('d')||'';
const toks=d.match(/[MmLlHhVvQqTtZz]|-?\d*\.?\d+(?:e-?\d+)?/g)||[];
let i=0,cx=0,cy=0,sx=0,sy=0,cmd='';
const sub=[]; let cur=null;
const P=(a,b)=>[a+ox,b+oy];
while(i<toks.length){
const t=toks[i];
if(/[A-Za-z]/.test(t)){ cmd=t; i++; if(cmd==='Z'||cmd==='z'){ if(cur&&cur.length){ sub.push({pts:cur,close:true}); } cur=null; cx=sx; cy=sy; continue; } }
if(cmd==='M'||cmd==='m'){
const rel=cmd==='m';
const x=parseFloat(toks[i])+(rel?cx:0), y=parseFloat(toks[i+1])+(rel?cy:0);
if(cur&&cur.length) sub.push({pts:cur,close:false});
cur=[P(x,y)]; sx=x; sy=y; cx=x; cy=y; i+=2; cmd=rel?'l':'L';
}else if(cmd==='L'||cmd==='l'){
const rel=cmd==='l';
const x=parseFloat(toks[i])+(rel?cx:0), y=parseFloat(toks[i+1])+(rel?cy:0);
if(!cur) cur=[P(cx,cy)];
cur.push(P(x,y)); cx=x; cy=y; i+=2;
}else if(cmd==='H'||cmd==='h'){
const rel=cmd==='h';
const x=parseFloat(toks[i])+(rel?cx:0);
if(!cur) cur=[P(cx,cy)];
cur.push(P(x,cy)); cx=x; i+=1;
}else if(cmd==='V'||cmd==='v'){
const rel=cmd==='v';
const y=parseFloat(toks[i])+(rel?cy:0);
if(!cur) cur=[P(cx,cy)];
cur.push(P(cx,y)); cy=y; i+=1;
}else if(cmd==='Q'||cmd==='q'){
const rel=cmd==='q';
const qx=parseFloat(toks[i])+(rel?cx:0), qy=parseFloat(toks[i+1])+(rel?cy:0);
const x=parseFloat(toks[i+2])+(rel?cx:0), y=parseFloat(toks[i+3])+(rel?cy:0);
if(!cur) cur=[P(cx,cy)];
for(let k=1;k<=6;k++){
const t2=k/6, a=1-t2;
cur.push(P(a*a*cx+2*a*t2*qx+t2*t2*x, a*a*cy+2*a*t2*qy+t2*t2*y));
}
cx=x; cy=y; i+=4;
}else{ i++; }
}
if(cur&&cur.length) sub.push({pts:cur,close:false});
for(const s2 of sub){
if(fill||fillG) fillPoly(s2.pts,fill||fillG,op);
if(stroke) strokePoly(s2.pts,stroke,sw,op,s2.close);
else if(fillS==='none'&&attr('stroke')===null){ /* 纯形 */ }
}
}
}
const px=new Uint8ClampedArray(W*H*4);
for(let i=0;i<W*H;i++){
px[i*4]=clamp(buf[i*4],0,255); px[i*4+1]=clamp(buf[i*4+1],0,255); px[i*4+2]=clamp(buf[i*4+2],0,255);
px[i*4+3]=Math.round(clamp(buf[i*4+3],0,1)*255);
}
return {w:W,h:H,data:px};
}
// ── 需要的贴图全部预栅格化 ──
const needTex=new Set(); for(const t of tris) if(t.tn) needTex.add(t.tn);
const TEXPIX=new Map();
for(const n of needTex){
const r=rasterSVG(n);
if(r) TEXPIX.set(n,r); else TEXPIX.set(n,null);
}
// ── 采样 ──
function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
function sampleTex(name,u,v){
const t=TEXPIX.get(name);
if(!t) return null;
const W=t.w,H=t.h;
let uu=(u%1+1)%1, vv=(v%1+1)%1;
const x=Math.min(W-1,uu*W|0), y=Math.min(H-1,vv*H|0);
const i=(y*W+x)*4;
return [t.data[i],t.data[i+1],t.data[i+2]];
}
// ── 视图/投影 ──
const csB=Math.cos(0), center=[B.x,B.floor+Math.max(2.2,B.d*0.22),B.z];
// 建筑"正面"= 局部 +z (门侧): 世界方向 (sin ry, cos ry); BUILD_REG 不存 ry, 用四向都拍
const VIEWS={
front:{dir:[0,0,1]},
back:{dir:[0,0,-1]},
side:{dir:[1,0,0]},
iso:{dir:[0.72,0,0.7]},
};
const VW=VIEWS[VIEW]||VIEWS.front;
const dist=Math.max(B.w,B.d)*1.05+7;
const eye=[center[0]+VW.dir[0]*dist, center[1]+dist*0.33, center[2]+VW.dir[2]*dist];
const fwd=(()=>{ const a=[center[0]-eye[0],center[1]-eye[1],center[2]-eye[2]]; const l=Math.hypot(...a); return a.map(v=>v/l); })();
const right=(()=>{ const r=[fwd[2],0,-fwd[0]]; const l=Math.hypot(...r); return r.map(v=>v/l); })();
const up=(()=>{ const u=[right[1]*fwd[2]-right[2]*fwd[1],right[2]*fwd[0]-right[0]*fwd[2],right[0]*fwd[1]-right[1]*fwd[0]]; return [-u[0],-u[1],-u[2]]; })();
const FOV=55*Math.PI/180, tanF=Math.tan(FOV/2);
const W2=1100,H2=750;
const depth=new Float32Array(W2*H2).fill(1e9);
const img=new Uint8Array(W2*H2*3);
for(let i=0;i<W2*H2;i++){ img[i*3]=118; img[i*3+1]=126; img[i*3+2]=104; }
// 光照: 暖阳 (西偏北高处) + 天光半球
const SUN=(()=>{ const s=[-0.55,0.78,0.30]; const l=Math.hypot(...s); return s.map(v=>v/l); })();
function shadeTri(P,U,tn,rep,colHex,vc,v0,v1,v2){
const scr=[],viewZ=[];
for(let k=0;k<3;k++){
const rel=[P[k][0]-eye[0],P[k][1]-eye[1],P[k][2]-eye[2]];
const z=rel[0]*fwd[0]+rel[1]*fwd[1]+rel[2]*fwd[2];
const x=rel[0]*right[0]+rel[1]*right[1]+rel[2]*right[2];
const y=rel[0]*up[0]+rel[1]*up[1]+rel[2]*up[2];
if(z<0.15) return;
viewZ.push(z);
scr.push([(x/(z*tanF)*0.5+0.5)*W2,(0.5-y/(z*tanF*H2/W2)*0.5)*H2]);
}
const area=(scr[1][0]-scr[0][0])*(scr[2][1]-scr[0][1])-(scr[2][0]-scr[0][0])*(scr[1][1]-scr[0][1]);
if(Math.abs(area)<1e-7) return;
const n=(()=>{ const a=[P[1][0]-P[0][0],P[1][1]-P[0][1],P[1][2]-P[0][2]], b=[P[2][0]-P[0][0],P[2][1]-P[0][1],P[2][2]-P[0][2]];
const nn=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]; const l=Math.hypot(...nn)||1; return nn.map(v=>v/l); })();
if(n[0]*(eye[0]-P[0][0])+n[1]*(eye[1]-P[0][1])+n[2]*(eye[2]-P[0][2])<0){ n[0]=-n[0];n[1]=-n[1];n[2]=-n[2]; }
const dif=Math.max(0,n[0]*SUN[0]+n[1]*SUN[1]+n[2]*SUN[2]);
const light=0.42+0.30+0.62*dif; // 半球天光 + 直射
const cr=((colHex>>16)&255)/255, cg=((colHex>>8)&255)/255, cb=(colHex&255)/255;
const minx=Math.max(0,Math.floor(Math.min(scr[0][0],scr[1][0],scr[2][0]))), maxx=Math.min(W2-1,Math.ceil(Math.max(scr[0][0],scr[1][0],scr[2][0])));
const miny=Math.max(0,Math.floor(Math.min(scr[0][1],scr[1][1],scr[2][1]))), maxy=Math.min(H2-1,Math.ceil(Math.max(scr[0][1],scr[1][1],scr[2][1])));
if(maxx<0||maxy<0||minx>=W2||miny>=H2) return;
for(let y=miny;y<=maxy;y++)for(let x=minx;x<=maxx;x++){
const w0=((scr[1][0]-x)*(scr[2][1]-y)-(scr[2][0]-x)*(scr[1][1]-y))/area;
const w1=((scr[2][0]-x)*(scr[0][1]-y)-(scr[0][0]-x)*(scr[2][1]-y))/area;
const w2=1-w0-w1;
if(w0<-0.001||w1<-0.001||w2<-0.001) continue;
const z=1/(w0/viewZ[0]+w1/viewZ[1]+w2/viewZ[2]);
const o=y*W2+x;
if(z>=depth[o]) continue;
depth[o]=z;
let r,g,b;
if(tn&&TEXPIX.get(tn)){
const iw=1/z;
const u=(w0*U[0][0]*iw+w1*U[1][0]*iw+w2*U[2][0]*iw)/(w0*iw+w1*iw+w2*iw)*rep[0];
const v=(w0*U[0][1]*iw+w1*U[1][1]*iw+w2*U[2][1]*iw)/(w0*iw+w1*iw+w2*iw)*rep[1];
const c=sampleTex(tn,u,v);
if(c){ r=c[0];g=c[1];b=c[2]; } else { r=g=b=200; }
}else{ r=190;g=190;b=190; }
if(vc){
const vr=w0*v0[0]+w1*v1[0]+w2*v2[0], vg=w0*v0[1]+w1*v1[1]+w2*v2[1], vb=w0*v0[2]+w1*v1[2]+w2*v2[2];
r*=vr; g*=vg; b*=vb;
}
img[o*3]=clamp(r*cr*light,0,255); img[o*3+1]=clamp(g*cg*light,0,255); img[o*3+2]=clamp(b*cb*light,0,255);
}
}
let nDraw=0;
for(const t of tris){
const colHex=(typeof t.nrm==='number')?t.nrm:0xffffff;
shadeTri(t.P,t.U,t.tn,t.rep,colHex,t.vc,t.v0,t.v1,t.v2);
nDraw++;
}
// ── PNG ──
function crc32(buf){ let c,table=[]; for(let n=0;n<256;n++){ c=n; for(let k=0;k<8;k++) c=c&1?0xEDB88320^(c>>>1):c>>>1; table[n]=c>>>0; }
let crc=0xFFFFFFFF; for(const b of buf) crc=table[(crc^b)&255]^(crc>>>8); return (crc^0xFFFFFFFF)>>>0; }
function chunk(type,data){ const len=Buffer.alloc(4); len.writeUInt32BE(data.length); const t=Buffer.from(type,'ascii');
const body=Buffer.concat([t,data]); const crc=Buffer.alloc(4); crc.writeUInt32BE(crc32(body)); return Buffer.concat([len,body,crc]); }
const ihdr=Buffer.alloc(13); ihdr.writeUInt32BE(W2,0); ihdr.writeUInt32BE(H2,4); ihdr[8]=8; ihdr[9]=2;
const raw=Buffer.alloc((W2*3+1)*H2);
for(let y=0;y<H2;y++){ raw[y*(W2*3+1)]=0; Buffer.from(img.buffer,y*W2*3,W2*3).copy(raw,y*(W2*3+1)+1); }
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
const out=path.join(root,'dev',`_bld-${B.type}${IDXC}-${VIEW}.png`);
fs.writeFileSync(out,png);
console.log(`写出 ${out}  ${W2}x${H2}  采集 ${nDraw} 三角  贴图: ${[...needTex].map(n=>n+(TEXPIX.get(n)?'':'(无SVG!)')).join(' ')||'无'}`);
// ── 逐件材质清单: 目标 24m 内的带贴图盒面, 按 (贴图, 面宽, 面高) 汇总 ----
{
const list=new Map();
for(const t of tris){
if(!t.tn) continue;
for(let f=0;f<3;f++){
const a=t.P[f], b=t.P[(f+1)%3], c=t.P[(f+2)%3];
const e1=[b[0]-a[0],b[1]-a[1],b[2]-a[2]], e2=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
const n=[e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]];
const nl=Math.hypot(...n); if(nl<0.05) continue;
const du=Math.hypot(t.U[1][0]-t.U[0][0],t.U[1][1]-t.U[0][1]);
const dv=Math.hypot(t.U[2][0]-t.U[0][0],t.U[2][1]-t.U[0][1]);
if(!(du>0.01)||!(dv>0.01)) continue;
const wFace=nl/du/(t.rep[0]||1)/(t.rep[0]>0?1:1);
const key=t.tn+' 面宽'+(nl/Math.max(du,0.01)).toFixed(2)+'m×'+(nl/Math.max(dv,0.01)).toFixed(2)+'m?';
// 面尺寸取 UV 反推: 米/贴 = 边长/UV跨度; 用第一条边
const eLen=Math.hypot(e1[0],e1[1],e1[2]);
const mpu=(eLen/du).toFixed(2), mpv=(eLen?0:0);
const k2=t.tn+'  '+(eLen/du).toFixed(2)+'m/贴U';
const e2v=()=>{ // 第二条边的 UV 跨度
const du2=Math.hypot(t.U[2][0]-t.U[0][0],t.U[2][1]-t.U[0][1]);
const e2l=Math.hypot(e2[0],e2[1],e2[2]);
return (e2l/du2).toFixed(2);
};
list.set(k2+'×'+e2v()+'m/贴V',(list.get(k2+'×'+e2v()+'m/贴V')||0)+1);
break; // 每三角只记一条边 (代表面)
}
}
console.log('\n── 目标附近三角面 UV 密度汇总 (贴图  米/贴U×米/贴V → 三角数) ──');
const rows=[...list.entries()].sort((a,b)=>b[1]-a[1]).slice(0,24);
for(const [k,n] of rows) console.log(`  ${k}  ×${n}`);
}
