// ─────────────────────────────────────────────
// 02-scene.js —— 渲染器/场景/天空/光照/材质
// 源: Index.original.html 第 834-1095 行
// ─────────────────────────────────────────────
'use strict';
const renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.autoClear = false;
renderer.domElement.className='game';
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(74, innerWidth/innerHeight, 0.08, 900);
const vmScene = new THREE.Scene();
const vmCamera = new THREE.PerspectiveCamera(56, innerWidth/innerHeight, 0.01, 10);
let SHADOW_RANGE=60;
function applyQuality(){
const q = SETTINGS.quality;
renderer.setPixelRatio(q===0?Math.min(devicePixelRatio,1):(q===1?Math.min(devicePixelRatio,1.5):Math.min(devicePixelRatio,2)));
// 紧凑阴影视锥跟随玩家: 大幅减少每帧阴影绘制的物体数
SHADOW_RANGE=q===0?42:(q===1?60:80);
sun.shadow.camera.left=-SHADOW_RANGE; sun.shadow.camera.right=SHADOW_RANGE;
sun.shadow.camera.top=SHADOW_RANGE; sun.shadow.camera.bottom=-SHADOW_RANGE;
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.mapSize.setScalar(q===0?1024:(q===1?1536:2048));
if(sun.shadow.map){ sun.shadow.map.dispose(); sun.shadow.map=null; }
// 高画质: 软阴影 + 电影感滤镜; 低画质硬阴影无滤镜
renderer.shadowMap.type=q===2?THREE.PCFSoftShadowMap:THREE.PCFShadowMap;
renderer.domElement.style.filter=q===2?'saturate(1.1) contrast(1.06) brightness(1.02)':(q===1?'saturate(1.04) contrast(1.02)':'none');
// 2026-09-12 巨桥改版: 主题系数与图幅系数相乘 (旧版互斥三元 —— deepjungle 640 大图永远吃不到放宽)
// 2026-09-13 许特根改版: deepjungle 硬编码 0.72 抽成主题字段 THEME.fogMul (woods=0.42 能见度极低)
scene.fog.far = (q===0?240:(q===1?340:420))*((WEATHER==='rain'||WEATHER==='storm')?0.78:(WEATHER==='snow'?0.85:1))*(THEME.fogMul||1)*((CAMPAIGN.mapSize||320)>=640?1.35:1);
}
addEventListener('resize',()=>{
camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
vmCamera.aspect=camera.aspect; vmCamera.updateProjectionMatrix();
renderer.setSize(innerWidth,innerHeight);
});
scene.fog = new THREE.Fog(THEME.fog, 40, 340);
let SKY=null;
{
const c=document.createElement('canvas'); c.width=16; c.height=256;
const g=c.getContext('2d');
const gr=g.createLinearGradient(0,0,0,256);
const st=THEME.sky;
gr.addColorStop(0,st[0]); gr.addColorStop(0.42,st[1]);
gr.addColorStop(0.62,st[2]); gr.addColorStop(0.75,st[3]); gr.addColorStop(1,st[4]);
g.fillStyle=gr; g.fillRect(0,0,16,256);
const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace;
SKY=new THREE.Mesh(new THREE.SphereGeometry(760,24,16), new THREE.MeshBasicMaterial({map:tex,side:THREE.BackSide,fog:false}));
SKY.frustumCulled=false;
scene.add(SKY);
}
const hemi = new THREE.HemisphereLight(THEME.hemi[0], THEME.hemi[1], THEME.hemi[2]);
scene.add(hemi);
const sun = new THREE.DirectionalLight(THEME.sun, THEME.sunI);
sun.position.set(-90, 120, 40);
sun.castShadow = true;
sun.shadow.camera.left=-60; sun.shadow.camera.right=60;
sun.shadow.camera.top=60; sun.shadow.camera.bottom=-60;
sun.shadow.camera.far=400; sun.shadow.bias=-0.0012; sun.shadow.normalBias=0.02;
scene.add(sun); scene.add(sun.target);
function updateSunShadow(){
// 阴影视锥跟随相机, 按纹素网格对齐减少闪烁
const texel=SHADOW_RANGE*2/sun.shadow.mapSize.x;
const cx=Math.round(camera.position.x/texel)*texel;
const cz=Math.round(camera.position.z/texel)*texel;
sun.target.position.set(cx,0,cz);
sun.position.set(cx-72,96,cz+32);
}
{
const c=document.createElement('canvas'); c.width=128; c.height=128;
const g=c.getContext('2d');
const gr=g.createRadialGradient(64,64,2,64,64,64);
gr.addColorStop(0,'rgba(255,250,230,1)'); gr.addColorStop(0.25,'rgba(255,240,200,.55)'); gr.addColorStop(1,'rgba(255,240,200,0)');
g.fillStyle=gr; g.fillRect(0,0,128,128);
const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),fog:false,depthWrite:false}));
sp.position.set(-380,480,170); sp.scale.setScalar(220); scene.add(sp);
}
{
const c=document.createElement('canvas'); c.width=256; c.height=128;
const g=c.getContext('2d');
for(let i=0;i<46;i++){
const x=rand(30,226),y=rand(40,90),r=rand(14,34);
const gr=g.createRadialGradient(x,y,1,x,y,r);
gr.addColorStop(0,'rgba(255,255,255,.22)'); gr.addColorStop(1,'rgba(255,255,255,0)');
g.fillStyle=gr; g.fillRect(0,0,256,128);
}
const tex=new THREE.CanvasTexture(c);
for(let i=0;i<9;i++){
const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,opacity:rand(.5,.85),fog:false,depthWrite:false}));
sp.position.set(rand(-600,600), rand(180,280), rand(-600,600));
sp.scale.set(rand(180,340),rand(60,110),1);
scene.add(sp);
}
}
vmScene.add(new THREE.HemisphereLight(0xcfd8e8, 0x5a5844, 0.9));
{ const l=new THREE.DirectionalLight(0xffeed0,1.6); l.position.set(-1,1.6,0.6); vmScene.add(l); }
function makeTex(w,h,fn,repX=1,repY=1){
const c=document.createElement('canvas'); c.width=w; c.height=h;
fn(c.getContext('2d'),w,h);
const t=new THREE.CanvasTexture(c);
t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(repX,repY);
t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4;
return t;
}
function speckle(g,w,h,n,c0,c1,smin,smax){
for(let i=0;i<n;i++){
g.fillStyle=Math.random()<.5?c0:c1;
g.globalAlpha=rand(.08,.4);
const s=rand(smin,smax);
g.fillRect(rand(0,w),rand(0,h),s,s);
}
g.globalAlpha=1;
}
const TEX = {};
TEX.grass = makeTex(256,256,(g,w,h)=>{
g.fillStyle='#6b7a48'; g.fillRect(0,0,w,h);
speckle(g,w,h,2600,'#7d8c52','#55643a',1,3);
speckle(g,w,h,500,'#8a9458','#4a5834',1,2);
for(let i=0;i<160;i++){ g.strokeStyle='rgba(120,138,80,.35)'; g.beginPath(); const x=rand(0,w),y=rand(0,h); g.moveTo(x,y); g.lineTo(x+rand(-3,3),y-rand(2,6)); g.stroke(); }
},40,40);
TEX.snowGround = makeTex(256,256,(g,w,h)=>{
g.fillStyle='#eef1f5'; g.fillRect(0,0,w,h);
speckle(g,w,h,1600,'#f8fafc','#dde3ea',1,3);
speckle(g,w,h,420,'#cfd6de','#e6ebf0',1,2);
for(let i=0;i<70;i++){ g.strokeStyle='rgba(200,208,216,.28)'; g.beginPath(); const x=rand(0,w),y=rand(0,h); g.moveTo(x,y); g.lineTo(x+rand(-6,6),y+rand(-4,4)); g.stroke(); }
},40,40);
TEX.dirt = makeTex(256,256,(g,w,h)=>{
g.fillStyle='#7a6a4e'; g.fillRect(0,0,w,h);
speckle(g,w,h,2200,'#8a7a5a','#655640',1,4);
speckle(g,w,h,300,'#93835f','#54462f',2,5);
},8,8);
TEX.brick = makeTex(256,256,(g,w,h)=>{
g.fillStyle='#8a5a44'; g.fillRect(0,0,w,h);
const bh=20,bw=42;
for(let y=0;y<h;y+=bh){
const off=((y/bh)|0)%2? bw/2:0;
for(let x=-bw;x<w;x+=bw){
g.fillStyle=`rgb(${randi(120,155)},${randi(75,95)},${randi(55,70)})`;
g.fillRect(x+off+1,y+1,bw-2,bh-2);
}
}
speckle(g,w,h,900,'#6a4634','#9a7055',1,3);
},2,1.4);
TEX.plaster = makeTex(256,256,(g,w,h)=>{
g.fillStyle='#b0a891'; g.fillRect(0,0,w,h);
speckle(g,w,h,1800,'#bcb49c','#9a9078',1,4);
for(let i=0;i<5;i++){
const x=rand(0,w),y=rand(h*0.5,h),r=rand(12,34);
g.fillStyle='#7c5240'; g.globalAlpha=.55;
g.beginPath(); g.ellipse(x,y,r,r*0.7,rand(0,3),0,TAU); g.fill(); g.globalAlpha=1;
}
for(let i=0;i<7;i++){ g.strokeStyle='rgba(70,60,50,.3)'; g.beginPath(); let x=rand(0,w),y=rand(0,h); g.moveTo(x,y); for(let k=0;k<4;k++){ x+=rand(-18,18); y+=rand(6,20); g.lineTo(x,y);} g.stroke(); }
},2,1.5);
TEX.stone = makeTex(256,256,(g,w,h)=>{
g.fillStyle='#8d8a80'; g.fillRect(0,0,w,h);
for(let y=0;y<h;y+=26){
const off=((y/26)|0)%2?30:0;
for(let x=-60;x<w;x+=60){
g.fillStyle=`rgb(${randi(125,155)},${randi(122,150)},${randi(112,138)})`;
g.fillRect(x+off+2,y+2,56,22);
}
}
speckle(g,w,h,900,'#6d6a60','#a5a296',1,3);
},2,1.5);
TEX.wood = makeTex(256,256,(g,w,h)=>{
g.fillStyle='#6e5638'; g.fillRect(0,0,w,h);
for(let x=0;x<w;x+=32){
g.fillStyle=`rgb(${randi(95,125)},${randi(72,92)},${randi(46,62)})`;
g.fillRect(x+1,0,30,h);
g.strokeStyle='rgba(50,36,20,.5)';
for(let i=0;i<4;i++){ g.beginPath(); const yy=rand(0,h); g.moveTo(x,yy); g.bezierCurveTo(x+10,yy+rand(-6,6),x+20,yy+rand(-6,6),x+32,yy+rand(-8,8)); g.stroke(); }
}
speckle(g,w,h,350,'#54402a','#84684a',1,2);
},1.5,1.5);
TEX.woodDark = makeTex(128,128,(g,w,h)=>{
g.fillStyle='#4a3a24'; g.fillRect(0,0,w,h);
for(let i=0;i<26;i++){ g.strokeStyle=`rgba(${randi(30,60)},${randi(24,44)},${randi(12,26)},.6)`; g.beginPath(); g.moveTo(0,rand(0,h)); g.bezierCurveTo(w*.3,rand(0,h),w*.7,rand(0,h),w,rand(0,h)); g.stroke(); }
},1,1);
TEX.sandbag = makeTex(128,128,(g,w,h)=>{
g.fillStyle='#9a8a62'; g.fillRect(0,0,w,h);
for(let y=0;y<h;y+=22){
const off=((y/22)|0)%2?22:0;
for(let x=-44;x<w;x+=44){
g.fillStyle=`rgb(${randi(140,165)},${randi(125,145)},${randi(88,105)})`;
g.beginPath(); g.ellipse(x+off+22,y+11,20,9,0,0,TAU); g.fill();
g.strokeStyle='rgba(80,70,45,.6)'; g.stroke();
}
}
},2,2);
TEX.metal = makeTex(128,128,(g,w,h)=>{
g.fillStyle='#5a5f56'; g.fillRect(0,0,w,h);
speckle(g,w,h,700,'#6a7062','#464b42',1,3);
speckle(g,w,h,120,'#7d6a4a','#3d3428',1,4);
},1,1);
TEX.bark = makeTex(128,128,(g,w,h)=>{
g.fillStyle='#5d4c36'; g.fillRect(0,0,w,h);
for(let x=0;x<w;x+=8){ g.fillStyle=`rgba(${randi(60,90)},${randi(48,70)},${randi(32,48)},.8)`; g.fillRect(x,0,rand(3,6),h); }
speckle(g,w,h,300,'#3f3222','#75604a',1,3);
},1,2);
TEX.leaves = makeTex(128,128,(g,w,h)=>{
g.clearRect(0,0,w,h);
for(let i=0;i<450;i++){
g.fillStyle=`rgba(${randi(60,95)},${randi(85,120)},${randi(40,60)},${rand(.5,1)})`;
const x=rand(0,w),y=rand(0,h);
const d=Math.hypot(x-64,y-64); if(d>60) continue;
g.beginPath(); g.ellipse(x,y,rand(3,7),rand(2,5),rand(0,3),0,TAU); g.fill();
}
});
TEX.roof = makeTex(256,256,(g,w,h)=>{
g.fillStyle='#6e4438'; g.fillRect(0,0,w,h);
for(let y=0;y<h;y+=24){
for(let x=0;x<w;x+=30){
g.fillStyle=`rgb(${randi(100,130)},${randi(58,74)},${randi(46,60)})`;
g.fillRect(x+1,y+1,28,22);
}
}
speckle(g,w,h,500,'#4f2f26','#8a5a48',1,3);
},2,2);
TEX.hay = makeTex(128,128,(g,w,h)=>{
g.fillStyle='#b09a58'; g.fillRect(0,0,w,h);
for(let i=0;i<400;i++){ g.strokeStyle=`rgba(${randi(150,190)},${randi(130,160)},${randi(70,95)},.7)`; g.beginPath(); const x=rand(0,w),y=rand(0,h); g.moveTo(x,y); g.lineTo(x+rand(-9,9),y+rand(-3,3)); g.stroke(); }
},2,2);
TEX.hedge = makeTex(256,256,(g,w,h)=>{
g.fillStyle='#46552e'; g.fillRect(0,0,w,h);
// 修剪绿篱: 密集叶簇团块 (box 六面各映射整图, 1:1 平铺)
for(let i=0;i<760;i++){
const x=rand(0,w), y=rand(0,h), r=rand(3,9);
g.fillStyle=`rgb(${randi(58,80)},${randi(82,106)},${randi(36,52)})`;
g.globalAlpha=rand(.35,.85);
g.beginPath(); g.ellipse(x,y,r,r*rand(.55,.85),rand(0,3),0,TAU); g.fill();
}
// 叶隙暗斑: 拉开团块层次
for(let i=0;i<150;i++){
const x=rand(0,w), y=rand(0,h), r=rand(2,6);
g.fillStyle='rgba(28,36,18,.55)';
g.beginPath(); g.ellipse(x,y,r,r*rand(.5,.9),rand(0,3),0,TAU); g.fill();
}
// 细碎受光叶尖
for(let i=0;i<230;i++){
const x=rand(0,w), y=rand(0,h), r=rand(1,2.6);
g.fillStyle=`rgb(${randi(104,128)},${randi(118,140)},${randi(62,80)})`;
g.globalAlpha=rand(.25,.6);
g.beginPath(); g.ellipse(x,y,r,r*0.7,rand(0,3),0,TAU); g.fill();
}
g.globalAlpha=1;
// 垂直明暗: 顶部受光 / 底部近土压暗 (盒侧面更立体)
const gr=g.createLinearGradient(0,0,0,h);
gr.addColorStop(0,'rgba(255,255,214,.10)'); gr.addColorStop(.32,'rgba(255,255,214,0)');
gr.addColorStop(.72,'rgba(18,24,10,0)'); gr.addColorStop(1,'rgba(18,24,10,.30)');
g.fillStyle=gr; g.fillRect(0,0,w,h);
},1,1);
TEX.track=makeTex(64,64,(g,w,h)=>{
g.fillStyle='#2e2f2a'; g.fillRect(0,0,w,h);
for(let y=0;y<h;y+=8){
g.fillStyle='#3d3e36'; g.fillRect(2,y+1,w-4,5);
g.fillStyle='#23241f'; g.fillRect(6,y+2,w-12,2);
}
},1,4);
// ─────────────────────────────────────────────
// SVG 材质精修管线 —— 全部程序化贴图升级为 SVG 滤镜重绘版
// 原理: 上方 Canvas2D 手绘版保留为"即时兜底"(Node 沙箱/低端环境/加载间隙显示),
//       浏览器环境再异步用 SVG(feTurbulence 分形噪声/各向异性拉丝/位移扰动等滤镜)
//       重绘同一张 canvas —— 贴图对象与材质引用不变, 加载完成后无缝替换.
//       SVG 生成仅用 Math.random(rand/randi), 不触碰 wr/wri 布局种子流 → 布局指纹零漂移.
//       生成器全部登记在 SVGTEX (dev/verify-svgtex.js 逐条校验 XML 合法性/平铺周期).
// ─────────────────────────────────────────────
const SVG_OK=(typeof Image!=='undefined')&&!/(?:\?|&)nosvg/.test(location.search); // ?nosvg=1: 跳过 SVG 重绘, 恒用 Canvas 兜底版 (排障 A/B 开关)
function svgURI(w,h,body){
return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`);
}
function svgUpgrade(tex,w,h,body,name){
if(!SVG_OK) return tex;
try{
const img=new Image();
img.onload=()=>{
let c,g;
try{ c=tex.image; g=c.getContext('2d'); if(!g) return; }catch(e){ return; }
let snap=null;
try{ snap=g.getImageData(0,0,c.width,c.height); }catch(e){} // 重绘前快照兜底版 (data: 图不污染画布, 不会抛)
try{ g.globalAlpha=1; g.clearRect(0,0,c.width,c.height); g.drawImage(img,0,0,c.width,c.height); }
catch(e){ console.warn('[SVG] 贴图重绘绘制失败(保留兜底版): '+(name||'?'), e&&e.message); if(snap) g.putImageData(snap,0,0); return; }
// 内容校验: 个别浏览器 SVG 滤镜栅格化异常时会"绘制成功但全透明/全黑" → 采样判定后回滚, 避免整场挂图材质变黑
if(snap){
const d=g.getImageData(0,0,c.width,c.height).data;
let n=0,op=0,black=0;
for(let i=0;i<d.length;i+=148){
n++;
if(d[i+3]>10) op++;
if(d[i+3]>200&&d[i]+d[i+1]+d[i+2]<24) black++;
}
if(op===0||black/n>0.995){
g.putImageData(snap,0,0);
console.warn('[SVG] 重绘结果异常('+(op===0?'全透明':'全黑')+'), 已回滚兜底版: '+(name||'?'));
return;
}
}
tex.needsUpdate=true;
};
img.onerror=()=>{ console.warn('[SVG] 贴图重绘加载失败(停留在兜底版): '+(name||'?')); };
img.src=svgURI(w,h,body);
}catch(e){}
return tex;
}
const SVGTEX={};
function svgReg(name,w,h,make){ SVGTEX[name]={w,h,make}; return make; }
function svgApply(tex,name){ const e=SVGTEX[name]; if(e&&tex) svgUpgrade(tex,e.w,e.h,e.make(),name); return tex; }
// 常用片段: 分形噪声色斑 (把 feTurbulence 亮度映射为 alpha 的半透明色块层; 滤镜域=整格 + stitchTiles → 可无缝平铺)
function svgMottle(id,freq,oct,rgb,s,bias,op,seed){
return `<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${oct}" seed="${seed}" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 ${rgb[0]} 0 0 0 0 ${rgb[1]} 0 0 0 0 ${rgb[2]} ${s} ${s} ${s} 0 ${bias}"/></filter><rect width="100%" height="100%" filter="url(#${id})" opacity="${op}"/>`;
}
function svgGrain(id,freq,rgb,op,seed){ return svgMottle(id,freq,2,rgb,0.8,-0.62,op,seed); }
// 方向性条纹 (fx/fy 各向异性 → 顺纹拉丝: 木纹/金属刷痕/布纹)
function svgStreak(id,fx,fy,rgb,s,bias,op,seed){
return `<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${fx} ${fy}" numOctaves="3" seed="${seed}" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 ${rgb[0]} 0 0 0 0 ${rgb[1]} 0 0 0 0 ${rgb[2]} ${s} ${s} ${s} 0 ${bias}"/></filter><rect width="100%" height="100%" filter="url(#${id})" opacity="${op}"/>`;
}
function svgLeaf(x,y,r,fill,op){
return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${r.toFixed(1)}" ry="${(r*0.62).toFixed(1)}" transform="rotate(${rand(0,360).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="${fill}" opacity="${op.toFixed(2)}"/>`;
}
// 烟团/尘团: 径向渐变圆 + feTurbulence 位移扰动 → 蓬松不规则轮廓 (粒子精灵, 不平铺)
function svgPuff(inner,mid,opIn,opMid,r,seed){
return `<defs><radialGradient id="pfg"><stop offset="0" stop-color="rgb(${inner})" stop-opacity="${opIn}"/><stop offset="0.55" stop-color="rgb(${mid})" stop-opacity="${opMid}"/><stop offset="1" stop-color="rgb(${mid})" stop-opacity="0"/></radialGradient>`
+`<filter id="pff" x="-30%" y="-30%" width="160%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="0.11" numOctaves="3" seed="${seed}" result="tr"/><feDisplacementMap in="SourceGraphic" in2="tr" scale="8" xChannelSelector="R" yChannelSelector="G"/></filter></defs>`
+`<circle cx="32" cy="32" r="${r}" fill="url(#pfg)" filter="url(#pff)"/>`;
}
// ── 各贴图 SVG 生成器 (基色与旧 Canvas 版一致, 保证主题着色/雪地黄土换色行为不变) ──
svgReg('grass',256,256,()=>{
const b=[];
for(let i=0;i<130;i++){
const x=rand(0,256),y=rand(0,256),dx=rand(-5,5),dy=-rand(3,9);
b.push(`<path d="M${x.toFixed(1)} ${y.toFixed(1)} q${(dx*0.4).toFixed(1)} ${(dy*0.55).toFixed(1)} ${dx.toFixed(1)} ${dy.toFixed(1)}" stroke="rgb(${randi(100,132)},${randi(124,152)},${randi(66,88)})" stroke-width="${rand(0.7,1.6).toFixed(1)}" opacity="${rand(0.2,0.45).toFixed(2)}" fill="none"/>`);
}
for(let i=0;i<70;i++){
b.push(`<circle cx="${rand(0,256).toFixed(1)}" cy="${rand(0,256).toFixed(1)}" r="${rand(0.5,1.2).toFixed(1)}" fill="rgb(${randi(140,168)},${randi(152,176)},${randi(84,104)})" opacity="${rand(0.25,0.55).toFixed(2)}"/>`);
}
return `<rect width="256" height="256" fill="#6b7a48"/>`
+svgMottle('gg1','0.025',4,[0.28,0.34,0.16],0.9,-0.78,0.5,7)
+svgMottle('gg2','0.085',3,[0.52,0.58,0.33],0.85,-0.78,0.3,13)
+svgGrain('gg3','0.55',[0.18,0.23,0.1],0.2,21)
+b.join('');
});
svgReg('snowGround',256,256,()=>{
const b=[];
for(let i=0;i<24;i++){
const y=rand(0,256),x=rand(-30,200),l=rand(50,170);
b.push(`<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x+l).toFixed(1)}" y2="${(y+rand(-4,4)).toFixed(1)}" stroke="rgb(185,196,214)" stroke-width="${rand(0.6,1.6).toFixed(1)}" opacity="${rand(0.1,0.22).toFixed(2)}"/>`);
}
for(let i=0;i<90;i++){
b.push(`<rect x="${rand(0,255).toFixed(1)}" y="${rand(0,255).toFixed(1)}" width="1.2" height="1.2" fill="#ffffff" opacity="${rand(0.4,0.9).toFixed(2)}"/>`);
}
return `<rect width="256" height="256" fill="#eef1f5"/>`
+svgMottle('sn1','0.02',4,[0.72,0.77,0.86],0.8,-0.66,0.4,5)
+svgMottle('sn2','0.075',3,[0.86,0.9,0.95],0.8,-0.7,0.3,11)
+svgGrain('sn3','0.6',[0.55,0.6,0.7],0.12,17)
+b.join('');
});
svgReg('dirt',256,256,()=>{
const b=[];
for(let i=0;i<38;i++){
const x=rand(0,256),y=rand(0,256),r=rand(1,3);
b.push(`<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${r.toFixed(1)}" ry="${(r*rand(0.6,0.9)).toFixed(1)}" fill="rgb(${randi(112,140)},${randi(104,130)},${randi(86,108)})" stroke="rgba(48,40,28,0.4)" stroke-width="0.6"/>`);
}
for(let i=0;i<24;i++){
b.push(`<ellipse cx="${rand(0,256).toFixed(1)}" cy="${rand(0,256).toFixed(1)}" rx="${rand(2,5).toFixed(1)}" ry="${rand(1.5,3.5).toFixed(1)}" fill="rgb(${randi(70,88)},${randi(58,74)},${randi(40,52)})" opacity="${rand(0.2,0.4).toFixed(2)}"/>`);
}
for(let i=0;i<7;i++){
let x=rand(0,256),y=rand(0,256),d=`M${x.toFixed(1)} ${y.toFixed(1)}`;
for(let k=0;k<5;k++){ x+=rand(-16,16); y+=rand(6,20); d+=` L${x.toFixed(1)} ${y.toFixed(1)}`; }
b.push(`<path d="${d}" stroke="rgba(45,38,26,0.32)" stroke-width="1" fill="none"/>`);
}
return `<rect width="256" height="256" fill="#7a6a4e"/>`
+svgMottle('dt1','0.035',4,[0.33,0.28,0.2],0.9,-0.74,0.45,3)
+svgMottle('dt2','0.1',3,[0.56,0.49,0.36],0.85,-0.76,0.3,9)
+svgGrain('dt3','0.6',[0.22,0.19,0.13],0.18,15)
+b.join('');
});
svgReg('brick',256,256,()=>{
const b=[];
for(let ry=0;ry<8;ry++){
const off=(ry%2)?32:0;
for(let x=-64+off;x<256;x+=64){
const r=randi(118,152),g=randi(74,96),bl=randi(55,72);
b.push(`<g><rect x="${(x+1.5).toFixed(1)}" y="${(ry*32+2.5).toFixed(1)}" width="61" height="29" fill="rgba(38,24,16,0.4)"/>`
+`<rect x="${x.toFixed(1)}" y="${(ry*32+1).toFixed(1)}" width="61" height="29" rx="1.5" fill="rgb(${r},${g},${bl})"/>`
+`<line x1="${x.toFixed(1)}" y1="${(ry*32+1.5).toFixed(1)}" x2="${(x+61).toFixed(1)}" y2="${(ry*32+1.5).toFixed(1)}" stroke="rgba(255,236,214,0.2)" stroke-width="1.4"/>`
+`<line x1="${x.toFixed(1)}" y1="${(ry*32+29).toFixed(1)}" x2="${(x+61).toFixed(1)}" y2="${(ry*32+29).toFixed(1)}" stroke="rgba(30,18,12,0.35)" stroke-width="1.4"/></g>`);
}
}
return `<rect width="256" height="256" fill="#8a8172"/>`
+svgMottle('br1','0.012',3,[0.4,0.3,0.22],0.9,-0.75,0.18,7)
+b.join('')
+svgGrain('br2','0.55',[0.15,0.1,0.07],0.14,11);
});
svgReg('plaster',256,256,()=>{
const b=[];
for(let i=0;i<6;i++){
const x=rand(10,246),y=rand(40,240),r=rand(16,44);
b.push(`<radialGradient id="plg${i}"><stop offset="0" stop-color="rgb(${randi(96,120)},${randi(76,92)},${randi(56,68)})" stop-opacity="${rand(0.16,0.3).toFixed(2)}"/><stop offset="1" stop-color="rgb(120,90,70)" stop-opacity="0"/></radialGradient><ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${r.toFixed(1)}" ry="${(r*rand(0.5,0.85)).toFixed(1)}" fill="url(#plg${i})"/>`);
}
for(let i=0;i<8;i++){
let x=rand(0,256),y=rand(0,140),d=`M${x.toFixed(1)} ${y.toFixed(1)}`;
for(let k=0;k<4;k++){ x+=rand(-18,18); y+=rand(8,24); d+=` L${x.toFixed(1)} ${y.toFixed(1)}`; }
b.push(`<path d="${d}" stroke="rgba(72,62,46,0.28)" stroke-width="${rand(0.7,1.3).toFixed(1)}" fill="none"/>`);
}
return `<rect width="256" height="256" fill="#b0a891"/>`
+svgMottle('pl1','0.012',4,[0.62,0.58,0.5],0.9,-0.72,0.4,4)
+svgMottle('pl2','0.06',3,[0.78,0.75,0.66],0.8,-0.7,0.28,8)
+b.join('')
+`<rect y="212" width="256" height="44" fill="rgba(80,72,56,0.14)"/>`
+svgGrain('pl3','0.6',[0.35,0.32,0.25],0.12,12);
});
svgReg('stone',256,256,()=>{
const b=[];
for(let ry=0;ry<8;ry++){
let x=0;
while(x<256){
let w=Math.round(rand(40,84)/4)*4;
if(256-x-w<40) w=256-x;
const r=randi(125,155),g=randi(122,150),bl=randi(112,138);
b.push(`<g><rect x="${(x+2).toFixed(1)}" y="${(ry*32+2.5).toFixed(1)}" width="${w-3}" height="27.5" fill="rgba(30,30,26,0.45)"/>`
+`<rect x="${x}" y="${ry*32+1}" width="${w-3}" height="27.5" rx="2" fill="rgb(${r},${g},${bl})"/>`
+`<line x1="${x+2}" y1="${ry*32+2.2}" x2="${(x+w-5).toFixed(1)}" y2="${ry*32+2.2}" stroke="rgba(255,255,250,0.16)" stroke-width="1.3"/>`
+`<line x1="${x+2}" y1="${ry*32+28}" x2="${(x+w-5).toFixed(1)}" y2="${ry*32+28}" stroke="rgba(20,20,16,0.3)" stroke-width="1.3"/></g>`);
if(Math.random()<0.3){
b.push(`<ellipse cx="${(x+rand(6,w-8)).toFixed(1)}" cy="${(ry*32+28).toFixed(1)}" rx="${rand(3,7).toFixed(1)}" ry="2" fill="rgb(${randi(70,92)},${randi(88,108)},${randi(44,58)})" opacity="0.3"/>`);
}
x+=w;
}
}
return `<rect width="256" height="256" fill="#6f6c62"/>`
+b.join('')
+svgGrain('st1','0.55',[0.2,0.2,0.18],0.13,6);
});
svgReg('wood',256,256,()=>{
const b=[];
for(let p=0;p<8;p++){
const x=p*32;
b.push(`<rect x="${x}" y="0" width="32" height="256" fill="rgb(${randi(95,125)},${randi(72,92)},${randi(46,62)})"/>`);
for(let i=0;i<3;i++){
const gx=x+rand(4,28);
b.push(`<path d="M${gx.toFixed(1)} -4 q${rand(-3,3).toFixed(1)} 64 ${rand(-4,4).toFixed(1)} 132 q${rand(-3,3).toFixed(1)} 64 ${rand(-4,4).toFixed(1)} 132" stroke="rgba(52,38,22,0.4)" stroke-width="${rand(0.8,1.6).toFixed(1)}" fill="none"/>`);
}
b.push(`<line x1="${x+30.5}" y1="0" x2="${x+30.5}" y2="256" stroke="rgba(28,18,9,0.55)" stroke-width="2.2"/>`);
b.push(`<line x1="${x+1}" y1="0" x2="${x+1}" y2="256" stroke="rgba(210,178,128,0.12)" stroke-width="1"/>`);
}
for(let i=0;i<3;i++){
const x=rand(8,248),y=rand(10,246);
b.push(`<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${rand(2.5,4.5).toFixed(1)}" ry="${rand(4,7).toFixed(1)}" fill="rgba(46,32,18,0.65)"/><ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${rand(5,8).toFixed(1)}" ry="${rand(8,12).toFixed(1)}" fill="none" stroke="rgba(46,32,18,0.3)" stroke-width="1.2"/>`);
}
return b.join('')+svgStreak('wd1','0.55','0.014',[0.3,0.22,0.13],0.85,-0.75,0.16,9);
});
svgReg('woodDark',128,128,()=>{
const b=[];
for(let p=0;p<4;p++){
const x=p*32;
b.push(`<rect x="${x}" y="0" width="32" height="128" fill="rgb(${randi(58,76)},${randi(44,58)},${randi(26,38)})"/>`);
for(let i=0;i<2;i++){
const gx=x+rand(4,28);
b.push(`<path d="M${gx.toFixed(1)} -4 q${rand(-3,3).toFixed(1)} 34 ${rand(-3,3).toFixed(1)} 68 q${rand(-3,3).toFixed(1)} 30 ${rand(-3,3).toFixed(1)} 64" stroke="rgba(24,16,8,0.5)" stroke-width="${rand(0.8,1.4).toFixed(1)}" fill="none"/>`);
}
b.push(`<line x1="${x+30.5}" y1="0" x2="${x+30.5}" y2="128" stroke="rgba(12,8,4,0.6)" stroke-width="2.4"/>`);
}
return b.join('')+svgStreak('wdk1','0.5','0.016',[0.1,0.07,0.04],0.85,-0.75,0.2,14);
});
svgReg('sandbag',128,128,()=>{
const b=[];
for(let ry=0;ry<4;ry++){
const off=(ry%2)?21.3:0;
for(let x=-21.3+off;x<128+21.3;x+=42.7){
const cx=x, cy=ry*32+16;
b.push(`<ellipse cx="${cx.toFixed(1)}" cy="${(cy+3).toFixed(1)}" rx="19.5" ry="12.5" fill="rgba(50,42,26,0.35)"/>`);
b.push(`<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="20" ry="13" fill="url(#sbg)" stroke="rgba(72,62,40,0.55)" stroke-width="1"/>`);
b.push(`<path d="M${(cx-14).toFixed(1)} ${(cy-5).toFixed(1)} Q${cx.toFixed(1)} ${(cy-11).toFixed(1)} ${(cx+14).toFixed(1)} ${(cy-5).toFixed(1)}" stroke="rgba(96,84,56,0.5)" stroke-width="0.9" fill="none" stroke-dasharray="2.5 2"/>`);
}
}
return `<rect width="128" height="128" fill="#6e6349"/>`
+`<radialGradient id="sbg" cx="0.38" cy="0.3" r="0.85"><stop offset="0" stop-color="rgb(176,158,116)"/><stop offset="0.55" stop-color="rgb(152,136,98)"/><stop offset="1" stop-color="rgb(116,102,72)"/></radialGradient>`
+b.join('')
+svgGrain('sb1','0.5',[0.3,0.26,0.17],0.15,8);
});
svgReg('metal',128,128,()=>{
const b=[];
for(let i=0;i<22;i++){
b.push(`<circle cx="${rand(0,128).toFixed(1)}" cy="${rand(0,128).toFixed(1)}" r="${rand(0.6,1.8).toFixed(1)}" fill="rgb(${randi(108,138)},${randi(64,84)},${randi(34,46)})" opacity="${rand(0.2,0.5).toFixed(2)}"/>`);
}
for(let i=0;i<6;i++){
const x=rand(0,128),y=rand(0,128),a=rand(0,6.28),l=rand(8,26);
b.push(`<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x+Math.cos(a)*l).toFixed(1)}" y2="${(y+Math.sin(a)*l).toFixed(1)}" stroke="rgba(190,196,188,0.18)" stroke-width="0.7"/>`);
}
return `<rect width="128" height="128" fill="#5a5f56"/>`
+svgStreak('mt1','0.012','0.5',[0.14,0.16,0.14],0.85,-0.72,0.3,4)
+svgStreak('mt2','0.01','0.4',[0.72,0.75,0.7],0.8,-0.72,0.16,10)
+svgGrain('mt3','0.7',[0.1,0.11,0.1],0.1,16)
+b.join('');
});
svgReg('bark',128,128,()=>{
const b=[];
for(let i=0;i<15;i++){
const x=rand(2,126);
b.push(`<path d="M${x.toFixed(1)} -4 q${rand(-3,3).toFixed(1)} 34 ${rand(-3,3).toFixed(1)} 68 q${rand(-3,3).toFixed(1)} 30 ${rand(-3,3).toFixed(1)} 68" stroke="rgba(36,28,16,0.55)" stroke-width="${rand(2,4.5).toFixed(1)}" fill="none"/>`);
}
for(let i=0;i<12;i++){
const x=rand(2,126);
b.push(`<path d="M${x.toFixed(1)} -4 q${rand(-2,2).toFixed(1)} 34 ${rand(-2,2).toFixed(1)} 68 q${rand(-2,2).toFixed(1)} 30 ${rand(-2,2).toFixed(1)} 68" stroke="rgba(120,100,70,0.3)" stroke-width="1.2" fill="none"/>`);
}
for(let i=0;i<10;i++){
const x=rand(0,120),y=rand(0,128);
b.push(`<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x+rand(3,9)).toFixed(1)}" y2="${(y+rand(-2,2)).toFixed(1)}" stroke="rgba(30,22,12,0.4)" stroke-width="1"/>`);
}
return `<rect width="128" height="128" fill="#5d4c36"/>`
+svgStreak('bk1','0.4','0.015',[0.16,0.12,0.07],0.85,-0.75,0.28,12)
+b.join('');
});
svgReg('leaves',128,128,()=>{
const b=[];
for(let i=0;i<70;i++) b.push(svgLeaf(rand(0,128),rand(0,128),rand(2.5,6),`rgb(${randi(40,58)},${randi(58,76)},${randi(26,38)})`,rand(0.75,0.95)));
for(let i=0;i<150;i++) b.push(svgLeaf(rand(0,128),rand(0,128),rand(3,7),`rgb(${randi(58,92)},${randi(82,116)},${randi(38,58)})`,rand(0.8,1)));
for(let i=0;i<55;i++) b.push(svgLeaf(rand(0,128),rand(0,128),rand(2,4.5),`rgb(${randi(96,126)},${randi(116,142)},${randi(56,76)})`,rand(0.7,0.9)));
for(let i=0;i<6;i++){
const x=rand(0,128),y=rand(0,128);
b.push(`<path d="M${x.toFixed(1)} ${y.toFixed(1)} q${rand(-8,8).toFixed(1)} ${rand(-8,8).toFixed(1)} ${rand(-14,14).toFixed(1)} ${rand(-14,14).toFixed(1)}" stroke="rgb(72,58,38)" stroke-width="1.6" fill="none" opacity="0.85"/>`);
}
return b.join('');
});
svgReg('roof',256,256,()=>{
const b=[];
for(let ry=0;ry<8;ry++){
for(let cx=0;cx<8;cx++){
const x=cx*32,y=ry*32;
b.push(`<path d="M${x+1} ${y+31} L${x+1} ${y+7} Q${x+16} ${y+1} ${x+31} ${y+7} L${x+31} ${y+31} Z" fill="rgb(${randi(100,130)},${randi(58,74)},${randi(46,60)})"/>`);
b.push(`<path d="M${x+1} ${y+31} L${x+1} ${y+7} Q${x+16} ${y+1} ${x+31} ${y+7} L${x+31} ${y+31}" fill="none" stroke="rgba(255,220,190,0.14)" stroke-width="1.2"/>`);
b.push(`<line x1="${x+1}" y1="${y+31}" x2="${x+31}" y2="${y+31}" stroke="rgba(38,20,14,0.5)" stroke-width="2"/>`);
if(Math.random()<0.22){
b.push(`<ellipse cx="${(x+rand(6,26)).toFixed(1)}" cy="${y+28}" rx="${rand(2,5).toFixed(1)}" ry="1.8" fill="rgb(${randi(74,94)},${randi(92,112)},${randi(48,62)})" opacity="0.35"/>`);
}
}
}
return `<rect width="256" height="256" fill="#57352c"/>`+b.join('')+svgGrain('rf1','0.5',[0.15,0.08,0.06],0.12,19);
});
svgReg('hay',128,128,()=>{
const b=[];
for(let i=0;i<150;i++){
const x=rand(-10,128),y=rand(0,128),a=rand(-0.6,0.6),l=rand(12,40);
b.push(`<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x+Math.cos(a)*l).toFixed(1)}" y2="${(y+Math.sin(a)*l).toFixed(1)}" stroke="rgb(${randi(150,192)},${randi(130,162)},${randi(70,96)})" stroke-width="${rand(0.7,1.5).toFixed(1)}" opacity="${rand(0.5,0.85).toFixed(2)}"/>`);
}
for(let i=0;i<30;i++){
const x=rand(-10,128),y=rand(0,128),a=rand(-0.5,0.5),l=rand(10,30);
b.push(`<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x+Math.cos(a)*l).toFixed(1)}" y2="${(y+Math.sin(a)*l).toFixed(1)}" stroke="rgb(${randi(96,118)},${randi(80,98)},${randi(42,56)})" stroke-width="1" opacity="0.45"/>`);
}
return `<rect width="128" height="128" fill="#b09a58"/>`+b.join('')+svgGrain('hy1','0.6',[0.5,0.42,0.2],0.1,22);
});
svgReg('hedge',256,256,()=>{
const b=[];
for(let i=0;i<170;i++) b.push(svgLeaf(rand(0,256),rand(0,256),rand(3,9),`rgb(${randi(30,44)},${randi(44,58)},${randi(18,28)})`,rand(0.5,0.8)));
for(let i=0;i<520;i++) b.push(svgLeaf(rand(0,256),rand(0,256),rand(3,9),`rgb(${randi(56,78)},${randi(80,104)},${randi(34,50)})`,rand(0.35,0.85)));
for(let i=0;i<230;i++) b.push(svgLeaf(rand(0,256),rand(0,256),rand(1,2.6),`rgb(${randi(102,126)},${randi(116,140)},${randi(60,78)})`,rand(0.25,0.6)));
return `<rect width="256" height="256" fill="#46552e"/>`+b.join('')
+svgGrain('hg1','0.3',[0.08,0.12,0.05],0.2,9)
+`<linearGradient id="hg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(255,255,214,0.1)"/><stop offset="0.32" stop-color="rgba(255,255,214,0)"/><stop offset="0.72" stop-color="rgba(18,24,10,0)"/><stop offset="1" stop-color="rgba(18,24,10,0.3)"/></linearGradient><rect width="256" height="256" fill="url(#hg2)"/>`;
});
svgReg('track',64,64,()=>{
const b=[];
for(let y=0;y<64;y+=8){
b.push(`<rect x="2" y="${y+1}" width="60" height="5" fill="#3f4038"/>`);
b.push(`<line x1="2" y1="${y+1.5}" x2="62" y2="${y+1.5}" stroke="rgba(210,212,200,0.14)" stroke-width="1"/>`);
b.push(`<rect x="8" y="${y+2.5}" width="48" height="2" fill="#1a1b16"/>`);
}
for(let i=0;i<14;i++){
b.push(`<circle cx="${rand(0,64).toFixed(1)}" cy="${rand(0,64).toFixed(1)}" r="${rand(0.5,1.4).toFixed(1)}" fill="rgb(${randi(84,104)},${randi(70,88)},${randi(46,58)})" opacity="${rand(0.2,0.45).toFixed(2)}"/>`);
}
return `<rect width="64" height="64" fill="#23241f"/>`+b.join('')+svgGrain('tk1','0.8',[0.06,0.06,0.05],0.12,25);
});
// ── 跨文件使用的生成器 (05c 庄稼草丛 / 17 医疗箱 / 08 烟尘粒子) ──
svgReg('grassTuft',64,64,()=>{
const b=[];
for(let i=0;i<30;i++){
const x=rand(8,56),dx=rand(-12,12),ty=rand(4,20);
b.push(`<path d="M${x.toFixed(1)} 64 Q${(x+dx*0.3).toFixed(1)} ${(64-(64-ty)*0.55).toFixed(1)} ${(x+dx).toFixed(1)} ${ty.toFixed(1)}" stroke="url(#gtg)" stroke-width="${rand(1.4,2.4).toFixed(1)}" fill="none" opacity="${rand(0.75,0.95).toFixed(2)}"/>`);
}
return `<linearGradient id="gtg" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="rgb(74,98,46)"/><stop offset="1" stop-color="rgb(122,150,82)"/></linearGradient>`+b.join('');
});
svgReg('wheat',128,128,()=>{
const b=[];
for(let i=0;i<26;i++){
const x=4+i*4.6+rand(0,2), hh=rand(88,118), top=128-hh;
b.push(`<line x1="${x.toFixed(1)}" y1="128" x2="${(x+rand(-3,3)).toFixed(1)}" y2="${(top+14).toFixed(1)}" stroke="rgb(${randi(150,175)},${randi(128,148)},${randi(58,78)})" stroke-width="${rand(1.2,1.8).toFixed(1)}" opacity="0.9"/>`);
for(let k=0;k<7;k++){
const ky=top+4+k*2.2, kx=x+rand(-1,1)+(k%2?2:-2)*rand(0.6,1);
b.push(`<ellipse cx="${kx.toFixed(1)}" cy="${ky.toFixed(1)}" rx="1.7" ry="2.6" fill="rgb(${randi(200,225)},${randi(168,195)},${randi(74,110)})" opacity="0.95"/>`);
}
for(let k=0;k<3;k++){
b.push(`<line x1="${x.toFixed(1)}" y1="${top.toFixed(1)}" x2="${(x+rand(-4,4)).toFixed(1)}" y2="${(top-rand(5,10)).toFixed(1)}" stroke="rgb(210,190,120)" stroke-width="0.7" opacity="0.6"/>`);
}
}
return b.join('');
});
svgReg('corn',128,128,()=>{
const b=[];
for(let i=0;i<16;i++){
const x=6+i*7.4+rand(0,3);
b.push(`<line x1="${x.toFixed(1)}" y1="128" x2="${(x+rand(-2,2)).toFixed(1)}" y2="6" stroke="rgb(${randi(70,105)},${randi(130,165)},${randi(50,75)})" stroke-width="2.6" opacity="0.95"/>`);
const n=randi(4,6);
for(let k=0;k<n;k++){
const y=rand(40,116), side=(k%2?1:-1), len=rand(16,26);
b.push(`<path d="M${x.toFixed(1)} ${y.toFixed(1)} Q${(x+side*len*0.5).toFixed(1)} ${(y-len*0.35).toFixed(1)} ${(x+side*len).toFixed(1)} ${(y-len*0.8).toFixed(1)} Q${(x+side*len*0.45).toFixed(1)} ${(y-len*0.15).toFixed(1)} ${x.toFixed(1)} ${(y+1).toFixed(1)} Z" fill="rgb(${randi(65,100)},${randi(120,155)},${randi(45,68)})" opacity="0.9"/>`);
}
for(let k=0;k<3;k++){
b.push(`<line x1="${x.toFixed(1)}" y1="7" x2="${(x+rand(-5,5)).toFixed(1)}" y2="${rand(0,5).toFixed(1)}" stroke="rgb(190,175,110)" stroke-width="0.8" opacity="0.7"/>`);
}
}
return b.join('');
});
svgReg('rice',128,128,()=>{
const b=[];
for(let i=0;i<12;i++){
const x=8+i*10+rand(0,5);
b.push(`<path d="M${x.toFixed(1)} 128 Q${(x+rand(-14,14)).toFixed(1)} 64 ${(x+rand(-18,18)).toFixed(1)} ${rand(10,26).toFixed(1)}" stroke="rgb(${randi(95,130)},${randi(150,180)},${randi(70,95)})" stroke-width="2" fill="none" opacity="0.9"/>`);
const tx=x+rand(-16,16), ty=rand(14,30), ra=rand(0,360).toFixed(0);
for(let k=0;k<6;k++){
b.push(`<ellipse cx="${(tx+rand(-7,7)).toFixed(1)}" cy="${(ty+rand(-6,6)).toFixed(1)}" rx="1.8" ry="1.2" fill="rgb(${randi(170,200)},${randi(185,210)},${randi(90,120)})" opacity="0.9" transform="rotate(${ra} ${tx.toFixed(1)} ${ty.toFixed(1)})"/>`);
}
}
return b.join('');
});
svgReg('medkit',64,64,()=>{
return `<rect width="64" height="64" fill="#d8d4c4"/>`
+`<rect width="64" height="6" fill="#b8b4a4"/><rect y="58" width="64" height="6" fill="#b8b4a4"/>`
+`<rect x="26" y="14" width="12" height="36" fill="#c03a2a"/><rect x="14" y="26" width="36" height="12" fill="#c03a2a"/>`
+`<rect x="26" y="14" width="3" height="36" fill="rgba(255,255,255,0.14)"/><rect x="14" y="26" width="36" height="3" fill="rgba(255,255,255,0.1)"/>`
+`<line x1="0.7" y1="6.4" x2="63.3" y2="6.4" stroke="rgba(255,255,255,0.2)" stroke-width="1"/><line x1="0.7" y1="57.6" x2="63.3" y2="57.6" stroke="rgba(40,36,28,0.25)" stroke-width="1"/>`
+svgGrain('mk1','0.6',[0.35,0.34,0.3],0.12,9);
});
svgReg('puffSmoke',64,64,()=>svgPuff('200,195,185','160,155,145',0.85,0.4,26,5));
svgReg('puffDark',64,64,()=>svgPuff('60,55,48','70,64,55',0.9,0.5,26,11));
svgReg('puffDirt',64,64,()=>svgPuff('120,100,70','100,84,58',0.95,0.5,26,17));
// ── 白底微噪共享贴图: 叠加到平色材质上 (color 乘法保持原色调, 均值≈1 不改亮度) ──
svgReg('grime',128,128,()=>{
return `<rect width="128" height="128" fill="#ffffff"/>`
+svgMottle('gr1','0.05',4,[0.7,0.68,0.6],0.85,-0.72,0.22,6)
+svgStreak('gr2','0.01','0.3',[0.55,0.52,0.45],0.85,-0.75,0.1,12)
+svgGrain('gr3','0.7',[0.4,0.38,0.34],0.08,18);
});
svgReg('cloth',128,128,()=>{
return `<rect width="128" height="128" fill="#ffffff"/>`
+svgStreak('cl1','0.5','0.012',[0.6,0.6,0.62],0.8,-0.72,0.09,3)
+svgStreak('cl2','0.012','0.5',[0.55,0.55,0.58],0.8,-0.72,0.07,9)
+svgGrain('cl3','0.75',[0.45,0.45,0.48],0.09,15);
});
svgReg('metalBrush',128,128,()=>{
return `<rect width="128" height="128" fill="#ffffff"/>`
+svgStreak('mb1','0.01','0.45',[0.55,0.57,0.6],0.85,-0.74,0.22,5)
+svgStreak('mb2','0.008','0.35',[0.8,0.82,0.85],0.8,-0.74,0.12,11)
+svgGrain('mb3','0.7',[0.3,0.32,0.35],0.08,17);
});
svgReg('grainLight',128,128,()=>{
return `<rect width="128" height="128" fill="#ffffff"/>`
+svgMottle('gl1','0.06',3,[0.62,0.6,0.55],0.85,-0.72,0.2,7)
+svgGrain('gl2','0.7',[0.4,0.4,0.38],0.1,13);
});
svgReg('water',128,128,()=>{
return `<rect width="128" height="128" fill="#ffffff"/>`
+svgMottle('wa1','0.012',3,[0.55,0.66,0.72],0.85,-0.7,0.16,21)
+svgMottle('wa2','0.04',2,[0.92,0.97,1.0],0.8,-0.66,0.12,22)
+svgStreak('wa3','0.006','0.2',[0.82,0.9,0.96],0.8,-0.72,0.1,23);
});
svgReg('ice',128,128,()=>{
let cracks='';
for(let i=0;i<9;i++){
const x0=rand(10,118),y0=rand(10,118),a=rand(0,Math.PI*2),l=rand(10,30);
const x1=Math.min(122,Math.max(6,x0+Math.cos(a)*l)), y1=Math.min(122,Math.max(6,y0+Math.sin(a)*l));
const mx=(x0+x1)/2+rand(-6,6), my=(y0+y1)/2+rand(-6,6);
cracks+=`<path d="M${x0.toFixed(1)} ${y0.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}" stroke="rgb(120,138,152)" stroke-width="0.8" fill="none" opacity="0.5"/>`;
}
return `<rect width="128" height="128" fill="#ffffff"/>`
+svgMottle('ic1','0.02',3,[0.72,0.78,0.85],0.85,-0.7,0.13,31)
+svgGrain('ic2','0.5',[0.5,0.55,0.62],0.08,32)
+cracks;
});
// 弹坑焦土: 白底相对明度贴图 (中心焦黑→外缘亮土), 与材质基色 0x4a4238 乘法叠加成焦土渐变; 飞溅斑点非平铺件
svgReg('crater',128,128,()=>{
let sp='';
for(let i=0;i<26;i++){
const a=rand(0,Math.PI*2), rr=rand(30,62);
const px=64+Math.cos(a)*rr, py=64+Math.sin(a)*rr, sz=rand(1.2,3.4);
sp+=`<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${sz.toFixed(1)}" fill="rgb(46,40,32)" opacity="${rand(0.25,0.6).toFixed(2)}"/>`;
}
return `<rect width="128" height="128" fill="rgb(150,142,124)"/>`
+`<defs><radialGradient id="crg"><stop offset="0" stop-color="rgb(40,36,30)"/><stop offset="0.5" stop-color="rgb(72,66,54)"/><stop offset="0.82" stop-color="rgb(104,96,80)"/><stop offset="1" stop-color="rgb(150,142,124)"/></radialGradient></defs><circle cx="64" cy="64" r="64" fill="url(#crg)"/>`
+sp;
});

// ── 对既有 TEX 库逐张发起 SVG 重绘 (Canvas 版继续作为即时兜底) ──
svgApply(TEX.grass,'grass'); svgApply(TEX.snowGround,'snowGround'); svgApply(TEX.dirt,'dirt');
svgApply(TEX.brick,'brick'); svgApply(TEX.plaster,'plaster'); svgApply(TEX.stone,'stone');
svgApply(TEX.wood,'wood'); svgApply(TEX.woodDark,'woodDark'); svgApply(TEX.sandbag,'sandbag');
svgApply(TEX.metal,'metal'); svgApply(TEX.bark,'bark'); svgApply(TEX.leaves,'leaves');
svgApply(TEX.roof,'roof'); svgApply(TEX.hay,'hay'); svgApply(TEX.hedge,'hedge'); svgApply(TEX.track,'track');
TEX.grime=makeTex(128,128,(g,w,h)=>{ g.fillStyle='#fff'; g.fillRect(0,0,w,h); });
TEX.cloth=makeTex(128,128,(g,w,h)=>{ g.fillStyle='#fff'; g.fillRect(0,0,w,h); });
TEX.metalBrush=makeTex(128,128,(g,w,h)=>{ g.fillStyle='#fff'; g.fillRect(0,0,w,h); });
TEX.grainLight=makeTex(128,128,(g,w,h)=>{ g.fillStyle='#fff'; g.fillRect(0,0,w,h); });
TEX.water=makeTex(128,128,(g,w,h)=>{ g.fillStyle='#fff'; g.fillRect(0,0,w,h); });
TEX.ice=makeTex(128,128,(g,w,h)=>{ g.fillStyle='#fff'; g.fillRect(0,0,w,h); });
TEX.crater=makeTex(128,128,(g,w,h)=>{ g.fillStyle='#fff'; g.fillRect(0,0,w,h); });
svgApply(TEX.grime,'grime'); svgApply(TEX.cloth,'cloth'); svgApply(TEX.water,'water'); svgApply(TEX.ice,'ice'); svgApply(TEX.crater,'crater');
svgApply(TEX.metalBrush,'metalBrush'); svgApply(TEX.grainLight,'grainLight');
const MAT = {
grass: new THREE.MeshLambertMaterial({map:TEX.grass, vertexColors:true}),
brick: new THREE.MeshLambertMaterial({map:TEX.brick}),
plaster: new THREE.MeshLambertMaterial({map:TEX.plaster}),
stone: new THREE.MeshLambertMaterial({map:TEX.stone}),
wood: new THREE.MeshLambertMaterial({map:TEX.wood}),
woodDark: new THREE.MeshLambertMaterial({map:TEX.woodDark}),
sandbag: new THREE.MeshLambertMaterial({map:TEX.sandbag}),
metal: new THREE.MeshLambertMaterial({map:TEX.metal}),
	metalDark: new THREE.MeshLambertMaterial({color:0x3a3d38, map:TEX.metalBrush}),
bark: new THREE.MeshLambertMaterial({map:TEX.bark}),
leaves: new THREE.MeshLambertMaterial({map:TEX.leaves, transparent:true, alphaTest:0.5, side:THREE.DoubleSide}),
roof: new THREE.MeshLambertMaterial({map:TEX.roof}),
hay: new THREE.MeshLambertMaterial({map:TEX.hay}),
	rubble: new THREE.MeshLambertMaterial({color:0x8a8378, map:TEX.grainLight}),
};
// 战役环境主题着色: 地面/树叶/屋顶随战场变化 (雪地/废墟/江南/黄土)
MAT.grass.color.set(THEME.ground);
MAT.leaves.color.set(THEME.leaf);
MAT.roof.color.set(THEME.roof);
if(THEME.snow){ MAT.grass.map=TEX.snowGround; MAT.sandbag.color.set(0xd8dade); MAT.hay.color.set(0xcfd2d6); MAT.stone.color.set(0xc8ccd2); }
if(CAMPAIGN.theme==='loess'){ MAT.stone.color.set(0xd8c8a0); MAT.plaster.color.set(0xe0d0a8); }
// 雪檐房顶覆盖: 雪地战役给屋顶叠加一层带出檐的积雪盖板 (作为屋顶子节点, 随屋顶坍塌一并消失)
MAT.snowCap=new THREE.MeshLambertMaterial({color:0xedf2f8});
function addSnowCap(rm){
if(!THEME.snow||!rm||!rm.geometry||!rm.geometry.parameters) return rm;
const gp=rm.geometry.parameters;
if(gp.width===undefined||gp.depth===undefined) return rm;
const cap=new THREE.Mesh(new THREE.BoxGeometry(gp.width+0.16,0.13,gp.depth+0.16),MAT.snowCap);
cap.position.y=(gp.height||0.2)/2+0.065;
cap.castShadow=false; cap.receiveShadow=true;
rm.add(cap);
return rm;
}
