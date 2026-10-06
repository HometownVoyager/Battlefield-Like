// ─────────────────────────────────────────────
// dev/verify-wipe.js —— 清场胜利规则沙箱 (不进 Index.html)
// 用法: node dev/verify-wipe.js
// 原理: 复用 probe-match 的桩 (THREE/DOM/WebAudio), 加载全部真实脚本并进入战场 (淞沪/征服),
//       直接驱动 updateFlags / 击杀 / 载具摧毁 / 重生判定, 断言 2026-09-04 清场规则:
//   T1 兵力归零 → 不立即判负, 封重生(Bot/坦克/玩家), 场上残兵清空才判对方胜 (2026-09-05: 坦克不再计入);
//   T2 攻防/征服 任一方占满全部旗点 → 敌方兵力立即归零进入清场 (旧版只认攻方, 淞沪防守方占满无反应);
//   T3 双方同时归零 → 先被清空者负/同帧清空=平局 (平局终局须能正常结算——哨兵修复);
//   T4 清场期间超时 → 照常按票数结算 (票多者胜);
//   T5 己方兵力归零 → 玩家不可再部署;
//   T6 兵力归零方飞机不重生 (对侧可重生);
//   T7 在机飞行员豁免清场/跳伞飞行员计为清场目标;
//   T8 全旗+清场双条件: 票归零+清空但未占满全旗 → 不判胜, 占满后判胜;
//   T9 最后一人 30 秒清场倒计时: 2人不启动/1人+对方占满全旗才启动(2026-09-05 门槛, 旗被翻回复位)/到期仍存活直接判负;
//   T10 倒计时兜底不等待残留坦克 (30 秒到期照常结算);
//   T13 坦克不计入胜利条件: 残兵清空即判胜, 敌方坦克仍存活不阻塞清场 (2026-09-05);
//   T11 坦克越野跨越: 矮盒/油桶可跨不阻挡+底盘爬升+悬挂俯仰弹起, 1.6m 高墙仍阻挡;
//   T12 击杀来源标签: 播报/玩家死亡显示载具/火力点名, 乘员身份反推载具名;
//   T14 击杀记分单源: 玩家杀普通Bot=100/爆头=125 (onPlayerKill 唯一入口), Bot杀Bot=100 (2026-09-06 P0-1)。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
// ── 通用小桩 (与 probe-match.js 同源) ──
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
const _mat=cls=>{ return class extends cls{constructor(o){super();Object.assign(this,o||{});this.color=_wrapColor(this.color);}dispose(){}}; };
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
function load(ctx,file){ vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file}); }
function boot(campIdx){
for(const k in byId)delete byId[k];
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document;ctx.window=window;
ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
const files=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15g-capmodels.js','js/15h-capital.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/23-deploy.js','js/24-main.js'];
for(const f of files) load(ctx,f);
return ctx;
}
// ── 断言收集 ──
const PASS=[];let FAILS=0;
function ok(cond,label){
if(cond){ PASS.push(label); console.log('  ✔ '+label); }
else { FAILS++; console.log('  ✘ '+label); }
}
// Hook: 记录 requestEnd/endMatch 与 addKillMsg (返回 vm 片段, 在 vm 里执行)
const HOOK=`
var __m={winner:null,reason:null,msgs:[]};
var _em=endMatch;
endMatch=function(w){ __m.winner=w; __m.tEnd=nowT; try{_em(w);}catch(e){} };
var _re=requestEnd;
requestEnd=function(w){ if(!__m.reason) __m.reason={w:w,tk0:tickets[0],tk1:tickets[1],t:nowT}; _re(w); };
var _akm=addKillMsg;
addKillMsg=function(txt,team){ __m.msgs.push(String(txt)); _akm(txt,team); };
player.alive=false; player.deployed=false; // 探针: 玩家不参与清场判定
`;

// T1: 兵力归零 → 不清场不判负; 封重生; 清场(残兵清空)后判对方胜 (淞沪)
function t1(){
console.log('T1 兵力归零→清场判定→胜方 (淞沪 攻防)');
const ctx=boot(3);
const err=vm.runInContext(`${HOOK}
(()=>{
try{
document.getElementById('startBtn').onclick();
__m.t0=nowT;
}catch(e){ return String(e&&e.stack||e); }
return null;
})()`,ctx);
if(err){ ok(false,'T1 开局 '+(err||'')); return; }
const r=vm.runInContext(`(()=>{
var alive0=[],tk0=[];
for(const s of soldiers) if(s.alive&&s.team===0) alive0.push(s);
for(const t of tanks) if(t.alive&&t.team===0) tk0.push(t);
return {n:alive0.length,nt:tk0.length};
})()`,ctx);
ok(r.n>0&&r.nt>0,'T1 前置: 淞沪队0有存活单位('+r.n+'人/'+r.nt+'坦克)');
const w1=vm.runInContext(`(()=>{
try{
tickets[0]=0;
updateFlags(0.05);
var v1={pending:matchEndPending,over:matchOver,w0:wipeAnnounced[0],
msg:__m.msgs.some(m=>m.indexOf('兵力耗尽')>=0)};
var victim=null;
for(const s of soldiers) if(s.alive&&s.team===0){ victim=s; break; }
victim.die(null,false); victim.respawnT=0; victim.update(0.05);
var v2=!victim.alive;
var vtk=null;
for(const t of tanks) if(t.alive&&t.team===0){ vtk=t; break; }
vtk.alive=false; vtk.respawnT=0; vtk.update(0.05);
var v3=!vtk.alive;
// 对侧(队1)仍可重生: 摧毁一辆队1坦克再等重生
var ok1tk=null;
for(const t of tanks) if(t.alive&&t.team===1){ ok1tk=t; break; }
ok1tk.die(null); ok1tk.respawnT=0; ok1tk.update(0.05);
var v4=ok1tk.alive;
return [v1,v2,v3,v4];
}catch(e){ return 'EXC:'+(e&&e.stack||e); }
})()`,ctx);
if(typeof w1==='string'){ ok(false,'T1 推演异常 '+w1); return; }
ok(w1[0].pending===null&&!w1[0].over,'T1 兵力归零后不立即判负');
ok(w1[0].w0===true,'T1 清场播报已触发');
ok(w1[0].msg===true,'T1 播报文本含"兵力耗尽"');
ok(w1[1]===true,'T1 归零方 Bot 不重生');
ok(w1[2]===true,'T1 归零方坦克不重生');
ok(w1[3]===true,'T1 有票方坦克仍可重生');
vm.runInContext(`(()=>{
// 2026-09-04 全旗条件: 胜方须占满全部旗点 (此处置队1全占, 即"先占满再清场"的正常流程)
FLAGS.forEach(f=>{ f.owner=1; f.cap=0; f.capTeam=-1; });
for(const s of soldiers) if(s.alive&&s.team===0) s.die(null,false);
for(const t of tanks) if(t.alive&&t.team===0) t.die(null);
updateFlags(0.05);
__m.pending1=matchEndPending;
for(let i=0;i<40&&!matchOver;i++) updateFlags(0.05);
})()`,ctx);
const r2b=vm.runInContext(`({p:__m.pending1,over:matchOver,w:__m.winner,rc:__m.reason})`,ctx);
ok(r2b.p===1,'T1 清场完成 → 请求对方(队1)胜');
ok(r2b.over===true&&r2b.w===1,'T1 终局结算: 胜方=1');
}

// T2: 任一方占满全部旗点 → 敌方兵力立即归零并进入清场 (淞沪=攻防; 用征服再验一次)
function t2(){
console.log('T2 占满全旗→敌方归零+不立即判负 (淞沪 攻防, 防守方也生效)');
const ctx=boot(3);
const err=vm.runInContext(`${HOOK}
(()=>{
try{
document.getElementById('startBtn').onclick();
}catch(e){ return String(e&&e.stack||e); }
return null;
})()`,ctx);
if(err){ ok(false,'T2 开局 '+(err||'')); return; }
const r=vm.runInContext(`(()=>{
var ret={};
// 静态摆盘: 队0(防守方)全单位移回西基地, 队1(进攻方)4人在 S 点内
// 2026-09-12: 淞沪改五旗环形后无 D 点, 用南圩 S 作待夺旗
const D=FLAGS.find(f=>f.id==='S')||FLAGS[FLAGS.length-1];
for(const s of soldiers){
if(!s.alive) continue;
if(s.team===0){ s.pos.set(-142,0,0); s.onVehicle=null; }
}
for(const t of tanks){
if(t.alive&&t.team===0) t.pos.set(-142,0,0);
if(t.alive&&t.team===1) t.pos.set(142,0,0);
}
// 收集4名进攻步兵放入D圈
let nIn=0;
for(const s of soldiers){
if(nIn>=4) break;
if(s.alive&&s.team===1&&!s.onVehicle){ s.pos.set(D.x,0,D.z); nIn++; }
}
// 其余旗点已归队1 (A 开局可中立/归队1; B/C/E/S 现改归队1)
FLAGS.forEach(f=>{ if(f.id!==D.id){ f.owner=1; f.cap=0; f.capTeam=-1; } });
ret.fgy=D.gy; ret.nIn=nIn; ret.D=[D.x,D.z,D.r];
ret.tk0Before=tickets[0];
return ret;
})()`,ctx);
ok(r.nIn>=4,'T2 前置: '+r.nIn+'名攻方步兵在待夺旗 (S)');
// 推进占领: 只跑 updateFlags (世界静止), 直到 D 易主
const cap=vm.runInContext(`(()=>{
for(let i=0;i<1200&&FLAGS.every(f=>f.owner===1)===false;i++) updateFlags(1/30);
return {every:FLAGS.every(f=>f.owner===1),own:FLAGS.map(f=>f.owner),
tk0:tickets[0],mep:matchEndPending,over:matchOver,w0:wipeAnnounced[0],
tk0Before:${r.tk0Before},
msg:(__m.msgs.length?__m.msgs[__m.msgs.length-1]:'')};
})()`,ctx);
ok(cap.every===true,'T2 队1(进攻方)占满全部旗点 ('+JSON.stringify(cap.own)+')');
ok(cap.tk0===0&&cap.tk0Before>0,'T2 占满全旗→敌方(队0)兵力自动归零 ('+cap.tk0Before+'→0)');
ok(cap.w0===true,'T2 清场播报触发');
ok(cap.mep===null&&cap.over===false,'T2 占满后不立即判负(进入清场)');
ok(cap.msg.indexOf('占领了全部旗点')>=0,'T2 播报:"占领全部旗点…兵力归零"');
// 队0仍有残部 → 清掉 → 判胜
const r2=vm.runInContext(`(()=>{
for(const s of soldiers) if(s.alive&&s.team===0) s.die(null,false);
for(const t of tanks) if(t.alive&&t.team===0) t.die(null);
updateFlags(0.05);
const p=matchEndPending;
for(let i=0;i<40&&!matchOver;i++) updateFlags(0.05);
return {p,over:matchOver,w:__m.winner};
})()`,ctx);
ok(r2.p===1&&r2.over===true&&r2.w===1,'T2 清场后判进攻方胜');
// 征服模式 (缅甸): 全占同样触发归零
console.log('T2b 征服模式 (滇缅公路) 全占→敌方归零');
const ctx2=boot(5);
const err2=vm.runInContext(`${HOOK}
(()=>{
try{
document.getElementById('startBtn').onclick();
}catch(e){ return String(e&&e.stack||e); }
return null;
})()`,ctx2);
if(err2){ ok(false,'T2b 开局 '+(err2||'')); return; }
const rb=vm.runInContext(`(()=>{
// 缅甸征服: 队1 4名步兵踩 F(东岸)点; 其余旗点全归队1; 队0全单位移回西基地
const F=FLAGS[FLAGS.length-1];
for(const s of soldiers){
if(!s.alive) continue;
if(s.team===0){ s.pos.set(-142,0,0); s.onVehicle=null; }
}
for(const t of tanks){ if(t.alive){ t.pos.set(t.team===0?-142:142,0,0); } }
let nIn=0;
for(const s of soldiers){
if(nIn>=4) break;
if(s.alive&&s.team===1&&!s.onVehicle){ s.pos.set(F.x,0,F.z); nIn++; }
}
// 其余旗点归队1; F 点保持敌方(队0)持有 → 队1踩点完成"最后一旗"占领事件 (归零只在占领完成帧触发)
FLAGS.forEach(f=>{ if(f!==F){ f.owner=1; f.cap=0; f.capTeam=-1; } });
F.owner=0; F.cap=0; F.capTeam=-1;
return {nIn,tk0:tickets[0],F:[F.x,F.z]};
})()`,ctx2);
const capb=vm.runInContext(`(()=>{
for(let i=0;i<1200&&FLAGS.every(f=>f.owner===1)===false;i++) updateFlags(1/30);
return {every:FLAGS.every(f=>f.owner===1),tk0:tickets[0],mep:matchEndPending};
})()`,ctx2);
ok(capb.every===true&&capb.tk0===0,'T2b 征服全占→敌方归零('+JSON.stringify(capb)+')');
ok(capb.mep===null,'T2b 不立即判负');
}

// T3: 双方同时归零→同帧清空=平局且能正常结算 (哨兵修复)
function t3(){
console.log('T3 双方归零互清→平局可正常结算 (淞沪)');
const ctx=boot(3);
const err=vm.runInContext(`${HOOK}
(()=>{
try{
document.getElementById('startBtn').onclick();
tickets[0]=0; tickets[1]=0;
for(const s of soldiers){ if(s.alive) s.die(null,false); }
for(const t of tanks){ if(t.alive) t.die(null); }
updateFlags(0.05);
__m.p=matchEndPending;
for(let i=0;i<40&&!matchOver;i++) updateFlags(0.05);
}catch(e){ return String(e&&e.stack||e); }
return null;
})()`,ctx);
if(err){ ok(false,'T3 '+(err||'')); return; }
const r=vm.runInContext(`({p:__m.p,over:matchOver,w:__m.winner,rc:__m.reason})`,ctx);
ok(r.p===-1,'T3 双方同帧清空→请求平局 (pending=-1)');
ok(r.over===true&&r.w===-1,'T3 平局终局正常结算 (旧版哨兵-1会死锁)');
}

// T4: 清场期间超时→照常按票数结算
function t4(){
console.log('T4 清场期间超时→按票数结算 (淞沪)');
const ctx=boot(3);
const err=vm.runInContext(`${HOOK}
(()=>{
try{
document.getElementById('startBtn').onclick();
tickets[0]=0; matchTime=1;
updateFlags(0.5);
__m.before=matchEndPending;
updateFlags(0.5);
updateFlags(0.5);
__m.after=matchEndPending;
}catch(e){ return String(e&&e.stack||e); }
return null;
})()`,ctx);
if(err){ ok(false,'T4 '+(err||'')); return; }
const r=vm.runInContext(`({b:__m.before,a:__m.after,w:__m.reason&&__m.reason.w})`,ctx);
ok(r.b===null,'T4 超时前未触发终局');
ok(r.a!==null&&r.a===1,'T4 超时→按票数判队1(非零方)胜');
}

// T5: 己方兵力归零→玩家不可再部署
function t5(){
console.log('T5 己方兵力归零→禁止部署 (淞沪)');
const ctx=boot(3);
const err=vm.runInContext(`${HOOK}
(()=>{
try{
document.getElementById('startBtn').onclick();
tickets[player.team]=0;
deployPlayer();
return {alive:player.alive,deployed:player.deployed,team:player.team};
}catch(e){ return 'ERR:'+String(e&&e.stack||e); }
})()`,ctx);
if(typeof err==='string'&&err.indexOf('ERR:')===0){ ok(false,'T5 '+(err||'')); return; }
ok(err.alive===false&&err.deployed===false,'T5 票归零后 deployPlayer 被拦截 (alive='+err.alive+', deployed='+err.deployed+')');
}

// T6: 兵力归零方战机不重生 (对侧可重生)
function t6(){
console.log('T6 归零/有票方战机重生 (淞沪)');
const ctx=boot(3);
const err=vm.runInContext(`${HOOK}
(()=>{
try{
document.getElementById('startBtn').onclick();
var pl0=null,pl1=null;
for(const p of planes){ if(p.team===0&&!pl0)pl0=p; if(p.team===1&&!pl1)pl1=p; }
// 队0兵力归零; 双方机毁人亡 (飞行员先死=计入小兵)
tickets[0]=0;
if(pl0.pilotBot&&pl0.pilotBot.alive) pl0.pilotBot.die(null,false);
if(pl1.pilotBot&&pl1.pilotBot.alive) pl1.pilotBot.die(null,false);
pl0.alive=false; pl0.respawnT=0;
pl1.alive=false; pl1.respawnT=0;
pl0.update(0.05); pl1.update(0.05);
return {a0:pl0.alive,a1:pl1.alive,tk:[tickets[0],tickets[1]],t0:pl0.team,t1:pl1.team};
}catch(e){ return 'ERR:'+String(e&&e.stack||e); }
})()`,ctx);
if(typeof err==='string'&&err.indexOf('ERR:')===0){ ok(false,'T6 '+(err||'')); return; }
ok(err.a1===true,'T6 队1(有票)战机可重生');
ok(err.a0===false,'T6 队0(归零)战机不重生');
}

// T7: 在机飞行员不计入清场目标; 跳伞/落地飞行员计入
function t7(){
console.log('T7 在机飞行员豁免清场 (淞沪)');
const ctx=boot(3);
const err=vm.runInContext(`${HOOK}
(()=>{
try{
document.getElementById('startBtn').onclick();
tickets[0]=0;
// 清光队0地面(步兵+坦克乘员)+全部坦克, 仅剩2名在机飞行员
for(const s of soldiers){ if(s.alive&&s.team===0&&!(s.onVehicle&&s.pilotOf)) s.die(null,false); }
for(const t of tanks){ if(t.alive&&t.team===0) t.die(null); }
// 2026-09-04 全旗条件: 置队1全占 (正常流程: 占满→归零→清场)
FLAGS.forEach(f=>{ f.owner=1; f.cap=0; f.capTeam=-1; });
updateFlags(0.05);
const p1=matchEndPending;
for(let i=0;i<40&&!matchOver;i++) updateFlags(0.05);
return {p1,over:matchOver,w:__m.winner,pilots:fieldCount(0)};
}catch(e){ return 'ERR:'+String(e&&e.stack||e); }
})()`,ctx);
if(typeof err==='string'&&err.indexOf('ERR:')===0){ ok(false,'T7 '+(err||'')); return; }
ok(err.p1===1&&err.over===true&&err.w===1,'T7 地面+坦克清光(仅剩在机飞行员)→判对方胜 (fieldCount='+err.pilots+')');
// 落地飞行员计入: 新开一局, 让一名飞行员"跳伞"(onVehicle=null) → 清场被阻塞
const ctx2=boot(3);
const err2=vm.runInContext(`${HOOK}
(()=>{
try{
document.getElementById('startBtn').onclick();
tickets[0]=0;
var pilot=null;
for(const s of soldiers) if(s.alive&&s.team===0&&s.pilotOf){ pilot=s; break; }
pilot.onVehicle=null; pilot.chuting=true; // 跳伞: 脱离了飞机, 变成地面目标
for(const s of soldiers){ if(s.alive&&s.team===0&&s!==pilot&&!(s.onVehicle&&s.pilotOf)) s.die(null,false); }
for(const t of tanks){ if(t.alive&&t.team===0) t.die(null); }
// 2026-09-04 全旗条件: 置队1全占
FLAGS.forEach(f=>{ f.owner=1; f.cap=0; f.capTeam=-1; });
updateFlags(0.05);
const p1=matchEndPending; // 应为 null: 跳伞飞行员阻挡清场
pilot.die(null,false);    // 落地击杀 → 清场完成
updateFlags(0.05);
const p2=matchEndPending;
return {p1,p2};
}catch(e){ return 'ERR:'+String(e&&e.stack||e); }
})()`,ctx2);
if(typeof err2==='string'&&err2.indexOf('ERR:')===0){ ok(false,'T7b '+(err2||'')); return; }
ok(err2.p1===null,'T7b 跳伞飞行员阻挡清场(pending=null)');
ok(err2.p2===1,'T7b 击杀跳伞飞行员后清场完成(pending=1)');
}

// T8: 全旗条件 —— 兵力归零+场上清空但未占满全部旗点 → 不判胜; 占满后判胜
function t8(){
console.log('T8 全旗条件: 未占满全旗不清场判胜 (淞沪)');
const ctx=boot(3);
const err=vm.runInContext(`${HOOK}
(()=>{
try{
document.getElementById('startBtn').onclick();
tickets[0]=0;
// 旗权摆成"队1未全占": A归队1, B/C/E/S归队0 (与淞沪开局 1-4 类似)
FLAGS.forEach(f=>{ f.owner=(f.id==='A')?1:0; f.cap=0; f.capTeam=-1; });
// 全清队0 (人+坦克), 队1活口挪到远角防止步进期间占旗
for(const s of soldiers){ if(s.alive&&s.team===0) s.die(null,false); }
for(const t of tanks){ if(t.alive&&t.team===0) t.die(null); }
for(const s of soldiers){ if(s.alive) s.pos.set(-140,0,-140); }
updateFlags(0.05);
const p1=matchEndPending; // 应为 null: 未占满全旗
const w1=wipeT[0];        // 场上0人 → 不进倒计时
// 队1占满
FLAGS.forEach(f=>{ f.owner=1; f.cap=0; f.capTeam=-1; });
updateFlags(0.05);
const p2=matchEndPending;
for(let i=0;i<40&&!matchOver;i++) updateFlags(0.05);
return {p1,p2,over:matchOver,w:__m.winner,w1,fl:flagsLostOf(1)};
}catch(e){ return 'ERR:'+String(e&&e.stack||e); }
})()`,ctx);
if(typeof err==='string'&&err.indexOf('ERR:')===0){ ok(false,'T8 '+(err||'')); return; }
ok(err.p1===null,'T8 票归零+清空但未占满全旗 → 不判胜 (pending=null)');
ok(err.w1===null,'T8 场上0人时不进倒计时 (wipeT=null)');
ok(err.p2===1&&err.over===true&&err.w===1,'T8 占满全部旗点后 → 判队1胜');
}

// T9: 最后一人 30 秒清场倒计时 —— 仅剩1人 且 对方已占满全旗才启动 (2026-09-05 门槛); 到期仍存活直接判负
function t9(){
console.log('T9 最后一人30秒清场倒计时+全旗门槛 (淞沪)');
const ctx=boot(3);
const err=vm.runInContext(`${HOOK}
(()=>{
try{
document.getElementById('startBtn').onclick();
tickets[0]=0;
// 保留2名队0地面兵, 其余全清; 队0坦克全清; 队1活口挪远角
var keep=[];
for(const s of soldiers){ if(s.alive&&s.team===0&&!s.onVehicle&&keep.length<2){ keep.push(s); s.pos.set(-140,0,-140); } else if(s.alive&&s.team===0){ s.die(null,false); } }
for(const t of tanks){ if(t.alive&&t.team===0) t.die(null); }
for(const s of soldiers){ if(s.alive&&s.team===1) s.pos.set(-140,0,-140); }
// 旗权不作全占: 2026-09-05 门槛 —— 未占满全旗时倒计时不启动
updateFlags(0.05);
const w2=wipeT[0];        // 2人 → 不进倒计时
const p2=matchEndPending; // 场上2人 → 不清场
keep[0].die(null,false);  // 死1人 → 场上仅剩最后1人
updateFlags(0.05);
const wGate=wipeT[0];     // 旗权未全占 → 倒计时不启动 (门槛)
const pGate=matchEndPending;
// 快进 5 秒确认旗权未全占时倒计时始终不启动
for(let i=0;i<100&&!matchOver;i++) updateFlags(0.05);
const wGateLate=wipeT[0], overGate=matchOver;
// 占满全旗 → 门槛满足, 倒计时启动 (=30s 起算)
FLAGS.forEach(f=>{ f.owner=1; f.cap=0; f.capTeam=-1; });
updateFlags(0.05);
const w1=wipeT[0];
const p1=matchEndPending;
const started=(__m.msgs||[]).some(m=>m.indexOf('清场倒计时')>=0);
// 翻回一面旗 → 门槛失效, 倒计时复位
FLAGS[0].owner=0; FLAGS[0].cap=0; FLAGS[0].capTeam=0;
updateFlags(0.05);
const wReset=wipeT[0];
// 重新占满 → 倒计时从 30s 重来
FLAGS[0].owner=1;
updateFlags(0.05);
const wRestart=wipeT[0];
// 快进 35 秒 (不被击杀, 一直躲着; 30s 倒计时 + 1.5s 终局前奏)
for(let i=0;i<700&&!matchOver;i++) updateFlags(0.05);
return {w2,p2,wGate,pGate,wGateLate,overGate,w1,p1,started,wReset,wRestart,
over:matchOver,w:__m.winner,lastAlive:keep[1].alive,msgs:(__m.msgs||[]).slice(-2)};
}catch(e){ return 'ERR:'+String(e&&e.stack||e); }
})()`,ctx);
if(typeof err==='string'&&err.indexOf('ERR:')===0){ ok(false,'T9 '+(err||'')); return; }
ok(err.w2===null,'T9 场上2人 → 不进倒计时 (wipeT=null)');
ok(err.p2===null,'T9 场上2人 → 不判胜');
ok(err.wGate===null&&err.wGateLate===null&&err.overGate===false,'T9 全旗门槛: 旗权未占满 → 最后1人也不启动倒计时 (2026-09-05)');
ok(err.pGate===null,'T9 门槛未满足期间不判胜');
ok(err.w1>29&&err.w1<=30,'T9 占满全旗后 → 倒计时启动 (=30s 起算, 实测 '+err.w1+')');
ok(err.p1===null,'T9 倒计时期间未判胜');
ok(err.started===true,'T9 倒计时启动播报已发出');
ok(err.wReset===null,'T9 倒计时期间旗被翻回 → 倒计时复位');
ok(err.wRestart>29&&err.wRestart<=30,'T9 旗权重新占满 → 倒计时从30s重来 (实测 '+err.wRestart+')');
ok(err.over===true&&err.w===1,'T9 倒计时30秒到期 → 直接判队1胜 (最后1人仍存活)');
ok(err.lastAlive===true,'T9 到期时那1人还活着 (正是兜底场景)');
}

// T10: 倒计时不等待坦克 —— 最后1人+敌方坦克仍在也照样30秒兜底结算
function t10(){
console.log('T10 倒计时无视残留坦克兜底结算 (淞沪)');
const ctx=boot(3);
const err=vm.runInContext(`${HOOK}
(()=>{
try{
document.getElementById('startBtn').onclick();
tickets[0]=0;
var last=null;
for(const s of soldiers){ if(s.alive&&s.team===0&&!s.onVehicle&&!last){ last=s; s.pos.set(-140,0,-140); } else if(s.alive&&s.team===0){ s.die(null,false); } }
var tk=null;
for(const t of tanks){ if(t.alive&&t.team===0&&!tk){ tk=t; } else if(t.alive&&t.team===0){ t.die(null); } }
// 残留坦克的乘员也是"场上一人": 倒计时场景只剩最后1名地面兵, 乘员一并清除 (坦克本身保留)
if(tk.crewBot&&tk.crewBot.alive) tk.crewBot.die(null,false);
for(const s of soldiers){ if(s.alive&&s.team===1) s.pos.set(-140,0,-140); }
// 2026-09-05 全旗门槛: 置队1全占 (倒计时须对方占满全旗才启动)
FLAGS.forEach(f=>{ f.owner=1; f.cap=0; f.capTeam=-1; });
updateFlags(0.05);
const w1=wipeT[0];
for(let i=0;i<700&&!matchOver;i++) updateFlags(0.05);
return {w1,over:matchOver,w:__m.winner,tankAlive:tk.alive,lastAlive:last.alive};
}catch(e){ return 'ERR:'+String(e&&e.stack||e); }
})()`,ctx);
if(typeof err==='string'&&err.indexOf('ERR:')===0){ ok(false,'T10 '+(err||'')); return; }
ok(err.w1>29&&err.w1<=30,'T10 最后1人在场(含1辆残留坦克) → 倒计时启动 (实测 '+err.w1+')');
ok(err.over===true&&err.w===1,'T10 倒计时到期直接结算, 判队1胜');
ok(err.tankAlive===true,'T10 结算时该坦克仍存活 (倒计时兜底不等待坦克)');
}

// T13: 坦克不计入胜利条件 —— 残兵清空即判胜, 敌方坦克仍存活也不阻塞清场 (2026-09-05 用户指定)
function t13(){
console.log('T13 坦克存活不阻塞清场 (淞沪)');
const ctx=boot(3);
const err=vm.runInContext(`${HOOK}
(()=>{
try{
document.getElementById('startBtn').onclick();
tickets[0]=0;
// 置队1全占 (攻防全旗条件); 清光队0全部残兵, 但保留1辆队0坦克不摧毁
FLAGS.forEach(f=>{ f.owner=1; f.cap=0; f.capTeam=-1; });
var tk=null;
for(const t of tanks){ if(t.alive&&t.team===0&&!tk){ tk=t; } else if(t.alive&&t.team===0){ t.die(null); } }
if(tk&&tk.crewBot&&tk.crewBot.alive) tk.crewBot.die(null,false); // 空乘员坦克: 车体存活但乘员已死
for(const s of soldiers){ if(s.alive&&s.team===0&&!(tk&&tk.crewBot&&s===tk.crewBot)) s.die(null,false); }
updateFlags(0.05);
const p1=matchEndPending;
for(let i=0;i<40&&!matchOver;i++) updateFlags(0.05);
return {p1,over:matchOver,w:__m.winner,tankAlive:tk?tk.alive:null};
}catch(e){ return 'ERR:'+String(e&&e.stack||e); }
})()`,ctx);
if(typeof err==='string'&&err.indexOf('ERR:')===0){ ok(false,'T13 '+(err||'')); return; }
ok(err.p1===1&&err.over===true&&err.w===1,'T13 残兵清空后立即判队1胜 (旧版会等坦克全毁)');
ok(err.tankAlive===true,'T13 结算时敌方坦克仍存活 (不再计入胜利条件)');
}

// T11: 坦克越野跨越 —— 低矮不可摧毁的盒/柱障碍: 不阻挡(车不被推离), 底盘爬升到障碍顶; 高障碍仍阻挡
function t11(){
console.log('T11 坦克越野跨越低矮不可摧毁障碍 (淞沪)');
const ctx=boot(3);
const err=vm.runInContext(`${HOOK}
(()=>{
try{
document.getElementById('startBtn').onclick();
var t0=null; for(const t of tanks) if(t.alive){ t0=t; break; }
t0.crewBot=null; t0.vel=0; t0.isAI=true; // 静止测试: 不跑 AI, 只看碰撞放行/底盘高度
var g0=heightAt(t0.pos.x,t0.pos.z);
// 车底塞 0.9m 矮木箱(无 crush/dGroup=不可摧毁) + 1.1m 油桶圆柱
BOXES.push({minX:t0.pos.x-1.2,minY:g0,maxX:t0.pos.x+1.2,maxY:g0+0.9,minZ:t0.pos.z-1.2,maxZ:t0.pos.z+1.2,gh:g0});
CYLS.push({x:t0.pos.x,z:t0.pos.z,r:0.45,y0:g0,y1:g0+1.1});
buildSpatialIndex(); // 2026-09-06 B5: 直塞碰撞体须入 RGRID 索引 (游戏运行期同类碰撞体都走 addBoxCollider/registerDynCollider+NAV.refresh, 本行与游戏真实路径一致)
// 底盘目标高度应取较高者(圆柱顶)
var y1=tankRideH(t0.pos.x,t0.pos.z,t0.pos.y);
// 车头前方 2.4m 采样点(suspension 前采样臂)再放一块 1.2m 矮盒: 前采样顶明显高于后采样 → 俯仰弹簧前倾
const snT=Math.sin(t0.yaw), csT=Math.cos(t0.yaw);
var fx=t0.pos.x+snT*2.4, fz=t0.pos.z+csT*2.4;
BOXES.push({minX:fx-1.0,minY:g0,maxX:fx+1.0,maxY:g0+1.2,minZ:fz-1.0,maxZ:fz+1.0,gh:g0});
buildSpatialIndex();
var sf=tankSurfH(fx,fz); // 前采样点=盒顶
var px0=t0.pos.x, pz0=t0.pos.z;
for(let i=0;i<6;i++) t0.update(1/30); // 6帧: 不推离 + y 爬升 + 俯仰发生
var r={y1,g0,px0,pz0,px1:t0.pos.x,pz1:t0.pos.z,y2:t0.pos.y,alive:t0.alive,susp:t0.suspP,sf,sf2:tankSurfH(t0.pos.x,t0.pos.z)};
r.y2=+r.y2.toFixed(3); r.y1=+r.y1.toFixed(3); r.susp=+r.susp.toFixed(3);
// 对照组: 1.6m 高墙(不可摧毁但高) 仍应阻挡推离
BOXES.push({minX:t0.pos.x-1.2,minY:g0,maxX:t0.pos.x+1.2,maxY:g0+1.6,minZ:t0.pos.z-1.2,maxZ:t0.pos.z+1.2,gh:g0});
buildSpatialIndex();
var px2=t0.pos.x;
for(let i=0;i<3;i++) t0.update(1/30);
r.px2=t0.pos.x;
return r;
}catch(e){ return 'ERR:'+String(e&&e.stack||e); }
})()`,ctx);
if(typeof err==='string'&&err.indexOf('ERR:')===0){ ok(false,'T11 '+(err||'')); return; }
ok(Math.abs(err.y1-(err.g0+1.1))<0.01,'T11 可跨越底盘高度=障碍顶高(盒0.9/柱1.1取1.1): '+(err.y1-err.g0).toFixed(2)+'m');
ok(Math.hypot(err.px1-err.px0,err.pz1-err.pz0)<0.05,'T11 矮障碍不阻挡(车体未被推离, 位移='+Math.hypot(err.px1-err.px0,err.pz1-err.pz0).toFixed(3)+')');
ok(err.y2>err.g0+0.75,'T11 底盘爬升(6帧后 y-g0='+(err.y2-err.g0).toFixed(2)+'m)');
ok(Math.abs(err.sf-(err.g0+1.2))<0.01,'T11 悬挂前采样点贴到障碍顶(前轮上坡由表面高度驱动): '+(err.sf-err.g0).toFixed(2)+'m');
ok(err.susp<-0.02,'T11 车头俯仰弹簧被推向爬坡角 (suspP='+err.susp+')');
ok(err.alive===true,'T11 跨越过程障碍未被摧毁(坦克本身存活)');
ok(Math.abs(err.px2-err.px1)>1.0,'T11 1.6m 高障碍仍会被推离阻挡 (位移='+Math.abs(err.px2-err.px1).toFixed(2)+')');
}

// T12: 击杀来源标签 —— 开火方挂载 _src → 击杀播报/玩家死亡记录带入载具/火力点名; 乘员身份反推载具名
function t12(){
console.log('T12 击杀来源标签 (淞沪)');
const ctx=boot(3);
const err=vm.runInContext(`${HOOK}
(()=>{
try{
SPAWN_PROT=0; // 探针整批豁免 (00-config 口径): 本测试在开局帧直接调 damage(), 出生保护 0.5s 会吞掉击杀链 (2026-09-29)
document.getElementById('startBtn').onclick();
var a=null,v=null;
for(const s of soldiers){ if(!s.alive) continue; if(s.team===1&&!a) a=s; if(s.team===0&&!v) v=s; }
a._src='九七式中战车'; // 模拟坦克炮手开火时挂载的来源
v.damage(200,a,false); // 击杀 → addKillfeed 播报应带 [九七式中战车]
var vDead=!v.alive;
var kf=document.getElementById('killfeed');
var kfHtml=(kf&&kf.children[0])?kf.children[0].innerHTML:'';
// 玩家死亡路径: killerSrc 记录 (部署面板会显示)
player.alive=true; player.spectator=false; player.hp=100;
a._src='MG42 通用机枪';
player.damage(999,a,false);
var pDead=!player.alive, pName=player.killerName, pSrc=player.killerSrc;
// 未挂载时按身份反推: 乘员伪对象 → 载具名; 步兵无挂载 → 当前武器名
var crew={name:'九五式轻型坦克',isCrew:true,team:1};
var srcCrew=killSrcLabel(crew);
var bot2=null;
for(const s of soldiers){ if(s.alive&&s.team===1&&s!==a){ bot2=s; break; } }
var srcWeapon=bot2&&bot2.curW&&bot2.curW.def&&bot2.curW.def.name?killSrcLabel(bot2):'';
return {vDead,kfHtml,pDead,pName,pSrc,srcCrew,srcWeapon};
}catch(e){ return 'ERR:'+String(e&&e.stack||e); }
})()`,ctx);
if(typeof err==='string'&&err.indexOf('ERR:')===0){ ok(false,'T12 '+(err||'')); return; }
ok(err.vDead===true,'T12 击杀正常结算');
ok(err.kfHtml.indexOf('九七式中战车')>=0,'T12 击杀播报显示来源标签 ['+err.kfHtml+']');
ok(err.pDead===true&&err.pSrc==='MG42 通用机枪','T12 玩家死亡记录击杀来源 (killerSrc='+err.pSrc+')');
ok(err.pName!==''&&err.srcCrew==='九五式轻型坦克','T12 乘员身份反推为载具名 (srcCrew='+err.srcCrew+')');
}

// T14: 击杀记分单源 (2026-09-06 P0-1) —— 玩家杀普通 Bot=100 / 爆头=125 (onPlayerKill 唯一入口);
// Bot 杀 Bot=100 (Bot 记分板); 双计回归: 修复前玩家实得 200/225
function t14(){
console.log('T14 击杀记分单源: 玩家100/爆头125, Bot杀Bot=100 (淞沪)');
const ctx=boot(3);
const err=vm.runInContext(`${HOOK}
(()=>{
try{
SPAWN_PROT=0; // 探针整批豁免 (00-config 口径): 同 T12 (2026-09-29)
document.getElementById('startBtn').onclick();
var v1=null,v2=null,v0=null,a=null;
for(const s of soldiers){ if(!s.alive) continue; if(s.team===1&&!v1) v1=s; else if(s.team===1&&!v2) v2=s; if(s.team===0&&!v0) v0=s; else if(s.team===0&&v0&&!a) a=s; }
// 玩家普通击杀
player.score=0;
v1.damage(999,player,false);
var sNormal=player.score;
// 玩家爆头击杀
player.score=0;
v2.damage(999,player,true);
var sHead=player.score;
// Bot 杀 Bot
a.score=0;
v0.damage(999,a,false);
var sBot=a.score, aIsPlayer=!!a.isPlayer;
return {sNormal,sHead,sBot,aIsPlayer};
}catch(e){ return 'ERR:'+String(e&&e.stack||e); }
})()`,ctx);
if(typeof err==='string'&&err.indexOf('ERR:')===0){ ok(false,'T14 '+(err||'')); return; }
ok(err.sNormal===100,'T14 玩家杀普通 Bot → score===100 (修复前双计 200, 实测 '+err.sNormal+')');
ok(err.sHead===125,'T14 玩家爆头击杀 → score===125 (修复前双计 225, 实测 '+err.sHead+')');
ok(!err.aIsPlayer&&err.sBot===100,'T14 Bot 杀 Bot → attacker.score===100 (Bot 记分板, 实测 '+err.sBot+')');
}

// T15: 连杀增益「杀敌续杯」(2026-09-16 用户定案) —— 5 秒窗口内每多一次击杀把当前档时长"续满", 次数不限;
// 踩档那杀走升级 (不重复续), 停火超窗口=断链不再续 (增益自然到期), 阵亡清零; 记分倍率不受续杯影响。
// 时间线全部走 registerKillScore 唯一入口 (与真实击杀/摧毁载具同路径), nowT 手动推进以精确控窗口。
function t15(){
console.log('T15 连杀续杯: 窗口内回满当前档 / 断链不续 / 阵亡清零 (诺曼底)');
const ctx=boot(0);
const r=vm.runInContext(`(()=>{
try{
document.getElementById('startBtn').onclick();
// 本探针只测规则, 不测播报 DOM: showKillPop 的 while(box.children.length>5) 在 DOM 桩下不会缩短 children
// (firstChild 返回的占位节点不在 children 里) —— 密集击杀会死循环, 故此处把两条播报短路 (T14 已覆盖真实播报路径)。
showKillPop=function(){}; showScorePop=function(){};
const K=SCORE_TABLE.kill, TK=SCORE_TABLE.tank;
const T=[];
const snap=(tag,got)=>{ T.push({tag, n:killStreakN,
 lv:player.streakBuff?player.streakBuff.lv:null, dur:player.streakBuff?player.streakBuff.dur:null,
 until:player.streakBuff?+player.streakBuff.until.toFixed(3):null,
 refills:killStreakRefills, got:got===undefined?null:got, now:+nowT.toFixed(3)}); };
const kill=(t,base)=>{ nowT=t; const g=registerKillScore('击杀',base===undefined?K:base); return g; };
// —— 时间线 A: 3 杀发放 → 4/5 杀续杯 → 6 杀升级 → 7/8 杀续杯 → 9 杀升级 → 10/11 杀续杯 ——
nowT=100; player.streakBuff=null; killStreakN=0; killStreakT=-99; killStreakRefills=0;
snap('1杀',kill(100)); snap('2杀',kill(101));                                      // 未达档: 无增益
snap('3杀',kill(102));                                                              // 发放 战意壹 5s
snap('4杀',kill(104)); snap('5杀',kill(105));                                        // 续杯 ×2
snap('6杀',kill(105.5));                                                            // 升级 战意贰 6s
snap('7杀',kill(106)); snap('8杀',kill(106.5));                                      // 续杯 ×2
snap('9杀',kill(107));                                                              // 升级 战意叁 7s
snap('10杀',kill(111,TK));                                                          // 关键: 9 杀之后仍续杯 (摧毁坦克同口径)
snap('11杀',kill(111.5));
// —— 时间线 B: 断链 (距上一杀 >5s) → 连杀重计、不续杯、增益时长不动 ——
const bUntilBefore=player.streakBuff.until, bRefBefore=killStreakRefills;
snap('断链后1杀',kill(120));                                                         // 120-111.5=8.5 > 5 → N 重计
const bUntilAfter=player.streakBuff.until;
// —— 时间线 C: 断链后再 3 连杀 → 重新发放 (同一条命可多次发放不同档) ——
snap('重连2杀',kill(121)); snap('重连3杀',kill(122));
// —— 时间线 D: 窗口边界 (恰好 5.0s 仍算连杀/续杯, 5.001s 不算) ——
nowT=300; killStreakN=0; killStreakT=-99; killStreakRefills=0; player.streakBuff=null;
kill(300); kill(301); kill(302);                       // 3 杀 → until=307
nowT=307; const edgeGot=registerKillScore('击杀',K); snap('边界4杀(5.000s)',edgeGot);
const edgeRef=killStreakRefills, edgeUntil=player.streakBuff.until;
nowT=312.001; registerKillScore('击杀',K); snap('边界外1杀(5.001s)');
const outRef=killStreakRefills, outUntil=player.streakBuff.until;
// —— 时间线 E: 阵亡清零 ——
const beforeReset={n:killStreakN, ref:killStreakRefills, buff:!!player.streakBuff};
resetKillStreak();
const afterReset={n:killStreakN, ref:killStreakRefills, buff:player.streakBuff};
return {T, bUntilBefore, bUntilAfter, bRefBefore, edgeRef, edgeUntil, outRef, outUntil, beforeReset, afterReset,
 maxStreak:killStreakMax, score:{
  g3:T.find(x=>x.tag==='3杀').got, g4:T.find(x=>x.tag==='4杀').got, g6:T.find(x=>x.tag==='6杀').got,
  g10:T.find(x=>x.tag==='10杀').got, gOut:T.find(x=>x.tag==='断链后1杀').got }};
}catch(e){ return 'ERR:'+String(e&&e.stack||e); }
})()`,ctx);
if(typeof r==='string'&&r.indexOf('ERR:')===0){ ok(false,'T15 '+(r||'')); return; }
const at=tag=>r.T.find(x=>x.tag===tag)||{};
// ① 未达档无增益
ok(at('1杀').lv===null&&at('2杀').lv===null&&at('1杀').refills===0,'T15 未达 3 杀不发增益也不续杯');
// ② 3 杀发放 (档位/时长/起始倍率)
ok(at('3杀').lv===0&&at('3杀').dur===5&&at('3杀').until===107,'T15 3 杀发放 战意壹 (lv0 / 5s / until=107, 实测 until='+at('3杀').until+')');
ok(r.score.g3===150,'T15 3 杀起得分吃 ×1.5 (实测 '+r.score.g3+')');
// ③ 窗口内击杀续杯: 时长回满 + 计数 +1, 档位不变, 倍率不变
ok(at('4杀').until===109&&at('4杀').lv===0,'T15 第 4 杀续杯: 剩余时长回满 5s (until 107→109, 实测 '+at('4杀').until+')');
ok(at('4杀').refills===1&&at('5杀').refills===2,'T15 每次续杯计数 +1 (4杀=1 / 5杀=2, 实测 '+at('5杀').refills+')');
ok(r.score.g4===150,'T15 续杯不改倍率 (续杯后击杀仍 ×1.5 = '+r.score.g4+')');
// ④ 踩档升级优先于续杯 (第 6 杀升级, 不额外记续杯)
ok(at('6杀').lv===1&&at('6杀').dur===6&&at('6杀').until===111.5&&at('6杀').refills===2,
 'T15 第 6 杀升级 战意贰 (lv1/6s/until=111.5) 且不记续杯 (实测 until='+at('6杀').until+' refills='+at('6杀').refills+')');
// ⑤ 9 杀之后的第 10 杀仍续杯 (改造前的洞: 过 9 杀只叠连杀, 增益到期即消失)
ok(at('10杀').lv===2&&at('10杀').until===118&&at('10杀').refills===5,
 'T15 9 杀满档后第 10 杀仍续杯 (lv2 7s → until=118, 实测 until='+at('10杀').until+' refills='+at('10杀').refills+')');
ok(r.score.g10===900,'T15 满档续杯期摧毁坦克吃 ×3 (300×3=900, 实测 '+r.score.g10+')');
ok(at('11杀').until===118.5&&at('11杀').refills===6,'T15 连续续杯次数不限 (11 杀 until=118.5 / refills=6, 实测 '+at('11杀').refills+')');
// ⑥ 断链: 连杀重计为 1、不续杯、时长不动、无倍率
ok(at('断链后1杀').n===1&&at('断链后1杀').refills===r.bRefBefore&&r.bUntilAfter===r.bUntilBefore,
 'T15 停火 >5s 断链: 连杀重计为 1、不续杯 (refills='+at('断链后1杀').refills+' 保持, until 不动)');
ok(r.score.gOut===100,'T15 断链后击杀无倍率 (基础 100, 实测 '+r.score.gOut+')');
// ⑦ 断链后再连 3 杀 → 同一条命可重新发放 (档位从头)
ok(at('重连3杀').lv===0&&at('重连3杀').dur===5,'T15 断链后重新 3 连杀 → 重新发放 战意壹 (lv0/5s)');
// ⑧ 窗口边界: 恰好 5.000s 算连杀 (续杯), 5.001s 不算
ok(at('边界4杀(5.000s)').refills===1&&at('边界4杀(5.000s)').until===312,
 'T15 窗口边界 5.000s 仍算连杀 → 续杯 (until=312, 实测 '+at('边界4杀(5.000s)').until+')');
ok(at('边界4杀(5.000s)').until===312&&at('边界外1杀(5.001s)').refills===1&&r.outUntil===312,
 'T15 5.001s 不算连杀 → 不续杯 (until 停在 312, 实测 '+r.outUntil+')');
// ⑨ 阵亡清零: 连杀/增益/续杯数一起清
ok(r.beforeReset.buff&&r.afterReset.n===0&&r.afterReset.ref===0&&r.afterReset.buff===null,
 'T15 阵亡 resetKillStreak 清空连杀计数/增益/续杯数');
ok(r.maxStreak>=11,'T15 最大连杀统计不受续杯影响 (实测 '+r.maxStreak+')');
// ⑩ HUD/样式接线 (2026-09-16 续杯脉冲): 源码级回归 —— 改显示层忘了接这根线会被抓到
const hud=fs.readFileSync(path.join(root,'js/22-hud.js'),'utf8');
const css=fs.readFileSync(path.join(root,'css/style.css'),'utf8');
const match=fs.readFileSync(path.join(root,'js/21-match.js'),'utf8');
ok(/b\.refillT=nowT/.test(match),'T15 21-match 续杯写入 buff.refillT (供 HUD 触发脉冲)');
ok(/streakBuff\.refillT/.test(hud)&&/'\s*refill'/.test(hud),'T15 22-hud 读 refillT 并在 0.45s 窗口内挂 .refill 类');
ok(/#streakBuff\.refill\s*\{/.test(css)&&/@keyframes sbRefill/.test(css),'T15 CSS 提供 #streakBuff.refill + @keyframes sbRefill 脉冲');
}

// T16: 同归零旗权豁免 (2026-10-06 用户实机反馈"双方0剩余无法结束战局") —— 双方都归零后,
//      一方残兵被清空 → 对方立即判胜, 不再要求"占满全部旗点" (旧版此处无出口=死局);
//      同帧清空=平局 (T3 既有口径不受影响)。
function t16(){
console.log('T16 同归零: 一方清空→对方立即胜, 旗权豁免 (淞沪 征服)');
const ctx=boot(3);
const err=vm.runInContext(`${HOOK}
(()=>{
try{
document.getElementById('startBtn').onclick();
tickets[0]=0; tickets[1]=0;
// 队0全清; 队1仅留1人 (挪远角), 其余全清
var keep=null;
for(const s of soldiers){ if(!s.alive) continue;
if(s.team===0) s.die(null,false);
else if(!keep){ keep=s; s.pos.set(-140,0,-140); } else s.die(null,false); }
for(const t of tanks){ if(t.alive) t.die(null); }
// 旗权保持开局混合归属 (不占满) → 证明旗权条件在同归零局被豁免
updateFlags(0.05);
return {p:matchEndPending,w:__m.reason&&__m.reason.w,keepAlive:keep&&keep.alive,f0:fieldCount(0),f1:fieldCount(1)};
}catch(e){ return 'ERR:'+String(e&&e.stack||e); }
})()`,ctx);
if(typeof err==='string'&&err.indexOf('ERR:')===0){ ok(false,'T16 '+(err||'')); return; }
ok(err.f0===0&&err.f1===1,'T16 场面: 队0清空/队1剩1人 (实测 '+err.f0+'/'+err.f1+')');
ok(err.p===1&&err.w===1,'T16 同归零+一方清空 → 对方立即判胜, 旗权未占满也放行 (旧版死局)');
}

// T17: 1v1 倒计时对齐 (2026-10-06 用户裁定) —— 同归零局双方都只剩1人时, 后启动者把双方计时
//      都重置为 30s (先剩1人的一方不再"先跑完先输"); 同归零局旗权门槛豁免 (未占满也启动)。
function t17(){
console.log('T17 1v1 倒计时对齐+同归零门槛豁免 (淞沪 征服)');
const ctx=boot(3);
const err=vm.runInContext(`${HOOK}
(()=>{
try{
document.getElementById('startBtn').onclick();
tickets[0]=0; tickets[1]=0;
// 队0留1人, 队1留2人 (挪远角), 其余全清; 旗权不占满 → 靠同归零豁免启动
var keep0=null,k1a=null,k1b=null;
for(const s of soldiers){ if(!s.alive) continue;
if(s.team===0){ if(!keep0){ keep0=s; s.pos.set(-140,0,-140); } else s.die(null,false); }
else { if(!k1a){ k1a=s; s.pos.set(140,0,140); } else if(!k1b){ k1b=s; s.pos.set(140,0,140); } else s.die(null,false); } }
for(const t of tanks){ if(t.alive) t.die(null); }
updateFlags(0.05);
const wA=wipeT[0];                       // 队0仅1人 → 倒计时启动 (旗权未占满, 靠豁免)
for(let i=0;i<40&&!matchOver;i++) updateFlags(0.05);   // 快进2秒, 队0计时已跑掉一截
const wRun=wipeT[0];
k1b.die(null,false);                     // 队1也只剩1人 → 队1倒计时启动 + 双方对齐回30
updateFlags(0.05);
const w0=wipeT[0], w1=wipeT[1];
const aligned=(__m.msgs||[]).some(m=>m.indexOf('对齐')>=0);
return {wA,wRun,w0,w1,aligned,f1:fieldCount(1)};
}catch(e){ return 'ERR:'+String(e&&e.stack||e); }
})()`,ctx);
if(typeof err==='string'&&err.indexOf('ERR:')===0){ ok(false,'T17 '+(err||'')); return; }
ok(err.wA>29&&err.wA<=30,'T17 同归零+队0仅1人 → 倒计时启动, 旗权未占满被豁免 (实测 '+err.wA+')');
ok(err.wRun<29.7,'T17 队0倒计时先跑 (2秒后剩 '+err.wRun.toFixed(2)+'s)');
ok(err.f1===1,'T17 队1清到仅剩1人');
ok(err.w0>29&&err.w1>29,'T17 队1进倒数时双方都被重置回30s (实测 '+err.w0.toFixed(2)+'/'+err.w1.toFixed(2)+') — 先剩1人的一方不再吃亏');
ok(err.aligned,'T17 对齐播报已发出');
}

// T18: 对齐后双双到点=平局 —— 1v1 各自倒计时同步走完 30 秒, 双方最后1人均存活 → 平局结算。
function t18(){
console.log('T18 1v1 双双到点→平局 (淞沪 征服)');
const ctx=boot(3);
const err=vm.runInContext(`${HOOK}
(()=>{
try{
document.getElementById('startBtn').onclick();
tickets[0]=0; tickets[1]=0;
var keep0=null,k1=null;
for(const s of soldiers){ if(!s.alive) continue;
if(s.team===0){ if(!keep0){ keep0=s; s.pos.set(-140,0,-140); } else s.die(null,false); }
else { if(!k1){ k1=s; s.pos.set(140,0,140); } else s.die(null,false); } }
for(const t of tanks){ if(t.alive) t.die(null); }
// 快进 35 秒 (30s 倒计时 + 1.5s 终局前奏), 双方都躲着不动
for(let i=0;i<700&&!matchOver;i++) updateFlags(0.05);
return {over:matchOver,w:__m.winner,a0:keep0.alive,a1:k1.alive,
draw:(__m.msgs||[]).some(m=>m.indexOf('同时到点')>=0)};
}catch(e){ return 'ERR:'+String(e&&e.stack||e); }
})()`,ctx);
if(typeof err==='string'&&err.indexOf('ERR:')===0){ ok(false,'T18 '+(err||'')); return; }
ok(err.over===true&&err.w===-1,'T18 双方最后1人均存活到期 → 平局结算 (winner=-1)');
ok(err.a0===true&&err.a1===true,'T18 结算时双方最后1人均还活着 (正是对齐兜底场景)');
ok(err.draw===true,'T18 同帧到点播报已发出');
}

// ── 入口 ──
console.log('== 清场胜利规则沙箱 ==');
t1(); t2(); t3(); t4(); t5(); t6(); t7(); t8(); t9(); t10(); t11(); t12(); t13(); t14(); t15(); t16(); t17(); t18();
console.log(`== 结果: ${PASS.length} 通过 / ${FAILS} 失败 ==`);
process.exit(FAILS?1:0);
