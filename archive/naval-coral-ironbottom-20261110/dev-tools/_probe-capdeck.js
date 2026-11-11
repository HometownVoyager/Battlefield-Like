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
const API=['capToWorld','capToLocal','capDeckY','capDeckOf','capPushBody','capPushCraft','capLocalSolve',
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
['甲板旗跟随接线',hud,"capitalShips.length=0"],
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
&&!/\.beginDestroy\(/.test(cap)&&!/\.respawnT/.test(cap),
'S6 瘫痪链与小艇沉没链零交集 (不调 15d 的 beginDestroy, 无重生计时, alive 恒 true)');
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
// 文件清单 = index.html 实载面 (41 脚本, 差一个就是假绿的温床 —— 见 探针载入盲区教训)
const FILES=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/15g-capmodels.js','js/15h-capital.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/19b-gamepad.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/22a-menuart.js','js/22b-speclayer.js','js/23-deploy.js','js/23b-worldrestore.js','js/24-main.js'];
for(const f of FILES) load(ctx,f);
const rr=vm.runInContext(`(()=>{ try{
const out={};
const btn=document.getElementById('startBtn');
if(btn&&btn.onclick) btn.onclick(); else return 'no startBtn';
out.n0=capitalShips.length;
const st=capitalShips.map(s=>({key:s.key,x:s.pos.x,z:s.pos.z}));
for(let i=0;i<600;i++) updateCapital(1/60,1/60);
out.moved=capitalShips.map((s,i)=>[s.key,(s.pos.x-st[i].x).toFixed(1),(s.pos.z-st[i].z).toFixed(1)]);
let bad=0, samples=[];
for(const s of capitalShips) for(const f of s.deckFlags){
const w=capToWorld(s,f._clx,f._clz,{x:0,z:0});
const e=Math.hypot(w.x-f.x,w.z-f.z);
if(e>0.01) bad++;
const pm=f.poleMesh?Math.hypot(f.poleMesh.position.x-f.x,f.poleMesh.position.z-f.z):-1;
const fm=f.flagMesh?Math.hypot(f.flagMesh.position.x-(f.x+0.075),f.flagMesh.position.z-f.z):-1;
samples.push([f.id,e.toFixed(3),pm.toFixed(3),fm.toFixed(3)]);
}
out.flagDriftBad=bad; out.flags=samples.slice(0,4);
out.crates=[];
if(typeof AMMO_CRATES!=='undefined') for(const c of AMMO_CRATES){
if(c.ship===undefined) continue;
const s=capitalShips[c.ship];
out.crates.push([c.ship,c.x.toFixed(1),c.z.toFixed(1),s.pos.x.toFixed(1),s.pos.z.toFixed(1)]);
}
out.crateRecs=AMMO_CRATES.length;
out.probeDeckY=[capDeckWorldY(0), capitalShips[0].pos.y+capitalShips[0].deck.y];
return out;
}catch(e){ return 'EXC:'+String(e&&e.stack||e); }})()`,ctx);
console.log(JSON.stringify(rr,null,1));
