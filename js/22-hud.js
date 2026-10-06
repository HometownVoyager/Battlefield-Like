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
if(WX_MM_NEAR<=0) return true;
if(player.spectator||!player.alive) return true;
const dx=x-player.pos.x, dz=z-player.pos.z;
if(dx*dx+dz*dz<WX_MM_NEAR*WX_MM_NEAR) return true;
return lastFire!==undefined&&lastFire>-90&&nowT-lastFire<WX_MM_FIRE;
}
function drawMinimap(){
const S=190, half=S/2, range=90*Math.max(1,Math.sqrt((CAMPAIGN.mapSize||320)/320));
mmC.clearRect(0,0,S,S);
mmC.save();
mmC.beginPath(); mmC.arc(half,half,half-2,0,TAU); mmC.clip();
mmC.fillStyle='rgba(24,32,18,.9)'; mmC.fillRect(0,0,S,S);
const cx=player.alive?player.pos.x:0, cz=player.alive?player.pos.z:0;
const rot=player.alive?player.yaw:0;
const toMap=(x,z)=>{
let dx=x-cx, dz=z-cz;
const c=Math.cos(rot), s=Math.sin(rot);
const rx=dx*c-dz*s, rz=dx*s+dz*c;
return [half+rx/range*half, half+rz/range*half];
};
mmC.strokeStyle='rgba(150,130,90,.4)'; mmC.lineWidth=5;
// 环礁海域 + 珊瑚跑道 (语义分区): 先铺海面分带 (陆上要素随后覆盖)
if(SEA){ drawSeaBands(toMap,mmC,MAP_SIZE/2+80); drawRunway(toMap,mmC); }
if(CAMPAIGN.sineRoad){
mmC.beginPath();
for(let x=-(MAP_SIZE/2-5);x<=MAP_SIZE/2-5;x+=10){ // 2026-09-06 B7a/P2-11/12: 旧写死 ±155 与公式复制
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
// 城市街道 (语义分区): 旋转坐标系下映射 4 角画多边形 —— 小地图读出街廊网格
if(CAMPAIGN.city){
mmC.fillStyle='rgba(175,175,165,.4)';
for(const s of CAMPAIGN.city.streets){
mmC.beginPath();
const cs2=[[s.x0,s.z0],[s.x1,s.z0],[s.x1,s.z1],[s.x0,s.z1]];
for(let i=0;i<4;i++){ const [px,py]=toMap(cs2[i][0],cs2[i][1]); i===0?mmC.moveTo(px,py):mmC.lineTo(px,py); }
mmC.closePath(); mmC.fill();
}
}
// 庄稼田块 (软遮蔽区): 旋转坐标系下须映射4角画多边形
if(CROP_FIELDS.length){
mmC.fillStyle='rgba(160,185,95,.35)';
for(const cf of CROP_FIELDS){
mmC.beginPath();
const [a0,b0]=toMap(cf.x0,cf.z0),[a1,b1]=toMap(cf.x1,cf.z0),[a2,b2]=toMap(cf.x1,cf.z1),[a3,b3]=toMap(cf.x0,cf.z1);
mmC.moveTo(a0,b0); mmC.lineTo(a1,b1); mmC.lineTo(a2,b2); mmC.lineTo(a3,b3);
mmC.closePath(); mmC.fill();
}
}
// 河道与大桥: 标出激流屏障和通道 (主河 + 淞沪支流 + 多桥)
if(RIVER){
mmC.strokeStyle='rgba(70,110,150,.8)'; mmC.lineWidth=7;
mmC.beginPath();
RIVER.pts.forEach((pt,i)=>{
const [px,py]=toMap(pt[0],pt[1]);
i===0?mmC.moveTo(px,py):mmC.lineTo(px,py);
});
mmC.stroke();
// 徒涉滩 (胡康 ford, 2026-09-12 巨桥改版): 浅青白虚线圈 = 可涉渡口 (旋转不变圆, 免算河向)
if(RIVER.ford){
const F=RIVER.ford, [fx,fy]=toMap(F.x,F.z);
mmC.strokeStyle='rgba(205,230,240,.95)'; mmC.lineWidth=2.5;
mmC.setLineDash([4,3]);
mmC.beginPath(); mmC.arc(fx,fy,Math.max(6,F.r/range*half*0.8),0,TAU); mmC.stroke();
mmC.setLineDash([]);
}
}
// 支流汊港 (淞沪): 细蓝线
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
// 鱼塘/藕塘 (淞沪): 色块 + 丝厂地标标记
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
// 丝厂: 棕色方块 + "丝"
mmC.fillStyle='rgba(160,100,70,.85)';
mmC.fillRect(px-5,py-5,10,10);
mmC.fillStyle='#fff'; mmC.font='bold 8px sans-serif'; mmC.textAlign='center';
mmC.fillText('丝',px,py+3);
}
// 多桥: 每座画一段桥位线
if(typeof BRIDGES!=='undefined'&&BRIDGES.length){
mmC.strokeStyle='#d8c890'; mmC.lineWidth=5;
for(const B of BRIDGES){
const bx=Math.sin(B.yaw)*(B.len/2), bz=Math.cos(B.yaw)*(B.len/2);
const [ax,ay]=toMap(B.x-bx,B.z-bz), [bx2,by2]=toMap(B.x+bx,B.z+bz);
mmC.beginPath(); mmC.moveTo(ax,ay); mmC.lineTo(bx2,by2); mmC.stroke();
}
}
// 百团沟壑 (语义分区, 2026-09-12 补画——README 漂移修正): 沟壑赭色带 + 坡道堑口浅色通道线
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
// 雾林守线语义 (2026-09-13 许特根改版): 北谷灰蓝带 + 堑口浅色通道 + 西墙深灰双线 (缺口留白)
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
// 草原遭遇语义 (2026-09-13 库尔斯克改版): 纵贯铁路 + 东带防线双线 (缺口留白) + 雷区赭点带
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
for(const f of FLAGS){
const [px,py]=toMap(f.x,f.z);
mmC.beginPath(); mmC.arc(px,py,10,0,TAU);
mmC.fillStyle=f.owner===0?'rgba(90,140,220,.75)':f.owner===1?'rgba(220,110,90,.75)':'rgba(160,160,150,.6)';
mmC.fill();
if(f.capTeam!==-1&&f.cap>0.03){
mmC.beginPath(); mmC.arc(px,py,12,-HPI,-HPI+f.cap*TAU);
mmC.strokeStyle='#fff'; mmC.lineWidth=2; mmC.stroke();
}
mmC.fillStyle='#fff'; mmC.font=f.id.length>1?'bold 8px sans-serif':'bold 11px sans-serif'; mmC.textAlign='center';
mmC.fillText(f.id,px,py+(f.id.length>1?3:4));
}
for(const s of soldiers){
if(!s.alive||s.onVehicle) continue;
const [px,py]=toMap(s.pos.x,s.pos.z);
if(px<0||py<0||px>S||py>S) continue;
if(s.team===player.team){
mmC.fillStyle='#7dd87d';
mmC.beginPath(); mmC.arc(px,py,2.5,0,TAU); mmC.fill();
}else{
// 全部敌人实时显示 (2026-09-06 用户指定: 原仅开火后 2.5s 显形); 夜档改回"开火显形+近距常显" (R3)
if(!mmEnemyVis(s.pos.x,s.pos.z,s.lastFiredT)) continue;
mmC.fillStyle='#ff5040';
mmC.beginPath(); mmC.arc(px,py,3,0,TAU); mmC.fill();
}
}
// 强点 (遭遇/劫道无旗点战役): 菱形颜色=当前归属 (中立灰, 被争夺金描边) —— 草原库尔斯克改版
for(const [si,sp] of (CAMPAIGN.spawns||[]).entries()){
const [px,py]=toMap(sp.x,sp.z);
if(px<-8||py<-8||px>S+8||py>S+8) continue;
const own=(typeof SPOTS!=='undefined'&&SPOTS[si])?SPOTS[si].own:sp.team;
const contested=typeof SPOTS!=='undefined'&&SPOTS[si]&&SPOTS[si].capTeam!==-1;
mmC.save(); mmC.translate(px,py); mmC.rotate(HPI/4);
mmC.fillStyle=own===0?'rgba(90,140,220,.8)':own===1?'rgba(220,110,90,.8)':'rgba(150,146,138,.8)';
mmC.fillRect(-3.5,-3.5,7,7);
mmC.strokeStyle=contested?'#ffd77a':'#fff'; mmC.lineWidth=contested?1.6:1;
mmC.strokeRect(-3.5,-3.5,7,7);
mmC.restore();
}
for(const n of nades){
const [px,py]=toMap(n.pos.x,n.pos.z);
mmC.fillStyle='#ffd050'; mmC.fillRect(px-1.5,py-1.5,3,3);
}
// 小队进攻标记
if(SQUAD.mode==='move'&&SQUAD.members.length){
const [px,py]=toMap(SQUAD.pos.x,SQUAD.pos.z);
mmC.fillStyle='#ffd75a';
mmC.beginPath(); mmC.moveTo(px,py+5); mmC.lineTo(px-4,py-3); mmC.lineTo(px+4,py-3); mmC.closePath(); mmC.fill();
}
for(const t of tanks){
if(!t.alive) continue;
const [px,py]=toMap(t.pos.x,t.pos.z);
if(px<-8||py<-8||px>S+8||py>S+8) continue;
if(t.team!==player.team&&!mmEnemyVis(t.pos.x,t.pos.z,t.crew&&t.crew.lastFiredT)) continue; // 夜档: 敌载具同规 (R3)
mmC.fillStyle=t.team===0?'#6da5e8':'#e87a68';
mmC.fillRect(px-4,py-4,8,8);
mmC.strokeStyle='#fff'; mmC.lineWidth=1; mmC.strokeRect(px-4,py-4,8,8);
}
// 劫道车队: 黄色方块 (护运目标)
for(const t of trucks){
if(!t.alive) continue;
const [px,py]=toMap(t.pos.x,t.pos.z);
if(px<-8||py<-8||px>S+8||py>S+8) continue;
if(t.team!==player.team&&!mmEnemyVis(t.pos.x,t.pos.z)) continue; // 夜档: 敌方卡车同规 (无开火能力=只近距常显)
mmC.fillStyle='#ffd050';
mmC.fillRect(px-3.5,py-3.5,7,7);
mmC.strokeStyle='#554a20'; mmC.lineWidth=1; mmC.strokeRect(px-3.5,py-3.5,7,7);
}
// 断崖公路: 劫道方临时补给点 (限时存活期) 绿色小点
if(SUPPLY_POINTS.length){
for(const sp of SUPPLY_POINTS){
const [px,py]=toMap(sp.x,sp.z);
if(px<-8||py<-8||px>S+8||py>S+8) continue;
mmC.fillStyle='#52c878';
mmC.beginPath(); mmC.arc(px,py,3,0,TAU); mmC.fill();
}
}
for(const pl of planes){
if(!pl.alive) continue;
const [px,py]=toMap(pl.pos.x,pl.pos.z);
if(px<-8||py<-8||px>S+8||py>S+8) continue;
if(pl.team!==player.team&&!mmEnemyVis(pl.pos.x,pl.pos.z,Math.max(pl.crew?pl.crew.lastFiredT:-99,pl.crewBot?pl.crewBot.lastFiredT:-99))) continue; // 夜档: 敌机同规 (射手可能是机组 Bot 也可能是 crew 记账体, 取两侧时间戳最大)
mmC.save();
mmC.translate(px,py);
mmC.rotate(-(pl.yaw)+(player.alive?player.yaw:0)+Math.PI);
mmC.fillStyle=pl.team===0?'#9dc5f8':'#f8a898';
mmC.beginPath(); mmC.moveTo(0,-5); mmC.lineTo(4,4); mmC.lineTo(0,2); mmC.lineTo(-4,4); mmC.closePath(); mmC.fill();
mmC.restore();
}
if(player.alive){
mmC.save();
mmC.translate(half,half);
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
function drawBigMap(){
const c=el('bigmap').getContext('2d'), S=520;
c.clearRect(0,0,S,S);
c.fillStyle='#141a10'; c.fillRect(0,0,S,S);
// 全域比例: 缩放随地图尺寸 (同部署图 MH 口径)
const MH=MAP_SIZE/2+10;
const toM=(x,z)=>[S/2+x/MH*S/2, S/2+z/MH*S/2];
c.strokeStyle='rgba(150,130,90,.5)'; c.lineWidth=4;
// 环礁海域 + 珊瑚跑道 (语义分区, 2026-09-18): 先铺海面分带, 陆上要素随后覆盖
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
// 徒涉滩 (胡康 ford): 虚线圈=可涉渡口
if(RIVER.ford){
const F=RIVER.ford, [fx,fy]=toM(F.x,F.z);
c.strokeStyle='rgba(205,230,240,.95)'; c.lineWidth=3;
c.setLineDash([7,5]);
c.beginPath(); c.arc(fx,fy,F.r/MH*(S/2)*0.8,0,TAU); c.stroke();
c.setLineDash([]);
}
}
// 多桥: 每座画一段桥位线 (2026-09-12 巨桥改版: 单桥 BRIDGE → BRIDGES 循环, 双桥都要上大地图)
if(typeof BRIDGES!=='undefined'&&BRIDGES.length){
c.strokeStyle='#d8c890'; c.lineWidth=7;
for(const B of BRIDGES){
const bx=Math.sin(B.yaw)*(B.len/2), bz=Math.cos(B.yaw)*(B.len/2);
const [ax,ay]=toM(B.x-bx,B.z-bz), [bx2,by2]=toM(B.x+bx,B.z+bz);
c.beginPath(); c.moveTo(ax,ay); c.lineTo(bx2,by2); c.stroke();
}
}
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
for(const f of FLAGS){
const [px,py]=toM(f.x,f.z);
c.beginPath(); c.arc(px,py,13,0,TAU);
c.fillStyle=f.owner===0?'rgba(90,140,220,.85)':f.owner===1?'rgba(220,110,90,.85)':'rgba(150,150,140,.7)';
c.fill();
if(f.capTeam!==-1&&f.cap>0.03){
c.beginPath(); c.arc(px,py,15,-HPI,-HPI+f.cap*TAU);
c.strokeStyle='#fff'; c.lineWidth=2; c.stroke();
}
c.fillStyle='#fff'; c.font=f.id.length>1?'bold 9px sans-serif':'bold 13px sans-serif'; c.textAlign='center';
c.fillText(f.id,px,py+(f.id.length>1?3:4));
}
for(const [si,sp] of (CAMPAIGN.spawns||[]).entries()){
const own=(typeof SPOTS!=='undefined'&&SPOTS[si])?SPOTS[si].own:sp.team;
const contested=typeof SPOTS!=='undefined'&&SPOTS[si]&&SPOTS[si].capTeam!==-1;
const [px,py]=toM(sp.x,sp.z);
c.save(); c.translate(px,py); c.rotate(HPI/4);
c.fillStyle=own===0?'#4a70b0':own===1?'#b05a4a':'#9a968a';
c.fillRect(-6,-6,12,12);
if(contested){ c.lineWidth=2; c.strokeStyle='#ffd77a'; c.strokeRect(-7,-7,14,14); }
c.restore();
}
for(const s of soldiers){
if(!s.alive||s.onVehicle) continue;
const [px,py]=toM(s.pos.x,s.pos.z);
if(s.team===player.team){
c.fillStyle='#7dd87d';
c.beginPath(); c.arc(px,py,2.5,0,TAU); c.fill();
}else{
// 全部敌人实时显示 (2026-09-06 用户指定); 夜档同小地图 R3 规 (开火显形+近距常显)
if(!mmEnemyVis(s.pos.x,s.pos.z,s.lastFiredT)) continue;
c.fillStyle='#ff5040';
c.beginPath(); c.arc(px,py,3,0,TAU); c.fill();
}
}
for(const t of tanks){
if(!t.alive) continue;
const [px,py]=toM(t.pos.x,t.pos.z);
if(t.team!==player.team&&!mmEnemyVis(t.pos.x,t.pos.z,t.crew&&t.crew.lastFiredT)) continue; // 夜档: 敌载具同规
c.fillStyle=t.team===0?'#6da5e8':'#e87a68';
c.fillRect(px-4,py-4,8,8);
c.strokeStyle='#fff'; c.lineWidth=1; c.strokeRect(px-4,py-4,8,8);
}
for(const t of trucks){
if(!t.alive) continue;
const [px,py]=toM(t.pos.x,t.pos.z);
if(t.team!==player.team&&!mmEnemyVis(t.pos.x,t.pos.z)) continue; // 夜档: 敌方卡车同规
c.fillStyle='#ffd050';
c.fillRect(px-3.5,py-3.5,7,7);
c.strokeStyle='#554a20'; c.lineWidth=1; c.strokeRect(px-3.5,py-3.5,7,7);
}
for(const pl of planes){
if(!pl.alive) continue;
const [px,py]=toM(pl.pos.x,pl.pos.z);
if(pl.team!==player.team&&!mmEnemyVis(pl.pos.x,pl.pos.z,Math.max(pl.crew?pl.crew.lastFiredT:-99,pl.crewBot?pl.crewBot.lastFiredT:-99))) continue; // 夜档: 敌机同规
c.save(); c.translate(px,py); c.rotate(Math.PI-pl.yaw);
c.fillStyle=pl.team===0?'#9dc5f8':'#f8a898';
c.beginPath(); c.moveTo(0,-5); c.lineTo(4,4); c.lineTo(0,2); c.lineTo(-4,4); c.closePath(); c.fill();
c.restore();
}
// 观战专属载具「幽灵坦克」(2026-09-17 观战扩展批): 白色空心方块 (观战者一眼找到自己的车)
if(typeof specVehInfo==='function'){
const gv=specVehInfo();
if(gv&&gv.spawned){
const [px,py]=toM(gv.x,gv.z);
c.fillStyle='#ffffff'; c.fillRect(px-4,py-4,8,8);
c.strokeStyle='#20242a'; c.lineWidth=1.5; c.strokeRect(px-4,py-4,8,8);
}
}
// 巡飞弹 (TV制导中): 青色菱形实时位置 + 白心
if(player.loiter&&!player.loiter.dead){
const [px,py]=toM(player.loiter.pos.x,player.loiter.pos.z);
c.save(); c.translate(px,py); c.rotate(HPI/4);
c.fillStyle='#3ee8d8'; c.fillRect(-6,-6,12,12);
c.strokeStyle='#06332e'; c.lineWidth=1.5; c.strokeRect(-6,-6,12,12);
c.fillStyle='#fff'; c.fillRect(-1.5,-1.5,3,3);
c.restore();
}
// 玩家: 白色箭头 (地图北向固定, 箭头指向实际朝向)
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
const yaw=player.alive?player.yaw:0;
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
cpC.fillStyle=f.owner===0?'#8fc1ff':f.owner===1?'#ff9c8a':'#ccc';
cpC.font='bold 13px sans-serif';
cpC.fillText(f.id,x,13);
cpC.fillRect(x-1,18,2,5);
cpC.font='12px sans-serif';
}
cpC.fillStyle='#ffd77a'; cpC.fillRect(W/2-1,2,2,6);
}
let hudSlowT=0;
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
const NADE_ARC_RING_SEG=36, NADE_ARC_SPOT_R=0.45;   // 贴地圈分段数 / 精确弹着点圈半径 (m)
let _naDots=[], _naLastD={};
const _naP=V3(0,0,0), _naQ=V3(0,0,0);
function nadeArcFuseOf(type){ return type==='frag'?Math.max(0.1,player.nadeFuse):(type==='at'?1.6:(type==='smoke'?1.8:1.6)); }
function nadeArcRingR(type){ return type==='frag'?NADE_BLAST_R:(type==='at'?5.5:3); } // 圈=杀伤范围示意 (at=5.5 溅射圈/烟雾燃烧=云圈示意)
// 地表面高 (画圈用): 有水时画在水面上 —— 入水哑火点/浅水落点才不会把圈画到水底去
function nadeSurfY(x,z){
const gh=heightAt(x,z);
const wy=(typeof waterYAt==='function')?waterYAt(x,z):-1e9;
return (wy>-1e9&&wy>gh)?wy:gh;
}
// 世界点 → 屏幕像素 (null = 在身后/裁剪外): 圈与点串共用
function nadeProj(x,y,z){
_naP.set(x,y,z);
_naQ.copy(_naP).applyMatrix4(camera.matrixWorldInverse);
if(_naQ.z>-0.05) return null;                       // 相机空间: 前方为负 z
_naQ.copy(_naP).project(camera);
if(!(_naQ.z<=1)) return null;
const sx=(_naQ.x*0.5+0.5)*innerWidth, sy=(-_naQ.y*0.5+0.5)*innerHeight;
return (isFinite(sx)&&isFinite(sy))?{x:sx,y:sy}:null;
}
// 贴地圆环 → SVG path 数据 (任一点在身后即整环作废: 宁可不出圈, 不画半个假圈)
function nadeGroundRing(cx,cz,r){
let d='';
for(let i=0;i<NADE_ARC_RING_SEG;i++){
const a=i/NADE_ARC_RING_SEG*TAU, x=cx+Math.cos(a)*r, z=cz+Math.sin(a)*r;
const s=nadeProj(x,nadeSurfY(x,z)+0.06,z);
if(!s) return null;
d+=(i?'L':'M')+s.x.toFixed(1)+' '+s.y.toFixed(1);
}
return d+' Z';
}
function naSet(id,attr,v){
const k=id+'.'+attr;
if(_naLastD[k]===v) return;
_naLastD[k]=v;
const e=el(id); if(!e) return;
if(attr==='display') e.style.display=v; else e.setAttribute(attr,v);
}
function updateNadeArc(){
const box=el('nadeArc');
const on=player.alive&&!matchOver&&!player.spectator&&typeof VM!=='undefined'&&VM.state==='nade'&&player.nadeHeld&&typeof NADE_THROW!=='undefined';
if(!on){ if(box.style.display!=='none') box.style.display='none'; return; }
box.style.display='block';
const type=vmNadeKind();                                    // 弹种单源 (10-viewmodel): 与手上模型/releaseNade 分流同一判序
const T=NADE_THROW[type];
// 出手点/方向单源 (2026-09-30 批2): 20-player playerThrowOrigin/playerThrowDir —— 与 releaseNade 逐字同源。
// 旧版这里与 releaseNade 各写一遍 "camera.position + camForward", 起点落在相机轴线上 ⇒ 弹道在屏幕上投影成
// 一条穿过准星的直线 (用户报"就是一条线段"/"三人称与一人称完全一致"); 现在起点在右手, 有视差。
const o=playerThrowOrigin();
const dir=playerThrowDir(o);
const vel=dir.clone().multiplyScalar(T.v); vel.y+=T.up; vel.addScaledVector(player.vel,0.4);
// 与实弹同一积分器 (13-combat nadeStep 单源): 预演即实弹弹道
const st={pos:o.clone(),vel,fuse:nadeArcFuseOf(type),armOnFuse:!!NADE_ARMED_BY_FUSE[type],
at:type==='at',team:player.team,thrower:player,spin:null};
const pts=[];
let land=null, fizzled=false;
for(let i=0;i<NADE_ARC_MAXSTEP;i++){
const ev=nadeStep(st,NADE_ARC_STEP);
if(ev==='blow'||ev==='fizzle'){
fizzled=(ev==='fizzle');
land=st.pos.clone(); break;
}
if(pts.length<NADE_ARC_MAXDOT&&i*NADE_ARC_STEP>=NADE_ARC_PT_DT*(pts.length+1)) pts.push(st.pos.clone());
}
if(!land) land=st.pos.clone();   // 兜底: 模拟窗内没炸 (理论上不会 —— 引信到点后触地必炸)
// ① 弹道点串
let used=0;
for(const pt of pts){
const s=nadeProj(pt.x,pt.y,pt.z);
if(!s) continue;
let d=_naDots[used];
if(!d){ d=document.createElement('div'); d.className='na'; box.appendChild(d); _naDots[used]=d; }
d.style.left=s.x.toFixed(1)+'px'; d.style.top=s.y.toFixed(1)+'px'; d.style.display='block';
used++;
}
for(let i=used;i<_naDots.length;i++) if(_naDots[i].style.display!=='none') _naDots[i].style.display='none';
// ② 落点: 贴地爆圈 + 精确弹着点小圈 + 中心点 —— **总是画** (2026-09-30 批2 用户裁定:
//   "总是画地面落点范围")。普通手雷现在没有空炸 (引信到点+接触双条件, 见 00-config 触发引信注),
//   唯一的"爆点在半空"是**撞到敌兵躯干**那一档: 那时地面圈照画 (它标的是爆点正下方的地面范围),
//   另叠一个空炸环把真实爆点标出来。入水哑火档 (深水) 加 .naWater 降档着色 —— 雷不炸, 只标落点。
const gy=nadeSurfY(land.x,land.z);
const air=(land.y>gy+0.25);                       // 撞敌: 真实爆点在半空
if(fizzled){ if(box.className.indexOf('naWater')<0) box.className='naWater'; }
else if(box.className) box.className='';
const db=nadeGroundRing(land.x,land.z,nadeArcRingR(type));
if(db){ naSet('naBlast','d',db); naSet('naBlast','display','block'); } else naSet('naBlast','display','none');
const ds=nadeGroundRing(land.x,land.z,NADE_ARC_SPOT_R);
if(ds){ naSet('naSpot','d',ds); naSet('naSpot','display','block'); } else naSet('naSpot','display','none');
const s=nadeProj(land.x,nadeSurfY(land.x,land.z)+0.06,land.z);
if(s){ naSet('naDot','cx',s.x.toFixed(1)); naSet('naDot','cy',s.y.toFixed(1)); naSet('naDot','display','block'); }
else naSet('naDot','display','none');
if(air){
const sa=nadeProj(land.x,land.y,land.z);
if(sa){ naSet('naAir','cx',sa.x.toFixed(1)); naSet('naAir','cy',sa.y.toFixed(1)); naSet('naAir','display','block'); }
else naSet('naAir','display','none');
} else naSet('naAir','display','none');
}
function updateHUD(dt){
seahudScoreboardHook(); // 契约B (2026-09-21 A#7): 幂等懒包装 updateScoreboard (实现在 21-match.js, 见文件末尾追加段)
if(typeof updateDirHits==='function') updateDirHits(); // 受击方向弧逐帧随玩家朝向重算 (2026-09-29; 21-match 实现)
updateNadeArc(); // 手雷预瞄抛物线逐帧重算 (2026-09-30 批; 持雷瞄准期才显示, 内部自带显隐对账)
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
// 观战专属载具「幽灵坦克」(2026-09-17 观战扩展批): 不显示装甲血条 (免伤), 明写免伤/穿透口径
if(player.onVehicle&&player.onVehicle.kind==='ghost'){
const t=player.onVehicle;
el('wname').textContent=t2(t.name);
el('wmode').textContent=t2('观战载具 · 免伤 · 不被索敌 · 弹丸穿透');
el('magN').textContent=t.cannonCd<=0?t2('就绪'):t.cannonCd.toFixed(1);
el('magN').style.color=t.cannonCd<=0?'#9fd89f':'#e0c080';
el('resN').textContent=t2('无差别火力');
el('nadeN').textContent=t2('主炮[左键] · 机枪[右键] · 车长镜[C] · 下车[F]');
} else if(player.onVehicle&&player.onVehicle.kind==='plane'){
const t=player.onVehicle;
el('wname').textContent=t2(t.name);
el('wmode').textContent=t2('机体 {0}%',Math.max(0,Math.round(t.hp/t.maxHp*100)));
el('magN').textContent=Math.round(t.speed*3.6)+'km/h';
el('magN').style.color='#eee';
el('resN').textContent=t2('高度 {0}m',Math.round(t.pos.y));
el('nadeN').textContent=t2('A/D 压坡转向 · 鼠标拉杆 · 炸弹 ×{0} [右键/B]',t.bombs);
} else if(player.onVehicle){
const t=player.onVehicle;
el('wname').textContent=t2(t.name);
el('wmode').textContent=t2('装甲 {0}%',Math.max(0,Math.round(t.hp/t.maxHp*100)));
el('magN').textContent=t.cannonCd<=0?t2('就绪'):t.cannonCd.toFixed(1);
el('magN').style.color=t.cannonCd<=0?'#9fd89f':'#e0c080';
el('resN').textContent='';
el('nadeN').textContent=t2('主炮[左键] · 机枪[右键] · 视角[F]');
} else if(player.onAT){
el('wname').textContent=t2('57mm 反坦克炮');
el('wmode').textContent=t2('穿甲弹');
el('magN').textContent=player.onAT.cd<=0?t2('就绪'):player.onAT.cd.toFixed(1);
el('magN').style.color=player.onAT.cd<=0?'#9fd89f':'#e0c080';
el('resN').textContent=''; el('nadeN').textContent='';
} else if(player.onAA){
el('wname').textContent=t2('防空炮');
el('wmode').textContent=t2('高爆弹');
el('magN').textContent='∞';
el('magN').style.color='#eee';
el('resN').textContent=''; el('nadeN').textContent='';
// 岸防炮座位 (2026-09-21 A#9 契约 §6): 与反坦克炮同一条读数 (冷却秒数 + 就绪色), 名字取炮位自己的名
// (CAMPAIGN.sea.batteries 的 '西南岬反舰炮台' 等), 与 updatePlayerAT 分支逐项同构。
	} else if(player.onBattery){
	const g=player.onBattery;
	el('wname').textContent=t2(g.name||'反舰炮台');
	el('wmode').textContent=t2('穿甲弹');
	el('magN').textContent=g.cd<=0?t2('就绪'):g.cd.toFixed(1);
	el('magN').style.color=g.cd<=0?'#9fd89f':'#e0c080';
	el('resN').textContent=''; el('nadeN').textContent='';
	// 大舰炮位 (2026-10-04 修复批 U1/U2): 座驾读数占用弹药面板 —— 主炮读整塔装填 (mainCd), 副炮/防空
	//   读座冷却; 舰名+结构值进 wmode。旧版无此分支, 面板漏到 else if(w) 显示**步枪弹药** (人已在操炮,
	//   面板还是汤普森 30/90), 且 13s 主炮装填全程无读数。
	} else if(player.capitalGun){
	const cg=player.capitalGun, cs=cg.ship;
	const nm=(cg.type==='main')?(cs.spec.main&&cs.spec.main.name):(cg.type==='sec')?(cs.spec.sec&&cs.spec.sec.name):(cs.spec.aa&&cs.spec.aa.name);
	const hpArr=(cg.type==='main')?cs.turHp:(cg.type==='sec')?cs.secHp:cs.aaHp;
	const cdArr=(cg.type==='main')?cs.mainCd:(cg.type==='sec')?cs.secCd:cs.aaCd;
	const dead=hpArr[cg.idx]!==undefined&&hpArr[cg.idx]<=0;
	el('wname').textContent=t2(nm||'舰炮');
	el('wmode').textContent=t2('{0} · 结构 {1}%',t2(cs.name),Math.max(0,Math.round(cs.hp/cs.maxHp*100)));
	el('magN').textContent=dead?t2('报废'):(cdArr[cg.idx]>0?cdArr[cg.idx].toFixed(1):t2('就绪'));
	el('magN').style.color=dead?'#ff7060':(cdArr[cg.idx]>0?'#e0c080':'#9fd89f');
	el('resN').textContent='';
	el('nadeN').textContent=t2('左键 开火 · C 换炮位 · F 离开炮位');
		} else if(player.loiter){
	el('wname').textContent=t2('巡飞弹 · TV制导');
	el('wmode').textContent=t2('导弹视角');
	el('magN').textContent=Math.ceil(player.loiter.life)+'s';
	el('magN').style.color=player.loiter.life<4?'#ff7060':'#9fe89f';
	el('resN').textContent=Math.round(player.loiter.spd)+' m/s';
	el('nadeN').textContent=t2('鼠标 制导 · 左键 自爆 · 右键 加速 · F 切换视角');
	} else if(w){
	el('wname').textContent=player.onMG?t2('MG42 通用机枪'):t2(w.def.name);
	el('wmode').textContent=player.onMG?t2('全自动'):w.def.mode;
	el('magN').textContent=player.onMG?'∞':w.mag;
	el('resN').textContent=player.onMG?'':'/ '+w.reserve;
	el('magN').style.color=(!player.onMG&&w.mag<=Math.max(2,w.def.mag*0.25))?'#ff7060':'#eee';
	el('nadeN').textContent=t2('手雷 ×{0}',player.nadeCount)+' · '+t2('绷带[H] ×{0}',player.bandages)
	+(player.atNades>0?' · '+t2('AT雷[3] ×{0}',player.atNades):'')   // 2026-10-05: 按携带量显隐 (步枪兵新增 AT雷×2, 原来只认突击兵)
	+(CLASSES[player.cls].smoke?' · '+t2('烟雾[4] ×{0}',player.smokeCount):'')
	+(player.incinCount>0?' · '+t2('燃烧[6] ×{0}',player.incinCount):'');
	}
// 拆除/回收读条 (2026-09-28 阶段三 P1): 屏下方细进度条+标签, 动态建一次; 显隐自管
// (不依赖 body.inMenu 继承链), 沙箱 stub 建不出 DOM 时降级为哑对象 (写 style 无副作用)。
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
bar.appendChild(fill); wrap.appendChild(lb); wrap.appendChild(bar); document.body.appendChild(wrap);
window._demolishBar={wrap,lb,fill};
}catch(e){ window._demolishBar={wrap:{style:{}},lb:{},fill:{}}; }
}
{
const db=window._demolishBar;
if(player.demolish&&player.alive&&!document.body.classList.contains('inMenu')){
db.wrap.style.display='block';
db.lb.textContent=player.demolish.mortar?t2('回收中: 迫击炮 …'):t2('拆除中: {0} …',t2(BUILD_NAMES[player.demolish.b.type]));
db.fill.style.width=clamp(player.demolish.t/DEMOLISH_T,0,1)*100+'%';
} else db.wrap.style.display='none';
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
hudText('hpNum',Math.ceil(player.hp));
hudStyle('hpBar','width',player.hp+'%');
hudStyle('hpBar','background',player.hp>50?'#cfe0c0':(player.hp>25?'#e0c080':'#e07060'));
hudStyle('stamBar','width',(player.stamina*100)+'%');
// 低频HUD(10Hz): 小地图/罗盘/票数/旗帜状态, 减少每帧DOM与Canvas开销
hudSlowT-=dt;
if(hudSlowT<=0){
hudSlowT=0.1;
{
	// 兵力一律实票: 攻防/破袭防守方=进攻方×1.25, 劫道双方标准相等票, 征服/遭遇双实票 (2026-09-02 去∞; 2026-09-05 1.75→1.25, 注释漂移修正)
	// 顶部栏显示 剩余兵力(在场人数) (2026-09-04 用户指定: 票数为主, 括号内=该队场上存活人数含玩家/乘员)
	const t0s=Math.ceil(tickets[0]);
	const t1s=Math.ceil(tickets[1]);
	const f0=fieldCount(0), f1=fieldCount(1);
	let modeLine='';
	if(GAMEMODE==='assault') modeLine=`<div style="font-size:11px;color:#ffd77a">${t('攻防战 · 攻方占超一半且守方仅余1点→守方兵力流失 · 任意一方占满全部旗点→敌方兵力归零 · 全旗+歼灭残兵两条件齐备才判胜{0}',CAMPAIGN.id==='songhu'?t(' · <span style="color:#9fd4e8">浅滩涉水减速 · 深水主河须过石桥</span>'):(CAMPAIGN.sea?t(' · <span style="color:#9fd4e8">礁盘涉水 · 深水游泳[Shift下潜] · 水下憋气有限</span>'):''))}</div>`;
	else if(GAMEMODE==='demolition') modeLine=`<div style="font-size:11px;color:#ffd77a">${t('破袭战 · 剩余补给库: {0}/{1}',DEPOTS.filter(d=>!d.destroyed).length,DEPOTS.length)}</div>`;
	else if(GAMEMODE==='conquest') modeLine=`<div style="font-size:11px;color:#ffd77a">${CAMPAIGN.bridge?t('拉锯战 · 三路渡河: 大桥/北石桥可通车 · 南徒涉滩可涉渡 · 滩外激流不可徒涉'):t('征服战 · 一方占超一半且对方仅余1点→对方兵力流失 · 占满全部旗点→敌方兵力归零 · 全旗+歼灭残兵两条件齐备才判胜')}</div>`;
	else if(GAMEMODE==='clash') modeLine=`<div style="font-size:11px;color:#ffd77a">${t('遭遇战 · 夺取强点推进战线 · 兵力打空后需清场残敌方胜')}</div>`;
	else if(GAMEMODE==='convoy'){ const cs=(typeof CONVOY_STATE!=='undefined'&&CONVOY_STATE)?t(' · 剩余 {0} 辆 · 已突围 {1}',CONVOY_STATE.left,CONVOY_STATE.esc):''; modeLine=`<div style="font-size:11px;color:#ffd77a">${t('劫道战 · 毁车过半→劫道方胜, 突围过半→护运方胜 · 劫道方补给 {0} 分钟后失效 · 护运方贴车补{1}',Math.round(((CAMPAIGN.convoy&&CAMPAIGN.convoy.supplyLife)||600)/60),cs)}</div>`; }
	let wipeLine='';
	for(const z of [0,1]){
	if(tickets[z]<=0){
	// 同归零局旗权条件豁免 (2026-10-06, 与 21-match 清场判定同口径): 对方也归零时不再要求占满全旗
	const gl=(tickets[1-z]<=0)?0:flagsLostOf(1-z);
	wipeLine+=`<div style="font-size:11px;color:#ff9c8a">${t('⚠ {0} 兵力归零 · {1} 需{2}消灭其场上残兵(剩 {3} 人)方可获胜{4}',t(TEAM_NAME[z]),t(TEAM_NAME[1-z]),gl>0?t('占满全部旗点(余 {0} 点)+',gl):'',fieldCount(z),wipeT[z]!==null?`<b style="color:#ffe08a">${t(' · ⏳ 最后一人清场倒计时 {0} 秒',Math.ceil(wipeT[z]))}</b>`:'')}</div>`;
	}
	}
	const tn=' style="font-style:normal;font-size:12px;opacity:.75"';
	el('tickets').innerHTML=`<span class="tl">${t(TEAM_NAME[0])} ${t0s}<span${tn}>${t('({0}人)',f0)}</span></span> &nbsp;·&nbsp; <span class="tr">${t1s} ${t(TEAM_NAME[1])}<span${tn}>${t('({0}人)',f1)}</span></span>`+modeLine+wipeLine+
	(player.spectator?`<div style="font-size:11px;color:#9fe8ff">${t('观战中 · 免伤 · 不被索敌 · 双击空格悬停/H气动飞行 · 左键可开火 · 控弹时T=弃弹传送 · F=按状态(幽灵坦克上=下车/舰艇上=鱼雷·下船/其余=召唤幽灵坦克)')}</div>`:'');
}
const mm=Math.floor(Math.max(0,matchTime)/60), ss2=Math.floor(Math.max(0,matchTime)%60);
el('timeTxt').textContent=`${mm}:${ss2<10?'0':''}${ss2}`;
FLAGS.forEach((f,i)=>{
const fi=el('fi'+i);   // ★2026-10-02 与 23-deploy applyFlagOwnership 同一 id 序 (索引) —— 旧版 fi<旗名>
                       //   在海战图两军旗点同名时 id 撞车, 后一军的图标永远 null/不更新 (= 灰色图标)。
if(!fi) return;   // 2026-09-20N (Lead 指派的最小守卫): 首屏(未开局)时 #flagIcons 还是 index.html 的静态 A..E,
                  // 当前战役旗 id 不同 (中文 id 有 8 张图) ⇒ el() 返回 null, 旧代码每帧抛
                  // TypeError 且 __sfBooted 永不置位 (真浏览器启动链卡死). 开局后 applyFlagOwnership()
                  // 已按本图重建 fi<id>, 此分支自然不再走到. #topBar 在 #ui 内、主菜单期 #ui display:none
                  // ⇒ 首屏这几个图标本就不可见, 不存在"显示成 A..E"的观感问题.
fi.className=(f.owner===0?'f0':f.owner===1?'f1':'')+(f.capTeam!==-1&&f.cap>0.03?' fc':'');
});
drawMinimap();
// 大地图: 阵亡/退出部署时自动收起, 存活期间按帧刷新
if(bigmapOn&&(!player.alive||!player.deployed)){ bigmapOn=false; el('bigmapWrap').classList.add('hidden'); }
if(bigmapOn) drawBigMap();
drawCompass();
// 小队HUD
const sqEl=el('squadHUD');
if(SQUAD.members.length&&player.deployed){
const alive=SQUAD.members.filter(s=>s.alive).length;
sqEl.style.display='block';
sqEl.innerHTML=`◆ 小队 <b>${alive}/${SQUAD.members.length}</b> · ${SQUAD.mode==='move'?'<b>进攻标记点</b>':'跟随中'}<br><span style="opacity:.65">[T] 标点进攻 · [Y] 跟随我</span>`;
} else sqEl.style.display='none';
}
let inFlag=null;
if(player.alive) for(const f of FLAGS){ if(Math.hypot(player.pos.x-f.x,player.pos.z-f.z)<f.r) inFlag=f; }
if(inFlag&&(inFlag.capTeam!==-1&&inFlag.cap>0.02||inFlag.owner!==player.team)){
hudShow('capPanel',true);
hudText('capLetter',inFlag.id);
hudStyle('capBarFill','width',(inFlag.cap*100)+'%');
// 争夺状态: 双方同时在圈内 → 进度冻结并黄条提示, 不再表现为"进度条不动"
const contested=inFlag.present&&inFlag.present[0]>0&&inFlag.present[1]>0;
hudStyle('capBarFill','background',contested?'#e8d06a':(inFlag.capTeam===0?'#8fc1ff':'#ff9c8a'));
let capTxt;
if(contested&&inFlag.cap>0.02) capTxt='⚠ 争夺中 · 圈内仍有敌军';
else capTxt=inFlag.capTeam===player.team?'正在占领…':(inFlag.capTeam===-1?(inFlag.owner===player.team?'我方控制':'站在旗点范围内占领'):'敌军正在占领!');
hudText('capTxt',capTxt);
} else hudShow('capPanel',false);
dmgFlash=Math.max(0,dmgFlash-dt*2);
hudStyle('dmgOv','opacity',dmgFlash);
hudStyle('lowOv','opacity',player.alive&&player.hp<35?(1-player.hp/35)*0.85:0);
	hudStyle('supOv','opacity',player.suppressV*0.7);
	const tvEl=el('tvOv');
	if(tvEl&&tvEl.style.display!==(player.loiter?'block':'none')) tvEl.style.display=player.loiter?'block':'none';
nadeWarnT-=dt;
hudShow('nadeWarn',nadeWarnT>0);
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
if(player.alive&&player.braced){ hudShow('braceInd',true); hudClass('braceInd','on'); hudText('braceInd','▙ 已架枪'); }
else if(player.alive&&player.canBrace&&!player.prone&&!player.onVehicle){ hudShow('braceInd',true); hudClass('braceInd',''); hudText('braceInd','[X] 架枪'); }
else hudShow('braceInd',false);
	if(player.alive&&player.loiter){
	hudShow('crosshair',true);
	hudStyle('crosshair','--gap','7px');
	} else if(player.alive&&!player.ads&&!player.onVehicle){
hudShow('crosshair',true);
const gap=8+player.bloom*26+(Math.hypot(player.vel.x,player.vel.z)>1?6:0);
hudStyle('crosshair','--gap',gap+'px');
} else if(player.alive&&player.ads&&!WPN_DEFS[VM.key]?.scoped&&!player.onVehicle){
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
// 观战时停随"离开战局"收尾 (2026-09-27M 时停修复批, 审计 P1-4): SPEC_TIME 原先只在换局/关观战时复位 ⇒
// 时停中回主菜单再点「继续」, 回来时 paused 仍是 true (战场静止而玩家多半已忘了自己按过 K)。菜单冻结
// (menuHold) 与观战时停是两套冻结, 不该叠加 —— 回主菜单 = 退出观战工具态, 就地解除。
if(typeof specTimeReset==='function') specTimeReset();
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
nb.textContent=t('新 游 戏');
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
player.specUsed=false; // 本局"观战态下部署过"标记随新对局复位 (判据 2026-09-27 收窄, 见 18-game 字段注释)
player.specWant=null;  // 待生效的观战意图 (2026-09-26H A#3): 换局即作废 —— 否则上一局"待下次部署"的开关会落进新一局
if(typeof specTimeReset==='function') specTimeReset();   // 观战时间倍率回 ×1 (2026-09-26H B7)
if(typeof SpecLayer!=='undefined'&&typeof specLayerPurge==='function') specLayerPurge(); // 名牌/指向线收起 (B6)
player.flying=false; player.flyAero=false; player._aeroSpd=0;
player.hp=100;
// 本局战绩计数复位 (2026-09-16 记录批顺带修): kills/deaths/score/headKills/caps 此前只在 PLAYER 初始化时置零,
// 之后再没有复位点 —— 结算页改成"逐项比纪录"后这是硬伤: 就地重开的第二局会带着上一局的击杀/得分/阵亡去比纪录
// (旧版"本局得分"同样把两局累加, 只是没人发现)。落点选在这里 = 与"玩家这一条命复位"同一处。
player.kills=0; player.deaths=0; player.score=0; player.headKills=0; player.caps=0;
player.demol=0; // 破坏数 (2026-09-26 破坏得分批): 与上面五项同段复位 —— 否则第二局会带着上一局拆的楼数去比纪录
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
player.nadeHeld=false; player.nadeIsAT=false; player.nadeIsSmoke=false; player.nadeIsIncin=false;
player.bandaging=0; player.curSlot=0;
player.deathRag=null; player.deathCamT=0; player.killerName='';
respawnCd=0; // 重生冷却 (2026-09-17 P0 同族): 上局阵亡时剩下的部署冷却不该带到新一局 (否则兵种选择页部署键先灰着)
VM.root.visible=false;
// 站到本方基地 (高度取地面), 朝向地图中心 —— 兵种选择阶段镜头就在自家的出发点, 与"部署"那一刻接得上
const bp=(typeof basePos==='function')?basePos(player.team):{x:player.pos.x,z:player.pos.z};
player.pos.set(bp.x,0,bp.z);
player.pos.y=(typeof capSpawnGroundY==='function')?capSpawnGroundY(player.pos.x,player.pos.z,10):standHeight(player.pos.x,player.pos.z,10);  // P4: 复活/选兵种站位吃甲板
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
// ① 单位退场 + 清空累积表
for(const s of soldiers){ if(!s) continue; s.alive=false; s.respawnT=1e9; s.target=null; s.path=null; s.onVehicle=null;
if(s.mesh&&s.mesh.root&&s.mesh.root.parent) s.mesh.root.parent.remove(s.mesh.root); }
for(const t of tanks){ if(!t) continue; t.alive=false; t.respawnT=1e9; t.crewBot=null;
if(t.grp&&t.grp.parent) t.grp.parent.remove(t.grp); }
for(const p of planes){ if(!p) continue; p.alive=false; p.pilotBot=null;
if(p.grp&&p.grp.parent) p.grp.parent.remove(p.grp); }
for(const k of trucks){ if(!k) continue; k.alive=false;
if(k.grp&&k.grp.parent) k.grp.parent.remove(k.grp); }
// 这些表只增不减: 不清就会一路累加 (主循环对它们数组全扫, 退场单位 alive=false 也照样每帧遍历)。
// 安全性: 布娃娃在 spawnRagdoll 里只取位置/朝向/制服材质重建, 不持有 bot 引用; 小队与玩家挂载点已在下文清。
soldiers.length=0; tanks.length=0; planes.length=0; trucks.length=0;
// combatants 是"玩家 + 全部 Bot"的混编表 (11-soldiers 声明, Bot 构造里 push): 它同样只增不减 ——
// 不清的话上一局的 Bot 会永久留在记分板/火伤/铁丝网等按 combatants 遍历的系统里 (2026-09-17 世界还原批
// 顺带修: 用户"场上还有上一局的人"的观感里就有它的一份)。玩家本体是常驻对象, 复位后放回表首。
combatants.length=0; combatants.push(player);
// ② 场景台账: 摘掉本局新增的场景对象 (含工事/迫击炮/医疗箱/残骸/弹坑)
const w0=window.__sfMatchWorldStart;
if(typeof w0==='number') for(let i=world.children.length-1;i>=w0;i--) world.remove(world.children[i]);
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
for(const g of [...ATGUNS,...AAGUNS]){ g.user=null; g.cd=0; g.cdLock=0; } // 固定炮位解绑 (炮位本身是地图设施, 保留)
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
}
// 主菜单面板切换 (模块级: initMenuUI 绑定导航按钮 + returnToMenu 回首页共用)
function showPanel(id){
el('mHome').classList.toggle('hidden',id!=='mHome');
['mPlay','mSet','mHelp','mData'].forEach(pid=>el(pid).classList.toggle('hidden',pid!==id));
el('menu').classList.toggle('hasSub',id!=='mHome');
// 战绩数据面板 (2026-09-16 记录批): 每次打开重算 —— 同一会话里就地重开的对局会改写存档, 面板不能拿旧 HTML
if(id==='mData') renderRecordsPanel();
if(typeof syncMenuArt==='function') syncMenuArt(id); // 左上角装饰画面: 只在主菜单/开始面板显示 (22a-menuart)
if(typeof syncMenuButtons==='function') syncMenuButtons(); // 按钮态: 「继续游戏」是否可点 (有无挂起的战局)
}
// 「新 游 戏」的唯一实现 (2026-09-16 二批): 确认(有未分胜负的战局时) → 放弃当前这场 → 就地开新局。
// "覆盖原先的游戏"就落在这里: 走上这条路, 旧局不再可继续 (结算过的旧局本来也没什么可继续的)。
function startNewGame(){
if(!askNewGame()) return;
beginFreshMatch();
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
	resetMatchState(); // 清场播报/倒计时复位 (2026-09-06 B7b/P2-14: 21-match 暴露的唯一入口)
	resetPlayerForNewMatch(); // 玩家回到"未落地"状态 (2026-09-16 二批修: 否则新一局沿用上一局的活人状态)
	startMatch();
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
	// 实验模式开关 (游戏设置内): 巡飞弹兵替换反坦克兵
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
const ti=t2(c.title), mo=t2(c.modeName), su=t2(c.sub);
b.innerHTML=`<span class="ccTitle">${ti}</span>`
+`<span class="ccMode">${mo}</span>`
+`<span class="ccSub">${su}</span>`;
b.title=`${ti} · ${mo} · ${su}`; // 省略号截断时悬停可看全
b.onclick=()=>{
localStorage.setItem('sf_campaign',String(i));
localStorage.setItem('sf_openplay','1');
location.reload();
};
return b;
};
const isFlagMode=m=>m==='assault'||m==='conquest';
const flagCamps=CAMPAIGNS.map((c,i)=>({c,i})).filter(x=>isFlagMode(x.c.mode));
const otherCamps=CAMPAIGNS.map((c,i)=>({c,i})).filter(x=>!isFlagMode(x.c.mode));
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
campRow.appendChild(outerRow);
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
campRow.appendChild(folderRow);
// (旧版此处会把 "📁 占旗点战役 (8) · 当前征服" 追加进标题, 撑爆卡宽导致折行 —— 2026-09-13 改由 ccSub 行表达)
el('menuSub').textContent=`—— ${t2(CAMPAIGN.title)} · ${t2(CAMPAIGN.sub)} ——`;
// 左上角装饰画面 (战役沙盘 + 阵营盾徽): 战役/阵营都是存档记忆项, 此处按当前 SETTINGS.team 与
// CAMPAIGN 一次画好 —— 刷新后左上角即"上次选择"的实时反映 (2026-09-13)
if(typeof renderMenuArt==='function') renderMenuArt();
el('teamUS').innerHTML=`${TEAM_FACTION[0].sym} ${t2(TEAM_FACTION[0].short)} · ${t2(TEAM_FACTION[0].name)}`;
el('teamGER').innerHTML=`${TEAM_FACTION[1].sym} ${t2(TEAM_FACTION[1].short)} · ${t2(TEAM_FACTION[1].name)}`;
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
location.reload();
};
});
}
el('teamUS').classList.toggle('sel',SETTINGS.team===0);
el('teamGER').classList.toggle('sel',SETTINGS.team===1);
el('teamUS').onclick=()=>{ SETTINGS.team=0; localStorage.setItem('sf_team','0'); el('teamUS').classList.add('sel'); el('teamGER').classList.remove('sel'); };
el('teamGER').onclick=()=>{ SETTINGS.team=1; localStorage.setItem('sf_team','1'); el('teamGER').classList.add('sel'); el('teamUS').classList.remove('sel'); };
document.querySelectorAll('.diffBtn').forEach(b=>{
b.classList.toggle('sel',+b.dataset.d===SETTINGS.diff);
b.onclick=()=>{
SETTINGS.diff=+b.dataset.d;
localStorage.setItem('sf_diff',b.dataset.d);
document.querySelectorAll('.diffBtn').forEach(x=>x.classList.toggle('sel',x===b));
};
});
// 昼夜选择 (2026-10-05 设计 N1/R5): 落 sf_daynight, 切档 reload —— 与画质/难度同惯例 (夜档管线 boot 一次性生效, 不做热切)。
// ironbottom 锁夜 (R5): 两钮置灰禁点, 固定选中「黑夜」, 显示锁档提示。
{
const _dns=document.querySelectorAll('.dnBtn');
const _dnLock=el('dnLock');
const _locked=(typeof CAMPAIGN!=='undefined')&&CAMPAIGN.id==='ironbottom';
_dns.forEach(x=>{
x.classList.toggle('sel',_locked?x.dataset.dn==='night':x.dataset.dn===(NIGHT_MODE?'night':'day'));
if(_locked){ x.disabled=true; x.style.opacity=.45; }
else x.onclick=()=>{
if(x.dataset.dn===(NIGHT_MODE?'night':'day')) return;   // 点当前档不重载
AudioSys.resume&&AudioSys.resume();
localStorage.setItem('sf_daynight',x.dataset.dn);
location.reload();
};
});
if(_dnLock) _dnLock.style.display=_locked?'':'none';
}
// 天气选择 (2026-10-05 天气设计纲要 §5-10): 落 sf_weather, 切档 reload —— 与昼夜同款 (boot 一次性解析, 不做热切)。
// ironbottom 不锁天气 (本图只锁夜档, 天气档照常可玩)。点当前档不重载; 缺省键 'map' 存为删除键值 (跟随地图)。
// 雪图四档文案换雪 (§5-11): data-wx 恒为四档键, 文案按图族解析 (数据-文案分离, i18n 词典仍单源)。
// 「跟随地图」选中时按钮旁小字提示当前生效档 (如 本图=小雨 / 雪图 本图=中雪), 手选档不显示。
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
if(x.dataset.wx===_wxCur) return;   // 点当前档不重载
AudioSys.resume&&AudioSys.resume();
if(x.dataset.wx==='map') localStorage.removeItem('sf_weather'); else localStorage.setItem('sf_weather',x.dataset.wx);
location.reload();
};
});
if(_wxHint){
if(_wxCur==='map'){ _wxHint.style.display=''; _wxHint.textContent=t('本图={0}',t(_effZh[WEATHER_EFF]||'晴朗')); }
else _wxHint.style.display='none';
}
}
// 画质 / 灵敏度 / 音量 (2026-09-25 补落盘): 三项都随 reload 丢失过 —— 落 sf_qual / sf_sens / sf_vol,
// 与阵营/难度/人数同规 (读取在 00-config 的 SETTINGS 段, UI 初值同步在本函数下方)。
document.querySelectorAll('.qualBtn').forEach(b=>b.onclick=()=>{
SETTINGS.quality=+b.dataset.q;
localStorage.setItem('sf_qual',String(SETTINGS.quality));
document.querySelectorAll('.qualBtn').forEach(x=>x.classList.toggle('sel',x===b));
applyQuality();
});
// 瞄准吸附档位 (2026-09-27): 关/轻度/标准 —— 与画质同规落 sf_aim, 但**不 reload**: 13-combat 的开火链
// 每一枪现读 SETTINGS.aim ⇒ 改档下一枪就生效 (所以这里只写内存 + 存档 + 按钮态)。
document.querySelectorAll('.aimBtn').forEach(b=>b.onclick=()=>{
SETTINGS.aim=+b.dataset.a;
localStorage.setItem('sf_aim',b.dataset.a);
document.querySelectorAll('.aimBtn').forEach(x=>x.classList.toggle('sel',x===b));
});
el('sensRange').oninput=e=>{ SETTINGS.sens=e.target.value/100; localStorage.setItem('sf_sens',e.target.value); el('sensVal').textContent=SETTINGS.sens.toFixed(1); };
el('volRange').oninput=e=>{ SETTINGS.vol=e.target.value/100; localStorage.setItem('sf_vol',e.target.value); el('volVal').textContent=e.target.value; AudioSys.setVol(SETTINGS.vol); };
// 落盘后的初值同步 (2026-09-25): 三项已持久化 ⇒ HTML 里写死的 .sel / value=100 / value=80 会被 SETTINGS 覆盖。
// 音量本身不需再调 (01-audio 建 master 时就是 master.gain.value=SETTINGS.vol)。
document.querySelectorAll('.qualBtn').forEach(x=>x.classList.toggle('sel',(+x.dataset.q)===SETTINGS.quality));
document.querySelectorAll('.aimBtn').forEach(x=>x.classList.toggle('sel',(+x.dataset.a)===SETTINGS.aim));   // 瞄准吸附同规 (存档值覆盖 HTML 写死的 .sel)
{ const sr=el('sensRange'); if(sr){ sr.value=String(Math.round(SETTINGS.sens*100)); el('sensVal').textContent=SETTINGS.sens.toFixed(1); }
  const vr=el('volRange'); if(vr){ vr.value=String(Math.round(SETTINGS.vol*100)); el('volVal').textContent=String(Math.round(SETTINGS.vol*100)); } }
// 结算页「返回主界面」入口 (2026-09-16 本批): 对局已结束, 无二次确认 —— 战局没有可损失的东西
el('againBtn').onclick=()=>{ AudioSys.resume&&AudioSys.resume(); returnToMenu(); };
// 部署界面「返回主界面」入口 (2026-09-16 本批): 开局选兵种阶段的唯一出口, 战斗中按 Esc 查看部署界面时同样可用;
// 是否显示由 showDeploy 决定 (战局已结束则不显示, 那条路径归结算页的按钮)
if(el('deployMenuBtn')) el('deployMenuBtn').onclick=()=>{ AudioSys.resume&&AudioSys.resume(); returnToMenu(); };
	const grid=el('classGrid');
	CLASSES.forEach((c,i)=>{
	const d=document.createElement('div');
	d.className='classCard'+(i===0?' sel':'');
	const cname=(EXPERIMENT&&i===3)?t2('巡飞弹兵'):t2(c.name);
	d.innerHTML=`<div class="cname">${cname}</div><div class="cwpn" id="cw${i}"></div><div class="cwpn">${t2('手雷 ×{0}',c.nades)}</div>`;
d.onclick=()=>{
// 观战模式开关: 实验模式下巡飞弹兵"已选中"时再点一次 → 开/关观战 (2026-09-01 用户指定)
// ★2026-09-26H 观战批 (审计 #3/A3, 用户圈定修复): 战斗中**不许即时开启** —— 旧版是"正在交战的活人二次点击
//   当场获得免伤/无限弹/无差别火力", 既无确认也不落在部署点上 (Esc 丢指针锁就会自动打开本界面, 路径极短)。
//   现在三条:
//     · 开启 + 活着·已落地·未结算 ⇒ 二次确认 + 记为 player.specWant, **下一次部署**才生效 (23-deploy 结算);
//     · 关闭 ⇒ 立即生效 (反过来的方向没有可利用性; 且观战者不会阵亡 ⇒ 若也要等部署就永远退不出来);
//     · 兵种选择阶段 / 死亡等待期 / 结算后 ⇒ 与旧版一致, 立即生效 (那时人没在交战, 没有"瞬间变强"的问题)。
if(EXPERIMENT&&i===3&&player.cls===3){
const cur=(typeof player.specWant==='boolean')?player.specWant:player.spectator;   // 待生效优先: 再点一次=撤销
const want=!cur;
const midBattle=player.alive&&player.deployed&&!matchOver;
if(want&&midBattle){
if(!confirm(t('开启观战模式？本局将: 免伤 · 不被索敌 · 弹药无限 · 副武器换观战连狙, 且可对双方开火。注意: 下一次部署才生效; 生效(以观战者身份进入战场)后本局不计入历史记录 —— 只点开开关又取消的不算。')))return;
player.specWant=true;
}else{
player.specWant=null;
const wasSpec=player.spectator;
player.spectator=want;
// ★2026-09-27 修 (用户实报"选了一下观战模式再取消 ⇒ 结算判成观战局不予计量"): 这里**不再**盖 specUsed。
//   开关点开 ≠ 观战过对局 —— 角色卡上点一下随后取消(或干脆只在菜单里试了一下)不该让整局白打。
//   真正的盖章点收在 23-deploy deployPlayer: 只有"顶着观战态真的落进战场"才记本局为观战局。
if(wasSpec&&!want){
// 关掉观战 = 立刻退出观战态: 收掉观战专属座驾 (白车不能留给一个普通玩家) + 时间倍率回 ×1
if(typeof specVehStow==='function') specVehStow();
if(typeof specTimeReset==='function') specTimeReset();
}
applySpectatorLoadout(); // 副武器位即时换装: 连狙 ⇄ 手枪 (2026-09-17 观战扩展批, 用户裁定"即时生效")
}
{
// 卡片外观 + 武器行 + 出生列表同步刷新 (观战会改出生列表里的载具闸门, 兵种卡副武器位也会跟着变)
const pend=(typeof player.specWant==='boolean');
d.classList.toggle('spec',player.spectator||pend);
d.style.outline=(player.spectator||pend)?'2px solid #ffd76b':'';
const cn=d.querySelector('.cname');
if(cn) cn.textContent='巡飞弹兵'+(player.spectator?' · 观战中':(pend?' · 观战待生效':''));
const cw=el('cw3'); if(cw) cw.textContent=classCardWeaponText(3);
buildSpawnList();
}
showScorePop((typeof player.specWant==='boolean')
?'观战模式将于下次部署生效'
:(player.spectator?'观战模式已开启: 免伤·不被索敌·弹药无限·副武器连狙':'观战模式已关闭'));
AudioSys.click(1200,0.3,0.05);
}
player.cls=i;
document.querySelectorAll('.classCard').forEach(x=>x.classList.toggle('sel',x===d));
};
grid.appendChild(d);
});
el('deployBtn').onclick=()=>{
if(respawnCd>0||matchOver||tickets[player.team]<=0) return; // 己方兵力归零后不可再部署 (2026-09-04)
deployPlayer();
};
el('resumeBtn').onclick=()=>{
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
if(localStorage.getItem('sf_openplay')==='1'){
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
// ── ①b 大舰地图符号 (2026-09-30 阶段五 P4): 舰体轮廓 + 瘫痪标记 ──
// 画的是**真尺寸轮廓** (hullL×hullW 按地图比例), 因为"哪条舰在哪、朝哪"是海图的全部信息量;
// 瘫痪舰用灰底 + 叉号 —— 它是可占领的海上陆地, 不是消失的目标 (与小艇击沉后不画截然不同)。
function sfCapitalMapSymbols(toMap,c,S,rot){
if(typeof capitalShips==='undefined'||!Array.isArray(capitalShips)||!capitalShips.length) return 0;
let n=0;
for(const s of capitalShips){
if(!s||!s.pos) continue;
const q=toMap(s.pos.x,s.pos.z), px=q[0], py=q[1];
if(px<-40||py<-40||px>S+40||py>S+40) continue;
// 地图比例: 小地图 range/2S, 大地图 MH/(S/2) —— 用两个采样点反推 (与两份 toMap 的仿射式无关)
const q2=toMap(s.pos.x+100,s.pos.z), sc=Math.hypot(q2[0]-px,q2[1]-py)/100;
const L=Math.max(7,s.spec.hullL*sc), W=Math.max(2.4,s.spec.hullW*sc);
c.save();
c.translate(px,py);
c.rotate(-(s.yaw||0)+rot+Math.PI);
c.globalAlpha=0.30;
c.fillStyle=(s.team===0)?'#6da5e8':'#e87a68';
c.fillRect(-W,-L,W*2,L*2);            // 舰体轮廓 (半透明底)
c.globalAlpha=1;
c.strokeStyle=(s.state==='crippled')?'rgba(150,150,150,.85)':'rgba(240,250,255,.95)';
c.lineWidth=1.2;
c.strokeRect(-W,-L,W*2,L*2);
// 中轴线: 舰艏方向 (读向)
c.beginPath(); c.moveTo(0,-L); c.lineTo(0,-L*0.45); c.stroke();
if(s.state==='crippled'){              // 瘫痪: 叉号 (与"沉没消失"区分)
c.strokeStyle='rgba(60,60,60,.9)'; c.lineWidth=1.6;
c.beginPath(); c.moveTo(-W*0.9,-L*0.5); c.lineTo(W*0.9,L*0.5); c.moveTo(W*0.9,-L*0.5); c.lineTo(-W*0.9,L*0.5); c.stroke();
}
c.restore();
n++;
}
return n;
}
// ── ② 小地图/大地图包装 (纯追加; 原函数一行不动) ──
let _navalMapErr=false;
const _navalBaseDrawMinimap=drawMinimap;
drawMinimap=function(){
_navalBaseDrawMinimap.apply(this,arguments);
try{
// 投影与 drawMinimap 内联 toMap 逐字同式 (该函数体本批不动, 只能在此复刻一次; 漂移由自检看住)
const S=190, half=S/2, range=90*Math.max(1,Math.sqrt((CAMPAIGN.mapSize||320)/320));
const cx=player.alive?player.pos.x:0, cz=player.alive?player.pos.z:0;
const rot=player.alive?player.yaw:0;
const toMap=(x,z)=>{
const dx=x-cx, dz=z-cz;
const co=Math.cos(rot), si=Math.sin(rot);
const rx=dx*co-dz*si, rz=dx*si+dz*co;
return [half+rx/range*half, half+rz/range*half];
};
sfCapitalMapSymbols(toMap,mmC,S,rot);   // P4 大舰: 底层先画 (V9 2026-10-04 修: 旧序先艇后舰, 150m 的
                                        //   舰体轮廓把贴帮的小艇符号整个盖住 —— "画在艇之下"的既定
                                        //   口径写反了执行序)
sfNavalMapSymbols(toMap,mmC,S,rot);     // 艇后画 = 压在大舰轮廓之上 (贴帮/摆渡中的艇仍可读)
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
sfCapitalMapSymbols(toM,bmC,S,0);       // V9 (2026-10-04): 同小地图 —— 大舰底层, 艇压在上
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
hf.style.width=(k*100)+'%';
hf.style.background=st.main<=0?'#8fd18f':'linear-gradient(90deg,#e8c56a,#e83a1a)';
}
// ② 弹药面板 = 武器名 / 主炮读数 / 鱼雷数 / 操作行 (键全部已存在)
if(amp) amp.style.display='block';
const wname=el('wname'), wmode=el('wmode'), magN=el('magN'), resN=el('resN'), nadeN=el('nadeN');
if(wname) wname.textContent=t2(spec.name||'');
if(wmode) wmode.textContent=t2((spec.main&&spec.main.name)||'')+' · '+t2(c.kind==='boat'?'快艇':'两栖车');
if(magN){ magN.textContent=st.main<=0?t2('就绪'):st.main.toFixed(1);
magN.style.color=st.main<=0?'#9fd89f':'#e0c080'; }
// ★2026-09-26E (审计 16): 鱼雷装填 (1.2s 闸门) 旧版在界面上**没有任何读数** —— 按 F 后 1.2s 内再按只会弹字。
//   现在把闸门剩余时间并进鱼雷那一行 (存量 + 倒计时), 玩家不用猜。
if(resN) resN.textContent=(spec.torpedo>0)?(st.torp>0?t2('鱼雷 ×{0} · 装填 {1}s',navalTorpedoLeft(c),st.torp.toFixed(1)):t2('鱼雷 ×{0}',navalTorpedoLeft(c))):'';
// 2026-09-22: F 的语义随**可步行下船**与否切换 (与 20-player tryInteract / updateInteractHint 三处同源) ——
//   旧版这行永远写 [F] 鱼雷, 于是在浅水/搁浅 (F 实际=下船) 时读数是错的。
// 2026-09-26E 审计 12: 门与 20-player tryInteract 同源 (navalCanExitNow) —— 无鱼雷载具恒显示 [F] 下船
if(nadeN) nadeN.textContent=(typeof navalCanExitNow==='function'&&navalCanExitNow(c))
?t2('[左键] 主炮 · [右键] 机炮 · [F] 下船')
:t2('[左键] 主炮 · [右键] 机炮 · [F] 鱼雷')
+(player.navalGun?' · '+t2('炮手镜'):'');   // 2026-09-21: 炮手镜态在操作行尾标注 (与 20-player 提示同源)
// ③ 舰体血量 + 吃水/水深 + 航速 面板
const pn=navalPanelEnsure();
const frac=Math.max(0,Math.min(1,(c.hp||0)/(c.maxHp||c.hp||1)));
pn.wrap.style.display='block';
if(pn.bar){ pn.bar.style.width=(frac*100)+'%';
pn.bar.style.background=frac>0.5?'#9fd89f':(frac>0.25?'#e0c080':'#e07060'); }
if(pn.name) pn.name.textContent=t2('舰体');
if(pn.num) pn.num.textContent=Math.max(0,Math.ceil(c.hp||0))+' / '+Math.round(c.maxHp||0);
const draft=(c.draftNow&&typeof c.draftNow==='function')?c.draftNow():((spec.draft0||0)+(c.flood||0)*0.5);   // 2026-09-26E 审计 9: 吃水单源 (15d draftNow)
const dep=Math.max(0,(typeof waterDepthAt==='function')?waterDepthAt(c.pos.x,c.pos.z):0);
if(pn.info) pn.info.textContent=t2('吃水 {0}m · 水深 {1}m',draft.toFixed(2),dep.toFixed(1));
let spd=t2('航速')+' '+Math.abs(c.vel||0).toFixed(1)+' m/s';
if(c.state==='ground') spd+=' · '+t2('⚠ 搁浅! 倒车脱困');
else if((c.flood||0)>0.35||c.state==='sinking') spd+=' · '+t2('⚠ 进水! 舰体正在下沉');
if(pn.spd) pn.spd.textContent=spd;
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
// 大舰 (2026-09-30 阶段五 P4; ★2026-10-01b 改"复位复用, 不再摘除"): 大舰自本批起在**载入期**生成
//   (24-main boot, 菜单航拍要显示舰船), 属于"世界的一部分" —— 退场只做复位 (位姿/血量/炮位/材质
//   回开局态 + 甲板旗点重绑), grp 留在场景里。旧版整体摘除 + 清表 ⇒ 回主菜单后航拍里一艘船都不剩
//   (正是"起始界面只有一片海"的另一半病根); 就地重开再重建一遍也是净浪费。
if(player.onCapital&&typeof capSeatRelease==='function') capSeatRelease();
if(typeof capitalShips!=='undefined'&&Array.isArray(capitalShips)&&capitalShips.length&&typeof capitalReset==='function'){
try{
for(const s of capitalShips){
if(s.fireSrc&&typeof removeFireSource==='function'){ removeFireSource(s.fireSrc); s.fireSrc=null; }
}
capitalReset();   // 单源: respawnClear (血量/炮位/材质/位姿) + 甲板旗点重绑 (15h)
}catch(e2){ console.error('[海战] 大舰复位失败',e2); }
}
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
