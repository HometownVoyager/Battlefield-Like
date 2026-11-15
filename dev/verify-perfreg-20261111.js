// ─────────────────────────────────────────────
// dev/verify-perfreg-20261111.js —— 2026-11-11 性能修复批 (卡顿回归排查+修复) 沙箱探针
// 覆盖: ①OCC 触点矩形簇登记 (occTouch/occRectMerge/CAP 退化)
//       ②NAV.refresh 簇级增量 (多前线火情不再退全量烘焙) + buildSpatialIndex 集合变更门
//       ③枪锚点链槽位契约 (gunGripPoint/gunForePoint/gunAxisPoint 互不踩槽)
//       ④legIKPose 交替双槽契约  ⑤capAnchorWorld 复用槽
//       ⑥烟雾云并发上限 (SMOKES_MAX=5 挤旧)  ⑦渲染项源码断言 (滤镜摘除/碎块不投影/q2 半频)
//       ⑧HUD 去重源码断言 (tickets hudHTML/存续条量化)  ⑨decide 距离门前置  ⑩gunEvents 原地压实
// 用法: node dev/verify-perfreg-20261111.js
// 纪律: 载入清单从 index.html 动态解析 (逐条同序对账, 不写死数量)。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const {THREE,document,window,sandbox,byId}=require('./_bootstub.js');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const html=read('index.html');
const FILES=[...html.matchAll(/<script src="(js\/[^"?]+)\?v=[^"]*"/g)].map(m=>m[1]);
function boot(campIdx){
for(const k in byId) delete byId[k];
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document; ctx.window=window;
ctx.near=near; ctx.isFinite=isFinite; // 探针助手注入 (vm 上下文不继承宿主全局)
ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return (k in this._s)?this._s[k]:null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of FILES) load(ctx,f);
return ctx;
}
function load(ctx,file){ vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file}); }
function startGame(ctx){
return vm.runInContext(`(()=>{try{const b=document.getElementById('startBtn');if(b&&b.onclick)b.onclick();else return false;return true;}catch(e){return 'ERR:'+String(e&&e.message||e);}})()`,ctx);
}
let PASS=0,FAILS=0;
function ok(cond,label){ if(cond){ PASS++; console.log('  ✔ '+label); } else { FAILS++; console.log('  ✘ '+label); } }
function near(a,b,eps){ return Math.abs(a-b)<=(eps||1e-9); }

console.log('── T0 载入清单 (index.html 动态对账) ──');
{
const onDisk=fs.readdirSync(path.join(root,'js')).sort();
ok(FILES.length>=40,'T0 实载脚本 '+FILES.length+' 个 (动态解析)');
ok(onDisk.every(f=>FILES.indexOf('js/'+f)>=0),'T0 js/ 目录无漏载 ('+onDisk.length+' 个文件)');
}

console.log('── T1 OCC 触点矩形簇 (occTouch 合并/CAP 退化) ──');
const ctx=boot(0);
ok(startGame(ctx)===true,'T1 #0 startGame (世界已建, OCC.data 就绪)');
vm.runInContext(`
var __t1={};
const R=MAP_SIZE/2-45;        // 世界坐标以原点为中心 (occTouch i=floor((x+off)/res), off=(MAP_SIZE+40)/2)
OCC.pendList=null;
occTouch(-R,-R,-R+2,-R+2);    // 簇 A (西南)
occTouch(R-2,R-2,R,R);        // 簇 B (东北, 远离 A)
__t1.two=(OCC.pendList&&OCC.pendList.length===2);
const _ax=Math.floor((-R+OCC.off)), _az=Math.floor((-R+OCC.off));
occTouch(-R+1,-R+1,-R+3,-R+3); // 与 A 相交 ⇒ 并簇 (仍 2 簇)
__t1.merge=(OCC.pendList.length===2);
__t1.coversA=OCC.pendList.some(q=>q.i0<=_ax&&q.i1>=_ax+3&&q.j0<=_az&&q.j1>=_az+3); // 并簇矩形可能在簇表任意位 (splice 重排)
for(let k=0;k<20;k++){        // 20 个散点 (>3 格间隔) ⇒ 超 CAP(12) 退化成单一外接矩形
occTouch(-R-10+k*11,-R-15,-R-9+k*11,-R-14);
}
__t1.cap=(OCC.pendList.length===1);
__t1.span=OCC.pendList[0];
__t1.dbg=JSON.stringify(OCC.pendList);
OCC.pendList=null;
`,ctx);
const t1=vm.runInContext('__t1',ctx);
if(!t1.coversA||!t1.cap||t1.span.i1-t1.span.i0<260) console.log('  [T1 调试] pendList='+t1.dbg);
ok(t1.two===true,'T1 两处远距触点 ⇒ 两个簇 (旧版会并成一个大外接矩形)');
ok(t1.merge===true,'T1 相邻触点并簇 (簇数不变)');
ok(t1.coversA===true,'T1 并簇后外接矩形覆盖两次触点 (合并矩形在外接并上外扩)');
ok(t1.cap===true,'T1 超过 OCC_CLUSTER_CAP=12 退化成单一外接矩形 (旧行为兜底)');
ok(t1.span.i1-t1.span.i0>=230,'T1 退化矩形覆盖全部散点 (格跨 ≥ 2R+10, 不漏改动)');

console.log('── T2 NAV.refresh 簇级增量 + buildSpatialIndex 集合变更门 ──');
vm.runInContext(`
var __t2={};
NAV.refresh();            // 到稳态 (消费开局遗留账)
NAV.resetStats();
__t2.idx0=RGRID.idxRebuilds;
NAV.refresh();            // 无脏
__t2.skip=NAV.stats.skipBakes;
__t2.idxNoChange=RGRID.idxRebuilds;
// 两处远距真火 (世界坐标 ±(R-10), FUEL 强制有燃料 ⇒ igniteCell 确定生效): 各占 1 火格, occMarkFire ⇒ occTouch 两簇
const R2=MAP_SIZE/2-45;
FUEL[fCellI(-R2+10,-R2+10)]=1; igniteCell(fCellI(-R2+10,-R2+10),null);
FUEL[fCellI(R2-10,R2-10)]=1;  igniteCell(fCellI(R2-10,R2-10),null);
__t2.dirty0=!!(OCC.pendList&&OCC.pendList.length>=2); // 触点实时落 pendList 簇表 (OCC.dirty 在 refresh 时才落账)
NAV.refresh();
__t2.full=NAV.stats.fullBakes;
__t2.part=NAV.stats.partBakes;
__t2.lastDirty=NAV.stats.lastDirty;
__t2.dirtyCleared=(OCC.dirty===null&&OCC.dirtyList===null);
__t2.idxStable=RGRID.idxRebuilds;
__t2.fireBlocked=NAV.blocked2D(-R2+10,-R2+10);
__t2.fireBlocked2=NAV.blocked2D(R2-10,R2-10);
// 集合变更门: 置戳后 refresh 必重建索引一次, 随后复位
_colIdxDirty=true;
NAV.refresh();
__t2.idxRebuilt=(RGRID.idxRebuilds===__t2.idxStable+1);
NAV.refresh();
__t2.idxGateReset=(RGRID.idxRebuilds===__t2.idxStable+1);
// 全量兜底: 超阈值大簇 ⇒ fullBake 一次
occTouch(2,2,MAP_SIZE-2,MAP_SIZE-2);
NAV.refresh();
__t2.fullFallback=NAV.stats.fullBakes;
`,ctx);
const t2=vm.runInContext('__t2',ctx);
ok(t2.skip>=1,'T2 无脏 refresh 走 skipBakes (证明式跳过仍在)');
ok(t2.idxNoChange===t2.idx0,'T2 无脏 refresh 不重建空间索引 (集合变更门)');
ok(t2.dirty0===true,'T2 两处真火 ⇒ OCC.dirty 非空');
ok(t2.full===0,'T2 两处远距火线 refresh **不走全量烘焙** (旧版外接矩形超 4% 会退全量)');
ok(t2.part>=2,'T2 簇级增量: partBakes≥2 (每簇一次 bakeRegion)');
ok(t2.lastDirty>0,'T2 lastDirty 记账 (簇面积和)');
ok(t2.dirtyCleared===true,'T2 refresh 消费后脏账清空 (occDirtyClear 含 dirtyList)');
ok(t2.idxStable===t2.idxNoChange,'T2 火情 refresh 不重建空间索引 (纯占用变化不走索引)');
ok(t2.fireBlocked===true&&t2.fireBlocked2===true,'T2 火格占用落账 (blocked2D 命中两处火心)');
ok(t2.idxRebuilt===true,'T2 _colIdxDirty=true ⇒ refresh 重建索引一次');
ok(t2.idxGateReset===true,'T2 重建后门自动复位 (下一轮火情 refresh 不再重建)');
ok(t2.fullFallback===1,'T2 超阈值大簇仍全量兜底 (fullBakes=1, 旧行为保留)');

console.log('── T3 枪锚点链槽位契约 (互不踩槽) ──');
vm.runInContext(`
var __t3={};
const gk='rifle';
const gp=gunGripPoint(gk,0.3,0.2,0.1,0);
const g0={x:gp.x,y:gp.y,z:gp.z};
const fp=gunForePoint(gk,0.3,0.2,0.1,0);
const f0={x:fp.x,y:fp.y,z:fp.z};
__t3.gpStableAfterFore=near(gp.x,g0.x)&&near(gp.y,g0.y)&&near(gp.z,g0.z);
const ax=gunAxisPoint(gk,0.5,0.3,0.2,0.1,0);
__t3.gpStableAfterAxis=near(gp.x,g0.x)&&near(gp.y,g0.y)&&near(gp.z,g0.z);
__t3.fpStableAfterAxis=near(fp.x,f0.x)&&near(fp.y,f0.y)&&near(fp.z,f0.z);
const ax0=gunAxisPoint(gk,0,0.3,0.2,0.1,0);
__t3.ax0IsGrip=near(ax0.x,g0.x)&&near(ax0.y,g0.y)&&near(ax0.z,g0.z);
const ax1=gunAxisPoint(gk,1,0.3,0.2,0.1,0);
__t3.ax1IsFore=near(ax1.x,f0.x)&&near(ax1.y,f0.y)&&near(ax1.z,f0.z);
__t3.axMid=gunAxisPoint(gk,0.5,0.3,0.2,0.1,0);
__t3.axMidVal=near(__t3.axMid.x,(g0.x+f0.x)*0.5)&&near(__t3.axMid.y,(g0.y+f0.y)*0.5)&&near(__t3.axMid.z,(g0.z+f0.z)*0.5);
`,ctx);
const t3=vm.runInContext('__t3',ctx);
ok(t3.gpStableAfterFore===true,'T3 gunForePoint 不踩握把槽 (_gaGrip 存活)');
ok(t3.gpStableAfterAxis===true,'T3 gunAxisPoint 内部临时槽不写对外槽 (14-bots 的 gp 跨回退循环存活)');
ok(t3.fpStableAfterAxis===true,'T3 gunAxisPoint 不踩护木槽 (_gaFore 存活)');
ok(t3.ax0IsGrip===true,'T3 枪轴点 t=0 == 握把值 (逐位插值语义)');
ok(t3.ax1IsFore===true,'T3 枪轴点 t=1 == 护木值');
ok(t3.axMidVal===true,'T3 枪轴点 t=0.5 == 中点插值');

console.log('── T4 legIKPose 交替双槽契约 ──');
vm.runInContext(`
var __t4={};
const LL=legIKPose(1.0,0.11,-0.92,true);
const l0={hip:LL.hip,knee:LL.knee};
const RR=legIKPose(1.0,0.11,0.92,true);
const r0={hip:RR.hip,knee:RR.knee};
__t4.llAlive=near(LL.hip,l0.hip)&&near(LL.knee,l0.knee);
__t4.rrAliveAfterPair=near(RR.hip,r0.hip)&&near(RR.knee,r0.knee);
__t4.rrFinite=isFinite(RR.hip)&&isFinite(RR.knee)&&RR.knee<0;
const cL=legIKPose(1.0,0.13,0.16,false);
const c0={hip:cL.hip,knee:cL.knee};
const cR=legIKPose(1.0,0.13,-0.16,false);
__t4.clAliveAfterCr=near(cL.hip,c0.hip)&&near(cL.knee,c0.knee);
__t4.crFinite=isFinite(cR.hip)&&isFinite(cR.knee);
const cL2=legIKPose(1.0,0.13,0.16,false);
__t4.deterministic=near(cL2.hip,c0.hip)&&near(cL2.knee,c0.knee);
`,ctx);
const t4=vm.runInContext('__t4',ctx);
ok(t4.llAlive===true,'T4 第二次调用不踩第一次的槽 (LL/RR 对)');
ok(t4.rrAliveAfterPair===true,'T4 成对双调后两份结果同时存活 (交替双槽的契约形态)');
ok(t4.rrFinite===true,'T4 结果数值正确 (kneeUp 膝弯为负)');
ok(t4.clAliveAfterCr===true,'T4 cR 不踩 cL 槽 (下一对同样成立)');
ok(t4.deterministic===true,'T4 同入参同结果 (槽位复用不改变纯函数语义)');

console.log('── T5 capAnchorWorld 复用槽 ──');
vm.runInContext(`
var __t5={};
const s1={pos:{x:10,y:2,z:20},yaw:0.7}, an={position:{x:1,y:1.3,z:0}};
const p1=capAnchorWorld(s1,an);
const c1=Math.cos(0.7), n1=Math.sin(0.7);
__t5.val1=near(p1.x,10+1*c1)&&near(p1.y,2+1.3)&&near(p1.z,20-1*n1);
const s2={pos:{x:-3,y:0,z:5},yaw:-1.2};
const p2=capAnchorWorld(s2,an);
const c2=Math.cos(-1.2), n2=Math.sin(-1.2);
__t5.reused=(p1===p2);
__t5.val2=near(p2.x,-3+1*c2)&&near(p2.y,1.3)&&near(p2.z,5-1*n2);
`,ctx);
const t5=vm.runInContext('__t5',ctx);
ok(t5.val1===true,'T5 位姿换算数值正确 (与手算一致)');
ok(t5.reused===true,'T5 复用同一槽位对象 (零分配)');
ok(t5.val2===true,'T5 第二次调用槽内更新且数值正确');

console.log('── T6 烟雾云并发上限 (SMOKES_MAX=5 挤旧) ──');
vm.runInContext(`
var __t6={};
__t6.seeds=[];
for(let k=0;k<7;k++){
spawnSmokeCloud(new THREE.Vector3(20+k,1,20),false,null);
const c=SMOKES[SMOKES.length-1];
__t6.seeds.push(c.seed);
}
__t6.len=SMOKES.length;
__t6.oldest=SMOKES[0].seed;
`,ctx);
const t6=vm.runInContext('__t6',ctx);
ok(t6.len===5,'T6 连丢 7 颗烟雾弹 ⇒ SMOKES.length 恒 ≤5 (旧版无上限)');
ok(t6.oldest===t6.seeds[2],'T6 挤掉的是最老的云 (与 DEBRIS 同"挤旧"口径)');

console.log('── T7 渲染项源码断言 (滤镜/碎块/阴影档) ──');
{
const s2=read('js/02-scene.js'), rd=read('js/12-ragdolls.js');
ok(s2.includes("renderer.domElement.style.filter='none'")&&!s2.includes('saturate('),'T7 画布 CSS 滤镜摘除 (q1/q2 不再全屏滤镜合成)');
ok(/if\(f===0\)\{ renderer\.shadowMap\.autoUpdate=true; return; \}/.test(s2)&&!/quality>=2\)\)\{ renderer\.shadowMap\.autoUpdate/.test(s2),'T7 阴影: 显式档0才逐帧, -1 全档半频');
ok(rd.includes('mesh2.castShadow=false')&&!rd.includes('mesh2.castShadow=true'),'T7 碎块不投影 (炸楼瞬间不再 +192 draw call)');
}

console.log('── T8 HUD 去重源码断言 (tickets/存续条) ──');
{
const h=read('js/22-hud.js');
ok(h.includes("hudHTML('tickets',")&&!h.includes("el('tickets').innerHTML"),'T8 顶栏 tickets 走 hudHTML 指纹去重 (10Hz 同串短路)');
ok(h.includes('Math.round(d.life/(d.lifeMax||24)*100)'),'T8 FPV 存续条宽量化到整数 % (去重重新生效)');
}

console.log('── T9 decide 距离门前置 + T10 gunEvents 原地压实 (源码断言) ──');
{
const b=read('js/14-bots.js'), m=read('js/24-main.js');
const iD=b.indexOf('if(d>=f.r*0.85) continue;');
const iF=b.indexOf('fireThreat(cp.x,cp.z,2.8)');
ok(iD>=0&&iF>=0&&iD<iF,'T9 驻点评分距离门在火场扫描之前 (纯谓词重排, 旗圈外不再白扫)');
ok(m.includes('gunEvents.length=_w')&&!m.includes('gunEvents=gunEvents.filter'),'T10 gunEvents 原地压实 (每帧不再分配新数组)');
}

console.log('\\n【正向】 ✓ '+PASS+' / ✗ '+FAILS);
if(FAILS>0) process.exit(1);
