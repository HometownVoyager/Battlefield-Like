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
const files=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/23-deploy.js','js/23b-worldrestore.js','js/24-main.js'];
for(const f of files) load(ctx,f);
return ctx;
}
// ── 断言收集 ──
const PASS=[];let FAILS=0;
function ok(cond,label){
if(cond){ PASS.push(label); console.log('  ✔ '+label); }
else { FAILS++; console.log('  ✘ '+label); }
}
// ─────────────────────────────────────────────
// dev/verify-structscore.js —— 地图可破坏物得分沙箱 (不进 Index.html)
// 用法: node dev/verify-structscore.js
// 原理: 复用 verify-wipe 的加载器 (THREE/DOM/WebAudio 桩) 载入全部真实脚本 (含 23b 世界还原),
//       直接驱动 damageStructures / destroyStructure 这条唯一的结构破坏入口, 断言 2026-09-26 破坏得分批:
//   T1 一批爆炸打出的多组摧毁 → 记到击毁者账上, 分数按初始血量 (light/big) 求和, 只出一条合并角标;
//   T2 无主爆炸 (attacker 缺省/null, 如雷链/场景物二次爆炸) → 结构照旧被摧毁, 但没有人为之得分;
//   T3 同一组只结算一次 + 空批不弹角标 + 拆墙不进连杀 (killStreakN/Max 一动不动);
//   T4 竖向承重链 (wallAbove) 同归属一次记两组; 世界构建期预塌 (silent) 一组都不记;
//   T5 Bot 击毁 → 分记到 Bot 账上 (同公式), 玩家得分/角标/破坏数一律不动;
//   T6 分档公式单源 (STRUCT_SCORE): 轻/重/未登记血量兜底/g.score 覆盖/cap 上限;
//   T7 观战模式照常计分 (2026-09-16 记录批口径①: 计分照常, 只是本局不进历史记录);
//   T8 结算接线: recMatchValues.demol / REC_STATS 表项 / 新对局复位 / EN 词典五键齐备;
//   T9 世界还原 (23b) 把 hp 写回满值后权重不变, 且还原只发生在新对局/回主菜单 (同一局内不构成刷分面);
//   T10 源码接线: 全库 11 个 damageStructures 调用点逐一带归属 (唯一例外=反坦克雷无主), 未来漏传会被抓。(2026-11-10 跟码: +1=三蟲抓① 飞机撞楼)
// ─────────────────────────────────────────────
'use strict';

// ── 单组摧毁的取分公式 (与 00-config STRUCT_SCORE / 21-match structScoreOf 同式, 探针侧独立重算) ──
const VM=(ctx,expr)=>vm.runInContext(expr,ctx);
const SCORE_OF=`(g)=>{ const SC=STRUCT_SCORE; const hp=(g.hp0>0)?g.hp0:Math.max(0,g.hp||0);
 return Math.min(Math.round((typeof g.score==='number')?g.score:(hp>=SC.bigHp?SC.big:SC.light)),SC.cap); }`;
// 结构破坏前的活组快照 (存引用), 事后用它算"本轮新死掉的组" —— 与实现同样的集合口径 (含链式坍塌带走的组)
const ALIVE=`(()=>DESTRUCTIBLES.filter(g=>!g.dead))()`;
const NEWDEAD=`(snap)=>{ let s=0,n=0; for(const g of snap) if(g.dead){ s+=(${SCORE_OF})(g); n++; } return {s,n}; }`;
const POPS=`document.getElementById('killPops')`;
const POPLAST=`(()=>{ const b=${POPS}; const c=b.children[b.children.length-1]; return c?String(c.innerHTML):''; })()`;
const CLEANHTML=`(s)=>String(s).replace(/<[^>]*>/g,'|')`;

// ═════ T1 记分链 ═════
function t1(){
console.log('T1 一批爆炸的多组摧毁 → 击毁者得分 + 一条合并角标');
const ctx=boot(11); // 11 号图可毁结构最密 (144 组), 才有"一次爆炸拆掉多组"的真实形态
const r=VM(ctx,`(()=>{
const ALIVE=DESTRUCTIBLES.filter(g=>!g.dead);
// 锚点 = 6m 内邻居最多的那一组 (取最密的一簇, 保证一次爆炸真能带走多组)
let a=ALIVE[0], an=-1;
for(const g of ALIVE){ let n=0; for(const h of ALIVE) if(Math.hypot(h.cx-g.cx,h.cz-g.cz)<6) n++; if(n>an){ an=n; a=g; } }
// ★ 2026-09-27N: 命中判据由"组心平面距"改成"到最近成员碰撞盒的三维距离 + 一层楼高的竖直门限"
//   (05-world.boxDist3 / STRUCT_HIT.vGate) ⇒ 爆点必须取**真实落点** = 该组一个成员盒的中心
//   (旧夹具写 {x:g.cx,y:0,z:g.cz}: y=0 在山地/岛屿图上等于"地下十几米起爆", 新判据会正确判它够不着,
//    而它本来测的也不是判据本身, 是"一组爆炸多组摧毁的合并角标"这条记账链)。inR 用独立实现重算, 不调被测函数。
const b0=BOXES[a.bi[Math.floor(a.bi.length/2)]];
const p={x:(b0.minX+b0.maxX)/2,y:(b0.minY+b0.maxY)/2,z:(b0.minZ+b0.maxZ)/2};
const bd=(q,b)=>{ const dx=q.x<b.minX?b.minX-q.x:(q.x>b.maxX?q.x-b.maxX:0);
const dy=q.y<b.minY?b.minY-q.y:(q.y>b.maxY?q.y-b.maxY:0);
const dz=q.z<b.minZ?b.minZ-q.z:(q.z>b.maxZ?q.z-b.maxZ:0); return Math.hypot(dx,dy,dz); };
const inR=ALIVE.filter(g=>{ for(const i of g.bi){ const b=BOXES[i]; if(b&&!b.dead&&bd(p,b)<6) return true; } return false; }).length;
player.score=0; player.demol=0;
const k0=killStreakN, m0=killStreakMax, t0=killStreakT;
const pops0=${POPS}.children.length;
const snap=${ALIVE};
damageStructures(p,3,99999,player);
const d=(${NEWDEAD})(snap);
const box=${POPS};
return {inR,dead:d.n,exp:d.s,score:player.score,demol:player.demol,
 pops:box.children.length-pops0, html:${POPLAST},
 k0,m0,t0,k1:killStreakN,m1:killStreakMax,t1:killStreakT};
})()`);
ok(r.dead>=2,'T1 爆炸在密集簇里一次带走多组 (实测 '+r.dead+' 组)');
ok(r.dead>=r.inR,'T1 摧毁集合覆盖半径内的全部活组 (含链式带走的组: '+r.dead+'/'+r.inR+')');
ok(r.score===r.exp&&r.exp>0,'T1 玩家得分 = 逐组按档位求和 ('+r.score+'/'+r.exp+')');
ok(r.demol===r.dead,'T1 破坏数计数 = 新摧毁组数 ('+r.demol+'/'+r.dead+')');
ok(r.pops===1,'T1 一次爆炸只出一条得分角标 (实测 '+r.pops+' 条)');
ok(r.html.indexOf('+'+r.exp)>=0,'T1 角标分数 = 本批合计 +'+r.exp+' (实测 '+VM(ctx,`(${CLEANHTML})(${JSON.stringify(r.html)})`)+')');
ok(r.html.indexOf('×'+r.dead)>=0,'T1 多组时角标带 ×N (实测 ×'+r.dead+')');
ok(r.k1===r.k0&&r.m1===r.m0&&r.t1===r.t0,'T1 拆墙不进连杀: killStreakN/Max/窗口时间一动不动');
}

// ═════ T1b 大型结构标签 ═════
function t1b(){
console.log('T1b 批内含大型结构 (hp≥bigHp) → 角标改走"摧毁大型结构"文案');
const ctx=boot(11);
const r=VM(ctx,`(()=>{
const SC=STRUCT_SCORE;
const ALIVE=DESTRUCTIBLES.filter(g=>!g.dead);
let a=null, an=-1;
for(const g of ALIVE){ if(g.hp<SC.bigHp) continue; let n=0; for(const h of ALIVE) if(Math.hypot(h.cx-g.cx,h.cz-g.cz)<6) n++; if(n>an){ an=n; a=g; } }
if(!a) return {none:true};
// ★ 2026-09-27N: 爆点取成员盒中心 (同 T1; 旧夹具的 y=0 在新判据下够不着任何跨楼层的件)
const b0=BOXES[a.bi[Math.floor(a.bi.length/2)]];
const p={x:(b0.minX+b0.maxX)/2,y:(b0.minY+b0.maxY)/2,z:(b0.minZ+b0.maxZ)/2};
player.score=0; player.demol=0;
const pops0=${POPS}.children.length;
const snap=${ALIVE};
damageStructures(p,3,99999,player);
const d=(${NEWDEAD})(snap);
return {none:false,bigs:snap.filter(g=>g.dead&&g.hp0>=SC.bigHp).length,exp:d.s,score:player.score,
 pops:${POPS}.children.length-pops0,html:${POPLAST}};
})()`);
if(r.none){ ok(false,'T1b 图内存在 hp≥bigHp 的可毁组 (取到样本)'); return; }
ok(r.bigs>=1,'T1b 本批含大型结构组 ('+r.bigs+' 组)');
ok(r.score===r.exp,'T1b 大型组按 big 档计分 ('+r.score+'/'+r.exp+')');
ok(r.pops===1&&r.html.indexOf('大型')>=0,'T1b 角标文案=摧毁大型结构 (实测 '+VM(ctx,`(${CLEANHTML})(${JSON.stringify(r.html)})`)+')');
}

// ═════ T2 无主不加分 ═════
function t2(){
console.log('T2 无主爆炸 (缺省 attacker): 结构照毁, 无人得分');
const ctx=boot(0);
const r=VM(ctx,`(()=>{
player.score=0; player.demol=0;
const g0=DESTRUCTIBLES.find(g=>!g.dead);
const p={x:g0.cx,y:0,z:g0.cz};
const pops0=${POPS}.children.length;
const snap=${ALIVE};
damageStructures(p,1,99999);            // 第 4 参缺省 = 无主
const d=(${NEWDEAD})(snap);
return {dead:d.n,score:player.score,demol:player.demol,pops:${POPS}.children.length-pops0};
})()`);
ok(r.dead>=1,'T2 无主爆炸照旧摧毁结构 ('+r.dead+' 组)');
ok(r.score===0&&r.demol===0,'T2 无主爆炸不给玩家记分/计数 (score='+r.score+' demol='+r.demol+')');
ok(r.pops===0,'T2 无主爆炸不弹得分角标 (实测 '+r.pops+' 条)');
}

// ═════ T3 每组只结算一次 ═════
function t3(){
console.log('T3 同一组只结算一次 (重复爆炸不再给分, 空批不弹角标)');
const ctx=boot(0);
const r=VM(ctx,`(()=>{
player.score=0; player.demol=0;
const g0=DESTRUCTIBLES.find(g=>!g.dead);
const p={x:g0.cx,y:0,z:g0.cz};
damageStructures(p,1,99999,player);
const once={score:player.score,demol:player.demol,pops:${POPS}.children.length};
const dead0=DESTRUCTIBLES.filter(g=>g.dead).length;
damageStructures(p,1,99999,player);      // 原地再来一发: 该范围已全死
const dead1=DESTRUCTIBLES.filter(g=>g.dead).length;
return {once,score2:player.score,demol2:player.demol,pops2:${POPS}.children.length,dead0,dead1};
})()`);
ok(r.dead1===r.dead0,'T3 第二次爆炸没有新增死组 ('+r.dead0+' → '+r.dead1+')');
ok(r.score2===r.once.score&&r.demol2===r.once.demol,'T3 重复爆炸不再加分 (score 停在 '+r.score2+')');
ok(r.pops2===r.once.pops,'T3 空批不出角标 (角标数停在 '+r.pops2+')');
}

// ═════ T4 链式坍塌 / 预塌 ═════
function t4(){
console.log('T4 竖向承重链同归属记账; 世界构建期预塌 (silent) 不计分');
const ctx=boot(11); // 11 号图有多层建筑 (wallAbove 承重链) 样本
const r=VM(ctx,`(()=>{
player.score=0; player.demol=0;
// ① silent 预塌: 一组照死, 一分不记
const gs=DESTRUCTIBLES.find(g=>!g.dead);
const sc0=player.score, popsA=${POPS}.children.length;
destroyStructure(gs,true,player);
const silentGone=gs.dead===true, silentScore=player.score-sc0, silentPops=${POPS}.children.length-popsA;
// ② 竖向承重链: 带 wallAbove 的墙 → 连同正上方那组一起垮, 两组都记在同一个击毁者头上
const gw=DESTRUCTIBLES.find(g=>!g.dead&&g.wallAbove&&!g.wallAbove.dead);
const up=gw?gw.wallAbove:null;
const sc1=player.score, de1=player.demol, pops1=${POPS}.children.length;
if(gw) destroyStructure(gw,false,player);
return {silentGone, silentScore, silentPops,
 found:!!gw, both:!!gw&&gw.dead&&up.dead, got:player.score-sc1, n:player.demol-de1,
 pops:${POPS}.children.length-pops1, exp:gw?((${SCORE_OF})(gw)+(${SCORE_OF})(up)):0};
})()`);
ok(r.silentGone&&r.silentScore===0&&r.silentPops===0,'T4 预塌 (silent=true) 摧毁结构但不记分不出角标');
ok(r.found,'T4 图内存在带 wallAbove 的承重墙组 (取到样本)');
ok(r.both,'T4 承重链: 上层同面墙随下层一起垮 (实测 both='+r.both+')');
ok(r.got===r.exp&&r.n===2,'T4 链式坍塌两组都记在同一击毁者头上 ('+r.got+'/'+r.exp+', 组数 '+r.n+')');
ok(r.pops===1,'T4 不在爆炸批里的直调摧毁就地出一条角标 (实测 '+r.pops+')');
}

// ═════ T5 Bot 归属 ═════
function t5(){
console.log('T5 Bot 击毁 → 分记到 Bot 账上, 玩家得分/角标/破坏数不动');
const ctx=boot(0);
const r=VM(ctx,`(()=>{
player.score=0; player.demol=0;
const bot={isPlayer:false,team:1,name:'BOT',score:0};
const g0=DESTRUCTIBLES.find(g=>!g.dead);
const p={x:g0.cx,y:0,z:g0.cz};
const pops0=${POPS}.children.length;
const snap=${ALIVE};
damageStructures(p,1,99999,bot);
const d=(${NEWDEAD})(snap);
return {dead:d.n,exp:d.s,bot:bot.score,score:player.score,demol:player.demol,pops:${POPS}.children.length-pops0};
})()`);
ok(r.dead>=1&&r.bot===r.exp,'T5 Bot 得分 = 逐组档位求和 ('+r.bot+'/'+r.exp+')');
ok(r.score===0&&r.demol===0,'T5 Bot 拆楼不计入玩家战果 (score='+r.score+' demol='+r.demol+')');
ok(r.pops===0,'T5 Bot 拆楼不弹玩家屏幕上的得分角标 (实测 '+r.pops+' 条)');
}

// ═════ T6 分档公式单源 ═════
function t6(){
console.log('T6 分档公式: 轻/重/未登记兜底/g.score 覆盖/cap');
const ctx=boot(0);
const r=VM(ctx,`(()=>{
const SC=STRUCT_SCORE, f=${SCORE_OF};
return {light:SC.light, big:SC.big, bigHp:SC.bigHp, cap:SC.cap,
 lightG:f({hp0:230,hp:-5}), bigG:f({hp0:SC.bigHp,hp:-5}), big950:f({hp0:950,hp:-5}),
 fallback:f({hp0:undefined,hp:230}), fallback0:f({hp0:undefined,hp:-3}),
 over:f({hp0:230,score:77}), capped:f({hp0:230,score:5000})};
})()`);
ok(r.lightG===r.light&&r.bigG===r.big&&r.big950===r.big,'T6 轻结构=light / hp≥bigHp=big (230→'+r.lightG+' / '+r.bigHp+'→'+r.bigG+' / 950→'+r.big950+')');
ok(r.fallback===r.light&&r.fallback0===r.light,'T6 未登记初始血量的组按现值兜底, 现值为 0 也不崩 ('+r.fallback+'/'+r.fallback0+')');
ok(r.over===77,'T6 g.score 逐组覆盖生效 (230hp + score:77 → '+r.over+')');
ok(r.capped===r.cap,'T6 单组上限 cap='+r.cap+' (覆盖值 5000 → '+r.capped+')');
}

// ═════ T7 观战照常计分 ═════
function t7(){
console.log('T7 观战模式照常计分 (不进历史记录那条另算)');
const ctx=boot(0);
const r=VM(ctx,`(()=>{
player.spectator=true;
player.score=0; player.demol=0;
const g0=DESTRUCTIBLES.find(g=>!g.dead);
const p={x:g0.cx,y:0,z:g0.cz};
const snap=${ALIVE};
damageStructures(p,1,99999,player);
const d=(${NEWDEAD})(snap);
player.spectator=false;
return {exp:d.s,score:player.score,demol:player.demol};
})()`);
ok(r.score===r.exp&&r.score>0,'T7 观战者拆楼照常得分 ('+r.score+'/'+r.exp+')');
ok(r.demol>0,'T7 观战者破坏数照常累计 ('+r.demol+')');
}

// ═════ T8 结算接线 ═════
function t8(){
console.log('T8 结算接线: recMatchValues / REC_STATS / 新对局复位 / 双词典条');
const ctx=boot(0);
const r=VM(ctx,`(()=>{
player.demol=7; player.score=123;
const vals=recMatchValues();
const stat=REC_STATS.filter(s=>s.key==='demol')[0];
resetPlayerForNewMatch();
return {vals,label:stat?stat.label:null,fmt:stat?stat.fmt(7):null,after:player.demol,
 miss:['摧毁数','摧毁结构','摧毁大型结构','摧毁结构 ×{0}','摧毁大型结构 ×{0}'].filter(k=>I18N_EN[k]===undefined)};
})()`);
ok(r.vals.demol===7,'T8 recMatchValues 带 demol 项 (实测 '+r.vals.demol+')');
ok(r.label==='摧毁数'&&r.fmt==='7','T8 REC_STATS 表项 demol/摧毁数/格式化就位 ('+r.label+' → '+r.fmt+')');
ok(r.after===0,'T8 新对局复位 demol (resetPlayerForNewMatch → '+r.after+')');
ok(r.miss.length===0,'T8 EN 词典五键齐备 (缺: '+(r.miss.join(',')||'无')+')');
}

// ═════ T9 世界还原 ═════
function t9(){
console.log('T9 世界还原 (23b) 后权重不变 + 还原只发生在新对局/回主菜单');
const ctx=boot(0);
const r=VM(ctx,`(()=>{
player.score=0; player.demol=0;
const g0=DESTRUCTIBLES.find(g=>!g.dead);
const p={x:g0.cx,y:0,z:g0.cz};
const snap=${ALIVE};
const ruin0=DESTRUCTIBLES.filter(g=>g.dead).length;   // 开局就塌的废墟 (preDead) —— 还原后应原地保持
damageStructures(p,1,99999,player);
const hit=snap.filter(g=>g.dead);                     // 本轮新拆的组
const w0=hit.map(g=>g.hp0);
const ready=restorePristineWorld();
return {ready:ready===true, n:hit.length,
 back:hit.filter(g=>!g.dead&&g.hp>0).length,
 sameW:hit.every((g,i)=>g.hp0===w0[i]),
 full:hit.every(g=>g.dead===false&&g.hp0===g.hp),
 ruin0, ruin1:DESTRUCTIBLES.filter(g=>g.dead).length};
})()`);
ok(r.ready&&r.back===r.n&&r.n>=1,'T9 还原把本轮拆掉的组写回存活 ('+r.back+'/'+r.n+')');
ok(r.sameW&&r.full,'T9 还原后 hp0 (评分权重) 与满值 hp 一致 —— 重开一局同一组档位不变');
ok(r.ruin1===r.ruin0&&r.ruin0>=1,'T9 开局就塌的历史废墟还原后仍是废墟 (不凭空复活 '+r.ruin0+' 处 preDead 组)');
const src=fs.readFileSync(path.join(root,'js/22-hud.js'),'utf8');
const calls=(src.match(/restorePristineWorld\(\)/g)||[]).length;
ok(calls===2&&/if\(matchOver&&typeof restorePristineWorld==='function'\) restorePristineWorld\(\);/.test(src),
 'T9 全库仅两处还原 (结算后回主菜单 + 就地开新局), 战局中不可达 ⇒ 同一局内没有反复拆同一栋的刷分面 (实测 '+calls+' 处)');
ok(/player\.score=0/.test(src)&&/player\.demol=0/.test(src),'T9 就地开新局与还原同批复位 player.score/demol (还原即清零, 不跨局累计)');
}

// ═════ T10 源码接线 ═════
function t10(){
console.log('T10 源码接线: 11 个 damageStructures 调用点逐一带归属');
const files=['js/13-combat.js','js/15-vehicles.js','js/15d-naval.js','js/16-aircraft.js','js/05-world.js'];
let total=0; const noArg=[];
for(const f of files){
const s=fs.readFileSync(path.join(root,f),'utf8');
const re=/damageStructures\(/g;
let m;
while((m=re.exec(s))){
// 括号配平扫描取本次调用实参 (第一参都是简单标识符 ⇒ 顶层逗号数 = 参数个数)
let i=m.index+m[0].length, depth=1, arg='';
for(;i<s.length&&depth>0;i++){
const c=s[i];
if(c==='(')depth++;
else if(c===')'){ depth--; if(!depth)break; }
arg+=c;
}
const args=arg.trim();
// 05-world 自身是定义处 (参数表), 其余调用点必须带第 4 参 = 归属
const isDef=(f==='js/05-world.js'&&args==='p,radius,amt,attacker');
if(!isDef){
total++;
if(args.split(',').length<4) noArg.push(f+': damageStructures('+args+')');
}
}
}
ok(total===14,'T10 全库非定义处 damageStructures 调用点 = 14 (实测 '+total+') (2026-11-10 跟码: 三蟲抓① 飞机撞楼新调用点; 2026-11-13 批跟码: 残骸坠落扫掠 ageT>0.6 结构伤害新调用点; 2026-11-14 批跟码: 撞楼残骸滑落结构伤害 + 收尾二次爆炸两新调用点)');
ok(noArg.length===1&&/^js\/15-vehicles\.js: damageStructures\(p,5,130\)$/.test(noArg[0]),
 'T10 唯一无归属的调用点 = 反坦克雷 (雷没有 owner 字段), 其余 10 处都传了 owner/thrower (实测 '+JSON.stringify(noArg)+')');
// 2026-09-27N 破坏机制批新增的第 10 处: 油桶连锁引爆 (05-world.barrelBlast) —— 它把触发者的归属透传下去,
// 所以"有主才有分"这条边界不变 (无主爆炸引爆的油桶同样不给任何加分)。
const w5=fs.readFileSync(path.join(root,'js/05-world.js'),'utf8');
ok(/barrelBlast\(c,attacker\)/.test(w5)&&/damageStructures\(p,2\.8,90,attacker\)/.test(w5),
 'T10 第 10 处调用点 = 油桶连锁引爆 (05-world.barrelBlast, 4 参带归属)');
const s16st=fs.readFileSync(path.join(root,'js/16-aircraft.js'),'utf8');
ok(/if\(typeof damageStructures==='function'\) damageStructures\(_plSwHit,7,260,this\.lastHitBy\|\|null\)/.test(s16st),
 'T10 第 11 处调用点 = 飞机撞楼归属 (2026-11-10 三蟲抓①, 16-aircraft, 4 参带归属)');
const bat=fs.readFileSync(path.join(root,'js/15f-battery.js'),'utf8');
ok(/destroyStructure\(this\.reg,false,attacker\)/.test(bat),'T10 炮位自毁链把 attacker 透传给 destroyStructure (直击炮体拆掉的胸墙同样记分)');
}

// ── 入口 ──
console.log('== 地图可破坏物得分沙箱 ==');
t1(); t1b(); t2(); t3(); t4(); t5(); t6(); t7(); t8(); t9(); t10();
console.log(`== 结果: ${PASS.length} 通过 / ${FAILS} 失败 ==`);
process.exit(FAILS?1:0);
