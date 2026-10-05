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


const ci=Number(process.argv[2]||7);
const ctx=boot(ci,42);
// 开局 (probe-spawn 的 boot 只建世界, 兵/Bot 在 startMatch 里生成; 用双引号避免吃掉外层模板)
const start=vm.runInContext("(()=>{try{const b=document.getElementById('startBtn'); if(b&&b.onclick){b.onclick();return 'ok';} return 'no-btn';}catch(e){return 'ERR '+String(e&&e.stack||e);}})()",ctx);
if(start!=="ok"){ console.log("  x startMatch: "+start); process.exit(1); }
const out=vm.runInContext(`(()=>{
const rows=[];
const ok=(c,msg)=>rows.push((c?'  ✓ ':'  ✗ ')+msg);
if(typeof BRIDGES==='undefined'||!BRIDGES.length){ rows.push('  (本图无桥)'); return rows; }
const B=BRIDGES[0];
rows.push('=== cam='+CAMPAIGN.id+' 桥: '+JSON.stringify({x:B.x,z:B.z,len:B.len,kind:B.kind})+' ===');
// ① 口径判据: 桥面中心
const bx=B.x, bz=B.z;
const dep=waterDepthAt(bx,bz), ws=waterStateAt(bx,bz,heightAt(bx,bz));
ok(dep>SWIM_DEPTH, '旧判据 (waterDepthAt) 在桥面确实报"水深 '+dep.toFixed(2)+'m > SWIM_DEPTH" —— 缺陷本体成立');
ok(ws.state==='dry', '新判据 (waterStateAt) 在桥面判 '+ws.state+' (应为 dry, 脚在水面之上)');
// ② 端到端 (受控直行): 把 Bot 放在桥面中心, 沿桥轴 (sin,cos)(B.yaw) 直走 —— 走的就是 moveDir 的真实代码,
//    但不依赖寻路 (旧实现的失效点在 moveDir 的水态判定, 不在 A*)。
const byaw=(B.yaw===undefined)?0:B.yaw;
const ax=Math.sin(byaw), az=Math.cos(byaw);
const deck=heightAt(bx,bz);
const bot=soldiers.find(s=>s.team===0&&s.alive&&!s.onVehicle&&!s.inSquad)||soldiers.find(s=>s.alive);
bot.pos.set(bx,deck,bz); bot.alive=true; bot.hp=100; bot.path=null; bot.target=null; bot.unstickT=0;
const x0=bot.pos.x, z0=bot.pos.z;
let minY=1e9, maxY=-1e9, swimF=0, nan=0;
const dts=[1/60,1/30,1/20];
for(let f=0;f<480;f++){
nowT+=dts[f%3];
bot.moveDir(byaw,4.0,dts[f%3]);
if(!isFinite(bot.pos.y)) nan++;
if(onBridge(bot.pos.x,bot.pos.z)!==false&&bot.pos.y<minY) minY=bot.pos.y;   // 只在**桥面上**记 y (离开桥面后随地形下降是正常的)
if(bot.pos.y>maxY) maxY=bot.pos.y;
if(bot.swim) swimF++;
}
const adv=Math.hypot(bot.pos.x-x0,bot.pos.z-z0);
const drop=deck-minY;
// 旧实现的等价演算 (同一段代码的旧口径): 按 waterDepthAt>SWIM_DEPTH 判游泳 ⇒ 每帧把 y 拽向 max(wy-0.95, bed+0.12)
const wyB=waterYAt(bx,bz), bedB=heightAt(bx,bz,true);
const oldTarget=Math.max(wyB-FLOAT_PAD+ (FLOAT_PAD-0.95), bedB+0.12);
ok(nan===0, "端到端: 480 帧无 NaN");
ok(drop<0.6, "端到端: 沿桥轴直走时 y 全程贴在桥面 (桥面 "+deck.toFixed(2)+" 最低 "+minY.toFixed(2)+" 下坠 "+drop.toFixed(2)+"m; 旧口径每帧拽向 "+oldTarget.toFixed(2)+")");
const need=B.len*0.45;
ok(adv>need, "端到端: 沿桥轴走了桥长的一半以上 (480 帧推进 "+adv.toFixed(1)+"m, 阈值 "+need.toFixed(1)+"m = 桥长 "+B.len+"m×0.45)");
ok(swimF===0, "端到端: 全程不进游泳态 (swim 帧="+swimF+"/480)");
rows.push("    终点=("+bot.pos.x.toFixed(1)+","+bot.pos.z.toFixed(1)+") 仍在桥上="+(onBridge(bot.pos.x,bot.pos.z)!==false));
rows.push("    桥轴=("+ax.toFixed(3)+","+az.toFixed(3)+") 桥面高="+deck.toFixed(2)+" 桥下水面="+wyB.toFixed(2)+" 桥下河床="+bedB.toFixed(2)+" 桥面到河床="+(deck-bedB).toFixed(2)+"m");
// ③ 阴性对照: 河心水面上的 Bot 必须确实进游泳态
const rx=(typeof RIVER!=='undefined'&&RIVER)?RIVER.pts[1][0]:0, rz=(typeof RIVER!=='undefined'&&RIVER)?RIVER.pts[1][1]:0;
const b2=soldiers.find(s=>s!==bot&&s.alive&&!s.onVehicle);
if(b2){
b2.pos.set(rx,waterYAt(rx,rz)-FLOAT_PAD,rz); b2.alive=true; b2.hp=100; b2.path=null;
let sw2=0;
for(let f=0;f<30;f++){ nowT+=1/60; b2.update(1/60); if(b2.swim) sw2++; }
ok(sw2>0, '阴性对照: 河心水面上的 Bot 确实进游泳态 (swim 帧='+sw2+'/30) —— 判据不是恒 dry');
}
return rows;
})()`,ctx);
for(const r of out) console.log(r);
const bad=out.filter(r=>r.indexOf('✗')>=0).length;
process.exit(bad?1:0);
