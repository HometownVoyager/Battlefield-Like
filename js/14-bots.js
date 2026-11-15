// ─────────────────────────────────────────────
// 14-bots.js —— Bot AI类
// 源: Index.original.html 第 4478-5636 行
// ─────────────────────────────────────────────
'use strict';
// 多路推进 (2026-09-20 出生点位二轮翻新): 出生扇区方向对目标选择的软加权。
// 出生时 Bot.laneDx/laneDz 记录本路出发方位 (17-emplacements.pickSpawnPoint 按 lane 扇区给定);
// 目标与该方位夹角越小加分越多 (最大 46) —— 分在左/中/右出发区的同一批人因此各扑一路,
// 而不是又汇成一股再挤在同一个点上。与"同目标人数惩罚"互补, 不覆盖距离项。
// ── updateMesh IK 链复用槽 (2026-11-11 性能批): 旧版每次 updateMesh 分配 shLp/ikR/ikL 三个短命对象
// (每 Bot 每帧, 22 人 × LOD ≈ 每帧 40-70 个)。消费即时串行: shLp 只进距离判断, ikR/ikL 各自算完
// 当帧 lerp 消费, 无同帧双持 —— 槽位复用逐位等价。
const _ikShL={x:0.28,y:0.5,z:0}, _ikR={x:0,y:0,z:0,el:0}, _ikL={x:0,y:0,z:0,el:0};
function laneAlignBonus(self,x,z){
if(self.laneDx===undefined||self.laneDz===undefined) return 0;
const dx=x-self.pos.x, dz=z-self.pos.z, l=Math.hypot(dx,dz);
if(l<1) return 0;
return Math.max(0,(dx*self.laneDx+dz*self.laneDz)/l)*46;
}
// ── Bot「闪现」修复参数 (2026-09-20 · task-3 根因排查型) ─────────────────────────
// 根因 (逐帧位移取证, dev/probe-botflash.js): 唯一"玩家真的看得见"的 >3m 单帧位移来自**固定火力点上机链路** ——
// 旧版 decide() 只要 bot 落在炮位 14~18m 内就立刻起 0.9s 前摇 (玩家同规前摇, 但玩家必须先走到 2.6~3m 内按 F),
// 前摇期间 Bot 原地不动 (不走向炮位), 计时一到就把 this.pos 硬 set 到炮位 —— 于是观感就是"隔空上炮/人闪到炮上"。
// 实测: berlin 45s×60 帧一次跑出 32 次"前后都可见且都存活"的单帧位移 8.4m(均值)/13.1m(最大);
// steppe 两次跑出 6 次(11.4m)/5 次(13.2m); 同一位炮位被同一批人反复瞬移上机 ([-57.4,-6.4]×5)。
// 修法 (三条, 缺一不可):
//   ① 接近段: 只有走到站位半径 EMPL_STAND_R 内才允许起前摇 —— 走不到就放弃, 不再隔空上炮;
//   ② 落位段: 前摇结束用 EMPL_SNAP_DUR 秒阻尼滑到站位 (短距离过渡, 观感=跨上炮位), 不再硬 set;
//   ③ 安全阀: 前摇结束时若已离站位超过 EMPL_SNAP_GUARD (被推挤/走位), 直接放炮 —— 任何情况下都不瞬移过去。
const EMPL_STAND_R=1.8;      // 站位半径: 走到离落位点这么近才允许起前摇 (玩家按 F 是 2.6~3m, 同量级)
const EMPL_APPROACH_R=18;    // 接近半径: 这个距离内才走过去 (各炮原有的兴趣半径 14/15/16 仍然生效)
const EMPL_GO_TIMEOUT=6;     // 接近段超时: 走不到就放弃, 避免围着炮打转
const EMPL_SNAP_DUR=0.28;    // 前摇结束后的落位过渡时长 (阻尼滑到站位)
const EMPL_SNAP_SPD=4.0;     // 落位限速 (m/s): AI LOD 会用 0.15s 补帧, 只靠时间常数挡不住"一帧滑完"
const EMPL_SNAP_GUARD=5.5;   // 安全阀: 前摇结束时离站位 > 此值 → 放炮, 绝不硬 set 过去
const SPAWN_UP_T=0.5;        // 重生登场过渡时长 (2026-09-20): 重生是设计必需的远处换位, 但不能"凭空跳出"
const SPAWN_UP_DIP=0.55;     // 重生登场起始下沉高度 (从低处起身到位, 给玩家一个可见的登场理由)
const EXIT_SPD=3.6;          // 下车跨出限速 (m/s): 替掉旧版 3.2m 硬 set, 走成"从车里跨出来"
const EXIT_MAX_T=2.0;        // 下车跨出超时: 被挡住就地结束 (不强制落位 → 不产生瞬移)
// 上车触达半径 (2026-09-20 闪现修复): 旧版 d<3.8 就上车 —— 人在离车心 3.8m 处 mesh 直接 visible=false
// (半空中消失), 下一帧 pos.copy(v.pos) 把 3.8m 的差量补掉。取证里这是"其他"类 >3m 事件的全部来源
// (3.4~3.8m, vis=F→F onV=T→T, 同帧载具自身位移 0.00~0.04m)。改为走到车体侧面 (载具侧推带 2.05+0.38=2.43
// 之外) 才上车, 消失点是贴着车壳的, 且被隐藏的位移 ≤2.7m, 不再有 >3m 的暗跳。
const VEH_BOARD_R=2.7;
const DIR_FLIP_MIN=0.6;      // moveDir 找不到可行方向时的换向冷却: 随机反向加记忆, 不再逐帧重掷
// ── 逐帧临时向量复用槽 (2026-09-26 性能批) ──
// 这两处是全库最密的 V3 分配点, 且都在**每帧每 Bot** 的路径上:
//   · perceive 每候选敌人 2 个 (tp + tp.clone()) —— 40 人 × ~20 敌 × (1/0.16s) ≈ 每秒上万次
//   · moveDir 的 probe 每次探测 2 个 (膝高射线的 origin/dir), 逐帧 1~7 次探测
// V8 年轻代能吞掉, 但这是纯垃圾: 值只在本次调用内消费完 (射线的返回值走 _rcResult 共享槽, 不持有入参)。
// 复用前提 (满足): ①目标函数只读入参不保存引用 ②同一次调用内串行消费, 不跨迭代持有 —— 逐处已核。
const _pvEye=V3(), _pvT=V3(), _pvD=V3();
const _prO=V3(), _prD=V3(0,0,1);
// ── moveDir 探测/侧偏表 (2026-11-01 性能批) ──
// 旧版 moveDir 每次调用新建 probe 闭包 (捕获 this ⇒ V8 分配 context), 避障/逃生的侧偏角
// 每次重掷字面量数组。全部提到模块级: probe 改吃 bot 形参, 数组复用 (逐帧每移动 Bot)。
const MOVE_DA=[0.55,-0.55,1.1,-1.1,1.65,-1.65];
const FLEE_DA=[0,0.6,-0.6,1.2,-1.2,1.9,-1.9];
function _botMoveProbe(b,a){
const px=b.pos.x+Math.sin(a)*1.1, pz=b.pos.z+Math.cos(a)*1.1;
if(occBlocked(px,pz,b.swim||b.onCapDeck)) return false; // 游泳态 (2026-09-18): 深水格放行, 只躲实体 —— 落水后游得回岸; onCapDeck (P4 2026-09-30): 站在大舰甲板上时水障格同样放行 (甲板是海上陆地, OCC 里那格是海)
// ── 载具壳体障碍探针 (2026-11-12 实机反馈批: "士兵不把载具当障碍物, 顶着车壳挤") ──
// 旧探针只查静态 OCC + 膝高射线; 载具是动态实体不在 OCC 里, 走位的 Bot 一头撞进车壳,
// 只靠 vehiclePushSoldiers 的侧向推挤硬顶 —— 观感就是"贴着坦克又推又卡"。这里把车壳
// OBB(+0.5m 余量) 也当障碍: 探针点(前方1.1m)落在壳内 = 此路不通, moveDir 的备选角扫描
// (MOVE_DA) 自然沿车壳绕行。toVehicle 状态豁免认领目标 (要贴壳才够到上车判定 _surf<0.55)。
if(!b.swim&&!b.onCapDeck&&_vehProbeBlocked(b,px,pz)) return false; // 游泳态放行 (与水障格同规); 甲板行人不躲甲板下的艇壳 (否则大舰甲板上寸步难行)
// 膝高射线兜底: 仅在步兵连续滞留 b.stuckT > 0.25s 且有预算时才触发 3D 射线检测
// (复用槽 _prO/_prD: raycastWorld 只读入参, 结果走 _rcResult 共享槽 —— 不跨调用持有)
if(b.stuckT>0.25&&RAY_BUDGET.used<RAY_BUDGET.maxPerFrame){
RAY_BUDGET.used++;
const low=raycastWorld(_prO.set(b.pos.x,b.pos.y+0.35,b.pos.z),_prD.set(Math.sin(a),0,Math.cos(a)),1.1);
if(low) return false;
}
return true;
}
// ── 载具壳体 OBB 障碍 (2026-11-12 实机反馈批, 与上面 _botMoveProbe 配套) ──────────────
// 单源口径与推挤几何**同参** (15-vehicles:1041 / 15b-trucks:130 / 15d-naval:973):
//   坦克 hx=max(2.05,halfW) hz=def.hullL/2+0.45 · 卡车 hx=1.05 hz=3.7 · 两栖/艇 hx=max(2.05,halfW) hz=spec.hullL/2+0.45
// 残骸同样算障碍 (坦克/卡车残骸只注册 DynCollider 不再走推挤, 是街口"卡死"最常出的实体)。
// 覆盖门与 vehiclePushSoldiers 的 yMax=1.9 同门 (楼上/桥上的步兵不躲桥下车)。性能: 先轴对齐
// 粗筛 (±9m) 再做 OBB 变换, 每探针点至多 3×(坦克+卡车+艇) 次廉价判定, 无分配。
const _vehObsM=0.5, _vhObs={hx:0,hz:0};
function _vehObsDims(v){
if(typeof tanks!=='undefined'&&tanks.indexOf(v)>=0){ _vhObs.hx=Math.max(2.05,v.halfW||2.05); _vhObs.hz=((v.def&&v.def.hullL)||4.6)/2+0.45; return true; }
if(typeof trucks!=='undefined'&&trucks.indexOf(v)>=0){ _vhObs.hx=1.05; _vhObs.hz=3.7; return true; }
if(typeof navalCraft!=='undefined'&&navalCraft.indexOf(v)>=0){ _vhObs.hx=Math.max(2.05,v.halfW||2.05); _vhObs.hz=((v.spec&&v.spec.hullL)||4.6)/2+0.45; return true; }
return false;
}
function _vehObsTest(v,px,pz,b){
if(b.state==='toVehicle'&&b.targetVeh===v) return false; // 认领目标豁免: 要贴壳才够到上车判定 (2026-11-03 _surf<0.55 口径)
if(b.pos.y>v.pos.y+1.9) return false;                    // 高处步兵不躲车壳 (与 vehiclePushSoldiers yMax 同门)
const dx=px-v.pos.x; if(dx>9||dx<-9) return false;
const dz=pz-v.pos.z; if(dz>9||dz<-9) return false;
if(!_vehObsDims(v)) return false;
const mx=_vhObs.hx+_vehObsM, mz=_vhObs.hz+_vehObsM;
const cs=Math.cos(v.yaw), sn=Math.sin(v.yaw);
// 外接盒粗筛必须随 yaw 旋转 (2026-11-12 T7 端到端实锤): 旧版拿局部 mx/mz 直接当世界轴界 ——
// 车一横 (yaw=HPI) 两个界正好互换, 探针点偏出横向廊 2.55m 但仍在纵向廊 4.4m 内时被误判
// "界外"=放行=侧腹撞壳 (端到端 minSurf -0.5)。世界 AABB 半宽 = |mx·cs|+|mz·sn| / |mx·sn|+|mz·cs|。
const wex=Math.abs(mx*cs)+Math.abs(mz*sn), wez=Math.abs(mx*sn)+Math.abs(mz*cs);
if(dx>wex||dx<-wex||dz>wez||dz<-wez) return false;       // OBB 的世界轴对齐外接盒粗筛 (随 yaw 旋转)
const lx=dx*cs-dz*sn, lz=dx*sn+dz*cs;                    // 轴配对与 vehiclePushSoldiers 同参: lx 横向 hx / lz 纵向 hz
return Math.abs(lx)<mx&&Math.abs(lz)<mz;
}
function _vehProbeBlocked(b,px,pz){
if(typeof tanks!=='undefined'){ for(let i=0;i<tanks.length;i++){ if(_vehObsTest(tanks[i],px,pz,b)) return true; } }
if(typeof trucks!=='undefined'){ for(let i=0;i<trucks.length;i++){ if(_vehObsTest(trucks[i],px,pz,b)) return true; } }
if(typeof navalCraft!=='undefined'){ for(let i=0;i<navalCraft.length;i++){ if(_vehObsTest(navalCraft[i],px,pz,b)) return true; } }
return false;
}
// ── Bot AI 全局帧射线预算器 (Phase 1 任务 1.3) ──
const RAY_BUDGET={maxPerFrame:12,used:0};
const PROX_SPOT_R=12; // 近距强制感知半径 (2026-11-14): perceive 里 12m 内的候选射线不吃预算门 ——
// 全体共享 12 发/帧在混战中超订阅, 排在更新序后面的 Bot 每轮拿 0 发"新目标"射线, 贴脸/擦肩的
// 陌生敌人永远进不了 target ("面对面走过像没看见"主根因; 2026-11-03 批只修了"当前目标"优先复核)。
// 近距射线天然短 (≤12m), 成本远低于 95m 远射, 豁免预算的边际开销可忽略。
let _lastRayBudgetFrame=-1;
function tickBots(){ RAY_BUDGET.used=0; }
function _ensureRayBudgetReset(){
const curT=(typeof nowT!=='undefined')?nowT:((typeof performance!=='undefined')?performance.now():Date.now());
if(curT!==_lastRayBudgetFrame){ _lastRayBudgetFrame=curT; RAY_BUDGET.used=0; }
}
if(typeof window!=='undefined'){ window.RAY_BUDGET=RAY_BUDGET; window.tickBots=tickBots; }
// ── 士兵间软分离 (2026-11-03 实机反馈批: "好几个人挤在一起、卡在一起"主根因) ──
// 全库此前**没有任何士兵-士兵推挤**: collideMove 只推 BOXES/CYLS (静态世界), 玩家/士兵互相直穿 ——
// 选中同一掩体点/同一旗心的 Bot 全部叠进同一格 (观感=挤在一起), 叠死后又各自触发脱困侧蹿 (观感=打摆)。
// 口径: 每人只推**自己**离开邻居 (对称分离由双方各跑一遍、各推一半保证), 单帧位移限幅 BOT_SEP_MAX
// (实际典型 0.02~0.1m), 推完过一次 collideMove 防顶进墙里; 驻停 Bot 没有 moveDir 的逐帧 standHeight,
// 推完就地重站高。参与名单与命中管线同口径 (raySoldiers): 死人/在车/大舰炮手/观战者不推;
// |dy|>1.6 不推 (楼上下/桥上下); 任一方俯卧推力减半 (贴地不顶开别人)。玩家只被让路不被推。
const BOT_SEP_R=0.85, BOT_SEP_MAX=0.22;
function _soldierSep(b){
let pushed=false;
const n=soldiers.length;
for(let i=0;i<=n;i++){
const s=(i<n)?soldiers[i]:((typeof player!=='undefined')?player:null);
if(!s||s===b||!s.alive||s.onVehicle||s.spectator) continue;
const dy=s.pos.y-b.pos.y;
if(dy>1.6||dy<-1.6) continue;
const dx=b.pos.x-s.pos.x, dz=b.pos.z-s.pos.z;
const d2=dx*dx+dz*dz;
if(d2>=BOT_SEP_R*BOT_SEP_R||d2<1e-8) continue;
let push=(BOT_SEP_R-Math.sqrt(d2))*0.5;
if(b.prone||s.prone) push*=0.5;
if(push>BOT_SEP_MAX) push=BOT_SEP_MAX;
if(push<0.008) continue;
pushed=true;
const inv=push/Math.sqrt(d2);
b.pos.x+=dx*inv; b.pos.z+=dz*inv;
}
if(pushed){
collideMove(b.pos,0.4);
if(!b.swim) b.pos.y=standHeight(b.pos.x,b.pos.z,b.pos.y+0.6);
}
}
// ── 驻点占用账 (2026-11-03 实机反馈批: 挤在一起的第二根因) ──
// 掩体/驻守点此前"谁评谁上"没有占用概念 —— 一窝 Bot 对同一批 coverPoints 评出**同一个**最优解,
// 全队先后叠进同一格。轻量账: 数同队活人里"打算去/已站在"该点 1.7m 内的个数 (意向=coverPt/defendPt/
// pushPt 三个落点字段 + 现位), 评分时逐点加罚。不预约不锁点 (死亡/改主意自动失效), 只作评分偏置;
// 单源就是本函数, findCoverFrom/findCoverToward/defendPt 三处消费。
function coverCrowdAt(self,x,z){
let cnt=0;
const r2=1.7*1.7;
for(const s of soldiers){
if(s===self||!s.alive||s.team!==self.team||s.onVehicle) continue;
if(s.coverPt){ const dx=s.coverPt.x-x, dz=s.coverPt.z-z; if(dx*dx+dz*dz<r2){ cnt++; continue; } }
if(s.defendPt){ const dx=s.defendPt.x-x, dz=s.defendPt.z-z; if(dx*dx+dz*dz<r2){ cnt++; continue; } }
if(s.pushPt){ const dx=s.pushPt.x-x, dz=s.pushPt.z-z; if(dx*dx+dz*dz<r2){ cnt++; continue; } }
const dx=s.pos.x-x, dz=s.pos.z-z;
if(dx*dx+dz*dz<r2) cnt++;
}
return cnt;
}
// ── 反舰炮台瞄准解算 (★2026-09-26E 审计 8 抽出的**单源**) ──────────────────────────────
// 实机唯一在用的那一套限界: 回旋 ±BATTERY_YAW_MAX + 俯角下限 batteryPitchFloor(当前回旋角)。
// 背景: 15f 自带一份 `Battery.aim`(旧口径: 无回旋限界 + 俯角定角 -0.42) 与 `batteryAI`/`batteryAim`
// 两个模块级封装, **全库零调用点** —— 真链是本文件的 updateBatteryGun。留着它 = "一件事两支代码,
// 其中一支随修复批漂移": 谁哪天把 batteryAI 接进帧钩, 就会把回旋限界与俯角下限一起丢掉
// (炮管穿自家胸墙/扫过操作手)。现在 15f 的 Battery.aim 委托到这里, 两边共用同一份解算。
// 副作用: 写 g.yaw/g.pitch 的旋转 (调炮)。返回 {relY,wantYaw,wantPit,pitLo,aligned,ey,dh}。
function batteryAimSolve(g,tgt,dt){
const spd=(typeof SHELL_SPD_NAVAL==='number'&&SHELL_SPD_NAVAL>0)?SHELL_SPD_NAVAL:150;
// A#9 实测根因 (2026-09-21): **Battery 没有 y 字段** —— 炮口/瞄准高度单源是 15f 的 `mountY` (炮耳, = 平台高
// +BATTERY_TRUNNION 1.52)。旧写法 `g.y!==undefined?g.y:heightAt(...)` 落到混凝土平台面 (比炮口低 1.58m),
// 于是炮口 LOS 预检的射线**从胸墙里出发**, 每次都命中自家胸墙 → cd 被反复重置成 BAT_BLOCKED, 90s 一发不出。
// 几何实测: 炮口在半径 3.642m / 高于平台 1.945m, 最近墙段盒 (前胸墙, 顶面仅 +0.51m) 间距 1.435m
// ⇒ 炮口**在墙外且在墙上方**, 15f 自己的 `Battery.fire` 自检 (4.6m 内无命中) 也放行。
const ey=(g.mountY!==undefined)?g.mountY:((g.y!==undefined)?g.y:heightAt(g.x,g.z));
const d0=Math.hypot(tgt.pos.x-g.x,tgt.pos.z-g.z);
const tof=d0/Math.max(spd,1);
const tv=navTgtVel(tgt);
const tx=tgt.pos.x+tv[0]*tof, tz=tgt.pos.z+tv[1]*tof;
const wantYaw=Math.atan2(tx-g.x,tz-g.z);
const dh=Math.max(Math.hypot(tx-g.x,tz-g.z),4);
// ★2026-09-26 修 (P1-19a): 与玩家侧同一套限界 —— 回旋 ±BATTERY_YAW_MAX, 俯角下限 batteryPitchFloor(当前回旋角)。
// 旧写法是 clamp(...,-0.42,0.75) 定角: 炮管转到两翼 (胸墙 1.15m) 仍按 -0.42 压, 就从自家胸墙里穿出去;
// 且回旋无限制 ⇒ 转到后方时炮口扫过操作手 (站位 2.7m)。射界外的目标: 炮口停在限界上 ⇒
// aligned 门 (0.05rad) 自然不通过 (不会出现"炮口朝西、炮弹朝东")。
const YMAX=(typeof BATTERY_YAW_MAX==='number')?BATTERY_YAW_MAX:1.745;
const relY=clamp(angDiff(g.face||0,wantYaw),-YMAX,YMAX);
const PITLO=(typeof batteryPitchFloor==='function')?batteryPitchFloor(relY):-0.42;
const wantPit=clamp(Math.atan2(((tgt.pos.y||0)+1.0)-ey,dh),PITLO,0.75);
if(g.yaw&&g.yaw.rotation) g.yaw.rotation.y=angleLerpTo(g.yaw.rotation.y,relY,3*dt);
if(g.pitch&&g.pitch.rotation) g.pitch.rotation.x=dampF(g.pitch.rotation.x,-wantPit,4,dt);
const aligned=(g.yaw&&g.yaw.rotation?Math.abs(angDiff((g.face||0)+g.yaw.rotation.y,wantYaw))<0.05:true)
&&(g.pitch&&g.pitch.rotation?Math.abs(g.pitch.rotation.x+wantPit)<0.03:true);
return {relY:relY,wantYaw:wantYaw,wantPit:wantPit,pitLo:PITLO,aligned:aligned,ey:ey,dh:dh};
}
// ── 7d-甲 高炮多机分摊账本 (2026-09-30, 空对地平衡批遗留项 "多架机分炮不集火"): ──
// 旧口径每门炮走 enemyPlaneAlive(team) = 数组序第一架敌机 ⇒ 同一防空阵地的每门炮都泼同一架机。
// 分摊: 认领数最少的敌机优先 (平手取水平距近者); 认领后**粘滞**到目标亡 —— 防抖动换目标反复重置
// 反应窗 (AA_DIFF.react)。只统计**本队** AA 操作者的认领账 (敌方高炮打的是另一队的机, 与我的候选集不相交)。
// enemyPlaneAlive 仍是"是否有敌机"存在性判据单源 (归队/退炮位等消费点不动), 火控分派从这里走。
function aaSpreadTarget(team,self,gx,gz){
if(self._aaTgt&&self._aaTgt.alive&&self._aaTgt.team!==team) return self._aaTgt; // 粘滞续认
let best=null,bn=1e9,bd=0;
for(const p of planes){
if(!p||!p.alive||p.team===team) continue;
let n=0;
for(const b of combatants){
if(b===self||!b.alive||b.team!==team||!b.empUse||b.empUse.kind!=='aa'||!b._aaTgt||!b._aaTgt.alive) continue;
if(b._aaTgt===p) n++;
}
const d=Math.hypot(p.pos.x-gx,p.pos.z-gz);
if(n<bn||(n===bn&&d<bd)){ best=p; bn=n; bd=d; }
}
return best;
}
// 出生朝向单源 (2026-10-06 生成平衡批): 返回"面朝最近存活敌人"的 yaw —— 玩家部署 (23-deploy) 与 Bot
// spawn() 共用。旧版玩家出生面朝世界原点 (atan2(-x,-z))、Bot 出生根本不设 yaw (沿用上一命的旧朝向),
// 两条路都会背对着敌人落地, 用户实报"一生成就是背对着敌人, 容易被秒杀"。
// 本作 forward=(sin yaw, cos yaw) 约定 ⇒ 朝向 (dx,dz) 即 yaw=atan2(dx,dz)。
// includePlayer: Bot 选敌要把玩家也算进来 (玩家是独立单例, 不在 soldiers 里); 玩家自己选敌只看 soldiers。
// 无存活敌人时返回 null, 调用方保留旧朝向逻辑 (玩家=面朝原点; Bot=不覆盖)。
function spawnYawAt(x,z,team,includePlayer){
let bx=0,bz=0,bd=Infinity;
for(const s of soldiers){
if(!s||!s.alive||s.team===team) continue;
const d=(s.pos.x-x)*(s.pos.x-x)+(s.pos.z-z)*(s.pos.z-z);
if(d<bd){ bd=d; bx=s.pos.x; bz=s.pos.z; }
}
if(includePlayer&&typeof player!=='undefined'&&player.alive&&player.team!==team){
const d=(player.pos.x-x)*(player.pos.x-x)+(player.pos.z-z)*(player.pos.z-z);
if(d<bd){ bd=d; bx=player.pos.x; bz=player.pos.z; }
}
return bd<Infinity?Math.atan2(bx-x,bz-z):null;
}
class Bot {
constructor(team,cls,name){
this.team=team; this.name=name;
this.isPlayer=false;
this.pos=V3(); this.vel=V3();
this.yaw=0; this.pitch=0; this.visYaw=0;
this.hp=100; this.alive=false; this.crouch=false;
this.mesh=buildSoldierMesh(team,name);
this.gun=null; this.gunKind=null; this.heldWpnKey=null; this.visualGunTimer=0;
this.setClass(cls);
this.state='idle';
this.path=null; this.pathI=0; this.repathT=0;
this.objective=null; this.defendPt=null;
this.target=null; this.lastSeenPos=V3(); this.lastSeenT=-99;
this.aimSettle=0; this.reactT=0;
this.reloadT=0; this.boltT=0;
this.fireT=0; this.burstLeft=0; this.burstPause=0;
this.nadeCd=rand(4,10); this.nadeAnimT=0; this.pendingNade=null;
this.suppression=0; this.coverPt=null; this.coverT=0;
this.smokeCd=rand(18,28);
this.prone=false; this.flinchT=0;
this.aimErrX=0; this.aimErrY=0; this.wanderSeed=rand(0,9);
// 侧移方向记忆: 侧移延续同侧, 不左右换向蹦 (反复横移修复)
this.slideDir=Math.random()<0.5?1:-1; this.slideCd=0;
// 火情规避 (04b-fire.fireThreat): 逃命剩余时间/扫描节拍/逃生航向
this.fireFleeT=0; this.fireScanT=rand(0,0.22); this.fleeYaw=0;
// 战斗机动层 (批次①重构): 性格攻击性 + 持续机动(驻停/侧移/跃进) + 掩体探头循环
this.aggro=rand(0.35,1);
this.man='hold'; this.manT=0; this.stance='crouch'; this.pushPt=null;
this.peekPhase='in'; this.peekT=0; this.peekNext=0; this.peekPos=null; this.peekSide=0;
this.supFireT=0; this.lastHitT=-9;
this.coverCd=0; this.lastCover=null; // 掩体重进冷却+粘滞: 防止在多个掩体间来回蹦
this.decisionT=rand(0,0.4); this.perceptT=rand(0,0.15);
this.tickSkip=0; this.tickAcc=0;
this.kills=0; this.deaths=0; this.score=0;
this.respawnT=0; this.deathAnimT=0;
this.stuckT=0; this.lastPos=V3(); this.moveIntent=false;
this.unstickT=0; this.unstickDir=1; this.lastUnstickP=null;
// 2026-11-03 实机反馈批: 目标粘滞计时 (防半路掉头往返) / 上车触达账 (贴壳计时+顶壳失败拉黑) / 当前目标遮挡缓存
this.objHoldT=0; this.vehGoT=0; this.vehFailV=null; this.vehFailT=-99; this._curBlk=false;
// 闪现修复状态 (2026-09-20): 上炮位接近段/炮位落位过渡/下车跨出/重生登场/兜底换向记忆
this.emplGo=null; this.emplPinT=0; this.exitSlide=null; this.spawnUpT=0;
this.dirFlipT=0; this.dirFlipSign=Math.random()<0.5?1:-1;
this.empUse=null; this.empT=0;
this.emCast=null; // 固定火力点使用前摇 (与玩家同规 2026-09-02): {kind,g,t,dur}
this.lastFiredT=-99; this.animT=rand(0,9);
this.mgUse=null; this.mgT=0;
this.mortUse=null; this.mortT=0;
this.supplyGo=null; this.supplyT=0; this._dryScavT=0; // 弹尽寻补给 (2026-11-03 弹药账对齐): 目标弹药箱 / 贴箱补给计时 / 无箱搜刮保底
this.meleeT=0;
this.onVehicle=null; this.targetVeh=null; this.chuting=false;
// A#8 跳伞状态对账: chuteAirborne() 的通用口径是 (chute && !onGround) —— Bot 走伞降链时同步维护这一对字段,
// 于是伤害倍率 (chuteDamageMul) / 索敌过滤 (Bot.perceive) 与玩家共用同一支判定, 不再各写一套。
this.chute=false; this.onGround=true; this.chuteMesh=null;
// A#9 岸防炮: 认领后的本机操作态 (占用轨是 g.crewBot=this, 见 15f 契约 §6)
this.batUse=null; this.batT=0; this.batteryTgt=null;
this.pilotOf=null;
this.bandageT=0; this.medkitT=0;
this.speedMul=rand(0.92,1.08);
this.flashlight=(typeof isDarkEnvironment==='function')?isDarkEnvironment():!!NIGHT_MODE;
this.isScoutLight=(Math.random()<0.28); // 战术小队先锋巡逻制: 仅少数先锋在暗光下持开灯资格, 消除光污染
this.flAiTimer=rand(0,0.4);
combatants.push(this); soldiers.push(this);
}
setClass(cls){
this.cls=cls;
const wset=TEAM_FACTION[this.team].cls[cls];
this.wpnKey=wset[0];
this.heldWpnKey=this.wpnKey;
this.visualGunTimer=0;
this.def=WPN_DEFS[this.wpnKey];
this.slots=wset.map(k=>({key:k,def:WPN_DEFS[k],mag:WPN_DEFS[k].mag,reserve:WPN_DEFS[k].reserve}));
this.mag=this.def.mag;
this.pMag=this.slots[1]?this.slots[1].def.mag:0;
this.pReloadT=0;
const gear=clsGear(cls,this.team); // 投掷物公式单源 (2026-09-06 B7b/P2-5)
this.nades=gear.nades;
this.smokes=gear.smoke;
this.atn=(EXPERIMENT&&cls===3)?(TEAM_FACTION[this.team].atn5||3)*2:gear.atn; // Bot 不吃实验模式 atn 清零变体 (行为等价); 2026-09-28 兵种8→5: 反坦克=3
this.maxBandages=CLASSES[cls].bandages||4;
this.bandages=this.maxBandages;
const kind=gunKindOf(this.wpnKey);
if(kind!==this.gunKind||this.wgKey!==this.wpnKey){
if(this.gun) this.mesh.gunG.remove(this.gun);
this.gunKind=kind; this.wgKey=this.wpnKey; this.heldWpnKey=this.wpnKey;
// 契约 J §12.1 (2026-09-21): 挂枪走 11-soldiers 的单源 API —— 建模型 + 前推(CARRIED_FWD) + 微降 +
// rotation.order='YXZ' + rotation.y=π 全在 mountGunModel 里, 本文件**不再自己设一遍**
// (旧版这里与 20-player 各写一份, 是"两条挂载路径漂移"的源头; 也是"枪插在左锁骨"的现场之一)。
this.gun=mountGunModel(this.mesh.gunG,kind,this.team,this.wpnKey);
}
}
switchVisualGun(wpnKey){
if(!wpnKey||this.heldWpnKey===wpnKey) return;
if(!this.mesh||!this.mesh.gunG) return;
if(this.gun){ this.mesh.gunG.remove(this.gun); this.gun=null; }
const kind=gunKindOf(wpnKey);
this.gunKind=kind; this.wgKey=wpnKey; this.heldWpnKey=wpnKey;
this.gun=mountGunModel(this.mesh.gunG,kind,this.team,wpnKey);
}
spawn(){
// ★2026-10-26 排查轮二审 修复 (H3/P2): 布势阶段调好的兵种配比跨重生失效。
//   ①现象 (用户可见): 指挥官在布势界面把「步兵 A 组」调成 2 狙击 + 1 反坦克 + 2 步枪, 开战后第一波还
//     按配比; 但只要组里有人阵亡重生, 这条命就变成随机兵种 —— 布势的全部价值只维持到第一个战损,
//     小组的战术定位 (谁反装甲 / 谁远程) 从第二个战损起就散了。设计 D21 原文是
//     「**调每组兵种配比 (生成期落装参数)**, Bot 直接按配比落装」, 即配比是**生成期**参数, 不该被重生重掷。
//   ②根因 (旧写为什么错): 本行是无条件 setClass(CLS_POOL[randi(...)]) —— spawn() 是首次出生与每次重生
//     共用的唯一盖章点 (见下一行的出生保护注释), 于是"每一条命"都会重掷一次兵种, 把编制表里的配比
//     (26-commander cmdRatioOf 那份期望分布) 整个抹掉。旧代码里没有任何地方把配比回灌给重生。
//   ③现在的单源口径: 有编制 (this.cmdGrp) 且 26-commander 的取兵种单源已就位时, 由 cmdRatioWantBot(this)
//     决定这命落哪个兵种 (它读 this.cmdGrp 与 CMD.orbat, 用期望配比与组内**活人**分布做贪心补差;
//     ★2026-10-27 排查批: 落装行此刻 this.alive 仍是 false ⇒ have 统计天然不含自己, 死人就是待补空位,
//     旧写"把自己从 have 里摘掉"的扣减是多余且有害的, 已在 26-commander 侧删除);
//     返回 null/-1 (无编制 / 组里无需调整 / 越界) 则**完全维持旧随机** = 零回归。
//     判据实现只有 cmdRatioWantBot 一处 —— 本文件不许自己再算一遍配比 (那会成为第二份"谁该是什么兵种"
//     的公式, 与 D21 的单源纪律相悖)。Bot 构造器里第一次 setClass 时 cmdGrp 还不存在
//     (cmdOrbatBuild 挂在 startMatch 尾), 那一刻必然走 null 分支 ⇒ 开局仍是原随机分布。
const _cw=(this.cmdGrp&&typeof cmdRatioWantBot==='function')?cmdRatioWantBot(this):null;
this.setClass((_cw!==null&&_cw!==undefined&&_cw>=0&&_cw<=4)?_cw:CLS_POOL[randi(0,CLS_POOL.length-1)]);
this.protUntil=nowT+SPAWN_PROT; // 出生保护 (2026-09-28 阶段三 P1): 首次出生与重生共用本函数 = 唯一盖章点; 开火即解除
// 落点 (2026-09-19 翻新): 先按"战线+危险+拥挤度"选点位, 再在该点位半径内挑
// 离同队最近邻最远、且不在建筑足迹里的干净落点 —— 取代旧的"点位坐标 ±2m 随机"。
const sp=pickSpawnFor(this.team);
let lp=pickSpawnPoint(this.team,sp);
// 指挥官编制集中生成 (2026-10-26 反馈批, 用户需求 3): 有编制且玩家是指挥官时, 重生落点向组内存活
// 成员质心集中 —— 落点闸/单源都在 26-commander 的 cmdSquadSpawnNear, 返回 null (无存活组员/落点闸
// 全败) 时维持 pickSpawnPoint 原落点 = 非指挥官局与"全组阵亡"场景零回归。laneDx/laneDz 保留本路
// 出发方位 (pickObjective 的路线加权不因集中而变)。
if(this.cmdGrp&&this.cmdGrp.kind==='inf'&&typeof cmdSquadSpawnNear==='function'&&typeof cmdIsCommander==='function'&&cmdIsCommander()){
const np=cmdSquadSpawnNear(this);
if(np) lp={x:np.x,z:np.z,laneDx:lp.laneDx,laneDz:lp.laneDz};
}
this.pos.set(lp.x, 0, lp.z);
// (2026-11-10: 出生甲板吸附 capSnapToDeck 钩随大舰子系统下架摘除)
// 多路推进 (2026-09-20): 记下本路出发方位 —— pickObjective 会给同方位的目标加权,
// 于是分在左/中/右出发区的同一批人不会又汇到同一条路、同一个点上 (用户口径"开局分散推进")。
this.laneDx=lp.laneDx; this.laneDz=lp.laneDz;
this.pos.y=standHeight(this.pos.x,this.pos.z,10);   // (2026-11-10: 甲板出生 capSpawnGroundY 门随大舰子系统下架摘除)
const _sy=(typeof spawnYawAt==='function')?spawnYawAt(this.pos.x,this.pos.z,this.team,true):null;
if(_sy!==null) this.yaw=_sy; // 出生面朝最近敌人 (2026-10-06 生成平衡批: 旧版沿用上一命朝向, 常背敌落地; 上车则由车组逻辑接管)
this.hp=100; this.alive=true; this.crouch=false; this.prone=false;
this.flashlight=(typeof isDarkEnvironment==='function')?isDarkEnvironment():!!NIGHT_MODE;
this.isScoutLight=(Math.random()<0.28); // 战术小队先锋巡逻制: 仅少数先锋在暗光下持开灯资格, 消除光污染
this.flAiTimer=rand(0,0.4);
this.heldWpnKey=this.wpnKey; this.visualGunTimer=0;
this.ragdolled=false;
this.mag=this.def.mag; this.reloadT=0; this.suppression=0;
this.target=null; this.lastSeenT=-99; this.path=null;
this.state='idle'; this.mgUse=null; this.empUse=null; this.mortUse=null; this.unstickT=0;
this.supplyGo=null; this.supplyT=0; this._dryScavT=0;   // 弹尽补给账跨命复位 (2026-11-03)
this.mortarPlaced=false;   // 新的一命重新拿到"架一门迫击炮"的额度 (2026-09-26 补: 旧版跨命保留 ——
                           // 架过炮的迫击炮兵阵亡重生后再也不架; 玩家侧本来就在 23-deploy 的部署复位里清)
this.man='hold'; this.manT=0; this.pushPt=null; this.stance='crouch';
this.peekPhase='in'; this.peekPos=null; this.coverPt=null; this.supFireT=0;
this.coverCd=0; this.slideCd=0; this.lastCover=null;
this.fireFleeT=0; this.fireScanT=rand(0,0.22);
this.onVehicle=null; this.targetVeh=null; this.chuting=false; this.emCast=null;
this.bandageT=0;
this.navFails=0; this.dirT=rand(-0.5,0.5); // 寻路失败退避计数 + 兜底直行的固定偏航 (防一列人排成直线)
this.vehGoT=0; this.vehFailV=null; this.vehFailT=-99; this.objHoldT=0; // 2026-11-03: 上车触达账 + 目标粘滞跨命复位
	this.mesh.root.visible=true;
	// 重生登场过渡 (2026-09-20 闪现修复): 重生是把人从死点搬到出生点 (设计必需, 位移可达 300m+);
	// 尸体在 respawnT<2.5 时就已隐藏, 取证确认不存在"尸体→新位置"的 1 帧残影 (重生帧恒为 vis=F→T)。
	// 但新兵是**凭空出现**的 —— 给 0.5s 登场动作 (从低处起身到位, 见 updateMesh), 让"这里为什么
	// 多了一个人"有可见的理由, 而不是"刷"地一闪。
	this.spawnUpT=SPAWN_UP_T;
	this.emplGo=null; this.emplPinT=0; this.exitSlide=null;
	// A#8/A#9 重生复位: 伞模型/炮位操作态一律清空 ——
	// 上一次死亡留下的 chuteMesh 会挂在新兵头顶, 留下的 batUse 会占着炮位不放。
	this.chuteClear();
	if(this.batUse) this.releaseBattery();   // A#9: 重生前先松开上一命的炮位占用 (别把炮锁在死人名下)
	this.batUse=null; this.batT=0; this.batteryTgt=null;
	this.chute=false; this.onGround=true; this.chuting=false;
	this.mesh.root.rotation.set(0,0,0);
	this.mesh.pelvis.position.y=0.94;
	// 全局机制 (2026-09-06 用户指定): Bot 部署/重生时若有同队闲置坦克 → 直接部署为车组。
	// 与玩家部署界面"选载具出生"同一语义 (不限距离, 取最近一辆); 小队成员除外 (随玩家步行);
	// 战机不在此列 (pilotOf 专属流程), 卡车为劫道模式纯 AI 运输队 (无乘员位) 也不适用。
	// 厂房坦克产能依赖此条: 苏军战损坦克在厂区重生后, 下一名额度内重生的 Bot 会直接上车开赴前线。
	// 2026-09-19 修正: 只上"真的会开走"的车 (见 pickIdleDeployVehicle) —— 旧版上车只看
	// 空车+血量, 停火驻守中的坦克会把乘员一起钉在原地一整局 (用户实报"车里的人像卡住")。
	// D16 (2026-10-26 指挥官批): 非 free 态 (有指挥组令) 的 Bot 禁自发上 idle 载具 ——
	// 心灵控制下上车会把编制打散; free 态 (含无编制/缺 26-commander 沙箱) 保持现状零回归。
	if(!this.inSquad&&(typeof cmdBotFree==='function'?cmdBotFree(this):true)){
	// 坦克优先 (陆战 11 图的既有行为逐位不变), 没有闲置坦克才看闲置舰艇 (★2026-09-26E 审计 1)
	const dv=pickIdleDeployVehicle(this)||pickIdleNaval(this);
	if(dv) this.spawnInVehicle(dv);
	}
	this.pickObjective(); // 出生即定目标 (不等下一次 decide 抽签), 开局不再有一批人站在基地里没目标
	this.decisionT=rand(0,0.25);
}
spawnInVehicle(v){
this.hp=100; this.alive=true; this.crouch=false; this.prone=false;
this.ragdolled=false;
this.mag=this.def.mag; this.reloadT=0; this.suppression=0;
this.target=null; this.lastSeenT=-99; this.path=null;
this.state='idle'; this.mgUse=null; this.empUse=null; this.mortUse=null; this.unstickT=0;
this.supplyGo=null; this.supplyT=0; this._dryScavT=0;   // 弹尽补给账跨命复位 (2026-11-03)
this.man='hold'; this.manT=0; this.pushPt=null; this.peekPhase='in'; this.peekPos=null; this.coverPt=null; this.supFireT=0;
this.coverCd=0; this.slideCd=0; this.lastCover=null;
this.chuting=false; this.bandageT=0; this.deathDir=0;
this.respawnT=0;
this.chuteClear();                 // A#8: 带伞入车 = 同帧收伞 (旧伞不跟到车里/下一局)
this.chute=false; this.onGround=true;
this.mesh.root.visible=false;
this.mesh.root.rotation.set(0,0,0);
this.mesh.pelvis.position.y=0.94;
	// 契约 §4 v3: 每车 1 名真实 AI 车组 —— crewBot 是唯一跑 AI 的驾驶员; 另 2 个"乘员名额"是
	// Tank.crewSlots 轻量记录 (tank-core 建/结算), 不进士兵池, 与本文件无关。
	this.onVehicle=v; v.crewBot=this; v.claimBot=null;
	this.pos.copy(v.pos);
	this.crewStillT=0; this.navFails=0;
	this.laneDx=undefined; this.laneDz=undefined; // 车组不按步行出发区推进
}
// A#7 (契约 §4 v2) 随车乘员归属摘除 —— **v3 已作废**: 三人车组的后 2 人是 Tank.crewSlots 轻量记录,
// 不是士兵, 不存在"随车乘员归属"要摘。车位占用判据回到 v.crewBot / v.playerDriven。
// A#8 伞模型收伞单源 (契约 §7): 三处 (落地/死亡/重生) 都必须同帧摘掉, 否则伞会挂到下一局/下一命。
chuteClear(){
if(this.chuteMesh){
const g=this.mesh&&this.mesh.root;
if(g&&g.remove) g.remove(this.chuteMesh);
this.chuteMesh=null;
}
this.chute=false;
}
// A#8 开始伞降 (16-aircraft 投放 / 23-deploy 载具投人 共用): 统一置 chuting + chuteAirborne 口径字段
chuteBegin(x,y,z){
this.chuting=true; this.chute=true; this.onGround=false;
if(x!==undefined) this.pos.set(x,y,z);
this.mesh.root.visible=true;
this.path=null; this.state='idle'; this.target=null;
}
// A#7 契约 §4 v3: AI 驾驶员的车毁连带死亡入口 (tank-core 的 Tank.die 对 crewBot 调用) ——
// 走既有死亡链 (1 死 / 1 票 / 1 杀), 只压掉**本乘员那条 killfeed**: 车毁由 Tank.die 记一条
// "坦克名 · 乘员×3", 否则同一辆车会刷 2 行 (驾驶员 1 条 + 坦克 1 条)。
crewKill(attacker){
this._noFeed=true;
try{ this.die(attacker,false); } finally{ this._noFeed=false; }
}
enterVehicle(v){
if(v.crewBot||v.playerDriven) return;
v.crewBot=this; v.claimBot=null;
this.onVehicle=v;
// A#7/A#8: 步行上车 = 不是随车乘员; 带伞上车同帧收伞
this.chuteClear(); this.onGround=true;   // A#8: 带伞上车同帧收伞
// 入车落位 (2026-09-20 闪现修复): 上车的最后一段差量 (≤VEH_BOARD_R) 在**隐藏帧同时**结清 ——
// 旧版把它留给下一帧的乘员同步 (pos.copy(v.pos)), 于是"人已在车上、位置还在车外"多留一帧暗跳。
this.pos.copy(v.pos);
this.exitSlide=null;
this.crewStillT=0; this.navFails=0;
this.targetVeh=null; this.path=null;
this.state='idle';
this.crouch=false; this.prone=false; this.bandageT=0;
if(this.mgUse){ releaseEmpl(this.mgUse,true); this.mgUse=null; }
if(this.empUse){ releaseEmpl(this.empUse,true); this.empUse=null; }
if(this.mortUse){ releaseEmpl(this.mortUse,true); this.mortUse=null; }
if(this.batUse){ this.releaseBattery(); }   // A#9: 上车/入座即松开岸防炮
if(this.emCast){ if(this.emCast.g&&this.emCast.g.user===this) this.emCast.g.user=null; this.emCast=null; }
this.mesh.root.visible=false;
}
dismountVehicle(bailing){
const v=this.onVehicle;
this.onVehicle=null; this.chuting=false;
// A#8 契约: 跳伞途中下车/被投放 → 一致地收伞并回到"落地"口径
this.chuteClear();
this.onGround=true;
if(v){
if(v.crewBot===this) v.crewBot=null;
v.noEnterT=nowT+(bailing?12:6);
let px=v.pos.x+3.2, pz=v.pos.z;
for(const off of [[3.2,0],[-3.2,0],[0,4],[0,-4],[4,4]]){
const qx=v.pos.x+off[0], qz=v.pos.z+off[1];
if(!occBlocked(qx,qz)){ px=qx; pz=qz; break; }
}
// 下车落位 (2026-09-20 闪现修复): 旧版 this.pos.set(px,0,pz) 是一次 3.2~5.7m 的硬位移 ——
// 取证里它是"下车位移"那一类 (单次跑出 13 次 3.2m 跳变)。虽然乘员在车上时 mesh 不可见 (不是残影),
// 但"刷"地出现在车旁仍是瞬移。改为: 位置原地不动 (就在车内坐标), 由 update() 以 EXIT_SPD 限速
// 跨出到落点 (带走路动画), 到位才结束 —— 全程逐帧位移 ≤ EXIT_SPD*dt ≈ 0.18m。
this.exitSlide={x:px,z:pz,t:EXIT_MAX_T};
this.pos.y=standHeight(this.pos.x,this.pos.z,v.pos.y+2);
}
this.mesh.root.visible=true;
this.path=null; this.state='idle'; this.decisionT=0; this.targetVeh=null;
this.crewStillT=0;
this.man='hold'; this.manT=0; this.pushPt=null; this.peekPhase='in'; this.peekPos=null; this.coverPt=null;
this.coverCd=0; this.slideCd=0; this.lastCover=null; this.emCast=null; this.emplGo=null; this.emplPinT=0;
if(bailing){ this.suppression=0.9; }
}
// ── 固定火力点上机链 (2026-09-20 闪现修复, 参数见文件头) ──────────────────────
// 站位单源: 这里算出的站位必须与 update 内逐帧钉住炮手的位置完全一致 (mg/mortar 0.85m, at AT_CREW_DIST,
// aa AA_CREW_DIST, bat = 15f 的 batteryStandSpot) —— 否则"走到站位"与"上炮后钉住"会差出一截, 又变成小瞬移。
emplStandSpot(g,kind){
if(kind==='at') return {x:g.x-Math.sin(g.face)*AT_CREW_DIST, z:g.z-Math.cos(g.face)*AT_CREW_DIST};
if(kind==='aa') return g.crew?{x:g.crew.x,z:g.crew.z}:{x:g.x, z:g.z-AA_CREW_DIST};   // 站位单源 (00-config + 建炮避障点): 退出炮口扫掠圈
// A#9 岸防炮: 站位函数由 15f 提供 (契约 §6 冻结名 batteryStandSpot); 缺模块时按同一口径兜底
// (沿 -face 2.7m, 与 15f 的 2.7 一致) —— 这里只兜底站位, 不兜底任何开火。
if(kind==='bat') return (typeof batteryStandSpot==='function')?batteryStandSpot(g):{x:g.x-Math.sin(g.face)*2.7,z:g.z-Math.cos(g.face)*2.7};
return {x:g.x-Math.sin(g.face)*0.85, z:g.z-Math.cos(g.face)*0.85};
}
// 上炮位统一入口: 站位半径内 → 起前摇 (g.user 认领); 接近半径内 → 走过去; 其余不动作。
// 返回 true = 本帧已决定去上炮, 调用方应 return (与旧版"直接起前摇"的调用形态一致)。
// A#9: 后两参可选 —— 岸防炮在岬角 (离战线几十~上百米), 沿用 18m 兴趣半径会永远上不了炮,
// 故由调用方给"接近半径 + 赶路超时" (默认值 = 陆战固定火力点原参数, 行为零漂移)。
emplMount(g,kind,approachR,goTimeout){
const sp=this.emplStandSpot(g,kind);
const d=Math.hypot(sp.x-this.pos.x,sp.z-this.pos.z);
const AR=approachR||EMPL_APPROACH_R, GT=goTimeout||EMPL_GO_TIMEOUT;
if(d<=EMPL_STAND_R){
g.user=this; this.emCast={kind,g,t:0,dur:EM_CAST_DUR}; this.emplGo=null;
this.state='defend'; this.path=null; this.decisionT=0; return true;
}
if(d<=AR){
if(!this.emplGo||this.emplGo.g!==g){
this.emplGo={g,kind,exp:nowT+GT};
this.path=null; this.setPathTo(sp.x,sp.z); this.repathT=rand(1.2,1.8);
}
this.state='toEmpl'; this.decisionT=rand(0.3,0.5); return true;
}
return false;
}
// 前摇结束后的落位: 阻尼趋近站位, 并叠加**单帧限速** —— 全程无硬 set, 单帧位移 ≤ EMPL_SNAP_SPD*dt
// (AI LOD 会以 min(tickAcc,0.15) 补帧, 纯时间常数在 0.15s 步长下仍可能一帧滑掉 0.95 倍距离)
pinEmpl(px,pz,dt){
const dx=px-this.pos.x, dz=pz-this.pos.z, d=Math.hypot(dx,dz);
if(d<=0.05){ this.pos.x=px; this.pos.z=pz; return; } // 稳态: 已在站位, 钉死 (零位移)
if(this.emplPinT>0) this.emplPinT-=dt;
if(this.emplPinT>0){
const k=clamp(1-Math.max(this.emplPinT,0)/EMPL_SNAP_DUR,0,1);
let step=d*(1-Math.exp(-(9+22*k)*dt));
const lim=EMPL_SNAP_SPD*dt;
if(step>lim) step=lim;
this.pos.x+=dx/d*step; this.pos.z+=dz/d*step;
}else{
// 过渡结束 (或上炮瞬间就被推开): 小残差直接钉死; 大残差限速追平 —— 任何情况都不瞬移
if(d<=0.8){ this.pos.x=px; this.pos.z=pz; }
else{ const step=Math.min(d,EMPL_SNAP_SPD*dt); this.pos.x+=dx/d*step; this.pos.z+=dz/d*step; }
}
}
// 备弹可用判据 (2026-11-03 弹药账对齐): 槽位备弹>0 才允许起换弹 —— 备弹打空还照起 reloadT 会变成
// 永久换弹循环 (完成时无弹可进、mag 仍 0、下一帧又起)。无槽位 (丧尸子类) 视为不可换 (本就不开枪)。
canReload(){
const s=this.slots&&this.slots[0];
return !!s&&s.reserve>0;
}
// 弹尽寻补给 (2026-11-03 弹药账对齐): 最近弹药箱 ≤45m → 步行去贴箱补 (supplyGo, 与玩家 doGrabResolve 同账);
// 附近没有箱 → 10s 战地搜刮保底 (就地补一个弹匣的备弹), 防无箱地图/丧尸局永久哑火。
drySeekSupply(){
if(this.supplyGo||this._dryScavT>0) return;
if(this.mgUse||this.mortUse||this.empUse||this.batUse||this.emCast) return;
let best=null,bd=45;
const cr=(typeof AMMO_CRATES!=='undefined')?AMMO_CRATES:null;
if(cr) for(const ac of cr){
if(ac.ship) continue;   // 舰上弹药箱不进步行补给链 (登舰走跳帮链, 不归这条管)
const d=Math.hypot(ac.x-this.pos.x,ac.z-this.pos.z);
if(d<bd){ bd=d; best=ac; }
}
if(best){
this.supplyGo={x:best.x,z:best.z,exp:nowT+30};
this.supplyT=1.2;
this.path=null; this.setPathTo(best.x,best.z);
this.state='toSupply'; this.decisionT=rand(0.4,0.7);
}else this._dryScavT=10;
}
eyePos(){ return V3(this.pos.x,this.pos.y+(this.prone?0.5:this.crouch?1.15:1.62),this.pos.z); }
noticeThreat(enemy){
if(!enemy||!enemy.alive) return;
if(!this.target||nowT-this.lastSeenT>2.5){
this.lastSeenPos.copy(enemy.pos);
if(nowT-this.lastSeenT>4) this.lastSeenT=nowT-2.8;
}
}
damage(amt,attacker,isHead){
if(!this.alive) return;
// 出生保护 (2026-09-28 阶段三 P1): 落地 0.5s 内**敌方来源**伤害免掉 (开火即解除) —— 与玩家同口径;
// 环境伤 (attacker=null: 溺水/激流/严寒) 不挡 (Bot 落水照样淹, 保护不是免死金牌)。
if(this.protUntil&&nowT<this.protUntil&&attacker&&attacker.team!==this.team) return;
// A#8 契约 §7: 伞降中受到的伤害乘 CHUTE_DEF.dmgMul (0.40) —— 判定单源在 13-combat.chuteDamageMul,
// 与玩家 player.damage 同一支; "不下线"口径: 只是显著更难打死, 不是无敌。
amt*=chuteDamageMul(this);
this.hp-=amt;
// 残血钉零 (2026-10-01d, 实机"总是有Bot在0血时赖着不死"): 溅射衰减/伞降减免都带小数, hp 会停在
//   0~1 之间 —— 名牌四舍五入显示 "0/100" 而人还活着 (读作"赖着不死")。hp∈(0,1) ⇒ 钉到 0 = 击杀;
//   活着的 Bot 血量恒 ≥1, 名牌读数与生死不再出现"0 血站桩"的组合。
if(this.hp>0&&this.hp<1) this.hp=0;
// 读条受击打断 (2026-11-03, 与玩家同规 18-game:196 READBAR_DMG_GATE=25): 换弹/举雷(前摇)/包扎/上炮前摇/
// 弹尽贴箱补给 全部可被单次大伤打断 —— 取消一律不结算 (雷不消耗/包扎不回血/换弹不进弹), 与玩家同语义;
// 死亡清账仍由 die() 无条件收。旧版 Bot 完全不在打断网里 (换弹硬直挨 999 伤害照走完)。
if(amt>READBAR_DMG_GATE){
if(this.reloadT>0) this.reloadT=0;
if(this.pReloadT>0) this.pReloadT=0;
if((this.state==='nade'||this.state==='atnade')&&this.nadeAnimT>0){ if(this.hp<=0) dropHeldNade(this); this.nadeAnimT=0; this.state='combat'; }   // ★2026-11-03 掉雷批: 致命一击(hp 已上方扣减)⇒ 掉雷代替收回; 非致命照旧收回, die() 内钩兜非打断路径
if(this.bandageT>0) this.bandageT=0;
if(this.supplyT>0) this.supplyT=0;
if(this.emCast){ if(this.emCast.g&&this.emCast.g.user===this) this.emCast.g.user=null; this.emCast=null; }
}
this.lastHitT=nowT;
this.suppression=Math.min(1.6,this.suppression+0.45);
this.aimSettle=Math.max(0.1,this.aimSettle-0.4);
if(attacker&&attacker.team!==this.team&&!attacker.spectator){ // 观战者的攻击不会引来还击锁定
this.noticeThreat(attacker);
// A#8: 伞降目标的索敌口径同 perceive —— 25m 内才把它当还击目标 (与"远距离看不见伞兵"同一条)
const aD=Math.hypot(attacker.pos.x-this.pos.x,attacker.pos.z-this.pos.z);
if(!this.target&&!attacker.isCrew&&!attacker.onVehicle&&!(chuteAirborne(attacker)&&aD>CHUTE_DEF.botEngageR*(NIGHT_MODE?NIGHT_CFG.rangeMul:1)*WX_CFG.rangeMul)&&Math.random()<0.8){
this.target=attacker;
this.lastSeenPos.copy(attacker.pos);
this.lastSeenT=nowT-1.2;
this.reactT=(attacker.isPlayer?DIFF_TABLE[SETTINGS.diff].pReact:DIFF_TABLE[SETTINGS.diff].react)*rand(0.5,1); // 还击反应对玩家拆列 (2026-10-06 难度批)
}
}
// 真附身呈现 (2026-11-01): 宿主受击 = 附身者的屏 —— 红闪+微震镜+来向弧, 与玩家 damage() 同一套 (18-game)。
// 放在 die 判定前: 击杀那一击也先出反馈 (下一帧 specViewTick 检测阵亡自动脱离)。
if(typeof player!=='undefined'&&player&&this===player.specViewHost){
if(typeof addDmgFlash==='function') addDmgFlash(Math.min(0.5,0.2+amt*0.004));
if(typeof addTrauma==='function') addTrauma(0.15);
if(attacker&&typeof addDirHit==='function') addDirHit(Math.atan2(attacker.pos.x-this.pos.x,attacker.pos.z-this.pos.z));
}
if(this.hp<=0) this.die(attacker,isHead);
}
die(attacker,isHead){
// 丧尸模式感染链 (2026-10-06 设计 §3.3 / 2026-10-11 用户需求4 全域感染):
// 被丧尸击杀或处于全域感染期 (老兵10m/精英2m) 的地面兵 → 原地尸变 (25-zombies)。
// 载具乘员/飞行员不尸变 (死在车里/天上没有"原地"), 走原链。(2026-11-10: 大舰炮手项随大舰子系统下架摘除)
const _infAct=(attacker&&attacker.zombie)||(typeof isFullInfectionActive==='function'&&isFullInfectionActive());
if(ZOMBIE_MODE&&typeof zombieInfect==='function'&&_infAct&&!this.zombie&&!this.onVehicle&&!this.pilotOf){ zombieInfect(this,attacker); return; }
this.alive=false; this.deaths++;
this.deathAnimT=0.6;
this.respawnT=rand(7,11);   // (2026-11-10: capCrew 免重生循环分支随大舰子系统下架摘除)
this.bandageT=0; this.chuting=false;
this.flashlight=false; if(this.mesh&&this.mesh.flGrp) this.mesh.flGrp.visible=false;
// A#8 契约 §7: 空中死亡必须**同帧**摘伞 —— 旧版只把 chuting 置 false, 伞模型留在 mesh 上跟到重生/下一局
// (实测: damage(999) 后 chuteMesh!==null)。这里走收伞单源。
this.chuteClear(); this.onGround=true;
// A#9: 死在炮位上 → 松开岸防炮占用 (与 mg/emp/mortUse 同一处理)
if(this.batUse){ this.releaseBattery(); }
// 清理战斗残留: 尸体不再携带交战状态/目标/机动 (调试层与探针口径一致)
// ★2026-11-03 死亡掉雷批 (用户裁定"死亡时手里捏的雷掉落在原地, 并继承读条时间'): 前摇 (举雷/反坦克雷) 中被杀 ⇒
// 手里那颗就地脱手, 引信按前摇剩余比继承 (dropHeldNade 单源, 13-combat) —— 前摇越接近出手, 尸体上的雷越烫。
// 丧尸尸变分支在上面的早退 return, 不落雷 (人没死透, 尸体起身继续用)。受创>25 打断 (上方既有分支) 不掉: 雷收回。
if((this.state==='nade'||this.state==='atnade')&&this.nadeAnimT>0) dropHeldNade(this);
this.state='idle'; this.target=null; this.pushPt=null; this.coverPt=null;
this.man='hold'; this.manT=0; this.peekPhase='in'; this.peekPos=null; this.supFireT=0;
this.coverCd=0; this.slideCd=0; this.lastCover=null; this.emCast=null;
noteDeath(this.pos.x,this.pos.z);
// 布娃娃尸体 (cannon可用时)
this.ragdolled=window.CANNON?spawnRagdoll(this,attacker,isHead):false;
if(this.ragdolled) this.mesh.root.visible=false;
if(this.targetVeh){ if(this.targetVeh.claimBot===this) this.targetVeh.claimBot=null; this.targetVeh=null; }
if(this.onVehicle){ if(this.onVehicle.crewBot===this) this.onVehicle.crewBot=null; this.onVehicle=null; }
if(this.mgUse){ releaseEmpl(this.mgUse,true); this.mgUse=null; }
if(this.empUse){ releaseEmpl(this.empUse,true); this.empUse=null; }
if(this.mortUse){ releaseEmpl(this.mortUse,true); this.mortUse=null; }
if(this.emCast){ if(this.emCast.g&&this.emCast.g.user===this) this.emCast.g.user=null; this.emCast=null; }
this.supplyGo=null; this.supplyT=0; this._dryScavT=0;
// A#7 契约 §4: 车毁连带的乘员死亡由 Bot.crewKill() 调进来 —— 死亡/票/杀**照常各记一次**, 只压掉战报行
// (车毁由 Tank.die 记一条"坦克 · 乘员×3", 否则一辆车刷 4 行)。
tickets[this.team]=Math.max(0,tickets[this.team]-1);   // (2026-11-10: capCrew 免票豁免随大舰子系统下架摘除)
if(attacker){
attacker.kills=(attacker.kills||0)+1;
// 玩家记分唯一入口=onPlayerKill (21-match): 此处只给 Bot/乘员加分, 否则玩家击杀双计 200 (2026-09-06 P0-1)
if(!attacker.isPlayer) attacker.score=(attacker.score||0)+SCORE_TABLE.kill;
if(!this._noFeed) addKillfeed(attacker,this,isHead);
if(attacker.isPlayer){ onPlayerKill(this,isHead); }
else if(typeof player!=='undefined'&&player&&attacker===player.specViewHost&&typeof onHostKill==='function'){ onHostKill(); }   // 真附身: 宿主击杀只出红档+音 (不记分, 2026-11-01)
}
if(this.pos.distanceTo(camera.position)<30&&Math.random()<0.5) AudioSys.hurt();
}
pickObjective(){
this.objHoldT=rand(4,7); // ★2026-11-03 目标粘滞: 选中即承诺 4~7s (decide 的 6% 随机换目标门在此期间不生效, 防半路掉头往返)
// 攻防模式: 任意旗点可直接占领, Bot 与玩家规则一致 —— 动态选择最近的非己方/争夺中旗点
// 破袭模式: 进攻方扑向最近未毁补给库, 防守方前往驻守
if(GAMEMODE==='demolition'){
const d=nearestDepot(this.pos.x,this.pos.z);
this.objective=d?{id:d.id,x:d.x,z:d.z,r:14,owner:this.team===ATK?DEF:this.team,cap:0,capTeam:-1,gy:heightAt(d.x,d.z)}:FLAGS[0];
this.defendPt=null;
this.repathT=Math.min(this.repathT,0.5);
return;
}
if(GAMEMODE==='clash'){
// 遭遇战强点 (2026-09-13 草原库尔斯克改版): 目标=敌方强点(spawnPtsOf 已按归属动态) + 中立强点 + 敌基地
const cands=spawnPtsOf(1-this.team).map(s=>({x:s.x,z:s.z}));
if(typeof SPOTS!=='undefined') for(const s of SPOTS){ if(s.own===-1) cands.push({x:s.x,z:s.z}); }
cands.push({x:BASES[1-this.team].x,z:BASES[1-this.team].z});
let best=null,bestScore=-1e9;
for(const c of cands){
let sc=-Math.hypot(c.x-this.pos.x,c.z-this.pos.z)*0.6+rand(0,45);
// 友军聚集惩罚: 目标点附近己方越多越分散改道
for(const s of soldiers){
if(s!==this&&s.alive&&s.team===this.team&&Math.hypot(s.pos.x-c.x,s.pos.z-c.z)<18) sc-=14;
}
sc+=laneAlignBonus(this,c.x,c.z); // 本路方位一致的强点优先 (多路推进)
if(sc>bestScore){ bestScore=sc; best=c; }
}
this.objective=best?{id:'X',x:best.x,z:best.z,r:14,owner:1-this.team,cap:0,capTeam:-1,gy:heightAt(best.x,best.z)}:null;
this.defendPt=null;
this.repathT=0;
return;
}
if(GAMEMODE==='convoy'){
// 劫道: 护运方跟随最近存活卡车, 劫道方驻守己方伏击点
const escT=(CAMPAIGN.convoy&&CAMPAIGN.convoy.escortTeam!==undefined)?CAMPAIGN.convoy.escortTeam:1;
if(this.team===escT){
let best=null,bd=1e9;
for(const t of trucks){
if(!t.alive) continue;
const d=Math.hypot(t.pos.x-this.pos.x,t.pos.z-this.pos.z);
if(d<bd){ bd=d; best=t; }
}
this.objective=best?{id:'T',x:best.pos.x+rand(-4,4),z:best.pos.z+rand(-4,4),r:12,owner:this.team,cap:0,capTeam:-1,gy:heightAt(best.pos.x,best.pos.z)}:null;
}else{
let best=null,bd=1e9;
for(const c of spawnPtsOf(this.team)){
const d=Math.hypot(c.x-this.pos.x,c.z-this.pos.z)+rand(0,22);
if(d<bd){ bd=d; best=c; }
}
this.objective=best?{id:'A',x:best.x,z:best.z,r:14,owner:1-this.team,cap:0,capTeam:-1,gy:heightAt(best.x,best.z)}:null;
}
this.defendPt=null;
this.repathT=0;
return;
}
// 丧尸模式守基地 (2026-10-07b 二次裁定): 上一版"守旗评分"实机 Bot 仍四处跑旗 —— 丧尸局旗点经济无意义,
// 唯一任务=守己方基地环形防区 (zDefPosts 单源在 25-zombies)。虚拟旗 (id:'守') 不进 FLAGS ⇒ 永不触发
// 占领/换旗链; 移动消费端 (advance/defend+coverPoints) 对任意 objective 形状通用 (clash 分支同款手法)。
// 同点抱团惩罚取轻 (扎堆守点是常态), 距离就近分派; rand 抖动防两 Bot 永久同点。
if(typeof ZOMBIE_MODE!=='undefined'&&ZOMBIE_MODE){
const posts=(typeof zDefPosts==='function')?zDefPosts(this.team):null;
let bp=null,bs=1e9;
if(posts) for(const p of posts){
 let cnt=0;
 for(const s of soldiers) if(s!==this&&s.alive&&s.team===this.team&&s.objective&&s.objective._zp===p) cnt++;
 const sc=Math.hypot(p.x-this.pos.x,p.z-this.pos.z)+cnt*17+rand(0,9);
 if(sc<bs){ bs=sc; bp=p; }
}
this.objective=bp?{id:'守',x:bp.x,z:bp.z,r:10,owner:this.team,cap:0,capTeam:-1,gy:heightAt(bp.x,bp.z),_zp:bp}:null;
this.defendPt=null;
this.repathT=0;
return;
}
let best=null,bestScore=-1e9;
for(const f of FLAGS){
// (2026-11-10: 瘫舰甲板旗/跨舰远旗两门随大舰子系统下架摘除)
let sc=0;
const d=Math.hypot(this.pos.x-f.x,this.pos.z-f.z);
sc-=d*0.6;
if(f.owner!==this.team) sc+=90;
if(f.owner===this.team&&f.capTeam!==-1&&f.capTeam!==this.team) sc+=140;
if(f.capTeam===this.team&&f.cap>0.05&&d<55) sc+=130;
sc+=laneAlignBonus(this,f.x,f.z); // 本路方位一致的旗点优先 (多路推进)
let cnt=0;
for(const s of soldiers) if(s.alive&&s.team===this.team&&s.objective===f) cnt++;
sc-=cnt*26;
sc+=rand(0,30);
if(sc>bestScore){ bestScore=sc; best=f; }
}
this.objective=best;
this.defendPt=null;
this.repathT=0;
}
perceive(){
const diff=DIFF_TABLE[SETTINGS.diff];
// 夜档实战档 (R2, 昼夜设计 §3.3): 索敌距离 ×viewDMul; FOV 门/蹲姿门基于 viewD 自动收窄。
// 索敌与雾距保持独立常数, 不硬联动 (与白天同口径)。照明弹/探照灯补亮系数在循环内逐目标乘 (N2)。
// 天气乘子 (天气设计 §5-7/R6): 同语义独立相乘, 晴朗 ×1 逐位不变; nightLitMul/探照灯 searchView 块不动。
let viewD=95*diff.visMul*(NIGHT_MODE?NIGHT_CFG.viewDMul:1)*WX_CFG.viewDMul;
let best=null,bestD=1e9;
const eye=_pvEye.set(this.pos.x,this.pos.y+(this.prone?0.5:this.crouch?1.15:1.62),this.pos.z); // 复用槽 (见文件头注释)
// 环境暗度只读全局 (2026-11-01 性能批外提): 循环内逐候选重算 getEnvBrightness 是纯重复
const envLum=(typeof getEnvBrightness==='function')?getEnvBrightness():(NIGHT_MODE?0.12:1.0);
const darkRatio=clamp(1.0-envLum,0,1);
// ★2026-11-03 (实机"隔着墙对目标开火"主根因) 当前目标优先复核:
// 旧版 RAY_BUDGET (12 发/帧全 Bot 共享) 被排在前面的 Bot 吃干时, 循环内对"当前目标"**不做任何射线
// 直接沿用旧通视状态** ⇒ lastSeenT 每周期照常刷新 ⇒ 开火门 (lastSeenT<0.6) 永远开着, 人缩到墙后
// 仍朝其实时坐标泼弹。现在: 本周期先把当前目标的通视复核做掉 (超预算也照发 —— 每次 perceive 至多
// +1 发, 22 人表 ≈ +2.3 发/帧, 换"不隔墙开火"), 循环内 isCur 分支只消费结论 _curBlk。
// 复核口径与循环内逐位一致: 世界遮挡 (-0.6m 裕量) + 烟/庄稼/植被 + 潜水隐蔽。
this._curBlk=false;
if(this.target&&this.target.alive&&!this.target.onVehicle&&!this.target.spectator&&nowT-this.lastSeenT<3){
const t0=this.target;
const d0=Math.hypot(t0.pos.x-this.pos.x,t0.pos.z-this.pos.z);
if(d0>=0.5){
const tp0=_pvT.set(t0.pos.x,t0.pos.y+(t0.crouch?1.0:1.4),t0.pos.z);
const dir0=_pvD.copy(tp0).sub(eye); const dist0=dir0.length(); dir0.normalize();
RAY_BUDGET.used++;
const bh=raycastWorld(eye,dir0,dist0);
let blk=!!(bh&&bh.dist<dist0-0.6);
if(!blk&&SMOKES.length&&smokeBlocksLOS(eye.x,eye.y,eye.z,tp0.x,tp0.y,tp0.z)) blk=true;
if(!blk&&CROP_FIELDS.length&&cropBlocksLOS(eye.x,eye.y,eye.z,tp0.x,tp0.y,tp0.z)) blk=true;
if(!blk&&foliageBlocksLOS(eye.x,eye.y,eye.z,tp0.x,tp0.y,tp0.z)) blk=true;
if(!blk&&d0>UW_HIDE_RANGE&&headDepthAt(t0.pos.x,t0.pos.y,t0.pos.z)>UW_HIDE_DEPTH) blk=true;
this._curBlk=blk;
}
}
for(const e of combatants){
if(!e.alive||e.team===this.team||e.onVehicle||e.spectator) continue; // 观战者不被索敌
const dx=e.pos.x-this.pos.x, dz=e.pos.z-this.pos.z;
const d2=dx*dx+dz*dz;   // 平方入账: 拒绝路径不再开方 (2026-11-01 性能批), 过门者才取 d (Math.hypot 原值)
// 夜档补亮 (N2, 昼夜设计 §4.2/§4.3): 照明半径内目标 viewD ×flareLitView; 被探照灯照中 ×searchView
// 且无视 FOV 门。nightLitMul 单源在 08-effects (白天恒 1, 判定逐位不变)。
let vD=viewD;
if(e===player) vD*=diff.pVis; // 对玩家视距拆列 (2026-10-06 难度批): 只收"发现玩家"的距离, Bot 互瞥不变
if(NIGHT_MODE){
vD*=nightLitMul(e.pos.x,e.pos.y,e.pos.z);
this._eSearchLit=!!(e._searchLitT&&nowT-e._searchLitT<0.6);
if(this._eSearchLit) vD=Math.max(vD,viewD*NIGHT_GEAR.searchView);
}else this._eSearchLit=false;
// 开灯极度暴露 (根据环境暗度动态联动计算手电筒/大灯暴露度与余光散射视锥)
const eFlOn=!!(e.flashlight);
const eVehOn=!!(e.lightsOn||(e.onVehicle&&e.onVehicle.lightsOn));
if(eFlOn||eVehOn){
const baseExpo=eFlOn?((typeof NIGHT_GEAR!=='undefined'&&NIGHT_GEAR.flExpo)?NIGHT_GEAR.flExpo:2.0):((typeof NIGHT_GEAR!=='undefined'&&NIGHT_GEAR.headExpo)?NIGHT_GEAR.headExpo:1.8);
const expo=1.0+(baseExpo-1.0)*(0.1+0.9*darkRatio);
vD*=expo;
}
if(d2>vD*vD*1.000001) continue;   // 平方预门: 1e-6 相对裕量 >> hypot 1ulp 误差, 拒绝集与旧门逐位同 (2026-11-01)
const d=Math.hypot(dx,dz);
if(d>vD) continue;
// 伞降目标一律不索敌 (2026-09-30 用户裁定, 加严于 A#8 的 25m 门): 跳伞不是被集火靶子, 落地才恢复可被索敌。
// 还击路径 (damage 里的 attacker 门) 保留 botEngageR —— 伞兵主动开火近距挑衅仍会挨还击, 不白嫖。
if(chuteAirborne(e)) continue;
const ang=Math.atan2(dx,dz);
const isCur=(e===this.target&&nowT-this.lastSeenT<3);
const maxAng=(eFlOn||eVehOn)?(1.15+(2.4-1.15)*darkRatio):1.15; // 周围 Bot 余光散射视锥放宽角随 darkRatio 在 1.15 到 2.4 之间平滑过渡
// ★2026-11-14 (实机"面对面擦肩走过像没看见"之二): 近距脚步感知必须压在 FOV 门**之前** ——
// 旧版 heard 在 FOV 门之后才算, d<9 对朝向门是死代码 (verify-botprox S2/S5 红先实锤: 背后 8m 视而不见)。
// heardClose 只豁免朝向门 (脚步是全向的); 听枪 (heard 的第二支) 方位不明, 保持旧语义不豁免 FOV
// —— 枪声只走循环外 gunEvents 兜底块 (记 lastSeenPos 不锁目标, weather/daynight 探针钉此语义)。
// 蹲行脚步声减半 (4m): 蹲姿潜行从背后接近仍有效; 9m 全向只对站立/奔跑目标成立。
const heardClose=d<(e.crouch?4:9);
const heard=heardClose||(e.lastFiredT&&nowT-e.lastFiredT<1.5&&d<70*(NIGHT_MODE?NIGHT_CFG.hearGunMul:1)*WX_CFG.hearGunMul); // 听枪半径: 夜档加大(开火暴露) ×天气缩小 (天气设计 §5-8)
if(!isCur&&!this._eSearchLit&&!heardClose&&Math.abs(angDiff(this.yaw,ang))>maxAng) continue;
if(!isCur&&!heard&&d>vD*0.85&&e.crouch) continue;
const tp=_pvT.set(e.pos.x,e.pos.y+(e.crouch?1.0:1.4),e.pos.z); // 复用槽: 本迭代内消费完, 不跨候选持有
const dir=_pvD.copy(tp).sub(eye); const dist=dir.length(); dir.normalize();
if(isCur){
// ★2026-11-03: 当前目标的通视复核已在循环外带优先权做掉 (见循环前 _curBlk 块), 这里只消费结论;
// 被挡 ⇒ 本周期不再把当前目标记为可见 (lastSeenT 停止刷新 ⇒ 0.6s 后开火门自然关上, 转压制)。
if(this._curBlk) continue;
}else if(d<PROX_SPOT_R||RAY_BUDGET.used<RAY_BUDGET.maxPerFrame){
// ★2026-11-14 (实机"面对面擦肩走过像没看见"之一): 近距强制感知 —— PROX_SPOT_R 内的候选射线
// 不吃预算门 (超预算也照发, 与上方"当前目标优先复核"同款超发特权, 照旧入账)。根因: 全体共享
// 12 发/帧在混战中超订阅, 排在更新序后面的 Bot 每轮拿 0 发新目标射线, 贴脸的陌生敌人永远
// 进不了 target (verify-botprox S1/S9 红先实锤)。近距射线天然短 (≤12m), 成本远低于 95m 远射;
// 远距候选超预算仍跳过 (饿死语义保持 = botai-T2 26m 端到端兼容)。
RAY_BUDGET.used++;
const blockHit=raycastWorld(eye,dir,dist);
if(blockHit&&blockHit.dist<dist-0.6) continue;
}else{
continue; // 超预算且非当前目标: 推迟到下一周期检测 (近距豁免在上一分支, 远距饿死语义保持)
}
// 烟雾遮蔽: bot 无法看穿烟墙
if(SMOKES.length&&smokeBlocksLOS(eye.x,eye.y,eye.z,tp.x,tp.y,tp.z)) continue;
// 高杆庄稼遮蔽: 视线穿入作物田(交点低于作物顶)视为隐蔽; 子弹仍可穿透(与烟雾同一套逻辑)
if(CROP_FIELDS.length&&cropBlocksLOS(eye.x,eye.y,eye.z,tp.x,tp.y,tp.z)) continue;
// 植被软遮蔽 (2026-09-20 I5 塔拉瓦植被加密批): 活着的灌木蓬面/蕨丛/树冠挡视线, 只在射线真的穿过
// 蓬面高度带时生效; 与烟雾/庄稼同一套 continue 语义, **不挡子弹** (弹道链零引用, 见 04b-fire 注释)
if(foliageBlocksLOS(eye.x,eye.y,eye.z,tp.x,tp.y,tp.z)) continue;
// 潜水隐蔽 (2026-09-18 塔拉瓦批): 目标头部没入水面 >UW_HIDE_DEPTH → 被水面遮蔽 (潜泳接近滩头的手段);
// 仅 UW_HIDE_RANGE 米内或开火暴露才算被发现 —— 与载荷命中口径分开 (子弹入水另见 13-combat)
if(d>UW_HIDE_RANGE&&headDepthAt(e.pos.x,e.pos.y,e.pos.z)>UW_HIDE_DEPTH) continue;
// ★2026-10-26 指挥官交互重做批 (用户需求 3 集火): 集火点附近的目标优先。
//   判据单源在 26-commander 的 cmdFocusBonus (它读本单位的 focus 令并做"圈内顶到最前 / 圈外线性衰减");
//   本文件只把它加进距离分, 不重复实现半径/过期判断 —— 与 R12 敌显单源同一纪律。
//   cmdFocusBonus 缺失时 (只加载 14-bots 的极端沙箱) 返回 0, 选目标逻辑逐位不变 = 零回归。
const _fb=(typeof cmdFocusBonus==='function'&&this.cmdGrp)?cmdFocusBonus(this.cmdGrp,e.pos.x,e.pos.z):0;
const _score=d-_fb;
if(_score<bestD){ best=e; bestD=_score; }
}
if(best){
if(this.target!==best||nowT-this.lastSeenT>2){
if(this.target!==best){
const _pT=(best===player); // 反应/甩枪对玩家拆列 (2026-10-06 难度批): 互殴维持 react/spreadMul
this.reactT=(_pT?diff.pReact:diff.react)*rand(0.7,1.4);
// 拟人"甩枪": 换目标瞬间带初始偏差, 随后收敛
this.aimErrX=rand(-1,1)*0.055*(_pT?diff.pSpread:diff.spreadMul);
this.aimErrY=rand(-0.6,0.6)*0.04*(_pT?diff.pSpread:diff.spreadMul);
}
this.target=best;
}
this.lastSeenPos.copy(best.pos);
this.lastSeenT=nowT;
this.aimSettle=Math.min(1,this.aimSettle+0.16);
} else {
this.aimSettle=Math.max(0.2,this.aimSettle-0.1);
if(this.target&&(!this.target.alive||nowT-this.lastSeenT>8)) this.target=null;
}
if(!this.target){
for(const ev of gunEvents){
if(ev.team===this.team) continue;
const d=Math.hypot(ev.x-this.pos.x,ev.z-this.pos.z);
if(d<65*(NIGHT_MODE?NIGHT_CFG.hearGunMul:1)*WX_CFG.hearGunMul&&nowT-ev.t<0.4&&ev.shooter&&ev.shooter.alive){
this.lastSeenPos.set(ev.x,0,ev.z);
if(nowT-this.lastSeenT>4) this.lastSeenT=nowT-3.5;
}
}
}
}
decide(){
if(this.state==='toSupply') return;   // 弹尽补给承诺期 (2026-11-03): decide 不抢状态, 放弃条件在执行段与 damage 门里
const engaged=this.target&&nowT-this.lastSeenT<4;
const seenNow=this.target&&nowT-this.lastSeenT<1.6;
const distT=engaged?Math.hypot(this.target.pos.x-this.pos.x,this.target.pos.z-this.pos.z):0;
if(this.empUse){
const g=this.empUse;
let done=false;
if(g.kind==='at'){ const t=enemyTankNear(this,150); if(!t) done=true; }
else { if(!enemyPlaneAlive(this.team)) done=true; }
this.empT-=0.5;
if(done||this.empT<=0||(engaged&&distT<8)){ releaseEmpl(g,true); this.empUse=null; }
else return;
}
if(this.mgUse){
this.mgT-=0.5;
// 解除回旋限制后不再按朝向判断威胁, 只看是否仍有交战目标
const stillThreat=engaged&&distT>6;
if(this.mgT<=0||(engaged&&distT<7)||(!stillThreat&&this.mgT<12)){ releaseEmpl(this.mgUse,true); this.mgUse=null; }
else return;
}
// 迫击炮操作态 (2026-09-25 修): 与 empUse/mgUse/batUse/emCast 同构 —— 认领期间不再往下走机动/选目标决策。
// 旧版这里**没有**这一条, 于是炮位上的 Bot 仍会走完整条决策链: 15m 内有空闲 MG42/AA/AT 就会二次认领
// (MG 那条门闸只判了 !mgUse), 认领成功后 update() 里 mgUse 分支先于 mortUse return ⇒ 迫击炮的
// releaseEmpl 在 MG 任期内不可达, 那门炮对玩家和其他 Bot 一直显示"占用中"。
// 释放规则全在 update() 的 mortUse 分支里 (mortT/敌人逼近/压制), 与本条只挡"再认领"不冲突。
if(this.mortUse) return;
// A#9 岸防炮操作态 (契约 §6): 认领后每 0.5s 复核一次 —— 炮毁/被玩家接管/占位易主/到时/海面无敌艇 ⇒ 释放。
// 释放后不再有本帧决策 (往下走正常的步兵逻辑), 与 mgUse/empUse 的写法同构。
if(this.batUse){
const g=this.batUse;
this.batT-=0.5;
if(!g||g.alive===false||g.crewBot!==this||this.batT<=0) this.releaseBattery();
else if(!batteryTargetFor(g)) this.releaseBattery();      // 目标丢失即释放 (契约 §6)
else return;
}
// 固定火力点使用前摇期间: 原地操作, 不机动不换目标 (与玩家同规)
if(this.emCast){ this.state='defend'; this.path=null; return; }
// 上炮位接近段 (2026-09-20 闪现修复): 已经选中某门炮 → 先走到站位, 到了下一帧才起前摇。
// 炮被抢/报废/走太久 → 放弃 (不让 bot 围着炮打转)。这就是"走过去上炮"的那段路。
// A#9: 岸防炮走同一条路 (emplGo.kind==='bat'), 只是接近半径/超时由 emplMount 的第三/四参给。
if(this.emplGo){
const eg=this.emplGo, g=eg.g;
if(!g||eg.kind!=='bat'&&g.dead||nowT>eg.exp) this.emplGo=null;
else if(eg.kind==='bat'){
// A#9: 岸防炮的占有轨是 user/crewBot 双轨 (empReady 不看 crewBot, 这里自己看)
if(g.alive===false||g.crewBot||g.user||!batteryTargetFor(g)) this.emplGo=null;
else if(this.emplMount(g,'bat',BAT_APPROACH_R,BAT_GO_TIMEOUT)) return;
else this.emplGo=null;
}
else if(!this.emplMount(g,eg.kind)) this.emplGo=null;
else return;
}
// 小队指令: 最高优先级, 只有敌人近身(20m内)才暂缓执行。
// ★2026-11-13 观战中立批: player.spectator (调试观战/自由观战/部署页观战) 时小队不再听令 ——
// 旧门只有 follow 分支的 player.alive, 调试观战 alive=true ⇒ 小队跟着幽灵满图跑 (用户实报);
// move (标点进攻) 分支连 alive 门都没有, 一并堵上。观战者不指挥任何一方 (与 T/Y 键的观战拦截同规)。
if(this.inSquad&&!player.spectator&&!(engaged&&distT<20)){
if(SQUAD.mode==='move'){
const d=Math.hypot(SQUAD.pos.x-this.pos.x,SQUAD.pos.z-this.pos.z);
if(d>7){
this.state='advance';
if(!this.path||this.repathT<=0){ this.setPathTo(SQUAD.pos.x+rand(-4,4),SQUAD.pos.z+rand(-4,4)); this.repathT=rand(2,3); }
return;
}
if(!engaged){
this.state='defend';
if(Math.random()<0.12) this.setPathTo(SQUAD.pos.x+rand(-5,5),SQUAD.pos.z+rand(-5,5));
return;
}
}
else if(SQUAD.mode==='follow'&&player.alive&&!player.onVehicle){
const d=Math.hypot(player.pos.x-this.pos.x,player.pos.z-this.pos.z);
if(d>10){
this.state='advance';
if(!this.path||this.repathT<=0){ this.setPathTo(player.pos.x+rand(-3,3),player.pos.z+rand(-3,3)); this.repathT=rand(1.2,2); }
return;
}
if(!engaged){
this.state='defend';
this.crouch=player.crouch&&d<6;
return;
}
}
}
// ── 指挥官组令 (2026-10-26 指挥官批, 26-commander; 设计 §5): 心灵控制 = 直接覆写目标状态 ──
// 不动 Bot 决策核心 —— 与上面 SQUAD 块同一款"拦截式"消费: attack_move 途中照常索敌接战
// (敌近身暂缓执行的门与小队令同规), 到点转 defend 占旗; hold 到点定身守点 (不再换位) 接战还击;
// free 组 (及无编制 Bot) 不进本块 = 默认 AI 零回归。编制挂组不挂人 (D16): 命令从 this.cmdGrp.order
// 读, 组员阵亡重生 (spawn 不清 cmdGrp) 自动继承本组当前令。
// ★2026-10-26 排查轮修: 本块缺「敌近身暂缓执行」门 —— 上面 SQUAD 块有 `!(engaged&&distT<20)`, 这里没有,
//   于是敌人贴到 6m 时组员仍被判去 134m 外的令点 (state=advance + setPathTo), 等于当着敌人的面掉头就走。
//   与本节注释「敌近身暂缓执行的门与小队令同规」直接矛盾, 也违背设计 §5「心灵控制 = 覆写目标状态,
//   不动 Bot 决策核心」—— 自卫是决策核心, 令不该压过贴脸接战。补同一个门 (同源判据 engaged/distT)。
if(this.cmdGrp&&!(engaged&&distT<20)){
const _co=this.cmdGrp.order;
if(_co&&_co.mode!=='free'){
const _cd=Math.hypot(_co.x-this.pos.x,_co.z-this.pos.z);
if(_cd>(_co.mode==='hold'?5:7)){
this.state='advance';
if(!this.path||this.repathT<=0){ this.setPathTo(_co.x+rand(-4,4),_co.z+rand(-4,4)); this.repathT=rand(2,3); }
return;
}
if(!engaged){
this.state='defend';
if(_co.mode!=='hold'&&Math.random()<0.12) this.setPathTo(_co.x+rand(-5,5),_co.z+rand(-5,5));
return;
}
}
}
const eTank=enemyTankNear(this,120);
// 水面载具扫描 (§5.4 步兵反应, 2026-09-20N 海战批): 在 enemyTankNear() 之后**追加一次** navalNear() 扫描 ——
// 15d 的 navalNear 只返回 alive 且未沉的载具; 函数体不改 enemyTankNear 一行 (13/15 的既有敌方装甲判定零漂移)。
// 只有反装甲兵 (cls 3 火箭筒/反坦克枪档, 2026-09-28 兵种8→5 原 cls5) 用得到, 别的兵种连扫描都不做 (省一次 60 人表遍历)。
const eCraft=(this.cls===3&&typeof navalNear==='function'&&!this.onVehicle)
?navalNear(this.pos.x,this.pos.z,115,1-this.team):null;
// 筒子自动打坦克
if(this.cls===3&&eTank&&eTank.alive&&this.slots&&this.slots[0]&&this.slots[0].def.rocket){
const w2=this.slots[0];
if(w2.mag>0&&this.fireT<=0&&this.reloadT<=0&&Math.hypot(eTank.pos.x-this.pos.x,eTank.pos.z-this.pos.z)<65){
const eye2=this.eyePos();
const dTk=Math.hypot(eTank.pos.x-this.pos.x,eTank.pos.z-this.pos.z);
const dir2=V3(eTank.pos.x-eye2.x,eTank.pos.y+1.2-eye2.y,eTank.pos.z-eye2.z).normalize();
// ★2026-11-03 (实机"隔着墙开火"之三): 旧版射线打到 65m 定长、命中 50m 内才放弃 —— 与目标实际距离脱钩,
// 隔半堵墙也照发 (浪费一次性火箭且自伤)。收紧到与下方反坦克枪分支同款: 打到**目标实际距离**, 除贴脸 3m 裕量外被挡就不发。
const chk=raycastWorld(eye2,dir2,dTk);
if(!chk||chk.dist>dTk-3){
this.lastFiredT=nowT;
this.switchVisualGun(w2.key);
this.visualGunTimer=nowT+1.8;
fireRocket(this,eye2,dir2,w2.def,V3(eTank.pos.x,eTank.pos.y,eTank.pos.z));
w2.mag=0; this.mag=0; this.fireT=3.6;
}}}
// 反坦克枪手打坦克 (PTRD/博伊斯/九七式自动炮)
if(this.cls===3&&eTank&&eTank.alive&&this.def.atRifle&&this.mag>0&&this.fireT<=0&&this.reloadT<=0&&this.boltT<=0){
const dTk=Math.hypot(eTank.pos.x-this.pos.x,eTank.pos.z-this.pos.z);
if(dTk<95){
const eye2=this.eyePos();
const dir2=V3(eTank.pos.x-eye2.x,eTank.pos.y+1.3-eye2.y,eTank.pos.z-eye2.z).normalize();
const chk=raycastWorld(eye2,dir2,dTk);
if(!chk||chk.dist>dTk-3){
this.yaw=Math.atan2(eTank.pos.x-this.pos.x,eTank.pos.z-this.pos.z);
const er2=0.012*DIFF_TABLE[SETTINGS.diff].spreadMul;
dir2.x+=rand(-er2,er2); dir2.y+=rand(-er2,er2)*0.5; dir2.z+=rand(-er2,er2); dir2.normalize();
const muzz=eye2.clone().addScaledVector(dir2,0.9);
this._src=this.def.name||''; // 击杀来源: 当前武器名
fireBullet(this,eye2,dir2,this.def,muzz);
this.mag--;
if(this.slots&&this.slots[0]) this.slots[0].mag=this.mag;   // 弹药账对齐 (2026-11-03)
this.mesh.armR.sh.userData.swing=0.15;
this.fireT=60/this.def.rpm*rand(1.2,1.8);
if(this.def.type==='bolt') this.boltT=this.def.boltT||1.2;
if(this.mag<=0&&this.canReload()) this.reloadT=this.def.reload*dynReloadFac(this.mag,this.def.mag); // 动态换弹速度 (2026-11-12, 单源 dynReloadFac)
this.prone=dTk>30;
}
}
}

// 反装甲兵对水面载具 (§5.4, 2026-09-20N): 打坦克的两条分支**优先** (上面已先后执行), 只有在没有活坦克可打时
// 才转向水面目标 —— 与打坦克同一档火力 (火箭筒 <65m 走同一支 fireRocket; 反坦克枪 <95m 走同一支 fireBullet)。
if(eCraft&&eCraft.alive&&(!eTank||!eTank.alive)) navInfATShip(this,eCraft);
if(eTank){
const dTank=Math.hypot(eTank.pos.x-this.pos.x,eTank.pos.z-this.pos.z);
if(this.atn>0&&this.nadeCd<=0&&dTank<26){
this.state='atnade'; this.nadeAnimT=0.8; this.atTankTarget=eTank;
return;
}
if(dTank<130){
for(const g of ATGUNS){
if(!empReady(g)) continue; // 占用中/上炮冷却中(下炮后EMP_REARM_T秒)
// 2026-09-20 闪现修复: 旧版在这里 (最远 16m 外) 直接 g.user=this + 起前摇, 前摇期间站住不动,
// 计时到就硬 set 到炮位 → 单帧闪现 8~18m。改走 emplMount: 到站位半径内才起前摇, 否则先走过去。
// (empInReach 的 16m 保留为"兴趣半径": 超出就不惦记这门炮, 行为面不变)
if(empInReach(g,this.pos.x,this.pos.y,this.pos.z,16)&&this.emplMount(g,'at')) return;
}
}
if(this.cls===1&&this.atn>0&&dTank<55&&!engaged){
this.state='hunt';
if(!this.path||this.repathT<=0){
this.setPathTo(eTank.pos.x+rand(-8,8),eTank.pos.z+rand(-8,8));
this.repathT=2.5;
}
return;
}
if(dTank<32&&this.cls!==2&&this.state!=='cover'&&Math.random()<0.5){
const cp=this.findCoverFrom(eTank.pos);
if(cp){ this.state='cover'; this.coverPt=cp; this.coverT=rand(2.5,5); this.setPathTo(cp.x,cp.z); return; }
}
}
const ePlane=enemyPlaneAlive(this.team);
if(ePlane&&!engaged&&!this.inSquad&&Math.random()<0.4){
for(const g of AAGUNS){
if(!empReady(g)) continue;
if(empInReach(g,this.pos.x,this.pos.y,this.pos.z,15)&&this.emplMount(g,'aa')) return;
}
}
// A#9 岸防炮 (契约 §6, 与 ATGUNS 同规则): 没在近身交战/不在小队/没有别的炮位在用时, 去岬角上炮。
// 三层门: ①3 参 batteryNear = 15f 冻结的"可上炮"语义 (存活 + user/crewBot 皆空 + 过了重上冷却);
//         ②炮位阵营必须是自己队 (反舰炮位是日军专属设施, 敌方 Bot 不该去操作);
//         ③海面上确有敌艇 (batteryTargetFor) —— 否则只是站岗, 不如去打陆战。
// 随机门 0.4/次 是防"整队同时扑向同一门炮" (与 AAGUNS 分支同款门控写法)。
if(!engaged&&!this.inSquad&&!this.pilotOf&&!this.batUse&&!this.mgUse&&!this.empUse&&!this.mortUse&&!this.emCast
&&typeof batteryNear==='function'&&typeof BATTERIES!=='undefined'&&BATTERIES.length&&Math.random()<0.4){
const bg=batteryNear(this.pos.x,this.pos.z,BAT_APPROACH_R);
if(bg&&bg.alive!==false&&bg.team===this.team&&!bg.crewBot&&!bg.user&&batteryTargetFor(bg)&&this.emplMount(bg,'bat',BAT_APPROACH_R,BAT_GO_TIMEOUT)) return;
}
if(seenNow){
// 丧尸不肉搏 (2026-10-28 修复, 指导 §4.3(3)): 人类 Bot 见丧尸贴脸仍切刺刀 = 自杀式冲进尸群白送
// —— 尸潮口径下近战交换永远亏 (一换多)。守卫后 Bot 保持枪械交战 (perceive 本就把丧尸算敌方);
// 普通对战无丧尸 ⇒ 条件恒假, 逐位零变化。
if(distT<2.6&&!(this.target&&this.target.zombie)){ this.state='melee'; return; }
if(this.state==='cover'&&this.coverPt){
// 掩体驻留: 探头循环接管交战, 不被机动层打断 (旧版0.4s就跳出掩体)
if(this.coverT>0.4&&(this.reloadT>0||this.suppression>0.55||this.hp<50)) return;
}
// 受压制时丢烟雾遮蔽后撤
if(this.smokes>0&&this.smokeCd<=0&&this.suppression>1.0&&Math.random()<0.55){
const eye=this.eyePos();
const dir=V3(this.lastSeenPos.x-this.pos.x,0,this.lastSeenPos.z-this.pos.z).normalize();
this._src='烟雾弹';
throwNade(this,eye,dir.multiplyScalar(7).add(V3(0,3,0)),1.6,false,true);
this.smokes--; this.smokeCd=rand(20,32);
this.mesh.armR.sh.userData.swing=0.4;
}
	// 重伤/换弹/被压: 进掩体 (到位后进入探头循环); 刚离开掩体有重进冷却——否则会在掩体间来回蹦(反复横移主因)
	if((this.reloadT>0.3||this.suppression>1.05||this.hp<32)&&Math.random()<0.8){
	if(this.state!=='cover'||!this.coverPt){
	const cp=this.pickCoverNow();
	if(cp){ this.enterCover(cp,rand(1.4,2.6)+(this.reloadT>0?this.def.reload:0)); return; }
	if(this.coverCd>0&&this.hp>=32) return; // 冷却中无处可回: 原地坚持还击
	} else return;
	}
if(this.nades>0&&this.nadeCd<=0&&distT>9&&distT<30){
const hidden=nowT-this.lastSeenT>1.2;
let cluster=0;
for(const e of combatants) if(e.alive&&e.team!==this.team&&e.pos.distanceTo(this.target.pos)<7) cluster++;
if((hidden&&Math.random()<0.5)||(cluster>=2&&Math.random()<0.4)){
this.state='nade'; this.nadeAnimT=0.8;
return;
}
}
	// 机动未到期且局势未恶化: 延续当前机动 (防抖——不再每0.5s重抽姿态; 掩体状态除外; 驻停不被压制打断)
	if(this.state!=='cover'&&this.manT>0&&(this.suppression<1.1||this.man==='hold')&&(this.man==='hold'||this.man==='slide'||(this.man==='push'&&this.pushPt))){ this.state='combat'; this.coverPt=null; return; }
// 选新机动: 攻击性=性格×难度, 情境加成 (对手被压/刚停火/局部人多/目标旗在争夺)
const aggrD=[0.65,1,1.3][SETTINGS.diff];
let allies=0;
for(const s of soldiers){ if(s!==this&&s.alive&&s.team===this.team&&!s.onVehicle){ const dd2=(s.pos.x-this.pos.x)**2+(s.pos.z-this.pos.z)**2; if(dd2<400) allies++; } }
const tSup=this.target.suppression||0;
const tStop=nowT-(this.target.lastFiredT||-9);
let pushP=0.10*this.aggro*aggrD;
if(tSup>0.7) pushP+=0.30;
if(tStop>1.1&&tStop<3.5) pushP+=0.22;
if(allies>0) pushP+=Math.min(0.26,allies*0.13);
const fo=this.objective;
if(fo&&distT<55&&(fo.owner!==this.team||(fo.capTeam!==-1&&fo.capTeam!==this.team))) pushP+=0.22;
pushP=Math.min(pushP,0.85);
this.state='combat'; this.coverPt=null;
if(distT>14&&this.suppression<0.9&&Math.random()<pushP){
// 跃进: 借前出掩体逐段逼近 (掩体间跃进)
const pc=this.findCoverToward(this.target.pos.x,this.target.pos.z);
this.man='push'; this.manT=rand(2.6,4.0);
if(pc){ this.pushPt={x:pc.x,z:pc.z}; this.setPathTo(pc.x,pc.z); }
else { this.pushPt={x:this.pos.x+(this.target.pos.x-this.pos.x)*0.45,z:this.pos.z+(this.target.pos.z-this.pos.z)*0.45}; this.path=null; }
this.repathT=rand(2.5,3.5);
this.crouch=false; this.prone=false; this.stance='stand';
return;
}
	if(this.suppression>0.85||this.hp<55){
	// 压制下撤入掩体 (统一入口: 粘滞优先/冷却门控); 无掩体可进时按冷却侧移或原地蹲住还击
	const cp=this.pickCoverNow();
	if(cp){ this.enterCover(cp,rand(1.6,2.8)); return; }
	if(this.slideCd<=0){
	// 侧移脱离火力线: 方向延续不换边 + 冷却, 替代旧版无限左右蹦
	this.man='slide'; this.manT=rand(0.7,1.0); this.slideCd=rand(2.5,4.0);
	this.stance='crouch'; this.crouch=true; this.prone=false;
	} else {
	this.man='hold'; this.manT=rand(0.8,1.4);
	this.stance='crouch'; this.crouch=true; this.prone=false;
	}
	return;
	}
	if(distT<13&&this.slideCd<=0&&Math.random()<0.38*aggrD){
	// 近战侧移: 一次有界横移 (带冷却)
	this.man='slide'; this.manT=rand(0.7,1.1); this.slideCd=rand(2.5,4.0);
	return;
	}
	// 驻停射击: 姿态按距离/压制选定; 连续驻停保持原姿态 (防蹲站闪烁), 到期由 decide 重抽
	const wasHold=this.man==='hold';
	this.man='hold'; this.manT=rand(1.2,2.2);
	const ns=distT>40?(this.suppression>0.5||this.cls===2?'prone':'crouch')
	:distT>22?(this.cls===2?'prone':(Math.random()<0.7?'crouch':'stand'))
	:(this.suppression>0.9?'crouch':'stand');
	if(!(wasHold&&Math.random()<0.85)) this.stance=ns;
	return;
}
// 火力压制: 目标刚消失(0.6~2.6s)时朝最后目击位补点射
if(this.target&&this.target.alive&&this.mag>this.def.mag*0.25&&this.suppression>0.2&&nowT-this.lastSeenT>0.5&&nowT-this.lastSeenT<2.6&&Math.random()<0.35) this.supFireT=rand(0.5,1.0);
// 掩体内换弹/压制冷却: 视线断了也不贸然冲出去 (探头循环在 update 中继续)
if(this.state==='cover'&&this.coverPt&&this.coverT>0.4&&(this.reloadT>0||this.suppression>0.55||this.hp<50)&&nowT-this.lastSeenT<9) return;
if(this.target&&nowT-this.lastSeenT<9){
this.state='hunt';
if(!this.path||this.repathT<=0){ this.setPathTo(this.lastSeenPos.x+rand(-3,3),this.lastSeenPos.z+rand(-3,3)); this.repathT=3; }
return;
}
this.target=null;
// 脱战后打绷带
if(this.hp<=60&&this.bandages>0&&this.bandageT<=0&&nowT-this.lastSeenT>4){
this.bandageT=2.6; this.path=null;
return;
}
// 破袭: 进攻方接近补给库时用手雷炸毁
if(GAMEMODE==='demolition'&&this.team===ATK){
const dp=nearestDepot(this.pos.x,this.pos.z);
if(dp&&this.nades>0&&this.nadeCd<=0){
const dd=Math.hypot(dp.x-this.pos.x,dp.z-this.pos.z);
if(dd<26){
this.state='nade'; this.nadeAnimT=0.8;
this.lastSeenPos.set(dp.x,0,dp.z);
return;
}
}
}
// 附近有空载具时上车 (专属飞行员和小队成员除外); D16 (2026-10-26): 指挥组令非 free 态同样不上 (cmdBotFree 单源)
if(!this.pilotOf&&!this.inSquad&&(typeof cmdBotFree==='function'?cmdBotFree(this):true)){
for(const tv of tanks){
if(!tv.alive||tv.team!==this.team||tv.crewBot||tv.playerDriven) continue;
if((tv.noEnterT||0)>nowT) continue;
// ★2026-11-03: 自己刚在这辆车上"顶壳 6s 上不去"拉黑期内 ⇒ 不再认领 (否则下一拍又认领同一辆 = 兵在坦克前无限 yo-yo)
if(this.vehFailV===tv&&nowT<this.vehFailT) continue;
if(tv.hp<tv.maxHp*0.4) continue;
if(tv.claimBot&&tv.claimBot.alive&&tv.claimBot!==this&&tv.claimBot.targetVeh===tv&&nowT-(tv.claimT||0)<8) continue;
const dv=Math.hypot(tv.pos.x-this.pos.x,tv.pos.z-this.pos.z);
if(dv<85){
tv.claimBot=this;
tv.claimT=nowT;
this.targetVeh=tv;
this.vehGoT=0; // 新认领清贴壳计时 (2026-11-03)
this.state='toVehicle';
if(!this.path||this.repathT<=0){ this.setPathTo(tv.pos.x,tv.pos.z); this.repathT=2.2; }
return;
}
}
}
// (2026-09-28 阶段三 P1: 医护兵兵种删除, Bot 医疗箱放置分支随撤 —— 医疗箱=工程兵建造件 (玩家侧), Bot 仍可从医疗箱取绷带)
// ★2026-11-03 目标粘滞 (H 修): 旧版每拍 6% 概率随机换目标 ⇒ Bot 走到半路掉头往返 (实机"不知道在干什么")。
// 现在三种情况才换: 没目标 / 己方旗正被敌方占领 (紧急, 立刻重选) / 粘滞计时 (pickObjective 选定即给 4~7s) 走完。
const _fo=this.objective;
if(!_fo||(_fo.owner===this.team&&_fo.capTeam!==-1&&_fo.capTeam!==this.team)||(this.objHoldT<=0&&Math.random()<0.06)) this.pickObjective();
const f=this.objective;
if(!f) return; // 无旗点模式兜底: 目标缺失时本帧只维持索敌与射击
const dObj=Math.hypot(this.pos.x-f.x,this.pos.z-f.z);
if(dObj<f.r*0.85){
this.state='defend';
// 工程兵: 防守时架设迫击炮 (炮口朝敌方基地) —— 2026-09-28 兵种 8→5: 原迫击炮兵(cls6)分支并入工程兵(cls4)
if(this.cls===4&&!this.mortarPlaced&&!this.mortUse&&!this.mgUse&&!this.empUse&&Math.random()<0.35){
const eb=basePos(1-this.team);
const dyaw=Math.atan2(eb.x-this.pos.x,eb.z-this.pos.z);
if(deployMortar(this,this.pos.x+Math.sin(dyaw)*1.3,this.pos.z+Math.cos(dyaw)*1.3,dyaw)){
this.decisionT=rand(0.5,1);
}
}
// 空闲迫击炮: 防守Bot就近上炮 (工程兵优先; 使用前摇与玩家同规)
if(!this.mortUse&&!this.mgUse&&!this.empUse&&Math.random()<(this.cls===4?0.5:0.12)){
for(const mo of MORTARS){
if(!mo.alive||!empReady(mo)) continue;
// 2026-09-20 闪现修复: 兴趣半径保留, 改成"走到站位才起前摇"
if(Math.hypot(mo.x-this.pos.x,mo.z-this.pos.z)<(this.cls===4?18:11)&&this.emplMount(mo,'mortar')) return;
}
}
if(!this.mgUse&&!this.mortUse&&Math.random()<0.25){ // 2026-09-25 修: 与同段迫击炮门闸同规补 !mortUse (decide 里也加了 mortUse 提前 return, 这里是第二道)
for(const mg of MG42S){
if(!empReady(mg)) continue;
if(empInReach(mg,this.pos.x,this.pos.y,this.pos.z,14)&&this.emplMount(mg,'mg')) return;
}
}
if(!this.defendPt||Math.random()<0.3){
let best=null,bd=1e9;
for(const cp of coverPoints){
const d=Math.hypot(cp.x-f.x,cp.z-f.z);
// 掩体限制在旗圈以内: 守方站在圈内才能真正阻断敌方占领
// ★2026-11-11 性能批: 距离门前置 —— coverPoints 一局数百个, 旧版每点先跑 fireThreat+tbThreat
// (各 ~25 格火场扫描) 再算距离, 旗圈外的大多数点纯白扫 (两个谓词均为纯函数, 顺序不影响结果)。
if(d>=f.r*0.85) continue;
if(fireThreat(cp.x,cp.z,2.8)||tbThreat(cp.x,cp.z,2.8)) continue; // 驻守点避开火线/树爆弹着圈 (2026-09-02 火情规避 / 2026-09-13 树爆)
// ★2026-11-03 驻点占用账 (F 修): 同队已有人占/将占的点加罚, 全队不再评出同一个最优解叠成一坨
const dd=d+rand(0,14)+coverCrowdAt(this,cp.x,cp.z)*9;
if(dd<bd){ bd=dd; best=cp; }
}
this.defendPt=best||{x:f.x+rand(-6,6),z:f.z+rand(-6,6)};
// (2026-11-10: 甲板驻点夹取随大舰子系统下架摘除)
this.setPathTo(this.defendPt.x,this.defendPt.z);
}
} else {
this.state='advance';
if(!this.path||this.repathT<=0){
let ax=f.x+rand(-6,6), az=f.z+rand(-6,6);   // (2026-11-10: 甲板目标点夹取随大舰子系统下架摘除)
this.setPathTo(ax,az);
this.repathT=rand(4,7);
}
}
}
findCover(){
const threat=this.target?this.target.pos:this.lastSeenPos;
return this.findCoverFrom(threat);
}
// 掩体粘滞: 刚用过的掩体仍在附近且仍挡弹 → 直接回它, 不再挑新方块 (防掩体间来回蹦)
// 冷却期(刚出掩体)只有就在原掩体旁(≤3m, 相当于刚探头出来)才允许缩回; 走远了等冷却
reuseCover(){
const lc=this.lastCover; if(!lc) return null;
const dMe=Math.hypot(lc.x-this.pos.x,lc.z-this.pos.z);
if(dMe>10) return null;
if(this.coverCd>0&&dMe>3) return null;
const threat=this.target?this.target.pos:this.lastSeenPos;
const dist=Math.hypot(lc.x-threat.x,lc.z-threat.z);
if(dist<2) return null;
const org=V3(threat.x,Math.max(threat.y,heightAt(threat.x,threat.z))+1.5,threat.z);
const dir=V3(lc.x-threat.x,(heightAt(lc.x,lc.z)+0.9)-org.y,lc.z-threat.z).normalize();
const hit=raycastWorld(org,dir,dist);
return (hit&&hit.dist<=dist-0.8)?lc:null;
}
// 掩体选择统一入口: 粘滞优先; 冷却期且非重伤不挑新掩体
pickCoverNow(){
const rc=this.reuseCover();
if(rc) return rc;
if(this.coverCd>0&&this.hp>=32) return null;
return this.findCover();
}
// 掩体评分: 挡弹(硬性) + 可探头还击(加分) + 距离; 候选评估设上限防 raycast 超支 (按30v30预算)
findCoverFrom(threat){
const cands=[];
for(const cp of coverPoints){
const d=Math.hypot(cp.x-this.pos.x,cp.z-this.pos.z);
if(d<2.2||d>26) continue;
if(fireThreat(cp.x,cp.z,2.8)||tbThreat(cp.x,cp.z,2.8)) continue; // 火线/弹着圈上的掩体不进 (2026-09-02 火情规避 / 2026-09-13 树爆)
cands.push([d,cp]);
}
if(!cands.length) return null;
cands.sort((a,b)=>a[0]-b[0]);
let best=null,bd=1e9,n=0;
for(const [d,cp] of cands){
if(++n>12) break;
const dist=Math.hypot(cp.x-threat.x,cp.z-threat.z);
const org=V3(threat.x,Math.max(threat.y,heightAt(threat.x,threat.z))+1.5,threat.z);
const dir=V3(cp.x-threat.x,(heightAt(cp.x,cp.z)+0.9)-org.y,cp.z-threat.z).normalize();
const hit=raycastWorld(org,dir,dist);
if(!hit||hit.dist>dist-0.8) continue; // 挡不住威胁视线的不算掩体
let sc=d-rand(0,6);
sc+=coverCrowdAt(this,cp.x,cp.z)*5; // ★2026-11-03 驻点占用账: 已被人占着的掩体降权 (挤在一起第二根因)
if(this.peekLOS(cp.x,cp.z,threat,false)) sc-=3.5; // 站立可越顶还击的"活掩体"
if(sc<bd){ bd=sc; best=cp; }
if(sc<4) break; // 已足够好, 提前收工
}
return best;
}
// 前出掩体: 位于自己与威胁之间、显著更接近威胁且可挡弹 —— 掩体间跃进的落脚点
findCoverToward(tx,tz){
const dMe=Math.hypot(tx-this.pos.x,tz-this.pos.z);
const cands=[];
for(const cp of coverPoints){
const d=Math.hypot(cp.x-this.pos.x,cp.z-this.pos.z);
if(d<6||d>22) continue;
if(Math.hypot(tx-cp.x,tz-cp.z)>dMe-4) continue;
if(fireThreat(cp.x,cp.z,2.8)||tbThreat(cp.x,cp.z,2.8)) continue; // 跃进落点不选火线/弹着圈 (2026-09-02 火情规避 / 2026-09-13 树爆)
cands.push([d,cp]);
}
if(!cands.length) return null;
cands.sort((a,b)=>a[0]-b[0]);
let best=null,bd=1e9,n=0;
for(const [d,cp] of cands){
if(++n>10) break;
const dist=Math.hypot(cp.x-tx,cp.z-tz);
const org=V3(tx,heightAt(tx,tz)+1.5,tz);
const dir=V3(cp.x-tx,(heightAt(cp.x,cp.z)+0.9)-org.y,cp.z-tz).normalize();
const hit=raycastWorld(org,dir,dist);
if(!hit||hit.dist>dist-0.8) continue;
const sc=d+rand(0,3)+coverCrowdAt(this,cp.x,cp.z)*5; // ★2026-11-03 驻点占用账: 跃进落点同账 (别全队跃进同一格)
if(sc<bd){ bd=sc; best=cp; }
if(sc<8) break;
}
return best;
}
// 从(px,pz)能否看到tp —— 决定探头方式 (侧出1.15m蹲姿 / 原地越顶站姿)
peekLOS(px,pz,tp,stand){
const py=heightAt(px,pz)+(stand?1.62:1.15);
const ty=Math.max(tp.y,heightAt(tp.x,tp.z))+1.3;
const dir=V3(tp.x-px,ty-py,tp.z-pz);
const d=dir.length(); if(d<0.5) return true;
dir.normalize();
const hit=raycastWorld(V3(px,py,pz),dir,d);
return !hit||hit.dist>d-0.7;
}
// 选探头位: 固定一侧出溜(探头方向记忆, 不再左右换边), 被挡才试另一侧; 再不行试越顶站姿
pickPeekSide(){
const tp=(this.target&&this.target.alive)?this.target.pos:this.lastSeenPos;
const base=Math.atan2(tp.x-this.coverPt.x,tp.z-this.coverPt.z);
if(!this.peekSide) this.peekSide=Math.random()<0.5?1:-1;
const sides=[this.peekSide,-this.peekSide];
for(const s of sides){
const px=this.coverPt.x+Math.sin(base+HPI*s)*1.15;
const pz=this.coverPt.z+Math.cos(base+HPI*s)*1.15;
if(occBlocked(px,pz)) continue;
if(this.peekLOS(px,pz,tp,false)){ this.peekSide=s; return {x:px,z:pz,stand:false}; }
}
if(this.peekLOS(this.coverPt.x,this.coverPt.z,tp,true)) return {x:this.coverPt.x,z:this.coverPt.z,stand:true};
return null;
}
// 进掩体统一入口: 初始化探头循环
enterCover(cp,dur){
this.state='cover';
this.coverPt={x:cp.x,z:cp.z};
this.coverT=dur;
this.peekPhase='in'; this.peekPos=null; this.peekNext=nowT+rand(0.5,1.2);
this.prone=false;
this.setPathTo(cp.x,cp.z);
}
setPathTo(x,z){
// 2026-09-19 Bot 机制翻新: 返回布尔"是否拿到路径", 并把"每帧都重试同一条死路"改成指数退避。
// 旧版两种失败都只是把 path 置空就返回 —— 调用方下一帧 !this.path 又立刻重试,
// 一条不可达目标能把 NAV 预算 (每帧 2 次寻路) 吃干, 连带别的 bot 也拿不到路 (放大效应)。
// (2026-11-10: 大舰甲板直行路径 capNavDirect 钩随大舰子系统下架摘除)
this.navFails=this.navFails||0;
if(NAV.budget<=0){
// 预算耗尽不是"无路", 只是排不上队: 短退避后重试, 不计入失败次数
this.repathT=this.repathT>0?Math.min(this.repathT,0.3):0.3;
return false;
}
NAV.budget--;
const p=NAV.findPath(this.pos.x,this.pos.z,x,z);
if(p){ this.path=p; this.pathI=0; this.moveIntent=true; this.navFails=0; return true; }
this.path=null; this.moveIntent=false;
this.navFails++;
// 退避: 0.45s → 0.9 → 1.8 → … 上限 4s (成功一次即清零); 目标点不可达时不再打死重试
this.repathT=Math.max(this.repathT,Math.min(4,0.45*Math.pow(2,Math.min(this.navFails-1,4))));
return false;
}
// 就近可达中转点: 目标不可达时退而求其次 —— 沿"我→目标"方向逐级回收, 取第一个真能到的点。
// 起点是自己脚下 (一定可达), 所以第一级必然成功; 找不到就把指向目标的直行航向交回调用方。
stepToward(tx,tz,frac){
const dx=tx-this.pos.x, dz=tz-this.pos.z;
const d=Math.hypot(dx,dz);
if(d<3) return null;
for(let f=frac;f>=0.25;f-=0.25){
const px=this.pos.x+dx*f, pz=this.pos.z+dz*f;
if(occBlocked(px,pz,true)||!freeSpot(px,pz,0.6)) continue; // 深水格放行 (swim 兜底), 只躲实体与建筑足迹
if(this.setPathTo(px,pz)) return this.path;
}
return null;
}
// 无路可走的兜底推进: 目标不可达 (被墙/水/桥隔断) 时也要动起来 ——
// 之前 advance/defend/hunt 三个分支都是"followPath 返回 null 就站住", 于是不可达目标 = 永久站桩。
// 这里给一个"朝目标直行 + 定期重寻路"的降级行为 (moveDir 内自带避障与膝高射线)。
pushToward(tx,tz,dt,dirT){
this.navFails=this.navFails||0;
if(this.repathT<=0){
// 先试中转点 (可能绕得到), 失败再退化为直行
if(this.stepToward(tx,tz,0.5)) return this.yaw;
this.navFails++;
this.repathT=Math.min(4,0.6*Math.pow(2,Math.min(this.navFails-1,4)));
}
this.dirT=this.dirT||rand(-0.5,0.5);
return Math.atan2(tx-this.pos.x,tz-this.pos.z)+this.dirT;
}
update(dt){
_ensureRayBudgetReset();
// 刺刀伤害延时账 (2026-10-28 修复, 红线2): 旧 setTimeout(380) 脱离游戏主时钟 (暂停/K时停期间照常
// 到点掉血), 且结算无高度差门。改实例账 _pendMelee 由 dt 积分驱动, 结算补 dy<1.8 三维门 ——
// 与 25-zombies zMelee 同一批口径。放 update 最前: 不受下方上炮/座位/melee-state 早退影响。
if(this._pendMelee){
this._pendMelee.t-=dt;
if(this._pendMelee.t<=0){
const mt=this._pendMelee.tgt; this._pendMelee=null;
if(this.alive&&mt&&mt.alive){
const md=Math.hypot(mt.pos.x-this.pos.x,mt.pos.z-this.pos.z);
const mdy=Math.abs(mt.pos.y-this.pos.y);
if(md<2.6&&mdy<1.8){ mt.damage(70,this,false); AudioSys.click(500,0.4,0.08); }
}
}
}
if(this.visualGunTimer&&nowT>=this.visualGunTimer){
this.visualGunTimer=0;
this.switchVisualGun(this.wpnKey);
}
// 海战 AI 帧钩 (2026-09-20N 海战批 · task-4): 兜底用 —— 仅当 15d/15f 不在脚本链上时才驱动艇/两栖车/反舰炮位
// (见文件末 navalAIFrameTick 的 typeof 判据)。15d 在链上时本行只做一次 nowT 比较, 零副作用: 驱动权归 15d。
navalAIFrameTick();
// ── 落水/游泳标志对账 (2026-09-20N, naval-hull 实测 + Lead 裁定) ──────────────────
// 旧实现只在 moveDir() 里按水深赋 this.swim ⇒ AI 本帧不动 (hold/idle/被压制/落水后没目标) 时标志位不更新:
// 水态机已是 swim、人不会溺水, 但 swim=false 会让"游泳不可开火/探针水态判据"读错 (15d 报的落水车组缺陷)。
// 这里按 03-terrain 的**水态单源** waterStateAt(x,y,z) 对账 (它把"脚在水面之上"判 dry ⇒ 栈桥/桥面/干地不会误判),
// 且**只单向补位**: 真水态是 swim/wade/wet 才写, dry 只在标志已置位时清 —— 不凭空把陆上/桥上的人判成游泳 (跨图零行为变化)。
// 0.25s 一次: 水态不会在更短时间里来回翻, 也把 heightAt 采样的开销压在可忽略量级。
this.swimScanT=(this.swimScanT||0)-dt;
if(this.swimScanT<=0){
this.swimScanT=0.25;
const ws=waterStateAt(this.pos.x,this.pos.y,this.pos.z);
if(ws.state==='swim'){ this.swim=true; this.wading=false; }
else if(ws.state==='wade'){ this.swim=false; this.wading=true; }
else if(ws.state==='wet'){ this.swim=false; this.wading=false; }
else if(this.swim){ this.swim=false; this.wading=false; }
}
// (2026-11-10: 大海致命化 opensea 溺伤段随纯海战图下架摘除 —— 陆战图河流/湖泊本就走不到此分支)
if(this.alive&&!this.onVehicle){
this.flAiTimer=(this.flAiTimer||0)-dt;
if(this.flAiTimer<=0){
this.flAiTimer=0.3+rand(0,0.15);
this.updateFlashlightAI();
}
}
if(!this.alive){
this.deathAnimT-=dt;
if(!this.ragdolled){
const k=clamp(1-Math.max(this.deathAnimT,0)/0.6,0,1);
if(k<=1){
if(!this.deathDir) this.deathDir=Math.random()<0.5?1:-1;
// A#10 审计⑤ (旧倒地动画分支, = 无 CANNON / 布娃娃链不可用时的交接):
// ① 姿态必须从**当前姿态**出发: 旧版无条件 lerp(0.94→0.2), 趴姿死亡那一帧骨盆从 0.22 弹到 0.94
//    (实测 0.72m 的竖向跳变) —— 现在从死亡时的实际骨盆高起算。
// ② 倒地幅度按姿态缩放: 站着死 = 整身倒下 (-90°); 蹲着死 ≈ -50°; 已经趴着的只需 16° 的瘫倒 ——
//    旧版对趴姿尸体也转 90°, 把人从"趴"翻成"竖"。
// ③ 绕脚跟旋转会把躯干盒中心压到 y≈0 ⇒ 半个身子埋在地里 (实测最低关节 -0.30m 站 / -0.38m 蹲);
//    骨盆下沉必须与倒地角**同步** (见下): 旧版把骨盆独立地 lerp 到 0.2, 于是倒到一半时腿还挂在骨盆下
//    却已经贴地 ⇒ 实测蹲姿尸体的关节最深 -0.45m。
const p0=this.prone?0.22:this.crouch?0.6:0.94;
const fallK=this.prone?0.18:this.crouch?0.55:1;
const th=HPI*k*fallK;
this.mesh.root.rotation.x=-th*this.deathDir;
// 骨盆高 = p0·cos(倒地角): 站立链的骨盆高 (0.94) 与脚到根的腿长 (0.94) 相等 ⇒ 靴底恒在地面 (0), 全身像
// 绕脚跟倒下的"木头人"一样贴地旋转; 下限 0.14 = 躯干盒半高, 躺着时不再下沉。初始帧 cosθ≈1 ⇒ 无竖向跳变。
this.mesh.pelvis.position.y=Math.max(0.14,p0*Math.cos(th));
// 残余抬升: 绕脚跟旋转时脚在**倒地中途**会短暂低于地面 (几何量 = p0·cosθ·(1-cosθ), θ=45° 时最深),
// 按同一式子给等量抬升 ⇒ 全程最低关节贴地不穿地; θ=0/90° 两端为 0 (起手与落地都不跳)。
this.mesh.root.position.y=this.pos.y+p0*Math.cos(th)*(1-Math.cos(th))*1.05;
this.mesh.tag.visible=false;
}
}
	this.respawnT-=dt;
	if(this.respawnT<2.5&&this.mesh.root.visible) this.mesh.root.visible=false;
	// 兵力票归零 → 该队封重生 (清场阶段敌方不再补充新兵, 2026-09-04)
	if(this.respawnT<=0&&!matchOver&&tickets[this.team]>0){
if(this.pilotOf){ /* 专属飞行员: 等待战机复活后随机载入 */ }
else { this.deathDir=0; this.spawn(); }
}
return;
}
// 乘员: 藏在载具里, 位置同步
if(this.onVehicle){
const v=this.onVehicle;
if(!v.alive||v.crewBot!==this){ this.onVehicle=null; this.mesh.root.visible=true; }
else {
// 载具残血起火 Bot 对齐 (2026-11-09 批): 座驾起火 = VEH_BURN_TIME 秒内必毁 ⇒ 立即弃车
// (dismountVehicle(true) 的 bailing 档: noEnterT 12s 防他人再上 + 撤位滑步 + 压制值), 死守没有意义。
// ★2026-11-14 批 (用户实报"时停中残血坦克乘员主动下车"): 冻结世界 (dt=0: 观战时停/布势/K时停) 里
//   AI 不得行动 —— 本判定原来不吃 dt, 而乘员 Bot 每帧都进 update (onVehicle 旁路 tickSkip), 于是在
//   时停里照常弃车。加 dt>0 门: 冻结期只挂 burning 账不动人, 解冻后第一帧照常弃车 (与 16-aircraft
//   跳伞挂账 _bailPend 同族)。死亡链不走这里 (Tank.die 的 crewKill 另行结算), 不受影响。
if(v.burning&&v.kind==='tank'&&dt>0){
this.crewStillT=0;
this.dismountVehicle(true);
this.pickObjective();
this.decisionT=0;
return;
}
this.pos.copy(v.pos); this.vel.set(0,0,0);
this.suppression=Math.max(0,this.suppression-dt*0.5);
this.target=null;
// ── 驻守车下车兜底 (2026-09-19 用户: 坦克乘员长期站桩像卡住) ──
// 车停在目标圈内驻守/对炮时, 乘员随车定格可能整局不动。载具停稳累计 P 秒仍无自主行动
// 就下车归建 (步行去前线); 车被重新开动 (vel 起来) 计时清零。下车后该车仍会被别的 bot 认领。
const moving=Math.abs(v.vel||0)>0.8;
if(moving){ this.crewStillT=0; }
else{
this.crewStillT=(this.crewStillT||0)+dt;
// 阈值分档: 车本来就在推进 (目标还远) → 多等一会 (46s); 车已在目标圈驻守 (crewIdle) → 26s 就归建
const idling=typeof tankRollingToObjective==='function'?!tankRollingToObjective(v):true;
if(this.crewStillT>(idling?26:46)){
this.crewStillT=0;
this.dismountVehicle(false);
this.pickObjective();
this.decisionT=0;
}
}
return;
}
}
// 跳伞下落 (bot)
if(this.chuting){
this.vel.set(0,0,0);
this.chute=true; this.onGround=false;   // A#8: 与 chuteAirborne() 的口径对账 (伞降中 = chute && !onGround)
this.pos.y-=7*dt;
if(!this.chuteMesh){ this.chuteMesh=mkChuteForBot(); this.mesh.root.add(this.chuteMesh); this.chuteMesh.position.set(0,2.5,0); }
const gh=standHeight(this.pos.x,this.pos.z,this.pos.y);
// 海图水面地板 (★2026-10-03, 与玩家同批修"跳伞下到海底才解除伞"): 深水上空触水面即收伞转游泳
//   (浮位给到 wy-FLOAT_PAD 下, 下一帧水态块按 dampF 接管), 不再坠到海床才"落地"。
//   wy>gh+0.6 门挡掉旱地/浅水; 水面承接不算接地 (onGround=false, 不吃落地账)。
if(typeof waterYAt==='function'){
const wy=waterYAt(this.pos.x,this.pos.z);
if(wy>-1e8&&this.pos.y<=wy&&wy>gh+0.6&&(typeof waterDepthAt!=='function'||waterDepthAt(this.pos.x,this.pos.z)>1.2)){
this.pos.y=wy-((typeof FLOAT_PAD!=='undefined')?FLOAT_PAD:0.95)-0.3;
this.chuting=false; this.decisionT=0;
this.chuteClear(); this.onGround=false;
this.updateMesh(dt,0);
return;
}
}
if(this.pos.y<=gh){
this.pos.y=gh; this.chuting=false; this.decisionT=0;
// A#8 落地即收伞: 与 player 侧 playerChuteClear() 同一条纪律 —— 旧版等下一帧才摘, 落地那帧伞还在头顶
this.chuteClear(); this.onGround=true;
}
	this.updateMesh(dt,0);
	return;
}
// ── 下车跨出 (2026-09-20 闪现修复): 限速走到车旁落点, 带走路动画; 到位/超时即结束 ──
// 全程单帧位移 ≤ EXIT_SPD*dt; 被车身推挤最多再叠载具侧推 (15-vehicles.vehiclePushSoldiers), 仍远小于闪现阈值。
if(this.exitSlide){
const es=this.exitSlide;
es.t-=dt;
const mx0=this.pos.x, mz0=this.pos.z;
const dx=es.x-this.pos.x, dz=es.z-this.pos.z, d=Math.hypot(dx,dz);
if(d>1e-4){
const step=Math.min(d,EXIT_SPD*dt);
this.pos.x+=dx/d*step; this.pos.z+=dz/d*step;
}
collideMove(this.pos,0.4);
this.vel.set(0,0,0);
this.pos.y=dampF(this.pos.y,standHeight(this.pos.x,this.pos.z,this.pos.y+1),20,dt);
if(d<=0.06||es.t<=0){ // 到位才吸附落点 (残差 ≤6cm); 超时则就地结束 —— 绝不把 pos 硬搬到远处
if(d<=0.06){ this.pos.x=es.x; this.pos.z=es.z; }
this.exitSlide=null; this.decisionT=0;
}
// A#10 审计④: 动画速度用**本帧真实位移**换算, 不再恒定喂 EXIT_SPD ——
// 旧版下车跨出期间一律传 3.6 m/s: 被墙/车体挡住 (单帧位移 0.02m) 时腿仍以 3.6 m/s 迈步 = 原地滑步;
// 末帧吸附落点会在一帧里走出 2× 步长, 也应被动画反映。实测固定 3.6 vs 真实 1.2~3.6 m/s (差 2.4 m/s)。
const moved=Math.hypot(this.pos.x-mx0,this.pos.z-mz0);
this.updateMesh(dt,clamp(dt>1e-6?moved/dt:0,0,EXIT_SPD));
return;
}
// ── 固定火力点使用前摇 (2026-09-02 用户指定: Bot与玩家同规): 计时完成才认领, 占位被夺/报废即取消 ──
if(this.emCast){
const ec=this.emCast;
// A#9: 岸防炮没有 dead 字段 (存活判据是 alive) —— 前摇期间炮位被打塌/被玩家接管即取消
if((ec.g.user&&ec.g.user!==this)||(ec.kind==='mortar'&&!ec.g.alive)||(ec.kind==='bat'&&ec.g.alive===false)){
if(ec.g.user===this) ec.g.user=null;
this.emCast=null;
}
else{
ec.t+=dt;
if(ec.t>=ec.dur){
const g2=ec.g;
this.emCast=null;
if(g2.user===this){
this.state='defend'; this.path=null;
// 2026-09-20 闪现修复 (本任务的主根因): 旧版在这里把 pos 硬 set 到炮位 —— 前摇是从 14~18m 外起的,
// 前摇期间又不走向炮位, 于是这一行就是"人闪到炮上"的现场 (实测单帧 8~18m, 全部前后都可见)。
// 现在: ①先按站位单源算落位点; ②超出安全阀 (被推挤/被别人挤开) → 放炮, 绝不硬 set 过去;
//        ③否则进入 EMPL_SNAP_DUR 秒阻尼落位 (pinEmpl), 观感=跨上炮位。
const sp=this.emplStandSpot(g2,ec.kind);
if(Math.hypot(sp.x-this.pos.x,sp.z-this.pos.z)>EMPL_SNAP_GUARD){
releaseEmpl(g2,true); // 安全阀: 离得太远就不上了 (下炮冷却由 releaseEmpl 统一承担)
}else{
if(ec.kind==='mg'){ this.mgUse=g2; this.mgT=rand(14,24); }
else if(ec.kind==='mortar'){ this.mortUse=g2; this.mortT=rand(14,24); }
else if(ec.kind==='at'){ this.empUse=g2; this.empT=rand(18,30); }
else if(ec.kind==='aa'){ this.empUse=g2; this.empT=rand(14,24); }
// A#9 契约 §6: 前摇结束 = 认领 —— 占用轨从 user 交到 crewBot (双轨互斥; 玩家 batteryMountPlayer 也查这两项)
else if(ec.kind==='bat'){ g2.crewBot=this; g2.user=null; this.batUse=g2; this.batT=rand(24,40); }
this.emplPinT=EMPL_SNAP_DUR;
}
this.decisionT=0;
}else{ if(g2.user===this) g2.user=null; }
}
}
}
// ── 火情规避 (优先级高于包扎/工事/战术机动): 火线逼近先逃命 ──
this.fireFleeT-=dt;
this.fireScanT-=dt;
if(this.fireScanT<=0){
this.fireScanT=0.22;
const ft=fireThreat(this.pos.x,this.pos.z,2.0)||tbThreat(this.pos.x,this.pos.z,2.0); // 树爆弹着圈 (2026-09-13 许特根改版, 与火情同一逃生路径)
if(ft){
this.fireFleeT=0.75;
// 逃生航向: 背离最近火心, 逐级侧偏选无火可立的落点 (全堵则直背火冲, moveDir 内还有二次避障)
const back=Math.atan2(-ft.dx,-ft.dz);
this.fleeYaw=back;
for(const da of FLEE_DA){
const px=this.pos.x+Math.sin(back+da)*2.4, pz=this.pos.z+Math.cos(back+da)*2.4;
if(!occBlocked(px,pz)&&!fireThreat(px,pz,0.8)){ this.fleeYaw=back+da; break; }
}
// 逃命弃置: 火上的机枪/迫击炮/火炮手离炮, 包扎打断, 掩体驻留作废
if(this.mgUse){ releaseEmpl(this.mgUse,true); this.mgUse=null; }
if(this.mortUse){ releaseEmpl(this.mortUse,true); this.mortUse=null; }
if(this.empUse){ releaseEmpl(this.empUse,true); this.empUse=null; }
if(this.batUse){ this.releaseBattery(); }   // A#9: 岸防炮同样弃置 (火线上的炮位站不住)
if(this.emCast){ if(this.emCast.g&&this.emCast.g.user===this) this.emCast.g.user=null; this.emCast=null; }
if(this.bandageT>0) this.bandageT=0;
if(this.state==='cover'){
this.lastCover=this.coverPt; this.coverCd=rand(3.5,6);
this.coverPt=null; this.state='combat'; this.man='hold'; this.manT=rand(0.8,1.4);
}
this.crouch=false; this.prone=false;
}
}
// ── 严寒失温 (2026-09-05 城市组·斯大林格勒, 玩家/Bot 同判定): 露天静止 COLD_OFF 秒起掉血,
//    冻僵后强迫重抽机动 (起身挪窝) —— 掩体驻留/驻停作废, 与火情逃命同款打断; 室内/载具/工事位豁免 ──
if(CAMPAIGN.cold&&!this.onVehicle){
this.coldScanT=(this.coldScanT||0)-dt;
if(this.coldScanT<=0){
this.coldScanT=0.3;
this.coldShelt=coldSheltered(this.pos.x,this.pos.y,this.pos.z);
}
const coldBusy=this.mgUse||this.empUse||this.mortUse||this.emCast||this.chuting;
const coldMoved=Math.hypot(this.vel.x,this.vel.z)>0.6;
if(coldMoved||coldBusy||this.coldShelt){
this.coldT=0; this.coldAcc=0;
}else{
this.coldT=(this.coldT||0)+dt;
if(this.coldT>COLD_OFF){
this.coldAcc=(this.coldAcc||0)+COLD_DMG*dt;
if(this.coldAcc>=1){ const d=Math.floor(this.coldAcc); this.coldAcc-=d; this.damage(d,null,false); }
// 冻僵反应: 原地驻停超过阈值 → 作废掩体驻留, 强迫侧移/跃进取暖 (部分重置计时防连冻)
if(this.coldT>COLD_OFF+2&&(this.state==='cover'||this.man==='hold')){
this.coldT=COLD_OFF-4;
if(this.state==='cover'){ this.lastCover=this.coverPt; this.coverCd=rand(3.5,6); this.coverPt=null; this.state='combat'; }
this.man='slide'; this.manT=rand(1.2,2); this.slideDir=Math.random()<0.5?-1:1;
this.crouch=false; this.prone=false;
}
}
}
}
// 包扎中
if(this.bandageT>0&&!this.mgUse&&!this.empUse){
this.bandageT-=dt;
this.vel.set(0,0,0);
this.crouch=true;
if(this.bandageT<=0){
this.bandages=Math.max(0,this.bandages-1);
this.hp=Math.min(100,this.hp+BANDAGE_HEAL);
this.crouch=false;
}
this.updateMesh(dt,0);
return;
}
this.perceptT-=dt;
if(this.perceptT<=0){ this.perceptT=0.16; this.perceive(); }
// 分心去做别的事时释放坦克占用, 避免空车被永久锁定
if(this.targetVeh&&this.state!=='toVehicle'){ if(this.targetVeh.claimBot===this) this.targetVeh.claimBot=null; this.targetVeh=null; }
this.decisionT-=dt;
if(this.decisionT<=0&&!(this.state==='nade'&&this.nadeAnimT>0)){ this.decisionT=rand(0.35,0.6); this.decide(); }
this.suppression=Math.max(0,this.suppression-dt*0.35);
// 弹尽搜刮保底计时 (2026-11-03 弹药账对齐): drySeekSupply 没找到箱时挂 10s, 到点且仍双尽 → 补一个弹匣备弹
if(this._dryScavT>0){
this._dryScavT-=dt;
if(this._dryScavT<=0&&this.slots&&this.slots[0]&&this.slots[0].reserve<=0&&this.mag<=0) this.slots[0].reserve=Math.ceil(this.def.mag);
}
this.nadeCd-=dt; this.repathT-=dt; this.reactT-=dt;
if(this.objHoldT>0) this.objHoldT-=dt; // ★2026-11-03 目标粘滞计时 (到 0 才恢复 6% 随机换目标)
this.smokeCd-=dt;
// 甩枪偏差随时间收敛(命中修正)
this.aimErrX*=Math.pow(0.18,dt); this.aimErrY*=Math.pow(0.18,dt);
if(this.reloadT>0){
this.reloadT-=dt;
if(this.reloadT<=0){
// 弹药账对齐 (2026-11-03): 换弹从槽位备弹真实扣账 (旧版备弹从不扣减=无限) —— 受创打断走不到这里 = 不结算;
// slots[0].mag 随开火/换弹同步维护 (旧版只在出生/换弹完成写, 附身面板读数两次换弹之间是冻结旧值)。
const _s0=this.slots&&this.slots[0]?this.slots[0]:null;
if(_s0){
const _need=Math.max(0,this.def.mag-this.mag);
const _take=Math.min(_need,_s0.reserve);
this.mag+=_take; _s0.mag=this.mag; _s0.reserve=Math.max(0,_s0.reserve-_take);
}else this.mag=this.def.mag;   // 无槽位 (丧尸子类等): 维持旧满仓行为
}
}
if(this.pReloadT>0){
this.pReloadT-=dt;
if(this.pReloadT<=0&&this.slots&&this.slots[1]){
const _s1=this.slots[1];
const _need=Math.max(0,_s1.def.mag-this.pMag);
const _take=Math.min(_need,_s1.reserve);
this.pMag+=_take; _s1.mag=this.pMag; _s1.reserve=Math.max(0,_s1.reserve-_take);
}
}
if(this.boltT>0) this.boltT-=dt;
if(this.fireT>0) this.fireT-=dt;
if(this.burstPause>0) this.burstPause-=dt;
if(this.supFireT>0) this.supFireT-=dt;
if(this.coverCd>0) this.coverCd-=dt;
if(this.slideCd>0) this.slideCd-=dt;
if(this.target&&this.target.onVehicle) this.target=null;
const engaged=this.target&&this.target.alive&&nowT-this.lastSeenT<4;
// A#9 岸防炮操作态 (契约 §6): 有人 (crewBot=this) 才瞄船/开炮 —— 无人时这条分支根本不进, 也不存在别的开火链
if(this.batUse){ this.updateBatteryGun(dt); return; }
if(this.empUse){ this.updateEmplacement(dt); return; }
if(this.mgUse){
const mg=this.mgUse;
this.crouch=false; this.prone=false;
this.vel.set(0,0,0);
// 2026-09-20 闪现修复: 落位用 pinEmpl (上炮头 0.28s 阻尼滑到站位, 之后钉死) —— 与 emplStandSpot 同源
this.pinEmpl(mg.x-Math.sin(mg.face)*0.85, mg.z-Math.cos(mg.face)*0.85, dt);
this.pos.y=standHeight(this.pos.x,this.pos.z,this.pos.y+1);
if(engaged){
// ★2026-11-03 (实机"隔着墙开火"之二): 旧版 engaged 门 (lastSeenT<4) 内始终朝 target **实时坐标**
// 开火且无开火瞬间 LOS 预检 ⇒ 目标缩进掩体/墙后最长还有 ~3.4s 的隔墙扫射。现在: 通视 (<0.6s, 与
// 步枪开火门同源) 才打活人坐标且开火瞬间预检; 刚丢失 (<2.5s) 改压最后目击位 (压制弹, 弹道自己撞墙,
// 与步枪 supFireT 同语义) —— 不再有"墙后人根本不在这"的实时坐标泼弹。
const mgVis=nowT-this.lastSeenT<0.6;
const ap=mgVis?this.target.pos:this.lastSeenPos;
const wantYaw=Math.atan2(ap.x-mg.x,ap.z-mg.z);
// 解除回旋限制: 机枪可360°转向目标
this.yaw=angleLerpTo(this.yaw,wantYaw,4*dt);
mg.yaw.rotation.y=angDiff(mg.face,this.yaw);
const dy=(ap.y+1.2)-(mg.y);
const dh=Math.hypot(ap.x-mg.x,ap.z-mg.z);
const mgPit=clamp(Math.atan2(dy,dh),-0.7,0.45);
mg.pitch.rotation.x=-mgPit;
this.pitch=mgPit;   // A#10 审计③: 机枪手的枪口俯仰与机枪同源 (旧版 this.pitch 全程不变, 与炮口差 0.46 rad)
mg.fireT-=dt; // 射速间隔在炮上: 换人不重置 (与玩家同规)
if(this.reactT<=0&&mg.fireT<=0&&mg.heat<1&&nowT-this.lastSeenT<2.5){
const eye=V3(mg.x,mg.y+EMPL_MG_EYE,mg.z);
const dir=V3(ap.x-eye.x,ap.y+1.1+rand(-0.4,0.4)-eye.y,ap.z-eye.z).normalize();
const spread=0.02*(this.suppression+0.7); // AI 散布档 (含压制惩罚; 玩家走 0.011+heat 输入散布)
dir.x+=rand(-spread,spread); dir.y+=rand(-spread,spread); dir.z+=rand(-spread,spread); dir.normalize();
if(mgVis){
const chk=raycastWorld(eye,dir,dh); // 开火瞬间 LOS 预检 (与 AT 炮分支同款): 被墙挡住就不出膛
if(chk&&chk.dist<dh-0.8) mg.fireT=0.12;   // 被挡: 短退避重试 (避免每帧一发预检射线白烧预算)
else emplMGFire(mg,this,dir); // 弹道/冷却/热量/特效/击杀来源单源 (13-combat)
}else emplMGFire(mg,this,dir); // 压制档朝最后目击位: 不预检 (弹道撞墙是压制语义本身)
}
}
mg.heat=Math.max(0,mg.heat-dt*0.15); // AI 散热档 0.15 (玩家 0.22 且开火不散) —— 显式节奏分叉, README 口径
// 落位过渡期给"走路速度": 腿在迈, 而不是滑行 (2026-09-20 闪现修复的观感配套)
this.updateMesh(dt,this.emplPinT>0?EMPL_SNAP_SPD:0);
return;
}
if(this.mortUse){
const mo=this.mortUse;
this.mortT-=dt; mo.cd-=dt;
this.crouch=true; this.prone=false;
this.vel.set(0,0,0);
// 2026-09-20 闪现修复: 同 pinEmpl (迫击炮位落位过渡)
this.pinEmpl(mo.x-Math.sin(mo.face)*0.85, mo.z-Math.cos(mo.face)*0.85, dt);
this.pos.y=standHeight(this.pos.x,this.pos.z,this.pos.y+1);
this.yaw=angleLerpTo(this.yaw,mo.face,4*dt);
// A#10 审计③: 迫击炮手是"高抛架设"姿态 —— 让身体俯仰跟炮管仰角 (旧版 this.pitch 停在进炮位之前的值)。
// mo.tube.rotation.x 是该炮位炮管的当前仰角状态 (06-engineering 建的, 开火时被写成 0.5 后阻尼回 0.62)。
this.pitch=clamp(mo.tube?mo.tube.rotation.x:0.6,0,1.0);
if(mo.cd<=0){
// 选target: 已知敌人暴露点 > 敌占/被夺旗点(附近无友军)
let tx=null,tz=null;
if(this.target&&this.target.alive&&nowT-this.lastSeenT<6){
const d=Math.hypot(this.lastSeenPos.x-mo.x,this.lastSeenPos.z-mo.z);
if(d>26&&d<130){ tx=this.lastSeenPos.x; tz=this.lastSeenPos.z; }
}
if(tx===null){
let bd=1e9;
for(const f2 of FLAGS){
if(f2.owner===this.team&&!(f2.capTeam!==-1&&f2.capTeam!==this.team)) continue;
const d=Math.hypot(f2.x-mo.x,f2.z-mo.z);
if(d<26||d>130||d>=bd) continue;
let allyNear=false;
for(const s2 of soldiers){ if(s2.alive&&s2.team===this.team&&Math.hypot(s2.pos.x-f2.x,s2.pos.z-f2.z)<12){ allyNear=true; break; } }
if(allyNear) continue;
bd=d; tx=f2.x; tz=f2.z;
}
}
if(tx===null&&typeof ZOMBIE_MODE!=='undefined'&&ZOMBIE_MODE&&typeof ZOMBIES!=='undefined'&&ZOMBIES.length){
// 丧尸火力支援 (2026-10-07d, 用户"迫击炮要轰丧尸"): 无暴露敌兵且无旗可打时, 轰最近的尸群心
// (9m 簇 ≥3 只才算群, 26~130m 射带内) —— 炮击节奏不变, O(n²) 只在开火判定期跑 (cd 4.2~6.5s)。
let bz=null,bn=0;
for(const z of ZOMBIES){
if(!z.alive) continue;
const dz0=Math.hypot(z.pos.x-mo.x,z.pos.z-mo.z);
if(dz0<26||dz0>130) continue;
let n=0;
for(const z2 of ZOMBIES){ if(z2.alive&&Math.hypot(z2.pos.x-z.pos.x,z2.pos.z-z.pos.z)<9) n++; }
if(n>bn){ bn=n; bz=z; }
}
if(bz&&bn>=3){ tx=bz.pos.x; tz=bz.pos.z; }
}
if(tx!==null){
mo.cd=rand(6,9); // AI 冷却档 (玩家 4.5s 固定) —— 显式节奏分叉: 自动索敌间隔更长, README 口径 (★2026-10-30 用户裁定⑤: 原 rand(4.2,6.5)/3.2s 双双上调)
const sx=tx+rand(-7,7), sz=tz+rand(-7,7);
emplMortarShell(mo,this,sx,sz); // 弹道/弹体/击杀来源/炮口烟单源 (13-combat)
AudioSys.mortarThunk(this.pos.distanceTo(camera.position));
mo.tube.rotation.x=0.5;
} else mo.cd=1.4;
}
mo.tube.rotation.x=dampF(mo.tube.rotation.x,0.62,5,dt);
// 敌人逼近/压制/时间到: 离炮
const engagedClose=this.target&&this.target.alive&&nowT-this.lastSeenT<3&&Math.hypot(this.target.pos.x-this.pos.x,this.target.pos.z-this.pos.z)<14;
if(this.mortT<=0||engagedClose||this.suppression>1.2){
releaseEmpl(mo,true); this.mortUse=null; // 离炮: 上炮冷却
}
this.updateMesh(dt,this.emplPinT>0?EMPL_SNAP_SPD:0); // 落位过渡期腿在迈 (2026-09-20)
return;
}
if(this.state==='melee'&&engaged){
const d=Math.hypot(this.target.pos.x-this.pos.x,this.target.pos.z-this.pos.z);
this.faceTo(this.target.pos,dt,7);
if(d>1.6){ this.moveDir(Math.atan2(this.target.pos.x-this.pos.x,this.target.pos.z-this.pos.z),4.4,dt); }
this.meleeT-=dt;
if(d<2.3&&this.meleeT<=0){
this.meleeT=1.1;
this._pendMelee={tgt:this.target,t:0.38};   // dt 驱动 (上方 _pendMelee 支结算)
this.mesh.armR.sh.userData.swing=0.4;
}
this.updateMesh(dt,Math.hypot(this.vel.x,this.vel.z));
return;
}
if(this.state==='atnade'){
const tk=this.atTankTarget;
if(!tk||!tk.alive){ this.state='idle'; this.nadeAnimT=0; }
else {
this.faceTo(tk.pos,dt,6);
this.vel.set(0,0,0);
this.nadeAnimT-=dt;
this.mesh.armR.sh.userData.swing=0.6;
if(this.nadeAnimT<=0){
this.atn--; this.nadeCd=rand(8,14);
if(this.cls===3&&this.def.rocket&&this.slots[0]&&this.mag<=0&&this.slots[0].reserve>0){ this.reloadT=this.def.reload*dynReloadFac(this.mag,this.def.mag); } // 2026-09-28 兵种8→5: 反坦克=3; 动态换弹速度 (2026-11-12)
const eye=this.eyePos();
const lead=V3(tk.pos.x+Math.sin(tk.yaw)*tk.vel*0.5,tk.pos.y+0.8,tk.pos.z+Math.cos(tk.yaw)*tk.vel*0.5);
const dist=eye.distanceTo(lead);
const tof=clamp(dist/12,0.7,1.8);
const vel=lead.sub(eye).multiplyScalar(1/tof);
vel.y+=0.5*9.8*tof;
this._src='反坦克雷';
throwNade(this,eye,vel,1.6,true);
this.state='combat';
}
this.updateMesh(dt,0);
return;
}
}
if(this.state==='nade'){
this.faceTo(this.lastSeenPos,dt,5);
this.vel.set(0,0,0);
this.nadeAnimT-=dt;
this.mesh.armR.sh.userData.swing=0.6;
if(this.nadeAnimT<=0){
this.nades--; this.nadeCd=rand(13,22);
const eye=this.eyePos();
const tgt=V3(this.lastSeenPos.x+rand(-2,2),heightAt(this.lastSeenPos.x,this.lastSeenPos.z),this.lastSeenPos.z+rand(-2,2));
const dist=eye.distanceTo(tgt);
const tof=clamp(dist/13,0.75,1.9);
const vel=tgt.sub(eye).multiplyScalar(1/tof);
vel.y+=0.5*9.8*tof;
this._src='手雷';
throwNade(this,eye,vel);
this.state='combat';
}
this.updateMesh(dt,0);
return;
}
let speed=0, moveYaw=this.yaw;
let wantMove=false;
if(this.state==='cover'&&this.coverPt){
const d=Math.hypot(this.coverPt.x-this.pos.x,this.coverPt.z-this.pos.z);
if(d>1.2){
wantMove=true; speed=4.8;
moveYaw=this.followPath(dt)??Math.atan2(this.coverPt.x-this.pos.x,this.coverPt.z-this.pos.z);
this.crouch=false; this.prone=false;
} else {
this.coverT-=dt;
if(this.mag<this.def.mag*0.4&&this.reloadT<=0&&this.canReload()){ this.reloadT=this.def.reload*dynReloadFac(this.mag,this.def.mag); } // 动态换弹速度 (2026-11-12): 主动补弹档, 系数随已耗浮动 — Bot 侧唯二真实变档点之一
if(this.hp<50&&this.bandages>0&&this.bandageT<=0&&this.reloadT<=0&&this.coverT>1.2){ this.bandageT=2.2; }
// 探头循环: 蹲瞄(藏) → 侧出/越顶射击1~1.7s → 缩回 (实现旧版遗留未用的 peekT)
if(this.peekPhase==='in'){
this.crouch=true; this.prone=false;
if(this.target&&this.target.alive&&nowT-this.lastSeenT<8&&nowT>=this.peekNext&&this.coverT>0.4&&(nowT-this.lastHitT>0.7||this.suppression<0.9)){
const side=this.pickPeekSide();
if(side){ this.peekPhase='out'; this.peekT=rand(1.0,1.7); this.peekPos=side; }
else this.peekNext=nowT+rand(1.2,2.0);
}
} else {
this.peekT-=dt;
this.crouch=!this.peekPos.stand; this.prone=false;
const dp=Math.hypot(this.peekPos.x-this.pos.x,this.peekPos.z-this.pos.z);
if(dp>0.55){ wantMove=true; speed=2.4; moveYaw=Math.atan2(this.peekPos.x-this.pos.x,this.peekPos.z-this.pos.z); }
if(this.peekT<=0||(nowT-this.lastHitT<0.25&&this.suppression>1.0)||!this.target||!this.target.alive){
this.peekPhase='in'; this.peekPos=null; this.peekNext=nowT+rand(1.2,2.4);
}
}
if(this.coverT<=0){
this.state='combat'; this.man='hold'; this.manT=rand(0.8,1.5);
this.stance=this.suppression>0.8?'crouch':'stand';
// 出掩体记录: 记住这个掩体+重进冷却 (再受压时优先回这里, 不在方块间蹦)
this.lastCover=this.coverPt; this.coverCd=rand(3.5,6); this.coverPt=null;
}
}
}
else if(this.state==='combat'){
const seen=!!(this.target&&this.target.alive&&nowT-this.lastSeenT<1.6);
if(this.man==='push'&&this.pushPt){
// 掩体间跃进: 冲向的前出掩体, 到位转驻停 (decide 再决定下一段跃进); 到不了也限时收敛, 防无限磨蹭
this.manT-=dt;
const dP=Math.hypot(this.pushPt.x-this.pos.x,this.pushPt.z-this.pos.z);
this.crouch=false; this.prone=false;
if(dP<1.4||this.manT<=0){
this.man='hold'; this.manT=rand(1.0,2.0); this.pushPt=null; this.stance='crouch';
} else {
const my=this.followPath(dt);
moveYaw=my!==null?my:Math.atan2(this.pushPt.x-this.pos.x,this.pushPt.z-this.pos.z);
wantMove=true;
speed=this.suppression>1.0?3.8:5.2;
if(this.suppression>1.0) this.crouch=true;
}
} else if(this.man==='slide'){
this.manT-=dt;
if(!seen){ this.man='hold'; this.stance='crouch'; }
else {
// 侧移方向延续 (slideDir 出生时定, 不换边), 到期转驻停; 冷却由 decide 门控
const toT=Math.atan2(this.target.pos.x-this.pos.x,this.target.pos.z-this.pos.z);
moveYaw=toT+HPI*this.slideDir;
wantMove=true; speed=3.2;
this.crouch=this.suppression>0.5; this.prone=false;
}
if(this.manT<=0){ this.man='hold'; this.manT=rand(0.8,1.6); this.stance=this.suppression>0.9?'crouch':'stand'; }
} else {
// 驻停: 姿态保持; manT 到期后由 decide 重抽机动 (旧版0.3s地板导致永远不重抽→推进欲望被吞)
this.manT-=dt;
this.crouch=this.stance==='crouch';
this.prone=this.stance==='prone';
}
}
else if(this.state==='hunt'){
const my=this.followPath(dt);
if(my!==null){ moveYaw=my; wantMove=true; speed=this.suppression>0.5?2.4:3.4;
// 受压制时蛇形接近
if(this.suppression>0.25) moveYaw+=Math.sin(nowT*2.2+this.wanderSeed*4)*0.4;
this.crouch=this.suppression>0.8;
}
else if(this.target&&Math.hypot(this.lastSeenPos.x-this.pos.x,this.lastSeenPos.z-this.pos.z)<5){
// 到达最后目击点: 原地环视搜索 (旧版到点后傻站不动)
this.crouch=this.suppression>0.5;
this.scanT=(this.scanT||0)-dt;
if(this.scanT<=0){ this.scanT=rand(1.2,2.2); this.scanYaw=this.yaw+rand(-1.5,1.5); }
this.yaw=angleLerpTo(this.yaw,this.scanYaw??this.yaw,2.2*dt);
}
else{
// 2026-09-19: 追踪目标不可达 (隔墙/隔水/死在孤岛) 也要推进, 不再原地等信息过期
moveYaw=this.pushToward(this.lastSeenPos.x,this.lastSeenPos.z,dt,0);
wantMove=true; speed=this.suppression>0.5?2.4:3.4;
this.crouch=this.suppression>0.8;
}
this.prone=false;
}
else if(this.state==='advance'){
const my=this.followPath(dt);
if(my!==null){ moveYaw=my; wantMove=true; speed=this.suppression>0.6?3.0:5.0;
if(this.suppression>0.25) moveYaw+=Math.sin(nowT*2.0+this.wanderSeed*4)*0.35;
}
else{
// 2026-09-19: 推进目标不可达的兜底 —— 朝目标直行 (moveDir 内避障), 定期重试中转点
const f0=this.objective;
if(f0){
moveYaw=this.pushToward(f0.x,f0.z,dt,0);
wantMove=true; speed=this.suppression>0.6?3.0:5.0;
}else{
// 连目标都没有 (理论上该由 decide 立刻补): 至少别站着 —— 朝战场中心/敌基地方向挪
const eb=(BASES.length?BASES[1-this.team]:basePos(1-this.team));   // (2026-11-10: opensea capBasePos 兜底随纯海战图下架摘除)
moveYaw=this.pushToward(eb.x,eb.z,dt,0);
wantMove=true; speed=3.2;
}
}
this.crouch=false; this.prone=false;
}
else if(this.state==='toVehicle'){
const tv=this.targetVeh;
if(!tv||!tv.alive||tv.crewBot||tv.playerDriven||tv.hp<tv.maxHp*0.4){ this.state='idle'; this.targetVeh=null; if(tv&&tv.claimBot===this) tv.claimBot=null; }
else {
tv.claimT=nowT;
const d=Math.hypot(tv.pos.x-this.pos.x,tv.pos.z-this.pos.z);
// 上车触达 (★2026-11-03 三修, 实机"兵挤在坦克面前就是上不去"根因): 旧版 d<VEH_BOARD_R(2.7, 以车心为准)
// 而 vehiclePushSoldiers 把步兵挡在"车壳 OBB+0.38m"之外 —— 车体半长+0.83 > 2.7 对**所有坦克**成立
// (hullL 最短 4.6 ⇒ 3.13m), 从首尾方向接近的 Bot 被永久顶在前装甲上, 够不到判定圈 (侧向接近偶尔能进 =
// 实机观感"时灵时不灵")。改按**车壳表面距离**判 (与 15-vehicles:998 的推挤几何同源同参): 贴壳 ≤0.55m
// 即上 —— 可见的人永远贴着车壳消失 (2026-09-20 闪现修复"消失点贴车壳"原则不变), 任何车长/任何方向都成立。
const _cs=Math.cos(tv.yaw), _sn=Math.sin(tv.yaw);
const _rx=this.pos.x-tv.pos.x, _rz=this.pos.z-tv.pos.z;
const _lx=_rx*_cs-_rz*_sn, _lz=_rx*_sn+_rz*_cs;
const _hL=((tv.def&&tv.def.hullL)?tv.def.hullL:4.6)/2+0.45;
const _hW=(tv.halfW!==undefined)?Math.max(2.05,tv.halfW):2.05;
// 轴配对与 vehiclePushSoldiers 同参: _lx 横向比半宽 _hW, _lz 纵向比半长 _hL (2026-11-03 探针抓出首版轴反了)
const _surf=Math.max(Math.abs(_lx)-_hW,Math.abs(_lz)-_hL);
if(_surf<0.55){ this.enterVehicle(tv); return; }
// 贴壳却上不去的兜底 (车被夹在墙/车之间): 顶壳 6s 就放弃认领归建, 并把该车拉黑 12s
// (平衡: 释放的兵回步兵决策流, 不再白站; 认领纪律不变 —— 每车同时仍只有一个人认领)。
if(_surf<1.6){
this.vehGoT=(this.vehGoT||0)+dt;
if(this.vehGoT>6){
this.vehGoT=0; this.vehFailV=tv; this.vehFailT=nowT+12;
this.state='idle'; this.targetVeh=null;
if(tv.claimBot===this) tv.claimBot=null;
}
}else this.vehGoT=0;
const my=this.followPath(dt);
if(my!==null){ moveYaw=my; }
else {
// 2026-09-19: 走近载具的路被挡/不可达 → 直行兜底 (旧版站住等 claim 超时)
if(d>26){ this.state='idle'; if(tv.claimBot===this) tv.claimBot=null; this.targetVeh=null; this.navFails=0; }
else moveYaw=this.pushToward(tv.pos.x,tv.pos.z,dt,0);
}
wantMove=true; speed=5.2;
this.crouch=false; this.prone=false;
}
}
else if(this.state==='toEmpl'){
// 上炮位接近段 (2026-09-20 闪现修复): 走到固定火力点站位旁才起前摇 —— 取代旧版"隔空上炮"。
// 炮被占/报废/超时即放弃; 路径不可达时在接近半径内直行兜底 (走不到就放弃, 不硬 set 到炮位)。
const eg=this.emplGo;
if(!eg||!eg.g||eg.g.dead||!empReady(eg.g)||nowT>eg.exp){ this.emplGo=null; this.state='idle'; }
else{
const sp=this.emplStandSpot(eg.g,eg.kind);
const d=Math.hypot(sp.x-this.pos.x,sp.z-this.pos.z);
if(d<=EMPL_STAND_R){ this.emplMount(eg.g,eg.kind); } // 到位: 起前摇 (下一帧起原地操作), 本帧站住
else{
const my=this.followPath(dt);
if(my!==null) moveYaw=my;
else if(d>EMPL_APPROACH_R*1.3){ this.emplGo=null; this.state='idle'; }
else moveYaw=this.pushToward(sp.x,sp.z,dt,0);
wantMove=true; speed=4.2;
}
}
this.crouch=false; this.prone=false;
}
else if(this.state==='toSupply'){
// 弹尽寻补给执行段 (2026-11-03 弹药账对齐): 贴箱 1.7m 站定 1.2s 补满 (备弹顶到 上限+一匣, 与玩家 grab 同账
// + 投掷物照补); 近敌 (<14m 且可见) 转身接战; 超时/失去目标箱/被安排上炮 即放弃。受创打断见 damage 门。
const sg=this.supplyGo;
if(!sg||nowT>sg.exp||this.mgUse||this.mortUse||this.empUse||this.batUse||this.emCast){ this.supplyGo=null; this.state='idle'; }
else if(this.target&&this.target.alive&&nowT-this.lastSeenT<2&&Math.hypot(this.target.pos.x-this.pos.x,this.target.pos.z-this.pos.z)<14){
this.supplyGo=null; this.state='combat';
}else{
const d=Math.hypot(sg.x-this.pos.x,sg.z-this.pos.z);
if(d<=1.7){
this.supplyT-=dt;
this.vel.set(0,0,0); this.crouch=false; this.prone=false;
if(this.supplyT<=0){
for(const s of this.slots){ s.reserve=s.def.reserve+s.def.mag; }
const _gear=clsGear(this.cls,this.team);
this.nades=_gear.nades; this.smokes=_gear.smoke; this.atn=_gear.atn;
this.supplyGo=null; this.state='combat'; this.decisionT=0;
}
}else{
const my=this.followPath(dt);
if(my!==null) moveYaw=my;
else if(d>7){ this.supplyGo=null; this.state='idle'; }
else moveYaw=this.pushToward(sg.x,sg.z,dt,0);
wantMove=true; speed=4.4;
}
}
}
else if(this.state==='defend'){
const my=this.followPath(dt);
if(my!==null){ moveYaw=my; wantMove=true; speed=2.6; }
else {
// 2026-09-19: 驻守点不可达时也要往目标圈挪 (旧版原地站到天荒地老)
const f1=this.objective;
if(f1&&Math.hypot(f1.x-this.pos.x,f1.z-this.pos.z)>f1.r*0.85){
moveYaw=this.pushToward(f1.x,f1.z,dt,0);
wantMove=true; speed=2.6;
}else{
this.crouch=Math.random()<0.002?!this.crouch:this.crouch;
if(!engaged){
this.scanT=(this.scanT||0)-dt;
if(this.scanT<=0){ this.scanT=rand(2,4); this.scanYaw=this.yaw+rand(-1.6,1.6); }
this.yaw=angleLerpTo(this.yaw,this.scanYaw??this.yaw,1.2*dt);
}
}
}
}
// 逃命覆盖: 火线上不做战术机动, 背火疾跑脱身 (瞄准/还击由下方 faceTo 独立处理, 不中断)
if(this.fireFleeT>0){
wantMove=true; moveYaw=this.fleeYaw; speed=5.7;
this.crouch=false; this.prone=false; this.stance='stand';
}
// 前摇 = 原地操作 (与玩家同规): 2026-09-20 闪现修复补齐这一条 —— 旧版只有 decide() 提前返回,
// 位移照旧朝 objective 走, 前摇 0.9s 能走出 2.3m, 结束时离炮位更远 (正是"隔空上炮"的放大器)。
// 严禁用"把速度调低"掩盖问题: 这里只是把前摇期间的位移按规则清零 (玩家同样不能边按 F 边跑)。
if(this.emCast) wantMove=false;
// 士兵间软分离 (★2026-11-03, E 修): 挤在一起/卡在一起的主根因 —— 全库此前没有任何士兵-士兵推挤
// (collideMove 只推静态世界)。钉位态排除: 上炮/前摇/包扎/乘员/伞降/下车跨出在上方已各自 return,
// 这里再挡 emCast 与近战贴身。
if(!this.emCast&&!this.onVehicle&&!this.chuting&&!this.exitSlide&&this.state!=='melee') _soldierSep(this);
if(wantMove){ this.moveDir(moveYaw,speed*this.speedMul,dt); } else { this.vel.x*=0.7; this.vel.z*=0.7; }
if(wantMove&&this.unstickT<=0){
this.stuckT+=dt;
if(this.stuckT>0.9){
// 阈值收紧: 人群里缓慢挪动(>0.45m/0.9s)不算卡住, 不再触发侧蹿
if(this.pos.distanceTo(this.lastPos)<0.45){
// 脱困侧蹿: 方向延续(同侧原地再卡才换向)——旧版每次随机换向=左右猛蹿, 基地人群/方块间看起来在反复横移
this.unstickT=rand(0.3,0.45);
const progressed=!this.lastUnstickP||this.pos.distanceTo(this.lastUnstickP)>1.5;
if(!progressed) this.unstickDir=-this.unstickDir;
this.lastUnstickP=this.pos.clone();
// 连续3次脱困仍无真进展: 在路径前插一个垂直绕行点 (堵墙/窄缝兜底, A*盲区之外的保底)
this.stuckN=progressed?0:(this.stuckN||0)+1;
let detoured=false;
if(this.stuckN>=3){
const s=this.unstickDir;
const dx=this.pos.x+Math.sin(this.yaw+HPI*s)*7, dz=this.pos.z+Math.cos(this.yaw+HPI*s)*7;
if(!occBlocked(dx,dz)&&!_vehProbeBlocked(this,dx,dz)&&NAV.lineClear(this.pos.x,this.pos.z,dx,dz)){ // 绕行点也不许落在车壳里 (2026-11-12 避车批)
if(this.path){ this.path.unshift([dx,dz]); this.pathI=0; }
else this.setPathTo(dx,dz);
// 绕行保护期: 防止小队/目标点重寻路立刻覆盖刚插入的绕行点
this.repathT=rand(2,3);
detoured=true;
}
this.stuckN=0;
}
if(!detoured){ this.path=null; this.repathT=0; }
}
this.lastPos.copy(this.pos);
this.stuckT=0;
}
} else if(!wantMove) this.stuckT=0;
	if(this.target&&this.target.alive&&nowT-this.lastSeenT<1.6){
	// 拟人转身: 刚发现目标转得慢, 瞄稳后跟枪快
	this.faceTo(this.target.pos,dt,4+this.aimSettle*3.5);
	} else if(this.target&&nowT-this.lastSeenT<8){
	this.faceTo(this.lastSeenPos,dt,4);
	} else if(wantMove){
	this.yaw=angleLerpTo(this.yaw,moveYaw,5*dt);
	}
	// 开火窗口: 目标在视野内(0.6s)正常射击; 刚丢失(压制窗口)朝最后目击位补射; 探头出位才从掩体开枪
	// (修复旧版: 目标消失后仍朝其"实时坐标"扫射4秒的穿墙泼弹)
	const tgtVis=this.target&&this.target.alive&&nowT-this.lastSeenT<0.6;
	const fireGate=!(this.state==='cover'&&this.peekPhase!=='out');
	if((tgtVis||this.supFireT>0)&&fireGate&&this.reactT<=0&&this.reloadT<=0&&this.boltT<=0){
	const tp=tgtVis?this.target.pos:this.lastSeenPos;
const dT=Math.hypot(tp.x-this.pos.x,tp.z-this.pos.z);
const wantYaw=Math.atan2(tp.x-this.pos.x,tp.z-this.pos.z);
// 远距离要求瞄得更正才开枪
const aimGate=dT>50?0.08:(dT>25?0.11:0.16);
	if(Math.abs(angDiff(this.yaw,wantYaw))<aimGate){
	if(!tgtVis){
	// 压制射击: 朝最后目击位泼点射 (筒子/迫击炮保留弹药)
	if(!this.def.rocket&&!this.def.mortar&&this.mag>0){
	this.shootAtPos(V3(tp.x+rand(-1.6,1.6),tp.y+rand(0.2,1.4),tp.z+rand(-1.6,1.6)));
	this.fireT=this.def.type==='auto'?60/this.def.rpm:rand(0.55,0.95);
	this.supFireT-=0.4;
	}
	}
	else if(this.def.rocket||(this.def.mortar&&dT<22)){
// 反坦克兵/迫击炮兵近距离改用手枪自卫
if(this.pReloadT<=0&&this.fireT<=0){
if(this.pMag<=0&&(!this.slots||!this.slots[1]||this.slots[1].reserve>0)){ this.pReloadT=this.slots[1]?this.slots[1].def.reload*dynReloadFac(this.pMag,this.slots[1].def.mag):2; } // 动态换弹速度 (2026-11-12)
else {
this.shootAt(this.target,this.slots[1].def);
this.fireT=(60/this.slots[1].def.rpm)*rand(1.4,2.4);
}
}
}
else if(this.def.mortar){
// 迫击炮曲射: 朝最后目击位吊射, 无需直瞄
if(this.mag>0&&this.fireT<=0&&dT>22&&dT<100){
const eye=this.eyePos();
const tx=this.lastSeenPos.x+rand(-7,7), tz=this.lastSeenPos.z+rand(-7,7);
const dist2=Math.hypot(tx-this.pos.x,tz-this.pos.z);
// 2026-09-28 阶段三 P1: tof 单源化到 mortarArcTof (13-combat) —— 高抛越障 (顶点 3.7~11m),
// 与玩家迫击炮座(emplMortarShell)同一支解算器; 旧 dist2/30 平抛会被田块缓坡/树篱半路吃掉 (取证见 _farm-block-probe)
const tof=mortarArcTof(dist2);
const dy=(heightAt(tx,tz)+0.05)-eye.y;   // 高差项 (2026-09-28): 落点解在任何地形恒精确
const v=mortarVel(eye.x,eye.z,tx,tz,tof,dy);
const m=new THREE.Mesh(nadeGeoAT,vmMats.gun);
m.position.copy(eye); scene.add(m);
nades.push({m,pos:eye.clone(),vel:v,fuse:9,thrower:this,team:this.team,spin:V3(4,0,1),bounces:0,mortar:true,src:'迫击炮'});
AudioSys.mortarThunk(this.pos.distanceTo(camera.position));
this.mag--;
if(this.slots&&this.slots[0]) this.slots[0].mag=this.mag;   // 弹药账对齐 (2026-11-03)
this.fireT=rand(4.5,6.5);
if(this.mag<=0&&this.canReload()) this.reloadT=this.def.reload;
this.mesh.armR.sh.userData.swing=0.3;
this.crouch=true;
}
}
else if(this.def.type==='auto'){
if(this.mag>0&&this.burstPause<=0){
// 距离化点射节奏: 近距离长点射泼弹, 远距离两三发短点
if(this.burstLeft<=0){ this.burstLeft=dT>45?randi(2,3):(dT>18?randi(3,5):randi(5,9)); }
if(this.fireT<=0){
this.shootAt(this.target);
this.fireT=60/this.def.rpm;
if(--this.burstLeft<=0) this.burstPause=dT>45?rand(0.8,1.6):(dT>18?rand(0.5,1.0):rand(0.25,0.55));
}
}
} else {
if(this.mag>0&&this.fireT<=0){
this.shootAt(this.target);
this.fireT=this.def.type==='bolt'?0.1:(dT>40?rand(0.6,1.1):rand(0.4,0.75));
if(this.def.type==='bolt') this.boltT=this.def.boltT||1.0;
}
}
}
}
if(this.mag<=0&&this.reloadT<=0){
// 弹尽 (2026-11-03 弹药账对齐): 有备弹照常换; 备弹尽 → 寻补给 (supplyGo) / 搜刮保底, 不再空转 reloadT
if(this.canReload()) this.reloadT=this.def.reload*dynReloadFac(this.mag,this.def.mag)*rand(1,1.25); // 动态换弹速度 (2026-11-12)
else this.drySeekSupply();
}
this.updateMesh(dt,Math.hypot(this.vel.x,this.vel.z));
}
// A#9 岸防炮: 释放占用 (下车/死亡/目标丢失/退场) —— 清 crewBot/user 双轨并给"重上冷却"。
// 重上冷却与固定火力点同规 (EMP_REARM_T): 否则一门炮会被同一个人反复上下, 或被抢来抢去。
releaseBattery(){
const g=this.batUse;
this.batUse=null; this.batteryTgt=null; this.batT=0;
if(!g) return;
if(g.crewBot===this) g.crewBot=null;
if(g.user===this) g.user=null;
if(g.cdLock!==undefined) g.cdLock=nowT+EMP_REARM_T;
}
// A#9 岸防炮操作 (契约 §6): 钉站位 → 搜敌艇 → 转炮 → 对准才开炮 (唯一入口 batteryFire)。
// 与 updateEmplacement 的 atGun 分支同构; 差异只有"目标在海上"(navalCraft) 与"炮位/弹速单源在 15f"。
updateBatteryGun(dt){
const g=this.batUse;
if(!g||g.alive===false||g.crewBot!==this){ this.releaseBattery(); return; }
this.crouch=false; this.prone=false;
this.vel.set(0,0,0);
const sp=this.emplStandSpot(g,'bat');
this.pinEmpl(sp.x,sp.z,dt);                       // 站位单源 (15f batteryStandSpot; 缺模块时同口径兜底)
this.pos.y=standHeight(this.pos.x,this.pos.z,this.pos.y+1);
// 搜敌艇 (与 15f pickTarget 同条件: 敌队/未沉/射程内/LOS 通)
const tgt=batteryTargetFor(g);
this.batteryTgt=tgt;
if(!tgt){ this.releaseBattery(); this.updateMesh(dt,this.emplPinT>0?EMPL_SNAP_SPD:0); return; }
// 提前量 = 距离 / 弹速 (弹速取 SHELL_SPD_NAVAL 单源); 目标速度走 navTgtVel (15d 的 vel+yaw 语义)
// ★2026-09-26E (审计 8): 瞄准解算走模块级单源 batteryAimSolve —— 15f 退役的 Battery.aim 委托同一支,
// 两边共用"回旋 ±BATTERY_YAW_MAX + 俯角下限 batteryPitchFloor"这一套限界 (旧版本函数内联、15f 那份旧口径)。
const solve=batteryAimSolve(g,tgt,dt);
const ey=solve.ey, dh=solve.dh, wantYaw=solve.wantYaw, wantPit=solve.wantPit;
this.yaw=(g.yaw&&g.yaw.rotation)?(g.face||0)+g.yaw.rotation.y:wantYaw;
// A#10 审计③ 的一致性口径: 操作者的身体朝向/俯仰与炮口同源 (旧版只同步 yaw, pitch 停在进炮位之前的值)
this.pitch=clamp(wantPit,solve.pitLo,0.75);
if(!solve.aligned||g.cd>0) { this.updateMesh(dt,this.emplPinT>0?EMPL_SNAP_SPD:0); return; }
// 炮口预检 (LOS 被自家胸墙/地形挡住 → 短退避重试, 与 atGun 的"被挡 3.5s"同档)。
// 起点走 15f 的 muzzle() 单源 (含 3.66m 前移 + 当前俯仰), 缺模块时才用本地等价式 —— 不自己另写一套前移量。
const er=0.02*DIFF_TABLE[SETTINGS.diff].spreadMul;
const dir=V3(Math.sin(wantYaw)*Math.cos(wantPit),Math.sin(wantPit),Math.cos(wantYaw)*Math.cos(wantPit));
dir.x+=rand(-er,er); dir.y+=rand(-er,er)*0.6; dir.z+=rand(-er,er); dir.normalize();
const o=(typeof g.muzzle==='function')?g.muzzle():V3(g.x,by,g.z).addScaledVector(dir,3.66);
const chk=raycastWorld(o,dir,dh);
if(chk&&chk.dist<=dh-1.5){ g.cd=BAT_BLOCKED; this.updateMesh(dt,this.emplPinT>0?EMPL_SNAP_SPD:0); return; }
// 唯一开火入口 (契约 §6 冻结签名 batteryFire(g,dir,owner)); 冷却在 Battery.fire 内部单源重置
this._src=g.name||'反舰炮台';
if(typeof batteryFire==='function') batteryFire(g,dir,this);
this.mesh.armR.sh.userData.swing=0.2;
this.updateMesh(dt,this.emplPinT>0?EMPL_SNAP_SPD:0);
}
updateEmplacement(dt){
const g=this.empUse;
this.crouch=false; this.prone=false;
this.vel.set(0,0,0);
this.pos.y=standHeight(this.pos.x,this.pos.z,this.pos.y+1);
g.cd-=dt;
if(g.kind==='at'){
this.pinEmpl(g.x-Math.sin(g.face)*AT_CREW_DIST, g.z-Math.cos(g.face)*AT_CREW_DIST, dt); // 站位单源 (00-config AT_CREW_DIST); 2026-09-20 落位过渡同 pinEmpl
const tk=enemyTankNear(this,160);
if(tk){
const wantYaw=Math.atan2(tk.pos.x-g.x,tk.pos.z-g.z);
// 方向机限界 (★2026-09-26 修, P1-12): 与玩家侧同一条 (00-config AT_YAW_MAX) —— 旧版 360° 转向目标,
// 炮口会从操作手躯干中间穿过去 (炮口 2.69m / 站位 0.9m)。限界外的目标: 炮口停在限界上,
// 下面的"转塔对准才开火"门 (容差 0.05) 自然不通过 ⇒ 不会出现"炮口朝西、炮弹朝东"的错位弹道。
const rel=clamp(angDiff(g.face,wantYaw),-AT_YAW_MAX,AT_YAW_MAX);
g.yaw.rotation.y=dampF(g.yaw.rotation.y,rel,4,dt);
this.yaw=g.face+g.yaw.rotation.y;
const dh=Math.hypot(tk.pos.x-g.x,tk.pos.z-g.z);
const pit=clamp(Math.atan2((tk.pos.y+1.2)-g.y,dh),-AT_PITCH_DOWN,0.6); // 俯角下限单源 (00-config)
g.pitch.rotation.x=dampF(g.pitch.rotation.x,-pit,4,dt);
// A#10 审计③: 操作者的枪口俯仰与炮口同源 —— 旧版只同步 yaw, this.pitch 停在"进炮位之前"的值
// (实测整个上炮期间 pitchRange=0, 与炮口最大差 0.43 rad ≈ 24°; 蹲着进炮位就一直仰角 8°)。
this.pitch=clamp(pit,-AT_PITCH_DOWN,0.6);
if(Math.abs(angDiff(g.face+g.yaw.rotation.y,wantYaw))<0.05&&g.cd<=0&&this.reactT<=0){
const dir=V3(Math.sin(this.yaw)*Math.cos(pit),Math.sin(pit),Math.cos(this.yaw)*Math.cos(pit));
const er=0.02*DIFF_TABLE[SETTINGS.diff].spreadMul; // AI 散布档 (DIFF_TABLE)
dir.x+=rand(-er,er); dir.y+=rand(-er,er)*0.6; dir.z+=rand(-er,er); dir.normalize();
const o=V3(g.x,g.y,g.z).addScaledVector(dir,2.7);
const chk=raycastWorld(o,dir,dh); // LOS 预检只有 Bot 需要 (玩家目视瞄准)
if(!chk||chk.dist>dh-4){
emplATFire(g,this,dir); // 冷却/炮口/弹速/特效/击杀来源单源 (13-combat)
	} else g.cd=3.5; // 被墙/地形挡住打不中: 较长间隔重试, 避免"连续开炮"观感
}
}
} else {
this.pinEmpl(g.crew?g.crew.x:g.x, g.crew?g.crew.z:(g.z-AA_CREW_DIST), dt); // 2026-09-20 闪现修复: AA 位落位过渡 (与 emplStandSpot 'aa' 同源)
const pl=aaSpreadTarget(this.team,this,g.x,g.z); // 7d-甲: 分摊账本 (旧 enemyPlaneAlive 齐射第一架绝迹)
// 7b-乙 反应窗 (AA_DIFF.react): 换目标/新目标进距后不即刻开火 —— 旧版无反应门, 新目标当帧就泼弹。
// 专用 aaReactT, 不与步兵 reactT 混账 (离炮位后枪械反应不该吃高炮的账); 瞄准跟踪照常, 只封扳机。
const _plP=!!(pl&&pl.playerDriven); // 目标是玩家驾驶的机 (2026-10-06 难度批: 高炮对玩家反应/散布放宽, AI 互射不变)
if(pl){
if(pl!==this._aaTgt){ this._aaTgt=pl; this.aaReactT=Math.max(this.aaReactT||0,AA_DIFF[SETTINGS.diff].react*(_plP?1.3:1)); }
if(this.aaReactT>0) this.aaReactT-=dt;
}
if(pl){
const lead=pl.pos.clone();
const dist=lead.distanceTo(V3(g.x,g.y,g.z));
const tof=dist/FLAK_SPD; // 7d-乙: 高炮弹速单源 FLAK_SPD (旧借 SHELL_SPD, 四联 20mm 定稿后独立)
// 7b-甲: 瞄准点随机散布按难度分档 (AA_DIFF 单源; 旧写死 ±25/±8 = 老兵档等效, 对机伤害倍率走 Plane.takeDmg 的 DIFF_TABLE.dmgMul)
// ★2026-10-06 难度批: 目标是玩家驾驶的机时散布 ×1.4 (只削对玩家)。
const aj=AA_DIFF[SETTINGS.diff].jit*(_plP?1.4:1), ajY=aj*0.32;
lead.x+=Math.sin(pl.yaw)*Math.cos(pl.pitch)*pl.speed*tof*0.5+rand(-aj,aj);
lead.z+=Math.cos(pl.yaw)*Math.cos(pl.pitch)*pl.speed*tof*0.5+rand(-aj,aj);
lead.y+=Math.sin(pl.pitch)*pl.speed*tof*0.5+rand(-ajY,ajY);
const wantYaw=Math.atan2(lead.x-g.x,lead.z-g.z);
g.yaw.rotation.y=angleLerpTo(g.yaw.rotation.y,wantYaw,3*dt);
this.yaw=g.yaw.rotation.y;
const dh=Math.hypot(lead.x-g.x,lead.z-g.z);
const pit=clamp(Math.atan2(lead.y-g.y,Math.max(dh,3)),-0.45,1.35);
g.pitch.rotation.x=dampF(g.pitch.rotation.x,-pit,5,dt);
this.pitch=clamp(pit,-0.45,1.35);   // A#10 审计③: 高炮操作者的仰角同样跟炮口 (旧版停在进炮位前的值)
if(g.cd<=0&&dist<EMPL_AA_ENGAGE_R*(NIGHT_MODE?NIGHT_CFG.rangeMul:1)*WX_CFG.rangeMul&&this.aaReactT<=0){ // 7b-乙: 反应窗走完才准开火; 交战距离单源 (2026-09-30 空对地平衡批, 旧写死 220); 夜档 ×rangeMul (昼夜设计 §3.3)
g.cd=EMPL_AA_CD; // D1=c: 与玩家同档 0.34 (旧 0.62 分叉), Bot 强度差异走 DIFF_TABLE 散布
const dir=V3(Math.sin(wantYaw)*Math.cos(pit),Math.sin(pit),Math.cos(wantYaw)*Math.cos(pit));
const er=0.05*DIFF_TABLE[SETTINGS.diff].spreadMul;
dir.x+=rand(-er,er); dir.y+=rand(-er,er)*0.7; dir.z+=rand(-er,er); dir.normalize();
fireFlak(g,this,dir);
this.lastFiredT=nowT;
}
}
}
// 落位过渡期给"走路速度": 腿在迈, 而不是滑行 (2026-09-20 闪现修复的观感配套)
this.updateMesh(dt,this.emplPinT>0?EMPL_SNAP_SPD:0);
}
followPath(dt){
// 2026-09-20 闪现修复 (可疑点#5 等价改写): 旧版对"已到达的路点"递归 `return this.followPath(dt)`,
// 退化路径 (waypoint 重合/极近) 会一次吃掉大量路点并突然折向, 且有栈深风险。行为等价 + 有界: 同一次调用
// 仍然跳过所有已到达的路点, 但改为迭代 —— 实测该现象 0 次 (pathI 单帧跳变 ≥6 = 0), 属预防性改写。
while(this.path&&this.pathI<this.path.length){
const wp=this.path[this.pathI];
const dx=wp[0]-this.pos.x, dz=wp[1]-this.pos.z;
if(dx*dx+dz*dz<1.44){ this.pathI++; continue; }
return Math.atan2(dx,dz);
}
this.path=null; return null;
}
moveDir(yaw,speed,dt){
if(this.unstickT>0){
this.unstickT-=dt;
yaw+=HPI*this.unstickDir;
speed=Math.min(speed,2.2); // 脱困侧蹿限速: 大步幅侧跳看起来就是反复横移
} else {
if(!_botMoveProbe(this,yaw)){
let found=false;
for(let di=0;di<MOVE_DA.length;di++){
if(_botMoveProbe(this,yaw+MOVE_DA[di])){ yaw+=MOVE_DA[di]; found=true; break; }
}
// 全向都走不动时的兜底换向 (2026-09-20 闪现/打摆修复, 可疑点#6): 旧版逐帧重掷 Math.random() ——
// 相邻两帧可能一边一个方向 (moveYaw 被下面的 angleLerpTo 平滑, 结果就是原地左右打摆)。
// 改为方向记忆 + 冷却: 同一侧至少坚持 DIR_FLIP_MIN 秒, 到期才允许换边。
if(!found){
if(this.dirFlipT>0) this.dirFlipT-=dt;
if(this.dirFlipT<=0){ this.dirFlipSign=Math.random()<0.5?1:-1; this.dirFlipT=DIR_FLIP_MIN; }
const fy=yaw+HPI*this.dirFlipSign;
// 兜底侧移也要过探针 (2026-11-12 避车批): 全向堵死时 perpendicular 一脚会踩进车壳 (端到端探针
// 实测最深 -1.1m) —— 侧移向不通就本帧驻足 (speed=0, vel 归零), 下帧再试, 不再无探针位移。
if(_botMoveProbe(this,fy)) yaw=fy; else speed=0;
}
}
}
	const cr=this.prone?0.28:this.crouch?0.5:1;
	const wf=nowT-(this.wireT||-9)<0.3?0.42:1;
	// 深谷激流: 涉水大幅减速并持续受创; 被激流冲向下游 1.5m/s (2026-09-06 B7b/D5: 与玩家同参, README 口径兑现)
	const riv=inRiverWater(this.pos.x,this.pos.z); // 2026-11-15 水态门 (同玩家侧: 干岸坡不吃激流伤/冲移)
	if(riv){
	this.damage(RAPIDS_DMG*dt,null,false);
	const rd=riverDirAt(this.pos.x,this.pos.z);
	if(rd){ this.pos.x+=rd[0]*1.5*dt; this.pos.z+=rd[1]*1.5*dt; }
	}
	// ── 游泳 (2026-09-18 塔拉瓦批, 与玩家同规则 —— 纲领第 2 条) ──
	// Bot 无真实重力: 水体状态按**水深**判 (玩家按脚底-水面高差判, 两者在深水里等价)。
	// 落水自救: 游泳态一律朝最近岸游; 游泳不可开火 (见 aimShot 闸门); 憋气/溺水与玩家同一支代码。
	// ── 水态 (★2026-09-26E 审计 23 修复: 改读 03-terrain 的**水态单源** waterStateAt) ──
	// 旧版按 waterDepthAt 判"我是否在水里", 而 waterDepthAt 内部用 heightAt(...,true) **强制取河床、无视桥面**
	// (那是给"水面高度计算"用的口径) ⇒ 站在桥面时"水深" = 桥面到河床 (胡康大桥 5.73m / 北石拱桥 5.86m) > SWIM_DEPTH
	// ⇒ 判游泳 ⇒ 同一帧把 y 从桥面拽到桥下水面 (wy−0.95 ≈ −8.92) ⇒ **AI 走上任何"桥下水深>SWIM_DEPTH"的桥
	// 必然穿桥落水** (实测: 桥西(−52,2)→桥东(46,−6) 的路径确实过桥, 900 帧后停在 (−9.6,16.3)、离目标 59.9m),
	// 而胡康/淞沪的主题通道正是这几座桥。
	// waterStateAt 把"脚在水面之上"判 dry ⇒ 桥面/栈桥面/干地不会误判 (与玩家同一条单源, 纲领第 2 条)。
	const WS=waterStateAt(this.pos.x,this.pos.y,this.pos.z);
	const swimming=WS.state==='swim';
	this.swim=swimming;
	this.wading=WS.state==='wade';
	const wet=WS.state==='wet';
	// 入水跃迁特效/音效 (★2026-11-15 入水批): 与玩家 20-player 的水态跃迁同规 —— 只在干→湿的
	//   下降沿发一记扑通 (湿→涉水→游泳的升级不重发), 规模随落水速度变化; Bot 没有竖直速度账,
	//   用相邻帧 pos.y 差折算 (_wyPrev 上帧脚底高度, 游泳态贴水面后差≈0 → 自然回落到最小档)。
	{
	const wPrev=this._wStatePrev||'dry';
	if(WS.state!==wPrev){
	this._wStatePrev=WS.state;
	const wetNow=WS.state!=='dry', wetPrev=wPrev!=='dry';
	if(wetNow&&!wetPrev){
	const spd=(this._wyPrev!==undefined&&dt>0)?Math.max(0,(this._wyPrev-this.pos.y)/dt):0;
	if(typeof waterSplash==='function') waterSplash(V3(this.pos.x,WS.wy,this.pos.z),clamp(0.6+spd*0.09,0.6,2.2),spd>5,false);
	}
	}
	}
	this._wyPrev=this.pos.y;
if(swimming){
// (2026-11-10: opensea 游向本队舰劫持随纯海战图下架摘除, 落水自救恢复"朝最近岸游"单支)
{ const sd=shoreDirAt(this.pos.x,this.pos.z); if(sd){ yaw=Math.atan2(sd[0],sd[1]); this.yaw=yaw; } }
// ★航向落回 this.yaw (2026-10-03): 朝向判定 (faceTo/moveYaw 望向) 跑在 WS 块之前, 劫持只改了
//   积分用的局部 yaw ⇒ this.yaw 仍是旱地决策的 moveYaw —— 泳者"横着游" (T10 dot 判负即此)。
//   WS 块是 update 的最后一段, 这里落回 this.yaw 即为本帧最终朝向; 岸图自救的朝岸游同样受益。
speed=Math.min(speed,SWIM_SPD);
}
	// 水态三档速度系数 (2026-09-26E 审计 33/26): 游泳=1 (上面已把速度钳到 SWIM_SPD) / 涉水 ×0.55 / 湿沙 ×0.9;
	// 深谷激流另吃 ×0.4 而**游泳态不吃** (与玩家同口径: 泳速 2.0 > 冲移 1.5, 掉进河里游得回岸)。
	// 旧版这里写 `inShallowChannel?0.55`: 只覆盖"浅河/汊港/鱼塘"这类地图语义 ⇒ 塔拉瓦礁盘那样的开阔浅水
	// 不减速 (Bot 涉水全速跑, 玩家 ×0.55), 冰河/湿沙上又叠出 ×0.55×0.9 的双罚 ⇒ 改按水态单源分档。
	const wmul=swimming?1:(riv?0.4:(this.wading?WADE_SPD:(wet?WET_SPD:1)));
// 持枪移速系数 (2026-09-28 阶段三 P1, 用户裁定"不同武器移速不同, 手枪最快"): 与玩家同源武器表 wSpd (09a-defs)。
// 游泳不乘 (泳速已钳 SWIM_SPD, 与玩家口径一致)。
const gwsp=swimming?1:((this.def&&this.def.wSpd)||1);
this.vel.x=Math.sin(yaw)*speed*cr*wf*wmul*gwsp;
this.vel.z=Math.cos(yaw)*speed*cr*wf*wmul*gwsp;
// 坡度物理 (2026-09-12): 与玩家同规则 —— 上坡>40°减速/>65°封(沿等高线滑), 下坡不设限 (游泳态不适用)
if(swimming){ this.pos.x+=this.vel.x*dt; this.pos.z+=this.vel.z*dt; }
else{
const mvS=slopeGateMove(this.pos,this.vel.x*dt,this.vel.z*dt);
this.pos.x+=mvS[0]; this.pos.z+=mvS[1];
}
collideMove(this.pos,0.4);
if(swimming){
// 浮于水面下 0.95m (头露出水面), 受海床限制; 不穿水面也不穿水底
const bed=heightAt(this.pos.x,this.pos.z,true);
const wy=waterYAt(this.pos.x,this.pos.z);
// 2026-09-26E (审计 37): 与玩家同一支波场 (一视同仁)
const wvB=(typeof navalWaveAt==='function')?navalWaveAt(this.pos.x,this.pos.z):0;
this.pos.y=dampF(this.pos.y,Math.max(wy-FLOAT_PAD+wvB,bed+0.12),8,dt);
}else{
const gh=standHeight(this.pos.x,this.pos.z,this.pos.y+0.6);
this.pos.y=dampF(this.pos.y,gh,20,dt);
}
// 憋气/溺水 (与玩家同一支规则; AI 不主动下潜 → 常态不触发, 规则同源以备日后两栖载具/被击落水)
{
const hd=headDepthAt(this.pos.x,this.pos.y,this.pos.z);
if(hd>0){
this.oxy=(this.oxy===undefined?1:this.oxy)-dt/OXY_MAX;
if(this.oxy<=0){
this.oxy=0;
this._drownAcc=(this._drownAcc||0)+OXY_DMG*dt;
if(this._drownAcc>=1){ const dd=Math.floor(this._drownAcc); this._drownAcc-=dd; this.damage(dd,null,false); }
}
}else{
this.oxy=Math.min(1,(this.oxy===undefined?1:this.oxy)+dt/OXY_REFILL);
this._drownAcc=0;
}
}
}
faceTo(p,dt,rate){
const wantYaw=Math.atan2(p.x-this.pos.x,p.z-this.pos.z);
this.yaw=angleLerpTo(this.yaw,wantYaw,rate*dt);
const dy=(p.y+1.3)-(this.pos.y+1.5);
const dh=Math.hypot(p.x-this.pos.x,p.z-this.pos.z);
this.pitch=dampF(this.pitch,Math.atan2(dy,Math.max(dh,0.1)),8,dt);
}
shootAt(tgt,def2){
// 竖直瞄准偏置 (2026-09-28 阶段三 P1): 旧 rand(-0.12,0.2) 均值 +0.04 系统性偏上, 胸口线常扫进头部球
// (眼高 1.62+0.06, 球心 1.68) ⇒ "总是被爆头秒"的体感主因之一。改为 rand(-0.15,0.1) 均值 -0.025:
// 压低 ~7cm, 爆头从"常发"回落到"偶发" —— 只动 Bot 瞄准分布, 玩家火力不受影响。
const aimP=V3(tgt.pos.x,tgt.pos.y+(tgt.prone?0.32:tgt.crouch?0.9:1.25)+rand(-0.15,0.1),tgt.pos.z);
if(tgt.vel){ aimP.x+=tgt.vel.x*rand(0,0.12); aimP.z+=tgt.vel.z*rand(0,0.12); }
this.aimShot(aimP,def2,tgt.vel?Math.hypot(tgt.vel.x,tgt.vel.z):0);
}
// 对固定点射击 (压制/补射): 无预判
shootAtPos(p,def2){
this.aimShot(V3(p.x,p.y,p.z),def2,0);
}
aimShot(aimP,def2,tSpd){
if(this.swim) return; // 游泳/潜水不可开火 (2026-09-18 用户定案; 与玩家 playerFireTick 闸门同口径)
if(def2){
this.pMag--;
if(this.slots&&this.slots[1]) this.slots[1].mag=this.pMag;   // 弹药账对齐 (2026-11-03): 槽位账随开火同步
const sideKey=(this.slots&&this.slots[1])?this.slots[1].key:null;
if(sideKey) this.switchVisualGun(sideKey);
this.visualGunTimer=nowT+1.8;
}else{
this.mag--;
if(this.slots&&this.slots[0]) this.slots[0].mag=this.mag;   // 弹药账对齐 (2026-11-03): 槽位账随开火同步 (附身面板实时读数)
if(this.heldWpnKey!==this.wpnKey){
this.switchVisualGun(this.wpnKey);
this.visualGunTimer=0;
}
}
const useDef=def2||this.def;
this._src=(useDef&&useDef.name)||''; // 击杀来源: 当前武器名 (含自选手枪/固定点武器)
const diff=DIFF_TABLE[SETTINGS.diff];
const tgtIsP=!!(this.target&&this.target.isPlayer);
const eye=this.eyePos();
const dir=aimP.sub(eye).normalize();
const dHor=Math.hypot(aimP.x-this.pos.x,aimP.z-this.pos.z);
// 散布难度列拆分 (2026-10-06 难度批): 瞄玩家用 pSpread, 互殴维持 spreadMul (tgtIsP 以当前目标分流;
// shootAtPos 无目标时走互殴列, 与旧口径逐位一致)。
let err=(1.7-this.aimSettle)*(tgtIsP?diff.pSpread:diff.spreadMul)*(1+this.suppression*1.0)*(this.crouch?0.75:1)*0.016;
err*=1+clamp((tSpd||0)/5,0,1.2)*0.85;
if(def2) err*=1.3;
if(this.prone) err*=0.55;
else if(Math.hypot(this.vel.x,this.vel.z)<0.4&&this.crouch&&(this.state==='defend'||this.state==='cover')) err*=0.6;
if(dHor<15) err*=1.4;
else if(dHor<28) err*=1.15;
if(this.target&&this.target.isPlayer&&this.target.sprinting) err*=1.2;
dir.x+=rand(-err,err); dir.y+=rand(-err,err)*0.7; dir.z+=rand(-err,err);
// 拟人瞄准: 甩枪初始偏差 + 缓慢呼吸漂移 (沿视线的横向/纵向)
const sideX=dir.z, sideZ=-dir.x;
const wob=(Math.sin(nowT*1.5+this.wanderSeed*3)+Math.sin(nowT*2.7+this.wanderSeed)*0.5)*0.011*(1.4-this.aimSettle);
dir.x+=sideX*(this.aimErrX+wob); dir.z+=sideZ*(this.aimErrX+wob);
dir.y+=this.aimErrY+Math.sin(nowT*1.1+this.wanderSeed*2)*0.007*(1.4-this.aimSettle);
dir.normalize();
const muzzleP=eye.clone().addScaledVector(V3(Math.sin(this.yaw),this.pitch*0.5,Math.cos(this.yaw)).normalize(),0.7);
muzzleP.y-=0.12;
fireBullet(this,eye,dir,useDef,muzzleP);
this.mesh.armR.sh.userData.swing=0.12;
}
// 战术小队先锋巡逻制: 智能开关手电筒 (隐蔽闭灯与巡逻开灯)
updateFlashlightAI(){
if(!this.alive||this.onVehicle||this.chute||this.swim){
if(this.flashlight) this.flashlight=false;
return;
}
const isDark=(typeof isDarkEnvironment==='function')?isDarkEnvironment():!!NIGHT_MODE;
if(!isDark){
if(this.flashlight) this.flashlight=false;
return;
}
// 战术隐蔽约束: 绝对关灯条件 (交战/受击开火/受压制/掩体潜行/负伤救治/已被照明)
const engaged=!!(this.target&&nowT-this.lastSeenT<3.6)||(nowT-this.lastFiredT<2.2);
const stealth=!!(this.crouch||this.prone||this.inCover||this.state==='defend');
const suppressed=(this.suppression>0.2);
const injured=(this.bandageT>0);
const inFlare=(typeof nightLitMul==='function'&&nightLitMul(this.pos.x,this.pos.y,this.pos.z)>1.15);
if(engaged||stealth||suppressed||injured||inFlare||!this.isScoutLight){
this.flashlight=false;
}else{
// 允许开灯探路: 仅长途推进/巡逻搜索时
this.flashlight=!!(this.state==='push'||this.state==='hunt'||this.state==='patrol'||this.man==='push');
}
}
// A#10 审计② 两连杆矢状面反解 —— 公式单源已提到 **11-soldiers.legIKPose** (2026-09-26 A2):
// 原来的注释与实现留在那边; 这里只做同名薄转发, 免得玩家第三人称 (20-player) 再抄一份又漂移。
legIK(hp,fy,dz,kneeUp){ return legIKPose(hp,fy,dz,kneeUp); }
updateMesh(dt,speed){
const m=this.mesh;
m.root.position.copy(this.pos);
m.root.rotation.set(0,this.yaw,0);
if(m.flGrp){
const flOn=!!(this.alive && !this.onVehicle && this.flashlight);
m.flGrp.visible = flOn;
if(flOn&&m.flGrp.flCone&&typeof truncateConeMesh==='function'){
const dCamSq=this.pos.distanceToSquared(camera.position);
if(dCamSq<55*55){
// 射线节流 (2026-10-24 性能排查批): 与 08-effects 大灯同款 0.12s —— 旧版每个开灯 Bot 每帧一发
// raycastWorld, 暗光图巡逻班组齐开灯 = 每帧多发全场景 DDA; Bot 0.12s 内的移动/转向引起的光锥
// 截断误差在战术视距不可感知。occD 缓存于 m.flOccD, 未到重测帧沿用上值。
m.flRayT=(m.flRayT||0)-dt;
if(m.flRayT<=0){
m.flRayT=0.12;
const sn=Math.sin(this.yaw), cs=Math.cos(this.yaw);
_pvEye.set(this.pos.x,this.pos.y+1.28,this.pos.z);
_pvD.set(sn,0,cs);
const hit=raycastWorld(_pvEye,_pvD,m.flGrp.baseL||14);
m.flOccD=hit?hit.dist:(m.flGrp.baseL||14);
}
const occD=(m.flOccD!==undefined)?m.flOccD:(m.flGrp.baseL||14);
// fz=0 (灯口即 flGrp 原点) —— 旧版传 baseL*0.5 把锥体整体前漂 baseL/2 (悬空 11m), 与 20-player 同批修
truncateConeMesh(m.flGrp.flCone,m.flGrp.baseL||14,occD,0);
}
}
}
// A#10 审计③: 操作固定炮位/岸防炮时也按"据枪瞄准"姿态持枪 (旧版 engaged 不含 batUse ⇒ 上炮后枪口姿态掉回低持枪)
const engaged=(this.target&&nowT-this.lastSeenT<4.5)||this.mgUse||this.empUse||this.batUse;
const prone=this.prone, crouch=this.crouch&&!prone;
const sprint=speed>4.4&&!engaged&&!prone;
const pelY=prone?0.22:crouch?0.6:0.94;
m.pelvis.position.y=dampF(m.pelvis.position.y,pelY,10,dt);
// 重生登场 (2026-09-20 闪现修复): 重生是设计必需的远处换位 (死点→出生点, 可达 300m+), 尸体早已隐藏,
// 所以不存在"尸体残影"; 但新兵是凭空出现的。这里给 SPAWN_UP_T 秒的登场动作 —— 从低处起身到位 +
// 屈膝起身姿势, 让"这里多了一个人"有一次可见的过渡, 而不是无来由地"闪"出来。
// (只作用于 0.5s 内的观感偏移, 不改任何 AI/位置/命中判定)
if(this.spawnUpT>0){
this.spawnUpT-=dt;
const k1=clamp(1-Math.max(this.spawnUpT,0)/SPAWN_UP_T,0,1);
m.root.position.y-=SPAWN_UP_DIP*(1-k1);
m.pelvis.position.y=Math.min(m.pelvis.position.y,0.22+0.72*k1);
}
const torsoX=prone?1.5:crouch?0.14:(sprint?0.3:0.05);
m.pelvis.rotation.x=dampF(m.pelvis.rotation.x,torsoX,8,dt);
const pp=m.pelvis.rotation.x;
// 侧身站姿(枪手姿态)
const blade=prone?0.08:sprint?0:(engaged?0.5:0.3);
m.pelvis.rotation.y=dampF(m.pelvis.rotation.y,-blade,7,dt);
m.headG.rotation.y=-m.pelvis.rotation.y*0.85;
this.animT+=dt*(3+speed*1.9);
const t=this.animT, S=Math.sin(t);
const sw=prone?clamp(speed/1.2,0,1)*0.35:clamp(speed/4,0,1.3)*0.62;
if(prone){
// 匍匐: 双腿伸直贴地拖在身后, 爬行时交替蹬腿
// A#10 审计②: 改为"脚落在地面上"的反解 (旧版写死 hip=0.04 让腿在趴姿过渡期指向地面 → 脚穿地 0.72m)。
// 高度基准取**当前**骨盆高 (m.pelvis.position.y, 仍在 dampF 过渡中), 不是目标高 —— 否则站→趴的
// 0.5s 里骨盆还在 0.94 而反解按 0.22 排腿, 腿被拉长 → 脚依旧穿地。脚关节目标 ~0.11m, 爬行时前后交替 ±0.16m。
// ★2026-11-13b 批⑤: kneeUp true→false 与 20-player 同批同规 —— pole 翻下 = 膝贴地 + 膝弯转人类屈曲方向
// (旧 pole-up 是反关节超伸: 膝峰拱到髋线上方 0.25~0.37, 小腿向脚尖方向折, 用户实报"膝盖向上弯曲")。
const hpNow=m.pelvis.position.y;
const cr=clamp(speed/1.2,0,1)*0.35;
const LL=this.legIK(hpNow,0.11+Math.max(0,S)*0.13*cr,-0.92+S*0.16*cr,false);
const RR=this.legIK(hpNow,0.11+Math.max(0,-S)*0.13*cr,-0.92-S*0.16*cr,false);
m.legL.hip.rotation.x=dampF(m.legL.hip.rotation.x,LL.hip-pp,10,dt);
m.legR.hip.rotation.x=dampF(m.legR.hip.rotation.x,RR.hip-pp,10,dt);
m.legL.knee.rotation.x=dampF(m.legL.knee.rotation.x,LL.knee,10,dt);
m.legR.knee.rotation.x=dampF(m.legR.knee.rotation.x,RR.knee,10,dt);
} else {
// A#10 审计② 的第三段 (2026-09-26 A3 补): 原「站姿」分支是**直接写死目标角、且不过阻尼** ——
// 站↔蹲/趴切换的那一帧关节整段跳过去 (实测 hip 单帧 85°、knee 113°), 且站姿角度隐含"骨盆在 0.94",
// 骨盆还在低位时照站立角度排腿 ⇒ 鞋底入地最深 0.37m、持续约 0.2s。
// 这里与蹲/趴**同一口径**: 用*当前*骨盆高反解 (脚落在地面), 再与站立摆步角按骨盆高度插值。
//   站直 (hp=0.94) ⇒ 插值权 0 ⇒ 逐位等于原站立值 (已验收站姿零漂移);
//   蹲到位 (hp=0.60) ⇒ 权 1 ⇒ 逐位等于原蹲姿反解 (与旧分支同目标, 零漂移);
//   中间 (起身/下蹲的 0.3s) ⇒ 腿随骨盆屈伸, 不再"悬空半步/入地半步"。
// 于是蹲姿分支被本条完全吸收 —— 同一帧只有一个写者。
const hpNow=m.pelvis.position.y;
const kw=clamp((0.94-hpNow)/(0.94-0.60),0,1);
const wL=clamp(speed/4,0,1.3)*0.62;                                    // = sw (站/蹲同式)
const cL=this.legIK(hpNow,0.13+Math.max(0,S)*0.12*wL,0.16+S*0.20*wL,false);
const cR=this.legIK(hpNow,0.13+Math.max(0,-S)*0.12*wL,0.16-S*0.20*wL,false);
const jHipL=S*sw-torsoX*0.6, jHipR=-S*sw-torsoX*0.6;
const jKneeL=Math.max(0,-S)*sw*1.5+0.06, jKneeR=Math.max(0,S)*sw*1.5+0.06;
m.legL.hip.rotation.x=dampF(m.legL.hip.rotation.x,lerp(jHipL,cL.hip-pp,kw),10,dt);
m.legR.hip.rotation.x=dampF(m.legR.hip.rotation.x,lerp(jHipR,cR.hip-pp,kw),10,dt);
m.legL.knee.rotation.x=dampF(m.legL.knee.rotation.x,lerp(jKneeL,cL.knee,kw),10,dt);
m.legR.knee.rotation.x=dampF(m.legR.knee.rotation.x,lerp(jKneeR,cR.knee,kw),10,dt);
}
const rl=this.reloadT>0;
// 持枪姿态: shX=肩前后摆, shY=肩水平转, shZ=肩外展(横向), el=肘弯
let shR,elR,shL,elL,shRy=0,shLy=0,shRz=0,shLz=0;
if(prone){
// 匍匐: 双肘撑地, 小臂抬起托枪在面前, 手不插入地面, 爬行时交替前伸
shR=-1.42+S*sw*0.32; elR=-1.15; shRz=-0.2;
shL=-1.3-S*sw*0.32; elL=-1.25; shLz=0.42;
if(rl){ shL=-1.1+Math.sin(nowT*7)*0.1; elL=-1.0; }
}
else if(engaged){
// 据枪瞄准: 右手扳机位, 左手横伸托护木
const ap=clamp(this.pitch,-0.7,0.7);
shR=-0.55-ap*0.85; elR=-1.6; shRz=-0.28;
shL=-1.35-ap*0.85; elL=-0.14; shLz=0.55;
} else if(sprint){
// 疾跑: 枪侧向横端在胸前, 双手保持握枪, 随步幅轻微起伏
shR=-0.62+S*0.07; elR=-1.05; shRy=0.3; shRz=-0.12;
shL=-0.78-S*0.07; elL=-1.05; shLy=0.55; shLz=0.35;
// A#10 审计⑥: 疾跑分支也要有换弹动作 —— 旧版补丁行是 `if(rl&&!sprint&&!prone)`, 疾跑时换弹
// 左臂增量恒为 0 (实测 dSH=0.036/dEL=0.00 rad, 与站立 0.34/1.17 对比 = 完全无动作)。
// 疾跑换弹: 左手脱离横向持枪位下探到弹匣并抖动, 右臂把枪压在胸前稳住。
if(rl){ shL=-0.86+Math.sin(nowT*7)*0.13; elL=-1.72; shLz=0.22; shR=-0.66+S*0.07; elR=-1.18; }
} else {
// 低持枪警戒: 枪口斜向下, 双手仍在枪上
shR=-0.42; elR=-1.3; shRz=-0.24;
shL=-1.08; elL=-0.28; shLz=0.5;
}
if(rl&&!sprint&&!prone){ shL=-0.8+Math.sin(nowT*7)*0.13; elL=-1.45; shLz=0.18; }
// 侧身补偿: 躯干扭转后手臂仍指向枪身
shRy+=-m.pelvis.rotation.y*0.85;
shLy+=-m.pelvis.rotation.y*0.85;
// (2026-09-26 B3: 原地的 "开火后坐 swing" 自加项已挪到 IK 混合**之后** —— 放这里会被 handK=1 的 lerp 抹掉)
// ── 契约 J §12.4 (2026-09-21): 双手持枪态 = 两连杆手臂反解把手**放到枪上** ──────────────────
// 顺序 (Lead 冻结 §12.4.3): 先算 gunG 目标角 → 用该角取 grip/fore 点 → armIK → 与基准姿态 lerp → dampF 写回。
// 语义: armIK 写的是**躯干局部绝对角**(rotation.y 恒 0, 不乘 setUpperMirror), 镜像只作用于姿态机基准值
// (所以下面先把基准值的 y/z 乘 MIR, 再与不乘 MIR 的 IK 值混合, 最后直接写回)。
// handK: 持枪 1 / 刺刀 0.35 / 投弹·包扎 0。**左臂在换弹时单独取 0** —— 换弹的语义就是左手离枪去弹匣
// (审计⑥ 刚修好"疾跑/匍匐换弹可见", 若左手也被钉回护木, 换弹动作会重新消失); 右臂仍为 1 (枪始终在右手)。
const gunY_t=-m.pelvis.rotation.y+(sprint?0.95:0);
const gunZ_t=sprint?0.16:0;
// A#10 审计①: 枪身挂在骨盆之下, 骨盆前倾 pp 会把枪口一起带偏 —— 旧版只补偿 pitch, 于是"据枪瞄准"时
// 枪口仰角恒为 pitch - torsoX (实测 站 -0.05 / 蹲 -0.14 / 趴 -0.10 rad ≈ 2.9°/8.0°/5.7°)。减 pp 后仰角 = pitch。
const gunPitch=(engaged||this.mgUse||this.empUse||this.batUse)?-clamp(this.pitch,-0.7,0.7):(sprint?0.3:0.25);
const gunX_t=gunPitch-pp;
const handK=(this.state==='melee')?0.35:((this.state==='nade'||this.state==='atnade'||this.nadeAnimT>0||this.bandageT>0)?0:1);
const handKL=rl?0:handK;
// ↑ **不许按 §12.4 字面删掉 `rl`** (Lead 2026-09-21 追认): 换弹的语义就是"左手离枪去弹匣"——审计⑥ 刚修好
// "疾跑/匍匐换弹可见", 若左手也被 IK 钉回护木, 换弹会重新变成看不见的动作。契约 J 的"手在枪上"针对的是
// **持枪态**, 不是换弹态。右臂仍为 1 (枪始终在右手)。
// 契约 J §12.1: 上半身镜像符号 —— 只作用于基准值 (右=-X 已在 11-soldiers 落地)
const MIR=(typeof setUpperMirror==='function')?setUpperMirror():((typeof UPPER_MIRROR!=='undefined')?UPPER_MIRROR:-1);
shRy*=MIR; shLy*=MIR; shRz*=MIR; shLz*=MIR;
let ikRes=null;
if((handK>0||handKL>0)&&typeof armIK==='function'&&typeof gunGripPoint==='function'){
// ★ 2026-09-26 A1: 三个锚点都传 pp —— 挂点 (含枪模位置) 随躯干俯角给, 趴姿另取一组 (11-soldiers.gunMountOf);
// 锚点不传 pp 就会与枪模实际位置差半米 (趴姿), 手会抓空。
const gp=gunGripPoint(this.gunKind,gunX_t,gunY_t,gunZ_t,pp);
const L1=(typeof ARM_L1==='number')?ARM_L1:0.32, L2=(typeof ARM_L2==='number')?ARM_L2:0.30;
const reach=L1+L2-0.02;
const shLp=_ikShL;   // 左肩在躯干局部系 (ARM_SIDE.L=+1) (2026-11-11 性能批: 模块槽, 见文件头)
let fp=(typeof gunForePoint==='function')?gunForePoint(this.gunKind,gunX_t,gunY_t,gunZ_t,pp):gp;
// infantry 实测提醒: 冻结挂点下左肩到护木 ≈0.85m > 臂长 0.62m ⇒ 左手沿**枪身轴**回退到可达的 t
// (gunAxisPoint), 手仍在枪上而不是空气里。回退 4 步即可 (t: 1 → 0.25)。
if(typeof gunAxisPoint==='function'){
let t=1;
for(let i=0;i<4;i++){
fp=gunAxisPoint(this.gunKind,t,gunX_t,gunY_t,gunZ_t,pp);
if(Math.hypot(fp.x-shLp.x,fp.y-shLp.y,fp.z-shLp.z)<=reach) break;
t=Math.max(0,t-0.25);
}
}
// armIK 直接写 group.rotation —— 先把 IK 结果读回来, 再与基准值混合, 最后由 dampF 统一写回
const resR=armIK(m.armR.sh,m.armR.elm,gp);
const ikR=_ikR; ikR.x=m.armR.sh.rotation.x; ikR.y=m.armR.sh.rotation.y; ikR.z=m.armR.sh.rotation.z; ikR.el=m.armR.elm.rotation.x;
const resL=armIK(m.armL.sh,m.armL.elm,fp);
const ikL=_ikL; ikL.x=m.armL.sh.rotation.x; ikL.y=m.armL.sh.rotation.y; ikL.z=m.armL.sh.rotation.z; ikL.el=m.armL.elm.rotation.x;
if(handK>0){ shR=lerp(shR,ikR.x,handK); shRy=lerp(shRy,ikR.y,handK); shRz=lerp(shRz,ikR.z,handK); elR=lerp(elR,ikR.el,handK); }
if(handKL>0){ shL=lerp(shL,ikL.x,handKL); shLy=lerp(shLy,ikL.y,handKL); shLz=lerp(shLz,ikL.z,handKL); elL=lerp(elL,ikL.el,handKL); }
// 残差留档 (探针/交付证据用: 超臂长时 armIK 钳到可达球面并如实返回)
// null 守卫 (verifier 2026-09-21 报的防御性缺陷): armIK 在缺参数/桩缺 rotation 时返回 null,
// 直接 .toFixed 会 TypeError。当前调用点参数恒有效 ⇒ 生产路径不可达, 但守卫成本为零, 与玩家路径
// (20-player 两处都有守卫) 保持同一防御口径。
ikRes=(resR===null||resL===null)?null:{r:Math.round(resR*10000)/10000,l:Math.round(resL*10000)/10000};   // 每帧每 Bot: 不走 toFixed 串分配 (2026-11-01 性能批), 数值逐位等价
}
this.ikRes=ikRes;
// ★ 2026-09-26 B3: 开火后坐的肩部摆动必须叠在 IK 混合**之后** —— 原来在 IK 之前, handK=1 的
// lerp 会把它整段抹平 (开火时只有枪口上跳可见, 身体没有任何后坐动作)。数值沿用原式不变。
if(m.armR.sh.userData.swing>0){
m.armR.sh.userData.swing-=dt;
shR+=Math.sin(m.armR.sh.userData.swing*16)*0.6;
}
m.armR.sh.rotation.x=dampF(m.armR.sh.rotation.x,shR,11,dt);
m.armR.elm.rotation.x=dampF(m.armR.elm.rotation.x,elR,11,dt);
m.armL.sh.rotation.x=dampF(m.armL.sh.rotation.x,shL,11,dt);
m.armL.elm.rotation.x=dampF(m.armL.elm.rotation.x,elL,11,dt);
m.armL.sh.rotation.y=dampF(m.armL.sh.rotation.y,shLy,8,dt);
m.armR.sh.rotation.y=dampF(m.armR.sh.rotation.y,shRy,8,dt);
m.armL.sh.rotation.z=dampF(m.armL.sh.rotation.z,shLz,9,dt);
m.armR.sh.rotation.z=dampF(m.armR.sh.rotation.z,shRz,9,dt);
m.gunG.rotation.y=dampF(m.gunG.rotation.y,gunY_t,9,dt);
m.gunG.rotation.z=dampF(m.gunG.rotation.z,gunZ_t,8,dt);
m.gunG.rotation.x=gunX_t;
// ★ 2026-09-26 A1: **枪模挂点也要按帧写** (旧版只在挂枪时写一次 = 站姿值, 趴姿下枪整段扎进地面)。
// 目标 = gunMountOf(kind,pp), 与玩家路径 (20-player 的 gb) 同源同式; 阻尼率也与玩家同档 (10)。
if(typeof gunMountOf==='function'){
const mo=gunMountOf(this.gunKind,pp);
m.gunG.position.x=dampF(m.gunG.position.x,mo.x,10,dt);
m.gunG.position.y=dampF(m.gunG.position.y,mo.y,10,dt);
m.gunG.position.z=dampF(m.gunG.position.z,mo.z,10,dt);
}
this.gun.rotation.y=Math.PI;
const headTgt=(engaged?-clamp(this.pitch,-0.6,0.6)*0.7:0)+(prone?-0.08-pp:-torsoX*0.5);
m.headG.rotation.x=dampF(m.headG.rotation.x,headTgt,9,dt);
if(this.flinchT>0){ this.flinchT-=dt; m.torsoG.rotation.z=Math.sin(this.flinchT*40)*0.07; }
else m.torsoG.rotation.z*=Math.pow(0.001,dt);
m.tag.visible=this.team===player.team&&this.pos.distanceTo(camera.position)<60;
}
}
// ─────────────────────────────────────────────
// BotDebug —— 实验模式 AI 调试层 (KeyP 切换, 仅供实机调参, 可整体移除)
// 头顶标签: 状态/机动/探头/性格/血量; 地面线: 当前寻路路径
// ─────────────────────────────────────────────
const DBG_STATE={idle:'待机',advance:'推进',defend:'防守',combat:'交战',hunt:'搜索',cover:'掩体',melee:'近战',nade:'手雷',atnade:'炸药',toVehicle:'上车'};
const BotDebug={
on:false,
toggle(){
this.on=!this.on;
for(const b of soldiers){
if(this.on) this.ensure(b);
if(b.dbgTag) b.dbgTag.visible=false;
if(b.dbgLine) b.dbgLine.visible=false;
}
showScorePop('AI调试: '+(this.on?'开 (P 关闭)':'关'));
},
ensure(b){
if(b.dbgTag) return;
const c=document.createElement('canvas'); c.width=256; c.height=48;
b.dbgCanvas=c;
b.dbgTag=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthTest:false}));
b.dbgTag.scale.set(2.4,0.45,1); b.dbgTag.position.y=2.5; b.dbgTag.renderOrder=6; b.dbgTag.visible=false;
b.mesh.root.add(b.dbgTag);
const g=new THREE.BufferGeometry();
g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(34*3),3));
b.dbgLine=new THREE.Line(g,new THREE.LineBasicMaterial({color:b.team===0?0x66aaff:0xff5544,transparent:true,opacity:0.85,depthTest:false}));
b.dbgLine.renderOrder=6; b.dbgLine.frustumCulled=false; b.dbgLine.visible=false;
scene.add(b.dbgLine);
b.dbgUpdT=0;
},
update(dt){
if(!this.on) return;
let i=0;
for(const b of soldiers){
if(!b.dbgTag) this.ensure(b);
if(!b.alive){ if(b.dbgTag) b.dbgTag.visible=false; if(b.dbgLine) b.dbgLine.visible=false; continue; }
const near=b.pos.distanceTo(camera.position)<75;
b.dbgTag.visible=near;
b.dbgUpdT-=dt;
if(near&&b.dbgUpdT<=0){
b.dbgUpdT=0.25+(i%5)*0.03;
this.drawTag(b);
this.drawPath(b);
}
i++;
}
},
drawTag(b){
const g=b.dbgCanvas.getContext('2d'); g.clearRect(0,0,256,48);
g.font='bold 22px sans-serif'; g.textAlign='center';
const st=DBG_STATE[b.state]||b.state;
const mn=b.state==='combat'?(b.man==='push'?'·跃进':b.man==='slide'?'·侧移':'·驻停'):'';
const pk=b.state==='cover'?(b.peekPhase==='out'?'·探头':'·隐蔽'):'';
const txt=st+mn+pk+' 凶'+b.aggro.toFixed(1)+' 血'+Math.round(b.hp);
g.strokeStyle='rgba(0,0,0,.9)'; g.lineWidth=5; g.strokeText(txt,128,31);
g.fillStyle=b.team===player.team?'#9fe8ff':'#ffb0a0'; g.fillText(txt,128,31);
b.dbgTag.material.map.needsUpdate=true;
},
drawPath(b){
const pos=b.dbgLine.geometry.attributes.position;
let n=0;
if(b.pos.distanceTo(camera.position)<90&&b.path&&b.pathI<b.path.length){
pos.setXYZ(n++,b.pos.x,b.pos.y+0.15,b.pos.z);
for(let k=b.pathI;k<b.path.length&&n<34;k++){
const wp=b.path[k];
pos.setXYZ(n++,wp[0],heightAt(wp[0],wp[1])+0.25,wp[1]);
}
}
if(n>1){ pos.needsUpdate=true; b.dbgLine.geometry.setDrawRange(0,n); b.dbgLine.visible=true; }
else b.dbgLine.visible=false;
},
};

// ===== 部署上车: 闲置坦克扫描 (2026-09-06 用户指定全局机制) =====
// Bot 部署/重生时若同队存在闲置坦克 → 直接部署为车组 (spawnInVehicle)。
// 闲置判定与 06/14 的既有"就近认领"同口径: 活着/同队/无乘员/非玩家驾驶/
// 不在禁入冷却(noEnterT)/血量≥40%/无他人 8s 内的有效认领(claimBot)。
// 最近优先、不限距离 —— 与玩家部署界面"选载具出生"同语义; 厂房产能重生车由此快速获得车组。
// ★ 2026-09-19 修正 (用户: 坦克乘员长期站桩像卡住): 补"这辆车真的会开走"一条 ——
//   15-vehicles.driveAI 在距目标 <20m 或与敌坦克对炮时会把车停下驻守, 乘员随车定格,
//   可能整局不动。故以下情况不上车: ①车已在目标 25m 内 (到场即停) ②车已静止且不在推进
//   (vel 阈值), 让 bot 走路去前线 —— 需要车组的是"开赴前线的车", 不是停着的炮台。
//   (原有就近重生的意图不变: 厂区新车/刚重生的车 vel 与目标距离都不满足上述条件, 照常上车。)
function tankRollingToObjective(v){
if(!v.objective) return false;
const d=Math.hypot(v.objective.x-v.pos.x,v.objective.z-v.pos.z);
if(d<25) return false;                    // 到场驻守: 不再接收车组
if(Math.abs(v.vel||0)<0.7&&d<60) return false; // 已停车且离目标不远: 判定为驻守炮台
return true;
}
// ★2026-09-26E (审计 1): 海战载具的闲置扫描 —— 与坦克同一条部署补人路径 (旧版只扫 tanks ⇒
//   舰艇**一条补人路径都没有**: 开局配的那名车组被玩家接管/落水后, 该艇永久是空壳)。
//   与坦克的差别只有一条: 不做 tankRollingToObjective 的"驻守中不配人"判定 —— 15d/14-bots 的艇 AI
//   硬纪律是"永远在动"(除搁浅/沉没), 不存在"停着当炮台"的情形。判据其余逐条对齐坦克。
// (2026-11-10: 纯海图认领距离门 NAVAL_CLAIM_R 与"摆渡中艇不认领"随纯海战图下架摘除;
//   岛图认领远艇是既有行为 (塔拉瓦红线7 依赖))
function pickIdleNaval(bot){
if(typeof navalCraft==='undefined'||!Array.isArray(navalCraft)) return null;
let best=null,bd=1e9;
for(const v of navalCraft){
if(!v||!v.alive||v.team!==bot.team||v.crewBot||v.driverBot||v.playerDriven) continue;
if(v.state==='sinking'||v.state==='wreck') continue;
if((v.noEnterT||0)>nowT) continue;
if(v.hp<(v.maxHp||v.hp||1)*0.4) continue;
const d=Math.hypot(v.pos.x-bot.pos.x,v.pos.z-bot.pos.z);
if(d<bd){ bd=d; best=v; }
}
return best;
}
// 契约 §4 v3: 车位占用判据 = crewBot / playerDriven (三人车组的后 2 人在 Tank.crewSlots 里, 不占士兵池)。
function pickIdleDeployVehicle(bot){
let best=null,bd=1e9;
for(const v of tanks){
if(!v.alive||v.team!==bot.team||v.crewBot||v.playerDriven) continue;
if((v.noEnterT||0)>nowT) continue;
if(v.hp<v.maxHp*0.4) continue;
if(v.claimBot&&v.claimBot.alive&&v.claimBot!==bot&&v.claimBot.targetVeh===v&&nowT-(v.claimT||0)<8) continue;
if(!tankRollingToObjective(v)) continue; // 驻守中的车不进车组 (2026-09-19)
const d=Math.hypot(v.pos.x-bot.pos.x,v.pos.z-bot.pos.z);
if(d<bd){ bd=d; best=v; }
}
return best;
}
// ═══ A#9 岸防炮 (契约 §6, bots 侧) ═══════════════════════════════════════════════
// 与 ATGUNS 同规则: 靠近 → 前摇 → 认领 (g.crewBot) → 瞄船 → 开炮 → 目标丢失释放。
//   占用双轨: g.user (玩家, 由 15f batteryMountPlayer 写) / g.crewBot (Bot, 本文件写) —— 两人不得同炮。
//   **无人时绝不开炮**: 本文件不声明也不调用任何"兜底开火" (帧钩里对 batteryAI 的调用已删);
//   唯一开火入口是 15f 的 batteryFire(g,dir,owner), 且只在 g.crewBot===this 的操作态里被调用。
//   数值单源: 射程/弹速/冷却全在 15f (BATTERY_RANGE / SHELL_SPD_NAVAL / batteryFire 内的 cd);
//   本段只提供"兴趣半径/赶路超时/被挡重试"三个 AI 节奏量 (后两个与 atGun Bot 档同值)。
const BAT_APPROACH_R=110;   // 兴趣半径: 岬角炮位离战线几十~上百米, 陆战固定的 18m 兴趣半径对它毫无意义
const BAT_GO_TIMEOUT=45;    // 赶路超时: 110m @ ~4.2m/s ≈ 26s, 留一倍余量
const BAT_BLOCKED=3.5;      // 炮口被自家胸墙/地形挡住的重试间隔 (与 updateEmplacement 的 atGun 同档)
// 炮位有没有可打的敌艇 (没有就不去守着一门空炮; 与 15f pickTarget 同一组条件: 敌队/未沉/射程内/LOS 通)
function batteryTargetFor(g){
if(!g||g.alive===false||typeof navalCraft==='undefined'||!navalCraft||!navalCraft.length) return null;
// 0.3s 结果缓存 (2026-11-01 性能批): 旧版每帧对每艘敌艇发一发 420m 全程 DDA+地面行军射线 (近水平
// 射线可吃 200+ heightAt), 是海战图最重的 Bot 射线源。缓存期内只做轻量复核 (存活/沉没态/队属),
// 无 LOS 重扫; 沉没/死亡立即作废。0.3s 的目标新鲜度与 NAV_AI.tgtT=0.4 同档 (艇速慢, 火控节奏秒级)。
const nowT_=nowT;
if(g._bttT!==undefined&&nowT_-g._bttT<0.3){
const c=g._bttC;
if(!c) return null;
if(c.alive!==false&&c.state!=='sinking'&&c.state!=='wreck'&&c.team!==g.team) return c;
}
const range=(typeof BATTERY_RANGE==='number')?BATTERY_RANGE:420;
// 眼高单源: 15f 的 mountY (炮耳) 是**唯一**的瞄准/炮口高度来源 (Battery.y 字段根本不存在 —— 旧写法
// 落到 heightAt() 上, 会把整个 LOS 判定压到混凝土平台面, 见 updateBatteryGun 的实测说明)。
const ey=(g.mountY!==undefined)?g.mountY:(((g.y!==undefined)?g.y:heightAt(g.x,g.z))+1.6);
let best=null,bd=range;
for(const c of navalCraft){
if(!c||c.alive===false||c.team===g.team) continue;
if(c.state==='sinking'||c.state==='wreck') continue;   // 已在沉没链上的不再浪费弹药
const d=Math.hypot(c.pos.x-g.x,c.pos.z-g.z);
if(d<1||d>=bd) continue;
const wy=(typeof waterYAt==='function')?waterYAt(c.pos.x,c.pos.z):-1e8;
const ay=(wy>-1e8)?wy+1.05:(c.pos.y||0)+0.6;           // 瞄水线以上 (水面高走 waterYAt 单源)
const dh=Math.hypot(c.pos.x-g.x,ay-ey,c.pos.z-g.z)||1;
const dir=V3((c.pos.x-g.x)/dh,(ay-ey)/dh,(c.pos.z-g.z)/dh);
const hit=raycastWorld(V3(g.x,ey,g.z),dir,dh);
if(hit&&hit.dist<dh-2.5) continue;                      // LOS 不通 (自家胸墙/地形挡住)
bd=d; best=c;
}
g._bttT=nowT_; g._bttC=best;
return best;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 海战 Bot AI 三层 (2026-09-20N 海战批 · task-4) —— boatAI / amphAI / batteryAI
// 规格: 海战系统设计定稿-20260920.md §5.1/§5.2/§5.3/§5.4 + §11.3/§11.5 冻结契约。
//
// 【与 15d/15f 的边界 (naval-hull / coastal-battery 接口约定)】
//   · 载具一侧**只读**: 本段从不写 craft.pos/yaw/vel/hp/flood/state/spec/team ——
//     驾驶只走 `craft.drive(fwd,turn,dt)`, 瞄准只走 `craft.turretAimAt(x,z)`,
//     开火只走 `fireMain(customDir?)/fireSecondary(dir)/fireMG(dir)/fireTorpedo(side,aimDir?)`。
//   · AI 自己的状态 (相位/冷却/选湾/航点) 存在本文件的 WeakMap 里, **不往载具对象上挂字段**
//     (Object.create 影分身承接复用函数 scratch, 见 navAmphShim)。
//   · 驱动权归 15d: NavalCraft.update 自己调用 boatAI/amphAI (与 Tank.update→driveAI 同构)。
//     本文件末尾的 navalAIFrameTick 是**兜底**: 艇/两栖车只在 typeof updateNaval!=='function' (15d 不在链上) 时被驱动;
//     反舰炮位则恒调用 (炮位不动, 无"双驱动"风险) —— 15f 若已调用, 同帧去重会挡掉。
//   · 三个入口都带 `aiDrive===false` 硬退出; 幂等两道: ① Lead 硬裁定的**帧戳** (craft.__aiBoatTick / craft.__aiAmphTick,
//     艇/车各自独立字段) ② 通用同帧去重 navAIOnce (WeakMap by nowT, 炮位用)。重复调用一律空转, 不会双倍速度。
//   · navalCraft/navalNear/BATTERIES/batteryNear/torpedoes/shells 一律 typeof 守卫 ——
//     15d/15f 未落盘时本文件照常加载, 只加载子集的沙箱探针也不报错 (与 tankRollingToObjective 同一纪律)。
//
// 【数值单源】艇炮射程 = SHELL_SPD_NAVAL(190 m/s) × 炮弹存活 3.4s ≈ 646m (2026-09-21B 提速批: 原 115×3s≈345m,
//   射程包线按"速度×life"守恒 —— 见 15d fireMain 的 life 注释); 反舰炮位射程 = 420m (§4.1);
//   炮位弹药节奏 = 13-combat.emplATFire 的 5.2+rand(0,1.4) 与"被挡重试 3.5"(14-bots updateEmplacement 同档);
//   陆战相位的开火门槛/散布/火力距离 = tankAITune() (15-vehicles 三档难度表, 与坦克炮长同档)。
// ═══════════════════════════════════════════════════════════════════════════════
const NAV_AI={
approachR:30,              // 进近点到达半径 (m)
fireR:340,                 // 艇炮对岸/对艇有效射程 (m)
standoff:45,               // ★ 已退役 (2026-09-21): 它是"离岸 45m 向海外转"的**逐帧迟滞**门限, 9m 宽的迟滞带
                           // 容不下 ~74m 的掉头弧 ⇒ 每次外转都冲上礁盘 = 原地极限环。岸轰站位改由
                           // engOut(70m 最小离岸) + engStance(fire/move 阵位机)表达; 保留此键只为老探针读数对照。
depthMargin:0.1,          // ★2026-09-26E (审计 19): 最小可航水深 = 吃水 + NAVAL_CFG.shallowPad + 本余量。
                           // 旧版写死 `+0.55` = shallowPad(0.45) + 0.10 —— 值相同但没人知道那 0.1 是什么; 现在显式。
reefIn:36,                 // 礁盘平台内边界 (m): 艇误入 (<36m 离岸) 一律先向海外脱离 —— 冲滩是两栖车的事 (§1.1 剖面分工)
offshoreMax:260,           // 远海余量 (m): 离岸超过它就先收回通航环带 (走 navRing 中段), 不在图缘外打转
keepSpd:0.55,              // 交战/巡逻的最小速度比 (现行实现: 各相位一律 fwd=1; 保留作老探针对照)
huntR:340,                 // 追击对方小艇的发现半径 (m)
evadeR:45,                 // 弹着规避触发半径 (m)
evadeAmp0:0.55,            // 蛇形基准振幅 (rad)
evadeAmpK:0.95,            // 振幅随受威胁度上升的斜率 (§5.1: "ampl 随受威胁度上升")
evadeFreq:0.8,             // ★ 规格相位: sin(nowT*0.8)*ampl (§5.1 原文)
// ── 船只让路预折 (2026-10-02 实机第四轮"友舰之间撞船穿模十分严重"的撞船半边) ──
// 探测/让路/减速参数单源; 唯一接线点 = navSteer (advance/hunt/engage/evade/reefOut 全相位共用)。
// 分工: 物理不穿模由 15d navalPushCraft 的当帧全量解算负责, 这里管的是"别老往对方船上开"。
avoidLook:2.6,             // 前向探测距离 = (双方半长和)×本系数 + 12m
avoidPad:5,                // "正瞄着它"的舷向余量 (m): |横向偏移| < 双方半宽和 + 本值
avoidTurn:1.0,             // 让路舵偏 (rad): 朝目标所在舷的**反侧**让 (对称 ⟹ 双方一左一右, 对开自动错船)
avoidSlow:22,              // 距它船体小于本值 (m, 已含半长和) ⇒ 油门打 0.45 折 (地板 0.2, 保"艇永远在动")
torpMin:120, torpMax:600,  // ★ 鱼雷窗口距离带 (§5.1)
torpAspectMin:30*Math.PI/180, torpAspectMax:90*Math.PI/180, // ★ 目标舷角带 [30°,90°]
torpEps:1e-6,              // 舷角/距离边界容差: atan2 的浮点误差不能让"正好 30.000°/600m"被误拒 (边界必须确定)
torpSolveMax:1.65,         // 提前量解所需转舵上限 (rad ≈ 94.6°): 舷角带本身到 90°, 再留一点提前量余量;
                           // 超过即"解不出来" (目标跑得方向太背), 不空放
beachIn:10,                // 冲滩点: 自岸线向陆内推 (m)
wing:30,                   // 滩头两翼偏移 = sea.lanes ± 30m (§5.2)
ringDep:3.4,               // 巡逻环带最小水深 (m) —— sea.navRing d=43 起即 3.4m (00-config 剖面)
ringStep:0.22,             // 巡逻方位角步进 (rad)
batR:420,                  // 反舰炮位射程 (与 15f 同档, §4.1)
batCd:[3.6,0.8],           // 炮上冷却 (与 emplATFire 同档数值源, 不另写一套)
batBlocked:3.5,            // 被挡重试 (与 updateEmplacement 同档数值源)
tgtT:0.4,                  // 岸上目标缓存周期 (s)
// ══════════════════════════════════════════════════════════════════════════════
// 跨图会师 / 反极限环 / 炮塔换装 (2026-09-21 海战 AI 全盘优化批 · 用户裁定"两者兼顾")
//
// 用户原话: "现在总是在出生点打转, 一局双方的船基本遇不到" + "敌艇可见就追击, 否则轮换压制与巡逻会师"。
// 三个已量化的机制缺陷 (探针 dev/out/navalai-selfcheck-full.txt) 与这里的对策一一对应:
//   ① 双方集结点相距 507.7m(直线) / 550m(实际重生位), huntR=fireR=340 ⇒ 出生点互相看不见, 而艇**没有任何
//      跨图目标** (navMuster 只参与择湾评分) ⇒ 默认行为改成"沿 sea.navRing 深水环带向敌方海域推进"。
//   ② engage 优先级高于推进且在出生点即可满足 (南侧反舰炮台 246~289m) ⇒ 4200 帧里 engage 4199 帧。
//      对策: engage 改成**限时轮换** (一轮 ≤ engBout, 两轮冷却 engCd) —— 压制与推进/会师交替, 不再独占。
//   ③ standoff 45/54m 迟滞环只有 9m, 而掉头 (π 弧) 要 ~74m ⇒ 每次"外转再压上"都冲上礁盘, 再被 reefIn=36
//      推回 = 极限环。对策: 阵位带抬到 70m+ (离岸), 且用**阵位机动 (压制—脱离—换阵位)** 取代逐帧迟滞比较。
// ══════════════════════════════════════════════════════════════════════════════
ringMid:6.4,               // 推进航路最小水深 (m): 剖面 43m→3.4m / 80m→6.9m ⇒ 6.4m ≈ 离岸 75m ——
                           // 走通航环带**中段**, 不在礁缘 (离岸 43m) 上蹭; 掉头直径 47m 也不会蹭到礁盘
ringAng:0.55,              // 环带方位步进上限 (rad ≈ 31.5°): 与 14.5m/s ÷ 0.62rad/s 的掉头弧 (~74m) 匹配,
                           // 一步的弦切内缩 R(1-cos(θ/2)) ≈ 8.6m < (75-43)m 余量
advCommit:1.2,             // ★ 已退役 (2026-09-21 首轮): 原打算用"离敌方海域还远才允许改签方向"的迟滞,
                           // 但它仍以**艇当前位置**判向 —— 出生点恰在 ±π 分界上, 被岸炮推歪 0.023rad 就翻向。
                           // 现改为 navAdvanceDir(): 一律按**集结点常量**判向 (两队互为相反数 ⇒ 空间同向绕岛)。
wpReach:46,                // 航点到达半径 (m)
huntClose:120,             // 贴脸追击半径 (m): 小于它不看通视 (已经在眼前); 其余距离必须通视才算"看见"
engBout:10,                // 一轮岸轰压制的最长时长 (s): 到点必退 ⇒ 压制占比 ≈ engBout/(engBout+E[engCd]) ≈ 34%
engCd:[14,24],             // 两轮压制之间的冷却 (s): 冷却期内只推进/会师 —— "轮换"的机制保证, 不靠碰巧
engHold:6.0,               // 同一阵位最长停留 (s): 到点就"脱离"换阵位 (压制—脱离—换阵位 的脱离触发器)
engMove:9.0,               // 换阵位航段最长时长 (s): 到点或超时转"压制" (兜底, 不许卡在赶路里)
engPosR:34,                // 阵位到达半径 (m)
engOut:70,                 // 岸轰阵位的**最小离岸** (m): 与 ringMid 同量级 —— 阵位在礁盘外, 不在 45m 迟滞环上翻
engRange:[150,300],        // 阵位-目标距离带 (m): 近于此弹道过平不易命中, 远于此超出 battery 射程 420m 的对射节奏
engOff:[0.40,0.70],        // 换阵位的方位偏移带 (rad, 左右交替): 每轮沿弧错开 ≥23°, 保证有真实航程
aimLead:0.22,              // 炮塔指向门控的"对齐时间"上限 (s): err/tRate ≤ 它才开火 (tRate 只从 spec 读)
laneSameAng:0.5,           // 择湾"同侧"容差 (rad): 湾方位与艇方位之差在此之内视为同一侧
laneCrossW:180,            // 跨岛惩罚当量 (m/rad): 差 π 时折算 ≈475m ⇒ 对岸的湾事实上选不上 (必须绕一整圈)
looppWin:20,               // 反极限环看门狗窗口 (s)
looppNeed:38,              // 窗口内净位移下限 (m): 低于它判定"原地打转"
looppBreak:12,             // 判定原地打转后的强制推进时长 (s): 期间禁止进入 engage
};
// AI 私有状态 (WeakMap: 不写载具对象)
const _navState=new WeakMap(), _navShim=new WeakMap();
let _navFrameT=-1, _navHookLast=0, _navHookDt=1/60, _navHookWarned=false;
// AI 私有状态: 相位/冷却/选湾/航点/影分身 scratch 全在这里 (载具对象一行不写)
function navAIS(o){
let s=_navState.get(o);
if(!s){
s={mode:'approach',lane:null,laneT:0,wp:null,ang:rand(0,TAU),wing:Math.random()<0.5?1:-1,
fireT:rand(0,0.5),mgT:0,torpT:0,evadeT:0,prev:'patrol',breakT:0,runT:0,engOut:false,
awayYaw:0,awayYawT:-9,tgt:null,tgtT:0,approach:null,beach:null,route:null,routeI:0,
groundT:0,land:false,aimT:0,
// ── 跨图会师 / 反极限环 / 岸轰阵位 (2026-09-21 批; 全部是 AI 私有状态, 不写载具对象) ──
trk:[],trkT:0,loopT:-9,loopN:0,          // 看门狗: 位置采样 / 采样倒计时 / 改道截止时刻 / 触发次数
engT:0,engCd:-9,engN:0,engPos:null,engSide:1,engHold:0,engStance:'fire',
advS:0,advYaw:null};                     // 推进步进方向 / 任务航向 (规避相位把闪避限制在它的 ±90° 内)
_navState.set(o,s);
}
return s;
}
// 帧钩 (Bot.update 首行调用): 兜底驱动艇/两栖车 —— 15d 在链上时整段是空转 (驱动权归 15d)。
// ★ 反舰炮位不在这里驱动 (2026-09-21A 裁定): 岸炮 AI 整支移交 15f (A#9「无人不开炮」+ batteryMountPlayer),
//   本文件不再声明 batteryAI, 也不再调用它 —— 避免"两个同名全局函数、页面里跑 15f 的、沙箱里测本文件的"。
function navalAIFrameTick(){
if(_navFrameT===nowT) return;
_navFrameT=nowT;
const d=nowT-_navHookLast; _navHookLast=nowT;
_navHookDt=clamp(d>1e-4?d:1/60,0.001,0.05);      // 与 24-main 的 dt=min(delta,0.05) 同档
try{
if(typeof updateNaval!=='function'&&typeof navalCraft!=='undefined'&&navalCraft&&navalCraft.length){
for(const c of navalCraft){
if(!c) continue;
navAdoptDriver(c);
const b=c.driverBot;
if(!b||!b.alive||c.playerDriven||c.aiDrive===false) continue;
if(c.kind==='boat') boatAI(c,_navHookDt); else amphAI(c,_navHookDt);
}
}
}catch(e){
// 兜底钩异常不拖垮士兵更新: 只报一次, 之后静默 (探针/实机都能一眼看到)
if(!_navHookWarned){ _navHookWarned=true; console.warn('[海战AI] 帧钩异常 (只报一次): '+(e&&e.stack||e)); }
}
}
// 车组接线兼容: 23-deploy 用 spawnInVehicle(craft) 塞人 (craft.crewBot=bot) / 或直接写 driverBot;
// 两种写法都认 —— 缺 driverBot 就补上; driverBot 指向已阵亡的车组时改用 crewBot (载具被打捞/重新配组后仍能被驱动)。
function navAdoptDriver(c){
let b=c.driverBot;
if(!b||b.alive===false){ const cb=c.crewBot; if(cb&&cb.alive!==false) b=cb; }
if(!b) return;
if(c.driverBot!==b) c.driverBot=b;
if(!c.crewBot&&b.onVehicle===c) c.crewBot=b;
}
// ── 单源只读接口包装 (岸线/水深一律走 03-terrain 的 waterDepthAt/shoreDist/shoreDirAt, 严禁另写算术) ──
function navSeaCfg(){ return (typeof SEA!=='undefined'&&SEA)?SEA:null; }
function navLanes(){ const S=navSeaCfg(); return (S&&S.lanes)||[]; }
function navMuster(t){ const S=navSeaCfg(); return (S&&S.muster&&S.muster[t])||null; }
// ── 跨图会师的目标方位 (★ 不写死坐标): 敌方集结点相对**图心**的方位角 ──
// 为什么是"方位角"而不是"点": 艇要绕岛, 直指敌方集结点会被岛体挡住; 会师要的是"沿环带往敌方海域推"。
// 单源: sea.muster (00-config 的海上集结点, 四湾四岬之外唯一的双方锚点), 与 15d 重生位同源。
// ★ 两侧同向绕环的证明 (会师能成立的几何): 两队各取 angDiff(自己方位, 敌方方位) 的符号定步进方向,
//   而 angDiff(a,b) = -angDiff(b,a) (反对称) ⇒ 双方在环上的**旋转方向一致**, 于是各走半圈后在图上
//   最远点相遇; 若改成"各自走最近的一侧", 两者会走互补的两段弧、恰好永远不碰面。这条由 dev 自检 ⑨ 断言。
function navEnemyBearing(team){
const em=navMuster(1-team);
if(!em) return null;
return Math.atan2(em.x,em.z);
}
// 工事归属单源 (根因⑤: 无 team 字段的压表不能当靶子):
//   ① 自带 team (05c 的 MG42S 重机枪位) ② owner.team (06-engineering 的迫击炮位: 谁架的归谁)
//   ③ 正被某人操作 (user.team) —— 有人在上面的工事, 归属是确定的。
//   三条都判不出来 ⇒ null ⇒ 调用方**一律跳过**: 宁可不打, 也不能把双方都能用的中立工事
//   (17-emplacements 的 ATGUNS/AAGUNS 压表不带 team) 当自家人的靶子 —— 这正是用户报的"打自己人"。
//   注: 若日后 17-emplacements 给压表补上 team, 本函数与调用点**零改动**即可恢复对岸工事压制。
function navFortTeam(o){
if(!o) return null;
if(o.team===0||o.team===1) return o.team;
if(o.owner&&(o.owner.team===0||o.owner.team===1)) return o.owner.team;
if(o.user&&(o.user.team===0||o.user.team===1)) return o.user.team;
return null;
}
function navDepth(x,z){ return (typeof waterDepthAt==='function')?waterDepthAt(x,z):-1e9; }
function navShoreD(x,z){ return (typeof shoreDist==='function')?shoreDist(x,z):1e9; }
function navDist(a,b){ return Math.hypot(a.pos.x-b.pos.x,a.pos.z-b.pos.z); }
// 半径内最近的敌方水面载具 (15d 的 navalNear 单源: 只返回 alive 且未沉的; 缺模块时返回 null)
function navEnemyCraftNear(c,r){
if(typeof navalNear!=='function') return null;
const t=navalNear(c.pos.x,c.pos.z,r,1-c.team);
return (t&&t!==c&&t.alive!==false)?t:null;
}
// 视线预检 (与 Bot/坦克同一支 raycastWorld; 命中点近于目标才算通视 —— 与 perceive/tankPerceive 同口径)
function navLOS(ox,oy,oz,tx,ty,tz,d){
if(typeof raycastWorld!=='function') return true;
const hx=tx-ox, hy=ty-oy, hz=tz-oz;
const l=Math.hypot(hx,hy,hz)||1;
const hit=raycastWorld(V3(ox,oy,oz),V3(hx/l,hy/l,hz/l),Math.min(l,d));
return !hit||hit.dist>l-2.5;
}
// 岸防强度 (择湾评分用): 该湾口近岸的敌方步兵密度 + 岸防火力点 + 反舰炮位 —— 值越大越硬, 越不该往那登陆
function navShoreDef(x,z,team){
let s=0;
for(const b of soldiers){
if(!b.alive||b.team===team||b.onVehicle) continue;
const d=Math.hypot(b.pos.x-x,b.pos.z-z);
if(d<70) s+=1-d/70;
}
if(typeof ATGUNS!=='undefined') for(const g of ATGUNS){ if(!g||g.dead) continue; const d=Math.hypot(g.x-x,g.z-z); if(d<90) s+=1.6*(1-d/90); }
// 反舰炮位只算**敌方**的 (自家的炮位不该把本方海湾算成"岸防很硬" —— 与 navScanShore 的队别过滤同一条纪律)
if(typeof BATTERIES!=='undefined') for(const g of BATTERIES){ if(!g||g.alive===false) continue; if(g.team!==undefined&&g.team===team) continue; const d=Math.hypot(g.x-x,g.z-z); if(d<130) s+=2.2*(1-d/130); }
return s;
}
// 择湾 (§5.1): 四湾 sea.lanes 按"距**本艇当前位置**最近 + 岸防强度最低"评分; 结果缓存 8s (不必每帧重扫 60 人表)
// ★ 2026-09-21 修 (根因③): 旧评分用"距**本方集结点**最近" —— 艇被岸炮推过岬角之后, 重选出来的还是老家湾,
//   于是朝"跨岛的进近点"开 (实测某艇 approach=4003/4200 帧原地打转)。改为按艇自身位置评分。
// ★ 同时加"跨岛惩罚": 只用"as-the-crow-flies 距离"会选到岛对面的湾 (直线穿过陆地), 那是必绕一整圈的假近路;
//   惩罚量 = 湾方位与艇方位之差 × laneCrossW (米当量), 超过 ~0.5rad 起算 —— 岛是居中的, 方位差就是"在岛的哪一侧"。
function navPickLane(c,ai){
if(ai.lane&&nowT<ai.laneT) return ai.lane;
const lanes=navLanes();
if(!lanes.length) return null;
const aMe=Math.atan2(c.pos.x,c.pos.z);
let best=null,bs=-1e9;
for(const L of lanes){
const dCraft=Math.hypot(L.x-c.pos.x,L.z-c.pos.z);
const aLane=Math.atan2(L.x,L.z);
const dAng=Math.abs(angDiff(aMe,aLane));
const sc=-(dCraft+Math.max(0,dAng-0.5)*NAV_AI.laneCrossW)-navShoreDef(L.x,L.z,c.team)*14+rand(0,26);
if(sc>bs){ bs=sc; best=L; }
}
ai.lane=best; ai.laneT=nowT+8;
return best;
}
// 离岸外推: 自航道浮标沿"岸法线向海"外推 out 米 = 礁盘外的进近点。
// shoreDirAt 给出的是"水最浅的方向"(向岸), 取反即向海; 退化 (无岸/无水体) 时用图心径向兜底。
function navOffshorePt(x,z,out){
const sd=(typeof shoreDirAt==='function')?shoreDirAt(x,z):null;
let nx,nz;
if(sd&&(sd[0]||sd[1])){ nx=-sd[0]; nz=-sd[1]; }
else{ const l=Math.hypot(x,z)||1; nx=x/l; nz=z/l; }
return {x:x+nx*out,z:z+nz*out};
}
// 冲滩点 (§5.2): 滩头两翼 = 航道浮标沿岸线切向 ±wing(30m) → 沿岸法线向陆推进到入陆 beachIn 米 → findClearSpot 落位
function navBeachPt(c,L){
if(!L) return null;
const sd=(typeof shoreDirAt==='function')?shoreDirAt(L.x,L.z):null;
let ix,iz;
if(sd&&(sd[0]||sd[1])){ ix=sd[0]; iz=sd[1]; }                 // 向岸 (水最浅方向)
else{ const l=Math.hypot(L.x,L.z)||1; ix=-L.x/l; iz=-L.z/l; }
const tx=-iz, tz=ix;                                          // 沿岸切向
const side=(((c.ord|0)%2)===0)?1:-1;
// ★2026-11-01 冲滩走廊验证 (红线7 "顶在离岸 9.5m 永动"的第二层病根): 滩头堡类工事的地基平台
//   (padHeight 台坎, 实测 -0.33 海床 → +2.45 平面一级跳) 顶在浪线时, 直线冲滩会被履带态的
//   slopeGateMove 拒爬台坎而顶死 —— 旧选点只做 findClearSpot 占用清障, 不验"海→点"的坡度走廊。
//   修法: 先试本侧原点; 走廊有 >1.2m 台阶跳变就沿海岸切向逐档平移 (两侧都扫), 找一条干净走廊;
//   全挡时保底返回本侧原点 (不比旧版差)。
const march=(bx,bz)=>{
for(let k=0;k<26&&navShoreD(bx,bz)>=-NAV_AI.beachIn;k++){ bx+=ix*4; bz+=iz*4; }
if(typeof findClearSpot==='function'){ const sp=findClearSpot(bx,bz,6,2.0); if(sp){ bx=sp[0]; bz=sp[1]; } }
return {x:bx,z:bz};
};
const corridorOK=(p)=>{
if(typeof heightAt!=='function') return true;
// 走廊=滩头点的**正交登陆线** (离岸 10m → 点): 路线末段会插"点正前方 12m 海上过渡点"
// (见 navAmphRoute), 最后一跳就是沿这条线冲滩 —— 台坎 (堡基 padHeight 平台) 挡道的点直接淘汰。
let prev=null;
for(let s=0;s<=6;s++){
const gx=p.x-ix*10+ix*(10*s/6), gz=p.z-iz*10+iz*(10*s/6);
const gh=heightAt(gx,gz);
if(prev!==null&&Math.abs(gh-prev)>1.2) return false;
prev=gh;
}
return true;
};
const b0x=L.x+tx*NAV_AI.wing*side, b0z=L.z+tz*NAV_AI.wing*side;
let fb=null;
for(const off of [0,6,-6,12,-12,18,-18,24,-24,30,-30]){
const p=march(b0x+tx*off,b0z+tz*off);
if(corridorOK(p)) return p;
if(!fb) fb=p;
}
return fb;
}
// 环岛巡逻点 (§5.1 "沿 sea.navRing d=43..200 环岛机动"): 从图心沿方位角向外找第一个够深的点;
// 纯粹用 waterDepthAt 现算, 不重写剖面算术 (单源纪律)。
// ★ 2026-09-21 修 (根因④: 岬角方向返回浅水礁盘点):
//   旧实现半径上限 MAP_SIZE/2-10=310, 而四岬岸线在 268~289m、岬角外的深水要 R≈311~332 —— 探针实测
//   方位 45/50/310/315° 在 R≤330 内**根本没有 ≥3.4m 的水**, 旧代码 return last = 浅水礁盘点 (实测 1.2m),
//   于是艇被自己的导航送到礁盘上, 再被 reefIn=36 推回 = 极限环的外半圈。三处修:
//   ① 半径上限放宽到 MAP_SIZE/2+2 (与 15d `_integrate` 的 pos 钳位 MAP_SIZE/2+6 同量级);
//   ② 全径都不够深时, 沿**方位角**左右搜索 (±0.06~±0.55 rad): 岬角射线永远扫不到深水, 但邻侧海域扫得到
//      (探针实测最大只需滑 0.30 rad 即可绕开岬角射线), 效果是"绕岬角走更宽的外弧";
//   ③ 仍无解 ⇒ 返回扫描过的**最深**点 (best-effort), 不再盲目返回最后一个候选。
//   want (可选): 目标水深 —— 默认 ringDep(3.4m, 环带内缘); 推进航路传 ringMid(6.4m) 走环带中段。
function navRingPt(ang,want){
const dep=(typeof want==='number')?want:NAV_AI.ringDep;
const lim=((typeof MAP_SIZE==='number')?MAP_SIZE/2:320)+2;
let best=null,bd=-1e9;
const scan=a=>{
for(let R=120;R<=lim;R+=8){
const x=Math.sin(a)*R, z=Math.cos(a)*R;
const d=navDepth(x,z);
if(d>bd){ bd=d; best={x,z}; }
if(d>=dep) return {x,z};
}
return null;
};
let p=scan(ang);
if(p) return p;                                       // 命中 (绝大多数方位)
for(const da of [0.06,-0.06,0.12,-0.12,0.2,-0.2,0.3,-0.3,0.42,-0.42,0.55,-0.55]){
p=scan(ang+da);
if(p) return p;                                       // 岬角射线: 滑到邻侧海域
}
return best||{x:Math.sin(ang)*200,z:Math.cos(ang)*200};   // 兜底: 全局最深点 (≥ 旧版"最后一个候选")
}
// 向海航向: shoreDirAt 给的是"水最浅的方向"(向岸), 取反即向海; 退化时用图心径向朝外。
// 这是艇"脱离礁盘/重新拉开距离"的统一航向 —— 比沿切线跑安全 (切线在凹湾/岬角会不知不觉压进浅水)。
function navSeawardYaw(c){
const sd=(typeof shoreDirAt==='function')?shoreDirAt(c.pos.x,c.pos.z):null;
if(sd&&(sd[0]||sd[1])) return Math.atan2(-sd[0],-sd[1]);
const l=Math.hypot(c.pos.x,c.pos.z)||1;
return Math.atan2(c.pos.x/l,c.pos.z/l);
}
// 礁盘外进近点 (§1.1 剖面分工: 艇停在礁盘外): 自航道浮标沿向海法线外推, 直到水深 ≥ ringDep(3.4m) ——
// 即礁缘 d=43m 之外; 再留 10m 余量。全凭 waterDepthAt 现算, 不写一条剖面算术。
function navReefOutPt(L){
if(!L) return null;
const sd=(typeof shoreDirAt==='function')?shoreDirAt(L.x,L.z):null;
let nx,nz;
if(sd&&(sd[0]||sd[1])){ nx=-sd[0]; nz=-sd[1]; }
else{ const l=Math.hypot(L.x,L.z)||1; nx=L.x/l; nz=L.z/l; }
let x=L.x, z=L.z;
for(let k=0;k<24;k++){
if(navDepth(x,z)>=NAV_AI.ringDep) break;
x+=nx*6; z+=nz*6;
}
return {x:x+nx*10,z:z+nz*10};
}
// 前方水深探测 (舷向安全): 候选航向 25/50m 两点的最浅水深; 指着陆上 6m 以里直接判"不可走"。
// 只读 waterDepthAt/shoreDist —— 与 15d 的搁浅判定同一支数据, 所以"AI 绕开的正是物理会搁浅的地方"。
function navAheadDepth(c,yaw){
const sx=Math.sin(yaw), sz=Math.cos(yaw);
let m=1e9;
for(const r of [25,50]){
const x=c.pos.x+sx*r, z=c.pos.z+sz*r;
if(navShoreD(x,z)<-6) return -1;
const d=navDepth(x,z);
if(d<m) m=d;
}
return m;
}
// 安全航向: 在 prefer ± [0,±0.4,±0.8,±1.2,±1.9,±2.6] 里挑第一个前方够深的方向; 全不行就用 prefer (交给物理兜底)
function navSafeYaw(c,prefer,minDep){
for(const da of [0,0.4,-0.4,0.8,-0.8,1.2,-1.2,1.9,-1.9,2.6,-2.6]){
if(navAheadDepth(c,prefer+da)>minDep) return prefer+da;
}
return prefer;
}
// 前方最威胁的一条船 (2026-10-02): 小艇都算 (2026-11-10: 大舰扫描随大舰子系统下架摘除), **不分敌我** —— 让路是航行纪律, 撞谁都算事故。
// 判据: 在本艇朝向前方 avoidLook 带内, 且舷向偏移落在"我正瞄着它"的走廊里; 取纵向距离最近的一条。
// 坐标系与本文件既有口径一致: forward=(sin,cos), 舷向右正 = dx·cos−dz·sin。
function navVesselAhead(c){
const sn=Math.sin(c.yaw), cs=Math.cos(c.yaw);
const cl=((c.spec&&c.spec.hullL)||20)*0.5, cw=((c.spec&&c.spec.hullW)||5)*0.5;
let best=null;
const scan=(ox,oz,ol,ow)=>{
const dx=ox-c.pos.x, dz=oz-c.pos.z;
const fz=dx*sn+dz*cs;
if(fz<=0||(cl+ol)*NAV_AI.avoidLook+12<fz) return;      // 正后/侧后不构成前向威胁
const lx=dx*cs-dz*sn;
if(Math.abs(lx)>ow+cw+NAV_AI.avoidPad) return;         // 不在碰撞走廊里
if(!best||fz<best.fz) best={fz,lx,ol};
};
if(typeof navalCraft!=='undefined') for(const o of navalCraft){
if(!o||o===c||!o.alive||o.state==='wreck'||o.state==='sinking') continue;
scan(o.pos.x,o.pos.z,((o.spec&&o.spec.hullL)||20)*0.5,((o.spec&&o.spec.hullW)||5)*0.5);
}
return best;
}
// 驾驶包装: 只走 15d 的 drive(fwd,turn,dt) —— 绝不直接写 pos/yaw/vel (会绕过搁浅与浮态)。
// ★ 舵向符号 (2026-09-20 红线 7 根因, naval-hull 独立诊断 + 本文件对齐复算确认):
//   15d-naval.js:284 是 `yaw -= inTurn*turn*dt*(fwd<0?-1:1)` —— **turn=+1 是右转 (yaw 减小)**。
//   旧实现喂 `+angDiff(yaw,want)`, 想要"增大 yaw"却给了正 turn ⇒ 舵反打, 越修越偏: 艇一路顶到硬搁浅线、
//   两栖车朝外海开 (mode 永远停在 approach)。符号换算**只在本包装层做一次**, 全段其余地方一律只用 yaw。
// ★2026-10-02 让路预折在本层做 (唯一接线点): 只折 fwd>0 的前进舵 —— 倒车脱困/撤退不归它管;
//   目标在右舷就往左让 (lx≥0 ⇒ yaw−1.0), 镜像对称 ⇒ 两艇对开时自动一左一右错开;
//   减速有 0.2 地板, 纪律①"艇永远在动" (防触发车组"驻守下船") 不被破坏。
function navSteer(c,yaw,fwd,dt){
if(typeof c.drive!=='function') return;
if(fwd>0){
const ob=navVesselAhead(c);
if(ob){
yaw+=(ob.lx>=0?-1:1)*NAV_AI.avoidTurn;
if(ob.fz-((c.spec&&c.spec.hullL)||20)*0.5-ob.ol<NAV_AI.avoidSlow) fwd=Math.max(0.2,fwd*0.45);
}
}
c.drive(clamp(fwd,-1,1),clamp(-angDiff(c.yaw,yaw)*1.6,-1,1),dt);
}
function navSteerTo(c,p,fwd,dt){ navSteer(c,Math.atan2(p.x-c.pos.x,p.z-c.pos.z),fwd,dt); }
// 搁浅脱困 (§3.3 "艇只能倒车脱困"): state==='ground' 时只做倒车 + 左右摆舵找深水, 其余决策挂起;
// 倒车推力倍率(0.6×)由 15d 的 drive 内部承担, 这里不碰位置。
function navUnground(c,ai,dt){
ai.groundT=(ai.groundT||0)+dt;
if(typeof c.drive==='function') c.drive(-1,Math.sin(ai.groundT*1.7)*0.8,dt);
}
// ── 弹着规避传感器 (§5.1) ─────────────────────────────────────────────────────
// 威胁度 = 在途炮弹/鱼雷的"水平最近接近距离"折算到 [0,1]; 0=无威胁, 1=正落在头上。
// 用最近接近而不是"落点"是因为 AI 只能看到弹道线: 水平线性外推与炮击落点判定同档精度,
// 且对平射/吊射都成立 (吊射的水平速度仍是朝我来的那一份)。
function navShellThreat(c){
let th=0;
if(typeof shells!=='undefined'&&shells.length){
for(const s of shells){
if(!s||!s.pos||!s.vel||s.team===c.team) continue;
const dx=c.pos.x-s.pos.x, dz=c.pos.z-s.pos.z;
if(Math.abs(dx)>240||Math.abs(dz)>240) continue;
const vh2=s.vel.x*s.vel.x+s.vel.z*s.vel.z;
if(vh2<1) continue;
const tca=(dx*s.vel.x+dz*s.vel.z)/vh2;                 // 最近接近时刻 (s)
if(tca<0||tca>7) continue;
const dc=Math.hypot(s.pos.x+s.vel.x*tca-c.pos.x,s.pos.z+s.vel.z*tca-c.pos.z);
if(dc>NAV_AI.evadeR) continue;
const k=1-dc/NAV_AI.evadeR;
if(k>th) th=k;
}
}
// 15d 的在途鱼雷表 (torpedoes, typeof 守卫): 对艇武器更该躲 —— 命中即灌满 flood (§2.1)
if(typeof torpedoes!=='undefined'&&torpedoes.length){
for(const t of torpedoes){
if(!t||!t.pos||t.team===c.team) continue;
const vx=(t.vel&&typeof t.vel.x==='number')?t.vel.x:((t.dir&&t.dir.x)||0);
const vz=(t.vel&&typeof t.vel.z==='number')?t.vel.z:((t.dir&&t.dir.z)||0);
const sp=Math.hypot(vx,vz);
if(sp<1) continue;
const dx=c.pos.x-t.pos.x, dz=c.pos.z-t.pos.z;
if(Math.hypot(dx,dz)>150) continue;
const tca=(dx*vx+dz*vz)/(sp*sp);
if(tca<0||tca>8) continue;
const dc=Math.hypot(t.pos.x+vx*tca-c.pos.x,t.pos.z+vz*tca-c.pos.z);
if(dc>NAV_AI.evadeR) continue;
const k=1-dc/NAV_AI.evadeR;
if(k>th) th=k;
}
}
return th;
}
// 规避基准航向: 垂直于最近来袭弹道 (横向脱离瞄准线), 两侧取"前方水深更大"的一侧; 无来袭弹时背离最近岸。
function navEvadeYaw(c){
let bvx=0,bvz=0,best=1e9;
if(typeof shells!=='undefined'&&shells.length){
for(const s of shells){
if(!s||!s.pos||!s.vel||s.team===c.team) continue;
const d=Math.hypot(s.pos.x-c.pos.x,s.pos.z-c.pos.z);
if(d<best&&d<260){ best=d; bvx=s.vel.x; bvz=s.vel.z; }
}
}
if(Math.hypot(bvx,bvz)>1){
const a=Math.atan2(bvx,bvz), o1=a+HPI, o2=a-HPI;
return navAheadDepth(c,o1)>navAheadDepth(c,o2)?o1:o2;
}
const sd=(typeof shoreDirAt==='function')?shoreDirAt(c.pos.x,c.pos.z):null;
if(sd) return Math.atan2(-sd[0],-sd[1]);
return c.yaw+Math.PI;
}
// ── 瞄准/开火工具 (固定炮位与载具共用) ────────────────────────────────────────
function navVecErr(a,b){
const dot=clamp((a.x*b.x+a.y*b.y+a.z*b.z),-1,1);
return Math.acos(dot);
}
// 当前炮口/炮座指向: ① 15d 的 turretAimDir()/aimDir() 单源; ② 固定炮位与 ATGUNS 同构 ——
// yaw 是 Group (相对 face 的偏转), pitch 是 Group (rotation.x 存负俯角); 两者都缺则视为已对准。
function navAimDirOf(o){
try{
if(o&&typeof o.turretAimDir==='function'){ const d=o.turretAimDir(); if(d&&isFinite(d.x)) return d; }
if(o&&typeof o.aimDir==='function'){ const d=o.aimDir(); if(d&&isFinite(d.x)) return d; }
}catch(e){}
let yaw=null;
if(o&&o.yaw&&o.yaw.rotation) yaw=(o.face||0)+o.yaw.rotation.y;
else if(o&&typeof o.yaw==='number') yaw=o.yaw;
if(yaw===null) return null;
let pit=0;
if(o.pitch&&o.pitch.rotation) pit=-o.pitch.rotation.x;
else if(typeof o.pitch==='number') pit=o.pitch;
return V3(Math.sin(yaw)*Math.cos(pit),Math.sin(pit),Math.cos(yaw)*Math.cos(pit));
}
function navAimErr(o,dir){
const a=navAimDirOf(o);
if(!a) return 0;                                  // 缺接口 → 不因判定卡死开火
return navVecErr(a,dir);
}
// 瞄准驱动 (固定炮位): 与 ATGUNS 的写法同构 (g.yaw.rotation.y=相对 face 的偏转, g.pitch.rotation.x=-俯角)
function navSetAim(o,wantYaw,wantPit,dt,rate){
if(o.yaw&&o.yaw.rotation) o.yaw.rotation.y=angleLerpTo(o.yaw.rotation.y,angDiff(o.face||0,wantYaw),rate*dt);
else if(typeof o.yaw==='number') o.yaw=angleLerpTo(o.yaw,wantYaw,rate*dt);
if(o.pitch&&o.pitch.rotation) o.pitch.rotation.x=dampF(o.pitch.rotation.x,-wantPit,rate*0.8,dt);
else if(typeof o.pitch==='number') o.pitch=dampF(o.pitch,wantPit,rate*0.8,dt);
}
// 炮口原点单源 (需求⑥: "炮口朝向取 muzzles.main, 走 getWorldPosition"):
//   优先 15d 的 navalMuzzleWorld(c,'main') —— 它自己就是"muzzles.main 锚点 (getWorldPosition) 优先,
//   解析锚点兜底"; 15d 未落盘 (沙箱替身) 时退回艇体中心 +1.8m (旧口径, 与替身的 muzzle() 同量级)。
// 为什么必须从炮口起算: 真炮塔换装后炮口随炮塔转 (muzzles.main 是 pitchG 的子件), 从艇体中心起算会
//   在目标偏离艏向时给出系统性偏角 (24.4m 长的 PT 上, 艏炮与塔炮的炮口相差 ~6m)。
function navGunOrigin(c){
try{
if(typeof navalMuzzleWorld==='function'){
const m=navalMuzzleWorld(c,'main');
if(m&&isFinite(m.x)&&isFinite(m.y)) return m;
}
}catch(e){}
return {x:c.pos.x,y:(c.pos.y||0)+1.8,z:c.pos.z};
}
// 弹道提前量方向: 起点 = **炮口** (navGunOrigin), 目标点 + 弹道下坠补偿 (SHELL_G 与 updateShells 同一支重力常数)
function navLeadDir(c,tx,ty,tz,spd){
const m=navGunOrigin(c);
const mx=m.x, my=m.y, mz=m.z;
let dx=tx-mx, dy=ty-my, dz=tz-mz;
const dh=Math.hypot(dx,dz)||1;
const tof=dh/Math.max(spd,1);
const g=(typeof SHELL_G==='number')?SHELL_G:0.5;
dy+=0.5*g*tof*tof;
const l=Math.hypot(dx,dy,dz)||1;
return V3(dx/l,dy/l,dz/l);
}
// 目标速度向量: 15d 契约 vel=标量 + yaw=航向 (Tank 同义); 兼容 vel 为 {x,z} 向量的实现
function navTgtVel(t){
if(!t) return [0,0];
if(t.vel&&typeof t.vel==='object') return [t.vel.x||0,t.vel.z||0];
const v=Math.abs(typeof t.vel==='number'?t.vel:0);
return [Math.sin(t.yaw||0)*v,Math.cos(t.yaw||0)*v];
}
// 岸上目标扫描 (§5.1 优先级): 反舰炮位 > 滩头工事 > 步兵集群。缓存 0.4s (每帧全扫 60 人表不值得)。
function navScanShore(c){
const team=c.team;
// ① 反舰炮位 (15f): 唯一"专打船"的岸防 —— 不拔掉它, 艇就一直在挨打。
// ★ 2026-09-20 修 (coastal-battery 实报的友军火力): batteryNear 第 4 参是**队别过滤**, 旧代码漏传 ⇒ 日军艇会把
//   自家炮位当优先目标开火。炮位本身只读, 但索敌必须按队过滤 —— 与 navalNear/navalEnemyCraftNear 同一条纪律。
let cand=null;
if(typeof batteryNear==='function'){
const b=batteryNear(c.pos.x,c.pos.z,NAV_AI.fireR,c.team);
if(b&&b.alive!==false&&!(b.team!==undefined&&b.team===team)) cand=b;
}
if(!cand&&typeof BATTERIES!=='undefined'&&BATTERIES.length){
let bd=1e9;
for(const b of BATTERIES){
if(!b||b.alive===false) continue;
if(b.team!==undefined&&b.team===team) continue;                 // 自家炮位不是目标
const d=Math.hypot(b.x-c.pos.x,b.z-c.pos.z);
if(d<=NAV_AI.fireR&&d<bd){ bd=d; cand=b; }
}
}
if(cand){
const d=Math.hypot(cand.x-c.pos.x,cand.z-c.pos.z);
const cy=(cand.y!==undefined?cand.y:heightAt(cand.x,cand.z))+1.2;
if(navLOS(c.pos.x,c.pos.y+2.0,c.pos.z,cand.x,cy,cand.z,d)) return {kind:'battery',x:cand.x,z:cand.z,y:cy,obj:cand};
}
// ② 滩头工事 (17-emplacements 反坦克炮 / 05c 重机枪位 / 06 迫击炮位): 打掉滩头火力是登陆支援的本职
// ★ 2026-09-21 修 (根因⑤: 双方艇都在打自己人的反坦克炮):
//   旧代码把"没有 team 字段"读成"中立工事 ⇒ 可以打" —— 而 17-emplacements:34 压表**就是不带 team**,
//   于是日军艇会去轰自己阵线里的 AT 炮。现在改成**归属必须可判定**: navFortTeam 给出 0/1 才继续,
//   判不出来 (null) 一律跳过 —— 契约原话"无 team 字段的按中立工事处理, 但不能打自己人的; 若无法判定就跳过"。
let best=null,bd=1e9;
const consider=(o,wt)=>{
if(!o||o.dead||o.alive===false) return;
const ft=navFortTeam(o);
if(ft===null) return;                                         // 归属不可判定 ⇒ 不索敌 (宁可不打, 不误伤)
if(ft===team) return;                                         // 自家/本队可用的工事不是目标
const d=Math.hypot(o.x-c.pos.x,o.z-c.pos.z);
if(d>NAV_AI.fireR*0.85) return;
if(navShoreD(o.x,o.z)>-2) return;                       // 只打岸上 (水面目标交给 hunt)
const y=(o.y||heightAt(o.x,o.z))+0.9;
if(!navLOS(c.pos.x,c.pos.y+2.0,c.pos.z,o.x,y,o.z,d)) return;
const sc=d*wt;
if(sc<bd){ bd=sc; best={kind:'fort',x:o.x,z:o.z,y:y,obj:o}; }
};
if(typeof ATGUNS!=='undefined') for(const g of ATGUNS) consider(g,1.0);
if(typeof MG42S!=='undefined') for(const g of MG42S) consider(g,0.85);
if(typeof MORTARS!=='undefined') for(const g of MORTARS) consider(g,1.15);
if(best) return best;
// ③ 步兵集群: 岸上 60m 内 ≥2 名敌方步兵的集群 (单兵不值得艇炮点名)
for(const s of soldiers){
if(!s.alive||s.team===team||s.onVehicle) continue;
const d=Math.hypot(s.pos.x-c.pos.x,s.pos.z-c.pos.z);
if(d>NAV_AI.fireR*0.8) continue;
if(navShoreD(s.pos.x,s.pos.z)>-1) continue;
let n=0;
for(const s2 of soldiers){ if(s2.alive&&s2.team===team&&Math.hypot(s2.pos.x-s.pos.x,s2.pos.z-s.pos.z)<14) n++; }
if(n<2) continue;
const y=heightAt(s.pos.x,s.pos.z)+0.9;
if(!navLOS(c.pos.x,c.pos.y+2.0,c.pos.z,s.pos.x,y,s.pos.z,d)) continue;
if(d<bd){ bd=d; best={kind:'inf',x:s.pos.x,z:s.pos.z,y:y,obj:s}; }
}
return best;
}
// ── 鱼雷窗口判定 (§5.1 冻结口径) ───────────────────────────────────────────────
// 三条同时成立 ⇒ 可发射:
//   ① 目标舷角 ∈ [30°,90°]  (目标在舷侧 30~90°, 正横附近命中率最高; 正前/艉后不在窗口内);
//   ② 距离 ∈ [120,600m]     (近于 120m 来不及转/引信来不及起爆, 远于 600m 提前量误差不可接受);
//   ③ 提前量可解             (以鱼雷航速迭代求截击点: 两次 tof 收敛 / 截击点在 torpRange 内 / 所需转舵 ≤ torpSolveMax)。
// ①② 用 torpEps 容差比较: 舷角与距离都是 atan2/hypot 现算值, 若拿裸浮点比,"正好 30.000°/600m"会随机被误拒。
// 返回 {ok,aspect,dist,tof,aimYaw,side,why}; why 供探针打印"为什么不开火"的过滤表。
function navTorpWindow(c,t){
const sp=(c.spec&&c.spec.torpSpd)||0;
const range=(c.spec&&c.spec.torpRange)||0;
const dx=t.pos.x-c.pos.x, dz=t.pos.z-c.pos.z;
const dist=Math.hypot(dx,dz);
const brg=Math.atan2(dx,dz);
const aspect=Math.abs(angDiff(c.yaw,brg));      // 目标舷角 = 目标方位与艏向的夹角
const res={ok:false,aspect:aspect,dist:dist,tof:0,aimYaw:0,side:0,why:''};
if(sp<=0||range<=0){ res.why='该型无鱼雷'; return res; }
if(aspect<NAV_AI.torpAspectMin-NAV_AI.torpEps){ res.why='舷角过小(目标在艏向正前)'; return res; }
if(aspect>NAV_AI.torpAspectMax+NAV_AI.torpEps){ res.why='舷角过大(目标在艉后)'; return res; }
if(dist<NAV_AI.torpMin-NAV_AI.torpEps){ res.why='距离过近(<120m)'; return res; }
if(dist>NAV_AI.torpMax+NAV_AI.torpEps){ res.why='距离过远(>600m)'; return res; }
const tv=navTgtVel(t);
let tof=dist/sp, ix=t.pos.x, iz=t.pos.z;
for(let k=0;k<4;k++){
ix=t.pos.x+tv[0]*tof; iz=t.pos.z+tv[1]*tof;
const nt=Math.hypot(ix-c.pos.x,iz-c.pos.z)/sp;
const done=Math.abs(nt-tof)<0.35;
tof=nt;
if(done) break;
}
res.tof=tof;
const aimYaw=Math.atan2(ix-c.pos.x,iz-c.pos.z);
res.aimYaw=aimYaw;
res.side=angDiff(c.yaw,brg)>0?1:0;              // 冻结口径 (Lead §11.9④): 0=左舷 / 1=右舷
if(Math.hypot(ix-c.pos.x,iz-c.pos.z)>range*0.95){ res.why='截击点超出鱼雷射程'; return res; }
if(Math.abs(angDiff(c.yaw,aimYaw))>NAV_AI.torpSolveMax){ res.why='提前量解所需转舵过大'; return res; }
res.ok=true; res.why='可发射';
return res;
}
// 艇炮开火 (主炮/机炮对岸对艇双用, §2.1): 炮塔跟瞄 + 距离/瞄准门限 + 难度散布档 (DIFF_TABLE.spreadMul, 同源);
// 弹药/冷却/特效/命中判定全部由 15d 的 fireMain/fireSecondary 管线承担, 本函数只管"该不该打、往哪打"。
// ★ 2026-09-21 炮塔换装 (需求⑥⑦): 旧实现**从不转塔** —— 那是"艇艏固定炮座"年代的写法: 打谁就得把艇艏
//   对准谁, AI 只能朝目标压上, 那一半正是"跑轰振荡"的成因。真炮塔 (15e 新模型 + 15d 360° 连续回转) 之后,
//   转塔与航向解耦: 炮塔自己咬住目标, 艇可以沿岸平行跑。回转速率只从 spec.tRate 读 (不硬编码)。
function navBoatShoot(c,ai,dt,tx,ty,tz,tol){
const spec=c.spec||{}, main=spec.main||null, sec=spec.secondary||null;
ai.fireT-=dt; ai.mgT-=dt;
// ① 转塔 (世界坐标点 → 炮塔局部连续角; 15d 内部按 spec.tRate 限速, 无 ±π 跳变)。
//    turretAimPoint = 三维瞄准 (x,z 回转 + y 俯仰); 老实现只有 turretAimAt(x,z) 时退到只回转。
if(typeof c.turretAimPoint==='function') c.turretAimPoint(tx,ty,tz,dt);
else if(typeof c.turretAimAt==='function') c.turretAimAt(tx,tz,dt);
// ② 炮口起算的提前量方向 (muzzles.main → getWorldPosition)
// 兜底值走 SHELL_SPD_NAVAL 单源 (2026-09-21B: 原字面量 115 会在提速时变成"只改了一半"的隐雷)
const dir=navLeadDir(c,tx,ty,tz,main?(main.spd||SHELL_SPD_NAVAL):SHELL_SPD_NAVAL);
const err=navAimErr(c,dir);
const d=Math.hypot(tx-c.pos.x,tz-c.pos.z);
const dm=DIFF_TABLE[SETTINGS.diff];
const tol2=tol*(dm?dm.spreadMul:1);
// ③ 回转速率门控 (需求⑦): 门限不写死, 由 spec.tRate 折算 —— "误差要在开火前摇内收敛" (对齐时间 = err/tRate)。
//    塔快 ⇒ 同一容差下更早可开火; 塔慢 ⇒ 门控自动收紧, 不会在指向还没到位时空放 (旧代码的 tol 与塔无关)。
const tRate=(typeof spec.tRate==='number'&&spec.tRate>0.3)?spec.tRate:1.9;
const aligned=(err<=tol2)&&(err/tRate<=NAV_AI.aimLead);
if(main&&typeof c.fireMain==='function'&&ai.fireT<=0&&aligned&&d<=NAV_AI.fireR){
c.fireMain(dir);
ai.fireT=Math.max(0.25,main.rof||1)*rand(1,1.3);
return true;
}
if(sec&&typeof c.fireSecondary==='function'&&ai.mgT<=0&&err<=tol2+0.12&&d<=260){
c.fireSecondary(dir);
ai.mgT=Math.max(0.05,sec.rof||0.08)*rand(1,1.4);
return true;
}
return false;
}
// ═══════════ ① boatAI —— 艇智能体 (advance/会师 → hunt → engage → evade) ═══════════
// 相位优先级 (2026-09-21 全盘优化后): wreck/sinking(停) > ground(倒车脱困) > reefOut/inshore(离岸纪律)
//   > evade(弹着规避) > hunt(敌艇可见就追) > engage(岸轰轮换) > advance(跨图会师推进, 默认)。
// 用户裁定原文: "两者兼顾: 敌艇可见就追击, 否则轮换压制与巡逻会师"。三条硬纪律:
//   ① 永远在动 (除搁浅/沉没, 速度恒 1) —— 艇不该停, 也避免触发车组"驻守 26s 下车";
//   ② 一切转向先过 navSafeYaw (吃水+浅水余量): AI 绕开的正是 15d 判定会搁浅的水域;
//   ③ 默认相位必须是**跨图推进**: 旧实现里 approach/patrol 都在出生湾附近打转, engage 又能在出生点满足,
//      于是 4200 帧里 4199 帧在出生湾对着岸炮"跑轰" —— 这就是用户看到的"一局双方的船基本遇不到"。
function boatAI(craft,dt){
if(!craft) return;
// ★ 帧戳幂等 (Lead 2026-09-20 硬裁定 §11.9②): 15d 的 NavalCraft.update 与 14-bots 兜底钩双跑 ⇒ 只有一次真决策。
if(craft.__aiBoatTick===nowT) return;
craft.__aiBoatTick=nowT;
if(craft.alive===false||craft.aiDrive===false) return;
const c=craft, ai=navAIS(c), spec=c.spec||{};
const st=c.state||'run';
if(st==='wreck'||st==='sinking'){ if(typeof c.drive==='function') c.drive(0,0,dt); return; }
if(st==='ground'){ navUnground(c,ai,dt); return; }               // 搁浅 (§3.3): 只倒车脱困, 其余决策挂起
// ★2026-09-26E (审计 19): 浅水带余量改读单源 NAVAL_CFG.shallowPad (旧版写死 0.55, 而 15d/01-audio
// 都读 0.45 ⇒ AI 的"最小可航水深"比物理的擦礁带厚 0.1m, 判据与实况不同源)。
const minDep=(spec.draft0||0.95)+((typeof NAVAL_CFG!=='undefined'&&NAVAL_CFG.shallowPad)||0.45)+NAV_AI.depthMargin;   // 最小可航水深 = 吃水 + 浅水带 + 余量 (逐值等于旧字面量 0.55, 但来历显式)
// ❸ 反极限环看门狗 (先采样后决策): 20s 窗口内净位移 <38m ⇒ 判定"原地打转", 强制改道 12s (期间禁止岸轰)。
navTrackPos(c,ai,dt);
// ⓪ 离岸纪律 (先于一切战术): 艇误入礁盘平台/冲滩带 (离岸 <36m) 一律先向海外脱离, 不在此开火 ——
//    §1.1 的剖面分工是"两栖车冲滩、艇停在礁盘外", AI 不该靠搁浅来实现它 (被打偏/进近过头都会到此)。
//    反方向同理: 离岸 >260m 已被打散到远海 ⇒ 先收回通航环带 (走 ringMid 环带中段), 不在图缘外打转。
const sd0=navShoreD(c.pos.x,c.pos.z);
if(sd0<NAV_AI.reefIn){ ai.mode='reefOut'; navSteer(c,navSafeYaw(c,navSeawardYaw(c),minDep),1,dt); return; }
if(sd0>NAV_AI.offshoreMax){
// 收拢 = 回环带 + **继续会师**: 走推进相位的下一个航点, 而不是"沿自己所在方位原地回环带"。
// 为什么: 被岸炮推远一次之后, 原地收拢要先横向跑回环带再重新赶路 —— 实测这一来一回吃掉 40s+ 的会师时间
// (120s 档里美军艇被推到离岸 271m 再折回, 首次 <340m 从 31s 拖到 106s)。沿任务方位收拢是一箭双雕。
ai.mode='inshore';
ai.wp=null;
navBoatAdvance(c,ai,dt,minDep);
return;
}
// 岸轰轮换计时: 只要本轮还在走表就递减 (含被规避打断的帧) —— "一轮就是一, 轮长上限 engBout" 不因干扰而延长
if(ai.engT>0) ai.engT-=dt;
	// ① 弹着规避: 在途炮弹/鱼雷威胁, 或规避动作未到期 (记住规避前的相位 —— 含 engage, 规避结束要接着打)
		// (2026-11-10: 摆渡冲刺不规避门随纯海战图摆渡相位下架摘除)
	const threat=navShellThreat(c);
	if(threat>0||ai.evadeT>0){
	if(ai.mode!=='evade') ai.prev=ai.mode;
	ai.mode='evade'; navBoatEvade(c,ai,dt,threat,minDep); return;
	}
	if(ai.mode==='evade') ai.mode=ai.prev||'advance';
// ② 追击对方小艇 (用户裁定"敌艇可见就追击"): 可追击 + 发现半径 + 通视 —— 隔着岛不算看见, 否则两条艇会各贴着
//    本侧岸线互相"锁定", 回到老毛病 (绕岛不来)。贴脸 (≤120m) 不看通视; 搁浅弃艇不追 (见 navHuntable)。
const enemy=navEnemyCraftNear(c,NAV_AI.huntR*(NIGHT_MODE?NIGHT_CFG.rangeMul:1)*WX_CFG.rangeMul); // 追击发现半径: 夜档×rangeMul ×天气 (天气设计 §5-8)
if(enemy&&navHuntable(enemy)&&navVisible(c,enemy)){ ai.mode='hunt'; ai.prev='hunt'; navBoatHunt(c,ai,dt,enemy,minDep); return; }
if(ai.mode==='hunt') ai.mode='advance';
// ③ 对岸压制 (轮换制, 目标每 tgtT 重扫一次): 只在"有可判定归属的敌方岸上目标 + 冷却已过 + 不在改道期"时进入;
//    进入后跑一轮"压制—脱离—换阵位" (navBoatEngage), 到时/失目标即退并进冷却 ⇒ 压制与推进**交替**, 不独占帧。
ai.tgtT-=dt;
if(ai.tgtT<=0){ ai.tgtT=NAV_AI.tgtT; ai.tgt=navScanShore(c); }
if(ai.tgt&&ai.tgt.obj&&(ai.tgt.obj.alive===false||ai.tgt.obj.dead)) ai.tgt=null;   // 目标已毁 (炮位 alive=false / 工事 dead)
if(ai.mode==='engage'){
if(!ai.tgt||ai.engT<=0) navEngageExit(ai);                   // 一轮结束 → 进冷却, 落到下面走推进
else { navBoatEngage(c,ai,dt,ai.tgt,minDep); return; }
}
if(ai.tgt&&nowT>=ai.engCd&&nowT>=ai.loopT){
ai.mode='engage'; ai.prev='engage'; ai.engT=NAV_AI.engBout;
ai.engN=(ai.engN||0)+1; ai.engPos=null; ai.engStance='fire'; ai.engHold=0; ai.engMoveT=0;
navBoatEngage(c,ai,dt,ai.tgt,minDep); return;
}
// (2026-11-10: ③b 接舷摆渡相位随纯海战图下架摘除 —— 岛图艇 AI 本无此相位)
// ④ 跨图会师推进 (默认相位)
ai.mode='advance'; ai.prev='advance';
navBoatAdvance(c,ai,dt,minDep);
}
// 岸轰轮次收尾: 统一在这里进冷却 (只此一处 —— 退出原因不同但"轮换"语义相同)
function navEngageExit(ai){
ai.mode='advance'; ai.engT=0; ai.engPos=null; ai.engStance='fire';
ai.engCd=nowT+rand(NAV_AI.engCd[0],NAV_AI.engCd[1]);
}
// (2026-11-10: navFerryTarget 摆渡选靶随纯海战图下架摘除)
// ❸ 反极限环看门狗: 每 2s 采一位, 保留 looppWin 秒; 窗口内**净位移** (不是路程) 低于 looppNeed ⇒ 原地打转。
// 为什么用净位移而不是路程: "跑轰振荡"的艇每帧都在动 (速度不小), 路程很可观, 但它始终没离开那块水域 ——
// 用户看到的就是"在出生点打转"。净位移才是这个现象的判据。
function navTrackPos(c,ai,dt){
ai.trkT=(ai.trkT||0)-dt;
if(ai.trkT>0) return;
ai.trkT=2;
const trk=ai.trk||(ai.trk=[]);
trk.push({t:nowT,x:c.pos.x,z:c.pos.z});
while(trk.length&&nowT-trk[0].t>NAV_AI.looppWin) trk.shift();
if(trk.length<3) return;
let mx=0;
for(const q of trk){ const d=Math.hypot(q.x-c.pos.x,q.z-c.pos.z); if(d>mx) mx=d; }
if(mx<NAV_AI.looppNeed){
ai.loopN=(ai.loopN||0)+1;
ai.loopT=nowT+NAV_AI.looppBreak;          // 改道期: advance 相位照走, 但禁止进入 engage
ai.wp=null; ai.engPos=null; ai.trk=[{t:nowT,x:c.pos.x,z:c.pos.z}];
}
}
// 环带推进方向单源 (★ 这是"会师能成立"的关键一条, 别改成按当前位置判向):
//   两个方位角都取**集结点常量** (sea.muster), 不取艇的当前位置 —— 位置会被岸炮打偏、被规避推歪,
//   而 muster 是常量, 于是两条艇算出的方向永远稳定、且互为相反数 (angDiff 反对称) ⇒ 空间上同向绕岛。
//   实测教训 (2026-09-21 首轮): 用艇当前位置的方位判向时, 美军艇在出生点被岸炮推歪 0.023rad (跨过了
//   ±π 分界), 判出相反方向, 与日军艇走互补的两段弧 ⇒ 永远碰不到面。位置越接近"正南/正北"越危险。
//   返回 0 表示"分不出方向" (两集结点同方位/数据缺失), 由调用方用 wing 兜底。
function navAdvanceDir(team){
const om=navMuster(team), em=navMuster(1-team);
if(!om||!em) return 0;
const d=angDiff(Math.atan2(om.x,om.z),Math.atan2(em.x,em.z));
if(Math.abs(d)<1e-3) return 0;
return d>0?1:-1;
}
// 跨图会师推进 (默认相位): 沿 sea.navRing 的**深水环带中段** (ringMid 6.4m ≈ 离岸 75m) 向敌方海域推进。
// ★ 目标不是坐标而是**方位角**: 由 sea.muster[1-team] 相对图心现算 (navEnemyBearing), 航点由 navRingPt 现算 ——
//   换图/改湾口/改集结点都不用动本函数 (不写死任何坐标, 与 15d 重生位同源)。
// ★ 双方"同向绕环"的证明: 步进方向由 navAdvanceDir 从两个**集结点常量**算出 (见上), 两队互为相反数
//   ⇒ 绕岛的空间方向一致, 各走半圈后在图上最远点相遇 (dev 自检 ⑨ 断言"首次 <340m 的时刻必须存在")。
//   若改成"各自走最近的一侧", 两者会走互补的两段弧、恰好永远不碰面 —— 这正是必须同向的原因。
// ★ 步进上限 ringAng: 一次拐 ≤31.5°, 弦切内缩 ≈8.6m < (75-43)m 的环带余量, 掉头弧 (~74m) 也不会蹭礁盘。
// ★ 转向余量用 cruise (≥ringDep 3.4m): 推进相位不许切进环带内缘 (实测不设时在岬角斜切到离岸 44m/水深 3.48m)。
function navBoatAdvance(c,ai,dt,minDep){
const aTgt=navEnemyBearing(c.team);
if(aTgt===null){                                             // 无 sea.muster (非环礁图/表缺失) 的兜底
if(navLanes().length) navBoatApproach(c,ai,dt,minDep);       // 有航道表: 老进近路径 (与两栖车同一套)
else navBoatPatrol(c,ai,dt,minDep);                          // 什么表都没有: 环带游弋, 至少不冲滩
return;
}
// (2026-11-10: opensea 直奔集结点旁路随纯海战图下架摘除)
const cruise=Math.max(minDep,NAV_AI.ringDep);
const aMe=Math.atan2(c.pos.x,c.pos.z);
if(!ai.wp||Math.hypot(ai.wp.x-c.pos.x,ai.wp.z-c.pos.z)<NAV_AI.wpReach){
let s=navAdvanceDir(c.team);
if(!s) s=(ai.wing>=0?1:-1);
ai.advS=s;
ai.ang=aMe+ai.advS*NAV_AI.ringAng;
ai.wp=navRingPt(ai.ang,NAV_AI.ringMid);
}
// 任务航向 (规避相位用它把"横向闪避"限制在任务 ±90° 内 —— 见 navBoatEvade)
ai.advYaw=Math.atan2(ai.wp.x-c.pos.x,ai.wp.z-c.pos.z);
navSteer(c,navSafeYaw(c,ai.advYaw,cruise),1,dt);
}
// 可见性 (§5.1 "发现半径内 + 通视"): 与 Bot/坦克同一支 raycastWorld; 射线被岛体挡住 ⇒ 不算看见。
// 为什么必须加: huntR=340m 而岛宽 ~500m, 不判通视的话两条艇会隔着岛互相"锁定"并各自贴着本侧岸线,
// 永远碰不到面 (正是用户报的现象)。贴脸 (huntClose) 例外: 已经在眼前了, 不看通视。
function navVisible(c,e){
if(!e) return false;
const d=navDist(c,e);
if(d<=NAV_AI.huntClose) return true;
return navLOS(c.pos.x,(c.pos.y||0)+2.4,c.pos.z,e.pos.x,(e.pos.y||0)+1.2,e.pos.z,d);
}
// 可追击判据 (2026-09-21 新增): 活着 + 未沉 + **不是"搁浅且无人"的弃艇**。
// 为什么把弃艇排除在追击之外 (三条, 都不是为测试而设):
//   ① 军事上: 搁浅且无人的艇动不了、也不开火, 不构成威胁; 主炮该留给真目标 (艇的主炮弹药不是无限的);
//   ② 战术上: 追它必然把我方艇拖进礁盘 (⓪ 离岸纪律的正面冲突 —— 实测追踪路径要压到离岸 17m 的冲滩带);
//   ③ 实测取证 (dev 红线4④): 静止弃艇会把 AI 艇从 340m 外吸到滩头, 1 秒内 12 发打爆它 ——
//      而那条用例是**纯物理**用例 (倒车脱困), 试验艇没有车组、也没有 AI, 本就不该进入任何人的目标表。
//   `manned` 是 15d 的冻结只读字段 (playerDriven||crewBot); 车组一旦回船, 该艇立刻恢复"可追击"。
function navHuntable(e){
if(!e||e.alive===false) return false;
const st=e.state||'run';
if(st==='sinking'||st==='wreck') return false;
if(st==='ground'&&!e.manned&&!e.playerDriven&&!e.crewBot&&!e.driverBot) return false;
return true;
}
// 沿岸切线航向: 垂直目标方位两侧取"前方水深更大"的一侧 (与 navEvadeYaw 同法; 只读 waterDepthAt)
function navTangentYaw(c,bearing,side){
const a=bearing+side*HPI, b=bearing-side*HPI;
return navAheadDepth(c,a)>navAheadDepth(c,b)?a:b;
}
// 换阵位选点 (压制—脱离—换阵位 的"换阵位"): 目标侧后 engOff 方位、距离带内、**离岸 ≥ engOut(70m)** 的深水点。
// 左右交替 (每次调用翻一次 engSide) ⇒ 连续两轮阵位在方位上错开 ≥2*engOff(≈0.8rad), 保证有真实航程。
// 若选点落在礁盘/岸上 (罕见: 岬角内侧), 沿该方位向外推 —— 推到 70m 离岸为止。
function navEngPos(c,ai,tgt){
ai.engSide=-(ai.engSide||1);
const ang=Math.atan2(c.pos.x-tgt.x,c.pos.z-tgt.z)+rand(NAV_AI.engOff[0],NAV_AI.engOff[1])*ai.engSide;
const r=clamp(Math.hypot(c.pos.x-tgt.x,c.pos.z-tgt.z),NAV_AI.engRange[0],NAV_AI.engRange[1]);
let x=tgt.x+Math.sin(ang)*r, z=tgt.z+Math.cos(ang)*r;
for(let k=0;k<40&&navShoreD(x,z)<NAV_AI.engOut;k++){ x+=Math.sin(ang)*8; z+=Math.cos(ang)*8; }
return {x,z};
}
// 进近 (★ 已不是艇的默认路径): 选湾 → 礁盘外进近点, 只作"有航道表但无 sea.muster"的兜底。
// 两种航法: ① 同方位 (与图心方位夹角 ≤0.55 rad): 直插进近点;
//   ② 不同方位 (远湾): 沿 sea.navRing 环岛绕行 —— **航点持久化**, 走到 45m 内才选下一个。
//      为什么必须持久: 每帧贪心重算时, 被岸炮打散一次 (evade 会把艇推向海外) 之后, 方位差变了 ⇒ 目标点跟着漂,
//      艇就沿切线越走越远 (实测远湾用例在 31s~>60s 之间随机, 就是这条抖动)。持久航点让绕行单调推进, 打完散还能回同一个点。
function navBoatApproach(c,ai,dt,minDep){
const L=navPickLane(c,ai);
if(!L){ navSteerTo(c,{x:0,z:0},1,dt); return; }                 // 无航道表 (非环礁图): 至少朝图心方向走
if(!ai.approach||ai.approachL!==L){ ai.approach=navReefOutPt(L); ai.approachL=L; ai.wp=null; }
const ap=ai.approach;
if(!ap){ navSteerTo(c,{x:0,z:0},1,dt); return; }
ai.appT=(ai.appT||0)+dt;
if(ai.appT>150){ ai.mode='patrol'; ai.wp=null; return; }        // 兜底: 2.5 分钟还没到就转巡逻 (不无限赶路)
const d=Math.hypot(ap.x-c.pos.x,ap.z-c.pos.z);
if(d<NAV_AI.approachR){ ai.mode='patrol'; ai.wp=null; ai.ang=Math.atan2(c.pos.x,c.pos.z)+ai.wing*0.4; return; }
if(ai.wp&&Math.hypot(ai.wp.x-c.pos.x,ai.wp.z-c.pos.z)<45) ai.wp=null;
if(!ai.wp){
const aMe=Math.atan2(c.pos.x,c.pos.z), aTgt=Math.atan2(ap.x,ap.z), da=angDiff(aMe,aTgt);
ai.wp=(Math.abs(da)<=0.55)?{x:ap.x,z:ap.z}:navRingPt(aMe+clamp(da,-0.55,0.55));
}
ai.advYaw=Math.atan2(ai.wp.x-c.pos.x,ai.wp.z-c.pos.z);
navSteer(c,navSafeYaw(c,ai.advYaw,minDep),d<70?0.6:1,dt);
}
// 巡逻: 沿 sea.navRing (d=43..200) 环岛机动 —— 航点由 navRingPt 在方位角上现算 (兜底相位);
// 转向余量与推进同档 (cruise = ≥ringDep): 兜底相位也不许切进礁缘
// (2026-11-10: opensea 回守集结点巡逻分支随纯海战图下架摘除)
function navBoatPatrol(c,ai,dt,minDep){
const cruise=Math.max(minDep,NAV_AI.ringDep);
if(!ai.wp||Math.hypot(ai.wp.x-c.pos.x,ai.wp.z-c.pos.z)<45){
ai.ang=(ai.ang||rand(0,TAU))+ai.wing*NAV_AI.ringStep*rand(0.7,1.5);
ai.wp=navRingPt(ai.ang,NAV_AI.ringMid);
}
ai.advYaw=Math.atan2(ai.wp.x-c.pos.x,ai.wp.z-c.pos.z);
navSteer(c,navSafeYaw(c,ai.advYaw,cruise),1,dt);
}
// 对岸压制 (压制—脱离—换阵位): 旧实现是"艏向对准目标 ⇄ 离岸<standoff 就外转"的逐帧迟滞环 ——
// 迟滞带只有 45~54m (9m 宽), 而艇的掉头弧 ~74m ⇒ 每次外转都冲上礁盘 (实测水深掉到 1.24m、速度掉 5.8m/s),
// 再被 ⓪ 的 reefIn=36 推回海外 = 原地极限环 (用户原话"总是在出生点打转")。
// 新实现把"迟滞比较"换成**两个离散阵位状态** + 事件式转换:
//   'fire' 压制: 沿目标方位的**切线**跑 (炮塔 360° 自己咬住目标 —— 真炮塔换装后才成立的战术);
//   'move' 换阵位: 朝 navEngPos 选的新阵位 (目标侧后、离岸 ≥70m) 全速开进, 路上照打。
// 转换全靠事件 (到时/到点/离岸过近/目标出带), 不是逐帧比较 ⇒ 不可能逐帧翻转; 每次换阵位左右交替 ⇒
// 航程有下界 (0.8rad@250m ≈ 200m), 从机械上排除"原地振荡"。
function navBoatEngage(c,ai,dt,tgt,minDep){
const sd=navShoreD(c.pos.x,c.pos.z);
const d=Math.hypot(tgt.x-c.pos.x,tgt.z-c.pos.z);
const ty=(tgt.y!==undefined?tgt.y:0.6);
ai.engHold=(ai.engHold||0)+dt;
ai.engMoveT=(ai.engMoveT||0)+dt;
if(ai.engStance!=='move'&&(ai.engHold>NAV_AI.engHold||sd<NAV_AI.engOut||d>NAV_AI.engRange[1]||d<NAV_AI.engRange[0]*0.6)){
ai.engStance='move'; ai.engMoveT=0; ai.engPos=navEngPos(c,ai,tgt);     // 脱离: 换一个阵位
}
if(ai.engStance==='move'){
if(!ai.engPos) ai.engPos=navEngPos(c,ai,tgt);
const toPos=Math.hypot(ai.engPos.x-c.pos.x,ai.engPos.z-c.pos.z);
if(toPos<NAV_AI.engPosR||ai.engMoveT>NAV_AI.engMove){ ai.engStance='fire'; ai.engHold=0; }  // 到点 → 转压制
else{
ai.advYaw=Math.atan2(ai.engPos.x-c.pos.x,ai.engPos.z-c.pos.z);
navSteer(c,navSafeYaw(c,ai.advYaw,minDep),1,dt);
navBoatShoot(c,ai,dt,tgt.x,ty,tgt.z,0.30);                            // 走位途中照打 (炮塔与航向解耦)
return;
}
}
const bearing=Math.atan2(tgt.x-c.pos.x,tgt.z-c.pos.z);
ai.advYaw=navTangentYaw(c,bearing,ai.engSide||1);                     // 任务航向 = 沿岸炮击航路
navSteer(c,navSafeYaw(c,ai.advYaw,minDep),1,dt);
navBoatShoot(c,ai,dt,tgt.x,ty,tgt.z,0.22);
}
// 弹着规避: 基准航向 = 垂直于最近来袭弹道 (横向脱离瞄准线), 叠加 ★ sin(nowT*0.8)*ampl 蛇形,
// ampl = 0.55 + 威胁度*0.95 (受威胁越大摆幅越大, §5.1 原文口径)。
// ★ 关键: 规避时长只在"有威胁"时回填, 其余按 dt 递减 —— 否则每帧 max(evadeT,1.1) 会让它永远 >0,
//   艇就再也退不出 evade (实测: 被岸炮打两发后一路逃到离岸 1km 的外海)。
// ★ 2026-09-21 "规避不脱离任务"的 A/B 结论 = **否决** (留证据, 别再试一遍):
//   曾把规避航向限制在任务航向 ±90° 内 (理由是"纯横向脱离会把艇推到远海"), 实测反而更差:
//     自由横向闪避: 首次 <340m 相遇 t=46.4s, 离湾位移 678m, evade 占 53% 帧;
//     ±90° 限制后 : 首次 <340m 相遇 t=104.0s, 离湾位移 477m, evade 占 74% 帧。
//   机理: 横向闪避能把艇**带出岸炮 420m 包络**; 限向之后它一边挨打一边留在包络里, evadeT 被反复回填,
//   "躲"就变成主要相位、推进会师被拖慢。⇒ 保留自由的横向脱离 (spec §5.1 原口径)。
function navBoatEvade(c,ai,dt,th,minDep){
if(th>0) ai.evadeT=Math.min(4.5,Math.max(ai.evadeT,1.1+th*1.6));
ai.evadeT-=dt;
if(nowT>ai.awayYawT){ ai.awayYaw=navEvadeYaw(c); ai.awayYawT=nowT+1.2; }   // 基准航向每 1.2s 重取 (弹道变了就换向)
const ampl=NAV_AI.evadeAmp0+th*NAV_AI.evadeAmpK;
const yaw=ai.awayYaw+Math.sin(nowT*NAV_AI.evadeFreq)*ampl;
navSteer(c,navSafeYaw(c,yaw,minDep),1,dt);
}
// 追击对方小艇: 鱼雷窗口成立 → 发射 (side 0=左舷/1=右舷, aimDir=截击方向), 并沿截击航向走保住舷角;
// 窗口不成立 → 朝目标压上摆位。全程主炮/机炮对艇照打 (§2.1 主炮机炮双用)。
function navBoatHunt(c,ai,dt,enemy,minDep){
ai.torpT-=dt;
const w=navTorpWindow(c,enemy);
if(w.ok&&ai.torpT<=0&&typeof c.fireTorpedo==='function'&&c.torpAmmo!==0){
c.fireTorpedo(w.side,V3(Math.sin(w.aimYaw),0,Math.cos(w.aimYaw)));
ai.torpT=6.5;                                                   // 一舷齐射后 6.5s 再评估 (管数/再装填由 15d 管)
}
const want=w.ok?w.aimYaw:Math.atan2(enemy.pos.x-c.pos.x,enemy.pos.z-c.pos.z);
ai.advYaw=want;                                                    // 任务航向 = 截击/压上方向 (规避相位用)
navSteer(c,navSafeYaw(c,want,minDep),1,dt);
navBoatShoot(c,ai,dt,enemy.pos.x,(enemy.pos.y!==undefined?enemy.pos.y:0)+1.0,enemy.pos.z,0.2);
}
// ═══════════ ② amphAI —— 两栖车智能体 (涉水路线 → 冲滩 → 上岸复用坦克陆战层) ═══════════
function amphAI(craft,dt){
if(!craft) return;
// ★ 帧戳幂等 (Lead 2026-09-20 硬裁定 §11.9②): 与 boatAI 用各自独立字段, 艇/车互不压制。
if(craft.__aiAmphTick===nowT) return;
craft.__aiAmphTick=nowT;
if(craft.alive===false||craft.aiDrive===false) return;
const c=craft, ai=navAIS(c), spec=c.spec||{};
const st=c.state||'run';
if(st==='wreck'||st==='sinking'){ if(typeof c.drive==='function') c.drive(0,0,dt); return; }
const wade=spec.wadeDepth||0.55;
if(navDepth(c.pos.x,c.pos.z)>=wade){ ai.land=false; navAmphWater(c,ai,dt); return; }   // 浮航态 (§3.5)
// ★2026-11-01 修复 (红线7 浪线拔河): 旧版 depth<wade 即切陆战层, 但陆战层的推进/战术目标是**沿岸**
//   的旗点/掩体 —— 车还在浪里就被它带着沿岸开, 水深一过 wade 又被海图航路拽回滩头方向, 在浪线上
//   永动拔河 (实测 40s 停在离岸 ~10m/水深 0.55, 终态 run, 上岸=0 开火=0)。接管门改判**真上岸**
//   (navShoreD≤0): 浪线里的最后一段仍归海图航路 (末段=直冲滩头不避让), 踏上陆地才交陆战层 ——
//   与 §3.5"上岸复用坦克陆战层"的本意一致; 已上岸的车被浪/倒车推回水里时也自然切回航路。
if(navShoreD(c.pos.x,c.pos.z)>0){ ai.land=false; navAmphWater(c,ai,dt); return; }
ai.land=true;
navAmphLand(c,ai,dt);                                                                   // 履带态: 零改动复用坦克陆战层
}
// 涉水段: 沿"进近点 → (同侧切深航道口) → 冲滩点"三段航路推进。
// 两栖车吃水 0.40m, 礁盘平台 1.22m 也是浮航态 (§1.1 剖面表) ⇒ 直穿礁盘可行, 不为了走航道绕远;
// 冲滩点本身在陆上, 所以最后一站不做"躲陆"处理, 直冲上岸转履带态。
function navAmphWater(c,ai,dt){
if(!ai.route){
const L=navPickLane(c,ai);
ai.route=navAmphRoute(c,L,navBeachPt(c,L));
ai.routeI=0;
}
if(!ai.route.length){ navSteerTo(c,{x:0,z:0},1,dt); return; }
const lastI=ai.route.length-1;
let wp=ai.route[ai.routeI];
// ★2026-11-01: 末段过渡点 (lastI-1, 滩头点正前方 12m) 的换点半径收紧到 7m —— 沿用 26m 会在
//   离过渡点十几米处提前切向滩头点, 斜穿滩头堡台坎 (探针实测: 26m 半径下车在离滩 11m 处提前转向,
//   顶着堡基 padHeight 台坎永动)。收窄后最后一跳=近乎垂直登陆, 与 navBeachPt 的走廊验证同线。
if(ai.routeI<lastI&&Math.hypot(wp.x-c.pos.x,wp.z-c.pos.z)<(ai.routeI===lastI-1?7:26)) ai.routeI++;
wp=ai.route[ai.routeI];
const d=Math.hypot(wp.x-c.pos.x,wp.z-c.pos.z);
if(ai.routeI>=lastI){ navSteerTo(c,wp,1,dt); return; }              // 末段=冲滩 (目标在陆上, 不躲)
navSteer(c,navSafeYaw(c,Math.atan2(wp.x-c.pos.x,wp.z-c.pos.z),0.25),1,dt);
// ★2026-11-01 遗留登记 (红线7 仍红): 三处已修 (浅口插点陷阱/浪线拔河门/滩头走廊验证+末段正交过渡点)
//   后, 两栖车从"停在外海 30~38m"改善到"顶在浪线 8~11m"; 剩余病根=礁盘浪线散布的反登陆大件/台坎
//   (探针实测 ≥3 处独立阻挡: 堡基 padHeight 台坎 [24,176]/[17,169] 与浮航硬阻挡体 [-4,198]) 需要
//   "接近浪线时沿岸重扫最近干净登陆走廊"的运行时重定向, 且哪些豁口是设计上的预定登陆通道要用户裁定 ——
//   留待下一批 (试过末段去避让, 反而提前撞浮航硬阻挡, 已回滚)。
}
// 涉水路线 (§5.2): [择湾进近点(礁盘外, 20m)] + [同侧切深航道口 (≤80m 才插, 不绕远)] + [冲滩点]
function navAmphRoute(c,L,beach){
const route=[];
if(!beach){ route.push({x:0,z:0}); return route; }
if(L) route.push(navOffshorePt(L.x,L.z,20));
const S=navSeaCfg();
if(S&&S.channels&&S.channels.length){
const ax=route.length?route[0].x:c.pos.x, az=route.length?route[0].z:c.pos.z;
const mx=(ax+beach.x)/2, mz=(az+beach.z)/2;
let best=null,bd=1e9;
for(const ch of S.channels){
const gz=((ch.z0!==undefined)?ch.z0:0)+40;
if(mz>20&&gz<0) continue;                                   // 南湾航线不插北侧航道 (两侧海域不互通)
if(mz<-20&&gz>0) continue;
const d=Math.hypot(ch.x-mx,gz-mz);
if(d<bd){ bd=d; best={x:ch.x,z:gz}; }
}
	if(best&&bd<80){
	// ★2026-11-01 修复 (红线7 两栖车永不上岸的病根): 口点水深 < 涉水深度时**跳过插点**。
	//   旧版无条件插 ⇒ 两栖车要朝 0.28m 的浅口开, 而中间航点的每条航向都过 navSafeYaw(minDep=0.25)
	//   的"前方水深"门 —— 朝浅口的方向全被掰向深水侧, 车在离岸 ~30m 处沿岸打滑, 永远进不了
	//   26m 换点圈 ⇒ routeI 永远停在口点 ⇒ "末段=直冲滩头不避让"分支永远走不到 (红线7 ③ 开火=0)。
	//   设计 §5.2 自述"礁盘平台直穿可行, 不为了走航道绕远" —— 口太浅时直奔滩头才是本意。
	const _wade=(c.spec&&c.spec.wadeDepth)||0.55;
	if(navDepth(best.x,best.z)>=_wade) route.push(best);
	}
}
	// ★2026-11-01: 末段两跳 (滩头点正前方 12m 海上过渡点 → 滩头点)。旧版 approach→beach 一跳斜穿,
	//   湾侧的滩头堡台坎正好挡在斜线上 (车顶在坎前永动); 插了正交过渡点后最后一跳=垂直登陆,
	//   与 navBeachPt 的走廊验证同一条线。过渡点本身水深够深 (≥wade), navSafeYaw 不构成拦截。
	if(beach){
	const sdB=(typeof shoreDirAt==='function')?shoreDirAt(beach.x,beach.z):null;
	const bix=(sdB&&sdB[0])?sdB[0]:0, biz=(sdB&&sdB[1])?sdB[1]:0;
	route.push({x:beach.x-bix*12,z:beach.z-biz*12});
	}
	route.push(beach);
	return route;
}
// ── 上岸后: 零改动复用 15-vehicles 的坦克陆战层 ──────────────────────────────
// tankPerceive / tankCoverPoint / pickTankTactic 都按 `this` 取状态, 所以用**影分身** shim 承接它们的读写:
//   · 原型挂 Tank.prototype —— pickTankTactic 内部会调 this.tankCoverPoint(eng), 原型不对就会 "not a function";
//   · 活字段 (pos/yaw/team/hp/maxHp/vel/kind/def…) 用访问器接到载具上 (读到的是当帧真值);
//   · 写操作 (scratch: tVehTgt/aiCover/aiOrder/aiFlankSide…) 一律落在 shim 自己的属性上 ——
//     **不往载具对象挂任何 AI 字段** (冻结契约: 载具状态只读; 也避免与 15d 的字段命名撞车, Lead 已批准)。
function navAmphShim(c){
let s=_navShim.get(c);
if(!s){
const proto=(typeof Tank==='function'&&Tank.prototype)?Tank.prototype:Object.prototype;
s=Object.create(proto);
const live=['pos','yaw','team','hp','maxHp','vel','kind','name','turretYaw','turretPitch'];
for(const k of live){
Object.defineProperty(s,k,{
get(){ return c[k]; },
set(v){ Object.defineProperty(s,k,{value:v,writable:true,configurable:true,enumerable:true}); },  // 万一被写: 影子字段, 不回写载具
configurable:true});
}
Object.defineProperty(s,'def',{get(){ return c.spec||{}; },configurable:true});   // tankCoverPoint/pickTankTactic 读 this.def.reload
// scratch 初值: pickTankTactic 读 aiFlankSide 并参与加法 —— 不给初值会算出 NaN 航点
s.tVehTgt=null; s.tLastPos=null; s.tLastSeenT=-99; s.tMemT=0; s.aiOrder=null; s.aiCover=null;
s.aiReact=0; s.aiHaltT=0; s.aiRevT=0; s.aiTacticT=0; s.aiPerT=0; s.aiLeadT=0; s.aiLeadBias=0;
s.aiFlankSide=1; s.cannonCd=0; s.aimReact=0; s.losOK=false;
_navShim.set(c,s);
}
return s;
}
function navAmphLand(c,ai,dt){
const T=(typeof tankAITune==='function')?tankAITune():{fireTol:0.06,fireR:200,spreadMul:1,vis:235};
const sh=navAmphShim(c);
// ① 感知层 (零改动复用): 敌车感知 —— 与坦克车长同一支视野距离/视锥/LOS/记忆
if(typeof Tank==='function'&&Tank.prototype&&typeof Tank.prototype.tankPerceive==='function') Tank.prototype.tankPerceive.call(sh,dt);
// ② 目标优先级: 敌车 (tankPerceive 选定) > 敌方水面载具 > 近处敌方步兵
let tgt=(sh.tVehTgt&&sh.tVehTgt.alive)?sh.tVehTgt:null;
if(!tgt){ const ec=navEnemyCraftNear(c,260); if(ec) tgt=ec; }
if(!tgt){ const so=navEnemyInfNear(c,150); if(so) tgt=so; }
if(!tgt){ ai.mode='advance'; navAmphAdvance(c,ai,dt); return; }
ai.mode='combat';
const ed=Math.hypot(tgt.pos.x-c.pos.x,tgt.pos.z-c.pos.z);
// ③ 战术机动 (零改动复用): 敌车 → pickTankTactic (抢起伏掩体/侧翼/追残血); 换弹或半血 → tankCoverPoint 找 hull-down 位
let wp=null;
if(tgt.kind==='tank'&&typeof Tank==='function'&&Tank.prototype&&typeof Tank.prototype.pickTankTactic==='function'){
wp=Tank.prototype.pickTankTactic.call(sh,tgt,ed);
}
if(!wp&&(ai.fireT>0.5||c.hp<c.maxHp*0.5)&&ed>50&&typeof Tank==='function'&&Tank.prototype&&typeof Tank.prototype.tankCoverPoint==='function'){
wp=Tank.prototype.tankCoverPoint.call(sh,tgt);
}
if(wp&&(!isFinite(wp.x)||!isFinite(wp.z))) wp=null;                 // 复用的函数返回 NaN 就当作没有战术要求
if(wp&&Math.hypot(wp.x-c.pos.x,wp.z-c.pos.z)>3) navLandSteer(c,ai,Math.atan2(wp.x-c.pos.x,wp.z-c.pos.z),dt);
else navLandSteer(c,ai,Math.atan2(tgt.pos.x-c.pos.x,tgt.pos.z-c.pos.z),dt);
navAmphShoot(c,ai,dt,tgt,T);
}
// 陆上火力: 主炮门槛/火力距离吃 tankAITune() (与坦克炮长同档), 提前量按 spec.main.spd + SHELL_G 下坠;
// 瞄准走 15d 的 turretAimPoint(x,y,z) (回转+俯仰; 老实现只有 turretAimAt(x,z) 时退到只回转),
// 是否对准读 turretAimDir() (不猜 turretYaw 的语义)。
// ★ 2026-09-21 修 (红线7③ "上岸后主炮开火=0" 的直接根因): 旧实现**只转塔不抬炮** —— 炮口在 2.5m、
//   目标(步兵)在 1.1m, 27m 上就是 −0.05rad 的固定俯仰误差, 而 tankAITune().fireTol 只有 0.07rad ⇒
//   err 长期贴在门限上 (实测 0.061~0.076 vs tol 0.070), 70s 里只擦出 1 发、时序一偏就变 0 发。
//   抬炮之后 err 只剩横向跟瞄残差 (≈0.01rad), 门限从"刀刃"变成正常余量。
function navAmphShoot(c,ai,dt,tgt,T){
ai.fireT-=dt; ai.mgT-=dt;
const spec=c.spec||{}, main=spec.main||null;
const tv=navTgtVel(tgt);
const sp=(main&&main.spd)||SHELL_SPD_NAVAL;   // 兜底走单源 (2026-09-21B; 原字面量 115)
const d0=Math.hypot(tgt.pos.x-c.pos.x,tgt.pos.z-c.pos.z);
const tof=d0/sp;
const px=tgt.pos.x+tv[0]*tof, pz=tgt.pos.z+tv[1]*tof;
const ty=(tgt.pos.y!==undefined?tgt.pos.y:0)+1.1;
if(typeof c.turretAimPoint==='function') c.turretAimPoint(px,ty,pz);
else if(typeof c.turretAimAt==='function') c.turretAimAt(px,pz);
const dir=navLeadDir(c,px,ty,pz,sp);
const err=navAimErr(c,dir);
const d=Math.hypot(px-c.pos.x,pz-c.pos.z);
// 软目标 (步兵/工事/水面载具) 用放宽的指向门限: 37mm 榴弹打步兵不需要坦克级的 0.06~0.07rad 精度,
// 而坦克对坦克仍吃 T.fireTol 原值 (硬目标打偏就是白给)。倍率 2.2 与"37mm 对步兵有效半径 ~5m@100m"同量级。
// ★ 判据必须是 `kind!=='tank'` 而不是 `kind && kind!=='tank'`: 步兵 Bot **没有 kind 字段** (实测 undefined),
//   写成前者会让"放宽门限"对步兵失效 —— 而步兵正是陆战层最常见的软目标。
const soft=(tgt.kind!=='tank');
const tol=soft?Math.max(T.fireTol,T.fireTol*2.2):T.fireTol;
if(main&&typeof c.fireMain==='function'&&ai.fireT<=0&&err<tol&&d<=T.fireR){
let clear=true;
if(typeof raycastWorld==='function'){
const chk=raycastWorld(V3(c.pos.x,(c.pos.y||0)+1.9,c.pos.z),dir,d*1.05);
clear=!chk||chk.dist>d-3;
}
if(clear){ c.fireMain(dir); ai.fireT=Math.max(0.3,main.rof||1.4)*rand(1,1.2); return true; }
ai.fireT=0.6;                                                    // 视线被挡: 短退避, 不空放
return false;
}
if(typeof c.fireMG==='function'&&ai.mgT<=0&&tgt.kind!=='tank'&&err<0.1&&d<95){
c.fireMG(dir); ai.mgT=0.12; return true;
}
return false;
}
// 近处敌方步兵 (上岸后的软目标, 与坦克 turretAI 同口径: 只算下车步兵, 观战者除外)
function navEnemyInfNear(c,r){
let best=null,bd=r;
for(const s of combatants){
if(!s.alive||s.team===c.team||s.onVehicle||s.spectator) continue;
if(typeof chuteAirborne==='function'&&chuteAirborne(s)) continue; // 伞降目标不进两栖车候选 (2026-09-30 空对地平衡批)
const d=Math.hypot(s.pos.x-c.pos.x,s.pos.z-c.pos.z);
if(d<bd){ bd=d; best=s; }
}
return best;
}
// 无目标时推进: 朝最近的敌方/争夺中旗点开 (与 Bot.pickObjective 同语义, 共用 FLAGS); 无旗点则朝敌基地
function navAmphAdvance(c,ai,dt){
let best=null,bs=-1e9;
if(typeof FLAGS!=='undefined') for(const f of FLAGS){
let sc=-Math.hypot(f.x-c.pos.x,f.z-c.pos.z)*0.6;
if(f.owner!==c.team) sc+=90;
if(f.owner===c.team&&f.capTeam!==undefined&&f.capTeam!==-1&&f.capTeam!==c.team) sc+=140;
sc+=rand(0,25);
if(sc>bs){ bs=sc; best=f; }
}
let tx=null,tz=0;
if(best){ tx=best.x+rand(-6,6); tz=best.z+rand(-6,6); }
else if(typeof BASES!=='undefined'&&BASES.length){ tx=BASES[1-c.team].x; tz=BASES[1-c.team].z; }
if(tx===null){ navLandSteer(c,ai,c.yaw,dt); return; }
if(Math.hypot(tx-c.pos.x,tz-c.pos.z)<12){ navLandSteer(c,ai,c.yaw+HPI*0.5*ai.wing,dt); return; }   // 到场: 小范围机动等目标
navLandSteer(c,ai,Math.atan2(tx-c.pos.x,tz-c.pos.z),dt);
}
// 陆上行驶: 朝目标直行 + 前方占用/陡坎/回深水的扇面绕行 (坡度物理由 15d 复用 Tank 的那套承担)
function navLandSteer(c,ai,yaw,dt){
if(typeof c.drive!=='function') return;
let y=yaw;
if(navLandBlocked(c,y)){
let found=false;
for(const da of [0.45,-0.45,0.9,-0.9,1.4,-1.4]){
if(!navLandBlocked(c,y+da)){ y+=da; found=true; break; }
}
if(!found) y=yaw+HPI*ai.wing;                                     // 全被挡: 掉头找另一侧 (方向记忆, 不同帧抖动)
}
c.drive(1,clamp(-angDiff(c.yaw,y)*1.6,-1,1),dt);                  // 舵向符号同 navSteer (15d: turn=+1 右转)
}
function navLandBlocked(c,yaw){
const sx=Math.sin(yaw), sz=Math.cos(yaw);
const h0=(typeof heightAt==='function')?heightAt(c.pos.x,c.pos.z):0;
for(const r of [6,14]){
const x=c.pos.x+sx*r, z=c.pos.z+sz*r;
if(typeof occBlocked==='function'&&occBlocked(x,z)) return true;
if(typeof heightAt==='function'&&heightAt(x,z)-h0>1.6) return true;      // 爬不上去的坎
if(navDepth(x,z)>1.2) return true;                                       // 别把车开回深水 (上岸后按陆战打)
}
return false;
}
// ═══════════ ③ 反舰炮位 AI —— 已移交 15f (2026-09-21A 裁定) ═══════════
// 本文件**不再声明 batteryAI**。移交理由 (Lead 裁定, 方案 B):
//   · 15f-battery.js:620 已声明同名 batteryAI, 且 15f 在脚本序里后加载 ⇒ 页面里跑的必然是它;
//     两边同时存在 = "两个同名全局函数、页面跑 15f 的、沙箱测本文件的" ⇒ 一件事两支代码, 必须消除。
//   · 那批的主题正是"岸防炮改为人为操控"(A#9「无人不开炮」+ batteryMountPlayer/batteryDismountPlayer
//     + `get manned()`): AI 与操控同属一支才自洽 —— 3 参 batteryNear(x,z,r) 现在也被 15f 冻结为
//     "可上炮(无人且存活)"语义, 与本文件无涉。
// 本文件对炮位只保留**只读索敌/评分**两处 (均按队别过滤, 与占用无关):
//   · navScanShore 的 ① 反舰炮位压制目标 —— 用 4 参 batteryNear(x,z,r,team)(= 半径内最近的存活敌对炮位);
//   · navShoreDef 的择湾"岸防强度" —— 直接扫 BATTERIES 数组求和 (需要的是密度总和, 不是最近一门)。
// ── 步兵反装甲对水面载具 (§5.4) ──────────────────────────────────────────────
// 与打坦克**同档同管线**: 火箭筒 <65m 走同一支 fireRocket, 反坦克枪 <95m 走同一支 fireBullet,
// 散布/节奏公式逐项照抄打坦克分支 (60/rpm*rand(1.2,1.8) 等)。目标来自 decide() 里 enemyTankNear() 之后
// 追加的 navalNear() 扫描 —— enemyTankNear 函数体一行未动, 且坦克目标始终优先。
function navInfATShip(b,craft){
if(!b||!craft||craft.alive===false) return false;
const d=Math.hypot(craft.pos.x-b.pos.x,craft.pos.z-b.pos.z);
const cy=(craft.pos.y||0)+0.9;                                   // 艇体干舷中点 (命中圆柱由 15d 的 navalHitCyl 判定)
const eye=b.eyePos();
// ① 火箭筒 (与打坦克同一 LOS 门槛 50m / 同一 fireT 3.6s)
if(b.slots&&b.slots[0]&&b.slots[0].def.rocket){
const w2=b.slots[0];
if(w2.mag<=0||b.fireT>0||b.reloadT>0||d>=65) return false;
const dir2=V3(craft.pos.x-eye.x,cy-eye.y,craft.pos.z-eye.z).normalize();
const chk=raycastWorld(eye,dir2,65);
if(chk&&chk.dist<=50) return false;
b.lastFiredT=nowT;
b.switchVisualGun(w2.key);
b.visualGunTimer=nowT+1.8;
fireRocket(b,eye,dir2,w2.def,V3(craft.pos.x,cy,craft.pos.z));
w2.mag=0; b.mag=0; b.fireT=3.6;
return true;
}
// ② 反坦克枪 (PTRD/博伊斯/九七式自动炮 —— 与打坦克同一支 fireBullet 与同一节奏公式)
if(b.def&&b.def.atRifle&&b.mag>0&&b.fireT<=0&&b.reloadT<=0&&b.boltT<=0&&d<95){
const dir2=V3(craft.pos.x-eye.x,cy-eye.y,craft.pos.z-eye.z).normalize();
const chk=raycastWorld(eye,dir2,d);
if(chk&&chk.dist<=d-3) return false;
b.yaw=Math.atan2(craft.pos.x-b.pos.x,craft.pos.z-b.pos.z);
const er2=0.012*DIFF_TABLE[SETTINGS.diff].spreadMul;
dir2.x+=rand(-er2,er2); dir2.y+=rand(-er2,er2)*0.5; dir2.z+=rand(-er2,er2); dir2.normalize();
const muzz=eye.clone().addScaledVector(dir2,0.9);
b._src=b.def.name||'';                                          // 击杀来源: 当前武器名
fireBullet(b,eye,dir2,b.def,muzz);
b.mag--;
if(b.slots&&b.slots[0]) b.slots[0].mag=b.mag;   // 弹药账对齐 (2026-11-03)
b.mesh.armR.sh.userData.swing=0.15;
b.fireT=60/b.def.rpm*rand(1.2,1.8);
if(b.def.type==='bolt') b.boltT=b.def.boltT||1.2;
if(b.mag<=0&&b.canReload()) b.reloadT=b.def.reload*dynReloadFac(b.mag,b.def.mag); // 动态换弹速度 (2026-11-12, 坦克乘员 bot 同规)
b.prone=d>30;
return true;
}
return false;
}
// 探针只读视图 (dev/_navalai-selfcheck.js 用): 返回本文件为该目标保存的 AI 私有状态 (相位/冷却/目标)。
// 只读用途 —— 不改任何游戏数据; 用来核对相位推进、鱼雷/开火冷却与目标选择。
function navalAIDebug(o){ return _navState.get(o)||null; }
