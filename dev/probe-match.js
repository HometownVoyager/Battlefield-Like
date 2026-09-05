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
class _PlaneGeo extends Geo{constructor(w=1,h=1,sg=1,sh=1){super(w,h);const gx=(sg||1)+1,gy=(sh||1)+1;this.attributes.position={count:gx*gy,getX:i=>((i%gx)/gx-0.5)*w,getZ:i=>(Math.floor(i/gx)/gy-0.5)*h,getY:()=>0,setY(){},setX(){},setZ(){}};}}
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
const files=['js/00-config.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15a-defs.js','js/15-vehicles.js','js/15b-trucks.js','js/16a-defs.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/23-deploy.js','js/24-main.js'];
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

// ─────────────────────────────────────────────
// 对局统计探针: 无头跑完整局, 记录兵力票/旗权/扣票分解/终局方式
// 用法: node dev/probe-match.js [战役序号|-1=旗点战役集] [次数] [最长分钟]
// ─────────────────────────────────────────────
const FLAG_SET=[0,1,2,3,5,6,7,9,11,12]; // 有点位争夺的战役 (跳过遭遇/劫道/破袭)
function runMatch(ci,maxMin){
const ctx=boot(ci);
const init=vm.runInContext(`
var __initErr=null;
try{
var __m={winner:null,reason:null,caps:[0,0],tEnd:0};
const _em=endMatch;
endMatch=function(w){ __m.winner=w; __m.tEnd=nowT; try{_em(w);}catch(e){} };
const _re=requestEnd;
requestEnd=function(w){ if(!__m.reason) __m.reason={w:(w===undefined?null:w),tk0:tickets[0],tk1:tickets[1],mt:matchTime,t:nowT}; _re(w); };
const _akm=addKillMsg;
addKillMsg=function(txt,team){ if(typeof txt==='string'&&txt.indexOf('占领了')>=0&&team>=0) __m.caps[team]++; _akm(txt,team); };
const btn=document.getElementById('startBtn');
if(btn&&btn.onclick) btn.onclick(); else __initErr='no onclick bound';
__m.t0=nowT;
__m.initOwned=FLAGS.map(f=>f.owner);
__m.initTk=[tickets[0],tickets[1]];
}catch(e){ __initErr=String(e&&e.stack||e); }
__initErr;
`,ctx);
if(init!==null) return {fail:'开局失败: '+(init||'')};
ctx.__step=vm.runInContext(STEP_FN,ctx);
const step=ctx.__step;
const maxFrames=maxMin*60*30;
let frames=0, wall0=Date.now();
ctx.st=vm.runInContext(`(()=>{
return {deaths:[0,0],veh:[0,0],vehCost:[0,0],prevVehCost:[0,0],prevTk:[tickets[0],tickets[1]],
prevAlive:soldiers.map(s=>!!s.alive),prevVeh:[...tanks,...planes].map(v=>!!v.alive),
prevCaps:[0,0],samples:[],timeline:[]};
})()`,ctx);
const st=ctx.st;
ctx.__wall0=Date.now();
while(frames<maxFrames){
const r=vm.runInContext('matchOver',ctx);
if(r) break;
step(150,(dt)=>{});
// 采样在宿主侧直接读上下文 (每批150帧 ≈ 5s 游戏时间)
vm.runInContext(`(()=>{
const dt=5;
let d0=0,d1=0;
for(let k=0;k<soldiers.length;k++){ const b=soldiers[k]; if(st.prevAlive[k]&&!b.alive){ if(b.team===0)d0++; else d1++; } st.prevAlive[k]=!!b.alive; }
st.deaths[0]+=d0; st.deaths[1]+=d1;
[...tanks,...planes].forEach((v,k)=>{ if(st.prevVeh[k]&&!v.alive){ st.veh[v.team]++; st.vehCost[v.team]+= v.kind==='plane'?3:((v.def&&v.def.heavy)?6:5); } st.prevVeh[k]=!!v.alive; });
const vc0=st.vehCost[0]-st.prevVehCost[0], vc1=st.vehCost[1]-st.prevVehCost[1];
st.prevVehCost[0]=st.vehCost[0]; st.prevVehCost[1]=st.vehCost[1];
const wc=[__m.caps[0]-st.prevCaps[0],__m.caps[1]-st.prevCaps[1]];
st.prevCaps[0]=__m.caps[0]; st.prevCaps[1]=__m.caps[1];
let o0=0,o1=0; FLAGS.forEach(f=>{ if(f.owner===0)o0++; else if(f.owner===1)o1++; });
const b0=tickets[0]-st.prevTk[0], b1=tickets[1]-st.prevTk[1]; // 负=掉票
st.prevTk=[tickets[0],tickets[1]];
// 扣票分解: 掉票 = 步兵阵亡 + 载具损失票 + (攻防模式进攻方占领+40) + 旗权bleed
const bleed0=(-b0)-d0-vc0-(GAMEMODE==='assault'&&ATK===0?40*wc[0]:0);
const bleed1=(-b1)-d1-vc1-(GAMEMODE==='assault'&&ATK===1?40*wc[1]:0);
st.bleed=st.bleed||[0,0];
if(bleed0>0.01) st.bleed[0]+=bleed0;
if(bleed1>0.01) st.bleed[1]+=bleed1;
st.oSum=st.oSum||[0,0]; st.oSum[0]+=o0*dt; st.oSum[1]+=o1*dt; st.oT=(st.oT||0)+dt;
st.samples.push([+(nowT-__m.t0).toFixed(0),Math.ceil(tickets[0]),Math.ceil(tickets[1]),o0,o1]);
if(st.samples.length%6===0) st.timeline.push({t:+(nowT-__m.t0).toFixed(0),tk:[Math.ceil(tickets[0]),Math.ceil(tickets[1])],o:[o0,o1]});
})()`,ctx);
frames+=150;
}
return vm.runInContext(`(()=>{
const dur=(matchOver?__m.tEnd:nowT)-(__m.t0||0);
const rsn=__m.reason;
let why='未终局';
if(matchOver){
if(rsn){
if(rsn.mt<=0.5) why='时间到';
else if(rsn.tk0<=0.5) why=TEAM_NAME[0]+'兵力归零';
else if(rsn.tk1<=0.5) why=TEAM_NAME[1]+'兵力归零';
else if(rsn.w!==null&&GAMEMODE==='assault'&&rsn.w===ATK) why='攻方全占旗点';
else why='其它(w='+rsn.w+')';
}else why='判定期结束';
}
const T=st.oT||1;
return {ok:true,camp:CAMPAIGN.id,mode:GAMEMODE,flags:FLAGS.length,
initOwned:__m.initOwned,initTk:__m.initTk,
dur:+dur.toFixed(1),over:matchOver,winner:__m.winner,why,
finalTk:[Math.ceil(tickets[0]),Math.ceil(tickets[1])],
deaths:st.deaths,veh:st.veh,caps:__m.caps,bleed:(st.bleed||[0,0]).map(x=>+x.toFixed(0)),
oAvg:[+(st.oSum[0]/T).toFixed(2),+(st.oSum[1]/T).toFixed(2)],
tanks:tanks.length, planes:planes.length,
timeline:st.timeline};
})()`,ctx);
}
// ── 入口 ──
const a1=process.argv[2]!==undefined?parseInt(process.argv[2]):-1;
const runs=process.argv[3]!==undefined?parseInt(process.argv[3]):1;
const maxMin=process.argv[4]!==undefined?parseFloat(process.argv[4]):40;
const list=a1>=0?[a1]:(a1===-2?Array.from({length:vm.runInContext('CAMPAIGNS.length',boot(0))},(_,k)=>k):FLAG_SET);
console.log(`== 对局统计 (无头全 sim, 330票/队·老兵·11bot/队, 每战役${runs}局, 上限${maxMin}分) ==`);
for(const ci of list){
for(let r=0;r<runs;r++){
const t0=Date.now();
const res=runMatch(ci,maxMin);
const wall=((Date.now()-t0)/1000).toFixed(0);
if(res.fail){ console.log(`#${ci} FAIL ${res.fail}`); continue; }
console.log(`#${ci} ${res.camp}(${res.mode},${res.flags}旗) ${wall}s墙钟 `+
	`时长=${(res.dur/60).toFixed(1)}分 终局=${res.why} 胜=${res.winner===null?'-':res.winner} `+
	`坦克[${res.tanks}/${res.tanks/2}] 飞机[${res.planes}] `+
`票[${res.finalTk[0]},${res.finalTk[1]}] 初始票[${res.initTk}] 初始旗权[${res.initOwned}] `+
`死亡[${res.deaths[0]},${res.deaths[1]}](${(res.deaths[0]/(res.dur/60)).toFixed(1)}/${(res.deaths[1]/(res.dur/60)).toFixed(1)}/分) `+
`载具毁[${res.veh[0]},${res.veh[1]}] 占领[${res.caps[0]},${res.caps[1]}] bleed[${res.bleed[0]},${res.bleed[1]}] 均旗权[${res.oAvg[0]},${res.oAvg[1]}]`);
console.log('   时间线: '+res.timeline.map(s=>`${s.t}s tk[${s.tk}] o[${s.o}]`).join(' | '));
}
}
