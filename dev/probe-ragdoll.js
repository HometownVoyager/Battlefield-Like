// ─────────────────────────────────────────────
// dev/probe-ragdoll.js —— 布娃娃地形交互探针 (不进 Index.html)
// 用法: node dev/probe-ragdoll.js [战役序号...]   (默认抽查 平原/高山/黄土沟壑)
// 依赖: dev/_cannon.js (cannon@0.6.2 官方构建拷贝, 与 index.html CDN 同版本)
// 目的: 坡地/高地死亡尸体起飞 BUG 的复现与回归 ——
//       ①生成即检: 头盔-头部初始约束间距应为 hy2 (~0.16m), 而非 p.y+hy2 (p.y 被双重累加);
//       ②落地行为: 平地/中坡/陡坡各若干试次, 统计最大升空高度/最大|vy|/单帧上移/滞空帧,
//          任一试次后期 (0.75s 后) 悬空>0.6m 或升空>1.2m 判为起飞。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const CANNON=require(path.join(__dirname,'_cannon.js'));
// ── 通用小桩 (与 probe-bots.js 同源) ──
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
// ── THREE 桩 (与 probe-bots.js 同源, 只保留 ragdoll 用到的子集) ──
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
class Obj3{constructor(){this.position=new V3();this.rotation=new Euler();this.scale=new V3(1,1,1);this.quaternion={x:0,y:0,z:0,w:1,set(){return this;},copy(v){this.x=v.x;this.y=v.y;this.z=v.z;this.w=v.w;return this;},setFromUnitVectors(){return this;}};this.children=[];this.visible=true;this.castShadow=false;this.receiveShadow=false;this.renderOrder=0;this.matrix={};this.userData={};this.material=null;this.geometry=null;}
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
const _mat=cls=>{ return class extends cls{constructor(o){super();Object.assign(this,o||{});this.color=_wrapColor(this.color);}dispose(){}clone(){ return new this.constructor(Object.assign({},this,{color:this.color})); }}; };
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
AmbientLight:class extends Obj3{constructor(c,i){super();this.intensity=i;this.color=new _Color(c);this.target=new Obj3();}},
HemisphereLight:class extends Obj3{constructor(a,b,i){super();this.intensity=i;}},
PointLight:class extends Obj3{},
Box3:class{setFromObject(){return this;}expandByObject(){return this;}},
Clock:class{getDelta(){return 0;}},
Matrix4:class{compose(){return this;}makeRotationFromEuler(){return this;}},
MathUtils:{clamp:(v,a,b)=>v<a?a:(v>b?b:v)},
RepeatWrapping:1000,DoubleSide:2,BackSide:1,FrontSide:0,SRGBColorSpace:'srgb',NoToneMapping:0,
PCFSoftShadowMap:2,PCFShadowMap:1,BasicShadowMap:0,NearestFilter:0,LinearFilter:1,
};
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
window.CANNON=CANNON; // ragInit 依赖 window.CANNON (与浏览器 CDN 加载同版本)
// 可播种 PRNG: 探针结果可复现 (游戏用 Math.random, 试次 outcome 受序列影响; PROBE_RAG_SEED 换种子扫方差)
let __rs=(parseInt(process.env.PROBE_RAG_SEED)||0xC0FFEE)>>>0;
const __rand=()=>{ __rs=(__rs+0x6D2B79F5)>>>0; let t=__rs; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; };
const sandbox={
console,Math:Object.assign(Object.create(Math),{random:__rand}),JSON,performance:{now:()=>Date.now()},
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
sandbox.CANNON=CANNON; // 浏览器里 window.CANNON 即全局; vm 沙箱需显式放进全局作用域
// ── 逐脚本加载 (与 probe-bots.js 同源) ──
function load(ctx,file){ vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file}); }
function boot(campIdx){
const byIdx={};for(const k in byId)delete byId[k];
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document;ctx.window=window;
ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
const files=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/23-deploy.js','js/24-main.js'];
for(const f of files) load(ctx,f);
return ctx;
}
// ── 测试点扫描: 平地 / 中坡 / 陡坡 (按 heightAt 梯度) ──
const SCAN_FN=`(()=>{
const R=(MAP_SIZE||300)/2;
const found={flat:null,mid:null,steep:null};
for(let x=-R*0.92;x<=R*0.92;x+=5){
for(let z=-R*0.92;z<=R*0.92;z+=5){
if(occBlocked(x,z)) continue;
const e=2;
const dhx=(heightAt(x+e,z)-heightAt(x-e,z))/(2*e);
const dhz=(heightAt(x,z+e)-heightAt(x,z-e))/(2*e);
const g=Math.hypot(dhx,dhz);
const h=heightAt(x,z);
if(!found.flat&&g<0.05) found.flat={x:+x.toFixed(1),z:+z.toFixed(1),g:+g.toFixed(3),h:+h.toFixed(1)};
if(!found.mid&&g>0.28&&g<0.45) found.mid={x:+x.toFixed(1),z:+z.toFixed(1),g:+g.toFixed(3),h:+h.toFixed(1)};
if(g>0.6&&(!found.steep||h>found.steep.h)) found.steep={x:+x.toFixed(1),z:+z.toFixed(1),g:+g.toFixed(3),h:+h.toFixed(1)};
}
}
// 各点 8m 内的碰撞盒数 (排查 ragCollide 参与)
for(const k of ['flat','mid','steep']){
if(!found[k]) continue;
const s=found[k];
s.boxes=BOXES.filter(b=>!b.dead&&Math.max(Math.abs(b.minX-s.x),Math.abs(b.maxX-s.x))<8&&Math.max(Math.abs(b.minZ-s.z),Math.abs(b.maxZ-s.z))<8).length;
}
return found;
})()`;
// ── 单点试次: 生成布娃娃, 推演 4s, 统计升空/上抛/滞空 ──
const TRIAL_FN=`(function trial(sp,seed){
// 确定性随机: 覆盖 rand() 的全局序列前先记基准
while(RAG.list.length) removeRagdoll(RAG.list[RAG.list.length-1]);
if(globalThis.__noRagCollide) ragCollide=function(){}; // A/B 诊断: 禁用建筑推离
const bot={pos:V3(sp.x,heightAt(sp.x,sp.z),sp.z),vel:V3((seed%2)?1.8:0,0,(seed%3)?-1.2:0),yaw:seed*1.13,team:seed%2,prone:false,crouch:false,name:'探针'+seed};
const attacker=(seed%2===0)?{pos:V3(sp.x+3.2,0,sp.z+4.1),name:'射手'}:null; // 一半试次有命中方向冲量
const r=spawnRagdoll(bot,attacker,seed%4===3); // 每4次一次爆头
if(!r) return {fail:'CANNON 不可用'};
// 生成即检: 头盔与头的初始约束间距 (应≈hy2)
let helmGap=null;
if(r.parts.length>7){
const head=r.parts[2].body, helm=r.parts[7].body;
helmGap=+(helm.position.y-head.position.y).toFixed(3);
}
const m={helmGap,maxLift:0,maxVy:0,maxUpVy:0,upVyFrame:-1,upVyPart:-1,maxJump:0,airFrames:0,launch:false,trace:[],climb:0,climbProf:[],traceDump:globalThis.__traceDump?[]:null};
const prevY=r.parts.map(p=>p.body.position.y);
const pel0={x:r.parts[0].body.position.x,z:r.parts[0].body.position.z};
let pelG; // 坡向单位向量 (出生点)
{
const e=2;
const gx=(heightAt(pel0.x+e,pel0.z)-heightAt(pel0.x-e,pel0.z))/(2*e);
const gz=(heightAt(pel0.x,pel0.z+e)-heightAt(pel0.x,pel0.z-e))/(2*e);
const gl=Math.hypot(gx,gz)||1;
pelG={x:gx/gl,z:gz/gl};
}
const climbOf=b=>+((b.position.x-pel0.x)*pelG.x+(b.position.z-pel0.z)*pelG.z).toFixed(2); // 正值=逆坡爬升 (梯度指向上坡方向)
for(let f=0;f<240;f++){
updateRagdolls(1/60);
let lift=0,vy=0;
for(let k=0;k<r.parts.length;k++){
const b=r.parts[k].body;
const l=b.position.y-heightAt(b.position.x,b.position.z)-r.parts[k].hy;
if(l>lift) lift=l;
if(Math.abs(b.velocity.y)>vy) vy=Math.abs(b.velocity.y);
// 0.6s 后仍出现的向上速度 = 求解器弹射签名 (初始弹跳≤3.5/爆头+2.2/落地反弹0.25×都在窗口外)
if(f>36&&b.velocity.y>m.maxUpVy){ m.maxUpVy=b.velocity.y; m.upVyFrame=f; m.upVyPart=k; }
if(b.position.y-prevY[k]>m.maxJump) m.maxJump=b.position.y-prevY[k];
prevY[k]=b.position.y;
}
// 指标只看倒塌后 (0.75s 起): 站立姿态本身离地 1-1.8m, 不能算升空
if(f>45){
if(lift>m.maxLift) m.maxLift=lift;
if(f%60===15) m.trace.push(+lift.toFixed(2));
}
if(vy>m.maxVy) m.maxVy=vy;
if(f>45&&lift>0.6) m.airFrames++;
if(f===90||f===150||f===210||f===239) m.climbProf.push(+climbOf(r.parts[0].body).toFixed(1));
if(m.traceDump&&f%10===0){
let cx=0,cz=0,cy=0,mx=0,mv='';
for(const p2 of r.parts){
cx+=p2.body.position.x/r.parts.length; cz+=p2.body.position.z/r.parts.length; cy+=p2.body.position.y/r.parts.length;
const hv=Math.hypot(p2.body.velocity.x,p2.body.velocity.z);
if(hv>mx){ mx=hv; mv=p2.body.velocity.x.toFixed(1)+','+p2.body.velocity.y.toFixed(1)+','+p2.body.velocity.z.toFixed(1); }
}
m.traceDump.push({f, pelX:+r.parts[0].body.position.x.toFixed(2), pelZ:+r.parts[0].body.position.z.toFixed(2), comY:+cy.toFixed(2), upCl:climbOf(r.parts[0].body), maxHV:+mx.toFixed(2), maxV:mv});
}
}
// 坡向位移: 骨盆相对出生点的逆坡爬升 (正值=逆坡; 顺坡翻滚下滑属正常物理, 不判罚)
m.climb=climbOf(r.parts[0].body);
// 判定: 0.6s 后仍有 >6m/s 向上速度 (约束弹射签名: 初始弹跳≤3.5/爆头+2.2/落地反弹0.25×/顺坡下坠均为负向),
// 或骨盆真逆坡爬升 >4m (正常散布冲量为随机方向, 平地参考±3m)
m.launch=(m.maxUpVy>6||m.climb>4);
removeRagdoll(r);
m.maxLift=+m.maxLift.toFixed(2); m.maxVy=+m.maxVy.toFixed(1); m.maxJump=+m.maxJump.toFixed(2);
return m;
})`;
// ── 单战役入口 ──
function runCampaign(i){
const ctx=boot(i);
const start=vm.runInContext(`(()=>{const btn=document.getElementById('startBtn'); if(btn&&btn.onclick){btn.onclick();return {ok:true};} return {ok:false};})()`,ctx);
if(!start.ok) return {fail:'开局失败'};
if(process.env.PROBE_RAG_NORAGCOLLIDE==='1') vm.runInContext('globalThis.__noRagCollide=true',ctx);
if(process.env.PROBE_RAG_TRACE==='1') vm.runInContext('globalThis.__traceDump=true',ctx);
const spots=vm.runInContext(SCAN_FN,ctx);
ctx.__trial=vm.runInContext(`(()=>{const trial=${TRIAL_FN}; return trial;})()`,ctx);
const out={camp:vm.runInContext('CAMPAIGNS['+i+'].id',ctx), spots:{}, bad:0};
const ctxTrial=(sp)=>{
const trials=[];
for(let s=1;s<=6;s++) trials.push(ctx.__trial(sp,s));
const launches=trials.filter(t=>t.launch).length;
const gaps=[...new Set(trials.map(t=>t.helmGap))];
const worst=trials.reduce((a,b)=>b.maxUpVy>a.maxUpVy?b:a,trials[0]);
return {gaps:gaps.join('/'), launches:launches+'/6', maxUpVy:worst.maxUpVy, upVyAt:worst.upVyFrame+'f/p'+worst.upVyPart, climb:worst.climb, climbProf:worst.climbProf.join(','), maxLift:worst.maxLift, maxVy:worst.maxVy, maxJump:worst.maxJump, air:worst.airFrames, trace:worst.trace.join(','), fail:worst.fail, traceDump:worst.traceDump};
};
for(const key of ['flat','mid','steep']){
const sp=spots[key];
if(!sp){ out.spots[key]='(未找到)'; continue; }
const r=ctxTrial(sp);
if(r.traceDump&&r.traceDump.length){
console.log('--- 逐帧追踪 (10f 采样) ---');
for(const t of r.traceDump) console.log(JSON.stringify(t));
}
out.spots[key]={...sp,...r};
if(r.launches&&parseInt(r.launches)>0) out.bad++;
}
return out;
}
// ── 入口: 默认抽查 平原0 / 高山6 / 黄土沟壑 loess (按 terr 名匹配) ──
const idxs=process.argv.slice(2).map(Number).filter(n=>!isNaN(n));
let camps=[];
if(idxs.length) camps=idxs;
else{
const probe=boot(0);
const total=vm.runInContext('CAMPAIGNS.length',probe);
const all=vm.runInContext('CAMPAIGNS.map(c=>c.terr)',probe);
camps=[];
for(let i=0;i<total;i++) if(['rolling','alpine','loess'].includes(all[i])) camps.push(i);
if(!camps.length) camps=[0];
}
let bad=0;
console.log('== 布娃娃地形探针 ( helmetGap 应≈0.13-0.19; launches 应=0/6 ) ==');
for(const i of camps){
const r=runCampaign(i);
if(r.fail){ console.log(`#${i} FAIL ${r.fail}`); bad++; continue; }
for(const key of ['flat','mid','steep']){
const s=r.spots[key];
if(typeof s==='string'){ console.log(`#${i} ${r.camp} ${key}: ${s}`); continue; }
const flag=s.launches&&parseInt(s.launches)>0?' ✗':' ✓';
if(s.launches&&parseInt(s.launches)>0) bad++;
console.log(`#${i} ${r.camp} ${key}(坡度=${s.g} 海拔=${s.h}) 头盔gap=${s.gaps} 起飞=${s.launches} 后期上抛=${s.maxUpVy}(${s.upVyAt}) 逆坡爬升=${s.climb}m 剖面=[${s.climbProf}] 最大升空=${s.maxLift}m 最大|vy|=${s.maxVy} 滞空帧=${s.air} 轨迹=[${s.trace}]${flag}`);
}
}
console.log(bad===0?'\n布娃娃探针全过 ✓':'\n布娃娃探针存在起飞 ✗');
process.exit(bad===0?0:1);
