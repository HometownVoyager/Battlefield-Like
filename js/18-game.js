// ─────────────────────────────────────────────
// 18-game.js —— 对局状态/玩家对象/小队
// 源: Index.original.html 第 6768-6936 行
// ─────────────────────────────────────────────
'use strict';
// ── 对局级定时器句柄管理 (2026-10-07 任务 0.5: 消除幽灵弹窗) ──
const MATCH_TIMERS = (typeof globalThis !== 'undefined' && globalThis.MATCH_TIMERS) || [];
if (typeof globalThis !== 'undefined') globalThis.MATCH_TIMERS = MATCH_TIMERS;

function addMatchTimeout(fn, ms) {
  let done = false;
  let id;
  const cb = () => {
    done = true;
    if (id !== undefined) {
      const idx = MATCH_TIMERS.indexOf(id);
      if (idx !== -1) MATCH_TIMERS.splice(idx, 1);
    }
    fn();
  };
  id = setTimeout(cb, ms);
  if (!done) MATCH_TIMERS.push(id);
  return id;
}

function clearMatchTimers() {
  while (MATCH_TIMERS.length > 0) {
    const id = MATCH_TIMERS.pop();
    clearTimeout(id);
  }
}
if (typeof globalThis !== 'undefined') {
  globalThis.addMatchTimeout = addMatchTimeout;
  globalThis.clearMatchTimers = clearMatchTimers;
}

let nowT=0, matchOver=false, matchTime=15*60;
let gamePaused=false, nowOff=0; // ESC 暂停: 主循环冻结+游戏时钟停止前进
let menuHold=true; // 返回主界面冻结 (2026-09-16 本批): 与 gamePaused 同为"冻结主循环", 但语义是"人在主菜单" ——
// 用于区分"暂停面板打开"与"菜单冻结", 恢复战斗时据此决定是否重新盖回暂停面板 (19-input 的 Esc 暂停只认 gamePaused)
let matchRunning=false; // 战局存续期 (2026-09-16 本批): 开局置位, 结算清零。与 player.deployed 分工不同 ——
// deployed 表示"玩家已落地参战"(兵种选择阶段为 false, 那是给 HUD/输入用的), matchRunning 表示"这一局还在";
// 「返回战斗」按钮与返回二次确认都认 matchRunning, 否则兵种选择阶段返回主界面会被判成"没有战局"而丢掉入口。
const tickets=[START_TICKETS,START_TICKETS];
let nadeWarnT=0, nadeMinDist=null;
// (2026-09-21 A#2 契约G) 第三人称动作计时口径 (姿势机在 20-player 的 playerAnimTick/updatePlayerAvatar 消费):
// 常量放这里而不是 20-player —— 18-game 是 player 状态的家 (damage/releaseNade/doMeleeHit 都在本文件写这些计时),
// 两边共用同一组数值, 不出现"动作时长在两个文件里各写一份"。
const FIRE_ANIM_T=0.20;   // 开火后坐动作时长 s (纯观感量, 与武器射速 fireT/冷却判定**完全无关**)
const FLINCH_ANIM_T=0.34; // 受击抽搐时长 s (与 Bot 的 flinchT 同一套 sin(t*40)*0.07)
const NADE_ANIM_T=0.45;   // 手雷投掷动作时长 s (起手后摆 → 松手前甩)
const MELEE_ANIM_T=0.42;  // 刺刀突进动作时长 s
const player = {
isPlayer:true, name:'你', team:0, cls:0,
pos:V3(-118,1,0), vel:V3(), yaw:HPI, pitch:0,
hp:100, alive:false, deployed:false, crouch:false, onGround:true,
spectator:false, flying:false,
specUsed:false, // 本局是否**在观战态下部署过** (判据 2026-09-27 收窄; 原 2026-09-16 记录批是"本局开过观战"):
// 粘性标记 —— 观战免伤/不被索敌/弹药无限, 用它打出来的战绩不进历史记录 (详见 21-match recCommit)。
// ★为什么从"开过观战"收窄到"部署过": 用户实报"选了一下观战模式再取消 ⇒ 结算照样判成观战局不予计量"。
//   在兵种卡上点一下开关不等于观战过对局 (可能只是看一眼效果/误点, 随后就取消), 而旧版**开关一开**就盖章、
//   关掉也不复位 ⇒ 整局白打。现在只有 23-deploy deployPlayer 里"真顶着观战态落进战场"那一下才盖章。
//   粘性保留 (中途关掉观战不能把这一局洗成正常局): 那正是反作弊要挡的"开观战刷完再关"。
specWant:null, // 待生效的观战意图 (2026-09-26H 观战批, 审计 #3/A3): 战斗中在兵种卡上开启观战只记意图,
// 到**下一次部署** (23-deploy deployPlayer) 才落到 player.spectator —— 旧版二次点击当场生效,
// 一个正在交战的活人可以在不阵亡的情况下瞬间变成"免伤+无限弹+可打双方"。null = 无待生效项。
// ★2026-11-01 裁定: 旧观战改称「调试模式」(能干涉战局 ⇒ 不计历史); 新增"自由观战"视模式见 specView。
specView:false, // 自由观战视模式 (2026-11-01, MC 旁观者式): 票尽后从部署页「观战」按钮进入。无碰撞/不可攻击/
// 无有效交互/创造飞行/可附身 Bot 视角 (20-player specView* 系)。与旧调试观战共用 player.spectator=true
// (免伤/不被索敌/清场票务等全部既有排除门零改动), 差异只用本标记区分。
specViewHost:null, // 附身的 Bot (14-bots 实体) 或 null=自由飞行; 只读视角, 不写 Bot 任何状态
specViewSpd:14, // 自由飞行速度 (m/s, 滚轮调 3..90)
ffAll:false, // 无差别火力 (2026-09-17 观战扩展批): 仅"驾驶观战专属幽灵坦克"期间为 true ——
// raySoldiers/命中载具时的敌我过滤失效, 主炮与同轴机枪对双方一律生效 (15c-specveh)。
ffSpecSniper:false, // 观战连狙无差别火力 (2026-09-20 观战连狙批, 用户口径"只有观战连狙可打双方"):
// 只在"观战者持/正在开火观战连狙(specsniper)"时为 true —— 20-player playerFireTick 每帧同步、playerShoot 开火瞬间落定;
// 与 ffAll 是**两个独立标记**: 幽灵坦克主炮/同轴机枪/巡飞弹一律不读它, 因此其它武器行为保持现状。
// 判定入口收在 13-combat coFfFire (步兵/载具/压制三处同源)。
stamina:1, sprinting:false, ads:false, holdBreath:false,
thirdPerson:false, // 步行第三人称开关 (2026-09-20 第三人称批, 键位 U): 只作用于步战相机分支 ——
// 载具追尾/C 车长镜、巡飞弹 F 切换、跳伞追尾各有自己的视角, 本开关与它们互斥 (20-player thirdPersonOn);
// 开镜(ADS)期间强制第一人称。弹道仍从角色眼位出发, 见 playerFireOrigin/playerAimDir。
mouseDX:0, mouseDY:0, landDip:0, airT:0,
slots:[], curSlot:0, curW:null, nadeCount:2,
fireT:0, bloom:0, lastDmgT:-99, deathT:0,
recoilPitch:0, recoilYaw:0,
kills:0, deaths:0, score:0, demol:0,   // demol: 摧毁的地图可破坏物组数 (2026-09-26 破坏得分批; 新对局由 22-hud resetPlayerForNewMatch 复位)
nadeHeld:false, nadeFuse:0, nadeIsSmoke:false, smokeCount:1, onMG:null, resupplyCd:0,
onVehicle:null, onAT:null, onAA:null, onNaval:null, flashlight:false, atNades:0, nadeIsAT:false, nadeIsIncin:false, incinCount:0, loiter:null, loiterView:0,
// (2026-11-10: 大舰甲板座位字段 onCapital/capitalGun 随大舰子系统下架摘除 —— 原"三座位互斥"只剩
//   onVehicle/onNaval 两座位, 互斥账在 20a-seats navalBoard / 15c specVehBoard 两处, 依旧双向清理。)
// tvDX/tvDY: 操控巡飞弹 (TV 制导) 期间鼠标 movementX/Y 的**累计器** (2026-09-28 制导重做):
//   19-input 只记账, 13-combat.updateLoiters 逐帧消费并清零 —— 制导的单源 (见那两处注释)。
tvDX:0, tvDY:0,
// 岸防炮座位 (2026-09-21 A#9 契约D): 与 onMG/onAT/onAA/onMortar 同族的"人在炮位上"字段 ——
// 上/下炮的唯一入口分别是 batteryMountPlayer / batteryDismountPlayer (sea-hud, 15f-battery),
// 这里只持有字段: 死亡链清空 (见 die), 全部分派/互斥清单见 20-player 的 updatePlayer/thirdPersonOn/updateInteractHint。
onBattery:null,
// 第三人称动作计时 (2026-09-21 A#2 契约G, 全部由本文件与 20-player 的 playerAnimTick 维护):
//   fireAnimT 开火瞬间置满 (playerShoot)   reloadT 每帧按 VM 剩余时间派生 (不落这里, 见 playerAnimTick)
//   nadeThrowT 手雷起手/松手各置一次        meleeT 刺刀起手/命中各置一次        flinchT 中弹瞬间置满
fireAnimT:0, reloadT:0, nadeThrowT:0, meleeT:0, flinchT:0,
suppressV:0, meleeCd:0,
// 军刀三式账 (2026-11-20 近战重做): startMelee (19-input) 起手时写入 —— 3P 姿态机按 meleeKind 分式,
// meleeT/meleeDur 归一化 (三式时长 0.35/0.5/0.7 各不同, MELEE_ANIM_T 只作缺省兜底)。
meleeKind:null, meleeDur:0,
bandages:4, maxBandages:4, bandaging:0, bandResupCd:0, grabAction:null,
// 原位换弹账 (★2026-11-20 火力点坐姿批): 固定火力点 (onMG/onAT/onAA/onMortar/onBattery) 上给随身武器
// curW 装填的读条账 —— 账挂 player 不挂 VM: 座位上 24-main 停跑 updateViewModel, VM 账没人收;
// 起步在 tryReload 火力点分支, tick/结算在 20-player (复用 finishReload), 打断收口在 cancelReadBar。
seatReload:0, seatReloadDur:0,
eyeH:1.62,
lastFiredT:-99, killerName:'',
suppress(a){ this.suppressV=Math.min(1,this.suppressV+a); },
leanT:0,
// ── 读条动作的取消单源 (★2026-10-12 用户提议② → 2026-10-25 扩容) ────────────────────────────────
// 全游戏原有三条"读条": 包扎 (本文件 bandaging 计时) / 拆除回收 (06-engineering 的 demolish) /
//   固定火力点使用前摇 (20-player 的 useCast)。★2026-10-25 用户裁定"拿起手雷/换弹无法取消不好":
//   举雷待发 (VM 'nade' 哨兵态 + nadeHeld, 手雷不消耗可收回) 与换弹 (VM 'reload', 弹药不结算)
//   并入同一张取消网 —— 账目各在各文件里, 但"怎么取消"只能有一条路 ——
//   否则就是"外部改字段、收尾只写在各自正常走完的路径里"的老病: 用户实报②的病根正是它
//   (F 取弹抢走 VM.state 后, 包扎的收尾永不执行 ⇒ 绷带卷 + 左臂缠臂环永久留在手上)。
// 两层收尾各归各的单源:
//   ① 账目层 = cancelReadBar: 计时清零 + 炮位占位交还 (useCast.g.user) + 举雷摘 nadeHeld + 文案;
//   ② 模型层 = vmAbortAction (10-viewmodel): 绷带卷/缠臂环/持刀左臂/举雷收枪/换弹中弹匣·弹夹·枪栓
//      归位的残留收起 (幂等; 换弹被抢走时弹匣正被搬在半路, 不归位就是"枪缺弹匣"滞留)。
// 口径: **取消 (X/✕/左键·限非举雷) / 受击打断 / 被别的行动抢占 走同一个出口**, 只是文案不同。
// ★2026-10-25 反馈轮两条裁定:
//   ① "打断"的完整语义 = 读条期间做**其他交互动作**会打断读条 (换枪/装填/举雷/包扎/近战/建造拆除/
//      F 交互栈…各入口在确认起步后调 stealBar 抢占; 同键重按不抢——R 重按不重启换弹、同种雷重举不重烧引信);
//   ② 受伤打断门槛 = 单次伤害 >READBAR_DMG_GATE (25) 才打断, 刮伤/火蚀/小跳伤不再打断 (damage 内单源门)。
readBarActive(){ return this.bandaging>0||!!this.demolish||!!this.useCast||!!this.vehRepair||this.seatReload>0
||(typeof VM!=='undefined'&&((VM.state==='nade'&&this.nadeHeld)||VM.state==='reload')); },
// 读条期间"身体被别的行动占用"的判据 (包扎 tick 每帧问一次, 见 20-player 的包扎段):
//   上车/上艇/驾巡飞弹/取弹 (grabAction) 任一为真, 或 VM 动作态已被抢走 ⇒ 按被打断收账。
//   ★2026-11-20 火力点坐姿批: 固定火力点五座 (onMG/onAT/onAA/onMortar/onBattery) **摘出本判据** ——
//   用户裁定坐着可以不下车包扎/换弹, 坐炮位不再构成"身体被占用"; 旧版 onMortar/onBattery 根本没列入,
//   是"H 起步一帧即断"的脏行为, 本批一并收编成"五座全放行"的单源口径 (载具/艇船/巡飞维持现状)。
// 故意**不含 useCast**: 它是"F 刚点上的新行动", 由 useCast 自己的 tick 反向收掉包扎 —— 放进来会把
//   玩家刚按下的 F 吃掉 (自己取消自己)。
readBarBusy(){ return !this.alive||!!this.onVehicle||!!this.onNaval||!!this.loiter||!!this.grabAction||(typeof VM!=='undefined'&&VM.state!=='bandage'); },
cancelReadBar(msg,quiet){
// ★2026-10-25 举雷/换弹并入: 账目旗必须在 vmAbortAction **之前**取 —— 模型层一收, VM.state 已回 idle,
//   事后再判就永远扑空 (any 不置位 ⇒ 取消了也不弹文案)。换弹的账目全在 VM/模型层, 这里只补旗标。
const nadeHold=this.nadeHeld, rl=(typeof VM!=='undefined'&&VM.state==='reload');
this.barArmKey=null;   // ★2026-10-30: 读条收尾顺手清打断确认账 (readBarActive 已变 ⇒ 旧键不得残留到下一条读条)
if(typeof vmAbortAction==='function') vmAbortAction();   // 模型层先收 (与下面账目层先后无所谓, 两边幂等)
let any=false;
if(this.bandaging>0){ this.bandaging=0; any=true; }
if(this.demolish){ if(typeof stopDemolish==='function') stopDemolish(this,true); else this.demolish=null; any=true; }
if(this.useCast){ if(this.useCast.g&&this.useCast.g.user===this) this.useCast.g.user=null; this.useCast=null; any=true; }
if(this.vehRepair){ this.vehRepair=null; any=true; }   // 坦克维修读条 (2026-11-16 批1): 并入取消网, X/死亡收口/F 抢占同口清账
// ★2026-11-20 火力点坐姿批: 原位换弹并入取消网 —— X / 受击>25 / 死亡 / stealBar 抢占 / 换局全自动继承
//   (账挂 player, 与 VM 无关, 放在 vmAbortAction 之后判也算得准); 弹不结算, 与换弹中止同语义。
if(this.seatReload>0||this.seatReloadDur>0){ this.seatReload=0; this.seatReloadDur=0; any=true; }
if(nadeHold){ this.nadeHeld=false; any=true; }   // 举雷收回: 雷回 pouch 不消耗 (VM/雷模由 vmAbortAction 收)
if(rl){ any=true; }                              // 换弹中止: 弹药不结算 (finishReload 只在自然走完那条路)
if(any&&!quiet&&this.isPlayer) showScorePop(msg||'已取消');
return any;
},
// ★2026-10-25 反馈轮① 抢占单源: 动作/交互入口在**确认会起步之后**调用 —— 安静收掉当前读条 (账目+模型
//   两层, 与 X/受击同一出口; 新动作自身的提示就是反馈, 不再叠"已取消")。空按 (无目标/冷却中/同键重按)
//   不得走到这里 —— 不该白丢读条。调用方: 19-input 各动作键 / 20-player tryInteract 交互栈 / 06-engineering 建造。
stealBar(){ if(this.readBarActive()) this.cancelReadBar(null,true); },
// ★2026-11-16 批1 坦克补给箱修理 (起步口): 玩家坦克停在补给箱 (AMMO_CRATES, 舰上箱除外) VEH_REPAIR_R 米内
// 按 R 起修 —— 8s 读条走完回 25%×maxHp。打断全部走 cancelReadBar 单源 (账挂 player.vehRepair, 已进
// readBarActive): 移动/远离 (20a-seats updatePlayerTank tick) / 开火 (fireCannon+firePlayerMG) / 下车
// (20-player tryInteract) / 起火 (tick 判 burning) / 单次重伤 >26%×maxHp (Tank.takeDmg)。R 重按不重启
// (已在读条中直接早退, 与换弹口径一致)。Bot 车组同规自动修 (2026-11-17 同步批): 残血+脱离接敌+箱在 R 内
// 驻车自修, 账挂 tank.vehRepair, 打断钩与玩家共用 (fireCannon/AI同轴/takeDmg), 见 15-vehicles driveAI/update。
tryVehRepair(){
if(!this.alive||this.spectator) return;
const t=this.onVehicle;
if(!t||t.kind!=='tank'||!t.alive||t.burning) return;
if(t.hp>=t.maxHp) return;
if(this.vehRepair) return;
// 距离门走 15-vehicles 单源 vehRepairCrateNear (2026-11-17 Bot 车组起步门共用; 舰上箱除外)
if(typeof vehRepairCrateNear!=='function'||!vehRepairCrateNear(t.pos.x,t.pos.z)){ showScorePop('附近没有补给箱, 无法维修'); return; }
this.stealBar();   // 确认起步才抢 (2026-10-25 纪律): 旧读条安静收账
this.vehRepair={t:0,dur:VEH_REPAIR_TIME,tank:t};
showScorePop('维修中… 移动/开火将打断');
},
// ★2026-10-30 读条交互批 (用户裁定③) 打断确认单源: 读条中按**其他动作键**第一次 = 只记键**不抢** (22-hud
//   的读条上会亮"再按一次打断"提示), BAR_ARM_WIN 秒内**同键**再按才放行。放行后抢占仍由调用方在
//   "确认起步"处调 stealBar (★2026-10-25 的"确认起步才抢"纪律原样保留 —— 第二次按时目标没了/起步失败了
//   也不白丢读条)。无读条时恒 true (直通, 零行为变化)。键传 e.code 或稳定标识 (换枪用 'SW'+槽位)。
//   同键再按 (包扎H/回收6/前摇F/拆除B/换弹R) 不走这里 —— 那是"加速"不是"打断", 各键处理器自理。
barArmKey:null, barArmT:-9,
barStealArmed(key){
if(!this.readBarActive()){ this.barArmKey=null; return true; }
if(this.barArmKey===key&&nowT-this.barArmT<BAR_ARM_WIN){ this.barArmKey=null; return true; }
this.barArmKey=key; this.barArmT=nowT;
return false;
},
// ★2026-10-30 票尽观战部署放行 (用户裁定): 部署门单源判据 —— **本次部署解决后**的观战态。
//   specWant 是"待生效"意图 (战斗中在兵种卡上点开的开关), 要到 deployPlayer 才落进 spectator,
//   所以门必须问"解决后"而不是"现在": specWant=true → 放行; specWant=false (显式关) 与
//   未设 (null+false) → false, 票尽照旧禁用。观战部署不耗票, fieldCount 不计观战者 (21-match),
//   清场判定/最后一人倒计时均不受影响。
//   ★2026-11-01: 自由观战视模式 (specView) 也把 spectator 置真, 但它**没有"待生效"语义** ——
//   视模式不是部署, specWant 必须保持 null; 回退分支因此排除 specView (视模式下本门照旧 false,
//   部署按钮才会在票尽时切成「观战」而非「部署」, 见 22-hud/23-deploy/24-main 三处同判据)。
specWillBe(){ return (typeof this.specWant==='boolean')?this.specWant:(!!this.spectator&&!this.specView); },
damage(amt,attacker,isHead){
if(!this.alive||matchOver||this.spectator) return; // 观战: 完全免伤
// 出生保护 (2026-09-28 阶段三 P1): 落地 0.5s 内**敌方来源**伤害免掉 (开火即解除, fireBullet 清账);
// 摔落/溺水/严寒 (attacker=null) 与车毁链不在此列 —— 保护只防"落地被秒", 不该让人从坠机里活着走出来。
if(this.protUntil&&nowT<this.protUntil&&attacker&&attacker.team!==this.team) return;
// (2026-09-21 A#8 契约E) 伞降保护: 伞降中 (chute 且未落地) 受到的伤害 ×CHUTE_DEF.dmgMul —— 判定函数
// chuteAirborne/chuteDamageMul 由 bots 写在 13-combat (全体单源)。typeof 守卫: 缺了它就是 ×1.0, 不报错。
// 位置在"连杀减伤"之前: 两个倍率相乘, 与顺序无关, 但先乘能让下面的日志/后续逻辑都看到同一口径的 amt。
if(typeof chuteDamageMul==='function') amt*=chuteDamageMul(this);
// (2026-09-21 A#2 契约G) 受击抽搐: 每次**中弹**重置计时 (与 Bot 的 flinchT 同一套姿态口径)。
// 只对"有来源的命中"或"单次 ≥2 伤害"抽搐 —— 严寒/激流/溺水这些**每帧小跳伤**不该让第三人称一直抖
// (rapids 每帧 COLD_DMG*dt 级, 1 秒几十次重置会让躯干定格在抽搐姿态上)。
if(attacker||amt>=2) this.flinchT=FLINCH_ANIM_T;
// 连杀增益·减伤: 只吃敌方来源伤害 (摔落/严寒/激流等无主伤害与自伤不吃, 2026-09-11)
if(this.streakBuff&&this.streakBuff.dmgCut>0&&attacker&&attacker!==this&&attacker.team!==this.team) amt*=1-this.streakBuff.dmgCut;
this.hp-=amt;
this.lastDmgT=nowT;
// 读条受击打断 (★2026-10-12 → 2026-10-25 扩到举雷/换弹 → 反馈轮② 加门槛): 统一走取消单源 —— 旧版只清字段
//   (bandaging=0 / demolish=null), VM.state 仍停在 'bandage' ⇒ 绷带卷与缠臂环永久挂在手上 (用户实报②的另
//   一个入口, 与 F 抢占同源)。举雷被打断 = 雷收回不消耗; 换弹被打断 = 弹药不结算 (想换完就先找掩体)。
//   门槛 = 单次伤害 >READBAR_DMG_GATE (25): 判在减免之后的最终 amt 上; 死亡清账 (die 内) 仍无条件收。
if(amt>READBAR_DMG_GATE&&this.readBarActive()){
// ★2026-11-03 死亡掉雷批: 这一击直接致命 (hp 已在上方扣减) ⇒ 捏着的雷**掉落**代替收回 —— dropHeldNade 入
//   全局 nades 账, 随后的 cancelReadBar 只收玩家侧账目/模型, 碰不到已入账的弹体; 读条余时由厨雷账
//   nadeFuse 天然继承 (掉落引信=余值)。出手弧 (readBarActive 假, 松手后) 与 ≤25 致命击不走这里 ——
//   由 die() 内的掉雷钩兜底 (持雷/弧两态判据见 die())。
if(this.hp<=0&&this.nadeHeld) dropHeldNade(this);
this.cancelReadBar(this.bandaging>0?'包扎被打断!':(this.demolish?'拆除被打断!':(this.useCast?'使用被打断!':(this.nadeHeld?'举雷被打断!':'换弹被打断!'))));
}
AudioSys.hurt();
dmgFlash=Math.min(1,dmgFlash+0.5);
addTrauma(0.25);
if(attacker){
const a=Math.atan2(attacker.pos.x-this.pos.x,attacker.pos.z-this.pos.z);
addDirHit(a);
}
if(this.hp<=0){
this.hp=0;
this.die(attacker,isHead);
}
},
die(attacker,isHead){
this.alive=false;
this.deaths++;
// 指挥官阵亡 (2026-10-26 指挥官批, D1): 地图关 + 死亡期间无法下令; 各单位维持最后命令继续执行
if(typeof cmdMapForceClose==='function') cmdMapForceClose();
this.deathT=nowT;
tickets[this.team]=Math.max(0,tickets[this.team]-1);
this.killerName=attacker?(attacker.name||'敌军'):'';
this.killerSrc=killSrcLabel(attacker); // 击杀来源: 载具/固定火力点/武器名 (2026-09-04)
if(attacker&&attacker!==this){ attacker.kills=(attacker.kills||0)+1; attacker.score=(attacker.score||0)+SCORE_TABLE.kill; addKillfeed(attacker,this,!!isHead); } // ★2026-11-01 判定批: 爆头位透传 (旧硬编码 false —— Bot die 链 14-bots 传 isHead, 唯独玩家被爆头击杀时播报永远不出 ☠)
if(typeof resetKillStreak==='function') resetKillStreak(); // 阵亡清空连杀计数
const _pInfAct=(attacker&&attacker.zombie)||(typeof isFullInfectionActive==='function'&&isFullInfectionActive());
if(ZOMBIE_MODE&&_pInfAct){ if(typeof queueZombieInfect==='function') queueZombieInfect(this.pos.x,this.pos.z,Math.random()<0.18?'runner':'walker',1.6,this.deathRag); else if(typeof spawnZombie==='function') spawnZombie(this.pos.x,this.pos.z,Math.random()<0.18?'runner':'walker'); } // 丧尸模式: 延迟尸变入队 (防同帧爆炸二次炸死/双倍击杀)
	if(this.onMG){ releaseEmpl(this.onMG,true); this.onMG=null; }
	if(this.onAT){ releaseEmpl(this.onAT,true); this.onAT=null; }
	if(this.onAA){ releaseEmpl(this.onAA,true); this.onAA=null; }
	if(this.onMortar){ releaseEmpl(this.onMortar,true); this.onMortar=null; }
	// 岸防炮占位随死亡释放 (2026-09-21 A#9): 与上面四个阵位同规 —— 先让 owner 接口清占用/相机态, 再清字段。
	// typeof 守卫: batteryDismountPlayer 由 sea-hud 写在 15f-battery, 缺了它就只清字段 (绝不能把玩家钉在炮位上)。
	if(this.onBattery){ if(typeof batteryDismountPlayer==='function') batteryDismountPlayer(); this.onBattery=null; }
	// 海战座位随死亡交还 (★2026-09-26E 审计 7): 与上面四个阵位/岸防炮同规 —— 旧版 die() 漏了 onNaval,
	// 于是"艇上阵亡"时 craft.playerDriven 保持 true ⇒ 该艇在"死亡→再部署"期间不驱动、不还击 (变成漂着的空壳),
	// #navalHud 与"鱼雷 ×N/[F] 鱼雷"还会在死亡镜头里冻结显示。旧版只靠 23-deploy:382 的再部署兜住。
	// typeof 守卫: navalSeatRelease 由 20a-seats 提供, 缺了它就只清字段 (绝不能把人钉在艇上)。
	if(this.onNaval){ if(typeof navalSeatRelease==='function') navalSeatRelease(); else this.onNaval=null; }
	// (2026-11-10: 大舰甲板座位 onCapital/capitalGun 死亡交还账随大舰子系统下架摘除)
	if(this.loiter){ loiterDetonate(this.loiter,this.loiter.pos.clone()); }
	// ★2026-11-03 死亡掉雷批 (用户裁定"死亡时手里捏的雷掉落在原地, 并继承读条时间"):
	// "捏着" = 持雷 (nadeHeld, 厨雷引信照烧) 或出手弧中 (松手后 VM 仍 'nade', 出手帧未到) —— 与 20-player
	// playerNadeReady 同口径。updateViewModel 随 alive 停摆 (24-main 门) ⇒ 死后弧永不走出手帧, 不掉落就是
	// 又一例"原地消失"。掉落后把 'nade' 态收回 idle (复刻 10-viewmodel 哨兵自愈的收尾三件套) —— 死后残留的
	// 弧绝不能再走出手 (防复活后双雷)。受创>25 打断 (damage 内) 不走这里: 人没死, 雷收回不消耗。
	if(this.nadeHeld||((typeof VM!=='undefined')&&VM&&VM.state==='nade'&&(this.nadeThrowT||0)<=0)){
	dropHeldNade(this);
	if(typeof VM!=='undefined'&&VM&&VM.state==='nade'){ VM.state='idle'; if(VM.nadeM) VM.nadeM.visible=false; if(VM.gunParts&&VM.gunParts.gun) VM.gunParts.gun.visible=true; }
	}
		this.onVehicle=null;
		this.nadeHeld=false;
	// (2026-09-21 A#2 契约G) 动作计时随死亡清零: 死亡姿态由布娃娃/倒地接手, 不留开火后坐/换弹/投掷的残余
	this.fireAnimT=0; this.reloadT=0; this.nadeThrowT=0; this.meleeT=0;
	// ★2026-10-12 读条随死亡一次收口 (与上面动作计时同规, quiet: 死亡反馈已经够多, 不再叠一条"已取消"):
	//   旧版 die() 不清 bandaging/demolish/useCast ⇒ 死亡镜头里绷带卷与缠臂环照挂, 复活后第一帧才自愈。
	if(this.readBarActive()) this.cancelReadBar(null,true);
	// (2026-09-21 A#8 契约E) 死亡必须彻底收伞 (空中阵亡): 置 false 后**同帧**摘模型, 不留"尸体挂着伞"
	this.chute=false;
	if(typeof playerChuteClear==='function') playerChuteClear();
	// 死亡立刻收起狙击镜, 避免镜片遮罩残留
	this.ads=false; this.holdBreath=false;
	this.ffAll=false; // 无差别火力标记随死亡清除 (幽灵坦克驾驶中不会死: 观战免伤, 这里只是兜底)
	this.ffSpecSniper=false; // 观战连狙标记同理 (2026-09-20): 死亡/再部署期间不得残留无差别火力
	if(typeof specVehUnbind==='function') specVehUnbind(); // 幽灵坦克解绑驾驶权 (否则车还记着一个已死的驾驶员)
	document.getElementById('scopeOv').style.display='none';
// 交互提示/座位 HUD 随死亡一次收干净 (2026-09-25 修): #interact(F 提示行) 与 #clsTip(兵种提示) 只由
// 20-player 的 updateInteractHint 维护, 而它只在活人分支被调用 ⇒ 死在坦克/机枪旁边时提示一直挂到
// showDeploy 盖上为止 (准星在 22-hud 的死亡分支里是收掉的, 只有这两件漏)。这里复用同一个单源函数:
// alive 已置 false, 它自然走到末尾的 elm.style.display='none' / tip 置空。
// 同批收掉热量条: die() 直接 releaseEmpl 清座位, 绕过了 F 下车路径里的那些 DOM 收尾。
if(typeof updateInteractHint==='function') updateInteractHint();
{ const hw=document.getElementById('heatWrap'); if(hw) hw.style.display='none';
  const mw=document.getElementById('mgHeatWrap'); if(mw) mw.style.display='none'; }
document.exitPointerLock&&document.exitPointerLock();
noteDeath(this.pos.x,this.pos.z);
// 玩家布娃娃 + 2秒第三人称死亡镜头 —— 2026-11-20 批⑦: 就地倒下档不 spawn ⇒ deathCamT=0.8 短镜头 +
// playerAvatarDeath 本体倒地 (契约G 既有无物理分支), 零新增账。
this.deathRag=(window.CANNON&&!deathFallMode())?spawnRagdoll(this,attacker,isHead):null;
this.deathCamT=this.deathRag?2.2:0.8;
this.deathCamYaw=this.yaw+Math.PI;
this.deathPos=this.pos.clone();
this.deathPos.y+=0.4;
// 死亡时视角=击杀者 (2026-11-12 批, sf_deathcam 默认自己): 目标解析只认"持枪 Bot 士兵" (slots) 与
// 载具真人驾驶员 (crewBot); 自杀 (attacker===this)/环境死 (null)/丧尸等无 slots 对象一律回退原死亡
// 镜头。纯观察账: 相机消费在 20-player updateCamera 死亡分支 (specView 之后, 0.5s 原镜头 → killcam
// 直到 showDeploy), 收账单源 killcamEnd (showDeploy/endMatch/enterSpecView 三点接线)。
this.killcam=null;
if(DEATHCAM_KILLER&&attacker&&attacker!==this){
const kb=(attacker.slots&&attacker.pos)?attacker:((attacker.crewBot&&attacker.crewBot.slots&&attacker.crewBot.pos)?attacker.crewBot:null);
if(kb) this.killcam={src:kb,t:0};
}
setRespawnCd(8); // 经 22-hud owner 接口 (2026-09-06 B7b/P2-14)
const dly=this.deathRag?2100:900;
addMatchTimeout(()=>{ if(!this.alive){ const bo=document.getElementById('blackOv'); if(bo) bo.style.opacity=0.75; } },dly);
addMatchTimeout(()=>{ if(!matchOver&&!this.alive&&typeof showDeploy==='function') showDeploy(true); },dly+700);
},
doMeleeHit(kind){
// ★2026-11-20 近战重做: 军刀三式结算 (kind='thrust'|'slash'|'chop', 10-viewmodel melee 分支中段经
// vmPlayOnce 单发调用)。伤害直伤 (不过 DIFF_TABLE/距离衰减, 与既有近战直伤先例一致), isHead 恒 false。
// ★2026-11-20 实机反馈批: **不再在命中瞬间把 meleeT 重置满** —— 3P 姿态时间轴从挥砍起点 (melWind 边沿
//   置满 meleeDur, 20-player) 一路衰减, 与 FP 动画天然同轴; 旧重置会把相位曲线从中途"重播一遍引刀"
//   (斩在 t≈0.175s 命中 ⇒ 扫击相位永远打不完, 实测刀件摆幅被腰斩)。meleeT 只被 3P overlay/thrust 门消费。
const def=WPN_DEFS.sabre;
const dir=camForward();
const o=camera.position.clone();
// 刺刀摘 ffSpecSniper (2026-09-20 观战连狙批; 2026-11-09 观战中立批后为历史注记): 旧口径"只有观战连狙
// 可打双方"时, 不摘标记的话观战者握连狙贴队友按 V 会直接把友军捅死。新口径下观战者所有武器对双方生效
// (coFfFire 的 spectator 门), 摘旗不再阻断观战军刀伤友军; 代码保留 —— 非观战握持态语义不变。
const ff=player.ffSpecSniper; player.ffSpecSniper=false;
player._src='军刀';   // 击杀来源单源 (killSrcLabel 优先读 _src; 三式同源, 结算前落定)
let hitAny=false;
if(kind==='slash'){
// 横斩: 扇形多目标 —— 候选集与子弹同一口径 (combatants, 含丧尸), 门: XZ 距≤range / |dy|≤1.8 /
// 水平前向点积≥0.5 (±60° ≈ 120° 扇) / 无遮挡 (仿 splashDamage 的逐人世界射线)。
const fxz=V3(dir.x,0,dir.z); if(fxz.lengthSq()<1e-6) fxz.set(0,0,-1); fxz.normalize();
for(const s of combatants){
if(!s.alive||s===player||s.onVehicle||s.spectator) continue;
if(!coFfFire(player)&&s.team===player.team) continue;
const dx=s.pos.x-o.x, dz=s.pos.z-o.z;
const dxz=Math.hypot(dx,dz);
if(dxz>def.range||dxz<0.05) continue;
if(Math.abs((s.pos.y+0.9)-o.y)>1.8) continue;
if((dx*fxz.x+dz*fxz.z)/dxz<0.5) continue;
if(dxz>0.6){
const bd=raycastWorld(o,V3(dx,(s.pos.y+0.9)-o.y,dz).normalize(),dxz);
if(bd&&bd.dist<dxz-0.5) continue;
}
hitAny=true;
s.damage(def.slashDmg,player,false);
}
} else {
// 刺 / 劈: 单目标射线 (头球+身柱, raySoldiers 敌我过滤同子弹) —— 劈伤害更重。
const sr=raySoldiers(o,dir,def.range,player);
if(sr){
hitAny=true;
sr.sol.damage(kind==='chop'?def.chopDmg:def.thrustDmg,player,false);
}
}
player.ffSpecSniper=ff;
if(hitAny){
// 近战命中反馈 (2026-09-30 批口径保留, 按式分级): 档='mg' 无框白X; 致命一击不补白 (die 链红档);
// 扇形多目标聚合反馈一次 (与 splashDamage 的 _fbAny 同款), 劈=更重的震屏与更低的打击音。
if(typeof markHitCls==='function') markHitCls('mg');
if(typeof onPlayerHitAny==='function') onPlayerHitAny('mg');
addTrauma(kind==='chop'?0.25:0.15);
AudioSys.click(kind==='chop'?380:500,0.5,0.09);
} else {
const wr=raycastWorld(o,dir,2.4);
if(wr){ impactFX(wr.point,wr.normal,wr.kind); AudioSys.click(1800,0.3,0.05); }
}
},
	releaseNade(){
	// (2026-09-21 A#2 契约G) 松手出手瞬间: 投掷动作计时置满 —— 姿势机从这里开始"前甩 follow-through"
	// (起手后摆由 20-player playerAnimTick 按 VM.state==='nade' 的边沿置一次)。这里**不改**任何投掷弹道数值。
	this.nadeThrowT=NADE_ANIM_T;
	// 出手点/方向单源 (2026-09-30 批2): 右手出手点 + 朝准星命中点汇聚 —— 与 22-hud 预演逐字同源
	// (旧版是 camera.position + camForward: 起点在相机轴线上 ⇒ 弹道投影成一条线, 见 20-player 该函数头注)。
	const o=playerThrowOrigin();
	const dir=playerThrowDir(o);
if(this.nadeIsIncin){
player._src='燃烧弹';
const v=dir.multiplyScalar(NADE_THROW.incin.v).add(V3(0,NADE_THROW.incin.up,0)).add(this.vel.clone().multiplyScalar(0.4));
throwNade(this,o,v,Math.max(0,this.nadeFuse),false,false,true);   // ★2026-11-17 批2.6: 燃烧弹出手带烹饪余值 (旧固定 1.6; 举雷期引信已照烧)
this.incinCount--;
this.nadeIsIncin=false;
} else if(this.nadeIsSmoke){
player._src='烟雾弹';
const v=dir.multiplyScalar(NADE_THROW.smoke.v).add(V3(0,NADE_THROW.smoke.up,0)).add(this.vel.clone().multiplyScalar(0.4));
throwNade(this,o,v,Math.max(0,this.nadeFuse),false,true);   // ★2026-11-17 批2.6: 烟雾弹出手带烹饪余值 (旧固定 1.8)
this.smokeCount--;
this.nadeIsSmoke=false;
} else if(this.nadeIsAT){
player._src='反坦克雷';
const v=dir.multiplyScalar(NADE_THROW.at.v).add(V3(0,NADE_THROW.at.up,0)).add(this.vel.clone().multiplyScalar(0.4));
throwNade(this,o,v,1.6,true);
this.atNades--;
this.nadeIsAT=false;
} else {
player._src='手雷';
const v=dir.multiplyScalar(NADE_THROW.frag.v).add(V3(0,NADE_THROW.frag.up,0)).add(this.vel.clone().multiplyScalar(0.4));
throwNade(this,o,v,this.nadeFuse);
this.nadeCount--;
}
AudioSys.metalSlide(0.2,0.08,600,300);
},
finishReload(){
const w=this.curW;
if(!w) return;
if(this.specViewHost) return;   // ★2026-11-03 真附身: 换弹镜像是宿主账 (Bot 换弹完成时已自账写满), 玩家侧结算让位防跨账写
const need=w.def.mag-w.mag;
const take=Math.min(need,w.reserve);
w.mag+=take; w.reserve-=take;
},
doGrabResolve(){
if(!this.grabAction) return;
const ga=this.grabAction;
		if(ga.kind==='ammo'||ga.kind==='truck'||ga.kind==='supply'){
		const ac=ga.crate;
		// 补给(弹药箱/运输车/临时补给点): 投掷物+绷带全满; 子弹 ★2026-10-25 用户裁定改为"进弹袋不进弹夹":
		//   旧版 mag+reserve 直接双满 (拿起就能打); 新版 mag 原样不动, reserve 顶到 **备用上限+一个弹夹**
		//   (有意超上限 —— 超出量恰是一匣, 与旧版相比总弹数不亏, 只多一道自己按 R 的手续)。读条/取消不涉及。
		for(const s of this.slots){ s.reserve=s.def.reserve+s.def.mag; }
		const gear=clsGear(this.cls,this.team);
	this.nadeCount=gear.nades;
	this.smokeCount=gear.smoke;
	this.incinCount=gear.incin;
	this.atNades=gear.atn;
	this.bandages=this.maxBandages;
this.resupplyCd=ga.kind==='truck'?8:6;
AudioSys.metalSlide(0.3,0.15,500,900);
showScorePop(ga.kind==='truck'?t2('运输车补给完成'):(ga.kind==='supply'?t2('补充点补给完成'):t2('弹药已补充')));
} else if(ga.kind==='medcrate'){
const c=ga.crate;
this.bandages=this.maxBandages;
c.uses--;
this.bandResupCd=4;
AudioSys.click(900,0.3,0.05);
showScorePop(t2('绷带已补充'));
if(c.owner&&c.owner!==this){ c.owner.score=(c.owner.score||0)+SCORE_TABLE.medkit; }
}
this.grabAction=null;
},
};
combatants.push(player);
// ===== 小队指挥系统 =====
const SQUAD={ mode:'follow', pos:V3(), members:[], marker:null };
function squadMarkerInit(){
if(SQUAD.marker) return;
const c=document.createElement('canvas'); c.width=64; c.height=64;
const g=c.getContext('2d');
g.fillStyle='rgba(255,215,90,.95)';
g.beginPath(); g.moveTo(32,58); g.lineTo(14,28); g.lineTo(50,28); g.closePath(); g.fill();
g.strokeStyle='rgba(0,0,0,.7)'; g.lineWidth=3; g.stroke();
g.fillStyle='rgba(255,215,90,.9)'; g.font='bold 22px sans-serif'; g.textAlign='center';
g.fillText('攻',32,22);
SQUAD.marker=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthTest:false}));
SQUAD.marker.scale.set(2.2,2.2,1);
SQUAD.marker.renderOrder=6;
SQUAD.marker.visible=false;
scene.add(SQUAD.marker);
}
function squadOrderMove(){
if(!player.alive||!SQUAD.members.length) return;
const o=camera.position.clone(), d=camForward();
const hit=raycastWorld(o,d,150);
const pt=hit?o.clone().addScaledVector(d,hit.dist):o.clone().addScaledVector(d,90);
pt.y=heightAt(pt.x,pt.z);
SQUAD.mode='move';
SQUAD.pos.copy(pt);
squadMarkerInit();
SQUAD.marker.visible=true;
SQUAD.marker.position.set(pt.x,pt.y+2.1,pt.z);
for(const s of SQUAD.members){ if(s.alive&&!s.onVehicle){ s.decisionT=0; s.repathT=0; s.path=null; } }
showScorePop('小队: 进攻标记位置!');
AudioSys.click(1500,0.3,0.05); AudioSys.click(1100,0.25,0.06);
}
function squadOrderFollow(){
if(!SQUAD.members.length) return;
SQUAD.mode='follow';
if(SQUAD.marker) SQUAD.marker.visible=false;
for(const s of SQUAD.members){ if(s.alive&&!s.onVehicle){ s.decisionT=0; s.repathT=0; } }
showScorePop('小队: 跟我走!');
AudioSys.click(1300,0.3,0.05);
}
