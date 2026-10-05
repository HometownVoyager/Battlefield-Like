// ─────────────────────────────────────────────
// dev/verify-nade-trigger-20260930.js —— 手雷触发引信 + 四弹种建模 + 贴地预瞄 + 投掷起点 (2026-09-30 / 批2)
// 用法: node dev/verify-nade-trigger-20260930.js
// 用户裁定 (批1): ① 手雷在"引信到点炸"的基础上, 触地或接触到可攻击目标时也要炸;
//                ② 四种投掷物出手前手上必须各不相同, 并优化各自的建模;
//                ③ 预瞄抛物线/落点圈要"聚焦在落点的地上"。
// 用户裁定 (批2, 复报五条): ④ 引爆 = **引信到点 且 (触地|命中合法目标)** —— 到点本身不炸(无空炸), 举雷到点也不自爆;
//                ⑤ 预瞄"沿视线直往正前方、一人称就是一条线段、三人称与一人称完全一致、只按空炸做不显示落地范围"
//                   ⇒ 出手点改右手(不在相机轴线上)、方向汇聚准星、**总画**地面落点圈;
//                ⑥ 三人称举雷姿势只保持 0.45s 就变回持枪 ⇒ 举雷待发位姿常驻 + 手上真握一颗雷。
// 断言:
//   S1 源码锚: F1 触发引信单源 (NADE_ARMED_BY_FUSE/双条件收口/空炸与自爆路径绝迹) ·
//              F1b 出手点/方向单源 (playerThrowOrigin/Dir, 旧相机起点绝迹) ·
//              F2 四弹种建模单源 (buildNadeMesh/NADE_KINDS/NADE_WORLD_SCALE/手上四件/旧单模型绝迹) ·
//              F2b 三人称举雷待发 (playerNadeReady/位姿常驻/关 IK/手上雷模) ·
//              F3 贴地预瞄 (nadeGroundRing/SVG 四件/CSS 屏幕正圆绝迹);
//   B1 四件模型互不相同 (行为, 真建网格量包围盒/三角数);
//   B2 触发引信 (行为): 全引信档落地只弹跳不提前炸 / 厨雷档首次触地即炸(零弹跳) /
//      **引信在空中到点不炸**(空炸阴性) / 撞敌方躯干即炸 / 友军阴性 / **举满 3.8s 不自爆**(自雷阴性);
//   B3 预演=实弹 (行为): 预演落点环逐点投影 = 贴地椭圆 (真透视下长宽比 ≈0.05; 阴性对照: 屏幕正圆必然 ≈1),
//      且 #naDot 与真投弹爆点投影同点 (≤12px) —— "指哪炸哪"的行为级证据;
//   B4 预演空间感 (行为): 点串**不是竖直直线** (x 展开 50px; 阴性对照: 旧相机起点仅 0px) /
//      三人称机位下形状不同 / 厨雷档照样画地面落点圈。
// 判据口径: 源码锚按签名子串 (不记行号); 行为判据调用游戏自身接口 (throwNade/releaseNade/updateNades/
// updatePlayer/updateNadeArc/buildNadeMesh/vmNadeShow), 不重写第二套状态机; 每组至少一条阴性对照。
// 场地口径: CLEARSPOT 除"净空平地"外还要求**正前方 45m 弹道走廊净空** —— 出手方向汇聚准星命中点,
//   站在墙前会让落点缩短, 与"平地满弧"类判据冲突 (批2 实测 11m/44m 两端都出现过)。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const {sandbox,document,window,byId}=require('./_bootstub.js');
require('./_bootpatch.js').patch(sandbox);
const _O3=sandbox.THREE.Object3D;
if(_O3&&_O3.prototype&&!_O3.prototype.clear) _O3.prototype.clear=function(){ if(this.children) this.children.length=0; return this; };
sandbox.confirm=()=>true;
const handlers={};
sandbox.addEventListener=(t,f)=>{ (handlers[t]=handlers[t]||[]).push(f); };
sandbox.removeEventListener=()=>{};
function realCL(el){
const set=new Set(); const sync=()=>{ el.className=[...set].join(' '); };
return { add:(...cs)=>{cs.forEach(c=>set.add(c));sync();},
remove:(...cs)=>{cs.forEach(c=>set.delete(c));sync();},
toggle(c,f){ set.has(c)?set.delete(c):set.add(c); sync(); return set.has(c); },
contains:c=>set.has(c) };
}
const patchEl=e=>{ if(!e) return e;
if(e.style&&!e.style.setProperty) e.style.setProperty=function(k,v){ this[k]=v; };
if(!e.__realCL){ e.classList=realCL(e); e.__realCL=1; }
// 贴地圈走 SVG setAttribute('d', ...): 桩的 setAttribute 是空实现 ⇒ 加一层记账 (桩不忠实补齐, 同 firstChild)
if(!e.__realAttr){ e.__realAttr=1; e.__attrs=e.__attrs||{};
const sa=e.setAttribute.bind(e); e.setAttribute=(k,v)=>{ e.__attrs[k]=v; sa(k,v); }; }
return e; };
{ const g=document.getElementById.bind(document),c=document.createElement.bind(document);
document.getElementById=id=>patchEl(g(id)); document.createElement=t=>patchEl(c(t)); }
// FILES 与 index.html 实载清单逐个对齐 (D1 教训: 探针载入清单缺哪个, 那个子系统就不存在)
const idxSrc=fs.readFileSync(path.join(root,'index.html'),'utf8');
const FILES=[...idxSrc.matchAll(/src="([^"?]+\.js)/g)].map(m=>m[1]).filter(f=>/^js\//.test(f));
if(FILES.length<41){ console.log('  ✘ FILES 解析异常: 只抓到 '+FILES.length+' 个脚本 (应 ≥41)'); process.exit(1); }
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document; ctx.window=window; ctx.__evH=handlers;
const Quat=class{ constructor(){this.x=0;this.y=0;this.z=0;this.w=1;} set(x,y,z,w){this.x=x;this.y=y;this.z=z;this.w=w;return this;} setFromEuler(){return this;} setFromAxisAngle(){return this;} copy(q){Object.assign(this,q);return this;} mult(){return this;} normalize(){return this;} };
const CV3=sandbox.THREE.Vector3;
const CANNON_STUB={Vec3:CV3,Quaternion:Quat,
World:class{ constructor(){ this.gravity=new CV3(); this.broadphase=null; this.solver={iterations:0}; this.bodies=[]; } addBody(b){ this.bodies.push(b); } removeBody(b){ const i=this.bodies.indexOf(b); if(i>=0) this.bodies.splice(i,1); } add(b){ this.addBody(b); } remove(b){ this.removeBody(b); } addConstraint(){} removeConstraint(){} step(){} },
Body:class{ constructor(o){ Object.assign(this,o||{}); this.shapes=[]; this.position=new CV3(); this.velocity=new CV3(); this.angularVelocity=new CV3(); this.quaternion=new Quat(); } addShape(s){ this.shapes.push(s); } },
Box:class{}, Sphere:class{}, Material:class{}, ContactMaterial:class{}, NaiveBroadphase:class{}, PointToPointConstraint:class{}};
ctx.CANNON=CANNON_STUB;
ctx.localStorage={_s:{sf_campaign:'0',sf_exp:'1'},getItem(k){return (k in this._s)?this._s[k]:null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of FILES) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
const R=x=>vm.runInContext(x,ctx);
try{ R(`SPAWN_PROT=0; document.getElementById('startBtn').onclick(); for(const s of combatants) s.protUntil=0;`); }catch(e){ console.log('  开局异常: '+e); }
// 桩不忠实补齐: V3 桩没有 project/applyMatrix4 (真 three 有) —— 按真 three 公式补原型 (行为判据只认
// "环画没画出来/长什么样", 不重写物理)。相机矩阵由 setCam 手填成**真透视** (旧版探针给的是正交近似,
// 那种投影下落地的圆盘会退化成一条线, 分辨不出"贴地椭圆"与"屏幕正圆")。
R(`(()=>{
const VP=THREE.Vector3.prototype;
if(!VP.applyMatrix4) VP.applyMatrix4=function(m){ const e=m.elements;
const x=this.x,y=this.y,z=this.z;
const w=(e[3]*x+e[7]*y+e[11]*z+e[15])||1;
this.x=(e[0]*x+e[4]*y+e[8]*z+e[12])/w;
this.y=(e[1]*x+e[5]*y+e[9]*z+e[13])/w;
this.z=(e[2]*x+e[6]*y+e[10]*z+e[14])/w;
return this; };
if(!VP.project) VP.project=function(cam){ return this.applyMatrix4(cam.matrixWorldInverse).applyMatrix4(cam.projectionMatrix); };
})()`);
// 桩不忠实补齐 2: Object3D 桩没有 matrixWorld/updateMatrixWorld (真 three 有, 构造时建立) —— B1 要按
// 世界包围盒量"四件体量各不相同", 没有它连 mesh 的世界坐标都取不到。这里按"平移+缩放"合成 (模型里的
// 旋转只有握片/拉环的小角度, 量体量时忽略不误事; 与 isMesh/firstChild/lastChild 同规: 桩缺件, 不是被测代码问题)。
R(`(()=>{
const P=THREE.Object3D.prototype;
if(!P.updateMatrixWorld) P.updateMatrixWorld=function(){};
if(!Object.getOwnPropertyDescriptor(P,'matrixWorld')){
Object.defineProperty(P,'matrixWorld',{configurable:true,
get(){ const key=this.position.x+','+this.position.y+','+this.position.z;
if(!this.__mw||this.__mwKey!==key){
const sc=this.scale||{x:1,y:1,z:1};
const e=new Float32Array(16);
e[0]=sc.x; e[5]=sc.y; e[10]=sc.z; e[15]=1;
e[12]=this.position.x; e[13]=this.position.y; e[14]=this.position.z;
this.__mw={elements:e}; this.__mwKey=key; }
return this.__mw; }});
}
})()`);
// 相机俯仰可调的真透视投影 (eye/pitch/fov/aspect) —— 列主序与真 three 一致
function setCam(eye,pitch,fovDeg,aspect){
R(`(()=>{
const ex=${eye.x}, ey=${eye.y}, ez=${eye.z}, p=${pitch};
const c=Math.cos(p), s=Math.sin(p);
const v=new Float32Array(16);
v[0]=1; v[5]=c; v[6]=-s; v[9]=s; v[10]=c; v[15]=1;
v[12]=-ex; v[13]=-(c*ey+s*ez); v[14]=s*ey-c*ez;
camera.matrixWorldInverse={elements:v}; camera.matrixWorld={elements:v};
const f=1/Math.tan(Math.PI*${fovDeg}/360), n=0.1, fa=1000;
const P=new Float32Array(16);
P[0]=f/${aspect}; P[5]=f; P[10]=(fa+n)/(n-fa); P[11]=-1; P[14]=2*fa*n/(n-fa);
camera.projectionMatrix={elements:P}; camera.updateMatrixWorld=()=>{};
})()`);
}
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const strip=s=>s.replace(/\/\/[^\n]*/g,'');
let PASS=0, FAILS=0;
const ok=(c,msg)=>{ if(c){ PASS++; console.log('  ✔ '+msg); } else { FAILS++; console.log('  ✘ '+msg); } };
const has=(src,sub,msg)=>ok(src.indexOf(sub)>=0,msg+'   [源码含: '+JSON.stringify(sub.slice(0,56))+'…]');
const lacks=(src,sub,msg)=>ok(strip(src).indexOf(sub)<0,msg+'   [源码已无: '+JSON.stringify(sub.slice(0,56))+'…]');
// 净空平地扫描 (探针卫生: 位移/爆炸类判据不贴建筑) —— 与同族探针同口径
const CLEARSPOT=`(()=>{ let spot=null;
for(let i=0;i<900&&!spot;i++){
const x=player.pos.x+(Math.random()*160-80), z=player.pos.z+(Math.random()*160-80);
const gh=heightAt(x,z);
if(waterYAt(x,z)>-1e8) continue;
if(Math.abs(gh-heightAt(x+6,z))>0.35||Math.abs(gh-heightAt(x,z+6))>0.35) continue;
let blocked=false;
for(let a=0;a<8;a++){ const dx=Math.sin(a*Math.PI/4), dz=Math.cos(a*Math.PI/4);
if(raycastWorld(V3(x,gh+1.2,z),V3(dx,0,dz),10)){ blocked=true; break; } }
// ★2026-09-30 批2: 还要**正前方(-z)45m 弹道走廊净空** —— 投掷方向是"从手指向准星命中点"
// (tpAimPoint 含世界几何), 站在楼前/墙前时出手方向会朝那个命中点收敛 (指哪炸哪的正常行为),
// 落点随之缩短(实测 11m/40m 都有)。本文件所有投掷判据都按"平地满弧"写, 所以场地必须整条走廊净空。
if(!blocked&&raycastWorld(V3(x,gh+1.62,z),V3(0,0,-1),45)) blocked=true;
if(!blocked) spot={x,z,gh};
} return spot; })()`;
const HEIGHT_OF=`(g=>{ let y0=1e9,y1=-1e9; g.updateMatrixWorld(true);
g.traverse(o=>{ if(!o.isMesh) return; const p=o.geometry.attributes.position;
for(let i=0;i<p.count;i++){ const v=V3(p.getX(i),p.getY(i),p.getZ(i)).applyMatrix4(o.matrixWorld); y0=Math.min(y0,v.y); y1=Math.max(y1,v.y);} });
return +(y1-y0).toFixed(3); })`;

console.log('══ 手雷触发引信 + 四弹种建模 + 贴地预瞄批 (dev/verify-nade-trigger-20260930.js) ══');

// ═════ S1 源码锚 ═════
console.log('S1 源码锚');
{
const cfg=read('js/00-config.js'), combat=read('js/13-combat.js'), weap=read('js/09-weapons.js'),
vmw=read('js/10-viewmodel.js'), hud=read('js/22-hud.js'), css=read('css/style.css'), idx=read('index.html'),
pl=read('js/20-player.js'), game=read('js/18-game.js');
console.log('  ─ F1 触发引信单源');
has(cfg,'const NADE_ARMED_BY_FUSE={frag:true,smoke:true,incin:true}','F1a NADE_ARMED_BY_FUSE 单源表 (表内=引信到点才武装; 表外 AT/航弹/迫击炮=出手即武装)');
lacks(cfg,'NADE_ARM_T','F1b 旧武装延时 NADE_ARM_T 绝迹 (引信到点即武装完成, 不再另设武装期)');
has(cfg,'只有触地或命中合法目标才爆炸','F1b2 用户裁定原话入注 (批2 双条件口径有据可查)');
has(combat,'function nadeStep(st,dt)','F1c nadeStep 单源积分器');
has(combat,'function nadeContactTarget(x,y,z,team,thrower)','F1d 接触判据 nadeContactTarget (敌兵躯干)');
has(combat,'const ev=nadeStep(n,ndt)','F1e updateNades 逐枚走 nadeStep');
lacks(combat,"if(st.fuse<=0) return 'blow'","F1f 空炸路径绝迹 (引信到点不再直接引爆 —— 批2 用户裁定)");
has(combat,'const armed=!st.armOnFuse||st.fuse<=0','F1g 武装判据 (表内看引信到点; 表外出手即武装)');
has(combat,'const touchG=ny<=gh+0.05','F1h 接触判据之触地');
has(combat,'if(touchG||touchT||hitVeh||(!st.armOnFuse&&bounced))','F1i 引爆 = **武装 且 接触** 双条件收口 (触敌/触载具/撞墙分档)');
has(combat,'armOnFuse:!!NADE_ARMED_BY_FUSE[kind]','F1j throwNade 挂"武装方式"旗');
lacks(combat,'n.fuse=Math.min(n.fuse,0.02)','F1k 旧"撞墙改引信"绝迹 (反坦克族接触口径收口进 nadeStep)');
lacks(combat,'n.vel.y*=-0.38','F1l 旧抄写件绝迹 (物理只此一份)');
lacks(combat,'n.fuse-=ndt','F1m 旧引信倒计时绝迹 (收口进 nadeStep)');
has(hud,'nadeStep(st,NADE_ARC_STEP)','F1n 预演与实弹同一积分器');
console.log('  ─ F1b 出手点/方向单源 + 自雷绝迹 (2026-09-30 批2)');
has(pl,'function playerThrowOrigin()','F1o 出手点单源 playerThrowOrigin (右手 —— 起点不在相机轴线上)');
has(pl,'function playerThrowDir(o)','F1p 出手方向单源 playerThrowDir (从手指向准星命中点)');
lacks(game,'camera.position.clone().add(dir.clone().multiplyScalar(0.3))','F1q 旧"相机起点"绝迹 (releaseNade)');
has(game,'playerThrowOrigin()','F1r releaseNade 走单源起点');
has(hud,'playerThrowOrigin()','F1s 预演走同一单源起点 (预演即实弹)');
lacks(pl,'explodeAt(p.pos.clone().add(V3(0,1,0)),p)','F1t 手中自爆路径绝迹 (举雷到点不自炸 —— 用户报"仍会自雷"的根因)');
has(pl,'if(p.nadeHeld) p.nadeFuse=Math.max(0,p.nadeFuse-dt)','F1u 引信照走但只到 0 为止 (保留计时, 不自爆)');
has(hud,"box.className.indexOf('naWater')",'F1v 入水哑火档降档着色');
console.log('  ─ F2 四弹种建模单源');
has(weap,'function buildNadeMesh(kind,team)','F2a buildNadeMesh 单源建模入口');
has(weap,"const NADE_KINDS=['frag','smoke','incin','at']","F2b NADE_KINDS 四档");
has(weap,'const NADE_WORLD_SCALE=1.5','F2c 出手件放大单源');
has(weap,'function nadeFuzetop','F2d 引信组共用件 (引信头/握片/拉环)');
has(weap,"fam==='stickS'",'F2e 木柄雷苏式档 (旧版只分 egg/stick, stickS 被当 stick)');
lacks(weap,'function buildNadeModel(','F2f 旧单模型 buildNadeModel 绝迹');
has(combat,'buildNadeMesh(kind,thrower.team)','F2g 出手件与手上件同源');
lacks(combat,'nadeGeoSmoke','F2h 旧出手件几何绝迹 (烟雾)');
lacks(combat,'smokeCanMat','F2i 旧罐身材质绝迹');
has(vmw,'VM.nadeMs={}','F2j 手上四件齐建');
has(vmw,'function vmNadeKind()','F2k 弹种判序单源 vmNadeKind');
has(vmw,'vmNadeShow(nk)','F2l 持雷期按弹种切换手上件');
has(hud,'const type=vmNadeKind()','F2m 预演弹种同源');
console.log('  ─ F2b 三人称举雷待发 + 手上真雷 (2026-09-30 批2)');
has(pl,'function playerNadeReady(p)','F2n 举雷待发判据单源 (按住持雷 / 刚松手但出手帧未到)');
has(pl,'const nadeHold=playerNadeReady(p)','F2o 姿态机接入举雷态 (不再只靠 0.45s 衰减计时驱动)');
has(pl,'} else if(nadeHold){','F2p 举雷位姿常驻分支 (蓄力位姿 = 投掷弧起点, 松手无缝)');
has(pl,'const handK=(nadeK>0||nadeHold||bandK>0)?0','F2q 举雷期关掉手臂 IK (否则双手被 IK 抓回枪上)');
has(pl,'avNadeSync(av,p,nadeK,nadeHold)','F2r 三人称手上雷模每帧同步');
has(pl,'function avNadeSync(av,p,nadeK,nadeHold)','F2s 手上雷模 = buildNadeMesh 单源 × NADE_WORLD_SCALE');
has(pl,'const show=nadeHold||nadeK>0.5','F2t 出手帧 (k>0.5) 前手上还有雷, 之后脱手');
lacks(pl,'av._gun.visible=!(nadeK>0||bandK>0)','F2u 旧"只按投掷弧收枪"绝迹 (举雷期一直握着步枪就是它)');
console.log('  ─ F3 贴地预瞄');
has(hud,'function nadeGroundRing(cx,cz,r)','F3a 贴地圆环 (圆周逐点取地形高后逐点投影)');
has(hud,'NADE_ARC_SPOT_R=0.45','F3b 精确弹着点圈半径常量');
has(idx,'<svg id="naSvg"','F3c SVG 容器在 index.html');
has(idx,'id="naBlast"','F3d 爆圈路径元素');
has(idx,'id="naSpot"','F3e 落点精确圈元素');
has(idx,'id="naAir"','F3f 空炸环元素');
has(css,'#nadeArc #naBlast {','F3g 爆圈样式');
lacks(css,'.naRing','F3h 旧"屏幕正圆"元素样式绝迹');
}

// ═════ B1 四件模型 (行为) ═════
console.log('B1 四弹种建模 (行为)');
{
const out=R(`(()=>{ const out={};
const dim=k=>{ const g=buildNadeMesh(k,0); g.updateMatrixWorld(true);
let x0=1e9,y0=1e9,z0=1e9,x1=-1e9,y1=-1e9,z1=-1e9,n=0,tri=0;
g.traverse(o=>{ if(!o.isMesh) return; n++;
const p=o.geometry.attributes.position; tri+=o.geometry.index?o.geometry.index.count/3:p.count/3;
for(let i=0;i<p.count;i++){ const v=V3(p.getX(i),p.getY(i),p.getZ(i)).applyMatrix4(o.matrixWorld);
x0=Math.min(x0,v.x);x1=Math.max(x1,v.x);y0=Math.min(y0,v.y);y1=Math.max(y1,v.y);z0=Math.min(z0,v.z);z1=Math.max(z1,v.z);} });
return { n, tri, w:+(x1-x0).toFixed(3), h:+(y1-y0).toFixed(3), d:+(z1-z0).toFixed(3) }; };
out.frag=dim('frag'); out.smoke=dim('smoke'); out.incin=dim('incin'); out.at=dim('at');
out.eggH=${HEIGHT_OF}(buildNadeMesh('frag',0));
out.gerH=${HEIGHT_OF}(buildNadeMesh('frag',1));
// stickS (苏式) 只在"苏军参战"的战役里可达 (TEAM_FACTION 按战役 f 对填 0/1 两队) —— 本探针 boot 的是
// 诺曼底 (美/德), 故模拟一次苏军战役的阵营表再建 (nadeFamilyOf 是调用时读表, 语义与真局一致)
const saved1=TEAM_FACTION[1]; TEAM_FACTION[1]=FACTIONS.sov;
out.sovH=${HEIGHT_OF}(buildNadeMesh('frag',1));
TEAM_FACTION[1]=saved1;
player.nadeIsAT=false; player.nadeIsSmoke=false; player.nadeIsIncin=false; out.k0=vmNadeKind();
player.nadeIsSmoke=true; out.k1=vmNadeKind();
player.nadeIsSmoke=false; player.nadeIsIncin=true; out.k2=vmNadeKind();
player.nadeIsIncin=false; player.nadeIsAT=true; out.k3=vmNadeKind();
player.nadeIsAT=false;
vmEquip('garand',0);
vmNadeShow('smoke');
out.vmKinds=Object.keys(VM.nadeMs).join(',');
out.vmVis=NADE_KINDS.map(k=>VM.nadeMs[k].visible?1:0).join('');   // '0100' = 只有 smoke 在显
out.vmPicked=(VM.nadeM===VM.nadeMs.smoke);
vmNadeShow('at');
out.vmPicked2=(VM.nadeM===VM.nadeMs.at)&&!VM.nadeMs.smoke.visible;
// 真状态机接线: 摆成"举着烟雾弹瞄准"再跑一帧 updateViewModel —— 手上件必须自动切到烟雾罐 (用户报的正题)
vmEquip('garand',0);
VM.state='nade'; VM.stateDur=999; VM.stateT=0.2; VM.nadeKind=null;
player.nadeHeld=true; player.nadeIsAT=false; player.nadeIsSmoke=true; player.nadeIsIncin=false;
player.alive=true; player.spectator=false;
updateViewModel(1/60,player);
out.liveKind=vmNadeKind();
out.liveVis=NADE_KINDS.map(k=>VM.nadeMs[k].visible?1:0).join('');
out.liveGun=VM.gunParts.gun.visible;
out.livePicked=(VM.nadeM===VM.nadeMs.smoke);
player.nadeIsSmoke=false; player.nadeIsAT=true;
updateViewModel(1/60,player);
out.liveVis2=NADE_KINDS.map(k=>VM.nadeMs[k].visible?1:0).join('');
out.livePicked2=(VM.nadeM===VM.nadeMs.at);
player.nadeIsAT=false; player.nadeHeld=false; VM.state='idle'; VM.stateDur=0;
vmNadeShow('frag'); VM.nadeMs.frag.visible=false; VM.nadeM=null;
return out; })()`);
const dims=[out.frag,out.smoke,out.incin,out.at];
const sig=d=>d.w+'x'+d.h+'x'+d.d;
ok(dims.every(d=>d&&d.tri>0),'B1 四件都建得出网格 (三角数 '+dims.map(d=>Math.round(d.tri)).join('/')+')');
let uniq=true; for(let i=0;i<4;i++) for(let j=i+1;j<4;j++) if(sig(dims[i])===sig(dims[j])) uniq=false;
ok(uniq,'B1 四件体量两两不同 ('+dims.map(d=>sig(d).replace(/x/g,'×')).join(' · ')+')');
ok(out.at.h>out.frag.h*1.6,'B1 反坦克装药明显大于手雷 (高 '+out.at.h+'m vs '+out.frag.h+'m)');
ok(out.smoke.h>out.incin.h,'B1 烟雾罐细长 / 燃烧罐矮胖 (高 '+out.smoke.h+'m vs '+out.incin.h+'m)');
ok(out.eggH!==out.gerH&&out.gerH!==out.sovH&&out.eggH!==out.sovH,'B1 三档阵营剪影各不相同 (卵形 '+out.eggH+'m / 德式 '+out.gerH+'m / 苏式 '+out.sovH+'m)');
ok(out.k0==='frag'&&out.k1==='smoke'&&out.k2==='incin'&&out.k3==='at','B1 vmNadeKind 四档判序 (frag/smoke/incin/at)');
ok(out.vmKinds==='frag,smoke,incin,at','B1 手上四件齐挂 ('+out.vmKinds+')');
ok(out.vmVis==='0100','B1 vmNadeShow 单选显隐 (vis='+out.vmVis+', smoke 位=1 其余 0)');
ok(out.vmPicked===true&&out.vmPicked2===true,'B1 VM.nadeM 指向当前展示件 (外部只写 VM.nadeM.visible 的旧路径仍成立)');
ok(out.livePicked===true&&out.liveVis==='0100'&&out.liveGun===false,'B1 真状态机: 举烟雾弹一帧后手上换烟雾罐 (vis='+out.liveVis+', 枪收起='+(out.liveGun===false)+')');
ok(out.livePicked2===true&&out.liveVis2==='0001','B1 真状态机: 换反坦克雷立刻换件 (vis='+out.liveVis2+') —— 弹种切换即换手模');
}

// ═════ B2 触发引信: 武装 且 接触 双条件 (行为) ═════
console.log('B2 触发引信: 武装 且 接触 (行为)');
{
// B2-1 全引信档 (3.8s): 落地照旧弹跳滚动, 引信到点在地面上炸 —— "到点不再空炸"
const a=R(`(()=>{ const out={};
const spot=${CLEARSPOT}; out.spot=!!spot; if(!spot) return out;
player.pos.set(spot.x,spot.gh,spot.z);
camera.position.set(spot.x,spot.gh+1.62,spot.z);
player.vel=V3(0,0,0); player.alive=true; player.team=0; player.yaw=0;
player.nadeCount=1; player.nadeFuse=3.8;
player.nadeIsAT=false; player.nadeIsSmoke=false; player.nadeIsIncin=false;
player.releaseNade();
const n=nades[nades.length-1];
let goneAt=-1, blow=V3(0,0,0), t=0, bounced=0, firstGround=-1, prevV=n.vel.y;
for(let i=0;i<900;i++){
updateNades(1/60,1/60); t+=1/60;
if(nades.indexOf(n)<0){ goneAt=i; blow.copy(n.pos); break; }
if(n.vel.y>0.15&&prevV<-0.15) bounced++;
prevV=n.vel.y;
if(firstGround<0&&n.pos.y<=heightAt(n.pos.x,n.pos.z)+0.06) firstGround=i;
}
out.goneAt=goneAt; out.t=+t.toFixed(2); out.bounced=bounced; out.firstGround=firstGround;
out.blowY=+blow.y.toFixed(3); out.groundY=+heightAt(blow.x,blow.z).toFixed(3);
out.onGround=Math.abs(blow.y-(heightAt(blow.x,blow.z)+0.05))<0.25;
out.dist=+Math.hypot(blow.x-spot.x,blow.z-spot.z).toFixed(1);
out.lat=+(Math.abs(blow.x-spot.x)/Math.max(out.dist,1e-6)).toFixed(3);   // 侧向占比 (0 = 正前方)
return out; })()`);
ok(a.spot===true,'B2 净空平地扫描命中 (判据场地非空转)');
ok(a.goneAt>=0&&a.onGround===true,'B2 全引信档: 爆点在**地面**上 (y='+a.blowY+' vs 地面 '+a.groundY+')');
ok(a.bounced>=1&&a.firstGround>=0,'B2 引信未到点: 触地照旧弹跳滚动, 不提前引爆 (弹跳 '+a.bounced+' 次, 首触地帧 '+a.firstGround+') —— 阴性: 这就是"到点才炸"的反面');
ok(a.t>3.4&&a.t<4.4,'B2 引信照走 (保留计时): 实测 '+a.t+'s ≈ 3.8s 引信 —— 落地并不提前炸');
ok(a.dist>15&&a.lat<0.35,'B2 爆点落在投掷弧上 ('+a.dist+'m 外侧向仅 '+a.lat*100+'%, 26m/s 平地满弧 21m + 弹跳滚走) —— 不是炸在脚下');

// B2-2 厨雷档 (引信 0.15s 烧在空中): 武装完成 ⇒ **首次触地即炸**, 零弹跳
const b=R(`(()=>{ const out={};
const spot=${CLEARSPOT}; if(!spot) return out;
player.pos.set(spot.x,spot.gh,spot.z);
camera.position.set(spot.x,spot.gh+1.62,spot.z);
player.vel=V3(0,0,0); player.alive=true; player.team=0; player.yaw=0;
player.nadeCount=1; player.nadeFuse=0.15;
player.nadeIsAT=false; player.nadeIsSmoke=false; player.nadeIsIncin=false;
player.releaseNade();
const n=nades[nades.length-1];
out.armOnFuse=n.armOnFuse;
let goneAt=-1, blow=V3(0,0,0), t=0, bounced=0, prevV=n.vel.y;
for(let i=0;i<600;i++){
updateNades(1/60,1/60); t+=1/60;
if(nades.indexOf(n)<0){ goneAt=i; blow.copy(n.pos); break; }
if(n.vel.y>0.15&&prevV<-0.15) bounced++;
prevV=n.vel.y;
}
out.goneAt=goneAt; out.t=+t.toFixed(2); out.bounced=bounced;
out.dy=+(blow.y-(heightAt(blow.x,blow.z)+0.05)).toFixed(3);
out.dist=+Math.hypot(blow.x-spot.x,blow.z-spot.z).toFixed(1);
out.lat=+(Math.abs(blow.x-spot.x)/Math.max(out.dist,1e-6)).toFixed(3);
return out; })()`);
ok(b.armOnFuse===true,'B2-厨雷 表内弹种 armOnFuse=true (引信到点才武装)');
ok(b.goneAt>=0&&b.bounced===0&&b.dy<0.2,'B2-厨雷 武装完成后**首次触地即炸**, 全程零弹跳 ('+b.t+'s, y-地='+b.dy+'m)');
ok(b.dist>15&&b.lat<0.35,'B2-厨雷 爆点同样落在投掷弧上 ('+b.dist+'m 外侧向仅 '+b.lat*100+'%) —— 炸在落地处, 不是炸在起点');

// B2-3 ★核心裁定: **没有空炸** —— 引信在空中到点 ≠ 炸
const c=R(`(()=>{ const out={};
const spot=${CLEARSPOT}; if(!spot) return out;
throwNade(player,V3(spot.x,spot.gh+1.62,spot.z),V3(0,9,0),0.4,false,false,false);
const n=nades[nades.length-1];
let aliveAir=0, goneAt=-1, blow=V3(0,0,0), t=0, maxY=-1e9;
for(let i=0;i<900;i++){
updateNades(1/60,1/60); t+=1/60;
if(nades.indexOf(n)<0){ goneAt=i; blow.copy(n.pos); break; }
const h=n.pos.y-heightAt(n.pos.x,n.pos.z);
maxY=Math.max(maxY,h);
if(t>0.45&&t<1.2) aliveAir++;
}
out.aliveAir=aliveAir; out.goneAt=goneAt; out.t=+t.toFixed(2); out.maxY=+maxY.toFixed(2);
out.dy=+(blow.y-heightAt(blow.x,blow.z)).toFixed(2);
return out; })()`);
ok(c.aliveAir>=30,'B2-核心 引信(0.4s)在**空中**到点: 手雷照飞不炸 (0.45~1.2s 在世 '+c.aliveAir+' 帧, 最高 '+c.maxY+'m) —— 空炸已不存在');
ok(c.goneAt>=0&&c.dy<0.3,'B2-核心 落回地面才炸 (y-地='+c.dy+'m, '+c.t+'s) —— 引爆 = 武装 且 接触');

// B2-4 撞敌方士兵躯干即炸 (武装后) / 同位置友军不炸 (阴性)
const d=R(`(()=>{ const out={};
const spot=${CLEARSPOT}; if(!spot) return out;
const run=(enemy)=>{
for(const s of soldiers) if(s!==player){ s.alive=true; s.pos.set(9999,9999,9999); }
const tgt=soldiers.find(s=>s!==player&&(enemy?(s.team!==player.team):(s.team===player.team)))||null;
if(!tgt) return null;
// 身体对准弹道: 出手点前方 15m 处弹道高度 = 1.62+2.4t-4.9t² (t=15/26); 躯干心 = pos.y+1.10 (站立)
const t=15/26, ty=1.62+2.4*t-4.9*t*t;
tgt.alive=true; tgt.spectator=false; tgt.onVehicle=null; tgt.onNaval=null; tgt.prone=false;
tgt.pos.set(spot.x,spot.gh+1.62-ty+ty-1.10,spot.z-15);
player.pos.set(spot.x,spot.gh,spot.z);
camera.position.set(spot.x,spot.gh+1.62,spot.z);
player.vel=V3(0,0,0); player.alive=true; player.team=0; player.yaw=0;
player.nadeCount=1; player.nadeFuse=0.15;   // 武装后才可能"撞即炸"
player.nadeIsAT=false; player.nadeIsSmoke=false; player.nadeIsIncin=false;
player.releaseNade();
const n=nades[nades.length-1];
let goneAt=-1, blow=V3(0,0,0), t2=0;
for(let i=0;i<600;i++){
updateNades(1/60,1/60); t2+=1/60;
if(nades.indexOf(n)<0){ goneAt=i; blow.copy(n.pos); break; }
}
return { goneAt, t:+t2.toFixed(2), dy:+(blow.y-heightAt(blow.x,blow.z)).toFixed(2),
dz:+(blow.z-(spot.z-15)).toFixed(2) };
};
out.enemy=run(true); out.friend=run(false);
return out; })()`);
ok(!!d.enemy&&d.enemy.goneAt>=0,'B2 敌方士兵在位时手雷确实引爆');
ok(!!d.enemy&&d.enemy.dy>0.6&&Math.abs(d.enemy.dz)<1.2,'B2 撞**敌方士兵躯干**即炸 (半空 y-地='+d.enemy.dy+'m, 纵向偏差 '+d.enemy.dz+'m)');
ok(!!d.friend&&d.friend.goneAt>=0&&d.friend.dz<-1.2,'B2-阴性 同位置换**友军**: 武装了也不炸 (继续飞到 '+d.friend.dz+'m 之外才落地) —— "合法目标"只认敌方');

// B2-4b 反坦克炸药族 (表外, 出手即武装): 触载具即炸 / 阴性对照 = 普通手雷撞载具**不炸** (既有裁定"无坦克伤害圈")
const e2=R(`(()=>{ const out={};
const spot=${CLEARSPOT}; if(!spot) return out;
const tank=tanks.find(t=>t.alive&&t.team!==0)||null;
out.hasTank=!!tank; if(!tank) return out;
const run=(isAT)=>{
for(const n of nades.slice()) { scene.remove(n.m); nades.splice(nades.indexOf(n),1); }
for(const s of soldiers) s.pos.set(9999,9999,9999);
tank.pos.set(spot.x, spot.gh, spot.z-15); tank.vel=V3(0,0,0); tank.hp=tank.maxHp||tank.hp;
const hp0=tank.hp;
player.pos.set(spot.x,spot.gh,spot.z);
camera.position.set(spot.x,spot.gh+1.62,spot.z);
player.vel=V3(0,0,0); player.alive=true; player.team=0; player.yaw=0;
player.nadeCount=1; player.atNades=1; player.nadeFuse=1.6;
player.nadeIsAT=!!isAT; player.nadeIsSmoke=false; player.nadeIsIncin=false;
player.releaseNade();
const n=nades[nades.length-1];
const armOnFuse=n.armOnFuse;
let goneAt=-1, blow=V3(0,0,0), t2=0;
for(let i=0;i<600;i++){
updateNades(1/60,1/60); t2+=1/60;
if(nades.indexOf(n)<0){ goneAt=i; blow.copy(n.pos); break; }
}
return { armOnFuse, goneAt, t:+t2.toFixed(2),
dy:+(blow.y-heightAt(blow.x,blow.z)).toFixed(2),
dTank:+Math.hypot(blow.x-tank.pos.x,blow.z-tank.pos.z).toFixed(2), dmg:+(hp0-tank.hp).toFixed(0) };
};
out.at=run(true); out.frag=run(false);
return out; })()`);
ok(e2.hasTank===true,'B2-载具 沙箱里有可用敌方坦克 (判据非空转)');
ok(!!e2.at&&e2.at.armOnFuse===false,'B2-载具 表外弹种 armOnFuse=false (出手即武装 —— 老口径零变化)');
ok(!!e2.at&&e2.at.goneAt>=0&&e2.at.dTank<3.2&&e2.at.dy>0.2,'B2-载具 **反坦克炸药触载具即炸**: 爆点距坦克 '+e2.at.dTank+'m (<2.6 触发圈 + 一步飞行), 炸在半空 y-地='+e2.at.dy+'m');
ok(!!e2.at&&e2.at.dmg>0,'B2-载具 反坦克炸药确实炸伤坦克 ('+e2.at.dmg+' 点)');
ok(!!e2.frag&&e2.frag.goneAt>=0&&e2.frag.dTank>3.2,'B2-阴性 普通手雷撞载具**不炸** (继续飞到距坦克 '+e2.frag.dTank+'m 才落地炸) —— "无坦克伤害圈"是既有裁定, 载具不进合法目标表');

// B2-5 ★用户报"仍会自雷": 举雷瞄准 6.7s, 玩家不死、雷不炸、计数不减
const e=R(`(()=>{ const out={};
const spot=${CLEARSPOT}; if(!spot) return out;
player.pos.set(spot.x,spot.gh,spot.z);
player.vel=V3(0,0,0); player.alive=true; player.deployed=true; player.team=0; player.hp=100;
player.nadeCount=3; player.nadeFuse=3.8;
player.nadeIsAT=false; player.nadeIsSmoke=false; player.nadeIsIncin=false;
VM.state='nade'; VM.stateT=0; VM.stateDur=999; player.nadeHeld=true;
const hp0=player.hp, n0=player.nadeCount;
let err='';
for(let i=0;i<400;i++){ try{ updatePlayer(1/60,1/60); }catch(ex){ err=ex.message; break; } }
out.err=err; out.fuse=+player.nadeFuse.toFixed(2); out.alive=player.alive; out.hp=player.hp;
out.hpSame=(player.hp===hp0); out.n0=n0; out.n1=player.nadeCount; out.nades=nades.length;
out.held=player.nadeHeld; out.state=VM.state;
return out; })()`);
ok(e.err==='','B2-自雷 举雷期间 updatePlayer 全程无异常 ('+(e.err||'ok')+')');
ok(e.fuse===0,'B2-自雷 引信照走并停在 0 ('+e.fuse+') —— "保留计时"');
ok(e.alive===true&&e.hpSame===true,'B2-自雷 **举满 3.8s 不自爆**: 玩家活着且零掉血 (hp='+e.hp+') —— 用户报的"仍会自雷"根因已除');
ok(e.n1===e.n0&&e.nades===0,'B2-自雷 手里那颗雷没被消耗也没被扔出 (计数 '+e.n0+'→'+e.n1+', 场上 '+e.nades+' 枚)');
ok(e.held===true&&e.state==='nade','B2-自雷 仍是举雷待发态 (nadeHeld/state='+e.state+') —— 到点不打断瞄准');
}

// ═════ B3 预演=实弹 + 贴地椭圆 ═════
console.log('B3 预演=实弹 (行为)');
{
const scene=R(`(()=>{ const spot=${CLEARSPOT}; if(!spot) return null;
for(const s of soldiers) s.pos.set(9999,9999,9999);
player.pos.set(spot.x,spot.gh,spot.z);
camera.position.set(spot.x,spot.gh+1.62,spot.z);
player.alive=true; player.spectator=false; matchOver=false; player.onVehicle=null; player.vel=V3(0,0,0);
player.team=0; player.nadeFuse=3.8;
player.nadeIsAT=false; player.nadeIsSmoke=false; player.nadeIsIncin=false;
VM.state='nade'; player.nadeHeld=true;
return {x:spot.x,y:spot.gh+1.62,z:spot.z,gh:spot.gh}; })()`);
ok(!!scene,'B3 净空平地扫描命中');
if(scene){
setCam(scene,0,70,1280/720);   // 平视真透视 (V3 桩没有 project, 由本探针补; 相机矩阵手填)
// PITCH=0: 平视 —— 地面圆盘在屏上必然压得很扁 (屏幕正圆会是 1.0)
const arc=R(`(()=>{ const out={};
VM.state='nade'; player.nadeHeld=true;
updateNadeArc();
const box=document.getElementById('nadeArc');
out.show=box.style.display;
let vis=0; for(const c of box.children) if(c.className==='na'&&c.style.display==='block') vis++;
out.dots=vis;
const path=document.getElementById('naBlast');
const dstr=String((path.__attrs||{}).d||'');
const pts=dstr.replace(/[MZ]/g,' ').trim().split('L').map(s2=>s2.trim().split(/\\s+/).map(Number)).filter(p=>p.length===2&&isFinite(p[0]));
out.ringPt=pts.length; out.d0=String((path.__attrs||{}).d||'').slice(0,60); out.disp=path.style.display; out.ringBlock=path.style.display;
const xs=pts.map(p=>p[0]), ys=pts.map(p=>p[1]);
const w=Math.max(...xs)-Math.min(...xs), h=Math.max(...ys)-Math.min(...ys);
out.ringW=+w.toFixed(1); out.ringH=+h.toFixed(1); out.ratio=+(h/Math.max(w,1e-6)).toFixed(3);
out.rcx=(Math.max(...xs)+Math.min(...xs))/2; out.rcy=(Math.max(...ys)+Math.min(...ys))/2;
out.spotRing=String(((document.getElementById('naSpot').__attrs||{}).d)||'').length>20;
out.spotDot=document.getElementById('naDot').style.display==='block';
return out; })()`);
ok(arc.show==='block'&&arc.dots>3,'B3 持雷期预演显示 (点串 '+arc.dots+' 点)');
ok(arc.ringBlock==='block'&&arc.ringPt>=30,'B3 贴地落点环是逐点投影出的闭合环 ('+arc.ringPt+' 段)');
ok(arc.ratio<0.5,'B3 落点环是**躺在地上的椭圆** (screen '+arc.ringW+'×'+arc.ringH+'px, 长宽比 '+arc.ratio+' < 0.5; 阴性对照: 屏幕正圆必然 ≈1.0)');
ok(arc.spotRing===true&&arc.spotDot===true,'B3 精确弹着点小圈 + 中心点齐出');
// 俯视加深 (pitch=-0.5rad): 地面圆盘在屏上应当**变大变开** (透视自洽; 屏幕正圆不随俯角变)
setCam(scene,-0.5,70,1280/720);
const arc2=R(`(()=>{ updateNadeArc();
const path=document.getElementById('naBlast');
const pts=String((path.__attrs||{}).d||'').replace(/[MZ]/g,' ').trim().split('L').map(s2=>s2.trim().split(/\\s+/).map(Number)).filter(p=>p.length===2&&isFinite(p[0]));
const xs=pts.map(p=>p[0]), ys=pts.map(p=>p[1]);
const w=Math.max(...xs)-Math.min(...xs), h=Math.max(...ys)-Math.min(...ys);
return {w:+w.toFixed(1),h:+h.toFixed(1),ratio:+(h/Math.max(w,1e-6)).toFixed(3)}; })()`);
ok(arc2.ratio>arc.ratio,'B3-阴性 俯角加大后椭圆张开 (ratio '+arc.ratio+'→'+arc2.ratio+') —— 说明是三维投影而非屏幕画圆');
// 真投弹 vs 预演落点: 回到平视, 用同一初速真扔一颗, 比较爆炸点与环心的**屏幕位置**
setCam(scene,0,70,1280/720);
const real=R(`(()=>{ const out={};
VM.state='nade'; player.nadeHeld=true;
updateNadeArc();
const path=document.getElementById('naBlast');
const pts=String((path.__attrs||{}).d||'').replace(/[MZ]/g,' ').trim().split('L').map(s2=>s2.trim().split(/\\s+/).map(Number)).filter(p=>p.length===2&&isFinite(p[0]));
const xs=pts.map(p=>p[0]), ys=pts.map(p=>p[1]);
out.rx=(Math.max(...xs)+Math.min(...xs))/2; out.ry=(Math.max(...ys)+Math.min(...ys))/2;
player.nadeHeld=false; VM.state='idle';
player.nadeCount=1; player.releaseNade();
const n=nades[nades.length-1];
let goneAt=-1, blow=V3(0,0,0), t=0;
for(let i=0;i<600;i++){
updateNades(1/60,1/60); t+=1/60;
if(nades.indexOf(n)<0){ goneAt=i; blow.copy(n.pos); break; }
}
out.goneAt=goneAt; out.t=+t.toFixed(2);
const s=nadeProj(blow.x,blow.y,blow.z);
out.bx=s?s.x:-1; out.by=s?s.y:-1;
out.px=+Math.hypot((s?s.x:0)-out.rx,(s?s.y:0)-out.ry).toFixed(1);
// 更严的一把尺: 精确弹着点圆心 (#naDot) 就是预演落点的投影 —— 与真弹爆点投影逐像素比
const dot=document.getElementById('naDot');
out.dotAttrs=Object.keys(dot.__attrs||{}).join(',');
out.dx=parseFloat(dot.__attrs&&dot.__attrs.cx), out.dy=parseFloat(dot.__attrs&&dot.__attrs.cy);
out.pxd=(isFinite(out.dx)&&isFinite(out.dy)&&!!s)?+Math.hypot(s.x-out.dx,s.y-out.dy).toFixed(1):-1;
out.blowY=+blow.y.toFixed(2); out.blowG=+heightAt(blow.x,blow.z).toFixed(2);
return out; })()`);
ok(real.goneAt>=0,'B3 真投弹爆掉 ('+real.t+'s)');
ok(real.blowY-real.blowG<0.25,'B3 真弹爆点在地表 (y-地='+(real.blowY-real.blowG).toFixed(2)+'m) —— 与预演同一落点定义');
ok(real.pxd>=0&&real.pxd<12,'B3 预演弹着点(#naDot)与真弹爆点投影同点 (屏距 '+real.pxd+'px < 12, attrs='+real.dotAttrs+') —— 指哪炸哪');
ok(real.px<40,'B3 落点环心 (包围盒心, 非严格投影心) 同向同区 (屏距 '+real.px+'px < 40)');
}
}

// ═════ B4 预演空间感 + 总是地面落点圈 (2026-09-30 批2 用户复报) ═════
console.log('B4 预演空间感 (行为)');
{
const scene=R(`(()=>{ const spot=${CLEARSPOT}; if(!spot) return null;
for(const s of soldiers) s.pos.set(9999,9999,9999);
player.pos.set(spot.x,spot.gh,spot.z);
camera.position.set(spot.x,spot.gh+1.62,spot.z);
player.alive=true; player.deployed=true; player.spectator=false; matchOver=false; player.onVehicle=null;
player.vel=V3(0,0,0); player.team=0; player.yaw=0; player.pitch=0; player.nadeFuse=3.8;
player.nadeIsAT=false; player.nadeIsSmoke=false; player.nadeIsIncin=false;
VM.state='nade'; player.nadeHeld=true;
return {x:spot.x,y:spot.gh+1.62,z:spot.z,gh:spot.gh}; })()`);
ok(!!scene,'B4 净空平地扫描命中');
if(scene){
setCam(scene,0,70,1280/720);
// 一人称 (相机就在眼位 = 与 playerEyePos 重合): 点串必须**不是**一条竖直直线 —— 旧起点在相机轴线上时
// 整条弹道都落在相机轴线所在竖直平面内, 屏幕 x 展开必然 ≈0 (用户报"就是一条线段")。
const arc=R(`(()=>{ const out={};
VM.state='nade'; player.nadeHeld=true;
updateNadeArc();
const box=document.getElementById('nadeArc');
const dots=[]; for(const c of box.children) if(c.className==='na'&&c.style.display==='block') dots.push([parseFloat(c.style.left),parseFloat(c.style.top)]);
out.n=dots.length;
const xs=dots.map(d=>d[0]), ys=dots.map(d=>d[1]);
out.spread=dots.length?+(Math.max(...xs)-Math.min(...xs)).toFixed(1):-1;
out.ySpread=dots.length?+(Math.max(...ys)-Math.min(...ys)).toFixed(1):-1;
out.x0=dots.length?+(dots[0][0]-innerWidth/2).toFixed(1):0;
out.xN=dots.length?+(dots[dots.length-1][0]-innerWidth/2).toFixed(1):0;
// 阴性对照: **旧起点** (相机位置 + 视线前方 0.3m) 走同一积分器/同一投影 —— 屏幕 x 展开必然 ≈0
const o2=camera.position.clone().addScaledVector(camForward(),0.3);
const d2=camForward();
const v2=d2.clone().multiplyScalar(NADE_THROW.frag.v); v2.y+=NADE_THROW.frag.up;
const st2={pos:o2.clone(),vel:v2,fuse:3.8,armOnFuse:true,at:false,team:0,thrower:player,spin:null};
const x2=[];
for(let i=0;i<420;i++){ const ev=nadeStep(st2,1/60); if(ev==='blow'||ev==='fizzle') break;
if(i%4===0){ const sp=nadeProj(st2.pos.x,st2.pos.y,st2.pos.z); if(sp) x2.push(sp.x); } }
out.oldSpread=x2.length?+(Math.max(...x2)-Math.min(...x2)).toFixed(1):-1;
return out; })()`);
ok(arc.n>10,'B4 持雷期预演点串在屏 ('+arc.n+' 点)');
ok(arc.spread>12,'B4 点串**不是一条竖直直线**: 屏幕 x 展开 '+arc.spread+'px » 旧相机起点阴性对照 '+arc.oldSpread+'px —— 用户报"一人称就是一条线段"');
ok(Math.abs(arc.x0)>6,'B4 首个弹道点从**右手**划出 (偏离准星 '+arc.x0+'px), 尾端收敛回准星 (末点 '+arc.xN+'px)');
ok(arc.oldSpread>=0&&arc.oldSpread<3,'B4-阴性 旧起点(相机轴线)确实退化: x 展开仅 '+arc.oldSpread+'px —— 修前修后差一个量级');
// 三人称机位 (与 20-player thirdPersonCamera 同款: 眼后 3.4m / 上 0.6m): 同一套弹道在两视角下形状必须不同
// 相机矩阵同步手改 (setCam 是列主序手填; 相机后移后 matrixWorldInverse 必须同帧更新, 否则投影仍按旧机位算)
setCam({x:scene.x, y:scene.y+0.6, z:scene.z+3.4},0,70,1280/720);
const tp=R(`(()=>{ const out={};
camera.position.set(${scene.x}, ${scene.y+0.6}, ${scene.z+3.4});   // 眼后 3.4m / 上 0.6m (yaw=0 朝 -z)
player.nadeHeld=true; VM.state='nade';
updateNadeArc();
const box=document.getElementById('nadeArc');
const dots=[]; for(const c of box.children) if(c.className==='na'&&c.style.display==='block') dots.push([parseFloat(c.style.left),parseFloat(c.style.top)]);
out.n=dots.length;
const xs=dots.map(d=>d[0]), ys=dots.map(d=>d[1]);
out.spread=dots.length?+(Math.max(...xs)-Math.min(...xs)).toFixed(1):-1;
out.cx=dots.length?+dots[0][0].toFixed(1):-1; out.cy=dots.length?+dots[0][1].toFixed(1):-1;
out.dbg='attrs='+Object.keys(document.getElementById('naBlast').__attrs||{}).join(',')+' d='+String((document.getElementById('naBlast').__attrs||{}).d||'<none>').slice(0,50)+' disp='+document.getElementById('naBlast').style.display;
const path=document.getElementById('naBlast');
const pts=String((path.__attrs||{}).d||'').replace(/[MZ]/g,' ').trim().split('L').map(s2=>s2.trim().split(/\\s+/).map(Number)).filter(q=>q.length===2&&isFinite(q[0]));
out.ringPt=pts.length;
const rx=pts.map(q=>q[0]), ry=pts.map(q=>q[1]);
out.ratio=pts.length?+(((Math.max(...ry)-Math.min(...ry))/Math.max(Math.max(...rx)-Math.min(...rx),1e-6))).toFixed(3):-1;
return out; })()`);
ok(tp.n>10&&tp.spread>12,'B4-三人称 点串同样在屏且成形 ('+tp.n+' 点, x 展开 '+tp.spread+'px)');
ok(Math.abs(tp.cx-arc.x0)>10||Math.abs(tp.cy-arc.n0)>10||tp.spread!==arc.spread,'B4-三人称 与一人称**形状不同** (首点偏移 '+arc.x0+'px→'+tp.cx+'px, x 展开 '+arc.spread+'→'+tp.spread+'px) —— 用户报"两视角完全一致"');
ok(tp.ringPt>=30&&tp.ratio>0&&tp.ratio<0.5,'B4-三人称 落点圈仍是贴地椭圆 ('+tp.ringPt+' 段, 长宽比 '+tp.ratio+' | '+tp.dbg+')');
// 厨雷档: 引信烧到 0.05s —— 预演仍必须画地面落点圈 (用户裁定"总是画地面落点范围")
setCam(scene,0,70,1280/720);
const cooked=R(`(()=>{ const out={};
camera.position.set(${scene.x}, ${scene.y}, ${scene.z});
player.nadeFuse=0.05; VM.state='nade'; player.nadeHeld=true;
updateNadeArc();
out.blast=document.getElementById('naBlast').style.display;
out.air=document.getElementById('naAir').style.display;
out.ring=String((document.getElementById('naBlast').__attrs||{}).d||'').length>20;
const path=document.getElementById('naBlast');
const pts=String((path.__attrs||{}).d||'').replace(/[MZ]/g,' ').trim().split('L').map(s2=>s2.trim().split(/\\s+/).map(Number)).filter(q=>q.length===2&&isFinite(q[0]));
const rx=pts.map(q=>q[0]), ry=pts.map(q=>q[1]);
out.ratio=pts.length?+(((Math.max(...ry)-Math.min(...ry))/Math.max(Math.max(...rx)-Math.min(...rx),1e-6))).toFixed(3):-1;
out.dot=document.getElementById('naDot').style.display;
return out; })()`);
ok(cooked.blast==='block'&&cooked.ring===true,'B4-厨雷 引信烧到 0.05s: 预演**照样画地面落点圈** ('+cooked.blast+') —— 用户裁定"总是画地面落点范围"');
ok(cooked.air==='none','B4-厨雷 不出现空炸环 (普通手雷已无空炸路径)');
ok(cooked.ratio>0&&cooked.ratio<0.5&&cooked.dot==='block','B4-厨雷 圈仍是贴地椭圆 (ratio '+cooked.ratio+') 且弹着点在');
}
}

console.log('──────────────────────────────');
console.log('合计: '+PASS+' 通过, '+FAILS+' 失败');
process.exit(FAILS?1:0);
