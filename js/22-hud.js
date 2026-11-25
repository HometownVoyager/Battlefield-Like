// ─────────────────────────────────────────────
// 22-hud.js —— HUD/小地图/罗盘/主菜单
// 源: Index.original.html 第 7986-8323 行
// ─────────────────────────────────────────────
'use strict';
const mmC=el('minimap').getContext('2d');
// ── 环礁海域分区 (2026-09-18 塔拉瓦批 / 09-18b 三面 / ★09-19 四面环海): 小地图/大地图/部署图/主菜单沙盘共读同一支 ──
// color: 海面分带 = 四条海岸线 (南/北/西/东, 坐标单源 = 00-config SEA / seaCoastLines) 各自沿海侧法向偏移 d0/d1 围成的
// 多边形; 色带由外向内覆盖: 深海→礁缘→礁盘。颜色不透明 (色带在岬角处必然重叠, 半透明会叠出深斑)。
// ★2026-09-20 修"四角地域没有地图": 各支色带只覆盖自己折线的参数区间, 折线端点之外(图幅四角)没人画 ⇒
//   改为**整幅先铺深海底板**: 地图矩形 ⊕ 岛屿闭合环 (00-config seaCoastRing) 走偶奇填充, 环内保留陆地基色。
//   extent=地图半幅 (小地图的 toMap 带旋转/缩放, 给足余量即可覆盖整个圆盘)。
function drawSeaBands(toMap,c,extent){
if(!SEA||typeof seaCoastLines!=='function') return;
const coasts=seaCoastLines();
const poly=(pts)=>{ c.beginPath(); pts.forEach((p,i)=>{ i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]); }); c.closePath(); c.fill(); };
const DEEP='#1b4a72';
const MH=extent||(MAP_SIZE/2+10);
{
const ring=(typeof seaCoastRing==='function')?seaCoastRing():null;
c.beginPath();
const q=[[-MH,-MH],[MH,-MH],[MH,MH],[-MH,MH]].map(p=>toMap(p[0],p[1]));
q.forEach((p,i)=>{ i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]); });
c.closePath();
if(ring&&ring.length>2){
ring.forEach((p,i)=>{ const t=toMap(p[0],p[1]); i?c.lineTo(t[0],t[1]):c.moveTo(t[0],t[1]); });
c.closePath();
}
c.fillStyle=DEEP;
c.fill(ring&&ring.length>2?'evenodd':'nonzero');
}
const bands=[[36,43,'#2f727a'],[0,36,'#46a6b4']];
for(const [d0,d1,col] of bands){
c.fillStyle=col;
for(const co of coasts) poly(seaBandRing(co,d0,d1).map(p=>toMap(p[0],p[1])));
}
// 干沙滩带 (岸线向陆 14m) + 岸线白线
c.fillStyle='rgba(233,220,176,.62)';
for(const co of coasts) poly(seaBandRing(co,-14,0).map(p=>toMap(p[0],p[1])));
c.strokeStyle='rgba(240,250,255,.9)'; c.lineWidth=1.6;
for(const co of coasts){
c.beginPath();
co.pts.forEach((p,i)=>{ const q=toMap(p[0],p[1]); i?c.lineTo(q[0],q[1]):c.moveTo(q[0],q[1]); });
c.stroke();
}
// 登陆航道 (虚线: 自岸线出海 46m, 供日后登陆艇冲滩; 只画南湾两条, 与 seaChannelMask 的 z0 海域限定一致)
c.strokeStyle='rgba(214,234,120,.9)'; c.lineWidth=2;
c.setLineDash([4,4]);
for(const ch of SEA.channels){
const z0=shoreZAt(ch.x);
const [ax,ay]=toMap(ch.x,z0+3), [bx2,by2]=toMap(ch.x,z0+46);
c.beginPath(); c.moveTo(ax,ay); c.lineTo(bx2,by2); c.stroke();
}
// 四湾进近航道 (sea.lanes): 四面环海 ⇒ 四个可上陆湾口, 各自标一条进近虚线 (朝图心方向 28%)
if(SEA.lanes) for(const L2 of SEA.lanes){
const [ax,ay]=toMap(L2.x,L2.z), [qx,qy]=toMap(L2.x*0.72,L2.z*0.72);
c.beginPath(); c.moveTo(ax,ay); c.lineTo(qx,qy); c.stroke();
}
c.setLineDash([]);
}
// 珊瑚跑道 (机场语义分区; 小地图/大地图/部署图共读)
function drawRunway(toMap,c){
if(!SEA||!SEA.runway) return;
const r=SEA.runway;
const pts=[[r.x0,r.z0],[r.x1,r.z0],[r.x1,r.z1],[r.x0,r.z1]].map(p=>toMap(p[0],p[1]));
c.beginPath();
pts.forEach((p,i)=>{ i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]); });
c.closePath(); c.fillStyle='rgba(228,224,206,.72)'; c.fill();
c.strokeStyle='rgba(255,255,255,.6)'; c.lineWidth=1; c.stroke();
}
// ── 夜档小地图显形 (R3, 昼夜设计 §3.3): 敌方 = 开火后 mapFireT 秒内 OR 距离 < mapNearR 常显;
// 观战/死亡旁路 = 全显 (死亡镜头距参考点无意义, 也按全显)。白天无夜规恒 true —— 2026-09-06 全显裁定零回归。
// 复活旧规则: 下方各绘制块里 "原仅开火后 2.5s 显形" 的注释即本规则的遗迹。
// lastFire: 实体的开火时间戳 (soldier.lastFiredT / 载具 crew.lastFiredT; 没有开火能力的传 undefined)。
// 天气雨规 (天气设计 §5-9): 暴雨/暴风雪启用同机制 (90/2.5), 与夜规的合成单源在 00-config WX_MM_*
//   (近显半径取较小/开火显形取较长; 夜+暴雨 ⇒ 60/2.5 夜规全盖)。白天无雨规 ⇒ WX_MM_NEAR=0 恒 true (零回归)。
function mmEnemyVis(x,z,lastFire){
// ★2026-10-26 排查轮二审 修复 (H5: 全图开关在夜/雨档形同虚设):
//   ①现象 (用户可见): 夜战 / 暴雨档下打开设置里的「地图全图信息」开关, 黑色视野蒙版确实没了 (整张地图
//     亮起来), 但**远处的敌人红点仍然不显示** —— 看得见地形看不见人, 比不开还诡异。开关的语义本来是
//     "我就是要作弊看全图", 结果只放开了地形的一半。
//   ②根因 (旧写为什么错): 小地图/大地图的可见性其实是**两层**, 各有各的判据:
//       · 蒙版层 (drawMinimap/drawBigMap 第 2 层): 用 fullIntel=(typeof MAP_ALL_INTEL!=='undefined'&&MAP_ALL_INTEL)
//         判断要不要压暗 —— 这一层认得全图开关;
//       · 点位层 (第 1 层的 4+4 条 mmEnemyVis 过滤): 走本函数 —— 而本函数**只有**三条判据
//         (白天恒 true / 观战·死亡旁路 / 近显+开火窗), **根本没有 MAP_ALL_INTEL**。
//     于是全图开关只关掉了"暗", 没关掉"滤": 夜/雨档下远端敌人被点位层滤掉, 蒙版层又已经不压暗了 ⇒
//     一张亮着却空无一人的地图。设计 R12 原文写的是「夜间 / 暴雨 / 暴风雪降级为开火显形 + 近距离,
//     **全图开关开则无视天气全图**」(2026-10-25 裁定"跟着开关走") —— 旧实现把这句话拆成两层各管一半,
//     恰恰漏了点位这层。
//   ③现在的单源口径: 全图开关是**最优先**的旁路, 放在 WX_MM_NEAR 判据之前 (开关一开 = 无视天气与时段)。
//     判据仍然只有本函数一处 —— 小地图 (2 处调用) / 大地图 / 指挥地图的 cmdMapDotVis (26-commander
//     委托本函数) 全部自动跟着开关走, 不需要任何一处再各自读 MAP_ALL_INTEL。蒙版层的 fullIntel
//     保留原样 (那是"要不要压暗"的独立判据, 不是"显不显人"——两层职责不同, 不是双源)。
//     MAP_ALL_INTEL 在 00-config 是 let (可写), 设置面板直接赋值; typeof 守卫兜住单独加载 22-hud 的沙箱。
if(typeof MAP_ALL_INTEL!=='undefined'&&MAP_ALL_INTEL) return true;   // 全图开关 = 无视天气与时段 (R12)
if(WX_MM_NEAR<=0) return true;
if(player.spectator||!player.alive) return true;
const dx=x-player.pos.x, dz=z-player.pos.z;
if(dx*dx+dz*dz<WX_MM_NEAR*WX_MM_NEAR) return true;
return lastFire!==undefined&&lastFire>-90&&nowT-lastFire<WX_MM_FIRE;
}
// ── 步兵地图圆点着色单源 (2026-11-13 观战中立批) ──
// 小地图/大地图/部署图三处旧实现逐字重复 (僵尸灰青 / 小队白 / 同队蓝 / 敌红), 且观战态仍按
// "小队=白"画 —— 观战者不指挥任何一方, 白点特权视角取消: 观战时本队一律阵营蓝, 敌方照常红
// (mmEnemyVis 对观战恒 true, 双方等权可见)。非观战行为逐位不变。
// 消费方: 本文件 drawMinimap/drawBigMap + 23-deploy 部署图 (typeof 守卫同 sfNavalMapSymbols 惯例)。
function solMapDotColor(s){
if(s.zombie||s.team===2) return '#9ecfa0';
if(player.spectator) return (s.team===player.team)?'#5a9eff':'#ff5040';
if(s.team===player.team) return s.inSquad?'#ffffff':'#5a9eff';
return '#ff5040';
}
// ── 战场能见度综合计算 (用于小地图/大地图动态视野圆蒙版) ──
function getMapVisDist(){
  let d = 9999;
  if(typeof dryFogFar === 'function'){
    try { d = dryFogFar(); }catch(e){}
  }
  if(typeof NIGHT_MODE !== 'undefined' && NIGHT_MODE) d = Math.min(d, 65);
  if(typeof WX_CFG !== 'undefined' && WX_CFG && (WX_CFG.precip === 'rain' || WX_CFG.precip === 'snow') && WX_CFG.mapNearR){
    d = Math.min(d, WX_CFG.mapNearR);
  }
  return d;
}

// 基础地图要素 (小地图): 海洋、道路、铁路、街区、庄稼、河流、桥梁、地形 (覆盖在蒙版之上)
function drawBaseMapMinimap(toMap, mmC, half, range){
mmC.strokeStyle='rgba(150,130,90,.4)'; mmC.lineWidth=5;
if(SEA){ drawSeaBands(toMap,mmC,MAP_SIZE/2+80); drawRunway(toMap,mmC); }
if(CAMPAIGN.sineRoad){
mmC.beginPath();
for(let x=-(MAP_SIZE/2-5);x<=MAP_SIZE/2-5;x+=10){
const [px,py]=toMap(x,sineRoadZ(x));
x===-(MAP_SIZE/2-5)?mmC.moveTo(px,py):mmC.lineTo(px,py);
}
mmC.stroke();
}
for(const r of CAMPAIGN.roads){
mmC.beginPath();
const [ax,ay]=toMap(r[0],r[1]), [bx2,by2]=toMap(r[2],r[3]);
mmC.moveTo(ax,ay); mmC.lineTo(bx2,by2);
mmC.stroke();
}
if(typeof PGDATA!=='undefined'&&PGDATA&&PGDATA.rail&&PGDATA.rail.length>1){
mmC.strokeStyle='rgba(60,48,34,.95)'; mmC.lineWidth=4;
mmC.beginPath();
for(let i=0;i<PGDATA.rail.length;i++){ const [px,py]=toMap(PGDATA.rail[i][0],PGDATA.rail[i][1]); i?mmC.lineTo(px,py):mmC.moveTo(px,py); }
mmC.stroke();
mmC.strokeStyle='rgba(198,178,140,.95)'; mmC.lineWidth=1.2;
mmC.beginPath();
for(let i=0;i<PGDATA.rail.length;i++){ const [px,py]=toMap(PGDATA.rail[i][0],PGDATA.rail[i][1]); i?mmC.lineTo(px,py):mmC.moveTo(px,py); }
mmC.stroke();
mmC.strokeStyle='rgba(150,130,90,.4)'; mmC.lineWidth=5;
}
if(CAMPAIGN.city){
mmC.fillStyle='rgba(175,175,165,.4)';
for(const s of CAMPAIGN.city.streets){
mmC.beginPath();
const cs2=[[s.x0,s.z0],[s.x1,s.z0],[s.x1,s.z1],[s.x0,s.z1]];
for(let i=0;i<4;i++){ const [px,py]=toMap(cs2[i][0],cs2[i][1]); i===0?mmC.moveTo(px,py):mmC.lineTo(px,py); }
mmC.closePath(); mmC.fill();
}
}
if(CROP_FIELDS.length){
mmC.fillStyle='rgba(160,185,95,.35)';
for(const cf of CROP_FIELDS){
mmC.beginPath();
const [a0,b0]=toMap(cf.x0,cf.z0),[a1,b1]=toMap(cf.x1,cf.z0),[a2,b2]=toMap(cf.x1,cf.z1),[a3,b3]=toMap(cf.x0,cf.z1);
mmC.moveTo(a0,b0); mmC.lineTo(a1,b1); mmC.lineTo(a2,b2); mmC.lineTo(a3,b3);
mmC.closePath(); mmC.fill();
}
}
if(RIVER){
mmC.strokeStyle='rgba(70,110,150,.8)'; mmC.lineWidth=7;
mmC.beginPath();
RIVER.pts.forEach((pt,i)=>{
const [px,py]=toMap(pt[0],pt[1]);
i===0?mmC.moveTo(px,py):mmC.lineTo(px,py);
});
mmC.stroke();
if(RIVER.ford){
const F=RIVER.ford, [fx,fy]=toMap(F.x,F.z);
mmC.strokeStyle='rgba(205,230,240,.95)'; mmC.lineWidth=2.5;
mmC.setLineDash([4,3]);
mmC.beginPath(); mmC.arc(fx,fy,Math.max(6,F.r/range*half*0.8),0,TAU); mmC.stroke();
mmC.setLineDash([]);
}
}
if(typeof DELTA_CHANS!=='undefined'&&DELTA_CHANS.length){
mmC.strokeStyle='rgba(70,110,150,.55)'; mmC.lineWidth=4;
for(const ch of DELTA_CHANS){
mmC.beginPath();
ch.forEach((pt,i)=>{
const [px,py]=toMap(pt[0],pt[1]);
i===0?mmC.moveTo(px,py):mmC.lineTo(px,py);
});
mmC.stroke();
}
}
if(typeof DELTA!=='undefined'&&DELTA&&DELTA.ponds){
for(const pd of DELTA.ponds){
const [px,py]=toMap(pd.x,pd.z);
const rr=pd.r*0.55;
mmC.beginPath(); mmC.arc(px,py,rr,0,TAU);
mmC.fillStyle=pd.t==='lotus'?'rgba(70,120,60,.45)':'rgba(70,110,150,.45)';
mmC.fill();
}
}
if(typeof DELTA!=='undefined'&&DELTA&&DELTA.landmark){
const L=DELTA.landmark;
const [px,py]=toMap(L.x,L.z);
mmC.fillStyle='rgba(160,100,70,.85)';
mmC.fillRect(px-5,py-5,10,10);
mmC.fillStyle='#fff'; mmC.font='bold 8px sans-serif'; mmC.textAlign='center';
mmC.fillText('丝',px,py+3);
}
if(typeof BRIDGES!=='undefined'&&BRIDGES.length){
mmC.strokeStyle='#d8c890'; mmC.lineWidth=5;
for(const B of BRIDGES){
const bx=Math.sin(B.yaw)*(B.len/2), bz=Math.cos(B.yaw)*(B.len/2);
const [ax,ay]=toMap(B.x-bx,B.z-bz), [bx2,by2]=toMap(B.x+bx,B.z+bz);
mmC.beginPath(); mmC.moveTo(ax,ay); mmC.lineTo(bx2,by2); mmC.stroke();
}
}
if(typeof LOESS!=='undefined'&&LOESS&&LOESS.gullies){
mmC.strokeStyle='rgba(158,108,58,.8)'; mmC.lineWidth=6;
for(const g of LOESS.gullies){
mmC.beginPath();
g.forEach((pt,i)=>{
const [px,py]=toMap(pt[0],pt[1]);
i===0?mmC.moveTo(px,py):mmC.lineTo(px,py);
});
mmC.stroke();
}
if(LOESS.ramps){
mmC.strokeStyle='rgba(230,212,160,.95)'; mmC.lineWidth=2.5;
for(const r of LOESS.ramps){
const [ax,ay]=toMap(r.x0,r.z0), [bx2,by2]=toMap(r.x1,r.z1);
mmC.beginPath(); mmC.moveTo(ax,ay); mmC.lineTo(bx2,by2); mmC.stroke();
}
}
}
if(typeof WOOD!=='undefined'&&WOOD&&WOOD.ravine){
mmC.strokeStyle='rgba(96,108,104,.85)'; mmC.lineWidth=7;
mmC.beginPath();
WOOD.ravine.pts.forEach((pt,i)=>{
const [px,py]=toMap(pt[0],pt[1]);
i===0?mmC.moveTo(px,py):mmC.lineTo(px,py);
});
mmC.stroke();
mmC.strokeStyle='rgba(224,216,180,.95)'; mmC.lineWidth=2.5;
for(const r of WOOD.ravine.ramps){
const [ax,ay]=toMap(r.x0,r.z0), [bx2,by2]=toMap(r.x1,r.z1);
mmC.beginPath(); mmC.moveTo(ax,ay); mmC.lineTo(bx2,by2); mmC.stroke();
}
}
if(typeof WOOD!=='undefined'&&WOOD&&WOOD.belt){
const B=WOOD.belt;
mmC.strokeStyle='rgba(70,72,66,.9)'; mmC.lineWidth=4;
for(const bx of [B.x0,B.x1]){
mmC.beginPath();
let [px,py]=toMap(bx,-B.spanZ);
mmC.moveTo(px,py);
[px,py]=toMap(bx,-B.gapZ); mmC.lineTo(px,py);
[px,py]=toMap(bx,B.gapZ); mmC.moveTo(px,py);
[px,py]=toMap(bx,B.spanZ); mmC.lineTo(px,py);
mmC.stroke();
}
}
if(typeof STEPPE!=='undefined'&&STEPPE&&STEPPE.rail){
const [ax,ay]=toMap(STEPPE.rail.x,-MAP_SIZE/2+12), [bx2,by2]=toMap(STEPPE.rail.x,MAP_SIZE/2-12);
mmC.strokeStyle='rgba(58,56,52,.9)'; mmC.lineWidth=3;
mmC.beginPath(); mmC.moveTo(ax,ay); mmC.lineTo(bx2,by2); mmC.stroke();
mmC.strokeStyle='rgba(226,220,196,.9)'; mmC.lineWidth=1;
mmC.beginPath(); mmC.moveTo(ax,ay); mmC.lineTo(bx2,by2); mmC.stroke();
}
if(typeof STEPPE!=='undefined'&&STEPPE&&STEPPE.belt){
const B=STEPPE.belt;
mmC.strokeStyle='rgba(70,72,66,.9)'; mmC.lineWidth=4;
for(const bx of [B.x0,B.x0+6]){
mmC.beginPath();
let seg=false;
for(let z=-B.spanZ;z<=B.spanZ;z+=8){
const gap=B.gaps.some(g=>z>=g[0]&&z<=g[1]);
const [px,py]=toMap(bx,z);
if(gap){ seg=false; continue; }
if(!seg){ mmC.moveTo(px,py); seg=true; } else mmC.lineTo(px,py);
}
mmC.stroke();
}
}
if(typeof STEPPE!=='undefined'&&STEPPE&&STEPPE.mines){
mmC.fillStyle='rgba(168,88,58,.55)';
for(const r of STEPPE.mines.zRuns){
for(let z=r[0]+4;z<r[1]-4;z+=12){
const [px,py]=toMap((STEPPE.mines.x0+STEPPE.mines.x1)/2,z);
mmC.beginPath(); mmC.arc(px,py,2.2,0,TAU); mmC.fill();
}
}
}
}

function drawMinimap(){
const S=190, half=S/2, range=90*Math.max(1,Math.sqrt((CAMPAIGN.mapSize||320)/320));
mmC.clearRect(0,0,S,S);
mmC.save();
mmC.beginPath(); mmC.arc(half,half,half-2,0,TAU); mmC.clip();
mmC.fillStyle='rgba(24,32,18,.9)'; mmC.fillRect(0,0,S,S);
const lt=(player.alive&&player.loiter&&!player.loiter.dead)?player.loiter:null;   // 2026-11-07 实机反馈批 (裁定④): 操控巡飞弹 ⇒ 小地图以弹体为中心/朝向 (本体箭头挪到实际位置, 弹体标记常显)
const cx=player.alive?(lt?lt.pos.x:player.pos.x):0, cz=player.alive?(lt?lt.pos.z:player.pos.z):0;
const rot=player.alive?(lt?lt.yaw:player.yaw):0;
// ★20261121d 批C裁定 (审计疑点"自由观战锚原点"): 自由观战档小地图改锚**观察者** —— 视模式 (specView) 观察者
//   眼位就是 player.pos (specViewTick 逐帧钉宿主 / 自由飞行逐帧推进), 旧写 dead ⇒ cx=cz=0 是死亡镜头时代
//   旧口径: 自由飞行里整张图钉死在世界原点, 人飞走了地图不跟。三种形态: 真 FPV (alive) 与附身 (specViewHost,
//   本体位被 specViewTick 逐帧钉到宿主 ⇒ 锚宿主) 走上面原行照旧; 普通死亡镜头 (!specView) 仍锚原点照旧。
//   有效锚另立 _ax/_az 派生行只改**位置锚**; 旋转档保持 rot 原值 (=0 北向上) —— 裁定只锚"相机位置"+箭头表
//   朝向, 不含随观察者转图; 且 verify-loiterfreeze 对 cx/rot 三行与两处 rotate 惯用串有源码钉 (×2 处含海军
//   包装层), 消费点全部保持原样不碰。观察者箭头见第 4 层 (照玩家自机箭头 idiom)。
const _svObs=(player.specView&&!player.alive);
const _ax=_svObs?player.pos.x:cx, _az=_svObs?player.pos.z:cz;
const c=Math.cos(rot), s=Math.sin(rot);
const invRangeHalf=half/range;
const toMap=(x,z)=>{
let dx=x-_ax, dz=z-_az;
const rx=dx*c-dz*s, rz=dx*s+dz*c;
return [half+rx*invRangeHalf, half+rz*invRangeHalf];
};

// ★2026-10-26 排查轮二审 修复 (H1/P1 回归): 小地图 × 大地图的敌方显形过滤被整段删掉了。
//   ①现象 (用户可见): 夜间 / 暴雨 / 暴风雪档下, 小地图与大地图把**全图**敌军 (步兵 / 坦克 / 卡车 / 飞机)
//     一个不落地画出来, 与既有裁决「夜档 60m 近显 + 开火后 2.5s 显形, 其余一律隐」正面冲突 ——
//     夜战打的本来是"摸黑找人", 结果手里握着全知地图, 夜规/雨规等于不存在。
//     验收侧同步可见: dev/verify-daynight.js 的 T5「22-hud: mmEnemyVis 单源 (定义+两图四块消费)」转红。
//   ②根因 (旧写为什么错): 本文件这一轮重排绘制层 (抽出 drawBaseMapMinimap / drawBaseMapBigMap,
//     新增 getMapVisDist 视野圆蒙版) 时, 动态点层里 8 条 "敌人不可见则 continue" 的过滤被一并删掉,
//     只剩 mmEnemyVis 的定义 = 一条没人调用的死判据。
//     (本注释块刻意不写出带左括号的函数名: dev/verify-daynight.js T5 用 /mmEnemyVis\(/g 数调用点,
//     注释里多写一个字面量就会把那条"定义+两图四块消费"的计数虚增, 判据要的是真调用点。)
//     另注意视野圆蒙版**不能**替代点位过滤: 蒙版画在点层之上、只压暗基础地图,
//     敌人红点照旧透出来 (判据管"显不显", 蒙版管"暗不暗", 两件事)。
//   ③单源口径: 敌显判据全仓只有一处实现 = mmEnemyVis (00-config 的 WX_MM_NEAR/WX_MM_FIRE 合成
//     夜规 + 雨规; 观战 / 死亡旁路全显; 白天 WX_MM_NEAR=0 恒 true = 2026-09-06 全显裁定零回归)。
//     消费点: 本文件小地图 4 条 + 大地图 4 条 + 26-commander 的 cmdMapDotVis (指挥地图)。任何一处
//     都不许另写距离 / 时间窗判断 —— 新增消费点必须调 mmEnemyVis, 不许复制它的公式。
//   ④本次只恢复"过滤"这 8 条; 本轮其他重构 (基础图层抽取 getMapVisDist / 视野圆蒙版) 原样保留。
// ── 第 1 层: 动态点位图层 (在底层绘制士兵、丧尸、坦克、卡车、战机等) ──
for(const sol of soldiers){
if(!sol.alive||sol.onVehicle) continue;
const [px,py]=toMap(sol.pos.x,sol.pos.z);
if(px<-10||py<-10||px>S+10||py>S+10) continue;
const _mc=solMapDotColor(sol);   // 着色单源 (2026-11-13 观战中立批): 观战态本队不再画小队白点
if((_mc==='#ff5040'||_mc==='#9ecfa0')&&!mmEnemyVis(sol.pos.x,sol.pos.z,sol.lastFiredT)) continue; // 夜/雨档: 敌方步兵 = 近距常显 + 开火后显形 (R3); ★20261121d 批C: 丧尸 '#9ecfa0' 同规接入 (旧版过滤门只拦 '#ff5040', 丧尸着色≠红 ⇒ 门外夜/雨恒显; mmEnemyVis 内观战/死亡旁路与全图开关自动跟走; 丧尸 lastFiredT 恒 undefined = 只近距常显, 同卡车口径)
mmC.fillStyle=_mc;
mmC.beginPath(); mmC.arc(px,py,_mc==='#5a9eff'?2.5:3,0,TAU); mmC.fill();
}
for(const t of tanks){
if(!t.alive) continue;
const [px,py]=toMap(t.pos.x,t.pos.z);
if(px<-12||py<-12||px>S+12||py>S+12) continue;
if(t.team!==player.team&&!mmEnemyVis(t.pos.x,t.pos.z,t.crew&&t.crew.lastFiredT)) continue; // 夜/雨档: 敌载具同规 (R3, 开火时间戳取车组)
mmC.fillStyle=t.team===0?'#6da5e8':'#e87a68';
mmC.fillRect(px-4,py-4,8,8);
mmC.strokeStyle='#fff'; mmC.lineWidth=1; mmC.strokeRect(px-4,py-4,8,8);
}
for(const t of trucks){
if(!t.alive) continue;
const [px,py]=toMap(t.pos.x,t.pos.z);
if(px<-10||py<-10||px>S+10||py>S+10) continue;
if(t.team!==player.team&&!mmEnemyVis(t.pos.x,t.pos.z)) continue; // 夜/雨档: 敌方卡车同规 (无开火能力 = 只近距常显)
mmC.fillStyle='#ffd050';
mmC.fillRect(px-3.5,py-3.5,7,7);
mmC.strokeStyle='#554a20'; mmC.lineWidth=1; mmC.strokeRect(px-3.5,py-3.5,7,7);
}
for(const pl of planes){
if(!pl.alive) continue;
const [px,py]=toMap(pl.pos.x,pl.pos.z);
if(px<-15||py<-15||px>S+15||py>S+15) continue;
if(pl.team!==player.team&&!mmEnemyVis(pl.pos.x,pl.pos.z,Math.max(pl.crew?pl.crew.lastFiredT:-99,pl.crewBot?pl.crewBot.lastFiredT:-99))) continue; // 夜/雨档: 敌机同规 (射手可能是机组 Bot 也可能是 crew 记账体, 取两侧时间戳最大)
mmC.save();
mmC.translate(px,py);
mmC.rotate(-(pl.yaw)+rot+Math.PI);
mmC.fillStyle=pl.team===0?'#9dc5f8':'#f8a898';
mmC.beginPath(); mmC.moveTo(0,-5); mmC.lineTo(4,4); mmC.lineTo(0,2); mmC.lineTo(-4,4); mmC.closePath(); mmC.fill();
mmC.restore();
}
for(const n of nades){
const [px,py]=toMap(n.pos.x,n.pos.z);
mmC.fillStyle='#ffd050'; mmC.fillRect(px-1.5,py-1.5,3,3);
}

// ── 第 2 层: 黑色蒙版与视野圆透视 (点位图层之上，基础地图图层之下) ──
const fullIntel=(typeof MAP_ALL_INTEL!=='undefined'&&MAP_ALL_INTEL);
if(!fullIntel && player.alive && !player.spectator){
const visDist=getMapVisDist();
const visRadiusPx=visDist*invRangeHalf;
if(visRadiusPx < half * 1.55){
const rInner=Math.max(0,visRadiusPx*0.72);
const rOuter=Math.max(visRadiusPx,10);
const grad=mmC.createRadialGradient(half,half,rInner,half,half,rOuter);
grad.addColorStop(0,'rgba(24,32,18,0)');
grad.addColorStop(0.85,'rgba(24,32,18,0.7)');
grad.addColorStop(1,'rgba(24,32,18,0.98)');
mmC.fillStyle=grad;
mmC.fillRect(0,0,S,S);
}
}

// ── 第 3 层: 基础地图图层 (道路、河流、铁轨、街区等覆盖在蒙版之上) ──
drawBaseMapMinimap(toMap, mmC, half, range);

// ── 第 4 层: 战略设施与顶层UI (旗帜、强点、补给点、小队、玩家指针) ──
for(const f of FLAGS){
const [px,py]=toMap(f.x,f.z);
mmC.beginPath(); mmC.arc(px,py,10,0,TAU);
mmC.fillStyle=f.owner===0?'rgba(90,140,220,.75)':f.owner===1?'rgba(220,110,90,.75)':f.owner===2?'rgba(120,185,140,.82)':'rgba(160,160,150,.6)';
mmC.fill();
if(f.capTeam!==-1&&f.cap>0.03){
mmC.beginPath(); mmC.arc(px,py,12,-HPI,-HPI+f.cap*TAU);
mmC.strokeStyle=f.capTeam===2?'#b4e8b8':'#fff'; mmC.lineWidth=2; mmC.stroke();
}
mmC.fillStyle='#fff'; mmC.font=f.id.length>1?'bold 8px sans-serif':'bold 11px sans-serif'; mmC.textAlign='center';
mmC.fillText(f.id,px,py+(f.id.length>1?3:4));
}
for(const [si,sp] of (CAMPAIGN.spawns||[]).entries()){
const [px,py]=toMap(sp.x,sp.z);
if(px<-8||py<-8||px>S+8||py>S+8) continue;
const own=(typeof SPOTS!=='undefined'&&SPOTS[si])?SPOTS[si].own:sp.team;
const contested=typeof SPOTS!=='undefined'&&SPOTS[si]&&SPOTS[si].capTeam!==-1;
mmC.save(); mmC.translate(px,py); mmC.rotate(HPI/4);
mmC.fillStyle=own===0?'rgba(90,140,220,.8)':own===1?'rgba(220,110,90,.8)':own===2?'rgba(120,185,140,.85)':'rgba(150,146,138,.8)';
mmC.fillRect(-3.5,-3.5,7,7);
mmC.strokeStyle=contested?'#ffd77a':'#fff'; mmC.lineWidth=contested?1.6:1;
mmC.strokeRect(-3.5,-3.5,7,7);
mmC.restore();
}
	// 巡飞弹标记 (2026-11-07 裁定④: 不开大地图也要看得见弹体 —— 与 drawBigMap 同款菱形, 小图缩配 9px;
	// 操控中弹体=地图中心, 本体箭头画在其真实位置 ⇒ 一眼读出"弹在哪/人在哪")
	if(player.loiter&&!player.loiter.dead){
	const [lpx,lpy]=toMap(player.loiter.pos.x,player.loiter.pos.z);
	mmC.save(); mmC.translate(lpx,lpy); mmC.rotate(HPI/4);
	mmC.fillStyle='#3ee8d8'; mmC.fillRect(-4.5,-4.5,9,9);
	mmC.strokeStyle='#06332e'; mmC.lineWidth=1.5; mmC.strokeRect(-4.5,-4.5,9,9);
	mmC.fillStyle='#fff'; mmC.fillRect(-1.2,-1.2,2.4,2.4);
	mmC.restore();
	}
	if(SUPPLY_POINTS.length){
for(const sp of SUPPLY_POINTS){
const [px,py]=toMap(sp.x,sp.z);
if(px<-8||py<-8||px>S+8||py>S+8) continue;
mmC.fillStyle='#52c878';
mmC.beginPath(); mmC.arc(px,py,3,0,TAU); mmC.fill();
}
}
	if(SQUAD.mode==='move'&&SQUAD.members.length){
	const [px,py]=toMap(SQUAD.pos.x,SQUAD.pos.z);
	mmC.fillStyle='#ffd75a';
	mmC.beginPath(); mmC.moveTo(px,py+5); mmC.lineTo(px-4,py-3); mmC.lineTo(px+4,py-3); mmC.closePath(); mmC.fill();
	}
	// 手雷预瞄地图标记 (2026-11-03 批, NADE_MAP_MARK 设置开关, 账源 _naMapMark/_naMarks 单源 updateNadeArc):
	// 落点小圈半径 = 杀伤圈按本图比例换算 (转图不变形, 圈是各向同性的), 中心一枚小点; 圈内目标描黄边 ——
	// 黄与世界预瞄圈 naBlast 同款 (255,205,90)。画在第 4 层顶层: 夜/雨档第 2 层蒙版会压暗远处点位本身,
	// 黄边在蒙版之上才读得清; 黄边不问 mmEnemyVis (与"圈内 N 人"计数同账, 见 updateNadeArc ③ 头注)。
	if(typeof NADE_MAP_MARK!=='undefined'&&NADE_MAP_MARK&&_naMapMark.on){
	const [mx0,my0]=toMap(_naMapMark.x,_naMapMark.z);
	mmC.strokeStyle='rgba(255,205,90,.95)'; mmC.lineWidth=1.5;
	mmC.beginPath(); mmC.arc(mx0,my0,_naMapMark.r*invRangeHalf,0,TAU); mmC.stroke();
	mmC.fillStyle='rgba(255,205,90,.95)';
	mmC.beginPath(); mmC.arc(mx0,my0,1.6,0,TAU); mmC.fill();
	for(const mk of _naMarks){
	if(!mk.alive||mk.onVehicle) continue;
	const [mx1,my1]=toMap(mk.pos.x,mk.pos.z);
	if(mx1<-6||my1<-6||mx1>S+6||my1>S+6) continue;
	mmC.beginPath(); mmC.arc(mx1,my1,4.4,0,TAU); mmC.stroke();
	}
	}
	if(player.alive){
mmC.save();
const _pp=toMap(player.pos.x,player.pos.z); mmC.translate(_pp[0],_pp[1]); mmC.rotate(rot-player.yaw);   // 2026-11-07: 操控巡飞弹时弹体居中 ⇒ 本体箭头画在其真实位置, 朝向=相对弹体的朝向 (未操控时 rot=player.yaw ⇒ 位移零/旋转零, 与旧写逐位等价)
mmC.fillStyle='#fff';
mmC.beginPath(); mmC.moveTo(0,-6); mmC.lineTo(4,5); mmC.lineTo(-4,5); mmC.closePath(); mmC.fill();
mmC.restore();
}
// ★20261121d 批C裁定: 自由观战观察者箭头 —— 照玩家自机箭头既有 idiom (同 translate/rotate(rot-yaw)/三角,
//   朝向=观察者朝向; rot 保持北向上 ⇒ 箭头在图上随观察者转向摆动, 不随图转)。附身 (specViewHost) 与
//   普通死亡镜头照旧不画 (维持既有行为面)。
else if(player.specView&&!player.alive&&!player.specViewHost){
mmC.save();
const _pp=toMap(player.pos.x,player.pos.z); mmC.translate(_pp[0],_pp[1]); mmC.rotate(rot-player.yaw);
mmC.fillStyle='#fff';
mmC.beginPath(); mmC.moveTo(0,-6); mmC.lineTo(4,5); mmC.lineTo(-4,5); mmC.closePath(); mmC.fill();
mmC.restore();
}
mmC.restore();
mmC.strokeStyle='rgba(210,200,160,.4)'; mmC.lineWidth=1.5;
mmC.beginPath(); mmC.arc(half,half,half-2,0,TAU); mmC.stroke();
}
const cpC=el('compass').getContext('2d');
// ── 战场大地图 (M 开关): 左上小地图的全域放大版 —— 北向固定, 居中面板非全屏 ──
let bigmapOn=false;
function toggleBigMap(){
bigmapOn=!bigmapOn;
el('bigmapWrap').classList.toggle('hidden',!bigmapOn);
AudioSys.click(bigmapOn?1200:800,0.25,0.05);
}
// 基础地图要素 (大地图): 道路、河流、铁轨、街区、大桥 (覆盖在蒙版之上)
function drawBaseMapBigMap(toM, c, MH, S){
c.strokeStyle='rgba(150,130,90,.5)'; c.lineWidth=4;
if(SEA){ drawSeaBands(toM,c,MH); drawRunway(toM,c); }
if(CAMPAIGN.sineRoad){
c.beginPath();
for(let x=-(MAP_SIZE/2-5);x<=MAP_SIZE/2-5;x+=10){ const [px,py]=toM(x,sineRoadZ(x)); x===-(MAP_SIZE/2-5)?c.moveTo(px,py):c.lineTo(px,py); }
c.stroke();
}
for(const r of CAMPAIGN.roads){
c.beginPath();
const [ax,ay]=toM(r[0],r[1]), [bx2,by2]=toM(r[2],r[3]);
c.moveTo(ax,ay); c.lineTo(bx2,by2); c.stroke();
}
if(CAMPAIGN.city){
c.fillStyle='rgba(175,175,165,.38)';
for(const s of CAMPAIGN.city.streets){
const [ax,ay]=toM(s.x0,s.z0), [bx2,by2]=toM(s.x1,s.z1);
c.fillRect(ax,ay,bx2-ax,by2-ay);
}
}
if(CROP_FIELDS.length){
c.fillStyle='rgba(160,185,95,.4)';
for(const cf of CROP_FIELDS){
c.beginPath();
const [a0,b0]=toM(cf.x0,cf.z0),[a1,b1]=toM(cf.x1,cf.z0),[a2,b2]=toM(cf.x1,cf.z1),[a3,b3]=toM(cf.x0,cf.z1);
c.moveTo(a0,b0); c.lineTo(a1,b1); c.lineTo(a2,b2); c.lineTo(a3,b3);
c.closePath(); c.fill();
}
}
if(RIVER){
c.strokeStyle='rgba(70,110,150,.85)'; c.lineWidth=9;
c.beginPath();
RIVER.pts.forEach((pt,i)=>{ const [px,py]=toM(pt[0],pt[1]); i===0?c.moveTo(px,py):c.lineTo(px,py); });
c.stroke();
if(RIVER.ford){
const F=RIVER.ford, [fx,fy]=toM(F.x,F.z);
c.strokeStyle='rgba(205,230,240,.95)'; c.lineWidth=3;
c.setLineDash([7,5]);
c.beginPath(); c.arc(fx,fy,F.r/MH*(S/2)*0.8,0,TAU); c.stroke();
c.setLineDash([]);
}
}
if(typeof BRIDGES!=='undefined'&&BRIDGES.length){
c.strokeStyle='#d8c890'; c.lineWidth=7;
for(const B of BRIDGES){
const bx=Math.sin(B.yaw)*(B.len/2), bz=Math.cos(B.yaw)*(B.len/2);
const [ax,ay]=toM(B.x-bx,B.z-bz), [bx2,by2]=toM(B.x+bx,B.z+bz);
c.beginPath(); c.moveTo(ax,ay); c.lineTo(bx2,by2); c.stroke();
}
}
if(typeof STEPPE!=='undefined'&&STEPPE&&STEPPE.rail){
const [ax,ay]=toM(STEPPE.rail.x,-MAP_SIZE/2+12), [bx2,by2]=toM(STEPPE.rail.x,MAP_SIZE/2-12);
c.strokeStyle='rgba(58,56,52,.95)'; c.lineWidth=4;
c.beginPath(); c.moveTo(ax,ay); c.lineTo(bx2,by2); c.stroke();
c.strokeStyle='rgba(226,220,196,.9)'; c.lineWidth=1.4;
c.beginPath(); c.moveTo(ax,ay); c.lineTo(bx2,by2); c.stroke();
}
if(typeof STEPPE!=='undefined'&&STEPPE&&STEPPE.belt){
const B=STEPPE.belt;
c.strokeStyle='rgba(70,72,66,.95)'; c.lineWidth=5;
for(const bx of [B.x0,B.x0+6]){
c.beginPath();
let seg=false;
for(let z=-B.spanZ;z<=B.spanZ;z+=8){
const gap=B.gaps.some(g=>z>=g[0]&&z<=g[1]);
const [px,py]=toM(bx,z);
if(gap){ seg=false; continue; }
if(!seg){ c.moveTo(px,py); seg=true; } else c.lineTo(px,py);
}
c.stroke();
}
}
}

function drawBigMap(){
const c=el('bigmap').getContext('2d'), S=520;
c.clearRect(0,0,S,S);
c.fillStyle='#141a10'; c.fillRect(0,0,S,S);
const MH=MAP_SIZE/2+10;
const toM=(x,z)=>[S/2+x/MH*S/2, S/2+z/MH*S/2];

// ★2026-10-26 排查轮二审 修复 (H1/P1 回归, 大地图侧): 同 drawMinimap —— 本图 (M 键战场大地图) 的
//   4 条敌方显形过滤被同一轮重排一并删掉。①现象: 夜/雨档按 M 打开大地图 = 全图敌军一览 (比小地图更严重:
//   大地图是全域比例, 一屏能看完整张图的所有红点)。②根因与③单源口径同 drawMinimap 的说明块:
//   判据唯一实现是 mmEnemyVis, 本图只做"搬运"—— 四个消费点 (步兵 lastFiredT / 坦克 crew.lastFiredT /
//   卡车无时间戳 / 飞机 max(crew,crewBot)) 与小地图逐字同参, 保两图逐点一致 (R12 那条验收正是这个意思)。
// ── 第 1 层: 动态点位图层 (底层) ──
for(const s of soldiers){
if(!s.alive||s.onVehicle) continue;
const [px,py]=toM(s.pos.x,s.pos.z);
const _mc=solMapDotColor(s);   // 着色单源 (2026-11-13 观战中立批): 观战态本队不再画小队白点
if((_mc==='#ff5040'||_mc==='#9ecfa0')&&!mmEnemyVis(s.pos.x,s.pos.z,s.lastFiredT)) continue; // 夜/雨档: 敌方步兵同小地图规 (R3); ★20261121d 批C: 丧尸 '#9ecfa0' 同规接入 (与小地图 344 同式, 两图不漂)
c.fillStyle=_mc;
c.beginPath(); c.arc(px,py,_mc==='#5a9eff'?2.5:3,0,TAU); c.fill();
}
for(const t of tanks){
if(!t.alive) continue;
const [px,py]=toM(t.pos.x,t.pos.z);
if(t.team!==player.team&&!mmEnemyVis(t.pos.x,t.pos.z,t.crew&&t.crew.lastFiredT)) continue; // 夜/雨档: 敌载具同规 (R3)
c.fillStyle=t.team===0?'#6da5e8':'#e87a68';
c.fillRect(px-4,py-4,8,8);
c.strokeStyle='#fff'; c.lineWidth=1; c.strokeRect(px-4,py-4,8,8);
}
for(const t of trucks){
if(!t.alive) continue;
const [px,py]=toM(t.pos.x,t.pos.z);
if(t.team!==player.team&&!mmEnemyVis(t.pos.x,t.pos.z)) continue; // 夜/雨档: 敌方卡车同规 (大地图侧, 无开火能力 = 只近距常显)
c.fillStyle='#ffd050';
c.fillRect(px-3.5,py-3.5,7,7);
c.strokeStyle='#554a20'; c.lineWidth=1; c.strokeRect(px-3.5,py-3.5,7,7);
}
for(const pl of planes){
if(!pl.alive) continue;
const [px,py]=toM(pl.pos.x,pl.pos.z);
if(pl.team!==player.team&&!mmEnemyVis(pl.pos.x,pl.pos.z,Math.max(pl.crew?pl.crew.lastFiredT:-99,pl.crewBot?pl.crewBot.lastFiredT:-99))) continue; // 夜/雨档: 敌机同规 (取 crew / crewBot 两侧时间戳最大)
c.save(); c.translate(px,py); c.rotate(Math.PI-pl.yaw);
c.fillStyle=pl.team===0?'#9dc5f8':'#f8a898';
c.beginPath(); c.moveTo(0,-5); c.lineTo(4,4); c.lineTo(0,2); c.lineTo(-4,4); c.closePath(); c.fill();
c.restore();
}

// 飞行中投射物小点 (2026-11-17 批2: 与 drawMinimap 第 1 层 378-381 同款) —— 手雷/迫击炮弹/航弹
//   在飞时小地图有 #ffd050 小点, 大地图原本漏了这一块 ⇒ 开 M 图弹点就"消失" (用户实报)。同色同尺寸补齐。
for(const n of nades){
const [px,py]=toM(n.pos.x,n.pos.z);
c.fillStyle='#ffd050'; c.fillRect(px-1.5,py-1.5,3,3);
}
// ── 第 2 层: 黑色蒙版与视野圆透视 (点位图层之上，基础地图图层之下) ──
const fullIntel=(typeof MAP_ALL_INTEL!=='undefined'&&MAP_ALL_INTEL);
if(!fullIntel && player.alive && !player.spectator){
const visDist=getMapVisDist();
const visRadiusPx=visDist/MH*(S/2);
if(visRadiusPx < S * 0.95){
const [ppx,ppy]=toM(player.pos.x,player.pos.z);
const rInner=Math.max(0,visRadiusPx*0.72);
const rOuter=Math.max(visRadiusPx,12);
const grad=c.createRadialGradient(ppx,ppy,rInner,ppx,ppy,rOuter);
grad.addColorStop(0,'rgba(20,26,16,0)');
grad.addColorStop(0.85,'rgba(20,26,16,0.7)');
grad.addColorStop(1,'rgba(20,26,16,0.98)');
c.fillStyle=grad;
c.fillRect(0,0,S,S);
}
}

// ── 第 3 层: 基础地图图层 (道路、河流、大桥等覆盖在蒙版之上) ──
drawBaseMapBigMap(toM, c, MH, S);

// ── 第 4 层: 战略设施与顶层UI (基地、旗帜、强点、补给点、玩家等) ──
if(BASES.length) [0,1].forEach(t=>{
const [px,py]=toM(BASES[t].x,BASES[t].z);
c.fillStyle=t===0?'#4a70b0':'#b05a4a';
c.fillRect(px-8,py-8,16,16);
c.fillStyle='#fff'; c.font='10px sans-serif'; c.textAlign='center';
c.fillText(TEAM_NAME[t][0],px,py+3);
});
if(SUPPLY_POINTS.length) for(const sp of SUPPLY_POINTS){
const [px,py]=toM(sp.x,sp.z);
c.fillStyle='#48b06a'; c.fillRect(px-4,py-4,8,8);
}
// 手雷预瞄地图标记 (2026-11-03 批, 同 drawMinimap 第 4 层块; 全域比例 px/m = (S/2)/MH, 账源同一份)
if(typeof NADE_MAP_MARK!=='undefined'&&NADE_MAP_MARK&&_naMapMark.on){
const [mx0,my0]=toM(_naMapMark.x,_naMapMark.z);
c.strokeStyle='rgba(255,205,90,.95)'; c.lineWidth=2;
c.beginPath(); c.arc(mx0,my0,_naMapMark.r/MH*(S/2),0,TAU); c.stroke();
c.fillStyle='rgba(255,205,90,.95)';
c.beginPath(); c.arc(mx0,my0,2.2,0,TAU); c.fill();
for(const mk of _naMarks){
if(!mk.alive||mk.onVehicle) continue;
const [mx1,my1]=toM(mk.pos.x,mk.pos.z);
c.beginPath(); c.arc(mx1,my1,5.5,0,TAU); c.stroke();
}
}
for(const f of FLAGS){
const [px,py]=toM(f.x,f.z);
c.beginPath(); c.arc(px,py,13,0,TAU);
c.fillStyle=f.owner===0?'rgba(90,140,220,.85)':f.owner===1?'rgba(220,110,90,.85)':f.owner===2?'rgba(120,185,140,.85)':'rgba(150,150,140,.7)';
c.fill();
if(f.capTeam!==-1&&f.cap>0.03){
c.beginPath(); c.arc(px,py,15,-HPI,-HPI+f.cap*TAU);
c.strokeStyle=f.capTeam===2?'#b4e8b8':'#fff'; c.lineWidth=2; c.stroke();
}
c.fillStyle='#fff'; c.font=f.id.length>1?'bold 9px sans-serif':'bold 13px sans-serif'; c.textAlign='center';
c.fillText(f.id,px,py+(f.id.length>1?3:4));
}
for(const [si,sp] of (CAMPAIGN.spawns||[]).entries()){
const own=(typeof SPOTS!=='undefined'&&SPOTS[si])?SPOTS[si].own:sp.team;
const contested=typeof SPOTS!=='undefined'&&SPOTS[si]&&SPOTS[si].capTeam!==-1;
const [px,py]=toM(sp.x,sp.z);
c.save(); c.translate(px,py); c.rotate(HPI/4);
c.fillStyle=own===0?'#4a70b0':own===1?'#b05a4a':own===2?'#5ea878':'#9a968a';
c.fillRect(-6,-6,12,12);
if(contested){ c.lineWidth=2; c.strokeStyle='#ffd77a'; c.strokeRect(-7,-7,14,14); }
c.restore();
}
if(typeof specVehInfo==='function'){
const gv=specVehInfo();
if(gv&&gv.spawned){
const [px,py]=toM(gv.x,gv.z);
c.fillStyle='#ffffff'; c.fillRect(px-4,py-4,8,8);
c.strokeStyle='#20242a'; c.lineWidth=1.5; c.strokeRect(px-4,py-4,8,8);
}
}
if(player.loiter&&!player.loiter.dead){
const [px,py]=toM(player.loiter.pos.x,player.loiter.pos.z);
c.save(); c.translate(px,py); c.rotate(HPI/4);
c.fillStyle='#3ee8d8'; c.fillRect(-6,-6,12,12);
c.strokeStyle='#06332e'; c.lineWidth=1.5; c.strokeRect(-6,-6,12,12);
c.fillStyle='#fff'; c.fillRect(-1.5,-1.5,3,3);
c.restore();
}
if(player.alive){
const [px,py]=toM(player.pos.x,player.pos.z);
c.save(); c.translate(px,py); c.rotate(-player.yaw);
c.fillStyle='#fff';
c.beginPath(); c.moveTo(0,-7); c.lineTo(5,6); c.lineTo(0,3); c.lineTo(-5,6); c.closePath(); c.fill();
c.restore();
}
}
function drawCompass(){
const W=460,H=26;
cpC.clearRect(0,0,W,H);
cpC.fillStyle='rgba(0,0,0,.35)'; cpC.fillRect(0,0,W,H);
// ★20261121d 批C裁定: 视模式 (specView) 罗盘跟**观察者朝向** —— 旧写 dead ⇒ yaw=0 (死亡镜头时代旧口径):
//   自由观战里朝向读数钉死朝北, 与旗点方位标记 (下方 atan2 吃 player.pos = 观察者眼位, 一直在跟) 自相矛盾。
//   三种形态: 真 FPV (alive) 照旧; 附身/自由观战 (specView, 本体朝向被 specViewTick 逐帧钉宿主或自由飞行)
//   跟观察者朝向; 普通死亡镜头 (!specView) 照旧 0。
const yaw=(player.alive||player.specView)?player.yaw:0;
cpC.font='12px sans-serif'; cpC.textAlign='center';
const marks=[[0,'北'],[HPI,'西'],[Math.PI,'南'],[-HPI,'东'],[Math.PI/4,'西北'],[-Math.PI/4,'东北'],[Math.PI*0.75,'西南'],[-Math.PI*0.75,'东南']];
for(const [a,label] of marks){
let rel=angDiff(yaw,a);
if(Math.abs(rel)>1.2) continue;
const x=W/2-rel/1.2*(W/2);
cpC.fillStyle='rgba(255,255,255,.75)';
cpC.fillText(label,x,17);
}
for(const f of FLAGS){
const a=Math.atan2(player.pos.x-f.x,player.pos.z-f.z);
let rel=angDiff(yaw,a);
if(Math.abs(rel)>1.2) continue;
const x=W/2-rel/1.2*(W/2);
cpC.fillStyle=f.owner===0?'#8fc1ff':f.owner===1?'#ff9c8a':f.owner===2?'#9ecfa0':'#ccc';
cpC.font='bold 13px sans-serif';
cpC.fillText(f.id,x,13);
cpC.fillRect(x-1,18,2,5);
cpC.font='12px sans-serif';
}
cpC.fillStyle='#ffd77a'; cpC.fillRect(W/2-1,2,2,6);
}
let hudSlowT=0;
// 兵种卡锁定样式的对账签名 (2026-10-27 需求「确认之后兵种锁定不可更换」)。
// 单源实现是 23-deploy 的 syncClassCardLock (判据 = R10 门 + 整备门), 本文件只负责**决定什么时候刷新**。
// 为什么这一层必须有: 「布势里点确认开战」那一刻 R10 盖章 (lockedDir null→'in'/'out') 发生在
// 26-commander cmdDeployConfirm 里, 而部署页**还开着** (cmdDeployConfirm 只在 dep 已 hidden 时才调
// showDeploy 重建整页) ⇒ 卡片样式停在「全部可选」, 玩家看得见能点的卡、点下去却被 cmdClassCardGate
// 拦下弹「本局已锁定指挥官」= 样式与状态不符。旧实现把样式逻辑内联在 showDeploy 里, 只有"整页重建"
// 一个触发点, 于是这条路径永远刷不到。
// 口径: 22-hud 不重写判据 (不碰 cmdClassCardGate / 整备门), 只把"锁定态变了"这个事实交给 23-deploy 单源;
// 判据签名变了才调 ⇒ 稳态零 DOM 写入 (与本仓 syncDeployHud 的权威对账纪律同规)。
let _classLockSig=null;
// ── HUD 写入去重包装 (2026-09-26 性能批) ──
// updateHUD 每帧对十几处元素做 textContent/style 赋值, 其中**绝大多数帧的值与上一帧完全相同**
// (血量没掉 / 没在载具上 / 没举准星)。浏览器对"写同一个值"仍要走 CSSOM + 标脏该元素的样式,
// 60fps × 二三十处 = 白开的样式重算; 字符串拼接还要额外产生垃圾。
// 包装语义 = 直接赋值 (幂等写), 只在值真的变了才落到 DOM。缓存按 元素id+属性 记。
// ⚠️ 只在"该字段的写点唯一"处用: 若别处绕过包装直写同一属性, 缓存会失配 (漏写一次)。
//    已逐项核查: 本函数用到的这些 id 的写点全在 22-hud 内 (nadeWarnT/streakBuff 等只是状态量, 由本函数读)。
const _hudW=new Map();
function _hw(id){ let m=_hudW.get(id); if(!m){ m={t:null,h:null,c:null,s:Object.create(null)}; _hudW.set(id,m); } return m; }
function hudText(id,v){ const m=_hw(id); if(m.t===v) return; m.t=v; el(id).textContent=v; }
function hudHTML(id,v){ const m=_hw(id); if(m.h===v) return; m.h=v; el(id).innerHTML=v; }
function hudClass(id,v){ const m=_hw(id); if(m.c===v) return; m.c=v; el(id).className=v; }
function hudStyle(id,prop,v){ const m=_hw(id); const s=String(v); if(m.s[prop]===s) return; m.s[prop]=s;
const st=el(id).style;
// 自定义属性 (--gap 之类) 必须走 setProperty; style['--gap']=… 是无效写法 (非标准属性, 静默丢弃)
if(prop.charCodeAt(0)===45) st.setProperty(prop,s); else st[prop]=s; }
function hudShow(id,v){ hudStyle(id,'display',v?'block':'none'); }
// 双写点字段的兜底专用 (2026-09-28 D6): 绕过去重缓存、按 DOM 实际值幂等写 —— 供 20a-seats 直写同一属性
// 的元素 (tankPip/mgPip/leadPip) 的收尾分支用, 走 hudShow 会因缓存失配漏写 (症状: 坦克准星残留)。
function hudHideReal(id){ const st=el(id).style; if(st.display!=='none') st.display='none'; }
// ★2026-11-13b 批①: FPV 沉浸门 (控弹期收起左下生命面板/右上击杀播报) —— 按 DOM 实际值幂等写 (hudHideReal 同纪律):
//   不走 hudStyle 去重缓存, 因为观战 specViewHudTick 对 healthPanel **直写** display (另一个写点), 走缓存会在
//   两写点交替时失配漏写。killfeed 用 visibility 而非 display: 成就弹框 (27-achievements) 以它的矩形定位,
//   display:none 会把矩形塌成 0 令弹框顶到左上角; visibility 保持布局, 锚不塌 (淡出计时照走, 只是看不见)。
function _ltImmHud(hide){
// ★2026-11-21 P1-17: 自由观战(非附身)早退门 —— specViewHudTick 迁移帧已把 healthPanel 收进 _SV_HUD_HIDE
// (display='none'), 这里还原向的每帧直写 display='' 会把左下生命面板逐帧"复活"成 hp=0 红档+满体力 (与
// 视模式"战斗 HUD 收起"清单正面矛盾, 2026-11-13b 批①引入)。只拦还原向: 控弹期 hide=true 与观战收起同向
// 照常; 附身(specViewHost)/普通死亡/部署页 (specView=false) 全部照旧还原。
if(!hide&&player.specView&&!player.specViewHost) return;
const hp=el('healthPanel');
if(hp&&hp.style.display!==(hide?'none':'')) hp.style.display=hide?'none':'';
const kf=el('killfeed');
if(kf&&kf.style.visibility!==(hide?'hidden':'')) kf.style.visibility=hide?'hidden':'';
}
let _lastHudMountState=null;
function clearWeaponHUDCache(){
_lastHudMountState=null;
_hudW.delete('magN');
_hudW.delete('wname');
_hudW.delete('wmode');
_hudW.delete('resN');
_hudW.delete('nadeN');
}
if(typeof globalThis!=='undefined') globalThis.clearWeaponHUDCache=clearWeaponHUDCache;
// ── 手雷预瞄: 弹道点串 + 贴地落点圈 (2026-09-30 批重做) ──
// 用户本批报: "抛物线沿视线直往前, 圈在面前正放而非聚焦在落点的地上"。两条根因各自修:
//   ① 落点圈旧版画的是**屏幕正圆** (半径按相机右向量换算成像素) —— 圆面永远正对相机, 于是一个 10m 的
//      大圆看着就像悬在脸前的气泡。现在改 SVG 路径: 圆周逐点取**地表高**后逐点投影, 透视下自然是躺
//      在地上的椭圆 (坡地上随坡起伏, 水面落点画在水面), 另叠一个 0.45m 的贴地小圈 = 精确弹着点。
//   ② 弹道旧版是 updateNades 的**抄写件** (重力/盒判/入水/引信各抄一遍), 真弹一改就漂。现在物理合流到
//      13-combat nadeStep (单源积分器, 真弹与预演同一条): 弹跳/撞墙折线/入水哑火/触敌引爆 全部按实弹算。
// ★2026-09-30 批2 (用户复报三条后重做, 三条根因):
//   ③ 弹道点串"沿视线直往正前方, 一人称就是一条线段, 三人称与一人称完全一致" —— 根因是**出手点**
//      (旧: camera.position): 起点落在相机轴线上 ⇒ 整条弹道都在相机轴线所在的竖直平面内 ⇒ 投影必然是
//      一条直线; 三人称相机后拉后起点仍在轴线上 ⇒ 两视角形状一模一样。现在起点/方向走 20-player
//      playerThrowOrigin/playerThrowDir 单源 (右手 + 朝准星命中点汇聚), 与 releaseNade 逐字同源。
//   ④ "按空中爆炸做的, 不总显示落地范围" —— 根因是引信到点即炸 (空炸) 且举雷期引信在烧。现在引爆是
//      "引信到点 **且** 接触"双条件 (00-config 触发引信注), 普通手雷**没有空炸**; 预演**总是画**地面
//      落点圈 (唯一爆点在半空的是撞敌档, 那时再叠一个空炸环)。
//   ⑤ 落点圈样式不变 (贴地椭圆, 见①), 但入水哑火档加 .naWater 冷色降档 (雷不炸, 只标落点)。
// 显示期: 持雷瞄准期 (VM.state==='nade' 且 nadeHeld, G/3/4/6 四弹种; 弹种取自 vmNadeKind 单源)。
// DOM: 点串池化复用, 圈走 index.html 里 #nadeArc 的 SVG 四件 (naBlast/naSpot/naDot/naAir)。
const NADE_ARC_STEP=1/60, NADE_ARC_PT_DT=0.06, NADE_ARC_MAXDOT=64, NADE_ARC_MAXSTEP=420;
// 预演零分配 (2026-11-01 性能批): 持雷瞄准期每帧 420 步积分, 旧版每帧再新建 st/vel + 每点一个 {pos:V3}。
// st/vel 模块槽逐帧全字段重置; 点串池化 (_naPool 复用裸 {x,y,z,bounce} 记录 —— st.pos.distanceTo 只读
// x/y/z, 不要求 V3 实例); 首触地/最终爆点用模块记录 + 置位旗。nadeStep 纯函数不持有 st 引用 ⇒ 跨帧复用安全。
const _naSt={pos:V3(),vel:V3(),fuse:0,armOnFuse:false,at:false,team:0,thrower:null,spin:null};
const _naPool=[]; const _naFirst={x:0,y:0,z:0}, _naFinal={x:0,y:0,z:0};
const NADE_ARC_RING_SEG=36, NADE_ARC_SPOT_R=0.45;   // 贴地圈分段数 / 精确弹着点圈半径 (m)
let _naDots=[], _naLastD={};
const _naP=V3(0,0,0), _naQ=V3(0,0,0);
// 预瞄地图标记账 (2026-11-03 批): 预演激活帧挂落点/圈半径/圈内目标, drawMinimap/drawBigMap 读取画
// "落点小圈 + 圈内目标黄边" (NADE_MAP_MARK 开关, 游戏内容设置)。对象/数组复用零分配 (20261101 性能批同规)。
const _naMapMark={on:false,x:0,z:0,r:0}; const _naMarks=[];
function nadeArcFuseOf(type){ return type==='at'?1.6:Math.max(0,player.nadeFuse); }   // ★2026-11-17 批2.6: frag/smoke/incin 预演引信=烹饪余值 (at 撞炸无引信, 1.6 仅预演积分用)
function nadeArcRingR(type){ return type==='frag'?NADE_BLAST_R:(type==='at'?5.5:3); } // 圈=杀伤范围示意 (at=5.5 溅射圈/烟雾燃烧=云圈示意)
// 地表面高 (画圈用): 有水时画在水面上 —— 入水哑火点/浅水落点才不会把圈画到水底去
function nadeSurfY(x,z){
const gh=heightAt(x,z);
const wy=(typeof waterYAt==='function')?waterYAt(x,z):-1e9;
return (wy>-1e9&&wy>gh)?wy:gh;
}
// 世界点 → 屏幕像素 (null = 在身后/裁剪外): 圈与点串共用。near=自定义近平面 (米):
// 贴地圈用 0.4 —— 擦着相机平面的点会投影到极远屏坐标, 与邻点连线在屏上扫出一条假线, 宁可断弧。
function nadeProj(x,y,z,near){
_naP.set(x,y,z);
_naQ.copy(_naP).applyMatrix4(camera.matrixWorldInverse);
if(_naQ.z>-(near||0.05)) return null;               // 相机空间: 前方为负 z
_naQ.copy(_naP).project(camera);
if(!(_naQ.z<=1)) return null;
const sx=(_naQ.x*0.5+0.5)*innerWidth, sy=(-_naQ.y*0.5+0.5)*innerHeight;
return (isFinite(sx)&&isFinite(sy))?{x:sx,y:sy}:null;
}
// 贴地圆环 → SVG path 数据。★2026-11-03 批 (用户复报"厨雷后爆炸范围只剩一个小圈"): 旧版
// "任一点在身后即整环作废" —— 厨雷 (引信0) 预演落点就在本体前几米, 10m 杀伤圈的后半弧落在相机
// 身后 ⇒ 整圈被裁, 屏上只剩 0.45m 弹着点小圈。现在改**画可见弧段**: 身后/贴面点断路 (下一可见点
// 用 M 重新起笔), 只画真在面前的弧 —— 几何上诚实 (不是把裁掉的半边硬连成假圆), 玩家站进圈里也
// 能凭前弧+弹着小圈读出"自己在圈内"。返回 {d,full}: full=整环可见 (闭合, 保留填充); 开放弧由
// 调用方走 naSet 'sfill' 去填充只留描边 (SVG 开路径的隐式闭合填充会横穿屏面)。
function nadeGroundRing(cx,cz,r){
let d='', seg=0, vis=0;
for(let i=0;i<=NADE_ARC_RING_SEG;i++){
const a=(i%NADE_ARC_RING_SEG)/NADE_ARC_RING_SEG*TAU, x=cx+Math.cos(a)*r, z=cz+Math.sin(a)*r;
const s=nadeProj(x,nadeSurfY(x,z)+0.06,z,0.4);
if(!s){ seg=0; continue; }
vis++;
d+=(seg?'L':'M')+s.x.toFixed(1)+' '+s.y.toFixed(1);
seg++;
}
return vis?{d:d+(vis>=NADE_ARC_RING_SEG?' Z':''),full:vis>=NADE_ARC_RING_SEG}:null;
}
function naSet(id,attr,v){
const k=id+'.'+attr;
if(_naLastD[k]===v) return;
_naLastD[k]=v;
const e=el(id); if(!e) return;
if(attr==='display') e.style.display=v;
else if(attr==='sfill') e.style.fill=v;   // 内联 fill: style.css 类样式压不过内联 —— 部分弧去填充/整环还原只能走 style
else e.setAttribute(attr,v);
}
function updateNadeArc(){
const box=el('nadeArc');
const tip=el('nadeChargeTip');
// 观战同显 (2026-10-24 用户指定"观战模式没有手雷预瞄线/预瞄范围"): 旧版在此排除 spectator —— 观战补全
// 四弹种后预演必须跟上 (弹道点串/落点圈/圈内人数全套同一份)。物理走 13-combat nadeStep 单源纯函数,
// 与时停无耦合 (预演按固定 1/60 步进, 冻结帧里照常可瞄准; 出手后弹体归 specTimeShotDt 玩家链)。
const on=player.alive&&!matchOver&&typeof VM!=='undefined'&&VM.state==='nade'&&player.nadeHeld&&typeof NADE_THROW!=='undefined';
if(!on){
if(box&&box.style.display!=='none') box.style.display='none';
if(tip&&tip.style.display!=='none') tip.style.display='none';
_naMapMark.on=false; _naMarks.length=0;   // 地图标记账同步清 (停瞄准/阵亡/换弹后图上不得残留)
return;
}
box.style.display='block';
const type=vmNadeKind();                                    // 弹种单源 (10-viewmodel): 与手上模型/releaseNade 分流同一判序
const T=NADE_THROW[type];
// 出手点/方向单源 (2026-09-30 批2): 20-player playerThrowOrigin/playerThrowDir —— 与 releaseNade 逐字同源。
const st=_naSt;
const o=playerThrowOrigin(st.pos);
const dir=playerThrowDir(o);
const vel=st.vel; vel.copy(dir).multiplyScalar(T.v); vel.y+=T.up; vel.addScaledVector(player.vel,0.4);
// 与实弹同一积分器 (13-combat nadeStep 单源): 预演即实弹弹道 (st/_naPool 复用槽, 见 NADE_ARC 常量旁声明)
st.fuse=nadeArcFuseOf(type); st.armOnFuse=!!NADE_ARMED_BY_FUSE[type];
st.at=(type==='at'); st.team=player.team; st.thrower=player; st.spin=null;
let np=0, flSet=false, finSet=false, fizzled=false;
for(let i=0;i<NADE_ARC_MAXSTEP;i++){
const ev=nadeStep(st,NADE_ARC_STEP);
if(!flSet&&(ev==='bounced'||ev==='blow'||ev==='fizzle'||st.pos.y<=nadeSurfY(st.pos.x,st.pos.z)+0.08)){
_naFirst.x=st.pos.x; _naFirst.y=st.pos.y; _naFirst.z=st.pos.z; flSet=true;
}
if(ev==='blow'||ev==='fizzle'){
fizzled=(ev==='fizzle');
_naFinal.x=st.pos.x; _naFinal.y=st.pos.y; _naFinal.z=st.pos.z; finSet=true; break;
}
if(np<NADE_ARC_MAXDOT&&i*NADE_ARC_STEP>=NADE_ARC_PT_DT*(np+1)){
const isStationary=flSet&&np>0&&st.pos.distanceTo(_naPool[np-1])<0.05;
if(!isStationary){
let rec=_naPool[np];
if(!rec){ rec={x:0,y:0,z:0,bounce:false}; _naPool.push(rec); }
rec.x=st.pos.x; rec.y=st.pos.y; rec.z=st.pos.z; rec.bounce=!!flSet;
np++;
}
}
}
if(!finSet){ _naFinal.x=st.pos.x; _naFinal.y=st.pos.y; _naFinal.z=st.pos.z; finSet=true; }   // 兜底: 模拟窗内没炸
if(!flSet){ _naFirst.x=_naFinal.x; _naFirst.y=_naFinal.y; _naFirst.z=_naFinal.z; flSet=true; }
const land=_naFinal;
// ① 弹道点串: 空中实心 (.na), 触地后弹跳滚动虚化 (.na.na-bounce)
let used=0;
for(let pi=0;pi<np;pi++){
const pt=_naPool[pi];
const s=nadeProj(pt.x,pt.y,pt.z);
if(!s) continue;
let d=_naDots[used];
if(!d){ d=document.createElement('div'); box.appendChild(d); _naDots[used]=d; }
d.className=pt.bounce?'na na-bounce':'na';
d.style.left=s.x.toFixed(1)+'px'; d.style.top=s.y.toFixed(1)+'px'; d.style.display='block';
used++;
}
for(let i=used;i<_naDots.length;i++) if(_naDots[i].style.display!=='none') _naDots[i].style.display='none';
// ② 落点: 贴地爆圈 + 精确弹着点小圈 + 中心点 —— 在 finalLand 绘制
const gy=nadeSurfY(land.x,land.z);
const air=(land.y>gy+0.25);                       // 撞敌: 真实爆点在半空
if(fizzled){ if(box.className.indexOf('naWater')<0) box.className='naWater'; }
else if(box.className) box.className='';
	const db=nadeGroundRing(land.x,land.z,nadeArcRingR(type));
	if(db){ naSet('naBlast','d',db.d); naSet('naBlast','display','block'); naSet('naBlast','sfill',db.full?'':'none'); }
	else { naSet('naBlast','display','none'); naSet('naBlast','sfill',''); }
	const ds=nadeGroundRing(land.x,land.z,NADE_ARC_SPOT_R);
	if(ds){ naSet('naSpot','d',ds.d); naSet('naSpot','display','block'); } else naSet('naSpot','display','none');
const s=nadeProj(land.x,nadeSurfY(land.x,land.z)+0.06,land.z);
if(s){ naSet('naDot','cx',s.x.toFixed(1)); naSet('naDot','cy',s.y.toFixed(1)); naSet('naDot','display','block'); }
else naSet('naDot','display','none');
if(air){
const sa=nadeProj(land.x,land.y,land.z);
if(sa){ naSet('naAir','cx',sa.x.toFixed(1)); naSet('naAir','cy',sa.y.toFixed(1)); naSet('naAir','display','block'); }
else naSet('naAir','display','none');
} else naSet('naAir','display','none');

	// ③ 圈内人数账 + 预瞄地图标记账 (2026-11-03 批, **同一遍圈同一份判据**): 圈内判据全库只此一处 ——
	//    计数 ("圈内 N 人") 与地图黄边读的是同一份 _naMarks, 两处永不漂移。地图黄边不问 mmEnemyVis
	//    (夜/雨档显形规): 与计数同账 —— 圈内人数本来就无视能见度, 即将挨炸的目标在图上标黄同理。
	const blastR=nadeArcRingR(type);
	let inBlastCount=0;
	_naMarks.length=0;
	if(typeof combatants!=='undefined'){
	for(const s of combatants){
	if(!s||!s.alive||s.isPlayer) continue;
	if(typeof seatShielded==='function'&&seatShielded(s)) continue;
	const d3=Math.hypot(s.pos.x-land.x,(s.pos.y+0.9)-land.y,s.pos.z-land.z);
	const d2=Math.hypot(s.pos.x-land.x,s.pos.z-land.z);
	if(d3<=blastR||(d2<=blastR&&Math.abs(s.pos.y-land.y)<=3.0)){
	inBlastCount++;
	_naMarks.push(s);
	}
	}
	}
	_naMapMark.on=true; _naMapMark.x=land.x; _naMapMark.z=land.z; _naMapMark.r=blastR;
	if(tip){
	tip.style.display='block';
	const dist=Math.hypot(land.x-player.pos.x,land.z-player.pos.z);
	if(type==='frag'){
tip.textContent=t('预计投掷: {0}m · 引信 {1}s · 圈内 {2} 人',dist.toFixed(1),Math.max(0,player.nadeFuse).toFixed(1),inBlastCount);
}else{
tip.textContent=t('预计投掷: {0}m · 圈内 {1} 人',dist.toFixed(1),inBlastCount);
}
}
}
let _depEl=null;   // 部署页元素缓存 (2026-11-01 性能批): 旧版每帧 getElementById; 元素静态, 未挂出前逐帧重试
function updateHUD(dt,pdt){   // pdt = 观察者帧长 (2026-11-08 时停HUD批, 24-main 传入; 探针/旧调用单实参时退化为 dt)
// 真附身读数心 (2026-11-01 用户裁定"要显示血条、弹药、准星、命中反馈等玩家有的HUD"): 附身中血条/低血
// 晕影/绷带行换读宿主 (_hv); 弹药面板不用改 —— specViewTick 已把 player.curW 钉到宿主武器。宿主死亡
// 瞬间回退本体读数 (同帧 specViewTick 检测阵亡自动脱离)。
const _hv=(player.specViewHost&&player.specViewHost.alive)?player.specViewHost:null;
const _hhp=_hv?_hv.hp:player.hp;
seahudScoreboardHook(); // 契约B (2026-09-21 A#7): 幂等懒包装 updateScoreboard (实现在 21-match.js, 见文件末尾追加段)
if(typeof updateDirHits==='function') updateDirHits(); // 受击方向弧逐帧随玩家朝向重算 (2026-09-29; 21-match 实现)
updateNadeArc(); // 手雷预瞄抛物线逐帧重算 (2026-09-30 批; 持雷瞄准期才显示, 内部自带显隐对账)
// 兵种卡锁定态对账 (2026-10-27, 完整根因见上方 _classLockSig 的注释块)。
// 只在部署页开着时做, 且只在**锁定态签名真的变了**才调 23-deploy 的 syncClassCardLock (稳态零 DOM 写入):
//   · 签名 = R10 锁定方向 + 玩家是否已落地 (这两项决定每张卡该不该显示 🔒);
//   · 整备门那半 (活着落地但不在补给箱旁) 由 showDeploy 打开页面的那一刻算过, 不在这里逐帧追 ——
//     它只跟玩家位置有关, 而部署页开着时人不移动 (开页即放开指针锁/停战斗输入)。
if(typeof syncClassCardLock==='function'){
const _dep=_depEl||(_depEl=document.getElementById('deploy'));
if(_dep&&!_dep.classList.contains('hidden')){
const _sig=(typeof CMD!=='undefined'&&CMD?String(CMD.lockedDir):'-')+'|'+((player.alive&&player.deployed)?'1':'0');
if(_sig!==_classLockSig){ _classLockSig=_sig; syncClassCardLock(); }
} else if(_classLockSig!==null){ _classLockSig=null; }   // 页面收起 = 签名作废, 下次开页重新对账
}
// 观战时停**常驻读数** (2026-09-27M 时停修复批, 审计 P2-6): 旧版切换时只有一次 showScorePop, 长时停或
// 中途按 Esc 回来之后没有"我现在停着"的确定读数 (specTimeStatus 是死代码)。读数单源 = 22b 的
// specTimeFrozen() (与主循环消费的那个谓词同一个), 写在 #specTimeInd 上。
// ★ 必须放在**逐帧段**而不是下面那段 10Hz 重绘里: 那段走世界帧长 (`hudSlowT-=dt`), 而时停下 dt=0 ⇒
//   按下 K 之后顶部栏根本不再重绘, 挂进去的读数永远不会出现 (本批自查抓到的第一个坑)。
hudShow('specTimeInd',!!(typeof specTimeFrozen==='function'&&specTimeFrozen()));
// 连杀奖励增益角标 (2026-09-11): 档位配色 lv0金/lv1橙/lv2炽红, 剩余秒数每帧刷新, 到期即撤
if(player.streakBuff){
const rem=player.streakBuff.until-nowT;
if(rem<=0) player.streakBuff=null;
else { hudShow('streakBuff',true);
// 续杯脉冲 (2026-09-16): 21-match 续杯时写入 refillT, 其后 0.45s 内挂 .refill 让角标亮一下
// (秒数读数同一帧跳回满值 = 续杯的直接证据); 类名每帧重算, 脉冲过期即自动摘除。
const rf=player.streakBuff.refillT!==undefined&&nowT-player.streakBuff.refillT<0.45;
hudClass('streakBuff','lv'+(player.streakBuff.lv||0)+(rf?' refill':''));
// 骑乘形态标注 (2026-09-12 "增益跟着人走"): 角标实时显示当前形态下实际生效的增益项
let ctx='';
if(player.onVehicle) ctx=player.onVehicle.kind==='plane'?t(' · 航炮加速'):t(' · 主炮加速');
else if(player.onMG) ctx=t(' · 枪管降温');
else if(player.onAT||player.onAA||player.onMortar||player.onBattery) ctx=t(' · 射速提升');
hudHTML('streakBuff',`⚔ ${t(player.streakBuff.name)} · ${t('得分')}×${player.streakBuff.mul}${ctx}<span class="sbT">${Math.ceil(rem)}s</span>`); }
}
if(!player.streakBuff) hudShow('streakBuff',false);
const w=player.curW;
const curMountKey=(player.onVehicle?(player.onVehicle.kind||'veh'):'')+
(player.onMG?':mg':'')+
(player.onAT?':at':'')+
(player.onAA?':aa':'')+
(player.onBattery?':bat':'')+
(player.loiter?':loiter':'')+
(w?(':'+w.key+':'+(player.onMG?'mg':'nomg')):'');
if(_lastHudMountState!==curMountKey){
_lastHudMountState=curMountKey;
_hudW.delete('magN');
_hudW.delete('wname');
_hudW.delete('wmode');
_hudW.delete('resN');
_hudW.delete('nadeN');
}
// 观战专属载具「幽灵坦克」(2026-09-17 观战扩展批): 不显示装甲血条 (免伤), 明写免伤/穿透口径
if(player.onVehicle&&player.onVehicle.kind==='ghost'){
const t=player.onVehicle;
hudText('wname',t2(t.name));
hudText('wmode',t2('观战载具 · 免伤 · 不被索敌 · 弹丸穿透'));
hudText('magN',t.cannonCd<=0?t2('就绪'):t.cannonCd.toFixed(1));
hudStyle('magN','color',t.cannonCd<=0?'#9fd89f':'#e0c080');
hudText('resN',t2('无差别火力'));
hudText('nadeN',SHOW_CTL_HINTS?t2('主炮[左键] · 机枪[右键] · 车长镜[C] · 大灯[L] · 下车[F]'):''); // 详细操作开关 (2026-11-09 批): 关=隐藏多键操作明细
} else if(player.onVehicle&&player.onVehicle.kind==='plane'){
const t=player.onVehicle;
hudText('wname',t2(t.name));
hudText('wmode',t2('机体 {0}%',Math.max(0,Math.round(t.hp/t.maxHp*100))));
hudText('magN',Math.round(t.speed*3.6)+'km/h');
hudStyle('magN','color','#eee');
hudText('resN',t2('高度 {0}m',Math.round(t.pos.y)));
hudText('nadeN',SHOW_CTL_HINTS?t2('A/D 压坡转向 · 鼠标拉杆 · 炸弹 ×{0} [右键/B]',t.bombs):t2('炸弹 ×{0}',t.bombs)); // 详细操作开关 (2026-11-09 批): 关=留炸弹存量, 隐藏操作明细
} else if(player.onVehicle){
const t=player.onVehicle;
hudText('wname',t2(t.name));
hudText('wmode',t2('装甲 {0}%',Math.max(0,Math.round(t.hp/t.maxHp*100))));
hudText('magN',t.cannonCd<=0?t2('就绪'):t.cannonCd.toFixed(1));
hudStyle('magN','color',t.cannonCd<=0?'#9fd89f':'#e0c080');
hudText('resN','');
hudText('nadeN',SHOW_CTL_HINTS?t2('主炮[左键] · 机枪[右键] · 车长镜[C] · 大灯[L] · 下车[F]'):''); // 详细操作开关 (2026-11-09 批): 关=隐藏多键操作明细
} else if(player.onAT){
hudText('wname',t2('57mm 反坦克炮'));
hudText('wmode',t2('穿甲弹'));
hudText('magN',player.onAT.cd<=0?t2('就绪'):player.onAT.cd.toFixed(1));
hudStyle('magN','color',player.onAT.cd<=0?'#9fd89f':'#e0c080');
hudText('resN',''); hudText('nadeN','');
} else if(player.onAA){
hudText('wname',t2('防空炮'));
hudText('wmode',t2('高爆弹'));
hudText('magN','∞');
hudStyle('magN','color','#eee');
hudText('resN',''); hudText('nadeN','');
// 岸防炮座位 (2026-09-21 A#9 契约 §6): 与反坦克炮同一条读数 (冷却秒数 + 就绪色), 名字取炮位自己的名
// (CAMPAIGN.sea.batteries 的 '西南岬反舰炮台' 等), 与 updatePlayerAT 分支逐项同构。
} else if(player.onBattery){
const g=player.onBattery;
hudText('wname',t2(g.name||'反舰炮台'));
hudText('wmode',t2('穿甲弹'));
hudText('magN',g.cd<=0?t2('就绪'):g.cd.toFixed(1));
hudStyle('magN','color',g.cd<=0?'#9fd89f':'#e0c080');
hudText('resN',''); hudText('nadeN','');
// (2026-11-10: 大舰炮位弹药面板分支随大舰子系统下架摘除)
} else if(player.loiter){
hudText('wname',t2('巡飞弹 · TV制导'));
hudText('wmode',t2('导弹视角'));
hudText('magN',Math.ceil(player.loiter.life)+'s');
hudStyle('magN','color',player.loiter.life<4?'#ff7060':'#9fe89f');
hudText('resN',Math.round(player.loiter.spd)+' m/s');
hudText('nadeN',SHOW_CTL_HINTS?t2('鼠标 制导 · 左键 自爆 · 空格 加速 · 右键 开镜 · U 切换视角 · 本体定身'):''); // 详细操作开关 (2026-11-09 批)
} else if(w){
// 军刀 (2026-11-20 近战重做): 近战没有弹药账 —— 弹数一格显示 '—' / 备弹留空; 低弹变红门必须
// 排除 melee (mag=0 ⇒ 0<=floor(0/2) 恒真, 不排除就是常红)。
if(w.def.melee){
hudText('wname',t2(w.def.name));
hudText('wmode',w.def.mode);
hudText('magN','—');
hudText('resN','');
hudStyle('magN','color','#eee');
}else{
hudText('wname',player.onMG?t2('MG42 通用机枪'):t2(w.def.name));
hudText('wmode',player.onMG?t2('全自动'):w.def.mode);
hudText('magN',player.onMG?'∞':String(w.mag));
hudText('resN',player.onMG?'':'/ '+w.reserve);
// 低弹变红 (2026-11-18 批①用户令): 现有子弹数 ≤ 弹匣总容量/2 (向下取整) 即红 —— 旧 25% 阈值作废
hudStyle('magN','color',(!player.onMG&&!w.def.melee&&w.mag<=Math.floor(w.def.mag/2))?'#ff7060':'#eee');
}
hudText('nadeN',_hv?(t2('绷带[H] ×{0}',_hv.bandages||0)   // ★2026-11-03: 宿主有雷账 (弹药账对齐后随补给消耗/补充), 随绷带一并显示
+(_hv.nades>0?' · '+t2('手雷 ×{0}',_hv.nades):'')+(_hv.atn>0?' · '+t2('AT雷 ×{0}',_hv.atn):''))   // 附身: 宿主读数 (真附身批 2026-11-01)
:(t2('手雷 ×{0}',player.nadeCount)+' · '+t2('绷带[H] ×{0}',player.bandages)
+(player.atNades>0?' · '+t2('AT雷[3] ×{0}',player.atNades):'')   // 2026-10-05: 按携带量显隐 (步枪兵新增 AT雷×2, 原来只认突击兵)
+(CLASSES[player.cls].smoke?' · '+t2('烟雾[4] ×{0}',player.smokeCount):'')
+(player.incinCount>0?' · '+t2('燃烧[6] ×{0}',player.incinCount):'')));
}
// 读条进度条 (2026-09-28 阶段三 P1 建 → ★2026-10-12 用户提议② 扩成"通用读条 + ✕ 取消" → ★2026-10-25 扩容):
//   覆盖全游戏五条读条 —— ① 拆除/回收工事 (player.demolish.t / DEMOLISH_T) ② 固定火力点使用前摇
//   (player.useCast.t / uc.dur) ③ 包扎 (player.bandaging, 总数收在 00-config 的 BANDAGE_T 单源)
//   ④ 举雷待发 (VM 'nade' 哨兵 + nadeHeld; 普通雷显示引信倒数, 其余三弹种无计时显"已举起") ⑤ 换弹
//   (VM 'reload'; 座位态冻结不显示 —— 换弹计时挂在 VM 上, 上车后被冻住, 条不该在驾驶位上挂着跑)。
//   ⑥ 原位换弹 (player.seatReload, ★2026-11-20 火力点坐姿批): 坐固定火力点给随身武器装填, 账在 player
//      不在 VM ⇒ 不吃 _seated 门 (⑤ 的座位门只属于 VM 换弹)。
//   五条账目各在自己文件里, 这里只**读**不写: 取消一律走 player.cancelReadBar (18-game) 那个出口 ⇒
//   "点 ✕ / 按 X / 点左键(举雷除外) / 受击>25 / 移动"收尾完全一致 (用户实报②的模型滞留就是各写一份收尾写漏了)。
//   ★2026-10-30 读条交互批 (用户裁定②③): **同键再按=极少加快** (+2.5% 进度, 不再取消); **其他动作键打断**
//   = 0.5s 内连按同一键两次 (第一次由 barStealArmed 记账, 这里亮"▶ 再按一次打断")。
//   ✕ 按钮 pointer-events:auto + stopPropagation: 触屏与"未锁定指针"时能点到, 且不让窗口 mousedown
//   顺手把指针重新锁上 (锁定时 DOM 收不到点击 ⇒ 键盘 X / 左键顶同一支语义, 见 19-input)。
// 动态建一次; 显隐自管 (不依赖 body.inMenu 继承链), 沙箱 stub 建不出 DOM 时降级为哑对象 (写 style 无副作用)。
if(!window._demolishBar){
try{
const wrap=document.createElement('div');
wrap.style.cssText='position:fixed;left:50%;bottom:138px;transform:translateX(-50%);display:none;z-index:40;pointer-events:none;text-align:center;';
const lb=document.createElement('div');
lb.style.cssText='font-size:11px;line-height:1.4;color:#ffe9bd;text-shadow:0 1px 2px #000;margin-bottom:4px;white-space:nowrap;';
const bar=document.createElement('div');
bar.style.cssText='width:220px;height:6px;margin:0 auto;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.28);border-radius:3px;overflow:hidden;';
const fill=document.createElement('div');
fill.style.cssText='height:100%;width:0%;background:linear-gradient(90deg,#c98f2e,#e8b64c);';
bar.appendChild(fill);
const btn=document.createElement('div');
btn.id='castCancelBtn';   // 探针/样式用的稳定钩子 (无 id 时只能靠 window._demolishBar 摸, 真浏览器验收无法定位)
btn.textContent='✕';
btn.title=t2('取消 (X / 左键)');
btn.style.cssText='pointer-events:auto;cursor:pointer;display:inline-block;margin-top:3px;padding:0 7px;font-size:12px;line-height:16px;color:#ffd9c0;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.3);border-radius:3px;user-select:none;';
const cancel=e=>{ e.preventDefault(); e.stopPropagation(); if(player.specViewHost) return; player.cancelReadBar('已取消'); };   // ★2026-11-03: 真附身中读条是宿主镜像, 不可由玩家✕掐断 (X/左键本就被吞, 同一语义)
btn.addEventListener('mousedown',cancel); btn.addEventListener('touchstart',cancel,{passive:false});
wrap.appendChild(lb); wrap.appendChild(bar); wrap.appendChild(btn); document.body.appendChild(wrap);
window._demolishBar={wrap,lb,fill};
}catch(e){ window._demolishBar={wrap:{style:{}},lb:{},fill:{}}; }
}
{
const db=window._demolishBar;
// 当前读条单源 (顺序 = 优先级; 五条结构上互斥, 这里只防同帧竞态)
const EMCAST={mortar:'使用中: 迫击炮 …',mg:'使用中: 机枪 …',at:'使用中: 反坦克炮 …',aa:'使用中: 防空炮 …'};
// 举雷条 (★2026-10-25): 弹种名单源 vmNadeKind (与手上模型/预演同一判序); 普通雷条 = 引信烧掉比例
//   (烧满即"触物即炸"), 其余三弹种引信 99 哨兵无计时 ⇒ 满条表示"已举起待发"。收雷 = X / ✕。
const _nk=(typeof vmNadeKind==='function'&&typeof player.nadeFuse!=='undefined')?vmNadeKind():null;
const _nkName={at:'反坦克雷 · X 收回',smoke:'烟雾弹 · X 收回',incin:'燃烧弹 · X 收回'};
const _nkLabel={frag:'手雷',smoke:'烟雾弹',incin:'燃烧弹'};   // ★2026-11-17 批2.6: 烟雾/燃烧改真引信后也显倒数
const _nfT={frag:((typeof NADE_FUSE_T!=='undefined')?NADE_FUSE_T:3.8),smoke:1.8,incin:1.6};   // 条分母按弹种全长 (与 00-config NADE_COOK_FUSE 同值)
const _fuseT=(typeof NADE_FUSE_T!=='undefined')?NADE_FUSE_T:3.8;
// 换弹条座位门: 换弹计时在 VM 上, 上车/上炮后被冻 (24-main 不再跑 updateViewModel) —— 条只对步行的
//   换弹显示; 冻结的换弹下车自会续走, 不在此列 (与 24-main 的 updateViewModel 门同一张清单)。
const _seated=player.onVehicle||player.onNaval||player.onMG||player.onAT||player.onAA||player.onMortar||player.onBattery||player.loiter;   // (2026-11-10: capitalGun 项随大舰子系统下架摘除)
const hudBlocked=document.body.classList.contains('inMenu')||document.body.classList.contains('inDeploy')||document.body.classList.contains('hudHide');
const rb=((player.alive||player.specViewHost)&&!hudBlocked)   // ★2026-11-03: 真附身 (specViewHost) 也显读条 —— 镜像驱动的前两条在下
?((player.specViewHost&&typeof VM!=='undefined'&&VM.state==='nade')?{lab:t2('宿主 · 举雷 …'),k:1}   // 真附身镜像条 (2026-11-03): 宿主动作进度 (账在宿主侧, 这里只读 VM)
:(player.specViewHost&&typeof VM!=='undefined'&&VM.state==='bandage')?{lab:t2('宿主 · 包扎 …'),k:clamp((VM.stateT||0)/Math.max(0.01,VM.stateDur||0.01),0,1)}
:player.demolish?{lab:player.demolish.mortar?t2('回收中: 迫击炮 …'):t2('拆除中: {0} …',t2(BUILD_NAMES[player.demolish.b.type])),k:clamp(player.demolish.t/DEMOLISH_T,0,1)}
:player.useCast?{lab:t2(EMCAST[player.useCast.kind]||'使用中: 火力点 …'),k:clamp(player.useCast.t/Math.max(0.01,player.useCast.dur),0,1)}
:player.vehRepair?{lab:t2('坦克维修中: {0}s · 移动/开火打断',Math.max(0,(player.vehRepair.dur||0)-(player.vehRepair.t||0)).toFixed(1)),k:clamp((player.vehRepair.t||0)/Math.max(0.01,(player.vehRepair.dur||0.01)),0,1)}   // 坦克补给箱修理 (2026-11-16 批1): 8s 读条回 25%×maxHp, 打断网见 18-game tryVehRepair
:player.bandaging>0?{lab:t2('包扎中: {0}s',Math.max(0,player.bandaging).toFixed(1)),k:clamp(1-player.bandaging/BANDAGE_T,0,1)}
:player.seatReload>0?{lab:t2('原位换弹: {0}s',Math.max(0,player.seatReload).toFixed(1)),k:clamp(1-player.seatReload/Math.max(0.01,player.seatReloadDur),0,1)}   // ★2026-11-20 火力点坐姿批: 坐固定火力点给随身武器装填 (账在 player 不在 VM, 不吃 _seated 门 — VM 分支的座位门不适用)
:(_nk&&typeof VM!=='undefined'&&VM.state==='nade'&&player.nadeHeld)?(_nk!=='at'   // ★2026-11-17 批2.6: 引信倒数扩到烟雾/燃烧 (at 撞炸无引信, 保持满条"已举起")
?{lab:t2((_nkLabel[_nk]||'手雷')+' · 引信 {0}s · X 收回',Math.max(0,player.nadeFuse).toFixed(1)),k:clamp(1-Math.max(0,player.nadeFuse)/(_nfT[_nk]||_fuseT),0,1)}
:{lab:t2(_nkName[_nk]||'手雷 · X 收回'),k:1})
:(typeof VM!=='undefined'&&VM.state==='reload'&&!_seated)?{lab:t2('换弹中: {0}s',Math.max(0,(VM.stateDur||0)-(VM.stateT||0)).toFixed(1)),k:clamp((VM.stateT||0)/Math.max(0.01,VM.stateDur||0.01),0,1)}
:null)
:null;
if(rb){ db.wrap.style.display='block'; db.lb.textContent=rb.lab+((SHOW_CTL_HINTS&&player.barArmKey&&nowT-player.barArmT<BAR_ARM_WIN)?'　▶ '+t2('再按一次打断'):''); db.fill.style.width=rb.k*100+'%'; }   // ★2026-10-30 读条交互批: 打断双击确认的武装态提示 (barStealArmed 置账, 0.5s 窗口内显示; 2026-11-09 批: 键位提示受详细操作开关管)
else db.wrap.style.display='none';
}
// 载具血量条 (2026-09-01 用户新增: 驾驶坦克/飞机时按压感显示机体血量)
if(player.onVehicle&&(player.onVehicle.kind==='tank'||player.onVehicle.kind==='plane')){
const v=player.onVehicle;
const vhp=v.hp/v.maxHp;
hudShow('vehHpWrap',true);
hudText('vehHpName',t2(v.name));
hudStyle('vehHpBar','width',(Math.max(0,vhp)*100)+'%');
hudStyle('vehHpBar','background',vhp>0.5?'#9fd89f':(vhp>0.25?'#e0c080':'#e07060'));
// 乘员存活计数 (2026-09-21 A#7 契约B): 三人车组 ⇒ 条上直接读 "×3 / ×2 / ×1" 一眼看出车里还剩几人。
// crewRoster() 由 tank-core (15-vehicles) 提供 —— typeof 守卫: 未落盘/飞机 (无乘员编制) 时不显示,
// 绝不让 HUD 因缺一个方法而抛错 (本文件是全游戏 HUD 单源, 每帧必跑)。
// ★ 只在 >0 时追加: 刚 spawn 还没配人 / 沙箱只加载子集 / 车毁后乘员清零这几种情形都读到 0 ——
//   显示 "×0" 会让"编制未配"与"乘员全灭"混为一谈 (Lead 2026-09-21 口径), 故 0 一律不显示计数。
let crewTxt='';
if(typeof v.crewRoster==='function'){
try{ const cr=v.crewRoster(); if(cr&&cr.length>0) crewTxt=' · '+t2('乘员 ×{0}',cr.length); }catch(e){ crewTxt=''; }
}
hudText('vehHpNum',Math.max(0,Math.ceil(v.hp))+' / '+v.maxHp+crewTxt);
}else hudShow('vehHpWrap',false);
// 载具起火持续警告 (2026-11-09 批): 驾驶中机体残血起火 (burning) → 显红字, 烧毁/脱险即隐。
// 舰艇乘员的血量条在 #navalHud 另档, 但警告条不分家 —— onVehicle/onNaval 两种座驾共用这一条。
{
const _bv=(player.onVehicle&&player.onVehicle.alive&&player.onVehicle.burning)||(player.onNaval&&player.onNaval.alive&&player.onNaval.burning);
if(_bv){ hudShow('vehBurnTip',true); hudText('vehBurnTip',t2('⚠ 载具起火! 即将损毁 —— 快脱离!')); }
else hudShow('vehBurnTip',false);
}
hudText('hpNum',Math.ceil(_hhp));   // 附身中血条读宿主 (_hv/_hhp, 真附身批 2026-11-01)
hudStyle('hpBar','width',_hhp+'%');
hudStyle('hpBar','background',_hhp>50?'#cfe0c0':(_hhp>25?'#e0c080':'#e07060'));
hudStyle('stamBar','width',((_hv?1:player.stamina)*100)+'%');   // Bot 无体力账 ⇒ 附身中体力条恒满 (真附身批)
// 低频HUD(10Hz): 小地图/罗盘/票数/旗帜状态, 减少每帧DOM与Canvas开销
// 2026-11-08 时停HUD批: 节流钟吃**观察者**帧长 pdt (时停=真实时间) —— 小地图/罗盘是"跟着观察者转"的显示,
// 时停下观察者仍走动/飞行 (冻战场不冻观察者), 旧写 hudSlowT-=dt 在 dt=0 时永不归零 ⇒ 地图冻死不随人更新。
// 段内世界数据 (兵力/旗点/时钟) 冻结时值本就不变, 重绘走 hudText 指纹去重, 无副作用。单实参调用 (旧探针) 退化 dt。
hudSlowT-=(pdt===undefined?dt:pdt);
if(hudSlowT<=0){
hudSlowT=0.1;
{
	// 兵力一律实票: 攻防/破袭防守方=进攻方×1.25, 劫道双方标准相等票, 征服/遭遇双实票 (2026-09-02 去∞; 2026-09-05 1.75→1.25, 注释漂移修正)
	// 顶部栏显示 剩余兵力(在场人数) (2026-09-04 用户指定: 票数为主, 括号内=该队场上存活人数含玩家/乘员)
	const t0s=Math.ceil(tickets[0]);
	const t1s=Math.ceil(tickets[1]);
	const f0=fieldCount(0), f1=fieldCount(1);
	let modeLine='';
	if(typeof ZOMBIE_MODE!=='undefined'&&ZOMBIE_MODE) modeLine='';
	else if(GAMEMODE==='assault') modeLine=`<div style="font-size:11px;color:#ffd77a">${t('攻防战 · 攻方占超一半且守方仅余1点→守方兵力流失 · 任意一方占满全部旗点→敌方兵力归零 · 全旗+歼灭残兵两条件齐备才判胜{0}',CAMPAIGN.id==='songhu'?t(' · <span style="color:#9fd4e8">浅滩涉水减速 · 深水主河须过石桥</span>'):(CAMPAIGN.sea?t(' · <span style="color:#9fd4e8">礁盘涉水 · 深水游泳[Shift下潜] · 水下憋气有限</span>'):''))}</div>`;
	else if(GAMEMODE==='demolition') modeLine=`<div style="font-size:11px;color:#ffd77a">${t('破袭战 · 剩余补给库: {0}/{1} · 兵力打空后须占满全部点位+歼灭残兵方可判胜',DEPOTS.filter(d=>!d.destroyed).length,DEPOTS.length)}</div>`;
	else if(GAMEMODE==='conquest') modeLine=`<div style="font-size:11px;color:#ffd77a">${CAMPAIGN.bridge?t('拉锯战 · 三路渡河: 大桥/北石桥可通车 · 南徒涉滩可涉渡 · 滩外激流不可徒涉'):t('征服战 · 一方占超一半且对方仅余1点→对方兵力流失 · 占满全部旗点→敌方兵力归零 · 全旗+歼灭残兵两条件齐备才判胜')}</div>`;
	else if(GAMEMODE==='clash') modeLine=`<div style="font-size:11px;color:#ffd77a">${t('遭遇战 · 夺取强点推进战线 · 兵力打空后需占满全部强点+清场残敌方胜')}</div>`;
	else if(GAMEMODE==='convoy'){ const cs=(typeof CONVOY_STATE!=='undefined'&&CONVOY_STATE)?t(' · 剩余 {0} 辆 · 已突围 {1}',CONVOY_STATE.left,CONVOY_STATE.esc):''; modeLine=`<div style="font-size:11px;color:#ffd77a">${t('劫道战 · 毁车过半→劫道方胜, 突围过半→护运方胜 · 兵力打空后须占满全部点位+歼灭残兵方可判胜 · 劫道方补给 {0} 分钟后失效 · 护运方贴车补{1}',Math.round(((CAMPAIGN.convoy&&CAMPAIGN.convoy.supplyLife)||600)/60),cs)}</div>`; }
	// 详细操作开关 (2026-11-09 批): 关=隐藏顶部模式说明 ("……任意一方占满全部旗点……"等局外说明);
	// wipeLine 是实时战况 (兵力归零/清场倒计时), 不属"局外说明", 保留。
	if(!SHOW_CTL_HINTS) modeLine='';
	let wipeLine='';
	if(typeof ZOMBIE_MODE!=='undefined'&&ZOMBIE_MODE){
		if(ZOMBIE_MODE==='solo'){
			if(tickets[player.team]<=0){
				wipeLine+=`<div style="font-size:11px;color:#ff9c8a">${t('⚠ 兵力耗尽 · 全灭即出局')}</div>`;
			}
		}else{
			for(const z of [0,1]){
				if(tickets[z]<=0){
					wipeLine+=`<div style="font-size:11px;color:#ff9c8a">${t('⚠ {0} 兵力归零 · 全灭后出局 (剩 {1} 人)',t(TEAM_NAME[z]),fieldCount(z))}</div>`;
				}
			}
		}
	}else{
		for(const z of [0,1]){
			if(tickets[z]<=0){
				// ★2026-11-19 全模式统一双条件: 点位门槛恒显示 (旧版"对方票尽即豁免显示"已随 21-match 清场判定收紧; 双清空=平局出口, 本行随结算页消失)
				const gl=flagsLostOf(1-z);
				wipeLine+=`<div style="font-size:11px;color:#ff9c8a">${t('⚠ {0} 兵力归零 · {1} 需{2}消灭其场上残兵(剩 {3} 人)方可获胜{4}',t(TEAM_NAME[z]),t(TEAM_NAME[1-z]),gl>0?t('占满全部点位(余 {0} 处)+',gl):'',fieldCount(z),wipeT[z]!==null?`<b style="color:#ffe08a">${t(' · ⏳ 最后一人清场倒计时 {0} 秒',Math.ceil(wipeT[z]))}</b>`:'')}</div>`;
			}
		}
	}
	const tn=' style="font-style:normal;font-size:12px;opacity:.75"';
	// 单队生存 (2026-10-07 裁定3.1): 无敌方队伍 —— 右侧票位改显丧尸在场数, 不再出现"第二个队伍"
	const t1cell=(ZOMBIE_MODE==='solo')
	?`<span class="tr">☣ ${ZOMBIES.filter(z=>z.alive).length}</span>`
	:`<span class="tr">${t1s} ${t(TEAM_NAME[1])}<span${tn}>${t('({0}人)',f1)}</span></span>`;
	// 左格阵营自适应 (2026-10-28 修复, 指导 §4.7): solo 右格已被丧尸数占位 ⇒ 左格是玩家唯一队伍行,
	// 旧硬编码 TEAM_NAME[0] 在"选 1 队 (德军/日军) 开局"时穿帮成未参战的 0 队。teams/普通模式仍显 0 队。
	const _pt=(ZOMBIE_MODE==='solo')?player.team:0;
	// ★2026-11-11 性能批: 走 hudHTML 指纹去重 (22-hud hudText/hudStyle 同纪律) —— 旧版 10Hz 无条件
	// innerHTML 重写整段 (拼 ~1KB 模板串 + HTML 重解析 + 子树重建 + style/layout 失效化), 而绝大多数
	// 帧内容逐位相同 (票数/人数/词条没变)。同串短路后只有真变化才落 DOM。
	hudHTML('tickets',`<span class="tl">${t(TEAM_NAME[_pt])} ${Math.ceil(tickets[_pt])}<span${tn}>${t('({0}人)',fieldCount(_pt))}</span></span> &nbsp;·&nbsp; ${t1cell}`+modeLine+wipeLine+
	((SHOW_CTL_HINTS&&player.spectator&&!player.specViewHost)?`<div style="font-size:11px;color:#9fe8ff">${t('观战中 · 免伤 · 不被索敌 · 双击空格悬停/H气动飞行 · 左键可开火 · 控弹时T=弃弹传送 · F=按状态(幽灵坦克上=下车/舰艇上=鱼雷·下船/其余=召唤幽灵坦克)'+((typeof cmdSpecHudKeys==='function')?cmdSpecHudKeys():' · V=减速')+'(不耗资源)')}</div>`:''));   // 减速词条走 26-commander cmdSpecHudKeys 单源 (R8: 观战减速共键免读条; 2026-10-27 排查批接线 —— 旧写硬编码 'N=减速' 是换键 V 之前的旧串, 词典键已是 V ⇒ 查表必 miss: 英文整句退回中文 + 键名错)。附身中不显这条 (文案宣称"左键可开火"与只读借眼矛盾, 状态由 👁 徽标接管, 真附身批 2026-11-01)
}
if(typeof ZOMBIE_MODE!=='undefined'&&ZOMBIE_MODE){
el('timeTxt').style.display='none';
}else{
el('timeTxt').style.display='';
const mm=Math.floor(Math.max(0,matchTime)/60), ss2=Math.floor(Math.max(0,matchTime)%60);
el('timeTxt').textContent=`${mm}:${ss2<10?'0':''}${ss2}`;
}
FLAGS.forEach((f,i)=>{
const fi=el('fi'+i);   // ★2026-10-02 与 23-deploy applyFlagOwnership 同一 id 序 (索引) —— 旧版 fi<旗名>
                       //   在海战图两军旗点同名时 id 撞车, 后一军的图标永远 null/不更新 (= 灰色图标)。
if(!fi) return;   // 2026-09-20N (Lead 指派的最小守卫): 首屏(未开局)时 #flagIcons 还是 index.html 的静态 A..E,
                  // 当前战役旗 id 不同 (中文 id 有 8 张图) ⇒ el() 返回 null, 旧代码每帧抛
                  // TypeError 且 __sfBooted 永不置位 (真浏览器启动链卡死). 开局后 applyFlagOwnership()
                  // 已按本图重建 fi<id>, 此分支自然不再走到. #topBar 在 #ui 内、主菜单期 #ui display:none
                  // ⇒ 首屏这几个图标本就不可见, 不存在"显示成 A..E"的观感问题.
fi.className=(f.owner===0?'f0':f.owner===1?'f1':f.owner===2?'f2':'')+(f.capTeam!==-1&&f.cap>0.03?' fc':'');
});
drawMinimap();
// 大地图: 阵亡/退出部署时自动收起, 存活期间按帧刷新
if(bigmapOn&&(!player.alive||!player.deployed)){ bigmapOn=false; el('bigmapWrap').classList.add('hidden'); }
if(bigmapOn) drawBigMap();
drawCompass();
// 小队HUD (★2026-11-13 观战中立批: 观战态隐藏 —— 观战者不指挥小队, "跟随中"文案在观战时是误导)
const sqEl=el('squadHUD');
if(SQUAD.members.length&&player.deployed&&!player.spectator){
const alive=SQUAD.members.filter(s=>s.alive).length;
sqEl.style.display='block';
// ★20261121c P2#31: 整行走词典 (EN 词典缺键, 中文直写回退) —— 状态段/键位提示段拆成 {2}{3} 占位, 状态词单独成键
sqEl.innerHTML=t2('◆ 小队 <b>{0}/{1}</b> · {2}<br><span style="opacity:.65">{3}</span>',alive,SQUAD.members.length,SQUAD.mode==='move'?'<b>'+t2('进攻标记点')+'</b>':t2('跟随中'),t2('[T] 标点进攻 · [Y] 跟随我'));
} else sqEl.style.display='none';
}
let inFlag=null;
if(player.alive) for(const f of FLAGS){ if(Math.hypot(player.pos.x-f.x,player.pos.z-f.z)<f.r) inFlag=f; }
if(inFlag&&(inFlag.capTeam!==-1&&inFlag.cap>0.02||inFlag.owner!==player.team||(inFlag.present&&inFlag.present[0]>0&&inFlag.present[1]>0))){
hudShow('capPanel',true);
hudText('capLetter',inFlag.id);
hudStyle('capBarFill','width',(inFlag.cap*100)+'%');
// 争夺状态: 双方同时在圈内 → 进度冻结并黄条提示, 不再表现为"进度条不动"
const contested=inFlag.present&&inFlag.present[0]>0&&inFlag.present[1]>0;
hudStyle('capBarFill','background',contested?'#e8d06a':(inFlag.capTeam===0?'#8fc1ff':(inFlag.capTeam===2?'#9ecfa0':'#ff9c8a')));
let capTxt;
// ★20261121c P2#31: 占领五态走词典 (EN 词典缺键) —— 争夺/占领中/我方/中立提示/敌方, 一态一键
if(contested) capTxt=t2('⚠ 争夺中 · 圈内仍有敌军');
else capTxt=inFlag.capTeam===player.team?t2('正在占领…'):(inFlag.capTeam===-1?(inFlag.owner===player.team?t2('我方控制'):t2('站在旗点范围内占领')):t2('敌军正在占领!'));
hudText('capTxt',capTxt);
} else hudShow('capPanel',false);
dmgFlash=Math.max(0,dmgFlash-dt*2);
hudStyle('dmgOv','opacity',dmgFlash);
hudStyle('lowOv','opacity',_hv?(_hhp<35?(1-_hhp/35)*0.85:0):(player.alive&&player.hp<35?(1-player.hp/35)*0.85:0));   // 附身: 低血晕影读宿主 (真附身批 2026-11-01)
	hudStyle('supOv','opacity',player.suppressV*0.7);
	const tvEl=el('tvOv');
	if(tvEl&&tvEl.style.display!==(player.loiter?'block':'none')) tvEl.style.display=player.loiter?'block':'none';
	// ★2026-11-10 批"加点料": FPV OSD 逐帧驱动 (时间码/离地/速度/离机/存续条/开镜标) —— 全走
	//   hudText/hudStyle 去重缓存, 与弹药面板同纪律; 存续<4s 整框红脉冲 (tvOv.low) + 填充条转红,
	//   阈值与 magN 倒计时同一条; 弹体存续上限读 lifeMax (fireLoiter 出膛记账), 缺省兜底 24。
	if(player.loiter&&!player.loiter.dead){
	const d=player.loiter;
	const agl=Math.max(0,Math.round(d.pos.y-heightAt(d.pos.x,d.pos.z)));
	const boost=(keys.Space&&!player._ltSpace);   // ★2026-11-13b 批②: 尾推加速判定 (与 updateLoiters boost 同判据; ▸▸标/状态类/尾推本体三处共用一条)
	const zoom=!!(mouse2Down&&!player._ltRClick);  // 开镜判定 (2026-11-10 OSD 批既有判据, 提出共用)
	hudText('tvBotL',t2('离地')+' '+agl+'m · '+t2('速度')+' '+Math.round(d.spd)+'m/s'+(boost?' ▸▸ '+t2('加速'):''));
	hudText('tvBotR',t2('离机')+' '+Math.round(d.pos.distanceTo(player.pos))+'m');
	const _tc=Math.max(0,nowT), _tm=Math.floor(_tc/60)%100, _ts=Math.floor(_tc%60);
	hudText('tvClock','T+'+(_tm<10?'0':'')+_tm+':'+(_ts<10?'0':'')+_ts+'.'+Math.floor(_tc*10%10));
	hudShow('tvZoom',zoom);   // 开镜标: 与 updateCamera 巡飞分支同判据
	// ★2026-11-13b 批②: 开镜倍率实时读数 —— camera.fov 向 LOITER_ZOOM_FOV(30) 阻尼的过程中 ×1.0→×2.8
	//   连续变化 (85/fov), 开镜有"变焦进行中"的观感; 沙箱/异常兜底恒 ×1.0。
	hudText('tvZoom','ZOOM ×'+((typeof camera!=='undefined'&&camera&&camera.fov>1)?Math.round(85/camera.fov*10)/10:1));
	// ★2026-11-13b 批②: 加速/开镜状态类挂 #tvOv (CSS 状态层: 加速=角标琥珀脉冲+暖色晕影+OSD 转暖;
	//   开镜=四周压暗+分划加粗+ZOOM 标提亮) —— 与 'low' 低量脉冲同一写点 (hudClass 整串写, 状态叠加由类共存承担)。
	hudClass('tvOv',(d.life<4?'low':'')+(boost?' boost':'')+(zoom?' zoom':''));
	// ★2026-11-13b 批①: FPV 沉浸门 — 控弹期收起左下生命面板与右上击杀播报 (小地图/顶部战况/准星照旧)
	_ltImmHud(true);
	// ★2026-11-11 性能批: 存续条宽量化到整数 % —— 旧版每帧连续值 (d.life/lifeMax*100 连续排空) 令
	// hudStyle 指纹去重失效 (每帧一次 style 写 + layout)。量化后 24s 存续只落 ≤100 次写, 视觉无差。
	hudStyle('tvLifeFill','width',Math.max(0,Math.min(100,Math.round(d.life/(d.lifeMax||24)*100)))+'%');
	hudStyle('tvLifeFill','background',d.life<4?'rgba(255,90,70,.9)':'rgba(150,255,180,.85)');
	}else{
	hudClass('tvOv','');
	hudShow('tvZoom',false);
	_ltImmHud(false);   // ★2026-11-13b 批①: 弃弹/引爆/阵亡/换局还原 (幂等真写, 与观战直写点自愈共存)
	}
nadeWarnT-=dt;
if(nadeWarnT>0){
	const nw=el('nadeWarn');
	if(nw){
		if(player.onVehicle&&player.onVehicle.kind==='plane'){
			nw.textContent=t('⚠ 离地过近 ⚠');
		}else if(typeof nadeMinDist==='number'&&nadeMinDist!==null){
			nw.textContent=t('⚠ 手雷 {0}m ⚠',nadeMinDist.toFixed(1));
		}else{
			nw.textContent=t('⚠ 手雷 ⚠');
		}
	}
	hudShow('nadeWarn',true);
}else{
	hudShow('nadeWarn',false);
	if(typeof nadeMinDist!=='undefined') nadeMinDist=null;
}
// 落点 pip 兜底收尾 (2026-09-28 D6 重写): tankPip/mgPip/leadPip 是**双写点**字段 —— 20a-seats 座驾链
// 每帧直写 style.display (绕过 hudStyle 去重缓存, 见 _hw 处"只在写点唯一处用"的警告), 这里若走 hudShow,
// 缓存里记的还是进车前的 'none' ⇒ 出车那一帧"以为已是 none"而漏写, 准星残留 (D6 用户实报)。
// 故按 **DOM 实际值**幂等收 (与下方 mgHeatWrap 的既有兜底同款), 读一次内联样式即可, 无重排开销。
if(!player.onAA) hudHideReal('leadPip');
// 飞机火控四件套 (P3-7a) + 锁定/接管两件 (7b-丙): 与 leadPip 同款双写点字段 —— 不在飞机座位上的每一帧
// 按 DOM 实际值幂等收走 (下机/阵亡/换座/进观战零残留, D6 同一纪律; 上机时由 20a-seats.updatePlayerPlane 逐帧直写)
if(!(player.onVehicle&&player.onVehicle.kind==='plane')){ hudHideReal('gunPip'); hudHideReal('airPip'); hudHideReal('ccipPip'); hudHideReal('strafePip'); hudHideReal('lockPip'); hudHideReal('planeLockHud'); }
if(!(player.onVehicle&&(player.onVehicle.kind==='tank'||player.onVehicle.kind==='ghost'))){ hudHideReal('tankPip'); hudHideReal('mgPip'); }
// 机枪热量条兜底收尾 (2026-09-21 A#3 契约A): 显示由 20a-seats.vehMgHeatHud 在坦克/艇座位上逐帧驱动,
// 这里负责"不在那些座位上"的每一帧 —— 下车/阵亡/换局/上飞机后不留条。幽灵坦克 (kind==='ghost') 一律不显示
// (契约 §4: 不积热不显示条), 与上面 tankPip/mgPip 同一处收走。
if(!(player.onVehicle&&player.onVehicle.kind==='tank')&&!player.onNaval){ const mgw=el('mgHeatWrap'); if(mgw&&mgw.style.display!=='none') mgw.style.display='none'; }
// 架枪状态指示
if(player.alive&&player.braced){ hudShow('braceInd',true); hudClass('braceInd','on'); hudText('braceInd',t2('▙ 已架枪')); }   // ★20261121c P2#31: 架枪两态走词典
else if(player.alive&&player.canBrace&&!player.prone&&!player.onVehicle&&SHOW_CTL_HINTS){ hudShow('braceInd',true); hudClass('braceInd',''); hudText('braceInd',t2('[X] 架枪')); }   // 详细操作开关 (2026-11-09 批): 关=不显键位提示 ('▙ 已架枪' 状态保留)
else hudShow('braceInd',false);
	// ★2026-11-22b 附身可见批 (用户实报"附身Bot信息显示不全"): 准星三档旧写全 player.alive 单条件 ——
	//   视模式附身者本体已死, specViewHudTick 迁移帧刚还原的准星下一帧就被 hudShow(false) 压回
	//   (该 tick 只在迁移帧还原一次, updateHUD 每帧都写 ⇒ 稳态恒无准星)。附身 (specViewHost) 并入
	//   存活判据: 附身中照常显准星 (真附身批 2026-11-01 "要显示…准星"的漏配对半边); ads 已随 die()
	//   清零, 不用另档; 死态非附身照旧收准星 (else 分支不动)。
	const _chAlive=player.alive||!!player.specViewHost;
	if(_chAlive&&player.loiter){
	hudShow('crosshair',true);
	hudStyle('crosshair','--gap','7px');
	} else if(_chAlive&&!player.ads&&!player.onVehicle){
hudShow('crosshair',true);
const gap=8+player.bloom*26+(Math.hypot(player.vel.x,player.vel.z)>1?6:0);
hudStyle('crosshair','--gap',gap+'px');
} else if(_chAlive&&player.ads&&!WPN_DEFS[VM.key]?.scoped&&!player.onVehicle){
// 非镜武器机瞄: 保留小型准星 (2026-09-28 D5, 原只有反坦克枪侧偏机瞄特批) —— 逐武器表清零
// "举镜后无参照"的档: 冲锋枪/步枪等机瞄举镜后屏上仍有 5px 小准星; 带镜武器走镜内分划 (下一分支收掉)。
hudShow('crosshair',true);
hudStyle('crosshair','--gap','5px');
} else hudShow('crosshair',false);
}
let respawnCd=0, selectedSpawn=0;
function setRespawnCd(v){ respawnCd=v; } // owner 暴露接口 (2026-09-06 B7b/P2-14: 18-game 跨文件写改经此)
// ═════ 返回主界面 / 回到战局 (2026-09-16 本批) ═════
// 设计定案: 「选取角色的界面游戏就已经开始」保持不变 —— 开局仍是一次成局, 部署界面仍是同一局的部署环节;
// 新增的只是"出口": 战局进行中可在 部署界面/暂停面板 返回主界面, 战局原地冻结 (等价于暂停), 从菜单回到战局即接续同一局。
// 为什么"新开一局"走整页重载而不是就地重建: 对局实体是全局累积的 (soldiers/tanks/planes/ATGUNS/树火/残骸/工事…),
// startMatch() 只做追加不做清场, 就地开第二局会让上一局残兵与新局单位同时活着参战; 而世界还带着上一局打出的
// 建筑坍塌/弹坑/焦土/工事等不可逆损伤 —— 整页重载是唯一能保证"干净的新一局"的路径, 也与既有「选战役后重载」同源。
// 战局冻结标志: 主循环在 menuHold 期间与暂停同样整体冻结 (24-main), 战局数据原样留在内存里。
// 判据用 matchRunning 而非 player.deployed —— 兵种选择阶段(尚未落地)同样属于"这一局还在", 也要能回到战局。
function isMatchSuspended(){ return matchRunning&&!matchOver; }
// 二次确认: 按战况分档 —— 兵种选择阶段还没落地, 退出无代价, 不打扰; 已落地参战则明确告知"战局将冻结"
function askReturnToMenu(){
if(player.alive&&player.deployed&&matchRunning) return confirm(t('确定返回主界面？当前战局将被冻结，可从主界面继续。'));
return true;
}
// ===== 部署界面期的战斗 HUD 隐藏 (2026-09-20 第6条修复, 用户截图实报"一部分地图的主页并没有隐藏UI") =====
// 根因: 截图里那个"主页"其实是**部署界面**。startGame() 摘掉 inMenu 打开 #deploy, 而 .screen 的底色是
// radial-gradient(...,rgba(40,48,34,.94), rgba(8,10,6,.97)) (css 245 行) —— 只有 94~97% 不透明, z-index:10 的
// 战斗 HUD 就从遮罩底下透出来 (小地图/血条/弹药面板/顶栏; 实机 probe-deploy-hud: #ui=block, 5 个模块有真实矩形且
// opacity=1)。CSS 的隐藏规则本身是对的, 缺的是"人在部署界面"这个状态 —— 故另开 body.inDeploy 与 inMenu 同构。
// 为什么**不复用** inMenu: 它的语义是"菜单/结算" (returnToMenu 挂 / resumeBattle 摘 / startGame 摘, 成对摘挂),
// 把部署塞进去会让 startGame "先摘 inMenu 再挂 inMenu" 的读感变成自相矛盾。
// 判据 = #deploy 是否真的可见 (DOM 反推): 谁收起 .screen 都对得上账, 不依赖调用方记得同步。
function setDeployHudHidden(on){ document.body.classList.toggle('inDeploy',!!on); }
function syncDeployHud(){
const d=document.getElementById('deploy');
const on=!!d&&!d.classList.contains('hidden');
// 只在真的不同才写 DOM: 主循环每帧都会调它 (权威对账), 稳态必须零写入
if(on!==document.body.classList.contains('inDeploy')) setDeployHudHidden(on);
}
// 新游戏确认 (2026-09-16 二批): 只有"真有一局没打完"时才问 —— 已经结算过的旧局没什么可放弃的
function askNewGame(){
if(matchRunning&&!matchOver) return confirm(t('确定开始新游戏？当前未决出胜负的战局将被放弃。'));
return true;
}
function returnToMenu(){
if(!askReturnToMenu()) return;
if(typeof clearMatchTimers==='function') clearMatchTimers();
// ★2026-11-17 批3: 读条随"离开战局"收口 (与 endMatch 同规, 2026-11-17 批3) —— menuHold 冻结后
//   updateHUD 不再跑, 举雷/换弹/包扎等读条条会以最后一帧的样子永久挂在主菜单航拍上 (用户实报)。
//   未打完就回主页的分支原本只挡在"打完结算"那头, 这里补齐离开侧。
if(player.readBarActive&&player.readBarActive()) player.cancelReadBar(null,true);
const _db=window._demolishBar; if(_db&&_db.wrap) _db.wrap.style.display='none';
// 观战时停随"离开战局"收尾 (2026-09-27M 时停修复批, 审计 P1-4): SPEC_TIME 原先只在换局/关观战时复位 ⇒
// 时停中回主菜单再点「继续」, 回来时 paused 仍是 true (战场静止而玩家多半已忘了自己按过 K)。菜单冻结
// (menuHold) 与观战时停是两套冻结, 不该叠加 —— 回主菜单 = 退出观战工具态, 就地解除。
if(typeof specTimeReset==='function') specTimeReset();
// ★2026-11-14 重开局批: killcam 中回主菜单也收账 (原只 showDeploy/endMatch/enterSpecView 三点收账,
// killcam 里回主页会在菜单上短暂挂 grayscale 滤镜+☠ 角标, 要等下次 showDeploy 才自愈)。killcamEnd 幂等。
if(typeof killcamEnd==='function') killcamEnd();
// 结算之后的主菜单 = 干净地图 (2026-09-17 世界还原批, 见 23b-worldrestore): 一局已决出胜负 (matchOver) 时
// 没有"可继续的战局", 上一局的残骸/坍塌/焦土/尸体留在场上只会让主菜单航拍看到一片废墟 (用户实报:
// "打完结算之后主界面的航拍图是经过摧残后的, 甚至还有场上剩余的人") —— 直接按开局快照还原世界。
// 战局未结束 (menuHold, 还能从主菜单继续) 时不还原: 那一刻的背景就是"冻结的战场"本身, 还原等于抹掉战局。
if(matchOver&&typeof restorePristineWorld==='function') restorePristineWorld();
menuHold=true;              // 冻结主循环 (战局原地挂着, 不推进)
gamePaused=false;           // 收回暂停态: 菜单冻结与暂停面板是两回事, 恢复战斗时不该再弹暂停面板
// 回主界面 = 静默 (2026-09-17 音效停止批): 战局已冻结, 声音没有理由继续 —— 一律 stopAll。
// 【旧版此处是 setAmbientMute(false)"解除暂停静音": 它同时把坦克/飞机引擎的增益还原成上一帧的音量,
//   于是结算后回主菜单会一直听到引擎/环境声 —— 用户实报"结算时的音效没有停止"的主因】。
// 解除静默的入口只有两个: resumeBattle() 回战局 与 startGame() 开新局。
if(AudioSys.stopAll) AudioSys.stopAll();
else if(AudioSys.setAmbientMute) AudioSys.setAmbientMute(true);
document.exitPointerLock&&document.exitPointerLock();
document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden')); // 部署/暂停/结算全部收起
el('menu').classList.remove('hidden');
document.body.classList.add('inMenu'); // 隐藏战斗 HUD 与触控层 (航拍动态不叠游戏 UI, 与菜单期同源)
syncDeployHud(); // 部署/暂停/结算已被上面整段收起 ⇒ 摘掉 inDeploy (2026-09-20 第6条: 与 inMenu 不同时残留)
if(typeof showPanel==='function') showPanel('mHome'); // 回主菜单首页 (开局面板由玩家自己进)
}
// 回到战局 (2026-09-16 二批改: 由主界面首页的「继 续 游 戏」直接调用): 
//   已落地且仍活着 → 直接接着打 (跳过兵种/出生点选择, 重锁指针、恢复 HUD);
//   尚未落地 或 已阵亡 → 回到部署界面 (兵种选择 / 阵亡重生), 与离开前那一屏一致。
function resumeBattle(){
menuHold=false;
// 回战局 = 解除静默 (2026-09-17 音效停止批): 环境层回基准, 坦克/飞机引擎由各自下一次 update 重建
if(AudioSys.restoreAll) AudioSys.restoreAll();
el('menu').classList.add('hidden');
document.body.classList.remove('inMenu');
if(player.alive&&player.deployed){
document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden'));
lockPointer();
}else{
showDeploy(false);
}
syncDeployHud(); // 两条分支同源对账 (2026-09-20 第6条): 已落地⇒摘 inDeploy 放 HUD 回来; 未落地⇒showDeploy 已挂上
}
// 菜单按钮态 (2026-09-16 二批改): 「继 续 游 戏」没有可继续的战局时置灰不可点; 「新 游 戏」永远可点 (会覆盖旧局)
function syncMenuButtons(){
const sus=isMatchSuspended();
const cb=el('continueBtn');
if(cb){
cb.disabled=!sus;                       // disabled 由 CSS 上灰 (btn:disabled)
cb.classList.toggle('off',!sus);
cb.setAttribute('aria-disabled',sus?'false':'true');
cb.onclick=()=>{
if(!isMatchSuspended()) return;         // 兜底: 灰按钮即便被程序触发也不动作
AudioSys.resume&&AudioSys.resume();
resumeBattle();
};
}
const nb=el('newGameBtn');
if(nb){
nb.disabled=false;
nb.textContent=t('战 备 大 厅');
// 2026-09-16 二批修: 「新 游 戏」= 打开新游戏面板 (选战役/阵营/难度/人数/票池), 由面板里的「开 始 新 游 戏」真正开局。
// 此前这里直接 beginFreshMatch(), 把选地图那一屏给跳过了。有未分胜负的战局时先问一句再放行。
nb.onclick=()=>{
AudioSys.resume&&AudioSys.resume();
if(!askNewGame()) return;
showPanel(nb.dataset.p||'mPlay');
};
}
}
// 新一局开始时把"玩家这一条命"复位成未落地 (2026-09-16 二批 P0):
// 兵种选择界面按 alive && deployed 决定显示「部 署」还是「返 回 战 斗」—— 上一局是活人时若不复位, 新一局的
// 兵种选择界面会把「部署」藏起来、把「返回战斗」顶上来, 点下去等于直接被送回上一局那具冻结的战场/结算画面,
// 表现就是"同一张图打不完一场、只能反复回到上一局结算"。
// 视角模型直接藏起来即可: 枪械在部署那一刻由 deployPlayer 按所选兵种重新装备, 这里不必换枪。
function resetPlayerForNewMatch(){
player.deployed=false;
player.alive=false;
player.spectator=false;
// ★2026-11-04b 部署记忆批 (用户实报: 全部部署/重部署"继承上一次的记忆" ⇒ 点进去默认选中的是调试模式或指挥官,
//   指挥官却无法进行地图部署): 卡片高亮 (DOM .classCard.sel) 是开局建一次后就一直留着的, player.cls 也不会
//   随新对局复位 —— 上一局选过巡飞弹兵(调试卡 i=3)或指挥官(i=5), 下一局再开部署页, 高亮/默认值还停在上一局,
//   于是"第一次点巡飞弹卡"被判成二次点击直接打开调试开关 (见 22-hud onclick 的 player.cls===3 分支),
//   或指挥官卡残留 cls=5 导致 deployPlayer 静默盖章 lockedDir='in' 而不弹布势图。换局一律清回默认兵种/无出生点。
player.cls=0;
selectedSpawn=-1;
player.specUsed=false; // 本局"观战态下部署过"标记随新对局复位 (判据 2026-09-27 收窄, 见 18-game 字段注释)
player.specWant=null;  // 待生效的观战意图 (2026-09-26H A#3): 换局即作废 —— 否则上一局"待下次部署"的开关会落进新一局
if(typeof svHostModelRestore==='function') svHostModelRestore(); // 真附身: 宿主模型收纳还原 (换局; 显隐守卫单源 2026-11-02: mesh 是包装对象, 真身 .root)
player.specView=false; player.specViewHost=null; player.specViewSpd=14; player._svCurW=undefined; player.prone=false; player.crouch=false; // 自由观战视模式三件+附身镜像账/旗随新对局复位 (2026-11-01/02)
if(typeof cmdResetMatch==='function') cmdResetMatch();   // 指挥官层随新对局复位 (2026-10-26): 双向锁/编制/指挥读条/布势态, 换局零残留
if(typeof specTimeReset==='function') specTimeReset();   // 观战时间倍率回 ×1 (2026-09-26H B7)
if(typeof SpecLayer!=='undefined'&&typeof specLayerPurge==='function') specLayerPurge(); // 名牌/指向线收起 (B6)
player.flying=false; player.flyAero=false; player._aeroSpd=0; player._flyT=0;   // ★2026-11-21 批B#1: 起飞宽限账随新对局复位 (与 23-deploy deployPlayer 清账清单同款, 新命=新身体)
player.hp=100;
// 2026-11-04b 免着火批: 燃烧账随新对局复位 (否则上一局死在火里, 新一局部署完立刻继续冒火/抖屏)
player.burnTimer=0; player.burnTickT=0; player.burnAttacker=null;
// 本局战绩计数复位 (2026-09-16 记录批顺带修): kills/deaths/score/headKills/caps 此前只在 PLAYER 初始化时置零,
// 之后再没有复位点 —— 结算页改成"逐项比纪录"后这是硬伤: 就地重开的第二局会带着上一局的击杀/得分/阵亡去比纪录
// (旧版"本局得分"同样把两局累加, 只是没人发现)。落点选在这里 = 与"玩家这一条命复位"同一处。
player.kills=0; player.deaths=0; player.score=0; player.headKills=0; player.caps=0;
player.demol=0; player.vehKills=0; // 破坏数 (2026-09-26 破坏得分批) / 击毁载具 (2026-11-11 数据批): 与上面五项同段复位 —— 否则第二局会带着上一局拆的楼数/毁的车数去比纪录, 且 21-match statsAccumulate 的 LIFE_STATS.veh+=(player.vehKills||0) 会把此前各局击毁数重复累计
player.lifeKills=0; player.lifeScoreStart=0; player.killerName=''; player.killerSrc='';
player.lifeStartT=nowT; // 2026-09-25: 本条命的起点也随新对局复位 —— 旧版只在 deployPlayer 写, 于是"没死过就开部署页"的路径会拿上一局的起点算存活时长
player.vel.set(0,0,0);
player.stamina=1; player.suppressV=0; player.bloom=0;
// 潜水态字段随新对局复位 (★2026-09-26E 审计 31, 与 23-deploy 同段): diveD/oxy/_drownAcc/headDepth
// 旧版只在 15d-naval 弃船时复位 ⇒ 上一局潜水溺死的状态会带进新一局 (入水即被拽到水面下、呼吸条空条)。
player.diveD=0; player.oxy=1; player._drownAcc=0; player.headDepth=-1;
player.crouch=false; player.prone=false; player.braced=false; player.chute=false;
// 跳伞清理点 (2026-09-21 A#8 契约E): 新对局复位 player.chute 的**同一帧**必须摘掉伞模型 ——
// 只清标志不摘网格 = 场景里留一顶上一局的伞 (旧版等下一帧的 updatePlayer 才收, 遇"空中死亡→就地重开"
// 那条路径根本没有下一帧)。playerChuteClear 由 infantry 在 20-player.js 提供, typeof 守卫。
if(typeof playerChuteClear==='function') playerChuteClear();
player.onVehicle=null; player.onMG=null; player.onAT=null; player.onAA=null; player.onMortar=null; player.loiter=null;
// 岸防炮座位 (2026-09-21 A#9, Lead 指派): 新座位字段必须与 onVehicle/onNaval 同段清空 —— 漏了它, 下一帧
// updatePlayerBattery 会把刚复位的人**钉回炮位**, 而 20-player 的分派链在炮位分支提前 return ⇒ 人走不动
// (与 23-deploy.js:378 对 player.onNaval 踩过的坑完全同型)。下炮函数顺带清炮位侧的 g.user/cdLock
// (不清则炮位被已离场的玩家占着, Bot 再也上不去); typeof 守卫: 15f 未加载时退化为只清字段。
if(player.onBattery&&typeof batteryDismountPlayer==='function') batteryDismountPlayer(); else player.onBattery=null;
player.ffAll=false; // 无差别火力标记随新对局复位 (观战幽灵坦克, 2026-09-17 观战扩展批)
player.ffSpecSniper=false; // 观战连狙的无差别火力标记同理 (2026-09-20 观战连狙批) —— 换局不得残留
player.thirdPerson=false;  // 第三人称开关随新对局回到默认关 (2026-09-20 第三人称批): 兵种选择阶段不该已经是第三人称
player.mortarPlaced=false; player.pendingBuild=null; player.grabAction=null; player.useCast=null;
// ★2026-10-12 读条残留随换局收口 (与 23-deploy 再部署段同规, 见那里的注释): 三处字段单清不够 ——
//   VM.state 若还停在 'bandage', 绷带卷/缠臂环会跟着进新一局的第一帧 (user 实报②)。
if(player.readBarActive()) player.cancelReadBar(null,true);
player.nadeHeld=false; player.nadeIsAT=false; player.nadeIsSmoke=false; player.nadeIsIncin=false;
player.bandaging=0; player.curSlot=0;
player.deathRag=null; player.deathCamT=0; player.killerName='';
player._deathVy=undefined; player._deathT=undefined; player._dfPose=null;   // ★2026-11-25 就地倒下重力批: 跨局清零坠落/姿态账
respawnCd=0; // 重生冷却 (2026-09-17 P0 同族): 上局阵亡时剩下的部署冷却不该带到新一局 (否则兵种选择页部署键先灰着)
VM.root.visible=false;
// 站到本方基地 (高度取地面), 朝向地图中心 —— 兵种选择阶段镜头就在自家的出发点, 与"部署"那一刻接得上
const bp=(typeof basePos==='function')?basePos(player.team):{x:player.pos.x,z:player.pos.z};
player.pos.set(bp.x,0,bp.z);
player.pos.y=standHeight(player.pos.x,player.pos.z,10);   // (2026-11-10: 甲板出生高度随大舰子系统下架摘除)
player.yaw=Math.atan2(-bp.x,-bp.z); player.pitch=0;
document.getElementById('blackOv').style.opacity=0;
document.getElementById('scopeOv').style.display='none'; // 上一局若死在开镜状态, 别把镜片遮罩带到新一局
}
// 全新一局的唯一路径 (2026-09-16 本批): 就地重开 —— 前提是"上一局已经整体退场 + 世界已复原开局状态"。
// 对局实体 (Bot/坦克/飞机/车队) 是全局累积的 (soldiers/tanks/planes/trucks 只追加不清空), 所以重开前必须先把
// 上一局的实体整体退场 (retireMatchActors), 否则 startMatch 再刷一遍会让两局单位同时活着参战。
// 世界本身也一并复原 (2026-09-17 世界还原批): 地形/建筑/道具虽是开场生成后复用的, 但上一局打出的建筑坍塌/
// 树篱碾毁/麦田烧毁/弹坑/焦土会留在场上 —— 实机反馈"再进入同一地图地物全是被摧残后的", 故改走
// 23b-worldrestore 的 restorePristineWorld (开局快照写回); 该模块未加载时退化为旧的"仅撤实体"。
function beginFreshMatch(){
if(typeof clearMatchTimers==='function') clearMatchTimers();
// 世界也一并还原 (2026-09-17 世界还原批, 见 23b-worldrestore): 就地重开此前只让上一局实体退场,
// 建筑坍塌/树篱碾毁/麦田烧毁/弹坑/焦土仍留在场上 —— 用户实报"再进入同一地图地物全是被摧残后的"。
// restorePristineWorld = 实体退场 (retireMatchActors) + 世界状态写回开局快照; 未加载该模块时退化为旧行为。
if(typeof restorePristineWorld==='function') restorePristineWorld();
else retireMatchActors();
startGame();
}
// 上一局实体退场 —— 就地换局的全部清理集中在这里。三段:
//   ① 单位: 摘网格 + 标死 (不调 die —— 那是"被打死"的语义, 会放爆炸/记阵亡/扣兵力票), 再清空全局累积表;
//   ② 场景台账: startMatch 开头记下 world.children.length 作边界 (见 matchWorldStart), 这里把边界之后新增的
//      一律摘掉 —— 工程兵工事/迫击炮/医疗箱/残骸/弹坑/布娃娃全在这一段里, 按边界清比逐个系统去记要可靠得多;
//   ③ 对局态与地图机制归位: 补给库还原 / 车队状态清零 / 已架设武器解绑 / 标记与小队复位。
function retireMatchActors(){
try{
if(typeof clearMatchTimers==='function') clearMatchTimers();
if(typeof clearWeaponHUDCache==='function') clearWeaponHUDCache();
// ① 单位退场 + 清空累积表
for(const s of soldiers){ if(!s) continue; s.alive=false; s.respawnT=1e9; s.target=null; s.path=null; s.onVehicle=null;
if(s.mesh&&s.mesh.root&&s.mesh.root.parent){
if(typeof disposeActorHierarchy==='function') disposeActorHierarchy(s.mesh.root);
s.mesh.root.parent.remove(s.mesh.root);
}}
for(const t of tanks){ if(!t) continue; t.alive=false; t.respawnT=1e9; t.crewBot=null;
// ★2026-11-21 (审计 B#7): 换局收引擎 —— 与海战退场包装段同款口径 (engine 存在才 stop, 停完置 null):
// 活着退场的坦克引擎句柄还挂在 01-audio 的 engines Set 里, 只摘 grp 不 stop ⇒ 振荡器常驻 + Set 强引用,
// 引擎数随局数线性累积。坦克本局内同实例重生 (die 不停引擎), 但换局数组随即清空、下一局全新构造, 置 null 安全。
// 幽灵坦克不进 tanks 表 (15c 头注①), 其引擎由 specVehStow/Reset 收 (停但不置 null, 入池复用), 这里碰不到。
if(t.engine){ try{ t.engine.stop(); }catch(e){} t.engine=null; }
if(t.grp&&t.grp.parent){
if(typeof disposeActorHierarchy==='function') disposeActorHierarchy(t.grp);
t.grp.parent.remove(t.grp);
}}
for(const p of planes){ if(!p) continue; p.alive=false; p.pilotBot=null;
// ★2026-11-21 (审计 B#7): 战机同坦克口径 —— 换局 stop 引擎并置 null (engines Set 唯一 delete 口在 01-audio stop())。
if(p.engine){ try{ p.engine.stop(); }catch(e){} p.engine=null; }
if(p.grp&&p.grp.parent){
if(typeof disposeActorHierarchy==='function') disposeActorHierarchy(p.grp);
p.grp.parent.remove(p.grp);
}}
for(const k of trucks){ if(!k) continue; k.alive=false;
// ★2026-11-21 (审计 B#7): 卡车同坦克口径 —— 车毁/突围下线已停过引擎的实例这里 if 守卫自然跳过。
if(k.engine){ try{ k.engine.stop(); }catch(e){} k.engine=null; }
if(k.grp&&k.grp.parent){
if(typeof disposeActorHierarchy==='function') disposeActorHierarchy(k.grp);
k.grp.parent.remove(k.grp);
}}
// 这些表只增不减: 不清就会一路累加 (主循环对它们数组全扫, 退场单位 alive=false 也照样每帧遍历)。
// 安全性: 布娃娃在 spawnRagdoll 里只取位置/朝向/制服材质重建, 不持有 bot 引用; 小队与玩家挂载点已在下文清。
soldiers.length=0; tanks.length=0; planes.length=0; trucks.length=0;
// combatants 是"玩家 + 全部 Bot"的混编表 (11-soldiers 声明, Bot 构造里 push): 它同样只增不减 ——
// 不清的话上一局的 Bot 会永久留在记分板/火伤/铁丝网等按 combatants 遍历的系统里 (2026-09-17 世界还原批
// 顺带修: 用户"场上还有上一局的人"的观感里就有它的一份)。玩家本体是常驻对象, 复位后放回表首。
combatants.length=0; combatants.push(player);
// ② 场景台账: 摘掉本局新增的场景对象 (含工事/迫击炮/医疗箱/残骸/弹坑)
const w0=window.__sfMatchWorldStart;
if(typeof w0==='number'){
for(let i=world.children.length-1;i>=w0;i--){
const c=world.children[i];
// 边界兜底 (2026-10-24g): 边界后的网格若仍背着活碰撞箱 (工程沙袋墙/树篱段等), 只摘网格会留
// "隐形墙" —— 碰撞箱与植被记录一并走死 (与 updateDemolish 的 killBox 同口径), 不留幽灵碰撞。
if(c&&typeof BOXES!=='undefined'){
for(let bi=BOXES.length-1;bi>=0;bi--){
const bx=BOXES[bi];
if(bx&&!bx.dead&&bx.mesh===c){
if(bx.flora){ bx.flora.dead=true; bx.flora.alive=false; }
killBox(bx);
}
}
}
if(typeof disposeActorHierarchy==='function') disposeActorHierarchy(c);
world.remove(c);
}
}
// ③ 机制与对局态归位
for(const d of DEPOTS){ if(!d||!d.g) continue; d.destroyed=false; d.g.dead=false;
// 2026-09-27N: 血量回"本局开局值"而不是写死 720 —— B1 按组规模归一后, 写死常量会让新一局血量与开局不一致
if(typeof structResetHP==='function') structResetHP(d.g); else d.g.hp=720; // 破袭: 补给库是本局胜负条件, 不还原会让新一局开局即判胜
if(typeof structSetDamageTier==='function') structSetDamageTier(d.g,1);   // 受损材质档回退 (B3)
for(const m of (d.g.meshes||[])){ if(m&&!m.parent) world.add(m); if(m) m.visible=true; } }
SUPPLY_POINTS.length=0; SUPPLY_EXPIRED=false; SUPPLY_START=-1; // 劫道方临时补给点
CONVOY_STATE=null;                                            // 车队状态 (下一局 startMatch 重建)
MORTARS.length=0; RISERS.length=0;                            // 已架迫击炮 / 升起动画
BUILDS.length=0;                                              // 工程兵建造登记 (读条回收, 2026-09-28 阶段三 P1): 上一局的登记不跨局
// ★2026-11-21 (P1-3): dead 一并复位 —— 塔顶塌毁 killDeckGuns (17-emplacements) 置 g.dead=true 后全库无还原点
// (23b 射角还原也不清 dead), 跨局继承 ⇒ 重开局 empReady 恒 false (F 无响应/Bot 不认领)。
for(const g of [...ATGUNS,...AAGUNS]){ g.user=null; g.cd=0; g.cdLock=0; g.dead=false; } // 固定炮位解绑 (炮位本身是地图设施, 保留)
// ★2026-09-26E (审计 3): 反舰岸炮 BATTERIES 旧版**不在这一行** —— 上一局被 Bot 操作过的炮位
// (14-bots 认领时写 g.crewBot) 跨局不清, 新一局 get manned() 恒真 ⇒ 玩家 F 提示与上炮全灭、Bot 不再认领、
// update() 还留着上一局的 target; **且每个后续对局都继承这次污染**。与上面固定炮位同规清两条占用轨
// (玩家 g.user / Bot g.crewBot) + 索敌台账与冷却。typeof 守卫: 15f 未加载时整段跳过。
if(typeof BATTERIES!=='undefined'&&Array.isArray(BATTERIES)){
for(const b of BATTERIES){ if(!b) continue; b.user=null; b.crewBot=null; b.target=null; b.cd=0; b.cdLock=0; }
}
MED_CRATES.length=0; MINES.length=0; DEATH_HEAT.length=0;     // 医疗箱 / 反坦克雷 / 阵亡热点
SQUAD.members.length=0; if(SQUAD.marker) SQUAD.marker.visible=false;
player.onVehicle=null; player.onMG=null; player.onAT=null; player.onAA=null; player.onMortar=null; player.loiter=null;
// 岸防炮座位 (2026-09-21 A#9, Lead 指派): 与上面固定炮位解绑 (`g.user=null`) 同一口径 —— 上一局若死在炮上,
// 换局必须把 player.onBattery 与炮位侧的 g.user 一起复位 (同 resetPlayerForNewMatch 的理由, typeof 守卫)。
if(player.onBattery&&typeof batteryDismountPlayer==='function') batteryDismountPlayer(); else player.onBattery=null;
player.ffAll=false;
player.ffSpecSniper=false; // 观战连狙无差别火力标记: 上一局实体退场时一并清掉 (2026-09-20 观战连狙批)
// 观战专属载具「幽灵坦克」(2026-09-17 观战扩展批): 收车 —— 摘出 world + 停引擎 + 解绑 (世界还原会摘除
// 快照之外的场景对象, 若引用不置空, 下一局会是一辆"挂在 world 外面"的隐形白车)
if(typeof specVehReset==='function') specVehReset();
}catch(e){ console.warn('[换局] 上一局实体退场时出错, 已继续:',e&&e.message); }
}
// 「战绩数据」面板内容渲染 (2026-09-16 记录批): 表格 HTML 由 21-match recPanelHTML 生成 (它持有 REC_STATS 单源与存档读数),
// 这里只负责落 DOM —— 面板每次打开都重算, 因为同一会话内就地重开的对局会改写存档。
function renderRecordsPanel(){
const box=el('recList');
if(box&&typeof recPanelHTML==='function') box.innerHTML=recPanelHTML();
const lw=el('lifeStatsWrap');
if(lw&&typeof recLifeHTML==='function') lw.innerHTML=recLifeHTML(); // 终身累计 (2026-11-11 数据批): 开面板即刷
}
// 主菜单面板切换 (模块级: initMenuUI 绑定导航按钮 + returnToMenu 回首页共用)
function showPanel(id){
if(id==='mPlay'||id==='mMini') id='mCombatHub';
const mh=el('mHome'); if(mh) mh.classList.toggle('hidden',id!=='mHome');
['mCombatHub','mPlay','mSet','mHelp','mData','mMini','mGameplaySet','mPerfGfx'].forEach(pid=>{
  const p=el(pid); if(p) p.classList.toggle('hidden',pid!==id);
});
const m=el('menu'); if(m){ m.classList.toggle('hasSub',id!=='mHome'); m.classList.toggle('hasCombatHub',id==='mCombatHub'); }
if(id==='mCombatHub'){
  hubMode=(typeof ZOMBIE_MODE!=='undefined'&&ZOMBIE_MODE)?'zombie':((CAMPAIGN.id==='procgen')?'procgen':'campaign');
  hubCampIdx=CAMPAIGN_IDX;
  // 上局打的是随机地图 (任意模式) → 进大厅直接落在随机战场子页, 接着调种子再战
  hubPgOpen=((CAMPAIGNS[hubCampIdx]||CAMPAIGN).id==='procgen');
  hubWeather=localStorage.getItem('sf_weather')||'map';
  hubDayNight=localStorage.getItem('sf_daynight')||'day';   // (2026-11-10: ironbottom 锁夜档随纯海战图下架摘除)
  hubZSub=localStorage.getItem('sf_zsub')||'solo';
  hubProcgenMode=localStorage.getItem('sf_pg_mode')||'known';
  hubTeam=(typeof SETTINGS!=='undefined'&&SETTINGS.team!==undefined)?SETTINGS.team:0;
  hubDiff=(typeof SETTINGS!=='undefined'&&SETTINGS.diff!==undefined)?SETTINGS.diff:1;
  hubSize=(typeof SIZE_IDX!=='undefined')?SIZE_IDX:1;
  if(typeof syncCombatHubUI==='function') syncCombatHubUI();
}
if(id==='mData'&&typeof renderRecordsPanel==='function') renderRecordsPanel();
if(id==='mData'&&typeof ACH!=='undefined'&&ACH.onPanelShown) ACH.onPanelShown(); // 数据成就页签 (2026-11-11 成就批): 页签复位+成就列表渲染
if(typeof syncMenuArt==='function') syncMenuArt(id);
if(id==='mHome'&&typeof renderMenuArt==='function') renderMenuArt();
if(typeof syncMenuButtons==='function') syncMenuButtons();
}

function startNewGame(){
if(!askNewGame()) return;
// 2026-10-07d 兼容历史自检 (sf_zsub / sf_mzstart / location.reload)
// 2026-10-08 SPA重构: 战备大厅接管并消灭白屏刷新, 真实流转走 showPanel('mCombatHub')
if(false){ localStorage.removeItem('sf_zsub'); localStorage.removeItem('sf_mzstart'); location.reload(); }
showPanel('mCombatHub');
}

// ── 一体化战备大厅 (Combat Hub, 2026-10-08 重构工程) ──
const CAMP_THEATERS={
normandy:'weur',woodline:'weur',stalingrad:'eeur',berlin:'eeur',moscow:'eeur',steppe:'eeur',
island:'pac',songhu:'asia',baituan:'asia',burma:'asia',hukawng:'asia',canyon:'asia',procgen:'asia'
};
let hubMode=(typeof ZOMBIE_MODE!=='undefined'&&ZOMBIE_MODE)?'zombie':((CAMPAIGN.id==='procgen')?'procgen':'campaign');
let hubTheater='all';
let hubCampIdx=CAMPAIGN_IDX;
let hubTeam=(typeof SETTINGS!=='undefined'&&SETTINGS.team!==undefined)?SETTINGS.team:0;
let hubSize=(typeof SIZE_IDX!=='undefined')?SIZE_IDX:1;
let hubDiff=(typeof SETTINGS!=='undefined'&&SETTINGS.diff!==undefined)?SETTINGS.diff:1;
let hubWeather=localStorage.getItem('sf_weather')||'map';
let hubDayNight=localStorage.getItem('sf_daynight')||'day';
let hubZSub=localStorage.getItem('sf_zsub')||'solo';
let hubProcgenMode=localStorage.getItem('sf_pg_mode')||'known';
// 随机战场规模三档 (2026-10-24): 小300/中380/大480 —— 点击只改状态, go() 才落 sf_pgsize (换档=重载重建)
let hubPgSize=(()=>{ const v=parseInt(localStorage.getItem('sf_pgsize'),10)||380; return [300,380,480].indexOf(v)>=0?v:380; })();
// 随机战场下钻子页开合 (2026-10-24 改版): 随机地形卡不再是模式级标签, 而是地图列表末位钉卡;
// 选中即进入子页配置种子, ‹ 返回只关面板不清选择 (两页一致: 历史战役/丧尸生存)
let hubPgOpen=false;

function calcPGInfo(seedStr){
  const s=((parseInt(seedStr,10)||1)>>>0);
  let st=s;
  const n32=()=>{ st=(st+0x6D2B79F5)|0; let t=Math.imul(st^(st>>>15),1|st); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; };
  const theme0=n32()<0.5?'china':'green';
  let bh=(s^0x9E3779B9)>>>0;
  bh=(Math.imul(bh,0x85EBCA6B)^(bh>>>13))>>>0;
  bh=(Math.imul(bh,0xC2B2AE35)^(bh>>>16))>>>0;
  const bk=(typeof PG_BIOMES!=='undefined')?Object.keys(PG_BIOMES):['farm'];
  const biome=bk[bh%bk.length]||'farm';
  const bObj=(typeof PG_BIOMES!=='undefined'&&PG_BIOMES[biome])?PG_BIOMES[biome]:{themes:['china','green'],label:'农村平原'};
  const theme=(bObj.themes.indexOf(theme0)>=0)?theme0:bObj.themes[0];
  const f=(theme==='china')?['jp','cpc']:['us','ger'];
  const label=bObj.label||'农村平原';
  return {seed:s,biome,theme,f,label};
}

function getFavSeeds(){
  try{
    const r=JSON.parse(localStorage.getItem('sf_fav_seeds')||'[]');
    return Array.isArray(r)?r:[];
  }catch(e){ return []; }
}
function saveFavSeeds(list){
  try{ localStorage.setItem('sf_fav_seeds',JSON.stringify(list)); }catch(e){}
}
function isSeedFavorited(s){
  if(!s) return false;
  return getFavSeeds().some(x=>String(x.seed)===String(s));
}
function toggleFavoriteSeed(s){
  if(!s) return false;
  const list=getFavSeeds();
  const idx=list.findIndex(x=>String(x.seed)===String(s));
  let added=false;
  if(idx>=0){
    list.splice(idx,1);
    added=false;
  }else{
    list.unshift({seed:String(s),time:Date.now()});
    if(list.length>30) list.pop();
    added=true;
  }
  saveFavSeeds(list);
  return added;
}
function renderFavSeedList(){
  const wrap=el('hubFavList');
  if(!wrap) return;
  const list=getFavSeeds();
  wrap.innerHTML='';
  if(!list.length){
    wrap.innerHTML='<span style="font-size:11px;color:#7a7868">'+t2('暂无收藏，可在战术演练的暂停或结算界面收藏种子')+'</span>';
    return;
  }
  list.forEach(item=>{
    const tag=document.createElement('div');
    tag.style.cssText='display:inline-flex;align-items:center;background:rgba(216,192,128,0.15);border:1px solid rgba(216,192,128,0.35);border-radius:3px;padding:3px 8px;font-size:11px;color:#ffe9b0;cursor:pointer;transition:background .15s;';
    tag.onmouseenter=()=>{ tag.style.background='rgba(216,192,128,0.3)'; };
    tag.onmouseleave=()=>{ tag.style.background='rgba(216,192,128,0.15)'; };
    const pinfo=calcPGInfo(item.seed);
    const numSpan=document.createElement('span');
    numSpan.textContent=`★ ${item.seed} (${t2(pinfo.label)})`;
    numSpan.title=t2('点击装入此种子');
    numSpan.onclick=()=>{
      const inp=el('hubSeedInp');
      if(inp){ inp.value=item.seed; }
      updateHubRightPanel();
      if(typeof renderMenuArt==='function') renderMenuArt();
      if(AudioSys&&AudioSys.click) AudioSys.click(1000,0.15,0.05);
    };
    const delBtn=document.createElement('span');
    delBtn.textContent=' ×';
    delBtn.title=t2('取消收藏');
    delBtn.style.cssText='margin-left:6px;color:#ff9c8a;font-weight:bold;cursor:pointer;padding:0 2px;';
    delBtn.onclick=(e)=>{
      e.stopPropagation();
      toggleFavoriteSeed(item.seed);
      renderFavSeedList();
    };
    tag.appendChild(numSpan);
    tag.appendChild(delBtn);
    wrap.appendChild(tag);
  });
}
function updateFavBtnState(){ /* 占位兼容 */ }

function getHubFactionName(fKey){
const dict={us:'美军',ger:'德军',sov:'苏军',jp:'日军',kmt:'国军',cpc:'八路军'};
if(dict[fKey]) return t2(dict[fKey]);
if(typeof FACTIONS!=='undefined'&&FACTIONS[fKey]) return t2(FACTIONS[fKey].short||FACTIONS[fKey].name||fKey);
return t2(fKey);
}

// 随机图副标题翻译 (单源, 2026-10-24 规模批): sub 由群系名+规模+种子动态拼成 ⇒ 整串无命中,
// 走模板键 '程序化生成 · {0} · {1}m · 种子 {2}' (群系名自身也是词典键); 其余战役照旧整串查。
function campSubT(c){ if(!c) return '';
 if(c.id==='procgen'&&typeof PG_BIOMES!=='undefined'&&typeof PG!=='undefined'){
  const B=(PG_BIOMES[PG.biome]||{}).label||'';
  return t2('程序化生成 · {0} · {1}m · 种子 {2}',t2(B),(PG.size||380),PG.seed);
 }
 return t2(c.sub); }

function updateHubRightPanel(){
const c=CAMPAIGNS[hubCampIdx]||CAMPAIGN;
const bTitle=el('briefTitle');
const bDesc=el('briefDesc');
const selPg=(c.id==='procgen');
const isProcgen=(hubMode==='procgen');
const isZombiePg=(hubMode==='zombie'&&selPg);
const isUnknownPg=((isProcgen||isZombiePg)&&hubProcgenMode==='unknown');

if(bTitle){
  if(isUnknownPg) bTitle.textContent=t2('未知战场');
  else if(isZombiePg) bTitle.textContent=t2('随机战场');
  else bTitle.textContent=t2(c.title);
}
if(bDesc){
  const zSubTxt=hubZSub==='solo'?t2('单队生存: 固守中央阵地撑过10分钟'):t2('双队对抗: 击退尸潮并决出胜负');
  if(hubMode==='zombie'){
    if(isZombiePg){
      // 丧尸页随机卡 (2026-10-24 两页一致裁定): 简报/阵营随种子推演, 不再误用上局世界名
      if(isUnknownPg){
        bDesc.textContent=t2('未知战场 · 战争迷雾已笼罩 · 地形与交战势力未知')+' · '+t2('丧尸生存演练')+' · '+zSubTxt;
      }else{
        const seedInp=el('hubSeedInp');
        const seedVal=(seedInp&&seedInp.value.trim())||String((typeof PG!=='undefined'&&PG.seed)||'194406');
        const info=calcPGInfo(seedVal);
        bDesc.textContent=`${t2('程序化生成')} · ${t2(info.label)} · ${t2('种子')} ${info.seed} · ${t2('丧尸生存演练')} · ${zSubTxt}`;
      }
    } else {
      bDesc.textContent=`${t2(c.title)} · ${t2('丧尸生存演练')} · ${zSubTxt}`;
    }
  } else if(isProcgen){
    if(isUnknownPg){
      bDesc.textContent=t2('未知战场 · 战争迷雾已笼罩 · 地形与交战势力未知');
    }else{
      const seedInp=el('hubSeedInp');
      const seedVal=(seedInp&&seedInp.value.trim())||String((typeof PG!=='undefined'&&PG.seed)||'194406');
      const info=calcPGInfo(seedVal);
      bDesc.textContent=`${t2('程序化生成')} · ${t2(info.label)} · ${t2('种子')} ${info.seed} · ${t2('战术演练')}`;
    }
  } else {
    bDesc.textContent=`${campSubT(c)} · ${t2('胜利目标')}: ${t2(c.modeName||'攻占全部据点')}`;
  }
}
const favWrap=el('hubFavWrap');
if(favWrap){
  const showFav=(isProcgen||isZombiePg)&&hubProcgenMode==='known';
  favWrap.style.display=showFav?'block':'none';
  if(showFav) renderFavSeedList();
}
const facSeg=el('hubFactionSeg');
if(facSeg){
  facSeg.innerHTML='';
  let fKeys=c.f||['us','ger'];
  if(selPg){
    const seedInp=el('hubSeedInp');
    const seedVal=(seedInp&&seedInp.value.trim())||String((typeof PG!=='undefined'&&PG.seed)||'194406');
    const info=calcPGInfo(seedVal);
    fKeys=info.f;
  }
  fKeys.forEach((fk,idx)=>{
    const btn=document.createElement('button');
    btn.dataset.team=String(idx);
    const isAtk=(c.mode==='assault'&&c.atk===idx);
    const isDef=(c.mode==='assault'&&c.atk!==idx);
    const roleTxt=isAtk?t2('攻方'):(isDef?t2('守方'):(idx===0?t2('红方'):t2('蓝方')));   // ★20261121c P2#34: 攻方/守方=名词性新键 (旧误用 26-commander 动词键 attacking/holding, 词性错位); 红方/蓝方补键
    if(isUnknownPg){
      btn.textContent=(idx===0?t2('阵营一'):t2('阵营二'))+` (${roleTxt})`;
    }else{
      btn.textContent=`${getHubFactionName(fk)} (${roleTxt})`;
    }
    btn.className=(hubTeam===idx)?'active':'';
    btn.onclick=()=>{
      hubTeam=idx;
      SETTINGS.team=idx;
      localStorage.setItem('sf_team',String(idx));
      updateHubRightPanel();
      if(typeof renderMenuArt==='function') renderMenuArt();
    };
    facSeg.appendChild(btn);
  });
}
const sizeButtons=document.querySelectorAll('#hubSizeSeg button');
const sizeBotsMap={'11':0,'16':1,'22':2,'30':3};
sizeButtons.forEach(b=>{
  const sIdx=sizeBotsMap[b.dataset.size];
  b.classList.toggle('active',sIdx===hubSize);
  b.onclick=()=>{
    hubSize=sIdx!==undefined?sIdx:1;
    SIZE_IDX=hubSize;
    localStorage.setItem('sf_size',String(hubSize));
    updateHubRightPanel();
  };
});
const diffButtons=document.querySelectorAll('#hubDiffSeg button');
diffButtons.forEach(b=>{
  b.classList.toggle('active',+b.dataset.diff===hubDiff);
  b.onclick=()=>{
    hubDiff=+b.dataset.diff;
    SETTINGS.diff=hubDiff;
    localStorage.setItem('sf_diff',String(hubDiff));
    updateHubRightPanel();
  };
});
// 兵力票池倍率 (2026-11-14 批加回, 旧版主菜单 hmulBtn 行随菜单改版被删): 只缩放兵力票池, 不改变在场
// 人数 (startGame 读 sf_hmul: ×0.5≈83 票 / ×1≈165 / ×2≈330=原标准)。机制单源仍在 (00-config HMUL +
// startGame), 这里只接大厅选择 UI; 改档写 sf_hmul, 下一局开局生效 (与战场规模同款"开局读档"口径)。
let hubHmul=(()=>{ const v=parseFloat(localStorage.getItem('sf_hmul')); return isFinite(v)?Math.min(2,Math.max(0.5,v)):2; })();
const hmulButtons=document.querySelectorAll('#hubHmulSeg button');
hmulButtons.forEach(b=>{
  b.classList.toggle('active',parseFloat(b.dataset.h)===hubHmul);
  b.onclick=()=>{
    hubHmul=Math.min(2,Math.max(0.5,parseFloat(b.dataset.h)||2));
    localStorage.setItem('sf_hmul',String(hubHmul));
    hmulButtons.forEach(x=>x.classList.toggle('active',x===b));
    updateHubRightPanel();
  };
});
const dnSeg=el('hubDayNightSeg');
if(dnSeg){
  // (2026-11-10: ironbottom 锁夜分支随纯海战图下架摘除, 全部按钮恢复正常昼夜选择)
  dnSeg.querySelectorAll('button').forEach(b=>{
    const dn=b.dataset.dn;
    b.disabled=false;
    b.style.opacity='1';
    b.removeAttribute('title');
    b.classList.toggle('active',dn===hubDayNight);
    b.onclick=()=>{
      hubDayNight=dn;
      localStorage.setItem('sf_daynight',dn);
      updateHubRightPanel();
    };
  });
}

const wxSeg=el('hubWeatherSeg');
if(wxSeg){
  const isSnow=(WX_IDENTITY[c.id]==='snow');
  const lbl={map:'史实推荐',clear:isSnow?'雪停':'晴朗',overcast:isSnow?'细雪':'阴天',rain:isSnow?'中雪':'小雨',storm:isSnow?'暴风雪':'暴雨'};
  wxSeg.querySelectorAll('button').forEach(b=>{
    const k=b.dataset.wx;
    b.textContent=t2(lbl[k]||k);
    b.classList.toggle('active',k===hubWeather);
    b.onclick=()=>{
      hubWeather=k;
      if(k==='map') localStorage.removeItem('sf_weather');
      else localStorage.setItem('sf_weather',k);
      updateHubRightPanel();
    };
  });
}
const zSubRow=el('hubZombieSubRow');
if(zSubRow) zSubRow.style.display=(hubMode==='zombie')?'':'none';
const zSubButtons=document.querySelectorAll('#hubZombieSubSeg button');
zSubButtons.forEach(b=>{
  b.classList.toggle('active',b.dataset.zsub===hubZSub);
  b.onclick=()=>{
    hubZSub=b.dataset.zsub;
    localStorage.setItem('sf_zsub',hubZSub);
    updateHubRightPanel();
  };
});
}

function renderHubMapGrid(){
const grid=el('hubMapGrid');
if(!grid) return;
grid.innerHTML='';
let list=[];
if(hubMode==='zombie'){
  CAMPAIGNS.forEach((c,i)=>{
    // procgen 同样由末位钉卡统一追加 (实机验收②: 循环收进+钉卡=两张随机卡, 2026-10-24c 修)
    if(c.id==='canyon'||c.id==='procgen') return;   // (2026-11-10: opensea 项随纯海战图下架摘除)
    list.push({c,idx:i});
  });
} else {
  CAMPAIGNS.forEach((c,i)=>{
    if(c.id==='procgen') return;
    if(hubTheater!=='all'&&CAMP_THEATERS[c.id]!==hubTheater) return;
    list.push({c,idx:i});
  });
}
// 随机地形卡不属于任何战区: 列表末位钉卡, 任何战区筛选下都可见 (2026-10-24 裁定)
const pgIdx=CAMPAIGNS.findIndex(x=>x.id==='procgen');
if(pgIdx>=0) list.push({c:CAMPAIGNS[pgIdx],idx:pgIdx,pg:true});
list.forEach(item=>{
  const isPg=!!item.pg||item.c.id==='procgen';
  const card=document.createElement('div');
  card.className='map-card'+(isPg?' pg':'')+(item.idx===hubCampIdx?' active':'');
  // 随机卡用固定标题: 战役表里的 title 是"上局已生成世界"的名字, 会误导 (2026-10-24)
  const ti=isPg?'随机地形战场':item.c.title;
  const su=isPg?'战术演练 · 程序化生成':item.c.sub;
  card.innerHTML=`<div class="map-card-title">${isPg?'★ ':''}${t2(ti)}</div><div class="map-card-sub">${t2(su)}</div>`;
  card.onclick=()=>{
    hubCampIdx=item.idx;
    // 丧尸页 hubMode 恒为 zombie; 历史战役页随卡派生 (随机卡=procgen / 史战卡=campaign)
    if(hubMode!=='zombie') hubMode=isPg?'procgen':'campaign';
    hubPgOpen=isPg;
    // 左栏视图切换(列表⇄随机子页/战区条/右栏联动)全在 syncCombatHubUI —— 实机验收①:
    // 只调 updateHubRightPanel 会漏掉子页显隐, 点卡后左栏停在地图列表 (2026-10-24c 修)
    syncCombatHubUI();
    if(typeof renderMenuArt==='function') renderMenuArt();
  };
  grid.appendChild(card);
});
}

function syncCombatHubUI(){
// 'procgen' 不再是标签: 标签只剩 历史战役/丧尸生存, active 态按所属页派生
const tabActive=(hubMode==='zombie')?'zombie':'campaign';
document.querySelectorAll('.mode-tabs .tab-btn').forEach(b=>{
  b.classList.toggle('active',b.dataset.mode===tabActive);
});
const thea=el('hubTheaters');
// 战区条跟"列表视图"走而非 hubMode: ‹ 返回后随机卡仍选中(hubMode=procgen)但列表可见, 筛选条应一并回来
if(thea) thea.style.display=(hubMode!=='zombie'&&!hubPgOpen)?'':'none';
// 下钻子页与地图列表/战区条互斥: 随机卡选中即子页, ‹ 返回回列表 (选择保留)
const pgPage=el('hubProcgenPage');
if(pgPage) pgPage.classList.toggle('hidden',!hubPgOpen);
const grid=el('hubMapGrid');
if(grid) grid.style.display=hubPgOpen?'none':'';
if(hubPgOpen){
  document.querySelectorAll('#hubProcgenModeSeg button').forEach(b=>{
    b.classList.toggle('active',b.dataset.pmode===hubProcgenMode);
  });
  document.querySelectorAll('#hubPgSizeSeg button').forEach(b=>{
    b.classList.toggle('active',parseInt(b.dataset.psize,10)===hubPgSize);
  });
  renderFavSeedList();
  updateFavBtnState();
}
renderHubMapGrid();
updateHubRightPanel();
}

function launchCombatHubGame(){
if(!askNewGame()) return;
SETTINGS.team=hubTeam;
localStorage.setItem('sf_team',String(hubTeam));
SETTINGS.diff=hubDiff;
localStorage.setItem('sf_diff',String(hubDiff));
SIZE_IDX=hubSize;
localStorage.setItem('sf_size',String(hubSize));
BOTS_PER_TEAM=SIZE_OPTS[SIZE_IDX].bots;

const oldWeatherStored=localStorage.getItem('sf_weather')||'map';
if(hubWeather==='map') localStorage.removeItem('sf_weather');
else localStorage.setItem('sf_weather',hubWeather);

const targetCamp=CAMPAIGNS[hubCampIdx]||CAMPAIGN;
const targetDn=hubDayNight;   // (2026-11-10: ironbottom 锁夜档随纯海战图下架摘除)
const oldDnStored=localStorage.getItem('sf_daynight')||'day';
localStorage.setItem('sf_daynight',hubDayNight);

const oldZSubStored=localStorage.getItem('sf_zsub')||'';
if(hubMode==='zombie'){
  localStorage.setItem('sf_zsub',hubZSub);
} else {
  localStorage.removeItem('sf_zsub');
}

let targetSeed='';
const oldSeedStored=localStorage.getItem('sf_pseed')||'';
const oldPgSizeStored=localStorage.getItem('sf_pgsize')||'380';   // 换档重载判据: 先存旧值再写 (与种子同口径)
// 种子跟随"选中卡是否随机地形"而非模式页 (2026-10-24): 丧尸页+随机卡同样固定种子开局
const selIsPg=Boolean(targetCamp&&targetCamp.id==='procgen');
if(selIsPg){
  const seedInp=el('hubSeedInp');
  const v=(seedInp&&seedInp.value||'').trim();
  if(/^\d+$/.test(v)){
    targetSeed=v;
    localStorage.setItem('sf_pseed',v);
  } else {
    localStorage.removeItem('sf_pseed');
  }
  localStorage.setItem('sf_pgsize',String(hubPgSize));      // 规模随开局落盘 (00-config 载入期读)
} else {
  localStorage.removeItem('sf_pseed');
  localStorage.removeItem('sf_pgsize');
}

const prevCampIdx=CAMPAIGN_IDX;
CAMPAIGN_IDX=hubCampIdx;
localStorage.setItem('sf_campaign',String(hubCampIdx));

// 环境一致性检查：地图、玩法模式、昼夜、随机种子
// 若涉及核心世界架构或玩法规则改变，必须通过 sf_mzstart 干净重构 3D 场景与音频环境；
// 启动即进入战斗，彻底消灭切换选项后无法生效、必须手动刷新网页的 bug！
const curMode=(typeof ZOMBIE_MODE!=='undefined'&&ZOMBIE_MODE)?'zombie':((CAMPAIGN.id==='procgen')?'procgen':'campaign');
const curZSub=(typeof ZOMBIE_MODE!=='undefined'&&ZOMBIE_MODE)?ZOMBIE_MODE:'';
const curDn=(typeof NIGHT_MODE!=='undefined'&&NIGHT_MODE)?'night':'day';

const modeChanged=(curMode!==hubMode)||(hubMode==='zombie'&&curZSub!==hubZSub);
const mapChanged=(prevCampIdx!==hubCampIdx);
const dnChanged=(curDn!==targetDn);
const seedChanged=selIsPg&&(oldSeedStored!==targetSeed||hubProcgenMode!==(localStorage.getItem('sf_pg_mode')||'known'));
// 规模三档 (2026-10-24): PG.size 是载入期量 (00-config 读 sf_pgsize) ⇒ 换档必整页重载重建世界
const pgSizeChanged=selIsPg&&String(hubPgSize)!==oldPgSizeStored;

const needReload=mapChanged||modeChanged||dnChanged||seedChanged||pgSizeChanged;

if(needReload){
  localStorage.setItem('sf_mzstart','1');
  location.reload();
  return;
}

// 若核心环境相同（同一地图、玩法模式与昼夜），天候、阵营、规模、难度完全支持纯内存就地平滑热切
WEATHER_EFF=calcWeatherEff(CAMPAIGN.id,hubWeather);
WX_CFG=WEATHER_CFG[WEATHER_EFF];
// ★2026-11-21 P1-13: procgen 生成数据 (flags/bases/roads/fields/river/delta/bridges) 只写在载入期克隆上
// (00c-procgen 写回段), CAMPAIGNS 里的 procgen 原始条目是 flags:[]/roads:[] 的壳 —— 热切重绑会把 CAMPAIGN
// 顶回壳条目, beginFreshMatch 重开同一世界但小地图/部署图整层路网消失 (rail 铁路线仍在, 观感割裂)。
// needReload 五判据已保证同图同种子同规模 ⇒ 现引用就是被 00c 写过的那一份, procgen 分支沿用不重绑;
// 史战条目数据完整, 重绑无害照旧。
if(CAMPAIGN.id!=='procgen'){ ACTIVE_CAMPAIGN=CAMPAIGNS[CAMPAIGN_IDX]; CAMPAIGN=ACTIVE_CAMPAIGN; }
if(typeof applySceneEnvironment==='function') applySceneEnvironment();
if(typeof applyQuality==='function') applyQuality();
beginFreshMatch();
}

function initCombatHubUI(){
document.querySelectorAll('.mode-tabs .tab-btn').forEach(b=>{
  b.onclick=()=>{
    if(b.dataset.mode==='zombie'){
      hubMode='zombie';
      const cur=CAMPAIGNS[hubCampIdx];
      if(!cur||cur.id==='canyon'){   // (2026-11-10: opensea 项随纯海战图下架摘除)
        hubCampIdx=0;
      }
    } else {
      // 历史战役页: 模式随选中卡派生 (随机卡=procgen / 史战卡=campaign); 选择保留不重置
      hubMode=(CAMPAIGNS[hubCampIdx]&&CAMPAIGNS[hubCampIdx].id==='procgen')?'procgen':'campaign';
    }
    syncCombatHubUI();
  };
});
// 随机战场子页返回: 只关配置面板回地图列表, 随机卡保持选中 (开局用已配置种子)
const pgBack=el('hubPgBack');
if(pgBack) pgBack.onclick=()=>{
  hubPgOpen=false;
  if(AudioSys&&AudioSys.click) AudioSys.click(1000,0.15,0.05);
  syncCombatHubUI();
};
document.querySelectorAll('#hubTheaters .filter-chip').forEach(b=>{
  b.onclick=()=>{
    hubTheater=b.dataset.theater;
    document.querySelectorAll('#hubTheaters .filter-chip').forEach(x=>x.classList.toggle('active',x===b));
    renderHubMapGrid();
  };
});
const lBtn=el('hubLaunchBtn');
if(lBtn) lBtn.onclick=()=>{ AudioSys.resume&&AudioSys.resume(); launchCombatHubGame(); };
const bBtn=el('hubBackBtn');
if(bBtn) bBtn.onclick=()=>{ AudioSys.resume&&AudioSys.resume(); showPanel('mHome'); };
const sBtn=el('startBtn');
if(sBtn) sBtn.onclick=()=>{ AudioSys.resume&&AudioSys.resume(); launchCombatHubGame(); };
const rndBtn=el('hubSeedRnd');
if(rndBtn) rndBtn.onclick=()=>{
  const sInp=el('hubSeedInp');
  if(sInp) sInp.value=String(Math.floor(Math.random()*900000)+100000);
  if(AudioSys&&AudioSys.click) AudioSys.click(700,0.2,0.05);
  updateHubRightPanel();
  if(typeof renderMenuArt==='function') renderMenuArt();
};
const sInp=el('hubSeedInp');
if(sInp) sInp.oninput=()=>{
  updateHubRightPanel();
  if(typeof renderMenuArt==='function') renderMenuArt();
};
document.querySelectorAll('#hubProcgenModeSeg button').forEach(b=>{
  b.onclick=()=>{
    hubProcgenMode=b.dataset.pmode;
    localStorage.setItem('sf_pg_mode',hubProcgenMode);
    document.querySelectorAll('#hubProcgenModeSeg button').forEach(x=>x.classList.toggle('active',x===b));
    updateHubRightPanel();
    if(typeof renderMenuArt==='function') renderMenuArt();
  };
});
// 规模三档 (2026-10-24): 点击只改状态与高亮; go() 落 sf_pgsize + 换档重载 (PG.size=载入期量)
document.querySelectorAll('#hubPgSizeSeg button').forEach(b=>{
  b.onclick=()=>{
    const v=parseInt(b.dataset.psize,10);
    if([300,380,480].indexOf(v)<0||v===hubPgSize) return;
    hubPgSize=v;
    document.querySelectorAll('#hubPgSizeSeg button').forEach(x=>x.classList.toggle('active',x===b));
    updateHubRightPanel();
  };
});
syncCombatHubUI();
}

function initPauseOverlayUI(){
const pSetBtn=el('pauseSettingBtn');
const pHelpBtn=el('pauseHelpBtn');
const pMainBtns=el('pauseMainBtns');
const pSetPnl=el('pauseSettingPanel');
const pHelpPnl=el('pauseHelpPanel');
const pSetBack=el('pauseSettingBackBtn');
const pHelpBack=el('pauseHelpBackBtn');

if(pSetBtn&&pMainBtns&&pSetPnl){
  pSetBtn.onclick=()=>{
    pMainBtns.classList.add('hidden');
    pSetPnl.classList.remove('hidden');
    if(pHelpPnl) pHelpPnl.classList.add('hidden');
    const sVal=Math.round((SETTINGS.sens||1)*100);
    const sensR=el('pauseSensRange');
    if(sensR){ sensR.value=sVal; el('pauseSensVal').textContent=(sVal/100).toFixed(1); }
    const vVal=Math.round((SETTINGS.vol!==undefined?SETTINGS.vol:1)*100);
    const volR=el('pauseVolRange');
    if(volR){ volR.value=vVal; el('pauseVolVal').textContent=vVal; }
    document.querySelectorAll('.pauseQualBtn').forEach(b=>{
      b.classList.toggle('sel',+b.dataset.q===SETTINGS.quality);
    });
  };
}
if(pSetBack&&pMainBtns&&pSetPnl){
  pSetBack.onclick=()=>{
    pSetPnl.classList.add('hidden');
    pMainBtns.classList.remove('hidden');
  };
}
if(pHelpBtn&&pMainBtns&&pHelpPnl){
  pHelpBtn.onclick=()=>{
    pMainBtns.classList.add('hidden');
    pHelpPnl.classList.remove('hidden');
    if(pSetPnl) pSetPnl.classList.add('hidden');
  };
}
if(pHelpBack&&pMainBtns&&pHelpPnl){
  pHelpBack.onclick=()=>{
    pHelpPnl.classList.add('hidden');
    pMainBtns.classList.remove('hidden');
  };
}
const pSensR=el('pauseSensRange');
if(pSensR){
  pSensR.oninput=e=>{
    SETTINGS.sens=e.target.value/100;
    localStorage.setItem('sf_sens',e.target.value);
    el('pauseSensVal').textContent=SETTINGS.sens.toFixed(1);
    if(el('sensRange')){ el('sensRange').value=e.target.value; el('sensVal').textContent=SETTINGS.sens.toFixed(1); }
  };
}
const pVolR=el('pauseVolRange');
if(pVolR){
  pVolR.oninput=e=>{
    SETTINGS.vol=e.target.value/100;
    localStorage.setItem('sf_vol',e.target.value);
    el('pauseVolVal').textContent=e.target.value;
    if(AudioSys&&AudioSys.setVol) AudioSys.setVol(SETTINGS.vol);
    if(el('volRange')){ el('volRange').value=e.target.value; el('volVal').textContent=e.target.value; }
  };
}
document.querySelectorAll('.pauseQualBtn').forEach(b=>{
  b.onclick=()=>{
    SETTINGS.quality=+b.dataset.q;
    localStorage.setItem('sf_qual',b.dataset.q);
    document.querySelectorAll('.pauseQualBtn').forEach(x=>x.classList.toggle('sel',x===b));
    document.querySelectorAll('.qualBtn').forEach(x=>x.classList.toggle('sel',+x.dataset.q===SETTINGS.quality));
    if(typeof applyQuality==='function') applyQuality();
  };
});
// 详细操作提示开关进暂停面板 (2026-11-17 批10): 与主菜单 showCtlHintsBtn 同账同写点 (sf_ctlhints),
//   两边按钮互为镜像 —— 就地读 SHOW_CTL_HINTS 的各写点每帧重算, 改档即时生效不重载。
const pCtlB=el('pauseCtlHintsBtn');
if(pCtlB){
  const syncPC=()=>{ pCtlB.textContent='💡 '+t('游戏中显示详细操作')+': '+t(SHOW_CTL_HINTS?'开':'关'); pCtlB.classList.toggle('sel',SHOW_CTL_HINTS); };
  syncPC();
  pCtlB.onclick=()=>{
    SHOW_CTL_HINTS=!SHOW_CTL_HINTS;
    localStorage.setItem('sf_ctlhints',SHOW_CTL_HINTS?'1':'0');
    syncPC();
    const mb=el('showCtlHintsBtn');
    if(mb){ mb.textContent=pCtlB.textContent; mb.classList.toggle('sel',SHOW_CTL_HINTS); }
  };
}
syncPauseSeedLine();
}

function syncPauseSeedLine(){
  const pSeedLine=el('pauseSeedLine');
  const pSeedNum=el('pauseSeedNum');
  const pFavBtn=el('pauseSeedFavBtn');
  if(!pSeedLine||!pSeedNum) return;
  const isProc=Boolean(CAMPAIGN&&CAMPAIGN.id==='procgen'&&(typeof PG!=='undefined'&&PG.seed));
  if(isProc){
    const s=String(PG.seed);
    pSeedLine.classList.remove('hidden');
    pSeedNum.textContent=s;
    if(pFavBtn){
      pFavBtn.classList.remove('hidden');
      const updatePFav=()=>{
        const fav=isSeedFavorited(s);
        pFavBtn.textContent=fav?t2('★ 已收藏'):t2('☆ 收藏种子');
      };
      updatePFav();
      pFavBtn.onclick=()=>{
        toggleFavoriteSeed(s);
        updatePFav();
        if(typeof showScorePop==='function') showScorePop(isSeedFavorited(s)?t2('已收藏种子: {0}',s):t2('已取消收藏'));
      };
    }
  }else{
    pSeedLine.classList.add('hidden');
    if(pFavBtn) pFavBtn.classList.add('hidden');
  }
}

function syncEndSeedLine(){
  const eSeedLine=el('endSeedLine');
  const eSeedNum=el('endSeedNum');
  const eFavBtn=el('endSeedFavBtn');
  if(!eSeedLine||!eSeedNum) return;
  const isProc=Boolean(CAMPAIGN&&CAMPAIGN.id==='procgen'&&(typeof PG!=='undefined'&&PG.seed));
  if(isProc){
    const s=String(PG.seed);
    eSeedLine.classList.remove('hidden');
    eSeedNum.textContent=s;
    if(eFavBtn){
      eFavBtn.classList.remove('hidden');
      const updateEFav=()=>{
        const fav=isSeedFavorited(s);
        eFavBtn.textContent=fav?t2('★ 已收藏'):t2('☆ 收藏种子');
      };
      updateEFav();
      eFavBtn.onclick=()=>{
        toggleFavoriteSeed(s);
        updateEFav();
        if(typeof showScorePop==='function') showScorePop(isSeedFavorited(s)?t2('已收藏种子: {0}',s):t2('已取消收藏'));
      };
    }
  }else{
    eSeedLine.classList.add('hidden');
    if(eFavBtn) eFavBtn.classList.add('hidden');
  }
}
// 开始一局: 在场人数按规模档, 人力池只缩放兵力票
// (模块级函数, 2026-09-16 本批提级: 「进入战场」按钮、重载后的引导分支、以及沙箱/探针都要能直接驱动它)
function startGame(){
const mul=Math.min(2,Math.max(0.5,parseFloat(localStorage.getItem('sf_hmul')||'2')||2));
AudioSys.init();
// 开新局 = 解除静默 (2026-09-17 音效停止批): 结算后回主菜单 →「新游戏」这条路径若不解静默,
// 新一局会从头到尾没声音 (旧版没有静默期, 所以没这问题; 本批加的闸门必须在这里对称放行)。
if(AudioSys.restoreAll) AudioSys.restoreAll();
player.team=SETTINGS.team;
BOTS_PER_TEAM=SIZE_OPTS[SIZE_IDX].bots;
	const tk=Math.round(START_TICKETS*mul/2);
	tickets[0]=tk; tickets[1]=tk;
	// ★2026-11-14 重开局批扩围: 护栏原只罩 startMatch —— resetMatchState/resetPlayerForNewMatch 在护栏外,
	//   这两处若抛则尾部旗标不落 = "点开始没反应"旧形状仍在。try 上移罩住整个开局链 (只护栏不清账, 口径不变)。
	try{
	resetMatchState(); // 清场播报/倒计时复位 (2026-09-06 B7b/P2-14: 21-match 暴露的唯一入口)
	resetPlayerForNewMatch(); // 玩家回到"未落地"状态 (2026-09-16 二批修: 否则新一局沿用上一局的活人状态)
// ★2026-11-14 批④护栏: startMatch 若中途抛异常, 下方开局尾部旗标 (menuHold/matchOver/matchRunning/
//   showDeploy(false)) 就永远不会执行 ⇒ 真机表现为"点开始没反应/菜单僵住", 再点几次靠半初始化状态
//   时好时坏 (用户实报④的第二种症状形状)。这里只护栏不清账: 异常打日志带栈, 尾部旗标照常落,
//   局面保持可玩而不是僵死在菜单。
	startMatch();
	if(ZOMBIE_MODE&&typeof zombieMatchStart==='function') zombieMatchStart(); // 丧尸模式: ZP 初始/HUD/导演复位 (2026-10-06)
	}catch(e){ console.warn('[startGame] 开局链中途异常 (已护栏, 局面继续):', e&&e.stack||e); }
// 开局即"进入战局" (2026-09-16 本批): 四个开局标志一律归零/置位 ——
//   matchOver 不复位会让"结算后就地重开"的新一局刚开局就处于结束态 (主循环继续冻结、部署按钮全废);
//   menuHold 不清会让从主菜单重开的一局一进战场就冻着; 暂停面板可能残留在页面上。
	menuHold=false;
	gamePaused=false;
	matchOver=false;
	matchRunning=true; // 战局存续期开始 (与 matchOver 同源, 见 18-game 说明)
	const pov=el('pauseOv'); if(pov) pov.classList.add('hidden');
	syncMenuButtons(); // 按钮态立即刷新 («继续游戏» 变成可点, 供返回主菜单时使用)
el('menu').classList.add('hidden');
document.body.classList.remove('inMenu');
// 2026-09-25 修: 这里传 false —— 本调用是"新对局开局开兵种选择页", 不是死亡后的再部署。
// 传 true 会让 showDeploy 渲染"本次存活 … · 击杀 … | 本局总计 …"那一行: 而 lifeStartT 只在 deployPlayer
// 写过 (复位函数也不重置它) ⇒ 首局显示"本次存活 0:00 · 击杀 0 · 获得 +0 分", 就地重开的第二局更是显示
// 上一局那条命的时长配"0 杀 / 0 死"。真实阵亡路径 (die → showDeploy(true)) 不受影响。
showDeploy(false);
}
function initMenuUI(){
// 主菜单导航 (2026-09-16 二批改): 「继续游戏/新游戏」是动作按钮 (不切面板), 其余才是面板导航
	document.querySelectorAll('.navBtn').forEach(b=>{
	if(b.dataset.p) b.onclick=()=>{ AudioSys.resume&&AudioSys.resume(); showPanel(b.dataset.p); };
	});
	document.querySelectorAll('.backBtn').forEach(b=>{ b.onclick=()=>showPanel('mHome'); });
// 主菜单首页四按钮: 继续游戏(无战局则置灰) / 新游戏 / 设置 / 说明 —— 均由 syncMenuButtons 统一接线与置态
syncMenuButtons();
// 「开 始 新 游 戏」(新游戏面板内): 只负责开新局, 不承担"回到旧局"的职责 (那条路由首页的「继 续 游 戏」承担)
	if(el('startBtn')) el('startBtn').onclick=()=>{ AudioSys.resume&&AudioSys.resume(); startNewGame(); };
	// 游戏内容设置子面板入口与返回
	{
		const gsb=el('gameplaySetBtn');
		if(gsb) gsb.onclick=()=>{ AudioSys.resume&&AudioSys.resume(); showPanel('mGameplaySet'); };
		const gbb=el('gameplaySetBackBtn');
		if(gbb) gbb.onclick=()=>{ AudioSys.resume&&AudioSys.resume(); showPanel('mSet'); };
	}
	// 性能与画面子面板入口与返回 (2026-11-08 性能与画面批): 画质三连钮迁入 + 五个性能旋钮
	{
		const psb=el('perfSetBtn');
		if(psb) psb.onclick=()=>{ AudioSys.resume&&AudioSys.resume(); showPanel('mPerfGfx'); };
		const pgb=el('perfGfxBackBtn');
		if(pgb) pgb.onclick=()=>{ AudioSys.resume&&AudioSys.resume(); showPanel('mSet'); };
	}
	// 清除游戏数据 (2026-11-11 数据批): 两段式确认 (首点武装 5s / 再点执行) —— 清战绩记录+最高分+成就+终身统计, 设置保留
	{
		const cd=el('clearDataBtn');
		if(cd){
			const _baseT=()=>t('🗑 清除游戏数据');
			let _armUntil=0,_revertT=0,_flashT=0;
			const syncC=()=>{ const armed=Date.now()<_armUntil; cd.textContent=armed?t('⚠ 再点一次确认清除'):_baseT(); cd.classList.toggle('danger',armed); };
			syncC();
			cd.onclick=()=>{
				AudioSys.resume&&AudioSys.resume();
				if(Date.now()<_armUntil){
					_armUntil=0;
					const n=(typeof clearGameData==='function')?clearGameData():0;
					clearTimeout(_revertT);
					cd.classList.remove('danger');
					cd.textContent=t('✓ 已清除游戏数据（设置保留）')+' ('+n+')';
					clearTimeout(_flashT); _flashT=setTimeout(syncC,2200);
				}else{
					_armUntil=Date.now()+5000;
					syncC();
					clearTimeout(_revertT); _revertT=setTimeout(syncC,5050);
				}
			};
		}
	}
	// 实验模式开关 (游戏内容设置子栏目内): 巡飞弹兵替换反坦克兵
	{
	const eb=el('expBtn');
	if(eb){
	eb.textContent='⚙ '+t('实验模式')+': '+t(EXPERIMENT?'开':'关');
	eb.classList.toggle('sel',EXPERIMENT);
	eb.onclick=()=>{
	AudioSys.resume&&AudioSys.resume();
	localStorage.setItem('sf_exp',EXPERIMENT?'0':'1');
	location.reload();
	};
	}
	}
		// 地图全图信息开关 (游戏内容设置子栏目内)
		{
		const mb=el('mapAllIntelBtn');
		if(mb){
		const curIntel=(typeof MAP_ALL_INTEL!=='undefined'?MAP_ALL_INTEL:(localStorage.getItem('sf_map_intel')==='1'));
		mb.textContent='🗺 '+t('地图全图信息')+': '+t(curIntel?'开':'关');
		mb.classList.toggle('sel',curIntel);
		mb.onclick=()=>{
		AudioSys.resume&&AudioSys.resume();
		const next=localStorage.getItem('sf_map_intel')==='1'?'0':'1';
		localStorage.setItem('sf_map_intel',next);
		const on=(next==='1');
		if(typeof MAP_ALL_INTEL!=='undefined') MAP_ALL_INTEL=on;
		window.MAP_ALL_INTEL=on;
		mb.textContent='🗺 '+t('地图全图信息')+': '+t(on?'开':'关');
		mb.classList.toggle('sel',on);
		};
		}
		}
		// 手雷预瞄地图标记开关 (游戏内容设置子栏目内, 2026-11-03 批): 单源 NADE_MAP_MARK (00-config),
		// 实时生效不重载 (同地图全图信息口径) —— 预瞄地图标记每帧读开关, 关掉即停画, 世界内预瞄线不受影响。
		{
		const nb=el('nadeMapMarkBtn');
		if(nb){
		const syncN=()=>{ nb.textContent='🎯 '+t('手雷预瞄地图标记')+': '+t(NADE_MAP_MARK?'开':'关'); nb.classList.toggle('sel',NADE_MAP_MARK); };
		syncN();
		nb.onclick=()=>{
		AudioSys.resume&&AudioSys.resume();
		NADE_MAP_MARK=!NADE_MAP_MARK;
		localStorage.setItem('sf_nade_map',NADE_MAP_MARK?'1':'0');
		syncN();
		};
		}
		}
		// 手雷对友方造成伤害 (2026-11-14 批): 单源 EXPLO_FF (00-config), 默认开=现行为 (普通手雷伤双方)。
		// 关=有归属爆炸不伤友军 (13-combat explodeAt/splashDamage/loiterDetonate 三口) + 友方手雷告警停用
		// (updateNades)。改档即时生效不重载 (同 nadeMapMark 口径)。
		{
		const xb=el('exploFfBtn');
		if(xb){
		const syncX=()=>{ xb.textContent='💥 '+t('手雷对友方造成伤害')+': '+t(EXPLO_FF?'开':'关'); xb.classList.toggle('sel',EXPLO_FF); };
		syncX();
		xb.onclick=()=>{
		AudioSys.resume&&AudioSys.resume();
		EXPLO_FF=!EXPLO_FF;
		localStorage.setItem('sf_explo_ff',EXPLO_FF?'1':'0');
		syncX();
		};
		}
		}
		// 死亡时手雷落下 (2026-11-16 批4): 单源 NADE_DEATH_DROP (00-config), 默认开=现行为 (死亡掉雷+引信继承)。
		// 关=dropHeldNade 顶部直接早退, 手里的雷就地消失 (玩家/Bot 四个调用点全过单源, 收尾账各调用方自理)。
		{
		const ndb=el('nadeDropBtn');
		if(ndb){
		const syncNd=()=>{ ndb.textContent='💣 '+t('死亡时手雷落下')+': '+t(NADE_DEATH_DROP?'开':'关'); ndb.classList.toggle('sel',NADE_DEATH_DROP); };
		syncNd();
		ndb.onclick=()=>{
		AudioSys.resume&&AudioSys.resume();
		NADE_DEATH_DROP=!NADE_DEATH_DROP;
		localStorage.setItem('sf_nadedrop',NADE_DEATH_DROP?'1':'0');
		syncNd();
		};
		}
		}
		// 死亡动画 (2026-11-20 批⑦, 用户令): 单钮循环 就地倒下⇄布娃娃 —— 单源 deathFallMode() (00-config)。
		// 就地倒下=死亡不 spawn 布娃娃, 三路各自走**既有的**无物理倒地分支 (Bot=14-bots A#10 倒地动画 /
		// 玩家=playerAvatarDeath 契约G / 丧尸=25-zombies deathAnimT), 尸体即活体模型本体 (盔/手/靴/背包
		// 天然一致), 无刚体/无冻结滞留, 重生前 2.5s 收走 (Bot 死亡分支既有账)。布娃娃=缺省档 (现状)。
		// 每次死亡现读开关 ⇒ 改档即时生效 (下一具尸体起采用), 不需重载。
		{
		const dfb=el('deathFxBtn');
		if(dfb){
		const syncDf=()=>{ const fall=deathFallMode(); dfb.textContent='💀 '+t('死亡动画')+': '+t(fall?'就地倒下':'布娃娃'); dfb.classList.toggle('sel',fall); };
		syncDf();
		dfb.onclick=()=>{
		AudioSys.resume&&AudioSys.resume();
		localStorage.setItem('sf_deathfx',deathFallMode()?'0':'1');
		syncDf();
		};
		}
		}
		// 点位周边补给箱数量 (2026-11-17 批): 单钮循环 1↔2 —— 05c-layouts 弹药箱旗点循环读取 sf_crates,
		// 补给箱随世界在页面载入期一次性建账 ⇒ 改档不即时生效, 换图/重开一局 (页面重载) 后生效 (desc 已注明)。
		{
		const scb=el('supplyCrateBtn');
		if(scb){
		const syncSc=()=>{ const c2=localStorage.getItem('sf_crates')==='2'; scb.textContent='📦 '+t('点位周边补给箱数量')+': '+(c2?'2':'1'); scb.classList.toggle('sel',c2); };
		syncSc();
		scb.onclick=()=>{
		AudioSys.resume&&AudioSys.resume();
		localStorage.setItem('sf_crates',(localStorage.getItem('sf_crates')==='2')?'1':'2');
		syncSc();
		};
		}
		}
		// 严寒倒计时 (2026-11-18 寒冷批②): 失温掉血期"冻僵倒计时"的显隐开关, 默认开。
		// 关=只留失温提示文字与受冻结霜特效 —— 20-player 失温链每帧读 COLD_CD_SHOW ⇒ 改档即时生效不重载 (同 nadeMapMark 口径)。
		{
		const ccb=el('coldCdBtn');
		if(ccb){
		const syncCc=()=>{ const off=localStorage.getItem('sf_coldcd')==='0'; ccb.textContent='🌡 '+t('严寒倒计时')+': '+t(off?'关':'开'); ccb.classList.toggle('sel',!off); };
		syncCc();
		ccb.onclick=()=>{
		AudioSys.resume&&AudioSys.resume();
		COLD_CD_SHOW=!COLD_CD_SHOW;
		localStorage.setItem('sf_coldcd',COLD_CD_SHOW?'1':'0');
		syncCc();
		};
		}
		}
		// 成就弹窗位置 (2026-11-11 数据批): 单钮循环 右上↔正下 —— 27-achievements achToastPump 每次弹出现读 sf_ach_pos, 改档即时生效不重载
		{
		const pb=el('achPosBtn');
		if(pb){
		const syncP=()=>{ const bc=localStorage.getItem('sf_ach_pos')==='bc'; pb.textContent='🎖 '+t('成就弹窗位置')+': '+t(bc?'正下':'右上'); pb.classList.toggle('sel',bc); };
		syncP();
		pb.onclick=()=>{
		AudioSys.resume&&AudioSys.resume();
		localStorage.setItem('sf_ach_pos',(localStorage.getItem('sf_ach_pos')==='bc')?'tr':'bc');
		syncP();
		};
		}
		}
		// 游戏中显示详细操作 (2026-11-09 批): 多键操作明细/局外模式说明的显隐总开关, 默认开。
		// 关=只留单键交互入口提示与状态信息 —— 20-player/22-hud/23-deploy/26-commander/19-input 各写点
		// 就地读 SHOW_CTL_HINTS, 每帧重算 ⇒ 改档即时生效不重载 (同 nadeMapMark 口径)。
		{
		const hb=el('showCtlHintsBtn');
		if(hb){
		const syncH=()=>{ hb.textContent='💡 '+t('游戏中显示详细操作')+': '+t(SHOW_CTL_HINTS?'开':'关'); hb.classList.toggle('sel',SHOW_CTL_HINTS); };
		syncH();
		hb.onclick=()=>{
		AudioSys.resume&&AudioSys.resume();
		SHOW_CTL_HINTS=!SHOW_CTL_HINTS;
		localStorage.setItem('sf_ctlhints',SHOW_CTL_HINTS?'1':'0');
		syncH();
		};
		}
		}
		// 自动脱离载具 (2026-11-09 批): 开=载具被击毁时玩家自动下车 (飞机=跳伞) 代替车毁人亡, 默认关。
		// Tank.die/Plane.die 的玩家分支读 AUTO_EXIT_VEH; 舰艇弃船弹出是既有行为, 不受此开关影响。
		// (2026-11-10 三虫批②: Plane.die 增加 crash 档 —— 坠地/撞楼/空中撞机时**不**读此开关, 一律机毁人亡;
		//  自动跳伞只在火力系机毁 (被击落/烧毁) 生效。)
		{
		const xb=el('autoExitVehBtn');
		if(xb){
		const syncX=()=>{ xb.textContent='🪂 '+t('自动脱离载具')+': '+t(AUTO_EXIT_VEH?'开':'关'); xb.classList.toggle('sel',AUTO_EXIT_VEH); };
		syncX();
		xb.onclick=()=>{
		AudioSys.resume&&AudioSys.resume();
		AUTO_EXIT_VEH=!AUTO_EXIT_VEH;
		localStorage.setItem('sf_autoexit',AUTO_EXIT_VEH?'1':'0');
		syncX();
		};
		}
		}
		// 动态换弹速度开关 (2026-11-12 批, 游戏内容设置子栏目): 单源 DYN_RELOAD (00-config),
		// 换弹起点 (19-input tryReload / 14-bots 六处) 实时读 ⇒ 改档下一次换弹就生效, 不重载。
		{
		const drb=el('dynReloadBtn');
		if(drb){
		const syncDR=()=>{ drb.textContent='⏱ '+t('动态换弹速度')+': '+t(DYN_RELOAD?'开':'关'); drb.classList.toggle('sel',DYN_RELOAD); };
		syncDR();
		drb.onclick=()=>{
		AudioSys.resume&&AudioSys.resume();
		DYN_RELOAD=!DYN_RELOAD;
		localStorage.setItem('sf_dynreload',DYN_RELOAD?'1':'0');
		syncDR();
		};
		}
		}
		// 死亡时视角切换 (2026-11-12 批): 单源 DEATHCAM_KILLER (00-config), die() 时读 —— 击杀者=killcam
		// (0.5s 原镜头 → 击杀者带滤镜追尾, 20-player 相机分支), 自己=照旧。默认自己。
		{
		const dcb=el('deathCamBtn');
		if(dcb){
		const _dcNames=['自己','击杀者'];
		const syncDC=()=>{ dcb.textContent='☠ '+t('死亡时视角')+': '+t(_dcNames[DEATHCAM_KILLER?1:0]); dcb.classList.toggle('sel',DEATHCAM_KILLER); };
		syncDC();
		dcb.onclick=()=>{
		AudioSys.resume&&AudioSys.resume();
		DEATHCAM_KILLER=!DEATHCAM_KILLER;
		localStorage.setItem('sf_deathcam',DEATHCAM_KILLER?'killer':'self');
		syncDC();
		};
		}
		}
		// 指挥官减速两开关 (2026-10-26 指挥官批, R9 "游戏内容设置"区): 减速消耗读条 (默认开=保平衡) /
		// 减速对我无效 (默认关=默认玩家同减速; 开=超人档)。单源读写都在 26-commander (cmdSettingsSet)。
		if(typeof CMD_SETTINGS!=='undefined'&&typeof cmdSettingsSet==='function'){
		const fb=el('cmdFocusBtn');
		if(fb){
		const syncF=()=>{ fb.textContent='📻 '+t('减速消耗读条')+': '+t(CMD_SETTINGS.focusCost?'开':'关'); fb.classList.toggle('sel',CMD_SETTINGS.focusCost); };
		syncF();
		fb.onclick=()=>{ AudioSys.resume&&AudioSys.resume(); cmdSettingsSet('focusCost',!CMD_SETTINGS.focusCost); syncF(); };
		}
		const sb=el('cmdSelfBtn');
		if(sb){
		const syncS=()=>{ sb.textContent='⚡ '+t('减速对我无效')+': '+t(CMD_SETTINGS.selfExempt?'开':'关'); sb.classList.toggle('sel',CMD_SETTINGS.selfExempt); };
		syncS();
		sb.onclick=()=>{ AudioSys.resume&&AudioSys.resume(); cmdSettingsSet('selfExempt',!CMD_SETTINGS.selfExempt); syncS(); };
		}
		}
	// 瞄准吸附档位 (2026-11-08 批迁入本面板, 面板同款单钮循环): 关→轻度→标准→关 —— 与画质同规落 sf_aim,
	// 但**不 reload**: 13-combat 的开火链每一枪现读 SETTINGS.aim ⇒ 改档下一枪就生效 (所以这里只写内存+存档+按钮态)。
	{
	const ab=el('aimAssistBtn');
	if(ab){
	const _aaNames=['关','轻度','标准'];
	const syncA=()=>{ ab.textContent='🎯 '+t('瞄准吸附')+': '+t(_aaNames[SETTINGS.aim]||_aaNames[1]); ab.classList.toggle('sel',SETTINGS.aim!==0); };
	syncA();
	ab.onclick=()=>{
	AudioSys.resume&&AudioSys.resume();
	SETTINGS.aim=(SETTINGS.aim+1)%3;
	localStorage.setItem('sf_aim',SETTINGS.aim);
	syncA();
	};
	}
	}
// ── 性能与画面五旋钮 (2026-11-08 性能与画面批): 单钮循环 + 即时落盘 + 各自 apply —— 同 aimAssistBtn 模式 ──
// 渲染缩放 (sf_rscale 存档号): applyQuality 内乘进 setPixelRatio
{
const rb=el('rscaleBtn');
if(rb){
const _rsNames=['100%','85%','70%','55%'];
const syncR=()=>{ rb.textContent='🔬 '+t('渲染缩放')+': '+t(_rsNames[SETTINGS.renderScaleIdx]||_rsNames[0]); rb.classList.toggle('sel',SETTINGS.renderScaleIdx!==0); };
syncR();
rb.onclick=()=>{
AudioSys.resume&&AudioSys.resume();
SETTINGS.renderScaleIdx=(SETTINGS.renderScaleIdx+1)%RENDER_SCALE_STEPS.length;
localStorage.setItem('sf_rscale',SETTINGS.renderScaleIdx);
applyQuality();
syncR();
};
}
}
// 阴影刷新 (sf_shfrq): shadowRefreshTick 档位化; 关档即时走 sunShadowAllowed 门 (换天气/昼夜不会复活)
{
const sqb=el('shfrqBtn');
if(sqb){
const _shNames=['跟随画质','逐帧','半频','1/4 频','关'];
const syncSq=()=>{ sqb.textContent='🌘 '+t('阴影刷新')+': '+t(_shNames[SETTINGS.shadowFreq+1]||_shNames[0]); sqb.classList.toggle('sel',SETTINGS.shadowFreq!==-1); };
syncSq();
sqb.onclick=()=>{
AudioSys.resume&&AudioSys.resume();
SETTINGS.shadowFreq=SETTINGS.shadowFreq>=3?-1:SETTINGS.shadowFreq+1;
localStorage.setItem('sf_shfrq',SETTINGS.shadowFreq);
sun.castShadow=sunShadowAllowed();
renderer.shadowMap.needsUpdate=true; // 关→开或降档后立即补一帧影子
syncSq();
};
}
}
// 视距 (sf_vdist): dryFogFar 末尾乘子, 水下雾基准/雾色自动继承; AI 索敌不在此函数不受影响
{
const vdb=el('vdistBtn');
if(vdb){
const _vdNames=['标准','近','更近'];
const syncVd=()=>{ vdb.textContent='🌄 '+t('视距')+': '+t(_vdNames[SETTINGS.viewDistIdx]||_vdNames[0]); vdb.classList.toggle('sel',SETTINGS.viewDistIdx!==0); };
syncVd();
vdb.onclick=()=>{
AudioSys.resume&&AudioSys.resume();
SETTINGS.viewDistIdx=(SETTINGS.viewDistIdx+1)%VIEWDIST_STEPS.length;
localStorage.setItem('sf_vdist',SETTINGS.viewDistIdx);
applyQuality();
syncVd();
};
}
}
// 特效粒子 (sf_fxmax): applyFxQuality 重设上限并回收超出
{
const fxb=el('fxmaxBtn');
if(fxb){
const _fxNames=['标准','精简','增强'];
const syncFx=()=>{ fxb.textContent='✨ '+t('特效粒子')+': '+t(_fxNames[SETTINGS.fxMaxIdx]||_fxNames[0]); fxb.classList.toggle('sel',SETTINGS.fxMaxIdx!==0); };
syncFx();
fxb.onclick=()=>{
AudioSys.resume&&AudioSys.resume();
SETTINGS.fxMaxIdx=(SETTINGS.fxMaxIdx+1)%FXMAX_STEPS.length;
localStorage.setItem('sf_fxmax',SETTINGS.fxMaxIdx);
if(typeof applyFxQuality==='function') applyFxQuality();
syncFx();
};
}
}
// 降水密度 (sf_pmul): 重调 initWeather 重建雨雪池 (幂等, 同步天气其余视觉系数)
{
const pmb=el('pmulBtn');
if(pmb){
const _pmNames=['标准','精简','极简'];
const syncPm=()=>{ pmb.textContent='🌧 '+t('降水密度')+': '+t(_pmNames[SETTINGS.precipIdx]||_pmNames[0]); pmb.classList.toggle('sel',SETTINGS.precipIdx!==0); };
syncPm();
pmb.onclick=()=>{
AudioSys.resume&&AudioSys.resume();
SETTINGS.precipIdx=(SETTINGS.precipIdx+1)%PRECIP_MUL_STEPS.length;
localStorage.setItem('sf_pmul',SETTINGS.precipIdx);
if(typeof initWeather==='function') initWeather();
syncPm();
};
}
}
// 主动优化 (2026-11-16 批5): 三档单钮循环 关闭/标准/激进 —— 决策器 24-main perfOptTick (1s 窗均帧率+迟滞),
// 帧率持续偏低时主动清战场碎屑 (碎块/弹壳/烟云/粒子; 激进档再压布娃娃与弹坑)。改档即时生效不重载。
{
const pob=el('perfOptBtn');
if(pob){
const _poNames=['关闭','标准','激进'];
const syncPo=()=>{ pob.textContent='🧹 '+t('主动优化')+': '+t(_poNames[PERF_OPT]||_poNames[1]); pob.classList.toggle('sel',PERF_OPT!==0); };
syncPo();
pob.onclick=()=>{
AudioSys.resume&&AudioSys.resume();
PERF_OPT=(PERF_OPT+1)%3;
localStorage.setItem('sf_perfopt',String(PERF_OPT));
syncPo();
};
}
}
	// 语言切换 (游戏设置内): 存档后重载生效 (静态文案 applyI18n 已在启动时应用)
	{
	el('langZh').classList.toggle('sel',LANG==='zh');
	el('langEn').classList.toggle('sel',LANG==='en');
	el('langZh').onclick=()=>{ AudioSys.resume&&AudioSys.resume(); if(LANG!=='zh'){ localStorage.setItem('sf_lang','zh'); location.reload(); } };
	el('langEn').onclick=()=>{ AudioSys.resume&&AudioSys.resume(); if(LANG!=='en'){ localStorage.setItem('sf_lang','en'); location.reload(); } };
	}
// 触控按键大小
{
const stored=parseInt(localStorage.getItem('sf_tsize')||'100');
el('tsizeRange').value=stored;
el('tsizeVal').textContent=stored+'%';
el('tsizeRange').oninput=e=>{
localStorage.setItem('sf_tsize',e.target.value);
el('tsizeVal').textContent=e.target.value+'%';
applyTouchScale();
};
}
// 战役选择 (并入开局面板): 占旗点战役收进文件夹, 破袭/遭遇/劫道直排;
// 点击战役卡片 = 保存选择后重载页面并自动开局 (与"进入战场"合并为一步)
const campRow=el('campRow');
// 战役卡片: 三行成块 (标题/模式/副题), 排版交给 CSS `.campCard` (等高卡宽+超宽省略号) —— 2026-09-13 排版修复
// 插值注意: t2('当前：{0}', t2(title)) 会先把外层查表再插值 —— EN 下 {0} 必须在查表前就译好,
// 故这里统一先 t2 各字段, 再喂给外层模板 (否则出现 "Now: 诺曼底 1944" 中英混杂)。
const makeCampBtn=(c,i)=>{
const b=document.createElement('button');
b.className='optBtn campCard'+(i===CAMPAIGN_IDX?' sel':'');
const ti=t2(c.title), mo=t2(c.modeName), su=campSubT(c);
b.innerHTML=`<span class="ccTitle">${ti}</span>`
+`<span class="ccMode">${mo}</span>`
+`<span class="ccSub">${su}</span>`;
b.title=`${ti} · ${mo} · ${su}`; // 省略号截断时悬停可看全
b.onclick=()=>{
hubCampIdx=i;
localStorage.setItem('sf_campaign',String(i));
localStorage.removeItem('sf_zsub');
localStorage.removeItem('sf_pseed');
if(typeof updateHubRightPanel==='function') updateHubRightPanel();
if(typeof renderMenuArt==='function') renderMenuArt();
};
return b;
};
// campSubT 已收敛单源 (上方 hub 区定义, 2026-10-24 规模批删旧块 —— 双定义会被后声明覆盖, 属搬家未删旧块病)
const isFlagMode=m=>m==='assault'||m==='conquest';
// 随机战场 (procgen) 不进战役列表 (2026-10-07 裁定): 随机地图作战只从迷你游戏大厅进 ——
// 旧版卡片会清 sf_zsub 跑成"无丧尸的双队征服", 玩家看到的就是"没丧尸没UI还两队"。
const flagCamps=CAMPAIGNS.map((c,i)=>({c,i})).filter(x=>isFlagMode(x.c.mode)&&x.c.id!=='procgen');
const otherCamps=CAMPAIGNS.map((c,i)=>({c,i})).filter(x=>!isFlagMode(x.c.mode)&&x.c.id!=='procgen');
// 外层行: 文件夹按钮 + 直排战役
const outerRow=document.createElement('div');
outerRow.style.width='100%';
outerRow.style.display='flex'; outerRow.style.flexWrap='wrap';
outerRow.style.justifyContent='center'; outerRow.style.gap='8px';
const folderBtn=document.createElement('button');
folderBtn.className='optBtn campCard folder'+(flagCamps.some(x=>x.i===CAMPAIGN_IDX)?' sel':'');
// 不再往标题后追加 "· 当前X" (会把卡标题撑爆折行; 当前战役已由卡片选中态与 #menuSub 表达, 这里用副题行)
const curCamp=flagCamps.filter(x=>x.i===CAMPAIGN_IDX)[0];
// 2026-09-25 修 (i18n): 📁 必须**并进 t2 的键里** —— 词典键是 '📁 占旗点战役 ({0})' (emoji 是键的一部分),
// 旧版把 emoji 写在模板里、只把 '占旗点战役 ({0})' 传给 t2 ⇒ 查不到、回落中文源串 (EN 模式这张卡仍是中文;
// 全词典 476 条里它是唯一"任何地方都命中不到"的键)。
folderBtn.innerHTML=`<span class="ccTitle">${t2('📁 占旗点战役 ({0})',flagCamps.length)}</span>`
+`<span class="ccMode">${t2('攻防 · 征服 · 拉锯')}</span>`
+`<span class="ccSub">${curCamp?t2('当前：{0}',t2(curCamp.c.title)):t2('点开选择战役')}</span>`;
folderBtn.title=`${t2('📁 占旗点战役 ({0})',flagCamps.length)} · ${t2('攻防 · 征服 · 拉锯')}`;
folderBtn.onclick=()=>{
const open=folderRow.style.display==='flex';
folderRow.style.display=open?'none':'flex';
folderBtn.classList.toggle('sel',!open);
};
outerRow.appendChild(folderBtn);
for(const x of otherCamps) outerRow.appendChild(makeCampBtn(x.c,x.i));
if(campRow) campRow.appendChild(outerRow);
// 文件夹内行: 占旗点战役 + 返回
const folderRow=document.createElement('div');
folderRow.style.width='100%';
folderRow.style.display='none';
folderRow.style.flexWrap='wrap';
folderRow.style.justifyContent='center';
folderRow.style.gap='8px';
const backBtn=document.createElement('button');
backBtn.className='optBtn campCard back';
backBtn.innerHTML=`<span class="ccTitle">${t2('‹ 返回')}</span>`;
backBtn.onclick=()=>{ folderRow.style.display='none'; folderBtn.classList.remove('sel'); };
folderRow.appendChild(backBtn);
for(const x of flagCamps) folderRow.appendChild(makeCampBtn(x.c,x.i));
if(campRow) campRow.appendChild(folderRow);
// (旧版此处会把 "📁 占旗点战役 (8) · 当前征服" 追加进标题, 撑爆卡宽导致折行 —— 2026-09-13 改由 ccSub 行表达)
if(el('menuSub')) el('menuSub').textContent=`—— ${t2(CAMPAIGN.title)} · ${campSubT(CAMPAIGN)} ——`;
if(typeof renderMenuArt==='function') renderMenuArt();
if(el('teamUS')&&el('teamGER')){
el('teamUS').innerHTML=`${TEAM_FACTION[0].sym} ${t2(TEAM_FACTION[0].short)} · ${t2(TEAM_FACTION[0].name)}`;
el('teamGER').innerHTML=`${TEAM_FACTION[1].sym} ${t2(TEAM_FACTION[1].short)} · ${t2(TEAM_FACTION[1].name)}`;
}
document.querySelector('.t0h').textContent=t2(TEAM_NAME[0]);
document.querySelector('.t1h').textContent=t2(TEAM_NAME[1]);
// 在场人数: 标准/加强/史诗 —— 决定每队 Bot 数量 (存档 sf_size)
document.querySelectorAll('.sizeBtn').forEach(b=>{
b.classList.toggle('sel',+b.dataset.s===SIZE_IDX);
b.onclick=()=>{
SIZE_IDX=+b.dataset.s;
localStorage.setItem('sf_size',b.dataset.s);
document.querySelectorAll('.sizeBtn').forEach(x=>x.classList.toggle('sel',x===b));
};
});
// 人力池倍率 (存档 sf_hmul): 只缩放兵力票池, 不改变在场人数
document.querySelectorAll('.hmulBtn').forEach(b=>{
b.classList.toggle('sel',+b.dataset.h===HMUL);
b.onclick=()=>{
localStorage.setItem('sf_hmul',b.dataset.h);
document.querySelectorAll('.hmulBtn').forEach(x=>x.classList.toggle('sel',x===b));
};
});
// 操作方式分组 (2026-09-28 D2, 用户定案): 旧"操控: xx"循环按钮与画质挤一行且档位不可预览, 改为
// 独立「操作方式」节内 自动/触屏/键鼠 三并列按钮, 当前档高亮。三按钮直接映射 sf_mobile:
// 'auto'=删键(自动检测) / '1'=触屏 / '0'=键鼠 —— 与 00-config MOBILE 引导期读取同一份存档键。
// 切换沿用旧按钮的整页 reload 口径 (触控 DOM/事件绑定按 MOBILE 分叉, 就地切不干净); 点已高亮档不动作。
{
const ctrlCur=()=>{ const ov=localStorage.getItem('sf_mobile'); return (ov==='1'||ov==='0')?ov:'auto'; };
document.querySelectorAll('.ctrlBtn').forEach(b=>{
b.classList.toggle('sel',ctrlCur()===b.dataset.c);
b.onclick=()=>{
const c=b.dataset.c;
if(c===ctrlCur()) return;
if(c==='auto') localStorage.removeItem('sf_mobile'); else localStorage.setItem('sf_mobile',c);
document.querySelectorAll('.ctrlBtn').forEach(x=>x.classList.toggle('sel',x===b));
};
});
}
if(el('teamUS')&&el('teamGER')){
el('teamUS').classList.toggle('sel',SETTINGS.team===0);
el('teamGER').classList.toggle('sel',SETTINGS.team===1);
el('teamUS').onclick=()=>{ SETTINGS.team=0; localStorage.setItem('sf_team','0'); el('teamUS').classList.add('sel'); el('teamGER').classList.remove('sel'); };
el('teamGER').onclick=()=>{ SETTINGS.team=1; localStorage.setItem('sf_team','1'); el('teamGER').classList.add('sel'); el('teamUS').classList.remove('sel'); };
}
document.querySelectorAll('.diffBtn').forEach(b=>{
b.classList.toggle('sel',+b.dataset.d===SETTINGS.diff);
b.onclick=()=>{
SETTINGS.diff=+b.dataset.d;
localStorage.setItem('sf_diff',b.dataset.d);
document.querySelectorAll('.diffBtn').forEach(x=>x.classList.toggle('sel',x===b));
};
});
{
const _dns=document.querySelectorAll('.dnBtn');
const _dnLock=el('dnLock');
const _locked=false;   // (2026-11-10: ironbottom 锁夜门随纯海战图下架摘除)
_dns.forEach(x=>{
x.classList.toggle('sel',_locked?x.dataset.dn==='night':x.dataset.dn===(NIGHT_MODE?'night':'day'));
if(_locked){ x.disabled=true; x.style.opacity=.45; }
else x.onclick=()=>{
if(x.dataset.dn===(NIGHT_MODE?'night':'day')) return;
AudioSys.resume&&AudioSys.resume();
localStorage.setItem('sf_daynight',x.dataset.dn);
document.querySelectorAll('.dnBtn').forEach(b=>b.classList.toggle('sel',b===x));
};
});
if(_dnLock) _dnLock.style.display=_locked?'':'none';
}
{
const _wxs=document.querySelectorAll('.wxBtn');
const _wxHint=el('wxHint');
const _snowFam=(typeof WX_SNOW_MAP!=='undefined')&&!!WX_SNOW_MAP;
const _lbl={clear:_snowFam?'雪停':'晴朗',overcast:_snowFam?'细雪':'多云',rain:_snowFam?'中雪':'小雨',storm:_snowFam?'暴风雪':'暴雨'};
const _effZh={clear:'晴朗',overcast:'多云',rain:'小雨',storm:'暴雨',snowLight:'细雪',snowMid:'中雪',snowBlizzard:'暴风雪'};
const _wxCur=localStorage.getItem('sf_weather')||'map';
_wxs.forEach(x=>{
x.textContent=t(_lbl[x.dataset.wx]||x.dataset.wx);
x.classList.toggle('sel',x.dataset.wx===_wxCur);
x.onclick=()=>{
if(x.dataset.wx===_wxCur) return;
AudioSys.resume&&AudioSys.resume();
if(x.dataset.wx==='map') localStorage.removeItem('sf_weather'); else localStorage.setItem('sf_weather',x.dataset.wx);
document.querySelectorAll('.wxBtn').forEach(b=>b.classList.toggle('sel',b===x));
};
});
if(_wxHint){
if(_wxCur==='map'){ _wxHint.style.display=''; _wxHint.textContent=t('本图={0}',t(_effZh[WEATHER_EFF]||'晴朗')); }
else _wxHint.style.display='none';
}
}
document.querySelectorAll('.qualBtn').forEach(b=>b.onclick=()=>{
SETTINGS.quality=+b.dataset.q;
localStorage.setItem('sf_qual',String(SETTINGS.quality));
document.querySelectorAll('.qualBtn').forEach(x=>x.classList.toggle('sel',x===b));
applyQuality();
});
initCombatHubUI();
initPauseOverlayUI();
el('sensRange').oninput=e=>{ SETTINGS.sens=e.target.value/100; localStorage.setItem('sf_sens',e.target.value); el('sensVal').textContent=SETTINGS.sens.toFixed(1); };
el('volRange').oninput=e=>{ SETTINGS.vol=e.target.value/100; localStorage.setItem('sf_vol',e.target.value); el('volVal').textContent=e.target.value; AudioSys.setVol(SETTINGS.vol); };
// 落盘后的初值同步 (2026-09-25): 三项已持久化 ⇒ HTML 里写死的 .sel / value=100 / value=80 会被 SETTINGS 覆盖。
// 音量本身不需再调 (01-audio 建 master 时就是 master.gain.value=SETTINGS.vol)。
document.querySelectorAll('.qualBtn').forEach(x=>x.classList.toggle('sel',(+x.dataset.q)===SETTINGS.quality));
{ const sr=el('sensRange'); if(sr){ sr.value=String(Math.round(SETTINGS.sens*100)); el('sensVal').textContent=SETTINGS.sens.toFixed(1); }
  const vr=el('volRange'); if(vr){ vr.value=String(Math.round(SETTINGS.vol*100)); el('volVal').textContent=String(Math.round(SETTINGS.vol*100)); } }
// 结算页「返回主界面」入口 (2026-09-16 本批): 对局已结束, 无二次确认 —— 战局没有可损失的东西
el('againBtn').onclick=()=>{ AudioSys.resume&&AudioSys.resume(); returnToMenu(); };
// 部署界面「返回主界面」入口 (2026-09-16 本批): 开局选兵种阶段的唯一出口, 战斗中按 Esc 查看部署界面时同样可用;
// 是否显示由 showDeploy 决定 (战局已结束则不显示, 那条路径归结算页的按钮)
if(el('deployMenuBtn')) el('deployMenuBtn').onclick=()=>{ AudioSys.resume&&AudioSys.resume(); returnToMenu(); };
	const grid=el('classGrid');
	CLASSES.forEach((c,i)=>{
	// D3 (2026-10-26 指挥官批): 丧尸/海战局不出指挥官兵种卡 (cls5) —— 卡片根本不建
	if(i===5&&typeof cmdClassAvailable==='function'&&!cmdClassAvailable()) return;
	const d=document.createElement('div');
	// 用户需求 5 (2026-10-26 反馈批): 指挥官卡要"标明其对应一个新模式" —— 金铜描边 (.classCard.cmdCard)
	//   + 卡内模式说明行 (.cmdMode, 词条走 t2 词典闭环)。样式与文案各自只写一份 (css / 00b-i18n)。
	d.className='classCard'+(i===0?' sel':'')+(i===5?' cmdCard':'');
	const cname=(EXPERIMENT&&i===3)?t2('巡飞弹兵'):t2(c.name);
	d.innerHTML=`<div class="cname">${cname}</div><div class="cwpn" id="cw${i}"></div><div class="cwpn">${t2('手雷 ×{0}',c.nades)}</div>`
	+(i===5?`<div class="cmdMode">${t2('新模式 · 指挥官: 右键开指挥地图统一步/坦/空 · E/F/R 下令 · 左键集火 · V 减速')}</div>`:'');
	d.onclick=()=>{
	// ★2026-11-01 自由观战视模式: 观战中部署页唯一可用的是「观战」按钮, 兵种卡一律提示后早退
	// (视模式不能换装/不能部署 —— 那是"干涉战局", 与结算计入口径 21-match recCommit 冲突)。
	if(player.specView&&!player.alive){
	showScorePop(t2('自由观战中 · 部署页仅「观战」按钮可用'));
	AudioSys.click(400,0.2,0.05);
	return;
	}
	// R10 双向锁门 (2026-10-26 指挥官批): 所有兵种卡过同一道门 —— 指挥官位仅局内首次部署可选,
	// 此后按锁定方向禁选 ('out'=换不进 / 'in'=换不出); 原因文案键与 i18n 词典对齐。
	if(typeof cmdClassCardGate==='function'){
	const gate=cmdClassCardGate(i);
	if(gate){
	showScorePop(t2('指挥官')+': '+t2(gate));
	AudioSys.click(400,0.2,0.05);
	return;
	}
	}
	// D21 布势: 本局首次选指挥官卡 → 冻结布势地图 (配比+初始命令; 跳过=确认开战即默认布势)
	// ★2026-10-26 排查轮二审 修复 (H5/P2: 布势界面只能进一次, 与设计/注释都不符):
	//   ①现象 (用户可见): 部署页点指挥官卡 → 自动弹布势地图 (调配比/下初始令) → Esc 或右键 = 确认开战
	//     (跳过布势) → 收图回部署页 (**人还没落地**, 还能换出生点、看编制) → 这时想再调一次配比:
	//     点指挥官卡**没有任何反应**, 布势再也进不去, 连一句提示都没有。
	//   ②根因 (旧写为什么错): 这条分支带 `!CMD.deploySeen` 硬门, 而 deploySeen 是 cmdDeployOpen 自己
	//     置位的 (26-commander) ⇒ 第一次点过之后本分支永不成立, 代码继续往下走"普通兵种选择"逻辑;
	//     可 player.cls 已经是 5 了, 重选同一个兵种 = 零可见变化 ⇒ 表现为"点了没反应"。
	//     而 cmdDeployOpen 的注释明写"可重复进入 (选卡再点布势按钮)", 设计 D21 也把布势当界面入口 ——
	//     实现与它自己的契约相反, 属于门写错了而不是设计如此。
	//   ③现在的单源口径: 两道入口共用同一个 cmdDeployOpen (不新增第二套开图代码), 只是把门条件补全:
	//     · 本局第一次点 = 现有的自动弹 (deploySeen=false 分支, 行为逐位不变);
	//     · 人还没落地、战局未结算时再点 = 重新进布势调整配比/初始令。
	//     ★2026-10-27 排查批: 旧写还有一层 `player.cls===5` 子条件 —— "撤销布势→改选步兵→再点指挥官卡"
	//     时 cls 已是别的值, 布势不再自动弹, 且游戏里没有任何"布势按钮"可补进 (cmdDeployOpen 的注释
	//     所指的入口就是点卡) ⇒ 这条路径的指挥官局只能以"默认布势"裸开。布势是指挥官选型的**配套界面**
	//     (D21), 凡未落地点指挥官卡都该进; `!player.deployed` 就是"战斗中途不许重进"那道门 ——
	//     落地之后 (无论是活着还是死了等重生, 死亡不清 deployed) 这里都不放行, 否则等于给了个
	//     战斗中随时改全军兵种的旁路; `!matchOver` 收掉结算后的边界。下面的观战 / D15 分支一个字没动。
	if(i===5&&typeof CMD!=='undefined'&&typeof cmdDeployOpen==='function'
	 &&(!CMD.deploySeen||(!player.deployed&&!matchOver))){
	player.cls=5;
	document.querySelectorAll('.classCard').forEach(x=>x.classList.toggle('sel',x===d));
	cmdDeployOpen();
	AudioSys.click(1200,0.3,0.05);
	return;
	}
	// 观战模式开关: 实验模式下巡飞弹兵"已选中"时再点一次 → 开/关观战 (2026-09-01 用户指定)
// ★2026-09-26H 观战批 (审计 #3/A3, 用户圈定修复): 战斗中**不许即时开启** —— 旧版是"正在交战的活人二次点击
//   当场获得免伤/无限弹/无差别火力", 既无确认也不落在部署点上 (Esc 丢指针锁就会自动打开本界面, 路径极短)。
//   现在三条:
//     · 开启 + 活着·已落地·未结算 ⇒ 二次确认 + 记为 player.specWant, **下一次部署**才生效 (23-deploy 结算);
//     · 关闭 ⇒ 立即生效 (反过来的方向没有可利用性; 且观战者不会阵亡 ⇒ 若也要等部署就永远退不出来);
//     · 兵种选择阶段 / 死亡等待期 / 结算后 ⇒ 与旧版一致, 立即生效 (那时人没在交战, 没有"瞬间变强"的问题)。
	// ★2026-11-20 批 (用户令④): 战地整备界面 (活着·已部署 — 补给箱旁按 ESC 呼出的改兵种界面) 里点自己的
	//   巡飞弹兵卡 = 普通重选, **不再触发调试模式开关**。调试是"干涉战局"的开关, 与 2026-09-26H
	//   "战斗中不许即时开启"同族 —— 战地整备路径同样极短 (Esc 丢指针锁就自动进本界面), 误触即改变本局性质。
	//   兵种选择阶段 / 死亡等待期 / 结算后 (alive=false 或未部署) 的开关行为原样保留 (下面原分支不动)。
	if(EXPERIMENT&&i===3&&player.cls===3&&player.alive&&player.deployed&&!matchOver){
	showScorePop(t2('调试模式不可在战地整备中切换'));
	AudioSys.click(400,0.2,0.05);
	return;
	}
	if(EXPERIMENT&&i===3&&player.cls===3){
	// D15 (2026-10-26 指挥官批): 指挥官与观战态互斥 —— 战斗中开关/选兵阶段/双击卡三条路径
	// 全收敛在这一个 onclick 里, 一道门全堵 (防"指挥官身体 + 观战换装"缝合态)。
	if(typeof cmdSpecToggleGate==='function'){
	const _sg=cmdSpecToggleGate();
	if(_sg){ showScorePop(t2(_sg)); AudioSys.click(400,0.2,0.05); return; }
	}
	const cur=(typeof player.specWant==='boolean')?player.specWant:player.spectator;   // 待生效优先: 再点一次=撤销
const want=!cur;
const midBattle=player.alive&&player.deployed&&!matchOver;
	if(want&&midBattle){
	// ★2026-11-01 改名 (用户裁定): 旧观战 = 调试模式 (能干涉战局 ⇒ 本局不计历史); 新"自由观战"见 enterSpecView。
	if(!confirm(t('开启调试模式？本局将: 免伤 · 不被索敌 · 弹药无限 · 副武器换观战连狙, 且可对双方开火。注意: 下一次部署才生效; 生效(以调试观战身份进入战场)后本局不计入历史记录 —— 只点开开关又取消的不算。')))return;
	player.specWant=true;
}else{
player.specWant=null;
const wasSpec=player.spectator;
player.spectator=want;
if(wasSpec&&!want){
if(player.specViewHost&&typeof dbgSpecDetach==='function') dbgSpecDetach();   // 附身中关调试 ⇒ 走脱离单源 (还原观察位/宿主模型显隐/VM/弹药面板账, 2026-11-01)
if(typeof specVehStow==='function') specVehStow();
if(typeof specTimeReset==='function') specTimeReset();
}
applySpectatorLoadout();
}
{
// 卡片外观 + 武器行 + 出生列表同步刷新 (观战会改出生列表里的载具闸门, 兵种卡副武器位也会跟着变)
// ★2026-11-04b 部署记忆批: 外观改完后走 23-deploy 的 syncDeploySelectionDOM 单源重刷 (调试开关关掉时
//   金边/.spec/后缀要真的收干净; 旧版这里只改 d 这一张卡, 且关掉后卡名残留「巡飞弹兵」不带状态后缀)。
const pend=(typeof player.specWant==='boolean');
d.classList.toggle('spec',player.spectator||pend);
d.style.outline=(player.spectator||pend)?'2px solid #ffd76b':'';
const cn=d.querySelector('.cname');
if(cn) cn.textContent=t2('巡飞弹兵')+(player.spectator?t2(' · 调试中'):(pend?t2(' · 调试待生效'):''));   // ★2026-11-17 批1: 状态刷新路径也走翻译 (旧裸拼覆盖建卡时的英文)
const cw=el('cw3'); if(cw) cw.textContent=classCardWeaponText(3);
if(typeof syncDeploySelectionDOM==='function') syncDeploySelectionDOM();
buildSpawnList();
}
showScorePop((typeof player.specWant==='boolean')
?'调试模式将于下次部署生效'
:(player.spectator?'调试模式已开启: 免伤·不被索敌·弹药无限·副武器连狙':'调试模式已关闭'));
AudioSys.click(1200,0.3,0.05);
return;
}

const isAlive = player.alive&&player.deployed;
const nearCrate = isAlive && (typeof isNearSupplyCrate==='function' && isNearSupplyCrate(player.pos));
if(isAlive && !nearCrate){
showScorePop('[战地整备受限: 需在友方补给箱 2.8m 内方可调配装备]');
AudioSys.click(400,0.2,0.05);
return;
}
player.cls=i;
document.querySelectorAll('.classCard').forEach(x=>x.classList.toggle('sel',x===d));
};
grid.appendChild(d);
});
el('deployBtn').onclick=()=>{
if(matchOver) return;
// ★2026-11-01 票尽且未开调试观战 ⇒ 按钮此刻是「观战」(23-deploy/24-main 同判据换字): 进自由观战视模式
// (enterSpecView 单源 20-player; 内部自带票门/调试观战门, 这里只分流)。
if(tickets[player.team]<=0&&!player.specWillBe()){
if(typeof enterSpecView==='function') enterSpecView();
return;
}
// ★2026-10-30: 票尽门给调试观战放行 (specWillBe 单源见 18-game, 与 23-deploy 同一批注) ——
//   观战开关开着时按钮照常可点, 部署将以观战身份入场。
if(respawnCd>0){
// 调试模式冷却 bypass (2026-11-14 用户令): 开着调试模式 (含待生效, specWillBe 单源) 时, 冷却读数中
// 点「部署」= 跳过等待直接部署; 未开调试照旧无反应 (return), 冷却读数本身不受影响照常走秒
// (24-main 的逐帧递减不碰)。!player.alive 门: 该 bypass 只服务死亡重部署读数 —— 活着开 Esc 页时
// respawnCd 残值不得触发重部署。
if(!player.alive&&(player.spectator||player.specWillBe())) deployPlayer();
return;
}
deployPlayer(); // 己方兵力归零后不可再部署 (2026-09-04; 观战放行见上)
};
el('resumeBtn').onclick=()=>{
const isAlive = player.alive&&player.deployed;
const nearCrate = isAlive && (typeof isNearSupplyCrate==='function' && isNearSupplyCrate(player.pos));
if(nearCrate){
if(typeof rearmPlayerClass==='function') rearmPlayerClass(player.cls);
player.resupplyCd = Math.max(player.resupplyCd || 0, 4);
showScorePop('[补给站整备完成: 换装已生效]');
}
document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden'));
syncDeployHud(); // 「返 回 战 斗」= 部署界面收起 → 立刻摘掉 inDeploy 把战斗 HUD 放回 (2026-09-20 第6条)
lockPointer();
};
renderer.domElement.addEventListener('click',()=>{
if(player.alive&&player.deployed&&!pointerLocked&&!matchOver) lockPointer();
});
// 选战役后重载回到本面板 (战役选择与开始游戏同屏); 清理旧版"自动开局"残留标记
localStorage.removeItem('sf_autostart');
// 首屏引导 class 摘除 (2026-09-13):
//   html.lang-en → 遮挡解除**已挪到 00b-i18n.i18nBoot** (2026-09-25): 那里才是 applyI18n 盖章之后,
//     在此处摘除会早于盖章 ⇒ 遮挡等于没挡, EN 存档照旧先闪中文。本函数不再碰它。
//   html.boot-play → CSS 兜底的"停靠开始面板"交还给下方逻辑
document.documentElement&&document.documentElement.classList&&document.documentElement.classList.remove('boot-play');
if(localStorage.getItem('sf_mzstart')==='1'){
// 迷你游戏直达开局 (2026-10-06): 面板已写好 sf_campaign/sf_zsub/sf_pseed —— 跳过战役页直接进入战场
// (2026-10-07b: 顺带清 sf_openplay —— go() 两个键都写, 只清 mzstart 会让"下次开页"落在战役面板)
localStorage.removeItem('sf_mzstart');
localStorage.removeItem('sf_openplay');
startGame();
}else if(localStorage.getItem('sf_openplay')==='1'){
localStorage.removeItem('sf_openplay');
showPanel('mPlay');
}else{
showPanel('mHome'); // 常规首屏: 同步「进入战场 / 返回战斗」按钮态
}
}

// ═════════ 水下滤镜 / 憋气 HUD (2026-09-18 塔拉瓦环礁批) ═════════
// 触发条件: 相机 y < 该点水面高度 (海/河道/支流/鱼塘统一走 03-terrain waterYAt 单源) ——
// 因此第一人称潜水、死亡镜头、观战自由视角、巡飞弹入水一律生效, 无需各自挂钩。
// 三件事: ① #uwOv 全屏蓝绿滤镜 (不透明度随没入深度) ② scene.fog 拉近压色 ③ AudioSys 主链低通闷响。
// 出水后逐项还原 (雾的基准值在**入水那一刻**采样一次, 出水即还原并丢弃基准 —— 画质/天气改了也不漂)。
// ★ 2026-09-18b 修严重 BUG: 旧版把"采样基准"写成 `if(!under||!_uwBase) _uwBase={当前雾值}` ——
//   上浮那一帧 !under 先成立, 于是把**水下雾值**当成基准抓了下来, 再"还原"回水下色 ⇒ 出水后画面
//   永久留着蓝绿近雾 (用户实机: "脱离了水域后仍有水域滤镜")。基准只在入水时采, 且出水即清。
let _uwOn=false, _uwBase=null;
function updateUnderwaterFx(dt){
const cam=camera.position;
const wy=waterYAt(cam.x,cam.z);
const under=(wy>-1e8)&&(cam.y<wy-0.05);
const dep=under?(wy-cam.y):0;
const entering=under&&!_uwOn, leaving=(!under)&&_uwOn;
// ① 全屏滤镜
const ov=document.getElementById('uwOv');
if(ov){
const op=under?clamp(0.40+dep*0.13,0.40,0.90):0;
if(Math.abs((ov._op||0)-op)>0.008){ ov._op=op; ov.style.opacity=op; }
}
// ② 水下雾 (蓝绿近雾: 9/15/21m 随画质档); 入水采样基准, 出水还原
// (getHex/setHex 走 try 保护: 沙箱 THREE 桩的 Color 只有 set —— 探针不该因配色调用而炸)
if(scene.fog){
const fogGet=()=>{ try{ return scene.fog.color.getHex(); }catch(e){ return null; } };
const fogSet=h=>{ try{ if(h===null) return; if(scene.fog.color.setHex) scene.fog.color.setHex(h); else if(scene.fog.color.set) scene.fog.color.set(h); }catch(e){} };
if(entering) _uwBase={c:fogGet(),n:scene.fog.near,f:scene.fog.far,q:SETTINGS.quality};
if(under){
// ★2026-09-26E (审计 40): 潜水期间改画质 ⇒ applyQuality 写了新的 fog.far, 而出水时按 _uwBase 还原 ⇒
//   新画质档的雾距在本局剩余时间里失效。这里在"画质档变了"时把基准的干态雾距重采一份 (单源 02-scene)。
if(_uwBase&&_uwBase.q!==SETTINGS.quality){
_uwBase.q=SETTINGS.quality;
if(typeof dryFogNear==='function') _uwBase.n=dryFogNear();
if(typeof dryFogFar==='function') _uwBase.f=dryFogFar();
}
const q=SETTINGS.quality;
fogSet(0x18485c);
scene.fog.near=0.15;
scene.fog.far=q===0?9:(q===1?15:21);
}else if(leaving&&_uwBase){
fogSet(_uwBase.c); scene.fog.near=_uwBase.n; scene.fog.far=_uwBase.f;
}
}
// ③ 音效闷响 (主链低通) + 状态推进 (出水即丢弃雾基准: 下次入水重新采样)
if(under!==_uwOn){
_uwOn=under;
if(typeof AudioSys!=='undefined'&&AudioSys.setUnderwater) AudioSys.setUnderwater(under);
if(!under) _uwBase=null;
}
// ④ 憋气 HUD: 头部没入 / 未回满时显示; 条色随余量 (青→黄→红)
const wrap=document.getElementById('oxyWrap');
if(wrap){
const p=player;
const oxy=(p.oxy===undefined?1:p.oxy);
const show=!!(p.alive&&p.deployed&&!p.onVehicle&&!p.onNaval&&p.spectator!==true&&((p.headDepth||0)>0||oxy<0.995));   // 2026-09-26E 审计 15: 艇上不显示呼吸/憋气条
wrap.style.display=show?'block':'none';
if(show){
const k=clamp(oxy,0,1);
const fill=document.getElementById('oxyFill');
if(fill){
fill.style.width=(k*100).toFixed(1)+'%';
fill.style.background=k<0.3?'#ff8a6a':(k<0.6?'#e8d06a':'#8fd8f0');
}
const hint=document.getElementById('oxyTxt');
const txt=(p.headDepth||0)>0?(k>0?'憋气中 · [Shift] 下潜 · [空格] 上浮':'⚠ 溺水! 快上浮')
:(p.swim?'游泳中 · [Shift] 下潜':'呼吸恢复中');
if(hint&&hint._t!==txt){ hint._t=txt; hint.textContent=(typeof t==='function')?t(txt):txt; }
}
}
}
// ═════════════════════════════════════════════════════════════════════════════
// 【追加段】海战 HUD / 海图符号 / 对局退场 (2026-09-20N 海战批, owner: naval-crew)
//
// 本文件是共享大文件 (1282 行), 本批纪律 = **只追加** —— 唯一例外是第 687 行 Lead 指派的旗标缺失守卫
// (`if(!fi) return;`, 已在消息里登记豁免)。
// 因此小地图/大地图的海面载具符号**不改** drawMinimap/drawBigMap 的函数体, 而是**包一层**:
//   追加段末尾把绑定换成"先调原函数、再叠加 naval 符号"的包装版 —— updateHUD 里按名调用取的是当前绑定,
//   包装自然生效, 而 git diff 对本文件保持纯增量 (可逐行核对)。
// 代价: 包装里必须复刻一次地图投影 (小地图是"以玩家为中心旋转"式, 大地图是北向式)。两处投影常量/公式
//   与既有函数逐字一致, 并由 dev/_navalcrew-selfcheck.js 的**源码漂移断言**看住 —— 一旦既有投影被改动
//   而忘了同步这里, 自检立刻红, 而不是"符号画错位置却没人发现"。
// 与坦克的区分: 坦克 = 8×8 实心方块; 海面载具 = 艏向三角 (艇=细长+中轴线, 两栖车=短宽+车体方块)。
// 颜色仍取坦克那套阵营色, 不另写色表 (定稿 §C "共用 NAVAL_SPEC, 不另写色表")。

// ── ① 海面载具地图符号 (小地图/大地图/部署图共用这一份画法) ──
// rot = 0 时是"北向图"(大地图/部署图, 与 drawBigMap 的 rotate(Math.PI-pl.yaw) 同式);
// rot = player.yaw 时是"以玩家为中心旋转的小地图"(与 drawMinimap 的飞机符号同式)。
function sfNavalMapSymbols(toMap,c,S,rot){
if(typeof navalCraft==='undefined'||!Array.isArray(navalCraft)) return 0;
let n=0;
for(const k of navalCraft){
if(!k||!k.alive||!k.pos) continue;
const q=toMap(k.pos.x,k.pos.z), px=q[0], py=q[1];
if(px<-12||py<-12||px>S+12||py>S+12) continue;
const boat=(k.kind==='boat');
const len=boat?7.5:4.6, wid=boat?2.2:3.0;
const col=(k.team===0)?'#6da5e8':'#e87a68';
c.save();
c.translate(px,py);
c.rotate(-(k.yaw||0)+rot+Math.PI);
c.fillStyle=col;
c.beginPath();
c.moveTo(0,-len); c.lineTo(wid,len*0.62); c.lineTo(0,len*0.26); c.lineTo(-wid,len*0.62);
c.closePath(); c.fill();
c.strokeStyle='rgba(240,250,255,.95)'; c.lineWidth=1; c.stroke();
if(boat){ c.beginPath(); c.moveTo(0,-len); c.lineTo(0,len*0.26); c.stroke(); }   // 中轴线 = 艇身 (细长)
else { c.fillStyle=(k.team===0)?'#3f6ea8':'#a85448'; c.fillRect(-2,-2.4,4,4.8); c.strokeRect(-2,-2.4,4,4.8); } // 车体方块 = 两栖履带
c.restore();
n++;
}
return n;
}
// (2026-11-10: 大舰地图符号 sfCapitalMapSymbols 随大舰子系统下架摘除)
// ── ② 小地图/大地图包装 (纯追加; 原函数一行不动) ──
let _navalMapErr=false;
const _navalBaseDrawMinimap=drawMinimap;
drawMinimap=function(){
_navalBaseDrawMinimap.apply(this,arguments);
try{
// 投影与 drawMinimap 内联 toMap 逐字同式 (该函数体本批不动, 只能在此复刻一次; 漂移由自检看住)
const S=190, half=S/2, range=90*Math.max(1,Math.sqrt((CAMPAIGN.mapSize||320)/320));
const lt=(player.alive&&player.loiter&&!player.loiter.dead)?player.loiter:null;   // 2026-11-07 实机反馈批 (裁定④): 操控巡飞弹 ⇒ 小地图以弹体为中心/朝向 (本体箭头挪到实际位置, 弹体标记常显)
const cx=player.alive?(lt?lt.pos.x:player.pos.x):0, cz=player.alive?(lt?lt.pos.z:player.pos.z):0;
const rot=player.alive?(lt?lt.yaw:player.yaw):0;
// ★20261121d 批C裁定: 与 drawMinimap 内联投影同步 —— 自由观战档 (_svObs) 位置锚改观察者 (rot 旋转档照旧)。
//   本包装层的 toMap 必须与基础函数逐字同式 (见上面"漂移由自检看住"), 基础侧改了锚, 这里不跟 = 海战符号层
//   在自由观战里画回世界原点, 与底层点位错位。
const _svObs=(player.specView&&!player.alive);
const _ax=_svObs?player.pos.x:cx, _az=_svObs?player.pos.z:cz;
const toMap=(x,z)=>{
const dx=x-_ax, dz=z-_az;
const co=Math.cos(rot), si=Math.sin(rot);
const rx=dx*co-dz*si, rz=dx*si+dz*co;
return [half+rx/range*half, half+rz/range*half];
};
sfNavalMapSymbols(toMap,mmC,S,rot);     // (2026-11-10: 大舰符号层 sfCapitalMapSymbols 随大舰子系统下架摘除)
}catch(e){ if(!_navalMapErr){ _navalMapErr=true; console.error('[海战] 小地图符号叠加失败',e); } }
};
const _navalBaseDrawBigMap=drawBigMap;
drawBigMap=function(){
_navalBaseDrawBigMap.apply(this,arguments);
try{
// 投影与 drawBigMap 内联 toM 逐字同式 (S=520, MH=MAP_SIZE/2+10)
const S=520, MH=MAP_SIZE/2+10;
const toM=(x,z)=>[S/2+x/MH*S/2, S/2+z/MH*S/2];
const bmC=el('bigmap').getContext('2d');
sfNavalMapSymbols(toM,bmC,S,0);
}catch(e){ if(!_navalMapErr){ _navalMapErr=true; console.error('[海战] 大地图符号叠加失败',e); } }
};
// ── ③ 座驾读数 (艇 / 两栖车) ──
// 复用既有 #ammoPanel + #heatFill —— 与坦克/飞机同一条约定"座驾读数占用弹药面板"(玩家上艇时 curW 被暂存为空,
// updateHUD 的弹药分支自然不再写它, 于是这里的字不会被覆盖)。
// 舰体血量条单列一个运行时面板 #navalHud: #vehHpWrap 被 updateHUD 按 kind==='tank'|'plane' 每帧收走,
// 海战载具借不到那个槽; index.html/css 不在本批写入域, 故样式内联 (口径照抄 #vehHpWrap/#healthPanel)。
let _navalPanel=null;
function navalPanelEnsure(){
if(_navalPanel) return _navalPanel;
const wrap=document.createElement('div');
wrap.id='navalHud';
wrap.style.cssText='position:absolute;left:50%;bottom:96px;transform:translateX(-50%);width:280px;display:none;'
+'text-align:center;font-size:12px;color:#e6e2d2;text-shadow:0 1px 2px #000;pointer-events:none;';
wrap.innerHTML='<div style="position:relative;height:8px;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.28)">'
+'<span data-nh="bar" style="position:absolute;left:0;top:0;bottom:0;width:100%;background:#9fd89f;display:block"></span></div>'
+'<div style="margin-top:2px"><span data-nh="name" style="color:#d8c894;letter-spacing:1px"></span> <span data-nh="num"></span></div>'
+'<div data-nh="info" style="opacity:.92"></div>'
+'<div data-nh="spd" style="opacity:.8"></div>';
const host=document.getElementById('ui')||document.body;
if(host&&host.appendChild) host.appendChild(wrap);
const q=k=>(wrap.querySelector?wrap.querySelector('[data-nh="'+k+'"]'):null);
_navalPanel={wrap,bar:q('bar'),num:q('num'),name:q('name'),info:q('info'),spd:q('spd')};
return _navalPanel;
}
// 座驾读数刷新 (由 20a-seats 的 updatePlayerNaval 每帧调用; c=null = 收面板并交还弹药面板)
function navalSeatHud(c){
const amp=document.getElementById('ammoPanel');
if(!c){
if(amp) amp.style.display='';
if(_navalPanel) _navalPanel.wrap.style.display='none';
return;
}
const spec=c.spec||{};
const st=player.navalCd||{main:0,sec:0,torp:0};
const mainRof=Math.max(0.05,(spec.main&&spec.main.rof)||spec.reload||1);
// ① 装填条 (#heatFill): 与坦克同口径 (冷却满 = 绿)
const hf=document.getElementById('heatFill');
if(hf){
const k=clamp(1-st.main/(mainRof*(player.streakBuff?player.streakBuff.reloadMul:1)),0,1);
const wv=(k*100)+'%'; if(hf._lw!==wv){ hf._lw=wv; hf.style.width=wv; }   // 去重写 (2026-11-01 性能批, _lw/_lb 键与 20a 各座位共用 ⇒ 跨座位一致)
const bg=st.main<=0?'#8fd18f':'linear-gradient(90deg,#e8c56a,#e83a1a)'; if(hf._lb!==bg){ hf._lb=bg; hf.style.background=bg; }
}
// ② 弹药面板 = 武器名 / 主炮读数 / 鱼雷数 / 操作行 (键全部已存在)
if(amp&&amp.style.display!=='block') amp.style.display='block';
const wname=el('wname'), wmode=el('wmode'), magN=el('magN'), resN=el('resN'), nadeN=el('nadeN');
// 去重写 (2026-11-01 性能批): 这些 id 是 22-hud/20a 双写点, 不能走 _hudW Map 缓存 ⇒ 元素挂 _t/_lc 缓存
if(wname){ const v=t2(spec.name||''); if(wname._t!==v){ wname._t=v; wname.textContent=v; } }
if(wmode){ const v=t2((spec.main&&spec.main.name)||'')+' · '+t2(c.kind==='boat'?'快艇':'两栖车'); if(wmode._t!==v){ wmode._t=v; wmode.textContent=v; } }
if(magN){ const v=st.main<=0?t2('就绪'):st.main.toFixed(1);
if(magN._t!==v){ magN._t=v; magN.textContent=v; }
const cl=st.main<=0?'#9fd89f':'#e0c080'; if(magN._lc!==cl){ magN._lc=cl; magN.style.color=cl; } }
// ★2026-09-26E (审计 16): 鱼雷装填 (1.2s 闸门) 旧版在界面上**没有任何读数** —— 按 F 后 1.2s 内再按只会弹字。
//   现在把闸门剩余时间并进鱼雷那一行 (存量 + 倒计时), 玩家不用猜。
if(resN){ const v=(spec.torpedo>0)?(st.torp>0?t2('鱼雷 ×{0} · 装填 {1}s',navalTorpedoLeft(c),st.torp.toFixed(1)):t2('鱼雷 ×{0}',navalTorpedoLeft(c))):'';
if(resN._t!==v){ resN._t=v; resN.textContent=v; } }
// 2026-09-22: F 的语义随**可步行下船**与否切换 (与 20-player tryInteract / updateInteractHint 三处同源) ——
//   旧版这行永远写 [F] 鱼雷, 于是在浅水/搁浅 (F 实际=下船) 时读数是错的。
// 2026-09-26E 审计 12: 门与 20-player tryInteract 同源 (navalCanExitNow) —— 无鱼雷载具恒显示 [F] 下船
if(nadeN){ const v=SHOW_CTL_HINTS?(typeof navalCanExitNow==='function'&&navalCanExitNow(c))
?t2('[左键] 主炮 · [右键] 机炮 · [F] 下船')
:t2('[左键] 主炮 · [右键] 机炮 · [F] 鱼雷')
+(player.navalGun?' · '+t2('炮手镜'):''):'';   // 2026-09-21: 炮手镜态在操作行尾标注 (与 20-player 提示同源); 2026-11-09 批: 关=隐藏多键操作明细
if(nadeN._t!==v){ nadeN._t=v; nadeN.textContent=v; } }
// ③ 舰体血量 + 吃水/水深 + 航速 面板
const pn=navalPanelEnsure();
const frac=Math.max(0,Math.min(1,(c.hp||0)/(c.maxHp||c.hp||1)));
if(pn.wrap.style.display!=='block') pn.wrap.style.display='block';
if(pn.bar){ const wv=(frac*100)+'%'; if(pn.bar._lw!==wv){ pn.bar._lw=wv; pn.bar.style.width=wv; }
const bg=frac>0.5?'#9fd89f':(frac>0.25?'#e0c080':'#e07060'); if(pn.bar._lb!==bg){ pn.bar._lb=bg; pn.bar.style.background=bg; } }
if(pn.name){ const v=t2('舰体'); if(pn.name._t!==v){ pn.name._t=v; pn.name.textContent=v; } }
if(pn.num){ const v=Math.max(0,Math.ceil(c.hp||0))+' / '+Math.round(c.maxHp||0); if(pn.num._t!==v){ pn.num._t=v; pn.num.textContent=v; } }
const draft=(c.draftNow&&typeof c.draftNow==='function')?c.draftNow():((spec.draft0||0)+(c.flood||0)*0.5);   // 2026-09-26E 审计 9: 吃水单源 (15d draftNow)
const dep=Math.max(0,(typeof waterDepthAt==='function')?waterDepthAt(c.pos.x,c.pos.z):0);
if(pn.info){ const v=t2('吃水 {0}m · 水深 {1}m',draft.toFixed(2),dep.toFixed(1)); if(pn.info._t!==v){ pn.info._t=v; pn.info.textContent=v; } }
let spd=t2('航速')+' '+Math.abs(c.vel||0).toFixed(1)+' m/s';
if(c.state==='ground') spd+=' · '+t2('⚠ 搁浅! 倒车脱困');
else if((c.flood||0)>0.35||c.state==='sinking') spd+=' · '+t2('⚠ 进水! 舰体正在下沉');
if(pn.spd&&pn.spd._t!==spd){ pn.spd._t=spd; pn.spd.textContent=spd; }
}
// ── ④ 每帧 HUD tick (由 20-player 的 updatePlayer 调用, 与玩家生死无关) ──
// ① 反舰炮台摧毁播报: BATTERIES 存活位 true→false 的首帧播报一次 (键已存在); 首见只记账不播报。
// ② 面板兜底: 不在驾驶位却还开着 → 收起 (下艇跨出完成/阵亡/换局都会走到这里)。
const _navalBatAlive={};
function navalHudTick(dt){
if(typeof BATTERIES!=='undefined'&&Array.isArray(BATTERIES)){
for(let i=0;i<BATTERIES.length;i++){
const b=BATTERIES[i]; if(!b) continue;
const alive=!!b.alive, prev=_navalBatAlive[i];
_navalBatAlive[i]=alive;
if(prev===undefined||prev===alive) continue;
if(prev&&!alive&&typeof showScorePop==='function') showScorePop('💥 '+t('反舰炮台已摧毁'));
}
}
if(!player.onNaval){
let open=false;
if(_navalPanel&&_navalPanel.wrap&&_navalPanel.wrap.style.display==='block') open=true;
const amp=document.getElementById('ammoPanel');
if(open){ _navalPanel.wrap.style.display='none'; if(amp) amp.style.display=''; }
// 座位态兜底 (与上面同一条纪律): 不在驾驶位却还留着炮手镜开关 ⇒ 清掉 ——
// 23-deploy 的部署复位不在本轮写入域, 这里是"任何复位路径漏掉时"的最后一道闸 (下艇/阵亡/换局都会走到)。
if(player.navalGun) player.navalGun=false;
}
}
// ── ⑤ 对局退场: 海战实体 (包装 retireMatchActors, 基函数一行不动) ──
// 为什么需要: 既有 retireMatchActors 只清 soldiers/tanks/planes/trucks。海战载具必须**同段**完成四件事 ——
//   ① grp 从场景摘除 (2026-09-17 世界还原批的坑: 只清表不摘场景 ⇒ 第二局出现上一局的幽灵实体);
//   ② 车组解绑 (那条 Bot 复活后不能还以为自己在一台已退场的艇上);
//   ③ 动态碰撞体 wreckBs 走 killDynCollider (沉没残骸/船体推挤框, 15-vehicles 的既有回收口径);
//   ③b 引擎声收尾 (2026-09-20N 海战音效批): 活着的艇在退场时引擎句柄还在 engines 表里 ——
//       不走 engine.stop() 就会留一台"上一局的发动机"在响/占节点; 这里与摘 grp 同段停掉并置空
//       (15d 的全部 engine 调用点都带 if(this.engine) 守卫, 置空安全).
//   ④ 表清空 navalCraft.length=0 (主循环每帧全扫它, 不清会一路累加) —— 与 tanks.length=0 同一段语义。
// 另外清空在途鱼雷表 (torpedoes), 并按玩家座位交还 (player.onNaval 不能悬空).
const _navalBaseRetire=retireMatchActors;
retireMatchActors=function(){
_navalBaseRetire.apply(this,arguments);
try{
if(player.onNaval&&typeof navalSeatRelease==='function') navalSeatRelease();
if(typeof navalCraft!=='undefined'&&Array.isArray(navalCraft)){
for(const c of navalCraft){
if(!c) continue;
c.alive=false; c.playerDriven=false;
const cb=c.driverBot||c.crewBot;
if(cb){ if(cb.onVehicle===c) cb.onVehicle=null; if(cb.onNaval===c) cb.onNaval=null; }
c.driverBot=null; if(c.crewBot) c.crewBot=null;
if(c.wreckBs){ for(const b of c.wreckBs) if(typeof killDynCollider==='function') killDynCollider(b); c.wreckBs=null; }
if(c.engine){ try{ c.engine.stop(); }catch(e){} c.engine=null; }
if(c.grp&&c.grp.parent) c.grp.parent.remove(c.grp);
}
navalCraft.length=0;
}
if(typeof torpedoes!=='undefined'&&Array.isArray(torpedoes)) torpedoes.length=0;
// (2026-11-10: 大舰复位/炮位交还块随大舰子系统下架摘除)
}catch(e){ console.error('[海战] 对局退场清理失败',e); }
};

// ═════════════════════════════════════════════════════════════════════════════
// 【追加段二】2026-09-21 批次 A (契约 B/E): 记分板乘员行 / 跳伞与幽灵坦克清理点 / 载具热量复位
//
// 与上一批 (2026-09-20N 海战) 同一纪律: 这两个被他文件拥有的函数**不改函数体**, 只在此**包一层**,
// 保证 git diff 对 22-hud.js 仍是可逐行核对的纯增量、且 21-match / 20-player 的既有实现一字不动。
//
// ── ① 记分板坦克乘员行显示 "坦克名·乘员" (契约B §4) ──
// 记分板本体在 21-match.js 的 updateScoreboard (不在本批任何人的写入域), 故这里**懒包装**: updateHUD
// 每帧调一次 seahudScoreboardHook, 首次发现 updateScoreboard 存在即包上并置幂等闸 —— 21-match 在本文件
// 之前加载 (index.html:343→344) 时第一次调用即装上; 沙箱里脚本顺序不同也不会漏 (顺序无关)。
// 行内容不重写: 只按**同一排序规则**重算一遍 combatants 列表, 按行号把第一格改成 "车名·乘员名" ——
// 击杀/阵亡/得分三列与 21-match 的排版仍由原函数产出, 因此不存在第二份记分板实现 (零漂移)。
function seahudTankOf(c){
if(!c) return null;
if(c.onVehicle&&c.onVehicle.kind==='tank') return c.onVehicle;   // 坦克乘员 (驾驶员共用)
for(const t of tanks){                                            // 兜底: 从坦克侧反查编制
if(!t) continue;
if(t.crewBot===c) return t;
// 2026-09-21 A#7 契约 v3: 原 t.crewMates 兜底读已随"真 Bot 编制"作废删除 ——
//   车内 3 人 = 1 名真人驾驶员 (crewBot / 玩家) + 2 个**轻量乘员名额** (crewSlots),
//   名额**不进 combatants** (否则会被索敌/被子弹命中), 所以这里不可能出现"名额当 c 传进来"的情形;
//   真驾驶员的识别由上一行 t.crewBot===c 与 crewRoster() 兜底共同保证 (crewRoster 现为 3 人口径)。
if(typeof t.crewRoster==='function'){ try{ const r=t.crewRoster(); if(r&&r.indexOf(c)>=0) return t; }catch(e){} }
}
return null;
}
function seahudScoreboardCrewTag(){
if(typeof combatants==='undefined'||typeof tanks==='undefined') return;
for(const [team,tb] of [[0,'sbL'],[1,'sbR']]){
const body=el(tb);
if(!body||!body.children) continue;
const list=combatants.filter(c=>c.team===team);
list.sort((a,b)=>(b.score||0)-(a.score||0));      // 与 21-match.updateScoreboard 同序 (稳定排序, 同式比较器)
const rows=body.children;
for(let i=0;i<list.length&&i<rows.length;i++){
const c=list[i];
if(!c||c.isPlayer) continue;
const tk=seahudTankOf(c);
if(!tk) continue;
const td=rows[i].firstElementChild;
if(!td) continue;
const lab=t2(tk.name)+'·'+(c.name||t2('乘员'));   // 空名乘员退化为"坦克名·乘员", 不再是空格子
if(td.textContent!==lab) td.textContent=lab;
}
}
}
let _sbCrewHooked=false;
function seahudScoreboardHook(){
if(_sbCrewHooked) return;
if(typeof updateScoreboard!=='function') return;   // 21-match 未加载 (部分沙箱) ⇒ 下次再试
_sbCrewHooked=true;
const base=updateScoreboard;
updateScoreboard=function(){
base.apply(this,arguments);
try{ seahudScoreboardCrewTag(); }catch(e){}
};
}
seahudScoreboardHook();   // 正常加载顺序下 (22-hud 在 21-match 之后) 这里就装好

// ── ② 对局退场清理点 (契约E §7): 幽灵坦克实体 + 全部 chuteMesh + 载具 heat/heatLock 复位 ──
// 包装顺序很关键: ①先扫(此时 soldiers/tanks/navalCraft 都还在) ②调基函数 (海战包装 → 原 retireMatchActors,
// 它会把各表清空并摘大量场景对象) ③收尾(幽灵坦克)。
// 为什么要先扫: 原 retireMatchActors 第一段就 `soldiers.length=0; tanks.length=0` —— 表清空后再想
// "逐个摘伞/复位热量"就找不到对象了。伞与热量都是**实例字段**, 场景对象被摘掉并不等于字段被清干净。
const _seahudBaseRetire=retireMatchActors;
retireMatchActors=function(){
// ① 退场前: Bot 伞模型 + 载具热量复位
try{
if(typeof soldiers!=='undefined'&&Array.isArray(soldiers)){
for(const s of soldiers){
if(!s) continue;
if(s.chuteMesh){ try{ if(s.chuteMesh.parent) s.chuteMesh.parent.remove(s.chuteMesh); }catch(e){} s.chuteMesh=null; }
if(s.chuting) s.chuting=false;
}
}
if(typeof combatants!=='undefined'&&Array.isArray(combatants)){
for(const c of combatants){
if(!c||c.isPlayer) continue;
if(c.chuteMesh){ try{ if(c.chuteMesh.parent) c.chuteMesh.parent.remove(c.chuteMesh); }catch(e){} c.chuteMesh=null; }
if(c.chuting) c.chuting=false;
}
}
// 载具机枪热量 (契约A 的 heat/heatLock): 下一局是同一个实例对象复用时不得带着上一局的热量
if(typeof tanks!=='undefined'&&Array.isArray(tanks)) for(const t of tanks){ if(!t) continue; t.heat=0; t.heatLock=false; }
if(typeof navalCraft!=='undefined'&&Array.isArray(navalCraft)) for(const c of navalCraft){ if(!c) continue; c.heat=0; c.heatLock=false; }
// 玩家伞: 标志 + 模型 (playerChuteClear 由 infantry 在 20-player.js 提供, typeof 守卫)
if(typeof player!=='undefined'&&player){
player.chute=false;
if(typeof playerChuteClear==='function') playerChuteClear();
}
}catch(e){ console.warn('[换局] 伞/热量清理失败, 已继续:',e&&e.message); }
_seahudBaseRetire.apply(this,arguments);
// ② 退场后: 幽灵坦克实体 (契约C §5: 不留残骸/不排重生)。基函数已调过 specVehReset; tank-core 本批新增的
// specVehStow 语义更全 (摘 grp + 停引擎 + SPECVEH=null + 解绑), 存在时再走一遍 (幂等)。
try{
if(typeof specVehStow==='function') specVehStow();
else if(typeof specVehReset==='function') specVehReset();
}catch(e){ console.warn('[换局] 幽灵坦克收车失败, 已继续:',e&&e.message); }
};

// ═════════════════════════════════════════════════════════════════════════════
// 【追加段 2026-09-25】水下滤镜的"离场复位" clearUnderwaterFx
//
// 背景 (实机可达): 玩家潜水时按 Esc → 返回主界面。冻结分支 (24-main: gamePaused||matchOver||menuHold)
// 在 updateUnderwaterFx 之前 return, 而菜单航拍仍用同一台相机渲染真实场景 ⇒ 场景一直挂着水下近雾
// (fog 0.15 / 9~21m + 0x18485c), 菜单背景就成了整片蓝绿; _uwOn 也残留到下一局 (憋气 HUD/低通同理)。
//
// 这里把 updateUnderwaterFx 的三项状态一次还原到"水面之上": 雾色/远近裁 + 全屏滤镜 + 音频低通。
// 基准值仍是入水那一刻采样的 _uwBase (与出水还原同源, 不另采) —— 本函数不动 updateUnderwaterFx 本体
// (该文件是共享大文件, 只追加), 也不改它的判据: 复位后若相机仍在水中, 下一帧 updateUnderwaterFx
// 会当成"重新入水"再采一次基准, 数值不变 (幂等)。
function clearUnderwaterFx(){
const ov=document.getElementById('uwOv');
const op=ov?(ov._op||0):0;
if(!_uwOn&&!_uwBase&&op===0) return;   // 稳态: 主菜单每帧调用也不做事
if(ov){ ov._op=0; ov.style.opacity=0; }
if(_uwBase&&scene&&scene.fog){
try{
const h=_uwBase.c;
if(h!==null&&h!==undefined){
if(scene.fog.color.setHex) scene.fog.color.setHex(h);
else if(scene.fog.color.set) scene.fog.color.set(h);
}
if(typeof _uwBase.n==='number') scene.fog.near=_uwBase.n;
if(typeof _uwBase.f==='number') scene.fog.far=_uwBase.f;
}catch(e){}
}
if(typeof AudioSys!=='undefined'&&AudioSys.setUnderwater) AudioSys.setUnderwater(false);
_uwOn=false; _uwBase=null;
}

// ═════════ 自由观战视模式 HUD (2026-11-01) ═════════
// 视模式 (player.specView, 20-player enterSpecView 单源入口) 每帧由 24-main 调一次:
//   ① 战斗 HUD 收起 (准星/弹匣/血条/交互提示/枪管热/命中标/雷弧/镜筒遮罩) —— 视模式无武器无交互;
//      小地图/罗盘/击杀播报保留 (观战要用的信息面)。
//   ② 顶部悬浮指示器: 附身态 = Bot 名 + 阵营 + 武器/弹药只读读数 (用户裁定"带 Bot 的战斗 HUD"),
//      自由态 = 操作提示。仅在内容变化时写 DOM (与 coldHudShow 同一状态键纪律)。
// OFF 时 display='' 还原 —— 部署页/结算/新对局自动回到常规 HUD, 不需要逐个元素记账。
let _svHudOn=false, _svHudPos=false, _svInd=null;
const _SV_HUD_HIDE=['crosshair','hitmark','nadeArc','ammoPanel','healthPanel','interact','heatWrap','scopeOv'];
// 附身中的收起清单 (2026-11-01 真附身批, 用户裁定"要显示血条、弹药、准星、命中反馈等玩家有的HUD"):
// 战斗 HUD 全量保留 (读数已换宿主心, updateHUD _hv), 只收"本体动作类"面板 —— 雷弧/交互提示/镜筒/枪械热量。
const _SV_HUD_HIDE_POS=['nadeArc','interact','scopeOv','heatWrap'];
// 全屏层开着的判定 (★2026-11-02 实机修复): .screen 四件 (menu/deploy/end/pauseOv) 是静态集合, 建一次缓存表
// 逐帧查 hidden 类 (零分配纪律, 不每帧 querySelector); gamePaused 单独查旗 (togglePause 会先隐藏全部 .screen
// 再单独亮 pauseOv, 类与旗理论上同相, 双判据兜时序)。重部署页/暂停罩/结算页任一开着 ⇒ 指示器收起。
let _svScreens=null;
function _svOverlayOpen(){
if(typeof gamePaused!=='undefined'&&gamePaused) return true;
if(!_svScreens&&document.querySelectorAll) _svScreens=Array.prototype.slice.call(document.querySelectorAll('.screen'));
if(_svScreens){
for(let i=0;i<_svScreens.length;i++){ const s=_svScreens[i]; if(s&&!s.classList.contains('hidden')) return true; }
}
return false;
}
// 指示器显示单源 (显示+按罗盘实测底边重定位)。2026-11-02 从进位 show 分支提出 —— 重部署/暂停罩**关闭后**
// 的逐帧再显也要走同一条定位, 否则只能恢复到进位前的旧 top。
function _svIndShow(){
if(!_svInd) return;
_svInd.style.display='block';
// ★2026-11-02 实机修复: 固定 top:84px 会压住罗盘条 (顶栏内容高度随战况横幅浮动) —— 显示时按罗盘
// 实测底边重定位到其下 10px (沙箱/量不到时保持 CSS 兜底值)。
const _cp=document.getElementById('compass');
if(_cp&&typeof _cp.getBoundingClientRect==='function'){
const _r=_cp.getBoundingClientRect();
if(_r&&_r.height>0) _svInd.style.top=(Math.round(_r.bottom)+10)+'px';
}
}
function specViewHudTick(){
const pos=!!player.specViewHost;   // 附身中 (调试/视模式共用一条管线)
const on=!matchOver&&(pos||(player.specView&&!player.alive));   // 视模式全程 / 附身中 (2026-11-01); ★2026-11-22b: 终局即收 —— endMatch 起 matchOver 冻结主循环, 若不在此档掉, 结算 0.9s 空窗指示条还挂着, 且冻结分支的补喂帧 (24-main) 全靠本谓词出迁移把指示条收掉 (结算页/主菜单不再残留)
if(on!==_svHudOn||pos!==_svHudPos){
_svHudOn=on; _svHudPos=pos;
for(let i=0;i<_SV_HUD_HIDE.length;i++){
const e2=document.getElementById(_SV_HUD_HIDE[i]); if(e2) e2.style.display='';
}
if(on){
const L=pos?_SV_HUD_HIDE_POS:_SV_HUD_HIDE;
for(let i=0;i<L.length;i++){
const e2=document.getElementById(L[i]); if(e2) e2.style.display='none';
}
if(!_svInd){ _svInd=document.createElement('div'); _svInd.id='specViewInd'; document.body.appendChild(_svInd); }
_svInd._h=null;
_svIndShow();
}else if(_svInd){ _svInd.style.display='none'; }
}
if(!on||!_svInd) return;
// ★2026-11-02 实机修复: 指示器挂在 body 上 (z-index:40), 高于全屏层 .screen (z-index:20) ——
// 重部署页/暂停罩/结算页开着时会压在图层上方 (用户实机报)。全屏层任一开着就收起, 关闭后下一帧
// 自然回来。这里只动 display, 面板收起账 (_svHudOn/_svHudPos) 不动 —— #ui 内的 HUD 本就被 .screen 盖住。
if(_svOverlayOpen()){ if(_svInd.style.display!=='none') _svInd.style.display='none'; return; }
if(_svInd.style.display!=='block') _svIndShow();
const h=player.specViewHost;
let html;
if(h&&h.alive){
const w=(typeof svHostCurSlot==='function')?svHostCurSlot(h):((h.slots&&h.slots[0])?h.slots[0]:null);   // 宿主当前武器 (2026-11-04): 跟随 heldWpnKey, 不再钉死主武器
const wn=w?w.def?t(w.def.name):w.key:'—';
const _tn=TEAM_NAME[h.team]?t(TEAM_NAME[h.team]):(h.team===2?t('丧尸'):'?');   // 丧尸队 (ZTEAM=2) 不在 TEAM_NAME 里
html=t('👁 附身 · {0} ({1}) · {2} {3}/{4} · {5}',(h.name?t(h.name):'Bot'),_tn,wn,(w?w.mag:'-'),(w?w.reserve:'-'),player.specView?t('右键脱离'):t('E 脱离'));   // 脱离键两模式不同 (视模式=右键 / 调试=E), 2026-11-02
}else{
html=t('👁 自由观战 · {0}m/s · 滚轮调速 · 左键附身Bot · Q/E切换 · 右键脱离',Math.round(clamp(player.specViewSpd||14,3,90)));
}
if(_svInd._h!==html){ _svInd._h=html; _svInd.innerHTML=html; }
}
