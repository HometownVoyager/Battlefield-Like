// ─────────────────────────────────────────────
// 15d-naval.js —— 海战载具本体: 四档物理 / 武器管线 / 进水沉没 / 重生 (2026-09-20N 海战批)
// owner: naval-hull · task-2 · 契约见《海战系统设计定稿-20260920.md》§11.3 (签名已冻结, 不得单方面改)
//
// 【本文件职责】4 型战斗载具 (LVT(A)-1 / 特二式カミ / PT 艇 / 九三式鱼雷艇) 的本体:
//   ① 四档物理: 吃水 · 浮态(横倾/纵倾/浪涌) · 搁浅/浅水 · 进水沉没
//   ② 两栖车水陆双态 (履带态**复用** 15-vehicles 的 tankRideH/tankSurfH/坡度闸门/静态体推挤)
//   ③ 武器: 主炮(既有 shells 管线·对岸对艇双用) / 机炮机枪(fireBullet) / 鱼雷(本文件在途表)
//   ④ 命中接口: navalHitCyl / navalRayHit / shellHitNaval / torpedoHitTest (供 13/15 各一行接线)
//   ⑤ 重生: CAMPAIGN.sea.muster + 队内序号横向 22m, 断言落在 sea.navRing 内
//
// 【单源纪律 (纲领 §4.3)】水深/水面一律走 03-terrain 的 waterYAt/waterDepthAt/shoreDist;
//   浪涌相位走 NAVAL_CFG(00-config) 的 waveFreq/waveKx/waveKz —— 与 05b BUOYS 同频同振幅口径;
//   载具数值一律读 NAVAL_SPEC(00-config), 本文件不另写一套尺寸/伤害/速度。
//   本文件**新建**独立载具文件 (与 15c-specveh 同范式): 不侵入 tanks/trucks/planes 任何表。
//
// 【依赖】15e-navmodels.js 的 navBuildModel(spec) (§11.2 冻结): typeof 守卫 + 兜底盒 ——
//   15e 未落盘时物理/自检照跑, 落盘后自动接上 (不阻塞)。
// ─────────────────────────────────────────────
'use strict';
// ══════════════════════════════════════════════════════════════════════════
// 一、参数 (结构性常量; 载具数值一律在 00-config 的 NAVAL_SPEC / NAVAL_CFG)
// ══════════════════════════════════════════════════════════════════════════
const NAVAL_SPAWN_GAP=22;    // 重生横向错位 (m) —— §6.2 定稿数值
const NAVAL_ROLL_K=26;       // 转向横倾: 稳性回复弹簧刚度 (ω≈5.1rad/s)
const NAVAL_ROLL_D=7.2;      // 横倾阻尼 (ζ≈0.7 —— 过阻尼不来回摆)
const NAVAL_PITCH_K=22;      // 加速纵倾: 弹簧刚度
const NAVAL_PITCH_D=6.5;     // 纵倾阻尼
const NAVAL_TORP_DEPTH=1.1;  // 鱼雷定深 (m): 水下引信 —— 水深 < 定深+0.25 即撞滩哑火
const NAVAL_TORP_R=1.9;      // 鱼雷命中半径余量 (叠加艇体半宽 → 胶囊)
const NAVAL_TORP_FLOOD=1.05; // 鱼雷命中即灌满 flood (§2.1 "命中即重创")
const NAVAL_TORP_CD=1.2;     // 鱼雷齐射间隔 (s): 连发多管不会同帧全部出管
const NAVAL_TORP_GYRO=0.35;  // 出管回转角 (rad): 未给瞄准方向时的默认外偏 (鱼雷管指向舷外前方)
const NAVAL_PIT_MIN=-0.14;   // 炮管俯仰下限 (rad ≈ −8°): 打近处步兵/水面目标要能压下去;
                             // 不插进甲板 —— 炮耳在车体顶面之上 ~0.4m, 2.1m 炮管压 8° 只下沉 0.29m (仍在顶面之上)
const NAVAL_PIT_MAX=0.35;    // 炮管俯仰上限 (rad ≈ 20°): 打岸上工事够用, 不指天
// ★2026-09-26E (审计 19): 本常量**无读点** (takeDmg 里直接读全局 TANK_ARMOR) —— 保留作口径声明,
//   不是配置: 非反装甲伤害减免与陆战同源, 不另造第二个装甲系数 (见下方 takeDmg 的 TANK_ARMOR 用法)。
const NAVAL_ARMOR_SRC='TANK_ARMOR'; // (声明性常量; 实读点是 takeDmg 的 TANK_ARMOR)
const NAVAL_WAKE_T=0.20;     // 尾迹粒子间隔 (s) —— 只给相机附近的艇, 不吃爆炸粒子预算
const NAVAL_WAKE_D=110;      // 尾迹可视距离 (m)
// ── 全局表 (冻结 API) ──
const navalCraft=[];         // 全部载具实例 (含已沉的 wreck; §11.3)
const torpedoes=[];          // 鱼雷在途表 (推进/尾迹/命中判定/撞滩哑火)
// ══════════════════════════════════════════════════════════════════════════
// 二、几何/工具 (解析口径; 15e 的 muzzles 锚点优先)
// ══════════════════════════════════════════════════════════════════════════
// 浪涌单源 (m): 直接调 00-config 的波场 seaWaveOffset (2026-09-20N 新增) ——
//   05b BUOYS 与 15d 水面载具共读同一支, 同 (x,z,t) 结果逐位相同 ⇒ "艇与浮标同波"可逐点断言。
// (旧写法是本地再写一条 sin, 与 05b 各写一条 = 两套浪; 已改为委托单源, 兜底仅防加载顺序意外的探针)
function navalWaveAt(x,z,t){
  const T=(t===undefined)?nowT:t;
  if(typeof seaWaveOffset==='function') return seaWaveOffset(x,z,T);
  return Math.sin(T*NAVAL_CFG.waveFreq+x*NAVAL_CFG.waveKx+z*NAVAL_CFG.waveKz)*NAVAL_CFG.waveAmp;
}
// 吃水单源 (m): draft = draft0 + flood*0.5 (§3.1 冻结公式)
function navalDraftOf(n){
  return (n.spec.draft0||0)+(n.flood||0)*0.5;
}
// 艇体胶囊: 中心线线段 + 半径 (长扁形判定的单源; navalHitCyl 的圆是它的保守外接近似)
function navalCapsule(n){
  const S=n.spec;
  const r=Math.max(1.2,S.hullW*0.5*1.05);
  const hl=Math.max(0.6,S.hullL*0.5-r);
  const sn=Math.sin(n.yaw), cs=Math.cos(n.yaw);
  const y0=n.pos.y+(n.kind==='amph'?-0.05:-0.15);
  // 命中上限 y1 (★2026-09-26 修): 旧版一律 hullH*1.05 —— 那是**舷缘**高, 而炮塔/炮座还在它上面:
  //   实测 (dev/_navcap.js) LVT 炮塔顶 2.78m / カミ 2.39m / PT 塔顶 2.94m / 鱼雷艇 2.48m, 而旧上限分别只有
  //   2.05 / 1.63 / 2.73 / 2.31 ⇒ 打车顶塔身的子弹与炮弹**从头顶飞过** (两栖车尤其明显: 整个炮塔打不中)。
  //   现按两族各自的口径取上限, 都与本文件既有的命中链同源:
  //     · 两栖车 = 坦克命中柱的上限 (15-vehicles 的 VEH_HIT_TOP; navalHitCyl 的 amph 分支本来就返回 vehHitCyl)
  //     · 艇     = max(舷缘, 模型自报的塔顶 dims.turretY+dims.turretH) —— 炮打在塔上就是打在艇上
  let topY=S.hullH*1.05;
  if(n.kind==='amph') topY=(typeof VEH_HIT_TOP==='number')?VEH_HIT_TOP:2.6;
  else if(n.dims&&n.dims.turretY!==undefined&&n.dims.turretH!==undefined) topY=Math.max(topY,n.dims.turretY+n.dims.turretH);
  return {ax:n.pos.x-sn*hl, az:n.pos.z-cs*hl, bx:n.pos.x+sn*hl, bz:n.pos.z+cs*hl,
          r, hl, y0, y1:n.pos.y+topY};
}
// 射线 ∩ 线段的最短距离解 (2D; 供弹丸/鱼雷共用): 返回 {t, d2}
function navalRaySeg(ox,oz,dx,dz,ax,az,bx,bz,maxD){
  const ex=bx-ax, ez=bz-az;
  const a=dx*dx+dz*dz;
  const c=ex*ex+ez*ez;
  if(a<1e-9){ const px=ox-ax, pz=oz-az; return {t:0,d2:px*px+pz*pz}; }
  if(c<1e-9){ const wx=ox-ax, wz=oz-az; const t=clamp((dx*wx+dz*wz)/a,0,maxD); const px=ox+dx*t-ax, pz=oz+dz*t-az; return {t,d2:px*px+pz*pz}; }
  const b=dx*ex+dz*ez;
  const wx=ox-ax, wz=oz-az;
  const d=dx*wx+dz*wz, e=ex*wx+ez*wz;
  const den=a*c-b*b;
  let t,s;
  if(den<1e-9){ t=clamp(-d/a,0,maxD); s=0; }
  else { t=clamp((b*e-c*d)/den,0,maxD); s=clamp((a*e-b*d)/den,0,1); }
  // 两轮定标: 以 s 定 t → 以 t 定 s → 再以 s 定 t (射线/线段互夹的解算收敛)
  t=clamp((b*s-d)/a,0,maxD);
  s=clamp((b*t+e)/c,0,1);
  t=clamp((b*s-d)/a,0,maxD);
  const px=ox+dx*t, pz=oz+dz*t;
  const qx=ax+ex*s, qz=az+ez*s;
  const ddx=px-qx, ddz=pz-qz;
  return {t,d2:ddx*ddx+ddz*ddz};
}
// 点到线段最短距离 (2D; 鱼雷/命中判定用)
function navalPtSeg2(px,pz,ax,az,bx,bz){
  const ex=bx-ax, ez=bz-az;
  const c=ex*ex+ez*ez;
  if(c<1e-9){ const dx=px-ax, dz=pz-az; return dx*dx+dz*dz; }
  const s=clamp(((px-ax)*ex+(pz-az)*ez)/c,0,1);
  const dx=px-(ax+ex*s), dz=pz-(az+ez*s);
  return dx*dx+dz*dz;
}
// ── 炮座解析几何 (15e 的 muzzles 锚点优先; 这里只做"没有锚点时"的兜底) ──
// localZ=沿艏向偏移, localX=右舷偏移, y=炮轴高 (相对载具原点), len=出膛预留
function navalMountGeom(S,nm){
  const roof=S.hullY+S.hullH*0.5;
  if(S.kind==='amph'){
    if(nm==='mg') return {localZ:(S.tur?S.tur.ringZ:0)+0.9, localX:0.45, y:roof+0.02, len:1.1};
    return {localZ:S.tur?S.tur.ringZ:0, localX:0, y:roof+0.10, len:(S.barrelL||1.6)+0.30};
  }
  // 快艇: 主炮=艇艏固定座 (有少量回旋), 双联 .50=舰尾高座
  if(nm==='secondary') return {localZ:-S.hullL*0.12, localX:0, y:roof+0.42, len:1.0};
  if(nm==='mg') return {localZ:S.hullL*0.16, localX:-0.55, y:roof+0.30, len:0.8};
  return {localZ:S.hullL*0.30, localX:0, y:roof+0.16, len:1.5};
}
// 任意 15e 锚点的世界坐标 (锚点缺失/桩环境无 getWorldPosition 时返回 null, 由调用方解析兜底)
function navalAnchorWorld(n,mo){
  if(!mo) return null;
  if(typeof mo.getWorldPosition==='function'&&n.grp&&typeof n.grp.updateMatrixWorld==='function'){
    try{ n.grp.updateMatrixWorld(true); return mo.getWorldPosition(V3()); }catch(e){ /* 桩环境退化 */ }
  }
  return null;
}
// 炮口世界坐标: 优先 15e 的炮口锚点 (挂在该转的父节点下 ⇒ 转塔/俯仰自动跟随);
// 拿不到 (15e 未落盘 / 沙箱桩没有 getWorldPosition) 时按 spec 解析兜底 —— 两者相差 ≤0.3m, 不进命中判定
function navalMuzzleWorld(n,nm){
  const mo=n.muzzles&&n.muzzles[nm];
  const w=navalAnchorWorld(n,mo);
  if(w) return w;
  const g=navalMountGeom(n.spec,nm);
  const a=n.yaw+(n.turretYaw||0), p=n.turretPitch||0;
  const cp=Math.cos(p);
  const cs=Math.cos(n.yaw), sn=Math.sin(n.yaw);
  const bx=n.pos.x+sn*g.localZ+cs*g.localX;
  const bz=n.pos.z+cs*g.localZ-sn*g.localX;
  return V3(bx+Math.sin(a)*cp*g.len, n.pos.y+g.y+Math.sin(p)*g.len, bz+Math.cos(a)*cp*g.len);
}
// ── 残骸材质: 与坦克残骸同一材质单源 (wreckMat 只读不可变, 不复制脏数据) ──
let _navalWreckMat=null;
function navalWreckMaterial(){
  if(typeof wreckMat!=='undefined'&&wreckMat) return wreckMat;
  if(!_navalWreckMat) _navalWreckMat=new THREE.MeshLambertMaterial({color:0x1e1c18,map:(typeof TEX!=='undefined'&&TEX.grime)?TEX.grime:null});
  return _navalWreckMat;
}
// ══════════════════════════════════════════════════════════════════════════
// 三、兜底模型 (15e 未落盘/抛错时的临时盒): 尺寸严格取 spec, 保证物理与命中口径可测
// ══════════════════════════════════════════════════════════════════════════
function navalFallbackModel(S){
  const grime=(typeof TEX!=='undefined'&&TEX.grime)?TEX.grime:null;
  const mat=new THREE.MeshLambertMaterial({color:S.col,map:grime});
  const matT=new THREE.MeshLambertMaterial({color:S.colT!==undefined?S.colT:S.col,map:grime});
  const grp=new THREE.Group();
  const hull=new THREE.Mesh(new THREE.BoxGeometry(S.hullW,S.hullH,S.hullL),mat);
  hull.position.y=S.hullY; grp.add(hull);
  const bow=new THREE.Mesh(new THREE.BoxGeometry(S.hullW*0.86,S.hullH*0.7,S.hullL*0.16),matT);
  bow.position.set(0,S.hullY+S.hullH*0.12,S.hullL*0.46); grp.add(bow);
  let turretG=null,pitchG=null;
  const muzzles={};
  if(S.tur){
    turretG=new THREE.Group();
    turretG.position.set(0,S.hullY+S.hullH*0.5,S.tur.ringZ||0);
    grp.add(turretG);
    const tc=new THREE.Mesh(new THREE.CylinderGeometry(S.tur.l*0.5,S.tur.l*0.5,S.tur.h,12),matT);
    tc.position.y=S.tur.h*0.5; turretG.add(tc);
    pitchG=new THREE.Group(); pitchG.position.y=S.tur.h*0.42; turretG.add(pitchG);
    const bar=new THREE.Mesh(new THREE.CylinderGeometry(S.barR,S.barR,S.barrelL,8),matT);
    bar.rotation.x=Math.PI/2; bar.position.z=S.barrelL*0.5; pitchG.add(bar);
    const m=new THREE.Object3D(); m.position.z=S.barrelL+0.30; pitchG.add(m); muzzles.main=m;
    const mg=new THREE.Object3D(); mg.position.set(0.45,0.0,0.9); pitchG.add(mg); muzzles.mg=mg;
  }else{
    const g0=navalMountGeom(S,'main');
    const mg=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,1.6,8),matT);
    mg.rotation.x=Math.PI/2; mg.position.set(g0.localX,g0.y,g0.localZ); grp.add(mg);
    const m=new THREE.Object3D(); m.position.set(g0.localX,g0.y,g0.localZ+g0.len); grp.add(m); muzzles.main=m;
    if(S.secondary){
      const g1=navalMountGeom(S,'secondary');
      const tb=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.18,0.5),matT);
      tb.position.set(g1.localX,g1.y-0.12,g1.localZ); grp.add(tb);
      const m2=new THREE.Object3D(); m2.position.set(g1.localX,g1.y,g1.localZ+g1.len); grp.add(m2); muzzles.secondary=m2;
    }
  }
  return {grp,turretG,pitchG,wheels:[],muzzles,nodes:{}};
}
// ══════════════════════════════════════════════════════════════════════════
// 四、NavalCraft —— 载具本体
// ══════════════════════════════════════════════════════════════════════════
class NavalCraft {
  // specKey ∈ NAVAL_SPEC 的键 ('lvt'|'kami'|'pt'|'gyorai'); team 阵营; ord 队内序号 (重生横向错位用)
  constructor(specKey,team,ord){
    const S=NAVAL_SPEC[specKey];
    if(!S) throw new Error('NavalCraft: 未知 specKey '+specKey);
    this.spec=S;
    this.def=S;                 // Tank 座驾接口别名 (20a 的 updatePlayerNaval 按 def.spd/rev/turn/tRate 取参)
    this.key=specKey;
    this.kind=S.kind;           // 'amph' 两栖履带 | 'boat' 快艇
    this.team=team|0;
    this.ord=ord|0;
    this.name=S.name;
    this.hp=S.hp; this.maxHp=S.hp;
    this.alive=true;
    this.flood=0;               // 0..1+ (进水; >1 → 沉没链)
    this.state='run';           // 'run' | 'ground' | 'sinking' | 'wreck'
    this.pos=V3(); this.yaw=0; this.vel=0;
    this.turretYaw=0; this.turretPitch=0;
    this.aimDt=1/60;            // 上一帧 dt (炮塔/俯仰限速用): 玩家链的 turretAimAt 不带 dt, 靠它对齐真实帧长
    this.roll=0; this.rollV=0; this.pitch=0; this.pitchV=0;   // 浮态 (横倾/纵倾)
    this.suspP=0; this.suspR=0; this.suspPV=0; this.suspRV=0; this.lastVel=0;  // 履带态悬挂
    this._prevYaw=0;
    this.floating=(S.kind==='boat');   // 水陆双态当前态 (update 每帧按 waterDepthAt 现算)
    this.draft=S.draft0||0;
    this.depth=-1e9; this.waterY=-1e9; this.waveY=0; this.baseY=0;
    this.cannonCd=0; this.cdMax=S.main?S.main.rof:1; this.secT=0; this.mgT=0; this.torpCd=0;
    // A#3 载具机枪过热 (契约 A, 2026-09-21): 艇载机枪/副武器与坦克同轴机枪**同一份规则** ——
    // 三个函数 (vehMgHeatTick/vehMgHeatAdd/vehMgCanFire) 在 15-vehicles.js 单源实现, 本文件只调用;
    // mgTrig = 本帧是否有开火请求 (开火入口置位, update 消费 ⇒ 玩家按住扳机时 0.22/s 散热不生效)。
    this.heat=0; this.heatLock=false; this.mgTrig=false;
    this.torpLeft=S.torpedo||0;
    this.respawnT=0; this.lastDmgT=-99; this.lastDriveT=-99; this.threatYaw=null;
    this.driverBot=null;        // 冻结字段: AI 驾驶员 (naval-ai 只读/只写这一个)
    this.crewBot=null;          // 14-bots spawnInVehicle 写入的车组 (与 Tank 同契约)
    this.playerDriven=false;
    this.aiDrive=true;          // naval-ai 若自行驱动可置 false (本文件随即不再调 boatAI/amphAI)
    this.isAI=true;
    this.sinkJob=null; this.fireSrc=null; this.wreckBs=null;
    this.inFwd=0; this.inTurn=0;
    this.muzzles={}; this.nodes={}; this.wheels=[];
    this.turretG=null; this.pitchG=null;
    // 车组占位记录 (与 Tank.crew 同契约: 炮弹/子弹的 owner, 击杀来源取 _src)。
    // ★ 语义 (2026-09-20N Lead 裁定, 与 Tank 的"乘员随车阵亡"**刻意不同**):
    //   crew.alive = **乘员是否生还** —— 舰艇沉没时乘员是**落水生还**的 (§3.4③), 故 crewOut 不置 false;
    //   "舰上是否还有车组"请读 crewBot===null / playerDriven, 或用只读 `manned` 判 —— 别把两件事挤进一个字段。
    this.crew={name:this.name,team:this.team,kills:0,deaths:0,score:0,isPlayer:false,isCrew:true,
      pos:this.pos,alive:true,lastFiredT:-99,damage(){},vel:V3()};
    this.buildMesh();
    // 引擎基档按艇型 (★2026-11-15c 音效推倒重写批): amph 履带两栖 / boat 汽艇 —— 每帧音色仍由 01-audio
    //   海战追加段 navalAudEngine 塑形接管 (osc/osc2/lp 契约不变), 基档只定"建闸前的底色"。
    this.engine=(typeof AudioSys!=='undefined'&&AudioSys.createEngine)?AudioSys.createEngine(this.kind==='boat'?'boat':'amph'):null;
    // 引擎音频开关注解 (2026-09-20N 收尾, naval-crew 报的音频节点泄漏): 沉没/残骸期**一律不再 update 引擎** ——
    // 01-audio 的 engine.update 会把已 stop 的振荡器/增益"静音重建", 残骸期每台白占 4 个音频节点且回收不掉。
    // 本开关在 crewOut/_finishWreck 置 false、在 respawn 置回 true —— 单点控制, 不依赖 state 字符串。
    this.engineOn=true;
    navalCraft.push(this);
    this.respawn(true,true);    // 开局首次生成不播报
  }
  // ── 建模: 15e 的 navBuildModel 优先, 抛错/缺失走兜底盒 (不阻塞自检, 落盘后自动接上) ──
  buildMesh(){
    let M=null;
    if(typeof navBuildModel==='function'){
      try{ M=navBuildModel(this.spec)||null; }
      catch(e){ M=null; if(typeof console!=='undefined') console.warn('[15d] navBuildModel 抛错, 走兜底盒:',e&&e.message); }
    }
    this.modelFallback=!M||!M.grp;
    if(this.modelFallback) M=navalFallbackModel(this.spec);
    this.grp=M.grp;
    this.turretG=M.turretG||null;
    this.pitchG=M.pitchG||null;                 // §11.2 的可选增量; 没有则只转 turretG
    this.mainG=M.mainG||M.turretG||null;        // 艇的主炮回旋座 (15e 额外返回; 艇用它跟瞄)
    this.secG=M.secG||null;                     // 副武器座 (pt 双联 .50; gyorai = null)
    this.pitchG2=M.pitchG2||null;               // 副武器俯仰组
    this.dims=M.dims||null;                     // 15e 附赠: {L,W,H,hullY,bot,roof,deckY,waterline}
    this.wheels=Array.isArray(M.wheels)?M.wheels:[];
    this.muzzles=M.muzzles||{};
    this.nodes=M.nodes||{};
    this.halfW=this.spec.hullW*0.5;
    if(world&&world.add) world.add(this.grp);
  }
  // ══════════════ 只读快照 (其他队友只读, 不许写) ══════════════
  draftNow(){ return this.draft; }
  // §11.9⑧ 冻结: 剩余鱼雷数只读字段 (HUD 读它; 存储是 torpLeft, 二者同步)
  get torpAmmo(){ return this.torpLeft; }
  // 舰上是否还有车组 (玩家或 Bot 在操车) —— 与"乘员是否生还"(crew.alive) 分开, Lead 2026-09-20N 裁定
  get manned(){ return !!(this.playerDriven||(this.crewBot&&this.crewBot!==null)); }
  torso(){ return this.grp; }
  // ══════════════ 驾驶 (玩家 20a 与 Bot AI 唯一入口) ══════════════
  // fwd/turn ∈ [-1,1]。搁浅时倒车推力 ×NAVAL_CFG.groundingRevMul(0.6) 可脱困 (§3.3);
  // 浅水 ×shallowSpdMul; 两栖车浮航态 ×wadeSpdMul / 转向 ×wadeTurnMul (§3.5)。
  drive(fwd,turn,dt){
    if(!(dt>0)) return;
    this.inFwd=clamp(fwd||0,-1,1);
    this.inTurn=clamp(turn||0,-1,1);
    this.lastDriveT=nowT;
    if(!this.alive||this.state==='sinking'||this.state==='wreck'){ this.vel=dampF(this.vel,0,6,dt); return; }
    const S=this.spec;
    const d=waterDepthAt(this.pos.x,this.pos.z);
    const draft=this.draft;
    // ★2026-09-21B 用户实报「两栖车在水浅的地方会搁浅掉血」: 吃水 draft 是**艇**的硬阈值, 两栖车没有"搁浅"
    //   这个概念 —— 它的边界是换态阈值 wadeDepth (水深 ≥wadeDepth 浮航, 否则履带), 而 draft0(0.40) < wadeDepth(0.55)
    //   意味着健康两栖车**永远不会**在浮航态触底, 那条"龙骨擦礁"在几何上无从发生 (纯误伤: 实测 4 HP/s 且速度砍到 1.12m/s)。
    //   进水后 draft 涨过 wadeDepth 更糟: 会判 grounded ⇒ 前进推力归零 + 刮擦, 倒车 3.75s 只退 1.86m (探针实测)。
    //   ⇒ 擦礁/搁浅一律只对 kind==='boat'; 两栖车浮航态只保留 wadeSpdMul 的"水里慢"档。
    const isAmph=(this.kind==='amph');
    const grounded=!isAmph&&this.floating&&d>-1e8&&d<draft;
    const shallow=!isAmph&&this.floating&&!grounded&&d>-1e8&&d<draft+NAVAL_CFG.shallowPad;
    let mul=1;
    if(shallow) mul*=NAVAL_CFG.shallowSpdMul;
    if(this.kind==='amph'&&this.floating) mul*=S.wadeSpdMul;
    if(this.kind==='amph'&&!this.floating&&d>0.15) mul*=0.78;   // 履带态涉水阻力 (0.15m 以上开始拖)
    const revMul=grounded?NAVAL_CFG.groundingRevMul:1;
    // ★ 触底搁浅时**前进推力为 0** (螺旋桨推不动泥面): 速度阻尼到 0, 只有倒车能脱困 (§3.3)
    //   —— 若这里照旧给前进目标速度, vel 会被"每帧重新推起 + update 每帧拍回"顶在 0.7m/s 附近,
    //      位置虽不动, 但"速度归零"的字面断言不成立 (用户验收红线 3)。
    let tgt=(this.inFwd<0)?-S.rev*mul*revMul:this.inFwd*S.spd*mul;
    if(grounded&&this.inFwd>0) tgt=0;
    const kAcc=(this.kind==='boat')?1.55:2.5;                   // 艇加速更快 (滑行艇体)
    this.vel=dampF(this.vel,tgt,kAcc,dt);
    const turnMul=(this.kind==='amph'&&this.floating)?S.wadeTurnMul:1;
    // 倒车时舵效反向 (与 Tank 同一口径: yaw -= turn*turn*dt*(fwd<0?-1:1))
    this.yaw-=this.inTurn*S.turn*turnMul*dt*(this.inFwd<0?-1:1);
  }
  // ══════════════ 武器: 瞄准 ══════════════
  aimDir(){
    const a=this.yaw+(this.turretYaw||0), p=this.turretPitch||0;
    return V3(Math.sin(a)*Math.cos(p),Math.sin(p),Math.cos(a)*Math.cos(p));
  }
  turretAimDir(){ return this.aimDir(); }        // naval-ai 的瞄准门控 (缺失时它退到 aimDir)
  muzzle(nm){ return navalMuzzleWorld(this,nm||'main'); }
  coaxMuzzle(){ return navalMuzzleWorld(this,this.spec.mg?'mg':'secondary'); }
  // ── Tank 座驾接口别名 (20a-seats 的 updatePlayerNaval 直接复用 updatePlayerTank 的红利) ──
  fireCannon(customDir){ return this.fireMain(customDir); }
  firePlayerMG(dir){ return this.spec.secondary?this.fireSecondary(dir):this.fireMG(dir); }
  // ══════════════ 炮塔: 360° 连续回转 (2026-09-21 海战 AI 全盘优化批 · 需求⑥) ══════════════
  // turretYaw = **相对艏向的连续累计角** (不是归一化到 ±π 的角)。这是"能转满一圈"的实现口径:
  //   angleLerpTo 内部按最短弧取差 (angDiff 归一到 (-π,π]), 所以 cur=3.0 而目标在 -3.0 时它走 +0.28
  //   继续往前越过 π, 绝不倒回 -3.0 —— 于是 turretYaw 单调累积 (可能 >2π), 逐帧差值恒 ≤ tRate*dt,
  //   不存在 2π 级跳变 (自检 ⑨ 逐帧断言 |Δ| ≤ tRate*dt*1.5)。turretG.rotation.y 是周期量,
  //   累计角与归一化角视觉等价; 而**差值**必须连续, 否则炮塔会"闪现"到目标方位。
  // 为什么不在瞄准时直接赋值: 瞬时转向 = 炮塔闪现 + 后坐力方向跳变; 回转必须限速 (spec.tRate)。
  turretAimWorld(worldYaw,dt){
    const dt2=(typeof dt==='number'&&dt>0)?dt:((this.aimDt>0)?this.aimDt:1/60);
    const step=Math.max(0.02,this.spec.tRate||1.9)*dt2;
    const want=angDiff(this.yaw,worldYaw);           // 世界方位 → 炮塔局部 (相对艏向)
    this.turretYaw=angleLerpTo(this.turretYaw,want,step);
    return this.turretYaw;
  }
  // 炮塔转向目标点 (rad; 签名 §11.3 冻结不动, 只是内部改走 turretAimWorld —— 360° 连续)
  turretAimAt(x,z,dt){
    return this.turretAimWorld(Math.atan2(x-this.pos.x,z-this.pos.z),dt);
  }
  // 三维瞄准: (x,z) 走回转, y 走俯仰。AI (14-bots navBoatShoot) 与玩家都走这一支。
  // 俯仰限幅 [pitMin,pitMax]: 炮管不插进甲板、不指天 (与坦克 p.pitch 的 -0.12~0.32 同档)。
  turretAimPoint(x,y,z,dt){
    this.turretAimAt(x,z,dt);
    if(typeof y==='number'&&isFinite(y)){
      const dh=Math.hypot(x-this.pos.x,z-this.pos.z)||1;
      const pivotY=this.pos.y+(this.spec.hullY||0)+(this.spec.hullH||0)*0.5;   // 炮塔环高 (与 15e/兜底盒同式)
      const want=clamp(Math.atan2(y-pivotY,dh),NAVAL_PIT_MIN,NAVAL_PIT_MAX);
      const dt2=(typeof dt==='number'&&dt>0)?dt:((this.aimDt>0)?this.aimDt:1/60);
      this.turretPitch=angleLerpTo(this.turretPitch,want,Math.max(0.2,(this.spec.tRate||1.9)*0.6)*dt2);
    }
    return this.turretYaw;
  }
  // 当前炮塔是否已指向该点 (只读; 供 HUD/探针核对, 不参与开火门控 —— 门控在 14-bots navBoatShoot)
  turretOnTarget(x,y,z,tol){
    const a=this.aimDir();
    let dx=x-this.pos.x, dz=z-this.pos.z, dy=(typeof y==='number'?y-this.pos.y-1.8:0);
    const l=Math.hypot(dx,dy,dz)||1;
    const dot=clamp((a.x*dx+a.y*dy+a.z*dz)/l,-1,1);
    return Math.acos(dot)<=(tol===undefined?0.05:tol);
  }
  _shooter(){ return this.playerDriven?player:(this.crewBot||this.crew); }
  // ══════════════ 武器: 主炮 (既有 shells 管线 —— 对岸对艇双用, 用户第 6 条) ══════════════
  fireMain(customDir){
    if(!this.alive||this.state==='sinking'||this.state==='wreck') return false;
    const M=this.spec.main;
    if(!M||this.cannonCd>0) return false;
    this.cannonCd=M.rof; this.cdMax=M.rof;
    let dir=customDir?customDir.clone():this.aimDir();
    dir.normalize();
    const o=navalMuzzleWorld(this,'main');
    const shooter=this._shooter();
    shooter._src=this.name;
    if(typeof AudioSys!=='undefined') AudioSys.cannon('naval_'+this.key,this.pos.distanceTo(camera.position),AudioSys.panOf(this.pos)); // 舰炮按艇型分档 (★2026-11-15c: lvt 37mm/kami 120mm/pt/gyorai; 未知 key 回落 generic)
    spawnP(PT.flash,o.x,o.y,o.z, dir.x*3,dir.y*3,dir.z*3, 1.0,10,0.12,1,0,true);
    spawnP(PT.dark,o.x,o.y,o.z, dir.x*3+rand(-1,1),1.5,dir.z*3+rand(-1,1), 1.0,3,0.9,0.7,0.5);
    if(this.playerDriven){ addTrauma(0.5); }
    this.pitchV-=0.34*Math.cos(this.turretYaw);      // 后坐: 纵倾 + 侧倾弹簧各吃一记
    this.rollV+=0.26*Math.sin(this.turretYaw);
    shells.push({pos:o.clone(),vel:dir.clone().multiplyScalar(M.spd),team:this.team,owner:shooter,
      life:3.4,kind:'naval',dmgV:M.dmg,trail:0,src:this.name});   // life: 2026-09-21B 弹速 115→190 后按比例 5.5→3.4 (射程包线不变); src: 弹体自带标签, 命中时重盖章 (2026-09-29)
    shooter.lastFiredT=nowT;
    if(typeof gunEvents!=='undefined') gunEvents.push({x:o.x,z:o.z,team:this.team,t:nowT,shooter});
    return true;
  }
  // ══════════════ 武器: 机炮/机枪 (.50 双联走 fireBullet; 对岸对艇双用) ══════════════
  fireSecondary(dir){
    const S=this.spec.secondary;
    if(!S) return false;
    vehMgTrigger(this); // A#3 扳机保持 (早于冷却早退: 冷却中每帧调用也算按住)
    if(!this.alive||this.state==='sinking'||this.state==='wreck') return false;
    if(this.secT>0) return false;
    if(!vehMgCanFire(this)) return false; // A#3 过热强制停火 (散到 unlock=0.35 才解锁)
    this.secT=S.rof;
    const n=Math.max(1,S.n||1);
    const shooter=this._shooter();
    shooter._src=this.name;
    const cs=Math.cos(this.yaw), sn=Math.sin(this.yaw);
    for(let i=0;i<n;i++){
      const o=navalMuzzleWorld(this,'secondary');
      const off=(i-(n-1)*0.5)*0.55;                 // 双联并排
      o.x+=cs*off; o.z-=sn*off;
      let d=dir?dir.clone():this.aimDir();
      d.x+=rand(-0.012,0.012); d.y+=rand(-0.010,0.010); d.z+=rand(-0.012,0.012);
      d.normalize();
      fireBullet(shooter,o,d,{dmg:S.dmg,headMul:1.9,snd:'mg',sid:'navalSec',tracer:2,vehDmg:S.mgDmg||6},o); // sid=舰载 .50 双联音档 (★2026-11-15c)
    }
    if(this.playerDriven&&typeof AudioSys!=='undefined') AudioSys.gunshot('navalSec',0,0);
    vehMgHeatAdd(this); // A#3 每发积热 (heatPS, 与坦克同轴机枪同档)
    shooter.lastFiredT=nowT;
    return true;
  }
  fireMG(dir){
    const M=this.spec.mg;
    if(!M) return false;
    vehMgTrigger(this); // A#3 扳机保持 (早于冷却早退)
    if(!this.alive||this.state==='sinking'||this.state==='wreck') return false;
    if(this.mgT>0) return false;
    if(!vehMgCanFire(this)) return false; // A#3 过热强制停火
    this.mgT=M.rof;
    const shooter=this._shooter();
    shooter._src=this.name;
    const o=navalMuzzleWorld(this,'mg');
    let d=dir?dir.clone():this.aimDir();
    d.x+=rand(-0.010,0.010); d.y+=rand(-0.008,0.008); d.z+=rand(-0.010,0.010);
    d.normalize();
    fireBullet(shooter,o,d,{dmg:M.dmg,headMul:1.9,snd:'mg',sid:'navalMG',tracer:2,vehDmg:MG_BULLET_DEF.vehDmg},o); // sid=舰载机枪音档 (★2026-11-15c)
    if(this.playerDriven&&typeof AudioSys!=='undefined') AudioSys.gunshot('navalMG',0,0);
    vehMgHeatAdd(this); // A#3 每发积热 (heatPS, 与坦克同轴机枪同档)
    shooter.lastFiredT=nowT;
    return true;
  }
  // ══════════════ 武器: 鱼雷 (独立在途表; 命中即灌满 flood) ══════════════
  // side 口径 (§11.9⑧ 冻结): **0=左舷 / 1=右舷 / undefined=自动选管** (兼容 naval-ai 早期约定的 -1=左舷)
  // aimDir: 可选截击方向 (AI 解算提前量后传入; 传入时不再叠加出管回转角)
  fireTorpedo(side,aimDir){
    const S=this.spec;
    if(!S.torpedo) return false;
    if(!this.alive||this.state==='sinking'||this.state==='wreck') return false;
    if(this.torpCd>0||this.torpLeft<=0) return false;
    let sgn;
    if(side===undefined||side===null){
      if(aimDir){ const lat=aimDir.x*Math.cos(this.yaw)-aimDir.z*Math.sin(this.yaw); sgn=(lat>=0)?1:-1; }
      else sgn=((this.torpLeft%2)===0)?1:-1;
    }else sgn=(side===0||side===-1||side==='port'||side==='L')?-1:1;
    this.torpCd=NAVAL_TORP_CD;
    this.torpLeft--;
    const gyro=NAVAL_TORP_GYRO*sgn;
    const la=this.yaw+gyro;
    let dir=aimDir?aimDir.clone():V3(Math.sin(la),0,Math.cos(la));
    dir.y=0;
    if(dir.lengthSq()<1e-6) dir.set(Math.sin(la),0,Math.cos(la));
    dir.normalize();
    const cs=Math.cos(this.yaw), sn=Math.sin(this.yaw);
    const wy=waterYAt(this.pos.x,this.pos.z);
    // 发射点: 优先 15e 的鱼雷管口锚点 (muzzles.torpedo 是**数组**: pt [0,1]=艏对 [2,3]=艉对 / gyorai [0,1]=舷侧对),
    //   按"发射方向能否被该对管覆盖"选管: 朝前用艏对, 朝后用艉对 —— 艉管不会从艉甲板中段冒出来 (naval-model 报的观感差);
    //   拿不到锚点时按 spec 解析兜底 (左/右舷分居两侧, 艏对偏前 / 艉对偏后)。
    const fwdComp=dir.x*sn+dir.z*cs;
    const tubes=(this.muzzles&&Array.isArray(this.muzzles.torpedo)&&this.muzzles.torpedo.length)?this.muzzles.torpedo:null;
    const pair=(tubes&&tubes.length>=4)?((fwdComp>=0)?0:1):0;
    let tp=null;
    if(tubes){
      let idx=(pair===0)?(sgn<0?0:1):(sgn<0?2:3);
      if(idx>=tubes.length) idx=(sgn<0?0:1);
      tp=navalAnchorWorld(this,tubes[Math.min(idx,tubes.length-1)]);
    }
    let ox,oz;
    if(tp){ ox=tp.x; oz=tp.z; }
    else{
      // spec 解析兜底 (2026-09-25 修): 侧向基向量 (cs,-sn) 就是载具**局部 +x** (grp.rotation.y=yaw 把局部 x 映到
      //   (cos,-sin)), 而局部 +x = 右舷 (15e 按 `for sx of [-1,1]` 推管口 ⇒ 索引 0 = x<0 = 左舷, 与 sgn=-1=左舷同源)。
      //   旧版两个分支都是正数 ⇒ 左舷管也落在右舷侧, 两个发射点只差 1.5m 且都在同一舷。艏对偏前 / 艉对偏后不变。
      const lat=S.hullW*(sgn<0?-0.26:0.30);
      const fwd=S.hullL*(pair===0?0.12:-0.26);
      ox=this.pos.x+cs*lat+sn*fwd; oz=this.pos.z-sn*lat+cs*fwd;
    }
    const o=V3(ox,(wy>-1e8?wy-0.35:this.pos.y),oz);
    const shooter=this._shooter();
    shooter._src=this.name;
    torpedoes.push({pos:o,vel:dir.multiplyScalar(S.torpSpd),team:this.team,owner:shooter,
      dmg:S.torpDmg,life:Math.max(8,S.torpRange/Math.max(1,S.torpSpd)),trail:0,craft:this,side:sgn});
    if(typeof AudioSys!=='undefined') AudioSys.metalSlide(0.5,0.25,180,60);
    if(wy>-1e8) waterSplash(V3(o.x,wy,o.z),0.9,false,false);
    if(this.playerDriven) showScorePop('鱼雷发射!');
    shooter.lastFiredT=nowT;
    return true;
  }
  // ══════════════ 受创 / 沉没 / 重生 ══════════════
  takeDmg(amt,attacker,ap){
    if(!this.alive||this.state==='sinking'||this.state==='wreck') return;
    if(!amt||!(amt>0)) return;
    // 观战者座驾免伤 (2026-09-26H 观战批): 判据单源 specRide (13-combat) —— 与坦克/战机同一条口径。
    // 于是"观战者开艇进战场"不会因被击沉而失去座驾, 更不会被沉没链拖着一起下水 (用户实报)。
    if(typeof specRide==='function'&&specRide(this)) return;
    // 装甲减免与陆战同源 (TANK_ARMOR): 机枪/火烧挠痒, 只有反装甲(ap)全额 —— 不另造第二个系数
    if(!ap&&typeof TANK_ARMOR!=='undefined') amt*=TANK_ARMOR;
    this.hp-=amt;
    this.lastDmgT=nowT;
    this.flood+=(amt*(this.spec.floodK||0));         // §3.4: flood += dmg*floodK
    if(this.playerDriven&&typeof addDmgFlash==='function'){ addDmgFlash(0.35); addTrauma(0.3); if(typeof addVehDmgDir==='function') addVehDmgDir(this,attacker); } // 方向指示: D8 (2026-09-28)
    else if(attacker&&attacker.pos) this.threatYaw=Math.atan2(attacker.pos.x-this.pos.x,attacker.pos.z-this.pos.z);
    // 载具残血起火 (2026-11-09 批): hp<10% 点火 (燃烧掉血账在 update 里走; follow 火源对舰艇通用, 04b-fire)
    if(typeof vehBurnIgnite==='function'&&!this.burning&&this.hp>0&&this.hp<this.maxHp*VEH_BURN_FRAC) vehBurnIgnite(this,attacker);
    if(this.flood>1) this.beginDestroy(attacker,'sink');
    else if(this.hp<=0) this.die(attacker);
  }
  die(attacker){
    if(this.state==='sinking'||this.state==='wreck') return;
    // 艇: 打爆即沉 (§3.4); 两栖车: 与坦克一致走燃烧残骸分支, 但原地不留浮 —— 'burn'
    if(this.kind==='boat'||this.flood>1) this.beginDestroy(attacker,'sink');
    else this.beginDestroy(attacker,'burn');
  }
  // 沉没/残骸链的唯一入口 (idempotent): mode='sink' 倾斜→下沉→残骸沉底; mode='burn' 燃烧残骸原地留
  beginDestroy(attacker,mode){
    if(this.state==='sinking'||this.state==='wreck') return;
    const S=this.spec;
    this.alive=false;
    this.state='sinking';
    this.attacker=attacker||null;
    const wy=waterYAt(this.pos.x,this.pos.z);
    const bed=heightAt(this.pos.x,this.pos.z,true);
    const sea=(wy>-1e8);
    const cx=this.pos.x, cz=this.pos.z, cy=this.pos.y+S.hullY;
    // 目标高度: 沉没 = 残骸沉底 (海床 + 半个船体高); 燃烧残骸 (两栖车) = **原地不动** (与坦克同口径:
    //   不上浮也不入土, 燃烧期内是硬掩体, 重生时才收走 —— §3.4 "原地留残骸")
    let y1=(mode==='sink')?((sea?Math.max(bed,wy-16)+S.hullY*0.45:this.pos.y-1.2)):this.pos.y;
    if(mode==='sink'&&y1>this.pos.y-0.15) y1=this.pos.y-1.2;
    const restT=rand(24,30);
    this.sink={mode:(mode==='sink'?'sink':'burn'), t:0,
      tilt:(mode==='sink'?NAVAL_CFG.sinkTilt:0),
      dive:(mode==='sink'?S.sinkT:restT),
      y0:this.pos.y, y1, sea, crewOut:false, rollDir:(Math.random()<0.5?-1:1), fxT:0, restT};
    this.vel=0;
    // 重生冷却 (§6.3: 水面载具 rand(55,70) —— 比坦克长, 防止无限刷船把海战打成消耗战)
    const rt=S.respawnT||[55,70];
    this.respawnT=rand(rt[0],rt[1]);
    // 摧毁特效: 爆炸 + 黑烟 (+ 水面溅落)
    explosionFX(V3(cx,cy,cz));
    if(typeof AudioSys!=='undefined') AudioSys.explosion('naval',this.pos.distanceTo(camera.position),AudioSys.panOf(this.pos)); // 艇毁档 (★2026-11-15c)
    for(let i=0;i<6;i++) spawnP(PT.dark,cx+rand(-1.6,1.6),cy+rand(0.4,1.8),cz+rand(-1.6,1.6),
      rand(-1,1),rand(1.2,3),rand(-1,1),rand(1.0,2.0),1.6,rand(1.4,2.6),0.8,0.6);
    if(sea) waterSplash(V3(cx,wy+0.1,cz),1.8,true,true);
    if(this.fireSrc) removeFireSource(this.fireSrc);
    if(this.burnSrc) removeFireSource(this.burnSrc); // 起火火源随退场一并掐 (follow 块对 alive=false 也会自动掐, 双保险)
    // 先拆夜战大灯 (N2): 黑化 traverse 会把 additive 光锥换成不透明材质, 辉光 Sprite 也会残留在沉船上
    if(typeof vehHeadlightKill==='function') vehHeadlightKill(this);
    // 残骸材质 (与坦克残骸同一材质单源)
    const wm=navalWreckMaterial();
    this.grp.traverse(o=>{ if(o.isMesh){ if(!o.userData.mat0) o.userData.mat0=o.material; o.material=wm; } });
    // 计分/播报 (与 Tank.die 同口径: 分档取 SCORE_TABLE.tank, 票代价取 spec.ticket)
    if(attacker&&(coFfFire(attacker)||attacker.team!==this.team)){ // coFfFire: 观战本尊照常记分 (★2026-11-13 批, 与 Tank/Plane.die 三处同批补齐)
      attacker.kills=(attacker.kills||0)+1;
      if(attacker.isPlayer) attacker.score=(attacker.score||0)+registerKillScore('摧毁舰艇',SCORE_TABLE.tank);
      else attacker.score=(attacker.score||0)+SCORE_TABLE.tank;
      addKillfeed(attacker,{name:this.name,team:this.team,isPlayer:false},false);
      if(attacker.isPlayer&&typeof onPlayerWreck==='function') onPlayerWreck(); // 击沉红档 (2026-09-30 批): 舰艇无乘员死亡链, 空艇击沉旧口径无屏中反馈
      if(attacker.isPlayer) attacker.vehKills=(attacker.vehKills||0)+1; // 终身击毁载具账 (2026-11-11 数据批): 结算随 sf_stats 累计 (坦克/卡车/战机/舰艇四处同款钩)
    }
    if(typeof tickets!=='undefined'&&tickets) tickets[this.team]=Math.max(0,tickets[this.team]-(S.ticket||4));
    // 燃烧残骸 (两栖车): 持续火源 + 点燃周围植被 (与 Tank 同口径)
    if(mode==='burn'){
      this.fireSrc=addFireSource(cx,cz,this.pos.y+S.hullY,3.3,this.sink.restT,22,attacker||null);
      igniteArea(cx,cz,3.2,attacker||null);
      if(typeof explosionFlora==='function') explosionFlora(this.pos,5.5);
    }
  }
  // 乘员落水 → 转游泳态 (直接接现有 SWIM_DEPTH/DIVE_* 系统; 玩家与车组 Bot 都在水面下浮起)
  crewOut(){
    const wy=waterYAt(this.pos.x,this.pos.z);
    // 落水点: 统一取 00-config 的 FLOAT_PAD (脚底到水面 1.32m) —— 必须让 wl>0.02, 否则 03-terrain 的
    // 水态机判 'dry' (旧写法落在水面上方: 水态=dry, Bot 若不移动就会"悬在水面上方", 玩家要靠重力掉回水里才转游泳)。
    // ★2026-09-26E (审计 32): 旧版这里是 `wy-max(0.35, 1.75-NAVAL_CFG.crewDrownPad)` = 水面下 0.55m,
    // 而玩家浮在 1.32m、Bot 浮在 0.95m ⇒ 同一次"落水"三种浮姿 (差 0.77m, 观感与命中胶囊高度都跟着变)。
    // 现在三处共用 FLOAT_PAD 单源 (NAVAL_CFG.crewDrownPad 随之退役, 保留字段但不再有读点)。
    const sy=(wy>-1e8)?wy-FLOAT_PAD:this.pos.y+0.6;
    const px=this.pos.x, pz=this.pos.z;
    if(this.playerDriven){
      this.playerDriven=false;
      if(typeof player!=='undefined'&&player){
        if(player.onVehicle===this) player.onVehicle=null;
        if(player.onNaval===this) player.onNaval=null;
        player.pos.set(px,sy,pz); player.vel.set(0,0,0);
        player.onGround=false; player.diveD=0; player.oxy=1; player._drownAcc=0;
        player.crouch=false; player.prone=false; player.tankView=false;
        player.navalGun=false;                 // 弃船即退出炮手镜 (与 tankView 同段: 座位相关的视角态一并复位)
        if(typeof showScorePop==='function') showScorePop('弃船! 快游开');
      }
    }
    if(this.crewBot){
      const cb=this.crewBot;
      this.crewBot=null;
      if(cb.onVehicle===this) cb.onVehicle=null;
      cb.pos.set(px,sy,pz);
      if(cb.mesh&&cb.mesh.root) cb.mesh.root.visible=true;
      cb.crewStillT=0;
      cb.suppression=Math.max(cb.suppression||0,0.5);
      // Bot.update 按 waterDepthAt>SWIM_DEPTH 自动进游泳态并朝最近岸游 (14-bots 既有规则, 零改动)
    }
    // ★ 乘员是**落水生还**的: 这里**不**置 crew.alive=false (那是 Tank 的"乘员随车阵亡"语义, 舰艇不适用)。
    //   "舰上已无车组"由上面两行表达: playerDriven=false / crewBot=null (只读判据 `manned`)。
    //   取证: 在 verifier 同款 harness 下走完 900 帧, 车组 Bot 的 damage() 一次都没被调用, alive=true、水态=swim。
    this.crew.alive=true;
    this.engineOn=false;                       // 弃船即停引擎: 沉没期起不再重建音频节点
    if(this.engine){ try{ this.engine.stop(); }catch(e){} }
  }
  // 残骸定格: 登记水下掩体碰撞 (半沉撤碰撞的既有口径见 Tank.die)
  _finishWreck(){
    const S=this.spec;
    this.state='wreck';
    this.sink=null;
    this.engineOn=false;
    if(this.engine){ try{ this.engine.stop(); }catch(e){} }
    if(!this.wreckBs){
      const sn=Math.sin(this.yaw), cs=Math.cos(this.yaw);
      const seg=(this.kind==='boat')?Math.max(2.5,S.hullL*0.30):2.4;
      const w=(this.kind==='boat')?S.hullW*1.05:3.0;
      const hh=Math.max(1.2,S.hullH*0.9);
      this.wreckBs=[];
      for(const off of [-seg,0,seg]){
        this.wreckBs.push(registerDynCollider(this.pos.x+sn*off,this.pos.y+S.hullY*0.55,this.pos.z+cs*off,w,hh,seg*1.25));
      }
    }
  }
  // 死亡期推进: 沉没链 / 残骸 / 重生倒计时
  _deadTick(dt){
    if(this.state==='wreck'||this.state==='run'||this.state==='ground'){ this._respawnTick(dt); return; }
    if(this.state==='sinking') this._updateSinking(dt);
  }
  _respawnTick(dt){
    this.respawnT-=dt*tankRespawnMul(this.team);
    // ★ 残骸态不驱动引擎音频 (Lead 收尾项): engine.update 会把已 stop 的节点静音重建 —— 残骸期每台泄漏 4 节点
    if(this.engine&&this.engineOn&&this.state!=='wreck') this.engine.update(0,0);
    if(this.respawnT<=0&&!matchOver&&tickets[this.team]>0){
      this.respawn();
      // ★2026-09-26E (审计 1): 对局重生后补配车组 —— respawn() 刚把 crewBot/driverBot 清空, 若没人认领,
      // 这台艇会以"无人漂航的靶船"回到战场 (被击沉照扣票)。补配单源 = 23-deploy 的 navalCrewFill。
      // **挂在 _respawnTick 而不是 respawn()**: respawn 是低层复位原语 (构造器也调它), 探针的受控载具
      // 走构造器 ⇒ 挂在那里会给探针的载具塞一名 AI 驾驶, 与"受控输入"的实验纪律冲突 (实测红线 3/4 假红)。
      if(typeof navalCrewFill==='function') navalCrewFill();
    }
  }
  _updateSinking(dt){
    const sk=this.sink;
    if(!sk){ this._finishWreck(); return; }
    sk.t+=dt;
    if(sk.t<sk.tilt){
      // ① 倾斜段: 速度衰减 + 横倾渐增 (0.8s)
      this.vel=dampF(this.vel,0,3,dt);
      this.roll=dampF(this.roll,sk.rollDir*0.52,2.2,dt);
      this.pitch=dampF(this.pitch,sk.rollDir*0.06,2.0,dt);
      sk.fxT-=dt;
      if(sk.fxT<=0){ sk.fxT=0.16;
        spawnP(PT.smoke,this.pos.x+rand(-2,2),this.pos.y+this.spec.hullY+rand(0,1),this.pos.z+rand(-2,2),
          rand(-0.4,0.4),rand(1.2,2.6),rand(-0.4,0.4),rand(1.0,1.8),1.2,rand(1.2,2.2),0.6,0.3);
      }
    }else{
      // ② 下沉段: 乘员落水 (一次) + 船体下压 + 水花/气泡/油迹
      if(!sk.crewOut){
        sk.crewOut=true;
        this.crewOut();
        const wy=waterYAt(this.pos.x,this.pos.z);
        if(sk.sea) waterSplash(V3(this.pos.x,wy+0.15,this.pos.z),1.5,true,true);
        for(let i=0;i<4;i++)
          spawnP(PT.dark,this.pos.x+rand(-1.2,1.2),waterYAt(this.pos.x,this.pos.z)+0.08,this.pos.z+rand(-1.2,1.2),
            0,0,0,rand(1.0,1.8),1.1,6,0.55,0);        // 油迹 (贴水面缓扩)
      }
      const k=clamp((sk.t-sk.tilt)/Math.max(0.2,sk.dive),0,1);
      this.pos.y=lerp(sk.y0,sk.y1,k);
      // 沉没 = 倾覆角渐增 (0.52→0.78rad); 燃烧残骸 = 只微微倾斜 (0.16rad, 与坦克残骸的"翻倒在侧"观感同档)
      const rollTgt=(sk.mode==='sink')?sk.rollDir*(0.52+0.26*k):sk.rollDir*0.16;
      this.roll=dampF(this.roll,rollTgt,1.6,dt);
      sk.fxT-=dt;
      if(sk.fxT<=0){
        sk.fxT=0.14;
        const wy=waterYAt(this.pos.x,this.pos.z);
        if(sk.sea&&wy>-1e8){
          spawnP(PT.drop,this.pos.x+rand(-2.4,2.4),wy+0.15,this.pos.z+rand(-2.4,2.4),
            rand(-0.6,0.6),rand(0.8,2.2),rand(-0.6,0.6),rand(0.3,0.7),0.4,rand(0.5,0.9),0.8,6);
          spawnP(PT.drop,this.pos.x+rand(-1.6,1.6),wy-0.4,this.pos.z+rand(-1.6,1.6),
            rand(-0.3,0.3),rand(0.5,1.1),rand(-0.3,0.3),rand(0.10,0.22),0.15,rand(0.6,1.1),0.6,-1.4);
          spawnP(PT.smoke,this.pos.x+rand(-2,2),wy+0.12,this.pos.z+rand(-2,2),
            rand(-0.3,0.3),rand(0.5,1.4),rand(-0.3,0.3),rand(1.2,2.2),1.4,rand(1.6,2.8),0.45,0.2);
        }
      }
      if(k>=1) this._finishWreck();
    }
    this._syncModel(dt,dt);
  }
  respawn(initial,silent){
    // 提前结清上一轮残骸 (碰撞体撤除 + 火源熄灭 + 视觉复位)
    if(this.fireSrc){ removeFireSource(this.fireSrc); this.fireSrc=null; }
    // 起火态随重生复位 (2026-11-09 批): 燃烧账/点燃者/弃船标记不得跨生死携带
    if(this.burnSrc){ removeFireSource(this.burnSrc); this.burnSrc=null; }
    this.burning=false; this.burnBy=null; this._burnCrewOut=false;
    if(this.wreckBs){ for(const b of this.wreckBs) killDynCollider(b); this.wreckBs=null; }
    if(this.sinkJob){ finishSinkJob(this.sinkJob); this.sinkJob=null; }
    this.sink=null;
    const spawn=navalSpawnPoint(this);
    this.pos.set(spawn.x,0,spawn.z);
    this.yaw=spawn.face;
    this._prevYaw=this.yaw;
    this.floating=(this.kind==='boat')||(waterDepthAt(spawn.x,spawn.z)>=this.spec.wadeDepth);
    const wy=waterYAt(spawn.x,spawn.z);
    this.draft=navalDraftOf(this);
    this.pos.y=(wy>-1e8)?wy-this.draft:heightAt(spawn.x,spawn.z);
    this.baseY=this.pos.y;
    this.hp=this.maxHp; this.alive=true; this.state='run'; this.flood=0;
    this.vel=0; this.roll=0; this.rollV=0; this.pitch=0; this.pitchV=0;
    this.suspP=0; this.suspR=0; this.suspPV=0; this.suspRV=0; this.lastVel=0;
    this.turretYaw=0; this.turretPitch=0;
    this.cannonCd=0; this.secT=0; this.mgT=0; this.torpCd=0;
    // A#3 重生 = 新车新枪管: 热量/过热锁/扳机请求清零 (与 Tank.respawn 同口径)
    this.heat=0; this.heatLock=false; this.mgTrig=false;
    this.torpLeft=this.spec.torpedo||0;
    this.playerDriven=false;
    this.crew.alive=true;
    this.crewBot=null; this.driverBot=null; this.threatYaw=null;
    this.inFwd=0; this.inTurn=0;
    if(this.wheels) for(const wh of this.wheels){ if(wh.userData){ wh.userData.vy=0; wh.position.y=wh.userData.baseY!==undefined?wh.userData.baseY:wh.position.y; } }
    this.grp.visible=true;
    this.grp.rotation.set(0,this.yaw,0);
    this.grp.position.copy(this.pos);
    this.grp.traverse(o=>{ if(o.isMesh&&o.userData.mat0){ o.material=o.userData.mat0; delete o.userData.mat0; } }); // ★2026-11-01: 还原即清账 —— userData 不长期攥 Material→map→canvas 引用 (禁对象引用红线)
    this.engineOn=true;                        // 重生: 引擎音频重新接管
    if(this.engine){ try{ this.engine.update(0,0); }catch(e){} }
    const sil=(silent===undefined)?!!initial:!!silent;
    if(!sil&&this.team===player.team) announceVehRespawn(this);
  }
  // ══════════════ 每帧主更新 ══════════════
  update(dt){
    if(!(dt>0)) return;
    this.aimDt=Math.min(dt,0.05);        // 炮塔/俯仰限速用的真实帧长 (与 24-main 的 dt=min(delta,0.05) 同档)
    if(this.state==='sinking'){ this._updateSinking(dt); return; }
    if(!this.alive){ this._deadTick(dt); return; }
    const S=this.spec;
    // 载具残血起火 (2026-11-09 批): 燃烧掉血账 —— 每秒烧 maxHp×VEH_BURN_FRAC/VEH_BURN_TIME, 自起火起
    // VEH_BURN_TIME 秒内必烧毁 (直扣 hp 不走 takeDmg: 不刷 lastDmgT/不叠 flood); 击杀归因=点燃者。
    // Bot 对齐: 起火即弃船 (Bot 车组 crewOut 落水逃离); 玩家不弹 —— 警告条提示, 沉没时既有弃船链接管。
    if(this.burning){
    if(!this._burnCrewOut&&this.crewBot&&!this.playerDriven){ this._burnCrewOut=true; this.crewOut(); }
    this.hp-=this.maxHp*VEH_BURN_FRAC/VEH_BURN_TIME*dt;
    if(this.hp<=0){ this.die(this.burnBy||null); return; }
    }
    this.cannonCd-=dt; this.secT-=dt; this.mgT-=dt; this.torpCd-=dt;
    // A#3 载具机枪过热 (契约 A): 每帧推进散热/解锁 (玩家 0.22/s 且开火不散 / AI 0.15/s 常散);
    // 放在 AI 决策与玩家输入之后 ⇒ 本帧的开火请求 (fireMG/fireSecondary) 已被 mgTrig 记到。
    vehMgHeatTick(this,dt,this.mgTrig,this.playerDriven);
    this.mgTrig=false;
    // ① AI 决策 (先决策后积分: 本帧 boatAI/amphAI 的 drive/fire 与本帧位移一致)
    const ai=this.driverBot||this.crewBot;
    if(!this.playerDriven&&this.aiDrive!==false&&ai&&ai.alive!==false){
      if(this.kind==='boat'){ if(typeof boatAI==='function') boatAI(this,dt); }
      else if(typeof amphAI==='function') amphAI(this,dt);
    }
    // ② 无输入本帧 → 滑行衰减 (玩家/Bot 都走 drive; 没人开就停)
    if(this.lastDriveT!==nowT) this.vel=dampF(this.vel,0,(this.kind==='boat')?1.2:4,dt);
    // ③ 水态 (单源 03-terrain): 水深/水面 + 两栖车水陆双态判定
    const wy=waterYAt(this.pos.x,this.pos.z);
    const d=waterDepthAt(this.pos.x,this.pos.z);
    this.waterY=wy;
    this.depth=(d<-1e8?-1e9:d);
    this.draft=navalDraftOf(this);
    const wasFloat=this.floating;
    this.floating=(this.kind==='boat')||(d>-1e8&&d>=S.wadeDepth);
    if(wasFloat!==this.floating){
      // 态切换: 姿态交接 (把当前姿态交给新态的弹簧, 不跳变)
      if(this.floating){ this.roll=this.suspR; this.pitch=this.suspP; }
      else { this.suspR=this.roll; this.suspP=this.pitch; }
      if(this.kind==='amph'&&this.playerDriven&&nowT-(this._modePopT||-99)>4){
        this._modePopT=nowT;
        showScorePop(this.floating?'浮航态 · 稳住舵':'履带态 · 全速冲滩');
      }
    }
    // ④ 位移积分 + 搁浅/浅水/推挤
    this._integrate(dt,wy,d);
    // ⑤ 浮态 (横倾/纵倾/浪涌) 或 履带悬挂
    this._attitude(dt,wy);
    // ⑥ 姿态同步 + 视觉 (损伤冒烟/尾迹/螺旋桨)
    this._syncModel(dt,dt);
    this._damageSmoke(dt);
    this._wake(dt);
  }
  // ── 位移积分 ──
  _integrate(dt,wy,d){
    const S=this.spec, draft=this.draft;
    const onWater=this.floating;
    const hasWater=(d>-1e8);
    // 两栖车: 不参与"艇"的搁浅/擦礁语义 (详见 drive() 内的口径注释) —— 履带恒可前进, 进水也不卡死。
    const isAmph=(this.kind==='amph');
    const grounded=!isAmph&&onWater&&hasWater&&d<draft;                    // §3.3 硬搁浅 (仅艇)
    const shallowWater=!isAmph&&onWater&&hasWater&&!grounded&&d<draft+NAVAL_CFG.shallowPad;  // 龙骨擦礁 (仅艇)
    // "顶在浅水线"锁存: 浮航态艇艏抵住 d<draft 的浅水格而停下时, 状态与视觉上就是"搁浅"
    // (若不加锁存, state 会在 'run' 与 'ground' 之间逐帧翻转 —— HUD 提示与外部判据都会抖)
    this._shoreT=Math.max(0,(this._shoreT||0)-dt);
    this.state=(grounded||this._shoreT>0)?'ground':'run';
    if(shallowWater) this.takeDmg(NAVAL_CFG.shallowScrub*dt,null,true);     // 龙骨擦礁
    if(grounded&&this.vel>0) this.vel=dampF(this.vel,0,10,dt);              // 前进分量被礁盘吃掉
    const sn=Math.sin(this.yaw), cs=Math.cos(this.yaw);
    let mvx=sn*this.vel*dt, mvz=cs*this.vel*dt;
    if(grounded&&this.vel>0){ mvx=0; mvz=0; this._grind(dt); }
    // 履带态: 坡度闸门 (单源 04-collision slopeGateMove —— 与步兵/坦克同一支)
    if(!onWater&&(mvx||mvz)){
      const mv=slopeGateMove(this.pos,mvx,mvz);
      mvx=mv[0]; mvz=mv[1];
    }
    // 浮航态: 不许**继续往更浅处**开 (那就是"爬滩"), 但倒车/侧滑回深水一律放行 ——
    // ★ 这正是"搁浅可倒车脱困"成立的前提: 若这里不分方向地挡 `dN<draft`, 倒车第一步也过不去, 会永久卡死
    //   (自检实测: 旧写法下 PT 在 d=16m 倒车 5s 只挪 1.54m 且 state 恒为 'ground')。
    // ★2026-09-21B: **两栖车不走这条闸门** —— 它就该从这里爬上滩。旧版对两栖车同样挡 `dN<draft`,
    //   而它的浮航阈值是 wadeDepth(0.55)>draft(0.40) ⇒ 冲到 0.55m 水深处会被判"顶住浅水线"锁死 0.5s、
    //   速度拍回 0 (实机表现即"在水浅的地方搁浅")。两栖车的换态由 update() 的 floating 现算完成,
    //   不需要这道闸门: 水深掉到 wadeDepth 以下那一帧它就成了履带态, 继续冲滩。
    if(onWater&&!isAmph&&(mvx||mvz)){
      const dN=waterDepthAt(this.pos.x+mvx,this.pos.z+mvz);
      if(dN<=-1e8){ mvx=0; mvz=0; this.vel=Math.min(0,this.vel)*0.4; }
      else if(dN<draft&&dN<d-1e-6&&this.vel>0){
        mvx=0; mvz=0; this.vel=dampF(this.vel,0,10,dt);
        this.state='ground'; this._shoreT=0.5;                               // 顶住浅水线 = 搁浅 (锁存 0.5s)
      }
    }
    const px0=this.pos.x, pz0=this.pos.z;
    this.pos.x+=mvx; this.pos.z+=mvz;
    // ★2026-09-26E (审计 28): 夹取边界取世界边缘单源 (网格边界 − 24m), 不再自写 MAP_SIZE/2+6
    const lim=(typeof WORLD_ACTOR_LIMIT==='number')?WORLD_ACTOR_LIMIT:(MAP_SIZE/2+6);
    this.pos.x=clamp(this.pos.x,-lim,lim);
    this.pos.z=clamp(this.pos.z,-lim,lim);
    // 静态体推挤 + 步兵碾压 (履带态走 Tank 同款三圆两遍解算; 浮航态硬阻挡防穿栈桥/木桩)
    this._pushBodies(dt,onWater,px0,pz0);
    // ★2026-09-26E (审计 4): 艇↔艇 / 艇↔坦克 分离 —— 全库此前**没有任何 craft↔craft 分离代码**:
    //   两艇"艏对艏"会直接穿模叠在一起 (相对 29m/s ⇒ 0.48m/帧, 没有任何东西能挡), 玩家全速撞敌艇也毫无作用。
    //   几何单源: 复用 navalHitCyl (艇 = 按 yaw 的长扁形三圆; 两栖车 = vehHitCyl), 与命中判定同一套尺寸。
    navalPushCraft(this,dt);
  }
  // 搁浅刮擦 (视觉 + 轻微龙骨伤; 每 0.6s 一次, 不刷屏)
  _grind(dt){
    this._grindT=(this._grindT||0)+dt;
    if(this._grindT<0.6) return;
    this._grindT=0;
    const wy=waterYAt(this.pos.x,this.pos.z);
    if(wy>-1e8) waterSplash(V3(this.pos.x,this.pos.y+0.2,this.pos.z),0.7,false,true);
    for(let i=0;i<3;i++)
      spawnP(PT.dirt,this.pos.x+rand(-1.5,1.5),heightAt(this.pos.x,this.pos.z)+0.15,this.pos.z+rand(-1.5,1.5),
        rand(-0.6,0.6),rand(0.4,1.2),rand(-0.6,0.6),rand(0.3,0.6),0.5,rand(0.5,0.9),0.7,6);
    this.takeDmg(1.2,null,true);
    if(this.playerDriven&&nowT-(this._groundPopT||-99)>3){
      this._groundPopT=nowT;
      showScorePop('⚠ 搁浅! 倒车脱困');
    }
  }
  // 艇体在某点是否被静态障碍挡住 (浮航态用)
  //   mode='hard' (缺省): 只认"大件硬结构" —— 箱体 (建筑/围墙/长栈桥) 与 r≥1.0 的粗柱 (灯塔基座/碉堡);
  //   mode='soft': 连细木桩 (r<1.0, 反登陆木桩/系缆桩/树干) 也算 —— 浮航态只拿它做"擦碰减速"。
  // 为什么细桩不做硬阻挡: 礁盘上密布反登陆木桩, 硬阻挡会让 PT 在 d≈23m 就被拦停, 永远到不了 §1.1 的
  //   "d<17m 硬搁浅"线 (那会让设计表里的分工变成死代码); 而成品设计里木桩是"航路障碍"(减速), 不是墙。
  _navalBlockedAt(x,z,rad,off,mode){
    const hardOnly=(mode!=='soft');
    const sn=Math.sin(this.yaw), cs=Math.cos(this.yaw);
    let hit=false;
    for(const o of [-off,0,off]){
      if(hit) break;
      const cxp=x+sn*o, czp=z+cs*o;
      eachBoxNear(cxp-rad-0.7,czp-rad-0.7,cxp+rad+0.7,czp+rad+0.7,b=>{
        if(hit||b.dead) return;
        if(this.pos.y+1.6<b.minY||this.pos.y+0.05>b.maxY) return;
        if(!hardOnly&&!b.dGroup&&!b.crush&&b.maxY-b.gh<=TANK_STEP) return;   // 低矮可越件放行
        const cx2=clamp(cxp,b.minX,b.maxX), cz2=clamp(czp,b.minZ,b.maxZ);
        const dx=cxp-cx2, dz=czp-cz2;
        if(dx*dx+dz*dz<rad*rad) hit=true;
      });
      eachCylNear(cxp-rad-1.8,czp-rad-1.8,cxp+rad+1.8,czp+rad+1.8,c=>{
        if(hit||c.r<0.3) return;
        if(hardOnly&&(c.r<1.0||c.y1-c.y0<=0.7)) return;
        const dx=cxp-c.x, dz=czp-c.z, rr=c.r+rad;
        if(dx*dx+dz*dz<rr*rr) hit=true;
      });
    }
    return hit;
  }
  // 静态体推挤: 履带态与 15c 幽灵坦克同法 (两遍三圆); 浮航态 = 硬结构阻挡 + 细桩擦碰减速 ——
  // 为什么不是轻推: 礁盘上密集的反登陆木桩会把轻推累积成"一路被顶到沙滩", 实测把 d=17.5m 的 PT
  //   顶过 17.15m 硬搁浅线 (速度归零的红线断言因此失败)。已嵌在硬结构里的极端情况才轻推脱困。
  _pushBodies(dt,onWater,px0,pz0){
    const S=this.spec;
    if(Math.abs(this.vel)<1e-4&&!onWater) return;
    const sn=Math.sin(this.yaw), cs=Math.cos(this.yaw);
    const rad=(this.kind==='boat')?Math.max(2.2,S.hullW*0.5+0.4):2.05;
    const off=(this.kind==='boat')?Math.max(2.5,S.hullL*0.34):1.95;
    if(onWater){
      // ★ 搁浅态一律不参与静态体碰撞: 已坐在礁盘上的艇不吃木桩阻挡 —— 这是"倒车可脱困"红线成立的前提
      //   (自检实测: 加木桩硬阻挡时 PT 在 d=16m 被楔住, 倒车 5s 只挪 1.1m 且 state 恒为 'ground')。
      if(this.state==='ground') return;
      if(this._navalBlockedAt(this.pos.x,this.pos.z,rad,off,'soft')) this.vel*=0.985;   // 擦过细木桩: 轻拖
      const wasFree=!this._navalBlockedAt(px0,pz0,rad,off);
      const nowHit=this._navalBlockedAt(this.pos.x,this.pos.z,rad,off);
      if(nowHit&&wasFree && (this.pos.x!==px0||this.pos.z!==pz0)){
        this.pos.x=px0; this.pos.z=pz0; this.vel=dampF(this.vel,0,9,dt);
      }else if(nowHit){
        // 卡在硬结构里: 沿最小穿透方向轻推脱困 (每帧 ≤0.24m)
        for(const o of [-off,0,off]){
          const cxp=this.pos.x+sn*o, czp=this.pos.z+cs*o;
          eachBoxNear(cxp-rad-0.7,czp-rad-0.7,cxp+rad+0.7,czp+rad+0.7,b=>{
            if(b.dead) return;
            if(this.pos.y+1.6<b.minY||this.pos.y+0.05>b.maxY) return;
            const cx2=clamp(cxp,b.minX,b.maxX), cz2=clamp(czp,b.minZ,b.maxZ);
            const dx=cxp-cx2, dz=czp-cz2;
            const d2=dx*dx+dz*dz;
            if(d2<rad*rad&&d2>1e-8){
              const dd=Math.sqrt(d2), push=Math.min(0.24,(rad-dd)/dd*0.5);
              this.pos.x+=dx*push; this.pos.z+=dz*push;
            }
          });
          eachCylNear(cxp-rad-1.8,czp-rad-1.8,cxp+rad+1.8,czp+rad+1.8,c=>{
            if(c.r<1.0||c.y1-c.y0<=0.7) return;
            const dx=cxp-c.x, dz=czp-c.z, rr=c.r+rad;
            const d2=dx*dx+dz*dz;
            if(d2<rr*rr&&d2>1e-8){
              const dd=Math.sqrt(d2), push=Math.min(0.24,(rr-dd)/dd*0.5);
              this.pos.x+=dx*push; this.pos.z+=dz*push;
            }
          });
        }
        this.vel*=0.9;
      }
      return;
    }
    let hitObstacle=false;
    for(let pass=0;pass<2;pass++){
      for(const o of [-off,0,off]){
        const cxp=this.pos.x+sn*o, czp=this.pos.z+cs*o;
        eachBoxNear(cxp-rad-0.7,czp-rad-0.7,cxp+rad+0.7,czp+rad+0.7,b=>{
          if(b.dead||this.pos.y+2<b.minY||this.pos.y>b.maxY) return;
          if(b.maxY-b.gh<0.7) return;                                  // 低矮可越野件放行 (15-vehicles TANK_STEP 口径)
          if(!b.dGroup&&!b.crush&&b.maxY-b.gh<=TANK_STEP) return;
          const cx2=clamp(cxp,b.minX,b.maxX), cz2=clamp(czp,b.minZ,b.maxZ);
          const dx=cxp-cx2, dz=czp-cz2, d2=dx*dx+dz*dz;
          if(d2>=rad*rad) return;
          if(d2>1e-8){
            const dd=Math.sqrt(d2);
            const push=Math.min(0.4,(rad-dd)/dd);
            this.pos.x+=dx*push; this.pos.z+=dz*push;
          }else{
            const l=Math.min(cxp-b.minX,b.maxX-cxp), r=Math.min(czp-b.minZ,b.maxZ-czp);
            if(l<r) this.pos.x+=(cxp-b.minX<b.maxX-cxp?-1:1)*(l+rad);
            else this.pos.z+=(czp-b.minZ<b.maxZ-czp?-1:1)*(r+rad);
          }
          hitObstacle=true;
        });
        eachCylNear(cxp-rad-1.6,czp-rad-1.6,cxp+rad+1.6,czp+rad+1.6,c=>{
          if(c.r<0.3) return;
          if(c.y1-c.y0<=TANK_STEP) return;                              // 低矮圆柱直接驶过
          const dx=cxp-c.x, dz=czp-c.z, rr=c.r+rad;
          const d2=dx*dx+dz*dz;
          if(d2<rr*rr&&d2>1e-8){
            const dd=Math.sqrt(d2), push=Math.min(0.32,(rr-dd)/dd*0.6);
            this.pos.x+=dx*push; this.pos.z+=dz*push;
            hitObstacle=true;
          }
        });
      }
      if(!hitObstacle) break;
    }
    if(hitObstacle) this.vel*=0.9;
    // 装甲车辆碾压步兵 (履带态, 与 Tank 同一函数单源)
    if(Math.abs(this.vel)>0.8){
      const _o=_vpsOpts; _o.dt=dt; _o.crusher=this.playerDriven?player:(this.crewBot||this.crew);
      _o.moving=Math.abs(this.vel)>1.2; _o.yMax=1.9; _o.frontalBand=1.5; _o.symmetricFrontal=false;
      _o.crushDmg=320; _o.pushVel=Math.abs(this.vel); _o.checkSpectator=false;
      vehiclePushSoldiers(this,Math.max(2.05,this.halfW),S.hullL/2+0.45,_o);
    }
  }
  // ── 浮态: 浪涌 + 转向横倾 + 加速纵倾 (浮航) / 悬挂弹簧 (履带态) ──
  _attitude(dt,wy){
    const S=this.spec;
    const yawRate=(this.yaw-this._prevYaw)/dt;
    this._prevYaw=this.yaw;
    const accel=(this.vel-this.lastVel)/dt;
    this.lastVel=this.vel;
    if(this.floating){
      // 浪涌: 与 05b BUOYS 同源相位口径 (同频 1.3 / 同振幅档) ⇒ 艇与浮标同波
      const wave=navalWaveAt(this.pos.x,this.pos.z);
      this.waveY=wave;
      this.baseY=(wy>-1e8)?wy-this.draft:this.pos.y;
      this.pos.y=dampF(this.pos.y,this.baseY+wave,9,dt);
      // 转向横倾: roll → -侧向加速度 * buoyRoll (稳性回复阻尼弹簧; 转弯时向外侧倾)
      const lat=clamp(this.vel*yawRate,-3.2,3.2);
      const rollTgt=clamp(-lat*S.buoyRoll,-0.30,0.30);
      this.rollV+=((rollTgt-this.roll)*NAVAL_ROLL_K-this.rollV*NAVAL_ROLL_D)*dt;
      this.roll+=this.rollV*dt;
      // 加速纵倾: 起步抬头 / 刹车埋首 (pitch → -accel*k)
      const pitchTgt=clamp(-accel*S.buoyPitch,-0.16,0.16);
      this.pitchV+=((pitchTgt-this.pitch)*NAVAL_PITCH_K-this.pitchV*NAVAL_PITCH_D)*dt;
      this.pitch+=this.pitchV*dt;
    }else{
      // 履带态: 完全复用 Tank 的采样单源 tankSurfH (前/后/左/右) + 加减速俯仰
      const sn2=Math.sin(this.yaw), cs2=Math.cos(this.yaw);
      this.pos.y=dampF(this.pos.y,tankRideH(this.pos.x,this.pos.z,this.pos.y),8,dt);
      const hF=tankSurfH(this.pos.x+sn2*2.4,this.pos.z+cs2*2.4), hB=tankSurfH(this.pos.x-sn2*2.4,this.pos.z-cs2*2.4);
      const hL=tankSurfH(this.pos.x-cs2*1.6,this.pos.z+sn2*1.6), hR=tankSurfH(this.pos.x+cs2*1.6,this.pos.z-sn2*1.6);
      const tgtP=-Math.atan2(hF-hB,4.8)-clamp(accel*0.011,-0.09,0.09);
      const tgtR=Math.atan2(hR-hL,3.2);
      this.suspPV+=((tgtP-this.suspP)*46-this.suspPV*7.5)*dt; this.suspP+=this.suspPV*dt;
      this.suspRV+=((tgtR-this.suspR)*46-this.suspRV*7.5)*dt; this.suspR+=this.suspRV*dt;
      this.pitch=this.suspP; this.roll=this.suspR;
      for(const wh of this.wheels){
        const ud=wh.userData||{};
        const wx=this.pos.x+sn2*(ud.lz||0)+cs2*(ud.sx||0);
        const wz=this.pos.z+cs2*(ud.lz||0)-sn2*(ud.sx||0);
        const wgh=heightAt(wx,wz);   // ★2026-11-18 卡顿审计: 负重轮改纯地形高度 —— 悬挂是纯视觉, 不需要障碍顶面; 每车省 ~10 次 tankSurfH (各含 heightAt+eachBoxNear+eachCylNear)
        const hullY=this.pos.y-this.suspP*(ud.lz||0)+this.suspR*(ud.sx||0);
        const tgtY=(ud.baseY!==undefined?ud.baseY:wh.position.y)+clamp(wgh-hullY,-0.17,0.17);
        ud.vy=(ud.vy||0)+((tgtY-wh.position.y)*70-(ud.vy||0)*9)*dt;
        wh.position.y+=ud.vy*dt;
      }
    }
    // 履带滚动 (履带态照车速; 浮航态螺旋桨转速另算)
    if(!this.floating) for(const wh of this.wheels){
      const wr=(wh.geometry&&wh.geometry.parameters&&wh.geometry.parameters.radiusTop)||0.4;
      wh.rotation.x+=this.vel*dt/wr;
    }
  }
  _syncModel(dt){
    this.grp.position.set(this.pos.x,this.pos.y,this.pos.z);
    this.grp.rotation.order='YXZ';
    this.grp.rotation.set(this.pitch,this.yaw,this.roll);
    if(this.turretG) this.turretG.rotation.y=this.turretYaw;
    if(this.pitchG) this.pitchG.rotation.x=-this.turretPitch;
    // 玩家炮手镜 (C 三态的中态, 2026-09-21): 隐藏炮管防穿模 —— 与 15-vehicles.js:499 坦克车长镜同一口径
    // (只隐藏 pitchG = 炮管/炮口锚点组, turretG 塔体照常显示; 炮口世界坐标由不可见 Object3D 照常给出)。
    if(this.pitchG&&this.playerDriven&&typeof player!=='undefined'&&player) this.pitchG.visible=!player.navalGun;
    // 艇: 没有 turretG, 用 15e 的 mainG/secG 跟瞄 (muzzles.* 只是管口锚点, 转它没有视觉)
    if(this.mainG&&this.mainG!==this.turretG) this.mainG.rotation.y=this.turretYaw;
    // ★2026-09-26E (审计 14): 副武器 (.50 双联) 的视觉随动原为 turretYaw*0.6 (无任何注释/契约支撑),
    //   而弹丸走 aimDir() = yaw+turretYaw 全额 ⇒ 主炮转 90° 时管口只转 54°, 曳光弹却从 54° 的管口沿 90°
    //   飞出去; AI 的门控 err 也来自主炮指向 ⇒ 会在 .50 明显没指着的方向开炮。现在视觉与弹道同源 (全额),
    //   "管口在哪、弹就往哪飞"。
    if(this.secG) this.secG.rotation.y=this.turretYaw;
    // ★2026-10-04 (海战审计 V7): 俯仰随动的 0.8 系数与上面 yaw 的旧病同族 (审计 14 修了水平, 漏了垂直)
    //   —— 弹丸走 aimDir() 全额 turretPitch, 视觉只抬 0.8 ⇒ 俯仰 20° 时管口差 4°, 曳光从"没指着"的
    //   管口飞出去。视觉与弹道同源 (全额)。
    if(this.pitchG2) this.pitchG2.rotation.x=-this.turretPitch;
    const nd=this.nodes||{};
    // 螺旋桨自转 (2026-09-25 修): 转的是 15e 每舷"原点落在自己桨轴上"的 nmPropPivot 子枢轴, **不是整组** ——
    // 组原点在车体/艉中线上, 转整组等于让桨叶与桨轴绕中线公转 (半径 = 桨轴半距 xn)。契约不变: 驱动入口
    // 仍是 nodes.propeller 这一个 (15e 冻结签名), 只是把同一角速度逐子枢轴施加。
    if(nd.propeller&&nd.propeller.children&&Math.abs(this.vel)>0.2){
      const spin=dt*(6+Math.abs(this.vel)*2.4);
      for(const pv of nd.propeller.children) pv.rotation.z=(pv.rotation.z||0)+spin;
    }
    if(nd.rudder){
      // 舵偏转 (2026-11-01 修): 与上面螺旋桨同一口径 —— 转的是 15e 每片"原点落在自己舵杆上"的
      // nmRudderPivot 子枢轴, **不是整组** (组原点在艉中线上, 转整组=两片舵绕中线公转, 满舵扫进桨盘)。
      // 契约不变: 驱动入口仍是 nodes.rudder 这一个; 艇的单舵无 pivot 子件 ⇒ 回退整组转 (旧结构兼容)。
      const tgt=-this.inTurn*0.5;
      let piv=false;
      for(const pv of (nd.rudder.children||[])) if(pv&&pv.name==='nmRudderPivot'){ pv.rotation.y=dampF(pv.rotation.y||0,tgt,5,dt); piv=true; }
      if(!piv&&nd.rudder.rotation) nd.rudder.rotation.y=dampF(nd.rudder.rotation.y||0,tgt,5,dt);
    }
    if(this.engine&&this.engineOn){
      const dCam=this.pos.distanceTo(camera.position);
      const base=(this.kind==='boat')?96:52;
      this.engine.update(base+Math.abs(this.vel)*8,clamp(0.3-dCam/110,0,0.3)*(0.55+Math.abs(this.vel)*0.06));
    }
  }
  // 损伤冒烟 (与 Tank 同口径: <45% 血量开始冒黑烟)
  _damageSmoke(dt){
    if(this.hp>=this.maxHp*0.45) return;
    this._smokeT=(this._smokeT||0)-dt;
    if(this._smokeT>0) return;
    this._smokeT=0.14;
    const h=this.spec.hullY+this.spec.hullH*0.4;
    spawnP(PT.dark,this.pos.x+rand(-1,1),this.pos.y+h+rand(0,0.6),this.pos.z+rand(-1,1),
      rand(-0.3,0.3),rand(1,2.2),rand(-0.3,0.3),0.7,1.4,rand(0.8,1.4),0.7,0.2);
  }
  // 尾迹 (只给相机附近的动艇 —— 不吃爆炸粒子预算)
  _wake(dt){
    if(!this.floating||Math.abs(this.vel)<3) return;
    if(this.pos.distanceTo(camera.position)>NAVAL_WAKE_D) return;
    this._wakeT=(this._wakeT||0)-dt;
    if(this._wakeT>0) return;
    this._wakeT=NAVAL_WAKE_T;
    const wy=waterYAt(this.pos.x,this.pos.z);
    if(wy<=-1e8) return;
    const sn=Math.sin(this.yaw), cs=Math.cos(this.yaw);
    const bl=this.spec.hullL*0.5;
    spawnP(PT.drop,this.pos.x-sn*bl+rand(-0.8,0.8),wy+0.06,this.pos.z-cs*bl+rand(-0.8,0.8),
      rand(-0.2,0.2),0.05,rand(-0.2,0.2),rand(0.5,0.9),1.5,1.1,0.34,0);
  }
}
// ══════════════════════════════════════════════════════════════════════════
// 五、冻结 API: 主循环 / 索敌 / 命中 / 编制
// ══════════════════════════════════════════════════════════════════════════
function updateNaval(dt,pdt){
  // ★2026-09-27I 观战时停 (用户实报"时停等对海战载具完全无影响"): 旧版这里是 `if(!(dt>0)) dt=1/60;` ——
  //   把时停的 0 换成满速帧长, 于是整片海战场在时停下照常航行 (而 NavalCraft.update 自己是有
  //   `if(!(dt>0)) return;` 的, 这道兜底把它的守卫架空了)。现在 dt=0 就是**不推进**: 与陆战的
  //   `t.update(0)`/`pl.update(0)` 同一口径 —— "时停"对海战与陆战必须一样。
  //   第二个形参 pdt = 观战者座驾的帧长 (24-main 传: 非时停时 ≡dt): 只有观战者**正在开**的那条艇
  //   跟着他走 (specRide 单源), 其余艇/两栖车照旧吃 dt=0 ⇒ 静止。缺参 (旧探针/沙箱) 时退化为 dt。
  const spd=(typeof pdt==='number'&&pdt>0)?pdt:dt;
  for(const n of navalCraft) n.update((typeof specRide==='function'&&specRide(n))?spd:dt);
  updateTorpedoes(dt);
}
// 半径内最近载具 (team 省略 = 不限敌我; 只返回 alive 且未沉/未成残骸的)
function navalNear(x,z,r,team){
  let best=null,bd=r;
  for(const n of navalCraft){
    if(!n.alive||n.state==='sinking'||n.state==='wreck') continue;
    if(team!==undefined&&team!==null&&n.team!==team) continue;
    // 观战者座驾不被索敌 (2026-09-26H 观战批): 判据单源 specRide (13-combat) —— 本函数是"步兵对舰反应"
    // (14-bots eCraft) 与"艇对艇/艇找目标"的共同取目标入口, 一处排除即两条 AI 路同时生效。
    if(typeof specRide==='function'&&specRide(n)) continue;
    const d=Math.hypot(n.pos.x-x,n.pos.z-z)-n.spec.hullW*0.5;
    if(d<bd){ bd=d; best=n; }
  }
  return best;
}
// 编制核对 (kind 省略 = 全部; 只数 alive)
function navalCount(team,kind){
  let n=0;
  for(const c of navalCraft){
    if(!c.alive||c.state==='sinking'||c.state==='wreck') continue;
    if(team!==undefined&&team!==null&&c.team!==team) continue;
    if(kind&&c.kind!==kind) continue;
    n++;
  }
  return n;
}
// 艇↔艇 / 艇↔坦克 分离 (★2026-09-26E 审计 4): 三圆×三圆取**最深穿透**的那一对作为推挤方向 ——
// 与 _navalBlockedAt / 命中判定的三圆模型同构 (不另造一套几何)。每帧推挤上限 0.35m (60fps 下 21m/s 的
// 相对逼近也不会瞬移), 两侧各推一半 ⇒ 两条 20.5m 的 PT 艏对艏不再叠在一起。
// 撞击"有实感"的代价落在**速度阻尼**上 (逼近分量越大, 双方掉速越多); 不做真实动量交换、也不加撞击伤害 ——
// 那两样都会改海战平衡, 用户未要求 (本条要的是"不穿模 + 撞上去有顶住感", 不是"撞沉")。
function navalPushCraft(c,dt){
// ★2026-09-26E: 搁浅的艇**不被推** (它是坐在礁盘上的, 推开就等于"侧滑脱困", 与"只有倒车能脱困"的
//   搁浅语义冲突 —— 实测把红线 3 的"PT 硬搁浅位移<1m"推成 11m); 对方搁浅时当**不可动障碍** (只推自己)。
if(!c||!c.alive||c.state==='wreck'||c.state==='sinking'||c.state==='ground') return;
const hc=navalHitCyl(c,_nHC);
const offC=Math.max(2.5,(hc.r||2.2)*1.1);
const sn=Math.sin(c.yaw), cs=Math.cos(c.yaw);
// 推挤方向取**中心连线**、穿透量取"最深的那一组圆" —— 与 15-vehicles vehiclePushTanks 同一条实测定案:
//   正撞贴近到"两船前圆重合"的退化位形时, 圆心连线方向会掉头指向船体内侧, 按它推 = 把两条船互相推穿
//   (坦克侧实测中心距被压到 0.16m)。中心连线从构造上保证 |A-B| 单调变大。
// 单帧限幅与坦克同式 (3+合速度)×dt×2.2, 且不超过实际穿透量; 对方是玩家驾驶时由自己走完全程 (权重 1)。
const apply=(other,ox,oz,oyaw,orad,ooff,pushable)=>{
if(other&&other.state==='ground') pushable=false;   // 搁浅方不动 (艇艏顶礁 = 顶在墙上)
const sno=Math.sin(oyaw), cso=Math.cos(oyaw);
let pen=0;
for(const a of [-offC,0,offC]) for(const b of [-ooff,0,ooff]){
const ax=c.pos.x+sn*a, az=c.pos.z+cs*a;
const bx=ox+sno*b, bz=oz+cso*b;
const dx=ax-bx, dz=az-bz, d2=dx*dx+dz*dz, rr=hc.r+orad;
if(d2>=rr*rr) continue;
const p=rr-Math.sqrt(d2);
if(p>pen) pen=p;
}
if(pen<=0) return;
let nx=sn, nz=cs;
const ud=Math.hypot(c.pos.x-ox,c.pos.z-oz);
if(ud>1e-4){ nx=(c.pos.x-ox)/ud; nz=(c.pos.z-oz)/ud; }
const w=(pushable&&other&&other.playerDriven)?1:0.5;
const spd=Math.abs(c.vel)+((pushable&&other)?Math.abs(other.vel||0):0);
// ★2026-10-02 实机"友舰之间穿模十分严重"的根因: 这里旧有一道 **0.5m 绝对限幅** —— 两艇高速对撞
//   (PT 全速 29m/s 对开, 相对 58m/s ⇒ 0.97m/帧) 时每帧穿透增量大于限幅, 推挤永远追不上积分,
//   两条艇在几帧内互换位置 = 对穿。删掉绝对限幅, 只留 (3+spd)*dt*2.2 的平滑限: 它在**低闭合速**下
//   限住抖动 (每帧最多 2.2 倍闭合量的修正), 在高闭合速下恒大于当帧穿透增量 ⇒ 穿透当帧解完。
//   深穿透 (出生重叠/被炸叠上去) 仍按该限分几帧解完, 观感是"顶住"而不是"瞬移"。
const disp=Math.min(pen,(3+spd)*dt*2.2)*w;
c.pos.x+=nx*disp; c.pos.z+=nz*disp;
if(pushable&&other){ other.pos.x-=nx*disp; other.pos.z-=nz*disp; }
// 逼近分量 → 双方掉速 (顶住感); 并行/远离时只做轻微擦碰阻尼
const closing=spd>3;
const k=closing?0.97:0.995;
c.vel*=k;
if(pushable&&other&&typeof other.vel==='number') other.vel*=k;
if(closing&&c.playerDriven&&nowT-(c._ramPopT||-99)>1.5){ c._ramPopT=nowT; if(typeof showScorePop==='function') showScorePop('⚠ 撞船!'); }
};
for(const o of navalCraft){
if(o===c||!o||!o.alive||o.state==='wreck'||o.state==='sinking') continue;
const ho=navalHitCyl(o,_nHO);
apply(o,o.pos.x,o.pos.z,o.yaw,ho.r,Math.max(2.5,(ho.r||2.2)*1.1),true);
}
// 艇↔坦克 (审计 4 的后半条): 坦克不会被推 (它是 15-vehicles 的刚体语义), 只把艇顶开 + 掉速
if(typeof tanks!=='undefined') for(const tk of tanks){
if(!tk||!tk.alive) continue;
const ht=vehHitCyl(tk,_nHO);
apply(null,tk.pos.x,tk.pos.z,tk.yaw,Math.max(1.6,ht.r||2.2),Math.max(1.6,(ht.r||2.2)*1.2),false);
}
}
// 命中圆柱 (§4.2): 两栖车复用 vehHitCyl 口径; 艇按 yaw 取主轴"长扁形" ——
// 圆 r = 半宽×1.05 (rayCyl 可直接用), 附加 seg = 中心线胶囊 (navalRayHit/navalPointHit 用真形)
// out 参 (2026-11-01 性能批): navalPushCraft 每帧每艇两调 (hc/ho), 走模块槽零分配;
// 缺省仍分配新对象 —— 15f 与 dev 探针走"返回并持有"路径, 不能共享槽 (seg 字段同理只在艇分支填)。
const _nHC={x:0,z:0,r:2.2,y0:0,y1:0,seg:{ax:0,az:0,bx:0,bz:0,r:0}};
const _nHO={x:0,z:0,r:2.2,y0:0,y1:0,seg:{ax:0,az:0,bx:0,bz:0,r:0}};
function navalHitCyl(n,out){
  if(out&&n.spec.kind==='amph') return vehHitCyl(n,out);
  if(out){
    const cap=navalCapsule(n);
    out.x=n.pos.x; out.z=n.pos.z; out.r=cap.r; out.y0=cap.y0; out.y1=cap.y1;
    out.seg.ax=cap.ax; out.seg.az=cap.az; out.seg.bx=cap.bx; out.seg.bz=cap.bz; out.seg.r=cap.r;
    return out;
  }
  if(n.spec.kind==='amph') return vehHitCyl(n);
  const cap=navalCapsule(n);
  return {x:n.pos.x,z:n.pos.z,r:cap.r,y0:cap.y0,y1:cap.y1,
          seg:{ax:cap.ax,az:cap.az,bx:cap.bx,bz:cap.bz,r:cap.r}};
}
// 射线 ∩ 艇体胶囊 (精度高于 navalHitCyl 的圆): 返回 {t,craft}|null
function navalRayHit(o,dir,maxD,team,pad){
  let bestT=maxD,best=null;
  const p2=pad||0;
  for(const n of navalCraft){
    if(!n.alive||n.state==='sinking'||n.state==='wreck') continue;
    if(team!==undefined&&team!==null&&team>=0&&n.team===team) continue;
    const cap=navalCapsule(n);
    const rr=cap.r+p2;
    const rr2=rr*rr;
    let t=bestT;
    if(cap.hl<0.05){
      // 退化圆: 解析圆交
      const ox=o.x-cap.ax, oz=o.z-cap.az;
      const a=dir.x*dir.x+dir.z*dir.z;
      if(a<1e-9) continue;
      const b2=2*(ox*dir.x+oz*dir.z), cc=ox*ox+oz*oz-rr2;
      const disc=b2*b2-4*a*cc;
      if(disc<0) continue;
      const tt=(-b2-Math.sqrt(disc))/(2*a);
      if(tt<0.0001||tt>bestT) continue;
      t=tt;
    }else{
      const r=navalRaySeg(o.x,o.z,dir.x,dir.z,cap.ax,cap.az,cap.bx,cap.bz,bestT);
      if(r.d2>rr2) continue;
      t=r.t;
    }
    const y=o.y+dir.y*t;
    if(y<cap.y0-p2||y>cap.y1+p2) continue;
    bestT=t; best=n;
  }
  return best?{t:bestT,nx:0,ny:0,nz:0,craft:best}:null;
}
// 点 ∩ 艇体胶囊 (鱼雷/近炸): 返回 craft|null
function navalPointHit(p,team,r){
  let best=null,bd=1e9;
  for(const n of navalCraft){
    if(!n.alive||n.state==='sinking'||n.state==='wreck') continue;
    if(team!==undefined&&team!==null&&team>=0&&n.team===team) continue;
    const cap=navalCapsule(n);
    const d2=navalPtSeg2(p.x,p.z,cap.ax,cap.az,cap.bx,cap.bz);
    const rr=cap.r+(r||0);
    if(d2>rr*rr) continue;
    if(p.y!==undefined&&(p.y<cap.y0-1.0||p.y>cap.y1+1.0)) continue;
    if(d2<bd){ bd=d2; best=n; }
  }
  return best;
}
// ── 炮弹对艇 (§11.4): 供 updateShells 追加一次调用; 命中返回 true (由那行 splice+continue) ──
// 命中后本函数自己完成: 伤害 + 小爆炸 + 溅射 + 建筑损伤 (与 updateShells 的坦克命中块同口径),
// 并**不**改动 15-vehicles 的任何既有行。
// ★2026-09-26 修 (P1-10 扫掠步长): 第一参之外的 dt 是**新增的可选参** (签名向后兼容 —— 旧调用点传一个参
//   仍按下面的兜底值跑)。旧版把"本帧位移"写死成 vel*0.02, 而 updateShells 真实步进是 vel*dt 且 dt≤0.05
//   (24-main 的帧步长上限) ⇒ 低帧率 (20fps ⇒ dt=0.05) 时一步 2.5× 于这里的包络: 弹丸会**跳过**艇体
//   (塔拉瓦礁盘上打登陆艇/鱼雷艇的实测形态)。现按真实 dt 取包络, 与调用方同一口径。
const _nShDir=V3(0,0,1);
function shellHitNaval(s,dt){
  if(!navalCraft.length||!s) return false;
  const step=s.vel.length()*(dt>0?dt:0.02);        // 本帧位移的上界 = 与 updateShells 同一支 (缺 dt 时退回旧口径)
  const shPad=(s.kind==='at')?0:SHELL_R;
  const maxD=Math.max(2.5,step+0.6)+shPad;
  const dir=_nShDir.copy(s.vel).normalize();   // 复用槽 (2026-11-01 性能批): 每弹每帧 clone 是纯垃圾, dir 本函数内同步消费不持有
  const r=navalRayHit(s.pos,dir,maxD,s.team,shPad);
  if(!r) return false;
  const hit=r.craft;
  const p=V3(s.pos.x+dir.x*r.t,s.pos.y+dir.y*r.t,s.pos.z+dir.z*r.t);
  const dmg=s.dmgV?s.dmgV+rand(-30,30):(s.kind==='at'?rand(300,380):rand(260,330));
  if(s.src&&s.owner) s.owner._src=s.src; // 击杀来源重盖章 (2026-09-29): 与 updateShells 同口径
  // 命中标识档 (2026-09-30 批): 舰炮/岸炮弹直击='shell'; 玩家射手打中活艇出白档, 击沉走 beginDestroy 红档
  if(typeof markHitCls==='function') markHitCls('shell');
  hit.takeDmg(dmg,s.owner,true);
  if(s.owner&&s.owner.isPlayer&&hit.alive&&typeof onPlayerHitAny==='function') onPlayerHitAny('shell');
  explosionFXSmall(p);
  if(typeof AudioSys!=='undefined') AudioSys.explosion('navalShell',p.distanceTo(camera.position)*1.6,AudioSys.panOf(p)); // 舰体中弹档 (★2026-11-15c)
  splashDamage(p,s.owner,s.team,7,s.kind==='at'?70:150,110,true,'shell');
  damageStructures(p,7.5,s.kind==='at'?180:300,s.owner); // 4参 = 破坏得分归属 (2026-09-26 破坏得分批)
  return true;
}
// 鱼雷/炮弹共用的对艇命中 (§11.3): 命中则造成 dmg 点反舰伤害 (ap 全额) 并灌满 flood
// 命中反馈 (2026-09-30 批): 鱼雷='shell' 档; 玩家射手的雷咬中活艇出白档, 击沉走 beginDestroy 红档
function torpedoHitTest(p,team,dmg,owner){
  if(!p||!navalCraft.length) return null;
  const hit=navalPointHit(p,team,NAVAL_TORP_R);
  if(!hit) return null;
  if(typeof markHitCls==='function') markHitCls('shell');
  hit.takeDmg(dmg,owner||null,true);
  if(owner&&owner.isPlayer&&hit.alive&&typeof onPlayerHitAny==='function') onPlayerHitAny('shell');
  hit.flood=Math.max(hit.flood,NAVAL_TORP_FLOOD);
  if(hit.flood>1) hit.beginDestroy(owner||null,'sink');
  return hit;
}
// 溅射对艇 (供 13-combat 的 splashDamage 追加一次调用; 与坦克圈的衰减口径逐式对齐)
// 第 8 参 fbCls (2026-09-30 批): 与 splashDamage 同源 —— 玩家射手溅到活艇出聚合白档
function navalSplash(p,attacker,team,radius,dmgMax,dmgVeh,ap,fbCls){
  if(!navalCraft.length) return 0;
  const ff=(team===-1||team===undefined);
  const vehFloor=ff?20:10;
  let n0=0;
  for(const n of navalCraft){
    if(!n.alive||n.state==='sinking'||n.state==='wreck') continue;
    if(!ff&&n.team===team&&n!==attacker) continue;
    const d=n.pos.distanceTo(p);
    if(d<radius+2.5){ n.takeDmg(lerp(dmgVeh,vehFloor,d/(radius+2.5)),attacker,ap); n0++;
      if(attacker&&attacker.isPlayer&&n.alive&&typeof onPlayerHitAny==='function') onPlayerHitAny(fbCls||'explo'); }
  }
  return n0;
}
// 子弹对艇的**只读**查询 (2026-09-26 抽出): 过滤条件与命中判据与 navalBulletTest 逐字同源, 但不扣血、无副作用 ——
// 供 13-combat 在"决定这一弹归谁"之前先把弹道终点收窄到艇体。
// 为什么必须分出来: 旧版只有"测试+扣血"一体的 navalBulletTest, 而它在 fireBullet 里排在步兵/坦克结算**之后**
// ⇒ 落在艇后 3m 的士兵照样吃这一弹 (艇是贴水面的实心目标, 不是透明物; 只有反射过来的子弹才该被它挡住)。
function navalRayQuery(origin,dir,maxD,shooter){
  if(!navalCraft.length) return null;
  const team=(shooter&&shooter.team!==undefined)?shooter.team:-1;
  const ff=(typeof coFfFire==='function')?coFfFire(shooter):false;
  let bestT=maxD,best=null;
  for(const n of navalCraft){
    if(!n.alive||n.state==='sinking'||n.state==='wreck') continue;
    if(!ff&&team>=0&&n.team===team) continue;
    const cap=navalCapsule(n);
    const r=navalRaySeg(origin.x,origin.z,dir.x,dir.z,cap.ax,cap.az,cap.bx,cap.bz,bestT);
    if(r.d2>cap.r*cap.r) continue;
    const y=origin.y+dir.y*r.t;
    if(y<cap.y0||y>cap.y1) continue;
    bestT=r.t; best=n;
  }
  return best?{t:bestT,craft:best}:null;
}
// 子弹对艇 (供 13-combat 的 fireBullet 追加一次调用): 命中返回 {t,craft}|null —— 调用方用 t 剪辑弹道终点
// (vehDmg>0 时本函数顺带扣血: 与坦克的 `veh.takeDmg(def.vehDmg,shooter,def.atRifle)` 同口径, 非反装甲走 TANK_ARMOR 减免)
function navalBulletTest(origin,dir,maxD,shooter,vehDmg){
  const q=navalRayQuery(origin,dir,maxD,shooter);
  if(!q) return null;
  if(vehDmg&&vehDmg>0) q.craft.takeDmg(vehDmg,shooter,false);
  return q;
}
// ══════════════════════════════════════════════════════════════════════════
// 六、鱼雷在途表 (推进 / 尾迹 / 命中 / 撞滩哑火)
// ══════════════════════════════════════════════════════════════════════════
function updateTorpedoes(dt){
  for(let i=torpedoes.length-1;i>=0;i--){
    const t=torpedoes[i];
    t.life-=dt;
    const wy=waterYAt(t.pos.x,t.pos.z);
    const bed=heightAt(t.pos.x,t.pos.z,true);
    const wd=(wy>-1e8)?(wy-bed):-1e9;
    if(t.life<=0){ torpedoes.splice(i,1); continue; }
    // 撞滩哑火 (§2.1: 对岸无效, 水下引信): 水深不足以容纳定深即失效
    if(wy<=-1e8||wd<NAVAL_TORP_DEPTH+0.25){ navalTorpedoFizzle(t,true); torpedoes.splice(i,1); continue; }
    // 定深贴水面 (受海床限制), 沿航向推进
    t.pos.y=Math.max(bed+0.35,wy-NAVAL_TORP_DEPTH);
    t.pos.addScaledVector(t.vel,dt);
    t.trail-=dt;
    if(t.trail<=0){
      t.trail=0.07;
      spawnP(PT.drop,t.pos.x+rand(-0.2,0.2),wy+0.05,t.pos.z+rand(-0.2,0.2),
        rand(-0.2,0.2),rand(0.2,0.6),rand(-0.2,0.2),0.34,0.9,0.9,0.5,0);
    }
    // ★2026-09-26E (审计 41): 在途鱼雷补音效 —— 旧版本函数零 AudioSys (01-audio 只有发射瞬态),
    //   对舰玩家无法靠听觉察觉来袭鱼雷。每 0.55s 给相机 70m 内的在途雷放一次近距水体噪声
    //   (复用既有的 AudioSys.splash 入口做"航迹嘶声", 不新造音频节点; 距离衰减走它自己的 dist 参数)。
    t.sndT=(t.sndT===undefined?0:t.sndT)-dt;
    if(t.sndT<=0){
      t.sndT=0.55;
      const dc=t.pos.distanceTo(camera.position);
      if(dc<70&&typeof AudioSys!=='undefined'&&AudioSys.splash) AudioSys.splash(dc*0.55,false);
    }
    const hit=torpedoHitTest(t.pos,t.team,t.dmg,t.owner);
    if(hit){   // (2026-11-10: 大舰吃雷 capitalTorpedoHit 钩随大舰子系统下架摘除)
      explosionFX(V3(t.pos.x,wy+0.4,t.pos.z));
      waterSplash(V3(t.pos.x,wy+0.2,t.pos.z),2.0,true,true);
      if(typeof AudioSys!=='undefined') AudioSys.explosion('torpedo',t.pos.distanceTo(camera.position),AudioSys.panOf(t.pos)); // 鱼雷档 (★2026-11-15c: 水下闷爆)
      torpedoes.splice(i,1);
      continue;
    }
  }
}
function navalTorpedoFizzle(t,beached){
  const wy=waterYAt(t.pos.x,t.pos.z);
  if(wy<=-1e8) return;
  waterSplash(V3(t.pos.x,wy+0.1,t.pos.z),beached?0.9:0.5,false,false);
  if(beached) for(let i=0;i<3;i++)
    spawnP(PT.dirt,t.pos.x+rand(-0.6,0.6),wy+0.1,t.pos.z+rand(-0.6,0.6),
      rand(-0.6,0.6),rand(0.5,1.4),rand(-0.6,0.6),rand(0.3,0.6),0.5,rand(0.4,0.8),0.7,6);
}
// ══════════════════════════════════════════════════════════════════════════
// 七、重生点位 (§6.2): muster + 队内序号横向 22m; 朝向 face; 必须落在 sea.navRing 内
// ══════════════════════════════════════════════════════════════════════════
// 本队本型编制数 (navalN=[两栖车,艇] per team; 缺省 NAVAL_ORBAT_DEF)
function navalOrbatN(team,kind){
  const orb=(CAMPAIGN&&CAMPAIGN.navalN)||(typeof NAVAL_ORBAT_DEF!=='undefined'?NAVAL_ORBAT_DEF:[2,3]);
  const i=(kind==='amph')?0:1;
  const v=orb[i];
  if(typeof v==='number') return Math.max(1,v);
  if(Array.isArray(v)) return Math.max(1,v[team]||1);
  return (kind==='amph')?2:3;
}
// 重生点现算 + navRing 校验 (越界则沿艏向轴来回搜索一个合规点; 只 warn 一次不刷屏)
// 【单源】23-deploy 的 navalMusterSpot(team,ord) 是集结点落位的己方单源 (它按 ord 连续编号铺开);
//   本函数优先读它, 只有它还没落盘时才用兜底算式 —— 免得"开局位"与"重生位"两套算术 (§6.2)。
function navalSpawnPoint(n){
  let x,z,face;
  if(typeof navalMusterSpot==='function'){
    const sp=navalMusterSpot(n.team,n.ord);
    if(sp){ x=sp.x; z=sp.z; face=(sp.face===undefined)?0:sp.face; return {x,z,face,...navalRingFix(x,z,face,n)}; }
  }
  const mu=(CAMPAIGN&&CAMPAIGN.sea&&CAMPAIGN.sea.muster)?CAMPAIGN.sea.muster[n.team]:null;
  if(mu){
    face=(mu.face===undefined)?0:mu.face;
    // ord = 队内海战载具的**连续序号** (0..navalN[0]+navalN[1]-1; 由 23-deploy 分配: 先两栖车后艇),
    // 因此两型共用一条横向线也不会叠点, 无需再错行。全队居中 = 集结点保持质心 (§6.2)。
    // ★2026-09-26E (审计 11): 与 23-deploy 的 navalMusterSpot 用**同一个算式** —— 旧版这里是
    // "全队居中" NAVAL_SPAWN_GAP*(ord-(total-1)/2), 而 23-deploy 用 ord*gap 单边铺开, 两套算术差最多 44m;
    // 真链永远走 23-deploy 那一支 (上面 if 已优先读它), 这段只在 23-deploy 缺席时生效 ⇒ 让它逐式一致,
    // 不再留第二套。两处注释从此都成立: 单源算式 = ord*NAVAL_SPAWN_GAP。
    const off=NAVAL_SPAWN_GAP*n.ord;
    const lx=Math.cos(face), lz=-Math.sin(face);          // face 的右法向 = 横向
    x=mu.x+lx*off; z=mu.z+lz*off;
  }else{
    // 非环礁图兜底 (正常不会走到: 那些图不建海战载具) —— 与 Tank 同法落在主基地前
    const bp=basePos(n.team);
    x=bp.x+(n.team===0?15:-15)+n.ord*8; z=bp.z; face=(n.team===0)?Math.PI:0;
  }
  return {x,z,face,...navalRingFix(x,z,face,n)};
}
// navRing 断言与修正: d=shoreDist ∈ [d0,d1] (无海域直接放行) —— 重生即搁浅是硬伤, 必须挡在出生前
function navalRingFix(x,z,face,n){
  if(typeof SEA==='undefined'||!SEA||!shoreDist) return {x,z};
  const ring=(CAMPAIGN&&CAMPAIGN.sea&&CAMPAIGN.sea.navRing)||{d0:43,d1:200};
  const sn=Math.sin(face), cs=Math.cos(face);
  const ok=(px,pz)=>{ const d=shoreDist(px,pz); return d>=ring.d0&&d<=ring.d1; };
  if(ok(x,z)) return {x,z};
  for(let k=1;k<=60;k++){
    for(const s of [-1,1]){
      const px=x+sn*(k*4*s), pz=z+cs*(k*4*s);      // 沿艏向轴来回找 (海侧/陆侧各试)
      if(ok(px,pz)) return {x:px,z:pz};
    }
  }
  if(typeof console!=='undefined') console.warn('[15d] 重生点 '+n.name+' 无法落在 sea.navRing 内',x,z);
  return {x,z};
}
