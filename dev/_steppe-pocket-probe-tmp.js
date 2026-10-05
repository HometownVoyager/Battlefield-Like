// AUTO-GEN
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


const ci=parseInt(process.argv[2]||'8');
const nb=parseInt(process.argv[3]||'3');
for(let run=0;run<nb;run++){
let ctx;
try{ ctx=boot(ci,42); }catch(e){ console.log('run'+run+' BOOT-ERR '+e.message); continue; }
const out=vm.runInContext(`(()=>{ 
const SP=5, N=Math.floor(MAP_SIZE/SP)+1, OFF=MAP_SIZE/2, NN=N*N;
const toW=(i,j)=>[i*SP-OFF, j*SP-OFF];
const toG=(x,z)=>[clamp(Math.round((x+OFF)/SP),0,N-1), clamp(Math.round((z+OFF)/SP),0,N-1)];
const open=new Uint8Array(NN), comp=new Int32Array(NN).fill(-1), csize=[];
// 与 07-nav 同口径 (2026-09-26 P0-3 补强): 格开放 = 格心空 或 四象限 >=3 空; 边 = 中线或 ±1.5 并行线任一通
const NAV_EDGE_PAD=1.5, NAV_OPEN_Q=1.25;
const lineOK=(x1,z1,x2,z2)=>{
const d=Math.hypot(x2-x1,z2-z1), steps=Math.max(1,Math.ceil(d/0.9));
for(let s=0;s<=steps;s++){ const t=s/steps; if(occBlocked(x1+(x2-x1)*t,z1+(z2-z1)*t)) return false; }
return true;
};
const edgeOK=(x1,z1,x2,z2)=>{
if(lineOK(x1,z1,x2,z2)) return true;
const dx=x2-x1, dz=z2-z1, len=Math.hypot(dx,dz)||1;
const px=-dz/len*NAV_EDGE_PAD, pz=dx/len*NAV_EDGE_PAD;
if(lineOK(x1+px,z1+pz,x2+px,z2+pz)) return true;
if(lineOK(x1-px,z1-pz,x2-px,z2-pz)) return true;
return false;
};
const E=(i,j,di,dj)=>{ if(i+di<0||i+di>=N||j+dj<0||j+dj>=N) return false; const a=toW(i,j), b=toW(i+di,j+dj); return edgeOK(a[0],a[1],b[0],b[1]); };
const EOK=[];
for(let j=0;j<N;j++)for(let i=0;i<N;i++){
const k=j*N+i, a=toW(i,j);
if(!occBlocked(a[0],a[1])){ open[k]=1; } else {
let q=0;
if(!occBlocked(a[0]+NAV_OPEN_Q,a[1]+NAV_OPEN_Q)) q++;
if(!occBlocked(a[0]+NAV_OPEN_Q,a[1]-NAV_OPEN_Q)) q++;
if(!occBlocked(a[0]-NAV_OPEN_Q,a[1]+NAV_OPEN_Q)) q++;
if(!occBlocked(a[0]-NAV_OPEN_Q,a[1]-NAV_OPEN_Q)) q++;
open[k]=q>=3?1:0;
}
}
for(let j=0;j<N;j++)for(let i=0;i<N;i++){
const k=j*N+i; const a=toW(i,j); const row=[];
for(const [di,dj] of [[1,0],[0,1],[1,1],[1,-1]]) row.push(open[k]&&(i+di>=0&&i+di<N&&j+dj>=0&&j+dj<N)&&open[(j+dj)*N+(i+di)]?edgeOK(a[0],a[1],toW(i+di,j+dj)[0],toW(i+di,j+dj)[1]):false);
EOK.push(row);
};
let cid=0;
const stk=[];
for(let k=0;k<NN;k++){
if(!open[k]||comp[k]>=0) continue;
comp[k]=cid; stk.length=0; stk.push(k); let n=0;
while(stk.length){
const c=stk.pop(); n++;
const i=c%N, j=(c-i)/N;
const near=[[1,0],[0,1],[-1,0],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
for(const [di,dj] of near){
if(i+di<0||i+di>=N||j+dj<0||j+dj>=N) continue;
const k2=(j+dj)*N+(i+di); if(!open[k2]||comp[k2]>=0) continue;
if(!E(i,j,di,dj)) continue;
comp[k2]=cid; stk.push(k2);
}
}
csize[cid]=n; cid++;
}
const compOf=(x,z)=>{ const g=toG(x,z); return comp[g[1]*N+g[0]]; };
const sizeOf=(g)=>g<0?0:csize[g];
const rows=[];
for(const b of BASES) rows.push('BASE ('+b.x+','+b.z+') 分量='+compOf(b.x,b.z)+' 格数='+sizeOf(compOf(b.x,b.z)));
for(const f of FLAGS) rows.push('FLAG '+f.id+' ('+f.x+','+f.z+') 分量='+compOf(f.x,f.z)+' 格数='+sizeOf(compOf(f.x,f.z)));
for(const sp of (CAMPAIGN.spawns||[])){
const g=compOf(sp.x,sp.z), sz=sizeOf(g);
const baseG=compOf(basePos(sp.team===1?1:0).x,basePos(sp.team===1?1:0).z);
const bad=(g<0)||(g!==baseG&&sz<400);
rows.push((bad?'  ✗':'  ·')+' 强点 '+sp.name+' ('+sp.x+','+sp.z+') team='+sp.team+' 分量='+g+' 格数='+sz+' 基地分量='+baseG+(bad?'  ⟵ 死袋/孤立':''));
if(!bad) continue;
// ── 死袋: 先逐边给"哪条边被谁挡住" (决定性证据), 再给 OCC 图 ──
{
const [gi,gj]=toG(sp.x,sp.z);
const a=toW(gi,gj);
const who=(x,z)=>{
const hits=[];
// 判据与 buildOccupancy 逐条同源: BOX 外扩 0.6 且 maxY>=gh+0.5 且 minY<=gh+1.75; CYL r>=0.28 外扩 0.6; wires r*0.85
for(const b of BOXES){
if(b.dead) continue;
if(x<b.minX-0.6||x>b.maxX+0.6||z<b.minZ-0.6||z>b.maxZ+0.6) continue;
if(b.maxY<b.gh+0.5||b.minY>b.gh+1.75) continue;
hits.push('BOX ('+((b.minX+b.maxX)/2).toFixed(1)+','+((b.minZ+b.maxZ)/2).toFixed(1)+') 尺寸'+((b.maxX-b.minX).toFixed(2))+'×'+(b.maxY-b.minY).toFixed(2)+'×'+((b.maxZ-b.minZ).toFixed(2))+' 顶'+b.maxY.toFixed(2)+' 地'+b.gh.toFixed(2));
}
for(const c of CYLS){ if(c.r<0.28) continue; if(Math.hypot(x-c.x,z-c.z)<=c.r+0.6) hits.push('CYL ('+c.x.toFixed(1)+','+c.z.toFixed(1)+') r='+c.r.toFixed(2)+' y='+c.y0.toFixed(1)+'~'+c.y1.toFixed(1)); }
for(const w of wires){ if(!w.alive) continue; const rr=Math.max(0.6,w.r*0.85); if(Math.hypot(x-w.x,z-w.z)<=rr) hits.push('WIRE ('+w.x.toFixed(1)+','+w.z.toFixed(1)+') r='+w.r.toFixed(2)); }
return hits.join(' + ')||'(无碰撞盒/圆柱/铁丝网 — 应为静态地貌层 OCC 直接写入)';
};
rows.push('  死袋格中心 ('+a[0]+','+a[1]+')  OCC='+occBlocked(a[0],a[1])+'  分量格数='+sz);
for(const [di,dj] of [[1,0],[0,1],[-1,0],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
const i2=gi+di, j2=gj+dj;
if(i2<0||j2<0||i2>=N||j2>=N){ rows.push('   边 ('+di+','+dj+'): 出图'); continue; }
if(!open[j2*N+i2]){ rows.push('   边 ('+di+','+dj+'): 邻格封闭 (中心 '+toW(i2,j2).join(',')+') ⇒ 该格方向不可通行'); continue; }
const b=toW(i2,j2);
const d=Math.hypot(b[0]-a[0],b[1]-a[1]), steps=Math.max(1,Math.ceil(d/0.9));
let blockedAt=null;
{
const dx=b[0]-a[0], dz=b[1]-a[1], ln=Math.hypot(dx,dz)||1;
const tryLine=(ox,oz)=>{ const d2=Math.hypot(b[0]-a[0],b[1]-a[1]), steps2=Math.max(1,Math.ceil(d2/0.9)); for(let s=0;s<=steps2;s++){ const t=s/steps2; const x=a[0]+dx*t+ox, z=a[1]+dz*t+oz; if(occBlocked(x,z)) return [x,z]; } return null; };
const p1=tryLine(0,0);
if(p1){ const px=-dz/ln*1.5, pz=dx/ln*1.5; const p2=tryLine(px,pz)||tryLine(-px,-pz); if(p2) blockedAt=p2; }
}
rows.push('   边 ('+di+','+dj+'): '+(blockedAt?('✗ 被挡在 ('+blockedAt[0].toFixed(2)+','+blockedAt[1].toFixed(2)+') ← '+who(blockedAt[0],blockedAt[1])):'✓ 通'));
}
}
rows.push('  OCC 1m 窗口 (x:'+(sp.x-26)+'..'+(sp.x+26)+', z:'+(sp.z-26)+'..'+(sp.z+26)+'), 行=z 从 '+(sp.z-26)+' 起, # = 阻挡, = = 水障, . = 空, P = 强点, C = 死袋格中心');
for(let dz=-26;dz<=26;dz++){
let line='   ';
for(let dx=-26;dx<=26;dx++){
const x=sp.x+dx, z=sp.z+dz;
const i=Math.round((x+OCC.off)/OCC.res), j=Math.round((z+OCC.off)/OCC.res);
let c='.';
if(Math.abs(dx)<0.5&&Math.abs(dz)<0.5) c='P';
else if(i<0||j<0||i>=OCC.N||j>=OCC.N) c=' ';
else { const v=OCC.data[j*OCC.N+i]; c=(v===0)?'.':(v===2?'=':'#'); }
line+=c;
}
rows.push(line);
}
// ── 邻近碰撞盒 (按水平面积排序, 前 26 个) ──
const near=[];
for(const b of BOXES){
const cx=(b.minX+b.maxX)/2, cz=(b.minZ+b.maxZ)/2;
const d=Math.hypot(cx-sp.x,cz-sp.z);
if(d<24&&b.maxY>heightAt(cx,cz)-0.5) near.push({d,cx,cz,w:b.maxX-b.minX,h:b.maxY-b.minY,dp:b.maxZ-b.minZ,top:b.maxY,gh:b.gh});
}
near.sort((a,b)=>b.w*b.dp-a.w*a.dp);
rows.push('  邻近碰撞盒 (24m 内, 按面积降序, 前 26):');
for(const b of near.slice(0,26)) rows.push('    d='+b.d.toFixed(1)+'m 中心('+b.cx.toFixed(1)+','+b.cz.toFixed(1)+') 尺寸 '+b.w.toFixed(2)+'×'+b.dp.toFixed(2)+'×h'+b.h.toFixed(2)+' 顶='+b.top.toFixed(2)+' 地='+(b.gh!==undefined?b.gh.toFixed(2):'-'));
const nearC=[];
for(const c of CYLS){ const d=Math.hypot(c.x-sp.x,c.z-sp.z); if(d<24) nearC.push({d,...c}); }
nearC.sort((a,b)=>a.d-b.d);
rows.push('  PROPS 5m 内 (半径指纹): '+PROPS.filter(p=>Math.hypot(p.x-sp.x,p.z-sp.z)<5).map(p=>'('+p.x.toFixed(2)+','+p.z.toFixed(2)+') r='+p.r.toFixed(3)).join(' | '));
rows.push('  邻近圆柱 (24m 内, 前 20): '+nearC.slice(0,20).map(c=>'d='+c.d.toFixed(1)+' r='+c.r.toFixed(2)+' y='+c.y0.toFixed(1)+'~'+c.y1.toFixed(1)).join(' | '));
rows.push('  该点所在 5m 格的 8 邻域:');
{ const [gi,gj]=toG(sp.x,sp.z);
for(let dj=-4;dj<=4;dj++){ let line='   ';
  for(let di=-4;di<=4;di++){
  const i=gi+di, j=gj+dj;
  if(i<0||j<0||i>=N||j>=N){ line+='  .. '; continue; }
  const k=j*N+i;
  line+=(open[k]?(' '+String(comp[k]%100).padStart(2,' ')+' '):' ### ');
  }
  rows.push(line);
}
}
}
return rows;
 })()`,ctx);
console.log('=== run '+run+' ===');
for(const r of out) console.log(r);
}
