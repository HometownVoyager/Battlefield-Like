// ─────────────────────────────────────────────
// 24-main.js —— 主循环/移动端触控/启动
// 源: Index.original.html 第 8531-8765 行
// ─────────────────────────────────────────────
'use strict';
var lastT=performance.now(); let fpsAcc=0, fpsN=0, fpsShow=0, deployRefreshT=0;
function loop(){
requestAnimationFrame(loop);
const now=performance.now();
if(document.hidden){
if(gamePaused||matchOver||menuHold) nowOff+=now-lastT;
// 指挥减速的冻结期自愈 (2026-10-26 指挥官批修复): 本分支 return 在 cmdFrameTick (末段) 之前 ——
//   按住 V 时按 Esc 暂停, 松手后没有任何 tick 会去读 CMD.slowOn, 它会一直挂 true (恢复战斗即凭空慢放)。
//   这里按同一判据就地回常速 (单源 cmdSlowFreezeHeal, 26-commander)。
if(typeof cmdSlowFreezeHeal==='function') cmdSlowFreezeHeal();
lastT=now;
return;
}
// 部署期 HUD 隐藏的**权威对账** (2026-09-20 第6条): 隐藏战斗 HUD ⟺ 部署界面正在显示。
// 放在主循环最前 (冻结分支之前): 主菜单(menuHold)/暂停/结算期间同样要对账 —— 万一还有别的路径收起 .screen
// 而忘了同步, 一帧内就纠正。单源函数在 22-hud (setDeployHudHidden/syncDeployHud), 稳态零 DOM 写入
// (只在状态真的不同时才 toggle); 分步调用点 showDeploy/deployPlayer/returnToMenu/resumeBattle/resumeBtn/
// togglePause/endMatch 已就近对账, 这里兜的是"以后新增的收起路径"。
// ★2026-11-04b 时停音频批 (用户实报: 时停期间发动机引擎仍有声音, "应该还有其他类似的问题"):
//   时停的 dt=0 只冻住了战场物理, WebAudio 的连续振荡器 (坦克/飞机/舰艇/幽灵坦克引擎)、风噪雨声环境层、
//   以及 setInterval/setTimeout 周期声 (远处机枪/鸟鸣/雷暴远雷/弹夹落地) 全走墙钟 ⇒ 画面停了声音没停。
//   这里每帧把 specTimeFrozen() 的单一事实喂给 01-audio 的 setTimeFrozenMute 单源 (内部有状态, 稳态零
//   WebAudio 写入); 放在冻结分支 return 之前, 保证暂停/结算/菜单期也能把残留的时停账复位。
if(typeof AudioSys!=='undefined'&&AudioSys.setTimeFrozenMute)
AudioSys.setTimeFrozenMute(typeof specTimeFrozen==='function'&&specTimeFrozen());
if(typeof syncDeployHud==='function') syncDeployHud();
const rdt=Math.min((now-lastT)/1000,0.05);          // 真实帧时间 (本帧世界推进的**上限**)
// 观战时停 (2026-09-26H 观战批 B7; 2026-09-27I 收敛为"只留时停"): 单源在 22b-speclayer specTimeConsume ——
// 非观战/未时停原样返回 rdt (零行为漂移), 时停返回 0。未被消费的时间同样计进 nowOff ⇒ 游戏时钟 nowT 与
// 世界同速冻结 (射速/引信/重生倒计时/旗点进度一起停, 不是"只有动画停"的假冻结)。
const dt0=(typeof specTimeConsume==='function')?specTimeConsume(rdt):rdt;
// 指挥官层帧长门 (2026-10-26 指挥官批, 单源 = 26-commander cmdDtGate): 帧长三态化 —— 布势冻结=0 /
// 指挥减速=×0.2 / 常速原样。K 时停优先 (D14): dt0<=0 (时停/暂停) 时原样放行, 减速不把冻结"复活"。
// 慢掉/冻掉的差量由下方既有 nowOff 账吸收 ⇒ 游戏时钟 nowT 与世界同速慢放/冻结 (时停管道同款语义)。
const dt=(typeof cmdDtGate==='function')?cmdDtGate(rdt,dt0):dt0;
// 观察者例外 (用户 2026-09-27: "时停的时候玩家也不能动"是缺陷): 时停冻的是**战场**, 不是观战者 ——
// 本体链 (updatePlayer/相机/信息层/视角武器) 用 pdt = 真实帧时间; 座驾由 specTimeRideDt 逐台判定
// (specRide 单源: 只有观战者正在开的那一台跟本体同速, 含幽灵坦克)。非时停时 pdt≡dt ⇒ 普通战斗零漂移。
// 2026-10-26 指挥减速: cmdPlayerDt 在此之上再叠 "对我无效"超人档 (R9/D4, 默认关 = pdt≡dt 零漂移)。
const pdt0=(typeof specTimePlayerDt==='function')?specTimePlayerDt(rdt,dt):dt;
const pdt=(typeof cmdPlayerDt==='function')?cmdPlayerDt(pdt0,rdt):pdt0;
// 载具帧长解析 (时停: 观战者座驾拿 rdt, 其余载具拿 dt=0 ⇒ 冻结); 缺 22b (探针/部分沙箱) 时退化为 dt;
// 指挥减速的超人档同豁免玩家正在开的那一台 (cmdRideDt, 26-commander)
const vdt0=(v)=>(typeof specTimeRideDt==='function')?specTimeRideDt(v,rdt,dt):dt;
const vdt=(v)=>(typeof cmdRideDt==='function')?cmdRideDt(v,vdt0(v),rdt):vdt0(v);
if(gamePaused||matchOver||menuHold) nowOff+=now-lastT;
else if(dt!==rdt) nowOff+=rdt-dt;   // ★已知问题 (2026-11-05 时停照明弹批留档, 未修): rdt/dt 是**秒**, 下方 nowT 表盘是**毫秒** —— 本行差了 1000 倍, 时停/指挥减速期间游戏时钟 nowT 实际只被拖慢 ~0.1% (注释宣称的"nowT 同速冻结/慢放"不成立)。dt 基系统 (战场更新) 不受影响照常冻结; nowT 基相位 (照明弹/探照灯/火光已改 08-effects 战斗钟 _ngT/_fireT) 与 nowT 基门限 (各类 nowT-X 比较账) 时停里继续走。整体修法 = `(rdt-dt)*1000`, 但会波及观察者链上混用 nowT 的门 (体能回充/观战补给节流/HUD 指纹节流等), 需专项批逐处对账, 不随本批。
lastT=now;
nowT=(now-nowOff)/1000;
fpsAcc+=1/Math.max(rdt,0.001); fpsN++;   // FPS 表按**真实**帧时间统计 (时停 dt=0: 旧写法会显示 1000 FPS)
if(fpsN>=30){ fpsShow=Math.round(fpsAcc/fpsN); fpsAcc=0; fpsN=0; el('fps').textContent=fpsShow+' FPS'; }
// 暂停/对局结束/返回主界面(menuHold): 战斗、移动、天气、旗点等全部冻结, 仅维持画面渲染
if(gamePaused||matchOver||menuHold){
// ★指挥减速冻结期自愈 (2026-10-26 排查轮): 本分支 return 在 cmdFrameTick (末段) 之前, 按住 V 时按 Esc
//   暂停 → 松手也收不到任何 tick, CMD.slowOn 会一直挂 true, 一恢复战斗就凭空 0.2x 慢放且读条继续扣。
//   旧写只挂在上面 document.hidden 分支 (= 切后台标签页), 而 Esc 暂停走的是**可见**的这条分支 ⇒ 等于没修。
//   同源自愈 (单源 cmdSlowFreezeHeal) 挂在这里, 与 nowOff 同帧回常速。
if(typeof cmdSlowFreezeHeal==='function') cmdSlowFreezeHeal();
// ★2026-10-26 排查轮二审 修复 (D20 暂停菜单优先于指挥地图): 布势版地图挂在 body 上且 z-index 500,
//   暂停面板 #pauseOv 是 css .screen 的 z-index 20 ⇒ 暂停面板确实打开了却被地图整块盖住, 玩家看到
//   的是"按 Esc 没反应 + 世界越来越像卡死"。暂停期本分支 return 在 cmdFrameTick (末段) 之前, 而
//   地图的显隐对账挂在 cmdMapTick 里 ⇒ 必须在冻结分支也跑一次同源对账 (单源 cmdMapPauseGate)。
//   解冻当帧由 cmdMapTick 再对账一次把地图放回来 (两处共读同一布尔账本 CMD._pauseHid)。
if(typeof cmdMapPauseGate==='function') cmdMapPauseGate();
// 主菜单期改用无 UI 航拍动态 (2026-09-17 用户插话): 冻结分支只渲染不更新相机, 于是打完一局返回主界面时画面
// 停在"结束前那一帧"(用户反馈: 静态的结束前视角)。菜单期显式驱动同一圈航拍环绕 (20-player updateMenuCamera,
// 用真实帧时间推进相位 —— 冻结期 nowT 不前进); 暂停面板(gamePaused)保持冻结的战场视角, 不动相机。
const menuCam=menuHold&&!gamePaused;
if(menuCam&&typeof updateMenuCamera==='function') updateMenuCamera(dt);
// (2026-11-10: 大舰菜单巡航 updateCapital 钩随大舰子系统下架摘除)
if(typeof updateSea==='function') updateSea(dt); // 主菜单航拍背景里海面照旧起伏/碎波滚动 (纯视觉)
if(menuCam&&typeof updateWeather==='function') updateWeather(dt); // 主菜单航拍背景里雨雪照旧飘落 (纯视觉)
// ★2026-09-26E (审计 35): 本分支在 updateWeather / flashTimer 之前 return ⇒ 雷暴白幕 (stormFlash) 与
//   爆炸闪光灯 (flashLight) 会**冻在菜单航拍里** (23b 只覆盖了 matchOver 一条路径, menuHold 不还原 ——
//   它自己那段注释就写着"作者知道该残留")。这里按**真实帧时间**把这两项衰减掉 (与 updateMenuCamera 同理:
//   冻结期 nowT 不前进, 用 dt)。
if(flashTimer>0){ flashTimer-=dt; if(flashTimer<=0&&typeof flashLight!=='undefined') flashLight.intensity=0; }
if(typeof stormFlash!=='undefined'&&stormFlash>0){
stormFlash=Math.max(0,stormFlash-dt*3.2);
const sov=document.getElementById('stormOv'); if(sov) sov.style.opacity=stormFlash*0.5;
}
// 水下滤镜的离场复位 (2026-09-25): 本分支在 updateUnderwaterFx 之前 return —— 潜水时返回主界面,
// 菜单航拍会用同一台相机带着水下近雾渲染 (整片蓝绿)。菜单期先把水下三态还原 (22-hud clearUnderwaterFx)。
if(menuCam&&typeof clearUnderwaterFx==='function') clearUnderwaterFx();
if(typeof shadowRefreshTick==='function') shadowRefreshTick(); // 阴影半频刷新 (2026-10-24 性能批, q0/q1 30Hz)
renderer.clear();
renderer.render(scene,camera);
// 菜单航拍是无 UI 背景: 第一人称武器模型不参与渲染 (结算/暂停的冻结帧仍照旧渲染)
if(!menuCam&&player.alive&&!player.onMG&&VM.root.visible){
// 第三人称开着时也不渲染视角武器模型 (2026-09-20 第三人称批): 相机已在身后, 该看到的是玩家本体 (20-player avatar)。
// ★ 判据嵌在内层而不是并进上面那行条件: verify-menucam 对上面那行做的是源码子串断言 (菜单航拍期不得出武器模型),
//   并进去会把那条既有守卫读成"断言里的源码不见了" —— 行为不变, 但没有理由去动别人的守卫签名。
if(!(typeof thirdPersonOn==='function'&&thirdPersonOn())){
renderer.clearDepth();
renderer.render(vmScene,vmCamera);
}
}
return;
}
gunEvents=gunEvents.filter(e=>nowT-e.t<0.6);
// 模型内共面消解 (2026-09-27K): 载具/飞机/士兵等模型是开局/重生时才建的, 建图末那次世界级消解覆盖不到
// —— 这里每帧只处理"没见过的"模型根 (每帧至多 2 个, 按离相机由近到远), 把检测成本摊到多帧。
if(typeof resolveRuntimeSurfaces==='function') resolveRuntimeSurfaces();
NAV.budget=2;
updateNavDirty(dt);
updateWires(dt);
updateDemolish(player,dt); // 读条回收 (2026-09-28 阶段三 P1): 拆除/回收进度推进 + 距离/状态打断
updateRisers(dt);
if(MOBILE&&window.updateTouchVis) updateTouchVis();
if(typeof updateGamepad==='function') updateGamepad(pdt);   // 手柄轮询 (19b-gamepad; 未加载该文件的沙箱静默跳过)
if(mortarMarker.visible&&!(player.alive&&player.onMortar)) mortarMarker.visible=false;
updatePlayer(pdt,dt);   // 第二实参 = 世界帧长 (2026-09-27M 时停: 海战音频逐艇判定该跟谁, 见 20-player 注释)
if(typeof specViewTick==='function') specViewTick(pdt);   // 自由观战视模式每帧: 附身眼位/自由飞行 (20-player 单源; updatePlayer 对死者早退, 视模式走这条旁路)
updateCamera(pdt);
updateUnderwaterFx(pdt); // 水下滤镜/憋气 HUD (22-hud; 相机没入水面即生效) — 必须在 updateCamera 之后
updateSea(dt);          // 海面动效: 碎波滚动/水面细流/浮标起伏 (05c; 非环礁图内部直接短路)
updateSunShadow();
// 天空盒跟随相机, 避免远处被远裁剪面切黑
if(SKY) SKY.position.copy(camera.position);
// 小队标记浮动
if(SQUAD.marker&&SQUAD.marker.visible){
SQUAD.marker.position.set(SQUAD.pos.x,heightAt(SQUAD.pos.x,SQUAD.pos.z)+2.1+Math.sin(nowT*2.4)*0.18,SQUAD.pos.z);
}
updateWeather(dt);
// ★2026-11-05 调试模式装备批: 门再放宽一档 —— 玩家当前座驾开着大灯 (L 键, 含幽灵坦克) 也要把
//   nightGearTick 拉起来, 否则晴天白天按 L 只有假光锥, 真灯池 (SpotLight) 永远不上 (用户实报
//   "坦克上的大灯没有实际效果")。照明弹/探照灯是暗光装备, 08-effects 内已加 isDark 门兜住,
//   晴天不会因这档放宽凭空长出照明弹。AI 载具的灯由夜档/暗光自动管理, 晴天本就全灭, 不受影响。
const _hlRideOn=!!(player&&((player.onVehicle&&player.onVehicle.lightsOn)||(player.onNaval&&player.onNaval.lightsOn)));
if((NIGHT_MODE&&typeof nightGearTick==='function')||((typeof isDarkEnvironment==='function'&&isDarkEnvironment()||(player&&player.flashlight)||_hlRideOn)&&typeof nightGearTick==='function')) nightGearTick(dt); // 夜档/暴雨暗光/照明开启: 大灯/手电/照明弹/探照灯
updateSmokes(dt);
for(const s of soldiers){
// (2026-11-10: 旧 s.capCrew 大舰甲板炮手 skip 随大舰子系统下架摘除 —— 该兵种不再生成)
// AI LOD: 远处降低更新频率(隔帧), 但把跳过的时间累积补回, 保证移动速度不变
s.tickAcc+=dt;
s.tickSkip--;
if(!s.alive||s.onVehicle||s.tickSkip<=0){
const useDt=Math.min(s.tickAcc,0.15);
s.update(useDt);
s.tickAcc=0;
const d2p=s.pos.distanceTo(camera.position);
s.tickSkip=d2p>110?3:d2p>60?2:1;
}
}
if(ZOMBIE_MODE&&typeof zombieFrameTick==='function') zombieFrameTick(dt); // 丧尸模式: 刷怪导演/胜负/ZP-HUD (2026-10-06)
if(typeof BotDebug!=='undefined'&&BotDebug.on) BotDebug.update(dt);
updateMedCrates(dt);
updateBloodDecals(dt);
for(const t of tanks) t.update(vdt(t));   // vdt: 时停下只有观战者座驾推进 (2026-09-27I)
// 观战专属载具「幽灵坦克」(15c-specveh): 独立于 tanks 表, 自带行驶/炮塔/引擎更新
// (typeof 守卫: 只加载部分脚本的沙箱/探针没有这个文件, 不能因为一个可选模块把主循环带崩)
// 幽灵坦克恒由观战者驾驶 ⇒ 时停下它也跟本体同速 (vdt 里的 specRide 自动覆盖, 不需要点名 kind)
if(typeof updateSpecVeh==='function') updateSpecVeh(vdt(typeof SPECVEH!=='undefined'?SPECVEH:null));
// 海战载具 (2026-09-20N 海战批, 15d-naval): 水面/两栖载具的行驶、四档物理(吃水/浮态/浪涌/搁浅)、
// 进水沉没与乘员落水、鱼雷在途。放在炮弹判定管线 (updateShells) 之前 —— 命中管线要拿到当帧位置。
// 第二个实参 = 观战者座驾帧长 (2026-09-27I): 时停下整片海战场静止, 只有你在开的那条艇跟着你走。
if(typeof updateNaval==='function') updateNaval(dt,pdt);
// (2026-11-10: 大舰 updateCapital tick 随大舰子系统下架摘除)
// 反舰炮位 (15f-battery): 海面索敌/提前量/弹药节奏; 与 atGun 的陆战更新相互独立 (用户裁定"1+3")
if(typeof updateBatteries==='function') updateBatteries(dt);
for(const pl of planes) pl.update(vdt(pl));
updatePlaneCollisions(dt); // 空中撞机 (2026-11-10 三虫批③): 全体位姿推进完再判机-机实体碰撞 (die crash 档双机同毁); dt<=0=时停/布势冻结不判
updateTrucks(dt); // 劫道车队: 在炮弹判定前推进, 命中管线拿到当帧位置
updateMineTriggers(dt); // 反坦克雷: 车辆碾压触发 + 链爆账消费 (15-vehicles, 草原雷区; ★2026-11-01 判定批: 链爆改挂世界帧长, 时停/暂停不再照爆)
updateSupplyPoints(dt); // 劫道方临时补给点: 限时失效
// 火焰蔓延/树木燃烧倒伏/倒伏动画 (04b-fire)
updateFires(dt);
updateTreeBursts(dt); // 环境炮击: 许特根树爆(空爆) / 草原炮火犁地(贴地+点麦田) (04b-fire)
updateWindRotors(dt); // 草原风车磨坊风叶慢转 (05a, 纯视觉)
updateFallingTrees(dt);
updateBurningTrees(dt);
if(typeof ACH!=='undefined'&&ACH.update) ACH.update(dt); // 成就轮询账 (2026-11-11 成就批): 0.5s 低频按普查账复核, dt<=0 (时停/布势冻结) 不评
updatePlaneWrecks(dt);
updateWreckSinks(dt); // 被毁模型(载具/草木/房屋)残骸: 停留→沉入→删除 (08-effects)
updateRagdolls(dt);
// 弹丸/寿命类系统一并拿到真实帧长 rdt (2026-09-27M 时停修复批): 各系统内部按**投射物归属**逐条解析
// (单源 = 22b 的 specTimeShotDt, 判据 shooter.isPlayer) —— 时停下 AI 的弹丸随战场整发冻住 (不动/不过期/
// 也不判定: 旧版"静止的炮弹仍以 0.5m 前瞻重跑命中"会把附近的人隔空引爆, 审计 P0-1), 观察者自己打出的
// 照飞照回收 (否则"能开火、打出的东西冻在枪口", 且寿命判据永不满足 ⇒ 对象无上限增长, 审计 P0-2/P1-3)。
// 第二实参只影响时停帧: 非时停 rdt≡dt ⇒ 普通战斗逐位不变。
updateShells(dt,rdt);
updateFlak(dt,rdt);
updateNades(dt,rdt);
updateLoiters(dt,rdt);
updateParticles(dt);   // 粒子仍走世界帧长: 冻结点上炸开的火焰/尘土就该定格在那里 (池上限 280, 有界)
updateTracers(dt,rdt);
updateCasings(dt,rdt);
updateFlags(dt);
updateSpots(dt); // 遭遇战强点占领 (21-match, 草原库尔斯克改版)
// 观战信息层 (2026-09-26H 观战批, 审计 B6): 头顶名牌 (名字·队属·血量·状态) + 交火指向线。
// 放在单位更新**之后** (读当帧位置/目标), HUD 之前 (与 22-hud 的 DOM 层互不干扰); 非观战态内部直接空转早退。
// 帧长跟本体 (pdt): 时停下你仍在走动/飞行, 名牌的远近取舍与 4Hz 重绘要跟着你走 (2026-09-27I)。
if(typeof updateSpecLayer==='function') updateSpecLayer(pdt);
if(flashTimer>0){ flashTimer-=dt; if(flashTimer<=0) flashLight.intensity=0; }
if((player.alive||player.specViewHost)&&player.curW&&!player.onMG&&!player.onVehicle&&!player.onNaval&&!player.onAT&&!player.onAA&&!player.onMortar&&!player.onBattery&&!player.loiter){   // 2026-09-26E 审计 5: 艇上不跑步兵视模型 (会把海战 fov/炮手镜拉回 74); ★2026-11-03: 真附身 (specViewHost) 也跑 —— 视模式附身的换弹/举雷/包扎/开火反馈镜像 (20-player svHostActionMirror); 2026-11-10 capitalGun 支摘除
updateViewModel(pdt,player);
// 第三人称视场过渡 (2026-09-20 第三人称批): updateViewModel 每帧按第一人称档 (74/开镜档) 写 camera.fov,
// 而 updateCamera 在它**之前**跑 —— 第三人称视场只能在其后补一次, 否则两边互相拉扯 (见 20-player thirdPersonFovTick)。
if(typeof thirdPersonFovTick==='function') thirdPersonFovTick(pdt);
} else if(player.alive&&!player.loiter&&(player.onMG||player.onAT||player.onAA||player.onBattery)){
camera.fov=dampF(camera.fov,74,10,pdt);   // 视角链跟本体同速 (时停下开镜/离镜照常, 2026-09-27I)
camera.updateProjectionMatrix();
}
player.mouseDX*=Math.pow(0.0001,pdt*3);
player.mouseDY*=Math.pow(0.0001,pdt*3);
updateHUD(dt,pdt);   // 第二实参 = 观察者帧长 (2026-11-08 时停HUD批): 低频HUD段 (hudSlowT 10Hz 节流) 吃它 —— 旧版只传世界 dt, 时停下 dt=0 ⇒ 小地图/罗盘/顶栏在时停里彻底停绘, 而观察者本人还在走动/飞行 (2026-09-27 裁定"冻战场不冻观察者"的 HUD 侧推论)。非时停 pdt≡dt ⇒ 零漂移。
if(typeof specViewHudTick==='function') specViewHudTick();   // 自由观战视模式 HUD (2026-11-01): 战斗 HUD 收起+附身指示器, 与 updateHUD 同频
if(typeof cmdFrameTick==='function') cmdFrameTick(rdt);   // 指挥官层帧 tick (26-commander): 读条收支+减速态+指挥地图重绘 (真实帧长, UI 不吃减速 D4)
if(typeof shadowRefreshTick==='function') shadowRefreshTick(); // 阴影半频刷新 (2026-10-24 性能批, q0/q1 30Hz)
renderer.clear();
renderer.render(scene,camera);
if(player.alive&&!player.onMG&&VM.root.visible){
if(!(typeof thirdPersonOn==='function'&&thirdPersonOn())){ // 第三人称: 不叠渲染视角武器模型 (2026-09-20 第三人称批)
renderer.clearDepth();
renderer.render(vmScene,vmCamera);
}
}
if(!player.alive&&player.deployed&&!matchOver){
respawnCd=Math.max(0,respawnCd-dt);
el('respawnTxt').textContent=respawnCd>0?`(${Math.ceil(respawnCd)})`:'';
const btn=el('deployBtn');
// ★2026-11-01 逐帧保活: 票尽未开调试观战 ⇒ 按钮恒可用且标签是「观 战」(与 23-deploy showDeploy 同一套
// 换字代码 —— 部署页每 0.5s 才重刷, 而票数在页开着时也可能归零, 这条保证按钮态即时跟随)。
if(tickets[player.team]<=0&&!player.specWillBe()){
btn.disabled=false;
const _sp=btn.querySelector('[data-i18n]');
if(_sp&&typeof _sp.getAttribute==='function'&&_sp.getAttribute('data-i18n')!=='观 战'){ _sp.setAttribute('data-i18n','观 战'); _sp.textContent=t('观 战'); }
}else{
btn.disabled=respawnCd>0; // 己方兵力归零后按钮保持禁用 (2026-09-04); 观战开关开着放行 (2026-10-30, specWillBe 单源见 18-game)
const _sp=btn.querySelector('[data-i18n]');
if(_sp&&typeof _sp.getAttribute==='function'&&_sp.getAttribute('data-i18n')!=='部 署'){ _sp.setAttribute('data-i18n','部 署'); _sp.textContent=t('部 署'); }   // 调试观战中途打开 ⇒ 标签从「观 战」还原「部 署」
}
}
// 部署界面打开期间(死亡等待/存活按Esc查看): 载具重生冷却/占用状态/旗点归属实时刷新 (0.5s 一次),
// 冷却走完的载具按钮即刻亮起可选 (2026-09-01 用户指定)
if(player.deployed&&!matchOver&&!el('deploy').classList.contains('hidden')){
deployRefreshT-=dt;
if(deployRefreshT<=0){
deployRefreshT=0.5;
refreshDeployList();
if(!player.alive) drawDeployMap();
}
}
}
// ===== 移动端触控输入 =====
function applyTouchScale(){
if(!MOBILE) return;
const k=(parseInt(localStorage.getItem('sf_tsize')||'100'))/100;
document.querySelectorAll('#touchUI .tbtn').forEach(b=>{ b.style.transform='scale('+k+')'; });
const st=el('tStick');
if(st){ st.style.width=(120*k)+'px'; st.style.height=(120*k)+'px'; }
}
if(MOBILE){
document.body.classList.add('mobile');
const stick={id:-1,cx:0,cy:0};
const look={id:-1,lx:0,ly:0};
const stickEl=el('tStick'), knob=el('tKnob');
let sprintLock=false;
const setMove=(dx,dy)=>{
const max=52;
const r=Math.hypot(dx,dy);
const cl=Math.min(r,max);
const nx=r>1e-3?dx/r:0, ny=r>1e-3?dy/r:0;
knob.style.transform=`translate(${nx*cl}px,${ny*cl}px)`;
const fx=dx/max, fy=dy/max;
keys.KeyW=fy<-0.32; keys.KeyS=fy>0.32;
keys.KeyA=fx<-0.32; keys.KeyD=fx>0.32;
keys.ShiftLeft=sprintLock||(r>max*1.05&&fy<-0.55);
};
const resetMove=()=>{
knob.style.transform='translate(0px,0px)';
keys.KeyW=keys.KeyS=keys.KeyA=keys.KeyD=false;
keys.ShiftLeft=sprintLock;
};
const homeStick=()=>{ stickEl.style.left='40px'; stickEl.style.top=(innerHeight-180)+'px'; };
document.addEventListener('touchstart',e=>{
AudioSys.resume();
// ★2026-09-28C 触控审计: 旧门只看 pointerLocked —— 移动端它一锁就**永真** (lockPointer 直接置位),
// 于是打过一局回主菜单/暂停后摇杆仍在捕获触摸。补 alive+deployed: 未部署/阵亡/菜单期一概不捕获,
// 面板的滚动与设置滑条交还原生手势 (preventDefault 也只在捕获了触摸的帧才做, 见 touchmove)。
if(!pointerLocked||!player.alive||!player.deployed) return;
for(const t of e.changedTouches){
const x=t.clientX,y=t.clientY;
if(t.target&&t.target.closest&&(t.target.closest('.tbtn')||t.target.closest('.screen'))) continue;
if(x<innerWidth*0.42&&y>innerHeight*0.4&&stick.id===-1){
stick.id=t.identifier; stick.cx=x; stick.cy=y;
stickEl.style.left=(x-60)+'px'; stickEl.style.top=(y-60)+'px';
} else if(look.id===-1){
look.id=t.identifier; look.lx=x; look.ly=y;
}
}
if(e.target===renderer.domElement&&e.cancelable) e.preventDefault();
},{passive:false});
document.addEventListener('touchmove',e=>{
if(!pointerLocked||!player.alive||!player.deployed) return;
let owned=false;
for(const t of e.changedTouches){
if(t.identifier===stick.id){
owned=true;
setMove(t.clientX-stick.cx,t.clientY-stick.cy);
} else if(t.identifier===look.id){
owned=true;
const dx=t.clientX-look.lx, dy=t.clientY-look.ly;
look.lx=t.clientX; look.ly=t.clientY;
player.mouseDX=dx*2.2; player.mouseDY=dy*2.2;
// ★2026-09-28C 触控审计 (与 19-input mousemove 的 2026-09-28B 重做同一单源): TV 制导期间触屏增量
// 只记账进 tvDX/tvDY (13-combat.updateLoiters 消费) —— 旧版触屏写的是**本体** yaw/pitch, 而制导中
// 弹体每帧把本体角改写回 d.yaw ⇒ 触屏操控巡飞弹 = 输入完全无效。
if(player.loiter){
player.tvDX+=dx; player.tvDY+=dy;
}else{
const s=0.0052*SETTINGS.sens*lookZoomMul();   // 19-input 单源乘数: 开镜按武器 adsFov 收窄 · 艇上炮手镜 0.40
player.yaw-=dx*s;
player.pitch-=dy*s;
player.pitch=clamp(player.pitch,-1.45,1.45);
}
}
}
// 只拦"我捕获的"触摸: 旧版无条件 preventDefault + pointerLocked 移动端恒真 ⇒ 打过一局后,
// 部署面板/战绩面板的滚动与设置滑条全被吞掉 (本条即用户可感的"菜单卡死")。
if(owned&&e.cancelable) e.preventDefault();
},{passive:false});
const endTouch=e=>{
for(const t of e.changedTouches){
if(t.identifier===stick.id){ stick.id=-1; resetMove(); homeStick(); }
if(t.identifier===look.id){ look.id=-1; }
}
};
document.addEventListener('touchend',endTouch);
document.addEventListener('touchcancel',endTouch);
const bindBtn=(id,down,up)=>{
const b=el(id);
if(!b) return; // 缺键守卫: 触控键表与 index.html 是两个文件, 少一个不该让整段触控初始化抛错
const dn=e=>{ e.preventDefault(); e.stopPropagation(); AudioSys.resume(); down&&down(); };
const fin=e=>{ e.preventDefault(); e.stopPropagation(); up&&up(); };
b.addEventListener('touchstart',dn,{passive:false});
b.addEventListener('touchend',fin,{passive:false});
// ★2026-09-28C 触控审计: 系统手势打断 (iOS 边缘滑入/来电等) 走 touchcancel 而不是 touchend ——
// 旧版只听 end, 开火/开镜/疾跑会卡死在按下态 (松不开的扳机)。cancel 与 end 走同一 fin。
b.addEventListener('touchcancel',fin,{passive:false});
};
const kd=c=>dispatchEvent(new KeyboardEvent('keydown',{code:c}));
const ku=c=>dispatchEvent(new KeyboardEvent('keyup',{code:c}));
bindBtn('tFire',()=>{ mouseDown=true; },()=>{ mouseDown=false; });
bindBtn('tFire2',()=>{ mouseDown=true; },()=>{ mouseDown=false; });
bindBtn('tAds',()=>{
mouse2Down=true;
if(player.alive&&!player.loiter&&!player.onMG&&!player.onVehicle&&!player.onNaval&&!player.onAT&&!player.onAA&&!player.onMortar&&!player.onBattery&&!player.specViewHost) player.ads=true;   // 2026-09-26E 审计 6: 触控 ADS 同门; 2026-09-28C 补岸防炮位; 2026-11-02 附身中不进 (借眼只读, 与键鼠/手柄同门); 2026-11-06 飞行瞄准批: 去 !player.flying (两种观战飞行中瞄准钮=ADS, 同键鼠)
},()=>{ mouse2Down=false; player.ads=false; });
bindBtn('tJump',()=>kd('Space'),()=>ku('Space'));   // 2026-09-28C: 改走 kd/ku 与键盘同链 —— 旧版直写 keys.Space, 绕过了 keydown 处理器 ⇒ 观战"双击空格=悬停飞行"在触屏永远不可达
bindBtn('tCrouch',()=>kd('KeyC'),()=>ku('KeyC'));
bindBtn('tProne',()=>kd('KeyZ'),()=>ku('KeyZ'));
bindBtn('tReload',()=>kd('KeyR'),()=>ku('KeyR'));
bindBtn('tNade',()=>kd('KeyG'),()=>ku('KeyG'));
bindBtn('tHeal',()=>kd('KeyH'),()=>ku('KeyH'));
bindBtn('tUse',()=>kd('KeyF'),()=>ku('KeyF'));
bindBtn('tSwap',()=>{ kd(player.curSlot===0?'Digit2':'Digit1'); },()=>{ ku('Digit1'); ku('Digit2'); });
bindBtn('tSprint',()=>{
sprintLock=!sprintLock;
keys.ShiftLeft=sprintLock;
el('tSprint').classList.toggle('on',sprintLock);
},null);
bindBtn('tSkill',()=>kd('KeyB'),()=>ku('KeyB'));
bindBtn('tBuild5',()=>kd('Digit5'),()=>ku('Digit5'));
bindBtn('tMortar',()=>kd('Digit6'),()=>ku('Digit6'));
bindBtn('tMelee',()=>kd('KeyN'),()=>ku('KeyN'));   // 2026-10-26 交互重做批: 近战键 V→N (V 让给减速)
	bindBtn('tSmoke',()=>kd('Digit4'),()=>ku('Digit4'));
	bindBtn('tIncin',()=>kd('Digit6'),()=>ku('Digit6'));
	bindBtn('tATN',()=>kd('Digit3'),()=>ku('Digit3'));
bindBtn('tSquad',()=>kd('KeyT'),()=>ku('KeyT'));
// ── 指挥官触控键 (2026-10-26 排查轮二审 修复 B-8: 移动端没有任何开图/减速入口) ──
// tCmdMap: 点按 = 开/关指挥地图。走 cmdMapToggle 单源 (姿态门 D18/布势 D21/暂停 D20 全在它内部把关),
//   而不是派发 contextmenu —— 触屏没有右键, 且 cmdMapToggle 的布势首分支语义 (跳过布势=确认开战) 只有
//   直调才能拿到。桌面端这两个键在 body.mobile 之外不可见 (css #touchUI 门), 零回归。
// tSlow: **按住**减速 (与键盘 N 同一条 keys[CMD_TIME.KEY] 消费链) —— 旧版移动端连减速都没有入口。
bindBtn('tCmdMap',()=>{
if(typeof cmdMapToggle==='function') cmdMapToggle();
},null);
bindBtn('tSlow',()=>{
if(typeof CMD_TIME!=='undefined') keys[CMD_TIME.KEY]=true;
},()=>{
if(typeof CMD_TIME!=='undefined') keys[CMD_TIME.KEY]=false;
});
bindBtn('tFollow',()=>kd('KeyY'),()=>ku('KeyY'));
// 第三人称触控入口 (2026-09-20 三人称批): 移动端没有 KeyU, 触控键**直调**切换单源 toggleThirdPerson (19-input),
// 而不是像其它键那样派发 KeyboardEvent —— 派发会被 `!pointerLocked` 闸门挡住 (触屏无 Pointer Lock),
// 且在 iOS 上 KeyboardEvent 构造器不接受 code。直调既避开这两个坑, 又保证与键盘 U 是同一份逻辑。
bindBtn('tView',()=>{ if(typeof toggleThirdPerson==='function') toggleThirdPerson(); },null);
bindBtn('tScore',()=>{
const sb=el('scoreboard');
const on=sb.style.display!=='block';
sb.style.display=on?'block':'none';
if(on) updateScoreboard();
},null);
bindBtn('tMenu',()=>{
if(player.deployed&&!matchOver){
if(typeof togglePause==='function') togglePause(true);
}
},null);
// 按兵种/装备动态显示技能按键
window.updateTouchVis=function(){
const base=player.alive&&player.deployed;
const noMount=!player.onVehicle&&!player.onMG&&!player.onAT&&!player.onAA&&!player.onMortar;
const show=(id,on)=>{ const b=el(id); if(b&&b.style.display!==(on?'flex':'none')) b.style.display=on?'flex':'none'; };
show('tSkill',base&&noMount&&player.cls===4);
// 技能键文案 (2026-09-28C 触控审计): 旧版每帧无条件写中文 textContent —— ① EN 界面残留中文;
// ② 每帧 DOM 写入无谓触发样式失效。改为"变了才写 + t2 查表" (2026-09-28 兵种 8→5: 工程兵 tSkill=建造,
// 迫击炮单独走 tMortar 键; 原 医疗箱/迫击炮(cls6) 文案随兵种合并退场)。
const skb=el('tSkill');
if(skb){
const sk='建造';
if(skb._i18nK!==sk){ skb._i18nK=sk; skb.textContent=t2(sk); }
}
show('tBuild5',base&&noMount&&player.cls===4);
show('tMortar',base&&noMount&&player.cls===4);
show('tMelee',base&&noMount);
	show('tSmoke',base&&noMount&&(player.smokeCount||0)>0);
	show('tIncin',base&&noMount&&(player.incinCount||0)>0);
	show('tATN',base&&noMount&&(player.atNades||0)>0);
show('tSquad',base);
show('tFollow',base);
// 第三人称键只在"步战"下有意义 (载具/巡飞弹/跳伞/游泳各有自己的视角键, 见 20-player thirdPersonOn),
// 所以与 tMelee 同口径: 已落地且未上任何载具/阵位时才出现 —— 避免移动端给了按钮却按了没反应。
show('tView',base&&noMount);
// 指挥官两键 (2026-10-26 排查轮二审): 只在"本局是指挥官"时出现 —— 普通兵种看到这两个键按了也没反应,
// 属于同一纪律 (tView/tMelee 的注释: 避免移动端给了按钮却按了没反应)。
// cmdIsCommander 自带 typeof/CLASSES 守卫, 22-hud 缺 cmdIsCommander 的极端沙箱里 show 恒 false。
show('tCmdMap',base&&(typeof cmdIsCommander==='function')&&cmdIsCommander());
show('tSlow',base&&(typeof cmdIsCommander==='function')&&cmdIsCommander());
};
resetMove();
homeStick();
applyTouchScale();
addEventListener('resize',homeStick);
}

applyQuality();
// 本页"已开过局"标记的起点 (2026-09-16 本批): 每次真正加载页面都从零开始 ——
// 该标记 (由 23-deploy startMatch 末尾置位) 是"本页世界里已经有对局实体"的唯一判据, 就地换局时据此决定要不要先让旧实体退场。
window.__sfMatchSpawned=false;
document.body.classList.add('inMenu'); // 菜单/结算期间隐藏战斗 HUD (航拍动态不叠游戏 UI)
// 世界开局快照 (2026-09-17 世界还原批, 见 23b-worldrestore): 此刻世界已构建完毕、还没有任何一局开过 ——
// 就地重开 (beginFreshMatch) 与"结算后回主菜单"都按这张快照把世界复原成干净地图。
// 位置必须在 initMenuUI/loop 之前: 首屏若走自动开局路径, 快照要先落地。
// 深度分层 · 共面冲突消解 (2026-09-27, 唯一调用点): 必须在**全部脚本的构建期代码跑完之后** ——
// 05c buildWorld 之后还有 15f 反舰炮台的胸墙/座圈/护板、17 固定炮位的座盘与护盾、16 的坠机残骸等
// 世界级构建者会往 world 里放贴地大件, 它们同样会与既有件共面。本行放在本条脚本链的最末尾 (24 是最后一个文件),
// 一次扫描覆盖全场 (莫斯科 8711 件 ≈700ms, 一次性; ?nosurf=1 可关)。函数本身可重复调用 (幂等), 见 05-world。
// 破坏机制批 (2026-09-27N) 的两个构建期末尾单点后处理 —— 都必须在**全部构建者跑完之后**、快照之前:
//   ① scaleStructHP: 血量按组规模归一 (B1) —— 各建筑是先 dEnd 再写 g.hp 的, 只能在这里统一缩放;
//   ② markPermPieces: "打不烂的件"统一材质档 (B5) —— 需要 BOXES 全部落定 (含 15f/17 的工事件)。
// 顺序: 先血量/材质, 再共面消解 —— 消解器按材质池化克隆, 让它看见最终的材质身份。
if(typeof scaleStructHP==='function'){
const _n=scaleStructHP();
const _p=markPermPieces();
if(typeof console!=='undefined'&&console.log) console.log('[破坏] 结构血量归一: '+_n+' 组 (名→实 见 STRUCT_HP) · 永久件标记: '+_p+' 件 (B5 提亮已按 2026-09-28 用户裁定取消, D3)');
}
if(typeof resolveCoplanarConflicts==='function') resolveCoplanarConflicts();
// (2026-11-10: 大舰编制载入期生成 capitalSpawnOrbat 随大舰子系统下架摘除)
if(typeof capturePristineWorld==='function') capturePristineWorld();
// 启动末尾的状态机权威 (2026-09-13): 菜单期必须隐藏战斗 HUD —— 不依赖"标记上的类没被动过"这一假设。
// 走完整条脚本链后复核一次: 若此刻不在战斗/部署中却缺 inMenu, 就地补挂; 并检测"页面上存在多个 #ui"
// (内容被粘过两次 / 打开的是拼接过副本时会出现第二份 HUD, 那一份不在 CSS `body.inMenu #ui` 的覆盖内)。
// 正常路径零副作用, 只在必要时写 DOM; 有修正时在控制台留一条可复制的诊断行。
// ★2026-10-07b 修 (实机"丧尸局无UI"根因): 本块原来跑在 initMenuUI **之后** —— 迷你游戏直达路径
//   (sf_mzstart) 的 startGame() 在 initMenuUI 里执行并已摘掉 inMenu, 此处复核条件
//   `!inMenu && !player.deployed && !matchOver` 成立 ⇒ 把刚摘掉的战斗 HUD (含部署界面, 都在 #ui 里)
//   又盖了回去, 玩家面对裸世界。复核必须先于 initMenuUI: 自动开局路径可能在其中摘 inMenu。
{
const uis=document.querySelectorAll('#ui');
if(!document.body.classList.contains('inMenu')&&!player.deployed&&!matchOver){
document.body.classList.add('inMenu');
window.__sfHudRepaired=true;
}
if(uis.length!==1||window.__sfHudRepaired){
console.warn('[HUD] 菜单期隐藏自检: #ui 节点数='+uis.length+', body.class="'+document.body.className+'"'
+(window.__sfHudRepaired?', 已就地补挂 inMenu':''));
}
}
initMenuUI();
// 说明 (2026-09-13 修刷新闪 UI): 战斗 HUD 的隐藏由标记本身承担 —— index.html 的 <body class="inMenu">,
// 浏览器解析到 <body> 第一个元素起 #ui 就不进渲染树 (不是"先画出来再藏"); 本文件在脚本链末尾才执行,
// 若只在这里挂 class, 前面已解析的 #ui (弹药/血条/小地图/罗盘/记分板) 会先画一帧再消失。
// 此处保留为保持语句 (两条路径结果一致, 切面板/结算复用同一个类)。
loop();
window.__sfBooted=true; // 供 index.html 末尾兜底判断: 主脚本链正常跑完 (未置位=中途抛错, 解除首屏隐藏让报错可见)
// ★2026-10-07c 修 (实机"随机图整场无HUD"根因): 本文件尾部原有一份**同样的复核块**没随 2026-10-07b
//   的搬家一起删掉 —— 迷你大厅直达路径 (sf_mzstart → initMenuUI 内 startGame) 已摘掉 inMenu 打开部署页,
//   尾块在其后照跑, `!inMenu && !player.deployed && !matchOver` 成立 (此刻人还在部署页, 未落地) ⇒ 把
//   inMenu 又盖了回去。部署页 (.screen, 在 #ui 外) 照样可见能开打, 但 #ui 里的整套战斗 HUD 被
//   `body.inMenu #ui` 压住整局不显示。复核块只保留 initMenuUI **之前**那一份 (见上方 2026-10-07b 注)。
