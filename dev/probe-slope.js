'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const CANNON=require(path.join(__dirname,'_cannon.js'));
// ── 通用小桩 (与 probe-bots.js 同源) ──
const mk2d=()=>new Proxy({}, { get(t,k){
if(k==='canvas') return {width:64,height:64};
if(typeof k==='symbol') return undefined;
if(!(k in t)) t[k]=(...a)=>mk2d();
return t[k];
}, set(t,k,v){ t[k]=v; return true; } });
const mkElement=(tag)=>{
const el={tagName:(tag||'div').toUpperCase(),style:{},classList:{add(){},remove(){},toggle(){},contains(){return false;}},
textContent:'',innerHTML:'',value:'',dataset:{},disabled:false,
children:[],appendChild(c){this.children.push(c);c.parent=this;return c;},prepend(c){this.children.unshift(c);c.parent=this;return c;},
remove(){ if(this.parent){ const i=this.parent.children.indexOf(this); if(i>=0) this.parent.children.splice(i,1); } },addEventListener(){},removeEventListener(){},focus(){},
getContext:()=>mk2d(),width:0,height:0,
setAttribute(){},querySelector:()=>mkElement(),querySelectorAll:()=>[],
};
Object.defineProperty(el,'firstChild',{get(){ if(!el._fc) el._fc=Object.assign(mkElement('div'),{textContent:''}); return el._fc; }});
Object.defineProperty(el,'lastChild',{get(){ return el.children.length?el.children[el.children.length-1]:el.firstChild; }});
el.removeChild=c=>{ const i=el.children.indexOf(c); if(i>=0) el.children.splice(i,1); return c; };
return el;
};
const byId={};
const document={
createElement:t=>t==='canvas'?Object.assign(mkElement('canvas'),{width:0,height:0}):mkElement(t),
createElementNS:()=>mkElement('canvas'),
getElementById:id=>{ if(!byId[id]){ byId[id]=mkElement(); byId[id].id=id; } return byId[id]; },
querySelector:sel=>{ if(sel==='canvas') return Object.assign(mkElement('canvas'),{width:0,height:0}); return mkElement(); },
querySelectorAll:()=>[],
body:mkElement('body'),head:mkElement('head'),
addEventListener(){},removeEventListener(){},hidden:false,pointerLockElement:null,exitPointerLock(){},
};
// ── THREE 桩 (与 probe-bots.js 同源, 只保留 ragdoll 用到的子集) ──
class V3{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}setScalar(s){this.x=s;this.y=s;this.z=s;return this;}
copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;}clone(){return new V3(this.x,this.y,this.z);}
add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;}sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this;}
addScaledVector(v,s){this.x+=v.x*s;this.y+=v.y*s;this.z+=v.z*s;return this;}
multiplyScalar(s){this.x*=s;this.y*=s;this.z*=s;return this;}
normalize(){const l=Math.hypot(this.x,this.y,this.z)||1;this.x/=l;this.y/=l;this.z/=l;return this;}
length(){return Math.hypot(this.x,this.y,this.z);}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z;}
distanceTo(v){return Math.hypot(this.x-v.x,this.y-v.y,this.z-v.z);}
dot(v){return this.x*v.x+this.y*v.y+this.z*v.z;}crossVectors(a,b){this.x=a.y*b.z-a.z*b.y;this.y=a.z*b.x-a.x*b.z;this.z=a.x*b.y-a.y*b.x;return this;}
applyAxisAngle(){return this;}setFromMatrixColumn(){return this;}lerpVectors(){return this;}
addScalar(s){this.x+=s;this.y+=s;this.z+=s;return this;}divideScalar(s){s=s||1;this.x/=s;this.y/=s;this.z/=s;return this;}distanceToSquared(v){return (this.x-v.x)**2+(this.y-v.y)**2+(this.z-v.z)**2;}setLength(l){return this.normalize().multiplyScalar(l);}}
class Euler{constructor(){this.x=0;this.y=0;this.z=0;this.order='XYZ';}set(x,y,z,o){this.x=x;this.y=y;this.z=z;if(o)this.order=o;return this;}}
class Obj3{constructor(){this.position=new V3();this.rotation=new Euler();this.scale=new V3(1,1,1);this.quaternion={x:0,y:0,z:0,w:1,set(){return this;},copy(v){this.x=v.x;this.y=v.y;this.z=v.z;this.w=v.w;return this;},setFromUnitVectors(){return this;}};this.children=[];this.visible=true;this.castShadow=false;this.receiveShadow=false;this.renderOrder=0;this.matrix={};this.userData={};this.material=null;this.geometry=null;}
add(m){this.children.push(m);m.parent=this;return this;}remove(m){const i=this.children.indexOf(m);if(i>=0)this.children.splice(i,1);}
traverse(fn){fn(this);for(const c of this.children)if(c&&c.traverse)c.traverse(fn);}
updateMatrix(){}
lookAt(){return this;}
clone(){const c=new this.constructor();if(this.geometry)c.geometry=this.geometry;if(this.material)c.material=this.material;c.position=new V3(this.position.x,this.position.y,this.position.z);c.rotation=new Euler();if(this.rotation.x||this.rotation.y||this.rotation.z)c.rotation.set(this.rotation.x,this.rotation.y,this.rotation.z);c.scale=new V3(this.scale.x,this.scale.y,this.scale.z);c.visible=this.visible;c.castShadow=this.castShadow;c.name=this.name;return c;}};
class Geo{constructor(...a){this.attributes={};this.parameters={};}translate(){return this;}rotateX(){return this;}rotateY(){return this;}rotateZ(){return this;}setAttribute(n,a){this.attributes[n]=a;return this;}setIndex(){return this;}setFromPoints(){return this;}computeVertexNormals(){return this;}dispose(){}}
class _PlaneGeo extends Geo{constructor(w=1,h=1,sg=1,sh=1){super(w,h);const gx=(sg||1)+1,gy=(sh||1)+1;this.attributes.position={count:gx*gy,array:new Float32Array(gx*gy*3),getX:i=>((i%gx)/gx-0.5)*w,getZ:i=>(Math.floor(i/gx)/gy-0.5)*h,getY:()=>0,setY(){},setX(){},setZ(){}};}}
class BufAttr{constructor(a,n){this.array=a;this.itemSize=n;this.count=(a&&a.length)||0;}
set(){return this;}
getX(i){return (this.array&&this.array[i*this.itemSize])||0;}
getY(i){return (this.array&&this.array[i*this.itemSize+1])||0;}
getZ(i){return (this.array&&this.array[i*this.itemSize+2])||0;}
setX(i,v){if(this.array)this.array[i*this.itemSize]=v;}
setY(i,v){if(this.array)this.array[i*this.itemSize+1]=v;}
setZ(i,v){if(this.array)this.array[i*this.itemSize+2]=v;}}
class _Color{constructor(c){this.c=c;}set(){return this;}}
const _wrapColor=c=>(typeof c==='number'||typeof c==='string')?{set(v){this.v=v;}}:(c&&typeof c==='object')?c:{set(){}};
const _mat=cls=>{ return class extends cls{constructor(o){super();Object.assign(this,o||{});this.color=_wrapColor(this.color);}dispose(){}clone(){ return new this.constructor(Object.assign({},this,{color:this.color})); }}; };
class _Fog{constructor(c,n,f){this.color=new _Color(c);this.near=n;this.far=f;}}
class _FogExp2{constructor(c,d){this.color=new _Color(c);this.density=d;}}
const THREE={
WebGLRenderer:class{constructor(){this.domElement=Object.assign(mkElement('canvas'),{width:0,height:0});this.shadowMap={enabled:false,type:0,autoUpdate:true};this.setSize=()=>{};this.setPixelRatio=()=>{};this.render=()=>{};this.clear=()=>{};this.clearDepth=()=>{};this.outputColorSpace='';this.setClearColor=()=>{};this.setAnimationLoop=()=>{};this.domElement.addEventListener=()=>{};this.domElement.style={};}},
Scene:class extends Obj3{constructor(){super();this.background=null;this.fog=null;}},
PerspectiveCamera:class extends Obj3{constructor(){super();this.fov=70;this.near=0.1;this.far=1000;this.aspect=1;}updateProjectionMatrix(){}getWorldDirection(v){v.set(0,0,-1);return v;}},
Group:class extends Obj3{},Mesh:class extends Obj3{constructor(g,m){super();this.geometry=g||new Geo();this.material=m||{};}},
InstancedMesh:class extends Obj3{constructor(g,m,n){super();this.count=n||1;this.instanceMatrix={array:new Float32Array((n||1)*16),itemSize:16,needsUpdate:false};}setMatrixAt(i,mm){if(mm&&mm.elements)this.instanceMatrix.array.set(mm.elements,i*16);return this;}setColorAt(){if(!this.instanceColor)this.instanceColor={needsUpdate:false};return this;}},
Points:class extends Obj3{constructor(g,m){super();this.geometry=g;this.material=m;}},
LineSegments:class extends Obj3{constructor(g,m){super();this.geometry=g;this.material=m;}},
Object3D:Obj3,Sprite:class extends Obj3{constructor(m){super();this.material=m||{};if(!this.material.color)this.material.color={set(){}};}},
Vector2:class{constructor(x=0,y=0){this.x=x;this.y=y;}set(x,y){this.x=x;this.y=y;return this;}},
Vector3:V3,Vector4:V3,Euler:Euler,Quaternion:class{set(){return this;}setFromUnitVectors(){return this;}identity(){return this;}setFromEuler(){return this;}},
Color:_Color,
Fog:_Fog,FogExp2:_FogExp2,
BoxGeometry:Geo,CylinderGeometry:Geo,SphereGeometry:Geo,ConeGeometry:Geo,TorusGeometry:Geo,RingGeometry:Geo,CircleGeometry:Geo,PlaneGeometry:_PlaneGeo,
BufferGeometry:Geo,BufferAttribute:BufAttr,Float32BufferAttribute:BufAttr,InstancedBufferAttribute:BufAttr,
MeshLambertMaterial:_mat(class{constructor(){}}),
MeshBasicMaterial:_mat(class{constructor(){}}),
MeshStandardMaterial:_mat(class{constructor(){}}),
MeshPhongMaterial:_mat(class{constructor(){}}),
PointsMaterial:_mat(class{constructor(){}}),
ShaderMaterial:class{constructor(o){Object.assign(this,o||{});}},
SpriteMaterial:_mat(class{constructor(){}}),
LineBasicMaterial:class{constructor(o){Object.assign(this,o||{});}},
CanvasTexture:class{constructor(c){this.image=c;this.repeat=new V3(1,1,1);this.offset=new V3(0,0,0);this.needsUpdate=false;}clone(){return new THREE.CanvasTexture(this.image);}dispose(){}},
Texture:class{constructor(){this.repeat=new V3(1,1,1);this.offset=new V3(0,0,0);this.wrapS=0;this.wrapT=0;this.needsUpdate=false;}clone(){return new THREE.Texture();}},
DirectionalLight:class extends Obj3{constructor(c,i){super();this.intensity=i?i:1;this.color=new _Color(c);this.target=new Obj3();this.shadow={mapSize:new V3(1,1,1),bias:0,camera:{updateProjectionMatrix(){},left:0,right:0,top:0,bottom:0,far:0,near:0}} } },
AmbientLight:class extends Obj3{constructor(c,i){super();this.intensity=i;this.color=new _Color(c);this.target=new Obj3();}},
HemisphereLight:class extends Obj3{constructor(a,b,i){super();this.intensity=i;}},
PointLight:class extends Obj3{},
Box3:class{setFromObject(){return this;}expandByObject(){return this;}},
Clock:class{getDelta(){return 0;}},
Matrix4:class{compose(){return this;}makeRotationFromEuler(){return this;}},
MathUtils:{clamp:(v,a,b)=>v<a?a:(v>b?b:v)},
RepeatWrapping:1000,DoubleSide:2,BackSide:1,FrontSide:0,SRGBColorSpace:'srgb',NoToneMapping:0,
PCFSoftShadowMap:2,PCFShadowMap:1,BasicShadowMap:0,NearestFilter:0,LinearFilter:1,
};
// ── 媒体/窗口桩 ──
const AP=()=>({value:0,setValueAtTime(){},setTargetAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}});
const AC=class{
createOscillator(){return {frequency:AP(),detune:AP(),type:'',start(){},stop(){},connect(){},onended:null};}
createGain(){return {gain:AP(),connect(){},disconnect(){}};}
createBuffer(){return {getChannelData:()=>new Float32Array(16),duration:1,numberOfChannels:1};}
createBufferSource(){return {buffer:null,loop:false,playbackRate:AP(),start(){},stop(){},connect(){},onended:null};}
createBiquadFilter(){return {type:'',frequency:AP(),detune:AP(),Q:AP(),connect(){}};}
createDynamicsCompressor(){return {threshold:AP(),ratio:AP(),attack:AP(),release:AP(),connect(){}};}
createStereoPanner(){return {pan:AP(),connect(){}};}
resume(){return Promise.resolve();}
get state(){return 'running';}
get destination(){return {};}
get currentTime(){return 0;}
get sampleRate(){return 44100;}
};
const window={addEventListener(){},removeEventListener(){},AudioContext:AC,webkitAudioContext:AC};
window.CANNON=CANNON; // ragInit 依赖 window.CANNON (与浏览器 CDN 加载同版本)
// 可播种 PRNG: 探针结果可复现 (游戏用 Math.random, 试次 outcome 受序列影响; PROBE_RAG_SEED 换种子扫方差)
let __rs=(parseInt(process.env.PROBE_RAG_SEED)||0xC0FFEE)>>>0;
const __rand=()=>{ __rs=(__rs+0x6D2B79F5)>>>0; let t=__rs; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; };
const sandbox={
console,Math:Object.assign(Object.create(Math),{random:__rand}),JSON,performance:{now:()=>Date.now()},
location:{search:'?seed=42',reload(){},href:'http://localhost/'},
localStorage:{_s:{sf_campaign:'0'},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}},
navigator:{},document,window,
requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},
setTimeout:(f,t)=>{return 0;},clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{},
devicePixelRatio:1,innerWidth:1280,innerHeight:720,addEventListener(){},removeEventListener(){},
AudioContext:AC,
};
sandbox.globalThis=sandbox;
sandbox.THREE=THREE;
sandbox.window=window;
sandbox.CANNON=CANNON; // 浏览器里 window.CANNON 即全局; vm 沙箱需显式放进全局作用域
// ── 逐脚本加载 (与 probe-bots.js 同源) ──
function load(ctx,file){ vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file}); }
function boot(campIdx){
const byIdx={};for(const k in byId)delete byId[k];
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document;ctx.window=window;
ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
const files=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15g-capmodels.js','js/15h-capital.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/23-deploy.js','js/24-main.js'];
for(const f of files) load(ctx,f);
return ctx;
}

// ─────────────────────────────────────────────
// 坡度断言 (2026-09-12 百团改版: 用户实机报"沟壑让坦克和人以搞笑方式过去"的回归探针)
// 断言组: ①坦克全速撞西沟陡崖 → 车头探崖<2m 即被挡, 不得过沟; ②坦克从沟底仰攻陡崖 → 登不上塬;
//         ③坦克走坡道 R1 → 全速过沟; ④步兵 slopeGateMove 仰攻陡崖 → 登不上塬;
//         ⑤步兵走坡道 → 可下到沟底; ⑥NAV 塬面↔西川基地 寻路存在且不穿沟壁带 (只走坡道/沟底);
//         ⑦斜向抵崖 (非正对) → 沿等高线滑移不卡死。
// ─────────────────────────────────────────────
// 西沟 z=0 断面中线 x (折线段 (-181,20)→(-173,-90) 线性内插) 与坡道 R1
const GEOFN=`(()=>{
const segD=(px,pz,ax,az,bx,bz)=>{const abx=bx-ax,abz=bz-az;const t=Math.max(0,Math.min(1,((px-ax)*abx+(pz-az)*abz)/(abx*abx+abz*abz||1)));return Math.hypot(px-(ax+abx*t),pz-(az+abz*t));};
const R1=LOESS.ramps[0];
return {
  cl:(-181)+((0-20)/(-90-20))*((-173)-(-181)),
  rampDist:(x,z)=>segD(x,z,R1.x0,R1.z0,R1.x1,R1.z1),
  R1, W:LOESS.w, GB:LOESS.bottom, TE:LOESS.talus, D:LOESS.d
};
})()`;
function probeTank(ctx,sx,sz,yaw,frames){
ctx.__sx=sx; ctx.__sz=sz; ctx.__yaw=yaw; ctx.__frames=frames;
return vm.runInContext(`(()=>{
tanks.length=0;
const t=new Tank(0,0);
t.playerDriven=true; t.isAI=false; t.crewBot=null;
t.pos.x=__sx; t.pos.z=__sz; t.pos.y=heightAt(__sx,__sz);
t.yaw=__yaw; t.vel=6;
const G=${GEOFN};
const h0=heightAt(__sx,__sz);
let minGd=1e9, maxGd=0, maxClimb=0, maxX=-1e9, minX=1e9;
for(let f=0;f<__frames;f++){
t.update(1/60);
const gd=Math.abs(t.pos.x-G.cl);
if(gd<minGd) minGd=gd;
if(gd>maxGd) maxGd=gd;
const climb=heightAt(t.pos.x,t.pos.z)-h0;
if(climb>maxClimb) maxClimb=climb;
if(t.pos.x>maxX) maxX=t.pos.x;
if(t.pos.x<minX) minX=t.pos.x;
}
// 脱困检查: 模拟真实油门 (每帧回补倒车车速) 3s —— 对称封坡数学上保证必可脱困
let escaped=false;
for(let f=0;f<180&&!escaped;f++){
t.vel=-6; t.yaw=__yaw; // 持续全倒车
t.update(1/60);
if(Math.abs(t.pos.x-G.cl)>G.W+2||t.pos.x<G.cl-G.W-2) escaped=true;
}
tanks.pop();
return {minGd:+minGd.toFixed(1), maxGd:+maxGd.toFixed(1), maxClimb:+maxClimb.toFixed(1), maxX:+maxX.toFixed(1), minX:+minX.toFixed(1), escaped, x:+t.pos.x.toFixed(1)};
})()`,ctx);
}
function probeFoot(ctx,sx,sz,dx,dz,steps){
ctx.__sx=sx; ctx.__sz=sz; ctx.__dx=dx; ctx.__dz=dz; ctx.__steps=steps;
return vm.runInContext(`(()=>{
const G=${GEOFN};
const pos={x:__sx,z:__sz};
const h0=heightAt(pos.x,pos.z);
let crossed=false, minGd=1e9, maxX=-1e9;
for(let i=0;i<__steps;i++){
const mv=slopeGateMove(pos,__dx,__dz);
pos.x+=mv[0]; pos.z+=mv[1];
const gd=Math.abs(pos.x-G.cl);
if(gd<minGd) minGd=gd;
if(pos.x>maxX) maxX=pos.x;
if(pos.x>G.cl+G.W+2) crossed=true;
if(!isFinite(pos.x)||!isFinite(pos.z)) return {nan:true};
}
return {climb:+(heightAt(pos.x,pos.z)-h0).toFixed(1), drop6:(heightAt(pos.x,pos.z)-h0)<-6, crossed, minGd:+minGd.toFixed(1), maxX:+maxX.toFixed(1), x:+pos.x.toFixed(1)};
})()`,ctx);
}
function probeNav(ctx){
return vm.runInContext(`(()=>{
const G=${GEOFN};
// 塬面(-120,40) → 西川基地(-250,10): 应存在路径, 且途经点只在 坡道走廊/沟底/带外, 不穿沟壁带
const p=NAV.findPath(-120,40,-250,10);
if(!p||!p.length) return {path:false};
let bad=0, worst=null;
for(const [x,z] of p){
const gd=Math.abs(x-G.cl);
const inWall=gd>G.GB&&gd<G.W-0.5;
const onRamp=G.rampDist(x,z)<=(G.R1.w+3.5);
if(inWall&&!onRamp){ bad++; if(!worst) worst={x:+x.toFixed(0),z:+z.toFixed(0),gd:+gd.toFixed(1)}; }
}
return {path:true, n:p.length, bad, worst};
})()`,ctx);
}
function runCampaign(i){
const ctx=boot(i);
const start=vm.runInContext(`(()=>{const btn=document.getElementById('startBtn'); if(btn&&btn.onclick){btn.onclick();return {ok:true};} return {ok:false};})()`,ctx);
if(!start.ok) return {fail:'开局失败'};
const camp=vm.runInContext('CAMPAIGNS['+i+'].id',ctx);
if(camp!=='baituan') return {camp, skip:true};
vm.runInContext('globalThis.__G='+GEOFN,ctx);
const res={camp, bad:0, lines:[]};
const W=vm.runInContext('LOESS.w',ctx), GB=vm.runInContext('LOESS.bottom',ctx);
const CL=-179.6, WB=CL+W+2; // 西沟 z=0 断面中线 / 带外边界
// ① 坦克塬顶冲崖: 下崖=单向慢爬 (减速带兜底), 25s 内应下到沟底 (minGd<GB); 登不上对岸塬面
const t1=probeTank(ctx, CL-17, 0, Math.PI/2, 1500);
if(t1.minGd>GB+1){ res.bad++; res.lines.push(`①塬顶冲崖下沟 ✗ 未下到沟底 ${JSON.stringify(t1)}`); }
else res.lines.push(`①塬顶冲崖 ✓ 慢爬下沟 (minGd=${t1.minGd}, 终点 x=${t1.x}), 且攀不上对岸 (maxX=${t1.maxX} < ${WB})`);
// ①b 下到沟底后原地倒车仰攻: 登不上西侧塬面 (单向性)
const t1b=probeTank(ctx, CL+8, 0, Math.PI/2, 420); // 沟内偏东, 朝东=仰攻东壁
if(t1b.maxX>WB){ res.bad++; res.lines.push(`①b沟内仰攻 ✗ 竟登上塬 ${JSON.stringify(t1b)}`); }
else res.lines.push(`①b沟内仰攻 ✓ 攀至maxGd=${t1b.maxGd} 被陡崖挡住`);
// ② 坦克沟底仰攻后倒车脱困: 下坡阀保证可退回沟底 (minGd<GB)
const t2=probeTank(ctx, CL, 0, Math.PI/2, 420);
if(t2.maxX>WB||t2.minGd>GB){ res.bad++; res.lines.push(`②沟底仰攻/脱困 ✗ ${JSON.stringify(t2)}`); }
else res.lines.push(`②沟底仰攻 ✓ 攀至maxGd=${t2.maxGd} 被挡, 倒车退回沟底 (minGd=${t2.minGd}) ✓`);
// ③ 坦克走坡道 R1: 全速过沟 (8s 内越过东坡道口)
const R1=vm.runInContext('JSON.parse(JSON.stringify(LOESS.ramps[0]))',ctx);
const rw=Math.hypot(R1.x1-R1.x0,R1.z1-R1.z0), rx=(R1.x1-R1.x0)/rw, rz=(R1.z1-R1.z0)/rw;
const t3=probeTank(ctx, R1.x0-rx*8, R1.z0-rz*8, Math.atan2(rx,rz), 1100);
if(t3.maxX<=R1.x1){ res.bad++; res.lines.push(`③坡道过沟 ✗ ${JSON.stringify(t3)}`); }
else res.lines.push(`③坡道过沟 ✓ R1 全速通过 (抵达 x=${t3.maxX} > 东口 ${R1.x1})`);
// ④ 步兵沟底仰攻陡崖: 登不上塬 (maxX<带外; 65°封攀+等高线滑移)
const f4=probeFoot(ctx, CL, 0, 1, 0, 600);
if(f4.crossed||f4.nan){ res.bad++; res.lines.push(`④步兵仰攻 ✗ ${JSON.stringify(f4)}`); }
else res.lines.push(`④步兵仰攻 ✓ 爬升=${f4.climb}m (maxX=${f4.maxX}) 被陡崖挡住`);
// ⑤ 步兵走坡道下沟: 可达沟底 (净下降>6m=进入沟底, 或跨过中线) —— 步距0.1m×900=90m 覆盖全坡道
const f5=probeFoot(ctx, R1.x0-rx*6, R1.z0-rz*6, rx*0.1, rz*0.1, 900);
const f5drop=-(f5.climb);
const f5ok=f5.drop6||f5.crossed||f5drop>6;
if(!f5ok){ res.bad++; res.lines.push(`⑤步兵坡道下沟 ✗ ${JSON.stringify(f5)}`); }
else res.lines.push(`⑤步兵坡道下沟 ✓ 净下降=${f5drop.toFixed(1)}m (minGd=${f5.minGd})`);
// ⑥ NAV 寻路 塬面→西川基地: 存在且不穿沟壁带
const n6=probeNav(ctx);
if(!n6.path||n6.bad>0){ res.bad++; res.lines.push(`⑥NAV ✗ ${JSON.stringify(n6)}`); }
else res.lines.push(`⑥NAV 塬面→西基地 ✓ ${n6.n} 节点, 0 处穿沟壁`);
// ⑦ 斜向抵崖: 沿等高线滑移不卡死 (位移持续, 无 NaN)
const f7=probeFoot(ctx, -179.6-6, -6, 0.06, 0.08, 200);
if(f7.nan){ res.bad++; res.lines.push(`⑦斜向滑移 ✗ NaN`); }
else res.lines.push(`⑦斜向滑移 ✓ 终点(${f7.x}) 无 NaN`);
return res;
}
const idxs=process.argv.slice(2).map(Number).filter(n=>!isNaN(n));
let camps=idxs;
if(!camps.length){
const probe=boot(0);
const total=vm.runInContext('CAMPAIGNS.length',probe);
const all=vm.runInContext('CAMPAIGNS.map(c=>c.id)',probe);
camps=[];
for(let i=0;i<total;i++) if(all[i]==='baituan') camps.push(i);
}
let bad=0;
console.log('== 坡度物理探针 (坦克上坡>70°封/下坡减速阀 + 步兵40°/65°) ==');
for(const i of camps){
const r=runCampaign(i);
if(r.fail){ console.log(`#${i} FAIL ${r.fail}`); bad++; continue; }
if(r.skip){ console.log(`#${i} ${r.camp}: 非百团, 跳过`); continue; }
for(const l of r.lines) console.log(`#${i} ${l}`);
bad+=r.bad;
}
console.log(bad===0?'\n坡度探针全过 ✓':'\n坡度探针存在失败 ✗');
process.exit(bad===0?0:1);
