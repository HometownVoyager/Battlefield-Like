// ─────────────────────────────────────────────
// 15h-capital.js —— 大舰本体 (巡航 / 可走甲板 / 瘫痪链 / 武器 / 命中) —— 2026-09-30 阶段五 P4 批
//
// 用户裁定 (2026-09-30 阶段门四问) 见 00-config 的 CAPITAL_SPEC 头注释。本文件是那四条的执行体。
//
// ══════════════════════════════════════════════════════════════════════════
// 一、为什么是**独立模块**而不是扩 15d-naval (登记表 §五: "复用 15d/15e/15f 既有契约,
//     冻结签名不动, 新舰种走新模块")
// ══════════════════════════════════════════════════════════════════════════
//   15d 的 navalCraft 是全库 ~15 个文件的公共登记表, 消费方的谓词一律是
//   `!n.alive || n.state==='sinking' || n.state==='wreck' ⇒ 跳过` (navalNear / navalPushCraft /
//   navalRayHit / 船坞 AI / 22b 观战层 / 23-deploy 补员 …)。大舰的语义与它们**正好相反**:
//     · 它**永不沉没** —— 打空即"瘫痪", 而且瘫痪后**更要**被看到、被登上、被占旗 (它是海上陆地);
//     · 它**不是目标候选** —— 小艇 AI 的 hunt/evade 不该围着 150m 的浮岛转圈;
//     · 它**不走 push 推挤** —— 20m 的 PT 艇推 24000 吨的舰体是荒谬的 (反过来才是对的)。
//   把这三种语义塞进同一条谓词, 只会在每个消费点写一个 `if(kind==='capital')` —— 那就是把
//   一张表劈成两套逻辑却仍共用状态机。故: 独立登记表 capitalShips + 独立命中管线,
//   与 navalCraft 只在三处显式交汇: ① 小艇不许穿舰体 (capPushCraft) ② 炮弹/鱼雷/溅射/子弹
//   各加一条大舰分支 ③ 海图符号并列绘制。
//
// ══════════════════════════════════════════════════════════════════════════
// 二、零横纵摇 (设计裁定, 与用户③"缓慢巡航"配套)
// ══════════════════════════════════════════════════════════════════════════
//   小艇走 seaWaveOffset 随浪起伏 (15d _attitude)。大舰**不随浪**: 一个 150m 的浮体在 0.15m
//   振幅的浪上本来就近乎不动, 而"甲板是移动平台"这件事要求甲板面必须是**刚体平面** ——
//   一旦引入横摇, 可行走面就从"矩形 × 一个高度"变成"矩形 × 随 x 变化的高度", 乘员跟随、
//   局部碰撞解算、旗杆高度三处全要跟着改, 收益 (1° 视觉) 远小于代价 (三处新 bug 面)。
//   代价保留为**瘫舰横倾**: 瘫痪/进水时给一个固定的 list 角 (CAPITAL_CFG.listPerFlood),
//   但那也是"一次性定格"的常量角, 不参与逐帧甲板解算 —— 见 _attitude。
//
// ══════════════════════════════════════════════════════════════════════════
// 三、甲板 = 移动平台 (实现口径)
// ══════════════════════════════════════════════════════════════════════════
//   站立:  04-collision 的 standHeight(x,z,curY) 是**全库唯一**的"脚下高度"出口 (玩家与 Bot 同源),
//          在那里插一条 capDeckY(x,z,curY) —— 甲板矩形内返回甲板面世界 Y (受 stepUp 0.55 闸门约束,
//          与既有"上台阶"口径逐字同规: 站在水里够不到 7m 高的甲板, 必须走 F 登舰)。
//   跟随:  updateCapital 每帧 ①用**移动前**位姿记录乘员的舰体局部坐标 → ②推舰 → ③按**新**位姿放回。
//          乘员自己的移动 (玩家输入/Bot AI) 在其它环节照常跑, 只是每一帧先被平台"搬运"一次 ——
//          等价于把乘员挂在舰体坐标系里, 走出甲板矩形那一步自然落海 (capDeckY 返回 −Inf ⇒ 脚下变海床)。
//   绕行:  上层建筑/炮塔/烟囱在舰体**局部空间**做 OBB 推出 (capLocalSolve)。不走全局 BOXES/OCC:
//          舰在动, 而 registerDynCollider 每次调用都要写 OCC 脏区 + 触发 NAV 重建 —— 逐帧搬 20 个盒
//          等于把寻路网格当筛子摇。局部解算的代价是 O(件数×乘员数) ≈ 20×40, 可忽略。
//
// ══════════════════════════════════════════════════════════════════════════
// 四、瘫痪链 (用户裁定②: 可毁不快沉, 打不沉的海上据点)
// ══════════════════════════════════════════════════════════════════════════
//   takeDmg → hp 递减 (分区装甲倍率) → hp<=0 ⇒ cripple(): 一次性定格, 此后**永久**:
//     · alive 仍为 true (仍是可站/可占/可打的平台; 不参与任何"跳过已毁"的谓词)
//     · state='crippled'; 动力 0; 全部炮位报废 (玩家炮位强制下炮)
//     · 上层建筑与舷侧换残骸材质 + 主炮塔下垂定格 + 起火冒烟 + 横倾 (定格常量)
//     · 甲板照走、旗点照争 (FLAGS 不动)、票数按 spec.ticket 结算
//   与小艇沉没链 (15d beginDestroy→_updateSinking→_finishWreck→respawn) **零交集**。
//
// ══════════════════════════════════════════════════════════════════════════
// 五、冻结 API (与 15d §11.3 同档纪律: 签名不得单方面改动)
// ══════════════════════════════════════════════════════════════════════════
//   const capitalShips=[]                      全部大舰 (含已瘫痪; 本局不移除)
//   capToWorld(s,lx,lz[,out])  舰体局部 → 世界 (x,z)
//   capToLocal(s,x,z[,out])    世界 → 舰体局部 (x,z)
//   capDeckY(x,z,curY)         脚下高度查询 (04-collision standHeight 的挂钩; 无舰/不在甲板 → −1e9)
//   capDeckOf(x,z)             返回该点所在的大舰 (不判高度; 供跟随/占位查询)
//   capDeckShipAt(x,z,curY)    甲板承载查询 (唯一判据表): 返回托着该点的舰 | null (curY 缺省=不设高度门)
//   capCarryDelta(s,x,z[,out]) 甲板承载的刚性位移: 上一帧世界点 → 当前位姿下的世界点 (无状态)
//   capPushBody(pos,radius)    实心舰体对步兵的推出 (04-collision collideMove 的挂钩)
//   capPushCraft(c,dt)         实心舰体对小艇的推出 (updateCapital 内逐艇调用)
//   capLocalSolve(a,s)         甲板上乘员的局部障碍绕行 (上层建筑/炮塔/烟囱/护栏内侧)
//   capitalRayHit(o,dir,maxD,team,pad)     射线 ∩ 大舰 (只读) → {t,ship,tag}|null
//   capitalRayQuery(o,dir,maxD,shooter)    子弹终点收窄用的只读查询 (team 语义同 navalRayQuery)
//   capitalBulletTest(o,dir,maxD,shooter,vehDmg)  子弹对舰扣血 (只扣血, 不裁剪弹道)
//   capitalShellHit(shell,dt)              炮弹对舰 (updateShells 的挂钩; true = 已消耗)
//   capitalTorpedoHit(p,team,dmg,owner)    鱼雷/点命中对舰 (返回 ship|null)
//   capitalSplash(p,attacker,team,radius,dmgMax,dmgVeh,ap,fbCls)  爆炸溅射对舰
//   updateCapital(dt,pdt)      主更新 (24-main 内紧接 updateNaval 之后)
//   capitalSpawnOrbat()        开局编制生成 (23-deploy.startMatch 调用)
//   capBasePos(team)           基地跟随本队大舰 (00-config basePos 的挂钩)
//   capNearestBoardable() / capBoard(s) / capSeatRelease() / capCanExitNow() / capExitNow()
//   capitalFlagTick(dt)        甲板旗点跟随 (21-match 或本文件主更新内调用)
//   capitalReset()             世界还原 (23b / 22-hud retireMatchActors 调用)
//   capitalNear(x,z,r[,team])  最近大舰 (海图符号 / AI 索敌)
// ══════════════════════════════════════════════════════════════════════════

const capitalShips=[];

// ── 舰体局部 ↔ 世界 (单源; 世界里 yaw 的前向 = (sin,cos), 与 16-aircraft Plane.velVec 同规) ──
//   局部 (lx,lz) → 世界: x = pos.x + lx*cos + lz*sin ; z = pos.z − lx*sin + lz*cos
//   世界 → 局部 (逆旋转 = 转置):  lx = dx*cos − dz*sin      ; lz = dx*sin + dz*cos
function capToWorld(s,lx,lz,out){
const c=Math.cos(s.yaw), n=Math.sin(s.yaw);
out=out||{x:0,z:0};
out.x=s.pos.x+lx*c+lz*n;
out.z=s.pos.z-lx*n+lz*c;
return out;
}
function capToLocal(s,x,z,out){
const dx=x-s.pos.x, dz=z-s.pos.z, c=Math.cos(s.yaw), n=Math.sin(s.yaw);
out=out||{x:0,z:0};
out.x=dx*c-dz*n;
out.z=dx*n+dz*c;
return out;
}
const _capW={x:0,z:0}, _capL={x:0,z:0};
// SAT 角点阵复用槽 (2026-11-01 性能批): capPushCraft/capPushCap 旧版每次调用 new Array(8)×2;
// capCorners 全量覆写 8 格, 两函数互不重入 (updateCapital 串行调用), 槽可安全复用。
const _capCC=new Array(8), _capCS=new Array(8), _capCA=new Array(8), _capCB=new Array(8);
// ── 自带段几何 (2026-09-30): 大舰模块**不依赖 15d** —— 这两个函数是纯几何, 但 15d 里是私有实现,
//   借它会让"只加载部分脚本的探针"(verify-layouts/sink/specthird 等 30 个) 在 capitalSplash 处抛
//   ReferenceError: navalPtSeg2 is not defined。独立成模块就该自带自己用到的算术 (与小艇侧零耦合)。
function cpPtSeg2(px,pz,ax,az,bx,bz){
const ex=bx-ax, ez=bz-az, c=ex*ex+ez*ez;
if(c<1e-9){ const dx=px-ax, dz=pz-az; return dx*dx+dz*dz; }
const s2=clamp(((px-ax)*ex+(pz-az)*ez)/c,0,1);
const dx=px-(ax+ex*s2), dz=pz-(az+ez*s2);
return dx*dx+dz*dz;
}
function cpRaySeg(ox,oz,dx,dz,ax,az,bx,bz,maxT){
// ★2026-10-01 系统自查修: 首版是"垂足近似"(射线到线段的垂足 + 线段端点到射线的垂足), 对
//   **斜穿线段中点**的射线会漏判 (沿 x 打 yaw≠0 的舰体 ⇒ 命中为 null, 炮弹穿舰而过)。
//   舰体胶囊改成随 yaw 旋转后这条立刻暴露 (旧版胶囊不转, 只喂轴对齐姿势, 恰好把漏判盖住了)。
//   现改为 15d navalRaySeg 的同式真解 (线-线最近点 + 两轮定标收敛)。
const ex=bx-ax, ez=bz-az;
const a=dx*dx+dz*dz, c=ex*ex+ez*ez;
const wx=ox-ax, wz=oz-az;
if(a<1e-9){ return {t:0,d2:wx*wx+wz*wz}; }
if(c<1e-9){ const tt=clamp((dx*wx+dz*wz)/a,0,maxT); const px=ox+dx*tt-ax, pz=oz+dz*tt-az; return {t:tt,d2:px*px+pz*pz}; }
const b=dx*ex+dz*ez;
const d=dx*wx+dz*wz, e=ex*wx+ez*wz;
const den=a*c-b*b;
let t,s;
if(den<1e-9){ t=clamp(-d/a,0,maxT); s=0; }
else { t=clamp((b*e-c*d)/den,0,maxT); s=clamp((a*e-b*d)/den,0,1); }
t=clamp((b*s-d)/a,0,maxT);
s=clamp((b*t+e)/c,0,1);
t=clamp((b*s-d)/a,0,maxT);
const px=ox+dx*t, pz=oz+dz*t;
const qx=ax+ex*s, qz=az+ez*s;
const ddx=px-qx, ddz=pz-qz;
return {t,d2:ddx*ddx+ddz*ddz};
}

// ══════════════════════════════════════════════════════════════════════════
// 六、甲板平台查询 (standHeight 挂钩)
// ══════════════════════════════════════════════════════════════════════════
// 甲板边缘半宽 (局部 z): 单源在 15g 的 cpDeckHW (与**铺面几何**同一张站位表) —— 战列舰的甲板在艏艉
//   随舰体收窄, 航母是全通矩形。15g 缺席 (只载部分脚本的沙箱) 时退化为 spec 矩形。
//   ★2026-10-01 实机修: 旧版一律按 deck.hw 的**矩形**判 ⇒ 战列舰艏艉那两段根本没有铺面的地方
//   也算"站在甲板上" (人在半空走), 且"走出甲板缘掉海"在艏艉根本不触发。铺面/可行走面同表后自动闭合。
function capDeckHW(s,lz){
if(typeof cpDeckHW==='function') return cpDeckHW(s.spec,lz);
return s.deck.hw;
}
function capDeckIn(s,lx,lz,m){
const mm=m||0;
if(Math.abs(lz)>s.deck.hl-mm) return false;
return Math.abs(lx)<=capDeckHW(s,lz)-mm;
}
// 甲板承载查询: 返回"托着这个点的舰", 无 ⇒ null。**这一支是唯一判据表** —— capDeckY (standHeight 挂钩)
//   与 12-ragdolls 的布娃娃/碎块落地支撑都读它, 免得两处各自维护一遍粗筛/矩形/高度门。
// curY 缺省 = 不设高度门 (纯几何查询); 传入时按 CAPITAL_CFG.stepUp 与"从下方够不着"两侧夹。
function capDeckShipAt(x,z,curY){
if(!capitalShips.length) return null;
for(let i=0;i<capitalShips.length;i++){
const s=capitalShips[i];
if(Math.abs(x-s.pos.x)>s.spec.hullL*0.5+4||Math.abs(z-s.pos.z)>s.spec.hullL*0.5+4) continue; // 粗筛 (轴对齐外接圈)
capToLocal(s,x,z,_capL);
if(!capDeckIn(s,_capL.x,_capL.z)) continue;
const y=s.pos.y+s.deck.y;
if(curY!==undefined){
if(y>curY+CAPITAL_CFG.stepUp) continue;    // 够不着 (在水里看 7m 高的甲板) ⇒ 不抬脚
if(y<curY-CAPITAL_CFG.rideEps-4) continue; // 远在下方 (在舰底/深水里) ⇒ 不算站在这层
}
return s;
}
return null;
}
// 返回甲板面**世界 Y**; 不在任何甲板上 ⇒ −1e9 (调用方取 max 时自然落到地形/海床)。
function capDeckY(x,z,curY){
const s=capDeckShipAt(x,z,curY);
return s?(s.pos.y+s.deck.y):-1e9;
}
// 甲板承载的刚性位移 (2026-10-01 实机修): 传"上一帧世界点", 返回"本帧世界点"。
//   用舰记录的**上一帧位姿** (_px/_pz/_pyaw, 由 step() 维护) 换算到舰体局部, 再用**当前位姿**投回 ——
//   与乘员搬运 capRideApply 的"移动前收集 / 移动后放回"同一条口径, 但**无状态**: 甲板上任意多具
//   布娃娃/碎块各自问一次都得到同一个刚体变换, 谁先谁后都不会互相吃掉位移。
function capCarryDelta(s,x,z,out){
out=out||{x:0,z:0};
const px=(s._px!==undefined)?s._px:s.pos.x, pz=(s._pz!==undefined)?s._pz:s.pos.z;
const py=(s._pyaw!==undefined)?s._pyaw:s.yaw;
const dx=x-px, dz=z-pz, c=Math.cos(py), n=Math.sin(py);
const lx=dx*c-dz*n, lz=dx*n+dz*c;
const c2=Math.cos(s.yaw), n2=Math.sin(s.yaw);
out.x=s.pos.x+lx*c2+lz*n2;
out.z=s.pos.z-lx*n2+lz*c2;
return out;
}
// 出生/复活落点高度 (2026-09-30): 与 standHeight 同源, 但甲板一项**不设登步高度门** ——
//   stepUp 0.55 的闸门是给"走"用的 (在水里够不到 7~11m 高的甲板, 必须走 F 登舰); 出生/复活不是"走上去",
//   落点就在甲板上 ⇒ 直接取甲板面。玩家部署/重生、Bot 出生、小队铺开三处统一读这一支。
//   无大舰/不在甲板上时逐位退化为 standHeight (非海战图调用它是零行为变化)。
function capSpawnGroundY(x,z,curY){
let y=(typeof standHeight==='function')?standHeight(x,z,curY):0;
const d=capDeckY(x,z);            // 不传 curY = 关掉高度门
if(d>y) y=d;
return y;
}
// 出生落点吸附到甲板 (P4 2026-09-30): 全海图的"陆地"只有舰甲板, 而 pickSpawnPoint 是在参考点周围
//   20m 环上撒点 —— 战列舰甲板 17.2m 宽, 撒出去的点有一半落在舷外海面上 (那里 standHeight 给的是海床:
//   兵会先出现在水下再游上来)。口径: 参考点在某舰甲板上 ⇒ 落点**夹进该舰甲板矩形**(内缩 1.5m 避护栏);
//   参考点不在任何甲板上而全图又有大舰 ⇒ 退而求其次夹进该队旗舰甲板 (保证"海上图一定落在陆地上")。
//   非海战图 capitalShips 为空 ⇒ 返回 null, 调用方逐位保持旧行为。
function capSnapToDeck(x,z,refX,refZ,team){
if(!capitalShips.length) return null;
let s=(refX===undefined)?null:capDeckOf(refX,refZ);
if(!s&&team!==undefined){
s=capCarrierOfTeam(team);
if(!s){ let bd=1e9; for(const k of capitalShips){ if(k.team!==team) continue; const d=Math.hypot(x-k.pos.x,z-k.pos.z); if(d<bd){ bd=d; s=k; } } }
}
if(!s) return null;
capToLocal(s,x,z,_capL);
// 先夹 z 再按**该 z 处的**甲板半宽夹 x (战列舰艏艉收窄: 按最大半宽夹会把人夹到没有甲板的地方)
_capL.z=clamp(_capL.z,-s.deck.hl+1.5,s.deck.hl-1.5);
const hw=capDeckHW(s,_capL.z)-1.5;
_capL.x=clamp(_capL.x,-hw,hw);
capToWorld(s,_capL.x,_capL.z,_capW);
return {x:_capW.x,z:_capW.z,ship:s};
}
// 该点所在的大舰 (不判高度): 供跟随/占位/旗点归属查询
function capDeckOf(x,z){ return capDeckShipAt(x,z); }   // 不判高度 = capDeckShipAt 缺省 curY 的那一支 (2026-10-01 合一, 原独立矩形遍历已删)
// ── 实心舰体对步兵的推出 (04-collision.collideMove 挂钩) ──
// 两个高度层, 语义**相反**, 2026-10-01 实机修:
//   ① 甲板层 (脚在甲板面附近): 该层是**护栏**的活 —— 把乘员夹在甲板缘内 CAPITAL_CFG.railIn 处。
//      旧版在这一层照样走舷侧推出 ⇒ 站在甲板上的人每帧被当成"撞舷侧的游泳者"弹到舷外
//      (实测 15 帧内 lx=10.92 = 半宽+半径, 然后掉海) —— 实机那两条"船体上面有来源不明的阻力完美
//      防止玩家和Bot上去 / 舰移动不带走上面的人"是同一个根因: 人根本站不住。
//   ② 水线层: 舷侧是硬墙 (水线以下不挡 —— 游泳者可贴舰底通过, 也避免深水区把玩家夹死)。
function capPushBody(pos,radius){
if(!capitalShips.length) return;
// ★2026-10-01d: "脚下这片甲板"是唯一护栏执法者 —— 旧版每片甲板矩形各自为政, 两舰贴帮时同一人
//   同时落在两片甲板矩形里, 两道夹持互相对挤, 把人往重叠区外推 (推过舷缘 = 被挤下海);
//   且邻舰的水线层旧版**没有上限高度门**, 它的 hull 矩形从本舰甲板高度横扫, 甲板上的乘员整片被推离。
//   承载判定与护栏同一容差口径 (capDeckIn −1.2m): 旧版"贴着舷缘外 1.2m 内的人被拉回甲板"的宽限保留。
let sup=null;   // (2026-11-01 性能批) 旧版 IIFE 每次调用分配一个闭包+立即执行 —— 每帧每移动单位一次
for(const s of capitalShips){
if(pos.y<s.pos.y+s.deck.y-CAPITAL_CFG.stepUp) continue;
capToLocal(s,pos.x,pos.z,_capL);
if(!capDeckIn(s,_capL.x,_capL.z,-1.2)) continue;
sup=s; break;
}
for(const s of capitalShips){
const deckTop=s.pos.y+s.deck.y;
if(pos.y>=deckTop-CAPITAL_CFG.stepUp){
if(s!==sup) continue;                                  // 别舰的甲板与本舰重叠: 护栏归脚下这片甲板管
// 甲板层: 护栏约束 (想下舰走 F → capExitNow / Bot 走 capBotTick 的脚本化跨域过渡)
capToLocal(s,pos.x,pos.z,_capL);
if(!capDeckIn(s,_capL.x,_capL.z,-1.2)) continue;   // 甲板面高度但**不在这片甲板上** (如刚落水的下舰点) ⇒ 不管
const inn=CAPITAL_CFG.railIn+Math.max(0,radius-0.3);
const hw=capDeckHW(s,_capL.z)-inn, hl=s.deck.hl-inn;
const cx=clamp(_capL.x,-hw,hw), cz=clamp(_capL.z,-hl,hl);
if(cx!==_capL.x||cz!==_capL.z){
// 跳帮放行 (2026-10-01c 用户裁定"两船相碰应当可以跳帮作战, 现在围栏像能量力场"): 被夹的方向上,
//   舷缘之外若已是**另一舰的甲板面** (贴帮/艏艉相接) ⇒ 这道夹持让位 —— 围栏拦"走"不拦"跳帮";
//   越过舰间空隙后由对方甲板的夹持接手 (capDeckY/standHeight 自会把他落到那片甲板上)。
//   探测距离分档 [1.2, 2.8, 4.4]: 两舰 hull 贴合时甲板缘之间还隔着 (hull−deck) 的舷侧走道 ≈1.5~3m,
//   只探 1.2m 探不到对方甲板 (S18 实测) —— 最远档盖住 bb-bb 贴帮的全部间隙。
const ox=(cx!==_capL.x)?((_capL.x>0)?1:-1):0, oz=(ox===0&&cz!==_capL.z)?((_capL.z>0)?1:-1):0;
if(ox!==0||oz!==0){
let board=false;
for(const pd of [1.2,2.8,4.4]){
capToWorld(s,_capL.x+ox*pd,_capL.z+oz*pd,_capW);
const o=capDeckShipAt(_capW.x,_capW.z);
if(o&&o!==s&&Math.abs((o.pos.y+o.deck.y)-deckTop)<1.8){ board=true; break; }
}
if(board) continue;
}
capToWorld(s,cx,cz,_capW);
pos.x=_capW.x; pos.z=_capW.z;
}
continue;
}
if(pos.y+1.7<s.pos.y+s.draft0*0.55) continue;          // 整个身子都在水线下 ⇒ 不挡
// ★2026-10-01d: 整个身子已在舰体干舷之上 ⇒ 不挡 (新增上限门) —— 舰体实体的顶就是 hullH,
//   比它高的人 (站在邻舰甲板上/楼上) 不可能被这艘舰的舷侧挡住; 旧版没有这道门, 邻舰开过时
//   它的 hull 矩形把本舰甲板上的乘员整片推下海 (实机"Bot 集体落水是被别的大船挤下去"的根因)。
if(pos.y>s.pos.y+s.spec.hullH*0.75) continue;
capToLocal(s,pos.x,pos.z,_capL);
const hw=s.spec.hullW*0.5, hl=s.spec.hullL*0.5;
const ax=Math.abs(_capL.x)-hw-radius, az=Math.abs(_capL.z)-hl-radius;
if(ax>=0||az>=0) continue;
if(-ax<-az){ _capL.x=(_capL.x<0?-1:1)*(hw+radius); }
else       { _capL.z=(_capL.z<0?-1:1)*(hl+radius); }
capToWorld(s,_capL.x,_capL.z,_capW);
pos.x=_capW.x; pos.z=_capW.z;
}
}
// ── 舰/艇体矩形四角 (局部 hullW/2 × hullL/2 → 世界) —— capPushCap / capPushCraft 的 SAT 共用 ──
function capCorners(s,out){
const hw=s.spec.hullW*0.5, hl=s.spec.hullL*0.5, c=Math.cos(s.yaw), n=Math.sin(s.yaw);
out[0]=s.pos.x+hw*c+hl*n; out[1]=s.pos.z-hw*n+hl*c;
out[2]=s.pos.x-hw*c+hl*n; out[3]=s.pos.z+hw*n+hl*c;
out[4]=s.pos.x+hw*c-hl*n; out[5]=s.pos.z-hw*n-hl*c;
out[6]=s.pos.x-hw*c-hl*n; out[7]=s.pos.z+hw*n-hl*c;
return out;
}
// ── 实心舰体对小艇的推出 (大舰不动, 艇让路) ──
//   ★2026-10-01d: 判定升级为**双 OBB 的 2D SAT** (与 capPushCap 同一支) —— 旧版只测艇中心,
//   艇艏斜插进舰舷时中心还在外面 ⇒ 判不出, 艇艏穿进舰体。艇掉速 (0.35) 维持旧口径。
function capPushCraft(c,dt){
if(!c||!capitalShips.length||c.state==='sinking'||c.state==='wreck') return;
const _cc=_capCC, _cs=_capCS;   // 角点阵复用槽 (2026-11-01 性能批): 旧版每次调用 new Array(8)×2, 每帧每艇
for(const s of capitalShips){
const dx=c.pos.x-s.pos.x, dz=c.pos.z-s.pos.z;
if(dx*dx+dz*dz>(s.spec.hullL*0.5+30)*(s.spec.hullL*0.5+30)) continue;
capCorners(s,_cs);
capCorners(c,_cc);
let bestPen=1e9, bx=0, bz=0, overlap=true;
for(const src of [_cs,_cc]){
const yaw=src===_cs?s.yaw:c.yaw;
const co=Math.cos(yaw), nn=Math.sin(yaw);
for(const ax of [[co,-nn],[nn,co]]){
let minA=1e9,maxA=-1e9,minB=1e9,maxB=-1e9;
for(let k=0;k<8;k+=2){
const da=_cs[k]*ax[0]+_cs[k+1]*ax[1]; if(da<minA)minA=da; if(da>maxA)maxA=da;
const db=_cc[k]*ax[0]+_cc[k+1]*ax[1]; if(db<minB)minB=db; if(db>maxB)maxB=db;
}
if(Math.max(minA,minB)>=Math.min(maxA,maxB)){ overlap=false; break; }
// 分离量 = 把 B 推出 A 投影所需的**较小侧**位移 (包含/同心情形 = 半宽和, 不是重叠深度)
const escR=maxA-minB, escL=maxB-minA;
if(Math.min(escR,escL)<bestPen){ bestPen=Math.min(escR,escL); bx=ax[0]; bz=ax[1]; }
}
if(!overlap) break;
}
if(!overlap) continue;
const sgn=((c.pos.x*bx+c.pos.z*bz)>=(s.pos.x*bx+s.pos.z*bz))?1:-1;
c.pos.x+=bx*sgn*bestPen; c.pos.z+=bz*sgn*bestPen;
if(c.vel) c.vel*=0.35;                                  // 撞上就掉速 (艇撞舰不该毫发无伤地滑过去)
}
}
// ── 大舰 ↔ 大舰 推出 (2026-10-01b 用户裁定"船之间没有碰撞判定, 会互相穿过"): 两舰等质量, 各让一半。
//   ★2026-10-01d 实机复报"撞船穿模仍十分严重"的根因: 旧版只把 b 的**中心**投进 a 的外接矩形判重叠 ——
//   T-bone/斜擦时 b 的舰艏已插进 a 的舷侧, 中心还在外面 ⇒ 判不出重叠, 整条船对穿。
//   现改为**双 OBB 的 2D SAT**: 取两舰各自的局部 x/z 轴共 4 根分离轴, 任意一根不重叠 ⇒ 未接触;
//   全部重叠时沿**穿透最浅**的轴各退一半 (+5cm 余量防浮点贴合)。四角点用 capToWorld 同式的旋转。
function capPushCap(){
if(capitalShips.length<2) return;
const _ca=_capCA, _cb=_capCB;   // 复用槽 (2026-11-01 性能批)
for(let i=0;i<capitalShips.length;i++) for(let j=i+1;j<capitalShips.length;j++){
const a=capitalShips[i], b=capitalShips[j];
const dx=b.pos.x-a.pos.x, dz=b.pos.z-a.pos.z;
const rr=(a.spec.hullL+b.spec.hullL)*0.5+6;
if(dx*dx+dz*dz>rr*rr) continue;
capCorners(a,_ca); capCorners(b,_cb);
let bestPen=1e9, bx=0, bz=0, overlap=true;
for(const s of [a,b]){
const c=Math.cos(s.yaw), n=Math.sin(s.yaw);
for(const ax of [[c,-n],[n,c]]){                        // 舰体局部 x / z 轴 → 世界方向
let minA=1e9,maxA=-1e9,minB=1e9,maxB=-1e9;
for(let k=0;k<8;k+=2){
const da=_ca[k]*ax[0]+_ca[k+1]*ax[1]; if(da<minA)minA=da; if(da>maxA)maxA=da;
const db=_cb[k]*ax[0]+_cb[k+1]*ax[1]; if(db<minB)minB=db; if(db>maxB)maxB=db;
}
if(Math.max(minA,minB)>=Math.min(maxA,maxB)){ overlap=false; break; }
// 分离量 = 把 b 推出 a 投影的**较小侧**位移 (同心/包含情形 = 半宽和, 不是重叠深度 —— 重叠深度
//   在"小投影整个在大投影里"时小于真正需要的推出量, 推完还重叠)
const escR=maxA-minB, escL=maxB-minA;
if(Math.min(escR,escL)<bestPen){ bestPen=Math.min(escR,escL); bx=ax[0]; bz=ax[1]; }
}
if(!overlap) break;
}
if(!overlap) continue;
// 分离方向: 中心投影在轴上谁在正侧谁往正侧退 (b 正 a 负)
const sgn=((b.pos.x*bx+b.pos.z*bz)>=(a.pos.x*bx+a.pos.z*bz))?1:-1;
const half=bestPen*0.5+0.05;
b.pos.x+=bx*sgn*half; b.pos.z+=bz*sgn*half;
a.pos.x-=bx*sgn*half; a.pos.z-=bz*sgn*half;
}
}
// ── 甲板上乘员的局部障碍绕行 (上层建筑/炮塔/烟囱) ──
function capLocalSolve(a,s){
capToLocal(s,a.pos.x,a.pos.z,_capL);
const yl=a.pos.y-s.pos.y;                                // 脚高的舰体局部 y
const R=0.42;
let lx=_capL.x, lz=_capL.z, moved=false;
for(let k=0;k<s.boxes.length;k++){
const b=s.boxes[k];
if(yl>=b.ly+b.hh) continue;                            // 该件顶面在脚之下 ⇒ 可从上面走 (炮座矮件)
if(yl+1.75<b.ly-b.hh) continue;                        // 该件整个在头顶之上 ⇒ 不挡
const ax=Math.abs(lx-b.lx)-b.hw-R, az=Math.abs(lz-b.lz)-b.hd-R;
if(ax>=0||az>=0) continue;
if(-ax<-az) lx=(lx<b.lx?-1:1)*(b.hw+R)+b.lx;
else        lz=(lz<b.lz?-1:1)*(b.hd+R)+b.lz;
moved=true;
}
if(moved){ capToWorld(s,lx,lz,_capW); a.pos.x=_capW.x; a.pos.z=_capW.z; }
}

// ══════════════════════════════════════════════════════════════════════════
// 七、本体
// ══════════════════════════════════════════════════════════════════════════
class CapitalShip{
constructor(specKey,team,cfg){
const S=CAPITAL_SPEC[specKey];
if(!S) throw new Error('CAPITAL_SPEC 缺键: '+specKey);
this.kind='capital';
this.key=specKey; this.spec=S; this.def=S;            // def 别名: 与 Tank/NavalCraft 的既有读取习惯一致
this.cls=S.cls; this.team=team; this.name=S.name;
// 尺寸别名单源: 全部指向 spec 的同一批字段 (只读; 小艇侧的口径就是 spec.hullL/hullW)
this.hullL=S.hullL; this.hullW=S.hullW; this.hullH=S.hullH; this.deckHW=S.deckHW;
this.hp=S.hp; this.maxHp=S.hp;
this.alive=true; this.state='run';                     // 'run' 巡航 | 'crippled' 瘫痪 (永久)
this.flood=0;
this.pos=V3(cfg.x,0,cfg.z); this.yaw=cfg.yaw||0;
this.spd=0; this.spdMax=S.spd;
this.turYaw=[], this.turPitch=[], this.mainCd=[], this.secCd=[], this.aaCd=[];
this.secAimY=[], this.secAimP=[], this.aaAimY=[], this.aaAimP=[];
for(let i=0;i<(S.main?S.main.n:0);i++){ this.turYaw.push(0); this.turPitch.push(0.02); this.mainCd.push(rand(2,8)); }  // 航母 main=null (无主炮) —— 循环上界必须走可选链, 否则 cv 一造即崩
for(let i=0;i<(S.sec?S.sec.n:0);i++){ this.secCd.push(rand(0.5,2)); this.secAimY.push(0); this.secAimP.push(0.05); }
for(let i=0;i<(S.aa?S.aa.n:0);i++){ this.aaCd.push(rand(0.3,1.5)); this.aaAimY.push(0); this.aaAimP.push(0.25); }
// 分炮塔血量 (2026-10-01b 用户裁定"各个分炮塔有自己的血量, 可以上去操控, 被打坏了就不能用"):
//   数值单源 = CAPITAL_SPEC.main/sec/aa.turHp; hp<=0 ⇒ 该炮位报废 (AI 不再转它/打它,
//   玩家不可接管/接管中被炸废就地退炮, 视觉定格残态)。结算规则常量在 CAPITAL_CFG.turSpill。
this.turHp=[]; this.secHp=[]; this.aaHp=[];
for(let i=0;i<(S.main&&S.main.turHp?S.main.n:0);i++) this.turHp.push(S.main.turHp);
for(let i=0;i<(S.sec&&S.sec.turHp?S.sec.n:0);i++) this.secHp.push(S.sec.turHp);
for(let i=0;i<(S.aa&&S.aa.turHp?S.aa.n:0);i++) this.aaHp.push(S.aa.turHp);
this.crewBots=[];                                      // 甲板炮手 (capCrew* 家族, 2026-10-01c) —— 区别于乘员记账 this.crew
this.playerDriven=false;
this.tick=0; this.smokeT=0; this.fxT=0;
this.list=0; this.listTgt=0;
this.engine=(typeof AudioSys!=='undefined'&&AudioSys.createEngine)?AudioSys.createEngine('tank'):null;   // V4 (2026-10-04): 航行引擎声 (与 15d 小艇同一条 createEngine 单源)
this._wakeT=0;
// 巡航: route = [[x,z],…] 闭合折线 (≥3 点) 或往复直线 (2 点); 缺省/单点 = 锚定
this.route=(cfg.route&&cfg.route.length>=2)?cfg.route.map(p=>({x:p[0],z:p[1]})):null;
this.wpI=1; this.arriveR=CAPITAL_CFG.turnGap*S.hullL*0.5;
this.homeX=cfg.x; this.homeZ=cfg.z; this.homeYaw=cfg.yaw||0;
this.isBase=!!cfg.base;                                // 本队基地锚 (basePos 跟随)
this.deckFlags=[];                                     // 甲板旗点 (capitalFlagTick 填充)
// 乘员记账 (击杀归因): 与小艇同形但**没有 Bot** —— 大舰炮位是"舰上编制", 不是可阵亡单位
this.crew={ name:S.name, team, kills:0, deaths:0, score:0, isPlayer:false, isCrew:true,
            pos:this.pos, alive:true, lastFiredT:-99, damage(){}, vel:V3() };
this._src=S.name;
this.meshCapBuild();                                   // 建模型 (capBuildModel 单源)
this.respawnClear(cfg);                                // 落位 + 材质/状态复位
capitalShips.push(this);
}
// ── 建模: 15g 的工厂; 缺 15g 时退化为一个盒 (与 15d 的 navalFallbackModel 同一兜底纪律) ──
meshCapBuild(){
const S=this.spec;
this.R=(typeof capBuildModel==='function')?capBuildModel(S):capFallbackModel(S);
this.grp=this.R.grp; this.turrets=this.R.turrets; this.boxes=this.R.boxes;
this.deck=this.R.deck; this.hullHit=this.R.hull; this.cats=this.R.cats||[]; this.arrest=this.R.arrest||null;
this.worldMeshHull(this.grp);
}
worldMeshHull(g){
if(typeof world!=='undefined'&&world) world.add(g);
}
// ── 落位 / 复位 (开局与"世界还原"共用同一支: 复位后逐位等于开局) ──
respawnClear(cfg){
// ★2026-10-03: cfg 缺省 = 回**开局位姿** (homeX/homeZ/homeYaw 构造时盖章) —— 旧版 null 直接跳过落位,
//   capitalReset"复位后逐位等于开局"的契约在巡航过的舰上不成立 (残位陷阱: 世界还原后舰停在巡航
//   终点, 甲板旗/弹药箱/飞机跟着错位, 再开局等于接着上一局的残局打)。
this.pos.set(cfg?cfg.x:this.homeX,0,cfg?cfg.z:this.homeZ);
this.yaw=cfg?(cfg.yaw||0):(this.homeYaw||0);
this.homeX=this.pos.x; this.homeZ=this.pos.z;
this.pos.y=(typeof waterYAt==='function'?waterYAt(this.pos.x,this.pos.z):0)-this.spec.draft0;
this.hp=this.maxHp; this.alive=true; this.state='run'; this.flood=0;
// 掐火 (2026-10-03): 随舰火源跟着复位清账 —— 不然"复位后逐位等于开局"的契约下船还永久烧着
if(this.fireSrc){ if(typeof removeFireSource==='function') removeFireSource(this.fireSrc); this.fireSrc=null; }
this.spd=0; this.list=0; this.listTgt=0; this.smokeT=0; this.fxT=0;
for(let i=0;i<this.turYaw.length;i++){ this.turYaw[i]=0; this.turPitch[i]=0.02; this.mainCd[i]=rand(2,8); }
for(let i=0;i<this.secCd.length;i++) this.secCd[i]=rand(0.5,2);
for(let i=0;i<this.aaCd.length;i++) this.aaCd[i]=rand(0.3,1.5);
// 分炮塔血量复位 (2026-10-01b): 与结构值同账 (复位后逐位等于开局)
{
const S=this.spec;
for(let i=0;i<this.turHp.length;i++) this.turHp[i]=(S.main&&S.main.turHp)?S.main.turHp:0;
for(let i=0;i<this.secHp.length;i++) this.secHp[i]=(S.sec&&S.sec.turHp)?S.sec.turHp:0;
for(let i=0;i<this.aaHp.length;i++) this.aaHp[i]=(S.aa&&S.aa.turHp)?S.aa.turHp:0;
}
this.wpI=this.route?1:0;
this._px=this.pos.x; this._pz=this.pos.z; this._py=this.pos.y; this.velX=0; this.velZ=0;
this._riders=[];
this.matsRestore();
this._syncModel(0);
}
// ── 材质复位 / 残骸材质 (硬约束③: 每舰全新一套 ⇒ 直接换本舰的, 不碰别人) ──
matsRestore(){
if(!this.grp) return;
this.grp.traverse(o=>{ if(o.isMesh&&o.userData.mat0){ o.material=o.userData.mat0; o.userData.mat0=null; } });
this.list=0;
}
matsChar(){
if(!this.grp) return;
this.grp.traverse(o=>{ if(!o.isMesh) return;
if(!o.userData.mat0) o.userData.mat0=o.material;
o.material=capWreckMat();
});
}
// ══════════════════════════════════════════════════════════════════════════
// 八、巡航 (用户裁定③: 缓慢巡航; 走纯追踪 + 横向偏差回正, 端点不掉速)
// ══════════════════════════════════════════════════════════════════════════
cruiseStep(dt){
const S=this.spec;
let tgtSpd=0;
if(this.state==='run'&&this.route){
tgtSpd=S.spd*(1-CAPITAL_CFG.spdPerFlood*Math.min(1,this.flood));
const wp=this.route[this.wpI];
let dx=wp.x-this.pos.x, dz=wp.z-this.pos.z;
if(Math.hypot(dx,dz)<this.arriveR) this.wpI=(this.wpI+1)%this.route.length;
// 横向偏差回正 **只对两点往复航线启用** (2026-09-30): 多点航线是巡逻环, 弯道本来就要切 —— 从
//   "上一航点"量的横向偏差在弧段上不是小量, 强行回正会把船拽回折线角, 与纯追踪的提早转向打架。
//   两点往复是长直航道, 不拉回就会一路漂出去 (大舰转得慢, 切弯一次漂 30m+)。
const twoPt=(this.route.length===2);
let des=Math.atan2(dx,dz);
if(twoPt){
const pv=this.route[(this.wpI-1+this.route.length)%this.route.length];
const sx2=wp.x-pv.x, sz2=wp.z-pv.z, sl=Math.hypot(sx2,sz2)||1;
const ux=sx2/sl, uz=sz2/sl;
const cx=this.pos.x-pv.x, cz=this.pos.z-pv.z;
const cross=cx*uz-cz*ux;                                 // 左/右偏 (正值 = 偏左)
des-=clamp(cross*0.010,-0.45,0.45);
}
let d=angDiff(this.yaw,des);
this.yaw+=clamp(d,-S.turn*dt,S.turn*dt);
}
this.spd=dampF(this.spd,tgtSpd,CAPITAL_CFG.accel/Math.max(0.5,S.spd),dt);
if(this.spd>0.02){
const c=Math.cos(this.yaw), n=Math.sin(this.yaw);
this.pos.x+=n*this.spd*dt; this.pos.z+=c*this.spd*dt;
}
}
// ══════════════════════════════════════════════════════════════════════════
// 九、损伤 / 瘫痪链 (用户裁定②)
// ══════════════════════════════════════════════════════════════════════════
// tag 取 15g 的命中盒标签 ('hull'|'deck'|'sup'|'tur'|'fun'), 倍率取 spec.armor —— 分区装甲单源。
// 分炮塔结算 (2026-10-01b 用户裁定): 命中盒带 part/pi (15g 单源, 'main'|'sec'|'aa') ⇒ 命中炮位的伤
//   **先记进该炮位自己的血量**, 同时按 CAPITAL_CFG.turSpill 的比例溢出进舰体 (打炮塔不至于对瘫痪
//   舰体毫无贡献); 炮位打空 ⇒ 报废 (_partDead), 此后的命中按舷侧 'hull' 装甲区全额结算 (废塔不再是装甲)。
takeDmg(amt,attacker,ctx){
if(!this.alive||!amt) return 0;
if(typeof specRide==='function'&&specRide(this)) return 0;
const pa=(ctx&&ctx.part)?this._partHpArr(ctx.part):null;
const pi=(ctx&&ctx.pi!==undefined)?ctx.pi:-1;
const partKnown=(pa&&pi>=0&&pi<pa.length);
let tag=(ctx&&ctx.tag)||'hull';
// 废塔不再是装甲 (2026-10-01b): 炮位已报废后的命中按舷侧 'hull' 装甲区**全额**结算 ——
//   否则废塔还挂着 tur 的 0.22 倍率, "打坏了的炮塔"反而成了最硬的盾 (与裁定直接矛盾)。
if(partKnown&&pa[pi]<=0&&tag==='tur') tag='hull';
const zone=this.spec.armor[tag]!==undefined?this.spec.armor[tag]:1;
let dmg=amt*zone;
const hasPart=(partKnown&&pa[pi]>0);
if(hasPart&&!(ctx&&ctx.torpedo)){
pa[pi]-=dmg;
const spill=dmg*CAPITAL_CFG.turSpill;
this.hp-=spill;
this.flood=Math.min(1,this.flood+spill/this.maxHp*0.30);
if(attacker&&attacker.isPlayer&&typeof onPlayerHitAny==='function') onPlayerHitAny('shell');
if(pa[pi]<=0) this._partDead(ctx.part,pi,attacker);
if(this.hp<=0){ this.cripple(attacker); return dmg; }
if(spill>0&&(this.hp/this.maxHp)<CAPITAL_CFG.fireHp&&!this.fireSrc) this._ignite();
return dmg;
}
if(ctx&&ctx.torpedo){ dmg=amt; this.flood=Math.min(1,this.flood+0.22); this.listTgt=CAPITAL_CFG.listPerFlood*this.flood; }
else this.flood=Math.min(1,this.flood+dmg/this.maxHp*0.30);
this.hp-=dmg;
if(attacker&&attacker.isPlayer&&typeof onPlayerHitAny==='function') onPlayerHitAny('shell');
if(this.hp<=0){ this.cripple(attacker); return dmg; }
if(dmg>0&&(this.hp/this.maxHp)<CAPITAL_CFG.fireHp&&!this.fireSrc) this._ignite();
return dmg;
}
_partHpArr(type){
if(type==='main') return this.turHp;
if(type==='sec') return this.secHp;
if(type==='aa') return this.aaHp;
return null;
}
// 炮位报废: 一次性定格 —— 姿态残态 (主炮塔转舷侧+下垂 / 副炮防空管口下垂) + 焦黑材质 + 冷却置满。
//   玩家正接管该炮位 ⇒ 就地退炮。AI 火控与开火函数按各自血量守卫跳过 (见 aiTick / fireMainSalvo…)。
_partDead(type,idx,attacker){
const pa=this._partHpArr(type); if(!pa) return;
if(pa[idx]!==undefined&&pa[idx]>0) pa[idx]=0;      // 血量清零 (负值也钉在 0)
const nm=(type==='main')?(this.spec.main&&this.spec.main.name):(type==='sec')?(this.spec.sec&&this.spec.sec.name):(this.spec.aa&&this.spec.aa.name);
if(type==='main'){
if(this.mainCd[idx]!==undefined) this.mainCd[idx]=1e9;
this.turYaw[idx]=(idx%2?-1:1)*0.55; this.turPitch[idx]=-0.30;   // 断电残态: 偏舷 + 炮口低垂
const t=this.turrets[idx];
if(t&&t.yawG) t.yawG.traverse(o=>{ if(o.isMesh&&!o.userData.mat0){ o.userData.mat0=o.material; o.material=capWreckMat(); } });
}else{
if(type==='sec'){ if(this.secCd[idx]!==undefined) this.secCd[idx]=1e9; const m=this.R.secMounts[idx];
if(m){ m.yawG.rotation.y=(idx%2?-1:1)*0.7; m.pitchG.rotation.x=0.85;
m.yawG.traverse(o=>{ if(o.isMesh&&!o.userData.mat0){ o.userData.mat0=o.material; o.material=capWreckMat(); } }); } }
else{ if(this.aaCd[idx]!==undefined) this.aaCd[idx]=1e9; const m=this.R.aaMounts[idx];
if(m){ m.yawG.rotation.y=(idx%2?1:-1)*0.7; m.pitchG.rotation.x=0.9;
m.yawG.traverse(o=>{ if(o.isMesh&&!o.userData.mat0){ o.userData.mat0=o.material; o.material=capWreckMat(); } }); } }
}
// 玩家正在接管该炮位 ⇒ 就地退炮 (废炮坐不了人)
if(typeof player!=='undefined'&&player&&player.capitalGun&&player.capitalGun.ship===this&&player.capitalGun.type===type&&player.capitalGun.idx===idx)
capGunRelease(true);
// 炮手随炮位阵亡 (2026-10-01c"炮塔内部也没有 Bot"的收官): 打废一座炮 = 塔里的人也没了。
//   压掉战报行 (_noFeed, 与车毁乘员同款) —— 炮位摧毁行已经发过, 别一座炮刷两条。
if(this.crewBots) for(const cb of this.crewBots){
if(cb.alive&&cb.capCrew&&cb.capCrew.type===type&&cb.capCrew.idx===idx){ cb._noFeed=true; try{ cb.die(attacker||null,false); } finally{ cb._noFeed=false; } }
}
if(typeof addKillMsg==='function'&&nm) addKillMsg(t('{0} 的 {1} 被摧毁',this.name,nm),1-this.team);
if(attacker&&attacker.isPlayer&&typeof showScorePop==='function') showScorePop(t('摧毁 {0}',nm||'炮位'),0);
}
// 瘫痪 = 一次性定格 (永久; 不沉、不移除、不重生)
// ★2026-10-01b 用户裁定改版: 瘫痪舰 = **无阵营的陆地** —— 甲板旗点就地转灰/中立 (不可再占领),
//   不再作为重生点 (capFlagActive/capBasePos 单源过滤), 只剩可站立/可通行的地形价值。
cripple(attacker){
if(this.state==='crippled') return;
this.hp=0; this.state='crippled'; this.alive=true; this.spd=0;
this.flood=Math.max(this.flood,0.55); this.listTgt=CAPITAL_CFG.listPerFlood*this.flood;
// 全部炮位报废: 血量清零 (接管/开火守卫全按它走) + 塔转向舷侧/下垂定格 (读作"打废了"), 冷却置满
for(let i=0;i<this.turHp.length;i++) this.turHp[i]=0;
for(let i=0;i<this.secHp.length;i++) this.secHp[i]=0;
for(let i=0;i<this.aaHp.length;i++) this.aaHp[i]=0;
for(let i=0;i<this.turYaw.length;i++){ this.turYaw[i]=(i%2?-1:1)*0.9; this.turPitch[i]=-0.16; this.mainCd[i]=1e9; }
for(let i=0;i<this.secCd.length;i++) this.secCd[i]=1e9;
for(let i=0;i<this.aaCd.length;i++) this.aaCd[i]=1e9;
this.matsChar();
// 全员炮手随舰阵亡 (2026-10-01c): 瘫舰上不留编制 (与"全员炮位报废"同账)
if(this.crewBots) for(const cb of this.crewBots){
if(cb.alive){ cb._noFeed=true; try{ cb.die(null,false); } finally{ cb._noFeed=false; } }
}
// 航母瘫痪 ⇒ 停放的舰载机紧急弹射离舰 (总不能跟着舰一起变废铁)
if(this.cls==='cv'&&typeof planes!=='undefined') for(const pl of planes){
if(pl&&pl.alive&&pl.capArrest===this) capLaunchPlane(pl,true);
}
// 甲板旗点就地中立化 (用户裁定: 无法被占领 / 标识变灰): owner 归 -1、进度清零、旗面重绘为灰
for(const f of this.deckFlags){
f.owner=-1; f.cap=0; f.capTeam=-1; f.present=[0,0];
if(typeof drawFlagTex==='function') drawFlagTex(f);
}
const c=this.pos.clone(); c.y+=this.deck.y;
explosionFX(c);
if(typeof AudioSys!=='undefined') AudioSys.explosion(c.distanceTo(camera.position)*1.2);
for(const an of (this.R.nodes.smokeAnchors||[])) this._smokeAt(an,6,2.2);
this._ignite();
// 票数与战果 (反舰战果与小艇同一条记账链)
const sc=(typeof SCORE_TABLE!=='undefined'&&SCORE_TABLE.tank)||300;
if(attacker&&attacker.kills!==undefined) attacker.kills++;
if(attacker&&attacker.isPlayer&&typeof registerKillScore==='function') registerKillScore('瘫痪大舰',sc);
// 瘫舰红档 (2026-10-04 修复批 U9): 与击落战机/车毁同一条"大目标击杀"反馈 —— 玩家打瘫敌舰给红色
//   击杀档, 旧版只有得分弹字, 击杀感缺失。
if(attacker&&attacker.isPlayer&&typeof onPlayerWreck==='function') onPlayerWreck();
if(typeof addKillMsg==='function') addKillMsg(t('{0} 被瘫痪',this.name),1-this.team);
if(typeof tickets!=='undefined'&&tickets){ tickets[this.team]=Math.max(0,tickets[this.team]-this.spec.ticket); }
// 玩家炮位强制下炮
if(typeof player!=='undefined'&&player&&player.onCapital===this) capSeatRelease();
}
_ignite(){
if(this.fireSrc) return;
const n=this.R.nodes.smokeAnchors&&this.R.nodes.smokeAnchors.length?this.R.nodes.smokeAnchors:null;
const an=n?n[0]:{position:{x:0,y:0,z:0}};   // 无烟囱锚退化为舰心 (局部 0,0,0, 与旧版同点)
const p=capAnchorWorld(this,an);
// ★2026-10-03 修"船开走火/烟浮空": 火源带 follow 锚 (updateFires 每帧重投影)。hp<fireHp 时舰**还在航行**
//   (15h:553/561 两处点火), 旧版把世界坐标一次烤死, 船一开火源就漂在原地 —— 火焰/烟雾全浮空。
this.fireSrc=(typeof addFireSource==='function')?addFireSource(p.x,p.z,p.y,6.5,1e9,30,this.crew,{ship:this,an}):null;
}
_smokeAt(an,count,scale){
const p=capAnchorWorld(this,an);
for(let i=0;i<count;i++) spawnP(PT.dark,p.x+rand(-2,2),p.y+rand(0,2),p.z+rand(-2,2),rand(-1,1),rand(1.6,3.4),rand(-1,1),scale,4.5,rand(1.6,2.6),0.75,0.25);
}
// ══════════════════════════════════════════════════════════════════════════
// 十、武器
// ══════════════════════════════════════════════════════════════════════════
_shooter(){
// 炮位接管期间的击杀/命中归因 (2026-10-01b): 谁的手在开炮就记谁 —— 与小艇/坦克 playerDriven 同规
if(typeof player!=='undefined'&&player&&player.capitalGun&&player.capitalGun.ship===this) return player;
return this.playerDriven?player:this.crew;
}
// 炮位报废守卫 (2026-10-01b): 三型开火函数共用 —— 报废的炮不再出弹 (AI/玩家接管两侧都挡)
_gunAlive(type,idx){
const pa=this._partHpArr(type);
return !(pa&&pa[idx]!==undefined&&pa[idx]<=0);
}
// 主炮炮口世界坐标 (塔 i 的第 j 管): 塔 yaw → 舰 yaw 两级旋转, 与 _syncModel 的层级逐级对应
mainMuzzleWorld(i,j,out){
const M=this.spec.main, ty=this.turYaw[i], tp=this.turPitch[i];
const sx=(j-(M.guns-1)/2)*M.gunSx, barL=M.ringR*3.1;
const cp2=Math.cos(tp), sp=Math.sin(tp);
const bx=sx*cp2, by=barL*sp, bz=barL*cp2;
const ct=Math.cos(ty), st=Math.sin(ty);
const lx=bx*ct+bz*st, ly=by+M.y[i], lz=-bx*st+bz*ct+M.ringZ[i];
const w=capToWorld(this,lx,lz,_capW);
out=out||V3(); out.set(w.x,this.pos.y+ly,w.z); return out;
}
mountLocalWorld(md,out){
const w=capToWorld(this,md.lx,md.lz,_capW);
out=out||V3(); out.set(w.x,this.pos.y+md.y,w.z); return out;
}
// 主炮齐射 (整塔 n 管同时打出): 走全库共用的 shells 管线 ⇒ 命中/入水/结构破坏/击杀归因全部现成
// tgtEnt (2026-10-04 B1): 可选的实体目标 —— 传了就取其速度做提前量 (capTgtVel 单源);
//   玩家接管主炮打"视线落点"时不传 ⇒ 无提前量的诚实弹道 (与手打坦克炮同规)。
fireMainSalvo(i,targetPos,tgtEnt){
const M=this.spec.main;
if(this.state!=='run'||this.mainCd[i]>0||!this._gunAlive('main',i)) return false;
this.mainCd[i]=M.rof;
const shooter=this._shooter(); shooter._src=this.name;
const aim=capBallistic(this,M,targetPos,i,(tgtEnt&&tgtEnt.pos)?capTgtVel(tgtEnt,_capBallV):null);
if(!aim) return false;
const o=V3();
for(let j=0;j<M.guns;j++){
this.mainMuzzleWorld(i,j,o);
const d=aim.clone();
d.x+=rand(-1,1)*M.disp*CAPITAL_CFG.salvoDisp; d.y+=rand(-1,1)*M.disp*CAPITAL_CFG.salvoDisp*0.6; d.z+=rand(-1,1)*M.disp*CAPITAL_CFG.salvoDisp;
d.normalize();
shells.push({pos:o.clone(),vel:d.multiplyScalar(M.spd),team:this.team,owner:shooter,
life:3.6,kind:'naval',dmgV:M.dmg,trail:0,src:this.name,capTag:'hull'});
}
if(typeof AudioSys!=='undefined') AudioSys.cannon(this.pos.distanceTo(camera.position)*1.0);
if(shooter&&shooter.isPlayer&&typeof addTrauma==='function') addTrauma(0.5);   // 玩家主炮后座 (与 15d 小艇主炮同档 0.5)
// 齐射炮口焰逐管 (2026-10-04 修复批 V6): 旧版只在 0 号管出一团火 —— 3 管齐射读作"只有中间那根在响"。
//   硝烟保持塔心一团 (每管一朵的粒子预算不值)。
for(let j=0;j<M.guns;j++){
const p=this.mainMuzzleWorld(i,j,V3());
spawnP(PT.flash,p.x,p.y,p.z,0,0,0,3.0,14,0.16,1,0,true);
}
const p=this.mainMuzzleWorld(i,0,V3());
for(let k=0;k<5;k++) spawnP(PT.dark,p.x+rand(-3,3),p.y+0.5,p.z+rand(-3,3),rand(-2,2),rand(1.5,3),rand(-2,2),1.6,4.5,rand(1.4,2.2),0.7,0.4);
shooter.lastFiredT=nowT;
if(typeof gunEvents!=='undefined') gunEvents.push({x:p.x,z:p.z,team:this.team,t:nowT,shooter});
return true;
}
// 炮口出膛偏移 (2026-10-04 修复批 V5): 旧版弹体出生在座圈基座中心 (mountLocalWorld) —— 副炮弹从
//   甲板室里/炮座里出生, 贴脸目标与掠舷弹道会先撞自家结构, 读作"炮在响但没有弹"。出生点沿最终
//   射向推到炮口 (副炮身管 ~2.6m / 防空 ~1.9m, 对齐 15g 建模的身管长度档)。
// 副炮: 对海/对空双用 (走 fireBullet 扇面 —— 与 15d 的 fireSecondary 同一条链); gi = 座圈索引 (报废守卫)
fireSecondary(md,dir,gi){
const S=this.spec.sec; if(!S||this.state!=='run') return false;
if(!this._gunAlive('sec',gi===undefined?this.R.secMounts.indexOf(md):gi)) return false;
const shooter=this._shooter(); shooter._src=this.name;
const o=this.mountLocalWorld(md,V3());
let d=dir?dir.clone():V3(Math.sin(this.yaw),0,Math.cos(this.yaw));
d.x+=rand(-1,1)*0.012; d.y+=rand(-1,1)*0.010; d.z+=rand(-1,1)*0.012; d.normalize();
o.addScaledVector(d,CAP_SEC_MUZZLE);
fireBullet(shooter,o,d,{dmg:S.dmg,headMul:1.9,snd:'mg',tracer:2,vehDmg:S.dmg*0.22},o);
shooter.lastFiredT=nowT;
return true;
}
// 防空: 走高炮弹管线 (fireFlak 在 16-aircraft) —— 与固定高炮同一支弹道与判定; gi = 座圈索引 (报废守卫)
fireAA(md,dir,gi){
const A=this.spec.aa; if(!A||this.state!=='run') return false;
if(!this._gunAlive('aa',gi===undefined?this.R.aaMounts.indexOf(md):gi)) return false;
const shooter=this._shooter(); shooter._src=this.name;
const o=this.mountLocalWorld(md,V3());
const d=dir.clone();
d.x+=rand(-1,1)*0.020; d.y+=rand(-1,1)*0.016; d.z+=rand(-1,1)*0.020; d.normalize();
o.addScaledVector(d,CAP_AA_MUZZLE);
if(typeof fireFlak==='function'){ fireFlak(o,shooter,d); shooter.lastFiredT=nowT; }
else{ fireBullet(shooter,o,d,{dmg:A.dmg,headMul:1.5,snd:'mg',tracer:2,vehDmg:0,noAirHit:true},o); shooter.lastFiredT=nowT; }
return true;
}
// ══════════════════════════════════════════════════════════════════════════
// 十一、AI 火控 (舰炮对决 + 副炮扫海 + 防空)
// ══════════════════════════════════════════════════════════════════════════
aiTick(dt){
if(this.state!=='run') return;
// 玩家接管的炮位 AI 不碰 (2026-10-01b): 座圈由 capGunTick 驱动, AI 双手拿开
const pg=(typeof player!=='undefined'&&player&&player.capitalGun&&player.capitalGun.ship===this)?player.capitalGun:null;
for(let i=0;i<this.mainCd.length;i++) if(this.mainCd[i]>0&&this.mainCd[i]<1e8) this.mainCd[i]-=dt;
for(let i=0;i<this.secCd.length;i++) if(this.secCd[i]>0&&this.secCd[i]<1e8) this.secCd[i]-=dt;
for(let i=0;i<this.aaCd.length;i++) if(this.aaCd[i]>0&&this.aaCd[i]<1e8) this.aaCd[i]-=dt;
// ① 主炮: 打敌方大舰 (无舰则在 420m 内打小艇); 血量≤0 的塔保持残态不参战
const foe=this._pickShipTarget();
if(foe){
for(let i=0;i<this.turYaw.length;i++){
if(this.turHp[i]!==undefined&&this.turHp[i]<=0) continue;
if(pg&&pg.type==='main'&&pg.idx===i) continue;
const mv=this.mainMuzzleWorld(i,0,V3());
const dx=foe.pos.x-mv.x, dz=foe.pos.z-mv.z;
const want=Math.atan2(dx,dz)-this.yaw;
this.turYaw[i]+=clamp(angDiff(this.turYaw[i],want),-0.35*dt,0.35*dt);
const pit=capBallisticPitch(this.spec.main,mv,capAimPoint(foe),0);
this.turPitch[i]=dampF(this.turPitch[i],pit,1.2,dt);
const d2=dx*dx+dz*dz;
if(d2<CAPITAL_CFG.mainR*CAPITAL_CFG.mainR&&Math.abs(angDiff(this.turYaw[i],want))<0.06&&this.mainCd[i]<=0)
this.fireMainSalvo(i,capAimPoint(foe),foe);            // B1 (2026-10-04): 实体目标入参 ⇒ 主炮提前量真正生效
}
}
// ② 副炮/防空: 副炮打 480m 内小艇; 防空打 240m 内敌机
const tgtCraft=this._pickCraftTarget();
for(let i=0;i<this.R.secMounts.length;i++){
if(this.secHp[i]!==undefined&&this.secHp[i]<=0) continue;
if(pg&&pg.type==='sec'&&pg.idx===i) continue;
const md=this.R.secMounts[i];
const o=this.mountLocalWorld(md,V3());
const tgt=tgtCraft||foe;                               // 副炮对海双用: 小艇优先, 无艇则帮主炮补大舰
if(!tgt) break;
const dist=Math.hypot(o.x-tgt.pos.x,o.z-tgt.pos.z);
if(dist>(this.spec.secR||CAPITAL_CFG.secR)) continue;  // F2 (2026-10-04): 航母走 spec 级副炮交战门
const lead=capLeadPoint(tgt,o,this.spec.sec.spd);
const dyaw=Math.atan2(lead.x-o.x,lead.z-o.z)-this.yaw;
this.secAimY[i]+=clamp(angDiff(this.secAimY[i],dyaw),-0.9*dt,0.9*dt);
this.secAimP[i]=dampF(this.secAimP[i],Math.atan2(lead.y-o.y,dist),1.6,dt);
if(this.secCd[i]>0) continue;
if(Math.abs(angDiff(this.secAimY[i],dyaw))>0.10) continue;   // 没转到位不开火 (读作"人在操炮")
this.secCd[i]=this.spec.sec.rof*(1+(i%2)*0.18);
this.fireSecondary(md,V3(lead.x-o.x,lead.y-o.y,lead.z-o.z).normalize(),i);
}
const foeP=this._pickPlaneTarget();
for(let i=0;i<this.R.aaMounts.length;i++){
if(this.aaHp[i]!==undefined&&this.aaHp[i]<=0) continue;
if(pg&&pg.type==='aa'&&pg.idx===i) continue;
const md=this.R.aaMounts[i];
const o=this.mountLocalWorld(md,V3());
if(!foeP) break;
const dist=Math.hypot(o.x-foeP.pos.x,o.z-foeP.pos.z);
// 瞄准圈 vs 开火圈分档 (2026-10-01d, 实机"航母上的小炮无法转向和开火"): 开火圈 aaR=170 是
//   2026-10-01 平衡裁定不动; 但旧版 170m 外连**转都不转**, 远圈炮位读作死件。现在 420m 内
//   照常跟踪瞄准 (转得着 = 炮活着), 进开火圈即已有诸元, 出弹更快。
if(dist>CAPITAL_CFG.aaAimR) continue;
const lead=capLeadPoint(foeP,o,this.spec.aa.spd);
const dyaw=Math.atan2(lead.x-o.x,lead.z-o.z)-this.yaw;
// 舷角闸门 (2026-10-01 实机"大和的防空火力太强"): 目标舷角超出 CAPITAL_CFG.aaArc 时, 背舷炮位不参战 ——
//   史实舰炮各打各舷; 不设此门则全舰 6~8 座一起把炮转过去开火 (30+ 发/秒) 让舰载机进圈即碎。
//   ★2026-10-01d: 舷角按**舰体中心**取 (旧版按炮位自身) —— 死艉线/艏线上的目标从炮位看永远"偏在
//   对舷" (炮位自身有 12m 横向偏置), 艏艉接近线上全部炮位被闸成哑巴; 按舰心取则目标真在何舷,
//   何舷炮位参战, 艏艉窄角由 |rel|≤aaArc 的全开门覆盖。
const rel=angDiff(this.yaw,Math.atan2(lead.x-this.pos.x,lead.z-this.pos.z));
if(Math.abs(rel)>CAPITAL_CFG.aaArc&&(rel>0)!==(md.lx>=0)) continue;
this.aaAimY[i]+=clamp(angDiff(this.aaAimY[i],dyaw),-1.3*dt,1.3*dt);
this.aaAimP[i]=dampF(this.aaAimP[i],Math.atan2(lead.y-o.y,Math.max(1,dist)),1.8,dt);
if(this.aaCd[i]>0) continue;
if(dist>CAPITAL_CFG.aaR) continue;
if(Math.abs(angDiff(this.aaAimY[i],dyaw))>0.16) continue;
this.aaCd[i]=this.spec.aa.rof*(1+(i%3)*0.15);
this.fireAA(md,V3(lead.x-o.x,lead.y-o.y,lead.z-o.z).normalize(),i);
}
}
// 主炮/舰炮索敌门 (2026-10-04 修复批 F2 CV 死局): 有主炮的舰用 mainR; 航母 (main:null) 的唯一对舰
//   火力是副炮 —— 索敌门按 spec.secR (缺省 CAPITAL_CFG.secR) 走, 否则珊瑚海敌 BB 环心 516m <
//   mainR 620 恒被白打, 而自己 480m 副炮够不着 = 全程纯靶子。
_shipEngageR(){
return this.spec.main?CAPITAL_CFG.mainR:(this.spec.secR||CAPITAL_CFG.secR);
}
_pickShipTarget(){
let best=null,bd=1e9;
const R=this._shipEngageR();
for(const s of capitalShips){
if(s===this||s.team===this.team) continue;
const d=this.pos.distanceTo(s.pos);
if(d<bd){ bd=d; best=s; }
}
return (best&&bd<R)?best:null;
}
_pickCraftTarget(){
let best=null,bd=1e9;
const R=this.spec.secR||CAPITAL_CFG.secR;
for(const c of (typeof navalCraft!=='undefined'?navalCraft:[])){
if(!c.alive||c.team===this.team||c.state==='sinking'||c.state==='wreck') continue;
if(typeof specRide==='function'&&specRide(c)) continue;
const d=this.pos.distanceTo(c.pos);
if(d<bd){ bd=d; best=c; }
}
return (best&&bd<R)?best:null;
}
_pickPlaneTarget(){
// 索敌圈 = **瞄准圈** aaAimR (2026-10-01d): 旧版按开火圈 aaR 索敌 ⇒ 170m 外连目标都拿不到,
//   "420m 内跟踪瞄准" (aiTick AA 段) 成了死字 —— 远圈炮位依旧读作死件。开火圈由 AA 段的
//   dist>aaR 门独自执法, 这里的圈只决定"看不看得到"。
let best=null,bd=1e9;
for(const p of (typeof planes!=='undefined'?planes:[])){
if(!p.alive||p.team===this.team) continue;
const d=this.pos.distanceTo(p.pos);
if(d<bd){ bd=d; best=p; }
}
return (best&&bd<CAPITAL_CFG.aaAimR)?best:null;
}
// ══════════════════════════════════════════════════════════════════════════
// 十二、姿态 / 同步 / 特效
// ══════════════════════════════════════════════════════════════════════════
_attitude(dt){
this.list=dampF(this.list,this.listTgt,1.1,dt);         // 瘫舰横倾: 一次性定格的常量角, 不参与甲板解算 (见头注释二)
}
_syncModel(dt){
const g=this.grp; if(!g) return;
g.position.set(this.pos.x,this.pos.y,this.pos.z);
// 欧拉序 XYZ: 先绕局部 z (舰艏轴) 横倾, 再绕 y 转艏 —— 与"横倾是绕纵轴"的物理读法一致。
// list 单位是**度** (CAPITAL_CFG.listPerFlood), 这里换弧度; 巡航态 list≡0 (零横纵摇, 见头注释二)。
g.rotation.set(0,this.yaw,this.list*DEG);
for(let i=0;i<this.turrets.length;i++){
const t=this.turrets[i];
if(this.turHp[i]!==undefined&&this.turHp[i]<=0) continue;   // 报废塔: 残态定格 (_partDead 写过最后一帧), 不再被姿态链覆写
t.yawG.rotation.y=this.turYaw[i];
t.pitchG.rotation.x=-this.turPitch[i];
}
for(let i=0;i<this.R.secMounts.length;i++){
if(this.secHp[i]!==undefined&&this.secHp[i]<=0) continue;   // 报废炮位: 同上
const m=this.R.secMounts[i];
m.yawG.rotation.y=this.secAimY[i]||0;
m.pitchG.rotation.x=-(this.secAimP[i]||0);
}
for(let i=0;i<this.R.aaMounts.length;i++){
if(this.aaHp[i]!==undefined&&this.aaHp[i]<=0) continue;     // 报废炮位: 同上
const m=this.R.aaMounts[i];
m.yawG.rotation.y=this.aaAimY[i]||0;
m.pitchG.rotation.x=-(this.aaAimP[i]||0);
}
}
_damageFx(dt){
const r=this.hp/this.maxHp;
if(this.state==='run'&&r<CAPITAL_CFG.smokeHp){
this.smokeT-=dt;
if(this.smokeT<=0){
this.smokeT=0.18;
// ★2026-10-04 (海战审计 V8): 旧版只从 0 号烟囱锚冒烟 —— 双烟囱舰 (bb 前后机炉舱) 只有前烟囱冒烟,
//   读作"后半条船没坏"。受损/瘫痪烟逐锚都出 (锚数 2~4, 粒子预算可忽略)。
const anchors=this.R.nodes.smokeAnchors&&this.R.nodes.smokeAnchors.length?this.R.nodes.smokeAnchors:[null];
for(let i=0;i<anchors.length;i++){
const an=anchors[i];
const p=an?capAnchorWorld(this,an):this.pos;
spawnP(PT.dark,p.x+rand(-3,3),p.y+rand(0,3),p.z+rand(-3,3),rand(-1,1),rand(1.2,2.6),rand(-1,1),1.4,4,rand(1.4,2.2),0.7,0.3);
}
}
}
if(this.state==='crippled'&&Math.random()<dt*3.2){
const anchors=this.R.nodes.smokeAnchors&&this.R.nodes.smokeAnchors.length?this.R.nodes.smokeAnchors:[null];
for(let i=0;i<anchors.length;i++){
const an=anchors[i];
const p=an?capAnchorWorld(this,an):this.pos;
spawnP(PT.dark,p.x+rand(-6,6),p.y+rand(1,5),p.z+rand(-6,6),rand(-1.2,1.2),rand(1.4,3),rand(-1.2,1.2),2.0,5,rand(1.6,2.6),0.7,0.25);
}
}
}
// 每帧主更新 (noAI: 菜单航拍期只巡航不开火 —— 见 updateCapital 的停战守卫)
step(dt,noAI){
const wasX=this.pos.x, wasZ=this.pos.z, wasY=this.pos.y, wasYaw=this.yaw;
this.cruiseStep(dt);
if(!noAI) this.aiTick(dt);
this._attitude(dt);
this._damageFx(dt);
this._syncModel(dt);
// 引擎声 + 航行尾迹 (2026-10-04 修复批 V4: 旧版大舰零水花零引擎声 —— 24000 吨的东西开起来像贴图)。
//   时停/停战帧 (dt<=0) 引擎静音, 与 15d 残骸态"不出声不重建节点"同口径; 尾迹只在巡航态出,
//   粒子有相机距离门 (260m) 不吃全局预算。
if(this.engine){
if(dt>0) this.engine.update(52+this.spd*9, clamp(0.30-this.pos.distanceTo(camera.position)/320,0,0.30));
else this.engine.update(0,0);
}
if(dt>0&&this.state==='run'&&this.spd>1.2){
this._wakeT-=dt;
if(this._wakeT<=0){
this._wakeT=0.12;
if(this.pos.distanceTo(camera.position)<260){
const wy=(typeof waterYAt==='function')?waterYAt(this.pos.x,this.pos.z):-1e9;
if(wy>-1e8){
const sn=Math.sin(this.yaw), cs=Math.cos(this.yaw), bl=this.spec.hullL*0.5;
spawnP(PT.drop,this.pos.x-sn*bl+rand(-2.5,2.5),wy+0.08,this.pos.z-cs*bl+rand(-2.5,2.5),rand(-0.4,0.4),0.05,rand(-0.4,0.4),rand(1.2,2.0),2.2,1.6,0.30,0);
spawnP(PT.drop,this.pos.x+sn*bl*0.92+rand(-1.5,1.5),wy+0.10,this.pos.z+cs*bl*0.92+rand(-1.5,1.5),rand(-0.6,0.6),rand(0.3,0.9),rand(-0.6,0.6),rand(0.8,1.4),1.4,0.9,0.36,0);
}
}
}
}
const idt=1/Math.max(dt,1e-3);
this.velX=(this.pos.x-wasX)*idt; this.velZ=(this.pos.z-wasZ)*idt;      // 本帧速度 (主炮提前量)
this._px=wasX; this._pz=wasZ; this._py=wasY; this._pyaw=wasYaw;   // 上一帧位姿 (乘员搬运的"移动前")
}
}
// 兜底模型 (15g 缺失时): 一个与 spec 同尺寸的盒 + 甲板面 —— 保证物理/甲板/命中链可跑, 只是不好看
function capFallbackModel(S){
const g=new THREE.Group();
const m=new THREE.Mesh(new THREE.BoxGeometry(S.hullW,S.hullH,S.hullL),new THREE.MeshLambertMaterial({color:S.col}));
m.position.set(0,S.hullH*0.5,0); m.name='capFallbackHull'; g.add(m);
return { grp:g, turrets:[], secMounts:[], aaMounts:[], cats:[], arrest:null, boxes:[],
         hull:{ r:S.hullW*0.5, y0:0, y1:S.hullH*0.94, ax:0, az:-S.hullL*0.44, bx:0, bz:S.hullL*0.44 },
         deck:{ y:S.hullH, hw:S.deckHW, hl:S.deckHL },
         nodes:{ smokeAnchors:[] }, dims:{L:S.hullL,W:S.hullW,H:S.hullH,draft0:S.draft0,deckY:S.deckY} };
}
function R_none(R){ return R.arrest||null; }
// 锚点世界坐标 (烟囱口等 Object3D): 用舰体位姿手算 —— 不依赖 grp 的 matrixWorld (沙箱里 updateMatrixWorld 是桩)
function capAnchorWorld(s,an){
const c=Math.cos(s.yaw), n=Math.sin(s.yaw);
const ax=an.position.x, az=an.position.z;
return V3(s.pos.x+ax*c+az*n, s.pos.y+an.position.y, s.pos.z-ax*n+az*c);
}

// ══════════════════════════════════════════════════════════════════════════
// 十三、弹道解算 (舰炮是抛物线: 先解飞行时间, 再解初速方向)
// ══════════════════════════════════════════════════════════════════════════
// 0.25g²u² + (dy·g − spd²)u + (R²+dy²) = 0  (u = t²) —— 取小根 (平直弹道), 无解 ⇒ 不可及
function capFlightTime(R,dy,spd,g){
const a=0.25*g*g, b=dy*g-spd*spd, c=R*R+dy*dy;
const disc=b*b-4*a*c;
if(disc<0) return -1;
const u=(-b-Math.sqrt(disc))/(2*a);
return u>0?Math.sqrt(u):-1;
}
// 瞄准点: 目标中心抬到其甲板/干舷高度, 并加提前量 (目标自己也在动)
function capAimPoint(t){
// 瞄点 = 水线与主甲板之间的中线 (旧版给 y = pos.y+deck.y*0.55 = 甲板面之上 55% ⇒ 打高了一整层,
//   实测瞄点在舷侧装甲带上方 ~3.5m —— 舰炮对决的落点全在目标头顶)
if(t&&t.kind==='capital'){ const S=t.spec; return V3(t.pos.x,t.pos.y+(S.draft0+S.deckY)*0.5,t.pos.z); }
return t&&t.pos?t.pos.clone():V3();
}
function capBallistic(ship,M,targetPos,ti,vel){
const mv=ship.mainMuzzleWorld(ti,0,V3());
const g=SHELL_G;
let tx=targetPos.x, ty=targetPos.y, tz=targetPos.z;
for(let it=0;it<3;it++){
const dx=tx-mv.x, dy=ty-mv.y, dz=tz-mv.z, R=Math.hypot(dx,dz);
const t=capFlightTime(R,dy,M.spd,g);
if(t<0) return null;
const vx=dx/t, vy=(dy+0.5*g*t*t)/t, vz=dz/t;
if(it===2) return V3(vx,vy,vz).normalize();
// 提前量: 目标速度 × 飞行时间 (大舰巡航 4m/s ⇒ 500m 上约 3 个身位)
// ★2026-10-04 (海战审计 B1 死代码修复): 旧版读 targetPos.velX / targetPos.vx —— 但传入的一直是
//   capAimPoint 的**纯 V3 克隆**, 两个分支都是死路, 主炮提前量自始至终没生效过。速度现由调用方经
//   capTgtVel 显式传入 (实体目标), 玩家接管主炮打"视线落点"时不传 ⇒ 保持无提前量的诚实弹道。
if(vel&&(vel.x||vel.z)){ tx=targetPos.x+vel.x*t; tz=targetPos.z+vel.z*t; }
else return V3(vx,vy,vz).normalize();
}
return null;
}
function capBallisticPitch(M,mv,targetPos){
const dx=targetPos.x-mv.x, dy=targetPos.y-mv.y, dz=targetPos.z-mv.z, R=Math.hypot(dx,dz);
const t=capFlightTime(R,dy,M.spd,SHELL_G);
if(t<0) return 0.02;
const vx=R/t, vy=(dy+0.5*SHELL_G*t*t)/t;
return Math.atan2(vy,vx);
}
// ── 目标速度向量单源 (2026-10-04 修复批 A1/B12) ──
// 三类目标的速度载体各不相同, 旧 capLeadPoint 只认其中一种:
//   · 大舰: step() 每帧写 velX/velZ (标量分量, 没有 vel 对象);
//   · 小艇 (15d): vel 是**标量速率**, 方向在航向里 —— 旧版读 vel.x 得 undefined ⇒ 提前量整链 NaN,
//     副炮瞄艇的诸元/转角全变 NaN (炮塔僵死);
//   · 飞机 (16-aircraft): 没有 vel 字段, 只有 velVec() 方法 —— 旧版落 0 ⇒ 大舰防空零提前量,
//     只打得中迎头直飞的机 (B12)。
// 火控每炮每帧调用, out 复用调用方槽位, 热路径上不造对象。
function capTgtVel(tgt,out){
out=out||{x:0,y:0,z:0};
out.x=0; out.y=0; out.z=0;
if(!tgt||!tgt.pos) return out;
if(tgt.velX!==undefined){ out.x=tgt.velX; out.y=tgt.velY||0; out.z=tgt.velZ||0; }
else if(tgt.kind==='plane'&&typeof tgt.velVec==='function'){ const v=tgt.velVec(); out.x=v.x; out.y=v.y; out.z=v.z; }
else if(typeof tgt.vel==='number'){ const sp=tgt.vel, c=Math.cos(tgt.yaw||0), n=Math.sin(tgt.yaw||0); out.x=n*sp; out.z=c*sp; }
else if(tgt.vel){ out.x=tgt.vel.x||0; out.y=tgt.vel.y||0; out.z=tgt.vel.z||0; }
return out;
}
const _capLeadV={x:0,y:0,z:0}, _capBallV={x:0,y:0,z:0};
// 副炮/防空炮口出膛距离 (V5 2026-10-04, 单源常量: fireSecondary/fireAA 沿射向前推到炮口)
const CAP_SEC_MUZZLE=2.6, CAP_AA_MUZZLE=1.9;
// 副炮/防空的简单提前量 (弹速恒定, 无重力口径与 fireBullet 一致 ⇒ 只补飞行时间)
function capLeadPoint(tgt,o,spd){
const d=o.distanceTo(tgt.pos), t=d/Math.max(30,spd);
const v=capTgtVel(tgt,_capLeadV);
return V3(tgt.pos.x+v.x*t, tgt.pos.y+v.y*t, tgt.pos.z+v.z*t);
}

// ══════════════════════════════════════════════════════════════════════════
// 十四、命中管线 (炮弹 / 鱼雷 / 溅射 / 子弹 / 射线)
// ══════════════════════════════════════════════════════════════════════════
// 舰体 = 沿中心线的胶囊 (与 15d navalCapsule 同形, 只是半径/长度大一个量级);
// 命中后按"打在哪件上"分 tag: 命中盒 (上层/炮塔/烟囱) 先测, 都不中则算舷侧 'hull';
// 从上方以大俯角落在甲板矩形内的弹算 'deck' (水平装甲)。顺序 = 由高到低, 单源在 15g 的 boxes。
// 舰体 = 沿中心线的胶囊 (与 15d navalCapsule 同形, 只是半径/长度大一个量级);
//   ★2026-10-01 系统自查修: 旧版把舰体局部 z 上的两个端点**直接加到世界坐标**上 ⇒ 胶囊不随 yaw 转
//   (珊瑚海两条战列舰 yaw=±π/2: 胶囊横在 152m 舰体的**垂直方向**上 —— 炮弹/鱼雷/溅射全按一根垂直的
//   66.9m 胶囊判命中, 打舰艏舰艉都是空, 出水方向也全错)。现按 15d 同口径: 端点 = 中心 ± 前向 × hl。
function capitalCapsule(s){
// ★2026-10-04 (海战审计 V2 命中胶囊艏艉外溢): 旧版单胶囊 r=hullW/2 直抵艏艉端点 —— 放样舰体的艏部
//   可见半宽只有 ~0.6m (15g CP_BB_ST 首站宽 0.055), 胶囊却在艏尖还保留 10.5m 半宽 ⇒ 近失弹肉眼
//   看着落在舷外几米也算 'hull' 命中, 鱼雷/溅射同病, 反舰效率虚高一大截。现按放样宽度走势折成
//   7 根等径分段胶囊 (艏尖→艏过渡→全宽中段→艉过渡), 每段半径取该段放样宽度的**外包络**
//   (宁可轻微外溢, 不留"看得见打不着"的空窗)。段表 [z0,z1,rFrac]: 局部 z 以半长为单位 (艏=+1),
//   比例对 bb/cv 两族站表通用 (cv 略丰满, 差在段间裕度内)。
//   旧字段 (ax/az/bx/bz/r/hl) 保留 = 中段 (全宽) 胶囊 —— 兼容只读这些字段的既有探针/调用方。
const S=s.spec, sn=Math.sin(s.yaw), cs=Math.cos(s.yaw);
const R=S.hullW*0.5, HL=S.hullL*0.5;
const TAB=CAP_CAPSULE_SEGS, segs=[];
for(let i=0;i<TAB.length;i++){
const g=TAB[i], z0=HL*g[0], z1=HL*g[1], r=R*g[2];
segs.push({ax:s.pos.x+sn*z0, az:s.pos.z+cs*z0, bx:s.pos.x+sn*z1, bz:s.pos.z+cs*z1, r});
}
const m=segs[4];
return { segs, ax:m.ax, az:m.az, bx:m.bx, bz:m.bz, r:R, hl:HL,
y0:s.pos.y+s.hullHit.y0, y1:s.pos.y+s.hullHit.y1 };
}
const CAP_CAPSULE_SEGS=[
[ 0.96, 1.00,0.16],[ 0.90, 0.96,0.28],[ 0.79, 0.90,0.52],[ 0.40, 0.79,0.93],
[-0.71, 0.40,1.00],[-0.86,-0.71,0.965],[-1.00,-0.86,0.86]];
// 世界点 → 舰体局部 y (命中盒判定用)
function capitalRayBoxes(s,o,dir,maxD){
let bestT=maxD, best=null;
for(let k=0;k<s.boxes.length;k++){
const b=s.boxes[k];
// 射线 → 局部: 把起点与方向都转进舰体坐标系 (ship yaw 绕 Y), 再走标准 slab
const c=Math.cos(s.yaw), n=Math.sin(s.yaw);
const ox=o.x-s.pos.x, oz=o.z-s.pos.z;
const lox=ox*c-oz*n, loz=ox*n+oz*c, loy=o.y-s.pos.y;
const ldx=dir.x*c-dir.z*n, ldz=dir.x*n+dir.z*c, ldy=dir.y;
let t0=0, t1=bestT;
const lo=[lox-b.lx, loy-b.ly, loz-b.lz], ld=[ldx,ldy,ldz], hh=[b.hw,b.hh,b.hd];
let ok=true;
for(let a=0;a<3;a++){
if(Math.abs(ld[a])<1e-8){ if(Math.abs(lo[a])>hh[a]){ ok=false; break; } continue; }
let ta=(-hh[a]-lo[a])/ld[a], tb=(hh[a]-lo[a])/ld[a];
if(ta>tb){ const tmp=ta; ta=tb; tb=tmp; }
if(ta>t0) t0=ta; if(tb<t1) t1=tb;
if(t0>t1){ ok=false; break; }
}
if(ok&&t0>0.05&&t0<bestT){ bestT=t0; best=b; }
}
return best?{t:bestT,box:best,tag:best.tag}:null;
}
// 甲板命中 (大俯角): 起点在甲板面之上, 方向向下, 命中点在甲板矩形内 ⇒ tag 'deck'
function capitalRayDeck(s,o,dir,maxD){
if(dir.y>-0.12) return null;
const dy=s.pos.y+s.deck.y-o.y;
if(dy>0){ if(dir.y>=0) return null; }
const t=(s.pos.y+s.deck.y-o.y)/dir.y;
if(!(t>0.05&&t<maxD)) return null;
const px=o.x+dir.x*t, pz=o.z+dir.z*t;
capToLocal(s,px,pz,_capL);
if(!capDeckIn(s,_capL.x,_capL.z)) return null;
return {t,tag:'deck'};
}
function capitalRayHit(o,dir,maxD,team,pad){
if(!capitalShips.length) return null;
let best=null, bt=maxD;
for(const s of capitalShips){
if(!s.alive) continue;
if(team>=0&&s.team===team) continue;
const bd=capitalRayBoxes(s,o,dir,bt);
if(bd&&bd.t<bt){ bt=bd.t; best={t:bd.t,ship:s,tag:bd.tag,part:bd.box.part,pi:bd.box.pi}; }
const dd=capitalRayDeck(s,o,dir,bt);
if(dd&&dd.t<bt){ bt=dd.t; best={t:dd.t,ship:s,tag:dd.tag}; }
const cap=capitalCapsule(s);
const padR=pad||0;
for(let si=0;si<cap.segs.length;si++){                 // V2 (2026-10-04): 分段胶囊逐段测, 取最近命中
const sg=cap.segs[si];
const r=cpRaySeg(o.x,o.z,dir.x,dir.z,sg.ax,sg.az,sg.bx,sg.bz,bt);
if(r.d2<=(sg.r+padR)*(sg.r+padR)){
const y=o.y+dir.y*r.t;
if(y>=cap.y0&&y<=cap.y1&&r.t>0.02&&r.t<bt){ bt=r.t; best={t:r.t,ship:s,tag:'hull'}; }
}
}
}
return best;
}
// 子弹终点收窄 (只读; 与 navalRayQuery 同规 —— 挡在中间就该挡住, 但不在这里扣血)
function capitalRayQuery(o,dir,maxD,shooter){
if(!capitalShips.length) return null;
const team=(shooter&&shooter.team!==undefined)?shooter.team:-1;
const ff=(typeof coFfFire==='function')?coFfFire(shooter):false;
const r=capitalRayHit(o,dir,maxD,ff?-1:team,0);
return r?{t:r.t,ship:r.ship,tag:r.tag}:null;
}
function capitalBulletTest(o,dir,maxD,shooter,vehDmg){
if(!capitalShips.length) return null;
const q=capitalRayQuery(o,dir,maxD,shooter);
if(!q) return null;
if(vehDmg&&vehDmg>0) q.ship.takeDmg(vehDmg,shooter,{tag:q.tag});
else{
// 步枪/机枪对舰 (2026-10-04 修复批 U12): 旧版零伤害就零反馈 —— 弹着点连一粒火星都没有,
//   打在船壳上读作"子弹消失在虚空"。不扣血 (轻武器伤不了装甲), 只补命中表现: 火星 + 灰尘 + 跳弹音。
const p=V3(o.x+dir.x*q.t,o.y+dir.y*q.t,o.z+dir.z*q.t);
if(typeof spawnP==='function'){
spawnP(PT.spark,p.x,p.y,p.z,rand(-2,2),rand(1,3),rand(-2,2),0.22,0,0.16,1,0,true);
spawnP(PT.dark,p.x,p.y,p.z,rand(-0.5,0.5),rand(0.5,1.2),rand(-0.5,0.5),0.5,1.2,0.9,0.7,0);
}
if(typeof AudioSys!=='undefined'&&AudioSys.ricochet) AudioSys.ricochet(p.distanceTo(camera.position));
if(shooter&&shooter.isPlayer&&typeof markHitCls==='function') markHitCls('shell');
}
return q;
}
// 炮弹对舰 (updateShells 的挂钩): 命中则结算伤害/特效并返回 true (调用方 splice 掉这发弹)
const _capShDir=V3(0,0,1);
function capitalShellHit(shell,dt){
if(!capitalShips.length||!shell) return false;
const sdt=dt>0?dt:0.02;
const step=shell.vel.length()*sdt;
const maxD=Math.max(2.5,step+0.6)+SHELL_R;
const dir=_capShDir.copy(shell.vel).normalize();   // 复用槽 (2026-11-01 性能批), 本函数内同步消费
const r=capitalRayHit(shell.pos,dir,maxD,shell.team,SHELL_R);
if(!r) return false;
const hit=r.ship;
const p=V3(shell.pos.x+dir.x*r.t,shell.pos.y+dir.y*r.t,shell.pos.z+dir.z*r.t);
const base=shell.dmgV?shell.dmgV+rand(-30,30):(shell.kind==='at'?rand(300,380):rand(260,330));
if(shell.src&&shell.owner) shell.owner._src=shell.src;
if(typeof markHitCls==='function') markHitCls('shell');
hit.takeDmg(base,shell.owner,{tag:r.tag});
explosionFXSmall(p);
if(typeof AudioSys!=='undefined') AudioSys.explosion(p.distanceTo(camera.position)*1.6);
if(typeof damageStructures==='function') damageStructures(p,6,240,shell.owner);
// 舰炮对甲板步兵的波及 (2026-10-04 修复批): 旧版主炮命中只扣舰体+破坏工事 —— 甲板上站着的步兵
//   (含守方炮手) 在弹着点旁毫发无伤, 登舰作战读作"安全的"。补 splashDamage 单源一记 (与航弹同档
//   r7/240/560/ap); 友军免伤由 splashDamage 的 team 门自理, 击杀归因走 owner._src (上面已盖章)。
if(typeof splashDamage==='function') splashDamage(p,shell.owner,shell.team,7,240,560,true,'explo');
return true;
}
// 鱼雷/点命中: 只打**水线附近**, 且按 spec.torpedoDmg 结算 (分区装甲对雷无效 —— 雷打的是水下舷侧)
function capitalTorpedoHit(p,team,dmg,owner){
if(!capitalShips.length||!p) return null;
for(const s of capitalShips){
if(!s.alive) continue;
if(team>=0&&s.team===team) continue;
const cap=capitalCapsule(s);
let torHit=false;
for(let si=0;si<cap.segs.length;si++){                 // V2 (2026-10-04): 分段胶囊 (艏艉收窄后不再"远处吃雷")
const sg=cap.segs[si];
if(cpPtSeg2(p.x,p.z,sg.ax,sg.az,sg.bx,sg.bz)<=Math.pow(sg.r+NAVAL_TORP_R,2)){ torHit=true; break; }
}
if(!torHit) continue;
if(p.y>cap.y0+ (s.spec.draft0+2.2)) continue;          // 打在水线以上太多 ⇒ 不算吃雷 (那是炮弹的活)
const d=(dmg&&dmg>0)?Math.min(dmg/900,1)*s.spec.torpedoDmg:s.spec.torpedoDmg;
if(typeof markHitCls==='function') markHitCls('shell');
s.takeDmg(d,owner||null,{tag:'hull',torpedo:true});
const hp=V3(p.x,cap.y0+s.spec.draft0*0.4,p.z);
if(typeof waterSplash==='function') waterSplash(hp.clone(),2.6,true);
explosionFX(hp);
return s;
}
return null;
}
// 爆炸溅射 (13-combat.splashDamage 的挂钩) —— 衰减口径与 navalSplash 逐式对齐
function capitalSplash(p,attacker,team,radius,dmgMax,dmgVeh,ap,fbCls){
if(!capitalShips.length) return 0;
const ff=(team===-1||team===undefined);
let n=0;
for(const s of capitalShips){
if(!s.alive) continue;
if(!ff&&s.team===team&&s!==attacker) continue;
// 用"舰体胶囊的表面距离"而不是中心距 —— 150m 的舰用中心距算等于永远炸不到
const cap=capitalCapsule(s);
let dSurf=1e9;
for(let si=0;si<cap.segs.length;si++){                 // V2 (2026-10-04): 分段胶囊取最小表面距离
const sg=cap.segs[si];
const ds=Math.sqrt(cpPtSeg2(p.x,p.z,sg.ax,sg.az,sg.bx,sg.bz))-sg.r;
if(ds<dSurf) dSurf=ds;
}
const d=dSurf;
const dy=Math.max(0,Math.max(cap.y0-p.y,p.y-cap.y1));
const dd=Math.max(0,Math.hypot(d,dy));
if(dd<radius+2.5){
s.takeDmg(lerp(dmgVeh,10,dd/(radius+2.5)),attacker,{tag:p.y>cap.y1?'deck':'hull'});
n++;
}
}
return n;
}
function capWreckMat(){
if(!capWreckMat._m) capWreckMat._m=new THREE.MeshLambertMaterial({color:0x25272a,map:cpTex('scorch','grime')});
return capWreckMat._m;
}

// ══════════════════════════════════════════════════════════════════════════
// 十五、乘员搬运 (甲板 = 移动平台) + 小艇让路 + 旗点跟随
// ══════════════════════════════════════════════════════════════════════════
// 收集: 用**移动前**位姿判"谁站在本舰甲板上", 记下局部坐标
// ★2026-10-02 实机第四轮: 旧版把观战玩家排除在乘员搬运之外 ⇒ 观战者站在甲板上时 ①舰开走人不跟
//   (甲板变"跑步机", 逆舰向走净速度≈0 —— "在船上移动非常慢"的根因) ②capLocalSolve 也只跑在乘员表上,
//   上层建筑/炮塔/舰岛对他全体不拦 ("旁观模式甲板以上全都没有碰撞"的根因)。观战者既已站上甲板,
//   就是"甲板上的人", 与普通玩家同一支搬运+绕行; 时停不冻观察者的口径不受影响 (冻结帧舰不动,
//   搬运=恒等映射, 观战者本体链照走 pdt)。
function capRideCollect(s){
const arr=s._riders||(s._riders=[]);
arr.length=0;
const list=(typeof combatants!=='undefined')?combatants:null;
if(!list) return;
const deckW=s.pos.y+s.deck.y;
for(let i=0;i<list.length;i++){
const a=list[i];
if(!a||!a.alive||a.onVehicle) continue;
if(a.capCrew) continue;                                // 甲板炮手: 网格挂在舰体上, 不走乘员搬运双写 (2026-10-01c)
if(a.pos.y<deckW-CAPITAL_CFG.rideEps||a.pos.y>deckW+2.6) continue;
capToLocal(s,a.pos.x,a.pos.z,_capL);
if(!capDeckIn(s,_capL.x,_capL.z)) continue;
arr.push({a,lx:_capL.x,lz:_capL.z,ly:a.pos.y-s.pos.y});
}
// 停在甲板上的舰载机同样由平台承载 (P4 2026-09-30): 飞机不参与 infantry 的那套竖直门, 单列一支。
if(typeof planes!=='undefined') for(let i=0;i<planes.length;i++){
const pl=planes[i];
if(!pl||!pl.alive||pl.capArrest!==s||!pl.pos) continue;
capToLocal(s,pl.pos.x,pl.pos.z,_capL);
if(!capDeckIn(s,_capL.x,_capL.z)) continue;
arr.push({a:pl,lx:_capL.x,lz:_capL.z,ly:pl.pos.y-s.pos.y});
}
}
// 放回: 按**移动后**位姿把乘员摆回同一个局部坐标 (等价于"人挂在舰体坐标系里")
function capRideApply(s){
const arr=s._riders; if(!arr||!arr.length) return;
for(let i=0;i<arr.length;i++){
const r=arr[i], a=r.a;
capToWorld(s,r.lx,r.lz,_capW);
a.pos.x=_capW.x; a.pos.z=_capW.z;
a.pos.y=s.pos.y+r.ly;
// ★2026-10-03 (实机"甲板上走路只有一半速度"): 旧版每帧把玩家 vel.x/z 清零 —— 而步行速度是
//   dampF(vel→目标, accel) 的** persistent 积分**, 每帧归零后下一帧从 0 起步, 稳态速度只有
//   (1−e^(−accel·dt)) 档: 60fps≈47% / 144fps≈23%。平台搬运本来就是**纯位置修正** (不碰 vel),
//   vel 里根本没有平台分量可清 —— 这行清掉的是玩家自己的动量, 直接删除 (甲板跳跃的前进分量
//   也随本条恢复; "平台位移转成速度"的场景在本仓库不存在, vel 只由 20-player 的输入链写)。
// 停放的舰载机: Plane.update 整帧让位 (capArrestTick) ⇒ 它的网格**只能**在这里同步,
//   否则甲板搬走了飞机网格还留在原处 (实机: 一条船开走, 甲板上的飞机留在半空)。
if(a.kind==='plane'&&a.grp){ a.grp.position.copy(a.pos); a.grp.rotation.set(-(a.pitch||0),a.yaw||0,a.roll||0); }
}
}
// ── 甲板补给件 (弹药箱) 跟随 (2026-10-01 实机修) ──
// 05c 在**载入期**按战役表的 t=0 世界坐标把甲板弹药箱放到甲板上 (此刻 ships 还不存在), 箱体是静态网格
//   + 静态碰撞盒。实机表现: 舰一开走, 箱子留在原地悬在半空 (实机:"旗帜周围的东西对于船体严重漂移")。
//   口径: 每局开局 (capitalFlagBind) 把甲板箱的**世界坐标换算成舰体局部坐标** —— 用舰的**开局位姿**
//   (home) 换算, 因为箱子就是按那个位姿落位的 (用当帧 live 位姿会带一次固定偏差); 此后每帧跟着搬。
//   不做动态碰撞盒: 逐帧搬 6 个盒要写 OCC 脏区 + 触发 NAV 重建 (见头注释三的同一理由), 而 1.1m 的
//   弹药箱让行人穿过是零伤害 —— 箱子在**视觉**上跟住船才是这条报的核心。
const capDeckProps=[];
function capDeckBind(){
capDeckProps.length=0;
if(typeof AMMO_CRATES==='undefined'||!AMMO_CRATES.length) return 0;
for(const c of AMMO_CRATES){
if(c.ship===undefined||!c.mesh) continue;
const s=capitalShips[c.ship]; if(!s) continue;
const dx=c.x-s.homeX, dz=c.z-s.homeZ, cc=Math.cos(s.homeYaw), nn=Math.sin(s.homeYaw);
c.lx=dx*cc-dz*nn; c.lz=dx*nn+dz*cc;
capDeckProps.push(c);
}
return capDeckProps.length;
}
function capDeckPropTick(){
for(let i=0;i<capDeckProps.length;i++){
const c=capDeckProps[i], s=capitalShips[c.ship];
if(!s) continue;
capToWorld(s,c.lx,c.lz,_capW);
// ★坐标同账 (2026-10-01b 修"船上的补给箱失效"): 旧版只搬**网格**不更新 c.x/c.z —— 而交互链
//   (20-player tryInteract / updateInteractHint / Bot 补给) 读的是 c.x/c.z, 舰一开走判据就停在
//   t=0 的海面上 ⇒ 玩家明明站在箱子旁边却不出"补充弹药"提示。网格与判据坐标必须同帧同账。
c.x=_capW.x; c.z=_capW.z;
c.mesh.position.x=_capW.x; c.mesh.position.z=_capW.z;
if(c.lid){ c.lid.position.x=_capW.x; c.lid.position.z=_capW.z; }
}
}
function capitalFlagTick(dt){
if(!capitalShips.length||typeof FLAGS==='undefined'||!FLAGS.length) return;
for(const s of capitalShips){
for(const f of s.deckFlags){
const w=capToWorld(s,f._clx,f._clz,_capW);
f.x=w.x; f.z=w.z;
const gy=s.pos.y+s.deck.y;
f.gy=gy; f.poleTop=gy+(f.poleH?f.poleH-0.75:6.25);   // 低旗 (05c poleH): 挂边随杆高走 (21-match 布料/23b 还原都读它)
if(f.flagMesh){ f.flagMesh.position.x=w.x+0.075; f.flagMesh.position.z=w.z; }
if(f.poleMesh){ f.poleMesh.position.x=w.x; f.poleMesh.position.z=w.z; }
if(f.poleCyl){ f.poleCyl.x=w.x; f.poleCyl.z=w.z; f.poleCyl.y0=gy; f.poleCyl.y1=gy+7; }
}
}
capDeckPropTick();
}
// ══════════════════════════════════════════════════════════════════════════
// 十六、主更新 (24-main: 紧接 updateNaval 之后 —— 命中管线要拿到当帧位姿)
// ══════════════════════════════════════════════════════════════════════════
function updateCapital(dt,pdt){
if(!capitalShips.length) return;
const wdt=(dt>0)?dt:0;
// 菜单航拍期 (2026-10-01b 起始界面显示舰船): 舰照常巡航/搬旗, 但**不开火** —— 菜单里没有阵营,
//   AI 火控会把两支编队当敌人互相轰。停战守卫走 step 的 noAI 通道。
const noAI=(typeof menuHold!=='undefined'&&menuHold);
for(let i=0;i<capitalShips.length;i++){
const s=capitalShips[i];
capRideCollect(s);                                     // ① 移动前位姿记局部坐标
s.step(wdt,noAI);                                      // ② 推舰 (巡航 + 火控 + 姿态 + 同步)
capRideApply(s);                                       // ③ 按新位姿放回
capCrewTick(s,wdt);                                    // ③b 炮手世界坐标对账 + 阵亡倒伏/接管隐身 (网格随舰, 不用搬)
const rd=s._riders;
for(let k=0;k<(rd?rd.length:0);k++) capLocalSolve(rd[k].a,s);  // ④ 甲板局部障碍绕行
}
// ⑤ Bot 甲板收账 (标记 onCapDeck + 贴舷登舰) —— 与乘员搬运同帧, 保证下一帧的寻路已拿到新标记
for(const b of (typeof combatants!=='undefined'?combatants:[])) if(!b.isPlayer) capBotTick(b);
for(const c of (typeof navalCraft!=='undefined'?navalCraft:[])) capPushCraft(c,wdt);
capPushCap();                                          // ⑤b 大舰↔大舰 推出 (2026-10-01b"船互相穿过"修复)
capitalFlagTick(wdt);
if(!noAI) capGunTick(wdt);                             // ⑤c 玩家炮位接管的一帧 (菜单期不存在接管)
capPlayerTick();
}
// ══════════════════════════════════════════════════════════════════════════
// 十五b、Bot 在甲板上的导航 (2026-09-30)
// ══════════════════════════════════════════════════════════════════════════
// 问题: OCC/NAV 是**载入期烘焙的静态网格**, 而大舰在巡航 ⇒ 甲板不可能进网格。全海图的 OCC 又是整片
//   水障 (水深 > SWIM_DEPTH ⇒ 值 2) ⇒ Bot 的 findPath 恒为 null ⇒ 落到甲板上的兵全部站桩
//   (14-bots 的既有事实: "无路可走就不动")。
// 口径: 甲板上的寻路换成**直行单点路径** —— 甲板是平坦净空面 (唯一的障碍是上层建筑/炮塔, 由
//   capLocalSolve 每帧推出), 本就不需要 A*; 这不是"取消寻路", 而是"换一张图"。行走侧的
//   水障闸门 (moveDir 的 occBlocked probe) 同步放行 (见 14-bots 里那一行的 onCapDeck)。
// 登舰: Bot 靠近目标舰到 CAPITAL_CFG.boardR 内即"爬上去"(与小艇的登船同一条空间语义, 只是没有
//   动画 —— Bot 的跨域过渡在本仓库一律是脚本化的, 见 navAmphShim)。
function capNavDirect(bot,tx,tz){
if(!capitalShips.length||!bot||!bot.pos) return null;
const onShip=capDeckOf(bot.pos.x,bot.pos.z);
const tgtShip=capDeckOf(tx,tz);
if(!onShip&&!tgtShip) return null;
if(onShip&&tgtShip&&onShip!==tgtShip) return null;      // 两舰之间: 交给正常寻路 (实际是游过去)
return [[tx,tz]];
}
// 每帧的 Bot 甲板收账: ① 打甲板标记 (moveDir 的水障放行读它) ② 上/下舰的**脚本化跨域过渡**。
//   ★2026-10-01 实机修: 登舰判据旧版用 `dist − max(hullW, hullL/2)*0.5` 这个"等效半径"近似 ——
//   对 152m 长的舰, 舰艏/舰艉方向的偏差不多达 ±38m (在舰艏旁边反而判不到); 现按**舰体矩形的表面距离**算。
//   下舰同理: 护栏把所有人挡在甲板内, Bot 想要的目标不在本舰上时, 贴到甲板缘即"翻栏下水"
//   (与小艇/登舰同一支脚本化跨域过渡语义; 不这样做, Bot 会全部堵在护栏内侧).
function capBotTick(bot){
if(!capitalShips.length||!bot||!bot.alive) return;
const s=capDeckOf(bot.pos.x,bot.pos.z);
bot.onCapDeck=s||null;
const o=bot.objective;
if(s){
const t=o?capDeckOf(o.x,o.z):null;
// ★2026-10-01c 修"Bot 在海里扎堆": 旧版"目标旗在别舰 ⇒ 贴到舷缘就跳下去游泳" —— 而目标旗跟着舰
//   巡航移动, 舰速 4m/s > 游泳速度 ⇒ 整队 Bot 落水追着船游, 永远追不上, 在海里扎堆漂。
//   现在**只贴帮才跳**: 目标舰的舰体矩形已在本舰 boardR 内 (跳帮窗口开着) 才下水爬过去;
//   远舰目标一律不下水 (pickObjective 同帧已把远舰旗过滤掉, 双保险)。
if(o&&t!==s&&capRectDist(t,bot.pos.x,bot.pos.z)<=CAPITAL_CFG.boardR){
capToLocal(s,bot.pos.x,bot.pos.z,_capL);
const mx=capDeckHW(s,_capL.z)-Math.abs(_capL.x), mz=s.deck.hl-Math.abs(_capL.z);
if(Math.min(mx,mz)<2.0){
// 从最近的缘外下水: 左右缘优先 (舰艏艉外是螺旋桨/艏波区)
const outX=capDeckHW(s,_capL.z)+1.6;
if(mx<=mz){ _capL.x=(_capL.x<0?-1:1)*outX; _capL.z=clamp(_capL.z,-s.deck.hl+1.5,s.deck.hl-1.5); }
else{ _capL.x=clamp(_capL.x,-outX,outX); _capL.z=Math.sign(_capL.z||1)*(s.deck.hl+1.6); }
capToWorld(s,_capL.x,_capL.z,_capW);
bot.pos.x=_capW.x; bot.pos.z=_capW.z;
bot.pos.y=Math.max(0,(typeof waterYAt==='function')?waterYAt(_capW.x,_capW.z):0);
bot.vel.set(0,0,0); bot.path=null; bot.repathT=0;
bot.swim=true; bot.onCapDeck=null;
}
}
return;
}
if(bot.onVehicle){
// ★2026-10-03 摆渡下客 (夺点死锁破解, 与 14-bots boatAI 的 'ferry' 相位成对): 两图同队巡逻环全等且
//   同相位出发 ⇒ 编队刚体平移, 舰间距离恒在 boardR 之外 (铁底湾 330m/珊瑚海 BB 464m) ⇒ 甲板旗点
//   对 Bot 永远不可夺。摆渡 = 艇载着自己的车组贴到敌舰舷侧 (capPushCraft 停在壳边), 这里在 boardR
//   圈内把他送上甲板。判据挂 craft.ferryTgt (boatAI 盖章的摆渡意图), 不挂 bot.objective —— 车组在
//   车上不跑 pickObjective, objective 是旧的。
const v=bot.onVehicle;
if(!v||(v.kind!=='boat'&&v.kind!=='amph')||!v.ferryTgt) return;
const fv=v.ferryTgt;
if(fv.state!=='run'){ v.ferryTgt=null; return; }        // 目标舰中途瘫痪 ⇒ 摆渡意图作废 (boatAI 下帧重挑)
if(capRectDist(fv,bot.pos.x,bot.pos.z)>CAPITAL_CFG.boardR) return;
if(typeof bot.dismountVehicle==='function') bot.dismountVehicle(false);
bot.onVehicle=null; bot.exitSlide=null;                 // 摆渡是脚本化跨域过渡, 不走"下车限速跨出"那条
v.ferryCdT=nowT+CAPITAL_CFG.ferryCd;                    // 空艇回港记账: 下一轮摆渡等冷却 (重生认领链自行补员)
v.ferryTgt=null;                                        // ★2026-10-04 (A2): 摆渡意图消费即清 —— 旧版只在
                                                        //   艇员不在/目标瘫了的分支里清, 正常下客后 ferryTgt
                                                        //   残留一帧, boatAI 还会按旧意图朝残舰开 (此后靠
                                                        //   !dr 兜底才自愈); 显式清账让"下客→回港"当帧成立。
capBotClimbAboard(bot,fv);
return;
}
if(bot.chuting) return;
// 未在甲板上: 目标是某舰甲板且已贴到舷侧 ⇒ 爬上去 (单点入口, 与玩家 capBoard 同一支语义)。
// ★2026-10-03 游泳放行: 2026-10-01c"贴帮才跳"让 Bot 只在跳帮窗口才下水, 但旧版 `||bot.swim` 把
//   游泳者整个挡在爬舷之外 ⇒ 跳下去/被炸下甲板的人**永远爬不回来** (贴着舷侧溺亡)。现在游泳者
//   同样按 boardR 爬舷 —— 大海致命化口径不变 (游不进圈的照旧溺亡自净), 只是"贴帮"这条活路通了。
if(!o) return;
const t=capDeckOf(o.x,o.z);
if(!t) return;
const d=capRectDist(t,bot.pos.x,bot.pos.z);
if(d>CAPITAL_CFG.boardR) return;
capBotClimbAboard(bot,t);
}
// Bot 爬舷上舰 (脚本化跨域过渡, 单点入口): 步行贴舷 / 游泳贴帮 / 摆渡下客 三条路共用这一段。
function capBotClimbAboard(bot,t){
capToLocal(t,bot.pos.x,bot.pos.z,_capL);
_capL.z=clamp(_capL.z,-t.deck.hl+1.6,t.deck.hl-1.6);
const hw=capDeckHW(t,_capL.z)-1.6;
_capL.x=clamp(_capL.x,-hw,hw);
capToWorld(t,_capL.x,_capL.z,_capW);
bot.pos.x=_capW.x; bot.pos.z=_capW.z; bot.pos.y=t.pos.y+t.deck.y;
bot.vel.set(0,0,0); bot.path=null; bot.repathT=0;
bot.onCapDeck=t; bot.swim=false;
// 落舰领任务: 现目标不在这条舰上时, 领"该舰上离他最近的**可夺**旗" (摆渡兵直奔夺点; 爬回本舰的
//   守兵保留原目标不覆写)。领不到就置 null, 由下一轮 pickObjective 抽签。
const curOn=bot.objective?capDeckOf(bot.objective.x,bot.objective.z):null;
if(curOn!==t){
let bf=null,bd=1e9;
if(typeof FLAGS!=='undefined') for(let i=0;i<FLAGS.length;i++){
const f=FLAGS[i];
if(f.ship!==capitalShips.indexOf(t)||f.owner===bot.team) continue;
if(typeof capFlagActive==='function'&&!capFlagActive(f)) continue;
const fd=Math.hypot(f.x-bot.pos.x,f.z-bot.pos.z);
if(fd<bd){ bd=fd; bf=f; }
}
bot.objective=bf; bot.defendPt=null; bot.state='advance';
}
}
// 点到舰体矩形 (舰体局部) 的表面距离 —— 登舰半径的单一量度 (玩家 capNearestBoardable 与 Bot 同源)
function capRectDist(s,x,z){
capToLocal(s,x,z,_capL);
const dx=Math.max(0,Math.abs(_capL.x)-s.spec.hullW*0.5);
const dz=Math.max(0,Math.abs(_capL.z)-s.spec.hullL*0.5);
return Math.hypot(dx,dz);
}
// 舰体矩形表面上离该点最近的点 (外扩 pad): 摆渡艇的贴舷停泊位 / 落水 Bot 的"游向舰体"目标点共用。
// p 兼容两种形态: 纯点 {x,z} 或带 pos 的实体 (Bot/艇 —— 内部读 p.pos)。★2026-10-03 修: 旧版只认
// p.x/p.z, 而游泳劫持传 this / 摆渡传 craft 都是实体 ⇒ p.x=undefined ⇒ NaN 一路传进 yaw/vel
// (验收探针 T10 航向 NaN 与 T12 摆渡不收敛的双红根因)。
// 点在扩矩形内时返回原点 (调用方先用 capRectDist 判距离, 不会拿它当传送点用)。
function capNearestSurfPt(p,s,pad){
const px=(p.x!==undefined)?p.x:p.pos.x, pz=(p.z!==undefined)?p.z:p.pos.z;
capToLocal(s,px,pz,_capL);
const hw=s.spec.hullW*0.5+(pad||4), hl=s.spec.hullL*0.5+(pad||4);
capToWorld(s,clamp(_capL.x,-hw,hw),clamp(_capL.z,-hl,hl),_capW);
return {x:_capW.x,z:_capW.z};
}
// 玩家座位的一帧收账: 走出甲板缘/被打落 → 交还座位 (此后按游泳/坠落链走, 与"掉下平台"同一条物理路径)。
// 瘫痪**不**交还 —— 瘫舰仍是海上陆地, 玩家照常站在上面占旗 (用户裁定②)。
function capPlayerTick(){
if(typeof player==='undefined'||!player||!player.onCapital) return;
const s=player.onCapital;
if(player.alive===false||player.onVehicle){ capSeatRelease(); if(player&&player.capitalGun) player.capitalGun=null; return; }
// 炮位接管中 (2026-10-01b): 站位由 capGunTick 钉在炮位锚点, 不走"走出甲板缘"交还 —— 下炮只走 F
if(player.capitalGun&&player.capitalGun.ship===s) return;
const deckY=s.pos.y+s.deck.y;
if(player.pos.y<deckY-CAPITAL_CFG.rideEps-2.0){ capSeatRelease(); return; }   // 掉海了
capToLocal(s,player.pos.x,player.pos.z,_capL);
if(!capDeckIn(s,_capL.x,_capL.z,-3)) capSeatRelease();
}
// ══════════════════════════════════════════════════════════════════════════
// 十七、编制 / 基地 / 登舰
// ══════════════════════════════════════════════════════════════════════════
function capitalSpawnOrbat(){
const list=capSpawnList();
if(!list.length) return 0;
let n=0;
for(let i=0;i<list.length;i++){
const c=list[i];
const s=new CapitalShip(c.key,c.team,c);
if(c.ord!==undefined) s.ord=c.ord;
n++;
}
capitalFlagBind();
return n;
}
// 编制确保 (2026-10-01b): 大舰改为**载入期生成** (24-main boot, 菜单航拍要显示舰船), startMatch 与
//   就地重开不再重建 —— 已在场 ⇒ 复位到开局位姿 + 重绑甲板旗; 不在场 (旧存档路径/探针) ⇒ 照旧生成。
function capitalEnsureOrbat(){
if(capitalShips.length) { capitalReset(); return capitalShips.length; }
return capitalSpawnOrbat();
}
// 甲板旗点绑定: 战役里 `ship:<索引>` 的旗点换算成舰体局部坐标 (载入期按航点起点解析)
//   同批绑甲板补给件 (弹药箱): 与旗点同一支 —— 05c 载入期按 t=0 位姿落位, 此后逐帧跟着舰走。
function capitalFlagBind(){
for(const s of capitalShips) s.deckFlags.length=0;      // 重开局先清表 (旧版重复 push ⇒ 同一旗被搬两次)
capDeckBind();
if(typeof FLAGS==='undefined'||!FLAGS.length) return;
for(let i=0;i<capitalShips.length;i++){
const s=capitalShips[i];
for(const f of FLAGS){
if(f.ship!==i) continue;
// ★2026-10-03: 局部锚一次绑定终身有效 —— 旗跟舰走, f.x/f.z 是**随动世界坐标**; 复位后舰已回
//   开局位姿而 f.x/f.z 还停在旧位置, 旧版无条件重推导会把锚钉到舰体之外 (与 respawnClear 的
//   home 回位成对: 两处都改, 复位后才真正"逐位等于开局")。
if(f._clx===undefined){
capToLocal(s,f.x,f.z,_capL);
f._clx=_capL.x; f._clz=_capL.z;
}
s.deckFlags.push(f);
}
}
}
// 本队大舰当前位置 = 本队基地 (00-config.basePos 的挂钩; 无大舰的战役返回 null ⇒ 走原逻辑)
// 甲板旗点有效性 (2026-10-01b 单源, 用户裁定"瘫舰=无阵营陆地, 无法被占领/无法作为重生点"):
//   非甲板旗 (ship 缺省) = 陆旗恒有效; 甲板旗随所属舰 —— 舰瘫痪 ⇒ 无效 (不可占/不算胜负条件/不出现在
//   部署列表/Bot 目标跳过)。消费方: 21-match updateFlags·flagsLostOf、23-deploy buildSpawnList·drawDeployMap、
//   14-bots pickObjective。15h 缺席的沙箱 (只载部分脚本的探针) 由调用方的 typeof 守卫兜底。
function capFlagActive(f){
if(!f||f.ship===undefined) return true;
const s=capitalShips[f.ship];
return !!(s&&s.state!=='crippled');
}
// 本队大舰当前位置 = 本队基地 (00-config basePos 的挂钩; 无大舰的战役返回 null ⇒ 走原逻辑)
// ★2026-10-01b: 基地舰瘫痪 ⇒ 回退到本队另一艘**还在巡航**的大舰 (瘫舰不再是重生点);
//   全队大舰都瘫 ⇒ 返回 null, basePos 走 BASES 静态兜底 (部署落点吸附仍会把它放上最后一片"陆地")。
function capBasePos(team){
let fb=null;
for(const s of capitalShips){
if(s.team!==team) continue;
if(s.isBase&&s.state==='run') return {x:s.pos.x,z:s.pos.z};
if(s.state==='run'&&!fb) fb=s;
}
return fb?{x:fb.pos.x,z:fb.pos.z}:null;
}
function capitalNear(x,z,r,team){
let best=null,bd=r||1e9;
for(const s of capitalShips){
if(team!==undefined&&team>=0&&s.team!==team) continue;
const d=Math.hypot(x-s.pos.x,z-s.pos.z)-s.spec.hullL*0.5;
if(d<bd){ bd=d; best=s; }
}
return best;
}
// 登舰半径 (CAPITAL_CFG.boardR): 大舰吃水 6m, 只能从水面侧靠 —— 与小艇 navalBoardRadius 同手感, 取更大值
function capNearestBoardable(){
if(!capitalShips.length||typeof player==='undefined'||!player) return null;
if(typeof player.onVehicle==='object'&&player.onVehicle) return null;   // 在座 (坦克/飞机) 不登舰
let best=null,bd=CAPITAL_CFG.boardR;
for(const s of capitalShips){
const d=capRectDist(s,player.pos.x,player.pos.z);
if(d<bd){ bd=d; best=s; }
}
return best;
}
// 登舰: 把玩家摆到"离他最近的甲板缘内侧" (单点入口, 与小艇 navalBoard 同规: 唯一上舰路径)。
// 与小艇一样先把座位字段清干净 (onVehicle 互斥 + 手持武器收起 + 水态字段复位) —— 否则会出现
// "人在甲板上、呼吸条还挂着" / "上舰瞬间手里还端着枪" 这类交接漏项 (小艇那边 2026-09-26E 审计 15 的同类坑)。
function capBoard(s,silent){
if(!s||!player) return false;
if(player.onCapital===s) return false;
if(player.onNaval&&typeof navalSeatRelease==='function') navalSeatRelease();
if(player.onVehicle&&player.onVehicle.kind==='ghost'&&typeof specVehStow==='function') specVehStow();
// 找最近甲板缘: 把玩家位置夹进甲板矩形, 再退 1.6m 进内部 (别一上舰就贴着护栏)
capToLocal(s,player.pos.x,player.pos.z,_capL);
_capL.z=clamp(_capL.z,-s.deck.hl+1.6,s.deck.hl-1.6);
const bw=capDeckHW(s,_capL.z)-1.6;
_capL.x=clamp(_capL.x,-bw,bw);
capToWorld(s,_capL.x,_capL.z,_capW);
player.pos.set(_capW.x,s.pos.y+s.deck.y,_capW.z);
player.vel.set(0,0,0);
player.onCapital=s; player.onVehicle=null;
player.capitalGun=null;
player.yaw=s.yaw+Math.PI;                              // 与小艇/坦克同口径: 相机 yaw 与舰艏差 π
player.pitch=0; player.onGround=true;
player.swim=false; player.wading=false; player.ads=false; player.prone=false; player.braced=false;
player.diveD=0; player.oxy=1; player._drownAcc=0; player.headDepth=-1;
player.onGround=true;
if(typeof playerChuteClear==='function') playerChuteClear();
if(!silent&&typeof showScorePop==='function') showScorePop(t('登舰: {0}',s.name),0);
return true;
}
function capSeatRelease(){
if(!player) return;
if(player.onCapital) player.onCapital=null;
// ★2026-10-03: 炮位账清掉时必须还原步兵武器模型 —— 旧版只清字段, 而 VM.root.visible=false 只在
//   capGunMount 写、true 只在 capGunRelease 写 ⇒ 瘫舰强制下炮 (cripple)/坠海/阵亡走 capSeatRelease
//   的三条路径都把玩家留在"人站着、手里没枪"的隐形武器态。capitalGun 在 onCapital 已空时同样清
//   (部署复位遗漏的旧账, 见 23-deploy deployPlayer)。
if(player.capitalGun){
player.capitalGun=null;
if(typeof VM!=='undefined'&&VM.root) VM.root.visible=true;
}
}
// 下舰: 走出甲板缘 ⇒ 落海 (与"掉下甲板"同一条物理路径, 只是从 F 主动触发时给一帧向外的初速)
function capCanExitNow(ship){
const s=ship||player.onCapital; if(!s) return false;   // ship 可传 (2026-10-01c): 部署直落甲板的玩家 onCapital 为空, 按脚下舰判
capToLocal(s,player.pos.x,player.pos.z,_capL);
const m=Math.min(capDeckHW(s,_capL.z)-Math.abs(_capL.x), s.deck.hl-Math.abs(_capL.z));
return m<2.2;
}
function capExitNow(ship){
const s=ship||player.onCapital; if(!s) return false;   // ship 可传 (2026-10-01c): 同 capCanExitNow
capToLocal(s,player.pos.x,player.pos.z,_capL);
	// ★2026-10-02b (round5 探针 T4② 揪出的既有 bug): 旧 outZ = deck.hl*0.5 —— deck.hl 本身已是**半长**
	//   (bb 72), 再折半 = 36m ⇒ 从艏艉向 1/3 段按 F 跳海, 人被"传送"到 36m 处的高炮塔旁**还在甲板上**
	//   (F 看起来"没反应")。退出点必须在甲板矩形之外: hl+1.4 与舷侧 outX=capDeckHW+1.4 同余量。
	const outX=capDeckHW(s,_capL.z)+1.4, outZ=Math.sign(_capL.z||1)*(s.deck.hl+1.4);
// 从最近的缘外落水: 左右缘优先 (舰艏艉外是螺旋桨/艏波区)
if(Math.abs(_capL.x)>Math.abs(_capL.z)*0.6){
_capL.x=(_capL.x<0?-1:1)*outX;
}else{
_capL.x=0; _capL.z=outZ;
}
capToWorld(s,_capL.x,_capL.z,_capW);
player.pos.set(_capW.x,Math.max(0,waterYAt(_capW.x,_capW.z)),_capW.z);
player.vel.set(0,0,0);
capSeatRelease();
return true;
}
// ══════════════════════════════════════════════════════════════════════════
// 十七b、航母舰载机: 简化起降 (用户裁定① 2026-09-30)
// ══════════════════════════════════════════════════════════════════════════
// 用户口径原文: "甲板一键弹射起飞 (不做滑跑加速段) + 触舰自动拦阻钩停"。
//   ① 起飞: 停在甲板上的舰载机, 玩家按 Space / AI 停放满 CAP_PARK_LAUNCH_T 秒 ⇒ **一键弹射**:
//      整机瞬移到弹射器滑轨起点, 直接获得机型顶速与 6° 抬头 —— 没有滑跑段 (这正是"简化"的含义)。
//   ② 降落: 任一低空慢速的飞机落在飞行甲板矩形内 ⇒ **自动拦阻** (速度归零、姿态摆平、钉在甲板上),
//      此后由甲板移动平台承载 (与步兵同一条乘员搬运链)。
//   ③ 停驻期间 Plane.update 整帧让位 (capArrestTick 返回 true) —— 物理/姿态积分/AI 全部不跑,
//      只有弹射输入与甲板搬运在动。
//   与非航母战役零交集: capitalShips 为空 ⇒ capParkPlanes 一台都不动, capArrestTick 首行即返回
//   (既有 13 张图的飞机出生点/行为逐位不变)。
const CAP_ARREST_SPD=26;     // 触舰拦阻的最大速度 m/s (再快就是撞甲板, 不拦)
const CAP_PARK_LAUNCH_T=8;   // AI 舰载机停放多久自动弹射 (秒)
const CAP_ARREST_SINK=7;     // 最大下沉率 m/s (超过 = 硬撞, 不禁停 —— 简化起降不做坠机)

function capCarrierOfTeam(team){
for(const s of capitalShips){ if(s.cls==='cv'&&s.team===team) return s; }
return null;
}
// 飞机是否贴在某舰飞行甲板上 → {cv,lx,lz,top}|null (只认航母: 战列舰的主甲板不是起降面)
function capPlaneDeckHit(pl){
if(!capitalShips.length||!pl||!pl.pos) return null;
for(const s of capitalShips){
if(s.cls!=='cv') continue;
if(pl.team!==s.team) continue;                       // 敌机不落我方甲板 (旧版不分队 ⇒ 敌机低空掠过就被"钩停"到我方甲板上)
if(s.state!=='run') continue;                        // ★2026-10-03: 瘫舰不接收拦阻 (甲板作业停止) —— 旧版不分状态,
const top=s.pos.y+s.deck.y;
if(pl.pos.y<top-0.8||pl.pos.y>top+2.6) continue;
capToLocal(s,pl.pos.x,pl.pos.z,_capL);
if(!capDeckIn(s,_capL.x,_capL.z)) continue;
return {cv:s,lx:_capL.x,lz:_capL.z,top};
}
return null;
}
// Plane.update 首行挂钩: 返回 true ⇒ 本帧整帧交给甲板态 (不积分、不 AI、不开火)
function capArrestTick(pl,fdt){
if(!capitalShips.length||!pl) return false;
if(pl.capArrest){
const cv=pl.capArrest;
if(!cv||cv.cls!=='cv'||!cv.alive){ pl.capArrest=null; return false; }
// ★2026-10-03 (与 capTryArrest 的状态门成对): 所停航母中途瘫痪 ⇒ 拦阻就地解开, 飞机从甲板复飞
//   (AI 走 planeAI 自行加速离舰 / 玩家推油门滑跑)。旧版不分状态: wantLaunch 的 state==='run' 门
//   让 AI 机在瘫舰甲板上**永远冻结** (而玩家同态走 16-aircraft planeTakeoverToggle 的 capLaunchPlane
//   却能弹走 —— 同一状态两条结局的根因; cripple() 的紧急弹射只覆盖"瘫那一刻已停放"的机)。
if(cv.state!=='run'){ pl.capArrest=null; pl.capParkT=0; return false; }
pl.capParkT=(pl.capParkT||0)+((fdt>0)?fdt:1/60);   // 帧长由 Plane.update 透传 (旧版写死 1/60 ⇒ 帧率一变停放时长就飘)
const wantLaunch=(pl.playerDriven&&typeof keys!=='undefined'&&keys.Space)||(!pl.playerDriven&&pl.capParkT>=CAP_PARK_LAUNCH_T);
if(wantLaunch&&cv.state==='run'){ capLaunchPlane(pl); return false; }
pl.speed=0; pl.roll=0; pl.pitch=0;
// 停机抬量 (2026-10-01d, 实机"起飞之前嵌在甲板上"): 网格原点在机身轴线, 钉在甲板面 = 半截机身
//   埋进甲板 —— 抬到机腹最低点之上 (plParkLift 单源, 16-aircraft)。
pl.pos.y=cv.pos.y+cv.deck.y+((typeof plParkLift==='function')?plParkLift(pl):0);   // 钉在停机高度 (搬运在 capRide 链里)
return true;
}
// 进场拦阻 (命名入口: 与 capLaunchPlane 成对)
if(capTryArrest(pl)) return true;
return false;
}
// 触舰拦阻判定: 低空 + 慢速 + 落在飞行甲板矩形内 ⇒ 钩停 (用户裁定① 简化起降, 无复飞判定)
function capTryArrest(pl){
if(!pl||pl.capArrest||pl.speed>=CAP_ARREST_SPD) return false;
const hit=capPlaneDeckHit(pl);
if(!hit) return false;
pl.capArrest=hit.cv; pl.capParkT=0; pl.speed=0;
pl.pos.y=hit.top+((typeof plParkLift==='function')?plParkLift(pl):0);   // 停机抬量 (2026-10-01d, 不再机腹埋进甲板)
pl.pitch=0; pl.roll=0; pl.yaw=hit.cv.yaw;
if(typeof spawnP==='function') spawnP(PT.dark,pl.pos.x,pl.pos.y,pl.pos.z,rand(-1,1),0.8,rand(-1,1),1.2,1.0,1.6,0.6,0.35);
if(pl.playerDriven&&typeof showScorePop==='function') showScorePop(t('拦阻钩停'));
return true;
}
function capLaunchPlane(pl,silent){
const cv=pl.capArrest||capCarrierOfTeam(pl.team);
if(!cv||cv.cls!=='cv') return false;
pl.capArrest=null; pl.capParkT=0;
const cat=(cv.cats&&cv.cats.length)?cv.cats[(pl.variant||0)%cv.cats.length]:null;
const lx=cat?cat.x:-cv.deck.hw*0.42, lz=cat?cat.z0:-cv.deck.hl*0.1;
const w=capToWorld(cv,lx,lz,_capW);
pl.pos.set(w.x, cv.pos.y+cv.deck.y+1.2, w.z);
pl.yaw=cv.yaw; pl.pitch=0.06; pl.roll=0;
pl.speed=pl.def.spd[1];                                    // 弹射 = 直接给顶速 (无滑跑段)
if(pl.fctl){ pl.fctl.spdTgt=pl.def.spd[1]; pl.fctl.bank=0; pl.fctl.pitchT=0.06; }
if(typeof spawnP==='function') spawnP(PT.flash,pl.pos.x,pl.pos.y,pl.pos.z,Math.sin(cv.yaw)*10,0,Math.cos(cv.yaw)*10,1.6,1.0,0.22,1,0,true);
if(typeof AudioSys!=='undefined') AudioSys.cannon(0.35);
if(!silent&&typeof showScorePop==='function') showScorePop(t('弹射起飞'));
return true;
}
// 开局停放: 把本队舰载机摆到本队航母甲板上 (23-deploy 在飞机建好之后调用)
function capParkPlanes(){
if(!capitalShips.length||typeof planes==='undefined'||!planes.length) return 0;
let n=0;
for(const pl of planes){
const cv=capCarrierOfTeam(pl.team);
if(!cv) continue;
const i=(pl.variant||0);
const lx=-cv.deck.hw*0.68, lz=cv.deck.hl*0.30-i*cv.deck.hl*0.20;
const w=capToWorld(cv,lx,lz,_capW);
pl.pos.set(w.x, cv.pos.y+cv.deck.y+((typeof plParkLift==='function')?plParkLift(pl):0), w.z);   // 停机抬量 (2026-10-01d)
pl.yaw=cv.yaw; pl.pitch=0; pl.roll=0; pl.speed=0;
pl.capArrest=cv; pl.capParkT=0;
pl.capArrest=cv; // 停放点已经在飞行甲板矩形内 (cv 全通甲板, 不受 cpDeckHW 收窄影响)
if(pl.pilotBot&&pl.pilotBot.pos) pl.pilotBot.pos.copy(pl.pos);
if(pl.grp){ pl.grp.position.copy(pl.pos); pl.grp.rotation.set(0,cv.yaw,0); }
n++;
}
return n;
}
// 停驻中的舰载机: F 登机 (20-player tryInteract 的第二优先级, 排在登舰之后)
function capNearestParkedPlane(){
if(!capitalShips.length||typeof planes==='undefined'||typeof player==='undefined'||!player) return null;
let best=null,bd=7;
for(const pl of planes){
if(!pl||!pl.alive||!pl.capArrest||pl.team!==player.team||pl.playerDriven) continue;
const d=Math.hypot(pl.pos.x-player.pos.x,pl.pos.z-player.pos.z);
if(d<bd&&Math.abs(pl.pos.y-player.pos.y)<3.5){ bd=d; best=pl; }
}
return best;
}
function capBoardPlane(pl){
if(!pl||!player) return false;
if(player.onNaval&&typeof navalSeatRelease==='function') navalSeatRelease();
if(player.onCapital) player.onCapital=null;
if(pl.pilotBot&&typeof pl.pilotBot.dismountVehicle==='function') pl.pilotBot.dismountVehicle(false);
pl.pilotBot=null; pl.playerDriven=true; pl.aiPilotOn=false;
player.onVehicle=pl;
player.yaw=pl.yaw+Math.PI; player.pitch=0; player.vel.set(0,0,0);
player.pos.copy(pl.pos); player.pos.y+=1.0;
if(typeof VM!=='undefined'&&VM.root) VM.root.visible=false;
if(typeof showScorePop==='function') showScorePop(t('登上 {0} · Space 弹射起飞',pl.name));
return true;
}

// ══════════════════════════════════════════════════════════════════════════
// 十七c、炮位接管 (2026-10-01b 用户裁定"各个分炮塔可以上去操控, 被打坏了就不能用")
// ══════════════════════════════════════════════════════════════════════════
// 口径:
//   · 走到炮位旁按 F 上炮 (与陆上反坦克炮/防空炮同一支交互语义), 再按 F 下炮;
//   · 座位字段 = player.capitalGun {ship,type,idx} (type 'main'|'sec'|'aa'), 与 onCapital 互不冲突
//     (接管中 onCapital 仍指向本舰 —— 平台搬运照常带着人走);
//   · 操控 = 视角即炮口: 鼠标视角 → 座圈回转/俯仰 (回转速率 CAPITAL_CFG.gunSlew, 主炮慢/防空快),
//     左键开火走与 AI 完全相同的 fireMainSalvo/fireSecondary/fireAA 单源 (同散布同弹速, 无任何制导);
//   · 报废炮位 (partHp≤0) 不可接管; 接管中被炸废 ⇒ capGunRelease(true) 就地退炮 (_partDead 调用);
//   · AI 不碰玩家接管的炮位 (aiTick 守卫); 玩家接管中该炮位的瞄准状态数组仍由本模块写,
//     _syncModel 照常把它摆到模型上 —— 单一数据流不变。
// ── 炮位世界锚点 (玩家的站立点): 主炮 = 炮座圈侧旁的甲板; 副炮/防空 = 座圈正下方 ──
function capGunAnchor(s,type,idx,out){
out=out||V3();
if(type==='main'){
const M=s.spec.main;
capToWorld(s,(M.ringR+1.5)*(idx%2?-1:1),M.ringZ[idx],_capW);
out.set(_capW.x,s.pos.y+s.deck.y,_capW.z);
}else{
const md=(type==='sec')?s.R.secMounts[idx]:s.R.aaMounts[idx];
capToWorld(s,md.lx,md.lz,_capW);
out.set(_capW.x,s.pos.y+md.y,_capW.z);
}
return out;
}
// 最近的可接管炮位: 距玩家 CAPITAL_CFG.gunR 内、未报废、舰体还在巡航态 (瘫舰炮位全废, 自然选不到)
function capGunNear(){
if(!capitalShips.length||typeof player==='undefined'||!player||!player.alive||player.spectator) return null;
if(player.onVehicle||player.onNaval) return null;
let best=null,bd=CAPITAL_CFG.gunR;
for(const s of capitalShips){
const sh=(player.onCapital===s)||capDeckOf(player.pos.x,player.pos.z)===s;
if(!sh) continue;                                   // 只接管脚下这条舰的炮位 (跨舰按 F 先登舰)
if(s.state!=='run') continue;
const test=(type,idx,lx,lz,y)=>{
const pa=s._partHpArr(type);
if(pa&&pa[idx]!==undefined&&pa[idx]<=0) return;    // 报废炮位不可接管 (用户裁定"打坏了就不能用")
const w=capToWorld(s,lx,lz,_capW);
// 竖直权重 0.6→0.35 (2026-10-01c 修"炮塔无法被玩家接管"的另一半): bb 副炮/防空坐在甲板室顶
//   (y≈15.0), 玩家站在甲板室旁的主甲板面上 (y≈12.7) —— 高差 2.3m 在旧权重下罚 1.4m, 水平 2.2m
//   的炮位算出 3.6m > gunR 3.4 ⇒ **永远选不中**。炮位的"可及性"以水平距离为主, 高差只做软惩罚。
const d=Math.hypot(w.x-player.pos.x,w.z-player.pos.z)+Math.abs((s.pos.y+y)-player.pos.y)*0.35;
if(d<bd){ bd=d; best={ship:s,type,idx,name:(type==='main')?s.spec.main.name:(type==='sec')?s.spec.sec.name:s.spec.aa.name}; }
};
const M=s.spec.main;
if(M) for(let i=0;i<M.n;i++) test('main',i,0,M.ringZ[i],s.deck.y);
for(let i=0;i<s.R.secMounts.length;i++){ const md=s.R.secMounts[i]; test('sec',i,md.lx,md.lz,md.y); }
for(let i=0;i<s.R.aaMounts.length;i++){ const md=s.R.aaMounts[i]; test('aa',i,md.lx,md.lz,md.y); }
}
return best;
}
// 换炮位 (2026-10-04 修复批 U3): 炮位座位上按 C 顺次换到本舰下一个可用炮位 (主→副→防空循环;
// 报废的跳过)。与上炮同走 capGunMount 单源 (座位账/视角初值/隐身武器模型全在里面), 换位瞬间
// 旧炮位的手自动让出 (AI 接管继续)。
function capGunCycle(){
if(typeof player==='undefined'||!player||!player.capitalGun) return false;
const s=player.capitalGun.ship;
if(!s||s.state!=='run') return false;
const seats=[];
const M=s.spec.main;
if(M) for(let i=0;i<M.n;i++) seats.push({type:'main',idx:i});
for(let i=0;i<s.R.secMounts.length;i++) seats.push({type:'sec',idx:i});
for(let i=0;i<s.R.aaMounts.length;i++) seats.push({type:'aa',idx:i});
const cur=seats.findIndex(g=>g.type===player.capitalGun.type&&g.idx===player.capitalGun.idx);
for(let k=1;k<=seats.length;k++){
const g=seats[(cur+k+seats.length)%seats.length];
const pa=s._partHpArr(g.type);
if(pa&&pa[g.idx]!==undefined&&pa[g.idx]<=0) continue;    // 报废炮位跳过
const nm=(g.type==='main')?(M&&M.name):(g.type==='sec')?(s.spec.sec&&s.spec.sec.name):(s.spec.aa&&s.spec.aa.name);
return capGunMount({ship:s,type:g.type,idx:g.idx,name:nm});
}
return false;
}
// 上炮: 站位钉到炮位锚点, 视角对准舷外 (初值给个 45° 舷角)
function capGunMount(g){
if(!g||!g.ship||!player) return false;
const s=g.ship;
if(s.state!=='run') return false;
const pa=s._partHpArr(g.type);
if(pa&&pa[g.idx]!==undefined&&pa[g.idx]<=0) return false;
capGunAnchorV(s,g.type,g.idx);
player.pos.set(_capGunV.x,_capGunV.y,_capGunV.z);
player.vel.set(0,0,0);
player.onCapital=s;
player.capitalGun={ship:s,type:g.type,idx:g.idx};
player.onGround=true; player.swim=false; player.wading=false; player.ads=false; player.prone=false;
// 初视角: 朝本舷外侧 (局部 +x 侧炮位朝右舷看, −x 朝左舷) —— 别一上炮就对着舰桥
capToLocal(s,player.pos.x,player.pos.z,_capL);
const side=(_capL.x>=0)?1:-1;
player.yaw=s.yaw+((side>0)?-HPI:HPI);   // 相机前向 = (-sin yaw,-cos yaw): 朝局部 +x 看 = yaw = s.yaw−π/2
player.pitch=0.05;
if(typeof playerChuteClear==='function') playerChuteClear();
if(typeof VM!=='undefined'&&VM.root) VM.root.visible=false;   // 炮位上无步兵武器模型 (与上坦克/炮位同规)
if(typeof showScorePop==='function') showScorePop(t('接管 {0} · F 下炮',g.name),0);
return true;
}
// 下炮: 人留在炮位旁的甲板上 (位置就是上炮时的锚点, 不动)
function capGunRelease(destroyed){
if(!player||!player.capitalGun) return;
player.capitalGun=null;
if(typeof VM!=='undefined'&&VM.root) VM.root.visible=true;
if(!destroyed&&typeof showScorePop==='function') showScorePop(t('离开炮位'),0);
}
// 接管中的一帧: 瞄准 (视角→座圈) + 开火 (左键) —— updateCapital 末尾调用
let _capGunV=null;                                       // 惰性槽 (沙箱桩 THREE 下不在载入期碰 V3)
function capGunAnchorV(s,type,idx){ _capGunV=_capGunV||V3(); return capGunAnchor(s,type,idx,_capGunV); }
function capGunTick(dt){
if(typeof player==='undefined'||!player||!player.capitalGun) return;
const g=player.capitalGun, s=g.ship;
if(!s||s.state!=='run'||!player.alive){ capGunRelease(s&&s.state!=='run'); return; }
const pa=s._partHpArr(g.type);
if(pa&&pa[g.idx]!==undefined&&pa[g.idx]<=0){ capGunRelease(true); return; }   // 接管中被炸废
if(player.onVehicle||player.onNaval){ capGunRelease(); return; }              // 座位互斥兜底
// 玩家开火意图 (mouseDown 是**按住态**): 主炮 = 整塔齐射 (与 AI 同一函数同一冷却); 副炮/防空 = 单座连发。
// 转塔对准门 (2026-10-01b): 炮口没转到位不出弹 —— 与 AI 的 0.06/0.10/0.16 rad 同一手感
// ("按下就响但弹道无视塔位"会读成坏掉; 等塔转过来才响 = 人在操炮)。
const firing=(typeof mouseDown!=='undefined'&&mouseDown);
if(g.type==='main'){
const M=s.spec.main;
const slew=CAPITAL_CFG.gunSlew.main, pc=CAPITAL_CFG.gunPitch.main;
const camYawW=Math.atan2(-Math.sin(player.yaw),-Math.cos(player.yaw));   // 相机前向的世界方位 (-sin,-cos)
const wantYaw=angDiff(s.yaw,camYawW);                                    // 目标塔舷角 = 世界方位 − 舰艏
const wantPitch=clamp(Math.asin(clamp(Math.sin(player.pitch),-1,1)),pc[0],pc[1]);
s.turYaw[g.idx]+=clamp(angDiff(s.turYaw[g.idx],wantYaw),-slew*dt,slew*dt);
s.turPitch[g.idx]=clamp(s.turPitch[g.idx]+clamp(wantPitch-s.turPitch[g.idx],-slew*dt,slew*dt),pc[0],pc[1]);
if(firing&&s.mainCd[g.idx]<=0&&Math.abs(angDiff(s.turYaw[g.idx],wantYaw))<0.07){
// 瞄准点 = 视线上的落点 (主炮弹道解算需要目标点): capGunAimDist 沿视线找地形/海面交点
const dist=capGunAimDist(s,600);
capGunAnchorV(s,'main',g.idx);
const cp2=Math.cos(player.pitch);
const tgt=V3(player.pos.x-Math.sin(player.yaw)*cp2*dist, player.pos.y+Math.sin(player.pitch)*dist+1.6, player.pos.z-Math.cos(player.yaw)*cp2*dist);
s.fireMainSalvo(g.idx,tgt);
}
}else{
const isSec=(g.type==='sec');
const md=isSec?s.R.secMounts[g.idx]:s.R.aaMounts[g.idx];
if(!md) { capGunRelease(); return; }
const slew=isSec?CAPITAL_CFG.gunSlew.sec:CAPITAL_CFG.gunSlew.aa;
const pc=isSec?CAPITAL_CFG.gunPitch.sec:CAPITAL_CFG.gunPitch.aa;
const o=s.mountLocalWorld(md,V3());
const camYawW=Math.atan2(-Math.sin(player.yaw),-Math.cos(player.yaw));
const wantYaw=angDiff(s.yaw,camYawW);
const aimY=player.pos.y+Math.sin(player.pitch)*60+1.6;
const wantPitch=clamp(Math.atan2(aimY-o.y,60),pc[0],pc[1]);
const arrY=isSec?s.secAimY:s.aaAimY, arrP=isSec?s.secAimP:s.aaAimP;
const cd=isSec?s.secCd[g.idx]:s.aaCd[g.idx];
arrY[g.idx]+=clamp(angDiff(arrY[g.idx],wantYaw),-slew*dt,slew*dt);
arrP[g.idx]=clamp(arrP[g.idx]+clamp(wantPitch-arrP[g.idx],-slew*dt,slew*dt),pc[0],pc[1]);
if(firing&&cd<=0&&Math.abs(angDiff(arrY[g.idx],wantYaw))<(isSec?0.10:0.16)){
const dir=V3(-Math.sin(player.yaw)*Math.cos(player.pitch),Math.sin(player.pitch),-Math.cos(player.yaw)*Math.cos(player.pitch));
if(isSec) s.fireSecondary(md,dir,g.idx); else s.fireAA(md,dir,g.idx);
}
}
}
// 主炮瞄准距离: 沿视线采样地形/海面, 取首个交点距离 (解算弹道用的目标点), 无交点 = 600m
function capGunAimDist(s,maxD){
const step=25;
const dx=-Math.sin(player.yaw)*Math.cos(player.pitch), dy=Math.sin(player.pitch), dz=-Math.cos(player.yaw)*Math.cos(player.pitch);
for(let d=step;d<=maxD;d+=step){
const x=player.pos.x+dx*d, y=player.pos.y+dy*d+1.6, z=player.pos.z+dz*d;
const gh=heightAt(x,z);
const wy=(typeof waterYAt==='function')?waterYAt(x,z):-1e9;
const floor=Math.max(gh,(wy>-1e8)?wy:-1e9);
if(y<=floor) return Math.max(60,d-step*0.5);
}
return maxD*0.75;
}

// ══════════════════════════════════════════════════════════════════════════
// 十七d、甲板炮手 (2026-10-01c 用户实报"炮塔内部也没有 Bot"): 每个炮位配**可见炮手**
// ══════════════════════════════════════════════════════════════════════════
// 口径:
//   · 编制 = 主炮每塔 1 人 + 副炮每座 1 人 + 防空每 3 座 1 人 (bb ≈9 / cv ≈7, 全场 +30 上下 —— 士兵
//     LOD 隔帧更新扛得住; 防空位是露天散点, 不必人人有形)。
//   · 实现 = 真 Bot 实例 (在 soldiers/combatants 里 ⇒ 可被子弹/爆炸命中、敌方 AI 会索敌), 但:
//     ① 网格挂进**舰体 grp** (局部坐标) ⇒ 舰动人在动, 零同步成本 (与旗杆/弹药箱同一读法);
//     ② 主循环 (24-main 士兵循环) 与 capRideCollect 都跳过它们 ⇒ 不跑 AI/不被平台搬运双写;
//     ③ respawnT=1e9 ⇒ 阵亡不占用重生 (die() 本身不扣票, 票走 21-match 的 attrition/旗点链 —— 零票务副作用);
//   · 炮位报废 (_partDead) ⇒ 该炮位炮手就地阵亡; 舰瘫痪 (cripple) ⇒ 全员阵亡; 玩家接管炮位 ⇒ 该炮手
//     隐身 (你顶替了他的位置), 下炮恢复。复位 (capitalReset) ⇒ 全员换新 (与炮位血量同账)。
//   · 红线: crew 的 userData 不放对象引用 (名牌自愈契约); mesh.tag 出生即隐 (炮手不挂名牌)。
function capCrewClear(s){
if(!s.crewBots) return;
for(const b of s.crewBots){
if(b.mesh&&b.mesh.root&&b.mesh.root.parent) b.mesh.root.parent.remove(b.mesh.root);
const i1=combatants.indexOf(b); if(i1>=0) combatants.splice(i1,1);
const i2=soldiers.indexOf(b); if(i2>=0) soldiers.splice(i2,1);
}
s.crewBots.length=0;
}
function capCrewAnchorLocal(s,type,idx,out){
out=out||{x:0,y:0,z:0};
if(type==='main'){
const M=s.spec.main;
out.x=(M.ringR+1.5)*(idx%2?-1:1)*0.72; out.z=M.ringZ[idx]+M.ringR*0.72; out.y=s.deck.y;
}else{
const md=(type==='sec')?s.R.secMounts[idx]:s.R.aaMounts[idx];
const off=(type==='sec')?1.5:1.15;                     // 站在炮座旁 (别和炮管 z-fight)
out.x=md.lx+((idx%2)?-off:off); out.z=md.lz; out.y=md.y;
}
return out;
}
function capitalCrewSpawn(s){
capCrewClear(s);
if(s.state!=='run') return 0;                          // 瘫痪舰不配炮手 (capitalReset 先把 state 摆正, 顺序无虞)
if(typeof Bot==='undefined'||typeof buildSoldierMesh==='undefined') return 0;
if(!s.crewBots) s.crewBots=[];
let n=0;
const add=(type,idx)=>{
const b=new Bot(s.team,0,'炮手');
b.capCrew={ship:s,type,idx};
b.alive=true; b.hp=100; b.respawnT=1e9;                // 阵亡不复活 (编制随舰, 不走兵力循环)
b.objective=null; b.inSquad=false;
b.yaw=s.yaw+((capCrewAnchorLocal(s,type,idx,{}).x>=0)?-HPI:HPI);   // 布娃娃朝向取站位朝向 (spawnRagdoll 读 bot.yaw)
if(b.mesh){
if(b.mesh.tag) b.mesh.tag.visible=false;             // 炮手不挂名牌 (甲板上一排名牌太闹)
b.mesh.root.rotation.order='YXZ';
s.grp.add(b.mesh.root);                               // 挂进舰体 ⇒ 平台移动零同步
}
const a=capCrewAnchorLocal(s,type,idx,{});
b.mesh.root.position.set(a.x,a.y,a.z);
b.mesh.root.rotation.y=(a.x>=0)?HPI:-HPI;              // 局部系站位朝向 (capCrewTick 每帧随炮覆写; 网格挂在舰体下必须写**相对**角)
capCrewWorldPos(s,b);                                  // 世界坐标初始化 (命中/索敌链读它)
s.crewBots.push(b);
n++;
};
const M=s.spec.main;
if(M) for(let i=0;i<M.n;i++) add('main',i);
for(let i=0;i<(s.spec.sec?s.spec.sec.n:0);i++) add('sec',i);
const aaN=s.spec.aa?s.spec.aa.n:0;
for(let i=0;i<aaN;i+=3) add('aa',i);                   // 每 3 座防空 1 名炮手 (站位取首座)
return n;
}
function capCrewWorldPos(s,b){
const a=capCrewAnchorLocal(s,b.capCrew.type,b.capCrew.idx,_capL);
capToWorld(s,a.x,a.z,_capW);
b.pos.set(_capW.x,s.pos.y+a.y,_capW.z);
}
function capCrewTick(s,dt){
if(!s.crewBots) return;
const gun=(typeof player!=='undefined'&&player&&player.capitalGun&&player.capitalGun.ship===s)?player.capitalGun:null;
for(const b of s.crewBots){
if(!b.capCrew) continue;
if(!b.alive){
// 阵亡: 就地倒伏 (网格在舰体局部系 ⇒ 舰动尸也在动), 12s 后收走
b._crewDeadT=(b._crewDeadT||0)+dt;
if(b.mesh){
if(!b._crewToppled){ b._crewToppled=true; b.mesh.root.rotation.x=-HPI; b.mesh.root.position.y-=0.85; }
if(b._crewDeadT>12) b.mesh.root.visible=false;
}
continue;
}
capCrewWorldPos(s,b);
// 炮手随炮转向 (2026-10-01d, 实机"Bot 操作炮的动作非常不自然"): 网格挂在**舰体局部系**, 转角直接
//   用该炮位的舰体相对瞄准角 (turYaw/secAimY/aaAimY) —— 炮转到哪人跟到哪, 同一数据源零同步成本。
//   (初值那个 ±HPI 是把**世界朝向**写进局部系的旧笔误, 舰一转人就横过来站 —— 同批修正。)
if(b.mesh&&!b._crewToppled){
const t=b.capCrew;
const ry=(t.type==='main')?s.turYaw[t.idx]:(t.type==='sec')?s.secAimY[t.idx]:s.aaAimY[t.idx];
b.mesh.root.rotation.y=(ry!==undefined&&ry!==null)?ry:((capCrewAnchorLocal(s,t.type,t.idx,_capL).x>=0)?HPI:-HPI);
}
// 玩家接管该炮位 ⇒ 炮手让位隐身 (下炮恢复)
const hidden=gun&&gun.type===b.capCrew.type&&gun.idx===b.capCrew.idx;
if(b.mesh) b.mesh.root.visible=!hidden;
}
}
// 弹体实体判定 (2026-10-01c, 用户实报"手雷、巡飞弹等命中大船会穿过去"): 全弹种通用的"舰体是实体"单源。
//   与 capitalRayHit (射线, 只认敌舰) 互补 —— 这一支是**点查询, 不分敌我** (自己甲板也是陆地):
//   舰体矩形 (半宽/半长 = spec.hullW/L, 比 deck 矩形大一圈 —— 舷侧也拦) 内且 y 在 [水线−2, 甲板面+0.25]。
//   ★2026-10-01d 实机"巡飞弹在离甲板比较近却没有接触的时候会被引爆": 旧带顶 +2.6 把甲板上空 2.6m
//   的**空域**也当成了实体 —— 掠过飞行甲板的巡飞弹/手雷在没碰到任何东西时就引爆。实体带的顶就是
//   甲板面 (+0.25 容差吃落弹穿帧); 甲板上空是空域, 巡飞弹贴甲板掠过不再炸 (真接触由调用方的
//   capitalRayHit 射线管 —— 上层建筑/舰岛/炮塔的侧面都是 boxes, 那些才拦得住)。
//   返回 {ship, surf}: surf = 爆点/落点高度 (点在甲板带内 = 甲板面; 点在舷侧低处 = 夹回水线+1)。
function capitalSolidAt(x,y,z){
if(!capitalShips.length) return null;
for(const s of capitalShips){
if(!s.alive) continue;
const dx=x-s.pos.x, dz=z-s.pos.z;
if(dx*dx+dz*dz>(s.spec.hullL*0.5+6)*(s.spec.hullL*0.5+6)) continue;
capToLocal(s,x,z,_capL);
if(Math.abs(_capL.x)>s.spec.hullW*0.5+0.3||Math.abs(_capL.z)>s.spec.hullL*0.5+0.3) continue;
const deckY=s.pos.y+s.deck.y;
if(y>deckY+0.25) continue;                             // 甲板上空 —— 空域 (2026-10-01d 收窄, 见上)
if(y<s.pos.y-2) continue;                              // 舰底以下 (贴底过路的东西不管)
return {ship:s, surf:clamp(y,s.pos.y+1.0,deckY)};
}
return null;
}
// 甲板建筑实体点查询 (★2026-10-03 修"手雷等实体穿甲板上的建筑"): 桥楼/烟囱/炮塔等上层建筑盒
//   (s.boxes, 舰局部 {lx,ly,lz,hw,hh,hd} 与 capitalRayBoxes 同表)。capitalSolidAt 只罩舰壳矩形+
//   甲板带 (甲板上空是空域), 超结构对它不存在 ⇒ 手雷/巡飞弹从桥楼正中穿过。命中返回 {ship,b,surf}
//   (surf=盒顶世界高); margin 0.06 与 nadeStep 地面盒判据同宽。点查询, 无方向 —— 弹速快的单帧
//   穿透由调用方自己的"位置已进实体"兜底语义承担 (与 capitalSolidAt 同款)。
function capSuperSolidAt(x,y,z){
if(!capitalShips.length) return null;
for(const s of capitalShips){
if(!s.alive) continue;
const dx=x-s.pos.x, dz=z-s.pos.z;
if(dx*dx+dz*dz>(s.spec.hullL*0.5+6)*(s.spec.hullL*0.5+6)) continue;
capToLocal(s,x,z,_capL);
const ly=y-s.pos.y;
for(let k=0;k<s.boxes.length;k++){
const b=s.boxes[k];
if(Math.abs(_capL.x-b.lx)<=b.hw+0.06&&Math.abs(ly-b.ly)<=b.hh+0.06&&Math.abs(_capL.z-b.lz)<=b.hd+0.06){
return {ship:s,b,surf:s.pos.y+b.ly+b.hh};
}
}
}
return null;
}

// ══════════════════════════════════════════════════════════════════════════
// 十八、世界还原 (与小艇同规: 复位到开局态, 不是"清空")
// ══════════════════════════════════════════════════════════════════════════
function capitalReset(){
for(const s of capitalShips){
capSeatReleaseIf(s);
s.respawnClear(null);
capitalCrewSpawn(s);                                 // 炮手换新 (2026-10-01c): 与炮位血量同账 —— state 已被 respawnClear 摆回 'run'
}
if(typeof player!=='undefined'&&player&&player.capitalGun) player.capitalGun=null;
// 甲板旗点重绑 (2026-10-01b): 旗点局部坐标/跟随链依赖本表 —— 复位后重算一遍, 与开局逐位一致
capitalFlagBind();
}
function capSeatReleaseIf(s){
if(typeof player!=='undefined'&&player&&player.onCapital===s) capSeatRelease();
}
