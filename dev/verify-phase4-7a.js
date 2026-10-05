// ─────────────────────────────────────────────
// dev/verify-phase4-7a.js —— P3 阶段四子批 7a 判据: 飞行模型重写 (fctl 意图接口 + 增强街机) + 飞机火控 HUD
// 用法: node dev/verify-phase4-7a.js
// 结构: S1~S10 静态断言 (源码/接线/契约面) + R1~R8 运行时钉值 (真沙箱开局后驱动 Plane)。
// 7b-甲 (2026-09-30) 并入本脚本: 速度全线 -20% (S10/R3 重钉) + 反空接难度表 (S7~S9/R8) + airmg 加宽 (R7 钉值)。
// 口径对照: docs/设计盘点-P3空战重写-20260930.md §5-7a; 契约边界 §3 (die() 原子序/接口面/beacon 不动)。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
let PASS=0,FAIL=0;
function ok(c,m){ if(c){PASS++; console.log('  ✓ '+m);} else {FAIL++; console.log('  ✗ '+m);} }

// ── 静态断言 ──
const cfg=read('js/00-config.js'), air=read('js/16-aircraft.js'), cbt=read('js/13-combat.js'),
      seats=read('js/20a-seats.js'), hud=read('js/22-hud.js'), html=read('index.html'), css=read('css/style.css'),
      bots=read('js/14-bots.js');
console.log('S 静态: 单源/接线/契约面');
ok(cfg.indexOf('const PLANE_FLIGHT={')>=0&&['birthSpeed','ceiling','bound','bankMax','yawFromBank','sinkG','diveGain','overMul','cruiseMin','patrolR','rearmT','agil'].every(k=>cfg.indexOf(k+':')>=0),'S1 PLANE_FLIGHT 单源常量块齐全 (00-config)');
ok((cfg.match(/agil:/g)||[]).length>=13,'S1b 12 机型 agil 敏捷度 + 缺省值 (00-config)');
ok(['birthSpeed','ceiling','bound','cruiseMin','cruiseOver','patrolR','patrolSpd','rearmT'].every(k=>air.indexOf('PLANE_FLIGHT.'+k)>=0),'S2 16-aircraft 消费 PLANE_FLIGHT (魔法数收编)');
ok(!/\bspeed=44\b/.test(air)&&air.indexOf('MAP_SIZE/2+140')<0&&/Math\.max\(62,terrainMaxH\(\)\+42\)/.test(air)===false,'S2b 旧内联 44 / +140 / 62+42 已绝迹');
ok(cbt.indexOf('airmg:{')>=0&&air.indexOf("'airmg'")>=0,"S3 航炮吸附改走 airmg 档 (13-combat 定义 + 16-aircraft 接线)");
ok(air.indexOf("shooter===player&&typeof aimAssistDir==='function'")>=0,'S3b T7 吸附接线点子串原样保留 (verify-aimassist 静态断言不破)');
ok(air.indexOf('this.grp.visible=false')>=0&&air.indexOf('this.grp.visible=false')<air.indexOf('planeWrecks.push({'),'S4 die() 原子序未动: 本体隐藏先于残骸入列 (verify-loiterfix L2 口径复诵)');
['gunPip','airPip','ccipPip','strafePip'].forEach(id=>{
ok(html.indexOf('id="'+id+'"')>=0&&css.indexOf('#'+id+' ')>=0,'S5 index.html+css 含 #'+id);
ok(seats.indexOf("'"+id+"'")>=0,'S5b 20a-seats.updatePlayerPlane 驱动 '+id);
ok(hud.indexOf("hudHideReal('"+id+"')")>=0,'S5c 22-hud 兜底 sweep 收 '+id+' (D6 双写点纪律)');
});
ok(['const planes=[]','class Plane','function enemyPlaneAlive','function fireFlak','function updateFlak','function updatePlaneWrecks','function terrainMaxH'].every(s=>air.indexOf(s)>=0)
&&['update(dt)','velVec()','fwdDir()','takeDmg(amt,attacker)','die(attacker)','respawn()','buildMesh()','flightStep(dt)'].every(s=>air.indexOf(s)>=0),'S6 契约面不动: 三全局表/五全局函数/八方法 (盘点 §3-1)');

// ── 7b-甲 静态: 反空链路接难度表 + 速度全线 -20% ──
ok(cfg.indexOf('const AA_DIFF=[')>=0&&/jit:45,/.test(cfg)&&/jit:25,/.test(cfg)&&/jit:14,/.test(cfg),'S7 AA_DIFF 单源 (00-config): 高炮瞄准散布三档 45/25/14 (旧 ±25 写死收编)');
ok(bots.indexOf('AA_DIFF[SETTINGS.diff].jit')>=0&&bots.indexOf('rand(-25,25)')<0,'S7b 14-bots 高炮散布接 AA_DIFF, 旧写死 rand(-25,25) 绝迹');
ok(cfg.indexOf('const PLANE_DIFF=[')>=0&&/eng:0\.70,/.test(cfg)&&/eng:1\.25,/.test(cfg),'S8 PLANE_DIFF 单源 (00-config): AI 机接战距离/射速三档 (新兵软/精英狠)');
ok((air.match(/PLANE_DIFF\[SETTINGS\.diff\]/g)||[]).length>=4,'S8b 16-aircraft 消费 PLANE_DIFF ≥4 处 (缠斗进入 + 对空开火门限 + 对空/对地射速)');
ok(air.indexOf('if(attacker&&!attacker.isPlayer) amt*=DIFF_TABLE[SETTINGS.diff].dmgMul;')>=0
&&air.indexOf('if(attacker&&!attacker.isPlayer) amt*=DIFF_TABLE[SETTINGS.diff].dmgMul;')<air.indexOf('this.hp-=amt;'),'S9 Plane.takeDmg 接 DIFF_TABLE.dmgMul (Bot→飞机伤害单点收口, 玩家源不乘)');
ok(cfg.indexOf('spd:[26,51]')>=0&&cfg.indexOf('spd:[33,66]')<0&&(cfg.match(/spd:\[/g)||[]).length===12,'S10 12 机型 spd 全线 -20% (P-51 [32,64]→[26,51]; 零式 [33,66] 绝迹)');
ok(/birthSpeed:35,/.test(cfg)&&/diveGain:21,/.test(cfg)&&/patrolSpd:38,/.test(cfg)&&/spdFloor:11,/.test(cfg),'S10b PLANE_FLIGHT 四常量同步 -20% (birthSpeed 35 / diveGain 21 / patrolSpd 38 / spdFloor 11)');

// ── 运行时沙箱 (桩与 probe-planes 同源, 只跑战役 0) ──
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
for(const f of ['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15g-capmodels.js','js/15h-capital.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/23-deploy.js','js/24-main.js']) load(ctx,f);

console.log('R 运行时: 飞行核心钉值 (真沙箱, 战役 0)');
const r=vm.runInContext(`(()=>{
try{
const out={};
const btn=document.getElementById('startBtn');
if(btn&&btn.onclick) btn.onclick(); else return 'no startBtn.onclick';
const PF=PLANE_FLIGHT;
const pl=planes[0];
// ── R1 协调转弯: flightStep 直驱, 满舵右压坡 ──
pl.alive=true; pl.playerDriven=false; pl.crewBot=null; // 摘 AI: 纯 flightStep 单元测试
pl.pos.set(0,120,0); pl.yaw=0; pl.pitch=0; pl.roll=0; pl.speed=50;
pl.fctl={bank:1,pitchT:0,spdTgt:50};
for(let i=0;i<120;i++) pl.flightStep(1/60);
const agi=pl.def.agil||PF.agil, rollT=PF.bankMax*agi;
out.r1roll=pl.roll; out.r1rollT=rollT;
const y0=pl.yaw;
for(let i=0;i<60;i++) pl.flightStep(1/60);
out.r1yawRate=(y0-pl.yaw); // 右转 = yaw 减小 (playerFly 口径: D → yaw--)
const spdFac=PF.spdFac0+50*PF.spdFacK;
out.r1expect=Math.sin(pl.roll)*PF.yawFromBank*spdFac*agi;
out.r1ok=Math.abs(pl.roll-rollT)<rollT*0.02&&Math.abs(out.r1yawRate-out.r1expect)<out.r1expect*0.05&&out.r1yawRate>0.5;
// ── R2 伪升力: 玩家链 (playerDriven) 平飞零下沉 / 满坡下沉钉值 ──
pl.playerDriven=true; pl.alive=true; pl.hp=pl.maxHp;
pl.pos.set(0,100,0); pl.yaw=0; pl.pitch=0; pl.roll=0; pl.speed=50;
for(const k in keys) keys[k]=false;
player.pitch=0; player.onVehicle=pl;
let yA=pl.pos.y; for(let i=0;i<120;i++){ pl.update(1/60); } out.r2levelDrop=yA-pl.pos.y;
keys.KeyD=true;
for(let i=0;i<180;i++) pl.update(1/60); // 3s: 坡度建立
yA=pl.pos.y; const rollRef=pl.roll, pitRef=pl.pitch, spdRef=pl.speed;
for(let i=0;i<60;i++) pl.update(1/60);
out.r2bankDrop=(yA-pl.pos.y);
out.r2expect=PF.sinkG*(1-Math.max(0,Math.cos(pitRef)*Math.cos(rollRef)))-Math.sin(pitRef)*spdRef;
keys.KeyD=false;
out.r2ok=Math.abs(out.r2levelDrop)<0.8&&Math.abs(out.r2bankDrop-out.r2expect)<Math.abs(out.r2expect)*0.12;
// ── R3 速度耦合: 俯冲加速 / 超速上限 (flightStep 直驱, 不受天花板干扰) ──
pl.playerDriven=false; pl.crewBot=null;
pl.speed=40; pl.pitch=-0.7; pl.roll=0; pl.fctl={bank:0,pitchT:-0.7,spdTgt:40};
for(let i=0;i<180;i++) pl.flightStep(1/60);
out.r3dive=pl.speed; out.r3cap=pl.def.spd[1]*PF.overMul;
// 7b-甲: diveGain 26→21 ⇒ 理论收敛 ≈40+21×sin(0.7)≈53.5 的 0.808 阻尼份额 ≈50.9 —— 阈值放 48 保留余量
out.r3okA=pl.speed>48&&pl.speed<=out.r3cap+1e-6;
pl.pitch=0.8; pl.fctl.pitchT=0.8; // 爬升掉速
for(let i=0;i<360;i++) pl.flightStep(1/60);
out.r3climb=pl.speed; out.r3floor=Math.max(PF.spdFloor,pl.def.spd[0]*PF.underMul);
out.r3okB=pl.speed<40&&pl.speed>=out.r3floor-1e-6;
// ── R4 失控螺旋 (crewBot 无): 满舵坡度+扎头, 可复现盘旋下坠 ──
pl.playerDriven=false; pl.crewBot=null; pl.alive=true;
pl.pos.set(0,100,0); pl.yaw=0; pl.pitch=0; pl.roll=0; pl.speed=50; pl.hp=pl.maxHp;
for(let i=0;i<150;i++){ if(!pl.alive) break; pl.update(1/60); }
out.r4roll=pl.roll; out.r4pitch=pl.pitch; out.r4finite=isFinite(pl.pos.x)&&isFinite(pl.pos.y)&&isFinite(pl.pos.z);
out.r4ok=out.r4finite&&pl.roll>0.9&&pl.pitch<0;
// ── R5 AI 四态可运行 + dt=0 时停冻结 (K6 复诵) ──
const ai=planes.find(q=>q!==pl&&q.crewBot&&q.crewBot.alive);
out.r5has=!!ai; out.r5ok=false;
if(ai){
const p0=ai.pos.clone(), r0=ai.roll, pi0=ai.pitch, s0=ai.speed;
ai.update(0);
out.r5frozen=ai.pos.distanceTo(p0)===0&&ai.roll===r0&&ai.pitch===pi0&&ai.speed===s0;
let okRun=true;
for(let i=0;i<300&&okRun;i++){ ai.update(1/60); if(!isFinite(ai.pos.x+ai.pos.y+ai.pos.z)) okRun=false; }
out.r5ran=okRun; out.r5ok=out.r5frozen&&okRun;
}
// ── R6 fctl 经 update 消费 (玩家链右转 + 本体同步) ──
pl.playerDriven=true; pl.alive=true; pl.hp=pl.maxHp;
pl.pos.set(0,100,0); pl.yaw=0; pl.pitch=0; pl.roll=0; pl.speed=50;
for(const k in keys) keys[k]=false;
player.pitch=0;
keys.KeyD=true;
for(let i=0;i<120;i++) pl.update(1/60);
keys.KeyD=false;
out.r6turn=(0-pl.yaw)>0.3; out.r6sync=Math.abs(player.yaw-(pl.yaw+Math.PI))<1e-9;
out.r6ok=out.r6turn&&out.r6sync&&player.onVehicle===pl;
// ── R7 airmg 档钉值 (7b-甲 加宽后钉死): 窗口 5° / 硬上限 3.4° / 射程 350, 且仍宽于固定 MG 档 ──
const am=AIM_PROFILES.airmg;
out.r7ok=(typeof am==='object')&&am.cone===5&&am.cap===3.4&&am.range===350&&am.cone>AIM_PROFILES.mg.cone&&am.cap>AIM_PROFILES.mg.cap;
out.r7cone=am.cone;
// ── R8 (7b-甲) 难度表接线行为: takeDmg 倍率单点 + PLANE_DIFF 接战距离分档 ──
const fakeBot={isPlayer:false,team:1,pos:V3(0,0,0)};
SETTINGS.diff=0; ai.hp=ai.maxHp; ai.takeDmg(40,fakeBot); const r8d0=ai.maxHp-ai.hp;
SETTINGS.diff=2; ai.hp=ai.maxHp; ai.takeDmg(40,fakeBot); const r8d2=ai.maxHp-ai.hp;
ai.hp=ai.maxHp; ai.takeDmg(40,player); const r8dp=ai.maxHp-ai.hp;
out.r8c=[r8d0,r8d2,r8dp]; out.r8a=(r8d0===28&&r8d2===50&&r8dp===40);
ai.playerDriven=false;
const epR8=planes.find(q=>q.alive&&q.team!==ai.team);
ai.state='patrol'; ai.stateT=99; ai.target=null; ai.evadeT=0;
ai.pos.set(0,100,0); epR8.alive=true; epR8.pos.set(230,100,0); ai.yaw=0; ai.pitch=0; ai.roll=0; ai.speed=40;
SETTINGS.diff=0;
let r8e0=false; for(let i=0;i<60;i++){ ai.update(1/60); if(ai.state==='dogfight'){ r8e0=true; break; } }
SETTINGS.diff=2; ai.state='patrol'; ai.stateT=99; ai.target=null; ai.evadeT=0;
ai.pos.set(0,100,0); epR8.pos.set(230,100,0); ai.yaw=0; ai.pitch=0; ai.roll=0; ai.speed=40;
let r8e2=false; for(let i=0;i<90;i++){ ai.update(1/60); if(ai.state==='dogfight'){ r8e2=true; break; } }
SETTINGS.diff=1;
out.r8b=!r8e0&&r8e2;
return out;
}catch(e){ return 'EXC:'+String(e&&e.stack||e); }})()`,ctx);
if(typeof r==='string'){ console.log('  ✗ 运行时沙箱异常: '+r); FAIL++; }
else{
ok(r.r1ok,'R1 协调转弯: 满舵坡度='+(+r.r1roll).toFixed(3)+'≈bankMax×agil, 偏航率 '+(+r.r1yawRate).toFixed(3)+'≈sin(roll)×yawFromBank×spdFac ('+(+r.r1expect).toFixed(3)+')');
ok(r.r2ok,'R2 伪升力: 平飞下沉 '+(+r.r2levelDrop).toFixed(2)+'m/s≈0, 满坡下沉 '+(+r.r2bankDrop).toFixed(2)+'≈钉值 '+(+r.r2expect).toFixed(2)+' m/s');
ok(r.r3okA,'R3a 俯冲加速: 40→'+(+r.r3dive).toFixed(1)+' m/s, 上限 spd1×overMul='+(+r.r3cap).toFixed(1)+' 不破');
ok(r.r3okB,'R3b 爬升掉速: →'+(+r.r3climb).toFixed(1)+' m/s, 地板 max(spdFloor,spd0×underMul)='+(+r.r3floor).toFixed(1)+' 不破 (永不失速)');
ok(r.r4ok,'R4 失控螺旋: 满舵坡度 '+(+r.r4roll).toFixed(2)+' + 扎头 '+(+r.r4pitch).toFixed(2)+', 位姿有限, fctl 口径可复现');
ok(r.r5ok,'R5 AI 机: dt=0 逐位冻结 (K6 复诵) + 5s 真实推演无 NaN');
ok(r.r6ok,'R6 fctl 经 update 消费: 玩家链右转 + player.yaw=机头+π 同步 (旧 playerFly 尾部口径保位)');
ok(r.r7ok,'R7 airmg 档钉值 (甲): cone '+r.r7cone+'° / cap 3.4° / range 350 (宽于固定 MG 档)');
ok(r.r8a,'R8a (甲) takeDmg 难度倍率: Bot 源 40→'+r.r8c[0]+' (新兵×0.7) / '+r.r8c[1]+' (精英×1.25), 玩家源 '+r.r8c[2]+' 不乘');
ok(r.r8b,'R8b (甲) PLANE_DIFF 接战分档: 230m 处新兵不进缠斗 (门限 240×0.7=168), 精英进 (×1.25=300)');
}
console.log('\n'+(FAIL===0?'verify-phase4-7a 全部通过 ✓ ('+PASS+')':'存在失败项 ✗ (过 '+PASS+' / 挂 '+FAIL+')'));
process.exit(FAIL===0?0:1);
