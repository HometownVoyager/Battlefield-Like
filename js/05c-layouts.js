// ─────────────────────────────────────────────
// 05c-layouts.js —— 各战役布局/大桥/世界组装 (buildWorld/旗帜/弹药箱/MG42)
// 2026-08-24 由 05-world.js 切分: 原第 966-1510 行
// ═══════════ 各战役独立布局 (建筑经选址校验, 道具避让建筑足迹) ═══════════
// 围田树篱段中心记录 (诺曼底博卡日): 供沙箱断言"旗点净空"——围田树篱不得侵入旗点圈
const RURAL_HEDGES=[]; // 树篱点位登记: 仅沙箱断言读 (verify-layouts 树篱覆盖检查)
// -- 诺曼底: 乡村田园 --
function layoutRural(){
let p;
// ★2026-09-26 修 (P2-15 教堂复合体足迹): 本函数产出"大殿 10×16 + 前接钟塔 5×5"的复合体 ——
//   钟塔在局部 z=-10.6, 复合体总长 21.1m, **真实中心在局部 z=-2.55** (只把大殿中心当(x,z)的调用方
//   会把塔楼整整探出选址矩形 2.55m: 那一截既不进 placeAt 的足迹校验、也不进 B_FOOT 台账 ——
//   道具/建筑可以压在钟塔上)。选址矩形 11.5×21.6 本来就是**复合体**尺度 ⇒ 用 oz=-2.55 把校验
//   矩形挪到复合体中心 (与诺曼底那条同规, 全图统一)。
p=placeAt(3,-2,0,11.5,21.6,{oz:-2.55,maxDh:1.6}); buildChurch(p.x,p.z,p.ry);
p=placeAt(-11,12,0,7,8); ruinedHouse(p.x,p.z,7,8,p.ry,MAT.plaster,0.5);
p=placeAt(16,14,HPI,8,7); ruinedHouse(p.x,p.z,8,7,p.ry,MAT.brick,0.7);
p=placeAt(14,-18,0,6,8); ruinedHouse(p.x,p.z,6,8,p.ry,MAT.plaster,0.6);
{ const g0=heightAt(3,18); mesh(new THREE.CylinderGeometry(1.1,1.2,0.9,10),MAT.stone,3,g0+0.45,18); CYLS.push({x:3,z:18,r:1.2,y0:g0,y1:g0+0.9}); }
{ const px=7, pz=22; if(freeSpot(px,pz,1)) crate(px,pz, 1.2,0.4); };
{ const px=0, pz=21; if(freeSpot(px,pz,1)) barrel(px,pz); };
crater(-5,6,2.4); crater(21,4,1.9);
p=placeAt(-21,-10,0.15,8.5,9.5); twoStoryHouse(p.x,p.z,p.ry,MAT.brick);
p=placeAt(-70,46,0.2,9.5,13.5); buildBarn(p.x,p.z,p.ry); // 原(-72,26)压住旗点A(-70,22); (-77,30)又会穿 L 形石墙, 取北侧空地
p=placeAt(-62,12,0.2,7,7); ruinedHouse(p.x,p.z,7,7,p.ry,MAT.plaster,0.4);
stoneWall(-84,34,-63,38.2); stoneWall(-84,10,-84,34); // 原墙延伸到(-58,38)会穿过 (-54,34) 两层楼屋角
{ const px=-66, pz=32; if(freeSpot(px,pz,1.5)) crate(px,pz, 1.2,0.7); };
{ const px=-60, pz=16; if(freeSpot(px,pz,1)) barrel(px,pz); };
placeTower(-78,8);
p=placeAt(-54,34,0.5,8.5,9.5); twoStoryHouse(p.x,p.z,p.ry,MAT.plaster);
for(let i=0;i<3;i++){
const hx=-52+i*4, hz=30+wr(-2,2);
if(!freeSpot(hx,hz,2)) continue;
const g0=heightAt(hx,hz);
const hA=heightAt(hx+0.8,hz), hB=heightAt(hx-0.8,hz);
const m=mesh(new THREE.CylinderGeometry(1.1,1.1,1.6,12),MAT.hay,hx,g0+1.1,hz);
m.quaternion.setFromUnitVectors(_UP,_N.set(1,(hA-hB)/1.6,0).normalize());
CYLS.push({x:hx,z:hz,r:1.15,y0:g0,y1:g0+2.2}); coverPoints.push({x:hx,z:hz-2});
}
p=placeAt(-35,-77,-0.3,9.5,13.5); buildBarn(p.x,p.z,p.ry); // 原(-30,-72)压住旗点B(-26,-66)
p=placeAt(-14,-60,0.3,7,7); ruinedHouse(p.x,p.z,7,7,p.ry,MAT.plaster,0.5);
hedgerow(-46,-56,-26,-48);
crater(-22,-68,2.0);
{ const px=-38, pz=-66; if(freeSpot(px,pz,1.5)) hedgehog(px,pz); };
p=placeAt(24,72,0.2,8.5,9.5); twoStoryHouse(p.x,p.z,p.ry,MAT.brick);
p=placeAt(38,62,-0.2,7,8); ruinedHouse(p.x,p.z,7,8,p.ry,MAT.plaster,0.7);
p=placeAt(20,58,HPI,6,6); ruinedHouse(p.x,p.z,6,6,p.ry,MAT.brick,0.6);
stoneWall(12,78,34,82);
placeTower(46,74);
{ const px=24, pz=52; if(freeSpot(px,pz,1.5)) hedgehog(px,pz); };
p=placeAt(72,-20,0,8,9); ruinedHouse(p.x,p.z,8,9,p.ry,MAT.brick,0.9);
p=placeAt(62,-32,HPI,7,7); ruinedHouse(p.x,p.z,7,7,p.ry,MAT.brick,0.85);
p=placeAt(82,-32,0,6,7); ruinedHouse(p.x,p.z,6,7,p.ry,MAT.plaster,0.9);
p=placeAt(76,-8,HPI,7,6); ruinedHouse(p.x,p.z,7,6,p.ry,MAT.plaster,0.75);
{ const px=68, pz=-26; if(freeSpot(px,pz,2.5)) rubblePile(px,pz, 2.2); };
{ const px=78, pz=-22; if(freeSpot(px,pz,2.5)) rubblePile(px,pz, 1.8); };
crater(74,-28,2.6); crater(64,-18,2.2);
{ const px=60, pz=-14; if(freeSpot(px,pz,1.5)) hedgehog(px,pz); };
{ const px=84, pz=-26; if(freeSpot(px,pz,1.5)) hedgehog(px,pz); };
placeTower(84,-8);
p=placeAt(58,-44,-0.3,8.5,9.5); twoStoryHouse(p.x,p.z,p.ry,MAT.brick);
stoneWall(-40,-14,-24,-20); stoneWall(30,16,46,10);
hedgerow(-46,-34,-16,-40); hedgerow(20,34,52,28);
hedgerow(-30,44,10,46);
{ const px=-44, pz=4; if(freeSpot(px,pz,1.5)) hedgehog(px,pz); };
{ const px=44, pz=2; if(freeSpot(px,pz,1.5)) hedgehog(px,pz); };
crater(-38,-6,2.4); crater(32,6,2.2); crater(-28,26,2.0);
{ const px=-20, pz=-24; if(freeSpot(px,pz,1.5)) deadTree(px,pz); };
{ const px=26, pz=-10; if(freeSpot(px,pz,1.5)) deadTree(px,pz); };
{ const px=-6, pz=34; if(freeSpot(px,pz,1.5)) deadTree(px,pz); };
// ── 博卡日农田面衣: 农庄果园 (小树簇, 放在无田块的空地/村心, 避免顶掉围田树篱) ──
for(const [ox,oz] of [[-106,18],[-86,-6],[26,34],[46,-6]]){
for(let i=0;i<7;i++){
const x=ox+wr(-6,6), z=oz+wr(-6,6);
if(roadDist(x,z)<6||!freeSpot(x,z,1.2)) continue;
tree(x,z,0.5+wr(0,0.18));
}
}
// ── 博卡日围田: 沿田块四面断续树篱 (每面2~3段, 段间6~12m豁口, 公路/旗点/战壕自动避让) ──
if(RURAL_FIELDS.length){
for(const f of RURAL_FIELDS){
const sides=[[f.x0,f.z0,f.x1,f.z0],[f.x1,f.z0,f.x1,f.z1],[f.x1,f.z1,f.x0,f.z1],[f.x0,f.z1,f.x0,f.z0]];
for(const s of sides){
const len=Math.hypot(s[2]-s[0],s[3]-s[1]);
let t=wr(0.04,0.12);
const n=3;
for(let i=0;i<n&&t<0.86;i++){
const sl=wr(10,16)/len;
if(t+sl>0.98) break;
const x1=s[0]+(s[2]-s[0])*t, z1=s[1]+(s[3]-s[1])*t;
const x2=s[0]+(s[2]-s[0])*(t+sl), z2=s[1]+(s[3]-s[1])*(t+sl);
const mx=(x1+x2)/2, mz=(z1+z2)/2;
let ok=true;
for(const fc of CAMPAIGN.flags){
if(Math.hypot(mx-fc.x,mz-fc.z)<fc.r+7||Math.hypot(x1-fc.x,z1-fc.z)<fc.r+5||Math.hypot(x2-fc.x,z2-fc.z)<fc.r+5){ ok=false; break; }
}
if(roadDist(mx,mz)<10) ok=false;
for(const tn of (CAMPAIGN.trench||[])){
// 段中心到战壕线距离 (内联 segDist, 沙箱无此全局)
const tdx=tn[2]-tn[0], tdz=tn[3]-tn[1];
const tl=tdx*tdx+tdz*tdz||1;
const tt=clamp(((mx-tn[0])*tdx+(mz-tn[1])*tdz)/tl,0,1);
if(Math.hypot(mx-(tn[0]+tdx*tt),mz-(tn[1]+tdz*tt))<5){ ok=false; break; }
}
if(ok){ hedgerow(x1,z1,x2,z2); RURAL_HEDGES.push({x:mx,z:mz}); }
t+=sl+wr(0.14,0.26);
}
}
}
}
}
// ═══════════ 城市组共用 (2026-09-05 城市组·斯大林格勒/柏林) ═══════════
// 语义分区表驱动: CAMPAIGN.city.streets(街道矩形)/blocks(街块) —— 03-terrain 色带/布局/小地图共读
// 沿街成排建筑: 每个街块找最近街缘, 沿缘成排落位 (面朝街道) —— 街廊由建筑"墙"围合, 不再草地撒房
// spacing (可选): 同排建筑间距, 默认 16m (斯大林格勒/原柏林行为不变); 柏林 640 大地图放宽到 24m 控建筑总量
function cityBlockRows(heavy,spacing){
const ct=CAMPAIGN.city; if(!ct) return;
const SP=spacing||16;
for(const b of ct.blocks){
// 找最近街缘 (W/E/N/S) 决定本排朝向
let best=1e9, side='W';
for(const s of ct.streets){
const dW=Math.abs(s.x1-b.x0), dE=Math.abs(s.x0-b.x1), dN=Math.abs(s.z1-b.z0), dS=Math.abs(s.z0-b.z1);
if(dW<best){best=dW;side='W';} if(dE<best){best=dE;side='E';}
if(dN<best){best=dN;side='N';} if(dS<best){best=dS;side='S';}
}
const alongZ=side==='W'||side==='E';
const len=alongZ?b.z1-b.z0:b.x1-b.x0;
const n=Math.max(1,Math.round(len/SP)); // 间距 > 最大楼宽 11.5+抖动 —— 同排建筑不相交
for(let i=0;i<n;i++){
const u=(alongZ?b.z0:b.x0)+len*(i+0.5)/n+wr(-1.4,1.4);
const dep=9+wr(0,3), wid=8+wr(0,2.5);
let bx,bz,ry;
const off=dep/2+2.6;
if(side==='W'){bx=b.x0+off;bz=u;ry=-HPI;}
else if(side==='E'){bx=b.x1-off;bz=u;ry=HPI;}
else if(side==='N'){bz=b.z0+off;bx=u;ry=Math.PI;}
else{bz=b.z1-off;bx=u;ry=0;}
if(streetDist(bx,bz)<dep/2+4.0) continue; // 锚点距街缘≥进深一半+4 (含 placeAt ±2.5 抖动与足迹余量)
const p=placeAt(bx,bz,ry,wid,dep,{maxDh:1.2});
if(!p) continue;
// placeAt 兜底强放会绕过旗点检查 —— 落位后复核旗点净距, 过近则弃建 (足迹保留成豁口)
let nearFlag=false;
for(const fc of CAMPAIGN.flags){ if(Math.hypot(p.x-fc.x,p.z-fc.z)<Math.max(wid,dep)*0.5+4.2){ nearFlag=true; break; } }
if(nearFlag) continue;
const roll=wr(0,1);
if(roll<0.42) ruinBlock(p.x,p.z,p.ry,wid>9?11.5:10.5,dep-1.2);
else if(roll<0.74) ruinedHouse(p.x,p.z,wid,dep,p.ry,wr(0,1)<0.5?MAT.brick:MAT.plaster,heavy?0.82:0.62);
else twoStoryHouse(p.x,p.z,p.ry,MAT.brick);
}
}
}
// 旗点通用点缀 (城市版): 沙袋弧/杂物/瓦砾/弹坑/拒马 + 旗间街口钢轨街垒
// lim (可选): 街垒只铺在限界矩形内 (柏林 640 大地图: 郊野不铺街垒; 省略=全图, 斯大林格勒行为不变)
function cityDressing(heavy,lim){
const ct=CAMPAIGN.city;
const inLim=(x,z)=>!lim||(x>lim.x0&&x<lim.x1&&z>lim.z0&&z<lim.z1);
// 纵街街口的钢轨街垒线 (可绕不可碾 —— 街道路喉)
for(const s of ct.streets){
const cx=(s.x0+s.x1)/2;
if(s.x1-s.x0<s.z1-s.z0){ // 纵街: 沿 z 每隔一段
for(let z=s.z0+14;z<s.z1-10;z+=wr(20,30)){
if(wr(0,1)<0.42) continue;
const bx=cx+wr(-2,2), bry=wr(0,1)<0.5?0:HPI;
if(inLim(bx,z)) railBarricade(bx,z,bry);
}
}else{ // 横街: 沿 x
for(let x=s.x0+16;x<s.x1-12;x+=wr(22,32)){
if(wr(0,1)<0.42) continue;
const bz=(s.z0+s.z1)/2+wr(-2,2), bry=wr(0,1)<0.5?0:HPI;
if(inLim(x,bz)) railBarricade(x,bz,bry);
}
}
}
// 旗点周边: 沙袋弧+杂物+瓦砾+弹坑 (通用点缀)
CAMPAIGN.flags.forEach(f=>{
{ const px=f.x+wr(-8,8), pz=f.z+wr(-8,8); if(freeSpot(px,pz,2)) sandbagWall(px,pz,4,wr(0,3)); };
{ const px=f.x+wr(-7,7), pz=f.z+wr(-7,7); if(freeSpot(px,pz,1.2)) crate(px,pz,1.2,wr(0,3)); };
{ const px=f.x+wr(-8,8), pz=f.z+wr(-8,8); if(freeSpot(px,pz,1)) barrel(px,pz); };
{ const px=f.x+wr(-10,10), pz=f.z+wr(-10,10); if(freeSpot(px,pz,2)) rubblePile(px,pz,wr(1.6,2.4)); };
{ const px=f.x+wr(-9,9), pz=f.z+wr(-9,9); if(freeSpot(px,pz,2)) crater(px,pz,wr(1.8,2.4)); };
{ const px=f.x+wr(-9,9), pz=f.z+wr(-9,9); if(freeSpot(px,pz,1.5)) hedgehog(px,pz); };
});
}
// 防御工事模板 (2026-09-05): 守方旗点朝进攻方基地方向的路喉 —— 钢轨街垒对+机枪位+铁丝网
// 1.25× 兵力差的阵地补偿 (本批先落柏林 defSide; 其余攻防图后续批次套用)
function defWorks(defTeam){
// 工事归属方 (谁的火力点): 缺省读 CAMPAIGN.defSide (00-config 单源, 与该图 defWorks 调用点同值) ——
// 旧版把 1/0 写死在两个调用点上, 配置里的 defSide 反倒没人读 (死配置, 2026-09-26 归位)。
if(defTeam===undefined) defTeam=(CAMPAIGN.defSide!==undefined?CAMPAIGN.defSide:DEF);
const atkB=CAMPAIGN.bases[ATK]||basePos(ATK);
// ★2026-09-26 修 (归属脱钩, P0-2): 攻方开局旗圈不摆守方工事 —— 判据与 23-deploy 的开局归属**同源**
// (00-config attackerFlagPicks: 距攻方基地最近的 ≥5旗取2/其余取1), 只在攻防模式生效
// (破袭模式全部旗归守方 ⇒ 无豁免, 行为不变)。旧版遍历全旗点不校验归属: 柏林/莫斯科各把 2 个
// "距攻方基地最近、开局即归攻方"的旗当成己方阵地摆满街垒/机枪位/铁丝网(全部面朝攻方) ——
// 攻方在自己旗圈里被面朝自己的工事压制 (塔拉瓦早有一份 130m 版豁免并注明这是"攻方被反推下海的主因之一")。
const atkPick=(GAMEMODE==='assault')?attackerFlagPicks(CAMPAIGN.flags):[];
for(const f of CAMPAIGN.flags){
if(atkPick.indexOf(f)>=0) continue;
const face=Math.atan2(atkB.x-f.x,atkB.z-f.z);
const fx=Math.sin(face), fz=Math.cos(face);
// 旗外 11m 街垒对 (横向封路, 中间留 2m 缝 —— 可通行可火力封锁); freeSpot 预检: 不进建筑足迹
const bx=f.x+fx*11, bz=f.z+fz*11;
if(freeSpot(bx+fz*2.8,bz-fx*2.8,1.8)&&propFree(bx+fz*2.8,bz-fx*2.8,1.7)) railBarricade(bx+fz*2.8,bz-fx*2.8,face+HPI);
if(freeSpot(bx-fz*2.8,bz+fx*2.8,1.8)&&propFree(bx-fz*2.8,bz+fx*2.8,1.7)) railBarricade(bx-fz*2.8,bz+fx*2.8,face+HPI);
// 机枪位 (旗外 7m 侧位, 朝进攻方) —— 预检净位再上 (mg42 内部只查道具互斥, 不查建筑足迹)
let mgDone=false;
for(const [ox,oz] of [[-fz*4.5,fx*4.5],[fz*4.5,-fx*4.5],[fz*6.5,-fx*6.5],[-fz*6.5,fx*6.5]]){
const mx=f.x+fx*7+ox, mz=f.z+fz*7+oz;
if(freeSpot(mx,mz,2.6)&&propFree(mx,mz,2.3)){ mg42(mx,mz,face,defTeam); mgDone=true; break; }
}
if(freeSpot(f.x+fx*9+fz*1.5,f.z+fz*9-fx*1.5,2)&&propFree(f.x+fx*9+fz*1.5,f.z+fz*9-fx*1.5,2.7)) sandbagWall(f.x+fx*9+fz*1.5,f.z+fz*9-fx*1.5,3.5,face+HPI);
// 铁丝网一道 (旗外 14m)
if(freeSpot(f.x+fx*14+fz*2,f.z+fz*14-fx*2,1.5)&&propFree(f.x+fx*14+fz*2,f.z+fz*14-fx*2,2.3)) barbedWire(f.x+fx*14+fz*2,f.z+fz*14-fx*2,face+HPI,3.6);
}
}
// -- 城市组·斯大林格勒 (2026-09-06 点位改版): 对角双主基 + 14 旗梯次争夺 + 红十月厂区(北移, 苏军坦克产能) --
// 布局拓扑 (用户草图): 德主基西南/苏主基东北, 旗链沿对角轴两翼交错; 厂区居北(厂房旗+坦克厂),
// 集体农庄田地居东(田地旗, 复用农田软遮蔽), 中央=电车广场拉锯带
function layoutStalingrad(){
cityBlockRows(false);
redOctober(22,-90,0); // 红十月厂区北移 (yard 局部 x±41/z±35 → world -19..63,-125..-55; 厂房旗=南院, 苏军坦克厂)
// 电车大街 (主街 z9): 轨道+线杆+两节残骸 (可进入车厢) —— 教堂旗东侧 / 红屋旗西北街段
tramRails(-120,120,9);
tramWreck(-64,8.8,HPI+0.06);
tramWreck(44,9.2,HPI-0.05);
// 铁道口旗: 西郊岔线 (轨道横穿旗心=道口) + 编组站旗: 东郊调车线 (东墙轨隙 z=-66 对位)
tramRails(-136,-56,-22);
tramRails(66,124,-66);
// 烧毁坦克残骸: 铁道口东南 / 编组站西南
tankWreck(-70,-16,0.5);
tankWreck(84,-34,-0.4);
// ── 谷仓旗: 大粮仓 (城北地标) + 干草垛 + 仓院 ──
{ const p=placeAt(-78,-58,0.2,9.5,13.5); if(p) buildBarn(p.x,p.z,p.ry); }
{ const px=-48,z0=-70; if(freeSpot(px,z0,2)){ const g0=heightAt(px,z0);
const m=mesh(new THREE.CylinderGeometry(1.1,1.1,1.6,12),MAT.hay,px,g0+1.1,z0);
CYLS.push({x:px,z:z0,r:1.15,y0:g0,y1:g0+2.2}); coverPoints.push({x:px,z:z0-2}); } }
{ const px=-70,z0=-74; if(freeSpot(px,z0,2)){ const g0=heightAt(px,z0);
const m=mesh(new THREE.CylinderGeometry(1.1,1.1,1.6,12),MAT.hay,px,g0+1.1,z0);
CYLS.push({x:px,z:z0,r:1.15,y0:g0,y1:g0+2.2}); coverPoints.push({x:px,z:z0-2}); } }
// ── 教堂旗: 烧毁教堂 (V1 纵街西侧, 长轴南北向; 足迹避主街 z16/V1 x-60) + 墓园残墙 ──
{ const p=placeAt(-68,30,0,11.5,21.6,{oz:-2.55,maxDh:1.6}); if(p) buildChurch(p.x,p.z,p.ry); } // 复合体足迹: 见 layoutRural 首条注释
stoneWall(-72,44,-63,46); stoneWall(-36,20,-28,22);
// ── 水塔旗: 给水塔 (4 腿+水箱+锥顶, 全铁骨架; 街西 12m) ──
waterTower(-25,-46);
// ── 砖窑旗: 窑场 (砖基座窑炉×3 = machineBlock) + 坯垛 ──
machineBlock(48,44,0.3); machineBlock(60,44,-0.2); machineBlock(52,62,0.1);
ingotStack(62,58,0.4);
// ── 红屋旗: 红砖角楼 (两层, 主街南缘, 足迹避街) + 路口钢轨街垒 ──
{ const p=placeAt(56,24,HPI,8.5,9.5); if(p) twoStoryHouse(p.x,p.z,p.ry,MAT.brick); }
railBarricade(44,6,0);
// ── 南村旗: 木屋村舍组团 (德军主基前出村落, 分列 V1 村街两侧) ──
{ const p=placeAt(-66,96,0.15,6,5); if(p) logCabin(p.x,p.z,p.ry); }
{ const p=placeAt(-42,112,-0.25,6,5); if(p) logCabin(p.x,p.z,p.ry); }
{ const p=placeAt(-70,110,0.4,6,5); if(p) logCabin(p.x,p.z,p.ry); }
// ── 货栈旗: 木材货栈 (仓房+围墙, 西缘) ──
{ const p=placeAt(-132,56,0.1,9.5,13.5); if(p) buildBarn(p.x,p.z,p.ry); }
stoneWall(-142,30,-128,30);
// ── 医院旗: 街块成排废楼由 cityBlockRows 落位 (医院院区); 补院墙 ──
stoneWall(-96,58,-78,62);
// ── 田地旗: 农庄仓房 (田块西南角外) + 田埂草垛 (麦茬田=fields 软遮蔽, 03-terrain 色带) ──
{ const p=placeAt(88,-50,0.2,9.5,13.5); if(p) buildBarn(p.x,p.z,p.ry); }
{ const px=104,z0=-8; if(freeSpot(px,z0,2)){ const g0=heightAt(px,z0);
const m=mesh(new THREE.CylinderGeometry(1.1,1.1,1.6,12),MAT.hay,px,g0+1.1,z0);
CYLS.push({x:px,z:z0,r:1.15,y0:g0,y1:g0+2.2}); coverPoints.push({x:px,z:z0-2}); } }
// ── 洼地旗: 弹坑群+铁丝网 (南翼凹地) ──
crater(-22,64,2.6); crater(-10,74,2.2); crater(-18,78,2.0);
barbedWire(-24,62,HPI,4.2);
// ── 编组站旗: 调车场杂物 (坯垛/油桶/沙袋; 避开田庄仓房足迹 81..95,-59..-41) ──
ingotStack(84,-76,0.2); barrel(100,-58); sandbagWall(92,-62,3.5,0.4);
// ── 城市街景 (中央拉锯带): 广场瓦砾与弹坑 ──
cityDressing(false);
crater(-16,-20,2.2); crater(20,14,2.0); rubblePile(-26,2,2.0); rubblePile(12,-24,1.8);
// 西郊白桦残林 (货栈-铁道口一线, 严冬枯树为主 → THEME.dead 概率由通用散布承担, 此处补丛)
for(const [ox,oz] of [[-118,10],[-108,-40],[-124,84]]){
for(let i=0;i<5;i++){
const x=ox+wr(-7,7), z=oz+wr(-7,7);
if(roadDist(x,z)<7||!freeSpot(x,z,1.2)) continue;
tree(x,z,0.5+wr(0,0.18));
}
}
// 中央广场电车轨迹旁的瓦砾与弹坑 (街景)
crater(-4,18,2.2); rubblePile(6,-18,1.8);
}
// 给水塔 (斯大林格勒 水塔旗地标, 2026-09-06): 4 钢腿 + 环梁 + 水箱 + 锥顶
// 空间账: 腿高 5.2 (r0.14 圆柱碰撞), 水箱 r2.2/h2.6 底面 5.0 (腿顶 5.2 咬入箱底 0.2), 锥顶高 1.4;
// 塔下净空 5.0-0.2>人员 1.8 → 塔底可穿行; 总高 9.2 = 城区次高点 (红十月烟囱 15 为主参照)
function waterTower(x,z){
if(!propFree(x,z,3)) return;
propTake(x,z,3);
const g0=heightAt(x,z);
for(const [ox,oz] of [[-1.5,-1.5],[1.5,-1.5],[-1.5,1.5],[1.5,1.5]]){
mesh(new THREE.CylinderGeometry(0.12,0.16,5.2,8),MAT.metalDark,x+ox,g0+2.6,z+oz);
CYLS.push({x:x+ox,z:z+oz,r:0.17,y0:g0,y1:g0+5.2});
}
mesh(boxGeo(3.8,0.25,3.8),MAT.woodDark,x,g0+5.1,z); // 承台环梁 (visual)
const tank=mesh(new THREE.CylinderGeometry(2.0,2.2,2.6,12),MAT.metal,x,g0+6.5,z);
CYLS.push({x,z,r:2.2,y0:g0+5.2,y1:g0+7.8});
mesh(new THREE.ConeGeometry(2.25,1.4,12),MAT.roof,x,g0+8.5,z);
addSnowCap(tank);
}
// ═══════════ 柏林加密三件套 (2026-09-09 用户实机反馈"柏林城内太过于空荡") ═══════════
// 只被 layoutBerlin 调用 (其它战役零漂移)。三层:
//   ①berlinBlockWalls —— 街块围合: 沿街块四边落排楼 (terrace)/公寓, 补足 cityBlockRows 只沿最近街缘一排的缺口;
//   ②berlinCourtyards —— 庭院填充: 街块内部棚屋/瓦砾/弹坑/枯树/沙袋/车残骸 (核心区密, 郊野带疏);
//   ③berlinStreet —— 街道家具: 主街电车轨+残骸+街灯+瓦砾带+车残骸/弹坑/枯树散布
// 空间逻辑核算: 核心街块 59×79m 四边围合 (排楼 22~30m + 巷 8~14m), 内院余 30×55m 作庭院;
//   郊野带街块只做半数组边 (废墟带语义) —— 建筑落位全部走 placeAt (足迹/旗点/道路/高差四重校验)
function berlinBlockWalls(){
const ct=CAMPAIGN.city; if(!ct) return;
for(const b of ct.blocks){
const core=Math.abs((b.z0+b.z1)/2)<108; // 核心城区 (两横街之间) / 郊野带
// 最近街缘 = cityBlockRows 已占用的那一边 (同判定式) —— 跳过它, 免得长街墙挤不进同一条线白试 8 次
let best=1e9, used='W';
for(const s of ct.streets){
const dW=Math.abs(s.x1-b.x0), dE=Math.abs(s.x0-b.x1), dN=Math.abs(s.z1-b.z0), dS=Math.abs(s.z0-b.z1);
if(dW<best){best=dW;used='W';} if(dE<best){best=dE;used='E';}
if(dN<best){best=dN;used='N';} if(dS<best){best=dS;used='S';}
}
const Lmin=core?20:16, Lmax=core?32:26;
const fd=core?(wr(0,1)<0.5?11:10):9;
const edges=[
['N',b.x1-b.x0,(u)=>[b.x0+u, b.z0+fd/2+2.6, Math.PI]],
['S',b.x1-b.x0,(u)=>[b.x0+u, b.z1-fd/2-2.6, 0]],
['W',b.z1-b.z0,(u)=>[b.x0+fd/2+2.6, b.z0+u, -HPI]],
['E',b.z1-b.z0,(u)=>[b.x1-fd/2-2.6, b.z0+u, HPI]]];
for(const [side,len,at] of edges){
if(side===used) continue;
if(!core&&side!=='S'&&wr(0,1)<0.5) continue; // 郊野带: 只南边必做, 其余半数
let u=15+wr(0,4); // 角部内缩 15m: 让开 cityBlockRows 主排的转角楼 (实测 7m 内缩 → 189 次足迹相撞)
const uEnd=len-15-wr(0,4);
while(u<uEnd-14){
const L=Math.min(wr(Lmin,Lmax),uEnd-u);
if(L<Lmin*0.8) break;
const [bx,bz,ry]=at(u+L/2);
u+=L+wr(6,core?11:15)+2; // 推进量按计划长度 (与放置结果无关, 保证节奏稳定)
if(streetDist(bx,bz)<fd/2+4.0) continue; // 锚点距街缘≥进深一半+4 (同 cityBlockRows)
let nearFlag=false;
for(const fc of CAMPAIGN.flags){ if(Math.hypot(bx-fc.x,bz-fc.z)<Math.max(L,fd)*0.5+4.2){ nearFlag=true; break; } }
if(nearFlag) continue;
// 主力 = 街墙废墟 (便宜, 足迹只占 4m —— 实心墙+端部返墙); 少量排楼/公寓做可进入建筑 (占全进深)
// strict: 挤不进就放弃 —— 绝不兜底强放压住已有建筑
const r=wr(0,1);
const dep=r<0.24?fd:4.0;
// 长度逐级回退: 街块里已有旗区道具/主排建筑, 长墙挤不进就换短墙 (32→20→13m, 残段仍是街墙)
let p=null, Lp=L;
for(const f of [1,0.62,0.42]){
Lp=Math.max(8,L*f);
p=placeAt(bx,bz,ry,Lp,dep,{maxDh:1.2,strict:true});
if(p) break;
}
if(!p) continue;
if(r<0.16) terrace(p.x,p.z,p.ry,Lp,fd);
else if(r<0.24) ruinedHouse(p.x,p.z,Lp,fd,p.ry,wr(0,1)<0.5?MAT.brick:MAT.plaster,0.42);
else facadeRuin(p.x,p.z,p.ry,Lp);
}
}
}
}
function berlinCourtyards(){
const ct=CAMPAIGN.city; if(!ct) return;
for(const b of ct.blocks){
const core=Math.abs((b.z0+b.z1)/2)<108;
const n=core?12:6;
for(let i=0;i<n;i++){
const x=b.x0+12+wr(0,Math.max(1,b.x1-b.x0-24));
const z=b.z0+12+wr(0,Math.max(1,b.z1-b.z0-24));
if(!freeSpot(x,z,2.2)) continue;
const r=wr(0,1);
if(r<0.30) rubblePile(x,z,wr(1.5,2.6));
else if(r<0.48) crater(x,z,wr(1.6,2.4));
else if(r<0.62) deadTree(x,z);
else if(r<0.72) sandbagWall(x,z,3.5,wr(0,3));
else if(r<0.80) carWreck(x,z,wr(0,3));
else if(r<0.88) hedgehog(x,z);
else if(r<0.94) crate(x,z,1.2,wr(0,3));
else barrel(x,z);
}
// 庭院棚屋 (核心区 1~2 座/块): 小体量砖房 (残破度高 = 后院棚厦)
const nS=core?2:1;
for(let k=0;k<nS;k++){
if(!core&&wr(0,1)<0.5) continue;
const x=b.x0+(b.x1-b.x0)/2+wr(-9,9), z=b.z0+(b.z1-b.z0)/2+wr(-11,11);
const p=placeAt(x,z,wr(0,TAU),7,6,{maxDh:1.2,strict:true});
if(p) ruinedHouse(p.x,p.z,7,6,p.ry,MAT.brick,0.55);
}
}
}
function berlinStreet(){
// 主街电车 (东西大道 z=0): 双轨+架空线 —— 分三段避开地铁广场/隧道 (x -80..-40 空出)
tramRails(-244,-80,0); tramRails(-40,120,0); tramRails(160,244,0);
tramWreck(-120,4.6,HPI+0.05); tramWreck(64,-4.6,HPI-0.04); tramWreck(-176,4.6,HPI+0.03);
// 街灯: 主街两侧 + 中央纵街 (x=-70) 两侧
for(let x=-250;x<=250;x+=34){
lampPost(x,7.2,Math.PI/2); lampPost(x+17,-7.2,-Math.PI/2);
}
for(let z=-190;z<=190;z+=34){
if(Math.abs(z)<12) continue;
lampPost(-63.4,z,0); lampPost(-76.6,z,Math.PI);
}
// 街边瓦砾带 (沿主街两侧建筑线): 成片碎石, 贴墙铺开
debrisLine(-236,10.8,150,10.8,15);
debrisLine(-236,-10.8,150,-10.8,15);
// 街道散布 (车残骸/弹坑/枯树/沙袋/拒马/油桶): 主街与中央纵街沿线
const scatter=(x,z)=>{
if(!freeSpot(x,z,2.2)) return;
const r=wr(0,1);
if(r<0.28) carWreck(x,z,wr(0,3));
else if(r<0.50) crater(x,z,wr(1.6,2.2));
else if(r<0.62) deadTree(x,z);
else if(r<0.72) sandbagWall(x,z,3.2,wr(0,3));
else if(r<0.82) hedgehog(x,z);
else if(r<0.92) barrel(x,z);
};
for(let x=-244;x<=244;x+=26) scatter(x+wr(-4,4),wr(-6,6));
for(let z=-200;z<=200;z+=26){ if(Math.abs(z)<12) continue; scatter(-70+wr(-6,6),z+wr(-4,4)); }
}
// -- 城市组·柏林 (2026-09-09 点位改版): 640 大地图 + 三路推进 6 旗 + 国会大厦/防空塔双地标 + 地铁站厅 --
// 布局拓扑 (用户定案): 苏军主基西侧(-290,0) / 德军主基东侧(290,0), 六旗 2D 扇面:
//   ①北站场(-190,148) ②南街区(-190,-148) = 两翼出发阵地 (距苏基最近, 开局自动归攻方);
//   ③市中心(-55,0) = 中央地铁广场 (站厅+地下通道); ④防空塔(-55,198) ⑤街垒区(-55,-198) = 南北纵深;
//   ⑥国会大厦(150,0) = 东端终点大城标 (德军主基前 140m)
function layoutBerlin(){
cityBlockRows(true,24); // 640 大地图: 间距放宽到 24m 控建筑总量 (58→48 栋量级)
// 通用小件 (仅本图): 无杆轨道线 (纯视觉不占位) / 平板车皮 (坦克不可碾) / 街垒段线
const railLine=(x0,x1,z)=>{
for(let x=x0;x<x1-2;x+=4){
const xm=x+2, g0=heightAt(xm,z);
mesh(boxGeo(4,0.1,0.12),MAT.metalDark,xm,g0+0.05,z-0.75,0,false,true);
mesh(boxGeo(4,0.1,0.12),MAT.metalDark,xm,g0+0.05,z+0.75,0,false,true);
mesh(boxGeo(4,0.14,0.5),MAT.woodDark,xm,g0+0.02,z,0,false,true);
}
};
const railFlatcar=(x,z,ry)=>{
if(!propFree(x,z,4.0)||!freeSpot(x,z,3.9)) return;
propTake(x,z,4.0);
const fit=groundFit(x,z,ry,1.6,3.9);
solidBox(MAT.metalDark,3.0,1.25,7.5,x,fit.y+0.85,z,ry); // 车皮 (无 crush: 坦克不可碾)
for(const wz of [-2.6,2.6]){
const qx=x+Math.sin(ry)*wz, qz=z+Math.cos(ry)*wz;
const wh=new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.4,2.6,9),MAT.metalDark);
wh.position.set(qx,fit.y+0.4,qz);
wh.rotation.order='YXZ'; wh.rotation.y=ry; wh.rotation.z=HPI;
wh.castShadow=true; world.add(wh);
}
coverPoints.push({x:x+Math.cos(ry)*2.4,z:z-Math.sin(ry)*2.4},{x:x-Math.cos(ry)*2.4,z:z+Math.sin(ry)*2.4});
};
const barricadeLine=(x0,z0,x1,z1,step)=>{
const len=Math.hypot(x1-x0,z1-z0), ry=Math.atan2(x1-x0,z1-z0)+HPI;
const n=Math.max(1,Math.round(len/step));
for(let i=0;i<n;i++){
const t=(i+0.5)/n;
railBarricade(x0+(x1-x0)*t+wr(-0.8,0.8), z0+(z1-z0)*t+wr(-0.8,0.8), ry+wr(-0.12,0.12));
}
};
// ── ① 北站场: 铁路货场 (轨道横贯旗区 + 平板车皮 + 货栈 + 烧毁坦克) ──
railLine(-226,-178,140); railLine(-226,-178,156);
railFlatcar(-208,140,HPI+0.03); railFlatcar(-188,156,HPI-0.04);
{ const p=placeAt(-186,172,0.12,9.5,13.5,{maxDh:1.2}); if(p) buildBarn(p.x,p.z,p.ry); }
tankWreck(-214,168,0.5);
ingotStack(-204,126,0.3); ingotStack(-186,122,-0.2);
crate(-196,132,1.2,0.5); barrel(-200,170);
// ── ② 南街区: 居民街区 (成排废楼由 cityBlockRows 落位) + 街垒网 + 瓦砾 + 弹坑 ──
barricadeLine(-214,-134,-214,-164,9);
barricadeLine(-166,-134,-166,-164,9);
tankWreck(-206,-168,-0.5);
for(const [rx,rz] of [[-190,-124],[-184,-172],[-172,-138]]){
for(let i=0;i<2;i++){
const px=rx+wr(-3,3), pz=rz+wr(-3,3);
if(freeSpot(px,pz,2)) rubblePile(px,pz,wr(1.8,2.6));
}
}
if(freeSpot(-198,-150,2.2)) crater(-198,-150,2.2); if(freeSpot(-180,-160,2.2)) crater(-180,-160,2.0);
// ── ③ 市中心: 地铁站厅 + 地下通道 (地标机制) + 广场街景 ──
metroStation();
railBarricade(-40,2,HPI); railBarricade(-30,-6,0);
tankWreck(-20,10,1.2);
if(freeSpot(-72,20,2.2)) crater(-72,20,2.2); if(freeSpot(-36,-16,2.2)) crater(-36,-16,2.0);
// ── ④ 防空塔 (地标 + 塔顶高炮): 塔基工事 + 旗前沙袋/铁丝网 ──
flakTower(-55,216,Math.PI);
sandbagWall(-55,204,5,0);
barbedWire(-55,200,0,4.2);
{ const px=-44,pz=210; if(freeSpot(px,pz,1.5)) hedgehog(px,pz); }
{ const px=-66,pz=210; if(freeSpot(px,pz,1.5)) hedgehog(px,pz); }
// ── ⑤ 街垒区: 三层街垒纵深 + 坦克残骸 + 铁丝网 + 钢锭/沙袋 ──
barricadeLine(-92,-198,-18,-198,8);
barricadeLine(-92,-186,-18,-186,9);
barricadeLine(-86,-210,-24,-210,9);
tankWreck(-70,-206,0.8); tankWreck(-30,-190,-0.6);
barbedWire(-78,-192,0,4.2); barbedWire(-40,-204,0,4.2);
ingotStack(-60,-214,0.2); sandbagWall(-44,-196,3.5,0);
// ── ⑥ 国会大厦 (地标: 可进/可爬屋顶/穹顶废墟) + 前庭广场 ──
reichstag(150,48,Math.PI);
stoneWall(112,20,132,20); stoneWall(168,20,188,20);
tankWreck(104,-12,0.3); tankWreck(196,14,-0.8);
if(freeSpot(120,26,2.4)) crater(120,26,2.4); if(freeSpot(178,30,2.4)) crater(178,30,2.2); if(freeSpot(150,-18,2.2)) crater(150,-18,2.0);
{ const px=132,pz=18; if(freeSpot(px,pz,1.5)) hedgehog(px,pz); }
{ const px=168,pz=18; if(freeSpot(px,pz,1.5)) hedgehog(px,pz); }
// ── ⑦ 城内加密 (2026-09-09 用户实机反馈"柏林城内太过于空荡") ──
berlinBlockWalls();  // 街块四边围合 (排楼街墙)
berlinCourtyards();  // 街块内部庭院
berlinStreet();      // 街道家具 (电车轨/街灯/瓦砾带/散布)
// ── 城市街景 (核心城区限界内铺街垒, 郊野不铺) + 守方(德军)工事模板 ──
cityDressing(true,{x0:-250,z0:-230,x1:210,z1:230});
defWorks(); // 守方=德军 (campaign.defSide=1, 00-config 单源)
// ── 郊野废墟带 (城网之外): 枯树/瓦砾/弹坑 —— 640 大地图不空 ──
for(const [ox,oz] of [[-280,220],[-200,-240],[-120,250],[60,250],[220,-220],[260,120],[-260,-60],[40,-250],[-300,-160],[300,200]]){
for(let i=0;i<4;i++){
const x=ox+wr(-9,9), z=oz+wr(-9,9);
if(roadDist(x,z)<7||cityUrban(x,z)||!freeSpot(x,z,1.2)) continue;
const k=wr(0,1);
if(k<0.5) deadTree(x,z); else if(k<0.75) crater(x,z,wr(1.8,2.6)); else rubblePile(x,z,wr(1.6,2.4));
}
}
}
// -- 江南水乡 (淞沪) --
// 2026-09-12 环形旗点+水乡风貌改版: 丝厂中央枢纽 + 五旗环 + 水车/鱼塘/藕塘/柳林/乌篷船
function layoutDelta(){
const D=CAMPAIGN.delta||{};
const V=D.villages||[];
const LM=D.landmark||{x:8,z:-14,ry:0.18};
// ── ① 丝厂地标: 落位在 landmark 语义表 (旗 E 侧旁, 不压旗心; 旗在厂区前院) ──
{
const p=placeAt(LM.x,LM.z,LM.ry,18,12,{maxDh:1.4});
if(p) silkFactory(p.x,p.z,p.ry);
}
// ── ② 石拱桥加固: 桥头堡沙袋环 ──
if(typeof BRIDGES!=='undefined'&&BRIDGES.length){
for(const B of BRIDGES) bridgeHeadWorks(B);
}
// ── ③ 农舍组团: 沿田埂/支流枕河而居 (villages 语义表) ──
V.forEach((v,vi)=>{
if(Math.hypot(v.x-LM.x,v.z-LM.z)<16) return; // 不压丝厂
const n=3+(vi%3); // 3~5 栋
for(let i=0;i<n;i++){
if(inShallowChannel(v.x,v.z)) continue;
const p=placeBuild(v.x,v.z,v.r*0.85,6.5,5.5);
if(p) cnHouse(p.x,p.z,p.ry,6,5);
}
// 院墙 (半围合)
if(vi%2===0){
const ry=wr(0,Math.PI);
const ex=v.x+Math.cos(ry)*v.r*0.55, ez=v.z+Math.sin(ry)*v.r*0.55;
if(freeSpot(ex,ez,1.5)) stoneWall(ex-4,ez,ex+4,ez+0.5,1.0);
}
// 村口沙袋/水缸/石磨
if(freeSpot(v.x+3,v.z+2,2)) sandbagWall(v.x+3,v.z+2,3.5,wr(0,3));
if(freeSpot(v.x-2,v.z+3,1)) barrel(v.x-2,v.z+3);
if(freeSpot(v.x+2,v.z-3,1)) crate(v.x+2,v.z-3,1.1,wr(0,3));
// 村口老树 (柳)
if(freeSpot(v.x-4,v.z-2,1.5)) willowTree(v.x-4,v.z-2);
});
// ── ④ 鱼塘/藕塘: 塘埂环 + 水车 (ponds 语义表) ──
if(D.ponds){
for(const pd of D.ponds){
// 塘边水车 ×1
const wa=pd.x+pd.r*0.85, wz=pd.z+pd.r*0.35;
if(!inShallowChannel(wa,wz)) waterwheel(wa,wz,Math.atan2(pd.x-wa,pd.z-wz)+HPI);
// 藕塘: 软遮蔽登记 (站隐, 复用 rice 顶高逻辑; 色带已在 terrain)
if(pd.t==='lotus'){
CROP_FIELDS.push({x0:pd.x-pd.r,x1:pd.x+pd.r,z0:pd.z-pd.r,z1:pd.z+pd.r,h:1.2});
// 藕叶点缀 (纯视觉小片)
for(let i=0;i<6;i++){
const a=wr(0,TAU), rr=wr(0,pd.r*0.7);
const px=pd.x+Math.cos(a)*rr, pz=pd.z+Math.sin(a)*rr;
const g0=heightAt(px,pz);
mesh(boxGeo(0.9,0.06,0.9),MAT.leaves||MAT.wood,px,g0+0.35,pz,wr(0,TAU),false,false);
}
}
// 塘边乌篷船 (浅水侧)
if(pd.t!=='lotus'||wr(0,1)<0.5){
const bx=pd.x+pd.r*0.55, bz=pd.z-pd.r*0.4;
if(!inRiverChannel(bx,bz)) sampan(bx,bz,wr(0,TAU));
}
}
}
// ── ⑤ 渡口乌篷船 (主河/支流沿岸) ──
{
const docks=[
{x:18,z:-52,ry:1.6},{x:-10,z:-54,ry:1.5},{x:-74,z:-36,ry:1.3},
{x:-70,z:50,ry:0.2},{x:70,z:46,ry:0.1}
];
for(const d of docks){
if(!inRiverChannel(d.x,d.z)&&!onBridge(d.x,d.z,4)&&freeSpot(d.x,d.z,2.5)) sampan(d.x,d.z,d.ry);
}
}
// ── ⑥ 柳林沿河带: 沿主河+主要支流自动布柳 (软遮蔽) ──
if(D.willow&&typeof RIVER!=='undefined'&&RIVER){
// 主河两岸
const P=RIVER.pts;
for(let i=0;i<P.length-1;i++){
const dx=P[i+1][0]-P[i][0], dz=P[i+1][1]-P[i][1];
const L2=Math.hypot(dx,dz)||1;
const steps=Math.floor(L2/7);
for(let s=0;s<=steps;s++){
const t=s/steps;
const cx=P[i][0]+dx*t, cz=P[i][1]+dz*t;
for(const side of [-1,1]){
const nx=-dz/L2*side, nz=dx/L2*side;
const px=cx+nx*(RIVER.w+2.5+wr(0,3)), pz=cz+nz*(RIVER.w+2.5+wr(0,3));
if(wr(0,1)<0.45) continue;
if(roadDist(px,pz)<5) continue;
if(inRiverChannel(px,pz)) continue;
if(typeof inWaterBody==='function'&&inWaterBody(px,pz)) continue;   // 2026-09-26E 审计 34: 通用水体门 (浅河/冰河/汊港/鱼塘全档)
if(onBridge(px,pz,3)) continue;
if(!freeSpot(px,pz,1.2)) continue;
willowTree(px,pz);
}
}
}
// 主要支流 (前4条) 沿岸柳
if(typeof DELTA_CHANS!=='undefined'&&DELTA_CHANS.length){
for(const ch of DELTA_CHANS.slice(0,4)){
for(let i=0;i<ch.length-1;i++){
const dx=ch[i+1][0]-ch[i][0], dz=ch[i+1][1]-ch[i][1];
const L2=Math.hypot(dx,dz)||1;
const steps=Math.floor(L2/9);
for(let s=0;s<=steps;s++){
const t=s/steps;
const cx=ch[i][0]+dx*t, cz=ch[i][1]+dz*t;
if(wr(0,1)<0.35) continue;
const side=wr(0,1)<0.5?-1:1;
const px=cx+(-dz/L2)*side*(3.5+wr(0,2.5)), pz=cz+(dx/L2)*side*(3.5+wr(0,2.5));
if(roadDist(px,pz)<5||inRiverChannel(px,pz)||(typeof inWaterBody==='function'&&inWaterBody(px,pz))||!freeSpot(px,pz,1.2)) continue;   // 2026-09-26E 审计 34
willowTree(px,pz);
}
}
}
}
}
// ── ⑦ 旗点工事 (五旗, 沿渡口/村口) ──
CAMPAIGN.flags.forEach((f,fi)=>{
// 中央 E 丝厂: 厂区前院工事 (丝厂在 z-14, 旗在 z0)
if(f.id==='E'){
for(const [ox,oz] of [[10,4],[-10,4],[12,-2],[-12,-2]]){
if(freeSpot(f.x+ox,f.z+oz,2)) sandbagWall(f.x+ox,f.z+oz,3.5,wr(0,3));
}
if(freeSpot(f.x+8,f.z+6,1)) barrel(f.x+8,f.z+6);
if(freeSpot(f.x-8,f.z+5,1.2)) crate(f.x-8,f.z+5,1.2,wr(0,3));
return;
}
// 其余旗: 沙袋+弹药箱+拒马
{ const px=f.x+wr(-7,7), pz=f.z+wr(-7,7); if(freeSpot(px,pz,2)) sandbagWall(px,pz,4,wr(0,3)); };
{ const px=f.x+wr(-6,6), pz=f.z+wr(-6,6); if(freeSpot(px,pz,1.2)) crate(px,pz,1.2,wr(0,3)); };
{ const px=f.x+wr(-7,7), pz=f.z+wr(-7,7); if(freeSpot(px,pz,1)) barrel(px,pz); };
{ const px=f.x+wr(-8,8), pz=f.z+wr(-8,8); if(freeSpot(px,pz,1.5)) hedgehog(px,pz); };
// 南圩 S / 北圩 B 加水车点缀
if(f.id==='S'||f.id==='B'){
const wx=f.x+wr(-12,12), wz=f.z+wr(-12,12);
if(!inShallowChannel(wx,wz)&&freeSpot(wx,wz,2.5)) waterwheel(wx,wz,wr(0,TAU));
}
});
// ── ⑧ 零散拒马/枯树 (田埂交汇, 减少萧条感: 枯树限量, 以柳为主) ──
{
const hogs=[[52,-10],[12,10],[-28,-4],[-40,-70],[30,30]];
for(const [px,pz] of hogs){ if(freeSpot(px,pz,1.5)) hedgehog(px,pz); }
const dts=[[40,10],[-44,20],[60,-50]];
for(const [px,pz] of dts){ if(freeSpot(px,pz,1.5)) deadTree(px,pz); }
}
}
// -- 黄土沟壑 (百团, 2026-09-12 立体化重制: 640 大地图 · 5库扇面 · 坡道网络 · 沟底可玩) --
function layoutLoess(){
const L=CAMPAIGN.loess;
// 窑洞村: 贴塬缘崖 (caveVillages 语义表, 北沟南缘×2 / 南沟北缘×2) —— 每村 1 孔可进窑洞 + 村口杂物
if(L&&L.caveVillages){
for(const cv of L.caveVillages){
// 窑洞朝向沟壑: ry 指向沟
const p=placeAt(cv.x,cv.z,cv.ry,7,5,{maxDh:1.2});
if(p) caveDwelling(p.x,p.z,p.ry);
if(freeSpot(cv.x+4,cv.z+3,2)) sandbagWall(cv.x+4,cv.z+3,3,HPI);
if(freeSpot(cv.x-3,cv.z+4,1.2)) crate(cv.x-3,cv.z+4,1.1,wr(0,3));
}
}
// 铁路专线: 中塬南缘东西向 (rail 语义表) —— 双轨+枕木+平板车 (不可碾);
// 跨巷沟段由 bridges 表建铁路木桥 (buildWorld 通用分派), 桥面=塬面高=拉锯通道
if(L&&L.rail){
railLine(L.rail.x0,L.rail.z0,L.rail.x1,L.rail.z1);
railFlatcar(L.rail.x0+28,L.rail.z0+3,HPI+0.04);
railFlatcar((L.rail.x0+L.rail.x1)/2-58,(L.rail.z0+L.rail.z1)/2+2,HPI-0.03);
railFlatcar(L.rail.x1-30,L.rail.z1+2,HPI+0.05);
}
// 坡道堑口标桩: 每条坡道两端外侧各一组木箱/油桶 —— 玩家一眼认出过沟通道 (偏移 5.2m 不占走廊中线)
if(L&&L.ramps){
for(const r of L.ramps){
const dx=r.x1-r.x0, dz=r.z1-r.z0, len=Math.hypot(dx,dz)||1;
const nx=-dz/len, nz=dx/len; // 走廊横向
for(const e2 of [[r.x0,r.z0],[r.x1,r.z1]]){
const ex=e2[0]+nx*5.2, ez=e2[1]+nz*5.2;
if(freeSpot(ex,ez,1.3)) crate(ex,ez,1.15,Math.atan2(dx,dz));
const ex2=e2[0]-nx*5.2, ez2=e2[1]-nz*5.2;
if(freeSpot(ex2,ez2,1)) barrel(ex2,ez2);
}
}
}
// ── 5 库分层布景 (旗点=补给库, buildWorld 破袭循环在各旗位建库本体; 这里布阵地特色) ──
// 注意顺序: 建筑先落位注册足迹, 旗点通用点缀最后撒 (freeSpot 才能避开新建筑足迹)
const F=CAMPAIGN.flags;
// 铁路库 (旗0·塬面层·主线目标): 仓库房+站台沙袋, 紧贴铁路线
{
const p=placeAt(-78,-56,0.3,9,6,{maxDh:1.6}); if(p) cnHouse(p.x,p.z,p.ry,9,6);
if(freeSpot(-46,-80,2)) sandbagWall(-46,-80,5,0.1);
if(freeSpot(-76,-84,2)) sandbagWall(-76,-84,4,HPI);
}
// 窑洞村 (旗1·塬面层): 村舍两栋沿村缘 (placeBuild 环形选址, 不压旗)
{
let p=placeBuild(70,105,13,6,5,{ring0:8}); if(p) cnHouse(p.x,p.z,p.ry,6,5);
p=placeBuild(70,105,13,6,5,{ring0:8}); if(p) cnHouse(p.x,p.z,p.ry,6,5);
}
// 东峁顶 (旗2·山脊层): 守方环形工事 —— 碉堡扼西坡 + 双机枪 + 环顶沙袋四向 (居高临下)
// 碉堡锚点距旗心 ≥12m: buildDepot 会在旗周 ±4m 撒油桶/沙袋, 太近会落进碉堡足迹 (verify-layouts 抓过)
{
const fx=245, fz=95;
const p=placeAt(fx+10,fz+7,-0.2,8,5,{maxDh:1.6}); if(p) bunker(p.x,p.z,Math.atan2(142-p.x,82-p.z));
if(freeSpot(fx-8,fz+6,1.5)) mg42(fx-8,fz+6,Math.atan2(142-fx,82-fz),1);
if(freeSpot(fx-4,fz-9,1.5)) mg42(fx-4,fz-9,Math.atan2(146-fx,-60-fz),1);
for(const [wx,wz,wf] of [[fx,fz+30,0],[fx,fz-30,Math.PI],[fx-30,fz,-HPI],[fx+30,fz,HPI]]){
if(freeSpot(wx,wz,2)) sandbagWall(wx,wz,4.5,wf);
}
}
// 西沟口 (旗3·沟底层·渡台): 渡口工事 —— 台缘沙袋双向 + 拒马 + 木箱 (无建筑: 渡台窄)
{
if(freeSpot(-175,-24,2)) sandbagWall(-175,-24,4.5,0);
if(freeSpot(-184,-40,2)) sandbagWall(-184,-40,4,HPI);
if(freeSpot(-166,-46,1.5)) hedgehog(-166,-46);
if(freeSpot(-170,-30,1.2)) crate(-170,-30,1.2,0.4);
}
// 南沟仓 (旗4·沟底层·仓台): 粮仓带 —— 木箱垛+沙袋+粮囤(油桶组)
{
if(freeSpot(130,-156,2)) sandbagWall(130,-156,4.5,0.2);
if(freeSpot(148,-140,2)) sandbagWall(148,-140,4,HPI+0.2);
if(freeSpot(132,-140,1.2)) crate(132,-140,1.3,0.3);
if(freeSpot(146,-154,1)) barrel(146,-154);
if(freeSpot(148,-152,1)) barrel(148,-152);
}
// ── 据点与村落加密包 (2026-09-12 用户实机意见"建筑太少太空荡") ──
// 日军铁路据点带 ×3 (史实: 正太路沿线"乌龟壳"据点): 碉堡/炮楼+兵舍+铁丝网+龙牙, 守铁路与桥
{
// 据点甲: 铁路桥西桥头 (碉堡扼桥+兵舍+铁丝网+龙牙门)
const pA=placeAt(-46,-92,-0.3,8,5,{maxDh:1.6}); if(pA) bunker(pA.x,pA.z,Math.atan2(-120-pA.x,-84-pA.z));
const pA2=placeAt(-58,-96,0.2,5,4,{maxDh:1.6}); if(pA2) logCabin(pA2.x,pA2.z,pA2.ry);
barbedWire(-38,-90,0.2,5); barbedWire(-34,-78,HPI,4);
if(freeSpot(-40,-76,0.9)) dragonTooth(-40,-76,0.3);
if(freeSpot(-36,-73,0.9)) dragonTooth(-36,-73,-0.2);
// 据点乙: 铁路桥东桥头
const pB=placeAt(4,-92,0.35,8,5,{maxDh:1.6}); if(pB) bunker(pB.x,pB.z,Math.atan2(80-pB.x,-84-pB.z));
barbedWire(12,-86,HPI,4.5); barbedWire(10,-100,0,4);
if(freeSpot(14,-96,1.2)) crate(14,-96,1.2,0.5);
// 据点丙: 铁路东段炮楼+兵舍 (望南沟坡道口)
placeTower(126,-72);
const pC=placeAt(132,-94,-0.2,5,4,{maxDh:1.6}); if(pC) logCabin(pC.x,pC.z,pC.ry);
barbedWire(120,-92,0.15,4.5);
}
// 塬面村落组团 ×2 + 川地村 ×1 (4~6 间瓦房+院墙石墙 —— 消除"塬上一马平川无村"的空荡感)
{
// 中塬西村 (麦田以北, 塬北线以南)
const V1=[[-128,58,0.2],[-116,62,-0.35],[-124,70,0.05],[-112,72,0.5]];
for(const [hx,hz,hr] of V1){ const p=placeAt(hx,hz,hr,7,5.5,{maxDh:1.6}); if(p) cnHouse(p.x,p.z,p.ry,7,5.5); }
stoneWall(-132,52,-114,54); stoneWall(-108,66,-108,78);
if(freeSpot(-120,64,1)) barrel(-120,64);
// 中塬东村 (东麦田东北)
const V2=[[112,52,0.3],[126,56,-0.2],[118,64,0.1],[132,66,-0.45]];
for(const [hx,hz,hr] of V2){ const p=placeAt(hx,hz,hr,7,5.5,{maxDh:1.6}); if(p) cnHouse(p.x,p.z,p.ry,7,5.5); }
stoneWall(108,48,134,50);
if(freeSpot(122,60,1.2)) crate(122,60,1.2,0.7);
// 西川村 (攻方推进线侧翼) —— 房间距按旋转后最大包络留 2m+, 防足迹相叠
const V3=[[-236,-50,0.15],[-224,-44,-0.3],[-232,-32,0.4]];
for(const [hx,hz,hr] of V3){ const p=placeAt(hx,hz,hr,7,5.5,{maxDh:1.6}); if(p) cnHouse(p.x,p.z,p.ry,7,5.5); }
stoneWall(-236,-42,-218,-40);
if(freeSpot(-226,-52,1)) barrel(-226,-52);
}
// 峁顶工事: 西北峁/南峁 (制高点哨塔/木屋+沙袋环 —— 川地制高点有内容可打)
{
placeTower(-120,232);
const pM=placeAt(-112,240,0.3,6,5,{maxDh:1.6}); if(pM) logCabin(pM.x,pM.z,pM.ry);
if(freeSpot(-120,224,2)) sandbagWall(-120,224,4,0);
if(freeSpot(-112,248,1.5)) mg42(-112,248,Math.atan2(70+112,105-248),1);
const pS=placeAt(70,-234,0.2,6,5,{maxDh:1.6}); if(pS) logCabin(pS.x,pS.z,pS.ry);
if(freeSpot(70,-246,2)) sandbagWall(70,-246,4,Math.PI);
if(freeSpot(78,-236,1.5)) hedgehog(78,-236);
}
// 基地营区加建: 守方碉堡+炮楼 / 攻方营房粮秣库 (通用营区帐篷/沙袋之外 —— 碉堡避开通用营区 x±10 散布带)
{
const pD=placeAt(250,36,-HPI,8,5,{maxDh:1.6}); if(pD) bunker(pD.x,pD.z,Math.atan2(142-pD.x,82-pD.z));
placeTower(274,-2);
const pO=placeAt(-258,16,0.2,9.5,13.5,{maxDh:1.6}); if(pO) buildBarn(pO.x,pO.z,pO.ry);
const pO2=placeAt(-276,8,-0.3,5,4,{maxDh:1.6}); if(pO2) logCabin(pO2.x,pO2.z,pO2.ry);
}
// 攻方前出点营地 (spawns 语义表): 帐篷+沙袋+杂物 (17-emplacements 再配固定火力朝敌基)
for(const sp of (CAMPAIGN.spawns||[])){
if(freeSpot(sp.x+2,sp.z+5,2)) tent(sp.x+2,sp.z+5,0.3);
if(freeSpot(sp.x-3,sp.z-4,2)) tent(sp.x-3,sp.z-4,-0.2);
if(freeSpot(sp.x+6,sp.z+3,2)) sandbagWall(sp.x+6,sp.z+3,4,HPI);
if(freeSpot(sp.x-6,sp.z-2,2)) sandbagWall(sp.x-6,sp.z-2,4,0); // 2026-09-25 修: 旧版写成 3 参 (sp.x-6,sp.z-2,0) —— 0 落到 len、ry 缺省 undefined ⇒ Math.cos(undefined)=NaN, 整堵墙不可见且往 BOXES/coverPoints 里灌 NaN
if(freeSpot(sp.x+4,sp.z-6,1.2)) crate(sp.x+4,sp.z-6,1.2,0.5);
}
// 哨塔: 塬面东西各一座 (中塬纵深观察)
placeTower(-120,40); placeTower(96,44);
// 弹坑/枯树/拒马零散: 沟底渗透路线的掩体点缀 (freeSpot 查建筑足迹)
if(freeSpot(-120,-84,2.2)) crater(-120,-84,2.2);
if(freeSpot(60,-88,2.0)) crater(60,-88,2.0);
if(freeSpot(-40,60,2.2)) crater(-40,60,2.2);
{ if(freeSpot(-14,88,1.5)) deadTree(-14,88); }
{ if(freeSpot(150,-40,1.5)) deadTree(150,-40); }
{ if(freeSpot(-108,-108,1.5)) deadTree(-108,-108); }
{ if(freeSpot(96,180,1.5)) hedgehog(96,180); };
{ if(freeSpot(-96,-160,1.5)) hedgehog(-96,-160); };
// 旗点通用点缀 (置于全部建筑落位之后 —— freeSpot 避开足迹)
F.forEach(f=>{
{ const px=f.x+wr(-8,8), pz=f.z+wr(-8,8); if(freeSpot(px,pz,2)) sandbagWall(px,pz,4,wr(0,3)); };
{ const px=f.x+wr(-9,7), pz=f.z+wr(-8,8); if(freeSpot(px,pz,1.2)) crate(px,pz,1.2,wr(0,3)); };
{ const px=f.x+wr(-8,8), pz=f.z+wr(-9,7); if(freeSpot(px,pz,1)) barrel(px,pz); };
});
}
// -- 丛林前哨 (滇缅) --
function layoutJungle(){
CAMPAIGN.flags.forEach((f,i)=>{
placeTower(f.x+6,f.z+5);
let p=placeBuild(f.x,f.z,7,3.4,4.6,{ry:wr(0,3),maxDh:0.5});
if(p) tent(p.x,p.z,p.ry);
p=placeBuild(f.x,f.z,7,3.4,4.6,{ry:wr(0,3),maxDh:0.5});
if(p) tent(p.x,p.z,p.ry);
{ const px=f.x+7, pz=f.z-4; if(freeSpot(px,pz,2)) sandbagWall(px,pz, 4,wr(0,3)); };
{ const px=f.x-2, pz=f.z+9; if(freeSpot(px,pz,2)) sandbagWall(px,pz, 4,wr(0,3)); };
{ const px=f.x-9, pz=f.z; if(freeSpot(px,pz,2)) sandbagWall(px,pz, 4,HPI); };
{ const px=f.x+wr(-3,3), pz=f.z+wr(-3,3); if(freeSpot(px,pz,1.2)) crate(px,pz, 1.2,wr(0,3)); };
{ const px=f.x+4.2, pz=f.z+2.2; if(freeSpot(px,pz,1)) barrel(px,pz); };
// ★ 2026-09-27N (B6): 旧版 `placeBuild(f.x,f.z,12,6,5)` 在这张图上**全数落空** —— 实测 4 个旗点一栋房
//   都没建成 (BUILD_REG 只有 4 塔 + 9 帐), 于是全图 0 组可毁物 (这套竹/瓦房是本图唯一的可毁结构)。
//   根因: 丛林地形起伏大, 26 次取样都撞在"足迹高差 >0.85m"或"压住已放道具"上。放宽检索环与高差门限
//   (1.2m 仍在裙坡兜底的观感范围内), 每个营地各建一座 —— 村子回到地图上, 破坏子系统随之在这张图上线。
if(i%2===0){ p=placeBuild(f.x,f.z,20,6,5,{maxDh:1.2,margin:0.9}); if(p) cnHouse(p.x,p.z,p.ry,6,5); }
else { p=placeBuild(f.x,f.z,16,6,5,{maxDh:1.2,margin:0.9}); if(p) cnHouse(p.x,p.z,p.ry,5.5,4.6); }
});
for(let i=0;i<8;i++) fallenLog(wr(-110,110),wr(-110,110),wr(0,Math.PI));
crater(-12,14,2.0); crater(18,26,1.8);
}
// -- 原始密林 (胡康河谷) : 640 大图巨桥改版 (2026-09-12) —— 主题=大龙河大桥 (grandBridge, buildWorld 分派),
//    本函数布两岸旗点营地/村寨/桥头工事/徒涉滩渡口/基地加建, 植被范围随 MAP_SIZE --
// 大龙河大桥: 桥面高度由 heightAt 的 BRIDGES 矩形提供, 结构=grandBridge (木排架 buildBridge 保留为通用后备)
// bridgePt(u,v): 桥局部坐标转世界 (u=沿桥轴向(sin,cos), v=垂直桥向(cos,-sin)); bridgePtOf(B,..) 指定桥
function bridgePtOf(B,u,v){
return [B.x+u*Math.sin(B.yaw)+v*Math.cos(B.yaw), B.z+u*Math.cos(B.yaw)-v*Math.sin(B.yaw)];
}
function bridgePt(u,v){ return bridgePtOf(BRIDGE,u,v); }
function buildBridge(B){
const dy=bridgeDeckY();
// 桥面 (厚板; 长度放 d 轴随 yaw 走向, 含碰撞体供子弹/弹片命中; 顶面低于站立面0.5不进占用格)
solidBox(MAT.wood,B.w,0.5,B.len,B.x,dy-0.25,B.z,B.yaw);
// 桥面铺板层 (视觉)
const deck2=mesh(boxGeo(B.w+0.7,0.1,B.len-0.6),MAT.woodDark,B.x,dy+0.02,B.z,B.yaw,false,true);
addSnowCap(deck2);
// 护栏立柱 + 双横杆 (立柱位于桥缘不占中央通道)
// 2026-09-06 P1-4: 旧版横杆纯视觉(mesh)与注释"碰撞体挡人坠河"不符, 侧移可穿栏坠河 ——
// 每侧补 1 道沿桥轴的细 solidBox 碰撞杆 (截面 0.12, 顶面=桥面+1.0m, 与视觉横杆带同位; 顺带挡弹=护栏矮掩体效应, 符合护栏语义)
for(const side of [-1,1]){
const v=side*(B.w/2-0.18);
for(let u=-B.len/2+0.9;u<=B.len/2-0.9;u+=2.4){
const p=bridgePt(u,v);
solidBox(MAT.woodDark,0.16,1.06,0.16,p[0],dy+0.53,p[1],B.yaw);
}
for(const hy of [0.5,0.98]){
const p=bridgePt(0,v);
mesh(boxGeo(0.09,0.09,B.len-1.6),MAT.woodDark,p[0],dy+hy,p[1],B.yaw);
}
const rp2=bridgePt(0,v);
solidBox(MAT.woodDark,0.12,0.12,B.len-1.6,rp2[0],dy+0.94,rp2[1],B.yaw); // 顶面 dy+1.0
}
// 石砌桥台 (西端): 补 deck 端面外露 + 台阶侧石 (2026-09-06 P3-10; bridgeDeckY 取两岸 max 的副作用。
// 0.42m 台阶<0.45 步高标准保留可通行; 顶面与桥面齐平, 桥台不进 NAV 占用格(<gh+0.5)不封过河走廊)
{
const ab=bridgePt(-B.len/2-0.55,0);
const gA=heightAt(ab[0],ab[1]);
const hAb=dy-gA;
if(hAb>0.25) solidBox(MAT.stone,B.w+0.6,hAb,1.1,ab[0],gA+hAb/2,ab[1],B.yaw);
}
// 桥下木排架桩 (深入激流, 纯视觉)
for(const u of [-B.len/2+1.4,-6.5,6.5,B.len/2-1.4]){
for(const v of [-B.w/2+0.8,B.w/2-0.8]){
const p=bridgePt(u,v);
mesh(new THREE.CylinderGeometry(0.18,0.22,5.2,7),MAT.bark,p[0],dy-2.8,p[1]);
}
}
// 桥缘沙袋 (顺桥向, 两侧交替; 占用格的外溢由下方 NAV_CLEARS 通行带兜底)
const s1=bridgePt(-7,2.9), s2=bridgePt(7,-2.9);
sandbagWall(s1[0],s1[1],2.2,B.yaw+HPI);
sandbagWall(s2[0],s2[1],2.2,B.yaw+HPI);
// 中央通行带: 沿桥轴强制清空占用格, 确保护栏/沙袋/弹药箱的碰撞体外溢
// 不会封死 Bot/坦克的唯一过河走廊 (物理碰撞仍在, 只是寻路格保证连通)
for(let u=-B.len/2+1;u<=B.len/2-1;u+=2){
const p=bridgePt(u,0);
NAV_CLEARS.push({x:p[0],z:p[1],r:1.6});
}
}
function layoutDeepJungle(){
// ── 巨桥改版 (2026-09-12): 640 大图, 主题=大龙河大桥 (grandBridge 由 buildWorld 分派) ──
// 三路扇面旗点: 桥面旗由 grandBridge 布置, 岸旗营地+村寨; 主桥/石桥桥头工事; 徒涉滩渡口
const MS2=MAP_SIZE/2;
CAMPAIGN.flags.forEach((f,i)=>{
if(onBridge(f.x,f.z,4)) return;
placeTower(f.x+6,f.z+5);
let p=placeBuild(f.x,f.z,7,3.4,4.6,{ry:wr(0,3),maxDh:0.5});
if(p) tent(p.x,p.z,p.ry);
p=placeBuild(f.x,f.z,7,3.4,4.6,{ry:wr(0,3),maxDh:0.5});
if(p) tent(p.x,p.z,p.ry);
{ const px=f.x+7, pz=f.z-4; if(freeSpot(px,pz,2)) sandbagWall(px,pz, 4,wr(0,3)); };
{ const px=f.x-2, pz=f.z+9; if(freeSpot(px,pz,2)) sandbagWall(px,pz, 4,wr(0,3)); };
{ const px=f.x-9, pz=f.z; if(freeSpot(px,pz,2)) sandbagWall(px,pz, 4,HPI); };
{ const px=f.x+wr(-3,3), pz=f.z+wr(-3,3); if(freeSpot(px,pz,1.2)) crate(px,pz, 1.2,wr(0,3)); };
{ const px=f.x+3, pz=f.z+3; if(freeSpot(px,pz,1)) barrel(px,pz); };
if(i%2===0){ p=placeBuild(f.x,f.z,12,6,5); if(p) cnHouse(p.x,p.z,p.ry,6,5); }
});
// 村寨加密 (北线两岸桥头村落): 西岸村/东岸寨各加 2 栋瓦房, 东滩/西滩各 1 栋木屋
// (用 placeBuild 带互斥检索 —— placeAt 有无条件兜底, 挤进旗点营地足迹会造成重叠)
for(const [vx,vz,n] of [[-190,-150,2],[150,-195,2],[-110,175,1],[150,185,1]]){
for(let k=0;k<n;k++){
const p=placeBuild(vx+wr(-16,16),vz+wr(-16,16),18,6,5,{maxDh:1.0});
if(p) cnHouse(p.x,p.z,p.ry,6,5);
}
}
// ── 主桥 (BRIDGES[0] kind=grand) 桥头工事: 拒马 + 桥端机枪 (桥头旗点营地即桥头堡, 桥面沙袋/塔楼由 grandBridge 自带) ──
{
const GB=BRIDGES[0];
const sn=Math.sin(GB.yaw), cs=Math.cos(GB.yaw);
for(const sgn of [-1,1]){
const hx=GB.x+sgn*(GB.len/2+4.5)*sn-6.5*cs, hz=GB.z+sgn*(GB.len/2+4.5)*cs+6.5*sn;
if(freeSpot(hx,hz,1.5)) hedgehog(hx,hz);
// 桥端机枪: 架在桥面近端肩位, 封锁桥面 (西=team0 面+u, 东=team1 面-u)
const mu=sgn*(GB.len/2-2.5), mv=5.2;
const mx=GB.x+mu*sn+mv*cs, mz=GB.z+mu*cs-mv*sn;
if(freeSpot(mx,mz,1.2)&&propFree(mx,mz,1.2)) mg42(mx,mz,GB.yaw+(sgn<0?0:Math.PI),sgn<0?0:1);
}
}
// ── 北石拱桥 (BRIDGES[1] kind=stone): 桥头碉堡面桥 (先登记, 桥头工事沙袋自动避让) + 桥头工事 + 两桥头机枪 ──
{
const SB=BRIDGES[1];
if(SB){
const sn=Math.sin(SB.yaw), cs=Math.cos(SB.yaw);
for(const sgn of [-1,1]){
const hu=sgn*(SB.len/2+7), hv=SB.w/2+4.5;
const bx=SB.x+hu*sn+hv*cs, bz=SB.z+hu*cs-hv*sn;
if(freeSpot(bx,bz,4)&&propFree(bx,bz,4)) bunker(bx,bz,SB.yaw+(sgn<0?0:Math.PI)); // 面向桥面
}
}
if(SB) bridgeHeadWorks(SB);
if(SB){
const sn=Math.sin(SB.yaw), cs=Math.cos(SB.yaw);
for(const sgn of [-1,1]){
const mu=sgn*(SB.len/2-2.5), mv=SB.w/2+1.6;
const mx=SB.x+mu*sn+mv*cs, mz=SB.z+mu*cs-mv*sn;
if(freeSpot(mx,mz,1.2)&&propFree(mx,mz,1.2)) mg42(mx,mz,SB.yaw+(sgn<0?0:Math.PI),sgn<0?0:1);
}
}
}
// ── 徒涉滩渡口 (RIVER.ford): 两岸沙袋阵地+机枪, 滩心踏石 (纯视觉, 坦克涉渡不受阻), 通行带 ──
if(RIVER&&RIVER.ford){
const F=RIVER.ford;
// 河向/过河向 (取滩心所在折线段方向)
const P=RIVER.pts; let rdx=0,rdz=1;
for(let i=0;i<P.length-1;i++){
const az0=P[i][1], az1=P[i+1][1];
if((F.z>=az0&&F.z<=az1)||(F.z>=az1&&F.z<=az0)){
const dx=P[i+1][0]-P[i][0], dz=P[i+1][1]-P[i][1], l=Math.hypot(dx,dz)||1;
rdx=dx/l; rdz=dz/l; break;
}
}
const px2=rdz, pz2=-rdx; // 过河向 (垂直河向)
const ryF=Math.atan2(rdx,rdz);
for(const sgn of [-1,1]){
const bx=F.x+sgn*(F.r+6)*px2, bz=F.z+sgn*(F.r+6)*pz2;
if(freeSpot(bx,bz,2.5)) sandbagWall(bx,bz,4.5,ryF);
if(freeSpot(bx+sgn*px2*4+rdx*5,bz+sgn*pz2*4+rdz*5,2)) sandbagWall(bx+sgn*px2*4+rdx*5,bz+sgn*pz2*4+rdz*5,3.5,ryF+HPI/2);
if(freeSpot(bx+sgn*px2*3-rdx*4,bz+sgn*pz2*3-rdz*4,1.2)) crate(bx+sgn*px2*3-rdx*4,bz+sgn*pz2*3-rdz*4,1.2,wr(0,3));
if(freeSpot(bx-rdx*5,bz-rdz*5,1)) barrel(bx-rdx*5,bz-rdz*5);
// 渡口机枪: 面={对岸}, 西=team0 东=team1
if(freeSpot(bx+sgn*px2*2,bz+sgn*pz2*2,1.2)&&propFree(bx+sgn*px2*2,bz+sgn*pz2*2,1.2))
mg42(bx+sgn*px2*2,bz+sgn*pz2*2,Math.atan2(-sgn*px2,-sgn*pz2),sgn<0?0:1);
coverPoints.push({x:bx,z:bz});
NAV_CLEARS.push({x:bx,z:bz,r:2.2});
}
// 滩心踏石 (纯视觉 mesh, 0.3m 浅水露头; 不进碰撞 —— 坦克涉渡线不被阻)
for(let k=-3;k<=3;k++){
const sx=F.x+k*6.5*px2, sz=F.z+k*6.5*pz2;
const g0=heightAt(sx,sz,true);
mesh(boxGeo(1.4,0.5,1.4),MAT.stone,sx,g0+0.12,sz,wr(0,3),false,true);
}
// 通行带: 过河向 5 点强制清格 (滩心 inRiverChannel 已豁免, 这里兜住沙袋外溢)
for(let k=-2;k<=2;k++){
NAV_CLEARS.push({x:F.x+k*11*px2,z:F.z+k*11*pz2,r:2.6});
}
}
// 河岸哨塔 (2026-09-12 实机修复: 旧位 (-16,-18) 等按欧氏距离估河距, 实际河线大体沿桥横向走,
// 河距≈沿河向坐标 —— 旧塔半截泡在激流里; 全部迁至河距≥30m 的岸上)
placeTower(-44,-24); placeTower(34,28); placeTower(-46,-196); placeTower(38,146);
if(freeSpot(-46,-34,2)) crater(-46,-34,2.2); if(freeSpot(40,16,2)) crater(40,16,2.0); if(freeSpot(-28,30,2)) crater(-28,30,1.8); if(freeSpot(28,-30,2)) crater(28,-30,2.2); // 固定弹坑 (岸上, 避深切带)
// 基地加建: 碉堡面向敌基 + 哨塔 + 帐篷 (通用营区模板之外)
// 非可碾件 (碉堡/哨塔/拒马) 一律距基地中心 ≥19m —— 坦克出生环带 (findFreeSpawn ≈13m) 前方 2.6m 内不得有混凝土阻挡
CAMPAIGN.bases.forEach((b,t)=>{
const sgn=b.x<0?1:-1;
const pB=placeAt(b.x+sgn*20,b.z+16,0,7,6,{maxDh:1.2});
// ★ 2026-09-26 A8 修: 朝向符号写反 —— 碉堡的'前墙' = 局部 +z = face 方向 = (sin face, cos face),
//   而 `sgn` 是从基地指向地图中心 (= 敌军来向) 的方向。旧式 atan2(**-sgn**·100,30) 让射击孔朝地图**外缘**
//   (背对来敌, 整座碉堡等于一堵无孔墙)。只翻 x 项符号, 作者原来的 +30 (北偏) 保留。
if(pB) bunker(pB.x,pB.z,Math.atan2(sgn*100,30));
placeTower(b.x-sgn*10,b.z-18);
const pT=placeAt(b.x+sgn*6,b.z-14,0.3,6,5,{maxDh:1.2}); if(pT) tent(pT.x,pT.z,pT.ry);
if(freeSpot(b.x+sgn*18,b.z+8,1.5)) hedgehog(b.x+sgn*18,b.z+8);
});
// 密林植被散布: 道路/旗点平整区/河道/建筑足迹让开, 其余区域竹丛+蕨类封闭 (640 大图按面积增量)
const spotOK=(x,z,flatK)=>{
if(roadDist(x,z)<6) return false;
if(inRiverChannel(x,z)) return false;
if(typeof inWaterBody==='function'&&inWaterBody(x,z)) return false;   // 2026-09-26E 审计 34
if(onBridge(x,z,3)) return false;
for(const f of FLATS){ if(Math.hypot(x-f.x,z-f.z)<f.r*flatK) return false; }
if(!freeSpot(x,z,1)) return false;
return Math.abs(x)<MS2-10&&Math.abs(z)<MS2-10; // 2026-09-06 B7a/P2-11: 旧写死 ±150 (扩图即失效)
};
let placed=0, tries=0;
while(placed<150&&tries<1200){ tries++;
const x=wr(-(MS2-24),MS2-24), z=wr(-(MS2-24),MS2-24);
if(!spotOK(x,z,0.62)) continue;
bambooClump(x,z); placed++;
}
for(let i=0;i<260;i++){
const x=wr(-(MS2-24),MS2-24), z=wr(-(MS2-24),MS2-24);
if(!spotOK(x,z,0.5)) continue;
fernClump(x,z);
}
for(let i=0;i<46;i++){
const x=wr(-(MS2-40),MS2-40), z=wr(-(MS2-40),MS2-40);
if(!spotOK(x,z,0.55)) continue;
fallenLog(x,z,wr(0,Math.PI));
}
}
// -- 草原遭遇战 (steppe): 库尔斯克改版 (2026-09-13) —— 640 大图, 历史原型=库尔斯克会战 (1943.7-8)
//    ①东带苏军大纵深防线 (雷区→反坦克壕→龙牙双排→3装甲走廊缺口 —— 史实"坦克屠宰场"引门带)
//    ②普罗霍罗夫卡车站+铁路轴 (站房/水塔/站台/货栈/调车场平板车/道口)
//    ③风车磨坊 (可登顶制高) ④装甲坟场 (普罗霍罗夫卡式残骸带, 缺口两侧 killing ground)
//    ⑤khutor 麦田农庄 ⑥7 强点工事 (沙袋环+支撑壕, 壕沟由 config trench 驱动)
//    ⑦七月麦田带 (CAMPAIGN.fields→RURAL_FIELDS 全套: 色带/软遮蔽/可燃/小地图) ⑧环境: 炮火犁地在 04b
function layoutSteppe(){
const ST=CAMPAIGN.steppe, MS2=MAP_SIZE/2;
// ── ① 东带大纵深防线 (belt): 龙牙双排交错 (混凝土无 crush 碾不动 —— 同莫斯科城缘带);
//    缺口 z 区间留空 = 唯一装甲走廊 (北坟场/公路/南缺口), 走廊两翼机枪+碉堡封锁, 带前铁丝网
if(ST&&ST.belt){
const B=ST.belt;
const inGap=z=>B.gaps.some(g=>z>=g[0]&&z<=g[1]);
for(const [rowX,st] of [[B.x0,0],[B.x0+6,2.6]]){
for(let z=-B.spanZ;z<=B.spanZ;z+=5.2){
if(inGap(z+st)) continue;
dragonTooth(rowX+wr(-0.8,0.8),z+st+wr(-0.8,0.8),wr(0,3));
}
}
// 缺口封锁 (面东=来敌方向): 公路缺口双机枪 (走廊净空不放建筑), 北/南缺口 机枪+翼侧碉堡
for(const g of B.gaps){
mg42(B.x0-4,g[0]-4,HPI,0);
if(g[0]<-100) bunker(B.x0-2,g[1]+8,HPI);        // 北缺口: 碉堡坐南翼 (压走廊东进线)
else if(g[1]>100) bunker(B.x0-2,g[0]-8,HPI);    // 南缺口: 碉堡坐北翼
else mg42(B.x0-4,g[1]+5,HPI,0);                 // 公路缺口: 第二挺机枪
barbedWire(B.x1+6,g[0]-7,HPI,4.2);
barbedWire(B.x1+6,g[1]+7,HPI,4.2);
}
// 雷区 (接近侧 x0..x1 散布带): zRuns 已避开缺口走廊, 双保险再判 inGap+公路
if(ST.mines){
const M=ST.mines; let mi=0;
for(const r of M.zRuns){
for(let z=r[0]+2.5;z<r[1]-2.5;z+=1/(M.dens||0.42)){
if(inGap(z)) continue;
const x=wr(M.x0,M.x1);
if(roadDist(x,z)<6) continue;
atMine(x,z,(mi++%4===0));
}
}
}
// 炮火犁过的接近地带: 反坦克壕与雷区之间散弹坑 (焦土带观感)
for(const r of (ST.mines?ST.mines.zRuns:[])){
for(let z=r[0]+14;z<r[1]-8;z+=26) crater(124+wr(-2,2),z+wr(-4,4),wr(1.8,2.8));
}
}
// ── ② 铁路与车站 (普罗霍罗夫卡轴): 纵贯双段 (站段留空) + 站台/站房/水塔/货栈/侧线平板车 ──
if(ST&&ST.rail){
const rl=ST.rail, T=ST.station;
railLine(rl.x,-MS2+12,rl.x,-rl.gapZ);
railLine(rl.x,rl.gapZ,rl.x,MS2-12);
// 道口 (公路 z≈0 过轨): 两侧警示桩 + 横向护木
for(const sgn of [-1,1]){
const g0=heightAt(rl.x+sgn*2.6,0);
mesh(new THREE.CylinderGeometry(0.07,0.09,1.5,6),MAT.woodDark,rl.x+sgn*2.6,g0+0.75,0);
CYLS.push({x:rl.x+sgn*2.6,z:0,r:0.09,y0:g0,y1:g0+1.5});
}
const pg=Math.max(heightAt(T.x-6.4,T.z-28),heightAt(T.x-6.4,T.z+28));
solidBox(MAT.stone,4.6,0.5,58,T.x-6.4,pg+0.25,T.z,0); // 站台 (顶 0.5 ≤ 0.55 自动上步)
// 站房 (两层可毁公寓件, 长轴沿轨): 轨东侧, 公路 z0 以北
const pH=placeAt(T.x+13,T.z-16,HPI,17,9,{maxDh:0.6});
if(pH) terrace(pH.x,pH.z,pH.ry,17,9);
// 水塔 (公路南侧, 站前地标) + 货栈 (站台北端, 可毁)
stationWaterTower(T.x+9,T.z+14); // 车站地标: 05a 的四腿砖柱水塔 (2026-09-25 去重名后才是它)
// 货栈: buildDepot 自带室内油桶/侧沙袋 (先放道具后登记足迹 = 登记序豁免, 同百团补给库口径)
{
const dry=T.x-6.4, drz=T.z+34, dryaw=0.2;
const drect=footRect(dry,drz,dryaw,7,6,1.0);
if(terrainDelta(dry,drz,dryaw,7,6)<=0.6&&!B_FOOT.some(f=>rectsOverlap(drect,f))){
buildDepot(dry,drz,dryaw);
B_FOOT.push(drect);
}
}
// 调车场侧线 (站台西) + 平板车×3 (硬掩体坦克碾不动) —— 道口 z0 净空
railLine(T.x-17,T.z-56,T.x-17,T.z+56);
for(const cz of [-38,18,44]) railFlatcar(T.x-17,T.z+cz,0);
// 站台缘沙袋+弹药箱 (车站强点工事; 大件由 emplacements 前出点体系照常配炮)
if(freeSpot(T.x-4.4,T.z-9,2)) sandbagWall(T.x-4.4,T.z-9,4,HPI);
if(freeSpot(T.x-4.4,T.z+9,2)) sandbagWall(T.x-4.4,T.z+9,4,HPI);
if(freeSpot(T.x-6.4,T.z,1.5)) crate(T.x-6.4,T.z,1.2,0.4);
if(freeSpot(T.x-8,T.z+4,1)) barrel(T.x-8,T.z+4);
}
// ── ③ 风车磨坊 (西线制高): 塔身门朝东 (ry≈HPI), 塔周草垛石堆 ──
if(ST&&ST.mill){
const M=ST.mill;
const pM=placeAt(M.x,M.z,HPI,7.6,7.6,{maxDh:1.2});
if(pM) windmill(pM.x,pM.z,pM.ry);
stoneWall(M.x-9,M.z+6,M.x-3,M.z+8);
for(const [hx,hz] of [[M.x+7,M.z+3],[M.x+5,M.z-6],[M.x-7,M.z-7]]){
if(roadDist(hx,hz)<8||!freeSpot(hx,hz,2)) continue;
const hg=heightAt(hx,hz);
mesh(new THREE.CylinderGeometry(1.1,1.1,1.6,12),MAT.hay,hx,hg+0.8,hz);
CYLS.push({x:hx,z:hz,r:1.15,y0:hg,y1:hg+1.6});
coverPoints.push({x:hx,z:hz-2});
}
}
// ── ④ 装甲坟场 (史实: 缺口走廊两侧的坦克残骸 —— 强攻缺口的 killing ground 观感) ──
if(ST&&ST.wrecks){
for(const [wx,wz,wry] of ST.wrecks){
if(freeSpot(wx,wz,3.5)&&propFree(wx,wz,3.4)) tankWreck(wx,wz,wry);
}
crater(120,-176,3.2); crater(134,-112,2.6); crater(72,-146,2.4); crater(168,-160,2.2);
}
// ── ⑤ 麦田农庄 (khutor): 三木屋+谷仓+院墙+村心柳 (村社台地 FLATS 已平) ──
// ★2026-09-26 修 (P0-3 死袋): 建筑外推到 ≥12m 并**只在北/东两侧成环**, 南/西 = 敞开的场院口。
//   旧口径三木屋+谷仓围在 9~17m 处 (原木屋的竖木墙是实心碰撞链, 0.3m 一根), 加上两道院墙把村心
//   围成一圈: 5m 导航格上看, 强点「麦田农庄」连同周边 7 格自成一个连通分量 (不接本队基地分量),
//   而强点又正是村心 (-108,152) —— 每次换局必现 (verify-navspots-20260926 稳定判罪)。
//   农庄本来就是"院墙半围合"的语义 (同百团村落的院墙口径): 院门朝着公路一侧敞着才合理,
//   顺带让强点那格接上主网。构型改变只影响本图本村 (steppe 的 village 字段)。
if(ST&&ST.village){
const V=ST.village;
const p1=placeAt(V.x-9,V.z-13,-0.3,6,5,{maxDh:0.6}); if(p1) logCabin(p1.x,p1.z,p1.ry);
const p2=placeAt(V.x+13,V.z-6,0.2,6,5,{maxDh:0.6}); if(p2) logCabin(p2.x,p2.z,p2.ry);
const p3=placeAt(V.x-4,V.z+13,-0.6,6,5,{maxDh:0.6}); if(p3) logCabin(p3.x,p3.z,p3.ry);
const pB=placeAt(V.x+17,V.z+15,0.1,9.5,13.5,{maxDh:0.8}); if(pB) buildBarn(pB.x,pB.z,pB.ry);
stoneWall(V.x-17,V.z-3,V.x-11,V.z+1);   // 西院墙 (向北收, 南端留出 >6m 院门)
stoneWall(V.x+6,V.z-15,V.x+12,V.z-13);  // 南院墙 (向东收)
willowTree(V.x+2,V.z+3);
}
// ── ⑥ 强点工事 (7 个 spawns): 沙袋对角环+箱桶+拒马, 哨塔两座 (北原哨/东岗) ──
// ★2026-09-26 修 (P0-3 死袋): 环上每一件的中心推到离强点 **9.5~11.5m** 的环带 ——
//   ① 外圈 ≥9.5m > 7.5m = 强点 3×3 个 5m 导航格的半径 ⇒ 强点自身连同 8 邻格无工事, 不再被围成死袋
//      (旧口径最近的两面沙袋在 6.4m: 加上 17-emplacements 在 ~6m 处配的反坦克炮/机枪位, 强点那格
//      ——格心离点位 ≤3.5m——会被 6~10m 环上的十来件工事围成 1~5 格孤岛, 实测每次换局 1~3 个强点中招);
//   ② 内圈 ≤11.5m < 强点战圈 r=12 ⇒ 掩护仍算在强点圈内, verify-layouts 的"圈内掩护 ≥3"不变量照旧成立。
const sd=CAMPAIGN.spawns||[];
for(const sp of sd){
if(freeSpot(sp.x+9,sp.z-6,2)) sandbagWall(sp.x+9,sp.z-6,4,wr(0,3));
if(freeSpot(sp.x-9,sp.z+6,2)) sandbagWall(sp.x-9,sp.z+6,4,wr(0,3));
if(freeSpot(sp.x-8,sp.z-8,2)) sandbagWall(sp.x-8,sp.z-8,3,wr(0,3));
if(freeSpot(sp.x+8,sp.z+8.2,2)) sandbagWall(sp.x+8,sp.z+8.2,3,wr(0,3));
if(freeSpot(sp.x,sp.z+10.5,1.5)) crate(sp.x,sp.z+10.5,1.2,wr(0,3));
if(freeSpot(sp.x-5.5,sp.z+10,1.5)) crate(sp.x-5.5,sp.z+10,1.1,wr(0,3));
if(freeSpot(sp.x,sp.z-10,1)) barrel(sp.x,sp.z-10);
if(freeSpot(sp.x+10,sp.z+5,1.5)) hedgehog(sp.x+10,sp.z+5);
}
placeTower(-128,-146);
placeTower(176,4);
// ── ⑦ 全图散布 (640 尺度): 草垛/弹坑/枯树拒马/电话线杆 (杆沿三路公路网) ──
const mineX=ST&&ST.mines?[ST.mines.x0-5,ST.mines.x1+5]:null;
const inMineBand=(x,z)=>mineX&&x>mineX[0]&&x<mineX[1]&&(ST.mines.zRuns||[]).some(r=>z>r[0]-3&&z<r[1]+3);
const inField=(x,z)=>(CAMPAIGN.fields||[]).some(f=>x>f.x0-2&&x<f.x1+2&&z>f.z0-2&&z<f.z1+2);
for(let i=0;i<26;i++){
const hx=wr(-(MS2-30),MS2-30), hz=wr(-(MS2-30),MS2-30);
// 强点净空 10m (2026-09-26 P0-3): 草垛是 r=1.15 的实心圆柱 —— 落在 5m 格的格心 (离强点 ≤3.5m) 上就判死整格
if(!spawnKeepClear(hx,hz,10)) continue;
if(roadDist(hx,hz)<8||!freeSpot(hx,hz,2)||inField(hx,hz)||inMineBand(hx,hz)) continue;
const hg=heightAt(hx,hz);
mesh(new THREE.CylinderGeometry(1.1,1.1,1.6,12),MAT.hay,hx,hg+0.8,hz);
CYLS.push({x:hx,z:hz,r:1.15,y0:hg,y1:hg+1.6});
coverPoints.push({x:hx,z:hz-2});
}
crater(-40,-60,2.6); crater(30,44,2.4); crater(-90,30,2.2); crater(60,-90,2.5);
crater(-150,90,2.8); crater(150,60,2.6); crater(-20,120,2.4); crater(90,-40,2.5);
crater(-200,-60,2.8); crater(210,80,2.6);
for(let i=0;i<14;i++){
const x=wr(-(MS2-40),MS2-40), z=wr(-(MS2-40),MS2-40);
if(!spawnKeepClear(x,z,10)) continue;   // 强点净空 10m (同上; 拒马 r=0.85 也会封格)
if(roadDist(x,z)<8||!freeSpot(x,z,1.5)||inField(x,z)) continue;
if(i%2) deadTree(x,z); else hedgehog(x,z);
}
for(const r of CAMPAIGN.roads){
const ax=r[0],az=r[1],bx2=r[2],bz2=r[3];
const len=Math.hypot(bx2-ax,bz2-az)||1;
const nx=-(bz2-az)/len*3.2, nz=(bx2-ax)/len*3.2;
for(let u=10;u<len;u+=26){
const x=ax+(bx2-ax)*u/len+nx, z=az+(bz2-az)*u/len+nz;
if(inRiverChannel(x,z)) continue;
if(typeof inWaterBody==='function'&&inWaterBody(x,z)) continue;   // 2026-09-26E 审计 34: 通用水体门
const g0=heightAt(x,z);
mesh(new THREE.CylinderGeometry(0.1,0.13,5.6,6),MAT.woodDark,x,g0+2.8,z);
CYLS.push({x,z,r:0.18,y0:g0,y1:g0+5.6});
}
}
}
// -- 雾林守线 (woods): 许特根雾林改版 (2026-09-13) —— 640 大图, 历史原型=许特根森林战役
//    (1944.9-12, 亚琛以南): 美军攻入浓雾密林, 德军依托西墙工事带节节设防。
//    特色: ①西墙防线 (龙牙双排+永备火力点, 主防火道缺口=唯一装甲走廊) ②防火带路网 (林间开阔走廊,
//    也是树爆的安全带) ③北谷卡尔小径 (谷底泥径+坦克坟场+三处堑口) ④岭上村台地 (教堂地标+石屋村社)
//    ⑤灌丛软遮蔽带 (CROP_FIELDS+幼杉) ⑥树爆环境炮击 (机制本体在 04b-fire, 布局只管布景)
function layoutWoods(){
const WD=CAMPAIGN.wood; if(!WD) return;
const MS2=MAP_SIZE/2;
// ── ① 西墙防线 (belt): 龙牙双排交错 (混凝土, 无 crush 碾不动 —— 同莫斯科城缘带) ──
//    缺口 |z|<gapZ 为唯一装甲走廊 (主防火道穿缺口), 缺口两翼机枪+纵深战壕 (战壕由 config 驱动) 封锁
{
const B=WD.belt, rows=[[B.x0,0],[B.x1,2.6]]; // 双排交错: 第二排沿带向错半步
for(const [rowX,st] of rows){
for(let z=-B.spanZ;z<=B.spanZ;z+=5.2){
if(Math.abs(z)<B.gapZ) continue;
dragonTooth(rowX+wr(-0.8,0.8),z+st+wr(-0.8,0.8),wr(0,3));
}
}
// 带后永备火力点×3 (面西=来敌方向; 面向=-HPI 即本地 +z 轴指向世界 -x)
for(const [px,pz] of [[168,-118],[172,36],[168,150]]){
if(freeSpot(px,pz,4.2)&&propFree(px,pz,4.2)) bunker(px,pz,-HPI+wr(-0.1,0.1));
}
// 缺口两翼机枪 (封走廊) + 缺口前防坦克拒马对 (西侧拦头, 中间留车行缝)
mg42(B.x0-4,-B.gapZ-5,-HPI,1);
mg42(B.x0-4, B.gapZ+5,-HPI,1);
if(freeSpot(B.x0-11,-9,1.5)) hedgehog(B.x0-11,-9);
if(freeSpot(B.x0-11, 9,1.5)) hedgehog(B.x0-11, 9);
// 带前铁丝网 (西面) 数段
for(const wz of [-64,-138,84,196]) if(freeSpot(B.x0-8,wz,1.6)&&propFree(B.x0-8,wz,1.6)) barbedWire(B.x0-8,wz,-HPI,4.2);
}
// ── ② 岭上村 (Vossenack 型岭顶村社): 教堂地标+谷仓+石屋+院墙 —— 纵深据点, 屋顶/屋内=树爆庇护所 ──
//    村社最先落位 (台地 FLATS 已平, placeAt 锚点此后无足迹冲突)
{
const V=WD.village;
const pC=placeAt(V.x-13,V.z-10,0.15,11.5,21.6,{oz:-2.55,maxDh:1.6}); // 复合体足迹 (P2-15)
if(pC) buildChurch(pC.x,pC.z,pC.ry);
const pB=placeBuild(V.x+15,V.z-7,16,9.5,13.5,{maxDh:1.0});
if(pB) buildBarn(pB.x,pB.z,pB.ry);
for(const [cx,cz] of [[V.x+10,V.z+16],[V.x-14,V.z+14],[V.x-2,V.z+26]]){
const p=placeBuild(cx,cz,10,6,5,{maxDh:1.0});
if(p) logCabin(p.x,p.z,p.ry);
}
stoneWall(V.x-4,V.z-6,V.x+4,V.z-4);   // 井台矮墙 (村心广场)
stoneWall(V.x+20,V.z+4,V.x+24,V.z+14); // 村东院墙
}
// ── ③ 北谷 (卡尔小径): 谷底坦克坟场 (史实: 卡尔小径的装甲瓶颈残骸线) + 谷缘哨塔 ──
for(const [wx,wz,wry] of WD.kallWrecks){
if(freeSpot(wx,wz,3.5)&&propFree(wx,wz,3.4)) tankWreck(wx,wz,wry);
}
placeTower(-46,132); placeTower(52,196); // 谷缘哨塔 (两岸各一, 俯瞰谷底堑口)
// 堑口标桩 (车辆堑口两端木箱+油桶; 步兵堑口只标桩) —— Bot/玩家读出过谷通道
{
// 2026-09-25 修: ramps 表是 {x0,z0,x1,z1,w} (00-config WD.*.ravine), **没有 x 字段** ——
// 旧版读 VR.x / ir.x 恒 undefined ⇒ 8 件标桩全建在 NaN (freeSpot(NaN,…) 反而恒 true 放行),
// 既看不见又往 BOXES/CYLS/PROPS/coverPoints 里灌 NaN。按端点取中线, 斜置堑口也成立。
const VR=WD.ravine.ramps[0], VRx=(VR.x0+VR.x1)*0.5;
for(const ez of [VR.z0+4,VR.z1-4]){
if(freeSpot(VRx-6,ez,1.2)) crate(VRx-6,ez,1.2,wr(0,3));
if(freeSpot(VRx+6,ez,1)) barrel(VRx+6,ez);
}
for(const ir of [WD.ravine.ramps[1],WD.ravine.ramps[2]]){
const irx=(ir.x0+ir.x1)*0.5;
if(freeSpot(irx-5,ir.z0+3,1.1)) crate(irx-5,ir.z0+3,1.1,0);
if(freeSpot(irx+5,ir.z1-3,1.1)) crate(irx+5,ir.z1-3,1.1,0);
}
}
// ── ④ 旗点营地 (7 旗): 按归属分侧 —— 德据点=机枪+沙袋环, 美出发旗=帐篷轻工事, 中立=环形掩体 ──
CAMPAIGN.flags.forEach(f=>{
if(f.id==='卡尔小径'){
// 谷底窄地: 机枪封堑口 + 沙袋环 + 弹药 (不摆碉堡 —— 谷底平带仅 ~10m 宽)
mg42(f.x-6,f.z-3,-HPI,1);
if(freeSpot(f.x+5,f.z+4,2)) sandbagWall(f.x+5,f.z+4,4,HPI);
if(freeSpot(f.x+2,f.z-6,2)) sandbagWall(f.x+2,f.z-6,3.5,0);
if(freeSpot(f.x-3,f.z+7,1.2)) crate(f.x-3,f.z+7,1.2,wr(0,3));
}else if(f.id==='十字防火道'){
// 防火瞭望塔+看护小屋 (防火带地标) + 环形沙袋 (中立, 双方抢点)
placeTower(f.x+9,f.z+7);
let p=placeBuild(f.x-10,f.z-8,10,6,5,{maxDh:1.0});
if(p) logCabin(p.x,p.z,p.ry);
if(freeSpot(f.x+6,f.z-5,2)) sandbagWall(f.x+6,f.z-5,4,wr(0,3));
if(freeSpot(f.x-5,f.z+7,2)) sandbagWall(f.x-5,f.z+7,4,wr(0,3));
if(freeSpot(f.x+2,f.z+9,1)) barrel(f.x+2,f.z+9);
}else if(f.id==='西墙缺口'){
// 缺口守备: 沙袋圈+拒马 (龙牙带/机枪/战壕已由西墙段与 config 覆盖)
// ★ 装甲走廊净空: 缺口带 (x 146..164, |z|<22) 内不得摆任何阻挡件 —— 沙袋/拒马/杂物一律放走廊外翼侧
if(freeSpot(f.x-6,f.z-10,2)) sandbagWall(f.x-6,f.z-10,4,HPI);
if(freeSpot(f.x-6,f.z+10,2)) sandbagWall(f.x-6,f.z+10,3.5,HPI);
if(freeSpot(f.x-10,f.z,1.5)) hedgehog(f.x-10,f.z);
if(freeSpot(f.x-5,f.z-10,1.2)) crate(f.x-5,f.z-10,1.2,wr(0,3));
}else if(f.id==='坝路枢纽'){
// 纵深枢纽: 碉堡+机枪+兵舍+沙袋 (罗尔水坝公路的路卡)
let p=placeBuild(f.x+8,f.z+6,11,4.4,4,{maxDh:1.2});
if(p) bunker(p.x,p.z,Math.atan2(-160,-40));
mg42(f.x-6,f.z-4,-HPI+0.2,1);
p=placeBuild(f.x-8,f.z+8,10,6,5,{maxDh:1.0});
if(p) logCabin(p.x,p.z,p.ry);
if(freeSpot(f.x+2,f.z-8,2)) sandbagWall(f.x+2,f.z-8,3.5,HPI+0.3);
}else if(f.id==='岭上村'){
// ★2026-09-26 修 (死分支): 本档原条件是 `own===1`, 而雾林图 7 面旗在 00-config 里**一个都没写 own**
// (own 是"开局归属"字段, 本图全中立) ⇒ 这一档从未生效, 南岭村社强点一直拿的是下面那套"美军出发营区"
// 模板 (帐篷×2) 而不是本节注释承诺的"德据点=机枪+沙袋环"。改为按 id 点名分档 (与卡尔小径/十字防火道/
// 西墙缺口/坝路枢纽同规); **不动 own 字段** ⇒ 开局归属与占位口径零变化 (本图仍全部中立)。
mg42(f.x-5,f.z+4,-HPI,1);
if(freeSpot(f.x+5,f.z-4,2)) sandbagWall(f.x+5,f.z-4,4,wr(0,3));
if(freeSpot(f.x-2,f.z-8,1.2)) crate(f.x-2,f.z-8,1.2,wr(0,3));
if(freeSpot(f.x+7,f.z+7,1)) barrel(f.x+7,f.z+7);
}else{
// 美军出发旗 (雾谷哨/防火道西口): 帐篷×2+沙袋+弹药 (营区模板之外的连级出发营地)
let p=placeBuild(f.x,f.z,7,3.4,4.6,{ry:wr(0,3),maxDh:0.5});
if(p) tent(p.x,p.z,p.ry);
p=placeBuild(f.x,f.z,7,3.4,4.6,{ry:wr(0,3),maxDh:0.5});
if(p) tent(p.x,p.z,p.ry);
if(freeSpot(f.x+7,f.z-4,2)) sandbagWall(f.x+7,f.z-4,4,wr(0,3));
if(freeSpot(f.x-6,f.z+3,2)) sandbagWall(f.x-6,f.z+3,3.5,wr(0,3));
if(freeSpot(f.x+2,f.z+8,1.2)) crate(f.x+2,f.z+8,1.2,wr(0,3));
if(freeSpot(f.x-8,f.z-6,1)) barrel(f.x-8,f.z-6);
}
});
// ── ⑤ 灌丛软遮蔽带: CROP_FIELDS 登记 (顶高 1.9 —— 站立也隐, 软遮蔽不挡弹不挡人)
//    + 幼杉/蕨丛视觉 (细干不进占用格, 不堵 Bot 寻路) —— 林下渗透路线, Bot 隔灌丛对射 (cropBlocksLOS) ──
for(const u of WD.under){
CROP_FIELDS.push({x0:u.x0,x1:u.x1,z0:u.z0,z1:u.z1,h:1.9});
const area=(u.x1-u.x0)*(u.z1-u.z0);
const nT=Math.round(area/46);
for(let k=0;k<nT;k++){
const x=wr(u.x0+2,u.x1-2), z=wr(u.z0+2,u.z1-2);
if(roadDist(x,z)<4.5||!freeSpot(x,z,0.8)) continue;
tree(x,z,wr(0.35,0.6)); // 幼杉 (湿滑林下的更新层)
}
for(let k=0;k<nT;k++){
const x=wr(u.x0+1,u.x1-1), z=wr(u.z0+1,u.z1-1);
if(roadDist(x,z)<3.5||!freeSpot(x,z,0.6)) continue;
fernClump(x,z);
}
}
// ── ⑥ 防火带家具与毁损林相: 弹坑线 (炮火犁过的走廊) + 倒木 (卧姿掩体, 坦克可碾) ──
crater(-60,5,2.2); crater(30,-9,2.0); crater(96,7,2.4); crater(-120,-7,2.0); crater(58,9,1.9);
crater(-152,44,2.1); crater(-70,132,2.2); crater(24,92,2.0); crater(120,-52,2.3);
for(let i=0;i<12;i++){
const x=wr(-(MS2-40),MS2-40), z=wr(-(MS2-40),MS2-40);
if(roadDist(x,z)<4||woodRavineDist(x,z)<WOOD.ravine.w+2||!freeSpot(x,z,1.6)) continue;
fallenLog(x,z,wr(0,Math.PI));
}
// 谷底泥径倒木×4 (卡尔小径的林障)
for(const [lx,lz] of [[-20,162],[24,159],[66,156],[-64,164]]){
if(freeSpot(lx,lz,1.6)) fallenLog(lx,lz,wr(-0.5,0.5)+HPI);
}
// ── ⑦ 基地加建: 碉堡面向敌基+哨塔+拒马 (非可碾件一律距基地中心≥19m —— 坦克出生环带净空, 胡康口径) ──
CAMPAIGN.bases.forEach((b,t)=>{
const sgn=b.x<0?1:-1;
const pB=placeAt(b.x+sgn*20,b.z+16,0,7,6,{maxDh:1.2});
// ★ 2026-09-26 A8 修: 朝向符号写反 —— 碉堡的'前墙' = 局部 +z = face 方向 = (sin face, cos face),
//   而 `sgn` 是从基地指向地图中心 (= 敌军来向) 的方向。旧式 atan2(**-sgn**·100,30) 让射击孔朝地图**外缘**
//   (背对来敌, 整座碉堡等于一堵无孔墙)。只翻 x 项符号, 作者原来的 +30 (北偏) 保留。
if(pB) bunker(pB.x,pB.z,Math.atan2(sgn*100,30));
placeTower(b.x-sgn*10,b.z-18);
const pT=placeAt(b.x+sgn*6,b.z-14,0.3,6,5,{maxDh:1.2}); if(pT) tent(pT.x,pT.z,pT.ry);
if(freeSpot(b.x+sgn*18,b.z+8,1.5)) hedgehog(b.x+sgn*18,b.z+8);
});
}
// -- 断崖公路劫道 (canyon): 伏击山谷 —— 谷底走廊, 两侧山坡中高处为伏击带,
//    无基地、无固定火力点、无建筑: 纯自然坡体掩体 (乱石/枯树/倒木/沙袋窝) --
// (2026-11-10: layoutOpensea 全海图布局随珊瑚海/铁底湾下架摘除, 原文见 archive/naval-coral-ironbottom-20261110/)
function layoutCanyon(){
// 伏击缓台的乱石掩护体 (局部函数, 仅本战役使用; 摆放全走种子流保证确定性)
const boulder=(x,z,r)=>{
if(!freeSpot(x,z,r)) return;
const g0=heightAt(x,z);
const m2=new THREE.Mesh(new THREE.SphereGeometry(r,7,5),MAT.stone);
m2.position.set(x,g0+r*0.45,z); m2.scale.y=0.62; m2.castShadow=true;
world.add(m2);
CYLS.push({x,z,r:r*0.95,y0:g0,y1:g0+r});
coverPoints.push({x,z});
};
// 劫道方伏击点: 两侧山坡阶台 —— 沙袋沿等高线(HPI)摆半环+杂物+临时补给点 (无固定火力点)
const sd=CAMPAIGN.spawns||[];
for(const sp of sd){
if(sp.team!==0) continue;
if(roadDist(sp.x+2.6,sp.z)>8&&freeSpot(sp.x+2.6,sp.z,2)) sandbagWall(sp.x+2.6,sp.z,3.5,HPI);
if(roadDist(sp.x-2.6,sp.z)>8&&freeSpot(sp.x-2.6,sp.z,2)) sandbagWall(sp.x-2.6,sp.z,3.5,HPI);
if(roadDist(sp.x+3,sp.z-2)>8&&freeSpot(sp.x+3,sp.z-2,1.2)) crate(sp.x+3,sp.z-2,1.2,wr(0,3));
if(roadDist(sp.x-2.5,sp.z+2)>8&&freeSpot(sp.x-2.5,sp.z+2,1)) barrel(sp.x-2.5,sp.z+2);
if(roadDist(sp.x+1,sp.z-4.5)>8&&freeSpot(sp.x+1,sp.z-4.5,1.5)) deadTree(sp.x+1,sp.z-4.5);
boulder(sp.x-3.5,sp.z-1.5,wr(1.1,1.5)); boulder(sp.x+3.8,sp.z+1.8,wr(0.9,1.3));
placeSupplyPoint(sp.x-2,sp.z-3.2);
}
// 两侧山坡伏击带: 乱石/枯树/鹿柴散布 (rd 7~32, 高度<13m 不占山肩)
for(let i=0;i<30;i++){
const x=wr(-132,132);
const z=(i%2?-1:1)*(8+wr(0,24));
if(roadDist(x,z)<7||heightAt(x,z)>13||!freeSpot(x,z,1.2)) continue;
const k=i%3;
if(k===0) deadTree(x,z); else if(k===1) rubblePile(x,z,wr(1.2,2.0)); else hedgehog(x,z);
}
// 山坡乱石群 (中低坡, 伏击天然掩体)
for(let i=0;i<12;i++){
const x=wr(-126,126);
const z=(i%2?-1:1)*(9+wr(0,17));
if(roadDist(x,z)<7||heightAt(x,z)>12||!freeSpot(x,z,1.5)) continue;
boulder(x,z,wr(0.8,1.4));
}
// 谷道沿线弹坑与倒木 (山坡脚, 不压公路中心)
crater(30,8,2.0); crater(-40,-8,2.1); crater(14,9,1.8); crater(-96,-8,2.0);
for(let i=0;i<7;i++){
const x=wr(-120,120);
const z=(i%2?-1:1)*(6+wr(0,10));
if(roadDist(x,z)<6||heightAt(x,z)>8) continue;
fallenLog(x,z,wr(0,Math.PI));
}
}
// ═══════════ 莫斯科城郊加密三件套 (2026-09-12 城市边缘改版, 机制同柏林三件套) ═══════════
// ①moscowBlockWalls —— 街块围合: 沿街块四边落排楼/街墙 (补 cityBlockRows 只沿最近街缘一排的缺口);
//   中央带 (主街与两横街之间, |z心|<60) 全四边围合, 南北带 (城缘纵深) 只南边必做其余半数;
// ②moscowCourtyards —— 街块内部庭院填充 (棚屋/瓦砾/弹坑/枯树/沙袋/车残骸)
function moscowBlockWalls(){
const ct=CAMPAIGN.city; if(!ct) return;
for(const b of ct.blocks){
const core=Math.abs((b.z0+b.z1)/2)<60; // 中央带 (两横街之间的 8 块) / 城缘纵深带
// 最近街缘 = cityBlockRows 已占用的那一边 (同判定式) —— 跳过它, 免得长街墙挤不进同一条线白试 8 次
let best=1e9, used='W';
for(const s of ct.streets){
const dW=Math.abs(s.x1-b.x0), dE=Math.abs(s.x0-b.x1), dN=Math.abs(s.z1-b.z0), dS=Math.abs(s.z0-b.z1);
if(dW<best){best=dW;used='W';} if(dE<best){best=dE;used='E';}
if(dN<best){best=dN;used='N';} if(dS<best){best=dS;used='S';}
}
const Lmin=core?20:16, Lmax=core?32:26;
const fd=core?(wr(0,1)<0.5?11:10):9;
const edges=[
['N',b.x1-b.x0,(u)=>[b.x0+u, b.z0+fd/2+2.6, Math.PI]],
['S',b.x1-b.x0,(u)=>[b.x0+u, b.z1-fd/2-2.6, 0]],
['W',b.z1-b.z0,(u)=>[b.x0+fd/2+2.6, b.z0+u, -HPI]],
['E',b.z1-b.z0,(u)=>[b.x1-fd/2-2.6, b.z0+u, HPI]]];
for(const [side,len,at] of edges){
if(side===used) continue;
if(!core&&side!=='S'&&wr(0,1)<0.5) continue; // 城缘纵深带: 只南边必做, 其余半数
let u=15+wr(0,4); // 角部内缩 15m: 让开 cityBlockRows 主排的转角楼 (柏林批次实证值)
const uEnd=len-15-wr(0,4);
while(u<uEnd-14){
const L=Math.min(wr(Lmin,Lmax),uEnd-u);
if(L<Lmin*0.8) break;
const [bx,bz,ry]=at(u+L/2);
u+=L+wr(6,core?11:15)+2; // 推进量按计划长度 (与放置结果无关, 保证节奏稳定)
if(streetDist(bx,bz)<fd/2+4.0) continue; // 锚点距街缘≥进深一半+4 (同 cityBlockRows)
let nearFlag=false;
for(const fc of CAMPAIGN.flags){ if(Math.hypot(bx-fc.x,bz-fc.z)<Math.max(L,fd)*0.5+4.2){ nearFlag=true; break; } }
if(nearFlag) continue;
const r=wr(0,1);
const dep=r<0.24?fd:4.0;
let p=null, Lp=L;
for(const f of [1,0.62,0.42]){
Lp=Math.max(8,L*f);
p=placeAt(bx,bz,ry,Lp,dep,{maxDh:1.2,strict:true});
if(p) break;
}
if(!p) continue;
if(r<0.16) terrace(p.x,p.z,p.ry,Lp,fd);
else if(r<0.24) ruinedHouse(p.x,p.z,Lp,fd,p.ry,wr(0,1)<0.5?MAT.brick:MAT.plaster,0.42);
else facadeRuin(p.x,p.z,p.ry,Lp);
}
}
}
}
function moscowCourtyards(){
const ct=CAMPAIGN.city; if(!ct) return;
for(const b of ct.blocks){
const core=Math.abs((b.z0+b.z1)/2)<60;
const n=core?12:6;
for(let i=0;i<n;i++){
const x=b.x0+12+wr(0,Math.max(1,b.x1-b.x0-24));
const z=b.z0+12+wr(0,Math.max(1,b.z1-b.z0-24));
if(!freeSpot(x,z,2.2)) continue;
const r=wr(0,1);
if(r<0.30) rubblePile(x,z,wr(1.5,2.6));
else if(r<0.48) crater(x,z,wr(1.6,2.4));
else if(r<0.62) deadTree(x,z);
else if(r<0.72) sandbagWall(x,z,3.5,wr(0,3));
else if(r<0.80) carWreck(x,z,wr(0,3));
else if(r<0.88) hedgehog(x,z);
else if(r<0.94) crate(x,z,1.2,wr(0,3));
else barrel(x,z);
}
const nS=core?2:1;
for(let k=0;k<nS;k++){
if(!core&&wr(0,1)<0.5) continue;
const x=b.x0+(b.x1-b.x0)/2+wr(-9,9), z=b.z0+(b.z1-b.z0)/2+wr(-11,11);
const p=placeAt(x,z,wr(0,TAU),7,6,{maxDh:1.2,strict:true});
if(p) ruinedHouse(p.x,p.z,7,6,p.ry,MAT.brick,0.55);
}
}
}
// -- 莫斯科保卫战 1941 (2026-09-12 城市边缘改版: 640 大地图 · 三路扇面 6 旗 · 城缘街网+厂区+编组站) --
// 布局拓扑: 德军主基东侧(290,0) 沿东郊公路进攻, 苏军主基西侧(-290,0) 据守城网;
//   北线: 东村→编组站(调车线/货栈) | 中线: 主街→街垒区(钢轨纵深)→教堂广场 | 南线: 河湾村→南横街→厂区(苏军坦克产能);
//   城缘带 x≈118 反坦克壕+龙牙+机枪堡 (公路缺口 z -16..16 是唯一装甲走廊)
function layoutMoscow(){
// ── 手摆地标先行登记足迹 (cityBlockRows/街墙自动避让) ──
// 厂区地标 (红十月型厂房, 院区 yard 82×70): 厂房旗在北院, factorySpawn 西停车场 (00-config)
redOctober(-60,-170,0);
// 教堂 (纵深旗地标): 广场 street rect 北侧, 塔楼朝广场 —— placeAt 首试精确落位 (占用才抖动)
{ const p=placeAt(-215,50,0,11.5,21.6,{oz:-2.55,maxDh:1.6}); if(p) buildChurch(p.x,p.z,p.ry); } // 复合体足迹 (P2-15)
stoneWall(-232,46,-200,46); // 广场北缘残墙 (教堂围垣)
// 东郊两村 (攻方出发阵地): 木屋群+仓房
for(let i=0;i<4;i++){ const p=placeBuild(190,110,11,6,5); if(p) logCabin(p.x,p.z,p.ry); }
{ const p=placeBuild(214,132,10,9,13); if(p) buildBarn(p.x,p.z,p.ry); }
for(let i=0;i<4;i++){ const p=placeBuild(190,-100,11,6,5); if(p) logCabin(p.x,p.z,p.ry); }
{ const p=placeBuild(214,-126,10,9,13); if(p) buildBarn(p.x,p.z,p.ry); }
// ── 城网成排布楼 (640 大图间距 24m) ──
cityBlockRows(true,24);
// ── 编组站 (北线旗): 调车线×2 横贯货场 + 平板车 + 货栈 + 烧毁坦克 (轨穿旗心=道口语义, 同斯大林格勒铁道口) ──
railLine(-10,158,90,158);
railLine(-10,174,90,174);
railFlatcar(14,158,HPI+0.02); railFlatcar(56,174,HPI-0.03); railFlatcar(-2,166,HPI+0.05);
{ const p=placeAt(60,210,0.1,9.5,13.5,{maxDh:1.2}); if(p) buildBarn(p.x,p.z,p.ry); }
tankWreck(78,140,0.4);
ingotStack(56,198,0.3); crate(40,166,1.2,0.5); barrel(18,198);
sandbagWall(12,146,4,0);
// ── 主街家具: 电车轨全线 + 两节可进残骸 + 街灯 + 瓦砾带 ──
tramRails(-254,92,0);
tramWreck(-120,4.6,HPI+0.05);
tramWreck(36,-4.6,HPI-0.04);
for(let x=-250;x<=90;x+=34){
lampPost(x,7.2,HPI); lampPost(x+17,-7.2,-HPI);
}
debrisLine(-250,10.8,88,10.8,15);
debrisLine(-250,-10.8,88,-10.8,15);
// ── 街垒区 (中线旗): 主街三层钢轨街垒纵深 + 坦克残骸 + 铁丝网 (同柏林街垒区格局) ──
const barricadeLine=(x0,z0,x1,z1,step)=>{
const len=Math.hypot(x1-x0,z1-z0), ry=Math.atan2(x1-x0,z1-z0)+HPI;
const n=Math.max(1,Math.round(len/step));
for(let i=0;i<n;i++){
const t=(i+0.5)/n;
railBarricade(x0+(x1-x0)*t+wr(-0.8,0.8), z0+(z1-z0)*t+wr(-0.8,0.8), ry+wr(-0.12,0.12));
}
};
barricadeLine(-30,5.5,30,5.5,9);
barricadeLine(-30,-5.5,30,-5.5,9);
barricadeLine(-14,14,14,14,9);
tankWreck(-44,9,1.1); tankWreck(42,-10,-0.6);
if(propFree(-8,18,1.5)) barbedWire(-8,18,0,4.2);   // 铁丝网封 V4 街 (旗圈外, 街内净位预检)
if(propFree(-8,-18,1.5)) barbedWire(-8,-18,0,4.2);
if(freeSpot(-36,12,1.5)) hedgehog(-36,12);
if(freeSpot(34,12,1.5)) hedgehog(34,12);
// ── 城缘反坦克防线 (x≈118 带, 公路缺口 z -16..16): 龙牙双排交错+机枪堡+沙袋段 —— 坦克只能走缺口 ──
// ★2026-09-26 修 (穿模): 两座机枪堡的落位 (118,∓45)/(118,57) 就在龙牙线上, 而龙牙先落位、碉堡后建
//   (bunker 不做占位预检) —— 实测每座堡足迹内嵌着 2 颗龙牙 (118,-46 / 118,54 / 118,60 / 121,60),
//   炮堡里戳出水泥块。按碉堡足迹 (±3.8 × ±3.4) 跳过相邻站位: 堡体自己就是那一小段的封堵,
//   龙牙线在视觉与"挡坦克"的语义上都不断。
const nearBunker=(z)=>Math.abs(z+45)<6.5||Math.abs(z-57)<6.5;
for(let z=-70;z<=-16;z+=6){ if(nearBunker(z)) continue; if(freeSpot(118,z,1.8)) dragonTooth(118,z,0); }
for(let z=30;z<=84;z+=6){ if(nearBunker(z)) continue; if(freeSpot(118,z,1.8)) dragonTooth(118,z,0); }
for(let z=-64;z<=-22;z+=12){ if(nearBunker(z)) continue; if(freeSpot(121,z,1.8)) dragonTooth(121,z,0); } // 第二排交错
for(let z=36;z<=78;z+=12){ if(nearBunker(z)) continue; if(freeSpot(121,z,1.8)) dragonTooth(121,z,0); }
bunker(118,-45,HPI); // 机枪堡面东 (封锁北段缺口侧翼)
bunker(118,57,HPI);  // 南段
sandbagWall(112,-28,4,HPI); sandbagWall(112,44,4,HPI); sandbagWall(112,72,4,HPI);
crater(110,-10,2.2); crater(112,20,2.0); crater(126,-40,2.1); crater(124,64,2.0);
// ── 街块围合 + 庭院填充 (城网加密) ──
moscowBlockWalls();
moscowCourtyards();
// ── 城市街景 + 守方(苏军)工事模板 ──
cityDressing(true,{x0:-300,z0:-230,x1:100,z1:230});
defWorks(); // 守方=苏军 (campaign.defSide=0, 00-config 单源)
// ── 东郊野带 (城网之外): 枯树/弹坑/雪原散布 —— 主干道两侧的德军进攻轴 ──
for(const [ox,oz] of [[246,140],[246,-160],[150,210],[140,-190],[260,40],[260,-40],[120,120],[120,-60]]){
for(let i=0;i<4;i++){
const x=ox+wr(-9,9), z=oz+wr(-9,9);
if(roadDist(x,z)<7||cityUrban(x,z)||!freeSpot(x,z,1.2)) continue;
const k=wr(0,1);
if(k<0.5) deadTree(x,z); else if(k<0.75) crater(x,z,wr(1.8,2.6)); else rubblePile(x,z,wr(1.6,2.4));
}
}
// 东郊战斗遗留: 烧毁坦克/拒马 (公路缺口两侧)
tankWreck(238,70,0.4); tankWreck(166,-58,-0.5);
if(freeSpot(232,52,1.5)) hedgehog(232,52);
if(freeSpot(150,-96,1.5)) hedgehog(150,-96);
// 西缘带 (城网与苏军主基之间): 稀疏枯树+瓦砾
for(const [ox,oz] of [[-282,60],[-284,-70],[-286,140],[-282,-150]]){
for(let i=0;i<3;i++){
const x=ox+wr(-8,8), z=oz+wr(-8,8);
if(roadDist(x,z)<7||cityUrban(x,z)||!freeSpot(x,z,1.2)) continue;
if(wr(0,1)<0.6) deadTree(x,z); else rubblePile(x,z,wr(1.4,2.2));
}
}
}
// ══════════ 塔拉瓦环礁 1943 (2026-09-18 太平洋岛屿登陆批 / 09-18b 三面 / ★09-19 四面环海) ══════════
// 四面环海: 陆地是**居中的孤岛 (四湾四岬)** —— 南登陆湾 / 西湾 / 东湾 / 北湾 四个海湾各是一处可上陆滩头,
// 四条岸线首尾相接 ⇒ 没有任何一处陆地接图缘; 环岛通航环带 (sea.navRing) 绕岛一周不断。
// 海战格局: 四湾 = 四处可登陆点 (四组浮标标出进近航道), 四岬 = 四处防御制高点 (灯塔/炮台/观察哨);
// 攻方不必挤在南面, 守方必须四面设防 (M 段三湾岸防工事即"四面设防"的体现)。
// 三路扇面: 左线 西滩头→灯塔岬→椰林营区 / 中线 南登陆湾→中障壁→机场 / 右线 东滩头→炮台岬; 日军主基在北湾内岸。
// 五层立体: ①水下层 (礁盘涉水/礁缘潜泳/栈桥下潜泳穿行) ②海面层 (游泳渡水) ③滩头层 (沙丘脊)
//          ④椰林台地层 ⑤制高与工事内层 (灯塔环廊 10m / 塔台顶 7.6m / 岸炮位 / 木碉堡内室)
// 布局纪律: 一切"离岸/入陆"定位经 03-terrain shoreDist/shoreZAt/northZAt/coastXAt 同一支距离场
// (四面海岸) —— 剖面/色带/OCC/HUD/海面网格同源, 严禁另写岸线坐标。
// 下列 S/N/W/E 四支定位助手只做"岸线 + 有符号偏移"的展开, 参数即 sea 表的岸线。
// 守方工事模板 (太平洋版): 工事语言 = 椰子木掩体 + 珊瑚石 + 沙袋 + 铁丝网 (不是城市组的钢轨街垒)
function islandDefWorks(defTeam){
const atkB=CAMPAIGN.bases[ATK]||basePos(ATK);
for(const f of CAMPAIGN.flags){
// 攻方开局已夺取的滩头阵地不再配日军工事 (工事语言要落在纵深): 否则攻方在自家旗圈里被
// 面朝自己的椰木掩体+机枪位压制 —— 无头全对局实测攻方被一路反推下海的主因之一
if(Math.hypot(f.x-atkB.x,f.z-atkB.z)<130) continue;
const face=Math.atan2(atkB.x-f.x,atkB.z-f.z);
const fx=Math.sin(face), fz=Math.cos(face);
// 旗外 12m 侧位: 椰子木掩体 (面向攻方)
{
const bx=f.x+fx*12+fz*5.5, bz=f.z+fz*12-fx*5.5;
if(shoreDist(bx,bz)<-6&&freeSpot(bx,bz,3)&&propFree(bx,bz,3)) logBunker(bx,bz,face);
}
// 旗外 9m: 沙袋胸墙两道 (中间留 2m 缝 —— 可通行可火力封锁)
for(const sgn of [1,-1]){
const px=f.x+fx*9+fz*sgn*2.7, pz=f.z+fz*9-fx*sgn*2.7;
if(shoreDist(px,pz)<-4&&freeSpot(px,pz,1.8)&&propFree(px,pz,1.8)) sandbagWall(px,pz,3.2,face+HPI);
}
// 机枪位 (旗外 7m 侧位, 朝攻方)
for(const sgn of [1,-1]){
const mx=f.x+fx*7-fz*sgn*4.5, mz=f.z+fz*7+fx*sgn*4.5;
if(shoreDist(mx,mz)<-4&&freeSpot(mx,mz,2.6)&&propFree(mx,mz,2.3)){ mg42(mx,mz,face,defTeam); break; }
}
// 铁丝网一道 (旗外 15m, 只在陆上)
{
const wx=f.x+fx*15+fz*2, wz=f.z+fz*15-fx*2;
if(shoreDist(wx,wz)<-5&&freeSpot(wx,wz,1.5)&&propFree(wx,wz,2.3)) barbedWire(wx,wz,face+HPI,3.6);
}
}
}
function layoutIsland(){
// ★ 2026-09-19 四面环海: 陆地是居中孤岛 (四湾四岬), 四个海湾各是一处可登陆滩头 ——
// 岸线相对定位四支 (d>0 = 向海, d<0 = 向陆), 坐标全部现算自 CAMPAIGN.sea 同一份岸线 (纲领 §4.3):
const S=(x,d)=>[x, shoreZAt(x)+d];                    // 南登陆湾: d>0 向南出湾
const N=(x,d)=>[x, northZAt(x)-d];                    // 北湾 (守方后方): d>0 向北出海
const W=(z,d)=>[coastXAt(SEA.west,z)-d, z];           // 西湾: d>0 向西出海
const E=(z,d)=>[coastXAt(SEA.east,z)+d, z];           // 东湾: d>0 向东出海
const chanBlocked=(x,z)=>seaChannelMask(x,z)>0.15;    // 登陆航道走廊 (障碍带在此断开; 必须传真实 z —— 航道带限定海域)
const pierZone=(x,z)=>(x>12&&x<32&&z>160&&z<222);     // 栈桥/泊位水域 (障碍带让位)
// ── A. 南登陆湾滩头 (美军主基 0,158): 搁浅登陆艇×3 + 补给堆 + 沙袋 + 舰炮准备弹坑 ──
// (弹坑是纯视觉; 攻方真正能吃到的掩体 = 登陆艇残骸/烧毁坦克/珊瑚岩块 —— 见下 A2)
{ const p=S(-58,-2); landingCraft(p[0],p[1],0.10); }
{ const p=S(64,-3); landingCraft(p[0],p[1],-0.16); }
{ const p=S(8,2.5); landingCraft(p[0],p[1],0.04); }   // 第三艘: 正对登陆场中路 (中路推进的起始掩体)
// A2. 登陆轴硬掩体 (攻方靠它换弹/换位; 史实: 滩头遍布烧毁车辆与珊瑚岩块)
{ const p=S(-28,-12); tankWreck(p[0],p[1],0.35); }
{ const p=S(30,-14); tankWreck(p[0],p[1],-0.4); }
tankWreck(-16,136,0.2); tankWreck(20,110,-0.3);       // 中路推进轴 (滩头→中障壁) 两处残骸
for(const [ox,oz] of [[-20,152],[18,150],[-10,124],[12,116],[-26,96],[28,92],[-8,62],[16,50]]){
if(shoreDist(ox,oz)<-40&&freeSpot(ox,oz,1.6)) reefRock(ox,oz,wr(1.0,1.5));   // 陆上珊瑚岩块 = 硬掩体
}
for(const [cx,cz,s,ry] of [[-34,158,1.3,0.4],[28,160,1.1,1.2],[-16,163,1.2,2.1]]){
if(freeSpot(cx,cz,1.2)) crate(cx,cz,s,ry);
}
for(const [bx,bz] of [[-24,161],[20,161],[-42,159],[38,159]]) if(freeSpot(bx,bz,1)) barrel(bx,bz);
for(const [sx,sz,ry] of [[-48,160,0.1],[-32,156,0.2],[32,158,-0.1],[50,162,0.05]]){
if(freeSpot(sx,sz,1.8)) sandbagWall(sx,sz,4.2,ry);
}
for(let i=0;i<8;i++){ const p=S(wr(-150,150),wr(-18,-2)); if(freeSpot(p[0],p[1],2.2)&&propFree(p[0],p[1],2.2)) crater(p[0],p[1],wr(1.5,2.7)); }
for(let i=0;i<5;i++){ const p=S(wr(-150,150),wr(-34,-18)); if(freeSpot(p[0],p[1],2.6)&&propFree(p[0],p[1],2.6)) crater(p[0],p[1],wr(1.8,3.0)); }
// ── B. 长栈桥根 (x=22, 桥面 2.45m): 补给堆/系缆/掩体 (桥本体由 buildWorld 的 bridges 分派 kind='pier') ──
for(const [cx,cz] of [[14,164],[30,164],[12,166],[32,166]]) if(freeSpot(cx,cz,1.2)) crate(cx,cz,1.2,wr(0,3));
for(const [bx,bz] of [[11,160],[33,160]]) if(freeSpot(bx,bz,1)) barrel(bx,bz);
if(freeSpot(16,158,1.8)) sandbagWall(16,158,4.0,0);
if(freeSpot(28,158,1.8)) sandbagWall(28,158,4.0,0);
// ── C. 礁盘反登陆障碍带 (史实: 塔拉瓦礁盘遍布混凝土 tetra/木桩/铁丝网; 登陆艇在礁缘搁浅 → 步兵涉水穿越) ──
// 全部落在水深 ≤1.3m 的礁盘/潮间带 (涉水可过, 坦克不可碾 = 日后登陆艇与两栖车的航路障碍);
// 四个湾 (南/西/东/北) 各铺一圈 —— "四面可上陆" 必须四面都有滩头障碍 (否则某一面是无人滩头)
for(let x=-190;x<=190;x+=7.2){
const jx=x+wr(-1.8,1.8);
if(wr(0,1)<0.75){ const p=S(jx,wr(7,22)); if(!pierZone(p[0],p[1])&&!chanBlocked(p[0],p[1])) beachPost(p[0],p[1],wr(0,TAU)); }
if(wr(0,1)<0.55){ const p=S(jx,wr(22,32)); if(!pierZone(p[0],p[1])&&!chanBlocked(p[0],p[1])) dragonTooth(p[0],p[1],wr(0,TAU)); }
if(wr(0,1)<0.42){ const p=S(jx,wr(24,34)); if(!pierZone(p[0],p[1])&&!chanBlocked(p[0],p[1])&&seaDepthAt(p[0],p[1])<1.3) hedgehog(p[0],p[1]); }
if(wr(0,1)<0.30){ const p=S(jx,25+wr(0,7)); if(!pierZone(p[0],p[1])&&!chanBlocked(p[0],p[1])&&seaDepthAt(p[0],p[1])<1.3) barbedWire(p[0],p[1],wr(0,TAU),3.6); }
}
// 西/东/北三湾的浅滩障碍 (障碍密度减半 —— 不是主攻面, 只求"确有设防")
for(const [side,arr] of [[W,[-96,-52,-8,36,80]], [E,[-96,-52,-8,36,80]]]){
for(const bz of arr){
for(const dd of [12,26]){
const p=side(bz,dd);
if(shoreDist(p[0],p[1])<0||seaDepthAt(p[0],p[1])>=1.3) continue;
if(wr(0,1)<0.6) beachPost(p[0],p[1],wr(0,TAU));
if(wr(0,1)<0.4) dragonTooth(p[0],p[1],wr(0,TAU));
}
}
}
for(const bx of [-84,-38,8,54]){
const p=N(bx,16);
if(shoreDist(p[0],p[1])<0){
if(wr(0,1)<0.6) beachPost(p[0],p[1],wr(0,TAU));
if(wr(0,1)<0.4) dragonTooth(p[0],p[1],wr(0,TAU));
}
}
// 珊瑚头礁石 (涉水者的天然掩体) + 深水沉船 (潜泳地标/水下掩体)
for(let i=0;i<18;i++){
const jx=wr(-200,200);
const p=S(jx,wr(17,34));
if(chanBlocked(p[0],p[1])||pierZone(p[0],p[1])) continue;
reefRock(p[0],p[1],wr(0.9,1.6));
}
{ const p=S(-46,80); sunkenWreck(p[0],p[1],0.4); }
{ const p=S(104,96); sunkenWreck(p[0],p[1],-0.5); }
// 航道浮标 (两条登陆航道入口 + 栈桥头两侧; 纯视觉, 不挡游泳/日后不挡船)
for(const c of SEA.channels){
for(const [dd,off] of [[13,-11],[13,11],[44,-10],[44,10]]){
const p=S(c.x+off,dd);
buoy(p[0],p[1],dd>30?0xc23a2a:0xd8d24a);
}
}
{ const p=S(15,46); buoy(p[0],p[1],0xd8d24a); }
{ const p=S(29,46); buoy(p[0],p[1],0xd8d24a); }
// 四湾进近航道浮标 (四面环海: 标出四个"可上陆湾口", 为日后登陆艇/两栖车择湾上陆预留; 纯视觉)
for(const [bx,bz,col] of [[-14,200,0xd8d24a],[14,200,0xd8d24a],[-210,-14,0xc23a2a],[-210,14,0xc23a2a],
[0,-222,0xd8d24a],[0,-192,0xd8d24a],[196,0,0xc23a2a],[224,0,0xc23a2a]]) buoy(bx,bz,col);
// ── D. 滩头两翼防线 (南湾两肩沙丘脊 u≈21m): 木碉堡+沙袋+铁丝网 (与 config.trench 两道脊线战壕共构第一道防线) ──
for(const bx of [-150,-118,116,148]){
const p=S(bx,-21);
logBunker(p[0],p[1],0);
}
for(let i=0;i<6;i++){ const p=S(wr(-200,-120),wr(-29,-16)); if(freeSpot(p[0],p[1],1.8)) sandbagWall(p[0],p[1],3.6,wr(0,1)<0.5?0:HPI); }
for(let i=0;i<6;i++){ const p=S(wr(120,200),wr(-29,-16)); if(freeSpot(p[0],p[1],1.8)) sandbagWall(p[0],p[1],3.6,wr(0,1)<0.5?0:HPI); }
for(const bx of [-176,-146,146,176]){
const p=S(bx,-10);
if(propFree(p[0],p[1],2.3)) barbedWire(p[0],p[1],wr(0,TAU),3.6);
}
placeTower(-160,150); placeTower(160,150);
// ── E. 中障壁 (旗 0,20): 珊瑚石障壁两道 (中留公路口) + 椰木掩体 + 反登陆壕 (config trench) ──
stoneWall(-76,40,-14,46); stoneWall(14,46,76,40);
stoneWall(-56,4,-10,8); stoneWall(10,8,56,4);
logBunker(-34,34,0.35); logBunker(36,34,-0.35); // ★2026-09-26 修 (P2-19b 穿模): 旧落位 (±34/36, 42) 正压在石障壁线上
logBunker(-16,34,0.1); logBunker(18,34,-0.1);   // 前沿两座北移 (z=34): 让开石障壁线 (z≈40..46) 的背面门口
// 说明 (P2-19b): 石障壁两段的走向 —— (-76,40)→(-14,46) 在 x=-34 处 z≈44.06, (14,46)→(76,40) 在 x=36 处 z≈43.87;
//   而椰木掩体足迹是 5.0×4.6 (屋盖满幅, 半深 2.3) ⇒ 旧落位的堡体后半截整个插进石障壁 (两者都是实心碰撞)。
//   现与前沿两座同排 (z=34): 距障壁线 10m, 仍是"障壁后一排掩体"的语义, 且正面朝南 (+z = 登陆方向)。
for(let i=0;i<6;i++){ crater(wr(-64,64),wr(16,54),wr(1.6,2.6)); }
if(freeSpot(-46,32,1.8)) sandbagWall(-46,32,4,0);
if(freeSpot(48,32,1.8)) sandbagWall(48,32,4,0);
// ── F. 机场 (旗 -50,-72): 塔台 (可登顶 7.6m + 塔顶高炮) + 机库×2 (可毁大件) + 日机残骸 + 机堡土墙 ──
controlTower(-62,-58,0);
{ const h1=placeAt(64,-40,-HPI,22,15,{maxDh:1.0}); if(h1) hangar(h1.x,h1.z,h1.ry); }
{ const h2=placeAt(64,-112,-HPI,22,15,{maxDh:1.0}); if(h2) hangar(h2.x,h2.z,h2.ry); }
planeWreck(-16,-36,0.3); planeWreck(30,-78,-0.5); planeWreck(18,-116,0.2); planeWreck(38,-150,0.9);
// 跑道东侧停机坪: U 形沙袋机堡 (史实: 分散停机防炸)
for(let i=0;i<4;i++){
const az=-42-i*22, ax=42+wr(-2,2);
if(freeSpot(ax,az,2)) sandbagWall(ax,az,7.0,HPI);
if(freeSpot(ax-3.4,az-3.6,2)) sandbagWall(ax-3.4,az-3.6,4.0,0);
if(freeSpot(ax-3.4,az+3.6,2)) sandbagWall(ax-3.4,az+3.6,4.0,0);
}
if(freeSpot(-76,-66,1)) barrel(-76,-66);
if(freeSpot(-76,-70,1)) barrel(-76,-70);
// 跑道标记: 白色标桩沿两缘 (纯视觉, 无碰撞)
for(let z=-124;z<=-20;z+=16){
for(const bx of [-32,32]){
const g0=heightAt(bx,z);
mesh(new THREE.CylinderGeometry(0.12,0.14,0.7,6),new THREE.MeshLambertMaterial({color:0xe8e4d8}),bx,g0+0.35,z);
}
}
{ // 风向袋 (跑道南端东缘)
const g0=heightAt(38,-14);
mesh(new THREE.CylinderGeometry(0.07,0.09,4.2,6),MAT.metalDark,38,g0+2.1,-14);
const sock=mesh(new THREE.CylinderGeometry(0.3,0.5,1.6,8),new THREE.MeshLambertMaterial({color:0xd8d0b8}),38.8,g0+3.9,-14);
sock.rotation.z=HPI;
}
// ── G. 左路纵深: 椰林营区 (旗 -126,-8) —— 日军兵营/仓库/帐篷 (西湾内岸台地) ──
{
const b1=placeBuild(-126,-8,24,6,5,{maxDh:1.0}); if(b1) logCabin(b1.x,b1.z,b1.ry);
const b2=placeBuild(-126,-8,24,6,5,{maxDh:1.0}); if(b2) logCabin(b2.x,b2.z,b2.ry);
const b3=placeBuild(-126,-8,30,6,5,{maxDh:1.0}); if(b3) logCabin(b3.x,b3.z,b3.ry);
const b4=placeBuild(-126,-8,32,9,7,{maxDh:1.2}); if(b4) ruinedHouse(b4.x,b4.z,9,7,b4.ry,MAT.woodDark,0.3); // 破损仓库 (纯视觉室内件, 不占道具表)
const t1=placeBuild(-126,-8,30,3.2,4.4,{maxDh:1.0}); if(t1) tent(t1.x,t1.z,t1.ry);
}
// ★ 2026-09-21 WS4 修 BUG (越域授权: 只补第 3 项 ry, 三件不增删不重排):
//   旧写法 `[[-110,12],[-144,-26],[-120,-30]]` 元组只有 2 个元素 ⇒ 解构出的 `ry=undefined`
//   ⇒ sandbagWall 内 Math.cos/sin(undefined)=NaN ⇒ 位置 (NaN, y, NaN):
//   **该面沙袋墙实机不渲染** (three.js 矩阵含 NaN ⇒ 被剔除) + 碰撞盒 min/max=NaN ⇒ 永不参与推挤
//   + coverPoints 仍按有限 x/z 登记 ⇒ AI 把"幻影掩体"当真实掩体用。椰林营区实测 2 面墙凭空消失。
//   ry 一律取**字面量 0** (沿 +x 轴向, 与岛内多数散置掩体同口径): 不用 wr()/rand() 取角 ⇒
//   不消耗布局随机数序列 ⇒ island 及其余 11 图的布局指纹逐位不变 (verify-layouts / verify-zfight 双证)。
for(const [sx,sz,ry] of [[-110,12,0],[-144,-26,0],[-120,-30,0]]){
if(freeSpot(sx,sz,1.8)) sandbagWall(sx,sz,3.6,ry);
}
placeTower(-108,-40);
// ── H. 左翼制高: 西南岬灯塔 (旗 -182,176) —— 灯塔 (环廊 10m 可登, 不可摧毁) + 附属屋 + 岸炮位 ──
lighthouse(-180,164,0);
{ const b=placeAt(-152,170,0.3,6,5,{maxDh:1.2}); if(b) logCabin(b.x,b.z,b.ry); }
if(freeSpot(-196,190,1.8)) sandbagWall(-196,190,4.4,HPI);
coastalPit(-178,152,0.35);   // 岸防炮由 17-emplacements 依 COASTAL_PITS 架设 (该文件后加载)
placeTower(-160,194);
// ── I. 右翼制高: 东南岬炮台 (旗 182,176) —— 岸炮位 (面海可操作) + 探照灯 + 观察哨 ──
coastalPit(178,152,0);   // 岸防炮由 17-emplacements 依 COASTAL_PITS 架设
if(freeSpot(166,186,1.8)) sandbagWall(166,186,4.4,HPI);
if(freeSpot(196,186,1.8)) sandbagWall(196,186,4.4,HPI);
placeTower(160,186);
{ // 探照灯位 (混凝土基座 + 镜筒, 面海)
const lx=178, lz=146, g0=heightAt(lx,lz);
mesh(new THREE.CylinderGeometry(0.55,0.7,1.0,8),MAT.stone,lx,g0+0.5,lz);
const drum=new THREE.Mesh(new THREE.CylinderGeometry(0.72,0.72,1.7,10),MAT.metal);
drum.rotation.z=HPI; drum.rotation.y=0.3; drum.position.set(lx,g0+1.65,lz); drum.castShadow=true; world.add(drum);
CYLS.push({x:lx,z:lz,r:0.6,y0:g0,y1:g0+1.9});
// N2 4.3 (昼夜设计): 夜档给这座静态探照灯接真实光柱 (扫掠/照中判定在 08-effects nightGearTick);
//   相位走 Math.random 不进布局种子 (几何一致红线); 白天档不登记, 行为零变化。
if(NIGHT_MODE) SEARCHLIGHTS.push({x:lx,z:lz,y:g0+2.2,az0:2.4,phase:Math.random()*TAU});
}
// ── J. 纵深: 珊瑚岭指挥所 (86,-140) + 日军北湾内岸营地 (主基 0,-152) ──
placeTower(86,-140);
{ const b=placeAt(98,-126,0.2,8,7,{maxDh:1.2}); if(b) ruinedHouse(b.x,b.z,8,7,b.ry,MAT.woodDark,0.35); }
logBunker(66,-152,Math.PI*0.92);
bunker(-6,-162,0);
bunker(-28,-156,HPI*0.35);
coastalPit(50,-160,Math.PI*0.92);   // 纵深反坦克炮位 (由 17-emplacements 架炮)
for(let i=0;i<5;i++){ dragonTooth(wr(-46,46),-132+wr(-7,7),wr(0,TAU)); }
// ── M. 三湾岸防 (四面环海 ⇒ 守方必须四面设防; 工事语言同上: 椰木掩体 + 沙袋 + 铁丝网) ──
for(const bx of [-84,-32,30,82]){
const p=N(bx,-22);
if(shoreDist(p[0],p[1])<-16&&freeSpot(p[0],p[1],3)&&propFree(p[0],p[1],3)) logBunker(p[0],p[1],Math.PI);
}
for(const bz of [-88,-38,12,62]){
for(const [side,face] of [[W,-HPI],[E,HPI]]){
const p=side(bz,-22);
if(shoreDist(p[0],p[1])<-16&&freeSpot(p[0],p[1],3)&&propFree(p[0],p[1],3)) logBunker(p[0],p[1],face);
}
}
for(const [side,face,bz] of [[W,-HPI,-64],[W,-HPI,36],[E,HPI,-64],[E,HPI,36]]){
const p=side(bz,-11);
if(propFree(p[0],p[1],2.3)&&shoreDist(p[0],p[1])<-6) barbedWire(p[0],p[1],wr(0,TAU),3.6);
}
// ── K. 椰林 (四湾内岸主林 + 内陆零散): 全部落在陆上 (u≥16m), 避跑道/道路/建筑 ──
// 2026-09-20 I5: 14 处 palmGrove 调用收成一张表 —— 同一张表既喂 palmGrove(成林), 又喂 K2 段的
// 林下加密 (灌木/蕨丛必须落在同一批林圈里); 坐标写两份就是两套代码做同一件事 (纲领 §2)。
// 调用顺序/参数与旧版逐字一致 ⇒ 随机数消耗不变 (布局指纹不漂移)。
const GROVES=[
[-158,116,52,54],   // 西湾北岸主林
[-70,30,50,40],     // 岛腰西侧
[158,116,52,52],    // 东湾北岸主林
[-132,-48,50,36],   // 椰林营区外缘
[140,-30,48,34],    // 东湾内岸
[-126,-8,44,38],    // 椰林营区 (旗圈)
[76,-150,44,28],    // 珊瑚岭北坡 (守方纵深)
[-50,-156,46,26],   // 北湾西段内岸
[-164,124,30,20],   // 西南岬腰
[164,124,30,20],    // 东南岬腰
[-96,-96,46,26],    // 西湾南段内岸
[104,-116,44,24],   // 机场东侧
[-30,110,44,26],    // 南湾西肩内陆
[34,112,44,24],     // 南湾东肩内陆
];
const palmGrove=(cx,cz,r,n)=>{
for(let i=0;i<n;i++){
const a=wr(0,TAU), rr=Math.sqrt(wr(0,1))*r;
const x=cx+Math.sin(a)*rr, z=cz+Math.cos(a)*rr;
if(shoreDist(x,z)>-16) continue;                                                        // 不落湿沙/海里
if(rectDist(x,z,SEA.runway.x0-8,SEA.runway.z0-8,SEA.runway.x1+8,SEA.runway.z1+8)<=0) continue; // 跑道面不落树
if(roadDist(x,z)<6) continue;
if(!freeSpot(x,z,1.3)) continue;                                                        // 不落建筑足迹 (与树木散布同口径)
palm(x,z,wr(0.88,1.25));
}
};
for(const g of GROVES) palmGrove(g[0],g[1],g[2],g[3]);
// ── L. 零散战痕 (内陆弹坑/瓦砾; 滩头弹坑见 A) ──
for(let i=0;i<22;i++){
const x=wr(-200,200), z=wr(-170,160);
if(shoreDist(x,z)>-16||roadDist(x,z)<7) continue;
if(!freeSpot(x,z,1.5)) continue;
if(wr(0,1)<0.5) crater(x,z,wr(1.3,2.2)); else rubblePile(x,z,wr(1.2,2.0));
}
// 守方工事模板 (最后落: 让开手摆地标与建筑足迹)
islandDefWorks(DEF);
// ── E2. 中障壁不可摧毁混凝土工事 (2026-09-21 WS3 用户第 3 条: "中间部分应当还有一个不可摧毁工事") ──
// 【单源】坐标只写在 00-config 的 island.spawns 中立强点条目里 (纲领 §4.3); 这里按条目现算落位,
//   不在此另写一套坐标 —— 强点圈心 = 工事中心, 占领圈天然套住工事本体 (圈内单位同样在圈内据守)。
// 【落位判据】与 placeAt 同一支校验链 (shoreDist / terrainDelta / propFreeRect / freeSpot@B_FOOT),
//   但**一步都不消耗 wr()/rand()**: 位置在固定偏移表里取第一个净位, 全败才兜底强放。
//   ⇒ island 分支在本段之前的随机数序列逐位不变, 其它 12 图分支根本执行不到本段 (岛礁专属)。
// 【为什么排在这里】① islandDefWorks 之后: 守方工事 (椰木掩体/沙袋胸墙/机枪位/铁丝网) 走
//   freeSpot/propFree 先到先得, 新工事必须让开它们、不抢位; ② K2 植被加密之前: 灌木/蕨丛的
//   freeSpot 看得到本工事足迹, 不会长进碉堡里 (植被无碰撞, 但穿墙的树丛很难看)。
{
let SP=null; for(const s of (CAMPAIGN.spawns||[])) if(s.team===-1){ SP=s; break; }   // 本图唯一中立强点条目
if(SP){
const SW=10, SD=9;   // 与 05a strongpoint 的 W/D 同值: 落位足迹必须按工事真实占地校验
let px=SP.x, pz=SP.z, ok=false;
for(const [ox,oz] of [[0,0],[2,2],[-2,2],[2,-2],[-2,-2],[4,0],[-4,0],[0,4],[0,-4]]){
const cx=SP.x+ox, cz=SP.z+oz;
if(shoreDist(cx,cz)>-20) continue;                        // 内陆: 环礁上不得贴水线 (verify-layouts ⑭同口径)
if(terrainDelta(cx,cz,0,SW,SD)>1.0) continue;             // 碉堡坐在平地上 (foundation 起台整平)
const rect=footRect(cx,cz,0,SW,SD,1.0);
if(!propFreeRect(rect)) continue;                         // 让开道具: 石障壁段/椰木掩体/弹坑/沙袋/椰树
if(!freeSpot(cx,cz,Math.hypot(SW,SD)/2+0.6)) continue;    // 让开建筑足迹 (B_FOOT)
px=cx; pz=cz; ok=true; B_FOOT.push(rect); break;
}
if(!ok) B_FOOT.push(footRect(SP.x,SP.z,0,SW,SD,1.0));     // 兜底: 主位强放 (与 placeAt strict=false 同口径)
strongpoint(px,pz,0);                                     // ry=0: 局部 +z = 世界 +z = 朝南登陆湾 (射击孔正面)
}
}
// ── K2. 植被加密 (2026-09-20 I5 用户第 7 条: "塔拉瓦环礁的地图上植被还是太少, 应当有不少草丛树丛") ──
// 改造前实测 (dev/verify-foliage.js --baseline): 全图只有 99 株灌木 / 0 丛蕨丛 / 408 丛落位草丛 ——
// 通用散布局的 150 基数在 640 图 + 陆域只占约 1/4 的环礁上几乎看不见。
// 纪律 (用户已确认口径): 滩头沙丘带是登陆战设计核心 (**开阔火力场**), 湿沙/迎海面一律不长灌木;
//   加密只落在**沙丘背坡 (入陆 ≥ FLORA_CFG.shoreGuard = 22m = 沙丘脊线 ridge.u1)、椰林内/边缘、
//   跑道外围、内陆** 这四处 (见下面 vegOK 的第一道守卫)。
// 为什么排在 islandDefWorks 之后: 灌木无碰撞也不占工事位, 让守方 mg42/椰木掩体先落位 (propFree 先到先得)。
// 密度全部走 00-config 的 THEME.floraDensity 单源 (FLORA_CFG), 本段不出现任何密度魔数。
{
const vegOK=(x,z,r)=>{
if(shoreDist(x,z)>-FLORA_CFG.shoreGuard) return false;                                        // 滩头禁入带 (背坡起)
if(roadDist(x,z)<4.5) return false;                                                          // 让开道路/小径
if(rectDist(x,z,SEA.runway.x0,SEA.runway.z0,SEA.runway.x1,SEA.runway.z1)<=0) return false;   // 跑道面
if(!freeSpot(x,z,r)) return false;                                                           // 建筑足迹/地铁下沉区
for(const f of CAMPAIGN.flags) if(Math.hypot(x-f.x,z-f.z)<f.r+2) return false;               // 旗点圈留白 (同散布局口径)
return true;
};
const bushAt=(x,z,s)=>{ if(vegOK(x,z,1.2)) bush(x,z,s||wr(0.9,1.5)); };
const fernAt=(x,z)=>{ if(vegOK(x,z,0.8)) fernClump(x,z); };
// ① 椰林林下 (用户点名的"椰林内/边缘"): 株数按林圈面积摊; 半径 ×1.05 = 林缘外扩一圈
for(const [cx,cz,r] of GROVES){
const area=Math.PI*r*r;
// 除零守卫: 主题没给 floraDensity 时这两个字段是 0 (缺省) —— 不守卫会得到 Infinity 死循环
const nB=FLORA_CFG.groveBushArea>0?Math.round(area/FLORA_CFG.groveBushArea):0;
const nF=FLORA_CFG.groveFernArea>0?Math.round(area/FLORA_CFG.groveFernArea):0;
for(let i=0;i<nB;i++){
const a=wr(0,TAU), rr=Math.sqrt(wr(0,1))*r*1.05;
bushAt(cx+Math.sin(a)*rr, cz+Math.cos(a)*rr);
}
for(let i=0;i<nF;i++){
const a=wr(0,TAU), rr=Math.sqrt(wr(0,1))*r;
fernAt(cx+Math.sin(a)*rr, cz+Math.cos(a)*rr);
}
}
// ② 沙丘背坡带 (四湾各 beachClumpN 丛): 沿各自岸线落在 u∈[脊线+1, 背坡台地+6] 成丛 ——
//    正面湿沙/沙丘迎海面仍然一无所有 (滩头火力场不被破坏), 但脊线一过就有灌丛可依托
for(const [side,a0,a1] of [[S,-170,170],[N,-150,150],[W,-150,150],[E,-150,150]]){
for(let i=0;i<FLORA_CFG.beachClumpN;i++){
const t=wr(a0,a1), u=wr(SEA.ridge.u1+1, SEA.bench.u1+6);
const p=side(t,-u);
const n=2+wri(0,2);
for(let k=0;k<n;k++) bushAt(p[0]+wr(-2.5,2.5), p[1]+wr(-2.5,2.5), wr(0.85,1.35));
}
}
// ③ 内陆灌丛带 (岛腰/珊瑚岭纵深): 随机内陆点成丛, 每丛 3~6 株 —— 陆战推进的逐段遮蔽
for(let i=0;i<FLORA_CFG.inlandClumpN;i++){
let cx=0,cz=0,found=false;
for(let k=0;k<24;k++){
const x=wr(-200,200), z=wr(-170,160);
if(shoreDist(x,z)>-38) continue;     // 内陆 (背坡台地以内)
if(roadDist(x,z)<7) continue;
if(!freeSpot(x,z,3)) continue;
cx=x; cz=z; found=true; break;
}
if(!found) continue;
const n=3+wri(0,Math.max(0,FLORA_CFG.inlandClumpBush-2));
for(let k=0;k<n;k++) bushAt(cx+wr(-3.5,3.5), cz+wr(-3.5,3.5), wr(0.9,1.5));
if(wr(0,1)<0.5) fernAt(cx+wr(-2,2), cz+wr(-2,2));
}
// ④ 跑道外围 (用户点名的"跑道外围"): 跑道矩形外 6~18m 环带成丛 (跑道面本身由 vegOK 挡住)
for(let i=0;i<FLORA_CFG.runwayFringeN;i++){
const d=wr(6,18), RX=SEA.runway, edge=wri(0,4);
let x=0,z=0;
if(edge===0){ x=wr(RX.x0,RX.x1); z=RX.z0-d; }
else if(edge===1){ x=wr(RX.x0,RX.x1); z=RX.z1+d; }
else if(edge===2){ x=RX.x0-d; z=wr(RX.z0,RX.z1); }
else { x=RX.x1+d; z=wr(RX.z0,RX.z1); }
const n=2+wri(0,2);
for(let k=0;k<n;k++) bushAt(x+wr(-2,2), z+wr(-2,2), wr(0.85,1.4));
}
}
}
// ══════ 劫道方临时补给点 (断崖公路): 限时 (convoy.supplyLife 秒) 后全体失效 ══════
// 补给内容=弹药+绷带+投掷物全满 (与弹药箱同标准); 仅劫道方(team0)玩家可使用
const SUPPLY_POINTS=[];
let SUPPLY_EXPIRED=false, SUPPLY_START=-1;
function supplyClockStart(){ SUPPLY_START=nowT; } // owner 接口 (2026-09-06 B7b/P2-14: 23-deploy 跨文件写改经此)
function placeSupplyPoint(x,z){
// 尝试布置 + 兜底偏移; 失败则放弃 (不打断伏击点其他布置)
for(const [ox,oz] of [[0,0],[1,-1],[2,1],[-1,-2]]){
const px=x+ox, pz=z+oz;
if(!freeSpot(px,pz,0.8)||!propFree(px,pz,1.0)) continue;
propTake(px,pz,1.0);
const g0=heightAt(px,pz);
// 轴对齐单碰撞盒: solidBox 返回视觉网格, 碰撞体需从 BOXES 尾部取 (mesh 已回挂)
const m=solidBox(MAT.woodDark,1.1,0.7,0.8,px,g0+0.35,pz,0);
const bs=BOXES[BOXES.length-1];
const lid=mesh(boxGeo(1.15,0.08,0.85),MAT.wood,px,g0+0.74,pz,0);
const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.045,1.7,6),MAT.metal);
pole.position.set(px,g0+0.85,pz); world.add(pole);
SUPPLY_POINTS.push({x:px,z:pz,y:g0,bs,lid,pole});
return true;
}
return false;
}
function updateSupplyPoints(dt){
if(!SUPPLY_POINTS.length||SUPPLY_EXPIRED||SUPPLY_START<0) return; // SUPPLY_START 由 startMatch 定义
const life=(CAMPAIGN.convoy&&CAMPAIGN.convoy.supplyLife)||600;
if(nowT-SUPPLY_START<life) return;
SUPPLY_EXPIRED=true;
for(const s of SUPPLY_POINTS){
killDynCollider(s.bs);
world.remove(s.bs.mesh);
world.remove(s.lid);
world.remove(s.pole);
}
addKillMsg('劫道方临时补给点已失效!',0);
SUPPLY_POINTS.length=0;
}
const MG42S=[];
// 各阵营架设重机枪 (对应历史型号/射速/威力) —— 必须在 buildWorld() 之前初始化 (布局可调 mg42)
const FACTION_MG={
us: { name:'M1919A4 勃朗宁重机枪', rpm:520, dmg:21, heatPS:0.011, style:'air' },
ger:{ name:'MG42 通用机枪',        rpm:1100,dmg:18, heatPS:0.014, style:'mg42' },
sov:{ name:'马克沁 M1910 重机枪',  rpm:560, dmg:21, heatPS:0.006, style:'water' },
kmt:{ name:'二四式重机枪',         rpm:480, dmg:22, heatPS:0.006, style:'water' },
cpc:{ name:'二四式重机枪(缴获)',   rpm:460, dmg:22, heatPS:0.006, style:'water' },
jp: { name:'九二式重机枪',         rpm:440, dmg:23, heatPS:0.009, style:'92' },
};
// 活树/倒树记录已由 tree() 直接登记进 04b-fire 的 TREE_LIVE (旧 TREES/fTrees 表废弃)
// 山地大图(treeQ 主题)树木数量随画质缩放: 低 60% / 中 85% / 高 100% (与草丛按画质缩放同思路, 保低配帧率)
function treeQMul(){ return THEME.treeQ?(SETTINGS.quality===0?0.6:(SETTINGS.quality===1?0.85:1)):1; }
// ══════════ 海面与碎波带 (2026-09-18 / 09-18b 三面 / ★09-19 四面环海) ══════════
// 海面: 与地形同分辨率同网格 —— 顶点一律贴在海平面下 3cm。海底(陆侧)由不透明地形按深度遮挡,
// 海侧露出的即水面; 3cm 的埋入量是为了让水线处不与地形共面 (消除 z-fighting 麻点)。
// 顶点色按水深分带 (碎波灰白→浅碧→青绿→深蓝), 半透明 + TEX.water 平铺; 水面单源见 03-terrain waterYAt。
// ★ 2026-09-18b 修严重 BUG: 旧版写 pos.setY(i, Math.min(SEA.level, h-0.06)) —— 海侧 h<0 ⇒
//   水面被压到海床**之下** 0.06m, 于是整片海面被地形吃掉 (用户实机: "海面根本不显示")。
//   水面只需恒在海平面, 陆侧交给深度遮挡; 全高于海平面的三角面剔除 ⇒ 陆上不画水面。
let SEA_MESH=null, SEA_FOAM=null;
// 贴图克隆 (沙箱 THREE/TEX 桩可能没有该贴图 —— 拿不到就用无贴图材质, 不影响几何与布局)
function _cloneSeaTex(t){
try{ return (t&&t.clone)?t.clone():null; }catch(e){ return null; }
}
function _prepSeaTex(map,rx,ry){
if(!map) return null;
map.needsUpdate=true;
if(map.wrapS!==undefined) map.wrapS=THREE.RepeatWrapping;
if(map.wrapT!==undefined) map.wrapT=THREE.RepeatWrapping;
if(map.repeat&&map.repeat.set) map.repeat.set(rx,ry);
return map;
}
function buildSeaMesh(){
if(!SEA) return;
const seg=Math.max(64,Math.round((MAP_SIZE+40)/2.76));
const geo=new THREE.PlaneGeometry(MAP_SIZE+40,MAP_SIZE+40,seg,seg);
geo.rotateX(-HPI);
const pos=geo.attributes.position;
const hgt=new Float32Array(pos.count);
const cols=new Float32Array(pos.count*3);
const seaY=SEA.level-0.03;
for(let i=0;i<pos.count;i++){
const x=pos.getX(i), z=pos.getZ(i);
const h=heightAt(x,z);
hgt[i]=h;
pos.setY(i,seaY);
const dep=seaDepthAt(x,z);
// 顶点色定标 (2026-09-18b): 水面朝上的法线下 半球(0.78×天光) + 日照(1.78×0.773) ≈ 1.8 倍,
// 且最终要经 0.80 不透明度与水底沙色混合 → 这里取"目标显示色**反解到线性**"再 /1.8。
// 目标显示: 潮间带白沫(0.95) / 浅碧(0.44,0.86,0.84) / 中层(0.22,0.62,0.72) / 深海(0.11,0.30,0.46)
let r,g,b;
if(dep<=0.06){ r=0.50; g=0.53; b=0.53; }                                                      // 潮间带白沫
else if(dep<1.0){ const k=dep; r=lerp(0.10,0.06,k); g=lerp(0.41,0.32,k); b=lerp(0.46,0.38,k); } // 浅碧 (礁盘)
else if(dep<3.4){ const k=(dep-1.0)/2.4; r=lerp(0.06,0.018,k); g=lerp(0.32,0.195,k); b=lerp(0.38,0.325,k); }
else { const k=clamp((dep-3.4)/6.4,0,1); r=lerp(0.018,0.004,k); g=lerp(0.195,0.039,k); b=lerp(0.325,0.118,k); } // 深海
cols[i*3]=r; cols[i*3+1]=g; cols[i*3+2]=b;
}
geo.setAttribute('color',new THREE.BufferAttribute(cols,3));
{
const idx=geo.index&&geo.index.array;
if(idx){
const keep=[];
for(let f=0;f<idx.length;f+=3){
const a=idx[f], b2=idx[f+1], c=idx[f+2];
if(hgt[a]>SEA.level&&hgt[b2]>SEA.level&&hgt[c]>SEA.level) continue;
keep.push(a,b2,c);
}
geo.setIndex(keep);
}
}
geo.computeVertexNormals();
if(geo.computeBoundingSphere) geo.computeBoundingSphere();
const map=_prepSeaTex(_cloneSeaTex(TEX.water),(MAP_SIZE+40)/18,(MAP_SIZE+40)/18);
const mat=new THREE.MeshLambertMaterial({map:map||undefined,vertexColors:true,transparent:true,opacity:0.80,side:THREE.DoubleSide,depthWrite:false});
const m=new THREE.Mesh(geo,mat);
// 贴地水面档 (2026-09-27 深度分层 · 05-world SURF_LANES.patchWater): 深度偏移与 renderOrder 同源下发 ——
// 海面虽已 3cm 几何埋入 + 不写深度, 但**深度测试不退**: 贴岸那一圈水面与岸壁只差几厘米
// (100m 处 1 LSB≈7.5mm) ⇒ 不登记就会在水线附近断续/闪。side:DoubleSide + 不写深度 ⇒ 只影响它自己能否过测。
if(typeof surfaceLane==='function') surfaceLane(m,'patchWater'); else m.renderOrder=1;
scene.add(m);
SEA_MESH=m;
}
// 碎波带: 沿岸线的一条 8.7m 宽带 (陆侧 1.2m 埋进沙下 → 只露出水线外的白沫), 贴图沿浪向滚动 = 破浪。
// 四面海岸各铺一条 (南/北/西/东), 拐点处互相重叠 (半透明泡影叠加 = 岬角激浪, 无需额外处理)
function buildSurfStrip(){
if(!SEA) return;
const coasts=(typeof seaCoastLines==='function')?seaCoastLines():[];
const posA=[], uvA=[], idx=[];
// ── 2026-09-21 WS4 (第 5 项④): 碎波带的两处数值与一档深度偏移 ──────────────────────────────
// 改动前: 陆侧埋入 -1.2m + 顶面 SEA.level+0.05。
//   根因 (数值): 碎波带是**水平面** (y≡+0.05), 而沙滩坡是 1:18 (00-config sea.sand.rate=0.0555)
//   ⇒ 两者斜交: 交线在陆侧 0.05/0.0555 = 0.90m 处, 交线两侧各 ~0.36m 内"泡沫与沙面高差 <2cm"。
//   200m 处 24bit 深度分辨率 ≈ 3.0cm > 2cm (near=.08/far=900, 见 05-world DEPTH_TIERS 头注释)
//   ⇒ 那条 ~0.72m 宽的带在远端深度测试随机失败 = 浪花线断续/麻点。
// 改动后: ① 陆侧埋入 -1.2 → **-2.6m**: 陆侧边缘处沙面 0.0555×2.6 = 0.144m, 比泡沫面 0.09 高 5.4cm
//      (改动前只有 1.7cm, 远小于远端深度分辨率 ⇒ 陆侧边缘本身就是一条"半埋"的闪带);
//   ② 顶面 +0.05 → **+0.09**: 与海面 `SEA.level-0.03` (本文件 :1957) 的间距由 8cm 拉到 12cm;
//      两条必须同批: 只抬到 +0.09 而不加深埋入, 陆侧边缘 (0.0555×1.2=0.067 < 0.09) 会从沙里冒出来,
//      在整条沙滩上多一条白线。
//   ⚠ 已知对价 (写在这里以免日后误判): 露出段的分界随抬高从 u=0.90 移到 1.62m 处 (仍属湿沙带);
//      surf 档在 200m 处的偏移 ≈ 3×3.0cm = 9cm, 会把"泡沫盖住沙"的分界再向陆侧推 ≈0.09/0.0555 ≈ 1.6m
//      ⇒ 远端看浪花带略宽 1.6m。这是"远端不断线"的对价, 且方向安全 (宁可多露白沫, 不可被沙吃掉)。
for(const co of coasts){
const P=co.pts;
let acc=0, prev=-1;
for(let i=0;i<P.length;i++){
const cx2=P[i][0], cz2=P[i][1];
const ax=cx2+co.ox*(-2.6), az=cz2+co.oz*(-2.6);   // 陆侧 (埋进沙下 5.4cm, 见上)
const bx=cx2+co.ox*7.5,  bz=cz2+co.oz*7.5;        // 海侧 (露出的碎波)
const base=posA.length/3;
posA.push(ax, SEA.level+0.09, az, bx, SEA.level+0.09, bz);
uvA.push(acc/9, 0, acc/9, 1);
if(i>0&&prev>=0) idx.push(prev,prev+1,base, prev+1,base+1,base);
prev=base;
acc+=4;
}
}
if(!posA.length) return;
const geo=new THREE.BufferGeometry();
geo.setAttribute('position',new THREE.Float32BufferAttribute(posA,3));
geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvA,2));
geo.setIndex(idx);
if(geo.computeVertexNormals) geo.computeVertexNormals();
const map=_prepSeaTex(_cloneSeaTex(TEX.foam),1,1);
const mat=new THREE.MeshBasicMaterial({map:map||undefined,transparent:true,opacity:0.66,depthWrite:false,side:THREE.DoubleSide});
const m=new THREE.Mesh(geo,mat);
// surf 档 (05-world SURF_LANES): 深度偏移 + renderOrder **同源一次下发** (旧版是 depthOffset(mat,'surf') 就地
// 写字段 + 裸 renderOrder=2 两处写, 数字分裂的温床)。depthWrite:false 只退出"写深度", **不退出深度测试** ——
// 泡沫与沙面的斜交带仍要参与 depthTest, 这一档就是给那次测试让路。
if(typeof surfaceLane==='function') surfaceLane(m,'surf'); else { if(typeof depthOffset==='function') depthOffset(mat,'surf'); m.renderOrder=2; }
m.frustumCulled=false;
scene.add(m);
SEA_FOAM=m;
}
// 海面动效 (纯视觉, 走 nowT 不进种子流): 泡沫沿浪向滚动 + 水面细流 + 浮标随浪起伏
function updateSea(dt){
if(!SEA) return;
// 2026-09-26E (审计 36): 全函数改读 seaClock (只由 dt 推进) —— 冻结期 nowT 不前进, 旧写法让菜单航拍
// 里的海面完全静止 (与"背景动态"的意图相反)。
seaClock+=dt;
const fo=SEA_FOAM&&SEA_FOAM.material&&SEA_FOAM.material.map;
if(fo&&fo.offset){ fo.offset.y=(seaClock*0.055)%1; fo.offset.x=(seaClock*0.008)%1; }
const sm=SEA_MESH&&SEA_MESH.material&&SEA_MESH.material.map;
if(sm&&sm.offset){ sm.offset.x=(seaClock*0.006)%1; sm.offset.y=(seaClock*0.004)%1; }
if(BUOYS.length) updateBuoys(dt);
}
// ══ 随机战场 · 建造阶段 (2026-10-06 设计定稿 §2.2): 00c 数据 → 05a/05b 素材复用落位 ══
// 数据阶段 (路网/地块/旗点) 在 00c-procgen; 本段只做 kind→生成器映射、掩体审计、NAV 放行。
// 全部生成器复用既有 05a/05b (零新模型); 落位走 placeAt 统一互斥 (足迹/道具/坡度/落水)。
// 随机一律 wr() —— procgen 图上已被 00c 播种 (PG_WR_SEED), 同种子同布局。
// 足迹回避 (2026-10-07b): procgen 是首个"算法道具×算法建筑"图 —— 集市/掩体/旗圈家具/路旁树的
// 落点可能撞进 placeAt 登记的 B_FOOT 足迹 (其他图为手调坐标不暴露)。propFree 只查道具互斥不查建筑,
// 这里给 procgen 的算法道具统一加 footprint 门 (只对 procgen 生效, 其余图零指纹漂移)。
function footFree(x,z,r){
for(const f of B_FOOT){ if(x>f.x0-r&&x<f.x1+r&&z>f.z0-r&&z<f.z1+r) return false; }
return true;
}
function layoutProcgen(){
if(typeof PGDATA==='undefined'||!PGDATA) return;
const D=PGDATA, CN=(CAMPAIGN.theme==='china');
const BLD={
 house:(x,z,ry)=>cnHouse(x,z,ry,7,6),
 house2:(x,z,ry)=>cnHouse(x,z,ry,9,7),
 cabin:(x,z,ry)=>logCabin(x,z,ry),
 twostory:(x,z,ry)=>twoStoryHouse(x,z,ry,wr(0,1)<0.5?MAT.brick:MAT.plaster),
 barn:(x,z,ry)=>buildBarn(x,z,ry),
 factory:(x,z,ry)=>silkFactory(x,z,ry),
 church:(x,z,ry)=>buildChurch(x,z,ry),
 tower:(x,z,ry)=>watchtower(x,z,ry),
 mill:(x,z,ry)=>windmill(x,z,ry) };
// 1) 建筑: placeAt 8 次抖动重试, 失败弃置 (地块本沿路带状生成, 弃置率≈0; 弃置不留空洞足迹)
// noWater: 水乡图 8 次抖动 (±2.5m) 可能把滨河地块推进河/塘 (canTake 只保证**中心**离水 ≥0.5m)
for(const L of D.lots){
 const p=placeAt(L.x,L.z,L.ry,L.w,L.d,{maxDh:1.7,noWater:true});
 if(p&&BLD[L.kind]) BLD[L.kind](p.x,p.z,p.ry);
}
// 1.2) 铁路货线 (镇集): 枕木+双轨沿货线折线铺设 (纯视觉不占位, 0.08m 可碾过; 与百团/柏林同款 railLine)
if(D.rail&&D.rail.length>1){
 for(let i=0;i<D.rail.length-1;i++) railLine(D.rail[i][0],D.rail[i][1],D.rail[i+1][0],D.rail[i+1][1]);
}
// 1.4) 水乡桥头工事: 每座石桥两岸桥头各一段沙袋 (桥面轴向退 ±(len/2+2.5), 沿河向错位两节)
// —— 桥=咽喉的掩体感 (桥面/桥堍防守位); footFree 门避开临河地块足迹
if(D.river&&D.river.bridges){
 for(const b of D.river.bridges){
  const px=Math.sin(b.yaw),pz=Math.cos(b.yaw);           // 桥面轴向 (跨河法向)
  const rx=-pz, rz=px;                                   // 沿河向 (桥宽向)
  for(const sd of [1,-1]){
   const cx=b.x+px*(b.len/2+3.0)*sd, cz=b.z+pz*(b.len/2+3.0)*sd;
   let n2=0;
   for(const off of [-3.0,3.0]){
    if(n2>=2) break;
    const sx=cx+rx*off, sz=cz+rz*off;
    if(Math.abs(sx)>250||Math.abs(sz)>250) continue;
    if(!footFree(sx,sz,1.2)) continue;
    sandbagWall(sx,sz,3.0,Math.atan2(rx,rz),1.0); n2++;
   }
  }
 }
}
// 1.5) 临街围栏 (v2): 30% 带朝向登记的地块临街一道 (中式矮石墙/欧式树篱) —— 前院围合+巷战掩体
for(const L of D.lots){
 if(!L.fx&&!L.fz) continue;
 if(wr(0,1)>=0.3) continue;
 const cx=L.x+L.fx*(L.d/2+2.0), cz=L.z+L.fz*(L.d/2+2.0);
 const hx=Math.cos(L.sa)*(L.w/2+0.8), hz=Math.sin(L.sa)*(L.w/2+0.8);
 if(CN) stoneWall(cx-hx,cz-hz,cx+hx,cz+hz,0.85); else hedgerow(cx-hx,cz-hz,cx+hx,cz+hz);
}
// 1.6) 路旁树 (v2): 主街/干道隔段一株 (侧偏 7~9.5m) —— 林荫感+视觉掩体, fieldAt 让位农田
for(const ln of D.polys){
 if(ln.cls==='lane'||ln.cls==='sub') continue;   // 巷/次街不植行道树 (排屋贴街)
 for(let i=0;i<ln.pts.length-1;i++){
  const a=ln.pts[i], b=ln.pts[i+1];
  const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz); if(L<6) continue;
  const ux=dx/L,uz=dz/L;
  const sd=wr(0,1)<0.5?-1:1, off=wr(7,9.5);
  const tx=a[0]+ux*L*0.5-uz*sd*off, tz=a[1]+uz*L*0.5+ux*sd*off;
  if(Math.abs(tx)>250||Math.abs(tz)>250) continue;
  if(!footFree(tx,tz,1.3)) continue;                       // 树干不进建筑足迹
  if(RURAL_FIELDS.length&&fieldAt(tx,tz)) continue;
  if(wr(0,1)<0.3) tree(tx,tz,wr(0.85,1.3));
 }
}
// 1.7) 广场集市感 (v3 多聚落): 每聚落周圈箱/桶 —— 主村 3 组 (17~24m) / 副村·卫星村 1 组 (12~16m),
//      避旗杆 —— 集市遗迹, 巷战散掩体 (旧版只布 D.core 单核)
for(const st of (D.settles||[{x:D.core.x,z:D.core.z,main:true}])){
 const nG=st.main?3:1, r0=st.main?17:12, r1=st.main?24:16;
 for(let k=0;k<nG;k++){
  const a=wr(0,6.283), rr=wr(r0,r1);
  const px=st.x+Math.cos(a)*rr, pz=st.z+Math.sin(a)*rr;
  if(!footFree(px,pz,0.9)) continue;                        // 集市件不进地标/民宅足迹
  if(wr(0,1)<0.5) crate(px,pz,wr(1.0,1.4),wr(0,1.6)); else barrel(px,pz);
 }
}
// 2) 掩体审计: 干道每 ~42m 交替两翼一处 (通视走廊 ≤70m 口径), 村口方向加拒马
{
 let k=0;
 for(const ln of D.polys){
  if(ln.cls!=='trunk0'&&ln.cls!=='trunk1') continue;
  let acc=16+wr(0,14);                          // 16~30 起始相位 (确定性: wr)
  for(let i=0;i<ln.pts.length-1;i++){
   const a=ln.pts[i], b=ln.pts[i+1];
   const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz); if(L<4) continue;
   const ux=dx/L,uz=dz/L;
   for(let s=0;s<L;s+=2){
    acc+=2; if(acc<42) continue;
    acc=0;
    const px=a[0]+ux*s, pz=a[1]+uz*s;
    const sd=((k++)%2)?1:-1, off=wr(5.5,7.5);
    const cx=px-uz*sd*off, cz=pz+ux*sd*off;
    if(!footFree(cx,cz,1.2)) continue;                      // 掩体不进建筑足迹 (弯道处建筑可能贴路)
    const r=wr(0,1);
    if(r<0.3) crate(cx,cz,wr(1.0,1.5),wr(0,1.6));
    else if(r<0.55) barrel(cx,cz);
    else if(r<0.8) hedgehog(cx,cz);
    else sandbagWall(cx,cz,3.2,Math.atan2(uz,ux)+HPI,1.0);
    if(Math.hypot(px-D.core.x,pz-D.core.z)<34&&wr(0,1)<0.6&&footFree(px-uz*3.2,pz+ux*3.2,1.2)) hedgehog(px-uz*3.2,pz+ux*3.2);   // 村口拒马
   }
  }
 }
}
// 3) 旗圈家具: 环上两段沙袋 (圈缘 r+2.4, 不压旗杆) + 木箱; NAV 放行旗圈 (旗杆细, 占位格由放行带兜底)
for(const f of CAMPAIGN.flags){
 for(let k=0;k<2;k++){
  const a=wr(0,6.283), rr=f.r+2.4;
  const sx=f.x+Math.cos(a)*rr, sz=f.z+Math.sin(a)*rr;
  if(footFree(sx,sz,1.0)) sandbagWall(sx,sz,3.4,a+HPI,1.0);
 }
 if(wr(0,1)<0.7){ const cx2=f.x+wr(-7,7), cz2=f.z+wr(-7,7); if(footFree(cx2,cz2,0.9)) crate(cx2,cz2,1.2,wr(0,1.5)); }
 NAV_CLEARS.push({x:f.x,z:f.z,r:5.2});
}
// 4) 林地: 圆域撒树 (fieldAt 让位农田; tree/deadTree 自带 propFree 互斥)
for(const wd of D.woods){
 const n=Math.floor(wd.r*wd.r/30);
 for(let i=0;i<n;i++){
  const a=wr(0,6.283), rr=Math.sqrt(wr(0,1))*wd.r;
  const x=wd.x+Math.cos(a)*rr, z=wd.z+Math.sin(a)*rr;
  if(Math.abs(x)>250||Math.abs(z)>250) continue;
  if(RURAL_FIELDS.length&&fieldAt(x,z)) continue;
  if(wr(0,1)<0.16) deadTree(x,z); else tree(x,z,wr(0.8,1.35));
 }
}
// 5) 田缘墙 + 田内草垛 (2026-10-24 农田掩体批; 00c 数据阶段已定计划):
//    f.walls=边索引表 (2~3 边, 候选边已避路 ≥4.5/避基地 ≥26) —— 中式矮石墙/欧式树篱, bocage 掩体链;
//    f.hay=草垛点表 (1~3) —— 硬掩体圆柱 (与莫斯科草垛同款 CYLS 口径, 工兵可拆), 半身掩体+视觉锚点。
for(const f of RURAL_FIELDS){
 const E=[[f.x0,f.z0,f.x1,f.z0],[f.x0,f.z1,f.x1,f.z1],[f.x0,f.z0,f.x0,f.z1],[f.x1,f.z0,f.x1,f.z1]];
 for(const wi of (f.walls||[])){
  const e=E[wi]; if(!e) continue;
  if(CN) stoneWall(e[0],e[1],e[2],e[3],0.85); else hedgerow(e[0],e[1],e[2],e[3]);
 }
 for(const h of (f.hay||[])){
  if(!freeSpot(h.x,h.z,1.5)) continue;                     // 草垛不进建筑足迹 (00c 已避路/田缘)
  const g0=heightAt(h.x,h.z);
  mesh(new THREE.CylinderGeometry(1.1,1.1,1.6,12),MAT.hay,h.x,g0+1.1,h.z);
  CYLS.push({x:h.x,z:h.z,r:1.15,y0:g0,y1:g0+2.2});
  coverPoints.push({x:h.x,z:h.z-2});
 }
}
// 5b) 野地孤树 (00c singles 计划): 田块间/聚落间散株 —— 掩体链补洞 + 破"圆盘树林"均质感
for(const p of (D.singles||[])){
 if(Math.abs(p.x)>MAP_SIZE/2-6||Math.abs(p.z)>MAP_SIZE/2-6) continue;
 if(!footFree(p.x,p.z,1.4)) continue;
 if(RURAL_FIELDS.length&&fieldAt(p.x,p.z)) continue;
 tree(p.x,p.z,p.s);
}
}
function buildWorld(){
if(typeof ACTIVE_CAMPAIGN==='undefined'||!ACTIVE_CAMPAIGN){
ACTIVE_CAMPAIGN=typeof deepClone==='function'?deepClone(CAMPAIGN):CAMPAIGN;
CAMPAIGN=ACTIVE_CAMPAIGN;
}
// 单队生存主基地居中 (2026-10-07d 裁定3, 仅预设图): solo 主基地=距图心最近的旗旁 7m (诺曼底即教堂旁
// C 旗) —— 在布局函数执行**前**改写 ACTIVE_CAMPAIGN.bases ⇒ 营区布景/部署/重生/zDefPosts/坦克落位全链跟随。
// procgen 同款裁定在 00c 数据阶段做 (基地改写后路网/净空才能跟着长); canyon 无基地、海战图不开放丧尸。
// spawns (攻方前出营) 一并清空: solo 从主基地出发, 不再被部署到远处进攻出发地。
if(typeof ZOMBIE_MODE!=='undefined'&&ZOMBIE_MODE==='solo'&&ACTIVE_CAMPAIGN.layout!=='procgen'&&ACTIVE_CAMPAIGN.bases&&ACTIVE_CAMPAIGN.bases.length){
let bf=null,bd=1e9;
for(const f of ACTIVE_CAMPAIGN.flags){ if(f.ship!==undefined) continue;
const d=f.x*f.x+f.z*f.z; if(d<bd){ bd=d; bf=f; } }
if(bf){
const L=Math.hypot(bf.x,bf.z);
const bx=L>1?Math.round(bf.x+bf.x/L*7):bf.x, bz=L>1?Math.round(bf.z+bf.z/L*7):bf.z;
ACTIVE_CAMPAIGN.bases[0]={x:bx,z:bz};
ACTIVE_CAMPAIGN.bases[1]={x:bx,z:bz};
ACTIVE_CAMPAIGN.spawns=[];
}
}
// 破袭模式: 补给库占旗点中心, 布局前先预留足迹, 房屋才会环绕其摆放
if(GAMEMODE==='demolition'){
for(const f of CAMPAIGN.flags) B_FOOT.push(footRect(f.x,f.z,0,5.5,5.5,0.8));
}
	switch(CAMPAIGN.layout){
	case 'stalingrad': layoutStalingrad(); break;
	case 'berlin': layoutBerlin(); break;
	case 'delta': layoutDelta(); break;
	case 'loess': layoutLoess(); break;
	case 'jungle': layoutJungle(); break;
	case 'deepjungle': layoutDeepJungle(); break;
		case 'moscow': layoutMoscow(); break;
		case 'steppe': layoutSteppe(); break;
		case 'woods': layoutWoods(); break;
		case 'island': layoutIsland(); break;
		case 'canyon': layoutCanyon(); break;
		// (2026-11-10: case 'opensea' 随珊瑚海/铁底湾下架摘除, layoutOpensea 原文见 archive/)
		case 'procgen': layoutProcgen(); break;   // 随机战场 (2026-10-06): 00c 数据 → 素材复用落位
		default: layoutRural(); break;
	}
// 大桥 (胡康=木排架; 淞沪=石拱×2): 按桥型分派
// 莫斯科冰河水面在 buildWorld 通用 RIVER 分支渲染 (ice=true); 编组站调车线由 layoutMoscow 铺设
if(BRIDGES.length){
for(const B of BRIDGES){
if(CAMPAIGN.id==='songhu'||B.kind==='stone') stoneBridge(B);
else if(B.kind==='grand') grandBridge(B); // 胡康大龙河大桥 (2026-09-12 巨桥改版)
else if(B.kind==='pier') pierTrestle(B);  // 塔拉瓦长栈桥 (2026-09-18: deckY 绝对桥面高, 见 05a)
else buildBridge(B); // 通用木排架
}
}
// 破袭模式: 在旗点位置建立补给库目标
if(GAMEMODE==='demolition'){
for(const f of CAMPAIGN.flags){
const g=buildDepot(f.x,f.z,wr(0,3));
if(g) DEPOTS.push({id:f.id,x:f.x,z:f.z,g,destroyed:false});
}
}
// 基地营区 (通用): 全部相对基地坐标偏移, 角落基地(遭遇战)同样适用
// (2026-11-10: 旧"全海图例外"门随海战图下架摘除 —— 通用分支本就与陆图逐位同轨)
CAMPAIGN.bases.forEach((b,t)=>{
if(typeof ZOMBIE_MODE!=='undefined'&&ZOMBIE_MODE==='solo'&&t>0) return;   // solo 双基地同点: 营区只画一套 (2026-10-07d)
const sgn=b.x<0?1:-1;
tent(b.x+sgn*2,b.z+6,0.3); tent(b.x,b.z-6,-0.2); tent(b.x-sgn*4,b.z,0);
sandbagWall(b.x+sgn*10,b.z+6,5,HPI); sandbagWall(b.x+sgn*10,b.z-6,5,HPI); sandbagWall(b.x+sgn*8,b.z,5,HPI);
crate(b.x+sgn*4,b.z+10,1.3,0); barrel(b.x+sgn*5,b.z-9);
});
// 基地附属建筑 (2026-10-07d 全局要素, 用户裁定"主基地旁不要只是三个小屋"): 外侧民居/木屋各一,
// placeAt 通用落位 (地形/占位失败自动弃置, 不强求) —— 各图基地写死位置周边本就留空, 命中率≈1;
// (海图除外 —— 2026-11-10 起无海图, 门已摘)。solo 双基地同点只放一套。
// ★方向 = **外侧** (背向地图中心, sgn 取反): 回归三连的根因就是第一版沿用了营区帐篷的 sgn (朝内) ——
//   内侧是火制走廊/主街/基地间通路所在 (淞沪迫击炮弹道被民居西墙拦截 killattr T3 / 城市图侵街
//   layouts / 雾林守线基地间路标段穿墙 nav), 外侧是基地背后, 三类走廊都不经过。
CAMPAIGN.bases.forEach((b,t)=>{
if(typeof ZOMBIE_MODE!=='undefined'&&ZOMBIE_MODE==='solo'&&t>0) return;
const s2=b.x<0?-1:1;   // 外侧 (与上方帐篷的 sgn 相反)
const MS=(CAMPAIGN.mapSize||640)/2;
const tryBld=(dx,dz,w,d,fn)=>{
const x=b.x+dx, z=b.z+dz;
if(Math.abs(x)>MS-14||Math.abs(z)>MS-14) return;
const p=placeAt(x,z,Math.atan2(dx,dz)+HPI,w,d,{maxDh:1.7,strict:true});
if(p) fn(p.x,p.z,p.ry);
};
tryBld(s2*16,6,7,6,(x,z,ry)=>cnHouse(x,z,ry,7,6));
tryBld(s2*13,-10,6,5,(x,z,ry)=>logCabin(x,z,ry));
});
decorateTrenches();
// 河流水面/冰面: 沿河道中心线的连续条带网格 (主河 + 淞沪支流汊港共用同一渲染器)。
// 水位按折线逐采样点取值 (岸高-落差), 再做滑动平均平滑, 相邻采样点线性插值。
function _waterStrip(P,w,ice,d){
// ★ 2026-09-21 WS4 (海战图 7 项优化 · 第 5 项④): 非结冰水面补 depthWrite:false —— 与海面 (本文件 :1988) 同口径。
//   改动前: transparent:true 却仍在写深度 ⇒ 半透明面写深后会把其后的水面/水底地形/桥墩按"先到先得"挡掉,
//   且水面被 clamp 在 bank-0.08 / bed+0.15 之间, 与岸壁/砂床那一圈只差几厘米 ⇒ 该圈层闪点。
//   改动后: 透明面退出深度竞争, 只保留 depthTest 与 renderOrder=1 的排序 (半透明件靠排序, 不靠深度写)。
//   (尺寸/水位/几何一律未动 —— 只改材质的一个布尔位。)
const wmat=ice
?new THREE.MeshLambertMaterial({color:0xcfe2ee,map:TEX.ice})
:new THREE.MeshLambertMaterial({color:0x3e5a6a,transparent:true,opacity:0.72,map:TEX.water,depthWrite:false});
const hw=w*0.95;
const samples=[];
for(let i=0;i<P.length-1;i++){
const ax=P[i][0],az=P[i][1],bx2=P[i+1][0],bz2=P[i+1][1];
const dx=bx2-ax,dz=bz2-az;
const len=Math.hypot(dx,dz)||1;
const nx=-dz/len, nz=dx/len;
const nCh=Math.max(1,Math.round(len/12));
for(let k=0;k<nCh;k++){
const tc=(k+0.5)/nCh;
samples.push({x:ax+dx*tc,z:az+dz*tc,nx,nz,seg:i});
}
}
// 逐段河床最低点 (含两端点与 3 个内插站) —— 浅河水深上限要用"这一段的最低床", 否则
// 采样点之间的局部洼地仍会算出超过上限的水深 (2026-09-26E 审计 26 的第二层: 顶点/段中洼地)。
const segBedMin=[];
for(let i=0;i<P.length-1;i++){
const ax=P[i][0],az=P[i][1],bx2=P[i+1][0],bz2=P[i+1][1];
let mn=Math.min(heightAt(ax,az,true),heightAt(bx2,bz2,true));
for(const t of [0.25,0.5,0.75]) mn=Math.min(mn,heightAt(ax+(bx2-ax)*t,az+(bz2-az)*t,true));
segBedMin.push(mn);
}
for(const s of samples){
const off=w+1.5;
const bank=Math.min(heightAt(s.x+s.nx*off,s.z+s.nz*off,true),heightAt(s.x-s.nx*off,s.z-s.nz*off,true));
const bed=heightAt(s.x,s.z,true);
let wy;
if(ice){ wy=bed+0.12; }else{ wy=bank-(d>6?d*0.55:(d>2?1.1:0.4)); } // 2026-09-12 巨桥改版: 深谷 (d>6) 水面随深度下沉 (d=14 → 岸下 7.7m, 巨桥凌空), 中深河保持 1.1; ford 滩心由 bed 抬升自动变浅 (clamp 到 bed+0.15)
wy=clamp(wy,bed+0.15,bank-0.08);
s.bank=bank; s.wy=wy;
}
for(let pass=0;pass<2;pass++){
for(let i=0;i<samples.length;i++){
const a=samples[Math.max(0,i-1)], b=samples[i], c=samples[Math.min(samples.length-1,i+1)];
samples[i].wy=(a.wy+b.wy+c.wy)/3;
}
}
for(const s of samples){
const bed=heightAt(s.x,s.z,true);
// ★2026-09-26E (审计 26): 浅河 (d≤2, 语义表=可涉渡) 的物理水深上限 —— 声明档与物理必须一致。
//   旧版只夹 [bed+0.1, bank-0.15], 实测滇缅心线 0.15~1.92m (40% 的点 >SWIM_DEPTH) ⇒ 寻路当干地、
//   走进去却转游泳 (不能开火/龟速), 与 inShallowChannel 的"浅水减速"声明打架。
//   上限按**本段最低床** (segBedMin) 而非采样点自己的床算 —— 查询是沿段线性插值, 采样点之间的
//   局部洼地 (实测淞沪汊港顶点处比相邻采样点低 0.94m) 会让"按点夹"失效。
//   深谷激流档 (d>2) 不受限 —— 淞沪主河 1.48~2.90m / 胡康大龙河巨谷是设计如此 (须过桥)。
let hi=s.bank-0.15;
if(!(d>2)){
const bedLo=Math.min(bed,segBedMin[s.seg]!==undefined?segBedMin[s.seg]:bed);
hi=Math.min(hi,bedLo+SHALLOW_RIVER_MAX);
if(hi<bed+0.1) hi=bed+0.1;
}
s.wy=clamp(s.wy,bed+0.1,hi);
}
// 水面采样登记 (2026-09-18 塔拉瓦批; ★2026-09-26E 改条带登记): 供 03-terrain waterYAt/waterDepthAt/shoreDirAt 查询 ——
// 游泳/潜水/水下滤镜/落水自救 (以及日后水上载具的吃水) 全部走这一份水面单源。
// 登记的是"相邻采样点成段"的条带 (与上面渲染四边形同拓扑), 查询沿段线性插值 ⇒ 网格与判定同源, 段间无空隙。
waterSurfRegStrip(samples,hw);
const verts=new Float32Array(samples.length*2*3);
const idx=[];
for(let i=0;i<samples.length;i++){
const s=samples[i];
const o=i*6;
verts[o+0]=s.x-s.nx*hw; verts[o+1]=s.wy; verts[o+2]=s.z-s.nz*hw;
verts[o+3]=s.x+s.nx*hw; verts[o+4]=s.wy; verts[o+5]=s.z+s.nz*hw;
if(i>0){
const a=(i-1)*2, b=i*2;
idx.push(a,a+1,b, a+1,b+1,b);
}
}
const wgeo=new THREE.BufferGeometry();
wgeo.setAttribute('position',new THREE.BufferAttribute(verts,3));
{
const uvs=new Float32Array(samples.length*2*2);
let accU=0;
for(let i=0;i<samples.length;i++){
const s2=samples[i];
if(i>0){ const p2=samples[i-1]; accU+=Math.hypot(s2.x-p2.x,s2.z-p2.z); }
uvs[i*4+0]=accU/14; uvs[i*4+1]=0;
uvs[i*4+2]=accU/14; uvs[i*4+3]=1;
}
wgeo.setAttribute('uv',new THREE.BufferAttribute(uvs,2));
}
wgeo.setIndex(idx);
wgeo.computeVertexNormals();
const wmesh=new THREE.Mesh(wgeo,wmat);
// 贴地水面档 (2026-09-27): 非结冰水面走 patchWater; 结冰水面 (wmat 不透明, **写深度**) 是本函数的例外 ——
// 冰面是"地形接收面"而不是覆盖层 (它自己就是被踩的河面, heightAt 会把它当可站立面), 但它与河床只差 12cm
// (200m 处 4 LSB) ⇒ 同样要吃这一档, 否则冰面远端与河床互相闪 (旧版冰面完全没登记 = 同一根因的漏网)。
if(typeof surfaceLane==='function') surfaceLane(wmesh,'patchWater'); else wmesh.renderOrder=1;
scene.add(wmesh);
}
if(RIVER) _waterStrip(RIVER.pts,RIVER.w,RIVER.ice,RIVER.d||1.9);
// 淞沪支流汊港: 浅水条带 (无冰, d=语义表)
if(DELTA_CHANS.length){
for(const ch of DELTA_CHANS) _waterStrip(ch,DELTA.w||3.4,false,DELTA.d||1.35);
}
// 鱼塘/藕塘水面: 圆盘网格 (藕塘偏绿浮叶色, 鱼塘青蓝)
// ★ 2026-09-21 WS4 (第 5 项④): 两张塘水材质补 depthWrite:false —— 与海面/河道同口径。
//   改动前: transparent:true 但写深度; 水面被 clamp 在 bank-0.12..bank-0.05 (而塘底 g0+0.08 为下限),
//   与塘岸/塘底那一圈只差 5~8cm ⇒ 圆盘边缘一圈闪点, 且写深会把水下的藕叶/塘底地形挡掉。
if(CAMPAIGN.delta&&CAMPAIGN.delta.ponds){
const pmatLotus=new THREE.MeshLambertMaterial({color:0x4a6a3a,transparent:true,opacity:0.78,map:TEX.water,depthWrite:false});
const pmatFish=new THREE.MeshLambertMaterial({color:0x3e5a6a,transparent:true,opacity:0.72,map:TEX.water,depthWrite:false});
for(const pd of CAMPAIGN.delta.ponds){
const g0=heightAt(pd.x,pd.z,true);
const bank=Math.min(
heightAt(pd.x+pd.r*0.92,pd.z,true), heightAt(pd.x-pd.r*0.92,pd.z,true),
heightAt(pd.x,pd.z+pd.r*0.92,true), heightAt(pd.x,pd.z-pd.r*0.92,true));
const wy=clamp(bank-0.12, g0+0.08, bank-0.05);
waterSurfReg(pd.x,pd.z,wy,pd.r*0.95); // 水面采样登记 (同上: 塘内也能触发游泳/水下滤镜)
const disc=new THREE.Mesh(new THREE.CircleGeometry(pd.r*0.92,16), pd.t==='lotus'?pmatLotus:pmatFish);
disc.position.set(pd.x,wy,pd.z);
disc.rotation.x=-HPI;
// 贴地水面档 (2026-09-27 深度分层): 塘面被 clamp 在 bank-0.12..bank-0.05 (塘底 g0+0.08 为下限),
// 与塘岸/塘底只差 5~8cm ⇒ 100m 外不足 1 个 LSB, 圆盘边缘一圈会闪。与河道/海面同走 patchWater。
if(typeof surfaceLane==='function') surfaceLane(disc,'patchWater'); else disc.renderOrder=1;
scene.add(disc);
}
}
buildSeaMesh();
buildSurfStrip();
// 树木/枯树散布 (避开道路/平整区/河道/建筑足迹/裸岩带; 边界随地图尺寸; treeQ 主题按画质缩放)
	const treeSpots=[];
		const TR=MAP_SIZE/2-8;
	for(let i=0,n=Math.round(THEME.treeN*treeQMul());i<n;i++){
		const x=wr(-TR,TR), z=wr(-TR,TR);
	if(roadDist(x,z)<7) continue;
	if(inRiverChannel(x,z)) continue;
if(typeof inWaterBody==='function'&&inWaterBody(x,z)) continue;   // 2026-09-26E 审计 34: 通用水体门
	// ★2026-09-26 修 (P2-18 植被落水): inRiverChannel 只认"深谷激流"(RIVER.d>2) —— 滇缅/莫斯科的浅河与冰河、
	//   淞沪的 delta 汊港与鱼塘、胡康的徒涉滩心全部漏网, 野树直接长在水里/冰面上 (实测能通过旧树门的水下格:
	//   滇缅 646 / 莫斯科冰面 594 / 胡康 147 / 淞沪 230)。这里补一道**通用水体门** (03-terrain inWaterBody 单源)。
	if(inWaterBody(x,z)) continue;
	if(SEA&&shoreDist(x,z)>-16) continue;  // 环礁: 野树不落湿沙/海面 (沙滩保持开阔 = 登陆火力场)
	if(SEA&&rectDist(x,z,SEA.runway.x0-6,SEA.runway.z0-6,SEA.runway.x1+6,SEA.runway.z1+6)<=0) continue; // 跑道面不落树
	if(CITY&&cityUrban(x,z)) continue; // 城市组: 野树不落建成区 (街道+街块+厂区; 街廊保通行/保视线)
	if(!freeSpot(x,z,1.3)) continue;
	if(RURAL_FIELDS.length&&fieldAt(x,z)) continue; // 农田内部不落野树 (整洁田块)
		let near=false;
	for(const f of FLATS){ if(Math.hypot(x-f.x,z-f.z)<f.r*((CAMPAIGN.layout==='jungle'||CAMPAIGN.layout==='deepjungle')?0.5:0.85)) near=true; }
	if(near) continue;
	treeSpots.push([x,z]);
}
treeSpots.forEach(([x,z])=>{ if(wRand()<THEME.dead) deadTree(x,z); else tree(x,z,wr(0.8,1.5)*(CAMPAIGN.layout==='jungle'?1.25:(CAMPAIGN.layout==='deepjungle'?1.4:(CAMPAIGN.layout==='woods'?1.8:1)))); });
// 废墟主题: 额外瓦砾堆与弹坑
const TR2=MAP_SIZE/2-30;
for(let i=0;i<THEME.rubbleN;i++){
const x=wr(-TR2,TR2), z=wr(-TR2,TR2);
if(roadDist(x,z)<6) continue;
if(!freeSpot(x,z,1)) continue;
if(wr(0,1)<0.6) rubblePile(x,z,wr(1.4,2.6)); else crater(x,z,wr(1.6,2.6));
}
// 2026-09-20 I5: 三档基数提到 00-config 单源 FLORA_CFG.grassN (缺省=旧 480/1050/1850 ⇒ 其余图不变;
// 环礁 = [1000,2400,4200] —— 用户第 7 条"应当有不少草丛树丛")
const grassCount=Math.round(FLORA_CFG.grassN[SETTINGS.quality===0?0:(SETTINGS.quality===1?1:2)]*THEME.grassMul);
const gGeo=new THREE.PlaneGeometry(0.9,0.55);
gGeo.translate(0,0.27,0);
const gMat=new THREE.MeshLambertMaterial({map:svgApply(makeTex(64,64,(g,w,h)=>{
g.clearRect(0,0,w,h);
for(let i=0;i<30;i++){
g.strokeStyle=`rgba(${wri(90,130)},${wri(115,150)},${wri(55,80)},.9)`;
g.lineWidth=2;
g.beginPath(); const x=wr(4,60); g.moveTo(x,h); g.quadraticCurveTo(x+wr(-6,6),h*0.5,x+wr(-10,10),wr(4,20)); g.stroke();
}
}),'grassTuft'),transparent:true,alphaTest:0.35,side:THREE.DoubleSide});
const inst=new THREE.InstancedMesh(gGeo,gMat,Math.max(grassCount,1));
gMat.color.set(THEME.grassC);
const dummy=new THREE.Object3D();
const TR3=MAP_SIZE/2-10;
// 草丛可燃: 每丛向火焰网格注入少量燃料, 实例按格登记 (所在格烧尽后整丛隐藏)
const GRASS_BY_CELL=new Map();
const hideDummy=()=>{ dummy.position.set(0,-999,0); dummy.rotation.set(0,0,0); dummy.scale.setScalar(0); dummy.updateMatrix(); return dummy.matrix; };
// 2026-09-20 I5: 环礁采样重试 —— 旧版把"落海/湿沙/跑道"的采样点直接隐藏 (1418 个实例只有 408 个
// 真正落位, 其余全浪费在海上), 这正是"植被太少"的根因之一。重采样把实例搬到陆上;
// **非环礁战役 grassTries 恒为 1 ⇒ 随机数消耗与旧版逐次一致** (不扰动其它 13 张图的布局指纹)。
const grassTries=SEA?Math.max(1,FLORA_CFG.grassTries):1;
for(let i=0;i<grassCount;i++){
	let x=0,z=0,ok=false;
	for(let k=0;k<grassTries;k++){
		x=wr(-TR3,TR3); z=wr(-TR3,TR3);
		if(roadDist(x,z)<4){ x+=8; }
		if(CITY&&cityUrban(x,z)) continue;                    // 城市组: 建成区=瓦砾压实土, 全域不生草丛
		// 环礁滩头禁入带与灌木同一份单源 (2026-09-20 I5 收尾): 旧版草丛写死 -15, 灌木用 shoreGuard,
		// 同一张图两套滩头线 = 单源不完整。其余主题 shoreGuard 缺省 15 ⇒ 与旧 -15 逐字等同 (零漂移)。
		if(SEA&&(shoreDist(x,z)>-FLORA_CFG.shoreGuard||rectDist(x,z,SEA.runway.x0,SEA.runway.z0,SEA.runway.x1,SEA.runway.z1)<=0)) continue; // 环礁: 湿沙/浅水/珊瑚跑道/沙丘迎海面 (火力场保持干净)
		if(inRiverChannel(x,z)||inWaterBody(x,z)||!freeSpot(x,z,0)) continue; // inWaterBody: 2026-09-26 P2-18 通用水体门 (与野树同一道; 此处只改"隐藏还是落位", 不动随机流)
		ok=true; break;
	}
	if(!ok){
		inst.setMatrixAt(i,hideDummy()); // 未落位实例隐藏 (避免默认矩阵聚在原点)
		continue;
	}
	dummy.position.set(x,heightAt(x,z),z);
	dummy.rotation.y=wr(0,Math.PI);
	dummy.scale.setScalar(wr(0.7,1.4));
	dummy.updateMatrix();
	inst.setMatrixAt(i,dummy.matrix);
	fuelAdd(x,z,0.35);
	const ci=fCellI(x,z);
	let arr=GRASS_BY_CELL.get(ci);
	if(!arr){ arr=[]; GRASS_BY_CELL.set(ci,arr); }
	arr.push(i);
}
inst.receiveShadow=true;
scene.add(inst);
registerBurnableInst(inst,GRASS_BY_CELL);
	// ── 对峙轴带灌木加密 (2026-10-24e 随机图 farm 专属): 横向 |lat|≤78K 低矮装饰掩体补量 ──
	// 必须放在 scatterBushes() **之前**: bush() 只入 BUSH_BATCH, 由 scatterBushes 尾部的 flushBushes()
	// 一并实例化 (之后另调 bush 而不再 flush = 批永不渲染)。门要钉 procgen —— PG 在预设图也存在
	// (群系哈希自随机种子), 不钉 layout 则预设图 1/3 概率误入: 平白多 16 株灌木 + wr() 流被消费
	// ⇒ 其后 sineRoad 等散布逐帧漂移, 预设布局不可复现。
	if(CAMPAIGN.layout==='procgen'&&PG.biome==='farm'&&CAMPAIGN.bases&&CAMPAIGN.bases.length===2){
	const gK=Math.max(0.8,(MAP_SIZE/2)/190), GB=78*gK;
	const B0=CAMPAIGN.bases[0], B1=CAMPAIGN.bases[1];
	let ux=B1.x-B0.x, uz=B1.z-B0.z; const ul=Math.hypot(ux,uz)||1; ux/=ul; uz/=ul;
	const mxp=(B0.x+B1.x)/2, mzp=(B0.z+B1.z)/2;
	const nX=Math.round(16*gK);
	for(let i=0,placed=0;i<nX*4&&placed<nX;i++){
	const lon=wr(-ul*0.5,ul*0.5), lat=wr(-GB,GB);
	const x=mxp+ux*lon+(-uz)*lat, z=mzp+uz*lon+ux*lat;
	if(roadDist(x,z)<5) continue;
	if(fieldAt(x,z)) continue;
	let near=false;
	for(const f of CAMPAIGN.flags){ if(Math.hypot(x-f.x,z-f.z)<f.r+6){ near=true; break; } }
	if(near) continue;
	if(!freeSpot(x,z,1.2)) continue;
	bush(x,z,wr(0.85,1.5));
	placed++;
	}
	}
	// 灌木散布 (可燃/可碾): 密度随主题草量与画质缩放, 之后烧毁按记录消失
	scatterBushes();
// ── 诺曼底农田: 高杆庄稼 (小麦蹲伏即隐/玉米站立也隐) —— 无碰撞体, 子弹穿透, 遮 Bot 视线 ──
if(RURAL_FIELDS.length){
const wheatTex=svgApply(makeTex(128,128,(g,w,h)=>{
g.clearRect(0,0,w,h);
for(let i=0;i<26;i++){
const x=4+i*4.6+rand(0,2), hh=rand(88,118);
g.strokeStyle=`rgba(${randi(190,225)},${randi(165,195)},${randi(70,110)},${rand(.7,1)})`;
g.lineWidth=rand(1.5,2.2);
g.beginPath(); g.moveTo(x,h); g.lineTo(x+rand(-3,3),h-hh); g.stroke();
g.fillStyle=g.strokeStyle;
g.beginPath(); g.arc(x+rand(-3,3),h-hh,rand(2,3.4),0,TAU); g.fill();
}
}),'wheat');
const cornTex=svgApply(makeTex(128,128,(g,w,h)=>{
g.clearRect(0,0,w,h);
for(let i=0;i<16;i++){
const x=6+i*7.4+rand(0,3);
g.strokeStyle=`rgba(${randi(70,105)},${randi(130,165)},${randi(50,75)},${rand(.75,1)})`;
g.lineWidth=rand(2.4,3.2);
g.beginPath(); g.moveTo(x,h); g.lineTo(x+rand(-2,2),6); g.stroke();
g.fillStyle=`rgba(${randi(200,230)},${randi(160,180)},${randi(60,90)},0.9)`;
g.fillRect(x-3,2,rand(6,10),rand(9,13));
for(let k=0;k<3;k++){
g.strokeStyle=`rgba(${randi(65,95)},${randi(120,150)},${randi(45,65)},0.85)`;
g.lineWidth=rand(2,3);
g.beginPath(); g.moveTo(x,rand(50,95)); g.lineTo(x+rand(16,26),rand(66,108)); g.stroke();
g.beginPath(); g.moveTo(x,rand(50,95)); g.lineTo(x-rand(16,26),rand(66,108)); g.stroke();
}
}
}),'corn');
const riceTex=svgApply(makeTex(128,128,(g,w,h)=>{
g.clearRect(0,0,w,h);
for(let i=0;i<12;i++){
const x=8+i*10+rand(0,5);
g.strokeStyle=`rgba(${randi(95,130)},${randi(150,180)},${randi(70,95)},${rand(.75,1)})`;
g.lineWidth=rand(2,2.8);
g.beginPath(); g.moveTo(x,h); g.quadraticCurveTo(x+rand(-14,14),h*0.5,x+rand(-18,18),rand(10,26)); g.stroke();
g.strokeStyle=`rgba(${randi(170,200)},${randi(185,210)},${randi(90,120)},0.9)`;
g.lineWidth=rand(1.2,1.8);
g.beginPath(); g.moveTo(x,rand(48,72)); g.quadraticCurveTo(x+rand(-20,20),h*0.36,x+rand(-24,24),rand(8,20)); g.stroke();
}
}),'rice');
const wheatGeo=new THREE.PlaneGeometry(1.0,1.35); wheatGeo.translate(0,0.675,0);
const cornGeo=new THREE.PlaneGeometry(1.15,2.3); cornGeo.translate(0,1.15,0);
const riceGeo=new THREE.PlaneGeometry(1.3,1.7); riceGeo.translate(0,0.85,0);
for(const f of RURAL_FIELDS){
if(f.t!=='wheat'&&f.t!=='corn'&&f.t!=='rice') continue;
const geo=f.t==='wheat'?wheatGeo:f.t==='corn'?cornGeo:f.t==='rice'?riceGeo:null;
const tex=f.t==='wheat'?wheatTex:f.t==='corn'?cornTex:f.t==='rice'?riceTex:null;
const nx=Math.floor((f.x1-f.x0)/1.32), nz=Math.floor((f.z1-f.z0)/1.32);
const n=Math.max(nx*nz*2,1);
const im=new THREE.InstancedMesh(geo,new THREE.MeshLambertMaterial({map:tex,transparent:true,alphaTest:0.4,side:THREE.DoubleSide}),n);
// 庄稼可燃: 每格植株按格登记, 注入燃料 (麦/稻易燃, 玉米更旺) —— 燃烧弹点着整片田
const CROP_BY_CELL=new Map();
let k=0;
for(let i=0;i<nx;i++){
for(let j=0;j<nz;j++){
const x=f.x0+0.66+i*1.32+wr(-0.35,0.35), z=f.z0+0.66+j*1.32+wr(-0.35,0.35);
if(!freeSpot(x,z,0)) continue;
let near=false;
for(const fc of CAMPAIGN.flags){ if(Math.hypot(x-fc.x,z-fc.z)<fc.r+3){ near=true; break; } }
if(near) continue;
if(roadDist(x,z)<3.2) continue;
const g0=heightAt(x,z);
fuelAdd(x,z,f.t==='corn'?1.0:0.85);
const ci=fCellI(x,z);
let arr=CROP_BY_CELL.get(ci);
if(!arr){ arr=[]; CROP_BY_CELL.set(ci,arr); }
for(let p=0;p<2;p++){
dummy.position.set(x,g0,z);
dummy.rotation.y=p*HPI+wr(-0.2,0.2);
dummy.scale.setScalar(f.t==='wheat'?wr(0.86,1.02):f.t==='corn'?wr(0.92,1.06):wr(0.9,1.05));
dummy.updateMatrix();
im.setMatrixAt(k,dummy.matrix);
arr.push(k); k++;
}
}
}
im.count=k; im.receiveShadow=true;
scene.add(im);
registerBurnableInst(im,CROP_BY_CELL);
CROP_FIELDS.push({x0:f.x0,x1:f.x1,z0:f.z0,z1:f.z1,h:f.t==='wheat'?1.15:f.t==='corn'?2.0:1.6});
}
}
// ── 高草丛 (2026-10-24e 随机图): 无田空带的植被因素 —— 数据阶段规划 (PGDATA.grass, 避田/路/旗/聚落),
//    此处建 billboard 草丛 + 复用庄稼软遮蔽 (CROP_FIELDS h1.4: 蹲伏可隐/遮Bot视线/无碰撞/子弹穿透) + 可燃。
if(typeof PGDATA!=='undefined'&&PGDATA&&PGDATA.grass&&PGDATA.grass.length){
const grassTex=svgApply(makeTex(128,128,(g,w,h)=>{
g.clearRect(0,0,w,h);
for(let i=0;i<30;i++){
const x=3+i*4.1+rand(0,2), hh=rand(92,124);
const dry=randi(120,165);
g.strokeStyle=`rgba(${randi(96,140)+dry*0.2|0},${randi(130,170)},${randi(52,80)},${rand(.7,.95)})`;
g.lineWidth=rand(1.4,2.4);
g.beginPath(); g.moveTo(x,h); g.quadraticCurveTo(x+rand(-4,4),h-hh*0.6,x+rand(-6,6),h-hh); g.stroke();
if(i%3===0){ g.fillStyle=g.strokeStyle; g.beginPath(); g.arc(x+rand(-5,5),h-hh,rand(1.6,2.8),0,TAU); g.fill(); }
}
}),'tallgrass');
const grassGeo=new THREE.PlaneGeometry(1.2,1.55); grassGeo.translate(0,0.775,0);
for(const gp of PGDATA.grass){
const cap=Math.round(gp.r*gp.r*2.1);
const im=new THREE.InstancedMesh(grassGeo,new THREE.MeshLambertMaterial({map:grassTex,transparent:true,alphaTest:0.4,side:THREE.DoubleSide}),cap);
const CELL=new Map();
let k=0;
for(let i=0;i<cap*2;i++){
const a=wr(0,6.2832), rr=Math.sqrt(wr(0,1))*gp.r;
const x=gp.x+Math.cos(a)*rr, z=gp.z+Math.sin(a)*rr;
if(roadDist(x,z)<4.5) continue;
if(!freeSpot(x,z,0)) continue;
const g0=heightAt(x,z);
const ry=wr(0,6.2832), sc=wr(0.82,1.18);   // ★2026-10-25 顺手修配套: 两发 wr 提前到容量门之前消费 —— RNG 流与旧跑逐位一致
if(k>=cap) continue;   // ★2026-10-25 顺手修 (20261024e 批未提交区, verify-sink 稳定红根因): 候选通过率高于容量规划时 k 会越过 cap ⇒ 实机 InstancedMesh.setMatrixAt 越界、世界构建即崩。continue 不 break, 只跳过越界候选的侧效应 (fuel/网格/注册)
fuelAdd(x,z,0.7);
const ci=fCellI(x,z);
let arr=CELL.get(ci);
if(!arr){ arr=[]; CELL.set(ci,arr); }
dummy.position.set(x,g0,z);
dummy.rotation.y=ry;
dummy.scale.setScalar(sc);
dummy.updateMatrix();
im.setMatrixAt(k,dummy.matrix);
arr.push(k); k++;
}
if(!k){ scene.remove(im); continue; }
im.count=k; im.receiveShadow=true;
scene.add(im);
registerBurnableInst(im,CELL);
CROP_FIELDS.push({x0:gp.x-gp.r,x1:gp.x+gp.r,z0:gp.z-gp.r,z1:gp.z+gp.r,h:1.4});
}
}
if(CAMPAIGN.sineRoad){
for(let x=-(MAP_SIZE/2-36);x<=MAP_SIZE/2-36;x+=28){ // 2026-09-06 B7a/P2-11: 旧写死 ±124
const z=sineRoadZ(x)+6.5;
const g0=heightAt(x,z);
mesh(new THREE.CylinderGeometry(0.12,0.16,6.5,6),MAT.woodDark,x,g0+3.25,z);
mesh(boxGeo(0.1,0.12,1.8),MAT.woodDark,x,g0+5.8,z);
CYLS.push({x,z,r:0.2,y0:g0,y1:g0+6.5});
}
}
// 全图树木落位完毕: 合并实例批 (树干/叶面各 1 个 InstancedMesh)
flushTreeBatch();
// 垂柳实例批合并 (2026-11-10 柳树批): 干/枝/叶冠 3 张 InstancedMesh —— 必须在全部布局代码之后
// (村口柳 ④① / 沿河柳带 ⑥ / 草原村柳 都在 buildWorld 内登记 WILL_BATCH)
flushWillows();
// 建筑地基平台 (2026-09-20): 布局期登记的 PADS 在此一次性写回地形网格顶点 (网格载入期已按原地形建好)
if(typeof refreshTerrainMesh==='function'){ const _padN=refreshTerrainMesh(); if(_padN&&typeof console!=='undefined'&&console.log) console.log('[地形] 建筑地基平台: 重刷 '+_padN+' 个地形顶点'); }
// 深度分层 · 共面冲突消解 (2026-09-27) **不在这里调**: 05c 之后还有 15f 反舰炮台 / 17 固定炮位 / 16 坠机残骸
// 等世界级构建者会往 world 里放贴地大件 —— 在这里调就要调两次 (而两次调用要重扫已落档件, 莫斯科 ≈2×700ms)。
// 唯一调用点在 24-main 末尾 (全部脚本的构建期代码跑完之后), 见 05-world resolveCoplanarConflicts 头注释。
}
buildWorld();
// (史实注 2026-11-10: 旧"ship 甲板旗点"字段 —— 旗位按大舰 t=0 位姿写、由 15h capitalFlagTick 逐帧
//   反算 —— 已随珊瑚海/铁底湾下架摘除, 现存旗点全部是陆上固定旗。)
// 单队生存 (2026-10-07 裁定3.1): 无敌方队伍 —— 旗点全中立 (旧版 own:1 会让"第二个队伍"凭空存在)
if(typeof ZOMBIE_MODE!=='undefined'&&ZOMBIE_MODE==='solo') for(const f of CAMPAIGN.flags) delete f.own;
const FLAGS=CAMPAIGN.flags.map(f=>({id:f.id,x:f.x,z:f.z,r:f.r,own:f.own,owner:-1,cap:0,capTeam:-1,
poleH:f.poleH}));   // (2026-11-10: ship/crateL 甲板锚字段随大舰下架摘除 —— 余下地图无甲板旗点; poleH 低旗为通用档保留)
const BASES=CAMPAIGN.bases.map(b=>({x:b.x,z:b.z}));
FLAGS.forEach(f=>{
// (2026-11-10: 甲板旗点"基高取甲板面"分支随大舰下架摘除 —— 现一律 heightAt 落地)
const g0=heightAt(f.x,f.z);
// 杆高 poleH (★2026-10-02b 甲板旗低旗化): 缺省 7 = 旧几何逐位。低旗用于"旗位就在主炮扫掠带正下方"
//   的点 (史实注: 铁底湾前主炮 poleH 4.5, 该图已下架): 旗面带 (杆顶−1.5 ~ 杆顶) 整体降到炮管下缘之下,
//   塔转向不再扫穿旗面 —— 比挪旗点少动占领圈/旗名/i18n 词典 (通用档保留)。
const poleH=f.poleH||7;
const pole=mesh(new THREE.CylinderGeometry(0.07,0.09,poleH,8),MAT.metal,f.x,g0+poleH/2,f.z);
// 陆图旗杆进 CYLS (静态碰撞/占位表): r=0.15 细杆, 可被绕行/打断的占位口径与旧版一致。
const cylRef={x:f.x,z:f.z,r:0.15,y0:g0,y1:g0+poleH};
CYLS.push(cylRef);
const flagC=document.createElement('canvas'); flagC.width=64; flagC.height=40;
f.flagCtx=flagC.getContext('2d');
f.flagTex=new THREE.CanvasTexture(flagC);
// 旗面: 几何原点平移到挂边(杆侧) —— 摆动绕杆缘铰接, 不再绕旗面中垂线旋转; 分段网格供 21-match 布料涟漪
// 挂边贴杆面(x+0.075), 满旗时旗顶(6.25+0.75)与杆顶(g0+7)平齐
const fg=new THREE.PlaneGeometry(2.4,1.5,8,4);
fg.translate(1.2,0,0);
f.flagGeo=fg; f.flagBase=Float32Array.from(fg.attributes.position.array);
const fm=new THREE.Mesh(fg, new THREE.MeshLambertMaterial({map:f.flagTex,side:THREE.DoubleSide}));
fm.position.set(f.x+0.075,g0+poleH-0.75,f.z);
world.add(fm);
f.flagMesh=fm; f.poleTop=g0+poleH-0.75; f.gy=g0; f.poleH=poleH;
f.poleMesh=pole; f.poleCyl=cylRef;   // (2026-11-10: f.onDeck/capitalFlagTick 搬旗账随大舰下架摘除)
drawFlagTex(f);
});
function drawFlagTex(f){
const g=f.flagCtx;
if(f.owner===0){ g.textAlign='start'; g.fillStyle=TEAM_FACTION[0].flagBg; g.fillRect(0,0,64,40); g.fillStyle='#fff'; g.font='bold 26px sans-serif'; g.fillText(TEAM_FACTION[0].sym,20,31); }
else if(f.owner===1){ g.textAlign='start'; g.fillStyle=TEAM_FACTION[1].flagBg; g.fillRect(0,0,64,40); g.fillStyle='#eee'; g.font='bold 26px sans-serif'; g.fillText(TEAM_FACTION[1].sym,20,31); }
else if(f.owner===2){
// 丧尸阵营旗帜 (破损暗灰绿布面 + PvZ 经典灰青僵尸探出手爪剪影)
g.fillStyle='#364237'; g.fillRect(0,0,64,40);
// 撕裂划痕与暗部布纹
g.fillStyle='#222b23';
g.beginPath(); g.moveTo(4,0); g.lineTo(16,40); g.lineTo(12,40); g.lineTo(2,0); g.fill();
g.beginPath(); g.moveTo(48,0); g.lineTo(58,40); g.lineTo(54,40); g.lineTo(44,0); g.fill();
g.fillStyle='#241e17'; g.fillRect(0,35,64,5);
// PvZ 经典僵尸枯爪剪影 (腐肤灰青色 #9ecfa0)
g.fillStyle='#9ecfa0';
g.beginPath();
g.moveTo(27,35); g.lineTo(28,24); g.lineTo(24,20);
g.lineTo(19,16); g.lineTo(20,14); g.lineTo(25,17); // 大拇指
g.lineTo(27,9); g.lineTo(29,9); g.lineTo(30,16);   // 食指
g.lineTo(32,7); g.lineTo(34,7); g.lineTo(35,16);   // 中指
g.lineTo(37,10); g.lineTo(39,11); g.lineTo(38,18); // 无名指
g.lineTo(42,15); g.lineTo(43,17); g.lineTo(38,22); // 小指
g.lineTo(35,26); g.lineTo(35,35);
g.closePath(); g.fill();
g.strokeStyle='#263428'; g.lineWidth=0.8; g.stroke();
// 右上角点位微缩编号
g.textAlign='right'; g.fillStyle='rgba(255,255,255,0.75)'; g.font='bold 10px sans-serif';
g.fillText(f.id,60,12);
}
else {
g.fillStyle='#c9c9bb'; g.fillRect(0,0,64,40); g.fillStyle='#555';
// 多字点位名 (如"大桥") 自动缩字号并居中
g.textAlign='center';
if(f.id.length>2){ g.font='bold 12px sans-serif'; g.fillText(f.id,32,26); }
else if(f.id.length===2){ g.font='bold 15px sans-serif'; g.fillText(f.id,32,26); }
else { g.font='bold 22px sans-serif'; g.fillText(f.id,32,29); }
}
f.flagTex.needsUpdate=true;
}
const AMMO_CRATES=[];
function ammoCrate(x,z,force,y0,deckIdx){
// force=true 兜底: 绕过道具互斥直接放 (保证每旗/每基地必有弹药箱), 但仍登记占位防后续叠压
// y0 (P4 2026-09-30): 显式底高 —— 甲板旗点的弹药箱必须坐在**甲板面**上 (heightAt 在海上给的是海床,
//   会把箱子扔到 26m 深的水底); 非甲板点不传, 逐位等价于旧行为。
// deckIdx (2026-10-01 实机修): 该箱是**某艘大舰的甲板件** ——
//   ① 只记网格、不注册静态碰撞盒: 箱体随舰移动, 静态盒会在原海域留一堵隐形墙; 而逐帧搬盒要写 OCC
//      脏区 + 触发 NAV 重建 (见 15h 头注释三的同一理由) —— 1.1m 的木箱让行人穿过是零伤害。
//   ② 记下 {mesh,lid} 与舰索引, 供 15h 的 capDeckPropTick 逐帧搬运 (旧版箱子留在原地 ⇒ 实机
//      "旗帜周围的东西对于船体严重漂移")。
//   ③ 盖子基高改用 g0 (旧版一律用 groundFit 的四点均值 = 海床 ⇒ 甲板箱的盖子在 -25m 水下)。
if(!force&&!propFree(x,z,1.1)) return false;
propTake(x,z,1.1);
	const deck=(deckIdx!==undefined);
	const g0=(y0===undefined)?heightAt(x,z):y0;
	const ry=wr(0,3);
	const m=deck?mesh(boxGeo(1.1,0.7,0.8),MAT.woodDark,x,g0+0.35,z,ry):solidBox(MAT.woodDark,1.1,0.7,0.8,x,g0+0.35,z,ry);
	const fit=groundFit(x,z,ry,0.55,0.4);
	const use=deck?{pitch:0,roll:0,y:g0}:fit;      // 甲板是水平面: 不做贴坡姿态 (地面四点采样在海上读的是海床)
	applyFit(m,ry,use);
	const lid=mesh(boxGeo(1.15,0.08,0.85),MAT.wood,x,use.y+0.74,z,m.rotation.y);
	applyFit(lid,m.rotation.y,use);
	AMMO_CRATES.push(deck?{x,z,y:g0,ship:deckIdx,mesh:m,lid}:{x,z,y:g0});
return true;
}
// 弹药箱"贴掩体"评分 (2026-10-06 生成平衡批): 用户实报"补给箱露天乱摆, 附近有敌人时拿补给即被秒"。
// 主掩体分 = 距最近建筑足迹边缘的距离 (1.7m 甜区: 墙体替箱子挡弹线, 又不堵门窗通行); 次选沙袋/箱桶/
// 树干等既有道具 (PROPS, 1.3m 甜区, 权重略低)。距离用 freeSpot/propFree 的 margin 参数二分近似 ——
// 两者都是"距遮挡 < margin 即 false"的判据, 恰好可以反演距离。纯查询: 不登记占位、不消耗随机数。
function crateCoverScore(x,z){
let s=0;
{
let lo=0.5,hi=9;
if(!freeSpot(x,z,hi)){                    // 9m 外无墙 ⇒ 露天, 建筑分记 0
for(let i=0;i<9;i++){ const mid=(lo+hi)*0.5; if(freeSpot(x,z,mid)) lo=mid; else hi=mid; }
s=Math.max(0,1-Math.abs(lo-1.7)/2.8);
}
}
{
let lo=0.9,hi=6;
if(!propFree(x,z,hi)){
for(let i=0;i<8;i++){ const mid=(lo+hi)*0.5; if(propFree(x,z,mid)) lo=mid; else hi=mid; }
s=Math.max(s,0.75*Math.max(0,1-Math.abs(lo-1.3)/2.2));
}
}
return s;
}
// 弹药箱: 每个旗点与基地附近 (通用, 避让建筑足迹); 大桥旗点固定放在桥面上, 避免落进河谷
FLAGS.forEach(f=>{
// (2026-11-10: 甲板旗弹药箱分支随珊瑚海/铁底湾下架摘除 —— 原文见 archive/naval-coral-ironbottom-20261110/)
// 桥面旗的弹药箱 (2026-10-07e 修): 旧版硬编码**主桥** bridgePt(-4,1.4) —— 两个病: ①procgen 水乡
//   有 2~3 座桥, 二桥/三桥桥头旗的箱子被摆到主桥上 (距旗 ~90m, 探针"附近无弹药箱"实测抓出);
//   ②桥头旗 (离桥心 >16m 的桥堍旗) 同样吃这条分支 ⇒ 箱子离旗 18m 且两旗箱位重合 (道具互斥破坏)。
//   现口径: 旧位仍贴旗 (≤16m) 时**逐位沿用** (淞沪/胡康桥面旗零漂移, 已核: 胡康大桥旗箱距 1.8m);
//   否则改"距旗最近的桥 + 桥面内夹取贴旗点" (桥头旗箱落桥堍端, 仍在桥面上)。
if(BRIDGES.length&&onBridge(f.x,f.z,4)){
let p=bridgePt(-4,1.4);
if(Math.hypot(p[0]-f.x,p[1]-f.z)>16){
let BB=BRIDGES[0],bd=1e9;
for(const B of BRIDGES){ const d=Math.hypot(B.x-f.x,B.z-f.z); if(d<bd){bd=d;BB=B;} }
const cs=Math.cos(BB.yaw), sn=Math.sin(BB.yaw), lx=f.x-BB.x, lz=f.z-BB.z;
let uu=lx*sn+lz*cs, vv=lx*cs-lz*sn;                        // 旗的桥局部坐标 (u=桥长向, v=桥宽向)
uu=Math.max(-(BB.len/2-1.4),Math.min(BB.len/2-1.4,uu));    // 夹到桥面内 (两端各留 1.4m)
vv=Math.max(-(BB.w/2-0.6),Math.min(BB.w/2-0.6,vv));
p=bridgePtOf(BB,uu+(uu>=0?-1.3:1.3),vv);                   // 桥面内退 1.3m (让开旗杆正下方)
}
if(!ammoCrate(p[0],p[1])) ammoCrate(p[0],p[1],true); } // 桥缘沙袋半径内会被互斥挡住, 兜底强放
else{
let ok=false, ox=0, oz=0;
for(let t=0;t<32&&!ok;t++){
const px=f.x+wr(-10,10), pz=f.z+wr(-10,10); // 巷战大屋(14×17)足迹可覆盖整个±8盘面, 需更大搜索圈
// ★2026-10-06 生成平衡批: 旧版"首个净位即落箱"天然偏向露天随机点。现在随机采样段的**判定谓词与
//   早退时机照旧** (freeSpot+propFree, wr() 消耗逐位一致 ⇒ 全局布景随机流零漂移), 但记下首个净位后
//   先不落箱 —— 由下面确定性环扫做"贴墙/贴掩体"优选, 分数显著更高才换位。
if(freeSpot(px,pz,0.5)&&propFree(px,pz,1.1)){ ok=true; ox=px; oz=pz; }
}
if(ok){
let bs=crateCoverScore(ox,oz), bx=ox, bz=oz;
for(let a=0;a<24;a++){
const ang=(a%8)*TAU/8, rr=1.5+Math.floor(a/8)*2.4; // 1.5/3.9/6.3m 三圈 × 8 方位
const cx2=f.x+Math.sin(ang)*rr, cz2=f.z+Math.cos(ang)*rr;
if(!freeSpot(cx2,cz2,0.5)||!propFree(cx2,cz2,1.1)) continue;
const s2=crateCoverScore(cx2,cz2);
if(s2>bs+0.3){ bs=s2; bx=cx2; bz=cz2; } // 显著更优才挪 (不为挪几厘米折腾既有布局)
}
ok=ammoCrate(bx,bz);
}
// 兜底: 方向环扫描(不消耗随机数), 只在 freeSpot 通过处强放——绕过道具互斥但不绕过建筑
if(!ok)for(let a=0;a<48;a++){
const ang=(a%16)*TAU/16, rr=3+Math.floor(a/16)*3;
const px=f.x+Math.sin(ang)*rr, pz=f.z+Math.cos(ang)*rr;
if(freeSpot(px,pz,0.5)){ ammoCrate(px,pz,true); break; }
}
}
});
// 基地弹药箱 (通用): rr=0 即原位 (与旧版逐位一致 —— 其他战役布局指纹零漂移的前提); 被灌木/道具
// 占位时沿环向外扫找净位 (不越过建筑足迹), 全部失败才强放 (保证每个基地必有弹药箱)。
// (2026-11-10: 旧 deckIdx/capDeckWorldY 甲板底高账随珊瑚海/铁底湾下架摘除 —— 全部旗/基地箱走地面高)
const ammoAt=(x,z)=>{
for(let a=0;a<40;a++){
const ang=(a%10)*TAU/10, rr=a<10?0:(3+Math.floor((a-10)/10)*3);
const px=x+Math.sin(ang)*rr, pz=z+Math.cos(ang)*rr;
if(freeSpot(px,pz,0.5)&&ammoCrate(px,pz,false)) return true;
}
return ammoCrate(x,z,true);
};
if(BASES.length){
ammoAt(BASES[0].x+(BASES[0].x<0?3:-3),BASES[0].z+3);
ammoAt(BASES[1].x+(BASES[1].x<0?3:-3),BASES[1].z-3);
}
// ══════════════════════════════════════════════════════════════════════════════
// 固定火力点模型单源 (2026-09-21B §3 翻新批, owner: firepoints) —— 05c 尾段, 供本文件 mg42() 与
// 17-emplacements.atGun() 共用 (index.html 载入序 05c < 17, 函数声明跨脚本可见)。
// 本段只有 function、没有一个顶层 const: 本文件 :2419 的 buildWorld() 在**本段之前**执行, 其中就会
// 调用 mg42 —— const/let 会 TDZ 崩掉整局构建, function 声明才提升。
// 自检 dev/_firepoint-selfcheck.js 从下面首行标记整段切出, 沙箱里跑的就是这段源码本身 (不是副本)。
// ══════════════════════════════════════════════════════════════════════════════
// 阵营涂装色 (单源, 别处不写): 六阵营各取 00-config 既有配色的邻近值 —— 用户口径"日军深绿灰 / 美军
// 橄榄褐"。材质 color 决定色相, TEX.steelPlate/stencil/canvas 只给明度结构 (02-scene 白底口径)。
function fpPaintOf(fac){
switch(fac){
case 'us': return 0x5c6b47;   // 美军橄榄褐 (00-config:1082 海战 col)
case 'ger': return 0x545a50;  // 德军灰绿 (00-config:962 四号坦克 col)
case 'sov': return 0x4f5c40;  // 苏军 4BO 绿 (00-config:976 T-34/76 col)
case 'kmt': return 0x5c6858;  // 国军灰绿 (00-config:1004 维克斯 col)
case 'cpc': return 0x6d7268;  // 八路灰绿 (00-config:1018 缴获九七式 col)
default:    return 0x4a5240;  // 日军深绿灰 (05b:429 舰体 wkPaint 缺省档)
}
}
// 分件材质: 复用 05b:418 wkMat 的 (role|tint|uvRef) 缓存 —— 不新造材质体系, 同档跨炮共享一个实例。
// uvRef = 米/张贴图 (与 02-scene 挂给 MAT 的是同一把尺): 钢板 1.6 / 编号喷涂 2.0 / 帆布 0.9 / 混凝土 1.4
function fpPlateMat(fac){ return wkMat('fpPlate',fpPaintOf(fac),TEX.steelPlate,1.6); }
function fpStencilMat(fac){ return wkMat('fpStencil',fpPaintOf(fac),TEX.stencil,2.0); }
function fpClothMat(fac){ return wkMat('fpCloth',fpPaintOf(fac),TEX.canvas,0.9); }
function fpConcreteMat(){ return wkMat('fpConcrete',0x8a8378,TEX.concrete,1.4); } // 0x8a8378 = MAT.rubble 既有混凝土灰
// 加一件: 统一走 uvGeo 归一贴图密度 (05-world:49); nm = 件名 (自检/控制台定位"哪一件浮空"靠它)
function fpAdd(parent,geo,mat,px,py,pz,rx,ry,rz,nm){
const m=new THREE.Mesh(uvGeo(geo,mat),mat);
m.position.set(px,py,pz);
if(rx||ry||rz) m.rotation.set(rx||0,ry||0,rz||0);
if(nm) m.name=nm;
parent.add(m); return m;
}
// 两点间方梁/圆杆: 长 = |AB| 现算, 轴线对齐 A→B —— 手写"位置 + 倾角"两个字面量最容易对不上账
// (20260921B §2 迫击炮两脚架"腿顶没接上炮箍"就是这么来的), 所以腿/大架一律只给两端点。
function fpBar(parent,mat,ax,ay,az,bx,by,bz,w,h,nm){
const dx=bx-ax,dy=by-ay,dz=bz-az,L=Math.hypot(dx,dy,dz);
const m=new THREE.Mesh(uvGeo(boxGeo(w,h,L),mat),mat);
m.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(dx/L,dy/L,dz/L));
m.position.set((ax+bx)/2,(ay+by)/2,(az+bz)/2);
if(nm) m.name=nm;
parent.add(m); return m;
}
function fpRod(parent,mat,ax,ay,az,bx,by,bz,r,nm){
const dx=bx-ax,dy=by-ay,dz=bz-az,L=Math.hypot(dx,dy,dz);
const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,L,6),mat);
m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(dx/L,dy/L,dz/L));
m.position.set((ax+bx)/2,(ay+by)/2,(az+bz)/2);
if(nm) m.name=nm;
parent.add(m); return m;
}

function mgDefOfTeam(team){ return FACTION_MG[CAMPAIGN.f[team]]||FACTION_MG.ger; }
// ══════════════════════════════════════════════════════════════════════════════
// 重机枪位 (2026-09-21B §3 翻新): 旧版 5~6 件平色 (枪管/套筒/机匣/防盾 + 一根单柱当三脚架) ⇒ 用户实机
// "除反舰炮台外大部分固定火力点建模和材质太简陋"。现版 16 件: 真三脚架 (3 腿 + 架头 + 混凝土底座) +
// 机匣/枪管/散热套 + 防盾 + 提把/握把 + 表尺/瞄准具 + 弹链箱与帆布袋。
// 承力链 (自检逐件量测): 地面→底座→三条腿→架头→机匣→枪管/防盾; 无浮件、非薄片件嵌合 ≥0.06m。
// 局部系: 原点 = 枪位中心 1.0m 高 (grp.position.y = fit.y+1.0), +z = face, 地面 = y-1.0。
// 开火点对齐 (13-combat.emplMGFire:140): eye = 枪位 + (0, EMPL_MG_EYE=0.12, 0)、枪口 = eye + dir*1.35
//   ⇒ 本模型枪管中线 = 局部 y 0.12、枪口 = 局部 z 1.35 —— 与常量同源, 改这里必须同步改常量。
// 契约 (一行不动): grp 落位/朝向、yaw/pitch 两级组、MG42S 条目字段、propTake 2.3、前沙袋墙落位。
// ══════════════════════════════════════════════════════════════════════════════
function mg42(x,z,face,team){
if(team===undefined||team===null) team=x<0?0:1;
// 落点互斥: 机枪+机座+前掩护墙整机登记一个占位圈(墙尖距中心2.15m); 被占贴边外推, 无净位则放弃
const po=propFree(x,z,2.3)?[x,z]:propPushOut(x,z,2.3);
if(!po) return;
x=po[0]; z=po[1];
const def=mgDefOfTeam(team);
const g0=heightAt(x,z);
// 掩护矮墙: 横向挡在机枪正前方 (沙袋墙沿垂直于射向的方向延展)
// 降到0.5m高: 低于枪管(1m), 俯射不再被自家沙袋挡弹, 仍可为枪手挡低弹道
	sandbagWall(x+Math.sin(face)*1.1, z+Math.cos(face)*1.1, 3, face, 0.5, false);
	const fit=groundFit(x,z,face,1.0,1.0);
	const grp=new THREE.Group();
	grp.position.set(x,fit.y+1.0,z);
	grp.rotation.order='YXZ';
	grp.rotation.set(fit.pitch,face,fit.roll);
const yaw=new THREE.Group(); grp.add(yaw);
const pitch=new THREE.Group(); yaw.add(pitch);
const fac=(CAMPAIGN.f&&CAMPAIGN.f[team])||'ger'; // 涂装档随阵营 (口径 §3: 日军深绿灰 / 美军橄榄褐)
const AY=0.12, MZ=1.35, GY=-1.0;                  // 枪管中线高 / 枪口前移 (对上 13-combat 常量) / 局部地面高
// ── 架座 (不随 yaw 转): 混凝土底座 (底面贴地) + 架头 + 三条腿 (腿脚沉进底座 0.08, 不许悬空) ──
fpAdd(grp,new THREE.CylinderGeometry(0.62,0.62,0.18,12),fpConcreteMat(),0,GY+0.09,0,0,0,0,'mgBase');
fpAdd(grp,new THREE.BoxGeometry(0.24,0.28,0.30),MAT.metalDark,0,-0.06,-0.05,0,0,0,'mgTripodHead');
fpRod(grp,fpPlateMat(fac),0,-0.14,0.02, 0,GY+0.10,0.55, 0.032,'mgLegF');            // 前腿 (向前张开)
fpRod(grp,fpPlateMat(fac),-0.04,-0.14,-0.08, -0.44,GY+0.10,-0.36, 0.032,'mgLegL');  // 左后腿
fpRod(grp,fpPlateMat(fac), 0.04,-0.14,-0.08,  0.44,GY+0.10,-0.36, 0.032,'mgLegR');  // 右后腿
// ── 弹链箱 + 帆布弹袋 (挂在架头左前, 与架头正体积相交 0.08) ──
fpAdd(grp,new THREE.BoxGeometry(0.26,0.20,0.22),MAT.metalDark,-0.14,-0.22,0.02,0,0,0,'mgAmmoBox');
fpAdd(grp,new THREE.BoxGeometry(0.20,0.26,0.16),fpClothMat(fac),-0.30,-0.36,0.02,0,0,0,'mgBeltBag');
// ── 枪身 (随 yaw/pitch 俯仰): 机匣 + 枪管 ──
fpAdd(pitch,new THREE.BoxGeometry(0.16,0.24,0.78),MAT.metalDark,0,0.10,-0.10,0,0,0,'mgReceiver');
fpAdd(pitch,new THREE.CylinderGeometry(0.032,0.032,1.15,8),MAT.metalDark,0,AY,0.775,HPI,0,0,'mgBarrel'); // 枪管: 后端进机匣 0.09
fpAdd(pitch,new THREE.CylinderGeometry(0.050,0.050,0.09,8),MAT.metalDark,0,AY,MZ-0.07,HPI,0,0,'mgMuzzleRing'); // 枪口箍 (前缘 = MZ)
// 散热套三档 (def.style, 见 FACTION_MG:1952): 各阵营共用本函数, 这是"一眼认得出哪国机枪"的唯一线索
if(def.style==='water'){        // 水冷套 (马克沁 M1910 / 二四式)
fpAdd(pitch,new THREE.CylinderGeometry(0.085,0.085,0.62,10),MAT.metal,0,AY,0.62,HPI,0,0,'mgJacket');
}else if(def.style==='air'){    // 风冷散热套 (M1919A4)
fpAdd(pitch,new THREE.CylinderGeometry(0.055,0.055,0.70,8),MAT.metalDark,0,AY,0.66,HPI,0,0,'mgJacket');
}else if(def.style==='92'){     // 九二式: 左侧供弹保弹板匣
fpAdd(pitch,new THREE.BoxGeometry(0.30,0.10,0.24),MAT.metalDark,-0.15,0.14,0.12,0,0,0,'mgHopper');
}else{                          // MG42 (德): 短散热筒 (枪管前段裸露 —— 换管特征)
fpAdd(pitch,new THREE.CylinderGeometry(0.048,0.048,0.42,10),MAT.metal,0,AY,0.58,HPI,0,0,'mgJacket');
}
// ── 防盾 (随枪身俯仰): 枪管从盾面穿出 (与旧版同款"枪口支出盾面", 面 0.90×0.55) ──
fpAdd(pitch,new THREE.BoxGeometry(0.90,0.55,0.07),fpPlateMat(fac),0,0.10,0.40,0,0,0,'mgShield');
// ── 表尺 / 瞄准具 / 提把 / 握把: 机匣上的操作用件, 每件与机匣正体积相交 ≥0.07 ──
fpAdd(pitch,new THREE.BoxGeometry(0.10,0.08,0.08),MAT.metalDark,0,0.19,-0.30,0,0,0,'mgRearSight');
fpAdd(pitch,new THREE.BoxGeometry(0.10,0.12,0.24),MAT.metalDark,-0.06,0.20,-0.04,0,0,0,'mgSight');
fpAdd(pitch,new THREE.BoxGeometry(0.10,0.08,0.30),MAT.metalDark,0.05,0.19,-0.05,0,0,0,'mgCarryHandle');
fpAdd(pitch,new THREE.BoxGeometry(0.08,0.20,0.10),MAT.metalDark,0,-0.01,-0.34,0,0,0,'mgGrip');
grp.traverse(o=>{ o.castShadow=true; });
world.add(grp);
propTake(x,z,2.3); // 机枪整机+掩护墙占位 (机枪无碰撞盒, 靠该登记让后续放置避开)
MG42S.push({x,z,y:g0+1.0,face,grp,yaw,pitch,user:null,heat:0,fireT:0,cdLock:0,muzzle:V3(),def,team});
}
