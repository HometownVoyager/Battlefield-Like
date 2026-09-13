// ─────────────────────────────────────────────
// 05c-layouts.js —— 各战役布局/大桥/世界组装 (buildWorld/旗帜/弹药箱/MG42)
// 2026-08-24 由 05-world.js 切分: 原第 966-1510 行
// ═══════════ 各战役独立布局 (建筑经选址校验, 道具避让建筑足迹) ═══════════
// 围田树篱段中心记录 (诺曼底博卡日): 供沙箱断言"旗点净空"——围田树篱不得侵入旗点圈
const RURAL_HEDGES=[]; // 树篱点位登记: 仅沙箱断言读 (verify-layouts 树篱覆盖检查)
// -- 诺曼底: 乡村田园 --
function layoutRural(){
let p;
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
const atkB=CAMPAIGN.bases[ATK]||basePos(ATK);
for(const f of CAMPAIGN.flags){
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
{ const p=placeAt(-68,30,0,11.5,21.6,{maxDh:1.6}); if(p) buildChurch(p.x,p.z,p.ry); }
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
railFlatcar(-208,140,0.03); railFlatcar(-188,156,-0.04);
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
defWorks(1);
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
if(roadDist(px,pz)<5||inRiverChannel(px,pz)||!freeSpot(px,pz,1.2)) continue;
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
railFlatcar(L.rail.x0+28,L.rail.z0+3,0.04);
railFlatcar((L.rail.x0+L.rail.x1)/2-58,(L.rail.z0+L.rail.z1)/2+2,-0.03);
railFlatcar(L.rail.x1-30,L.rail.z1+2,0.05);
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
if(freeSpot(sp.x-6,sp.z-2,2)) sandbagWall(sp.x-6,sp.z-2,0);
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
{ const px=f.x+3, pz=f.z+3; if(freeSpot(px,pz,1)) barrel(px,pz); };
{ const px=f.x+4.2, pz=f.z+2.2; if(freeSpot(px,pz,1)) barrel(px,pz); };
if(i%2===0){ p=placeBuild(f.x,f.z,12,6,5); if(p) cnHouse(p.x,p.z,p.ry,6,5); }
});
for(let i=0;i<8;i++) fallenLog(wr(-110,110),wr(-110,110),wr(0,Math.PI));
crater(-12,14,2.0); crater(18,26,1.8);
}
// -- 原始密林 (胡康河谷) : 640 大图巨桥改版 (2026-09-12) —— 主题=大龙河大桥 (grandBridge, buildWorld 分派),
//    本函数布两岸旗点营地/村寨/桥头工事/徒涉滩渡口/基地加建, 植被范围随 MAP_SIZE --
// 大龙河大桥: 桥面高度由 heightAt 的 BRIDGES 矩形提供, 结构=grandBridge (木排架 buildBridge 保留为通用后备)
// bridgePt(u,v): 桥局部坐标转世界 (u=沿桥轴向(sin,cos), v=垂直桥向(cos,-sin))
function bridgePt(u,v){
const B=BRIDGE;
return [B.x+u*Math.sin(B.yaw)+v*Math.cos(B.yaw), B.z+u*Math.cos(B.yaw)-v*Math.sin(B.yaw)];
}
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
if(pB) bunker(pB.x,pB.z,Math.atan2(-sgn*100,30));
placeTower(b.x-sgn*10,b.z-18);
const pT=placeAt(b.x+sgn*6,b.z-14,0.3,6,5,{maxDh:1.2}); if(pT) tent(pT.x,pT.z,pT.ry);
if(freeSpot(b.x+sgn*18,b.z+8,1.5)) hedgehog(b.x+sgn*18,b.z+8);
});
// 密林植被散布: 道路/旗点平整区/河道/建筑足迹让开, 其余区域竹丛+蕨类封闭 (640 大图按面积增量)
const spotOK=(x,z,flatK)=>{
if(roadDist(x,z)<6) return false;
if(inRiverChannel(x,z)) return false;
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
// -- 草原遭遇战 (steppe): 无旗点, 开阔波地稀疏掩体 --
function layoutSteppe(){
// 农耕掩体稀疏分布: 谷仓/木棚/草垛/干井/电话线杆, 全图无密集房群
{ const p=placeAt(-52,-74,0.2,9.5,13.5); buildBarn(p.x,p.z,p.ry); }
{ const p=placeAt(58,-46,-0.4,9.5,13.5); buildBarn(p.x,p.z,p.ry); }
{ const p=placeAt(14,60,0.1,6,5); logCabin(p.x,p.z,p.ry); }
{ const p=placeAt(-96,-36,0.3,6,5); logCabin(p.x,p.z,p.ry); }
{ const p=placeAt(76,30,-0.2,6,5); logCabin(p.x,p.z,p.ry); }
{ const p=placeAt(-6,-60,0.5,6,5); logCabin(p.x,p.z,p.ry); }
// 草垛散点 (倒地圆柱, 有碰撞+掩体位)
for(let i=0;i<12;i++){
const hx=wr(-115,115), hz=wr(-95,95);
if(roadDist(hx,hz)<8||!freeSpot(hx,hz,2)) continue;
const g0=heightAt(hx,hz);
const hA=heightAt(hx+0.8,hz), hB=heightAt(hx-0.8,hz);
const m=mesh(new THREE.CylinderGeometry(1.1,1.1,1.6,12),MAT.hay,hx,g0+1.1,hz);
m.quaternion.setFromUnitVectors(_UP,_N.set(1,(hA-hB)/1.6,0).normalize());
CYLS.push({x:hx,z:hz,r:1.15,y0:g0,y1:g0+2.2}); coverPoints.push({x:hx,z:hz-2});
}
// 一线散兵坑: 双方各两个沙袋窝 (靠近中线, 遇战一线)
const sd=CAMPAIGN.spawns||[];
for(const sp of [sd[1],sd[2]]){
if(!sp) continue;
if(freeSpot(sp.x+4,sp.z-3,2)) sandbagWall(sp.x+4,sp.z-3,4,wr(0,3));
if(freeSpot(sp.x-4,sp.z+3,2)) sandbagWall(sp.x-4,sp.z+3,4,wr(0,3));
if(freeSpot(sp.x,sp.z+6,1.5)) crate(sp.x,sp.z+6,1.2,wr(0,3));
if(freeSpot(sp.x,sp.z-7,1)) barrel(sp.x,sp.z-7);
}
// 弹坑/枯树/拒马: 中线遭遇带零散
crater(-22,-12,2.4); crater(18,16,2.2); crater(-46,34,2.0); crater(44,-8,2.3);
for(let i=0;i<6;i++){
const x=wr(-90,90), z=wr(-70,70);
if(roadDist(x,z)<8||!freeSpot(x,z,1.5)) continue;
if(i%2) deadTree(x,z); else hedgehog(x,z);
}
// 电话线杆: 沿公路缓坡每隔约26m
for(const r of CAMPAIGN.roads){
const ax=r[0],az=r[1],bx2=r[2],bz2=r[3];
const len=Math.hypot(bx2-ax,bz2-az)||1;
const nx=-(bz2-az)/len*3.2, nz=(bx2-ax)/len*3.2;
for(let u=10;u<len;u+=26){
const x=ax+(bx2-ax)*u/len+nx, z=az+(bz2-az)*u/len+nz;
if(inRiverChannel(x,z)) continue;
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
const pC=placeAt(V.x-13,V.z-10,0.15,11.5,21.6,{maxDh:1.6});
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
const VR=WD.ravine.ramps[0];
for(const ez of [VR.z0+4,VR.z1-4]){
if(freeSpot(VR.x-6,ez,1.2)) crate(VR.x-6,ez,1.2,wr(0,3));
if(freeSpot(VR.x+6,ez,1)) barrel(VR.x+6,ez);
}
for(const ir of [WD.ravine.ramps[1],WD.ravine.ramps[2]]){
if(freeSpot(ir.x-5,ir.z0+3,1.1)) crate(ir.x-5,ir.z0+3,1.1,0);
if(freeSpot(ir.x+5,ir.z1-3,1.1)) crate(ir.x+5,ir.z1-3,1.1,0);
}
}
// ── ④ 旗点营地 (7 旗): 按归属分侧 —— 德据点=机枪+沙袋环, 美出发旗=帐篷轻工事, 中立=环形掩体 ──
CAMPAIGN.flags.forEach(f=>{
const own=(f.own===undefined)?-1:f.own;
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
}else if(own===1){
// 其余德军据点 (岭上村): 机枪+沙袋环+杂物
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
if(pB) bunker(pB.x,pB.z,Math.atan2(-sgn*100,30));
placeTower(b.x-sgn*10,b.z-18);
const pT=placeAt(b.x+sgn*6,b.z-14,0.3,6,5,{maxDh:1.2}); if(pT) tent(pT.x,pT.z,pT.ry);
if(freeSpot(b.x+sgn*18,b.z+8,1.5)) hedgehog(b.x+sgn*18,b.z+8);
});
}
// -- 断崖公路劫道 (canyon): 伏击山谷 —— 谷底走廊, 两侧山坡中高处为伏击带,
//    无基地、无固定火力点、无建筑: 纯自然坡体掩体 (乱石/枯树/倒木/沙袋窝) --
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
{ const p=placeAt(-215,50,0,11.5,21.6,{maxDh:1.6}); if(p) buildChurch(p.x,p.z,p.ry); }
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
railFlatcar(14,158,0.02); railFlatcar(56,174,-0.03); railFlatcar(-2,166,0.05);
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
for(let z=-70;z<=-16;z+=6){ if(freeSpot(118,z,1.8)) dragonTooth(118,z,0); }
for(let z=30;z<=84;z+=6){ if(freeSpot(118,z,1.8)) dragonTooth(118,z,0); }
for(let z=-64;z<=-22;z+=12){ if(freeSpot(121,z,1.8)) dragonTooth(121,z,0); } // 第二排交错
for(let z=36;z<=78;z+=12){ if(freeSpot(121,z,1.8)) dragonTooth(121,z,0); }
bunker(118,-45,HPI); // 机枪堡面东 (封锁北段缺口侧翼)
bunker(118,57,HPI);  // 南段
sandbagWall(112,-28,4,HPI); sandbagWall(112,44,4,HPI); sandbagWall(112,72,4,HPI);
crater(110,-10,2.2); crater(112,20,2.0); crater(126,-40,2.1); crater(124,64,2.0);
// ── 街块围合 + 庭院填充 (城网加密) ──
moscowBlockWalls();
moscowCourtyards();
// ── 城市街景 + 守方(苏军)工事模板 ──
cityDressing(true,{x0:-300,z0:-230,x1:100,z1:230});
defWorks(0);
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
us: { name:'M1919A4 勃朗宁重机枪', rpm:520, dmg:29, heatPS:0.011, style:'air' },
ger:{ name:'MG42 通用机枪',        rpm:1100,dmg:25, heatPS:0.014, style:'mg42' },
sov:{ name:'马克沁 M1910 重机枪',  rpm:560, dmg:29, heatPS:0.006, style:'water' },
kmt:{ name:'二四式重机枪',         rpm:480, dmg:30, heatPS:0.006, style:'water' },
cpc:{ name:'二四式重机枪(缴获)',   rpm:460, dmg:30, heatPS:0.006, style:'water' },
jp: { name:'九二式重机枪',         rpm:440, dmg:32, heatPS:0.009, style:'92' },
};
// 活树/倒树记录已由 tree() 直接登记进 04b-fire 的 TREE_LIVE (旧 TREES/fTrees 表废弃)
// 山地大图(treeQ 主题)树木数量随画质缩放: 低 60% / 中 85% / 高 100% (与草丛按画质缩放同思路, 保低配帧率)
function treeQMul(){ return THEME.treeQ?(SETTINGS.quality===0?0.6:(SETTINGS.quality===1?0.85:1)):1; }
function buildWorld(){
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
		case 'canyon': layoutCanyon(); break;
		default: layoutRural(); break;
	}
// 大桥 (胡康=木排架; 淞沪=石拱×2): 按桥型分派
// 莫斯科冰河水面在 buildWorld 通用 RIVER 分支渲染 (ice=true); 编组站调车线由 layoutMoscow 铺设
if(BRIDGES.length){
for(const B of BRIDGES){
if(CAMPAIGN.id==='songhu'||B.kind==='stone') stoneBridge(B);
else if(B.kind==='grand') grandBridge(B); // 胡康大龙河大桥 (2026-09-12 巨桥改版)
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
CAMPAIGN.bases.forEach((b,t)=>{
const sgn=b.x<0?1:-1;
tent(b.x+sgn*2,b.z+6,0.3); tent(b.x,b.z-6,-0.2); tent(b.x-sgn*4,b.z,0);
sandbagWall(b.x+sgn*10,b.z+6,5,HPI); sandbagWall(b.x+sgn*10,b.z-6,5,HPI); sandbagWall(b.x+sgn*8,b.z,5,HPI);
crate(b.x+sgn*4,b.z+10,1.3,0); barrel(b.x+sgn*5,b.z-9);
});
decorateTrenches();
// 河流水面/冰面: 沿河道中心线的连续条带网格 (主河 + 淞沪支流汊港共用同一渲染器)。
// 水位按折线逐采样点取值 (岸高-落差), 再做滑动平均平滑, 相邻采样点线性插值。
function _waterStrip(P,w,ice,d){
const wmat=ice
?new THREE.MeshLambertMaterial({color:0xcfe2ee,map:TEX.ice})
:new THREE.MeshLambertMaterial({color:0x3e5a6a,transparent:true,opacity:0.72,map:TEX.water});
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
samples.push({x:ax+dx*tc,z:az+dz*tc,nx,nz});
}
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
s.wy=clamp(s.wy,bed+0.1,s.bank-0.15);
}
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
wmesh.renderOrder=1;
scene.add(wmesh);
}
if(RIVER) _waterStrip(RIVER.pts,RIVER.w,RIVER.ice,RIVER.d||1.9);
// 淞沪支流汊港: 浅水条带 (无冰, d=语义表)
if(DELTA_CHANS.length){
for(const ch of DELTA_CHANS) _waterStrip(ch,DELTA.w||3.4,false,DELTA.d||1.35);
}
// 鱼塘/藕塘水面: 圆盘网格 (藕塘偏绿浮叶色, 鱼塘青蓝)
if(CAMPAIGN.delta&&CAMPAIGN.delta.ponds){
const pmatLotus=new THREE.MeshLambertMaterial({color:0x4a6a3a,transparent:true,opacity:0.78,map:TEX.water});
const pmatFish=new THREE.MeshLambertMaterial({color:0x3e5a6a,transparent:true,opacity:0.72,map:TEX.water});
for(const pd of CAMPAIGN.delta.ponds){
const g0=heightAt(pd.x,pd.z,true);
const bank=Math.min(
heightAt(pd.x+pd.r*0.92,pd.z,true), heightAt(pd.x-pd.r*0.92,pd.z,true),
heightAt(pd.x,pd.z+pd.r*0.92,true), heightAt(pd.x,pd.z-pd.r*0.92,true));
const wy=clamp(bank-0.12, g0+0.08, bank-0.05);
const disc=new THREE.Mesh(new THREE.CircleGeometry(pd.r*0.92,16), pd.t==='lotus'?pmatLotus:pmatFish);
disc.position.set(pd.x,wy,pd.z);
disc.rotation.x=-HPI;
disc.renderOrder=1;
scene.add(disc);
}
}
// 树木/枯树散布 (避开道路/平整区/河道/建筑足迹/裸岩带; 边界随地图尺寸; treeQ 主题按画质缩放)
	const treeSpots=[];
		const TR=MAP_SIZE/2-8;
	for(let i=0,n=Math.round(THEME.treeN*treeQMul());i<n;i++){
	const x=wr(-TR,TR), z=wr(-TR,TR);
	if(roadDist(x,z)<7) continue;
	if(inRiverChannel(x,z)) continue;
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
const grassCount=Math.round((SETTINGS.quality===0?480:(SETTINGS.quality===1?1050:1850))*THEME.grassMul);
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
for(let i=0;i<grassCount;i++){
	let x=wr(-TR3,TR3),z=wr(-TR3,TR3);
	if(roadDist(x,z)<4){ x+=8; }
	if(CITY&&cityUrban(x,z)){ // 城市组: 街道+街块+厂区全域不生草丛 (建成区=瓦砾压实土)
		inst.setMatrixAt(i,hideDummy());
		continue;
	}
	if(inRiverChannel(x,z)||!freeSpot(x,z,0)){
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
}
buildWorld();
const FLAGS=CAMPAIGN.flags.map(f=>({id:f.id,x:f.x,z:f.z,r:f.r,own:f.own,owner:-1,cap:0,capTeam:-1}));
const BASES=CAMPAIGN.bases.map(b=>({x:b.x,z:b.z}));
FLAGS.forEach(f=>{
const g0=heightAt(f.x,f.z);
const pole=mesh(new THREE.CylinderGeometry(0.07,0.09,7,8),MAT.metal,f.x,g0+3.5,f.z);
CYLS.push({x:f.x,z:f.z,r:0.15,y0:g0,y1:g0+7});
const flagC=document.createElement('canvas'); flagC.width=64; flagC.height=40;
f.flagCtx=flagC.getContext('2d');
f.flagTex=new THREE.CanvasTexture(flagC);
// 旗面: 几何原点平移到挂边(杆侧) —— 摆动绕杆缘铰接, 不再绕旗面中垂线旋转; 分段网格供 21-match 布料涟漪
// 挂边贴杆面(x+0.075), 满旗时旗顶(6.25+0.75)与杆顶(g0+7)平齐
const fg=new THREE.PlaneGeometry(2.4,1.5,8,4);
fg.translate(1.2,0,0);
f.flagGeo=fg; f.flagBase=Float32Array.from(fg.attributes.position.array);
const fm=new THREE.Mesh(fg, new THREE.MeshLambertMaterial({map:f.flagTex,side:THREE.DoubleSide}));
fm.position.set(f.x+0.075,g0+6.25,f.z);
world.add(fm);
f.flagMesh=fm; f.poleTop=g0+6.25; f.gy=g0;
drawFlagTex(f);
});
function drawFlagTex(f){
const g=f.flagCtx;
if(f.owner===0){ g.textAlign='start'; g.fillStyle=TEAM_FACTION[0].flagBg; g.fillRect(0,0,64,40); g.fillStyle='#fff'; g.font='bold 26px sans-serif'; g.fillText(TEAM_FACTION[0].sym,20,31); }
else if(f.owner===1){ g.textAlign='start'; g.fillStyle=TEAM_FACTION[1].flagBg; g.fillRect(0,0,64,40); g.fillStyle='#eee'; g.font='bold 26px sans-serif'; g.fillText(TEAM_FACTION[1].sym,20,31); }
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
function ammoCrate(x,z,force){
// force=true 兜底: 绕过道具互斥直接放 (保证每旗/每基地必有弹药箱), 但仍登记占位防后续叠压
if(!force&&!propFree(x,z,1.1)) return false;
propTake(x,z,1.1);
	const g0=heightAt(x,z);
	const ry=wr(0,3);
	const m=solidBox(MAT.woodDark,1.1,0.7,0.8,x,g0+0.35,z,ry);
	const fit=groundFit(x,z,ry,0.55,0.4);
	applyFit(m,ry,fit);
	const lid=mesh(boxGeo(1.15,0.08,0.85),MAT.wood,x,fit.y+0.74,z,m.rotation.y);
	applyFit(lid,m.rotation.y,fit);
	AMMO_CRATES.push({x,z,y:g0});
return true;
}
// 弹药箱: 每个旗点与基地附近 (通用, 避让建筑足迹); 大桥旗点固定放在桥面上, 避免落进河谷
FLAGS.forEach(f=>{
if(BRIDGE&&onBridge(f.x,f.z,4)){ const p=bridgePt(-4,1.4); if(!ammoCrate(p[0],p[1])) ammoCrate(p[0],p[1],true); } // 桥缘沙袋半径内会被互斥挡住, 兜底强放
else{
let ok=false;
for(let t=0;t<32&&!ok;t++){
const px=f.x+wr(-10,10), pz=f.z+wr(-10,10); // 巷战大屋(14×17)足迹可覆盖整个±8盘面, 需更大搜索圈
if(freeSpot(px,pz,0.5)) ok=ammoCrate(px,pz); // 必须在建筑足迹外(门窗通行区)
}
// 兜底: 方向环扫描(不消耗随机数), 只在 freeSpot 通过处强放——绕过道具互斥但不绕过建筑
if(!ok)for(let a=0;a<48;a++){
const ang=(a%16)*TAU/16, rr=3+Math.floor(a/16)*3;
const px=f.x+Math.sin(ang)*rr, pz=f.z+Math.cos(ang)*rr;
if(freeSpot(px,pz,0.5)){ ammoCrate(px,pz,true); break; }
}
}
});
if(BASES.length){
if(!ammoCrate(BASES[0].x+(BASES[0].x<0?3:-3),BASES[0].z+3)) ammoCrate(BASES[0].x+(BASES[0].x<0?3:-3),BASES[0].z+3,true);
if(!ammoCrate(BASES[1].x+(BASES[1].x<0?3:-3),BASES[1].z-3)) ammoCrate(BASES[1].x+(BASES[1].x<0?3:-3),BASES[1].z-3,true);
}
function mgDefOfTeam(team){ return FACTION_MG[CAMPAIGN.f[team]]||FACTION_MG.ger; }
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
const barrel=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.06,1.3,8),MAT.metalDark);
barrel.rotation.x=HPI; barrel.position.z=0.65; pitch.add(barrel);
if(def.style==='water'){
// 水冷套筒 (马克沁/二四式): 后端嵌入机匣前脸, 避免两者间露出细颈断缝
const jacket=new THREE.Mesh(new THREE.CylinderGeometry(0.085,0.085,0.62,10),MAT.metal);
jacket.rotation.x=HPI; jacket.position.z=0.62; pitch.add(jacket);
} else if(def.style==='air'){
// 风冷散热套筒 (M1919)
const jacket=new THREE.Mesh(new THREE.CylinderGeometry(0.062,0.062,0.7,8),MAT.metalDark);
jacket.rotation.x=HPI; jacket.position.z=0.6; pitch.add(jacket);
} else if(def.style==='92'){
// 九二式: 左侧供弹保弹板匣
const hopper=new THREE.Mesh(boxGeo(0.3,0.1,0.22),MAT.metalDark);
hopper.position.set(-0.2,0.02,0.05); pitch.add(hopper);
}
const body=new THREE.Mesh(boxGeo(0.14,0.2,0.75),MAT.metalDark);
body.position.z=0.0; pitch.add(body);
const shield=new THREE.Mesh(boxGeo(0.9,0.55,0.05),MAT.metal);
shield.position.set(0,0.05,0.35); pitch.add(shield);
const tripod1=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,1.0,6),MAT.metalDark);
tripod1.position.set(0,-0.5,0); grp.add(tripod1);
grp.traverse(o=>{ o.castShadow=true; });
world.add(grp);
propTake(x,z,2.3); // 机枪整机+掩护墙占位 (机枪无碰撞盒, 靠该登记让后续放置避开)
MG42S.push({x,z,y:g0+1.0,face,grp,yaw,pitch,user:null,heat:0,fireT:0,cdLock:0,muzzle:V3(),def,team});
}
