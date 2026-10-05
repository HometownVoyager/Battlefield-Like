// ─────────────────────────────────────────────
// dev/verify-watchtower.js —— WS5 ㈠ 哨亭楼梯接地验证 (不进 Index.html, 不在 run-all-verify 清单)
// 用法: node dev/verify-watchtower.js
//
// 量测对象 = **运行时同一个函数** js/05a-buildings.towerStairGeom (单一数据源):
//   本脚本不另写第二套楼梯数学, 只把沙箱里的真函数取出来跑, 因此"验证通过"直接等价于"实机几何正确"。
//
// 判据 (为什么这么定, 见 05a towerStairGeom 头注释):
//   ① 接地 (用户报的现象): 梯段**最下一级**的最低结构件 (= 踢面下探段) 底面与地形间距 ∈ [-0.05, +0.25]
//      —— 逐级采样后该值恒为 -0.05 (埋深 5cm), 与坡度无关。
//   ② 顶踏步顶面 − deckTop = 0 (±1e-6)。
//   ③ 相邻踏面顶高差 = 恒定 sr (±1e-6) —— 不许因贴地变成"高矮不一的土坡梯"。
//   ④ 无纯视觉件: 楼梯范围内每个网格都必须有配套碰撞盒 (旧版 2 根"梯下支撑"是纯视觉 mesh(), 无碰撞)。
//   ⑤ 立板连续支承: 每级踢面底 = 下一级踏面顶 (嵌 0.02) ⇒ 下方不出现"悬空板" (间距 ≤0.05)。
//   ⑥ 梯脚可达 (Lead 硬要求): 梯脚到塔身裙墙碰撞盒的水平距离 ≥1.0m, 且梯脚外侧 1~3m 的进近路径上
//     没有 >0.55m 的挡步件 —— 地基裙墙没把梯脚围死。
//   ⑦ 楼梯 pad 与塔身足迹**不重叠** (贴边), 塔身足迹内 |地形 − 楼面| ≤0.5m (= foundation 门限, 无台阶/坑)。
//   ⑧ 阴性对照 (主证据, 岛屿地形平缓时判据本身看不出问题):
//      已知 15% 坡地形上, 逐级采样版 ① 通过 (-0.05); 旧的"单点采样"版 (o.legacy, 复刻改动前几何) ① 失败。
//      两个坡向都测: 坡向朝梯脚下降 → 旧版悬空 0.89m; 朝梯脚上升 → 旧版埋头 0.46m。
//   ⑨ PADS_OFF 沙箱 (关掉建筑地基平台 = "没有整平平台"的极端情形): 逐级采样仍把梯脚钉在地形上。
//   ⑩ 源码级: towerStairGeom 的生产调用点不得传 legacy (否则阴性对照会悄悄变成生产行为)。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'), path=require('path'), vm=require('vm');
const SB=require('./_structbase.js');
const root=path.resolve(__dirname,'..');
const ISLAND=11, SEED=42;
let fail=0;
const T=[];   // 逐座哨亭的读数表 (报告用)
function ok(cond,msg){ if(cond){ console.log('  ✔ '+msg); } else { console.log('  ✗ '+msg); fail++; } }
function f2(n){ return Number(n).toFixed(2); }
const fmt=n=>Number(n).toFixed(4);
// ── 楼梯"最低结构件" = 踢面下探段 (有新几何) / 踏面板底 (legacy 无踢面) ──
const lowestOf=s=>(s.webH>0.02?s.webBot:s.bot);
// ── 在碰撞盒表里找"中心落在期望点、y 覆盖期望高度"的存活盒 (证明该网格有配套碰撞 = 非纯视觉件) ──
function findBox(boxes,wx,wz,y,tolXZ,tolY){
let best=1e9,hit=null;
for(const b of boxes){
if(b.dead) continue;
const cx=(b.minX+b.maxX)/2, cz=(b.minZ+b.maxZ)/2;
const d=Math.hypot(cx-wx,cz-wz);
if(d>tolXZ) continue;
if(y<b.minY-tolY||y>b.maxY+tolY) continue;
if(d<best){ best=d; hit=b; }
}
return hit;
}
// 水平点到 AABB 的距离 (点在盒内=0)
function distToBox(b,x,z){
const dx=Math.max(b.minX-x,0,x-b.maxX), dz=Math.max(b.minZ-z,0,z-b.maxZ);
return Math.hypot(dx,dz);
}
// ── 单座哨亭量测: t=BUILD_REG 条目, deckTop=roofY-2.3 (与运行时同源) ──
function measureTower(run,t){
const {ctx,tctx,geomF,hAt,boxes}=run;
const deckTop=t.roofY-2.3;
const g=geomF(tctx,deckTop);
const L=tctx.L;
const P=(lx,lz)=>[L(lx,lz)[0],L(lx,lz)[1]];
const rec={x:t.x,z:t.z,ry:t.ry,floor:t.floor,deckTop,n:g.n,sr:g.sr,tread:g.tread,legacy:g.legacy,
footZ:g.footZ,footGi:g.footGi,steps:g.steps};
// ① 接地间距: 最下一级的最低结构件 vs 本级脚下地形
rec.footGap=lowestOf(g.steps[0])-g.steps[0].gi;
// ⑤ 立板链间距 (0: 対地形; i>0: 对下一级踏面顶)
rec.chainGaps=g.steps.map((s,i)=>s.webH>0.02?(s.webBot-(i>0?g.steps[i-1].top:s.gi)):0);
// ② 顶踏步顶面 vs deckTop
rec.topDelta=g.steps[g.n-1].top-deckTop;
// ③ 相邻踏面顶高差 vs sr
rec.srMax=0;
for(let i=0;i+1<g.n;i++) rec.srMax=Math.max(rec.srMax,Math.abs((g.steps[i+1].top-g.steps[i].top)-g.sr));
// "任务书原文口径"逐级读数 (每级最低结构件 vs 地形) —— 用于报告里说明为何上方各级必然离地
rec.rawGaps=g.steps.map(s=>lowestOf(s)-s.gi);
rec.rawGapMin=Math.min(...rec.rawGaps); rec.rawGapMax=Math.max(...rec.rawGaps);
// ④ 无纯视觉件: 踏面/踢面各找一个存活碰撞盒
rec.visMiss=[];
for(const s of g.steps){
const p=P(0,s.lz);
if(!findBox(boxes,p[0],p[1],s.top-g.tread/2,0.22,0.06)) rec.visMiss.push(`踏面@z=${f2(s.lz)}`);
if(s.webH>0.02){
const q=P(0,s.webZ);
if(!findBox(boxes,q[0],q[1],(s.webTop+s.webBot)/2,0.22,0.06)) rec.visMiss.push(`踢面@z=${f2(s.webZ)}`);
}
}
// ⑥ 梯脚可达: 到塔身裙墙碰撞盒 (中心仍在足迹 rect 内的件) 的水平距离 + 进近路径净空
const foot=P(0,g.footZ);
let dSkirt=1e9, skirtHit=null;
for(const b of boxes){
if(b.dead) continue;
const cx=(b.minX+b.maxX)/2, cz=(b.minZ+b.maxZ)/2;
const lxy=tctx2local(t,cx,cz);
if(Math.abs(lxy[0])>2.7||Math.abs(lxy[1])>2.7) continue;   // 只看塔身足迹 ±0.4m 内的件 = 裙墙/地基
const d=distToBox(b,foot[0],foot[1]);
if(d<dSkirt){ dSkirt=d; skirtHit=b; }
}
rec.skirtDist=dSkirt; rec.skirtBox=skirtHit;
rec.approach=[];
for(const dz of [1.2,2.2,3.2]){
const a=P(0,g.footZ+dz);
const gh=hAt(a[0],a[1]);
let blk=null;
for(const b of boxes){
if(b.dead) continue;
if(a[0]<b.minX||a[0]>b.maxX||a[1]<b.minZ||a[1]>b.maxZ) continue;
if(b.maxY-gh>0.55){ blk=b; break; }
}
// 挡步件归属: 中心仍在塔身足迹 ±0.4m 内 = 本塔自己的地基/裙墙 (硬失败); 否则是邻居建筑/道具 (只报事实)
const lxy=blk?tctx2local(t,(blk.minX+blk.maxX)/2,(blk.minZ+blk.maxZ)/2):null;
rec.approach.push({dz,y:gh,blocked:!!blk,own:!!(lxy&&Math.abs(lxy[0])<=2.7&&Math.abs(lxy[1])<=2.7)});
}
// ⑦ pad 与足迹: 从沙箱 PADS 里找离本塔最近的 pad, 按局部坐标判定
const pads=run.pads.filter(p=>Math.hypot(p.x-t.x,p.z-t.z)<14);
rec.pads=pads.map(p=>{
const lxy=tctx2local(t,p.x,p.z);
return {lx:lxy[0],lz:lxy[1],hw:p.hw,hd:p.hd,h:p.h,ramp:p.ramp,
z0:lxy[1]-p.hd,z1:lxy[1]+p.hd,x0:lxy[0]-p.hw,x1:lxy[0]+p.hw};
});
// 塔身足迹 4.6×4.6 → 局部 ±2.3。判"压足迹"用**穿透深度 >1e-6m** (贴边不算压):
// 漏掉 x 方向会把邻居建筑的 pad 误判成压了本塔足迹 (第一次跑就踩到了这个假阳性)。
const FOOT=2.3;
rec.padOverlap=[];
for(const p of rec.pads){
if(Math.abs(p.lz)<=1.5&&Math.abs(p.lx)<=1.5) continue;   // foundation 自己的 pad: 本来就该盖住足迹
const penX=Math.min(FOOT,p.x1)-Math.max(-FOOT,p.x0);
const penZ=Math.min(FOOT,p.z1)-Math.max(-FOOT,p.z0);
if(penX>1e-6&&penZ>1e-6) rec.padOverlap.push({p,penX,penZ});
}
// 塔身足迹内地形台阶: 5×5 采样, |h - floor| 最大 = "室内不出现台阶/坑" 的量化
let hi=-1e9,lo=1e9;
for(let ix=-2;ix<=2;ix++)for(let iz=-2;iz<=2;iz++){
const q=P(ix*1.0,iz*1.0);
const h=hAt(q[0],q[1]);
if(h>hi)hi=h; if(h<lo)lo=h;
}
rec.footHi=hi; rec.footLo=lo; rec.footStep=Math.max(Math.abs(hi-t.floor),Math.abs(lo-t.floor));
// 楼梯段地形平整度 (有 pad 时应 ≈0)
let si=-1e9, sl=1e9;
for(let lz=1.9;lz<=6.9;lz+=0.25){ const q=P(0,lz); const h=hAt(q[0],q[1]); if(h>si)si=h; if(h<sl)sl=h; }
rec.runRelief=si-sl;
// ⑪ 与 dev/verify-buildings.js:438-444 **逐字同式**的三条 (步高≤0.45 / 登顶落点支撑面=顶面 ±0.12 / 落点头顶净高≥1.7):
//   全局 verify-buildings 由 Lead 统一跑; 本脚本把同一判据对 6 座哨亭单独算一遍 (改完建筑函数先自证)
{
const tp2=P(0,1.3), topY=deckTop;
const xz=(b,x,z)=>x>b.minX&&x<b.maxX&&z>b.minZ&&z<b.maxZ;
let sup=hAt(tp2[0],tp2[1]), head=null;
for(const b of boxes){
if(b.dead||!xz(b,tp2[0],tp2[1])) continue;
if(b.maxY<=topY+0.55&&b.maxY>sup) sup=b.maxY;
if(b.maxY>topY+0.15&&b.minY<topY+1.7) head=b;
}
rec.vb3={sr:g.sr,supDelta:sup-topY,head};
}
// 楼梯碰撞盒计数 (b.stair 标记): 交代布局指纹增量用 (每级 = 踏面 + 踢面, 斜置件走链式近似)
rec.stairBoxes=boxes.filter(b=>{
if(!b.stair||b.dead) return false;
const l=tctx2local(t,(b.minX+b.maxX)/2,(b.minZ+b.maxZ)/2);
return Math.abs(l[0])<=2.6&&l[1]>=-2.6&&l[1]<=8.4;
}).length;
return rec;
}
// 世界坐标 → 建筑的局部坐标 (与 bctx.L 同一套变换, 只用于把沙箱对象反算回局部)
function tctx2local(t,x,z){
const cs=Math.cos(t.ry), sn=Math.sin(t.ry);
const dx=x-t.x, dz=z-t.z;
return [dx*cs-dz*sn, dx*sn+dz*cs];
}
// ── 沙箱取数封装 ──
function loadRun(padsOff){
if(padsOff) process.env.PADS_OFF='1'; else delete process.env.PADS_OFF;
const r=SB.runCampaign(ISLAND,SEED);
const g=k=>vm.runInContext(k,r.ctx);
const run={ctx:r.ctx,CAMP:r.CAMP,id:g('CAMPAIGN.id'),
reg:g('BUILD_REG'),boxes:g('BOXES'),pads:g('PADS'),hAt:g('heightAt'),
bctx:g('bctx'),towerStairGeom:g('towerStairGeom')};
run.geomF=run.towerStairGeom;
return run;
}
function grid(run){
const towers=run.reg.filter(r=>r.type==='watchtower');
return towers.map(t=>{
const tctx=run.bctx(t.x,t.z,t.ry,0);
return measureTower({ctx:run.ctx,tctx,geomF:run.geomF,hAt:run.hAt,boxes:run.boxes,pads:run.pads},t);
});
}
// ── 合成坡地形: 15% 沿梯轴 (局部 +z 是梯脚方向), 只取运行时同一个 helper 的函数体 ──
function extractFn(src,name){
const i=src.indexOf('function '+name+'(');
if(i<0) return null;
let d=0,j=src.indexOf('{',i);
for(let k=j;k<src.length;k++){
if(src[k]==='{') d++;
else if(src[k]==='}'){ d--; if(!d) return src.slice(i,k+1); }
}
return null;
}
function synthetic(slope){
const src=fs.readFileSync(path.join(root,'js/05a-buildings.js'),'utf8');
const body=extractFn(src,'towerStairGeom');
if(!body) throw new Error('05a 里找不到 towerStairGeom');
const s={console,Math,heightAt:(x,z)=>slope*z,clamp:(v,a,b)=>v<a?a:(v>b?b:v)};
s.globalThis=s;
const c=vm.createContext(s);
vm.runInContext(body+'\n;globalThis.__G=towerStairGeom;',c,{filename:'05a[towerStairGeom]'});
const G=vm.runInContext('__G',c);
const ctx={L:(lx,lz)=>[lx,lz]};   // ry=0 的局部系: 合成地形就建在这套坐标里
let gMax=-1e9;
for(const [lx,lz] of [[-1.5,-1.5],[1.5,-1.5],[-1.5,1.5],[1.5,1.5]]) gMax=Math.max(gMax,slope*lz);
const deckTop=gMax+4.6;           // 与 watchtower 同口径: 平台面 = 最高柱地+4.6
return {cur:G(ctx,deckTop),legacy:G(ctx,deckTop,{legacy:true})};
}
// ═══════════════════════════════════════════
console.log('══ WS5 ㈠ 哨亭楼梯接地验证 (dev/verify-watchtower.js) ══');

// ── ⑧ 合成坡阴性对照 (先跑: 判据有效性) ──
console.log('\n── ⑧ 阴性对照: 15% 合成坡 (梯轴 z, +z = 梯脚方向) ──');
for(const slope of [-0.15,0.15]){
const {cur,legacy}=synthetic(slope);
const dir=slope<0?'坡向朝梯脚下降 (旧版悬空)':'坡向朝梯脚上升 (旧版埋头)';
const cg=lowestOf(cur.steps[0])-cur.steps[0].gi;
const lg=lowestOf(legacy.steps[0])-legacy.steps[0].gi;
console.log(`  slope=${(slope*100).toFixed(0)}%  ${dir}`);
console.log(`    逐级采样版: n=${cur.n} sr=${fmt(cur.sr)} 梯脚地形 ${fmt(cur.footGi)} 接地间距 ${fmt(cg)}`);
console.log(`    旧单点采样版(legacy): n=${legacy.n} sr=${fmt(legacy.sr)} 接地间距 ${fmt(lg)}`);
ok(cg>=-0.05-1e-9&&cg<=0.25+1e-9,`逐级采样版接地间距 ∈[-0.05,+0.25] (实测 ${fmt(cg)})`);
ok(lg<-0.05-1e-9||lg>0.25+1e-9,`旧单点采样版被同一判据抓到 (实测 ${fmt(lg)} ⇒ ${lg>0?'悬空':'埋头'} ${fmt(Math.abs(lg))}m)`);
}
// ⑩ 源码级: 生产调用点不得传 legacy
{
const src=fs.readFileSync(path.join(root,'js/05a-buildings.js'),'utf8');
const calls=(src.match(/towerStairGeom\([^)]*\)/g)||[]).filter(s2=>!s2.startsWith('towerStairGeom(ctx,deckTop,o)'));
console.log('\n── ⑩ 源码级: 生产调用点不传 legacy ──');
console.log('  05a 中的 towerStairGeom 调用点: '+JSON.stringify(calls));
ok(calls.length===1&&calls[0]==='towerStairGeom(ctx,deckTop)','唯一生产调用点是 towerStairGeom(ctx,deckTop) (无 legacy 参数)');
}

// ── 岛屿真实落位 ──
console.log('\n── 岛屿 (塔拉瓦, index '+ISLAND+', seed='+SEED+') 真实哨亭逐座量测 ──');
const run=loadRun(false);
ok(run.id==='island',`战役 id = ${run.id} (期望 island)`);
const rows=grid(run);
console.log(`  哨亭座数 = ${rows.length}`);
ok(rows.length>=1,'岛屿至少落位 1 座哨亭 (有量测对象)');
if(rows.length!==6) console.log(`  ⚠ 任务书记的"岛屿 6 座" 与实测 ${rows.length} 座不一致 —— 报告里如实给出`);
let worstFoot=1e9, worstChain=1e9, worstSr=0, worstTop=0, visBad=0, skirtMin=1e9, blockBad=0, nbrBad=0, padBad=0, stepMax=0, reliefMax=0;
for(let i=0;i<rows.length;i++){
const r=rows[i];
T.push(r);
console.log(`  哨亭#${i+1} (${r.x.toFixed(1)},${r.z.toFixed(1)},ry=${r.ry.toFixed(2)}) floor=${f2(r.floor)} deckTop=${f2(r.deckTop)}`);
console.log(`    梯段 n=${r.n} sr=${fmt(r.sr)} 踏面厚=${r.tread} 梯脚局部z=${f2(r.footZ)} 梯脚地形=${fmt(r.footGi)} 楼梯碰撞盒=${r.stairBoxes}`);
console.log(`    ① 接地间距=${fmt(r.footGap)}  ⑤ 立板链最差间距=${fmt(Math.max(...r.chainGaps))}  ② 顶踏步−deckTop=${r.topDelta.toExponential(1)}  ③ 级高最大偏差=${r.srMax.toExponential(1)}`);
console.log(`    ④ 无碰撞的楼梯网格: ${r.visMiss.length?r.visMiss.join(','):'(无)'}  ⑥ 梯脚→裙墙 ${f2(r.skirtDist)}m  进近路径 ${r.approach.map(a=>f2(a.y)+'@+'+a.dz+(a.blocked?(a.own?'✗本塔挡':'(邻居挡)'):'')).join(' ')}`);
console.log(`    ⑦ pad(局部) ${r.pads.length?r.pads.map(p=>`[lx${f2(p.lx)}±${p.hw} lz${f2(p.lz)}±${p.hd} z${f2(p.z0)}..${f2(p.z1)} h=${f2(p.h)}]`).join(' '):'(无)'} 楼梯段地形起伏=${f2(r.runRelief)}m 塔身足迹内 |h−floor|max=${f2(r.footStep)}m`);
console.log(`    (任务书原文口径) 每级最低结构件 vs 地形: 步0=${fmt(r.rawGaps[0])} 最差=${fmt(r.rawGapMax)} 最高级=${fmt(r.rawGaps[r.n-1])}`);
worstFoot=Math.min(worstFoot,r.footGap);
worstChain=Math.min(worstChain,Math.min(...r.chainGaps));
worstSr=Math.max(worstSr,r.srMax);
worstTop=Math.max(worstTop,Math.abs(r.topDelta));
visBad+=r.visMiss.length;
skirtMin=Math.min(skirtMin,r.skirtDist);
blockBad+=r.approach.filter(a=>a.blocked&&a.own).length;
nbrBad+=r.approach.filter(a=>a.blocked&&!a.own).length;
padBad+=r.padOverlap.length;
stepMax=Math.max(stepMax,r.footStep);
reliefMax=Math.max(reliefMax,r.runRelief);
}
console.log('');
ok(rows.every(r=>r.footGap>=-0.05-1e-9&&r.footGap<=0.25+1e-9),`① 接地: ${rows.length} 座哨亭最差接地间距 ${fmt(worstFoot)} ∈[-0.05,+0.25]`);
ok(rows.every(r=>Math.abs(r.topDelta)<1e-6),`② 顶踏步顶面 − deckTop: 最差 ${worstTop.toExponential(1)} (<1e-6)`);
ok(rows.every(r=>r.srMax<1e-6),`③ 相邻踏面顶高差恒定 sr: 最大偏差 ${worstSr.toExponential(1)} (<1e-6)`);
ok(visBad===0,`④ 楼梯范围内无纯视觉件: 缺碰撞的网格 ${visBad} 个`);
ok(rows.every(r=>Math.max(...r.chainGaps)<=0.05+1e-9),`⑤ 立板连续支承: 立板底到支承面最差间距 ${fmt(Math.max(...rows.map(r=>Math.max(...r.chainGaps))))} ≤0.05 (无悬空板)`);
ok(skirtMin>=1.0,`⑥ 梯脚→最近裙墙碰撞盒 ${f2(skirtMin)}m ≥1.0m; 本塔件挡步点 ${blockBad} 个 (邻居建筑/道具挡 ${nbrBad} 个 —— 只报事实, 与本塔地基无关)`);
ok(padBad===0,`⑦ 楼梯 pad 不压塔身足迹: 越界 pad ${padBad} 块; 塔身足迹内 |地形−楼面| 最大 ${f2(stepMax)}m ≤0.5 (无台阶/坑)`);
ok(rows.every(r=>r.vb3.sr<=0.45),`⑪（verify-buildings #3 同式）步高 ≤0.45: 最大 ${fmt(Math.max(...rows.map(r=>r.vb3.sr)))}`);
ok(rows.every(r=>Math.abs(r.vb3.supDelta)<=0.12),`⑪ 登顶落点支撑面 = 顶面 ±0.12: 最大偏差 ${fmt(Math.max(...rows.map(r=>Math.abs(r.vb3.supDelta))))}`);
ok(rows.every(r=>!r.vb3.head),`⑪ 登顶落点头顶净高 ≥1.7: 被挡 ${rows.filter(r=>r.vb3.head).length} 座`);
console.log(`    ⓘ 楼梯段地形起伏最大 ${f2(reliefMax)}m (pad 生效时应 ≈0; 未生效时由逐级采样兜底)`);

// ── ⑨ PADS_OFF: 没有整平平台时的极端情形 ──
console.log('\n── ⑨ PADS_OFF 沙箱 (关掉全部建筑地基平台 = 没有整平平台) ──');
const run2=loadRun(true);
const rows2=grid(run2);
console.log(`  哨亭座数 = ${rows2.length}; 逐座接地间距: ${rows2.map(r=>fmt(r.footGap)).join(' ')}`);
console.log(`  逐座梯脚地形 / 楼面: ${rows2.map(r=>fmt(r.footGi)+' / '+fmt(r.floor)).join('  ')}`);
// pad 生效前后的梯脚地形实值: 按落位坐标把两次构建的哨亭对上 (浮点相等的组数 = 布局未因 pad 改变)
console.log('  pad 生效前/后对比 (同坐标配对):');
for(const r of rows){
const m=rows2.find(r2=>Math.abs(r2.x-r.x)<0.05&&Math.abs(r2.z-r.z)<0.05);
console.log(`    (${r.x.toFixed(0)},${r.z.toFixed(0)}) 梯脚 heightAt: 有 pad ${fmt(r.footGi)} / 无 pad ${m?fmt(m.footGi):'—'}  Δ=${m?fmt(r.footGi-m.footGi):'—'}  楼面 ${fmt(r.floor)}/${m?fmt(m.floor):'—'}`);
}
const paired=rows.filter(r=>rows2.some(r2=>Math.abs(r2.x-r.x)<0.05&&Math.abs(r2.z-r.z)<0.05)).length;
ok(paired===rows.length,`两套沙箱的哨亭落位坐标一致 (${paired}/${rows.length}) —— 地基平台不改变哨亭选址`);
ok(rows2.length>=1&&rows2.every(r=>r.footGap>=-0.05-1e-9&&r.footGap<=0.25+1e-9),
`⑨ 无 pad 时逐级采样仍把梯脚钉在地形上 (最差 ${fmt(Math.min(...rows2.map(r=>r.footGap)))})`);
ok(rows2.every(r=>Math.abs(r.topDelta)<1e-6),`⑨b 无 pad 时顶踏步仍与 deckTop 齐平 (最差 ${Math.max(...rows2.map(r=>Math.abs(r.topDelta))).toExponential(1)})`);

console.log(fail?`\n✗ 哨亭楼梯验证未通过 (${fail} 项)`:'\n✔ 哨亭楼梯验证全部通过');
process.exit(fail?1:0);
