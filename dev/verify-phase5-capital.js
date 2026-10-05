// ─────────────────────────────────────────────
// dev/verify-phase5-capital.js —— 阶段五 P4 判据: 大舰 (战列舰/航母) 子系统
// 用法: node dev/verify-phase5-capital.js
// 结构: S1~S6 静态断言 (冻结 API / 接线点 / 单源 / 建模硬约束) + R1~R16 运行时钉值 (真沙箱, 战役 12 珊瑚海)。
// 覆盖的四条用户裁定 (登记表 §五 阶段五开工问项, 2026-09-30):
//   ① 舰载机简化起降 (弹射起飞 + 触舰拦阻) —— 8b, 本文件钉航母子系统面
//   ② 大舰被击毁 = 瘫痪: 永久海上陆地 (外壳留/上层焦/炮位废/动力零/甲板照走/旗点照争/不重生)
//   ③ 缓慢巡航 (沿巡逻环) + 甲板 = 移动平台 (乘员跟着走)
//   ④ 全海图 · 舰上旗点 (旗点绑定到舰体局部坐标, 每帧跟随)
// 沙箱样板与 verify-phase4-7b/7c/7d 同源 (桩式 THREE/DOM/AudioContext); **文件清单 = index.html 实载面**
// (含 15c/15e/15d/15f/15g/15h/22a/22b/23b —— 探针载入盲区教训: 清单不齐 = 假绿)。
// ─────────────────────────────────────────────
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
let PASS=0,FAIL=0;
function ok(c,m){ if(c){PASS++; console.log('  ✓ '+m);} else {FAIL++; console.log('  ✗ '+m);} }

// ── 静态断言 ──
console.log('S 静态: 冻结 API / 接线点 / 单源 / 建模硬约束');
{
const cap=read('js/15h-capital.js'), mod=read('js/15g-capmodels.js'), cfg=read('js/00-config.js');
const API=['capToWorld','capToLocal','capDeckY','capDeckOf','capDeckShipAt','capCarryDelta','capPushBody','capPushCraft','capLocalSolve',
'capitalRayHit','capitalRayQuery','capitalBulletTest','capitalShellHit','capitalTorpedoHit','capitalSplash',
'updateCapital','capitalSpawnOrbat','capBasePos','capNearestBoardable','capBoard','capSeatRelease',
'capCanExitNow','capExitNow','capitalFlagTick','capitalReset','capitalNear','capNavDirect','capBotTick',
'capSpawnGroundY'];
const miss=API.filter(n=>cap.indexOf('function '+n+'(')<0);
ok(miss.length===0,'S1 冻结 API 齐备 ('+API.length+' 项)'+(miss.length?' 缺: '+miss.join(','):''));
ok(/function capBuildModel\(spec\)\{/.test(mod)&&/R\.boxes\.push/.test(mod)&&/R\.deck=\{/.test(mod)
&&/R\.hull=\{/.test(mod),'S2 15g 冻结契约: capBuildModel(spec) → {grp,turrets,secMounts,aaMounts,cats,arrest,boxes,hull,deck,dims} 单源');
}
{
const col=read('js/04-collision.js'), veh=read('js/15-vehicles.js'), cb=read('js/13-combat.js'),
    main=read('js/24-main.js'), dep=read('js/23-deploy.js'), cf=read('js/00-config.js'), bot=read('js/14-bots.js'),
    lay=read('js/05c-layouts.js'), hud=read('js/22-hud.js');
const W=[['standHeight 甲板挂钩',col,"if(typeof capDeckY==='function')"],
['collideMove 舰体推出',col,"if(typeof capPushBody==='function') capPushBody(pos,radius)"],
['updateShells 对舰命中',veh,"if(typeof capitalShellHit==='function'"],
['splashDamage 溅射对舰',cb,"if(typeof capitalSplash==='function') capitalSplash("],
['fireBullet 弹道收窄',cb,"if(typeof capitalRayQuery==='function')"],
['fireBullet 对舰扣血',cb,"if(typeof capitalBulletTest==='function')"],
['aimAssist 大舰目标',cb,"Array.isArray(capitalShips))"],
['specRide 大舰座位',cb,"player.onCapital===v"],
['main 循环 updateCapital',main,"if(typeof updateCapital==='function') updateCapital(dt,pdt)"],
['basePos 跟随旗舰',cf,"if(typeof capBasePos==='function')"],
['startMatch 编制生成',dep,"if(typeof capitalSpawnOrbat==='function') capitalSpawnOrbat()"],
['bot setPathTo 甲板直行',bot,"if(typeof capNavDirect==='function')"],
['bot moveDir 水障放行',bot,"this.swim||this.onCapDeck"],
['出生落点豁免',read('js/17-emplacements.js'),"if(typeof capDeckOf==='function'"],
['甲板旗点基高',lay,"onDeck?capDeckWorldY(f.ship):heightAt(f.x,f.z)"],
['甲板旗跟随接线',hud,"typeof capitalReset==='function'"],   // 2026-10-01b 海战大修: 收账改"复位不删舰" (capitalReset 单源, 旧 capitalShips.length=0 已废)
];
const bad=W.filter(w=>w[1].indexOf(w[2])<0);
ok(bad.length===0,'S3 接线点 ('+W.length+' 处, 全为 typeof 守卫的可选模块接线)'+(bad.length?' 缺: '+bad.map(x=>x[0]).join(','):''));
}
{
const cap=read('js/15h-capital.js'), cfg=read('js/00-config.js');
ok(/const CAPITAL_SPEC=\{/.test(cfg)&&/bb_us:\{/.test(cfg)&&/bb_jp:\{/.test(cfg)
&&/cv_us:\{/.test(cfg)&&/cv_jp:\{/.test(cfg),'S4 大舰规格表 4 型单源 (bb_us/bb_jp/cv_us/cv_jp)');
ok(/const capitalShips=\[\];/.test(cap)&&!/navalCraft\.push/.test(cap),
'S5 独立登记表: capitalShips 与 navalCraft 零交集 (大舰不进小艇表 —— 两者的"跳过已毁"谓词语义相反)');
ok(cap.indexOf("state==='crippled'")>=0&&cap.indexOf("this.state='run'")>=0
&&!/\.beginDestroy\(/.test(cap)&&!/this\.respawnT/.test(cap),
'S6 瘫痪链与小艇沉没链零交集 (不调 15d 的 beginDestroy, 无重生计时, alive 恒 true; 2026-10-01c 锚收窄到舰本体 this.respawnT —— 甲板炮手 b.respawnT=1e9 是 Bot 实体的"永不复活"钉, 不是舰的重生计时)');
}
{
const mod=read('js/15g-capmodels.js');
ok(mod.indexOf('new THREE.MeshLambertMaterial')>=0&&/function cpMats\(S\)\{/.test(mod)
&&mod.indexOf('capWreckMat')<0,'S7 硬约束③ 每舰材质全新一套 (cpMats 逐舰 new; 残骸材质在 15h 侧)');
ok(mod.indexOf('THREE.Group()')>=0&&!/\.scale\.set\(/.test(mod)&&!/new THREE\.(DirectionalLight|AmbientLight|PerspectiveCamera)/.test(mod),
'S8 硬约束 ②④⑤⑥: 不放灯光/相机, 无 grp.scale');
ok(mod.indexOf('new THREE.TextureLoader')<0&&mod.indexOf('new THREE.FileLoader')<0&&mod.indexOf('XMLHttpRequest')<0,'S9 硬约束① 纯程序化几何, 零外部资源');
}

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
class Obj3{constructor(){this.position=new V3();this.rotation=new Euler();this.scale=new V3(1,1,1);this.quaternion={setFromUnitVectors(){return this;},copy(){return this;}};this.children=[];this.visible=true;this.castShadow=false;this.receiveShadow=false;this.renderOrder=0;this.matrix={};this.userData={};this.material=null;this.geometry=null;}   // quaternion.copy: updateRagdolls 逐部件同步要用 (2026-10-01c 炮手布娃娃在 R30 之前的场景生成, 补丁必须挂在桩类上而不是事后两具)
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
localStorage:{_s:{sf_campaign:'12'},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}},
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
// 布娃娃链的 CANNON 桩 (R30 用): **必须从沙箱外**挂到 ctx 上 —— 沙箱里的 `globalThis` 是 Object.assign
//   拷进来的那个普通对象的属性, 在 vm 内写 globalThis.CANNON 只会改到那份副本, 全局查不到。
//   12-ragdolls 两条读法都要喂: ragInit 读 window.CANNON, mkPart 读裸 CANNON。
{
const cv=THREE.Vector3;   // 桩 V3 (position/velocity/quaternion 只用到 set/copy)
const CS={
Vec3:cv, Box:class{constructor(v){this.v=v;}}, Sphere:class{},
Material:class{}, ContactMaterial:class{}, NaiveBroadphase:class{},
PointToPointConstraint:class{constructor(){}},
Body:class{constructor(o){Object.assign(this,o||{});
this.position=new cv(); this.velocity=new cv(); this.angularVelocity=new cv();
this.quaternion={setFromEuler(){return this;}}; this.shapes=[];}
addShape(s){this.shapes.push(s);}},
World:class{constructor(){this.bodies=[]; this.gravity=new cv(); this.solver={iterations:5};}
addBody(b){this.bodies.push(b);} removeBody(b){const i=this.bodies.indexOf(b); if(i>=0)this.bodies.splice(i,1);}
add(b){this.addBody(b);} remove(b){this.removeBody(b);} addConstraint(){} removeConstraint(){} step(){}},
};
ctx.CANNON=CS; window.CANNON=CS;
}
// 文件清单 = index.html 实载面 (41 脚本, 差一个就是假绿的温床 —— 见 探针载入盲区教训)
const FILES=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/15g-capmodels.js','js/15h-capital.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/19b-gamepad.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/22a-menuart.js','js/22b-speclayer.js','js/23-deploy.js','js/23b-worldrestore.js','js/24-main.js'];
for(const f of FILES) load(ctx,f);
console.log('R 运行时: 珊瑚海 (战役 12) 大舰全链');
const rr=vm.runInContext(`(()=>{
try{
const out={};
const btn=document.getElementById('startBtn');
if(btn&&btn.onclick) btn.onclick(); else return 'no startBtn.onclick';
if(typeof capitalShips==='undefined') return 'capitalShips undeclared';

// R1 编制: 珊瑚海 4 舰, 两队各一战列一航母
out.r1=(capitalShips.length===4)
&&(capitalShips.map(s=>s.key).join(',')==='bb_us,cv_us,bb_jp,cv_jp')
&&(capitalShips.map(s=>s.team).join(',')==='0,0,1,1');

// R2 甲板旗点绑定: 6 个带 ship 的旗点全部绑到对应舰, 且落在甲板矩形内
let nb=0, okb=true;
for(const f of FLAGS){
if(f.ship===undefined) continue;
const s=capitalShips[f.ship];
if(!s){ okb=false; continue; }
if(Math.abs(f._clx)>s.deck.hw||Math.abs(f._clz)>s.deck.hl) okb=false;
if(s.deckFlags.indexOf(f)<0) okb=false;
nb++;
}
out.r2=(nb===6&&okb);

// R3 巡航: 推 600 帧 (10s@60fps) 位置必须变, 且离巡逻环中心不超过环半轴+船长
const s0=capitalShips[0];
const x0=s0.pos.x, z0=s0.pos.z;
for(let i=0;i<600;i++){ updateCapital(1/60,1/60); }
out.r3=(Math.hypot(s0.pos.x-x0,s0.pos.z-z0)>8)&&(Math.hypot(s0.pos.x-(-230),s0.pos.z-(-30))<180);

// R4 甲板平台
const bb=capitalShips[0];
const dy=bb.pos.y+bb.deck.y;
const c=Math.cos(bb.yaw), sn=Math.sin(bb.yaw);
out.r4=(Math.abs(capDeckY(bb.pos.x,bb.pos.z)-dy)<1e-6)
&&(capDeckY(bb.pos.x+sn*400,bb.pos.z+sn*400)<-1e8)
&&(capDeckY(bb.pos.x+c*(bb.deck.hw+6),bb.pos.z-sn*(bb.deck.hw+6))<-1e8)
&&(capDeckY(bb.pos.x,bb.pos.z,dy-6)<-1e8);

// R5 乘员跟随
const fake={alive:true,team:0,isPlayer:false,onVehicle:null,spectator:false,vel:{x:0,y:0,z:0},pos:V3(0,0,0)};
const lw=capToWorld(bb,0,-62,{x:0,z:0});
fake.pos.set(lw.x,bb.pos.y+bb.deck.y,lw.z);
combatants.push(fake);
for(let i=0;i<180;i++) updateCapital(1/60,1/60);
const lk=capToLocal(bb,fake.pos.x,fake.pos.z,{x:0,z:0});
out.r5=(Math.abs(lk.x-0)<0.35&&Math.abs(lk.z+62)<0.35&&Math.abs(fake.pos.y-(bb.pos.y+bb.deck.y))<1e-6);
combatants.splice(combatants.indexOf(fake),1);

// R6 主炮齐射
const n0=shells.length;
bb.mainCd[0]=0;
const fired=bb.fireMainSalvo(0,V3(bb.pos.x+400,bb.pos.y+6,bb.pos.z));
const sh=shells[shells.length-1];
out.r6=(fired===true)&&(shells.length===n0+3)&&(sh&&Math.abs(sh.vel.length()-SHELL_SPD_NAVAL)<1e-6)&&(sh.kind==='naval');
shells.splice(n0,shells.length-n0);

// R7 分区装甲
const hp0=bb.hp;
bb.takeDmg(1000,null,{tag:'hull'});
const dHull=hp0-bb.hp;
const hp1=bb.hp;
bb.takeDmg(1000,null,{tag:'sup'});
const dSup=hp1-bb.hp;
out.r7=(Math.abs(dHull-1000*bb.spec.armor.hull)<1e-6)&&(Math.abs(dSup-1000*bb.spec.armor.sup)<1e-6);

// R8 瘫痪 (2026-10-01c 炮手随舰阵亡; 2026-10-04 F1 升级: 炮手免票 —— 期望 = spec.ticket, 不再逐炮手 +1)
const ticks0=tickets[bb.team];
const crewN0=(bb.crewBots||[]).filter(x=>x.alive).length;
bb.takeDmg(bb.hp*1.2+10,null,{tag:'sup'});
out.r8=(bb.state==='crippled')&&(bb.alive===true)&&(bb.hp===0)
&&(bb.mainCd[0]>1e8)&&(bb.aaCd[0]>1e8)
&&(bb.grp.children.length>0)
&&(tickets[bb.team]===Math.max(0,ticks0-bb.spec.ticket))   // ★2026-10-04 F1: capCrew 免票 (15h"零票务副作用"契约), 判据随修复升级 (旧式逐炮手 +1 = 瘫舰多漏 9 票)
&&(bb.crewBots.every(x=>!x.alive));

// R9 瘫舰仍是海上陆地
out.r9=(Math.abs(capDeckY(bb.pos.x,bb.pos.z)-(bb.pos.y+bb.deck.y))<1e-6)
&&(bb.deckFlags.length>0)&&(bb.deckFlags[0].gy===bb.pos.y+bb.deck.y);

// R10 鱼雷
const bb2=capitalShips[2];
const hp2=bb2.hp, fl0=bb2.flood;
const tpx=bb2.pos.x+Math.sin(bb2.yaw+Math.PI/2)*(bb2.spec.hullW*0.5);
const tpz=bb2.pos.z+Math.cos(bb2.yaw+Math.PI/2)*(bb2.spec.hullW*0.5);
const th=capitalTorpedoHit(V3(tpx,bb2.pos.y+1.0,tpz),0,0,null);
out.r10=(th===bb2)&&(Math.abs((hp2-bb2.hp)-bb2.spec.torpedoDmg)<1e-6)&&(bb2.flood>fl0);

// R11 甲板旗跟随
const f0=bb.deckFlags[0];
const w0=capToWorld(bb,f0._clx,f0._clz,{x:0,z:0});
out.r11=(Math.abs(f0.x-w0.x)<1e-6&&Math.abs(f0.z-w0.z)<1e-6)
&&(Math.abs(f0.gy-(bb.pos.y+bb.deck.y))<1e-6)
&&(!!f0.flagMesh&&Math.abs(f0.flagMesh.position.x-(w0.x+0.075))<1e-6);

// R12 小艇让路 (2026-10-01d SAT 升级: 推出量=最小平移向量 —— 判据从"沿和矩形轴分离"
// 改为**两 OBB 不再重叠**, 与 capPushCraft 的几何同一支)
if(navalCraft.length){
const c0=navalCraft[0];
c0.pos.set(bb.pos.x, c0.pos.y, bb.pos.z); c0.state='run';
capPushCraft(c0,1/60);
const corners=(s)=>{ const hw=s.spec.hullW*0.5,hl=s.spec.hullL*0.5,co=Math.cos(s.yaw),nn=Math.sin(s.yaw);
return [[s.pos.x+hw*co+hl*nn,s.pos.z-hw*nn+hl*co],[s.pos.x-hw*co+hl*nn,s.pos.z+hw*nn+hl*co],
[s.pos.x+hw*co-hl*nn,s.pos.z-hw*nn-hl*co],[s.pos.x-hw*co-hl*nn,s.pos.z+hw*nn-hl*co]]; };
const pa=corners(bb), pb=corners(c0);
let separated=false;
for(const s of [bb,c0]){ const co=Math.cos(s.yaw),nn=Math.sin(s.yaw);
for(const ax of [[co,-nn],[nn,co]]){
let a0=1e9,a1=-1e9,b0=1e9,b1=-1e9;
for(const p of pa){const d=p[0]*ax[0]+p[1]*ax[1]; if(d<a0)a0=d; if(d>a1)a1=d;}
for(const p of pb){const d=p[0]*ax[0]+p[1]*ax[1]; if(d<b0)b0=d; if(d>b1)b1=d;}
// 1e-6 容差: SAT 推到**贴合**时, 复查的投影三角浮点可能余 +1e-13 的假重叠 (1/6 偶发假红)
if(Math.min(a1,b1)-Math.max(a0,b0)<=1e-6) separated=true;
}}
out.r12=separated;
}else out.r12=true;

// R13 登舰
player.alive=true; player.deployed=true;
player.pos.set(bb.pos.x+Math.sin(bb.yaw+Math.PI/2)*(bb.spec.hullW*0.5+1.5), 0,
               bb.pos.z+Math.cos(bb.yaw+Math.PI/2)*(bb.spec.hullW*0.5+1.5));
player.onVehicle=null; player.onNaval=null;
const nb2=capNearestBoardable();
const boarded=capBoard(nb2,true);
out.r13=(boarded===true)&&(player.onCapital===bb)&&(player.onVehicle===null)&&(player.onNaval===null)
&&(Math.abs(player.pos.y-(bb.pos.y+bb.deck.y))<1e-6);

// R14 航母面
const cvS=capitalShips[1];
out.r14=(cvS.cls==='cv')&&(!!cvS.arrest)&&(cvS.arrest.z1>cvS.arrest.z0)&&(cvS.cats.length===2)
&&(typeof capLaunchPlane==='function')&&(typeof capTryArrest==='function');

// R15 火控
let ok15=true;
try{ for(let i=0;i<120;i++) bb2.step(1/60); }catch(e){ ok15=false; }
out.r15=ok15&&(CAPITAL_CFG.mainR>300)&&(CAPITAL_CFG.aaR>100);

// R16 命中胶囊与射线
const o=V3(bb2.pos.x-300,bb2.pos.y+bb2.spec.draft0,bb2.pos.z);
const rq=capitalRayHit(o,V3(1,0,0),1200,1-bb2.team,0);
const rq2=capitalRayHit(V3(bb2.pos.x,bb2.pos.y+200,bb2.pos.z),V3(0,1,0),400,1-bb2.team,0);
out.r16=(!!rq&&rq.ship===bb2)&&(rq2===null);
// R17 舰载机停放: 开局舰载机停在本队航母飞行甲板上 (capParkPlanes)
// ★2026-10-01d: "机腹贴甲板面"改为 plParkLift 抬升 —— 网格原点在机身轴线, 旧口径钉在甲板面
//   = 半截机身埋进甲板 (实机"飞机在起飞之前是嵌在甲板上的")。
const parked=planes.filter(p=>p&&p.alive&&p.capArrest);
let ok17=parked.length>=4;
for(const p of parked){
const cv=p.capArrest;
if(cv.cls!=='cv'||cv.team!==p.team) ok17=false;
const lc=capToLocal(cv,p.pos.x,p.pos.z,{x:0,z:0});
if(Math.abs(lc.x)>cv.spec.deckHW||Math.abs(lc.z)>cv.spec.deckHL) ok17=false;
if(!(plParkLift(p)>0.3)) ok17=false;
if(Math.abs(p.pos.y-(cv.pos.y+cv.deck.y+plParkLift(p)))>1e-6) ok17=false;
}
out.r17=ok17;

// R18 一键弹射: 停放机弹射后离舰, 直接获得顶速 (无滑跑段)
const p0=parked[0];
const cv0=p0?p0.capArrest:null;
const ok18a=capLaunchPlane(p0,true);
out.r18=(p0.capArrest===null)&&(p0.speed===p0.def.spd[1])&&(p0.pos.y>cv0.pos.y+cv0.deck.y)&&(ok18a===true);

// R19 触舰拦阻: 把同一架机放回甲板上方低速 ⇒ 钩停 (停机高度 = 甲板面+plParkLift, 2026-10-01d)
p0.pos.set(p0.pos.x,cv0.pos.y+cv0.deck.y+0.8,p0.pos.z);
p0.speed=12;
const ok19=capTryArrest(p0);
out.r19=(ok19===true)&&(p0.capArrest===cv0)&&(p0.speed===0)&&(Math.abs(p0.pos.y-(cv0.pos.y+cv0.deck.y+plParkLift(p0)))<1e-6);

// R20 停放的舰载机由甲板承载 (与步兵同一条乘员搬运链; 高度含 plParkLift)
const lc0=capToLocal(cv0,p0.pos.x,p0.pos.z,{x:0,z:0});
for(let i=0;i<120;i++) updateCapital(1/60,1/60);
const lc1=capToLocal(cv0,p0.pos.x,p0.pos.z,{x:0,z:0});
out.r20=(Math.abs(lc0.x-lc1.x)<0.35&&Math.abs(lc0.z-lc1.z)<0.35&&Math.abs(p0.pos.y-(cv0.pos.y+cv0.deck.y+plParkLift(p0)))<1e-6);
// R21 全海图出生: Bot 与舰载机都落在甲板上 (海图 OCC 整片是水障 —— 不吸附就全员落海)
// 只考核"徒步出生"的 Bot —— 小艇乘员 (onVehicle) 本来就该在艇上, 不在甲板上是正当的
const botsOn=combatants.filter(c=>!c.isPlayer&&c.alive&&!c.onVehicle);
let ok21=botsOn.length>0, bad=0;
for(const b of botsOn){
if(!capDeckOf(b.pos.x,b.pos.z)) bad++;
}
out.r21=(bad===0);

// R22 甲板吸附单源: 舷外点被夹回甲板矩形 (且夹的是**参考点所在**的那艘舰)
const snap=capSnapToDeck(s0.pos.x+400,s0.pos.z+400,s0.pos.x,s0.pos.z);
out.r22=(!!snap&&snap.ship===s0)
&&(Math.abs(capToLocal(s0,snap.x,snap.z,{x:0,z:0}).x)<=s0.deck.hw)
&&(Math.abs(capToLocal(s0,snap.x,snap.z,{x:0,z:0}).z)<=s0.deck.hl);
out.r21n=botsOn.length;
// ══════════════════════════════════════════════════════════════════════
// R23~R30: 2026-10-01 实机报（七条系统性缺陷）的判据
// ══════════════════════════════════════════════════════════════════════
// R23 甲板弹药箱跟随 (实机:"旗帜周围的东西对于船体严重漂移")
{
let ok23=true, n23=0;
const crates=(typeof AMMO_CRATES==='undefined')?[]:AMMO_CRATES.filter(c=>c.ship!==undefined&&c.mesh);
for(const c of crates){
const cs=capitalShips[c.ship];
if(!cs){ ok23=false; continue; }
n23++;
if(Math.abs(c.lx)>cs.deck.hw+1||Math.abs(c.lz)>cs.deck.hl+1) ok23=false;   // 换算出的局部坐标必须还在**该舰**甲板内
const w=capToWorld(cs,c.lx,c.lz,{x:0,z:0});
if(Math.abs(c.mesh.position.x-w.x)>1e-6||Math.abs(c.mesh.position.z-w.z)>1e-6) ok23=false;
if(!c.lid) ok23=false;
}
out.r23=(n23>=6)&&ok23&&(capDeckProps.length===n23);
}
// R24 甲板层护栏约束 (实机:"船体上面有来源不明的阻力完美防止玩家和Bot上去" + "护栏没有阻挡作用")
{
const bb4=capitalShips[0];
const inW=capToWorld(bb4,3.0,10.0,{x:0,z:0});
const p1={x:inW.x,y:bb4.pos.y+bb4.deck.y,z:inW.z};
capPushBody(p1,0.42);                                   // 甲板中央: 一点都不能被推动
const l1=capToLocal(bb4,p1.x,p1.z,{x:0,z:0});
const inside=Math.abs(l1.x-3.0)<1e-6&&Math.abs(l1.z-10.0)<1e-6;
// 贴缘: 被夹回甲板内 (护栏)
const outW=capToWorld(bb4,bb4.deck.hw+0.5,0,{x:0,z:0});
const p2={x:outW.x,y:bb4.pos.y+bb4.deck.y,z:outW.z};
capPushBody(p2,0.42);
const l2=capToLocal(bb4,p2.x,p2.z,{x:0,z:0});
const held=(Math.abs(l2.x)<=bb4.deck.hw+0.01)&&(Math.abs(l2.x)>=bb4.deck.hw-1.2)&&Math.abs(l2.z)<1e-6;
// 水面层: 舷侧照旧挡 (游泳者撞舷)
const outW2=capToWorld(bb4,2.0,0,{x:0,z:0});
const p3={x:outW2.x,y:0,z:outW2.z};
capPushBody(p3,0.42);
const l3=capToLocal(bb4,p3.x,p3.z,{x:0,z:0});
out.r24=inside&&held&&(Math.abs(l3.x)>=bb4.spec.hullW*0.5+0.41);
}
// R25 真实玩家上舰后**整链**(updatePlayer+updateCapital) 不掉海 (乘员搬运含玩家)
{
const bb5=capitalShips[0];
player.alive=true; player.deployed=true;
const side=capToWorld(bb5,bb5.spec.hullW*0.5+1.2,0,{x:0,z:0});
player.pos.set(side.x,0,side.z); player.onVehicle=null; player.onNaval=null; player.onCapital=null;
const boarded=capBoard(capNearestBoardable(),true);
let worst=0;
for(let i=0;i<90;i++){
updatePlayer(1/60,1/60);
updateCapital(1/60,1/60);
const l=capToLocal(bb5,player.pos.x,player.pos.z,{x:0,z:0});
worst=Math.max(worst,Math.abs(l.x));
}
out.r25=(boarded===true)&&(player.onCapital===bb5)&&(worst<=bb5.deck.hw+0.01)
&&(Math.abs(player.pos.y-(bb5.pos.y+bb5.deck.y))<0.6);
}
// R26 舷侧涂装贴面 (实机:"船体左右两边意义不明的浮空长方体"): 所有 cpSideDecals 顶点到舷侧表面的距离 ≤0.25
{
let ok26=true,n26=0;
for(const key of ['bb_us','cv_us','bb_jp','cv_jp']){
const S=CAPITAL_SPEC[key], Rq=capBuildModel(S);
let mesh=null; Rq.grp.traverse(o=>{ if(o.name==='cpSideDecals') mesh=o; });
if(!mesh){ ok26=false; continue; }
const p=mesh.geometry.attributes.position;
const nv26=p.array?p.array.length/3:p.count;
for(let i=0;i<nv26;i+=7){
const x=p.getX(i), y=p.getY(i), z=p.getZ(i);
const sx=(x<0)?-1:1;
const surf=cpSideX(S,z,y,sx);
n26++;
if(Math.abs(Math.abs(x)-Math.abs(surf))>0.25) ok26=false;
}
}
out.r26=ok26&&n26>=80;
}
// R27 甲板铺面与可行走半宽同源 (实机:"甲板边上的护栏连接不紧密"/甲板悬空): 铺面边缘 == cpDeckHW(z)
{
let ok27=true,n27=0;
for(const key of ['bb_us','bb_jp']){
const S=CAPITAL_SPEC[key], Rq=capBuildModel(S);
let mesh=null; Rq.grp.traverse(o=>{ if(o.name==='cpDeck') mesh=o; });
if(!mesh){ ok27=false; continue; }
const p=mesh.geometry.attributes.position;
const nv27=p.array?p.array.length/3:p.count;   // 沙箱桩 count=浮点数个数 (真实 three=顶点数)
for(let i=0;i<nv27;i++){
const x=p.getX(i), z=p.getZ(i);
if(Math.abs(z)>S.deckHL) continue;
n27++;
if(Math.abs(Math.abs(x)-cpDeckHW(S,z))>0.06) ok27=false;
}
}
// 航母: 飞行甲板是全通矩形 + 有支撑裙板 (实机:"甲板和下面的船体连接不紧密")
{
const Rq=capBuildModel(CAPITAL_SPEC.cv_us);
let deck=null,skirt=null;
Rq.grp.traverse(o=>{ if(o.name==='cpFlightDeck') deck=o; if(o.name==='cpDeckSkirt') skirt=o; });
if(!deck||!skirt) ok27=false;
else{
const bb=skirt.geometry.attributes.position;
let lo=1e9,hi=-1e9;
const nvS=bb.array?bb.array.length/3:bb.count;
for(let i=0;i<nvS;i++){ lo=Math.min(lo,bb.getY(i)); hi=Math.max(hi,bb.getY(i)); }
// 裙板必须真的搭在舷顶 (hullH) 与甲板底之间 (不能是悬空的一片)
if(!(lo<=CAPITAL_SPEC.cv_us.hullH+0.05&&hi>=CAPITAL_SPEC.cv_us.deckY+CAPITAL_CFG.deckLift-0.20&&hi>lo+1.0)) ok27=false;
}
}
out.r27=ok27&&n27>100;
}
// R28 命中胶囊随 yaw 旋转 (系统自查): yaw=π/2 的舰, 从正舷打**舰艏前方 50m** 必须命中
{
const s28=capitalShips[2], yaw0=s28.yaw;
s28.yaw=Math.PI/2;
const fwd={x:Math.sin(s28.yaw),z:Math.cos(s28.yaw)}, beam={x:Math.cos(s28.yaw),z:-Math.sin(s28.yaw)};
const o28=V3(s28.pos.x+fwd.x*50+beam.x*80,s28.pos.y+s28.spec.draft0,s28.pos.z+fwd.z*50+beam.z*80);
const hit28=capitalRayHit(o28,V3(-beam.x,0,-beam.z),240,1-s28.team,0);
const o29=V3(s28.pos.x+fwd.x*140+beam.x*80,s28.pos.y+s28.spec.draft0,s28.pos.z+fwd.z*140+beam.z*80);
const miss28=capitalRayHit(o29,V3(-beam.x,0,-beam.z),240,1-s28.team,0);   // 舰艏外 140m ⇒ 必须打空
s28.yaw=yaw0;
out.r28=(!!hit28&&hit28.ship===s28)&&(miss28===null);
}
// R29 防空口径 (实机:"大和的防空火力太强"): 全舰满射速预算 + 舷角闸门 (背舷炮位不参战)
{
const aaS=capitalShips[2];
let budget=0;
for(let i=0;i<aaS.spec.aa.n;i++) budget+=1/(aaS.spec.aa.rof*(1+(i%3)*0.15));
const savedYaw=aaS.yaw;
const tp=capToWorld(aaS,90,0,{x:0,z:0});            // 右舷正横 90m
const fake={alive:true,team:1-aaS.team,pos:V3(tp.x,aaS.pos.y+55,tp.z),vel:V3(0,0,0)};
aaS._pickPlaneTarget=()=>fake;
for(let i=0;i<aaS.aaAimY.length;i++){ aaS.aaAimY[i]=0; aaS.aaCd[i]=0; }
for(let i=0;i<50;i++) aaS.aiTick(0.05);
let star=0,port=0;
for(let i=0;i<aaS.R.aaMounts.length;i++){
if(Math.abs(aaS.aaAimY[i])>0.05){ if(aaS.R.aaMounts[i].lx>0) star++; else port++; }
}
aaS._pickPlaneTarget=Object.getPrototypeOf(aaS)._pickPlaneTarget;
aaS.yaw=savedYaw;
out.r29=(budget<=4.01)&&(star>0)&&(port===0)&&(CAPITAL_CFG.aaR<=180);
}
// R30 尸体/碎块也由甲板承载 (2026-10-01 实机修): 甲板上被击毙的布娃娃**不穿舰体掉海**且随舰平移。
//   12-ragdolls 的落地高度旧版只读 heightAt (纯地形) ⇒ 甲板上的尸体整具穿过舰体掉进海里;
//   就算撑住, 舰一开走尸体也留在原地。本项让 spawnRagdoll/updateRagdolls 真跑起来
//   (CANNON 桩在沙箱外挂好 —— 原沙箱没有 CANNON ⇒ 布娃娃链在里面**从没跑过**, 这也是它能一路漏到实机的原因)。
{
RAG.world=null;                               // 让 ragInit 按桩重建
const sC=capitalShips[3];                     // bb_jp: 前面各项没动过它 (capitalShips[0] 在 R8 已被打瘫, 动力零 ⇒ 不会动)
const deckY0=sC.pos.y+sC.deck.y;
const pC=capToWorld(sC,2.5,0,{x:0,z:0});      // 舰中甲板上一点
const botC={pos:V3(pC.x,deckY0,pC.z),vel:V3(0,0,0),yaw:sC.yaw,prone:false,crouch:false,team:sC.team};
const ragC=spawnRagdoll(botC,null,false);
// 对照组: 离舰 200m 的开阔海面 (必须照常落到地形上 —— 证明甲板查询没把世界粘在舰上)
const pW=capToWorld(sC,0,0,{x:0,z:0});
const botW={pos:V3(pW.x+200,deckY0,pW.z+200),vel:V3(0,0,0),yaw:0,prone:false,crouch:false,team:sC.team};
const ragW=spawnRagdoll(botW,null,false);
// 桩 Object3D 的 quaternion 只有 setFromUnitVectors ⇒ 补 updateRagdolls 要用的 copy (真 THREE 本来就有)
for(const r of [ragC,ragW]) for(const p of r.parts){ if(p.mesh&&p.mesh.quaternion&&!p.mesh.quaternion.copy) p.mesh.quaternion.copy=function(){return this;}; }
const shipX0=sC.pos.x, shipZ0=sC.pos.z;
const dtR=1/60;
for(let i=0;i<300;i++){                       // 5s: 舰从静止加速到巡航, 走 20m+
sC.step(dtR);
// 桩 step 不做积分 ⇒ 手工补重力那一维 (水平搬运由 updateRagdolls 的甲板承载负责, 这里不碰)
for(const r of RAG.list) for(const p of r.parts){ p.body.velocity.y-=11*dtR; p.body.position.y+=p.body.velocity.y*dtR; }
updateRagdolls(dtR);
}
// carry 原语直测: 甲板上一点走一帧, capCarryDelta 的结果应等于"该点在舰体坐标系不动"的投影
const tst0=capToWorld(sC,3,5,{x:0,z:0});
sC.step(dtR);
const tst1=capCarryDelta(sC,tst0.x,tst0.z,{x:0,z:0});
const tstW=capToWorld(sC,3,5,{x:0,z:0});
const carryErr=Math.hypot(tst1.x-tstW.x,tst1.z-tstW.z);
const shipMoved=Math.hypot(sC.pos.x-shipX0,sC.pos.z-shipZ0);
let cxm=0,czm=0,cnt=0,below=0;
for(const p of ragC.parts){ const b=p.body; cnt++;
cxm+=b.position.x; czm+=b.position.z;
if(b.position.y<deckY0-0.35) below++; }
cxm/=cnt; czm/=cnt;
const cLoc=capToLocal(sC,cxm,czm,{x:0,z:0});
let wxm=0,wzm=0,wym=0,wn=0;
for(const p of ragW.parts){ wym+=p.body.position.y; wxm+=p.body.position.x; wzm+=p.body.position.z; wn++; }
wym/=wn; wxm/=wn; wzm/=wn;
const wGround=(typeof heightAt==='function')?heightAt(wxm,wzm):0;
out.r30=(ragC.parts.length>=6)&&(cnt>=6)&&(ragW.parts.length>=6)
&&(shipMoved>12)                                 // 舰真的开走了 (否则"随舰"无从谈起)
&&(below===0)                                    // 甲板尸体: 没有任何一件沉到甲板面下 0.35m
&&(carryErr<1e-6)                                // capCarryDelta 原语 = 舰体位姿变换的精确解
&&(Math.abs(cLoc.x-2.5)<0.6&&Math.abs(cLoc.z)<0.6)   // 质心在**舰体坐标系**里一动没动 (随舰走了 300 帧)
&&(wym<=wGround+2.0)                             // 阴性对照: 200m 外的尸体落到**地形**上, 没被托在甲板高度
&&(Math.abs(wxm-(pW.x+200))<1.0);                // 阴性对照: 且不曾被"搬"向舰体
}
// R31 全海图上不得有**静态**火力点落在舰甲板: ATGUNS/AAGUNS/MG42S 都是载入期定死 + 进 OCC/圆柱格网的
//   物件, 没进舰体坐标系 (与弹药箱/旗点不同, 这两条有跟随链) —— 落在甲板上就是"船一开走, 炮留在半空"。
//   全海图的 OCC 整片是水障 ⇒ findClearSpot 本来就该把它们全部劝退 (本项就是钉住这条推论).
{
const onDeck=[];
for(const list of [['AT',typeof ATGUNS!=='undefined'?ATGUNS:[]],['AA',typeof AAGUNS!=='undefined'?AAGUNS:[]],
['MG',typeof MG42S!=='undefined'?MG42S:[]]]){
for(const e of list[1]){ if(typeof capDeckOf==='function'&&capDeckOf(e.x,e.z)) onDeck.push(list[0]+'@'+Math.round(e.x)+','+Math.round(e.z)); }
}
out.r31=(onDeck.length===0);
out.r31d={n:(typeof ATGUNS!=='undefined'?ATGUNS.length:0)+(typeof AAGUNS!=='undefined'?AAGUNS.length:0)+(typeof MG42S!=='undefined'?MG42S.length:0),bad:onDeck.slice(0,4)};
}
// R32 全部战役的甲板旗点授权自检 (不只本局这张图): 每个 flags[].ship 的 t=0 世界坐标必须落在**它那艘舰**的
//   甲板矩形内 (用同一张 capDeckIn 判据), 且 ship 索引在编制内。授权写歪了不会报错 —— 旗子会跟着舰跑但
//   悬在舷外 (实机看起来就是"旗子漂在船外边"), 只有实机才发现。本项把 13 张图一次扫完。
{
const bad32=[]; let n32=0;
for(const C of CAMPAIGNS){
if(!C.capital||!C.capital.length) continue;
for(const f of (C.flags||[])){
if(f.ship===undefined) continue;
n32++;
const S=CAPITAL_SPEC[C.capital[f.ship]&&C.capital[f.ship].key];
if(!S||f.ship>=C.capital.length){ bad32.push(C.id+':'+(f.id||'?')+' 索引越界'); continue; }
// t=0 位姿 (capToLocal 的逆运算就地展开, 不依赖 ships 实例)
const cs=Math.cos(C.capital[f.ship].yaw), sn=Math.sin(C.capital[f.ship].yaw);
const dx=f.x-C.capital[f.ship].x, dz=f.z-C.capital[f.ship].z;
const lx=dx*cs-dz*sn, lz=dx*sn+dz*cs;
const hw=(S.cls==='cv')?S.deckHW:Math.min(S.deckHW,S.hullW*0.5*(S.deckW||1));
if(Math.abs(lz)>S.deckHL+0.5||Math.abs(lx)>hw+0.5) bad32.push(C.id+':'+(f.id||'?')+' 局部('+lx.toFixed(1)+','+lz.toFixed(1)+') 出甲板 hw'+hw.toFixed(1)+'/hl'+S.deckHL);
}
}
out.r32=(bad32.length===0)&&(n32>=8);
out.r32d={n:n32,bad:bad32.slice(0,4)};
out.r32d.hw=[]; for(const z of [0,20,30,40,45,50,55,58,60,62,65,70]) out.r32d.hw.push(z+':'+cpDeckHW(CAPITAL_SPEC.bb_us,z).toFixed(2));
// 临时: BB 甲板自由区连通性 (洪水填充) —— 给铁底湾的甲板旗点选一个"真的走得到"的位置
{
const SP=CAPITAL_SPEC.bb_us, Rq=capBuildModel(SP);
const STEP=0.25, X0=-9.5, Z0=-72;
const NX=Math.round(19/STEP)+1, NZ=Math.round(144/STEP)+1;
const free=new Uint8Array(NX*NZ);
for(let j=0;j<NZ;j++){
const lz=Z0+j*STEP, hw=cpDeckHW(SP,lz);
for(let i=0;i<NX;i++){
const lx=X0+i*STEP;
let ok=(Math.abs(lx)<=hw-0.9);
if(ok) for(const b of Rq.boxes){ if(Math.abs(lx-b.lx)<=b.hw+0.45&&Math.abs(lz-b.lz)<=b.hd+0.45){ ok=false; break; } }
free[j*NX+i]=ok?1:0;
}
}
const seen=new Uint8Array(NX*NZ);
const idx=(lx,lz)=>{ const i=Math.round((lx-X0)/STEP), j=Math.round((lz-Z0)/STEP); return (i>=0&&i<NX&&j>=0&&j<NZ)?j*NX+i:-1; };
const start=idx(0,28);
const q=[start]; seen[start]=1; let n=0, zmin=1e9, zmax=-1e9, xmin=1e9, xmax=-1e9;
while(q.length){
const c=q.pop(); n++;
const i=c%NX, j=(c-i)/NX;
const lz=Z0+j*STEP;
if(lz<zmin) zmin=lz; if(lz>zmax) zmax=lz;
const lx=X0+i*STEP;
if(lx<xmin) xmin=lx; if(lx>xmax) xmax=lx;
for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){
const ni=i+di, nj=j+dj;
if(ni<0||ni>=NX||nj<0||nj>=NZ) continue;
const k=nj*NX+ni;
if(free[k]&&!seen[k]){ seen[k]=1; q.push(k); }
}
}
out.r32d.flood={cells:n,zmin:+zmin.toFixed(1),zmax:+zmax.toFixed(1),xmin:+xmin.toFixed(1),xmax:+xmax.toFixed(1),
probe45:!!seen[idx(0,44)], probe2:!!seen[idx(7.2,2)], probeStern:!!seen[idx(0,-56)], probeSternLane:!!seen[idx(7.2,-48)], probeBow:!!seen[idx(0,62)]};
}
out.r32d.cv=[]; for(const z of [0,40,60,70,80]) out.r32d.cv.push(z+':'+cpDeckHW(CAPITAL_SPEC.cv_us,z).toFixed(2)+'/'+CAPITAL_SPEC.cv_us.deckHL);
}
return out;
}catch(e){ return 'EXC:'+String(e&&e.stack||e); }})()`,ctx);
if(typeof rr==='string'){ console.log('  ! 运行时沙箱异常: '+rr); FAIL++; }
else{
ok(rr.r1,'R1 编制生成: 4 舰 = 两队各一战列舰一航母');
ok(rr.r2,'R2 甲板旗点: 6 个 ship 旗点全部绑到对应舰且落在甲板矩形内');
ok(rr.r3,'R3 缓慢巡航: 10s 位移 >8m 且不漂出巡逻环邻域');
ok(rr.r4,'R4 甲板平台: 甲板上返回甲板面 / 舷外与水面下返回 -1e9');
ok(rr.r5,'R5 乘员跟随: 甲板上的单位局部坐标不漂 (甲板 = 移动平台)');
ok(rr.r6,'R6 主炮齐射: 一塔 3 管 -> shells +3, 弹速 = SHELL_SPD_NAVAL 单源');
ok(rr.r7,'R7 分区装甲: 同一基础伤害按 spec.armor[tag] 分档');
ok(rr.r8,'R8 瘫痪: state=crippled / alive=true / 炮位全废 / 模型保留 / 按 spec.ticket 结算兵力票');
ok(rr.r9,'R9 瘫舰仍是海上陆地: 甲板照走, 旗点照在');
ok(rr.r10,'R10 鱼雷: 命中舷侧扣 spec.torpedoDmg 且加 flood');
ok(rr.r11,'R11 甲板旗跟随: f.x/f.z/f.gy 与舰体位姿逐位一致, 旗面网格同步搬');
ok(rr.r12,'R12 小艇让路: 硬塞进舰体的艇被推出舷侧');
ok(rr.r13,'R13 登舰: 贴舷 F 上甲板, 三座位字段互斥');
ok(rr.r14,'R14 航母面: 飞行甲板矩形 + 2 弹射器 + 拦阻区 + 起降接口');
ok(rr.r15,'R15 火控: step() 连跑 120 帧无异常; 交战门单源 mainR/aaR');
ok(rr.r16,'R16 命中胶囊: 穿过舰体的射线命中 / 打空处不命中');
ok(rr.r17,'R17 舰载机停放: 开局停在本队航母飞行甲板矩形内, 机腹贴甲板面 (capParkPlanes)');
ok(rr.r18,'R18 一键弹射: 弹射后离舰、直接获得机型顶速 (用户裁定① "不做滑跑段")');
ok(rr.r19,'R19 触舰拦阻: 甲板上方低速进场 ⇒ 钩停 (速度归零 + 姿态摆平, capTryArrest)');
ok(rr.r20,'R20 停放机由甲板承载: 120 帧后局部坐标不漂 (与步兵同一条乘员搬运链)');
ok(rr.r21,'R21 全海图出生: 徒步 Bot 全部落在某艘大舰甲板上 (落点吸附; 小艇乘员除外)');
ok(rr.r22,'R22 甲板吸附单源: 舷外参考点被夹回**参考点所在那艘舰**的甲板矩形 (capSnapToDeck)');
ok(rr.r23,'R23 甲板弹药箱跟随: 局部坐标在甲板内且网格逐位=capToWorld (旧版留在原地漂走)');
ok(rr.r24,'R24 甲板层护栏约束: 甲板中央不推动 / 贴缘夹回甲板内 / 水面层照旧挡舷 (旧版在甲板上把人弹下海)');
ok(rr.r25,'R25 玩家整链上舰: updatePlayer+updateCapital 90 帧不掉海, 局部坐标被夹在甲板内');
ok(rr.r26,'R26 舷侧涂装贴面: 水线带/舷号/舷门顶点全部落在舷侧表面上 (≤0.25m)');
ok(rr.r27,'R27 甲板同源: 战列舰铺面边缘 = cpDeckHW(z) 逐点一致; 航母飞行甲板有支撑裙板 (搭在舷顶与甲板底之间)');
ok(rr.r28,'R28 命中胶囊随 yaw: yaw=π/2 时正舷打舰艏前方 50m 命中 / 140m 打空');
ok(rr.r29,'R29 防空口径: 全舰满射速 ≤4 发/秒 + 舷角闸门 (背舷炮位不参战) + aaR≤180');
ok(rr.r30,'R30 尸体/碎块由甲板承载: 甲板上的布娃娃不穿舰体、质心随舰平移 (阴性=200m 外照常落水且不被搬向舰体)');
ok(rr.r31,'R31 静态火力点不落甲板: 全海图上 ATGUNS/AAGUNS/MG42S 无一落在舰甲板 (它们不进舰体坐标系, 落了就是"船走炮留")');
console.log("  [R32调试] "+JSON.stringify(rr.r32d));
ok(rr.r32,'R32 甲板旗点授权自检 (全战役): 每个 ship 旗点都落在它那艘舰的甲板矩形内, 索引不越界');
}

console.log('\n'+(FAIL===0?'verify-phase5-capital 全部通过 ✓ ('+PASS+')':'存在失败项 ✗ (过 '+PASS+' / 挂 '+FAIL+')'));
process.exit(FAIL===0?0:1);
