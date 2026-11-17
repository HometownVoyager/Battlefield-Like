// ─────────────────────────────────────────────
// 17-emplacements.js —— 反坦克炮/医疗箱/出生点
// 源: Index.original.html 第 6608-6767 行
// ─────────────────────────────────────────────
'use strict';
const ATGUNS=[], AAGUNS=[];
function atGun(x,z,face){
// 落点互斥: 炮+护盾+轮架+后掩护墙整机登记一个占位圈(墙尖距中心2.6m); 被占贴边外推, 无净位即放弃
const po=propFree(x,z,2.7)?[x,z]:propPushOut(x,z,2.7);
if(!po) return;
x=po[0]; z=po[1];
const g0=heightAt(x,z);
// 后方掩护墙降到0.5m: 低于炮管(0.85m), 360°回旋时炮管不再穿墙/挡弹
sandbagWall(x-Math.sin(face)*1.6,z-Math.cos(face)*1.6,3.5,face,0.5,false);
const gfit=groundFit(x,z,face,1.2,1.2);
const grp=new THREE.Group();
grp.position.set(x,gfit.y+0.85,z);
grp.rotation.order='YXZ';
grp.rotation.set(gfit.pitch,face,gfit.roll);
const yaw=new THREE.Group(); grp.add(yaw);
const pitch=new THREE.Group(); yaw.add(pitch);
// ══════════════════════════════════════════════════════════════════════════════
// 反坦克炮模型 (2026-09-21B §3 翻新): 旧版 = 防盾/炮管/炮闩/双轮 + 沙袋墙共 5 件平色(2.0×0.95 一块平板)
// ⇒ 用户实机"除反舰炮台外大部分固定火力点建模和材质太简陋"。现版 22 件分件, 承力链一眼可读:
//   地面→大架(驻锄)→轮轴(两端伸出轮面 = 轮毂)→双轮→上架→摇架→炮管; 防盾/复进筒/俯仰·方向手轮/
//   炮手座/待发弹药箱各自挂在该在的承力件上, 每件与邻件正体积相交 (dev/_firepoint-selfcheck.js 逐件量测)。
// 局部系: 原点 = 炮位中心 0.85m 高 (grp.position.y = gfit.y+0.85), +z = face, y=0 = 炮管轴线; 地面 = y-0.85。
// ★ 炮口 = 局部 z 2.69: 契约是 emplATFire 出膛点 = 炮位 + dir*2.7 (13-combat:170), 2.69 与 2.7 差 1cm
//   (自检断言 [2.4,2.9] 与 |Δy|≤0.25)。涂装档/材质/连杆助手见 05c 尾段"固定火力点模型单源"。
// ══════════════════════════════════════════════════════════════════════════════
const fac=(CAMPAIGN.f&&CAMPAIGN.f[x<0?0:1])||'ger'; // atGun 无 team 参数(契约冻结): 沿用 mg42 的 x<0?0:1 落位惯例定涂装
const GY=-0.85;                                      // 局部地面高 (炮位高 0.85m)
const plate=fpPlateMat(fac), stencil=fpStencilMat(fac);
// ── 轮轴: 承力主件 (两支大架 + 双轮 + 俯仰/方向手轮都挂在它上面; 两端各伸出轮面 0.06 = 轮毂端) ──
fpAdd(grp,new THREE.CylinderGeometry(0.13,0.13,1.90,10),MAT.metal,0,GY+0.45,-0.10,0,0,HPI,'atAxle');
// ── 双轮: 轮心 = 地面 + 半径 (16 段: 顶点正对上下 ⇒ AABB 与轮胎外形都恰好落地, 14 段会内切 1.1cm) ──
fpAdd(grp,new THREE.CylinderGeometry(0.42,0.42,0.18,16),MAT.metalDark,0.80,GY+0.42,-0.10,0,0,HPI,'atWheelR');
fpAdd(grp,new THREE.CylinderGeometry(0.42,0.42,0.18,16),MAT.metalDark,-0.80,GY+0.42,-0.10,0,0,HPI,'atWheelL');
// ── 俯仰/方向手轮: 装在轮轴外段左右各一 (与轴正体积相交 0.07) ──
fpAdd(grp,new THREE.CylinderGeometry(0.14,0.14,0.07,12),MAT.metalDark,0.47,GY+0.45,-0.10,0,0,HPI,'atElevWheel');
fpAdd(grp,new THREE.CylinderGeometry(0.14,0.14,0.07,12),MAT.metalDark,-0.47,GY+0.45,-0.10,0,0,HPI,'atTravWheel');
// ── 两支大架 + 驻锄: 前端夹在轮轴上, 尾端落到炮位后方 1.0m (驻锄入土 0.05, 与后方沙袋墙净空 0.11) ──
for(const s of [1,-1]){
const sn=s>0?'R':'L';
fpBar(grp,plate,s*0.42,GY+0.43,-0.10, s*0.42,GY+0.13,-1.00, 0.13,0.16,'atTrail'+sn);
fpAdd(grp,new THREE.BoxGeometry(0.26,0.22,0.09),MAT.metalDark,s*0.42,GY+0.07,-1.03,-0.42,0,0,'atSpade'+sn);
}
// ── 上架 (轮轴→上架→摇架 的中间承力件) ──
fpAdd(grp,new THREE.BoxGeometry(0.46,0.34,0.66),MAT.metal,0,GY+0.59,0.03,0,0,0,'atSaddle');
// ── 炮手座: 焊在左大架上的座板 (架身从座板下穿过 0.08; 座板内缘 -0.33 在站位躯干 ±0.26 之外) ──
fpAdd(grp,new THREE.BoxGeometry(0.34,0.08,0.32),MAT.wood,-0.50,GY+0.41,-0.52,0,0,0,'atSeat');
// ── 待发弹药箱: 木箱靠在右大架旁, 箱底入土 0.04 (既有 ammoCrate 同款 woodDark 箱体) ──
fpAdd(grp,new THREE.BoxGeometry(0.62,0.34,0.44),MAT.woodDark,0.62,GY+0.13,-0.90,0,0,0,'atAmmoCrate');
// ── 分体防盾 (随 yaw 回转): 下板整幅 + 上板左右两片(中间 0.42m 观察/炮管槽), 板面错台避开共面;
//    钢板铆钉来自 TEX.steelPlate, 下板的队标/编号来自 TEX.stencil (涂装 color 定色相) ──
fpAdd(yaw,new THREE.BoxGeometry(1.90,0.46,0.09),stencil,0,-0.02,0.31,0,0,0,'atShieldLo');
fpAdd(yaw,new THREE.BoxGeometry(0.74,0.46,0.10),plate,0.58,0.34,0.335,0,0,0,'atShieldUpR');
fpAdd(yaw,new THREE.BoxGeometry(0.74,0.46,0.10),plate,-0.58,0.34,0.335,0,0,0,'atShieldUpL');
// ── 摇架 (随 pitch 俯仰): 炮管从上面穿过; 复进筒双筒挂摇架两侧 (各相交 0.075) ──
fpAdd(pitch,new THREE.BoxGeometry(0.30,0.22,1.10),MAT.metal,0,-0.12,0.55,0,0,0,'atCradle');
fpAdd(pitch,new THREE.CylinderGeometry(0.06,0.06,0.96,8),MAT.metalDark,0.135,-0.10,0.35,HPI,0,0,'atRecoilR');
fpAdd(pitch,new THREE.CylinderGeometry(0.06,0.06,0.96,8),MAT.metalDark,-0.135,-0.10,0.35,HPI,0,0,'atRecoilL');
// ── 炮闩 (摇架托住) + 炮管 (后端 0.35 进炮闩) + 炮口制退器 (前缘 = 2.69) ──
fpAdd(pitch,new THREE.BoxGeometry(0.34,0.36,0.64),MAT.metal,0,0,-0.30,0,0,0,'atBreech');
fpAdd(pitch,new THREE.CylinderGeometry(0.065,0.088,2.79,10),MAT.metalDark,0,0,1.045,HPI,0,0,'atBarrel');
fpAdd(pitch,new THREE.CylinderGeometry(0.115,0.115,0.38,10),MAT.metalDark,0,0,2.50,HPI,0,0,'atBrake');
// ── 瞄准镜: 夹在炮闩左上角 (与炮闩相交 0.07) ──
fpAdd(pitch,new THREE.CylinderGeometry(0.05,0.05,0.30,8),MAT.metalDark,-0.14,0.16,-0.10,HPI,0,0,'atSight');
grp.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
world.add(grp);
propTake(x,z,2.7); // 反坦克炮整机+掩护墙占位
CYLS.push({x,z,r:0.6,y0:g0,y1:g0+1.2});
ATGUNS.push({x,z,y:g0+0.85,face,grp,yaw,pitch,user:null,cd:0,cdLock:0,kind:'at'});
}
// yDeck: 塔顶/平台固定高度 (2026-09-09 柏林防空塔: 屋顶平台高炮; 省略=按地形取高)
// deckRef: 该平台的坍塌链 (2026-09-19 用户实机"塔楼倒塌后顶部的防空炮会浮空"):
//   炮随平台存在 —— 平台塌了炮就必须一起消失, 否则炮悬在半空还能被操作。见 05-world collapseRoof。
function aaGun(x,z,yDeck,deckRef){
const onDeck=yDeck!==undefined&&yDeck!==null;
if(!onDeck){
const po=propFree(x,z,1.2)?[x,z]:propPushOut(x,z,1.2);
if(!po) return;
x=po[0]; z=po[1];
}
const g0=onDeck?yDeck:heightAt(x,z);
const gfit=onDeck?{y:g0,pitch:0,roll:0}:groundFit(x,z,0,1.0,1.0);
const grp=new THREE.Group();
grp.position.set(x,gfit.y+1.15,z);
grp.rotation.order='YXZ';
grp.rotation.set(gfit.pitch,0,gfit.roll);
const yaw=new THREE.Group(); grp.add(yaw);
const pitch=new THREE.Group(); pitch.position.y=0.1; yaw.add(pitch);
// —— 模型: 四联 20mm Flakvierling 风 (7d-乙 2026-09-30 三选一定稿 B; 定稿参照图 dev/_aaopt-B-*.png,
//     出图工具 dev/render-aamodel.js)。群组契约零漂移: grp(离地1.15)>yaw>pitch(y0.1, 身管沿+z, 炮口~1.8m);
//     俯仰判据 -0.45..1.35 不切基座/轮组 (轮在 x±0.8 外侧, 身管 x±0.065); 横向包线 ±0.86 (旧基座圈 r1.0 之内)。
// ── 2026-09-30 散架修复 (用户实报"新防空炮的各个部分连接是散架的"): 旧 B 方案转录时四条连接断线 ——
//   ①立柱顶 -0.235 vs 炮架(炮箱)底 -0.08 → 整个回转部悬空 0.155m; ②轮心 -0.8 (r0.3) 轮底 -1.10,
//   离地 -1.15 悬空 5cm 且轮轴与立柱之间无任何承力件; ③引杆近端 (z-0.16) 与轮轴 (z0) 错位 0.16m;
//   ④座椅托架臂挂在立柱侧面半空 (y-0.24, 立柱顶 -0.235 之下), 座椅单腿悬空。
//   修复口径 (群组契约零漂移: grp>yaw>pitch(y0.1)·炮口~1.8m·俯仰 -0.45..1.35 不切基座):
//   立柱加高到顶 -0.045 (与炮箱底 -0.08 嵌合 0.035) + yaw 层加**转盘** (r0.38, 底面正好坐在柱顶,
//   是座椅/托架臂/炮架共同的可视回转载体, yaw 子件 6→7) + 轮心降到 -0.85 (轮底精确接地) +
//   拖车臂×2 (立柱根部→轮轴, 轮组的承力连接) + 立柱足垫 + 引杆近端真正贴到轮轴上。
// 底盘: 轮轴 + 双轮 + 拖车臂 + 足垫 + 引杆 + 立柱
const axle=new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.045,1.6,8),MAT.metal);
axle.rotation.z=HPI; axle.position.y=-0.85; grp.add(axle); // 轮心 -0.85: r0.3 → 轮底 -1.15 精确接地
for(const sx of [-0.8,0.8]){
const wh=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.3,0.12,14),vmMats.gunL);
wh.rotation.z=HPI; wh.position.set(sx,-0.85,0); wh.name='aaWheel'; grp.add(wh);
}
for(const sx of [-0.445,0.445]){
const arm=new THREE.Mesh(new THREE.BoxGeometry(0.63,0.09,0.09),MAT.metal); // 拖车臂: 内端嵌立柱锥体, 外端压进轮内侧面
arm.position.set(sx,-0.78,0); arm.name=sx<0?'aaArmL':'aaArmR'; grp.add(arm);
}
const pad=new THREE.Mesh(new THREE.BoxGeometry(0.56,0.08,1.0),MAT.metalDark); // 立柱足垫: 底面贴地, 立柱插入垫面
pad.position.set(0,-1.11,-0.12); pad.name='aaPad'; grp.add(pad);
const drawbar=new THREE.Mesh(new THREE.BoxGeometry(0.07,0.07,1.33),MAT.metal); // 引杆: 近端贴轮轴 (y-0.85,z-0.04), 远端触地 (尾撬)
drawbar.position.set(0,-0.995,-0.685); drawbar.rotation.x=-0.229; drawbar.name='aaDrawbar'; grp.add(drawbar);
const ped=new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.22,1.04,10),vmMats.gunL); // 立柱: 顶 -0.045 与炮箱底嵌合
ped.position.y=-0.565; ped.name='aaPedestal'; grp.add(ped);
// yaw: 回转转盘 (全回转部的可视载体) + 后座座椅 (座板+靠背+支撑短柱, 全部落到转盘面) + 小盾
const table=new THREE.Mesh(new THREE.CylinderGeometry(0.38,0.42,0.09,14),vmMats.gunL);
table.position.y=0; table.name='aaTurntable'; yaw.add(table); // 底 -0.045 正坐柱顶, 顶 0.045
const seatP=new THREE.Mesh(new THREE.BoxGeometry(0.36,0.07,0.38),vmMats.gun);
seatP.position.set(0,0.08,-0.45); yaw.add(seatP); // 座板底 0.045 = 盘面, 前缘落在盘上
const seatB=new THREE.Mesh(new THREE.BoxGeometry(0.36,0.4,0.07),vmMats.gun);
seatB.position.set(0,0.30,-0.57); seatB.rotation.x=0.16; yaw.add(seatB); // 靠背底 0.10 与座板顶嵌合
const seatPost=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.04,0.09,8),MAT.metal);
seatPost.position.set(0,0.005,-0.30); yaw.add(seatPost); // 支撑短柱: 桥接盘面与座板前缘 (全在盘厚内, 顶嵌进座板)
const seatArm=new THREE.Mesh(new THREE.BoxGeometry(0.16,0.06,0.55),MAT.metal); // 托架臂: 卧在盘面上伸向座板 (旧版悬在立柱侧面半空)
seatArm.position.set(0,0.055,-0.24); yaw.add(seatArm);
const shield=new THREE.Mesh(new THREE.BoxGeometry(0.46,0.32,0.06),vmMats.gunL);
shield.position.set(0,0.12,0.42); shield.rotation.x=-0.16; yaw.add(shield);
// pitch: 炮箱 + 2×2 四身管 + 双弹鼓
const cradle=new THREE.Mesh(new THREE.BoxGeometry(0.42,0.36,0.55),vmMats.gun);
cradle.position.set(0,0,0.14); pitch.add(cradle);
for(const sx of [-0.08,0.08]) for(const sy of [-0.07,0.07]){
const bb=new THREE.Mesh(new THREE.CylinderGeometry(0.026,0.03,1.55,8),vmMats.gun);
bb.rotation.x=HPI; bb.position.set(sx,sy,1.02); pitch.add(bb);
}
for(const sx of [-0.24,0.24]){
const drum=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,0.16,10),vmMats.gunL);
drum.rotation.x=HPI; drum.position.set(sx,0.05,0.2); pitch.add(drum);
}
grp.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
world.add(grp);
propTake(x,z,1.2);
const cyl={x,z,r:0.7,y0:g0,y1:g0+1.4};
CYLS.push(cyl);
// ★ 2026-09-26 A9: 操作手站位 = 建炮时按"退出炮口扫掠圈 (1.7m)"挑一个**可站**的点并存进条目 ——
//   单纯把站位从 0.9 推到 1.95 可能正好落进后方的沙袋/掩体 (上炮后相机在墙里)。逐档退缩 + 避障,
//   全不可用才退回旧口径 0.9; 玩家 (20a-seats) 与 Bot (14-bots.emplStandSpot) 都读同一个点。
let crew=null;
for(const d of [AA_CREW_DIST,1.45,0.9]){
const cx=x, cz=z-d;
if(!occBlocked(cx,cz)&&freeSpot(cx,cz,0.45)){ crew={x:cx,z:cz,d}; break; }
}
if(!crew) crew={x,z:z-0.9,d:0.9};
AAGUNS.push({x,z,y:g0+1.25,grp,yaw,pitch,user:null,cd:0,cdLock:0,kind:'aa',deck:deckRef||null,cyl,crew});
}
// 平台坍塌 → 平台上的炮一并消失 (2026-09-19 防空炮浮空修复; 由 05-world collapseRoof 调用)
// 解绑操作者 (玩家在炮上时下炮)/移除视觉/击杀碰撞圆柱/标 dead。
// ★ 不从 AAGUNS **摘除**: 该表按索引参与 23b-worldrestore 的射角快照与还原 (splice 会串位),
//   改为标 dead —— empReady 对 dead 炮一律 false (玩家与 Bot 同一支判定), 与"炮已不存在"等价。
function killDeckGuns(ref){
for(const g of AAGUNS){
if(!g||g.dead||g.deck!==ref) continue;
if(g.user){ try{ releaseEmpl(g,false); }catch(e){} g.user=null; }
if(typeof player!=='undefined'&&player){
if(player.onAA===g){ player.onAA=null; if(typeof VM!=='undefined'&&VM.root) VM.root.visible=true; if(typeof document!=='undefined'&&document.getElementById){ const h=document.getElementById('heatWrap'); if(h) h.style.display='none'; } }
if(player.useCast&&player.useCast.g===g) player.useCast=null;
}
if(g.grp&&g.grp.parent) world.remove(g.grp);
if(g.cyl) killCyl(g.cyl);
g.dead=true;
}
}
// 反坦克炮/防空炮: 按旗点间隔与基地通用摆放
// 落点避障(全局互斥): 占用格(建筑/沙袋/弹药箱碰撞)+道具占位(树/箱/杂物/其他炮)+建筑足迹三重检查,
// 随机偏移失败再贴边外推, 全败返回 null → 调用方放弃该火力点, 绝不穿模
function findClearSpot(x,z,spread,r){
for(let t=0;t<14;t++){
const px=x+rand(-spread,spread), pz=z+rand(-spread,spread);
if(!occBlocked(px,pz)&&propFree(px,pz,r)&&freeSpot(px,pz,0.6)) return [px,pz];
}
const po=propPushOut(x,z,r);
if(po&&!occBlocked(po[0],po[1])&&freeSpot(po[0],po[1],0.6)) return po;
return null;
}
// 反坦克炮按相邻旗对中点摆放; 斯大林格勒 14 点改版后旗链拉长 —— 只在中带 (距图心 80m 内) 布炮,
// 避免两翼 home 区(纵深无敌方坦克常态化)堆满反坦克炮; 其他战役保持全旗对布放 (行为零变化)
const atMidBand=CAMPAIGN.id==='stalingrad';
for(let i=0;i<FLAGS.length-1;i++){
const a=FLAGS[i], b=FLAGS[i+1];
const mx=(a.x+b.x)/2, mz=(a.z+b.z)/2;
if(atMidBand&&Math.hypot(mx,mz)>80) continue;
if(onBridge(mx,mz)!==false) continue; // 桥面不布反坦克炮 (2026-09-12 胡康巨桥: 桥面留给通行/塔楼/桥头碉堡)
const sp=findClearSpot(mx,mz,10,2.7);
if(sp) atGun(sp[0],sp[1],Math.atan2(b.x-a.x,b.z-a.z)+HPI*(i%2?1:-1));
}
if(FLAGS.length>2){ const sp=findClearSpot(FLAGS[0].x,FLAGS[0].z,14,2.7); if(sp) atGun(sp[0],sp[1],rand(0,TAU)); }
if(BASES.length){
{ const p1=findClearSpot(BASES[0].x+(BASES[0].x<0?10:-10),BASES[0].z+10,8,1.2); if(p1) aaGun(p1[0],p1[1]); }
{ const p2=findClearSpot(BASES[1].x+(BASES[1].x<0?10:-10),BASES[1].z-10,8,1.2); if(p2) aaGun(p2[0],p2[1]); }
}
// 中央旗防空炮: 旗在桥面上时跳过 (胡康巨桥 —— 塔顶 FLAK_DECKS 高炮已覆盖, 桥心不摆炮挡行车道)
if(FLAGS.length&&onBridge(FLAGS[Math.floor(FLAGS.length/2)].x,FLAGS[Math.floor(FLAGS.length/2)].z)===false){
const fm=FLAGS[Math.floor(FLAGS.length/2)]; const p3=findClearSpot(fm.x,fm.z,12,1.2); if(p3) aaGun(p3[0],p3[1]);
}
// 塔顶高炮 (2026-09-09 柏林防空塔): FLAK_DECKS 由 05a flakTower/controlTower 登记平台坐标/高度 ——
// 平台炮位固定不偏移; deck 记坍塌链 (2026-09-19: 平台塌了炮随平台一起消失, 不再浮空)
for(const d of FLAK_DECKS) aaGun(d.x,d.z,d.y,d.ref||null);
// 岸防炮位 (2026-09-18 塔拉瓦环礁): COASTAL_PITS 由 05a coastalPit 登记 (混凝土胸墙环已建成) ——
// 炮位固定不偏移 (胸墙内径 5.2 已按 atGun 回旋半径 2.6 算过账), 面海方向由图内 face 给定
for(const p of COASTAL_PITS) atGun(p.x,p.z,p.face);
// 无旗点战役 (遭遇/劫道): 阵营前出点各配反坦克炮+重机枪, 面向敌方基地
// 炮位/机枪位带垂直侧移(perp), 车队出发地等贴路前出点的工事不会被甩到路心
// 劫道(断崖公路)除外: 伏击山谷不设任何固定火力点
// ★2026-09-26 修 (P0-3 死袋): 侧移由 ~6m 推到 ~10m + 落点过 spawnKeepClear(9) ——
//   旧版炮位/机枪位落在离强点 ~6m 处, 与布局的沙袋环同圈 ⇒ 强点那格 (格心离点位 ≤3.5m)
//   被十来件工事围成死袋 (dev/_steppe-pocket-probe.js 实测每次换局 1~3 个强点中招)。
//   10m 侧移仍在强点火力的掩护半径内 (反坦克炮射程/机枪压制距离都远超此数), 只是不再贴着点位站。
if(GAMEMODE!=='convoy'){
for(const sp of (CAMPAIGN.spawns||[])){
if(sp.team!==0&&sp.team!==1) continue; // 中立强点 (草原"车站") 开局不配阵营火力点, 谁占谁用布局工事
const eb=BASES[1-sp.team];
const face=Math.atan2(eb.x-sp.x,eb.z-sp.z);
const g1=findClearSpot(sp.x-Math.sin(face)*6+Math.cos(face)*8,sp.z-Math.cos(face)*6-Math.sin(face)*8,7,2.7);
if(g1&&spawnKeepClear(g1[0],g1[1],9)) atGun(g1[0],g1[1],face);
const g2=findClearSpot(sp.x+Math.sin(face)*5-Math.cos(face)*8.5,sp.z+Math.cos(face)*5+Math.sin(face)*8.5,5,2.3);
if(g2&&spawnKeepClear(g2[0],g2[1],9)) mg42(g2[0],g2[1],face,sp.team);
}
}
NAV.refresh();
function findFreeSpawn(x,z){
// 除占用格外必须避开建筑足迹: 屋顶/楼板高于 1.75m 不入占用格,
// 只查 occBlocked 会把玩家部署上屋顶 (standHeight 会站到顶面)
for(let r=0;r<7;r++){
for(let i=0;i<8;i++){
const px=x+rand(-2,2)+Math.cos(i*0.785)*r*1.6, pz=z+rand(-2,2)+Math.sin(i*0.785)*r*1.6;
if(!spawnEdgeOk(px,pz)) continue;   // 出生离边门 (2026-11-13): 兜底环扫同样不出边带
if(!occBlocked(px,pz)&&freeSpot(px,pz,0.6)) return [px,pz];
}
}
// 全败兜底往中心钳回 (2026-11-13): 宁可进边带也不把人留在贴边原点; 挪后站不站得住由调用方
// (pickSpawnPoint 兜底走 NAV.spawnSpot / deployPlayer 走 standHeight) 各自兜账。
return spawnEdgeClamp(x,z);
}
const MED_CRATES=[];
const medkitTex=(()=>{
const c=document.createElement('canvas'); c.width=64; c.height=64;
const g=c.getContext('2d');
g.fillStyle='#d8d4c4'; g.fillRect(0,0,64,64);
g.fillStyle='#b8b4a4'; g.fillRect(0,0,64,6); g.fillRect(0,58,64,6);
g.fillStyle='#c03a2a';
g.fillRect(26,14,12,36); g.fillRect(14,26,36,12);
const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace;
return t;
})();
svgApply(medkitTex,'medkit');
const medkitMat=new THREE.MeshLambertMaterial({map:medkitTex});
// 医疗箱占位登记归还: 箱子耗尽/消失时从 PROPS 摘除, 不永久占住地面
function releaseMedkitProp(c){
if(!c.pt) return;
const i=PROPS.indexOf(c.pt);
if(i>=0) PROPS.splice(i,1);
c.pt=null;
}
function removeMedkit(c){
releaseMedkitProp(c);
scene.remove(c.mesh);
MED_CRATES.splice(MED_CRATES.indexOf(c),1);
}
function placeMedkit(owner,x,z){
// 同队 5m 内已有医疗箱 → 不新放: 刷新寿命/用量并转移归属 (扎堆医疗箱精简为一个补给点)
for(const c of MED_CRATES){
if(c.team===owner.team&&c.uses>0&&c.life>0&&Math.hypot(c.x-x,c.z-z)<5){
c.uses=8; c.life=120; c.owner=owner; c.team=owner.team;
return true;
}
}
// 旧箱回收 (同 owner 的上一处)
for(let i=MED_CRATES.length-1;i>=0;i--){
if(MED_CRATES[i].owner===owner) removeMedkit(MED_CRATES[i]);
}
// 落点避障: 占位占用格+道具登记+建筑足迹三查, 偏移兜底, 仍无净位则放弃 (不压弹药箱/沙袋/炮位/墙脚)
// 足迹查豁免旗点平台标记 (footRect 中心=旗点坐标, 0.8 高平台可放箱); 2026-09-12 百团改版:
// verify-layouts 抓到运行时医疗箱落进碉堡足迹 (=埋进墙里), 补齐这项空间避让
let px=x,pz=z,ok=false;
for(const [ox,oz] of [[0,0],[0.9,0.5],[-0.9,0.5],[0.5,-0.9],[-0.5,-0.9],[1.4,0],[-1.4,0],[0,1.4],[0,-1.4]]){
if(occBlocked(x+ox,z+oz)) continue;
if(!propFree(x+ox,z+oz,0.85)) continue;
let footHit=false;
for(const f of B_FOOT){
const fcx=(f.x0+f.x1)/2, fcz=(f.z0+f.z1)/2;
let isFlagRect=false;
for(const fl of FLAGS){ if(Math.abs(fcx-fl.x)<0.1&&Math.abs(fcz-fl.z)<0.1){ isFlagRect=true; break; } }
if(isFlagRect) continue;
if(x+ox>f.x0-0.85&&x+ox<f.x1+0.85&&z+oz>f.z0-0.85&&z+oz<f.z1+0.85){ footHit=true; break; }
}
if(footHit) continue;
px=x+ox; pz=z+oz; ok=true; break;
}
if(!ok){
if(owner.isPlayer) showScorePop('此处放不下医疗箱');
return false;
}
const gh=standHeight(px,pz,owner.pos.y+1);
const m=new THREE.Mesh(new THREE.BoxGeometry(0.6,0.42,0.6),medkitMat);
m.position.set(px,gh+0.21,pz);
m.rotation.y=rand(0,TAU);
m.castShadow=true;
scene.add(m);
MED_CRATES.push({x:px,z:pz,y:gh,team:owner.team,owner,uses:8,life:120,mesh:m,pt:propTake(px,pz,0.85)});
AudioSys.click(700,0.3,0.06);
if(owner.isPlayer) showScorePop('医疗箱已放置');
return true;
}
function updateMedCrates(dt){
for(let i=MED_CRATES.length-1;i>=0;i--){
const c=MED_CRATES[i];
c.life-=dt;
if(c.life<=0||c.uses<=0){ removeMedkit(c); continue; }
c.mesh.position.y=c.y+0.21+Math.sin(nowT*2.2+i)*0.02;
// 贴身自动补给仅对 Bot (soldiers 不含玩家); 玩家走 F 交互 → 医疗箱升级为需交互的补给点
for(const s of soldiers){
if(c.uses<=0) break;
if(!s.alive||s.team!==c.team||s.onVehicle) continue;
if(s.bandages>=s.maxBandages) continue;
if((s.bandRefillT||0)>nowT) continue;
if(Math.hypot(s.pos.x-c.x,s.pos.z-c.z)<2.6&&Math.abs(s.pos.y-c.y)<3){
s.bandages=s.maxBandages;
s.bandRefillT=nowT+8;
c.uses--;
if(c.owner&&c.owner!==s){ c.owner.score=(c.owner.score||0)+10; if(c.owner.isPlayer) showScorePop('+10 补给绷带'); }
}
}
}
}
// 死亡热度记录: AI选出生点时规避高危区
const DEATH_HEAT=[];
function noteDeath(x,z){
DEATH_HEAT.push({x,z,t:nowT});
if(DEATH_HEAT.length>50) DEATH_HEAT.shift();
}
// 当前"前线"参考点: 破袭=最近补给库, 攻防/征服=最近的敌方/争夺旗, 遭遇/劫道=两基地中点
function frontlinePoint(team){
if(GAMEMODE==='demolition'){
const d=nearestDepot(BASES[team].x,BASES[team].z);
if(d) return d;
}
if(!FLAGS.length){
if(GAMEMODE==='convoy'){
// 劫道: 前线=存活车队重心 (车队开到哪, 战斗焦点在哪)
let n=0,sx=0,sz=0;
for(const t of trucks){ if(t.alive){ sx+=t.pos.x; sz+=t.pos.z; n++; } }
if(n) return {x:sx/n,z:sz/n};
return {x:0,z:0};
}
// 遭遇战强点 (2026-09-13 草原库尔斯克改版): 前线=未被本方稳固持有 (敌占/中立) 强点的重心
if(typeof SPOTS!=='undefined'&&SPOTS.length){
let n=0,sx=0,sz=0;
for(const s of SPOTS){
if(s.own===team&&s.capTeam===-1) continue;
sx+=s.x; sz+=s.z; n++;
}
if(n) return {x:sx/n,z:sz/n};
}
return {x:(BASES[0].x+BASES[1].x)/2,z:(BASES[0].z+BASES[1].z)/2};
}
let best=null,bd=1e9;
for(const f of FLAGS){
if(f.owner===team&&f.capTeam===-1) continue;
const dd=Math.hypot(f.x-BASES[team].x,f.z-BASES[team].z);
if(dd<bd){ bd=dd; best=f; }
}
return best||FLAGS[0];
}
// ═════ 出生点位 → 多路出发区 (2026-09-20 二轮翻新) ═════
// 一轮(09-19)解决的是"同一点位内部落点叠人"; 二轮定位到真因在**点位分配层**:
//   ① 开局批量生成跑在旗帜归属赋值之前 (23-deploy startMatch) —— FLAGS 初始 owner=-1, 没有
//      CAMPAIGN.spawns 的地图候选点位只剩主基地 1 个: 实测诺曼底 10/10、胡康 13/13 全落在主基地;
//   ② 选点是"单人 argmax": 同一批人输入几乎相同 → 全选同一点位。拥挤度惩罚 (32m 内每人 -22)
//      压不住"离战线近"的分量 (0.85/米: 胡康桥西离战线 49m vs 基地 282m, 差 200 分),
//      于是中后局众数点位吃 48~88% 的重生 (用户实报"任何时候大部分都在某一个点位集中生成")。
// 现在: 把每个官方点位 (主基地/己方旗点/强点/前出点/护卫车队) 展开成**多路出发区 (lane)** ——
//   以点位为圆心、朝战线方向为轴, 基地 4 路 / 其它点位 3 路, 每路一条独立扇区 (方位角区间 + 径向带);
//   选点先选 lane, 再在 lane 内采样落点。跨人分散用软天平 (用户 2026-09-20 选定: 不设硬上限):
//     ① lane 使用热度 —— 最近 SPAWN_USE_WIN 秒内该 lane 的出生次数线性衰减求和 × SPAWN_USE_W:
//        同一批/连续重生不会反复砸同一个 lane, 用满自动轮转到本点位其它 lane 或其它点位;
//     ② lane 活人拥挤 —— 28m 内同队存活 (含本帧占位认领) 加权和 × LANE_CROWD_W: 往空处推;
//     ③ 落点级 —— 建筑足迹硬排除 + 最近邻距离评分 + 同帧占位互斥 (一轮成果保留)。
// 口径: 出发区只围绕官方点位展开, 不在地图中部凭空生成 (用户 2026-09-20 选定)。
const SPAWN_LANES_BASE=4;  // 基地扇区数 (前 / 左前 / 右前 / 侧翼)
const SPAWN_LANES_PT=3;    // 旗点/强点/前出点扇区数
const SPAWN_ARC=1.72;      // 扇区半张角 (弧度): 覆盖朝战线 ±98°, 背后不生成
const SPAWN_USE_WIN=20;    // lane 使用热度窗口 (秒)
const SPAWN_USE_W=96;      // 一次近期出生对其次数的扣分 (软天平主项)
const SPAWN_USE_CAP=2.5;   // lane 使用热度扣分封顶 (× SPAWN_USE_W) —— 封顶 = 有记忆的平局裁决,
                           //   只翻转"战略分差 < 240"的选项, 绝不把人丢到战术上说不通的地方
const SPAWN_PT_W=70;       // 点位级使用热度权重 (跨点位轮转: 同一个点位连吃几批后让位给次优点位)
const SPAWN_PT_CAP=2.5;    // 点位级扣分封顶 (× SPAWN_PT_W): 胡康实测只靠 lane 轮转时桥东仍吃 88%,
                           //   加这一项后桥东用满即轮到东滩/东岸寨/基地 —— 仍是软天平, 不是硬上限
const LANE_CROWD_W=34;     // lane 活人拥挤度权重
const SPAWN_USE=[];        // 近期出生记录 {k:lane key, p:点位 key, t:nowT}
function noteSpawnUse(k,p){
SPAWN_USE.push({k,p,t:nowT});
for(let i=SPAWN_USE.length-1;i>=0;i--) if(nowT-SPAWN_USE[i].t>SPAWN_USE_WIN) SPAWN_USE.splice(i,1);
if(SPAWN_USE.length>400) SPAWN_USE.splice(0,SPAWN_USE.length-400);
}
function spawnUseAt(k){
let s=0;
for(const u of SPAWN_USE){ if(u.k!==k) continue; const age=nowT-u.t; if(age>=SPAWN_USE_WIN) continue; s+=1-age/SPAWN_USE_WIN; }
return s;
}
function spawnUseAtPt(p){
let s=0;
for(const u of SPAWN_USE){ if(u.p!==p) continue; const age=nowT-u.t; if(age>=SPAWN_USE_WIN) continue; s+=1-age/SPAWN_USE_WIN; }
return s;
}
// 点位 → 朝战线的单位方向 (无旗无强点时朝敌方基地)
function spawnAxisDir(team,x,z){
const fl=frontlinePoint(team);
let tx=0,tz=0;
if(fl){ tx=fl.x; tz=fl.z; }
else { const eb=BASES[1-team]||basePos(1-team); if(eb){ tx=eb.x; tz=eb.z; } }
const dx=tx-x, dz=tz-z, l=Math.hypot(dx,dz);
if(l<0.001) return [0,0];
return [dx/l,dz/l];
}
// 候选点位 → lane 列表 (每次调用重建; key 稳定, 供使用热度跨帧识别)
// ★2026-11-18 卡顿审计: lane 表 0.5s 缓存 —— 重生风暴 (链爆/大爆炸同帧多死) 每个重生者都全量重建
//   ~67 条 lane 对象再各自全表评分; 缓存后同窗口共享一次建表。FLAGS/SPOTS 表换代 (新局) 即失效;
//   强点/旗点归属变化最多滞后 0.5s 才进 lane 表 (不可感知)。convoy 车队 lane 随车动且建表消耗
//   rand 抖动 (RNG 流纪律) ⇒ 该模式直通不缓存。
const _laneCache=[null,null];
function spawnLanesOf(team){
if(GAMEMODE!=='convoy'){
const _lc=_laneCache[team];
if(_lc&&_lc.flags===FLAGS&&(typeof SPOTS==='undefined'||_lc.spots===SPOTS)&&nowT-_lc.t<0.5) return _lc.lanes;
}
const pts=[];
if(BASES.length) pts.push({n:'BASE',x:BASES[team].x,z:BASES[team].z,base:true});
for(const f of FLAGS) if(f.owner===team) pts.push({n:'F'+f.id,x:f.x,z:f.z,flag:f});
for(const sp of spawnPtsOf(team)) pts.push({n:'S'+sp.name,x:sp.x,z:sp.z,spot:sp});
// 劫道: 护运方随车重生 (无基地)
if(GAMEMODE==='convoy'&&CAMPAIGN.convoy&&team===CAMPAIGN.convoy.escortTeam){
for(const t of trucks){
if(!t.alive||t.escaped) continue;
pts.push({n:'C'+pts.length,x:t.pos.x+rand(-3,3),z:t.pos.z+rand(-4,4),truck:true});
}
}
const out=[];
for(const p of pts){
const isBase=!!p.base;
const n=isBase?SPAWN_LANES_BASE:SPAWN_LANES_PT;
const fr=(p.flag&&p.flag.r)||13;
const r0=isBase?12:Math.max(6,fr*0.5);
const r1=isBase?44:Math.max(13,fr*1.7);
const ax=spawnAxisDir(team,p.x,p.z);
const axis=Math.atan2(ax[0],ax[1]);
for(let i=0;i<n;i++){
const ang=axis-SPAWN_ARC+2*SPAWN_ARC*((i+0.5)/n);
const mid=(r0+r1)/2;
out.push({x:p.x,z:p.z,n:p.n,kind:isBase?'base':(p.flag?'flag':'spot'),
key:p.n+'#'+i, ang, half:SPAWN_ARC/n, r0, r1,
cx:p.x+Math.cos(ang)*mid, cz:p.z+Math.sin(ang)*mid, spot:p});
}
}
if(GAMEMODE!=='convoy') _laneCache[team]={t:nowT,lanes:out,flags:FLAGS,spots:(typeof SPOTS==='undefined')?null:SPOTS};
return out;
}
// 选 lane: 战略分 (战线近/危险低/热度低) − lane 拥挤 − lane 使用热度 (软天平)
function pickSpawnFor(team){
const lanes=spawnLanesOf(team);
if(!lanes.length){
// 兜底 (劫道护运方车队全毁且前出点被夺/无基地): 退回本阵营 basePos, 再退世界原点 —— 旧版此处
// 会直接把 opts[0] (可能是 undefined) 交给落点采样, 属潜在崩溃点。
const fb=(typeof basePos==='function')?basePos(team):null;
const bx=(fb&&isFinite(fb.x))?fb.x:0, bz=(fb&&isFinite(fb.z))?fb.z:0;
return {x:bx,z:bz,n:'FALLBACK',kind:'base',key:'FALLBACK#0',ang:0,half:Math.PI,r0:0,r1:7,cx:bx,cz:bz,spot:{x:bx,z:bz,base:true}};
}
const fl=frontlinePoint(team);
let best=lanes[0],bs=-1e9;
for(const L of lanes){
let sc=rand(0,22);
// 战线偏好: 距离当前战斗焦点越近越好 (与原口径一致)
if(fl) sc-=Math.hypot(fl.x-L.cx,fl.z-L.cz)*0.85;
// 危险评估: 附近敌人
let nearestEnemy=1e9,eCnt=0;
for(const c of combatants){
if(!c.alive||c.team===team) continue;
const d=Math.hypot(c.pos.x-L.cx,c.pos.z-L.cz);
if(d<nearestEnemy) nearestEnemy=d;
if(d<45) eCnt++;
}
if(nearestEnemy<16) sc-=280; else if(nearestEnemy<30) sc-=100;
sc-=eCnt*16;
// 死亡热度: 该区域近期阵亡越多越危险 → 绕开绞肉机
let heat=0;
for(const h of DEATH_HEAT){ if(nowT-h.t<25&&Math.hypot(h.x-L.cx,h.z-L.cz)<24) heat++; }
sc-=heat*32;
// 正被己方争夺的旗点加分 (支援占领)
for(const f of FLAGS){ if(f.capTeam===team) sc+=40-Math.hypot(f.x-L.cx,f.z-L.cz)*0.3; }
// 基地保底安全分
if(L.kind==='base') sc+=14;
// ① lane 活人拥挤 (软天平): 同队存活 + 本帧已认领落点
let crowd=0;
for(const c of combatants){
if(!c.alive||c.team!==team) continue;
const d=Math.hypot(c.pos.x-L.cx,c.pos.z-L.cz);
if(d<28) crowd+=1-d/28;
}
for(const p of SPAWN_CLAIMS){ const d=Math.hypot(p.x-L.cx,p.z-L.cz); if(d<28) crowd+=1-d/28; }
sc-=crowd*LANE_CROWD_W;
// ② lane 使用热度 (软天平主项): 最近用过的 lane 自动让位, 同一批人因此分头出发
sc-=Math.min(spawnUseAt(L.key),SPAWN_USE_CAP)*SPAWN_USE_W;
// ③ 点位使用热度 (跨点位轮转): 同一个点位连吃几批后让位给次优点位 —— 只影响战略分接近的候选
sc-=Math.min(spawnUseAtPt(L.n),SPAWN_PT_CAP)*SPAWN_PT_W;
if(sc>bs){ bs=sc; best=L; }
}
return best;
}
// ═════ 出生落点选择 (2026-09-19 首版, 2026-09-20 支持 lane 扇区) ═════
// lane 模式: 在扇区的方位角区间 × 径向带上采样; 非 lane 模式 (玩家部署传入 {x,z,base,r}):
// 沿用首版整环采样。两种模式共用门槛/评分/占位认领。
// 旧版落点语义: pickSpawnFor 返回**一个坐标**, 落点再用 findFreeSpawn(±2m 随机) 摊开 ——
// 既没有"别人在哪"的概念, 也不做建筑足迹判定, 于是同一批人叠在同一个点上。
const SPAWN_CLAIMS=[]; // 本帧已被占用的落点 (跨士兵互斥; 每帧由 updateSpawnClaims 清理)
const _spawnDiag={picks:0,strict:0,relaxed:0,fallback:0,try:0,rejClear:0,rejFire:0,rejEdge:0,clSum:0,clMin:undefined}; // 分支计数 (探针/控制台自检)
let _spawnClaimT=-1;
function updateSpawnClaims(){
if(_spawnClaimT!==nowT){ _spawnClaimT=nowT; SPAWN_CLAIMS.length=0; }
}
function spawnLandingClear(x,z,margin){
// (2026-11-10: 旧"大舰甲板出生豁免"capDeckOf 分支随大舰子系统下架摘除)
if(occBlocked(x,z)) return false;
if(!freeSpot(x,z,margin===undefined?0.9:margin)) return false; // 建筑足迹 (freeSpot: B_FOOT)
// 死袋闸 (2026-09-26): 该点所在 5m 格必须"走得出去" —— 判据与 findPath 共用同一张连通分量表 (NAV.spawnSpotOk)。
// 为什么需要: 5m 格 + 0.9m 采样是保守判据, 物理上能挤过去的窄门在格图上可能整片封死; 强点工事环
// (草原遭遇 7 个 spawns: 对角沙袋环+箱桶+拒马) 或一件随机落在门线上的道具, 就能把点位圈成 2~5 格的死袋 ——
// 沙箱实测 风车磨坊/北原哨/麦田农庄 三个强点都会这样, 且每次换局随布景漂移; 落进去的兵对任何目标
// findPath 恒为 null ⇒ 整局站桩 ("无路可走就不动")。环里的合格落点通常就在环外 3~10m, 下面几轮环扫自然找到。
if(typeof NAV!=='undefined'&&NAV.spawnSpotOk&&!NAV.spawnSpotOk(x,z)) return false;
return true;
}
// ── 出生离边门 (2026-11-13 批, 单源) ──
// 世界边缘是软夹取 (collideMove → WORLD_ACTOR_LIMIT) 无致死屏障, 但 procgen 建筑锚点可到
// MAP_SIZE/2−12 (房身外伸后墙可贴到边内 ~4m)、手摆预设图 placeAt 连锚点门都没有 ⇒
// "特定朝向房子 × 世界边缘"的楔形缝会卡死出生兵 (用户实报)。落点必须离活动夹取极限
// (WORLD_ACTOR_LIMIT=MAP_SIZE/2−4) 至少 SPAWN_EDGE_MARGIN (00-config 单源, 默认 20m)。
// 消费点: pickSpawnPoint 候选闸 + 最终保险 / findFreeSpawn / NAV.spawnSpot / cmdSquadSpawnNear /
// 开局小队铺开。typeof 守卫兜住只加载本文件的沙箱 (00-config 未载时退回 160−24 同式)。
function spawnEdgeLim(){
return (((typeof MAP_SIZE==='number')?MAP_SIZE:320)/2)-4-((typeof SPAWN_EDGE_MARGIN==='number')?SPAWN_EDGE_MARGIN:20);
}
function spawnEdgeOk(x,z){
const l=spawnEdgeLim();
return Math.abs(x)<=l&&Math.abs(z)<=l;
}
function spawnEdgeClamp(x,z){
const l=spawnEdgeLim();
return [clamp(x,-l,l),clamp(z,-l,l)];
}
function spawnClearance(x,z,team){
let best=1e9;
for(const c of combatants){
if(!c.alive||c.team!==team) continue;
const d=Math.hypot(c.pos.x-x,c.pos.z-z);
if(d<best) best=d;
}
for(const p of SPAWN_CLAIMS){
const d=Math.hypot(p.x-x,p.z-z);
if(d<best) best=d;
}
return best;
}
function pickSpawnPoint(team,spot){
updateSpawnClaims();
const isLane=!!(spot&&spot.key); // lane → 扇区采样; 否则整环采样 (玩家部署)
// 可摊开半径: 基地给足 (20m), 旗点/强点按圈半径; 死点位兜底 7m (非 lane 模式口径不变)
const R=Math.max(7,Math.min(22,(spot&&spot.base)?20:(spot&&spot.r?spot.r*0.8:12)));
const tryRings=(ringN,dirN,jitter,margin)=>{
let b=null,bs=-1e9,bc=0;
for(let ring=0;ring<=ringN;ring++){
const n=isLane?dirN:(ring===0?1:dirN);
const rr=isLane?(ringN?spot.r0+(spot.r1-spot.r0)*(ring/ringN):spot.r0):(ring===0?0:ring*(R/ringN));
for(let k=0;k<n;k++){
let px,pz;
if(isLane){
const step=2*spot.half/n;
const a=spot.ang-spot.half+step*(k+0.5)+rand(-step*0.34,step*0.34);
px=spot.x+Math.cos(a)*rr+rand(-jitter,jitter);
pz=spot.z+Math.sin(a)*rr+rand(-jitter,jitter);
} else {
const a=ring===0?0:(k/n)*TAU+ring*0.29;
px=spot.x+Math.cos(a)*rr+(ring===0?rand(-1,1):rand(-jitter,jitter));
pz=spot.z+Math.sin(a)*rr+(ring===0?rand(-1,1):rand(-jitter,jitter));
}
_spawnDiag.try++;
if(!spawnEdgeOk(px,pz)){ _spawnDiag.rejEdge++; continue; }   // 出生离边门 (2026-11-13): "房子×世界边"楔缝免疫, 候选直接拒
if(!spawnLandingClear(px,pz,margin)){ _spawnDiag.rejClear++; continue; }
if(fireThreat&&fireThreat(px,pz,1.6)){ _spawnDiag.rejFire++; continue; } // 别往火线里丢人
if(tbThreat&&tbThreat(px,pz,1.6)){ _spawnDiag.rejFire++; continue; }    // 树爆弹着圈
const distC=Math.hypot(px-spot.x,pz-spot.z);
// 拥挤度评分: 对 22m 内**每一个**同队单位求和 —— 只惩罚"最近邻"会让 4m 间隔的一整片人堆照样拿满分。
// 权重刻意低于最近邻项 (0.85 < 2.4): 它只负责"往空处推", 绝不盖过"别叠人"这条硬指标。
let crowd=0;
const crowdAt=(ax,az)=>{
const d=Math.hypot(ax-px,az-pz);
if(d<22) crowd+=1-Math.exp(-d/4.5);
};
for(const c of combatants){ if(c.alive&&c.team===team) crowdAt(c.pos.x,c.pos.z); }
for(const p of SPAWN_CLAIMS) crowdAt(p.x,p.z);
const cl=Math.min(spawnClearance(px,pz,team),26);
// 敌情/死亡热度软惩罚 (2026-10-06 生成平衡批): 旧版这条评分**完全不看敌人** —— 玩家部署路径直接调本函数,
//   旗点被围时照样往敌人脸上落人, 落地/拿补给即被秒 (用户实报)。现在两条路径单源共享:
//   <16m 重罚 / <30m 中罚 / 45m 内按敌兵数扣 + 死亡热度 (25s 内死过人的地方回避), 数值与 pickSpawnFor
//   的 lane 层惩罚同款 (16/280、30/100、45/16、24m/32) —— Bot 路径 lane 层粗判 + 落点层精判两级叠加,
//   软惩罚不设硬门 (整圈都被围时相对排序仍会挑最不坏的一个, 不会拒绝出生)。
let eNear=1e9,eCnt=0;
for(const c of combatants){
if(!c.alive||c.team===team) continue;
const d=Math.hypot(c.pos.x-px,c.pos.z-pz);
if(d<eNear) eNear=d;
if(d<45) eCnt++;
}
const ePen=(eNear<16)?280:((eNear<30)?100:0);
let dHeat=0;
for(const h of DEATH_HEAT){ if(nowT-h.t<25&&Math.hypot(h.x-px,h.z-pz)<24) dHeat++; }
const sc=cl*2.4-crowd*0.85-distC*0.3-ePen-eCnt*16-dHeat*32-rand(0,2.0);
if(sc>bs){ bs=sc; b={x:px,z:pz}; bc=cl; }
}
if(b&&bc>9&&ring>0) break; // 已经有像样的间距就不必再往外找
}
return b?{b,cl:bc}:null;
};
// 主搜索: 严格门槛 (0.9m 足迹余量 + 火线/弹着圈排除)
let got=tryRings(isLane?2:3,isLane?7:12,isLane?0.9:1.1,0.9);
const strictHit=!!got;
// ② 放宽门槛重试 (2026-09-19): 密集出生点 (基地里堆满车辆/工事/建筑角) 常常整圈不含格 ——
//    旧版这里直接掉进 ±2m 的 findFreeSpawn, 8 个人全落在同一个 4m 方块里 (实测柏林 1.81m 最近邻)。
//    改成先用窄门槛再搜一轮 (仍需不占格 + 不在建筑足迹内), 只在"全图都挤满"时才退化。
if(!got) got=tryRings(isLane?2:3,isLane?9:16,0.55,0.35);
let best, bestCl;
_spawnDiag.picks++;
if(got){
best=got.b; bestCl=got.cl;
// 严格门槛命中 = 主搜索出结果; 放宽门槛命中 = 主搜索无果后重试出结果
if(strictHit) _spawnDiag.strict++; else _spawnDiag.relaxed++;
}
else{
_spawnDiag.fallback++;
const fb=findFreeSpawn(spot.x,spot.z);
// 兜底也要过死袋闸 (2026-09-26): 两轮环扫全被拒 (整片都挤满 / 整片落在死袋里) 时这里是最后一道 ——
// 宁可把落点搬到环外几米, 也不能把兵丢进"对任何目标都无路"的袋子里 (搬不动就退回原落点, 不改变旧行为)。
if(typeof NAV!=='undefined'&&NAV.spawnSpot){
const sp2=NAV.spawnSpot(fb[0],fb[1],24);
best={x:sp2[0],z:sp2[1]};
}else best={x:fb[0],z:fb[1]};
bestCl=0;
}
// 出生离边门最终保险 (2026-11-13): 两轮环扫+兜底全没挡住 (极端: 整圈被拒且 NAV.spawnSpot 搬不动)
// 时把落点钳回边带, 绝不在贴边原点落人。
if(!spawnEdgeOk(best.x,best.z)){ const _ec=spawnEdgeClamp(best.x,best.z); best.x=_ec[0]; best.z=_ec[1]; }
SPAWN_CLAIMS.push({x:best.x,z:best.z});
// lane 使用热度登记 (软天平跨人分散主项) + 本路方位 (供 Bot.pickObjective 多路推进)
if(isLane){
noteSpawnUse(spot.key,spot.n);
best.laneDx=Math.cos(spot.ang); best.laneDz=Math.sin(spot.ang);
}
best.clearance=bestCl;
_spawnDiag.clSum+=bestCl; _spawnDiag.clMin=Math.min(_spawnDiag.clMin===undefined?1e9:_spawnDiag.clMin,bestCl);
return best;
}
// 出生落点质量自检 (探针 dev/probe-spawn 用; 也可在控制台随时看)
// 2026-09-20 加: 每队可用 lane 数 / 最近窗口内各 lane 使用次数 —— 排查"是否又集中到某一个点位"
function spawnLaneStats(team){
const lanes=spawnLanesOf(team);
const use=lanes.map(L=>+spawnUseAt(L.key).toFixed(2));
let nz=0,mx=0,mk='-';
for(let i=0;i<lanes.length;i++){ if(use[i]>0.01) nz++; if(use[i]>mx){ mx=use[i]; mk=lanes[i].key; } }
const pts={};
for(const L of lanes) pts[L.n]=+(spawnUseAtPt(L.n)).toFixed(2);
return {lanes:lanes.length,usedLanes:nz,maxUse:mx,maxKey:mk,use,points:pts};
}
function spawnQualityStats(){
const q={diag:_spawnDiag,byTeam:[{n:0,cl:0},{n:0,cl:0}]};
q.fallbackRate=+(100*_spawnDiag.fallback/Math.max(1,_spawnDiag.picks)).toFixed(1);
q.lane0=spawnLaneStats(0); q.lane1=spawnLaneStats(1);
for(const s of soldiers){
if(!s.alive) continue;
const c=Math.min(spawnClearance(s.pos.x,s.pos.z,s.team),26);
q.byTeam[s.team].n++; q.byTeam[s.team].cl+=c;
}
for(const t of [0,1]) if(q.byTeam[t].n) q.byTeam[t].cl=+(q.byTeam[t].cl/q.byTeam[t].n).toFixed(2);
return q;
}
// 反舰炮位 (2026-09-20N 海战批, 用户第 7 条「我选 1+3」): 独立于 atGun 的第二套岸防火力 ——
// 由 15f-battery.js 自持 (读 CAMPAIGN.sea.batteries 锚点 + seaCoastLines() 现算落位/朝向),
// **不进 ATGUNS/AAGUNS** (那两张表按索引快照)。★ 调用点必须在文件末尾: 上面全部 atGun/aaGun
// 落位与随机数序列一字不动 ⇒ 陆战零漂移; 非环海图 (SEA=null) 在 15f 内于任何 rand 之前早退。
if(typeof buildBatteries==='function') buildBatteries();
