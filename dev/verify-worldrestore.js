// ─────────────────────────────────────────────
// dev/verify-worldrestore.js —— 世界还原 (开局快照 / 就地复原) 沙箱 (2026-09-17 世界还原批)
// 用法: node dev/verify-worldrestore.js
// 原理: 复用 verify-returntomenu 的桩 (THREE/DOM/WebAudio) 按真实顺序加载 js/00~24 + 23b,
//       然后按真实破坏入口把世界打烂 (炸塌建筑/碾毁树篱/放倒烧毁树木/烧掉燃料/添弹坑/建工事/
//       撒粒子与布娃娃/落碎块/加在途弹), 再走真实还原入口, 逐项断言"是否回到开局快照"。
// 断言覆盖:
//   T1  启动末尾拍快照: ready 且各项非空 (world/scene/碰撞盒/植被/实例批/旗面)
//   T2  重复拍快照不覆盖 (已被打烂的世界不会被当成基线) —— 阴性对照的基石
//   T3  ★破坏确实发生 (敏感度对照): 台账/碰撞盒/植被/燃料/占位/特效全部偏离基线 ——
//       若还原是空操作, T4~T6 必然失败
//   T4  ★还原: 上述每一项逐项回到基线 (含 OCC 占用网格校验和)
//   T5  ★视觉复位: 被摧毁结构的网格回到 world、未毁结构不再有"网格掉出场景"、实例矩阵逐元素相等
//   T6  ★场景无残留: 单位/布娃娃/碎块/粒子/烟/弹壳/在途弹清零, scene 台账项数与基线一致
//   T7  台账边界不变量: 还原后 world.children.length === __sfMatchWorldStart (retireMatchActors 仍成立)
//   T8  幂等: 连做两次还原, 指标不再变化
//   T9  ★结算后回主菜单 = 干净地图 (用户实报路径): 打烂 → endMatch(结算) → returnToMenu()
//   T10 冻结战局不还原 (阴性对照): 未结算时 returnToMenu 只冻结, 世界保持原样 (可从主菜单继续)
//   T11 就地重开新一局: beginFreshMatch 后世界干净且单位数不累加
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
// ── 通用小桩 (与 verify-returntomenu.js 同源) ──
const mk2d=()=>new Proxy({}, { get(t,k){
if(k==='canvas') return {width:64,height:64};
if(typeof k==='symbol') return undefined;
if(!(k in t)) t[k]=(...a)=>mk2d();
return t[k];
}, set(t,k,v){ t[k]=v; return true; } });
const mkElement=(tag)=>{
const el={tagName:(tag||'div').toUpperCase(),style:{},textContent:'',innerHTML:'',value:'',dataset:{},disabled:false,
children:[],appendChild(c){this.children.push(c);return c;},prepend(c){this.children.unshift(c);},
remove(){},focus(){},
getContext:()=>mk2d(),width:0,height:0,
setAttribute(){},querySelector:()=>mkElement(),querySelectorAll:()=>[],
_handlers:{},
addEventListener(type,fn){ (this._handlers[type]=this._handlers[type]||[]).push(fn); },
removeEventListener(){},
dispatchEvent(e){ const type=(e&&e.type)||'click';
if(type==='click'&&typeof this.onclick==='function') this.onclick(e);
for(const fn of (this._handlers[type]||[])) fn(e);
return true; },
};
const cls={_s:new Set(),
add(c){this._s.add(c);},remove(c){this._s.delete(c);},
toggle(c,on){ if(on===undefined){ this._s.has(c)?this._s.delete(c):this._s.add(c); } else if(on) this._s.add(c); else this._s.delete(c); },
contains(c){return this._s.has(c);}};
el.classList=cls;
Object.defineProperty(el,'className',{get(){ return Array.from(cls._s).join(' '); },set(v){ cls._s=new Set(String(v).split(/\s+/).filter(Boolean)); }});
Object.defineProperty(el,'firstChild',{get(){ if(!el._fc) el._fc={textContent:''}; return el._fc; }});
return el;
};
const byId={};
const SCREEN_IDS=['menu','deploy','end','pauseOv'];
const document={
createElement:t=>t==='canvas'?Object.assign(mkElement('canvas'),{width:0,height:0}):mkElement(t),
createElementNS:()=>mkElement('canvas'),
getElementById:id=>{ if(!byId[id]){ byId[id]=mkElement(); byId[id].id=id;
if(id!=='menu'&&SCREEN_IDS.indexOf(id)>=0) byId[id].classList.add('hidden');
}
return byId[id]; },
querySelector:sel=>{ if(sel==='canvas') return Object.assign(mkElement('canvas'),{width:0,height:0}); return mkElement(); },
querySelectorAll:sel=>{
if(sel==='.screen') return SCREEN_IDS.map(id=>document.getElementById(id));
return [];
},
body:mkElement('body'),head:mkElement('head'),
addEventListener(){},removeEventListener(){},hidden:false,pointerLockElement:null,exitPointerLock(){},
};
// ── THREE 桩 (与 verify-returntomenu 同源; InstancedMesh 加强: 真 instanceMatrix/instanceColor 数组) ──
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
class Obj3{constructor(){this.position=new V3();this.rotation=new Euler();this.scale=new V3(1,1,1);/* 2026-09-26 桩保真度: quaternion 必须带 x/y/z/w 分量 —— 真 three 的 Object3D.quaternion 恒有分量, 而倒伏 (04b floraObjMatrices) 会读它们算 R⊗q0; 桩里缺分量 ⇒ 读成 undefined ⇒ 网格姿态变 NaN (是被测探针在桩上的假红, 不是被测代码缺陷) */this.quaternion={x:0,y:0,z:0,w:1,setFromUnitVectors(){return this;}};this.children=[];this.visible=true;this.castShadow=false;this.receiveShadow=false;this.renderOrder=0;this.matrix={};this.userData={};this.material=null;this.geometry=null;}
add(m){this.children.push(m);m.parent=this;return this;}remove(m){const i=this.children.indexOf(m);if(i>=0)this.children.splice(i,1);}
traverse(fn){fn(this);for(const c of this.children)if(c&&c.traverse)c.traverse(fn);}
updateMatrix(){}
lookAt(){return this;}
clone(){const c=new this.constructor();if(this.geometry)c.geometry=this.geometry;if(this.material)c.material=this.material;c.position=new V3(this.position.x,this.position.y,this.position.z);c.rotation=new Euler();c.scale=new V3(1,1,1);c.visible=this.visible;c.castShadow=this.castShadow;c.name=this.name;return c;}};
class Geo{constructor(...a){this.attributes={};this.parameters={};}translate(){return this;}rotateX(){return this;}rotateY(){return this;}rotateZ(){return this;}setAttribute(n,a){this.attributes[n]=a;return this;}setIndex(){return this;}setFromPoints(){return this;}computeVertexNormals(){return this;}dispose(){}}
class _PlaneGeo extends Geo{constructor(w=1,h=1,sg=1,sh=1){super(w,h);const gx=(sg||1)+1,gy=(sh||1)+1;this.attributes.position={count:gx*gy,array:new Float32Array(gx*gy*3),getX:i=>((i%gx)/gx-0.5)*w,getZ:i=>(Math.floor(i/gx)/gy-0.5)*h,getY:()=>0,setY(){},setX(i,v){this.array[i*3]=v;},setZ(i,v){this.array[i*3+2]=v;}};}}
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
const _mat=cls=>{ return class extends cls{constructor(o){super();Object.assign(this,o||{});this.color=_wrapColor(this.color);}}; };
class _Fog{constructor(c,n,f){this.color=new _Color(c);this.near=n;this.far=f;}}
class _FogExp2{constructor(c,d){this.color=new _Color(c);this.density=d;}}
// InstancedMesh: 真数组 —— 倒伏/焦黑/烧尽写的正是 instanceMatrix/instanceColor。
// setMatrixAt 写入可辨认的模式 (元素 13 = i 的函数), 这样"快照→破坏→还原"能逐元素比对。
class InstancedMeshStub extends Obj3{
constructor(g,m,n){super();this.count=n;this.instanceMatrix={array:new Float32Array(n*16),needsUpdate:false};this.instanceColor=null;}
setMatrixAt(i,m){ const a=this.instanceMatrix.array; if(i*16+13<a.length){ a[i*16+13]=1+(i%97); a[i*16+12]=2+(i%89); } this.instanceMatrix.needsUpdate=true; }
setColorAt(i,c){ if(!this.instanceColor) this.instanceColor={array:new Float32Array(this.count*3),needsUpdate:false}; const a=this.instanceColor.array; if(i*3<a.length) a[i*3]=0.25; this.instanceColor.needsUpdate=true; }
}
const THREE={
WebGLRenderer:class{constructor(){this.domElement=Object.assign(mkElement('canvas'),{width:0,height:0});this.shadowMap={enabled:false,type:0,autoUpdate:true};this.setSize=()=>{};this.setPixelRatio=()=>{};this.render=()=>{};this.clear=()=>{};this.clearDepth=()=>{};this.outputColorSpace='';this.setClearColor=()=>{};this.setAnimationLoop=()=>{};this.domElement.style={};}},
Scene:class extends Obj3{constructor(){super();this.background=null;this.fog=null;}},
PerspectiveCamera:class extends Obj3{constructor(){super();this.fov=70;this.near=0.1;this.far=1000;this.aspect=1;}updateProjectionMatrix(){}getWorldDirection(v){v.set(0,0,-1);return v;}},
Group:class extends Obj3{},Mesh:class extends Obj3{constructor(g,m){super();this.geometry=g||new Geo();this.material=m||{};}},
InstancedMesh:InstancedMeshStub,
Points:class extends Obj3{constructor(g,m){super();this.geometry=g;this.material=m;}},
LineSegments:class extends Obj3{constructor(g,m){super();this.geometry=g;this.material=m;}},
Object3D:Obj3,Sprite:class extends Obj3{constructor(m){super();this.material=m||{};if(!this.material.color)this.material.color={set(){}};}},
Vector2:class{constructor(x=0,y=0){this.x=x;this.y=y;}set(x,y){this.x=x;this.y=y;return this;}},
Vector3:V3,Vector4:V3,Euler:Euler,Quaternion:class{set(){return this;}setFromUnitVectors(){return this;}identity(){return this;}setFromEuler(){return this;}setFromAxisAngle(){return this;}premultiply(){return this;}},
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
AmbientLight:class extends Obj3{constructor(c,i){super();this.intensity=i;this.color=new _Color(c);}},
HemisphereLight:class extends Obj3{constructor(a,b,i){super();this.intensity=i;}},
PointLight:class extends Obj3{},
Box3:class{setFromObject(){return this;}expandByObject(){return this;}},
Clock:class{getDelta(){return 0;}},
Matrix4:class{compose(){return this;}makeRotationFromEuler(){return this;}makeScale(){return this;}identity(){return this;}multiply(){return this;}copy(){return this;}},
MathUtils:{clamp:(v,a,b)=>v<a?a:(v>b?b:v)},
RepeatWrapping:1000,DoubleSide:2,BackSide:1,FrontSide:0,SRGBColorSpace:'srgb',NoToneMapping:0,
PCFSoftShadowMap:2,PCFShadowMap:1,BasicShadowMap:0,NearestFilter:0,LinearFilter:1,
};
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
// CANNON 桩补全 (布娃娃/碎块物理走真路径: ragInit 需要 gravity/solver/broadphase, 摘除需要 removeBody)
const CANNON={
Body:class{constructor(o){Object.assign(this,o||{});this.position=new V3();this.quaternion={setFromEuler(){return this;}};this.velocity=new V3();this.angularVelocity=new V3();this.shapes=[];}
addShape(){}},
World:class{constructor(){this.gravity={set(){}};this.bodies=[];this.constraints=[];this.broadphase=null;this.solver={iterations:1};}
add(){}
addBody(b){this.bodies.push(b);}
removeBody(){}
remove(){}
addConstraint(c){this.constraints.push(c);}
removeConstraint(){}
step(){}},
NaiveBroadphase:class{},
Box:class{constructor(v){this.v=v;}},Sphere:class{},Vec3:V3,Material:class{},ContactMaterial:class{},PointToPointConstraint:class{constructor(){}},
};
const window={addEventListener(){},removeEventListener(){},AudioContext:AC,webkitAudioContext:AC,CANNON};
let RELOADS=0, CONFIRM_ANSWER=true, CONFIRM_ASKS=[], TIMERS=[], TIMER_ID=0;
function flushTimers(limit){
let n=0;
while(TIMERS.length&&n<(limit||30)){
const fn=TIMERS.shift(); n++;
try{ fn(); }catch(e){ console.log('  [timer] 抛错: '+String(e&&e.message||e)); }
}
}
const sandbox={
console,Math,JSON,performance:{now:()=>Date.now()},
location:{search:'?seed=42',reload(){RELOADS++;},href:'http://localhost/'},
navigator:{},document,window,
confirm(msg){ CONFIRM_ASKS.push(String(msg)); return CONFIRM_ANSWER; },
requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},
setTimeout:(f,t)=>{ TIMERS.push(f); return ++TIMER_ID; },clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{},
devicePixelRatio:1,innerWidth:1280,innerHeight:720,addEventListener(){},removeEventListener(){},
AudioContext:AC,
};
sandbox.globalThis=sandbox;
sandbox.THREE=THREE;
sandbox.CANNON=CANNON;   // 游戏用裸 CANNON 全局 (浏览器里 window.CANNON 同源)
sandbox.window=window;
function load(ctx,file){ vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file}); }
// 载入顺序与 index.html 一致 (23b 插在 23-deploy 与 24-main 之间)
const FILES=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15g-capmodels.js','js/15h-capital.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/22a-menuart.js','js/23-deploy.js','js/23b-worldrestore.js','js/24-main.js'];
function boot(campIdx,store){
for(const k in byId)delete byId[k];
TIMERS=[]; CONFIRM_ASKS=[];
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document;ctx.window=window;
ctx.localStorage={_s:Object.assign({sf_campaign:String(campIdx)},store||{}),
getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of FILES){
try{ load(ctx,f); }
catch(e){ console.log('LOAD FAIL '+f+' :: '+String((e&&e.stack)||e).split('\n').slice(0,4).join(' | ')); }
}
return ctx;
}
let FAILS=0, GROUPS=0;
function ok(cond,label){
if(cond) console.log('  ✔ '+label);
else { FAILS++; console.log('  ✘ '+label); }
}
function group(name){ GROUPS++; console.log('\n'+name); }
const run=(ctx,code)=>{
try{ return vm.runInContext(code,ctx); }
catch(e){ FAILS++; console.log('  ✘ 运行期异常: '+String((e&&e.stack)||e).split('\n').slice(0,3).join(' | ')); return undefined; }
};
// ── 世界指标 (在 vm 内取) ──
const METRICS=`(function(){
const imSum=x=>{ const a=x&&x.instanceMatrix&&x.instanceMatrix.array; if(!a) return 0; let s=0; for(let i=0;i<a.length;i++) s+=a[i]; return Math.round(s*1000)/1000; };
let floraDead=0, floraTotal=0;
FLORA_HASH.forEach(a=>{ for(const r of a){ floraTotal++; if(r.dead) floraDead++; } });
let fuel=0; for(let i=0;i<FUEL.length;i++) fuel+=FUEL[i];
let occ=0; if(OCC.data) for(let i=0;i<OCC.data.length;i++) occ+=OCC.data[i];
return {
worldKids:world.children.length, sceneKids:scene.children.length,
boxes:BOXES.length, boxDead:BOXES.filter(b=>b.dead).length,
cyls:CYLS.length, cylDead:CYLS.filter(c=>c.dead).length,
destTotal:DESTRUCTIBLES.length, destDead:DESTRUCTIBLES.filter(g=>g.dead).length,
destHp:Math.round(DESTRUCTIBLES.reduce((s,g)=>s+g.hp,0)),
destLostMesh:DESTRUCTIBLES.filter(g=>!g.dead&&g.meshes.some(m=>m&&!m.parent)).length,
roofDone:WSN.roof.filter(e=>e.r.done).length,
floraTotal, floraDead,
treeSum:imSum(typeof TREE_IM!=='undefined'&&TREE_IM?TREE_IM.trunks:null),
leafSum:imSum(typeof TREE_IM!=='undefined'&&TREE_IM?TREE_IM.leaves:null),
fuel:Math.round(fuel*100)/100,
occ,
props:PROPS.length, cover:coverPoints.length, wires:wires.length, mg:MG42S.length,
craters:runtimeCraters.length, crops:CROP_FIELDS.length,
flagOwn:FLAGS.map(f=>f.owner).join(','),
flagY:Math.round(FLAGS.reduce((s,f)=>s+(f.flagMesh?f.flagMesh.position.y:0),0)*100)/100,
// 旗高偏差: 中立旗应停在 gy+3.2 (updateFlags 的中立目标位) —— 旗高是每帧阻尼的动画量,
// 只有"回到目标位"才是稳定可比的状态 (快照读数本身在菜单待机期间一直在变)
flagErr:Math.round(FLAGS.reduce((s,f)=>{ if(!f.flagMesh||f.owner!==-1) return s; return Math.max(s,Math.abs(f.flagMesh.position.y-(f.gy+3.2))); },0)*1000)/1000,
// 旗布顶点是否回到基线 (逐元素最大偏差)
flagCloth:Math.round(FLAGS.reduce((s,f)=>{ if(!f.flagGeo||!f.flagBase) return s; const a=f.flagGeo.attributes.position.array; let m=0; for(let k=0;k<f.flagGeo.attributes.position.count;k++){ m=Math.max(m,Math.abs(a[k*3]-f.flagBase[k*3]),Math.abs(a[k*3+2]-f.flagBase[k*3+2])); } return Math.max(s,m); },0)*1000)/1000,
// 炮位残留射角: 开局全部为 0 (yaw 组 rotation.y / pitch 组 rotation.x)
aimErr:Math.round([].concat(MG42S,ATGUNS,AAGUNS).reduce((s,g)=>{ return s+(g&&g.yaw?Math.abs(g.yaw.rotation.y):0)+(g&&g.pitch?Math.abs(g.pitch.rotation.x):0); },0)*1000)/1000,
// 草丛/庄稼"按格索引表"总格数 (烧尽时 delete(格))
burnCells:BURN_INST.reduce((s,bi)=>s+(bi.byCell?bi.byCell.size:0),0),
soldiers:soldiers.length, tanks:tanks.length, planes:planes.length, trucks:trucks.length,
combatants:combatants.length,
ragdolls:RAG.list.length, debris:DEBRIS.list.length, sinks:SINK_JOBS.length,
particles:particles.length, smokes:SMOKES.length, casings:casings.length, tracers:tracers.length,
nades:nades.length, shells:shells.length, planeWrecks:planeWrecks.length,
fires:FIRE_ACTIVE.length, fireSrc:FIRE_SOURCES.length, treesFalling:FALLING.length, treesBurning:BURNING_TREES.length,
// 枯树/椰树倒伏的网格变换相对"开局记录值"的最大偏差 (>0 = 确实倒着; ≈0 = 已还原成直立)
// 桩能力注记: 本探针的 Obj3.quaternion 只有 setFromUnitVectors (无 x/y/z/w 分量), 故读取一律走
// "有分量才取、否则取默认" —— 缺这层会静默拿到 undefined ⇒ 指标变 NaN (不是被测代码失败)。
toppleDev:(function(){ const p=window.__fallProbe; if(!p||!p.rec.meshes) return -1; let m=0;
for(let i=0;i<p.rec.meshes.length;i++){ const o=p.rec.meshes[i], t=p.tr[i]; if(!o||!t) continue;
m=Math.max(m,Math.abs(o.position.x-t[0]),Math.abs(o.position.y-t[1]),Math.abs(o.position.z-t[2]));
const q=o.quaternion; if(q) m=Math.max(m,Math.abs((typeof q.x==='number'?q.x:0)-t[3]),Math.abs((typeof q.y==='number'?q.y:0)-t[4]),Math.abs((typeof q.z==='number'?q.z:0)-t[5]),Math.abs((typeof q.w==='number'?q.w:1)-t[6])); }
return Math.round(m*10000)/10000; })(),
toppleKind:(window.__fallProbe&&window.__fallProbe.kind)||'',
boundary:(typeof window.__sfMatchWorldStart==='number')?window.__sfMatchWorldStart:-1,
};
})()`;
const M=ctx=>run(ctx,METRICS);
// ── 破坏脚本: 把世界打烂 (逐条覆盖一类破坏入口) ──
const DESTROY=`(function(){
const log={};
// ① 建筑: 打掉一个未毁的可毁结构组 (先扣血再摧毁, 复刻 damageStructures 的两步语义)
const g=DESTRUCTIBLES.find(x=>!x.dead&&x.meshes&&x.meshes.length);
if(g){ g.hp-=300; if(g.hp<=0) destroyStructure(g); log.structure=1; }
// ② 旗面归属 (开局=中立或就近归属; 这里翻到对面, 还原应回开局值)
if(FLAGS.length){ FLAGS[0].owner=FLAGS[0].owner===0?1:0; drawFlagTex(FLAGS[0]); }
// ③ 在途炮击/沉入任务 (还原时必须清掉, 否则会把还原后的原始网格再推下地)
TB_THREATS.push({x:0,z:0,r:20,t:6}); TB_PENDING.push({x:0,z:0,t:2});
if(world.children.length) queueSink({objs:[world.children[world.children.length-1]],depth:2,rest:0.2,sink:0.5});
// ④ 植被: 碾毁/炸没 树篱·灌木·蕨类·枯木 各若干株
let n=0;
FLORA_HASH.forEach(arr=>{ for(const r of arr){ if(n<10&&r&&!r.dead&&(r.kind==='hedge'||r.kind==='bush'||r.kind==='fern'||r.kind==='bamboo'||r.kind==='dead')){ vanishFlora(r,true); n++; } } });
log.floraKilled=n;
// ④b 枯树/椰树倒伏 (2026-09-26): 倒伏写的是**网格自身的** position/quaternion (floraObjMatrices),
//     不是实例矩阵 ⇒ 只还原 y 的话下一局这两类会歪在原地。这里挑一株倒伏并记下开局变换,
//     由 toppleDev 指标在 T3(敏感度)/T4(还原) 两侧断言。
{
let tp=null;
FLORA_HASH.forEach(arr=>{ for(const r of arr){ if(!tp&&r&&!r.dead&&r.alive!==false&&(r.kind==='palm'||r.kind==='dead')&&r.meshes&&r.meshes.length) tp=r; } });
if(tp){
window.__fallProbe={rec:tp,kind:tp.kind,tr:tp.meshes.map(m=>[m.position.x,m.position.y,m.position.z,
(m.quaternion&&typeof m.quaternion.x==='number')?m.quaternion.x:0,
(m.quaternion&&typeof m.quaternion.y==='number')?m.quaternion.y:0,
(m.quaternion&&typeof m.quaternion.z==='number')?m.quaternion.z:0,
(m.quaternion&&typeof m.quaternion.w==='number')?m.quaternion.w:1])};
floraTopple(tp,1,0);
for(let i=0;i<20;i++) updateFallingTrees(0.05);   // 推到倒伏中途 (t≈1.0 ≈ dur)
log.floraToppled=(tp.kind||'?')+(tp.fall?'(fall)':'(无 fall!)');
} else log.floraToppled='(本布局无枯树/椰树)';
}
// ⑤ 树木: 放倒 3 棵 + 点燃 2 棵 (倒伏改写实例矩阵, 烧毁改写实例色)
let f=0; for(const tr of TREE_LIVE){ if(f<3&&tr.alive&&!tr.fall){ treeFall(tr,1,0); f++; } }
let b=0; for(const tr of TREE_LIVE){ if(b<2&&tr.alive&&tr.burnT<0){ treeIgnite(tr,null); b++; } }
log.treesFelled=f; log.treesBurned=b;
// ⑥ 实例批: 模拟沉入/焦黑对实例矩阵的改写 (真路径由 updateTreeSinks/updateFires 写)
if(TREE_IM&&TREE_IM.trunks&&TREE_IM.trunks.instanceMatrix.array){ TREE_IM.trunks.instanceMatrix.array[13]=-999; TREE_IM.trunks.instanceMatrix.array[29]=-999; }
if(TREE_IM&&TREE_IM.leaves&&TREE_IM.leaves.instanceMatrix.array){ TREE_IM.leaves.instanceMatrix.array[13]=-999; }
// ⑦ 火焰: 点燃一片 + 烧掉燃料
igniteArea(0,0,26,null);
for(let i=0;i<FUEL.length;i+=7) FUEL[i]=0;
// ⑦b 草丛/庄稼烧尽: 按格索引表被 delete (实例矩阵同时被零缩放, 由 sink 系统写)
for(const bi of BURN_INST){ if(bi.byCell&&bi.byCell.size){ let k=0; for(const ci of bi.byCell.keys()){ bi.byCell.delete(ci); if(++k>=3) break; } } }
// ⑧ 弹坑 (运行期弹坑表 + world 网格)
if(typeof crater==='function'){ crater(6,6,2.2,true); crater(9,7,2.0,true); }
// ⑨ 工程兵工事: 占位表先清空以保证落点成功 (还原时 PROPS 整体写回, 清空不影响断言)
PROPS.length=0;
sandbagWall(22,22,5,0,1.0,false);
barbedWire(26,25,0,4.2,null);
mg42(30,27,0,0);
// ⑩ 运行期特效: 粒子/弹壳/烟/拖痕/在途手雷与炮弹/碎块/布娃娃
spawnP(PT.dirt,0,6,0,0,1,0,1,1,4,1,0);
spawnCasing(new THREE.Vector3(0,2,0),new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0));
spawnSmokeCloud(new THREE.Vector3(4,1,4),false,null);
spawnTracer(new THREE.Vector3(0,2,0),new THREE.Vector3(0,0,1),40);
nades.push({m:new THREE.Mesh(new THREE.SphereGeometry(0.06,8,6),vmMats.nade),pos:new THREE.Vector3(0,6,0),vel:new THREE.Vector3(),fuse:3,team:0,bounces:0});
shells.push({pos:new THREE.Vector3(0,6,0),vel:new THREE.Vector3(),team:0,life:3,kind:'at',trail:0});
if(typeof spawnDebris==='function') spawnDebris(MAT.stone,6,3,6,0,1,1,1,6,6);
if(soldiers[0]&&typeof spawnRagdoll==='function') spawnRagdoll(soldiers[0],null,false);
// ⑪ 固定炮位/地图机枪被操作后残留射角
if(MG42S.length){ MG42S[0].user=player; MG42S[0].yaw.rotation.y=1.2; MG42S[0].pitch.rotation.x=-0.4; }
if(ATGUNS.length){ ATGUNS[0].user=player; ATGUNS[0].yaw.rotation.y=0.7; ATGUNS[0].pitch.rotation.x=0.3; }
if(AAGUNS.length){ AAGUNS[0].user=player; AAGUNS[0].yaw.rotation.y=0.5; AAGUNS[0].pitch.rotation.x=0.2; }
return log;
})()`;
function main(){
group('T1 启动末尾拍开局快照 (24-main → capturePristineWorld)');
const ctx=boot(0,{});
const info=run(ctx,'worldSnapshotInfo()');
ok(info&&info.ready===true,'快照已就绪 (ready=true)');
ok(info&&info.world>100,'world 台账拍到世界对象 ('+(info&&info.world)+' 项)');
ok(info&&info.scene>5,'scene 台账拍到场景对象 ('+(info&&info.scene)+' 项)');
ok(info&&info.boxes>100,'静态碰撞盒 ('+(info&&info.boxes)+' 个)');
ok(info&&info.dest>5,'可毁结构组 ('+(info&&info.dest)+' 组, 屋顶链 '+(info&&info.roofs)+')');
ok(info&&info.flora>50,'植被记录 ('+(info&&info.flora)+' 株)');
ok(info&&info.inst>0,'实例批 ('+(info&&info.inst)+' 批)');
ok(info&&info.flags>0,'旗面 ('+(info&&info.flags)+' 面)');
const P=M(ctx);
ok(P.worldKids===info.world,'台账项数与指标一致');
ok(P.boundary<0||P.boundary===P.worldKids,'__sfMatchWorldStart 边界 = 未开局时的 world 项数 ('+P.boundary+')');

group('T2 重复拍快照不覆盖基线 (打烂后不会把废墟当开局)');
run(ctx,DESTROY);
const beforeRecapture=M(ctx);
run(ctx,'capturePristineWorld()');
const afterRecapture=M(ctx);
ok(afterRecapture.destDead===beforeRecapture.destDead&&afterRecapture.floraDead===beforeRecapture.floraDead,
'再次 capturePristineWorld 不改写已拍基线 (结构毁 '+afterRecapture.destDead+' / 植被死 '+afterRecapture.floraDead+')');
ok(run(ctx,'restorePristineWorld()')===true,'还原入口返回 true');
run(ctx,'beginFreshMatch();');
const C=M(ctx); // 干净基线 (开了一局之后: 世界=快照, units=本局)

group('T3 ★破坏确实发生 (敏感度对照: 还原若是空操作, T4~T6 必然失败)');
const log=run(ctx,DESTROY);
console.log('  · 破坏记录: '+JSON.stringify(log));
const D=M(ctx);
ok(D.destDead>P.destDead,'建筑被摧毁 ('+P.destDead+' → '+D.destDead+')');
ok(D.destHp<P.destHp,'结构组血量下降 ('+P.destHp+' → '+D.destHp+')');
ok(D.floraDead>P.floraDead,'植被被毁 ('+P.floraDead+' → '+D.floraDead+')');
ok(D.cylDead>P.cylDead,'树干圆柱被推倒/烧毁 ('+P.cylDead+' → '+D.cylDead+')');
ok(D.fuel<P.fuel,'火焰消耗了燃料 ('+P.fuel+' → '+D.fuel+')');
ok(D.fires>0,'存在燃烧格 ('+D.fires+')');
ok(D.boxes>P.boxes,'工事新增碰撞盒 ('+P.boxes+' → '+D.boxes+')');
ok(D.wires>P.wires&&D.mg>P.mg,'铁丝网/机枪登记表增长 (wires '+P.wires+'→'+D.wires+', mg '+P.mg+'→'+D.mg+')');
ok(D.cover>P.cover,'掩体点增长 ('+P.cover+'→'+D.cover+')');
ok(D.props<P.props,'占位表被测试清空 (代入"运行时占用表变动", '+P.props+'→'+D.props+')');
ok(D.craters>P.craters,'运行期弹坑增长 ('+P.craters+'→'+D.craters+')');
ok(D.particles>0&&D.casings>0&&D.smokes>0&&D.tracers>0,'粒子/弹壳/烟/拖痕在场');
ok(D.ragdolls>0&&D.debris>0&&D.sinks>0,'布娃娃/碎块/沉入任务在场 ('+D.ragdolls+'/'+D.debris+'/'+D.sinks+')');
ok(D.nades>C.nades&&D.shells>C.shells,'在途投掷物/炮弹在场');
ok(D.treeSum!==P.treeSum||D.leafSum!==P.leafSum,'树木实例矩阵被改写');
ok(D.sceneKids>P.sceneKids,'scene 台账新增对象 ('+P.sceneKids+'→'+D.sceneKids+')');
ok(D.flagOwn!==P.flagOwn,'旗面归属被改写 ('+P.flagOwn+' → '+D.flagOwn+')');
ok(D.aimErr>0,'炮位残留射角 ('+P.aimErr+' → '+D.aimErr+')');
ok(D.burnCells<P.burnCells,'草丛/庄稼按格索引表被烧掉若干格 ('+P.burnCells+' → '+D.burnCells+')');
ok(P.toppleDev===0||P.toppleDev===-1,'前置: 开局枯树/椰树网格变换 = 记录值 (偏差 '+P.toppleDev+')');
ok(D.toppleDev>0.1,'枯树/椰树倒伏确实改写了网格变换 ('+D.toppleKind+' 偏差 '+P.toppleDev+' → '+D.toppleDev+')');

group('T4 ★还原: 逐项回到开局快照');
const R=run(ctx,'restorePristineWorld()');
ok(R===true,'还原入口返回 true');
const A=M(ctx);
const same=(k,label)=>ok(A[k]===P[k],label+' ('+P[k]+' → '+A[k]+')');
same('worldKids','world 台账项数复位');
same('boxes','碰撞盒数量复位 (运行时新增整段截掉)');
same('boxDead','碰撞盒死亡数复位');
same('cyls','圆柱障碍数量复位');
same('cylDead','圆柱障碍死亡数复位');
same('destTotal','可毁结构组数量复位');
same('destDead','可毁结构组死亡数复位');
same('destHp','可毁结构组血量总和复位');
same('roofDone','屋顶坍塌链状态复位');
same('floraTotal','植被记录数复位');
same('floraDead','植被死亡数复位');
same('treeSum','树干实例矩阵总和复位');
same('leafSum','叶面实例矩阵总和复位');
same('fuel','火焰燃料复位');
same('occ','占用网格 OCC 校验和复位 (NAV.refresh 重建)');
same('props','占位表 PROPS 复位');
same('cover','掩体点 coverPoints 复位');
same('wires','铁丝网表复位');
same('mg','机枪登记表复位');
same('craters','运行期弹坑表复位');
same('crops','田块表复位');
same('flagOwn','旗面归属复位 (开局归属)');
ok(A.flagErr<0.05,'旗高回到中立目标位 (最大偏差 '+A.flagErr+' m — 快照读数本身在菜单待机期间一直阻尼)');
ok(A.flagCloth<0.001,'旗布顶点逐元素回到基线 (最大偏差 '+A.flagCloth+')');
same('aimErr','炮位射角复位 (固定炮位/地图机枪回到开局指向)');
same('burnCells','草丛/庄稼按格索引表复位 (下一局同一格再烧照样能隐藏实例)');
same('fires','燃烧格清零');
same('fireSrc','持续火源清零');
same('treesFalling','倒伏动画表清零');
same('treesBurning','树冠燃烧表清零');

group('T5 ★视觉复位: 网格/实例/结构回到"看得见且完好"');
ok(A.destLostMesh===0,'没有"未毁但网格掉出场景"的可毁结构 ('+A.destLostMesh+' 处)');
ok(A.floraDead===C.floraDead,'植被记录全部复活 (无残留 dead 标记)');
ok(run(ctx,`(function(){ const g=DESTRUCTIBLES.find(x=>!x.dead&&x.meshes&&x.meshes.length); return !!g&&g.meshes.every(m=>m&&m.parent===world); })()`)===true,
'可毁结构的网格重新挂回 world');
ok(run(ctx,`(function(){ const H=world.children.filter(c=>c&&c.parent!==world).length; return H===0; })()`)===true,
'world 台账里没有"父子关系错乱"的项');
ok(run(ctx,`(function(){ let bad=0; FLORA_HASH.forEach(a=>{ for(const r of a){ if(r.meshes) for(const m of r.meshes){ if(m&&!m.parent) bad++; } } }); return bad; })()`)===0,
'植被网格全部在场 (沉入动画不会把还原后的树篱留在半空/地下)');
ok(run(ctx,`(function(){ const e=WSN.inst[0]; const a=e.im.instanceMatrix.array; if(!e.m) return true; for(let i=0;i<a.length;i++) if(a[i]!==e.m[i]) return false; return true; })()`)===true,
'实例矩阵逐元素等于快照 (倒伏/焦黑/零缩放全部还原)');
// 枯树/椰树倒伏的网格变换逐元素还原 (position xyz + quaternion; 旧版只还原 y ⇒ 这一条会红)
ok(A.toppleDev>=0&&A.toppleDev<1e-6,'枯树/椰树倒伏后网格变换逐元素还原 (最大偏差 '+A.toppleDev+(A.toppleDev<1e-6?' → 直立)':' → 仍有残余!)'));

group('T6 ★场景无残留: 上一局的人与残骸一律不在场');
ok(A.soldiers===0,'Bot 表清空');
ok(A.tanks===0&&A.planes===0&&A.trucks===0,'载具表清空');
ok(A.combatants===1,'combatants 只剩玩家 (记分板/索敌不会列出上一局的人)');
ok(A.ragdolls===0&&A.debris===0&&A.sinks===0,'布娃娃/碎块/沉入任务清零');
ok(A.particles===0&&A.smokes===0&&A.casings===0&&A.tracers===0,'粒子/烟/弹壳/拖痕清零');
ok(A.nades===0&&A.shells===0&&A.planeWrecks===0,'在途投掷物/炮弹/坠机残骸清零');
ok(A.sceneKids===P.sceneKids,'scene 台账项数复位 ('+P.sceneKids+' → '+A.sceneKids+')');
ok(A.boundary===P.worldKids,'台账边界仍等于开局 world 项数 (retireMatchActors 按边界清理依旧成立)');

group('T7 幂等: 连做两次还原指标不变');
run(ctx,'restorePristineWorld()');
const A2=M(ctx);
ok(JSON.stringify(A2)===JSON.stringify(A),'第二次还原后全部指标与第一次一致');

group('T9 ★结算后回主菜单 = 干净地图 (用户实报路径)');
run(ctx,'beginFreshMatch();');       // 开新一局 (世界=快照, 单位齐)
run(ctx,DESTROY);                    // 打烂
run(ctx,'endMatch(0);');             // 结算 (真实结算入口)
flushTimers();                       // 结算页 900ms 定时器
ok(run(ctx,'matchOver===true&&matchRunning===false')===true,'前置: 战局已结束 (matchOver, 无"可继续的战局")');
run(ctx,`document.getElementById('againBtn').dispatchEvent({type:'click'})`); // 结算页「返回主界面」
const MB=M(ctx);
ok(run(ctx,'menuHold===true')===true,'人已在主菜单 (menuHold 冻结)');
ok(MB.worldKids===P.worldKids&&MB.destDead===P.destDead&&MB.floraDead===P.floraDead,'主菜单背景世界 = 开局快照 (无坍塌/无焦土)');
ok(MB.soldiers===0&&MB.ragdolls===0,'主菜单航拍里没有上一局的人 (含尸体)');
ok(MB.fuel===P.fuel&&MB.craters===P.craters&&MB.craters===0,'弹坑/焦土不在场上');
ok(MB.sceneKids===P.sceneKids,'scene 台账复位 (粒子/残骸/尸体网格全部摘除)');

group('T10 冻结战局不还原 (阴性对照: 战局未结束时背景就是冻结的战场)');
run(ctx,'beginFreshMatch();');
run(ctx,DESTROY);
const preFreeze=M(ctx);
CONFIRM_ANSWER=true;
run(ctx,`document.getElementById('deployMenuBtn').dispatchEvent({type:'click'})`); // 部署界面「返回主界面」
const FZ=M(ctx);
ok(run(ctx,'menuHold===true&&matchOver===false')===true,'前置: 未结算就返回了主界面 (战局挂起)');
ok(FZ.destDead===preFreeze.destDead&&FZ.floraDead===preFreeze.floraDead&&FZ.worldKids===preFreeze.worldKids,
'世界原样保留 (未被还原: 还能从主菜单继续这一局)');
ok(FZ.soldiers>0&&run(ctx,'soldiers.some(s=>s.alive)')===true,'战局单位仍在场 (继续游戏 = 接着打)');
run(ctx,`document.getElementById('continueBtn').dispatchEvent({type:'click'})`);
ok(run(ctx,'menuHold===false')===true,'「继续游戏」回到战局');

group('T11 就地重开新一局: 世界干净 + 单位数不累加');
const u0=M(ctx).soldiers;
const log2=run(ctx,DESTROY);
run(ctx,'beginFreshMatch();');
const N=M(ctx);
ok(N.destDead===P.destDead&&N.floraDead===P.floraDead&&N.fuel===P.fuel,'新一局世界 = 开局快照');
ok(N.soldiers===u0&&N.soldiers>0,'单位数不累加 ('+u0+' → '+N.soldiers+')');
ok(N.ragdolls===0&&N.debris===0&&N.particles===0,'新一局无上一局残留特效');
ok(N.boundary===P.worldKids,'边界不变量在重开后仍成立');

console.log('\n════════════════════════════════════');
console.log(FAILS===0?('全部通过: '+GROUPS+' 组用例, 0 失败'):('失败 '+FAILS+' 项 / '+GROUPS+' 组'));
process.exit(FAILS===0?0:1);
}
main();
