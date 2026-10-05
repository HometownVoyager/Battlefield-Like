// ─────────────────────────────────────────────
// 19-input.js —— 键鼠输入/换弹/切枪
// 源: Index.original.html 第 6937-7076 行
// ─────────────────────────────────────────────
'use strict';
const keys={};
let pointerLocked=false;
// 第三人称切换单源 (2026-09-20 第三人称批 + 集成修正): 桌面 U 键与移动端触控键 #tView 共用这一份。
//
// 【为什么必须在**模块级**而不是 keydown 回调里】: 触控键由 24-main 的 bindBtn 直接调用本函数
// (而不是派发 KeyboardEvent —— 触屏没有 Pointer Lock, 派发会被下面第 41 行的闸门挡住, 且 iOS 的
// KeyboardEvent 构造器不接受 code)。函数声明若写在回调内部, 就只在该回调的词法作用域里可见,
// 全局 undefined —— 移动端按钮会静默失效。这里放在模块级, 两条入口才真的同源。
//
// 行为只改视角: 载具(追尾/C 车长镜)、巡飞弹(F 切换)、跳伞各有自己的视角键, 本开关不接管
// (见 20-player thirdPersonOn); 开镜(ADS)期间强制第一人称, 松开右键自动回来。
function toggleThirdPerson(){
if(!player.alive||!player.deployed) return;   // 未落地/阵亡时不给切 (与 HUD 提示的可见条件同口径)
player.thirdPerson=!player.thirdPerson;
if(typeof AudioSys!=='undefined'&&AudioSys.click) AudioSys.click(900,0.25,0.05);
if(typeof showScorePop==='function') showScorePop(player.thirdPerson?t2('第三人称: 开'):t2('第三人称: 关'));
}
// 海战驾驶位 C 键三态 (2026-09-21 用户裁定"要"炮手观测链): 第三人称(追尾) → 炮手镜 → 艏向第一人称 → 回第三人称。
// 单源: 只翻 p.thirdPerson / p.navalGun 两个开关, 相机 (20-player updateCamera) 与瞄准输入源 (20a updatePlayerNaval)
// 都读它们 —— 本函数不碰相机、不碰炮塔。放在模块级是为了将来触控键也能共用 (与 toggleThirdPerson 同一理由)。
function navalCycleView(){
const p=player;
if(!p.onNaval) return;
if(p.thirdPerson&&!p.navalGun){ p.thirdPerson=false; p.navalGun=true; }        // ① → ② 炮手镜
else if(p.navalGun){ p.navalGun=false; p.thirdPerson=false; }                  // ② → ③ 艏向第一人称
else { p.thirdPerson=true; p.navalGun=false; }                                 // ③ → ① 追尾
if(typeof AudioSys!=='undefined'&&AudioSys.click) AudioSys.click(1100,0.25,0.05);
if(typeof showScorePop==='function')
showScorePop(t2(p.navalGun?'炮手镜 · 稳像倍镜':(p.thirdPerson?'第三人称: 开':'艏向第一人称')));
}
addEventListener('keydown',e=>{
if(e.code==='Tab'){ e.preventDefault(); document.getElementById('scoreboard').style.display='block'; updateScoreboard(); }
if(e.code==='Escape'&&!e.repeat){
if(player.deployed&&player.alive&&!matchOver) togglePause();
return;
}
if(e.repeat) return;
if(gamePaused) return;
keys[e.code]=true;
// 实验模式: P 切换 AI 调试层 (bot 状态标签+寻路线), 仅供调参
if(e.code==='KeyP'&&EXPERIMENT&&typeof BotDebug!=='undefined') BotDebug.toggle();
// 战场大地图: M 开关 (全域北向视图; 仅部署存活时, 暂停/菜单/部署界面不响应)
if(e.code==='KeyM'&&player.deployed&&player.alive) toggleBigMap();
// 观战模式: 双击空格 = MC创造式悬停飞行开关 (无重力可悬停; 若在气动飞行中则切为悬停)
if(e.code==='Space'&&player.spectator&&player.alive&&!player.onVehicle&&!player.onNaval&&!player.loiter){   // 2026-09-26E 审计 18: 艇上不留 flying 残留
const tapT=performance.now();
if(tapT-(player._spaceTapT||0)<300){
if(!player.flying){
player.flying=true; player.flyAero=false;
player.crouch=false; player.prone=false; player.onGround=false;
player.vel.y=Math.max(player.vel.y,2.5);
showScorePop('创造悬停飞行 · WASD移动 空格升/Shift降 · 落地退出');
}else if(player.flyAero){
player.flyAero=false;
showScorePop('切换: 创造悬停 (空格升/Shift降)');
}else{
player.flying=false;
showScorePop('飞行关闭');
}
AudioSys.click(1050,0.3,0.05);
}
player._spaceTapT=tapT;
}
// 观战工具键 (2026-09-26H 观战批: 审计 B6 信息层 + B7 时停; 2026-09-27I 收敛: 慢放/单步整段删除) ——
// 只对观战者放行, 其它人按键一律无副作用。
//   J 信息层开关 (默认开) / K 时停·继续
// 键位选定依据: 通读本文件全表, KeyJ/KeyK 未被任何分支使用, 也不在浏览器/系统保留键里; 按错也只在观战态内。
// 时停的生效范围与"关闭观战/换局即回运行"由 22b-speclayer 的 specTimeActive 单源把关 (本文件只转按键)。
// 工具键对**所有观战坐姿**放行: 步行/飞行/幽灵坦克上/海战舰艇上/制导巡飞弹时都要能用 (时停看交火最常
// 在座驾里用)。2026-09-27M 起制导期间不再让位: 那原本是"TV 视角里没有语义"的保守写法, 但时停若在发射
// 前就是开的, 弹体被冻住 = 观察者被定住, 而这两下恰恰是唯一的解冻/细看手段 (审计 P1-3 的死局)。
// J/K 与巡飞弹的操控 (鼠标转向 / 左键自爆 / 右键加速) 不共键, 放行不会误触。
if(player.spectator&&player.alive){
if(e.code==='KeyJ'&&typeof specLayerToggle==='function'){ specLayerToggle(); return; }
if(e.code==='KeyK'&&typeof specTimeToggle==='function'){ specTimeToggle(); return; }
}
if(!player.alive||!pointerLocked) return;
// ── 飞机锁定/AI 接管 (7b-丙 2026-09-30, 用户裁定键位): E=锁定切换, Space=AI 接管切换 (中键见 mousedown) ──
// 仅飞行员座位生效: 步行态 E 仍是侧身、Space 仍是跳 (onVehicle.kind==='plane' 门卫, 其它场合零副作用);
// 函数单源在 16-aircraft (planeLockToggle/planeTakeoverToggle)。
if(player.alive&&player.onVehicle&&player.onVehicle.kind==='plane'){
if(e.code==='KeyE'&&typeof planeLockToggle==='function') planeLockToggle();
else if(e.code==='Space'&&typeof planeTakeoverToggle==='function') planeTakeoverToggle();
}
// 第三人称切换 (2026-09-20 第三人称批): U = 步行第三人称开关。
// 键位选定依据: 通读本文件全表 —— 已占用 Tab/Esc/P/M/Space/Shift/Q/E/W/A/S/D/C/Z/X/R/V/G/1-6/F/B/H/Y/T,
// KeyU 未被任何分支使用; 且它不在浏览器/系统的常用保留键里 (不与 Ctrl+U 冲突: 本表只看 e.code 的裸键)。
// 切换体在模块级 toggleThirdPerson (文件顶部) —— 触控键 #tView 与这里共用同一份, 不再各写一套。
// ★2026-09-26E (审计 17): 艇上 U 直接改 player.thirdPerson 会与 C 三态抢同一个字段 (C 循环会跳档) ——
// 海战座位下 U 走同一支三态循环 (与 C 等价), 不再裸翻 thirdPerson。
if(e.code==='KeyU'){ if(player.onNaval) navalCycleView(); else toggleThirdPerson(); }
// 车辆大灯 (2026-10-05 昼夜设计 N2 4.1): L = 切换所乘载具大灯 (坦克/两栖车/小艇; 劫道卡车是 AI 目标不开放)。
// 键位选定: 通读本文件全表, KeyL 未被任何分支占用 (候选 V/H 都已被近战/包扎占用)。白天档无此装备。
if(e.code==='KeyL'&&NIGHT_MODE&&(player.onVehicle||player.onNaval)&&typeof vehHeadlightToggle==='function'){
const on=vehHeadlightToggle(player.onVehicle||player.onNaval);
showScorePop(on?'大灯开启 · 看得清路, 也看得见你':'大灯关闭');
}
// ── 海战舰船驾驶位 (2026-09-20N 海战批, 座位 = player.onNaval) ──
// 既有各步兵动作分支是靠 `!player.onVehicle` 逐个挡的; 海战座位挂在 onNaval 上, 逐处补条件容易漏
// (V 近战/G 手雷/B 工事·医疗箱/3-6 投掷/Z 趴/X 架枪/H 包扎 都会在艇上生效 —— 那些在驾驶位上是错的)。
// 这里一处挡完, 只放行三条: U/C 视角 / R 换弹 / F 交互
// (上艇·下艇·鱼雷都走 20-player tryInteract 的座位分支; 鼠标左右键由 20a-seats 每帧读 mouseDown/mouse2Down)。
// ★2026-09-26E (审计 5): 旧版还放行 1/2 换枪 —— 那是**真缺陷**而非便利: switchSlot 会把 player.curW 从
// 20a 刻意置的 null 换成步枪, 于是 (i) 24-main 的视角武器门复活视模型, 把海战 fov (追尾 68/艏向 74/
// **炮手镜 30**) 拉回 74 并关掉 #scopeOv; (ii) 22-hud 的弹药面板从"舰名/主炮/鱼雷×N"变成"汤普森/手雷×2"。
// 艇上的武器就是鼠标左右键 + F(鱼雷), 1/2 在驾驶位没有任何语义 ⇒ 撤出放行表 (switchSlot 里另加一道门兜底)。
if(player.onNaval){
if(e.code==='KeyF') tryInteract();
else if(e.code==='KeyR') tryReload();
else if(e.code==='KeyC') navalCycleView();   // C 三态: 追尾 → 炮手镜 → 艏向第一人称 (2026-09-21 用户裁定"要")
return;
}
// ── 岸防炮座位 (2026-09-21 A#9, 座位 = player.onBattery) ──
// 2026-09-25 修: 这个座位当初漏进了"逐处挡"的清单 (它晚于 onNaval 的门卫写法出现, 不是那批文件里加的),
// 于是炮位上 G 会挂起手雷状态机 (VM.state='nade' —— 20a 炮位分支/24-main 在炮位时不跑 updateViewModel,
// 下炮那一帧状态机复活 ⇒ 立刻扔出一颗活雷)、Z/C 改站姿眼高、H 起绷带、B 架迫击炮、3/4/6 起投掷。
// 与 onNaval 同规: 一处挡完, 只放行 F (下炮; 上炮也是它) —— 炮位上其余动作一律由 20a updatePlayerBattery
// 用鼠标驱动 (转向/俯仰/左键开炮), 不需要任何键盘动作。触控键走 kd()/ku() 合成同一批 code, 一并覆盖。
if(player.onBattery){
if(e.code==='KeyF') tryInteract();
return;
}
// ── 大舰炮位座位 (2026-10-04 海战审计 U4/U5/U7, 座位 = player.capitalGun) ──
// 与 onNaval/onBattery 同规一处挡完 —— 旧版漏了这个座位: G/3/4/6 会在炮位上挂起手雷状态机
// (下炮那一帧状态机复活 = 立刻扔出一颗活雷, 与 onBattery 顶注描述的同族病), V 近战/H 包扎/
// B 建造/Z 趴/X 架枪也都会在座上生效。只放行两条:
//   F = 下炮 (tryInteract 的炮位分支) / C = 换炮位 (capGunCycle, 2026-10-04 U3: 主→副→防空顺次循环)
if(player.capitalGun){
if(e.code==='KeyF') tryInteract();
else if(e.code==='KeyC'&&typeof capGunCycle==='function') capGunCycle();
return;
}
// 游泳/潜水 (2026-09-18 塔拉瓦批, 用户定案): 武器背起 —— 除换枪/换弹外全部动作封禁
// (开火闸门在 playerFireTick; 涉水仍可正常战斗)
// ★2026-09-20N 修正 (verifier 真浏览器红线 8 实报): 原封禁清单漏了 KeyF —— 而海上载具全停在礁盘外/
//   集结点, "水上必须游泳贴近"就是玩家唯一的登艇路径, 于是 F 被这里吞掉 ⇒ 整条玩家链在真输入链上不可达
//   (直调 tryInteract 却正常, 所以沙箱自检没暴露)。放行 F 走**同一个** tryInteract 单源入口:
//   半径闸门 (陆上 4.5m / 水上 2.5m) 与状态判定都在它内部, 不会误触发; 其余键仍按游泳态封禁。
if(player.swim){
if(e.code==='Digit1') switchSlot(0);
if(e.code==='Digit2') switchSlot(1);
if(e.code==='KeyR') tryReload();
if(e.code==='KeyF') tryInteract();   // 水上上艇/上下船/使用阵位 (用户裁定①: 必须游泳贴近才够得着)
return;
}
if(e.code==='KeyR') tryReload();
if(e.code==='KeyC'){ if(player.onVehicle&&(player.onVehicle.kind==='tank'||player.onVehicle.kind==='ghost')){ player.tankView=!player.tankView; } else { player.crouch=!player.crouch; player.prone=false; } }
if(e.code==='KeyZ'&&!player.onMG&&!player.onVehicle&&!player.onAT&&!player.onAA&&!player.onMortar){ player.prone=!player.prone; if(player.prone){ player.crouch=false; player.braced=false; } }
if(e.code==='KeyX'&&!player.prone){
if(player.braced){ player.braced=false; AudioSys.metalSlide(0.18,0.08,500,900); }
else if(player.canBrace){
player.braced=true; player.braceYaw=player.yaw;
AudioSys.metalSlide(0.3,0.13,320,170); AudioSys.click(700,0.3,0.05);
}
}
if(e.code==='Digit1') switchSlot(0);
if(e.code==='Digit2') switchSlot(1);
if(e.code==='KeyV'){ if(VM.state==='idle'&&!player.onMG&&!player.onVehicle&&!player.onAT&&!player.onAA&&!player.onMortar&&player.meleeCd<=0){ VM.state='melee'; VM.stateT=0; VM.stateDur=0.5; player.meleeCd=0.7; vmSndFlags={}; AudioSys.metalSlide(0.15,0.06,1200,2000); } }
if(e.code==='KeyG'){
if(player.nadeCount>0&&VM.state==='idle'&&!player.onMG&&!player.onVehicle&&!player.onAT&&!player.onAA&&!player.onMortar&&!player.loiter){
VM.state='nade'; VM.stateT=0; VM.stateDur=999;
player.nadeHeld=true; player.nadeFuse=3.8; player.nadeIsAT=false; player.nadeIsSmoke=false; player.nadeIsIncin=false;
vmSndFlags={};
AudioSys.click(1600,0.25,0.04);
}
}
if(e.code==='Digit3'){
if(player.atNades>0&&VM.state==='idle'&&!player.onMG&&!player.onVehicle&&!player.onAT&&!player.onAA&&!player.onMortar&&!player.loiter){
// 持掷化 (2026-09-30 批, 与 KeyG 同口径): 按住=举雷瞄准 (弹道预演亮出), 松手=出手。nadeFuse=99 哨兵
// —— 20-player 的"持握倒计时→手中自爆"只该管普通雷 (3.8s 引信), AT/烟雾/燃烧是出手才开始计时的短引信。
VM.state='nade'; VM.stateT=0; VM.stateDur=999;
player.nadeHeld=true; player.nadeFuse=99; player.nadeIsAT=true; player.nadeIsSmoke=false; player.nadeIsIncin=false;
vmSndFlags={};
AudioSys.click(1200,0.3,0.05);
}
}
if(e.code==='Digit4'){
if(player.cls===3&&VM.state==='idle'&&!player.loiter){ switchSlot(player.slots.findIndex(s=>s&&s.def.rocket)); } // 2026-09-28 兵种8→5: 反坦克=3
else if(player.smokeCount>0&&VM.state==='idle'&&!player.onMG&&!player.onVehicle&&!player.onAT&&!player.onAA&&!player.onMortar&&!player.loiter){
VM.state='nade'; VM.stateT=0; VM.stateDur=999;
player.nadeHeld=true; player.nadeFuse=99; player.nadeIsAT=false; player.nadeIsSmoke=true; player.nadeIsIncin=false;
vmSndFlags={};
AudioSys.click(1000,0.28,0.05);
}
}
if(e.code==='Digit6'){
// 燃烧弹 (有燃烧弹时优先); 工程兵(cls4)不带燃烧弹 ⇒ 同键承担迫击炮架设/回收 (2026-09-28 兵种合并, 原迫击炮兵 B 键迁此)
if(player.incinCount>0&&VM.state==='idle'&&!player.onMG&&!player.onVehicle&&!player.onAT&&!player.onAA&&!player.onMortar&&!player.loiter){
VM.state='nade'; VM.stateT=0; VM.stateDur=999;
player.nadeHeld=true; player.nadeFuse=99; player.nadeIsAT=false; player.nadeIsSmoke=false; player.nadeIsIncin=true;
vmSndFlags={};
AudioSys.click(880,0.3,0.05);
} else if(player.cls===4&&!player.onVehicle&&!player.onMG&&!player.onAT&&!player.onAA&&!player.onMortar&&!player.loiter){
if(!player.mortarPlaced){
const fd=camForward();fd.y=0;if(fd.lengthSq()<0.1)return;fd.normalize();
deployMortar(player,player.pos.x+fd.x*1.6,player.pos.z+fd.z*1.6,Math.atan2(fd.x,fd.z));
// 读条回收 (2026-09-28 阶段三 P1): 6 靠近自己的炮=1.2s 读条 / 读条中再按=取消 (原为瞬发)
} else if(player.demolish&&player.demolish.mortar){ stopDemolish(player); }
else startMortarRecover(player);
}
}
if(e.code==='KeyH'){
// 观战模式: H = 气动飞行开关 (复用巡飞弹飞行动作: 沿视线前飞不可悬停, 右键加速, 俯冲触地落地)
if(player.spectator&&player.alive&&!player.onVehicle&&!player.loiter){
if(!player.flying||!player.flyAero){
player.flying=true; player.flyAero=true;
player.crouch=false; player.prone=false; player.onGround=false;
player._aeroSpd=Math.max(player._aeroSpd||0,13);
player.vel.y=Math.max(player.vel.y,2.5);
showScorePop('气动飞行 · 沿视线前飞 · 右键加速 · 俯冲触地落地');
}else{
player.flying=false; player.flyAero=false;
showScorePop('飞行关闭');
}
AudioSys.click(1050,0.3,0.05);
return;
}
if(VM.state==='idle'&&player.bandages>0&&player.hp<100&&player.bandaging<=0&&!player.onVehicle&&!player.onMG&&!player.onAT&&!player.onAA&&!player.loiter){
player.bandaging=2.6;
VM.state='bandage'; VM.stateT=0; VM.stateDur=2.6;
vmSndFlags={};
showScorePop('包扎中…');
AudioSys.metalSlide(0.14,0.25,400,700);
}
}
// 兵种 8→5 (2026-09-28 阶段三 P1): 工程兵(cls4) 一个兵种三件事 ——
//   B=锤击建造 / 5=选工事型号 / **6=架设/回收迫击炮** (见上面 Digit6 处理器, 原迫击炮兵 cls6 的 B 键职责迁到 6);
//   原医护兵 cls4 的"按B放医疗箱"取消 —— 医疗箱改为工程兵建造菜单第 5 件 (06-engineering BUILD_MENU)。
//   读条回收 (同批用户提议): B 靠近自己工事=拆除读条 (退全款) / 读条中再按=取消 / 离开工事=正常建造。
if(e.code==='KeyB'){
if(player.cls===4&&!player.onVehicle&&!player.onMG&&!player.onAT&&!player.onAA&&!player.onMortar){
if(player.demolish){ stopDemolish(player); }
else { const nb=nearOwnBuild(player); if(nb) startDemolish(player,nb); else engBuild(player); }
}
}
if(e.code==='Digit5'&&player.cls===4){
player.buildSel=((player.buildSel||0)+1)%BUILD_MENU.length;
const bt=BUILD_MENU[player.buildSel];
const bn=bt==='mg'?mgDefOfTeam(player.team).name:BUILD_NAMES[bt];
showScorePop(t2('建造选择: {0} (消耗{1}点 · 按B放置)',t2(bn),BUILD_COST[bt]));
}
if(e.code==='KeyF'){
// 巡飞弹制导中: F 切换 第一/第三 视角; 平时为互动
if(player.loiter){ player.loiterView=player.loiterView?0:1; AudioSys.click(1400,0.25,0.05); }
else tryInteract();
}
// T: 观战 + 正在操控巡飞弹 ⇒ **弃弹传送** (弹体立刻消失, 自身瞬移到弹体位置, 2026-09-17 观战扩展批);
// 其余情况一律保持原语义 = 小队进攻标记。
// ★2026-09-26H 观战批 (审计 #15/C2): 观战者**不再指挥小队** —— 旧版 T/Y 对观战者照常生效, 他能直接改
//   本方 Bot 小队的进攻点/跟随目标 (直接操纵 AI 行为), 与"观战者不参与战局判定"的口径打架 (用户圈定修复)。
//   现在观战态: T 只保留"弃弹传送"一义 (控弹中), 非控弹的进攻标记与 Y 跟随一律改为提示; 非观战一拳不动。
if(e.code==='KeyT'){
if(player.spectator){
if(player.loiter) specTeleportToLoiter();
else if(typeof showScorePop==='function') showScorePop(t2('观战模式 · 不指挥小队'));
}else squadOrderMove();
}
if(e.code==='KeyY'){
if(player.spectator){ if(typeof showScorePop==='function') showScorePop(t2('观战模式 · 不指挥小队')); }
else squadOrderFollow();
}
});
addEventListener('keyup',e=>{
keys[e.code]=false;
if(e.code==='Tab') document.getElementById('scoreboard').style.display='none';
if(e.code==='KeyG'&&player.nadeHeld){
player.nadeHeld=false;
VM.stateT=0; VM.stateDur=0.55;
}
// 3/4/6 持掷松手 (2026-09-30 批): 与 KeyG 同一收口 —— 按住期间 nadeHeld=true (弹道预演亮出), 松手进投掷动画
if((e.code==='Digit3'||e.code==='Digit4'||e.code==='Digit6')&&player.nadeHeld){
player.nadeHeld=false;
VM.stateT=0; VM.stateDur=0.55;
}
});
let mouseDown=false, mouse2Down=false;
addEventListener('mousedown',e=>{
if(!pointerLocked){
// 战斗进行中指针锁定丢失(浏览器可能拒绝立即重锁): 点击画布补锁
if(player.deployed&&player.alive&&!matchOver&&!gamePaused&&document.querySelectorAll('.screen:not(.hidden)').length===0) lockPointer();
return;
}
if(e.button===0) mouseDown=true;
if(e.button===1){ // 鼠标中键 (7b-丙): 飞机锁定切换, 与 E 同一单源 planeLockToggle; preventDefault 压掉浏览器中键自动滚屏
e.preventDefault();
if(player.alive&&player.onVehicle&&player.onVehicle.kind==='plane'&&typeof planeLockToggle==='function') planeLockToggle();
}
if(e.button===2){
mouse2Down=true;
// 巡飞弹制导中右键是"加速"而非机瞄; 气动飞行中右键是加速
if(player.alive&&!player.loiter&&!player.flying&&!player.onMG&&!player.onVehicle&&!player.onNaval&&!player.onAT&&!player.onAA&&!player.onMortar&&!player.onBattery&&!player.capitalGun) player.ads=true;   // 2026-09-26E 审计 6: 艇上右键是 .50 扳机, 不该进 ADS; 2026-09-28C 补岸防炮位 (右键无语义, 同门); 2026-10-04 补大舰炮位 (右键=副炮/防空扳机)
}
});
addEventListener('mouseup',e=>{
if(e.button===0) mouseDown=false;
if(e.button===2){ mouse2Down=false; player.ads=false; }
});
addEventListener('contextmenu',e=>e.preventDefault());
// 视角灵敏度变焦乘数 (2026-09-28C 触控/手柄批): 开镜按**当前武器** adsFov 收窄 + 海战炮手镜 0.40 ——
// 单源函数: 键鼠 (本文件 mousemove) / 触屏 (24-main touchmove) / 手柄 (19b-gamepad) 三条视角入口共用。
// 旧触控写死 0.5: 狙击镜(adsFov≈20)下手感快 2.5 倍, 艇上炮手镜(fov30)完全没收窄 —— 键鼠/触屏两种输入
// 在同一个人身上应有一致的手感, 故提到单源而不是各抄一份。
function lookZoomMul(){
const d=WPN_DEFS[VM.key]||{};
const zoomFac=player.ads?(d.adsFov||60)/74:1;
const navZoom=(player.onNaval&&player.navalGun)?0.40:1;   // 海战炮手镜: fov 30 vs 步行 74 ⇒ 同倍率收窄
return zoomFac*navZoom;
}
addEventListener('mousemove',e=>{
if(!pointerLocked||!player.alive) return;
const s=0.0022*SETTINGS.sens*lookZoomMul();
// ★2026-09-28 TV 制导 (= 正在操控巡飞弹) 期间: 鼠标增量**只记账** (player.tvDX/tvDY), 不写本体 yaw/pitch ——
//   弹体姿态改由 13-combat.updateLoiters **直接**消费这两个增量 (制导的单源)。
//   旧写法把鼠标写进**看不见的**本体角度, 弹体再以 1.9rad/s 去追它: 甩枪时画面滞后 0.3~1.6s,
//   多甩出来的角度还全被"存"在本体角里 ⇒ 松手后弹体自己继续拐 (用户实报"十分生硬还随机失控")。
if(player.loiter){
player.tvDX+=e.movementX; player.tvDY+=e.movementY;
}else{
player.yaw-=e.movementX*s;
player.pitch-=e.movementY*s;
player.pitch=clamp(player.pitch,-1.45,1.45);
}
player.mouseDX=e.movementX; player.mouseDY=e.movementY;
});
// ESC 暂停切换: 暂停时退出指针锁定并盖暂停面板, 恢复时重新锁定
// 模态归位 (2026-09-16 本批): 暂停面板与部署界面同层同源, 谁最后打开谁生效 —— 旧版从部署界面按 Esc 会在部署面板上
// 再叠一层暂停面板, 关闭后仍留着部署面板 (用户读作"Esc 没反应")。这里先把部署界面收掉, 再开暂停面板。
function togglePause(){
gamePaused=!gamePaused;
if(gamePaused) document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden'));
// 暂停面板会把部署界面一并收起 (模态归位, 见上) ⇒ 就地摘掉 inDeploy: "暂停时查看部署界面"按 ESC 回到战局后,
// 战斗 HUD 必须立刻放回 (2026-09-20 第6条: 藏过头 = 该显示时不显示)。放在下面的 pauseOv 早退之前, 保证一定执行。
if(typeof syncDeployHud==='function') syncDeployHud();
// 暂停静音: 环境(风/雨)+坦克/飞机引擎 (旧版 setAmbientMute 未导出, 静音从未生效)
if(AudioSys.setAmbientMute) AudioSys.setAmbientMute(gamePaused);
const ov=document.getElementById('pauseOv');
if(!ov) return;
if(gamePaused){
ov.classList.remove('hidden');
document.exitPointerLock&&document.exitPointerLock();
}else{
ov.classList.add('hidden');
lockPointer();
}
}
document.getElementById('pauseResumeBtn').addEventListener('click',()=>{ togglePause(); });
// 暂停面板「返回主界面」(2026-09-16 本批): 先把暂停态收回 (returnToMenu 认的是"人在菜单"而非"暂停面板开着"),
// 再走统一的返回流程 —— 二次确认在 returnToMenu 内部按战况分档
document.getElementById('pauseMenuBtn').addEventListener('click',()=>{
if(gamePaused){
gamePaused=false;
if(AudioSys.setAmbientMute) AudioSys.setAmbientMute(false);
const ov=document.getElementById('pauseOv'); if(ov) ov.classList.add('hidden');
}
returnToMenu();
});
document.addEventListener('pointerlockchange',()=>{
if(MOBILE) return;
pointerLocked=document.pointerLockElement===renderer.domElement;
// menuHold: 返回主界面会主动 exitPointerLock, 但此刻人在菜单, 不该被解读成"战斗中丢锁 → 弹部署界面" (2026-09-16 本批)
if(!pointerLocked&&player.alive&&player.deployed&&!matchOver&&!gamePaused&&!menuHold){
showDeploy(false);
}
});
function lockPointer(){
if(MOBILE){ pointerLocked=true; return; }
try{ const r=renderer.domElement.requestPointerLock(); if(r&&r.catch) r.catch(()=>{}); }catch(e){}
}
function tryReload(){
if(player.spectator) return; // 观战: 弹药每0.5s自动回满, 永不换弹 —— 拦截手动R/空仓点击/打空自动换弹/巡飞弹引爆后的自动换弹 (2026-09-11 修复不定时换弹)
const w=player.curW;
if(!w||player.onMG||player.onVehicle||player.onAT||player.onAA) return;
if(VM.state!=='idle') return;
if(w.mag>=w.def.mag||w.reserve<=0) return;
VM.state='reload'; VM.stateT=0;
VM.stateDur=w.def.reload*(player.streakBuff?player.streakBuff.reloadMul:1); // 连杀增益: 换弹加速 (2026-09-11)
vmSndFlags={};
}
function switchSlot(i){
if(i===player.curSlot||!player.slots[i]||player.onMG||player.onVehicle||player.onNaval||player.onAT||player.onAA||player.loiter||player.capitalGun) return;   // 2026-09-26E 审计 5: 艇上换枪会打断座驾读数链路 (fov/炮手镜/弹药面板); 2026-10-04: 大舰炮位同门 (U2)
if(VM.state!=='idle'&&VM.state!=='fire') return;
player.curSlot=i;
player.curW=player.slots[i];
vmEquip(player.curW.key,player.team);
}
