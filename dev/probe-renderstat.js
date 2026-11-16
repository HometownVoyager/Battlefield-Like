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
// dev/probe-renderstat.js —— 渲染规模探针 (2026-10-24 性能排查批)
// 用法: node dev/probe-renderstat.js [战役序号|all] [night]
// 统计: 场景图 mesh/sprite/instanced 数 · castShadow 投射者 · 材质去重数 · 灯池(可见/隐藏, 分类型)
//       夜间装备链 nightGearTick 一轮后的灯池全量 (雨天白天 isDarkEnvironment 同链)。
// 目的: 量化 draw call 基数与灯数, 为光照/渲染优化提供数据。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');

// ── 复用 verify-boot 的桩环境 (同一份拷贝, 保持独立可跑) ──
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
querySelectorAll:()=>[],body:mkElement('body'),head:mkElement('head'),
addEventListener(){},removeEventListener(){},hidden:false,pointerLockElement:null,exitPointerLock(){},
};
class V3{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}setScalar(s){this.x=s;this.y=s;this.z=s;return this;}
copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;}clone(){return new V3(this.x,this.y,this.z);}
add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;}sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this;}
addScaledVector(v,s){this.x+=v.x*s;this.y+=v.y*s;this.z+=v.z*s;return this;}
multiplyScalar(s){this.x*=s;this.y*=s;this.z*=s;return this;}
normalize(){const l=Math.hypot(this.x,this.y,this.z)||1;this.x/=l;this.y/=l;this.z/=l;return this;}
length(){return Math.hypot(this.x,this.y,this.z);}lengthSq(){return (this.x-v.x)**2+(this.y-v.y)**2+(this.z-v.z)**2;}
distanceTo(v){return Math.hypot(this.x-v.x,this.y-v.y,this.z-v.z);}
distanceToSquared(v){return (this.x-v.x)**2+(this.y-v.y)**2+(this.z-v.z)**2;}
dot(v){return this.x*v.x+this.y*v.y+this.z*v.z;}crossVectors(a,b){this.x=a.y*b.z-a.z*b.y;this.y=a.z*b.x-a.x*b.z;this.z=a.x*b.y-a.y*b.x;return this;}
applyAxisAngle(){return this;}setFromMatrixColumn(){return this;}lerpVectors(){return this;}}
class Euler{constructor(){this.x=0;this.y=0;this.z=0;this.order='XYZ';}set(x,y,z,o){this.x=x;this.y=y;this.z=z;if(o)this.order=o;return this;}}
class Obj3{constructor(){this.position=new V3();this.rotation=new Euler();this.scale=new V3(1,1,1);this.quaternion={setFromUnitVectors(){return this;}};this.children=[];this.visible=true;this.castShadow=false;this.receiveShadow=false;this.renderOrder=0;this.matrix={};this.userData={};this.material=null;this.geometry=null;}
add(m){this.children.push(m);m.parent=this;return this;}remove(m){const i=this.children.indexOf(m);if(i>=0)this.children.splice(i,1);}
traverse(fn){fn(this);for(const c of this.children)if(c&&c.traverse)c.traverse(fn);}
updateMatrix(){}lookAt(){return this;}
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
class _Color{constructor(c){this.c=c;}set(){return this;}
lerp(t,a){ const _p=h=>{h=typeof h==='number'?h:0;return [(h>>16)&255,(h>>8)&255,h&255];};
const c0=_p(this.c), c1=_p(t&&t.c!==undefined?t.c:t);
const mix=c0.map((v,i)=>Math.round(v+(c1[i]-v)*a)); this.c=(mix[0]<<16)|(mix[1]<<8)|mix[2]; return this; }
getHex(){ return typeof this.c==='number'?this.c:0; }}
const _wrapColor=c=>(typeof c==='number'||typeof c==='string')?{set(v){this.v=v;}}:(c&&typeof c==='object')?c:{set(){}};
const _mat=cls=>{ return class extends cls{constructor(o){super();Object.assign(this,o||{});this.color=_wrapColor(this.color);}}; };
class _Fog{constructor(c,n,f){this.color=new _Color(c);this.near=n;this.far=f;}}
class _FogExp2{constructor(c,d){this.color=new _Color(c);this.density=d;}}
const THREE={
WebGLRenderer:class{constructor(){this.domElement=Object.assign(mkElement('canvas'),{width:0,height:0});this.shadowMap={enabled:false,type:0,autoUpdate:true};this.setSize=()=>{};this.setPixelRatio=()=>{};this.render=()=>{};this.clear=()=>{};this.clearDepth=()=>{};this.outputColorSpace='';this.setClearColor=()=>{};this.setAnimationLoop=()=>{};this.domElement.addEventListener=()=>{};this.domElement.style={};this.toneMappingExposure=1;}},
Scene:class extends Obj3{constructor(){super();this.background=null;this.fog=null;}},
PerspectiveCamera:class extends Obj3{constructor(){super();this.fov=70;this.near=0.1;this.far=1000;this.aspect=1;}updateProjectionMatrix(){}getWorldDirection(v){v.set(0,0,-1);return v;}},
Group:class extends Obj3{},Mesh:class extends Obj3{constructor(g,m){super();this.geometry=g||new Geo();this.material=m||{};}},
InstancedMesh:class extends Obj3{constructor(g,m,n){super();this.geometry=g||new Geo();this.material=m||{};this.count=n;}setMatrixAt(){this.instanceMatrix={};}setColorAt(){this.instanceColor=this.instanceColor||{needsUpdate:false};}},
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
LineBasicMaterial:_mat(class{constructor(o){Object.assign(this,o||{});}}),
CanvasTexture:class{constructor(c){this.image=c;this.repeat=new V3(1,1,1);this.offset=new V3(1,1,1);this.needsUpdate=false;}clone(){return new THREE.CanvasTexture(this.image);}dispose(){}},
Texture:class{constructor(){this.repeat=new V3(1,1,1);this.offset=new V3(1,1,1);this.wrapS=0;this.wrapT=0;this.needsUpdate=false;}clone(){return new THREE.Texture();}},
DirectionalLight:class extends Obj3{constructor(c,i){super();this.intensity=i?i:1;this.color=new _Color(c);this.target=new Obj3();this.shadow={mapSize:new V3(1,1,1),bias:0,camera:{updateProjectionMatrix(){},left:0,right:0,top:0,bottom:0,far:0,near:0}} } },
AmbientLight:class extends Obj3{constructor(c,i){super();this.intensity=i;this.color=new Color(c);}},
HemisphereLight:class extends Obj3{constructor(a,b,i){super();this.intensity=i;}},
PointLight:class extends Obj3{constructor(c,i,d,dec){super();this.color=new _Color(c);this.intensity=i||0;this.distance=d||0;this.decay=dec||1;}},
SpotLight:class extends Obj3{constructor(c,i,d,a,p,dec){super();this.color=new _Color(c);this.intensity=i||0;this.distance=d||0;this.angle=a||0;this.penumbra=p||0;this.decay=dec||1;this.castShadow=false;this.target=new Obj3();}},
Box3:class{setFromObject(){return this;}expandByObject(){return this;}},
Clock:class{getDelta(){return 0;}},
Matrix4:class{compose(){return this;}makeRotationFromEuler(){return this;}makeScale(){return this;}},
MathUtils:{clamp:(v,a,b)=>v<a?a:(v>b?b:v)},
RepeatWrapping:1000,DoubleSide:2,BackSide:1,FrontSide:0,SRGBColorSpace:'srgb',NoToneMapping:0,
PCFSoftShadowMap:2,PCFShadowMap:1,BasicShadowMap:0,NearestFilter:0,LinearFilter:1,
};
const AC=class{
createOscillator(){return {frequency:{setValueAtTime(){},value:0},type:'',start(){},stop(){},connect(){},onended:null};}
createGain(){return {gain:{setValueAtTime(){},setTargetAtTime(){},value:0},connect(){},disconnect(){}};}
createBuffer(){return {getChannelData:()=>new Float32Array(16),duration:1,numberOfChannels:1};}
createBufferSource(){return {buffer:null,loop:false,playbackRate:{value:0,setValueAtTime(){}},start(){},stop(){},connect(){},disconnect(){}};}
createBiquadFilter(){return {type:'',frequency:{value:0,setValueAtTime(){}},Q:{value:0},connect(){},disconnect(){}};}
createDynamicsCompressor(){return {threshold:{value:0},ratio:{value:0},attack:{value:0},release:{value:0},connect(){},disconnect(){}};}
createStereoPanner(){return {pan:{value:0},connect(){},disconnect(){}};}
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
localStorage:{_s:{},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}},
navigator:{},document,window,
requestAnimationFrame:()=>0,cancelAnimationFrame:()=>0,
setTimeout:(f,t)=>0,clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{},
devicePixelRatio:1,innerWidth:1280,innerHeight:720,addEventListener(){},removeEventListener(){},
AudioContext:AC,
};
sandbox.globalThis=sandbox;
sandbox.THREE=THREE;
function load(ctx,file){ vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file}); }
function boot(campIdx,night){
const byIdx={};for(const k in byId)delete byId[k];
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document;ctx.window=window;
ctx.localStorage={_s:Object.assign({sf_campaign:String(campIdx)},night?{sf_daynight:'night'}:{},process.env.SF_PSEED?{sf_pseed:process.env.SF_PSEED}:{}),getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
const files=['js/00-config.js','js/00b-i18n.js','js/00c-procgen.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/22a-menuart.js','js/22b-speclayer.js','js/23-deploy.js','js/23b-worldrestore.js','js/25-zombies.js','js/24-main.js'];
for(const f of files) load(ctx,f);
return ctx;
}

const argIdx=process.argv[2]||'0';
const wantNight=process.argv.includes('night');
const ctx0=boot(0,false);
const total=vm.runInContext('CAMPAIGNS.length',ctx0);
const list=argIdx==='all'?Array.from({length:total},(_,k)=>k):[Math.max(0,Math.min(total-1,parseInt(argIdx)||0))];

for(const i of list){
let ctx;
try{ ctx=boot(i,wantNight); }catch(e){ console.log(`#${i} BOOT FAIL:`,String(e&&e.stack||e).split('\n')[0]); continue; }
let started=null;
try{
started=vm.runInContext(`(()=>{
try{ const btn=document.getElementById('startBtn'); if(btn&&btn.onclick) btn.onclick(); else return {ok:false,err:'no onclick'}; return {ok:true,id:CAMPAIGN.id,mode:CAMPAIGN.mode}; }
catch(e){ return {ok:false,err:String(e&&e.stack||e).split('\\n').slice(0,3).join(' | ')}; }})()`,ctx);
}catch(e){ started={ok:false,err:String(e)}; }
if(!started||!started.ok){ console.log(`#${i} startGame FAIL:`,JSON.stringify(started)); continue; }

const stat=vm.runInContext(`(()=>{
function scan(root){
const r={mesh:0,meshVis:0,sprite:0,spriteVis:0,inst:0,instVis:0,points:0,lines:0,cast:0,castVis:0,recv:0,mats:new Set(),lights:{},lightsVis:{},byMatTop:[]};
const matCount=new Map();
root.traverse(o=>{
const T=THREE;
const vis=o.visible!==false;
if(o instanceof T.Mesh){
r.mesh++; if(vis)r.meshVis++;
if(o.castShadow){r.cast++; if(vis)r.castVis++;}
if(o.receiveShadow)r.recv++;
const mm=Array.isArray(o.material)?o.material:[o.material];
for(const m of mm){ if(m){ r.mats.add(m); matCount.set(m,(matCount.get(m)||0)+1); } }
}else if(o instanceof T.InstancedMesh){
r.inst++; if(vis)r.instVis++;
if(o.castShadow){r.cast++; if(vis)r.castVis++;}
if(o.material){ r.mats.add(o.material); matCount.set(o.material,(matCount.get(o.material)||0)+1); }
}else if(o instanceof T.Sprite){ r.sprite++; if(vis)r.spriteVis++; if(o.material)r.mats.add(o.material); }
else if(o instanceof T.Points){ r.points++; if(vis)r.points++; }
else if(o instanceof T.LineSegments){ r.lines++; }
if(o instanceof T.PointLight||o instanceof T.SpotLight||o instanceof T.DirectionalLight||o instanceof T.HemisphereLight||o instanceof T.AmbientLight){
const k=o.constructor.name; r.lights[k]=(r.lights[k]||0)+1; if(vis)r.lightsVis[k]=(r.lightsVis[k]||0)+1; }
});
r.matN=r.mats.size;
r.byMatTop=[...matCount.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([m,n])=>({mat:(m.map&&m.map.image&&m.map.image.width?m.map.image.width+'px':'')+':'+(m.color&&m.color.c!==undefined?('#'+m.color.c.toString(16)):'')+(m.transparent?'T':''),n}));
return r;
}
return {main:scan(scene),vm:scan(vmScene),nightMode:!!NIGHT_MODE,dark:isDarkEnvironment(),weather:WX_CFG.id||WX_CFG.name||BOOT_WEATHER};
})()`,ctx);
console.log(`\n#${i} ${started.id} [${started.mode}] night=${stat.nightMode} dark=${stat.dark} weather=${stat.weather}`);
console.log(`  主场景: mesh=${stat.main.mesh}(vis ${stat.main.meshVis}) sprite=${stat.main.sprite}(vis ${stat.main.spriteVis}) inst=${stat.main.inst} points=${stat.main.points} lines=${stat.main.lines}`);
console.log(`  阴影: castShadow=${stat.main.cast}(vis ${stat.main.castVis}) receiveShadow=${stat.main.recv}`);
console.log(`  材质去重=${stat.main.matN}  灯:`,JSON.stringify(stat.main.lights),'可见:',JSON.stringify(stat.main.lightsVis));
console.log(`  vm场景: mesh=${stat.vm.mesh} 灯:`,JSON.stringify(stat.vm.lights));

// 夜间装备链一轮 (materialize 灯池)
if(!wantNight){
try{
vm.runInContext(`try{ nightGearTick(0.016); }catch(e){ globalThis.__ngErr=String(e&&e.stack||e).split('\\n').slice(0,2).join(' | '); }`,ctx);
const ng=vm.runInContext(`(globalThis.__ngErr)?{err:globalThis.__ngErr}:{lights:(()=>{const l={},lv={};scene.traverse(o=>{const T=THREE;if(o instanceof T.PointLight||o instanceof T.SpotLight||o instanceof T.DirectionalLight||o instanceof T.HemisphereLight){const k=o.constructor.name;l[k]=(l[k]||0)+1;if(o.visible!==false)lv[k]=(lv[k]||0)+1;}});return{l,lv};})()}`,ctx);
if(ng.err) console.log('  nightGearTick ERR:',ng.err);
else console.log('  nightGearTick 后 灯:',JSON.stringify(ng.lights.l),'可见:',JSON.stringify(ng.lights.lv));
}catch(e){ console.log('  nightGearTick 调用失败:',String(e).split('\n')[0]); }
}
}
