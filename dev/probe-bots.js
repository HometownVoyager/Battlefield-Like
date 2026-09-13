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
const files=['js/00-config.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/23-deploy.js','js/24-main.js'];
for(const f of files) load(ctx,f);
return ctx;
}
// ── 主循环的最小子集: 足以让 bot 互相发现/射击/占领/重生 ──
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
updateShells(dt);
updateNades(dt);
updateFlags(dt);
if(collect) collect(dt);
}
return nowT-t0;
};
})()`;
// ── 全战役乱斗推演 ──
const SIM_SECONDS=60;
function runCampaign(i){
const ctx=boot(i);
const start=vm.runInContext(`(()=>{
try{
const btn=document.getElementById('startBtn');
if(btn&&btn.onclick) btn.onclick(); else return {ok:false,err:'no onclick bound'};
return {ok:true};
}catch(e){ return {ok:false,err:String(e&&e.stack||e)}; }
})()`,ctx);
if(!start.ok) return {camp:'#'+i, fail:'开局失败: '+(start.err||'unknown')};
ctx.__step=vm.runInContext(STEP_FN,ctx);
return vm.runInContext(`(()=>{
try{
const stats={push:0,peek:0,slideT:0,combatT:0,deaths:0,kills:0,freezeMax:0,freeze:0,nan:0,shots:0};
const prev=soldiers.map(()=>({push:false,peek:false,alive:true,man:'hold'}));
const stuckT=soldiers.map(()=>0); const stuckSnap=[]; globalThis.__stuckSnap=stuckSnap;
const collect=(dt)=>{
for(let k=0;k<soldiers.length;k++){
const b=soldiers[k], p=prev[k];
if(!Number.isFinite(b.pos.x+b.pos.z+b.pos.y)) stats.nan++;
if(p.alive&&!b.alive) stats.deaths++;
p.alive=b.alive;
if(b.alive&&b.state==='combat'){
stats.combatT+=dt;
if(b.man==='slide') stats.slideT+=dt;
const pushing=!!b.pushPt;
if(pushing&&!p.push) stats.push++;
p.push=pushing;
if(b.peekPhase==='out'&&!p.peek) stats.peek++;
p.peek=b.peekPhase==='out';
p.man=b.man;
}
if(b.alive&&b.target&&b.state==='combat'&&!b.mgUse&&!b.empUse&&!b.mortUse&&!b.atTankTarget&&!(b.def&&b.def.mortar)&&nowT-b.lastSeenT>2.5&&Math.hypot(b.vel.x,b.vel.z)<0.3&&nowT-(b.lastFiredT||-9)>2){ stats.freeze=(stats.freeze||0)+dt; if(nowT-b.lastSeenT>stats.freezeMax) stats.freezeMax=nowT-b.lastSeenT; }
stuckT[k]= (b.alive&&b.target&&b.state==='combat'&&!b.mgUse&&!b.empUse&&!b.mortUse&&!b.atTankTarget&&!(b.def&&b.def.mortar)&&nowT-b.lastSeenT>2.5&&Math.hypot(b.vel.x,b.vel.z)<0.3&&nowT-(b.lastFiredT||-9)>2) ? stuckT[k]+dt : 0;
if(stuckT[k]>3&&stuckSnap.length<8&&!stuckSnap.some(x=>x.indexOf('"n":"'+b.name+'"')>=0)){
stuckSnap.push(JSON.stringify({n:b.name,t:+nowT.toFixed(1),man:b.man,manT:+b.manT.toFixed(2),stance:b.stance,peek:b.peekPhase,cover:!!b.coverPt,pushPt:!!b.pushPt,path:!!b.path,onV:!!b.onVehicle,band:+b.bandageT.toFixed(1),tgtAlive:b.target.alive,dT:+(nowT-b.lastSeenT).toFixed(1),distT:+Math.hypot(b.target.pos.x-b.pos.x,b.target.pos.z-b.pos.z).toFixed(1),hp:Math.round(b.hp),sup:+b.suppression.toFixed(2),cls:b.cls,sq:!!b.inSquad,mag:b.mag,crouch:b.crouch,prone:b.prone}));
}
}
stats.shots+=gunEvents.length;
};
const sim=__step;
sim(${SIM_SECONDS}*(MAP_SIZE>=640?2:1)*60,collect);
for(const b of soldiers){ stats.kills+=b.kills; }
let out_stuck=null;
const hist={};
for(const b of soldiers) hist[b.state]=(hist[b.state]||0)+1;
if(globalThis.__stuckSnap&&globalThis.__stuckSnap.length) out_stuck=globalThis.__stuckSnap;
return {ok:true, camp:CAMPAIGN.id, mode:GAMEMODE, stuck:out_stuck, bots:soldiers.length, ...stats,
slideFrac:stats.combatT>0?+(stats.slideT/stats.combatT).toFixed(2):0, hist};
}catch(e){ return {ok:false, err:String(e&&e.stack||e)}; }
})()`,ctx);
}
// ── 1v1 受控决斗 (开阔地对枪: 机动多样性/开火/逼近) ──
function runDuel(i){
const ctx=boot(i);
const start=vm.runInContext(`(()=>{
try{
const btn=document.getElementById('startBtn');
if(btn&&btn.onclick) btn.onclick(); else return {ok:false};
return {ok:true};
}catch(e){ return {ok:false}; }
})()`,ctx);
if(!start.ok) return {camp:'#'+i, fail:'开局失败'};
ctx.__step=vm.runInContext(STEP_FN,ctx);
return vm.runInContext(`(()=>{
try{
// 找开阔地对枪点: 中心向外螺旋采样, 两点间距22m且互相通视
let A=null,B=null;
outer:
for(let r=6;r<120;r+=4){
for(let a=0;a<TAU;a+=0.4){
const x=Math.cos(a)*r,z=Math.sin(a)*r;
if(occBlocked(x,z)||occBlocked(x+22,z)) continue;
if(!NAV.lineClear(x,z,x+22,z)) continue;
A={x,z}; B={x:x+22,z}; break outer;
}
}
if(!A) return {ok:true, camp:CAMPAIGN.id, skip:'未找到开阔对枪点'};
const ba=new Bot(0,0,'探针甲'), bb=new Bot(1,0,'探针乙');
ba.spawn(); bb.spawn();
ba.pos.set(A.x,0,A.z); ba.pos.y=standHeight(A.x,A.z,10);
bb.pos.set(B.x,0,B.z); bb.pos.y=standHeight(B.x,B.z,10);
ba.yaw=Math.atan2(B.x-A.x,B.z-A.z); bb.yaw=Math.atan2(A.x-B.x,A.z-B.z);
ba.hp=bb.hp=100; ba.decisionT=bb.decisionT=0; ba.perceptT=bb.perceptT=0;
const seen={Aman:new Set(),Bman:new Set(),Afire:0,Bfire:0,d0:22,dEnd:0,freeze:0,died:0,push:0,hpMinA:100,hpMinB:100};
const collect=(dt)=>{
if(ba.alive&&bb.alive){
if(ba.state==='combat'&&!ba.mgUse&&!ba.empUse&&!ba.mortUse&&ba.target&&nowT-ba.lastSeenT>seen.freeze) seen.freeze=nowT-ba.lastSeenT;
if(bb.state==='combat'&&!bb.mgUse&&!bb.empUse&&!bb.mortUse&&bb.target&&nowT-bb.lastSeenT>seen.freeze) seen.freeze=nowT-bb.lastSeenT;
if(ba.pushPt) seen.push++;
if(ba.man) seen.Aman.add(ba.man);
if(bb.man) seen.Bman.add(bb.man);
}
if(!ba.alive||!bb.alive) seen.died++;
for(const e of gunEvents){ if(e.shooter===ba) seen.Afire++; if(e.shooter===bb) seen.Bfire++; }
seen.hpMinA=Math.min(seen.hpMinA,ba.hp); seen.hpMinB=Math.min(seen.hpMinB,bb.hp);
};
const sim=__step;
sim(25*60,collect);
seen.dEnd=+Math.hypot(ba.pos.x-bb.pos.x,ba.pos.z-bb.pos.z).toFixed(1);
seen.died=(!ba.alive||!bb.alive)?1:0;
seen.hpA=Math.round(ba.hp); seen.hpB=Math.round(bb.hp);

return {ok:true, camp:CAMPAIGN.id, pt:A?'('+A.x.toFixed(0)+','+A.z.toFixed(0)+')':'-', ...seen,
Aman:[...seen.Aman].join('/'), Bman:[...seen.Bman].join('/')};
}catch(e){ return {ok:false, err:String(e&&e.stack||e)}; }
})()`,ctx);
}
// ── 基准模式: PROBE_BENCH=1 node dev/probe-bots.js 0 → 单战役吞吐测量 ──
// ── OCC/NAV 一致性检查: PROBE_NAV=1 node dev/probe-bots.js [战役] ──
if(process.env.PROBE_NAV==='1'){
const ci=process.argv[2]!==undefined?parseInt(process.argv[2]):4;
const ctx=boot(ci);
const out=vm.runInContext(`(()=>{
const pts=[[-132,-4.8],[-132.4,-6],[-131.6,-6],[-133.8,-5.6],[-136,-6],[-128,-6],[-132,2]];
const rows=pts.map(p=>p.join(',')+' occ='+(occBlocked(p[0],p[1])?1:0)+' nav='+(NAV.blocked2D(p[0],p[1])?1:0));
// A* 实测: 从基地内一点到基地外一点, 看路径是否穿墙
const p1=NAV.findPath(-138,-5,-120,-5);
rows.push('path(-138,-5)->(-120,-5): '+(p1?p1.map(w=>'('+w[0].toFixed(0)+','+w[1].toFixed(0)+')').join('->'):'null'));
return rows;
})()`,ctx);
console.log('#'+ci+' '+out.join('\n'));
process.exit(0);
}
// ── 怼墙诊断模式: PROBE_WALL=1 node dev/probe-bots.js [战役] → 抓"想移动却原地磨"的现场 ──
if(process.env.PROBE_WALL==='1'){
const ci=process.argv[2]!==undefined?parseInt(process.argv[2]):4;
const ctx=boot(ci);
const start=vm.runInContext(`(()=>{const btn=document.getElementById('startBtn'); if(btn&&btn.onclick){btn.onclick();return {ok:true};} return {ok:false};})()`,ctx);
if(!start.ok){ console.log('开局失败'); process.exit(1); }
ctx.__step=vm.runInContext(STEP_FN,ctx);
const r=vm.runInContext(`(()=>{
try{
const MOVE_STATES={advance:1,hunt:1,toVehicle:1};
const gT=soldiers.map(()=>0), gP=soldiers.map(()=>null), snaps=[]; globalThis.__wall=snaps;
const probeInfo=b=>{
const fy=Math.sin(b.yaw),fz=Math.cos(b.yaw);
const occ=[]; for(const d of [0.3,0.6,0.9,1.2,1.4,1.8,2.2]) occ.push(occBlocked(b.pos.x+fy*d,b.pos.z+fz*d)?1:0);
const eye=V3(b.pos.x,b.pos.y+1.4,b.pos.z); const dir=V3(fy,0,fz).normalize();
const hit=raycastWorld(eye,dir,6);
const near=[];
for(const bx of BOXES){ if(bx.dead) continue;
const cx=(bx.minX+bx.maxX)/2, cz=(bx.minZ+bx.maxZ)/2;
const dx=Math.max(bx.minX-b.pos.x,0,b.pos.x-bx.maxX), dz=Math.max(bx.minZ-b.pos.z,0,b.pos.z-bx.maxZ);
if(dx*dx+dz*dz<9) near.push({w:+(bx.maxX-bx.minX).toFixed(1),h:+(bx.maxY-bx.minY).toFixed(1),d:+(bx.maxZ-bx.minZ).toFixed(1),gh:+(bx.gh||0).toFixed(1),lo:+(bx.minY-(bx.gh||0)).toFixed(1),hi:+(bx.maxY-(bx.gh||0)).toFixed(1),cx:+cx.toFixed(1),cz:+cz.toFixed(1)});
if(near.length>4) break;
}
return {occ:occ.join(''), ray:+(hit?hit.dist:-1).toFixed(2), boxes:near};
};
const collect=(dt)=>{
for(let k=0;k<soldiers.length;k++){
const b=soldiers[k];
const moving=b.alive&&(MOVE_STATES[b.state]||(b.state==='combat'&&b.man==='push'&&b.pushPt)||(b.state==='cover'&&b.coverPt&&Math.hypot(b.coverPt.x-b.pos.x,b.coverPt.z-b.pos.z)>1.2));
if(!moving){ gT[k]=0; gP[k]=null; continue; }
if(!gP[k]){ gP[k]={x:b.pos.x,z:b.pos.z}; gT[k]=0; continue; }
gT[k]+=dt;
if(gT[k]>=1.2){
const d=Math.hypot(b.pos.x-gP[k].x,b.pos.z-gP[k].z);
if(d<0.3&&snaps.length<24&&snaps.filter(s=>s.n===b.name).length<3){
const pi=probeInfo(b);
const w0=b.path&&b.path[0], wn=b.path&&b.path[b.path.length-1];
snaps.push({n:b.name,t:+(nowT%100000).toFixed(0),st:b.state,man:b.man||'',x:+b.pos.x.toFixed(1),z:+b.pos.z.toFixed(1),yaw:+b.yaw.toFixed(2),path:b.path?b.pathI+'/'+b.path.length:'-',w0:w0?'('+w0[0].toFixed(0)+','+w0[1].toFixed(0)+')':'-',wn:wn?'('+wn[0].toFixed(0)+','+wn[1].toFixed(0)+')':'-',sq:b.inSquad?(SQUAD.mode||''):'',obj:b.objective?b.objective.id:'-',us:+b.unstickT.toFixed(2),dpi:+d.toFixed(2),...pi});
}
gP[k]={x:b.pos.x,z:b.pos.z}; gT[k]=0;
}
}
};
__step(${SIM_SECONDS}*(MAP_SIZE>=640?2:1)*60,collect);
return {ok:true,camp:CAMPAIGN.id,mode:GAMEMODE,snaps};
}catch(e){ return {ok:false,err:String(e&&e.stack||e)}; }
})()`,ctx);
console.log('#'+ci+' '+r.camp+'('+r.mode+') 怼墙快照='+(r.snaps?r.snaps.length:'ERR '+(r.err||r.fail||'?')));
for(const s of r.snaps) console.log('  ',JSON.stringify(s));
process.exit(0);
}
if(process.env.PROBE_BENCH==='1'){
const ci=parseInt(process.argv[2]||'0');
const ctx=boot(ci);
vm.runInContext(`(function(){document.getElementById('startBtn').onclick();})();`,ctx);
ctx.__step=vm.runInContext(STEP_FN,ctx);
let frames=parseInt(process.env.PROBE_BENCH_FRAMES||'600');
const t0=Date.now();
ctx.__benchFrames=frames;
vm.runInContext(`(function(){
const DTS=[1/60,1/30,1/20];
const step=globalThis.__bstep||(globalThis.__bstep=(function(){return null;})());
})();`,ctx);
// 简单循环: 直接调用 step 的内部逻辑做不到分段计时, 在宿主侧分批调用
const step=ctx.__step;
let done=0;
while(done<frames){
const batch=Math.min(300,frames-done);
const st=Date.now();
step(batch,null);
done+=batch;
console.log('frames='+done+' wallMs='+ (Date.now()-t0)+' batchMs='+(Date.now()-st));
}
console.log('吞吐: '+(frames/((Date.now()-t0)/1000)).toFixed(1)+' 帧/秒 (实时需60)');
process.exit(0);
}
// ── 入口 ──
const idx=process.argv[2]!==undefined?parseInt(process.argv[2]):-1;
const probe=boot(0);
const total=vm.runInContext('CAMPAIGNS.length',probe);
const all=Array.from({length:total},(_,k)=>k);
const range=idx>=0&&idx<total?[idx]:all;
let bad=0;
console.log('== Bot 乱斗推演 (60s 模拟时钟) ==');
for(const i of range){
const r=runCampaign(i);
if(r.ok===false||r.fail){ console.log(`#${i} FAIL ${JSON.stringify(r)}`); bad++; continue; }
const issues=[];
if(r.freeze>3.0) issues.push('真发呆累计'+r.freeze.toFixed(1)+'s(峰'+r.freezeMax.toFixed(1)+')');
if(r.push===0&&r.combatT>10) issues.push('有交战却无跃进推进');
if(r.kills===0&&r.deaths===0&&r.mode!=='convoy') issues.push('无战斗伤亡');
if(r.nan>0) issues.push('坐标NaN×'+r.nan);
if(r.slideFrac>=0.5) issues.push('横移占比'+Math.round(r.slideFrac*100)+'%');
const flag=issues.length?' ✗ ['+issues.join('; ')+']':' ✓';
if(issues.length) bad++;
console.log(`#${i} ${r.camp}(${r.mode}) bot=${r.bots} 推进=${r.push} 探头=${r.peek} 杀=${r.kills} 亡=${r.deaths} 发呆max=${r.freezeMax.toFixed(1)}s 横移占比=${Math.round(r.slideFrac*100)}% 状态=${JSON.stringify(r.hist)}${flag}`);if(r.stuck) console.log('   发呆快照: '+r.stuck.join('  ;;  '));
}
console.log('\n== 1v1 受控决斗 (22m 开阔地, 25s) ==');
for(const i of range){
const r=runDuel(i);
if(r.ok===false||r.fail){ console.log(`#${i} FAIL ${JSON.stringify(r)}`); bad++; continue; }
if(r.skip){ console.log(`#${i} ${r.camp} 跳过: ${r.skip}`); continue; }
const issues=[];
const totalFire=(r.Afire||0)+(r.Bfire||0);
if(totalFire<4) issues.push('开火过少'+totalFire+'发');
if(!(r.died||r.hpMinA<95||r.hpMinB<95)) issues.push('无有效命中');
if(r.freeze>3.2) issues.push('决斗发呆'+r.freeze.toFixed(1)+'s');
const flag=issues.length?' ✗ ['+issues.join('; ')+']':' ✓';
if(issues.length) bad++;
console.log(`#${i} ${r.camp} 开火甲=${r.Afire} 乙=${r.Bfire} 死亡=${r.died} 血低点${r.hpMinA}/${r.hpMinB} 末距${r.dEnd}m 甲机动[${r.Aman}] 乙机动[${r.Bman}]${flag}`);
}
console.log(bad===0?'\nBot 行为探针全过 ✓':'\nBot 行为探针存在失败 ✗');
process.exit(bad===0?0:1);
