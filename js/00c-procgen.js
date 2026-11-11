'use strict';
// ─────────────────────────────────────────────
// 00c-procgen.js —— 随机战场 · 数据阶段 (2026-10-06 设计定稿 §2; 2026-10-24 规模三档+骨架抽签+农田掩体批)
// 群系 (PG_BIOMES@00-config, 一级轴=人文聚落形态): farm 农村平原 / town 城郊镇集 / water 水乡河网。
//   farm: 主街+干道+支巷 → 带状地块 → 旗点(广场+两翼极坐标) → 农田大粮仓(量做群系区分) → 林地
//   town: 加长主街(96~124) → 两端锚点生出 支巷×3 + 次街×2(cls='sub') + 铁路货线 → 旗点锚次街端/货线 → 贴边碎田
//   water: 主河折线(三级中点位移) → 石桥位/徒涉滩 → 支汊 → 核心=主桥头堍, 两军基地分列两岸
//          → 滨河街(沿岸线偏移)/跨桥 connector/支巷(沿离河法向)/桥堍与滩头接巷(growClear 四级阶梯防跨河)
//          → 旗点=路网折点(桥头/对岸/二桥/上村/渡口) → 鱼塘/水田块
// 骨架 (2026-10-24 裁定, farm/town 抽签 / water 固定): mono 单核(旧构+卫星小村) / dual 双村对峙 /
//   linear 线性走廊 —— 打破"所有图都是单核村庄"的同构; 地标随机缺席 (教堂75%/风车55%/厂65%/副村35%)。
// 规模 (2026-10-24 裁定): 小300 / 中380 / 大480 (PG.size, 大厅选档)。全部距离带以 HALF 系常数单源缩放;
//   380 档=旧字面量口径。兵力/装甲配平在 00-config 战役条目 (botMul/tankN)。
// 农田 (2026-10-24 裁定): farm 量大户(11~14@380) / town 城郊贴边碎田(3~5) / water 水田 —— 绿黄双保底
//   (首块钉 corn 绿、次块钉 wheat 黄); 每田 2~3 边田缘墙 + 1~3 草垛 (本层数据定计划, 05c 建造执行)。
// 管线 (Parish-Müller 简化): 种子 PRNG → 骨架/聚落/基地 → 路网生长 → 带状地块 → 旗点 → 田/林/孤树
//   → 写 CAMPAIGN.{flags,bases,roads,fields}。田缘墙/草垛/孤树随 fields/PGDATA.singles 下发。
// 水文消费全走通用链: RIVER 语义表 (03-terrain heightAt 后置下切 + ford) / BRIDGES kind:'stone' (05c buildWorld
// 通用石拱) / DELTA.channels+ponds (05c 通用水面登记 + inShallowChannel) —— 00c 只产折线、净空与重绑。
// 建造阶段在 05c layoutProcgen() (kind→05a/05b 生成器映射 + 铁路 railLine + 桥头工事 + 掩体审计 + NAV 放行)。
// 红线: ① 非 procgen 图零执行 (随机流零交叉, 布局指纹不漂) ② 本文件不用 wr()/rand(), 自带 n32 单源
//       ③ 同种子同规模全同: 地形相位(PG.ph)/群系/骨架/路网/地块/旗点全部出自同一 mulberry32 流, 顺序即布局
//       ④ 规模/群系/主题抽取不占随机流 (规模只读存储; 群系/主题独立哈希) ⇒ 同种子跨规模只差尺寸带
//       ⑤ 跨河硬约束: 任何路面线段与主河相交必须落在桥矩形内 (growClear 阶梯末级拦河截断保证)
//       ⑥ 岸别单源: bankOf/bankNrm/bankPt 同为左法向口径 (+1 侧 = CORE_BANK 判定源), 符号翻=铺到对岸
//       ⑦ 旗点两两 ≥52m (探针口径); 任何落旗路径 (吸附/接巷/直推) 不得绕过 flagOK
// ─────────────────────────────────────────────
var PG_WR_SEED=0;   // 05-world wr() 编程播种钩子: procgen 图=种子(布局级确定性), 其他图恒 0=逐位现状
var PGDATA=null;
(function(){
if(typeof CAMPAIGN==='undefined'||!CAMPAIGN||CAMPAIGN.layout!=='procgen'||typeof PG==='undefined'||!PG) return;
const S=PG.seed>>>0;
PG_WR_SEED=S;
let _s=S||1;
const n32=()=>{ _s=(_s+0x6D2B79F5)|0; let t=Math.imul(_s^(_s>>>15),1|_s); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; };
const pgR=(a,b)=>a+n32()*(b-a);
const pgI=(a,b)=>Math.floor(pgR(a,b+1));
const pgPick=arr=>arr[Math.min(arr.length-1,Math.floor(n32()*arr.length))];
const segDist=(px,pz,ax,az,bx,bz)=>{ const abx=bx-ax,abz=bz-az; const L2=abx*abx+abz*abz||1e-9;
  const t=Math.max(0,Math.min(1,((px-ax)*abx+(pz-az)*abz)/L2)); return Math.hypot(px-(ax+abx*t),pz-(az+abz*t)); };

// ── 0. 群系表/规模常数/地形噪声单源 ──────────────────────────────────────────
// farm 的 noise 即基线字面量 (三层正弦, 波长 ~570/190/75m 总幅 ~5.6m, 相位出自 PG.ph) ⇒ 同种子同地形。
// grow() 顺带缓存每段两端噪声高 (RH) ⇒ pgH 沿路压平零重复计算。
// 规模带 (HALF 系): B_IN 场内门(旗/地块) / B_CL 基地钳位 / B_RC 农田角点门 / B_FD 农田采样域 /
//   B_WD 林地场内门 —— 380 档全部等于旧字面量 (178/180/184/150/172)。
const BIO=PG_BIOMES[PG.biome]||PG_BIOMES.farm;
const WATER=(BIO.hydro==='river');
const TH=PG.theme;
const SZ=PG.size||380, HALF=SZ/2, SK=HALF/190;
const WSC=Math.max(0.72,SK);                                        // 旗距缩放下限 (小图翼旗不贴基地)
const B_IN=HALF-12, B_CL=HALF-10, B_RC=HALF-6, B_FD=HALF-40, B_WD=HALF-18;
function pgNoise(x,z){
 const N=BIO.noise;
 return N.a[0]*Math.sin(x*N.fx[0]+PG.ph[0])*Math.cos(z*N.fz[0]+PG.ph[1])
      + N.a[1]*Math.sin(x*N.fx[1]+PG.ph[2])*Math.sin(z*N.fz[1]+PG.ph[3])
      + N.a[2]*Math.sin(x*N.fx[2]+PG.ph[1])*Math.cos(z*N.fz[2]+PG.ph[0]);
}
function sst(t){ t=Math.max(0,Math.min(1,t)); return t*t*(3-2*t); }

// ── W. 水乡水文 (仅 water 群系进入; farm/town 零进 ⇒ 随机流零影响) ─────────────
// 主河: 图幅一侧流向对侧 (方向角 rivAng), 三级中点位移 (侧移幅 40/16/6m) ⇒ 9 顶点蜿蜒折线。
// 桥位: 主桥=距原点最近河顶点; 二三桥=沿河 ±2 顶点 (~±92m)。徒涉滩=远离桥位的顶点 (渡口)。
// 支汊: 从河顶点向图缘的浅折线 (d=1.35 可涉渡=软通道); 鱼塘在 §4W (晚于旗点/地块, 单向避让)。
const riverPts=[], waterBridges=[], dchans=[], ponds=[], WATERWORKS=[];
let RIVW=0, ROFF=0, CORE_BANK=1, fordSite=null, fordIdx=-1, rivAng=0, mbIdx=0, MB={x:0,z:0}, MBT=[0,1], MBP=[1,0];
if(WATER){
 rivAng=pgR(0,6.2832);
 const CA=Math.cos(rivAng),SA=Math.sin(rivAng),PX=-SA,PZ=CA;      // 流向/岸向单位向量
 let rp=[[-CA*(HALF-12),-SA*(HALF-12)],[CA*(HALF-12),SA*(HALF-12)]];  // 端点钉场内缘 (徒涉滩可用端点顶点)
 for(const A of [40,16,6]){
  const nx=[rp[0]];
  for(let i=0;i<rp.length-1;i++){
   const p=rp[i],q=rp[i+1],md=pgR(-A,A);
   nx.push([(p[0]+q[0])/2+PX*md,(p[1]+q[1])/2+PZ*md],q);
  }
  rp=nx;
 }
 for(const p of rp) riverPts.push([Math.round(p[0]),Math.round(p[1])]);
 RIVW=pgR(7,9);
 ROFF=Math.round(RIVW+6);                                     // 滨河街退距 (=主桥堍外缘口径: 街心/桥堍同点)
 // 主桥位: 距原点最近的顶点 m; 桥轴=两岸向 (相邻段垂线, 与淞沪桥表同口径: yaw=atan2(-tz,tx))
 let bd=1e9;
 for(let i=1;i<riverPts.length-1;i++){
  const d=Math.hypot(riverPts[i][0],riverPts[i][1]); if(d<bd){ bd=d; mbIdx=i; }
 }
 MB={x:riverPts[mbIdx][0],z:riverPts[mbIdx][1]};
 {
  const p0=riverPts[mbIdx-1],p1=riverPts[mbIdx+1];
  let tx=p1[0]-p0[0],tz=p1[1]-p0[1]; const tl=Math.hypot(tx,tz)||1; tx/=tl; tz/=tl;
  MBT=[tx,tz]; MBP=[-tz,tx];
 }
 function bridgeAt(i){
  const P=riverPts[i],p0=riverPts[i-1],p1=riverPts[i+1];
  let tx=p1[0]-p0[0],tz=p1[1]-p0[1]; const tl=Math.hypot(tx,tz)||1; tx/=tl; tz/=tl;
  return {x:P[0],z:P[1],len:Math.round(RIVW*2+pgR(9,11)),w:pgR(6.6,7.4),yaw:Math.atan2(-tz,tx),kind:'stone',_vi:i};
 }
 waterBridges.push(bridgeAt(mbIdx));
 const bCand=[mbIdx-2,mbIdx+2].filter(i=>i>=1&&i<=riverPts.length-2);
 if(bCand.length>=2&&n32()<0.5) waterBridges.push(bridgeAt(bCand[0]),bridgeAt(bCand[1]));
 else waterBridges.push(bridgeAt(bCand[Math.floor(n32()*bCand.length)]));
 // 徒涉滩: 距全部桥位 ≥55 的外围顶点 (m±4 优先=端点, m±3 兜底), 有则记渡口
 {
  for(const i of [mbIdx+4,mbIdx-4,mbIdx+3,mbIdx-3]){
   if(i<1||i>riverPts.length-2) continue;
   const P=riverPts[i];
   if(Math.abs(P[0])>B_IN||Math.abs(P[1])>B_IN) continue;
   let ok=true;
   for(const b of waterBridges) if(Math.hypot(P[0]-b.x,P[1]-b.z)<55){ ok=false; break; }
   if(ok){ fordSite={x:P[0],z:P[1],r:pgR(13,16)}; fordIdx=i; break; }
  }
 }
 // 支汊: 1~2 条, 从非桥位河顶点向图缘伸出的浅折线 (与上游河向夹 ±0.6~1.2rad, 3 步各 30~46m)
 {
  const nC=pgI(1,2);
  const used={}; for(const b of waterBridges) used[b._vi]=1;
  for(let k=0,made=0;k<8&&made<nC;k++){
   const vi=mbIdx+(n32()<0.5?1:-1)*(1+pgI(0,2));
   if(vi<1||vi>riverPts.length-2||used[vi]) continue;
   const P=riverPts[vi];
   if(Math.abs(P[0])>B_FD||Math.abs(P[1])>B_FD) continue;
   const dir0=Math.atan2(P[1]-riverPts[vi-1][1],P[0]-riverPts[vi-1][0])+(n32()<0.5?1:-1)*pgR(0.6,1.2);
   const ch=[[P[0],P[1]]];
   let la=dir0,x=P[0],z=P[1];
   for(let st2=0;st2<3;st2++){
    la+=pgR(-0.35,0.35);
    x+=Math.cos(la)*pgR(30,46); z+=Math.sin(la)*pgR(30,46);
    ch.push([Math.round(x),Math.round(z)]);
   }
   const tail=ch[ch.length-1];
   if(Math.abs(tail[0])<B_FD&&Math.abs(tail[1])<B_FD) continue;   // 未出图缘: 不算汊
   dchans.push(ch); made++; used[vi]=1;
  }
 }
}
// 水净空助手 (须先于核心/基地块定义: baseOK 消费; ponds 此刻尚空, pondDist 读活跃数组 ⇒ 单向避让)
const rivDist=(x,z)=>{ if(!WATER) return 1e9; let d=1e9;
 for(let i=0;i<riverPts.length-1;i++){ const dd=segDist(x,z,riverPts[i][0],riverPts[i][1],riverPts[i+1][0],riverPts[i+1][1]); if(dd<d)d=dd; } return d; };
const chanDist=(x,z)=>{ if(!dchans.length) return 1e9; let d=1e9;
 for(const ch of dchans) for(let i=0;i<ch.length-1;i++){ const dd=segDist(x,z,ch[i][0],ch[i][1],ch[i+1][0],ch[i+1][1]); if(dd<d)d=dd; } return d; };
const pondDist=(x,z)=>{ if(!ponds.length) return 1e9; let d=1e9;
 for(const pd of ponds){ const dd=Math.hypot(x-pd.x,z-pd.z)-pd.r; if(dd<d)d=dd; } return d; };
const railDist=(x,z)=>{ if(!RAIL.length) return 1e9; let d=1e9;
 for(let i=0;i<RAIL.length-1;i++){ const dd=segDist(x,z,RAIL[i][0],RAIL[i][1],RAIL[i+1][0],RAIL[i+1][1]); if(dd<d)d=dd; } return d; };

// 水乡岸别/岸线助手 (仅水乡消费; 纯函数零随机流 ⇒ farm/town 逐位不动)
// 单源口径: 左法向 n=(-tz,tx) (bank=+1 侧)。bankOf 取 ((z-pz)*abx-(x-px)*abz) — 与 bankNrm/bankPt 同侧;
// 写成相反号会让岸别整体翻转 (本岸街被铺到对岸 ⇒ 阶梯兜底造出跨河路面, 2026-10-07e seed 100350 实测)。
// bankPt(i,bank,d)=河顶点 i 沿该岸法向偏移 d 的点 —— 滨河街/桥堍/渡口岸点全部由此生成 (沿岸线铺;
// 旧版沿主桥切线直铺会在河湾处滑到对岸/入水 = 跨河违规根因)。
const bankOf=(x,z)=>{ let bd=1e9,sg=0;
 for(let i=0;i<riverPts.length-1;i++){
  const ax=riverPts[i][0],az=riverPts[i][1],abx=riverPts[i+1][0]-ax,abz=riverPts[i+1][1]-az,L2=abx*abx+abz*abz||1e-9;
  const t=Math.max(0,Math.min(1,((x-ax)*abx+(z-az)*abz)/L2));
  const px=ax+abx*t,pz=az+abz*t,dd=Math.hypot(x-px,z-pz);
  if(dd<bd){ bd=dd; sg=Math.sign((z-pz)*abx-(x-px)*abz)||0; }
 }
 return sg; };
const bankNrm=(i,bank)=>{
 const a=riverPts[Math.max(0,i-1)], b=riverPts[Math.min(riverPts.length-1,i+1)];
 let tx=b[0]-a[0],tz=b[1]-a[1]; const tl=Math.hypot(tx,tz)||1; tx/=tl; tz/=tl;
 return [-tz*bank, tx*bank]; };
const bankPt=(i,bank,d)=>{ const n=bankNrm(i,bank);
 return [Math.round(riverPts[i][0]+n[0]*d), Math.round(riverPts[i][1]+n[1]*d)]; };

// ── 1. 骨架抽签与聚落系 (2026-10-24): mono 单核(旧构+卫星小村) / dual 双村对峙 / linear 线性走廊 ──
// SETTLE: {x,z,main,r,stAng,mEnds} —— 主村(main)=广场旗+教堂/碉楼; 副村=村口旗+谷仓级地标。
// core 恒=SETTLE[0] (下游 pgH/地标/丧尸 solo 基地消费); 基地恒沿 baseAng 对轴 (dual/linear=骨架轴)。
let core,baseAng,baseD;
const clB=v=>Math.max(-B_CL,Math.min(B_CL,v));
const SETTLE=[];
let SKELETON=WATER?'water':'mono';
if(WATER){
 // 核心=主桥头堍 (MB 沿本岸法向 +ROFF = 滨河街中线, 与街心顶点同点); 基地方向指向本岸 ⇒ 两军分列两岸对轴
 core={x:Math.round(MB.x+MBP[0]*ROFF), z:Math.round(MB.z+MBP[1]*ROFF)};
 CORE_BANK=(bankOf(core.x,core.z)===0)?1:bankOf(core.x,core.z);
 baseAng=rivAng+Math.PI/2+pgR(-0.25,0.25);
 {
  const dx=Math.cos(baseAng),dz=Math.sin(baseAng);
  if(dx*MBP[0]+dz*MBP[1]<0) baseAng+=Math.PI;                  // 基地方向须指向核心所在岸
 }
 baseD=pgR(Math.max(96,132*SK),Math.max(110,150*SK));
 SETTLE.push({x:core.x,z:core.z,main:true,r:14});
}else{
 const skp=n32();
 SKELETON=(skp<0.4)?'mono':(skp<0.72)?'dual':'linear';
 if(SKELETON==='mono'){
  // 旧构: 核心近图心随机, 基地任意向对轴; 卫星小村 (多聚落裁定) 环主村缝合 (无旗, 密度件)
  const coreAng=pgR(0,6.2832);
  core={x:Math.round(Math.cos(coreAng)*pgR(0,36)), z:Math.round(Math.sin(coreAng)*pgR(0,36))};
  baseAng=pgR(0,6.2832); baseD=pgR(Math.max(96,132*SK),Math.max(110,150*SK));
  SETTLE.push({x:core.x,z:core.z,main:true,r:14});
  const nSat=(SZ>=480)?2:(SZ>=380)?((n32()<0.7)?1:0):((n32()<0.35)?1:0);
  for(let k=0,made=0;k<12&&made<nSat;k++){
   const a=pgR(0,6.2832), dd=pgR(92,Math.max(102,HALF-58));
   const x=Math.round(core.x+Math.cos(a)*dd), z=Math.round(core.z+Math.sin(a)*dd);
   if(Math.abs(x)>B_IN-8||Math.abs(z)>B_IN-8) continue;
   let ok=true; for(const s of SETTLE) if(Math.hypot(x-s.x,z-s.z)<88){ ok=false; break; }
   if(!ok) continue;
   SETTLE.push({x,z,main:false,r:11}); made++;
  }
 }else if(SKELETON==='dual'){
  // 双村对峙: 两主村分列骨架轴 ±0.42·HALF, 基地在本村外侧 —— 村际 connector=争夺轴
  const a2=pgR(0,6.2832), d2=HALF*0.42;
  core={x:Math.round(Math.cos(a2)*d2),z:Math.round(Math.sin(a2)*d2)};
  baseAng=a2; baseD=d2+pgR(58,72);
  SETTLE.push({x:core.x,z:core.z,main:true,r:14},
   {x:clB(Math.round(-Math.cos(a2)*d2)),z:clB(Math.round(-Math.sin(a2)*d2)),main:false,r:13});
 }else{
  // 线性走廊: 主村近图心 + 两副村钉走廊轴 ±0.46·HALF, 基地钉走廊两端外 —— 走廊=穿村干道
  const a3=pgR(0,6.2832), d3=HALF*0.46;
  core={x:Math.round(Math.cos(a3)*4),z:Math.round(Math.sin(a3)*4)};
  baseAng=a3; baseD=d3+pgR(58,72);
  SETTLE.push({x:core.x,z:core.z,main:true,r:14},
   {x:clB(Math.round(core.x+Math.cos(a3)*d3)),z:clB(Math.round(core.z+Math.sin(a3)*d3)),main:false,r:12},
   {x:clB(Math.round(core.x-Math.cos(a3)*d3)),z:clB(Math.round(core.z-Math.sin(a3)*d3)),main:false,r:12});
 }
}
// 基地 (骨架分派): mono=核心对轴公式 (旧构); dual/linear=钉各聚落**外侧** 58~72m ——
// 双村/走廊夹基地对峙 (村=前进阵地)。旧写法 base1=core−dir·baseD 会落进副村与图心之间 (2026-10-24 实测 seed 1/777)。
let bases;
if(WATER||SKELETON==='mono'){
 bases=[
  {x:clB(Math.round(core.x+Math.cos(baseAng)*baseD)), z:clB(Math.round(core.z+Math.sin(baseAng)*baseD))},
  {x:clB(Math.round(core.x-Math.cos(baseAng)*baseD)), z:clB(Math.round(core.z-Math.sin(baseAng)*baseD))}];
}else{
 const o0=pgR(58,72)*(SZ===300?1.2:1), o1=pgR(58,72)*(SZ===300?1.2:1);   // 小图基地外推 (翼旗带让位)
 const s0=(SKELETON==='dual')?SETTLE[0]:SETTLE[1];        // +侧聚落 (dual=主村 / linear=走廊+端副村)
 const s1=(SKELETON==='dual')?SETTLE[1]:SETTLE[2];        // -侧聚落
 bases=[
  {x:clB(Math.round(s0.x+Math.cos(baseAng)*o0)), z:clB(Math.round(s0.z+Math.sin(baseAng)*o0))},
  {x:clB(Math.round(s1.x-Math.cos(baseAng)*o1)), z:clB(Math.round(s1.z-Math.sin(baseAng)*o1))}];
}
if(WATER){
 // 河湾摆向基地: 逐档内收至两岸净空达标 (基地不落河湾/支汊, 距主河 ≥w+26)
 const baseOK=(x,z)=>{
  if(Math.abs(x)>B_IN||Math.abs(z)>B_IN) return false;
  if(rivDist(x,z)<RIVW+26) return false;
  for(const ch of dchans){ for(let i=0;i<ch.length-1;i++) if(segDist(x,z,ch[i][0],ch[i][1],ch[i+1][0],ch[i+1][1])<24) return false; }
  return true;
 };
 for(const k of [0,1]){
  for(const dd of [0,-14,-28,-40]){
   const x=clB(Math.round(core.x+Math.cos(baseAng)*(baseD+dd)*(k===0?1:-1)));
   const z=clB(Math.round(core.z+Math.sin(baseAng)*(baseD+dd)*(k===0?1:-1)));
   bases[k]={x,z};
   if(baseOK(x,z)) break;                                     // 兜底: 留最内档
  }
 }
}
// 单队生存主基地居中 (2026-10-07d 裁定3, 参考诺曼底"守教堂"口径): solo 无敌队, 主基地=群系守点旁 8m
// —— farm/town=主村核心 (教堂/集市广场), water=主桥头堍 (baseAng 已指向本岸 ⇒ 8m 远离水线)。
// 营区/部署/zDefPosts/坦克驻位全链以此为圆心。两基地同点 (队1不生成, 只为对称消费端兜底)。
if(typeof ZOMBIE_MODE!=='undefined'&&ZOMBIE_MODE==='solo'){
 const bx=clB(Math.round(core.x+Math.cos(baseAng)*8)), bz=clB(Math.round(core.z+Math.sin(baseAng)*8));
 bases[0]={x:bx,z:bz}; bases[1]={x:bx,z:bz};
}

// ── 2. 路网生长 (全局目标=锚点, 局部约束=步进抖动; 步长 13m) ──────────────────
const ROADS=[];   // [x1,z1,x2,z2] 线段表 (CAMPAIGN.roads 同格式: 地形/小地图/部署图/菜单沙盘共读)
const RH=[];      // 与 ROADS 平行: 每段两端 pgNoise 高 (压平基准, 2026-10-07 v2)
const POLYS=[];   // {pts,cls} 折线表 (地块/掩体审计用)
function grow(ax,az,bx,bz,jit,cls){
 const pts=[[Math.round(ax),Math.round(az)]];
 let x=ax,z=az,g=90;
 while(g-->0){
  const dx=bx-x,dz=bz-z,d=Math.hypot(dx,dz);
  if(d<13){ pts.push([Math.round(bx),Math.round(bz)]); break; }
  const a=Math.atan2(dz,dx)+pgR(-jit,jit);
  x+=Math.cos(a)*13; z+=Math.sin(a)*13;
  pts.push([Math.round(x),Math.round(z)]);
 }
 for(let i=0;i<pts.length-1;i++){
  const p=pts[i],q=pts[i+1];
  ROADS.push([p[0],p[1],q[0],q[1]]);
  RH.push([pgNoise(p[0],p[1]),pgNoise(q[0],q[1])]);
 }
 POLYS.push({pts,cls});
 return pts;
}
const roadDistTo=(x,z)=>{ let d=1e9; for(let i=0;i<ROADS.length;i++){ const r=ROADS[i];
  const dd=segDist(x,z,r[0],r[1],r[2],r[3]); if(dd<d)d=dd; } return d; };
// town 铁路货线折线 (建造期 railLine 铺装; **不进 ROADS/POLYS**=不压平不摊面不落屋, 与 baituan 铁路同口径)
const RAIL=[];
function growRail(ax,az,bx,bz,jit){
 const pts=[[Math.round(ax),Math.round(az)]];
 let x=ax,z=az,g=90;
 while(g-->0){
  const dx=bx-x,dz=bz-z,d=Math.hypot(dx,dz);
  if(d<13){ pts.push([Math.round(bx),Math.round(bz)]); break; }
  const a=Math.atan2(dz,dx)+pgR(-jit,jit);
  x+=Math.cos(a)*13; z+=Math.sin(a)*13;
  pts.push([Math.round(x),Math.round(z)]);
 }
 return pts;
}
// ── 2C. 水乡防跨河铺路 (growClear): 直连 → 远河 via 点绕 → 沿本岸绕 → 拦河截断 (四级阶梯)
// —— 桥=咽喉的几何保证: 跨河路段**只有**跨桥 connector; 探针断言"路网×主河相交段全部落在桥矩形内"。
// 旧版兜底是"直连返回"(违规种子交给探针揪) ⇒ 水乡 19/125 图带跨河路面 (2026-10-07e 实测)。现阶梯
// 末级 growCap 逐步拦河即停 (折线终点=本岸临水点, 巷子通到河边为止) ⇒ 硬约束恒成立, 末端可放旗。
function riverNearPt(x,z){ let b={x:0,z:0,d:1e9};
 for(let i=0;i<riverPts.length-1;i++){
  const r=riverPts[i],abx=riverPts[i+1][0]-r[0],abz=riverPts[i+1][1]-r[1],L2=abx*abx+abz*abz||1e-9;
  const t=Math.max(0,Math.min(1,((x-r[0])*abx+(z-r[1])*abz)/L2));
  const px=r[0]+abx*t,pz=r[1]+abz*t,dd=Math.hypot(x-px,z-pz);
  if(dd<b.d) b={x:px,z:pz,d:dd};
 }
 return b;
}
function segX(p1,p2,p3,p4){
 const d1x=p2[0]-p1[0],d1z=p2[1]-p1[1],d2x=p4[0]-p3[0],d2z=p4[1]-p3[1];
 const den=d1x*d2z-d1z*d2x; if(Math.abs(den)<1e-9) return null;
 const t=((p3[0]-p1[0])*d2z-(p3[1]-p1[1])*d2x)/den;
 const u=((p3[0]-p1[0])*d1z-(p3[1]-p1[1])*d1x)/den;
 if(t<0||t>1||u<0||u>1) return null;
 return [p1[0]+d1x*t,p1[1]+d1z*t];
}
function inBridgeRect(x,z){
 for(const b of waterBridges){
  const px2=Math.sin(b.yaw),pz2=Math.cos(b.yaw);
  const t=(x-b.x)*px2+(z-b.z)*pz2, l=(x-b.x)*(-pz2)+(z-b.z)*px2;
  if(Math.abs(t)<=b.len/2+1.5&&Math.abs(l)<=b.w/2+2) return true;
 }
 return false;
}
function polyCrossRiver(pts){
 for(let i=0;i<pts.length-1;i++)for(let j=0;j<riverPts.length-1;j++){
  const X=segX(pts[i],pts[i+1],riverPts[j],riverPts[j+1]);
  if(X&&!inBridgeRect(X[0],X[1])) return true;
 }
 return false;
}
// 拦河即停折线 (grow 同构; 每步以**取整后**线段判跨河 —— 与 ROADS/探针同口径)
function growCap(ax,az,bx,bz,jit,cls){
 const pts=[[Math.round(ax),Math.round(az)]];
 let x=ax,z=az,g=90;
 while(g-->0){
  const dx=bx-x,dz=bz-z,d=Math.hypot(dx,dz);
  if(d<13){
   const q=[Math.round(bx),Math.round(bz)];
   if(!polyCrossRiver([pts[pts.length-1],q])) pts.push(q);
   break;
  }
  const a=Math.atan2(dz,dx)+pgR(-jit,jit);
  const nx3=x+Math.cos(a)*13, nz3=z+Math.sin(a)*13, q=[Math.round(nx3),Math.round(nz3)];
  if(polyCrossRiver([pts[pts.length-1],q])) break;
  x=nx3; z=nz3; pts.push(q);
 }
 for(let i=0;i<pts.length-1;i++){
  const p=pts[i],q=pts[i+1];
  ROADS.push([p[0],p[1],q[0],q[1]]);
  RH.push([pgNoise(p[0],p[1]),pgNoise(q[0],q[1])]);
 }
 POLYS.push({pts,cls});
 return pts;
}
function growClear(ax,az,bx,bz,jit,cls){
 const mk={r:ROADS.length,h:RH.length,p:POLYS.length};
 const cut=()=>{ ROADS.length=mk.r; RH.length=mk.h; POLYS.length=mk.p; };
 const pts=grow(ax,az,bx,bz,jit,cls);
 if(!polyCrossRiver(pts)) return pts;
 cut();                                                       // 撤线: 经远河 via 点绕行重铺
 const sn=riverNearPt((ax+bx)/2,(az+bz)/2);
 let nx2=(ax+bx)/2-sn.x, nz2=(az+bz)/2-sn.z; const nl=Math.hypot(nx2,nz2)||1; nx2/=nl; nz2/=nl;
 const v1=[Math.round((ax+bx)/2+nx2*pgR(26,40)),Math.round((az+bz)/2+nz2*pgR(26,40))];
 const pA=grow(ax,az,v1[0],v1[1],jit,cls);
 const pB=grow(v1[0],v1[1],bx,bz,jit,cls);
 if(!polyCrossRiver(pA)&&!polyCrossRiver(pB)) return pA.concat(pB.slice(1));
 cut();                                                       // 撤线: 沿本岸绕 (最近河顶点本岸外偏点)
 let vi=0,vd=1e9;
 for(let i=1;i<riverPts.length-1;i++){ const dd=Math.hypot(riverPts[i][0]-(ax+bx)/2,riverPts[i][1]-(az+bz)/2);
  if(dd<vd){ vd=dd; vi=i; } }
 const bk0=bankOf(ax,az), v2=bankPt(vi,bk0===0?CORE_BANK:bk0,ROFF);
 const pC=grow(ax,az,v2[0],v2[1],jit,cls);
 const pD=grow(v2[0],v2[1],bx,bz,jit,cls);
 if(!polyCrossRiver(pC)&&!polyCrossRiver(pD)) return pC.concat(pD.slice(1));
 cut();
 return growCap(ax,az,bx,bz,jit,cls);                         // 末级: 拦河截断 (本岸临水终点)
}
let stAng=0;                                                   // 主村街向 (地标/翼旗消费; farm/town 才赋值)
if(!WATER){
// ── 2L. 聚落路网 (每聚落一条主街 + 支巷; 骨架决定干道/connector 形制) ──────────
// 街向: mono 主村=旧构斜摆 (垂直基轴 ±0.9~1.5rad); dual/linear=骨架轴正法向 ±0.35 (村街横切争夺轴)。
// 主村街长: town 96~124 / farm 62~82 (旧构); 副村街 34~50 (hamlet 身份=短街稀屋)。
const streetAng=()=>(SKELETON==='mono')?(baseAng+pgR(0.9,1.5)*(n32()<0.5?1:-1)):(baseAng+HPI+pgR(-0.35,0.35));
for(let si=0;si<SETTLE.length;si++){
 const s=SETTLE[si];
 const sa=streetAng(); s.stAng=sa; if(si===0) stAng=sa;
 const mainL=s.main?((PG.biome==='town')?pgR(96,124):pgR(62,82)):pgR(34,50);
 const m0={x:s.x-Math.cos(sa)*mainL*0.5, z:s.z-Math.sin(sa)*mainL*0.5};
 const m1={x:s.x+Math.cos(sa)*mainL*0.5, z:s.z+Math.sin(sa)*mainL*0.5};
 const mainA=grow(m0.x,m0.z,s.x,s.z,0.16,'main');
 const mainB=grow(s.x,s.z,m1.x,m1.z,0.16,'main');
 const mainPts=mainA.concat(mainB.slice(1));
 s.mEnds=[m0,m1];
 if(s.main&&PG.biome!=='town'){
  // 农村主村支巷 (旧构): 3 条自街折点比例位放射 42~60m (死胡同进田野)
  const idxs=[0.32,0.55,0.78].map(t=>Math.max(1,Math.min(mainPts.length-2,Math.round(t*(mainPts.length-1)))));
  for(const ix of idxs){
   const [px,pz]=mainPts[ix];
   if(Math.hypot(px-s.x,pz-s.z)<22) continue;                 // 太贴广场: 不留巷
   const la=Math.atan2(pz-s.z,px-s.x)+pgR(-1.3,1.3);
   const L2=pgR(42,60);
   grow(px,pz,px+Math.cos(la)*L2,pz+Math.sin(la)*L2,0.22,'lane');
  }
 }else if(s.main&&PG.biome==='town'){
  // 镇集主村骨架 (2026-10-07e 形制): 远端锚点 → 支巷×3 + 次街×2 (cls='sub' 街区轴)
  const anchors=[], anchors2=[];
  for(const half of [mainA, mainB]){
   const cand=[];
   for(let i=0;i<half.length-1;i++){ const dc=Math.hypot(half[i][0]-s.x,half[i][1]-s.z);
    if(dc>=26) cand.push([half[i][0],half[i][1],dc]); }
   cand.sort((a,b)=>b[2]-a[2]);
   for(const c of cand){ anchors.push(c); if(c[2]>=42) anchors2.push(c); }
  }
  for(let k=0;k<3&&anchors.length;k++){
   const an=anchors[Math.min(k,anchors.length-1)];
   const la=Math.atan2(an[1]-s.z,an[0]-s.x)+pgR(-0.7,0.7);
   const L2=pgR(42,58);
   grow(an[0],an[1],an[0]+Math.cos(la)*L2,an[1]+Math.sin(la)*L2,0.22,'lane');
  }
  {
   const sgnA=n32()<0.5?1:-1;
   for(let k=0;k<2;k++){
    const an=anchors2[Math.min(k,anchors2.length-1)]||anchors[0]; if(!an) break;
    const la=sa+HPI*(k===0?sgnA:-sgnA)+pgR(-0.22,0.22);
    const L2=pgR(46,60);
    grow(an[0],an[1],an[0]+Math.cos(la)*L2,an[1]+Math.sin(la)*L2,0.14,'sub');
   }
  }
 }else{
  // 副村/卫星村支巷: 1~2 条短巷 (26~40m)
  const nLn=pgI(1,2);
  for(let k=0;k<nLn;k++){
   const ix=Math.max(1,Math.min(mainPts.length-2,Math.round(pgR(0.25,0.75)*(mainPts.length-1))));
   const [px,pz]=mainPts[ix];
   const la=Math.atan2(pz-s.z,px-s.x)+pgR(-1.2,1.2);
   const L2=pgR(26,40);
   grow(px,pz,px+Math.cos(la)*L2,pz+Math.sin(la)*L2,0.22,'lane');
  }
 }
}
// 干道形制 (骨架分派): mono=基地→主街两端 (谁近进哪头) + 卫星接巷; dual=各基地→本村街端+村际 connector;
// linear=走廊链 (基地→近端副村→主村→远端副村→基地)。全部自基点出发 (探针口径: 干道起点=基地 ±3m)。
if(SKELETON==='mono'){
 const s=SETTLE[0];
 const d00=Math.hypot(bases[0].x-s.mEnds[0].x,bases[0].z-s.mEnds[0].z), d01=Math.hypot(bases[0].x-s.mEnds[1].x,bases[0].z-s.mEnds[1].z);
 const t0End=(d00<=d01)?s.mEnds[0]:s.mEnds[1], t1End=(d00<=d01)?s.mEnds[1]:s.mEnds[0];
 grow(bases[0].x,bases[0].z,t0End.x,t0End.z,0.3,'trunk0');
 grow(bases[1].x,bases[1].z,t1End.x,t1End.z,0.3,'trunk1');
 // 卫星小村缝合: 接巷到最近路点 (村村相连, 不留孤村)
 for(let k=1;k<SETTLE.length;k++){
  const sn2=SETTLE[k];
  let bp=null,dd=1e9;
  for(const p of POLYS){ if(p.cls==='lane') continue; for(const q of p.pts){
   const d2=Math.hypot(q[0]-sn2.x,q[1]-sn2.z); if(d2<dd){dd=d2;bp=q;} } }
  if(bp) growClear(bp[0],bp[1],sn2.x,sn2.z,0.18,'lane');
 }
}else if(SKELETON==='dual'){
 const s0=SETTLE[0], s1=SETTLE[1];
 const nearEnd=(s,b)=>{ const d0=Math.hypot(b.x-s.mEnds[0].x,b.z-s.mEnds[0].z), d1=Math.hypot(b.x-s.mEnds[1].x,b.z-s.mEnds[1].z);
  return (d0<=d1)?s.mEnds[0]:s.mEnds[1]; };
 const e0=nearEnd(s0,bases[0]), e1=nearEnd(s1,bases[1]);
 grow(bases[0].x,bases[0].z,e0.x,e0.z,0.3,'trunk0');
 grow(bases[1].x,bases[1].z,e1.x,e1.z,0.3,'trunk1');
 growClear(s0.x,s0.z,s1.x,s1.z,0.12,'main');                  // 村际 connector (争夺轴, 贴路旗=中场)
}else{
 // linear: 走廊链 base0→副村+→主村→副村-→base1 (cls='main' 走廊=临街带状地块轴); 干道恒自基地生长 (探针口径)
 const hamP=SETTLE[1], hamN=SETTLE[2];
 grow(bases[0].x,bases[0].z,hamP.x,hamP.z,0.22,'trunk0');
 growClear(hamP.x,hamP.z,core.x,core.z,0.12,'main');
 growClear(core.x,core.z,hamN.x,hamN.z,0.12,'main');
 grow(bases[1].x,bases[1].z,hamN.x,hamN.z,0.22,'trunk1');
}
// 铁路货线 (镇集专属, 2026-10-07e 形制): 过镇缘的近直线折线, 图幅两侧各一出清 —— 跨路口=平交道
if(PG.biome==='town'){
 const ra=pgR(0,6.2832);
 const tx=core.x+Math.cos(ra)*pgR(66,80), tz=core.z+Math.sin(ra)*pgR(66,80);
 const pA=growRail(tx-Math.cos(ra)*pgR(150,175),tz-Math.sin(ra)*pgR(150,175),tx,tz,0.08);
 const pB=growRail(tx,tz,tx+Math.cos(ra)*pgR(150,175),tz+Math.sin(ra)*pgR(150,175),0.08);
 for(const p of pA) RAIL.push(p);
 for(const p of pB.slice(1)) RAIL.push(p);
}
}else{
// ── 2W. 水乡路网: 滨河街(两岸·沿岸线偏移) + 跨桥 connector + 干道 + 支巷 (全部 growClear 防未架桥跨河) ──
// 滨河街**沿岸线偏移**铺 (旧版沿主桥切线直铺: 河湾处街尾滑到对岸/入水 ⇒ 跨河违规第二源, 2026-10-07e 改)。
// streetOf(bank): 主桥前后各 1 段河 (3 顶点 ≈ 90m) 的岸侧偏移点列, 中段顶点=核心/对岸堍 ⇒ 街过桥头 (贴路恒真)。
const stI0=Math.max(1,mbIdx-1), stI1=Math.min(riverPts.length-2,mbIdx+1);
const c1={x:Math.round(MB.x-MBP[0]*ROFF), z:Math.round(MB.z-MBP[1]*ROFF)};   // 对岸桥堍 (=对岸街中段)
const st0Pts=[bankPt(stI0,CORE_BANK,ROFF),[core.x,core.z],bankPt(stI1,CORE_BANK,ROFF)];
const st1Pts=[bankPt(stI0,-CORE_BANK,ROFF),[c1.x,c1.z],bankPt(stI1,-CORE_BANK,ROFF)];
const s0a=growClear(st0Pts[0][0],st0Pts[0][1],core.x,core.z,0.12,'main');
const s0b=growClear(core.x,core.z,st0Pts[2][0],st0Pts[2][1],0.12,'main');
const s1a=growClear(st1Pts[0][0],st1Pts[0][1],c1.x,c1.z,0.12,'main');
const s1b=growClear(c1.x,c1.z,st1Pts[2][0],st1Pts[2][1],0.12,'main');
grow(core.x,core.z,c1.x,c1.z,0.02,'main');                    // 主桥 connector (直, 过 MB; 交点=桥内)
// 干道: 基地→本岸滨河街远端 (两岸各一, 攻方必经桥)
const st0Ends=[st0Pts[0],st0Pts[2]], st1Ends=[st1Pts[0],st1Pts[2]];
const e00=Math.hypot(bases[0].x-st0Ends[0][0],bases[0].z-st0Ends[0][1]), e01=Math.hypot(bases[0].x-st0Ends[1][0],bases[0].z-st0Ends[1][1]);
const e10=Math.hypot(bases[1].x-st1Ends[0][0],bases[1].z-st1Ends[0][1]), e11=Math.hypot(bases[1].x-st1Ends[1][0],bases[1].z-st1Ends[1][1]);
const w0End=(e00<=e01)?st0Ends[0]:st0Ends[1], w1End=(e10<=e11)?st1Ends[0]:st1Ends[1];
growClear(bases[0].x,bases[0].z,w0End[0],w0End[1],0.3,'trunk0');
growClear(bases[1].x,bases[1].z,w1End[0],w1End[1],0.3,'trunk1');
// 水工锚点表 (桥堍/滩头): road 阶段登记的咽喉点 —— 旗点阶段直接消费 (必是路顶点 ⇒ 贴路恒真)
// 支巷: 每岸 2 条自街端沿"离河法向"进田野 (±0.6rad) + 上村巷/下村巷各 1 条近直伸 30~48m
{
 for(let b2=0;b2<2;b2++){
  const bank=(b2===0)?CORE_BANK:-CORE_BANK;
  const pts=(b2===0)?st0Pts:st1Pts, vIx=[stI0,stI1];
  for(let k=0;k<2;k++){
   const E=pts[k===0?0:2], nm=bankNrm(vIx[k],bank);
   const la=Math.atan2(nm[1],nm[0])+pgR(-0.6,0.6);
   const L2=pgR(42,58);
   growClear(E[0],E[1],E[0]+Math.cos(la)*L2,E[1]+Math.sin(la)*L2,0.2,'lane');
  }
  const eIx=n32()<0.5?0:1, E2=pts[eIx===0?0:2], nm2=bankNrm(vIx[eIx],bank);
  const la2=Math.atan2(nm2[1],nm2[0])+pgR(-0.22,0.22);
  const L3=pgR(30,48);
  growClear(E2[0],E2[1],E2[0]+Math.cos(la2)*L3,E2[1]+Math.sin(la2)*L3,0.14,'lane');
 }
}
// 二/三桥 connector: 每座非主桥两岸桥堍 ↔ 本岸街点 (桥=咽喉, 桥堍必接路; 端点登记水工锚)
for(let bi=1;bi<waterBridges.length;bi++){
 const b=waterBridges[bi], vi2=b._vi;
 for(let kb=0;kb<2;kb++){
  const bank=(kb===0)?CORE_BANK:-CORE_BANK;
  const nm=bankNrm(vi2,bank);
  const ab=[Math.round(b.x+nm[0]*(b.len/2+2)), Math.round(b.z+nm[1]*(b.len/2+2))];
  const list=(bank===CORE_BANK)?st0Pts:st1Pts;
  let bp2=null,dd=1e9;
  for(const p of list){ const d2=Math.hypot(p[0]-ab[0],p[1]-ab[1]); if(d2<dd){dd=d2;bp2=p;} }
  if(bp2){
   const pk=growClear(bp2[0],bp2[1],ab[0],ab[1],0.05,'lane');
   if(pk.length>1) WATERWORKS.push({id:'二桥',x:pk[pk.length-1][0],z:pk[pk.length-1][1]});
  }
 }
}
// 渡口接巷: 徒涉滩本岸滩头 ↔ 本岸最近路顶点 (滩=咽喉; 有滩才铺)
if(fordSite){
 const nm=bankNrm(fordIdx,CORE_BANK);
 const ft=[Math.round(fordSite.x+nm[0]*(RIVW+9)), Math.round(fordSite.z+nm[1]*(RIVW+9))];
 let bp2=null,dd=1e9;
 for(const p of POLYS){ for(const q of p.pts){ if(bankOf(q[0],q[1])!==CORE_BANK) continue;
  const d2=Math.hypot(q[0]-ft[0],q[1]-ft[1]); if(d2<dd){dd=d2;bp2=q;} } }
 if(bp2&&dd<95){
  const pk=growClear(bp2[0],bp2[1],ft[0],ft[1],0.12,'lane');
  if(pk.length>1) WATERWORKS.push({id:'渡口',x:pk[pk.length-1][0],z:pk[pk.length-1][1]});
 }
}
}
// ── 2.5 压平高度场 pgH (v2): 噪声 + 沿路/聚落/旗圈压平 —— 00c 与 03-terrain 单源 ──
// Minecraft 村庄地基思路: 路面 6m 内全平=路面高, 6~18m 平滑过渡; 主村广场 12m 内全平 / 副村 8m;
// 旗圈 r-3 内全平。建筑/旗/沙袋都落在压平带里, placeAt 只兜 ≤1.7m 残差。
// (水乡主河/支汊/鱼塘下切**不在本层** —— 03-terrain procgen 分支在采样后按语义表解析下切, 桥面再抬升。)
function pgH1(x,z){
 let h=pgNoise(x,z);
 let bd=1e9,bh=0;
 for(let i=0;i<ROADS.length;i++){
  const r=ROADS[i],hh=RH[i];
  const abx=r[2]-r[0],abz=r[3]-r[1],L2=abx*abx+abz*abz||1e-9;
  const t=Math.max(0,Math.min(1,((x-r[0])*abx+(z-r[1])*abz)/L2));
  const dd=Math.hypot(x-(r[0]+abx*t),z-(r[1]+abz*t));
  if(dd<bd){ bd=dd; bh=hh[0]+(hh[1]-hh[0])*t; }
 }
 if(bd<18) h+= (bh-h)*(1-sst((bd-6)/12));
 for(const s of SETTLE){
  const dc=Math.hypot(x-s.x,z-s.z);
  const inn=s.main?12:8, out=s.main?14:10;
  if(dc<inn+out) h+= (pgNoise(s.x,s.z)-h)*(1-sst((dc-inn)/out));
 }
 return h;
}
function pgH(x,z){
 let h=pgH1(x,z);
 for(let i=0;i<flags.length;i++){ const f=flags[i];
  const df=Math.hypot(x-f.x,z-f.z);
  if(df<f.r+7) h+= (pgH1(f.x,f.z)-h)*(1-sst((df-(f.r-3))/10));
 }
 return h;
}

// ── 3. 旗点 (骨架×群系布局族) ────────────────────────────────────────────────
// mono farm (wing): 广场(核心) + 两翼四旗极坐标散布 (旧构; 小档减一翼/大档加田庄)。
// mono town: 广场(集市) + 次街端×2 + 站前(货线缘) (旧构)。
// dual: 广场(本村) + 村口(对村) + 中场(connector 中段) + 翼旗 (两村外侧, 量随档)。
// linear: 广场(主村) + 村口×2(走廊两端副村) + 走廊旗 (中段侧摆, 两两 ≥52 几何解) + 量随档。
// water: 桥头(核心) + 二桥 + 上村 + 渡口 —— 全部取路网折点 (贴路恒真) + 打分选位 (旧构)。
// 落点吸附最近路面 (≤26m); 吸不到就从最近路点接一条短巷进旗 (growClear 追加 ROADS/POLYS ⇒ §4 地块
// 沿巷生长) —— 村庄逻辑: 旗点必有路可达; 战斗逻辑: 旗不与广场共线成链 (两两 ≥52 硬约束)。
const flags=[{id:'广场',x:core.x,z:core.z,r:WATER?13:14}];
// 副村旗直推 (聚落心=街中点 ⇒ 贴路 0m; 与广场同理不走 flagOK —— 聚落净空本身就是它的地盘)
if(!WATER&&(SKELETON==='dual'||SKELETON==='linear')){
 for(let k=1;k<SETTLE.length;k++){
  const s=SETTLE[k];
  flags.push({id:'村口',x:s.x,z:s.z,r:12});
 }
}
// 地标 (优先占位, 晚于旗点先于普通地块):
const lots=[];
const taken=[];   // {x,z,r} 占位圆 (互斥 + 各类净空)
function canTake(x,z,r){
 if(Math.abs(x)>B_IN||Math.abs(z)>B_IN) return false;
 for(const s of SETTLE) if(Math.hypot(x-s.x,z-s.z)<(s.main?19:14)) return false;  // 聚落广场净空
 // 基地营区净空 (2026-10-28 修复, 指导 §4.5): 单队生存主基地=守点旁 8m (§2 裁定), 30m 圆会把整个
 // 村庄核心广场的钟楼/民居/围墙一并驱逐成不毛荒地 —— solo 收窄到 12m (仍罩住出生点/弹药箱 ±3m
 // 与部署站位), 广场肌理得以保留, 成"被围困的中心聚落"。双队/普通模式 30m 不变。
 for(const b of bases) if(Math.hypot(x-b.x,z-b.z)<((typeof ZOMBIE_MODE!=='undefined'&&ZOMBIE_MODE==='solo')?12:30)) return false;
 for(const f of flags) if(Math.hypot(x-f.x,z-f.z)<f.r+4.5) return false;  // 旗圈净空
 for(const t of taken) if(Math.hypot(x-t.x,z-t.z)<r+t.r) return false;
 if(roadDistTo(x,z)<6) return false;                                     // 不压路面/路口
 if(WATER&&rivDist(x,z)<RIVW+0.5) return false;                          // 贴水限位 (水乡滨河特色, 地基门兜底)
 if(WATER&&chanDist(x,z)<7.5) return false;
 if(WATER&&pondDist(x,z)<3) return false;
 if(railDist(x,z)<8) return false;                                       // 不压铁路货线
 // 地基坡度门 (v2 丘陵地形): 四角压平后高差 >2.2m 不建 —— 建筑避陡坡, 布局自然不规则
 {
  const h0=pgH(x-r,z-r),h1=pgH(x+r,z-r),h2=pgH(x-r,z+r),h3=pgH(x+r,z+r);
  if(Math.max(h0,h1,h2,h3)-Math.min(h0,h1,h2,h3)>2.2) return false;
 }
 return true;
}
function addLot(x,z,ry,kind,front){
 const TBL={house:[7,6,5.6],house2:[9,7,6.2],cabin:[6,5,4.9],twostory:[8,9,6.4],barn:[9,13,8],factory:[18,12,10.6],church:[10,16,9.4],tower:[4.5,4.5,3.5],mill:[8,8,5.7]};
 const t=TBL[kind]; if(!t) return false;
 if(!canTake(x,z,t[2])) return false;
 taken.push({x,z,r:t[2]});
 lots.push({x:Math.round(x*10)/10,z:Math.round(z*10)/10,ry:Math.round(ry*100)/100,w:t[0],d:t[1],kind,
  fx:front?Math.round(front.fx*100)/100:0, fz:front?Math.round(front.fz*100)/100:0, sa:front?Math.round(front.sa*100)/100:0});
 return true;
}
// 地标随机缺席 (2026-10-24 裁定"地标应当随机缺席"): 主村教堂/碉楼 75% · 欧主村风车 55% · 副村小地标 35%。
// 缺席=不摆 (无替代桩) —— 每张图地标组合不同, 打破"教堂+风车+厂三件套必在"的背板。
// 落位多角度重试: dual/linear 主街⊥骨架轴 ⇒ 地标默认向 (+街法向=沿走廊) 会贴 connector (<6m 拒);
// 旋转扇扫 0/±0.6/±1.2/π 直到 canTake 过门 (mono 单发命中 68% 的教训, 2026-10-24 实测)。
if(!WATER){
 for(const s of SETTLE){
  const pa=(s.stAng||stAng)+Math.PI/2;
  if(s.main){
   if(n32()<0.75){
    for(const da of [0,0.6,-0.6,1.2,-1.2,Math.PI]){
     const dd=pgR(20,26);
     if(addLot(s.x+Math.cos(pa+da)*dd, s.z+Math.sin(pa+da)*dd, pa+da, TH==='china'?'tower':BIO.landmark.green)) break;
    }
   }
   if(TH!=='china'&&BIO.landmark.extraGreen&&n32()<0.55){
    const ma=pgR(0,6.2832), md=pgR(86,106);
    if(!addLot(s.x+Math.cos(ma)*md, s.z+Math.sin(ma)*md, ma, BIO.landmark.extraGreen))
     addLot(s.x+Math.cos(ma+2.1)*md, s.z+Math.sin(ma+2.1)*md, ma+2.1, BIO.landmark.extraGreen);
   }
  }else if(n32()<0.35){
   for(const da of [0,0.7,-0.7,1.4,-1.4,Math.PI]){
    const dd=pgR(16,22);
    if(addLot(s.x+Math.cos(pa+da)*dd, s.z+Math.sin(pa+da)*dd, pa+da, TH==='china'?'tower':'mill')) break;
   }
  }
 }
 if(PG.biome==='town'){
  // 货栈 (城郊): 铁路货线中段旁 12~16m, 10 次候选取位 (中式=茧厂厂房 / 欧式=大谷仓仓库)
  if(RAIL.length>2){
   const rm=RAIL[Math.floor(RAIL.length/2)];
   for(let i=0;i<10;i++){
    const la=pgR(0,6.2832);
    if(addLot(rm[0]+Math.cos(la)*pgR(13,17), rm[1]+Math.sin(la)*pgR(13,17), la+HPI, TH==='china'?'factory':'barn')) break;
   }
  }
 }
}else{
 const ta=Math.atan2(MBT[1],MBT[0]);
 addLot(core.x+Math.cos(ta)*pgR(18,24), core.z+Math.sin(ta)*pgR(18,24), ta, BIO.landmark.china);
 {  // 临河丝厂: 主桥下游河湾岸侧 (10 次候选: 顶点步进 + 两岸交替)
  const dir=(mbIdx+2<=riverPts.length-2)?1:-1;
  for(let i=0;i<10;i++){
   const vi=Math.min(riverPts.length-2,Math.max(1,mbIdx+dir*(1+(i>>1))));
   const P=riverPts[vi];
   const la=Math.atan2(P[1]-riverPts[vi-1][1],P[0]-riverPts[vi-1][0])+(i%2?1:-1)*HPI;
   if(addLot(P[0]+Math.cos(la)*pgR(10,13), P[1]+Math.sin(la)*pgR(10,13), la+HPI, 'factory')) break;
  }
 }
}
function pushFlag(id,x,z,own){ const f={id,x:Math.round(x),z:Math.round(z),r:13}; if(own===0||own===1) f.own=own; flags.push(f); }
// 广场纵深 (farm 翼族=74 / 紧凑族=56; 随档缩放, 下限 0.8) —— 副村清界: dual=同值·76% / linear=40 带缩放
const CORECLR=((BIO.flagFam==='wing')?74:56)*Math.max(0.8,SK);
function flagOK(x,z){
 if(Math.abs(x)>B_IN||Math.abs(z)>B_IN) return false;                      // 场内 (网格覆盖 ±HALF)
 for(const b of bases) if(Math.hypot(x-b.x,z-b.z)<45) return false;      // 不进基地营区 (+1m 取整裕量)
 for(const s of SETTLE){                                                  // 聚落广场留纵深
  // mono/dual 主村=全值 CORECLR (翼旗/中场需要纵深); linear 主村=46 带缩放 (走廊旗在中段, 清界过宽会全灭)
  const clr=s.main
   ?((SKELETON==='linear')?Math.max(36,46*Math.max(0.8,SK)):CORECLR)
   :((SKELETON==='dual')?CORECLR*0.76:Math.max(28,34*Math.max(0.8,SK)));
  if(Math.hypot(x-s.x,z-s.z)<clr) return false;
 }
 for(const f of flags) if(Math.hypot(x-f.x,z-f.z)<54) return false;      // 两两间距 (探针口径 ≥52)
 for(const tk of taken) if(Math.hypot(x-tk.x,z-tk.z)<tk.r+13) return false; // 不压地标
 if(WATER&&rivDist(x,z)<RIVW+5) return false;                            // 旗不在河里/滩心 (岸缘旗=桥头/渡口感)
 if(WATER&&chanDist(x,z)<8) return false;
 if(WATER&&pondDist(x,z)<4) return false;
 if(railDist(x,z)<10) return false;                                      // 不站台面上
 return true;
}
function roadNear(fx,fz){                                    // 最近路面点 {x,z,d}
 let b={x:fx,z:fz,d:1e9};
 for(let i=0;i<ROADS.length;i++){ const r=ROADS[i];
  const abx=r[2]-r[0],abz=r[3]-r[1],L2=abx*abx+abz*abz||1e-9;
  const t=Math.max(0,Math.min(1,((fx-r[0])*abx+(fz-r[1])*abz)/L2));
  const px=r[0]+abx*t,pz=r[1]+abz*t,dd=Math.hypot(fx-px,fz-pz);
  if(dd<b.d) b={x:px,z:pz,d:dd};
 }
 return b;
}
function tryFlagAt(ax,az,id,own,ang,dist){
 const fx=ax+Math.cos(ang)*dist, fz=az+Math.sin(ang)*dist;
 if(!flagOK(fx,fz)) return false;
 const sn=roadNear(fx,fz);
 if(sn.d<=26){                                              // 有路: 吸附到路面
  if(!flagOK(sn.x,sn.z)) return false;                      // 吸附不得撞进既有旗距/地标
  pushFlag(id,sn.x,sn.z,own); return true;
 }
 if(sn.d>58) return false;                                  // 路网太远: 村子不往野地里伸, 换落点
 const mx=(sn.x+fx)/2,mz=(sn.z+fz)/2;                       // 接巷: 巷中点避开地标再动工
 for(const tk of taken) if(Math.hypot(mx-tk.x,mz-tk.z)<tk.r+9) return false;
 growClear(sn.x,sn.z,fx,fz,0.16,'lane');                    // 接巷走 growClear (水乡防未架桥跨河; farm 等价 grow)
 pushFlag(id,fx,fz,own); return true;
}
function tryFlag(id,own,ang,dist){ return tryFlagAt(core.x,core.z,id,own,ang,dist); }
function wingFlagAt(ax,az,id,own,ang0,sgn,aMin,aMax,dMin,dMax){
 for(let i=0;i<18;i++){ if(tryFlagAt(ax,az,id,own,ang0+sgn*pgR(aMin,aMax),pgR(dMin,dMax))) return; }
 for(const dd of [0,-16,-32]){ if(tryFlagAt(ax,az,id,own,ang0+sgn*aMax*1.15,dMin+dd)) return; }  // 兜底: 仍贴路
}
function wingFlag(id,own,ang0,sgn,aMin,aMax,dMin,dMax){
 wingFlagAt(core.x,core.z,id,own,ang0,sgn,aMin,aMax,dMin,dMax);
}
if(BIO.flagFam==='wing'&&SKELETON==='mono'){
 const aA=Math.atan2(bases[0].z-core.z,bases[0].x-core.x);
 const sA=n32()<0.5?1:-1, sB=n32()<0.5?1:-1;                 // 两侧错位方向独立
 wingFlag('前哨甲',0,aA,sA,0.38,0.62,74*WSC,94*WSC);
 wingFlag('前哨乙',1,aA+Math.PI,sB,0.38,0.62,74*WSC,94*WSC);
 if(SZ>300) wingFlag('村巷甲',undefined,aA,-sA,0.9,1.25,66*WSC,88*WSC);   // 小档减一翼 (4 旗口径)
 wingFlag('村巷乙',undefined,aA+Math.PI,-sB,0.9,1.25,66*WSC,88*WSC);
 if(SZ>=480){                                                // 大档田庄旗 (正交象限, 远弧)
  const q=(n32()<0.5?1:-1);
  wingFlag('田庄',undefined,aA+HPI*q,q,0.55,1.0,96*WSC,120*WSC);
 }
}else if(PG.biome==='town'&&SKELETON==='mono'){
 // 东街/西街: 次街折线 (cls='sub') —— ① 街端外延 20/30m 接巷 (更远且避地标) → ② 街内端点回溯首个合法路顶点
 // (路顶点=旗位 ⇒ 贴路 0m; 旧版仅"端点+吸附"遇地标/广场净空即丢旗: 实测 105 图 21 图缺街旗)
 const subs=POLYS.filter(p=>p.cls==='sub');
 for(let k=0;k<2;k++){
  const id=(k===0)?'东街':'西街', sp=subs[k]; if(!sp) continue;
  const n=sp.pts.length, a=sp.pts[n-2], b=sp.pts[n-1];
  const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz)||1;
  let ok=false;
  for(const ex of [30,20]){
   const fx=Math.round(b[0]+dx/L*ex), fz=Math.round(b[1]+dz/L*ex);
   if(!flagOK(fx,fz)) continue;
   const mx=(b[0]+fx)/2,mz=(b[1]+fz)/2;
   let bad=false; for(const tk of taken) if(Math.hypot(mx-tk.x,mz-tk.z)<tk.r+9){ bad=true; break; }
   if(bad) continue;
   grow(b[0],b[1],fx,fz,0.1,'lane'); pushFlag(id,fx,fz); ok=true; break;
  }
  if(!ok) for(let i=n-1;i>=1;i--){ const p=sp.pts[i];
   if(flagOK(p[0],p[1])){ pushFlag(id,p[0],p[1]); ok=true; break; } }
 }
 // 站前: 货线侧 (锚点 ±8 顶点窗口 × 两侧法向 ×2 半径, 先筛广场净空, 取与既有旗间距最大者) —— 巷端=旗位
 // (旧版随机角抽样: 货栈地标/广场净空/台面三面夹击 ⇒ 实测仅 48% 成旗; 改**确定序候选打分**)
 if(RAIL.length>3){
  const rmid=Math.floor(RAIL.length/2), cands=[];
  for(let k=-14;k<=14;k++){
   const ix=rmid+k; if(ix<1||ix>RAIL.length-2) continue;
   const rm=RAIL[ix], a2=RAIL[ix-1], b2=RAIL[ix+1];
   let tx2=b2[0]-a2[0], tz2=b2[1]-a2[1]; const tl2=Math.hypot(tx2,tz2)||1; tx2/=tl2; tz2/=tl2;
   for(const sd of [1,-1]) for(const rr of [15,19,23]){
    const fx=Math.round(rm[0]-tz2*sd*rr), fz=Math.round(rm[1]+tx2*sd*rr);
    if(Math.hypot(fx-core.x,fz-core.z)<CORECLR) continue;     // 广场净空 (预筛, 免 flagOK 噪声)
    cands.push([fx,fz]);
   }
  }
  let best=null,bs=-1e9,bsn=null;
  for(const c of cands){
   if(!flagOK(c[0],c[1])) continue;
   const sn=roadNear(c[0],c[1]); if(sn.d>90) continue;        // 货线太远: 接巷过长, 弃
   if(sn.d>3){ const mx=(sn.x+c[0])/2,mz=(sn.z+c[1])/2;
    let bad=false; for(const tk of taken) if(Math.hypot(mx-tk.x,mz-tk.z)<tk.r+9){ bad=true; break; }
    if(bad) continue; }
   let m=1e9; for(const f of flags){ const d2=Math.hypot(c[0]-f.x,c[1]-f.z); if(d2<m)m=d2; }
   if(m>bs){ bs=m; best=c; bsn=sn; }
  }
  if(best){
   if(bsn.d>3) grow(bsn.x,bsn.z,best[0],best[1],0.12,'lane');
   pushFlag('站前',best[0],best[1]);
  }
  if(SZ>=480){                                                // 大档镇集加田庄翼 (旗数 5 口径)
   const q=(n32()<0.5?1:-1);
   wingFlag('田庄',undefined,stAng+HPI*q,q,0.45,0.9,72*WSC,100*WSC);
  }
 }
}else if(SKELETON==='dual'){
 // 基础三旗 (广场/村口已直推) + 中场 (connector 中段侧摆) + 翼旗 (两村外侧, 随档 1~3)
 const aA=baseAng;
 // 侧摆下界双门: 两两 ≥52 间距 **且** ≥主村清界 (只保间距在 300 档会让中场全灭 —— 清界 59>57)
 const latNeed=(half)=>{ const clr=(SKELETON==='linear')?Math.max(36,46*Math.max(0.8,SK)):CORECLR;
  return Math.max(Math.sqrt(Math.max(100,52*52-half*half)), Math.sqrt(Math.max(0,clr*clr-half*half))); };
 const nW=(SZ>=480)?3:(SZ>=380)?2:1;
 const midFlag=()=>{                                        // connector 中点侧摆 (双门几何解; 距离×两侧 4 试防铁路夹杀)
  const s1=SETTLE[1];
  const mx=(core.x+s1.x)/2, mz=(core.z+s1.z)/2;
  const ax=s1.x-core.x, az=s1.z-core.z, al=Math.hypot(ax,az)||1;
  const nx=-az/al, nz=ax/al;
  const off=latNeed(al/2)+pgR(6,16), sgn=(n32()<0.5?1:-1);
  for(const extra of [0,12]) for(const s2 of [sgn,-sgn])
   if(tryFlagAt(mx,mz,'中场',undefined,Math.atan2(nz*s2,nx*s2),off+extra)) return;
 };
 midFlag();
 // 翼旗: 大中图向基地方向前摆 (前哨语义); 小图 (300) 该带被 基地净空44×广场清界59 夹死 → 转侧摆
 const wb=(SZ===300)?0.9:0, wd0=(SZ===300)?58:Math.max(58,60*WSC), wd1=(SZ===300)?74:Math.max(74,84*WSC);
 const wings=[
  ()=>{const sg=(n32()<0.5?1:-1); wingFlagAt(core.x,core.z,'前哨甲',0,aA+sg*wb,sg,0.38,0.62,wd0,wd1);},
  ()=>{const sg=(n32()<0.5?1:-1); wingFlagAt(SETTLE[1].x,SETTLE[1].z,'前哨乙',1,aA+Math.PI+sg*wb,sg,0.38,0.62,wd0,wd1);},
  ()=>{ const q=(n32()<0.5?1:-1); wingFlagAt(core.x,core.z,'田庄',undefined,aA+HPI*q,q,0.55,1.0,88*WSC,116*WSC); }
 ];
 for(let k=0;k<nW&&k<wings.length;k++) wings[k]();
}else if(SKELETON==='linear'){
 // 基础三旗 (广场+村口×2 已直推) + 走廊旗 (主村↔副村中段侧摆) + 随档第 2 走廊旗/田庄
 const latNeed=(half)=>{ const clr=Math.max(36,46*Math.max(0.8,SK));
  return Math.max(Math.sqrt(Math.max(100,52*52-half*half)), Math.sqrt(Math.max(0,clr*clr-half*half))); };
 const corridorFlag=(ham,id)=>{                              // 中点+垂直侧摆: 间距/清界双门几何解, 两侧翻转重试
  const mx=(core.x+ham.x)/2, mz=(core.z+ham.z)/2;
  const ax=ham.x-core.x, az=ham.z-core.z, al=Math.hypot(ax,az)||1;
  const nx=-az/al, nz=ax/al;
  const off=latNeed(al/2)+pgR(6,16), sgn=(n32()<0.5?1:-1);
  if(tryFlagAt(mx,mz,id,undefined,Math.atan2(nz*sgn,nx*sgn),off)) return true;
  return tryFlagAt(mx,mz,id,undefined,Math.atan2(-nz*sgn,-nx*sgn),off);
 };
 const nW=(SZ>=480)?3:(SZ>=380)?2:1;
 if(nW>=1) corridorFlag(SETTLE[1],'路口');
 if(nW>=2) corridorFlag(SETTLE[2],'道口');
 if(nW>=3){ const hq=(n32()<0.5)?1:2, hs=SETTLE[hq];        // 田庄锚副村 (路网密处, 不进野地)
  wingFlagAt(hs.x,hs.z,'田庄',undefined,baseAng,(hq===1?1:-1),0.45,0.85,40*WSC,62*WSC); }
}else if(WATER){
 // 桥头旗=核心 (主桥头堍=广场位); 对岸/二桥/上村/渡口 —— 全部取**路网折点** (贴路 0m 恒真) + 打分选位。
 // 旧版极坐标抽样+吸附/接巷 (74~95m 半径带): 半数方向落水/被广场净空拒 ⇒ 实测 63% 的图只有 2 旗 (2026-10-07e 改)。
 const vertsOf=bank=>{ const o=[];
  for(const p of POLYS){ for(const q of p.pts){ if(bankOf(q[0],q[1])===bank) o.push(q); } } return o; };
 const minToFlags=(x,z)=>{ let m=1e9; for(const f of flags){ const d2=Math.hypot(x-f.x,z-f.z); if(d2<m)m=d2; } return m; };
 const pickFlag=(id,cands,score)=>{ let b=null,bs=-1e9;
  for(const c of cands){ if(!flagOK(c[0],c[1])) continue; const s=score(c); if(s>bs){bs=s;b=c;} }
  if(!b) return false; pushFlag(id,b[0],b[1]); return true; };
 // ① 咽喉旗 (二桥/渡口): 水工锚点 (road 阶段登记, 必是路端点; 两岸/多桥同 id 合并取最优)
 const byId={};
 for(const wk of WATERWORKS){ (byId[wk.id]=byId[wk.id]||[]).push([wk.x,wk.z]); }
 for(const id of ['二桥','渡口']) if(byId[id]) pickFlag(id,byId[id],c=>minToFlags(c[0],c[1]));
 // ② 对岸/上村: 各自岸的路折点, 目标环距 74~94m (对峙轴两端), 兼顾与既有旗的间距
 pickFlag('对岸',vertsOf(-CORE_BANK),c=>{ const dc=Math.hypot(c[0]-core.x,c[1]-core.z);
  return minToFlags(c[0],c[1])-0.5*Math.abs(dc-84*WSC); });
 pickFlag('上村',vertsOf(CORE_BANK),c=>{ const dc=Math.hypot(c[0]-core.x,c[1]-core.z);
  return minToFlags(c[0],c[1])-0.5*Math.abs(dc-84*WSC); });
}
// 卫星村舍簇 (v2, 裁定4"布局公式化"; v3 加密): 旗点=簇心 —— farm 村巷旗环 3~5 栋/前哨 2~3 栋;
// town 旗环 3~5 栋 (镇集密度档) / water 2~4 栋 (径向 16~21m 避旗圈净空, 朝旗摆, canTake 双门)
for(const f of flags){
 if(f.id==='广场') continue;
 const n=(BIO.flagFam==='wing')?((f.id.indexOf('村巷')===0||f.id==='村口'||f.id==='田庄')?pgI(3,5):pgI(2,3)):(PG.biome==='town'?pgI(3,5):pgI(2,4));
 for(let k=0,made=0;k<n*3&&made<n;k++){
  const ha=pgR(0,6.2832), hd=pgR(16,21);
  const hx=f.x+Math.cos(ha)*hd, hz=f.z+Math.sin(ha)*hd;
  const kind=pgPick(TH==='china'?BIO.pool.cluster.china:BIO.pool.cluster.green);
  if(addLot(hx,hz,Math.atan2(f.x-hx,f.z-hz),kind)) made++;
 }
}
// ── 4. 地块: 沿主街/干道/支巷带状分块 (等距采样 + 侧向外扩, 朝路摆放) ──────────
// 密度出自群系档 (farm=基线字面量): town 密档 (城郊排屋贴街); water 走专属滨河采样。
// distC=到最近聚落距离 (多聚落口径: 每个村都有自己的 core/mid/edge 带)。
function lotKind(distC,cls){
 if(cls==='lane') return distC<92?pgPick(BIO.pool.lane):null;
 if(distC<36) return pgPick(TH==='china'?BIO.pool.core.china:BIO.pool.core.green);
 if(distC<80) return pgPick(TH==='china'?BIO.pool.mid.china:BIO.pool.mid.green);
 return pgPick(TH==='china'?BIO.pool.edge.china:BIO.pool.edge.green);   // 村缘 (干道外段)
}
let factoryPlaced=!BIO.landmark.facTrunk||(n32()>=0.65);       // 厂随机缺席 35% (2026-10-24 裁定)
if(!WATER) for(const ln of POLYS){
 if(ln.cls==='lane'&&n32()<(PG.biome==='town'?0.15:0.3)) continue;   // 部分村巷无建筑 (田野口)
 for(let i=0;i<ln.pts.length-1;i++){
  const a=ln.pts[i], b=ln.pts[i+1];
  const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz); if(L<6) continue;
  const ux=dx/L,uz=dz/L;
  let s=pgR(4,7);
  while(s<L-5){
   // 建造概率: farm 逐位基线 / town 密档 / 次街=排屋档 (恒建)
   const pr=(ln.cls==='sub')?1:(ln.cls==='main'?1:((ln.cls==='trunk0'||ln.cls==='trunk1')?(PG.biome==='town'?0.9:0.85):(PG.biome==='town'?0.88:0.78)));
   if(n32()<pr){
    const side=n32()<0.5?-1:1, off=pgR(7.5,10);
    const cx=a[0]+ux*s-uz*side*off, cz=a[1]+uz*s+ux*side*off;
    let distC=1e9; for(const st of SETTLE){ const dd=Math.hypot(cx-st.x,cz-st.z); if(dd<distC)distC=dd; }
    const ry=Math.atan2(-uz,ux);                            // 面宽 (局部X) 顺路向 = 临街立面
    const front={fx:uz*side,fz:-ux*side,sa:Math.atan2(uz,ux)};   // lot→路向 + 街向 (05c 临街围栏用)
    if(BIO.landmark.facTrunk&&!factoryPlaced&&(ln.cls==='trunk0'||ln.cls==='trunk1')&&distC>72&&n32()<0.55){
     if(addLot(cx,cz,ry,'factory',front)){ factoryPlaced=true; s+=22; continue; }
    }
    const kind=lotKind(distC,ln.cls);
    if(kind&&addLot(cx,cz,ry,kind,front)&&n32()<0.5){
     // 院落进深 (v2): 同侧再落一栋小屋 ⇒ L 形院落, 破"等距排排站" (v3 概率 0.35→0.5)
     const qx=cx-uz*side*pgR(6.5,8.5), qz=cz+ux*side*pgR(6.5,8.5);
     addLot(qx,qz,ry+pgR(-0.35,0.35),pgPick(BIO.pool.court));
    }
   }
   // 步距: farm 基线 / town 密档 / 次街=排屋档 (再收紧) —— 镇集身份 = 贴街连排
   s+=PG.biome==='town'?(ln.cls==='sub'?pgR(5.0,6.6):pgR(5.8,8.8)):pgR(6.5,10.5);
  }
 }
}
if(WATER) for(const ln of POLYS){
 // 水乡滨河带: 同款采样, 退距更贴街 (7~9.5); 贴水侧被 canTake 挡下 ⇒ 自然形成"陆侧排屋+临水面"
 if(ln.cls==='lane'&&n32()<0.25) continue;
 for(let i=0;i<ln.pts.length-1;i++){
  const a=ln.pts[i], b=ln.pts[i+1];
  const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz); if(L<6) continue;
  const ux=dx/L,uz=dz/L;
  let s=pgR(4,7);
  while(s<L-5){
   if(n32()<(ln.cls==='main'?0.9:0.82)){
    const side=n32()<0.5?-1:1, off=pgR(7,9.5);
    const cx=a[0]+ux*s-uz*side*off, cz=a[1]+uz*s+ux*side*off;
    const distC=Math.hypot(cx-core.x,cz-core.z);
    const ry=Math.atan2(-uz,ux);
    const front={fx:uz*side,fz:-ux*side,sa:Math.atan2(uz,ux)};
    const kind=lotKind(distC,ln.cls);
    if(kind&&addLot(cx,cz,ry,kind,front)&&n32()<0.5){
     const qx=cx-uz*side*pgR(6.5,8.5), qz=cz+ux*side*pgR(6.5,8.5);
     addLot(qx,qz,ry+pgR(-0.35,0.35),pgPick(BIO.pool.court));
    }
   }
   s+=pgR(7,10.5);
  }
 }
}
// 散居农舍 (v2, Minecraft feature scatter): 离路独立小屋/谷仓 —— canTake 全门 (坡度/净空/旗圈/互斥/水)
// 目标数: farm 6~9 / water 4~7 / town 5~8 (镇集=最密); 采样域随档 (B_FD)
// ★目标数内联在循环条件里 (基线纪律): 逐迭代重抽是随机流的一部分, 不得提出循环外
for(let i=0,made=0;i<40&&made<(BIO.flagFam==='wing'?pgI(6,9):(WATER?pgI(4,7):pgI(5,8)));i++){
 const a=pgR(0,6.2832), dd=pgR(52,Math.max(62,B_FD));
 const x=core.x+Math.cos(a)*dd, z=core.z+Math.sin(a)*dd;
 if(addLot(x,z,pgR(0,6.2832),pgPick(BIO.pool.scatter))) made++;
}
// ── 4W. 水乡鱼塘 (岸域圆塘; 避路/旗/基地/地标/河汊/互叠) ─────────────────────
if(WATER){
 const nP=pgI(2,4);
 for(let i=0,made=0;i<24&&made<nP;i++){
  const a=pgR(0,6.2832), dd=pgR(30,110);
  const x=core.x+Math.cos(a)*dd, z=core.z+Math.sin(a)*dd;
  const r=pgR(8,13);
  if(Math.abs(x)>HALF-22||Math.abs(z)>HALF-22) continue;
  if(roadDistTo(x,z)<12) continue;
  if(rivDist(x,z)<RIVW+8||chanDist(x,z)<6) continue;
  if(Math.hypot(x-bases[0].x,z-bases[0].z)<34||Math.hypot(x-bases[1].x,z-bases[1].z)<34) continue;
  let ok=true;
  for(const f of flags) if(Math.hypot(x-f.x,z-f.z)<24) ok=false;
  for(const s of SETTLE) if(Math.hypot(x-s.x,z-s.z)<s.r+14) ok=false;
  for(const t of taken) if(Math.hypot(x-t.x,z-t.z)<t.r+r+2) ok=false;
  for(const pd of ponds) if(Math.hypot(x-pd.x,z-pd.z)<r+pd.r+8) ok=false;
  if(!ok) continue;
  ponds.push({x:Math.round(x),z:Math.round(z),r:Math.round(r),t:n32()<0.4?'lotus':'fish'});
  made++;
 }
}
// ── 5. 农田/林地 (2026-10-24 农田批: 量做群系区分 + 绿黄双保底 + 田缘墙/草垛计划) ──
// farm=大粮仓 (11~14@380, 面积随档) / town=城郊贴边碎田 (3~5, 环聚落外圈) / water=水田 (4~6)。
// 绿黄双保底: 每群系首块钉 corn (绿)、次块钉 wheat (黄) —— "全图无绿田/全黄田"不会再出现。
// 田缘墙/草垛在**数据阶段定计划** (确定性+探针可钉): f.walls=边索引表 (2~3, 避路≥4.5/避基地≥26),
// f.hay=草垛点表 (1~3, 避路≥6); 05c layoutProcgen §5 照单执行 (中式矮石墙/欧式树篱 + 草垛圆柱)。
function rectClear(x0,z0,x1,z1,roadClr){
 const cs=[[x0,z0],[x1,z0],[x0,z1],[x1,z1],[(x0+x1)/2,(z0+z1)/2]];
 for(const c of cs){
  if(Math.abs(c[0])>B_RC||Math.abs(c[1])>B_RC) return false;
  if(roadDistTo(c[0],c[1])<roadClr) return false;
  for(const b of bases) if(Math.hypot(c[0]-b.x,c[1]-b.z)<30) return false;
  for(const f of flags) if(Math.hypot(c[0]-f.x,c[1]-f.z)<22) return false;
  for(const s of SETTLE) if(Math.hypot(c[0]-s.x,c[1]-s.z)<s.r+16) return false;   // 村广场不让田
  for(const t of taken){ const px=Math.max(x0,Math.min(x1,t.x)), pz=Math.max(z0,Math.min(z1,t.z));
   if(Math.hypot(px-t.x,pz-t.z)<t.r+3) return false; }
  if(WATER&&rivDist(c[0],c[1])<RIVW+6) return false;
  if(WATER&&chanDist(c[0],c[1])<6) return false;
  if(WATER&&pondDist(c[0],c[1])<2) return false;
 }
 return true;
}
const fields=[];
let FIELD_TPL='';                                                 // farm 战区田带模板 (探针/调试读)
const grassP=[];                                                  // 高草丛规划 (05c 建造执行)
const FARM_FN={300:[9,12],380:[11,14],480:[14,17]};            // farm 田数档 (量做群系区分)
const TOWN_FN={300:[2,3],380:[3,5],480:[4,6]};                 // town 贴边碎田档
if(BIO.fields==='grain'){
 // ── 战区田带 (2026-10-24e 用户裁定: 农田要进战斗区——中路/中侧/翼侧成为左右战局的因素) ──
 // 对峙轴=基地0→1, 横向=左法向; 带宽 中路 |lat|≤34K / 中侧 ≤78K / 翼侧 (K=max(0.8,SK) 随图幅)。
 // 四模板加权抽签: 中路青纱帐带 30% / 双翼田带 30% / 中侧混合 25% / 横贯田带 15%。
 // 主田带田强制 corn/wheat (首块玉米=青纱帐保底+绿保底, 次块小麦=黄保底, 放置后按序回填类型);
 // 平田 (pasture/till 无植株) 只作边田填充 —— 战斗区永远有高杆庄稼。
 const axv={x:bases[1].x-bases[0].x,z:bases[1].z-bases[0].z};
 const aln=Math.hypot(axv.x,axv.z)||1; axv.x/=aln; axv.z/=aln;
 const mpx=(bases[0].x+bases[1].x)/2, mpz=(bases[0].z+bases[1].z)/2;
 const latOf=(x,z)=>(x-mpx)*(-axv.z)+(z-mpz)*axv.x;
 const K=Math.max(0.8,SK), C_B=34*K, M_B=78*K;
 const fT=TH==='china'?['wheat','corn','wheat','corn','till']:['wheat','wheat','corn','corn','pasture','till'];
 const szMul=(SZ===300)?0.86:(SZ===480)?1.08:1;
 const nt=FARM_FN[SZ];
 const tp=n32();
 FIELD_TPL=tp<0.30?'center':tp<0.60?'flank':tp<0.85?'mixed':'cross';
 const spec=[];                                                    // 主田带规格 {zone,sgn,along}
 const nSt=(FIELD_TPL==='center')?pgI(3,4):(FIELD_TPL==='flank')?2:pgI(1,2);
 if(FIELD_TPL==='center'){ for(let i=0;i<nSt;i++) spec.push({zone:'c',sgn:(i%2?1:-1),along:(i-(nSt-1)/2)*pgR(32,46)}); }
 else if(FIELD_TPL==='flank'){ for(let i=0;i<nSt;i++){ const lon=(i-(nSt-1)/2)*pgR(46,62);
   spec.push({zone:'m',sgn:1,along:lon+pgR(-12,12)},{zone:'m',sgn:-1,along:lon+pgR(-12,12)}); } }
 else if(FIELD_TPL==='mixed'){ spec.push({zone:'c',sgn:1,along:pgR(-30,30)});
   for(let i=0;i<nSt;i++) spec.push({zone:'m',sgn:(i%2?1:-1),along:pgR(-HALF*0.4,HALF*0.4)}); }
 else{ const nX=1+((n32()<0.5)?1:0); for(let i=0;i<nX;i++){ const lon=(i===0)?pgR(-50,50):pgR(-HALF*0.34,HALF*0.34);
   spec.push({zone:'m',sgn:1,along:lon},{zone:'m',sgn:-1,along:lon}); } }
 // 带内落位: 两段重试 (①紧抖动·路净空9 ②大抖动·路净空7+中心带小田), 全灭按 对侧→中路/中侧→异侧 退化
 const placeBelt=(sp)=>{
  for(let i=0;i<52;i++){
   const ph=(i<18)?1:(i<36)?2:3;               // ③极小田兜底 (20~30m, 路 6.5) —— 小图中心拥挤的最后保险
   const lat=(sp.zone==='c')?pgR(-C_B+16,C_B-16):sp.sgn*pgR(C_B+4,M_B-14);
   const lon=sp.along+((ph===1)?pgR(-14,14):pgR(-(ph*14),(ph*14)));
   const w=((ph===3)?pgR(20,30):(sp.zone==='c')?pgR(26,40):pgR(30,46))*szMul,d=((ph===3)?pgR(18,26):pgR(24,38))*szMul;
   const cx2=mpx+axv.x*lon+(-axv.z)*lat, cz2=mpz+axv.z*lon+axv.x*lat;
   const x0=Math.round(cx2-w/2),z0=Math.round(cz2-d/2),x1=Math.round(cx2+w/2),z1=Math.round(cz2+d/2);
   if(!rectClear(x0,z0,x1,z1,(ph===1)?9:(ph===2)?7:6.5)) continue;
   let dup=false;
   for(const f of fields) if(x0<f.x1+6&&x1>f.x0-6&&z0<f.z1+6&&z1>f.z0-6){ dup=true; break; }
   if(dup) continue;
   fields.push({x0,z0,x1,z1,t:'corn',belt:1});
   return true;
  }
  return false;
 };
 for(const sp of spec){
  if(placeBelt(sp)) continue;
  const alt=(sp.zone==='m')
   ?[{zone:'m',sgn:-sp.sgn,along:sp.along},{zone:'c',sgn:sp.sgn,along:sp.along},{zone:'c',sgn:-sp.sgn,along:sp.along+20}]
   :[{zone:'m',sgn:sp.sgn,along:sp.along},{zone:'m',sgn:-sp.sgn,along:sp.along},{zone:'c',sgn:-sp.sgn,along:sp.along+18}];
  for(const a of alt){ if(placeBelt(a)) break; }
 }
 // 救援兜底 (300 小图中心拥挤): 主田带 <2 块时, 极小田 (14~24m, 路净空 6) 在中/中侧带再补到 2
 if(fields.filter(f=>f.belt).length<2){
  for(let i=0;i<60&&fields.filter(f=>f.belt).length<2;i++){
   const lat=(n32()<0.5)?pgR(-C_B+12,C_B-12):((n32()<0.5?1:-1)*pgR(C_B+2,M_B-10));
   const lon=pgR(-HALF*0.45,HALF*0.45);
   const w=pgR(14,24),d=pgR(12,20);
   const cx2=mpx+axv.x*lon+(-axv.z)*lat, cz2=mpz+axv.z*lon+axv.x*lat;
   const x0=Math.round(cx2-w/2),z0=Math.round(cz2-d/2),x1=Math.round(cx2+w/2),z1=Math.round(cz2+d/2);
   if(!rectClear(x0,z0,x1,z1,6)) continue;
   let dup=false;
   for(const f of fields) if(x0<f.x1+4&&x1>f.x0-4&&z0<f.z1+4&&z1>f.z0-4){ dup=true; break; }
   if(dup) continue;
   fields.push({x0,z0,x1,z1,t:'corn',belt:1});
  }
 }
 { // 主田带类型回填: 首玉米(青纱帐+绿保底)/次小麦(黄保底)/其余 corn|wheat —— 与填充段的 0/1 位保底链无缝衔接
  let bi=0;
  for(const f of fields) if(f.belt){ f.t=(bi===0)?'corn':(bi===1)?'wheat':pgPick(['corn','wheat']); bi++; }
 }
 // 边田填充 (余量自由落位; 均匀撒点+净空门天然偏边 —— 战斗区已由主田带保证)
 for(let i=0;i<150&&fields.length<pgI(nt[0],nt[1]);i++){
  const w=pgR(36,58)*szMul,d=pgR(30,50)*szMul,x=pgR(-B_FD,B_FD),z=pgR(-B_FD,B_FD);
  const x0=Math.round(x-w/2),z0=Math.round(z-d/2),x1=Math.round(x+w/2),z1=Math.round(z+d/2);
  if(!rectClear(x0,z0,x1,z1,9)) continue;
  let dup=false;
  for(const f of fields) if(x0<f.x1+6&&x1>f.x0-6&&z0<f.z1+6&&z1>f.z0-6){ dup=true; break; }
  if(dup) continue;
  let t=pgPick(fT);
  if(fields.length===0) t='corn';                             // 绿保底 (主田带全灭时由此接住)
  else if(fields.length===1) t='wheat';                       // 黄保底
  fields.push({x0,z0,x1,z1,t});
 }
 // 战区标签 (几何单源): 全部田按中心横向距打 zn —— 探针/小地图/调试共读
 for(const f of fields){ const L=Math.abs(latOf((f.x0+f.x1)/2,(f.z0+f.z1)/2));
  f.zn=(L<=C_B)?'c':(L<=M_B)?'m':'w'; }
 // 高草丛规划 (2026-10-24e): 无田空带补植被因素 —— 中路/中侧优先, 避田 9/路 5.5/旗 r+3/聚落 r+10/基地 26
 // (05c 建 billboard 草丛 + 复用 CROP_FIELDS 软遮蔽 h1.4 蹲伏隐/可燃/无碰撞)
 {
  const ng={300:[2,3],380:[3,4],480:[4,6]}[SZ];
  for(let i=0;i<90&&grassP.length<pgI(ng[0],ng[1]);i++){
   const lat=((n32()<0.6))?(pgR(-C_B+10,C_B-10)):((n32()<0.5?1:-1)*pgR(C_B+6,M_B-12));
   const lon=pgR(-HALF*0.46,HALF*0.46);
   const x=Math.round(mpx+axv.x*lon+(-axv.z)*lat), z=Math.round(mpz+axv.z*lon+axv.x*lat);
   if(Math.abs(x)>B_RC-8||Math.abs(z)>B_RC-8) continue;
   if(roadDistTo(x,z)<5.5) continue;
   let bad=false;
   for(const b of bases) if(Math.hypot(x-b.x,z-b.z)<26){ bad=true; break; }
   if(!bad) for(const fl of flags) if(Math.hypot(x-fl.x,z-fl.z)<fl.r+3){ bad=true; break; }
   if(!bad) for(const s of SETTLE) if(Math.hypot(x-s.x,z-s.z)<s.r+10){ bad=true; break; }
   if(!bad) for(const f of fields){ const px=Math.max(f.x0,Math.min(x,f.x1)), pz=Math.max(f.z0,Math.min(z,f.z1));
    if(Math.hypot(px-x,pz-z)<9){ bad=true; break; } }
   if(!bad) for(const g of grassP) if(Math.hypot(g.x-x,g.z-z)<16){ bad=true; break; }
   if(bad) continue;
   grassP.push({x,z,r:Math.round(pgR(6,9))});
  }
 }
}else if(BIO.fields==='paddy'){
 // 水田块 (rice 全套: 色带/稻丛软遮蔽/可燃/植被让位): 岸域小田 24~40m
 const nt={300:[2,4],380:[4,6],480:[5,7]}[SZ];
 for(let i=0;i<110&&fields.length<pgI(nt[0],nt[1]);i++){
  const w=pgR(24,40),d=pgR(20,34),x=pgR(-(HALF-50),HALF-50),z=pgR(-(HALF-50),HALF-50);
  const x0=Math.round(x-w/2),z0=Math.round(z-d/2),x1=Math.round(x+w/2),z1=Math.round(z+d/2);
  if(!rectClear(x0,z0,x1,z1,8)) continue;
  let dup=false;
  for(const f of fields) if(x0<f.x1+9&&x1>f.x0-9&&z0<f.z1+9&&z1>f.z0-9){ dup=true; break; }
  if(dup) continue;
  let t=pgPick(['rice','rice','till']);
  if(fields.length===0) t='rice';                             // 绿保底 (稻丛)
  fields.push({x0,z0,x1,z1,t});
 }
}else if(PG.biome==='town'){
 // 城郊碎田 (2026-10-24e 内收: 环带 55→40 起, 更贴战斗区; 全部种植株型——城郊菜地没"荒平地")
 const nt=TOWN_FN[SZ];
 for(let i=0;i<130&&fields.length<pgI(nt[0],nt[1]);i++){
  const s=SETTLE[pgI(0,SETTLE.length-1)];
  const a=pgR(0,6.2832), dd=pgR(40,HALF*0.62);
  const cx2=s.x+Math.cos(a)*dd, cz2=s.z+Math.sin(a)*dd;
  const w=pgR(20,34),d=pgR(18,28);
  const x0=Math.round(cx2-w/2),z0=Math.round(cz2-d/2),x1=Math.round(cx2+w/2),z1=Math.round(cz2+d/2);
  if(!rectClear(x0,z0,x1,z1,8)) continue;
  let dup=false;
  for(const f of fields) if(x0<f.x1+6&&x1>f.x0-6&&z0<f.z1+6&&z1>f.z0-6){ dup=true; break; }
  if(dup) continue;
  let t=pgPick(['wheat','corn']);
  if(fields.length===0) t='corn';                             // 绿保底
  else if(fields.length===1) t='wheat';                       // 黄保底
  fields.push({x0,z0,x1,z1,t});
 }
}
// 双保底兜底 (硬保证): 采样全灭致田数 <2 时, 用小田面 (14×12~20×16) 再补到 2 块 —— 绿黄必同图 (水乡=双稻)。
if(fields.length<2){
 for(let i=0;i<80&&fields.length<2;i++){
  const s=SETTLE[pgI(0,SETTLE.length-1)];
  const a=pgR(0,6.2832), dd=pgR(48,HALF*0.6);
  const w=pgR(14,20),d=pgR(12,16);
  const x0=Math.round(s.x+Math.cos(a)*dd-w/2),z0=Math.round(s.z+Math.sin(a)*dd-d/2);
  const x1=x0+Math.round(w),z1=z0+Math.round(d);
  if(!rectClear(x0,z0,x1,z1,6)) continue;
  fields.push({x0,z0,x1,z1,t:WATER?'rice':((fields.length===0)?'corn':'wheat')});
 }
}
// 田缘墙/草垛计划 (全部田种): 候选边=3 采样点全离路 ≥4.5 且离基地 ≥26 (墙不拦路面/不堵营区);
// 取 2~3 边 (洗牌), 草垛 1~3 (田内 4m 内缩带, 避路 ≥6)。
for(const f of fields){
 const edges=[[f.x0,f.z0,f.x1,f.z0],[f.x0,f.z1,f.x1,f.z1],[f.x0,f.z0,f.x0,f.z1],[f.x1,f.z0,f.x1,f.z1]];
 const okEdge=edges.map(e=>[0.25,0.5,0.75].every(tt=>{
  const px=e[0]+(e[2]-e[0])*tt, pz=e[1]+(e[3]-e[1])*tt;
  if(roadDistTo(px,pz)<4.5) return false;
  for(const b of bases) if(Math.hypot(px-b.x,pz-b.z)<26) return false;
  return true;
 }));
 const idxs=[0,1,2,3].filter(i=>okEdge[i]);
 const nW=Math.min(idxs.length,2+(n32()<0.5?1:0));
 for(let k=idxs.length-1;k>0;k--){ const j=Math.floor(n32()*(k+1)); const tmp=idxs[k]; idxs[k]=idxs[j]; idxs[j]=tmp; }
 f.walls=idxs.slice(0,nW).sort((a,b)=>a-b);
 f.hay=[];
 const nH=pgI(1,3);
 for(let k=0,m=0;k<8&&m<nH;k++){
  const px=pgR(f.x0+4,f.x1-4), pz=pgR(f.z0+4,f.z1-4);
  if(f.x1-f.x0<10||f.z1-f.z0<10) break;                       // 碎田过小: 不塞草垛
  if(roadDistTo(px,pz)<6) continue;
  f.hay.push({x:Math.round(px*10)/10,z:Math.round(pz*10)/10}); m++;
 }
}
const inField=(x,z)=>{ for(const f of fields) if(x>f.x0-3&&x<f.x1+3&&z>f.z0-3&&z<f.z1+3) return true; return false; };
const woods=[];
// 林地: 半径感知避让 (村/旗/基地/田/互叠); 数量随档 {300:[2,3] / 380:[3,4] / 480:[4,6]}
const wn=(BIO.flagFam==='wing')?({300:[2,3],380:[3,4],480:[4,6]}[SZ]):(WATER?{300:[1,2],380:[1,2],480:[2,3]}[SZ]:{300:[0,1],380:[0,2],480:[1,2]}[SZ]);
// ★目标数内联在循环条件里 (基线纪律, 同散居农舍)
for(let i=0;i<48&&woods.length<pgI(wn[0],wn[1]);i++){
 const r=pgR(18,32),x=pgR(-(HALF-30),HALF-30),z=pgR(-(HALF-30),HALF-30);
 let ok=Math.abs(x)<B_WD&&Math.abs(z)<B_WD&&roadDistTo(x,z)>=14;
 if(ok) for(const b of bases) if(Math.hypot(x-b.x,z-b.z)<30+r){ ok=false; break; }
 if(ok) for(const f of flags) if(Math.hypot(x-f.x,z-f.z)<24+f.r){ ok=false; break; }
 if(ok) for(const s of SETTLE) if(Math.hypot(x-s.x,z-s.z)<26+r){ ok=false; break; }
 if(ok) for(const wd of woods) if(Math.hypot(x-wd.x,z-wd.z)<r+wd.r+8){ ok=false; break; }
 if(ok) for(const f of fields) if(x>f.x0-12&&x<f.x1+12&&z>f.z0-12&&z<f.z1+12){ ok=false; break; }
 if(ok&&WATER&&rivDist(x,z)<RIVW+10) ok=false;
 if(ok&&WATER&&chanDist(x,z)<8) ok=false;
 if(ok&&WATER&&pondDist(x,z)<2) ok=false;
 if(ok) woods.push({x:Math.round(x),z:Math.round(z),r:Math.round(r)});
}
// 野地孤树 (2026-10-24 田缘掩体批): 田块间/聚落间散株 —— 掩体链补洞 + 打破"圆盘树林"均质感
const singles=[];
{
 const nT=Math.round(12*SK)+pgI(0,4);
 for(let i=0;i<70&&singles.length<nT;i++){
  const x=pgR(-(HALF-24),HALF-24), z=pgR(-(HALF-24),HALF-24);
  if(roadDistTo(x,z)<9) continue;
  if(inField(x,z)) continue;
  let ok=true;
  for(const b of bases) if(Math.hypot(x-b.x,z-b.z)<30){ ok=false; break; }
  for(const s of SETTLE) if(Math.hypot(x-s.x,z-s.z)<s.r+12){ ok=false; break; }
  for(const f of flags) if(Math.hypot(x-f.x,z-f.z)<20){ ok=false; break; }
  for(const t of taken) if(Math.hypot(x-t.x,z-t.z)<t.r+3){ ok=false; break; }
  for(const wd of woods) if(Math.hypot(x-wd.x,z-wd.z)<wd.r+3){ ok=false; break; }
  if(!ok) continue;
  singles.push({x:Math.round(x),z:Math.round(z),s:Math.round(pgR(0.85,1.35)*100)/100});
 }
}

// ── 6. 写回 CAMPAIGN (03-terrain/05c/22/23 全链载入期在 00c 之后消费, 时序成立) ──
// 种子**不回写** sf_pseed (2026-10-07 修: 旧版回写 ⇒ 下一局又读它 ⇒ 永远同一张图)。
// sf_pseed 只代表「用户在迷你面板显式钉的种子」(22-hud go() 写/清); 留空 = PG 每局随机。
// 高度场网格 (v2, Minecraft 逐列高度图; v3 2026-10-07b 随地图 380 重标 → 2026-10-24 随档):
//   (HALF*2/5)×(HALF*2/5) 采样 @5m 覆盖 ±HALF —— 03-terrain 双线性采样。用普通数组 (非 Float32Array):
//   沙箱探针上下文无 typed array 全局。
const GN=Math.round(HALF*2/5),GS=5,GO=-HALF;
const hgrid=new Array((GN+1)*(GN+1));
for(let j=0;j<=GN;j++){ const zz=GO+j*GS;
 for(let i=0;i<=GN;i++) hgrid[j*(GN+1)+i]=Math.round(pgH(GO+i*GS,zz)*100)/100;
}
CAMPAIGN.flags=flags;
CAMPAIGN.bases=bases;
CAMPAIGN.roads=ROADS;
CAMPAIGN.fields=fields;
CAMPAIGN.procgen={seed:S,theme:PG.theme,biome:PG.biome,size:SZ,skeleton:SKELETON};
if(WATER){
 // 水语义表写回 + 重绑 (00-config 侧 var): heightAt 后置下切/inShallowChannel/水面登记/石桥全链通用件
 // 主河深度 1.8 (2026-10-28 修复, 指导 §4.4(2)): 旧 2.8 落进 03-terrain inRiverChannel 的 "d>2=深谷
 // 激流" 档 —— 平原水乡的小河被当成激流: 坦克误入即熄火吃 VEH_RAPIDS_DMG、步兵被冲移+持续受创。
 // 1.8≤2.0 ⇒ 激流判定关闭; 水面走 _waterStrip 浅河支 (wy=bank-0.4 再被 SHALLOW_RIVER_MAX=1.15 钳),
 // 中心水深 1.15m=全程涉渡 (SWIM_DEPTH=1.35 之下), 步兵涉水轻微减速、车辆可低速涉过 —— 乡村小河口径。
 CAMPAIGN.river={pts:riverPts,w:Math.round(RIVW*10)/10,d:1.8,ford:fordSite,ice:false};
 CAMPAIGN.delta={w:3.4,d:1.35,channels:dchans,ponds};
 CAMPAIGN.bridges=waterBridges.map(b=>({x:b.x,z:b.z,len:b.len,w:Math.round(b.w*10)/10,yaw:Math.round(b.yaw*100)/100,kind:'stone'}));
 RIVER=CAMPAIGN.river; DELTA=CAMPAIGN.delta; DELTA_CHANS=CAMPAIGN.delta.channels;
 BRIDGES=CAMPAIGN.bridges; BRIDGE=BRIDGES[0]||null;
}
PGDATA={seed:S,biome:PG.biome,core,bases,flags,polys:POLYS,lots,woods,theme:PG.theme,
 settles:SETTLE, skeleton:SKELETON, size:SZ, singles,
 fieldTpl:FIELD_TPL, grass:grassP,            // 战区田带模板 + 高草丛规划 (2026-10-24e)
 factoryPlaced:()=>factoryPlaced, rail:RAIL,
 river:WATER?{pts:riverPts,w:RIVW,d:1.8,ford:fordSite,bridges:waterBridges}:null,
 dchans,ponds,
 hgrid,gN:GN,gS:GS,gO:GO};
})();
