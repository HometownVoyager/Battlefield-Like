// ─────────────────────────────────────────────
// dev/verify-matseam-20260927.js —— 建筑材质一致性验收 (逐块色相收敛 / 平铺无缝 / 帆布密度归一)
// 用法: node --stack-size=4000 dev/verify-matseam-20260927.js
//
// 背景 (用户实报): "部分建筑出现了严重的材质不一致问题" —— 三处可量化缺陷:
//   ① 逐块颜色是 `rgb(randi(),randi(),randi())` 三通道**各抖各的**: TEX.stone 的逐块色相跨度实测
//      13°~156° (同一堵墙上"粉石"挨着"青石" = 拼色马赛克); brick 12~39° / wood 20~60° 同理。
//   ② 贴图里画到画布**外面**的元素在对边没有等价副本 (抹灰的返潮斑被切成半个), 以及抹灰墙脚有一条
//      y=212..256 的**硬边**半透明带 —— 平铺到墙上是每 1.8m 一道明暗台阶 (实机的"坏块感")。
//   ③ 帐篷帆布 (TEX.cloth) 没登记 UV_DENSITY ⇒ 同一顶帐篷上 2.8m 坡板与 0.5m 檐口的织纹相差 17×。
//
// 本探针量的是**产物**(不是源码文本):
//   ① 色相一致性: 直接读 Canvas 兜底版的绘制调用 (录制版 2D 上下文) 与 SVG 精修版的填充色,
//      对"砌块/板条"这一类的颜色算色相 → 断言极差 ≤20°, 且明度极差 ≥6% (抖动还在, 不是被抹平);
//   ② 平铺闭合: 解析 SVG 元素 → 越出本格的元素必须在 ±W/±H 平移处有同形副本 (缝上不出现半个图案);
//   ③ 接缝连续: bbox 边界正好贴在贴图边上的元素, 对边必须也有同形元素 (抹灰那条硬边返潮带就会报红);
//   ④ 帆布密度归一: 真 three + 全脚本链建世界 → 量帐篷帆布每个盒面的"米/贴", 断言跨度 ≤1.05× 且中位
//      等于 UV_DENSITY.cloth (旧版实测 17.1×);
//   ⑤ 阴性对照: 用两段合成的"旧写法"样例重跑 ②③, 必须报红 —— 证明判据不是空转。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const stub=require('./_bootstub.js');
const root=path.resolve(__dirname,'..');
let pass=0,fail=0;
const chk=(c,msg)=>{ if(c){ pass++; console.log('  ✓ '+msg); } else { fail++; console.log('  ✗ '+msg); } };

// ══ 轻沙箱: 00-config + 02-scene (画布改"录制版": 记下每次填充用的颜色与调用) ══
const REC=new Map(); let CUR=null;
// 录制版 2D 上下文: 记下"每次填充/描边用的颜色" (其余绘制方法一律 no-op, 不实现像素)
function rec2d(log){
let lastCol=null;
const api={
fillRect(x,y,w,h){ log.push({kind:'fillRect',col:lastCol,w,h}); },
stroke(){ log.push({kind:'stroke',col:lastCol,w:0,h:0}); },
fill(){ log.push({kind:'fill',col:lastCol,w:0,h:0}); },
getImageData(){ return {data:new Uint8ClampedArray(4)}; },
createLinearGradient(){ return {addColorStop(){}}; },
createRadialGradient(){ return {addColorStop(){}}; },
};
return new Proxy(api,{
get(t,k){ if(k==='canvas') return {width:256,height:256}; if(typeof k==='symbol') return undefined;
if(!(k in t)) t[k]=()=>undefined; return t[k]; },
set(t,k,v){ if(k==='fillStyle'||k==='strokeStyle') lastCol=v; t[k]=v; return true; }
});
}
const mkEl=(tag)=>{ const el={tagName:String(tag||'div').toUpperCase(),style:{},dataset:{},children:[],
classList:{add(){},remove(){},toggle(){},contains(){return false;}},textContent:'',innerHTML:'',value:'',disabled:false,
appendChild(c){this.children.push(c);return c;},prepend(c){this.children.unshift(c);return c;},remove(){},addEventListener(){},removeEventListener(){},focus(){},
setAttribute(){},getAttribute(){return null;},querySelector:()=>mkEl('div'),querySelectorAll:()=>[],getContext:()=>null,width:0,height:0};
Object.defineProperty(el,'firstChild',{get(){ if(!el._fc) el._fc={textContent:''}; return el._fc; }});
return el; };
const byId={};
function lightSandbox(){
const doc={
createElement:t=>{ const el=mkEl(t);
if(t==='canvas'){ const log=[]; REC.set(el,log); el.getContext=()=>rec2d(log); }
return el; },
createElementNS:()=>mkEl('canvas'),
getElementById:id=>{ if(!byId[id]){ byId[id]=mkEl(); byId[id].id=id; } return byId[id]; },
querySelector:()=>mkEl('div'),querySelectorAll:()=>[],
body:mkEl('body'),head:mkEl('head'),addEventListener(){},removeEventListener(){},hidden:false,pointerLockElement:null,exitPointerLock(){},
};
class V3{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;} set(x,y,z){this.x=x;this.y=y;this.z=z;return this;} setScalar(){return this;}
copy(){return this;} clone(){return new V3();} multiplyScalar(){return this;} add(){return this;} sub(){return this;} normalize(){return this;} lengthSq(){return 0;}}
class Obj3{constructor(){this.position=new V3();this.rotation={set(){return this;},x:0,y:0,z:0};this.scale=new V3(1,1,1);this.children=[];this.visible=true;this.frustumCulled=false;}
add(m){this.children.push(m);m.parent=this;return this;}remove(m){const i=this.children.indexOf(m);if(i>=0)this.children.splice(i,1);}
traverse(fn){fn(this);for(const c of this.children)if(c&&c.traverse)c.traverse(fn);}updateMatrix(){}updateWorldMatrix(){}}
class Geo{constructor(){this.parameters={};}translate(){return this;}setAttribute(){return this;}setIndex(){return this;}computeVertexNormals(){return this;}dispose(){}}
const _colorOf=c=>({set(v){this.v=v;},getHexString(){return "000000";},copy(){return this;}});
const _wrapColor=c=>_colorOf(c);
class _Color{constructor(c){this.c=c;}set(v){this.v=v;return this;}getHexString(){return '000000';}copy(){return this;}}
const _mat=cls=>class extends cls{constructor(o){super();Object.assign(this,o||{});this.color=_wrapColor(this.color);}};
const THREE={
WebGLRenderer:class{constructor(){this.domElement=mkEl('canvas');this.domElement.style={};this.shadowMap={enabled:false,type:0};this.info={render:{calls:0,triangles:0},memory:{}};
this.capabilities={isWebGL2:true,getMaxAnisotropy:()=>4,maxTextureSize:4096};this.xr={enabled:false,isPresenting:false,addEventListener(){},removeEventListener(){}};this.setSize=()=>{};this.setPixelRatio=()=>{};this.render=()=>{};this.clear=()=>{};this.clearDepth=()=>{};this.outputColorSpace='';this.setClearColor=()=>{};this.setAnimationLoop=()=>{};this.compile=()=>new Set();this.getSize=(t)=>{if(t)t.set(1280,720);return {width:1280,height:720};};this.getPixelRatio=()=>1;this.getDrawingBufferSize=()=>({x:1,y:1});}},
Scene:class extends Obj3{constructor(){super();this.fog=null;}},
PerspectiveCamera:class extends Obj3{constructor(){super();this.aspect=1;}updateProjectionMatrix(){}getWorldDirection(v){v.set(0,0,-1);return v;}},
Group:class extends Obj3{},Mesh:class extends Obj3{constructor(g,m){super();this.geometry=g;this.material=m;this.isMesh=true;}},
Object3D:Obj3,Sprite:class extends Obj3{constructor(m){super();this.material=m||{};if(!this.material.color)this.material.color={set(){}};}},
Vector3:V3,Color:_Color,
Fog:class{constructor(c){this.color=_colorOf(c);this.near=0;this.far=0;}},
SphereGeometry:Geo,PlaneGeometry:Geo,BoxGeometry:Geo,CylinderGeometry:Geo,
// ★2026-11-01 桩补 (非回归): 02-scene 天体批起 boot 期直建星空 Points(new THREE.BufferGeometry + Float32BufferAttribute),
//   本轻桩缺这三样 ⇒ 探针载入即 TypeError 整篇崩。只补载入面, 不影响本探针的材质/UV 断言。
BufferGeometry:class extends Geo{setAttribute(n,a){this.attributes=this.attributes||{};this.attributes[n]=a;return this;}setIndex(){return this;}},
Float32BufferAttribute:class{constructor(arr,sz){this.array=arr;this.itemSize=sz;}},
Points:class extends Obj3{constructor(g,m){super();this.geometry=g;this.material=m;}},
MeshLambertMaterial:_mat(class{constructor(){}}),MeshBasicMaterial:_mat(class{constructor(){}}),SpriteMaterial:_mat(class{constructor(){}}),PointsMaterial:_mat(class{constructor(){}}),
CanvasTexture:class{constructor(c){this.image=c;this.repeat={set(){}};this.needsUpdate=false;this.wrapS=this.wrapT=0;}clone(){const t=new THREE.CanvasTexture(this.image);return t;}dispose(){}},
DirectionalLight:class extends Obj3{constructor(c,i){super();this.intensity=i||1;this.color=_wrapColor(c);this.target=new Obj3();this.shadow={mapSize:{setScalar(){}},map:null,bias:0,camera:{updateProjectionMatrix(){},left:0,right:0,top:0,bottom:0,far:0,near:0}};}},
HemisphereLight:class extends Obj3{constructor(a,b,i){super();this.intensity=i||1;}},
RepeatWrapping:1000,DoubleSide:2,BackSide:1,SRGBColorSpace:'srgb',PCFShadowMap:1,PCFSoftShadowMap:2,ACESFilmicToneMapping:4,NoToneMapping:0,
};
const sandbox={
console:{log(){},warn(){},error(){}},Math,JSON,Date,performance:{now:()=>Date.now()},
location:{search:'',reload(){},href:'http://localhost/'},
localStorage:{_s:{},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}},
navigator:{userAgent:'node'},document:doc,window:{addEventListener(){},removeEventListener(){},document:doc},
requestAnimationFrame:()=>0,cancelAnimationFrame(){},setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},
devicePixelRatio:1,innerWidth:1280,innerHeight:720,addEventListener(){},removeEventListener(){},
THREE,Image:(typeof Image!=='undefined')?Image:undefined,
};
sandbox.window=sandbox;
vm.createContext(sandbox);
for(const f of ['js/00-config.js','js/02-scene.js']) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),sandbox,{filename:f});
return sandbox;
}
const S=lightSandbox();
const LQ=s=>vm.runInContext(s,S);
const SVGTEX=LQ('SVGTEX'), TEX=LQ('TEX'), UV_DENSITY=LQ('UV_DENSITY');

// ══ 颜色工具 ══
function parseCol(str){
if(typeof str!=='string') return null;
let m;
if((m=/^#([0-9a-f]{6})$/i.exec(str.trim()))){ const v=parseInt(m[1],16); return [v>>16&255,v>>8&255,v&255]; }
if((m=/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/.exec(str))) return [+m[1],+m[2],+m[3]];
return null;
}
function hsv(r,g,b){ const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn; const lit=(mx+mn)/2/255;
if(d<1e-6) return {h:0,s:0,l:lit};
let h; if(mx===r) h=((g-b)/d)%6; else if(mx===g) h=(b-r)/d+2; else h=(r-g)/d+4;
h*=60; if(h<0) h+=360;
return {h,s:d/255,l:lit}; }
// 只量"有彩度"的样本: 近中性的灰按色相算是无意义的
function huesOf(cols){ return cols.map(parseCol).filter(Boolean).map(([r,g,b])=>hsv(r,g,b)).filter(c=>c.s*255>=10); }
function spread(list,f){ if(!list.length) return null; const v=list.map(f); return Math.max(...v)-Math.min(...v); }
// 色相是环形量: 用"最小包含弧"量极差 (否则 359° 与 3° 会被算成 356°)
function hueSpread(list){
if(list.length<2) return null;
const v=list.map(c=>c.h).sort((a,b)=>a-b);
let gap=v[0]+360-v[v.length-1];
for(let i=1;i<v.length;i++) gap=Math.max(gap,v[i]-v[i-1]);
return 360-gap;
}
// 明度抖动只差一个共同系数: 量"三通道均值"的相对极差 (不受暖冷偏移 ±w 干扰)
function meanSpread(cols){
const v=cols.map(parseCol).filter(Boolean).map(c=>(c[0]+c[1]+c[2])/3);
if(v.length<4) return null;
const avg=v.reduce((a,b)=>a+b,0)/v.length;
return (Math.max(...v)-Math.min(...v))/avg;
}

console.log('── ① 逐块色相一致性 (砌块/板条颜色只抖明度, 不再"粉石挨青石") ──');
// 每个贴图: [SVG 选中器, Canvas 兜底选中器]
const SVG_SEL={
brick:(a,t)=>t==='rect'&&Math.abs(+a.height-14)<0.01&&/^rgb\(/.test(a.fill||''),   // ★2026-09-28B: 砖块 32×16px (高 14)
plaster:(a,t)=>false,
stone:(a,t)=>t==='rect'&&Math.abs(+a.height-27.5)<0.01&&/^rgb\(/.test(a.fill||''),
wood:(a,t)=>t==='rect'&&Math.abs(+a.height-256)<0.01&&/^rgb\(/.test(a.fill||''),
woodDark:(a,t)=>t==='rect'&&Math.abs(+a.height-128)<0.01&&/^rgb\(/.test(a.fill||''),
roof:(a,t)=>t==='path'&&/^rgb\(/.test(a.fill||''),
};
const CV_SEL={
brick:(rec)=>rec.kind==='fillRect'&&Math.abs(rec.w-30)<0.01&&Math.abs(rec.h-14)<0.01,   // ★2026-09-28B: 砖 30×14 (排除 1px 高光/阴影条)
stone:(rec)=>rec.kind==='fillRect'&&Math.abs(rec.w-60)<0.01,   // ★2026-11-01: 石砌块 60×28 (列距 64 整除 256 修平铺闭合; 砖体过缝另有同色副本件, 同宽同算一块)
wood:(rec)=>rec.kind==='fillRect'&&Math.abs(rec.w-30)<0.01&&Math.abs(rec.h-256)<0.01,
woodDark:(rec)=>rec.kind==='stroke'&&/^#|^rgba?\(/.test(String(rec.col||'')),
roof:(rec)=>rec.kind==='fillRect'&&Math.abs(rec.w-30)<0.01&&Math.abs(rec.h-30)<0.01,
};
const EL=TAGRE=>TAGRE;
function svgElems(body){
const out=[]; const re=/<(rect|ellipse|circle|path|line)\b([^>]*?)\/?>/g; let m;
while((m=re.exec(body))){
const a={}; const ar=/([a-zA-Z-]+)="([^"]*)"/g; let q;
while((q=ar.exec(m[2]))) a[q[1]]=q[2];
out.push({tag:m[1],bytes:m[2],a});
}
return out;
}
for(const name of ['brick','stone','wood','woodDark','roof']){
const body=SVGTEX[name].make();
const sel=SVG_SEL[name];
const svgCols=svgElems(body).filter(e=>sel(e.a,e.tag)).map(e=>e.a.fill);
const log=REC.get(TEX[name].image)||[];
const cvCols=log.filter(CV_SEL[name]).map(r=>String(r.col));
const hs=huesOf(svgCols), hc=huesOf(cvCols);
const sh=hueSpread(hs), sc=hueSpread(hc);
// 明度只差一个共同系数: 用"通道均值"的相对极差量 (不受暖冷偏移干扰)
const lh=meanSpread(svgCols), lc=meanSpread(cvCols);
chk(svgCols.length>=4&&sh!==null&&sh<=20, `  ${name} SVG 精修版: 砌块 ${svgCols.length} 块 · 色相极差(最小弧) ${sh===null?'-':sh.toFixed(1)+'°'} ≤20°`);
chk(cvCols.length>=4&&sc!==null&&sc<=20, `  ${name} Canvas 兜底版: 砌块 ${cvCols.length} 块 · 色相极差(最小弧) ${sc===null?'-':sc.toFixed(1)+'°'} ≤20°`);
chk(lh!==null&&lh>=0.08&&lc!==null&&lc>=0.08, `  ${name} 明度抖动仍在 (通道均值极差 SVG ${lh===null?'-':(lh*100).toFixed(1)+'%'} / Canvas ${lc===null?'-':(lc*100).toFixed(1)+'%'} ≥8% — 收敛的是色相, 不是把贴图抹平)`);
}

console.log('\n── ②③ 平铺闭合 / 接缝连续 (SVG 元素必须在 ±W/±H 平移群下闭合) ──');
const NUMS=/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/g;
function bboxOf(el,W,H){
const a=el.a;
const num=s=>{ const m=String(s||'').match(NUMS); return m?m.map(Number):[]; };
const shift=[0,0];
if(a.transform){ const tm=/translate\(\s*([-\d.]+)[\s,]+([-\d.]+)/g; let q; while((q=tm.exec(a.transform))){ shift[0]+=+q[1]; shift[1]+=+q[2]; } }
if(el.tag==='rect'){ const x=+(a.x||0),y=+(a.y||0),w=(a.width==='100%'?W:+a.width||0),h=(a.height==='100%'?H:+a.height||0); return [x+shift[0],y+shift[1],x+w+shift[0],y+h+shift[1]]; }
if(el.tag==='ellipse'){ const x=+(a.cx||0),y=+(a.cy||0),rx=+(a.rx||0),ry=+(a.ry||0); return [x-rx+shift[0],y-ry+shift[1],x+rx+shift[0],y+ry+shift[1]]; }
if(el.tag==='circle'){ const x=+(a.cx||0),y=+(a.cy||0),r=+(a.r||0); return [x-r+shift[0],y-r+shift[1],x+r+shift[0],y+r+shift[1]]; }
if(el.tag==='line'){ const x1=+(a.x1||0),y1=+(a.y1||0),x2=+(a.x2||0),y2=+(a.y2||0); return [Math.min(x1,x2)+shift[0],Math.min(y1,y2)+shift[1],Math.max(x1,x2)+shift[0],Math.max(y1,y2)+shift[1]]; }
if(el.tag==='path'){
const v=num(a.d); let mnx=1e9,mny=1e9,mxx=-1e9,mxy=-1e9;
for(let i=0;i+1<v.length;i+=2){ mnx=Math.min(mnx,v[i]); mxx=Math.max(mxx,v[i]); mny=Math.min(mny,v[i+1]); mxy=Math.max(mxy,v[i+1]); }
if(mnx>mxx) return [0,0,0,0];
return [mnx+shift[0],mny+shift[1],mxx+shift[0],mxy+shift[1]];
}
return [0,0,0,0];
}
// 形状指纹 (不含位置): 同形副本必须有**同一个指纹**
function keyOf(el){
const a=el.a, drop=new Set(['x','y','cx','cy','x1','y1','x2','y2','transform','d']);
const parts=[el.tag];
for(const k of Object.keys(a).sort()) if(!drop.has(k)) parts.push(k+'='+a[k]);
if(el.tag==='path') parts.push('d='+a.d);
return parts.join('|');
}
// ② 越出本格 ⇒ ±W/±H 处要有同形副本; ③ 贯穿整幅的条带必须贯穿到两端
//   (③ 的靶子 = 抹灰那条 y=212..256 的硬边半透明带: 平铺到墙上每 1.8m 一道明暗台阶。
//    逐块砖石**不适用**此判据 —— 一堵砌块墙本来就靠"相邻块各自不同"取胜, 只要行/列铺满整幅即可。
//    判据只打在"某一轴上跨越整幅 (0..W / 0..H)"的条带元素上: 它要么两端都顶到格边 (如满幅底纹),
//    要么两端都不顶 (如某一段墙裙)。只顶一端 = 缝上一定有一道硬台阶。)
function tileClosure(body,W,H){
const els=svgElems(body).map(e=>({...e,bb:bboxOf(e,W,H),key:keyOf(e)}));
const idx=new Map();
for(const e of els){ if(!idx.has(e.key)) idx.set(e.key,[]); idx.get(e.key).push(e); }
const badOver=[], badEdge=[];
const TOL=0.35, touch=(v,t)=>Math.abs(v-t)<TOL;
for(const e of els){
const [x0,y0,x1,y1]=e.bb;
for(const dx of [-W,0,W]) for(const dy of [-H,0,H]){
if(!dx&&!dy) continue;
const nx0=x0+dx,ny0=y0+dy,nx1=x1+dx,ny1=y1+dy;
if(!(nx1>0&&nx0<W&&ny1>0&&ny0<H)) continue;              // 平移后与本格不相交: 无需副本
const twin=(idx.get(e.key)||[]).some(o=>Math.abs((o.bb[0]+o.bb[2])/2-(nx0+nx1)/2)<0.6&&Math.abs((o.bb[1]+o.bb[3])/2-(ny0+ny1)/2)<0.6);
if(!twin) badOver.push(`${e.tag}@(${x0.toFixed(0)},${y0.toFixed(0)},${x1.toFixed(0)},${y1.toFixed(0)}) 缺 (${dx},${dy}) 处的副本`);
}
}
// ③ 满幅条带: 横跨 0..W 的**部分高度**条带必须自己在 y 上首尾相接铺满 0..H (旧版抹灰返潮带只有
//   y=212..256 一段 ⇒ 缝上一道硬台阶); 竖条同理。整幅元素 (跨满两轴) 天然满足。
const fullX=[], fullY=[];
for(const e of els){
const [x0,y0,x1,y1]=e.bb;
if(touch(x0,0)&&touch(x1,W)&&!(touch(y0,0)&&touch(y1,H))) fullX.push(e);
if(touch(y0,0)&&touch(y1,H)&&!(touch(x0,0)&&touch(x1,W))) fullY.push(e);
}
function chainOk(items,lo,hi,axis){
if(!items.length) return true;
const iv=[...new Set(items.map(e=>(axis==='y'?[e.bb[1],e.bb[3]]:[e.bb[0],e.bb[2]]).map(v=>+v.toFixed(2)).join(' ')))].map(s=>s.split(' ').map(Number));
iv.sort((a,b)=>a[0]-b[0]);
if(Math.abs(iv[0][0]-lo)>0.6||Math.abs(iv[iv.length-1][1]-hi)>0.6) return false;
for(let i=1;i<iv.length;i++) if(Math.abs(iv[i][0]-iv[i-1][1])>0.6) return false;
return true;
}
if(!chainOk(fullX,0,H,'y')) badEdge.push(`横向满幅的部分高度条带没有铺满 y (y 区间: ${fullX.map(e=>e.bb[1].toFixed(0)+'~'+e.bb[3].toFixed(0)).join(',')}) → 缝上一道硬台阶`);
if(!chainOk(fullY,0,W,'x')) badEdge.push(`纵向满幅的部分宽度条带没有铺满 x (x 区间: ${fullY.map(e=>e.bb[0].toFixed(0)+'~'+e.bb[2].toFixed(0)).join(',')}) → 缝上一道硬台阶`);
return {badOver,badEdge,n:els.length};
}
for(const name of ['brick','plaster','stone','wood','woodDark','roof','sandbag','cloth','grime']){
const e=SVGTEX[name]; const r=tileClosure(e.make(),e.w,e.h);
chk(r.badOver.length===0, `  ${name} 平铺闭合: ${r.n} 个元素全部在 ±W/±H 平移群下闭合${r.badOver.length?' — '+r.badOver.slice(0,3).join('; '):''}`);
chk(r.badEdge.length===0, `  ${name} 接缝连续: 没有"只贴一边格边"的元素${r.badEdge.length?' — '+r.badEdge.slice(0,3).join('; '):''}`);
}
// 抹灰 (2026-09-28B 定版, 替换旧"墙脚返潮带"判据 —— 该元素已随离散图形一起删除):
//   a. 面上**不允许任何离散图形** (旧版圆点/毛线 = 用户实报的"材质问题"; 只许 基底 rect + 滤镜 rect);
//   b. 每个噪声层 stitchTiles="stitch" (平铺无缝);
//   c. **存在感下限** (28 首版教训: 纯噪声压太暗, 远看 minify 成"没上材质的白模" —— 用户二报"材质不一致"):
//      合成明度调制 Σ op·E[α] ∈ [0.30, 0.95], 单层 op ≤ 0.5 (α = s·(R+G+B)+bias, fractalNoise E[R+G+B]=1.5)。
{
const body=SVGTEX.plaster.make();
const els=svgElems(body);
const discrete=els.filter(e=>e.tag!=='rect').length;
const hasGrad=/<(radial|linear)Gradient/.test(body);
const layers=[...body.matchAll(/<feColorMatrix type="matrix" values="([^"]+)"\/>/g)]
  .map(m=>{ const t=m[1].trim().split(/\s+/).map(Number); return {s:t[15],bias:t[19]}; });
const ops=[...body.matchAll(/<rect[^>]*filter="url\(#[^)]+\)"[^>]*opacity="([\d.]+)"/g)].map(m=>+m[1]);
const stitch=(body.match(/stitchTiles="stitch"/g)||[]).length;
const meanA=(s,bias)=>Math.max(0,Math.min(1,3*s/2+bias));
const presence=ops.reduce((a,o,i)=>a+o*meanA(layers[i]?layers[i].s:0,layers[i]?layers[i].bias:1),0);
chk(discrete===0&&!hasGrad, `  plaster 无离散图形: ${els.length} 个元素全是 rect (无 ellipse/circle/path/line/渐变) —— 圆点/毛线不复生`);
chk(layers.length>=3&&layers.length===ops.length&&stitch===layers.length, `  plaster 噪声层 ${layers.length} 层全部 stitchTiles 无缝 (op 表 ${ops.length} 条)`);
chk(presence>=0.30&&presence<=0.95&&ops.every(o=>o<=0.5), `  plaster 存在感: 合成明度调制 ${(presence*100).toFixed(1)}% ∈ [30%,95%], 单层 op≤0.5 —— 有材质感, 不退回"圆点"也不退回"白模"`);
}

console.log('\n── ④ 帐篷帆布密度归一 (TEX.cloth 登记 UV_DENSITY + tentMatA/B 挂 uvRef + 实测跨度) ──');
chk(UV_DENSITY.cloth>0, `  UV_DENSITY.cloth = ${UV_DENSITY.cloth} m/贴 (2026-09-27 补登)`);
{
// 重沙箱: 真 three + 全脚本链 → 建世界 → 量帆布材质的盒面密度
const FILES=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/22a-menuart.js','js/23-deploy.js','js/23b-worldrestore.js','js/24-main.js'];
const RSTUB=`
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
for(const k in stub.byId) delete stub.byId[k];
const ctx=vm.createContext(Object.assign({},stub.sandbox));
ctx.document=stub.document; ctx.window=stub.window;
ctx.localStorage={_s:{sf_campaign:'2'},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
vm.runInContext(fs.readFileSync(path.join(root,'dev/vendor/three.min.js'),'utf8'),ctx,{filename:'three.min.js'});
vm.runInContext('THREE = globalThis.THREE;',ctx,{filename:'bind-three'});
vm.runInContext(RSTUB,ctx,{filename:'stub-renderer'});
for(const f of FILES) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
const r=vm.runInContext(`(function(){
const ref=[];
function scan(root0){ root0.traverse(o=>{ if(!o.isMesh) return;
const m=o.material, g=o.geometry; if(!m||!g||!m.map) return;
if(m.map!==TEX.cloth) return;
if(g.type!=='BoxGeometry') return;
const p=g.parameters||{}, uv=g.attributes&&g.attributes.uv; if(!uv) return;
const F=[[p.depth,p.height],[p.depth,p.height],[p.width,p.depth],[p.width,p.depth],[p.width,p.height],[p.width,p.height]];
for(let f=0;f<6;f++){ const i0=f*4;
const du=Math.abs(uv.getX(i0+1)-uv.getX(i0)), dv=Math.abs(uv.getY(i0+2)-uv.getY(i0));
if(!(du>0)||!(dv>0)) continue;
ref.push({d:(F[f][0]/du+F[f][1]/dv)/2, uvRef:(m.uvRef!==undefined?m.uvRef:null)});
}}); }
scan(world);
ref.sort((a,b)=>a.d-b.d);
return { n:ref.length, min:ref[0]?ref[0].d:0, max:ref[ref.length-1]?ref[ref.length-1].d:0,
 med:ref.length?ref[Math.floor(ref.length/2)].d:0,
 uvRefs:[...new Set(ref.map(r=>r.uvRef))], noRef:ref.filter(r=>r.uvRef===null).length,
 density:UV_DENSITY.cloth };
})()`,ctx);
const span=r.max/Math.max(0.001,r.min);
chk(r.n>=20, `  世界里的帆布盒面 ${r.n} 面 (柏林)`);
chk(r.noRef===0&&r.uvRefs.length===1&&r.uvRefs[0]===r.density, `  全部帆布材质都挂了 uvRef=${r.density} (未登记 ${r.noRef} 面)`);
chk(span<=1.05, `  帆布密度跨度 ${span.toFixed(2)}× ≤1.05× (旧版实测 17.1×) [${r.min.toFixed(2)}~${r.max.toFixed(2)} m/贴]`);
chk(Math.abs(r.med-r.density)/r.density<=0.05, `  密度中位 ${r.med.toFixed(2)} ≈ UV_DENSITY.cloth ${r.density} (±5%)`);
}

console.log('\n── ⑤ 阴性对照 (旧写法样例必须让 ②③ 报红) ──');
{
const oldBand='<rect width="256" height="256" fill="#b0a891"/><rect y="212" width="256" height="44" fill="rgba(80,72,56,0.14)"/>';
const r1=tileClosure(oldBand,256,256);
chk(r1.badEdge.length>0, `  旧写法(硬边返潮带) → ③ 报红: ${r1.badEdge[0]||'-'}`);
const noWrap='<rect width="256" height="256" fill="#b0a891"/><ellipse cx="250" cy="120" rx="40" ry="30" fill="rgba(80,72,56,0.2)"/>';
const r2=tileClosure(noWrap,256,256);
chk(r2.badOver.length>0, `  旧写法(斑块切在边上、对边无副本) → ② 报红: ${r2.badOver[0]||'-'}`);
const wrapped=noWrap+'<ellipse cx="-6" cy="120" rx="40" ry="30" fill="rgba(80,72,56,0.2)"/>';
const r3=tileClosure(wrapped,256,256);
chk(r3.badOver.length===0, `  同一条斑块补上对边副本 ⇒ ② 转绿 (判据认的是"闭合", 不是"别越界")`);
}
console.log(`\n合计 ${pass} ✓ / ${fail} ✗`);
process.exit(fail?1:0);
