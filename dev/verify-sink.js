// ★2026-11-17: 05b _hedgeBlobGeo (叶团重做) 真读 SphereGeometry 的 position/uv/index 三数组
// ⇒ 无数组局部桩全体炸桩 (桩不忠实, 非被测代码问题)。局部桩表升级忠实经纬球
// (与 _bootstub._SphereGeo2 同形同序, extends 本文件的 Geo 保 no-op 方法面)。
function _FF17Sph(Base){ return class extends Base{constructor(r=1,ws=8,hs=6){super(r,ws,hs);if(!this.attributes) this.attributes={};if(!this.parameters) this.parameters={};
ws=Math.max(3,ws|0); hs=Math.max(2,hs|0);
const pos=[],uv=[],idx=[];
for(let iy=0;iy<=hs;iy++){ const v=iy/hs;
for(let ix=0;ix<=ws;ix++){ const u=ix/ws;
pos.push(-r*Math.cos(u*Math.PI*2)*Math.sin(v*Math.PI), r*Math.cos(v*Math.PI), r*Math.sin(u*Math.PI*2)*Math.sin(v*Math.PI));
uv.push(u,1-v);}}
for(let iy=0;iy<hs;iy++)for(let ix=0;ix<ws;ix++){ const a=iy*(ws+1)+ix+1, b=a-1, c=(iy+1)*(ws+1)+ix, d=c+1;
if(iy!==0) idx.push(a,b,d);
if(iy!==hs-1) idx.push(b,c,d);}
this.attributes.position={count:pos.length/3,array:new Float32Array(pos),getX:i=>pos[i*3],getY:i=>pos[i*3+1],getZ:i=>pos[i*3+2]};
this.attributes.uv={count:uv.length/2,array:new Float32Array(uv)};
this.attributes.normal={count:pos.length/3,array:new Float32Array(pos.length)};
this.index={array:new Uint16Array(idx)};
this.parameters={radius:r,widthSegments:ws,heightSegments:hs};
}dispose(){}};}
// ─────────────────────────────────────────────
// dev/verify-boot.js —— 全量启动沙箱 (不进 Index.html)
// 用法: node dev/verify-boot.js [战役序号]   (默认全部战役)
// 原理: 桩化 THREE(几何/材质/灯光/粒子)/DOM/WebAudio, 按真实顺序加载 js/00~24,
//       然后模拟点击主菜单「进入战场」按钮执行 startGame → startMatch → showDeploy,
//       捕获任意战役开局路径的运行时错误 (曾抓出 23-deploy t===AT 的 ReferenceError)。
// ─────────────────────────────────────────────

// 临时全量启动探针: 桩化 THREE/DOM/媒体, 加载全部真实脚本, 对每个战役执行 startGame (跑完即删)
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
// ── 通用小桩 ──
const mk2d=()=>new Proxy({}, { get(t,k){
if(k==='canvas') return {width:64,height:64};
if(typeof k==='symbol') return undefined;
if(!(k in t)) t[k]=(...a)=>mk2d();
return t[k];
}, set(t,k,v){ t[k]=v; return true; } });
const mkElement=(tag)=>{
const el={tagName:(tag||'div').toUpperCase(),style:{},classList:{add(){},remove(){},toggle(){},contains(){return false;}},
textContent:'',innerHTML:'',value:'',dataset:{},disabled:false,
children:[],appendChild(c){this.children.push(c);return c;},prepend(c){this.children.unshift(c);},
remove(){},addEventListener(){},removeEventListener(){},focus(){},
getContext:()=>mk2d(),width:0,height:0,
setAttribute(){},querySelector:()=>mkElement(),querySelectorAll:()=>[],
};
Object.defineProperty(el,'firstChild',{get(){ if(!el._fc) el._fc={textContent:''}; return el._fc; }});
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
// ── THREE 桩 ──
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
applyAxisAngle(){return this;}setFromMatrixColumn(){return this;}lerpVectors(){return this;}}
class Euler{constructor(){this.x=0;this.y=0;this.z=0;this.order='XYZ';}set(x,y,z,o){this.x=x;this.y=y;this.z=z;if(o)this.order=o;return this;}}
class Obj3{constructor(){this.position=new V3();this.rotation=new Euler();this.scale=new V3(1,1,1);this.quaternion={setFromUnitVectors(){return this;}};this.children=[];this.visible=true;this.castShadow=false;this.receiveShadow=false;this.renderOrder=0;this.matrix={};this.userData={};this.material=null;this.geometry=null;}
add(m){this.children.push(m);m.parent=this;return this;}remove(m){const i=this.children.indexOf(m);if(i>=0){this.children.splice(i,1);m.parent=null;}}
traverse(fn){fn(this);for(const c of this.children)if(c&&c.traverse)c.traverse(fn);}
updateMatrix(){const e=this.matrix.elements||(this.matrix.elements=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]));e[12]=this.position.x;e[13]=this.position.y;e[14]=this.position.z;return this;}
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
// ★2026-10-05 昼夜批: 夜档 02-scene 的 nightFogColor() 在 ironbottom(锁夜) 上真调 Color.lerp ⇒ 本探针私有桩补齐 (与 _bootstub 同款)
if(!_Color.prototype.getHex){ _Color.prototype.getHex=function(){ return typeof this.c==='number'?this.c:0; }; }
if(!_Color.prototype.lerp){
const _h2r=h=>{ h=typeof h==='number'?h:parseInt(String(h).replace('#',''),16)||0; return [(h>>16)&255,(h>>8)&255,h&255]; };
_Color.prototype.lerp=function(t,a){ const c0=_h2r(this.c), c1=_h2r(t&&t.c!==undefined?t.c:t); const m=c0.map((v,i)=>Math.round(v+(c1[i]-v)*a)); this.c=(m[0]<<16)|(m[1]<<8)|m[2]; return this; };
}
const _wrapColor=c=>(typeof c==='number'||typeof c==='string')?{set(v){this.v=v;}}:(c&&typeof c==='object')?c:{set(){}};
const _mat=cls=>{ return class extends cls{constructor(o){super();Object.assign(this,o||{});this.color=_wrapColor(this.color);}clone(){const c=new this.constructor();Object.assign(c,this);c.color=_wrapColor(this.color);return c;}}; };   // 2026-11-18 跟码: craterMat.clone (弹坑批, 与 _bootstub 同规)
class _Fog{constructor(c,n,f){this.color=new _Color(c);this.near=n;this.far=f;}}
class _FogExp2{constructor(c,d){this.color=new _Color(c);this.density=d;}}
const THREE={
WebGLRenderer:class{constructor(){this.domElement=Object.assign(mkElement('canvas'),{width:0,height:0});this.shadowMap={enabled:false,type:0,autoUpdate:true};this.setSize=()=>{};this.setPixelRatio=()=>{};this.render=()=>{};this.clear=()=>{};this.clearDepth=()=>{};this.outputColorSpace='';this.setClearColor=()=>{};this.setAnimationLoop=()=>{};this.domElement.addEventListener=()=>{};this.domElement.style={};}},
Scene:class extends Obj3{constructor(){super();this.background=null;this.fog=null;}},
PerspectiveCamera:class extends Obj3{constructor(){super();this.fov=70;this.near=0.1;this.far=1000;this.aspect=1;}updateProjectionMatrix(){}getWorldDirection(v){v.set(0,0,-1);return v;}},
Group:class extends Obj3{},Mesh:class extends Obj3{constructor(g,m){super();this.geometry=g||new Geo();this.material=m||{};}},
InstancedMesh:class extends Obj3{constructor(g,m,n){super();this.count=n;this.instanceMatrix={array:new Float32Array((n||1)*16),needsUpdate:false,itemSize:16};}setMatrixAt(i,mm){if(mm&&mm.elements)this.instanceMatrix.array.set(mm.elements,i*16);return this;}setColorAt(){if(!this.instanceColor)this.instanceColor={needsUpdate:false};return this;}},
Points:class extends Obj3{constructor(g,m){super();this.geometry=g;this.material=m;}},
LineSegments:class extends Obj3{constructor(g,m){super();this.geometry=g;this.material=m;}},
Object3D:Obj3,Sprite:class extends Obj3{constructor(m){super();this.material=m||{};if(!this.material.color)this.material.color={set(){}};}},
Vector2:class{constructor(x=0,y=0){this.x=x;this.y=y;}set(x,y){this.x=x;this.y=y;return this;}},
Vector3:V3,Vector4:V3,Euler:Euler,Quaternion:class{set(){return this;}setFromUnitVectors(){return this;}identity(){return this;}setFromEuler(){return this;}setFromAxisAngle(){return this;}premultiply(){return this;}},
Color:_Color,
Fog:_Fog,FogExp2:_FogExp2,
BoxGeometry:Geo,CylinderGeometry:Geo,SphereGeometry:_FF17Sph(Geo),ConeGeometry:Geo,TorusGeometry:Geo,RingGeometry:Geo,CircleGeometry:Geo,PlaneGeometry:_PlaneGeo,
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
AmbientLight:class extends Obj3{constructor(c,i){super();this.intensity=i;this.color=new Color(c);}},
HemisphereLight:class extends Obj3{constructor(a,b,i){super();this.intensity=i;}},
PointLight:class extends Obj3{constructor(c,i,d,dec){super();this.color=c;this.intensity=i||0;this.distance=d||0;this.decay=dec||1;this.castShadow=false;}},
// ★2026-10-05 昼夜批: 夜档 _hlPoolEnsure 会 new THREE.SpotLight 并调 sl.target.updateMatrixWorld() (ironbottom 锁夜 ⇒ LOAD/首帧即炸)
SpotLight:class extends Obj3{constructor(c,i,d,a,p,dec){super();this.color=c;this.intensity=i||0;this.distance=d||0;this.angle=a||0;this.penumbra=p||0;this.decay=dec||1;this.castShadow=false;this.visible=true;this.target=new Obj3();this.target.updateMatrixWorld=()=>{};}},
Box3:class{setFromObject(){return this;}expandByObject(){return this;}},
Clock:class{getDelta(){return 0;}},
Matrix4:class{constructor(){this.elements=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);}compose(p){const e=this.elements;if(p&&p.x!==undefined){e[12]=p.x;e[13]=p.y;e[14]=p.z;}return this;}makeScale(x,y,z){const e=this.elements;e.fill(0);e[0]=x;e[5]=y;e[10]=z;e[15]=1;return this;}makeRotationFromEuler(){return this;}identity(){return this;}},
MathUtils:{clamp:(v,a,b)=>v<a?a:(v>b?b:v)},
RepeatWrapping:1000,DoubleSide:2,BackSide:1,FrontSide:0,SRGBColorSpace:'srgb',NoToneMapping:0,
PCFSoftShadowMap:2,PCFShadowMap:1,BasicShadowMap:0,NearestFilter:0,LinearFilter:1,
}
// ── 媒体/窗口桩 ──
const AP=()=>({value:0,setValueAtTime(){},setTargetAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}});
const AC=class{
createOscillator(){return {frequency:AP(),detune:AP(),type:'',start(){},stop(){},connect(){},onended:null};}
createGain(){return {gain:AP(),connect(){},disconnect(){}};}
createBuffer(){return {getChannelData:()=>new Float32Array(16),duration:1,numberOfChannels:1};}
createBufferSource(){return {buffer:null,loop:false,playbackRate:AP(),start(){},stop(){},connect(){},onended:null};}
createBiquadFilter(){return {type:'',frequency:AP(),Q:AP(),connect(){}};}
createDynamicsCompressor(){return {threshold:AP(),ratio:AP(),attack:AP(),release:AP(),connect(){}};}
createStereoPanner(){return {pan:AP(),connect(){}};}
resume(){return Promise.resolve();}
get state(){return 'running';}
get destination(){return {};}
get currentTime(){return 0;}
get sampleRate(){return 44100;}
};
const window={addEventListener(){},removeEventListener(){},AudioContext:AC,webkitAudioContext:AC,CANNON:{Body:class{constructor(o){Object.assign(this,o||{});this.position=new V3();this.velocity=new V3();this.angularVelocity=new V3();this.shapes=[];this.quaternion={setFromEuler(){return this;},set(){return this;}};}addShape(sh){this.shapes.push(sh);return this;}},World:class{constructor(){this.bodies=[];this.constraints=[];this.gravity=new V3();this.solver={iterations:0};}add(b){this.bodies.push(b);}addBody(b){this.bodies.push(b);}removeBody(b){const i=this.bodies.indexOf(b);if(i>=0)this.bodies.splice(i,1);}addConstraint(){}removeConstraint(){}},NaiveBroadphase:class{},Box:class{constructor(v){this.v=v;}},Sphere:class{constructor(r){this.r=r;}},Vec3:V3,PointToPointConstraint:class{},Material:class{},ContactMaterial:class{}},
};
let audioI=0;
const sandbox={
console,Math,JSON,performance:{now:()=>Date.now()},
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
sandbox.CANNON=window.CANNON;
// ── 逐脚本加载 ──
function load(ctx,file){ vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file}); }
function boot(campIdx){
const byIdx={};for(const k in byId)delete byId[k];
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document;ctx.window=window;
ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
// window 桩跨 boot 共享: 真页每次载入都是新 window, 这里必须手工复位对局期全局,
// 否则上一战役 startMatch 写的 __sfMatchWorldStart 泄漏进下一战役 —— procgen 世界比旧边界大时,
// 首次 retireMatchActors 台账清扫会按陈旧边界整段摘掉本世界的后段网格 (2026-10-24g 偶发红根因)。
delete window.__sfMatchWorldStart; window.__sfMatchSpawned=false;
const files=['js/00-config.js','js/00b-i18n.js','js/00c-procgen.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/23-deploy.js','js/24-main.js'];
for(const f of files) load(ctx,f); // 不含 24 的 loop 启动? 24 会调用 initMenuUI & setInterval? 探针只调 fn
return ctx;
}
// ── 沉入系统推演: 坦克/坠机/树木/灌木 各摧毁路径 (2026-08-31 新特性; 2026-09-01 结构改为即刻碎块倒塌) ──
function runCampaign(i){
const ctx=boot(i);
const start=vm.runInContext(`(()=>{
try{
const btn=document.getElementById('startBtn');
if(btn&&btn.onclick) btn.onclick(); else return {ok:false,err:'no onclick bound'};
return {ok:true};
}catch(e){ return {ok:false,err:String(e&&e.stack||e)}; }
})()`,ctx);
if(!start.ok) return {camp:'#'+i,fail:'开局失败: '+(start.err||'unknown')};
return vm.runInContext(`(()=>{
const out={camp:CAMPAIGN.id,checks:[]};
function assert(cond,msg){ if(!cond) throw new Error('断言失败: '+msg); }
// 步进 helper: fn(dt) × 次数
const step=(fn,dt,times)=>{ for(let k=0;k<times;k++){ nowT+=dt; fn(dt); } };
function chk(name,fn){
try{ fn(); out.checks.push(name+' ✓'); }
catch(e){ out.checks.push(name+' ✗ '+String(e&&e.stack||e).split('\\n').slice(0,2).join(' | ')); out.failed=true; }
}

// ── 1. 房屋墙段/废墟结构 (2026-09-01 倒塌重构; 2026-09-02 碎石堆定时消失): 摧毁即刻碎块化 ——
//    碰撞死+视觉即刻移除+原地碎石堆(停留 RUBBLE_TTL 后沉入消失), 结构本身不再排队下沉任务 ──
chk('结构:摧毁即刻倒塌→碎石堆停留后沉入消失',()=>{
// 2026-09-12 莫斯科城市边缘改版暴露: 厂区先于街块落位时首组=钢水包(带 onDead 爆炸/火区钩子) ——
// 特殊死亡钩子结构会向世界额外加对象, 碎石堆(4块)计数断言只适用普通墙组 → 跳过 onDead 组
const g=DESTRUCTIBLES.find(g=>!g.dead&&!g.roofRef&&!g.onDead)||DESTRUCTIBLES.find(g=>!g.dead&&!g.onDead)||DESTRUCTIBLES.find(g=>!g.dead);
if(!g){ out.checks.push('(本布局无可毁结构, 跳过)'); return; }
const visMeshes=g.meshes.filter(m=>m&&m.parent);
assert(visMeshes.length>0,'结构组有视觉网格');
const world0=world.children.length;
destroyStructure(g);
for(const bi of g.bi) assert(BOXES[bi].dead,'碰撞即刻死亡 bi='+bi);
assert(g.meshes.every(m=>!m||!m.parent),'摧毁后墙模型即刻移除 (不再站立停留)');
assert(!SINK_JOBS.some(j=>j.objs&&j.objs.some(m=>g.meshes.includes(m))),'结构本身不再排队下沉任务');
if(!g.roofRef){
assert(world.children.length===world0-visMeshes.length+4,'原地留碎石堆(4块)');
const pileJob=SINK_JOBS.find(j=>j.objs&&j.objs.length===4&&j.objs.some(m=>m.parent));
assert(pileJob,'碎石堆已登记下沉任务(停留后消失)');
step(updateWreckSinks,0.25,40); // 10s
assert(world.children.length===world0-visMeshes.length+4,'停留期内(≥10s)碎石堆仍在地面');
step(updateWreckSinks,0.25,140); // +35s 覆盖停留25s+下沉3.5s
assert(world.children.length===world0-visMeshes.length,'停留期满碎石堆沉入消失');
assert(!SINK_JOBS.includes(pileJob),'碎石堆下沉任务完成移除');
}else{
step(updateWreckSinks,0.25,40); // 10s: 无任何结构复活/残留
assert(g.meshes.every(m=>!m||!m.parent),'10s 后墙模型无残留');
}
});

// ── 2. 坦克残骸: 停留期是火源 → 开始下沉即熄火 → 半沉撤碰撞 → 全沉隐藏 → 重生恢复 ──
chk('坦克:停留燃烧→下沉熄火→全沉隐藏→重生恢复',()=>{
const t=tanks.find(t=>t.alive);
if(!t){ out.checks.push('(本模式无坦克, 跳过)'); return; }
t.takeDmg(99999,null);
assert(!t.alive,'坦克被摧毁');
assert(FIRE_SOURCES.includes(t.fireSrc),'残骸成为持续火源');
const bs=t.wreckBs;
assert(bs&&bs.every(b=>!b.dead),'残骸碰撞体存在');
step(updateWreckSinks,0.5,52); // 26s: 覆盖停留期(24-30s 中段)
// 停留期可能尚未结束(restT≤30): 继续步进直到进入下沉(火源被移除) — 上限再 12s
let guard=0;
while(t.fireSrc&&guard++<24) step(updateWreckSinks,0.5,1);
assert(!t.fireSrc,'开始下沉即不再火源 (removeFireSource)');
assert(!FIRE_SOURCES.includes(t.fireSrc),'FIRE_SOURCES 中已移除');
guard=0;
while(t.grp.visible!==false&&guard++<20) step(updateWreckSinks,0.5,1);
assert(t.grp.visible===false,'全沉后模型隐藏 (noRemove, 重生复用)');
assert(!t.wreckBs,'半沉时残骸碰撞体已撤除');
for(const b of bs) assert(b.dead,'碰撞体已死');
t.respawn();
assert(t.grp.visible===true,'重生恢复可见');
assert(t.alive,'重生存活');
});

// ── 3. 坠机残骸: 落地燃烧停留 → 下沉即熄火 → 全沉移除模型体 ──
chk('坠机:停留燃烧→下沉熄火→全沉移除',()=>{
const p=planes.find(p=>p.alive);
if(!p){ out.checks.push('(本模式无飞机, 跳过)'); return; }
p.takeDmg(99999,null);
assert(planeWrecks.length>0,'生成坠机残骸');
const w=planeWrecks[planeWrecks.length-1];
assert(w.state==='fall','残骸拖焰坠落中');
// 步进至坠地 (火源在落地瞬间注册)
let guard=0;
while(guard++<600&&w.state==='fall'){ updatePlaneWrecks(0.1); nowT+=0.1; }
assert(w.state==='rest','残骸已坠地静置');
assert(w.fireSrc&&FIRE_SOURCES.includes(w.fireSrc),'残骸火源已注册');
let fireGoneAtSink=true;
guard=0;
while(guard++<600&&planeWrecks.includes(w)){
updatePlaneWrecks(0.1); updateWreckSinks(0.1); nowT+=0.1; // 2026-09-06 B7b: 沉没推进收敛 queueSink 后, 主循环同时驱动两者 (24-main:65-69 同序)
if(w.sinking&&FIRE_SOURCES.includes(w.fireSrc)) fireGoneAtSink=false;
}
assert(!planeWrecks.includes(w),'全沉后残骸条目移除');
assert(fireGoneAtSink,'下沉开始即熄火');
assert(w.m.parent===null||w.m.parent===undefined,'模型体已从场景移除');
});

// ── 4. 树木: 倒伏停留 → 连干带冠沉入 → 实例删除 ──
// 2026-11-10 柳树批判据跟码: 柳 (kind:'willow') 也入 TREE_LIVE, 但实例索引走 WLOW_IM (wi) 而非
// TREE_IM (ti/li) —— 本测试读的是 TREE_IM 数组, 故只取乔木 (柳的下沉链由 verify-willow-20261110 专测)。
chk('树木:倒伏→停留→沉入→实例删除',()=>{
const tr=TREE_LIVE.find(t=>t.alive&&!t.fall&&t.kind==='tree');
if(!tr){ out.checks.push('(本布局无活树, 跳过)'); return; }
const trunkArr=TREE_IM.trunks.instanceMatrix.array;
const leafArr=TREE_IM.leaves.instanceMatrix.array;
treeFall(tr,1,0);
assert(tr.fall,'树开始倒伏');
step(updateFallingTrees,0.1,30); // 倒伏动画+触地回弹 (大树最长 ~2.5s)
assert(TREE_SINKS.some(s=>s.tr===tr),'倒伏完成登记沉入');
step(updateTreeSinks,0.25,132); // 停留(≤22s)+下沉(3.6s)+余量 ≈ 33s
assert(!TREE_SINKS.some(s=>s.tr===tr),'沉入任务完成');
assert(tr.dead===true,'树记录标死 (floraNear 不再返回)');
// 实例删除: 零缩放矩阵的位置元素(12/13/14)归零 (e[15] 恒为 1)
const posZero=(arr,base,n)=>{ for(let e2=12;e2<15;e2++){ for(let off=0;off<n;off++){ if(arr[(base+off)*16+e2]!==0) return false; } } return true; };
assert(posZero(trunkArr,tr.ti,1),'树干实例已删除');
assert(posZero(leafArr,tr.li,3),'叶面实例已删除');
});

// ── 5. 灌木: 炸没后停留 → 沉入 → 实例零缩放 ──
chk('灌木:炸没→停留→沉入→实例删除',()=>{
const rec=BUSH_LIVE.find(r=>!r.dead);
if(!rec){ out.checks.push('(本布局无灌木, 跳过)'); return; }
const arr=rec.im.instanceMatrix.array;
const posZero2=(base,n)=>{ for(let e2=12;e2<15;e2++){ for(let off=0;off<n;off++){ if(arr[(base+off)*16+e2]!==0) return false; } } return true; };
vanishFlora(rec,true);
assert(rec.dead,'灌木记录标死');
step(updateWreckSinks,0.25,72); // 停留(≤8s)+下沉(2.2s)+余量
assert(posZero2(rec.li0,2),'全沉后叶面实例零缩放删除');
});

// ── 6. 草丛/庄稼实例下沉 (与灌木同路径, 直接验证 inst sink 任务) ──
chk('实例批:queueSink inst 下沉→零缩放',()=>{
const bi=BURN_INST[0];
if(!bi){ out.checks.push('(本布局无可燃实例批, 跳过)'); return; }
let idx0=-1;
for(let k2=0;k2<bi.im.count;k2++){
const a=bi.im.instanceMatrix.array;
let vis=false; for(let e=0;e<16;e++) if(a[k2*16+e]!==0){ vis=true; break; }
if(vis){ idx0=k2; break; }
}
if(idx0<0){ out.checks.push('(本布局无可燃实例, 跳过)'); return; }
const y0=bi.im.instanceMatrix.array[idx0*16+13];
const job=queueSink({inst:{im:bi.im,idxs:[idx0]},depth:1.6,rest:1,sink:2});
step(updateWreckSinks,0.25,6); // 1s 静置 + 0.5s 下沉 (k≈0.25)
const y1=bi.im.instanceMatrix.array[idx0*16+13];
assert(y1<y0,'下沉中: 实例位置下降 ('+y0.toFixed(2)+'→'+y1.toFixed(2)+')');
step(updateWreckSinks,0.25,10);
const a6=bi.im.instanceMatrix.array;
let zero6=true;
for(let e2=12;e2<15;e2++){ if(a6[idx0*16+e2]!==0) zero6=false; }
assert(zero6,'全沉后实例零缩放');
assert(!SINK_JOBS.includes(job),'任务完成移除');
});

// ── 7. 坦克装甲抗性 (2026-09-02): 非反装甲伤害×TANK_ARMOR(=0.3); 巡飞弹/坦克炮/固定炮/反坦克攻击(ap)全额 ──
chk('坦克装甲:非反装甲伤害减免(0.3) / 反装甲全额',()=>{
assert(typeof TANK_ARMOR==='number'&&Math.abs(TANK_ARMOR-0.3)<1e-9,'TANK_ARMOR=0.3 (非反装甲只吃三成)');
// 关键调用点接线回归 (源码级, 防止后续改动悄悄丢掉 ap 标记)
assert(updateShells.toString().includes('s.owner,true'),'updateShells: 弹直击坦克(坦克炮/反坦克炮)走 ap 全额');
assert(fireBullet.toString().includes('def.atRifle'),'fireBullet: 反坦克枪(atRifle)全额, 机枪/步枪按装甲减免');
assert(loiterDetonate.toString().includes('900,d.owner,true'),'loiterDetonate: 巡飞弹直击坦克全额');
const t=tanks.find(t=>t.alive);
if(!t){ out.checks.push('(本模式无坦克, 跳过)'); return; }
const hp0=t.hp;
t.takeDmg(100,null);
assert(Math.abs((hp0-t.hp)-100*TANK_ARMOR)<1e-6,'非反装甲 100 → 实扣 '+(100*TANK_ARMOR).toFixed(1)+' (×'+TANK_ARMOR+')');
const hp1=t.hp;
t.takeDmg(100,null,true);
assert(Math.abs((hp1-t.hp)-100)<1e-6,'反装甲(ap=true) 100 → 实扣 100 (全额)');
// splashDamage 的 ap 标志传递: 爆炸中心(半径内坦克)同享减免/全额
const savedC=combatants.slice(); combatants.length=0;
try{
const hp3=t.hp;
splashDamage(t.pos.clone(),null,1-t.team,5,999,40,true);
assert(Math.abs((hp3-t.hp)-40)<1e-6,'splashDamage(ap=true) 中心 dmgVeh=40 全额');
const hp4=t.hp;
splashDamage(t.pos.clone(),null,1-t.team,5,999,40,false);
assert(Math.abs((hp4-t.hp)-40*TANK_ARMOR)<1e-6,'splashDamage(ap=false) 中心 40 → 实扣 '+(40*TANK_ARMOR).toFixed(1));
}finally{ combatants.length=0; combatants.push.apply(combatants,savedC); }
});

// ── 8. 坦克越野碾压 (2026-09-02): 掩体(挂牌 crush)车速足够时直接碾毁通过(不再被阻拦); 树篱可碾 ──
chk('坦克越野:掩体直接碾毁 / 树篱可碾',()=>{
const t=tanks.find(t=>t.alive);
if(!t){ out.checks.push('(本模式无坦克, 跳过)'); return; }
// 向坦克行进方向前方 2.6m 放一块临时"沙袋"碰撞箱, 挂牌 crush
const sn=Math.sin(t.yaw), cs=Math.cos(t.yaw);
const bb=addBoxCollider(t.pos.x+sn*2.6,t.pos.y+0.5,t.pos.z+cs*2.6,1.2,1.0,1.2);
bb.crush=true;
bb.gh=t.pos.y; // 坡地地图: gh 独立采样会高于箱心, 导致 maxY-gh<0.7 被当低矮障碍跳过 —— 测试箱贴坦克脚底
const meshBefore=world.children.length;
t.vel=5;
step(()=>t.update(0.05),0.05,8); // 0.4s 推进: 前轴圆命中 → 应碾毁而非推挤
assert(bb.dead,'车速足够时掩体被碾毁(不再被阻拦)');
assert(bb.maxX>=99999,'碾毁后碰撞盒已从占用格/射线清退 (killBox 移位)');
// 树篱: 找到真实树篱碰撞箱(诺曼底等) → crushCoverBox 应即时移除碰撞+视觉+植被记录
const hb=BOXES.find(b=>b&&b.crush&&b.flora&&!b.dead);
if(hb){
const hmesh=hb.mesh, hrec=hb.flora;
assert(hmesh&&hmesh.parent,'树篱碰撞箱已回挂视觉网格');
crushCoverBox(hb);
assert(hb.dead,'树篱被碾: 碰撞即死');
assert(hrec.dead,'树篱被碾: 植被记录标死(不再被点燃)');
assert(!hmesh.parent,'树篱被碾: 视觉网格即刻移除, 无残留');
}else out.checks.push('(本布局无树篱, 跳过)');
// 常量挂钩: 坦克速度配额 (spd ×1.3 已生效)
assert(FACTIONS.us.tanks[0].spd>7&&FACTIONS.ger.tanks[0].spd>7,'坦克极速已提升 (spd>7)');
});

out.ok=!out.failed;
return out;
})()`,ctx);
}
const idx=process.argv[2]!==undefined?parseInt(process.argv[2]):-1;
const probe=boot(0);
const total=vm.runInContext('CAMPAIGN.n?1:1',probe)&&vm.runInContext('CAMPAIGNS.length',probe);
const all=Array.from({length:total},(_,k)=>k);
const range=idx>=0&&idx<total?[idx]:all;
let bad=0;
for(const i of range){
const r=runCampaign(i);
if(r.fail){ console.log(`#${i} FAIL ${r.fail}`); bad++; continue; }
for(const c of r.checks) console.log(`#${i} ${r.camp}  ${c}`);
if(r.ok) console.log(`#${i} ${r.camp}  —— 全部通过 ✓`);
else bad++;
}
console.log(bad===0?'\n沉入系统推演全部通过 ✓':'\n存在失败项 ✗');
process.exit(bad===0?0:1);
