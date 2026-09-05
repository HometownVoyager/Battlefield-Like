// ─────────────────────────────────────────────
// dev/verify-fallstam.js —— 摔落伤害/体力规则验证 (2026-09-02, 不进 Index.html)
// 复用 verify-boot 桩(刻意不挂 CANNON→布娃娃走内置回退), 加载全部真实脚本并进战场:
//  1) 摔落伤害档位: 2m 无伤 / 5m≈-24 / 10m≈-71 / 14m 致死 (g≈13, 安全速度9, 每1m/s扣10);
//  2) 水面缓冲: 胡康河谷河道内同高坠落无摔伤 (激流持续伤除外);
//  3) 冲刺耗速: 0.22/2.5=0.088/s (满条≈11.3s), 屏息/回复速率不变;
//  4) 观战无限体力: 冲刺/跳跃体力恒满, 高坠落地免伤。
// 用法: node dev/verify-fallstam.js
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
// ── 与 verify-boot 相同的桩 (摘自 dev/verify-boot.js) ──
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
dot(v){return this.x*v.x;this.y*=v.y;this.z*=v.z;}crossVectors(a,b){this.x=a.y*b.z-a.z*b.y;this.y=a.z*b.x-a.x*b.z;this.z=a.x*b.y-a.y*b.x;return this;}
applyAxisAngle(){return this;}setFromMatrixColumn(){return this;}lerpVectors(){return this;}}
class Euler{constructor(){this.x=0;this.y=0;this.z=0;this.order='XYZ';}set(x,y,z,o){this.x=x;this.y=y;this.z=z;if(o)this.order=o;return this;}}
class Obj3{constructor(){this.position=new V3();this.rotation=new Euler();this.scale=new V3(1,1,1);this.quaternion={setFromUnitVectors(){return this;}};this.children=[];this.visible=true;this.castShadow=false;this.receiveShadow=false;this.renderOrder=0;this.matrix={};this.userData={};this.material=null;this.geometry=null;}
add(m){this.children.push(m);m.parent=this;return this;}remove(m){const i=this.children.indexOf(m);if(i>=0)this.children.splice(i,1);}
traverse(fn){fn(this);for(const c of this.children)if(c&&c.traverse)c.traverse(fn);}
updateMatrix(){}
lookAt(){return this;}
clone(){const c=new this.constructor();if(this.geometry)c.geometry=this.geometry;if(this.material)c.material=this.material;c.position=new V3(this.position.x,this.position.y,this.position.z);c.rotation=new Euler();if(this.rotation.x||this.rotation.y||this.rotation.z)c.rotation.set(this.rotation.x,this.rotation.y,this.rotation.z);c.scale=new V3(this.scale.x,this.scale.y,this.scale.z);c.visible=this.visible;c.castShadow=this.castShadow;c.name=this.name;return c;}};
class Geo{constructor(...a){this.attributes={};this.parameters={};}translate(){return this;}rotateX(){return this;}rotateY(){return this;}rotateZ(){return this;}setAttribute(n,a){this.attributes[n]=a;return this;}setIndex(){return this;}setFromPoints(){return this;}computeVertexNormals(){return this;}dispose(){}}
class _PlaneGeo extends Geo{constructor(w=1,h=1,sg=1,sh=1){super(w,h);const gx=(sg||1)+1,gy=(sh||1)+1;this.attributes.position={count:gx*gy,getX:i=>((i%gx)/gx-0.5)*w,getZ:i=>(Math.floor(i/gx)/gy-0.5)*h,getY:()=>0,setY(){},setX(){},setZ(){}};}}
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
const _mat=cls=>{ return class extends cls{constructor(o){super();Object.assign(this,o||{});this.color=_wrapColor(this.color);}}; };
class _Fog{constructor(c,n,f){this.color=new _Color(c);this.near=n;this.far=f;}}
class _FogExp2{constructor(c,d){this.color=new _Color(c);this.density=d;}}
const THREE={
WebGLRenderer:class{constructor(){this.domElement=Object.assign(mkElement('canvas'),{width:0,height:0});this.shadowMap={enabled:false,type:0,autoUpdate:true};this.setSize=()=>{};this.setPixelRatio=()=>{};this.render=()=>{};this.clear=()=>{};this.clearDepth=()=>{};this.outputColorSpace='';this.setClearColor=()=>{};this.setAnimationLoop=()=>{};this.domElement.addEventListener=()=>{};this.domElement.style={};}},
Scene:class extends Obj3{constructor(){super();this.background=null;this.fog=null;}},
PerspectiveCamera:class extends Obj3{constructor(){super();this.fov=70;this.near=0.1;this.far=1000;this.aspect=1;}updateProjectionMatrix(){}getWorldDirection(v){v.set(0,0,-1);return v;}},
Group:class extends Obj3{},Mesh:class extends Obj3{constructor(g,m){super();this.geometry=g||new Geo();this.material=m||{};}},
InstancedMesh:class extends Obj3{constructor(g,m,n){super();this.count=n;}setMatrixAt(){this.instanceMatrix={};}setColorAt(){this.instanceColor=this.instanceColor||{needsUpdate:false};}},
Points:class extends Obj3{constructor(g,m){super();this.geometry=g;this.material=m;}},
LineSegments:class extends Obj3{constructor(g,m){super();this.geometry=g;this.material=m;}},
Object3D:Obj3,Sprite:class extends Obj3{constructor(m){super();this.material=m||{};if(!this.material.color)this.material.color={set(){}};}},
Vector2:class{constructor(x=0,y=0){this.x=x;this.y=y;}set(x,y){this.x=x;this.y=y;return this;}},
Vector3:V3,Vector4:V3,Euler:Euler,Quaternion:class{set(){return this;}setFromUnitVectors(){return this;}identity(){return this;}setFromEuler(){return this;}setFromAxisAngle(){return this;}premultiply(){return this;}},
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
HemisphereLight:class extends Obj3{constructor(a,b,i){super();this.intensity=i;}},
PointLight:class extends Obj3{},
Box3:class{setFromObject(){return this;}expandByObject(){return this;}},
Clock:class{getDelta(){return 0;}},
Matrix4:class{compose(){return this;}makeRotationFromEuler(){return this;}makeScale(){return this;}},
MathUtils:{clamp:(v,a,b)=>v<a?a:(v>b?b:v)},
RepeatWrapping:1000,DoubleSide:2,BackSide:1,FrontSide:0,SRGBColorSpace:'srgb',NoToneMapping:0,
PCFSoftShadowMap:2,PCFShadowMap:1,BasicShadowMap:0,NearestFilter:0,LinearFilter:1,
};
const AC=class{
createOscillator(){return {frequency:param(),type:'',start(){},stop(){},connect(){},onended:null};}
createGain(){return {gain:param(),connect(){},disconnect(){}};}
createBuffer(){return {getChannelData:()=>new Float32Array(16),duration:1,numberOfChannels:1};}
createBufferSource(){return {buffer:null,loop:false,playbackRate:{value:0,setValueAtTime(){}},start(){},stop(){},connect(){},onended:null};}
createBiquadFilter(){return {type:'',frequency:{value:0,setValueAtTime(){}},Q:{value:0},connect(){}};}
createDynamicsCompressor(){return {threshold:{value:0},ratio:{value:0},attack:{value:0},release:{value:0},connect(){}};}
createStereoPanner(){return {pan:{value:0},connect(){}};}
resume(){return Promise.resolve();}
get state(){return 'running';}
get destination(){return {};}
get currentTime(){return 0;}
get sampleRate(){return 44100;}
};
const window={addEventListener(){},removeEventListener(){},AudioContext:AC,webkitAudioContext:AC,CANNON:null,Box:class{constructor(v){this.v=v;}},Sphere:class{},Vec3:V3,Material:class{},ContactMaterial:class{},Body:class{constructor(o){Object.assign(this,o||{});}},World:class{add(){this.bodies=this.bodies||[];}},
};
// 音频调度参数桩: 覆盖 AudioParam 全部常用方法 (01-audio env/footstep/hurt 等走 linearRamp/exponentialRamp)
const param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){},cancelScheduledValues(){}});
const sandbox={
console,Math,JSON,performance:{now:()=>Date.now()},
location:{search:'?seed=42',reload(){},href:'http://localhost/'},
localStorage:{_s:{},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}},
navigator:{},document,window,
requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},
setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{},
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
ctx.localStorage._s={sf_campaign:String(campIdx)};
const files=['js/00-config.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15a-defs.js','js/15-vehicles.js','js/15b-trucks.js','js/16a-defs.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/23-deploy.js','js/24-main.js'];
for(const f of files) load(ctx,f);
return ctx;
}
const run=(ctx,code)=>vm.runInContext(code,ctx);
// 进入战场: 点击「进入战场」→ startGame/startMatch/showDeploy 全链
function enterField(campIdx){
const ctx=boot(campIdx);
const hook=run(ctx,`(()=>{ try{
const btn=document.getElementById('startBtn');
if(!btn||!btn.onclick) return {ok:false,err:'no onclick'};
btn.onclick();
return {ok:true,camp:CAMPAIGN.id};
}catch(e){ return {ok:false,err:String(e&&e.stack||e)}; } })()`);
if(!hook.ok) throw new Error('boot camp '+campIdx+' fail: '+hook.err);
return ctx;
}
function campIdxOf(id){
const probe=boot(0);
const i=run(probe,`CAMPAIGNS.findIndex(c=>c.id==='${id}')`);
if(i<0) throw new Error('campaign not found: '+id);
return i;
}
// 找一块无建筑、局部平整的陆地 (5×5m 高差 <0.12)
function flatLand(ctx){
const pts=run(ctx,`(()=>{
for(let x=-130;x<=130;x+=7)for(let z=-130;z<=130;z+=7){
if(occBlocked(x,z)) continue;
const h0=heightAt(x,z);
let mn=h0,mx=h0;
for(let dx=-3;dx<=3;dx+=1.5)for(let dz=-3;dz<=3;dz+=1.5){ const h=heightAt(x+dx,z+dz); mn=Math.min(mn,h); mx=Math.max(mx,h); }
if(mx-mn<0.12&&Math.abs(h0)<40) return {x,z,y:h0};
}
return null;
})()`);
if(!pts) throw new Error('no flat land found');
return pts;
}
// 玩家状态复位 (走 deployPlayer 的字段全集, 不走 UI)
function resetPlayer(ctx,x,y,z,over){
run(ctx,`(()=>{ const p=player;
p.alive=true; p.deployed=true; p.spectator=false; p.flying=false; p.flyAero=false; p.loiter=null;
p.hp=100; p.crouch=false; p.prone=false; p.ads=false; p.holdBreath=false; p.braced=false; p.bandaging=0;
p.pos.set(${x},${y},${z}); p.vel.set(0,0,0); p.onGround=false; p.chute=false;
p.stamina=1; p.suppressV=0; p.bloom=0; p.fireT=0; p.landDip=0; p.lastDmgT=-99;
p.nadeHeld=false; p.onVehicle=null; p.onMG=null; p.onAT=null; p.onAA=null; p.onMortar=null;
p.pendingBuild=null; p.sprinting=false; p.leanT=0; p.recoilPitch=0; p.recoilYaw=0;
if(!p.slots.length) p.slots=[{key:'springfield',def:WPN_DEFS['springfield'],mag:5,reserve:50}];
p.curSlot=0; p.curW=p.slots[0];
keys.ShiftLeft=false; keys.KeyW=false; keys.Space=false;
mouseDown=false; mouse2Down=false;
${over||''}
})()`);
}
// 跑 N 秒物理帧 (dt=1/60, nowT 同步前进), 返回每秒末采样器可见
function simFrames(ctx,secs){
run(ctx,`for(let i=0;i<${Math.round(secs*60)};i++){ nowT+=1/60; updatePlayer(1/60); }`);
}
let failures=0;
function check(name,cond,detail){
console.log((cond?'  ✓ ':'  ✘ ')+name+(detail?('  ['+detail+']'):''));
if(!cond) failures++;
}
// ════ 1) 摔落伤害档位 (诺曼底平地) ════
console.log('── 1) 摔落伤害档位 (诺曼底, g≈13, 安全速度9, ×10/s) ──');
const ctxN=enterField(0);
const land=flatLand(ctxN);
function dropTest(H){
resetPlayer(ctxN,land.x,land.y+H,land.z);
simFrames(ctxN,4);
return {hp:run(ctxN,'player.hp'),alive:run(ctxN,'player.alive'),ground:run(ctxN,'player.onGround'),pop:byId['scorePop']?byId['scorePop'].textContent:''};
}
const vH=h=>Math.sqrt(2*13*h);
{
const r=dropTest(2);
check('2m 落地无伤 (v='+vH(2).toFixed(1)+'<9)',r.hp===100&&r.alive,'hp='+r.hp);
}
{
const r=dropTest(5);
const D=(vH(5)-9)*10;
check('5m 落地 ≈-'+D.toFixed(0)+' 血 (v='+vH(5).toFixed(1)+')',r.hp>100-D*1.15&&r.hp<=100-D*0.75&&r.alive,'hp='+r.hp+' 期望≈'+D.toFixed(0)+' pop="'+r.pop+'"');
check('  摔落提示弹出',/摔落/.test(r.pop),'pop="'+r.pop+'"');
}
{
const r=dropTest(10);
const D=(vH(10)-9)*10;
check('10m 落地 ≈-'+D.toFixed(0)+' 血 (v='+vH(10).toFixed(1)+')',r.hp>100-D*1.15&&r.hp<=100-D*0.7&&r.alive,'hp='+r.hp+' 期望≈'+D.toFixed(0));
}
{
const r=dropTest(14);
check('14m 落地致死 (v='+vH(14).toFixed(1)+')',r.hp<=0&&!r.alive,'hp='+r.hp+' alive='+r.alive);
}
// ════ 2) 水面缓冲 (胡康河谷河道) ════
console.log('── 2) 水面缓冲 (胡康河谷河道坠落) ──');
const ctxH=enterField(campIdxOf('hukawng'));
const riv=run(ctxH,`(()=>{
for(let x=-8;x<=8;x+=4)for(let z=-100;z<=100;z+=8){
if(inRiverChannel(x,z)&&!onBridge(x,z)) return {x,z};
}
return null;
})()`);
if(riv){
const gh=run(ctxH,`standHeight(${riv.x},${riv.z},1000)`);
function riverDrop(H){
resetPlayer(ctxH,riv.x,gh+H,riv.z);
simFrames(ctxH,2);
return {hp:run(ctxH,'player.hp'),alive:run(ctxH,'player.alive'),pop:byId['scorePop']?byId['scorePop'].textContent:''};
}
const r12=riverDrop(12), r3=riverDrop(3);
// 激流持续伤 8/s × 2s ≈ 16 两者相同; 若 12m 还有摔伤会再扣 ~87 血或直接致死
check('12m 坠入河道 = 3m 坠入河道 (摔伤被水面缓冲, 仅剩激流伤)',Math.abs(r12.hp-r3.hp)<1&&r12.hp>60&&r12.alive,
`hp12=${r12.hp.toFixed(1)} hp3=${r3.hp.toFixed(1)} (均含≈16 激流伤)`);
check('  河道坠落无摔落提示',!/摔落/.test(r12.pop),'pop="'+r12.pop+'"');
// 直调对照: 同冲击速度 v=16, 河道内 fallDamage=0 / 陆上=70
const cmp=run(ctxH,`(()=>{
let hitW=0,hitL=0;
fallDamage({pos:V3(${riv.x},0,${riv.z}),vel:V3(0,-16,0),damage:a=>{hitW+=a;}});
let lx=null,lz=null;
for(let dx=6;dx<=40;dx+=2){ if(!inRiverChannel(${riv.x}+dx,${riv.z})&&!occBlocked(${riv.x}+dx,${riv.z})){ lx=${riv.x}+dx; lz=${riv.z}; break; } }
if(lx!==null) fallDamage({pos:V3(lx,0,lz),vel:V3(0,-16,0),damage:a=>{hitL+=a;}});
return {hitW,hitL};
})()`);
check('fallDamage 直调: 河道=0 / 陆地=70 (v=16)',cmp.hitW===0&&cmp.hitL===70,JSON.stringify(cmp));
}else{ check('未找到胡康河谷河道采样点',false); }
// ════ 3) 冲刺体力耗速 ÷2.5 ════
console.log('── 3) 冲刺/回复体力 (其他模式) ──');
{
resetPlayer(ctxN,land.x,land.y,land.z,'p.onGround=true;');
run(ctxN,`keys.ShiftLeft=true; keys.KeyW=true;`);
simFrames(ctxN,1);
const st=run(ctxN,'player.stamina');
check('满条冲刺 1s 耗速 ≈0.088/s (条剩≈0.912)',st>0.88&&st<0.94,'stamina='+st.toFixed(3)+' (旧版应为0.78)');
run(ctxN,`keys.ShiftLeft=false;`);
// 回复速率不变: 停跑冷却 1s 后按 0.16/s 回 (先压到 0.5 留出头寸)
run(ctxN,`player.stamina=0.5;`);
simFrames(ctxN,1.2);
const s0=run(ctxN,'player.stamina');
simFrames(ctxN,1);
const s1=run(ctxN,'player.stamina');
check('停跑 1.2s 后回复速率 ≈0.16/s',s1-s0>0.13&&s1-s0<0.19,'Δ='+(s1-s0).toFixed(3));
// 满条冲刺理论时长 = 1/0.088 ≈ 11.3s
resetPlayer(ctxN,land.x,land.y,land.z,'p.onGround=true;');
run(ctxN,`keys.ShiftLeft=true; keys.KeyW=true; globalThis.__dur=0; globalThis.__start=nowT; globalThis.__last=nowT;`);
run(ctxN,`for(let i=0;i<60*20;i++){ nowT+=1/60; updatePlayer(1/60); if(player.sprinting){ globalThis.__dur=nowT-globalThis.__start; globalThis.__last=nowT; } else if(globalThis.__dur>0&&nowT-globalThis.__last>0.5) break; }`);
const dur=run(ctxN,'globalThis.__dur');
check('持续冲刺可维持 ≈11.3s (2.5×旧版4.5s)',dur>9.5&&dur<13,dur.toFixed(1)+'s');
run(ctxN,`keys.ShiftLeft=false; keys.KeyW=false;`);
}
// ════ 4) 观战无限体力 ════
console.log('── 4) 观战模式 (无限体力 + 免摔伤) ──');
{
resetPlayer(ctxN,land.x,land.y,land.z,'p.onGround=true; p.spectator=true;');
run(ctxN,`keys.ShiftLeft=true; keys.KeyW=true; globalThis.__minSt=1; globalThis.__specSprint=false;`);
run(ctxN,`for(let i=0;i<60*3;i++){ nowT+=1/60; updatePlayer(1/60); if(player.stamina<globalThis.__minSt) globalThis.__minSt=player.stamina; if(i===120) keys.Space=true; if(i===125) keys.Space=false; if(player.sprinting) globalThis.__specSprint=true; }`);
const minSt=run(ctxN,'globalThis.__minSt');
check('观战冲刺+跳跃 3s 体力恒满 (仅跳跃帧瞬时-0.08 次帧回满, 终值=1)',minSt>=0.9&&run(ctxN,'player.stamina')===1,'minSt='+minSt.toFixed(3));
check('观战可一直冲刺 (sprinting=true)',run(ctxN,'globalThis.__specSprint'));
run(ctxN,`keys.ShiftLeft=false; keys.KeyW=false;`);
// 观战高坠免伤
resetPlayer(ctxN,land.x,land.y+12,land.z,'p.spectator=true;');
simFrames(ctxN,3);
check('观战 12m 坠落免伤 (免伤由 damage() 兜底)',run(ctxN,'player.hp')===100&&run(ctxN,'player.alive'),'hp='+run(ctxN,'player.hp'));
}
console.log(failures===0?'全部通过 ✔':'存在失败项 ✘ ('+failures+')');
process.exit(failures===0?0:1);
