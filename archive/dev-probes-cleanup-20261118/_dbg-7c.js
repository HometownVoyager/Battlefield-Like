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
// dev/verify-phase4-7c.js —— P3 阶段四子批 7c 判据: 对空命中单源 + 轻武器对空
// 用法: node dev/verify-phase4-7c.js
// 结构: S1~S8 静态断言 (单源/收口/契约面) + R1~R5 运行时钉值 (真沙箱, 战役 0)。
// 单源: planeHitR/planeHitTest/planeNearTest (16-aircraft) —— 旧四套口径全部收口:
//   ①fireMGBurst 手写球测 (平径 3.2, 无遮挡=F7 隔山打) → planeHitTest + raycastWorld 遮挡;
//   ②高炮近炸 (8/11) → planeNearTest (引信半径保留, 判定几何同源);
//   ③巡飞弹 rayCyl 2.3×size + 兜底 2.2×size → planeHitTest / planeHitR+0.4;
//   ④aimAssist 候选 2.4×size → planeHitR;
//   ⑤(审计追加) splashDamage ff 态对机 radius+3 → radius+planeHitR。
// 轻武器对空 (Q3 裁定): fireBullet 敌机实体化 —— 挡弹道 + AIRMG_SCRATCH_* 刮血档,
//   Bot 射手 ×GROUNDGUN_VS_AIR (空对地平衡批口径, 玩家档不减); 飞机自己打的弹不算 (对空判定在
//   fireMGBurst 显式分层, 再算就双份); 索敌不放开 —— 步兵仍不主动点名飞机 (平衡批裁定)。
// 保留面: Plane.die 原子链 (D1) / 残骸 / 航弹→nades / 跳伞归队闸 / aimAssist 接线点全不动;
//   verify-phase2 K1~K7 与 verify-loiterfix L1-L3 在 run-all-verify 里原样保持通过。
// 沙箱样板与 verify-phase4-7b 同源 (桩式 THREE/DOM/AudioContext, 只跑战役 0)。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
let PASS=0,FAIL=0;
function ok(c,m){ if(c){PASS++; console.log('  ✓ '+m);} else {FAIL++; console.log('  ✗ '+m);} }

// ── 静态断言 ──
const cfg=read('js/00-config.js'), air=read('js/16-aircraft.js'), cbt=read('js/13-combat.js');
console.log('S 静态: 单源/收口/契约面');
ok((air.match(/function planeHitR\(/g)||[]).length===1
&&(air.match(/function planeHitTest\(/g)||[]).length===1
&&(air.match(/function planeNearTest\(/g)||[]).length===1
&&air.indexOf('return 2.4*((pl.def&&pl.def.size)||1);')>=0
&&cbt.indexOf('function planeHitTest')<0&&cbt.indexOf('function planeHitR')<0,'S1 对空命中单源三件套定义唯一 (planeHitR/planeHitTest/planeNearTest 在 16-aircraft, 13-combat 零定义)');
ok(air.indexOf('const ah=planeHitTest(o,dirA,200,this.team);')>=0
&&air.indexOf('if(ah&&!raycastWorld(o,dirA,ah.t)){')>=0
&&air.indexOf('ah.pl.takeDmg(this.def.mgDmg*0.7,shooter);')>=0
&&air.indexOf('3.2*3.2')<0&&air.indexOf('rel.lengthSq()-tp*tp')<0,'S2 fireMGBurst 双轨合并: 对空判定走 planeHitTest 单源 + raycastWorld 遮挡 (F7 隔山打消除), 旧手写 3.2 平径球测绝迹');
ok(air.indexOf('planeNearTest(f.pos.x,f.pos.y,f.pos.z,f.owner&&f.owner.isPlayer?11:8,f.team)')>=0
&&air.indexOf('fp.takeDmg(f.owner&&f.owner.isPlayer?rand(34,58):rand(20,34)*GROUNDGUN_VS_AIR,f.owner);')>=0
&&air.indexOf('p.pos.distanceTo(f.pos)<')<0,'S3 高炮近炸: 引信半径 8/11 保留, 判定几何收口 planeNearTest (旧手写点距循环绝迹; GROUNDGUN_VS_AIR 弹伤口径原样)');
ok(cbt.indexOf("if(typeof planeHitTest==='function'&&shooter&&!def.noAirHit){")>=0
&&air.indexOf('noAirHit:true},o);')>=0
&&cbt.indexOf('const ph=planeHitTest(origin,dir,wallD,shooter.team);')>=0
&&cbt.indexOf('} else if(hitPlane&&planeD<=Math.min(tankD,truckD)){')>=0
&&cbt.indexOf('AIRMG_SCRATCH_MG:AIRMG_SCRATCH_SOL')>=0
&&cbt.indexOf('shooter.isPlayer?1:GROUNDGUN_VS_AIR')>=0
&&cbt.indexOf('navalD<=Math.min(tankD,truckD,planeD)')>=0,'S4 轻武器对空 (Q3): fireBullet 敌机实体化 (挡弹道+刮血档 AIRMG_SCRATCH_*, Bot×GROUNDGUN_VS_AIR 玩家档不减; 机炮弹 noAirHit 旗标豁免 —— 射手是 crewBot 时身份判据不可靠, 以弹定义单源; 舰船/坦克/卡车近距裁决收 planeD)');
ok(cbt.indexOf('const pr=planeHitTest(d.pos,dir,hitD);')>=0
&&cbt.indexOf('planeHitR(pl)+0.4')>=0
&&cbt.indexOf('2.3*pl.def.size')<0&&cbt.indexOf('2.2*pl.def.size')<0,'S5 巡飞弹对机: 主判定 planeHitTest + 兜底 planeHitR+0.4 (旧 2.3×size 圆柱 / 2.2×size 手写绝迹)');
ok(cbt.indexOf("test(pl.pos.x,pl.pos.y,pl.pos.z,planeHitR(pl),pl,'plane');")>=0
&&cbt.indexOf('2.4*((pl.def&&pl.def.size)||1)')<0,'S6 aimAssist 候选半径收口 planeHitR (13-combat 手写 size 半径绝迹, 唯一定义在 16-aircraft)');
ok((cbt.match(/radius\+planeHitR\(pl\)/g)||[]).length>=2&&cbt.indexOf('radius+3')<0,'S7 溅射对机 (ff 态): 爆半径+机体半径 planeHitR 单源 (旧手写 +3 绝迹, 命中与衰减两处同式)');
ok(/const AIRMG_SCRATCH_SOL=\[1,3\];/.test(cfg)&&/const AIRMG_SCRATCH_MG=\[2,5\];/.test(cfg),'S8 刮血档单源 (00-config): 步兵弹 [1,3] / 机枪级弹 [2,5], Q3 "刮血"生态位');

// ── 运行时沙箱 (桩与 verify-phase4-7b 同源, 只跑战役 0) ──
// ── 运行时沙箱 (桩与 verify-phase4-7a 同源, 只跑战役 0) ──
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
applyAxisAngle(){return this;}setFromMatrixColumn(){return this;}lerpVectors(){return this;}project(){return this;}}
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
const _mat=cls=>{ return class extends cls{constructor(o){super();Object.assign(this,o||{});this.color=_wrapColor(this.color);}clone(){ return new this.constructor(Object.assign({},this,{color:this.color})); }}; };
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
BoxGeometry:Geo,CylinderGeometry:Geo,SphereGeometry:_FF17Sph(Geo),ConeGeometry:Geo,TorusGeometry:Geo,RingGeometry:Geo,CircleGeometry:Geo,PlaneGeometry:_PlaneGeo,
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
HemisphereLight:class extends Obj3{constructor(a,b,i){super();this.intensity=i;this.color=new _Color(a);this.groundColor=new _Color(b);}},
PointLight:class extends Obj3{},
Box3:class{setFromObject(){return this;}expandByObject(){return this;}},
Clock:class{getDelta(){return 0;}},
Matrix4:class{compose(){return this;}makeRotationFromEuler(){return this;}},
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
createDynamicsCompressor(){return {threshold:AP(),ratio:AP(),attack:AP(),release:AP(),cancelScheduledValues(){},connect(){}};}
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
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document;ctx.window=window;
for(const f of ['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/23-deploy.js','js/24-main.js']) load(ctx,f);


console.log('DEBUG R3');
const r=vm.runInContext(`(()=>{
try{
const out={};
const btn=document.getElementById('startBtn');
if(btn&&btn.onclick) btn.onclick(); else return 'no startBtn.onclick';
const pl=planes[0];
const foe=pl.team===0?1:0;
const ep=planes.find(p=>p.team===foe);
const savedPlanes=planes.splice(0,planes.length);
const savedSol=soldiers.splice(0,soldiers.length);
const savedCb=(combatants!==soldiers)?combatants.splice(0,combatants.length):[];
const realRCW=raycastWorld; raycastWorld=()=>null;
pl.pos.set(0,300,0); ep.alive=true; ep.hp=ep.maxHp; ep.pos.set(0,50,40); ep.team=foe;
planes.push(pl,ep);
const botTeam=1-foe;
const bot1={alive:true,team:botTeam,isPlayer:false,spectator:false,lastFiredT:0,pos:V3(0,2,0)};
const dirUp=V3(0,48,40).normalize();
const wr=raycastWorld(V3(0,2,0),dirUp,400); out.wr=wr===null?'null':'obj';
const uw=waterEntryDist(V3(0,2,0),dirUp,400); out.uw=String(uw);
const ph=planeHitTest(V3(0,2,0),dirUp,400,botTeam);
out.ph=ph?('t='+ph.t.toFixed(2)):'null';
let tk=null; for(const t of tanks){ if(t.alive){ const rr=rayCyl(V3(0,2,0),dirUp,vehHitCyl(t),400); if(rr&&!tk) tk='t='+rr.t.toFixed(1); } }
out.tankHit=tk||'none';
const sr=raySoldiers(V3(0,2,0),dirUp,400,bot1); out.sol=sr?('t='+sr.t.toFixed(1)):'null';
fireBullet(bot1,V3(0,2,0),dirUp,{dmg:25,headMul:1.5,snd:'smg',tracer:9},null);
out.drop=ep.maxHp-ep.hp;
planes.splice(0,planes.length); for(const p of savedPlanes) planes.push(p);
soldiers.splice(0,soldiers.length); for(const x of savedSol) soldiers.push(x);
if(combatants!==soldiers){ combatants.splice(0,combatants.length); for(const x of savedCb) combatants.push(x); }
raycastWorld=realRCW;
return JSON.stringify(out);
}catch(e){ return 'EXC:'+String(e&&e.stack||e); }})()`,ctx);
console.log(r);
