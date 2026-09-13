// ─────────────────────────────────────────────
// dev/probe-bots.js —— Bot AI 行为探针 (不进 Index.html)
// 用法: node dev/probe-bots.js [战役序号]   (默认全部战役)
// 原理: 复用 verify-boot 的桩 (THREE/DOM/WebAudio), 加载全部真实脚本并进入战场,
//       推演完整陆战循环 (士兵/坦克/炮弹/手雷/旗点/导航, 60/30/20fps 混合帧率)。
// 断言: ①推演全程无异常; ②"交战发呆"不超时 (state=combat 且目标记忆>3s 的帧数=0);
//       ③有跃进推进 (man=push 事件>0); ④有击杀 (伤害管线通); ⑤坐标不出现 NaN;
//       ⑥横移时间占交战时间 <50% (不再无限左右蹦); ⑦1v1 决斗: 双方开火且机动有变化。
// 软指标 (仅报告不判败): 探头次数、状态分布、死亡数。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
// ── 通用小桩 (与 probe-planes.js 同源) ──
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
applyAxisAngle(){return this;}setFromMatrixColumn(){return this;}lerpVectors(){return this;}
addScalar(s){this.x+=s;this.y+=s;this.z+=s;return this;}divideScalar(s){s=s||1;this.x/=s;this.y/=s;this.z/=s;return this;}distanceToSquared(v){return (this.x-v.x)**2+(this.y-v.y)**2+(this.z-v.z)**2;}setLength(l){return this.normalize().multiplyScalar(l);}}
class Euler{constructor(){this.x=0;this.y=0;this.z=0;this.order='XYZ';}set(x,y,z,o){this.x=x;this.y=y;this.z=z;if(o)this.order=o;return this;}}
class Obj3{constructor(){this.position=new V3();this.rotation=new Euler();this.scale=new V3(1,1,1);this.quaternion={setFromUnitVectors(){return this;}};this.children=[];this.visible=true;this.castShadow=false;this.receiveShadow=false;this.renderOrder=0;this.matrix={};this.userData={};this.material=null;this.geometry=null;}
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
}
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
// ── 逐脚本加载 ──
function load(ctx,file){ vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file}); }
function boot(campIdx){
const byIdx={};for(const k in byId)delete byId[k];
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document;ctx.window=window;
ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
const files=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/23-deploy.js','js/24-main.js'];
for(const f of files) load(ctx,f);
return ctx;
}
// ─────────────────────────────────────────────
// dev/probe-factory.js —— 厂房坦克产能 + 部署上车机制探针 (斯大林格勒 2026-09-06 点位改版, 不进 Index.html)
// 用法: node dev/probe-factory.js
// 原理: 复用 probe-match 的桩与全脚本引导, 开局后直接操纵旗权/击杀坦克, 推演重生周期。
// 断言: ①tankRespawnMul: 苏军持厂房=1.8 / 德军持=1 / 中立=1;
//       ②苏军持厂房战损坦克重生耗时≈respawnT/1.8, 落点按重生瞬间实际旗权自洽校验;
//       ③respawn() 落点单元测试: 沦陷→主基地 / 复克→厂区停车场 (直接调用, 不受 Bot 夺旗干扰);
//       ④德军即使持有厂房, 其坦克照旧主基地出生 (纯苏军机制);
//       ⑤开局首生成不走厂区分支 (恒主基地, initial 语义);
//       ⑥全局机制: Bot 部署/重生时直接部署进同队闲置坦克 (2026-09-06 用户指定)。
// ─────────────────────────────────────────────
const STEP_FN=`(()=>{
const DTS=[1/60,1/30,1/20];
return function step(frames){
for(let f=0;f<frames;f++){
const dt=DTS[f%3];
nowT+=dt;
gunEvents=gunEvents.filter(e=>nowT-e.t<0.6);
NAV.budget=2;
updateNavDirty(dt);
updateSmokes(dt);
for(const s of soldiers){
s.tickAcc+=dt; s.tickSkip--;
if(!s.alive||s.onVehicle||s.tickSkip<=0){
const useDt=Math.min(s.tickAcc,0.15);
s.update(useDt);
s.tickAcc=0;
const d2p=s.pos.distanceTo(camera.position);
s.tickSkip=d2p>110?3:d2p>60?2:1;
}
}
for(const t of tanks) t.update(dt);
updateShells(dt);
updateNades(dt);
updateFlags(dt);
}
return nowT;
};
})()`;
function bootStalingrad(){
const byIdx={};for(const k in byId)delete byId[k];
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document;ctx.window=window;
ctx.localStorage={_s:{sf_campaign:'1'},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
const files=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/23-deploy.js','js/24-main.js'];
for(const f of files) load(ctx,f);
return ctx;
}
const errs=[];
function assert(name,cond,detail){ console.log((cond?'  ✓ ':'  ✗ ')+name+(detail!==undefined?' ['+detail+']':'')); if(!cond) errs.push(name); }
// ── 开局 ──
const ctx=bootStalingrad();
const initErr=vm.runInContext(`
var __e=null;
try{
const btn=document.getElementById('startBtn');
if(btn&&btn.onclick) btn.onclick(); else __e='no startBtn onclick';
}catch(e){ __e=String(e&&e.stack||e); }
__e;
`,ctx);
if(initErr!==null){ console.log('开局失败: '+initErr); process.exit(1); }
ctx.__step=vm.runInContext(STEP_FN,ctx);
const step=(n)=>vm.runInContext('__step('+n+')',ctx);
vm.runInContext(`
var __T={
sovBase:CAMPAIGN.bases[0], gerBase:CAMPAIGN.bases[1],
ff:FLAGS.find(f=>f.id===FACTORY_FLAG_ID), spawn:FACTORY_SPAWN,
yard:{x0:-19,z0:-125,x1:63,z1:-55}, park:{x0:-18,z0:-118,x1:8,z1:-62}
};
`,ctx);

// ═══ 断言⑤ 开局首生成恒主基地 (厂房开局已归苏军, 但 initial 分支不进厂) ═══
console.log('⑤ 开局首生成 (厂房已归苏军):');
const sovBase=vm.runInContext('CAMPAIGN.bases[0]',ctx);
const sovTank0=vm.runInContext('tanks.filter(t=>t.team===0)',ctx);
let maxD=0,inYard0=false;
for(const t of sovTank0){
maxD=Math.max(maxD,Math.hypot(t.pos.x-sovBase.x,t.pos.z-sovBase.z));
if(t.pos.x>=-19&&t.pos.x<=63&&t.pos.z>=-125&&t.pos.z<=-55) inYard0=true;
}
// 角基地坦克纵队按 colSide*10-rowN*16 展开 (引擎既有口径, 角基最长臂≈45m); 语义关键=不进厂区矩形
assert('苏军开局坦克全部位于主基地 50m 内且无一进入厂区矩形',maxD<50&&!inYard0,'maxD='+maxD.toFixed(1));

// ═══ 断言① 倍速读数 ═══
console.log('① tankRespawnMul 读数:');
assert('苏军持厂房 → mul(0)=1.8',vm.runInContext('tankRespawnMul(0)',ctx)===1.8);
assert('同状态 mul(1)=1 (德军无加成)',vm.runInContext('tankRespawnMul(1)',ctx)===1);
vm.runInContext('__T.ff.owner=1',ctx);
assert('厂房归德 → mul(0)=1 (加成丢失)',vm.runInContext('tankRespawnMul(0)',ctx)===1);
vm.runInContext('__T.ff.owner=-1',ctx);
assert('厂房中立 → mul(0)=1',vm.runInContext('tankRespawnMul(0)',ctx)===1);
vm.runInContext('__T.ff.owner=0',ctx);

// ═══ 断言② 苏军战损坦克: 厂房在手→厂区出生+倍速 (模拟计时; 落点按重生瞬间实际旗权自洽校验) ═══
console.log('② 苏军持厂房战损重生:');
{
// 击毁一辆苏军坦克, 推演至重生; 期间旗权可能被 Bot 翻回 (属正常对局), 落点/耗时按当时旗权断言
const info=vm.runInContext(`(function(){
const t=tanks.filter(x=>x.team===0&&x.alive)[0];
if(!t) return {fail:'no alive sov tank'};
t.die(null);
return {ok:true,t0:nowT,r0:t.respawnT};
})()`,ctx);
if(info.fail){ assert('  '+info.fail,false); }
else{
let done=null;
for(let i=0;i<60*60;i++){ step(30);
const st=vm.runInContext(`(function(){ const t=tanks.filter(x=>x.team===0)[0]; return {alive:t.alive,x:t.pos.x,z:t.pos.z,ff:__T.ff.owner,mul:tankRespawnMul(0)}; })()`,ctx);
if(st.alive){ done=st; break; }
}
if(!done){ assert('  60s 内未重生',false); }
else{
const dur=vm.runInContext(`nowT-(${info.t0})`,ctx);
const expLo=info.r0/done.mul*0.85, expHi=info.r0/done.mul*1.15;
assert('  重生耗时≈'+(info.r0/done.mul).toFixed(0)+'s (r0='+info.r0.toFixed(1)+', 当时倍速='+done.mul+')',dur>=expLo&&dur<=expHi,'实际 '+dur.toFixed(1)+'s');
const inPark=vm.runInContext(`(${done.x})>=__T.park.x0&&(${done.x})<=__T.park.x1&&(${done.z})>=__T.park.z0&&(${done.z})<=__T.park.z1`,ctx);
const dSovBase=vm.runInContext(`Math.hypot((${done.x})-__T.sovBase.x,(${done.z})-__T.sovBase.z)`,ctx);
if(done.ff===0) assert('  旗权=苏 → 出生厂区停车场',inPark,'pos('+done.x.toFixed(1)+','+done.z.toFixed(1)+') 距主基 '+dSovBase.toFixed(0)+'m');
else assert('  旗权已易手 → 出生主基地',dSovBase<45,'pos('+done.x.toFixed(1)+','+done.z.toFixed(1)+') 距主基 '+dSovBase.toFixed(0)+'m (Bot 夺回旗权属正常对局)');
}
}
}
// ═══ 断言③ respawn() 落点单元测试 (直接调用, 不受 Bot 夺旗干扰): 沦陷→主基地 / 复克→厂区 ═══
console.log('③ respawn() 落点单元测试:');
{
vm.runInContext('__T.ff.owner=1',ctx);
let p=vm.runInContext(`(function(){ const t=tanks.filter(x=>x.team===0)[0]; t.alive=false; t.respawn(true); return {x:t.pos.x,z:t.pos.z}; })()`,ctx);
let d=vm.runInContext(`Math.hypot((${p.x})-__T.sovBase.x,(${p.z})-__T.sovBase.z)`,ctx);
let inPark=vm.runInContext(`(${p.x})>=__T.park.x0&&(${p.x})<=__T.park.x1&&(${p.z})>=__T.park.z0&&(${p.z})<=__T.park.z1`,ctx);
assert('  厂房沦陷: respawn() 落点=主基地 (非厂区)',!inPark&&d<45,'pos('+p.x.toFixed(1)+','+p.z.toFixed(1)+') 距主基 '+d.toFixed(0)+'m');
vm.runInContext('__T.ff.owner=0',ctx);
p=vm.runInContext(`(function(){ const t=tanks.filter(x=>x.team===0)[0]; t.respawn(true); return {x:t.pos.x,z:t.pos.z}; })()`,ctx);
inPark=vm.runInContext(`(${p.x})>=__T.park.x0&&(${p.x})<=__T.park.x1&&(${p.z})>=__T.park.z0&&(${p.z})<=__T.park.z1`,ctx);
assert('  厂房复克: respawn() 落点=厂区停车场',inPark,'pos('+p.x.toFixed(1)+','+p.z.toFixed(1)+')');
}
// ═══ 断言④ 德军坦克恒主基地 (苏军持厂房与否均不加成) ═══
console.log('④ 德军坦克恒主基地:');
{
const info=vm.runInContext(`(function(){
const t=tanks.filter(x=>x.team===1&&x.alive)[0];
if(!t) return {fail:'no alive ger tank'};
t.die(null);
return {ok:true,r0:t.respawnT};
})()`,ctx);
if(info.fail){ assert('  '+info.fail,false); }
else{
let done=null;
for(let i=0;i<60*40;i++){ step(30);
const st=vm.runInContext(`(function(){ const t=tanks.filter(x=>x.team===1)[0]; return {alive:t.alive,x:t.pos.x,z:t.pos.z}; })()`,ctx);
if(st.alive){ done=st; break; } }
const dGerBase=vm.runInContext(`Math.hypot((${done.x})-__T.gerBase.x,(${done.z})-__T.gerBase.z)`,ctx);
assert('  德军坦克重生在德军主基地 (mul 恒 1, 无厂区出生)',dGerBase<45,'pos('+done.x.toFixed(1)+','+done.z.toFixed(1)+') 距德基 '+dGerBase.toFixed(0)+'m');
}
}
// ═══ 断言⑥ 全局机制: Bot 部署/重生时优先部署进闲置坦克 (2026-09-06 用户指定) ═══
console.log('⑥ Bot 部署上车机制:');
{
// 制造一辆闲置苏军坦克 (清空乘员与禁入冷却), 再让一名苏军步兵 Bot 重生 → 应直接部署上车
const st=vm.runInContext(`(function(){
const v=tanks.filter(x=>x.team===0&&x.alive)[0];
v.crewBot=null; v.claimBot=null; v.playerDriven=false; v.noEnterT=0;
const b=soldiers.filter(x=>x.team===0&&x.alive&&!x.onVehicle&&!x.inSquad&&!x.pilotOf)[0];
if(!b) return {fail:'no foot sov bot'};
b.spawn();
return {inVeh:!!b.onVehicle, veh:v, bot:b};
})()`,ctx);
if(st.fail){ assert('  '+st.fail,false); }
else{
const tgt=st.bot.onVehicle;
assert('  Bot 重生后直接部署进同队闲置坦克 (最近优先)',st.inVeh&&tgt&&tgt.kind==='tank'&&tgt.team===0&&!tgt.playerDriven,'部署目标='+(tgt?tgt.name:'无'));
}
}
// ── 结果 ──
console.log(errs.length? 'FACTORY PROBE FAILED: '+errs.length+' 项 → '+errs.join(' / ') : '厂房机制探针全过 ✓');
process.exit(errs.length?1:0);
