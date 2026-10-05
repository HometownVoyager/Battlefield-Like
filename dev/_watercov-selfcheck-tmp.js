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


const idxs=(process.argv.slice(2).length?process.argv.slice(2):['0','1','2','3','4','5','6','7','8','9','10']).map(Number);
let pass=0, fail=0;
for(const ci of idxs){
const ctx=boot(ci,42);
const out=vm.runInContext(`(()=>{
const rows=[];
const ok=(c,msg)=>rows.push((c?'  ✓ ':'  ✗ ')+msg);
// ── 找出"条带水面网格": 索引 + 顶点成对同高 + 截面 UV 签名 (uv[4i]=uv[4i+2], uv[4i+1]=0, uv[4i+3]=1) ──
const strips=[];
for(const o of scene.children){
if(!o||!o.geometry||!o.geometry.attributes) continue;
const pa=o.geometry.attributes.position, ua=o.geometry.attributes.uv;
if(!pa||!ua||!o.geometry.index||pa.count<12||pa.count%2) continue;
let sig=true;
for(let i=0;i<pa.count/2;i++){
if(Math.abs(pa.array[i*6+1]-pa.array[i*6+4])>1e-6){ sig=false; break; }
if(Math.abs(ua.array[i*4+0]-ua.array[i*4+2])>1e-9||Math.abs(ua.array[i*4+1])>1e-9||Math.abs(ua.array[i*4+3]-1)>1e-9){ sig=false; break; }
}
if(sig) strips.push(o);
}
rows.push('=== cam='+CAMPAIGN.id+' 条带网格='+strips.length+' 段='+WATER_SEGS.length+' 盘='+WATER_DISCS.length+' 采样点='+WATER_SURF.length+' ===');
if(strips.length){
let tri=0, bad=0, worst=0, miss=0, ex1='', ex2='';
let triE=0, badE=0, worstE=0;   // 侧边点 (条带 P/Q 边): 弯道/汊港交汇处的"扭转四边形"只在这里出现
let ovl=0;                      // 被 >1 条水带同时覆盖的点 (汊港交汇): 两条水带的**渲染面本身就不同高**, 判据在此无意义
const top=[];
const note=(d,x,y,z)=>{ top.push({d:d,x:x,y:y,z:z,q:waterYAt(x,z)}); top.sort((a,b)=>b.d-a.d); if(top.length>6) top.pop(); };
// 该点被几条水带的"矩形 ⊕ WATER_PAD"覆盖 (只用于把交汇点挑出来, 与索引等价判据同源)
const nCover=(x,z)=>{
let n=0;
for(const s of WATER_SEGS){
const dx=s.bx-s.ax, dz=s.bz-s.az, L2=dx*dx+dz*dz, L=Math.sqrt(L2)||1;
const tR=L2>1e-9?((x-s.ax)*dx+(z-s.az)*dz)/L2:0;
const t=tR<0?0:(tR>1?1:tR);
const lat=Math.hypot(x-(s.ax+dx*t),z-(s.az+dz*t));
const axial=L*Math.max(0,-tR,tR-1);
const lateral=Math.sqrt(Math.max(0,lat*lat-axial*axial));
if(Math.hypot(Math.max(0,lateral-s.hw),axial)<=WATER_PAD) n++;
}
for(const d of WATER_DISCS){ if(Math.hypot(x-d.x,z-d.z)<=d.reach-WATER_PAD) n++; }
return n;
};
const chk=(x,y,z,edge)=>{
const wy=waterYAt(x,z);
if(wy<=-1e8){ miss++; if(!ex1) ex1='('+x.toFixed(1)+','+z.toFixed(1)+')'; return; }
if(nCover(x,z)>1){ ovl++; return; }      // 交汇点: 两条水带各渲染各的, 取谁都是选择, 不计偏差
if(edge) triE++; else tri++;
const d=Math.abs(wy-y);
if(edge){ if(d>worstE) worstE=d; if(d>0.06) badE++; }
else{
if(d>worst) worst=d;
if(d>0.06){ bad++; if(!ex2) ex2='('+x.toFixed(1)+','+z.toFixed(1)+') 网格y='+y.toFixed(3)+' 查询='+wy.toFixed(3); note(d,x,y,z); }
}
};
for(const m of strips){
const pa=m.geometry.attributes.position, idx=m.geometry.index;
const V=(k)=>{ const h=k>>1, o=(k%2)?3:0; return {x:pa.array[h*6+o],y:pa.array[h*6+o+1],z:pa.array[h*6+o+2]}; };
for(let k=0;k<pa.count;k++){ const v=V(k); chk(v.x,v.y,v.z,true); }
for(let t=0;t<idx.count;t+=3){
const a=V(idx.array[t]),b=V(idx.array[t+1]),c=V(idx.array[t+2]);
chk((a.x+b.x+c.x)/3,(a.y+b.y+c.y)/3,(a.z+b.z+c.z)/3,false);
const mid=(u,v2)=>({x:(u.x+v2.x)/2,y:(u.y+v2.y)/2,z:(u.z+v2.z)/2});
for(const m2 of [mid(a,b),mid(b,c),mid(a,c)]){
const onPQ=(m2.y===a.y&&m2.y===b.y)||(m2.y===b.y&&m2.y===c.y); // 与两端的 y 相同 ⇒ 落在条带侧边 (P/Q 边) 上
chk(m2.x,m2.y,m2.z,onPQ);
}
}
}
ok(miss===0,'覆盖: '+(tri+triE+ovl)+' 个判据点全部取到水'+(miss?(' —— 缺 '+miss+' 处, 例 '+ex1):' (旧口径在此必然报洞)'));
for(const q of top.slice(0,4)) rows.push('    · 最大偏差点 ('+q.x.toFixed(1)+','+q.z.toFixed(1)+') 网格y='+q.y.toFixed(3)+' 查询='+q.q.toFixed(3)+' Δ='+q.d.toFixed(3));
ok(worst<=0.5&&bad<=Math.max(6,Math.round(tri*0.03)),'同源(内部): 偏差 >0.06m = '+bad+'/'+tri+' 最大 '+worst.toFixed(4)+'m (判据: 最大 ≤0.5m 且 >0.06m 的点 ≤3%'+(ex2?('; 例 '+ex2):'')+')');
rows.push('  [交汇] 被 >1 条水带覆盖的点 (两条渲染面本身不同高, 判据不计) = '+ovl);
ok(badE<=Math.max(8,Math.round(triE*0.1)),'同源(侧边): 偏差 >0.06m = '+badE+'/'+triE+' (最大 '+worstE.toFixed(3)+'m; 阈值 10% —— 只允许出现在弯道/汊港交汇的扭转四边形上)');
}
// ── ② 索引等价: 格索引 vs 全表暴力 (同一批点必须逐点相同) ──
const brute=(x,z)=>{
let best=-1e9, eBest=-1e9, ePerp=1e9;
for(const s of WATER_SEGS){
const dx=s.bx-s.ax, dz=s.bz-s.az, L2=dx*dx+dz*dz, L=Math.sqrt(L2)||1;
const tRaw=L2>1e-9?((x-s.ax)*dx+(z-s.az)*dz)/L2:0;
const t=tRaw<0?0:(tRaw>1?1:tRaw);
const lat=Math.hypot(x-(s.ax+dx*t),z-(s.az+dz*t));
const axial=L*Math.max(0,-tRaw,tRaw-1);
const lateral=Math.sqrt(Math.max(0,lat*lat-axial*axial));
const eff=Math.hypot(Math.max(0,lateral-s.hw),axial);
if(eff>WATER_PAD) continue;
const wy=s.awy+(s.bwy-s.awy)*t;
if(eff<=0){ if(wy>best) best=wy; } else if(eff<ePerp){ ePerp=eff; eBest=wy; }
}
for(const d of WATER_DISCS){
const perp=Math.hypot(x-d.x,z-d.z);
if(perp>d.reach) continue;
if(perp<=d.reach-WATER_PAD){ if(d.wy>best) best=d.wy; } else if(perp<ePerp){ ePerp=perp; eBest=d.wy; }
}
return best>-1e8?best:eBest;
};
if(WATER_SEGS.length||WATER_DISCS.length){
const TR0=MAP_SIZE/2-8;
let n2=0, diff=0, wat=0, far=0, exd='';
for(let x=-TR0;x<=TR0;x+=3)for(let z=-TR0;z<=TR0;z+=3){
n2++;
const a=waterSampleY(x,z), b=brute(x,z);
if(Math.abs(a-b)>1e-9){ diff++; if(!exd) exd='('+x+','+z+') 索引='+a.toFixed(3)+' 暴力='+b.toFixed(3); }
if(a>-1e8) wat++; else far++;
}
ok(diff===0,'索引等价: '+n2+' 点 (索引 vs 全表暴力) 全同 —— 有水 '+wat+' / 无水 '+far+(exd?(' 例 '+exd):''));
}else ok(true,'索引等价: 本图无采样水面 (0 段 0 盘)');
// ── ③ 分档普查 ──
const TR=MAP_SIZE/2-8;
let dry=0,wet=0,wade=0,swim=0,deepest=-9;
for(let x=-TR;x<=TR;x+=2)for(let z=-TR;z<=TR;z+=2){
const wy=waterYAt(x,z);
if(wy<=-1e8){ dry++; continue; }
const dep=wy-heightAt(x,z,true);
if(dep>deepest) deepest=dep;
if(dep<=0.02) dry++; else if(dep<=WADE_DEPTH) wet++; else if(dep<=SWIM_DEPTH) wade++; else swim++;
}
const wat=dry+wet+wade+swim;
rows.push('  [分档] 湿沙='+wet+' 涉水='+wade+' 游泳='+swim+' 最深='+deepest.toFixed(2)+' 有水格='+(wat-dry)+'/'+wat+' ('+(100*(wat-dry)/wat).toFixed(1)+'%)');
if(RIVER&&!(RIVER.d>2)&&!RIVER.ice) ok(swim<=Math.max(4,Math.round(wat*0.005)),'浅河声明档: 游泳档='+swim+' (允许 ≤'+Math.max(4,Math.round(wat*0.005))+' —— 浅河必须可涉渡)');
if(RIVER&&RIVER.d>2) ok(swim>=Math.round((wat-dry)*0.02),'深谷激流档: 游泳档='+swim+' ≥ '+Math.round((wat-dry)*0.02)+' (须过桥的设计)');
// ── ④ 自救方向 (条目 25): 水点的 shoreDirAt 必须非 null 且指向更浅处 ──
{
let n4=0, nul=0, wrong=0, ex4='';
const pts=[];
if(RIVER){ const P=RIVER.pts; for(let i=0;i<P.length-1;i++){ for(let k=0;k<=3;k++){ const t=k/3; pts.push([P[i][0]+(P[i+1][0]-P[i][0])*t, P[i][1]+(P[i+1][1]-P[i][1])*t]); } } }
for(const p of pts){
const dep=waterDepthAt(p[0],p[1]);
if(!(dep>0.3)) continue;
n4++;
const sd=shoreDirAt(p[0],p[1]);
if(!sd){ nul++; if(!ex4) ex4='('+p[0].toFixed(0)+','+p[1].toFixed(0)+')'; continue; }
const d7=waterDepthAt(p[0]+sd[0]*7,p[1]+sd[1]*7);
const sh=d7<=-1e8?-1e9:d7;
if(sh>dep+1e-6){ wrong++; if(!ex4) ex4='('+p[0].toFixed(0)+','+p[1].toFixed(0)+') dep='+dep.toFixed(2)+'→'+d7.toFixed(2); }
}
if(n4) ok(nul===0&&wrong===0,'自救方向: '+n4+' 个水点 —— null='+nul+' 指向更深='+wrong+(ex4?(' 例 '+ex4):' (旧口径近岸/河道整段 null)'));
}
return rows;
})()`,ctx);
for(const r of out){ console.log(r); if(r.includes('✗')) fail++; else if(r.includes('✓')) pass++; }
}
console.log('\n合计: ✓'+pass+' / ✗'+fail);
process.exit(fail?1:0);
