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
function cityBlockRows(heavy){
const ct=CAMPAIGN.city; if(!ct) return;
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
const n=Math.max(1,Math.round(len/16)); // 间距 16 > 最大楼宽 11.5+抖动 —— 同排建筑不相交
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
function cityDressing(heavy){
const ct=CAMPAIGN.city;
// 纵街街口的钢轨街垒线 (可绕不可碾 —— 街道路喉)
for(const s of ct.streets){
const cx=(s.x0+s.x1)/2;
if(s.x1-s.x0<s.z1-s.z0){ // 纵街: 沿 z 每隔一段
for(let z=s.z0+14;z<s.z1-10;z+=wr(20,30)){
if(wr(0,1)<0.42) continue;
railBarricade(cx+wr(-2,2),z,wr(0,1)<0.5?0:HPI);
}
}else{ // 横街: 沿 x
for(let x=s.x0+16;x<s.x1-12;x+=wr(22,32)){
if(wr(0,1)<0.42) continue;
railBarricade(x,(s.z0+s.z1)/2+wr(-2,2),wr(0,1)<0.5?0:HPI);
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
// -- 城市组·斯大林格勒 (2026-09-05): 电车大街 + 红十月工厂区 + 沿街公寓残骸 --
// 五旗各有性格: A 西站街区 / B 公寓街块 / C 电车广场 / D 红十月工厂(地标) / E 东侧街区
function layoutStalingrad(){
cityBlockRows(false);
redOctober(90,-38,0); // 红十月工厂区 (D 旗东北, 围墙厂区 42×62)
// 电车大街 (主街 z15): 轨道+线杆+两节残骸 (可进入车厢)
tramRails(-120,120,15);
tramWreck(-56,14.8,HPI+0.06);
tramWreck(38,15.2,HPI-0.05);
// 烧毁坦克残骸: B 旗街口 / E 旗街区
tankWreck(-30,-30,0.5);
tankWreck(78,44,-0.4);
cityDressing(false);
// 中央广场电车轨迹旁的瓦砾与弹坑 (街景)
crater(-4,26,2.2); crater(16,2,2.0); rubblePile(-14,30,2.0); rubblePile(24,-2,1.8);
}
// -- 城市组·柏林 (2026-09-05): 更荒芜的街垒之城 + 地铁口下沉广场 + 守方防御工事模板 --
// 四旗: A 西区 / B 地铁广场 / C 中央街口 / D 东区街垒网 (defSide=1 守方工事)
function layoutBerlin(){
cityBlockRows(true);
// 地铁广场 (B 旗西南路口): 下沉广场 + 街口入口亭
metroPavilion(-52,11.5,Math.PI);
if(freeSpot(-52,-6,1.2)) rubblePile(-52,-6,1.4); // 下沉广场底杂物
// 烧毁坦克残骸: C 旗路口 / D 旗东段
tankWreck(26,2,0.9);
tankWreck(60,-30,2.2);
cityDressing(true);
// 守方(德军)防御工事模板: 每旗西向路喉 街垒对+机枪+铁丝网
defWorks(1);
// 防火带瓦砾山 (街区之间的开阔瓦砾带)
for(const [rx,rz] of [[-78,-26],[2,34],[84,34],[-20,-58]]){
for(let i=0;i<3;i++){
const px=rx+wr(-4,4), pz=rz+wr(-4,4);
if(freeSpot(px,pz,2)) rubblePile(px,pz,wr(2.0,2.8));
}
}
}
// -- 江南水乡 (淞沪) --
function layoutDelta(){
CAMPAIGN.flags.forEach((f,i)=>{
let p=placeBuild(f.x,f.z,10,7,6);
if(p) cnHouse(p.x,p.z,p.ry,7,6);
p=placeBuild(f.x,f.z,10,6,5);
if(p) cnHouse(p.x,p.z,p.ry,6,5);
p=placeBuild(f.x,f.z,12,6,5);
if(p) cnHouse(p.x,p.z,p.ry,6,5);
if(i%2===0){ p=placeBuild(f.x,f.z,12,6,5); if(p) cnHouse(p.x,p.z,p.ry,6,5); }
stoneWall(f.x-12,f.z+12,f.x+2,f.z+14);
{ const px=f.x+wr(-6,6), pz=f.z+wr(-6,6); if(freeSpot(px,pz,2)) sandbagWall(px,pz, 4,wr(0,3)); };
{ const px=f.x+wr(-5,5), pz=f.z+wr(-5,5); if(freeSpot(px,pz,1.2)) crate(px,pz, 1.2,wr(0,3)); };
{ const px=f.x+wr(-6,6), pz=f.z+wr(-6,6); if(freeSpot(px,pz,1)) barrel(px,pz); };
{ const px=f.x+wr(-9,9), pz=f.z+wr(-9,9); if(freeSpot(px,pz,2)) crater(px,pz,2.0); };
});
{ const px=52, pz=-10; if(freeSpot(px,pz,1.5)) hedgehog(px,pz); };
{ const px=12, pz=10; if(freeSpot(px,pz,1.5)) hedgehog(px,pz); };
{ const px=-28, pz=-4; if(freeSpot(px,pz,1.5)) hedgehog(px,pz); };
{ const px=40, pz=10; if(freeSpot(px,pz,1.5)) deadTree(px,pz); };
{ const px=-2, pz=-32; if(freeSpot(px,pz,1.5)) deadTree(px,pz); };
{ const px=-44, pz=20; if(freeSpot(px,pz,1.5)) deadTree(px,pz); };
}
// -- 黄土沟壑 (百团) --
function layoutLoess(){
CAMPAIGN.flags.forEach((f,i)=>{
let p=placeBuild(f.x,f.z,13,6,5,{ring0:8}); // 破袭模式: 补给库占旗点中心, 房屋环绕于 8~13m 环带
if(p) cnHouse(p.x,p.z,p.ry,6,5);
p=placeBuild(f.x,f.z,13,6,5,{ring0:8});
if(p) cnHouse(p.x,p.z,p.ry,6,5);
if(i===1){ p=placeBuild(f.x,f.z,13,6,5,{ring0:8}); if(p) cnHouse(p.x,p.z,p.ry,6,5); }
stoneWall(f.x-11,f.z-9,f.x+3,f.z-12);
stoneWall(f.x+5,f.z+9,f.x+13,f.z+7);
{ const px=f.x+wr(-5,5), pz=f.z+wr(-5,5); if(freeSpot(px,pz,1.2)) crate(px,pz, 1.1,wr(0,3)); };
{ const px=f.x+wr(-5,5), pz=f.z+wr(-5,5); if(freeSpot(px,pz,1)) barrel(px,pz); };
});
placeTower(-30,8); placeTower(36,6);
crater(-24,12,2.2); crater(30,18,2.0); crater(4,-24,2.2);
{ const px=-14, pz=20; if(freeSpot(px,pz,1.5)) hedgehog(px,pz); };
{ const px=24, pz=-14; if(freeSpot(px,pz,1.5)) hedgehog(px,pz); };
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
// -- 原始密林 (胡康河谷) : 比滇缅更密, 竹丛+蕨类+巨树封闭 --
// 大龙河大桥 (胡康河谷): 木排架桥 —— 桥面高度由 heightAt 的 BRIDGE 矩形提供, 此处只建外观与护栏碰撞
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
// 护栏立柱 + 双横杆 (碰撞体挡人坠河, 立柱位于桥缘不占中央通道)
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
// 两岸旗点营地 (大桥旗点在桥上, 由 buildBridge 单独布置)
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
// 河岸哨塔: 控制大桥的两侧河曲视野
placeTower(-16,-18); placeTower(14,22);
if(freeSpot(-22,-10,2)) crater(-22,-10,2.2); if(freeSpot(26,10,2)) crater(26,10,2.0); if(freeSpot(-9,14,2)) crater(-9,14,1.8); if(freeSpot(12,-16,2)) crater(12,-16,2.2); // 固定弹坑避开落位瓦房
// 密林植被散布: 道路/旗点平整区/河道/建筑足迹让开, 其余区域竹丛+蕨类封闭
const spotOK=(x,z,flatK)=>{
if(roadDist(x,z)<6) return false;
if(inRiverChannel(x,z)) return false;
if(onBridge(x,z,3)) return false;
for(const f of FLATS){ if(Math.hypot(x-f.x,z-f.z)<f.r*flatK) return false; }
if(!freeSpot(x,z,1)) return false;
return Math.abs(x)<150&&Math.abs(z)<150;
};
let placed=0, tries=0;
while(placed<52&&tries<400){ tries++;
const x=wr(-150,150), z=wr(-150,150);
if(!spotOK(x,z,0.62)) continue;
bambooClump(x,z); placed++;
}
for(let i=0;i<90;i++){
const x=wr(-150,150), z=wr(-150,150);
if(!spotOK(x,z,0.5)) continue;
fernClump(x,z);
}
for(let i=0;i<18;i++){
const x=wr(-120,120), z=wr(-120,120);
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
// -- 雾林守线 (woods): 高疏落叶林, 守方西侧纵深工事 --
function layoutWoods(){
CAMPAIGN.flags.forEach((f,i)=>{
const defendsSide=f.x<40; // 西侧三旗=守方(美军)工事密集, 东侧两旗为接触区
let p=placeBuild(f.x,f.z,9,6,5);
if(p) logCabin(p.x,p.z,p.ry);
p=placeBuild(f.x,f.z,9,6,5);
if(p) logCabin(p.x,p.z,p.ry);
if(defendsSide&&i%2===0){ p=placeBuild(f.x,f.z,11,6,5); if(p) logCabin(p.x,p.z,p.ry); }
if(defendsSide){
p=placeBuild(f.x,f.z,10,4.4,4);
if(p){
const face=Math.atan2(CAMPAIGN.bases[ATK].x-p.x,CAMPAIGN.bases[ATK].z-p.z);
bunker(p.x,p.z,face);
}
}
{ const px=f.x+wr(-6,6), pz=f.z+wr(-6,6); if(freeSpot(px,pz,2)) sandbagWall(px,pz, 4,wr(0,3)); };
{ const px=f.x+wr(-5,5), pz=f.z+wr(-5,5); if(freeSpot(px,pz,1.2)) crate(px,pz, 1.2,wr(0,3)); };
{ const px=f.x+wr(-6,6), pz=f.z+wr(-6,6); if(freeSpot(px,pz,1)) barrel(px,pz); };
{ const px=f.x+wr(-8,8), pz=f.z+wr(-8,8); if(freeSpot(px,pz,1.5)) hedgehog(px,pz); };
});
// 倒木: 林间散兵天然的卧姿掩体
for(let i=0;i<14;i++) fallenLog(wr(-120,120),wr(-120,120),wr(0,Math.PI));
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
// -- 雪岭松林 (莫斯科) --
function layoutAlpine(){
CAMPAIGN.flags.forEach((f,i)=>{
let p=placeBuild(f.x,f.z,9,6,5);
if(p) logCabin(p.x,p.z,p.ry);
p=placeBuild(f.x,f.z,9,6,5);
if(p) logCabin(p.x,p.z,p.ry);
if(i%2===0){ p=placeBuild(f.x,f.z,11,6,5); if(p) logCabin(p.x,p.z,p.ry); }
p=placeBuild(f.x,f.z,10,4.4,4);
if(p){
const face=Math.atan2(CAMPAIGN.bases[ATK].x-p.x,CAMPAIGN.bases[ATK].z-p.z);
bunker(p.x,p.z,face);
}
{ const px=f.x+wr(-6,6), pz=f.z+wr(-6,6); if(freeSpot(px,pz,2)) sandbagWall(px,pz, 4,wr(0,3)); };
{ const px=f.x+wr(-5,5), pz=f.z+wr(-5,5); if(freeSpot(px,pz,1.2)) crate(px,pz, 1.2,wr(0,3)); };
{ const px=f.x+wr(-6,6), pz=f.z+wr(-6,6); if(freeSpot(px,pz,1)) barrel(px,pz); };
});
{ const px=-40, pz=8; if(freeSpot(px,pz,1.5)) hedgehog(px,pz); };
{ const px=-2, pz=-14; if(freeSpot(px,pz,1.5)) hedgehog(px,pz); };
{ const px=44, pz=10; if(freeSpot(px,pz,1.5)) hedgehog(px,pz); };
{ const px=8, pz=30; if(freeSpot(px,pz,1.5)) hedgehog(px,pz); };
{ const px=-10, pz=8; if(freeSpot(px,pz,1.5)) deadTree(px,pz); };
{ const px=28, pz=14; if(freeSpot(px,pz,1.5)) deadTree(px,pz); };
{ const px=-36, pz=-18; if(freeSpot(px,pz,1.5)) deadTree(px,pz); };
crater(-16,-6,2.2); crater(38,4,2.0);
}
// -- 雪峰山 1945 (800 超大地图 · 山线六点征服) --
function layoutXuefeng(){
const F=CAMPAIGN.flags;
// 旗点通用点缀: 沙袋半环/杂物箱/油桶 (偏移点必须自由位; 弹药箱由通用循环兜底)
F.forEach((f,i)=>{
{ const px=f.x+wr(-8,8), pz=f.z+wr(-8,8); if(freeSpot(px,pz,2)) sandbagWall(px,pz,4,wr(0,3)); };
{ const px=f.x+wr(-9,7), pz=f.z+wr(-8,8); if(roadDist(px,pz)>6&&freeSpot(px,pz,1.2)) crate(px,pz,1.2,wr(0,3)); };
{ const px=f.x+wr(-8,8), pz=f.z+wr(-9,7); if(roadDist(px,pz)>6&&freeSpot(px,pz,1)) barrel(px,pz); };
});
// 江口镇 (旗0 山麓稻镇): 木屋群+谷仓
let p=placeBuild(-300,160,11,9,6); if(p) cnHouse(p.x,p.z,p.ry,9,6);
p=placeBuild(-300,160,12,7,6); if(p) cnHouse(p.x,p.z,p.ry,7,6);
p=placeBuild(-298,163,13,9,7); if(p) buildBarn(p.x,p.z,p.ry);
// 青山坳 (旗1 山腰哨口): 哨屋
p=placeBuild(-247,58,10,8,6); if(p) logCabin(p.x,p.z,p.ry);
// 枯石垭 (旗2 垭口1): 西侧碉堡朝青山坳, 东侧机枪锁公路下坡
p=placeBuild(-147,-2,11,8,5); if(p) bunker(p.x,p.z,Math.atan2(-247+147,58+2));
if(freeSpot(-133,-13,1.5)) mg42(-133,-13,Math.atan2(131+133,-23+13),0);
// 雪峰山 (旗3 主峰): 双哨屋 + 东西向机枪 (扼守峰顶两侧登山道)
p=placeBuild(5,-21,11,8,5); if(p) logCabin(p.x,p.z,p.ry);
p=placeBuild(9,-30,11,8,5); if(p) logCabin(p.x,p.z,p.ry);
if(freeSpot(-16,-23,1.5)) mg42(-16,-23,Math.atan2(131+16,-23+23),0);
if(freeSpot(25,-25,1.5)) mg42(25,-25,Math.atan2(-142-25,-7+25),1);
// 双峰口 (旗4 垭口2): 哨屋+机枪架向主峰方向
p=placeBuild(131,-23,10,8,5); if(p) logCabin(p.x,p.z,p.ry);
if(freeSpot(122,-33,1.5)) mg42(122,-33,Math.atan2(-170-122,-30+33),1);
// 东栗坡 (旗5 东麓): 木屋群
p=placeBuild(300,-125,11,9,6); if(p) cnHouse(p.x,p.z,p.ry,9,6);
p=placeBuild(296,-123,12,7,6); if(p) cnHouse(p.x,p.z,p.ry,7,6);
// 山坡松杉林带: 中坡密植 (h16~82, 尝试数按画质缩放), 林线以上裸岩不落树, 避开旗圈/公路/稻田/建筑足迹
for(let i=0,n=Math.round(1600*treeQMul());i<n;i++){
const x=wr(-380,380), z=wr(-380,380);
const h=heightAt(x,z);
if(h<16||h>82) continue;
if(roadDist(x,z)<8) continue;
if(fieldAt(x,z)) continue;
let near=false;
for(const fc of F){ if(Math.hypot(x-fc.x,z-fc.z)<fc.r+4){ near=true; break; } }
if(near) continue;
if(!freeSpot(x,z,1.2)) continue; // 大尝试量下必须查建筑足迹, 防树穿屋
tree(x,z,wr(1.05,1.75));
}
// 山脊乱石/枯树/拒马 (高海拔掩体带): 主峰与垭口两侧的山肩
for(let i=0;i<26;i++){
const x=wr(-260,260), z=wr(-170,120);
if(heightAt(x,z)<48||roadDist(x,z)<8||!freeSpot(x,z,1.2)) continue;
if(i%3===0) deadTree(x,z); else if(i%3===1) rubblePile(x,z,wr(1.2,2.0)); else hedgehog(x,z);
}
// 垭口拉锯弹坑
crater(-160,-20,2.2); crater(-120,6,2.0); crater(-20,-44,2.2);
crater(150,-36,2.1); crater(60,-6,1.9); crater(-60,48,1.8);
}
// -- 太行山 1943 (800 超大地图 · 三山群围攻功防) --
// 山群三峰 (西峰E/主峰C/东峰H), 九旗散布: 每座山 2~4 条上山路线, 攻方六个前出点同时多方向围攻;
// 守方(日军)据守全山各据点; 平原田块软遮蔽由 buildWorld 通用庄稼系统摆种
function layoutTaihang(){
const F=CAMPAIGN.flags;
// 旗点通用点缀: 沙袋半环/杂物箱/油桶 (偏移点必须自由位; 弹药箱由通用循环兜底)
F.forEach(f=>{
{ const px=f.x+wr(-8,8), pz=f.z+wr(-8,8); if(freeSpot(px,pz,2)) sandbagWall(px,pz,4,wr(0,3)); };
{ const px=f.x+wr(-9,7), pz=f.z+wr(-8,8); if(roadDist(px,pz)>6&&freeSpot(px,pz,1.2)) crate(px,pz,1.2,wr(0,3)); };
{ const px=f.x+wr(-8,8), pz=f.z+wr(-9,7); if(roadDist(px,pz)>6&&freeSpot(px,pz,1)) barrel(px,pz); };
});
// 注: 群山路网每旗皆通, 环带选址(placeBuild)会被 roadDist<5 大面积拒绝 ——
// 村/堡一律用手写 placeAt 锚点 (公路侧垂直方向, 旗点平台内, 兜底可强放)
// A 南谷口 (旗0): 平原村集 —— 木屋群+谷仓+石墙 (南线起点, 攻方主突击方向)
let p=placeAt(44,112,0.2,9,6,{maxDh:1.6}); cnHouse(p.x,p.z,p.ry,9,6);
p=placeAt(22,98,-0.4,7,5,{maxDh:1.6}); cnHouse(p.x,p.z,p.ry,7,5);
p=placeAt(20,135,-0.25,9.5,13.5,{maxDh:1.6}); buildBarn(p.x,p.z,p.ry);
stoneWall(70,66,92,72);
if(freeSpot(30,120,1.5)) hedgehog(30,120);
// D 西峰口 (旗2): 西线山脚哨村 (锚点取平台低侧, 避免山脊削坡悬空)
p=placeAt(-242,26,0.3,9,6,{maxDh:1.6}); cnHouse(p.x,p.z,p.ry,9,6);
p=placeAt(-244,48,-0.35,7,5,{maxDh:1.6}); cnHouse(p.x,p.z,p.ry,7,5);
// F 北口 (旗4): 北线山脚哨屋+碉堡朝南守山
p=placeAt(80,-232,0.2,6,5,{maxDh:1.6}); logCabin(p.x,p.z,p.ry);
p=placeAt(108,-232,0.35,8,5,{maxDh:1.6}); bunker(p.x,p.z,Math.atan2(30-p.x,-60-p.z));
// G 东口 (旗6): 东线村舍
p=placeAt(324,-104,0.2,9,6,{maxDh:1.6}); cnHouse(p.x,p.z,p.ry,9,6);
p=placeAt(344,-111,-0.3,7,5,{maxDh:1.6}); cnHouse(p.x,p.z,p.ry,7,5);
// B 南腰台 (旗1): 碉堡俯射南坡下口 + 双机枪封锁之字路 (锚点取南侧缓面)
p=placeAt(68,18,0.35,8,5,{maxDh:1.6});
bunker(p.x,p.z,Math.atan2(45-p.x,95-p.z));
if(freeSpot(84,12,1.5)) mg42(84,12,Math.atan2(45-84,95-12),1);
if(freeSpot(58,38,1.5)) mg42(58,38,Math.atan2(45-58,95-38),1);
// I 西垭台 (旗8): 西/主峰间鞍部哨塔 + 机枪双向封锁两缘
placeTower(-57,-38);
if(freeSpot(-33,-40,1.5)) mg42(-33,-40,Math.atan2(70+33,25+40),1);
if(freeSpot(-58,-14,1.5)) mg42(-58,-14,Math.atan2(-135+58,15+14),1);
// E 西峰顶 (旗3): 碉堡朝西坡下口 + 机枪
p=placeAt(-136,32,0.2,8,5,{maxDh:1.6});
bunker(p.x,p.z,Math.atan2(-240-p.x,40-p.z));
if(freeSpot(-124,28,1.5)) mg42(-124,28,Math.atan2(-240+124,40-28),1);
if(freeSpot(-150,4,1.5)) mg42(-150,4,Math.atan2(-45+150,-28-4),1);
// H 东峰顶 (旗7): 哨屋 + 机枪双向 (东线/东垭)
p=placeAt(196,-104,-0.2,6,5,{maxDh:1.6}); logCabin(p.x,p.z,p.ry);
if(freeSpot(212,-130,1.5)) mg42(212,-130,Math.atan2(330-212,-125+130),1);
if(freeSpot(187,-108,1.5)) mg42(187,-108,Math.atan2(115-187,-90+108),1);
// C 主峰要塞 (旗5): 双碉堡扼东西台缘(四路公路皆汇峰顶) + 双机枪 + 环顶沙袋 + 弹药杂物
const fx=30, fz=-60;
p=placeAt(fx-6,fz+5,-0.2,8,5,{maxDh:1.6}); bunker(p.x,p.z,Math.atan2(45-p.x,95-p.z));
p=placeAt(fx-4,fz-6,0.15,8,5,{maxDh:1.6}); bunker(p.x,p.z,Math.atan2(95-p.x,-225-p.z));
if(freeSpot(14,-74,1.5)) mg42(14,-74,Math.atan2(-45-14,-28+74),1);
if(freeSpot(46,-72,1.5)) mg42(46,-72,Math.atan2(115-46,-90+72),1);
for(const [wx,wz,wf] of [[fx,fz+34,0],[fx,fz-34,Math.PI],[fx-24,fz,-HPI],[fx+24,fz,HPI]]){
if(freeSpot(wx,wz,2)) sandbagWall(wx,wz,4.5,wf);
}
if(freeSpot(fx+6,fz+8,1.2)) crate(fx+6,fz+8,1.2,0.5);
if(freeSpot(fx-6,fz-10,1)) barrel(fx-6,fz-10);
// 进攻方前出点营地: 帐篷+沙袋+杂物 (17-emplacements 会再配反坦克炮/机枪朝敌基)
for(const sp of (CAMPAIGN.spawns||[])){
if(freeSpot(sp.x+2,sp.z+5,2)) tent(sp.x+2,sp.z+5,0.3);
if(freeSpot(sp.x-3,sp.z-4,2)) tent(sp.x-3,sp.z-4,-0.2);
if(freeSpot(sp.x+6,sp.z+3,2)) sandbagWall(sp.x+6,sp.z+3,4,HPI);
if(freeSpot(sp.x-6,sp.z-2,2)) sandbagWall(sp.x-6,sp.z-2,4,0);
if(freeSpot(sp.x+4,sp.z-6,1.2)) crate(sp.x+4,sp.z-6,1.2,0.5);
if(freeSpot(sp.x-4,sp.z+7,1)) barrel(sp.x-4,sp.z+7);
}
// 山群中坡密植林带 (h24~84, 与地表刷绿的中坡林带色对应; 85 以上裸岩不落树):
// 避开公路/田块/旗圈/建筑足迹, 尝试数按画质缩放 —— 三峰坡面与山谷两侧连片成林
for(let i=0,n=Math.round(4400*treeQMul());i<n;i++){
const x=wr(-390,390), z=wr(-390,390);
const h=heightAt(x,z);
if(h<24||h>84) continue;
if(roadDist(x,z)<7) continue;
if(fieldAt(x,z)) continue;
let near=false;
for(const fc of F){ if(Math.hypot(x-fc.x,z-fc.z)<fc.r+5){ near=true; break; } }
if(near) continue;
if(!freeSpot(x,z,1.2)) continue;
tree(x,z,wr(1.0,1.6));
}
// 山群坡地高海拔乱石/枯树带 (山腰掩体, 避开道路/旗圈)
for(let i=0;i<26;i++){
const x=wr(-250,330), z=wr(-230,90);
if(heightAt(x,z)<28||roadDist(x,z)<8||!freeSpot(x,z,1.2)) continue;
if(i%3===0) deadTree(x,z); else if(i%3===1) rubblePile(x,z,wr(1.2,2.0)); else hedgehog(x,z);
}
// 各交火面弹坑: 南线/垭口/北线/西线/东线
crater(58,52,2.3); crater(30,20,2.0); crater(-52,-20,1.9);
crater(105,-160,2.2); crater(120,-70,2.1); crater(-205,32,2.0);
crater(270,-112,2.2); crater(-8,-48,1.8);
}
// ══════ 劫道方临时补给点 (断崖公路): 限时 (convoy.supplyLife 秒) 后全体失效 ══════
// 补给内容=弹药+绷带+投掷物全满 (与弹药箱同标准); 仅劫道方(team0)玩家可使用
const SUPPLY_POINTS=[];
let SUPPLY_EXPIRED=false, SUPPLY_START=-1;
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
		case 'alpine': layoutAlpine(); break;
		case 'steppe': layoutSteppe(); break;
		case 'woods': layoutWoods(); break;
		case 'canyon': layoutCanyon(); break;
		case 'xuefeng': layoutXuefeng(); break;
		case 'taihang': layoutTaihang(); break;
		default: layoutRural(); break;
	}
// 大龙河大桥 (胡康河谷)
if(BRIDGE) buildBridge(BRIDGE);
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
// 河流水面/冰面: 一条沿河道中心线的连续条带网格。
// 水位按折线逐采样点取值 (岸高-落差), 再做滑动平均平滑, 相邻采样点线性插值,
// 彻底消除旧实现"每块一个 box、各自取水位"造成的台阶式错位。
if(RIVER){
const wmat=RIVER.ice
?new THREE.MeshLambertMaterial({color:0xcfe2ee})
:new THREE.MeshLambertMaterial({color:0x3e5a6a,transparent:true,opacity:0.72});
const P=RIVER.pts;
const hw=RIVER.w*0.95; // 条带半宽 (略窄于河道下切宽度)
const samples=[];
for(let i=0;i<P.length-1;i++){
const ax=P[i][0],az=P[i][1],bx2=P[i+1][0],bz2=P[i+1][1];
const dx=bx2-ax,dz=bz2-az;
const len=Math.hypot(dx,dz)||1;
const nx=-dz/len, nz=dx/len; // 垂直于河道的单位向量
const nCh=Math.max(1,Math.round(len/12));
for(let k=0;k<nCh;k++){
const tc=(k+0.5)/nCh;
samples.push({x:ax+dx*tc,z:az+dz*tc,nx,nz});
}
}
for(const s of samples){
// 岸高: 河道下切范围之外两侧采样 (noBridge: 避免把桥面当岸高);
// 河床: 河道中心线 (同旧逻辑)
const off=RIVER.w+1.5;
const bank=Math.min(heightAt(s.x+s.nx*off,s.z+s.nz*off,true),heightAt(s.x-s.nx*off,s.z-s.nz*off,true));
const bed=heightAt(s.x,s.z,true);
let wy;
if(RIVER.ice){
wy=bed+0.12;
}else{
wy=bank-(RIVER.d>2?1.6:0.4);
}
wy=clamp(wy,bed+0.1,bank-0.15);
s.bank=bank; s.wy=wy;
}
// 滑动平均 (2 遍, 3 点窗): 相邻采样点水位不再跳变, 同时保持整体起伏
for(let pass=0;pass<2;pass++){
for(let i=0;i<samples.length;i++){
const a=samples[Math.max(0,i-1)], b=samples[i], c=samples[Math.min(samples.length-1,i+1)];
samples[i].wy=(a.wy+b.wy+c.wy)/3;
}
}
for(const s of samples){
// 平滑后仍保证水面不沉入河床、不高于岸沿
const bed=heightAt(s.x,s.z,true);
s.wy=clamp(s.wy,bed+0.1,s.bank-0.15);
}
// 连续条带: 相邻采样点成对组成四边形, 水位在采样点间线性过渡
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
wgeo.setIndex(idx);
wgeo.computeVertexNormals();
const wmesh=new THREE.Mesh(wgeo,wmat);
wmesh.renderOrder=1;
scene.add(wmesh);
}
// 树木/枯树散布 (避开道路/平整区/河道/建筑足迹/裸岩带; 边界随地图尺寸; treeQ 主题按画质缩放)
	const treeSpots=[];
		const TR=MAP_SIZE/2-8;
	for(let i=0,n=Math.round(THEME.treeN*treeQMul());i<n;i++){
	const x=wr(-TR,TR), z=wr(-TR,TR);
	if(roadDist(x,z)<7) continue;
	if(inRiverChannel(x,z)) continue;
		if(CAMPAIGN.terr==='xuefeng'&&heightAt(x,z)>84) continue; // 林线以上裸岩不落树
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
for(let x=-124;x<=124;x+=28){
const z=3*Math.sin(x*0.02)+6.5;
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
const FLAGS=CAMPAIGN.flags.map(f=>({id:f.id,x:f.x,z:f.z,r:f.r,owner:-1,cap:0,capTeam:-1}));
const BASES=CAMPAIGN.bases.map(b=>({x:b.x,z:b.z}));
FLAGS.forEach(f=>{
const g0=heightAt(f.x,f.z);
const pole=mesh(new THREE.CylinderGeometry(0.07,0.09,7,8),MAT.metal,f.x,g0+3.5,f.z);
CYLS.push({x:f.x,z:f.z,r:0.15,y0:g0,y1:g0+7});
const flagC=document.createElement('canvas'); flagC.width=64; flagC.height=40;
f.flagCtx=flagC.getContext('2d');
f.flagTex=new THREE.CanvasTexture(flagC);
const fm=new THREE.Mesh(new THREE.PlaneGeometry(2.4,1.5), new THREE.MeshLambertMaterial({map:f.flagTex,side:THREE.DoubleSide}));
fm.position.set(f.x+1.25,g0+6,f.z);
world.add(fm);
f.flagMesh=fm; f.poleTop=g0+6.6; f.gy=g0;
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
