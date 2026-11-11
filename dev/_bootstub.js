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
children:[],appendChild(c){ if(c&&typeof c==='object') c.parentNode=this; this.children.push(c); return c; },
prepend(c){ if(c&&typeof c==='object') c.parentNode=this; this.children.unshift(c); return c; },
// remove() 必须是**父感知**的真删除: 21-match 的 addKillfeed 用
// `while(kf.children.length>6) kf.lastChild.remove();` —— 空实现 ⇒ length 永不减 ⇒ 死循环;
// 只补 lastChild 不修 remove 会更糟 (2026-09-20 由 naval-hull 定位, verifier 独立复现后修)
remove(){ const p=this.parentNode; if(p&&p.children){ const i=p.children.indexOf(this); if(i>=0) p.children.splice(i,1); } this.parentNode=null; },
addEventListener(){},removeEventListener(){},focus(){},
getContext:()=>mk2d(),width:0,height:0,
setAttribute(){},querySelector:()=>mkElement(),querySelectorAll:()=>[],
};
// ★2026-09-28: firstChild 按真 DOM 语义 —— 有子件时**就是第一个子件本身** (旧桩无论有无子件都返回
//   一个"假文本节点"对象)。21-match 的 showKillPop 写的是 `while(box.children.length>5) box.firstChild.remove();`
//   (真 DOM 里 firstChild 可能是文本节点, 而 CharacterData 同样带 ChildNode.remove, 所以那段是安全写法):
//   旧桩给的对象没有 remove ⇒ 击杀播报一抛, Plane.die 就地中断 —— 飞机 `alive=false` 却仍可见 = 用户在空机上
//   看到的"死而不隐"。这是**桩不忠实**(同 isMesh / setMatrixAt / clearGroups 那几处), 不是被测代码的问题。
Object.defineProperty(el,'firstChild',{get(){ if(el.children&&el.children.length) return el.children[0]; if(!el._fc) el._fc={textContent:'',remove(){}}; return el._fc; }});
// 真 DOM 的 lastChild 语义 (缺它时 addKillfeed 的 while 会抛 "reading 'remove'")
Object.defineProperty(el,'lastChild',{get(){ return (el.children&&el.children.length)?el.children[el.children.length-1]:null; }});
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
distanceTo(v){return Math.hypot(this.x-v.x,this.y-v.y,this.z-v.z);}distanceToSquared(v){return (this.x-v.x)**2+(this.y-v.y)**2+(this.z-v.z)**2;}
dot(v){return this.x*v.x+this.y*v.y+this.z*v.z;}crossVectors(a,b){this.x=a.y*b.z-a.z*b.y;this.y=a.z*b.x-a.x*b.z;this.z=a.x*b.y-a.y*b.x;return this;}
applyAxisAngle(){return this;}setFromMatrixColumn(){return this;}lerpVectors(){return this;}applyMatrix4(){return this;}project(){return this;}}
class Euler{constructor(){this.x=0;this.y=0;this.z=0;this.order='XYZ';}set(x,y,z,o){this.x=x;this.y=y;this.z=z;if(o)this.order=o;return this;}}
// ★ 2026-09-21: 补 isMesh/isPoints/isLine —— 真 THREE 的 Object3D 上这三个是类属性 (Mesh=true),
//   而本桩一直没给 ⇒ 所有靠 `o.isMesh` 判网格的**运行时**代码在沙箱里静默走空分支:
//   · 15d NavalCraft.beginDestroy 的残骸换材质 traverse(o=>{if(o.isMesh)…}) ⇒ 沙箱里残骸材质从不替换
//   · 15e navBuildModel 末尾的 castShadow 批量设置同理
//   · 本仓多个 dev 探针用 o.isMesh 统计网格数 ⇒ 会数出 0 件 (实测: 新验收脚本第①条据此报"网格=0")
//   在桩上补齐是**忠实化桩**, 不是改被测代码 (真浏览器里真 THREE 本来就有这三个字段)。
class Obj3{constructor(){this.position=new V3();this.rotation=new Euler();this.scale=new V3(1,1,1);this.quaternion={setFromUnitVectors(){return this;},copy(q){ this.x=q.x; this.y=q.y; this.z=q.z; this.w=(q.w!==undefined)?q.w:1; return this; },set(){return this;},setFromEuler(){return this;}};this.children=[];this.visible=true;this.castShadow=false;this.receiveShadow=false;this.renderOrder=0;this.matrix={};this.userData={};this.material=null;this.geometry=null;this.isObject3D=true;this.isMesh=false;this.isPoints=false;this.isLine=false;this.isSprite=false;this.isGroup=false;} // 2026-11-05: quaternion copy/set/setFromEuler added for flashlight cone (stub fidelity)
add(m){this.children.push(m);m.parent=this;return this;}
// remove 与真 THREE.Object3D.remove 同义: 摘出 children 且回置 m.parent=null (2026-10-05 车毁拆灯 T6 依赖该语义)
remove(m){const i=this.children.indexOf(m);if(i>=0){this.children.splice(i,1);m.parent=null;}}
traverse(fn){fn(this);for(const c of this.children)if(c&&c.traverse)c.traverse(fn);}
updateMatrix(){}
lookAt(){return this;}
clone(){const c=new this.constructor();if(this.geometry)c.geometry=this.geometry;if(this.material)c.material=this.material;c.position=new V3(this.position.x,this.position.y,this.position.z);c.rotation=new Euler();if(this.rotation.x||this.rotation.y||this.rotation.z)c.rotation.set(this.rotation.x,this.rotation.y,this.rotation.z);c.scale=new V3(this.scale.x,this.scale.y,this.scale.z);c.visible=this.visible;c.castShadow=this.castShadow;c.name=this.name;return c;}};
// ★ 2026-09-28: 补 groups/clearGroups/addGroup —— 真 THREE.BufferGeometry 上这三个是标配
//   (确切的语义: groups 是 [{start,count,materialIndex}], clearGroups 清空, addGroup 追加)。
//   15-vehicles 的行走机构 (tbBuilder.build / 旧 trackBoxPrep) 用 **原生 BufferGeometry** 自建履带带环,
//   末尾 `g.clearGroups(); g.addGroup(...)` 划材质段 —— 桩里没这两个方法 ⇒ 建第一台坦克就抛
//   "g.clearGroups is not a function", 整场世界构建中断 (实测: verify-tankai / verify-fixbatch-20260926
//   直接崩在 Tank 构造里; 其余全链探针只是把异常吞掉, 拿到的是**半建成的世界**)。
//   与 isMesh / setMatrixAt / lastChild 那几处同规: 这是**桩不忠实**, 不是被测代码的问题。
class Geo{constructor(...a){this.attributes={};this.parameters={};this.groups=[];}translate(){return this;}rotateX(){return this;}rotateY(){return this;}rotateZ(){return this;}setAttribute(n,a){this.attributes[n]=a;return this;}setIndex(){return this;}setFromPoints(){return this;}computeVertexNormals(){return this;}dispose(){}
clearGroups(){this.groups.length=0;return this;}
addGroup(start,count,materialIndex){this.groups.push({start,count,materialIndex:materialIndex||0});return this;}}
// 几何尺寸兜底: 真 THREE 每个几何都有 parameters + position 属性; 桩里非盒几何两样都没有 ⇒
//   任何"按几何算包围盒/按 position 数组取点"的代码会把它当 0 尺寸件 (实测: 新验收脚本据此把
//   艇长算成 20.83 而真值是 24.65 —— 差的就是非盒的艏楔/炮塔)。这里按参数补齐最小可用口径,
//   保证桩几何**量得出尺寸**, 与真 THREE 的"能算出包围盒"这一点同语义 (顶点数不追求与真几何一致)。
class Geo2 extends Geo{constructor(kind,params){super();this.type=kind;this.parameters=params||{};
const A=new Float32Array(24);
const xs=[-1,1,-1,1,-1,1,-1,1], ys=[-1,-1,1,1,-1,-1,1,1], zs=[-1,-1,-1,-1,1,1,1,1];
const hx=Math.abs(params&&params.hx||0.5), hy=Math.abs(params&&params.hy||0.5), hz=Math.abs(params&&params.hz||0.5);
for(let i=0;i<8;i++){ A[i*3]=xs[i]*hx; A[i*3+1]=ys[i]*hy; A[i*3+2]=zs[i]*hz; }
this.attributes.position={count:8,array:A,getX:i=>A[i*3],getY:i=>A[i*3+1],getZ:i=>A[i*3+2]};
}
boundingDims(){ const p=this.parameters; return {hx:Math.abs(p.hx||0.5),hy:Math.abs(p.hy||0.5),hz:Math.abs(p.hz||0.5)}; }}
class _BoxGeo2 extends Geo2{constructor(w=1,h=1,d=1){super('BoxGeometry',{width:w,height:h,depth:d,hx:w/2,hy:h/2,hz:d/2});}}
class _CylGeo2 extends Geo2{constructor(rt=1,rb=1,h=1,seg=8){super('CylinderGeometry',{radiusTop:rt,radiusBottom:rb,height:h,radialSegments:seg,hx:Math.max(Math.abs(rt),Math.abs(rb)),hy:h/2,hz:Math.max(Math.abs(rt),Math.abs(rb))});}}
class _SphereGeo2 extends Geo2{constructor(r=1,ws=8,hs=6){super('SphereGeometry',{radius:r,widthSegments:ws,heightSegments:hs,hx:r,hy:r,hz:r});}}
class _ConeGeo2 extends Geo2{constructor(r=1,h=1,seg=8){super('ConeGeometry',{radius:r,height:h,radialSegments:seg,hx:r,hy:h/2,hz:r});}}
class _TorusGeo2 extends Geo2{constructor(r=1,tube=0.4,rs=8,ts=6){super('TorusGeometry',{radius:r,tube:tube,radialSegments:rs,tubularSegments:ts,hx:r+tube,hy:tube,hz:r+tube});}}
class _CircleGeo2 extends Geo2{constructor(r=1,seg=8){super('CircleGeometry',{radius:r,segments:seg,hx:r,hy:0,hz:r});}}
class _RingGeo2 extends Geo2{constructor(ri=0.5,ro=1,seg=8){super('RingGeometry',{innerRadius:ri,outerRadius:ro,segments:seg,hx:ro,hy:0,hz:ro});}}
class _PlaneGeo extends Geo{constructor(w=1,h=1,sg=1,sh=1){super(w,h);const gx=(sg||1)+1,gy=(sh||1)+1;this.type='PlaneGeometry';this.parameters={width:w,height:h,widthSegments:sg,heightSegments:sh,hx:w/2,hy:0,hz:h/2};this.attributes.position={count:gx*gy,array:new Float32Array(gx*gy*3),getX:i=>((i%gx)/gx-0.5)*w,getZ:i=>(Math.floor(i/gx)/gy-0.5)*h,getY:()=>0,setY(){},setX(){},setZ(){}};}boundingDims(){return {hx:Math.abs(this.parameters.hx),hy:0,hz:Math.abs(this.parameters.hz)};}}
class BufAttr{constructor(a,n){this.array=a;this.itemSize=n;this.count=(a&&a.length)||0;}
set(){return this;}
getX(i){return (this.array&&this.array[i*this.itemSize])||0;}
getY(i){return (this.array&&this.array[i*this.itemSize+1])||0;}
getZ(i){return (this.array&&this.array[i*this.itemSize+2])||0;}
setX(i,v){if(this.array)this.array[i*this.itemSize]=v;}
setY(i,v){if(this.array)this.array[i*this.itemSize+1]=v;}
setZ(i,v){if(this.array)this.array[i*this.itemSize+2]=v;}}
class _Color{constructor(c){this.c=c!==undefined?c:0xffffff;}set(v){this.c=v;return this;}setHex(v){this.c=v;return this;}}
// ★2026-10-05 昼夜批: 夜档 02-scene 的 nightFogColor() 会真调 Color.lerp / 08-effects 断言读 getHex ⇒
// 桩补齐这两个方法 (原桩只有 set(); 缺 lerp 时 ironbottom 等强制夜档图的 LOAD 直接抛 TypeError)。
if(!_Color.prototype.getHex){
_Color.prototype.getHex=function(){ return typeof this.c==='number'?this.c:0; };
}
if(!_Color.prototype.lerp){
const _hex2rgb=h=>{ h=typeof h==='number'?h:parseInt(String(h).replace('#',''),16)||0; return [(h>>16)&255,(h>>8)&255,h&255]; };
_Color.prototype.lerp=function(target,a){
const c0=_hex2rgb(this.c), c1=_hex2rgb(target&&target.c!==undefined?target.c:target);
const mix=c0.map((v,i)=>Math.round(v+(c1[i]-v)*a));
this.c=(mix[0]<<16)|(mix[1]<<8)|mix[2];
return this;
};
}
const _wrapColor=c=>(c&&typeof c==='object'&&typeof c.set==='function')?c:new _Color(c);
const _mat=cls=>{ return class extends cls{constructor(o){super();Object.assign(this,o||{});this.color=_wrapColor(this.color);}}; };
class _Fog{constructor(c,n,f){this.color=new _Color(c);this.near=n;this.far=f;}}
class _FogExp2{constructor(c,d){this.color=new _Color(c);this.density=d;}}
const THREE={
WebGLRenderer:class{constructor(){this.domElement=Object.assign(mkElement('canvas'),{width:0,height:0});this.shadowMap={enabled:false,type:0,autoUpdate:true};this.setSize=()=>{};this.setPixelRatio=()=>{};this.render=()=>{};this.clear=()=>{};this.clearDepth=()=>{};this.outputColorSpace='';this.setClearColor=()=>{};this.setAnimationLoop=()=>{};this.domElement.addEventListener=()=>{};this.domElement.style={};}},
Scene:class extends Obj3{constructor(){super();this.background=null;this.fog=null;}},
PerspectiveCamera:class extends Obj3{constructor(){super();this.fov=70;this.near=0.1;this.far=1000;this.aspect=1;}updateProjectionMatrix(){}getWorldDirection(v){v.set(0,0,-1);return v;}},
Group:class extends Obj3{constructor(){super();this.isGroup=true;}},Mesh:class extends Obj3{constructor(g,m){super();this.geometry=g||new Geo();this.material=m||{};this.isMesh=true;}},
InstancedMesh:class extends Obj3{constructor(g,m,n){super();this.count=n||1;this.instanceMatrix={array:new Float32Array(16*(this.count||1)),needsUpdate:false};}
// ★ setMatrixAt 必须是**写入式**: 真 three.js 是写进 instanceMatrix.array, 不是替换整个对象。
//   旧桩写 `this.instanceMatrix={}` 会把数组抹掉 ⇒ 08-effects.queueSink 读 job.inst.im.instanceMatrix.array
//   得 undefined ⇒ `arr[i*16+13]` 抛 "Cannot read properties of undefined (reading '2157')"。
//   这是**桩不忠实造成的假故障**(2026-09-20 task-10 独立审计定案; 同链路的 verify-sink/verify-fire/probe-bots
//   等 20+ 个桩本来就是忠实写法), 与游戏代码无关。
setMatrixAt(i,mm){ if(!this.instanceMatrix||!this.instanceMatrix.array) this.instanceMatrix={array:new Float32Array(16*Math.max(1,this.count||0)),needsUpdate:false};
if(mm&&mm.elements&&this.instanceMatrix.array.length>=(i+1)*16) this.instanceMatrix.array.set(mm.elements,i*16); return this; }
setColorAt(){this.instanceColor=this.instanceColor||{needsUpdate:false};}},
Points:class extends Obj3{constructor(g,m){super();this.geometry=g;this.material=m;this.isPoints=true;}},
LineSegments:class extends Obj3{constructor(g,m){super();this.geometry=g;this.material=m;this.isLine=true;}},
Object3D:Obj3,Sprite:class extends Obj3{constructor(m){super();this.isSprite=true;this.material=m||{};if(!this.material.color)this.material.color={set(){}};}},
Vector2:class{constructor(x=0,y=0){this.x=x;this.y=y;}set(x,y){this.x=x;this.y=y;return this;}},
Vector3:V3,Vector4:V3,Euler:Euler,Quaternion:class{set(){return this;}setFromUnitVectors(){return this;}identity(){return this;}setFromEuler(){return this;}setFromAxisAngle(){return this;}premultiply(){return this;}},
Color:_Color,
Fog:_Fog,FogExp2:_FogExp2,
BoxGeometry:_BoxGeo2,CylinderGeometry:_CylGeo2,SphereGeometry:_SphereGeo2,ConeGeometry:_ConeGeo2,TorusGeometry:_TorusGeo2,RingGeometry:_RingGeo2,CircleGeometry:_CircleGeo2,PlaneGeometry:_PlaneGeo,
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
// ★2026-10-05 昼夜批: 灯类补形参存储 (原 PointLight 是裸 Obj3) + 新增 SpotLight。
// 夜档 08-effects 的 _hlPoolEnsure 真 SpotLight 池会 new THREE.SpotLight(...) 并调
// sl.target.updateMatrixWorld() —— 缺构造器/缺方法时 ironbottom(锁夜) 全链 LOAD/首帧即炸。
PointLight:class extends Obj3{constructor(c,i,d,dec){super();this.color=c;this.intensity=i||0;this.distance=d||0;this.decay=dec||1;this.castShadow=false;}},
SpotLight:class extends Obj3{constructor(c,i,d,a,p,dec){super();this.color=c;this.intensity=i||0;this.distance=d||0;this.angle=a||0;this.penumbra=p||0;this.decay=dec||1;this.castShadow=false;this.visible=true;this.target=new Obj3();this.target.updateMatrixWorld=()=>{};}},
Box3:class{setFromObject(){return this;}expandByObject(){return this;}},
Clock:class{getDelta(){return 0;}},
Matrix4:class{compose(){return this;}makeRotationFromEuler(){return this;}makeScale(){return this;}},
MathUtils:{clamp:(v,a,b)=>v<a?a:(v>b?b:v)},
RepeatWrapping:1000,DoubleSide:2,BackSide:1,FrontSide:0,SRGBColorSpace:'srgb',NoToneMapping:0,
PCFSoftShadowMap:2,PCFShadowMap:1,BasicShadowMap:0,NearestFilter:0,LinearFilter:1,
}
// ── 媒体/窗口桩 ──
const AC=class{
createOscillator(){return {frequency:{setValueAtTime(){},value:0},type:'',start(){},stop(){},connect(){},onended:null};}
createGain(){return {gain:{setValueAtTime(){},setTargetAtTime(){},value:0},connect(){},disconnect(){}};}
createBuffer(){return {getChannelData:()=>new Float32Array(16),duration:1,numberOfChannels:1};}
createBufferSource(){return {buffer:null,loop:false,playbackRate:{value:0,setValueAtTime(){}},start(){},stop(){},connect(){},onended:null};}
createBiquadFilter(){return {type:'',frequency:{value:0,setValueAtTime(){}},Q:{value:0},connect(){}};}
createDynamicsCompressor(){return {threshold:{value:0},ratio:{value:0},attack:{value:0},release:{value:0},connect(){}};}
createStereoPanner(){return {pan:{value:0},connect(){}};}
resume(){return Promise.resolve();}
get state(){return 'running';}
get destination(){return {};}
get currentTime(){return 0;}
get sampleRate(){return 44100;}
};
const window={addEventListener(){},removeEventListener(){},AudioContext:AC,webkitAudioContext:AC,CANNON:{Body:class{constructor(o){Object.assign(this,o||{});}},World:class{add(){this.bodies=this.bodies||[];}},Box:class{constructor(v){this.v=v;}},Sphere:class{},Vec3:V3,Material:class{},ContactMaterial:class{}},
};
let audioI=0;
const sandbox={
console,Math,JSON,performance:{now:()=>Date.now()},
location:{search:'?seed=42',reload(){},href:'http://localhost/'},
localStorage:{_s:{sf_campaign:'0'},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];},get length(){return Object.keys(this._s).length;},key(i){const a=Object.keys(this._s);return i<a.length?a[i]:null;}},
navigator:{},document,window,
requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},
setTimeout:(f,t)=>{return 0;},clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{},
devicePixelRatio:1,innerWidth:1280,innerHeight:720,addEventListener(){},removeEventListener(){},
AudioContext:class{createOscillator(){return {frequency:{setValueAtTime(){},value:0},type:'',start(){},stop(){},connect(){},onended:null};}
createGain(){return {gain:{setValueAtTime(){},setTargetAtTime(){},value:0},connect(){},disconnect(){}};}
createBuffer(){return {getChannelData:()=>new Float32Array(16),duration:1,numberOfChannels:1};}
createBufferSource(){return {buffer:null,loop:false,playbackRate:{value:0,setValueAtTime(){}},start(){},stop(){},connect(){},onended:null};}
createBiquadFilter(){return {type:'',frequency:{value:0,setValueAtTime(){}},Q:{value:0},connect(){}};}
createDynamicsCompressor(){return {threshold:{value:0},ratio:{value:0},attack:{value:0},release:{value:0},connect(){}};}
createStereoPanner(){return {pan:{value:0},connect(){}};}
resume(){return Promise.resolve();}
get state(){return 'running';}
get destination(){return {};}
get currentTime(){return 0;}
get sampleRate(){return 44100;}},
};
sandbox.globalThis=sandbox;
sandbox.THREE=THREE;
sandbox.window=window;
module.exports={THREE,document,window,sandbox,mkElement,byId};
