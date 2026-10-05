// ─────────────────────────────────────────────
// dev/probe-spawn.js —— Bot 出生/卡房 诊断探针 (只读, 不进 Index.html)
// 用法: node dev/probe-spawn.js [战役序号] [推演秒数]
// 报告:
//   ①开局出生点分布 (每队): 最大簇人数 / 簇内最近邻距 / 各落点计数
//   ②开局出生点是否落在"可达空间" —— NAV 5m 格 + A* 到敌方强点能否出路径
//   ③推演后"卡死"统计: 连续 N 秒位移<0.5m 且 A* 无路/目标远, 并给出所在建筑足迹/B_FOOT
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
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
// ★2026-09-26E 桩保真: 旧桩 setIndex 是空操作 (吞掉 index) —— 与真 three 不符: 05c 海面网格要按 index
//   剔掉全在陆上的三角形, 探针也要读三角形做"网格 vs 判定"判据。现按真语义存 {array,count}。
class Geo{constructor(...a){this.attributes={};this.parameters={};}translate(){return this;}rotateX(){return this;}rotateY(){return this;}rotateZ(){return this;}setAttribute(n,a){this.attributes[n]=a;return this;}setIndex(a){this.index={array:(a&&a.array)?a.array:a,count:(a&&a.array)?a.array.length:(a?a.length:0)};return this;}setFromPoints(){return this;}computeVertexNormals(){return this;}dispose(){}}
class _PlaneGeo extends Geo{constructor(w=1,h=1,sg=1,sh=1){super(w,h);const gx=(sg||1)+1,gy=(sh||1)+1;this.attributes.position={count:gx*gy,array:new Float32Array(gx*gy*3),getX:i=>((i%gx)/gx-0.5)*w,getZ:i=>(Math.floor(i/gx)/gy-0.5)*h,getY:()=>0,setY(){},setX(){},setZ(){}};}}
class BufAttr{constructor(a,n){this.array=a;this.itemSize=n||1;this.count=(a&&a.length)?(a.length/(n||1)):0;} // ★2026-09-26E 桩保真: count 旧桩取数组长度, 真 three 是 length/itemSize (差 itemSize 倍 ⇒ 探针按 count 遍历会越界读 undefined)
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
function boot(campIdx,seed){
const byIdx={};for(const k in byId)delete byId[k];
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document;ctx.window=window;
ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
const files=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15g-capmodels.js','js/15h-capital.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/23-deploy.js','js/24-main.js'];
for(const f of files) load(ctx,f);
return ctx;
}
const STEP_FN=`(()=>{
const DTS=[1/60,1/30,1/20];
return function step(frames,collect){
let t0=nowT;
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
updateShells(dt); updateNades(dt); updateFlags(dt);
if(collect) collect(dt);
}
return nowT-t0;
};
})()`;

// 建筑足迹内判定 (含少量外扩: 门口也算"房内附近")
function insideFootprint(line,pad){
const m=line.match(/\((-?[\d.]+),(-?[\d.]+)\)[^)]*?w=([\d.]+)[^)]*?d=([\d.]+)/);
return m?{x:+m[1],z:+m[2],w:+m[3],d:+m[4]}:null;
}

const STATS_FN=(secs)=>`(()=>{
try{
const st={setPath:0,pathOK:0,pathNull:0,budgetSkip:0,decide:0};
const _sp=Bot.prototype.setPathTo;
Bot.prototype.setPathTo=function(x,z){
st.setPath++;
if(NAV.budget<=0) st.budgetSkip++;
const r=_sp.call(this,x,z);
if(this.path) st.pathOK++; else st.pathNull++;
return r;
};
const _dc=Bot.prototype.decide;
Bot.prototype.decide=function(){ st.decide++; return _dc.call(this); };
const noPath=new Array(soldiers.length).fill(0), objNoMove=new Array(soldiers.length).fill(0);
const lastP=soldiers.map(b=>b.pos.clone());
const samples=[];
let acc=0;
const collect=(dt)=>{
acc+=dt;
for(let k=0;k<soldiers.length;k++){
const b=soldiers[k];
if(!b.alive){ noPath[k]=0; objNoMove[k]=0; lastP[k]=b.pos.clone(); continue; }
if(!b.path&&b.objective&&(b.state==='advance'||b.state==='hunt'||b.state==='toVehicle')) noPath[k]+=dt; else noPath[k]=0;
const d=Math.hypot(b.pos.x-lastP[k].x,b.pos.z-lastP[k].z);
lastP[k]=b.pos.clone();
if(b.objective&&d<0.02) objNoMove[k]+=dt; else objNoMove[k]=0;
}
if(acc>=5){ acc=0;
const alive=soldiers.filter(b=>b.alive);
const idle=alive.filter(b=>b.state==='idle').length;
const def=alive.filter(b=>b.state==='defend').length;
const adv=alive.filter(b=>b.state==='advance').length;
const noP=alive.filter(b=>!b.path).length;
// 每队重心到敌基地距离
const cen=[0,1].map(t=>{ const l=alive.filter(b=>b.team===t); if(!l.length) return null;
return {n:l.length,cx:+(l.reduce((a,b)=>a+b.pos.x,0)/l.length).toFixed(0),cz:+(l.reduce((a,b)=>a+b.pos.z,0)/l.length).toFixed(0),
dEnemyBase:+(l.reduce((a,b)=>a+Math.hypot(b.pos.x-BASES[1-t].x,b.pos.z-BASES[1-t].z),0)/l.length).toFixed(0),
dOwnBase:+(l.reduce((a,b)=>a+Math.hypot(b.pos.x-BASES[t].x,b.pos.z-BASES[t].z),0)/l.length).toFixed(0)}; });
samples.push({t:+nowT.toFixed(0),alive:alive.length,idle,def,adv,noP,cen});
}
};
__step(${secs}*60,collect);
return {ok:true,st,samples};
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`;

const REPORT_FN=(runSec,minNeighbor)=>`(()=>{
try{
const out={};
out.camp=CAMPAIGN.id; out.mode=GAMEMODE; out.map=MAP_SIZE;
out.bases=BASES.map(b=>({x:+b.x.toFixed(1),z:+b.z.toFixed(1)}));
out.spawns=(CAMPAIGN.spawns||[]).map(s=>({x:s.x,z:s.z,team:s.team}));
out.botN=soldiers.length;
// ① 开局出生分布 (此刻还没推演)
const snap=[];
for(const b of soldiers){
snap.push({n:b.name,t:b.team,x:+b.pos.x.toFixed(2),z:+b.pos.z.toFixed(2),y:+b.pos.y.toFixed(2),
occ:occBlocked(b.pos.x,b.pos.z)?1:0, inFoot:!freeSpot(b.pos.x,b.pos.z,0.05)?1:0});
}
out.spawnSnap=snap;
// 簇: 单链聚类, 阈值 minNeighbor
const clusterOf=(team)=>{
const list=snap.filter(s=>s.t===team), used=new Array(list.length).fill(false), cl=[];
for(let i=0;i<list.length;i++){
if(used[i])continue;
const q=[i]; used[i]=true; const g=[list[i]];
while(q.length){
const k=q.pop();
for(let j=0;j<list.length;j++){
if(used[j])continue;
if(Math.hypot(list[j].x-list[k].x,list[j].z-list[k].z)<${minNeighbor}){ used[j]=true; q.push(j); g.push(list[j]); }
}
}
cl.push(g);
}
let mx=null,mn=0;
for(const g of cl){ let s=0; for(const p of g) s+=Math.hypot(p.x-BASES[team]?0:0,0); if(g.length>mn){mn=g.length;mx=g;} }
// 到基地距离分布
const ds=list.map(s=>+Math.hypot(s.x-BASES[team].x,s.z-BASES[team].z).toFixed(1));
return {n:list.length,clusters:cl.length,maxCluster:mn,maxClusterPts:mx?mx.map(p=>p.n+'('+p.x+','+p.z+')'):[],
dsMin:Math.min(...ds),dsMax:Math.max(...ds),dsAvg:+(ds.reduce((a,b)=>a+b,0)/(ds.length||1)).toFixed(1)};
};
out.cluster0=clusterOf(0); out.cluster1=clusterOf(1);
// ② 出生点可达性: A* 到敌方基地
out.reach=[];
for(const b of soldiers){
const eb=BASES[1-b.team];
const p=NAV.findPath(b.pos.x,b.pos.z,eb.x,eb.z);
out.reach.push({n:b.name,ok:p?1:0,len:p?p.length:0,occ:occBlocked(b.pos.x,b.pos.z)?1:0,foot:!freeSpot(b.pos.x,b.pos.z,0.05)?1:0});
}
out.reachFail=out.reach.filter(r=>!r.ok).length;
out.occAtSpawn=out.reach.filter(r=>r.occ).length;
out.footAtSpawn=out.reach.filter(r=>r.foot).length;
return out;
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`;

const RUN_FN=(secs,minNeighbor,stuckSec)=>`(()=>{
try{
// ① 全程出生落点跟踪 (挂钩 Bot.prototype.spawn, 不依赖"恰好在第 0 帧看分布")
const landings=[];
const _spawn=Bot.prototype.spawn;
Bot.prototype.spawn=function(){
const r=_spawn.apply(this,arguments);
landings.push({n:this.name,t:this.team,tm:+nowT.toFixed(1),x:+this.pos.x.toFixed(2),z:+this.pos.z.toFixed(2),
occ:occBlocked(this.pos.x,this.pos.z)?1:0, inFoot:!freeSpot(this.pos.x,this.pos.z,0.9)?1:0, onV:!!this.onVehicle});
return r;
};
const stuck=new Array(soldiers.length).fill(0);
const lastP=soldiers.map(b=>b.pos.clone());
const moved=soldiers.map(()=>0);
const rec=[];
const samples=[];
const MOVE_STATES={advance:1,hunt:1,toVehicle:1};
let acc=0;
const clusterStats=()=>{
const alive=soldiers.filter(b=>b.alive&&!b.onVehicle);
let nnSum=0, nnN=0;
for(const a of alive){
let best=1e9;
for(const c of alive){ if(c===a) continue; const d=Math.hypot(a.pos.x-c.pos.x,a.pos.z-c.pos.z); if(d<best) best=d; }
if(best<1e8){ nnSum+=best; nnN++; }
}
// 最大簇 (单链聚类: BFS 展开, 阈值 = 点位拥挤半径)
const used=new Array(alive.length).fill(false); let clMax=0;
for(let i=0;i<alive.length;i++){
if(used[i]) continue;
const q=[i]; used[i]=true; let cnt=1;
while(q.length){
const k=q.pop();
for(let j=0;j<alive.length;j++){
if(used[j]) continue;
if(Math.hypot(alive[j].pos.x-alive[k].pos.x,alive[j].pos.z-alive[k].pos.z)<${minNeighbor}){ used[j]=true; q.push(j); cnt++; }
}
}
if(cnt>clMax) clMax=cnt;
}
return {n:alive.length,clMax,meanNN:nnN?+(nnSum/nnN).toFixed(2):-1};
};
const collect=(dt)=>{
acc+=dt;
for(let k=0;k<soldiers.length;k++){
const b=soldiers[k];
if(!b.alive){ stuck[k]=0; lastP[k]=b.pos.clone(); moved[k]=0; continue; }
const d=Math.hypot(b.pos.x-lastP[k].x,b.pos.z-lastP[k].z);
moved[k]+=d;
lastP[k]=b.pos.clone();
stuck[k]=d<0.02?stuck[k]+dt:0;
const wantMove=b.state==='advance'||b.state==='hunt'||b.state==='toVehicle'||(b.state==='combat'&&b.man==='push');
if(stuck[k]>${stuckSec}&&wantMove&&!b.onVehicle&&rec.length<60&&!rec.some(r=>r.n===b.name)){
const pathAhead=b.path?b.path.length-b.pathI:0;
const p2=NAV.findPath(b.pos.x,b.pos.z,BASES[1-b.team].x,BASES[1-b.team].z);
// 建筑足迹: 找包含该点的 B_FOOT 矩形 (列出最近 3 个)
const near=[];
for(const f of B_FOOT){
const dx=Math.max(f.x0-b.pos.x,0,b.pos.x-f.x1), dz=Math.max(f.z0-b.pos.z,0,b.pos.z-f.z1);
const dd=Math.hypot(dx,dz);
if(dd<6) near.push({dd:+dd.toFixed(2),x0:+f.x0.toFixed(1),x1:+f.x1.toFixed(1),z0:+f.z0.toFixed(1),z1:+f.z1.toFixed(1)});
}
near.sort((a,b)=>a.dd-b.dd);
// 头顶遮蔽 (室内判定)
const shel=!!raycastWorld(V3(b.pos.x,b.pos.y+1.6,b.pos.z),V3(0,1,0),12);
rec.push({n:b.name,t:b.team,tm:+nowT.toFixed(0),x:+b.pos.x.toFixed(1),z:+b.pos.z.toFixed(1),
y:+b.pos.y.toFixed(2),
state:b.state,man:b.man||'',path:b.path?b.pathI+'/'+b.path.length:'-',pathAhead,
occ:occBlocked(b.pos.x,b.pos.z)?1:0, inFoot:!freeSpot(b.pos.x,b.pos.z,0.05)?1:0, indoor:shel?1:0,
astarToBaseEnemy:p2?1:0, dBase:+Math.hypot(b.pos.x-BASES[b.team].x,b.pos.z-BASES[b.team].z).toFixed(1),
obj:b.objective?b.objective.id:'-',objD:b.objective?+Math.hypot(b.pos.x-b.objective.x,b.pos.z-b.objective.z).toFixed(1):-1,
objR:b.objective?b.objective.r:-1,
decT:+b.decisionT.toFixed(2),repT:+b.repathT.toFixed(2),sq:!!b.inSquad,onV:!!b.onVehicle,
tgt:b.target?1:0,lastSeen:+(nowT-b.lastSeenT).toFixed(1),
uns:+b.unstickT.toFixed(2),sup:+b.suppression.toFixed(2),hp:Math.round(b.hp),
nearFoot:near.slice(0,3)});
}
}
if(acc>=10){ acc=0; samples.push(Object.assign({t:Math.round(nowT)},clusterStats(),{alive:soldiers.filter(b=>b.alive).length,onV:soldiers.filter(b=>b.alive&&b.onVehicle).length,idle:soldiers.filter(b=>b.alive&&b.state==='idle').length})); }
};
__step(${secs}*60,collect);
const alive=soldiers.filter(b=>b.alive);
const nn=[];
for(const a of alive){
let best=1e9;
for(const c of alive){ if(c===a)continue; const d=Math.hypot(a.pos.x-c.pos.x,a.pos.z-c.pos.z); if(d<best)best=d; }
if(best<1e8) nn.push(best);
}
const meanNN=nn.length?+(nn.reduce((a,b)=>a+b,0)/nn.length).toFixed(2):-1;
const spread=[0,1].map(t=>{
const list=alive.filter(b=>b.team===t);
if(!list.length) return 0;
const cx=list.reduce((a,b)=>a+b.pos.x,0)/list.length, cz=list.reduce((a,b)=>a+b.pos.z,0)/list.length;
const r=Math.sqrt(list.reduce((a,b)=>a+(b.pos.x-cx)**2+(b.pos.z-cz)**2,0)/list.length);
return +r.toFixed(1);
});
// 落点质量统计
const landingStats=(team)=>{
const L=landings.filter(l=>l.t===team);
if(!L.length) return null;
const occ=L.filter(l=>l.occ).length, foot=L.filter(l=>l.inFoot).length, onV=L.filter(l=>l.onV).length;
// 落点最近邻 (同队, 同一时刻 2s 窗口内的其它落点)
let nnSum=0,nnN=0,minNN=1e9;
for(let i=0;i<L.length;i++)for(let j=i+1;j<L.length;j++){
if(Math.abs(L[i].tm-L[j].tm)>2) continue;
const d=Math.hypot(L[i].x-L[j].x,L[i].z-L[j].z);
if(d<minNN) minNN=d;
nnSum+=d; nnN++;
}
return {n:L.length,occ,foot,onV,minNN:minNN<1e8?+minNN.toFixed(2):-1,meanNN:nnN?+(nnSum/nnN).toFixed(2):-1};
};
return {ok:true,alive:alive.length,stuckRec:rec,meanNN,spread,samples,landings,land0:landingStats(0),land1:landingStats(1),
indoor:alive.filter(b=>raycastWorld(V3(b.pos.x,b.pos.y+1.6,b.pos.z),V3(0,1,0),12)).length,
occN:alive.filter(b=>occBlocked(b.pos.x,b.pos.z)).length,
footN:alive.filter(b=>!freeSpot(b.pos.x,b.pos.z,0.05)).length};
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`;

const idx=process.argv[2]!==undefined?parseInt(process.argv[2]):0;
const secs=process.argv[3]!==undefined?parseFloat(process.argv[3]):40;
const minN=6, stuckSec=3;
const t0=Date.now();
const ctx=boot(idx);
const start=vm.runInContext(`(()=>{try{const btn=document.getElementById('startBtn'); if(btn&&btn.onclick){btn.onclick();return {ok:true};} return {ok:false,err:'no btn'};}catch(e){return {ok:false,err:String(e&&e.stack||e)};}})()`,ctx);
if(!start.ok){ console.log('开局失败',JSON.stringify(start)); process.exit(1); }
const rep=vm.runInContext(REPORT_FN(secs,minN),ctx);
console.log('=== #'+idx+' '+rep.camp+' ('+rep.mode+') map='+rep.map+' bot='+rep.botN+' ===');
console.log('BASES',JSON.stringify(rep.bases));
console.log('CAMPAIGN.spawns',JSON.stringify(rep.spawns));
console.log('-- 开局出生点 --');
for(const t of [0,1]) console.log(' team'+t+': '+JSON.stringify(rep.cluster0&&t===0?rep.cluster0:rep.cluster1));
console.log(' 出生点落占用格='+rep.occAtSpawn+' 落建筑足迹='+rep.footAtSpawn+' A*无路='+rep.reachFail+'/'+rep.reach.length);
const inFoot=rep.spawnSnap.filter(s=>s.inFoot);
if(inFoot.length) console.log(' 出生在建筑足迹内: '+inFoot.map(s=>s.n+'('+s.x+','+s.z+')').join(' '));
ctx.__step=vm.runInContext(STEP_FN,ctx);
const r=vm.runInContext(RUN_FN(secs,minN,stuckSec),ctx);
console.log('-- 推演 '+secs+'s 后 (wall '+(Date.now()-t0)+'ms) --');
if(r.err){ console.log('RUN ERR',r.err); process.exit(1); }
console.log('存活='+r.alive+' 平均最近邻距='+r.meanNN+' 队散布 r='+JSON.stringify(r.spread)+' 室内='+r.indoor+' 占格='+r.occN+' 足迹内='+r.footN+' A*无路='+r.reachFailNow);
console.log('-- 卡死 (>'+stuckSec+'s 位移<2cm) 快照 '+r.stuckRec.length+' --');
for(const s of r.stuckRec) console.log('  '+JSON.stringify(s));
console.log('-- 全程出生落点 (挂钩 Bot.spawn) --');
for(const t of [0,1]){
const L=t===0?r.land0:r.land1;
console.log(' team'+t+': '+JSON.stringify(L));
}
console.log('-- 每 10s 空间分布 (clMax=同簇最大人数, meanNN=平均最近邻距) --');
for(const s of r.samples) console.log('  t='+s.t+'s 活='+s.alive+' 车上='+s.onV+' idle='+s.idle+' 最大簇='+s.clMax+' 平均最近邻='+s.meanNN);
const stats=vm.runInContext(STATS_FN(secs),ctx);
if(stats.err) console.log('STATS ERR',stats.err);
else{
console.log('-- 寻路/节奏统计 ('+secs+'s) --');
console.log('  setPathTo 调用='+stats.st.setPath+' 出路径='+stats.st.pathOK+' 返回null='+stats.st.pathNull+' 预算耗尽跳过='+stats.st.budgetSkip+' decide 调用='+stats.st.decide);
for(const s of stats.samples) console.log('  t='+s.t+'s 活='+s.alive+' idle='+s.idle+' defend='+s.def+' advance='+s.adv+' 无路径='+s.noP+' 重心='+JSON.stringify(s.cen));
}
