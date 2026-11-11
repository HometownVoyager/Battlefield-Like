// ─────────────────────────────────────────────
// 15-vehicles.js —— 坦克/炮弹/溅射伤害
// 源: Index.original.html 第 5637-6206 行
// (2026-09-06 B7a: 切分遗留的 15a-defs.js 死表已删, 数据单源在 00-config FACTIONS[...].tanks)
// ─────────────────────────────────────────────
'use strict';
const tanks=[], shells=[];
// 坦克/反坦克炮弹重力: 近似平直弹道, 基本不受重力影响
const SHELL_G=0.5;
// 主炮弹速/射程 (2026-09-01 压制力增强: 130m/s×3.5s=455m → 150m/s×4.5s≈675m;
//   2026-09-21B 用户裁定「陆战的也提到 180~200」⇒ 190 m/s;
//   2026-09-28 用户裁定「各种炮弹的弹速乘二」⇒ **380 m/s** (在途 life 不动 ⇒ 射程包线同比例 ×2;
//   枪弹本就是即时命中射线, 无弹速概念, 不在此列)。海战 SHELL_SPD_NAVAL 同步取 380 (00-config)。
const SHELL_SPD=380;
// ── 坦克主炮炮弹"体积"与判定 (2026-09-17 观战扩展批, 用户指定"稍作增大") ──
// 旧实现: 炮弹是**点判定** (对步兵走细射线/对坦克走固定圆柱), 视觉只有 0.16 的拖尾火星 ——
// 擦边掠过常常"看起来该中却没中"。现给坦克主炮炮弹一个判定半径 SHELL_R: 对步兵/载具/结构统一 +0.3m,
// 视觉拖尾 0.16→0.26 并加一枚亮芯 (弹体更"看得见")。**反坦克炮/火箭弹不受影响** (kind==='at',
// 与坦克主炮的命中档位刻意分开: 用户只要求坦克炮弹, 不动固定炮/火箭筒的既有手感)。
const SHELL_R=0.3;
// 反坦克弹 (火箭筒/反坦克炮) 判定半径 (2026-09-28 阶段三 P1): 见 updateShells 注
const AT_SHELL_PAD=0.45;
// ── 载具命中圆柱单源 (2026-09-06 B7b/P2-2): 旧 7 处内联, 同一辆坦克两套命中体积(子弹 2.2/炮弹 2.3) ──
// 半径统一 2.3 (命中体积修正, 非玩法 nerf); 卡车无炮弹路径, 保留 2.2 口径
// 命中上限 2.6 = 履带车族的**唯一**口径 (2026-09-26 提为具名常量): 15d 的两栖车分支 (navalHitCyl→vehHitCyl,
// 以及 navalCapsule 的 amph 上限) 也读它 —— 旧版 15d 那边自写 hullH*1.05 (LVT 2.05 / カミ 1.63), 比模型
// 炮塔顶 (2.78 / 2.39) 矮一截, 于是打车顶的子弹从头顶飞过; 两处从此同源, 改口径只改这一个数。
const VEH_HIT_TOP=2.6;
const _vehCylSlot={x:0,z:0,r:2.3,y0:0,y1:0};
if(typeof globalThis!=='undefined') globalThis._vehCylSlot=_vehCylSlot;
function vehHitCyl(t,out){
const o=out||{x:0,z:0,r:2.3,y0:0,y1:0};
o.x=t.pos.x; o.z=t.pos.z; o.r=2.3; o.y0=t.pos.y; o.y1=t.pos.y+VEH_HIT_TOP;
return o;
}
function truckHitCyl(t,out){
const o=out||{x:0,z:0,r:2.2,y0:0,y1:0};
o.x=t.pos.x; o.z=t.pos.z; o.r=2.2; o.y0=t.pos.y+0.2; o.y1=t.pos.y+2.5;
return o;
}
// 带"弹体判定半径"的同源变体 (2026-09-17 观战扩展批): 供坦克主炮炮弹命中判定用 (SHELL_R)
function vehHitCylR(t,pad,out){
const o=out||{x:0,z:0,r:2.3,y0:0,y1:0};
o.x=t.pos.x; o.z=t.pos.z; o.r=2.3+pad; o.y0=t.pos.y; o.y1=t.pos.y+VEH_HIT_TOP;
return o;
}
function truckHitCylR(t,pad,out){
const o=out||{x:0,z:0,r:2.2,y0:0,y1:0};
o.x=t.pos.x; o.z=t.pos.z; o.r=2.2+pad; o.y0=t.pos.y+0.2; o.y1=t.pos.y+2.5;
return o;
}
// ── 出生落位校验 (★2026-09-26 新增, P0-5): 出生点不该落在建筑/道具/深水/陡坡上 ──
// 采样口径与 update() 的坡度物理**同源**: 车体轴线三圆 (±2.6, 与 tankPush 的三圆同轴距) 逐个查占用格,
//   车体四角 (前/后 ±2.6, 左/右 ±1.3 = 半宽) 查高差; 门限 25° —— 出生点不该让车一落地就落在
//   "30° 起渐进减速"的坡里 (TANK_SLOPE_MAX=70° 是封死硬门, 那是行驶中允许的极限, 不是出生点该有的姿势)。
const TANK_SPAWN_SLOPE=Math.tan(25*DEG);
function tankSpawnOk(x,z,yaw){
if(occBlocked(x,z)) return false;
if(typeof waterDepthAt==='function'&&waterDepthAt(x,z)>VEH_WATER_DEPTH) return false;
const sn=Math.sin(yaw), cs=Math.cos(yaw);
for(const o of [-2.6,0,2.6]){ if(occBlocked(x+sn*o,z+cs*o)) return false; }
const h0=heightAt(x,z);
for(const [dx,dz,sp] of [[sn*2.6,cs*2.6,2.6],[-sn*2.6,-cs*2.6,2.6],[cs*1.3,-sn*1.3,1.3],[-cs*1.3,sn*1.3,1.3]]){
if(Math.abs(heightAt(x+dx,z+dz)-h0)/sp>TANK_SPAWN_SLOPE) return false;
}
return true;
}
// ── 载具步兵碰撞/推出/碾压单源 (2026-09-06 B7b/P2-3): Tank/Truck 逐行同构块参数化 ──
// ── 厂房坦克产能 (2026-09-06 斯大林格勒点位改版): 苏军持"厂房"旗 → 重生倍速 + 出厂区 ──
// FACTORY_FLAG 缓存旗点对象 (05c 已建 FLAGS); tankRespawnMul=重生倒计时消耗倍率 ——
// 占领/失守瞬间自动作用于全部未重生完的该队坦克, 无需翻转钩子; 仅苏军(队0)享受, 德军恒 1
const FACTORY_FLAG=FACTORY_FLAG_ID?FLAGS.find(f=>f.id===FACTORY_FLAG_ID):null;
function tankRespawnMul(team){
return (team===0&&FACTORY_FLAG&&FACTORY_FLAG.owner===0)?FACTORY_SPEED_MUL:1;
}
function vehiclePushSoldiers(veh,hx,hz,o){
const csb=Math.cos(veh.yaw), snb=Math.sin(veh.yaw);
for(const s of combatants){
if(s._crushCd>0) s._crushCd-=o.dt; // 碾压幸存宽限 (2026-11-03): 墙钟账, 逐车逐帧衰减 (双车叠压≈2×dt, 无碍)
if(!s.alive||s.onVehicle) continue;
if(s.clingVeh) continue;   // 扒车中的丧尸不推不碾 (25-zombies cling 单源豁免, 2026-10-07d): 挂得住才拆得动
if(o.checkSpectator&&s.spectator) continue;
if(s.pos.y>veh.pos.y+o.yMax) continue;
const relx=s.pos.x-veh.pos.x, relz=s.pos.z-veh.pos.z;
const lx=relx*csb-relz*snb;
const lz=relx*snb+relz*csb;
if(Math.abs(lx)>=hx+0.38||Math.abs(lz)>=hz+0.38) continue;
const frontal=o.symmetricFrontal?(lz>hz-o.frontalBand):(veh.vel>0?(lz>hz-o.frontalBand):(lz<-(hz-o.frontalBand)));
if(o.moving&&frontal&&s.team!==veh.team&&!(s._crushCd>0)){
o.crusher._src=veh.name; // 碾压击杀来源: 记入载具名
// 碾压命中反馈 (2026-09-30 批): 玩家驾驶碾到活着的敌方步兵出白档 (档='mg' 无框; 致命一击走 die 链红档)
if(typeof markHitCls==='function') markHitCls('mg');
s.damage(o.crushDmg,o.crusher,false);
if(o.crusher&&o.crusher.isPlayer&&s.alive&&typeof onPlayerHitAny==='function') onPlayerHitAny('mg');
if(!s.alive) continue;
// 碾而不死 (2026-11-03 用户裁定): 发宽限账防下一帧再结一次 → "连续碾=事实秒杀"让改 99/80 形同虚设;
// 人随既有侧向限幅推挤被挤出车壳 (与友军挤开同一支, 见下), 宽限走完若仍在车前才会再吃一次。
s._crushCd=TANK_CRUSH_CD;
}
const penX=hx+0.38-Math.abs(lx);
const penZ=hz+0.38-Math.abs(lz);
let lateral=penX<penZ;
if(o.moving&&frontal) lateral=true;
if(lateral){
const sgn=lx>=0?1:-1;
const amt=penX<0.5?penX:Math.min(penX,(3+o.pushVel)*o.dt*2.2);
s.pos.x+=csb*sgn*amt; s.pos.z+=-snb*sgn*amt;
} else {
const sgn=lz>0?1:-1;
s.pos.x+=snb*sgn*penZ; s.pos.z+=csb*sgn*penZ;
}
if(s.isPlayer) collideMove(s.pos,0.42);
}
}
// 选项复用槽 (2026-11-01 性能批): 旧版坦克/卡车/两栖每帧各新建一个 options 对象字面量。
// 函数体只同步读字段 (o.crusher._src 写的是 crusher 不是 o), 三处调用点串行填充后即弃。
const _vpsOpts={dt:0,crusher:null,moving:false,yMax:1.9,frontalBand:1.5,symmetricFrontal:false,crushDmg:320,pushVel:0,checkSpectator:false};
// ═══════════ 坦克车组 AI 交战层 (2026-09-20 I1) ═══════════
// 用户口径 (2026-09-20): "完整坦克AI逻辑但不同难度下应当有不同削弱" + "不能太超雄".
// 根因: 旧 turretAI 只做"选目标 + 转塔 + 开火", 缺"敌车感知 → 交战决策 → 战术机动"三层 ——
//   两辆敌对坦克擦肩而过互不理睬; 且主炮散布/炮塔转速/提前量对所有难度同档 ⇒ 远距离百发百中.
// 结构: ① tankPerceive 感知层 (视野距离×DIFF_TABLE.visMul + 前向视锥 + raycastWorld LOS, 不穿墙索敌)
//   ② 交战决策 (反应延迟 / 首次发现停车观察 → 转塔对准才开火) ③ pickTankTactic 战术机动
//   (抢起伏掩体 hull-down / 侧翼绕行 / 追残血 / 保持对射距离; 新兵几乎不追击不绕侧)
//   ④ 命中削弱 (炮塔转速 / 俯仰速率 / 提前量误差 / 散布) 全挂三档 ⑤ tankFireLineClear 友军弹道预检 (互不误伤)
//   ⑥ vehiclePushTanks 车体分离/推挤 (不穿模)
// 单源: 三档难度本体仍取 00-config 的 DIFF_TABLE (react/visMul/spreadMul 逐值引用, 不复制数值);
//   坦克专用项 (炮塔转速/俯仰/提前量误差/停车时长/追击绕侧意愿/战术火力距离) 是本任务新增维度, 只此一张表.
const TANK_VIEW_BASE=205;   // 基准发现距离 m (×DIFF_TABLE.visMul: 新兵164 / 老兵205 / 精英256) —— (2026-09-21 A#1) 削弱: 235→205
const TANK_VIEW_CONE=1.25;  // 前向视锥半角 rad (≈72°): 车体前向与炮塔指向任一覆盖即可 (车长探头/炮长镜两条观察通道)
const TANK_REACT_MUL=3.2;   // 反应延迟倍率: 车组 发现→口令→转塔→装填 比步兵慢一档 (DIFF_TABLE.react 是步兵口径) —— (2026-09-21 A#1) 削弱: 1.6→3.2
const TANK_PER_T=0.14;      // 感知扫描周期 s (≈7Hz): 车长观察不需要每帧全量射线
const TANK_AI=[
//  炮塔转速 俯仰速率 提前量误差 散布系数 停车观察 短倒车 追击 绕侧 抢掩体 开火容差 火力距离 记忆时长 首次开火前摇
 { tRate:0.55, pitch:0.50, lead:0.62, spreadK:1.65, halt:1.95, rev:0.00, chase:0.00, flank:0.00, cover:0.08, fireTol:0.115, fireR:120, mem:2.8, fireDelay:3.60 }, // 新兵
 { tRate:0.78, pitch:0.76, lead:0.34, spreadK:1.27, halt:1.15, rev:0.22, chase:0.45, flank:0.40, cover:0.55, fireTol:0.070, fireR:175, mem:4.0, fireDelay:2.20 }, // 老兵
 { tRate:0.96, pitch:0.96, lead:0.17, spreadK:1.10, halt:0.66, rev:0.46, chase:1.00, flank:1.00, cover:1.00, fireTol:0.040, fireR:230, mem:5.2, fireDelay:1.70 }, // 精英
];
// 三档派生值 (本表 × DIFF_TABLE, 文档/验收直接引这几行; 2026-09-21 A#1 整体下调一档, 旧值见括号):
//   发现距离:  新兵 164m / 老兵 205m / 精英 256m          (TANK_VIEW_BASE × visMul; 旧 188/235/294)
//   反应延迟:  新兵 2.72s / 老兵 1.60s / 精英 0.90s        (DIFF_TABLE.react × TANK_REACT_MUL; 旧 1.36/0.80/0.45)
//   首次开火前摇: 新兵 3.60s / 老兵 2.20s / 精英 1.70s     (fireDelay, 与车长反应 aiReact 并行取长者 ⇒ 实测 ≈3.7/2.1/1.7s)
//   主炮散布:  新兵 0.0309 / 老兵 0.0140 / 精英 0.0073 rad (0.011 × DIFF_TABLE.spreadMul × spreadK; 旧 0.0234/0.0110/0.0056)
//   开火门槛:  容差 0.115/0.070/0.040 rad, 火力距离 120/175/230m (新兵不敢远距离开火, 也不会 200m 点名)
//   主炮只打敌车 (A#1): 步兵目标不再触发主炮, 只用同轴机枪压制 (见 turretAI 的开火门)
// 红线 (A#1): 不许削到"两辆敌对 AI 坦克相遇互不理睬" —— 精英档战术机动 (追击/绕侧/抢掩体) 按用户裁定保留 1.0
const _tankTuneCache=[];
function tankAITune(){
const i=clamp(SETTINGS.diff|0,0,2);
let T=_tankTuneCache[i];
if(!T){
const d=DIFF_TABLE[i]||DIFF_TABLE[1], k=TANK_AI[i]||TANK_AI[1];
// 按难度索引缓存: 设置里热改 SETTINGS.diff 时另一档现算, 不把难度定死在启动时
T=_tankTuneCache[i]=Object.assign({ diff:i, name:d.name,
 vis:TANK_VIEW_BASE*d.visMul, react:d.react*TANK_REACT_MUL, spreadMul:d.spreadMul*k.spreadK }, k);
}
return T;
}
// ── 坦克↔坦克车体分离/推挤 (2026-09-20 I1 用户: "坦克彼此穿模") ──
// 与 vehiclePushSoldiers 同构: 逐车调用, **只推自己**, 每对车各推一半 ⇒ 一次接触完成一次分离,
// 不会像"每帧全推"那样互相过推抖动; 车体用沿轴线的三圆近似 (与 update 里的建筑碰撞三圆同源 ±1.85),
// 侧靠/正撞/斜插都能分开: 横向最近中心距 = 2×TANK_PUSH_R = 2.9m > 车体宽 2.6m (肉眼不再穿模).
// 三条安全阀 (从机制上不可能把对方推穿地形/推进建筑): ① 只动自己 —— 对方只在自己的 update 里推自己,
// 同样过安全阀; ② 落点先过 occBlocked (建筑足迹/水障格) 且与当下地面高差过大 (崖壁) 不动;
// ③ 单帧推挤限幅, 防深穿一帧弹飞. 玩家驾驶的车一律不动 (玩家驾驶行为不变), AI 车自己走完全程.
// **位置下限 (验收口径)**: 中圆对 (车心 ±0) 恒在解算表内 + 方向恒取车心连线 ⇒ 任意姿态下两车中心距 ≥
// 2×TANK_PUSH_R = 2.9m (车体宽 2.6m), 正撞/侧撞/斜插均不例外; 推挤后的落点必过 occBlocked 与高差阀.
const TANK_PUSH_R=1.45;      // 碰撞圆半径 (车体半宽 1.3 + 0.15 余量)
const TANK_PUSH_OFF=1.85;    // 三圆沿车体轴线偏移
function tankPushOk(x,z,fromY){
if(occBlocked(x,z)) return false;
return Math.abs(heightAt(x,z)-fromY)<1.5; // 一帧被推上/推下 1.5m 以上 = 崖壁, 不放行
}
function vehiclePushTanks(veh,dt){
if(veh.playerDriven) return; // 玩家驾驶行为不变: 玩家车不被 AI 推
const s1=Math.sin(veh.yaw), c1=Math.cos(veh.yaw);
for(const t2 of tanks){
if(t2===veh||!t2.alive) continue;
if(Math.abs(t2.pos.y-veh.pos.y)>2.6) continue; // 上下层 (桥上/桥下) 不做平面推挤
const s2=Math.sin(t2.yaw), c2=Math.cos(t2.yaw);
// 每对只解**最深**的那一组圆: 多组同时解 = 同一对车推两遍 (抖动), 且更贵; 只需穿透量, 方向另取 (见下)
let pen=0;
for(const o1 of [-TANK_PUSH_OFF,0,TANK_PUSH_OFF]){
const ax=veh.pos.x+s1*o1, az=veh.pos.z+c1*o1;
for(const o2 of [-TANK_PUSH_OFF,0,TANK_PUSH_OFF]){
const bx=t2.pos.x+s2*o2, bz=t2.pos.z+c2*o2;
const dx=ax-bx, dz=az-bz, d2=dx*dx+dz*dz;
const rr=TANK_PUSH_R*2;
if(d2>=rr*rr) continue;
const p=rr-Math.sqrt(d2);
if(p>pen) pen=p;
}
}
if(pen<=0) continue;
// 方向取**车心连线**, 不取圆心连线 (2026-09-20 实测定案): 正撞贴近到"两车前圆重合"的退化位形时,
// 圆心连线方向会掉头指向车体内侧, 按它推 = 把两车互相推穿 (12s 硬挤实测中心距被压到 0.16m);
// 车心连线从构造上保证 |A-B| 单调变大, 且中圆对(半径 2×1.45)始终在解算表里 ⇒ 中心距下限 2.9m > 车宽 2.6m.
let nx=s1, nz=c1;
const ud=Math.hypot(veh.pos.x-t2.pos.x,veh.pos.z-t2.pos.z);
if(ud>1e-4){ nx=(veh.pos.x-t2.pos.x)/ud; nz=(veh.pos.z-t2.pos.z)/ud; }
// 权重: 对方是玩家车时自己走完全程 (weight=1), 两辆 AI 各推一半 ⇒ 一次接触完成一次完整分离
const wSelf=t2.playerDriven?1:0.5;
// 单帧限幅: 与 vehiclePushSoldiers 同式 (3+合速度)×dt×2.2 —— 跟得上"两车同时挤入"的接近速度,
// 又不超过实际穿透量 (pen 本身是上限)
const spd=Math.abs(veh.vel)+(t2.playerDriven?0:Math.abs(t2.vel));
const disp=Math.min(pen,(3+spd)*dt*2.2)*wSelf;
const px=veh.pos.x+nx*disp, pz=veh.pos.z+nz*disp;
if(!tankPushOk(px,pz,veh.pos.y)) continue; // 落点不安全 (贴墙/崖边): 这一帧不动, 不做"换个方向顶出去"的乱推
veh.pos.x=px; veh.pos.z=pz;
// 撞上就掉速 (同 vehiclePushSoldiers 的推挤手感): 贴车挤压不再全速推进
if(Math.abs(veh.vel)>0.5){
const fx=s1*Math.sign(veh.vel), fz=c1*Math.sign(veh.vel);
if(fx*nx+fz*nz<-0.35) veh.vel*=0.9;
}
}
}
// ── 友军弹道预检 (2026-09-20 I1 用户口径: 互不误伤) ──
// 口径: 炮口→目标连线走廊里若有本方活着的坦克 (横向 3.4m 内) 或下车步兵 (1.0m 内), 且比目标更近 ⇒ 这一炮不打.
// 为什么必须显式做: raycastWorld 只认静态几何 (BOXES/CYLS), 坦克与士兵都不在射线表里 —— 不补这一层就会
//   "隔着友军车体/人堆开火", 炮弹走的是同一份弹道, 溅射照样连带友军.
// 竖直方向也判: 弹道在该水平距离处的高度与友军身体差得远 (>3.5m) 视为从头顶/沟壑飞过, 不算挡线.
// 起点余量 2.5m/1.5m: 坦克↔坦克位置下限是中心距 2.9m, 而炮口在世界坐标上又在本车前向 ~4.5m 处,
// 余量取小会让"正好停在炮口侧前方"的友军漏判 —— 余量取大只会多停一炮, 不会误伤.
function tankFireLineClear(self,o,dir,dist){
const hl=Math.hypot(dir.x,dir.z)||1, ux=dir.x/hl, uz=dir.z/hl; // 水平归一: 走廊宽度按真实横向距离判
for(const t of tanks){
if(!t.alive||t.team!==self.team||t===self) continue;
const dx=t.pos.x-o.x, dz=t.pos.z-o.z;
const proj=dx*ux+dz*uz;
if(proj<2.5||proj>dist-2.5) continue;
if(Math.abs(dx*uz-dz*ux)>3.4) continue;
const fy=o.y+dir.y*(proj/hl);
if(fy<t.pos.y-1||fy>t.pos.y+3.4) continue;
return false;
}
for(const s of combatants){
if(!s.alive||s.team!==self.team||s.onVehicle||s.spectator) continue;
const dx=s.pos.x-o.x, dz=s.pos.z-o.z;
const proj=dx*ux+dz*uz;
if(proj<1.5||proj>dist-2.5) continue;
if(Math.abs(dx*uz-dz*ux)>1.0) continue;
const fy=o.y+dir.y*(proj/hl);
if(fy<s.pos.y||fy>s.pos.y+2.2) continue;
return false;
}
return true;
}
// 2026-09-02 装甲抗性: 坦克对"非反装甲"伤害(机枪/步枪子弹、火烧、飞机扫射、炸弹/迫击炮溅射等)按此倍率减免;
// 巡飞弹/坦克炮/固定炮/反坦克攻击(火箭筒/反坦克枪/炸药)仍全额生效 —— takeDmg 第3参 ap=true 表示反装甲伤害
// (2026-09-02 用户调参: 减免倍率 0.4 → 0.3, 非反装甲伤害只吃三成)
const TANK_ARMOR=0.3;
const wreckMat=new THREE.MeshLambertMaterial({color:0x1e1c18,map:TEX.grime}); // B8/P3-12 残骸焦污
// ── 越野跨越 (2026-09-04 用户指定): 低矮且无法摧毁的障碍(油桶/石碾/碎石堆/矮木箱/木凳等,
// 自身高度≤1.3m(顶面相对其地面), 且无 dGroup 可撞塌/无 crush 可碾毁)直接驶上跨越 —— 不阻挡也不碾毁,
// 障碍保持完好; 可摧毁的(沙袋/木箱/石墙, 高速撞毁/碾毁)与高障碍(拒马1.5m/石柱/建筑)维持原判定 ──
const TANK_STEP=1.3;
function tankRideH(x,z,baseY){
// 坦克底盘目标高度: 地面与脚下/前方 2.2m 足印内可跨越障碍顶面取高者 (阻尼过渡呈上坡爬越感)
// 2026-09-06 B5/P0-2: 全量扫描改 RGRID 邻近候选 (查询半径 2.25; 圆柱 r+1.9≤4.0 ⇒ 全场 r≤2.1 恒成立)
let h=heightAt(x,z);
const r2=2.2*2.2;
eachBoxNear(x-2.25,z-2.25,x+2.25,z+2.25,b=>{
if(b.dead) return;
if(b.maxY<=baseY-0.25||b.maxY>baseY+TANK_STEP) return; // 足印内平齐/已过/太高都不算
// 可跨越 = 障碍自身低矮(顶面高出其地面≤1.3m) 且 无 dGroup 撞塌/无 crush 碾毁 的可放行类别;
// <0.7m 的本来就放行 (与碰撞循环口径一致), 高度按自身相对地面判定 — 不随坦克瞬时高度漂变
const bh=b.maxY-b.gh;
if(bh>0.7&&(bh>TANK_STEP||b.dGroup||b.crush)) return;
const cx=clamp(x,b.minX,b.maxX), cz=clamp(z,b.minZ,b.maxZ);
const dx=x-cx, dz=z-cz;
if(dx*dx+dz*dz<r2&&b.maxY>h) h=b.maxY;
});
eachCylNear(x-4.0,z-4.0,x+4.0,z+4.0,c=>{
if(c.r<0.3) return;
if(c.y1-c.y0>TANK_STEP) return; // 自身低矮
if(c.y1<=baseY-0.25||c.y1>baseY+TANK_STEP) return;
const dx=x-c.x, dz=z-c.z, q=c.r+1.9;
if(dx*dx+dz*dz<q*q&&c.y1>h) h=c.y1;
});
return h;
}
// 悬挂采样面高度 (tankSurfH): 地面与足下可跨越障碍顶面取高者 —— 不做 baseY 频带过滤,
// 前/后/左/右采样点一旦贴到障碍顶面就推动俯仰/侧倾弹簧, 越过时产生"上坡-颠簸-下坡"的跨越姿态
// 2026-09-06 B5/P0-2: 全量扫描改 RGRID 邻近候选 (盒 1.6 / 圆柱 r+1.5≤4.0)
// ── 候选回调提升 (2026-11-01 性能批): 每辆坦克每帧 ~14 次 tankSurfH, 旧版每次分配 2 个内联闭包;
//    采样点/累计高经模块槽 _tsQ 传递, 回调只在装载期创建一次。复用前提 (逐处已核):
//    eachBoxNear/eachCylNear 的回调体内不再调 tankSurfH, 调用方串行消费返回值, 不跨调用持有。
const _tsQ={x:0,z:0,h:0};
function _tsBoxCb(b){
if(b.dead) return;
const bh=b.maxY-b.gh;
if(bh>0.7&&(bh>TANK_STEP||b.dGroup||b.crush)) return;
const cx=clamp(_tsQ.x,b.minX,b.maxX), cz=clamp(_tsQ.z,b.minZ,b.maxZ);
const dx=_tsQ.x-cx, dz=_tsQ.z-cz;
if(dx*dx+dz*dz<1.55*1.55&&b.maxY>_tsQ.h) _tsQ.h=b.maxY;
}
function _tsCylCb(c){
if(c.r<0.3||c.y1-c.y0>TANK_STEP) return;
const dx=_tsQ.x-c.x, dz=_tsQ.z-c.z, q=c.r+1.5;
if(dx*dx+dz*dz<q*q&&c.y1>_tsQ.h) _tsQ.h=c.y1;
}
function tankSurfH(x,z){
_tsQ.x=x; _tsQ.z=z; _tsQ.h=heightAt(x,z);
eachBoxNear(x-1.6,z-1.6,x+1.6,z+1.6,_tsBoxCb);
eachCylNear(x-4.0,z-4.0,x+4.0,z+4.0,_tsCylCb);
return _tsQ.h;
}
// ══════════════════════════════════════════════════════════════════════
// 坦克剪影几何工厂 (2026-09-20 I2 批: 按国家/车型出可辨识剪影)
// 口径 (用户已确认): "按国家+车型出可辨识剪影: 炮塔形状/车体轮廓/负重轮/涂装分档", 纯程序化几何, 不加外部资源。
// 数据单源: 全部视觉尺寸在 00-config.js 的 FACTIONS[...].tanks[i].tk (字段说明见那边表头注释);
//   本工厂只按 tk.shape / tk.tur.shape 走**离散档**分支 —— 调数值不用改这里的代码。
// 为什么不做 this.grp.scale 整体缩放: 缩放会连带炮轴高度漂移, 而 update() 里 this.muzzle 的世界高 1.93 是硬编码;
//   故一律按"实尺寸"建模, 座圈高由车体顶面派生, 炮轴恒锁 TB_AXIS (日系靠实尺寸变小, 不靠缩放)。
// 硬约束 (改动前必读): ①this.wheels 必须是 Mesh 数组 —— update() 走 wh.rotation.x 与 wh.userData{sx,lz,vy,baseY};
//   ②整车包围盒相对旧建模 ≤±15% (vehHitCyl 2.3m 圆柱 / vehiclePushSoldiers 的 hullL/2+0.45 / SHELL_R 口径);
//   ③行走机构 = **带环 + 轮** (2026-09-28 全重做, 契约见 tankBuildGear 表头): 半宽 halfW 与带环底面 y=0.03
//     逐位锁死 (推力框口径 / 离地间隙零漂移), 花纹只在带环**外表面**且沿环向滚动 (this.trackTileLen 单源)。
// ══════════════════════════════════════════════════════════════════════
const TB_AXIS=1.93; // 炮轴世界高, 与 update() 里 this.muzzle 的 y=1.93 同源 (改这里必须同步改那边)
// ── 行走机构几何常量 (2026-09-28 全重做: 履带带环 + 独立侧裙板; 契约见 tankBuildGear 表头) ──
const TB_GAP=0.08;     // 负重轮底离地: 带环"内底面"= 轮底 ⇒ 轮永远压在带上 (旧版轮底 0.06 / 履带底 0.03 两张皮)
const TB_TH=0.05;      // 履带板厚 (径向): 带环外底面 = 0.08-0.05 = 0.03 = 旧履带盒的地面间隙 (逐位不变)
const TB_TOP_GAP=0.05; // 回程段内面比轮顶高出的量: 悬挂每轮 ±0.17m 上跳时轮顶不会顶出带面
// 端轮 (主动轮/诱导轮) 抬高档 [前, 后] (单位: whR): 谢尔曼主动轮在前 (抬高+略小) · 四号/黑豹前后都抬
// (德系标志性的高位主动轮轮廓) · T-34 前置大诱导轮几乎贴地、后置主动轮抬得最高 · 九七式/维克斯居中。
// 抬高量同时决定端轮半径 (端轮顶面恒与回程段同高 ⇒ 回程段永远是水平直线)。
const TB_END_LIFT={sherman:[0.22,0.10], pz4:[0.34,0.34], t34:[0.10,0.28], chiha:[0.18,0.14], vickers:[0.20,0.12]};
const TB_TK_DEF={shape:'vickers',hullW:2.6,hullH:0.95,hullY:1.0,trkSx:1.62,whR:0.36,whN:5,glacis:-0.55,sponson:0,skirt:0,
 paint:'plain',barR:0.11,brake:0,cupH:0.22,tur:{shape:'round',w:2.3,l:2.5,h:0.72,ringZ:0}}; // 无 tk 的老数据兜底
function tkSpec(D,tk){
const raw=tk||{}, tur=Object.assign({},TB_TK_DEF.tur,raw.tur||{});
const pick=(v,d)=>v!==undefined?v:d;
// ── A#6 (2026-09-21): 炮塔按车重等级分级缩放 ──
// wc ∈ light|med|heavy (00-config 每辆坦克的 tk 单源; **不复用 heavy 字段** —— 那是"同阵营第二辆"的槽位标记, T-26 也写着 heavy:true)。
// 缺 wc/未知档按中型 1.0 (老数据/沙箱子集兜底)。只缩"头", 不缩车体/履带 —— 车宽与推力框口径不变。
const wc=raw.wc||'med';
const turScale=(typeof WC_TUR_SCALE!=='undefined'&&WC_TUR_SCALE[wc])||1.0;
const L=D.hullL, hullW=pick(raw.hullW,TB_TK_DEF.hullW), hullH=pick(raw.hullH,TB_TK_DEF.hullH);
const hullY=pick(raw.hullY,TB_TK_DEF.hullY), trkSx=pick(raw.trkSx,TB_TK_DEF.trkSx);
const whR=pick(raw.whR,TB_TK_DEF.whR), whN=Math.max(2,pick(raw.whN,TB_TK_DEF.whN)); // whN≥2: 轮距公式要除以 (whN-1)
const trkW=hullW*0.26;                                         // 履带带宽 (由车体派生: 陆战车族比例恒定)
const skirtN=raw.skirt|0;
// ── 行走机构口径 (2026-09-28 全重做; 三次用户实报的收敛点, 详见 tankBuildGear 表头) ──
//   · 轮: 轮心 whY=whR+TB_GAP (轮底 = 带环内底面), 轮宽 whW=trkW-0.02 (比带宽窄 2cm ⇒ 轮面比带外沿
//     内收 1cm, 侧视图清楚看见轮、且**绝不穿模** —— 旧版把轮外移 6cm 顶穿侧板正是这条的反面);
//   · 带环: 侧视轮廓由这三组数派生 —— 内底 tbLow(=轮底) / 内顶 tbTop(=轮顶 + TB_TOP_GAP) / 两端轮;
//   · 端轮: 顶面恒与内顶同高 ⇒ 半径 = (tbTop-tbLow)/2 - 抬高量; 前/后抬高量查 TB_END_LIFT (剪影档);
//     纵向站位 = 端部负重轮相切 + 6cm 间隙 (端轮不吃进负重轮, 也不甩出车头太远)。
const whW=trkW-0.02, whY=whR+TB_GAP;
const tbLow=TB_GAP, tbTop=tbLow+2*whR+TB_TOP_GAP;
const lift=TB_END_LIFT[raw.shape||TB_TK_DEF.shape]||TB_END_LIFT.vickers;
const endRf=Math.max(whR*0.5,(tbTop-tbLow)/2-lift[0]*whR), endYf=tbTop-endRf;
const endRr=Math.max(whR*0.5,(tbTop-tbLow)/2-lift[1]*whR), endYr=tbTop-endRr;
const zWheelF=Math.max(0.30,L/2-0.10-TB_TH-2*endRf-whR);      // 端部负重轮中心 (给端轮腾位)
const zWheelR=-zWheelF;
// 端轮纵向站位: 前后对称 (带环两端各超出车体 0.10m), 但**至少**与端部负重轮相切 + 2cm ⇒ 取更外站的那个。
const endZf=Math.max(L/2+0.10-TB_TH-endRf,zWheelF+endRf+whR+0.02);
const endZr=Math.min(-(L/2+0.10-TB_TH-endRr),zWheelR-endRr-whR-0.02);
const tb={yLow:tbLow,yTop:tbTop,cF:zWheelF,cR:zWheelR,zF:endZf,yF:endYf,rF:endRf,
          zR:endZr,yR:endYr,rR:endRr};                         // 带环内轮廓 (外轮廓由 tbContour 派生)
// 翼板/裙板: 两条路的**外沿都落在 halfW=trkSx+trkW/2+0.06** 上 —— 无裙板的车翼板照旧 (trkW+0.12),
// 有裙板的车翼板收窄到 trkW+0.02 把外侧让给裙板 ⇒ 整车半宽 (推力框口径) 与旧版逐位相同, 零漂移。
const fendW=trkW+(skirtN>0?0.02:0.12);
const halfW=trkSx+trkW/2+0.06;
const fendY=tbTop+TB_TH+0.05;                                  // 翼板 (0.08 薄板) 落在带环顶面之上 5cm
const roof=hullY+hullH/2;
// ★ 2026-09-26 B8 修: 座圈原来抬到 roof+0.05 ⇒ 炮塔底面与车体顶面之间留一道 5cm 通缝 (站立眼高正好看见)。
//   改为坐在顶面上 (ringY=roof); 炮轴 TB_AXIS 是世界硬编码, 所以钳制高度 th 会自动补回这 5cm
//   (钳制档的塔顶高度不变), 非钳制档整塔低 5cm (≈1.7% 车高, 在 verify-vehmodels 的 ±15% 内)。
const ringY=roof;
const pitchZ=tur.l/2*turScale-0.10;                           // 炮盾在炮塔前端 (随炮塔长度分级缩放; 相对 turretG: 座圈 ringZ 由 turretG 自带, 不可重复计)
const barrelTip=tur.ringZ+pitchZ+D.barrelL+0.10;              // 炮口预留点 (车体局部系, 旧口径: 管口外 0.10m; barrelL 不缩放)
return {L,hullW,hullH,hullY,trkSx,trkW,fendW,fendY,whR,whN,whW,whY,halfW,tb,tbTh:TB_TH,roof,ringY,pitchZ,barrelTip,tur,turScale,wc,
 glacis:pick(raw.glacis,TB_TK_DEF.glacis), glacisD:hullH*1.02, rearA:0.55, rearD:0.85,
 sponson:raw.sponson||0, skirt:skirtN, paint:raw.paint||TB_TK_DEF.paint, colA:raw.colA,
 barR:pick(raw.barR,TB_TK_DEF.barR), brake:raw.brake?1:0, cupH:pick(raw.cupH,TB_TK_DEF.cupH),
 shape:raw.shape||TB_TK_DEF.shape, barrelL:D.barrelL, heavy:!!D.heavy};
}
// 侧裙板 (Schürzen, skirt>0 的德系): **独立分片**挂在翼板外侧 —— 与履带带环彻底分离 (2026-09-28 重做)。
// 为什么不能像旧版那样"贴在履带侧面": 旧版履带是一个实心盒, 它的 ±X 面就是行走机构的最外一层, 于是
// 侧视图上"侧面 = 一整块板"、轮子要么被挡住要么穿模凸出 (用户 2026-09-27/28 两次实报)。
// 现口径 = 真实坦克: 履带是**绕轮的带环** (见 tankBuildGear), 裙板是另一件挂在翼板外侧的薄板分片,
// 上缘与翼板顶面齐平 (从翼板外沿往下挂), 下缘停在轮心略上方 (露出下半截轮), 片间留 6cm 缝 ——
// 几片连成一排才是 Schürzen 的样子 (2026-09-28 用户实报"太高, 高出来一块": 首版把上缘写到车体顶面下
// 4cm ⇒ 整片高过翼板约半米、侧面看车体和履带之间多出一堵墙; 真实 Schürzen 只遮上半截行走机构)。
// 挂点: 外沿 = S.halfW (与翼板同面, 整车半宽口径零漂移), 内面离带环外沿 1.5cm (永不共面/不穿模)。
// 6~8 片合成**一个网格** (自建 BufferGeometry, 逐面法线/UV) —— 旧版每片一个 Mesh, 德系多出 4~6 个 draw call。
function tankBuildSkirt(g,S,M){
const n=S.skirt|0; if(n<=0) return;
const th=0.045, gap=0.06;
const y0=S.whY+S.whR*0.10, y1=S.fendY+0.04;                   // 下缘 (略高于轮心) → 上缘 (与翼板顶面齐平)
const xo=S.halfW, xi=S.halfW-th;
const z0=-S.L/2, z1=S.L/2, seg=(z1-z0)/n;
const B=tbBuilder(); B.begin(0);
for(const sx of [-1,1]) for(let i=0;i<n;i++){
const za=z0+seg*i+gap/2, zb=z0+seg*(i+1)-gap/2;
tbBox(B, sx>0?xi:-xo, y0, za, sx>0?xo:-xi, y1, zb);
}
B.done();
const m=new THREE.Mesh(B.build(),M.tone); m.name='skirt'; g.add(m);
}
// 车体: 主装甲盒 + 首上倾斜板 + 尾板 (+ 铸造侧凸 / 侧裙 / 迷彩条)
function tankBuildHull(T,S,M){
const g=T.grp, L=S.L;
// ★ 2026-09-26 B6 修: 车体盒的前缘按首上倾角**回收**。
//   旧版车体盒照旧铺满 [-L/2, L/2], 首上板从"前下棱"向后上方铺 ⇒ 大倾角档 (T-34 glacis=-1.02rad,
//   板长 0.97m ⇒ 后收 0.83m) 整块板落在车体盒**内部**, 剪影上完全看不到斜装甲 (只有近垂直的四号
//   才露出来一点)。现在把车体盒前缘切到板的**顶棱** (z=L/2-glacisD*sa), 楔形由板自己补上:
//   整车总长仍严格 = hullL (板的下前棱仍在 z=L/2), 炮塔座圈/履带/翼板/负重轮的站位一律不动。
const back=(Math.abs(S.glacis)>0.02)?S.glacisD*Math.sin(Math.abs(S.glacis)):0;
const body=new THREE.Mesh(new THREE.BoxGeometry(S.hullW,S.hullH,L-back),M.body);
body.position.set(0,S.hullY,-back/2); g.add(body);
if(back>0){ // 首上装甲: 自"前下棱"沿倾角向后上方铺板 (T-34 大倾角 / 四号近垂直 / 九七式小倾角)
const ca=Math.cos(Math.abs(S.glacis)), sa=Math.sin(Math.abs(S.glacis));
// 2026-09-25 修: 板长 glacisD 必须落在**高度**位 (y), 厚度 0.22 落在 z —— 下面两行定位式
// (y 抬高 glacisD*ca/2、z 回收 glacisD*sa/2) 是按"高 glacisD 的竖板绕前下棱旋转"推出来的。
// 旧版写成 (hullW, 0.22, glacisD), 板长挂到了 z 上: 四号 (-0.18, 近垂直) 变成中高处前伸的
// 水平搁板、T-34 (-1.02, 大倾角) 整块缩进车体里 —— 首上倾角在剪影上完全看不出来。
const gl=new THREE.Mesh(new THREE.BoxGeometry(S.hullW*0.995,S.glacisD,0.22),M.body);
gl.rotation.x=S.glacis;
gl.position.set(0,S.hullY-S.hullH/2+S.glacisD*ca/2-0.02,L/2-S.glacisD*sa/2-0.06);
g.add(gl);
}
const rp=new THREE.Mesh(new THREE.BoxGeometry(S.hullW*0.995,S.hullH*0.5,S.rearD),M.body); // 尾板 (后缘超出车体: 与旧建模的整车长度口径一致)
rp.rotation.x=S.rearA; rp.position.set(0,S.hullY+S.hullH*0.10,-L/2+0.20); g.add(rp);
if(S.sponson>0){ // 谢尔曼/潘兴: 铸造侧凸的宽肩车体
const sp=new THREE.Mesh(new THREE.BoxGeometry(S.hullW+S.sponson*2,S.hullH*0.40,L*0.60),M.tone);
sp.position.set(0,S.hullY+S.hullH*0.24,-L*0.06); g.add(sp);
}
tankBuildSkirt(g,S,M); // 侧裙板 (Schürzen, 定义在 tankBuildHull 之前) —— 独立分片挂翼板外侧
if(S.paint==='camo'&&M.accent){ // 涂装分档 camo (德/缴获): 车体侧面三道迷彩条, 色值来自 config colA
for(let i=0;i<3;i++){
const b=new THREE.Mesh(new THREE.BoxGeometry(S.hullW+0.03,S.hullH*0.34,L*0.16),M.accent);
b.position.set(0,S.hullY+((i%2)?S.hullH*0.16:-S.hullH*0.14),-L*0.26+i*L*0.26);
g.add(b);
}
}
}
// ══════════════════════════════════════════════════════════════════════
// 行走机构 (2026-09-28 全重做): 履带带环 trackBandGeo + 翼板 + 负重轮
// ── 契约 (改动前必读) ──────────────────────────────────────────────────
// ① 带环 = 绕**全部轮子**的闭合带。侧视轮廓 = 接地段直线 + 两端圆弧 (主动轮/诱导轮) + 回程段直线
//    (+端轮抬起时从"端部负重轮正下方"斜切上去的一段切线)。内轮廓与外侧廓**同构等长** (直线各外移
//    TB_TH、圆半径 +TB_TH) ⇒ 两条轮廓按索引一一配对, 直接连成 4 面带 (外=花纹 / 内·两侧=金属)。
// ② 花纹只在**带环外表面**、且沿**环向**排开 (花纹条横跨带宽) ⇒ update() 推一个标量 offset 就能让整条
//    环同步滚动。v 沿**材料流向**递增 (接地段向后、回程段向前), 故前进时 offset 必须**减小** (见 update)。
// ③ 环长取整贴: trackTileLen = 环长 / round(环长/1.5) ⇒ 闭合处花纹对齐 (无接缝), 条距 8 条/贴 ≈19cm。
// ④ 负重轮与端轮都在带环**之内** (轮面比带外沿内收 1cm): 侧视图 = 一条细带 + 一排清晰的轮, 无穿模。
// ⑤ 端轮 (主动轮/诱导轮) 烘在同一几何里: 省 4 个 Mesh (德系黑豹原本已顶到网格数上限 36)。
// ⑥ 材质两段: [0]=履带花纹 (TEX.track 克隆) / [1]=金属 (M.dark, 与负重轮同源)。两侧共用同一几何。
// 为什么推倒重来 (三次用户实报的收敛点): 旧版把行走机构做成一个 (trkW × 1.12 × L+0.25) 的**实心盒**,
//   于是 ① 侧视图整条下缘是一块板 (2026-09-27"轮子侧面处仍有履带") ② 把盒子的 ±X 面改喷装甲板后,
//   轮子必须外移到盒外才露得出来, 又从侧板里穿模凸出 (2026-09-28"裙甲是一整个侧面且让坦克轮穿模凸出来")。
//   症结在盒体本身 —— 一个从地面到车体下缘的实心块, 侧面只能是一整块板。真实坦克的行走机构是
//   **轮 + 绕轮的带**, 侧视图上两者互不遮挡: 轮在带内、带是细环 (本口径)。
// ──────────────────────────────────────────────────────────────────────
// ── 合并几何小工具: 手写 BufferGeometry (盒 / 圆盘 / 带环), 逐面法线与 UV, 绕向自校正 ──
// 为什么自己写: ① 一个网格里放多件 (裙板 6~8 片、带环 + 2 个端轮) ⇒ draw call 与网格数都省一半;
//   ② 端轮/带环要"顶面与回程段同高"这类几何关系, 用 Box/Cylinder 拼不出来 (只能靠旋转逼近)。
function tbBuilder(){
const pos=[],nor=[],uv=[],idx=[],grp=[];
let open=0, gid=0;
const P=i=>[pos[i*3],pos[i*3+1],pos[i*3+2]];
return {
vert(x,y,z,nx,ny,nz,u,v){ pos.push(x,y,z); nor.push(nx,ny,nz); uv.push(u,v); return pos.length/3-1; },
// 绕向自校正: 几何法线 (叉积) 必须与 out 同向 —— 绕错了就翻转, 免得整件在 FrontSide 下不可见
tri(a,b,c,ox,oy,oz){
const A=P(a),B=P(b),C=P(c);
const e1=[B[0]-A[0],B[1]-A[1],B[2]-A[2]], e2=[C[0]-A[0],C[1]-A[1],C[2]-A[2]];
const nx=e1[1]*e2[2]-e1[2]*e2[1], ny=e1[2]*e2[0]-e1[0]*e2[2], nz=e1[0]*e2[1]-e1[1]*e2[0];
if(nx*ox+ny*oy+nz*oz>=0) idx.push(a,b,c); else idx.push(a,c,b);
},
quad(a,b,c,d,ox,oy,oz){ this.tri(a,b,c,ox,oy,oz); this.tri(a,c,d,ox,oy,oz); },
begin(mat){ if(idx.length>open){ grp.push({start:open,count:idx.length-open,materialIndex:gid}); open=idx.length; } gid=mat; },
done(){ if(idx.length>open) grp.push({start:open,count:idx.length-open,materialIndex:gid}); open=idx.length; },
build(){
const g=new THREE.BufferGeometry();
g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
g.setIndex(idx);
// groups 是普通数组 (three 规范口径) ⇒ 直接赋值, 不走 addGroup/clearGroups: 零沙箱桩依赖
// (全库 30+ 个验证探针的 THREE 桩只实现 setAttribute/setIndex, 见 dev/verify-*.js 的 class Geo)
g.groups=grp.slice();
return g;
}
};
}
// 轴对齐盒 (6 面各自的法线与 0..1 面 UV, 与车体各 BoxGeometry 的面 UV 同密度)
// 角序 c0..c7 = (x0y0z0, x1y0z0, x1y1z0, x0y1z0, x0y0z1, x1y0z1, x1y1z1, x0y1z1); 绕向由 quad 自校正。
// ★ 2026-11-01 修: UV 必须按**面内两轴**取 —— 旧式对全部面统一传 (y旗,x旗), ±X 面 v 恒定/±Y 面 u 恒定,
//   UV 塌成一条线, 裙板 (M.tone 带 grime 贴图) 侧面被拉成条纹。±X 面 u=z旗,v=y旗 / ±Y 面 u=x旗,v=z旗 / ±Z 面 u=x旗,v=y旗。
function tbBox(B,x0,y0,z0,x1,y1,z1){
const c=[[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]];
const F=[[1,2,6,5,1,0,0],[0,3,7,4,-1,0,0],[3,2,6,7,0,1,0],[0,1,5,4,0,-1,0],[4,5,6,7,0,0,1],[0,1,2,3,0,0,-1]];
for(const f of F){
const [nx,ny,nz]=f.slice(4);
const q=f.slice(0,4).map(k=>{
const xf=k&1, yf=(k>>1)&1, zf=(k>>2)&1;
const uv=nx? [zf,yf] : ny? [xf,zf] : [xf,yf];
return B.vert(c[k][0],c[k][1],c[k][2],nx,ny,nz,uv[0],uv[1]);
});
B.quad(q[0],q[1],q[2],q[3],nx,ny,nz);
}
}
// 圆柱 (轴沿 X: 端轮/主动轮) —— side 段正负由 out 方向自动校正
function tbWheel(B,cx,cy,cz,r,hw,seg){
const ring=[];
for(let k=0;k<seg;k++){
const a=2*Math.PI*k/seg, sy=Math.sin(a), sz=Math.cos(a), y=cy+r*sy, z=cz+r*sz, u=k/seg;
ring.push({
rimL:B.vert(cx-hw,y,z,0,sy,sz,u,0), rimR:B.vert(cx+hw,y,z,0,sy,sz,u,1),
capL:B.vert(cx-hw,y,z,-1,0,0,sy*0.5+0.5,sz*0.5+0.5), capR:B.vert(cx+hw,y,z,1,0,0,sz*0.5+0.5,sy*0.5+0.5)});
}
const cl=B.vert(cx-hw,cy,cz,-1,0,0,0.5,0.5), cr=B.vert(cx+hw,cy,cz,1,0,0,0.5,0.5);
for(let k=0;k<seg;k++){
const a=ring[k], b=ring[(k+1)%seg];
const am=2*Math.PI*(k+0.5)/seg, my=Math.sin(am), mz=Math.cos(am);
B.quad(a.rimL,b.rimL,b.rimR,a.rimR,0,my,mz);
B.tri(a.capL,b.capL,cl,-1,0,0); B.tri(a.capR,b.capR,cr,1,0,0);
}
}
// 带环侧视轮廓 (顺时针: 接地段向后 → 后端抬 → 后端圆弧 → 回程段向前 → 前端圆弧 → 前端落)。
// th=0 ⇒ 内轮廓; th=TB_TH ⇒ 外轮廓 (直线外移、圆半径增大)。两条轮廓**等长同序**, 索引一一配对。
// 端轮不抬 (圆底点落在地面线上) 时自动退化为"直线与圆相切", 不产生多余的角点。
function tbContour(tb,th){
const yLow=tb.yLow-th, yTop=tb.yTop+th, rF=tb.rF+th, rR=tb.rR+th;
const pts=[], push=(z,y)=>pts.push({z,y});
const tanLow=(cz,cy,r,pz,py)=>{ // 自角点 P 到圆的**下**切点 (端轮抬起时才是真切线, 否则退化为底点)
const a=Math.atan2(py-cy,pz-cz), b=Math.acos(clamp(r/Math.hypot(pz-cz,py-cy),-1,1));
const p0={z:cz+r*Math.cos(a-b),y:cy+r*Math.sin(a-b)}, p1={z:cz+r*Math.cos(a+b),y:cy+r*Math.sin(a+b)};
return p0.y<=p1.y?p0:p1;
};
const NF=7;
if(tb.yR-tb.rR>tb.yLow+1e-6) push(tb.cR,yLow);                 // 后端抬起 ⇒ 接地段到角点为止
const trl=tanLow(tb.zR,tb.yR,rR,tb.cR,yLow); push(trl.z,trl.y);
{ const t0=Math.atan2(trl.y-tb.yR,trl.z-tb.zR), t1=-3*Math.PI/2; // 后弧: 下切点 → 绕过后端 → 顶点
for(let k=1;k<=NF;k++){ const t=t0+(t1-t0)*k/NF; push(tb.zR+rR*Math.cos(t),tb.yR+rR*Math.sin(t)); } }
push(tb.zF,yTop);                                              // 回程段 (顶点之间: 恒水平)
{ const trf=tanLow(tb.zF,tb.yF,rF,tb.cF,yLow);
const t0=Math.PI/2, t1=Math.atan2(trf.y-tb.yF,trf.z-tb.zF);     // 前弧: 顶点 → 绕过前端 → 下切点
for(let k=1;k<=NF;k++){ const t=t0+(t1-t0)*k/NF; push(tb.zF+rF*Math.cos(t),tb.yF+rF*Math.sin(t)); } }
if(tb.yF-tb.rF>tb.yLow+1e-6) push(tb.cF,yLow);                  // 前端抬起 ⇒ 接地段从角点起
return pts;
}
// 侧视轮廓 → 4 面带 (沿 ±X 拉伸): 返回 {geo,tileLen}。外表面走材质段 0 (花纹), 其余 + 端轮走段 1。
function trackBandGeo(S){
const hw=S.trkW/2, P=tbContour(S.tb,0), Q=tbContour(S.tb,S.tbTh), n=P.length;
const B=tbBuilder();
// 各站法线 (侧视面内): 顺时针轮廓 ⇒ 外法线 = 切向旋 +90° = (-ty, tx)
const nrm=[];
for(let i=0;i<n;i++){
const t0={z:P[i].z-P[(i-1+n)%n].z,y:P[i].y-P[(i-1+n)%n].y}, t1={z:P[(i+1)%n].z-P[i].z,y:P[(i+1)%n].y-P[i].y};
const d0=Math.hypot(t0.z,t0.y)||1, d1=Math.hypot(t1.z,t1.y)||1;
let tz=t0.z/d0+t1.z/d1, ty=t0.y/d0+t1.y/d1; const d=Math.hypot(tz,ty)||1; tz/=d; ty/=d;
nrm.push({z:-ty,y:tz});
}
// 环长 (沿外表面量) → 取整贴: trackTileLen = 环长/贴数 ⇒ 闭合处花纹对齐
const arc=[]; let acc=0;
for(let i=0;i<n;i++){ if(i) acc+=Math.hypot(Q[i].z-Q[i-1].z,Q[i].y-Q[i-1].y); arc.push(acc); }
const circ=acc+Math.hypot(Q[0].z-Q[n-1].z,Q[0].y-Q[n-1].y);
const tileLen=circ/Math.max(1,Math.round(circ/1.5));
// 顶点: 每站 8 个 —— 径面用 4 (内左/外左/外右/内右) + 侧面用 4 (同序, 法线 ±X)
// ★闭合处必须**反卷** (2026-09-28): 环是闭合的, 而 v 是按"从起点沿环累加"给的 —— 最后一段 (接地段)
//   要从第 n-1 站接回第 0 站, 若第 0 站的 v 仍是 0, 那一段的 UV 就得从 s_max/t 倒着插值到 0
//   (接地段花纹会**反向**跑, 且与两端弧段的密度对不上)。解法: 给第 0 站另做一份 v 加整圈 (C/t) 的副本,
//   只给收尾那一段用 —— C/t 是整数 (见上取整贴), 对平铺贴图与 0 完全等价, 而插值方向就顺了。
const mk=(i,vv)=>{
const p=P[i], q=Q[i], nn=nrm[i], u0=-hw/tileLen, u1=hw/tileLen, vr=S.tbTh/tileLen;
return {
rad:[B.vert(-hw,p.y,p.z,0,-nn.y,-nn.z,u0,vv), B.vert(-hw,q.y,q.z,0,nn.y,nn.z,u0,vv),
     B.vert( hw,q.y,q.z,0,nn.y,nn.z,u1,vv), B.vert( hw,p.y,p.z,0,-nn.y,-nn.z,u1,vv)],
lat:[B.vert(-hw,p.y,p.z,-1,0,0,0,vv), B.vert(-hw,q.y,q.z,-1,0,0,vr,vv),
     B.vert( hw,q.y,q.z, 1,0,0,vr,vv), B.vert( hw,p.y,p.z, 1,0,0,0,vv)],
nn};
};
const ids=[];                                  // 各站顶点集 (第 0 站另有一份"反卷副本" idsWrap)
for(let i=0;i<n;i++) ids.push(mk(i,arc[i]/tileLen));
const idsWrap=mk(0,circ/tileLen);              // 整圈 = 整数贴 (见上) ⇒ 与 v=0 对平铺贴图等价
B.begin(0);                                   // 段 0: 外表面 (履带花纹, 沿环向滚动)
for(let i=0;i<n;i++){ const j=(i+1)%n, A=ids[i], C=j===0?idsWrap:ids[j];
B.quad(A.rad[1],C.rad[1],C.rad[2],A.rad[2],0,(A.nn.y+C.nn.y)/2,(A.nn.z+C.nn.z)/2); }
B.begin(1);                                   // 段 1: 内表面 + 两侧断面 + 端轮 (金属)
for(let i=0;i<n;i++){ const j=(i+1)%n, A=ids[i], C=j===0?idsWrap:ids[j];
B.quad(A.rad[3],C.rad[3],C.rad[0],A.rad[0],0,-(A.nn.y+C.nn.y)/2,-(A.nn.z+C.nn.z)/2);
B.quad(A.lat[0],C.lat[0],C.lat[1],A.lat[1],-1,0,0);
B.quad(A.lat[3],C.lat[3],C.lat[2],A.lat[2],1,0,0);
}
for(const sgn of [1,-1]){                     // 端轮 (主动轮/诱导轮): 嵌在带环两端圆弧之内
const r=sgn>0?S.tb.rF:S.tb.rR;
const cy=sgn>0?S.tb.yF:S.tb.yR, cz=sgn>0?S.tb.zF:S.tb.zR;
tbWheel(B,0,cy,cz,r,Math.max(0.10,S.trkW*0.34),10);
}
B.done();
const geo=B.build(); geo.userData={tileLen,circ,stations:n,tb:S.tb,tbTh:S.tbTh,trkW:S.trkW};
return geo;
}
// 行走机构: 履带带环 + 翼板 + 负重轮 (负重轮必须进 this.wheels: update() 按 userData{sx,lz,baseY} 做独立行程弹簧)
function tankBuildGear(T,S,M){
const g=T.grp, L=S.L;
// 履带花纹贴图: TEX.track 的花纹条沿 V 每 8px 一条 (64px/贴), 条自身沿 U 是常量 ⇒ 只要让带环的
//   **环向**落在 V 上, 花纹条就自然是"横跨带宽、沿环向排开"。纹理矩阵不参与 (repeat=1/rotation=0),
//   方向与密度全部烘焙进 UV (trackBandGeo) —— 旧版用全局 rotation=π/2 摆正了一面却拧歪了另外三面。
T.trackTex=TEX.track.clone(); T.trackTex.needsUpdate=true;
T.trackTex.wrapS=T.trackTex.wrapT=THREE.RepeatWrapping;
T.trackTex.repeat.set(1,1);
T.trackTex.rotation=0;
const trkGeo=trackBandGeo(S);
T.trackTileLen=trkGeo.userData.tileLen;        // 每贴世界长度 (update() 滚花费用; 也用作 UV 的米→贴换算)
const trackMat=new THREE.MeshLambertMaterial({map:T.trackTex});
T.trkMats=[trackMat,M.dark];                  // [0]=带环外表面 (花纹) [1]=内/侧/端轮 (金属)
T.trkGeo=trkGeo;
for(const sx of [-1,1]){
const tr=new THREE.Mesh(trkGeo,T.trkMats); tr.name='trackBand';
tr.position.set(sx*S.trkSx,0,0); g.add(tr);    // 带环几何自带绝对高度 (外底面 y=0.03) ⇒ 只给横向偏移
const fd=new THREE.Mesh(new THREE.BoxGeometry(S.fendW,0.08,L+0.3),M.body); // 翼板: 带环顶面之上 5cm
fd.name='fender'; fd.position.set(sx*S.trkSx,S.fendY,0); g.add(fd);
for(let i=0;i<S.whN;i++){
const lz=S.tb.cR+i*(S.tb.cF-S.tb.cR)/(S.whN-1);   // 轮距: 端部轮位由带环口径给出 (给端轮腾出位置)
const wh=new THREE.Mesh(new THREE.CylinderGeometry(S.whR,S.whR,S.whW,10),M.dark);
wh.rotation.z=HPI;
wh.position.set(sx*S.trkSx,S.whY,lz);             // 横向在带环**之内** (轮面比带外沿内收 1cm)
wh.userData={sx:sx*S.trkSx,lz,vy:0,baseY:S.whY};
g.add(wh); T.wheels.push(wh);
}
}
}
// 炮塔: 按 tk.tur.shape 走档 (圆润铸造 / 方箱 / 六角 / 加长六角 / 小型圆) + 炮盾 + 炮管 + 指挥塔
// A#6 (2026-09-21): 本函数全部尺寸过 turScale (tkSpec 派生: 轻 0.82 / 中 1.0 / 重 1.15) —— 炮塔本体(含底径=座圈) /
//   指挥塔 / 炮盾 / 炮管半径 一起缩放; **炮管长度 barrelL 不缩放** (契约 §2.4)。
//   高度下限钳制 (Lead 2026-09-21 裁定): 世界顶面 = ringY + h, 而炮轴 TB_AXIS=1.93 是硬编码 (update 的 muzzle.y /
//   aimPitch / tankCoverPoint 全锁它) —— 轻坦若把 t.h 直接乘 0.82, 顶面会掉到炮轴以下 (炮管从塔顶飘出去)。
//   故 h 取 max(t.h×turScale, TB_AXIS-ringY+0.14): 轻坦的炮塔只在**平面尺寸**上变小 (变窄变短), 重坦照常长高。
function tankBuildTurret(T,S,M){
const t=S.tur, G=new THREE.Group();
G.position.set(0,S.ringY,t.ringZ); T.turretG=G; T.grp.add(G);
const mat=(S.paint==='plain')?M.body:M.tone; // 涂装分档: 非单色档炮塔走第二色 colT
const ts=S.turScale||1;                        // A#6 分级缩放系数 (缺省 1.0)
const tw=t.w*ts, tl=t.l*ts, th=Math.max(t.h*ts,TB_AXIS-S.ringY+0.14);
const R=tl/2;                                  // 炮塔底径 = 座圈直径 (随分级缩放)
if(t.shape==='round'||t.shape==='smallRound'){ // 圆润铸造炮塔 (谢尔曼/潘兴) / 小型圆炮塔 (九七式)
const main=new THREE.Mesh(new THREE.CylinderGeometry(R*0.86,R,th*0.88,14),mat);
main.position.y=th*0.44; G.add(main);
const cap=new THREE.Mesh(new THREE.CylinderGeometry(R*0.60,R*0.86,th*0.14,14),mat);
cap.position.y=th*0.93; G.add(cap);
if(t.shape==='smallRound'){ const bu=new THREE.Mesh(new THREE.BoxGeometry(tw*0.86,th*0.46,tl*0.22),mat); bu.position.set(0,th*0.30,-R*0.92); G.add(bu); }
}else if(t.shape==='hex'||t.shape==='hexLong'){ // 六角炮塔 (T-34/76 六棱 / KV 加长尾舱)
const hx=new THREE.Mesh(new THREE.CylinderGeometry(R*0.86,R,th,6),mat);
hx.rotation.y=Math.PI/6; hx.position.y=th/2; G.add(hx);
if(t.shape==='hexLong'){ const bu=new THREE.Mesh(new THREE.BoxGeometry(tw*0.72,th*0.42,0.36*ts),mat); bu.position.set(0,th*0.30,-R-0.14*ts); G.add(bu); }
}else{ // 方箱炮塔 (四号/黑豹): 直壁 + 前斜板 + 尾舱
const bx=new THREE.Mesh(new THREE.BoxGeometry(tw,th,tl),mat); bx.position.y=th/2; G.add(bx);
const fp=new THREE.Mesh(new THREE.BoxGeometry(tw*0.96,th*0.55,0.42*ts),mat);
fp.rotation.x=-0.30; fp.position.set(0,th*0.42,tl/2-0.06*ts); G.add(fp);
const rr=new THREE.Mesh(new THREE.BoxGeometry(tw*0.90,th*0.44,0.34*ts),mat); rr.position.set(0,th*0.30,-tl/2-0.12*ts); G.add(rr);
}
const cupH2=S.cupH*ts;                         // 指挥塔随炮塔缩放 (半径与高度同档)
const cupR=Math.max(0.20,Math.min(0.34,S.cupH*1.3))*ts;
const cup=new THREE.Mesh(new THREE.CylinderGeometry(cupR,cupR,cupH2,10),mat);
cup.position.set(tw*0.22,th+cupH2*0.5-0.02,-tl*0.24); G.add(cup);
T.pitchG=new THREE.Group();
T.pitchG.position.set(0,TB_AXIS-S.ringY,S.pitchZ); // 炮轴恒锁 TB_AXIS (对齐 update() 硬编码的 muzzle y=1.93)
G.add(T.pitchG);
const mh=Math.max(0.46,t.h*0.78)*ts;           // 炮盾随炮塔缩放 (高度/宽度/厚度同档)
if(t.shape==='round'&&S.shape==='sherman'){ // 谢尔曼/潘兴的铸造圆炮盾 (与方炮盾区分剪影)
const mm=new THREE.Mesh(new THREE.CylinderGeometry(mh*0.5,mh*0.5,0.44*ts,12),M.dark);
mm.rotation.x=HPI; T.pitchG.add(mm);
}else{
const mm=new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.62,t.w*0.40)*ts,mh,0.44*ts),mat); T.pitchG.add(mm);
}
const barR=S.barR*ts;                          // A#6: 炮管**半径**随分级缩放, 长度 barrelL 不缩放
const bar=new THREE.Mesh(new THREE.CylinderGeometry(barR*0.78,barR,S.barrelL,8),M.dark);
bar.position.set(0,0.02,S.barrelL/2); bar.rotation.x=HPI; T.pitchG.add(bar);
T.barrelMesh=bar; // 供探针量"炮口预留点 vs 管口"对位 (dev/verify-vehmodels.js)
if(S.brake){ const mb=new THREE.Mesh(new THREE.CylinderGeometry(barR*1.45,barR*1.45,0.42,8),M.dark);
mb.position.set(0,0.02,S.barrelL-0.12); mb.rotation.x=HPI; T.pitchG.add(mb); }
const coax=new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.05,0.9,6),M.dark);
coax.position.set(Math.min(0.42,tw*0.24),-0.05,0.7); coax.rotation.x=HPI; T.pitchG.add(coax);
T.barrelTip=S.barrelTip; // 炮口预留点 (车体局部系; 与旧口径一致: 管口外 0.10m)
T.ringY=S.ringY; T.turretH=th; // 2026-09-26 B9: 供"残血冒烟"取塔顶高度 (旧版写死 pos.y+1.8 = 塔内)
}
// ═══════════ 载具机枪过热 (2026-09-21 A#3 契约 A) ═══════════
// 对象: 坦克同轴机枪 (Tank.firePlayerMG / turretAI 的 MG 分支) + 艇载机枪与副武器 (15d-naval 的 fireMG/fireSecondary)。
// 排除: 幽灵坦克 (15c-specveh) —— 不积热、不显示条。
// 数值全部读 00-config 的 VEH_MG_HEAT (单源, 与固定 MG42 同档: heatPS 0.014 ⇒ 约 71 发到 1.0 过热锁;
//   玩家 coolPlayer 0.22/s 且**开火时不散** (与 20a-seats 的 MG 口径逐字一致); AI coolAI 0.15/s **常散**
//   (与 14-bots 的 MG 口径逐字一致); 过热后必须散到 unlock(0.35) 才解锁 —— 滞回, 防 1 发 1 停抖动)。
// 为什么"firing"用本帧开火请求而不是读按键: 20a-seats 只在本车可开火时调 firePlayerMG (冷却中也会每帧调),
//   故"开火入口本帧被调用" ≡ 扳机按住, 与 MG42 的 mouseDown 口径等价; 标志 vehMgTrigger 由各载具 update() 每帧消费。
// 三个函数是全库唯一一份实现 (15d-naval 直接调用, 禁止各写一份)。
function vehMgHeatTick(v,dt,firing,isPlayer){
const C=VEH_MG_HEAT;
const cool=isPlayer?C.coolPlayer:C.coolAI;
// 玩家: 开火时不散热; AI: 常散 (与既有 MG42 口径逐字一致)
if(!(isPlayer&&firing)) v.heat=Math.max(0,v.heat-dt*cool);
if(v.heatLock&&v.heat<=C.unlock) v.heatLock=false;
if(v.heat>=1&&!v.heatLock){ v.heatLock=true; /* 过热提示音由玩家侧出 (契约 A 的 HUD 条款) */ }
}
function vehMgHeatAdd(v){ v.heat=Math.min(1.2,v.heat+VEH_MG_HEAT.heatPS); if(v.heat>=1) v.heatLock=true; }
function vehMgCanFire(v){ return !v.heatLock&&v.heat<1; }
// 开火入口第一行调用 (必须早于冷却早退): 记录"本帧有开火请求" ⇒ 玩家按住扳机时 update() 不散热
function vehMgTrigger(v){ v.mgTrig=true; }
// ═══════════ 三人车组 · 名额结算 (2026-09-21 A#7 契约 §4 v3) ═══════════
// 车组 = 1 名**真人驾驶员** (crewBot / 玩家, 唯一跑 AI 且唯一有死亡链) + 2 个**轻量乘员名额** (Tank.crewSlots)。
// 为什么名额不是 Bot (Lead 2026-09-21 用户二次裁定): 各图 tankN 是 2~8 而 BOTS_PER_TEAM=11 —— 每车真配 3 名 Bot
//   会让一队从 11 人涨到 21 人 (斯大林格勒 14→30), 属于用户未要求的平衡破坏。名额因此**不进 soldiers/combatants**
//   (进去会被索敌、被子弹命中、被主循环更新), 只是记账记录 (v2 的 crewMates 真 Bot 编制作废)。
// 名额没有死亡链 ⇒ 由本函数汇总结算 1 死 / 1 票 / 击杀者 +1 杀; 玩家击杀走 onPlayerKill 单源 (不双计)。
function settleCrewSlotDeath(s,attacker,team){
if(!s||!s.alive) return;
s.alive=false; s.deaths=(s.deaths||0)+1;
tickets[team]=Math.max(0,tickets[team]-CREW_TICKET_EACH);
if(attacker){
attacker.kills=(attacker.kills||0)+CREW_KILL_EACH;
if(!attacker.isPlayer) attacker.score=(attacker.score||0)+SCORE_TABLE.kill;
else if(typeof onPlayerKill==='function') onPlayerKill(s,false); // 玩家记分唯一入口 (21-match): 走名额不双计
}
}
class Tank {
constructor(team,variant){
this.kind='tank';
this.team=team; this.variant=variant||0;
this.def=TEAM_FACTION[team].tanks[this.variant];
this.name=this.def.name;
// 碾压伤害分档 (2026-11-03 用户裁定, 常量单源 00-config): 日系 chiha 形 (九七式/一式+缴获两版) 80, 其余坦克 99
// —— 旧 320 一击必杀; 幸存者走 vehiclePushSoldiers 侧向挤开 + TANK_CRUSH_CD 宽限 (防连续碾每帧结算)。
this.crushDmg=(this.def.tk&&this.def.tk.shape==='chiha')?TANK_CRUSH_DMG_CHIHA:TANK_CRUSH_DMG;
this.hp=this.def.hp; this.maxHp=this.def.hp; this.alive=true;
this.pos=V3(); this.yaw=0; this.turretYaw=0; this.turretPitch=0; this.vel=0;
this.playerDriven=false; this.isAI=true;
this.crew={ name:this.name, team, kills:0, deaths:0, score:0, isPlayer:false, isCrew:true, pos:this.pos, alive:true, lastFiredT:-99, damage(){}, vel:V3() };
// A#7 v3 (2026-09-21 契约 §4): 三人车组 = 1 名真人驾驶员 (crewBot / 玩家, 唯一跑 AI) + 2 个**轻量乘员名额**。
// 名额是记账记录 (不进 soldiers/combatants ⇒ 不被索敌/不被子弹命中/不占 BOTS_PER_TEAM 编制), 车毁时由
// settleCrewSlotDeath 汇总结算。玩家上车仍走既有 crewBot.dismountVehicle 归建路径 ⇒ 车内 = 玩家 + 2 名额 = 3。
this.crewSlots=[{name:'乘员甲',deaths:0,kills:0,score:0,alive:true,isCrew:true,damage(){}},
                {name:'乘员乙',deaths:0,kills:0,score:0,alive:true,isCrew:true,damage(){}}];
this.cannonCd=0; this.mgT=0; this.mgBurst=0; this.mgPause=0;
// A#3 载具机枪过热 (契约 A): 0..1 热量 + 过热强制停火锁; mgTrig = 本帧是否有开火请求 (开火入口置位, update 消费)
this.heat=0; this.heatLock=false; this.mgTrig=false;
this.objective=null; this.thinkCD=0; this.stuckT=0; this.lastPos=V3(); this.smokeT=0;
this.path=null; this.pathI=0; this.repathT=0; this.reverseT=0; this.progT=0;
this.suspP=0; this.suspR=0; this.suspPV=0; this.suspRV=0; this.lastVel=0; this.wreckBs=null;
this.tTarget=null; this.tMemT=0; this.threatYaw=null;
this.respawnT=0; this.wheels=[];
this.buildMesh();
this.muzzle=V3();
this.engine=AudioSys.createEngine('tank');
tanks.push(this);
this.respawn(true,true); // 开局首次生成不播报 (initial=true: 恒走主基地, 厂房产能只作用于战损重生)
}
buildMesh(){
const D=this.def, S=tkSpec(D,D.tk); // 剪影规格 (00-config FACTIONS[...].tanks[i].tk, 单一数据源)
this.matBody=new THREE.MeshLambertMaterial({color:D.col, map:TEX.grime});
const matB=new THREE.MeshLambertMaterial({color:0x363830,map:TEX.metalBrush}); // B8/P3-12 负重轮/炮盾/炮管
this.matTone=new THREE.MeshLambertMaterial({color:D.colT!==undefined?D.colT:D.col, map:TEX.grime}); // 涂装分档第二色 (colT 既有键名保留)
const M={body:this.matBody, tone:this.matTone, dark:matB,
 accent:(S.colA!==undefined)?new THREE.MeshLambertMaterial({color:S.colA,map:TEX.grime}):null}; // camo 第三色
this.grp=new THREE.Group();
this.halfW=S.halfW; // 车体实际半宽 (翼板/裙板外沿, tkSpec 单源 = trkSx+trkW/2+0.06): 推力框口径, update() 用 (Lead 裁决②)
tankBuildHull(this,S,M);
tankBuildGear(this,S,M);
tankBuildTurret(this,S,M);
// 悬浮队色信标 (2026-10-24 用户指定: **敌方**倒三角/友方原正三角, 判据单源 00-config beaconInverted
// 与 16-aircraft 飞机信标同一判据): 只标"存活坦克" ——
// 击毁即隐 (update 按 alive 维护), 残骸不再被误认活车浪费弹药。depthTest=false 同飞机口径
// (烟尘/雾里可辨); 玩家第一人称车长镜隐藏 (同 pitchG 口径), 第三人称跟车保留。恒定世界尺寸,
// 位高 3.8m (底缘 2.6m > 最高车长帽顶 ~2.5m; 炮管仰角 20° 在信标半宽 1.2m 处 ~2.3m 亦让空)。
const bc=document.createElement('canvas'); bc.width=bc.height=64;
const bg=bc.getContext('2d');
bg.fillStyle='#'+(((TEAM_COL[this.team]>>>0).toString(16)).padStart(6,'0'));
bg.strokeStyle='#ffffff'; bg.lineWidth=7;
bg.beginPath();
if(beaconInverted(this.team)){ bg.moveTo(32,59); bg.lineTo(59,5); bg.lineTo(5,5); } // 敌方: 倒三角 (顶边在上, 尖朝下)
else{ bg.moveTo(32,5); bg.lineTo(59,57); bg.lineTo(5,57); }                        // 友方: 原正三角 (尖朝上)
bg.closePath();
bg.fill(); bg.stroke();
this.beaconMat=new THREE.SpriteMaterial({map:new THREE.CanvasTexture(bc),transparent:true,depthTest:false,depthWrite:false});
this.beacon=new THREE.Sprite(this.beaconMat);
this.beacon.scale.set(2.4,2.4,1);
this.beacon.position.set(0,3.8,0);
this.beacon.renderOrder=9;
this.grp.add(this.beacon);
this.grp.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
world.add(this.grp);
}
aimDir(){
const a=this.yaw+this.turretYaw, p=this.turretPitch;
return V3(Math.sin(a)*Math.cos(p),Math.sin(p),Math.cos(a)*Math.cos(p));
}
coaxMuzzle(){
const a=this.yaw+this.turretYaw;
const sn=Math.sin(a),cs=Math.cos(a);
return V3(this.pos.x+cs*0.42+sn*2.2,this.pos.y+1.88,this.pos.z-sn*0.42+cs*2.2); // 前向 2.2 与视觉管口对齐 (P2-20: 旧 1.25 缩在管中)
}
// A#7 v3 只读: 车内实际在编的乘员 = 驾驶员 (crewBot / 玩家) + 2 个名额; **空车返回 []**。
// sea-hud 的 #vehHpNum 读它显示 " · 乘员 ×N" (有车组时恒 3)。
crewRoster(){
const drv=this.playerDriven?(player.alive?player:null):(this.crewBot||null);
if(!drv) return [];
return [drv].concat(this.crewSlots?this.crewSlots.filter(Boolean):[]);
}
// A#7 v3: 名额成立的前提 = 驾驶员在场 (与 crewRoster 同一口径); 空车 0
crewSlotsAlive(){
const drv=this.playerDriven?(player.alive?player:null):(this.crewBot||null);
if(!drv) return 0;
return this.crewSlots?this.crewSlots.filter(s=>s&&s.alive!==false).length:0;
}
update(dt){
// 炮管可见性单点维护: 仅玩家乘本车且开车长镜(炮手镜)时隐藏防穿模, 其余状态(下车/第三人称跟车/残骸)一律恢复
// (旧实现只在 20-player 相机分支里切 visible, 下车后无人恢复 → 车外看坦克光秃秃没炮管)
this.pitchG.visible=!(this.playerDriven&&player.tankView);
// 信标显隐+脉动 (update 早退也先走到这行 ⇒ 死车/沉没/重生全覆盖, 无需 die/respawn 各补一份):
// 存活才显示; 玩家开本车且第一人称车长镜时隐藏 (与 pitchG 同判据)。脉动相位与飞机信标同式。
if(this.beacon){
this.beacon.visible=this.alive&&!(this.playerDriven&&player.tankView);
this.beaconMat.opacity=0.6+0.4*Math.sin(nowT*2.6+this.team*2.3);
}
	if(!this.alive){
	this.respawnT-=dt*tankRespawnMul(this.team); // 厂房在手: 苏军坦克重生倒计时倍速消耗 (22~29s)
	this.engine.update(0,0);
	// 兵力票归零 → 该队坦克封重生 (清场阶段敌方不再补充载具, 2026-09-04)
	if(this.respawnT<=0&&!matchOver&&tickets[this.team]>0) this.respawn();
	return;
	}
	this.cannonCd-=dt; this.mgT-=dt; this.mgPause-=dt;
// A#3 载具机枪过热 (契约 A): 每帧推进散热/解锁 (玩家 0.22/s 且开火不散 / AI 0.15/s 常散);
// firing = 本帧是否有开火请求 (firePlayerMG / turretAI 的 MG 分支置位) —— 消费式, 消费后本帧不再算开火。
vehMgHeatTick(this,dt,this.mgTrig,this.playerDriven);
this.mgTrig=false;
	// 深谷激流: 坦克误入河道即熄火受淹 (AI寻路只会走大桥)
	if(inRiverChannel(this.pos.x,this.pos.z)){
	this.vel=dampF(this.vel,0,5,dt);
	this.takeDmg(VEH_RAPIDS_DMG*dt,null,true); // 激流属于环境惩罚, 不享受装甲减免
	if(this.playerDriven&&Math.random()<dt*2) showScorePop('⚠ 激流熄火! 快倒车离开河道');
	}
	// 海面/深水 (2026-09-18 塔拉瓦批, 用户定案: 只减速受伤、不沉没销毁): 水深 >VEH_WATER_DEPTH 即进水熄火 ——
	// 速度按 dampF 快速归零 + 每秒 VEH_WATER_DMG 环境伤 (不享受装甲减免, 与激流同口径);
	// AI 坦克由 OCC 水障格 (occBlocked 记 2) 挡住不会开进海里, 只有玩家能开进去 (倒车可自救)
	if(waterDepthAt(this.pos.x,this.pos.z)>VEH_WATER_DEPTH){
	this.vel=dampF(this.vel,0,5,dt);
	this.takeDmg(VEH_WATER_DMG*dt,null,true);
	if(this.playerDriven&&Math.random()<dt*2) showScorePop('⚠ 涉水熄火! 快倒车离开水面');
	}
// 载具残血起火 (2026-11-09 批): 燃烧掉血账 —— 每秒烧 maxHp×VEH_BURN_FRAC/VEH_BURN_TIME, 自起火起
// VEH_BURN_TIME 秒内必烧至损毁 (直接扣 hp 不走 takeDmg: 不刷伤害红闪/不刷 lastDmgT/不叠装甲减免);
// 击杀归因 = 点燃者 burnBy。起火期正常受创照常结算 ("仍会正常受伤")。
if(this.burning&&this.alive){
this.hp-=this.maxHp*VEH_BURN_FRAC/VEH_BURN_TIME*dt;
// ★2026-11-10 修"烧毁瞬间整车模型位置漂移一次" (实机报告): 烧死必须在 update 中段就地停帧 ——
// die() 会当场注册 3 个自身残骸碰撞盒 (下方车毁段 registerDynCollider), 若继续走完本帧,
// 底盘碰撞段的三圆 (±1.95, r1.55) 圆心正落在自己刚注册的残骸盒内 ⇒ "圆心在盒内沿最浅轴整体
// 顶出"分支把车体从自己的残骸里推出去 (双 pass 累计可位移 2m+) = 损毁瞬间整车漂移一次。
// 中弹死亡的 die() 发生在 update 之外 (之后不再走车体碰撞段) 所以从不漂移 —— 只有 update
// 内段杀车 (燃烧/激流/涉水) 会踩中。与 15b-trucks/15d-naval 燃烧账同款 return (那两处落地时
// 就带, 坦克漏了)。
if(this.hp<=0){ this.die(this.burnBy||null); return; }
}
// 激流/涉水两处 takeDmg 同样能在 update 中段触发 die() —— 同一漂移病根, 死亡当帧一并停帧。
// (能在这里看到 !alive 的必是本帧刚死的: 顶部死车分支早退, 活车不受影响)
if(!this.alive) return;
// 无人闲置的坦克脱战后缓慢检修回血, 修到40%以上AI步兵才会重新接管 (2026-11-09 批: 起火中一律停修 —— 烧毁不可逆)
if(!this.playerDriven&&!this.crewBot&&!this.burning&&this.hp<this.maxHp&&nowT-(this.lastDmgT||-99)>10){
this.hp=Math.min(this.maxHp,this.hp+this.maxHp*0.025*dt);
}
// 扒车统计 (2026-10-07d, 丧尸模式): 每帧重算挂在身上的丧尸数 —— 驱动履带卡尸减速 (下方 mvx 段)。
if(typeof ZOMBIE_MODE!=='undefined'&&ZOMBIE_MODE&&typeof ZOMBIES!=='undefined'&&ZOMBIES.length){
let _zn=0;
for(let _zi=0;_zi<ZOMBIES.length;_zi++){ const _z=ZOMBIES[_zi]; if(_z.alive&&_z.clingVeh===this) _zn++; }
this._zClingN=_zn;
} else if(this._zClingN) this._zClingN=0;
const dCam=this.pos.distanceTo(camera.position);
this.engine.update(58+Math.abs(this.vel)*7, clamp(0.3-dCam/110,0,0.3)*(0.55+Math.abs(this.vel)*0.08));
// A#7 (2026-09-21): 删除"乘员严重受损(<25% hp)时弃车逃生" —— 车组全程在车内 (用户裁定"严格三人"),
// 车毁才结算死亡; 卡住/重伤仍走倒车+重寻路自救 (见 driveAI 的进度式卡住检测)。
// 车组 AI: 先过"敌车感知→交战决策"层 (2026-09-20 I1), 再驾驶/炮塔 —— 停车观察与反应延迟需同帧生效
if(this.crewBot&&this.crewBot.alive&&!this.playerDriven){ this.tankPerceive(dt); this.driveAI(dt); this.turretAI(dt); }
else if(!this.playerDriven){ this.vel=dampF(this.vel,0,4,dt); }
const sn=Math.sin(this.yaw), cs=Math.cos(this.yaw);
// 坡度物理 (2026-09-12 百团改版, 全战役生效): 上坡 30°起渐进减速, TANK_SLOPE_MAX(70°)以上封死(等高线滑移);
// 下坡永不硬封、只走减速带 —— 这是防卡死阀门: 对称封坡时, 凸形崖壁上"最后一步中点坡度≤限值但落点局部
// 坡度>限值", 倒车第一步中点坡度更大 → 进退不得。下坡放行后: 直壁下崖=单向慢爬 (沟壑=史实反坦克壕,
// 下去就得出坡道/渡口), AI 坦克由 OCC 沟壁占用格挡住不会下崖。
let mvx=sn*this.vel*dt, mvz=cs*this.vel*dt;
// 履带卡尸 (2026-10-07d): 挂车丧尸 ≥2 只减速 22% / ≥4 只 45% —— 被围的坦克想跑也得先挣脱。
// 对玩家驾驶同样生效 (AI/玩家同车物理); 碾压清尸后 _zClingN 归零自动恢复。
if(this._zClingN>=4){ mvx*=0.55; mvz*=0.55; }
else if(this._zClingN>=2){ mvx*=0.78; mvz*=0.78; }
{
const dist=Math.hypot(mvx,mvz);
if(dist>1e-5){
const h0=heightAt(this.pos.x,this.pos.z), h1=heightAt(this.pos.x+mvx,this.pos.z+mvz);
const dh1=h1-h0;
const sl=Math.abs(dh1)/dist, lim=Math.tan(TANK_SLOPE_MAX*DEG);
if(dh1>0&&sl>lim){
const gx=heightAt(this.pos.x+2,this.pos.z)-heightAt(this.pos.x-2,this.pos.z);
const gz=heightAt(this.pos.x,this.pos.z+2)-heightAt(this.pos.x,this.pos.z-2);
const gl=Math.hypot(gx,gz);
if(gl>1e-4){
const cx2=-gz/gl, cz2=gx/gl, t2=(mvx*cx2+mvz*cz2)*0.9;
mvx=cx2*t2; mvz=cz2*t2;
}else{ mvx=0; mvz=0; }
this.vel*=0.55;
}else if(sl>Math.tan(30*DEG)){
// 30°→70° 减速至 30%; 下坡超过 70° 时公式会外推出负系数(=不动点冻结), 故钳 12% 爬行挡下限
const f=Math.max(0.12,1-(sl-Math.tan(30*DEG))/(lim-Math.tan(30*DEG))*0.7);
mvx*=f; mvz*=f;
}
}
}
this.pos.x+=mvx; this.pos.z+=mvz;
	// 底盘对齐碰撞: 沿车体轴线三个圆, 两遍推挤解算减少楔入卡死;
	// 按撞击法线与行进方向的夹角保留车速: 直撞重挫, 斜擦可贴墙滑行
	// (旧实现任意接触 vel*=0.5, 轻微擦碰就降到爬行, 极易进退两难)
	let hitObstacle=false;
	for(let pass=0;pass<2;pass++){
	for(const off of [-1.95,0,1.95]){
	const cxp=this.pos.x+sn*off, czp=this.pos.z+cs*off;
	// 2026-09-06 B5/P0-2: 全量扫描改 RGRID 邻近候选 (推挤测试半径 1.55, 查询余量至 1.56)
	eachBoxNear(cxp-1.56,czp-1.56,cxp+1.56,czp+1.56,b=>{
	if(b.dead||this.pos.y+2<b.minY||this.pos.y>b.maxY) return;
	if(b.maxY-b.gh<0.7) return;
	const cx=clamp(cxp,b.minX,b.maxX), cz=clamp(czp,b.minZ,b.maxZ);
	const dx=cxp-cx, dz=czp-cz;
	const d2=dx*dx+dz*dz;
		if(d2>=1.55*1.55) return;
		// 2026-09-27N (A2/B4): 撞塌可毁墙体由"到速即整组销毁"改成**按动量扣血 + 正撞门限 + 冷却**。
		//   旧版任意接触只要 |vel|>1.9 (≈6.8 km/h) 就把整组 (含 202 盒的 10.6m 楼段) 当场销毁,
		//   既绕过 hp 也不经 destroyStructure 的得分归属 ⇒ 侧擦/轻推照样拆楼且不计分。
		//   判定需要法线 (车是否真的正对着墙), 故放在下面算出 pnx/pnz 之后。
		const ramG=(b.dGroup&&!b.dGroup.dead)?b.dGroup:null;
		// 2026-09-02 越野碾压: 掩体(沙袋/木箱/石墙/树篱/倒木, 挂牌 crush)车速足够时直接碾毁通过, 不再被阻拦
		if(b.crush&&Math.abs(this.vel)>1.5){
	crushCoverBox(b);
	this.vel*=0.92;
	this.suspPV-=Math.sign(this.vel)*0.25;
	if(this.playerDriven) addTrauma(0.12);
	return;
	}
	// 2026-09-04 越野跨越: 低矮且无法摧毁的障碍(自身高度≤1.3m: 顶面相对其地面, 无 dGroup 可撞塌/无 crush 可碾毁)
	// 直接放行不阻挡不碾毁, 底盘高度由 tankRideH 抬升作出爬越效果
	if(!b.dGroup&&!b.crush&&b.maxY-b.gh<=TANK_STEP) return;
	let pnx=0, pnz=0;
	if(d2>1e-8){
	const d=Math.sqrt(d2);
	pnx=dx/d; pnz=dz/d;
	const push=Math.min(0.35,(1.55-d)/d); // 推挤限幅: 防深穿一帧瞬移再撞别处
	this.pos.x+=dx*push; this.pos.z+=dz*push;
	} else {
	// 圆心已进入盒内: 沿穿透最浅轴整体顶出, 防楔死原地
	const l=Math.min(cxp-b.minX,b.maxX-cxp), r2=Math.min(czp-b.minZ,b.maxZ-czp);
	if(l<r2){ pnx=(cxp-b.minX<b.maxX-cxp)?-1:1; this.pos.x+=pnx*(l+1.55); }
	else { pnz=(czp-b.minZ<b.maxZ-czp)?-1:1; this.pos.z+=pnz*(r2+1.55); }
	}
		if(pass===0){
		const mvX=sn*Math.sign(this.vel), mvZ=cs*Math.sign(this.vel);
		const facing=-(pnx*mvX+pnz*mvZ);
		// ★ A2/B4: 正面全速撞 → 按动量扣血 (走 damageStructureBy = 与炮弹同一套账: 记分归属/受损档/坍塌链)。
		//   侧面擦挂 (facing<face) 与低速接触不再拆楼, 退化成下面的弹性推挤 (被墙挡住 + 掉速)。
		if(ramG&&Math.abs(this.vel)>=STRUCT_RAM.minSpeed&&facing>=STRUCT_RAM.face&&nowT-(this._ramT||-99)>=STRUCT_RAM.cd){
		this._ramT=nowT;
		damageStructureBy(ramG,STRUCT_RAM.k*this.vel*this.vel,this.playerDriven?player:(this.crewBot||this.crew),
		{x:(b.minX+b.maxX)/2,y:(b.minY+b.maxY)/2,z:(b.minZ+b.maxZ)/2});
		this.vel*=STRUCT_RAM.velAbsorb;
		this.suspPV-=Math.sign(this.vel)*0.9;
		if(this.playerDriven) addTrauma(0.28);
		return;
		}
		this.vel*=facing>0.5?0.35:facing>0.15?0.66:0.92;
		}
	hitObstacle=true;
	});
	eachCylNear(cxp-3.7,czp-3.7,cxp+3.7,czp+3.7,c=>{
	if(c.r<0.3) return;
	// 2026-09-04 越野跨越: 低矮圆柱(油桶/石碾/碎石堆等不可摧毁, 自身高度≤1.3m)直接驶过, 高度由 tankRideH 承接
	if(c.y1-c.y0<=TANK_STEP) return;
	const dx=cxp-c.x, dz=czp-c.z;
	const rr=c.r+1.5, d2=dx*dx+dz*dz;
	if(d2<rr*rr&&d2>1e-8){
	const d=Math.sqrt(d2), push=Math.min(0.3,(rr-d)/d*0.6);
	this.pos.x+=dx*push; this.pos.z+=dz*push;
	this.vel*=0.75;
	hitObstacle=true;
	}
	});
	}
	}
if(hitObstacle&&this.isAI) this.stuckT+=dt*2.2;
// 坦克↔坦克车体分离/推挤 (2026-09-20 I1 用户: "坦克彼此穿模"): 旧内联块用 4.6m 单圆一视同仁,
// 5.8m 长的车体仍会互相穿插 —— 换成 vehiclePushTanks (三圆近似车体, 见文件上方单源函数)
vehiclePushTanks(this,dt);
const lim=MAP_SIZE/2+6;
this.pos.x=clamp(this.pos.x,-lim,lim); this.pos.z=clamp(this.pos.z,-lim,lim);
// 碾平铁丝网
if(Math.abs(this.vel)>0.8&&wires.length){
for(let wi=wires.length-1;wi>=0;wi--){
const w=wires[wi];
const dxw=w.x-this.pos.x, dzw=w.z-this.pos.z;
if(dxw*dxw+dzw*dzw<2.8*2.8){
if(!w.alive) continue;                            // 已碾过的: 条目还在表里 (见下), 别重复刷土花
// ★2026-09-26 修: 旧版这里 `wires.splice(wi,1)` 直接删条目 —— 而 23b-worldrestore 的重开复位是
// "就地截断"式 (前提是"表只增不减"), 被碾掉的铁丝网因此**永久消失**: 快照恢复把桩/弦模型加回世界,
// wires 表里却再没有它 —— 一段既碾不烂也不再减速伤兵的摆设, 且每一局都在累积。
// 改成保留条目 + `alive=false` (记录里本就有这个字段) + 模型隐藏, 由 23b 的复位置回 alive/显回模型,
// 与 PROPS·coverPoints 同口径。三处读表处 (03-terrain buildOccupancy / 06-engineering isWire / 这里的碾平循环)
// 同步跳过 !alive。
w.alive=false;
if(w.grp) w.grp.visible=false;
for(let k=0;k<3;k++) spawnP(PT.dirt,w.x+rand(-1,1),heightAt(w.x,w.z)+0.3,w.z+rand(-1,1),rand(-1,1),rand(0.5,1.2),rand(-1,1),rand(0.25,0.4),0.6,rand(0.4,0.7),0.8,2);
markNavDirty();
}
}
}
// 底盘高度: 地面与可跨越障碍顶面的较高者 (2026-09-04 越野跨越)
this.pos.y=dampF(this.pos.y,tankRideH(this.pos.x,this.pos.z,this.pos.y),8,dt);
// 碾压植被: 行进中撞上树顺势撞倒 (倒向车头方向), 灌木直接碾没 (见 04b-fire)
if(Math.abs(this.vel)>0.8&&typeof floraCrushTank==='function') floraCrushTank(this);
// 实体碰撞: 步兵无法穿入车体; 友军挤开, 敌军按行进方向与车速判定碾压
// 2026-09-20 I2-b (Lead 裁决②): 横向口径按车体实际半宽派生 (this.halfW 由 buildMesh 从 tkSpec 单源算出), 以既有 2.05 为下限 ——
// 除最宽的 M26(2.055) 外各型仍取 2.05 (推挤手感不变); vehiclePushSoldiers 函数体不动 (坦克/卡车共用单源)
{const _o=_vpsOpts; _o.dt=dt; _o.crusher=this.playerDriven?player:(this.crewBot||this.crew); _o.moving=Math.abs(this.vel)>1.2; _o.yMax=1.9; _o.frontalBand=1.5; _o.symmetricFrontal=false; _o.crushDmg=this.crushDmg; _o.pushVel=Math.abs(this.vel); _o.checkSpectator=false;
vehiclePushSoldiers(this,Math.max(2.05,this.halfW||2.05),this.def.hullL/2+0.45,_o);}
// 履带花纹滚动 (2026-09-26 A5 定速率; 2026-09-28 带环口径取符号): 带环外表面的花纹 v 沿**环向**排开、
// 每贴 = trackTileLen 米世界长 ⇒ 位移量除以每贴长度就是"贴/秒", 与地面零打滑 (旧版 `offset.y-=vel*dt*0.55`
// 是估的, 差 ~20%)。**符号**: v 沿带环的**材料流向**递增 (接地段向后 / 回程段向前 / 后端向上 / 前端向下),
// 前进时花纹整体沿材料流向走 ⇒ offset 必须**减小** (加号会让接地段花纹朝前跑 = 倒转)。
this.trackTex.offset.y-=this.vel*dt/(this.trackTileLen||1.5);
// 2026-09-20 I2-b (Lead 裁决①): 滚动速率按车轮几何实际半径 —— 数据单源兑现 (旧硬编码 0.36 使 T-34 r0.42 视觉慢约 14%);
// 只影响视觉滚动速率, 不碰 pos/命中/推挤; 参数取不到时回退 0.36
for(const wh of this.wheels){ const wr=(wh.geometry&&wh.geometry.parameters&&wh.geometry.parameters.radiusTop)||0.36; wh.rotation.x+=this.vel*dt/wr; }
// 悬挂: 地形姿态 + 加减速俯仰弹簧 (采样面含可跨越障碍顶面 → 跨越时前后轮先后抬落, 车体俯仰颠簸)
const sn2=Math.sin(this.yaw), cs2=Math.cos(this.yaw);
const hF=tankSurfH(this.pos.x+sn2*2.4,this.pos.z+cs2*2.4), hB=tankSurfH(this.pos.x-sn2*2.4,this.pos.z-cs2*2.4);
// 左侧采样: (-cs,+sn) 垂直于行进方向
const hL=tankSurfH(this.pos.x-cs2*1.6,this.pos.z+sn2*1.6), hR=tankSurfH(this.pos.x+cs2*1.6,this.pos.z-sn2*1.6);
const accel=(this.vel-this.lastVel)/Math.max(dt,0.001); this.lastVel=this.vel;
const tgtP=-Math.atan2(hF-hB,4.8)-clamp(accel*0.011,-0.09,0.09);
const tgtR=Math.atan2(hR-hL,3.2);
this.suspPV+=((tgtP-this.suspP)*46-this.suspPV*7.5)*dt;
this.suspP+=this.suspPV*dt;
this.suspRV+=((tgtR-this.suspR)*46-this.suspRV*7.5)*dt;
this.suspR+=this.suspRV*dt;
// 每个路轮独立行程: 采样各自地面高度, 弹簧上下浮动
for(const wh of this.wheels){
const ud=wh.userData;
const wx=this.pos.x+sn2*ud.lz+cs2*ud.sx;
const wz=this.pos.z+cs2*ud.lz-sn2*ud.sx;
const wgh=tankSurfH(wx,wz);
const hullY=this.pos.y-this.suspP*ud.lz+this.suspR*ud.sx;
const tgtY=ud.baseY+clamp(wgh-hullY,-0.17,0.17);
ud.vy+=((tgtY-wh.position.y)*70-ud.vy*9)*dt;
wh.position.y+=ud.vy*dt;
}
this.grp.position.copy(this.pos);
this.grp.rotation.order='YXZ';
this.grp.rotation.set(this.suspP,this.yaw,this.suspR);
this.turretG.rotation.y=this.turretYaw;
this.pitchG.rotation.x=-this.turretPitch;
const dir=this.aimDir();
this.muzzle.set(this.pos.x+dir.x*this.barrelTip,this.pos.y+1.93+dir.y*this.barrelTip,this.pos.z+dir.z*this.barrelTip);
if(this.hp<this.maxHp*0.45){
this.smokeT-=dt;
if(this.smokeT<=0){ this.smokeT=0.12;
// 2026-09-26 B9 修: 冒烟口 = **塔顶** (座圈高 + 塔高), 旧版写死 pos.y+1.8 —— 小车的塔顶在 2.0~2.4m,
// 烟从塔体内部生成, 头几帧直接被塔网格挡住看不见 (等于"残血不冒烟")。
const sy=this.pos.y+(this.ringY||1.45)+(this.turretH||0.6)*0.92;
spawnP(PT.dark,this.pos.x+rand(-0.5,0.5),sy,this.pos.z+rand(-0.5,0.5),rand(-0.3,0.3),rand(1,2),rand(-0.3,0.3),0.7,1.4,rand(0.8,1.4),0.7,0.2);
}
}
}
// ── 敌车感知层 (2026-09-20 I1): 视野距离×DIFF_TABLE.visMul + 前向视锥 + raycastWorld LOS ──
// 不穿墙索敌: 射线被地形/建筑挡住 (raycastWorld 含地形采样) 或穿烟幕/高杆庄稼 ⇒ 这一轮看不见;
// 车长视点 = 车顶 1.9m, 目标取对方车体中心 +1.3m. 全量扫描按 TANK_PER_T≈7Hz 节流 —— 车长观察不需要每帧扫全场.
// 交战决策也在这里: 首次发现某辆车 → 反应延迟 (新兵长/精英短, DIFF_TABLE.react 单源) + 停车观察
// (可选短倒车) + 清掉旧战术点; 目标丢失超记忆时长 → 释放 (记忆时长按难度分档).
tankPerceive(dt){
const T=tankAITune();
if(this.aiReact>0) this.aiReact-=dt;
if(this.aiHaltT>0) this.aiHaltT-=dt;
if(this.aiLeadT>0) this.aiLeadT-=dt;
else { this.aiLeadT=rand(1.4,2.8); this.aiLeadBias=rand(-1,1)*T.lead; } // 提前量误差: 每次重掷, 新兵±0.55s/老兵±0.30/精英±0.15
if(this.aiTacticT>0) this.aiTacticT-=dt;
const vt=this.tVehTgt;
if(vt&&(!vt.alive||vt.team===this.team)){ this.tVehTgt=null; this.aiOrder=null; this.aiHaltT=0; this.tMemT=0; }
this.aiPerT-=dt;
if(this.aiPerT>0) return;
this.aiPerT=TANK_PER_T;
const ex=this.pos.x, ey=this.pos.y+1.9, ez=this.pos.z;
const face=this.yaw+this.turretYaw;
let best=null,bd=0,bs=-1e9;
// 候选评分 (单源: 坦克/卡车/海战载具共用这一支 —— 视野距离/前向视锥/LOS/烟幕/庄稼/植被/粘滞/残血加分全部同规)
const score=(t,ty,lowHp)=>{
const dx=t.pos.x-ex, dz=t.pos.z-ez;
const d=Math.hypot(dx,dz);
// 环境暗度动态暴露度联动: 载具大灯照亮路面也暴露自身 (暴雨天/夜间开灯强光暴露)
let vis=T.vis*(NIGHT_MODE?NIGHT_CFG.viewDMul:1)*WX_CFG.viewDMul;
const envLum=(typeof getEnvBrightness==='function')?getEnvBrightness():(NIGHT_MODE?0.12:1.0);
const darkRatio=clamp(1.0-envLum,0,1);
let lightExposed=false;
if(t.lightsOn){
const hExpo=(typeof NIGHT_GEAR!=='undefined'&&NIGHT_GEAR.headExpo)?NIGHT_GEAR.headExpo:1.8;
const expo=1.0+(hExpo-1.0)*(0.1+0.9*darkRatio);
vis*=expo;
if(darkRatio>0.2) lightExposed=true;
}
if(d>vis||d<1) return;
const bearing=Math.atan2(dx,dz);
const tracked=(this.tVehTgt===t&&this.tMemT>0);
// 前向视锥: 车体前向或炮塔指向任一覆盖即可; 记忆中的目标不再要求视锥; 强光暴露目标同样放宽
if(!tracked&&!lightExposed&&Math.abs(angDiff(this.yaw,bearing))>TANK_VIEW_CONE&&Math.abs(angDiff(face,bearing))>TANK_VIEW_CONE) return;
let hx=t.pos.x-ex, hy=ty-ey, hz=t.pos.z-ez;
const hl=Math.hypot(hx,hy,hz)||1; hx/=hl; hy/=hl; hz/=hl;
const hit=raycastWorld(V3(ex,ey,ez),V3(hx,hy,hz),hl);
if(hit&&hit.dist<hl-1.2) return;
if(SMOKES.length&&smokeBlocksLOS(ex,ey,ez,t.pos.x,ty,t.pos.z)) return;
if(CROP_FIELDS.length&&cropBlocksLOS(ex,ey,ez,t.pos.x,ty,t.pos.z)) return;
// 植被软遮蔽 (2026-09-20 I5 联动, 用户口径: 灌木/树冠挡视野但不挡子弹): 车长视线与步兵 perceive 同一套口径,
// 坦克同样看不穿灌丛 —— 纲领第2条"玩家与 Bot、各兵种同规则". 车长镜/潜望镜**不豁免** (Lead 2026-09-20 裁定:
// 豁免会造出"只有坦克能看穿草丛"的特例; 椰冠带本就是"地面平视从冠下穿过、塔顶才被挡"的高度带判定, 天然合理).
// typeof 守卫: 部分沙箱探针只加载子集文件, 缺这个可选模块不该让车组 AI 整段报错
// (与 14-bots.js 的 `typeof tankRollingToObjective==='function'` 同一纪律)
if(typeof foliageBlocksLOS==='function'&&foliageBlocksLOS(ex,ey,ez,t.pos.x,ty,t.pos.z)) return;
let sc=200-d*0.5;
// ★2026-10-26 指挥官交互重做批 (用户需求 3 集火): 车组也吃集火令 —— 判据单源在 26-commander 的
//   cmdFocusBonus (圈内顶到最前 / 圈外线性衰减); 本文件只加进候选分, 不重复实现半径/过期判断。
//   取令走 this.cmdOrder 所属的单位 (cmdOrbatBuild 把 unit.order 挂成 t.cmdOrder), 因此这里按 veh 反查。
//   cmdFocusBonus 缺失 (只加载 15-vehicles 的沙箱) ⇒ 0, 选目标逐位不变 = 零回归。
if(typeof cmdFocusBonus==='function'){
const _fu=(typeof cmdFindUnitOfVeh==='function')?cmdFindUnitOfVeh(this):null;
sc+=cmdFocusBonus(_fu,t.pos.x,t.pos.z);
}
if(lowHp) sc+=60;  // 残血敌车是"战机": 完整AI会抓 (追击意愿另受难度分档)
if(tracked) sc+=40;            // 目标粘滞: 不因另一辆稍微更近就来回换炮口
if(sc>bs){ bs=sc; best=t; bd=d; }
};
for(const t of tanks){
if(!t.alive||t.team===this.team||t===this) continue;
if(typeof specRide==='function'&&specRide(t)) continue;   // 观战者座驾不进车长候选 (2026-09-26H)
score(t,t.pos.y+1.3,t.hp<t.maxHp*0.35);
}
// ★2026-09-26 修 (P1-7 反向不通): 旧版只感知 tanks —— 而海战载具 (15d 的 navalCraft: 两栖车/鱼雷艇)
//   是**另一个数组**, 且它们的炮弹/子弹本来就能打坦克 (updateShells 的坦克块 + 13-combat 的子弹链)。
//   于是一辆停在滩头的坦克会被登陆艇一路打而不还手 (车组"看不见"艇)。现并入同一套候选与评分:
//   艇有 pos/alive/team/hp/maxHp/vel(标量)/yaw, 与坦克同构 ⇒ 打分/记忆/反应延迟/提前量全复用, 不另写一套。
if(typeof navalCraft!=='undefined'&&navalCraft.length){
for(const c of navalCraft){
if(!c||!c.alive||c.team===this.team) continue;
if(c.state==='wreck'||c.state==='sinking') continue;   // 已在沉没链上的不再当目标 (与 15f 的 pickTarget 同规)
if(typeof specRide==='function'&&specRide(c)) continue;   // 观战者座驾 (2026-09-26H)
score(c,c.pos.y+1.1,false);
}
}
if(best){
const isNew=(this.tVehTgt!==best);
this.tVehTgt=best; this.tVehDist=bd; this.tDist=bd; this.losOK=true;
if(!this.tLastPos) this.tLastPos=V3();
this.tLastPos.copy(best.pos); this.tLastSeenT=nowT;
this.tMemT=Math.max(this.tMemT||0,T.mem);
if(isNew){
// 交战决策: 反应延迟 (车长发现→口令→炮长就位) + 首次发现停车观察; 新兵最慢, 精英最快
// ★2026-10-06 难度批 (标准档): 目标是**玩家驾驶**的车时反应 ×1.3 —— 只削坦克对玩家, 车组互殴不变。
this.aiReact=T.react*(best.playerDriven?1.3:1)*rand(0.85,1.25);
this.aiHaltT=T.halt*rand(0.85,1.2);
this.aiRevT=T.rev*rand(0.8,1.3);
this.aiTacticT=0; this.aiOrder=null; this.aiCover=null;
this.aimReact=0; this.aiLeadT=0; this.aiLeadBias=rand(-1,1)*T.lead;
this.aiFlankSide=Math.random()<0.5?1:-1; // 绕侧方向记忆: 一次选边不左右换向
}
} else if(this.tVehTgt&&nowT-this.tLastSeenT>T.mem){
this.tVehTgt=null; this.aiOrder=null; // 记忆过期: 忘掉这辆车 (难度越低记忆越短)
}
}
// ── 起伏掩体选点 (2026-09-20 I1): 找"炮口能打到敌车、车体高度被地形挡住"的位置 = hull-down 射击位 ──
// 两条射线近似: 车体线 (地面+1.2m) 必须被地形/建筑挡住 (对方只看得见炮塔), 炮口线 (地面+1.93m) 必须通视 (还能还击);
// 候选 = 自身周围 8 方向 × 2 距离 (15/26m), 只在 OCC 未占用、非深水、可爬越的高差范围内取点; 制高点加分.
tankCoverPoint(eng){
const ex=eng.pos.x, ez=eng.pos.z, ey=eng.pos.y+1.3;
const h0=heightAt(this.pos.x,this.pos.z);
const lim=MAP_SIZE/2-4;
let best=null,bs=-1e9;
for(let k=0;k<8;k++){
const a=k/8*TAU+rand(-0.12,0.12);
for(const R of [15,26]){
const x=this.pos.x+Math.sin(a)*R, z=this.pos.z+Math.cos(a)*R;
if(x<-lim||x>lim||z<-lim||z>lim) continue;
if(occBlocked(x,z)) continue;                       // 建筑足迹/水障格不放
if(waterDepthAt(x,z)>VEH_WATER_DEPTH) continue;     // 别把自己开进水里
const gh=heightAt(x,z);
if(Math.abs(gh-h0)>4.5) continue;                   // 爬不上去的坎不进候选
const dx=ex-x, dz=ez-z, dh=Math.hypot(dx,dz);
if(dh<14) continue;
const hx=dx/dh, hz=dz/dh;
// 车体线最远只查到 100m: hull-down 要的是"我和敌车之间"的遮蔽, 更远的遮挡对本轮射击位没有意义,
// 截断顺便把这段地形步进射线的开销钉住 (每 1.8m 一次 heightAt)
const rl=Math.min(dh,100);
const low=raycastWorld(V3(x,gh+1.2,z),V3(hx,0,hz),rl);
if(!low||low.dist>rl-2) continue;                   // 车体线没被挡住 = 不是掩体
const vy=ey-(gh+1.93), vl=Math.hypot(dh,vy)||1;
const up=raycastWorld(V3(x,gh+1.93,z),V3(hx,vy/vl,hz),vl);
if(up&&up.dist<vl-1.5) continue;                    // 炮口线也被挡 = 打不到, 不是射击位
let sc=100-Math.hypot(x-this.pos.x,z-this.pos.z)-dh*0.25;
if(gh>h0+0.5) sc+=18;                               // 制高点: 俯视对射更有利 (利用地形起伏)
if(sc>bs){ bs=sc; best={x,z}; }
}
}
return best;
}
// ── 战术机动选点 (2026-09-20 I1): 返回本车下一步的战术点, null = 没有战术要求 (照旧推进/就地停车对射) ──
// 难度限权 (TANK_AI): 新兵 chase=0/flank=0/cover=0.1 —— 几乎只剩"太远就压上去"; 老兵半程; 精英全套.
// 每条分支都带"为什么": 完整AI要会抢起伏掩体、抓残血战机、必要时侧翼绕行, 但不能让三档一样强.
pickTankTactic(eng,ed){
const T=tankAITune();
const ex=eng.pos.x, ez=eng.pos.z;
// ① 火力距离之外 → 压上去 (新兵直线, 老兵/精英带侧偏: 不排成一条直线迎弹);
//    只压到"火力距离以内"就够, 不冲着脸顶上去 (顶上去会互相顶车, 也被对方炮口零距离打)
if(ed>T.fireR*0.92){
const R=Math.max(ed*0.55,10);
let a=Math.atan2(ex-this.pos.x,ez-this.pos.z);
if(T.flank>0&&Math.random()<T.flank*0.5) a+=this.aiFlankSide*rand(0.25,0.5);
return {x:this.pos.x+Math.sin(a)*R,z:this.pos.z+Math.cos(a)*R};
}
// ② 看不见敌车 (只有最后位置): 侧翼绕行 (新兵不绕侧, 只会照着最后位置直推)
// 判"看不见"用 tLastSeenT 而不是 losOK —— losOK 会被开火前的射线预检覆写, 语义是"这一炮打得着"
if(nowT-this.tLastSeenT>0.5&&this.tLastPos){
if(T.flank>0&&Math.random()<T.flank){
const a=Math.atan2(this.tLastPos.x-this.pos.x,this.tLastPos.z-this.pos.z)+this.aiFlankSide*rand(0.5,0.95);
const R=rand(28,46);
if(!occBlocked(this.tLastPos.x+Math.sin(a)*R,this.tLastPos.z+Math.cos(a)*R))
return {x:this.tLastPos.x+Math.sin(a)*R,z:this.tLastPos.z+Math.cos(a)*R};
}
return {x:this.tLastPos.x,z:this.tLastPos.z};
}
// ③ 追残血敌车 (完整AI的"抓战机"): 新兵 chase=0 永不追击
if(eng.hp<eng.maxHp*0.4&&ed>45&&Math.random()<T.chase){
const a=Math.atan2(ex-this.pos.x,ez-this.pos.z)+this.aiFlankSide*rand(-0.2,0.2);
const R=Math.min(ed*0.9,70); // 追到对方附近 (不进车体), 剩下的交给炮塔
return {x:this.pos.x+Math.sin(a)*R,z:this.pos.z+Math.cos(a)*R};
}
// ④ 抢掩体/利用起伏 (hull-down): 装填期或半血以下退进掩体; 其余时候按难度概率主动占射击位
if(T.cover>0.3&&ed>26){
const want=(this.cannonCd>this.def.reload*0.55||this.hp<this.maxHp*0.5||Math.random()<T.cover*0.5);
if(want){
if(!this.aiCover||Math.hypot(this.aiCover.x-this.pos.x,this.aiCover.z-this.pos.z)<3)
this.aiCover=this.tankCoverPoint(eng);
if(this.aiCover) return {x:this.aiCover.x,z:this.aiCover.z};
}
}
// ⑤ 贴身 (<22m): 拉开到 30m 外再对射 (被绕后风险); 新兵不后撤, 就地开炮
if(ed<22&&T.cover>0.3){
const a=Math.atan2(this.pos.x-ex,this.pos.z-ez);
return {x:this.pos.x+Math.sin(a)*12,z:this.pos.z+Math.cos(a)*12};
}
return null;
}
driveAI(dt){
this.thinkCD-=dt; this.repathT-=dt;
	if(this.thinkCD<=0){
	this.thinkCD=rand(0.6,0.9);
	// 指挥官坦克令 (2026-10-26 指挥官批, 26-commander cmdTankCmd 单源): 非 free 令直接覆写推进目标 ——
	// attack_move/hold 都 = 开往指定点 (坦克交战层战术机动在下方照常接管, 到点 engagedStop 静止对射口径不变);
	// free 令走下方默认选点 = 零回归。令解除时清 objective 让默认选点即刻重选。
	const _cto=(typeof cmdTankCmd==='function')?cmdTankCmd(this):null;
	if(_cto){
	this.objective={x:_cto.x,z:_cto.z};
	this._cmdHad=true;
	}else if(this._cmdHad){
	this._cmdHad=false;
	this.objective=null;
	}else if(typeof ZOMBIE_MODE!=='undefined'&&ZOMBIE_MODE){
// 丧尸守家 (2026-10-07d): 载具不跑旗 —— 驻守己方基地外环车位 (zVehPosts 单源 25-zombies),
// 到位停车、炮塔自由扫尸 (机枪候选本就含丧尸; 主炮对重尸的门在 turretAI)。teams 两队各自守家。
if(!this.objective||!this.objective._zv){
const posts=(typeof zVehPosts==='function')?zVehPosts(this.team):null;
let bp=null,bs=1e9;
if(posts) for(const p of posts){
const d=Math.hypot(p.x-this.pos.x,p.z-this.pos.z);
if(d<bs){ bs=d; bp=p; }
}
if(bp){ this.objective={x:bp.x,z:bp.z,_zv:true}; this.repathT=0; }
}
} else if(GAMEMODE==='demolition'){
const dp=nearestDepot(this.pos.x,this.pos.z);
const bf=dp?{x:dp.x,z:dp.z}:FLAGS[0];
if(!this.objective||this.objective.x!==bf.x){ this.objective=bf; this.repathT=0; }
} else if(GAMEMODE==='clash'){
// 遭遇战强点 (2026-09-13 草原库尔斯克改版): 坦克向最近的敌方强点/中立强点/敌基推进, 到位后原地炮战
if(!this.objective){
const cands=spawnPtsOf(1-this.team).map(s=>({x:s.x,z:s.z}));
if(typeof SPOTS!=='undefined') for(const s of SPOTS){ if(s.own===-1) cands.push({x:s.x,z:s.z}); }
const eb=BASES.length?BASES[1-this.team]:basePos(1-this.team);
cands.push({x:eb.x,z:eb.z});
let best=null,bd=1e9;
for(const c of cands){
const d=Math.hypot(c.x-this.pos.x,c.z-this.pos.z)+rand(0,50);
if(d<bd){ bd=d; best=c; }
}
this.objective=best?{x:best.x,z:best.z}:null;
this.repathT=0;
}
} else if(GAMEMODE==='convoy'){
// 劫道: 护运方坦克跟随车队 (劫道方无坦克)
const escT=(CAMPAIGN.convoy&&CAMPAIGN.convoy.escortTeam!==undefined)?CAMPAIGN.convoy.escortTeam:1;
if(this.team===escT){
let best=null,bd=1e9;
for(const t of trucks){
if(!t.alive) continue;
const d=Math.hypot(t.pos.x-this.pos.x,t.pos.z-this.pos.z);
if(d<bd){ bd=d; best=t; }
}
if(best){ this.objective={x:best.pos.x,z:best.pos.z}; this.repathT=0; }
}
} else {
const retreat=this.hp<this.maxHp*0.26;
let best=null,bs=-1e9;
for(const f of FLAGS){
let sc=-Math.hypot(f.x-this.pos.x,f.z-this.pos.z)*0.8;
if(retreat){ if(f.owner===this.team) sc+=200; }
else {
if(f.owner!==this.team) sc+=130;
if(f.owner===this.team&&f.capTeam!==-1&&f.capTeam!==this.team) sc+=220;
// 与友方坦克分散
for(const t2 of tanks){ if(t2!==this&&t2.alive&&t2.team===this.team&&t2.objective===f) sc-=90; }
}
sc+=rand(0,30);
if(sc>bs){ bs=sc; best=f; }
}
if(this.objective!==best){ this.objective=best; this.repathT=0; }
}
}
// ── 交战层战术机动 (2026-09-20 I1): 有敌车交战时用战术点替换推进目标, 其余时候照旧开向 objective ──
// 感知与决策在 tankPerceive 里出结果 (tVehTgt/aiHaltT/aiOrder), 这里只负责"把车开过去".
{
const eng=(this.tVehTgt&&this.tVehTgt.alive&&this.tVehTgt.team!==this.team)?this.tVehTgt:null;
if(eng){
// 首次发现先停车观察 (可选短倒车缩回车头): "站定再打" —— 行进间射击只留给高难度 (halt/rev 按难度分档)
if(this.aiHaltT>0){
this.path=null; this.progT=0; this.lastPos.copy(this.pos);
if(this.aiRevT>0){ this.aiRevT-=dt; this.vel=dampF(this.vel,-this.def.rev*0.55,3.5,dt); }
else this.vel=dampF(this.vel,0,5,dt);
return;
}
// 战术点每隔 2~4s 重评一次 (太勤会左右摇摆, 太懒则跟不上战况)
if(this.aiTacticT<=0){
this.aiTacticT=rand(2.2,3.6);
this.aiOrder=this.pickTankTactic(eng,Math.hypot(eng.pos.x-this.pos.x,eng.pos.z-this.pos.z));
}
} else if(this.aiOrder){ this.aiOrder=null; this.aiHaltT=0; } // 敌车没了/死了: 撤销战术点, 回归推进
}
const f=(this.tVehTgt&&this.aiOrder)?this.aiOrder:this.objective;
if(!f) return;
// 倒车脱困
if(this.reverseT>0){
this.reverseT-=dt;
this.vel=dampF(this.vel,-this.def.rev,3,dt);
this.yaw+=this.revTurn*dt;
if(this.reverseT<=0){ this.repathT=0; this.stuckT=0; }
return;
}
const dObj=Math.hypot(f.x-this.pos.x,f.z-this.pos.z);
// 有战术点时的到位半径取小 (否则 12~26m 的掩体/绕侧点一生成就被判"已到位")
// 丧尸驻车位同理取小 (2026-10-07d): 驻守要真停进 15~26m 车位, 20m 默认值会隔着半个环就"到位"
const arriveD=this.aiOrder?4.5:(this.objective&&this.objective._zv?6:20);
// 静止对射 (旧口径) 只在没有战术点时才成立 —— 否则"抢掩体/绕侧"会被 engagedStop 钉死在原地
const engagedStop=!this.aiOrder&&this.tTarget&&this.tTarget.kind==='tank'&&this.tMemT>0&&this.losOK&&this.tDist<110;
if(dObj<arriveD||engagedStop){
this.vel=dampF(this.vel,0,4,dt);
this.path=null;
return;
}
// A*寻路
if(!this.path||this.repathT<=0){
NAV.budget=Math.max(NAV.budget,1);
this.path=NAV.findPath(this.pos.x,this.pos.z,f.x+rand(-6,6),f.z+rand(-6,6));
this.pathI=0; this.repathT=rand(5,7); this.progT=0;
}
let steer=null;
if(this.path&&this.pathI<this.path.length){
const wp=this.path[this.pathI];
const dx=wp[0]-this.pos.x, dz=wp[1]-this.pos.z;
if(dx*dx+dz*dz<20){ this.pathI++; }
else steer=Math.atan2(dx,dz);
}
if(steer===null){ steer=Math.atan2(f.x-this.pos.x,f.z-this.pos.z); }
// 宽车体触须微调
let bestAng=0,found=false;
for(const a of [0,0.3,-0.3,0.6,-0.6]){
const px=this.pos.x+Math.sin(steer+a)*6.5, pz=this.pos.z+Math.cos(steer+a)*6.5;
const lx=Math.cos(steer+a)*1.3, lz=-Math.sin(steer+a)*1.3;
if(!occBlocked(px,pz)&&!occBlocked(px+lx,pz+lz)&&!occBlocked(px-lx,pz-lz)){ bestAng=a; found=true; break; }
}
if(found) steer+=bestAng;
const diff=angDiff(this.yaw,steer);
this.yaw=angleLerpTo(this.yaw,steer,this.def.turn*dt);
this.vel=dampF(this.vel,Math.abs(diff)>0.75?2.0:this.def.spd,3,dt);
// 进度式卡住检测
this.progT+=dt;
if(this.progT>1.1){
if(this.pos.distanceTo(this.lastPos)<1.0){
this.stuckT+=1;
this.reverseT=rand(1.2,1.8);
this.revTurn=(Math.random()<0.5?1:-1)*0.5;
// A#7 (2026-09-21): 删除"卡住 4 次即下车" —— 车组全程在车内, 卡住一律走自救:
// 清路径强制重寻路 (A* 换一条路) + 加长倒车, 而不是把人放下来把车丢在原地。
if(this.stuckT>=4){ this.path=null; this.repathT=0; this.reverseT=Math.max(this.reverseT,rand(1.6,2.4)); this.stuckT=0; }
} else this.stuckT=Math.max(0,this.stuckT-1);
this.lastPos.copy(this.pos);
this.progT=0;
}
}
turretAI(dt){
// 目标选择 (2026-09-20 I1 重构): 感知层选定的敌车 > 贴近步兵/反坦克威胁 > 远处步兵.
// 敌车不再由这里"谁近选谁" (旧实现:d<260 就上膛, 隔着半张图点名); 而是 tankPerceive 逐车过
// 视野距离/前向视锥/LOS 后才给到 tVehTgt.
const T=tankAITune(); // 难度档: 炮塔转速/俯仰速率/开火容差/火力距离/首次开火前摇 (2026-09-20 I1, A#1 扩档)
if(this.tMemT>0) this.tMemT-=dt;
this.retargetT=(this.retargetT||0)-dt;
if(this.retargetT<=0){
this.retargetT=0.4;
let inf=null,is=-1e9,id=0; // 步兵/反坦克威胁候选 (旧口径保留)
for(const s of combatants){
if(!s.alive||s.team===this.team||s.onVehicle||s.spectator) continue;
if(typeof chuteAirborne==='function'&&chuteAirborne(s)) continue; // 伞降目标不进车组候选 (2026-09-30 空对地平衡批: 坦克机枪不再 140m 点名跳伞者)
const d=Math.hypot(s.pos.x-this.pos.x,s.pos.z-this.pos.z);
if(d>140) continue;
// 同轴机枪贴身死角 (2026-10-07d, 仅丧尸模式): 贴车 3.4m 内的丧尸进炮塔机械死角 —— 扒车丧尸
// 机枪打不着, 逼坦克机动甩落/碾压或队友解围。只在 ZOMBIE_MODE 生效, 普通对战零变化。
if(typeof ZOMBIE_MODE!=='undefined'&&ZOMBIE_MODE&&s.zombie&&d<3.4) continue;
if(SMOKES.length&&smokeBlocksLOS(this.pos.x,this.pos.y+1.9,this.pos.z,s.pos.x,s.pos.y+1,s.pos.z)) continue;
if(CROP_FIELDS.length&&cropBlocksLOS(this.pos.x,this.pos.y+1.9,this.pos.z,s.pos.x,s.pos.y+1,s.pos.z)) continue;
let sc=90-d*0.9;
if(d<30) sc+=110;
const atThreat=s.cls===3||(s.atn||0)>0||(s.atNades||0)>0; // 2026-09-28 兵种8→5: 反坦克=3
if(atThreat) sc+=(d<70?150:60);
if(s.empUse&&s.empUse.kind==='at') sc+=260;
else if(s.mgUse||s.empUse) sc+=70;
if(sc>is){ is=sc; inf=s; id=d; }
}
const veh=this.tVehTgt;
const vehHot=!!(veh&&veh.alive&&veh.team!==this.team&&this.tMemT>0);
// 旧口径"贴近的反坦克威胁最优先"保留: 70m 内的 AT 火力点/火箭筒抢过敌车
const atOver=inf&&(inf.empUse&&inf.empUse.kind==='at')&&id<70;
let best=null,bd=0;
if(vehHot&&!atOver){ best=veh; bd=this.tVehDist||Math.hypot(veh.pos.x-this.pos.x,veh.pos.z-this.pos.z); }
else if(inf){ best=inf; bd=id; }
else if(vehHot){ best=veh; bd=this.tVehDist||Math.hypot(veh.pos.x-this.pos.x,veh.pos.z-this.pos.z); }
if(best){
if(best!==this.tTarget){
// 首次发现→开火 (2026-09-21 A#1): 敌车目标走本档 fireDelay (新兵3.6/老兵2.2/精英1.7s, 与车长反应 aiReact
// 并行取长者 ⇒ 实测 ≈3.7/2.1/1.7s); 步兵目标仍走车长反应档 (主炮已不对步兵开火, 同轴机枪的压制节奏
// 由 aiReact 的 3.2× 削弱表达)。旧实现两处都是 DIFF_TABLE.react 原值 ⇒ 全档最快 1.4s 就开炮。
// 抖动窗 ±4~6% (0.96~1.06): 保证最坏一次抽签也不跌破契约下限 (精英 1.70×0.96=1.632 > 1.6s)。
// ★2026-10-06 难度批 (标准档): 目标是玩家驾驶的车时首炮前摇 ×1.3 (只削对玩家, 车组互殴不变)。
this.aimReact=(best.kind==='tank')?T.fireDelay*(best.playerDriven?1.3:1)*rand(0.96,1.06):DIFF_TABLE[SETTINGS.diff].react*rand(1.4,2.6)+0.35;
this.losOK=false;
}
this.tTarget=best; this.tDist=bd;
// 记忆续期: 步兵候选本身要求通视, 看见就给 4s; 敌车的记忆时长由 tankPerceive 按难度分档刷新
// (这里不再无条件续期 —— 否则"已经看不见了"也会被 0.4s 一轮的选目标循环无限续命)
if(best!==veh) this.tMemT=4;
}
else if(this.tMemT<=0){ this.tTarget=null; this.losOK=false; }
}
let aimYaw=null, aimPitch=0;
const tgt=this.tTarget&&(this.tTarget.alive!==false)?this.tTarget:null;
if(tgt){
// 载具目标 = 坦克 / 两栖车 / 艇 (2026-09-26 P1-7): 三者都有 pos/yaw/vel(标量)/hp, 提前量与瞄准点同式。
// 旧版只认 kind==='tank' ⇒ 艇虽然进了 tVehTgt, 也会掉进"步兵分支" (主炮不开火、只放同轴机枪)。
const isVeh=(tgt.kind==='tank'||tgt.kind==='amph'||tgt.kind==='boat');
const isTank=(tgt.kind==='tank');   // 只有坦克走"车体中心 +1.3m"的瞄准点 (艇瞄水线以上 1.1m, 见下)
// 提前量叠加"预判误差" aiLeadBias (每次重掷): 新兵±0.55s 常常打提前/落后, 精英±0.15s
const lead=isVeh?clamp(this.tDist/SHELL_SPD+this.aiLeadBias,0,1.6):0;
const tx=tgt.pos.x+(isVeh?Math.sin(tgt.yaw)*tgt.vel*lead:0);
const tz=tgt.pos.z+(isVeh?Math.cos(tgt.yaw)*tgt.vel*lead:0);
aimYaw=Math.atan2(tx-this.pos.x,tz-this.pos.z);
const dh=Math.hypot(tx-this.pos.x,tz-this.pos.z);
aimPitch=clamp(Math.atan2((tgt.pos.y+(isTank?1.3:(isVeh?1.1:1.0)))-(this.pos.y+1.93),Math.max(dh,2)),-0.15,0.3);
} else if(this.threatYaw!==null){
aimYaw=this.threatYaw;
}
this.aimReact=(this.aimReact||0)-dt;
if(aimYaw!==null){
const wantTY=angDiff(this.yaw,aimYaw);
// 拟人反应: 未反应时炮塔转速减半且不开火; 转速/俯仰速率再按难度分档 (新兵 0.6× / 老兵 0.82× / 精英 1×)
const rate=this.def.tRate*0.6*T.tRate*(this.aimReact>0?0.45:1);
this.turretYaw=angleLerpTo(this.turretYaw,wantTY,rate*dt);
this.turretPitch=dampF(this.turretPitch,aimPitch,3*T.pitch,dt);
// 开火双门: 反应延迟 (aiReact, 难度分档) + 瞄准容差 (fireTol, 越难越小) —— 转塔对准才开炮
if(tgt&&this.aimReact<=0&&this.aiReact<=0&&Math.abs(angDiff(this.turretYaw,angDiff(this.yaw,aimYaw)))<T.fireTol){
const dir=this.aimDir();
const o=this.muzzle.clone();
const dh=Math.hypot(tgt.pos.x-this.pos.x,tgt.pos.z-this.pos.z);
// 载具目标 (坦克/两栖车/艇) 走主炮, 步兵走同轴机枪 (2026-09-26 P1-7: 艇与坦克同档 —— 艇体是硬目标,
// 用机枪扫是给不出伤害的; 只有"人"才走下面那挺同轴机枪)
// 丧尸模式例外 (2026-10-07d): 重尸(brute) 380 血机枪磨不动 —— 解锁主炮, dh>14 门防贴脸自炸。
const bruteOK=(typeof ZOMBIE_MODE!=='undefined'&&ZOMBIE_MODE&&tgt.zombie&&tgt.kind==='brute'&&dh>14);
const isVeh=(tgt.kind==='tank'||tgt.kind==='amph'||tgt.kind==='boat')||bruteOK;
// 火力距离按难度分档 (新兵120/老兵175/精英230, A#1 下调): 远距离不空放, 压住"隔着半张图点名"
// A#1 (2026-09-21) 主炮开火门: **只对敌车开炮** —— 旧门 `isTank?dh<=T.fireR:dh>10` 会对 10m 外的步兵
// 直接轰主炮 (隔着半张图点名步兵是"超雄"主因之一); 步兵目标现在只用下面那挺同轴机枪压制。
if(this.cannonCd<=0&&isVeh&&dh<=T.fireR){
const chk=raycastWorld(o,dir,dh);
this.losOK=(!chk||chk.dist>dh-3.5);
if(this.losOK&&SMOKES.length&&smokeBlocksLOS(o.x,o.y,o.z,tgt.pos.x,tgt.pos.y+1.2,tgt.pos.z)) this.losOK=false;
if(this.losOK&&CROP_FIELDS.length&&cropBlocksLOS(o.x,o.y,o.z,tgt.pos.x,tgt.pos.y+1.2,tgt.pos.z)) this.losOK=false;
// 友军弹道预检 (2026-09-20 I1 互不误伤): 本方坦克/下车步兵在弹道走廊里 ⇒ 这一炮不打, 0.6s 后再看
if(this.losOK&&!tankFireLineClear(this,o,dir,dh)) this.losOK=false;
if(this.losOK){ this.fireCannon(); }
else this.cannonCd=0.6;
}
// 同轴机枪打步兵 (同样先过友军弹道预检: 机枪散布更小, 更容易扫到友军)
// A#3 (2026-09-21): 过热强制停火 —— vehMgCanFire 门在最前, 每发 vehMgHeatAdd 积热 (AI 散热 0.15/s 常散)
if(!isVeh&&dh<95&&this.mgT<=0&&this.mgPause<=0&&vehMgCanFire(this)){
if(this.mgBurst<=0) this.mgBurst=randi(7,12);
this.mgT=0.09;
const mdir=dir.clone();
mdir.x+=rand(-0.022,0.022); mdir.y+=rand(-0.015,0.015); mdir.z+=rand(-0.022,0.022); mdir.normalize();
const mo=this.coaxMuzzle();
if(!tankFireLineClear(this,mo,mdir,dh)){ this.mgBurst=0; this.mgPause=rand(0.3,0.6); }
else {
(this.crewBot||this.crew)._src=this.name; // 同轴机枪击杀来源: 载具名
fireBullet(this.crewBot||this.crew,mo,mdir,MG_BULLET_DEF,mo);
vehMgHeatAdd(this); // A#3 每发积热 (heatPS)
if(--this.mgBurst<=0) this.mgPause=rand(0.35,0.8);
}
}
}
}
}
fireCannon(customDir){
if(this.cannonCd>0) return;
this.cannonCd=this.def.reload;
let dir=this.aimDir();
if(customDir) dir=customDir;
else if(this.isAI){
// 主炮散布按难度分档 (2026-09-20 I1 用户: "不能太超雄"): DIFF_TABLE.spreadMul (新兵1.7/老兵1.0/精英0.6)
// × 坦克系数 (TANK_AI.spreadK) —— 旧实现对所有难度恒 0.011 rad, 远距离"百发百中"是超雄主因之一.
// 玩家路径 (isAI=false) 不变: 玩家自己瞄准, 不吃 AI 散布.
// ★2026-10-06 难度批 (标准档): 目标是玩家驾驶的车时散布 ×1.3 (主炮只对载具开火, tTarget 即目标)。
const err=0.011*tankAITune().spreadMul*(this.tTarget&&this.tTarget.playerDriven?1.3:1);
dir.x+=rand(-err,err); dir.y+=rand(-err,err)*0.6; dir.z+=rand(-err,err); dir.normalize();
}
const origin=this.muzzle.clone();
const shooter=this.playerDriven?player:(this.crewBot||this.crew);
if(shooter&&shooter.protUntil) shooter.protUntil=0; // 出生保护清账 (★2026-11-01 判定批): 主炮不走 fireBullet, 旧版保护期内照样开炮
shooter._src=this.name; // 坦克炮击杀来源: 载具名 (射手进炮即记入)
AudioSys.cannon(this.pos.distanceTo(camera.position));
spawnP(PT.flash,origin.x,origin.y,origin.z, dir.x*3,dir.y*3,dir.z*3, 1.0,10,0.12,1,0,true);
spawnP(PT.dark,origin.x,origin.y,origin.z, dir.x*3+rand(-1,1),1.5,dir.z*3+rand(-1,1), 1.0,3,0.9,0.7,0.5);
if(this.playerDriven) addTrauma(0.5);
this.suspPV-=0.55*Math.cos(this.turretYaw);
this.suspRV+=0.4*Math.sin(this.turretYaw);
shells.push({pos:origin.clone(),vel:dir.clone().multiplyScalar(SHELL_SPD),team:this.team,owner:shooter,life:3.6,kind:this.def.heavy?'heavy':'tank',dmgV:this.def.dmg,trail:0,src:this.name}); // src: 弹体自带标签, 命中时重盖章 (2026-09-29)
shooter.lastFiredT=nowT;
gunEvents.push({x:origin.x,z:origin.z,team:this.team,t:nowT,shooter});
}
firePlayerMG(dir){
vehMgTrigger(this); // A#3 扳机保持: 本帧有开火请求 (必须早于冷却早退 —— 20a-seats 冷却中也每帧调)
if(this.mgT>0) return;
if(!vehMgCanFire(this)) return; // A#3 过热强制停火 (散到 unlock=0.35 才解锁)
this.mgT=0.08*(player.streakBuff?player.streakBuff.reloadMul:1); // 连杀增益: 同轴机枪射速 (2026-09-12)
const o=this.coaxMuzzle();
player._src=this.name; // 玩家同轴机枪击杀来源: 载具名
fireBullet(player,o,dir,MG_BULLET_DEF,o);
vehMgHeatAdd(this); // A#3 每发积热 (heatPS; 玩家开火不散热)
AudioSys.gunshot('mg',0,0);
addTrauma(0.02);
}
takeDmg(amt,attacker,ap){
if(!this.alive) return;
// 观战者座驾免伤 (2026-09-26H 观战批): 判据单源在 13-combat specRide —— 与"观战者本人免伤"同口径。
// typeof 守卫: 只加载部分脚本的沙箱/探针缺 13-combat 时退化为普通载具, 不报错。
if(typeof specRide==='function'&&specRide(this)) return;
// 2026-09-02 装甲抗性: 非反装甲伤害(未标记 ap)按 TANK_ARMOR 减免 —— 轻武器/火烧只是挠痒,
// 只有巡飞弹/坦克炮/固定炮/反坦克攻击(ap=true)才能重创坦克
if(!ap) amt*=TANK_ARMOR;
this.hp-=amt;
this.lastDmgT=nowT;
// 载具残血起火 (2026-11-09 批): hp<10% 点火 (燃烧掉血账在 update 里走, 烧毁仍走本 die 链; 正常受创照常结算)
if(typeof vehBurnIgnite==='function'&&!this.burning&&this.hp>0&&this.hp<this.maxHp*VEH_BURN_FRAC) vehBurnIgnite(this,attacker);
if(this.playerDriven){ addDmgFlash(0.35); addTrauma(0.3); if(typeof addVehDmgDir==='function') addVehDmgDir(this,attacker); } // 方向指示: D8 (2026-09-28)
else if(attacker&&attacker.pos){
this.threatYaw=Math.atan2(attacker.pos.x-this.pos.x,attacker.pos.z-this.pos.z);
setTimeout(()=>{ if(this.threatYaw!==null) this.threatYaw=null; },6000);
}
if(this.hp<=0) this.die(attacker);
}
die(attacker){
const spec=(typeof specRide==='function')&&specRide(this); // 观战者座驾: 车可以毁, 人绝不死 (见下面隆断)
this.alive=false;
this.respawnT=rand(40,52);
this.vel=0; this.crew.alive=false;
// ── A#7 三人车组车毁结算 (2026-09-21 契约 §4 v3 定稿) ──
// 车组 = 1 名真人驾驶员 + 2 个轻量名额:
//   驾驶员 (crewBot/玩家) 走**自己的既有死亡链** (1 死 / 1 票 / 1 杀), 这里一行汇总都不加 —— v2 的双计事故
//     (attacker.kills+=CREW_N / tickets-=CREW_N 会变 6 死 6 杀 6 票) 只对真人成立, 故一律不加;
//   2 个名额不是真人、没有死亡链 ⇒ 必须由 settleCrewSlotDeath 汇总结算 (各 1 死 / 1 票 / +1 杀), 否则 3 死变 1 死。
// 空车 (无 crewBot 且无玩家): 没有人可杀 ⇒ 保留旧"装备票"口径 (TICKET_COST), 0 死 0 杀。
const driver=this.playerDriven?(player.alive?player:null):(this.crewBot||null);
const cb=this.crewBot;
this.crewBot=null; this.claimBot=null;
if(this.playerDriven){ this.playerDriven=false; player.onVehicle=null; }
if(driver){
if(driver===player){
// ★2026-09-26H 观战批 (用户实报"会带着观战模式的玩家一起死"): 驾驶员是观战者时**不走死亡链** ——
// player.damage(999) 对他本来就是空操作 (18-game 免伤早退), 旧版的结果是"人被留在残骸里, 而 2 个乘员
// 名额照结算 (本方掉 2 票 + 击杀者 +2 杀)"的劈叉。现在按"观战者从被毁座驾安全脱离"处理: 落到车旁平地,
// 0 死 / 0 票 / 0 杀, 车照毁 (与 C1 口径一致: 观战者的**干预**照常改战局, 但**战局反噬观战者本人**一律无效)。
if(spec){ if(typeof specRideEject==='function') specRideEject(this); }
// 自动脱离载具 (2026-11-09 批, sf_autoexit 默认关): 车毁瞬间自动下车逃生, 代替死亡链 (乘员名额仍随车结算)
else if(AUTO_EXIT_VEH&&player.alive&&typeof autoExitWreck==='function'){ autoExitWreck(this,false); }
else player.damage(999,attacker,false);              // 既有链: 自己 -1 票 +1 死 + 击杀者 +1 杀 + 记分
}else{
if(cb){ // 阵亡落点: 沿车体轴线前移 1.5m (别把尸体压在残骸中心), 并保住"尸体可见"观感
cb.onVehicle=null;
cb.mesh.root.visible=true;
cb.pos.set(this.pos.x+Math.sin(this.yaw)*1.5,this.pos.y,this.pos.z+Math.cos(this.yaw)*1.5);
}
if(typeof driver.crewKill==='function') driver.crewKill(attacker); // bots: 走 die() 全链, 只压掉本条 killfeed
else driver.damage(999,attacker,false);                            // 兜底: 数字一致
}
for(const s of this.crewSlots) if(!spec) settleCrewSlotDeath(s,attacker,this.team); // 2 个名额: 各 1 死/1 票/+1 杀 (观战者座驾不结算, 见上)
}else{
tickets[this.team]=Math.max(0,tickets[this.team]-(this.def.heavy?TICKET_COST.tankHeavy:TICKET_COST.tankLight));
}
if(attacker&&(attacker.ffAll||attacker.team!==this.team)){ // ffAll: 观战幽灵坦克的无差别火力照常记分 (2026-09-17)
// 一次车毁只出一条战报 (victim 写清 3 名乘员; 玩家在内时死亡链另有 1 行 ⇒ 合计 ≤2 行)
// ★2026-09-26 修: **空车**不吹"乘员×3" —— 上面空车分支明确"没有人可杀 (0 死 0 杀)", 战报却照写 3 名乘员,
// 观感是"打死三个人的战报、记分板上零击杀" (与被炸毁的无人坦克对不上)。有人才写乘员数, 空车只报车名。
// 2026-09-26H 同规: 观战者座驾同样不写乘员数 (上面 spec 分支不结算任何乘员)。
const feedName=(driver&&!spec)?(this.name+' · 乘员×3'):this.name;
addKillfeed(attacker,{name:feedName,team:this.team,isPlayer:false},false);
// 玩家得分取 registerKillScore 返回值 (含连杀倍率, 2026-09-11); 与"3 杀"的击杀分是两回事, 只结算这一处
if(attacker.isPlayer) attacker.score=(attacker.score||0)+registerKillScore('摧毁坦克',SCORE_TABLE.tank);
if(attacker.isPlayer&&typeof onPlayerWreck==='function') onPlayerWreck(); // 屏中击毁红档 (2026-09-30 批): 空车击毁旧口径无任何屏中反馈; 有人车另有乘员 die 链的红档, 同帧合并为一响
if(attacker.isPlayer) attacker.vehKills=(attacker.vehKills||0)+1; // 终身击毁载具账 (2026-11-11 数据批): 结算随 sf_stats 累计 (坦克/卡车/战机/舰艇四处同款钩)
}
explosionFX(this.pos.clone().add(V3(0,1.4,0)));
AudioSys.explosion(this.pos.distanceTo(camera.position));
if(typeof vehHeadlightKill==='function') vehHeadlightKill(this); // 夜战大灯先拆 (N2): 焦黑化 traverse 会把 additive 光锥 Mesh 一起换成不透明材质 (黑锥残留 bug)
this.grp.traverse(o=>{ if(o.isMesh){ if(!o.userData.mat0) o.userData.mat0=o.material; o.material=wreckMat; } });
this.grp.rotation.x=this.suspP+rand(-0.1,0.1);
const wsn=Math.sin(this.yaw), wcs=Math.cos(this.yaw);
this.wreckBs=[];
for(const off of [-1.9,0,1.9]){
this.wreckBs.push(registerDynCollider(this.pos.x+wsn*off,this.pos.y+0.95,this.pos.z+wcs*off,2.5,1.9,2.5));
}
// 燃烧残骸 = 持续火源: 点燃周围植被, 灼烧贴近的步兵 (击杀归击毁者), 残骸停留期内燃烧
const restT=rand(24,30);
this.fireSrc=addFireSource(this.pos.x,this.pos.z,this.pos.y+1.3,3.3,restT,22,attacker||null);
igniteArea(this.pos.x,this.pos.z,3.2,attacker||null);
explosionFlora(this.pos,5.5);
// 残骸停留 restT 秒后沉入地下: 开始下沉即熄火(不再是火源), 半沉撤碰撞, 全沉隐藏模型
// (模型体随坦克重生复用, "删除"即隐藏; 重生时恢复可见)
if(this.sinkJob) finishSinkJob(this.sinkJob);
const self=this;
this.sinkJob=queueSink({objs:[this.grp],depth:4.2,rest:restT,sink:4,noRemove:true,
onRest(){ if(self.fireSrc){ removeFireSource(self.fireSrc); self.fireSrc=null; } },
onHalf(){ if(self.wreckBs){ for(const b of self.wreckBs) killDynCollider(b); self.wreckBs=null; } },
onDone(){ self.grp.visible=false; self.sinkJob=null; }
});
}
respawn(silent,initial){
// 出生在基地前方开阔地, 避免卡基地围墙; 空车等待步兵上车
// 无基地战役(劫道): 出生在本阵营主力前出点旁 (护运坦克=谷口集结地)
// 提前结清上一轮残骸的下沉任务与火源 (残骸模型体重生复用)
if(this.sinkJob){ finishSinkJob(this.sinkJob); this.sinkJob=null; }
if(this.fireSrc){ removeFireSource(this.fireSrc); this.fireSrc=null; }
// 起火态随重生复位 (2026-11-09 批): 车体模型重生复用, 燃烧账/火源引用不得跨生死携带
// (残骸火源本体在 die 时 alive=false 已被 follow 块自动掐火, 这里只兜底清引用)
if(this.burning||this.burnBy||this.burnSrc){
if(this.burnSrc){ removeFireSource(this.burnSrc); this.burnSrc=null; }
this.burning=false; this.burnBy=null;
}
const bp=basePos(this.team);
// 同variant多车(东线4辆/西线3辆)按队内序号错位前后排, 避免叠在同一点 (2026-09-02 加载具配套)
const ord=tanks.filter(t=>t.team===this.team).indexOf(this);
// 厂房产能 (2026-09-06 斯大林格勒): 苏军持"厂房"旗 → 战损坦克重生在红十月厂区西停车场
// (双列×4 位, 列距 8m 行距 11m, 车头朝南对车辆大门); 沦陷/中立 → 回主基地, 加速同步失效;
// 开局首生成(initial)不走此分支 —— 开局坦克仍从主基地出发投入战线
if(!initial&&this.team===0&&FACTORY_FLAG&&FACTORY_FLAG.owner===0&&FACTORY_SPAWN&&BASES.length){
const fcol=Math.floor(ord/4), frow=ord%4;
this.pos.set(FACTORY_SPAWN.x+fcol*8,0,FACTORY_SPAWN.z+(frow-1.5)*11);
this.pos.y=heightAt(this.pos.x,this.pos.z);
this.yaw=FACTORY_SPAWN.yaw||0;
} else {
// ── 主基地出生落位 (★2026-09-26 修, P0-4/P0-5) ──────────────────────────────────
// ① 朝向: 旧版写死"队 0 朝东 (HPI) / 队 1 朝西 (-HPI)" —— 那是"两主基东西对置"年代的产物;
//    对南北对置 (塔拉瓦登陆)、对角对置 (斯大林格勒)、攻方在东 (莫斯科) 的图, 出生即背对战场:
//    实测斯大林格勒 14 台车全部背对敌基地 138~148°, 且车头离图缘只有 27m (dev/_tankspawn-probe.js)。
//    现按**指向敌基地**取 yaw —— 与 00-config 的 basePos 同一套坐标源, 不写死方位, 换图自动成立。
// ② 落位: 旧版只按队内序号横排+前后排错位, 完全不看落点上有没有建筑/道具/深水/陡坡
//    (实测雾林守线苏军第 5 台压在一个 r=0.58 的圆柱上, 距基地 27m)。现首选位先过 tankSpawnOk,
//    不过则沿环向外找净位 (8 向 × 半径 6/10/14/18/22), 全不过才退回首选位 (宁可原位也不留空)。
const eb=basePos(1-this.team);
const yawOf=(x,z)=>Math.atan2(eb.x-x,eb.z-z);
const colSide=this.variant===0?1:-1;
const rowN=Math.floor(ord/2);
const zo=BASES.length? colSide*10-rowN*16 : (this.variant===0?4:-4)-rowN*8;
const bx=bp.x+(this.team===0?15:-15), bz=bp.z+zo;
let sx=bx, sz=bz;
if(!tankSpawnOk(bx,bz,yawOf(bx,bz))){
let found=false;
for(let r=6;r<=22&&!found;r+=4){
for(let k2=0;k2<8;k2++){
const a=k2/8*TAU;
const x=bx+Math.cos(a)*r, z=bz+Math.sin(a)*r;
if(tankSpawnOk(x,z,yawOf(x,z))){ sx=x; sz=z; found=true; break; }
}
}
}
this.pos.set(sx,0,sz);
this.pos.y=heightAt(sx,sz);
this.yaw=yawOf(sx,sz);
}
this.turretYaw=0; this.turretPitch=0;
this.hp=this.maxHp; this.alive=true; this.isAI=true; this.playerDriven=false;
this.crew.alive=true;
// A#7 v3 重生: 2 个名额复位 alive=true (deaths **累计保留** —— 同一个人再上车); 驾驶员由 23-deploy/14-bots 重配。
if(this.crewSlots) for(const s of this.crewSlots){ if(s) s.alive=true; }
// A#3 重生 = 新车新枪管: 热量/过热锁/扳机请求一律清零 (不带着上一辆车的枪管热量复活)
this.heat=0; this.heatLock=false; this.mgTrig=false;
this.crewBot=null; this.claimBot=null; this.noEnterT=0;
this.stuckT=0; this.vel=0; this.path=null; this.reverseT=0; this.tTarget=null; this.threatYaw=null;
// 交战层状态清零 (2026-09-20 I1): 重生=新车组, 不能带着上一辆车的目标记忆/反应计时复活
this.tVehTgt=null; this.tVehDist=0; this.tLastPos=null; this.tLastSeenT=-99; this.tMemT=0; this.losOK=false;
this.aiReact=0; this.aiHaltT=0; this.aiRevT=0; this.aiTacticT=0; this.aiOrder=null; this.aiCover=null;
this.aiLeadBias=0; this.aiLeadT=0; this.aiPerT=0; this.aiFlankSide=1;
this.suspP=0; this.suspR=0; this.suspPV=0; this.suspRV=0;
if(this.wreckBs){ for(const b of this.wreckBs) killDynCollider(b); this.wreckBs=null; }
this.grp.visible=true;
this.grp.rotation.set(0,this.yaw,0);
this.grp.traverse(o=>{ if(o.isMesh&&o.userData.mat0) o.material=o.userData.mat0; });
// 己方坦克战损重生: 文字播报让玩家知道本方坦克已回场 (silent=构造时首次生成)
if(!silent&&this.team===player.team) announceVehRespawn(this);
}
}
function enemyTankNear(sol,dist){
// 观战者座驾不被索敌 (2026-09-26H): 判据单源 specRide (13-combat) —— 反装甲兵 (火箭筒/反坦克枪/AT雷)
// 与水面对舰分支都从这里取"最近的敌方装甲", 一处排除即两条路同时生效。
for(const t of tanks) if(t.alive&&t.team!==sol.team&&Math.hypot(t.pos.x-sol.pos.x,t.pos.z-sol.pos.z)<dist
&&!(typeof specRide==='function'&&specRide(t))) return t;
return null;
}
function nearestDepot(x,z){
let best=null,bd=1e9;
for(const d of DEPOTS){
if(d.destroyed) continue;
const dd=Math.hypot(d.x-x,d.z-z);
if(dd<bd){ bd=dd; best=d; }
}
return best;
}
// 弹道方向复用槽 (2026-11-01 性能批): 每弹每帧 vel.clone().normalize() 是纯垃圾 —— dir 只在本迭代内
// 被 raycastWorld/rayCyl/raySoldiers/addScaledVector 同步消费, 不跨弹持有 (逐处已核)。
const _shDir=V3(0,0,1);
const _shCyl=typeof _vehCylSlot!=='undefined'?_vehCylSlot:{x:0,z:0,r:2.3,y0:0,y1:0};
const _shTrkCyl={x:0,z:0,r:2.2,y0:0,y1:0};
const _shRayOpt={team:0,isPlayer:false};   // raySoldiers 选项复用槽 (每弹每帧填充)
function updateShells(dt,rdt){
// 每发炮弹按**自己的**帧长推进 (2026-09-27M 时停修复批; 帧长判据单源 = 22b 的 specTimeShotDt,
// 缺 22b 的部分沙箱退化成世界帧长 = 旧行为):
//   时停下 AI 的炮弹整发停住 —— 不动 / 不过期 / 也不做命中判定。旧版 step=vel*dt=0, 但 `hitD=step+0.5`
//   的前瞻照跑 ⇒ 一发**静止在半空**的炮弹会把 0.4m 外的活人"隔空引爆" (审计 P0-1: 实测 404 血);
//   玩家自己打出的 (owner.isPlayer) 照飞照回收 —— 否则"能开火、打出的东西冻在枪口", 且 life 永不衰减
//   (审计 P0-2: 幽灵坦克主炮 CD 恒 0 + 观战弹药无限 ⇒ 按住扳机就是线性加对象)。
// 非时停时两者都等于 dt ⇒ 普通战斗逐位不变 (第二实参缺省 ⇒ 也退化为 dt)。
const SD=(typeof specTimeShotDt==='function')?specTimeShotDt:null;
for(let i=shells.length-1;i>=0;i--){
const s=shells[i];
const sdt=SD?SD(s.owner,rdt,dt):dt;
if(!(sdt>0)) continue;                 // 世界冻结且这发不属于观察者 ⇒ 整发跳过 (入水/拖尾/判定一并停)
s.life-=sdt;
if(s.life<=0){ shells.splice(i,1); continue; }
// 入水 (2026-09-18 塔拉瓦批): 炮弹/火箭弹穿入水面即被水阻停 —— 大水花, 不产生爆炸伤害 (哑火);
// 与"潜水者被水面保护"同一口径 (子弹见 13-combat waterEntryDist)
{
const wy=waterYAt(s.pos.x,s.pos.z);
if(wy>-1e8&&s.pos.y<wy&&waterDepthAt(s.pos.x,s.pos.z)>0.4){
// 落水水花按弹种分档 (2026-10-04 修复批 V10): 旧版一切炮弹 1.3 档 —— 406mm 舰炮弹落水与中口径弹
//   一样大的水花, 舰炮跨射的"水柱林"没有压迫感。按弹体 dmgV 分三档 (舰炮级 ≥600 / 中口径 ≥200 /
//   其余维持 1.3 既有档)。
const spScale=(s.dmgV>=600)?3.2:(s.dmgV>=200)?1.8:1.3;
waterSplash(s.pos.clone(),spScale,true);
shells.splice(i,1);
continue;
}
}
const step=s.vel.length()*sdt;
const dir=_shDir.copy(s.vel).normalize();
// 坦克主炮炮弹判定半径 (2026-09-17 观战扩展批): SHELL_R=0.3;
// **反坦克火箭/反坦克炮弹独立判定半径 (2026-09-28 阶段三 P1, 用户裁定"加大火箭弹判定")**: AT_SHELL_PAD=0.45
// —— 火箭弹 170m/s 慢于坦克炮弹 380, 弹体判定反而更小 (旧 0) 是"擦过不算"挫败感的主因; 加大后
// 擦过坦克/卡车/士兵 0.45m 内即算命中 (士兵圈同步经 raySoldiers pad 放大), 与"慢而大"的火箭手感一致。
const shPad=(s.kind==='at')?AT_SHELL_PAD:SHELL_R;
	s.vel.y-=SHELL_G*sdt;
s.trail-=sdt;
if(s.trail<=0){
s.trail=0.05;
// 拖尾视觉: 坦克炮弹加大到 0.26 并叠一枚亮芯 (0.16 → 0.26, 用户指定); 反坦克炮弹维持原样
if(shPad>0){
spawnP(PT.spark,s.pos.x,s.pos.y,s.pos.z,0,0,0,0.26,-0.1,0.09,1,0,true);
spawnP(PT.flash,s.pos.x,s.pos.y,s.pos.z,0,0,0,0.12,0,0.07,0.9,0,true);
}else{
spawnP(PT.spark,s.pos.x,s.pos.y,s.pos.z,0,0,0,0.16,-0.1,0.09,1,0,true);
}
}
let hitD=step+0.5, hit=null, hitTank=null, hitTruck=null, hitSol=null;
const wr=raycastWorld(s.pos,dir,hitD);
if(wr){ hitD=wr.dist; hit=wr; }
for(const t of tanks){
if(!t.alive||t.team===s.team) continue;
const r=rayCyl(s.pos,dir,shPad>0?vehHitCylR(t,shPad,_shCyl):vehHitCyl(t,_shCyl),hitD);
if(r){ hitD=r.t; hit=r; hitTank=t; hitSol=null; }
}
for(const t of trucks){
if(!t.alive||t.team===s.team) continue;
const r=rayCyl(s.pos,dir,shPad>0?truckHitCylR(t,shPad,_shTrkCyl):truckHitCyl(t,_shTrkCyl),hitD);
if(r){ hitD=r.t; hit=r; hitTruck=t; hitTank=null; hitSol=null; }
}
const sr=raySoldiers(s.pos,dir,hitD,(_shRayOpt.team=s.team,_shRayOpt),shPad);
if(sr){ hitD=sr.t; hitSol=sr.sol; hitTank=null; hitTruck=null; hit=sr; }
if(hit){
const p=V3(s.pos.x+dir.x*hitD,s.pos.y+dir.y*hitD,s.pos.z+dir.z*hitD);
if(s.src&&s.owner) s.owner._src=s.src; // 击杀来源重盖章 (2026-09-29): 弹在飞期间射手可能又开了别的枪 (火箭慢速弹尤其如此), 直击/溅射结算前刷回本弹标签
// 命中标识档 (2026-09-30 批): 炮弹/火箭='shell' (琥珀括号); 直击者还活着出白档, 致命一击走 die 链红档
if(typeof markHitCls==='function') markHitCls('shell');
const _fbP=s.owner&&s.owner.isPlayer;
if(hitTank){ hitTank.takeDmg(s.dmgV?s.dmgV+rand(-30,30):(s.kind==='at'?rand(300,380):rand(260,330)),s.owner,true); if(_fbP&&hitTank.alive&&typeof onPlayerHitAny==='function') onPlayerHitAny('shell'); }
if(hitTruck){ hitTruck.takeDmg(s.dmgV?s.dmgV+rand(-30,30):(s.kind==='at'?rand(300,380):rand(260,330)),s.owner); if(_fbP&&hitTruck.alive&&typeof onPlayerHitAny==='function') onPlayerHitAny('shell'); }
// ★2026-10-06 难度批 (标准档): 炮弹/火箭直击步兵对**玩家** 260→180 —— 旧值无难度乘区、无衰减,
//   被坦克炮/火箭筒蹭到即近殁, 是"总被秒杀"的又一主诉源; Bot 步兵维持 260 (互殴烈度不变)。
if(hitSol){ hitSol.damage(hitSol.isPlayer?180:260,s.owner,false); if(_fbP&&hitSol.alive&&typeof onPlayerHitAny==='function') onPlayerHitAny('shell'); }
explosionFXSmall(p);
AudioSys.explosion(p.distanceTo(camera.position)*1.6);
// 爆炸半径分档 (2026-09-29 用户裁定"火箭筒爆炸范围仍太小, 再加大"): 火箭弹 9→12 —— 只认 s.rocket
//   (巴祖卡 M9/坦克杀手 RPzB54, 玩家/Bot 同走 fireRocket 单源); 反坦克炮炮弹维持 9, 坦克/舰炮维持 7。
//   结构破坏半径同步 7.5→10 (随爆圈成比例, 参照航弹 9.5m 圈/9 结构的既有口径; 掀树/油桶殉爆同吃此半径)
splashDamage(p,s.owner,s.team,(s.kind==='at')?(s.rocket?12:9):7,s.kind==='at'?70:150,110,true,'shell');
damageStructures(p,s.rocket?10:7.5,s.kind==='at'?180:300,s.owner); // 4参 = 破坏得分归属 (2026-09-26 破坏得分批)
shells.splice(i,1);
continue;
}
if(typeof shellHitNaval==='function'&&shellHitNaval(s,sdt)){ shells.splice(i,1); continue; } // 海战批 (§11.4): 炮弹对艇 —— 判定/伤害/特效全在 15d-naval 的 shellHitNaval 内; 帧长是本帧步长 (2026-09-26 P1-10: 扫掠包络须与本行 step=vel*dt 同一口径, 否则低帧率跳艇; 2026-09-27M 起随逐发帧长 sdt 同源)
// (2026-11-10: 大舰炮弹判定 capitalShellHit 钩随大舰子系统下架摘除)
s.pos.addScaledVector(dir,step);
}
}
function explosionFXSmall(p){
spawnP(PT.flash,p.x,p.y+0.3,p.z,0,1,0, 1.6,10,0.12,1,0,true);
for(let i=0;i<6;i++) spawnP(PT.dark,p.x+rand(-0.5,0.5),p.y+rand(0.2,1),p.z+rand(-0.5,0.5), rand(-1.5,1.5),rand(1,3),rand(-1.5,1.5), rand(0.6,1),1.8,rand(0.7,1.3),0.8,0.6);
for(let i=0;i<6;i++) spawnP(PT.dirt,p.x,p.y+0.2,p.z, rand(-4,4),rand(2,6),rand(-4,4), rand(0.25,0.5),0.5,rand(0.5,0.9),0.9,8);
}
// 溅射已单源到 13-combat splashDamage (2026-09-06 B7b/P2-6)

// ═══════════ 反坦克雷触发链 (2026-09-13 草原库尔斯克改版) ═══════════
// 史实: 苏军大纵深防御的雷区带只认车重 —— 坦克/运输车碾压即炸 (步兵无碰撞可步行通过);
// 爆炸无阵营 (team=-1: 双方步兵/装甲 alike 吃伤害), 并向邻近地雷链爆; 雷区带避开缺口走廊
// (布雷见 05c layoutSteppe), 走廊=装甲安全通道, 野地穿插=踩雷 —— 逼装甲走"杀戮走廊"。
function checkMinesAt(x,z){
for(const m of MINES){
if(m.dead) continue;
if(Math.abs(m.x-x)>3||Math.abs(m.z-z)>3) continue;
if(Math.hypot(m.x-x,m.z-z)<1.9) mineBlast(m);
}
}
const MINE_CHAIN=[]; // 链爆账 (游戏时钟, 2026-11-01 判定批): {m,t} —— 消费点在 updateMineTriggers(dt)
function mineBlast(m){
m.dead=true;
if(m.mesh&&m.mesh.parent) m.mesh.parent.remove(m.mesh);
const p=V3(m.x,m.g0+0.4,m.z);
spawnP(PT.flash,m.x,m.g0+0.5,m.z,0,2,0,2.4,15,0.14,1,0,true);
for(let i=0;i<7;i++) spawnP(PT.dark,m.x,m.g0+0.5,m.z,rand(-2,2),rand(1,4),rand(-2,2),1.0,2.4,rand(0.8,1.4),0.85,0.6);
AudioSys.explosion(p.distanceTo(camera.position));
splashDamage(p,null,-1,5,95,340,true);   // 与反坦克雷同口径: 反装甲全额
damageStructures(p,5,130);                // 无主 (反坦克雷没有 owner 字段): 破坏结构不给任何人加分
crater(m.x,m.z,1.1,true);
// 邻近链爆 (3m 内, 延迟串联 —— 直接递归会深链, 用延时分批)。★2026-11-01 判定批: 旧 setTimeout 挂
// 浏览器时钟, Esc 暂停/K 时停期间照常到点, 冻结的战场里链爆照样炸人 (与 2026-10-28 丧尸近战
// setTimeout→dt 账同族病); 改挂 24-main 传进来的世界帧长 —— 时停/布势 dt=0 整列停住, 暂停整段不跑。
for(const n2 of MINES){
if(n2.dead) continue;
if(Math.hypot(n2.x-m.x,n2.z-m.z)<3) MINE_CHAIN.push({m:n2,t:0.12+Math.random()*0.18});
}
}
function updateMineTriggers(dt){
for(let i=MINE_CHAIN.length-1;i>=0;i--){ // 链爆账先于碾压触发消费 (MINES 里 dead 项常驻, 不依赖上面的早退)
const c=MINE_CHAIN[i]; c.t-=(dt||0);
if(c.t<=0){ MINE_CHAIN.splice(i,1); if(!c.m.dead) mineBlast(c.m); }
}
if(!MINES.length) return;
for(const t of tanks){ if(t.alive) checkMinesAt(t.pos.x,t.pos.z); }
for(const tk of trucks){ if(tk.alive&&!tk.escaped) checkMinesAt(tk.pos.x,tk.pos.z); }
}
