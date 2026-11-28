// ─────────────────────────────────────────────
// 19-input.js —— 键鼠输入/换弹/切枪
// 源: Index.original.html 第 6937-7076 行
// ─────────────────────────────────────────────
'use strict';
const keys={};
let pointerLocked=false;
// ★2026-11-28 批③: F2 截图请求标志 (顶层 let 全局, 24-main 主循环消费后复位) —— 键盘侧只置位不干活,
// 合成/下载都在 24-main 渲染对之后做 (必须紧跟 render 调用, 同一 JS 任务内读回 WebGL 画布, 见 24-main)。
let screenshotReq=false;
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
// ★2026-11-01 调试观战附身中**放行**: 追尾机位读的是被 specViewTick 钉到宿主的 p.pos/p.yaw ⇒
// 第三人称=宿主追尾相机 (能看见宿主的走/跑/开火动画); 本体模型由 updatePlayerAvatar 的附身门抑制,
// 不会再出现"两个人挤在一起"。视角武器模型也在第三人称分支被既有 thirdPersonOn 门跳过。
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
// ★2026-11-22 投掷手感批: 出手弧接续单源 —— 自己的出手弧 (松手后 0.55s 收尾段) 不再吃键。旧链两层卡手
// (用户实报"连点 G/3/4/6 卡手, 像有前摇"; ★2026-11-28 键位轮换后四键 = G/4/5/6):
//   ① 20261121 审计 P1-4 把出手弧 (VM'nade' 且 !nadeHeld) 收进 readBarActive 后, 弧中按投掷键先撞上
//      barStealArmed 双击确认 —— 第一次只记账不放行 = **白吃一键**;
//   ② 举雷起步门 VM.state==='idle' 在弧内恒 false ⇒ 0.55s 死区内怎么按都没反应。
// 新口径: 弧中按 G/3/4/6 = 直接接下一轮 —— 未出手段 (k<0.5, releaseNade 还没跑) 先把捏着的雷**立即出手**
// (引信在弧内已停烧 —— 20-player 只在 nadeHeld 时减 fuse —— 原样出账; 出手点/方向仍走 playerThrowOrigin/
// playerThrowDir 单源, 与动画相位无关), 已出手段弧纯收尾直接重举。**一次点击 = 一颗雷, 零死区**。
// 只接管 VM/雷账, **不碰读条账** (不调 stealBar/barStealArmed —— 别的行动键打断弧仍走各自双击确认;
// demolish 等真读条也不被顺手吃掉)。返回 true=已接管 (调用方接着铺弹种账; flush 可能清零计数 → 空手不自举,
// nadeHeld 保持 false, 下帧 10-viewmodel 哨兵自愈回 idle, 与"上载具外摘 nadeHeld"同一条自愈路)。
function nadeArcTakeover(){
if(player.nadeHeld||(typeof VM==='undefined')||!VM||VM.state!=='nade') return false;
if(VM.stateDur>0&&VM.stateDur<=10&&(VM.stateT/VM.stateDur)<0.5) player.releaseNade();   // 未出手段: 立即出手 (零吞键)
VM.state='nade'; VM.stateT=0; VM.stateDur=999; vmSndFlags={};
return true;
}
let lastEscT=0;
addEventListener('keydown',e=>{
if(e.code==='Tab'){ e.preventDefault(); if(e.repeat) return;   // 2026-11-13 perf batch: OS key-repeat must not re-run the scoreboard chain
 document.getElementById('scoreboard').style.display='block'; updateScoreboard(); }
if(e.code==='Escape'){
  const now=performance.now();
  if(now-lastEscT<350) return; // 350ms 防抖，杜绝连按两下，以及防止丢锁回调呼出部署后同一次按键补发 keydown
  lastEscT=now;
  // 指挥地图/布势开着: Esc 归地图 (2026-10-26 指挥官批, 设计 §4/D8/D21) —— 战斗图=关图 (连按两次才到暂停),
  // 布势=确认开战 (跳过布势, 直接走确认单源: 它内部会先收图再叫回部署页)。
  // ★2026-10-27 排查批 修复 (分支位置虫): 本分支旧写嵌在下面 `player.deployed&&player.alive` 门**之内**,
  //   而布势期人未落地 —— player.alive/deployed 都是 false (26-commander 布势链多处注释同款口径),
  //   于是布势期 Esc 永远走不到这里, 落进下方 else 分支变成 togglePause(true): 注释宣称"布势期 Esc=确认",
  //   实际弹暂停菜单、布势地图被 cmdMapPauseGate 藏起, 玩家看到的是"按 Esc 没反应/界面全换了"。
  //   上提到门外; 暂停优先 (D20): gamePaused 时先解暂停不确认布势 (地图由 cmdMapPauseGate 藏着, 解冻即回)。
  if(typeof cmdMapUIOpen==='function'&&cmdMapUIOpen()&&!gamePaused){
if(typeof cmdDeployPhase==='function'&&cmdDeployPhase()&&typeof cmdDeployConfirm==='function') cmdDeployConfirm(true);   // ★2026-11-17 批6: esc=true ⇒ 盖章只看 CMD.deployTouched (没布过势的 ESC 不锁兵种)
else if(typeof cmdMapClose==='function') cmdMapClose(true);
return;
  }
  if(player.deployed&&player.alive&&!matchOver){
    const depEl=document.getElementById('deploy');
    const inDeploy=depEl&&!depEl.classList.contains('hidden');
    if(gamePaused){
      togglePause(false);
    }else if(inDeploy){
      depEl.classList.add('hidden');
      togglePause(true);
    }else{
      if(typeof bigmapOn!=='undefined'&&bigmapOn) toggleBigMap();
      showDeploy(false);
    }
    return;
  }else if(!matchOver){
    if(gamePaused){
      togglePause(false);
    }else{
      togglePause(true);
    }
    return;
  }
}
if(e.repeat) return;
if(gamePaused) return;
// F1 显示/隐藏战斗 HUD (2026-10-07c 用户需求): body.hudHide 整体压掉 #ui+触控层 (css/style.css 与
// inMenu/inDeploy 同构) —— 纯净画面截图/观景用。只在已部署时响应 (菜单/部署页按了只会把"隐藏"带进
// 下一局); 开关态不进存档, 刷新即回显。
if(e.code==='F1'&&player.deployed){
 e.preventDefault();   // 抑制浏览器帮助页
 const off=document.body.classList.toggle('hudHide');
 // 提示条挂 body 而不是 #ui —— HUD 刚被整体藏起时 showScorePop 会跟着消失, 得用不受 hudHide 影响的元素
 let tip=document.getElementById('hudHideTip');
 if(!tip){
  tip=document.createElement('div'); tip.id='hudHideTip';
  tip.style.cssText='position:absolute;top:14px;left:50%;transform:translateX(-50%);font:13px/1.4 sans-serif;color:#e8e4cf;text-shadow:0 1px 2px #000;background:rgba(0,0,0,.45);padding:5px 14px;border-radius:6px;pointer-events:none;z-index:400;opacity:0;transition:opacity .25s;';
  document.body.appendChild(tip);
 }
 tip.textContent=off?t('HUD 已隐藏 · 按 F1 恢复'):t('HUD 已恢复');
 tip.style.opacity=1;
 clearTimeout(tip._t); tip._t=setTimeout(()=>{ tip.style.opacity=0; },1600);
 if(typeof AudioSys!=='undefined'&&AudioSys.click) AudioSys.click(off?520:880,0.18,0.05);
 return;
}
// ★2026-11-28 批③: F2 截图 (紧邻 F1, 门与 F1 逐字同构: 已部署才响应 + preventDefault 抑制浏览器默认
// 行为)。这里只置 screenshotReq 标志 (文件顶层声明, 24-main 可读); 真正的合成 (3D 画面+小地图) 与
// 下载在 24-main 主循环渲染对之后消费 —— 截图必须"紧跟 render 调用、同一 JS 任务内读回"画布才有像素。
if(e.code==='F2'&&player.deployed){
 e.preventDefault();   // 抑制浏览器默认行为
 screenshotReq=true;   // 记账即走, 消费点在 24-main (渲染完当帧后合成+下载+复位)
 return;
}
keys[e.code]=true;
// ★2026-10-26 排查轮 P1 修复 (R11 定身不完整): 指挥地图开着时**键盘也必须归地图**。
//   旧写只有 mousedown 有 cmdMapUIOpen 早退 (:395), keydown 没有 —— 于是 20-player:728 的 cmdLock
//   只把移动/侧身/跳跃清零, 换枪 (1~4)、举雷 (G)、包扎 (H)、近战 (V)、建造 (B) 全部照常生效;
//   更糟的是座位分派点 (20-player:692-712) 全排在 :728 **之前**并直接 return ⇒ 开图后按 F 上车,
//   整段定身被跳过 = 开着指挥地图开车开炮。开图语义是低头看图, 除减速键外不该有战斗输入。
//   ★2026-10-26 交互重做批: 放行集合从"只有减速键"扩到"减速键 + 三命令键 (E/F/R)"。
//     三命令键的判定**不在本文件** —— 26-commander 的 cmdMapKeyGate 是唯一判据 (它同时负责执行命令并
//     返回"我消费了"), 这里只转发。这样键表 (CMD_KEYS) 只有一份, 关图后 E/F/R 的默认语义逐位不变。
if(typeof cmdMapUIOpen==='function'&&cmdMapUIOpen()){
if(typeof cmdMapKeyGate==='function'&&cmdMapKeyGate(e.code)) return;   // 三命令键 (布势期与战斗期同规: 执行并消费)
if(!(typeof CMD_TIME!=='undefined'&&e.code===CMD_TIME.KEY)) return;
}
// 实验模式: P 切换 AI 调试层 (bot 状态标签+寻路线), 仅供调参
if(e.code==='KeyP'&&EXPERIMENT&&typeof BotDebug!=='undefined') BotDebug.toggle();
// 战场大地图: M 呼出 (纯开关大地图, 解除与重部署按键冲突)
if(e.code==='KeyM'&&player.deployed&&player.alive&&!player.specViewHost&&!matchOver){   // ★2026-11-21 批B#3: 调试附身中吞 M (落到下方附身吞键块"Q/E 之外一律吞掉"; !specViewHost 对普通玩家恒真)
if(typeof toggleBigMap==='function') toggleBigMap();
}
// 观战模式: 双击空格 = MC创造式悬停飞行开关 (无重力可悬停; 若在气动飞行中则切为悬停)
if(e.code==='Space'&&player.spectator&&player.alive&&!player.onVehicle&&!player.onNaval&&!player.loiter&&!player.specViewHost){   // 2026-09-26E 审计 18: 艇上不留 flying 残留; ★2026-11-21 批B#3: 调试附身中吞双击空格 (防附身中置 flying 账, E 脱离后人在观察位悬空)
const tapT=performance.now();
if(tapT-(player._spaceTapT||0)<300){
if(!player.flying){
player.flying=true; player.flyAero=false; player._flyT=0;   // ★2026-11-21 批B#1: 起飞清宽限账 (旧值>0.3 残留时, 首帧仍贴地会被 20-player 落地门同帧弹回"落地·行走状态")
player.crouch=false; player.prone=false; player.onGround=false;
player.vel.y=Math.max(player.vel.y,2.5);
showScorePop('创造悬停飞行 · WASD移动 空格升/Shift降 · 落地退出');
}else if(player.flyAero){
player.flyAero=false; player._flyT=0;   // ★2026-11-21 批B#1: 切悬停重计宽限账 (气动掠地平飞中切换, 旧值>0.3 会被落地门同帧弹回)
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
// J/K 与巡飞弹的操控 (鼠标转向 / 左键自爆 / 空格加速 / 右键开镜) 不共键, 放行不会误触。
if(player.spectator&&player.alive){
if(e.code==='KeyJ'&&typeof specLayerToggle==='function'){ specLayerToggle(); return; }
if(e.code==='KeyK'&&typeof specTimeToggle==='function'){ specTimeToggle(); return; }
}
// ★2026-11-01 自由观战视模式: Q/E 轮换附身目标 (MC 旁观者口径, 函数单源 20-player specViewCycle)。
// 排在 alive 门之前 —— 视模式 alive=false, 走不到下面任何键; 调试观战 (alive=true) 不吃这两个键。
if(player.specView&&!player.alive&&pointerLocked){
if(e.code==='KeyQ'&&typeof specViewCycle==='function'){ specViewCycle(-1); return; }
if(e.code==='KeyE'&&typeof specViewCycle==='function'){ specViewCycle(1); return; }
}
// ★2026-11-01 调试模式附身 (用户裁定): Q=附身准星 Bot / E=脱离还原 —— 原本这两键对观战者无意义
// (侧身/开镜), 接管零损失。与视模式同一条 specViewHost 管线 (20-player dbgSpecPossess/Detach)。
// ★2026-11-13 批: 座位/巡飞弹态的附身拒绝收拢在 20-player dbgSpecPossess 头部单点门
// (onVehicle/onNaval/loiter → showScorePop 拒绝)。本块**不放**三态门 —— 2026-11-06 flyaim 批裁定
// 巡飞中 J/K 观战工具键照常, timestopfix T8 契约: 本小段内部不许出现 loiter 让位门。
if(player.spectator&&player.alive&&!player.specView&&pointerLocked){
if(e.code==='KeyQ'&&typeof dbgSpecPossess==='function'){
const b=(typeof specViewPickHost==='function')?specViewPickHost():null;
if(b) dbgSpecPossess(b);
else if(typeof showScorePop==='function') showScorePop('场上没有可附身的 Bot');
return;
}
if(e.code==='KeyE'&&player.specViewHost&&typeof dbgSpecDetach==='function'){ dbgSpecDetach(); return; }
if(player.specViewHost&&e.code!=='KeyU'){
// 真附身=只读借眼 (2026-11-01 用户裁定"全方位像附身"): Q/E 之外的战斗/交互键一律吞掉 —— 数字键切枪/
// R 换弹会改到镜像进 HUD 的宿主武器账 (curW/VM), F 交互会拿冻结身位去上炮/上机, 全是错账。U (第三人称
// =宿主追尾镜) 与 J/K (上方观战工具键) 照常放行; keyup 不经过这里, 松键不留死账。
return;
}
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
if(e.code==='KeyU'){ if(player.loiter){ player.loiterView=player.loiterView?0:1; AudioSys.click(1400,0.25,0.05); } else if(player.onNaval) navalCycleView(); else toggleThirdPerson(); }   // 2026-11-06 飞行瞄准批: 巡飞弹视角切换 F→U (loiter 与座位互斥, 门序仍放最前保险)
// 车辆大灯 (NIGHT_MODE 装备) 与战术手电 (KeyL):
//   载具上 (坦克/两栖车/小艇) = 切换大灯;
//   步兵模式下 = 切换战术手电筒 (照亮前方道路与目标)。
if(e.code==='KeyL'){
if(player.onVehicle||player.onNaval){
if(typeof vehHeadlightToggle==='function'&&(NIGHT_MODE||true)){
const on=vehHeadlightToggle(player.onVehicle||player.onNaval);
showScorePop(on?t2('大灯开启 · 看得清路, 也看得见你'):t2('大灯关闭'));
}
}else if(player.alive){   // ★2026-11-05 调试模式装备批: 去 !player.spectator 门 —— 调试观战活着就是作战单位, 手电照常; 票尽真观战 alive=false 天然排除
player.flashlight=!player.flashlight;
showScorePop(player.flashlight?t2('战术手电开启'):t2('战术手电关闭'));
if(typeof AudioSys!=='undefined'&&AudioSys.metalSlide) AudioSys.metalSlide(0.12,0.05,1200,800);
}
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
else if(e.code==='KeyR') tryReload(true);
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
// ★2026-11-20 火力点坐姿批: H/R 放行到下方各自处理器 —— 坐岸防炮不下车包扎/原位换弹与其余四座同权
//   (旧版这里整段吞键, okH/tryReload 放得再开 H/R 也到不了, 炮位上等于死键)。其余键照旧吞掉
//   (炮位动作全部由鼠标驱动); F=下炮 (处理后即归位, 不再落到下方 KeyF 分支重复 tryInteract)。
//   海战门 (上方) 维持现状不动。
if(e.code==='KeyF'){ tryInteract(); return; }
else if(e.code!=='KeyH'&&e.code!=='KeyR') return;
}
// (2026-11-10: 大舰炮位座位门 player.capitalGun 随大舰子系统下架摘除)
// 游泳/潜水 (2026-09-18 塔拉瓦批, 用户定案): 武器背起 —— 除换枪/换弹外全部动作封禁
// (开火闸门在 playerFireTick; 涉水仍可正常战斗)
// ★2026-09-20N 修正 (verifier 真浏览器红线 8 实报): 原封禁清单漏了 KeyF —— 而海上载具全停在礁盘外/
//   集结点, "水上必须游泳贴近"就是玩家唯一的登艇路径, 于是 F 被这里吞掉 ⇒ 整条玩家链在真输入链上不可达
//   (直调 tryInteract 却正常, 所以沙箱自检没暴露)。放行 F 走**同一个** tryInteract 单源入口:
//   半径闸门 (陆上 4.5m / 水上 2.5m) 与状态判定都在它内部, 不会误触发; 其余键仍按游泳态封禁。
if(player.swim){
if(e.code==='Digit1') switchSlot(0,true);
if(e.code==='Digit2') switchSlot(1,true);
if(e.code==='KeyR') tryReload(true);
if(e.code==='KeyF') tryInteract();   // 水上上艇/上下船/使用阵位 (用户裁定①: 必须游泳贴近才够得着)
return;
}
// ★2026-11-16 批1 坦克补给箱修理: R 在坦克座位上的新语义 —— 距补给箱 VEH_REPAIR_R 米内起修读条
//   (旧版 R 在任何座位都被 tryReload 的座位门吞成 no-op, 无冲突)。重按不重启 (tryVehRepair 内早退);
//   X 键取消 (readBarActive 已含 vehRepair, 下面的 KeyX 分支照常覆盖)。
if(e.code==='KeyR'&&player.onVehicle&&player.onVehicle.kind==='tank'&&typeof player.tryVehRepair==='function'){ player.tryVehRepair(); return; }
// ★20261128d 工程兵场外维修: R 优先于换弹 —— 贴受损友军坦克起步维修读条 (true=已起步/加速即吞键);
//   不适用 (非工程/无目标/VM 非空闲) 回落 tryReload, 换弹与各读条双击确认网零损失。
if(e.code==='KeyR'&&!player.onVehicle&&player.cls===4&&typeof player.tryEngVehRepair==='function'&&player.tryEngVehRepair()) return;
if(e.code==='KeyR') tryReload(true);
if(e.code==='KeyC'&&!player.loiter){ if(player.onVehicle&&(player.onVehicle.kind==='tank'||player.onVehicle.kind==='ghost')){ player.tankView=!player.tankView; } else if(!player.onMG&&!player.onVehicle&&!player.onAT&&!player.onAA&&!player.onMortar){ player.crouch=!player.crouch; player.prone=false; player._autoCrouch=false; player._autoProne=false; } }   // !player.loiter: 操控巡飞弹本体定身; ★11-18: 手动 C 夺回姿态控制权 (顶头自动压下帧再顶回); ★11-18c: 同时清自动趴旗; ★2026-11-21 批B#6: 座位上不给切蹲姿 (MG/AT/AA/迫击炮与飞机等 onVehicle 座位 — 上炮瞬间强制 crouch=false 的口径, 下炮不残留蹲姿; 海战/岸防炮已在上游座位门拦死)
if(e.code==='KeyZ'&&!player.loiter&&!player.onMG&&!player.onVehicle&&!player.onAT&&!player.onAA&&!player.onMortar){ player.prone=!player.prone; if(player.prone){ player.crouch=false; player.braced=false; } player._autoProne=false; player._autoCrouch=false; }   // !player.loiter: 操控定身; ★11-18c: 手动 Z 夺回姿态控制权 + 清自动蹲/趴旗
if(e.code==='KeyX'&&!player.loiter){   // !player.loiter: 操控定身 (2026-11-07) — 撑枪/收枪是身体动作; 读条取消在操控中不可能激活 (读条键全被 loiter 门挡)
// ★2026-10-12 用户提议② → 2026-10-25 扩容 → ★2026-11-21 P1-4 再收编 (建造/挥砍/出手弧): 读条 (包扎/拆除回收/前摇/举雷待发/换弹/建造锤击/挥砍/出手弧) 中 X = 取消读条
//   (举雷 = 收雷回袋不消耗; 换弹 = 中止不结算弹药)。
//   指针锁定时 DOM 上的 ✕ 按钮收不到点击事件 (事件全被 canvas 吃掉), X 是键盘侧唯一"总能按到"的取消键;
//   撑枪语义只在空闲时生效 —— 读条中本来也撑不了枪, 不会互相抢键。
if(player.readBarActive()){ player.cancelReadBar('已取消'); return; }
if(!player.prone){
if(player.braced){ player.braced=false; AudioSys.metalSlide(0.18,0.08,500,900); }
else if(player.canBrace){
player.braced=true; player.braceYaw=player.yaw;
AudioSys.metalSlide(0.3,0.13,320,170); AudioSys.click(700,0.3,0.05);
}
}
}
if(e.code==='Digit1') switchSlot(0,true);
if(e.code==='Digit2') switchSlot(1,true);
// ★2026-11-28 键位轮换批 (用户令): 投掷键组 3→4→5→N 循环一圈 —— N=选工事(原5) / 3=军刀(原N) /
//   4=AT雷(原3) / 5=烟雾(原4); 6 与 G 不动。军刀本节从 KeyN 改挂 Digit3 (2026-10-26 批曾把它从 KeyV
//   挪到 KeyN, 减速键钉在 KeyV 不受本批影响)。手柄 RS / 移动端 tMelee 等合成入口已在各自文件同批改派。
if(e.code==='Digit3'){
// ★2026-11-20 近战重做批: 3 = 切军刀槽 / 切回 (军刀成为第 3 槽常驻武器; 旧"刺刀瞬刺"整段退役 ——
//   三式起手全部改走 startMelee 单源: 左键刺 / 右键斩 / 中键劈, 见本文件 mousedown 与 20-player playerFireTick)。
//   目标槽二态: 已在军刀槽(2) ⇒ 切回上次枪槽 (_lastGunSlot, switchSlot 内记账), 否则切军刀槽。
//   门全部复用 switchSlot 既有结构 (座位门 / VM 态门 / viaKey 双击打断读条 barStealArmed('SW2')),
//   本分支不再自写任何门 —— 与 Digit1/2 同一条路径, 语义零分叉。
switchSlot(player.curSlot===2?(player._lastGunSlot||0):2,true);
}
if(e.code==='KeyG'){
// ★2026-10-25 反馈轮①: 读条中按 G = 先收当前读条再举雷; **同键重按不抢** (举普通雷中再按 G 维持烹饪,
//   引信继续烧不重置)。举着别种雷时按 G = 换举普通雷 (打断旧的, 新引信全长起烧)。
//   ok=除 VM 态外的全部门 (没雷/座位上本就不会起步, 不白丢读条)。
const sameHeld=player.nadeHeld&&!player.nadeIsAT&&!player.nadeIsSmoke&&!player.nadeIsIncin;
const ok=player.nadeCount>0&&!player.onMG&&!player.onVehicle&&!player.onAT&&!player.onAA&&!player.onMortar&&!player.loiter;
// ★2026-11-22 投掷手感批: 出手弧中按 G = 立即接下一轮 (不吃键/不走双击确认, 见 nadeArcTakeover 注);
//   flush 后计数清零 (最后一颗已被立即出手) 则不自举, 也不落进下面双击确认网 (空手无可举, 下帧自愈回 idle)。
if(ok&&nadeArcTakeover()&&player.nadeCount>0){
player.nadeHeld=true; player.nadeFuse=NADE_FUSE_T; player.nadeIsAT=false; player.nadeIsSmoke=false; player.nadeIsIncin=false;   // 新一颗引信全长 (与 idle 起步同账)
AudioSys.click(1600,0.25,0.04);
}else{
if(ok&&!sameHeld){ if(!player.barStealArmed('KeyG')) return; player.stealBar(); }   // ★2026-10-30 读条交互批: 打断双击确认
if(ok&&VM.state==='idle'){
VM.state='nade'; VM.stateT=0; VM.stateDur=999;
player.nadeHeld=true; player.nadeFuse=NADE_FUSE_T; player.nadeIsAT=false; player.nadeIsSmoke=false; player.nadeIsIncin=false;   // 引信全长单源 (00-config NADE_FUSE_T, 22-hud 读条分母同源)
vmSndFlags={};
AudioSys.click(1600,0.25,0.04);
}
}
}
if(e.code==='Digit4'){
// 同键不抢 (举 AT 中再按 4 维持); 异读条/异种雷被 4 打断 = 换举 AT (★2026-10-25 反馈轮①; ok=除 VM 态外全门)
const sameHeld=player.nadeHeld&&player.nadeIsAT;
const ok=player.atNades>0&&!player.onMG&&!player.onVehicle&&!player.onAT&&!player.onAA&&!player.onMortar&&!player.loiter;
// ★2026-11-22 投掷手感批: 弧中接续同 KeyG (见 nadeArcTakeover 注); flush 清零则空手不自举。
if(ok&&nadeArcTakeover()&&player.atNades>0){
player.nadeHeld=true; player.nadeFuse=99; player.nadeIsAT=true; player.nadeIsSmoke=false; player.nadeIsIncin=false;   // AT 哨兵引信 (与 idle 起步同账)
AudioSys.click(1200,0.3,0.05);
}else{
if(ok&&!sameHeld){ if(!player.barStealArmed('Digit4')) return; player.stealBar(); }   // ★2026-10-30 读条交互批: 打断双击确认
if(ok&&VM.state==='idle'){
// 持掷化 (2026-09-30 批, 与 KeyG 同口径): 按住=举雷瞄准 (弹道预演亮出), 松手=出手。AT 保持 nadeFuse=99
// 哨兵 —— 撞炸弹无引信可烹 (出手即武装, 撞什么炸什么, 99 不会被 releaseNade 采用); 烟雾/燃烧已改
// 真引信 (2026-11-17 批2.6: 举雷期照烧 = 可烹饪, 与普通雷同口径)。
VM.state='nade'; VM.stateT=0; VM.stateDur=999;
player.nadeHeld=true; player.nadeFuse=99; player.nadeIsAT=true; player.nadeIsSmoke=false; player.nadeIsIncin=false;
vmSndFlags={};
AudioSys.click(1200,0.3,0.05);
}
}
}
if(e.code==='Digit5'){
// 观战不切火箭筒 (观战槽位无火箭筒, findIndex=-1 会把 5 键整个吞掉): 观战者按 5 = 烟雾弹 (四弹种全给, 2026-10-24 用户指定)
// ★2026-10-25 反馈轮①: 读条中 5 = 打断读条再切火箭筒/举烟雾弹; 同键(举烟雾中再按5)不抢; ok=除 VM 态外全门。
if(player.cls===3&&!player.spectator&&!player.loiter&&!player.onMG&&!player.onVehicle&&!player.onAT&&!player.onAA&&!player.onMortar){   // ★2026-11-21 批B#4: 补座位门与兄弟分支(烟雾/燃烧/手雷)同款 —— 坐火力点双击5会把包扎/原位换弹读条白偷走; onBattery 已在 :231 座位门上游拦死 5 键, 无需重复
if(!player.barStealArmed('Digit5')) return;   // ★2026-10-30 读条交互批: 打断双击确认
player.stealBar();
if(VM.state==='idle') switchSlot(player.slots.findIndex(s=>s&&s.def.rocket),true); // 2026-09-28 兵种8→5: 反坦克=3
}else{
const sameHeld=player.nadeHeld&&player.nadeIsSmoke;
const ok=player.smokeCount>0&&!player.onMG&&!player.onVehicle&&!player.onAT&&!player.onAA&&!player.onMortar&&!player.loiter;
// ★2026-11-22 投掷手感批: 弧中接续同 KeyG (见 nadeArcTakeover 注); flush 清零则空手不自举。
if(ok&&nadeArcTakeover()&&player.smokeCount>0){
player.nadeHeld=true; player.nadeFuse=NADE_COOK_FUSE.smoke; player.nadeIsAT=false; player.nadeIsSmoke=true; player.nadeIsIncin=false;   // 烟雾真引信 (与 idle 起步同账)
AudioSys.click(1000,0.28,0.05);
}else{
if(ok&&!sameHeld){ if(!player.barStealArmed('Digit5')) return; player.stealBar(); }   // ★2026-10-30 读条交互批: 打断双击确认
if(ok&&VM.state==='idle'){
VM.state='nade'; VM.stateT=0; VM.stateDur=999;
player.nadeHeld=true; player.nadeFuse=NADE_COOK_FUSE.smoke; player.nadeIsAT=false; player.nadeIsSmoke=true; player.nadeIsIncin=false;   // ★2026-11-17 批2.6: 烟雾弹改可烹饪真引信 (旧 99 哨兵)
vmSndFlags={};
AudioSys.click(1000,0.28,0.05);
}
}
}
}
if(e.code==='Digit6'){
// 燃烧弹 (有燃烧弹时优先); 工程兵(cls4)不带燃烧弹 ⇒ 同键承担迫击炮架设/回收 (2026-09-28 兵种合并, 原迫击炮兵 B 键迁此)
if(player.incinCount>0){
// ★2026-10-25 反馈轮①: 读条中 6 = 打断读条再举燃烧弹; 同键(举燃烧中再按6)不抢; ok=除 VM 态外全门。
// ★2026-10-30 读条交互批: 打断改双击确认 (barStealArmed 单源)。
const sameHeld=player.nadeHeld&&player.nadeIsIncin;
const ok=!player.onMG&&!player.onVehicle&&!player.onAT&&!player.onAA&&!player.onMortar&&!player.loiter;
// ★2026-11-22 投掷手感批: 弧中接续同 KeyG (见 nadeArcTakeover 注); flush 清零则空手不自举。
if(ok&&nadeArcTakeover()&&player.incinCount>0){
player.nadeHeld=true; player.nadeFuse=NADE_COOK_FUSE.incin; player.nadeIsAT=false; player.nadeIsSmoke=false; player.nadeIsIncin=true;   // 燃烧真引信 (与 idle 起步同账)
AudioSys.click(880,0.3,0.05);
}else{
if(ok&&!sameHeld){ if(!player.barStealArmed('Digit6')) return; player.stealBar(); }
if(ok&&VM.state==='idle'){
VM.state='nade'; VM.stateT=0; VM.stateDur=999;
player.nadeHeld=true; player.nadeFuse=NADE_COOK_FUSE.incin; player.nadeIsAT=false; player.nadeIsSmoke=false; player.nadeIsIncin=true;   // ★2026-11-17 批2.6: 燃烧弹改可烹饪真引信 (旧 99 哨兵)
vmSndFlags={};
AudioSys.click(880,0.3,0.05);
}
}
} else if(player.cls===4&&!player.onVehicle&&!player.onMG&&!player.onAT&&!player.onAA&&!player.onMortar&&!player.loiter){
if(!player.mortarPlaced){
const fd=camForward();fd.y=0;if(fd.lengthSq()<0.1)return;fd.normalize();
if(!player.barStealArmed('Digit6')) return;   // ★2026-10-30 读条交互批: 打断双击确认 (方向门过了才算"会起步")
player.stealBar();   // ★2026-10-25 反馈轮①: 方向门过了=确认架设才抢读条
deployMortar(player,player.pos.x+fd.x*1.6,player.pos.z+fd.z*1.6,Math.atan2(fd.x,fd.z));
// 读条回收 (2026-09-28 阶段三 P1): 6 靠近自己的炮=1.2s 读条 / 读条中再按=取消 (原为瞬发)
// ★2026-10-30 用户裁定②: 回收读条中再按 6 = **极少加快** (推进 DEMOLISH_T 的 2.5%), 不再取消 ——
//   取消仍有 X / 左键 / 受击>25 / 走远 (>3.6m updateDemolish 自收) 四条路。
} else if(player.demolish&&player.demolish.mortar){ player.demolish.t+=DEMOLISH_T*BAR_PRESS_BOOST; }
else startMortarRecover(player);   // 抢占在 startMortarRecover 内部找到炮之后 (找不到炮不白丢读条; 双击确认也在其内)
}
}
if(e.code==='KeyH'){
// 观战模式: H = 气动飞行开关 (复用巡飞弹飞行动作: 沿视线前飞不可悬停, 空格加速, 俯冲触地落地; 右键=瞄准 2026-11-06)
if(player.spectator&&player.alive&&!player.onVehicle&&!player.loiter){
if(!player.flying||!player.flyAero){
player.flying=true; player.flyAero=true;
player.crouch=false; player.prone=false; player.onGround=false;
player._aeroSpd=Math.max(player._aeroSpd||0,13);
player.vel.y=Math.max(player.vel.y,2.5);
showScorePop('气动飞行 · 沿视线前飞 · 空格加速 · 俯冲触地落地');
}else{
player.flying=false; player.flyAero=false;
showScorePop('飞行关闭');
}
AudioSys.click(1050,0.3,0.05);
return;
}
// ★2026-10-12 用户提议②: 读条中再按 H = 取消包扎 (与 6 回收迫击炮 / B 拆除工事的"读条中再按=取消"同规)
// ★2026-10-30 用户裁定②: 包扎读条中再按 H = **极少加快** (推进 BANDAGE_T 的 2.5%), 不再取消 ——
//   倒计时账 (bandaging) 与 VM 动画账 (stateT) 同步推进, 两口钟不脱节; 取消仍有 X / 左键 / 受击>25。
if(player.bandaging>0){
const _bb=BANDAGE_T*BAR_PRESS_BOOST;
player.bandaging=Math.max(0.01,player.bandaging-_bb);   // 钳 0.01: 让 20-player 的包扎 tick 自己走完结算 (清零会跳过它的完成分支)
if(VM.state==='bandage') VM.stateT=Math.min(VM.stateDur,(VM.stateT||0)+_bb);
return;
}
// ★2026-10-25 反馈轮①: 其他读条 (换弹/举雷/拆除/前摇/原位换弹) 被 H 打断 = 收掉再包扎; ok=除 VM 态外全门
//   (满血/没绷带/座位上本就不会起步, 不白丢读条)。★2026-10-30: 打断改双击确认 (barStealArmed 单源)。
// ★2026-11-20 火力点坐姿批: 摘 !onMG/!onAT/!onAA (onMortar/onBattery 旧版本就未列入) —— 固定火力点
//   五座放行"坐着不下车包扎" (readBarBusy 同批摘五旗); 载具 (onVehicle) 维持硬挡。
const okH=player.bandages>0&&player.hp<100&&!player.onVehicle&&!player.loiter;
if(okH){ if(!player.barStealArmed('KeyH')) return; player.stealBar(); }
if(okH&&VM.state==='idle'&&player.bandaging<=0){
player.bandaging=BANDAGE_T;
VM.state='bandage'; VM.stateT=0; VM.stateDur=BANDAGE_T;
vmSndFlags={};
showScorePop('包扎中…');
AudioSys.metalSlide(0.14,0.25,400,700);
}
}
// 兵种 8→5 (2026-09-28 阶段三 P1): 工程兵(cls4) 一个兵种三件事 ——
//   B=锤击建造 / N=选工事型号 (★2026-11-28 键位轮换批: 原 5 让给烟雾弹, 选号改挂 KeyN) / **6=架设/回收迫击炮** (见上面 Digit6 处理器, 原迫击炮兵 cls6 的 B 键职责迁到 6);
//   原医护兵 cls4 的"按B放医疗箱"取消 —— 医疗箱改为工程兵建造菜单第 5 件 (06-engineering BUILD_MENU)。
//   读条回收 (同批用户提议): B 靠近自己工事=拆除读条 (退全款) / 读条中再按=取消 / 离开工事=正常建造。
// 丧尸模式全职业建造 (2026-10-28 修复, 指导 §4.6(1)): KeyB/Digit5(现 KeyN) 旧门 cls===4 把非工程兵锁死 ——
// 尸潮守备局里人人需要沙袋/铁丝。ZOMBIE_MODE 放行全职业 (基础件免费/商店件扣 ZP, 见 06-engineering
// engBuild 单源); 座位门不变。普通模式仍 cls===4 独占, 逐位零变化。
if(e.code==='KeyB'){
// ★20261128e: 门加 player.spectator —— 调试观战开放建造 (用户令"调试模式开放全部建造,全部免费"; 支付
//   豁免/全菜单在 06 engBuild/engMenuList 单源)。自由观战 (alive=false) 到不了这里 (上方 alive 总门),
//   engBuild 头部 !pl.alive 保险双挡。
if((player.cls===4||ZOMBIE_MODE||player.spectator)&&!player.onVehicle&&!player.onMG&&!player.onAT&&!player.onAA&&!player.onMortar){
// ★2026-10-30 用户裁定②: 拆除/回收读条中再按 B = **极少加快** (推进 DEMOLISH_T 的 2.5%), 不再取消 ——
//   取消仍有 X / 左键 / 受击>25 / 走远 (>3.6m updateDemolish 自收)。
if(player.demolish){ player.demolish.t+=DEMOLISH_T*BAR_PRESS_BOOST; }
else if(player.pendingBuild){ if(typeof VM!=='undefined'&&VM.state==='build') VM.stateT=Math.min(VM.stateDur,(VM.stateT||0)+VM.stateDur*BAR_PRESS_BOOST); }   // ★20261128d: 建造同键再按=极少加快 (VM.stateT 同时驱动锤击动画与落成, 通用读条口径; X/移动取消照旧)
else { const nb=nearOwnBuild(player); if(nb){ if(!player.barStealArmed('KeyB')) return; player.stealBar(); startDemolish(player,nb); } else engBuild(player); }   // ★2026-10-25 反馈轮①: 拆除起步前抢读条 (nb 找到=确认起步); 建造的抢占在 engBuild 全部早退之后 (06-engineering) —— ★2026-10-30: 两条路都改双击确认
}
}
if(e.code==='KeyN'&&(player.cls===4||ZOMBIE_MODE||player.spectator)){   // ★20261128e: 调试观战选号放行 (与 KeyB 门同批)
const _ml=engMenuList(player);   // ★20261128d 丧尸菜单收窄单源 (engMenuList): 非工程兵只循环基础三件 (★20261128e 调试观战全菜单)
player.buildSel=((player.buildSel||0)+1)%_ml.length;
const bt=_ml[player.buildSel];
const bn=bt==='mg'?mgDefOfTeam(player.team).name:BUILD_NAMES[bt];
// 消耗提示单源 (2026-10-28): 商店三件读 BUILD_ZP (ZP 点), 其余读 BUILD_COST (建造点) ——
// 旧版 tower/ammoc 查 BUILD_COST 落空 ⇒ "消耗undefined点"。★20261128e: 调试观战全免费, 提示单走免费串。
const isZP=!player.spectator&&ZOMBIE_MODE&&BUILD_ZP[bt]!==undefined;
if(SHOW_CTL_HINTS) showScorePop(player.spectator?t2('建造选择: {0} (免费 · 按B放置)',t2(bn)):t2('建造选择: {0} (消耗{1}{2} · 按B放置)',t2(bn),isZP?BUILD_ZP[bt]:BUILD_COST[bt],isZP?'ZP':'')); // 详细操作开关 (2026-11-09 批): 关=键位提示不弹
}
if(e.code==='KeyF'){
// 巡飞弹视角切换已挪 U (2026-11-06 飞行瞄准批); 制导中按 F 落 tryInteract 在其第一行被 loiter 门吞掉, 无误触
tryInteract();
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
// 4/5/6 持掷松手 (2026-09-30 批; ★2026-11-28 键位轮换: AT 3→4 / 烟雾 4→5): 与 KeyG 同一收口 —— 按住期间 nadeHeld=true (弹道预演亮出), 松手进投掷动画
if((e.code==='Digit4'||e.code==='Digit5'||e.code==='Digit6')&&player.nadeHeld){
player.nadeHeld=false;
VM.stateT=0; VM.stateDur=0.55;
}
});
let mouseDown=false, mouse2Down=false;
addEventListener('mousedown',e=>{
// 指挥地图开着: 鼠标归地图 (2026-10-26 修复, 与 26-commander 的 stopPropagation 同源双保险) ——
//   本处理器挂在 window 上无条件执行, 光靠地图自己 stopPropagation 一旦漏一条路径就会变成
//   "点一下地图走一发火 + 触发丢锁补锁". 这里按 cmdMapUIOpen 单源早退 (与下方 :504 inCmdMap 同判据)。
if(typeof cmdMapUIOpen==='function'&&cmdMapUIOpen()) return;
if(!pointerLocked){
// 战斗进行中指针锁定丢失(浏览器可能拒绝立即重锁): 点击画布补锁
if(player.deployed&&player.alive&&!matchOver&&!gamePaused&&document.querySelectorAll('.screen:not(.hidden)').length===0) lockPointer();
// ★2026-11-01 自由观战视模式: 同一条丢锁补锁路径 (alive=false 走不了上面那条)
else if(player.specView&&!player.alive&&!matchOver&&!gamePaused&&document.querySelectorAll('.screen:not(.hidden)').length===0) lockPointer();
return;
}
// ★2026-11-01 自由观战视模式 (MC 旁观者): 左键=附身准星 Bot, 右键=脱离回自由飞行。仅此二义, 不开火不进 ADS。
if(player.specView&&!player.alive){
if(e.button===0){
const b=(typeof specViewPickHost==='function')?specViewPickHost():null;
if(b) specViewPossess(b);
else if(typeof showScorePop==='function') showScorePop('场上没有可附身的 Bot');
}else if(e.button===2&&player.specViewHost){
specViewDetach(true);
if(typeof showScorePop==='function') showScorePop('已脱离 · 自由观战');
}
return;
}
// ★2026-11-02 实机修复: 调试附身中鼠标也归"只读借眼" —— keydown 侧已有吞键门 (Q/E/U/J/K 白名单, 本文件 :169),
// 但鼠标是**独立监听器**: 右键曾照旧 player.ads=true ⇒ FP 视角里宿主的枪做出瞄准动作 (用户实机报);
// 左键 mouseDown=true 虽因 updatePlayer 冻结 (20-player :799) 打不出去, 也照样置账。视模式 (alive=false)
// 走上方分支已 return, 这里拦的是调试附身: 左/中/右键一律吞掉, 不进 ADS、不 cancel 读条。
if(player.specViewHost) return;
// ★2026-11-20 火力点坐姿批: 负条件再加两支豁免 —— 座位上开炮不取消读条 (2026-11-13 换弹豁免先例的延伸):
//   ① 原位换弹中 (seatReload>0); ② 火力点五旗上包扎中 (bandaging>0)。该分支 return 不置 mouseDown,
//   点击照常落给座位开火 tick (updatePlayerMG/AT/AA/Mortar/Battery 消费 mouseDown)。
if(e.button===0&&player.readBarActive()&&!(typeof VM!=='undefined'&&(VM.state==='nade'&&player.nadeHeld||VM.state==='reload'))&&!(player.seatReload>0||((player.onMG||player.onAT||player.onAA||player.onMortar||player.onBattery)&&player.bandaging>0))){
// ★2026-10-12 用户提议②: 读条中左键 = 取消读条。**这次点击必须被吞掉** —— 取消之后 VM.state 立刻回到
//   'idle', 若照旧置 mouseDown=true, 下一帧的 playerFireTick 就会顺势把这一枪打出去 (取消读条不该走火)。
// ★2026-10-25 举雷并入读条后的**唯一例外**: 举雷待发是"按住瞄准"的持续态, 左键在枪上本来无语义
//   (VM 'nade' 不可开火), 瞎点到左键不该把雷收回 —— 收雷只有 X / ✕ 两条有意路径。举雷期间其余读条
//   结构上不可能同时活跃 (VM 单值状态机互斥), 这一个负条件即充分。
// ★2026-11-13 批: 换弹同样豁免 (用户实报"换弹时按左键取消换弹很难受") —— 换弹中左键与按 R 同义:
//   不取消不重启。VM.state!=='idle' 本就打不出枪, 这里不再吞键 (mouseDown=true 无害, 装填完成时仍按住
//   = 正常开火节奏), 包扎/拆除/其它读条照旧可左键取消。
player.cancelReadBar('已取消');
return;
}
if(e.button===0) mouseDown=true;
if(e.button===1){ // 鼠标中键 (7b-丙): 飞机锁定切换, 与 E 同一单源 planeLockToggle; preventDefault 压掉浏览器中键自动滚屏
e.preventDefault();
if(player.alive&&player.onVehicle&&player.onVehicle.kind==='plane'&&typeof planeLockToggle==='function') planeLockToggle();
// ★2026-11-20 近战重做: 军刀中键 = 竖劈 (门全在 startMelee 单源内, 不吃座位门 —— 座位上自然落空)
else if(player.alive&&player.curW&&player.curW.def&&player.curW.def.melee) startMelee('chop');
}
if(e.button===2){
// ★2026-11-20 近战重做: 军刀右键 = 横斩 —— 步行门通过才起步 (门细项在 startMelee 单源内),
//   通过即 return: 不进 ADS 也不置 mouse2Down (军刀没有机瞄语义, ADS 分流只属于枪)。
if(player.alive&&player.curW&&player.curW.def&&player.curW.def.melee
&&!player.loiter&&!player.flying&&!player.swim&&!player.onVehicle&&!player.onNaval&&!player.onMG&&!player.onAT&&!player.onAA&&!player.onMortar&&!player.onBattery){
startMelee('slash');
return;
}
mouse2Down=true;
// 通讯仪右键 (2026-10-26 指挥官批, 设计 R2/§3): 右键 = 开/关指挥地图, 不进 ADS ——
// 姿态门 (D18 仅步行地面) 与开图条件都在 cmdMapToggle 内部单源把关, 这里只按"手里是通讯仪"分流。
if(player.alive&&player.curW&&player.curW.key==='radio'&&typeof cmdMapToggle==='function'
&&!player.loiter&&!player.flying&&!player.onVehicle&&!player.onNaval&&!player.onMG&&!player.onAT&&!player.onAA&&!player.onMortar&&!player.onBattery&&!player.swim){
cmdMapToggle();
return;
}
// 巡飞弹制导中右键是"开镜放大"而非机瞄 (消费在 13-combat/20-player, 判据 mouse2Down&&!_ltRClick);
// 两种观战飞行 (气动/悬停) 中右键 = 瞄准 ADS —— thirdPersonOn 排除 ads, 第三人称飞行中右键自动切第一人称, 松开回原档 (2026-11-06)
if(player.alive&&!player.loiter&&!player.onMG&&!player.onVehicle&&!player.onNaval&&!player.onAT&&!player.onAA&&!player.onMortar&&!player.onBattery) player.ads=true;   // 2026-09-26E 审计 6: 艇上右键是 .50 扳机, 不该进 ADS; 2026-09-28C 补岸防炮位 (右键无语义, 同门); 2026-10-04 补大舰炮位 (右键=副炮/防空扳机); 2026-11-06 飞行瞄准批: 摘 !player.flying (气动加速已让位空格, 右键=瞄准)
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
// ★2026-11-01 自由观战视模式: 自由飞行态放行视角 (附身时视角跟 Bot 走, 不收鼠标) —— 旧门 !player.alive 把视模式整个拒之门外。
if(!pointerLocked||(!player.alive&&!(player.specView&&!player.specViewHost))) return;
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
// ★2026-11-01 自由观战滚轮调速 (MC 旁观者口径): 滚轮改创造飞行速度 3..90 m/s, 仅自由飞行态生效 (附身时无飞行)
addEventListener('wheel',e=>{
if(!player.specView||player.alive||player.specViewHost) return;
player.specViewSpd=clamp((player.specViewSpd||14)*(e.deltaY<0?1.15:1/1.15),3,90);
},{passive:true});
// ESC 暂停切换: 暂停时退出指针锁定并盖暂停面板, 恢复时重新锁定
// 模态归位 (2026-09-16 本批): 暂停面板与部署界面同层同源, 谁最后打开谁生效 —— 旧版从部署界面按 Esc 会在部署面板上
// 再叠一层暂停面板, 关闭后仍留着部署面板 (用户读作"Esc 没反应")。这里先把部署界面收掉, 再开暂停面板。
function togglePause(forceState){
if(typeof forceState==='boolean'){
if(gamePaused===forceState) return;
gamePaused=forceState;
}else{
gamePaused=!gamePaused;
}
if(gamePaused) document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden'));
// 暂停面板会把部署界面一并收起 (模态归位, 见上) ⇒ 就地摘掉 inDeploy: "暂停时查看部署界面"按 ESC 回到战局后,
// 战斗 HUD 必须立刻放回 (2026-09-20 第6条: 藏过头 = 该显示时不显示)。放在下面的 pauseOv 早退之前, 保证一定执行。
if(typeof syncDeployHud==='function') syncDeployHud();
// 暂停静音: 环境(风/雨)+坦克/飞机引擎 (旧版 setAmbientMute 未导出, 静音从未生效)
if(AudioSys.setAmbientMute) AudioSys.setAmbientMute(gamePaused);
const ov=document.getElementById('pauseOv');
if(!ov) return;
if(gamePaused){
const pMainBtns=document.getElementById('pauseMainBtns');
const pSetPnl=document.getElementById('pauseSettingPanel');
const pHelpPnl=document.getElementById('pauseHelpPanel');
if(pMainBtns) pMainBtns.classList.remove('hidden');
if(pSetPnl) pSetPnl.classList.add('hidden');
if(pHelpPnl) pHelpPnl.classList.add('hidden');
ov.classList.remove('hidden');
if(typeof syncPauseSeedLine==='function') syncPauseSeedLine();
if(document.pointerLockElement) document.exitPointerLock();
}else{
ov.classList.add('hidden');
if(!menuHold && !matchOver && (!player.alive || !player.deployed)){
if(typeof showDeploy==='function') showDeploy(!player.alive);
}else{
if(typeof syncDeployHud==='function') syncDeployHud();
lockPointer();
}
}
}
document.getElementById('pauseResumeBtn').addEventListener('click',()=>{ togglePause(false); });
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
// 丢锁时若处于已部署存活状态且未暂停/未在菜单/未打开部署面板：
// 在桌面端玩家按 ESC 退出指针锁定，预期的第一动作是“先呼出重部署/整备界面”，而非直接跳过重部署进暂停。
const inDep = document.getElementById('deploy') && !document.getElementById('deploy').classList.contains('hidden');
// 指挥地图开着 (2026-10-26 指挥官批): 开图时主动退出指针锁是设计的一部分 (鼠标点选需要) ——
// 这条丢锁不是"玩家按 Esc 想看部署页", 不许弹部署界面 (地图自己的 Esc/右键出口在 26-commander)。
const inCmdMap=(typeof cmdMapUIOpen==='function')&&cmdMapUIOpen();
if(!pointerLocked && player.alive && player.deployed && !matchOver && !gamePaused && !menuHold && !inDep && !inCmdMap){
if(typeof bigmapOn!=='undefined' && bigmapOn) toggleBigMap();
showDeploy(false);
lastEscT = performance.now(); // 记下时间，防止某些浏览器紧随其后补发 keydown(Escape) 导致瞬间二次触发转进暂停
}
// ★2026-11-01 自由观战视模式: 丢锁同族 —— Esc 呼出部署页 (票尽时那里只有「观战」按钮可回观战), 不进暂停
else if(!pointerLocked && player.specView && !player.alive && !matchOver && !gamePaused && !menuHold && !inDep && !inCmdMap){
showDeploy(true);
lastEscT = performance.now();
}
});
document.addEventListener('visibilitychange',()=>{
if(document.hidden){
if(!gamePaused&&player.alive&&player.deployed&&!matchOver){
togglePause(true);
}
}else{
if(typeof lastT!=='undefined') lastT=performance.now();
}
});
function lockPointer(){
if(MOBILE){ pointerLocked=true; return; }
try{ const r=renderer.domElement.requestPointerLock(); if(r&&r.catch) r.catch(()=>{}); }catch(e){}
}
// 换弹时长单源 (★2026-11-20 火力点坐姿批): 步行 VM 换弹与座位原位换弹 (player.seatReload) 共用一份公式
// —— 连杀增益 ×动态换弹速度 (×已耗/弹匣, 2026-11-12); 原为 tryReload 行内公式, 抽出防两处漂移。
function reloadDurOf(w){
return w.def.reload*(player.streakBuff?player.streakBuff.reloadMul:1)*dynReloadFac(w.mag,w.def.mag);
}
function tryReload(viaKey){
if(player.spectator) return; // 观战: 弹药每0.5s自动回满, 永不换弹 —— 拦截手动R/空仓点击/打空自动换弹/巡飞弹引爆后的自动换弹 (2026-09-11 修复不定时换弹)
const w=player.curW;
// ★2026-11-20 火力点坐姿批: 座位门只留载具 (onVehicle) —— 固定火力点五座放行走"原位换弹" (坐在炮位上
//   给随身武器装填, 账挂 player.seatReload); 海战维持现状不新增门 (艇上 curW=null 由 !w 挡住, 旧门本就没列它)。
if(!w||player.onVehicle) return;
// 冻账收编 (★2026-11-20): 上车前遗留的 VM 换弹在座位上永走不完 (24-main 座位门停跑 updateViewModel) ⇒
//   静默收掉 (弹不结算, 与 cancelReadBar 的换弹中止语义一致) —— 不收的话 VM 态门会把这发 R 当"同键加速"白按。
if((player.onMG||player.onAT||player.onAA||player.onMortar||player.onBattery)&&(typeof VM!=='undefined'&&VM.state==='reload')){ VM.state='idle'; vmSndFlags={}; }
if(VM.state!=='idle'){
// ★2026-10-25 反馈轮①: 读条中按 R = 打断当前读条再装填; **换弹中重按 R 不重启** (同键不抢, 进度不白丢)。
//   viaKey 只来自按键 (本文件 keydown 三处); 空仓自动换弹 (20-player 的 click/timeout) 不带 ——
//   系统自动续弹绝不能把玩家举着的雷/包着的绷带抢走。出手弧 (state 'nade' 且 nadeHeld=false) ★2026-11-21
//   P1-4 起已入取消网 (viaKey 双击确认后 stealBar 同口收手不消耗), 自动换弹 (无 viaKey) 仍被二道门拦。
// ★2026-10-30 用户裁定②③: 换弹中重按 R = **极少加快** (推进 stateDur 的 2.5%); 其他读条中 R = 双击确认
//   打断 (第一次只亮"再按一次打断", barStealArmed 单源)。
// ★2026-11-20 火力点坐姿批: 坐着包扎中按 R 也走这里 = 双击确认打断包扎再换弹 (座位门已放行)。
if(!viaKey) return;
if(VM.state==='reload'){ VM.stateT=Math.min(VM.stateDur,(VM.stateT||0)+VM.stateDur*BAR_PRESS_BOOST); return; }
if(!player.barStealArmed('KeyR')) return;
player.stealBar();
if(VM.state!=='idle') return;
}
// 火力点原位换弹 (★2026-11-20): 账挂 player.seatReload, tick/结算在 20-player (座位早退之前)。
//   同键重按 = 极少加速 (与步行换弹 R 同规); 弹满/无备弹不起步 (不白丢读条)。
if(player.onMG||player.onAT||player.onAA||player.onMortar||player.onBattery){
if(player.seatReload>0){ player.seatReload=Math.max(0.01,player.seatReload-player.seatReloadDur*BAR_PRESS_BOOST); return; }
if(w.mag>=w.def.mag||w.reserve<=0) return;
const d=reloadDurOf(w);
player.seatReload=d; player.seatReloadDur=d;
return;
}
if(w.mag>=w.def.mag||w.reserve<=0) return;
VM.state='reload'; VM.stateT=0;
VM.stateDur=reloadDurOf(w); // 连杀增益: 换弹加速 (2026-09-11); 动态换弹速度 ×已耗/弹匣 (2026-11-12, 单源 dynReloadFac — VM 动画/读条/3P 镜像按 nt 比例自动跟随)
vmSndFlags={};
}
function switchSlot(i,viaKey){
if(i===player.curSlot||!player.slots[i]||player.onMG||player.onVehicle||player.onNaval||player.onAT||player.onAA||player.onMortar||player.onBattery||player.loiter) return;   // 2026-09-26E 审计 5: 艇上换枪会打断座驾读数链路 (fov/炮手镜/弹药面板); 2026-10-04: 大舰炮位同门 (U2; 2026-11-10 该项随大舰子系统下架摘除); ★2026-11-21 批B#5: 补 onMortar/onBattery (迫击炮/岸防炮座位上按 1/2 或手柄 LS 切枪, 会把弹药面板从炮位读数切到随身枪)
if(VM.state!=='idle'&&VM.state!=='fire'){
// ★2026-10-25 反馈轮①: 读条中 1/2/4 换枪 = 打断读条再换枪 (同槽重按在上面的首门已挡, 不会白抢)。
//   viaKey 只来自按键 (keydown / 手柄 LS); 再部署·观战补装等程序调用不带。
// ★2026-10-30 读条交互批: 打断改双击确认 (BAR_ARM_WIN 内同键两次; 键标识用 'SW'+槽位 —— Digit1↔槽0
//   一一对应, 连按同一键即连按同一标识)。观战补装等程序调用 (viaKey=false) 在上面已 return。
if(!viaKey) return;
if(!player.barStealArmed('SW'+i)) return;
player.stealBar();
if(VM.state!=='idle'&&VM.state!=='fire') return;
}
player.curSlot=i;
player.curW=player.slots[i];
if(i!==2) player._lastGunSlot=i;   // ★2026-11-20 近战重做: 记住最后枪槽 (N 切回军刀槽的落点; 军刀槽自身不入账)
vmEquip(player.curW.key,player.team);
}
// ★2026-11-20 近战重做: 军刀三式起手单源 (thrust/slash/chop)。三个输入点 (左键=20-player playerFireTick
//   分流 / 右键·中键=本文件 mousedown) 全部汇到这里, 门只写一遍。通过 ⇒ VM 'melee' 态
//   (10-viewmodel 按 VM.meleeKind 分段播动画, 中段 vmPlayOnce 单发结算), 冷却 = 该式时长
//   (挥完即可接下一式, 无额外硬直); 3P 姿态机读 player.meleeKind/meleeDur 分式归一。
function startMelee(kind){
const p=player;
if(!p.alive||p.meleeCd>0||p.readBarActive()) return;
if(p.loiter||p.swim||p.flying||p.onVehicle||p.onNaval||p.onMG||p.onAT||p.onAA||p.onMortar||p.onBattery) return;
const w=p.curW;
if(!w||!w.def||!w.def.melee) return;
if(VM.state!=='idle') return;
const dur=w.def[kind+'T'];
if(!(dur>0)) return;
VM.state='melee'; VM.meleeKind=kind; VM.stateT=0; VM.stateDur=dur;
p.meleeCd=dur; p.meleeKind=kind; p.meleeDur=dur;   // meleeKind/meleeDur: 3P 姿态机分式 + 归一化用
vmSndFlags={};   // 重置单发账: vmPlayOnce('meleeHit') 每一式都要能再发
AudioSys.metalSlide(0.12,0.05,1500,500);   // 挥刀风声 (现有音效函数; 命中声在 doMeleeHit 按式分级)
}
