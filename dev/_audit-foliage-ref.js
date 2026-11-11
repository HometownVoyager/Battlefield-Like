// ─────────────────────────────────────────────
// dev/_audit-foliage-ref.js —— I5 植被遮蔽独立审计对照脚本 (task-7; 不进 index.html)
//
// 为什么单独一支: 审计者不得复用实现者的探针 (dev/verify-foliage.js) —— 那份探针的
//   "暴力参考实现"与生产代码出自同一人, 交叉校验的独立性不足 (两边同时漏同一种情形时
//   会一起报"0 不一致")。本脚本自带三件独立物:
//   ① 自己的 boot (CORE 链 00-config..05c; 不载 14/15/16 ⇒ 不受其它任务改动影响)
//   ② 自己的参考实现: 归一化方向 + 圆心投影/垂距/半弦长公式 (与生产代码的二次判别式不同源)
//   ③ 抽样参考实现: 沿视线每 step 米采样 (无任何共享数学), 作为第二重校验
//   ④ 审计侧复现"最小修法"版步进 (losFixed) —— 用来证明修法充分, 不落盘到 js/
//
// 审计项:
//   A. 生产常量 vs 口径 (FOLIAGE_LOS 表)
//   B. 随机对点: 生产 vs 独立参考 (200 对 / 20000 对) + 抽样参考三方对照 + 失配方向统计
//   C. 端点格专项: "敌人站在灌木里" / "观察者站在灌木里" + losFixed 修法验证
//   D. 最坏情况: 400m 视线 / 全图对角线 的单次耗时与格步进上界 (守卫 512)
//   E. 滩头纪律: 灌木/蕨丛/椰树的 shoreDist 分带坐标普查 + 跑道/旗圈实测
//   F. 不挡子弹: 记录无碰撞体 + raycastWorld 运行期穿透 + 调用后碰撞表零改动
//   G. 容量/鲁棒性: 实例批容量、草丛落位率、烧毁后遮蔽消失、统计口自洽
// 用法: node dev/_audit-foliage-ref.js [战役序号=11] [随机对数=20000]
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'), path=require('path'), vm=require('vm');
const root=path.resolve(__dirname,'..');
const {sandbox,document,window}=require('./_bootstub.js');
const T3=sandbox.THREE;
const CAMP_IDX=parseInt(process.argv[2]||'11');
const NPAIR=parseInt(process.argv[3]||'20000');

let fails=0;
const ok=m=>console.log('  ✔ '+m);
const bad=m=>{ console.log('  ✘ '+m); fails++; };
const info=m=>console.log('  · '+m);

// ── ① 自己的 boot (与实现者探针无共享代码) ──
const FILES=['js/00-config.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js',
             'js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js'];
function boot(idx){
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document; ctx.window=window; ctx.globalThis=ctx;
ctx.localStorage={_s:{sf_campaign:String(idx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
ctx.location={search:'?seed=42',reload(){},href:'http://localhost/'};
ctx.scene=ctx.scene||new T3.Group();
ctx.MAT={stone:{},wood:{},woodDark:{},roof:{},plaster:{},brick:{},sandbag:{},hay:{},metal:{},metalDark:{},bark:{},leaves:{},rubble:{},grass:{},earth:{},concrete:{}};
ctx.TEX={leaves:{}};
ctx.svgApply=t=>t; ctx.makeTex=()=>({}); ctx.addSnowCap=()=>{};
ctx.wires=[]; ctx.camera={position:{x:0,y:0,z:0}};
ctx.player={alive:true,isPlayer:true,team:0,pos:{x:0,y:0,z:0},damage(){},noticeThreat(){}};
ctx.AudioSys={explosion(){},gunshot(){},click(){},hurt(){}};
ctx.addTrauma=()=>{}; ctx.spawnP=()=>{}; ctx.PT={smoke:1,dark:1,flash:1,blood:1,dirt:1,spark:1};
ctx.spawnWallDebris=()=>{};
ctx.TAU=Math.PI*2; ctx.HPI=Math.PI/2;
ctx.queueSink=job=>job; ctx.updateWreckSinks=()=>{}; ctx.finishSinkJob=()=>{};
ctx.matchOver=false; ctx.nowT=0;
for(const f of FILES) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
return ctx;
}
const t0=Date.now();
const ctx=boot(CAMP_IDX);
const G=n=>vm.runInContext(n,ctx);
const CAMPAIGN=G('CAMPAIGN'), MAP_SIZE=G('MAP_SIZE');
const heightAt=G('heightAt'), shoreDist=G('shoreDist'), roadDist=G('roadDist');
const rectDist=G('rectDist'), freeSpot=G('freeSpot'), SEA=G('SEA');
const FLORA_HASH=G('FLORA_HASH'), BUSH_LIVE=G('BUSH_LIVE'), TREE_LIVE=G('TREE_LIVE');
const BURN_INST=G('BURN_INST'), vanishFlora=G('vanishFlora'), los=G('foliageBlocksLOS');
const FLORA_CFG=G('FLORA_CFG'), FOLIAGE_LOS=G('FOLIAGE_LOS'), STAT=G('FLORA_LOS_STAT');
const buildSpatialIndex=G('buildSpatialIndex'), raycastWorld=G('raycastWorld'), V3f=G('V3');
const FN=G('FN'), FRES=G('FRES'), FOFF=G('FOFF');
const PROPS=G('PROPS'), CYLS=G('CYLS'), BOXES=G('BOXES');
const out=[]; // 全量记录
for(const arr of FLORA_HASH.values()) for(const rec of arr) out.push(rec);
// 先记下构建期容量不变量 (后续测试会再 flush 灌木, 会替换 BUSH_IM —— 必须在加测试株之前取)
const BUSH_IM0=G('BUSH_IM');
const CAP={bushIM:bushIM0=>0, count:BUSH_IM0?BUSH_IM0.count:0, live:BUSH_LIVE.length,
           propN:PROPS.length, cylN:CYLS.length, boxN:BOXES.length, hashN:FLORA_HASH.size, recN:out.length};
console.log('═══ dev/_audit-foliage-ref.js (独立审计对照) ═══');
console.log('战役 ['+CAMP_IDX+'] '+CAMPAIGN.id+'/'+CAMPAIGN.layout+' boot='+(Date.now()-t0)+'ms  记录='+out.length);

// ── 口径表 (审计判据: 来自 task-5 描述与验收探针的带语义, 硬写在审计侧) ──
const SPEC={bushLow:0.15,bushTop:1.10,bushR:1.30,fernLow:0.10,fernTop:0.75,fernR:1.00,
            treeLow:1.00,treeTop:5.40,treeR:2.30,palmDrop:1.80,palmRise:0.30,palmR:3.20};
{
console.log('\n【A 生产常量 vs 口径】');
let diff=[];
for(const k of Object.keys(SPEC)) if(FOLIAGE_LOS[k]!==SPEC[k]) diff.push(k+': 生产='+FOLIAGE_LOS[k]+' 口径='+SPEC[k]);
console.log('  生产 FOLIAGE_LOS='+JSON.stringify(FOLIAGE_LOS));
if(diff.length) bad('常量与口径不一致: '+diff.join('; ')); else ok('14 个带参数逐项等于口径');
}
// 独立参考实现: 归一化方向 + 垂距/半弦长 (与生产判别式不同源)
function bandOf(rec){
const s=rec.s||1, g=rec.g0||0;
switch(rec.kind){
case 'bush': return {lo:g+SPEC.bushLow*s, hi:g+SPEC.bushTop*s, r2:(SPEC.bushR*s)*(SPEC.bushR*s)};
case 'fern': return {lo:g+SPEC.fernLow, hi:g+SPEC.fernTop, r2:SPEC.fernR*SPEC.fernR};
case 'tree': return {lo:g+SPEC.treeLow*s, hi:g+SPEC.treeTop*s, r2:(SPEC.treeR*s)*(SPEC.treeR*s)};
case 'palm': { const y1=rec.cyl?rec.cyl.y1:g; return {lo:y1-SPEC.palmDrop, hi:y1+SPEC.palmRise, r2:SPEC.palmR*SPEC.palmR}; }
default: return null;
}
}
const FLAT=[];
for(const rec of out){ const b=bandOf(rec); if(b) FLAT.push({rec,lo:b.lo,hi:b.hi,r2:b.r2}); }
function refBlocked(ax,ay,az,bx,by,bz,hits){
const dx=bx-ax, dz=bz-az, dy=by-ay;
const L=Math.hypot(dx,dz);
if(L<1e-6) return false;
const ux=dx/L, uz=dz/L;
let hit=false;
for(let i=0;i<FLAT.length;i++){
const e=FLAT[i], rec=e.rec;
if(rec.dead||rec.alive===false||rec.fall) continue;
const px=rec.x-ax, pz=rec.z-az;
const proj=px*ux+pz*uz;                    // 圆心在视线上的投影距离
const perp2=px*px+pz*pz-proj*proj;         // 垂距² (独立写法: 不用二次判别式)
if(perp2>e.r2) continue;
const half=Math.sqrt(e.r2-perp2);          // 半弦长
let t0=(proj-half)/L, t1=(proj+half)/L;
if(t0<0) t0=0; if(t1>1) t1=1;
if(t0>t1) continue;
const ya=ay+dy*t0, yb=ay+dy*t1;
const ylo=ya<yb?ya:yb, yhi=ya<yb?yb:ya;
if(ylo<=e.hi&&yhi>=e.lo){ hit=true; if(!hits) return true; hits.push(rec); }
}
return hit;
}
function sampleBlocked(ax,ay,az,bx,by,bz,step){
const L=Math.hypot(bx-ax,by-ay,bz-az);
const n=Math.max(2,Math.ceil(L/step));
for(let i=0;i<=n;i++){
const t=i/n, x=ax+(bx-ax)*t, y=ay+(by-ay)*t, z=az+(bz-az)*t;
for(let k=0;k<FLAT.length;k++){
const e=FLAT[k], rec=e.rec;
if(rec.dead||rec.alive===false||rec.fall) continue;
const ddx=x-rec.x, ddz=z-rec.z;
if(ddx*ddx+ddz*ddz>e.r2) continue;
if(y<e.lo||y>e.hi) continue;
return true;
}
}
return false;
}
// 确定性伪随机 (自己的种子偏移, 与实现者探针序列无关)
let _s=987654321;
const rnd=()=>((_s=_s*1103515245+12345&0x7fffffff)/0x7fffffff);

// ── B. 随机对点三方对照 ──
function runPairs(n,verbose){
let miss=0, fp=0, blocked=0, prodBlocked=0, firstBad=[];
for(let i=0;i<n;i++){
const ax=(rnd()*2-1)*(MAP_SIZE/2-20), az=(rnd()*2-1)*(MAP_SIZE/2-20);
const bx=ax+(rnd()*2-1)*90, bz=az+(rnd()*2-1)*90;
const ay=heightAt(ax,az)+1.5, by=heightAt(bx,bz)+1.4;
const p=los(ax,ay,az,bx,by,bz), r=refBlocked(ax,ay,az,bx,by,bz);
if(p) prodBlocked++;
if(r) blocked++;
if(p!==r){ if(r&&!p) miss++; else fp++; if(firstBad.length<6) firstBad.push({ax,ay,az,bx,by,bz,p,r}); }
}
console.log('  '+n+' 对随机点: 参考判挡='+blocked+' 生产判挡='+prodBlocked+' 漏判(参考真/生产假)='+miss+' 误报(参考假/生产真)='+fp);
if(firstBad.length){
for(const c of firstBad){
const hits=[]; refBlocked(c.ax,c.ay,c.az,c.bx,c.by,c.bz,hits);
const d=Math.hypot(c.bx-c.ax,c.bz-c.az);
const near=hits.map(rec=>{ const t=Math.hypot(rec.x-c.ax,rec.z-c.az)/d; return rec.kind+'@t='+t.toFixed(3); }).join(',');
console.log('    失配样本: A=('+c.ax.toFixed(0)+','+c.az.toFixed(0)+') B=('+c.bx.toFixed(0)+','+c.bz.toFixed(0)+') 生产='+c.p+' 参考='+c.r+' 拦路: '+near);
}
}
return {miss,fp,blocked,prodBlocked,firstBad};
}
console.log('\n【B 随机对点: 生产 vs 独立参考】');
const b200=runPairs(200);
if(b200.miss===0&&b200.fp===0) ok('200 对全部一致 (Lead 指定抽样)'); else bad('200 对失配 '+(b200.miss+b200.fp)+' 对');
const bBig=runPairs(NPAIR);
if(bBig.miss===0&&bBig.fp===0) ok(NPAIR+' 对全部一致'); else bad(NPAIR+' 对失配 '+(bBig.miss+bBig.fp)+' 对 (漏判 '+bBig.miss+' / 误报 '+bBig.fp+', 占比 '+((bBig.miss+bBig.fp)/NPAIR*100).toFixed(3)+'%)');
{
let sVsRef=0, sVsProd=0, tested=0;
for(let i=0;i<60;i++){
const ax=(rnd()*2-1)*250, az=(rnd()*2-1)*250;
const a=rnd()*Math.PI*2, L=10+rnd()*30;
const bx=ax+Math.sin(a)*L, bz=az+Math.cos(a)*L;
const ay=heightAt(ax,az)+1.5, by=heightAt(bx,bz)+1.4;
const p=los(ax,ay,az,bx,by,bz), r=refBlocked(ax,ay,az,bx,by,bz), s=sampleBlocked(ax,ay,az,bx,by,bz,0.05);
tested++;
if(r!==s) sVsRef++;
if(p!==s) sVsProd++;
}
console.log('  抽样参考 (step=0.05m) 三方: '+tested+' 对, 参考≠采样 '+sVsRef+' 对 (细擦边容许), 生产≠采样 '+sVsProd+' 对');
}

// ── C. 端点格专项 + 最小修法验证 ──
// 审计侧复现的最小修法: 步进后不立即 break, 只标记 stop —— 下一轮先把新格扫完再退。
// (与生产代码唯一差别就是这一处; 用它证明"修法充分", 不落盘到 js/)
let _lsA=0;
function losFixed(ax,ay,az,bx,by,bz){
const idx=G('_floraLosIdx'); if(!idx||!idx.size) return false;
const dx=bx-ax, dz=bz-az, dy=by-ay;
const L2=dx*dx+dz*dz; if(L2<1e-6) return false;
let i=Math.max(0,Math.min(FN-1,Math.floor((ax+FOFF)/FRES))), j=Math.max(0,Math.min(FN-1,Math.floor((az+FOFF)/FRES)));
const iE=Math.max(0,Math.min(FN-1,Math.floor((bx+FOFF)/FRES))), jE=Math.max(0,Math.min(FN-1,Math.floor((bz+FOFF)/FRES)));
const sI=dx>0?1:(dx<0?-1:0), sJ=dz>0?1:(dz<0?-1:0);
const dI=sI?Math.abs(FRES/dx):Infinity, dJ=sJ?Math.abs(FRES/dz):Infinity;
let tI=sI?((sI>0?(i+1)*FRES-FOFF:i*FRES-FOFF)-ax)/dx:Infinity;
let tJ=sJ?((sJ>0?(j+1)*FRES-FOFF:j*FRES-FOFF)-az)/dz:Infinity;
const stamp=++_lsA;
let stop=false;
for(let guard=0;guard<512;guard++){
const arr=idx.get(j*FN+i);
if(arr) for(let k=0;k<arr.length;k++){
const rec=arr[k];
if(rec.dead||rec.alive===false||rec.fall) continue;
if(rec._lsA===stamp) continue;
rec._lsA=stamp;
const e=bandOf(rec); if(!e) continue;
const fx=ax-rec.x, fz=az-rec.z;
const q=2*(fx*dx+fz*dz), c=fx*fx+fz*fz-e.r2;
const disc=q*q-4*L2*c; if(disc<0) continue;
const sq=Math.sqrt(disc);
let t0=(-q-sq)/(2*L2), t1=(-q+sq)/(2*L2);
if(t0<0) t0=0; if(t1>1) t1=1;
if(t0>t1) continue;
const ya=ay+dy*t0, yb=ay+dy*t1;
const ylo=ya<yb?ya:yb, yhi=ya<yb?yb:ya;
if(ylo<=e.hi&&yhi>=e.lo) return true;
}
if(i===iE&&j===jE) break;
if(stop) break;                       // ← 修法: 上一轮已判定"新格是最后一格", 本轮已扫过它
if(tI<tJ){ i+=sI; tI+=dI; } else { j+=sJ; tJ+=dJ; }
if(Math.min(tI,tJ)>1) stop=true;      // ← 修法: 只标记, 不 break
}
return false;
}
console.log('\n【C 端点格专项: 视线端点与株心重合】');
{
const cellOf=(x,z)=>Math.floor((z+FOFF)/FRES)*FN+Math.floor((x+FOFF)/FRES);
const regCells=rec=>{ const b=bandOf(rec); if(!b) return null; const r=Math.sqrt(b.r2);
const i0=Math.floor((rec.x-r+FOFF)/FRES), i1=Math.floor((rec.x+r+FOFF)/FRES);
const j0=Math.floor((rec.z-r+FOFF)/FRES), j1=Math.floor((rec.z+r+FOFF)/FRES);
return {n:(i1-i0+1)*(j1-j0+1), i0,i1,j0,j1}; };
let missEnd=0, missEndFixed=0, tot=0, missStart=0, fixDiff=0;
const samples=[];
for(let bi=0;bi<BUSH_LIVE.length;bi++){
const rec=BUSH_LIVE[bi];
if(rec.dead||!rec.alive) continue;
tot++;
const g=rec.g0;
// 方向 1: 观察者在 30m 外, 敌人站在灌木里 (B = 株心)
const a1x=rec.x-30, a1y=heightAt(a1x,rec.z)+1.62, b1y=g+1.40;
const p1=los(a1x,a1y,rec.z, rec.x,b1y,rec.z);
const r1=refBlocked(a1x,a1y,rec.z, rec.x,b1y,rec.z);
const f1=losFixed(a1x,a1y,rec.z, rec.x,b1y,rec.z);
// 方向 2: 观察者站在灌木里, 敌人 30m 外 (A = 株心)
const b2x=rec.x+30, b2y=heightAt(b2x,rec.z)+1.40;
const p2=los(rec.x,g+1.62,rec.z, b2x,b2y,rec.z);
const r2=refBlocked(rec.x,g+1.62,rec.z, b2x,b2y,rec.z);
if(r1&&!p1){ missEnd++; const rc=regCells(rec);
  if(samples.length<5) samples.push({rec,rc,cell:cellOf(rec.x,rec.z)}); }
if(r1!==f1) fixDiff++;
if(f1&&!p1) missEndFixed++;
if(r2&&!p2) missStart++;
}
console.log('  灌木 '+tot+' 株, 场景="敌人站在灌木里"(B=株心, 观察者 30m 外): 参考判挡但生产漏判 '+missEnd+' 株 ('+(missEnd/tot*100).toFixed(1)+'%)');
console.log('  反向场景="观察者站在灌木里"(A=株心): 参考判挡但生产漏判 '+missStart+' 株 ('+(missStart/tot*100).toFixed(1)+'%)  ← 起点格被扫描, 量级应远小于正向');
for(const s of samples){
console.log('    漏判样本: 株@('+s.rec.x.toFixed(1)+','+s.rec.z.toFixed(1)+') s='+(s.rec.s||1).toFixed(2)+
' 株心格='+s.cell+' 蓬面登记 i['+(s.rc?s.rc.i0:'?')+','+(s.rc?s.rc.i1:'?')+'] j['+(s.rc?s.rc.j0:'?')+','+(s.rc?s.rc.j1:'?')+']');
}
console.log('  审计侧最小修法 (losFixed, 仅改 break 时机): 与独立参考不一致 '+fixDiff+' 株; 修法救回的漏判 '+missEndFixed+' 株');
if(missEnd>0) bad('端点格漏判: '+missEnd+'/'+tot+' 株灌木在"敌人站在灌木里"场景下失效 (方向不对称: 反向 '+missStart+')');
else ok('端点场景无漏判');
if(fixDiff===0) ok('最小修法充分: '+tot+' 株端点场景与独立参考完全一致 (修回 '+missEndFixed+' 株漏判)');
else bad('最小修法未能收敛 (差 '+fixDiff+')');
// 修法在随机对点上的表现
let fixMiss=0;
for(let i=0;i<4000;i++){
const ax=(rnd()*2-1)*(MAP_SIZE/2-20), az=(rnd()*2-1)*(MAP_SIZE/2-20);
const bx=ax+(rnd()*2-1)*90, bz=az+(rnd()*2-1)*90;
const ay=heightAt(ax,az)+1.5, by=heightAt(bx,bz)+1.4;
if(losFixed(ax,ay,az,bx,by,bz)!==refBlocked(ax,ay,az,bx,by,bz)) fixMiss++;
}
console.log('  最小修法在 4000 对随机点上与参考不一致 '+fixMiss+' 对');
}

// ── D. 最坏情况 (400m / 全图对角线) ──
console.log('\n【D 最坏情况单次耗时】');
{
const bench=(ax,ay,az,bx,by,bz,n)=>{ let mx=0, sum=0;
for(let i=0;i<n;i++){ const t=process.hrtime.bigint(); los(ax,ay,az,bx,by,bz); const dt=Number(process.hrtime.bigint()-t)/1000; sum+=dt; if(dt>mx) mx=dt; }
return {max:mx, mean:sum/n};
};
let worst=null;
for(let i=0;i<4000;i++){
const ax=(rnd()*2-1)*300, az=(rnd()*2-1)*300;
const a=rnd()*Math.PI*2;
const bx=ax+Math.sin(a)*400, bz=az+Math.cos(a)*400;
if(Math.abs(bx)>300||Math.abs(bz)>300) continue;
const hits=[]; refBlocked(ax,heightAt(ax,az)+1.6,az,bx,heightAt(bx,bz)+1.4,bz,hits);
if(!worst||hits.length>worst.n) worst={n:hits.length,ax,az,bx,bz};
}
const t400=bench(worst.ax,heightAt(worst.ax,worst.az)+1.6,worst.az,worst.bx,heightAt(worst.bx,worst.bz)+1.4,worst.bz,1000);
console.log('  400m 最密视线 (穿蓬面最多的一条): ('+worst.ax.toFixed(0)+','+worst.az.toFixed(0)+')→('+worst.bx.toFixed(0)+','+worst.bz.toFixed(0)+')  穿蓬面 '+worst.n+' 株');
console.log('    1000 次: 单次最大='+t400.max.toFixed(2)+'µs  均值='+t400.mean.toFixed(2)+'µs');
// 4000 条 400m 随机视线逐条测单次耗时 → 取真实最坏 (不预设"穿蓬面最多=最贵")
let wMax=0, wSum=0, wChord=null;
for(let i=0;i<4000;i++){
const ax=(rnd()*2-1)*300, az=(rnd()*2-1)*300;
const a=rnd()*Math.PI*2;
const bx=ax+Math.sin(a)*400, bz=az+Math.cos(a)*400;
if(Math.abs(bx)>310||Math.abs(bz)>310) continue;
const ay=heightAt(ax,az)+1.6, by=heightAt(bx,bz)+1.4;
const t=process.hrtime.bigint(); los(ax,ay,az,bx,by,bz); const dt=Number(process.hrtime.bigint()-t)/1000;
wSum+=dt; if(dt>wMax){ wMax=dt; wChord={ax,az,bx,bz}; }
}
console.log('  4000 条 400m 随机视线: 单次最大='+wMax.toFixed(2)+'µs  均值='+(wSum/4000).toFixed(2)+'µs'+(wChord?('  最坏一条: ('+wChord.ax.toFixed(0)+','+wChord.az.toFixed(0)+')→('+wChord.bx.toFixed(0)+','+wChord.bz.toFixed(0)+')'):''));
// 游戏内实际调用口径 (perceive 视距 ≤95m): 单独统计候选精算株数
{
const c0=STAT.calls, t0s=STAT.tested;
for(let i=0;i<20000;i++){
const ax=(rnd()*2-1)*280, az=(rnd()*2-1)*280;
const a=rnd()*Math.PI*2, L=10+rnd()*85;
const bx=ax+Math.sin(a)*L, bz=az+Math.cos(a)*L;
los(ax,heightAt(ax,az)+1.5,az,bx,heightAt(bx,bz)+1.5,bz);
}
console.log('  游戏口径 10~95m × 20000 次: 平均精算 '+((STAT.tested-t0s)/(STAT.calls-c0)).toFixed(2)+' 株/次 (全图 '+out.length+' 株)');
}
const dA=[-MAP_SIZE/2+6,-MAP_SIZE/2+6], dB=[MAP_SIZE/2-6,MAP_SIZE/2-6];
const dHit=[], pDiag=los(dA[0],heightAt(dA[0],dA[1])+1.6,dA[1],dB[0],heightAt(dB[0],dB[1])+1.4,dB[1]);
const rDiag=refBlocked(dA[0],heightAt(dA[0],dA[1])+1.6,dA[1],dB[0],heightAt(dB[0],dB[1])+1.4,dB[1],dHit);
const tDiag=bench(dA[0],heightAt(dA[0],dA[1])+1.6,dA[1],dB[0],heightAt(dB[0],dB[1])+1.4,dB[1],200);
console.log('  全图对角线 '+Math.hypot(dB[0]-dA[0],dB[1]-dA[1]).toFixed(0)+'m: 生产='+pDiag+' 参考='+rDiag+' (参考拦路 '+dHit.length+' 株)  单次最大='+tDiag.max.toFixed(2)+'µs');
const cellsN=STAT.cells, refsN=STAT.refs;
let maxPerCell=0;
const idx2=G('_floraLosIdx');
for(const [,arr] of idx2) if(arr.length>maxPerCell) maxPerCell=arr.length;
// 格步进上界: 直线穿格数 ≤ |Δi|+|Δj|+1, 图内最大 = 2*(FN-1)+1
const stepMax=2*(FN-1)+1;
const MAXCELL=G('FOLIAGE_LOS_MAXCELL');
console.log('  索引: 格数='+cellsN+' 引用数='+refsN+' 单格最多='+maxPerCell+' 株  建索引='+STAT.ms+'ms  FN='+FN);
console.log('  步进上界: 图内任意视线 ≤ 2×(FN-1)+1 = '+stepMax+' 步; 守卫 FOLIAGE_LOS_MAXCELL='+MAXCELL+' ⇒ '+(stepMax<=MAXCELL?'守卫覆盖全图 (不会截断)':'守卫不足, 会截断'));
console.log('  成本上界: 步数 × 单格最多株数 = '+stepMax+'×'+maxPerCell+' ≈ '+(stepMax*maxPerCell)+' 次记录测试 (全图记录 '+out.length+')');
if(t400.max>200) bad('400m 最坏单次 '+t400.max.toFixed(1)+'µs 超 200µs'); else ok('400m 最坏单次 '+t400.max.toFixed(2)+'µs ≤ 200µs');
if(stepMax>MAXCELL) bad('512 守卫小于图内最大步数'); else ok('512 守卫覆盖图内最大步数 ('+stepMax+')');
}

// ── E. 滩头纪律坐标普查 ──
console.log('\n【E 滩头纪律 (shoreDist 分带普查)】');
{
const kinds={bush:[],fern:[],palm:[],tree:[]};
for(const rec of out) if(kinds[rec.kind]) kinds[rec.kind].push(rec);
for(const k of Object.keys(kinds)){
const arr=kinds[k];
const c=[0,0,0,0,0];
let near=-1e9, nearRec=null;
for(const rec of arr){ const d=shoreDist(rec.x,rec.z);
if(d>-6) c[0]++; else if(d>-16) c[1]++; else if(d>-22) c[2]++; else if(d>-34) c[3]++; else c[4]++;
if(d>near){ near=d; nearRec=rec; }
}
console.log('  '+k+' ('+arr.length+'): >-6(湿沙/迎海面)='+c[0]+'  -6~-16(干沙滩/迎海面)='+c[1]+'  -16~-22(脊线区)='+c[2]+'  -22~-34(背坡)='+c[3]+'  <-34(内陆)='+c[4]+'   最靠岸 shoreDist='+(nearRec?near.toFixed(2):'n/a')+' @('+(nearRec?nearRec.x.toFixed(1)+','+nearRec.z.toFixed(1):'-')+')');
}
let inRunway=0, inFlag=[];
if(!SEA) info('无海图 (SEA=null): shoreDist 恒 1e9, 滩头分带与跑道检查不适用 —— 本节仅环礁有效');
for(const rec of out){
if(!['bush','fern','tree','palm'].includes(rec.kind)) continue;
if(SEA&&rectDist(rec.x,rec.z,SEA.runway.x0,SEA.runway.z0,SEA.runway.x1,SEA.runway.z1)<=0) inRunway++;
for(const f of CAMPAIGN.flags) if(Math.hypot(rec.x-f.x,rec.z-f.z)<f.r) inFlag.push({kind:rec.kind,x:rec.x,z:rec.z,f:f.id});
}
console.log('  跑道矩形内植被='+inRunway+' (应为 0)');
console.log('  旗点圈内植被='+inFlag.length+(inFlag.length?('  '+inFlag.slice(0,4).map(v=>v.kind+'@'+v.f+'('+v.x.toFixed(0)+','+v.z.toFixed(0)+')').join(' ')):'')+'  (K2 段留白只约束新增灌木; 椰林/野树为改造前既有, 仅记录)');
const bushOnWet=out.filter(r=>r.kind==='bush'&&shoreDist(r.x,r.z)>-16).length;
const bushOnBack=out.filter(r=>r.kind==='bush'&&shoreDist(r.x,r.z)>-22&&shoreDist(r.x,r.z)<=-16).length;
if(bushOnWet>0) bad('有 '+bushOnWet+' 株灌木落在 shoreDist>-16 (湿沙/迎海面)'); else ok('shoreDist>-16 区间灌木=0 (滩头火力场保留)');
if(inRunway>0) bad('跑道矩形内有 '+inRunway+' 株植被'); else ok('跑道矩形内植被=0');
info('灌木分布: 背坡(-22~-34) '+out.filter(r=>r.kind==='bush'&&shoreDist(r.x,r.z)>-34&&shoreDist(r.x,r.z)<=-22).length+' 株, 脊线区 '+bushOnBack+' 株, FLORA_CFG.shoreGuard='+FLORA_CFG.shoreGuard);
}

// ── F. 不挡子弹 ──
console.log('\n【F 不挡子弹】');
{
// F0. 全仓库引用 + **所在函数** (判断是否落在弹道/命中链, 而不是只看文件名)
{
const KW=/^(if|for|while|switch|catch|return|typeof|else|do|const|let|var)\b/;
const enclosing=(lines,i)=>{
for(let k=i;k>=0;k--){
const L=lines[k];
let m=L.match(/^\s{0,2}(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{\s*$/);
if(m&&!KW.test(m[1])) return m[1];
m=L.match(/^\s*function\s+([A-Za-z_$][\w$]*)/);
if(m) return m[1];
}
return '?';
};
const refs=[];
for(const f of fs.readdirSync(path.join(root,'js')).filter(x=>x.endsWith('.js'))){
const lines=fs.readFileSync(path.join(root,'js',f),'utf8').split(/\r?\n/);
for(let i=0;i<lines.length;i++) if(lines[i].includes('foliageBlocksLOS')) refs.push({f,line:i+1,fn:enclosing(lines,i)});
}
console.log('  全仓库引用 (文件:行 所在函数):');
for(const r of refs) console.log('    '+r.f+':'+r.line+'  ['+r.fn+']');
const BALLISTIC=['raySoldiers','raycastWorld','fireBullet','vehHitCyl','rayCyl','updateShells','splashDamage'];
const inBallistic=refs.filter(r=>BALLISTIC.includes(r.fn));
const defFiles=[...new Set(refs.map(r=>r.f))];
console.log('  定义/接入文件: '+defFiles.join(', ')+'   弹道/命中函数体内的引用: '+(inBallistic.length?JSON.stringify(inBallistic):'0'));
if(inBallistic.length) bad('遮蔽函数出现在弹道/命中函数体内: '+inBallistic.map(r=>r.fn).join(',')); else ok('没有任何引用落在弹道/命中函数体内');
// ★2026-11-03 判据跟码修钉 (一.89 遗留): 一.89 的 perceive 优先复核在 perceive() 内合法加了第二处调用 —— 护栏本意是
//   '只许落在感知层', 数量不再是 1 (循环外复核+循环内粗筛)。改判: ≥1 且全部在 perceive() 内。
const _bots=refs.filter(r=>r.f==='14-bots.js');
if(_bots.length<1) bad('14-bots.js 引用数=0 (perceive 内应有植被遮蔽粗筛)');
else if(_bots.some(r=>r.fn!=='perceive')) bad('14-bots.js 调用不全在 perceive() 内 ('+_bots.map(r=>r.fn).join('/')+')');
else ok('14-bots.js 共 '+_bots.length+' 处, 全部在 perceive() 内');
}
const withCollider=BUSH_LIVE.filter(r=>r.cyl||r.box).length;
console.log('  灌木记录带 cyl/box 的株数='+withCollider+' (应为 0 —— 不进 BOXES/CYLS 就不可能被 raycastWorld/raySoldiers 命中)');
// 调用前后碰撞表零改动 (证 foliageBlocksLOS 不写任何命中链状态)
const snap=[PROPS.length,CYLS.length,BOXES.length,FLORA_HASH.size];
for(let i=0;i<5000;i++) los(-150+i%20,heightAt(-150,-150)+1.6,-150,150,heightAt(150,150)+1.4,150);
const same=snap[0]===PROPS.length&&snap[1]===CYLS.length&&snap[2]===BOXES.length&&snap[3]===FLORA_HASH.size;
console.log('  5000 次调用前后: PROPS '+snap[0]+'→'+PROPS.length+'  CYLS '+snap[1]+'→'+CYLS.length+'  BOXES '+snap[2]+'→'+BOXES.length+'  FLORA_HASH '+snap[3]+'→'+FLORA_HASH.size);
if(same) ok('遮蔽查询不增删任何碰撞体/植被表条目 (只读 + rec._fl/_ls 缓存)'); else bad('遮蔽查询改动了碰撞/植被表');
let spot=null;
for(let x=-150;x<=150&&!spot;x+=6)for(let z=-150;z<=150;z+=6){
if(shoreDist(x,z)>-45||roadDist(x,z)<8||!freeSpot(x,z,2)) continue;
const g=heightAt(x,z);
buildSpatialIndex();
const hit=raycastWorld(V3f(x-6,g+1.62,z),V3f(1,0.4,0),12);
if(!hit||hit.dist>11.9){ spot={x,z,g}; break; }
}
if(!spot) info('找不到干净试验点 → 运行期射线检查跳过');
else{
G('bush')(spot.x,spot.z,1.5); G('flushBushes')();
const rec=BUSH_LIVE[BUSH_LIVE.length-1];
buildSpatialIndex();
const hit=raycastWorld(V3f(spot.x-6,spot.g+1.62,spot.z),V3f(1,0.4,0),12);
console.log('  合成灌木 s='+(rec.s||0).toFixed(2)+' @('+spot.x+','+spot.z+')  硬射线 12m: '+(hit?('dist='+hit.dist.toFixed(2)+' kind='+hit.kind):'无命中'));
if(hit&&hit.dist<11.9) bad('硬射线被灌木拦停 (kind='+hit.kind+')'); else ok('raycastWorld 穿过灌木不命中 (子弹可穿)');
const blocked=los(spot.x-6,spot.g+1.62,spot.z, spot.x+6,spot.g+1.40,spot.z);
console.log('  同一视线 foliageBlocksLOS='+blocked+' (应为 true: 软遮蔽照常生效)');
if(!blocked) bad('软遮蔽未生效'); else ok('同一株: 挡视线 / 不挡弹');
}
}

// ── G. 容量/鲁棒性/统计口 ──
let grassAlloc=0, placed=0; // (H 节也要读, 提出来)
console.log('\n【G 容量·鲁棒性·统计口】');
{
console.log('  构建期不变量: BUSH_IM.count='+CAP.count+'  BUSH_LIVE='+CAP.live+' (每株 2 实例)');
if(CAP.count===CAP.live*2) ok('灌木实例批容量 = 记录数×2 (flushBushes 按需分配, 无固定上限/不溢出)');
else bad('灌木实例批容量与记录数不一致: '+CAP.count+' vs '+CAP.live*2);
grassAlloc=BURN_INST[0]?BURN_INST[0].im.count:0;
placed=0; if(BURN_INST[0]) for(const a of BURN_INST[0].byCell.values()) placed+=a.length;
console.log('  草丛: 分配='+grassAlloc+' 落位='+placed+' 落位率='+(placed/grassAlloc*100).toFixed(1)+'%  (grassN='+JSON.stringify(FLORA_CFG.grassN)+' grassMul=1.35 grassTries='+FLORA_CFG.grassTries+')');
// 烧毁 → 遮蔽消失 (先找一株确实在视线带里的)
let done=false;
for(const rec of BUSH_LIVE){
if(rec.dead||!rec.alive) continue;
const g=rec.g0, ax=rec.x-6, ay=heightAt(ax,rec.z)+1.62;
if(!los(ax,ay,rec.z, rec.x,g+1.40,rec.z)) continue;
vanishFlora(rec,false);
const after=los(ax,ay,rec.z, rec.x,g+1.40,rec.z);
console.log('  烧毁复核: 挡视线灌木 @('+rec.x.toFixed(1)+','+rec.z.toFixed(1)+') → vanishFlora 后 dead='+rec.dead+' between='+after);
if(!after) ok('烧毁后遮蔽消失 (dead 早退生效)'); else bad('烧毁后仍遮蔽');
done=true; break;
}
if(!done) info('未找到挡视线的灌木样本 (跳过)');
console.log('  FLORA_LOS_STAT: built='+STAT.built+' cells='+STAT.cells+' refs='+STAT.refs+' calls='+STAT.calls+' tested='+STAT.tested+' blocked='+STAT.blocked+' 平均精算='+(STAT.tested/Math.max(1,STAT.calls)).toFixed(2)+' 株/次');
if(STAT.tested/Math.max(1,STAT.calls)>60) bad('平均精算株数过高 (粗筛失效)'); else ok('粗筛有效: 平均精算 '+(STAT.tested/Math.max(1,STAT.calls)).toFixed(2)+' 株/次 (全图 '+out.length+' 株)');
}

// ── H. 规模/面数/单源缺省 ──
console.log('\n【H 规模·面数·单源缺省】');
{
let meshes=0, insts=0, groups=0;
(function walk(o){ if(!o||!o.children) return; for(const c of o.children){ if(c.count!==undefined) insts++; else if(c.geometry) meshes++; else groups++; walk(c); } })(G('scene'));
const kinds={}; for(const r of out) kinds[r.kind]=(kinds[r.kind]||0)+1;
const tri={
bush:(kinds.bush||0)*2*2,          // 2 片 5×5 叶面 × 2 三角
fern:(kinds.fern||0)*4*2,          // 4 片叶面
tree:(kinds.tree||0)*(3*2+28),     // 3 片叶面 + 7 棱柱干
palm:(kinds.palm||0)*(28+8*12+4*48),
grass:placed*2,                    // 1 片 0.9×0.55
hedge:(kinds.hedge||0)*20, bamboo:(kinds.bamboo||0)*40, dead:(kinds.dead||0)*20,
};
const triAll=Object.keys(tri).reduce((a,k)=>a+tri[k],0);
console.log('  scene 可绘制: Mesh='+meshes+' InstancedMesh='+insts+' Group='+groups);
console.log('  按类: '+Object.keys(kinds).map(k=>k+'='+kinds[k]).join(' '));
console.log('  解析三角面 (审计侧独立估算): 灌木 '+tri.bush+' 蕨丛 '+tri.fern+' 野树 '+tri.tree+' 椰树 '+tri.palm+' 草丛 '+tri.grass+' → 合计 '+triAll);
console.log('  实例批: 灌木 '+(CAP.count||0)+' 实例 (2/株) + 草丛 '+grassAlloc+' 实例 (1/丛) + 树木实例批 '+G('TREE_IM.trunks?1:0'));
console.log('  FLORA_CFG(本主题)='+JSON.stringify(FLORA_CFG));
const isDefault=FLORA_CFG.bushN===150&&FLORA_CFG.shoreGuard===15&&FLORA_CFG.grassN[0]===480&&FLORA_CFG.grassN[1]===1050&&FLORA_CFG.grassN[2]===1850&&FLORA_CFG.grassTries===1&&!FLORA_CFG.groveBushArea;
console.log('  单源缺省核对: '+(isDefault?'= 改造前缺省 (bushN=150 / shoreGuard=15 / grassN=[480,1050,1850] / grassTries=1 / 林下段关闭) ⇒ 本图行为零变化':'本图显式给了 floraDensity (环礁专属密度)'));
console.log('  PROPS(占位表)='+PROPS.length+' (仅布局期 propFree 线性查重; 运行期碰撞走 BOXES/CYLS, 与植被无关)');
}

console.log('\n'+(fails?('✘ 审计发现 '+fails+' 项问题'):'✔ 本次对照未发现问题'));
process.exit(fails?1:0);
