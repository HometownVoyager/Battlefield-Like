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
// dev/verify-phase4-7d.js —— P3 阶段四子批 7d 判据: 高炮多机分摊账本 + 交接面冻结核对 + 四联20定稿批 (7d-乙)
// 用法: node dev/verify-phase4-7d.js
// 结构: S1~S5 静态断言 (单源/接线/冻结面) + R1~R6 运行时钉值 (真沙箱, 战役 0)。
// 7d-甲 (空对地平衡批遗留项): 旧口径每门炮 enemyPlaneAlive(team)=数组序第一架 ⇒ 同一防空阵地
//   每门炮齐射同一架机。aaSpreadTarget: 认领最少者优先 (平手取近), 认领粘滞到目标亡;
//   只统计本队 AA 操作者的认领账。enemyPlaneAlive 保留为存在性判据单源 (归队/退炮位)。
// 交接面冻结核对 (S4): AAGUNS 条目结构/flak 弹管线 (fireFlak→flakShots→updateFlak)/TV 三件套
//   (15d-f 冻结签名) —— 静态钉住关键字段与签名, 防后续回归。
//   7d-乙 (2026-09-30 用户定稿 B 四联20 + 射速弹速双升) 有意改动了冻结字面量一次:
//   flakShots.push 的弹速 SHELL_SPD→FLAK_SPD(460)、life 2.05→1.7 (射程包线 ~780m 不变),
//   S4 钉的是改动后的新冻结态; 射速 EMPL_AA_CD 0.34→0.22 (S5)。
// 沙箱样板与 verify-phase4-7b/7c 同源 (桩式 THREE/DOM/AudioContext, 只跑战役 0)。
// ─────────────────────────────────────────────
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
let PASS=0,FAIL=0;
function ok(c,m){ if(c){PASS++; console.log('  ✓ '+m);} else {FAIL++; console.log('  ✗ '+m);} }

// ── 静态断言 ──
const bots=read('js/14-bots.js'), air=read('js/16-aircraft.js'), empl=read('js/17-emplacements.js');
console.log('S 静态: 单源/接线/冻结面');
ok((bots.match(/function aaSpreadTarget\(/g)||[]).length===1
&&bots.indexOf('aaSpreadTarget(this.team,this,g.x,g.z)')>=0,'S1 分摊账本单源定义 + AA 火控分支接线 (旧 enemyPlaneAlive 齐射口径从火控分支退役)');
ok((bots.match(/enemyPlaneAlive\(this\.team\)/g)||[]).length===2
&&bots.indexOf('const ePlane=enemyPlaneAlive(this.team)')>=0,'S2 enemyPlaneAlive 保留为存在性判据 (归队/退炮位两消费点不动)');
ok(bots.indexOf('if(self._aaTgt&&self._aaTgt.alive&&self._aaTgt.team!==team) return self._aaTgt;')>=0
&&bots.indexOf("b.empUse.kind!=='aa'")>=0&&bots.indexOf('b.team!==team')>=0,'S3 账本口径: 粘滞续认 + 只统计本队 AA 操作者 (empUse.kind===aa)');
{
const iF=air.indexOf('function fireFlak('), iU=air.indexOf('function updateFlak(');
ok(iF>0&&iU>iF&&/flakShots\.push\(\{pos:o\.clone\(\),vel:dir\.clone\(\)\.multiplyScalar\(FLAK_SPD\),team:shooter\.team,owner:shooter,life:1\.7(,age:0)?\}\);/.test(air)
&&empl.indexOf("AAGUNS.push({x,z,y:g0+1.25,grp,yaw,pitch,user:null,cd:0,cdLock:0,kind:'aa',deck:deckRef||null,cyl,crew});")>=0
&&/PLANE_TAKEOVER=\{ cd:3, range:600, losGrace:1\.6, minAGL:40, diveAGL:20 \};/.test(read('js/00-config.js')),'S4 交接面冻结核对: fireFlak→flakShots 管线 / AAGUNS 条目结构 / PLANE_TAKEOVER 签名零漂移 (cd 3s=2026-09-30j 8→3; diveAGL 20=2026-09-30k 低空交战档; 弹速/life 为 7d-乙 后的新冻结态)');
}
{
const cfg=read('js/00-config.js'), seats=read('js/20a-seats.js');
ok(/const EMPL_AA_CD=0\.22;/.test(cfg)&&/const FLAK_SPD=460;/.test(cfg)
&&/multiplyScalar\(FLAK_SPD\)/.test(air)&&!/multiplyScalar\(SHELL_SPD\)/.test(air)
&&bots.indexOf('const tof=dist/FLAK_SPD;')>=0&&seats.indexOf('const tof=bd/FLAK_SPD;')>=0
&&/for\(const sx of \[-0\.08,0\.08\]\) for\(const sy of \[-0\.07,0\.07\]\)/.test(empl)
&&empl.indexOf('drawbar.position.set(0,-0.995,-0.685)')>=0
&&empl.indexOf('wh.position.set(sx,-0.85,0)')>=0
&&empl.indexOf('ped.position.y=-0.565')>=0
&&empl.indexOf('const cyl={x,z,r:0.7,y0:g0,y1:g0+1.4};')>=0,
'S5 7d-乙 四联20定稿 + 散架修复 (2026-09-30): EMPL_AA_CD 0.22 / FLAK_SPD 460 单源 (高炮链零 SHELL_SPD 弹速残留, Bot+玩家提前量同源换算) / 建模 B 方案钉 (四管 ±0.08·±0.07 / 引杆贴轴位·轮心接地·立柱加高锚点 / 击杀圆柱 r0.7·h1.4 不动)');
}

// ── 运行时沙箱 (桩与 verify-phase4-7b 同源, 只跑战役 0) ──
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

console.log('R 运行时: 分摊/粘滞/重派/跨队不计 (真沙箱, 战役 0)');
const r=vm.runInContext(`(()=>{
try{
const out={};
const btn=document.getElementById('startBtn');
if(btn&&btn.onclick) btn.onclick(); else return 'no startBtn.onclick';
const pl=planes[0];
const foe=pl.team===0?1:0;
const eps=planes.filter(p=>p.team===foe);
if(eps.length<2) return 'need 2 enemy planes (campaign 0)';
const pa=eps[0], pb=eps[1];
const savedPlanes=planes.splice(0,planes.length);
const savedCb=combatants.splice(0,combatants.length);
planes.push(pl,pa,pb);
pa.alive=true; pb.alive=true; pa.team=foe; pb.team=foe;
pa.pos.set(0,100,200); pb.pos.set(0,100,150);            // pb 更近 (平手时应取 pb)
// 假 AA 操作者 (账本只读 alive/team/empUse.kind/_aaTgt)
const mkOp=()=>({alive:true,team:pl.team,empUse:{kind:'aa'},_aaTgt:null});
const op1=mkOp(), op2=mkOp();
combatants.push(op1,op2);
// ── R1 分摊: 两门炮两架机 → 各认一架 (第二门取认领数 0 的那架, 即使更远) ──
pa.pos.set(0,100,120); pb.pos.set(0,100,300);            // pa 更近
const t1=aaSpreadTarget(pl.team,op1,0,0);
op1._aaTgt=t1;
const t2=aaSpreadTarget(pl.team,op2,0,0);
out.r1=(t1===pa&&t2===pb);
// ── R2 粘滞: 目标活着就续认 (pb 更近也不换) ──
pa.pos.set(0,100,120); pb.pos.set(0,100,100);            // pb 更近
const t3=aaSpreadTarget(pl.team,op1,0,0);
out.r2=(t3===pa);
// ── R3 重派: 认领目标亡 → 重投账本 (pb 未被认领 → 取 pb) ──
pa.alive=false;
const t4=aaSpreadTarget(pl.team,op1,0,0);
out.r3=(t4===pb);
pa.alive=true;
// ── R4 跨队不计: 敌方高炮认领 pb 不影响我方账 (我方 op1 认 pa ⇒ op2 取 pb=0 认领) ──
op1._aaTgt=pa;
const opE={alive:true,team:foe,empUse:{kind:'aa'},_aaTgt:pb};
combatants.push(opE);
const t5=aaSpreadTarget(pl.team,op2,0,0);
out.r4=(t5===pb);
// 还原
planes.splice(0,planes.length);
for(const p of savedPlanes) planes.push(p);
combatants.splice(0,combatants.length);
for(const b of savedCb) combatants.push(b);
// ── R5 fireFlak 实弹: 弹速=FLAK_SPD 单源 (460), life 1.7 (射程包线 ~780m) ──
const n0=flakShots.length;
fireFlak({x:0,y:50,z:0},{team:0,isPlayer:false},new THREE.Vector3(0,0,1));
const fk=flakShots[flakShots.length-1];
out.r5=flakShots.length===n0+1&&fk&&Math.abs(fk.vel.length()-FLAK_SPD)<1e-6&&Math.abs(fk.life-1.7)<1e-9;
// ── R6 aaGun 建模契约 (甲板形制直调, 避开 findClearSpot 布局随机): grp>yaw>pitch 契约 /
//      pitch 子件 7 (炮箱+四管+双弹鼓) / yaw 转盘座椅托架盾齐 / 击杀圆柱 r0.7 h1.4 /
//      散架修复连接算术 (2026-09-30): 立柱顶≥炮箱底 (嵌合) · 轮底接地 · 转盘坐柱顶 ──
const beforeAAG=AAGUNS.length;
aaGun(200,200,50,null);
const ag=AAGUNS[AAGUNS.length-1];
let r6c=null;
if(ag&&ag.grp){ let ped2=null,whB=1e9,tb=null;
ag.grp.traverse(o=>{ if(o.name==='aaPedestal') ped2=o; if(o.name==='aaWheel') whB=Math.min(whB,o.position.y-0.3); if(o.name==='aaTurntable') tb=o; });
if(ped2&&tb&&isFinite(whB)){
const pedTop=ped2.position.y+0.52, cradleB=ag.pitch.position.y-0.18, tbB=tb.position.y-0.045;
r6c=(pedTop>=cradleB-0.01)&&(Math.abs(whB+1.15)<0.02)&&(Math.abs(tbB-pedTop)<0.005);
} }
out.r6=AAGUNS.length===beforeAAG+1&&ag&&ag.kind==='aa'
&&ag.pitch&&Math.abs(ag.pitch.position.y-0.1)<1e-9&&ag.pitch.children.length===7
&&ag.yaw&&ag.yaw.children.length===7 // pitch 组本体 + 转盘 + 座椅三件 + 托架臂 + 盾
&&ag.cyl&&Math.abs(ag.cyl.r-0.7)<1e-9&&Math.abs(ag.cyl.y1-ag.cyl.y0-1.4)<1e-9
&&Math.abs(ag.y-51.25)<1e-9
&&r6c===true;
return out;
}catch(e){ return 'EXC:'+String(e&&e.stack||e); }})()`,ctx);
if(typeof r==='string'){ console.log('  ✗ 运行时沙箱异常: '+r); FAIL++; }
else{
ok(r.r1,'R1 分摊: 两门炮各认一架 (第二门取认领数 0 的机, 不再齐射第一架)');
ok(r.r2,'R2 粘滞: 认领目标活着就续认 (更近的新机不夺走火力, 反应窗不反复重置)');
ok(r.r3,'R3 重派: 认领目标亡 → 重投账本取最少认领');
ok(r.r4,'R4 跨队不计: 敌方高炮的认领账不影响我方分摊');
}
if(typeof r==='object'&&r){
ok(r.r5,'R5 fireFlak 实弹: 弹速=FLAK_SPD 460 单源 (7d-乙), life 1.7 保射程包线');
ok(r.r6,'R6 aaGun 建模契约: grp>yaw>pitch 契约 / pitch 7 子件 (炮箱+四管+双弹鼓) / yaw 7 子件 (pitch组+转盘+座椅托架盾) / 击杀圆柱 r0.7·h1.4 / 连接算术: 立柱顶嵌合炮箱底·轮底接地·转盘坐柱顶 (散架修复)');
}
console.log('\n'+(FAIL===0?'verify-phase4-7d 全部通过 ✓ ('+PASS+')':'存在失败项 ✗ (过 '+PASS+' / 挂 '+FAIL+')'));
process.exit(FAIL===0?0:1);
