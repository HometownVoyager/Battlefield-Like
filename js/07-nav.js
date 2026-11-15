// ─────────────────────────────────────────────
// 07-nav.js —— Bot寻路A*
// 源: Index.original.html 第 2502-2637 行
// ─────────────────────────────────────────────
'use strict';
const NAV = (()=> {
const SP=5, N=Math.floor(MAP_SIZE/SP)+1, OFF=MAP_SIZE/2, NN=N*N;
const open=new Uint8Array(NN);
// 边通行预计算: 相邻格心连线逐 0.9m 采样 occBlocked。
// 根因修复: 旧版只看格心 —— 0.8m 薄墙(沙袋墙/矮墙)夹在两格心之间时两端格子都"开放",
// A* 直接穿墙给出不可达路标, bot 对墙磨到天荒地老 (推进怼墙/主基地横移的总根源)。
const eH=new Uint8Array(NN), eV=new Uint8Array(NN), eD1=new Uint8Array(NN), eD2=new Uint8Array(NN);
const idx=(i,j)=>j*N+i;
const toW=(i,j)=>[i*SP-OFF, j*SP-OFF];
const toG=(x,z)=>[clamp(Math.round((x+OFF)/SP),0,N-1), clamp(Math.round((z+OFF)/SP),0,N-1)];
// ── 判据的"同一条走廊"补强 (★2026-09-26 修, P0-3 强点死袋) ──────────────────────────
// 旧判据是**唯一一条线**: 格开放 = 格心不阻挡; 边通行 = 两格心连线逐 0.9m 采样全空。
// 该判据对"薄墙夹在两格心之间"是对症的 (上面那条根因修复), 但它同时把**一件小道具**读成整格封锁:
//   5m 格的格心只落在离关键点 ≤3.5m 处 (格心是 5m 栅格点), 而强点/旗点的沙袋枪位/弹药箱/弹药库
//   恰在 1.5~4.5m 处布置 ⇒ 一个 0.8m 箱子落在栅格点上就把该格判死, 4 条边也全从这格心出发 ⇒ 整格封锁。
// 沙箱实测 (dev/_steppe-pocket-probe.js): 草原遭遇 7 个强点里每次换局有 1~3 个被判成 1~5 格死袋
//   (风车磨坊/北原哨/麦田农庄/装甲坟场, 随布景随机换人), 落进去的兵对任何目标 findPath 恒 null。
// 现判据: **同一条 + 并行的两条** —— 中线不通时, 再试沿垂直方向 ±NAV_EDGE_PAD 的两条平行线 (端点也采样);
//   格开放同理放宽为"格心空 或 四象限采样点里 ≥3 个空"(格心有 0.8m 杂物但格内有 3m 走廊)。
// 为什么不是"更宽松"而是"更准": 判定问的本来就是"两格之间能不能走过去" —— 3m 宽的走廊本就走得过去,
//   而横跨走廊的墙/树篱照样同时挡住三条线 (对照见 dev/verify-nav-20260926 ⑥: 合成 1m 厚长墙必须被拒,
//   合成 1m 点状柱必须"中线不过、平行线过" —— 判据既不放墙, 也不因一件小道具封掉整格)。
const NAV_EDGE_PAD=1.5;   // 并行线偏移 (m): ±1.5 ⇒ 走廊净宽 3m 即可通行 (士兵直径 ~0.6m 的 5 倍余量)
const NAV_OPEN_Q=1.25;    // 象限采样点偏移 (m): 0 < Q < SP/2 (采样点留在本格内)
// 单线采样 (中线/并行线共用): 全程逐 0.9m 采样, 任一点阻挡即不通
const lineOK=(x1,z1,x2,z2)=>{
const d=Math.hypot(x2-x1,z2-z1), steps=Math.max(1,Math.ceil(d/0.9));
for(let s=0;s<=steps;s++){
const t=s/steps;
if(occBlocked(x1+(x2-x1)*t, z1+(z2-z1)*t)) return false;
}
return true;
};
const edgeOK=(x1,z1,x2,z2)=>{
if(lineOK(x1,z1,x2,z2)) return 1;
// 中线不通 → 试沿垂直方向 ±NAV_EDGE_PAD 的两条并行线 (长度与端点都跟着平移)
const dx=x2-x1, dz=z2-z1, len=Math.hypot(dx,dz)||1;
const px=-dz/len*NAV_EDGE_PAD, pz=dx/len*NAV_EDGE_PAD;
if(lineOK(x1+px,z1+pz,x2+px,z2+pz)) return 1;
if(lineOK(x1-px,z1-pz,x2-px,z2-pz)) return 1;
return 0;
};
function bakeGrid(){
// 格开放 = 格心空 或 四象限采样点中 ≥3 个空 (格心被一件 0.8m 杂物占了, 但格内有 3m 走廊 ⇒ 仍算开放)
for(let j=0;j<N;j++)for(let i=0;i<N;i++){
const [x,z]=toW(i,j);
if(!occBlocked(x,z)){ open[idx(i,j)]=1; continue; }
let q=0;
if(!occBlocked(x+NAV_OPEN_Q,z+NAV_OPEN_Q)) q++;
if(!occBlocked(x+NAV_OPEN_Q,z-NAV_OPEN_Q)) q++;
if(!occBlocked(x-NAV_OPEN_Q,z+NAV_OPEN_Q)) q++;
if(!occBlocked(x-NAV_OPEN_Q,z-NAV_OPEN_Q)) q++;
open[idx(i,j)]=q>=3?1:0;
}
for(let j=0;j<N;j++)for(let i=0;i<N;i++){
const [x,z]=toW(i,j);
if(i<N-1){ const p2=toW(i+1,j); eH[idx(i,j)]=(open[idx(i,j)]&&open[idx(i+1,j)])?edgeOK(x,z,p2[0],p2[1]):0; }
if(j<N-1){ const p2=toW(i,j+1); eV[idx(i,j)]=(open[idx(i,j)]&&open[idx(i,j+1)])?edgeOK(x,z,p2[0],p2[1]):0; }
if(i<N-1&&j<N-1){ const p2=toW(i+1,j+1); eD1[idx(i,j)]=edgeOK(x,z,p2[0],p2[1]); eD2[idx(i,j)]=edgeOK(p2[0],z,x,p2[1]); }
}
}
// ── 连通分量标记 (2026-09-19 Bot 机制翻新) ──
// 目的: 把"目标根本不可达"的搜索从"烧满 9 万次扩展"降成 O(1) 判定。
// 旧版长距离寻路失败要跑满 guard 才返回 null —— 实测 normandy base→图心 11.8k 次/次、
// hukawng 同向 90k 次/次 (≈10ms/次), 3000 次/分钟的失败重试就是持续掉帧的根源。
// comp[] = 每个开放格的连通分量号; csize[] = 该分量的格数 (二分搜索预算的上界)。
// 8 邻域 + 同一套边通行表 —— 与 A* 的可达性定义严格一致, 不会把可达目标误判为不可达。
const comp=new Int32Array(NN), csize=[0];
// ── 单分量 8 邻域 BFS (2026-09-26 性能批: 由 bakeComponents 抽出, 增量重标共用同一段) ──
// 可达性定义在全库只有这一份 (8 邻域 + 同一套边表, 与 A* 的扩展判据严格一致);
// 全量重烘焙与"只重标被波及分量"两条路必须读同一份实现, 各写一遍迟早漂移。
const _bfsStk=[];
function bfsFill(seed,cid){
comp[seed]=cid;
let cnt=0;
_bfsStk.length=0; _bfsStk.push(seed);
while(_bfsStk.length){
const c=_bfsStk.pop(); cnt++;
const ci=c%N, cj=(c/N)|0;
for(let d=0;d<8;d++){
const ni=ci+DI[d], nj=cj+DJ[d];
if(ni<0||nj<0||ni>=N||nj>=N) continue;
const nIdx=nj*N+ni;
if(!open[nIdx]||comp[nIdx]>=0) continue;
if(d===0){ if(!eH[idx(ci,cj)]) continue; }
else if(d===1){ if(!eH[idx(ni,cj)]) continue; }
else if(d===2){ if(!eV[idx(ci,cj)]) continue; }
else if(d===3){ if(!eV[idx(ci,nj)]) continue; }
else if(d>=4){
if(d===4||d===7){ if(!(d===4?eD1[idx(ci,cj)]:eD1[idx(ni,nj)])) continue; }
else { if(!(d===5?eD2[idx(ci,nj)]:eD2[idx(ni,cj)])) continue; }
if(!open[idx(ci+DI[d],cj)]||!open[idx(ci,cj+DJ[d])]) continue;
}
comp[nIdx]=cid; _bfsStk.push(nIdx);
}
}
return cnt;
}
function bakeComponents(){
comp.fill(-1); csize.length=0; compFreeList.length=0;
let cid=0;
for(let s=0;s<NN;s++){
if(!open[s]||comp[s]>=0) continue;
csize[cid]=bfsFill(s,cid); cid++;
}
compNext=cid;
}
// bakeGrid 在模块加载期就会跑一次, 而 bakeComponents 依赖下面的 DI/DJ/DC (const, 有 TDZ) ——
// 故两者分开: bakeGrid() 就地执行, bakeComponents() 在 DI/DJ/DC 声明之后补跑一次。
bakeGrid();function lineClear(x1,z1,x2,z2){
const d=Math.hypot(x2-x1,z2-z1), steps=Math.ceil(d/0.9);
for(let s=1;s<steps;s++){
const t=s/steps;
if(occBlocked(x1+(x2-x1)*t, z1+(z2-z1)*t)) return false;
}
return true;
}
// ══════════════════════════════════════════════════════════════════════════════
// 增量重烘焙 (2026-09-26 性能批): 只重算"改动所波及的格/边/分量"
// ── 旧状 ──
// 每次 NAV.refresh 全图重做: 129² 格 × (格心 1 次 + 4 条边各 ~7 次 0.9m 采样) ≈ 52 万次 occBlocked
// + 全图 8 邻域连通分量。实测 640 图 128~143ms / 320 图 21~36ms。
// 而触发源清一色是**局部**事件: 烧一格火 / 塌一堵墙 / 碾一段铁丝网 / 造一件工事 / 连杀奖励落件。
// 更糟的是它们**反复触发** (火焰蔓延期每 5s 一次 fireNavT, 见 04b-fire) —— 1.2 秒的整图重烘焙
// 在胡康/塔拉卡/断崖这种大图上就是"每隔几秒定帧一次"。
// ── 今状 ──
// 改动集由 OCC 侧给出 (03-terrain occDiffRect 逐格差分 + occTouch 补记直接写), 这里按脏矩形局部重建。
// 影响半径推导 (为什么外扩这么多格, 是充分性论证不是估计):
//   · 一条边 = 相邻两格心的连线 (SP=5m), 判定靠线上每 0.9m 一次 occBlocked —— 格心本身开放、
//     而两格之间的 1m 占用格被填上时 open 不变、边却要翻面 ⇒ 边的重算范围必须比"脏格"外扩 1 格。
//   · open 的重算范围要比"边的范围"再外扩 1 格 (边判定要读两端格的 open)。
//   · 分量: 一条边翻面就能让连通性变化, 所以种子取"边范围内所有开放格", 再对被波及的分量整体重标。
// 等价性: 超集范围只是多算几格 (幂等, 结果与全量逐格相同); 分量编号可能不同 —— 编号不参与任何语义
// (只做"相等性比较"与 csize 查表), 划分与全量重烘焙严格一致 (同一套 bfsFill)。
// 兜底: 脏矩形过大 (散落多处/整图) 或还没有过一次全量烘焙时, 直接走全量 ——
// 增量赢的是局部性, 不具局部性时不假装有 (阈值见 REBAKE_FULL_FRAC)。
let baked=false, compNext=0;
const compFreeList=[];
const allocCompId=()=>(compFreeList.length>0?compFreeList.pop():compNext++);
const _seedList=[], _idList=[];
const REBAKE_FULL_FRAC=0.04; // 脏格数 > NN×此值 ⇒ 全量
const _navRects=[]; // 簇级增量 (2026-11-11): 脏矩形簇换算成 NAV 格坐标的复用槽 (refresh 内装载, 簇数≤登记端 CAP)
function fullBakeGrid(){ bakeGrid(); bakeComponents(); baked=true; }
// 被波及的连通分量重标 (清空 → 同一套 BFS 重跑); 范围同"边表重算范围" [i0..i1]×[j0..j1] (闭区间)
function relabelRegion(i0,j0,i1,j1){
const ids=_idList; ids.length=0;
for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
const k=idx(i,j); if(!open[k]) continue;
const g=comp[k]; if(g<0) continue;
let has=false;
for(let q=0;q<ids.length;q++) if(ids[q]===g){ has=true; break; }
if(!has) ids.push(g);
}
const seeds=_seedList; seeds.length=0;
if(ids.length){
// 清空这些分量的全部格 (全图扫一遍 Int32 ≈ 0.05ms), 同时收下待重标的格, 并回收分量 ID
for(let q=0;q<ids.length;q++){
const oldId=ids[q];
csize[oldId]=0;
compFreeList.push(oldId);
}
for(let k=0;k<NN;k++){
const g=comp[k];
if(g<0) continue;
for(let q=0;q<ids.length;q++) if(ids[q]===g){ comp[k]=-1; seeds.push(k); break; }
}
}
// ① 先重标"改动前就存在的分量": 新开格会被 BFS 自然并入 (合并语义), 顺序不能反
const n=seeds.length;
for(let s=0;s<n;s++){
const sd=seeds[s];
if(comp[sd]>=0) continue;
const nid=allocCompId();
csize[nid]=bfsFill(sd,nid);
}
// ② 再收"改动后新出现、且没被任何老分量并走"的开放格 (例如墙炸开露出一间密闭房: 自成新分量)
for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
const k=idx(i,j);
if(open[k]&&comp[k]<0){ const nid=allocCompId(); csize[nid]=bfsFill(k,nid); }
}
}
// 局部重建 (i0..i1 / j0..j1 为"脏范围"的 NAV 格坐标, 闭区间)
function bakeRegion(i0,j0,i1,j1){
	// ① 格心开放度: 脏范围外扩 2
	const oi0=clamp(i0-2,0,N-1), oi1=clamp(i1+2,0,N-1);
	const oj0=clamp(j0-2,0,N-1), oj1=clamp(j1+2,0,N-1);
	for(let j=oj0;j<=oj1;j++)for(let i=oi0;i<=oi1;i++) open[idx(i,j)]=occBlocked(i*SP-OFF,j*SP-OFF)?0:1;
	// ①b 新变封锁的格必须把分量号抹回 -1 (全量重烘焙靠 comp.fill(-1) 天然成立; 增量只重标"被波及的分量",
	//     不清理封锁格的旧号 ⇒ 表里会留下"封锁格带着某个分量号"的残值。下游读法虽都先判 open
	//     (spawnSpotOk 先查 open, findPath 的剪枝只是保守判断), 但表本身的语义是"comp≥0 ⟺ 开放格" ——
	//     残值会让探针/调试层把封锁格读成可达, 也违背不变量。这里就地抹平, 代价 O(范围)。
	for(let j=oj0;j<=oj1;j++)for(let i=oi0;i<=oi1;i++){ const k=idx(i,j); if(!open[k]) comp[k]=-1; }
// ② 边表: 脏范围外扩 1 的全部格, 四张表整套重算 (与这些格相关的 8 条边全在其中)
const ei0=clamp(i0-1,0,N-1), ei1=clamp(i1+1,0,N-1);
const ej0=clamp(j0-1,0,N-1), ej1=clamp(j1+1,0,N-1);
for(let j=ej0;j<=ej1;j++)for(let i=ei0;i<=ei1;i++){
const x=i*SP-OFF, z=j*SP-OFF;
if(i<N-1){ const q=toW(i+1,j); eH[idx(i,j)]=(open[idx(i,j)]&&open[idx(i+1,j)])?edgeOK(x,z,q[0],q[1]):0; }
if(j<N-1){ const q=toW(i,j+1); eV[idx(i,j)]=(open[idx(i,j)]&&open[idx(i,j+1)])?edgeOK(x,z,q[0],q[1]):0; }
if(i<N-1&&j<N-1){ const q=toW(i+1,j+1); eD1[idx(i,j)]=edgeOK(x,z,q[0],q[1]); eD2[idx(i,j)]=edgeOK(q[0],z,x,q[1]); }
}
// ③ 分量: 只重标被波及的
relabelRegion(ei0,ej0,ei1,ej1);
}
// ── 搜索状态 (双向 A*) ──
// 2026-09-19 Bot 机制翻新 (P0「A* 长距离寻路失败 → 站桩」):
// 旧版单向 A* 的节点扩展硬上限 guard=22000, 而 640m 大图跨图真需要 22000~58541 个
// (沙箱实测 hukawng base0→base1: 需 58541 次扩展才找到目标, 旧上限 22000 直接判 null;
//  steppe 同规模图 88% 的寻路调用返回 null) —— 命中后 14-bots 的 advance/defend/hunt
// 分支「无路可走就不动」, bot 原地站 4~6s 等下次重寻路, 观感即"卡在房子/房子之间"。
// 现改为**双向 A***: 起点与终点同时扩展, 两棵搜索树相遇即收敛 —— 同一 hukawng 用例
// (base0→base1, 需绕北岸走一大圈) 实测 58541 → 15289 次, 且不再有"扩展上限打满"的假失败。
// 配套三层保底: ①连通分量预检 (不同分量直接 O(1) 判不可达, 见 bakeComponents)
// ②二分搜索预算 (nodeCap = 两侧分量格数之和) ③软上限 SEARCH_NODES 兜极端图。
// 平局判定与旧版一致 (f 相同时先后进堆者先出), 因此 f 值严格更优的路径仍被优先展开。
const gScore=new Float32Array(NN), came=new Int32Array(NN), visitGen=new Int32Array(NN);
// 反向搜索独立一套 g/父指针/访问代 (与正向共享堆, 堆条目多带一维方向)
const gScoreB=new Float32Array(NN), cameB=new Int32Array(NN), visitGenB=new Int32Array(NN);
// 双向 A* 的共享堆: **索引式二叉最小堆 (decrease-key)** —— 每个 (格, 方向) 在堆里最多一项。
// ★2026-09-26 修 (与上面 gen 那条同批, 探针实测): 旧版是"惰性删除 + 重复入堆 + NN*4 容量", 两个后果:
//   ① 同一格被"更优 g"改进后重推 ⇒ 堆里同格留多份, 弹出数远大于落定数 (实测胡康河谷 90000 弹出只落定 4388);
//   ② 容量 NN*4=66564 不够 (上界是 8 条入边 × 2 方向 = NN*16), 而 **TypedArray 越界写是静默丢弃、不抛异常** ——
//      堆随即读到上一轮的残值: 弹出垃圾节点、两棵树永不收敛, 同分量长距离查询 (基地→图心 / 旗点→基地1) 恒返回 null。
//      抬上限到 1000 万也只是把 90000 次空转变成 1000 万次 (落定仅 4674) —— 病根是堆溢出, 不是预算。
//   索引式堆: 容量 2*NN 就够 (每格每方向一项), 弹出数 == 落定数, 改进改为原地降键 (heapPos O(1) 定位)。
const heapPos=new Int32Array(NN*2), heapIdx=new Int32Array(NN*2), heapKey=new Float32Array(NN*2), heapDir=new Int8Array(NN*2);
heapPos.fill(-1);
const _heapTouched=[], meetCandidates=[];
// ★2026-09-26 修 (P0, 探针实测复现): 访问代必须**每次调用占两格** (gen=入堆 / gen+1=落定)。
// 旧版每次只 gen++, 于是第 N+1 次调用的"入堆代"正好等于第 N 次调用的"落定代" ——
// 上一轮已落定的格子在新一轮里被当成"已入堆未落定": expand() 里 `v!==gen` 不成立 ⇒ 只在 g 更优时才重推,
// 通常直接跳过 ⇒ 新搜索少了一整片可扩展空间 (实测: 同一 (起点,终点) 连跑六次, 弹出数 30604/2/30604/2… 交替,
// 且每次都返回 null); 更糟的是 :247 的兜底扫描 (接受 gen|gen+1) 会把上一轮的残留格子当成会合点,
// 顺着陈旧的 came 链回溯出一条与本查询无关的路 —— findPath 因此**不是纯函数** (同入参不同结果)。
// 另: 落定标记 gen+1 与下一轮入堆标记 gen 也不能再撞 (两格制后 gen 严格递增 2)。
let gen=0;
const DI=[1,-1,0,0,1,1,-1,-1], DJ=[0,0,1,-1,1,-1,1,-1], DC=[1,1,1,1,1.414,1.414,1.414,1.414];
bakeComponents(); // TDZ 之后补跑 (见上)
// 单次搜索的软预算 (扩展次数); 旧版硬上限 22000 会被大图长路径打满 → 现按"能收敛"留足余量。
// 实测长路径 2.3 万次扩展 ≈ 1~2ms, 极端 9 万次 ≈ 6ms —— 由调用方 NAV.budget(每帧 2 次) 兜住总开销。
const SEARCH_NODES=90000;
// 出生点"走得出去"的分量下限 (格数): 400 格 = 4 万 m² (100×100m)。工事环/道具封出的死袋实测 2~5 格,
// 与"正常的小片区域"差两个数量级; 本图最大的合法小区域 (塔拉瓦离岛) 也远大于它。见 spawnSpotOk。
const SPAWN_MIN_COMP=400;
// 可观测计数 (22-hud AI 调试层/探针读; 失败率是"寻路退化为站桩"的先行指标)
const navStats={calls:0,ok:0,fail:0,pruned:0,nodes:0,lastNodes:0,maxNodes:0,meet:0,lastSettles:0,maxSettles:0,
refreshMs:0,fullBakes:0,partBakes:0,skipBakes:0,lastDirty:0};
// ── findPath 内部函数提升 (2026-11-01 性能批) ──
// findPath 每帧至多 2 次调用 (NAV.budget=2), 旧版每次新建 10 个捕获闭包 (~20 个函数对象/帧 恒定账)。
// 除 _fpHLen/_fpPopDir 两根游标外, 全部被捕获状态本来就是 IIFE 级表 (gScore/heap*/gen/open/...),
// 提升到 IIFE 级后语义逐位不变; findPath 非重入 (内部无用户回调, NAV.budget 串行), 游标放模块级安全。
let _fpHLen=0, _fpPopDir=0;
const _fpOpenN=(ii,jj)=>{
if(ii<0||jj<0||ii>=N||jj>=N||!open[idx(ii,jj)]) return -1;
let nb=0;
if(ii>0&&open[idx(ii-1,jj)])nb++;
if(ii<N-1&&open[idx(ii+1,jj)])nb++;
if(jj>0&&open[idx(ii,jj-1)])nb++;
if(jj<N-1&&open[idx(ii,jj+1)])nb++;
return nb;
};
const _fpFix=(i,j)=>{
const nb0=_fpOpenN(i,j);
if(nb0>=2) return [i,j];
let fallback=null, fbd=1e9;
for(let r2=1;r2<13;r2++){
let pick=null, pbd=1e9;
for(let dj=-r2;dj<=r2;dj++)for(let di=-r2;di<=r2;di++){
if(Math.max(Math.abs(di),Math.abs(dj))!==r2) continue;
const nb=_fpOpenN(i+di,j+dj);
if(nb<2) continue;
const dd=di*di+dj*dj;
if(nb>=3&&dd<pbd){ pbd=dd; pick=[i+di,j+dj]; }
if(dd<fbd){ fbd=dd; fallback=[i+di,j+dj]; }
}
if(pick) return pick; // 本环已有走廊格 → 取环内最近的
}
return fallback||[i,j];
};
const _fpHSwap=(a,b)=>{
const tI=heapIdx[a],tK=heapKey[a],tD=heapDir[a];
heapIdx[a]=heapIdx[b]; heapKey[a]=heapKey[b]; heapDir[a]=heapDir[b];
heapIdx[b]=tI; heapKey[b]=tK; heapDir[b]=tD;
heapPos[heapIdx[a]*2+heapDir[a]]=a; heapPos[heapIdx[b]*2+heapDir[b]]=b;
};
const _fpHUp=(k)=>{
while(k>0){
const par=(k-1)>>1;
if(heapKey[par]<=heapKey[k]) break;
_fpHSwap(par,k); k=par;
}
};
const _fpHDown=(k)=>{
for(;;){
const l=k*2+1,r=l+1;
let s=k;
if(l<_fpHLen&&heapKey[l]<heapKey[s])s=l;
if(r<_fpHLen&&heapKey[r]<heapKey[s])s=r;
if(s===k)break;
_fpHSwap(s,k); k=s;
}
};
// push: 首次入堆 (写 heapPos) / 已有项则**原地降键** (调用方保证 key 只会变小 —— 只在严格更优 g 时才推)
const _fpPush=(node,key,dir)=>{
const pi=node*2+dir, at=heapPos[pi];
if(at>=0){ if(key<heapKey[at]){ heapKey[at]=key; _fpHUp(at); } return; }
const k=_fpHLen++;
heapIdx[k]=node; heapKey[k]=key; heapDir[k]=dir;
heapPos[pi]=k;
_heapTouched.push(pi);
_fpHUp(k);
};
// pop: 返回堆顶节点 (-1 = 空堆), 方向写入 _fpPopDir; 摘掉堆项时同步清 heapPos
const _fpPop=()=>{
const top=heapIdx[0];
_fpPopDir=heapDir[0];
_fpHLen--;
heapPos[top*2+_fpPopDir]=-1;
if(_fpHLen>0){
heapIdx[0]=heapIdx[_fpHLen]; heapKey[0]=heapKey[_fpHLen]; heapDir[0]=heapDir[_fpHLen];
heapPos[heapIdx[0]*2+heapDir[0]]=0;
_fpHDown(0);
}
return top;
};
// 单侧邻居扩展 (dir=0 正向: 从 cur 走向其邻居; dir=1 反向: 从 cur 反向走回其邻居 —— 边通行是无向的, 同一张边表)
// 落定格不再松弛: 双向搜索两侧都会走同一批格子, 若允许"已落定"的格子被改父指针,
// 两条方向的前驱链会互相穿针 → 回溯时出现环 (表现为路径里同一坐标重复几百次)。
const _fpExpand=(cur,dir,gArr,visitArr,cameArr,ti,tj)=>{
const cI=cur%N, cJ=(cur/N)|0, cg=gArr[cur];
const otherVisitArr=dir===0?visitGenB:visitGen;
for(let d=0;d<8;d++){
const ni=cI+DI[d], nj=cJ+DJ[d];
if(ni<0||nj<0||ni>=N||nj>=N) continue;
const nIdx=nj*N+ni;
if(!open[nIdx]) continue;
// 边通行: 直行查相邻边, 斜行查对角连线 (薄墙不再可穿越)
if(d===0){ if(!eH[idx(cI,cJ)]) continue; }
else if(d===1){ if(!eH[idx(ni,cJ)]) continue; }
else if(d===2){ if(!eV[idx(cI,cJ)]) continue; }
else if(d===3){ if(!eV[idx(cI,nj)]) continue; }
else if(d>=4){
if(d===4||d===7){ if(!(d===4?eD1[idx(cI,cJ)]:eD1[idx(ni,nj)])) continue; }
else { if(!(d===5?eD2[idx(cI,nj)]:eD2[idx(ni,cJ)])) continue; }
if(!open[idx(cI+DI[d],cJ)]||!open[idx(cI,cJ+DJ[d])]) continue;
}
const ov=otherVisitArr[nIdx];
if(ov===gen||ov===gen+1){
meetCandidates.push(nIdx);
}
const v=visitArr[nIdx];
if(v===gen+1) continue; // 已落定: 它的 g 与父指针都是终值, 不再改
const ng=cg+DC[d]*SP;
if(v!==gen||ng<gArr[nIdx]){
visitArr[nIdx]=gen; gArr[nIdx]=ng; cameArr[nIdx]=cur;
_fpPush(nIdx, ng+Math.sqrt((ni-ti)*(ni-ti)+(nj-tj)*(nj-tj))*SP, dir);   // 整数格距: sqrt 与 hypot 逐位同值 (2026-11-01 性能批)
}
}
};
// `gen` = 本代"已入堆未落定", `gen+1` = 本代"已落定", 其余值 = 非本代
// 返回值 = 本次是否真的落定 (0 = 该格已落定, 这一次是"改进后重推"留下的陈旧堆项 —— 只算弹出, 不算落定)
const _fpSettle=(i2,visitArr)=>{ if(visitArr[i2]===gen+1) return 0; visitArr[i2]=gen+1; return 1; };
const _fpIsSettled=(i2,visitArr)=>visitArr[i2]===gen+1;
function findPath(sx,sz,tx,tz){
let [si,sj]=toG(sx,sz), [ti,tj]=toG(tx,tz);
// 起/终点落到不可走格 (或"只有 1 个开放邻居"的死角) 时外推找落脚格。
// ★ 2026-09-18b 修: 旧版取"环上第一个 ≥2 邻居的格"—— 攻方滩头基地被帐篷/沙袋/登陆器材围成
//   3 格小袋时, 起点被吸附进袋内死胡同, findPath 对**任何**目标都返回 null ⇒ Bot 原地站桩不推进
//   (沙箱诊断: (0,178) 起点的 5m 格被占, 环上首个合格格 (-5,175) 的邻居只有 2 个开放, 整袋仅 3 格)。
//   现改为"优先最近的走廊格 (≥3 个开放邻居), 找不到才退回旧的 ≥2 判据" —— 正常地图的格子
//   本来就合格 (第一行直接返回), 行为零变化。
[si,sj]=_fpFix(si,sj); [ti,tj]=_fpFix(ti,tj);
const startI=idx(si,sj), goalI=idx(ti,tj);
if(startI===goalI) return [[tx,tz]];
// 连通分量预检: 起点/终点不同分量 → 无论怎么搜都不可能到达, 立即判定失败 (省掉整轮扩展)
const cs=comp[startI], ct=comp[goalI];
if(cs>=0&&ct>=0&&cs!==ct){ navStats.calls++; navStats.fail++; navStats.pruned++; return null; }
// 落定预算: 两侧分量格数之和就是"两棵树最多能落定多少格"的上界, 落定数打满 ⇒ 必然无解。
// ★2026-09-26 修 (P0², 与上一条同源): 这个上界计的是**落定格数**, 旧版却拿它当"堆弹出次数"的上限用 ——
// 同一格被"找到更优 g"重推时会重复弹出 (堆是惰性删除), 于是 popped 先于 settled 撞顶:
// 实测 hukawng base0(-285,0)→桥东(46,-6) 弹出 30604 次即撞顶返回 null, 而 navStats.pruned=0
// (分量表自己说可达)、真实落定数远未到上限 —— 即文件头注释宣称已修掉的"扩展上限打满的假失败", 换了个计数单位又回来了。
// 现在两个上限分开: settled 撞顶=正确性判定 (真无解), popped 撞顶=性能软上限 (只兜病态图)。
const settleCap=Math.min(SEARCH_NODES,(cs>=0&&ct>=0)?(csize[cs]+csize[ct]+64):SEARCH_NODES);
gen+=2;
// 代际回卷保护: Int32 表, 4 亿次调用后归零重建 (静默回卷会让访问标记互相撞代 —— 宁可重建)
if(gen>0x40000000){
gScore.fill(0); came.fill(0); visitGen.fill(0);
gScoreB.fill(0); cameB.fill(0); visitGenB.fill(0);
heapPos.fill(-1);
_heapTouched.length=0;
gen=2;
}
_fpHLen=0;
for(let i=0;i<_heapTouched.length;i++) heapPos[_heapTouched[i]]=-1;
_heapTouched.length=0;
meetCandidates.length=0;
gScore[startI]=0; visitGen[startI]=gen; came[startI]=-1;
gScoreB[goalI]=0; visitGenB[goalI]=gen; cameB[goalI]=-1;
_fpPush(startI, Math.hypot(si-ti,sj-tj)*SP, 0);
_fpPush(goalI, Math.hypot(si-ti,sj-tj)*SP, 1);
let settled=0, bestMeet=-1, bestCost=Infinity, popped=0;
// 双向 A* 终止: 两侧"已落定集合"的交集里代价最小者 ≥ 当前最优解 → 不可能再有更优解。
// 实现上每次落定一格就与对侧落定集求交并更新 bestCost, 再做一次"任一堆顶 f ≥ bestCost"的收敛判定。
// 双重上限 (2026-09-26): settled 见 settleCap 注释; popped 是性能软上限 (SEARCH_NODES, 极病态图才碰得到)。
while(_fpHLen>0&&popped<SEARCH_NODES&&settled<settleCap){
const topKey=heapKey[0];
if(bestMeet>=0&&topKey>=bestCost) break; // 两棵树的最优前景都不优于已找到的解 → 收工
const cur=_fpPop(); popped++;
if(cur<0) break;
const dir=_fpPopDir;
if(dir===0){
if(_fpIsSettled(cur,visitGenB)){ const c=gScore[cur]+gScoreB[cur]; if(c<bestCost){ bestCost=c; bestMeet=cur; } }
settled+=_fpSettle(cur,visitGen);
_fpExpand(cur,0,gScore,visitGen,came,ti,tj);
}else{
if(_fpIsSettled(cur,visitGen)){ const c=gScore[cur]+gScoreB[cur]; if(c<bestCost){ bestCost=c; bestMeet=cur; } }
settled+=_fpSettle(cur,visitGenB);
_fpExpand(cur,1,gScoreB,visitGenB,cameB,si,sj);
}
if(_fpHLen<=0) break; // 两棵树都枯竭 (堆空): 没有可扩展的前景
}
// 兜底: 两棵树已"相接"(某格双侧都有 g) 但都没落定 → 取相接格里代价最小的作为会合点 (仅遍历候选池)
if(bestMeet<0){
let bh=-1, bc=Infinity;
for(let m=0;m<meetCandidates.length;m++){
const k=meetCandidates[m];
if(visitGen[k]!==gen&&visitGen[k]!==gen+1) continue;
if(visitGenB[k]!==gen&&visitGenB[k]!==gen+1) continue;
const c=gScore[k]+gScoreB[k];
if(c<bc){ bc=c; bh=k; }
}
if(bh>=0){ bestMeet=bh; bestCost=bc; }
}
navStats.calls++; navStats.lastNodes=popped; navStats.nodes+=popped; if(popped>navStats.maxNodes) navStats.maxNodes=popped;
navStats.lastSettles=settled; if(settled>navStats.maxSettles) navStats.maxSettles=settled;
if(bestMeet<0){ navStats.fail++; return null; }
navStats.ok++; navStats.meet+=bestMeet;
const path=[];
let cur=bestMeet, hops=0, broken=false;
while(cur!==startI&&cur>=0){ const i=cur%N,j=(cur/N)|0; path.push([i*SP-OFF,j*SP-OFF]); cur=came[cur]; if(++hops>NN){ broken=true; break; } }   // toW 内联 (2026-11-01 性能批): 长 ~90 路标×2 的临时数组免掉
if(broken){ navStats.ok--; navStats.fail++; return null; } // 前驱链异常: 宁可判失败, 也不给出一条打转的路径
path.reverse();
cur=cameB[bestMeet]; hops=0;
while(cur!==goalI&&cur>=0){ const i=cur%N,j=(cur/N)|0; path.push([i*SP-OFF,j*SP-OFF]); cur=cameB[cur]; if(++hops>NN){ broken=true; break; } }
if(broken){ navStats.ok--; navStats.fail++; return null; }
path.push([tx,tz]);
// 路径平滑 (2026-09-19): 旧版对每个路标做"最多 8 个候选 × lineClear"的贪心前探 ——
// 长路径 (hukawng 跨图 ~90 个路标) 下这段比 A* 本身还贵 (平滑占了 5ms 里的大部分)。
// 现改为**有界二分**: 在 [k+1, k+MAXSPAN] 内二分出最远的可直连路标 —— lineClear 调用
// 由 8次/路标 降到 ~log2(MAXSPAN)次/路标, 结果与"最远可直连"贪心完全一致。
// 不变式 (2026-09-26D 复核, 原口径见下): 每个输出段的**走廊**都过 edgeOK —— 即中线全通, 或 ±NAV_EDGE_PAD 的
// 平行线全通 (lineClear 只管平滑前探的"严格中线"那一档, 所以平滑挑出来的长段必然严格中线全通)。
// 为什么不是"段段过 lineClear": 5m 格上的一件 1~2m 点状道具 (弹药箱/单节沙袋) 会挡住格心连线, 但旁边
// 0.5~1.25m 就是空走廊 —— 这是本批放宽判据要放过的正是这一类 (见文件头 P0-3 注释), 量测见 dev/_navleg-diag.js。
// 物理上走得通: 士兵半径 0.3m, 局部避障每帧探 1.1m 内 7 个方向 (14-bots moveDir), 且连续卡住 3 次会插一个
// lineClear 核验过的绕行点 —— 1~2m 点状道具属"擦角绕行", 不是墙。
// 回归判据 (dev/verify-nav-20260926 ④): 输出段段过 edgeOK; 且合成对照里 1m 厚长墙必须被 edgeOK 拒 (判据不是橡皮章)。
// **链本身必须真实**: 若 came/cameB 被查成环或跨格 (见上面 gen 两格制),
// 平滑会把非相邻格当成一段去核验并失败 ⇒ 退回 far=k 后照样吐出一条穿墙路标 —— 这正是旧版实测"路标段 lineClear 不过"的来路。
const sm=[];
let ax=sx, az=sz, k=0;
const MAXSPAN=40;
while(k<path.length){
let far=k;
if(path.length-k<=8){ // 短路径: 维持旧版逐点前探 (行为逐字节等价)
for(let m2=k;m2<path.length;m2++){
if(lineClear(ax,az,path[m2][0],path[m2][1])) far=m2;
}
}else{
let lo=k, hi=Math.min(path.length-1,k+MAXSPAN);
if(lineClear(ax,az,path[hi][0],path[hi][1])) far=hi;
else{
while(hi-lo>1){
const mid=(lo+hi)>>1;
if(lineClear(ax,az,path[mid][0],path[mid][1])) lo=mid; else hi=mid;
}
far=lo;
}
}
sm.push(path[far]);
ax=path[far][0]; az=path[far][1];
k=far+1;
}
return sm;
}
// ── 出生点可用性 (2026-09-26 新增): "这个地方走不走得出去" ──
// 背景: 5m 格 + 0.9m 线采样是**保守**判据 —— 物理上能挤过去的窄门 (3~6m) 在格图上可能整片封死。
// 于是一个强点工事环 (草原遭遇 7 个 spawns) 或一件落在门线上的道具, 就能把点位圈成 2~5 格的死袋:
// 沙箱实测 草原遭遇 风车磨坊/北原哨/麦田农庄 三个强点、随机布景下每次换局还会换人 —— 落进去的兵
// 对任何目标的 findPath 恒为 null (14-bots 的"无路可走就不动"), 观感就是整局站桩。
// 判据: 格开放 + 所在连通分量 ≥ minCells 格 (默认 SPAWN_MIN_COMP=400 格 = 100×100m; 比它小的袋必是意外)。
// 只用于**出生/部署筛点**, 不参与 findPath 的可达性判定 (那边是"点对点"问题, 不关心分量大小)。
function spawnSpotOk(x,z,minCells){
const [i,j]=toG(x,z), k=idx(clamp(i,0,N-1),clamp(j,0,N-1));
if(!open[k]) return false;
const c=comp[k];
return c>=0&&csize[c]>=(minCells||SPAWN_MIN_COMP);
}
// 出生点兜底搬迁: 封锁格或死袋 → 就近找"走得出去"的落点 (环扫到 R 米, 默认 24m); 找不到就原样返回。
// 逐环向外扫, 首个合格点即最近点 (同环上各点到原点等距, 取先扫到的那个 → 结果确定, 便于探针复现)。
function spawnSpot(x,z,R){
// 出生离边门 (2026-11-13): 快路也要过边带 —— 原点贴边时照旧环扫往里搬 (typeof 守卫: 07-nav 先于
// 17-emplacements 载入, 函数声明不跨脚本提升)。
if(spawnSpotOk(x,z)&&(typeof spawnEdgeOk!=='function'||spawnEdgeOk(x,z))) return [x,z];
const rMax=R||24, step=1.5;
for(let r=step;r<=rMax;r+=step){
const n=Math.max(8,Math.round((2*Math.PI*r)/2.0));   // 弧长 ~2m 一个采样点
for(let k2=0;k2<n;k2++){
const a=k2/n*Math.PI*2;
const px=x+Math.cos(a)*r, pz=z+Math.sin(a)*r;
if(!spawnSpotOk(px,pz)) continue;
if(typeof spawnEdgeOk==='function'&&!spawnEdgeOk(px,pz)) continue;   // 搬迁也不出边带 (2026-11-13)
if(occBlocked(px,pz)) continue;      // 与出生筛选同口径: 该点自身也要站得住
return [px,pz];
}
}
return (typeof spawnEdgeClamp==='function')?spawnEdgeClamp(x,z):[x,z];   // 兜底同样钳回边带 (2026-11-13)
}
// edgeOK 一并导出: 它是"两格之间能不能走过去"的**唯一判据** (A* 扩展/分量 BFS/平滑前探全读它)。
// 路径输出段的可通保证按它定义 (中线全通 或 ±NAV_EDGE_PAD 平行线全通), 不是按更严的 lineClear ——
// 探针要验的话必须验这一条, 别在探针里另抄一份平移逻辑 (抄一份 = 判据两份, 迟早漂移)。
return { findPath, blocked2D:(x,z)=>occBlocked(x,z), lineClear, edgeOK, spawnSpotOk, spawnSpot, budget:3, stats:navStats,
resetStats(){ navStats.calls=0; navStats.ok=0; navStats.fail=0; navStats.pruned=0; navStats.nodes=0; navStats.lastNodes=0; navStats.maxNodes=0; navStats.meet=0; navStats.lastSettles=0; navStats.maxSettles=0;
navStats.refreshMs=0; navStats.fullBakes=0; navStats.partBakes=0; navStats.skipBakes=0; navStats.lastDirty=0; },
// refresh(forceFull): 占用/索引重建 + 导航重烘焙。
// 旧签名无参 = 全量; 现无参 = **自适应** (按 OCC.dirty 走增量, 不具局部性时自动全量) —— 调用点无需改动。
// forceFull=true 强制全量 (世界还原/换图这类"整张图都可能是新的"场景, 见 23b-worldrestore)。
// ★2026-11-11 性能批两刀:
//   ① buildSpatialIndex 按集合变更戳跳过 (04-collision _colIdxDirty): 火情期每 5s 的 refresh 里
//     "数千 BOX/CYL 重灌倒排表 + 两枚 Int32Array 重分配"对局部事件是纯冗余 (addBoxCollider 已增量注册)。
//   ② 脏区按**矩形簇**逐个走增量 bakeRegion (03-terrain occTouch/occDiffRects 簇合并): 旧版把所有触点
//     并成一个外接矩形, 两处火线相距几百米时覆盖面积轻松超 REBAKE_FULL_FRAC ⇒ 退回全量烘焙
//     (640 图 128~143ms = "每隔几秒定帧一次"的病根)。簇级增量下各自小区域照旧走 bakeRegion,
//     兜底: 任一簇面积超阈值 / 簇数超登记端 CAP (已退化单矩形) / forceFull ⇒ 一次全量。
refresh(forceFull){
buildOccupancy();
if(_colIdxDirty||forceFull){ buildSpatialIndex(); _colIdxDirty=false; }
const t0=Date.now();
const dirty=OCC.dirty, dlist=OCC.dirtyList;
if(forceFull||!baked){ fullBakeGrid(); navStats.fullBakes++; navStats.lastDirty=-1; }
else if(!dirty){ navStats.skipBakes++; navStats.lastDirty=0; } // 占用逐格未变 ⇒ 导航输入未变, 整段跳过
else{
// OCC 格坐标 (1m) → 世界坐标 → NAV 格坐标: 两端各留 1 格外扩 (保守; bakeRegion 内部还会再外扩)
const {res,off}=OCC;
const rects=(dlist&&dlist.length)?dlist:[dirty];
let cellsSum=0, over=false;
for(let q=0;q<rects.length;q++){
const r=rects[q];
const x0=r.i0*res-off, x1=r.i1*res-off, z0=r.j0*res-off, z1=r.j1*res-off;
const nr=_navRects[q]||(_navRects[q]={gi0:0,gj0:0,gi1:0,gj1:0,cells:0});
nr.gi0=clamp(Math.floor((x0+OFF)/SP)-1,0,N-1); nr.gi1=clamp(Math.floor((x1+OFF)/SP)+1,0,N-1);
nr.gj0=clamp(Math.floor((z0+OFF)/SP)-1,0,N-1); nr.gj1=clamp(Math.floor((z1+OFF)/SP)+1,0,N-1);
nr.cells=(nr.gi1-nr.gi0+1)*(nr.gj1-nr.gj0+1);
cellsSum+=nr.cells;
if(nr.cells>NN*REBAKE_FULL_FRAC) over=true;
}
navStats.lastDirty=cellsSum;
if(over){ fullBakeGrid(); navStats.fullBakes++; }
else for(let q=0;q<rects.length;q++){ const nr=_navRects[q]; bakeRegion(nr.gi0,nr.gj0,nr.gi1,nr.gj1); navStats.partBakes++; }
}
// 清账: 脏矩形只由本函数消费 (03-terrain occDirtyClear) —— 清早了会漏改动, 清晚了只是多算几格
if(typeof occDirtyClear==='function') occDirtyClear();
navStats.refreshMs=Date.now()-t0;
}
};
})();
// 工事建造后延迟刷新导航/占用网格 (合批, 避免连放多件时重复重建)
let _navDirtyT=0;
function markNavDirty(){ _navDirtyT=0.6; }
function updateNavDirty(dt){
if(_navDirtyT>0){
_navDirtyT-=dt;
if(_navDirtyT<=0) NAV.refresh();
}
}
