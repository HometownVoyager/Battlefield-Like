// ─────────────────────────────────────────────
// 15c-specveh.js —— 观战专属载具「幽灵坦克」(2026-09-17 观战扩展批)
// 用户指定 (四项裁定见 PLAN §一.14): 观战模式下独有的载具 —— **全白色材质 / 不受索敌与伤害 /
//   子弹炮弹等一律穿过去 / 可以开火对双方造成伤害**。
// 设计要点 (为什么能一行行满足这四条):
//   ① **不进 tanks / trucks 数组** —— 全库的弹丸与索敌都是"遍历 tanks/combatants":
//      fireBullet(子弹) / updateShells(炮弹) / splashDamage(溅射) / updateFlak(防空弹) /
//      updateNades(手雷·炸弹·反坦克雷) / updateMineTriggers(反坦克雷) / 14-bots 索敌 /
//      15-vehicles.turretAI(坦克炮) / 16-aircraft.planeAI(飞机扫射) —— 独立类天然满足
//      "不被索敌 + 弹丸穿透 + 爆炸免疫"; 不调用 vehiclePushSoldiers 即人车互穿; takeDmg 空实现=完全免伤。
//   ② 开火走既有管线 (与坦克同一份弹道), 但 **炮弹 team=-1** (无差别口径, 与巡飞弹同源) 且驾驶员
//      `player.ffAll=true` (raySoldiers / 命中载具时的敌我过滤跳过) → 双方步兵与载具一律吃伤害;
//      开火不产生 gunEvents (观战开火不惊动士兵, 与观战步兵同一口径)。
//   ③ **不投影 (castShadow=false)**: 无实体感, 与"弹丸穿透"同一套直觉。
//   ④ 行驶仍与建筑/障碍物推挤 (幽灵撞不塌也碾不毁 —— 2026-09-28 用户裁定放宽: 普通坦克**能碾**的
//      掩体 (挂牌 crush) 不再挡幽灵, 幽灵直接"穿"过去, 世界原样不毁; 其余障碍照旧被挡住),
//      底盘高度与姿态复用坦克的 tankRideH/tankSurfH 单源 —— 越野跨越观感与坦克一致。
// 驾驶员仍是 player 本体; 本类在结构上与 20a-seats.updatePlayerTank 的座驾接口一致
//   (def/pos/yaw/turretYaw/turretPitch/vel/cannonCd/cdMax/pitchG/muzzle/aimDir/coaxMuzzle/
//    fireCannon/firePlayerMG), 因此驾驶/相机/落点准星/HUD 热条全部原样复用。
// 生命周期: 观战者首次部署/打开部署界面时在本方主基地后方就位 → 靠近按 F 上车 / 部署界面
//   「观战载具」选项直接上车; 对局退场 (retireMatchActors/世界还原) 调 specVehReset 收车。
// ─────────────────────────────────────────────
'use strict';
// 幽灵坦克参数 (单源: 调参只改这张表)
const GHOST_DEF={
name:'幽灵坦克',
hp:1,            // 免伤: 血量只是"载具存活"的占位读数 (HUD 不显示血条)
spd:14,          // 比坦克快 (观测用), 倒车 7
rev:7, turn:1.15, tRate:3.2,
reload:1.1,      // 主炮装填 (无差别火力: 射速略快于坦克, 便于观战演示)
dmg:520,         // 主炮单发基础伤害 (与谢尔曼同档)
barrelL:3.4, hullL:5.9
};
const GHOST_HIT_R=0.38; // 载具自身与静态体的推挤半径 (仅行驶用; 弹丸不参与)
class GhostTank {
constructor(){
this.kind='ghost';
this.team=-1;                 // 无阵营: 伤害口径由炮弹 team=-1 + player.ffAll 承载
this.def=GHOST_DEF;
this.name=this.def.name;
this.hp=1; this.maxHp=1; this.alive=false;
this.spawned=false;
this.pos=V3(); this.yaw=0; this.turretYaw=0; this.turretPitch=0; this.vel=0;
this.playerDriven=false; this.isAI=false;
// A#4 契约 C (2026-09-21): 主炮 CD 恒 0 —— cannonCd 不再是"装填计时"而是恒 0 的只读占位 (HUD 装填条按 cdMax||def.reload 读,
// 恒 0 显示满格); cdMax 也置 0 (20a-seats 的连杀增益 reloadMul 对 0 无效 ⇒ 幽灵坦克不吃装填增益)。
this.cannonCd=0; this.mgT=0; this.cdMax=0;
// A#3 契约 A: 幽灵坦克**不参与**机枪热量 (不积热/不显示条)。这两个字段恒为 0 且全文件不写 —— 保留字段只为
// 让 HUD/探针按统一口径读到 0 (kind==='ghost' 的条由 sea-hud 隐藏)。
this.heat=0; this.heatLock=false;
this.suspP=0; this.suspR=0; this.suspPV=0; this.suspRV=0;
this.muzzle=V3();
this.buildMesh();
this.engine=AudioSys.createEngine('tank');
}
// 全白车体: 主体纯白 + 行走部分极浅灰 (仍是"白车", 只为读出体块), 轻微自发光保证阴天/逆光下仍是白的
buildMesh(){
const D=this.def, L=D.hullL;
this.matWhite=new THREE.MeshLambertMaterial({color:0xffffff,emissive:0x5e5e5e});
this.matGear=new THREE.MeshLambertMaterial({color:0xf2f2f2,emissive:0x4a4a4a});
const W=this.matWhite, G2=this.matGear;
this.grp=new THREE.Group();
const h=new THREE.Mesh(new THREE.BoxGeometry(2.6,0.95,L),W); h.position.y=1.0; this.grp.add(h);
const gl=new THREE.Mesh(new THREE.BoxGeometry(2.6,0.24,1.15),W);
gl.position.set(0,1.12,L/2-0.18); gl.rotation.x=-0.62; this.grp.add(gl);
const gr=new THREE.Mesh(new THREE.BoxGeometry(2.6,0.22,0.9),W);
gr.position.set(0,1.05,-L/2+0.15); gr.rotation.x=0.55; this.grp.add(gr);
// 行走机构: 与真坦克**同源** (tkSpec 派生 + trackBandGeo 带环 + 负重轮 + 翼板) —— 2026-09-28 换掉实心盒。
// 幽灵坦克是观战者看得最多的一辆车, 旧版沿用 (0.62×0.92×L+0.25) 的实心盒 ⇒ 侧视图整条下缘是一块板、
// 轮子被埋在盒里 (与用户实报的"履带是一整个侧面"同一个毛病)。带环几何本就与材质无关, 直接复用,
// 只把两段材质都换成"行走部分"的浅灰 (幽灵不挂履带花纹贴图, 全白剪影口径不变)。
const GS=tkSpec({hullL:L},{shape:'vickers',hullW:2.6,hullH:0.95,hullY:1.0,trkSx:1.62,whR:0.36,whN:5,glacis:-0.30,skirt:0,paint:'plain'});
const bandGeo=trackBandGeo(GS);
this.wheels=[];
for(const sx of [-1,1]){
const tr=new THREE.Mesh(bandGeo,[G2,G2]); tr.name='trackBand';
tr.position.set(sx*GS.trkSx,0,0); this.grp.add(tr);
const fd=new THREE.Mesh(new THREE.BoxGeometry(GS.fendW,0.08,GS.L+0.3),W);
fd.position.set(sx*GS.trkSx,GS.fendY,0); this.grp.add(fd);
for(let i=0;i<GS.whN;i++){
const lz=GS.tb.cR+i*(GS.tb.cF-GS.tb.cR)/(GS.whN-1);
const wh=new THREE.Mesh(new THREE.CylinderGeometry(GS.whR,GS.whR,GS.whW,10),G2);
wh.rotation.z=HPI;
wh.position.set(sx*GS.trkSx,GS.whY,lz);
this.grp.add(wh); this.wheels.push(wh);
}
}
this.turretG=new THREE.Group(); this.turretG.position.y=1.78; this.grp.add(this.turretG);
const tc=new THREE.Mesh(new THREE.CylinderGeometry(1.15,1.28,0.72,12),W);
tc.position.y=0.12; this.turretG.add(tc);
const cup=new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.38,0.28,10),W);
cup.position.set(-0.4,0.56,-0.3); this.turretG.add(cup);
this.pitchG=new THREE.Group(); this.pitchG.position.set(0,0.15,1.05); this.turretG.add(this.pitchG);
this.pitchG.add(new THREE.Mesh(new THREE.BoxGeometry(0.85,0.6,0.4),W));
const bar=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.13,D.barrelL,8),G2);
bar.position.set(0,0.02,D.barrelL/2); bar.rotation.x=HPI; this.pitchG.add(bar);
const coax=new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.05,0.9,6),G2);
coax.position.set(0.42,-0.05,0.7); coax.rotation.x=HPI; this.pitchG.add(coax);
this.barrelTip=D.barrelL+1.15;
// 幽灵不投影: 没有实体感的视觉口径 (与"弹丸穿透/免伤"一致)
this.grp.traverse(o=>{ if(o.isMesh){ o.castShadow=false; o.receiveShadow=false; } });
}
aimDir(){
const a=this.yaw+this.turretYaw, p=this.turretPitch;
return V3(Math.sin(a)*Math.cos(p),Math.sin(p),Math.cos(a)*Math.cos(p));
}
coaxMuzzle(){
const a=this.yaw+this.turretYaw;
const sn=Math.sin(a),cs=Math.cos(a);
return V3(this.pos.x+cs*0.42+sn*2.2,this.pos.y+1.88,this.pos.z-sn*0.42+cs*2.2);
}
// 帧更新: 位移积分 → 静态体推挤 (不破坏世界) → 底盘高度/悬挂姿态 → 模型与炮口
// (射速冷却在这里走: 玩家驾驶时 20a-seats 只负责输入, 冷却归载具自身 —— 与 Tank.update 同一分工)
update(dt){
if(!this.alive) return;
this.cannonCd=0; this.mgT-=dt; // A#4: 主炮 CD 恒 0 (不再走 -=dt 的装填计时; 幽灵坦克无装填)
this.pitchG.visible=!(this.playerDriven&&player.tankView); // 车长镜隐藏炮管防穿模 (同坦克)
const sn=Math.sin(this.yaw), cs=Math.cos(this.yaw);
this.pos.x+=sn*this.vel*dt; this.pos.z+=cs*this.vel*dt;
// 静态体推挤: 与坦克同法 (两遍 三圆), 但**不碾不撞** —— 幽灵不对世界造成任何破坏
if(Math.abs(this.vel)>1e-4){
for(let pass=0;pass<2;pass++){
for(const off of [-1.95,0,1.95]){
const cxp=this.pos.x+sn*off, czp=this.pos.z+cs*off;
eachBoxNear(cxp-1.56,czp-1.56,cxp+1.56,czp+1.56,b=>{
if(b.dead||this.pos.y+2<b.minY||this.pos.y>b.maxY) return;
if(b.maxY-b.gh<0.7) return;
// 2026-09-28 用户裁定「增强幽灵坦克越野」: 可碾掩体**整类放行** —— 普通坦克能碾毁的东西 (沙袋/木箱/
// 石墙/树篱/倒木, 挂牌 crush, 见 15-vehicles 越野碾压段) 不再挡幽灵坦克; 幽灵不对世界造成破坏 ⇒
// 是"穿过去"而非"碾过去", 掩体原样留存 (与"弹丸穿透/免伤"同一套无实体感直觉)。
// 低矮可越野件 (≤TANK_STEP 且无 dGroup) 照旧放行, 底盘高度由 tankRideH 承接。
if(b.crush||(!b.dGroup&&b.maxY-b.gh<=TANK_STEP)) return;
const cx=clamp(cxp,b.minX,b.maxX), cz=clamp(czp,b.minZ,b.maxZ);
const dx=cxp-cx, dz=czp-cz;
const d2=dx*dx+dz*dz;
if(d2>=1.55*1.55) return;
let pnx=0, pnz=0;
if(d2>1e-8){
const d=Math.sqrt(d2);
pnx=dx/d; pnz=dz/d;
const push=Math.min(0.35,(1.55-d)/d);
this.pos.x+=dx*push; this.pos.z+=dz*push;
}else{
const l=Math.min(cxp-b.minX,b.maxX-cxp), r2=Math.min(czp-b.minZ,b.maxZ-czp);
if(l<r2){ pnx=(cxp-b.minX<b.maxX-cxp)?-1:1; this.pos.x+=pnx*(l+1.55); }
else { pnz=(czp-b.minZ<b.maxZ-czp)?-1:1; this.pos.z+=pnz*(r2+1.55); }
}
if(pass===0){
const mvX=sn*Math.sign(this.vel), mvZ=cs*Math.sign(this.vel);
const facing=-(pnx*mvX+pnz*mvZ);
this.vel*=facing>0.5?0.35:facing>0.15?0.66:0.92;
}
});
eachCylNear(cxp-3.7,czp-3.7,cxp+3.7,czp+3.7,c=>{
if(c.r<0.3) return;
if(c.y1-c.y0<=TANK_STEP) return; // 低矮圆柱 (油桶/石碾) 直接驶过
const dx=cxp-c.x, dz=czp-c.z;
const rr=c.r+1.5, d2=dx*dx+dz*dz;
if(d2<rr*rr&&d2>1e-8){
const d=Math.sqrt(d2), push=Math.min(0.3,(rr-d)/d*0.6);
this.pos.x+=dx*push; this.pos.z+=dz*push;
this.vel*=0.75;
}
});
}
}
}
const lim=MAP_SIZE/2+6;
this.pos.x=clamp(this.pos.x,-lim,lim); this.pos.z=clamp(this.pos.z,-lim,lim);
// 底盘高度 + 悬挂姿态: 与坦克同一组采样单源 (跨越低矮障碍会上坡-颠簸-下坡)
this.pos.y=dampF(this.pos.y,tankRideH(this.pos.x,this.pos.z,this.pos.y),8,dt);
const hF=tankSurfH(this.pos.x+sn*2.4,this.pos.z+cs*2.4), hB=tankSurfH(this.pos.x-sn*2.4,this.pos.z-cs*2.4);
const hL=tankSurfH(this.pos.x-cs*1.6,this.pos.z+sn*1.6), hR=tankSurfH(this.pos.x+cs*1.6,this.pos.z-sn*1.6);
const tgtP=-Math.atan2(hF-hB,4.8), tgtR=Math.atan2(hR-hL,3.2);
this.suspPV+=((tgtP-this.suspP)*46-this.suspPV*7.5)*dt; this.suspP+=this.suspPV*dt;
this.suspRV+=((tgtR-this.suspR)*46-this.suspRV*7.5)*dt; this.suspR+=this.suspRV*dt;
this.grp.position.copy(this.pos);
this.grp.rotation.order='YXZ';
this.grp.rotation.set(this.suspP,this.yaw,this.suspR);
this.turretG.rotation.y=this.turretYaw;
this.pitchG.rotation.x=-this.turretPitch;
const dir=this.aimDir();
this.muzzle.set(this.pos.x+dir.x*this.barrelTip,this.pos.y+1.93+dir.y*this.barrelTip,this.pos.z+dir.z*this.barrelTip);
// 幽灵引擎: 只有玩家驾驶时可闻的低沉底噪 (无驾驶=全静)
const dCam=this.pos.distanceTo(camera.position);
this.engine.update(46+Math.abs(this.vel)*5,this.playerDriven?clamp(0.16-dCam/90,0,0.16):0);
}
// 主炮: 与坦克同弹道, 但炮弹 team=-1 = **无差别** (双方步兵/坦克/卡车/飞机一律吃伤害与命中)
// A#4 契约 C (2026-09-21): **主炮 CD 恒 0** —— 不再读 cannonCd (无门控), 也不再写它/不吃连杀增益的 reloadMul;
// GHOST_DEF.reload 字段保留但不再用于门控 (HUD 装填条由 sea-hud 对 kind==='ghost' 隐藏)。
fireCannon(customDir){
let dir=this.aimDir();
if(customDir) dir=customDir;
const origin=this.muzzle.clone();
player._src=this.name; // 击杀来源: 记入载具名
// 2026-09-28 用户裁定: 幽灵坦克开火**无音效** —— 主炮无间隔 (CD 恒 0), 按住扳机每帧一声炮响太吵。
// 只静音不改观感: 炮口焰/烟与弹丸照旧; 炮弹落点的爆炸声归弹丸子系统, 不在本处。
spawnP(PT.flash,origin.x,origin.y,origin.z, dir.x*3,dir.y*3,dir.z*3, 1.0,10,0.12,1,0,true);
spawnP(PT.dark,origin.x,origin.y,origin.z, dir.x*3+rand(-1,1),1.5,dir.z*3+rand(-1,1), 1.0,3,0.9,0.7,0.5);
// 2026-09-21 WS5 用户裁定: 幽灵坦克开炮**不震屏** —— 本行原为 addTrauma(0.5), 已删。
// 与普通坦克 (15-vehicles.js:1108 的 if(this.playerDriven) addTrauma(0.5)) 是**两份独立代码**,
// 删这里不动陆战手感; 观战者开炮不震 = "弹丸穿透/无实体感"这条设计口径的延伸。
shells.push({pos:origin.clone(),vel:dir.clone().multiplyScalar(SHELL_SPD),team:-1,owner:player,life:3.6,kind:'tank',dmgV:this.def.dmg,trail:0,src:this.name}); // src: 弹体自带标签, 命中时重盖章 (2026-09-29)
player.lastFiredT=nowT;
// 观战开火不上报枪声事件 (不惊动士兵/Bot, 与观战步兵同一口径)
}
// 同轴机枪: 走 fireBullet, 驾驶员 ffAll=true 让敌我过滤失效 (双方步兵/载具均为合法目标)
firePlayerMG(dir){
if(this.mgT>0) return;
this.mgT=0.08;
const o=this.coaxMuzzle();
player._src=this.name;
fireBullet(player,o,dir,MG_BULLET_DEF,o);
// 2026-09-28 用户裁定: 同轴机枪同样**无音效** (旧 AudioSys.gunshot('mg',0,0) 已删) —— 与主炮同一条口径。
// 2026-09-21 WS5 用户裁定: 同轴机枪同样不震屏 —— 本行原为 addTrauma(0.02), 已删
// (普通坦克的 15-vehicles.js:1125 addTrauma(0.02) 一字未动)。
}
// 完全免伤: 任何来源 (子弹/炮弹/溅射/空爆/撞击/激流) 一律无效
takeDmg(){ return; }
}
// ═════ 单例与生命周期 ═════
let SPECVEH=null;
// A#4 v3 (2026-09-21 Lead 裁定: 实例泄漏): 收车后的**实例池** —— 一台幽灵坦克 = 一整组几何 + 一个引擎音频对象
// (GhostTank 构造里 AudioSys.createEngine('tank')); 观战者"召唤→下车"N 轮若每轮 new 一台, 就漏 N 个引擎节点与几何
// (上一批海战刚修过同型的节点泄漏)。收车进池、召唤复用 ⇒ 全生命周期只构造一次。
let _GHOST_POOL=null;
function specVehGet(){ return SPECVEH||(SPECVEH=_GHOST_POOL||new GhostTank()); }
// 就位 (不激活): 摆到某点, 车头默认朝地图中心; 同时复位悬挂与炮塔
function specVehPlaceAt(x,z,yaw){
const g=specVehGet();
g.pos.set(x,0,z); g.pos.y=heightAt(x,z);
g.yaw=(yaw===undefined)?Math.atan2(-x,-z):yaw;
g.vel=0; g.turretYaw=0; g.turretPitch=0;
g.suspP=0; g.suspR=0; g.suspPV=0; g.suspRV=0;
g.grp.position.copy(g.pos);
g.grp.rotation.set(0,g.yaw,0);
return g;
}
// 待用位: 本方主基地后方 15m (坦克出生位在基地前方 ±15, 这里是后侧; 基地 19m 净空环内无工事)
function specVehSpawnAtBase(){
const bp=basePos(player.team);
return specVehPlaceAt(bp.x-(player.team===0?15:-15),bp.z);
}
// 激活 (首用): 挂进 world 并置于待用位; 已激活则原样返回 (停在被下车的位置)
// A#4 v3 复用路径: 从实例池捞回来的车 grp 已摘出 world (grp.parent===null) ⇒ 与首用走同一段复位
// (spawned/alive/hp/grp.visible + 挂回 world + 就位), 并把可能被替换过的材质还原 (与 Tank.respawn 同口径)。
function specVehEnsureAtBase(){
const g=specVehGet();
if(!g.spawned||!g.grp.parent){
g.spawned=true; g.alive=true; g.hp=g.maxHp;
g.grp.visible=true;
g.grp.traverse(o=>{ if(o.isMesh&&o.userData.mat0) o.material=o.userData.mat0; });
world.add(g.grp);
specVehSpawnAtBase();
}
return g;
}
// 就位到某点**旁边** (部署伴随 / 召唤用): 依次试 4 个方位, 都不通就落在脚下
function specVehPlaceNear(x,z){
for(const off of [[4.5,0],[-4.5,0],[0,4.5],[0,-4.5]]){
const tx=x+off[0], tz=z+off[1];
if(!occBlocked(tx,tz)) return specVehPlaceAt(tx,tz);
}
return specVehPlaceAt(x,z);
}
// 随叫随到 (2026-09-17 修: 用户实报"开始时不选幽灵坦克就一整局没有"): 观战者在任何地方按 F,
// 附近没有车时 → 车立刻在身旁显形并直接上车 (观战专属玩具不该被"开局那一次选择"绑死)
function specVehSummon(){
const g=specVehEnsureAtBase();
specVehPlaceNear(player.pos.x,player.pos.z);
specVehBoard(g);
return g;
}
// 附近可上车的幽灵载具 (观战提示/交互共用)
function specVehNear(x,z,d){
const g=SPECVEH;
if(!g||!g.alive||g.playerDriven) return null;
return Math.hypot(g.pos.x-x,g.pos.z-z)<d?g:null;
}
// 上车: 玩家本体接管 (退出观战飞行), 置 ffAll 无差别火力标记
function specVehBoard(g){
if(!g||!g.alive||g.playerDriven) return false;
// ★2026-09-22 座位互斥 (用户实报"F 的鱼雷/下车与召唤幽灵坦克冲突"的结构性病根):
//   两个座位字段 (player.onVehicle / player.onNaval) 必须**同一时刻最多有一个非空** —— 旧版上幽灵坦克
//   不清 onNaval, 于是 player 既在艇上又在白车里, updatePlayer 走 updatePlayerNaval 把驾驶权交给艇,
//   相机/HUD 却按幽灵坦克渲染。这里在上车瞬间交还海战座位 (与 20a 的 navalSeatRelease 同一条路径)。
if(player.onNaval&&typeof navalSeatRelease==='function') navalSeatRelease(false);
player.onNaval=null;
g.playerDriven=true; g.vel=0;
player.onVehicle=g; player.ffAll=true;
player.flying=false; player.flyAero=false; player._aeroSpd=0;
player.ads=false; player.nadeHeld=false; player.crouch=false; player.prone=false;
player.tankView=false;
player.yaw=g.yaw+g.turretYaw+Math.PI; player.pitch=0;
player.pos.copy(g.pos); player.vel.set(0,0,0);
VM.root.visible=false;
document.getElementById('heatWrap').style.display='block';
return true;
}
// 下车: 解绑并把玩家放到车旁空地 (与坦克下车同一套落点探测)
// A#4 契约 C (2026-09-21): 下车 = **立刻收车** —— 走 specVehStow() (摘 grp/停引擎/SPECVEH=null),
// 不留残骸、不排重生冷却 (下次召唤是全新就位, 随叫随到)。
function specVehDismount(){
const g=SPECVEH;
if(!g||player.onVehicle!==g) return false;
let px=g.pos.x+3.2, pz=g.pos.z;
for(const off of [[3.2,0],[-3.2,0],[0,4],[0,-4],[4,4]]){
const tx=g.pos.x+off[0], tz=g.pos.z+off[1];
if(!occBlocked(tx,tz)){ px=tx; pz=tz; break; }
}
player.pos.set(px,0,pz);
player.pos.y=standHeight(px,pz,g.pos.y+2);
player.vel.set(0,0,0);
specVehStow();
VM.root.visible=true;
document.getElementById('heatWrap').style.display='none';
return true;
}
// A#4 契约 C (2026-09-21): 立刻收车 —— 从 world 摘 grp + 停引擎 + SPECVEH=null + 解绑 player.onVehicle 与驾驶态。
// 不留残骸 (不建 wreck / 不排下沉任务)、不排重生冷却 (无 respawnT 语义); 收车后场景里不再有这台车。
// 口径说明: 不动 spawned/alive (它们表达"这个实例可复用", 与"场景里有没有车"分开) —— 场景层的唯一判据是
//   SPECVEH===null + grp 不在 world; 这样 dev/verify-spec.js 的既有断言 (T9 收车后旧实例 g.spawned 仍为 true)
//   与新契约验收 (SPECVEH===null / grp 不在 scene) 同时成立。specVehReset 保持原样 (保留实例, 供换局复用)。
function specVehStow(){
const g=SPECVEH;
if(!g) return false;
specVehUnbind();                 // 解绑: playerDriven=false + player.onVehicle=null + ffAll/tankView 复位
if(g.grp.parent) g.grp.parent.remove(g.grp);
g.grp.visible=false;
g.vel=0; g.cannonCd=0; g.cdMax=0; g.mgT=0;
g.turretYaw=0; g.turretPitch=0;
try{ g.engine.stop(); }catch(e){}
_GHOST_POOL=g;                   // A#4 v3: 实例进池 (引擎/几何复用, 不再每轮 new 一台)
SPECVEH=null;                    // 单例置空: 场景里不再有这台车 (下次召唤走 specVehGet 从池里捞)
const hw=document.getElementById('heatWrap'); if(hw) hw.style.display='none';
return true;
}
// 仅解绑 (退场/死亡/换局用, 不布置玩家)
function specVehUnbind(){
const g=SPECVEH;
if(g){ g.playerDriven=false; g.vel=0; }
if(player.onVehicle&&player.onVehicle.kind==='ghost') player.onVehicle=null;
player.ffAll=false; player.tankView=false;
}
// 收车 (对局退场/世界还原): 解绑 + 摘出 world + 停引擎; 下次观战再 specVehEnsureAtBase 就位
function specVehReset(){
specVehUnbind();
const g=SPECVEH;
if(!g) return;
g.alive=false; g.spawned=false; g.hp=g.maxHp;
if(g.grp.parent) g.grp.parent.remove(g.grp);
g.grp.visible=false;
try{ g.engine.stop(); }catch(e){}
}
// 主循环挂点 (24-main): 仅在已激活时更新
function updateSpecVeh(dt){
const g=SPECVEH;
if(g&&g.spawned) g.update(dt);
}
// 小地图/调试用只读视图
function specVehInfo(){
const g=SPECVEH;
return g?{spawned:g.spawned,alive:g.alive,driven:g.playerDriven,x:g.pos.x,y:g.pos.y,z:g.pos.z,vel:g.vel,cannonCd:g.cannonCd}:null;
}
