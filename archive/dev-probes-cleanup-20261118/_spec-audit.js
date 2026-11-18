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
// dev/verify-wipe.js —— 清场胜利规则沙箱 (不进 Index.html)
// 用法: node dev/verify-wipe.js
// 原理: 复用 probe-match 的桩 (THREE/DOM/WebAudio), 加载全部真实脚本并进入战场 (淞沪/征服),
//       直接驱动 updateFlags / 击杀 / 载具摧毁 / 重生判定, 断言 2026-09-04 清场规则:
//   T1 兵力归零 → 不立即判负, 封重生(Bot/坦克/玩家), 场上残兵清空才判对方胜 (2026-09-05: 坦克不再计入);
//   T2 攻防/征服 任一方占满全部旗点 → 敌方兵力立即归零进入清场 (旧版只认攻方, 淞沪防守方占满无反应);
//   T3 双方同时归零 → 先被清空者负/同帧清空=平局 (平局终局须能正常结算——哨兵修复);
//   T4 清场期间超时 → 照常按票数结算 (票多者胜);
//   T5 己方兵力归零 → 玩家不可再部署;
//   T6 兵力归零方飞机不重生 (对侧可重生);
//   T7 在机飞行员豁免清场/跳伞飞行员计为清场目标;
//   T8 全旗+清场双条件: 票归零+清空但未占满全旗 → 不判胜, 占满后判胜;
//   T9 最后一人 30 秒清场倒计时: 2人不启动/1人+对方占满全旗才启动(2026-09-05 门槛, 旗被翻回复位)/到期仍存活直接判负;
//   T10 倒计时兜底不等待残留坦克 (30 秒到期照常结算);
//   T13 坦克不计入胜利条件: 残兵清空即判胜, 敌方坦克仍存活不阻塞清场 (2026-09-05);
//   T11 坦克越野跨越: 矮盒/油桶可跨不阻挡+底盘爬升+悬挂俯仰弹起, 1.6m 高墙仍阻挡;
//   T12 击杀来源标签: 播报/玩家死亡显示载具/火力点名, 乘员身份反推载具名;
//   T14 击杀记分单源: 玩家杀普通Bot=100/爆头=125 (onPlayerKill 唯一入口), Bot杀Bot=100 (2026-09-06 P0-1)。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
// ── 通用小桩 (与 probe-match.js 同源) ──
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
const _mat=cls=>{ return class extends cls{constructor(o){super();Object.assign(this,o||{});this.color=_wrapColor(this.color);}dispose(){}}; };
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
function load(ctx,file){ vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file}); }
function boot(campIdx){
for(const k in byId)delete byId[k];
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document;ctx.window=window;
ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
// ★2026-09-27I: 脚本链补齐海战四件 (与 index.html 同序) —— S3 要验"舰艇项也置灰", 而舰艇表 (navalCraft)
//   由 15d 提供; 旧链不载 15d ⇒ 舰艇那一半只能空过, 判据看着绿其实什么都没测。
const files=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/23-deploy.js','js/23b-worldrestore.js','js/24-main.js'];
for(const f of files) load(ctx,f);
return ctx;
}
// ── 断言收集 ──
const PASS=[];let FAILS=0;
function ok(cond,label){
if(cond){ PASS.push(label); console.log('  ✔ '+label); }
else { FAILS++; console.log('  ✘ '+label); }
}
// ── 小工具 (与 verify-structscore 同源) ──
const VM=(ctx,expr)=>vm.runInContext(expr,ctx);

// ═════ S1 观战者身体挡弹 (幽灵挡弹) ═════
function s1(){
console.log('S1 raySoldiers/fireBullet: 观战者身体是否仍是弹道上的合法命中体 (挡弹)');
const ctx=boot(0);
const r=VM(ctx,`(()=>{
// 沙箱补桩: 命中会走 08-effects 的血贴片 (bloodMat.clone), 而本探针的 THREE 材质桩没有 clone
try{ if(bloodMat&&!bloodMat.clone) bloodMat.clone=()=>({opacity:1,dispose(){},needsUpdate:false}); }catch(e){}
// 场景: 射手 --6m--> 观战者 --3m--> 敌兵, 三点一线
player.alive=true; player.deployed=true; player.spectator=true;
player.crouch=false; player.prone=false;
// 先找一条净空走廊 (否则第一枪之后的弹道会被树篱/房子截住, 阴性对照失真): 沿 +z 30m 无遮挡
let CX=null;
for(let x=-140;x<=140&&!CX;x+=7) for(let z=-140;z<=110&&!CX;z+=7){
const y=heightAt(x,z)+1.05;
const w=raycastWorld(V3(x,y,z),V3(0,0,1),30);
if(!w||w.dist>26) CX={x,z,y};
}
if(!CX) return {noLane:true};
const px=CX.x, py=CX.y, pz=CX.z+6;   // 观战者站在走廊内 (射手后方 6m)
player.pos.set(px,heightAt(px,pz),pz); player.hp=100;
const tg={ x:px, y:player.pos.y, z:pz+9, team:0, alive:true, crouch:false, prone:false, onVehicle:null, hp:100,
  pos:{x:px,y:player.pos.y,z:pz+9}, damage(a){ this.hp-=a; }, name:'靶兵' };
combatants.push(tg);
const sh={ team:1, isPlayer:false, anonymous:true, pos:V3(px,player.pos.y,pz-6) }; // 射手取敌对阵营: 同队过滤不会摘掉观战者
// (pos 是必需的: 阴性对照里观战者真的中弹, damage() 会读 attacker.pos 画方向指示 —— 缺了它会 TypeError)
// ★2026-09-26H: 弹道高度锚在**观战者的眼位** (旧写法用走廊扫描点的地面高度 ⇒ 沿 15m 的坡度漂移,
//   弹道从头顶上方擦过与否全看地形抖动, 断言随之偶发)。靶兵与观战者同一 y ⇒ 两者都在同一水平线上。
const O=V3(px,player.pos.y+1.62,pz-6), D=V3(0,0,1);
const ray=raySoldiers(O,D,60,sh);
const first=ray?(ray.sol===player?'观战者':(ray.sol===tg?'靶兵':'其它')):'无';
const hp0=tg.hp;
fireBullet(sh,O.clone(),D.clone(),{dmg:30,headMul:1,vehDmg:0},null);
const bot=first, tgAfter=tg.hp, php=player.hp;
// 阴性对照 (★2026-09-26H 翻面): 观战者**站在原地**取消观战 ⇒ 同一发弹必须重新停在他身上
//   (旧版对照是"把观战者移开 40m", 那验的是走廊几何; 翻面后要验的是"排除项就是 spectator 这一个条件")。
const tgHp0=tg.hp, php0=player.hp;
player.spectator=false;
const ray2=raySoldiers(O,D,60,sh);
const second=ray2?(ray2.sol===player?'观战者':(ray2.sol===tg?'靶兵':'其它')):'无';
fireBullet(sh,O.clone(),D.clone(),{dmg:30,headMul:1,vehDmg:0},null);
const tgAfter2=tg.hp, phpAfter=player.hp;
player.spectator=true;
return {noLane:false,first,second,hp0,tgAfter,php,tgAfter2,tgHp0,php0,phpAfter,ct:combatants.length};
})()`);
if(r.noLane){ ok(false,'S1 图上存在 26m 净空走廊 (取到样本)'); return; }
console.log('   [S1] '+JSON.stringify(r));
// ★2026-09-26H 观战批修复后 (用户圈定 A1): 判据翻面 —— 旧读数("弹道先命中观战者")记在
//   交付文档-破坏得分与观战审计-20260926G.md §2 A1; 这里守的是修好之后的行为。
ok(r.first==='靶兵','S1 ★ 三点一线时射线**跳过观战者**直接命中靶兵 (实测 '+r.first+')');
ok(r.tgAfter<r.hp0&&r.php===100,'S1 ★ 同一枪: 靶兵吃伤害、观战者零伤 ('+r.hp0+'→'+r.tgAfter+' / 观战者 '+r.php+')');
ok(r.second==='观战者'&&r.tgAfter2===r.tgHp0&&r.phpAfter<r.php0,
	'S1 阴性对照: 原地取消观战后同一发弹重新停在他身上 (实测 '+r.second+'; 靶兵 '+r.tgHp0+'→'+r.tgAfter2+' 不变, 观战者 '+r.php0+'→'+r.phpAfter+')');
}

// ═════ S3 观战者的出生点列表: 真载具全部置灰 (★2026-09-26H 修复后翻面; ★2026-09-27I 扩到全类) ═════
function s3(){
console.log('S3 部署界面出生项: 观战模式下真载具 (含舰艇/两栖) 是否全部被闸门挡住');
const ctx=boot(11);   // ★2026-09-27I: 改取塔拉瓦环礁 —— 只有带海战的图才验得到"舰艇/两栖车那一半"
const err=VM(ctx,`(()=>{ try{ document.getElementById('startBtn').onclick(); }catch(e){ return String(e&&e.message||e); } return null; })()`);
ok(!err,'S3 开局 (真路径 startBtn.onclick) '+(err||'ok'));
const r=VM(ctx,`(()=>{
const sp=document.getElementById('spawnList');
const read=()=>{
sp.children.length=0;          // 沙箱里 innerHTML='' 不清 children ⇒ 读之前手工清 (否则读到上一次的旧按钮)
sp.innerHTML='';
buildSpawnList();
const out=[];
for(const c of sp.children) out.push({txt:String(c.textContent),dis:!!c.disabled});
return out;
};
player.spectator=false;
const norm=read();
player.spectator=true;
const spec=read();
const vehs=deployVehList(player.team).map(v=>({n:v.name,k:v.kind}));
const hit=(list,n)=>list.filter(x=>x.txt.indexOf(n)>=0)[0]||null;
const tanks=vehs.filter(v=>v.k==='tank'||v.k==='plane').map(v=>{ const it=hit(spec,v.n); return {n:v.n,dis:it?it.dis:null,txt:it?it.txt:''}; });
const boats=vehs.filter(v=>v.k==='boat'||v.k==='amph').map(v=>{ const it=hit(spec,v.n); return {n:v.n,dis:it?it.dis:null,has:!!it,txt:it?it.txt:''}; });
player.spectator=false;
return {nNorm:norm.length,nSpec:spec.length,nTank:tanks.length,nBoat:boats.length,tanks,boats,
ghost:spec.filter(x=>x.txt.indexOf('幽灵坦克')>=0).length,normGhost:norm.filter(x=>x.txt.indexOf('幽灵坦克')>=0).length};
})()`);
ok(r.nTank>0,'S3 前置: 本图确有真坦克/战机进表 ('+r.nTank+' 台)');
ok(r.ghost===0&&r.normGhost===0,'S3 ★ 出生列表里没有「幽灵坦克」项 (改为按 F 按需召唤)');
ok(r.tanks.length>0&&r.tanks.every(x=>x.dis===true&&x.txt.indexOf('观战不可征用')>=0),
'S3 ★ 观战者的坦克/战机项全部置灰并注明「观战不可征用」('+r.tanks.length+' 项)');
// ★2026-09-27I 判据翻面 (用户追补: "观战模式仍能选几个海战相关载具"): 修复批 H 当时给舰艇留了口
//   (依据 2026-09-22 "部署界面选舰艇 = 唯一上艇路径"), 用户本轮把这口子也算作缺陷 ⇒ 舰艇/两栖车一并置灰。
//   想要艇请走近按 F 现场上艇 (干预权不变); 本图无舰艇时该条为空过, 逐类覆盖由 verify-specbatch T2 兜底。
ok(r.boats.length===0||r.boats.every(x=>x.has&&x.dis===true&&x.txt.indexOf('观战不可征用')>=0),
'S3 ★ 舰艇/两栖车项对观战者同样置灰 (2026-09-27I; 本图 '+(r.boats.length?('有 '+r.boats.length+' 台'):'无舰艇, 判据空过')+')');
}

console.log('== 观战子系统取证 ==');
s1(); s3();
console.log('== 结果: '+PASS.length+' 通过 / '+FAILS+' 失败 ==');
process.exit(FAILS?1:0);
