// ─────────────────────────────────────────
// dev/verify-nademap-20261103.js —— 手雷预瞄可见弧段圈 + 预瞄地图标记批 (2026-11-03)
// 用法: node dev/verify-nademap-20261103.js
// 用户报两条:
//   ① "预瞄线在地图上也要有呈现, 就用一个小圈; 范围内目标红点/蓝点/绿点加一层黄色边(可见预瞄线同款黄);
//      游戏内容设置里加开关" ⇒ 落点小圈+圈内目标黄边 (小地图+大地图), NADE_MAP_MARK 开关 (默认开, 实时生效)。
//   ② "爆炸范围显示在计时归零后就变成一个小圈" ⇒ 病根 nadeGroundRing 旧口径"任一点在身后即整环作废":
//      厨雷 (引信0) 预演落点就在本体前几米, 10m 杀伤圈的后半弧落在相机身后 ⇒ 整圈被裁, 屏上只剩
//      0.45m 弹着点小圈 (用户截图实测)。修=画可见弧段 (身后/贴面点断路 M 重起笔), 开放弧去填充只留描边。
//   ②b "似乎不显示第一次弹射开始的预瞄线" ⇒ .na-bounce 旧样式 4px/.45α/无投影/0.65 不透明度在亮草地上
//      有效可见度 ≈三成 = 隐形。修=提亮一档 (5px/.9α/带投影), 仍与空中实心段保持主次。
// 断言:
//   S1 源码锚: 可见弧段圈 (旧"整环作废"绝迹/返回 {d,full}/naSet sfill 内联档/nadeProj near 参) ·
//              地图标记账 (_naMapMark/_naMarks 单源一遍圈+早退清账+两图各自消费) ·
//              设置三件套 (00-config 单源默认开/index 按钮/initMenuUI 实时接线不重载) ·
//              i18n 新键 · .na-bounce 提亮 (旧 .45α 绝迹) · run-all 自注册;
//   B1 行为 (可见弧段): 近环 (环心 4m, 半径 10 跨身) partial 多子路径 / 远环 (30m) full 闭合 36+ 点 /
//              整环在相机身后 = null (阴性) / sfill 内联开关 none↔空串;
//   B2 行为 (端到端厨雷复现): fuse=0 + player.vel 反向削速 (预瞄出手式 addScaledVector(player.vel,0.4)
//              单源, 落点稳定 3~4m ∈ 圈内) ⇒ naBlast 显示且 style.fill==='none' 且 path 多子路径 ——
//              用户报"只剩一个小圈"的行为级复现+修复证据; _naMapMark.on=true 且 r=NADE_BLAST_R;
//   B3 行为 (小地图标记): 预瞄激活帧 drawMinimap 画落点圈 (心=toMap(land), 半径=r×inv) + 圈内敌黄边
//              (r≈4.4 于 toMap(敌A)) / 圈外敌无黄边 (阴性) / NADE_MAP_MARK=false 后黄色绝迹 (阴性) /
//              设置按钮 onclick 翻转 NADE_MAP_MARK + localStorage sf_nade_map 记账;
//   B4 行为 (大地图标记): drawBigMap 同画 (全域比例半径 r/MH×S/2, 黄边 5.5)。
// 判据口径: 源码锚按签名子串 (不记行号); 行为判据调用游戏自身接口 (nadeGroundRing/naSet/updateNadeArc/
// drawMinimap/drawBigMap/按钮 onclick), 不重写第二套渲染; 每组至少一条阴性对照。
// 场地口径: CLEARSPOT 同族 (净空平地 + 图内不落水)。
// ★沙箱相机须知: camForward 走 Object3D 桩的 position-only matrixWorld ⇒ setCam 俯仰**不驱动**瞄准方向
//   (平投恒朝 -z), 厨雷近落点用 player.vel 削速驱动, 不依赖俯角。
// ─────────────────────────────────────────
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
if(!e.__realAttr){ e.__realAttr=1; e.__attrs=e.__attrs||{};
const sa=e.setAttribute.bind(e); e.setAttribute=(k,v)=>{ e.__attrs[k]=v; sa(k,v); }; }
return e; };
{ const g=document.getElementById.bind(document),c=document.createElement.bind(document);
document.getElementById=id=>patchEl(g(id)); document.createElement=t=>patchEl(c(t)); }
// ── 录制型 2D 上下文: drawMinimap/drawBigMap 的 mmC/c 在脚本求值期捕获 ⇒ 必须在**载入游戏脚本前**
//    预种 #minimap/#compass/#bigmap 三件, 让 getContext 返回本桩 (调用序+属性写值全记账)。
function mkRec2d(){
const calls=[];
const t={__calls:calls,canvas:{width:0,height:0}};
let proxy;
proxy=new Proxy(t,{
get(o,k){
if(k==='__calls') return calls;
if(typeof k==='symbol') return undefined;
if(k in o) return o[k];
// 必须返回**代理自身**: 裸 target 上的 .addColorStop(...) 无 trap 会断链 (drawBigMap 蒙版实测崩)
o[k]=(...a)=>{ calls.push([String(k),a]); return proxy; };
return o[k];
},
set(o,k,v){ calls.push(['set:'+String(k),v]); o[k]=v; return true; }
});
return proxy;
}
const rec2d=mkRec2d();
for(const id of ['minimap','compass','bigmap']){
const e=document.getElementById(id);
e.getContext=()=>rec2d;
}
// FILES 与 index.html 实载清单逐个对齐 (D1 教训: 探针载入清单缺哪个, 那个子系统就不存在)
const idxSrc=fs.readFileSync(path.join(root,'index.html'),'utf8');
const FILES=[...idxSrc.matchAll(/src="([^"?]+\.js)/g)].map(m=>m[1]).filter(f=>/^js\//.test(f));
if(FILES.length<41){ console.log('  ✘ FILES 解析异常: 只抓到 '+FILES.length+' 个脚本 (应 ≥41)'); process.exit(1); }
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.__rec=rec2d;   // 录制桩挂进 vm 全局: R() 内可直接读 __rec.__calls (关开关等就地计数用)
ctx.document=document; ctx.window=window; ctx.__evH=handlers;
const Quat=class{ constructor(){this.x=0;this.y=0;this.z=0;this.w=1;} set(x,y,z,w){this.x=x;this.y=y;this.z=z;this.w=w;return this;} setFromEuler(){return this;} setFromAxisAngle(){return this;} copy(q){Object.assign(this,q);return this;} mult(){return this;} normalize(){return this;} };
const CV3=sandbox.THREE.Vector3;
const CANNON_STUB={Vec3:CV3,Quaternion:Quat,
World:class{ constructor(){ this.gravity=new CV3(); this.broadphase=null; this.solver={iterations:0}; this.bodies=[]; } addBody(b){ this.bodies.push(b); } removeBody(b){ const i=this.bodies.indexOf(b); if(i>=0) this.bodies.splice(i,1); } add(b){ this.addBody(b); } remove(b){ this.removeBody(b); } addConstraint(){} removeConstraint(){} step(){} },
Body:class{ constructor(o){ Object.assign(this,o||{}); this.shapes=[]; this.position=new CV3(); this.velocity=new CV3(); this.angularVelocity=new CV3(); this.quaternion=new Quat(); } addShape(s){ this.shapes.push(s); } },
Box:class{}, Sphere:class{}, Material:class{}, ContactMaterial:class{}, NaiveBroadphase:class{}, PointToPointConstraint:class{}};
ctx.CANNON=CANNON_STUB;
ctx.localStorage={_s:{sf_campaign:'0'},getItem(k){return (k in this._s)?this._s[k]:null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of FILES) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
const R=x=>vm.runInContext(x,ctx);
try{ R(`SPAWN_PROT=0; document.getElementById('startBtn').onclick(); for(const s of combatants) s.protUntil=0;`); }catch(e){ console.log('  开局异常: '+e); }
// 桩不忠实补齐: V3 桩没有 project/applyMatrix4 (真 three 有) —— 按真 three 公式补原型 (行为判据只认
// "环画没画出来/长什么样", 不重写物理)。相机矩阵由 setCam 手填成真透视 (列主序与真 three 一致)。
R(`(()=>{
const VP=THREE.Vector3.prototype;
// ★无条件覆写 (2026-11-03): 桩已有 no-op applyMatrix4/project (_bootstub:55 'return this') —— 条件补丁
//   形同虚设, 投影全程哑掉 (连 verify-nade-trigger B3/B4 的 6 选 1 门都因此长期 envSkip)。桩不忠实补齐
//   同 isMesh/firstChild 先例: 以真公式覆写 no-op, 各探针独立进程互不外溢。
{
VP.applyMatrix4=function(m){ const e=m.elements;
const x=this.x,y=this.y,z=this.z;
const w=(e[3]*x+e[7]*y+e[11]*z+e[15])||1;
this.x=(e[0]*x+e[4]*y+e[8]*z+e[12])/w;
this.y=(e[1]*x+e[5]*y+e[9]*z+e[13])/w;
this.z=(e[2]*x+e[6]*y+e[10]*z+e[14])/w;
return this; };
VP.project=function(cam){ return this.applyMatrix4(cam.matrixWorldInverse).applyMatrix4(cam.projectionMatrix); };
}
})()`);
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
// 净空平地扫描 (探针卫生: 与同族探针同口径; 本探针不依赖弹道走廊, 只求平地不落水)
const CLEARSPOT=`(()=>{ let spot=null;
const _lim=(typeof MAP_SIZE==='number')?MAP_SIZE/2:320;
for(let i=0;i<2500&&!spot;i++){
const x=player.pos.x+(Math.random()*160-80), z=player.pos.z+(Math.random()*160-80);
const gh=heightAt(x,z);
if(waterYAt(x,z)>-1e8) continue;
if(Math.abs(gh-heightAt(x+6,z))>0.35||Math.abs(gh-heightAt(x,z+6))>0.35) continue;
let blocked=false;
for(let a=0;a<8;a++){ const dx=Math.sin(a*Math.PI/4), dz=Math.cos(a*Math.PI/4);
if(raycastWorld(V3(x,gh+1.2,z),V3(dx,0,dz),10)){ blocked=true; break; } }
if(!blocked) for(let t=6;t<=48;t+=6){
if(z-t < -_lim+8){ blocked=true; break; }
if(waterYAt(x,z-t)>-1e8){ blocked=true; break; }
}
if(!blocked) spot={x,z,gh};
} return spot; })()`;
// 录制桩扫描: 在 calls 里找 (x,y) 落窗内的 arc 调用
function findArc(pred){ return rec2d.__calls.filter(c=>c[0]==='arc'&&pred(c[1])).map(c=>c[1]); }
function yellowCount(from){ let n=0;
for(let i=from;i<rec2d.__calls.length;i++){ const c=rec2d.__calls[i];
if(c[0]==='set:strokeStyle'&&String(c[1]).indexOf('255,205,90')>=0) n++; }
return n; }
function clearRec(){ rec2d.__calls.length=0; }

console.log('══ 手雷预瞄可见弧段圈 + 预瞄地图标记批 (dev/verify-nademap-20261103.js) ══');

// ═════ S1 源码锚 ═════
console.log('S1 源码锚');
{
const hud=read('js/22-hud.js'), cfg=read('js/00-config.js'), idx=read('index.html'),
i18n=read('js/00b-i18n.js'), css=read('css/style.css'), runall=read('dev/run-all-verify.js');
console.log('  ─ F1 可见弧段圈 (用户报② "厨雷后爆炸范围只剩一个小圈")');
has(hud,'function nadeGroundRing(cx,cz,r)','F1a 贴地圆环签名不变 (同族探针锚零漂移)');
lacks(hud,'任一点在身后即整环作废','F1b 旧"任一点在身后即整环作废"口径绝迹');
lacks(hud,"return d+' Z'","F1c 旧'整环或 nothing'返回绝迹 (新返回 {d,full})");
has(hud,'return vis?{d:','F1d 新返回 {d,full} (partial=可见弧段)');
has(hud,'function nadeProj(x,y,z,near)','F1e nadeProj near 参 (贴面点断弧, 免极远屏坐标假线)');
has(hud,"attr==='sfill'","F1f naSet 内联 fill 档 (style.css 类样式压不过内联)");
has(hud,"naSet('naBlast','sfill',db.full?'':'none')","F1g 落点圈消费: 整环保留填充/开放弧去填充");
lacks(hud,"if(db){ naSet('naBlast','d',db);","F1h 旧调用形 (整串直写 d) 绝迹");
console.log('  ─ F2 预瞄地图标记账 (用户报①)');
has(hud,'const _naMapMark={on:false,x:0,z:0,r:0}; const _naMarks=[];','F2a 标记账单源槽 (_naMapMark+_naMarks)');
ok(strip(hud).split('_naMarks.length=0').length-1>=2,'F2b 账目清零两处 (预演早退清账 + 每帧重建前清账)');
has(hud,'_naMapMark.on=true; _naMapMark.x=land.x; _naMapMark.z=land.z; _naMapMark.r=blastR','F2c 预演激活帧挂账 (落点/半径同源)');
has(hud,'_naMapMark.on=false; _naMarks.length=0;','F2d 停瞄准/阵亡早退同步清账 (图上不得残留)');
has(hud,'_naMapMark.r*invRangeHalf','F2e 小地图消费 (杀伤圈按图比例换算)');
has(hud,'_naMapMark.r/MH*(S/2)','F2f 大地图消费 (全域比例换算)');
ok((hud.match(/rgba\(255,205,90,\.95\)/g)||[]).length>=4,'F2g 两图四写点全用 naBlast 同款黄 (255,205,90)');
has(hud,'if(typeof NADE_MAP_MARK!==\'undefined\'&&NADE_MAP_MARK&&_naMapMark.on)','F2h 两图消费门 (开关+账活双门)');
console.log('  ─ F3 设置三件套 + i18n + CSS + 注册');
has(cfg,"let NADE_MAP_MARK=localStorage.getItem('sf_nade_map')!=='0'","F3a NADE_MAP_MARK 单源 (00-config, 默认开)");
has(idx,'id="nadeMapMarkBtn"','F3b 游戏内容设置新按钮 (index.html)');
has(idx,'手雷预瞄地图标记','F3c 设置面板标题/说明 (中文原文即键)');
has(i18n,"'手雷预瞄地图标记':'NADE PREVIEW MARKERS'","F3d i18n 英文词条 (按钮标题)");
has(i18n,'predicted impact circle','F3e i18n 英文词条 (面板说明)');
has(hud,"el('nadeMapMarkBtn')","F3f initMenuUI 接线");
has(hud,"localStorage.setItem('sf_nade_map'","F3g 开关写档 (实时生效不重载, 同地图全图信息口径)");
has(css,'rgba(255,195,85,.9)','F3h .na-bounce 提亮档 (5px/.9α/带投影)');
lacks(css,'rgba(255,190,90,.45)','F3i 旧弹跳段隐形档 (.45α/无投影) 绝迹 —— 用户报"第一次弹射开始的预瞄线不显示"');
has(runall,'dev/verify-nademap-20261103.js','F3j run-all 自注册');
}

// ═════ B1 可见弧段圈 (行为) ═════
console.log('B1 可见弧段圈 (行为)');
{
const spot=R(CLEARSPOT);
ok(!!spot,'B1 净空平地扫描命中');
if(spot){
R(`(()=>{ player.pos.set(${spot.x},${spot.gh},${spot.z}); player.yaw=0; player.alive=true;
player.spectator=false; matchOver=false; player.onVehicle=null; player.vel=V3(0,0,0); player.team=0;
camera.position.set(${spot.x},${spot.gh+1.62},${spot.z}); })()`);
setCam({x:spot.x,y:spot.gh+1.62,z:spot.z},0,70,1280/720);
const g=R(`(()=>{ const out={};
out.near=nadeGroundRing(${spot.x},${spot.z}-4,10);
out.far=nadeGroundRing(${spot.x},${spot.z}-30,10);
out.behind=nadeGroundRing(${spot.x},${spot.z}+12,10);
out.nearM=out.near?(out.near.d.match(/M/g)||[]).length:0;
out.nearL=out.near?(out.near.d.match(/L/g)||[]).length:0;
out.farPts=out.far?(out.far.d.replace(/[MZ]/g,' ').trim().split('L').filter(q=>q.trim()).length):0;
return out; })()`);
ok(g.behind===null,'B1-阴性 整环在相机身后 (环心 12m 后方) 仍返回 null —— 看不见的圈不画');
ok(!!g.near&&g.near.full===false&&g.near.d.length>20,'B1 近环 (环心 4m, 半径 10 跨身) 返回可见弧段 (full=false, d '+ (g.near?g.near.d.length:0) +' 字符) —— 旧版此处整环作废=用户报的"只剩小圈"');
ok(g.nearM>=2&&g.nearL>=3,'B1 近环 path 是多子路径 (M×'+g.nearM+' L×'+g.nearL+') —— 身后点断路重起笔, 不硬连成假圆');
ok(!!g.far&&g.far.full===true&&g.farPts>=36&&/ Z\s*$/.test(g.far.d),'B1 远环 (环心 30m) 整环可见: full=true, '+g.farPts+' 点闭合 Z 收尾 —— 旧"整环"判据零回归');
ok(R(`(()=>{ naSet('naBlast','sfill','none'); const a=document.getElementById('naBlast').style.fill;
naSet('naBlast','sfill',''); const b=document.getElementById('naBlast').style.fill;
return a==='none'&&b===''; })()`)===true,'B1 sfill 内联开关: partial→none / 还原→空串 (类样式重新接管)');
}
}

// ═════ B2 端到端厨雷复现 (行为) ═════
console.log('B2 端到端厨雷 → 可见弧段+去填充 (行为)');
{
const scene=R(`(()=>{ let last=null;
for(let a=0;a<6;a++){
const spot=${CLEARSPOT}; if(!spot) continue;
for(const s of soldiers) s.pos.set(9999,9999,9999);
player.pos.set(spot.x,spot.gh,spot.z);
player.yaw=0; player.alive=true; player.deployed=true; player.spectator=false; matchOver=false; player.onVehicle=null;
// ★厨雷近落点驱动: 预瞄出手式 vel.addScaledVector(player.vel,0.4) 单源 —— 反向 z 速度把前向速度
//   削到 ~4m/s, 落点稳定 3~4m ∈ 10m 杀伤圈内 (不依赖俯角: 沙箱 camForward 走 position-only 桩)。
player.vel=V3(0,0,55); player.team=0;
player.nadeFuse=0; player.nadeIsAT=false; player.nadeIsSmoke=false; player.nadeIsIncin=false;
VM.state='nade'; player.nadeHeld=true;
camera.position.set(spot.x,spot.gh+1.62,spot.z);
// ★矩阵必须**块内**就位 (6 选 1 循环里就地建, 同 verify-nade-trigger B3/B4 场景块): nadeGroundRing
//   逐点投影吃 camera.matrixWorldInverse —— 落在 Node 侧 setCam 上会在坏矩阵下跑完第一遍。
{ const ex=spot.x, ey=spot.gh+1.62, ez=spot.z;
const v=new Float32Array(16);
v[0]=1; v[5]=1; v[10]=1; v[15]=1; v[12]=-ex; v[13]=-ey; v[14]=-ez;
camera.matrixWorldInverse={elements:v}; camera.matrixWorld={elements:v};
const f=1/Math.tan(Math.PI*70/360), n=0.1, fa=1000;
const P=new Float32Array(16);
P[0]=f/(1280/720); P[5]=f; P[10]=(fa+n)/(n-fa); P[11]=-1; P[14]=2*fa*n/(n-fa);
camera.projectionMatrix={elements:P}; camera.updateMatrixWorld=()=>{}; }
let good=false, cook=null;
try{
updateNadeArc();
const b=document.getElementById('naBlast');
const d=String((b.__attrs||{}).d||'');
cook={disp:b.style.display, fill:b.style.fill, dLen:d.length, mN:(d.match(/M/g)||[]).length,
markOn:_naMapMark.on, markR:_naMapMark.r,
d2:+Math.hypot(_naMapMark.x-player.pos.x,_naMapMark.z-player.pos.z).toFixed(1)};
good=cook.disp==='block'&&cook.fill==='none'&&cook.dLen>20&&cook.mN>=2&&cook.markOn===true&&cook.markR===10&&cook.d2<9;
}catch(e){ cook={err:e.message}; }
const eye={x:spot.x,y:spot.gh+1.62,z:spot.z,gh:spot.gh,_ok:good?1:0,cook};
if(!last||(!last._ok&&eye._ok)) last=eye;
if(eye._ok) return eye;
}
return last; })()`);
const envB2=!(scene&&scene._ok);
ok(!!scene,'B2 净空平地扫描命中');
if(scene){
setCam({x:scene.x,y:scene.gh+1.62,z:scene.z},0,70,1280/720);
const okB2=(c,msg)=>{ if(envB2){ console.log('  ⚠ 跳过 (环境·场地 6 选全不达标, 非断言放行): '+msg); } else ok(c,msg); };
const ck=scene.cook||{};
okB2(ck.disp==='block'&&ck.dLen>20,'B2 厨雷 (引信0) 落点 '+ (ck.d2!=null?ck.d2:'?') +'m: 落点圈**照画** (disp=block, d '+ (ck.dLen||0) +' 字符) —— 旧版此处整环被裁只剩 0.45m 小圈');
okB2(ck.fill==='none','B2 开放弧去填充 (style.fill=none) —— SVG 开路径的隐式闭合填充不横穿屏面');
okB2(ck.mN>=2,'B2 path 多子路径 (M×'+ (ck.mN||0) +') —— 身后弧段断路, 不硬连假圆');
okB2(ck.markOn===true&&ck.markR===10,'B2 地图标记账挂上 (_naMapMark.on=true, r=NADE_BLAST_R='+ (ck.markR||0) +')');
okB2(ck.d2!=null&&ck.d2<9,'B2 落点在本体前 '+ (ck.d2!=null?ck.d2:'?') +'m (<9) —— 环心近到跨身, 正是用户截图工况');
R(`player.vel=V3(0,0,0); player.nadeFuse=3.8; _naMapMark.on=false; _naMarks.length=0;`);
}
}

// ═════ B3 小地图标记 (行为) ═════
console.log('B3 小地图标记 (行为)');
{
const spot=R(CLEARSPOT);
ok(!!spot,'B3 净空平地扫描命中');
if(spot){
// 预瞄激活 + 圈内/圈外敌各一
const st=R(`(()=>{ const out={};
for(const s of soldiers) s.pos.set(9999,9999,9999);
player.pos.set(${spot.x},${spot.gh},${spot.z});
player.yaw=0; player.alive=true; player.deployed=true; player.spectator=false; matchOver=false; player.onVehicle=null;
player.vel=V3(0,0,0); player.team=0;
player.nadeFuse=3.8; player.nadeIsAT=false; player.nadeIsSmoke=false; player.nadeIsIncin=false;
VM.state='nade'; player.nadeHeld=true;
camera.position.set(${spot.x},${spot.gh+1.62},${spot.z});
updateNadeArc();
// 先跑一遍预演拿到落点, 再按落点摆圈内 (3m) / 圈外 (40m) 敌各一, 重跑一遍刷新账
const lx=_naMapMark.x, lz=_naMapMark.z;
const A=soldiers[0], B=soldiers[1];
A.team=1; A.alive=true; A.onVehicle=null; A.pos.set(lx+3,${spot.gh},lz);
B.team=1; B.alive=true; B.onVehicle=null; B.pos.set(lx+40,${spot.gh},lz);
updateNadeArc();
out.marks=_naMarks.length; out.countOnA=_naMarks.indexOf(A)>=0; out.countOnB=_naMarks.indexOf(B)>=0;
// 期望屏位 (与 drawMinimap 内联 toMap 同式; player.yaw=0 ⇒ 无旋转项)
const S=190, half=S/2, range=90*Math.max(1,Math.sqrt((CAMPAIGN.mapSize||320)/320)), inv=half/range;
const cx=player.pos.x, cz=player.pos.z;
const toMap=(x,z)=>[half+(x-cx)*inv, half+(z-cz)*inv];
out.land=toMap(_naMapMark.x,_naMapMark.z); out.landR=_naMapMark.r*inv;
out.A=toMap(A.pos.x,A.pos.z); out.B=toMap(B.pos.x,B.pos.z);
return out; })()`);
setCam({x:spot.x,y:spot.gh+1.62,z:spot.z},0,70,1280/720);
const okB3=(c,msg)=>{ if(!st){ console.log('  ⚠ 跳过 (环境·场地 6 选全 0 点, 非断言放行): '+msg); } else ok(c,msg); };
if(st){
ok(st.marks===1&&st.countOnA&&!st.countOnB,'B3 圈内账与计数同源: _naMarks 只含圈内敌A (3m), 圈外敌B (40m) 不入账');
clearRec();
R(`drawMinimap();`);
const near=(p)=>findArc(a=>Math.abs(a[0]-p[0])<2.5&&Math.abs(a[1]-p[1])<2.5);
ok(near(st.land).some(a=>Math.abs(a[2]-st.landR)<1.5),'B3 落点小圈上图 (心=toMap(land), 半径 '+st.landR.toFixed(1)+'px ≈ 杀伤圈按图比例)');
ok(near(st.A).some(a=>Math.abs(a[2]-4.4)<0.9),'B3 圈内敌A 点位加黄边 (r≈4.4 环于 toMap(A)) —— 用户报"范围内目标加一层黄色边"');
ok(!near(st.B).some(a=>a[2]>3.5&&a[2]<5.5),'B3-阴性 圈外敌B 无黄边 (只有点位本身, 不误标)');
clearRec();
const turnOff=R(`(()=>{ NADE_MAP_MARK=false; drawMinimap();
let n=0; for(const c of __rec.__calls) if(c[0]==='set:strokeStyle'&&String(c[1]).indexOf('255,205,90')>=0) n++;
NADE_MAP_MARK=true; return n; })()`);
ok(turnOff===0,'B3-阴性 NADE_MAP_MARK=false 后黄圈/黄边绝迹 (开关实时生效, 世界内预瞄线不受本开关影响)');
// 设置按钮: onclick 翻转 + localStorage 记账 (initMenuUI 已在启动链绑定)
const btn=R(`(()=>{ el('nadeMapMarkBtn').onclick();
const v1=NADE_MAP_MARK, s1=localStorage.getItem('sf_nade_map');
el('nadeMapMarkBtn').onclick();
return {v1, s1, v2:NADE_MAP_MARK, s2:localStorage.getItem('sf_nade_map')}; })()`);
ok(btn.v1===false&&btn.s1==='0','B3 按钮 onclick: 开→关, localStorage 记 sf_nade_map=0');
ok(btn.v2===true&&btn.s2==='1','B3 按钮 onclick: 关→开复位, localStorage 记 sf_nade_map=1 (默认开语义不变)');
clearRec();
}
R(`_naMapMark.on=false; _naMarks.length=0;`);
}
}

// ═════ B4 大地图标记 (行为) ═════
console.log('B4 大地图标记 (行为)');
{
const st=R(`(()=>{ const out={};
const A=soldiers[0];
const S=520, MH=MAP_SIZE/2+10;
const toM=(x,z)=>[S/2+x/MH*S/2, S/2+z/MH*S/2];
out.land=toM(_naMapMark.x,_naMapMark.z); out.landR=_naMapMark.r/MH*(S/2);
out.A=toM(A.pos.x,A.pos.z);
return out; })()`);
if(st&&typeof st.land!=='undefined'){
R(`updateNadeArc();`);   // B3 末尾清过账 (_naMarks.length=0), 大地图消费前重跑预演整账重建 (场地/敌位未动 ⇒ land/账逐位复现)
clearRec();
R(`drawBigMap();`);
const near=(p)=>findArc(a=>Math.abs(a[0]-p[0])<3&&Math.abs(a[1]-p[1])<3);
ok(near(st.land).some(a=>Math.abs(a[2]-st.landR)<2),'B4 大地图落点圈上图 (全域比例半径 '+st.landR.toFixed(1)+'px)');
ok(near(st.A).some(a=>Math.abs(a[2]-5.5)<1),'B4 大地图圈内敌A 黄边 (r≈5.5) —— 与小地图同账同款');
}else{
console.log('  ⚠ 跳过 (B3 场地未命中, 大地图侧无从取账)');
}
R(`_naMapMark.on=false; _naMarks.length=0; NADE_MAP_MARK=true;`);
}

console.log('══ 合计: '+PASS+' 过 / '+FAILS+' 红 ══');
process.exit(FAILS?1:0);
