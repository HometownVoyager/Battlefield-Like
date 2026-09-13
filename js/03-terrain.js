// ─────────────────────────────────────────────
// 03-terrain.js —— 地形高度/碰撞体/占用网格
// 源: Index.original.html 第 1096-1329 行
// ─────────────────────────────────────────────
'use strict';
// ── 雪峰山: 主山脊线 (西→东), 沿脊的峰谷参数场 (须在 FLATS 采样 rawHeight 之前定义) ──
const XF_RIDGE=[[-400,40],[-260,15],[-100,-15],[80,-30],[260,-5],[400,55]];
const XF_SEGS=[];
let XF_LEN=0;
{
let cum=0, prev=null;
for(const p of XF_RIDGE){
if(prev){
const l=Math.hypot(p[0]-prev[0],p[1]-prev[1]);
XF_SEGS.push({ax:prev[0],az:prev[1],bx:p[0],bz:p[1],l,l0:cum});
cum+=l;
}
prev=p;
}
XF_LEN=cum;
}
function ridgeInfo(x,z){
let bd=1e9, bt=0;
for(const s of XF_SEGS){
const abx=s.bx-s.ax, abz=s.bz-s.az;
const t=clamp(((x-s.ax)*abx+(z-s.az)*abz)/(abx*abx+abz*abz),0,1);
const px=s.ax+abx*t, pz=s.az+abz*t;
const d=Math.hypot(x-px,z-pz);
if(d<bd){ bd=d; bt=(s.l0+s.l*t)/XF_LEN; }
}
return {d:bd, t:bt};
}
function xfGauss(t,c,w){ const u=(t-c)/w; return Math.exp(-0.5*u*u); }
// 三峰两垭口: 峰1 t≈0.20(H44) 垭口1 t≈0.32(H27) 主峰 t≈0.50(H112) 垭口2 t≈0.655(H31) 峰3 t≈0.84(H52)
function ridgeH(t){
let h=0;
for(const c of [[0.20,44,0.055],[0.50,112,0.075],[0.84,52,0.06]]) h+=c[1]*xfGauss(t,c[0],c[2]);
for(const c of [[0.32,27,0.05],[0.655,31,0.05]]) h+=c[1]*xfGauss(t,c[0],c[2]);
return h;
}
// 地貌语义表 (2026-09-10 三图改造): 淞沪水网 / 百团沟壑 / 莫斯科雪岭 ——
// 与 CITY/RURAL_FIELDS 同约定: 表本体在 config 战役条目, 全链路共读, 严禁布局另写坐标
// DELTA/DELTA_CHANS 已在 00-config 定义 (RIVER 表旁); 此处只补 LOESS/ALPINE
// 必须在 FLATS 初始化之前 (addFlat 调 rawHeight, rawHeight 读这些表 —— TDZ)
const LOESS=CAMPAIGN.loess||null;
const ALPINE=CAMPAIGN.alpine||null;
// 雾林守线语义 (2026-09-13 许特根改版): 北谷(卡尔小径)判定 —— rawHeight/色带/OCC 共用 (表本体在 config.wood)
function woodRavineDist(x,z){
if(!WOOD||!WOOD.ravine) return 1e9;
let gd=1e9;
const P=WOOD.ravine.pts;
for(let i=0;i<P.length-1;i++){
const d=segDist(x,z,P[i][0],P[i][1],P[i+1][0],P[i+1][1]);
if(d<gd) gd=d;
}
return gd;
}
// 谷堑口遮罩: 走廊内=1 (谷壑压平剩 12% 残深=缓坡), 走廊外 5m 渐灭 —— 车辆/步兵/Bot 的合法过谷通道
function woodRampMask(x,z){
if(!WOOD||!WOOD.ravine) return 0;
let m=0;
for(const r of (WOOD.ravine.ramps||[])){
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
// 雪峰山/太行山/百团 640 大地图: 旗点平台必须取当地全高 (山顶/塬面旗点若取 0.55 会被削成盆地边缘悬崖)
const fullH=CAMPAIGN.terr==='xuefeng'||CAMPAIGN.terr==='taihang'||CAMPAIGN.terr==='loess'||CAMPAIGN.terr==='woods';
const addFlat=(x,z,r,h)=>FLATS.push({x,z,r,h:h!==undefined?h:rawHeight(x,z)*0.55});
// 超大地图: 基地平台同样取全高 —— 山后要塞(太行山日军基地)在山坡上, 0.55 系数会挖出盆地边缘悬崖
// 许特根 (woods): 基地/旗点取全高 (林间缓丘上 0.55 同样挖盆); 岭上村台地独立登记 (石屋群需整片平地)
for(const b of CAMPAIGN.bases) addFlat(b.x,b.z,20,fullH?rawHeight(b.x,b.z):undefined);
for(const f of CAMPAIGN.flags) addFlat(f.x,f.z,f.r+12,fullH?rawHeight(f.x,f.z):undefined);
if(WOOD&&WOOD.village){ const V=WOOD.village; addFlat(V.x,V.z,V.r,rawHeight(V.x,V.z)); }
for(const s of (CAMPAIGN.spawns||[])) addFlat(s.x,s.z,8);
if(CAMPAIGN.terr==='rolling') addFlat(0,0,34);
}
// 博卡日农田田块表 (诺曼底): 色带/庄稼软遮蔽/断续树篱共用; 其他战役为空
const RURAL_FIELDS=CAMPAIGN.fields||[];
// 城市语义 (2026-09-05 城市组·斯大林格勒/柏林): 街道矩形/地铁站厅下沉 ——
// 顶点色带/heightAt 下沉/布局建筑避让/小地图 共读 (严禁布局另写一套坐标)
const CITY=CAMPAIGN.city||null;
const METRO=(CITY&&CITY.metro)||null;
// 地铁下沉特征 (2026-09-09 柏林地铁网): 圆=旗点广场浅下沉 (缓坡可走), halls[]/tunnel=矩形深下沉
// (近垂直边缘 + 挡土墙收边, 见 05a metroStation); 各特征独立取深度后取 max (重叠区不叠加深)
const METRO_FALL=0.4; // 矩形下沉边缘过渡带 (m): 近垂直, 由挡土墙遮住地形断口
// 站厅/隧道矩形表 (03-terrain/05-world/沙箱共读一份; 表本体在 config.metro —— 严禁布局另写坐标)
const METRO_RECTS=[];
if(METRO){ for(const h of (METRO.halls||[])) METRO_RECTS.push(h); if(METRO.tunnel) METRO_RECTS.push(METRO.tunnel); }
function rectDist(x,z,x0,z0,x1,z1){
const dx=Math.max(x0-x,0,x-x1), dz=Math.max(z0-z,0,z-z1);
return Math.hypot(dx,dz);
}
function metroDep(x,z){
if(!METRO) return 0;
let dep=0;
const d0=Math.hypot(x-METRO.x,z-METRO.z);
if(d0<METRO.r) dep=Math.max(dep,METRO.d*sstep(1-d0/METRO.r));
for(const s of METRO_RECTS){
const dd=rectDist(x,z,s.x0,s.z0,s.x1,s.z1);
if(dd<METRO_FALL) dep=Math.max(dep,(s.d||METRO.d)*sstep(1-dd/METRO_FALL));
}
return dep;
}
function metroClear(x,z){ // 到最近地铁特征的带外距离 (hgridClear 用)
if(!METRO) return 1e9;
let m=Math.hypot(x-METRO.x,z-METRO.z)-METRO.r;
for(const s of METRO_RECTS){
const dd=rectDist(x,z,s.x0,s.z0,s.x1,s.z1)-METRO_FALL;
if(dd<m) m=dd;
}
return m;
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
// 2026-09-09 柏林地铁站厅/隧道区: 也算建成区 (地面压土色 + 植被让位, 防树/草长进下沉庭院)
if(METRO){
if(Math.hypot(x-METRO.x,z-METRO.z)<METRO.r) return true;
for(const s of METRO_RECTS) if(x>=s.x0&&x<=s.x1&&z>=s.z0&&z<=s.z1) return true;
}
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
let gd=1e9;
for(const g of LOESS.gullies){
for(let i=0;i<g.length-1;i++){
const d=segDist(x,z,g[i][0],g[i][1],g[i+1][0],g[i+1][1]);
if(d<gd) gd=d;
}
}
return gd;
}
// 坡道堑口遮罩: 走廊内=1 (沟壁压平为缓坡), 走廊外 5m smoothstep 渐灭 —— 坦克/步兵/Bot 的合法过沟通道
function rampMask(x,z){
if(!LOESS||!LOESS.ramps) return 0;
let m=0;
for(const r of LOESS.ramps){
const w=r.w||9;
const d=segDist(x,z,r.x0,r.z0,r.x1,r.z1);
const k=d<=w?1:clamp(1-(d-w)/5,0,1);
if(k>m) m=k;
}
return m;
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
// 田埂/堤路: +1.35m, 半宽 2.2m 可走走廊
if(DELTA.ridges){
for(const r of DELTA.ridges){
const d=segDist(x,z,r.x0,r.z0,r.x1,r.z1);
if(d<2.2) h+=1.35*sstep(1-d/2.2);
}
}
// 圩田田面下沉 -0.65 (矩形内; 边缘 sstep 过渡, 不切田埂)
if(DELTA.paddy){
for(const p of DELTA.paddy){
const mx=(x-p.x0)*(x-p.x1), mz=(z-p.z0)*(z-p.z1);
if(mx<=0&&mz<=0){
const dEdge=Math.min(x-p.x0,p.x1-x,z-p.z0,p.z1-z);
if(dEdge>1.5) h-=0.65; else h-=0.65*sstep(dEdge/1.5);
}
}
}
// 鱼塘/藕塘: 圆形浅塘下切 (不进激流)
if(DELTA.ponds){
for(const pd of DELTA.ponds){
const d=Math.hypot(x-pd.x,z-pd.z);
if(d<pd.r+1.2){
const k=clamp(1-d/(pd.r+1.2),0,1);
h-=(pd.t==='lotus'?0.55:0.75)*sstep(k);
}
}
}
// 支流汊港下切
for(const ch of DELTA_CHANS){
for(let i=0;i<ch.length-1;i++){
const d=segDist(x,z,ch[i][0],ch[i][1],ch[i+1][0],ch[i+1][1]);
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
if(LOESS.terraces){
for(const t2 of LOESS.terraces){
const d=rectDist(x,z,t2.x0,t2.z0,t2.x1,t2.z1);
const m=sstep(clamp(1-d/14,0,1));
h=lerp(h,t2.h,m);
}
}
// 黄土峁: 抛物面穹顶 (边缘坡度 2h/R≈20~29°, 坦克可爬; 顶部平缓宜布旗)
if(LOESS.maos){
for(const m2 of LOESS.maos){
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
// 沟底渡台: 沟壑内的低台 (回填至绝对高, 台缘 12m 缓坡≈49°=天然渡口, 沟底库旗点立足台)
if(LOESS.benches){
for(const b2 of LOESS.benches){
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
for(let i=0;i<R.length-1;i++){
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
case 'taihang':{
// 太行山 · 800 超大地图: 山群三峰 (西峰/主峰/东峰) + 环绕平原 ——
// 西峰(-135,15) 72m/主峰(30,-60) 118m/东峰(200,-120) 78m 各为 s3 距离场锥体,
// 峰间交接处形成西垭(-45,-28)/东垭(115,-90) 两个高山鞍部; 平原侧低平 (±2m),
// 山体随高度叠加风化岩噪声 (南面陡环 ~0.9 坡度, 玩家可翻, Bot 可达)
const mt=(cx,cz,H,R)=>{
const d=Math.hypot(x-cx,z-cz);
const dh=clamp(1-d/R,0,1);
return H*sstep(dh);
};
const hM=mt(-135,15,72,135)+mt(30,-60,118,185)+mt(200,-120,78,135);
const base=1.5+0.9*Math.sin(x*0.017+0.4)*Math.cos(z*0.015+1.2)
+0.45*Math.sin(x*0.052+1.5)*Math.sin(z*0.045+0.8)
+0.22*Math.sin(x*0.12+2)*Math.cos(z*0.1+0.4);
const sN=0.5*Math.sin(x*0.06+1)*Math.cos(z*0.055)+0.3*Math.sin(x*0.11+3)*Math.cos(z*0.09+1.2);
return base+hM+Math.min(4,1+hM*0.09)*sN;
}
case 'xuefeng':{
// 雪峰山 · 800 超大地图: 山脊距离场 —— 山麓为连绵丘陵(±8m 起伏), 山坡渐起承主脊,
// 南北两条山前余脉, 沿脊参数 t 取峰谷表(三峰两垭口); 盘山公路穿两个垭口、绕主峰北腰
const ri=ridgeInfo(x,z);
const dh=clamp(1-ri.d/230,0,1);
const s=sstep(dh);
const foot=3.5+2.2*Math.sin(x*0.02+0.7)*Math.cos(z*0.018+1)
+1.4*Math.sin(x*0.043+2)*Math.sin(z*0.037+0.8)
+2.8*Math.sin(x*0.014+1.2)*Math.cos(z*0.016+0.9)
+1.7*Math.sin(x*0.031+2.4)*Math.sin(z*0.027+1.1)
+0.9*Math.sin(x*0.061+0.4)*Math.cos(z*0.055+2);
const sp1=Math.hypot(x+215,z-95), sp2=Math.hypot(x-245,z+85);
const spur=24*Math.exp(-sp1*sp1/(2*70*70))+30*Math.exp(-sp2*sp2/(2*80*80));
return foot+s*s*ridgeH(ri.t)+spur
+s*1.4*Math.sin(x*0.06+1)*Math.cos(z*0.055)+s*0.8*Math.sin(x*0.11+3)*Math.cos(z*0.09+1.2);
}
default:
return 1.4*Math.sin(x*0.021)*Math.cos(z*0.024)
+ 0.9*Math.sin(x*0.052+1.7)*Math.sin(z*0.043+0.6)
+ 0.5*Math.sin(x*0.11+3.1)*Math.cos(z*0.09+1.2);
}
}
function heightAt(x,z,noBridge){
// 2026-09-06 B6/P1-5 快路: 所在 3m 格距全部修正特征(FLATS/地铁下沉/土路/壕沟/河道/桥面)都超出
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
// 柏林地铁站厅/广场: 圆形+矩形下沉 (在 FLATS 之后叠加以保证旗点平台不被抬走)
if(METRO) h-=metroDep(x,z);
// 诺曼底: 博卡日下沉土路 —— 土路低于两侧田野约 0.45m (战壕下切模板减半)
// 城市组不适用 (斯大林格勒田地旗复用农田表, 但城区道路不参与下沉 → !CITY 门控, 2026-09-06)
if(RURAL_FIELDS.length&&!CITY){
const rd=roadDist(x,z);
if(rd<4){
const k=1-rd/4;
h-=0.45*sstep(k);
}
}
// 战壕: 沿线下凹
for(let i=0;i<TRENCHES.length;i++){
const t=TRENCHES[i];
const d=segDist(x,z,t.x1,t.z1,t.x2,t.z2);
if(d<2.4){
const k=1-d/2.4;
h-=1.3*sstep(k);
}
}
	// 河道: 沿折线下切 (d>2 为深谷激流); ford 徒涉滩: 滩心下切按 8% 计 (2026-09-12 胡康巨桥改版)
	if(RIVER){
	let rd=1e9;
	const P=RIVER.pts;
	for(let i=0;i<P.length-1;i++){
	const d=segDist(x,z,P[i][0],P[i][1],P[i+1][0],P[i+1][1]);
	if(d<rd) rd=d;
	}
	if(rd<RIVER.w){
	const k=1-rd/RIVER.w;
	h-=(RIVER.ice?1.2:(RIVER.d||1.9))*sstep(k)*(1-0.92*fordAt(x,z));
	}
	}
	// 支流汊港 (淞沪 delta.channels): 浅切, 不进激流语义 (rawHeight 已含, 此处仅 HGRID 带外快路需要)
	// 注: rawHeight 内已下切; 此处不重复叠加
	// 大桥桥面: 桥矩形区域内地面抬升至桥面高度 (两岸衔接, 步兵/车辆直接通行)
	// noBridge: 采样真实河床/地面 (水面高度计算用, 避免把桥面当河床)
	if(!noBridge&&BRIDGES.length){
	const dy=onBridge(x,z); // 返回桥面高度或 false
	if(dy!==false&&dy>h) h=dy;
	}
	return h;
}
// ===== 高度查询修正带清空场 (2026-09-06 B6/P1-5): 3m 粗格惰性缓存"格心到最近修正特征的带外距离" =====
// 特征集: FLATS 平台/地铁站厅下沉/博卡日土路/壕沟/河道/桥面抬升。格心带距>0 ⇒ 全格点各修正项恒为 0
// (smoothstep 在特征半径外精确为 0), 快路直接返回 rawHeight。惰性首触填充, 无启动停顿。零插值保证逐位等价。
const HGRID={res:3, N:Math.ceil((MAP_SIZE+120)/3), off:(MAP_SIZE+120)/2, data:null};
function hgridClear(iI,jJ){
let d=HGRID.data;
if(d===null){ d=HGRID.data=new Float32Array(HGRID.N*HGRID.N); d.fill(-1); }
const idx=jJ*HGRID.N+iI, cached=d[idx];
if(cached>=0) return cached;
const cx=iI*HGRID.res-HGRID.off+HGRID.res/2, cz=jJ*HGRID.res-HGRID.off+HGRID.res/2;
const PAD=2.2; // 格半对角≈2.12 + 余量
let m=1e9;
for(let k=0;k<FLATS.length;k++){ const f=FLATS[k]; const dd=Math.hypot(cx-f.x,cz-f.z)-f.r; if(dd<m) m=dd; }
if(METRO){ const dd=metroClear(cx,cz); if(dd<m) m=dd; }
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
if(BRIDGES.length) m=-1; // 桥面抬升带 (noBridge 双语义共存): 恒走精修
const clear=m-PAD;
d[idx]=clear;
return clear;
}
// 桥面高度: 取桥两端外侧的岸边地面高度 (惰性求值, 采样点在桥矩形外避免递归)
// 多桥: 每座桥独立缓存 deckY (淞沪石拱桥×2 共用 BRIDGES 表)
const _bridgeDeckY=new Map();
function bridgeDeckY(B){
const b=B||BRIDGE;
if(!b) return 0;
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
// 各战役的战壕布局 (需在地形网格生成前注册)
const TRENCHES=[];
for(const t of (CAMPAIGN.trench||[])) TRENCHES.push({x1:t[0],z1:t[1],x2:t[2],z2:t[3]});
// 正弦路纵线 (2026-09-06 B7a/P2-12: 地形判定/电线杆/小地图/部署图四处共读, 改公式只动这里)
function sineRoadZ(x){ return 3*Math.sin(x*0.02); }
function roadDist(x,z){
let d=CAMPAIGN.sineRoad?Math.abs(z - sineRoadZ(x)):1e9;
for(const r of CAMPAIGN.roads){
d=Math.min(d,segDist(x,z,r[0],r[1],r[2],r[3]));
}
return d;
}
function segDist(px,pz,ax,az,bx,bz){
const abx=bx-ax,abz=bz-az;
const t=clamp(((px-ax)*abx+(pz-az)*abz)/(abx*abx+abz*abz),0,1);
return Math.hypot(px-(ax+abx*t), pz-(az+abz*t));
}
{
// 顶点密度 ~2.77m/格 (320 地图=130 段; 800 地图≈304 段保持分辨率)
const seg=Math.max(64,Math.round((MAP_SIZE+40)/2.76));
const geo=new THREE.PlaneGeometry(MAP_SIZE+40,MAP_SIZE+40,seg,seg);
geo.rotateX(-HPI);
const pos=geo.attributes.position;
const cols=new Float32Array(pos.count*3);
for(let i=0;i<pos.count;i++){
const x=pos.getX(i),z=pos.getZ(i);
pos.setY(i, heightAt(x,z));
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
// 百团黄土沟壑色带 (2026-09-12 立体化): 沟底/渡台暗褐 / 沟壁陡崖崩积坡赭黄(愈深愈红) / 塬面峁顶麦黄 / 川地灰黄
if(CAMPAIGN.terr==='loess'&&LOESS){
const gd=gullyDist(x,z);
const hy=pos.getY(i);
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
// 莫斯科雪岭分带: 雪线以上裸岩灰白 / 雪线附近松林深绿 / 山麓雪覆浅灰
if(CAMPAIGN.terr==='alpine'&&ALPINE){
const hy=pos.getY(i);
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
// 太行山: 山体分带 —— 低坡灌丛褐绿 / 中坡林带深绿 / 山顶裸岩灰白 (陡环风化带)
if(CAMPAIGN.terr==='taihang'){
const hy=pos.getY(i);
if(hy>85){
const k=clamp((hy-85)/26,0,1)*0.8;
r=lerp(r,0.74,k); g=lerp(g,0.72,k); b=lerp(b,0.68,k);
}else if(hy>26){
const k=clamp((hy-26)/59,0,1)*0.55;
r=lerp(r,0.55,k); g=lerp(g,1.06,k); b=lerp(b,0.52,k);
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
cols[i*3]=r; cols[i*3+1]=g; cols[i*3+2]=b;
}
geo.setAttribute('color', new THREE.BufferAttribute(cols,3));
geo.computeVertexNormals();
const ground=new THREE.Mesh(geo, MAT.grass);
ground.receiveShadow=true;
scene.add(ground);
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
function rayCyl(o,dir,c,maxD){
if(c.dead) return null; // 已倒伏/烧毁的树等: 碰撞体即杀 (r=0 防御 + 显式跳过)
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
return { t, nx, ny:0, nz };
}
const OCC={ res:1, N:0, off:(MAP_SIZE+40)/2, data:null };
function buildOccupancy(){
OCC.N=Math.ceil((MAP_SIZE+40)/OCC.res)+1;
const {res,N,off}=OCC;
const d=new Uint8Array(N*N);
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
for(const c of CYLS){
if(c.r<0.28) continue;
const rr=c.r+pad;
mark(c.x-rr,c.z-rr,c.x+rr,c.z+rr,(x,z)=>((x-c.x)*(x-c.x)+(z-c.z)*(z-c.z))<=rr*rr);
}
	// 铁丝网: 标记为占用格, 让Bot寻路尽量绕开 (物理上仍可通行, 误入会减速受伤)
	for(const w of wires){
	const rr=Math.max(0.6,w.r*0.85);
	mark(w.x-rr,w.z-rr,w.x+rr,w.z+rr,(x,z)=>((x-w.x)*(x-w.x)+(z-w.z)*(z-w.z))<=rr*rr);
	}
	// 深谷河道: 整段标记为占用格, Bot/坦克寻路只能走大桥
	if(RIVER&&RIVER.d>2){
	for(let j=0;j<N;j++)for(let i=0;i<N;i++){
	const x=i*res-off, z=j*res-off;
	if(inRiverChannel(x,z)) d[j*N+i]=1;
	}
	}
	// 断崖公路: 山肩以上陡面(高度>15m 且远离公路>20m)记占用格 —— Bot/坦克可上坡抢占伏击点,
	// 但不会翻上最顶的岩脊; 玩家不受限可任意翻爬
	if(CAMPAIGN.id==='canyon'){
	for(let j=0;j<N;j++)for(let i=0;i<N;i++){
	const x=i*res-off, z=j*res-off;
	if(heightAt(x,z)>15&&roadDist(x,z)>20) d[j*N+i]=1;
	}
	}
	// 雪峰山/太行山/莫斯科雪岭: 陡坡(局部坡度>45°, 4m 采样)记占用格 —— Bot/坦克寻路阻断,
	// 随后按公路/旗圈/基地/战壕走廊强制打通 (垭口-公路-旗点平台保持可达)
	if(CAMPAIGN.id==='xuefeng'||CAMPAIGN.id==='taihang'||CAMPAIGN.id==='moscow'){
	const step=4, th=0.95;
	for(let j=4;j<N-4;j+=step)for(let i=4;i<N-4;i+=step){
	const x=i-off, z=j-off;
	const hx=Math.abs(heightAt(x+step,z)-heightAt(x-step,z))/(2*step);
	const hz=Math.abs(heightAt(x,z+step)-heightAt(x,z-step))/(2*step);
	if(Math.max(hx,hz)>th){
	// 标记采样点周围 8×8 (厚墙) —— 寻路节点间隔 5m, 只查节点不查线段, 薄墙会被跨跳过
	for(let k=-2;k<=5;k++)for(let l=-2;l<=5;l++){
	const jj=j+l, ii=i+k;
	if(jj>=0&&jj<N&&ii>=0&&ii<N) d[jj*N+ii]=1;
	}
	}
	}
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
	// 百团沟壑 (2026-09-12 立体化重写): 沟壁带(talus..w)记占用 —— Bot 不翻崖不穿壁;
	// 沟底(gd<bottom)留白=可通行 (坡道网络+渡口把沟底变成渗透路线, 与坡度物理同口径);
	// 坡道走廊/渡台/铁路桥桥位/道路/旗圈/基地逐级打通
	if(CAMPAIGN.id==='baituan'&&LOESS){
	const W=LOESS.w||14, GB=LOESS.bottom||3;
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
	for(let j=0;j<N;j+=4)for(let i=0;i<N;i+=4){
	const x=i*res-off, z=j*res-off;
	const gd=gullyDist(x,z);
	if(gd<=GB||gd>=W) continue;       // 沟底留白 (渗透路线) / 带外
	// 沟壁带: 4×4 厚墙标记 (寻路节点间隔 5m, 薄墙会被跨跳) —— 步进采样, 带≥9m 宽足够覆盖
	for(let k2=0;k2<4;k2++)for(let l2=0;l2<4;l2++){
	const jj=j+l2, ii=i+k2;
	if(jj<N&&ii<N) d[jj*N+ii]=1;
	}
	}
	// 坡道走廊 (半宽+3 渐灭) —— Bot 过沟的合法通道
	for(const r2 of (LOESS.ramps||[])) clearCorr(r2.x0,r2.z0,r2.x1,r2.z1,(r2.w||9)+3);
	// 渡台 (沟底库旗点立足台)
	for(const b2 of (LOESS.benches||[])){
	const mx=(b2.x0+b2.x1)/2, mz=(b2.z0+b2.z1)/2;
	clear(mx,mz,Math.max(b2.x1-b2.x0,b2.z1-b2.z0)/2+4);
	}
	// 铁路桥桥位 (巷沟上的拉锯通道; NAV_CLEARS 之外这里同步放行占用格)
	for(const B2 of BRIDGES) clear(B2.x,B2.z,B2.len/2+6);
	// 道路/旗点/基地走廊 (参照 xuefeng 口径)
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
	const W2=WOOD.ravine, GB=W2.bottom||5;
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
	for(let j=0;j<N;j+=4)for(let i=0;i<N;i+=4){
	const x=i*res-off, z=j*res-off;
	const gd=woodRavineDist(x,z);
	if(gd<=GB||gd>=W2.w) continue;   // 谷底留白 (泥径可走) / 带外
	for(let k2=0;k2<4;k2++)for(let l2=0;l2<4;l2++){
	const jj=j+l2, ii=i+k2;
	if(jj<N&&ii<N) d[jj*N+ii]=1;
	}
	}
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
	OCC.data=d;
}
function registerDynCollider(cx,cy,cz,w,h,d){
const b=addBoxCollider(cx,cy,cz,w,h,d); // RGRID 增量注册已由 addBoxCollider 统一处理
if(OCC.data){
const i0=clamp(Math.floor((b.minX-0.6+OCC.off)/OCC.res),0,OCC.N-1),i1=clamp(Math.ceil((b.maxX+0.6+OCC.off)/OCC.res),0,OCC.N-1);
const j0=clamp(Math.floor((b.minZ-0.6+OCC.off)/OCC.res),0,OCC.N-1),j1=clamp(Math.ceil((b.maxZ+0.6+OCC.off)/OCC.res),0,OCC.N-1);
for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++) OCC.data[j*OCC.N+i]=1;
}
return b;
}
function killDynCollider(b){
b.dead=true;
if(OCC.data){
const i0=clamp(Math.floor((b.minX-0.7+OCC.off)/OCC.res),0,OCC.N-1),i1=clamp(Math.ceil((b.maxX+0.7+OCC.off)/OCC.res),0,OCC.N-1);
const j0=clamp(Math.floor((b.minZ-0.7+OCC.off)/OCC.res),0,OCC.N-1),j1=clamp(Math.ceil((b.maxZ+0.7+OCC.off)/OCC.res),0,OCC.N-1);
for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++) OCC.data[j*OCC.N+i]=0;
}
b.minX=99999; b.minY=99999; b.minZ=99999; b.maxX=99999.1; b.maxY=99999.1; b.maxZ=99999.1;
}
function occBlocked(x,z){
const i=Math.round((x+OCC.off)/OCC.res), j=Math.round((z+OCC.off)/OCC.res);
if(i<0||j<0||i>=OCC.N||j>=OCC.N) return true;
return OCC.data[j*OCC.N+i]===1;
}
