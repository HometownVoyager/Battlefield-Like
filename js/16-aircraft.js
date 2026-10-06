// ─────────────────────────────────────────────
// 16-aircraft.js —— 飞机/防空炮/坠机残骸
// 源: Index.original.html 第 6207-6607 行
// (2026-09-06 B7a: 切分遗留的 16a-defs.js 死表已删, 数据单源在 00-config FACTIONS[...].planes)
// ─────────────────────────────────────────────
'use strict';
const planes=[], flakShots=[], planeWrecks=[];
// 战机重生时"等专属飞行员归队"的硬上限 (秒): 超过即把生还的飞行员连同新机一起收回座舱。
// 定 10s 的依据: 战机战损到重生之间的 dead 计时是 35~48s (die() 里 rand(35,48)), 跳伞下降只需 5~8s ——
// 这 10s 纯粹是"别在他还挂在伞上时把人瞬移进座舱"的余量, 不是等他打完这一仗。
const PLANE_PILOT_WAIT_MAX=10;
function updatePlaneWrecks(dt){
for(let i=planeWrecks.length-1;i>=0;i--){
const w=planeWrecks[i];
if(w.state==='fall'){
w.vel.y-=8.5*dt;
w.pos.addScaledVector(w.vel,dt);
w.roll+=w.rollV*dt;
w.pitch=dampF(w.pitch,-0.9,0.6,dt);
w.yaw+=w.rollV*0.06*dt;
w.m.position.copy(w.pos);
w.m.rotation.order='YXZ';
w.m.rotation.set(-w.pitch,w.yaw,w.roll);
w.smokeT-=dt;
if(w.smokeT<=0){
w.smokeT=0.05;
spawnP(PT.dark,w.pos.x,w.pos.y,w.pos.z,rand(-0.5,0.5),rand(0.5,1.5),rand(-0.5,0.5),1.0,1.6,rand(0.9,1.4),0.7,0.2);
spawnP(PT.flash,w.pos.x,w.pos.y,w.pos.z,rand(-1,1),rand(-1,1),rand(-1,1),rand(0.4,0.7),0.5,0.22,0.9,0,true);
}
const gh=(typeof planeFloorY==='function')?planeFloorY(w.pos.x,w.pos.z):heightAt(w.pos.x,w.pos.z);
// ★2026-10-03 (纯海图残骸坠海): heightAt 在 opensea 给的是海床 (水下 22~26m) ⇒ 坠机在海底"触地爆炸",
//   残骸沉在看不见的海底烧。改用水面地板 (与 planeFloorY 单源): 触水即爆+溅落, 残骸浮在水面烧完再沉。
if(w.pos.y<=gh+0.6){
// 坠地爆炸: 无差别杀伤 + 留下焦黑残骸
w.state='rest';
w.pos.y=gh+0.45;
explosionFX(w.pos.clone().add(V3(0,0.8,0)));
AudioSys.explosion(w.pos.distanceTo(camera.position)*0.8);
splashDamage(w.pos,w.attacker,-1,9,165,240);
damageStructures(w.pos,8,280,w.attacker||null); // 4参 = 破坏得分归属: 坠机撞塌的楼算击落者的战果
crater(w.pos.x,w.pos.z,1.6,true);
// 坠机残骸 = 持续火源: 残骸停留期间燃起大火, 点燃周边植被并灼烧靠近者
w.fireSrc=addFireSource(w.pos.x,w.pos.z,w.pos.y+0.8,4.2,w.restT,24,w.attacker||null);
igniteArea(w.pos.x,w.pos.z,3.8,w.attacker||null);
w.m.traverse(o=>{ if(o.isMesh) o.material=wreckMat; });
w.m.rotation.set(rand(-0.15,0.15),w.yaw,rand(-0.4,0.4));
w.m.position.copy(w.pos);
w.col=registerDynCollider(w.pos.x,gh+0.7,w.pos.z,3.6,1.4,3.6);
}
} else if(w.sinking){
// 沉没推进已收敛 queueSink (2026-09-06 B7b/P2-4)
} else {
w.restT-=dt;
w.smokeT-=dt;
if(w.smokeT<=0&&w.restT>6){
w.smokeT=0.16;
spawnP(PT.dark,w.pos.x+rand(-1,1),w.pos.y+0.8,w.pos.z+rand(-1,1),rand(-0.2,0.2),rand(0.8,1.6),rand(-0.2,0.2),0.8,1.5,rand(1.2,2),0.55,0.15);
}
if(w.restT<=0){
// 残骸沉入地下: 开始下沉即熄火(不再是火源), 半沉撤碰撞, 全沉移除 —— 收敛 queueSink (2026-09-06 B7b/P2-4)
w.sinking=true;
if(w.fireSrc){ removeFireSource(w.fireSrc); w.fireSrc=null; }
queueSink({objs:[w.m],rest:0,sink:4,depth:4.6,
onHalf:()=>{ if(w.col){ killDynCollider(w.col); w.col=null; } },
onTick:(dtk,k)=>{ if(k<0.9&&Math.random()<dtk*2) spawnP(PT.dark,w.pos.x+rand(-1.6,1.6),w.m.position.y+rand(0.3,1),w.pos.z+rand(-1.6,1.6),rand(-0.3,0.3),rand(0.4,1),rand(-0.3,0.3),0.6,1.2,rand(0.8,1.3),0.5,0.45); },
onDone:()=>{ scene.remove(w.m); const j=planeWrecks.indexOf(w); if(j>=0) planeWrecks.splice(j,1); }});
}
}
}
}
// 全图最高地形高度: 惰性全图采样一次并缓存 (AI 巡航层与地形规避共用)。
// 有山战役的主峰高度决定 AI 飞机必须飞多高才不会撞山
let TERR_MAX_H=null;
function terrainMaxH(){if(TERR_MAX_H===null){
TERR_MAX_H=0;
const R=MAP_SIZE/2, st=R/24;
for(let x=-R;x<=R;x+=st)
for(let z=-R;z<=R;z+=st){
const h=heightAt(x,z);
if(h>TERR_MAX_H) TERR_MAX_H=h;
}
}
return TERR_MAX_H;
}
// 飞机的"地板"高度 (2026-10-01b 修"全海图没有撞地线"): heightAt 在 opensea 给的是**海床** (海面下
//   22~26m) —— 旧版撞地线 = 海床+2 ⇒ 飞机可以贴着浪底飞、扎进海里不炸。地形/水面取较高者为地板。
//   非水域 waterYAt 返回 −1e8 ⇒ 逐位退化为 heightAt (既有 13 图零变化)。
function planeFloorY(x,z){
const gh=heightAt(x,z);
if(typeof waterYAt!=='function') return gh;
const wy=waterYAt(x,z);
return (wy>-1e8)?Math.max(gh,wy):gh;
}
// ══════════════════════════════════════════════════════════════════════
// 战机剪影几何工厂 (2026-09-20 I2 批: 按国家/机型出可辨识剪影)
// 口径 (用户已确认): P-51 层流翼+机腹散热器 / BF-109 方翼尖+机头桨毂炮 / La-5 星型粗机头 /
//   零式 细长机身+椭圆翼 / 霍克III 双翼 / 隼 各自剪影; 纯程序化几何, 不加外部资源。
// 数据单源: 00-config.js 的 FACTIONS[...].planes[i].pl (尺寸以 def.size=1 为基准, 建模统一乘 s)。
// 硬约束 (改动前必读): ①this.prop 必须保留 (update() 走 prop.rotation.z 转桨)
//   ②this.navLight / this.beacon / this.beaconMat 保留 (尾灯+悬浮信标是敌我识别, 无替代)
//   ③翼展/机身长相对旧建模 ≤±15% (13-combat 命中圆柱 r=2.3*size / ±1.2*size, size 语义与数值不变)
// ══════════════════════════════════════════════════════════════════════
const PL_DEF={shape:'mustang',span:7.6,flen:3.6,fr:0.34,nose:'inline',tip:'square',fin:0.80,canopy:0.30,belly:0,biplane:0,pylons:0};
function plSpec(pl){ // 缺省兜底: 无 pl 的老数据按旧建模比例出模型 (不会崩, 只是没剪影特征)
const r=pl||{};
return {shape:r.shape||PL_DEF.shape, span:r.span||PL_DEF.span, flen:r.flen||PL_DEF.flen, fr:r.fr||PL_DEF.fr,
 nose:r.nose||PL_DEF.nose, tip:r.tip||PL_DEF.tip, fin:r.fin||PL_DEF.fin, canopy:r.canopy||PL_DEF.canopy,
 belly:r.belly?1:0, biplane:r.biplane?1:0, pylons:r.pylons?1:0};
}
// 停机/拦阻的甲板抬升量 (2026-10-01d, 实机"飞机在起飞之前是嵌在甲板上的"): Plane 的网格原点在
//   **机身轴线** (螺旋桨 y=0, 建模无起落架 —— 剪影口径), 机腹最低探到 −(FR+0.17×size)。把 pos.y
//   钉在甲板面等于半截机身埋进甲板。停机 = 机腹着陆: 抬升量 = 机腹最低点 + 余量 (0.07×size),
//   停放/拦阻/停驻三处同读这一支 (15h capParkPlanes / capTryArrest / capArrestTick)。
function plParkLift(pl){
const P=plSpec(pl&&pl.def&&pl.def.pl), s=(pl&&pl.def&&pl.def.size)||1;
return P.fr*s+0.24*s;
}
// 机身: 尾细前粗锥筒 + 机鼻档 (inline 细长机鼻+桨毂锥+桨毂炮 / radial 星型粗机头) + 座舱盖
function planeFuselage(T,P,s,M){
const g=T.grp, FL=P.flen*s, FR=P.fr*s;
const body=new THREE.Mesh(new THREE.CylinderGeometry(FR*0.55,FR,FL*0.76,10),M.body);
body.rotation.x=-HPI; body.position.z=-FL*0.08; g.add(body);
if(P.nose==='radial'){ // 星型: 又粗又钝的整流罩 —— La-5/霍克III/雷电的正面剪影
const cowl=new THREE.Mesh(new THREE.CylinderGeometry(FR*1.24,FR*1.02,FL*0.20,10),M.dark);
cowl.rotation.x=-HPI; cowl.position.z=FL*0.40; g.add(cowl);
}else{ // 直列: 细长机鼻 + 桨毂锥 + (穿出桨毂的机头炮) —— P-51/BF-109/零式
// ★ 2026-09-26 A11 修: 机鼻锥的两个半径**写反了**。rotation.x=-HPI 把本地 +Y 映到世界 -Z (= 机尾),
//   而 CylinderGeometry(rTop,rBottom) 的 rTop 在 +Y ⇒ 第 1 参是**机鼻端**、第 2 参是**座舱端**。
//   旧写法 (0.46, 0.88) = 前端 0.46FR / 后端 0.88FR —— 那是个朝前收口的喇叭口, 与上面星型整流罩
//   (1.24 后 / 1.02 前) 的口径方向正好成对照; 直列机鼻应当是"根粗尖细"(根部 ~0.88FR、桨毂处 ~0.46FR)。
const nose=new THREE.Mesh(new THREE.CylinderGeometry(FR*0.88,FR*0.46,FL*0.18,10),M.body);
nose.rotation.x=-HPI; nose.position.z=FL*0.39; g.add(nose);
const spin=new THREE.Mesh(new THREE.ConeGeometry(FR*0.44,FL*0.10,8),M.dark);
spin.rotation.x=HPI; spin.position.z=FL*0.45; g.add(spin);
const ng=new THREE.Mesh(new THREE.CylinderGeometry(0.05*s,0.06*s,0.34*s,6),M.dark);
ng.rotation.x=HPI; ng.position.z=FL*0.50+0.02*s; g.add(ng); // 桨毂炮: 只探出桨盘一点 (BF-109 的机头炮剪影)
}
const cock=new THREE.Mesh(new THREE.SphereGeometry(P.canopy*s,8,6),M.dark);
cock.scale.z=1.6; // 拉长成舱盖 (前风挡-座舱-后脊)
cock.position.set(0,FR*0.55,FL*0.10); g.add(cock);
}
// 主翼: 中翼段 + 外翼段 (后掠收缩) + 翼尖档 square|clip|round|ellipse; 双翼机再叠上翼
function planeWings(T,P,s,M){
const g=T.grp, FL=P.flen*s, FW=P.span*s/2, chord=Math.max(0.9*s,FL*0.30);
const wz=FL*0.06, wy=-0.04*s;
const tipL=FW*({square:0,clip:0.06,round:0.12,ellipse:0.22}[P.tip]!==undefined?{square:0,clip:0.06,round:0.12,ellipse:0.22}[P.tip]:0);
const wRoot=FW*(P.tip==='ellipse'?0.46:0.52), wOut=Math.max(0.2,FW-wRoot-tipL);
const root=new THREE.Mesh(new THREE.BoxGeometry(wRoot*2,0.10*s,chord),M.body);
root.position.set(0,wy,wz); g.add(root);
for(const sx of[-1,1]){
const out=new THREE.Mesh(new THREE.BoxGeometry(wOut,0.09*s,chord*(P.tip==='clip'?0.60:0.74)),M.body);
out.position.set(sx*(wRoot+wOut/2),wy+0.01*s,wz-chord*0.05); g.add(out);
if(tipL>0.02){ // 圆/椭圆翼尖: 外向圆锥 + 竖向压扁 (零式的椭圆翼展弦比最大)
const rr=chord*({round:0.34,ellipse:0.50}[P.tip]||0.34);
const tip=new THREE.Mesh(new THREE.CylinderGeometry(0.02,rr,tipL,8),M.body);
tip.rotation.z=-sx*HPI;
tip.scale.x=0.12; // 局部 x 旋转后对应世界 y —— 压扁成翼型薄片, 不是纺锤
tip.position.set(sx*(FW-tipL/2),wy,wz-chord*0.08); g.add(tip);
}
}
if(P.biplane){ // 霍克III: 上翼 + 翼间支柱 (双翼机剪影, 一眼分得出)
const uy=P.fr*s+0.30*s;
const up=new THREE.Mesh(new THREE.BoxGeometry(FW*1.72,0.09*s,chord*0.86),M.body);
up.position.set(0,uy,wz); g.add(up);
for(const sx of[-1,1]){
const st=new THREE.Mesh(new THREE.BoxGeometry(0.06*s,uy-wy,0.10*s),M.dark);
st.position.set(sx*FW*0.60,(uy+wy)/2,wz-chord*0.05); g.add(st);
}
}
}
// 尾翼: 平尾 + 垂尾 (垂尾涂队色 —— 2026-09-02 用户指定的敌我识别)
function planeTail(T,P,s,M){
const g=T.grp, FL=P.flen*s, FR=P.fr*s;
const tz=-FL*0.38, chord=Math.max(0.5*s,FL*0.20), finH=P.fin*s;
const stab=new THREE.Mesh(new THREE.BoxGeometry(P.span*s*0.36,0.08*s,chord),M.body);
stab.position.set(0,FR*0.10,tz); g.add(stab);
const fin=new THREE.Mesh(new THREE.BoxGeometry(0.07*s,finH,chord*0.92),M.team);
fin.position.set(0,finH/2,tz); g.add(fin);
}
// 细节: 机腹散热器 (P-51) / 机翼挂架炸弹 (重挂载变体档)
function planeDetails(T,P,s,M){
const g=T.grp, FL=P.flen*s, FR=P.fr*s;
if(P.belly){
const rad=new THREE.Mesh(new THREE.BoxGeometry(FR*1.3,0.30*s,FL*0.28),M.dark);
rad.position.set(0,-FR-0.02*s,FL*0.02); g.add(rad);
}
if(P.pylons) for(const sx of[-1,1]){
const py=new THREE.Mesh(new THREE.SphereGeometry(0.19*s,6,5),M.dark);
py.scale.z=2;
py.position.set(sx*P.span*s*0.22,-FR+0.02*s,FL*0.02); g.add(py);
}
}
class Plane {
constructor(team,variant){
this.kind='plane';
this.team=team; this.variant=variant||0;
this.def=TEAM_FACTION[team].planes[this.variant];
this.name=this.def.name;
this.hp=this.def.hp; this.maxHp=this.def.hp; this.alive=true;
// 出生固定在己方主基地上空 (2026-09-01 用户指定): 无基地战役回退本阵营主力前出点
const bp=basePos(team);
const sx0=bp.x+rand(-14,14), sz0=bp.z+rand(-14,14);
this.pos=V3(sx0,Math.max(65,heightAt(sx0,sz0)+40),sz0);
this.yaw=team===0?0:Math.PI; this.pitch=0; this.speed=PLANE_FLIGHT.birthSpeed; this.roll=0;
// fctl 意图三件 (P3-7a): 玩家 (playerFly) 与 AI (planeAI) 都只写"想怎么飞", 怎么飞由 flightStep 单源积分
this.fctl={bank:0,pitchT:0,spdTgt:PLANE_FLIGHT.patrolSpd};
this.playerDriven=false;
this.crewBot=null; this.pilotBot=null;
this.bombs=this.def.bombs; this.rearmT=0;
this.crew={ name:this.name, team, kills:0, deaths:0, score:0, isPlayer:false, isCrew:true, pos:this.pos, alive:true, lastFiredT:-99, damage(){}, vel:V3() };
this.state='patrol'; this.stateT=rand(6,14);
this.target=null; this.fireT=0; this.bombCd=rand(3,6);
this.evadeT=0; this.evadeDir=1;
this.avdT=0;          // 2026-09-30 实机批: 规避带改出提交计时 (防贴线单帧横跳, 见 planeAI 地形规避段)
this.dogTgt=null;   // 7b-乙 缠斗目标 (不双打分派写; 旧版全员追 enemyPlaneAlive 的第一架)
this.lockTgt=null;  // 7b-丙 玩家锁定目标 (仅玩家驾驶的本机消费; 随 die/respawn 清账)
this.aiPilotOn=false; this.aiPilotTgt=null; this.aiLosT=0; // 7b-丙 AI 接管态 (老飞行员代打)
this.aiEvT=0; this.aiEvCd=0; this.aiEvDir=1; // 7b-丙 热修⑤: 接管规避窗/冷却/破转方向
this.aiEvSrc=null; this.aiEvDur=1.2; // 2026-09-30j 破转反咬: 规避威胁源 (敌机才记, 对地威胁=null=全窗破转) + 窗长 (两段式分界用)
this.respawnT=0; this.smokeT=0;
this.pilotWaitT=0;   // 飞行员生还待命计时 (2026-09-26 见 update() 重生分支)
this.buildMesh();
this.engine=AudioSys.createEngine('plane');
planes.push(this);
}
// ── 建模段 (2026-09-20 I2: 从构造函数原样抽出为方法, 与 class Tank 同构) ──
// 为什么: 沙箱探针 (dev/verify-vehmodels.js) 要能在不启动整局游戏的前提下单独构建模型量尺寸;
//         几何/父子关系/加入 world 的时机与抽出前逐字一致, 只是可被外部调用。
buildMesh(){
const D=this.def, s=D.size, P=plSpec(D.pl); // 剪影规格 (00-config FACTIONS[...].planes[i].pl, 单一数据源)
const mat=new THREE.MeshLambertMaterial({color:D.col, map:TEX.grime});
const dark=new THREE.MeshLambertMaterial({color:0x33362e,map:TEX.grime}); // B8/P3-12 整流罩/深色件
const tcCol=TEAM_COL[this.team];
const markMat=new THREE.MeshBasicMaterial({color:tcCol});
const M={body:mat, dark, team:new THREE.MeshLambertMaterial({color:tcCol})}; // team: 垂尾队色 (2026-09-02 用户指定)
this.grp=new THREE.Group();
planeFuselage(this,P,s,M);
planeWings(this,P,s,M);
planeTail(this,P,s,M);
planeDetails(this,P,s,M);
// 阵营标识 (2026-09-02 用户指定): 机翼双条纹+垂尾涂队色+尾灯闪烁+悬浮队色三角信标
// 信标: 无视深度遮挡/雾, 恒定世界尺寸4m, 地面玩家远距高空也能一眼辨敌我
for(const sx of [-1,1]){
const band=new THREE.Mesh(new THREE.BoxGeometry(P.span*s*0.10,0.12*s,Math.max(0.9*s,P.flen*s*0.30)*0.95),markMat);
band.position.set(sx*P.span*s*0.20,-0.04*s,P.flen*s*0.06); this.grp.add(band);
}
this.navLight=new THREE.Mesh(new THREE.SphereGeometry(0.1,6,5),markMat);
this.navLight.position.set(0,P.fin*s*0.52,-P.flen*s*0.38); this.grp.add(this.navLight);
const bc=document.createElement('canvas'); bc.width=bc.height=64;
const bg7=bc.getContext('2d');
bg7.fillStyle='#'+(((TEAM_COL[this.team]>>>0).toString(16)).padStart(6,'0'));
bg7.strokeStyle='#ffffff'; bg7.lineWidth=7;
bg7.beginPath(); bg7.moveTo(32,5); bg7.lineTo(59,57); bg7.lineTo(5,57); bg7.closePath();
bg7.fill(); bg7.stroke();
this.beaconMat=new THREE.SpriteMaterial({map:new THREE.CanvasTexture(bc),transparent:true,depthTest:false,depthWrite:false});
this.beacon=new THREE.Sprite(this.beaconMat);
this.beacon.scale.set(4,4,1);
this.beacon.position.set(0,3.4,0);
this.beacon.renderOrder=9;
this.grp.add(this.beacon);
// 4.4 夜航灯 (2026-10-05 昼夜设计, R4): 翼尖红(左)/绿(右)对闪 Sprite —— 纯视觉零玩法;
//   仅夜档创建 (白天零回归)。additive 光点 + 恒定像素尺度, 夜雾里远远可辨。
//   几何走既有 P.span/P.flen 剪影规格, 不触碰 wr/wri 种子流。
if(NIGHT_MODE){
const wingGlow2=(colStr)=>{
const wc=document.createElement('canvas'); wc.width=wc.height=32;
const wg=wc.getContext('2d');
const wgr=wg.createRadialGradient(16,16,1,16,16,16);
wgr.addColorStop(0,'rgba(255,255,255,0.95)'); wgr.addColorStop(0.35,colStr); wgr.addColorStop(1,'rgba(0,0,0,0)');
wg.fillStyle=wgr; wg.fillRect(0,0,32,32);
return new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(wc),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));
};
this.wingNavL=wingGlow2('rgba(255,64,56,0.85)');   // 左红
this.wingNavR=wingGlow2('rgba(72,255,110,0.85)');  // 右绿
const wy=-0.04*s, wz=P.flen*s*0.06, wx=P.span*s*0.47;
this.wingNavL.position.set(-wx,wy,wz); this.wingNavR.position.set(wx,wy,wz);
this.wingNavL.scale.set(1.1,1.1,1); this.wingNavR.scale.set(1.1,1.1,1);
this.grp.add(this.wingNavL); this.grp.add(this.wingNavR);
}
this.prop=new THREE.Mesh(new THREE.BoxGeometry(Math.max(1.6*s,P.span*s*0.24),0.12,0.05),new THREE.MeshLambertMaterial({color:0x1a140e}));
this.prop.position.set(0,0,P.flen*s*0.50+0.08*s);
this.grp.add(this.prop);
this.grp.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
world.add(this.grp);
}
velVec(){
return V3(Math.sin(this.yaw)*Math.cos(this.pitch),Math.sin(this.pitch),Math.cos(this.yaw)*Math.cos(this.pitch)).multiplyScalar(this.speed);
}
fwdDir(){
return V3(Math.sin(this.yaw)*Math.cos(this.pitch),Math.sin(this.pitch),Math.cos(this.yaw)*Math.cos(this.pitch));
}
// ── 飞行核心单源 (P3-7a 2026-09-30): playerFly 与 planeAI 共用的同一套积分器 ──
// 旧版两者各写一套姿态积分 (AI 直写 yaw/pitch/roll/speed, 玩家另写一套带手搓侧滑补偿),
// 机动原语无法复用, "同一架飞机两套物理" —— 现在输入统一为 fctl 意图三件
// {bank 压坡指令 -1..1 / pitchT 俯仰目标 rad / spdTgt 速度目标 m/s}, 积分只有下面这一份;
// 7b 的 AI 重写只换"想怎么飞"的决策层, 不再碰积分。
// ① 滚转: 坡度目标 = 指令×上限×机型敏捷度 (零式压满舵比 IL-2 陡), 阻尼跟随;
// ② 协调转弯 (用户裁定"增强街机", IronSkyAce bankYaw 口径): 偏航率由坡度产生 —— 压坡即转弯,
//    转向率随速度 (spdFac: 慢速舵软/高速舵硬) 与敏捷度缩放; 旧手搓侧滑补偿项删除 (坡度即因)。
//    满舵偏航率 ≈ sin(bankMax)×yawFromBank×spdFac ≈ 0.97 rad/s, 与旧 AI 缠斗 ±1.0 对齐。
// ③ 俯仰: 阻尼跟随指令 (玩家鼠标相对量与 AI 各态解算值走同一条路)。
// ④ 速度: 目标值 + 俯冲加速/爬升掉速 (dive=-sin(pitch)>0 即低头); 俯冲抢出的超速与爬升掉的
//    低速都在回平后自然衰减回机型区间, 上下限 overMul/underMul 兜底 —— 永不失速 (spdFloor 地板)。
flightStep(dt){
const PF=PLANE_FLIGHT, agi=this.def.agil||PF.agil;
this.roll=dampF(this.roll,clamp(this.fctl.bank,-1,1)*PF.bankMax*agi,PF.rollResp,dt);
const spdFac=PF.spdFac0+this.speed*PF.spdFacK;
this.yaw+=-Math.sin(this.roll)*PF.yawFromBank*spdFac*agi*dt;
this.pitch=dampF(this.pitch,clamp(this.fctl.pitchT,PF.pitchMin,PF.pitchMax),PF.pitchResp,dt);
const dive=-Math.sin(this.pitch);
const tgt=clamp(this.fctl.spdTgt+dive*PF.diveGain,this.def.spd[0]*PF.underMul,this.def.spd[1]*PF.overMul);
this.speed=dampF(this.speed,tgt,PF.spdResp,dt);
if(this.speed<PF.spdFloor) this.speed=PF.spdFloor;
}
fireMGBurst(shooter,spreadMul){
const dir=this.fwdDir();
const sp=0.05*spreadMul;
dir.x+=rand(-sp,sp); dir.y+=rand(-sp,sp)*0.8; dir.z+=rand(-sp,sp); dir.normalize();
const o=this.pos.clone().addScaledVector(dir,2.4);
if(shooter) shooter._src=this.name; // 击杀来源: 战机扫射记入战机名
// ★2026-09-26 修 (P1-9 载具伤害口径): 旧版把"打坦克/卡车"写成 fireMGBurst 末尾的两段手写 takeDmg(3) ——
//   ① 不走 vehDmg 口径 (同段对飞机都按 mgDmg*0.7, 全库机枪走 def.vehDmg), ② **不做 raycastWorld 遮挡**
//   (隔着一栋楼/一道山梁也照样刮坦克的血), ③ 与子弹自己的结算重复一次 (同一发弹两个伤害源)。
//   现改为与全库机枪同一条链: 弹体带 vehDmg, 命中/遮挡(墙/水/艇体)/装甲减免/友军裁定全归 fireBullet。
//   数值取 mgDmg×0.18 (17×0.18≈3.06) = **旧手写值那一档**, 强度不变, 只是从此有遮挡、有装甲口径。
// 瞄准吸附 (2026-09-27 用户要求): 航炮 = 机枪档 —— 只有**玩家开的那一架**吃 (AI 机走同一个函数, 但 shooter
// 不是 player); 挂在随机散布之后, 掰的就是这一发串射的最终方向。判据是 shooter 身份, 不是机种。
let dirA=dir;
if(shooter===player&&typeof aimAssistDir==='function') dirA=aimAssistDir(o,dir,'airmg',{team:player.team,ff:false,self:this});
fireBullet(shooter,o,dirA,{dmg:this.def.mgDmg,headMul:1.5,snd:'smg',tracer:1,vehDmg:this.def.mgDmg*0.18,noAirHit:true},o); // noAirHit: 对空伤害由下面显式分层收口, fireBullet 不再对机刮血 (防双份)
// 7c 对空判定 (显式分层, 2026-09-30): 对地/对舰/对人走上面 fireBullet 弹道, 对空由这一段收口 ——
// 判定几何单源 planeHitTest (旧手写平径 3.2 球测绝迹), 并补 raycastWorld 遮挡: 机心之前有山/楼
// ⇒ 弹被世界挡住, 不再隔山伤机 (F7)。伤害口径不变 (mgDmg×0.7, 空空机炮档)。
const ah=planeHitTest(o,dirA,200,this.team);
if(ah&&!raycastWorld(o,dirA,ah.t)){
// 2026-09-30k: Bot 航炮空对空 ×AIR2AIR_BOT_MUL (用户裁定"Bot 飞机对空还是有点太强, 略削一下";
// 玩家射手档不减 —— 接管代打射手也是 player, 同吃豁免)
ah.pl.takeDmg(this.def.mgDmg*0.7*((shooter&&shooter.isPlayer)?1:AIR2AIR_BOT_MUL),shooter);
if(Math.random()<0.3) spawnP(PT.spark,ah.pl.pos.x,ah.pl.pos.y,ah.pl.pos.z,rand(-2,2),rand(-1,1),rand(-2,2),0.2,0,0.2,1,0,true);
// 命中反馈 (2026-09-30 批): 玩家航炮空空命中 —— 旧口径这条显式分层链上没有任何反馈 (fireBullet 的
// 对空刮血反馈只管 noAirHit=false 的弹); 档='mg' 机枪/机炮族。致命一击不补白档 (die 链红档)。
if(shooter&&shooter.isPlayer&&ah.pl.alive&&typeof onPlayerHitAny==='function'){ if(typeof markHitCls==='function') markHitCls('mg'); onPlayerHitAny('mg'); }
}
}
dropBomb(shooter){
const m=new THREE.Mesh(new THREE.SphereGeometry(0.26,8,6),new THREE.MeshLambertMaterial({color:0x24241e}));
const p=this.pos.clone().add(V3(0,-1,0));
m.position.copy(p); m.scale.z=1.8; m.castShadow=true; scene.add(m);
const fv=this.velVec();
// 航弹锁定制导挂账 (2026-09-30k): 投弹瞬间本机带锁定目标 (锁在机上 —— planeLockToggle/planeLockMaintain
// 都写 pl.lockTgt; 玩家 E/中键上锁, 接管代打同吃 —— aiPilotTgt 即玩家锁; Bot 机永远无锁) ⇒ 弹体在
// updateNades 里以限角速度朝目标掰; 无锁/目标中途死亡 = 诚实弹道。
const lk=(this.playerDriven&&this.lockTgt&&this.lockTgt.alive)?this.lockTgt:null;
nades.push({m,pos:p,vel:V3(fv.x*0.85,Math.min(fv.y,0)-4,fv.z*0.85),fuse:6,thrower:shooter||this.crew,team:this.team,bounces:0,spin:V3(1.5,0,0),bomb:true,lock:lk,src:this.name||'航弹'}); // src: 击杀来源记入机型 (2026-09-29)
if(lk) showScorePop(t2('航弹制导: {0}',t2(lk.name||(lk.kind==='tank'?'坦克':'地面目标'))));
AudioSys.metalSlide(0.25,0.12,500,300);
}
update(dt){
// 航母甲板停放态 (P4 2026-09-30, 15h capArrestTick): 停在飞行甲板上的舰载机整帧让位 —— 物理/姿态积分/
// AI/开火全不跑, 只留弹射输入与甲板搬运。无大舰的战役首行即 false ⇒ 既有 13 张图零行为变化。
if(typeof capArrestTick==='function'&&capArrestTick(this,dt)) return;
if(!this.alive){
	this.respawnT-=dt;
	this.engine.update(0,0);
	// 飞行员待命计时 (★2026-09-26 修, P1-13): 单位是**秒**且**每帧**累加 ——
	//   旧写法 `(this.pilotWaitT+=3)` 有两个错: ①单位是帧 (60fps 下 4 帧就撞线 = 0.067s, "等 10 秒"实为下一帧抓人);
	//   ②它在 `respawnT<=0` 的闸**内** ⇒ 只在每 3s 的回退边界累加一次, 换算成时间是 ×3 的隐藏倍率。
	//   现在: 战机死透期间每帧按 dt 累加 (飞行员已死/无飞行员时清零, 由下面两枝立即重生), 计时到期把手上的
	//   回退也一并清零 ⇒ 10s 一到就归队, 不再多等一个 3s 周期。
	// 只有专属飞行员还活着时才算"在等人" (他被击落/没有他, 走下面两枝直接带机重生)
	if(this.pilotBot&&this.pilotBot.alive){
		this.pilotWaitT+=dt;
		if(this.pilotWaitT>=PLANE_PILOT_WAIT_MAX) this.respawnT=Math.min(this.respawnT,0);
	} else this.pilotWaitT=0;
	// 兵力票归零 → 该队战机封重生 (清场阶段敌方不再补充载具, 2026-09-04)
	if(this.respawnT<=0&&!matchOver&&tickets[this.team]>0){
		// 只有专属飞行员阵亡待命时才能连人带机一起重生
if(this.pilotBot&&!this.pilotBot.alive){
this.respawn();
this.pilotBot.spawnInVehicle(this);
} else if(!this.pilotBot){
this.respawn();
} else if(this.pilotWaitT>=PLANE_PILOT_WAIT_MAX){
// ★2026-09-26 修 (P1-13 单位): 旧写法 `this.pilotWaitT+=3` 的累加单位是**帧**, 而常量与注释都是**秒**
// (PLANE_PILOT_WAIT_MAX=10 秒) —— 60fps 下 4 帧就撞线 = 0.067s, "等飞行员 10 秒"实为"下一帧就抓人":
// 跳伞中的飞行员会在伞上被瞬移进座舱。现按 dt 累加, 注释里的 10s 才是真的 10s。
// takeDmg 的 <32% 跳伞生还 (crewBot 已摘、pilotBot 在地面继续战斗): 战机死透后飞行员能活很久,
// 这段回退就永远等不到头 ⇒ 该队空中支援整局消失 (玩家视角: 打掉三成血即永久清空敌机)。
// 现在给"等人"加硬上限: 飞行员落地后仍未归队 → 连同已重生的战机一起收回座舱。
// 走 enterVehicle (不是 spawnInVehicle): 他是**活人**, 必须先按上车口径松掉炮位认领 (mgUse/empUse/batUse)
// 与伞模型, 否则枪座上会留一个永远不释放的占位。不新增士兵 —— 全队 soldiers.length 不变。
this.pilotWaitT=0;
this.respawn();
const pb=this.pilotBot;
if(pb){ if(typeof pb.enterVehicle==='function') pb.enterVehicle(this); else pb.spawnInVehicle(this); }
} else {
this.respawnT=3;
}
}
return;
}
const dCam=this.pos.distanceTo(camera.position);
this.engine.update(120+this.speed*1.5, this.playerDriven?0.16:clamp(0.22-dCam/280,0,0.22));
this.prop.rotation.z+=dt*(20+this.speed*0.5);
this.fireT-=dt; this.bombCd-=dt;
if(this.bombs<this.def.bombs){ this.rearmT-=dt; if(this.rearmT<=0){ this.bombs++; this.rearmT=PLANE_FLIGHT.rearmT; } }
// 驾驶分派: 三条路径都只写 fctl 意图, 姿态/速度积分统一走 flightStep (P3-7a 单源)
if(this.playerDriven){ if(this.aiPilotOn) this.aiPilotFly(dt); else this.playerFly(dt); } // 7b-丙: 接管态=AI 飞行员代打, 同一 fctl 接口
else if(this.crewBot&&this.crewBot.alive){ this.planeAI(dt); }
else {
// 无人驾驶: 失控螺旋坠机 —— 旧版 roll 无界连滚 + 俯仰扎头; 现按 fctl 口径给满舵坡度,
// 由协调转弯自然拧成一股盘旋下坠的螺旋 (乘员已死/被摘, 5 秒级的谢幕演出, 口径见 7a 交付文档)
// 7b-丙: 玩家跳伞/离机 → 接管态随无人驾驶一并收账 (冷却照记, 防落地秒开)
if(this.aiPilotOn){ this.aiPilotOn=false; this.aiPilotTgt=null; this.aiEvSrc=null; player.takeoverCd=PLANE_TAKEOVER.cd; }
this.fctl.bank=0.9; this.fctl.pitchT=-0.5; this.fctl.spdTgt=this.def.spd[1];
}
this.flightStep(dt);
if(this.playerDriven){
// 玩家同步 (旧 playerFly 尾部三行, 移到积分之后: 鼠标俯仰窗回钳 + 本体位姿写回)
player.pitch=clamp(player.pitch,this.pitch-0.35,this.pitch+0.35);
player.yaw=this.yaw+Math.PI;
player.pos.copy(this.pos); player.vel.set(0,0,0);
}
// 位移积分 + 伪升力下沉 (P3-7a ②): 机背朝天分量 cos(pitch)·cos(roll) 越小沉得越快 ——
// 平飞零下沉 (AI 巡航层不泊松掉高), 60° 坡 ≈7 m/s, 倒飞全额 —— 压大坡度必须拉杆补高度
const upY=Math.cos(this.pitch)*Math.cos(this.roll);
this.pos.x+=Math.sin(this.yaw)*Math.cos(this.pitch)*this.speed*dt;
this.pos.z+=Math.cos(this.yaw)*Math.cos(this.pitch)*this.speed*dt;
this.pos.y+=Math.sin(this.pitch)*this.speed*dt-PLANE_FLIGHT.sinkG*(1-Math.max(0,upY))*dt;
if(this.pos.y>PLANE_FLIGHT.ceiling) this.pitch=Math.min(this.pitch,-0.05);
const lim2=MAP_SIZE/2+PLANE_FLIGHT.bound;
if(Math.abs(this.pos.x)>lim2||Math.abs(this.pos.z)>lim2){
const wantYaw=Math.atan2(-this.pos.x,-this.pos.z);
this.yaw=angleLerpTo(this.yaw,wantYaw,(this.playerDriven?PLANE_FLIGHT.boundSteerPl:PLANE_FLIGHT.boundSteerAI)*dt);
}
this.grp.position.copy(this.pos);
this.grp.rotation.order='YXZ';
this.grp.rotation.set(-this.pitch,this.yaw,this.roll);
this.navLight.visible=Math.sin(nowT*4+this.team*3)>-0.2; // 尾灯闪烁: 队色自发光, 阴天/逆光也可辨
this.beaconMat.opacity=0.6+0.4*Math.sin(nowT*2.6+this.team*2.3); // 悬浮信标脉动 (两队相位不同)
if(this.wingNavL){ // 4.4 夜航灯 (昼夜设计 §4.4): 翼尖红/绿闪 —— 纯视觉零玩法, 仅夜档创建
this.wingNavL.visible=Math.sin(nowT*3.4)>-0.15;
this.wingNavR.visible=Math.sin(nowT*3.4+Math.PI)>-0.15; // 左右反相 = 经典导航灯对闪
}
if(this.hp<this.maxHp*0.5){
this.smokeT-=dt;
if(this.smokeT<=0){ this.smokeT=0.06;
spawnP(PT.dark,this.pos.x,this.pos.y,this.pos.z,0,0,0,0.8,1.2,1.2,0.6,0);
}
}
// ★2026-10-04 (B14 机-舰实体碰撞): 纯海图上旧版机与舰**零碰撞** —— 俯冲几何失误的机直接穿过舰体。
//   判定只取**舰体带** (capitalSolidAt: 水线~甲板面): ①AI 攻击剖面瞄甲板面+1.2m, 改出线=水面上 16m
//   —— 低于航母舰岛顶 (~20m), 若把上层建筑也设为撞毁面, 投弹后改出的机会成批"撞岛自杀"
//   (probe-planes 撞山死 7/8 实测), 舰岛掠过维持既有视觉简化; ②甲板停放的机不走这里
//   (capArrestTick 在 update 首行整帧接管); 弹射出膛点在甲板面上方 1.2m, 在 +0.25 空域门外。
if(typeof capitalSolidAt==='function'){
const capHit=capitalSolidAt(this.pos.x,this.pos.y,this.pos.z);
if(capHit){ this.pos.y=Math.max(this.pos.y,capHit.surf); this.die(this.lastHitBy||null); return; }
}
const gh=planeFloorY(this.pos.x,this.pos.z);
if(this.pos.y<gh+2) this.die(this.lastHitBy||null);
}
planeAI(dt){
this.stateT-=dt;
// ── 地形规避 (修 AI 撞山): 沿航向前方 60/130/200m 三点采样, 预测净空不足即提前拉起,
//    同时向地形更低的一侧转向。旧版只有俯冲/缠斗状态有 14~16m 的临死反应式拉起,
//    巡逻状态完全没有规避 —— 高山地图巡航层 62m 会直接穿山自毁。
//    俯冲攻击用收窄裕度: 允许贴近山顶目标攻击, 但保证来得及拉起 ──
const fx2=Math.sin(this.yaw), fz2=Math.cos(this.yaw);
const gh0=planeFloorY(this.pos.x,this.pos.z);
const l1=planeFloorY(this.pos.x+fx2*60,this.pos.z+fz2*60);
const l2=planeFloorY(this.pos.x+fx2*130,this.pos.z+fz2*130);
const l3=planeFloorY(this.pos.x+fx2*200,this.pos.z+fz2*200);
// 当前脚下地形也设下限 (峰肩越岭时前方采样可能还低、脚下已顶到)
const need=this.state==='dive'?Math.max(gh0+10,l1+13,l2+9):Math.max(gh0+16,l1+17,l2+13,l3+9);
// 2026-09-30 实机批 (用户报"动作十分生硬"): 改出**提交** 1s —— 净空贴着 need 线时旧版逐帧
// "触发→爬过线→放回攻击几何→又沉回线内"单帧横跳 (满杆↔咬尾几何交替 = 俯仰 1~2Hz 猛豚),
// 缠斗下沉 8.5m/s 时尤甚。现在非俯冲态一旦触发就把改出钉住 1 秒 (avdT), 期间不回攻击几何;
// 俯冲态不提交 (扫射剖面有自己的 gh+16 退出线, 提交会把攻击拉高一截)。
if(this.state!=='dive'){ if(this.pos.y<need) this.avdT=1.0; else if(this.avdT>0) this.avdT-=dt; }
if(this.pos.y<need||this.avdT>0){
const yL=this.yaw-0.75, yR=this.yaw+0.75;
const hL=Math.max(planeFloorY(this.pos.x+Math.sin(yL)*70,this.pos.z+Math.cos(yL)*70),
planeFloorY(this.pos.x+Math.sin(yL)*140,this.pos.z+Math.cos(yL)*140));
const hR=Math.max(planeFloorY(this.pos.x+Math.sin(yR)*70,this.pos.z+Math.cos(yR)*70),
planeFloorY(this.pos.x+Math.sin(yR)*140,this.pos.z+Math.cos(yR)*140));
const side=hL<hR?-1:1;
// P3-7a: 动作改走 fctl (side 的符号链保留旧口径: side=-1=右侧更低 → bank=+1 右坡 → 协调转弯右转)
this.fctl.bank=-side; this.fctl.pitchT=0.62; this.fctl.spdTgt=this.def.spd[1];
return;
}
if(this.evadeT>0){
this.evadeT-=dt;
this.fctl.bank=-this.evadeDir; this.fctl.pitchT=0.32; this.fctl.spdTgt=this.def.spd[1];
return;
}
// ── 7b-乙 拒止带 (软): 出了"战场半宽+20m"先回场 —— 缠斗/俯冲都可能把飞机拖出图,
//    旧版只有 update 的界外硬折返带 (PLANE_FLIGHT.bound) 兜底; 拒止带让它提前半拍自己转回来。
const softLim=MAP_SIZE/2+20;
if(Math.abs(this.pos.x)>softLim||Math.abs(this.pos.z)>softLim){
steerToward(this,V3(0,Math.max(this.pos.y,PLANE_FLIGHT.cruiseMin),0),this.def.spd[1],0.85);
return;
}
// ── 7b-乙 不双打 + 反应窗: 缠斗目标由 pickDogTarget 分派 (被己方 AI 咬得最少的敌机) ——
//    旧版全员 enemyPlaneAlive() 取第一架, 两架友机永远追同一目标; 进入缠斗补反应窗 (咬上≠立刻开火)。
//    2026-09-30 实机批: 补入场门 joinAGL —— 低空 (刚做完对地攻击/规避改出) 不接新缠斗,
//    先回巡航层再战; 与 breakAGL 构成 14m 滞回, 防贴线反复进出缠斗态。
if(this.state!=='dive'&&this.state!=='dogfight'){
const ep=pickDogTarget(this);
if(ep&&this.pos.y-gh0>PLANE_AI.joinAGL&&ep.pos.distanceTo(this.pos)<240*PLANE_DIFF[SETTINGS.diff].eng&&Math.random()<0.9){
this.state='dogfight'; this.dogTgt=ep;
// 反应窗对玩家驾驶的机 ×1.5 (2026-10-06 难度批标准档: 只削对玩家, AI 互咬不变)
this.fireT=Math.max(this.fireT,PLANE_DIFF[SETTINGS.diff].react*(ep.playerDriven?1.5:1));
}
}
if(this.state==='dogfight'){
const ep=this.dogTgt;
if(!ep||!ep.alive){ this.state='patrol'; this.stateT=rand(5,10); this.dogTgt=null; this.roll=dampF(this.roll,0,2,dt); return; }
const d=ep.pos.distanceTo(this.pos);
// ── 低空保护② (2026-09-30 实机批): 本机 AGL<breakAGL → 整帧放弃攻击几何 ——
//    坡度减半 (把满坡 66° 的伪升力下沉 ≈8.5m/s 砍半) + 满杆拉起 + 满油门, 零开火。
//    旧版只有机下 gh+14 的尾守卫 (抬一点俯仰继续咬): 满坡咬圈一边转一边沉, 改出动力学
//    (pitchResp 阻尼 ~0.5s) 吃光余量 —— 用户实报"打着打着跑到低空去晃悠"的主因, 与
//    接管热修④废除 gh+12 尾守卫是同一个坑, 同口径处理 (整帧改出, 不是边打边拉)。
if(this.pos.y-gh0<PLANE_AI.breakAGL){
this.fctl.bank*=0.5; this.fctl.pitchT=PLANE_FLIGHT.pitchMax; this.fctl.spdTgt=this.def.spd[1];
return;
}
// ── 低空保护①: 追击点钳地形上方 (aimAGL) —— 目标贴地/下坠时 lead 点会跟着钻地,
//    追几何把本机往地里带; 钳回地形上方, 在它头顶盘旋压制 (接管侧 floorY=minAGL+8 已验)。
const aim=planeLeadAim(this,ep);
const floorY=planeFloorY(aim.x,aim.z)+PLANE_AI.aimAGL;
if(aim.y<floorY) aim.y=floorY;
// 统一 lead 追击 (planeLeadAim 单源) + steerToward 原语; 开火窗口=机头对准提前点且进距。
// 速度目标随距离连续过渡 (旧 d>90 一档从 spd[1] 跳到中值 = 速度指令台阶, 顺带抹平)。
const dy=steerToward(this,aim,lerp(this.def.spd[0],this.def.spd[1],clamp((d-60)/80,0,1)),1,[-0.6,0.6]);
// 开火门/射速对玩家驾驶的机放宽 (2026-10-06 难度批标准档): 进入距 ×0.85、射速 ×1.15 —— 只削对玩家。
if(this.fireT<=0&&Math.abs(dy)<0.12&&d<160*PLANE_DIFF[SETTINGS.diff].eng*(ep.playerDriven?0.85:1)){
this.fireT=this.def.rof*PLANE_DIFF[SETTINGS.diff].rof*(ep.playerDriven?1.15:1);
this.fireMGBurst(this.crewBot||this.crew,1);
if(Math.random()<0.12) AudioSys.gunshot('smg',this.pos.distanceTo(camera.position),0);
}
if(d>340){ this.state='patrol'; this.stateT=rand(5,10); this.dogTgt=null; } // 脱离线比进入线 (240×eng≤300) 宽出半拍, 防临界抖动
return;
}
if(this.state==='patrol'){
// 巡航层: 有山战役自动抬升到"全图最高地形+42m", 无山维持 62m;
// 巡逻圈半径随地图缩放 (320 图 110m 不变, 800 图≈174m 覆盖全部旗区)
const cruise=Math.max(PLANE_FLIGHT.cruiseMin,terrainMaxH()+PLANE_FLIGHT.cruiseOver);
const pr=PLANE_FLIGHT.patrolR*Math.sqrt(MAP_SIZE/320);
// 2026-09-30 实机批 (用户报"动作十分生硬"): 定坡度盘旋取代"追绕圈航点" ——
// 旧航点角速度恒定 0.1rad/s (11m/s), 而飞机在巡逻圈上的角速度 ≈0.35rad/s, 永远追不上也甩不掉
// ⇒ 周期性超越航点, 左右压坡 S 形摆头 (周期 ~25s 的醉汉巡航)。现改直接飞圆:
// 机头 = 所在方位角切向 + 半径误差修正 (圈内偏向圈外/圈外偏向圈内), 一坡度定圆, 平滑不摆头。
const rr=Math.hypot(this.pos.x,this.pos.z);
const yawCmd=Math.atan2(this.pos.x,this.pos.z)+HPI-clamp((pr-rr)*0.02,-0.6,0.6);
const dy=angDiff(this.yaw,yawCmd);
this.fctl.bank=clamp(-dy*1.6,-0.55,0.55);
this.fctl.pitchT=clamp((cruise-this.pos.y)*0.02,-0.3,0.3);
this.fctl.spdTgt=PLANE_FLIGHT.patrolSpd;
if(this.stateT<=0){
let best=null,bs=-1e9;
for(const t of tanks){
if(!t.alive||t.team===this.team) continue;
if(typeof specRide==='function'&&specRide(t)) continue;   // 观战者座驾不被战机俯冲点名 (2026-09-26H)
const d=t.pos.distanceTo(this.pos);
if(d<280){ const sc=(this.bombs>0?150:60)-d*0.3+rand(0,30); if(sc>bs){ bs=sc; best=t; } }
}
// 对舰目标 (2026-10-01b 用户裁定"航母、飞机、航弹应该有足够的影响力"): 旧版只点名坦克/步兵 ——
//   纯海战图上飞机全程绕圈看戏。现在: 大舰只在**挂弹时**点名 (机炮啃不动装甲, 打了也是浪费架次);
//   小艇扫射/轰炸皆可 (与对地步兵同档, 挂弹加成)。塔拉瓦的沿岸小艇从此也在空袭范围内。
if(typeof capitalShips!=='undefined'&&Array.isArray(capitalShips)) for(const s of capitalShips){
if(!s||s.team===this.team||s.state!=='run') continue;
if(this.bombs<=0) continue;                                // 没弹不碰大舰
const d=Math.hypot(s.pos.x-this.pos.x,s.pos.z-this.pos.z);
if(d>560) continue;
const sc=200-d*0.22+rand(0,40);
if(sc>bs){ bs=sc; best=s; }
}
if(typeof navalCraft!=='undefined'&&Array.isArray(navalCraft)) for(const c of navalCraft){
if(!c||!c.alive||c.team===this.team||c.state==='sinking'||c.state==='wreck') continue;
if(typeof specRide==='function'&&specRide(c)) continue;
const d=Math.hypot(c.pos.x-this.pos.x,c.pos.z-this.pos.z);
if(d>340) continue;
const sc=(this.bombs>0?170:90)-d*0.3+rand(0,30);
if(sc>bs){ bs=sc; best=c; }
}
for(const s of combatants){
if(!s.alive||s.team===this.team||s.onVehicle||s.spectator) continue;
const d=Math.hypot(s.pos.x-this.pos.x,s.pos.z-this.pos.z);
if(d>220) continue;
let sc=40-d*0.25+rand(0,25);
if(s.empUse||s.mgUse) sc+=70;
let cluster=0;
for(const s2 of combatants){ if(s2.alive&&s2.team===s.team&&Math.hypot(s2.pos.x-s.pos.x,s2.pos.z-s.pos.z)<9) cluster++; }
sc+=cluster*16;
if(sc>bs){ bs=sc; best=s; }
}
if(best){ this.target=best; this.state='dive'; this.stateT=7.5; this.avdT=0; } // avdT: 规避带提交不跨态 (不吞俯冲起头)
else this.stateT=rand(4,8);
}
} else if(this.state==='dive'){
const tgt=this.target;
if(!tgt||!tgt.alive||(tgt.state==='sinking')||(tgt.state==='crippled')||this.stateT<=0){ this.state='climb'; this.stateT=4; this.target=null; }
else {
// 7b-乙: 转向走 steerToward 原语; 扫射/投弹门限接 PLANE_DIFF 对地两域 (sg 扫射进入距 / bmLo·bmHi 投放带)
// 大舰的瞄准点抬到甲板面 (tgt.pos.y 是水线下 6m 的舰心 —— 不抬, 追击几何会把本机带进海里)
// ★2026-10-04 (海战审计 B14 瞄水线病): 旧瞄准点 deckY*0.6 换算到世界只有**水线上 2~5m** —— 在干舷
//   之下, 轰炸机追着舰体水线扎、航弹贴水线炸 (对舰几乎无效)。瞄准点抬到**甲板面 +1.2m** (甲板是
//   真实命中面; 1.2m 余量让引信在甲板上方触发而不是半埋进铺面)。
const capT=(tgt.kind==='capital');
const aimY=tgt.pos.y+(capT?tgt.spec.deckY+1.2:2);
const PD=PLANE_DIFF[SETTINGS.diff];
// 对玩家放宽 (2026-10-06 难度批标准档): 目标是玩家本人 (步行扫射) 或玩家驾驶的车时, 扫射进入距 ×0.8、
// 射速 ×1.15 —— 航弹投放带不单列 (面杀伤, 且有掩体减免), 只削机炮扫射的点名压力。
const _pTg=(tgt===player)||!!tgt.playerDriven;
const dy=steerToward(this,V3(tgt.pos.x,aimY,tgt.pos.z),this.def.spd[1],1,[-0.55,0.1]);
const dh=Math.hypot(tgt.pos.x-this.pos.x,tgt.pos.z-this.pos.z);
if(!capT&&this.fireT<=0&&dh<110*PD.sg*(_pTg?0.8:1)&&Math.abs(dy)<0.22&&this.pos.y>12){
this.fireT=this.def.rof*PD.rof*(_pTg?1.15:1); // 7b-甲: 对地扫射同接射速档 (大舰不扫射 —— 机炮无用, 只投弹)
this.fireMGBurst(this.crewBot||this.crew,1.2);
}
if(this.bombs>0&&this.bombCd<=0&&Math.abs(dy)<0.3){
const h=this.pos.y-(tgt.pos.y+(capT?tgt.spec.deckY+1.2:0));
const tof=Math.sqrt(Math.max(2*h/9.8,0.01));
// ★2026-10-04 (B14 提前量): 目标是 4m/s 级的移动舰, 按当前位置算落点必然落后一个身位 ——
//   释放门按"预测落点"算水平距离 (速度经 capTgtVel 单源取: 大舰 velX/velZ, 小艇标量 vel 按航向分解)。
const tv=(typeof capTgtVel==='function')?capTgtVel(tgt,_planeLeadVel):_planeLeadVel;
const px2=tgt.pos.x+tv.x*tof, pz2=tgt.pos.z+tv.z*tof;
const dhP=Math.hypot(px2-this.pos.x,pz2-this.pos.z);
if(dhP<this.speed*tof*PD.bmHi&&dhP>this.speed*tof*PD.bmLo){
this.bombCd=rand(5,9); this.bombs--;
this.dropBomb(this.crewBot||this.crew);
}
}
const gh=planeFloorY(this.pos.x,this.pos.z);
if(this.pos.y<gh+16){ this.state='climb'; this.stateT=4; this.target=null; }
}
} else {
this.fctl.bank=0; this.fctl.pitchT=0.4; this.fctl.spdTgt=this.def.spd[1]*0.85;
if(this.stateT<=0||this.pos.y>58){ this.state='patrol'; this.stateT=rand(8,16); this.target=null; }
}
}
playerFly(dt){
// 战地式操控 (P3-7a 重写): 只产 fctl 意图 —— A/D 压坡 (协调转弯由 flightStep 完成),
// 鼠标上下控制俯仰 (相对速率输入: 推鼠标持续拉杆), W/S 油门; 姿态/速度积分全部上收 flightStep。
// 旧版在这里手搓的 yaw 直写与侧滑补偿项随单源化删除 —— 转弯手感由"坡度→偏航"这一条因果链给出。
const PF=PLANE_FLIGHT;
this.fctl.bank=(keys.KeyD?1:0)-(keys.KeyA?1:0);
this.fctl.pitchT=clamp(player.pitch,PF.pitchMin,PF.pitchMax);
this.fctl.spdTgt=this.speed+((keys.KeyW?1:0)-(keys.KeyS?1:0))*PF.thrAccel;
if(mouseDown&&this.fireT<=0&&!matchOver){
this.fireT=this.def.rof*(player.streakBuff?player.streakBuff.reloadMul:1); // 连杀增益: 航炮加速 (2026-09-12)
this.fireMGBurst(player,0.8);
AudioSys.gunshot('smg',0,0);
addTrauma(0.03);
}
if((mouse2Down||keys.KeyB)&&this.bombs>0&&this.bombCd<=0&&!matchOver){
this.bombCd=0.8*(player.streakBuff?player.streakBuff.reloadMul:1); this.bombs--; // 连杀增益: 投弹间隔缩短 (挂弹补给 rearmT 不动, 2026-09-12)
this.dropBomb(player);
}
const gh=(typeof planeFloorY==='function')?planeFloorY(this.pos.x,this.pos.z):heightAt(this.pos.x,this.pos.z); // 纯海图擦地警告按水面地板算 (海床在浪下 20m+)
if(this.pos.y<gh+9&&this.pitch<0.1) nadeWarnT=0.15;
}
// ── 7b-丙 AI 接管驾驶 (2026-09-30, 用户裁定原话: "由 AI 接管, 在符合游戏逻辑的基础上实现目标,
//    相当于暂时找一个老飞行员代打") ──
// 三条硬口径:
// ① 诚实弹道: 开火走与玩家手打完全相同的 fireMGBurst(player,·)/dropBomb(player) 链 —— 同散布/同弹速/
//    同伤害/同 aimAssist 收益, 无任何制导或追踪弹; "必中感"来自飞行员的 lead 瞄准与占位, 不来自弹。
// ② 老飞行员: 强度固定 PLANE_DIFF[1] (老兵档), 不随游戏难度变化 —— 他替的是玩家的手, 不是难度标尺。
// ③ 全包: 对空咬尾机炮 + 对地扫射 + 自动投弹; 终止条件 (目标死/超距/失视野/再按 Space) 由
//    planeTakeoverEnd 单源收账, 冷却 PLANE_TAKEOVER.cd。
// 热修 (2026-09-30 用户实机两报): ④ 保底高度 minAGL —— 追坠机不再跟到落地前一秒 (旧 gh+12 尾守卫
//    余量不够改出: pitchResp 阻尼下满俯仰改出要 ~0.5s, 俯冲末速 30m/s+ 的下沉率会吃光余量);
//    ⑤ 规避 —— 挨打/被咬尾打一拍满舵破转, 打完回攻击剖面 (旧版直来直去纯挨打)。
aiPilotFly(dt){
const PD=PLANE_DIFF[1], t=this.aiPilotTgt;
if(!t||!t.alive){ planeTakeoverEnd(this,t?'目标已击落':'目标丢失'); return; }
const air=t.kind==='plane';
const d=this.pos.distanceTo(t.pos);
if(d>PLANE_TAKEOVER.range){ planeTakeoverEnd(this,'目标超出接战范围'); return; }
// ── ④ 保底高度 (热修④, 单源 PLANE_TAKEOVER.minAGL/diveAGL): 本机 AGL 与前方 0.9s/1.8s 两点采样任一
//    低于闸值 ⇒ 本帧不做攻击几何, 坡度压平 + 满杆拉起 + 满油门 (带坡拉起会被协调转弯拧弯头, 必须先归零)。
//    前向采样抄 planeAI 的地形规避思路: 山脊在船首方向时脚下 AGL 还很高, 等脚下低于余量再拉已经来不及。
//    2026-09-30k (用户报"敌机高度比较低时接管不去打") 拉起闸分两档: 目标在本机下方 4m 开外 = 正在向下打,
//    用俯冲档 diveAGL (低空敌机/地面目标够得着了; 满杆改出下沉 5~10m 对 20m 仍约一倍余量),
//    平飞/爬升态维持 minAGL=40 老闸 —— 追坠机悬顶收人头的手感不变。
const fx3=Math.sin(this.yaw), fz3=Math.cos(this.yaw);
const la1=this.speed*0.9, la2=this.speed*1.8;
const ghT=Math.max(planeFloorY(this.pos.x,this.pos.z),
planeFloorY(this.pos.x+fx3*la1,this.pos.z+fz3*la1),
planeFloorY(this.pos.x+fx3*la2,this.pos.z+fz3*la2));
const aglNeed=(t.pos.y<this.pos.y-4)?PLANE_TAKEOVER.diveAGL:PLANE_TAKEOVER.minAGL;
if(this.pos.y-ghT<aglNeed){
this.fctl.bank*=0.25;
this.fctl.pitchT=PLANE_FLIGHT.pitchMax;
this.fctl.spdTgt=this.def.spd[1];
return;
}
// ── ⑤ 规避 (热修⑤ → 2026-09-30j 破转反咬重写, 用户裁定原话: "过度躲避, 等队友击败敌人, 躲还躲不好 = 窝囊且废物") ──
//    两段式: 前段满舵破转甩开弹道 (零开火), 后段**反舵回扫威胁方向**把炮口带到他头上照常开火 ——
//    破转是反攻的前半段, 不是逃场; 老飞行员的防御动作以"转完能打"收尾, 不以"躲到队友收人头"收尾。
//    威胁不是敌机 (高炮/航弹, aiEvSrc=null) 或已亡 ⇒ 整窗破转 (对地威胁没有"转过去打"的语义)。
//    咬尾侦察也一并修正: 旧版只判"他机头瞄我", 对头遭遇也触发规避 (过度躲避主源) —— 补上真·后半球判据,
//    且破转方向取"朝威胁转" (随机恒定转圈恰好是提前量最好跟的轨迹 = "躲还躲不好"); 窗毕照旧 2.6s 冷却防连躲。
if(this.aiEvT>0){
this.aiEvT-=dt;
const src=this.aiEvSrc;
if(this.aiEvT>this.aiEvDur*0.45||!src||!src.alive){
this.fctl.bank=this.aiEvDir;
this.fctl.pitchT=0.22;
this.fctl.spdTgt=this.def.spd[1];
}else{
const dy=steerToward(this,planeLeadAim(this,src),this.def.spd[1],1,[-0.35,0.45]);
if(this.fireT<=0&&Math.abs(dy)<0.14&&this.pos.distanceTo(src.pos)<160*PD.eng){
this.fireT=this.def.rof*PD.rof;
this.fireMGBurst(player,0.8); // 反咬段照走诚实弹道 (与咬尾机炮同一管线同一门限)
}
}
if(this.aiEvT<=0){ this.aiEvCd=2.6; this.aiEvSrc=null; } // 一拍打完必须回攻击, 冷却里不再连躲 (老飞行员不是只会躲)
return;
}
if(this.aiEvCd>0) this.aiEvCd-=dt;
else {
const mf=this.fwdDir();
for(const ep of planes){
if(!ep.alive||ep.team===this.team) continue;
const dvx=this.pos.x-ep.pos.x, dvy=this.pos.y-ep.pos.y, dvz=this.pos.z-ep.pos.z;
const dv2=dvx*dvx+dvy*dvy+dvz*dvz;
if(dv2<320*320&&dv2>1){
const f=ep.fwdDir();
// 真·咬尾: 他机头瞄我 (cos44°) **且**他在我机尾方向 (mf·dv>0) —— 后半球判据 2026-09-30j 补实
if(f.x*dvx+f.y*dvy+f.z*dvz>0.72*Math.sqrt(dv2)&&mf.x*dvx+mf.y*dvy+mf.z*dvz>0.05*Math.sqrt(dv2)){
const dyT=angDiff(this.yaw,Math.atan2(-dvx,-dvz));
this.aiEvT=rand(1.1,1.7); this.aiEvDur=this.aiEvT;
this.aiEvDir=dyT>0?-1:1; // 破转方向=朝威胁转 (bank −1 → yaw 增, 见 steerToward 因果链)
this.aiEvSrc=ep; break;
}
}
}
}
// 视线: 弹道被地形/建筑遮断累计超宽限即交还 (接管只做"看得见才打得"的活; 规避窗内不累计)
const aimP=air?planeLeadAim(this,t):V3(t.pos.x,t.pos.y+(t.kind?1.5:1),t.pos.z);
if(air){
// 追击点只防"钻地" (2026-09-30k 收窄): 旧钳 ghA+minAGL+8=48 把低空平飞的敌机整个顶到头上 ——
// 瞄准点永远在他上方几十米, 弹道从头顶掠过 = "低空不去打"的另一半病根。改出安全已由上面的
// diveAGL 拉起闸单点负责, 这里只保留防钻底下限: lead 点贴地时钳回地形上 8m。
const ghA=planeFloorY(aimP.x,aimP.z);
if(aimP.y<ghA+8) aimP.y=ghA+8;
}
const toT=aimP.clone().sub(this.pos); const dT=Math.max(toT.length()-3,2); toT.normalize();
if(raycastWorld(this.pos,toT,dT)){ this.aiLosT+=dt;
if(this.aiLosT>=PLANE_TAKEOVER.losGrace){ planeTakeoverEnd(this,'目标失去视野'); return; } }
else this.aiLosT=0;
if(air){
// 咬尾机炮: 统一 lead 追击 (与 AI 缠斗同一原语), 机头对准提前点且进距即开火 (诚实弹道)
const dy=steerToward(this,aimP,this.def.spd[1],1,[-0.6,0.6]);
if(this.fireT<=0&&Math.abs(dy)<0.12&&d<160*PD.eng){
this.fireT=this.def.rof*PD.rof;
this.fireMGBurst(player,0.8);
}
}else{
// 对地: 俯冲扫射剖面 (与 AI dive 同一原语与门限), 有弹且过投放带即自动投弹 (落点=诚实弹道, 无制导)
const dy=steerToward(this,aimP,this.def.spd[1],1,[-0.55,0.1]);
const dh=Math.hypot(t.pos.x-this.pos.x,t.pos.z-this.pos.z);
if(this.fireT<=0&&dh<110*PD.sg&&Math.abs(dy)<0.22&&this.pos.y>12){
this.fireT=this.def.rof*PD.rof;
this.fireMGBurst(player,0.8);
}
if(this.bombs>0&&this.bombCd<=0&&Math.abs(dy)<0.3){
const h=this.pos.y-t.pos.y;
const tof=Math.sqrt(Math.max(2*h/9.8,0.01));
if(dh<this.speed*tof*PD.bmHi&&dh>this.speed*tof*PD.bmLo){
this.bombCd=rand(5,9); this.bombs--;
this.dropBomb(player);
}
}
}
}
takeDmg(amt,attacker){
if(!this.alive) return;
// 观战者座驾免伤 (2026-09-26H 观战批): 判据单源 specRide (13-combat), 与坦克/舰艇同一条口径。
if(typeof specRide==='function'&&specRide(this)) return;
// ★2026-10-06 难度批: Bot→**玩家座机**的伤害改吃 pDmg 列 (0.6/0.8/0.9), AI 互咬维持 dmgMul (烈度不变)。
if(attacker&&!attacker.isPlayer) amt*=(this.playerDriven?DIFF_TABLE[SETTINGS.diff].pDmg:DIFF_TABLE[SETTINGS.diff].dmgMul); // 7b-甲: Bot→飞机伤害接难度表 (旧全档同值; 高炮/AI 机直检/航弹单点收口在这里)
this.hp-=amt;
this.lastHitBy=attacker;
if(this.playerDriven){ dmgFlash=Math.min(1,dmgFlash+0.3); addTrauma(0.2); if(typeof addVehDmgDir==='function') addVehDmgDir(this,attacker); } // 方向指示: D8 (2026-09-28)
// 7b-丙 热修⑤: 接管中被命中 → 老飞行员打一拍规避 (冷却防连躲; 玩家手打时无 aiPilotOn 不触发)
// 2026-09-30j: 置窗同时记威胁源与破转方向 —— 敌机打的就朝他转 (反咬段入口), 高炮/航弹随机方向全窗破转。
// 注意敌机射手是机组 Bot (fireMGBurst(this.crewBot||this.crew,·)), 要归位到他那架 Plane 再记源,
// 否则挨打这条最高频的置窗路径永远记不到敌机、反咬段退化成纯破转。
if(this.aiPilotOn&&amt>2&&this.aiEvT<=0&&this.aiEvCd<=0){
this.aiEvT=rand(1.1,1.7); this.aiEvDur=this.aiEvT;
let asrc=null;
if(attacker){
if(attacker.kind==='plane'&&attacker.alive) asrc=attacker;
else if(attacker.onVehicle&&attacker.onVehicle.kind==='plane'&&attacker.onVehicle.alive) asrc=attacker.onVehicle;
}
this.aiEvSrc=asrc;
if(asrc){ const dyA=angDiff(this.yaw,Math.atan2(asrc.pos.x-this.pos.x,asrc.pos.z-this.pos.z)); this.aiEvDir=dyA>0?-1:1; }
else this.aiEvDir=Math.random()<0.5?1:-1;
}
else if(this.crewBot&&this.hp>0&&this.hp<this.maxHp*0.32){
// 飞行员跳伞逃生
// A#8 契约 §7: 投放链走 Bot.chuteBegin 单源 —— 同帧置 chuting/chute/onGround 三态 (chuteAirborne 才认得),
// 并在开伞前收掉上一顶伞 (旧版只写 cb.chuting=true, 缺 chute/onGround ⇒ 伞降保护与索敌口径都判不出来)。
const cb=this.crewBot;
this.crewBot=null;
cb.onVehicle=null;
const px=this.pos.x, py=Math.max(this.pos.y-2,heightAt(this.pos.x,this.pos.z)+3), pz=this.pos.z;
if(typeof cb.chuteBegin==='function') cb.chuteBegin(px,py,pz);
else { cb.chuting=true; cb.pos.set(px,py,pz); cb.mesh.root.visible=true; cb.path=null; cb.state='idle'; cb.target=null; }
}
else if(amt>8&&this.evadeT<=0&&Math.random()<PLANE_DIFF[SETTINGS.diff].evd){ // 7b-乙: 规避概率/时长接难度表 (旧写死 0.7/1.4~2.6)
this.evadeT=rand(1.4,2.6)*PLANE_DIFF[SETTINGS.diff].evT; this.evadeDir=Math.random()<0.5?1:-1; this.state='patrol'; this.dogTgt=null;
}
if(this.hp<=0) this.die(attacker);
}
die(attacker){
const spec=(typeof specRide==='function')&&specRide(this); // 观战者座驾: 车可以毁, 人绝不死 (2026-09-26H, 见下)
this.alive=false; this.respawnT=rand(35,48); this.crew.alive=false;
// ★2026-10-03: 拦阻账不跨生死 —— 停放中被毁的机若不清 capArrest, 重生机会被 capArrestTick 冻在
//   半空出生点"等弹射" (AI 8s 后原地弹射 / 玩家直到按 Space)。
this.capArrest=null; this.capParkT=0;
// 7b-丙: 锁定/接管/缠斗目标随本体退场一并清 (目标引用不许过夜 —— 与 userData 禁对象引用同一族纪律)
this.dogTgt=null; this.lockTgt=null; this.aiPilotOn=false; this.aiPilotTgt=null; this.aiLosT=0;
this.aiEvT=0; this.aiEvCd=0; this.aiEvSrc=null; // 热修⑤+30j: 规避窗/威胁源随退场一并清
// ★2026-09-28 (用户实报"被巡飞弹击毁的飞机会挂在天上固定不动"): **视觉交接先行, 且做成原子的一步**。
// 旧顺序: 隐藏本体 (最后一行) + 生成残骸 排在 驾驶员跳伞/布娃娃、记分、战报三条**外部副作用链**之后 ——
// 那条链上任何一步抛异常 (布娃娃是唯一跑真 cannon 的一步; registerKillScore/addKillfeed 是唯一摸真 DOM
// 的两步), die() 就地中断: 飞机已经 `alive=false` (update() 因此整帧早退 ⇒ **永远不再移动**), 而 grp 仍
// 可见、残骸也没挂上 ⇒ 一架"死而不隐"的飞机挂在空中, 正是用户报的那一幕 (沙箱里由 showKillPop 的
// DOM 桩复现了同一条中断路径)。现在: 先隐藏本体 + 挂上残骸 (单位状态一步到位), 再去做记分/战报/
// 布娃娃, 并把后者整段包进 try —— 账目出错也不许留下"死而不隐"的飞机。
// ★2026-09-28 二次加固 (观战态必现浮空的真病根, D1 重立案): 信息层名牌 Sprite 挂在 grp 里时,
//   grp.clone() → three Object3D.copy 的 JSON.parse(JSON.stringify(userData)) 会因环状 userData 抛异常
//   (22b 的 host 环已除, 但"交接块任何异常都不得拦下隐藏"这条不变量要用结构保证) ——
//   因此**本体隐藏提到最前** (clone 在隐后也安全: wm.visible=true 显式恢复), 交接块整段 try 包裹:
//   最坏情形 = 有"本体消失"而无残骸, 绝无"死而不隐"。
this.grp.visible=false;
try{
if(this.beacon) this.grp.remove(this.beacon); // 信标不随残骸克隆 (否则残骸静置时悬浮标识隔墙可见)
if(this.wingNavL){ this.grp.remove(this.wingNavL); this.grp.remove(this.wingNavR); } // 夜航灯同理: 残骸不再闪红绿 (update 早退会冻结闪烁态)
const wm=this.grp.clone();
if(this.beacon) this.grp.add(this.beacon);
if(this.wingNavL){ this.grp.add(this.wingNavL); this.grp.add(this.wingNavR); }
wm.visible=true;                              // 防御: clone 连 visible 一起复制, 显式恢复
scene.add(wm);
const fv=this.velVec();
planeWrecks.push({
m:wm, pos:this.pos.clone(),
vel:V3(fv.x*0.6,Math.min(fv.y*0.5,2),fv.z*0.6),
yaw:this.yaw, pitch:this.pitch, roll:this.roll,
rollV:rand(-2.5,2.5)+(Math.random()<0.5?1.6:-1.6),
attacker:attacker||null, team:this.team,
state:'fall', smokeT:0, restT:24, col:null
});
}catch(handoffErr){
console.warn('[击落] 残骸交接异常 (本体已隐, 本架无坠落残骸):',handoffErr);
}
try{
if(this.playerDriven){
this.playerDriven=false;
player.onVehicle=null;
// 观战者: 不走死亡链 (2026-09-26H) —— 安全脱离到机旁平地, 0 死/0 票; 普通玩家照旧 damage(999) 走全链
if(spec){ if(typeof specRideEject==='function') specRideEject(this); }
else player.damage(999,attacker,false);
}
if(this.crewBot){
const cb=this.crewBot;
this.crewBot=null;
cb.onVehicle=null;
cb.damage(999,attacker,false);
}
if(attacker&&(attacker.ffAll||attacker.team!==this.team)){ // ffAll: 观战幽灵坦克的无差别火力照常记分 (2026-09-17)
attacker.kills=(attacker.kills||0)+1;
// 玩家得分取 registerKillScore 返回值 (含连杀倍率, 2026-09-11); Bot 仍按基础分
if(attacker.isPlayer) attacker.score=(attacker.score||0)+registerKillScore('击落战机',SCORE_TABLE.plane);
else attacker.score=(attacker.score||0)+SCORE_TABLE.plane;
addKillfeed(attacker,{name:this.name,team:this.team,isPlayer:false},false);
if(attacker.isPlayer&&typeof onPlayerWreck==='function') onPlayerWreck(); // 击落红档 (2026-09-30 批): 飞机无乘员 die 链兜底 (crewBot 走 damage(999)→Bot.die 有, 空机没有), 统一在此出档
}
tickets[this.team]=Math.max(0,tickets[this.team]-TICKET_COST.plane);
explosionFX(this.pos.clone());
AudioSys.explosion(this.pos.distanceTo(camera.position));
}catch(e){
// 单位已正确退场 (本体已隐 + 残骸已上): 只丢一次账/报, 不能把飞机挂在空中
console.warn('[击落] 记分/布娃娃链异常 (单位已退场):',e);
}
}
respawn(){
// 重生固定在己方主基地上空 (2026-09-01 用户指定): 无基地战役回退本阵营主力前出点
const bp2=basePos(this.team);
const sx1=bp2.x+rand(-14,14), sz1=bp2.z+rand(-14,14);
this.pos.set(sx1,Math.max(65,heightAt(sx1,sz1)+40),sz1);
this.yaw=this.team===0?0:Math.PI; this.pitch=0; this.roll=0;
this.hp=this.maxHp; this.alive=true; this.crew.alive=true; this.speed=PLANE_FLIGHT.birthSpeed;
this.state='patrol'; this.stateT=rand(5,10); this.target=null;
this.bombs=this.def.bombs; this.playerDriven=false; this.evadeT=0;
this.dogTgt=null; this.lockTgt=null; this.aiPilotOn=false; this.aiPilotTgt=null; this.aiLosT=0;
this.aiEvT=0; this.aiEvCd=0; this.aiEvSrc=null; // 热修⑤: 规避窗随退场/重生一并清 // 7b-丙: 接管/锁定态不跨重生
this.avdT=0;
this.pilotWaitT=0;
this.crewBot=null;
this.capArrest=null; this.capParkT=0;                 // ★2026-10-03: 与 die() 同账 (重生不继承拦阻)
this.grp.visible=true;
// ★2026-10-03 (舰载机重生锚改弹射器): 本队航母在航 ⇒ 重生 = 直接弹射起飞 (capLaunchPlane 单源:
//   落点=弹射器滑轨 + 顶速出膛) —— 旧版在 basePos (旗舰战列舰) 上空 65m 凭空出现, 全队机叠在同一个
//   移动点上 ("成群冒出来"), 且冒出来就挂在舰队交战圈里挨打。无航母 (铁底湾) 或航母已瘫 ⇒ 保持既有
//   basePos 上空出生 (typeof/状态双守卫, 非海战图与铁底湾逐位零变化)。
if(typeof capitalShips!=='undefined'&&capitalShips.length&&typeof capLaunchPlane==='function'){
const cv=(typeof capCarrierOfTeam==='function')?capCarrierOfTeam(this.team):null;
if(cv&&cv.state==='run') capLaunchPlane(this,true);
}
// 己方战机战损重生: 文字播报让玩家知道本方空中支援已回场 (构造函数不走这里, 开局不播报)
if(this.team===player.team) announceVehRespawn(this);
}
}

function enemyPlaneAlive(team){
for(const p of planes) if(p.alive&&p.team!==team) return p;
return null;
}
// ════════ 7b-乙/丙 (2026-09-30): AI 决策共用原语 + 玩家锁定/AI 接管 ════════
// steerToward —— 统一转向原语: 期望瞄准点 → 期望航向/俯仰 → fctl 意图三件。缠斗/俯冲/拒止带回场/
//   接管飞行员全走这一份"压坡即转弯"因果链 (7a 统一了积分, 乙统一决策层), 返回机头-瞄准点航向差
//   供调用方判开火窗口; 不再每态手抄 bank=-dy*1.6。
// pitLim: 俯仰钳 [下,上] (rad) —— 缠斗 ±0.6 / 俯冲剖面 [-0.55,0.1], 缺省 PLANE_FLIGHT 全程。
function steerToward(pl,aim,spdTgt,bankLim,pitLim){
const PF=PLANE_FLIGHT, PL=pitLim||[PF.pitchMin,PF.pitchMax];
const dy=angDiff(pl.yaw,Math.atan2(aim.x-pl.pos.x,aim.z-pl.pos.z));
const dh=Math.max(Math.hypot(aim.x-pl.pos.x,aim.z-pl.pos.z),5);
pl.fctl.bank=clamp(-dy*1.6,-(bankLim===undefined?1:bankLim),bankLim===undefined?1:bankLim);
pl.fctl.pitchT=clamp(Math.atan2(aim.y-pl.pos.y,dh),PL[0],PL[1]);
pl.fctl.spdTgt=spdTgt;
return dy;
}
// 统一 lead 追击点 (PLANE_AI.leadT 单源): 缠斗与接管飞行员共用同一份提前量。
function planeLeadAim(pl,tgt){
return tgt.pos.clone().addScaledVector(tgt.velVec(),clamp(pl.pos.distanceTo(tgt.pos)/PLANE_AI.leadT,0,0.9));
}
const _planeLeadVel={x:0,y:0,z:0};   // 对海投弹提前量的速度槽 (planeAI dive 态复用, 不在热路径造对象)
// 不双打 (7b-乙): 每架敌机统计已被几架**己方 AI** 咬住, 取最少的 (同分取先)。
function pickDogTarget(me){
let best=null,bestN=1e9;
for(const p of planes){
if(!p.alive||p.team===me.team) continue;
let n=0;
for(const q of planes) if(q!==me&&q.alive&&q.team===me.team&&q.dogTgt===p) n++;
if(n<bestN){ bestN=n; best=p; }
}
return best;
}
// ── 7b-丙 玩家锁定 (键位 E / 鼠标中键, 用户裁定"2+3共存"): 机头半角 35°/500m, 空中优先 ──
// 候选三类: 敌机 / 敌坦克 / 敌步兵 (工事无独立全局数组, AA 窝点由其操作手步兵代表)。
function planeLockScan(pl){
const fd=pl.fwdDir(), coneR=PLANE_LOCK.cone*Math.PI/180;
let air=null,airAng=1e9, gnd=null,gndAng=1e9;
const scan=(o,px,py,pz,isAir)=>{
const dx=px-pl.pos.x, dy2=py-pl.pos.y, dz=pz-pl.pos.z;
const d=Math.sqrt(dx*dx+dy2*dy2+dz*dz);
if(d<8||d>PLANE_LOCK.range) return;
const ang=Math.acos(clamp((dx*fd.x+dy2*fd.y+dz*fd.z)/d,-1,1));
if(ang>coneR) return;
if(isAir){ if(ang<airAng){ air=o; airAng=ang; } }
else if(ang<gndAng){ gnd=o; gndAng=ang; }
};
for(const p of planes) if(p.alive&&p.team!==pl.team) scan(p,p.pos.x,p.pos.y,p.pos.z,true);
for(const t of tanks) if(t.alive&&t.team!==pl.team) scan(t,t.pos.x,t.pos.y,t.pos.z,false);
for(const s of combatants) if(s.alive&&!s.onVehicle&&!s.spectator&&s.team!==pl.team) scan(s,s.pos.x,s.pos.y+1,s.pos.z,false);
return air||gnd; // 空中优先: 锥内有敌机就不给地面 (用户痛点"对地没有锁定"的对偶: 先空后地)
}
// 锁定维持 (20a updatePlayerPlane 每帧调): 目标死/超出松锥 (45°/560m) 即掉锁 —— 维持窗比锁定窗宽,
// 目标小幅机动不掉锁, 明显脱离才掉 (咬住的手感)。
function planeLockMaintain(pl){
const t=pl.lockTgt;
if(!t) return;
if(!t.alive){ pl.lockTgt=null; return; }
const fd=pl.fwdDir();
const dx=t.pos.x-pl.pos.x, dy2=t.pos.y-pl.pos.y, dz=t.pos.z-pl.pos.z;
const d=Math.max(Math.sqrt(dx*dx+dy2*dy2+dz*dz),0.01);
const ang=Math.acos(clamp((dx*fd.x+dy2*fd.y+dz*fd.z)/d,-1,1));
if(d>PLANE_LOCK.dropRange||ang>PLANE_LOCK.drop*Math.PI/180) pl.lockTgt=null;
}
function planeLockToggle(){
const pl=player.onVehicle;
if(!pl||pl.kind!=='plane'||!pl.alive||!player.alive||matchOver) return; // 仅飞行员座位, 其它场合零副作用
if(pl.aiPilotOn){ showScorePop(t2('AI 接管中 · Space 交还')); return; }
if(pl.lockTgt){ pl.lockTgt=null; AudioSys.click(700,0.2,0.05); showScorePop(t2('解除锁定')); return; }
const t=planeLockScan(pl);
if(t){
pl.lockTgt=t; AudioSys.click(1250,0.22,0.05);
showScorePop(t2('已锁定: {0} · {1}m',t2(t.name||(t.kind==='tank'?'坦克':'地面目标')),String(Math.round(pl.pos.distanceTo(t.pos)))));
}else showScorePop(t2('锁定失败: 机头前方 35°/500m 内无目标'));
}
// ── 7b-丙 AI 接管切换 (Space): 需现役锁定 + 目标在接战距 + 冷却完毕; 再按即交还 ──
function planeTakeoverToggle(){
const pl=player.onVehicle;
if(!pl||pl.kind!=='plane'||!pl.alive||!player.alive||matchOver) return;
// P4 (2026-09-30 用户裁定① 简化起降): 停在航母甲板上时 Space = **一键弹射起飞**, 不再走接管切换
// (弹射是"把飞机送上天"的唯一主动作, 与"老飞行员代打"抢同一个键没有意义)
if(pl.capArrest&&typeof capLaunchPlane==='function'){ capLaunchPlane(pl); return; }
if(pl.aiPilotOn){ planeTakeoverEnd(pl,'交还控制'); return; }
if((player.takeoverCd||0)>0){ showScorePop(t2('AI 飞行员歇息中 · {0}s',String(Math.ceil(player.takeoverCd)))); return; }
const t=pl.lockTgt;
if(!t||!t.alive){ showScorePop(t2('先按 E/中键锁定目标')); return; }
if(pl.pos.distanceTo(t.pos)>PLANE_TAKEOVER.range){ showScorePop(t2('目标超出接战范围')); return; }
pl.aiPilotOn=true; pl.aiPilotTgt=t; pl.aiLosT=0; pl.dogTgt=null;
pl.aiEvT=0; pl.aiEvCd=0; pl.aiEvSrc=null; // 热修⑤+30j: 接管从干净规避态起步
AudioSys.click(980,0.3,0.06);
showScorePop(t2('AI 接管中 · 老飞行员代打'));
}
// 接管终止单源: 态清账 + 冷却起步 + 屏上交代原因 (目标击落/超距/失视野/手动交还)。
function planeTakeoverEnd(pl,why){
pl.aiPilotOn=false; pl.aiPilotTgt=null; pl.aiLosT=0;
pl.aiEvT=0; pl.aiEvCd=0; pl.aiEvSrc=null; // 热修⑤+30j: 规避窗随接管一并收
player.takeoverCd=PLANE_TAKEOVER.cd;
showScorePop(t2('AI 接管结束: {0}',t2(why)));
}
// ── 7c 对空命中单源 (2026-09-30, 设计盘点 §6.1 "planeHitTest 四套→一源") ──
// 旧四套口径: ①fireMGBurst 手写球测 (平径 3.2, **无地形遮挡** = F7 隔山打) ②高炮近炸 (8/11 点距)
// ③巡飞弹 rayCyl (2.3×size 圆柱 + 2.2×size 兜底) ④aimAssist 候选 (2.4×size)。半径三样互不一致,
// 全部收进 planeHitR 这一个机型命中半径; 高炮**保留**自己的近炸引信半径 8/11 (引信≠机体), 但判定
// 几何同走 planeNearTest。所有对空命中判定只许调这两个函数, 不许再手写距离/投影。
function planeHitR(pl){
return 2.4*((pl.def&&pl.def.size)||1);
}
// 线段判定 (机枪/航炮/直击弹): 沿单位向量 d 从 o 起 maxD 米内**最近**的一架命中机 (射线-球),
// excludeTeam 传射手队则跳过友机 (对空刮血/空空机炮都只打敌机); 返回 {pl,t} 或 null。
function planeHitTest(o,d,maxD,excludeTeam){
const dl=d.length()||1, dx=d.x/dl, dy=d.y/dl, dz=d.z/dl;
let best=null;
for(const pl of planes){
if(!pl||!pl.alive) continue;
if(excludeTeam!==undefined&&pl.team===excludeTeam) continue;
const rx=pl.pos.x-o.x, ry=pl.pos.y-o.y, rz=pl.pos.z-o.z;
const tp=rx*dx+ry*dy+rz*dz;
if(tp<0.5||tp>maxD) continue;
const r=planeHitR(pl), d2=rx*rx+ry*ry+rz*rz-tp*tp;
if(d2<r*r&&(!best||tp<best.t)) best={pl,t:tp};
}
return best;
}
// 点判定 (近炸引信/溅射兜底): 距机心 rad 米内返回**第一架** (数组序, 与旧高炮循环同序), 无则 null。
function planeNearTest(x,y,z,rad,excludeTeam){
const r2=rad*rad;
for(const pl of planes){
if(!pl||!pl.alive) continue;
if(excludeTeam!==undefined&&pl.team===excludeTeam) continue;
const dx=pl.pos.x-x, dy=pl.pos.y-y, dz=pl.pos.z-z;
if(dx*dx+dy*dy+dz*dz<=r2) return pl;
}
return null;
}
function fireFlak(gun,shooter,dir){
const o=V3(gun.x,gun.y,gun.z).addScaledVector(dir,1.6); // 弹壳出生炮轴心 (2026-09-06 P2-20: 旧 +0.4 与炮管视觉错位)
AudioSys.gunshot('mg',o.distanceTo(camera.position),0);
spawnP(PT.flash,o.x,o.y,o.z,dir.x*2,dir.y*2,dir.z*2,0.35,3,0.07,1,0,true);
flakShots.push({pos:o.clone(),vel:dir.clone().multiplyScalar(FLAK_SPD),team:shooter.team,owner:shooter,life:1.7,age:0}); // 弹速单源 FLAK_SPD (7d-乙 四联 20mm: 旧借 SHELL_SPD 380 ⇒ 460, life 2.05→1.7 同步收紧保 ~780m 射程包线不变; age: 出膛计时, B13 舰体实体判定的豁免窗用)
}
function updateFlak(dt,rdt){
// 逐发按自己的帧长 (2026-09-27M 时停修复批; 单源 22b specTimeShotDt → owner.isPlayer):
// 时停下 AI 的高炮弹停在半空 (不推进/不过期/不判定), 玩家在防空炮位上打出的照飞照爆 ——
// 否则弹丸冻住而 life 不衰减 (审计 P0-2 同一族), 且"停着的弹片"仍会逐帧重跑命中判定 (P0-1 同族)。
const FD=(typeof specTimeShotDt==='function')?specTimeShotDt:null;
for(let i=flakShots.length-1;i>=0;i--){
const f=flakShots[i];
const fdt=FD?FD(f.owner,rdt,dt):dt;
if(!(fdt>0)) continue;
f.life-=fdt;
f.age=(f.age||0)+fdt;
f.pos.addScaledVector(f.vel,fdt);
let boom=f.life<=0;
// ★2026-10-04 (海战审计 B13): 高炮弹对大舰的实体判定 —— 旧版只测飞机/步兵/坦克/地形四类, 纯海图上
//   heightAt 给的是海床 (水面下 20m+), 舰体甲板带与上层建筑对高炮弹不存在 ⇒ 弹从舰岛正中穿过。
//   命中舰体带 (capitalSolidAt) 或上层建筑 (capSuperSolidAt) 即空炸。出膛豁免 0.02s (≈9m @ FLAK_SPD):
//   大舰自己的防空炮位就坐在上层建筑顶上, 弹壳出生点贴着本舰结构, 不豁免会出膛自炸。
if(!boom&&f.age>0.02&&typeof capSuperSolidAt==='function'){
const capSolid=(typeof capitalSolidAt==='function')?capitalSolidAt(f.pos.x,f.pos.y,f.pos.z):null;
if(capSolid||capSuperSolidAt(f.pos.x,f.pos.y,f.pos.z)) boom=true;
}
// 7c: 近炸判定几何单源 planeNearTest (引信半径 8 bot/11 玩家保留 —— 引信≠机体, 但不再手写点距循环;
// 旧循环半径内多机全吃改为第一架, 双机同贴一发弹的边缘情形不再双份扣血)。
{
const fp=planeNearTest(f.pos.x,f.pos.y,f.pos.z,f.owner&&f.owner.isPlayer?11:8,f.team);
if(fp){
// 空对地平衡批 (2026-09-30): Bot 高炮对机弹伤 ×GROUNDGUN_VS_AIR (玩家操作档不减; 难度倍率仍由
// Plane.takeDmg 的 DIFF_TABLE.dmgMul 在内部叠加, 这里不重复乘)。普通枪弹与飞机本就无碰撞 —— 这是地面枪械对机唯一伤源。
// 命中反馈 (2026-09-30 批): 高炮弹='shell' 档; 玩家炮位打中活机出白档, 击落走 die 链红档
if(typeof markHitCls==='function') markHitCls('shell');
fp.takeDmg(f.owner&&f.owner.isPlayer?rand(34,58):rand(20,34)*GROUNDGUN_VS_AIR,f.owner);
if(f.owner&&f.owner.isPlayer&&fp.alive&&typeof onPlayerHitAny==='function') onPlayerHitAny('shell');
boom=true;
}
}
// 解除"防空炮只能对空": 弹片可命中地面士兵/载具, 触地即爆
if(!boom){
for(const s of combatants){
if(!s.alive||s.onVehicle||s.team===f.team) continue;
if(Math.hypot(s.pos.x-f.pos.x,s.pos.z-f.pos.z)<1.1&&Math.abs((s.pos.y+1)-f.pos.y)<2.2){
if(typeof markHitCls==='function') markHitCls('shell');
s.damage(rand(20,36),f.owner&&f.owner.alive?f.owner:null,false);
if(f.owner&&f.owner.isPlayer&&f.owner.alive&&s.alive&&typeof onPlayerHitAny==='function') onPlayerHitAny('shell');
boom=true; break;
}
}
}
if(!boom){
for(const t of tanks){
if(!t.alive||t.team===f.team) continue;
if(Math.hypot(t.pos.x-f.pos.x,t.pos.z-f.pos.z)<2.3&&f.pos.y>t.pos.y-0.6&&f.pos.y<t.pos.y+3.2){
if(typeof markHitCls==='function') markHitCls('shell');
t.takeDmg(rand(5,9),f.owner&&f.owner.alive?f.owner:null);
if(f.owner&&f.owner.isPlayer&&f.owner.alive&&t.alive&&typeof onPlayerHitAny==='function') onPlayerHitAny('shell');
boom=true; break;
}
}
}
if(!boom&&f.pos.y<heightAt(f.pos.x,f.pos.z)) boom=true;
if(boom){
spawnP(PT.dark,f.pos.x,f.pos.y,f.pos.z,0,0.4,0,1.6,2.4,1.6,0.85,0);
spawnP(PT.flash,f.pos.x,f.pos.y,f.pos.z,0,0,0,0.9,5,0.09,1,0,true);
AudioSys.flakPop(f.pos.distanceTo(camera.position));
flakShots.splice(i,1);
}
}
}
