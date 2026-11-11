// ─────────────────────────────────────────────
// dev/verify-airground-balance.js —— 空对地平衡批判据 (2026-09-30, 用户裁定两条):
//   ① "飞机对地面步兵的枪有更高减伤" → Bot 高炮对机弹伤 ×GROUNDGUN_VS_AIR=0.50
//      (审计事实: 普通枪弹与飞机无碰撞, 地面枪械对机唯一伤源就是高炮弹; 玩家操作档不减)
//   ② "削减地面对空中单位的攻击欲望" → AA 交战距离 220→140 单源 EMPL_AA_ENGAGE_R;
//      步兵 perceive / 坦克 turretAI / 两栖车 navEnemyInfNear 一律不索敌伞降目标 (跳伞≠集火靶子,
//      落地才恢复; 还击路径保留 botEngageR 门 —— 伞兵主动开火仍会挨还击, 不白嫖)。
// 用法: node dev/verify-airground-balance.js
// 结构: S1~S7 静态断言 + R1~R3 运行时钉值 (真沙箱, 战役 0)。
// 沙箱样板与 verify-phase4-7b 同源 (桩式 THREE/DOM/AudioContext, 只跑战役 0)。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
let PASS=0,FAIL=0;
function ok(c,m){ if(c){PASS++; console.log('  ✓ '+m);} else {FAIL++; console.log('  ✗ '+m);} }

// ── 静态断言 ──
const cfg=read('js/00-config.js'), air=read('js/16-aircraft.js'),
      bots=read('js/14-bots.js'), veh=read('js/15-vehicles.js');
console.log('S 静态: 单源/接线/契约面');
ok(/const GROUNDGUN_VS_AIR=0\.50;/.test(cfg)&&/const EMPL_AA_ENGAGE_R=140;/.test(cfg),'S1 空对地平衡两常量单源: GROUNDGUN_VS_AIR=0.50 + EMPL_AA_ENGAGE_R=140 (00-config, 7d 防空炮批基线)');
ok(air.indexOf('isPlayer?rand(34,58):rand(20,34)*GROUNDGUN_VS_AIR,f.owner')>=0,'S2 高炮对机弹伤 (平衡①): Bot 档 ×GROUNDGUN_VS_AIR, 玩家操作档 rand(34,58) 原样 (基地防空火力保留; 难度倍率仍在 Plane.takeDmg 内叠加不双乘)');
ok(bots.indexOf('if(chuteAirborne(e)) continue;')>=0&&bots.indexOf('chuteAirborne(e)&&d>CHUTE_DEF.botEngageR')<0,'S3 步兵 perceive: 伞降目标一律不索敌 (旧 25m 可见门废除)');
ok(bots.indexOf('chuteAirborne(attacker)&&aD>CHUTE_DEF.botEngageR')>=0,'S3b 还击路径保留 botEngageR 门 (被伞兵主动开火打中仍会还击, 伞兵不白嫖)');
ok(bots.indexOf('dist<EMPL_AA_ENGAGE_R')>=0&&bots.indexOf('this.aaReactT<=0')>=0&&bots.indexOf('dist<220')<0,'S4 Bot 高炮交战距离单源 EMPL_AA_ENGAGE_R (旧写死 220 绝迹) + 7b-乙反应窗闸保留 (锚随 2026-10-05 昼夜批拆两段: 夜档交战距离 ×rangeMul 插在中间)');
{
const iT=veh.indexOf('turretAI(dt){'), regT=iT>0?veh.slice(iT,iT+2200):'';
ok(regT.includes("typeof chuteAirborne==='function'&&chuteAirborne(s)) continue;"),'S5 坦克 turretAI: 步兵候选跳过伞降目标 (车组机枪不再 140m 点名跳伞者)');
}
{
const iN=bots.indexOf('function navEnemyInfNear'), regN=iN>0?bots.slice(iN,iN+420):'';
ok(regN.includes("chuteAirborne(s)) continue;"),'S6 两栖车 navEnemyInfNear: 跳过伞降目标 (抢滩火力不再空中点名)');
}
ok(/const CHUTE_DEF=\{dmgMul:0\.40, botEngageR:25, landClearT:0\.10\};/.test(cfg),'S7 CHUTE_DEF 本体不动: dmgMul 0.40 仍是伞降兜底减伤 (溅射/流弹), 本批只收紧 AI 索敌口径');
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
for(const f of ['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/23-deploy.js','js/24-main.js']) load(ctx,f);

console.log('R 运行时: 高炮弹伤减档 / 交战距离 / 伞降索敌豁免 (真沙箱, 战役 0)');
const r=vm.runInContext(`(()=>{
try{
const out={};
const realRCW=raycastWorld, realSmoke=smokeBlocksLOS, realCrop=cropBlocksLOS, realFol=foliageBlocksLOS;
raycastWorld=()=>null; smokeBlocksLOS=()=>false; cropBlocksLOS=()=>false; foliageBlocksLOS=()=>false;
try{
// ── R1 步兵 perceive: 伞降目标一律不可索敌, 落地恢复 ──
const savedC=combatants.splice(0,combatants.length);
const fb={pos:V3(0,heightAt(0,0),0),team:0,yaw:0.785,target:null,lastSeenT:-99,lastSeenPos:V3(),aimSettle:0.5};
const eChute={pos:V3(6,heightAt(6,6),6),alive:true,team:1,onVehicle:null,chute:true,onGround:false,crouch:false,prone:false};
const eNorm={pos:V3(12,heightAt(12,12),12),alive:true,team:1,onVehicle:null,chute:false,onGround:true,crouch:false,prone:false};
combatants.push(eChute,eNorm);
Bot.prototype.perceive.call(fb);
out.r1a=(fb.target===eNorm);                       // 更近的伞降目标被跳过, 选到落地敌人
eNorm.chute=true; eNorm.onGround=false; fb.target=null;
Bot.prototype.perceive.call(fb);
out.r1b=(fb.target===null);                        // 全在伞降 ⇒ 索敌为空 (旧 25m 门会选到 8.5m 的伞兵)
eChute.chute=false; eChute.onGround=true; eNorm.chute=false; eNorm.onGround=true; fb.target=null;
Bot.prototype.perceive.call(fb);
out.r1c=(fb.target===eChute);                      // 落地即恢复索敌 (取更近者)
combatants.splice(0,combatants.length); combatants.push(...savedC);
// ── R2 高炮弹伤: Bot 档 ×GROUNDGUN_VS_AIR, 玩家档原样 ──
const savedP=planes.splice(0,planes.length);
const fp={pos:V3(5000,80,5000),alive:true,team:1,def:{size:1},hpLost:0,takeDmg(a){this.hpLost+=a;}};
planes.push(fp);
flakShots.push({pos:V3(5000,80,5000),vel:V3(),team:0,owner:{alive:true,isPlayer:false},life:2.05});
updateFlak(0.016,0.016);
out.r2a=(fp.hpLost>=20*GROUNDGUN_VS_AIR-0.01&&fp.hpLost<=34*GROUNDGUN_VS_AIR+0.01);
out.r2v=fp.hpLost;
fp.hpLost=0; flakShots.length=0;
flakShots.push({pos:V3(5000,80,5000),vel:V3(),team:0,owner:{alive:true,isPlayer:true},life:2.05});
updateFlak(0.016,0.016);
out.r2b=(fp.hpLost>=34&&fp.hpLost<=58);
out.r2v2=fp.hpLost;
flakShots.length=0; planes.splice(0,planes.length); planes.push(...savedP);
// ── R3 Bot 高炮交战距离单源: ~121m 开火 / ~200m 不开火 ──
// ★2026-11-01 判据跟走: 交战距离门 2026-10-05 起乘 WX_CFG.rangeMul (天气契约 R6 "天气×夜内联相乘
//   钉死"), 旧写死米数的样点 (134m 开火/280m 不开火) 在阴天档 (×0.9=126m) 全体漂移。改为在沙箱里
//   按同一公式算当档有效交战距, 样点取 0.92×eff (必开火) 与 1.15×eff (必不开火), 对任何天气/夜档稳健。
const savedP2=planes.splice(0,planes.length);
const effR=EMPL_AA_ENGAGE_R*((typeof NIGHT_MODE!=='undefined'&&NIGHT_MODE&&typeof NIGHT_CFG!=='undefined')?NIGHT_CFG.rangeMul:1)*WX_CFG.rangeMul;
const zFire=Math.sqrt(Math.max(1,(effR*0.92)**2-3481));
const foePl={pos:V3(0,60,0),alive:true,team:1,def:{size:1},yaw:0,pitch:0,speed:40};
planes.push(foePl);
const gun={kind:'aa',x:0,y:heightAt(0,0)+1,z:zFire,cd:0,crew:null,yaw:{rotation:{x:0,y:0}},pitch:{rotation:{x:0}}};
const op={empUse:gun,team:0,pos:V3(0,heightAt(0,0),zFire-6),vel:V3(),yaw:0,pitch:0,emplPinT:0,crouch:false,prone:false,
pinEmpl(){},updateMesh(){},_aaTgt:foePl,aaReactT:0,lastFiredT:0};
Bot.prototype.updateEmplacement.call(op,0.016);
out.r3a=(flakShots.length===1);
out.r3b=(Math.abs(gun.cd-EMPL_AA_CD)<1e-6);
gun.cd=0; flakShots.length=0; foePl.pos.set(0,60,zFire+Math.sqrt(Math.max(1,(effR*1.15)**2-3481)));   // 距炮 1.15×eff (相对炮位取距): 炮不响 (旧 220 会响)
Bot.prototype.updateEmplacement.call(op,0.016);
out.r3c=(flakShots.length===0);
flakShots.length=0; planes.splice(0,planes.length); planes.push(...savedP2);
}catch(e){ out.err=String(e&&e.stack||e); }
finally{ raycastWorld=realRCW; smokeBlocksLOS=realSmoke; cropBlocksLOS=realCrop; foliageBlocksLOS=realFol; }
return out;
}catch(e){ return {fatal:String(e&&e.stack||e)}; }
})()`,ctx);
ok(!r.fatal&&!r.err,'R0 沙箱零异常'+(r.fatal?' fatal='+r.fatal:'')+(r.err?' err='+r.err:''));
ok(r.r1a&&r.r1b&&r.r1c,'R1 步兵 perceive 伞降豁免 (平衡②): 更近的伞降目标被跳过选落地者 / 全伞降索敌为空 / 落地即恢复');
ok(r.r2a&&r.r2b,'R2 高炮弹伤减档 (平衡①): Bot 档 '+r.r2v+' ∈[10,17] 吃 GROUNDGUN_VS_AIR, 玩家档 '+r.r2v2+' ∈[34,58] 原样');
ok(r.r3a&&r.r3b&&r.r3c,'R3 Bot 高炮交战距离单源 (平衡②): ~121m 开火+进冷却, ~160m 不开火 (旧 220 会响) [r3a='+r.r3a+' r3b='+r.r3b+' r3c='+r.r3c+']');

console.log('\n'+(FAIL===0?'verify-airground-balance 全部通过 ✓ ('+PASS+')':'存在失败项 ✗ (过 '+PASS+' / 挂 '+FAIL+')'));
process.exit(FAIL===0?0:1);
