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
// dev/verify-spec.js —— 观战模式扩展批沙箱 (2026-09-17, 不进 Index.html)
// 用法: node dev/verify-spec.js
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
sandbox.globalThis=sandbox;
sandbox.THREE=THREE;
sandbox.window=window;
function load(ctx,file){ vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file}); }
function boot(campIdx){
for(const k in byId)delete byId[k];
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document;ctx.window=window;
ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
const files=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/23-deploy.js','js/24-main.js'];
for(const f of files) load(ctx,f);
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

// ═════ T1 观战连狙: 定义 / 换装单源 / 部署配枪 / 即时换装 ═════
function t1(){
console.log('T1 观战连狙 (定义 + playerClassWeapons + 部署配枪 + 兵种卡即时换装)');
const ctx=boot(0);
const r=vm.runInContext(`(()=>{try{
const d=WPN_DEFS.specsniper;
const def={has:!!d,dmg:d&&d.dmg,rpm:d&&d.rpm,mag:d&&d.mag,scoped:!!(d&&d.scoped),type:d&&d.type,fov:d&&d.adsFov,model:d&&d.model,recoil:d&&d.recoil,recSide:d&&d.recSide};
${START}
player.spectator=false; const base=playerClassWeapons(0,3).slice();   // 兵种 8→5 (2026-09-28): cls3=反坦克兵 (实验模式=巡飞弹兵)
player.spectator=true;  const spec=playerClassWeapons(0,3).slice();
const specOther=playerClassWeapons(0,3).slice();   // 观战开着再点别的兵种卡: 副武器位同样是连狙
player.cls=3; selectedSpawn=-1;
deployPlayer();
const deployedSlot=player.slots[1]&&player.slots[1].key;
// 即时换装: 手持副武器(2号槽)时开/关观战 → 槽位 + 手持武器 + 视角模型同步
const sec=TEAM_FACTION[0].cls[3][1];
player.slots[1]={key:sec,def:WPN_DEFS[sec],mag:7,reserve:70};
player.curSlot=1; player.curW=player.slots[1]; VM.key=sec;
player.spectator=false; const off0=applySpectatorLoadout();   // 已是手枪: 无变化
player.spectator=true;  const on1=applySpectatorLoadout();
const after={key:player.slots[1].key,cur:player.curW.key,vm:VM.key};
player.spectator=false; const off1=applySpectatorLoadout();
const back={key:player.slots[1].key,cur:player.curW.key,vm:VM.key};
return {def,base,spec,specOther,deployedSlot,off0,on1,off1,after,back};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`,ctx);
if(typeof r==='string'){ exc('T1',r); return; }
ok(r.def.has&&r.def.dmg===75&&r.def.rpm===600&&r.def.mag===20,'T1 specsniper 定义: 单发75 / 600发分 / 20发弹匣 (rpm 300→600=2026-11-08 specsniper 批, 瞄准吸附×爆头批并发跟走)');
ok(r.def.scoped&&r.def.type==='auto'&&r.def.fov>0&&r.def.model,'T1 全自动 + scoped 可开镜 + 复用春田狙击模型');
ok(r.def.recoil<=1.2&&r.def.recSide<=0.3,'T1 后坐力压低 (recoil='+r.def.recoil+' / recSide='+r.def.recSide+')');
ok(r.base[1]!=='specsniper'&&r.spec[1]==='specsniper','T1 playerClassWeapons: 观战副武器位换成连狙 (非观战=原副武器)');
ok(r.specOther[1]==='specsniper','T1 观战开着时任何兵种的副武器位都是连狙 (不只是巡飞弹兵)');
ok(r.deployedSlot==='specsniper','T1 部署配枪: 观战部署后 2 号槽 = 观战连狙');
ok(r.off0===false&&r.on1===true&&r.off1===true,'T1 即时换装: 开关观战各换一次 (重复调用不改动)');
ok(r.after.key==='specsniper'&&r.after.cur==='specsniper'&&r.after.vm==='specsniper','T1 开着观战: 槽位/手持/视角模型三者同步为连狙');
ok(r.back.key!=='specsniper'&&r.back.cur===r.back.key&&r.back.vm===r.back.key,'T1 关掉观战: 槽位/手持/视角模型同步还原为该兵种原副武器');
}

// ═════ T2 弃弹传送 (T 键) ═════
function t2(){
console.log('T2 弃弹传送: 弹体静默消失 + 自身瞬移到弹体位置');
const ctx=boot(0);
const setup=vm.runInContext(`(()=>{try{
${START}
player.spectator=true; player.specUsed=true; player.alive=true; player.deployed=true; player.cls=3;
player.pos.set(-100,0,-100); player.yaw=0; player.pitch=0;
player.flying=true; player.flyAero=true; player._aeroSpd=25;
fireLoiter(player, V3(-100,30,-100), V3(0,0,-1));
player.loiter.pos.set(40,26,-60);          // 弹体飞到远处高空
__d=player.loiter;                          // 存引用 (传送后 player.loiter 会清空)
return {has:!!__d, tv:document.getElementById('tvOv').style.display};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`,ctx);
if(typeof setup==='string'){ exc('T2',setup); return; }
ok(setup.has===true&&setup.tv==='block','T2 前置: TV制导中 (巡飞弹已生成 + TV 遮罩已开)');
const d=vm.runInContext('__d',ctx);
const r=vm.runInContext(`(()=>{try{
const ret1=specTeleportToLoiter();
return {ret1, dead:__d.dead, loiter:player.loiter,
px:player.pos.x, py:player.pos.y, pz:player.pos.z,
vx:player.vel.x, vy:player.vel.y, vz:player.vel.z,
flying:player.flying, aero:player.flyAero, aeroSpd:player._aeroSpd,
gh:heightAt(40,-60), tv:document.getElementById('tvOv').style.display,
vmVis:VM.root.visible, ret2:specTeleportToLoiter()};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`,ctx);
if(typeof r==='string'){ exc('T2',r); return; }
ok(r.ret1===true&&r.ret2===false,'T2 T 键触发一次即生效 (无弹时静默返回 false)');
ok(d&&d.dead===true&&r.loiter===null,'T2 巡飞弹立刻消失: dead=true 且 player.loiter 清空 (静默退场, 不爆炸不伤害)');
ok(Math.abs(r.px-40)<0.6&&Math.abs(r.pz+60)<0.6&&r.py>=r.gh-0.01,'T2 自身瞬移到弹体位置 (y 不低于该点地面)');
ok(r.vx===0&&r.vy===0&&r.vz===0,'T2 传送后速度清零 (不带着弹速冲出去)');
ok(r.flying===true&&r.aero===false&&r.aeroSpd===0,'T2 保持当时的飞行状态与视角朝向 (2026-11-07 定身批裁定: 气动中发射即就地切悬停, T 弃弹传送延续的是**悬停**态; H 可再切回气动——旧判据"气动延续"随裁定退役)');
ok(r.tv==='none'&&r.vmVis===true,'T2 TV 遮罩收回 + 第一人称武器模型恢复');
}

// ═════ T3 幽灵坦克: 独立于 tanks 表 / 免伤 / 可驾驶 / 无差别火力 ═════
function t3(){
console.log('T3 幽灵坦克: 不进 tanks 表 (免索敌·免命中) + 免伤 + 上车 + 主炮 team=-1');
const ctx=boot(0);
const r=vm.runInContext(`(()=>{try{
${START}
player.spectator=true; player.alive=true; player.deployed=true; player.team=0; player.cls=3;
const g=specVehEnsureAtBase();
const info0=specVehInfo();
const inTanks=tanks.indexOf(g)>=0, inTrucks=trucks.indexOf(g)>=0, inCombat=combatants.indexOf(g)>=0;
specVehBoard(g);
const bound=player.onVehicle===g, ff=player.ffAll===true, flyOff=player.flying===false;
g.takeDmg(9999,{name:'t',team:1},true);
g.takeDmg(9999,null,false);
const immune=(g.hp===g.maxHp&&g.alive===true);
for(let i=0;i<60;i++) g.update(1/60);            // 行驶 1 秒 (含静态体推挤/悬挂/引擎)
const n0=shells.length; g.cannonCd=0; g.fireCannon();
const sh=shells[shells.length-1];
const shell={team:sh.team,ownerIsPlayer:sh.owner===player,dmg:sh.dmgV,added:shells.length-n0};
g.firePlayerMG(g.aimDir());                      // 同轴机枪: 不抛异常
// 下车 → 解绑 + ffAll 清除
const dis=specVehDismount();
const after={onVeh:player.onVehicle,ff:player.ffAll,vmVis:VM.root.visible,driven:g.playerDriven};
return {info0,inTanks,inTrucks,inCombat,bound,ff,flyOff,immune,shell,dis,after,
pos:{x:g.pos.x,y:g.pos.y,z:g.pos.z}};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`,ctx);
if(typeof r==='string'){ exc('T3',r); return; }
ok(r.info0&&r.info0.spawned===true&&r.info0.alive===true,'T3 观战载具可召唤 (spawned/alive)');
ok(!r.inTanks&&!r.inTrucks&&!r.inCombat,'T3 ★ 不在 tanks/trucks/combatants 表 ⇒ 全库弹丸与索敌天然穿透 (设计根基)');
ok(r.bound===true&&r.ff===true&&r.flyOff===true,'T3 上车: 接管载具 + 置无差别火力标记 + 退出观战飞行');
ok(r.immune===true,'T3 免伤: 反装甲与普通伤害一律无效 (hp/alive 不变)');
ok(r.dis===true&&r.after.onVeh===null&&r.after.ff===false&&r.after.driven===false,'T3 下车: 解绑 + 火力标记清除 + 载具交还');
ok(r.shell.team===-1&&r.shell.ownerIsPlayer===true&&r.shell.dmg===520&&r.shell.added===1,'T3 主炮炮弹 team=-1 (无差别口径) / owner=玩家 / 单发伤害 520');
}

// ═════ T3b 无差别火力: 同一发 team=-1 炮弹对**双方**步兵都造成伤害 ═════
function t3b(){
console.log('T3b 无差别火力: team=-1 炮弹对友军与敌军同样造成伤害');
const ctx=boot(0);
const r=vm.runInContext(`(()=>{try{
${START}
SPAWN_PROT=0; for(const s of combatants) s.protUntil=0;   // 出生保护豁免: 探针不模拟时间, 逐兵清账 (00-config 单源仍是 0.5s)
player.spectator=true; player.alive=true; player.deployed=true; player.team=0;
const ally=combatants.filter(s=>s!==player&&s.alive&&s.team===0)[0];
const foe =combatants.filter(s=>s!==player&&s.alive&&s.team===1)[0];
const shoot=s=>{
s.alive=true; s.hp=100; s.onVehicle=null; s.crouch=false; s.prone=false;
s.pos.set(-140,0,-140); s.pos.y=heightAt(-140,-140);
shells.length=0;
shells.push({pos:V3(-140,s.pos.y+1.0,-146),vel:V3(0,0,150),team:-1,owner:player,life:3,kind:'tank',dmgV:520,trail:0});
for(let i=0;i<12;i++){ updateShells(1/60); if(s.hp<100||!s.alive) break; }
return {hp:Math.round(s.hp),alive:s.alive,left:shells.length};
};
return {ally:shoot(ally),foe:shoot(foe),at:ally.team,ft:foe.team};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`,ctx);
if(typeof r==='string'){ exc('T3b',r); return; }
ok(r.at===0&&r.ft===1,'T3b 前置: 取到同队(0)与敌队(1)各一名目标');
ok(r.ally.hp<100||!r.ally.alive,'T3b ★ 友军同样吃伤害 (旧口径下同队免伤)');
ok(r.foe.hp<100||!r.foe.alive,'T3b ★ 敌军照常吃伤害 (无差别火力对双方一致)');
}

// ═════ T4 弹丸穿透 (★): 幽灵坦克挡不住炮弹, 普通坦克照挡 ═════
function t4(){
console.log('T4 弹丸穿透 ★: 幽灵坦克身后的坦克被命中 / 换成普通坦克则被它挡住 (阴性对照)');
const ctx=boot(0);
const r=vm.runInContext(`(()=>{try{
${START}
player.spectator=true; player.alive=true; player.deployed=true; player.team=0;
const g=specVehEnsureAtBase();
const rear=tanks.filter(t=>t.alive)[0];
const blocker=tanks.filter(t=>t.alive&&t!==rear)[0];
const put=(t,x,z)=>{ t.pos.set(x,0,z); t.pos.y=heightAt(x,z); t.hp=t.maxHp; };
const passThrough=(blockerIsGhost)=>{
shells.length=0;
put(rear,-140,-140);
if(blockerIsGhost){ g.pos.set(-140,0,-124); g.pos.y=heightAt(-140,-124); }
else put(blocker,-140,-124);
const y=heightAt(-140,-140)+1.0;                       // 弹道高度: 穿过车体中部
shells.push({pos:V3(-140,y,-108),vel:V3(0,0,-150),team:-1,owner:player,life:3,kind:'tank',dmgV:520,trail:0});
for(let i=0;i<20;i++){ updateShells(1/60); if(rear.hp<rear.maxHp) break; }
return {rearHit:rear.hp<rear.maxHp,
blockerHit:blockerIsGhost?(g.hp!==g.maxHp||!g.alive):(blocker.hp<blocker.maxHp),
ghostOk:(g.hp===g.maxHp&&g.alive===true),left:shells.length};
};
const ghost=passThrough(true);
const real =passThrough(false);
return {ghost,real,inTanks:tanks.indexOf(g)>=0};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`,ctx);
if(typeof r==='string'){ exc('T4',r); return; }
ok(!r.inTanks,'T4 前置: 幽灵坦克确实不在 tanks 表里');
ok(r.ghost.rearHit===true,'T4 ★ 幽灵坦克挡不住炮弹: 它身后的坦克照样被命中');
ok(r.ghost.ghostOk===true,'T4 ★ 穿过幽灵坦克的炮弹对它零影响 (免伤 + 无碰撞)');
ok(r.real.blockerHit===true&&r.real.rearHit===false,'T4 阴性对照: 同一几何换成普通坦克 ⇒ 炮弹被它挡住, 后车毫发无伤 (断言对该几何敏感)');
}

// ═════ T5 观战飞行中左键开火 (两种飞行状态) ═════
function t5(){
console.log('T5 观战飞行中开火: 悬停飞行 / 气动飞行 左键均能打出子弹');
const ctx=boot(0);
const r=vm.runInContext(`(()=>{try{
${START}
player.spectator=true; player.alive=true; player.deployed=true; player.team=0; player.cls=3;
selectedSpawn=-1; deployPlayer();
player.curSlot=1; player.curW=player.slots[1]; VM.key=player.curW.key; VM.state='idle';
player.pos.set(-60,60,-60); player.pitch=0;
const fire=(aero)=>{
player.flying=true; player.flyAero=aero; player._aeroSpd=13; player._flyT=0;
mouseDown=false;
updatePlayer(0.05); updatePlayer(0.05);        // 让"观战弹药每0.5s回满"先跑一轮 → 满匣
VM.state='idle'; player.fireT=0;               // 沙箱不跑 updateViewModel: 手动把视角模型状态复位 (真机由它自己收尾)
const mag0=player.curW.mag;
mouseDown=true;
updatePlayer(0.05);
const mag1=player.curW.mag, fireT=player.fireT;
mouseDown=false;
updatePlayer(0.05);
return {mag0,mag1,fired:mag1<mag0,fireT};
};
const hover=fire(false);
const aero =fire(true);
return {hover,aero,weapon:player.curW.key};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`,ctx);
if(typeof r==='string'){ exc('T5',r); return; }
ok(r.weapon==='specsniper','T5 前置: 观战副武器位为观战连狙');
ok(r.hover.mag0===20&&r.hover.fired===true&&r.hover.fireT>0,'T5 ★ 悬停飞行中左键开火 (弹匣 -1 且射速冷却启动)');
// 注: 沙箱里 nowT 只被 loop() 推进一步后冻结, 故"每0.5s回满"只会在首次调用触发一次 ——
// 这里断言 fired (弹匣 -1) 而非固定满匣读数
ok(r.aero.mag0>=1&&r.aero.fired===true&&r.aero.fireT>0,'T5 ★ 气动飞行中左键开火 (与悬停同一份开火单源)');
}

// ═════ T6 坦克炮弹判定增大 (+0.3m), 反坦克炮弹不受影响 ═════
function t6(){
// ★2026-09-28 阶段三 P1 重写: AT_SHELL_PAD=0.45 落地后"反坦克炮弹仍不命中"的旧阴性对照已被用户裁定推翻
// (加大火箭弹判定) —— 新口径: 0.5m 侧偏下 tank/at 双双命中 (AT 弹判定 ≥ 坦克主炮); 1.2m 侧偏双双不命中
// (判定没有扩到"贴着就算"): 保留外科手术式的分辨力。
console.log('T6 炮弹判定: 0.5m 侧偏 tank/at 双命中 (AT_SHELL_PAD=0.45 生效) / 1.2m 侧偏双不命中');
const ctx=boot(0);
const r=vm.runInContext(`(()=>{
try{
${START}
SPAWN_PROT=0; for(const s of combatants) s.protUntil=0;   // 出生保护豁免: 探针不模拟时间, 逐兵清账 (00-config 单源仍是 0.5s)
const R=SHELL_R, P=typeof AT_SHELL_PAD!=='undefined'?AT_SHELL_PAD:0;
const foe=combatants.filter(s=>s.alive&&s.team===1)[0];
foe.alive=true; foe.hp=100; foe.crouch=false; foe.prone=false;
foe.pos.set(-140,40,-140); foe.pos.y=40;             // 悬空摆设: 排除地形干扰, 只验判定体
const shot=(kind,offX)=>{
shells.length=0;
foe.hp=100; foe.alive=true;
shells.push({pos:V3(-140+offX,41,-146),vel:V3(0,0,150),team:0,owner:null,life:3,kind,dmgV:300,trail:0});
for(let i=0;i<12;i++){ updateShells(1/60); if(shells.length===0) break; }
return {hit:shells.length===0,hp:Math.round(foe.hp),left:shells.length};
};
const tank05=shot('tank',0.5), at05=shot('at',0.5);
const tank12=shot('tank',1.2), at12=shot('at',1.2);
return {R,P,tank05,at05,tank12,at12};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`,ctx);
if(typeof r==='string'){ exc('T6',r); return; }
ok(r.R===0.3,'T6 SHELL_R = 0.3m (单源常量)');
ok(r.P===0.45,'T6 AT_SHELL_PAD = 0.45m (2026-09-28 阶段三 P1, 单源常量)');
ok(r.tank05.hit===true,'T6 ★ 坦克炮弹: 侧偏 0.5m 的近失弹判定为命中 (旧 0.38 半径判不中)');
ok(r.at05.hit===true&&r.at05.hp<100,'T6 ★ 反坦克炮弹: 同几何 0.5m 侧偏**也命中并掉血** (AT_SHELL_PAD=0.45, 用户裁定"加大火箭弹判定")');
ok(r.tank12.hit===false&&r.at12.hit===false&&r.tank12.hp===100&&r.at12.hp===100,'T6 阴性对照: 1.2m 侧偏下 tank/at 双双不命中 ⇒ 判定外扩有界, 不是无差别吸附');
}

// ═════ T7 生命周期: 收车/再召唤/换局退场 ═════
function t7(){
console.log('T7 生命周期: specVehReset 收车 (摘出 world) → 再召唤复位 → 换局退场接线');
const ctx=boot(0);
const r=vm.runInContext(`(()=>{try{
${START}
player.spectator=true; player.alive=true; player.deployed=true; player.team=0;
const g=specVehEnsureAtBase();
specVehBoard(g);
const inWorld0=world.children.indexOf(g.grp)>=0;
specVehReset();
const info1=specVehInfo();
const inWorld1=world.children.indexOf(g.grp)>=0;
const unbound=(player.onVehicle===null&&player.ffAll===false);
const g2=specVehEnsureAtBase();
const info2=specVehInfo();
updateSpecVeh(0.016);
const bp=basePos(0);
// 换局退场接线: retireMatchActors 之后幽灵载具必须被收回 (世界还原会摘除快照之外的场景对象)
retireMatchActors();
const info3=specVehInfo();
const inWorld3=world.children.indexOf(g.grp)>=0;
return {inWorld0,info1,inWorld1,unbound,info2,same:g2===g,
atBase:{x:Math.round(g2.pos.x),z:Math.round(g2.pos.z),bx:Math.round(bp.x-(0===0?15:-15)),bz:Math.round(bp.z)},
info3,inWorld3};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`,ctx);
if(typeof r==='string'){ exc('T7',r); return; }
ok(r.inWorld0===true,'T7 召唤后幽灵坦克挂在 world 上 (可渲染)');
ok(r.info1&&r.info1.spawned===false&&r.info1.alive===false&&r.inWorld1===false,'T7 specVehReset: 收车 —— 摘出 world + spawned/alive 复位');
ok(r.unbound===true,'T7 收车同时解绑玩家 (onVehicle 清空 + ffAll 清除)');
ok(r.info2&&r.info2.spawned===true&&r.info2.alive===true&&r.same===true,'T7 再召唤: 同一实例复位可再用 (不新建对象)');
ok(r.atBase.x===r.atBase.bx&&r.atBase.z===r.atBase.bz,'T7 待用位 = 本方主基地后方 15m (与坦克出生带不重叠)');
// 2026-09-21 A#4 契约C 改判 (Lead 核可): 旧断言读 info3.spawned===false —— 那是"实例还在、只是标记复位"的旧口径;
//   本批把"下车/换局收车"统一到 specVehStow() (SPECVEH=null + 摘 grp), specVehInfo() 于是返回 null, 旧读法永远拿不到对象。
//   断言意图 ("新一局不残留白车") 实际**更强**地成立: 判据改为"场景层没有这台车" = SPECVEH===null 或 grp 不在 world, 二者任一。
ok(r.info3===null||r.inWorld3===false,'T7 换局退场接线: retireMatchActors 收车 ⇒ specVehInfo()===null 或 grp 已摘出 world (新一局不残留白车; 比旧口径更强: 场景里根本没有这台车)');
}

// ═════ T8 接线静态断言 (防"改了代码忘了接线") ═════
function t8(){
console.log('T8 接线静态断言: index.html 脚本/版本戳 + 四处关键接线');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const idx=read('index.html'), hud=read('js/22-hud.js'), inp=read('js/19-input.js'),
pl=read('js/20-player.js'), main=read('js/24-main.js'), dep=read('js/23-deploy.js'),
cfg=read('js/00-config.js'), ghost=read('js/15c-specveh.js'), i18n=read('js/00b-i18n.js');
ok(idx.indexOf('js/15c-specveh.js')>=0,'T8 index.html 已引入 js/15c-specveh.js');
const vers=(idx.match(/\?v=([0-9a-z]+)/g)||[]).map(s=>s.slice(3));
ok(vers.length>30&&vers.every(v=>v===vers[0])&&idx.indexOf("__sfStyleVer='"+vers[0]+"'")>=0,'T8 index.html 版本戳统一且与 __sfStyleVer 一致 ('+vers[0]+', '+vers.length+' 处)');
// ★2026-09-30 Ctrl+F5 事故 (three/cannon 原走 jsdelivr CDN: 硬刷新连同 CDN 一起绕缓存重拉, CDN 抽风 ⇒
//   THREE 未定义 ⇒ 脚本链首用即抛 ⇒ bootFail 黑屏+HUD 全裸): 依赖库必须本地 lib/, 禁止改回外链。
ok(idx.indexOf('cdn.jsdelivr')<0&&idx.indexOf('lib/three.min.js?v=')>=0&&idx.indexOf('lib/cannon.min.js?v=')>=0,'T8 ★ three/cannon 已本地化 lib/ (禁止外链 CDN — 2026-09-30 bootFail 事故回归守卫)');
// ★2026-09-26H 观战批改判 (用户圈定修复 #15/C2): 观战者**不再指挥小队** —— T 只保留"控弹时弃弹传送",
//   非控弹的进攻标记与 Y 跟随都改为"不指挥小队"提示 (旧断言"其余仍是小队标记"正是被本批有意推翻的行为)。
ok(inp.indexOf("if(e.code==='KeyT'){")>=0&&inp.indexOf('specTeleportToLoiter();')>=0
	&&inp.indexOf('观战模式 · 不指挥小队')>=0&&inp.indexOf('}else squadOrderMove();')>=0,
	'T8 19-input: T 键观战态只保留弃弹传送 (非控弹与 Y 键改为提示, 非观战仍走原小队指令)');
ok(inputWired(inp),'T8 19-input: C 键车长镜同时认 tank 与 ghost');
ok(pl.indexOf('if(p.flying){ p.stamina=1; specFlightMove(p,dt); playerFireTick(dt,true);')>=0,'T8 20-player: 观战飞行分支接入开火单源 (锚随 2026-10-06 体能批: 飞行分支补观战恒满 p.stamina=1, 语义不变)');
ok(pl.indexOf('function playerFireTick(dt,canFire)')>=0&&pl.indexOf('playerFireTick(dt,!p.sprinting&&p.bandaging<=0&&!p.swim)')>=0,'T8 20-player: 开火单源同时被地面分支复用 (2026-09-18 追加游泳闸门 !p.swim)');
// 2026-09-21 A#4 契约C 改判 (Lead 核可): 语义统一为 **F = 在当前位置召唤并直接上车** (一句文案),
//   旧的"4.5m 内才进车 / 两义文案"已被本批有意推翻 ⇒ 判据换成新语义, 但仍然守住"F 键真的能召唤并上车":
//   召唤入口 specVehSummon() + 上车 specVehBoard(...) 必须都在, 且提示文案是那唯一一句新文案。
//   (功能回归由 T9 的"随处召唤: 远地按 F 车即到身旁并直接上车"实测兜底。)
ok(pl.indexOf("player.onVehicle.kind==='ghost'")>=0&&pl.indexOf('specVehSummon()')>=0&&pl.indexOf('specVehBoard(')>=0
	&&pl.indexOf('召唤并进入幽灵坦克')>=0&&pl.indexOf('specVehNear(player.pos.x,player.pos.z,4.5)')<0,
	'T8 20-player: F 键 = 召唤即上车 (specVehSummon + specVehBoard) + 单一新文案; 旧 4.5m 判据与两义文案已移除');
// ★2026-09-27I 改判: 主循环改挂 `updateSpecVeh(vdt(...))` —— 幽灵坦克是观战者坐驾 ⇒ 时停下它跟本体同速
//   (vdt = 24-main 的逐台座驾帧长解析器)。判据随之换成新形态, 仍然守住"主循环每帧挂 updateSpecVeh"。
ok(main.indexOf('updateSpecVeh(vdt(')>=0&&main.indexOf('typeof updateSpecVeh===\'function\'')>=0,'T8 24-main: 主循环挂 updateSpecVeh (经 vdt 逐台判座驾)');
// ★2026-09-26H 观战批改判 (用户裁定"开局的时候幽灵坦克不出现, 只在按下 F 的时候按需出现" + 圈定修复 #2/A2):
//   23-deploy 里"预置白车 + 「观战载具」出生项"整段已删除 ⇒ 旧判据换成**新语义的两条闸门**:
//     · 出生列表: 观战者的 tank/plane 项置灰并注明「观战不可征用」
//       ★2026-09-27I 补: 舰艇/两栖车**一并置灰** (用户追补"观战模式仍能选几个海战相关载具") —— 本判据只看
//       "闸门还在 + 文案还在", 逐类覆盖由 verify-specbatch T2 实测 (它自带"普通玩家照常可选"的阴性对照);
//     · 幽灵坦克: 不在列表里, 唯一入口是 F (specVehSummon) —— 由 T9 实测兜底。
ok(dep.indexOf('function applySpectatorLoadout()')>=0&&dep.indexOf('观战不可征用')>=0
	&&dep.indexOf('const specBlocked=')>=0&&dep.indexOf("id:'G'")<0&&dep.indexOf('specVehEnsureAtBase(')<0,
	'T8 23-deploy: 出生列表观战闸门 (真载具置灰) + 观战换装函数; 幽灵坦克出生项与预置调用已移除');
ok(hud.indexOf("player.onVehicle.kind==='ghost'")>=0&&hud.indexOf('specVehReset')>=0,'T8 22-hud: 幽灵坦克 HUD 分支 + 换局收车接线');
ok(cfg.indexOf("player.spectator&&ws.length>1")>=0,'T8 00-config: playerClassWeapons 观战换装单源');
ok(ghost.indexOf('tanks.push')<0&&ghost.indexOf('trucks.push')<0,'T8 15c-specveh: 不向 tanks/trucks 注册 (穿透与免索敌的结构保证)');
ok(i18n.indexOf("'观战连狙':'Spectator Auto Sniper'")>=0&&i18n.indexOf("'幽灵坦克':'Ghost Tank'")>=0,'T8 00b-i18n: 新增词条双语齐备');
}
// ═════ T9 按需召唤 (2026-09-17 二修 → ★2026-09-26H 改判: 开场不预置, F 才显形) ═════
function t9(){
console.log('T9 幽灵坦克按需召唤: 部署不预置 (用户的"开场不出现") + 随处 F 召唤即上车');
const ctx=boot(0);
const r=vm.runInContext(`(()=>{try{
${START}
player.spectator=true; player.alive=true; player.deployed=true; player.team=0; player.cls=3;
// ① 部署不预置: 选普通出生点 (selectedSpawn=-1) 部署后, 场上**没有**幽灵坦克实例
selectedSpawn=-1;
deployPlayer();
const pre={info:specVehInfo(),inWorld:(typeof SPECVEH!=='undefined'&&!!SPECVEH)};
// ② 随处召唤: F 唯一入口 (tryInteract ③) → 车立刻在身旁并直接上车
tryInteract();
const g=(typeof SPECVEH!=='undefined')?SPECVEH:null;
const d1=g?Math.hypot(g.pos.x-player.pos.x,g.pos.z-player.pos.z):-1;
const bound=!!(g&&player.onVehicle===g), ff=player.ffAll===true;
// ③ 再部署 ⇒ 收车 (场上不留白车)
deployPlayer();
const post={inWorld:(typeof SPECVEH!=='undefined'&&!!SPECVEH),info:specVehInfo()};
return {pre,spawned:g?g.spawned:null,d1:+d1.toFixed(2),bound,ff,post};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`,ctx);
if(typeof r==='string'){ exc('T9',r); return; }
ok(r.pre.info===null&&r.pre.inWorld===false,'T9 ★ 部署不再预置幽灵坦克: 场上没有白车 (开门第一眼与普通战场一致)');
ok(r.spawned===true&&r.bound===true&&r.d1<8&&r.ff===true,'T9 ★ 按 F 按需召唤: 车在身旁显形并直接上车 ('+r.d1+'m)');
ok(r.post.inWorld===false&&r.post.info===null,'T9 再部署即收车: 下次召唤是全新就位 (场上不留白车)');
}
function inputWired(src){
return src.indexOf("player.onVehicle.kind==='tank'||player.onVehicle.kind==='ghost'")>=0;
}

// ── 主流程 ──
t1(); t2(); t3(); t3b(); t4(); t5(); t6(); t7(); t8(); t9();
console.log('\n通过 '+PASS.length+' 项, 失败 '+FAILS+' 项');
process.exit(FAILS?1:0);
