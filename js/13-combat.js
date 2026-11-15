// ─────────────────────────────────────────────
// 13-combat.js —— 射击/火箭/手雷/爆炸伤害
// 源: Index.original.html 第 4274-4477 行
// ─────────────────────────────────────────────
'use strict';
// ===== 跳伞统一判定单源 (2026-09-21 A#8, 契约 §7) =====
// 伞降中 = "带伞且未落地" —— 玩家用 p.chute/p.onGround, Bot 走 chuting 链时同步置同一对字段
// (见 14-bots 的 chuteBegin/chuteEnd), 于是伤害倍率/索敌过滤全体共用这一支, 不再各写一套。
// 数值单源: js/00-config.js 的 CHUTE_DEF (dmgMul / botEngageR / landClearT)。
function chuteAirborne(p){ return !!(p&&p.chute&&!p.onGround); }
function chuteDamageMul(p){ return chuteAirborne(p)?CHUTE_DEF.dmgMul:1; }
// pad (可选, 2026-09-17 观战扩展批): "弹体判定半径" —— 坦克主炮炮弹按 SHELL_R 扩大命中体
// (头部小球与躯干圆柱同步外扩), 用于"稍作增大坦克炮弹判定"; 子弹/其他调用方不传 = 原判定不变。
// ===== 无差别火力判定单源 (2026-09-20 观战连狙批; 2026-11-09 观战中立批扩权) =====
// 2026-11-09 用户裁定: **观战者本尊的全部步兵武器对双方生效** (枪械/火箭筒/手持迫击炮; 投掷手雷的中立
//   另在 nadeExplode/explodeAt 按弹种收口)。附身宿主开火仍是宿主 Bot 的弹, 不吃本门。
//   spectator 门 = shooter.spectator 即放开, 但**真实载具座位上除外**: 艇机炮走 fireBullet(shooter=
//   player), 不排除就借本门变成无差别火力, 违反"座位武器不含"的裁定。观战者可达的真实座位只有舰船座位
//   (onNaval): 固定炮位被 tryInteract ③ 挡住, 真坦克/真飞机被"不得征用真载具"
//   挡住; 幽灵坦克由 ffAll 覆盖, 不依赖 spectator 门。(2026-11-10: capitalGun 门随大舰子系统下架摘除)
//   ffAll        = 幽灵坦克驾驶态 (观战专属载具, 2026-09-17 观战扩展批), 主炮/同轴机枪沿用;
//   ffSpecSniper = 观战连狙专属标记, 只在"观战者手上/正在开火的武器 key==='specsniper'"时为 true
//                  (20-player playerFireTick 每帧同步 + playerShoot 开火瞬间落定; 18-game die / 22-hud 换局复位)。
// 判据收进 coFfFire 一个函数, 让**步兵弹道 / 载具刮痕 / 艇舰射线门**同源, 避免"能打人却不能打艇"这类不一致;
// 压制/惊动有自己的观战早退, 观战开火照旧不压制不惊动任何一方 (含友军)。
function coFfFire(shooter){
if(!shooter) return false;
if(shooter.ffAll||shooter.ffSpecSniper) return true;
return !!(shooter.spectator&&!shooter.onNaval);
}
// ===== 观战者座驾判定单源 (2026-09-26H 观战批, 用户实报) =====
// "观战者驾驶的载具 = 观战者身体的延伸"。观战者**本体**早已不被索敌/不被伤害 (14-bots 索敌过滤 + damage 早退),
// 但他坐进的载具是别人的对象 (Tank/Plane/NavalCraft), 旧版一律按普通载具处理, 于是:
//   (i) 车被 AI 索敌 + 被击毁 —— 一个人正看着战局, 脚下的车却按战场规则被点名;
//   (ii) 车毁链劈叉 —— Tank.die / Plane.die 调 player.damage(999) 想杀驾驶员, 对观战者是**空操作**
//        (18-game damage 早退), 于是观战者被留在残骸里, 而 2 个轻量乘员名额照结算 (本方掉 2 票 + 击杀者 +2 杀)。
// 用户 2026-09-26 原话: "观战模式操纵双方载具会被索敌和击毁，而且会带着观战模式的玩家一起死。"
// 本函数是**唯一判据** —— 五处索敌扫描 (enemyTankNear / tankPerceive / planeAI / navalNear / 岸防炮 pickTarget)
// 与三处伤害入口 (Tank/Plane/NavalCraft.takeDmg) 全部读它, 不各写一套 (新增载具类时照着接一处即可)。
// 判据 = "这辆车正被观战者驾驶": playerDriven 且 player 的**座位字段**指着它 —— 坦克/战机走 onVehicle、
// 舰艇走 onNaval, 与 20a-seats 的"两座位字段同一时刻最多一个非空"契约同源 (所以这里用 || 而不判车种)。
function specRide(v){
if(!v||!v.playerDriven) return false;
if(typeof player==='undefined'||!player||!player.spectator) return false;
return player.onVehicle===v||player.onNaval===v||player.onCapital===v;   // onCapital: P4 大舰座位 (2026-09-30), 与另两个座位字段同一互斥契约
}
// ═════════════════ 瞄准吸附 (轻度自动吸附, 2026-09-27 用户本批要求) ═════════════════
// 用户原话: "给瞄准模式(包括开镜和普通瞄准)和载具火力瞄准增加一个轻度的自动吸附"。
// 做法 —— **只在"输入方向 → 出膛方向"的交界处掰一次弹道**, 且只此一处判强度/挑目标 (唯一单源):
//   · 不做准星/相机牵引: 那会与鼠标抢手感, 且载具/第三人称/观战下没有统一写法 (要的是"轻微更好打", 不是"帮你转视角")。
//   · **只处理"差一点打中"的那一枪**: 逐目标先算它的角半径 rAng, 只有弹道**擦不到本体**(ang>rAng) 才动手,
//     且擦出的距离 (over=ang-rAng) 不超过本武器档的容差 cone —— 大偏仍是大偏。
//   · 已经指着本体任一部分的 (ang≤rAng) **一概不动** ⇒ "起点→准星命中点"这条既有契约在"已命中"时逐字保持
//     (第三人称的准星=落点 / 命中的是腿就是腿, 不会被"抬到胸口")。这也是 dev/verify-specthird T6 的口径。
//   · ★2026-11-08 爆头批: 士兵双靶点 (爆头球 + 胸口)。旧版只瞄胸口 ⇒ 瞄站立敌人头部时射线在胸球外 0.13m
//     ⇒ over>0 ⇒ 被向下掰 0.29k 米 (与距离无关; 标准档 0.28~0.33m > 爆头球半径 0.26m ⇒ 站立敌人任何距离
//     都爆不了头, 蹲/卧敌人的头在胸球内反而没事 —— 用户实测"明明瞄的很准却总是无法爆头"的病根)。
//     现口径: 头/胸任一"已指着" ⇒ 整兵不掰 (吸附绝不与爆头瞄准对抗); 差一点打中头 ⇒ 掰向**头部** (落点
//     进球 35% 深 = 距球心 ~0.09m = 真爆头); 差一点打中身体 ⇒ 掰向胸口 (旧行为不变)。
//   · 掰角 = (over + 0.35·rAng) × k, 再按 cap 与"不得越过目标中心(≤ang)"两道夹:
//     目标位置 = 落进本体 35% 深 ⇒ 近失误变命中, 而不是"边缘蹭一下"; 硬上限保证看不出拐弯。
//   · 遮挡检查 (一次世界射线 + 一次人体射线): 隔墙/穿过别人(含队友)的吸附一律不做 —— 吸附绝不制造"打墙/打队友"。
//   · 档位 = SETTINGS.aim (0 关 / 1 轻度 / 2 标准, 游戏设置里实时改, 默认 1 轻度); 关档时本函数**原样返回入参引用**
//     (零分配/零漂移)。目标集合: 步兵 (爆头球+胸口双靶点) + 坦克/卡车/战机/舰艇 (车体中心); 巡飞弹/迫击炮/航弹/鱼雷这些
//     **曲射·面杀伤**不接 (那几样没有"准星吸附"的语义)。
// AI 一枪不吃 —— 判据是**调用点**: 只有玩家侧的开火链调本函数 (20-player.playerShoot 两处 / 20a-seats 八处 /
//   16-aircraft.fireMGBurst 的 shooter===player 分支), 与 specRide/coFfFire 同一种"单源 + 接线点"纪律。
//   新增玩家火力链时照着接一处 (dev/verify-aimassist.js 有静态断言清单, 漏接线会被探针点名)。
// 数值口径: 容差 cone 1.5~3.4° 是**"擦出的距离"**(不是"与目标中心的夹角"), 所以大目标 (坦克/舰艇) 的
//   有效窗口天然更宽; k 0.8~1.0 (再乘档位), 硬上限 1.1~2.2° —— 200m 处 1°≈3.5m, 即"半步以内的偏差"才有感,
//   是"把散到身边的那一枪拉回身上"级别, 不改交战距离与 TTK 台阶。
const AIM_PROFILES={
hip:  { cone:1.6, k:0.85, range:170, cap:1.3 },   // 步兵普通瞄准 (腰射)
ads:  { cone:2.2, k:1.00, range:240, cap:1.8 },   // 步兵开镜 (含观战连狙 4x)
mg:   { cone:1.5, k:0.80, range:210, cap:1.1 },   // 机枪/航炮 (固定 MG · 同轴·并列 · 机炮)
airmg:{ cone:5.0, k:0.95, range:350, cap:3.4 },   // 战机航炮 (P3-7a 立, 7b-甲 2026-09-30 按用户实机反馈加宽:
                                                  //   旧 2.6/1.9 是"差半步"微调档, 空战实际误差 5~20° 掰不动 ⇒
                                                  //   "有辅助也无效")。窗口 5°/硬上限 3.4° —— 200m 处 3.4°≈11.9m,
                                                  //   "追着修正"级别; 对空对地扫射同吃此档 (用户裁定: 驾驶时都要有辅助)
heavy:{ cone:3.0, k:0.90, range:360, cap:2.0 },   // 直瞄重火力 (坦克炮 · 舰炮 · 反坦克炮 · 岸防炮 · 火箭筒)
air:  { cone:3.4, k:0.95, range:360, cap:2.2 },   // 对空 (防空炮; 同族目标含飞机)
};
const AIM_TIER_CONE=[0,1.00,1.25];   // 档位 → 容差倍率 (0=关)
const AIM_TIER_K   =[0,0.85,1.15];   // 档位 → 掰角倍率
// 只读视图 (探针/控制台自检用): 打了几枪/吸了几次/上一次掰了几度 —— 用户想当场确认"它在起作用"就看这里。
const AIM_ASSIST={ tier:0, shots:0, assisted:0, blocked:0, lastBend:0, lastKind:'', lastTarget:'' };
function aimAssistTier(){
if(typeof SETTINGS==='undefined'||!SETTINGS) return 0;   // 部分脚本的沙箱: 无 SETTINGS = 关
const t=SETTINGS.aim;
return (t===1||t===2)?t:0;
}
const _aaU=V3();   // 复用槽: 指向目标的单位向量 (只在本函数内用, 不跨调用)
// 返回: 掰过的**新**方向 (Vector3); 未吸附 (含关档) 时原样返回 dir。
// opt: { team 己方阵营 (同队不做吸附对象; null/undefined = 不限), ff 无差别火力 (放开同队过滤),
//        self 自己的座驾 (排除; 自己本体恒排除) }
function aimAssistDir(origin,dir,profKey,opt){
const tier=aimAssistTier();
AIM_ASSIST.tier=tier;
if(!tier||!origin||!dir) return dir;
const P=AIM_PROFILES[profKey]||AIM_PROFILES.hip;
const deg=Math.PI/180;
const cone=P.cone*AIM_TIER_CONE[tier]*deg;
const cap=P.cap*AIM_TIER_CONE[tier]*deg;
const k=P.k*AIM_TIER_K[tier];
// 夜档: 只缩搜索距离 ×aimMul, 锥角 cone/cap 与掰角 k 分档不动 (瞄准吸附分档契约不破, 昼夜设计 §3.3)
// 天气乘子 (天气设计 §5-8/R6): 同语义独立相乘 —— 晴朗档 ×1 逐位不变, 暴雨/暴风雪档辅瞄距离收到 0.65。
const range=P.range*(NIGHT_MODE?NIGHT_CFG.aimMul:1)*WX_CFG.aimMul, range2=range*range;
const o=opt||{};
const team=(o.team===undefined)?null:o.team;
const ff=!!o.ff, self=o.self||null;
const me=(typeof player!=='undefined')?player:null;
AIM_ASSIST.shots++;
// ── 候选: 取"擦出距离最小"的那一个 (只做一轮, 不排序: 每枪最多一次 acos/候选) ──
let bAng=1e9,bOver=1e9,bR=0,bEx=0,bEy=0,bEz=0,bObj=null,bTag='';
// ★2026-11-08 爆头批: 士兵双靶点暂存槽 —— 头/胸两部位都测完、且"已指着"旗未立时才并入全局候选。
//   必须先暂存: 瞄胸口时头球 over>0 会先抢注全局, 直接写 b* 就绕过了"已指着不动"守卫 (瞄胸被掰上头)。
let gA=1e9,gO=1e9,gR=0,gX=0,gY=0,gZ=0,gTag='';
let aaOn=0;   // "已指着"旗: 候选部位 over≤0 时置 1 —— 士兵头/胸任一指中 ⇒ 整兵不掰 (载具同用此旗但只写不读)
const test=(px,py,pz,r,obj,tag,stg)=>{
if(obj===self||obj===me||obj===null) return;
if(!ff&&team!==null&&obj.team===team) return;      // 同队: 不做吸附对象 (避免"帮你打队友")
const ex=px-origin.x, ey=py-origin.y, ez=pz-origin.z;
const d2=ex*ex+ey*ey+ez*ez;
if(d2<1.44||d2>range2) return;                     // <1.2m 贴脸不做 (那是直接命中, 不需要吸附)
const d=Math.sqrt(d2), inv=1/d;
const dot=(ex*dir.x+ey*dir.y+ez*dir.z)*inv;
if(dot<=0.5) return;                               // 侧后方 60° 以外直接排除 (省掉 acos)
const ang=Math.acos(dot>1?1:dot);
const rAng=Math.atan2(r,d);                        // 目标角半径 (本体在准星上占多宽)
const over=ang-rAng;                               // "擦出的距离": >0 才是真的差一点打中
if(over<=0){ aaOn=1; return; }                     // 已经指着本体 ⇒ 不动 (保"起点→准星命中点"契约, 也不改命中部位)
if(over>cone) return;                              // 偏太多: 大偏仍是大偏
if(stg){ if(over<gO){ gO=over; gA=ang; gR=rAng; gX=ex; gY=ey; gZ=ez; gTag=tag; } }   // 士兵部位 → 暂存
else if(over<bOver){ bOver=over; bAng=ang; bR=rAng; bEx=ex; bEy=ey; bEz=ez; bObj=obj; bTag=tag; }
};
if(typeof soldiers!=='undefined') for(const s of soldiers){
if(!s||s.alive===false||s.spectator) continue;
if(typeof seatShielded==='function'&&seatShielded(s)) continue;   // 在座乘员不是可命中目标 (与命中管线同口径)
// 双靶点: ①爆头球 (与 raySoldiers 命中几何同位同径: eyeY+0.06 ⇒ 站1.68/蹲1.21/卧0.56, r=0.26)
//         ②胸口 (旧行为 y+1.10 r=0.45)。顺序无关 —— 暂存+末尾统一裁决。
aaOn=0; gO=1e9;
test(s.pos.x,s.pos.y+(s.prone?0.56:s.crouch?1.21:1.68),s.pos.z,0.26,s,'solHead',1);
test(s.pos.x,s.pos.y+(s.prone?0.55:1.10),s.pos.z,0.45,s,'sol',1);
if(!aaOn&&gO<bOver){ bOver=gO; bAng=gA; bR=gR; bEx=gX; bEy=gY; bEz=gZ; bObj=s; bTag=gTag; }
}
if(typeof tanks!=='undefined') for(const t of tanks){ if(t&&t.alive) test(t.pos.x,t.pos.y+1.0,t.pos.z,2.6,t,'tank'); }
if(typeof trucks!=='undefined') for(const t of trucks){ if(t&&t.alive) test(t.pos.x,t.pos.y+1.0,t.pos.z,1.8,t,'truck'); }
if(typeof planes!=='undefined') for(const pl of planes){
if(pl&&pl.alive) test(pl.pos.x,pl.pos.y,pl.pos.z,planeHitR(pl),pl,'plane'); // 7c: 命中半径单源 planeHitR (旧手写 2.4×size)
}
if(typeof navalCraft!=='undefined'&&Array.isArray(navalCraft)) for(const c of navalCraft){
if(c&&c.alive&&c.state!=='wreck'&&c.state!=='sinking') test(c.pos.x,c.pos.y+1.6,c.pos.z,4.6,c,'naval');
}
// (2026-11-10: 大舰吸附候选块随大舰子系统下架摘除)
if(!bObj) return dir;
const td=Math.sqrt(bEx*bEx+bEy*bEy+bEz*bEz);
if(td<1.5) return dir;
const ux=bEx/td, uy=bEy/td, uz=bEz/td;
_aaU.set(ux,uy,uz);
// ① 静态遮挡: 目标前 0.6m 有世界碰撞体 ⇒ 不吸 (别把子弹吸到掩体上)
const wr=raycastWorld(origin,_aaU,Math.max(0.1,td-0.6));
if(wr){ AIM_ASSIST.blocked++; return dir; }
// ② 人体遮挡: 沿该射线的**第一个**被打中的必须是它 (队友/别人挡在前面就不吸; 载具目标不做这一次 ——
//    子弹打中挡路的步兵本来就该算那一枪, 而挡路的载具由弹道自己裁决)
if((bTag==='sol'||bTag==='solHead')&&typeof raySoldiers==='function'){
const sr=raySoldiers(origin,_aaU,Math.max(0.2,td-0.4),self||me,0,true);
if(sr&&sr.sol!==bObj){ AIM_ASSIST.blocked++; return dir; }
}
const cosA=clamp(dir.x*ux+dir.y*uy+dir.z*uz,-1,1);
const sinA=Math.sin(bAng);
if(sinA<1e-5) return dir;
// 掰角 = (擦出距离 + 本体角半径×0.35) × k —— 目标位置 = 落进本体 35% 深 (不是"边缘蹭一下");
// 两道夹: 不得越过目标中心 (≤ bAng), 且不超过硬上限 cap。
let bend=(bOver+bR*0.35)*k;
if(bend>bAng) bend=bAng;
if(bend>cap) bend=cap;
if(bend<2e-5) return dir;                          // ~0.001°: 不值得为它分配
// Rodrigues (轴 ⟂ dir): dir' = dir·cos(bend) + (u - dir·cosA)·sin(bend)/sinA —— 精确、无三角函数近似
const f=Math.sin(bend)/sinA, cb=Math.cos(bend);
const out=V3(dir.x*cb+(ux-dir.x*cosA)*f, dir.y*cb+(uy-dir.y*cosA)*f, dir.z*cb+(uz-dir.z*cosA)*f);
if(out.lengthSq()<1e-8) return dir;
out.normalize();
AIM_ASSIST.assisted++; AIM_ASSIST.lastBend=bend/deg; AIM_ASSIST.lastKind=profKey; AIM_ASSIST.lastTarget=bTag;
return out;
}
// noTeamFilter (可选, 2026-09-20 第三人称批): 只用于**瞄准**求交点 (20-player tpAimPoint) ——
// "准星指着谁"与"能不能打他"是两件事, 瞄准时不做敌我过滤; 伤害过滤仍只认 coFfFire。
// 逐候选兵复用槽 (2026-09-26 性能批): 旧版每个候选兵 new 一个 {x,z,r,y0,y1} —— 本函数在
// 每条弹道 (fireBullet) / 每次近战 / 每发载具机枪 / 玩家准星拾取上都会跑, 40 人图上每次 40 个对象。
// rayCyl 只读入参 (逐字段算 t/y/法向, 不保存引用), 复用同一个槽安全。
const _rsCyl={x:0,z:0,r:0,y0:0,y1:0,dead:false};
function raySoldiers(o,dir,maxD,shooter,pad,noTeamFilter){
const ex=pad||0;
let best=null,bestT=maxD;
// 观战者不参与命中判定 (2026-09-26H 观战批 A1): 旧版候选过滤只有"活着/非射手/不在车上", 观战者虽免伤却**实体**
// 存在 ⇒ 队友站他后面等于多一面无敌活体掩体 (子弹/坦克炮弹都在他身体上停住), 观战者开火时也会吃掉对面射向
// 别人的弹。与 14-bots:512 / 15-vehicles:205,1076 / 16-aircraft:427 / 21-match 的既有"观战者不计入"同口径。
for(const s of combatants){
if(!s.alive||s===shooter||s.onVehicle||s.spectator) continue;
// 敌我过滤失效: ffAll (幽灵坦克驾驶) 或 ffSpecSniper (观战连狙) —— 见 coFfFire
if(shooter&&!noTeamFilter&&!coFfFire(shooter)&&s.team===shooter.team) continue;
const eyeY=s.pos.y+(s.prone?0.5:s.crouch?1.15:1.62);
const hx=s.pos.x-o.x, hy=eyeY+0.06-o.y, hz=s.pos.z-o.z;
const tProj=hx*dir.x+hy*dir.y+hz*dir.z;
const hr=0.26+ex;
if(tProj>0.2&&tProj<bestT){
const px=o.x+dir.x*tProj-s.pos.x, py=o.y+dir.y*tProj-(eyeY+0.06), pz=o.z+dir.z*tProj-s.pos.z;
if(px*px+py*py+pz*pz<hr*hr){ best={sol:s,t:tProj,head:true}; bestT=tProj; continue; }
}
const c=_rsCyl;
c.x=s.pos.x; c.z=s.pos.z; c.r=(s.prone?0.5:0.38)+ex; c.y0=s.pos.y; c.y1=s.pos.y+(s.prone?0.6:s.crouch?1.25:1.55);
const r=rayCyl(o,dir,c,bestT);
if(r){ best={sol:s,t:r.t,head:false}; bestT=r.t; }
}
return best;
}
function fireRocket(shooter,origin,dir,def,vis){
// 出生保护清账 (★2026-11-01 判定批, 与 fireBullet 同一契约"开火即解除"): 旧版清账只挂在 fireBullet,
// 火箭/坦克主炮/固定炮/迫击炮这些**不走 fireBullet 的直接出膛口**不清 —— 部署落地 2s 保护期内照样能开火
// ("无敌帧内不许输出"漏了这几条路; 探针豁免先清 protUntil, 行为面零波及)。
if(shooter&&shooter.protUntil) shooter.protUntil=0;
const vel=dir.clone().multiplyScalar(170); // 2026-09-28 用户裁定弹速×2 (旧 85; 火箭筒/反坦克火箭)
shooter._src=def.name||''; // 击杀来源: 火箭筒开火即记入 (2026-09-29 修: 玩家火箭分支提前 return 走不到 20-player 的 _src 行, 击杀播报读成上次开火的枪名)
shells.push({pos:origin.clone(),vel,team:(shooter.spectator?-1:shooter.team),owner:shooter,life:3.6,kind:'at',dmgV:def.atDmg||320,trail:0,rocket:true,src:def.name||''}); // src: 弹体自带标签, 命中时重盖章 (见 updateShells); team: 2026-11-09 观战中立批 —— 观战者本尊的火箭无差别 (幽灵坦克 team:-1 同约定); 非观战射手逐位不变
spawnP(PT.flash,origin.x,origin.y,origin.z, dir.x*2,dir.y*2,dir.z*2, 0.6,6,0.1,1,0,true);
spawnP(PT.dark,origin.x,origin.y,origin.z, dir.x*2+rand(-1,1),1.5,dir.z*2+rand(-1,1), 0.9,2.5,0.8,0.7,0.5);
AudioSys.cannon(origin.distanceTo(camera.position));
shooter.lastFiredT=nowT;
if(typeof player!=='undefined'&&player&&player.specViewHost&&player.specViewHost===shooter&&typeof svHostFireFx==='function') svHostFireFx(def);   // 真附身 (2026-11-04): 与 fireBullet 同款出膛反馈钩 —— 宿主打火箭视角同样有后坐/枪口焰 (旧版只挂枪械弹)
}
// fireBullet 逐发账复用槽 (2026-11-01 性能批): 命中圆柱/立体声 pan 向量, 本函数内串行消费不持有
const _fbCyl={x:0,z:0,r:2.3,y0:0,y1:0};
const _fbTrkCyl={x:0,z:0,r:2.2,y0:0,y1:0};
const _fbPan=V3(0,0,1);
// ── 2026-11-13 性能批 C: fireBullet/explodeAt/splashDamage 逐发/逐受害者分配槽位化 ──
// 参考仓库 _rcP/_rcN/_rcResult 先例 (04-collision): 槽只承载"当帧即时消费"的值 —— 命中点送 bloodFX/
// spawnP/waterSplash 只读字段; 遮挡射线的起点/方向送 raycastWorld 即用即弃 (其返回 _rcResult 另槽);
// 曳光出膛点被 spawnTracer 当帧 copy+lookAt。跨帧持有者 (shells/nades 记录、tracers 的 dir.clone())
// 仍走 clone/新建, 不换槽。明示不做: aimAssistDir 的掰向输出 (:180 out=V3) —— 它被 20-player/
// 20a-seats/16-aircraft 十余个调用点接走当弹道方向, 任一调用点跨语句持有即踩槽, 收益 (玩家开火频率)
// 远小于审计成本。入参快照纪律 (2026-11-11 批教训): 槽位函数的入参在写槽前先读完成 (set 的实参求值
// 先于写回), raycastWorld(origin,dir) 两槽分离不互踩。
const _fbHit=V3();   // fireBullet 命中点/终点槽 (soldier/veh/water 三分支互斥, 当帧消费)
const _fbR=V3();     // fireBullet 声像 pan 的 camRight 槽
// (曳光出膛点不槽位化: verify-timestopfix T8 以整行字面源码钉 origin.clone() 契约锚, 见下 spawnTracer 行)
const _exDir=V3();   // explodeAt/splashDamage 逐受害者方向槽 (两函数不嵌套, 共用)
const _exOrg=V3();   // 爆炸遮挡射线起点槽
function fireBullet(shooter,origin,dir,def,visMuzzle){
// 出生保护清账 (2026-09-28 阶段三 P1): 开火立即解除落地保护 —— fireBullet 是玩家/Bot/炮位共用的
// 唯一出膛口, 在这里清 = "无敌帧内不许输出"的单源保证 (载具/固定武器射手同样走这里, 字段不存在则空操作)。
if(shooter&&shooter.protUntil) shooter.protUntil=0;
// 命中标识档位 (2026-09-30 批): 枪械/机炮档='mg' (无外框白X) —— 每发出膛即盖章, 顺带冲掉上一发
// 爆炸/炮弹残留的档位戳 (击杀红档经 die 链读戳, 不冲会串档)。typeof 守卫: 21-match 在本文件之后装载。
if(typeof markHitCls==='function') markHitCls('mg');
// 真附身 (2026-11-01 → ★2026-11-03 两模式统一): 宿主 Bot 出膛 = 附身者的手在开枪 —— VM 后坐/枪口焰/微震镜
// (20-player svHostFireFx)。视模式附身同样生效 (updateViewModel 门已在 24-main 放宽到 specViewHost, 反馈不再冻半路)。
if(typeof player!=='undefined'&&player&&player.specViewHost&&player.specViewHost===shooter&&typeof svHostFireFx==='function') svHostFireFx(def);
const maxD=400;
const wr=raycastWorld(origin,dir,maxD);
let wallD=wr?wr.dist:maxD;
// 水面遮蔽 (2026-09-18 塔拉瓦批): 弹道穿入水面后只在水下走 UW_BULLET_RUN 米即失能 (溅水花) ——
// 潜水者因此受水面保护; 岸上/水面上的对射不受影响 (waterEntryDist 未入水返回 Infinity)
const uwD=waterEntryDist(origin,dir,maxD);
let uwStop=false;
if(uwD<wallD){ wallD=uwD; uwStop=true; }
// 子弹可命中坦克/卡车: 阻挡弹道并溅火花, 重型子弹(vehDmg)刮掉少量装甲
let hitTank=null, hitTruck=null, tankD=1e9, truckD=1e9;
// 命中圆柱复用槽 (2026-11-01 性能批): 每发子弹×每辆坦/卡一个新对象 —— 射线只读字段, 两循环串行
for(const t of tanks){
if(!t.alive) continue;
const r=rayCyl(origin,dir,vehHitCyl(t,_fbCyl),wallD);
if(r){ wallD=r.t; hitTank=t; tankD=r.t; }
}
for(const t of trucks){
if(!t.alive) continue;
const r=rayCyl(origin,dir,truckHitCyl(t,_fbTrkCyl),wallD);
if(r){ wallD=r.t; hitTruck=t; truckD=r.t; }
}
// 轻武器对空 (7c, Q3 裁定): 敌机是实体 —— **挡弹道**并刮血 (BF1942 同款生态位)。判定几何单源
// planeHitTest; 友机不参与 (不替敌人挡枪, 也不吃友军刮血); 带 noAirHit 旗标的弹不做这里的对空判定 ——
// 飞机机炮的对空伤害由 fireMGBurst 的显式分层收口 (射手是 crewBot 时身份判据不可靠, 以弹定义旗标单源)。
// 索敌不放开 (平衡批裁定) —— 刮血只发生在弹道恰好穿过机体。
let hitPlane=null, planeD=1e9;
if(typeof planeHitTest==='function'&&shooter&&!def.noAirHit){
// ★2026-11-13 批: 观战/无差别火力 (coFfFire 单源) 对空链不再排除任何队伍的飞机 —— 旧版用
// shooter.team 当 excludeTeam, 观战连狙/幽灵坦克同轴机枪的弹对"开局己方"飞机既不命中也不挡弹
// (直接穿透无判定), 与步兵/载具链已中立的口径脱节 (coFfFire 只保护了 3 条路径的历史缺口)。
const ph=planeHitTest(origin,dir,wallD,coFfFire(shooter)?-1:shooter.team);
if(ph){ wallD=ph.t; hitPlane=ph.pl; planeD=ph.t; }
}
// 舰船也是硬目标 (2026-09-26 修): 旧版把"艇体命中"安排在下面步兵/坦克结算**之后** (见文件尾部那行 navalBulletTest),
// 于是弹道只是被事后剪辑、并不参与"谁离枪口最近"的裁决 —— 站在艇后 3m 的士兵与艇一起挨这一弹
// (艇体在水面上是实心的, 挡不住人的子弹显然是错的)。现在只做**只读查询**并收窄 wallD,
// 让 raySoldiers/坦克循环都只看到艇体之前的目标; 扣血仍由原来那一处 navalBulletTest 单点施加 (不重复扣)。
let hitNaval=null, navalD=1e9;
if(typeof navalRayQuery==='function'){
const nv=navalRayQuery(origin,dir,wallD,shooter);
if(nv){ wallD=nv.t; hitNaval=nv.craft; navalD=nv.t; }
}
// (2026-11-10: 大舰弹道只读收窄块随大舰子系统下架摘除)
const sr=raySoldiers(origin,dir,wallD,shooter);
let endD;
if(sr){
endD=sr.t;
const hitP=_fbHit.set(origin.x+dir.x*sr.t,origin.y+dir.y*sr.t,origin.z+dir.z*sr.t);
bloodFX(hitP);
let dmg=def.dmg*(sr.head?def.headMul:1);
// 难度乘数 (2026-10-06 难度批拆列): Bot 对玩家用 pDmg (新列), Bot 对 Bot 维持 dmgMul (互殴烈度不变,
// 用户裁定"只削 Bot 对玩家"); 玩家射手不乘任何难度列 (原口径)。
if(!shooter.isPlayer) dmg*=sr.sol.isPlayer?DIFF_TABLE[SETTINGS.diff].pDmg:DIFF_TABLE[SETTINGS.diff].dmgMul;
// 伤害随距离衰减 —— 武器表单源 (2026-09-28 阶段三 P1): fallS 米起线性衰减, fallE 米到地板 fallF;
// 缺省回落 = 旧全局曲线 (40 米起 / 220 米到 0.45)。玩家与 Bot 共用 fireBullet ⇒ 生态位自动同步 Bot。
// 分档口径见 09a-defs 头注: 栓动 70/260/0.8 (远距几乎不衰减) > 半自动 45/220/0.6 > STG44 38/180/0.5 >
//   自动武器 35/180/0.45 > 冲锋枪 22/110/0.3 > 手枪 15/90/0.35 (近战弹)。
const _fb=def.fallS||40, _fe=(def.fallE||220)*WX_CFG.fallEMul, _ff=def.fallF||0.45;   // 天气乘子只收 fallE (R5: fallS 起点/fallF 地板/封顶位置/武器表分档一律不碰, 天气设计 §5-6)
dmg*=lerp(1,_ff,clamp((sr.t-_fb)/Math.max(1,_fe-_fb),0,1));
// 爆头封顶 (2026-09-28 阶段三 P1, 用户实报"被各种枪秒"; 同日 k 追补收窄): 非镜枪**Bot 射手**的爆头
// 对满血目标必存活 (HEAD_CAP=95), 排查令全表过一遍 —— 旧表 dmg×headMul≥100 的非镜枪有 13 把
// (kar98/mosin/arisaka/中正式/反坦克枪/骑枪族…)。封顶取在难度倍率与衰减**之后** ⇒ 精英 ×1.25 也压得住;
// 狙击镜枪 (scoped) 一枪爆头身份保留。k 追补: 封顶只认 Bot 射手 (!shooter.isPlayer) —— 用户实报
// "自己远距爆头也秒不死", 裁定保护只朝玩家单向 (Bot 永远爆头秒不死玩家, 玩家爆头照杀);
// Bot 互射仍封顶 (战场消耗节奏维持 j 批口径)。距离衰减另有单源 (fallS/fallE/fallF):
// 镜栓动 90/300/0.85 ⇒ 300m 爆头 204 照样秒, 普通栓动 70/260/0.8 ⇒ 全程爆头 156+ 也照杀 —— 衰减不是拦路者。
// ★2026-10-06 难度批 (标准档, 用户裁定): 镜枪豁免对**玩家**关闭 —— 旧式 `!def.scoped` 豁免给了 Bot
//   狙击手对玩家 240 一枪必杀的权限 (镜狙爆头), 是"精英=总被秒杀"的主诉源头。现在 Bot 射手对玩家的
//   爆头一律封顶 95 (两枪才死); Bot 镜狙打 Bot 仍不限 (互殴烈度不变)。
if(sr.head&&!shooter.isPlayer&&dmg>HEAD_CAP&&(!def.scoped||sr.sol.isPlayer)) dmg=HEAD_CAP;
sr.sol.damage(dmg,shooter,sr.head);
// 命中反馈 (2026-09-28 D7): 致命一击**不再补白档** —— damage() 内部 hp<=0 已走 die()→onPlayerKill(红档),
// 旧版这里无条件 onPlayerHit 会**在同一帧把红档盖回白档**, 表现即"击中有表示、击杀却没有" (用户实报)。
// 只对打活人出白档; 击杀档由 die() 单源负责。
if(shooter.isPlayer&&sr.sol.alive) onPlayerHit(sr.sol,sr.head);
else if(typeof player!=='undefined'&&player&&shooter===player.specViewHost&&sr.sol.alive&&typeof onPlayerHit==='function') onPlayerHit(sr.sol,sr.head);   // 真附身: 宿主命中同款白档 (无分, 2026-11-01)
} else if(hitNaval&&navalD<=Math.min(tankD,truckD,planeD)){
// 舰船是最近的硬目标: 弹道止于艇体 (命中特效归海战子系统自己的受创反馈, 与坦克的"刮火花"不同源, 不另加)。
// 掉血在下面 navalBulletTest 单点完成 —— 那一行现在只承担"扣血", 不再承担"挡弹" (挡弹已由上面的只读查询做掉)。
endD=wallD;
} else if(hitPlane&&planeD<=Math.min(tankD,truckD)){
// 轻武器对空刮血 (7c): 弹道止于机体, 挡在前面的人不再挨弹。伤害档 AIRMG_SCRATCH_* (Q3 "刮血"),
// Bot 射手乘 GROUNDGUN_VS_AIR (平衡批: 飞机对地面步兵的枪有更高减伤; 玩家档不减, 与高炮同口径);
// 难度倍率不在这里乘 —— Plane.takeDmg 内部对 Bot 攻击已叠 DIFF_TABLE.dmgMul。
endD=wallD;
const _ab=def.vehDmg>0?AIRMG_SCRATCH_MG:AIRMG_SCRATCH_SOL;
hitPlane.takeDmg(rand(_ab[0],_ab[1])*(shooter.isPlayer?1:GROUNDGUN_VS_AIR),shooter);
spawnP(PT.spark,hitPlane.pos.x,hitPlane.pos.y,hitPlane.pos.z,rand(-2,2),rand(-1,1),rand(-2,2),0.2,0,0.2,1,0,true);
if(shooter.isPlayer&&typeof onPlayerHitVeh==='function') onPlayerHitVeh();
else if(typeof player!=='undefined'&&player&&shooter===player.specViewHost&&typeof onPlayerHitVeh==='function') onPlayerHitVeh();   // 真附身: 宿主对空刮血同款白档 (2026-11-01)
} else if(hitTank||hitTruck){
endD=wallD;
const hp2=_fbHit.set(origin.x+dir.x*endD,origin.y+dir.y*endD,origin.z+dir.z*endD);
spawnP(PT.spark,hp2.x,hp2.y,hp2.z,rand(-2,2),rand(1,3),rand(-2,2),0.15,0,rand(0.1,0.18),1,6,true);
if(Math.random()<0.3) AudioSys.ricochet(hp2.distanceTo(camera.position));
const veh=(hitTruck&&truckD<=tankD)?hitTruck:hitTank;
// 无差别火力 (ffAll 幽灵坦克驾驶 / ffSpecSniper 观战连狙): 己方载具同样是合法目标 (2026-09-17 观战扩展批, 2026-09-20 收进 coFfFire)
if(def.vehDmg&&veh&&(coFfFire(shooter)||veh.team!==shooter.team)){
// 2026-09-02: 反坦克枪(atRifle)子弹按反装甲全额, 其余机枪/步枪子弹刮装甲按 TANK_ARMOR 减免
veh.takeDmg(def.vehDmg,shooter,def.atRifle);
// 载具命中反馈 (2026-09-28 D7): 旧 Math.random()<0.2 的随机出声换成确定性档 (白标记 + 0.12s 节流音),
// 函数在 21-match (与 onPlayerHit 同族) —— 消除"打了没反馈"的抽奖感; typeof 守卫同 21-match 惯例。
if(shooter.isPlayer&&typeof onPlayerHitVeh==='function') onPlayerHitVeh();
else if(typeof player!=='undefined'&&player&&shooter===player.specViewHost&&typeof onPlayerHitVeh==='function') onPlayerHitVeh();   // 真附身: 宿主刮装甲同款白档 (2026-11-01)
}
} else if(uwStop){
// 弹道被水面截停: 溅水花, 不产生命中 (水面对子弹=硬遮蔽)
endD=wallD;
waterSplash(_fbHit.set(origin.x+dir.x*wallD,origin.y+dir.y*wallD,origin.z+dir.z*wallD),0.55);
} else if(wr){
endD=wr.dist;
impactFX(wr.point,wr.normal,wr.kind);
} else endD=maxD;
// 海战: 上面那条 if/else 链里的 wr/uwStop/maxD 都是"收窄前"的世界距离 ⇒ 若挡在中间的是艇体, 终点不得越过它
// (曳光弹/超声压制都读 endD; 缺这一行会出现"弹道穿艇而过、只是艇掉了血")
if(hitNaval&&navalD<endD) endD=navalD;
// 海战批 (§11.9④): 子弹对艇 —— 命中则扣血 (减速口径与坦克同源), 判定全在 15d-naval。
// 2026-09-26 起这一行**只扣血**: "弹道止于艇体"改由上面的只读 navalRayQuery 在裁决前收窄 wallD 完成
// (否则艇后的人会与艇一起挨这一弹)。这里的 maxD=endD 天然与那次裁决一致: 艇最近时 endD==艇体距离 (同一枚胶囊,
// t 被 clamp 到 maxD, 命中点仍然落在艇面上), 艇不最近时 endD 已被前面的目标截短 ⇒ 本行查不到它。
if(typeof navalBulletTest==='function'){ navalBulletTest(origin,dir,endD,shooter,def.vehDmg||0); }
if(Math.random()<1/(def.tracer||3)) spawnTracer(origin.clone().addScaledVector(dir,1.2),dir,Math.max(1,endD-1.5),shooter); // 4参=射手 (2026-09-27M 时停: 玩家自己的曳光照飞, AI 的随战场冻住)
if(visMuzzle) muzzleFXWorld(visMuzzle,dir);
const dCam=origin.distanceTo(camera.position);
const rv=camRight(_fbR);
const pan=clamp(rv.dot(_fbPan.set(origin.x-camera.position.x,0,origin.z-camera.position.z).normalize()),-1,1);
if(!shooter.isPlayer) AudioSys.gunshot(def.snd,dCam,pan*0.7);
if(!shooter.isPlayer&&shooter.team!==player.team&&player.alive){
const relX=player.pos.x-origin.x, relY=player.pos.y+1.5-origin.y, relZ=player.pos.z-origin.z;
const tp=relX*dir.x+relY*dir.y+relZ*dir.z;
if(tp>2&&tp<endD){
const cx=origin.x+dir.x*tp-player.pos.x, cy=origin.y+dir.y*tp-(player.pos.y+1.5), cz=origin.z+dir.z*tp-player.pos.z;
const d2=cx*cx+cy*cy+cz*cz;
if(d2<4){ AudioSys.whizz(); player.suppress(0.35); }
}
}
for(const s of soldiers){
// 观战开火不压制/不惊动士兵 (2026-09-17) —— 与"观战连狙可打双方"是同一口径的两面 (2026-09-20 复核):
// 观战者射击**任何一方**都不会让被打的一方进入压制/索敌 (14-bots damage() 里 !attacker.spectator 同源),
// 因此这里对"友军"也不放宽 —— 否则会出现"打友军惊动全场"的不一致。步兵/载具的敌我过滤见 coFfFire。
if(shooter.spectator) break;
if(!s.alive||s.team===shooter.team) continue;
const relX=s.pos.x-origin.x, relY=s.pos.y+1.4-origin.y, relZ=s.pos.z-origin.z;
const tp=relX*dir.x+relY*dir.y+relZ*dir.z;
if(tp>2&&tp<endD+1){
const cx=origin.x+dir.x*tp-s.pos.x, cy=origin.y+dir.y*tp-(s.pos.y+1.4), cz=origin.z+dir.z*tp-s.pos.z;
if(cx*cx+cy*cy+cz*cz<6){ s.suppression=Math.min(1.6,s.suppression+0.35); s.noticeThreat(shooter); }
}
}
if(!shooter.spectator) gunEvents.push({x:origin.x,z:origin.z,team:shooter.team,t:nowT,shooter}); // 观战开火不产生枪声事件
shooter.lastFiredT=nowT;
}
// ===== 固定火力点开火单源 (2026-09-06 B4/P1-1: 玩家 20a-seats 与 Bot 14-bots 共用一份弹道/冷却/特效) =====
// 机枪座: 冷却与热量在炮上(换人不重置); 散布/后坐等输入差异由调用方在 dir 上先行处理
const EMPL_MG_EYE=0.12, EMPL_MG_MUZ=1.35; // 枪管中线高度与炮口前移 (旧 Bot 0.1/1.3 vs 玩家 0.12/1.35 已统一)
// C (2026-11-13): 炮位眼位/炮口点槽 —— eye 活过整个 fireBullet 调用, muzz 在其后 muzzleFXWorld 消费, 两槽分离
const _emplA=V3(), _emplB=V3();
function emplMGFire(mg,shooter,dir){
const mdef=mg.def||EMPL_MG_DEF;
mg.fireT=60/mdef.rpm;
mg.heat+=mdef.heatPS;
const eye=_emplA.set(mg.x,mg.y+EMPL_MG_EYE,mg.z);
const muzz=_emplB.copy(eye).addScaledVector(dir,EMPL_MG_MUZ);
shooter._src=mdef.name||'重机枪'; // 击杀来源: 固定机枪座名称
fireBullet(shooter,eye,dir,mgBulletDef(mdef),muzz);
muzzleFXWorld(muzz,dir);
}
// 迫击炮: 单源弹道 (tof 由 mortarArcTof 解) + 弹体创建; 音效/烟/ trauma 与冷却档由调用方处理
// 高抛弹道速度解 (2026-09-06 B7a/P2-10: 炮位/手持两套公式参数化, tof 由调用方按武器档决定)
// **迫击炮高抛弧 (2026-09-28 阶段三 P1, 用户实报"迫击炮弹被农田草丛阻拦")**: 旧 tof=clamp(dH/84,0.9,2.1)
//   弹道顶点仅 1.0~3.2m —— 40/80/120m 三档试射全部半路撞上田块缓坡/树篱引爆 (dev/_farm-block-probe.js 取证)。
//   迫击炮的语义就是曲射越障: 新解 tof=clamp(1.0+dH/55, 1.4, 3.0) ⇒ 顶点 3.7~11m, 全程越过 2.2m 树篱与
//   田块 1.5~2m 缓坡; 代价 = 在途时间 1.4~3.0s (曲射支援武器的固有属性, 落点解恒精确)。
function mortarArcTof(dH){
return clamp(1.0+dH/55,1.4,3.0);
}
// 高抛速度解: tof 由 mortarArcTof 定弧形, **dy = 落点高度 - 出膛高度** (2026-09-28 补) ——
// 旧解按平地 (dy=0) 解算, 落点在缓坡/高地上会系统性偏近 (诺曼底田块 1.6m 高差 ⇒ 40m 试射短 4.9m);
// 把高差项并进 vy 后落点解在任何地形恒精确。
function mortarVel(ox,oz,tx,tz,tof,dy){
const dh=(dy||0);
return V3((tx-ox)/tof,(dh+0.5*9.8*tof*tof)/tof,(tz-oz)/tof);
}
function emplMortarShell(mo,shooter,tx,tz){
if(shooter&&shooter.protUntil) shooter.protUntil=0; // 出生保护清账 (★2026-11-01 判定批, 与 fireBullet"开火即解除"同契约)
const dH=Math.hypot(tx-mo.x,tz-mo.z);
const tof=mortarArcTof(dH);
const dy=(heightAt(tx,tz)+0.05)-(mo.y+0.25);   // 弹体出膛于炮口 (mo.y+0.25), 落点判据=地面+0.05
const v=mortarVel(mo.x,mo.z,tx,tz,tof,dy);
shooter._src='迫击炮'; // 击杀来源: 固定迫击炮
const nPos=V3(mo.x,mo.y+0.25,mo.z);
const shell=new THREE.Mesh(nadeGeoAT,vmMats.gun); shell.position.copy(nPos); scene.add(shell);
nades.push({m:shell,pos:nPos.clone(),vel:v,fuse:9,thrower:shooter,team:shooter.team,spin:V3(3,0,0.5),bounces:0,mortar:true,src:'迫击炮'});
spawnP(PT.dark,mo.x,mo.y+0.4,mo.z,0,1.4,0,0.5,1.6,0.6,0.5,0.2);
}
// 反坦克炮: 单源开炮 (炮口前移统一 2.7、弹壳出生 g.y —— 旧 Bot +0.25/2.6 vs 玩家 +0.25/2.7 分叉已统一);
// 弹速引 SHELL_SPD (15-vehicles 常量, B7a 单源化同口径); LOS 检查只 Bot 需要, 留在 Bot 调用方
function emplATFire(g,shooter,dir){
if(shooter&&shooter.protUntil) shooter.protUntil=0; // 出生保护清账 (★2026-11-01 判定批, 与 fireBullet"开火即解除"同契约)
g.cd=3.6+rand(0,0.8); // 炮上冷却, 换人不重置 (CD优化降至3.6+rand(0,0.8))
const o=_emplA.set(g.x,g.y,g.z).addScaledVector(dir,2.7);
shooter._src='反坦克炮';
AudioSys.cannon(o.distanceTo(camera.position));
spawnP(PT.flash,o.x,o.y,o.z,dir.x*3,dir.y*3,dir.z*3,0.85,8.5,0.1,1,0,true);
spawnP(PT.dark,o.x,o.y,o.z,dir.x*2,1,dir.z*2,0.85,2.55,0.85,0.7,0.5);
shells.push({pos:o.clone(),vel:dir.clone().multiplyScalar(SHELL_SPD),team:shooter.team,owner:shooter,life:2.4,kind:'at',trail:0,src:'反坦克炮'});
shooter.lastFiredT=nowT;
}
const nades=[];
const nadeGeoAT=new THREE.CylinderGeometry(0.06,0.075,0.3,8); // **炮弹弹体** (反坦克炮 emplATFire / 迫击炮弹 emplMortarShell)
                                                              // 四件手雷投掷物 (手雷/烟雾/燃烧/反坦克雷) 的弹体几何已收归
                                                              // 09-weapons buildNadeMesh 单源 (手上件与出手件同模), 不在此处
function nadeKindOfThrow(at,smoke,incin){ return at?'at':(smoke?'smoke':(incin?'incin':'frag')); }
function throwNade(thrower,origin,vel,fuse,at,smoke,incin){
const kind=nadeKindOfThrow(at,smoke,incin);
const m=buildNadeMesh(kind,thrower.team);      // 与 10-viewmodel 手上件同一份建模 (2026-09-30 批)
m.scale.setScalar(NADE_WORLD_SCALE);           // 出手件放大一档 (远距辨识); 碰撞判据不用网格, 不受影响
m.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
m.position.copy(origin);
scene.add(m);
nades.push({m,kind,pos:origin.clone(),vel:vel.clone(),fuse:fuse!==undefined?fuse:3.4,
armOnFuse:!!NADE_ARMED_BY_FUSE[kind],  // 触发引信口径 (NADE_ARMED_BY_FUSE 单源): 表内 = 引信到点才武装 (手雷/烟雾/燃烧), 表外 = 出手即武装
// ★2026-11-13 批: 观战本尊出手即 team=-1 (无差别火力) —— nadeStep 载具触发圈 (反坦克炸药/航弹/迫击炮弹
// 三处 t.team===st.team) 与接触引信对双方都认; 爆炸伤害本就走 noFF/-1 中立 (2026-11-09 批), 此处补齐直击半边。
thrower,team:(thrower.spectator?-1:thrower.team),spin:V3(rand(-6,6),rand(-6,6),rand(-6,6)),bounces:0,at:!!at,smokeN:!!smoke,incinN:!!incin,src:at?'反坦克炸药':smoke?'烟雾弹':incin?'燃烧弹':'手雷'});
}
// 触发引信的"接触到可攻击目标"判据 (2026-09-30 批, 单源): 敌兵**躯干**球 —— 与瞄准吸附 (aimAssistDir)
// 同一躯干口径 (中心 pos.y+1.10 / 卧姿 +0.55, 人体半径 0.45), 再并上弹体半径 0.15 ⇒ 0.6m 接触球。
// 只认敌方**步兵**: ① 普通手雷无坦克伤害圈 (既有裁定), 撞载具即炸是白炸; ② 在座乘员 (seatShielded)
// 不是可命中目标 (与命中管线同口径), 与载具同理整机交给反坦克炸药 (它有 2.6m 触发圈)。
// 时停/预演同吃: 纯函数 + 只读, 无副作用 (预演逐帧调它, 不许出声/出粒子)。
// ★2026-11-03 死亡掉雷批 (用户裁定"死亡时手里捏的雷掉落在原地, 并继承读条时间"):
// 死亡瞬间手里那颗就地脱手 —— 位置=胸口带微抖, 速度=小抛落 (照常翻滚/弹跳), 弹种/归属/队伍/击杀账
// 与出手件完全同链 (throwNade 单源; 死者照记击杀, 与"死亡弹道留存"同规, 见 verify-deathflight)。
// 引信继承读条: 普通雷带 nadeFuse **余值** (举起即烧的厨雷账, 20-player 每帧烧减; 烧到 0 = 已武装 ⇒
// 掉地即炸, 与持雷"武装+接触"双条件一致); 烟雾/燃烧/反坦克无厨雷账 (nadeFuse=99 哨兵),
// 掉落带各自标准引信 —— **绝不把哨兵 99 带出去** (否则引信到点永不武装, 掉落即哑弹)。
// Bot 前摇 (14-bots state 'nade'/'atnade', nadeAnimT 0.8→0) 同语义按比例继承: 掉落引信 = 全长 × 前摇剩余比
// —— 前摇越接近出手被杀, 尸体上的雷越烫 (杀进投掷前摇的贴脸击杀要吃这口爆)。
// 保险丝: 载具内死亡不落雷 (登车路径本就会收雷, 这里只兜"车里捏雷"的账目残留; 2026-11-10 大舰项随大舰子系统下架摘除)。
// 调用方: 玩家 die() (18-game, 持雷+出手弧两态) / Bot die() (14-bots, 前摇两态)。受创>25 打断**不掉**
// (人没死, 雷收回 —— 与 2026-10-25 打断网口径一致)。
function dropHeldNade(u){
if(!u||!u.pos) return;
if(u.onVehicle||u.onNaval) return;
const o=u.pos.clone(); o.y+=1.15; o.x+=rand(-0.15,0.15); o.z+=rand(-0.15,0.15);
const v=V3(rand(-0.9,0.9),1.3,rand(-0.9,0.9));
if(u.isPlayer){
if(u.nadeIsAT) throwNade(u,o,v,1.6,true);
else if(u.nadeIsSmoke) throwNade(u,o,v,1.8,false,true);
else if(u.nadeIsIncin) throwNade(u,o,v,1.6,false,false,true);
else { u._src='手雷'; throwNade(u,o,v,Math.max(0,u.nadeFuse||0)); }
}else{
const rem=clamp((u.nadeAnimT||0)/0.8,0,1);   // 0.8 = 14-bots 三处前摇字面量 (state 置位时的 nadeAnimT 初值)
if(u.state==='atnade'){ u._src='反坦克雷'; throwNade(u,o,v,1.6,true); }
else { u._src='手雷'; throwNade(u,o,v,3.4*rem); }
}
}
function nadeContactTarget(x,y,z,team,thrower){
if(typeof soldiers==='undefined') return null;
for(const s of soldiers){
if(!s||!s.alive||s.spectator||s.team===team||s===thrower) continue;
if(seatShielded(s)) continue;
const dx=x-s.pos.x, dy=y-(s.pos.y+(s.prone?0.55:1.10)), dz=z-s.pos.z;
if(dx*dx+dy*dy+dz*dz<0.36) return s;
}
return null;
}
// ── 弹体单步积分 (2026-09-30 批, **单源**): 真弹 updateNades 与预演 22-hud updateNadeArc 共用 ──
// 为什么必须合流: 用户本批报"预瞄抛物线与实弹对不上" —— 旧版预演是 updateNades 的**抄写件** (重力/盒判/
//   入水各抄一遍), 一旦真弹加了"触地即炸", 抄写件立刻二次漂移。现在只有这一支物理: 改这里 = 两处同改。
// st = {pos,vel,fuse,armOnFuse,...} (真弹直接把 nades 表项传进来, 预演传一个同形字面量);
// 返回 'blow' 引爆 (武装完成后触地/撞敌/触载具) / 'fizzle' 入水哑火 / 'bounced' 本步发生弹跳 / 'none'。
// **不含任何副作用** (爆炸/水花/音效/网格同步全在调用方) —— 预演不能出声出粒子。
// ★2026-09-30 批2 (用户裁定"保留计时, 但只有触地或命中合法目标才爆炸"): 引信到点**不再**返回 'blow',
//   而是转入"武装完成"——引爆一律要"武装 + 接触"双条件 (见函数尾触发判据)。于是普通手雷没有空炸,
//   举雷期引信烧到 0 也不炸手; 反坦克炸药/航弹/迫击炮弹 (armOnFuse 假) 出手即武装, 行为与老口径等价。
// ── nadeStep 逐帧账复用 (2026-11-01 性能批) ──
// 盒候选回调提升 (旧版每雷每帧 1 个捕获闭包, bounced/nx/ny/nz/st 经 _ndBoxCtx 传递;
// 回调体内无重入路径)。(_ndL/_ndW 模块级 scratch 2026-11-10 随大舰超结构反弹块下架一并摘除)
const _ndBoxCtx={st:null,nx:0,ny:0,nz:0,bounced:false};
function _ndBoxCb(b){
const C=_ndBoxCtx;
if(C.bounced) return;
if(C.nx>b.minX-0.06&&C.nx<b.maxX+0.06&&C.ny>b.minY-0.06&&C.ny<b.maxY+0.06&&C.nz>b.minZ-0.06&&C.nz<b.maxZ+0.06){
const dl=Math.min(C.nx-b.minX,b.maxX-C.nx), dv=Math.min(C.ny-b.minY,b.maxY-C.ny), dd=Math.min(C.nz-b.minZ,b.maxZ-C.nz);
if(dv<=dl&&dv<=dd){ C.st.vel.y*=-0.4; C.st.vel.x*=0.7; C.st.vel.z*=0.7; }
else if(dl<=dd){ C.st.vel.x*=-0.5; } else { C.st.vel.z*=-0.5; }
C.bounced=true;
}
}
function nadeStep(st,dt){
st.fuse-=dt;
st.vel.y-=9.8*dt;
// 航弹锁定制导 (2026-09-30k): 投弹瞬间射手带锁定目标 (dropBomb 挂账 lock) ⇒ 弹体以限角速度
// BOMB_GUIDE_RATE 朝目标掰 —— 只改速度方向不改模长, 落体加速/触发引信/入水哑火全走原链;
// 目标中途死亡 (lock.alive) 即退回诚实弹道。逐枚走自己的 ndt (时停下冻结弹不拐弯)。
if(st.bomb&&st.lock&&st.lock.alive){
const tx=st.lock.pos.x-st.pos.x, ty=st.lock.pos.y+(st.lock.kind==='tank'?1.2:0.9)-st.pos.y, tz=st.lock.pos.z-st.pos.z;
const tl=Math.sqrt(tx*tx+ty*ty+tz*tz)||1;
const vl=st.vel.length();
if(vl>1){
const ux=st.vel.x/vl, uy=st.vel.y/vl, uz=st.vel.z/vl;
const wx=tx/tl, wy=ty/tl, wz=tz/tl;
const ang=Math.acos(clamp(ux*wx+uy*wy+uz*wz,-1,1));
if(ang>0.001){
const gt=Math.min(1,BOMB_GUIDE_RATE*dt/ang);
const gx=ux+(wx-ux)*gt, gy=uy+(wy-uy)*gt, gz=uz+(wz-uz)*gt;
const gl=Math.sqrt(gx*gx+gy*gy+gz*gz)||1;
st.vel.set(gx/gl*vl,gy/gl*vl,gz/gl*vl);
}
}
}
let nx=st.pos.x+st.vel.x*dt, ny=st.pos.y+st.vel.y*dt, nz=st.pos.z+st.vel.z*dt;
let bounced=false;
// 2026-09-06 B5/P0-2: 手雷撞盒全量扫描改 RGRID 邻近候选 (±0.06 判定 + 0.02 采样余量);
// 原实现命中首个盒即 break —— 以 bounced 旗复刻, 候选次序差异由等价探针覆盖
{const C=_ndBoxCtx; C.st=st; C.nx=nx; C.ny=ny; C.nz=nz; C.bounced=false;
eachBoxNear(nx-0.08,nz-0.08,nx+0.08,nz+0.08,_ndBoxCb);
bounced=C.bounced;}
// 反坦克炸药/航弹/迫击炮弹的载具触发圈: 2.6m 内即算"接触" (老口径; 它们出手即武装, 由下面统一收口)
let hitVeh=false;   // (2026-11-10: hitVehY 随大舰甲板接触账下架摘除, 原文见 archive/naval-coral-ironbottom-20261110/)
if(st.at||st.bomb||st.mortar){
for(const t of tanks){
if(!t.alive||t.team===st.team) continue;
if(Math.hypot(nx-t.pos.x,nz-t.pos.z)<2.6&&ny<t.pos.y+2.6){ hitVeh=true; break; }
}
if(!hitVeh) for(const t of trucks){
if(!t.alive||t.team===st.team) continue;
if(Math.hypot(nx-t.pos.x,nz-t.pos.z)<2.6&&ny<t.pos.y+2.6){ hitVeh=true; break; }
}
// 小艇触发圈 (2026-10-01b 修"航弹在海战图是哑弹"): 与坦克同圈 —— 旧版只查 tanks/trucks,
//   海图上的航弹从小艇正上方穿过、落水哑火 (入水哑火判据排在触发之前, 深水必哑)。
if(!hitVeh&&typeof navalCraft!=='undefined') for(const c of navalCraft){
if(!c||!c.alive||c.team===st.team||c.state==='sinking'||c.state==='wreck') continue;
if(Math.hypot(nx-c.pos.x,nz-c.pos.z)<2.6&&ny<c.pos.y+2.6){ hitVeh=true; break; }
}
// (2026-11-10: 大舰甲板接触块随大舰子系统下架摘除)
}
// (2026-11-10: 未武装弹大舰甲板弹跳块随大舰子系统下架摘除)
const gh=heightAt(nx,nz);
// 入水哑火 (2026-09-18 塔拉瓦批): 落进 >0.6m 深的水里即失效 (水花+气泡由调用方出), 不产生爆炸伤害 ——
// 于是"往水里扔手雷"炸不到潜水者; 浅水(<0.6m)照旧落地爆炸。**必须排在触发引信之前** ——
// 深水里的底在 gh, 若先判触地, 弹体就会在海底引爆 (潜水者反被炸)。
const wy=waterYAt(nx,nz);
if(wy>-1e8&&Math.max(ny,gh+0.05)<wy&&waterDepthAt(nx,nz)>0.6){ st.pos.set(nx,Math.max(ny,gh+0.05),nz); return 'fizzle'; }
// ★触发判据 (2026-09-30 批2, 单源, 用户裁定): 武装完成 **且** 接触 ⇒ 该点即爆点, 立即引爆。
//   武装完成: 表内弹种 (手雷/烟雾/燃烧) = 引信到点 —— 举雷期间引信照烧, 烧到 0 手里那颗也不炸 (无接触),
//     只是出手后"第一次碰到什么就炸什么"; 表外 (反坦克炸药/航弹/迫击炮弹) = 出手即武装。
//   接触: ① 触地 ② 敌兵躯干球 (nadeContactTarget, 只有表内弹种查 —— 老口径里反坦克炸药族撞人不炸,
//     撞地面/载具就够) ③ 载具触发圈 (仅表外弹种) ④ 撞墙 (仅表外弹种: 老口径撞墙即炸)。
//   ⇒ 普通手雷撞墙**不炸** (墙不是地面也不是合法目标), 照旧弹跳, 落到地上再炸。
const armed=!st.armOnFuse||st.fuse<=0;
const touchG=ny<=gh+0.05;
if(armed){
const touchT=st.armOnFuse?!!nadeContactTarget(nx,ny,nz,st.team,st.thrower):false;
if(touchG||touchT||hitVeh||(!st.armOnFuse&&bounced)){ st.pos.set(nx,Math.max(ny,gh+0.05),nz); return 'blow'; }
}
if(touchG){
st.pos.y=gh+0.05;
if(st.vel.y<-0.5) bounced=true;
st.vel.y*=-0.38;
st.vel.x*=0.68; st.vel.z*=0.68;
if(st.spin) st.spin.multiplyScalar(0.6);
}
st.pos.set(nx,Math.max(ny,gh+0.05),nz);
return bounced?'bounced':'none';
}
function updateNades(dt,rdt){
// 逐枚按自己的帧长 (2026-09-27M 时停修复批; 单源 22b specTimeShotDt → thrower.isPlayer):
// 时停下 AI 的手雷/迫击炮弹/航弹整枚冻住 (fuse-=0 ⇒ 也不会"停着炸"), 玩家自己扔的照落照炸 ——
// 否则引信在冻结期间照跑 (旧版 dt=0 时 fuse 不动, 但观战者扔出的弹壳会冻在半空) 且 nades 表项常驻。
// 物理全在 nadeStep (单源, 与预演共用); 本函数只做**副作用**: 引爆/水花/音效/网格同步/威胁提示。
const ND=(typeof specTimeShotDt==='function')?specTimeShotDt:null;
let nearNadeMin=Infinity;
for(let i=nades.length-1;i>=0;i--){
const n=nades[i];
const ndt=ND?ND(n.thrower,rdt,dt):dt;
if(!(ndt>0)) continue;
const ev=nadeStep(n,ndt);
if(ev==='blow'){ scene.remove(n.m); nades.splice(i,1); nadeExplode(n); continue; }
if(ev==='fizzle'){ waterSplash(n.pos,0.8,false,true); scene.remove(n.m); nades.splice(i,1); continue; }
if(ev==='bounced'){
// 反坦克炸药/航弹/迫击炮弹的"撞墙即炸"已在 nadeStep 的触发判据里收口 (2026-09-30 批2 单源化:
// 旧版这里是 `n.fuse=Math.min(n.fuse,0.02)` 让**下一步**的 fuse<=0 收口 —— 预演里没有这一行,
// 于是预演与实弹在撞墙档上差一步; 现在两处同一条), 这里只剩弹跳音效。
if(!(n.at||n.bomb||n.mortar)&&n.bounces++<4) AudioSys.nadeBounce(n.pos.distanceTo(camera.position));
}
n.m.position.copy(n.pos);
n.m.rotation.x+=n.spin.x*ndt; n.m.rotation.y+=n.spin.y*ndt; n.m.rotation.z+=n.spin.z*ndt;
// ★2026-11-14 友伤开关批: 友方手雷告警 (用户令 2.5) —— 开关开启时, 友方 (非自己扔的) 手雷/AT炸药/燃烧弹
// 在 7m 内也告警 (友雷照旧炸死人); 排除迫击炮弹/航弹 (n.mortar/n.bomb 溅射传真实队号=本就同队免伤, 告警会误报)。
// 开关关闭 ⇒ 友雷不再伤友军, 告警一并停用; 敌方雷告警不受开关影响。
if(player.alive&&!n.smokeN&&(n.team!==player.team||(EXPLO_FF&&n.team===player.team&&n.thrower&&n.thrower!==player&&!(n.mortar||n.bomb)))){
const nd=n.pos.distanceTo(player.pos);
if(nd<7&&nd<nearNadeMin) nearNadeMin=nd;
}
}
if(nearNadeMin<7){
nadeWarnT=0.2;
nadeMinDist=nearNadeMin;
}
}
function nadeExplode(n){
if(n.incinN){
spawnSmokeCloud(n.pos,true,n.thrower);
return;
}
if(n.smokeN){
spawnSmokeCloud(n.pos,false,n.thrower);
return;
}
if(n.src&&n.thrower) n.thrower._src=n.src; // 击杀来源重盖章 (2026-09-29): 引信飞行期间投掷者可能又开了别的枪, 结算前把 _src 刷回本弹标签
if(typeof markHitCls==='function') markHitCls('explo'); // 命中标识档: 投掷爆炸物一律 'explo' (2026-09-30 批)
if(n.mortar){
explosionFXSmall(n.pos);
AudioSys.explosion(n.pos.distanceTo(camera.position)*0.85);
// ★2026-10-30 迫击炮削弱 (用户裁定⑤"标准档+半径5.25+伤害≤100"): 半径 7.5→5.25m (原为手雷圈的1.36倍,
//   现与手雷/反坦克炸药 5.5 同级偏小), 步兵 135→100 (中心命中满血不再一击致死, 边缘由衰减进一步收敛);
//   载具 150 与 ap=false 不动 (对装甲本来刮痧); 结构半径随爆径同比例 7→5 (伤害 210 不动)。
splashDamage(n.pos,n.thrower,(n.thrower&&n.thrower.spectator)?-1:n.team,5.25,100,150,false,'explo'); // team: 2026-11-09 观战中立批 —— 观战者本尊的手持迫击炮无差别, Bot 迫击炮不动; 不在弹体上盖章, 保住敌雷接近警告与载具触发圈的旧口径
damageStructures(n.pos,5,210,n.thrower);   // 4参 = 破坏得分归属 (2026-09-26 破坏得分批)
crater(n.pos.x,n.pos.z,1.3,true);
return;
}
if(n.at){
spawnP(PT.flash,n.pos.x,n.pos.y+0.4,n.pos.z,0,2,0,2.4,15,0.14,1,0,true);
for(let i=0;i<7;i++) spawnP(PT.dark,n.pos.x,n.pos.y+0.4,n.pos.z,rand(-2,2),rand(1,4),rand(-2,2),1.0,2.4,rand(0.8,1.4),0.85,0.6);
AudioSys.explosion(n.pos.distanceTo(camera.position));
// 爆圈 5→5.5 (2026-09-30 批, 用户裁定"微量增加手雷爆炸范围"; 反装甲全额/伤害表不动)
splashDamage(n.pos,n.thrower,-1,5.5,95,340,true,'explo'); // 反坦克炸药: 反装甲全额; team=-1 = 2026-11-09 用户裁定"投掷手雷中立" (与地雷/油桶同约定; 仅爆炸伤害中立, 触发引信仍只认敌方)
damageStructures(n.pos,5,130,n.thrower);
crater(n.pos.x,n.pos.z,1.1,true);
} else if(n.bomb){
// 2026-09-30k (用户裁定"增大航弹的爆炸范围, 并让其能有效杀伤乃至击杀坦克"): 半径 9.5→13 /
// 步兵 170→210 / 载具 260→1350 且 **ap=true** —— 旧无 ap: 260×TANK_ARMOR0.3=78 纯挠痒; 现在
// 直接命中 = 反装甲全额 ≈1300 (中型坦克击毁级, 轻坦必杀, 重坦残废), 与巡飞弹 (560, ap) 同族但更重。
explosionFX(n.pos);
AudioSys.explosion(n.pos.distanceTo(camera.position)*0.7);
splashDamage(n.pos,n.thrower,n.team,13,210,1350,true);
damageStructures(n.pos,12,460,n.thrower);
crater(n.pos.x,n.pos.z,2.4,true);
explodeAt(n.pos,n.thrower);
} else {
explodeAt(n.pos,n.thrower,undefined,true);   // noFF (2026-11-09 用户裁定"投掷手雷中立"): 普通手雷爆炸伤双方; 触发引信仍只认敌方, 自炸(s!==attacker)照旧
}
}
// attacker 可为 null = **无主爆炸** (2026-09-25 修): 钢水包等场景破坏物 g.onDead 就是叠了 null 调进来的
// (05a-buildings factoryLadle: explodeAt(pos,null)+igniteArea(...,null,6))。旧版这里无守卫地读 attacker.team,
// 第一个存活单位就抛 TypeError, 异常被 05-world 的 try/catch 吞掉 ⇒ 现象是"爆了但周围零伤害、火区也不生成"。
// 全链其余环节本来就支持无主 (18-game damage/die 用 `if(attacker)` 守卫、04b igniteCell 写 FATT=attacker||null),
// 所以这里只需同规守卫: 无主时不做友军免伤、不做威胁广播 (与 splashDamage 的"无主=对双方生效"一致)。
function explodeAt(p,attacker,R,noFF){   // noFF (2026-11-09 投掷手雷中立批): 跳过同队免伤 —— 仅手雷 frag 分支传 true; boomer殉爆/航弹叠爆/钢水包/丧尸链不传=旧口径
// 爆圈半径 (2026-09-30 批, 用户裁定"微量增加手雷爆炸范围"): 缺省 NADE_BLAST_R=10 (旧 9, 00-config 单源);
// 航弹分支的叠爆/场景破坏物殉爆同吃此缺省 —— 航弹主伤圈是上面 splashDamage 的 13, 这里只微涨边缘。
R=R||NADE_BLAST_R;
explosionFX(p);
AudioSys.explosion(p.distanceTo(camera.position));
// 命中标识 (2026-09-30 批): 爆炸档 'explo' + 玩家射手伤到**活着的敌对目标**出聚合白档 (致命一击不补, die 链红档)。
if(typeof markHitCls==='function') markHitCls('explo');
let _fbAny=false;
damageStructures(p,4.5,45,attacker);   // 手雷/巡飞弹/自爆共用: 归属交给击毁者 (无主则不加分)
const victims=combatants.slice();
for(const s of victims){
if(!s.alive||seatShielded(s)) continue;   // 2026-09-26E 审计 2: 含艇上乘员 (旧版只认 onVehicle)
const d=Math.hypot(s.pos.x-p.x,(s.pos.y+0.9)-p.y,s.pos.z-p.z);
if(d<R){
const dir=_exDir.set(s.pos.x-p.x,s.pos.y+0.9-p.y,s.pos.z-p.z).normalize();
const block=raycastWorld(_exOrg.set(p.x,p.y+0.25,p.z),dir,d);
let dmg=(1-d/R)*135;
if(block&&block.dist<d-0.5) dmg*=0.25;
if((!noFF||!EXPLO_FF)&&attacker&&s.team===attacker.team&&s!==attacker) dmg*=0.0;   // ★2026-11-14 友伤开关 (sf_explo_ff): 关=普通手雷(noFF=true)也同队归零; 自炸(s===attacker)任何档照旧不免
if(dmg>2){
s.damage(dmg,attacker,false);
if(s.isPlayer){ addTrauma(clamp(dmg/60,0.3,1)); }
if(s.alive&&attacker&&attacker.isPlayer&&s.team!==attacker.team) _fbAny=true;
}
}
if(s.isPlayer){
const d2=p.distanceTo(camera.position);
if(d2<20) addTrauma(clamp(1.2-d2/22,0.1,0.9));
}
}
if(_fbAny&&typeof onPlayerHitAny==='function') onPlayerHitAny('explo');
if(!attacker) return;
for(const s of soldiers){
if(!s.alive) continue;
if(Math.hypot(s.pos.x-p.x,s.pos.z-p.z)<40&&attacker.team!==s.team) s.noticeThreat(attacker);
}
}
// ===== 巡飞弹 (实验模式): 火箭筒发射小型无人机, 飞行中玩家进入TV制导视角 =====
const loiterEng=AudioSys.createEngine('plane');
function buildLoiterMesh(){
const g=new THREE.Group();
const bodyMat=new THREE.MeshLambertMaterial({color:0x6a705c});
const darkMat=new THREE.MeshLambertMaterial({color:0x3c4038});
// 机身(机头朝 -Z 与相机前向一致) + 光学头罩 + 主翼 + 尾翼 + 尾推螺旋桨
const body=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.09,0.72,8),bodyMat);
body.rotation.x=HPI; g.add(body);
const nose=new THREE.Mesh(new THREE.SphereGeometry(0.075,8,6),new THREE.MeshLambertMaterial({color:0x1c2226}));
nose.position.z=-0.4; g.add(nose);
const wing=new THREE.Mesh(new THREE.BoxGeometry(1.15,0.02,0.2),bodyMat);
wing.position.z=-0.05; g.add(wing);
const tail=new THREE.Mesh(new THREE.BoxGeometry(0.42,0.02,0.12),bodyMat);
tail.position.z=0.32; g.add(tail);
const fin=new THREE.Mesh(new THREE.BoxGeometry(0.02,0.2,0.14),darkMat);
fin.position.set(0,0.1,0.32); g.add(fin);
const prop=new THREE.Mesh(new THREE.BoxGeometry(0.02,0.3,0.015),darkMat);
prop.position.z=0.42; g.add(prop);
g.userData.prop=prop;
g.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
return g;
}
function fireLoiter(shooter,origin,dir){
if(player.loiter) return null;
const mesh=buildLoiterMesh();
mesh.position.copy(origin);
scene.add(mesh);
const d={ pos:origin.clone(), yaw:shooter.yaw, pitch:shooter.pitch, mesh,
owner:shooter, team:shooter.team, life:24, lifeMax:24, t:0, spd:13, trail:0, dead:false, grace:LOITER_ARM_DIST };
player.loiter=d;
// 吞掉发射时按住的鼠标与空格: 松开后左键才重新作为"自爆"/空格才作为"加速"触发, 避免刚出膛就误操作 (2026-11-06 加速键右键→空格)
player._ltClick=true; player._ltRClick=true; player._ltSpace=!!keys.Space;
// ★2026-11-07 实机反馈批 (用户裁定③ "H键飞行自动切换为悬停"): 气动飞行中发射 ⇒ 就地切悬停并清速度 ——
// 操控期间本体定身 (updatePlayer 制导分支), 消灭旧写"操控中本体继续 specFlightMove 沿视线 40m/s 前飞"
// (= 用户实报"巡飞弹视角内自己一个人向前飞出"); _aeroSpd 一并清零, 退场后再按 H 从巡航 13 起步不吃残 40。
if(shooter.flying&&shooter.flyAero){ shooter.flyAero=false; shooter.vel.set(0,0,0); shooter._aeroSpd=0; }
player.loiterView=0;
d.mesh.visible=!(shooter.alive&&!player.loiterView); // 初始可见性 = 单写者同式 (updateLoiters 逐帧接管, 2026-11-05 批): TV档默认藏, 真观战(alive=false)出膛即可见
VM.root.visible=false;
const ov=document.getElementById('tvOv');
if(ov) ov.style.display='block';
loiterEng.update(150,0.2);
if(!shooter.spectator) gunEvents.push({x:origin.x,z:origin.z,team:shooter.team,t:nowT,shooter}); // 观战发射不上报枪声
return d;
}
// 巡飞弹前向复用槽 (2026-11-01 性能批): 两处调用 (updateLoiters 每帧 / updateCamera 巡飞视角每帧)
// 都在本帧内串行消费, 不跨调用持有 —— 旧版每帧 1~2 个新 V3。
const _loF=V3(0,0,1);
function loiterForward(d){
const cp=Math.cos(d.pitch);
return _loF.set(-Math.sin(d.yaw)*cp, Math.sin(d.pitch), -Math.cos(d.yaw)*cp);
}
// 不分敌我溅射: 圈内所有步兵(含发射者与友军)、坦克/卡车/飞机(含友军)一律受伤
// 溅射单源 (2026-09-06 B7b/P2-6: 旧 splashDamage(15-vehicles,队伤) 与 splashDamageFF(13-combat,无差别) 90% 同构合并;
// team=-1 ⇒ 无差别(FF): 不吃队伤豁免、载具衰减下限 20、含飞机圈; team 传队号 ⇒ 同队免伤、衰减下限 10、不含飞机圈)
// 第 8 参 fbCls (2026-09-30 批): 命中标识档位戳 ('shell' 炮弹溅射 / 缺省 'explo' 爆炸溅射) —— 玩家射手
// 伤到**存活**的敌对目标时出一次聚合白档 (onPlayerHitAny); 致命一击不补 (die 链红档 + hmShow 150ms 守卫兜底)。
function splashDamage(p,attacker,team,radius,dmgMax,dmgVeh,ap,fbCls){
// ★2026-11-14 友伤开关 (sf_explo_ff, 默认开): 关=有归属的无差别爆炸 (team=-1/undefined 且 attacker 有真实队)
// 收敛为 attacker 队属口径 ⇒ 同队步兵/坦克/卡车全免伤, 并经下方 navalSplash 透传自动覆盖舰艇溅射。
// 无主爆炸 (attacker=null: 地雷/油桶/钢水包) 无队可认, 保持无差别 —— 开关管不到 (00-config 口径注记)。
if(!EXPLO_FF&&attacker&&attacker.team>-1&&(team===-1||team===undefined)) team=attacker.team;
const ff=team===-1||team===undefined;
const vehFloor=ff?20:10;
if(typeof markHitCls==='function') markHitCls(fbCls||'explo');
const _fbP=attacker&&attacker.isPlayer;
let _fbAny=false;
const victims=combatants.slice();
for(const s of victims){
if(!s.alive||seatShielded(s)) continue;   // 2026-09-26E 审计 2: 含艇上乘员 (旧版只认 onVehicle)
if(!ff&&s.team===team&&s!==attacker) continue; // 不误伤队友, 但炸自己会受伤
const d=Math.hypot(s.pos.x-p.x,(s.pos.y+0.9)-p.y,s.pos.z-p.z);
if(d<radius){
// 掩体遮挡 (2026-09-26 修): 与 explodeAt (场景破坏物/航弹那一支) **同一条式子** —— 从爆点朝胸口打一条
// 世界射线 (raycastWorld 只测 BOXES/CYLS 碰撞体, 不吃地形起伏), 被挡则只吃 1/4 伤害。
// 旧版只有 explodeAt 做遮挡, 手雷/迫击炮/反坦克炸药/巡飞弹的溅射全无 ⇒ 隔着一整栋楼的手雷照样满伤,
// 而同一颗航弹 (n.bomb 分支两个模型都调) 前后半段口径还不一致。
// 口径范围: 只改步兵这一圈 —— 载具/卡车/飞机/舰船不在此列 (explodeAt 没有载具圈, 没有可对齐的口径, 动它就是改平衡)。
let dmg=lerp(dmgMax,10,d/radius);
if(d>0.6){
const dir=_exDir.set(s.pos.x-p.x,s.pos.y+0.9-p.y,s.pos.z-p.z).normalize();
const block=raycastWorld(_exOrg.set(p.x,p.y+0.25,p.z),dir,d);
if(block&&block.dist<d-0.5) dmg*=0.25;
}
s.damage(dmg,attacker,false);
if(_fbP&&s.alive&&s.team!==attacker.team) _fbAny=true;
}
}
for(const t of tanks){
if(!t.alive||(!ff&&t.team===team)) continue;
const d=t.pos.distanceTo(p);
if(d<radius+2.5){ t.takeDmg(lerp(dmgVeh,vehFloor,d/(radius+2.5)),attacker,ap); if(_fbP&&t.alive) _fbAny=true; }
}
for(const t of trucks){
if(!t.alive||(!ff&&t.team===team)) continue;
const d=t.pos.distanceTo(p);
if(d<radius+2.5){ t.takeDmg(lerp(dmgVeh,vehFloor,d/(radius+2.5)),attacker); if(_fbP&&t.alive) _fbAny=true; }
}
if(ff) for(const pl of planes){
if(!pl.alive) continue;
const d=pl.pos.distanceTo(p);
if(d<radius+planeHitR(pl)){ pl.takeDmg(lerp(dmgVeh,20,d/(radius+planeHitR(pl))),attacker); if(_fbP&&pl.alive) _fbAny=true; } // 7c: 机体半径单源 planeHitR (旧手写 +3)
}
if(_fbAny&&typeof onPlayerHitAny==='function') onPlayerHitAny(fbCls||'explo');
if(typeof navalSplash==='function') navalSplash(p,attacker,team,radius,dmgMax,dmgVeh,ap,fbCls); // 海战批 (§11.9④): 溅射对艇 —— 衰减口径与上面的坦克圈逐式对齐, 逻辑全在 15d-naval (既有函数体一行未动)
// (2026-11-10: 溅射对大舰 capitalSplash 钩随大舰子系统下架摘除)
if(player.alive&&p.distanceTo(camera.position)<18) addTrauma(0.5);
}
function updateLoiters(dt,rdt){
const d=player.loiter;
if(!d||d.dead) return;
// 帧长归本体链 (2026-09-27M 时停修复批; 单源 22b specTimeShotDt → owner.isPlayer): 操控巡飞弹时
// "你本人就是弹体" —— 时停下弹不动 = 观察者被定住 (审计 P1-3: 与"冻的是战场, 不是观察者"直接冲突;
// 且 19-input 制导期间 J/K 让位 ⇒ 制导中既不能解时停也不能动, 是死局)。非时停时 ldt≡dt (零漂移)。
const ldt=(typeof specTimeShotDt==='function')?specTimeShotDt(d.owner,rdt,dt):dt;
if(!(ldt>0)) return;                 // 世界冻结且这枚不属于玩家 ⇒ 整枚停住 (不推进也不判定)
d.t+=ldt; d.life-=ldt;
// 空格加速 (2026-11-06 右键→空格, 右键让位开镜放大): 尾推引擎全速冲刺 (3×巡航 13=40 m/s), 松开后回落到巡航速度 (转向角速度不变, 高速下盘旋半径更大)
const boost=keys.Space&&!player._ltSpace;
d.spd=dampF(d.spd, boost?40:13, boost?2.2:3.0, ldt);
// ── TV制导 (2026-09-28 重做): 鼠标增量**直接**转成弹体姿态, 逐帧限角速度; 超出的增量**丢弃**。 ──
// 用户实报: "现在巡飞弹转向十分生硬还随机失控，原因不明。" 原因就是旧版这两行 ——
//   旧写法 `d.yaw += clamp(angDiff(d.yaw,player.yaw), ±rate)` 让弹体去追**本体**的 yaw/pitch,
//   而本体角是鼠标写的、玩家看不见: ①相机跟着弹体走, 弹体却跟在鼠标后面 ⇒ 甩枪时画面滞后
//   0.3~1.6s (1.9rad/s 封顶, 180° 要 1.65s) = "生硬"; ②鼠标甩出的角度**全部存在**本体角里,
//   松手后弹体仍朝那个角继续拐 (甩过头就"自己拐", 玩家读作"随机失控")。
// 现在: 视角与弹体是**同一个量** —— 鼠标直接掰弹体的角 (即时响应), 只有超出角速度上限的部分被丢。
// 单源: 19-input 在制导期间只把 movementX/Y 记进 player.tvDX/tvDY (不再碰本体 yaw/pitch), 这里消费并清零。
const sens=0.0022*((typeof SETTINGS!=='undefined'&&SETTINGS.sens)||1)*(camera.fov/74); // TV 视场 85 vs 步行 74: 屏幕位移手感一致; 2026-11-06 改跟当前 fov (右键开镜 fov 30 时灵敏度等比收窄, 过渡平滑)
const rateYaw=2.5, ratePitch=1.9;                    // 角速度上限 (旧 1.9/1.4 太钝; 仍留油门感: 冲刺 40m/s 时盘旋半径更大)
d.yaw+=clamp(-(player.tvDX||0)*sens,-rateYaw*ldt,rateYaw*ldt);
d.pitch+=clamp(-(player.tvDY||0)*sens,-ratePitch*ldt,ratePitch*ldt);
player.tvDX=0; player.tvDY=0;
d.pitch=clamp(d.pitch,-1.2,1.2);                     // 弹体俯仰包线 (与旧版对目标角的上限同档)
// ★2026-11-05 实机反馈批 (用户实报"巡飞弹视角内转向会带着本体一起转向"): 制导期间**不再**把弹体姿态
//   持续回写成本体角 (旧版这里两行 = 弹体角每帧覆写本体角, 本体全程跟着弹体转向 —— 本体第三人称/
//   附身呈现层里看得见原地转圈, WASD 移动方向也被弹体朝向带跑)。
// ★2026-11-06 二次裁定 (用户实报"引爆/消失后玩家朝向仍是弹体末向, 应为发射时朝向"): 11-05 批据此
//   反馈加的"退场一次性对齐"(detonate/despawn 清账行把本体角对到弹体末态) 同日撤销 —— 退场只清账,
//   本体角自发射起纹丝不动, 引爆/静默消失/T 弃弹三路退场后都停在**发射时朝向** ("退出画面不跳"原意
//   让位于"本体朝向不被弹体污染"; 退场瞬间视角从弹体末向跳回本体 = 裁定直接结果, 有意为之)。
// (旧版那句 `-0.06*ldt` 的"轻微低头"删掉: 它靠"弹体追本体角"这个闭环才有界, 改成鼠标直控后会变成
//  每秒 3.4° 的持续下沉 —— 玩家得一直往上拽鼠标, 正是"生硬"的一部分。)
const dir=loiterForward(d);
const step=d.spd*ldt;
d.trail-=ldt;
if(d.trail<=0){
d.trail=0.05;
spawnP(PT.smoke,d.pos.x,d.pos.y,d.pos.z, rand(-0.2,0.2),rand(0,0.4),rand(-0.2,0.2), 0.28,0.5,0.5,0.4,0);
}
if(d.mesh.userData.prop) d.mesh.userData.prop.rotation.z+=ldt*(40+(d.spd-13)*2.4);
loiterEng.update(140+d.t*6+(d.spd-13)*4,0.2);
// ── 命中检测 (★2026-11-13 离膛武装批: 逐帧照跑, 含未武装段) ──
// 旧口径: 出膛 0.8s 完全跳过命中检测 ⇒ 巡航 13m/s 下 ≈10m 无敌穿墙窗 (能隔着墙/沙袋/单位飞过, 用户实报)。
// 新口径 (真实弹药"离膛武装距离", LOITER_ARM_DIST 单源): 静态体/坦克/飞机/士兵 (不分敌我, 友军单位
// 同样挡弹) 未武装期也参与判定 —— 撞上 = **哑弹撞毁** (引信未武装不引爆: 不炸不伤, 冒烟+提示条);
// 武装后照旧碰炸。当初豁免要护的"坡地发射自爆"只与**地形**有关: 未武装段地形改走贴地爬升钳制
// (见下方移动段), 照旧护住 —— 撞近物自爆改哑弹, 同样不会炸膛。
let hitD=step+0.45, hitTank=null, hitSol=null, hitPlane=null, hit=null;
const wr=raycastWorld(d.pos,dir,hitD);
if(wr){ hitD=wr.dist; hit=wr; }
for(const t of tanks){
if(!t.alive) continue;
const r=rayCyl(d.pos,dir,vehHitCyl(t,_fbCyl),hitD);
if(r){ hitD=r.t; hitTank=t; hitSol=null; hitPlane=null; hit=r; }
}
// 空中目标 (7c: 判定几何单源 planeHitTest —— 旧 2.3×size 圆柱绝迹; 不分敌我, 友军机体同样挡弹,
// 与坦克/士兵同口径): 射线-球最近相交即碰炸 (飞机即使悬停/迎头相撞也按最近距离判定)
{
const pr=planeHitTest(d.pos,dir,hitD);
if(pr&&pr.t<hitD){ hitD=pr.t; hitPlane=pr.pl; hitTank=null; hitSol=null; hit=pr; }
}
const sr=raySoldiers(d.pos,dir,hitD,null);
if(sr){ hitD=sr.t; hitSol=sr.sol; hitTank=null; hitPlane=null; hit=sr; }
if(hit){
const hx=d.pos.x+dir.x*hitD, hy=d.pos.y+dir.y*hitD, hz=d.pos.z+dir.z*hitD;
if(d.owner&&d.owner.spectator){ loiterDespawn(d); return; }   // 观战: 触物一律静默消失 (哑弹同口径), 只有左键手动起爆
if(d.grace>0){
// 未武装哑弹 (2026-11-13): 撞毁不炸不伤 —— 旧无敌穿墙窗的替代口径 (真实弹药引信未武装不引爆)
spawnP(PT.smoke,hx,hy,hz, 0,0.6,0, 0.5,1.2,0.7,0.55,0);
if(typeof showScorePop==='function') showScorePop(t2('⚠ 巡飞弹未武装即撞毁 (离膛 {0}m 内不引爆)',LOITER_ARM_DIST));
loiterDespawn(d); return;
}
loiterDetonate(d,V3(hx,hy,hz),hitTank,hitSol,hitPlane);
return;
}
// 未命中: 只按本帧步长精确前进 (不再把命中检测的0.45m前瞻也算进位移)
d.pos.x+=dir.x*step; d.pos.y+=dir.y*step; d.pos.z+=dir.z*step;
if(d.grace>0){
// 出膛武装段: 未武装期**地形不引爆**, 强制贴地爬升 —— 贴身山坡发射 (陡坡地形常见) 不会撞坡自爆
// (2026-11-13 改口径: 豁免期从 0.8s 时长改为 LOITER_ARM_DIST 米飞行距离, 与弹速无关 —— 旧时长口径
//  加速 40m/s 下豁免窗拉到 32m; 撞掩体/单位改走上面"哑弹撞毁", 不再放行穿墙)
d.grace-=step;
const gh=heightAt(d.pos.x,d.pos.z);
if(d.pos.y<gh+0.35) d.pos.y=gh+0.35;
}else{
const nx=d.pos.x, ny=d.pos.y, nz=d.pos.z;
if(ny<=heightAt(nx,nz)+0.12){
if(d.owner&&d.owner.spectator){ loiterDespawn(d); return; } // 观战: 触地即消失, 不炸
loiterDetonate(d,V3(nx,heightAt(nx,nz)+0.3,nz)); return;
}
// 贴近判定兜底: 高速掠过/迎头撞击时单帧射线可能穿过机身, 距离足够近即碰炸
// (7c: 半径单源 planeHitR —— 旧手写 2.2×size+0.4; 逐机判是引信/兜底语义差, 距离谓词与 planeNearTest 同式)
for(const pl of planes){
if(pl.alive&&d.pos.distanceTo(pl.pos)<planeHitR(pl)+0.4){
if(d.owner&&d.owner.spectator){ loiterDespawn(d); return; }
loiterDetonate(d,d.pos.clone(),null,null,pl); return;
}
}
}
const nx=d.pos.x, nz=d.pos.z;
if(Math.abs(nx)>MAP_SIZE/2-2||Math.abs(nz)>MAP_SIZE/2-2||d.life<=0){
if(d.owner&&d.owner.spectator){ loiterDespawn(d); return; } // 观战: 到期/出界同样静默消失
loiterDetonate(d,d.pos.clone()); return;
}
// ★2026-11-05 实机反馈批 (用户问"巡飞弹在其他视角下可见吗"): 弹体可见性收拢为**单写者** —— 唯一隐藏态
//   = "镜头真的在弹鼻上" (玩家活着 + TV 档); 其余一切视角 (F 背追 / 本体第三人称 / 真观战自由视角 /
//   死亡镜头) 弹体一律可见。旧版 fireLoiter 出膛写 visible=false、只有 updateCamera 的 loiter 两分支能翻
//   回来 ⇒ 真观战 (alive=false, 进不了那个分支) 自由视角里弹体永隐。
const lz=mouse2Down&&!player._ltRClick;   // 开镜放大中强制第一视角 (与 20-player 相机分支同判据): 弹体同 TV 档一起藏, 防第三人称档开镜时弹体糊脸
d.mesh.visible=!(player.alive&&(!player.loiterView||lz));
d.mesh.position.copy(d.pos);
d.mesh.rotation.order='YXZ';
d.mesh.rotation.set(d.pitch,d.yaw,Math.sin(nowT*2.2)*0.05);
}
function loiterDetonate(d,p,directTank,directSol,directPlane){
if(d.dead) return;
d.dead=true;
d.mesh.visible=true;
scene.remove(d.mesh);
// ★2026-11-06 二次裁定 (用户实报"引爆/消失后玩家朝向仍是弹体末向"): 退场只清账, **不写**本体角 ——
//   制导全程零回写 ⇒ 本体角自然停在发射时朝向, 引爆/静默消失/T 弃弹三路一致 (11-05 批"退场一次性对齐"撤销, 见 updateLoiters 制导段注)。
if(player.loiter===d){ player.loiter=null; player._ltSpace=!!keys.Space; }   // 2026-11-07: 退场吞空格边沿 —— 退场瞬间仍按着空格(加速惯用), 本体松开前不吃残跳/残升/残加速 (清账行只剩退场+吞边沿, 退场朝向裁定 2026-11-06 不变)
player.tvDX=0; player.tvDY=0;   // 制导结束: 丢掉未消费的鼠标增量 (2026-09-28, 否则下一枚出膛会先"拐一下")
VM.root.visible=true;
const ov=document.getElementById('tvOv');
if(ov) ov.style.display='none';
loiterEng.stop();
if(!matchOver){
explosionFX(p);
AudioSys.explosion(p.distanceTo(camera.position)*0.8);
if(d.owner) d.owner._src='巡飞弹'; // 击杀来源重盖章 (2026-09-29): 制导飞行期间发射者身上的 _src 已是旧枪名
if(typeof markHitCls==='function') markHitCls('explo'); // 命中标识档: 爆炸类 (2026-09-30 批)
// 攻顶战斗部: 不分敌我的大范围高伤害爆炸 (含发射者自己与友军)
splashDamage(p,d.owner,-1,9.5,240,560,true,'explo'); // 巡飞弹: 反装甲全额, 无差别 (单源 splashDamage team=-1)
damageStructures(p,9,300,d.owner);           // 4参 = 破坏得分归属 (观战者操控的弹体同样给自己加分)
crater(p.x,p.z,1.6,true);
// ★2026-11-14 友伤开关: 关=直击段同队目标不再吃 (溅射段已由 splashDamage 队属归一收口; 开启=照旧不分敌我攻顶)
const _ltFF=t2=>EXPLO_FF||!d.owner||t2.team!==d.owner.team;
if(directTank&&_ltFF(directTank)){ directTank.takeDmg(900,d.owner,true); if(d.owner&&d.owner.isPlayer&&directTank.alive&&typeof onPlayerHitAny==='function') onPlayerHitAny('explo'); } // 巡飞弹直击: 反装甲全额
if(directPlane&&_ltFF(directPlane)){ directPlane.takeDmg(900,d.owner); if(d.owner&&d.owner.isPlayer&&directPlane.alive&&typeof onPlayerHitAny==='function') onPlayerHitAny('explo'); }
if(directSol&&directSol.alive&&_ltFF(directSol)){ directSol.damage(400,d.owner,false); if(d.owner&&d.owner.isPlayer&&directSol.alive&&typeof onPlayerHitAny==='function') onPlayerHitAny('explo'); }
}
if(player.alive&&player.curW&&player.curW.mag<=0&&player.curW.reserve>0) setTimeout(tryReload,450);
}
// 观战模式巡飞弹退场: 不爆炸不伤害, 收回TV视角 (仅观战使用 —— 手动左键才是观战唯一引爆方式)
function loiterDespawn(d){
if(d.dead) return;
d.dead=true;
d.mesh.visible=true;
scene.remove(d.mesh);
// ★2026-11-06 二次裁定 (用户实报"引爆/消失后玩家朝向仍是弹体末向"): 退场只清账, **不写**本体角 ——
//   制导全程零回写 ⇒ 本体角自然停在发射时朝向, 引爆/静默消失/T 弃弹三路一致 (11-05 批"退场一次性对齐"撤销, 见 updateLoiters 制导段注)。
if(player.loiter===d){ player.loiter=null; player._ltSpace=!!keys.Space; }   // 2026-11-07: 退场吞空格边沿 —— 退场瞬间仍按着空格(加速惯用), 本体松开前不吃残跳/残升/残加速 (清账行只剩退场+吞边沿, 退场朝向裁定 2026-11-06 不变)
player.tvDX=0; player.tvDY=0;   // 同上: 静默退场同样清账
VM.root.visible=true;
const ov=document.getElementById('tvOv');
if(ov) ov.style.display='none';
loiterEng.stop();
}
// ===== 观战模式 · 弃弹传送 (2026-09-17 观战扩展批, 用户指定) =====
// T 键: 正在操控巡飞弹时 —— 弹体**立刻静默消失** (复用 loiterDespawn: 不爆炸/不伤害/收回TV视角),
// 自身**瞬移到弹体所在位置**。定案 (用户裁定 A + 一条补充):
//   · 位置传送 + **速度清零** (不带着弹速冲出去), 视角朝向 = **发射时朝向** (2026-11-06 二次裁定:
//     退场不写本体角 ⇒ 本体角全程不被弹体污染; 传送瞬间视角从弹体末向跳回发射向, 有意为之。
//     2026-11-05 批前这条"视角朝向不变"实际是弹体朝向 —— 旧版本体角在制导期间被持续回写成弹体角);
//   · 保持当时的飞行/行走状态 (悬停飞行 / 气动飞行 / 落地行走各自延续, 只是位置变了);
//   · 落点做保护: y 抬到该点地面之上 (standHeight), 并跑一次 collideMove 把落点从墙体里挤出来 ——
//     "传送进墙里" 是这类瞬移最典型的观感事故;
//   · 传送后 onGround=false: 交给原有重力/落地逻辑自然结算 (观战免伤, 不会摔死)。
function specTeleportToLoiter(){
const d=player.loiter;
if(!d||d.dead) return false;
const tx=d.pos.x, ty=d.pos.y, tz=d.pos.z;
loiterDespawn(d);                       // 静默消失 (与"触地消失"同一条路径, 左键引爆才是另一条)
player.pos.set(tx,Math.max(ty,standHeight(tx,tz,ty+1.2)),tz);
player.vel.set(0,0,0);
collideMove(player.pos,0.42);
player.onGround=false;
player.crouch=false; player.prone=false;
AudioSys.click(900,0.35,0.06);
showScorePop('弃弹传送 · 已抵达弹体位置');
return true;
}
