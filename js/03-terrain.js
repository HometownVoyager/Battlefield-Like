// ─────────────────────────────────────────────
// 03-terrain.js —— 地形高度/碰撞体/占用网格
// 源: Index.original.html 第 1096-1329 行
// ─────────────────────────────────────────────
'use strict';
// ═══ 折线/矩形特征空间桶 (2026-11-13 性能批 A): 距离场全扫 → 16m 网格候选集 ═══
// 每张特征表一个桶: 逐 shape 把 bbox 外扩 reach 后覆盖的所有 16m 格登记 shape 下标; 查询只取
// 查询点所在格的候选集求 min/逐项施加。reach = 该表全部消费方的最大比较阈值 + 12.4 (格半对角
// 11.32 + 1m 余量 ⇒ 点距 shape ≤ 阈值时 shape 必在候选集内, 逐位等价), 有 hgridClear 消费的表
// 再 +2.2 (带 PAD) —— 各调用点分别注明。候选集外的 shape 只能产生 >阈值 的距离, 而消费方对
// 距离的使用全部是 `d<T` 守卫比较 / sstep-clamp 饱和带 / 逐 shape 独立施加 ⇒ 与旧全扫在所有
// 消费方视角下等价 (逐点论证见 dev/verify-frameperf-terrain-20261113.js 与修复报告 §2)。
// 懒建: 首次查询时建; src 引用或长度变化自动重建 (procgen 00c 重绑 RIVER=CAMPAIGN.river 的防御)。
// window.SEG_OFF=true ⇒ 全部回退旧全扫; 细粒度另有 ROAD_OFF/GULLY_OFF/RAMP_OFF (回退路径=原全扫)。
const SEG_CELL=16;
const _SEGB=new Map();
function _segReg(bk,x0,z0,x1,z1,idx){
const c0=Math.floor(x0/SEG_CELL), c1=Math.floor(x1/SEG_CELL), r0=Math.floor(z0/SEG_CELL), r1=Math.floor(z1/SEG_CELL);
for(let cx=c0;cx<=c1;cx++)for(let cz=r0;cz<=r1;cz++){
const k=cx*100000+cz;
let a=bk.get(k); if(!a){ a=[]; bk.set(k,a); }
a.push(idx);
}
}
// 返回: 候选下标数组 (按表序, 保序 ⇒ 逐项施加/lerp 链的浮点顺序与旧全扫一致) | null=该格无候选
// (等价于"旧全扫里全部 shape 距查询点 > reach-格半对角 ≥ 消费阈值") | false=SEG_OFF ⇒ 调用方走旧全扫。
// src 只在 (re)build 时求值; reach 可传函数 (如 ramps 的 max w 懒求值); kind 见 segBucket 内分支。
function segQuery(name,x,z,src,reach,kind){
if(window.SEG_OFF) return false;
const cur=src(); const n=cur?cur.length:0;
let b=_SEGB.get(name);
if(!b||b.srcRef!==cur||b.n0!==n){
b={srcRef:cur,n0:n,bk:new Map()};
_SEGB.set(name,b);
if(cur&&n){
const rc=(typeof reach==='function')?reach():reach;
if(kind==='polys'||kind==='poly1'){
// 逐段注册 (2026-11-13 修): 整条 bbox 注册会让跨图长折线把候选集退化成全表, 且 poly1 的 shape
// 下标曾被消费方当**段下标**直读 (P[i]/P[i+1]) ⇒ 越界。逐段注册后候选下标即段下标:
// 'poly1' 下标=段号 j; 'polys' 编码 i*1024+j —— 登记按 (i,j) 字典序 ⇒ 逐段累加语义与全扫同序。
const list=(kind==='polys')?cur:[cur];
for(let i=0;i<list.length;i++){
const g=list[i]; if(!g||g.length<2) continue;
for(let j=0;j<g.length-1;j++){
const p0=g[j], p1=g[j+1];
const x0=Math.min(p0[0],p1[0]), x1=Math.max(p0[0],p1[0]);
const z0=Math.min(p0[1],p1[1]), z1=Math.max(p0[1],p1[1]);
_segReg(b.bk,x0-rc,z0-rc,x1+rc,z1+rc,i*1024+j);
}
}
}else{
for(let i=0;i<n;i++){
let x0,z0,x1,z1;
if(kind==='segs'){ const s=cur[i]; x0=s[0]; z0=s[1]; x1=s[2]; z1=s[3]; }
else if(kind==='osegs'){ const s=cur[i]; x0=s.x0; z0=s.z0; x1=s.x1; z1=s.z1; }
else if(kind==='tsegs'){ const s=cur[i]; x0=s.x1; z0=s.z1; x1=s.x2; z1=s.z2; }
else if(kind==='rects'){ const s=cur[i]; x0=s.x0; z0=s.z0; x1=s.x1; z1=s.z1; }
else{ const s=cur[i]; const rr=(s.r||0)+rc; _segReg(b.bk,s.x-rr,s.z-rr,s.x+rr,s.z+rr,i); continue; } // 'circs': 外扩 r_i+reach
if(x1<x0){ const t=x0; x0=x1; x1=t; } if(z1<z0){ const t=z0; z0=z1; z1=t; }
_segReg(b.bk,x0-rc,z0-rc,x1+rc,z1+rc,i);
}
}
}
}
if(!n) return null;
return b.bk.get(Math.floor(x/SEG_CELL)*100000+Math.floor(z/SEG_CELL))||null;
}
// 地貌语义表 (2026-09-10 三图改造): 淞沪水网 / 百团沟壑 / 莫斯科雪岭 ——
// 与 CITY/RURAL_FIELDS 同约定: 表本体在 config 战役条目, 全链路共读, 严禁布局另写坐标
// DELTA/DELTA_CHANS 已在 00-config 定义 (RIVER 表旁); 此处只补 LOESS/ALPINE
// 必须在 FLATS 初始化之前 (addFlat 调 rawHeight, rawHeight 读这些表 —— TDZ)
const LOESS=CAMPAIGN.loess||null;
// 山岭修正支 (dormant): 当前**无战役**写 CAMPAIGN.alpine (莫斯科是 terr:'urban' + theme:'alpine') ——
// 本支全部是 if(ALPINE) 条件入口, 取 null 时零开销。2026-09-26 审计复核: 保留为山地图的扩展点
// (删掉会连带 ridgeH/passes/雪线三处语义消失), 属休眠字段而非死字段。
const ALPINE=CAMPAIGN.alpine||null;
// 雾林守线语义 (2026-09-13 许特根改版): 北谷(卡尔小径)判定 —— rawHeight/色带/OCC 共用 (表本体在 config.wood)
function woodRavineDist(x,z){
if(!WOOD||!WOOD.ravine) return 1e9;
const P=WOOD.ravine.pts;
// 桶化 (2026-11-13 性能批 A): 消费阈值最大 = W2.w+2 (05c 布局让位带) ⇒ reach=W2.w+2+12.4
const arr=segQuery('wravine',x,z,()=>P,(WOOD.ravine.w||15)+2+12.4,'poly1');
let gd=1e9;
if(arr===false){
for(let i=0;i<P.length-1;i++){
const d=segDist(x,z,P[i][0],P[i][1],P[i+1][0],P[i+1][1]);
if(d<gd) gd=d;
}
}else if(arr) for(let q=0;q<arr.length;q++){
const i=arr[q];
const d=segDist(x,z,P[i][0],P[i][1],P[i+1][0],P[i+1][1]);
if(d<gd) gd=d;
}
return gd;
}
// 谷堑口遮罩: 走廊内=1 (谷壑压平剩 12% 残深=缓坡), 走廊外 5m 渐灭 —— 车辆/步兵/Bot 的合法过谷通道
function woodRampMask(x,z){
if(!WOOD||!WOOD.ravine) return 0;
const RS=WOOD.ravine.ramps||[];
// 桶化 (2026-11-13 性能批 A): k>0 区 = d<w+5 ⇒ reach=maxW+5+12.4 (k>0 的坡道必在候选集)
const arr=segQuery('wramps',x,z,()=>RS,()=>{ let mw=0; for(const r of RS){ const w=r.w||5; if(w>mw) mw=w; } return mw+5+12.4; },'osegs');
let m=0;
if(arr===false){
for(const r of RS){
const w=r.w||5;
const d=segDist(x,z,r.x0,r.z0,r.x1,r.z1);
const k=d<=w?1:clamp(1-(d-w)/5,0,1);
if(k>m) m=k;
}
}else if(arr) for(let q=0;q<arr.length;q++){
const r=RS[arr[q]];
const w=r.w||5;
const d=segDist(x,z,r.x0,r.z0,r.x1,r.z1);
const k=d<=w?1:clamp(1-(d-w)/5,0,1);
if(k>m) m=k;
}
return m;
}
// 平整区: 基地+旗点自动生成 (高度自适应当地地形, 避免高原/悬崖)
const FLATS=[];
{
// 百团/许特根等大起伏图: 旗点平台必须取当地全高 (山顶/塬面旗点若取 0.55 会被削成盆地边缘悬崖)
// 塔拉瓦环礁 (island): 旗点/基地平台同样取全高 —— 0.55 系数会把滩头旗点削到海平面以下 (淹没)
const fullH=CAMPAIGN.terr==='loess'||CAMPAIGN.terr==='woods'||CAMPAIGN.terr==='island';  // (opensea 全海图支随 2026-11-10 海战图下架摘除)
const addFlat=(x,z,r,h)=>FLATS.push({x,z,r,h:h!==undefined?h:rawHeight(x,z)*0.55});
// 出生平台的高度: 旧口径一律取 rawHeight*0.55 (即削掉当地高度的 45%) —— 平地上只是几厘米的微整形,
//   但在山坡上就是一个坑: 断崖公路的 7 个伏击点 (terr 'mountain', 无旗点/无基地 ⇒ 没有任何后续平台覆盖)
//   实测被削 2.87~5.66m, "居高临下打谷道"的伏击点成了坐进去就看不见公路的碗 (dev/_spawnflat-probe.js)。
// 现口径: 削深上限 2m —— 平地/矮丘逐位不变 (旧口径削深本就 ≤2m: 百团 0.48 / 草原 0.50 / 其余 0),
//   高地改为"当地高 −0.4m"的浅台 (仍是台地, 不是坑)。削深 = 0.45*rawHeight ⇒ 门限等价于 rawHeight>4.44m。
const spawnFlatH=(x,z)=>{ const raw=rawHeight(x,z); return (raw*0.45>2)? raw-0.4 : raw*0.55; };
// 大起伏图: 基地平台同样取全高 (山坡/塬面上的基地若取 0.55 系数会挖出盆地边缘悬崖)
// 许特根 (woods): 基地/旗点取全高 (林间缓丘上 0.55 同样挖盆); 岭上村台地独立登记 (石屋群需整片平地)
for(const b of CAMPAIGN.bases) addFlat(b.x,b.z,20,fullH?rawHeight(b.x,b.z):undefined);
for(const f of CAMPAIGN.flags) addFlat(f.x,f.z,f.r+12,fullH?rawHeight(f.x,f.z):undefined);
if(WOOD&&WOOD.village){ const V=WOOD.village; addFlat(V.x,V.z,V.r,rawHeight(V.x,V.z)); }
for(const s of (CAMPAIGN.spawns||[])) addFlat(s.x,s.z,8,spawnFlatH(s.x,s.z));
// 草原库尔斯克改版 (2026-09-13): 车站(站房/站台/水塔群)/风车/农庄需整片平地 (全高, 同岭上村口径)
if(STEPPE&&STEPPE.station){ const T=STEPPE.station; addFlat(T.x,T.z,26,rawHeight(T.x,T.z)); }
if(STEPPE&&STEPPE.village){ const V2=STEPPE.village; addFlat(V2.x,V2.z,V2.r,rawHeight(V2.x,V2.z)); }
if(STEPPE&&STEPPE.mill){ const M2=STEPPE.mill; addFlat(M2.x,M2.z,9,rawHeight(M2.x,M2.z)); }
if(CAMPAIGN.terr==='rolling') addFlat(0,0,34);
}
// ── 建筑地基平台 PADS (2026-09-20 用户实机"斜坡上的建筑没有地板: 进门就是大凹坑、楼梯台阶失效") ──
// FLATS 是"软"平台(整圆 smoothstep 收敛, 大平台上边缘只到 55%~), 适合村台/旗点这类大范围微整形;
// 建筑要的是**定向矩形硬平台**: 足迹矩形(+0.9m 缓冲, 含墙外皮)内恒等于楼面高, 矩形之外 ramp 米裙坡回落地形。
// 建筑于是"坐落"在水平地基上: 室内地面=楼面(无坑)、门槛零落差(门台阶自动不再生成)、楼梯梯脚落地。
// 矩形(而非圆)是刻意的: 邻建的地基台面不会互相盖到对方足迹里 (圆台在楼距 16m 的街区会重叠打架 ——
// 实机样本: 灯塔台面被 12m 外炮位平台的裙坡拉低 2.8m)。仲裁规则: **足迹内的台面权威**, 裙坡只作用于其外。
// 登记时机=05-world `foundation()` 算楼面那一刻(带 hMax-hMin 门限, 平缓地形的建筑不登记);
// 地形网格在世界布局之后由 `refreshTerrainMesh()` 重刷顶点 (网格在本文件载入期先按原地形建好)。
const PADS=[];
function addPad(x,z,ry,hw,hd,ramp,h){
PADS.push({x,z,ry,hw,hd,ramp,h,cs:Math.cos(ry),sn:Math.sin(ry),reach2:(Math.hypot(hw,hd)+ramp+0.001)*(Math.hypot(hw,hd)+ramp+0.001)});
HGRID.data=null; // 高度修正带清空场缓存失效 (新特征会改变邻近格的快路判定; 惰性重填, 开销可忽略)
}
// 平台修正: ①点在某个平台矩形内 ⇒ 该矩形高度(权威, 重叠时归最近的那个平台) —— 邻建裙坡不得越界;
//          ②点在所有矩形之外 ⇒ 各平台裙坡按登记序平滑混合 (都在裙坡里就自然过渡, 无归属冲突)
function padHeight(x,z,h){
const n=PADS.length;
if(!n) return h;
let plat=null, platC=1e9;
for(let k=0;k<n;k++){
const p=PADS[k];
const dx=x-p.x, dz=z-p.z;
if(dx*dx+dz*dz>p.reach2) continue;
const lx=dx*p.cs-dz*p.sn, lz=dx*p.sn+dz*p.cs;
if(Math.abs(lx)<=p.hw&&Math.abs(lz)<=p.hd){ const c=dx*dx+dz*dz; if(c<platC){ platC=c; plat=p; } }
}
if(plat) return plat.h;
for(let k=0;k<n;k++){
const p=PADS[k];
const dx=x-p.x, dz=z-p.z;
if(dx*dx+dz*dz>p.reach2) continue;
const lx=dx*p.cs-dz*p.sn, lz=dx*p.sn+dz*p.cs;
const ax=Math.abs(lx)-p.hw, az=Math.abs(lz)-p.hd;
if(ax<=0&&az<=0) continue;
const d=Math.hypot(ax>0?ax:0,az>0?az:0);
if(d>=p.ramp) continue;
h=lerp(h,p.h,sstep(1-d/p.ramp));
}
return h;
}
// 博卡日农田田块表 (诺曼底): 色带/庄稼软遮蔽/断续树篱共用; 其他战役为空
const RURAL_FIELDS=CAMPAIGN.fields||[];
// 城市语义 (2026-09-05 城市组·斯大林格勒/柏林): 街道矩形 ——
// 顶点色带/heightAt 下沉/布局建筑避让/小地图 共读 (严禁布局另写一套坐标)
const CITY=CAMPAIGN.city||null;
function rectDist(x,z,x0,z0,x1,z1){
const dx=Math.max(x0-x,0,x-x1), dz=Math.max(z0-z,0,z-z1);
return Math.hypot(dx,dz);
}
// 街道距离: 街内=0, 街外=到最近街道矩形的距离 (建筑避让/植被/草丛让位共用)
function streetDist(x,z){
if(!CITY) return 1e9;
let bd=1e9;
for(const s of CITY.streets){
if(x>=s.x0&&x<=s.x1&&z>=s.z0&&z<=s.z1) return 0;
const dx=Math.max(s.x0-x,0,x-s.x1), dz=Math.max(s.z0-z,0,z-s.z1);
const d=Math.hypot(dx,dz);
if(d<bd) bd=d;
}
return bd;
}
// 城市建成区判定: 街块内 / 工厂厂区 —— 地面土色化 + 草/树全域让位共用 (2026-09-05:
// 用户实机反馈"城市像草地撒房子": 旧版只有街道让位/上色, 街块与厂区仍是绿草地)
function cityUrban(x,z){
if(!CITY) return false;
if(CITY.blocks) for(const s of CITY.blocks){ if(x>=s.x0&&x<=s.x1&&z>=s.z0&&z<=s.z1) return true; }
if(CITY.yard&&x>=CITY.yard.x0&&x<=CITY.yard.x1&&z>=CITY.yard.z0&&z<=CITY.yard.z1) return true;
return false;
}
function fieldAt(x,z){
for(const f of RURAL_FIELDS){
if(x>=f.x0&&x<=f.x1&&z>=f.z0&&z<=f.z1) return f;
}
return null;
}
// 百团沟壑判定 (2026-09-12 立体化): 到最近沟壑折线的距离 + 坡道堑口遮罩 —— rawHeight/色带/OCC 共用
function gullyDist(x,z){
if(!LOESS||!LOESS.gullies) return 1e9;
const G=LOESS.gullies;
if(window.GULLY_OFF){ // 回退旗: 原全扫 (2026-11-13 性能批 A)
let gd=1e9;
for(const g of G){
for(let i=0;i<g.length-1;i++){
const d=segDist(x,z,g[i][0],g[i][1],g[i+1][0],g[i+1][1]);
if(d<gd) gd=d;
}
}
return gd;
}
// 桶化 (2026-11-13 性能批 A): 消费阈值最大 = W+2.2 (hgridClear 的 segDist-W 带内记账) ⇒ reach=W+14.6
const arr=segQuery('gullies',x,z,()=>G,(LOESS.w||14)+14.6,'polys');
let gd=1e9;
if(arr===false){
for(const g of G){
for(let i=0;i<g.length-1;i++){
const d=segDist(x,z,g[i][0],g[i][1],g[i+1][0],g[i+1][1]);
if(d<gd) gd=d;
}
}
}else if(arr) for(let q=0;q<arr.length;q++){
const enc=arr[q], g=G[enc>>10], si=enc&1023;
const d=segDist(x,z,g[si][0],g[si][1],g[si+1][0],g[si+1][1]);
if(d<gd) gd=d;
}
return gd;
}
// 坡道堑口遮罩: 走廊内=1 (沟壁压平为缓坡), 走廊外 5m smoothstep 渐灭 —— 坦克/步兵/Bot 的合法过沟通道
function rampMask(x,z){
if(!LOESS||!LOESS.ramps) return 0;
const RS=LOESS.ramps;
if(window.RAMP_OFF){ // 回退旗: 原全扫 (2026-11-13 性能批 A)
let m=0;
for(const r of RS){
const w=r.w||9;
const d=segDist(x,z,r.x0,r.z0,r.x1,r.z1);
const k=d<=w?1:clamp(1-(d-w)/5,0,1);
if(k>m) m=k;
}
return m;
}
// 桶化 (2026-11-13 性能批 A): k>0 区 = d<w+5 ⇒ reach=maxW+5+12.4 (k>0 的坡道必在候选集)
const arr=segQuery('lramps',x,z,()=>RS,()=>{ let mw=0; for(const r of RS){ const w=r.w||9; if(w>mw) mw=w; } return mw+5+12.4; },'osegs');
let m=0;
if(arr===false){
for(const r of RS){
const w=r.w||9;
const d=segDist(x,z,r.x0,r.z0,r.x1,r.z1);
const k=d<=w?1:clamp(1-(d-w)/5,0,1);
if(k>m) m=k;
}
}else if(arr) for(let q=0;q<arr.length;q++){
const r=RS[arr[q]];
const w=r.w||9;
const d=segDist(x,z,r.x0,r.z0,r.x1,r.z1);
const k=d<=w?1:clamp(1-(d-w)/5,0,1);
if(k>m) m=k;
}
return m;
}
// ═══════════ 环礁/海域语义 (2026-09-18 塔拉瓦环礁批 / 09-18b 三面 / ★09-19 四面环海): 岸线距离场 + 剖面 + 航道 ═══════════
// 单源纪律 (纲领 §4.3): 剖面/色带/OCC/布局/海面网格/HUD/水深层与隐蔽判定全部读下面这几支函数 ——
// 严禁第二处再写一套海岸线坐标。
// 南(北)岸位置: 折线线性插值 (x 单调递增), 返回该 x 处 0 等高线的 z
function shoreZAt(x){
  if(!SEA) return 1e9;
  const P=SEA.shore;
  if(x<=P[0][0]) return P[0][1];
  for(let i=0;i<P.length-1;i++){
    if(x<=P[i+1][0]){
      const t=(x-P[i][0])/((P[i+1][0]-P[i][0])||1);
      return P[i][1]+(P[i+1][1]-P[i][1])*t;
    }
  }
  return P[P.length-1][1];
}
function northZAt(x){
  if(!SEA||!SEA.north) return -1e9;
  const P=SEA.north;
  if(x<=P[0][0]) return P[0][1];
  for(let i=0;i<P.length-1;i++){
    if(x<=P[i+1][0]){
      const t=(x-P[i][0])/((P[i+1][0]-P[i][0])||1);
      return P[i][1]+(P[i+1][1]-P[i][1])*t;
    }
  }
  return P[P.length-1][1];
}
// 西/东岸位置: 折线线性插值 (z 单调递增), 返回该 z 处 0 等高线的 x
function coastXAt(P,z){
  if(!P||!P.length) return 1e9;
  if(z<=P[0][0]) return P[0][1];
  for(let i=0;i<P.length-1;i++){
    if(z<=P[i+1][0]){
      const t=(z-P[i][0])/((P[i+1][0]-P[i][0])||1);
      return P[i][1]+(P[i+1][1]-P[i][1])*t;
    }
  }
  return P[P.length-1][1];
}
// 单支岸线的**有符号距离** (2026-09-19 四面环海): 折线跨度内 = 垂距; **越出端点 = 到该端点的欧氏距离**
// (符号按"相对端点在同侧与否")。 P[i]=[t,v] 且 t 单调递增 (南/北岸 [x,z]; 西/东岸 [z,x]);
// side=+1 表示海侧在 v 更大的一侧 (南岸 z / 东岸 x), side=-1 表示海侧在 v 更小的一侧 (北岸 z / 西岸 x)。
// ★ 越界必须改用端点距离 —— 旧版越界后沿用"端点垂线", 图角 (±320,±320) 到最近岸线被算成 24m,
//   剖面据此给出 1.28m 深的礁盘 ⇒ 用户实机"角落的海太浅了不合常理"的根因 (现图角 ≥12m 深海盆)。
function coastDist(P,t,v,side){
  const n=P.length;
  if(n<2||t<=P[0][0]){ const dv=v-P[0][1]; return (side*dv>=0?1:-1)*Math.hypot(t-P[0][0],dv); }
  if(t>=P[n-1][0]){ const dv=v-P[n-1][1]; return (side*dv>=0?1:-1)*Math.hypot(t-P[n-1][0],dv); }
  for(let i=0;i<n-1;i++){
    if(t<=P[i+1][0]){
      const t0=P[i][0], t1=P[i+1][0];
      const vc=P[i][1]+(P[i+1][1]-P[i][1])*((t-t0)/((t1-t0)||1));
      return side*(v-vc);
    }
  }
  return side*(v-P[n-1][1]);
}
// 到岸线距离场: >0 海侧 / <0 陆侧 —— 四面海岸 (南/北/西/东) 取最靠海的一支。
// 陆侧: 取四者中最接近 0 的负值 (= 到最近岸的有符号距离); 海侧: 取所有正值的**最小** (= 到最近岸的距离)。
// 这样"水面单源"在凹湾/岬角拐点处仍连续 (拐点处两支相等 → 折痕, 但不跳变)。
function shoreDist(x,z){
  if(!SEA) return 1e9;
  const fs=coastDist(SEA.shore,x,z,1);                          // 南岸 (海侧 z 更大)
  const fn=SEA.north?coastDist(SEA.north,x,z,-1):-1e9;          // 北岸 (海侧 z 更小)
  const dw=SEA.west?coastDist(SEA.west,z,x,-1):-1e9;            // 西岸 (海侧 x 更小) —— P=[z,x] ⇒ t=z,v=x
  const de=SEA.east?coastDist(SEA.east,z,x,1):-1e9;             // 东岸 (海侧 x 更大)
  if(fs<=0&&fn<=0&&dw<=0&&de<=0){ let m=fs; if(fn>m)m=fn; if(dw>m)m=dw; if(de>m)m=de; return m; }
  let best=1e18;
  if(fs>0) best=fs;
  if(fn>0&&fn<best) best=fn;
  if(dw>0&&dw<best) best=dw;
  if(de>0&&de<best) best=de;
  return best;
}
// 登陆航道遮罩: 走廊核心=1, 边界 6m 渐灭 (礁盘/礁缘在此切深, 供日后登陆艇冲滩)。
// z0 = 该航道所属海域的起点 (四面环海后必须限定: 同一条 x 竖带在北湾也是海, 不限定就会在北岸再切一道)
function seaChannelMask(x,z){
  if(!SEA||!SEA.channels) return 0;
  let m=0;
  for(const c of SEA.channels){
    if(c.z0!==undefined&&z<c.z0) continue;
    const d=Math.abs(x-c.x);
    const k=d<=c.w?1:clamp(1-(d-c.w)/6,0,1);
    if(k>m) m=k;
  }
  return m;
}
// 由"离岸距离 d"直接给出水深 (供 rawHeight/色带/OCC 复用同一次 d, 免重复求距离场)
// 剖面数字账见 00-config CAMPAIGN.sea 注释 (冲滩 1:18 / 礁盘平台 / 礁缘 1:3.3 陡坎 / 外坡 / 深海盆地),
// 航道内礁盘段切深到 2.45m
function seaDepthOfD(x,z,d){
  const S=SEA;
  // 无离岸剖面表 (S.shelf 缺省) 的图: 直接给**均匀海盆深** (旧全海图 opensea 走这里, 2026-11-10
  // 该图下架后此兜底仍为缺省保护分支, island 带完整剖面表不走这一条)。
  // (地形色带/海深/OCC 水障三处都读本函数; 不走这一条会在载入期就 TypeError。)
  if(!S||!S.shelf) return (S&&S.deep)?S.deep:26;
  const A=S.shelf.d*S.shelf.rate;
  const B=A+(S.reef.d1-S.reef.d0)*S.reef.rate;
  const C=B+(S.edge.d1-S.edge.d0)*S.edge.rate;
  const D=C+(S.slope.d1-S.slope.d0)*S.slope.rate;
  let dep;
  if(d<=S.shelf.d) dep=d*S.shelf.rate;
  else if(d<=S.reef.d1) dep=A+(d-S.reef.d0)*S.reef.rate;
  else if(d<=S.edge.d1) dep=B+(d-S.edge.d0)*S.edge.rate;
  else if(d<=S.slope.d1) dep=C+(d-S.slope.d0)*S.slope.rate;
  else dep=D+(d-S.basin.d0)*S.basin.rate;
  const cm=seaChannelMask(x,z);
  if(cm>0){
    const ramp=sstep(clamp((d-5)/10,0,1)); // 冲滩段(d<5)保留自然缓坡, d≥15 全深
    dep=lerp(dep,Math.max(dep,2.45),cm*ramp);
  }
  return dep;
}
// 水深 (海侧为正; 陆侧/无海=0)
function seaDepthAt(x,z){
  if(!SEA) return 0;
  const d=shoreDist(x,z);
  return d>0?seaDepthOfD(x,z,d):0;
}
// 陆上剖面 (u = 入陆距离): 干沙滩 → 沙丘脊(第一道防线) → 背坡台地 → 内陆缓丘+抬升 → 岬角/珊瑚岭 → 跑道台地
function seaLandH(x,z,u){
  const S=SEA;
  const hSand=S.sand.u*S.sand.rate;                                  // 0.777
  const hRidge=hSand+(S.ridge.u1-S.ridge.u0)*S.ridge.rate;           // 2.297
  const hBench=hRidge+(S.bench.u1-S.bench.u0)*S.bench.rate;          // 2.537
  let h;
  if(u<=S.sand.u) h=u*S.sand.rate;
  else if(u<=S.ridge.u1) h=hSand+(u-S.ridge.u0)*S.ridge.rate;
  else if(u<=S.bench.u1) h=hRidge+(u-S.bench.u0)*S.bench.rate;
  else{
    const H=S.hill;
    const hill=H.a*Math.sin(x*0.0125+0.7)*Math.cos(z*0.0115-0.4)
    +H.b*Math.sin(x*0.031-1.1)*Math.sin(z*0.028+0.6)
    +H.c*Math.sin(x*0.09+2.2)*Math.cos(z*0.083+1.1);
    // 出背坡台地后缓缓起丘: (bias+hill) 乘 0→1 渐入量 → u=34 处与台地连续,
    // 且 g→1 后 h ≥ hBench+bias-4.4 > 0 (陆上永远不会掉到海平面以下)
    const g=sstep(clamp((u-S.bench.u1)/30,0,1));
    h=hBench+(H.bias+hill)*g+S.uplift.h*sstep(clamp((u-S.uplift.u0)/S.uplift.span,0,1));
  }
  // 岬角岩台 (灯塔岬/岸炮岬): 圆顶抬升 —— 两翼制高
  if(S.heads) for(const hd of S.heads){
    const dd=Math.hypot(x-hd.x,z-hd.z);
    if(dd<hd.r) h+=hd.h*sstep(1-dd/hd.r);
  }
  // 纵深珊瑚岭 (日军指挥所高地)
  if(S.knoll){
    const dd=Math.hypot(x-S.knoll.x,z-S.knoll.z);
    if(dd<S.knoll.r) h+=S.knoll.h*sstep(1-dd/S.knoll.r);
  }
  // 机场跑道台地: 矩形内平整到台面高, 20m 过渡 (中线会战枢纽的地形基础)
  const rd=rectDist(x,z,S.runway.x0,S.runway.z0,S.runway.x1,S.runway.z1);
  if(rd<20) h=lerp(h,S.runway.h,sstep(clamp(1-rd/20,0,1)));
  return h;
}
// ── 水面单源: waterYAt (海=SEA.level; 河道/支流/鱼塘=05c 渲染时登记的采样表) ──
// 新载具批 (LVT/登陆艇) 直接读这三支: 水面高度 / 水深 / 是否在海域
// ★2026-09-26E (审计 22/24 修复): 查询表从"离散圆 + 窗口取最大"改成"条带段 + 沿段插值" ——
//   ① 旧版按 `hypot(x-s.x,z-s.z) ≤ s.hw+1.2` 判"在水里", 而 05c 沿河心线每 ≈12m 才登记一个采样点:
//      淞沪汊港 hw=3.23 ⇒ 查询半径 4.43m < 半间距 6.08m ⇒ **相邻采样点之间必然有一段"没有水面"**
//      (实测沿汊港心线 27% 为干、最长连续干段 3.3m; 1.5m 网格普查可见水面 29.7% 被判干地)。
//   ② 旧版在 3×3 格窗口里取 s.wy 的**最大值**, 而渲染网格是相邻采样点之间的**线性插值**:
//      只要沿程水位有落差 (徒涉滩/深谷水面下沉), 物理水位就会取到上游那份高值
//      (实测胡康 184/3623 点高出 3m 以上、最大 6.14m ⇒ 玩家浮在可见水面之上 4.8m)。
//   现在登记的是与渲染网格**同拓扑**的条带段 (相邻采样点成段, 段内线性插值 + 法向半宽 hw),
//   查询只做一次"投影到段 → 取插值水位", 与肉眼所见逐点同源; 段覆盖整段 ⇒ 不再有采样间隙。
const WATER_SURF=[];              // {x,z,wy,hw} 采样点 (鱼塘圆盘也在其中; 供探针/统计)
const WATER_SEGS=[];              // {ax,az,bx,bz,awy,bwy,reach} 条带段 (reach=hw+WATER_PAD)
const WATER_DISCS=[];             // {x,z,wy,reach} 圆盘水面 (鱼塘/藕塘)
const WATER_CELLS=new Map();      // 12m 格 → {s:[段下标],d:[圆盘下标]} (按覆盖登记, 查询只查本格)
const WATER_CELL=12, WATER_PAD=1.2;
function _wReg(cx,cz,key,idx){
  const k=cx+','+cz;
  let a=WATER_CELLS.get(k); if(!a){ a={s:null,d:null}; WATER_CELLS.set(k,a); }
  if(key==='s'){ if(!a.s) a.s=[]; a.s.push(idx); }
  else{ if(!a.d) a.d=[]; a.d.push(idx); }
}
// 按"该水面的影响范围"登记到所有被覆盖的格 —— 查询点落在哪一格, 影响它的段/盘必然已登记在该格里
// (点 p 在段 S 的影响范围内 ⇒ p 所在格与 S 的影响盒相交 ⇒ 该格已被登记; 故只查本格即完备)
function _wRegBox(x0,z0,x1,z1,key,idx){
  const c0=Math.floor(x0/WATER_CELL), c1=Math.floor(x1/WATER_CELL);
  const r0=Math.floor(z0/WATER_CELL), r1=Math.floor(z1/WATER_CELL);
  for(let cx=c0;cx<=c1;cx++)for(let cz=r0;cz<=r1;cz++) _wReg(cx,cz,key,idx);
}
// 条带登记 (05c _waterStrip 调): 采样点 + 相邻点成段 —— 与渲染四边形逐段同拓扑
function waterSurfRegStrip(samples,hw){
  const reach=hw+WATER_PAD;
  for(let i=0;i<samples.length;i++){
    const s=samples[i];
    WATER_SURF.push({x:s.x,z:s.z,wy:s.wy,hw});
    if(samples.length===1){ // 单点条带: 无相邻点可成段, 退化成圆盘
      const di=WATER_DISCS.length;
      WATER_DISCS.push({x:s.x,z:s.z,wy:s.wy,reach});
      _wRegBox(s.x-reach,s.z-reach,s.x+reach,s.z+reach,'d',di);
      continue;
    }
    if(i===0) continue;
    const a=samples[i-1];
    const si=WATER_SEGS.length;
    WATER_SEGS.push({ax:a.x,az:a.z,bx:s.x,bz:s.z,awy:a.wy,bwy:s.wy,hw,reach});
    _wRegBox(Math.min(a.x,s.x)-reach,Math.min(a.z,s.z)-reach,Math.max(a.x,s.x)+reach,Math.max(a.z,s.z)+reach,'s',si);
  }
}
// 圆盘登记 (鱼塘/藕塘): 半径 r 的圆水面
function waterSurfReg(x,z,wy,r){
  WATER_SURF.push({x,z,wy,hw:r});
  const reach=(r||0)+WATER_PAD;
  const di=WATER_DISCS.length;
  WATER_DISCS.push({x,z,wy,reach});
  _wRegBox(x-reach,z-reach,x+reach,z+reach,'d',di);
}
function waterSampleY(x,z){
  if(!WATER_SEGS.length&&!WATER_DISCS.length) return -1e9; // 无水体的战役 (绝大多数图): 直接短路, 零开销
  const a=WATER_CELLS.get(Math.floor(x/WATER_CELL)+','+Math.floor(z/WATER_CELL));
  if(!a) return -1e9;
  let best=-1e9, eBest=-1e9, ePerp=1e9;
  if(a.s){
    for(let n=0;n<a.s.length;n++){
      const s=WATER_SEGS[a.s[n]];
      const dx=s.bx-s.ax, dz=s.bz-s.az, L2=dx*dx+dz*dz;
      const L=Math.sqrt(L2)||1;
      const tRaw=L2>1e-9?((x-s.ax)*dx+(z-s.az)*dz)/L2:0;
      const t=tRaw<0?0:(tRaw>1?1:tRaw);
      const lat=Math.hypot(x-(s.ax+dx*t),z-(s.az+dz*t));   // 到"线段"(含端帽) 的距离
      // ★2026-09-26E (审计 24 第二层): 端帽的**轴向溢出**只给 WATER_PAD 的容差, 不给整条 hw ——
      //   旧版把投影截断到 [0,1] 后仍按 hw+1.2 收点 ⇒ 段端外 hw+1.2 米 (胡康 25.9m!) 都算"段内",
      //   于是徒涉滩那份高水位顺着河道下游外溢 26m (实测 6.14m 偏差)。现在收点是"条带矩形 ⊕ 1.2m 圆角":
      //   横向超界 lateral-hw 与轴向越界 axial 合成一个距离, 只有 ≤WATER_PAD 才收。
      const axial=L*Math.max(0,-tRaw,tRaw-1);
      const lateral=Math.sqrt(Math.max(0,lat*lat-axial*axial));
      const over=Math.max(0,lateral-s.hw);
      const eff=Math.hypot(over,axial);
      if(eff>WATER_PAD) continue;
      const wy=s.awy+(s.bwy-s.awy)*t;
      if(eff<=0){ if(wy>best) best=wy; }                   // 条带内: 取高者 (跨河带时浮在高的那份)
      else if(eff<ePerp){ ePerp=eff; eBest=wy; }           // 岸线/端帽容差带: 取最近的那份, 免出硬边
    }
  }
  if(a.d){
    for(let n=0;n<a.d.length;n++){
      const d=WATER_DISCS[a.d[n]];
      const perp=Math.hypot(x-d.x,z-d.z);
      if(perp>d.reach) continue;
      if(perp<=d.reach-WATER_PAD){ if(d.wy>best) best=d.wy; }
      else if(perp<ePerp){ ePerp=perp; eBest=d.wy; }
    }
  }
  return best>-1e8?best:eBest;
}
// 水面高度 (无水体 = -1e9): 海 + 河道/支流/鱼塘 (取高者)
function waterYAt(x,z){
  let wy=-1e9;
  if(SEA&&shoreDist(x,z)>0) wy=SEA.level;
  const s=waterSampleY(x,z);
  if(s>wy) wy=s;
  return wy;
}
// 水深 (水面 - 真实水底; noBridge=true 取河床/海床, 不把桥面/栈桥面当水底)
function waterDepthAt(x,z){
  const wy=waterYAt(x,z);
  if(wy<=-1e8) return -1e9;
  return wy-heightAt(x,z,true);
}
function inSea(x,z){ return !!SEA&&shoreDist(x,z)>0; }
function inDeepWater(x,z){ return waterDepthAt(x,z)>SWIM_DEPTH; }
// 是否落在**任一水体**之下 (河/支流汊港/鱼塘/冰面/海 通用, ★2026-09-26 新增, P2-18):
// 旧版布景的排除门只有 inRiverChannel —— 而它要求 RIVER.d>2 (只认"深谷激流"那一档), 于是:
//   滇缅/莫斯科 (d 未定义=浅河/冰河)、淞沪的 delta 汊港与鱼塘、胡康的徒涉滩心全部漏网:
//   实测能通过树门的**水下格** (dev/_vegwater-probe.js 2m 网格) 滇缅 646 / 莫斯科冰面 594 / 胡康 147 /
//   淞沪 230 —— 树直接长在河里/冰面上。判据只读 03-terrain 的水面单源 (waterYAt) 与河床高
//   (heightAt(...,noBridge=true)), 不另写一套水面算术。
function inWaterBody(x,z){
const wy=waterYAt(x,z);
return wy>-1e8&&heightAt(x,z,true)<wy-0.05;
}
// 最近岸方向 (落水自救/Bot 游向岸; 河道与海面通用): 16 方向×2 半径采样, 取水最浅者。
// ★2026-09-26E (审计 25 修复): 旧版直接对 waterDepthAt 的返回值取 min, 而"无水"用的是哨兵 -1e9 ⇒
//   16 个方向里只要有**任意一个**探针落在陆上, bd 立刻变成 -1e9 并被 `bd<-1e8` 判成"无数据"返回 null。
//   语义上 -1e9 本应是"最浅、最想去"的方向, 却与"无数据"共用同一个哨兵 ⇒
//   自救方向只在"四面全是水"(开阔海面) 时才存在, 近岸/河道整段失效 (实测胡康河道 z=0 逐点全部 null,
//   河心 Bot 因此原地打摆 180 帧)。现在把"无水"显式折算成"比任何有水方向都浅"的取值, 与"无数据"彻底分开。
function shoreDirAt(x,z){
  let bd=1e9, bx=0, bz=0;
  for(let i=0;i<16;i++){
    const a=i*TAU/16, dx=Math.sin(a), dz=Math.cos(a);
    const d1=waterDepthAt(x+dx*7,z+dz*7), d2=waterDepthAt(x+dx*16,z+dz*16);
    let s=Math.min(d1,d2);
    if(s<=-1e8) s=-1e5;   // 探针落在陆上 = 那个方向就是岸 (最浅), 不再与"无数据"混用哨兵
    if(s<bd){ bd=s; bx=dx; bz=dz; }
  }
  return [bx,bz];
}
// ── 水体状态机 (玩家/Bot 共用单源; 纲领第 2 条一视同仁) ──
// 口径 (2026-09-18 定案, 修"浮在水面却被判成涉水"的抖动):
//   ① 脚在水面之上 (wl≤0.02, 如站在栈桥面/桥面/船里/干沙滩) → dry, 不看脚下水有多深;
//   ② 否则按**水深**分层: ≤WADE_DEPTH 湿沙浅水 / ≤SWIM_DEPTH 涉水(踏海床站立, 可开火) / >SWIM_DEPTH 游泳。
// 用"水深"而非"脚底高差"是刻意的: 游泳浮力把脚托在水面下 1.32m, 恰落在涉水带内 ——
// 若按脚底高差判, 浮态会瞬间被判成"涉水"→ 落回重力 → 又转游泳, 形成逐帧抖动 (Bot 侧同理)。
function waterStateAt(x,y,z){
  const wy=waterYAt(x,z);
  _WST.wy=wy;
  if(wy<=-1e8){ _WST.wl=-1e9; _WST.depth=-1e9; _WST.state='dry'; return _WST; }
  const wl=wy-y;
  const depth=wy-heightAt(x,z,true);
  _WST.wl=wl; _WST.depth=depth;
  _WST.state=(wl<=0.02)?'dry':(depth<=WADE_DEPTH?'wet':(depth<=SWIM_DEPTH?'wade':'swim'));
  return _WST;
}
const _WST={wy:-1e9,wl:-1e9,depth:-1e9,state:'dry'};
// 头部没入深度 (正=头在水面下): 憋气消耗与"潜水隐蔽"共用同一口径
function headDepthAt(x,y,z){ const wy=waterYAt(x,z); return wy<=-1e8?-1e9:wy-(y+1.45); }
// 潜水隐蔽判定 (子弹/视线层用): 头部没入 >UW_HIDE_DEPTH 即被水面遮蔽
function uwHiddenAt(x,y,z){ return headDepthAt(x,y,z)>UW_HIDE_DEPTH; }
// 弹道入水距离 (2026-09-18, 13-combat fireBullet 用): 返回"弹道在水下走完 UW_BULLET_RUN 米"的那一点到起点的距离;
// 未入水返回 Infinity。海面按绝对海平面解析求解 (廉价), 河道/支流/鱼塘按起终点水面高取高者近似
// (水面沿河缓变; 这是每发子弹一次的开销, 不做逐点采样以免自动武器打满 CPU)。
function waterEntryDist(o,dir,maxD){
if(dir.y>=-1e-4) return Infinity;
let entry=Infinity;
if(SEA){
const tt=(o.y-SEA.level)/(-dir.y);
if(tt>0&&tt<maxD){
const ex=o.x+dir.x*tt, ez=o.z+dir.z*tt;
if(inSea(ex,ez)) entry=tt;
}
}
const span=Math.min(maxD,140);
const wy=Math.max(waterYAt(o.x,o.z),waterYAt(o.x+dir.x*span,o.z+dir.z*span));
if(wy>-1e8){
const tt=(o.y-wy)/(-dir.y);
if(tt>0&&tt<maxD&&tt<entry) entry=tt;
}
return entry===Infinity?Infinity:entry+UW_BULLET_RUN;
}
function rawHeight(x,z){
switch(CAMPAIGN.terr){
case 'urban':
return 0.45*Math.sin(x*0.03)*Math.cos(z*0.028)
+ 0.25*Math.sin(x*0.09+1)*Math.sin(z*0.07+0.5);
case 'delta':{
// 淞沪圩田 (2026-09-12 中等起伏剖面): 基础微丘 + 田埂堤路抬高 + 圩田下沉 + 支流下切 + 鱼塘
// 剖面: 田面 -0.65 / 田埂 +1.35 / 支流 -1.35 / 主河 -2.8 (heightAt RIVER) / 丝厂地坪 foundation 拾平
let h=0.55*Math.sin(x*0.018)*Math.cos(z*0.02)
+ 0.35*Math.sin(x*0.06+2)*Math.sin(z*0.05+1) - 0.15;
if(DELTA){
// 田埂/堤路: +1.35m, 半宽 2.2m 可走走廊 —— 桶化 (2026-11-13 性能批 A): 阈值最大 = 2.2+2.2 (hgridClear 记账) ⇒ reach=16.8
if(DELTA.ridges){
const rarr=segQuery('dridges',x,z,()=>DELTA.ridges,4.4+12.4,'osegs');
if(rarr===false){
for(const r of DELTA.ridges){
const d=segDist(x,z,r.x0,r.z0,r.x1,r.z1);
if(d<2.2) h+=1.35*sstep(1-d/2.2);
}
}else if(rarr) for(let q=0;q<rarr.length;q++){
const r=DELTA.ridges[rarr[q]];
const d=segDist(x,z,r.x0,r.z0,r.x1,r.z1);
if(d<2.2) h+=1.35*sstep(1-d/2.2);
}
}
// 圩田田面下沉 -0.65 (矩形内; 边缘 sstep 过渡, 不切田埂) —— 桶化: 矩形含点时 bbox 距离 0 必在候选集, 边缘带 1.5 ⇒ reach=1.5+12.4
if(DELTA.paddy){
const parr=segQuery('dpaddy',x,z,()=>DELTA.paddy,1.5+12.4,'rects');
if(parr===false){
for(const p of DELTA.paddy){
const mx=(x-p.x0)*(x-p.x1), mz=(z-p.z0)*(z-p.z1);
if(mx<=0&&mz<=0){
const dEdge=Math.min(x-p.x0,p.x1-x,z-p.z0,p.z1-z);
if(dEdge>1.5) h-=0.65; else h-=0.65*sstep(dEdge/1.5);
}
}
}else if(parr) for(let q=0;q<parr.length;q++){
const p=DELTA.paddy[parr[q]];
const mx=(x-p.x0)*(x-p.x1), mz=(z-p.z0)*(z-p.z1);
if(mx<=0&&mz<=0){
const dEdge=Math.min(x-p.x0,p.x1-x,z-p.z0,p.z1-z);
if(dEdge>1.5) h-=0.65; else h-=0.65*sstep(dEdge/1.5);
}
}
}
// 鱼塘/藕塘: 圆形浅塘下切 (不进激流) —— 桶化: 阈值 = r+1.2 (+hgridClear 2.2) ⇒ 外扩 r+3.4+12.4
if(DELTA.ponds){
const pdarr=segQuery('dponds',x,z,()=>DELTA.ponds,3.4+12.4,'circs');
if(pdarr===false){
for(const pd of DELTA.ponds){
const d=Math.hypot(x-pd.x,z-pd.z);
if(d<pd.r+1.2){
const k=clamp(1-d/(pd.r+1.2),0,1);
h-=(pd.t==='lotus'?0.55:0.75)*sstep(k);
}
}
}else if(pdarr) for(let q=0;q<pdarr.length;q++){
const pd=DELTA.ponds[pdarr[q]];
const d=Math.hypot(x-pd.x,z-pd.z);
if(d<pd.r+1.2){
const k=clamp(1-d/(pd.r+1.2),0,1);
h-=(pd.t==='lotus'?0.55:0.75)*sstep(k);
}
}
}
// 支流汊港下切 —— 桶化: 阈值最大 = w+2.2 (hgridClear 记账) ⇒ reach=w+14.6 (与 heightAt procgen/hgridClear 共用 'chans' 桶)
{
const carr=segQuery('chans',x,z,()=>DELTA_CHANS,(DELTA.w||3.4)+14.6,'polys');
if(carr===false){
for(const ch of DELTA_CHANS){
for(let i=0;i<ch.length-1;i++){
const d=segDist(x,z,ch[i][0],ch[i][1],ch[i+1][0],ch[i+1][1]);
if(d<DELTA.w) h-=(DELTA.d||1.35)*sstep(1-d/DELTA.w);
}
}
}else if(carr) for(let q=0;q<carr.length;q++){
const enc=carr[q], ch=DELTA_CHANS[enc>>10], si=enc&1023;
const d=segDist(x,z,ch[si][0],ch[si][1],ch[si+1][0],ch[si+1][1]);
if(d<DELTA.w) h-=(DELTA.d||1.35)*sstep(1-d/DELTA.w);
}
}
// 丝厂地标地坪: 微抬 +0.3, 压平圈 (foundation 再取最高点)
if(DELTA.landmark){
const L=DELTA.landmark;
const d=Math.hypot(x-L.x,z-L.z);
if(d<14) h+=0.3*sstep(1-d/14);
}
}
return h;
}
case 'loess':{
// 百团黄土 640 大地图 (2026-09-12 立体化): 川地基底 + 塬面高台 + 黄土峁 + 深沟大壑 + 坡道堑口 + 沟底渡台
// 剖面数字账: 沟底(gd<3, 平坦) → 崩积坡(3..12, 8m落差/9m水平≈42°慢爬区) → 陡崖(12..14, 6m落差/1.8m≈73~79°,
// 坦克70°/步兵65°上限物理封死) → 塬缘=崖顶; 坡道走廊内沟壑压平剩12%残深(跨沟≈28m 缓坡≈4°)
const base=1.5*Math.sin(x*0.016+0.5)*Math.cos(z*0.019)
+ 0.8*(1-Math.abs(Math.sin(x*0.028+z*0.011+1)))
+ 0.4*Math.sin(x*0.09+3)*Math.cos(z*0.08+1.2)+0.6;
let h=base;
if(LOESS){
// 塬面高台: 矩形内=台面高, 边距 14m smoothstep 过渡 (塬坡≈33°, sstep 局部≈44°: 慢爬区)
// —— 桶化 (2026-11-13 性能批 A): m>0 区 = d<14, 阈值最大 = 14+2.2 (hgridClear 记账) ⇒ reach=28.6
if(LOESS.terraces){
const tarr=segQuery('lterr',x,z,()=>LOESS.terraces,14+2.2+12.4,'rects');
if(tarr===false){
for(const t2 of LOESS.terraces){
const d=rectDist(x,z,t2.x0,t2.z0,t2.x1,t2.z1);
const m=sstep(clamp(1-d/14,0,1));
h=lerp(h,t2.h,m);
}
}else if(tarr) for(let q=0;q<tarr.length;q++){
const t2=LOESS.terraces[tarr[q]];
const d=rectDist(x,z,t2.x0,t2.z0,t2.x1,t2.z1);
const m=sstep(clamp(1-d/14,0,1));
h=lerp(h,t2.h,m);
}
}
// 黄土峁: 抛物面穹顶 (边缘坡度 2h/R≈20~29°, 坦克可爬; 顶部平缓宜布旗) —— 桶化: 阈值 = r (+hgridClear 2.2) ⇒ 外扩 r+14.6
if(LOESS.maos){
const marr=segQuery('lmaos',x,z,()=>LOESS.maos,2.2+12.4,'circs');
if(marr===false){
for(const m2 of LOESS.maos){
const d=Math.hypot(x-m2.x,z-m2.z);
if(d<m2.r){
const k=1-d/m2.r;
const mh=base+m2.h*k*(2-k);
if(mh>h) h=mh;
}
}
}else if(marr) for(let q=0;q<marr.length;q++){
const m2=LOESS.maos[marr[q]];
const d=Math.hypot(x-m2.x,z-m2.z);
if(d<m2.r){
const k=1-d/m2.r;
const mh=base+m2.h*k*(2-k);
if(mh>h) h=mh;
}
}
}
// 深沟大壑: 三段剖面下切 (坡道走廊内压平)
const W=LOESS.w||14, D=LOESS.d||14, GB=LOESS.bottom||3, TE=LOESS.talus||12;
const gd=gullyDist(x,z);
if(gd<W){
let dep;
if(gd<GB) dep=D;
else if(gd<TE) dep=D-8*sstep((gd-GB)/(TE-GB));
else dep=(D-8)*(1-sstep((gd-TE)/(W-TE)));
dep*=1-0.88*rampMask(x,z);
h-=dep;
}
// 沟底渡台: 沟壑内的低台 (回填至绝对高, 台缘 12m 缓坡≈49°=天然渡口, 沟底库旗点立足台) —— 桶化: reach=12+2.2+12.4
if(LOESS.benches){
const barr=segQuery('lbench',x,z,()=>LOESS.benches,12+2.2+12.4,'rects');
if(barr===false){
for(const b2 of LOESS.benches){
const d=rectDist(x,z,b2.x0,b2.z0,b2.x1,b2.z1);
const m=sstep(clamp(1-d/12,0,1));
h=lerp(h,b2.h,m);
}
}else if(barr) for(let q=0;q<barr.length;q++){
const b2=LOESS.benches[barr[q]];
const d=rectDist(x,z,b2.x0,b2.z0,b2.x1,b2.z1);
const m=sstep(clamp(1-d/12,0,1));
h=lerp(h,b2.h,m);
}
}
}
return h;
}
case 'jungle':
return 2.3*Math.sin(x*0.014)*Math.cos(z*0.017+1)
+ 1.25*Math.sin(x*0.05+1.2)*Math.sin(z*0.043+2)
+ 0.5*Math.sin(x*0.12+3)*Math.cos(z*0.1);
case 'deepjungle':
return 1.9*Math.sin(x*0.016+0.3)*Math.cos(z*0.014+2)
+ 1.0*Math.sin(x*0.045+0.7)*Math.sin(z*0.05+1.4)
+ 0.4*Math.sin(x*0.11+1)*Math.cos(z*0.1+0.6);
case 'alpine':{
// 莫斯科雪岭: 主脊距离场 (语义表 ridges/ridgeH) + 山麓丘陵 —— 雪线以上裸岩, 以下松林
const base=1.2*Math.sin(x*0.021)*Math.cos(z*0.024)
+ 0.7*Math.sin(x*0.052+1.7)*Math.sin(z*0.043+0.6)
+ 0.35*Math.sin(x*0.11+3.1)*Math.cos(z*0.09+1.2);
if(ALPINE){
let bd=1e9, bh=0;
const R=ALPINE.ridges[0], RH=ALPINE.ridgeH;
// 桶化 (2026-11-13 性能批 A): s>0 区 = bd<70, 阈值最大 = 70+2.2 (hgridClear 记账) ⇒ reach=84.6;
// argmin 段必在候选集内 (bd<70 ⇒ 距离 ≤70 < 84.6-12.4), bd≥70 时新旧都给 s=0 ⇒ 等价
const aarr=segQuery('aridge',x,z,()=>R,70+2.2+12.4,'poly1');
if(aarr===false){
for(let i=0;i<R.length-1;i++){
const abx=R[i+1][0]-R[i][0], abz=R[i+1][1]-R[i][1];
const t=clamp(((x-R[i][0])*abx+(z-R[i][1])*abz)/(abx*abx+abz*abz),0,1);
const px=R[i][0]+abx*t, pz=R[i][1]+abz*t;
const d=Math.hypot(x-px,z-pz);
if(d<bd){ bd=d; bh=RH[i]+(RH[i+1]-RH[i])*t; }
}
}else if(aarr) for(let q=0;q<aarr.length;q++){
const i=aarr[q];
const abx=R[i+1][0]-R[i][0], abz=R[i+1][1]-R[i][1];
const t=clamp(((x-R[i][0])*abx+(z-R[i][1])*abz)/(abx*abx+abz*abz),0,1);
const px=R[i][0]+abx*t, pz=R[i][1]+abz*t;
const d=Math.hypot(x-px,z-pz);
if(d<bd){ bd=d; bh=RH[i]+(RH[i+1]-RH[i])*t; }
}
const s=sstep(clamp(1-bd/70,0,1));
return base+s*s*bh;
}
return base;
}
case 'steppe':
// 草原遭遇战: 开阔波状草原, 低幅缓坡 (视线通透, 装甲对轰场)
return 0.9*Math.sin(x*0.017+0.4)*Math.cos(z*0.015+1.2)
+ 0.45*Math.sin(x*0.052+1.5)*Math.sin(z*0.045+0.8)
+ 0.18*Math.sin(x*0.14+2)*Math.cos(z*0.12+0.4);
case 'procgen':{
// 随机战场 v2 (2026-10-07): 00c 预烘焙高度场网格 (三层噪声 + 沿路/核心/旗圈压平, 见 00c §2.5/§6)
// → 双线性采样。同种子同地形; 与 00c 建筑坡度门/压平带同一单源。PGDATA 缺失 (载入序异常) 时退旧缓丘公式。
if(typeof PGDATA!=='undefined'&&PGDATA&&PGDATA.hgrid){
 const H=PGDATA.hgrid,N=PGDATA.gN,GS=PGDATA.gS,GO=PGDATA.gO;
 const gx=Math.max(0,Math.min(N,(x-GO)/GS)), gz=Math.max(0,Math.min(N,(z-GO)/GS));
 const i0=Math.min(N-1,Math.floor(gx)), j0=Math.min(N-1,Math.floor(gz)), fx=gx-i0, fz=gz-j0;
 const h00=H[j0*(N+1)+i0],h10=H[j0*(N+1)+i0+1],h01=H[(j0+1)*(N+1)+i0],h11=H[(j0+1)*(N+1)+i0+1];
 return (h00*(1-fx)+h10*fx)*(1-fz)+(h01*(1-fx)+h11*fx)*fz;
}
return 1.05*Math.sin(x*0.016+PG.ph[0])*Math.cos(z*0.015+PG.ph[1])
+ 0.5*Math.sin(x*0.047+PG.ph[2])*Math.sin(z*0.044+PG.ph[3])
+ 0.18*Math.sin(x*0.11+PG.ph[1])*Math.cos(z*0.095+PG.ph[2]);
}
case 'woods':{
// 雾林守线 (2026-09-13 许特根改版): 林间缓丘基底 + 北谷(卡尔小径)三段剖面 + 谷堑口
// 剖面数字账: 谷底(gd<5, 泥径平坦) → 崩积坡(5..12, 5.2m落差/7m≈37°湿滑慢爬) → 谷缘陡唇(12..15,
// 3.3m落差/3m≈48~55°, 步兵>40°减速可攀/Bot 由 OCC 挡住走堑口) ; 车辆堑口走廊内谷壑压平剩12%残深
// (≈1.0m 缓坡, 坦克经主防火道纵穿北谷); 岭上村=FLATS 全高台地
const base=0.95*Math.sin(x*0.018+0.8)*Math.cos(z*0.017+1.4)
+0.5*Math.sin(x*0.05+2)*Math.sin(z*0.045+1)
+0.22*Math.sin(x*0.11+1)*Math.cos(z*0.09+2.4);
if(!WOOD||!WOOD.ravine) return base;
const W2=WOOD.ravine, D2=W2.d||8.5, GB=W2.bottom||5, TE=W2.talus||12;
const gd=woodRavineDist(x,z);
if(gd>=W2.w) return base;
let dep;
if(gd<GB) dep=D2;
else if(gd<TE) dep=D2-5.2*sstep((gd-GB)/(TE-GB));
else dep=(D2-5.2)*(1-sstep((gd-TE)/(W2.w-TE)));
dep*=1-0.88*woodRampMask(x,z);
return base-dep*(1+0.06*Math.sin(x*0.012+2)); // 沿谷缓倾 (谷势感)
}
case 'island':{
// 塔拉瓦环礁 (2026-09-18 / 09-18b 三面 / ★09-19 四面环海): 海床(负高度)与陆上剖面共用同一支距离场 ——
// 岸线即 0 等高线, 南=登陆洋面 / 西·东·北=三个海湾, 陆地是**居中的孤岛** (四湾四岬)。
// 剖面数字账见 00-config CAMPAIGN.sea
// (冲滩 1:18 / 礁盘 1.22~1.28m 涉水带 / 礁缘 1:3.3 / 沙丘脊 1:5.3 第一道防线 / 跑道台地 7.6m);
// 陆上口径: u=入陆距离 (取到最近一支海岸的距离), 海侧: d=离岸距离
if(!SEA) return 0;
const d=shoreDist(x,z);
if(d>0) return -seaDepthOfD(x,z,d);
return seaLandH(x,z,-d);
}
// (2026-11-10: case 'opensea' 全海图海床支随珊瑚海/铁底湾下架摘除, 原文见 archive/naval-coral-ironbottom-20261110/)
case 'mountain':{
// 断崖公路 · 伏击山谷: 谷底走廊随公路蜿蜒(rd<5 低平), 两侧 25° 左右山坡渐起
// (rd5~21 上叠 ~9m × 沿谷起伏 0.45~1.55), 山肩上缘再拔 ~7m (rd21~32),
// 山坡中高处即伏击带 —— 居高临下俯瞰谷道, 山肩以上才是陡面
const rd=roadDist(x,z);

const side=sstep(clamp((rd-5)/16,0,1));
const rim=sstep(clamp((rd-21)/11,0,1));
const rn=1+0.35*Math.sin(x*0.024+z*0.01+1)+0.2*Math.sin(x*0.055-z*0.03+0.7);
const floor=0.4*Math.sin(x*0.05)+0.2*Math.sin(x*0.12+2);
return floor+side*9*rn+rim*7*rn;
}
default:
return 1.4*Math.sin(x*0.021)*Math.cos(z*0.024)
+ 0.9*Math.sin(x*0.052+1.7)*Math.sin(z*0.043+0.6)
+ 0.5*Math.sin(x*0.11+3.1)*Math.cos(z*0.09+1.2);
}
}
function heightAt(x,z,noBridge){
// 2026-09-06 B6/P1-5 快路: 所在 3m 格距全部修正特征(FLATS/土路/壕沟/河道/桥面)都超出
// 特征半径+格半对角余量 ⇒ 各修正项在该格恒为 0, 直接返回 rawHeight —— 省 FLATS/沟壑/河道逐项距离遍历。
// 零插值: 快路返回值与原函数逐位一致; 带内格走原函数全程精修 (等价探针 _probe_equiv 扩展验证)。
{
const iI=Math.floor((x+HGRID.off)/HGRID.res), jJ=Math.floor((z+HGRID.off)/HGRID.res);
if(!(window.HGRID_OFF)&&iI>=0&&jJ>=0&&iI<HGRID.N&&jJ<HGRID.N&&hgridClear(iI,jJ)>0) return rawHeight(x,z);
}
let h=rawHeight(x,z);
for(const f of FLATS){
const d=Math.hypot(x-f.x,z-f.z);
if(d<f.r){
const t=1-d/f.r;
const s=sstep(t);
h=lerp(h,f.h,s);
}
}
// 诺曼底: 博卡日下沉土路 —— 土路低于两侧田野约 0.45m (战壕下切模板减半)
// 城市组不适用 (斯大林格勒田地旗复用农田表, 但城区道路不参与下沉 → !CITY 门控, 2026-09-06)
if(RURAL_FIELDS.length&&!CITY){
const rd=roadDist(x,z);
if(rd<4){
const k=1-rd/4;
h-=0.45*sstep(k);
}
}
// 战壕: 沿线下凹 —— 桶化 (2026-11-13 性能批 A): 阈值最大 = 2.4+2.2 (hgridClear 记账) ⇒ reach=17
{
const tarr=segQuery('trench',x,z,()=>TRENCHES,2.4+2.2+12.4,'tsegs');
if(tarr===false){
for(let i=0;i<TRENCHES.length;i++){
const t=TRENCHES[i];
const d=segDist(x,z,t.x1,t.z1,t.x2,t.z2);
if(d<2.4){
const k=1-d/2.4;
h-=1.3*sstep(k);
}
}
}else if(tarr) for(let q=0;q<tarr.length;q++){
const t=TRENCHES[tarr[q]];
const d=segDist(x,z,t.x1,t.z1,t.x2,t.z2);
if(d<2.4){
const k=1-d/2.4;
h-=1.3*sstep(k);
}
}
}
	// 河道: 沿折线下切 (d>2 为深谷激流); ford 徒涉滩: 滩心下切按 8% 计 (2026-09-12 胡康巨桥改版)
	// —— 桶化 (2026-11-13 性能批 A): 阈值最大 = w+2.2 (hgridClear 记账) ⇒ reach=w+14.6 (与 hgridClear 共用 'river' 桶)
	if(RIVER){
	let rd=1e9;
	const P=RIVER.pts;
	const rarr=segQuery('river',x,z,()=>P,(RIVER.w||1.9)+2.2+12.4,'poly1');
	if(rarr===false){
	for(let i=0;i<P.length-1;i++){
	const d=segDist(x,z,P[i][0],P[i][1],P[i+1][0],P[i+1][1]);
	if(d<rd) rd=d;
	}
	}else if(rarr) for(let q=0;q<rarr.length;q++){
	const i=rarr[q];
	const d=segDist(x,z,P[i][0],P[i][1],P[i+1][0],P[i+1][1]);
	if(d<rd) rd=d;
	}
	if(rd<RIVER.w){
	const k=1-rd/RIVER.w;
	h-=(RIVER.ice?1.2:(RIVER.d||1.9))*sstep(k)*(1-0.92*fordAt(x,z));
	}
	}
	// 水乡支汊/鱼塘下切 (2026-10-28 修复, 指导 §4.4(1) 红线3): procgen water 群系在 00c 只产折线/圆表
	// (hgrid 烘焙只含噪声+路/聚落压平, 不含水文) ⇒ 水面条带 (_waterStrip) 与鱼塘圆盘 (都按 heightAt
	// 取位) 曾浮在未下切的地面上 ~8cm = "塑料片浮水"。补进 heightAt 修正链与 RIVER 同层:
	//   · hgridClear 已把 DELTA_CHANS (半宽 DELTA.w) 与 ponds (r+1.2) 记入带内特征 ⇒ 快路/精修同源;
	//   · 支汊 -1.2m: 水深 = wy(bank-0.4) - 床(bank-1.2) ≈ 0.8m 涉渡 (NAV 水障按 SWIM_DEPTH=1.35 记,
	//     不封格 = 00c "浅折线=软通道" 口径); 与滨河街交叉处自然成徒涉口;
	//   · 鱼塘 lotus -0.65 / fish -0.85: 塘缘 1.2m sstep 过渡, 05c 圆盘 clamp 到 bank-0.12 恰落盆中。
	// 仅钉 layout==='procgen' —— 淞沪 delta 的同类水文在 rawHeight case 'delta' 内已有, 严禁双份叠加。
	if(CAMPAIGN.layout==='procgen'&&DELTA){
	if(DELTA_CHANS.length){
	const cw=DELTA.w||3.4;
	let cd=1e9;
	// 桶化 (2026-11-13 性能批 A): 与 rawHeight delta/hgridClear 共用 'chans' 桶 (reach=w+14.6)
	const carr=segQuery('chans',x,z,()=>DELTA_CHANS,(DELTA.w||3.4)+2.2+12.4,'polys');
	if(carr===false){
	for(const ch of DELTA_CHANS){
	for(let i=0;i<ch.length-1;i++){
	const dd=segDist(x,z,ch[i][0],ch[i][1],ch[i+1][0],ch[i+1][1]);
	if(dd<cd) cd=dd;
	}
	}
	}else if(carr) for(let q2=0;q2<carr.length;q2++){
	const enc=carr[q2], ch=DELTA_CHANS[enc>>10], si=enc&1023;
	const dd=segDist(x,z,ch[si][0],ch[si][1],ch[si+1][0],ch[si+1][1]);
	if(dd<cd) cd=dd;
	}
	if(cd<cw) h-=1.2*sstep(1-cd/cw);
	}
	if(DELTA.ponds&&DELTA.ponds.length){
	// 桶化 (2026-11-13 性能批 A): 与 rawHeight delta 共用 'dponds' 桶 (外扩 r+15.8)
	const pdarr=segQuery('dponds',x,z,()=>DELTA.ponds,3.4+12.4,'circs');
	if(pdarr===false){
	for(const pd of DELTA.ponds){
	const pdD=Math.hypot(x-pd.x,z-pd.z);
	if(pdD<pd.r+1.2) h-=(pd.t==='lotus'?0.65:0.85)*sstep(1-pdD/(pd.r+1.2));
	}
	}else if(pdarr) for(let q2=0;q2<pdarr.length;q2++){
	const pd=DELTA.ponds[pdarr[q2]];
	const pdD=Math.hypot(x-pd.x,z-pd.z);
	if(pdD<pd.r+1.2) h-=(pd.t==='lotus'?0.65:0.85)*sstep(1-pdD/(pd.r+1.2));
	}
	}
	}
	// 支流汊港 (淞沪 delta.channels): 浅切, 不进激流语义 (rawHeight 已含, 此处仅 HGRID 带外快路需要)
	// 注: rawHeight 内已下切; 此处不重复叠加
	// ── 建筑地基平台 (2026-09-20): 排在"壕沟/河道"下切**之后** —— 建筑不会长在河沟里(选址已避), 但
	//    壕沟不参与建筑选址, 战壕横穿地基会把楼面重新切成壕沟(实测: 塔拉瓦两处椰木掩体室内 1.3m 沟);
	//    地基是"施工完成面", 压在天然下切之上。桥面抬升仍在其后(桥面优先)。
	h=padHeight(x,z,h);
	// 大桥桥面: 桥矩形区域内地面抬升至桥面高度 (两岸衔接, 步兵/车辆直接通行)
	// noBridge: 采样真实河床/地面 (水面高度计算用, 避免把桥面当河床)
	if(!noBridge&&BRIDGES.length){
	const dy=onBridge(x,z); // 返回桥面高度或 false
	if(dy!==false&&dy>h) h=dy;
	}
	return h;
}
// ===== 高度查询修正带清空场 (2026-09-06 B6/P1-5): 3m 粗格惰性缓存"格心到最近修正特征的带外距离" =====
// 特征集: FLATS 平台/博卡日土路/壕沟/河道/桥面抬升。格心带距>0 ⇒ 全格点各修正项恒为 0
// (smoothstep 在特征半径外精确为 0), 快路直接返回 rawHeight。惰性首触填充, 无启动停顿。零插值保证逐位等价。
const HGRID={res:3, N:Math.ceil((MAP_SIZE+120)/3), off:(MAP_SIZE+120)/2, data:null};
// 2026-11-13 性能批 B: 缓存壳保持原样 (惰性首触填 Float32 场), 全扫计算体拆成 hgridClearFast (桶化候选集)
// 与 hgridClearSlow (旧实现留档, 纯函数)。window.HGRID_OFF ⇒ 走 Slow (heightAt 侧已有同旗总门)。
// 等价性: 各小表 (FLATS/PADS/TRENCHES/ridges/paddy/ponds/terraces/maos/benches/BRIDGES) 逐字保留;
// 大折线表 (RIVER/CHANS/gullies/ALPINE) 与 roads (经 roadDist) 走桶化候选集 —— 候选集外条目的
// dd = 距离-半径 > 带 PAD(2.2)+1 (reach=阈值+2.2+12.4 ⇒ 保found半径=阈值+1), 而 argmin 条目 dd≤PAD 时
// 必在候选集内 ⇒ 新 m ≥ 旧 m 且旧 m≤PAD 时逐位相等 ⇒ 快路判定 (>0) 逐位一致 (唯一消费方 heightAt:734)。
function hgridClear(iI,jJ){
let d=HGRID.data;
// 2026-11-13 性能批 B: 空格哨兵 -1→NaN (fill(-1)+cached>=0 的旧哨兵使**负值 clear 永不命中缓存** ——
// 带内格每次 heightAt 都重走全扫, 正是剖析里 hgridClear 自耗时的主因)。唯一消费方 heightAt:734 只判
// >0, fround 存储保号 ⇒ 缓存命中判定/快路决策逐位一致。
if(d===null){ d=HGRID.data=new Float32Array(HGRID.N*HGRID.N); d.fill(NaN); }
const idx=jJ*HGRID.N+iI, cached=d[idx];
if(cached===cached) return cached;
const clear=window.HGRID_OFF?hgridClearSlow(iI,jJ):hgridClearFast(iI,jJ);
d[idx]=clear;
return clear;
}
function hgridClearSlow(iI,jJ){
const cx=iI*HGRID.res-HGRID.off+HGRID.res/2, cz=jJ*HGRID.res-HGRID.off+HGRID.res/2;
const PAD=2.2; // 格半对角≈2.12 + 余量
let m=1e9;
for(let k=0;k<FLATS.length;k++){ const f=FLATS[k]; const dd=Math.hypot(cx-f.x,cz-f.z)-f.r; if(dd<m) m=dd; }
// 建筑地基平台 (同 FLATS 支): 平台矩形外廓 + ramp 之外才可走快路 (旧写法用已废弃的 r1 字段 ⇒ NaN ⇒ 平台被快路吃掉)
// ★2026-09-26 修 (等价探针实测): 旧版这里沿用 padHeight 的 `dx²+dz²>p.reach2 ⇒ continue` 提前跳过 ——
//   但 padHeight 是**逐点**判定, hgridClear 只能拿**格心**去代表整格。reach2 是"矩形外接圆 + ramp"的半径,
//   格心落在圆外、而格内某点仍在裙坡带里的情形确实存在 (矩形角落方向: 到矩形与到中心的距离不是一回事) ——
//   那一格因此丢掉整个平台项, 快路把带裙坡的地形当成裸地形 (柏林实测差 2.5e-4m)。
//   去掉这个提前跳过即可 (PADS 条目数十量级, 且本函数惰性缓存、每格只算一次); 其余判据与 padHeight 逐条对齐。
for(let k=0;k<PADS.length;k++){
const p=PADS[k];
const dx=cx-p.x, dz=cz-p.z;
const lx=dx*p.cs-dz*p.sn, lz=dx*p.sn+dz*p.cs;
const ax=Math.abs(lx)-p.hw, az=Math.abs(lz)-p.hd;
const dd=(ax<=0&&az<=0)?-1:Math.hypot(ax>0?ax:0,az>0?az:0)-p.ramp;
if(dd<m) m=dd;
}
if(RURAL_FIELDS.length&&!CITY){ const dd=roadDist(cx,cz)-4; if(dd<m) m=dd; } // !CITY 门控同 heightAt 下沉项
for(let k=0;k<TRENCHES.length;k++){ const t=TRENCHES[k]; const dd=segDist(cx,cz,t.x1,t.z1,t.x2,t.z2)-2.4; if(dd<m) m=dd; }
if(RIVER){
const P=RIVER.pts; let rd=1e9;
for(let k=0;k<P.length-1;k++){ const dd=segDist(cx,cz,P[k][0],P[k][1],P[k+1][0],P[k+1][1]); if(dd<rd) rd=dd; }
const dd=rd-RIVER.w; if(dd<m) m=dd;
}
// 支流汊港 (淞沪): rawHeight 内下切 —— 带外快路必须感知, 否则修正项漏算
if(DELTA_CHANS.length){
const cw=DELTA.w||3.4;
for(const ch of DELTA_CHANS){
for(let k=0;k<ch.length-1;k++){
const dd=segDist(cx,cz,ch[k][0],ch[k][1],ch[k+1][0],ch[k+1][1])-cw;
if(dd<m) m=dd;
}
}
}
// 田埂微抬 (淞沪 ridges): rawHeight 内, 带宽 2.2
if(DELTA&&DELTA.ridges){
for(const r of DELTA.ridges){
const dd=segDist(cx,cz,r.x0,r.z0,r.x1,r.z1)-2.2;
if(dd<m) m=dd;
}
}
// 圩田下沉 (淞沪 paddy): rawHeight 内, 边缘过渡 1.5
if(DELTA&&DELTA.paddy){
for(const p of DELTA.paddy){
const mx0=Math.abs(cx-p.x0), mx1=Math.abs(cx-p.x1), mz0=Math.abs(cz-p.z0), mz1=Math.abs(cz-p.z1);
// 矩形外最近边距离近似
let dd=1e9;
if(cx<p.x0) dd=Math.min(dd,p.x0-cx); if(cx>p.x1) dd=Math.min(dd,cx-p.x1);
if(cz<p.z0) dd=Math.min(dd,p.z0-cz); if(cz>p.z1) dd=Math.min(dd,cz-p.z1);
if(cx>=p.x0&&cx<=p.x1&&cz>=p.z0&&cz<=p.z1) dd=-1; // 内部
const e=dd-1.5; if(e<m) m=e;
}
}
// 鱼塘/藕塘 (淞沪 ponds): rawHeight 内
if(DELTA&&DELTA.ponds){
for(const pd of DELTA.ponds){
const dd=Math.hypot(cx-pd.x,cz-pd.z)-(pd.r+1.2);
if(dd<m) m=dd;
}
}
// 黄土深沟 (百团): rawHeight 内下切 —— 沟壑带 + 塬面/峁/渡台高程带 (2026-09-12 立体化)
if(LOESS&&LOESS.gullies){
const gw=(LOESS.w||14);
for(const g of LOESS.gullies){
for(let k=0;k<g.length-1;k++){
const dd=segDist(cx,cz,g[k][0],g[k][1],g[k+1][0],g[k+1][1])-gw;
if(dd<m) m=dd;
}
}
if(LOESS.terraces) for(const t2 of LOESS.terraces){ const dd=rectDist(cx,cz,t2.x0,t2.z0,t2.x1,t2.z1)-14; if(dd<m) m=dd; }
if(LOESS.maos) for(const m2 of LOESS.maos){ const dd=Math.hypot(cx-m2.x,cz-m2.z)-m2.r; if(dd<m) m=dd; }
if(LOESS.benches) for(const b2 of LOESS.benches){ const dd=rectDist(cx,cz,b2.x0,b2.z0,b2.x1,b2.z1)-12; if(dd<m) m=dd; }
}
// 莫斯科主脊 (alpine): rawHeight 内 ridge 场 —— 带外距离 70m
if(ALPINE){
const R=ALPINE.ridges[0];
for(let k=0;k<R.length-1;k++){
const dd=segDist(cx,cz,R[k][0],R[k][1],R[k+1][0],R[k+1][1])-70;
if(dd<m) m=dd;
}
}
// 桥面抬升带 (noBridge 双语义共存): 与 PADS 同口径按**桥矩形到格心的距离**记账, 而不是一刀切。
// ★2026-09-26 性能批修: 旧版这一行是 `if(BRIDGES.length) m=-1;` —— 只要图上有桥, 全图每一格都被判"带内",
//   heightAt 的 HGRID 快路在胡康/淞沪/塔拉瓦(栈桥)/断崖(铁路桥) 四张图上命中率恒为 0
//   (实测 12~14µs/次 vs 快路 1.7µs/次, 而 heightAt 是射线/寻路/布娃娃/坦克的全库热点)。
//   语义上本来就是错的: heightAt 的桥面支只在**桥矩形内**生效 (onBridge 的 |ax|<len/2 && |pv|<w/2),
//   矩形外逐位等于不带桥的结果 ⇒ 带外格可以安全走快路。这里按矩形外距离记账, 与 PADS 支同一套算法
//   (轴系变换 + 外廓距离), 桥矩形 → 格心距离 < PAD 的格才判带内、走精修。
//   两种 noBridge 取值也随之自动正确: 带外格两义同值 (rawHeight), 带内格照旧走精修分支。
for(let k=0;k<BRIDGES.length;k++){
const B=BRIDGES[k];
const dx=cx-B.x, dz=cz-B.z;
const ax=Math.abs(dx*Math.sin(B.yaw)+dz*Math.cos(B.yaw))-B.len/2;
const pv=Math.abs(dx*Math.cos(B.yaw)-dz*Math.sin(B.yaw))-B.w/2;
const dd=(ax<=0&&pv<=0)?-1:Math.hypot(ax>0?ax:0,pv>0?pv:0);
if(dd<m) m=dd;
}
return m-PAD;
}
// 桶化实现 (2026-11-13 性能批 B): 与 Slow 同一 min 归约顺序; 仅 RIVER/CHANS/gullies/ALPINE 四段大折线
// 扫描换成桶化候选集 (roads 经 roadDist 内部桶化), 其余小表逐字同 Slow。
function hgridClearFast(iI,jJ){
const cx=iI*HGRID.res-HGRID.off+HGRID.res/2, cz=jJ*HGRID.res-HGRID.off+HGRID.res/2;
const PAD=2.2; // 格半对角≈2.12 + 余量
let m=1e9;
for(let k=0;k<FLATS.length;k++){ const f=FLATS[k]; const dd=Math.hypot(cx-f.x,cz-f.z)-f.r; if(dd<m) m=dd; }
// 建筑地基平台 (同 FLATS 支): 平台矩形外廓 + ramp 之外才可走快路
for(let k=0;k<PADS.length;k++){
const p=PADS[k];
const dx=cx-p.x, dz=cz-p.z;
const lx=dx*p.cs-dz*p.sn, lz=dx*p.sn+dz*p.cs;
const ax=Math.abs(lx)-p.hw, az=Math.abs(lz)-p.hd;
const dd=(ax<=0&&az<=0)?-1:Math.hypot(ax>0?ax:0,az>0?az:0)-p.ramp;
if(dd<m) m=dd;
}
if(RURAL_FIELDS.length&&!CITY){ const dd=roadDist(cx,cz)-4; if(dd<m) m=dd; } // !CITY 门控同 heightAt 下沉项
for(let k=0;k<TRENCHES.length;k++){ const t=TRENCHES[k]; const dd=segDist(cx,cz,t.x1,t.z1,t.x2,t.z2)-2.4; if(dd<m) m=dd; }
if(RIVER){
const P=RIVER.pts; let rd=1e9;
const rarr=segQuery('river',cx,cz,()=>P,(RIVER.w||1.9)+2.2+12.4,'poly1');
if(rarr===false){
for(let k=0;k<P.length-1;k++){ const dd=segDist(cx,cz,P[k][0],P[k][1],P[k+1][0],P[k+1][1]); if(dd<rd) rd=dd; }
}else if(rarr) for(let q=0;q<rarr.length;q++){
const k=rarr[q];
const dd=segDist(cx,cz,P[k][0],P[k][1],P[k+1][0],P[k+1][1]); if(dd<rd) rd=dd;
}
const dd=rd-RIVER.w; if(dd<m) m=dd;
}
// 支流汊港 (淞沪): rawHeight 内下切 —— 带外快路必须感知, 否则修正项漏算
if(DELTA_CHANS.length){
const cw=DELTA.w||3.4;
const carr=segQuery('chans',cx,cz,()=>DELTA_CHANS,(DELTA.w||3.4)+2.2+12.4,'polys');
if(carr===false){
for(const ch of DELTA_CHANS){
for(let k=0;k<ch.length-1;k++){
const dd=segDist(cx,cz,ch[k][0],ch[k][1],ch[k+1][0],ch[k+1][1])-cw;
if(dd<m) m=dd;
}
}
}else if(carr) for(let q=0;q<carr.length;q++){
const enc=carr[q], ch=DELTA_CHANS[enc>>10], si=enc&1023;
const dd=segDist(cx,cz,ch[si][0],ch[si][1],ch[si+1][0],ch[si+1][1])-cw;
if(dd<m) m=dd;
}
}
// 田埂微抬 (淞沪 ridges): rawHeight 内, 带宽 2.2
if(DELTA&&DELTA.ridges){
for(const r of DELTA.ridges){
const dd=segDist(cx,cz,r.x0,r.z0,r.x1,r.z1)-2.2;
if(dd<m) m=dd;
}
}
// 圩田下沉 (淞沪 paddy): rawHeight 内, 边缘过渡 1.5
if(DELTA&&DELTA.paddy){
for(const p of DELTA.paddy){
const mx0=Math.abs(cx-p.x0), mx1=Math.abs(cx-p.x1), mz0=Math.abs(cz-p.z0), mz1=Math.abs(cz-p.z1);
// 矩形外最近边距离近似
let dd=1e9;
if(cx<p.x0) dd=Math.min(dd,p.x0-cx); if(cx>p.x1) dd=Math.min(dd,cx-p.x1);
if(cz<p.z0) dd=Math.min(dd,p.z0-cz); if(cz>p.z1) dd=Math.min(dd,cz-p.z1);
if(cx>=p.x0&&cx<=p.x1&&cz>=p.z0&&cz<=p.z1) dd=-1; // 内部
const e=dd-1.5; if(e<m) m=e;
}
}
// 鱼塘/藕塘 (淞沪 ponds): rawHeight 内
if(DELTA&&DELTA.ponds){
for(const pd of DELTA.ponds){
const dd=Math.hypot(cx-pd.x,cz-pd.z)-(pd.r+1.2);
if(dd<m) m=dd;
}
}
// 黄土深沟 (百团): rawHeight 内下切 —— 沟壑带 + 塬面/峁/渡台高程带 (2026-09-12 立体化)
if(LOESS&&LOESS.gullies){
const gw=(LOESS.w||14);
const garr=segQuery('gullies',cx,cz,()=>LOESS.gullies,gw+14.6,'polys');
if(garr===false){
for(const g of LOESS.gullies){
for(let k=0;k<g.length-1;k++){
const dd=segDist(cx,cz,g[k][0],g[k][1],g[k+1][0],g[k+1][1])-gw;
if(dd<m) m=dd;
}
}
}else if(garr) for(let q=0;q<garr.length;q++){
const enc=garr[q], g=LOESS.gullies[enc>>10], si=enc&1023;
const dd=segDist(cx,cz,g[si][0],g[si][1],g[si+1][0],g[si+1][1])-gw;
if(dd<m) m=dd;
}
if(LOESS.terraces) for(const t2 of LOESS.terraces){ const dd=rectDist(cx,cz,t2.x0,t2.z0,t2.x1,t2.z1)-14; if(dd<m) m=dd; }
if(LOESS.maos) for(const m2 of LOESS.maos){ const dd=Math.hypot(cx-m2.x,cz-m2.z)-m2.r; if(dd<m) m=dd; }
if(LOESS.benches) for(const b2 of LOESS.benches){ const dd=rectDist(cx,cz,b2.x0,b2.z0,b2.x1,b2.z1)-12; if(dd<m) m=dd; }
}
// 莫斯科主脊 (alpine): rawHeight 内 ridge 场 —— 带外距离 70m
if(ALPINE){
const R=ALPINE.ridges[0];
const aarr=segQuery('aridge',cx,cz,()=>R,70+2.2+12.4,'poly1');
if(aarr===false){
for(let k=0;k<R.length-1;k++){
const dd=segDist(cx,cz,R[k][0],R[k][1],R[k+1][0],R[k+1][1])-70;
if(dd<m) m=dd;
}
}else if(aarr) for(let q=0;q<aarr.length;q++){
const k=aarr[q];
const dd=segDist(cx,cz,R[k][0],R[k][1],R[k+1][0],R[k+1][1])-70;
if(dd<m) m=dd;
}
}
// 桥面抬升带: 按桥矩形到格心的距离记账 (与 PADS 同口径)
for(let k=0;k<BRIDGES.length;k++){
const B=BRIDGES[k];
const dx=cx-B.x, dz=cz-B.z;
const ax=Math.abs(dx*Math.sin(B.yaw)+dz*Math.cos(B.yaw))-B.len/2;
const pv=Math.abs(dx*Math.cos(B.yaw)-dz*Math.sin(B.yaw))-B.w/2;
const dd=(ax<=0&&pv<=0)?-1:Math.hypot(ax>0?ax:0,pv>0?pv:0);
if(dd<m) m=dd;
}
return m-PAD;
}
// 桥面高度: 取桥两端外侧的岸边地面高度 (惰性求值, 采样点在桥矩形外避免递归)
// 多桥: 每座桥独立缓存 deckY (淞沪石拱桥×2 共用 BRIDGES 表)
const _bridgeDeckY=new Map();
function bridgeDeckY(B){
const b=B||BRIDGE;
if(!b) return 0;
// 栈桥 (kind='pier', 2026-09-18): 桥面是固定海拔的固定构件 (不随两岸地形起伏) —— 直接给绝对高度
if(b.deckY!==undefined) return b.deckY;
if(!_bridgeDeckY.has(b)){
const dx=Math.sin(b.yaw), dz=Math.cos(b.yaw);
const e=b.len/2+3;
_bridgeDeckY.set(b, Math.max(heightAt(b.x-dx*e,b.z-dz*e), heightAt(b.x+dx*e,b.z+dz*e)));
}
return _bridgeDeckY.get(b);
}
// 是否在大桥桥面上 (m 为外扩余量): 返回桥面高度 (number) 或 false
// 多桥扫描 BRIDGES; heightAt 取最高桥面 (重叠罕见, 取 max 安全)
function onBridge(x,z,m=0){
let hit=false;
for(const B of BRIDGES){
const lx=x-B.x, lz=z-B.z;
const ax=lx*Math.sin(B.yaw)+lz*Math.cos(B.yaw);
const pv=lx*Math.cos(B.yaw)-lz*Math.sin(B.yaw);
if(Math.abs(ax)<B.len/2+m&&Math.abs(pv)<B.w/2+m){
const dy=bridgeDeckY(B);
hit=(hit===false)?dy:Math.max(hit,dy);
}
}
return hit;
}
// ══════════════════════════════════════════════════════════════════════════════
// 桥面下埋 (2026-09-21 海战图 7 项优化 · 第 5 项: 栈桥显示 BUG + 全库"图层打架")
// 根因 (已核, 不重复诊断): heightAt 在桥矩形内把地形抬到 deckY (本文件 :678-681), 而桥面**结构盒的顶面
//   也正好是 deckY** (栈桥 05a pierTrestle :1850 / 通用桥 05c buildBridge :828 / 巨桥 05a grandBridge :1296 /
//   石桥 05a stoneBridge :1188) ⇒ 两块**独立三角化的不透明面**在位相同一 Y 共面 → z-fighting 麻点。
//   相机 near=0.08 / far=900 (02-scene:17, ≈1:11250) 没有任何深度精度预算: 24bit 深度分辨率
//   ≈ z²/(near·2²⁴) ⇒ 50m≈1.9mm / 100m≈7.5mm / 200m≈3.0cm / 300m≈6.7cm —— "位相同一 Y"的面在任何距离都必闪。
// 口径: **绝不动 heightAt 的物理/可站立值** (步兵/坦克/Bot 建筑避让/水态/onBridge/bridgeDeckY 全依赖它),
//   只把**地形渲染网格的顶点高度**退到桥面之下 ⇒ 走桥照旧走 heightAt=deckY, 看得见的沙脊不再与木桥面抢同一个像素。
// 下埋量按"到桥矩形**内**边缘的距离"渐变: 边缘 0.04 → 内区 0.10 (SINK_FADE 内走 sstep):
//   · 为什么不是 0.10 一刀切: 桥缘那一格的地形面比桥面低得越多, 桥缘"露出的沙边"越厚; 0.04m ≈ 木面板厚的
//     1/8, 远处不可辨, 同时 0.04 已比 100m 处深度分辨率 (7.5mm) 大 5 倍 ⇒ 彻底脱离闪点区。
//   · 为什么不会在桥缘留下垂直台阶: 下埋是**连续函数**、在矩形外恒为 0, 且在边缘保留 0.04 余量 (不是收到 0,
//     否则边缘那一列顶点又会回到 deckY 与桥面共面); 地形网格 ~2.77m 一格, 桥缘那一格本来就是
//     "桥面平台→天然地形"的陡降 (与下埋前逐字相同, 只是整体低 4cm) —— 没有新增台阶, 也没有新暴露面。
//   · 为什么不再埋更深 (例如桥面盒厚 0.32 以上): 桥下礁盘/河床的地形面**同时是海面网格的剔除判据**
//     (05c buildSeaMesh 按 heightAt 剔三角, 桥下海面已被剔空) —— 下埋超过桥面盒厚度会露出"海面破洞"。
//   · 与海面 3cm 几何埋入 (05c:1957 `SEA.level-0.03` + depthWrite:false, 注释原文"消除 z-fighting 麻点")
//     的分工: 海面是**大面积半透明贴片**, 靠 depthWrite:false 退出深度竞争 + renderOrder 排后, 3cm 几何埋入
//     只负责让水线不在陆地上"切一刀"; 桥面/铺装/浪花是**写深度的面片**, 靠 05-world `depthOffset` 的
//     polygonOffset 档位在深度测试里分先后。二者不互相替代: 大面积半透明 → 几何埋入+depthWrite:false;
//     小块写深度面片 → polygonOffset。
// 生效点 (两处, 缺一不可): ① 本文件载入期地形网格构建 (:900 写 Y); ② refreshTerrainMesh (:1123, 建筑地基
//   平台/岸防炮位登记后重刷地形顶点时会用 heightAt 覆盖回去 ⇒ 必须同源, 否则桥面又被拉回共面)。
const BRIDGE_SINK_EDGE=0.04;   // 桥矩形边缘 (到内缘距离 0) 的下埋量
const BRIDGE_SINK_MID=0.10;    // 矩形内区 (到内缘距离 ≥ BRIDGE_SINK_FADE) 的下埋量
const BRIDGE_SINK_FADE=1.6;    // 边缘→内区的渐变宽度 (m)
// 该点应下埋的量 (0 = 不下埋)。h 传入时**只在"该点高度确实由本桥抬升提供"时才下埋** (h≈deckY):
// 天然地形高于桥面的点 (若日后有桥落在高地上) 不许被挖凹 —— heightAt 不抬升时其值也不会等于 deckY, 自动豁免。
function bridgeDeckSinkAt(x,z,h){
let s=0;
const checkH=(h!==undefined);
for(let k=0;k<BRIDGES.length;k++){
const B=BRIDGES[k];
const lx=x-B.x, lz=z-B.z;
// 轴系与 onBridge 逐字一致: ax=沿桥轴 (对应 B.len), pv=垂直桥向 (对应 B.w)
const ax=lx*Math.sin(B.yaw)+lz*Math.cos(B.yaw);
const pv=lx*Math.cos(B.yaw)-lz*Math.sin(B.yaw);
const dA=B.len/2-Math.abs(ax), dV=B.w/2-Math.abs(pv);
if(dA<=0||dV<=0) continue;                 // 矩形外: 不下埋
if(checkH&&Math.abs(h-bridgeDeckY(B))>1e-3) continue;
const v=BRIDGE_SINK_EDGE+(BRIDGE_SINK_MID-BRIDGE_SINK_EDGE)*sstep(Math.min(1,Math.min(dA,dV)/BRIDGE_SINK_FADE));
if(v>s) s=v;
}
return s;
}
// 地形网格写入高度 = heightAt − 桥面下埋。**只给地形网格顶点用**; 物理/可站立/寻路/水态一律仍走 heightAt。
function terrainRenderY(x,z){
const h=heightAt(x,z);
if(!BRIDGES.length) return h;
return h-bridgeDeckSinkAt(x,z,h);
}
// ── 渲染弦面采样单源 (★2026-11-15 弹坑批二轮修, 用户实报"弹坑只露几条黑弧") ──
// 病根: 渲染地形 = TERRAIN_CHUNKS (4×4 chunk PlaneGeometry) 把 terrainRenderY 采在 ~2.8m 节点格上
//   做**线性三角化**; 而解析 heightAt 在裙摆 ramp/壕沟/道路下切这些曲率大的特征上与"节点弦面"可差
//   0.3~1.2m (弦线切过凹弧上方)。任何"贴地形"的覆盖件 (弹坑贴花) 若按解析 heightAt 取高, 在这些
//   区段整片沉进渲染面之下 —— 只剩抬升的唇缘脊露出地面 = 实机截图的黑弧。
// 修法: 这里按**同格同三角化**精确重算 GPU 实际画出来的表面高度:
//   · 格距/原点: chunk 网格全局等距 (chunk 宽 = chunkSeg×dx, 整倍数 ⇒ 跨 chunk 无缝), 复算 chunkSeg
//     与 dx 与构建段 (下方网格构建块) 逐式一致;
//   · 三角化: three PlaneGeometry 固定对角 b(i,j+1)→d(i+1,j), 即局部 (u,v) 的 u+v=1 线 ——
//     u+v≤1 用 (00,01,10) 三角平面, 否则用 (01,11,10) 平面, 与 GPU 逐点一致。
// 消费: 05b-props crater() 顶点采样 (贴花类覆盖件的唯一正确取面); 语义仍是"渲染面" —— 物理判定
//   (站立/碰撞/水态) 一律继续走 heightAt, 本函数不参与任何游戏逻辑。
const TRS=(()=>{
const totalW=MAP_SIZE+40;
const seg=Math.max(64,Math.round(totalW/2.76));
const cseg=Math.max(16,Math.round(seg/4));
return {x0:-totalW/2,z0:-totalW/2,dx:totalW/(4*cseg),n:4*cseg};
})();
function terrainSurfaceY(x,z){
let i=Math.floor((x-TRS.x0)/TRS.dx), j=Math.floor((z-TRS.z0)/TRS.dx);
i=clamp(i,0,TRS.n-2); j=clamp(j,0,TRS.n-2);
const u=clamp((x-TRS.x0)/TRS.dx-i,0,1), v=clamp((z-TRS.z0)/TRS.dx-j,0,1);
const y00=terrainRenderY(TRS.x0+i*TRS.dx,TRS.z0+j*TRS.dx);
const y10=terrainRenderY(TRS.x0+(i+1)*TRS.dx,TRS.z0+j*TRS.dx);
const y01=terrainRenderY(TRS.x0+i*TRS.dx,TRS.z0+(j+1)*TRS.dx);
const y11=terrainRenderY(TRS.x0+(i+1)*TRS.dx,TRS.z0+(j+1)*TRS.dx);
if(u+v<=1) return y00+(y10-y00)*u+(y01-y00)*v;
return (y01+y10-y11)+(y11-y01)*u+(y11-y10)*v;
}
// 徒涉滩强度场 (0..1, 1=滩心): RIVER.ford={x,z,r} 滩心全效, r..r+9 平滑过渡到 0
// 消费: heightAt 下切缩放 / inRiverChannel 激流豁免 / inShallowChannel 涉水减速 (2026-09-12 胡康巨桥改版)
function fordAt(x,z){
if(!RIVER||!RIVER.ford) return 0;
const F=RIVER.ford;
const d=Math.hypot(x-F.x,z-F.z);
if(d>=F.r+9) return 0;
if(d<=F.r) return 1;
const k=1-(d-F.r)/9;
return k*k*(3-2*k);
}
// 是否在深谷河道内 (桥面/徒涉滩豁免): Bot/坦克寻路阻挡 + 徒涉激流判定的统一依据
function inRiverChannel(x,z){
if(!RIVER||!(RIVER.d>2)) return false;
if(onBridge(x,z)!==false) return false;
if(fordAt(x,z)>0.5) return false; // 徒涉滩心: 可涉渡 (OCC 放行+激流伤害豁免)
const P=RIVER.pts;
for(let i=0;i<P.length-1;i++){
if(segDist(x,z,P[i][0],P[i][1],P[i+1][0],P[i+1][1])<RIVER.w*0.8) return true;
}
return false;
}
// 激流伤害/冲移/警告的水态门 (2026-11-15 用户实机"没下水也在激流中"): inRiverChannel 是**纯平面**判据
// (水平带宽 w*0.8=20.8m), 胡康沟壁 73~79° —— 岸坡高出水面 4~6m 的干地也在带内 ⇒ 站岸上吃伤+冲移+警告。
// 消费点 (20-player 伤害/减速+警告, 14-bots, 15-vehicles) 一律改用本门: 平面在河道带内 **且** 该点真被水
// 淹没 (waterDepthAt>0.2 = 河床高程低于水面)。OCC 阻挡/免摔伤/布景排除仍用平面版 (那些语义关心的是
// "河谷走廊"而不是"水", 且 OCC 是静态账没有高程语境 —— 契约: 水态单源 waterStateAt 同款口径)。
function inRiverWater(x,z){
return inRiverChannel(x,z)&&waterDepthAt(x,z)>0.2;
}
// 是否在浅水河道/支流/鱼塘/徒涉滩内 (涉水减速, 无激流伤害): 主河 d<=2 或支流汊港 或 鱼塘藕塘 或 ford 滩心
// 2026-09-12: 主河已加深 d=2.8 → 激流; 浅水=支流+鱼塘+胡康徒涉滩
function inShallowChannel(x,z){
if(onBridge(x,z)!==false) return false;
if(fordAt(x,z)>0.5) return true;
if(RIVER&&!(RIVER.d>2)){
const P=RIVER.pts;
for(let i=0;i<P.length-1;i++){
if(segDist(x,z,P[i][0],P[i][1],P[i+1][0],P[i+1][1])<RIVER.w*0.75) return true;
}
}
if(DELTA_CHANS.length){
for(const ch of DELTA_CHANS){
for(let i=0;i<ch.length-1;i++){
if(segDist(x,z,ch[i][0],ch[i][1],ch[i+1][0],ch[i+1][1])<(DELTA.w||3.4)*0.8) return true;
}
}
}
// 鱼塘/藕塘: 圆内视作浅水 (减速无伤害)
if(DELTA&&DELTA.ponds){
for(const pd of DELTA.ponds){
if(Math.hypot(x-pd.x,z-pd.z)<pd.r) return true;
}
}
return false;
}
// 河道下游方向 (激流冲移用)
function riverDirAt(x,z){
if(!RIVER) return null;
let bd=1e9, dir=null;
const P=RIVER.pts;
for(let i=0;i<P.length-1;i++){
const d=segDist(x,z,P[i][0],P[i][1],P[i+1][0],P[i+1][1]);
if(d<bd){ bd=d; const dx=P[i+1][0]-P[i][0], dz=P[i+1][1]-P[i][1], l=Math.hypot(dx,dz)||1; dir=[dx/l,dz/l]; }
}
return dir;
}
// 各战役的战壕布局 (需在地形网格生成前注册)。
// 两种写法: ① `{rel:[岸名,a1,d1,a2,d2]}` —— 岸名取 'shore'|'north'|'west'|'east', a=沿岸坐标 (x 或 z),
// d=**入陆距离**(m>0 向陆); ② 绝对折线 [x1,z1,x2,z2] (岛内/非环海战役)。
// 展开走 00-config `trenchLine` 单源 (与 22a 沙盘共读; 岸线算术只写一处, 纲领 §4.3)
const TRENCHES=[];
for(const t of (CAMPAIGN.trench||[])){
const L2=(typeof trenchLine==='function')?trenchLine(t):null;
if(L2) TRENCHES.push({x1:L2[0],z1:L2[1],x2:L2[2],z2:L2[3]});
}
// 正弦路纵线 (2026-09-06 B7a/P2-12: 地形判定/电线杆/小地图/部署图四处共读, 改公式只动这里)
// 波形常量在 00-config SINE_ROAD 单源 (22a-menuart 沙盘自算同一波形, 免依赖本文件加载序)
function sineRoadZ(x){ return SINE_ROAD.amp*Math.sin(x*SINE_ROAD.freq); }
function roadDist(x,z){
let d=CAMPAIGN.sineRoad?Math.abs(z - sineRoadZ(x)):1e9;
if(window.ROAD_OFF){ // 回退旗: 原全扫 (2026-11-13 性能批 A)
for(const r of CAMPAIGN.roads){
d=Math.min(d,segDist(x,z,r[0],r[1],r[2],r[3]));
}
return d;
}
// 桶化 (2026-11-13 性能批 A): 消费阈值最大 = 32 (mountain rawHeight 的 rim=sstep(clamp((rd-21)/11))
// 在 rd≥32 饱和; 其余消费方 (色带<5/heightAt<4/布局≤10/OCC>20 布尔) 全部 ≤20 或布尔) ⇒ reach=32+2.2+12.4。
// 正弦路 z=sineRoadZ(x) 是解析式, 不入桶。
const arr=segQuery('roads',x,z,()=>CAMPAIGN.roads,32+2.2+12.4,'segs');
if(arr===false){
for(const r of CAMPAIGN.roads){
d=Math.min(d,segDist(x,z,r[0],r[1],r[2],r[3]));
}
}else if(arr) for(let q=0;q<arr.length;q++){
const r=CAMPAIGN.roads[arr[q]];
const dd=segDist(x,z,r[0],r[1],r[2],r[3]);
if(dd<d) d=dd;
}
return d;
}
function segDist(px,pz,ax,az,bx,bz){
const abx=bx-ax,abz=bz-az;
const t=clamp(((px-ax)*abx+(pz-az)*abz)/(abx*abx+abz*abz),0,1);
return Math.hypot(px-(ax+abx*t), pz-(az+abz*t));
}
let GROUND_GEO=null; // 地形网格几何 (建筑地基平台登记后重刷, 见 refreshTerrainMesh)
const TERRAIN_CHUNKS=[]; // 4x4 分块地形网格 (视锥自动裁剪)

function calcTerrainVertexColor(x, z, hy){
const rd=roadDist(x,z);
let r=1,g=1,b=1;
if(rd<5){ const t=1-rd/5; r=lerp(1,1.16,t); g=lerp(1,0.94,t); b=lerp(1,0.72,t); }
// 城市街道色带 (2026-09-05 城市组): 街面灰褐 (柏油/碎石), 街缘 2.2m 渐变 —— 一眼读出街廊;
// 街块/厂区建成区压土色 (瓦砾+压实土), 消灭"城市=草地撒房子"
if(CITY){
const sd=streetDist(x,z);
if(sd<2.2){
const t=1-sd/2.2;
r=lerp(r,0.6,t); g=lerp(g,0.585,t); b=lerp(b,0.57,t);
}else if(cityUrban(x,z)){
r=lerp(r,0.56,0.72); g=lerp(g,0.51,0.72); b=lerp(b,0.44,0.72);
}
}
// 战壕土色贴层: 沟底沟沿露出翻掘的泥土色 (雪地战役下与积雪形成强对比)
let td=1e9;
for(const t2 of TRENCHES){ const dd=segDist(x,z,t2.x1,t2.z1,t2.x2,t2.z2); if(dd<td) td=dd; }
if(td<3.2){
const k=1-td/3.2, s=sstep(k)*0.92;
const dr=THEME.snow?0.62:0.74, dg=THEME.snow?0.5:0.62, db=THEME.snow?0.36:0.46;
r=lerp(r,dr,s); g=lerp(g,dg,s); b=lerp(b,db,s);
}
// 淞沪圩田色带 (2026-09-12): 支流泥滩褐 + 田埂土黄 + 圩田浸水绿 + 鱼塘/藕塘水面
if(CAMPAIGN.terr==='delta'){
// 支流: 沟缘泥滩
if(DELTA_CHANS.length){
const w=DELTA.w||3.4;
let cd=1e9;
for(const ch of DELTA_CHANS){
for(let i=0;i<ch.length-1;i++){
const d=segDist(x,z,ch[i][0],ch[i][1],ch[i+1][0],ch[i+1][1]);
if(d<cd) cd=d;
}
}
if(cd<w+2){
const t=1-clamp(cd/(w+2),0,1);
r=lerp(r,0.55,t*0.85); g=lerp(g,0.48,t*0.85); b=lerp(b,0.36,t*0.85);
}
}
// 圩田田面: 浸水暗绿 (比 rice 色带更深, 读出下沉)
if(DELTA&&DELTA.paddy){
for(const p of DELTA.paddy){
if(x>=p.x0&&x<=p.x1&&z>=p.z0&&z<=p.z1){
const dEdge=Math.min(x-p.x0,p.x1-x,z-p.z0,p.z1-z);
const t=clamp(dEdge/2.5,0,1);
r=lerp(r,0.42,t*0.55); g=lerp(g,0.58,t*0.55); b=lerp(b,0.38,t*0.55);
break;
}
}
}
// 田埂: 土黄细带
if(DELTA&&DELTA.ridges){
let rdg=1e9;
for(const rr of DELTA.ridges){
const d=segDist(x,z,rr.x0,rr.z0,rr.x1,rr.z1);
if(d<rdg) rdg=d;
}
if(rdg<2.2){
const t=1-rdg/2.2;
r=lerp(r,0.92,t*0.7); g=lerp(g,0.78,t*0.7); b=lerp(b,0.52,t*0.7);
}
}
// 鱼塘/藕塘: 藕=深绿浮叶, 鱼=青蓝水面
if(DELTA&&DELTA.ponds){
for(const pd of DELTA.ponds){
const d=Math.hypot(x-pd.x,z-pd.z);
if(d<pd.r+0.8){
const t=1-clamp(d/(pd.r+0.8),0,1);
if(pd.t==='lotus'){ r=lerp(r,0.28,t*0.8); g=lerp(g,0.48,t*0.8); b=lerp(b,0.26,t*0.8); }
else { r=lerp(r,0.32,t*0.75); g=lerp(g,0.48,t*0.75); b=lerp(b,0.52,t*0.75); }
break;
}
}
}
}
// 水乡水文色带 (2026-10-28, 与上方 heightAt 支汊/鱼塘下切同批): 塘缘/汊岸露泥滩褐 (下切后不再
// 是"草坡包着一汪水"), 塘底浸水暗绿 —— 淞沪 delta 色带同参, 仅钉 procgen (delta 已有自己的一份)。
if(CAMPAIGN.layout==='procgen'&&DELTA){
if(DELTA_CHANS.length){
const w2=DELTA.w||3.4;
let cd2=1e9;
for(const ch of DELTA_CHANS){
for(let i=0;i<ch.length-1;i++){
const d2=segDist(x,z,ch[i][0],ch[i][1],ch[i+1][0],ch[i+1][1]);
if(d2<cd2) cd2=d2;
}
}
if(cd2<w2+2){
const t2=1-clamp(cd2/(w2+2),0,1);
r=lerp(r,0.55,t2*0.85); g=lerp(g,0.48,t2*0.85); b=lerp(b,0.36,t2*0.85);
}
}
if(DELTA.ponds&&DELTA.ponds.length){
for(const pd of DELTA.ponds){
const d3=Math.hypot(x-pd.x,z-pd.z);
if(d3<pd.r+1.2){
const t3=1-clamp(d3/(pd.r+1.2),0,1);
r=lerp(r,0.30,t3*0.72); g=lerp(g,0.46,t3*0.72); b=lerp(b,0.34,t3*0.72);
break;
}
}
}
}
// 百团黄土沟壑色带 (2026-09-12 立体化): 沟底/渡台暗褐 / 沟壁陡崖崩积坡赭黄(愈深愈红) / 塬面峁顶麦黄 / 川地灰黄
if(CAMPAIGN.terr==='loess'&&LOESS){
const gd=gullyDist(x,z);
const W=LOESS.w||14, GB=LOESS.bottom||3;
if(gd<W){
if(gd<GB||hy<-3){
// 沟底/渡台: 阴湿暗褐
r=lerp(r,0.52,0.7); g=lerp(g,0.44,0.7); b=lerp(b,0.32,0.7);
}else{
// 沟壁: 崩积坡+陡崖赭黄, 愈近沟底愈红 (深度条带)
const k=clamp((hy+3)/12,0,1);
r=lerp(r,0.78,0.55+0.25*(1-k)); g=lerp(g,0.56,0.55+0.25*(1-k)); b=lerp(b,0.36,0.55+0.25*(1-k));
}
}else if(hy>7.2){
// 塬面/峁顶: 麦黄
r*=1.06; g*=0.96; b*=0.78;
}
}
// 雾林守线色带 (2026-09-13 许特根改版): 北谷湿泥/谷壁腐殖土 + 堑口土道 + 林地腐叶斑驳
if(CAMPAIGN.terr==='woods'&&WOOD&&WOOD.ravine){
const gd=woodRavineDist(x,z), W2=WOOD.ravine;
if(gd<W2.w){
if(gd<W2.bottom||woodRampMask(x,z)>0.35){
// 谷底泥径/堑口: 湿泥深褐 (车辙感)
r=lerp(r,0.44,0.72); g=lerp(g,0.37,0.72); b=lerp(b,0.27,0.72);
}else{
// 谷壁: 腐殖土棕 (湿滑崩积坡+陡唇)
r=lerp(r,0.55,0.6); g=lerp(g,0.46,0.6); b=lerp(b,0.33,0.6);
}
}else{
// 林地: 腐叶斑驳 (低频色斑调制, 落叶林地面不是均匀绿)
const m2=0.5+0.5*Math.sin(x*0.055+Math.sin(z*0.043)*1.7)*Math.cos(z*0.061+1.2);
r=lerp(r,0.82,0.22*m2); g=lerp(g,0.74,0.18*m2); b=lerp(b,0.6,0.16*m2);
}
}
// 塔拉瓦环礁色带 (2026-09-18 / 09-18b 复调"太亮·绿色太少"): 海床分带 (碎波白沫→湿沙→冲滩浅沙→
// 珊瑚礁盘斑驳→礁缘褐→深海床青灰) + 陆上 (白珊瑚沙滩→沙丘脊→草沙过渡→椰林草甸→密林地被) +
// 岬角岩台/珊瑚岭/珊瑚跑道。水下与陆上都是**乘法**调制 (底图 TEX.island = 中性斑驳 + 珊瑚碎屑),
// 土路/战壕的人工色带优先 (只叠 25% 地貌色, 不被草绿吃掉)。
if(CAMPAIGN.terr==='island'&&SEA){
const d=shoreDist(x,z);
let ir=1,ig=1,ib=1;
if(d>0){
const dep=seaDepthOfD(x,z,d);
if(d<1.6){ ir=1.18; ig=1.20; ib=1.16; }                       // 碎波白沫线 (岸线一眼可读)
else if(d<6){ ir=0.66; ig=0.64; ib=0.58; }                    // 湿沙
else if(d<22){ const k=sstep(clamp((d-6)/16,0,1)); ir=lerp(0.96,0.80,k); ig=lerp(0.94,0.80,k); ib=lerp(0.80,0.68,k); } // 冲滩水下沙滩 (见底)
else if(d<36){ const m2=0.5+0.5*Math.sin(x*0.09)*Math.cos(z*0.085); ir=lerp(0.30,0.55,m2); ig=lerp(0.55,0.80,m2); ib=lerp(0.35,0.50,m2); } // 珊瑚礁盘 (斑驳)
else if(d<43){ ir=0.28; ig=0.34; ib=0.30; }                   // 礁缘珊瑚褐
else { const k=clamp((dep-3.4)/6,0,1); ir=lerp(0.26,0.13,k); ig=lerp(0.32,0.19,k); ib=lerp(0.34,0.26,k); } // 外坡→深海床
}else{
const u=-d;
if(u<1.6){ ir=1.30; ig=1.30; ib=1.24; }                       // 岸边干沙高光 (与碎波带衔接)
else if(u<14){ ir=1.12; ig=1.08; ib=1.02; }                   // 白珊瑚沙滩
else if(u<20){ const k=sstep(clamp((u-14)/6,0,1)); ir=lerp(0.90,0.60,k); ig=lerp(0.86,0.72,k); ib=lerp(0.74,0.52,k); } // 沙丘脊→草沙过渡
else if(u<34){ const k=sstep(clamp((u-20)/14,0,1)); ir=lerp(0.60,0.24,k); ig=lerp(0.72,0.50,k); ib=lerp(0.52,0.24,k); } // 背坡台地: 转入椰林草甸
else{
// 内陆: 椰林草甸 ⇄ 密林地被 低频斑驳 (u 越深越绿越暗), 夹少量干草斑 (n2)
const n1=0.5+0.5*Math.sin(x*0.021+0.6)*Math.cos(z*0.019-1.1);
const n2=0.5+0.5*Math.sin(x*0.058-1.4)*Math.sin(z*0.052+0.9);
const deep=sstep(clamp((u-34)/70,0,1));
ir=lerp(0.24,0.11,n1)*(1-0.22*deep)*(1+0.18*n2);
ig=lerp(0.50,0.32,n1)*(1-0.14*deep);
ib=lerp(0.24,0.12,n1)*(1-0.20*deep);
}
}
if(SEA.heads) for(const hd of SEA.heads){
const dd=Math.hypot(x-hd.x,z-hd.z);
if(dd<hd.r*0.86){ const k=sstep(clamp(1-dd/(hd.r*0.86),0,1))*0.8; ir=lerp(ir,0.74,k); ig=lerp(ig,0.76,k); ib=lerp(ib,0.68,k); }
}
if(SEA.knoll){
const dd=Math.hypot(x-SEA.knoll.x,z-SEA.knoll.z);
if(dd<SEA.knoll.r*0.9){ const k=sstep(clamp(1-dd/(SEA.knoll.r*0.9),0,1))*0.7; ir=lerp(ir,0.60,k); ig=lerp(ig,0.72,k); ib=lerp(ib,0.48,k); }
}
{
const rd2=rectDist(x,z,SEA.runway.x0,SEA.runway.z0,SEA.runway.x1,SEA.runway.z1);
if(rd2<3){ const m3=0.5+0.5*Math.sin(x*0.13+z*0.07); ir=lerp(1.14,1.06,m3); ig=lerp(1.12,1.04,m3); ib=lerp(1.00,0.96,m3); }
else if(rd2<20){ const k=sstep(clamp(1-(rd2-3)/17,0,1)); ir=lerp(ir,1.10,k); ig=lerp(ig,1.08,k); ib=lerp(ib,0.98,k); }
}
if(rd<5||td<3.2){ r*=lerp(1,ir,0.25); g*=lerp(1,ig,0.25); b*=lerp(1,ib,0.25); }
else { r*=ir; g*=ig; b*=ib; }
}
// 莫斯科雪岭分带: 雪线以上裸岩灰白 / 雪线附近松林深绿 / 山麓雪覆浅灰
if(CAMPAIGN.terr==='alpine'&&ALPINE){
const sl=ALPINE.snowline||14;
if(hy>sl+4){
const k=clamp((hy-sl-4)/8,0,1)*0.85;
r=lerp(r,0.78,k); g=lerp(g,0.78,k); b=lerp(b,0.76,k);
}else if(hy>sl-2){
// 雪线带: 针叶深绿
r=lerp(r,0.42,0.45); g=lerp(g,0.58,0.45); b=lerp(b,0.42,0.45);
}else{
// 山麓: 雪覆浅灰绿
r=lerp(r,0.92,0.35); g=lerp(g,0.94,0.35); b=lerp(b,0.92,0.35);
}
}
// 诺曼底农田: 田块底色 (麦田金黄/玉米鲜绿/牧草亮绿/翻耕褐) + 田界土埂线
if(RURAL_FIELDS.length){
const fld=fieldAt(x,z);
if(fld){
let dr=1,dg=1,db=1;
const kw=fld.t==='wheat'?[1.17,0.99,0.62]:fld.t==='corn'?[0.96,1.13,0.72]:
fld.t==='rice'?[0.88,1.12,0.72]:fld.t==='pasture'?[0.93,1.11,0.9]:[1.08,0.88,0.66];
const kr=Math.min(x-fld.x0,fld.x1-x,z-fld.z0,fld.z1-z);
const k=Math.min(1,kr/2.5); const ks=sstep(k);
dr=lerp(1,kw[0],ks); dg=lerp(1,kw[1],ks); db=lerp(1,kw[2],ks);
if(kr<1.1){ const e=1-kr/1.1; dr*=lerp(1,0.86,e); dg*=lerp(1,0.83,e); db*=lerp(1,0.72,e); }
r*=dr; g*=dg; b*=db;
}
}
const n=Math.sin(x*0.4)*Math.cos(z*0.37);
r*=1+n*0.05; g*=1+n*0.05; b*=1+n*0.04;
return [r,g,b];
}

{
// 顶点密度 ~2.77m/格 (320 地图=130 段; 800 地图≈304 段保持分辨率)
const seg=Math.max(64,Math.round((MAP_SIZE+40)/2.76));
const totalW=MAP_SIZE+40;
const geo=new THREE.PlaneGeometry(totalW,totalW,seg,seg);
geo.rotateX(-HPI);
const pos=geo.attributes.position;
const cols=new Float32Array(pos.count*3);
for(let i=0;i<pos.count;i++){
const x=pos.getX(i),z=pos.getZ(i);
// 桥面下埋: 桥矩形内地形渲染面退到桥面之下 (heightAt 物理值不变; 见 terrainRenderY 头注释)
pos.setY(i, terrainRenderY(x,z));
const [r,g,b]=calcTerrainVertexColor(x,z,pos.getY(i));
cols[i*3]=r; cols[i*3+1]=g; cols[i*3+2]=b;
}
geo.setAttribute('color', new THREE.BufferAttribute(cols,3));
geo.computeVertexNormals();
if(geo.computeBoundingSphere) geo.computeBoundingSphere();
GROUND_GEO=geo;

// 4x4 地形网格分块 (16 块) 绑定独立包围球用于 GPU/WebGL 视锥剔除
const chunkW=totalW/4, chunkD=totalW/4;
const chunkSegX=Math.max(16,Math.round(seg/4)), chunkSegZ=Math.max(16,Math.round(seg/4));
for(let iz=0;iz<4;iz++){
for(let ix=0;ix<4;ix++){
const cGeo=new THREE.PlaneGeometry(chunkW,chunkD,chunkSegX,chunkSegZ);
cGeo.rotateX(-HPI);
const cx=-totalW/2+(ix+0.5)*chunkW;
const cz=-totalW/2+(iz+0.5)*chunkD;
cGeo.translate(cx,0,cz);
const cPos=cGeo.attributes.position;
const cCols=new Float32Array(cPos.count*3);
for(let i=0;i<cPos.count;i++){
const x=cPos.getX(i), z=cPos.getZ(i);
cPos.setY(i, terrainRenderY(x,z));
const [cr,cg,cb]=calcTerrainVertexColor(x,z,cPos.getY(i));
cCols[i*3]=cr; cCols[i*3+1]=cg; cCols[i*3+2]=cb;
}
cGeo.setAttribute('color', new THREE.BufferAttribute(cCols,3));
cGeo.computeVertexNormals();
if(cGeo.computeBoundingSphere) cGeo.computeBoundingSphere();
const cMesh=new THREE.Mesh(cGeo, MAT.grass);
cMesh.receiveShadow=true;
scene.add(cMesh);
TERRAIN_CHUNKS.push(cMesh);
}
}
}
// ── 地形网格重刷 (2026-09-20 建筑地基平台): 网格在本文件载入期先按"无建筑"地形建好,
//    而建筑地基平台 PADS 是世界布局期登记的 ⇒ 布局结束后把平台影响圈内的顶点高度重算一遍。
//    只改 Y (顶点色带读的是 x/z 语义距离与登记时的 hy, 平台不改语义分区; 局部色调差异可接受),
//    重算后统一 computeVertexNormals 让平台/裙坡的光照正确。返回改动的顶点数 (供沙箱断言)。
function refreshTerrainMesh(){
if(!GROUND_GEO) return 0;
if(!PADS.length) return 0;
const pos=GROUND_GEO.attributes.position;
let n=0;
for(let i=0;i<pos.count;i++){
const x=pos.getX(i), z=pos.getZ(i);
let near=false;
for(let k=0;k<PADS.length;k++){
const p=PADS[k];
const dx=x-p.x, dz=z-p.z;
if(dx*dx+dz*dz>p.reach2) continue;
const lx=dx*p.cs-dz*p.sn, lz=dx*p.sn+dz*p.cs;
const ax=Math.abs(lx)-p.hw, az=Math.abs(lz)-p.hd;
if(ax<=0&&az<=0){ near=true; break; }
if(Math.hypot(ax>0?ax:0,az>0?az:0)<p.ramp+3){ near=true; break; }
}
if(!near) continue;
// 与载入期网格构建同源 (terrainRenderY): 只用 heightAt 会把桥面下埋的顶点又拉回 deckY ⇒ 栈桥共面复发
const y=terrainRenderY(x,z);
if(Math.abs(y-pos.getY(i))>1e-6){ pos.setY(i,y); n++; }
}
if(n){
pos.needsUpdate=true;
GROUND_GEO.computeVertexNormals();
if(GROUND_GEO.computeBoundingSphere) GROUND_GEO.computeBoundingSphere();
}

if(typeof TERRAIN_CHUNKS!=='undefined'){
for(const cm of TERRAIN_CHUNKS){
const cpos=cm.geometry.attributes.position;
let cMod=0;
for(let i=0;i<cpos.count;i++){
const x=cpos.getX(i), z=cpos.getZ(i);
let near=false;
for(let k=0;k<PADS.length;k++){
const p=PADS[k];
const dx=x-p.x, dz=z-p.z;
if(dx*dx+dz*dz>p.reach2) continue;
const lx=dx*p.cs-dz*p.sn, lz=dx*p.sn+dz*p.cs;
const ax=Math.abs(lx)-p.hw, az=Math.abs(lz)-p.hd;
if(ax<=0&&az<=0){ near=true; break; }
if(Math.hypot(ax>0?ax:0,az>0?az:0)<p.ramp+3){ near=true; break; }
}
if(!near) continue;
const y=terrainRenderY(x,z);
if(Math.abs(y-cpos.getY(i))>1e-6){ cpos.setY(i,y); cMod++; }
}
if(cMod>0){
cpos.needsUpdate=true;
cm.geometry.computeVertexNormals();
if(cm.geometry.computeBoundingSphere) cm.geometry.computeBoundingSphere();
}
}
}
return n;
}
const BOXES=[];
const CYLS=[];
function addBoxCollider(cx,cy,cz,w,h,d){
const b={minX:cx-w/2,minY:cy-h/2,minZ:cz-d/2,maxX:cx+w/2,maxY:cy+h/2,maxZ:cz+d/2,gh:heightAt(cx,cz)};
BOXES.push(b);
// 2026-09-06 B5/P0-2: 索引建立后新增的碰撞盒增量注册进 RGRID —— 工程兵建造/残骸/探针摆件即时可见。
// (旧全量扫描时代无感; RGRID 化后移动碰撞/射线都依赖此即时性, 否则要等下一次 NAV.refresh)
if(RGRID.boxCells){
const {cell,N,off}=RGRID;
const bi=BOXES.length-1;
const i0=clamp(Math.floor((b.minX+off)/cell),0,N-1), i1=clamp(Math.floor((b.maxX+off)/cell),0,N-1);
const j0=clamp(Math.floor((b.minZ+off)/cell),0,N-1), j1=clamp(Math.floor((b.maxZ+off)/cell),0,N-1);
for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++) RGRID.boxCells[j*N+i].push(bi);
}
return b;
}
// 2026-09-06 B6/P1-6: rayBox 标量化 + 共享结果槽 (旧实现每次分配 5 个临时数组+结果对象, 高烈度战斗每帧数千次=GC 大头);
// 结果槽仅供 raycastWorld 内部即时消费 (best 改善才回写 bn, 槽内容即当前最优命中), 无外部长期持有
const _rbR={t:0,nx:0,ny:0,nz:0};
function rayBox(o,dir,b,maxD){
let tmin=0,tmax=maxD, axis=-1, sign=0;
let dd=dir.x;
if(dd<1e-9&&dd>-1e-9){ if(o.x<b.minX||o.x>b.maxX) return null; }
else{
const inv=1/dd;
let t1=(b.minX-o.x)*inv, t2=(b.maxX-o.x)*inv, s=-1;
if(t1>t2){ const tmp=t1; t1=t2; t2=tmp; s=1; }
if(t1>tmin){ tmin=t1; axis=0; sign=s; }
if(t2<tmax) tmax=t2;
if(tmin>tmax) return null;
}
dd=dir.y;
if(dd<1e-9&&dd>-1e-9){ if(o.y<b.minY||o.y>b.maxY) return null; }
else{
const inv=1/dd;
let t1=(b.minY-o.y)*inv, t2=(b.maxY-o.y)*inv, s=-1;
if(t1>t2){ const tmp=t1; t1=t2; t2=tmp; s=1; }
if(t1>tmin){ tmin=t1; axis=1; sign=s; }
if(t2<tmax) tmax=t2;
if(tmin>tmax) return null;
}
dd=dir.z;
if(dd<1e-9&&dd>-1e-9){ if(o.z<b.minZ||o.z>b.maxZ) return null; }
else{
const inv=1/dd;
let t1=(b.minZ-o.z)*inv, t2=(b.maxZ-o.z)*inv, s=-1;
if(t1>t2){ const tmp=t1; t1=t2; t2=tmp; s=1; }
if(t1>tmin){ tmin=t1; axis=2; sign=s; }
if(t2<tmax) tmax=t2;
if(tmin>tmax) return null;
}
if(tmin<=0.0001) return null;
_rbR.t=tmin; _rbR.nx=axis===0?sign:0; _rbR.ny=axis===1?sign:0; _rbR.nz=axis===2?sign:0;
return _rbR;
}
const _rcR={t:0,nx:0,ny:0,nz:0};
// 拒马逐梁弹道细化 (2026-11-17 批): 拒马的圆柱 (r=0.85) 只供坦克推挤/士兵推挤/寻路/飞机扫掠使用,
// 弹道 (子弹/炮弹/视线/溅射遮挡全走 raycastWorld 这一条口) 改测三根钢梁的**实际线段** —— 空隙照常穿弹,
// 打在梁上才挡。c.hb=[ax,ay,az,bx,by,bz]×3 (梁两端点, 05b-props hedgehog 构建时按梁姿态解析式写入),
// 胶囊半径 = 梁半厚 0.11 + 0.03 采样余量。算法 = Ericson《Real-Time Collision Detection》5.1.9
// 线段-线段最近点 (射线取 maxD 长线段参与), 零分配 (全标量局部), 取最小 s = 最近命中。
const HEDGE_R2=0.14*0.14;
function rayHedgeBeams(o,dir,c,maxD){
const p2x=o.x+dir.x*maxD, p2y=o.y+dir.y*maxD, p2z=o.z+dir.z*maxD;
const hb=c.hb;
let bt=-1, bnx=0, bny=0, bnz=0;
for(let i=0;i<hb.length;i+=6){
const q1x=hb[i], q1y=hb[i+1], q1z=hb[i+2], q2x=hb[i+3], q2y=hb[i+4], q2z=hb[i+5];
const d1x=p2x-o.x, d1y=p2y-o.y, d1z=p2z-o.z;
const d2x=q2x-q1x, d2y=q2y-q1y, d2z=q2z-q1z;
const rx=o.x-q1x, ry=o.y-q1y, rz=o.z-q1z;
const a=d1x*d1x+d1y*d1y+d1z*d1z;
const e=d2x*d2x+d2y*d2y+d2z*d2z;
const f=d2x*rx+d2y*ry+d2z*rz;
let s, u;
if(a<=1e-12){ s=0; u=e>1e-12?clamp(f/e,0,1):0; }
else if(e<=1e-12){ u=0; s=clamp(-(d1x*rx+d1y*ry+d1z*rz)/a,0,1); }
else{
const cc2=d1x*rx+d1y*ry+d1z*rz;
const b2=d1x*d2x+d1y*d2y+d1z*d2z;
const den=a*e-b2*b2;
s=den>1e-12?clamp((b2*f-cc2*e)/den,0,1):0;
u=(b2*s+f)/e;
if(u<0){ u=0; s=clamp(-cc2/a,0,1); }
else if(u>1){ u=1; s=clamp((b2-cc2)/a,0,1); }
}
const t=s*maxD;
if(t<=0.0001||t>maxD) continue;
const dx=(o.x+d1x*s)-(q1x+d2x*u), dy=(o.y+d1y*s)-(q1y+d2y*u), dz=(o.z+d1z*s)-(q1z+d2z*u);
if(dx*dx+dy*dy+dz*dz>HEDGE_R2) continue;
if(bt<0||t<bt){ bt=t; const dl2=dx*dx+dy*dy+dz*dz; const il=dl2>1e-12?1/Math.sqrt(dl2):0; bnx=dx*il; bny=dy*il; bnz=dz*il; }
}
if(bt<0) return null;
_rcR.t=bt; _rcR.nx=bnx; _rcR.ny=bny; _rcR.nz=bnz;
return _rcR;
}
function rayCyl(o,dir,c,maxD){
if(c.dead) return null; // 已倒伏/烧毁的树等: 碰撞体即杀 (r=0 防御 + 显式跳过)
if(c.hb) return rayHedgeBeams(o,dir,c,maxD);   // 拒马: 弹道逐梁判定 (2026-11-17 批, 挡坦克挡人圆柱口径不动)
const ox=o.x-c.x, oz=o.z-c.z;
const a=dir.x*dir.x+dir.z*dir.z;
if(a<1e-9) return null;
const b2=2*(ox*dir.x+oz*dir.z);
const cc=ox*ox+oz*oz-c.r*c.r;
const disc=b2*b2-4*a*cc;
if(disc<0) return null;
const t=(-b2-Math.sqrt(disc))/(2*a);
if(t<0.0001||t>maxD) return null;
const y=o.y+dir.y*t;
if(y<c.y0||y>c.y1) return null;
const px=o.x+dir.x*t, pz=o.z+dir.z*t;
const nx=(px-c.x)/c.r, nz=(pz-c.z)/c.r;
_rcR.t=t; _rcR.nx=nx; _rcR.ny=0; _rcR.nz=nz;
return _rcR;
}
// dirty=单一外接矩形 (兼容口径) / dirtyList=矩形簇表 (2026-11-11, NAV.refresh 簇级增量消费);
// pend 旧字段已由 pendList 取代 (簇表), OCC.pend 不再写入
const OCC={ res:1, N:0, off:(MAP_SIZE+40)/2, data:null, dirty:null, dirtyList:null, pendList:null, _bA:null, _bB:null };
// buildOccupancy 之外的**直接写** OCC.data 的登记入口 (registerDynCollider / killDynCollider /
// 05-world killOne / 04b-fire occMarkFire 四处)。必要性: 差分的基线是"上一次重建出来的网格",
// 而这些路径会直接改活体网格 —— 下一次重建按同一批表算出来的结果与改动后的活体逐格一致,
// 差分自然为空, 但**导航烘的还是更早那一份** ⇒ 必须把"被直接写过的范围"另行补进脏矩形。
// 超集无害 (多算几格), 漏登记才会留下陈旧寻路格。
// ── 触点矩形簇 (2026-11-11 性能批) ──
// 旧账: occTouch 把所有触点并进**一个**外接矩形 (OCC.pend)。火情多点开花 (两处火线相距几百米 /
// 车辆火线+坠机火圈同时存在) 时, 外接矩形覆盖大半张图 ⇒ NAV.refresh 按"外接矩形面积>NN×4%"判全量
// 重烘焙 (640 图 128~143ms, "每隔几秒定帧一次"的病根)。改为**小矩形簇表**: 新触点与已有簇相交或
// 间距≤OCC_CLUSTER_MERGE (3 格, 簇间烘焙各自 ±10m 外扩足以覆盖交互) 就并簇, 远离的前线各留各的;
// 簇数超 OCC_CLUSTER_CAP (12) 才退化成单一外接矩形 (旧行为兜底)。
// 旧 OCC.pend (单一外接矩形) 字段由 OCC.pendList 簇表取代; 消费点 (buildOccupancy 末段并账) 直接读簇表。
const OCC_CLUSTER_MERGE=3, OCC_CLUSTER_CAP=12;
function occRectMerge(list,i0,j0,i1,j1){
let m=0;
while(m<list.length){
const q=list[m];
if(i0<=q.i1+OCC_CLUSTER_MERGE&&q.i0<=i1+OCC_CLUSTER_MERGE&&j0<=q.j1+OCC_CLUSTER_MERGE&&q.j0<=j1+OCC_CLUSTER_MERGE){
// 并簇: 取外接矩形; 合并后的新矩形可能又与更早/更晚的簇相邻 ⇒ 从头重扫 (有合并才扫, 簇数≤CAP 代价可忽略)
i0=Math.min(i0,q.i0); j0=Math.min(j0,q.j0); i1=Math.max(i1,q.i1); j1=Math.max(j1,q.j1);
list.splice(m,1); m=0; continue;
}
m++;
}
list.push({i0,j0,i1,j1});
if(list.length>OCC_CLUSTER_CAP){
const q0=list[0];
for(let k=1;k<list.length;k++){ const q=list[k];
q0.i0=Math.min(q0.i0,q.i0); q0.j0=Math.min(q0.j0,q.j0); q0.i1=Math.max(q0.i1,q.i1); q0.j1=Math.max(q0.j1,q.j1); }
list.length=1;
}
}
function occTouch(x0,z0,x1,z1){
const {res,N,off}=OCC;
if(!N||!OCC.data) return;
const i0=clamp(Math.floor((x0+off)/res),0,N-1), i1=clamp(Math.ceil((x1+off)/res),0,N-1);
const j0=clamp(Math.floor((z0+off)/res),0,N-1), j1=clamp(Math.ceil((z1+off)/res),0,N-1);
const p=OCC.pendList||(OCC.pendList=[]);
occRectMerge(p,i0,j0,i1,j1);
}
// ── 占用网格差分 → 脏矩形 (2026-09-26 性能批; 2026-11-11 簇化) ──
// 事实: OCC.data **就是** NAV 网格的全部输入 (open/边烘焙的唯一判据是 occBlocked)。
// 于是"本次重建相对上次改了哪些格"可以用一次逐格比对拿到, 而且这个判据是**充分的**:
// 差分为空 ⇒ 导航输入逐格未变 ⇒ 重烘焙可以整段跳过 (证明式跳过, 不是估计)。
// 旧版每次都全图重烘焙 (640 图 52 万次 occBlocked + 全图分量, 实测 128~143ms),
// 而真实改动集清一色是局部的 (烧一格火/塌一堵墙/碾一段铁丝网/造一件工事)。
// 比对成本 463k 次字节比较 ≈ 1ms, 换掉的是两个数量级的重建。
// ★簇化: 逐行收"改动列区间", 与 occTouch 同一合并器并簇 —— 多前线火情的差分不再并成一个大矩形
//   (差分矩形是全量烘焙判定的另一路输入, 不簇化则簇化 occTouch 白搭)。
function occDiffRects(prev,cur,N){
if(!prev||prev.length!==cur.length) return [{i0:0,j0:0,i1:N-1,j1:N-1}];
const list=[];
for(let j=0;j<N;j++){
const base=j*N;
let c0=-1,c1=-1;
for(let i=0;i<N;i++){
if(prev[base+i]!==cur[base+i]){ if(c0<0)c0=i; c1=i; }
}
if(c0>=0) occRectMerge(list,c0,j,c1,j);
}
return list.length?list:null; // 逐格一致: 导航输入未变
}
function occDiffRect(prev,cur,N){ // 兼容包装: 单一外接矩形 (原版语义; NAV 主链已走 occDiffRects)
const l=occDiffRects(prev,cur,N);
if(!l) return null;
let r=l[0];
for(let k=1;k<l.length;k++){ const q=l[k];
r={i0:Math.min(r.i0,q.i0),j0:Math.min(r.j0,q.j0),i1:Math.max(r.i1,q.i1),j1:Math.max(r.j1,q.j1)}; }
return r;
}
// ── 静态地貌层缓存 (2026-09-26 性能批) ──
// 河道深谷带/深水海面/断崖岩脊/雪岭陡坡这四支"逐格全场扫描"的判据只读地图**静态几何**
// (河道折线/离岸距离场/高度场/公路距离场), 一局之内恒定, 而旧版把它放在每次 buildOccupancy 里重算 ——
// 实测逐格 inRiverChannel (胡康 463k 格) 1044ms / seaDepthAt 501ms / heightAt+roadDist 689ms / 4×heightAt 165ms。
// 现改为惰性算一次存成字节场 (0=无 1=阻挡 2=水障), 之后每次重建只做一次"读掩码→写占用"的紧循环。
// 顺序/取值逐条对齐旧版: 四支按原顺序叠加, 后写覆盖先写 (唯一取值冲突是"水障 2 被 1 覆盖"的假想重叠, 原顺序亦然)。
let OCC_GEO=null, OCC_GEON=-1;
function buildOccGeo(){
const {res,N,off}=OCC;
const g=new Uint8Array(N*N);
// 深谷河道: 整段标记为占用格, Bot/坦克寻路只能走大桥
if(RIVER&&RIVER.d>2){
for(let j=0;j<N;j++)for(let i=0;i<N;i++){
const x=i*res-off, z=j*res-off;
if(inRiverChannel(x,z)) g[j*N+i]=1;
}
}
// 海域/深水 (2026-09-18 塔拉瓦): 水深 >SWIM_DEPTH 的格记 **2=水障** ——
// 寻路 (Bot/坦克) 默认绕开, 但游泳态可穿过 (occBlocked(x,z,ignoreWater)) —— 落水者游得回岸;
// 礁盘(1.22~1.28m)/冲滩浅水 不记占用 = 涉水可通行 (史实"涉水上岸"的通道); 栈桥面豁免。
if(SEA){
for(let j=0;j<N;j++)for(let i=0;i<N;i++){
const x=i*res-off, z=j*res-off;
if(seaDepthAt(x,z)>SWIM_DEPTH&&onBridge(x,z)===false) g[j*N+i]=2;
}
}
// 断崖公路: 山肩以上陡面(高度>15m 且远离公路>20m)记占用格 —— Bot/坦克可上坡抢占伏击点,
// 但不会翻上最顶的岩脊; 玩家不受限可任意翻爬
if(CAMPAIGN.id==='canyon'){
for(let j=0;j<N;j++)for(let i=0;i<N;i++){
const x=i*res-off, z=j*res-off;
if(heightAt(x,z)>15&&roadDist(x,z)>20) g[j*N+i]=1;
}
}
// 莫斯科雪岭: 陡坡(局部坡度>45°, 4m 采样)记占用格 —— Bot/坦克寻路阻断,
// 随后按公路/旗圈/基地/战壕走廊强制打通 (垭口-公路-旗点平台保持可达)
if(CAMPAIGN.id==='moscow'){
const step=4, th=0.95;
for(let j=4;j<N-4;j+=step)for(let i=4;i<N-4;i+=step){
const x=i-off, z=j-off;
const hx=Math.abs(heightAt(x+step,z)-heightAt(x-step,z))/(2*step);
const hz=Math.abs(heightAt(x,z+step)-heightAt(x,z-step))/(2*step);
if(Math.max(hx,hz)>th){
// 标记采样点周围 8×8 (厚墙) —— 寻路节点间隔 5m, 只查节点不查线段, 薄墙会被跨跳过
for(let k=-2;k<=5;k++)for(let l=-2;l<=5;l++){
const jj=j+l, ii=i+k;
if(jj>=0&&jj<N&&ii>=0&&ii<N) g[jj*N+ii]=1;
}
}
}
}
OCC_GEO=g; OCC_GEON=N;
return g;
}
// ── 沟壁/谷壁厚墙掩码 (2026-09-26 性能批, 同静态地貌层口径) ──
// 百团沟壁与雾林谷壁的 4m 步进全场扫描 (逐点 gullyDist/woodRavineDist 求折线距离 + 4×4 厚墙写) 同样只读
// 静态几何 —— 惰性算一次存掩码, 之后每次重建只做一次"读掩码→写占用"。百团 122ms → ~1ms, 雾林 30ms → ~1ms。
// 掩码内容与旧版逐格一致 (含 4m 步进与 4×4 厚墙的越界保护); 块内的走廊/道路/旗圈/基地**打通**仍留在原处
// live 执行 —— 它们必须在校验通过之后压过动态标记 (箱体/圆柱/铁丝网/火格), 顺序不能省。
let WALLMASK_BAITUAN=null, WALLMASK_WOODLINE=null;
function buildWallMask(kind){
const {res,N,off}=OCC;
const m=new Uint8Array(N*N);
if(kind==='baituan'){
const W=LOESS.w||14, GB=LOESS.bottom||3;
for(let j=0;j<N;j+=4)for(let i=0;i<N;i+=4){
const x=i*res-off, z=j*res-off;
const gd=gullyDist(x,z);
if(gd<=GB||gd>=W) continue;       // 沟底留白 (渗透路线) / 带外
// 沟壁带: 4×4 厚墙标记 (寻路节点间隔 5m, 薄墙会被跨跳) —— 步进采样, 带≥9m 宽足够覆盖
for(let k2=0;k2<4;k2++)for(let l2=0;l2<4;l2++){
const jj=j+l2, ii=i+k2;
if(jj<N&&ii<N) m[jj*N+ii]=1;
}
}
}else{
const W2=WOOD.ravine, GB=W2.bottom||5;
for(let j=0;j<N;j+=4)for(let i=0;i<N;i+=4){
const x=i*res-off, z=j*res-off;
const gd=woodRavineDist(x,z);
if(gd<=GB||gd>=W2.w) continue;   // 谷底留白 (泥径可走) / 带外
for(let k2=0;k2<4;k2++)for(let l2=0;l2<4;l2++){
const jj=j+l2, ii=i+k2;
if(jj<N&&ii<N) m[jj*N+ii]=1;
}
}
}
return m;
}
function wallMask(kind){
const sz=OCC.N*OCC.N;
if(kind==='baituan') return (WALLMASK_BAITUAN&&WALLMASK_BAITUAN.length===sz)?WALLMASK_BAITUAN:(WALLMASK_BAITUAN=buildWallMask('baituan'));
return (WALLMASK_WOODLINE&&WALLMASK_WOODLINE.length===sz)?WALLMASK_WOODLINE:(WALLMASK_WOODLINE=buildWallMask('woodline'));
}
function buildOccupancy(){
OCC.N=Math.ceil((MAP_SIZE+40)/OCC.res)+1;
const {res,N,off}=OCC;
// 双缓冲 (2026-09-26): 旧版每次 new 一块 463KB 再零填 ⇒ 每次重建一次大对象分配 + GC。
// 改为两块轮换 (活体 + 待建), 建完最后一步才发布 —— 期间 OCC.data 仍指旧块, 供差分使用。
const sz=N*N;
if(!OCC._bA||OCC._bA.length!==sz){ OCC._bA=new Uint8Array(sz); OCC._bB=new Uint8Array(sz); OCC.data=null; }
const prev=OCC.data;
const d=(prev===OCC._bA)?OCC._bB:OCC._bA;
d.fill(0);
const pad=0.6;
const mark=(x0,z0,x1,z1,test)=>{
const i0=clamp(Math.floor((x0+off)/res),0,N-1), i1=clamp(Math.ceil((x1+off)/res),0,N-1);
const j0=clamp(Math.floor((z0+off)/res),0,N-1), j1=clamp(Math.ceil((z1+off)/res),0,N-1);
for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
if(test){ const x=i*res-off, z=j*res-off; if(!test(x,z)) continue; }
d[j*N+i]=1;
}
};
for(const b of BOXES){
if(b.dead) continue;
const gh=b.gh;
if(b.maxY<gh+0.5||b.minY>gh+1.75) continue;
mark(b.minX-pad,b.minZ-pad,b.maxX+pad,b.maxZ+pad,null);
}
// 门口/通道强制通行区: 只清除墙体外扩溢出, 在圆柱障碍标记之前应用
for(const cl of NAV_CLEARS){
const i0=clamp(Math.floor((cl.x-cl.r+off)/res),0,N-1), i1=clamp(Math.ceil((cl.x+cl.r+off)/res),0,N-1);
const j0=clamp(Math.floor((cl.z-cl.r+off)/res),0,N-1), j1=clamp(Math.ceil((cl.z+cl.r+off)/res),0,N-1);
for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
const x=i*res-off, z=j*res-off;
if((x-cl.x)*(x-cl.x)+(z-cl.z)*(z-cl.z)<=cl.r*cl.r) d[j*N+i]=0;
}
}
// 圆柱障碍(草垛/拒马等)最后标记, 保证寻路不会穿过实体
// ★2026-11-15 锥体碰撞批: CYLS 现在也收录"高高在上"的建筑顶饰(教堂尖顶/国会穹顶壳/水塔锥顶)的
//   分层近似圆柱 —— 这批带 noNav:1 标记, 烘焙跳过: 它们悬在高空, 地面上那格其实走得通 (国会穹顶
//   正下方的圆厅/鼓座内部都是可走区)。本循环没有 BOXES 那道 maxY/minY 竖直闸, 必须靠标记豁免。
for(const c of CYLS){
if(c.r<0.28||c.noNav) continue;
const rr=c.r+pad;
mark(c.x-rr,c.z-rr,c.x+rr,c.z+rr,(x,z)=>((x-c.x)*(x-c.x)+(z-c.z)*(z-c.z))<=rr*rr);
}
	// 铁丝网: 标记为占用格, 让Bot寻路尽量绕开 (物理上仍可通行, 误入会减速受伤)
	for(const w of wires){
	if(!w.alive) continue;   // 已被坦克碾平 (15-vehicles 只置 alive=false 不删条目 —— 条目要留给 23b 的重开复位)
	const rr=Math.max(0.6,w.r*0.85);
	mark(w.x-rr,w.z-rr,w.x+rr,w.z+rr,(x,z)=>((x-w.x)*(x-w.x)+(z-w.z)*(z-w.z))<=rr*rr);
	}
	// ── 静态地貌层叠加 (河道深谷带/深水海面/断崖岩脊/雪岭陡坡, 见 buildOccGeo) ──
	// 语义与旧版的四支逐格扫描逐条一致, 位置不变 (仍在校验通过之后、道路/旗圈/基地打通之前):
	// 掩码算一次存起来, 这里只做"读掩码→写占用"。语句范围与旧版 if 链相同 (无静态层的图整段跳过)。
	if((RIVER&&RIVER.d>2)||SEA||CAMPAIGN.id==='canyon'||CAMPAIGN.id==='moscow'){
	const g=(OCC_GEO&&OCC_GEON===N)?OCC_GEO:buildOccGeo();
	const L=d.length;
	for(let k=0;k<L;k++){ const v=g[k]; if(v) d[k]=v; }
	}
	// 莫斯科: 垭口走廊强制打通 (passes 语义表) + 道路/战壕/旗圈/基地走廊打通 ——
	// ★作用域与旧版逐字一致: 这一支旧版就挂在 `if(CAMPAIGN.id==='moscow')` 内 (陡坡带必须靠走廊打通,
	//   否则整张雪岭图会被坡度占用格封成孤岛), 只有莫斯科走它; 移位时不得外泄到其他战役。
	if(CAMPAIGN.id==='moscow'){
	const clear=(x,z,r)=>{
	const i0=clamp(Math.floor((x-r+off)/res),0,N-1), i1=clamp(Math.ceil((x+r+off)/res),0,N-1);
	const j0=clamp(Math.floor((z-r+off)/res),0,N-1), j1=clamp(Math.ceil((z+r+off)/res),0,N-1);
	for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
	const xx=i*res-off, zz=j*res-off;
	if((xx-x)*(xx-x)+(zz-z)*(zz-z)<=r*r) d[j*N+i]=0;
	}
	};
	for(const r of CAMPAIGN.roads){
	const l=Math.hypot(r[2]-r[0],r[3]-r[1])||1;
	for(let u=0;u<=1;u+=5/l) clear(r[0]+(r[2]-r[0])*u, r[1]+(r[3]-r[1])*u, 9);
	}
	for(const t of TRENCHES){
	const l=Math.hypot(t.x2-t.x1,t.z2-t.z1)||1;
	for(let u=0;u<=1;u+=4/l) clear(t.x1+(t.x2-t.x1)*u, t.z1+(t.z2-t.z1)*u, 4.5);
	}
	for(const f of CAMPAIGN.flags) clear(f.x,f.z,f.r+8);
	for(const b of CAMPAIGN.bases) clear(b.x,b.z,26);
	// 莫斯科: 垭口走廊强制打通 (passes 语义表)
	if(ALPINE&&ALPINE.passes) for(const p of ALPINE.passes) clear(p.x,p.z,p.r);
	}
	// 断崖公路: 崖顶伏击点走廊强制打通 (2026-11-17 批, 出生点自半山腰上移崖顶) ——
	// OCC_GEO 把 h>15 且 rd>20 的岩脊带记占用 (Bot 不翻最顶岩脊), 崖顶出生若不开走廊, Bot 会
	// 生在"孤岛"上 (能射击不能移动/换位/寻补给)。每队0点开一条 出生点→最近道路点 的 3m 走廊,
	// 与莫斯科垭口同款 clear 手法 (OCC_GEO 叠加之后直接写活体网格, 顺序在叠加块之后不可上移)。
	if(CAMPAIGN.id==='canyon'){
	const clear=(x,z,r)=>{
	const i0=clamp(Math.floor((x-r+off)/res),0,N-1), i1=clamp(Math.ceil((x+r+off)/res),0,N-1);
	const j0=clamp(Math.floor((z-r+off)/res),0,N-1), j1=clamp(Math.ceil((z+r+off)/res),0,N-1);
	for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
	const xx=i*res-off, zz=j*res-off;
	if((xx-x)*(xx-x)+(zz-z)*(zz-z)<=r*r) d[j*N+i]=0;
	}
	};
	const escT=(CAMPAIGN.convoy&&CAMPAIGN.convoy.escortTeam!==undefined)?CAMPAIGN.convoy.escortTeam:1;
	for(const s of (CAMPAIGN.spawns||[])){
	if(s.team===escT) continue;   // 护运方谷口集结地在谷底 (rd<20), 不在岩脊带, 无需走廊
	// 最近道路点: 逐段投影取最近 (roads 12 段, 布局期一次性开销)
	let bx=0,bz=0,bd=1e9;
	for(const r of CAMPAIGN.roads){
	const dx=r[2]-r[0], dz=r[3]-r[1], L2=dx*dx+dz*dz||1e-9;
	let t=((s.x-r[0])*dx+(s.z-r[1])*dz)/L2; t=clamp(t,0,1);
	const px=r[0]+dx*t, pz=r[1]+dz*t, dd=Math.hypot(s.x-px,s.z-pz);
	if(dd<bd){ bd=dd; bx=px; bz=pz; }
	}
	const l=Math.hypot(bx-s.x,bz-s.z)||1;
	for(let u=0;u<=1;u+=2.5/l) clear(s.x+(bx-s.x)*u, s.z+(bz-s.z)*u, 3);
	}
	}
	// 百团沟壑 (2026-09-12 立体化重写): 沟壁带(talus..w)记占用 —— Bot 不翻崖不穿壁;
	// 沟底(gd<bottom)留白=可通行 (坡道网络+渡口把沟底变成渗透路线, 与坡度物理同口径);
	// 坡道走廊/渡台/铁路桥桥位/道路/旗圈/基地逐级打通
	if(CAMPAIGN.id==='baituan'&&LOESS){
	const clear=(x,z,r)=>{
	const i0=clamp(Math.floor((x-r+off)/res),0,N-1), i1=clamp(Math.ceil((x+r+off)/res),0,N-1);
	const j0=clamp(Math.floor((z-r+off)/res),0,N-1), j1=clamp(Math.ceil((z+r+off)/res),0,N-1);
	for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
	const xx=i*res-off, zz=j*res-off;
	if((xx-x)*(xx-x)+(zz-z)*(zz-z)<=r*r) d[j*N+i]=0;
	}
	};
	const clearCorr=(x0,z0,x1,z1,r)=>{
	const l=Math.hypot(x1-x0,z1-z0)||1;
	for(let u=0;u<=1;u+=2.5/l) clear(x0+(x1-x0)*u, z0+(z1-z0)*u, r);
	};
{const mk=wallMask('baituan'); for(let k=0;k<mk.length;k++){ if(mk[k]) d[k]=1; }}
	// 坡道走廊 (半宽+3 渐灭) —— Bot 过沟的合法通道
	for(const r2 of (LOESS.ramps||[])) clearCorr(r2.x0,r2.z0,r2.x1,r2.z1,(r2.w||9)+3);
	// 渡台 (沟底库旗点立足台)
	for(const b2 of (LOESS.benches||[])){
	const mx=(b2.x0+b2.x1)/2, mz=(b2.z0+b2.z1)/2;
	clear(mx,mz,Math.max(b2.x1-b2.x0,b2.z1-b2.z0)/2+4);
	}
	// 铁路桥桥位 (巷沟上的拉锯通道; NAV_CLEARS 之外这里同步放行占用格)
	for(const B2 of BRIDGES) clear(B2.x,B2.z,B2.len/2+6);
	// 道路/旗点/基地走廊
	for(const r of CAMPAIGN.roads){
	const l=Math.hypot(r[2]-r[0],r[3]-r[1])||1;
	for(let u=0;u<=1;u+=5/l) clear(r[0]+(r[2]-r[0])*u, r[1]+(r[3]-r[1])*u, 9);
	}
	for(const f of CAMPAIGN.flags) clear(f.x,f.z,f.r+8);
	for(const b of CAMPAIGN.bases) clear(b.x,b.z,26);
	for(const s2 of (CAMPAIGN.spawns||[])) clear(s2.x,s2.z,10);
	}
	// 雾林守线北谷 (2026-09-13 许特根改版): 谷壁带(bottom..w)记占用 —— Bot 不攀湿滑谷壁,
	// 过谷走堑口 (车辆堑口=主防火道纵穿, 步兵堑口×2); 谷底留白=泥径渗透路线 (卡尔小径拉锯)
	if(CAMPAIGN.id==='woodline'&&WOOD&&WOOD.ravine){
	const W2=WOOD.ravine;
	const clear=(x,z,r)=>{
	const i0=clamp(Math.floor((x-r+off)/res),0,N-1), i1=clamp(Math.ceil((x+r+off)/res),0,N-1);
	const j0=clamp(Math.floor((z-r+off)/res),0,N-1), j1=clamp(Math.ceil((z+r+off)/res),0,N-1);
	for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
	const xx=i*res-off, zz=j*res-off;
	if((xx-x)*(xx-x)+(zz-z)*(zz-z)<=r*r) d[j*N+i]=0;
	}
	};
	const clearCorr=(x0,z0,x1,z1,r)=>{
	const l=Math.hypot(x1-x0,z1-z0)||1;
	for(let u=0;u<=1;u+=2.5/l) clear(x0+(x1-x0)*u, z0+(z1-z0)*u, r);
	};
{const mk=wallMask('woodline'); for(let k=0;k<mk.length;k++){ if(mk[k]) d[k]=1; }}
	for(const r2 of (W2.ramps||[])) clearCorr(r2.x0,r2.z0,r2.x1,r2.z1,(r2.w||5)+4);
	for(const r of CAMPAIGN.roads){
	const l=Math.hypot(r[2]-r[0],r[3]-r[1])||1;
	for(let u=0;u<=1;u+=5/l) clear(r[0]+(r[2]-r[0])*u, r[1]+(r[3]-r[1])*u, 9);
	}
	for(const f of CAMPAIGN.flags) clear(f.x,f.z,f.r+8);
	for(const b of CAMPAIGN.bases) clear(b.x,b.z,26);
	}
	// 燃烧火格: 记占用 → Bot/坦克寻路绕开火线 (运行期 igniteCell 直接写占用,
	// 这里在占用网格重建时恢复标记, 避免重建把火线抹掉; 烧尽的格重建后自然放行)
	if(typeof FIRE_ACTIVE!=='undefined'&&FIRE_ACTIVE.length){
	for(const fci of FIRE_ACTIVE){
	const fx=(fci%FN)*FRES-FOFF, fz=Math.floor(fci/FN)*FRES-FOFF;
	mark(fx-1.4,fz-1.4,fx+1.4,fz+1.4,null);
	}
	}
	// 发布新网格 + 记录"本次相对上次改了哪些格" (见 occDiffRect: 差分为空 ⇒ 导航输入未变)
	// 两份来源取并集: ①与上次重建网格的逐格差分 ②期间被直接写过的范围 (见 occTouch)
	// ★累积而非覆盖: 脏矩形一直累到**下一次 NAV.refresh 消费**为止 (OCC.dirtyClear)。理由:
	//   差分基线是"上一次重建出来的网格", 若两次重建之间没有 NAV.refresh (世界构建期的
	//   buildOccupancy 就是这种调用), 第二次重建的差分相对的是第一次的产物 —— 覆盖式写入会把
	//   "第一次相对已烘焙状态的改动"丢掉 (两次重建结果相同时差分恒为空 ⇒ 导航永远停在旧状态)。
	//   取并集后: 只有 NAV.refresh 会清账, 中间无论重建几次, 改动集都不会漏。
	OCC.data=d;
{
const dvs=occDiffRects(prev,d,N), pl=OCC.pendList, ac=OCC.dirty;
OCC.pendList=null;
// 簇账合并 (2026-11-11): 三路来源 (本次差分簇 / 直接写登记簇 / 上次遗留账) 并进一张簇表,
// 近距簇由 occRectMerge 并簇; ★累积而非覆盖 (理由见上, 两次重建间无 refresh 时改动集不得漏)。
// OCC.dirty 仍写单一外接矩形 (兼容既有读取口径), OCC.dirtyList 供 NAV.refresh 簇级增量烘焙。
const list=[];
if(dvs) for(let k=0;k<dvs.length;k++) occRectMerge(list,dvs[k].i0,dvs[k].j0,dvs[k].i1,dvs[k].j1);
if(pl) for(let k=0;k<pl.length;k++) occRectMerge(list,pl[k].i0,pl[k].j0,pl[k].i1,pl[k].j1);
if(ac&&ac.i0<=ac.i1&&ac.j0<=ac.j1) occRectMerge(list,ac.i0,ac.j0,ac.i1,ac.j1);
OCC.dirtyList=list.length?list:null;
let r=null;
for(let k=0;k<list.length;k++){ const q=list[k];
r=r?{i0:Math.min(r.i0,q.i0),j0:Math.min(r.j0,q.j0),i1:Math.max(r.i1,q.i1),j1:Math.max(r.j1,q.j1)}:{i0:q.i0,j0:q.j0,i1:q.i1,j1:q.j1};
}
OCC.dirty=r;
}
}
// NAV 消费脏矩形后清账 (07-nav.refresh 末尾调用; 唯一的清账点)
function occDirtyClear(){ OCC.dirty=null; OCC.dirtyList=null; }
function registerDynCollider(cx,cy,cz,w,h,d){
const b=addBoxCollider(cx,cy,cz,w,h,d); // RGRID 增量注册已由 addBoxCollider 统一处理
if(OCC.data){
const i0=clamp(Math.floor((b.minX-0.6+OCC.off)/OCC.res),0,OCC.N-1),i1=clamp(Math.ceil((b.maxX+0.6+OCC.off)/OCC.res),0,OCC.N-1);
const j0=clamp(Math.floor((b.minZ-0.6+OCC.off)/OCC.res),0,OCC.N-1),j1=clamp(Math.ceil((b.maxZ+0.6+OCC.off)/OCC.res),0,OCC.N-1);
for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++) OCC.data[j*OCC.N+i]=1;
occTouch(b.minX-0.6,b.minZ-0.6,b.maxX+0.6,b.maxZ+0.6);
}
return b;
}
function killDynCollider(b){
b.dead=true;
if(OCC.data){
const i0=clamp(Math.floor((b.minX-0.7+OCC.off)/OCC.res),0,OCC.N-1),i1=clamp(Math.ceil((b.maxX+0.7+OCC.off)/OCC.res),0,OCC.N-1);
const j0=clamp(Math.floor((b.minZ-0.7+OCC.off)/OCC.res),0,OCC.N-1),j1=clamp(Math.ceil((b.maxZ+0.7+OCC.off)/OCC.res),0,OCC.N-1);
for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++) OCC.data[j*OCC.N+i]=0;
occTouch(b.minX-0.7,b.minZ-0.7,b.maxX+0.7,b.maxZ+0.7);
}
b.minX=99999; b.minY=99999; b.minZ=99999; b.maxX=99999.1; b.maxY=99999.1; b.maxZ=99999.1;
}
function occBlocked(x,z,ignoreWater){
const i=Math.round((x+OCC.off)/OCC.res), j=Math.round((z+OCC.off)/OCC.res);
if(i<0||j<0||i>=OCC.N||j>=OCC.N) return true;
const v=OCC.data[j*OCC.N+i];
if(v===0) return false;
if(v===2) return !ignoreWater; // 2=水障 (深水): 游泳态 (ignoreWater) 放行, 寻路默认阻挡
return true;
}
