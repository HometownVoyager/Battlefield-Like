// ─────────────────────────────────────────────
// 15f-battery.js —— 反舰炮位 (日军 4 门 · 四岬各一)
// 2026-09-20N 海战批 · 用户第 7 条「我选 1+3」的**岸**那一半:
//   ① 岸炮能打船: 扫 navalCraft → 择最近 + LOS 通 → 解提前量 → 走既有 shells 管线
//   ② 岸炮能被船打掉: 独立 hp; 被击毁 → 胸墙塌 + 炮管垂 + 从索敌资格摘除 (alive=false)
//   ③ **另建独立炮位** —— 现有 atGun 陆战逻辑一行不动:
//      本文件的 Battery **绝不进 ATGUNS/AAGUNS** (那两张表被 23b-worldrestore 按索引快照, splice 会串位),
//      也**绝不复用 COASTAL_PITS** (那张表会被 17-emplacements 展开成 atGun = 陆战炮, 与本体系无关)。
//
// ── 单源纪律 (纲领 §4.3 / 设计定稿 §4.1) ──
//   · 落位: CAMPAIGN.sea.batteries 只给**岬角锚点**; 本文件经 seaCoastLines() 现算"所属岸线 + 向海法线",
//     沿向陆法线偏移 inshore 米后用 17-emplacements 的 findClearSpot 落位 ⇒ 文件里**没有任何写死的岬角坐标**。
//   · 场地: 与 05a coastalPit 同一支 —— 03-terrain 的 addPad 把炮位圈削平成混凝土场地 (否则岬角圆顶
//     上的炮座四角悬空), 摆完统一 refreshTerrainMesh() 重刷地形顶点 (05c buildWorld 末尾同一支)。
//   · 岸线/水深: 只读 03-terrain 的 shoreDist / waterYAt (严禁另写算术)。
//   · 弹道/伤害: 只取 00-config 的 NAVAL_SPEC 同口径 + SHELL_SPD_NAVAL (不另写一套数值)。
//   · 弹药节奏: 与 13-combat.emplATFire 的 atGun Bot 档**同值** (5.2+rand(0,1.4), 见 BATTERY_RELOAD_*)。
//   · 开火单源: 全部开炮 (玩家/Bot) 只经 Battery.fire / batteryFire 这一支; **本文件不自行开火** ——
//     2026-09-21 A#9 起无人时完全静止 (旧版的兜底 AI 分支已删除, 见文件头「有人才动」段)。
//   · 命中: 与坦克/反坦克炮共用同一根炮弹 (15-vehicles.updateShells); 对海命中交 15d 的 shellHitNaval(s)
//     (§11.4 契约)。15d 未落盘时本文件用 typeof 守卫自行兜底结算, 落盘后自动让位 (见 _batShotTick)。
//
// ── 被摧毁链 ──
//   胸墙 10 段注册为**标准可毁结构组** (05-world dBegin/dBox/dEnd) ⇒ "被艇炮打掉炮位"走的就是全游戏
//   唯一的爆炸→结构伤害入口 damageStructures: 炮弹命中胸墙或近失 (爆点 10.5m 内) 都会扣 reg.hp,
//   归零由 destroyStructure 做碎块化 + 扬尘 + 碎石堆 (与建筑坍塌同一套观感, 零分叉、零新代码路径)。
//   本文件只负责"结构组死了 → 炮管垂落 / 伪装网塌 / 摘除索敌资格"这段炮位专有链。
//   注: 不进 ATGUNS/AAGUNS 是硬约束; **进 DESTRUCTIBLES** 是安全的 —— 该表只在尾部追加、从不 splice,
//   23b 的按索引快照因此照常成立; 世界还原后本文件按 reg.dead 自动复活炮位 (见 Battery.revive)。
//
// ── 2026-09-21 A#9 用户第 9 条「有人才动, 无人完全静止」──
//   炮位不再有任何自动 AI: 无人时**一炮不开**、连静置回正也不做 (Battery.update 只走去摧毁/还原链)。
//   动起来的唯一两条路径, 都只经同一支开火入口 Battery.fire / 模块级 batteryFire:
//     ① 玩家: 20a-seats.updatePlayerBattery 每帧驱动 (转向/俯仰/左键开炮, 座位字段 player.onBattery);
//     ② Bot : 14-bots 把 BATTERIES 当第三类固定火力点 (认领 → g.crewBot=bot → 瞄船 → batteryFire)。
//   占用双轨: g.user (玩家) / g.crewBot (Bot), 只读判据 g.manned —— 两人不得同炮。
//
// ── 2026-09-21 A#9 `batteryNear` 的双语义 (★不是重载 bug, 下一批别再"修"回去) ──
//   · `batteryNear(x,z,r)`      3 参 = **可上炮** (存活 + 未被占用 + 过了 cdLock)。玩家 F 交互用这支
//     (infantry 在 20-player.tryInteract 里 typeof 调用, 只调这一支)。
//   · `batteryNear(x,z,r,team)` 4 参 = **艇 AI 的压制目标** (半径内最近的存活敌对炮位, 不管炮上有没有人)。
//     14-bots.navScanShore 的 2026-09-20N 既有调用点依赖它 (打掉的炮位必须从候选里摘掉)。
//   两支语义相反 ("没人开的" vs "能打的"), 合并成一个默认值会让其中一边静默失效 ⇒ 按 team 参数是否存在分流。
// ─────────────────────────────────────────────
'use strict';
const BATTERIES=[];              // 反舰炮位实例 (与 ATGUNS/AAGUNS 完全独立)
const BATTERY_TEAM=1;            // 日军专属 (用户第 10 条: 4 门四岬各一)
const BATTERY_HP=520;            // 独立 hp (设计定稿 §4.1 建议值; 调参只改这一个数)
const BATTERY_RANGE=420;         // 对海索敌半径 m (设计定稿 §4.1)
const BATTERY_MIN_SHORE=8;       // 落位红线: 必须在陆上 (shoreDist<0) 且离岸 ≥8m (验收红线)
const BATTERY_WALL_R=3.45;       // 胸墙环中心半径 (内径 ≈3.14, 炮座/炮组可在内回旋)
const BATTERY_TRUNNION=1.52;     // 炮耳高 (混凝土场地以上): 高于两翼胸墙 1.15 ⇒ 面海射界不被自家墙挡
const BATTERY_PAD_HW=6.2;        // 场地平台半宽 (10 边形外接圆 4.2 + 值班步道; ≥5.94 才能把炮位外接方角全罩进硬台面)
const BATTERY_PAD_RAMP=6;        // 平台裙坡过渡带 (m) —— 与 coastalPit 同口径
// 弹药节奏 (秒): 与 13-combat.js `emplATFire` 的 atGun Bot 档**同值** (g.cd=3.6+rand(0,0.8))。
// dev/_battery-selfcheck.js 会从 13-combat.js 源码里再解析一遍这两个数 —— 那边改了而没同步, 自检立刻报红。
const BATTERY_RELOAD_A=3.6, BATTERY_RELOAD_B=0.8;
const BATTERY_LEAD_ERR=0.10;     // 提前量误差 (±10% 飞行时间): 与 atGun 的 0.02rad 散布同属"AI 手感"档
const BATTERY_CREW_DIST=2.7;     // 炮手站位 = 炮位沿 -face 方向 2.7m (2026-09-21 A#9 契约 §6: 与 atGun 同规)
const BATTERY_PITCH_MIN=-0.42, BATTERY_PITCH_MAX=0.75; // 玩家操作俯仰射界**上限/兜底下限** (真正的下限见 batteryPitchFloor)
const BATTERY_WALL_H={apron:0.45, flank:1.15, rear:1.45, sill:0.30}; // 胸墙高度分档 (面海敞开)
const BATTERY_WALL_SEGS=10;
// ── 方向机限界 + 俯仰下限逐角解算 (★2026-09-26 修, P1-19a "岸炮打自己") ─────────────────────
// 旧版: 回旋无限制 + 俯角定角 -0.42。与现场几何矛盾 —— 炮耳高 1.52 (高于台面), 炮口在轴心前 3.66m,
//   压到 -0.42 时炮口只离台面 1.52-3.66·sin(0.42) = **0.026m**, 而 r=3.45 处的胸墙: 面海段 0.45m /
//   两翼 1.15m / 后方 1.45m ⇒ 炮管从自家胸墙里穿出去 (0.34m 深), 且炮口落在墙内 —— "打自己"。
//   (22-hud 的射界条也把这个假下限画给了玩家。) 枪口扫过操作手同理: 站位在轴心后 2.7m, 而炮口 3.66m
//   ⇒ 360° 回旋必然扫过操作手 (与 atGun 的 AT_YAW_MAX 同一条口径: 固定炮位不 360° 回旋)。
// 现口径 (两条都与 atGun 同规, 且都是**几何反解**而不是再拍一个常数):
//   ① 回旋 ±BATTERY_YAW_MAX(±100°): 射界覆盖"面海 3 段 + 两翼 4 段"共 200°, 后方胸墙/门槛段在射界外 ——
//      炮口距操作手最近 = 2.7×sin(80°) = 2.66m (躯干 0.3 + 管径 0.11 ⇒ 净空 2.2m)。
//   ② 俯角下限 = f(当前回旋角): 要求**炮管下缘**在射程半径 3.45m 处的墙顶之上留 0.05m 余量 ⇒
//      -asin((TRUNNION - 墙高 - 管径 - 0.05)/WALL_R): 面海段 -15.4°, 两翼段 -3.6°。
//      玩家 (20a-seats) 与 Bot (14-bots) 共用本函数, 弹道/炮口/准星三者恒一致。
const BATTERY_YAW_MAX=1.745;
const BATTERY_BARREL_R=0.105;    // 炮管外径 (barrel CylinderGeometry(0.085,0.105,3.40) 的粗端)
function batteryPitchFloor(relYaw){
const a=Math.abs(relYaw||0);                                     // 0 = 向海 (与建模的 th=π+i·TAU/10 同一套方位)
const H=(a<=Math.PI/5)?BATTERY_WALL_H.apron:(a<=Math.PI*0.6?BATTERY_WALL_H.flank:BATTERY_WALL_H.rear);
const need=(BATTERY_TRUNNION-H-BATTERY_BARREL_R-0.05)/BATTERY_WALL_R;
return -Math.asin(clamp(need,-0.95,0.95));
}
// (2026-09-21 A#9 删除) BATTERY_EXT_WIN 静默窗口 / BATTERY_EXT_AI 接管标志 / _batInTick 来源判定 ——
//   三者都服务于已删除的"本文件兜底 AI 与外部 AI 二选一"结构; 现在无人不开炮, 不存在需要让位的兜底 AI。

// ── 弹道/伤害单源: 取 NAVAL_SPEC 的日军 37mm 档 (カミ 主炮) —— "同口径"不另写数值 ──
function batteryGunDef(){
const m=(typeof NAVAL_SPEC!=='undefined'&&NAVAL_SPEC&&NAVAL_SPEC.kami)?NAVAL_SPEC.kami.main:null;
return {
spd:(typeof SHELL_SPD_NAVAL==='number'&&SHELL_SPD_NAVAL>0)?SHELL_SPD_NAVAL:(m&&m.spd)||150,  // 双兜底都不留"115"字面量 (2026-09-21B 单源纪律)
dmg:(m&&m.dmg)||300,
name:(m&&m.name)||'37mm 炮'};
}
// AI 散布档: 与 14-bots.updateEmplacement(反坦克炮) 同源 (DIFF_TABLE spreadMul), 缺表时按老兵档
function batterySpread(){
if(typeof DIFF_TABLE==='undefined'||typeof SETTINGS==='undefined') return 0.02;
const d=DIFF_TABLE[SETTINGS.diff]||DIFF_TABLE[1];
return 0.02*((d&&d.spreadMul!==undefined)?d.spreadMul:1);
}
// 目标尺寸表 (00-config 头注: "15f-battery.js (反舰炮位对海索敌的目标尺寸表)"):
// 15d 在时一律用它的 navalHitCyl(n) (§4.2 单源); 未落盘时按 NAVAL_SPEC 的 hullL/hullW 现算同形圆柱。
function batteryTargetCyl(c){
if(typeof navalHitCyl==='function'){ try{ const cy=navalHitCyl(c); if(cy) return cy; }catch(e){} }
const s=(c&&c.spec)||{};
const w=(s.hullW||4.0)*0.5+0.4, y=(c&&c.pos&&c.pos.y)?c.pos.y:0;
return {x:c.pos.x,z:c.pos.z,r:w,y0:y-1.15,y1:y+0.95};
}

// ═══════ 落位 (单源: 锚点 → 最近岸线支 → 向陆法线偏移 → findClearSpot → 红线断言) ═══════
// 岸线折线上距 (x,z) 最近的点 (同时回传该处段向, 供法线现算)
function _batNearOnLine(c,x,z){
const P=c.pts; let bd=1e9,bx=0,bz=0,dx=0,dz=0;
for(let i=0;i<P.length-1;i++){
const ax=P[i][0],az=P[i][1],vx=P[i+1][0]-ax,vz=P[i+1][1]-az;
const L2=vx*vx+vz*vz||1;
let t=((x-ax)*vx+(z-az)*vz)/L2; t=t<0?0:(t>1?1:t);
const qx=ax+vx*t,qz=az+vz*t,d=Math.hypot(x-qx,z-qz);
if(d<bd-1e-9){ bd=d; bx=qx; bz=qz; dx=vx; dz=vz; }
}
return {d:bd,x:bx,z:bz,dx,dz};
}
// 该支在该处的**向海单位法线**: 垂于相邻段, 用该支的 (ox,oz) 海侧向定向
function _batSeaNormal(r){
const l=Math.hypot(r.dx,r.dz)||1, dx=r.dx/l, dz=r.dz/l;
let nx=-dz, nz=dx;
if(nx*r.ox+nz*r.oz<0){ nx=-nx; nz=-nz; }
if(Math.abs(nx*r.ox+nz*r.oz)<1e-6){ // 退化 (段向与海侧法向平行): 用距离场探针定向
const d0=shoreDist(r.x,r.z);
if(shoreDist(r.x+nx*2,r.z+nz*2)<d0){ nx=-nx; nz=-nz; }
}
return [nx,nz];
}
// 归属岸线 + 向海法线: 最近支; 岬角处两支**严格并列** (anchor 就是两支公共端点) ⇒ 并列支全部参与,
// 法线取单位向量和 = 凸角的外向角平分线 (只取一支会得到"顺着岸线"的斜向, 那不是岬角的面海朝向)。
function batteryCoastAt(x,z){
const cs=(typeof seaCoastLines==='function')?seaCoastLines():[];
let best=1e9, near=[];
for(const c of cs){
const r=_batNearOnLine(c,x,z);
r.key=c.key; r.ox=c.ox; r.oz=c.oz;
if(r.d<best-0.5){ best=r.d; near=[r]; }
else if(r.d<best+0.5) near.push(r);
}
if(!near.length) return null;
let fx=0,fz=0; const keys=[];
for(const r of near){ const n=_batSeaNormal(r); fx+=n[0]; fz+=n[1]; keys.push(r.key); }
const l=Math.hypot(fx,fz)||1;
return {face:[fx/l,fz/l], coast:keys.join('+'), dist:best};
}
// 最终落位: 解析点 (锚点沿向陆法线 inshore 米) → findClearSpot → 红线复验 → 逐档加深兜底
function batteryPlace(def){
const a=def.anchor;
const at=batteryCoastAt(a[0],a[1]);
if(!at) return null;
const fx=at.face[0], fz=at.face[1];
const base=(def.inshore&&def.inshore>0)?def.inshore:16;
const wall=(x,z)=>shoreDist(x,z)<=-BATTERY_MIN_SHORE;      // 红线: 陆上且离岸 ≥8m
const fitSpot=(px,pz)=>{
if(typeof findClearSpot==='function'){
const cs=findClearSpot(px,pz,3.0,BATTERY_PAD_HW-2.2);
if(cs&&wall(cs[0],cs[1])&&!occBlocked(cs[0],cs[1])) return {x:cs[0],z:cs[1],via:'findClearSpot'};
}
if(wall(px,pz)&&!occBlocked(px,pz)&&(typeof propFree!=='function'||propFree(px,pz,BATTERY_PAD_HW-2.2))) return {x:px,z:pz,via:'offset'};
return null;
};
let out=null, dUsed=base;
for(let k=0;k<7&&!out;k++){
const d=base*(1+0.3*k);
const px=a[0]-fx*d, pz=a[1]-fz*d;
if(!wall(px,pz)) continue;                                  // 解析点先过红线 (省 findClearSpot 的随机数)
const sp=fitSpot(px,pz);
if(sp){ out=sp; dUsed=d; }
}
if(!out){                                                    // 兜底: 解析点原样 (自检会把红线结果如实报出)
out={x:a[0]-fx*base,z:a[1]-fz*base,via:'fallback'};
dUsed=base;
}
// 朝向 = 岬角的**向海角平分线** (锚点并列两支向海法线之和) —— 与 findClearSpot 的抖动无关的确定量,
// 语义就是"炮口朝岬角外侧的开阔海面"。硬校验 (两条都是几何量, 不靠点积参照):
//   ① 沿 face 30m 必须落海 (shoreDist>0); ② 沿 face 80m 必须是**通航深水** (>3.4m, 与 sea.navRing 同口径)。
// 不成立才退回"最终落点处最近岸线的向海法线", 再退回 shoreDist 梯度 —— 三条路都会写进 place.faceSrc。
const here=batteryCoastAt(out.x,out.z);
const seaOK=f=>shoreDist(out.x+f[0]*30,out.z+f[1]*30)>0&&waterDepthAt(out.x+f[0]*80,out.z+f[1]*80)>3.4;
let face=at.face, faceSrc='cape-bisector('+at.coast+')';
if(!seaOK(face)){
if(here&&seaOK(here.face)){ face=here.face; faceSrc='spot-normal('+here.coast+')'; }
else{
const gx=shoreDist(out.x+4,out.z)-shoreDist(out.x-4,out.z), gz=shoreDist(out.x,out.z+4)-shoreDist(out.x,out.z-4);
const gl=Math.hypot(gx,gz)||1; face=[gx/gl,gz/gl]; faceSrc='shoreDist-gradient';
}
}
return {x:out.x,z:out.z,face,faceSrc,coast:at.coast,coastHere:here?here.coast:at.coast,
anchorFace:at.face,dUsed,via:out.via,distToAnchor:Math.hypot(out.x-a[0],out.z-a[1])};
}

// ═══════ 反舰炮位 ═══════
class Battery{
constructor(def,pl){
this.key=def.key||'?';
this.name=def.name||'反舰炮台';
this.team=BATTERY_TEAM;
this.x=pl.x; this.z=pl.z; this.face=Math.atan2(pl.face[0],pl.face[1]); // 向海法线 → 方位角 (与 atGun 同一角度口径)
this.place=pl;
this.maxHp=BATTERY_HP; this.hp=BATTERY_HP; this.alive=true;
this.cd=rand(1.4,3.4); this.user=null;
// 2026-09-21 A#9 (契约 §6): 操作者双轨 + 炮上冷却. 与 ATGUNS 同规 ——
//   user   = 玩家操作者 (player 或 null), 由 batteryMountPlayer/batteryDismountPlayer 维护;
//   crewBot= Bot 操作者 (14-bots 认领/释放), 本文件只读;
//   cdLock = 下炮后的再上炮冷却锚 (nowT+EMP_REARM_T 口径; 见 releaseEmpl), 与 atGun 的 g.cdLock 同名同义;
//   manned = 只读判据 ("炮上是否有人"), 别把"有没有操作者"与"有没有车组"挤进一个字段。
this.crewBot=null; this.cdLock=0;
this.target=null; this.shots=[]; this.dmgT=0; this.collapseT=0;
this._src=this.name;              // 击杀来源标签 (21-match.killSrcLabel 读 attacker._src)
const g=heightAt(this.x,this.z);
this.baseY=g;                     // 混凝土场地标高 (addPad 之后 = 平台高度)
this.gun=batteryGunDef();
this.mountY=g+0.06+BATTERY_TRUNNION;   // 炮耳世界高 (muzzle/瞄准/俯仰解算的唯一来源)
this._buildModel();
}
// 只读判据: 有人 (玩家或 Bot) 在炮上 ⇒ 本条契约下"会动"的唯一条件 (无人完全静止)
get manned(){ return !!(this.user||this.crewBot); }
// ── 建模: 混凝土胸墙环 (coastalPit 观感语言) + 敞开式面海炮座 + 弹药箱 + 伪装网 ──
_buildModel(){
const g=this.baseY, x=this.x, z=this.z, face=this.face, R=BATTERY_WALL_R, SEGS=BATTERY_WALL_SEGS;
const cs=Math.cos(face), sn=Math.sin(face);
const L=(lx,lz)=>[x+lx*cs+lz*sn, z-lx*sn+lz*cs];
const grp=new THREE.Group();
grp.position.set(x,g,z);
grp.rotation.order='YXZ';
grp.rotation.y=face;              // 局部 +z = 向海
world.add(grp);
this.grp=grp;
// ① 混凝土场地 (10 边形平台, 与胸墙段同方位对齐: 顶点转 18° ⇒ 侧面正对各段)
const plat=new THREE.Mesh(new THREE.CylinderGeometry(4.2,4.2,0.96,10),MAT.stone);
plat.position.set(0,0.06-0.48,0);
plat.rotation.y=-Math.PI/10;
grp.add(plat);
// ② 胸墙环 (10 段: 面海 3 段低矮敞开 / 两翼 4 段 / 后方 2 段 + 中央门槛段) —— 注册为可毁结构组
const segLen=2*R*Math.tan(Math.PI/SEGS)+0.22;
dBegin();
for(let i=0;i<SEGS;i++){
const th=Math.PI+i*TAU/SEGS;                       // 局部方位 (0=向海)
let a=th%(TAU); if(a>Math.PI) a-=TAU;
const aa=Math.abs(a);
const H=(aa<=Math.PI/5)?BATTERY_WALL_H.apron:(aa<=Math.PI*0.6?BATTERY_WALL_H.flank:BATTERY_WALL_H.rear);
const hs=(aa>Math.PI*0.9)?BATTERY_WALL_H.sill:H;   // 正后方 = 门槛段 (破口, 可跨入)
const p=L(Math.sin(th)*R,Math.cos(th)*R);
const boxH=hs+0.45;
dBox(MAT.stone,segLen,boxH,0.62,p[0],g+0.06-0.45+boxH/2,p[1],face+th);
}
this.reg=dEnd(false);                               // 标准可毁结构组 (被炮弹打掉的唯一入口 damageStructures)
// 2026-09-27N: 本组血量是**对局目标数值** (revive/复位一律写回 maxHp), 不参与"按组规模归一" (B1 单点后处理)
if(this.reg){ this.reg.hp=BATTERY_HP; this.reg.noScale=true; }
// ③ 混凝土座圈 + 钢炮座 (敞开式: 无防盾 —— 与陆战 atGun 的 2.0×0.95 防盾炮明显不同)
const plinth=new THREE.Mesh(new THREE.CylinderGeometry(1.55,1.75,0.5,10),MAT.stone);
plinth.position.set(0,0.06+0.25,0); grp.add(plinth);
const ped=new THREE.Mesh(new THREE.CylinderGeometry(0.62,0.86,0.92,10),MAT.metal);
ped.position.set(0,0.06+0.5+0.46,0); grp.add(ped);
const ring=new THREE.Mesh(new THREE.CylinderGeometry(1.06,1.06,0.14,12),MAT.metal);
ring.position.set(0,0.06+1.36,0); grp.add(ring);
// ④ 火炮: yaw/pitch 两级组 (与 ATGUNS 条目同构: g.yaw.rotation.y / g.pitch.rotation.x 即射角)
const yaw=new THREE.Group(); yaw.position.set(0,BATTERY_TRUNNION,0); grp.add(yaw);
const pitch=new THREE.Group(); pitch.position.set(0,0,0.18); yaw.add(pitch);
const cradle=new THREE.Mesh(boxGeo(0.16,0.52,1.10),MAT.metal); cradle.position.set(0.44,0,0.05); yaw.add(cradle);
const cradle2=cradle.clone(); cradle2.position.x=-0.44; yaw.add(cradle2);
const trun=new THREE.Mesh(new THREE.CylinderGeometry(0.10,0.10,1.16,8),vmMats.gunL);
trun.rotation.z=HPI; trun.position.set(0,0.05,0.05); yaw.add(trun);
const barrel=new THREE.Mesh(new THREE.CylinderGeometry(0.085,0.105,3.40,10),vmMats.gun);
barrel.rotation.x=HPI; barrel.position.z=1.72; pitch.add(barrel);
const sleeve=new THREE.Mesh(boxGeo(0.32,0.32,1.25),vmMats.gunL); sleeve.position.z=0.86; pitch.add(sleeve);
const breech=new THREE.Mesh(boxGeo(0.44,0.46,0.86),vmMats.gunL); breech.position.set(0,0,-0.22); pitch.add(breech);
const brake=new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.15,0.44,10),vmMats.gun);
brake.rotation.x=HPI; brake.position.z=3.48; pitch.add(brake);
const wheel=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.22,0.07,10),vmMats.gunL);
wheel.rotation.z=HPI; wheel.position.set(0.74,-0.30,-0.42); yaw.add(wheel);
const sight=new THREE.Mesh(boxGeo(0.13,0.18,0.30),vmMats.gunL); sight.position.set(-0.52,0.26,0.16); pitch.add(sight);
pitch.rotation.x=-0.10;                             // 静置仰角 ≈6° (岸炮对海, 不是陆战反坦克炮的平射姿态)
grp.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
this.yaw=yaw; this.pitch=pitch; this.gunGrp=yaw;
// ⑤ 弹药: 两处半埋弹药箱 (coastalPit 同一支 ammoCratePit) + 待发弹堆 (纯视觉)
for(const a of [Math.PI*0.42,-Math.PI*0.42]){
const p=L(Math.sin(a)*(R-1.15),Math.cos(a)*(R-1.15));
if(typeof ammoCratePit==='function'&&freeSpot(p[0],p[1],1)) ammoCratePit(p[0],p[1]);
}
// 待发弹堆 (3 发, 沿炮位后方横排) —— ★2026-09-21B 修: **只写组局部坐标**
//   旧版 `sh.position.set(p[0]-x, g+0.13, p[1]-z)` 把 L() 的**世界坐标**当局部坐标写回, 于是:
//     ① y 又叠了一次场地标高 ⇒ 世界高 = 2×baseY+0.13 (岬角 6~9m ⇒ 12~18m 高空), 三发弹浮在天上;
//     ② 水平被 grp.rotation.y=face 再转一次 ⇒ 连带偏离平台。
//   平台顶面 = 局部 y 0.06 (plat: 中心 0.06-0.48, 高 0.96), 弹半径 0.10 ⇒ 卧弹轴心 0.155 正好搁在台面上。
for(let i=0;i<3;i++){
const sh=new THREE.Mesh(new THREE.CylinderGeometry(0.10,0.10,0.70,8),vmMats.gunL);
sh.position.set(-1.05+i*0.36,0.155,-2.05); sh.rotation.z=HPI; sh.rotation.y=0.3; grp.add(sh);
}
// ⑥ 伪装网 (4 竿 + 帆布顶, 遮后方半圈): 纯视觉, 塌毁时随炮位一起落
const netG=new THREE.Group(); grp.add(netG);
const netTex=(()=>{
const c=document.createElement('canvas'); c.width=64; c.height=64;
const q=c.getContext('2d');
q.fillStyle='#4d5a3c'; q.fillRect(0,0,64,64);
const blobs=[[10,12,13,'#5d6a45'],[38,8,11,'#3e4630'],[24,30,15,'#6b6a4a'],[50,34,12,'#455038'],[12,50,14,'#59614a'],[42,56,11,'#3a4030']];
for(const b of blobs){ q.fillStyle=b[3]; q.beginPath(); q.ellipse(b[0],b[1],b[2],b[2]*0.72,0.6,0,TAU); q.fill(); }
const t2=new THREE.CanvasTexture(c); t2.colorSpace=THREE.SRGBColorSpace;
return t2;
})();
const netMat=new THREE.MeshLambertMaterial({map:netTex,transparent:true,opacity:0.92,side:THREE.DoubleSide,depthWrite:false});
const net=new THREE.Mesh(new THREE.PlaneGeometry(6.2,2.9),netMat);
net.position.set(0,2.42,-1.75);
net.rotation.set(-HPI+0.16,0,0);
netG.add(net);
for(const [px2,pz2] of [[-2.95,-0.40],[2.95,-0.40],[-2.95,-3.05],[2.95,-3.05]]){
const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.065,2.45,6),MAT.woodDark);
pole.position.set(px2,1.22,pz2); netG.add(pole);
}
this.net=netG;
// ⑦ 面海测距仪 (三脚架 + 测距箱, 朝海): 一眼看出"这门炮是打海的"
//   ★2026-09-21B 修: 与⑤待发弹堆同一处坐标混用 —— 旧版 `rfp=L(2.35,1.35)` 拿到世界坐标后又减 x/z 当局部用,
//     整组被 grp.rotation.y=face 转了两次 ⇒ 三脚架与测距箱落在炮位外的错方位。现在只写局部坐标。
//   口诀: **世界坐标的东西进 L(), 组局部的东西直写** —— 本文件里 ammoCratePit/coverPoints/BUILD_REG 属前者。
const rf=new THREE.Group(); grp.add(rf);
const RFX=2.35, RFZ=1.35, RF_LEG=1.15, RF_FOOT=0.06;   // 三脚架腿脚落平台面 (平台顶 = 局部 0.06)
for(const d of [0,TAU/3,TAU*2/3]){
const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.045,RF_LEG,6),MAT.metalDark);
leg.position.set(RFX+Math.sin(d)*0.22,RF_FOOT+RF_LEG*0.5,RFZ+Math.cos(d)*0.22);
leg.rotation.set(Math.cos(d)*0.20,0,-Math.sin(d)*0.20);
rf.add(leg);
}
const box=new THREE.Mesh(boxGeo(0.56,0.26,0.26),MAT.metalDark);
box.position.set(RFX,1.24,RFZ); rf.add(box);
const eye=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,0.20,8),vmMats.gunL);
eye.rotation.x=HPI; eye.position.set(RFX,1.28,RFZ+0.24); rf.add(eye);
this.rangefinder=rf;
// ⑧ 掩体点 (Bot 掩体选择同一支 coverPoints) + 建筑登记 (验证/调试用) + 碰撞圆柱
for(let i=0;i<6;i++){
const a=this.face+i*TAU/6;
coverPoints.push({x:x+Math.sin(a)*(R+1.5),z:z+Math.cos(a)*(R+1.5)});
}
BUILD_REG.push({type:'battery',x,z,ry:face,w:R*2,d:R*2,floor:g,doors:[],roofY:g+BATTERY_WALL_H.flank});
const cyl={x,z,r:1.15,y0:g,y1:g+1.30};
CYLS.push(cyl);
this.cyl=cyl;
}
// 世界坐标炮口 (长度/角度现算, 不写死)
muzzle(){
const pit=-this.pitch.rotation.x;
const yaw=this.face+this.yaw.rotation.y;
const dir=V3(Math.sin(yaw)*Math.cos(pit),Math.sin(pit),Math.cos(yaw)*Math.cos(pit));
return V3(this.x,this.mountY,this.z).addScaledVector(dir,3.66);
}
aimYaw(){ return this.face+this.yaw.rotation.y; }
// ── 索敌: 扫 navalCraft, 取 dist<420 且 LOS 通的最近敌方目标 ──
pickTarget(){
if(typeof navalCraft==='undefined'||!navalCraft||!navalCraft.length) return null;
const o=this.muzzle();
let best=null,bd=BATTERY_RANGE;
for(const c of navalCraft){
if(!c||!c.alive||c.team===this.team) continue;
if(c.state==='sinking'||c.state==='wreck') continue;     // 已在沉没链上的不再浪费弹药
// 观战者座驾不被岸炮索敌 (2026-09-26H 观战批): 判据单源 specRide (13-combat), 与其它五处索敌同源
if(typeof specRide==='function'&&specRide(c)) continue;
const dx=c.pos.x-this.x, dz=c.pos.z-this.z;
const d=Math.hypot(dx,dz);
if(d<1||d>=bd) continue;
const wy=waterYAt(c.pos.x,c.pos.z);
const ay=(wy>-1e8)?wy+1.05:c.pos.y+0.6;                  // 瞄水线以上 (水面高走 waterYAt 单源)
const dh=Math.hypot(c.pos.x-o.x,c.pos.z-o.z,ay-o.y)||1;
const dir=V3((c.pos.x-o.x)/dh,((ay)-o.y)/dh,(c.pos.z-o.z)/dh);
const hit=raycastWorld(o,dir,dh);
if(hit&&hit.dist<dh-2.5) continue;                       // LOS 不通 (自家胸墙/地形挡住)
bd=d; best=c;
}
return best;
}
// 射击: **唯一开火入口** (玩家 20a-seats 与 Bot 固定火力点链都只调这一支) —— 走既有 shells 管线 (与坦克/
// 反坦克炮同一根炮弹), 对海命中由 15d shellHitNaval 结算。冷却硬闸门在本函数内 (cd 只在这里被重置):
// 于是"同一门炮被两个驱动方同时驱动"在结构上也不可能双倍射速 (cd 未走完一律 return false)。
// dir 省略 = 用当前 yaw/pitch 现算 (含 AI 散布); owner 省略 = 记在炮位自身 (击杀来源标签 = 炮台名)。
// 冻结的模块级入口见文件末尾 batteryFire(b,dir,owner) —— 本静态方法是它的唯一实现。
static fire(b,dir,owner){
if(!b||!b.alive||b.cd>0) return false;
const pitNow=-b.pitch.rotation.x;
const now=b.aimYaw();
if(!dir){
dir=V3(Math.sin(now)*Math.cos(pitNow),Math.sin(pitNow),Math.cos(now)*Math.cos(pitNow));
const er=batterySpread();
dir.x+=rand(-er,er); dir.y+=rand(-er,er)*0.6; dir.z+=rand(-er,er); dir.normalize();
}
const o=b.muzzle();
const chk=raycastWorld(o,dir,4.6);
if(chk&&chk.dist<=4.0) return false;                      // 炮口被自家胸墙/地形挡: 短间隔重试
const shooter=owner||b;
shells.push({pos:o.clone(),vel:dir.clone().multiplyScalar(b.gun.spd),team:b.team,owner:shooter,
life:3.0,kind:'naval',dmgV:b.gun.dmg,trail:0,src:b.name});   // life: 2026-09-21B 弹速 115→190 后按比例 5.0→3.0 (射程包线不变); src: 弹体自带标签, 命中时重盖章 (2026-09-29)
b.shots.push({s:shells[shells.length-1],last:o.clone()});
b.cd=BATTERY_RELOAD_A+rand(0,BATTERY_RELOAD_B);            // 弹药节奏 (与 atGun Bot 档同值, 单源在此)
b.lastFiredT=nowT;
// 击杀来源标签 (21-match.killSrcLabel 读 attacker._src): ★2026-09-26 修 —— 旧写法 `if(shooter===b||!shooter._src)`
// 只在"炮手身上还没有标签"时才挂, 于是**玩家**先在岸上开过一枪 (20-player:714 已把 _src 写成'卡宾枪'),
// 再上炮打的这一炮仍记成"卡宾枪" (上炮不清 _src)。与全库其它开火处同口径: 本次开火**无条件**写自己的标签。
if(shooter) shooter._src=b.name;
b.flash=1;
AudioSys.cannon('battery',o.distanceTo(camera.position),AudioSys.panOf(o)); // 海防重炮档 (★2026-11-15c: 最重一档 52→16Hz 深锤长尾)
spawnP(PT.flash,o.x,o.y,o.z,dir.x*3,dir.y*3,dir.z*3,0.9,9,0.1,1,0,true);
spawnP(PT.dark,o.x,o.y,o.z,dir.x*2,1,dir.z*2,0.9,2.6,0.85,0.7,0.5);
return true;
}
// ── 索敌 + 提前量 + 调炮 (设计定稿 §4.1/§5.3 的唯一一处): 返回本帧可开火的弹道或 null ──
// 外部 AI 想复用同一份"最近目标 + LOS + 提前量"解算时调文件末尾的 batteryAim(b,dt)。
// ★2026-09-26E (审计 8): 本函数原是一份**独立实现**的旧口径 (回旋无限制 + 俯角定角 clamp(-0.42,0.75)),
//   与实机链 14-bots.updateBatteryGun 的"回旋 ±BATTERY_YAW_MAX + 俯角下限 batteryPitchFloor"是两套算术,
//   而本函数与 batteryAI/batteryAim 全库零调用点 —— 谁哪天把它接回帧钩, 就会把 P2-19a 的两条限界一起丢掉
//   (炮管穿自家胸墙 / 扫过操作手)。现在**委托**给 14-bots 的模块级单源 batteryAimSolve (同一套限界);
//   14-bots 未加载 ⇒ 返回 null (不开火), 绝不退化成旧口径。
static aim(b,dt){
const t=b.pickTarget();
b.target=t;
if(!t){
b.yaw.rotation.y=dampF(b.yaw.rotation.y,0,1.2,dt);            // 无目标: 缓慢回正面海射向
b.pitch.rotation.x=dampF(b.pitch.rotation.x,-0.10,1.5,dt);     // 静置仰角 6°
return null;
}
if(typeof batteryAimSolve!=='function') return null;           // 单源缺席: 不开火 (旧口径已退役)
const s=batteryAimSolve(b,t,dt);
if(b.cd>0) return null;
if(!s.aligned) return null;                                    // 未转到位/未俯仰到位 (与活路径同一道门)
const now=b.aimYaw();
const pitNow=-b.pitch.rotation.x;
const dir=V3(Math.sin(now)*Math.cos(pitNow),Math.sin(pitNow),Math.cos(now)*Math.cos(pitNow));
Battery.jitter(dir);
return dir;
}
// AI 散布: 与 14-bots.updateEmplacement(反坦克炮) 同源 (batterySpread), 只此一处施加
static jitter(dir){
const er=batterySpread();
dir.x+=rand(-er,er); dir.y+=rand(-er,er)*0.6; dir.z+=rand(-er,er);
return dir.normalize();
}
// ── 主更新: 状态机 + 被摧毁/还原链. **不再有任何自动索敌/调炮/开火** (2026-09-21 A#9 用户第 9 条) ──
update(dt){
if(this.reg){
if(this.reg.dead&&this.alive) this.die(null);             // 任何路径打掉胸墙组 = 炮位被摧毁
this.hp=Math.max(0,this.reg.hp);
}
if(!this.alive){ this._collapse(dt); return; }
if(this.flash>0) this.flash-=dt;
// 注: 弹药冷却 (this.cd) 由 updateBatteries 每帧统一递减 —— 与谁在瞄准/开火无关,
// 这样玩家 (20a-seats) 与 Bot (14-bots) 直接调 batteryFire 时冷却照常走, 不会"打一发就哑"。
// ★ 2026-09-21 A#9: 旧版这里有一条兜底 AI (Battery.aim + Battery.fire) 与 BATTERY_EXT_AI 静默窗口 ——
//   用户口径"有人才动, 无人完全静止", 该分支已**整段删除**: 无人时连静置回正都不做 (炮口停在原处)。
//   动起来的入口只剩两支, 都在本文件之外: 玩家 → 20a-seats.updatePlayerBattery; Bot → 14-bots 的
//   固定火力点链 (认领 g.crewBot 后走模块级 batteryAI / batteryFire)。本函数只保留生存与塌毁表现。
if(!this.manned) this.target=null;                            // 无人: 不保留索敌台账 (有人的炮由驱动方写 target)
}
// ── 被摧毁: 胸墙的碎块化由 destroyStructure (damageStructures 链路) 负责; 这里管炮位专有链 ──
takeDmg(amt,attacker){
if(!this.alive) return;
if(this.reg) this.reg.hp-=amt;
this.hp=Math.max(0,this.reg?this.reg.hp:this.hp-amt);
this.dmgT=nowT;
// 命中反馈 (2026-09-30 批): 岸炮是固定火力点里唯一可被击毁的硬目标 —— 玩家打中活炮出白档 (档='shell',
// 档位戳已由 updateShells/shellHitNaval 盖过), 打塌走 die 的红档; 档位戳在调用方, 这里不再盖。
if(attacker&&attacker.isPlayer&&this.alive&&typeof onPlayerHitAny==='function') onPlayerHitAny('shell');
if(this.hp<=0){
// 第 3 参 = 破坏得分归属 (2026-09-26 破坏得分批): 直击炮体打掉的胸墙组同样算击毁者的战果;
// 经 damageStructures 的常规路径已在那边记过账, destroyStructure 的 g.dead 门保证不重复。
if(this.reg&&!this.reg.dead) destroyStructure(this.reg,false,attacker);
this.die(attacker);
}
}
die(attacker){
if(!this.alive) return;
this.alive=false;
this.target=null;
// 2026-09-21 A#9: 炮位被摧毁 = 操作者当场失效 (炮座已塌). 玩家侧由 20a-seats.updatePlayerBattery 的
// `!g.alive ⇒ batteryDismountPlayer()` 同帧收尾 (本文件不碰 player 座位字段 —— 与既有分工一致)。
this.user=null; this.crewBot=null;
this.collapseT=1.6;
this.dmgT=nowT;
this._src=this.name;
if(this.cyl) this.cyl.y1=Math.min(this.cyl.y1,this.baseY+0.85); // 只留混凝土座圈 (炮座已被打塌)
if(this.net){ this.net.rotation.z=0.55; this.net.position.y-=0.75; }  // 伪装网塌落
spawnP(PT.dark,this.x,this.baseY+1.4,this.z,0,1.4,0,1.4,3.2,1.4,0.8,0.4);
AudioSys.explosion('batterydie',Math.hypot(this.x-camera.position.x,this.z-camera.position.z)); // 炮台塌毁档 (★2026-11-15c: 混凝土闷隆)
// 播报 (00b-i18n 已有中文键; 缺函数时静默)
if(typeof addKillMsg==='function'&&typeof t==='function'){
try{ addKillMsg(t('反舰炮台已摧毁'),BATTERY_TEAM); }catch(e){}
}
if(attacker&&attacker.team!==undefined) this.killedBy=attacker;
if(attacker&&attacker.isPlayer&&typeof onPlayerWreck==='function') onPlayerWreck(); // 打塌红档 (2026-09-30 批): 岸炮被玩家摧毁的屏中击毁反馈 (得分走 destroyStructure 的破坏账)
}
// 坍塌/垂管动画 (1.6s): 炮管垂落 + 炮座倾斜 + 持续扬尘
_collapse(dt){
if(this.collapseT<=0) return;
this.collapseT-=dt;
this.pitch.rotation.x=dampF(this.pitch.rotation.x,0.52,3.2,dt);
if(this.gunGrp){ this.gunGrp.rotation.z=dampF(this.gunGrp.rotation.z,0.16,2.4,dt); this.gunGrp.position.y=Math.max(BATTERY_TRUNNION-0.26,this.gunGrp.position.y-dt*0.18); }
if(Math.random()<0.35){
spawnP(PT.dirt,this.x+rand(-2.6,2.6),this.baseY+rand(0.2,1.6),this.z+rand(-2.6,2.6),rand(-1.5,1.5),rand(0.6,2.4),rand(-1.5,1.5),rand(0.4,0.8),1.4,rand(0.9,1.5),0.85,4);
}
if(this.collapseT<=0&&this.net){ this.net.visible=false; }
}
// 世界还原后自愈 (23b 把 reg.dead/hp 与视觉台账一并写回): 结构组活了 ⇒ 炮位复活
revive(){
if(this.alive||!this.reg||this.reg.dead||this.reg.hp<=0) return false;
this.alive=true; this.hp=this.reg.hp=this.maxHp;
this.collapseT=0; this.cd=rand(1.4,3.4); this.target=null; this.shots.length=0; this.killedBy=null;
this.pitch.rotation.x=-0.10;
if(this.gunGrp){ this.gunGrp.rotation.z=0; this.gunGrp.position.y=BATTERY_TRUNNION; }
if(this.net){ this.net.visible=true; this.net.rotation.z=0; this.net.position.y=2.42; }
if(this.cyl) this.cyl.y1=this.baseY+1.30;
return true;
}
}
// 载具速度 (Vector3 或标量两态都吃: §11.3 冻结签名里 vel 语义与 Tank 同名同义)
function batteryVelXZ(c){
const v=c&&c.vel;
if(!v) return [0,0];
if(typeof v==='number') return [Math.sin(c.yaw||0)*v,Math.cos(c.yaw||0)*v];
return [v.x||0,v.z||0];
}
// ── 布局期: 由 17-emplacements 在**文件末尾**调用一次 (after atGun/aaGun ⇒ 陆战落位零漂移) ──
function buildBatteries(){
if(typeof SEA==='undefined'||!SEA||!SEA.batteries||!SEA.batteries.length) return BATTERIES; // 非环海图: 零行为 (未消耗任何随机数)
const defs=SEA.batteries, plan=[];
for(const def of defs){
const pl=batteryPlace(def);
if(!pl) continue;
plan.push({def,pl});
}
// 场地平台 (与 coastalPit 同一支: addPad 削平 → 摆完统一重刷地形顶点)
for(const e of plan){
if(typeof addPad==='function') addPad(e.pl.x,e.pl.z,Math.atan2(e.pl.face[0],e.pl.face[1]),BATTERY_PAD_HW,BATTERY_PAD_HW,BATTERY_PAD_RAMP,heightAt(e.pl.x,e.pl.z));
}
if(typeof refreshTerrainMesh==='function') refreshTerrainMesh();
for(const e of plan){
const b=new Battery(e.def,e.pl);
BATTERIES.push(b);
if(typeof console!=='undefined'&&console.log){
console.log('[反舰炮位] '+b.key+' '+b.name+' 落位 ('+b.x.toFixed(1)+','+b.z.toFixed(1)+') 朝向='+(b.face*180/Math.PI).toFixed(1)+
'° ['+e.pl.faceSrc+'] 岸线='+e.pl.coast+' 离岸='+(-shoreDist(b.x,b.z)).toFixed(2)+'m 锚点偏移='+e.pl.distToAnchor.toFixed(1)+'m ('+e.pl.via+') 场地高='+b.baseY.toFixed(2)+'m');
}
}
// 新增碰撞盒 → 占用/寻路/射线索引重建 (06-engineering 同一支成例)
// ★2026-09-26 性能批: 旧版这里是 buildOccupancy()+buildSpatialIndex()+NAV.refresh() 三连 ——
// 而 NAV.refresh 内部本就先调这两个 ⇒ 每次落位白做一整套全量重建 (胡康 1.1s + 1.1s)。
// 保留 NAV.refresh 一支即可 (它同时负责 RGRID 索引与导航网格, 顺序也由它保证)。
if(typeof NAV!=='undefined'&&NAV&&typeof NAV.refresh==='function') NAV.refresh();
else { buildOccupancy(); buildSpatialIndex(); }
return BATTERIES;
}
// ── 主循环挂钩 (24-main 已接: typeof 守卫) ──
function updateBatteries(dt){
if(!BATTERIES.length) return;
for(const b of BATTERIES){
if(b.alive&&b.cd>0) b.cd-=dt;                                  // 弹药冷却统一递减 (与谁瞄准/开火无关)
if(!b.alive&&b.reg&&!b.reg.dead&&b.reg.hp>0) b.revive();      // 世界还原后自愈
b.update(dt);                                                  // 只走生存/塌毁链 —— 无人不开炮 (A#9)
}
_batShotTick();
}
// 外部 AI 接管开关 —— 2026-09-21 A#9 起**空操作**: 兜底 AI 已整段删除, 没有需要让位的东西。
// 保留函数本身只为旧探针的 `typeof batteryExtAI==='function'` 探活 (契约 §6 明写"保留为空操作")。
function batteryExtAI(on){ void on; return false; }
// 对海命中兜底结算 (15d 未落盘时): 与 shellHitNaval 同契约 —— 命中即 damageStructures 之外的那一判定,
// 命中的炮弹从 shells 摘除 ⇒ 15d 落盘后两边不会双算 (谁先结算谁摘弹, 另一个看不见这发弹)。
function _batShotTick(){
if(typeof navalCraft==='undefined'||!navalCraft||!navalCraft.length) return;
const hasHook=(typeof shellHitNaval==='function');
for(const b of BATTERIES){
if(!b.shots.length) continue;
for(let i=b.shots.length-1;i>=0;i--){
const sh=b.shots[i];
if(!sh.s||shells.indexOf(sh.s)<0){ b.shots.splice(i,1); continue; }   // 已被 updateShells/15d 结算或过期
if(sh.done){ b.shots.splice(i,1); continue; }
if(hasHook){ sh.last.copy(sh.s.pos); continue; }                       // 15d 接手: 本文件不重复判定
const to=sh.s.pos;
const dx=to.x-sh.last.x, dy=to.y-sh.last.y, dz=to.z-sh.last.z;
const len=Math.hypot(dx,dy,dz);
if(len>1e-4){
const dir=V3(dx/len,dy/len,dz/len);
let hit=null,hd=len;
for(const c of navalCraft){
if(!c||!c.alive||c.team===sh.s.team) continue;
const cy=batteryTargetCyl(c);
const r=rayCyl(sh.last,dir,cy,hd);
if(r&&r.t<hd){ hd=r.t; hit=c; }
}
if(hit){
const p=V3(sh.last.x+dir.x*hd,sh.last.y+dir.y*hd,sh.last.z+dir.z*hd);
const idx=shells.indexOf(sh.s);
if(idx>=0) shells.splice(idx,1);                                      // 先摘弹 ⇒ 绝不双算
sh.done=true;
hit.takeDmg((sh.s.dmgV||300)+rand(-30,30),sh.s.owner,true);
explosionFXSmall(p);
AudioSys.explosion('navalShell',p.distanceTo(camera.position)*1.6,AudioSys.panOf(p)); // 重炮弹命中档 (★2026-11-15c)
}
}
sh.last.copy(to);
}
}
}
// ── 炮位"可操作"判定 (2026-09-21 A#9 契约 §6): 存活 + 未被占用 ──
// 双签名兼容的由来 (★不是随手加的):
//   · 3 参 `batteryNear(x,z,r)` —— 契约 §6 冻结的**可上炮**语义 (存活且 user/crewBot 都为空), 玩家 F 交互用它;
//   · 4 参 `batteryNear(x,z,r,team)` —— 2026-09-20N 海战批既有的**艇 AI 压制目标**语义 (半径内最近的存活
//     敌对炮位, 不管炮上有没有人): 14-bots.navScanShore 依赖它把"被打掉的炮位"从候选里摘掉。
//   两者语义相反 (前者要"没人开的", 后者要"能打的"), 合并成一个默认值会让其中一边静默失效 ——
//   故按 team 参数是否存在分流, 两条路径各自保留原判据与调用点 (各自零改动)。
function batteryNear(x,z,r,team){
const wantFree=(team===undefined||team===null);   // 3 参 = 可上炮; 4 参 = 敌对目标 (含已占用)
let best=null,bd=(r>0)?r:1e9;
for(const b of BATTERIES){
if(!b.alive) continue;
if(wantFree){ if(b.manned) continue; if(nowT<(b.cdLock||0)) continue; }
else if(b.team===team) continue;
const d=Math.hypot(b.x-x,b.z-z);
if(d<bd){ bd=d; best=b; }
}
return best;
}
// 炮手站位 (契约 §6): 炮位沿 -face 方向 2.7m —— 与 atGun 同规 (炮手站在炮身后方, 面朝 face)。
// 返回 {x,z} (不含 y: 高度由调用方 standHeight 现算, 与 mountAT/updatePlayerAT 同一口径)。
function batteryStandSpot(g){
if(!g) return null;
return {x:g.x-Math.sin(g.face)*BATTERY_CREW_DIST, z:g.z-Math.cos(g.face)*BATTERY_CREW_DIST};
}
// 玩家上炮 (契约 §6): 照抄 mountAT (20-player.js) 的样板 —— 占位 + 摆位 + 收手持武器 + 亮装填条。
// 返回 true=已上炮; false=炮位不存在/已被摧毁/已被占用 (含玩家自己已在炮上: 幂等返回 true)。
function batteryMountPlayer(g){
if(!g||!g.alive) return false;
const p=(typeof player!=='undefined')?player:null;
if(!p) return false;
if(p.onBattery===g) return true;                              // 幂等: 已在炮上
if(g.user||g.crewBot) return false;                           // 一炮一人 (与固定火力点同规)
const sp=batteryStandSpot(g);
g.user=p; p.onBattery=g;
p.pos.x=sp.x; p.pos.z=sp.z;
p.pos.y=(typeof standHeight==='function')?standHeight(p.pos.x,p.pos.z,p.pos.y+1):p.pos.y;
p.vel.set(0,0,0);
p.yaw=g.face+Math.PI; p.pitch=0; p.ads=false;                 // 面朝 face (与 mountAT 同式: 相机 yaw = face+π)
VM.root.visible=false;
if(typeof document!=='undefined'&&document.getElementById){ const h=document.getElementById('heatWrap'); if(h) h.style.display='block'; }
return true;
}
// 玩家下炮 (契约 §6): 清占用 + 清 cd 锁 + 恢复 VM/装填条. 位置保持不动 (由步行态接管, 不做落点探测)。
function batteryDismountPlayer(){
const p=(typeof player!=='undefined')?player:null;
const g=(p&&p.onBattery)||null;
if(g){
if(g.user===p) g.user=null;
g.cdLock=0;                                                   // "清 cd 锁" (契约 §6 原文): 下炮即可被他人认领
}
if(p) p.onBattery=null;
if(typeof VM!=='undefined'&&VM.root) VM.root.visible=true;
if(typeof document!=='undefined'&&document.getElementById){ const h=document.getElementById('heatWrap'); if(h) h.style.display='none'; }
return !!g;
}
// Bot 侧驱动 (14-bots 的固定火力点链每帧调用; Lead 2026-09-21 裁定: 名字保留, 但**有人才动**):
//   · 无人 (crewBot 为空) ⇒ 直接返回 false —— 这是"无人 60s 开炮 0 次"的唯一保证点 (旧版此处无条件索敌开火);
//   · 玩家在炮上 (g.user) ⇒ 不抢操作权 (与固定火力点同一纪律, 与 14-bots 旧 batteryAI 的判据一致);
//   · 有人 (crewBot) ⇒ 走既有的"最近目标 + LOS + 提前量"解算 Battery.aim, 只有对准且 cd 走完才调
//     Battery.fire 这一支开火入口 —— 节奏单源仍在 Battery.fire 的 cd 闸门里 (双驱动方也不会双倍射速)。
function batteryAI(battery,dt){
if(!battery||!battery.alive) return false;
if(!battery.crewBot) return false;             // A#9: 无人完全静止
if(battery.user) return false;                 // 玩家在炮位上: 不抢操作权
const dir=Battery.aim(battery,dt);
if(!dir) return false;
return Battery.fire(battery,null,null);        // dir 省略 = 用刚刚调好的 yaw/pitch 现算 (含散布)
}
// ═══════ 冻结的模块级入口 (设计定稿 §11.5 + Lead 裁定 §11.9⑨ + 2026-09-21 A#9 修订) ═══════
// 唯一开火入口 **保持仓库现状签名 batteryFire(b,dir,owner)** (Lead 2026-09-21 裁定①: 14-bots.js:2842 是
// 全仓唯一调用点, 现写法 `batteryFire(b,dir,b.user||null)`; 改形参顺序会让"方向"被当成"射手"静默错位):
//   玩家上炮开火 → batteryFire(g, dir, player)   (见 20a-seats.updatePlayerBattery)
//   Bot 认领开炮 → batteryFire(b, dir, b.crewBot) 或本文件的 batteryAI(b,dt)
// 想复用同一份"最近目标 + LOS + 提前量"解算时调 batteryAim。两者都是 Battery 静态方法的薄封装。
function batteryFire(b,dir,owner){ return (b&&typeof Battery.fire==='function')?Battery.fire(b,dir,owner):false; }
function batteryAim(b,dt){ return (b&&typeof Battery.aim==='function')?Battery.aim(b,dt):null; }
// 自检/调试用统计 (A#9: 增记"炮上有没有人"/冷却, 供"无人 60s 开炮 0 次"的探针与人工核对)
function batteryStats(){
return BATTERIES.map(b=>({key:b.key,x:+b.x.toFixed(2),z:+b.z.toFixed(2),face:+(b.face*180/Math.PI).toFixed(1),
shore:+(shoreDist(b.x,b.z)).toFixed(2),coast:b.place.coast,via:b.place.via,hp:+b.hp.toFixed(1),
alive:b.alive,manned:b.manned,user:!!b.user,crewBot:!!b.crewBot,cd:+b.cd.toFixed(2),cdLock:+(b.cdLock||0).toFixed(2),
target:b.target?((b.target.name)||(b.target.spec&&b.target.spec.name)||'?'):null,shots:b.shots.length}));
}
