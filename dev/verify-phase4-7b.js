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
// dev/verify-phase4-7b.js —— P3 阶段四子批 7b-乙/丙 判据: AI 全重写 + 锁定/AI 接管
// 用法: node dev/verify-phase4-7b.js
// 结构: S1~S12 静态断言 (单源/接线/契约面) + R1~R8 运行时钉值 (真沙箱开局后驱动 Plane)。
// 乙 (AI 全重写): steerToward 统一转向原语 / 统一 lead 追击 / 不双打分派 / 反应窗 (AA+缠斗) /
//                 规避概率·时长接难度 / 对地扫射·投弹三域参数化 / 拒止带 (软)。
// 丙 (锁定+接管, 用户裁定): E/中键锁定 (半角 35°/500m, 空中优先) / Space 接管 = 老飞行员代打
//                 (诚实弹道: fireMGBurst(player)/dropBomb(player) 同一管线, 无制导弹) /
//                 全包 (咬尾机炮+对地扫射+自动投弹) / 终止四条 + 冷却 3s (2026-09-30j 8→3)。
// 口径对照: docs/设计盘点-P3空战重写-20260930.md §6.2 二轮裁定; 00-config PLANE_LOCK/PLANE_TAKEOVER/PLANE_AI。
// 运行时去噪纪律: 每组用例前 reset() 把全部参测实体摆到固定位姿 (布局随机性不进判据,
// 见"种子下世界构建仍不可复现"契约 —— 凡按布局断言的判据必须自带实体摆位)。
// 沙箱样板与 verify-phase4-7a 同源 (桩式 THREE/DOM/AudioContext, 只跑战役 0)。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
let PASS=0,FAIL=0;
function ok(c,m){ if(c){PASS++; console.log('  ✓ '+m);} else {FAIL++; console.log('  ✗ '+m);} }

// ── 静态断言 ──
const cfg=read('js/00-config.js'), air=read('js/16-aircraft.js'), cbt=read('js/13-combat.js'),
      bots=read('js/14-bots.js'), inp=read('js/19-input.js'), seats=read('js/20a-seats.js'),
      hud=read('js/22-hud.js'), html=read('index.html'), css=read('css/style.css');
console.log('S 静态: 单源/接线/契约面');
// ── 7b-乙 ──
ok(/function steerToward\(pl,aim,spdTgt,bankLim,pitLim\)/.test(air)&&(air.match(/steerToward\(/g)||[]).length>=6,'S1 steerToward 统一转向原语 (定义 + 缠斗/俯冲/拒止带/接管共 5 消费点)');
ok(air.indexOf('function planeLeadAim(pl,tgt)')>=0&&air.indexOf('clamp(pl.pos.distanceTo(tgt.pos)/PLANE_AI.leadT,0,0.9)')>=0
&&air.indexOf('clamp(d/280,0,0.9)')<0,'S1b 统一 lead 追击单源 planeLeadAim (旧内联 d/280 绝迹)');
ok(/function pickDogTarget\(me\)/.test(air)&&(air.match(/dogTgt/g)||[]).length>=8
&&air.indexOf('enemyPlaneAlive(this.team)')<0,'S2 不双打: pickDogTarget 分派 + dogTgt 全接线 (旧 enemyPlaneAlive(this.team) 缠斗入口绝迹)');
ok(/const softLim=MAP_SIZE\/2\+20;/.test(air)&&air.indexOf('拒止带')>=0,'S3 拒止带 (软): 战场半宽+20m 先回场 (旧只有界外+140 硬折返兜底)');
ok(/react:1\.10,/.test(cfg)&&/react:0\.45, evd:0\.90,/.test(cfg)&&/evT:1\.25,/.test(cfg)&&/sg:1\.20,/.test(cfg)&&/bmLo:0\.65,/.test(cfg),'S4 PLANE_DIFF 三域全参数化 (空战 react/evd/evT · 对地 sg · 投弹 bmLo/bmHi)');
ok(/react:1\.30,/.test(cfg)&&/react:0\.80,/.test(cfg)&&bots.indexOf('AA_DIFF[SETTINGS.diff].react')>=0
&&bots.indexOf('this._aaTgt=pl')>=0&&bots.indexOf('dist<EMPL_AA_ENGAGE_R')>=0&&bots.indexOf('this.aaReactT<=0')>=0,'S5 高炮反应窗: AA_DIFF.react 单源 + 14-bots aaReactT 换目标重置/开火闸 (旧版无反应门; 交战距离单源改 EMPL_AA_ENGAGE_R, 2026-09-30 空对地平衡批; 锚随 2026-10-05 昼夜批拆两段——夜档 ×rangeMul 插在中间)');
ok(air.indexOf('Math.random()<PLANE_DIFF[SETTINGS.diff].evd')>=0&&air.indexOf('rand(1.4,2.6)*PLANE_DIFF[SETTINGS.diff].evT')>=0
&&air.indexOf('Math.random()<0.7){ this.evadeT=rand(1.4,2.6)')<0,'S6 规避概率/时长接难度表 (旧写死 0.7 / 1.4~2.6 绝迹)');
ok(/dh<110\*PD\.sg/.test(air)&&/PD\.bmHi/.test(air)&&/PD\.bmLo/.test(air)&&(air.match(/const PD=PLANE_DIFF\[/g)||[]).length>=2,'S7 对地两域接线: 扫射 110×sg + 投放带 bmLo/bmHi (旧写死 110 / 1.08 / 0.5 绝迹)');
// ── 7b-丙 ──
ok(/const PLANE_LOCK=\{ cone:35, drop:45, range:500, dropRange:560 \};/.test(cfg)
&&/const PLANE_TAKEOVER=\{ cd:3, range:600, losGrace:1\.6, minAGL:40, diveAGL:20 \};/.test(cfg)&&/const PLANE_AI=\{ leadT:280, aimAGL:36, breakAGL:30, joinAGL:44 \};/.test(cfg)&&/const BOMB_GUIDE_RATE=1\.4;/.test(cfg),'S8 锁定/接管常量单源: 35°/500m · 松锥 45°/560m · 冷却 3s (30j 8→3) · 接战 600m · LOS 宽限 1.6s · 保底双档 40m/俯冲 20m (30k) · 缠斗低空三参 aimAGL36/breakAGL30/joinAGL44 · 航弹制导率 1.4rad/s (30k)');
{
const iA=air.indexOf('aiPilotFly(dt){'), iB=air.indexOf('takeDmg(amt,attacker){');
const reg=iA>0&&iB>iA?air.slice(iA,iB):'';
ok(reg.length>500&&!reg.includes('takeDmg(')&&reg.includes('this.fireMGBurst(player,0.8)')&&reg.includes('this.dropBomb(player)')
&&reg.includes('planeLeadAim(this,t)')&&reg.includes('steerToward(this,aimP'),'S9 接管=诚实弹道: aiPilotFly 只经 fireMGBurst(player)/dropBomb(player) 管线, 方法体内零直伤 (无制导旁路)');
}
ok((air.match(/planeTakeoverEnd\(this,/g)||[]).length>=3&&air.indexOf("planeTakeoverEnd(pl,'交还控制')")>=0
&&/if\(d>PLANE_TAKEOVER\.range\)/.test(air)&&/this\.aiLosT>=PLANE_TAKEOVER\.losGrace/.test(air),'S9b 接管终止四条单源收口 planeTakeoverEnd: 目标死/超距/失视野/手动交还');
ok(/function planeLockScan\(pl\)/.test(air)&&air.indexOf('return air||gnd;')>=0
&&/function planeLockMaintain\(pl\)/.test(air)&&air.indexOf('d>PLANE_LOCK.dropRange||ang>PLANE_LOCK.drop*Math.PI/180')>=0,'S10 锁定扫描/维持: 空中优先 (return air||gnd) + 松锥维持窗单源');
ok(inp.indexOf("e.code==='KeyE'&&typeof planeLockToggle==='function'")>=0
&&inp.indexOf("e.code==='Space'&&typeof planeTakeoverToggle==='function'")>=0
&&/e\.button===1/.test(inp)&&(inp.match(/planeLockToggle/g)||[]).length>=3
&&(inp.match(/player\.onVehicle&&player\.onVehicle\.kind==='plane'/g)||[]).length>=2,'S11 键位裁定落地: E+中键=锁定 / Space=接管, 入口同门卫 (仅飞行员座位; 步行 E=侧身/Space=跳 不受扰)');
ok(seats.indexOf('planeLockMaintain(pl)')>=0&&seats.indexOf("'lockPip'")>=0&&seats.indexOf('AI 接管中')>=0
&&html.indexOf('id="lockPip"')>=0&&html.indexOf('id="planeLockHud"')>=0
&&css.indexOf('#lockPip ')>=0&&css.indexOf('#planeLockHud ')>=0
&&hud.indexOf("hudHideReal('lockPip')")>=0&&hud.indexOf("hudHideReal('planeLockHud')")>=0,'S12 锁定/接管 HUD 三件套接线 + D6 兜底 sweep 双写点 (lockPip/planeLockHud)');
// ── 7b-丙 实机热修 (2026-09-30): 保底高度 + 接管规避 ──
ok(/minAGL:40, diveAGL:20 \}/.test(cfg)&&(air.match(/PLANE_TAKEOVER\.minAGL/g)||[]).length>=1
&&(air.match(/PLANE_TAKEOVER\.diveAGL/g)||[]).length>=1
&&air.indexOf('t.pos.y<this.pos.y-4')>=0
&&air.indexOf('this.speed*0.9')>=0&&air.indexOf('this.speed*1.8')>=0
&&air.indexOf('PLANE_TAKEOVER.minAGL+8')<0
&&air.indexOf('if(aimP.y<ghA+8) aimP.y=ghA+8;')>=0,'S13 保底高度双档 (30k 用户报"敌机高度低时接管不去打"): minAGL40 平飞老闸 + diveAGL20 俯冲档 (目标在下方>4m) + 追击钳高收窄为防钻地 ghA+8 (旧 minAGL+8=48 把低空敌机顶到头上=不去打, 绝迹)');
ok(air.indexOf('if(this.aiPilotOn&&amt>2&&this.aiEvT<=0&&this.aiEvCd<=0)')>=0
&&/if\(this\.aiEvT>0\)/.test(air)&&air.indexOf('this.aiEvCd=2.6;')>=0
&&air.indexOf('0.72*Math.sqrt(dv2)')>=0
&&air.indexOf('pl.aiEvT=0; pl.aiEvCd=0;')>=0,'S14 接管规避: 挨打置窗(takeDmg 玩家分支)+被咬尾侦察(后半球 320m·cos44°)+破转窗+2.6s 冷却+终止/退场清账 (用户报"AI不会躲避")');
ok(air.indexOf('mf.x*dvx+mf.y*dvy+mf.z*dvz')>=0
&&air.indexOf('this.aiEvSrc=ep')>=0
&&air.indexOf("attacker.onVehicle.kind==='plane'")>=0
&&(air.match(/aiEvSrc=null/g)||[]).length>=5
&&air.indexOf('steerToward(this,planeLeadAim(this,src)')>=0
&&air.indexOf('this.aiEvDir=dyT>0?-1:1')>=0,'S14b 破转反咬 (2026-09-30j 用户裁定"过度躲避=窝囊且废物"): 咬尾判据补真·后半球 (对头不再触发规避) · 破转方向朝威胁 · 窗后半段反舵回扫开火 (照走 fireMGBurst 诚实弹道) · 挨打记源把机组 Bot 归位到其座机 (敌机射手是 Bot, 不归位则最高频置窗路径记不到敌机) · 威胁引用五处清账不过夜');
// ── 30k: 航弹锁定+制导 + 航弹反坦克化 + Bot 对空微削 ──
ok(cfg.indexOf('const BOMB_GUIDE_RATE=1.4;')>=0
&&air.indexOf('const lk=(this.playerDriven&&this.lockTgt&&this.lockTgt.alive)?this.lockTgt:null;')>=0
&&air.indexOf('bomb:true,lock:lk')>=0
&&air.indexOf("showScorePop(t2('航弹制导: {0}'")>=0
&&cbt.indexOf('if(st.bomb&&st.lock&&st.lock.alive){')>=0
&&cbt.indexOf('BOMB_GUIDE_RATE*dt')>=0,'S15 航弹锁定+制导 (30k): dropBomb 挂账玩家锁 (接管代打同吃 —— aiPilotTgt 即玩家锁) + 限角速度掰向目标 (只改速度方向不改模长, 落体/引信/入水全走原链; 目标亡退回诚实弹道), BOMB_GUIDE_RATE 单源 [锚随 2026-09-30 批2 更新: 制导块搬进 nadeStep 单源积分器, 逐枚帧长由调用方形参 dt 传入 (原 *ndt 语义不变)]');
ok(cbt.indexOf('splashDamage(n.pos,n.thrower,n.team,13,210,1350,true);')>=0
&&cbt.indexOf('damageStructures(n.pos,12,460,n.thrower);')>=0
&&cbt.indexOf('crater(n.pos.x,n.pos.z,2.4,true);')>=0
&&cfg.indexOf('const AIR2AIR_BOT_MUL=0.80;')>=0
&&air.indexOf('(shooter&&shooter.isPlayer)?1:AIR2AIR_BOT_MUL')>=0,'S16 航弹反坦克化/Bot 对空微削钉值 (30k 用户裁定): 半径 9.5→13 · 步兵 170→210 · 载具 260→1350 且 ap=true (旧无 ap=×TANK_ARMOR0.3 挠痒) + 结构 12/460 + 弹坑 2.4 + Bot 航炮空空伤害×0.8 (玩家/接管代打档不减)');

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

console.log('R 运行时: 乙决策原语 + 丙锁定/接管 (真沙箱, 战役 0)');
const r=vm.runInContext(`(()=>{
try{
const out={};
const btn=document.getElementById('startBtn');
if(btn&&btn.onclick) btn.onclick(); else return 'no startBtn.onclick';
const pl=planes[0];
const foe=pl.team===0?1:0;
const eps=planes.filter(p=>p.team===foe);      // 至少 1 架真敌机 (campaign 0)
const ep1=eps[0], hasEp2=eps.length>1, ep2=hasEp2?eps[1]:null;
const tk=tanks.find(t=>t.team===foe);
if(!tk) return 'no enemy tank';
// 测试位姿复位 + 环境去噪: 全部参测实体摆到固定位姿, 布局随机性不进判据
function reset(){
pl.alive=true; pl.hp=pl.maxHp; pl.crewBot=null; pl.playerDriven=true; // 接管是玩家座位态: update 的驾驶分派必须走 aiPilotFly (false 会被无人螺旋分支收账)
pl.pos.set(0,100,0); pl.yaw=0; pl.pitch=0; pl.roll=0; pl.speed=45;
pl.lockTgt=null; pl.aiPilotOn=false; pl.aiPilotTgt=null; pl.aiLosT=0; pl.dogTgt=null; pl.evadeT=0;
pl.aiEvT=0; pl.aiEvCd=0; // 热修⑤: 规避态一并复位
pl.state='patrol'; pl.stateT=99; pl.target=null; pl.bombs=pl.def.bombs; pl.bombCd=0; pl.fireT=0;
player.onVehicle=pl; player.alive=true; player.takeoverCd=0;
for(const p of planes){ if(p!==pl&&p.team===foe){ p.alive=true; p.pos.set(300,100,300); p.dogTgt=null; } }
for(const t of tanks){ if(t.team===foe){ t.alive=true; t.pos.set(300,2,300); } }
for(const s of combatants){ if(s.alive&&s.team===foe) s.pos.set(-60,2,-160); }
tk.pos.set(0,2,150);
}
// ── R1 steerToward 收敛: 原语→fctl→flightStep, 4s 内机头对准瞄准点 ──
pl.playerDriven=false; pl.crewBot=null;
pl.pos.set(0,100,0); pl.yaw=0; pl.pitch=0; pl.roll=0; pl.speed=40;
const aim1=V3(120,100,120); // 期望航向 45°
const dy0=steerToward(pl,aim1,40,1);
for(let i=0;i<240;i++){ steerToward(pl,aim1,40,1); pl.flightStep(1/60); }
const dy1=angDiff(pl.yaw,Math.atan2(aim1.x-pl.pos.x,aim1.z-pl.pos.z));
out.r1dy=[dy0,dy1];
out.r1ok=Math.abs(dy0)>0.5&&Math.abs(dy1)<0.08&&isFinite(pl.yaw);
// ── R2 锁定扫描: 空中优先 + 射程门 + 地面回退 + 切换函数端到端 ──
reset();
ep1.pos.set(0,100,480);                                   // 正前 480m (锥内·射程内, 0°)
if(hasEp2) ep2.pos.set(24,100,470);                       // 2.9° 偏角 470m
tk.pos.set(0,102,300);                                    // 地面 0° 300m
let pick=planeLockScan(pl);
out.r2a=(pick===ep1);                                     // 空中优先: 双机锥内取偏角最小 (单机时同式成立)
ep1.pos.set(0,100,600); if(hasEp2) ep2.pos.set(0,100,700);// 空中全出射程 (锁 500)
pick=planeLockScan(pl);
out.r2b=(pick===tk);                                      // 地面回退 (对空全灭也能锁地 —— 用户痛点)
tk.pos.set(0,102,-200);                                   // 地面也脱离锥
pick=planeLockScan(pl);
out.r2c=(pick===null);
tk.pos.set(0,102,300); ep1.pos.set(0,100,480); if(hasEp2) ep2.pos.set(24,100,470);
planeLockToggle();                                        // 端到端: E/中键同一单源
out.r2d=(pl.lockTgt===ep1);
pl.lockTgt=null;
// ── R3 锁定维持: 松锥掉锁 / 死目标掉锁 / 锥内维持 ──
tk.pos.set(0,102,300); tk.alive=true; pl.lockTgt=tk;
planeLockMaintain(pl);
out.r3a=(pl.lockTgt===tk);
tk.pos.set(300,102,200);                                  // atan2(300,200)≈56° > 松锥 45° (距离 360 仍在松锁距内 ⇒ 只判角度)
planeLockMaintain(pl);
out.r3b=(pl.lockTgt===null);
tk.pos.set(0,2,300); tk.alive=true; pl.lockTgt=tk; tk.alive=false;
planeLockMaintain(pl);
out.r3c=(pl.lockTgt===null);
tk.alive=true; tk.pos.set(0,2,150);
// ── R4 接管生命周期: 激活→代打逼近→目标亡→收账+冷却→冷却门→再激活→再按交还 ──
reset();
pl.lockTgt=tk;
const realRCW=raycastWorld;
raycastWorld=()=>null;                                    // LOS 通畅 (沙箱地形不进判据)
pl.fireMGBurst=function(){ };                             // 实例影子桩: 断真实弹药 (诚实弹道走位另在 R6 验)
pl.dropBomb=function(){ };
const d0=pl.pos.distanceTo(tk.pos);
planeTakeoverToggle();
out.r4a=(pl.aiPilotOn===true&&pl.aiPilotTgt===tk);
let r4fin=true;
for(let i=0;i<150;i++){ pl.update(1/60); if(!isFinite(pl.pos.x+pl.pos.y+pl.pos.z)){ r4fin=false; break; } } // 2.5s 推演窗: 俯冲剖面不触地
const d1=pl.pos.distanceTo(tk.pos);
out.r4b=(pl.aiPilotOn===true&&r4fin&&d1<d0-10);           // 代打确实在逼近, 无 NaN
tk.alive=false;
pl.update(1/60);
out.r4c=(pl.aiPilotOn===false&&pl.aiPilotTgt===null&&player.takeoverCd===3); // 收账+冷却 3s (PLANE_TAKEOVER.cd, 2026-09-30j 8→3)
tk.alive=true; pl.lockTgt=tk;
planeTakeoverToggle();
out.r4d=(pl.aiPilotOn===false&&player.takeoverCd>0);      // 冷却门: 歇息中不可再接管
player.takeoverCd=0;
planeTakeoverToggle();
out.r4e=(pl.aiPilotOn===true);
planeTakeoverToggle();                                    // 再按 = 交还
out.r4f=(pl.aiPilotOn===false&&player.takeoverCd===3);
// ── R5 LOS 宽限: 视线全遮 1.6s 后交还 (不做隔山代打) ──
reset();
pl.lockTgt=tk;
raycastWorld=()=>({dist:5});                              // 全遮
planeTakeoverToggle();
out.r5a=(pl.aiPilotOn===true);
let i5=0;
for(;i5<160&&pl.aiPilotOn;i5++) pl.update(1/60);
out.r5f=i5;
out.r5b=(pl.aiPilotOn===false&&player.takeoverCd===3&&i5<160); // ≤2.67s 内收账 (宽限 1.6s)
// ── R6 诚实弹道+全包: 接管开火/投弹都以 player 射手走共用管线 ──
reset();
raycastWorld=()=>null;
pl.lockTgt=tk;
pl.pos.set(0,160,-90); pl.yaw=0; pl.pitch=0; pl.roll=0; pl.speed=50;   // dh=240, h≈158 → tof≈5.7, 老兵带 [142,307] ⇒ 当帧可投
let r6bombP=false, r6shootP=false;
pl.fireMGBurst=function(s){ if(s===player) r6shootP=true; };
pl.dropBomb=function(s){ if(s===player) r6bombP=true; };
planeTakeoverToggle();
for(let i=0;i<60&&pl.aiPilotOn;i++) pl.update(1/60);
out.r6a=(r6bombP===true);                                 // 自动投弹 (全包③), 射手=player
pl.pos.set(0,60,60); pl.yaw=0; pl.pitch=0; pl.roll=0; pl.speed=50;     // dh=90<110 扫射进入距, 机头正对 (+z); AGL≈55>minAGL 不触发保底
pl.fireT=0; pl.lockTgt=tk; if(pl.aiPilotOn) pl.aiPilotTgt=tk;
for(let i=0;i<45&&pl.aiPilotOn;i++) pl.update(1/60);
out.r6b=(r6shootP===true);                                // 对地扫射以 player 射手 (全包①, 诚实弹道证人)
// ── R7 不双打: 已被咬的敌机让位给没被咬的 (假实体入列计数, 不参与 update) ──
reset();
raycastWorld=realRCW;
const eR=ep1;
const fE={alive:true,team:foe,pos:V3(0,0,0),name:'测试机',kind:'plane'};
const extras=[];
planes.push(fE);
for(const p of planes){ if(p!==pl&&p.team===foe&&p!==eR&&p!==fE){ const fb={alive:true,team:pl.team,pos:V3(0,0,0),dogTgt:p}; planes.push(fb); extras.push(fb); } }
const b1={alive:true,team:pl.team,pos:V3(0,0,0),dogTgt:null};
planes.push(b1);
b1.dogTgt=eR;
out.r7a=(pickDogTarget(pl)===fE);                         // eR 已被咬 1 家 → 选 0 咬的 fE
b1.dogTgt=fE;
out.r7b=(pickDogTarget(pl)===eR);                         // 互换后 eR 0 咬 → 选 eR (追"没人咬的")
for(const fb of extras){ const j=planes.indexOf(fb); if(j>=0) planes.splice(j,1); }
{ const j=planes.indexOf(b1); if(j>=0) planes.splice(j,1); }
{ const j=planes.indexOf(fE); if(j>=0) planes.splice(j,1); }
// ── R8 HUD: 接管中/收起 文案与显示 ──
reset();
pl.aiPilotOn=true; pl.aiPilotTgt=tk; pl.lockTgt=tk;
updatePlayerPlane(1/60);
const lkEl=document.getElementById('planeLockHud');
out.r8a=lkEl.textContent.indexOf('AI 接管中')>=0&&lkEl.style.display==='block';
pl.aiPilotOn=false; pl.aiPilotTgt=null; pl.lockTgt=null;
updatePlayerPlane(1/60);
out.r8b=lkEl.style.display==='none';
// ── R9 保底高度 (热修④; 30k 俯冲档): 低空接管 → diveAGL 档托底, 攻击几何与保底共存:
//      俯冲档内允许开火 (低空目标就是要在低空打), 只有档下违规开火才计数, 全程不触地 ──
reset();
raycastWorld=()=>null;                                   // 本组只验保底, 地形 LOS 不进判据
pl.pos.set(0,26,130); pl.yaw=0; pl.pitch=-0.4; pl.roll=0; pl.speed=50; // 贴地俯冲姿态 (AGL≈20)
pl.lockTgt=tk;
let r9fired=false;
pl.fireMGBurst=function(){ r9fired=true; };
pl.dropBomb=function(){ };
planeTakeoverToggle();
out.r9a=(pl.aiPilotOn===true);
const agl0=pl.pos.y-heightAt(pl.pos.x,pl.pos.z);
let r9lowFire=false, r9minAgl=1e9;
for(let i=0;i<180;i++){
pl.update(1/60); if(!pl.alive) break;
// 开火间谍按帧消费: 只有 AGL 低于俯冲档-6m (改出动力学底) 时的开火才算违规 ——
// diveAGL 档内恢复攻击是合法行为 (30k: 低空目标就是要在低空打, 保底不是禁飞令)
if(r9fired&&pl.pos.y-heightAt(pl.pos.x,pl.pos.z)<PLANE_TAKEOVER.diveAGL-6) r9lowFire=true;
r9fired=false;
r9minAgl=Math.min(r9minAgl,pl.pos.y-heightAt(pl.pos.x,pl.pos.z));
}
const agl1=pl.pos.y-heightAt(pl.pos.x,pl.pos.z);
out.r9dbg=[+agl0.toFixed(1),+agl1.toFixed(1),+r9minAgl.toFixed(1),pl.alive?1:0,pl.aiPilotOn?1:0,r9lowFire?1:0];
out.r9b=(pl.alive===true&&pl.aiPilotOn===true&&r9lowFire===false&&r9minAgl>PLANE_TAKEOVER.diveAGL-8); // 不触地、俯冲档托底、档下零违规开火
raycastWorld=realRCW;
// ── R10 接管规避 (热修⑤): 挨打置窗 → 窗内满舵且零开火 → 冷却 → 冷却后恢复攻击 ──
reset();
pl.pos.set(0,60,60); pl.yaw=0; pl.pitch=0; pl.roll=0; pl.speed=50;
pl.lockTgt=tk;
let r10shots=0;
pl.fireMGBurst=function(){ r10shots++; };
pl.dropBomb=function(){ };
planeTakeoverToggle();
pl.update(1/60);                                       // 常规攻击几何 (进入射程先打一发)
r10shots=0;                                            // 清账, 只看规避窗内的行为
const evAtt={isPlayer:false,team:foe,pos:V3(0,0,0)};
pl.takeDmg(10,evAtt);
out.r10a=(pl.aiEvT>0);                                 // 挨打置窗
for(let i=0;i<20&&pl.aiEvT>0;i++) pl.update(1/60);
out.r10b=(r10shots===0&&Math.abs(pl.fctl.bank)>=0.9);  // 窗内满舵破转 + 零开火
let sawCd=false;
for(let i=0;i<360&&pl.aiPilotOn;i++){ pl.update(1/60); if(pl.aiEvCd>0) sawCd=true; if(sawCd&&pl.aiEvCd<=0&&pl.aiEvT<=0) break; }
out.r10c=(sawCd===true);                               // 窗毕进冷却 (不连躲)
if(pl.aiPilotOn){
pl.pos.set(0,60,60); pl.yaw=0; pl.pitch=0; pl.roll=0; pl.speed=50;
for(let i=0;i<30&&pl.aiPilotOn;i++) pl.update(1/60);
}
out.r10d=(r10shots>0);                                 // 冷却过后恢复攻击 (老飞行员不是只会躲)
// ── R10e 真·咬尾判据 + 破转反咬 (2026-09-30j, 用户裁定"过度躲避=窝囊且废物") ──
reset();
const realRCW10=raycastWorld; raycastWorld=()=>null;   // LOS 通畅 (防沙箱地形把接管中途收账)
pl.fireMGBurst=function(){ }; pl.dropBomb=function(){ };
const epB=eps[0];
epB.alive=true; epB.hp=epB.maxHp; epB.playerDriven=false;
pl.pos.set(0,60,0); pl.yaw=0; pl.pitch=0; pl.roll=0; pl.speed=50;
pl.lockTgt=tk;
planeTakeoverToggle();
epB.pos.set(0,60,-120); epB.yaw=0; epB.pitch=0; epB.roll=0; epB.speed=45; // 死后侧: 机头瞄我
pl.aiEvT=0; pl.aiEvCd=0; pl.aiEvSrc=null;
pl.update(1/60);
out.r10e_a=(pl.aiEvT>0&&pl.aiEvSrc===epB);             // 后半球咬尾置窗并记威胁源
pl.aiEvT=0; pl.aiEvCd=0; pl.aiEvSrc=null;
epB.pos.set(0,60,120); epB.yaw=Math.PI;                // 正前对头: 他机头瞄我, 但他在我机头方向
pl.update(1/60);
out.r10e_b=(pl.aiEvT<=0&&pl.aiEvSrc===null);           // 对头遭遇不触发规避 (旧版漏后半球判据=对头弃攻)
pl.aiEvT=0; pl.aiEvCd=0; pl.aiEvSrc=null;
pl.takeDmg(10,{alive:true,team:epB.team,onVehicle:epB,pos:epB.pos}); // 挨打置窗: 敌机射手=机组 Bot → 归位到座机记源
out.r10e_b2=(pl.aiEvT>0&&pl.aiEvSrc===epB);
pl.pos.set(0,60,0); pl.yaw=0; pl.pitch=0; pl.roll=0; pl.speed=50;
epB.pos.set(120,60,0); epB.yaw=0; epB.alive=true;      // 右前侧方 90°: 期望航向 +π/2
pl.aiEvT=1.2; pl.aiEvDur=1.2; pl.aiEvDir=-1; pl.aiEvSrc=epB; pl.aiEvCd=0; // 手动置窗 (朝威胁破转)
let eFired=0; pl.fireMGBurst=function(){ eFired++; };
pl.update(1/60);                                       // 仍在破转段 (>45% 分界 0.54)
out.r10e_c=(Math.abs(pl.fctl.bank+1)<1e-9);            // 前段满舵 (bank=dir=−1, 朝威胁)
const dyA=Math.abs(angDiff(pl.yaw,Math.atan2(epB.pos.x-pl.pos.x,epB.pos.z-pl.pos.z)));
for(let i=0;i<80&&pl.aiEvT>0;i++) pl.update(1/60);     // 走完整个窗 (含反舵回扫段)
const dyB=Math.abs(angDiff(pl.yaw,Math.atan2(epB.pos.x-pl.pos.x,epB.pos.z-pl.pos.z)));
out.r10e_d=(pl.aiEvCd>0&&pl.aiEvSrc===null&&dyB<dyA&&eFired>=0); // 窗毕清账进冷却, 机头整体转向威胁 (破转≠逃跑)
raycastWorld=realRCW10;
// ── R11 追低空/坠机目标 (热修④对偶面; 30k 行为改版): 追击钳高收窄后飞行员**压下去打**,
//      diveAGL 拉起闸托住本机 —— 低空咬住近距, 但全程不触地、始终压在目标上方 ──
reset();
const realRCW11=raycastWorld; raycastWorld=()=>null;   // 本组验低空追击与保底, 地形 LOS 不进判据
const epC=eps[0];
epC.alive=true; epC.pos.set(0,10,220); epC.yaw=0; epC.pitch=-0.5; epC.speed=40; // 失控下坠姿态 (不 update 它)
pl.lockTgt=epC;
pl.fireMGBurst=function(){ }; pl.dropBomb=function(){ };
planeTakeoverToggle();
out.r11a=(pl.aiPilotOn===true&&pl.aiPilotTgt===epC);
let r11fin=true;
for(let i=0;i<300;i++){ pl.update(1/60); if(!pl.alive||!isFinite(pl.pos.y)){ r11fin=false; break; } }
const aglE=pl.pos.y-heightAt(pl.pos.x,pl.pos.z);
out.r11b=(r11fin&&pl.aiPilotOn===true&&aglE>12&&pl.pos.y>epC.pos.y&&pl.pos.distanceTo(epC.pos)<120); // 5s 追击: 压到近距低空但不触地, 仍高于目标
raycastWorld=realRCW11;
// ── R12 缠斗低空保护 (2026-09-30 实机批, 用户报"Bot 飞机打着打着跑到低空去晃悠, 动作十分生硬"):
//      a) 贴地缠斗 → breakAGL 整帧改出, 保底线下零开火, 4s 内 AGL 回升到 breakAGL 之上;
//      b) 高位咬贴地目标 → 追击点钳 aimAGL, 5s 盘旋本机 AGL 不被拖到 aimAGL−12 以下 (旧版一路下沉贴地兜圈) ──
reset();
const eAi=eps[0];
const mkCrew=e=>{ if(!e.crewBot||!e.crewBot.alive) e.crewBot={alive:true,team:e.team,name:'测试飞行员',pos:e.pos,damage(){},score:0}; };
eAi.alive=true; eAi.hp=eAi.maxHp; eAi.playerDriven=false; mkCrew(eAi);
eAi.pos.set(0,heightAt(0,0)+24,0); eAi.yaw=0; eAi.pitch=0; eAi.roll=0; eAi.speed=40;
eAi.state='dogfight'; eAi.dogTgt=pl; pl.alive=true; pl.playerDriven=false; pl.crewBot=null;
pl.pos.set(60,heightAt(60,80)+10,80); // 目标贴地飞机 (AGL≈10)
eAi.fireT=0; eAi.avdT=0;
let r12fired=false, r12lowFire=false;
eAi.fireMGBurst=function(){ r12fired=true; if(eAi.pos.y-heightAt(eAi.pos.x,eAi.pos.z)<PLANE_AI.breakAGL-6) r12lowFire=true; };
eAi.dropBomb=function(){ };
let r12fin=true;
for(let i=0;i<240&&eAi.alive;i++){ eAi.update(1/60); if(!isFinite(eAi.pos.y)){ r12fin=false; break; } }
const agl12=eAi.pos.y-heightAt(eAi.pos.x,eAi.pos.z);
out.r12dbg=[+agl12.toFixed(1),eAi.alive?1:0,r12fired?1:0,r12lowFire?1:0];
out.r12a=(r12fin&&eAi.alive===true&&agl12>PLANE_AI.breakAGL&&r12lowFire===false);
eAi.fireMGBurst=function(){ }; // 恢复哑桩, 别让 a) 的间谍漏进 b)
eAi2reset:{ // b) 高位咬低位
eAi.alive=true; eAi.hp=eAi.maxHp;
eAi.pos.set(0,heightAt(0,0)+120,0); eAi.yaw=0; eAi.pitch=0; eAi.roll=0; eAi.speed=45;
eAi.state='dogfight'; eAi.dogTgt=pl; pl.alive=true; pl.pos.set(30,heightAt(30,60)+8,60);
eAi.fireT=0; eAi.avdT=0;
let minAgl=1e9;
for(let i=0;i<300&&eAi.alive;i++){ eAi.update(1/60); minAgl=Math.min(minAgl,eAi.pos.y-heightAt(eAi.pos.x,eAi.pos.z)); }
out.r12c=+minAgl.toFixed(1);
out.r12b=(eAi.alive===true&&minAgl>PLANE_AI.aimAGL-12);
}
// ── R13 低空敌机交战 (2026-09-30k, 用户报"敌机高度比较低时接管不去打"): 钳高收窄+俯冲档拉起闸后,
//      飞行员**向下打** (pitchT<0 — 旧版瞄准点被钳到敌机上 48m, 弹道掠顶), diveAGL 托底不触地, 压到近距 ──
reset();
const realRCW13=raycastWorld; raycastWorld=()=>null;   // LOS 不进判据
pl.fireMGBurst=function(){ }; pl.dropBomb=function(){ };
const epD=eps[0];
epD.alive=true; epD.hp=epD.maxHp; epD.playerDriven=false;
epD.pos.set(0,heightAt(0,220)+12,220); epD.yaw=0; epD.pitch=0; epD.roll=0; epD.speed=40; // 低空平飞 (旧版对它只盘旋不打)
pl.lockTgt=epD;
planeTakeoverToggle();
out.r13a=(pl.aiPilotOn===true&&pl.aiPilotTgt===epD);
const d13a=pl.pos.distanceTo(epD.pos);
let p13min=1e9, a13min=1e9, r13fin=true;
for(let i=0;i<300;i++){
pl.update(1/60); if(!pl.alive||!isFinite(pl.pos.y)){ r13fin=false; break; }
p13min=Math.min(p13min,pl.fctl.pitchT);
a13min=Math.min(a13min,pl.pos.y-heightAt(pl.pos.x,pl.pos.z));
}
const d13b=pl.pos.distanceTo(epD.pos);
out.r13dbg=[+p13min.toFixed(2),+a13min.toFixed(1),+d13b.toFixed(0)];
out.r13b=(r13fin&&p13min<-0.05&&a13min>PLANE_TAKEOVER.diveAGL-9&&d13b<100); // 向下打 + 俯冲档托底 + 咬到近距
raycastWorld=realRCW13;
// ── R14 航弹锁定+制导 (2026-09-30k): 带锁投弹 → 弹体限角速度掰向目标砸出反装甲全额; 无锁 = 诚实弹道。
//      场景=过冲修正: 前抛 34m/s 对 30m 前方目标, 无制导惯性飞 ~115m (过冲 ~75m), 制导在落体窗口内掰回命中。
//      (180° 掉头对 50m 投弹高度物理上不可能 —— 弹不是导弹, 转不过来摔地上是正确行为) ──
reset();
const realRCW14=raycastWorld; raycastWorld=()=>null;   // 命中判定只验弹道几何, 地形遮挡不进判据
delete pl.dropBomb; delete pl.fireMGBurst;             // R13 的实例影子桩摘掉, 恢复原型真 dropBomb (本组要真投弹)
pl.aiPilotOn=false; pl.aiPilotTgt=null;
pl.pos.set(0,50,10); pl.yaw=0; pl.pitch=0; pl.roll=0; pl.speed=40;  // 机头朝 +z 前抛
tk.alive=true; tk.hp=tk.maxHp; tk.pos.set(0,2,40);
pl.lockTgt=tk;
const nb0=nades.length;
pl.dropBomb(player);
const gdn=nades[nb0];
out.r14a=(nades.length===nb0+1&&!!gdn&&gdn.lock===tk);  // 带锁投弹挂账
const angOf=n=>{ const dx=tk.pos.x-n.pos.x, dy=tk.pos.y-n.pos.y, dz=tk.pos.z-n.pos.z;
const dl=Math.hypot(dx,dy,dz)||1, vvn=n.vel.length()||1;
return Math.acos(clamp((n.vel.x*dx+n.vel.y*dy+n.vel.z*dz)/(vvn*dl),-1,1)); };
const angA=angOf(gdn);
let r14fin=true; const trj=[];
for(let i=0;i<400&&nades.indexOf(gdn)>=0;i++){ updateNades(1/60,1/60); if(!isFinite(gdn.pos.x+gdn.pos.y+gdn.pos.z)){ r14fin=false; break; }
if(i%40===0) trj.push(gdn.pos.x.toFixed(0)+','+gdn.pos.y.toFixed(1)+','+gdn.pos.z.toFixed(0)); }
out.r14trj=trj.join(' | ')+' ⇒ 终点 '+gdn.pos.x.toFixed(0)+','+gdn.pos.y.toFixed(1)+','+gdn.pos.z.toFixed(0)+' (tk@0,40)';
const tkDmg=tk.maxHp-tk.hp;
out.r14dbg=[+angA.toFixed(2),+tkDmg.toFixed(0),tk.alive?1:0];
out.r14b=(r14fin&&angA>0.6&&tkDmg>400);                 // 前抛弹被掰回目标, 命中砸出击毁级伤害 (无制导必过冲)
tk.alive=true; tk.hp=tk.maxHp; tk.pos.set(0,2,40);      // c) 无锁阴性: 同位姿无 lockTgt → 不挂账, 弹道不拐
pl.pos.set(0,50,10); pl.yaw=0; pl.pitch=0; pl.roll=0; pl.speed=40;
pl.lockTgt=null;
const nb1=nades.length;
pl.dropBomb(player);
const dumb=nades[nb1];
out.r14c=(!!dumb&&!dumb.lock);
for(let i=0;i<90&&nades.indexOf(dumb)>=0;i++){ updateNades(1/60,1/60); }
out.r14d=(nades.indexOf(dumb)>=0?angOf(dumb)>1.0:true); // 1.5s 后仍顺前抛方向飞 (诚实弹道不拐弯)
raycastWorld=realRCW14;
return out;
}catch(e){ return 'EXC:'+String(e&&e.stack||e); }})()`,ctx);
if(typeof r==='string'){ console.log('  ✗ 运行时沙箱异常: '+r); FAIL++; }
else{
ok(r.r1ok,'R1 steerToward 收敛: 航向差 '+r.r1dy[0].toFixed(2)+'→'+r.r1dy[1].toFixed(3)+' rad (原语→fctl→flightStep 因果链)');
ok(r.r2a&&r.r2b,'R2 锁定扫描: 空中优先(锥内双机取最小偏角) / 空中全出射程回退地面 (对地锁定的用户痛点)');
ok(r.r2c&&r.r2d,'R2b 锥内全空 = 锁定失败 + planeLockToggle 端到端 (E/中键同一单源)');
ok(r.r3a&&r.r3b&&r.r3c,'R3 锁定维持: 锥内维持 / 超 45° 松锥掉锁 / 目标亡掉锁');
ok(r.r4a&&r.r4b,'R4a/b 接管激活 + 代打逼近: 4s 内向目标收敛, 无 NaN, aiPilot 态保持');
ok(r.r4c,'R4c 目标亡 → planeTakeoverEnd 收账 + 冷却 3s (2026-09-30j 8→3)');
ok(r.r4d&&r.r4e,'R4d/e 冷却门拦截歇息期再接管 / 清冷却后可再接管');
ok(r.r4f,'R4f 再按 Space = 交还控制 (再入冷却)');
ok(r.r5a&&r.r5b,'R5 LOS 宽限: 视线全遮 → '+r.r5f+' 帧内交还 (宽限 1.6s, 不做隔山代打)');
ok(r.r6a&&r.r6b,'R6 诚实弹道+全包: 自动投弹/对地扫射全部以 player 射手走 fireMGBurst/dropBomb 共用管线 (无制导旁路)');
ok(r.r7a&&r.r7b,'R7 不双打: 已被咬的敌机让位, 双机分追两目标');
ok(r.r8a&&r.r8b,'R8 HUD: 「AI 接管中」文案 + 无锁定收起 (20a 直写, sweep 兜底)');
ok(r.r9a&&r.r9b,'R9 保底高度双档 (热修④+30k): [agl0,agl1,minAgl,alive,on,lowFire]='+JSON.stringify(r.r9dbg)+' — 低空接管由 diveAGL 俯冲档托底, 档内恢复攻击 (低空目标在低空打), 档下零违规开火, 全程不触地');
ok(r.r10a&&r.r10b,'R10a/b 规避 (热修⑤): 挨打置窗, 窗内满舵破转且零开火');
ok(r.r10c&&r.r10d,'R10c/d 窄毕进冷却 (不连躲) + 冷却后恢复攻击 (老飞行员不是只会躲)');
ok(r.r10e_a&&r.r10e_b&&r.r10e_b2,'R10e 真·咬尾判据 (30j): 后半球咬尾置窗记源 / 对头遭遇不再触发规避 (旧版漏后半球判据=对头弃攻) / 挨打置窗把机组 Bot 射手归位到座机记源');
ok(r.r10e_c&&r.r10e_d,'R10e 破转反咬 (30j): 前段满舵朝威胁 · 整窗机头转向威胁 · 窗毕清账进冷却 (破转=反攻前半段, 非逃场)');
ok(r.r11a&&r.r11b,'R11 追低空/坠机目标 (热修④对偶面+30k 行为改版): 钳高收窄后压下去打 — 咬到近距低空但不触地, diveAGL 闸全程托底, 始终压在目标上方');
ok(r.r13a&&r.r13b,'R13 低空敌机交战 (30k 用户报"敌机低时接管不去打"): [minPitchT,minAgl,末距]='+JSON.stringify(r.r13dbg)+' — 飞行员向下打 (旧版瞄准点被钳到敌机上48m=弹道掠顶), diveAGL 托底不触地, 5s 咬到近距');
ok(r.r14a&&r.r14b,'R14 航弹锁定+制导 (30k): [释放角,坦克伤,坦克存活]='+JSON.stringify(r.r14dbg)+' 轨迹 '+r.r14trj+' — 带锁投弹挂账, 过冲前抛弹被限角速度掰回目标, 命中砸出击毁级伤害 (ap 全额; 无制导惯性飞 ~115m 必过冲)');
ok(r.r14c&&r.r14d,'R14b 无锁阴性: 弹不挂账, 1.5s 后仍背对目标 (诚实弹道不拐弯)');
ok(r.r12a,'R12a 缠斗低空保护: AGL '+r.r12dbg[0]+'m 收场 (breakAGL '+30+' 之上) · 保底线下零开火 · 贴地缠斗 4s 改出 [alive,fired,lowFire]='+JSON.stringify(r.r12dbg.slice(1)));
ok(r.r12b,'R12b 追击点钳 aimAGL: 高位咬贴地目标 5s 盘旋, 最低 AGL '+r.r12c+'m > '+(36-12)+'m (旧版一路盘旋下沉贴地)');
}
console.log('\n'+(FAIL===0?'verify-phase4-7b 全部通过 ✓ ('+PASS+')':'存在失败项 ✗ (过 '+PASS+' / 挂 '+FAIL+')'));
process.exit(FAIL===0?0:1);
