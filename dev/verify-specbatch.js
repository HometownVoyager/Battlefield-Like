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
// dev/verify-specbatch.js —— 观战修复批沙箱 (2026-09-26H, 不进 Index.html)
// 用法: node dev/verify-specbatch.js
// 原理: 复用 verify-wipe/probe-match 的桩 (THREE/DOM/WebAudio), 加载**全部真实脚本** (含新增
//       js/15c-specveh.js) 并进入战场, 直接驱动武器槽/巡飞弹/幽灵坦克/炮弹判定, 断言本批四项:
//   T1 观战连狙: 定义存在 (单发75/300发分/20发/可开镜) + playerClassWeapons 换装 + 部署配枪 +
//      兵种卡开关的"即时换装"(连狙 ⇄ 手枪, 且当前手持副武器时同步换模型);
//   T2 弃弹传送: T 键 ⇒ 巡飞弹静默消失 (dead=true/不爆炸) + 自身瞬移到弹体位置 (速度清零/落点不出地形) + TV 视角收回;
//   T3 幽灵坦克: 不在 tanks/trucks 表 (⇒ 全库弹丸与索敌自动穿透) + 免伤 (takeDmg 无效) + 不被碾压碰撞 +
//      可驾驶 (上车/下车/ffAll 标记) + 主炮 team=-1 + **敌我双方步兵都吃伤害** (用户核心口径);
//   T4 弹丸穿透 ★: 幽灵坦克挡不住炮弹 —— 炮弹穿过它命中其身后的坦克 (阴性对照=把同一发炮弹改为打在普通坦克上必中);
//   T5 飞行中开火: 观战悬停/气动飞行分支现在也会走开火单源 (左键真的打出子弹, 弹匣-1);
//   T6 坦克炮弹增大: SHELL_R=0.3 生效 —— 侧偏 0.5m 的近失弹现在命中步兵, **同一几何下反坦克炮弹(kind='at')仍不命中**
//      (阴性对照, 证明只动了坦克主炮);
//   T7 生命周期: specVehReset 收车 (摘出 world/spawned=false/解绑) + 再召唤可复位; 观战局仍不进历史记录 (粘性标记不变)。
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
cross(v){const x=this.y*v.z-this.z*v.y,y=this.z*v.x-this.x*v.z,z=this.x*v.y-this.y*v.x;this.x=x;this.y=y;this.z=z;return this;}negate(){this.x=-this.x;this.y=-this.y;this.z=-this.z;return this;} // 本批沙箱补齐: playerShoot 的弹道散布用到 cross/negate
applyAxisAngle(){return this;}setFromMatrixColumn(){return this;}lerpVectors(){return this;}
addScalar(s){this.x+=s;this.y+=s;this.z+=s;return this;}divideScalar(s){s=s||1;this.x/=s;this.y/=s;this.z/=s;return this;}distanceToSquared(v){return (this.x-v.x)**2+(this.y-v.y)**2+(this.z-v.z)**2;}setLength(l){return this.normalize().multiplyScalar(l);}}
class Euler{constructor(){this.x=0;this.y=0;this.z=0;this.order='XYZ';}set(x,y,z,o){this.x=x;this.y=y;this.z=z;if(o)this.order=o;return this;}}
class Obj3{constructor(){this.position=new V3();this.rotation=new Euler();this.scale=new V3(1,1,1);this.quaternion={setFromUnitVectors(){return this;}};this.children=[];this.visible=true;this.castShadow=false;this.receiveShadow=false;this.renderOrder=0;this.matrix={};this.userData={};this.material=null;this.geometry=null;}
add(m){this.children.push(m);m.parent=this;return this;}remove(m){const i=this.children.indexOf(m);if(i>=0)this.children.splice(i,1);}
clear(){this.children.length=0;return this;} // 本批沙箱补齐: 10-viewmodel vmEquip 先 clear 再装枪 (deployPlayer 路径会走到)
traverse(fn){fn(this);for(const c of this.children)if(c&&c.traverse)c.traverse(fn);}
updateMatrix(){}
lookAt(){return this;}
clone(){const c=new this.constructor();if(this.geometry)c.geometry=this.geometry;if(this.material)c.material=this.material;c.position=new V3(this.position.x,this.position.y,this.position.z);c.rotation=new Euler();if(this.rotation.x||this.rotation.y||this.rotation.z)c.rotation.set(this.rotation.x,this.rotation.y,this.rotation.z);c.scale=new V3(this.scale.x,this.scale.y,this.scale.z);c.visible=this.visible;c.castShadow=this.castShadow;c.name=this.name;return c;}};
class Geo{constructor(...a){this.attributes={};this.parameters={};}translate(){return this;}rotateX(){return this;}rotateY(){return this;}rotateZ(){return this;}setAttribute(n,a){this.attributes[n]=a;return this;}setIndex(){return this;}setFromPoints(){return this;}computeVertexNormals(){return this;}dispose(){}}
class _PlaneGeo extends Geo{constructor(w=1,h=1,sg=1,sh=1){super(w,h);const gx=(sg||1)+1,gy=(sh||1)+1;this.attributes.position={count:gx*gy,array:new Float32Array(gx*gy*3),getX:i=>((i%gx)/gx-0.5)*w,getZ:i=>(Math.floor(i/gx)/gy-0.5)*h,getY:()=>0,setY(){},setX(){},setZ(){}};}}
class BufAttr{constructor(a,n){this.array=a;this.itemSize=n;this.count=(a&&a.length)||0;}
set(){return this;}
// 本批补桩: three 的 BufferAttribute.setXYZ (14-bots BotDebug.drawPath 与 22b 观战信息层的指向线都用它;
//   旧桩只有 setX/setY/setZ ⇒ 那两条路径在沙箱里静默不更新几何 —— 断言会误判成"线没画出来")
setXYZ(i,x,y,z){ if(this.array){ this.array[i*this.itemSize]=x; this.array[i*this.itemSize+1]=y; this.array[i*this.itemSize+2]=z; } return this; }
getX(i){return (this.array&&this.array[i*this.itemSize])||0;}
getY(i){return (this.array&&this.array[i*this.itemSize+1])||0;}
getZ(i){return (this.array&&this.array[i*this.itemSize+2])||0;}
setX(i,v){if(this.array)this.array[i*this.itemSize]=v;}
setY(i,v){if(this.array)this.array[i*this.itemSize+1]=v;}
setZ(i,v){if(this.array)this.array[i*this.itemSize+2]=v;}}
class _Color{constructor(c){this.c=c;}set(){return this;}}
const _wrapColor=c=>(typeof c==='number'||typeof c==='string')?{set(v){this.v=v;}}:(c&&typeof c==='object')?c:{set(){}};
const _mat=cls=>{ return class extends cls{constructor(o){super();Object.assign(this,o||{});this.color=_wrapColor(this.color);}
dispose(){}
// clone: 08-effects 的血贴片按"每贴片独立克隆材质"实现 (bloodMat.clone) —— 桩里缺它会
//   在 T3 推演里偶发抛 TypeError (只在推演中出现中弹血贴片时命中, 实测 1/8 概率)。
//   补桩不改任何断言, 只把一条环境性偶发红去掉 (2026-09-26G 批顺带)。
clone(){ const c=new this.constructor(); Object.assign(c,this); c.color=_wrapColor(this.color); return c; }}; };
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
Line:class extends Obj3{constructor(g,m){super();this.geometry=g;this.material=m;}},   // 本批补桩: 22b 观战信息层的指向线 (与 14-bots BotDebug 同用 THREE.Line)
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
// ── 输入/确认桩 (本批探针要跑“真键位链”与 confirm 对话框) ──
const handlers={};
sandbox.addEventListener=(t,f)=>{ (handlers[t]=handlers[t]||[]).push(f); };
sandbox.confirm=()=>true;   // 默认“确定”; 需要“取消”的用例在 VM 里覆盖: confirm=()=>false;
sandbox.globalThis=sandbox;
sandbox.THREE=THREE;
sandbox.window=window;
function load(ctx,file){ require('./_loadcache.js').script(root,file).runInContext(ctx); } // 2026-11-19 效率批: 读盘+编译缓存 (11 boot 原先每次重读重编)
function boot(campIdx){
for(const k in byId)delete byId[k];
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document;ctx.window=window;
ctx.localStorage={_s:{sf_campaign:String(campIdx),sf_exp:'1'},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};   // sf_exp=1: 观战开关的前提 (实验模式)
const files=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/22a-menuart.js','js/22b-speclayer.js','js/23-deploy.js','js/23b-worldrestore.js','js/24-main.js'];   // 与 index.html 同序 (全链)
for(const k in handlers) delete handlers[k];   // 每个 boot 先清空监听表, 再跑脚本链 (否则把刚注册的 keydown 也清了)
for(const f of files) load(ctx,f);
// 真键位链派发: 与浏览器同形的最小 KeyboardEvent (code/repeat/preventDefault)
ctx.__key=(code)=>{ for(const f of (handlers.keydown||[])) f({code,repeat:false,preventDefault(){},stopPropagation(){}}); };
return ctx;
}
// ── 断言收集 ──
const PASS=[];let FAILS=0;
function ok(cond,label){
if(cond){ PASS.push(label); console.log('  ✔ '+label); }
else { FAILS++; console.log('  ✘ '+label); }
}
function exc(tag,e){ ok(false,tag+' 推演异常: '+String(e&&e.stack||e)); }
const START=`SPAWN_PROT=0; document.getElementById('startBtn').onclick();`; // 出生保护豁免 (2026-09-28 阶段三): 探针不模拟时间, 开局前关单源

// 探针小工具: 在某个 ctx 里跑一段代码 (与 verify-structscore/_spec-audit 同名)
const VM=(ctx,expr)=>vm.runInContext(expr,ctx);

// ═════ T1 A#1 (A1): 观战者身体不再是弹道上的合法命中体 ═════
function t1(){
console.log('T1 ★A1 幽灵挡弹: 子弹穿过观战者命中其身后的靶兵 (阴性对照=取消观战即重新挡弹)');
const ctx=boot(0);
const r=VM(ctx,`(()=>{try{
// 沙箱补桩: 命中的血贴片按"每贴片克隆材质"实现 (bloodMat.clone), 本探针的材质桩没有 clone
try{ if(bloodMat&&!bloodMat.clone) bloodMat.clone=()=>({opacity:1,dispose(){},needsUpdate:false}); }catch(e){}
player.alive=true; player.deployed=true; player.spectator=true;
player.crouch=false; player.prone=false;
// 找一条 26m 净空走廊 (否则弹道会被树篱/房子截住, 断言失真): 沿 +z 无遮挡
let CX=null;
for(let x=-140;x<=140&&!CX;x+=7) for(let z=-140;z<=110&&!CX;z+=7){
const y=heightAt(x,z)+1.05;
const w=raycastWorld(V3(x,y,z),V3(0,0,1),30);
if(!w||w.dist>26) CX={x,z,y};
}
if(!CX) return {noLane:true};
const px=CX.x, pz=CX.z+6;
player.pos.set(px,heightAt(px,pz),pz); player.hp=100;
const tg={ x:px, y:player.pos.y, z:pz+9, team:0, alive:true, crouch:false, prone:false, onVehicle:null, hp:100,
pos:{x:px,y:player.pos.y,z:pz+9}, damage(a){ this.hp-=a; }, name:'靶兵' };
combatants.push(tg);
const sh={ team:1, isPlayer:false, anonymous:true, pos:V3(px,player.pos.y,pz-6) };
// 弹道高度锚在**观战者眼位**: 靶兵与观战者同一 y ⇒ 三点一线是确定的一条水平线 (不吃地形坡度)
const O=V3(px,player.pos.y+1.62,pz-6), D=V3(0,0,1);
const ray=raySoldiers(O,D,60,sh);
const first=ray?(ray.sol===player?'观战者':(ray.sol===tg?'靶兵':'其它')):'无';
fireBullet(sh,O.clone(),D.clone(),{dmg:30,headMul:1,vehDmg:0},null);
const after={tg:tg.hp,php:player.hp};
// 阴性对照: 原地取消观战 ⇒ 同一发弹必须重新停在他身上 (排除项就是 spectator 这一个条件)
player.spectator=false;
const ray2=raySoldiers(O,D,60,sh);
const second=ray2?(ray2.sol===player?'观战者':(ray2.sol===tg?'靶兵':'其它')):'无';
const tgHp0=tg.hp, php0=player.hp;
fireBullet(sh,O.clone(),D.clone(),{dmg:30,headMul:1,vehDmg:0},null);
const after2={tg:tg.hp,php:player.hp};
player.spectator=true;
return {noLane:false,first,second,after,after2,tgHp0,php0,ct:combatants.length};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof r==='string'){ exc('T1',r); return; }
if(r.noLane){ ok(false,'T1 图上存在 26m 净空走廊 (取到样本)'); return; }
ok(r.first==='靶兵','T1 ★ 观战者挡在弹道上时射线**跳过**他直接命中靶兵 (实测 '+r.first+')');
ok(r.after.tg===70&&r.after.php===100,'T1 ★ 同一枪: 靶兵吃满伤害、观战者零伤 ('+r.after.tg+'/'+r.after.php+')');
ok(r.second==='观战者'&&r.after2.tg===r.tgHp0&&r.after2.php<r.php0,
'T1 阴性对照: 原地取消观战后弹重新停在他身上 (实测 '+r.second+'; 靶兵 '+r.tgHp0+'→'+r.after2.tg+' 不变, 观战者 '+r.php0+'→'+r.after2.php+')');
}

// ═════ T2 A#2: 出生列表观战闸门 (真载具全类置灰 / 普通玩家不受影响 / 无幽灵坦克项) ═════
function t2(){
console.log('T2 ★A2 出生列表: 坦克/战机/舰艇/两栖车对观战者一律置灰, 幽灵坦克不进列表');
const ctx=boot(11);   // 塔拉瓦环礁: 本图有舰艇与两栖车, 才验得到"海战载具那一半"
const err=VM(ctx,`(()=>{try{ SPAWN_PROT=0; document.getElementById('startBtn').onclick(); }catch(e){ return String(e&&e.message||e); } return null; })()`);
ok(!err,'T2 开局 (真路径 startBtn.onclick) '+(err||'ok'));
const r=VM(ctx,`(()=>{try{
const sp=document.getElementById('spawnList');
const read=()=>{
sp.children.length=0; sp.innerHTML='';   // 沙箱里 innerHTML='' 不清 children ⇒ 读之前手工清
buildSpawnList();
const out=[];
for(const c of sp.children) out.push({txt:String(c.textContent),dis:!!c.disabled});
return out;
};
player.spectator=false; const norm=read();
player.spectator=true;  const spec=read();
const vehs=deployVehList(player.team).map(v=>({n:v.name,k:v.kind}));
const hit=(list,n)=>list.filter(x=>x.txt.indexOf(n)>=0)[0]||null;
const pick=(list,kinds)=>vehs.filter(v=>kinds.indexOf(v.k)>=0).map(v=>{ const it=hit(list,v.n); return {n:v.n,k:v.k,dis:it?it.dis:null,txt:it?it.txt:''}; });
player.spectator=false;
return {nNorm:norm.length,nSpec:spec.length,
normTanks:pick(norm,['tank','plane']),specTanks:pick(spec,['tank','plane']),
normBoats:pick(norm,['boat','amph']),specBoats:pick(spec,['boat','amph']),
ghost:spec.filter(x=>x.txt.indexOf('幽灵坦克')>=0).length+norm.filter(x=>x.txt.indexOf('幽灵坦克')>=0).length};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof r==='string'){ exc('T2',r); return; }
ok(r.normTanks.length>0,'T2 前置: 本图有真坦克/战机进表 ('+r.normTanks.length+' 台)');
ok(r.normTanks.every(x=>x.dis===false&&x.txt.indexOf('观战不可征用')<0),'T2 阴性对照: 普通玩家的同一份列表里坦克/战机照常可选 (无"不可征用"字样)');
ok(r.specTanks.length>0&&r.specTanks.every(x=>x.dis===true&&x.txt.indexOf('观战不可征用')>=0),
'T2 ★ 观战者的坦克/战机项全部置灰并注明「观战不可征用」('+r.specTanks.length+' 项)');
ok(r.normBoats.length>0&&r.normBoats.every(x=>x.dis===false&&x.txt.indexOf('观战不可征用')<0),
'T2 阴性对照: 普通玩家的舰艇/两栖车照常可选 ('+r.normBoats.length+' 台 — 2026-09-22 裁定② 的"部署界面上艇"对普通玩家不变)');
// ★2026-09-27I 判据翻面 (用户追补: "观战模式仍能选几个海战相关载具"): 修复批 H 当时给舰艇留了口 (依据
//   2026-09-22 的"唯一上艇路径"裁定), 用户本轮把这条口子也算作缺陷 —— 出生项里的每一项都是**真载具**,
//   观战者一律不可征用; 想开艇走"走近按 F 现场上艇"那条干预路径。
ok(r.specBoats.length>0&&r.specBoats.every(x=>x.dis===true&&x.txt.indexOf('观战不可征用')>=0),
'T2 ★ 舰艇/两栖车对观战者同样全部置灰并注明 (2026-09-27I: 出生项里每一项都是真载具, 一律不可征用)');
ok(r.ghost===0,'T2 ★ 出生列表里没有「幽灵坦克」项 (改为按 F 按需召唤)');
// 结构性闸门 (与列表置灰同源): 选中项里残留的**任意**真载具索引都不能把观战者送进去
// (2026-09-27I: 旧断言只试坦克; 现在坦克与舰艇各试一次 —— 后者正是用户实报的口子)
const gate=VM(ctx,`(()=>{try{
const out=[];
for(const kind of ['tank','boat']){
player.spectator=true;
const vi=deployVehList(player.team).findIndex(v=>v.kind===kind&&v.alive);
if(vi<0){ out.push({kind,vi:-1}); continue; }
const vv=deployVehList(player.team)[vi];
selectedSpawn='V'+vi;                      // 模拟"先选载具、再开观战"的残留选中项
deployPlayer();
out.push({kind,vi,spec:player.spectator,onVeh:player.onVehicle===vv,onNaval:player.onNaval===vv,
sel:selectedSpawn,driven:vv.playerDriven,nCol:vv.crewSlots?vv.crewSlots.filter(s=>s&&s.soldier).length:null});
}
player.spectator=false; selectedSpawn=-1;
return out;
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof gate==='string'){ exc('T2 闸门',gate); return; }
const gT=gate.filter(g=>g.kind==='tank')[0], gB=gate.filter(g=>g.kind==='boat')[0];
ok(gT.vi>=0&&gT.onVeh===false&&gT.driven===false&&gT.sel===-1,'T2 ★ 结构性闸门 (坦克): 观战者无论如何都无法进入真坦克 (选中项被清, 车保持 AI 驾驶)');
ok(gB&&gB.vi>=0&&gB.onNaval===false&&gB.driven===false&&gB.sel===-1,'T2 ★ 结构性闸门 (舰艇): 选中项残留 '+(gB?'V'+gB.vi:'-')+' ⇒ 部署时被清, 观战者没有上艇 (车组照旧)');

}

// ═════ T3 A#3: 战斗中开观战 = 二次确认 + 下次部署生效; 关闭立即生效 ═════
function t3(){
console.log('T3 ★A3 观战开关: 战斗中先确认且下次部署才生效, 当场不免伤; 关闭立即生效');
const ctx=boot(0);
const err=VM(ctx,`(()=>{try{ SPAWN_PROT=0; document.getElementById('startBtn').onclick(); }catch(e){ return String(e&&e.message||e); } return null; })()`);
ok(!err,'T3 开局 (真路径 startBtn.onclick) '+(err||'ok'));
const r=VM(ctx,`(()=>{try{
const card=document.getElementById('classGrid').children[3];   // 兵种 8→5 (2026-09-28): 卡 3 = 反坦克兵 (实验模式=巡飞弹兵)
// ① 兵种选择阶段 (未落地): 与旧版一致 —— 立即生效, 不问确认
player.cls=3; player.spectator=false; player.specUsed=false; player.specWant=null;
player.alive=false; player.deployed=false;
card.onclick();
const stage={spec:player.spectator,want:player.specWant};
// 回退: 普通玩家落地 (进入"战斗中")
player.spectator=false; player.specUsed=false; player.specWant=null;
selectedSpawn=-1; deployPlayer();
const mid={alive:player.alive,deployed:player.deployed,spec:player.spectator};
// ② 战斗中选"取消" → 什么都不发生
confirm=()=>false;
card.onclick();
const cancel={spec:player.spectator,want:player.specWant};
// ③ 战斗中选"确定" → 只记意图, 当场不免伤 (打一发 40 伤害看血)
confirm=()=>true;
card.onclick();
const pending={spec:player.spectator,want:player.specWant};
player.hp=100; player.damage(40,null,false);
const hp=player.hp;
// ④ 下一次部署才落地 (配枪同步换成观战连狙)
deployPlayer();
const applied={spec:player.spectator,want:player.specWant,slot:player.slots[1]&&player.slots[1].key};
// ⑤ 关闭: 立即生效 (观战者不会阵亡 ⇒ 若也等部署就永远退不出来)
card.onclick();
const off={spec:player.spectator,want:player.specWant};
return {stage,mid,cancel,pending,hp,applied,off};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof r==='string'){ exc('T3',r); return; }
ok(r.stage.spec===true&&r.stage.want===null,'T3 兵种选择阶段开观战: 立即生效 (未落地时不打扰)');
ok(r.mid.alive===true&&r.mid.deployed===true&&r.mid.spec===false,'T3 前置: 已进入战斗中 (活着·已落地·非观战)');
ok(r.cancel.spec===false&&r.cancel.want===null,'T3 ★ 战斗中确认框选"取消" ⇒ 开关不动 (旧版是当场生效)');
ok(r.pending.spec===false&&r.pending.want===true,'T3 ★ 战斗中确认后只记意图: player.spectator 仍为 false (待生效)');
ok(r.hp===60,'T3 ★ 待生效期间**照常挨打** (打 40 血实扣: 60) —— 没有"瞬间变免伤"的窗口');
ok(r.applied.spec===true&&r.applied.want===null&&r.applied.slot==='specsniper','T3 ★ 下一次部署落地: 观战生效 + 副武器换观战连狙');
ok(r.off.spec===false&&r.off.want===null,'T3 关闭观战: 立即生效 (不需要再死一次)');
}

// ═════ T4 A#4 + 用户实报: 观战者座驾保护 (不被索敌 / 不被击毁 / 不共死) ═════
function t4(){
console.log('T4 ★A4 观战者座驾: 免伤 + 不被索敌 + 车毁不带走观战者 (阴性对照=普通玩家照旧)');
const ctx=boot(0);
const err=VM(ctx,`(()=>{try{ SPAWN_PROT=0; document.getElementById('startBtn').onclick(); }catch(e){ return String(e&&e.message||e); } return null; })()`);
ok(!err,'T4 开局 (真路径 startBtn.onclick) '+(err||'ok'));
const r=VM(ctx,`(()=>{try{
player.team=0; player.cls=3; player.spectator=true; player.specUsed=true; selectedSpawn=-1;
deployPlayer();
const t=tanks.filter(v=>v.team===0&&v.alive)[0];
// 把观战者放进真坦克 (UI 已把出生项置灰 ⇒ 这里直接写座位字段, 等价于上车收尾)
t.playerDriven=true; player.onVehicle=t; player.ffAll=false;
const ride0=specRide(t);
// ① 免伤: 走真实伤害入口 (含 ap 重击)
const hp0=t.hp;
t.takeDmg(999,null,true); t.takeDmg(500,null,true);
const hit={alive:t.alive,hp:t.hp,same:t.hp===hp0};
// ② 不被索敌: 反装甲兵的"最近敌车"扫描 + 车长感知候选
const foe={team:1,pos:player.pos,alive:true,cls:5,onVehicle:null,spectator:false};
// 把其余同队坦克临时置亡 ⇒ 判据只落在"这一辆观战者座驾"上 (否则返回另一辆普通坦克, 断言无区别力)
const others=tanks.filter(v=>v!==t&&v.team===0&&v.alive);
for(const o of others) o.alive=false;
const near=enemyTankNear(foe,200);
for(const o of others) o.alive=true;
// ③ 兜底: 强制 die (绕过免伤) ⇒ 观战者安全脱离, 0 死 / 0 票 / 0 杀
const d0=player.deaths, tk0=tickets[player.team], k0=player.kills;
t.die({name:'敌军',team:1,kills:0,score:0,pos:player.pos,isPlayer:false});
const eject={deaths:player.deaths,tickets:tickets[player.team],kills:player.kills,onVeh:player.onVehicle,
alive:player.alive,hp:player.hp,dist:+Math.hypot(player.pos.x-t.pos.x,player.pos.z-t.pos.z).toFixed(2)};
// ④ 阴性对照: 普通玩家驱动的同款车被毁 ⇒ 走既有死亡链 (记死 + 掉票)
const tv=tanks.filter(v=>v.team===0&&v.alive)[0];
player.spectator=false; player.specUsed=false;
tv.playerDriven=true; player.onVehicle=tv;
const dN0=player.deaths, tkN0=tickets[player.team];
tv.die({name:'敌军',team:1,kills:0,score:0,pos:player.pos,isPlayer:false});
const norm={deaths:player.deaths,tickets:tickets[player.team],alive:player.alive,onVeh:player.onVehicle};
return {ride0,hit,nearSkip:near===null,d0,tk0,k0,eject,dN0,tkN0,norm};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof r==='string'){ exc('T4',r); return; }
ok(r.ride0===true,'T4 前置: specRide 认得出"观战者正驾驶这辆车"');
ok(r.hit.alive===true&&r.hit.same===true,'T4 ★ 免伤: 999+500 反装甲直击后车体毫发无伤 (hp '+r.hit.hp+')');
ok(r.nearSkip===true,'T4 ★ 不被索敌: 反装甲兵的最近敌车扫描跳过观战者座驾 (旧版会把他当敌车点名)');
ok(r.eject.alive===true&&r.eject.deaths===r.d0&&r.eject.tickets===r.tk0&&r.eject.kills===r.k0&&r.eject.onVeh===null,
'T4 ★ 车毁不带走观战者: 0 死 ('+r.d0+'→'+r.eject.deaths+') / 0 票 ('+r.tk0+'→'+r.eject.tickets+') / 0 杀, 座位已解绑');
ok(r.eject.dist<=8,'T4 安全脱离落点在车旁 ('+r.eject.dist+'m)');
ok(r.norm.alive===false&&r.norm.deaths===r.dN0+1&&r.norm.tickets<r.tkN0,
'T4 阴性对照: 普通玩家驱动的车被毁照旧走死亡链 (阵亡 +1, 本方掉票 '+r.tkN0+'→'+r.norm.tickets
+' = 1 驾驶员 + 2 轻量乘员名额, 与旧口径一致)');
}

// ═════ T5 幽灵坦克按需召唤 (开场/部署不预置) ═════
function t5(){
console.log('T5 幽灵坦克按需召唤: 部署后场上无车, F 才显形并上车 (真键位链)');
const ctx=boot(0);
const err=VM(ctx,`(()=>{try{ SPAWN_PROT=0; document.getElementById('startBtn').onclick(); }catch(e){ return String(e&&e.message||e); } return null; })()`);
ok(!err,'T5 开局 (真路径 startBtn.onclick) '+(err||'ok'));
const r=VM(ctx,`(()=>{try{
player.team=0; player.cls=3; player.spectator=true; player.specUsed=true; selectedSpawn=-1;
deployPlayer();
const pre={info:specVehInfo(),inWorld:(typeof SPECVEH!=='undefined'&&!!SPECVEH)};
pointerLocked=true;
__key('KeyF');                                  // 真键位链: 19-input KeyF → tryInteract ③
const g=(typeof SPECVEH!=='undefined')?SPECVEH:null;
const on={has:!!g,spawned:g?g.spawned:null,boarded:!!(g&&player.onVehicle===g),ff:player.ffAll===true,
d:g?+Math.hypot(g.pos.x-player.pos.x,g.pos.z-player.pos.z).toFixed(2):-1,inWorld:g?world.children.indexOf(g.grp)>=0:false};
deployPlayer();                                  // 再部署 ⇒ 收车
const post={inWorld:(typeof SPECVEH!=='undefined'&&!!SPECVEH),info:specVehInfo()};
return {pre,on,post};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof r==='string'){ exc('T5',r); return; }
ok(r.pre.info===null&&r.pre.inWorld===false,'T5 ★ 部署不再预置幽灵坦克 (开场第一眼与普通战场一致)');
ok(r.on.has===true&&r.on.spawned===true&&r.on.boarded===true&&r.on.inWorld===true&&r.on.ff===true,'T5 ★ 按 F 才显形: 车挂进场景并直接上车 (ffAll 无差别火力就位)');
ok(r.on.d>=0&&r.on.d<8,'T5 召唤落点在脚下 ('+r.on.d+'m)');
ok(r.post.inWorld===false&&r.post.info===null,'T5 再部署即收车: 下次召唤是全新就位 (场上不留白车)');
}

// ═════ T6 B6 观战信息层 ═════
function t6(){
console.log('T6 ★B6 观战信息层: 头顶名牌 (名字/队属色/血量) + 交火指向线 + J 开关');
const ctx=boot(0);
const err=VM(ctx,`(()=>{try{ SPAWN_PROT=0; document.getElementById('startBtn').onclick(); }catch(e){ return String(e&&e.message||e); } return null; })()`);
ok(!err,'T6 开局 (真路径 startBtn.onclick) '+(err||'ok'));
const r=VM(ctx,`(()=>{try{
player.team=0; player.cls=3; player.spectator=true; player.specUsed=true; selectedSpawn=-1;
deployPlayer();
camera.position.set(player.pos.x,player.pos.y+1.6,player.pos.z);   // 沙箱里相机不在玩家身上, 手工对齐
const act=specLayerActive();
updateSpecLayer(0.3);
const c0=SpecLayer.count;
const tags=soldiers.filter(s=>s.alive&&s._specTag&&s._specTag.visible);
const host=tags.length?(!!tags[0]._specTag.userData.host):false;
// 指向线: 给一名在场的 Bot 指定交战目标
const nearCam=s=>Math.hypot(s.pos.x-camera.position.x,s.pos.z-camera.position.z)<60;
const a=soldiers.filter(s=>s.alive&&nearCam(s))[0];
const b2=soldiers.filter(s=>s.alive&&s!==a)[0];
a.target=b2;
updateSpecLayer(0.3);
let line={on:false,az:a.pos.z,tz:b2.pos.z,p0z:null,p1z:null};
if(a._specLine&&a._specLine.visible){
const ap=a._specLine.geometry&&a._specLine.geometry.attributes&&a._specLine.geometry.attributes.position;
line={on:true,az:a.pos.z,tz:b2.pos.z,p0z:ap&&ap.getZ?ap.getZ(0):null,p1z:ap&&ap.getZ?ap.getZ(1):null};
}
// 关 (J): 全收; 开: 回来
const offRet=specLayerToggle();
updateSpecLayer(0.3);
const c1=SpecLayer.count, vis1=soldiers.filter(s=>s._specTag&&s._specTag.visible).length;
specLayerToggle();
// 非观战态: 层必须自动空转 (不画任何东西)
player.spectator=false;
updateSpecLayer(0.3);
const c2=SpecLayer.count;
return {act,c0,tagN:tags.length,host,line,offRet,c1,vis1,c2,layerOn:SpecLayer.on};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof r==='string'){ exc('T6',r); return; }
ok(r.act===true&&r.layerOn===true,'T6 前置: 观战者落地后信息层默认开启 (SpecLayer.on)');
ok(r.c0>0&&r.tagN>0&&r.host===false,'T6 ★ 名牌: 邻域内单位头顶挂上 sprite 标签, userData 无 host 环 (D1 环源已除, 2026-09-28) ('+r.tagN+' 个可见 / 计数 '+r.c0+')');
ok(r.line.on===true&&r.line.p0z!==null&&Math.abs(r.line.p0z-r.line.az)<0.01&&Math.abs(r.line.p1z-r.line.tz)<0.01,
'T6 ★ 指向线: 有交战目标的单位画出一条连线 (起点=单位 '+r.line.az.toFixed(1)+' / 终点=目标 '+r.line.tz.toFixed(1)+' ⇒ 实测 '+r.line.p0z.toFixed(1)+'→'+r.line.p1z.toFixed(1)+')');
ok(r.offRet===false&&r.c1===0&&r.vis1===0,'T6 J 键关掉信息层: 全部名牌/指向线立即收起 (计数归零)');
ok(r.c2===0,'T6 取消观战后信息层自动空转 (普通玩家看不到这层)');
}

// ═════ T7 B7 观战时停 (2026-09-27I 收敛: 只留时停) ═════
function t7(){
console.log('T7 ★B7 时停: K 开/关 (世界与 nowT 同冻), 慢放/单步已删, 非观战零漂移');
const ctx=boot(0);
const err=VM(ctx,`(()=>{try{ SPAWN_PROT=0; document.getElementById('startBtn').onclick(); }catch(e){ return String(e&&e.message||e); } return null; })()`);
ok(!err,'T7 开局 (真路径 startBtn.onclick) '+(err||'ok'));
const r=VM(ctx,`(()=>{try{
player.team=0; player.cls=3; player.spectator=true; player.specUsed=true; selectedSpawn=-1;
deployPlayer();
pointerLocked=true;
const s0=specTimeStatus(), k0=Object.keys(SPEC_TIME).join(',');
__key('KeyK'); const st1=specTimeStatus(), c0=specTimeConsume(0.016);
const p0=specTimePlayerDt(0.016,0), p1=specTimePlayerDt(0.016,0.008);      // 观察者例外: 冻结时两支都返回真实帧长
// 已删除的档位/单步键: 函数不存在, 按下也没有任何副作用
const gone=(typeof specTimeSlower==='function')||(typeof specTimeFaster==='function')||(typeof specTimeStep==='function')||(typeof specTimeScale==='function');
__key('Comma'); __key('Period'); __key('KeyL');
const afterKeys=specTimeStatus(), c1=specTimeConsume(0.016);
__key('KeyK'); const st2=specTimeStatus(), c2=specTimeConsume(0.016);
const p2=specTimePlayerDt(0.016,0.008);      // 非时停: 本体链帧长恒 ≡ 世界帧长 (零漂移)
player.spectator=false;
const st3=specTimeStatus(), c3=specTimeConsume(0.02);
specTimeReset();
return {s0,k0,st1,c0,p0,p1,gone,afterKeys,c1,st2,c2,p2,st3,c3};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof r==='string'){ exc('T7',r); return; }
ok(r.s0==='运行'&&r.k0==='paused','T7 前置: 默认"运行", SPEC_TIME 只剩一个 paused 状态 (无档位表/无步进计数)');
ok(r.st1==='暂停'&&r.c0===0,'T7 ★ K 键时停: 世界推进量 = 0 (战场与 nowT 一起冻)');
ok(Math.abs(r.p0-0.016)<1e-9&&Math.abs(r.p1-0.016)<1e-9,'T7 ★ 观察者例外: 时停期间本体链拿到真实帧长 (specTimePlayerDt 两支都返回 0.016 —— 用户 2026-09-27 "时停的时候玩家也不能动" 的修复)');
ok(Math.abs(r.p2-0.008)<1e-9,'T7 非时停时本体链帧长仍是世界帧长 (pdt≡dt, 零漂移)');
ok(r.gone===false&&r.afterKeys==='暂停'&&r.c1===0,'T7 ★ 慢放(,/.)与单步(L)已整段删除 (函数不存在; 按键落在观战态里也没有任何效果)');
ok(r.st2==='运行'&&r.c2===0.016,'T7 ★ K 再按一次: 世界恢复推进 (本帧 0.016 原样通过)');
ok(r.st3==='运行'&&r.c3===0.02,'T7 ★ 非观战态: 时停恒不生效, 帧时间原样通过 (关掉观战/换局后不留后效)');
}

// ═════ T7b 时停对海战载具生效 (2026-09-27I: 用户实报"时停等对海战载具完全无影响") ═════
function t7b(){
console.log('T7b ★ 时停的覆盖面: 海战载具跟着冻 (旧版 updateNaval 用 1/60 兜底顶掉 dt=0)');
const ctx=boot(11);   // 塔拉瓦: 有舰艇/两栖车
const err=VM(ctx,`(()=>{try{ SPAWN_PROT=0; document.getElementById('startBtn').onclick(); }catch(e){ return String(e&&e.message||e); } return null; })()`);
ok(!err,'T7b 开局 (真路径 startBtn.onclick) '+(err||'ok'));
const r=VM(ctx,`(()=>{try{
player.team=0; player.cls=3; player.spectator=true; player.specUsed=true; selectedSpawn=-1;
deployPlayer();
const idx=navalCraft.findIndex(n=>n&&n.alive&&n.state==='run');
if(idx<0) return {none:true};
const n=navalCraft[idx], y0=n.pos.y;
const at=(x,z)=>{ n.pos.x=x; n.pos.z=z; n.pos.y=y0; };
// ① 阳性对照: 正常帧长下它照常航行 (本探针取样有效)
n.playerDriven=false; n.vel=9;
at(n.pos.x,n.pos.z); const ax=n.pos.x, az=n.pos.z;
for(let i=0;i<30;i++) updateNaval(1/60);
const move=+Math.hypot(n.pos.x-ax,n.pos.z-az).toFixed(2);
// ② 时停: dt=0 ⇒ 一动不动 (旧版这里被 1/60 兜底顶成满速)
n.vel=9; at(ax,az);
for(let i=0;i<30;i++) updateNaval(0);
const frozen=+Math.hypot(n.pos.x-ax,n.pos.z-az).toFixed(3);
// ③ 座驾例外: 观战者**正在开**的那条艇吃第二实参 —— 时停下仍跟着本体走
n.vel=9; at(ax,az);
player.onNaval=n; n.playerDriven=true;
for(let i=0;i<30;i++) updateNaval(0,1/60);
const ride=+Math.hypot(n.pos.x-ax,n.pos.z-az).toFixed(2);
// ④ 阴性对照: 同一条艇, 观战者没在上面 ⇒ 又冻住 (判据单源 specRide)
player.onNaval=null; n.playerDriven=false;
n.vel=9; at(ax,az);
for(let i=0;i<30;i++) updateNaval(0,1/60);
const rideOff=+Math.hypot(n.pos.x-ax,n.pos.z-az).toFixed(3);
n.vel=0; at(ax,az);
return {none:false,kind:n.kind,name:n.name,move,frozen,ride,rideOff,alive:n.alive,state:n.state};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof r==='string'){ exc('T7b',r); return; }
if(r.none){ ok(false,'T7b 前置: 塔拉瓦图上有在航的舰艇/两栖车 (取到样本)'); return; }
ok(r.move>0.5,'T7b 阳性对照: 正常帧长下 '+r.name+' 照常航行 (30 帧走了 '+r.move+'m ⇒ 取样有效)');
ok(r.frozen<0.05,'T7b ★ 时停 (dt=0): 海战载具一动不动 ('+r.frozen+'m; 旧版 updateNaval 的 `dt=1/60` 兜底会把它顶成满速)');
ok(r.ride>0.5,'T7b ★ 座驾例外: 观战者在开的艇跟本体同速前进 (时停 30 帧走了 '+r.ride+'m)');
ok(r.rideOff<0.05,'T7b ★ 阴性对照: 同一条艇取消座驾身份后又被冻住 ('+r.rideOff+'m ⇒ 判据单源 specRide, 不是"海战一律放行")');
}

// ═════ T7c 时停时观战者本体仍可移动 (用户 2026-09-27: "时停的时候玩家也不能动") ═════
function t7c(){
console.log('T7c ★ 观察者例外: 时停下观战者本人照常走动 (旧版把世界帧长喂给 updatePlayer ⇒ 人也冻)');
const ctx=boot(0);
const err=VM(ctx,`(()=>{try{ SPAWN_PROT=0; document.getElementById('startBtn').onclick(); }catch(e){ return String(e&&e.message||e); } return null; })()`);
ok(!err,'T7c 开局 (真路径 startBtn.onclick) '+(err||'ok'));
const r=VM(ctx,`(()=>{try{
player.team=0; player.cls=3; player.spectator=true; player.specUsed=true; selectedSpawn=-1;
deployPlayer();
pointerLocked=true; player.flying=false; player.flyAero=false;
const cx=player.pos.x, cz=player.pos.z, cy=player.pos.y;
__key('KeyK');                                   // 时停开着
if(!specTimeFrozen()) return {noFreeze:true};
const world=specTimeConsume(0.016);              // 世界帧长 (0)
const pdt=specTimePlayerDt(0.016,world);         // 24-main 喂给 updatePlayer 的帧长
// 试验场: 找一块**净空平地**再测位移 —— 出生点可能贴着基地墙体/水边, 那样"走了 0.2m 就撞墙", 断言会偶发
// (本探针只判"人能不能动", 不该被地形噪声左右)。判据与 A1 的走廊扫描同法: 8 向各 8m 无静态遮挡 + 干地 + 缓坡。
const clear=(x,z)=>{ const y=heightAt(x,z)+1.05;
for(let a=0;a<8;a++){ const d=a*Math.PI/4;
const w=raycastWorld(V3(x,y,z),V3(Math.sin(d),0,Math.cos(d)),8);
if(w&&w.dist<7.5) return false; }
return true; };
const flat=(x,z)=>{ const h0=heightAt(x,z);
for(const [dx,dz] of [[3,0],[-3,0],[0,3],[0,-3]]) if(Math.abs(heightAt(x+dx,z+dz)-h0)>1.6) return false;
return waterDepthAt(x,z)<=0.2&&!inRiverChannel(x,z); };
let SP=null;
for(let r0=14;r0<=MAP_SIZE*0.35&&!SP;r0+=9) for(let a=0;a<8&&!SP;a++){
const x=Math.cos(a*Math.PI/4)*r0, z=Math.sin(a*Math.PI/4)*r0;
if(clear(x,z)&&flat(x,z)) SP={x,z,y:heightAt(x,z)};
}
if(!SP) return {noSpot:true};
const place=()=>{ player.pos.set(SP.x,SP.y,SP.z); player.vel.set(0,0,0); player.onGround=true;
player.pitch=0; player.yaw=0; player.swim=false; player.wading=false; player._wStatePrev='dry'; };
keys.KeyW=true;
place();
const ax=player.pos.x, az=player.pos.z;
for(let i=0;i<24;i++) updatePlayer(pdt);         // ① 相机/本体链按 pdt 推进
const move=+Math.hypot(player.pos.x-ax,player.pos.z-az).toFixed(2);
// ② 阴性对照: 照旧喂世界帧长 (0) ⇒ 原地不动 (这条就是用户看到的旧行为)
place();
for(let i=0;i<24;i++) updatePlayer(world);
const move0=+Math.hypot(player.pos.x-ax,player.pos.z-az).toFixed(3);
// ③ 悬停飞行 (观战者最常用的移动方式) 同样不吃时停
player.flying=true; player.flyAero=false; player.pos.y=SP.y+7; player._flyT=0.4;
const bx=player.pos.x, bz=player.pos.z;
for(let i=0;i<24;i++) updatePlayer(pdt);
const fly=+Math.hypot(player.pos.x-bx,player.pos.z-bz).toFixed(2);
keys.KeyW=false; player.flying=false; player.vel.set(0,0,0);
specTimeReset(); player.pos.set(cx,cy,cz);
return {noFreeze:false,noSpot:false,spot:[+SP.x.toFixed(1),+SP.z.toFixed(1)],world,pdt,move,move0,fly};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof r==='string'){ exc('T7c',r); return; }
if(r.noFreeze){ ok(false,'T7c 前置: 观战者 + K ⇒ 时停生效 (取到样本)'); return; }
if(r.noSpot){ ok(false,'T7c 前置: 图上找到一块净空平地 (取到样本)'); return; }
ok(r.world===0&&Math.abs(r.pdt-0.016)<1e-9,'T7c 前置: 时停中世界帧长 0 而本体帧长 0.016 (24-main 现在的两支); 试验场 '+r.spot);
ok(r.move>0.5,'T7c ★ 时停 + 按 W: 观战者照常走动 (24 帧走了 '+r.move+'m)');
ok(r.move0<0.01,'T7c ★ 阴性对照: 照旧把世界帧长(0)喂给 updatePlayer 时人不动 ('+r.move0+'m — 这正是用户报的旧行为, 两条判据互为对照)');
ok(r.fly>0.5,'T7c ★ 悬停飞行同样不受时停影响 (24 帧飞了 '+r.fly+'m; 时停是"冻战场", 不是"冻观察者")');
}

// ═════ T8 B8 观战者入水按漂浮处理 ═════
function t8(){
console.log('T8 ★B8 观战者入水: 走既有游泳态漂浮 (旧版沉底"行走")');
const ctx=boot(11);   // 塔拉瓦: 有深水海域
const err=VM(ctx,`(()=>{try{ SPAWN_PROT=0; document.getElementById('startBtn').onclick(); }catch(e){ return String(e&&e.message||e); } return null; })()`);
ok(!err,'T8 开局 (真路径 startBtn.onclick) '+(err||'ok'));
const r=VM(ctx,`(()=>{try{
let WP=null,bestD=-1e9;
const LIM=MAP_SIZE/2-4;   // 塔拉瓦 mapSize=640: 外海在岛外 (写死 ±170 根本扫不到深水, 曾让本用例空判)
for(let x=-LIM;x<=LIM;x+=8) for(let z=-LIM;z<=LIM;z+=8){
const dpa=waterDepthAt(x,z);
if(waterYAt(x,z)>-1e8&&dpa>bestD){ bestD=dpa; WP={x,z}; }
}
if(!WP||bestD<SWIM_DEPTH+0.6) return {noWater:true,maxDepth:+bestD.toFixed(2)};
const maxDepth=+bestD.toFixed(2);
player.team=0; player.cls=3; player.spectator=true; player.specUsed=true;
player.alive=true; player.deployed=true;
player.pos.set(WP.x,waterYAt(WP.x,WP.z)-1.2,WP.z);
player.vel.set(0,0,0); player.flying=false; player.diveD=0;
const wy=waterYAt(WP.x,WP.z), bed=heightAt(WP.x,WP.z,true);
for(let i=0;i<120;i++) updatePlayer(1/60);
const specState={swim:player.swim===true,y:+player.pos.y.toFixed(2),headDepth:+(player.headDepth||0).toFixed(2),diveD:+(player.diveD||0).toFixed(2)};
// 阴性对照 (同点普通玩家): 两者在水里必须同姿态 (口径统一)
player.spectator=false;
player.pos.set(WP.x,waterYAt(WP.x,WP.z)-1.2,WP.z); player.vel.set(0,0,0); player.diveD=0;
for(let i=0;i<120;i++) updatePlayer(1/60);
const normState={swim:player.swim===true,y:+player.pos.y.toFixed(2)};
return {noWater:false,maxDepth,wy:+wy.toFixed(2),bed:+bed.toFixed(2),fp:FLOAT_PAD,specState,normState};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof r==='string'){ exc('T8',r); return; }
if(r.noWater){ ok(false,'T8 塔拉瓦图上找得到深水点 (取到样本; 全场最深='+r.maxDepth+'m)'); return; }
const target=r.wy-r.fp;
ok(r.specState.swim===true,'T8 ★ 观战者在深水里进入游泳态 (旧版被排除在 swimming 之外; 取样点深 '+r.maxDepth+'m)');
ok(Math.abs(r.specState.y-target)<0.9&&r.specState.y>r.bed+0.5,
'T8 ★ 观战者浮在水面附近而非沉底 (y='+r.specState.y+' 目标 '+target.toFixed(2)+' 海床 '+r.bed+')');
ok(r.specState.headDepth<0.35,
'T8 漂浮时头部基本在水面上 (headDepth '+r.specState.headDepth+'m < 0.35; 浪高±0.15m 与就近水面的采样差都在这个容差里 —— 判据意图是"浮在水面", 不是一个浮点都不许动)');
ok(r.normState.swim===true&&Math.abs(r.normState.y-target)<0.9,
'T8 阴性对照: 同点普通玩家同姿态漂浮 (y='+r.normState.y+', 观战者与普通玩家在水里同一套物理)');
}

// ═════ T9 C2 T/Y 观战闸门 (真键位链) ═════
function t9(){
console.log('T9 ★C2 小队指令: 观战者的 T/Y 不再指挥 Bot (非观战照常)');
const ctx=boot(0);
const err=VM(ctx,`(()=>{try{ SPAWN_PROT=0; document.getElementById('startBtn').onclick(); }catch(e){ return String(e&&e.message||e); } return null; })()`);
ok(!err,'T9 开局 (真路径 startBtn.onclick) '+(err||'ok'));
const r=VM(ctx,`(()=>{try{
player.team=0; player.cls=3; player.spectator=false; player.specUsed=false; selectedSpawn=-1;
deployPlayer();
pointerLocked=true;
const sp=document.getElementById('scorePop');
const members=SQUAD.members.length;
// ① 观战态: T/Y 都不改小队模式, 且给出明确提示
player.spectator=true;
SQUAD.mode='move'; sp.textContent='';
__key('KeyT'); const tSpec=SQUAD.mode, popT=String(sp.textContent);
__key('KeyY'); const ySpec=SQUAD.mode, popY=String(sp.textContent);
// ② 阴性对照: 取消观战 → 同一个键真的改小队模式 (功能没被整体砍掉)
player.spectator=false;
SQUAD.mode='idle'; __key('KeyY'); const yNorm=SQUAD.mode;
SQUAD.mode='idle'; __key('KeyT'); const tNorm=SQUAD.mode;
return {members,tSpec,popT,ySpec,popY,yNorm,tNorm};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof r==='string'){ exc('T9',r); return; }
ok(r.members>0,'T9 前置: 玩家小队有队员 ('+r.members+' 人)');
ok(r.tSpec==='move'&&r.ySpec==='move'&&r.popT.indexOf('不指挥小队')>=0&&r.popY.indexOf('不指挥小队')>=0,
'T9 ★ 观战态: T/Y 均不改变小队模式 ('+r.tSpec+'/'+r.ySpec+') 且提示「观战模式 · 不指挥小队」');
ok(r.yNorm==='follow'&&r.tNorm==='move','T9 阴性对照: 非观战者按 Y/T 照常下达跟随/进攻指令 ('+r.yNorm+'/'+r.tNorm+')');
}

// ═════ T10 静态接线: i18n 词条 / 版本戳 / 索敌-伤害入口覆盖 / 时停单源 ═════
function t10(){
console.log('T10 静态接线: 观战文案 EN 词条 / 版本戳 / specRide 入口全覆盖 / 时停三件套');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const i18n=read('js/00b-i18n.js'), idx=read('index.html'), inp=read('js/19-input.js'),
main=read('js/24-main.js'), hud=read('js/22-hud.js'), ray=read('js/13-combat.js'),
sp2=read('js/22b-speclayer.js'), nvl=read('js/15d-naval.js'), dep=read('js/23-deploy.js');
// ① D1: 观战运行文案 9 条 (审计漏网名单) + 本批新增文案, 一条不缺
//   2026-09-27I: 时间控制的 3 条旧词条随"只留时停"一起换掉 (旧键已删, 新键必须齐)
const need=['创造悬停飞行 · WASD移动 空格升/Shift降 · 落地退出','切换: 创造悬停 (空格升/Shift降)','飞行关闭',
'气动飞行 · 沿视线前飞 · 空格加速 · 俯冲触地落地','幽灵坦克已就位 · 观战专属载具','落地 · 行走状态',
'座驾被毁 · 观战者安全脱离','观战模式 · 不指挥小队','观战信息层: 开','观战信息层: 关',
'观战时停: 开 (K 继续 · 你本人仍可走动/飞行)','观战时停: 关',' (观战不可征用)',
'调试模式将于下次部署生效','开启调试模式？本局将: 免伤 · 不被索敌 · 弹药无限 · 副武器换观战连狙, 且可对双方开火。注意: 下一次部署才生效; 生效(以调试观战身份进入战场)后本局不计入历史记录 —— 只点开开关又取消的不算。'];
// ★2026-09-27 判据随文案收窄同步更新: 确认框文案按"判据收窄"改写 (只点开开关又取消 ⇒ 不算观战局),
//   中文原文即键 ⇒ 这里必须与 22-hud 的 t('...') 一字不差, 否则 EN 界面会闪中文 (本条的靶子)。
// ★2026-11-01 判据跟走 (观战更名批): 旧「观战模式」系文案整体更名「调试模式」(用户裁定: 能干涉战局才不计历史;
//   新"自由观战"另有文案), 本清单尾部两条 + D1 键随 22-hud:2613/2637/2638 走新串。
const miss=need.filter(k=>i18n.indexOf("'"+k+"'")<0);
ok(miss.length===0,'T10 ★ 观战运行文案全部有 EN 词条 ('+need.length+' 条齐全)'+(miss.length?(' 缺: '+miss.join(' | ')):''));
ok(i18n.indexOf("'调试模式已关闭':'Debug mode off'")>=0,'T10 ★ D1 漏网名单里的「调试模式已关闭」已补 (EN 界面不再闪中文)');
const dead=['观战时间: ×{0}','观战时间: 单步 {0} 帧','观战时间: 暂停 (K 继续 · L 单步)','慢放','单步'];
const alive=dead.filter(k=>k.indexOf('慢放')<0&&k.indexOf('单步')<0);
const deadLeft=alive.filter(k=>i18n.indexOf("'"+k+"'")>=0);
ok(deadLeft.length===0&&i18n.indexOf('slow motion')<0&&i18n.indexOf('single step')<0,
'T10 ★ 慢放/单步的旧词条已从词典与英文侧一并删除'+(deadLeft.length?(' 残留: '+deadLeft.join(' | ')):''));
// ② 脚本链/版本戳
ok(idx.indexOf('js/22b-speclayer.js')>=0,'T10 index.html 已引入 js/22b-speclayer.js');
const vers=(idx.match(/\?v=([0-9a-z]+)/g)||[]).map(s=>s.slice(3));
ok(vers.length>30&&vers.every(v=>v===vers[0])&&idx.indexOf("__sfStyleVer='"+vers[0]+"'")>=0,
'T10 版本戳统一且与 __sfStyleVer 一致 ('+vers[0]+', '+vers.length+' 处)');
// ③ 接线 (2026-09-27M: updatePlayer 多收一个"世界帧长"实参 —— 海战音频逐艇判定该跟谁; 本体链仍是 pdt)
ok(main.indexOf('specTimeConsume(rdt)')>=0&&main.indexOf('updatePlayer(pdt,dt)')>=0&&main.indexOf('updateSpecLayer(pdt)')>=0,
'T10 24-main: 世界走 specTimeConsume(rdt) 而本体链走 pdt (第二实参 = 世界帧长, 供海战音频逐艇取帧长)');
ok(main.indexOf('updateNaval(dt,pdt)')>=0&&(main.match(/vdt\(/g)||[]).length>=3,
'T10 24-main: 载具循环/幽灵坦克/战机一律经 vdt 逐台判座驾 ('+((main.match(/vdt\(/g)||[]).length)+' 处)');
// 注释剥离器: 本轮有几条断言查的是"某段**代码**不在了", 而注释里正解释着"旧写法长什么样" ——
// 先剥 `//` 行注释再查, 否则断言会被自己的注释绊倒 (也不写死行号: 判据只看代码形态)。
// ★2026-10-01: [^\n]* 而非 .*$ —— 仓库脚本是 CRLF, `.` 跨不过 \r ⇒ 旧写法的 `^\s*//.*$` 整体失配,
//   注释根本没被剥掉 (阴性断言假红 / 正向断言被注释喂成假绿)。
const strip=(s)=>s.split('\n').map(l=>l.replace(/^\s*\/\/[^\n]*/,'')).join('\n');
const nvlC=strip(nvl);
ok(nvlC.indexOf('dt=1/60')<0&&/function updateNaval\(dt,pdt\)/.test(nvlC)&&nvlC.indexOf('specRide(n)')>=0,
'T10 ★ 15d-naval: "dt=0 就补 1/60"的兜底已删, 时停对海战生效, 座驾走第二实参 specRide 单源');
ok(sp2.indexOf('SPEC_TIME_SCALES')<0&&sp2.indexOf('specTimeStep')<0&&sp2.indexOf('function specTimePlayerDt(')>=0&&sp2.indexOf('function specTimeRideDt(')>=0,
'T10 ★ 22b-speclayer: 档位表/单步已删, 只留 paused + PlayerDt/RideDt 两个出口');
ok(inp.indexOf("e.code==='KeyJ'")>=0&&inp.indexOf("e.code==='KeyK'")>=0&&inp.indexOf("e.code==='Comma'")<0
&&inp.indexOf("e.code==='Period'")<0&&(inp.match(/e\.code==='KeyL'/g)||[]).length===1&&inp.indexOf('vehHeadlightToggle')>0,'T10 ★ 19-input: 只留 J/K 两个观战工具键 (慢放/单步键位已摘; e.code KeyL 唯一出现=2026-10-05 昼夜批大灯键, 非观战工具)');
ok(dep.indexOf('const specBlocked=!!player.spectator;')>=0&&dep.indexOf("v.kind==='tank'||v.kind==='plane'")<0&&dep.indexOf("if(p.spectator&&typeof selectedSpawn==='string'&&selectedSpawn[0]==='V') selectedSpawn=-1;")>=0,
'T10 ★ 23-deploy: 观战闸门覆盖**全部**真载具 (旧版只挡 tank/plane), 结构闸门同步');
ok(ray.indexOf('||s.spectator) continue')>=0&&ray.indexOf('function specRide(')>=0,'T10 13-combat: raySoldiers 跳过观战者 + specRide 判据单源');
const sites=[['js/15-vehicles.js',4],['js/16-aircraft.js',3],['js/15d-naval.js',2],['js/15f-battery.js',1]];
const bad=[];
for(const [f,n] of sites){ const src=read(f); const c=(src.match(/specRide\(/g)||[]).length; if(c<n) bad.push(f.split('/')[1]+' 期望≥'+n+' 实为'+c); }
ok(bad.length===0,'T10 ★ specRide 索敌/伤害入口全覆盖 (坦克4/战机3/舰艇2/岸炮1 处)'+(bad.length?(' 不足: '+bad.join(', ')):''));
ok(hud.indexOf('player.specWant')>=0&&hud.indexOf('specTimeReset')>=0&&hud.indexOf('specLayerPurge')>=0,'T10 22-hud: 观战意图/时停/信息层随换局复位');
}

// ── 主流程 ──
t1(); t2(); t3(); t4(); t5(); t6(); t7(); t7b(); t7c(); t8(); t9(); t10();
console.log('\n通过 '+PASS.length+' 项, 失败 '+FAILS+' 项');
process.exit(FAILS?1:0);
