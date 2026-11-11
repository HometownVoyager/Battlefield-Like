// ─────────────────────────────────────────────
// dev/verify-foliage.js —— I5 塔拉瓦植被加密 + 草丛树丛遮蔽视野 沙箱验收 (不进 index.html)
// 用法: node dev/verify-foliage.js              # 正式验收 (全断言, 任一失败 → exit 1)
//       node dev/verify-foliage.js --baseline   # 改造前基线快照 (只统计植被与分布, 遮蔽项标 SKIP)
//
// 用户口径 (2026-09-20 I5, 已确认): 第7条"塔拉瓦环礁的地图上植被还是太少, 应当有不少草丛树丛"
//   + "灌木/树冠挡视野, 但只在命中遮挡时生效、且不挡子弹" (玩家与 Bot 同规则 —— 纲领第 2 条)。
//
// 原理: 用共享桩 dev/_bootstub.js 启动**真实全链脚本** (与 probe-bots/verify-tankai 同一张表,
//   顺序即 index.html 的加载顺序), 于是测的是实机同一份 buildWorld/14-bots, 不是手抄副本。
//   若全链被他人模块的半成品改动打断, 自动退到"核心链" (00-config..05c) 继续跑 ①~④,
//   并把 perceive() 接线降级为**源码断言** (两条都写明在输出里, 不静默跳过)。
//
// 断言分组:
//   ① 植被量: island 战役的 BUSH_LIVE/树木/草丛实例 (+解析面数/draw call 估算), 与 --baseline 对比
//      【基线口径唯一化 (2026-09-20 收尾)】island 改造前 = **灌木 99 株 / tree 46 / palm 265 / 草丛落位 408**。
//      早期报告里出现过的"121"是**另一张图**的数字: 那次是快速冒烟检查, 没覆盖 localStorage.sf_campaign,
//      于是跑了默认的 campaign#0 = normandy (实测 normandy BUSH_LIVE=121, 改造前后一致)。两数都对, 但
//      "121"不属于 island, 后文一律用 99 (本探针 --baseline 印的那一份为唯一口径)。
//   ② 遮蔽几何: "灌木在两点之间→真 / 在旁边→假"; 并与**暴力参考实现**交叉校验 (索引粗筛不漏株)
//   ③ 烧毁即失效: vanishFlora 后遮蔽消失 (rec.dead 生效, 无需重建索引)
//   ④ 性能: 单次调用均值/中位/p95 (10000 次) + 索引构建耗时 + 平均候选株数 (证明有粗筛, 非 O(全图))
//   ⑤ 滩头纪律: 环礁上不存在落在湿沙/迎海面 (shoreDist > -shoreGuard) 的灌木
//   ⑥ 不挡子弹: 全仓库引用检索 —— foliageBlocksLOS 只出现在 04b-fire(定义) 与 14-bots(perceive 一行)
//   ⑦ 接线: perceive() 里植被遮蔽紧跟在 cropBlocksLOS 之后 (全链可用时另跑真实 perceive 功能断言)
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'), path=require('path'), vm=require('vm');
const root=path.resolve(__dirname,'..');
const SEED=42, ISLAND=11;
const BASELINE=process.argv.includes('--baseline');
const {sandbox,document,window}=require('./_bootstub.js');

let failures=0;
const ok=m=>console.log('  ✔ '+m);
const fail=m=>{ console.log('  ✘ '+m); failures++; };
const warn=m=>console.log('  ⚠ '+m);
const skip=m=>console.log('  · SKIP '+m);

// ── 桩补丁: 让实例矩阵可回读 (统计"真正落位"的草丛/灌木实例数与解析面数) ──
// _bootstub 的 Matrix4.compose 是空实现, InstancedMesh.setMatrixAt 不记录 —— 不补就只能读到
// "分配了 count 个" 而读不到 "落位了几个"; 只在本进程内改, 不动共享桩文件。
const T3=sandbox.THREE;
T3.Matrix4.prototype.compose=function(p,q,s){ this.px=p&&p.x; this.py=p&&p.y; this.pz=p&&p.z; this.sc=(s&&s.x!==undefined)?s.x:(s||1); return this; };
// _bootstub 的 Object3D.updateMatrix 是空实现 ⇒ 复用同一个 dummy 的实例化代码读不到落位坐标/缩放。
// 补成 three.js 的真实语义 (把 position/scale 写进 this.matrix), 仅本进程内。
T3.Object3D.prototype.updateMatrix=function(){
  this.matrix=this.matrix||{};
  const p=this.position||{}, s=this.scale||{};
  this.matrix.px=p.x; this.matrix.py=p.y; this.matrix.pz=p.z;
  this.matrix.sc=(s.x!==undefined?s.x:1);
  return this.matrix;
};
// _bootstub 的 InstancedMesh 不吃 (geometry,material) 且 setMatrixAt 不存矩阵 —— 包一层便于统计
// "分配了多少实例 / 真正落位了几个 / 这一批是什么几何"。只在本进程内改, 不动共享桩文件。
{ const IM0=T3.InstancedMesh;
  class IMW extends IM0{
    constructor(g,m,n){ super(g,m,n); this.geometry=g||null; this.material=m||null; this.isInstancedMeshStub=true;
      // 真 three 的 InstancedMesh 有 instanceMatrix.array (每实例 16 个 float); 08-effects.queueSink 直接
      // 读写 arr[i*16+13] (y 分量) —— 桩里没有就会 TypeError。补一个真的 Float32Array。
      this.instanceMatrix=this.instanceMatrix||{array:new Float32Array(Math.max(16,(n||0)*16)),needsUpdate:false}; }
  }
  IMW.prototype.setMatrixAt=function(i,m){
    if(!this.instanceMatrix||!this.instanceMatrix.array) this.instanceMatrix={array:new Float32Array(Math.max(16,(this.count||0)*16)),needsUpdate:false};
    const a=this.instanceMatrix.array;
    if(m){ a[i*16+12]=m.px||0; a[i*16+13]=m.py||0; a[i*16+14]=m.pz||0; }
    (this._mats||(this._mats=[]))[i]={x:m&&m.px,y:m&&m.py,z:m&&m.pz,sc:m?m.sc:1};
  };
  T3.InstancedMesh=IMW; }
// _bootstub 的 PlaneGeometry 不吃构造参数 (parameters 恒为空) —— 包一层记下宽高, 以便按 geo 认出草丛批次
{ const PG=T3.PlaneGeometry;
  const Wrap=function(w,h,sg,sh){ const g=new PG(w,h,sg,sh); g.parameters={width:w,height:h}; return g; };
  Wrap.prototype=PG.prototype; T3.PlaneGeometry=Wrap; }

// 全链加载表 (与 probe-bots.js 完全一致; 15c-specveh/22a/23b 由 typeof 守卫, 探针不载)
const FULL=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/23-deploy.js','js/24-main.js'];
// 核心链 (probe-hukawng 同款): 只到 05c —— 该链不含 14/15/16, 因此不受他人改 AI/载具影响
const CORE=['js/00-config.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js'];

function boot(files){
  const ctx=vm.createContext(Object.assign({},sandbox));
  ctx.document=document; ctx.window=window;
  ctx.localStorage={_s:{sf_campaign:String(ISLAND)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
  ctx.location={search:'?seed='+SEED,reload(){},href:'http://localhost/'};
  // 02-scene 未载时 03-terrain/05-world/05c 需要的全局 (probe-hukawng 同源); 02-scene 载入后会覆盖自己的
  if(!ctx.scene) ctx.scene=new T3.Group();
  ctx.MAT=ctx.MAT||{stone:{},wood:{},woodDark:{},roof:{},plaster:{},brick:{},sandbag:{},hay:{},metal:{},metalDark:{},bark:{},leaves:{},rubble:{},grass:{},earth:{},concrete:{}};
  ctx.TEX=ctx.TEX||{leaves:{}};
  if(!ctx.svgApply) ctx.svgApply=t=>t;
  if(!ctx.makeTex) ctx.makeTex=()=>({});
  if(!ctx.addSnowCap) ctx.addSnowCap=()=>{};
  ctx.wires=ctx.wires||[];
  ctx.camera=ctx.camera||{position:{x:0,y:0,z:0}};
  ctx.player=ctx.player||{alive:true,isPlayer:true,team:0,pos:{x:0,y:0,z:0},damage(){},noticeThreat(){}};
  ctx.AudioSys=ctx.AudioSys||{explosion(){},gunshot(){},click(){},hurt(){}};
  ctx.addTrauma=ctx.addTrauma||(()=>{}); ctx.spawnP=ctx.spawnP||(()=>{}); ctx.PT=ctx.PT||{smoke:1,dark:1,flash:1,blood:1,dirt:1,spark:1};
  ctx.spawnWallDebris=ctx.spawnWallDebris||(()=>{});
  ctx.TAU=Math.PI*2; ctx.HPI=Math.PI/2;
  ctx.V3=(x=0,y=0,z=0)=>new T3.Vector3(x,y,z);
  // 08-effects 的沉入系统 (04b.vanishFlora 运行期调用): 全链里由 08 提供, 核心链用桩
  ctx.queueSink=ctx.queueSink||(job=>job); ctx.updateWreckSinks=ctx.updateWreckSinks||(()=>{}); ctx.finishSinkJob=ctx.finishSinkJob||(()=>{});
  ctx.matchOver=false; ctx.nowT=0;
  const fallback={};
  for(const f of files){
    try{ vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f}); }
    catch(e){ fallback.fail=f; fallback.err=String((e&&e.stack)||e).split('\n').slice(0,3).join(' | '); return {ctx:null,...fallback}; }
  }
  return {ctx,...fallback};
}

// 全链优先 (能测真实 perceive); 被他人半成品改动打断时退核心链
let fullOK=true;
let B=boot(FULL);
if(!B.ctx){
  fullOK=false;
  warn('全链沙箱未启动 (文件 '+B.fail+'): '+B.err);
  warn('→ 退核心链 00-config..05c 继续跑 ①~④; perceive() 接线降级为源码断言 (见 ⑦)');
  B=boot(CORE);
  if(!B.ctx){ console.log('✘ 核心链也无法启动 ('+B.fail+'): '+B.err); process.exit(1); }
}
const ctx=B.ctx;
const G=n=>vm.runInContext(n,ctx);
const campaign=G('CAMPAIGN');
console.log('\n═══ dev/verify-foliage.js ═══');
console.log('战役: ['+G('CAMPAIGN_IDX')+'] '+campaign.id+' / '+campaign.layout+' / theme='+campaign.theme+' / mapSize='+campaign.mapSize+'  seed='+SEED+'  boot='+(fullOK?'全链':'核心链')+(BASELINE?'  [--baseline 基线模式]':''));

const heightAt=G('heightAt'), shoreDist=G('shoreDist'), freeSpot=G('freeSpot'), roadDist=G('roadDist');
const BUSH_LIVE=G('BUSH_LIVE'), TREE_LIVE=G('TREE_LIVE'), FLORA_HASH=G('FLORA_HASH'), BURN_INST=G('BURN_INST');
const vanishFlora=G('vanishFlora'), bushFn=G('bush'), flushBushes=G('flushBushes');
const FLORA_CFG=G('typeof FLORA_CFG!=="undefined"?FLORA_CFG:null');
const los=G('typeof foliageBlocksLOS==="function"?foliageBlocksLOS:null');
const losStat=G('typeof FLORA_LOS_STAT!=="undefined"?FLORA_LOS_STAT:null');
const MAP_SIZE=G('MAP_SIZE');

// ── 全图植被记录一览 (按 kind 统计; 记录本体取自 FLORA_HASH, 与 TREE_LIVE/BUSH_LIVE 是同一批对象) ──
const all=[];
for(const arr of FLORA_HASH.values()) for(const rec of arr) all.push(rec);
const byKind={};
for(const r of all){
  const k=r.kind||'?'; const e=byKind[k]||(byKind[k]={alive:0,dead:0,total:0});
  e.total++; if(r.dead||r.alive===false) e.dead++; else e.alive++;
}
// 解析面数 (桩不建真几何, 按各原语的定义算): 三平面叶=2面/片, 圆柱 7 段=28面, 方盒=12面, 球 6×5=48面
const TRIS={
  grass:2, bushOne:2,                    // PlaneGeometry(0.9,0.55) / PlaneGeometry(5,5) → 各 2 面
  treeOne:28+3*2,                        // 干 CylinderGeometry(r,r,4.4,7)=28 + 3 片叶×2
  palmOne:28+8*12+4*48,                  // 干 + 8 条叶(方盒) + 4 颗椰(球)
  fernOne:4*2, fernMesh:4,               // 4 片叶, 但每片是独立 Mesh = 4 次 draw
  hedgeOne:12+4*2,
};
const grassBatches=BURN_INST.map((b,i)=>({
  i, count:b.im&&b.im.count||0, cells:b.byCell?b.byCell.size:0,
  placed:(b.im&&b.im._mats)?b.im._mats.filter(m=>m&&m.sc>0.01).length:-1,
  geo:(b.im&&b.im.geometry&&b.im.geometry.parameters)?(b.im.geometry.parameters.width+'x'+b.im.geometry.parameters.height):'?',
}));
const bushPlaced=(G('BUSH_IM')&&G('BUSH_IM')._mats)?G('BUSH_IM')._mats.filter(m=>m&&m.sc>0.01).length:-1;
const bushAlloc=G('BUSH_IM')?G('BUSH_IM').count:0;

// 世界 draw call 估算: scene 下的 Mesh/InstancedMesh 递归计数 (实例批记 1 次 draw)
let meshes=0, insts=0;
G('scene').traverse(o=>{ const c=o&&o.constructor&&o.constructor.name;
  if(o&&o.isInstancedMeshStub) insts++; else if(c==='Mesh'||c==='Points'||c==='LineSegments'||c==='Sprite') meshes++; });
const treeN=byKind.tree?byKind.tree.total:0, palmN=byKind.palm?byKind.palm.total:0, fernN=byKind.fern?byKind.fern.total:0, bushN=byKind.bush?byKind.bush.total:0;
const grassPlaced=grassBatches.reduce((a,b)=>a+(b.placed>0?b.placed:0),0);
const grassAlloc=grassBatches.reduce((a,b)=>a+b.count,0);
const triEst=grassPlaced*TRIS.grass + bushN*2*TRIS.bushOne + treeN*TRIS.treeOne + palmN*TRIS.palmOne + fernN*TRIS.fernOne + (byKind.hedge?byKind.hedge.total:0)*TRIS.hedgeOne;
const drawnEst=meshes + fernN*TRIS.fernMesh + insts;

// ── ① 植被量 ──
console.log('\n① 植被量 (FLORA_HASH 全量 / BUSH_LIVE / 草丛实例)');
console.log('   FLORA_HASH 格='+FLORA_HASH.size+'  记录合计='+all.length+'  BUSH_LIVE='+BUSH_LIVE.length+'  TREE_LIVE='+TREE_LIVE.length);
const kindOrder=['tree','palm','fern','bush','hedge','dead','bamboo'];
const kindLine=kindOrder.filter(k=>byKind[k]).map(k=>k+'='+byKind[k].total+'(活'+byKind[k].alive+'/死'+byKind[k].dead+')').join('  ');
console.log('   按类: '+(kindLine||'(空)'));
for(const g of grassBatches) console.log('   草丛实例批#'+g.i+' 分配='+g.count+' 落位='+(g.placed<0?'?':g.placed)+' 燃料格='+g.cells+' geo='+g.geo);
console.log('   灌木实例批 BUSH_IM: 分配='+bushAlloc+' 落位='+(bushPlaced<0?'?':bushPlaced)+' (每株 2 片交叉叶面)');
console.log('   解析三角面合计≈'+triEst.toLocaleString('en-US')+'  世界 Mesh 节点≈'+meshes+'  独立实例批≈'+insts+'  draw 估算≈'+drawnEst.toLocaleString('en-US')+' (蕨丛每丛 4 Mesh)');
if(typeof FLORA_CFG!=='object'||!FLORA_CFG){ fail('FLORA_CFG 未定义 (密度单源缺失)'); }
else console.log('   密度单源 FLORA_CFG(本主题)='+JSON.stringify(FLORA_CFG));
if(BASELINE){
  console.log('   [基线] 改造前快照 —— 遮蔽/纪律/接线断言在基线模式下不下结论');
} else {
  // 改造后的期望: 环礁图必须有成规模的灌木与蕨丛 (改造前 bush=121 全来自通用散布局, fern=0)
  if(bushN<800) fail('环礁灌木太少: bush='+bushN+' (要求 ≥800, 用户第7条"应当有不少草丛树丛")');
  else ok('灌木规模: '+bushN+' 株');
  if(fernN<60) fail('环礁蕨丛太少: fern='+fernN+' (要求 ≥60)');
  else ok('蕨丛规模: '+fernN+' 丛');
  if(grassPlaced<1400) fail('环礁落位草丛太少: '+grassPlaced+' 丛 (要求 ≥1400)');
  else ok('落位草丛: '+grassPlaced+' 丛 (分配 '+grassAlloc+')');
  if(bushN*2*TRIS.bushOne+grassPlaced*TRIS.grass>60000) fail('新增植被面数超预算 (灌木+草丛叶子 >60k 面)');
  else ok('灌木+草丛叶面≈'+(bushN*2*TRIS.bushOne+grassPlaced*TRIS.grass)+' 面 (预算 ≤60000)');
}

// ── ⑤ 滩头纪律: 环礁灌木不许落在湿沙/迎海面 ──
{
  const guard=(typeof FLORA_CFG==='object'&&FLORA_CFG)?FLORA_CFG.shoreGuard:15;
  const bs=all.filter(r=>r.kind==='bush');
  let bad=0, nearest=-1e9, nearRec=null;   // shoreDist 在陆上是负值: 越大 = 越靠近岸线
  for(const r of bs){ const d=shoreDist(r.x,r.z); if(d>nearest){ nearest=d; nearRec=r; } if(d>-guard) bad++; }
  console.log('\n⑤ 滩头纪律 (灌木离岸: shoreDist 越负越靠内陆; 禁入带 = 岸线起 '+guard+'m 迎海面/湿沙)');
  console.log('   灌木 '+bs.length+' 株; 离岸最近的一株 shoreDist='+nearest.toFixed(2)+'m (即入陆 '+(Math.abs(nearest)).toFixed(1)+'m) @('+nearRec.x.toFixed(0)+','+nearRec.z.toFixed(0)+')');
  console.log('   最近一株在禁入带内? '+((nearest>-guard)?'是':'否')+' (要求 否, 即全部落在沙丘背坡及以内)');
  if(BASELINE) skip('滩头纪律断言 (基线模式)');
  else if(bad>0) fail('有 '+bad+' 株灌木落在迎海面禁入带内 (shoreDist > -'+guard+')');
  else ok('全部灌木在沙丘背坡及以内 (无湿沙/迎海面灌木)');
}

// ── ② 遮蔽几何 + 索引 vs 暴力参考实现交叉校验 ──
// 参考实现 (探针自带, 不设索引, 全量扫描): 用于验证生产索引的粗筛不"漏株"
const bandOf=rec=>{
  const s=rec.s||1, g=rec.g0||0;
  switch(rec.kind){
  case 'bush': return {lo:g+0.15*s, hi:g+1.10*s, r2:(1.30*s)*(1.30*s)};
  case 'fern': return {lo:g+0.10, hi:g+0.75, r2:1.0};
  case 'tree': return {lo:g+1.00*s, hi:g+5.40*s, r2:(2.30*s)*(2.30*s)};
  case 'palm': return {lo:(rec.cyl?rec.cyl.y1:g)-1.80, hi:(rec.cyl?rec.cyl.y1:g)+0.30, r2:3.20*3.20};
  default: return null;
  }
};
function bruteBlocks(ax,ay,az,bx,by,bz,hits){
  const dx=bx-ax, dz=bz-az, dy=by-ay, L2=dx*dx+dz*dz;
  if(L2<1e-6) return false;
  let hit=false;
  for(const rec of all){
    if(rec.dead||rec.alive===false||rec.fall) continue;
    const b=bandOf(rec); if(!b) continue;
    const fx=ax-rec.x, fz=az-rec.z;
    const bq=2*(fx*dx+fz*dz), cq=fx*fx+fz*fz-b.r2;
    const disc=bq*bq-4*L2*cq;
    if(disc<0) continue;
    const sq=Math.sqrt(disc);
    let t0=(-bq-sq)/(2*L2), t1=(-bq+sq)/(2*L2);
    if(t0<0) t0=0; if(t1>1) t1=1;
    if(t0>t1) continue;
    const ya=ay+dy*t0, yb=ay+dy*t1;
    const ylo=ya<yb?ya:yb, yhi=ya<yb?yb:ya;
    if(ylo<=b.hi&&yhi>=b.lo){ hit=true; if(!hits) return true; hits.push(rec); }
  }
  return hit;
}

console.log('\n② 遮蔽几何: 灌木在两点之间→真 / 灌木在旁边→假');
let site=null;
if(!los){
  warn('foliageBlocksLOS 尚未实现 → 基线模式 (若为正式验收请先落代码)');
  skip('② 遮蔽几何 / ③ 烧毁失效 / ④ 性能');
} else {
  // 找一块"净地": 陆上内陆 + 空建筑/道路 + 平直两点间与平移 9m 后都无天然植被遮挡 (用暴力参考实现判定)
  const y0=1.25;
  for(let x=-300;x<=300&&!site;x+=6){
    for(let z=-300;z<=300;z+=6){
      if(shoreDist(x,z)>-40) continue;
      if(!freeSpot(x,z,3)) continue;
      if(roadDist(x,z)<8) continue;
      const g=heightAt(x,z);
      const A=[x-6,g+y0,z], Bp=[x+6,g+y0,z];
      const A2=[x-6,g+y0,z+9], B2=[x+6,g+y0,z+9];
      if(bruteBlocks(A[0],A[1],A[2],Bp[0],Bp[1],Bp[2])) continue;
      if(bruteBlocks(A2[0],A2[1],A2[2],B2[0],B2[1],B2[2])) continue;
      site={x,z,g};
    }
  }
  if(!site){ fail('找不到净地做几何场景 (地图植被太密或选择器太严)'); }
  else{
    // 用真实 bush() 造一株 s=1.2 的灌木 (蓬面带 g0+0.18 ~ g0+1.32; 眼高 1.25 落在带内)
    const before=BUSH_LIVE.length;
    bushFn(site.x,site.z,1.2);
    flushBushes();
    const rec=BUSH_LIVE[BUSH_LIVE.length-1];
    all.push(rec);   // 暴力参考实现的数据源同步补上这株 (否则 ② 的两条口径比的不是同一批记录)
    const placedOK=BUSH_LIVE.length===before+1;
    const A=[site.x-6,site.g+y0,site.z], Bp=[site.x+6,site.g+y0,site.z];
    const A2=[site.x-6,site.g+y0,site.z+9], B2=[site.x+6,site.g+y0,site.z+9];
    const g0=rec?rec.g0:site.g, blo=g0+0.15*1.2, bhi=g0+1.10*1.2;
    console.log('   净地 @('+site.x.toFixed(0)+','+site.z.toFixed(0)+') 地面 y='+site.g.toFixed(2)+'  合成灌木 s=1.2 蓬面 y∈['+blo.toFixed(2)+','+bhi.toFixed(2)+'] 眼高 y='+(site.g+y0).toFixed(2));
    if(!placedOK) fail('bush() 未落位 (净地被占?)');
    else ok('合成灌木已落位: BUSH_LIVE '+before+'→'+BUSH_LIVE.length);
    const inBetween=los(A[0],A[1],A[2],Bp[0],Bp[1],Bp[2]);
    const aside=los(A2[0],A2[1],A2[2],B2[0],B2[1],B2[2]);
    const refBetween=bruteBlocks(A[0],A[1],A[2],Bp[0],Bp[1],Bp[2]);
    const refAside=bruteBlocks(A2[0],A2[1],A2[2],B2[0],B2[1],B2[2]);
    console.log('   灌木在两点之间: foliageBlocksLOS='+inBetween+'  暴力参考='+refBetween);
    console.log('   灌木在旁边(平移9m): foliageBlocksLOS='+aside+'  暴力参考='+refAside);
    if(!inBetween) fail('灌木在两点之间却判为不遮挡');
    else ok('灌木在两点之间 → 遮蔽为真');
    if(aside) fail('灌木在旁边 9m 却判为遮挡 (半径过大?)');
    else ok('灌木在旁边 9m → 遮蔽为假');

    // ②b 索引粗筛 vs 暴力参考: 随机 400 对点必须逐对一致 (索引不漏株/不误报)
    let mismatch=0, blocked=0, tested=0;
    const rnd=((s)=>()=>((s=s*1103515245+12345&0x7fffffff)/0x7fffffff))(SEED);
    for(let i=0;i<400;i++){
      const ax=(rnd()*2-1)*(MAP_SIZE/2-20), az=(rnd()*2-1)*(MAP_SIZE/2-20);
      const bx2=ax+(rnd()*2-1)*90, bz2=az+(rnd()*2-1)*90;
      const ay=heightAt(ax,az)+1.5, by=heightAt(bx2,bz2)+1.4;
      const p=los(ax,ay,az,bx2,by,bz2), r=bruteBlocks(ax,ay,az,bx2,by,bz2);
      if(p!==r) mismatch++; if(r) blocked++; tested++;
    }
    console.log('   索引 vs 暴力参考: '+tested+' 对随机点, 判为遮挡 '+blocked+' 对, 不一致 '+mismatch+' 对');
    if(mismatch) fail('索引粗筛与暴力参考不一致 '+mismatch+' 处 (会漏株或误报)');
    else ok('索引查询与暴力参考逐对一致 (粗筛不漏株)');

    // ②c 端点专项 (2026-09-20 审计回归): "B 点落在株心" 必须判遮挡。
    // 为什么单列: 旧实现步进到"视线终点格"后立刻 break ⇒ 终点格从未被扫描, 判定方向不对称,
    // 症状就是**敌人站在灌木丛里反而被看见** (island 实测漏判 164/1752 株)。这里对所有活株做全量断言。
    let epMissA=0, epMissB=0, epRefDiff=0, epTot=0;
    const epSample=[];
    for(const r of BUSH_LIVE){
      if(r.dead||r.alive===false) continue;
      epTot++;
      const mid=r.g0+0.625*(r.s||1);                       // 蓬面主体带 (g0+0.15s ~ g0+1.10s) 的正中
      const ax=r.x-8, az2=r.z, bx3=r.x+8;                  // 8m 外对射, 视线两端同高
      // 方向 1: B = 株心 (敌人站在灌木里) / 方向 2: A = 株心 (观察者站在灌木里)
      const pB=los(ax,mid,az2, r.x,mid,r.z);
      const pA=los(r.x,mid,r.z, bx3,mid,r.z);
      if(!pB){ epMissA++; if(epSample.length<3) epSample.push('B=株心@('+r.x.toFixed(1)+','+r.z.toFixed(1)+') s='+(r.s||1).toFixed(2)); }
      if(!pA) epMissB++;
      // 与暴力参考交叉校验 (覆盖真实眼高: 观察者站姿 1.62 / 目标 1.40, 30m 外)
      const hx=r.x-30, hy=heightAt(hx,r.z)+1.62, ty=r.g0+1.40;
      if(bruteBlocks(hx,hy,r.z, r.x,ty,r.z)!==los(hx,hy,r.z, r.x,ty,r.z)) epRefDiff++;
    }
    console.log('   ②c 端点专项: 活株 '+epTot+' 株 —— "B=株心" 漏判 '+epMissA+' 株, "A=株心" 漏判 '+epMissB+' 株, 与暴力参考不一致 '+epRefDiff+' 株');
    for(const s of epSample) console.log('     漏判样本: '+s);
    if(epMissA) fail('端点漏判: '+epMissA+'/'+epTot+' 株在"敌人站在灌木里"(B=株心)时判为不遮挡');
    else ok('端点场景全部判遮挡 ("敌人站在灌木里" '+epTot+'/'+epTot+')');
    if(epMissB) fail('端点漏判 (方向 2): '+epMissB+'/'+epTot+' 株在"观察者站在灌木里"(A=株心)时判为不遮挡');
    else ok('反向端点场景全部判遮挡 ("观察者站在灌木里" '+epTot+'/'+epTot+')');
    if(epRefDiff) fail('端点场景与暴力参考不一致 '+epRefDiff+' 株');
    else ok('端点场景 (含真实眼高 30m 对射) 与暴力参考逐株一致');

    // ③ 烧毁 (vanishFlora) → 遮蔽消失
    console.log('\n③ 烧毁即失效 (vanishFlora)');
    vanishFlora(rec,false);
    const deadAfter=rec.dead===true;
    const inBetween2=los(A[0],A[1],A[2],Bp[0],Bp[1],Bp[2]);
    const ref2=bruteBlocks(A[0],A[1],A[2],Bp[0],Bp[1],Bp[2]);
    console.log('   rec.dead='+rec.dead+'  烧毁后 between: foliageBlocksLOS='+inBetween2+' 暴力参考='+ref2);
    if(!deadAfter) fail('vanishFlora 未把 rec.dead 置真');
    if(inBetween2) fail('灌木烧毁后仍遮挡视线 (死株未从遮蔽层剔除)');
    else ok('烧毁后遮蔽消失 (同一对点由真变假)');

    // ④ 性能: 10000 次 + 索引/粗筛统计
    console.log('\n④ 性能 (微秒/次)');
    const pairs=[];
    for(let i=0;i<1000;i++){
      const ax=(rnd()*2-1)*260, az=(rnd()*2-1)*260;
      const a=rnd()*Math.PI*2, L=10+rnd()*85;
      pairs.push([ax,heightAt(ax,az)+1.5,az,ax+Math.sin(a)*L,heightAt(ax+Math.sin(a)*L,az+Math.cos(a)*L)+1.4,az+Math.cos(a)*L]);
    }
    for(let i=0;i<200;i++){ const p=pairs[i%pairs.length]; los(p[0],p[1],p[2],p[3],p[4],p[5]); } // 预热
    const t0Stat=losStat?JSON.parse(JSON.stringify(losStat)):null;
    const N=10000, samples=new Float64Array(N);
    // 用 process.hrtime.bigint 在 Node 侧计时 (纳秒精度), 被调函数在沙箱内 —— 跨 context 调用开销一致
    for(let i=0;i<N;i++){
      const p=pairs[i%pairs.length];
      const t0=process.hrtime.bigint();
      los(p[0],p[1],p[2],p[3],p[4],p[5]);
      samples[i]=Number(process.hrtime.bigint()-t0)/1000;
    }
    const sorted=Float64Array.from(samples).sort();
    const mean=sorted.reduce((a,b)=>a+b,0)/N;
    const pct=q=>sorted[Math.min(N-1,Math.floor(q*N))];
    console.log('   10000 次 (随机 10~95m 视线): 均值='+mean.toFixed(2)+'µs  中位='+pct(0.5).toFixed(2)+'µs  p95='+pct(0.95).toFixed(2)+'µs  p99='+pct(0.99).toFixed(2)+'µs  最大='+sorted[N-1].toFixed(1)+'µs');
    // 稳态最大值: 首轮里混着 JIT/GC 毛刺, 再跑 2000 次单独取 max, 避免用单次毛刺代表"最坏"
    let steadyMax=0;
    for(let i=0;i<2000;i++){
      const p=pairs[i%pairs.length];
      const t0=process.hrtime.bigint();
      los(p[0],p[1],p[2],p[3],p[4],p[5]);
      const us=Number(process.hrtime.bigint()-t0)/1000;
      if(us>steadyMax) steadyMax=us;
    }
    console.log('   稳态 2000 次最大='+steadyMax.toFixed(2)+'µs (上面 10000 次的 最大 值含首个调用的 JIT/GC 毛刺)');
    // 最长视线 (95m 横穿最密椰林) 的最坏情况
    let worst=null;
    for(let i=0;i<3000;i++){
      const ax=(rnd()*2-1)*280, az=(rnd()*2-1)*280;
      const a=rnd()*Math.PI*2, L=95;
      const bx2=ax+Math.sin(a)*L, bz2=az+Math.cos(a)*L;
      let n=0; bruteBlocks(ax,heightAt(ax,az)+1.5,az,bx2,heightAt(bx2,bz2)+1.4,bz2,[])&&0;
      const hits=[]; bruteBlocks(ax,heightAt(ax,az)+1.5,az,bx2,heightAt(bx2,bz2)+1.4,bz2,hits); n=hits.length;
      if(!worst||n>worst.n) worst={n,ax,az,bx2,bz2};
    }
    let worstUs=0;
    for(let i=0;i<300;i++){
      const t0=process.hrtime.bigint();
      los(worst.ax,heightAt(worst.ax,worst.az)+1.5,worst.az,worst.bx2,heightAt(worst.bx2,worst.bz2)+1.4,worst.bz2);
      worstUs+=Number(process.hrtime.bigint()-t0)/1000;
    }
    console.log('   最坏样本 (95m 视线穿 '+worst.n+' 株蓬面): 均值='+(worstUs/300).toFixed(2)+'µs');
    if(losStat){
      console.log('   索引: 构建='+losStat.ms.toFixed(1)+'ms  格数='+losStat.cells+'  引用数='+losStat.refs+' (平均 '+(losStat.refs/Math.max(1,losStat.cells)).toFixed(2)+' 株/格)');
      const d=losStat.tested-(t0Stat?t0Stat.tested:0), c=losStat.calls-(t0Stat?t0Stat.calls:0);
      console.log('   粗筛有效性: 10000 次共测试候选 '+d+' 株 (平均 '+(d/N).toFixed(2)+' 株/次), 全图植被 '+all.length+' 株 → 缩减 '+(all.length/Math.max(0.01,d/N)).toFixed(1)+'×');
      if(d/N>60) fail('平均候选株数 '+(d/N).toFixed(1)+' 过高 (粗筛失效, 近似全量扫描)');
      else ok('粗筛生效: 平均每查只精算 '+(d/N).toFixed(2)+' 株 (全图 '+all.length+')');
    }
    if(mean>25) fail('单次均值 '+mean.toFixed(2)+'µs 超预算 (要求 ≤25µs)');
    else ok('单次均值 '+mean.toFixed(2)+'µs ≤ 25µs 预算');
  }
}

// ── ⑥ 不挡子弹: 全仓库引用检索 ──
// 判据 = **引用所在的函数体**, 不是文件名 (照搬独立审计者 dev/_audit-foliage-ref.js 【F0】)。
// 为什么升级: 15-vehicles.js 里既住着 vehHitCyl (弹道/命中) 也住着 tankPerceive (AI 感知层),
// 按文件名判会把 tank-ai 在 tankPerceive 里的**正确**接入误报成"接进弹道链"。
console.log('\n⑥ 不挡子弹 (判据 = 引用所在函数体, 不是文件名)');
{
  const KW=/^(if|for|while|switch|catch|return|typeof|else|do|const|let|var)\b/;
  const enclosing=(lines,i)=>{   // 从引用行向上找最近的函数头 (支持 `name(...){` 与 `function name`)
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
  console.log('   全仓库引用 (文件:行 [所在函数]):');
  for(const r of refs) console.log('     '+r.f+':'+r.line+'  ['+r.fn+']');
  const BALLISTIC=['raySoldiers','raycastWorld','fireBullet','vehHitCyl','rayCyl','updateShells','splashDamage'];
  const inBallistic=refs.filter(r=>BALLISTIC.includes(r.fn));
  if(inBallistic.length) fail('遮蔽函数出现在弹道/命中函数体内: '+inBallistic.map(r=>r.f+':'+r.line+'['+r.fn+']').join(',')+' (违反"不挡子弹")');
  else ok('没有任何引用落在弹道/命中函数体内 ('+BALLISTIC.join('/')+')');
  const bots=refs.filter(r=>r.f==='14-bots.js');
  if(!BASELINE&&!refs.some(r=>r.f==='04b-fire.js'&&r.fn==='foliageBlocksLOS')) fail('04b-fire.js 未定义 foliageBlocksLOS');
  if(BASELINE) skip('14-bots 接线断言 (基线模式)');
  // ★2026-11-03 判据跟码修钉 (一.89 遗留): 一.89 的 perceive 当前目标优先复核在 perceive() 内**合法地**
  //   加了第二处 foliageBlocksLOS 调用 (循环外复核 + 循环内粗筛, 同一函数同一语义) —— 护栏本意是
  //   "引用只许落在感知层、不许进弹道函数体" (上一条断言), "恰好 1 处"只是当年实现细节。改为:
  //   数量 ≥1 且**全部**在 perceive() 内。
  else if(bots.length<1) fail('14-bots.js 引用数=0 (perceive 内至少应有植被遮蔽粗筛)');
  else if(bots.some(r=>r.fn!=='perceive')) fail('14-bots.js 的调用不全在 perceive() 内 (实际 ['+bots.map(r=>r.fn).join('/')+'])');
  else ok('14-bots.js 共 '+bots.length+' 处, 全部在 perceive() 内 (循环外复核+循环内粗筛)');
}

// ── ⑦ 接线: perceive() 里紧随 cropBlocksLOS ──
console.log('\n⑦ 接线位置 (perceive 内 与 smoke/crop 并列)');
{
  const src=fs.readFileSync(path.join(root,'js','14-bots.js'),'utf8');
  const iCrop=src.indexOf('cropBlocksLOS(eye.x');
  const iFol=src.indexOf('foliageBlocksLOS(eye.x');
  console.log('   crop 网关 @偏移 '+iCrop+' / foliage 网关 @偏移 '+iFol);
  if(BASELINE) skip('接线断言 (基线模式)');
  else if(iFol<0) fail('perceive() 内找不到 foliageBlocksLOS(eye.x, ...) 网关');
  else if(iFol<iCrop) fail('植被网关出现在庄稼网关之前 (应紧随其后, 保证与既有遮蔽同一套语义)');
  else ok('植被网关紧随 cropBlocksLOS 之后, 与 smoke/crop 同排 (continue 语义)');
}

// ── ⑦b 全链可用时的真实 perceive 功能断言 (最强证据: 端到端) ──
if(fullOK&&!BASELINE&&los){
  console.log('\n⑦b 真实 perceive() 功能断言 (全链沙箱)');
  try{
    const start=G('(()=>{const b=document.getElementById("startBtn"); if(b&&b.onclick){b.onclick(); return true;} return false;})()');
    if(!start){ warn('无法开局 (startBtn 未绑定 onclick) → 跳过功能断言'); }
    else{
      const bots=G('soldiers.filter(s=>s.isBot!==false&&s.alive)');
      const bot=bots.find(b=>b&&b.perceive&&b.pos&&b.eyePos);
      if(!bot) warn('开局后没有可用 Bot → 跳过功能断言');
      else{
        // 受控场景: 只留"测试 Bot + 测试敌兵"两个战斗员, 放在地表平坦的通视点上
        const A={x:0,z:0};
        let found=null;
        for(let x=-300;x<=300&&!found;x+=6)for(let z=-300;z<=300;z+=6){
          if(shoreDist(x,z)>-45||!freeSpot(x,z,3)||roadDist(x,z)<8) continue;
          const g=heightAt(x,z), bx2=x+30, g2=heightAt(bx2,z);
          if(Math.abs(g2-g)>1.2) continue;
          const ax=x, az=z, by=g+1.5;
          const st=[]; bruteBlocks(ax,by,az,bx2,g2+1.4,z,st);
          if(st.length) continue;
          const dirx=bx2-ax, dirz=0, L=30;
          const hit=G('raycastWorld')(new T3.Vector3(ax,by,az),new T3.Vector3(1,0,0),L);
          if(hit&&hit.dist<L-0.8) continue;
          if(G('occBlocked')(ax,az)||G('occBlocked')(bx2,z)) continue;
          found={ax,az,bx2,bz:z,g,g2,by}; break;
        }
        if(!found) warn('找不到 30m 通视的平坦试验段 → 跳过功能断言');
        else{
          const savedSoldiers=G('soldiers').slice(), savedCombatants=G('combatants').slice();
          const enemy=bots.find(b=>b!==bot)||savedSoldiers.find(s=>s!==bot);
          G('soldiers').length=0; G('combatants').length=0;
          bot.team=0; bot.alive=true; bot.onVehicle=false; bot.spectator=false; bot.crouch=false;
          bot.pos.x=found.ax; bot.pos.z=found.az; bot.pos.y=found.g;
          bot.yaw=Math.atan2(found.bx2-found.ax,0); bot.target=null; bot.lastSeenT=-999;
          enemy.team=1; enemy.alive=true; enemy.onVehicle=false; enemy.spectator=false; enemy.crouch=false; enemy.isPlayer=false;
          enemy.pos.x=found.bx2; enemy.pos.z=found.bz; enemy.pos.y=found.g2; enemy.lastFiredT=0;
          G('combatants').push(bot,enemy); // 敌兵压进战斗员表 (combatants 只作索敌池)
          bot.perceive();
          const seenBaseline=bot.target===enemy;
          // 两眼中点插一株灌木 → 期望看不见
          const mx=(found.ax+found.bx2)/2, mz=found.bz;
          const b0=BUSH_LIVE.length;
          bushFn(mx,mz,1.35); flushBushes();
          const bushRec=BUSH_LIVE[BUSH_LIVE.length-1];
          all.push(bushRec);   // 暴力参考同步 (⑦b 只作证据打印, 但口径要与生产实现一致)
          const blockers=[]; bruteBlocks(found.ax,found.by,found.az,found.bx2,found.g2+1.4,found.bz,blockers);
          const blocksNow=los(found.ax,found.by,found.az,found.bx2,found.g2+1.4,found.bz);
          bot.target=null; bot.lastSeenT=-999; bot.perceive();
          const seenAfterBush=bot.target===enemy;
          vanishFlora(bushRec,false);
          bot.target=null; bot.lastSeenT=-999; bot.perceive();
          const seenAfterBurn=bot.target===enemy;
          console.log('   场景: bot@('+found.ax.toFixed(0)+','+found.az.toFixed(0)+') → 敌兵 30m 外, 中插灌木 s=1.35');
          console.log('   无灌木 perceive().target=敌兵? '+seenBaseline+'   插灌木后? '+seenAfterBush+'   烧毁后? '+seenAfterBurn);
          console.log('   同一视线 foliageBlocksLOS: 插灌木='+blocksNow+' 拦路株='+blockers.map(r=>r.kind).join(',')+'  BUSH_LIVE '+b0+'→'+BUSH_LIVE.length);
          if(!seenBaseline) warn('对照组未索敌成功 (地形/朝向原因) → 功能断言不成立, 只作参考');
          else if(seenAfterBush) fail('perceive(): 中间隔着活灌木仍锁定敌兵 (植被遮蔽未生效)');
          else if(!seenAfterBurn) fail('perceive(): 灌木烧毁后仍看不见敌兵 (遮蔽未随 rec.dead 解除)');
          else ok('perceive() 端到端: 通视锁定 → 隔灌木丢失 → 烧毁后重新锁定');
          G('soldiers').length=0; for(const s of savedSoldiers) G('soldiers').push(s);
          G('combatants').length=0; for(const c of savedCombatants) G('combatants').push(c);
        }
      }
    }
  }catch(e){ fail('功能断言异常: '+String((e&&e.stack)||e).split('\n').slice(0,3).join(' | ')); }
}

console.log(failures?('\n✘ '+failures+' 项未通过'):'\n全部通过 ✔');
process.exit(failures?1:0);
