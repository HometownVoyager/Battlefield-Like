// ─────────────────────────────────────────────
// dev/verify-specthird.js —— 观战连狙双方火力 + 步行第三人称 沙箱实测 (2026-09-20, 不进 Index.html)
// 用法: node dev/verify-specthird.js [--browser]      (缺省只跑 Node 沙箱; --browser 追加无头 Edge 菜单段)
// 原理: 复用 verify-spec.js 的桩 (THREE/DOM/WebAudio), 按真实顺序加载 js/00~24 全部脚本并进入战场,
//       用**真实函数**驱动命中管线与相机, 逐条断言验收口径:
//   T1 观战者持观战连狙打友方步兵 → 掉血 (★ 用户口径 3: 只有观战连狙可打双方)
//   T2 同一观战者持普通步枪打友方 → 不掉血 (阴性对照: 标记必须只跟"手上这把枪"走)
//   T3 幽灵坦克主炮行为与改动前一致 (ffAll 语义未被动过: team=-1 双面伤害 + 友军载具也是合法目标)
//   T4 换枪/下车/死亡/换局后 ffSpecSniper 必须复位 (不留"打过一枪就能一直打友军"的窗口)
//   T5 步行第三人称: thirdPerson=true 后 camera.position 距 player.pos > 1.5m 且在角色背后 (含换朝向)
//   T6 第三人称开火: 弹道起点=角色眼位(不是相机), 方向=眼位→准星命中点; 端到端"准星指着友军开一枪必中"
//   T7 互斥/接线: 开镜(ADS)自动回第一人称 + 载具/巡飞弹/跳伞/游泳不接管 + 键位 U 与 HUD 提示接线
//   T8 静态接线: index.html 版本戳统一 / 未改禁改文件清单之外的行为 (读文件断言)
// 注: 桩的 camera.getWorldDirection 恒返回 (0,0,-1), 与第三人称相机用 p.yaw/p.pitch 解析式算出的 fwd 在
//     yaw=pitch=0 时一致 —— 本脚本的第三人称用例统一在这一朝向下取证, 与真机 (camera.rotation=YXZ(pitch,yaw)) 同构。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
// ── 通用小桩 (与 verify-spec.js 同源) ──
const mk2d=()=>new Proxy({}, { get(t,k){
if(k==='canvas') return {width:64,height:64};
if(typeof k==='symbol') return undefined;
if(!(k in t)) t[k]=(...a)=>mk2d();
return t[k];
}, set(t,k,v){ t[k]=v; return true; } });
const mkElement=(tag)=>{
// classList 用真集合 (与 verify-menucam 同源), className 由它派生 —— 2026-09-20 第6条起 #ui 的隐藏判据走
// body.classList (inMenu/inDeploy), 而 24-main 末尾的 HUD 自检会读 "#ui 节点数" 与 body.className:
// 桩里给真实现 + 真节点, 那次自检就不会把"沙箱没有 DOM"误报成控制台警告 (Lead 反馈的 stderr 噪声)。
const cls={_s:new Set(),
add(c){this._s.add(c);},remove(c){this._s.delete(c);},
toggle(c,on){ if(on===undefined){ this._s.has(c)?this._s.delete(c):this._s.add(c); } else if(on) this._s.add(c); else this._s.delete(c); },
contains(c){return this._s.has(c);}};
const el={tagName:(tag||'div').toUpperCase(),style:{},classList:cls,
textContent:'',innerHTML:'',value:'',dataset:{},disabled:false,
children:[],appendChild(c){this.children.push(c);c.parent=this;return c;},prepend(c){this.children.unshift(c);c.parent=this;return c;},
remove(){ if(this.parent){ const i=this.parent.children.indexOf(this); if(i>=0) this.parent.children.splice(i,1); } },addEventListener(){},removeEventListener(){},focus(){},
getContext:()=>mk2d(),width:0,height:0,
setAttribute(){},querySelector:()=>mkElement(),querySelectorAll:()=>[],
};
Object.defineProperty(el,'className',{get(){ return Array.from(cls._s).join(' '); },set(v){ cls._s=new Set(String(v).split(/\s+/).filter(Boolean)); }});
Object.defineProperty(el,'firstChild',{get(){ if(!el._fc) el._fc=Object.assign(mkElement('div'),{textContent:''}); return el._fc; }});
Object.defineProperty(el,'lastChild',{get(){ return el.children.length?el.children[el.children.length-1]:el.firstChild; }});
el.removeChild=c=>{ const i=el.children.indexOf(c); if(i>=0) el.children.splice(i,1); return c; };
return el;
};
const byId={};
// 桩里没有 HTML 解析: 按 index.html 的初始类手工建关键节点 ——
//   #ui          真实存在 (否则 24-main 的 "#ui 节点数!==1" 自检每次都会补挂 inMenu 并打一行警告)
//   .screen      #menu 可见; #deploy/#end/#pauseOv 带 hidden (syncDeployHud 的对账判据就是 #deploy 的 hidden)
const SCREEN_IDS=['menu','deploy','end','pauseOv'];
const document={
createElement:t=>t==='canvas'?Object.assign(mkElement('canvas'),{width:0,height:0}):mkElement(t),
createElementNS:()=>mkElement('canvas'),
getElementById:id=>{ if(!byId[id]){ byId[id]=mkElement(); byId[id].id=id;
if(id!=='menu'&&SCREEN_IDS.indexOf(id)>=0) byId[id].classList.add('hidden'); // 首帧: 只有主菜单可见
}
return byId[id]; },
querySelector:sel=>{ if(sel==='canvas') return Object.assign(mkElement('canvas'),{width:0,height:0}); return mkElement(); },
querySelectorAll:sel=>{
if(sel==='#ui') return [document.getElementById('ui')];
if(sel==='.screen') return SCREEN_IDS.map(id=>document.getElementById(id));
return [];
},
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
cross(v){const x=this.y*v.z-this.z*v.y,y=this.z*v.x-this.x*v.z,z=this.x*v.y-this.y*v.x;this.x=x;this.y=y;this.z=z;return this;}negate(){this.x=-this.x;this.y=-this.y;this.z=-this.z;return this;}
applyAxisAngle(){return this;}setFromMatrixColumn(){return this;}lerpVectors(){return this;}
addScalar(s){this.x+=s;this.y+=s;this.z+=s;return this;}divideScalar(s){s=s||1;this.x/=s;this.y/=s;this.z/=s;return this;}distanceToSquared(v){return (this.x-v.x)**2+(this.y-v.y)**2+(this.z-v.z)**2;}setLength(l){return this.normalize().multiplyScalar(l);}}
class Euler{constructor(){this.x=0;this.y=0;this.z=0;this.order='XYZ';}set(x,y,z,o){this.x=x;this.y=y;this.z=z;if(o)this.order=o;return this;}}
class Obj3{constructor(){this.position=new V3();this.rotation=new Euler();this.scale=new V3(1,1,1);this.quaternion={setFromUnitVectors(){return this;}};this.children=[];this.visible=true;this.castShadow=false;this.receiveShadow=false;this.renderOrder=0;this.matrix={};this.userData={};this.material=null;this.geometry=null;}
add(m){this.children.push(m);m.parent=this;return this;}remove(m){const i=this.children.indexOf(m);if(i>=0)this.children.splice(i,1);}
clear(){this.children.length=0;return this;}
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
const _mat=cls=>{ return class extends cls{constructor(o){super();Object.assign(this,o||{});this.color=_wrapColor(this.color);}dispose(){}clone(){return new this.constructor(this);}}; };
class _Fog{constructor(c,n,f){this.color=new _Color(c);this.near=n;this.far=f;}}
class _FogExp2{constructor(c,d){this.color=new _Color(c);this.density=d;}}
const THREE={
WebGLRenderer:class{constructor(){this.domElement=Object.assign(mkElement('canvas'),{width:0,height:0});this.shadowMap={enabled:false,type:0,autoUpdate:true};this.setSize=()=>{};this.setPixelRatio=()=>{};this.render=()=>{};this.clear=()=>{};this.clearDepth=()=>{};this.outputColorSpace='';this.setClearColor=()=>{};this.setAnimationLoop=()=>{};this.domElement.addEventListener=()=>{};this.domElement.style={};}},
Scene:class extends Obj3{constructor(){super();this.background=null;this.fog=null;}},
PerspectiveCamera:class extends Obj3{constructor(){super();this.fov=74;this.near=0.1;this.far=1000;this.aspect=1;}updateProjectionMatrix(){}getWorldDirection(v){v.set(0,0,-1);return v;}},
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
function load(ctx,file){ vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file}); }
const FILES=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/23-deploy.js','js/24-main.js'];
// pinRandom=true: 让 rand(a,b) 恒取区间中点 (Math.random=0.5) ⇒ 弹道散布/后坐抖动全部归零, 断言可复现。
// 用 Object.create(Math) 的浅层代理, 只在沙箱内影子化 random, 不影响宿主脚本自己的 Math。
function boot(campIdx,pinRandom){
for(const k in byId)delete byId[k];
const ctx=vm.createContext(Object.assign({},sandbox));
if(pinRandom){ const M=Object.create(Math); M.random=()=>0.5; ctx.Math=M; }
ctx.document=document;ctx.window=window;
ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of FILES) load(ctx,f);
return ctx;
}
// ── 断言收集 ──
const PASS=[];let FAILS=0;
function ok(cond,label){
if(cond){ PASS.push(label); console.log('  ✔ '+label); }
else { FAILS++; console.log('  ✘ '+label); }
}
function exc(tag,e){ ok(false,tag+' 推演异常: '+String(e&&e.stack||e)); }
const START=`document.getElementById('startBtn').onclick();`;

// 把玩家布成"观战 + 已部署 + 站在空地 + 面朝 -Z"的夹具 (沙箱桩的 camForward 恒为 (0,0,-1))
// cls: 兵种 (3=反坦克兵: 主武器是火箭; 0=步枪兵: 主武器是普通子弹步枪 —— T2 的阴性对照要用能走 fireBullet 的枪)
const fixture=(cls)=>`
${START}
player.spectator=true; player.specUsed=true; player.alive=true; player.deployed=true; player.team=0; player.cls=${cls};
selectedSpawn=-1; deployPlayer();
player.pos.set(-140,0,-140); player.pos.y=heightAt(-140,-140);
player.yaw=0; player.pitch=0; player.vel.set(0,0,0);
player.ads=false; player.crouch=false; player.prone=false; player.onGround=true; player.bloom=0;
VM.state='idle'; VM.root.visible=true;
`;
const FIXTURE=fixture(3);
// 取一名**友方** Bot 摆到 (x,z) 并清空交战状态 (观战者打友军 = 本批核心口径)。
// y 取"躯干正中正好落在玩家眼位高度"的悬空摆设: 排除地形高差造成的擦头而过, 同时避开爆头
// (观战连狙爆头 75×2.5=187.5 一枪必死, 那样就验不出"掉血且活着")。
const putAlly=(x,z)=>`
{ const a=combatants.filter(s=>s!==player&&s.alive&&s.team===0)[0];
a.alive=true; a.hp=100; a.onVehicle=null; a.crouch=false; a.prone=false;
a.pos.set(${x},0,${z}); a.pos.y=player.pos.y+(player.eyeH||1.62)-1.0;
__t=a; }
`;
// 记录一次真实开火: 包住 fireBullet 抓 (origin,dir) —— 调用方自行决定调哪个槽位的武器

// ═════ T1 观战连狙: 打友方步兵 → 掉血 ═════
function t1(){
console.log('T1 观战者持观战连狙打友方步兵 → 目标掉血');
const ctx=boot(0,true);
const r=vm.runInContext(`(()=>{try{
${FIXTURE}
updateCamera(0.016);                                  // ★ 把相机摆到角色眼位 (夹具后相机还在"开局航拍"位, 不摆位等于从 200m 外开枪)
player.curSlot=1; player.curW=player.slots[1]; VM.key=player.curW.key;
${putAlly(-140,-150)}
const putSnap={x:__t.pos.x,y:__t.pos.y,z:__t.pos.z,py:player.pos.y,team:__t.team,isPlayer:!!__t.isPlayer};
const before={hp:__t.hp,alive:__t.alive};
let cap=null;
const _fb=fireBullet;
fireBullet=function(sh,o,d,def){ cap={x:o.x,y:o.y,z:o.z,dx:d.x,dy:d.y,dz:d.z,shooter:sh===player,spec:player.ffSpecSniper}; return _fb.apply(this,arguments); };
playerShoot(player.curW);
fireBullet=_fb;
// 诊断: 同一条弹道单独复算一遍"谁被判定命中 / 世界几何在多远拦下 / 水面拦截距离", 便于失败时定位
const dirV=V3(cap.dx,cap.dy,cap.dz), orgV=V3(cap.x,cap.y,cap.z);
const sr=raySoldiers(orgV,dirV,400,player);
const wr=raycastWorld(orgV,dirV,400);
const uw=waterEntryDist(orgV,dirV,400);
return {weapon:player.curW.key,before,after:{hp:Math.round(__t.hp),alive:__t.alive},
markerBefore:cap&&cap.spec,cap,eyeY:player.pos.y+player.eyeH,putSnap,
diag:{srHit:sr?(sr.sol===__t?'__t':'other'):null,srT:sr?+sr.t.toFixed(2):null,head:sr?!!sr.head:null,
wall:wr?+wr.dist.toFixed(2):null,uw:uw===Infinity?null:+uw.toFixed(2),
ptr:Math.round(__t.pos.y),pty:Math.round(orgV.y),dxz:+Math.hypot(__t.pos.x-orgV.x,__t.pos.z-orgV.z).toFixed(2)}};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`,ctx);
if(typeof r==='string'){ exc('T1',r); return; }
console.log('     · 武器='+r.weapon+' 开火前 hp='+r.before.hp+' → 开火后 hp='+r.after.hp
+' / 无差别标记='+r.markerBefore+' / 弹道起点 y='+(r.cap?r.cap.y.toFixed(2):'—'));
console.log('     · 弹道诊断: 命中='+JSON.stringify(r.diag.srHit)+' t='+r.diag.srT+' 头='+r.diag.head
+' 墙='+r.diag.wall+' 水面='+r.diag.uw+' 目标距起点 '+r.diag.dxz+'m 起点y='+r.diag.pty+' 目标脚y='+r.diag.ptr);
console.log('     · 目标摆放: '+JSON.stringify(r.putSnap));
ok(r.weapon==='specsniper','T1 前置: 观战者 2 号槽 = 观战连狙 (playerClassWeapons/deployPlayer 单源)');
ok(r.cap&&r.cap.shooter===true,'T1 前置: 这一枪确实由玩家(shooter===player)打出');
ok(r.markerBefore===true,'T1 开火瞬间 ffSpecSniper=true (由开火武器 key 落定)');
ok(r.after.hp<r.before.hp&&r.after.alive===true,'T1 ★ 友方步兵掉血且仍活着: 100 → '+r.after.hp+' (旧口径 100 → 100, 一枪不掉血)');
}
// ═════ T2 (2026-11-09 中立批改写): 同一观战者持普通步枪打友方 → 掉血 ═════
function t2(){
console.log('T2 观战者本尊普通步枪(主武器)打友方 → 掉血 (2026-11-09 中立批: 观战武器全中立)');
const ctx=boot(0,true);
const r=vm.runInContext(`(()=>{try{
${fixture(0)}
updateCamera(0.016);                                  // ★ 相机摆到角色眼位 (与 T1 同理)
player.curSlot=0; player.curW=player.slots[0]; VM.key=player.curW.key;
${putAlly(-140,-150)}
const before=__t.hp;
let cap=null;
const _fb=fireBullet;
fireBullet=function(sh,o,d,def){ cap={shooter:sh===player,spec:player.ffSpecSniper,def:def&&def.name}; return _fb.apply(this,arguments); };
playerShoot(player.curW);
fireBullet=_fb;
const after=__t.hp;
// 反向核对: 打完普通步枪后立刻换回连狙, 标记必须重新为 true 且能打伤友军 (判据跟武器走, 不是一次性开关)
player.curW=player.slots[1]; player.curSlot=1;
const _fb2=fireBullet;
fireBullet=function(){ return _fb2.apply(this,arguments); };
playerShoot(player.curW);
fireBullet=_fb2;
const allyHp2=__t.hp;
return {weapon:player.slots[0].key,before,after,marker:cap&&cap.spec,benign:cap&&cap.def,allyHp2};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`,ctx);
if(typeof r==='string'){ exc('T2',r); return; }
console.log('     · 主武器='+r.weapon+' ('+r.benign+') 开火前 hp='+r.before+' → 开火后 hp='+r.after+' / 标记='+r.marker);
ok(r.weapon!=='specsniper','T2 前置: 0 号槽是普通主武器 ('+r.weapon+')');
ok(r.marker===false,'T2 ★ 非连狙武器: ffSpecSniper=false (旗级语义未动; 无差别由 coFfFire 的 spectator 门放开)');
ok(r.after<r.before,'T2 ★ 观战者本尊普通步枪也伤友军 (2026-11-09 裁定: 100 → '+r.after+')');
ok(r.allyHp2<r.after,'T2 再换回连狙立刻恢复无差别火力 (标记跟随手持武器, 不是一次性开关)');
}
// ═════ T3 幽灵坦克主炮: 行为与改动前一致 ═════
function t3(){
console.log('T3 回归: 幽灵坦克主炮行为与改动前一致 (ffAll 语义未被动过)');
const ctx=boot(0,true);
const r=vm.runInContext(`(()=>{try{
${FIXTURE}
const g=specVehEnsureAtBase();
specVehBoard(g);
const bound=player.onVehicle===g, ffAll=player.ffAll===true, specMarker=player.ffSpecSniper===true;
// ① 主炮炮弹仍走 team=-1 无差别口径
g.cannonCd=0; const n0=shells.length; g.fireCannon();
const sh=shells[shells.length-1];
const shell={team:sh.team,owner:sh.owner===player,dmg:sh.dmgV,added:shells.length-n0};
// ② 同轴机枪仍能打友方步兵 (靠 ffAll, 不靠 ffSpecSniper)
const ally=combatants.filter(s=>s!==player&&s.alive&&s.team===0)[0];
ally.alive=true; ally.hp=100; ally.onVehicle=null; ally.crouch=false; ally.prone=false;
ally.pos.set(-140,0,-150); ally.pos.y=heightAt(-140,-150);
g.aimDir&&g.aimDir();                      // 不抛异常
// 直接以"幽灵坦克驾驶者"身份走步兵命中管线 (同轴机枪的 shooter 就是 player):
// 射线从友军正前方 5m 指向他, 高度取躯干中部 (与地图无关的稳健几何)
const mgOrigin=V3(ally.pos.x,ally.pos.y+1.0,ally.pos.z+5);
const sr=raySoldiers(mgOrigin,V3(0,0,-1),60,player);
const mgHit=!!sr&&sr.sol===ally;
// ③ 非观战普通玩家 (关观战+无标记) 打友军仍被过滤 —— 2026-11-09 中立批后 spectator 门才是判据
player.ffAll=false; player.ffSpecSniper=false; player.spectator=false;
const sr2=raySoldiers(mgOrigin,V3(0,0,-1),60,player);
const plainFiltered=!sr2||sr2.sol!==ally;
return {bound,ffAll,specMarker,shell,mgHit,plainFiltered,gTeam:g.team,hp:Math.round(ally.hp)};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`,ctx);
if(typeof r==='string'){ exc('T3',r); return; }
console.log('     · 上车=' +r.bound+' ffAll='+r.ffAll+' ffSpecSniper='+r.specMarker
+' / 主炮 team='+r.shell.team+' dmg='+r.shell.dmg+' / 同轴机枪命中友军='+r.mgHit+' (旧行为)');
ok(r.bound===true&&r.ffAll===true,'T3 前置: 上车仍置 ffAll (15c-specveh 未被本批改动)');
ok(r.specMarker===false,'T3 ★ 上幽灵坦克不会顺带点亮 ffSpecSniper (两个标记互不干扰)');
ok(r.shell.team===-1&&r.shell.owner===true&&r.shell.dmg===520&&r.shell.added===1,'T3 主炮炮弹 team=-1 / owner=玩家 / 单发 520 (与改动前一致)');
ok(r.mgHit===true,'T3 同轴机枪打友方步兵仍生效 —— 走的是 ffAll, 不是本批新增的连狙标记');
ok(r.plainFiltered===true,'T3 阴性对照: 非观战普通玩家(关观战+无标记)打友军仍被敌我过滤挡住 (spectator 门没写死)');
}
// ═════ T4 标记复位: 换枪/下车/死亡/换局 ═════
function t4(){
console.log('T4 标记生命周期: 换枪 / 死亡 / 换局后 ffSpecSniper 必须复位');
const ctx=boot(0,true);
const r=vm.runInContext(`(()=>{try{
${FIXTURE}
player.curW=player.slots[1]; player.curSlot=1;
playerFireTick(0.016,true);                  // 每帧同步: 持连狙 → true
const onSpec=player.ffSpecSniper;
player.curW=player.slots[0]; player.curSlot=0;
playerFireTick(0.016,true);                  // 换回主武器 → false
const offRifle=player.ffSpecSniper;
// 死亡复位
player.curW=player.slots[1]; player.curSlot=1; player.ffSpecSniper=true;
player.alive=true; player.die(null,false);
const afterDie=player.ffSpecSniper;
// 换局复位
player.ffSpecSniper=true;
resetPlayerForNewMatch();
const afterReset=player.ffSpecSniper;
// 关掉观战 (观战连狙从槽位换回) 后不得再有无差别火力
resetPlayerForNewMatch(); player.spectator=true; applySpectatorLoadout();
player.spectator=false; applySpectatorLoadout();
player.curW=player.slots[1]||player.curW; playerFireTick(0.016,true);
const afterSpecOff=player.ffSpecSniper;
return {onSpec,offRifle,afterDie,afterReset,afterSpecOff};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`,ctx);
if(typeof r==='string'){ exc('T4',r); return; }
console.log('     · 持连狙='+r.onSpec+' 换步枪='+r.offRifle+' 死亡后='+r.afterDie+' 换局后='+r.afterReset+' 关观战后='+r.afterSpecOff);
ok(r.onSpec===true&&r.offRifle===false,'T4 每帧按手持武器同步 (连狙 true / 步枪 false)');
ok(r.afterDie===false,'T4 死亡时清除 (18-game die)');
ok(r.afterReset===false,'T4 换局复位 (22-hud resetPlayerForNewMatch)');
ok(r.afterSpecOff===false,'T4 关掉观战后即使拿着副武器也不再有连狙火力');
}
// ═════ T5 步行第三人称: 相机位置 ═════
function t5(){
console.log('T5 步行第三人称: camera.position 距 player.pos > 1.5m 且在角色背后');
const ctx=boot(0,false);
const r=vm.runInContext(`(()=>{try{
${FIXTURE}
player.thirdPerson=true;
const measure=(yaw)=>{
player.yaw=yaw; player.pitch=0;
updateCamera(0.016); updateCamera(0.016);      // 两帧: dampF 收敛 + 防穿墙射线就位
const dx=camera.position.x-player.pos.x, dz=camera.position.z-player.pos.z;
const fwdX=-Math.sin(yaw), fwdZ=-Math.cos(yaw);   // 玩家视线水平分量
const behind=-(dx*fwdX+dz*fwdZ)/Math.max(1e-6,Math.hypot(dx,dz)); // 1=正后方, -1=正前方
return {d:camera.position.distanceTo(player.pos),dx,dz,
dyEye:camera.position.y-(player.pos.y+player.eyeH),       // 相对**眼位**的抬高 (第一人称=0)
behind,dist2d:Math.hypot(dx,dz),yaw,on:thirdPersonOn()};
};
const y0=measure(0);
const y1=measure(1.1);
// 关掉开关 → 必须回第一人称 (顺序写在最后, 否则会把上面两测也关掉)
player.thirdPerson=false; updateCamera(0.016);
const off={d:camera.position.distanceTo(player.pos),on:thirdPersonOn()};
// 开镜互斥 (第三人称开着 + 按住右键 ⇒ 强制第一人称)
player.thirdPerson=true; updateCamera(0.016);
const dist3=camera.position.distanceTo(player.pos);
player.ads=true; updateCamera(0.016);
const ads={d:camera.position.distanceTo(player.pos),on:thirdPersonOn()};
player.ads=false; updateCamera(0.016);
const back={d:camera.position.distanceTo(player.pos),on:thirdPersonOn()};
return {dist3,y0,y1,off,ads,back};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`,ctx);
if(typeof r==='string'){ exc('T5',r); return; }
console.log('     · 关: 相机距角色 '+r.off.d.toFixed(3)+'m (第一人称, 眼高 1.62m)');
console.log('     · 开(yaw=0): 距角色 '+r.y0.d.toFixed(2)+'m, 水平后移 '+r.y0.dist2d.toFixed(2)+'m, 高于眼位 '+r.y0.dyEye.toFixed(2)+'m, 背后度 '+r.y0.behind.toFixed(3));
console.log('     · 开(yaw=1.1): 距角色 '+r.y1.d.toFixed(2)+'m, 背后度 '+r.y1.behind.toFixed(3));
console.log('     · 第三人称('+r.dist3.toFixed(2)+'m) → 开镜('+r.ads.d.toFixed(2)+'m) → 松镜回第三人称('+r.back.d.toFixed(2)+'m)');
ok(r.y0.on===true&&r.y1.on===true,'T5 前置: thirdPerson=true 后 thirdPersonOn() 生效 (FIXTURE 为步战态)');
ok(r.y0.d>1.5,'T5 ★ 相机与角色距离 ' +r.y0.d.toFixed(2)+'m > 1.5m (第一人称仅 '+r.off.d.toFixed(2)+'m)');
ok(r.y0.behind>0.85,'T5 ★ 相机在角色背后 (yaw=0: 背后度 '+r.y0.behind.toFixed(3)+', 1=正后方)');
ok(r.y1.behind>0.85,'T5 ★ 换朝向后仍在背后 (yaw=1.1: '+r.y1.behind.toFixed(3)+') ⇒ 偏移随视线旋转, 不是固定世界方向');
ok(r.y0.dyEye>0.1&&r.y0.dyEye<1.8,'T5 相机高于眼位 '+r.y0.dyEye.toFixed(2)+'m ⇒ 不是水平穿模的贴脸机位');
ok(r.off.on===false&&r.off.d<2,'T5 关掉开关后回到第一人称 (相机贴眼 '+r.off.d.toFixed(2)+'m, thirdPersonOn=false)');
ok(r.ads.on===false&&r.ads.d<2,'T5 ★ 开镜互斥: 第三人称开着时按右键 ⇒ 立刻回第一人称 ('+r.ads.d.toFixed(2)+'m)');
ok(r.back.on===true&&r.back.d>1.5,'T5 松开右键自动回第三人称 ('+r.back.d.toFixed(2)+'m) ⇒ 开关状态不丢, 不用二次按键');
}
// ═════ T6 第三人称开火: 起点=眼位 / 方向=准星命中点 / 端到端必中 ═════
function t6(){
console.log('T6 第三人称开火: 弹道起点=角色眼位(不是相机), 方向=眼位→准星命中点, 且准星指着友军时必中');
const ctx=boot(0,true);
const r=vm.runInContext(`(()=>{try{
${FIXTURE}
player.curSlot=1; player.curW=player.slots[1]; VM.key=player.curW.key;   // 手持观战连狙 (0 号槽是反坦克火箭, 不走 fireBullet)
player.thirdPerson=true;
updateCamera(0.016); updateCamera(0.016);
const camF=V3(0,0,-1);                                  // 桩的 camForward (真机=相机中心射线)
const camPos={x:camera.position.x,y:camera.position.y,z:camera.position.z};
const ep=playerEyePos();
const eye={x:ep.x,y:ep.y,z:ep.z};
const dCamEye=camera.position.distanceTo(ep);
// 把友军摆在**相机中心射线**上 20m 处, 且**躯干正中落在该射线上** —— 这是"准星与落点一致"的最强取证
// (相机高于眼位 ~1.27m, 若把目标摆在地面上, 相机射线会从他头顶掠过 ⇒ 那是测试几何错, 不是准星错;
//  瞄躯干而不是瞄头: 观战连狙爆头是 75×2.5=187.5 伤害, 一枪必死, 那样就验不出"掉血且活着"了)
const ally=combatants.filter(s=>s!==player&&s.alive&&s.team===0)[0];
ally.alive=true; ally.hp=100; ally.onVehicle=null; ally.crouch=false; ally.prone=false;
ally.pos.set(camPos.x,0,camPos.z-20); ally.pos.y=camPos.y-1.0;
const aimHead={x:ally.pos.x,y:ally.pos.y+1.0,z:ally.pos.z};   // 躯干正中 (相机射线穿过的那个点)
const gameAim=tpAimPoint(camF);                 // 游戏自己的"准星命中点"单源
const camRayDist=Math.hypot(gameAim.x-camPos.x,gameAim.y-camPos.y,gameAim.z-camPos.z);
let cap=null;
const _fb=fireBullet;
fireBullet=function(sh,o,d,def){ cap={ox:o.x,oy:o.y,oz:o.z,dx:d.x,dy:d.y,dz:d.z}; return _fb.apply(this,arguments); };
playerShoot(player.curW);
fireBullet=_fb;
const originToEye=Math.hypot(cap.ox-eye.x,cap.oy-eye.y,cap.oz-eye.z);
const originToCam=Math.hypot(cap.ox-camPos.x,cap.oy-camPos.y,cap.oz-camPos.z);
// 弹道到"准星命中点"的垂距 (点到直线距离): 游戏自己的 tpAimPoint 与"头部中心"各算一次
const vx=cap.dx,vy=cap.dy,vz=cap.dz;
const distTo=(p)=>{ const wx=p.x-cap.ox,wy=p.y-cap.oy,wz=p.z-cap.oz;
const cr={x:vy*wz-vz*wy,y:vz*wx-vx*wz,z:vx*wy-vy*wx};
return {perp:Math.hypot(cr.x,cr.y,cr.z)/Math.hypot(vx,vy,vz),along:wx*vx+wy*vy+wz*vz}; };
const toGameAim=distTo(gameAim);
const toHead=distTo(aimHead);
return {camDist:player.pos.distanceTo(camera.position),dCamEye,originToEye,originToCam,
perp:toGameAim.perp,along:toGameAim.along,perpHead:toHead.perp,camRayDist,
weapon:player.curW.key,hpBefore:100,hpAfter:Math.round(ally.hp),alive:ally.alive,
aim:{x:aimHead.x,y:aimHead.y,z:aimHead.z},
allySameTeam:ally.team===player.team,specMarker:player.ffSpecSniper};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`,ctx);
if(typeof r==='string'){ exc('T6',r); return; }
console.log('     · 相机距角色 '+r.camDist.toFixed(2)+'m / 眼位距相机 '+r.dCamEye.toFixed(2)+'m');
console.log('     · 弹道起点距眼位 '+r.originToEye.toExponential(2)+'m / 距相机 '+r.originToCam.toFixed(2)+'m');
console.log('     · 弹道到"准星命中点"的垂距 '+r.perp.toExponential(2)+'m (沿弹道投影 '+r.along.toFixed(1)+'m); 准星命中点距相机 '+r.camRayDist.toFixed(2)+'m');
console.log('     · 弹道到"目标躯干中心"的垂距 '+r.perpHead.toFixed(3)+'m (判定体半径 0.38m)');
console.log('     · 端到端: 友军 hp 100 → '+r.hpAfter+' (队友='+r.allySameTeam+', 活着='+r.alive+')');
ok(r.weapon==='specsniper','T6 前置: 手持观战连狙');
ok(r.camDist>1.5,'T6 前置: 确实处于第三人称 (相机距角色 '+r.camDist.toFixed(2)+'m)');
ok(r.originToEye<1e-6,'T6 ★ 弹道起点 = 角色眼位 (误差 '+r.originToEye.toExponential(2)+'m)');
ok(r.originToCam>1.5,'T6 ★ 弹道起点不是相机位置 (距相机 '+r.originToCam.toFixed(2)+'m ⇒ 不会从身后开枪)');
ok(r.perp<0.02&&r.along>0,'T6 ★ 弹道严格经过准星命中点 (垂距 '+r.perp.toExponential(2)+'m, 正向 '+r.along.toFixed(1)+'m)');
ok(r.perpHead<0.38&&r.along>0,'T6 ★ 弹道穿过目标判定体 (到躯干中心垂距 '+r.perpHead.toFixed(3)+'m < 0.38m) ⇒ 准星与落点一致');
ok(r.hpAfter<100&&r.alive===true,'T6 ★ 端到端: 准星指着 20m 外的**友军**开枪 → 命中掉血且未死 ('+r.hpAfter+')');
}
// ═════ T7 互斥与接线 ═════
function t7(){
console.log('T7 互斥: 开镜自动回第一人称 / 载具·巡飞弹·跳伞·游泳不接管 / U 键与提示接线');
const ctx=boot(0,false);
const r=vm.runInContext(`(()=>{try{
${FIXTURE}
player.thirdPerson=true;
const cases={};
const probe=(name,mut)=>{ mut(); updateCamera(0.016); cases[name]={on:thirdPersonOn(),camDist:player.pos.distanceTo(camera.position)}; mut(); };
// 基准 (步战)
updateCamera(0.016); cases.walk={on:thirdPersonOn(),camDist:player.pos.distanceTo(camera.position)};
// 开镜
player.ads=true; updateCamera(0.016); cases.ads={on:thirdPersonOn(),camDist:player.pos.distanceTo(camera.position)}; player.ads=false;
// 载具 (用幽灵坦克, 观战者的车)
const g=specVehEnsureAtBase(); specVehBoard(g); updateCamera(0.016);
cases.veh={on:thirdPersonOn(),camDist:player.pos.distanceTo(camera.position)}; specVehDismount();
// 跳伞
player.chute=true; updateCamera(0.016); cases.chute={on:thirdPersonOn()}; player.chute=false;
// 巡飞弹
fireLoiter(player,V3(player.pos.x,player.pos.y+1,player.pos.z),V3(0,0,-1)); updateCamera(0.016);
cases.loiter={on:thirdPersonOn()};
if(player.loiter){ player.loiter.dead=true; player.loiter=null; }
// 游泳
player.swim=true; updateCamera(0.016); cases.swim={on:thirdPersonOn()}; player.swim=false;
// 复活态 (未落地)
player.alive=false; updateCamera(0.016); cases.dead={on:thirdPersonOn()}; player.alive=true;
// 本体模型: 第三人称显示 / 第一人称隐藏
updateCamera(0.016); const avShow=playerAvatar&&playerAvatar.root.visible===true;
player.thirdPerson=false; updateCamera(0.016); const avHide=!playerAvatar||playerAvatar.root.visible===false;
return {cases,avShow,avHide};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`,ctx);
if(typeof r==='string'){ exc('T7',r); return; }
console.log('     · 互斥实测: '+Object.keys(r.cases).map(k=>k+'='+r.cases[k].on).join(' / '));
const C=r.cases;
ok(C.walk&&C.walk.on===true&&C.walk.camDist>1.5,'T7 步战态: 第三人称生效 (相机后拉 '+C.walk.camDist.toFixed(2)+'m)');
ok(C.ads&&C.ads.on===false&&C.ads.camDist<2,'T7 ★ 开镜(ADS)自动回第一人称 (相机贴眼 '+C.ads.camDist.toFixed(2)+'m) —— 与机瞄语义互斥');
ok(C.veh&&C.veh.on===false,'T7 载具不接管 (坦克/幽灵坦克走各自的追尾与 C 车长镜)');
ok(C.chute&&C.chute.on===false,'T7 跳伞不接管 (已有第三人称追尾)');
ok(C.loiter&&C.loiter.on===false,'T7 巡飞弹不接管 (F 键自有第一/第三视角)');
ok(C.swim&&C.swim.on===false,'T7 游泳不接管 (武器背起态, 保持第一人称)');
ok(C.dead&&C.dead.on===false,'T7 阵亡/未落地不接管');
ok(r.avShow===true&&r.avHide===true,'T7 玩家本体模型: 第三人称显示 / 回第一人称隐藏');
// 静态接线
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const inp=read('js/19-input.js'),pl=read('js/20-player.js'),main=read('js/24-main.js'),i18n=read('js/00b-i18n.js');
ok(inp.indexOf("if(e.code==='KeyU')")>=0&&inp.indexOf('player.thirdPerson=!player.thirdPerson')>=0,'T7 接线: 19-input KeyU = 第三人称开关');
const codes=(inp.match(/e\.code==='([A-Za-z0-9]+)'/g)||[]).map(s=>s.replace(/^e\.code==='|'$/g,''));
// ★2026-10-27 指挥官交互批: 减速键 N→V、近战键 V→N 互换 (用户裁定「N 太远」, V 在 WASD 手位且减速是
//   **按住**的持续动作必须左手可及)。对 T7 的两处影响, 都是有意语义变更、不是回归:
//   ① 19-input 里**不再有** `e.code==='KeyV'` 字面量 —— 减速键改读单源 `CMD_TIME.KEY` (26-commander),
//      这样键位只在一处定义, 本文件不再持有第二份;
//   ② 近战键的分支字面量由 'KeyV' 换成 'KeyN'。
//   所以既有键清单里 KeyV 换成 KeyN; 同时补一条"减速键没有回退成硬编码"的判据 (下面 T7 新断言)。
const used=['Tab','Escape','KeyP','KeyM','Space','KeyC','KeyZ','KeyX','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','KeyR','KeyN','KeyG','KeyH','KeyB','KeyF','KeyT','KeyY'];
ok(codes.filter(c=>c==='KeyU').length===1&&used.every(k=>codes.indexOf(k)>=0)&&inp.indexOf('keys.KeyU')<0,
'T7 键位核对: U 只有一处分支且未做持续按键 (e.code 分支共 '+codes.length+' 个; 既有键全在: '+used.length+' 个)');
// 2026-10-27: 减速键位单源核对 —— 键位定义只能在 26-commander 的 CMD_TIME.KEY 一处, 19-input 只许读它。
// 这条与上面的 used 清单互补: 清单证明"近战分支还在", 这条证明"减速没有变成硬编码的第二份"。
ok(inp.indexOf('e.code===CMD_TIME.KEY')>=0&&inp.indexOf("e.code==='KeyV'")<0,
 'T7 键位核对: 减速键只读 CMD_TIME.KEY 单源 (19-input 不再持有 KeyV 字面量)');
ok(pl.indexOf('function thirdPersonOn()')>=0&&pl.indexOf('function playerFireOrigin()')>=0&&pl.indexOf('function playerAimDir()')>=0&&pl.indexOf('function tpAimPoint(')>=0,'T7 接线: 20-player 提供 thirdPersonOn/playerFireOrigin/playerAimDir/tpAimPoint 单源');
ok(pl.indexOf('const o=oS;')>=0&&pl.indexOf('fireRocket(p,oS.clone()')>=0,'T7 接线: 连射/火箭/迫击炮/巡飞弹四条开火路径都用 playerFireOrigin');
// ★2026-09-27I 改判: 第三人称视场补写并入"本体链帧长 pdt" (24-main 新拆的一支, 让观战时停下仍能走动/飞行;
//   见 22b-speclayer specTimePlayerDt)。判据只换实参名, 守卫意图 (主循环在 updateViewModel 之后补一次 fov +
//   第一人称不叠渲染视角武器模型) 一字不变。
ok(main.indexOf('thirdPersonFovTick(pdt)')>=0&&main.indexOf('thirdPersonOn())')>=0,'T7 接线: 24-main 第三人称视场补写 (本体帧长 pdt) + 视角武器模型不叠渲染');
ok(i18n.indexOf("'第三人称: 开':'Third person: ON'")>=0&&i18n.indexOf("'<b>U</b> 第三人称: 开'")>=0,'T7 接线: 00b-i18n 中英词条齐备 (切换播报 + HUD 提示)');
ok(pl.indexOf("t2('<b>U</b> 第三人称: 开'):t2('<b>U</b> 第三人称: 关')")>=0,'T7 接线: 20-player updateInteractHint 有 U 键常驻提示');
}
// ═════ T8 第6条: 部署界面 HUD 隐藏状态机 (沙箱内可验的部分) ═════
function t8(){
console.log('T8 第6条状态机: startGame→挂 inDeploy / deployPlayer·返回主界面→摘; 挂摘点接线静态穷尽');
const ctx=boot(0,false);
const r=vm.runInContext(`(()=>{try{
document.body.className='';                     // 跨 boot 共用同一个 body 桩, 先清干净 (真机是整页重载)
const snap=tag=>({tag,cls:document.body.className,
inDeploy:document.body.classList.contains('inDeploy'),
inMenu:document.body.classList.contains('inMenu'),
deployVisible:!document.getElementById('deploy').classList.contains('hidden')});
${START}                                        // startGame(): 摘 inMenu + showDeploy(true)
const A=snap('startGame');
deployPlayer();                                 // 落地 = 收起 .screen
const B=snap('deployPlayer');
showDeploy(false);                              // 再看部署界面 (阵亡重生 / 暂停查看)
const C=snap('showDeploy');
if(typeof syncDeployHud==='function'){ document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden')); syncDeployHud(); }
const D=snap('收起界面');
return {A,B,C,D};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`,ctx);
if(typeof r==='string'){ exc('T8',r); return; }
[r.A,r.B,r.C,r.D].forEach(s=>console.log('     · '+s.tag+': body="'+s.cls+'" 部署可见='+s.deployVisible));
ok(r.A.inDeploy===true&&r.A.deployVisible===true,'T8 ★ 进部署界面: 挂上 inDeploy (战斗 HUD 被 #ui 藏起来)');
ok(r.B.inDeploy===false&&r.B.deployVisible===false,'T8 ★ 落地: 摘掉 inDeploy (HUD 该显示时立刻放回)');
ok(r.C.inDeploy===true,'T8 回到部署界面 (阵亡重生/暂停查看): 重新挂上');
ok(r.D.inDeploy===false,'T8 ★ 收起全部 .screen: 对账摘掉 inDeploy (不留"藏过头")');
const css=fs.readFileSync(path.join(root,'css/style.css'),'utf8');
ok(css.indexOf('body.inDeploy #ui, body.inDeploy #touchUI { display:none !important; }')>=0,'T8 CSS: body.inDeploy 与 body.inMenu 同构的隐藏规则在位 (不靠把 .screen 背景调不透明)');
// ★2026-10-01: 下面的"8 个挂摘点"针里有**跨行**字面量 (含 \n)。仓库脚本是 CRLF, 裸读时跨行针永远
//   匹配不到 ⇒ 假红 (T8 曾报"缺失 22-hud returnToMenu,23-deploy showDeploy", 实际两处接线都在)。
//   判据: 只在"读进来做静态字符串断言"这一层把 \r\n 归一成 \n, 不动断言本身。
const src={hud:fs.readFileSync(path.join(root,'js/22-hud.js'),'utf8').replace(/\r\n/g,'\n'),
dep:fs.readFileSync(path.join(root,'js/23-deploy.js'),'utf8').replace(/\r\n/g,'\n'),
inp:fs.readFileSync(path.join(root,'js/19-input.js'),'utf8').replace(/\r\n/g,'\n'),
mt:fs.readFileSync(path.join(root,'js/21-match.js'),'utf8').replace(/\r\n/g,'\n'),
main:fs.readFileSync(path.join(root,'js/24-main.js'),'utf8').replace(/\r\n/g,'\n')};
const sites=[['22-hud returnToMenu',src.hud,'document.body.classList.add(\'inMenu\'); // 隐藏战斗 HUD 与触控层 (航拍动态不叠游戏 UI, 与菜单期同源)\nsyncDeployHud();'],
['22-hud resumeBattle',src.hud,'syncDeployHud(); // 两条分支同源对账'],
['22-hud resumeBtn',src.hud,"syncDeployHud(); // 「返 回 战 斗」"],
['23-deploy showDeploy',src.dep,'if(typeof syncDeployHud===\'function\') syncDeployHud();\n}'],
['23-deploy deployPlayer',src.dep,'// 落地 = 部署界面收起'],
['19-input togglePause',src.inp,'if(typeof syncDeployHud===\'function\') syncDeployHud();'],
['21-match endMatch',src.mt,"if(typeof syncDeployHud==='function') syncDeployHud();"],
['24-main loop 权威对账',src.main,"if(typeof syncDeployHud==='function') syncDeployHud();"]];
const missing=sites.filter(([n,s,frag])=>s.indexOf(frag)<0).map(([n])=>n);
ok(missing.length===0,'T8 挂摘点穷尽: showDeploy/deployPlayer/returnToMenu/resumeBattle/resumeBtn/togglePause/endMatch + 主循环权威对账 全部接线'
+(missing.length?' 缺失: '+missing.join(','):' (8/8)'));
}
// ═════ T9 幽灵坦克开炮不震屏 (2026-09-21 WS5 用户第 6 条) ═════
//   用户裁定: 幽灵坦克的**主炮与同轴机枪都不震屏** —— 15c-specveh 原 :188 addTrauma(0.5) 与 :201 addTrauma(0.02) 已删。
//   两条阴性对照 (证明没动到陆战路径): 普通坦克开炮 (15-vehicles:1108) 必须仍震; 步兵开火 (20-player kick) 必须仍震。
function t9(){
console.log('T9 幽灵坦克开炮不震屏 (主炮 + 同轴机枪) / 普通坦克·步兵仍震 (阴性对照)');
const ctx=boot(0,true);
const r=vm.runInContext(`(()=>{try{
${FIXTURE}
const g=specVehEnsureAtBase();
specVehBoard(g);
const bound=player.onVehicle===g;
// ── 幽灵坦克: 主炮 20 发 (CD 恒 0) + 同轴机枪 20 发 → camTrauma 必须恒 0 ──
camTrauma=0;
for(let i=0;i<20;i++){ g.cannonCd=0; g.fireCannon(); }
const ghostCannon=camTrauma;
camTrauma=0;
for(let i=0;i<20;i++){ g.mgT=0; g.firePlayerMG(g.aimDir()); }
const ghostMG=camTrauma;
const shots=shells.length;
// ── 阴性对照 1: 普通坦克主炮仍 addTrauma(0.5) (15-vehicles:1108 未动) ──
const tk=tanks.filter(t=>t&&t.alive&&t!==g)[0];
tk.playerDriven=true; tk.isAI=false; tk.cannonCd=0;
camTrauma=0; tk.fireCannon(); const tankCannon=camTrauma;
// ── 阴性对照 2: 步兵开火仍震 (playerShoot → addTrauma(w.def.kick*0.9), 20-player:692 未动) ──
player.onVehicle=null; player.cls=0; player.curSlot=0; player.curW=player.slots[0];
if(player.curW&&player.curW.mag!==undefined&&player.curW.mag<=0) player.curW.mag=30;
player.fireT=0; camTrauma=0; playerShoot(player.curW); const infKick=camTrauma;
return {bound,ghostCannon,ghostMG,tankCannon,infKick,shots,cls:player.cls};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`,ctx);
if(typeof r==='string'){ exc('T9',r); return; }
console.log('     · 幽灵坦克主炮×20 → camTrauma='+r.ghostCannon+' / 同轴机枪×20 → camTrauma='+r.ghostMG
+' / 普通坦克主炮 → camTrauma='+r.tankCannon+' / 步兵开火 → camTrauma='+r.infKick+' (炮弹累计 '+r.shots+')');
ok(r.bound===true,'T9 前置: 已上幽灵坦克 (驾驶员=玩家)');
ok(r.ghostCannon===0,'T9 ★ 幽灵坦克主炮连续 20 发: camTrauma 恒为 0 (原 15c-specveh:188 addTrauma(0.5) 已删)');
ok(r.ghostMG===0,'T9 ★ 幽灵坦克同轴机枪连续 20 发: camTrauma 恒为 0 (原 :201 addTrauma(0.02) 已删)');
ok(r.tankCannon>0,'T9 阴性对照: 普通坦克开炮 camTrauma='+r.tankCannon+'>0 —— 陆战震屏手感未被本批改动波及');
ok(r.infKick>0,'T9 阴性对照: 步兵开火 camTrauma='+r.infKick+'>0 —— 步兵开火手感未变');
}
// ── 主流程 ──
console.log('== 观战连狙双方火力 + 步行第三人称 沙箱实测 (加载全部真实脚本) ==');
t1(); t2(); t3(); t4(); t5(); t6(); t7(); t8(); t9();
// ═════ 可选: 无头 Edge 菜单 HUD 段 (验收口径 6: 主菜单状态必须隐藏战斗 HUD) ═════
// 为什么必须进真浏览器: 隐藏效果是 CSS 计算样式 (#ui display:none), Node 沙箱量不到;
// 且真正会摘掉 inMenu 的那条路径 (index.html 页尾 bootFail 兜底) 只在**脚本链中途抛错**时触发,
// 也就是只有真机跑一遍才拿得到证据。做法与 dev/verify-menucards.js 同源:
//   把 index.html/css/js 复制到临时目录 (不动工作区, 相对路径仍可解析), 在副本里注入两段探针:
//   ① <head> 最先 (早于游戏引导脚本): 按用例写 localStorage + 装 window error 捕获;
//   ② </body> 最后 (晚于全部游戏脚本): 量 body.class / #ui 计算 display / 是否 booted / 报错。
function findEdge(){
const cands=[process.env.EDGE_EXE,
'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
'/usr/bin/microsoft-edge','/usr/bin/google-chrome','/usr/bin/chromium'].filter(Boolean);
for(const p of cands) if(fs.existsSync(p)) return p;
return null;
}
const BROWSER_TMP=path.join(require('os').tmpdir(),'sf-specthird');
function browserPrep(){
fs.rmSync(BROWSER_TMP,{recursive:true,force:true});
fs.mkdirSync(BROWSER_TMP,{recursive:true});
fs.cpSync(path.join(root,'css'),path.join(BROWSER_TMP,'css'),{recursive:true});
fs.cpSync(path.join(root,'js'),path.join(BROWSER_TMP,'js'),{recursive:true});
return fs.readFileSync(path.join(root,'index.html'),'utf8');
}
// 用例探针: states=真机四状态测量 (菜单/部署/战斗/回菜单)。head 探针只负责清 localStorage + 装错误捕获。
function buildPage(base,opt){
const caseDef='<script>window.__seCase='+JSON.stringify({states:!!opt.states})+';<\/script>';
const head=caseDef+`<script>
window.__seErrs=[];
addEventListener('error',function(e){var t=e.target;window.__seErrs.push({m:String(e.message||(e.error&&e.error.message)||''),src:String((t&&(t.src||t.href))||''),line:e.lineno||0});},true);
addEventListener('unhandledrejection',function(e){window.__seErrs.push({m:'unhandledrejection: '+String((e.reason&&e.reason.message)||e.reason)});});
try{ localStorage.setItem('sf_lang','zh'); }catch(e){ window.__seErrs.push({m:'localStorage 不可用: '+e.message}); }
<\/script>`;
// 状态机四步全同步执行 (startGame/deployPlayer/returnToMenu 都是同步函数), 所以 --dump-dom 的 load 时点就能取到结果。
const tail=`<script>
(function(){
var pre=document.createElement('pre'); pre.id='__m'; document.body.appendChild(pre);
var out={steps:[]},errs=null;
function disp(id){ var e=document.getElementById(id); return e?getComputedStyle(e).display:'MISSING'; }
// "真正渲染" = 自身可见 且 祖先链上没有 display:none (照抄 Lead 探针的判据; 只看自身 display 会把
// 祖先藏起来的子树误算成渲染中 —— 部署期 #menu 里的 #menuArt 就是这种情况)。
function rendered(id){ var e=document.getElementById(id); if(!e||!e.getClientRects().length) return false;
 for(var n=e;n&&n.nodeType===1;n=n.parentElement){ if(getComputedStyle(n).display==='none') return false; } return true; }
var HUD=['crosshair','hitmark','ammoPanel','healthPanel','minimapWrap','squadHUD','topBar','killfeed','msgC',
'scorePop','capPanel','interact','nadeWarn','fps','vehHpWrap','clsTip','oxyWrap'];
function hudRendered(){ return HUD.filter(rendered); }
function snap(tag){ var ui=document.getElementById('ui');
 return {tag:tag,cls:document.body.className,ui:disp('ui'),touch:disp('touchUI'),
  uiRendered:rendered('ui'),hud:hudRendered(),deploy:disp('deploy'),menu:disp('menu'),
  booted:!!window.__sfBooted,deployed:!!player.deployed,alive:!!player.alive,
  menuArtRendered:rendered('menuArt')}; }
try{
 window.confirm=function(){ return true; };
 out.steps.push(snap('①主菜单(首屏)'));
 if(!window.__sfBooted){ out.errors=[{m:'NOT_BOOTED'}]; pre.textContent=JSON.stringify(out); return; }
 var sb=document.getElementById('startBtn'); if(sb) sb.click();
 out.steps.push(snap('②部署界面(startGame后)'));
 if(typeof deployPlayer==='function') deployPlayer();
 out.steps.push(snap('③战斗期(deployPlayer后)'));
 // 真按键端到端 (第三人称): KeyU 分支要求指针已锁定, 无头下没有真指针锁 ⇒ 直接把 19-input 的
 // pointerLocked 置位 (它是全局 let 绑定, 同 realm 的后置脚本可写), 再派发一次真 KeyboardEvent。
 try{
  pointerLocked=true;
  window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyU',key:'u',bubbles:true}));
  // 同步推两帧相机 (本页在 load 时就出结果, 等不到 rAF): 直接调游戏自己的 updateCamera ⇒ 量到的是真第三人称机位
  if(typeof updateCamera==='function'){ updateCamera(0.016); updateCamera(0.016); }
  out.keyU={thirdPerson:!!player.thirdPerson,on:typeof thirdPersonOn==='function'?thirdPersonOn():null,
   camDist:+player.pos.distanceTo(camera.position).toFixed(2)};
  window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyU',key:'u',bubbles:true}));
  if(typeof updateCamera==='function'){ updateCamera(0.016); updateCamera(0.016); }
  out.keyUOff={thirdPerson:!!player.thirdPerson,on:typeof thirdPersonOn==='function'?thirdPersonOn():null,
   camDist:+player.pos.distanceTo(camera.position).toFixed(2)};
 }catch(e){ out.keyU={err:String(e&&e.message||e)}; }
 if(typeof returnToMenu==='function') returnToMenu();
 out.steps.push(snap('④回主界面(returnToMenu后)'));
 out.errors=(window.__seErrs||[]).slice(0,4);
}catch(e){ out.fatal=String(e&&e.stack||e); }
pre.textContent=JSON.stringify(out);
})();
<\/script>`;
let page=base.replace('<head>','<head>'+head).replace('</body>',tail+'</body>');
return page;
}
function runPage(page,url){
const p=path.join(BROWSER_TMP,'index.html');
fs.writeFileSync(p,page);
const r=require('child_process').spawnSync(findEdge(),['--headless=new','--disable-gpu','--no-first-run',
'--user-data-dir='+path.join(BROWSER_TMP,'profile'),'--window-size=1600,900','--dump-dom',url||('file:///'+p.replace(/\\/g,'/'))],
{encoding:'utf8',maxBuffer:1<<28});
const m=(r.stdout||'').match(/<pre id="__m">([\s\S]*?)<\/pre>/);
if(!m) throw new Error('未取到测量结果 (Edge 输出 '+((r.stdout||'').length)+' 字节; stderr: '+String(r.stderr||'').slice(0,240)+')');
return JSON.parse(m[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>'));
}
// 本地静态服务 (只在浏览器段临时起): file:// 下各文件互为异源, 未捕获异常的 message 会被浏览器抹成
// "Script error." —— 定位根因必须拿到真实报错文本, 所以整段改用 http://127.0.0.1:<随机端口> 加载同一份副本。
// 必须用异步 spawn: spawnSync 会阻塞本进程事件循环, 同进程内的静态服务将永远无法应答。
function startStaticServer(dir){
const http=require('http');
const MIME={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8'};
const srv=http.createServer((req,res)=>{
let p=decodeURIComponent(String(req.url).split('?')[0]);
if(p==='/') p='/index.html';
const f=path.join(dir,p);
if(!f.startsWith(dir)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){ res.writeHead(404); res.end('404'); return; }
res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});
res.end(fs.readFileSync(f));
});
return new Promise(resolve=>srv.listen(0,'127.0.0.1',()=>resolve({srv,url:'http://127.0.0.1:'+srv.address().port+'/index.html'})));
}
function runPageAsync(page,url){
const p=path.join(BROWSER_TMP,'index.html');
fs.writeFileSync(p,page);
return new Promise((resolve,reject)=>{
const ch=require('child_process').spawn(findEdge(),['--headless=new','--disable-gpu','--no-first-run',
'--user-data-dir='+path.join(BROWSER_TMP,'profile'),'--window-size=1600,900','--dump-dom',url],
{stdio:['ignore','pipe','ignore']});
let out='';
ch.stdout.on('data',d=>out+=d);
ch.on('close',()=>{
const m=out.match(/<pre id="__m">([\s\S]*?)<\/pre>/);
if(!m) return reject(new Error('未取到测量结果 (Edge 输出 '+out.length+' 字节)'));
resolve(JSON.parse(m[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')));
});
});
}
async function browserMenuSection(){
console.log('\nB1 真机 (无头 Edge) 四状态: 主菜单 / 部署界面 / 战斗期 / 回主界面 —— 战斗 HUD 只在战斗期可见');
const EDGE=findEdge();
if(!EDGE){ console.log('  · SKIP: 未找到 Edge/Chrome (设 EDGE_EXE 后重跑)'); return; }
const base=browserPrep();
const {srv,url}=await startStaticServer(BROWSER_TMP);
console.log('  Edge: '+EDGE);
console.log('  临时副本: '+BROWSER_TMP+' · 经 '+url+' 加载 (工作区未被改动)');
try{
const r=await runPageAsync(buildPage(base,{states:true}),url);
if(r.errors&&r.errors[0]&&r.errors[0].m==='NOT_BOOTED'){
console.log('  · SKIP: 页面未完成启动 (__sfBooted=false) —— 按既有设计, 这是 three/cannon CDN 拉不到时');
console.log('    index.html 页尾兜底(解除首屏隐藏, 让报错可见) 的正常行为, 非缺陷; 本机外网不稳, 跳过本段。');
return;
}
if(r.fatal){ ok(false,'B1 推演异常: '+r.fatal); return; }
r.steps.forEach(s=>console.log('  · '+s.tag+': body="'+s.cls+'" #ui='+s.ui+'(rendered='+s.uiRendered+')'
+' 部署='+s.deploy+' 菜单='+s.menu+' 真渲染 HUD 模块='+s.hud.length+' 个'+(s.hud.length?': '+s.hud.join(','):'')));
const [menu,deploy,battle,back]=r.steps;
ok(menu&&menu.uiRendered===false&&menu.cls.indexOf('inMenu')>=0&&menu.hud.length===0,
'B1 ★ ①主菜单: body.inMenu + #ui 不渲染 (真渲染 HUD 模块 0 个)');
ok(deploy&&deploy.uiRendered===false&&deploy.cls.indexOf('inDeploy')>=0&&deploy.hud.length===0,
'B1 ★★ ②部署界面 (第6条): body.inDeploy + #ui 不渲染 —— 真渲染 HUD 模块 '+deploy.hud.length+' 个 (修复前 5 个: ammoPanel/healthPanel/minimapWrap/topBar/fps)');
ok(deploy&&deploy.deploy==='flex'&&deploy.deployed===false,'B1 ②部署界面确实正开着 (#deploy=flex, 尚未落地)');
ok(battle&&battle.uiRendered===true&&battle.hud.length>3&&battle.cls.indexOf('inDeploy')<0,
'B1 ★ ③战斗期 (对照): 摘掉 inDeploy + #ui 渲染, HUD 模块 '+battle.hud.length+' 个 (该显示时确实显示)');
ok(back&&back.uiRendered===false&&back.cls.indexOf('inMenu')>=0&&back.cls.indexOf('inDeploy')<0&&back.hud.length===0,
'B1 ★ ④回主界面: inMenu 挂回, inDeploy 不残留, HUD 又收回 (藏/显对称, 无竞态)');
ok(deploy&&deploy.menuArtRendered===false,'B1 部署期 #menuArt 不渲染 (它只在主菜单/开局面板出现; 祖先 #menu 是 none)');
if(r.keyU) console.log('  · KeyU 真按键: 按下后 thirdPerson='+r.keyU.thirdPerson+' 生效='+r.keyU.on+' 相机距角色='+r.keyU.camDist
+'m → 再按一次 thirdPerson='+(r.keyUOff||{}).thirdPerson+' 相机距角色='+(r.keyUOff||{}).camDist+'m');
ok(r.keyU&&r.keyU.thirdPerson===true&&r.keyU.on===true&&r.keyU.camDist>1.5,
'B1 ★ KeyU 真按键 (KeyboardEvent 派发) 打开步行第三人称: 相机后拉到 '+((r.keyU||{}).camDist)+'m');
ok(r.keyUOff&&r.keyUOff.thirdPerson===false&&r.keyUOff.camDist<2,
'B1 ★ 再按一次 KeyU 关回第一人称: 相机贴眼 '+((r.keyUOff||{}).camDist)+'m (开关可逆)');
if(r.errors&&r.errors.length) console.log('  · 页面报错: '+JSON.stringify(r.errors));
}finally{
srv.close();
fs.rmSync(BROWSER_TMP,{recursive:true,force:true});
console.log('  · 临时副本与静态服务已清理');
}
}
(async()=>{
if(process.argv.indexOf('--browser')>=0){
try{ await browserMenuSection(); }
catch(e){ ok(false,'菜单段失败: '+String(e&&e.stack||e)); }
}
console.log('\n通过 '+PASS.length+' 项, 失败 '+FAILS+' 项');
process.exit(FAILS?1:0);
})();

