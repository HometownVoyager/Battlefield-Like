// ─────────────────────────────────────────────
// 23-deploy.js —— 部署界面/开局
// 源: Index.original.html 第 8324-8530 行
// ─────────────────────────────────────────────
// 兵种卡锁定样式刷新 (2026-10-27 需求「确认之后兵种锁定不可更换」) —— 从 showDeploy 里抽成单源函数。
//
// 为什么必须抽出来: 「哪些卡该显示 🔒」这件事现在有两个触发时刻, 而不是一个 ——
//   ① 打开部署页 (showDeploy): 这是老路径, 死亡重生/回菜单再进来都走它;
//   ② 布势里点「确认开战」之后**部署页还开着** (cmdDeployConfirm 只在 dep 是 hidden 时才调 showDeploy):
//      确认那一刻 R10 盖章把 lockedDir 从 null 改成 'in'/'out' (26-commander cmdDeployConfirm 的提交点语义),
//      但部署页没被重建 ⇒ 卡片样式停留在「全部可选」的样子。玩家看得见能点的卡, 点下去却被
//      22-hud 的 cmdClassCardGate 拦下弹「本局已锁定指挥官」—— 「样式说能点、点了说不能」是最典型的
//      反馈与状态不符。旧实现把这段样式逻辑内联在 showDeploy 里, 于是它只有一个触发点, 只能靠
//      「重建整个部署页」才能刷新, 而确认开战这条路径恰恰不重建。
// 单源口径: 判据仍是 cmdClassCardGate (R10 门) + isAliveDeployed/nearCrate (整备门), 这里只负责
// 把判据结果画到 DOM 上; 调用点 = showDeploy (整页重建) 与 22-hud updateHUD 的锁定态对账 (就地刷新)。
function syncClassCardLock(){
// 两个门所需的事实就地取 (本函数要能被 showDeploy 之外的地方单独调用):
// isAliveDeployed = 活着且已落地 (此时兵种卡按「战地整备」口径处理, 需靠近补给箱才可换装);
// nearCrate 取 isNearSupplyCrate 单源 (typeof 守卫: 20-player 未加载的沙箱里退化为 false)。
const isAliveDeployed=!!(typeof player!=='undefined'&&player&&player.alive&&player.deployed);
const nearCrate=isAliveDeployed&&(typeof isNearSupplyCrate==='function')&&!!isNearSupplyCrate(player.pos);
for(let i=0;i<CLASSES.length;i++){
const card=document.querySelectorAll('.classCard')[i];
if(!card) continue;
let lockIcon = card.querySelector('.lock-icon');
if(!lockIcon){
lockIcon = document.createElement('span');
lockIcon.className = 'lock-icon';
lockIcon.style.cssText = 'position:absolute;top:4px;right:6px;font-size:14px;';
lockIcon.textContent = '🔒';
card.style.position = 'relative';
card.appendChild(lockIcon);
}
// R10 双向锁 (2026-10-26 指挥官批): 指挥官位仅局内首次部署可选, 此后按方向禁选 —— 与 22-hud
// 卡片 onclick 的 cmdClassCardGate 同一单源 ('in'=已锁指挥官全卡锁 / 'out'=指挥官卡锁)。
const cmdLocked=(typeof cmdClassCardGate==='function')?cmdClassCardGate(i):null;
if((isAliveDeployed && !nearCrate)||cmdLocked){
card.classList.add('locked');
card.style.opacity = '0.5';
card.style.cursor = 'not-allowed';
lockIcon.style.display = 'inline';
card.setAttribute('title', cmdLocked?('指挥官: '+cmdLocked):'[战地整备受限: 需在友方补给箱 2.8m 内方可调配装备]');
} else {
card.classList.remove('locked');
card.style.opacity = '1';
card.style.cursor = 'pointer';
lockIcon.style.display = 'none';
card.removeAttribute('title');
}
}
}
'use strict';
// 兵种卡武器行文本 (2026-09-17 观战扩展批: 由 showDeploy 内联抽成单源) —— 供部署界面渲染与
// "在兵种卡上开/关观战"时即时刷新共用: 武器列表一律走 playerClassWeapons (实验模式换巡飞弹兵 +
// 观战模式副武器换连狙两条规则都在这条单源里生效, 卡片显示与实际配枪永远一致)。
function classCardWeaponText(i){
const ws=playerClassWeapons(player.team,i);
let d2=ws.map(k=>t(WPN_DEFS[k].name)).join(' · ');
if(player.spectator) return d2+' · '+t('手雷[G]×{0}',4)+' · '+t('AT雷[3]×{0}',4)+' · '+t('烟雾弹[4]×{0}',4)+' · '+t('燃烧弹[6]×{0}',4); // 观战: 四弹种全给 (2026-10-24, 卡片显示与 specGear 落装一致)
if(i===1){ const g=clsGear(i,player.team); d2+=' · '+t('AT雷[3]×{0}',g.atn)+' · '+t('燃烧弹[6]×{0}',(CLASSES[i].incin||0)); } // 2026-09-28 兵种8→5: 突击兵=原cls2 配置随合并迁到 cls1
if(i===5){ const g=clsGear(i,player.team); d2+=' · '+t('AT雷[3]×{0}',g.atn)+' · '+t('燃烧弹[6]×{0}',(CLASSES[i].incin||0)); } // 指挥官 (2026-10-26): 绷带/手雷配置同突击兵 (设计 R2)
if(i===0) d2+=' · '+t('AT雷[3]×{0}',clsGear(i,player.team).atn); // 2026-10-05: 步枪兵新增 AT雷×2 (键位同突击兵的 3)
if(i===3) d2+=EXPERIMENT?' · '+t('燃烧弹[6]×2'):' · '+t('AT雷×{0}',(TEAM_FACTION[player.team].atn5||3));
return d2;
}
// ★2026-11-04b 部署记忆批 —— 兵种卡选择态 DOM 单源对账 (showDeploy 每次打开页面都调一次):
//   卡面 (.sel 高亮 / 调试卡的 .spec 金边与「调试中·待生效」后缀 / 武器行文本) 在 initMenuUI 里建一次就
//   不再与状态对账 ⇒ 上一局选过的兵种/调试开关会整块留到下一局的部署页 (用户实报"点进去选的就是调试模式")。
//   这里以 player.cls / player.spectator / player.specWant 为唯一事实重刷一遍; 沙箱空 DOM
//   (querySelectorAll 返 []) 自动空转, 与 syncClassCardLock 同款防护。
function syncDeploySelectionDOM(){
const cards=document.querySelectorAll('.classCard');
if(!cards||!cards.length) return;
for(let i=0;i<cards.length;i++){
const card=cards[i]; if(!card) continue;
card.classList.toggle('sel',i===player.cls);
card.classList.remove('spec');
if(card.style) card.style.outline='';
const cn=card.querySelector?card.querySelector('.cname'):null;
if(i===3&&typeof EXPERIMENT!=='undefined'&&EXPERIMENT){
const pend=(typeof player.specWant==='boolean');
card.classList.toggle('spec',!!(player.spectator||pend));
if(card.style) card.style.outline=(player.spectator||pend)?'2px solid #ffd76b':'';
if(cn) cn.textContent=t2('巡飞弹兵')+(player.spectator?t2(' · 调试中'):(pend?t2(' · 调试待生效'):''));   // ★2026-11-17 批1: 状态刷新路径也走翻译
}else if(cn&&typeof t2==='function'&&typeof CLASSES!=='undefined'&&CLASSES[i]){
cn.textContent=t2(CLASSES[i].name);
}
const cw=el('cw'+i); if(cw) cw.textContent=classCardWeaponText(i);
}
}
function showDeploy(isDead){
if(typeof killcamEnd==='function') killcamEnd(); // 死亡时视角=击杀者: killcam 随部署页一次收账 (2026-11-12 批, 相机账/画布滤镜/角标) —— 部署页本身不受该设置影响
// ★2026-11-04b 部署记忆批: 每次打开页面先按**当前状态**单源重刷卡面 —— 上一局残留的 .sel 高亮 /
//   调试卡金边「调试中」后缀 / 武器行文本都是开局建一次就再也不对账的 DOM, 会一直留到下一局部署页。
//   状态变量 (player.cls/selectedSpawn) 只在**新对局**由 22-hud resetPlayerForNewMatch 清回默认 ——
//   这里不能顺手清: 指挥官点卡→布势图→Esc 收图回部署页 这条链还会再进 showDeploy, 清掉等于把玩家
//   这一屏刚选的兵种抹成步枪兵; R10 盖章后 (整局锁兵种) 同样不许改。
if(typeof syncDeploySelectionDOM==='function') syncDeploySelectionDOM();
document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden'));
el('deploy').classList.remove('hidden');
if(typeof gamePaused!=='undefined'&&gamePaused){
  const ov=document.getElementById('pauseOv');
  if(ov) ov.classList.remove('hidden');
}
el('blackOv').style.opacity=0;
if(document.pointerLockElement) document.exitPointerLock();
const isAliveDeployed = !!(player.alive && player.deployed && !isDead);
const nearCrate = isAliveDeployed && (typeof isNearSupplyCrate==='function' && isNearSupplyCrate(player.pos));
let depotBadge = el('depotBadge');
if(!depotBadge){
depotBadge = document.createElement('div');
depotBadge.id = 'depotBadge';
const pnl = el('deploy') ? el('deploy').querySelector('.panel') : null;
if(pnl) pnl.insertBefore(depotBadge, el('deathInfo'));
}
if(depotBadge){
if(isAliveDeployed && !nearCrate){
depotBadge.style.display = 'block';
depotBadge.style.cssText = 'color:#ff9c8a;font-size:14px;margin-bottom:8px;font-weight:bold;text-align:center;';
depotBadge.textContent = '[战地整备受限: 需在友方补给箱 2.8m 内方可调配装备]';
} else if(isAliveDeployed && nearCrate){
depotBadge.style.display = 'block';
depotBadge.style.cssText = 'color:#ffd76b;font-size:14px;margin-bottom:8px;font-weight:bold;text-align:center;';
depotBadge.textContent = '[补给站整备中 - 换装立即生效]';
} else {
depotBadge.style.display = 'none';
}
}
CLASSES.forEach((c,i)=>{
// ★2026-10-26 排查轮 P1 修复: el('cw'+i) 可能为 null —— 丧尸局/海战图按 D3 不建指挥官卡
//   (22-hud 的 class grid 只建 5 张), 而 CLASSES 有 6 行 (index 5 = 指挥官) ⇒ i=5 时 el('cw5') 为 null,
//   旧写直接 .textContent 抛 TypeError, 循环在这里中断 ⇒ 后面的 deathInfo/spawnList/drawDeployMap/
//   syncDeployHud 全不执行, 但 deploy 的 hidden 已在上面摘掉 = **空壳部署页** (看得见、没内容、没出口)。
//   下一行 :53 本来就有 if(card) 守卫, 唯独这一行漏了 —— 补同样的守卫。
const _cw=el('cw'+i); if(_cw) _cw.textContent=classCardWeaponText(i);
});
// 兵种卡锁定样式 (R10 门 + 整备门) —— 单源在 23-deploy syncClassCardLock (见其函数注释)
syncClassCardLock();
el('deathInfo').innerHTML=(()=>{
if(!isDead) return '';
const lifeT=Math.max(0,nowT-(player.lifeStartT||nowT));
const mm2=Math.floor(lifeT/60), ss3=Math.floor(lifeT%60);
const lk=player.lifeKills||0, ls=(player.score||0)-(player.lifeScoreStart||0);
return (player.killerName?t('你被 {0} 击杀了',`<b>${t(player.killerName)}</b>${player.killerSrc?` <span style="font-size:12px;color:#cfd8c2">[${t(player.killerSrc)}]</span>`:''}`)+'<br>':'')+   // ★批1: 击杀者名走词典
`<span style="font-size:13px;color:#cdd8c8">${t('本次存活 {0} · 击杀 {1} · 获得 +{2} 分',mm2+':'+(ss3<10?'0':'')+ss3,lk,ls)} &nbsp;|&nbsp; ${t('本局总计 {0} 杀 / {1} 死 / {2} 分',player.kills,player.deaths,player.score)}</span>`;
})();
if(isAliveDeployed){
el('deployBtn').style.display='none';
el('resumeBtn').style.display='inline-block';
el('resumeBtn').textContent = nearCrate ? '确认换装并返回' : '返 回 战 斗';
} else {
el('deployBtn').style.display='inline-block';
el('resumeBtn').style.display='none';
el('resumeBtn').textContent = '返 回 战 斗';
}
// 己方兵力归零 → 按钮换字「观 战」(2026-11-01 用户裁定): 未开调试观战 ⇒ 点它进自由观战视模式
// (enterSpecView 单源 20-player; 22-hud/24-main 同判据); 开着调试观战 ⇒ 仍显「部 署」, 部署将以
// 观战身份入场 —— 不耗票、不影响清场判定 (specWillBe 单源见 18-game)。
// 两种态按钮都**可用**; 标签交换必须 data-i18n 属性与 textContent 同改, 否则切语言被 applyI18n 盖回。
{
const _exh=tickets[player.team]<=0;
const _specBtn=(_exh&&!player.specWillBe())?'观 战':'部 署';
const _sp=el('deployBtn').querySelector('[data-i18n]');
// getAttribute 守卫: 探针沙箱的桩元素可能给出无 DOM 方法的对象 (真浏览器恒为 Element/null)
if(_sp&&typeof _sp.getAttribute==='function'&&_sp.getAttribute('data-i18n')!==_specBtn){ _sp.setAttribute('data-i18n',_specBtn); _sp.textContent=t(_specBtn); }
el('deployBtn').disabled=false;
}
if(tickets[player.team]<=0){
const _note=player.specWillBe()?'⚠ 己方兵力已耗尽 · 部署将以调试观战身份入场':(player.specView?'⚠ 自由观战中 · 点「观战」返回观战视角':'⚠ 己方兵力已耗尽 · 点「观战」进入自由观战 · 等待清场结算');
el('deathInfo').innerHTML+='<br><span style="font-size:13px;color:#ff9c8a">'+t(_note)+'</span>';
}
const spList=el('spawnList');
const spLabel=spList?spList.previousElementSibling:null;
if(isAliveDeployed){
if(spList) spList.style.display='none';
if(spLabel) spLabel.style.display='none';
}else{
if(spList) spList.style.display='';
if(spLabel) spLabel.style.display='';
buildSpawnList();
}
drawDeployMap();
// 部署界面期隐藏战斗 HUD (2026-09-20 第6条修复): 本函数是"部署界面显示"的唯一入口 (全库只有这里摘 #deploy 的 hidden),
// 所以 inDeploy 的挂载点也收在这里 —— 判据与写 DOM 都走 22-hud 的 syncDeployHud 单源 (完整根因见那里的注释)。
// (typeof 守卫: 部分沙箱/探针只加载子集脚本, 缺 22-hud 时不该让部署界面报错)
if(typeof syncDeployHud==='function') syncDeployHud();
}
// ═══ 布势撤销 (2026-10-27 需求「布势状态允许撤销布局 + 退出并重选兵种」) ═══
// 全局函数名固定为 cmdDeployUndo (26-commander 的布势面板按钮以 typeof 守卫调它, 不反向依赖本文件)。
// 语义 = **这一次布势作废**: 收起布势地图 → 兵种配比复位 → 回到「选兵种」状态 (可重选, 不盖章)。
//
// 为什么这件事不能拆成「关图 + 手写几行状态」散落在调用点: 撤销要同时回收五份账 ——
//   ① 布势地图 (宿主在 body, 必须走 cmdMapClose 才会搬回 #ui 压制网);
//   ② 配比 (cmdRatioAdj/cmdRatioApply 已经把组内 Bot 的 cls **真改了**, 光清 s.ratio 会留下
//      「配比读数=旧分布 / 实际兵种=被改过的」的错位, 面板与战场两头都对不上);
//   ③ 玩家落地态 (player.deployed, 决定部署页显示「部 署」还是「返 回 战 斗」);
//   ④ R10 锁定方向 CMD.lockedDir (撤销 = 这次选择作废, 必须回到 null, 否则玩家被永久锁在指挥官位);
//   ⑤ 部署页本身 (inDeploy 显隐网、出生列表、兵种卡锁定样式)。
// 五份账任何一份漏掉都会留下「半撤销」状态 (最典型: 布势关了、部署页没回来 ⇒ 只剩 3D 画面, 玩家点不到出口)。
// 所以本函数是撤销的**唯一**实现, 按钮只调它。
function cmdDeployUndo(){
// ── ⓪ 边界: 只对「还没落地」的选兵阶段有效 ──
// 落地之后人已经站在战场上, 任何把 player.deployed 打回 false 的路径都会让玩家凭空变成「未落地」
// (部署页弹出来盖住战斗、重生链按"未落地"重算) —— 那不是撤销布势, 那是把战斗中的人踢出战场。
// 正常走不到这里: 撤销按钮只存在于布势面板 (26-commander cmdMapPanelTick 的 CMD.mapDeploy 分支),
// 而布势只在选兵阶段开 (cmdDeployOpen 由兵种卡点击的 !player.deployed 门把关)。这道门是给
// "将来有人把撤销接到别的路径上"兜底的 —— 与本库全量 typeof/门禁守卫同一纪律。
if(typeof player!=='undefined'&&player&&player.deployed) return false;
// ── ① 收起布势地图 ──
// 必须走 cmdMapClose(false) 而不是自己写 CMD.mapOn=false:
//   · close 内部按「当时」的 CMD.mapDeploy 决定是否把 wrap 从 body 搬回 #ui (cmdMapReparent(false)) ——
//     先清标志再收图 = 宿主永久滞留 body, 之后战斗期开指挥地图会绕过 inDeploy/inMenu/hudHide 整张压制网;
//   · relock 传 false: 撤销后玩家仍在**选兵阶段** (人没落地), 不该抢指针锁 (cmdMapClose 的 relock 自带
//     player.alive&&player.deployed 上限, 这里显式传 false 只是把「选兵阶段不锁指针」写成明账)。
if(typeof cmdMapClose==='function'){ cmdMapClose(false); }
if(typeof CMD!=='undefined'){ CMD.mapDeploy=false; }   // close 已清 (兼容只加载子集脚本的沙箱: 缺 26 时至少把本地标志归位)
// ── ② 兵种配比复位成「按当前实际 cls 统计」 ⇒ 本块已整体移到 ④c 私人小队还原之后 (2026-11-14 缩图批集成):
//   cmdSquadRestore 会把收编进编制的私人小队成员还原出去 —— 成员集在 ④c 前后不同, 配比重算必须读
//   **还原后**的成员集, 否则面板配比停在收编前口径 (verify-deployundo ③ 实锤: 重算发生在 5 人口径,
//   还原后 4 人, 缓存与实际脱钩)。完整口径注释随块一起搬走, 见下方 ④c 之后。
// ── ③ 回到「选兵种」状态: 玩家未落地 ──
// deployed=false 是部署页显示「部 署」按钮的判据 (showDeploy 的 isAliveDeployed), 也是
// cmdMapCanOpen / cmdMapMustClose / 兵种卡重进布势门 (player.cls===5&&!player.deployed) 的共同判据。
// alive 保持原值: 撤销发生在布势期 (人根本没落地), 这里不伪造生死 —— 死亡重生期不该被这条路径改活。
if(typeof player!=='undefined'&&player){ player.deployed=false; }
// ── ④ R10 锁定方向复位 ──
// 「in」= 本局已锁指挥官。撤销的语义是「这次选择作废」⇒ 必须回 null, 否则玩家点别的兵种卡会被
// cmdClassCardGate 拦成「本局已锁定指挥官」, 撤销按钮等于没效果。
// ★2026-10-27 (与 26-commander 的确认盖章接线同步): 确认开战 (cmdDeployConfirm) 现在就是 R10 的语义
//   **提交点** —— 它在收图后调 cmdLockStamp(player.cls) 盖 'in'/'out', 于是「确认了就不能再换兵种」
//   在落地之前也成立。代价是撤销这条路径**必须**自己把章撤掉: 不复位的话, 玩家撤销后指挥官卡会被
//   gate(5) 判成「本局未选指挥官」/ 其余卡被判成「本局已锁定指挥官」—— 撤销按钮等于把人锁死在原地。
//   这正是「撤销 = 本次选择作废」的完整语义: 盖章与撤章必须成对出现在同一条链上, 单源只有 CMD.lockedDir。
// 「out」同样归 null (异常路径提前盖了章也属本次作废)。
if(typeof CMD!=='undefined'&&CMD){ CMD.lockedDir=null; CMD.deployTouched=false; }   // ★2026-11-17 批6: 布势动作账随撤销一并作废
// ── ④b 「这次看图」临时账归零 ──
// CMD.hl/sel/cursor/focusFire 是 26-commander 交互重做批新增的**看图期**临时账 (高亮单位 / 点选单位 /
// 鼠标世界坐标 / 集火点)。它们与布势同生共死: 撤销后布势界面没了, 任何一项残留都会带进下一次进图 ——
// 最典型的是 focusFire (带 until 时间戳的集火令), 留着它等于玩家撤销之后还有一份「没人下过」的集火在跑。
// cmdMapClose 只清 pick/sel, 不管 hl/cursor/focusFire, 所以在这里一次清干净 (与 cmdDeployOpen 进图时的
// 归零同源, 见 26-commander cmdDeployOpen 的 CMD.hl=null; CMD.cursor=null; CMD.focusFire=null 一行)。
if(typeof CMD!=='undefined'&&CMD){ CMD.hl=null; CMD.sel=null; CMD.cursor=null; CMD.focusFire=null; }
// ── ④b-2 编制全令归 free (2026-10-27 排查批): 初始令也是布势交付的一部分 ──
// 撤销=这次布势作废: 玩家用 E/F/R 下过的初始令 (hold/attack/strike) 同样属于"这次布局", 不能留着。
// 不清的话最典型的半撤销: 撤销→改选普通兵种 ⇒ 玩家不再是指挥官 (开不了图), 全军却仍按布势期的令
// 行动 —— 一份没人能取消的幽灵令打满整局。单源 cmdOrbatClearOrders (26-commander), 幂等可反复撤销。
if(typeof cmdOrbatClearOrders==='function'){ try{ cmdOrbatClearOrders(); }catch(e){} }
// ── ④c 私人小队还原 (2026-10-26 反馈批, 用户需求 4): 撤销=本次选择作废 —— 若玩家为进布势解散过
//   私人小队 (cmdDeployOpen 的 cmdDisbandPlayerSquad 收编链, 单源见 26-commander), 这里原样还编:
//   出编制、回 SQUAD.members。之后再选其他兵种时 'out' 盖章路径的还原是幂等的 (SQUAD 已有人=零操作)。
if(typeof cmdSquadRestore==='function'){ try{ cmdSquadRestore(); }catch(e){} }
// ── ② 兵种配比复位成「按当前实际 cls 统计」 (2026-11-14 缩图批集成: 自 ④c 之前移到此处 —— 还原会改
//   编制成员集, 配比重算必须读还原后的成员集, 否则面板读数停在收编前口径; verify-deployundo ③ 实锤) ──
// 撤销的语义是「玩家这次调整的期望配比作废」, 而布势里每点一次 ＋/− 都经 cmdRatioApply 真调 setClass 改过
// 组员的 cls (见 26-commander cmdRatioApply) —— 所以「当前实际分布」就是**被撤销的那份期望值**, 直接
// 清空 s.ratio 并不能回到布势前的样子, 只会让下一次 cmdRatioOf 用被改过的分布重建期望值。
// 正确口径: 把配比按撤销后的真实分布重算一份 (cmdRatioOf 的「按实际 cls 统计」分支), 让
// 「期望分布 == 实际分布」重新成立 —— 玩家重新进布势时看到的就是当前战场的真实兵种构成, 从这里再调。
// 注意不做「把 cls 改回布势前」的逆向回放: 撤销的边界是**布局**, 不是「把已经生成好的兵种再掷一次骰子」
// (布势前那份分布本来就只是开局随机池的产物, 没有保存价值, 也没有任何地方记过它)。
if(typeof CMD!=='undefined'&&CMD&&CMD.orbat&&typeof cmdRatioOf==='function'){
try{
for(const s of (CMD.orbat.squads||[])){
if(!s) continue;
s.ratio=null;                     // 清掉缓存 ⇒ cmdRatioOf 下一次按成员当前 cls 重建 (单源统计在 26-commander)
cmdRatioOf(s);                    // 立即重算并写回 s.ratio (面板 2Hz 重建时读的就是这份)
}
}catch(e){}
}
// ── ⑤ 部署页叫回来 + 兵种卡重新可选 ──
// 直接走 showDeploy(false) 单源: 它是「部署界面显示」的唯一入口 (摘 #deploy 的 hidden / 重建出生列表 /
// 画部署图 / 过 cmdClassCardGate 重刷每张卡的 locked 样式 / 挂 inDeploy)。手写 DOM 会漏掉后四项 ——
// 最典型的漏法就是卡片样式还留着 🔒, 玩家看得见卡却以为不能点。
// typeof 守卫: 只加载子集脚本的沙箱 (本文件被单独装载) 里 showDeploy 恒在, 但保留守卫与全文件同规。
if(typeof showDeploy==='function') showDeploy(false);
// 撤销反馈 (与确认开战/选卡同一套点击音, 音高下行走「撤回」语感)
try{ if(typeof AudioSys!=='undefined'&&AudioSys.click){ AudioSys.click(900,0.28,0.05); AudioSys.click(650,0.22,0.07); } }catch(e){}
if(typeof showScorePop==='function') showScorePop(t2('布势已撤销 · 可重新选择兵种'));
return true;
}
// 随车队出生点: 取最靠后的存活车, 沿行进方向的反方向(车尾后方) 9m 解算
function convoyDeployPt(){
let best=null,bu=-1e9;
for(const t of trucks){
if(!t.alive||t.escaped) continue;
const u=t.pos.x; // 车队自东向西: x 越大越靠后
if(u>bu){ bu=u; best=t; }
}
if(best) return {x:best.pos.x-Math.sin(best.yaw)*9,z:best.pos.z-Math.cos(best.yaw)*9};
const escT=CAMPAIGN.convoy&&CAMPAIGN.convoy.escortTeam!==undefined?CAMPAIGN.convoy.escortTeam:1;
const sp=spawnPtsOf(escT);
if(sp.length) return {x:sp[0].x,z:sp[0].z};
return {x:128,z:0};
}
// 部署界面"载具出生项"的统一车表 (2026-09-20N 海战批): buildSpawnList 与 deployPlayer 必须读**同一份顺序**,
// 否则 selectedSpawn 的 'V<序号>' 在两处会指向不同载具 (旧版两行各自手写 [...tanks,...planes], 靠人工保持一致;
// 本批加了第三种载具, 再手写一次就是同步风险) —— 收成一个函数, 顺序定义只有一处。
function deployVehList(team){
const nav=(typeof navalCraft!=='undefined'&&Array.isArray(navalCraft))?navalCraft:[];
return [...tanks,...planes,...nav].filter(v=>v&&v.team===team);
}
function buildSpawnList(){
const list=el('spawnList');
list.innerHTML='';
const opts=[];
// ★2026-10-03 (海战图主基地跟随): 部署交付 (deployPlayer) 用 basePos 单源 —— 纯海图它是**基地舰当前
//   位置**; 本列表旧版写 BASES 静态海点, 按钮坐标与实际落点相差整段航程 (选"主基地"= 落到舰上另一头)。
if(BASES.length){
const bp=basePos(player.team);
opts.push({name:t('主基地'),x:bp.x,z:bp.z,id:-1});
}
// (2026-11-10: 瘫舰甲板旗出生门随大舰子系统下架摘除)
FLAGS.forEach((f,i)=>{ if(f.owner===player.team) opts.push({name:t('{0} 点',f.id),x:f.x,z:f.z,id:i}); });
// 无旗点战役 (遭遇/劫道): 部署选项=本方当前持有的强点 (草原库尔斯克改版: 占领获得出生权, 随战线进退)
(CAMPAIGN.spawns||[]).forEach((sp,si)=>{
const own=(typeof SPOTS!=='undefined'&&SPOTS[si])?SPOTS[si].own:sp.team;
if(own===player.team) opts.push({name:sp.name,x:sp.x,z:sp.z,id:'P'+si});
});
// 劫道模式: 护运方可选随车队出生 (位置在部署瞬间解算: 车队开到哪跟到哪)
if(GAMEMODE==='convoy'&&CAMPAIGN.convoy&&player.team===CAMPAIGN.convoy.escortTeam){
const pt=convoyDeployPt();
opts.push({name:t('随车队'),x:pt.x,z:pt.z,id:'CV'});
}
// 载具出生选项 (重生倒计时按 tankRespawnMul 换算: 苏军厂房在手时实际回场更快)
// 海战载具同表纳入 (2026-09-20N 海战批): 用户要"能开两栖车和炮/鱼雷艇", 而艇停在海上集结点 (离岸数十米) ——
// 只留"游过去按 F"一条路的话, 玩家实际上够不到艇。所以本表把艇/两栖车列为出生项: 选它 = 直接在
// 集结点进驾驶位 (与走近按 F 共用同一份座位初始化 navalBoard, 不是第二条上船路径)。
// ★2026-09-26H 观战闸门 (用户圈定修复 #2/A2) → ★2026-09-27I **扩到全类** (用户追补: "观战模式仍能选几个
//   海战相关载具"): 观战者的明写口径是"常规载具/阵位/补给一概不用 (自由观察专用)", 而本表的每一项都是
//   **真载具** (deployVehList = tanks + planes + navalCraft) —— 选它 = 把 AI 的装备从战局里拿走
//   (坦克少一台 / 艇的 AI 车组被顶掉)。旧版只挡 tank/plane, 给舰艇留了口 (依据 2026-09-22 的"上艇唯一
//   路径"裁定); 本轮起 **坦克/战机/舰艇/两栖车一律置灰并注明"观战不可征用"**。想开艇仍可按 F 现场上艇 ——
//   那是"走近了动手"的干预权, 与"从部署界面凭空领一台"是两回事 (用户要挡的是后者)。
const vehs=deployVehList(player.team);
vehs.forEach((v,i)=>{
const id='V'+i;
const busy=v.playerDriven;
const specBlocked=!!player.spectator;
const ready=v.alive&&!busy&&!specBlocked;
const remain=v.alive?0:Math.ceil((typeof v.respawnT==='number'?v.respawnT:0)/(v.kind==='tank'?tankRespawnMul(v.team):1));
const ic=(v.kind==='plane')?'✈ ':((v.kind==='amph'||v.kind==='boat')?'⚓ ':'▣ ');
opts.push({name:ic+t(v.name)+(specBlocked?t(' (观战不可征用)'):(ready?'':(busy?t(' (占用)'):t(' (重生 {0}s)',remain)))),id,veh:v,disabled:!ready});
});
// 观战专属载具「幽灵坦克」**不进出生列表** (2026-09-26H 用户裁定): "开局的时候幽灵坦克不出现, 只在按下 F
// 的时候按需出现" —— 旧版这里预置车 + 给「观战载具」出生项 (选了就直接上车), 于是场上总停着一台无敌白车。
// 现在唯一入口是 20-player tryInteract ③ / 提示行里的 "F 召唤幽灵坦克", 也就是 specVehSummon。
if(!opts.some(o=>!o.disabled&&(o.id===selectedSpawn))) selectedSpawn=-1;
opts.forEach(o=>{
const b=document.createElement('button');
b.className='spawnBtn'+(o.id===selectedSpawn?' sel':'');
b.textContent='◈ '+o.name;
if(o.disabled){ b.disabled=true; b.style.opacity=0.45; }
else b.onclick=()=>{ selectedSpawn=o.id; document.querySelectorAll('.spawnBtn').forEach(x=>x.classList.remove('sel')); b.classList.add('sel'); };
list.appendChild(b);
});
}
// 部署界面载具冷却实时刷新: 打开期间每 0.5s 重建出生列表(保留滚动位置与选中项),
// 载具重生倒计时实时走秒, 冷却走完的按钮即刻亮起可选 (2026-09-01 用户指定)
function refreshDeployList(){
const list=el('spawnList');
if(!list||list.style.display==='none') return;
const st=list.scrollTop;
buildSpawnList();
list.scrollTop=st;
}
function drawDeployMap(){
const c=el('deployMap').getContext('2d');
const S=300;
c.fillStyle='#141a10'; c.fillRect(0,0,S,S);
// 缩放随地图尺寸: 标准 320 图=±170 (与原 170 一致), 大地图 640/800=±410
const MH=MAP_SIZE/2+10;
const toM=(x,z)=>[S/2+x/MH*S/2, S/2+z/MH*S/2];
c.strokeStyle='rgba(150,130,90,.5)'; c.lineWidth=4;
// 环礁海域 + 珊瑚跑道 (语义分区, 2026-09-18 塔拉瓦批): 先铺海面分带, 陆上要素随后覆盖
if(SEA){ drawSeaBands(toM,c,MH); drawRunway(toM,c); }
if(CAMPAIGN.sineRoad){
c.beginPath();
for(let x=-(MAP_SIZE/2-5);x<=MAP_SIZE/2-5;x+=10){ const [px,py]=toM(x,sineRoadZ(x)); x===-(MAP_SIZE/2-5)?c.moveTo(px,py):c.lineTo(px,py); } // 2026-09-06 B7a/P2-11/12
c.stroke();
}
for(const r of CAMPAIGN.roads){
c.beginPath();
const [ax,ay]=toM(r[0],r[1]), [bx2,by2]=toM(r[2],r[3]);
c.moveTo(ax,ay); c.lineTo(bx2,by2);
c.stroke();
}
// 随机战场·镇集铁路货线 (2026-10-07e): 与战术小地图同口径 (深底+细亮轨; 世界端 railLine 纯视觉)
if(typeof PGDATA!=='undefined'&&PGDATA&&PGDATA.rail&&PGDATA.rail.length>1){
c.strokeStyle='rgba(60,48,34,.95)'; c.lineWidth=3;
c.beginPath();
for(let i=0;i<PGDATA.rail.length;i++){ const [px,py]=toM(PGDATA.rail[i][0],PGDATA.rail[i][1]); i?c.lineTo(px,py):c.moveTo(px,py); }
c.stroke();
c.strokeStyle='rgba(198,178,140,.95)'; c.lineWidth=1;
c.beginPath();
for(let i=0;i<PGDATA.rail.length;i++){ const [px,py]=toM(PGDATA.rail[i][0],PGDATA.rail[i][1]); i?c.lineTo(px,py):c.moveTo(px,py); }
c.stroke();
}
// 城市街道 (语义分区): 轴对齐矩形直接填充 —— 部署图读出街廊网格
if(CAMPAIGN.city){
c.fillStyle='rgba(175,175,165,.38)';
for(const s of CAMPAIGN.city.streets){
const [ax,ay]=toM(s.x0,s.z0), [bx2,by2]=toM(s.x1,s.z1);
c.fillRect(ax,ay,bx2-ax,by2-ay);
}
}
// 庄稼田块 (软遮蔽区)
if(CROP_FIELDS.length){
c.fillStyle='rgba(160,185,95,.4)';
for(const cf of CROP_FIELDS){
c.beginPath();
const [a0,b0]=toM(cf.x0,cf.z0),[a1,b1]=toM(cf.x1,cf.z0),[a2,b2]=toM(cf.x1,cf.z1),[a3,b3]=toM(cf.x0,cf.z1);
c.moveTo(a0,b0); c.lineTo(a1,b1); c.lineTo(a2,b2); c.lineTo(a3,b3);
c.closePath(); c.fill();
}
}
// 河道与大桥 (主河 + 淞沪支流 + 多桥)
if(RIVER){
c.strokeStyle='rgba(70,110,150,.85)'; c.lineWidth=9;
c.beginPath();
RIVER.pts.forEach((pt,i)=>{
const [px,py]=toM(pt[0],pt[1]);
i===0?c.moveTo(px,py):c.lineTo(px,py);
});
c.stroke();
// 徒涉滩 (胡康 ford, 2026-09-12 巨桥改版): 虚线圈=可涉渡口
if(RIVER.ford){
const F=RIVER.ford, [fx,fy]=toM(F.x,F.z);
c.strokeStyle='rgba(205,230,240,.95)'; c.lineWidth=2.5;
c.setLineDash([6,4]);
c.beginPath(); c.arc(fx,fy,F.r/MH*(S/2)*0.8,0,TAU); c.stroke();
c.setLineDash([]);
}
}
if(typeof DELTA_CHANS!=='undefined'&&DELTA_CHANS.length){
c.strokeStyle='rgba(70,110,150,.55)'; c.lineWidth=5;
for(const ch of DELTA_CHANS){
c.beginPath();
ch.forEach((pt,i)=>{
const [px,py]=toM(pt[0],pt[1]);
i===0?c.moveTo(px,py):c.lineTo(px,py);
});
c.stroke();
}
}
// 鱼塘/藕塘 + 丝厂地标 (淞沪)
if(typeof DELTA!=='undefined'&&DELTA&&DELTA.ponds){
for(const pd of DELTA.ponds){
const [px,py]=toM(pd.x,pd.z);
c.beginPath(); c.arc(px,py,pd.r*0.7,0,TAU);
c.fillStyle=pd.t==='lotus'?'rgba(70,120,60,.5)':'rgba(70,110,150,.5)';
c.fill();
}
}
if(typeof DELTA!=='undefined'&&DELTA&&DELTA.landmark){
const L=DELTA.landmark;
const [px,py]=toM(L.x,L.z);
c.fillStyle='rgba(160,100,70,.9)';
c.fillRect(px-7,py-7,14,14);
c.fillStyle='#fff'; c.font='bold 10px sans-serif'; c.textAlign='center';
c.fillText('丝厂',px,py+3);
}
if(typeof BRIDGES!=='undefined'&&BRIDGES.length){
c.strokeStyle='#d8c890'; c.lineWidth=7;
for(const B of BRIDGES){
const bx=Math.sin(B.yaw)*(B.len/2), bz=Math.cos(B.yaw)*(B.len/2);
const [ax,ay]=toM(B.x-bx,B.z-bz), [bx2,by2]=toM(B.x+bx,B.z+bz);
c.beginPath(); c.moveTo(ax,ay); c.lineTo(bx2,by2); c.stroke();
}
}
// 百团沟壑 (语义分区, 2026-09-12 补画): 沟壑赭色带 + 坡道堑口浅色通道线 —— 部署图读出三路与分层
if(typeof LOESS!=='undefined'&&LOESS&&LOESS.gullies){
c.strokeStyle='rgba(158,108,58,.85)'; c.lineWidth=9;
for(const g of LOESS.gullies){
c.beginPath();
g.forEach((pt,i)=>{
const [px,py]=toM(pt[0],pt[1]);
i===0?c.moveTo(px,py):c.lineTo(px,py);
});
c.stroke();
}
if(LOESS.ramps){
c.strokeStyle='rgba(230,212,160,.95)'; c.lineWidth=3.5;
for(const r of LOESS.ramps){
const [ax,ay]=toM(r.x0,r.z0), [bx2,by2]=toM(r.x1,r.z1);
c.beginPath(); c.moveTo(ax,ay); c.lineTo(bx2,by2); c.stroke();
}
}
}
// 雾林守线语义 (2026-09-13 许特根改版): 北谷灰蓝带 + 堑口浅色通道 + 西墙深灰双线 (缺口留白)
if(typeof WOOD!=='undefined'&&WOOD&&WOOD.ravine){
c.strokeStyle='rgba(96,108,104,.9)'; c.lineWidth=9;
c.beginPath();
WOOD.ravine.pts.forEach((pt,i)=>{
const [px,py]=toM(pt[0],pt[1]);
i===0?c.moveTo(px,py):c.lineTo(px,py);
});
c.stroke();
c.strokeStyle='rgba(224,216,180,.95)'; c.lineWidth=3.5;
for(const r of WOOD.ravine.ramps){
const [ax,ay]=toM(r.x0,r.z0), [bx2,by2]=toM(r.x1,r.z1);
c.beginPath(); c.moveTo(ax,ay); c.lineTo(bx2,by2); c.stroke();
}
}
if(typeof WOOD!=='undefined'&&WOOD&&WOOD.belt){
const B=WOOD.belt;
c.strokeStyle='rgba(70,72,66,.92)'; c.lineWidth=5;
for(const bx of [B.x0,B.x1]){
c.beginPath();
let [px,py]=toM(bx,-B.spanZ);
c.moveTo(px,py);
[px,py]=toM(bx,-B.gapZ); c.lineTo(px,py);
[px,py]=toM(bx,B.gapZ); c.moveTo(px,py);
[px,py]=toM(bx,B.spanZ); c.lineTo(px,py);
c.stroke();
}
}
// (2026-11-10: 部署图大舰轮廓渲染段随大舰子系统下架摘除)
if(BASES.length) [0,1].forEach(t=>{
// ★2026-10-03 (与主基地按钮同族): 海战图基地方块跟随基地舰当前位置, 不再钉在静态海点
const bp2=(typeof basePos==='function')?basePos(t):BASES[t];
const [px,py]=toM(bp2.x,bp2.z);
c.fillStyle=t===0?'#4a70b0':'#b05a4a';
c.fillRect(px-8,py-8,16,16);
c.fillStyle='#fff'; c.font='10px sans-serif'; c.textAlign='center';
c.fillText(TEAM_NAME[t][0],px,py+3);
});
// 断崖公路: 劫道方临时补给点 (存活期间) 绿色方块
if(SUPPLY_POINTS.length){
for(const sp of SUPPLY_POINTS){
const [px,py]=toM(sp.x,sp.z);
c.fillStyle='#48b06a';
c.fillRect(px-4,py-4,8,8);
}
}
for(const f of FLAGS){
const [px,py]=toM(f.x,f.z);
c.beginPath(); c.arc(px,py,13,0,TAU);
c.fillStyle=(f.owner===0?'rgba(90,140,220,.85)':f.owner===1?'rgba(220,110,90,.85)':f.owner===2?'rgba(120,185,140,.85)':'rgba(150,150,140,.7)');   // (2026-11-10: 瘫舰灰显/斜杠随大舰子系统下架摘除)
c.fill();
c.fillStyle='#fff'; c.font=f.id.length>1?'bold 9px sans-serif':'bold 13px sans-serif'; c.textAlign='center';
c.fillText(f.id,px,py+(f.id.length>1?3:4));
}
// 无旗点战役: 强点菱形 (颜色=当前归属, 中立=灰; 被争夺时描边闪烁)
for(const [si,sp] of (CAMPAIGN.spawns||[]).entries()){
const own=(typeof SPOTS!=='undefined'&&SPOTS[si])?SPOTS[si].own:sp.team;
const contested=typeof SPOTS!=='undefined'&&SPOTS[si]&&SPOTS[si].capTeam!==-1;
const [px,py]=toM(sp.x,sp.z);
c.save(); c.translate(px,py); c.rotate(HPI/4);
c.fillStyle=own===0?'#4a70b0':own===1?'#b05a4a':own===2?'#5ea878':'#9a968a';
c.fillRect(-6,-6,12,12);
if(contested){ c.lineWidth=2; c.strokeStyle='#ffd77a'; c.strokeRect(-7,-7,14,14); }
c.restore();
}
for(const s of soldiers){
if(!s.alive||s.onVehicle) continue;
const [px,py]=toM(s.pos.x,s.pos.z);
c.fillStyle=(typeof solMapDotColor==='function')?solMapDotColor(s):((s.zombie||s.team===2)?'#9ecfa0':(s.inSquad?'#ffffff':(s.team===player.team?'#5a9eff':'#ff5040'))); // 着色单源 (2026-11-13 观战中立批; typeof 守卫同 sfNavalMapSymbols 惯例)
c.beginPath(); c.arc(px,py,2,0,TAU); c.fill();
}
// 海战载具 (2026-09-20N 海战批): 部署图用与陆上坦克不同的艏向三角符号 —— 画法与
// 小地图/大地图**同一份** (22-hud 追加段的 sfNavalMapSymbols, 北向图 rot=0, 与该文件 drawBigMap 的
// 投影同式); 复用既有 toM, 不在这里另写投影。typeof 守卫: 只加载部分脚本的沙箱不该因此报错。
if(typeof sfNavalMapSymbols==='function') sfNavalMapSymbols(toM,c,S,0);
}
function deployPlayer(){
const p=player;
// ★2026-11-04b 免着火批: 上一次部署/阵亡残留的燃烧账 (burnTimer/burnTickT/burnAttacker) 不带进新生;
//   尤其"活人→观战"这类切换, 让免疫与清账同处收口 (燃烧主循环另有逐帧兜底)。
p.burnTimer=0; p.burnTickT=0; p.burnAttacker=null;
// ★2026-11-01: 调试观战附身中直接再部署 ⇒ 先脱离还原 (specViewHost 冻结门不清掉会把新生也钉死在 Bot 身上)
if(p.specViewHost){
if(typeof svHostModelRestore==='function') svHostModelRestore();   // 真附身: 宿主模型收纳还原 (再部署顶替脱离单源; 显隐守卫单源 2026-11-02: mesh 是包装对象, 真身 .root)
p.specViewHost=null; p._svSaved=null; p._svCurW=undefined; p.thirdPerson=false; p.prone=false; p.crouch=false;   // 姿态旗一并清 (附身期间镜像的是宿主)
if(typeof VM!=='undefined'&&VM.root) VM.root.visible=true;
}
// ★2026-10-30 票尽门给观战放行 (specWillBe 单源见 18-game): 观战开关开着 = 部署将以观战身份入场,
//   不耗票不清场; 观战关着 (含 specWant=false 显式关) 照旧拦下 —— 不放行"票尽复活成普通步兵"。
if(tickets[p.team]<=0&&!p.specWillBe()){ addKillMsg('兵力已耗尽 · 本方无法再部署',p.team); return; } // 清场阶段禁止部署 (2026-09-04)
	// 观战意图结算 (2026-09-26H 观战批, 审计 #3/A3): 战斗中在兵种卡上点开的观战开关**记在意图里**
	// (player.specWant), 到这一刻才真的落到 player.spectator —— 旧版二次点击当场生效, 一个正在交战的活人
	// 可以在不阵亡的情况下瞬间变成"免伤+无限弹+可打双方"。放函数最前: 下面的配枪 (playerClassWeapons)、
	// 副武器换装 (applySpectatorLoadout)、重生提示全都读 player.spectator。
		if(typeof p.specWant==='boolean'){
		p.spectator=p.specWant;
		p.specWant=null;
		}
		// R10 盖章 (2026-10-26 指挥官批, 单源 = 26-commander cmdLockStamp): 局内首次部署定方向 ——
		// 选了指挥官 = 'in' (此后含死亡重生再部署永远换不出), 否则 = 'out' (本局中途换不进指挥官)。
		if(typeof cmdLockStamp==='function') cmdLockStamp(p.cls);
	// ★观战局盖章 (判据 2026-09-27 收窄, 用户实报"选了一下观战再取消也被判观战不予计量"): 本局是否**真的
	//   顶着观战态落进战场** —— 只有这一刻记 specUsed, 结算才据此判"不计入历史记录" (21-match recCommit)。
	//   收在部署这一处是单源: 三条进入观战态的路径 (战斗中开开关走 specWant 待生效 / 选兵阶段开开关当场生效 /
	//   上一局遗留想开) 最终都要经过部署才可能产生战绩, 所以"部署时状态"就是唯一的判据来源。
	//   放在 specWant 结算**之后**、与观战无关的其它部署逻辑之前 —— 那一帧 p.spectator 已是最终值。
	if(p.spectator) p.specUsed=true;
	// 观战者不得征用**任何**真载具 (2026-09-26H A#2 的**结构性**保证, 2026-09-27I 扩到全类, 与 buildSpawnList
	// 的置灰同源): buildSpawnList 里 `if(!opts.some(o=>!o.disabled&&o.id===selectedSpawn)) selectedSpawn=-1`
	// 已经会在置灰那一刻清掉选中项, 但那条依赖"列表重建过"这一时序; 万一 selectedSpawn 还留着 'V<n>'
	// (先选艇 → 再开观战 → 交付确认 → 阵亡 → 部署), 这里再挡一道, 不让观战者从部署界面坐进 AI 的载具。
	if(p.spectator&&typeof selectedSpawn==='string'&&selectedSpawn[0]==='V') selectedSpawn=-1;
	// 观战专属载具「幽灵坦克」(2026-09-17 观战扩展批): 再部署先把上一趟的车**收掉** ——
	// 否则"人在车上 → 重新部署到别处"会把车永久锁在 playerDriven=true (再也上不去)。
	// 2026-09-26H: 旧版只解绑 (车停在原地), 而本轮起"开场/部署都不再预置白车"(用户裁定: 只在按 F 时按需出现),
	// 于是这里改走 specVehStow —— 解绑 + 摘出 world + 停引擎 + 进实例池, 场上不留车, 下次 F 是全新就位。
	if(typeof specVehStow==='function') specVehStow();
	else if(typeof specVehUnbind==='function') specVehUnbind();
// 载具出生
let vehSpawn=null;
if(typeof selectedSpawn==='string'&&selectedSpawn[0]==='V'){
const vehs=deployVehList(p.team);
const v=vehs[+selectedSpawn.slice(1)];
if(v&&v.alive&&!v.playerDriven) vehSpawn=v;
}
	let sx,sz;
	const sBase=basePos(p.team);
	const isBaseSpot=()=>Math.hypot(sx-sBase.x,sz-sBase.z)<1;
	if(vehSpawn){ sx=vehSpawn.pos.x; sz=vehSpawn.pos.z; }
	else if(typeof selectedSpawn==='string'&&selectedSpawn[0]==='P'){
	const sp=(CAMPAIGN.spawns||[])[+selectedSpawn.slice(1)];
	const own=(typeof SPOTS!=='undefined'&&SPOTS[+selectedSpawn.slice(1)])?SPOTS[+selectedSpawn.slice(1)].own:sp.team;
	if(sp&&own===p.team){ sx=sp.x; sz=sp.z; }
	else { sx=sBase.x; sz=sBase.z; }
	}
	else if(selectedSpawn==='CV'){ const pt=convoyDeployPt(); sx=pt.x; sz=pt.z; }
	else if(selectedSpawn===-1||typeof selectedSpawn==='string'){ sx=sBase.x; sz=sBase.z; }
	else {
	const f=FLAGS[selectedSpawn];
	if(f.owner!==p.team){ sx=sBase.x; sz=sBase.z; }
	else { sx=f.x; sz=f.z; }
	}
// 玩家落点 (2026-09-19): 走与 Bot 同一套落点选择 —— 落点也避开建筑足迹,
// 并尽量离同队最近邻远一点 (不再叠进出生点人堆里)。玩家选了点位语义仍然保留 (优先落点在所选点位圈内)。
const lp=(typeof pickSpawnPoint==='function'&&typeof pickSpawnFor==='function')
? pickSpawnPoint(p.team,{x:sx,z:sz,base:isBaseSpot(),r:12})
: null;
const fp2=lp?[lp.x,lp.z]:findFreeSpawn(sx,sz);
p.pos.set(fp2[0],0,fp2[1]);
p.pos.y=standHeight(p.pos.x,p.pos.z,10);   // (2026-11-10: 甲板吸附/甲板出生高度随大舰子系统下架摘除)
// 观战专属载具 (2026-09-26H 用户裁定): 部署时**不做任何预置** —— 旧版在这里 (以及 buildSpawnList 里)
// 把幽灵坦克召到落点/主基地旁, 于是"观战者的白车"一开局就停在场地上。现在车只在按 F 时按需显形
// (20-player tryInteract ③ → specVehSummon: 就位在脚下并直接上车), 这里一行也不做。
p.vel.set(0,0,0);
p.hp=100; p.alive=true; p.deployed=true; p.crouch=false; p.prone=false; p.chute=false;
p.protUntil=nowT+SPAWN_PROT; // 出生保护 (2026-09-28 阶段三 P1; 2026-10-06 升 2s): 落地免伤 (与 Bot spawn() 同一口径), 开火即解除
p.demolish=null; // 上一局的拆除读条不跨命 (updateDemolish 的 alive 闸之外再加一道部署复位)
// A#8 契约 §7: 所有 player.chute=false 的写入点必须**同帧**收伞 —— 旧写法只在下一帧的 else 分支里摘,
// 于是部署那一帧伞还挂在头顶 (typeof 守卫: 只加载部分脚本的沙箱没有 20-player, 不该因此报错)。
if(typeof playerChuteClear==='function') playerChuteClear();
p.stamina=1; p.suppressV=0; p.bloom=0; p._flyT=0;   // ★2026-11-21 批B#1: 悬停飞行起飞宽限账随新命清零 (新命=新身体契约, _flyT 此前漏网)
// 潜水态字段随部署复位 (★2026-09-26E 审计 31): diveD/oxy/_drownAcc/headDepth 此前**全库唯一**复位点
// 是 15d-naval 的弃船 (crewOut) —— 潜水溺死后这条命带着 diveD(最多 4m) 进下一局: 一入水就被拽到
// 水面下 (4+1.32)m、泳速长期吃 ×0.85、呼吸条显示空条。与 stamina/hp 同段清, 口径即"新命=新身体"。
p.diveD=0; p.oxy=1; p._drownAcc=0; p.headDepth=-1;
// 出生朝向 (2026-10-06 生成平衡批): 面朝最近存活敌人 (spawnYawAt 单源, 与 Bot spawn 同一款);
// 旧版 atan2(-sx,-sz) 是"面朝世界原点" —— 与敌人的方位毫无关系, 用户实报"一生成就是背对着敌人"。
// 朝向从**实际落点** (p.pos, 已过甲板吸附) 起算; 无存活敌人时保留旧逻辑兜底。
// 载具出生 (下面 vehSpawn 分支) 会按车体朝向覆盖, 不受此处影响。
{
const _sy=(typeof spawnYawAt==='function')?spawnYawAt(p.pos.x,p.pos.z,p.team,false):null;
p.yaw=(_sy!==null)?_sy:Math.atan2(-sx,-sz); p.pitch=0;
}
const wkeys=playerClassWeapons(p.team,p.cls);
const gear=p.spectator?specGear():clsGear(p.cls,p.team); // 观战: 四弹种全给 (2026-10-24 用户指定, 与补给回满同源)
p.slots=wkeys.map(k=>({key:k,def:WPN_DEFS[k],mag:WPN_DEFS[k].mag,reserve:WPN_DEFS[k].reserve}));
// 军刀第 3 槽 (2026-11-20 近战重做): 非观战常驻追加 (N 键切换; 与 20-player rearmPlayerClass 互指同源,
// 两处同一事实只此一对) —— 不动 playerClassWeapons (部署卡列表/观战覆盖不受影响); Bot setClass 不加。
if(!p.spectator) p.slots.push({key:'sabre',def:WPN_DEFS.sabre,mag:0,reserve:0});
p.curSlot=0; p.curW=p.slots[0];
p.nadeCount=gear.nades;
p.atNades=gear.atn;
p.maxBandages=CLASSES[p.cls].bandages||4; // 2026-09-06 B7a/P2-13: 绷带上限进兵种表, 文案/数值同源
p.bandages=p.maxBandages;
p.smokeCount=gear.smoke;
p.incinCount=gear.incin;
// ★2026-10-12 读条残留随再部署一次收干净: 旧版只抹字段 (bandaging=0/useCast=null) —— 若死亡那一刻
//   读条还在跑, VM.state 仍停在 'bandage', 绷带卷与缠臂环会跟到下一次出生 (用户实报②的另一条入口)。
//   cancelReadBar 是唯一出口 (账目 + vmAbortAction 模型层一起收), quiet 免得盖掉部署提示。
if(p.readBarActive()) p.cancelReadBar(null,true);
p.bandaging=0;
p.useCast=null;
p.grabAction=null;
p.deathRag=null; p.deathCamT=0;
p._deathVy=undefined; p._deathT=undefined; p._dfPose=null;   // ★2026-11-25 就地倒下重力批: 坠落/姿态首帧捕获账跨命清零
p.lifeStartT=nowT; p.lifeKills=0; p.lifeScoreStart=p.score||0;
p.onMortar=null; p.mortarPlaced=false; p.buildCount=6; p.buildSel=0; p.pendingBuild=null;
	p.nadeIsAT=false; p.nadeHeld=false; p.nadeIsSmoke=false; p.nadeIsIncin=false;
	if(p.loiter){ loiterDetonate(p.loiter,p.loiter.pos.clone()); }
// 海战舰船座位随部署复位 (2026-09-20N 海战批): 在艇上阵亡/直接改部署点时, 座位必须交还 ——
// 否则 player.onNaval 停在上一台艇上, 下一帧 updatePlayerNaval 会把刚落地的人重新钉回那条艇。
if(p.onNaval){ if(typeof navalSeatRelease==='function') navalSeatRelease(false); else p.onNaval=null; }
// A#9 岸防炮座位随部署复位 (与上面 onNaval 同型): 在炮位上阵亡/直接改部署点时, 炮位占用必须交还 ——
// 否则 player.onBattery 停在上一门炮上, 复活后 updatePlayerBattery 会把刚落地的玩家重新钉回炮位。
if(p.onBattery){ if(typeof batteryDismountPlayer==='function') batteryDismountPlayer(); else p.onBattery=null; }
// (2026-11-10: 大舰座位/炮位账复位随大舰子系统下架摘除 —— 两字段全库无写入点)
p.onVehicle=null; p.onMG=null; p.onAT=null; p.onAA=null; p.tankView=false; p.braced=false;
if(typeof isDarkEnvironment==='function'&&isDarkEnvironment()) p.flashlight=true;
document.getElementById('heatWrap').style.display='none';
vmEquip(p.curW.key,p.team);
VM.root.visible=true;
// 详细操作开关 (2026-11-09 批): 关=部署页兵种键位提示不弹 (cmdDeployHint 同规, 见 26-commander)
if(SHOW_CTL_HINTS){
if(p.cls===4) showScorePop('工程兵 · 按 5 选工事 · B 建造(靠近自己工事 B 读条拆除退点) · 6 架设/读条回收迫击炮');
else if(isLoiterClass()) showScorePop('巡飞弹兵 · 左键发射后进入TV制导 · 按 6 扔燃烧弹');
}
if(typeof cmdDeployHint==='function') cmdDeployHint();   // 指挥官: 通讯仪右键开图/下令/减速提示 (2026-10-26)
if(vehSpawn){
// 海战载具 (kind 'amph'|'boat'): 座位初始化走 navalBoard 单源 (与"走到艇边按 F"同一份代码),
// 车组交还/玩家态/武器槽暂存都在那里 —— 这里不再按坦克那套写一遍 (那是第二条上船路径, 正是要避免的)。
const isNaval=(vehSpawn.kind==='amph'||vehSpawn.kind==='boat');
if(vehSpawn.crewBot&&!isNaval){
const cb=vehSpawn.crewBot;
if(vehSpawn.kind==='plane'){
vehSpawn.crewBot=null;
cb.onVehicle=null;
// A#8 契约 §7: 用 chuteBegin 统一开伞 (同帧置 chuting/chute/onGround 三态, 与玩家 p.chute 口径一致);
// 旧版只写 cb.chuting=true, 缺 chute/onGround 会让 chuteAirborne() 判不出"伞降中"。
// (2026-11-10: 被顶掉的 AI 飞行员改投本队舰甲板段随大舰子系统下架摘除 —— 恢复一律跳伞)
if(typeof cb.chuteBegin==='function') cb.chuteBegin(vehSpawn.pos.x,Math.max(vehSpawn.pos.y-2,heightAt(vehSpawn.pos.x,vehSpawn.pos.z)+3),vehSpawn.pos.z);
else { cb.chuting=true; cb.pos.set(vehSpawn.pos.x,Math.max(vehSpawn.pos.y-2,heightAt(vehSpawn.pos.x,vehSpawn.pos.z)+3),vehSpawn.pos.z); cb.mesh.root.visible=true; cb.path=null; cb.state='idle'; cb.target=null; }
} else cb.dismountVehicle(false);
}
if(isNaval){
if(typeof navalBoard==='function') navalBoard(vehSpawn,true);
} else {
vehSpawn.playerDriven=true;
if(vehSpawn.kind==='tank'){ vehSpawn.isAI=false; vehSpawn.vel=0; p.yaw=vehSpawn.yaw+vehSpawn.turretYaw+Math.PI; }
else { p.yaw=vehSpawn.yaw+Math.PI; p.pitch=vehSpawn.pitch; }
p.onVehicle=vehSpawn;
// ★2026-11-28 骑姿批 (用户裁定"载具上隐藏但要有姿势, 对齐迫击炮蹲姿; 死亡倒下沿用"): 部署上车/登机同规 ——
//   存原姿态档 + 置蹲姿旗 (die() 死在座记账 ⇒ 死亡呈现从蹲姿起手), 三人称本体模型在场就硬置一次蹲姿
//   (乘员期姿态机不跑, 冻结保留到死亡/下车; F 下车/跳伞还原骑乘前档)。
p._crouchSaved=p.crouch; p.crouch=true; p._ridingSeat=true;
if(typeof playerAvatar!=='undefined'&&playerAvatar&&typeof hardPoseCrouch==='function') hardPoseCrouch(playerAvatar);
p.pos.copy(vehSpawn.pos);
VM.root.visible=false;
document.getElementById('heatWrap').style.display='block';
}
}
document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden'));
el('blackOv').style.opacity=0;
if(p.spectator){ p.flying=false; p.flyAero=false; p._aeroSpd=0; }
lockPointer();
// ★2026-10-26 排查轮二审 修复 (H4/P3): 观战提示行里的减速键词条改为向 26-commander 取。
//   ①现象: 减速键 (V, 2026-10-26 交互重做批由 N 换来) 是指挥官批新加的观战共用功能 (R8: 观战免读条),
//     提示行里这一句 "... · V=减速" 若**手写死**就是第二份副本 —— 键位或词条将来一改, 这里不会跟着改。
//   ②根因 (旧写为什么错): "减速键该怎么提示"这条判据在 26-commander 有单源函数 (cmdSpecHudKeys),
//     本行却自己抄一份同样的字面量 = 同一词条两处实现 (改一处漏另一处的那种双源)。
//   ③现在的单源口径: 词条来自 cmdSpecHudKeys() (typeof 守卫: 极端沙箱缺 26-commander 时退回字面量,
//     字面量随码走保持现键 V)。**整句仍是同一个键**: 前缀 + 取回的词条恰好拼回 00b-i18n 里那条整句键
//     '调试模式 · 双击空格=悬停飞行 · H=气动飞行 · F=召唤幽灵坦克 · K=时停 · J=信息层 · V=减速'
//     (showScorePop 内部对整句 t() 一次), 所以英文界面照旧命中整句翻译, 不新增裸中文键。
//     注意拼接顺序: 词条必须是整句的**后缀** (cmdSpecHudKeys 返回 ' · V=减速', 正是后缀形态)。
//     ★2026-10-27 排查批: fallback 与本注释里的键名从 N 纠正为 V (换键批漏改的后缀副本)。
//     ★2026-11-01 改名: 观战→调试模式 (旧观战职能; 新"自由观战"无这些工具键, 提示走 enterSpecView)。
if(p.spectator&&SHOW_CTL_HINTS) showScorePop('调试模式 · 双击空格=悬停飞行 · H=气动飞行 · F=召唤幽灵坦克 · K=时停 · J=信息层 · Q=附身Bot · E=脱离 · L=手电/大灯'+((typeof cmdSpecHudKeys==='function')?cmdSpecHudKeys():' · V=减速'));   // 词条与 26-commander cmdSpecHudKeys 同源 (V=减速 / R8: 观战共用键, 免读条); ★2026-11-05 补 L (调试模式手电/大灯批, 词典键同步 00b-i18n); 2026-11-09 批: 键位提示受详细操作开关管
// 落地 = 部署界面收起 (上面那句把全部 .screen 收进 hidden) → 立刻摘掉 inDeploy, 战斗 HUD 随之上场 (2026-09-20 第6条)
if(typeof syncDeployHud==='function') syncDeployHud();
}
// ===== 观战换装 (2026-09-17 观战扩展批, 用户裁定"即时生效 + 下次部署也生效") =====
// 开/关观战立刻把 2 号槽换成 / 换回该兵种的原副武器 —— 只动副武器槽, 主武器与其余装备原样,
// 当前正握着副武器时同步换模型 (vmEquip); 正在载具/阵位/控弹时不打断手里的东西, 只改槽位数据。
function applySpectatorLoadout(){
if(!player.slots||player.slots.length<2) return false;
const base=(TEAM_FACTION[player.team].cls[player.cls]||[])[1];
const want=player.spectator?'specsniper':base;
if(!want||!WPN_DEFS[want]) return false;
if(player.slots[1]&&player.slots[1].key===want) return false;
player.slots[1]={key:want,def:WPN_DEFS[want],mag:WPN_DEFS[want].mag,reserve:WPN_DEFS[want].reserve};
if(player.curSlot===1&&!player.onVehicle&&!player.onMG&&!player.onAT&&!player.onAA&&!player.onMortar&&!player.loiter){
player.curW=player.slots[1];
vmEquip(want,player.team);
}
showScorePop(t2('副武器: {0}',t2(WPN_DEFS[want].name)));
return true;
}
// ── 旗帜/强点初始归属 (2026-09-20 顺序修正) ──
// 原实现在 startMatch 内联, 且位置在开局批量生成**之后** —— FLAGS 初始 owner=-1 (05c-layouts 2276),
// 于是开局那批人算候选出生点位时一个旗都不归自己: 没有 CAMPAIGN.spawns 的地图候选点位数=1,
// 全队必然 100% 落在主基地 (实测诺曼底 10/10、胡康 13/13 —— 用户实报"开局全都在主基地及周边")。
// 现抽成函数并在批量生成前调用; 逻辑与赋值原样搬移 (幂等, 语义不变)。
function applyFlagOwnership(){
	// 旗帜初始归属 (征服: 优先读旗点显式 own 字段[斯大林格勒 14 点草图开局态势]; 无 own 时按就近归属;
	// 攻防/破袭: 防守方全部据守)
	// ★2026-10-02 实机"阵营栏一方显示灰色": 图标 DOM id 旧版用旗点名 (fi旗舰舰桥/fi前主炮…),
	//   而海战图两军的旗点**同名** (各有一组 前主炮/舰桥/后主炮) ⇒ id 重复, 后一军的图标
	//   el('fi'+id) 永远查到前一军那个, 自己的从未被 updateHUD 更新, 停留在建出来时的无 class
	//   态 (= CSS 的灰底灰字) —— "一方显示灰色而非该有的蓝/红"。id 改按 FLAGS 索引, 与
	//   22-hud updateHUD 的 el('fi'+i) 同一序 (forEach 双参), 陆战图 A..E 也逐位兼容。
	el('flagIcons').innerHTML=FLAGS.map((f,i)=>`<span id="fi${i}">${f.id}</span>`).join('');
	// ★2026-10-07d 幻影敌旗修复: solo 生存无敌方队伍 —— 05c 已删 own, 但旧版会落进 conquest
	//   "就近拆分"兜底 (最近2旗给0队/最远2旗给1队) ⇒ 单队伍局凭空出现 2 面敌方旗 (HUD 红标 +
	//   坦克去"夺回")。solo 只建 HUD 图标、旗保持中立 (可占给 ZP, 21-match 占领钩子); teams 照常。
	if(typeof ZOMBIE_MODE!=='undefined'&&ZOMBIE_MODE==='solo') return;
	if(GAMEMODE==='conquest'){
	if(FLAGS.some(f=>f.own!==undefined)){
	// 显式归属 (2026-09-06 斯大林格勒改版): 两翼 home 点开局各归其主, 中央拉锯带中立 —— 草图开局态势
	FLAGS.forEach(f=>{ if(f.own!==undefined){ f.owner=f.own; drawFlagTex(f); } });
	}else if(FLAGS.length){
	const sorted=[...FLAGS].sort((a,b)=>Math.hypot(a.x-BASES[0].x,a.z-BASES[0].z)-Math.hypot(b.x-BASES[0].x,b.z-BASES[0].z));
	sorted[0].owner=0;
	sorted[sorted.length-1].owner=1;
	if(sorted.length>=5){ sorted[1].owner=0; sorted[sorted.length-2].owner=1; }
	FLAGS.forEach(f=>drawFlagTex(f));
	}
	} else if(GAMEMODE==='assault'||GAMEMODE==='demolition'){
	// 攻防: 开局就近拆分 (2026-09-01 用户指定) —— 进攻方持有距其基地最近的旗点(≥5旗给2个, 其余1个), 剩余归防守方;
	// 攻方旗数过半后守方按差值持续掉票 (见 21-match 压制), 全占仍即胜
	// 破袭: 仍防守方(DEF)据守全部旗点 (胜负看补给库, 旗点仅作部署/争夺锚点)
	FLAGS.forEach(f=>{ f.owner=DEF; f.cap=0; f.capTeam=-1; drawFlagTex(f); });
	if(GAMEMODE==='assault'&&FLAGS.length){
	// 归属判据单源 (2026-09-26): 00-config attackerFlagPicks —— 05c defWorks 摆工事时读**同一支**
	// (攻方开局旗圈里不落守方工事), 两处永不脱钩; 这里的采样语义与旧写法逐位一致 (同一排序/同一批)。
	for(const f of attackerFlagPicks(FLAGS)){ f.owner=ATK; drawFlagTex(f); }
	}
	// 防守方兵力=进攻方×1.25 (2026-09-05 用户指定下调: 防守优势改由"防御工事模板"承担阵地强度,
	// 人数只保留小幅倾斜; 原为 ×1.75, 阵地+人海双优势过重)
	// 丧尸模式例外 (2026-10-07d 用户裁定): 尸潮是两军共同威胁, "不再纯粹是两队对抗" ⇒ 初始票数对等, ×1.25 失去前提。
	tickets[DEF]=Math.round(tickets[ATK]*(typeof ZOMBIE_MODE!=='undefined'&&ZOMBIE_MODE?1:1.25));
// 攻防限时: 默认 18 分钟; 战役条目 matchMin 覆盖 (柏林大地图 22 分钟)
// ★2026-10-04 (海战审计 F4): 征服分支旧版写死 16*60 —— coral matchMin:20 是死配置。与攻防/遭遇
//   同一口径: 战役条目覆盖, 缺省 16 (既有陆战征服图无 matchMin 的逐位不变)。
matchTime=GAMEMODE==='assault'?((CAMPAIGN.matchMin||18)*60):((CAMPAIGN.matchMin||16)*60);
	} else if(GAMEMODE==='clash'){
	// 遭遇战: 无旗点, 兵力打空者败; 限时默认 15 分钟, 战役条目 matchMin 覆盖 (草原库尔斯克 640 大图 22 分钟)
	matchTime=(CAMPAIGN.matchMin||15)*60;
	} else if(GAMEMODE==='convoy'){
	// 劫道: 双方兵力均为标准相等有限票 (胜负仍看车队), 16分钟限时
	matchTime=16*60;
	supplyClockStart(); // 劫道方临时补给点寿命计时从开局起算 (owner 接口)
	}
}

// ═════ 海战载具开局编制 (2026-09-20N 海战批, owner: naval-crew) ═════
// 数据源 (单源纪律): CAMPAIGN.island.navalN=[两栖车, 艇] per team (00-config) + CAMPAIGN.sea.muster
//   ([team0 南湾外海, team1 北湾外海]); 本函数不写死任何坐标、不另写水深/岸线算术。
// 重生点位口径 (定稿 §6.2): pos = muster[team] + 队内序号横向错位 22m, 朝向 = muster.face (面向本方海湾)。
//   横向 = 艏向的垂直方向 —— 本仓库 yaw→方向约定 forward=(sin,cos) (见 15-vehicles Tank.aimDir) ⇒ lat=(cos,-sin)。
// 为什么这里显式再落一次位: 15d-naval 的 respawn(initial) 走同一公式 (两处一致、互为佐证); 而万一 15d 的
//   构造器不自落位, 载具会停在 (0,0) —— 那是岛中央, 开局即搁浅。显式落位让"开局编制位置"同源可控。
function navalMusterSpot(team,ord){
const mu=(SEA&&SEA.muster&&SEA.muster[team])||null;
if(!mu) return null;
const face=mu.face||0;
const lat=[Math.cos(face),-Math.sin(face)];              // 艏向垂直 (横向铺开轴)
// 队内序号错位间距: 读 15d 的单源 NAVAL_SPAWN_GAP (★2026-09-26E 审计 11 —— 旧版这里写死 22, 而 15d 的
// navalSpawnPoint 自带另一套"全队居中"公式 (永不执行) ⇒ 两处注释都自称单源、实际两套算术)。
const gap=(typeof NAVAL_SPAWN_GAP==='number')?NAVAL_SPAWN_GAP:22;
const off=ord*gap;
const x=mu.x+lat[0]*off, z=mu.z+lat[1]*off;
// ★2026-09-26E (审计 10): 落位高度 = 水面 − **吃水** —— 旧版只写水面高 ⇒ 10 台舰艇开局全部浮高
// 0.4~0.95m, 再由 15d 的 _attitude 阻尼 (k=9) 在 0.3~0.5s 内"沉"下去 (玩家选"⚓ PT 艇"出生能直接看到
// 这个下沉弹跳)。吃水单源 = 15d 的 navalDraftOf (typeof 守卫: 未加载时退化为 0, 即旧行为)。
const y=(typeof waterYAt==='function')?waterYAt(x,z):0;  // 落位水面高 (03-terrain 单源, 严禁另写); 吃水由调用方按艇扣除 (见 spawnNavalOrbat)
return {x,y,z,face};
}
// 每队: navalN[0] 台两栖车 (美 lvt / 日 kami) + navalN[1] 艘艇 (美 pt / 日 gyorai), 车组由调用方循环配。
// 队内序号 ord = 两栖车 0..n0-1, 艇接着排 —— 与 Tank 的 ord 同义 (供 15d 的重生/落位错位口径共用)。
function spawnNavalOrbat(){
const nN=CAMPAIGN.navalN||NAVAL_ORBAT_DEF;    // [两栖车, 艇] per team
const n0=Math.max(0,nN[0]|0);
const keys=[['lvt','kami'],['pt','gyorai']];  // 索引 0 = 两栖车 (kind 'amph'), 1 = 艇 (kind 'boat')
for(let t=0;t<2;t++) for(let k=0;k<2;k++){
const n=Math.max(0,nN[k]|0);
for(let i=0;i<n;i++){
const ord=(k===0?0:n0)+i;
const c=new NavalCraft(keys[k][t],t,ord);
const sp=navalMusterSpot(t,ord);
if(sp){
// ★2026-09-26E (审计 10): 落位高度 = 水面 − **吃水** (15d navalDraftOf 单源) —— 旧版写水面高,
// 10 台舰艇开局全部浮高 0.4~0.95m 再由 _attitude 阻尼 (k=9) 在 0.3~0.5s 内沉下去
// (玩家选"⚓ PT 艇"出生能直接看到这个下沉弹跳)。与 15d respawn 的物理基准 pos.y=wy-draft 逐式对齐。
const dy=(typeof navalDraftOf==='function')?navalDraftOf(c):0;
const py=sp.y-dy;
c.yaw=sp.face;
if(c.pos&&c.pos.set) c.pos.set(sp.x,py,sp.z);
if(c.baseY!==undefined) c.baseY=py;
if(c.grp){ c.grp.position.set(sp.x,py,sp.z); c.grp.rotation.y=sp.face; }
}
}
}
}
// 海战载具车组补配单源 (★2026-09-26E 审计 1): 开局编制与运行期补配共用这一支。
// 判据与坦克的 pickIdleDeployVehicle 同规 (活着/同队/无乘员/非玩家驾驶/未沉没/血量≥40%),
// 外加海战特有的 state 门 (sinking/wreck 不配人 —— 15d 的 drive 门 (driverBot||crewBot) 会让
// 残骸继续"有人", 且救不回来)。返回补配台数 (供探针断言)。
// 补配 Bot 的取名 (startMatch 的 nextName 是它的**局部闭包**, 提到模块级就看不见了 ⇒ 这里自取一份;
// 名字纯观感、不参与任何判据, 用一个模块级计数器错开, 与开局那批不重名)。
let _crewNameI=[0,0];
function crewBotName(team){
let nm=["车组"];
try{ if(typeof TEAM_FACTION!=="undefined"&&TEAM_FACTION[team]&&TEAM_FACTION[team].names) nm=[...TEAM_FACTION[team].names]; }catch(e){}
return nm[(_crewNameI[team]++)%nm.length];
}
function navalCrewFill(){
if(typeof navalCraft==='undefined'||!Array.isArray(navalCraft)) return 0;
let n=0;
for(const c of navalCraft){
if(!c||!c.alive) continue;
if(c.crewBot||c.driverBot||c.playerDriven) continue;   // 已有车组 / 玩家已在驾驶 → 不重复配人
if(c.state==='sinking'||c.state==='wreck') continue;
if(c.hp<(c.maxHp||c.hp||1)*0.4) continue;
const b=new Bot(c.team,CLS_POOL[randi(0,CLS_POOL.length-1)],crewBotName(c.team));
b.spawnInVehicle(c);
n++;
}
return n;
}
function startMatch(){
// 场景台账边界 (2026-09-16 本批): 此刻 world 里全是从 CAMPAIGN 生成的布局对象, 之后新增的都属于"本局"
// (工程兵工事/迫击炮/医疗箱/残骸…)。就地换局时 retireMatchActors 按这条边界整段摘除, 不必逐个系统去记。
// 只在第一次开局时记录: 换局时沿用首次的边界值, 才能把"上一局新增的一切"连同本局新增一起清掉。
if(typeof window.__sfMatchWorldStart!=='number') window.__sfMatchWorldStart=world.children.length;
if(typeof ACH!=='undefined'&&ACH.onFreshMatch) ACH.onFreshMatch(); // 成就普查账 (2026-11-11 成就批): startMatch = 新局世界必然 pristine 的唯一漏斗
const names0=[...TEAM_FACTION[0].names].sort(()=>Math.random()-0.5);
const names1=[...TEAM_FACTION[1].names].sort(()=>Math.random()-0.5);
const nameIdx=[0,0];
const nextName=t=>(t===0?names0:names1)[nameIdx[t]++%(t===0?names0:names1).length];
	// 开局批量生成的位置修正 (2026-09-20): 归属必须先算, 否则候选出生点位只剩主基地 1 个。
	applyFlagOwnership();
		// (2026-11-10: 开局大舰编制 ensure/spawn 钩随大舰子系统下架摘除)
	for(let t=0;t<2;t++){
	if(ZOMBIE_MODE==='solo'&&t!==player.team) continue;   // 单队合作: 只生成玩家一队 (丧尸潮=第三方, 2026-10-06)
	const bMul=CAMPAIGN.botMul||[1,1];
	const bN=[Math.max(2,Math.round(BOTS_PER_TEAM*bMul[0])),Math.max(2,Math.round(BOTS_PER_TEAM*bMul[1]))];
	const n=bN[t]-(t===player.team?1:0);
	// 劫道方(ATK)反坦克火力翻倍: 兵种池偏向反坦克兵 (2026-09-28 兵种 8→5 重映射: 反坦克=3, 工程=4)
	const AT_POOL=[0,0,1,1,2,3,3,3,3,3,4,4,4,4];
	const pool=(GAMEMODE==='convoy'&&t===ATK)?AT_POOL:CLS_POOL;
	for(let i=0;i<n;i++){
	const cls=pool[randi(0,pool.length-1)];
	const bot=new Bot(t,cls,nextName(t));
	bot.spawn();
	}
	}
// 组建玩家小队: 挑3名本方步兵
// 2026-09-19 修正: 排除坦克乘员 —— 旧版按数组顺序取人, 而 soldiers 里最前面几个正是
// startMatch 为坦克/战机配的车组 (spawnInVehicle 在步兵之后创建), 于是小队名额被车组占掉:
// 3 名队员一直"随车"不在玩家身边, 小队指令形同虚设。
// 2026-09-21 A#7: 三人车组的司机 (crewBot, onVehicle 非空) 同样排除 —— 车组不进小队。
// (契约 §4 v3: 后 2 人是 Tank.crewSlots 轻量名额, 不在 soldiers 里, 无需在此排除)
for(const s of soldiers){
if(SQUAD.members.length>=3) break;
if(s.team===player.team&&!s.onVehicle&&!s.pilotOf&&!s.inSquad){   // (2026-11-10: capCrew 项随大舰子系统下架摘除)
s.inSquad=true;
SQUAD.members.push(s);
s.mesh.tag.material.color.set(0xffffff);
// 开局站位: 以玩家为圆心均匀铺开 (旧版直接贴玩家落点, 3 个人叠在 1m 内)
const ang=(SQUAD.members.length-1)/3*TAU+rand(-0.3,0.3);
const rr=rand(6,9);
const wx=player.pos.x+Math.cos(ang)*rr, wz=player.pos.z+Math.sin(ang)*rr;
if(!occBlocked(wx,wz)&&(typeof freeSpot!=='function'||freeSpot(wx,wz,0.6))&&(typeof spawnEdgeOk!=='function'||spawnEdgeOk(wx,wz))){   // 出生离边门 (2026-11-13): 小队铺开也不进边带
// 死袋闸 (2026-09-26 补): 小队这 3 人走的是**独立落点** (不经 pickSpawnPoint), 旧版只查站得住 ——
// 实测他们会落进 1 格死袋/封锁格 (诺曼底/塔拉瓦各抓到), 而那是最显眼的三个"站在玩家身边的木头人"。
// 与出生筛选同源: NAV.spawnSpot 把落点就近搬到"走得出去"的位置 (最多 12m, 小队仍在玩家视野内)。
let sx=wx, sz=wz;
if(typeof NAV!=='undefined'&&NAV.spawnSpot){ const sp=NAV.spawnSpot(wx,wz,12); sx=sp[0]; sz=sp[1]; }
s.pos.set(sx,0,sz); s.pos.y=standHeight(sx,sz,12);   // (2026-11-10: 甲板出生高度随大舰子系统下架摘除)
}
s.pickObjective();
}
}
	// 坦克数量: 按战役配置 (默认每队2辆; 遭遇战翻倍; 劫道护运方有坦克/劫道方无)
	const tN=CAMPAIGN.tankN||[2,2];
	for(let t=0;t<2;t++){ if(ZOMBIE_MODE==='solo'&&t!==player.team) continue; for(let v=0;v<tN[t];v++) new Tank(t,v%2); }
	// 飞机数量 (2026-09-20N 海战批): 删掉旧硬编码的 4 架 (new Plane(0,0);new Plane(0,1);new Plane(1,0);
	//   new Plane(1,1);), 改读战役数据表 CAMPAIGN.airN —— 塔拉瓦 airN=1 (用户裁定"飞机也缩减"
	//   ⇒ 全图 1 架, 全归主攻方美军 team0)。
	//   **未给 airN 的其余 12 张图退回改造前的旧编制 (每队 2 架)** —— 这一条不能省: "其余 12 张图零行为
	//   变化"是验收红线 1, 顺手把 12 图的飞机从 4 架砍成 1 架就是实打实的行为漂移 (与下面海战守卫同理)。
	const airT=CAMPAIGN.airN;
	// P4 (2026-09-30): airN 允许写成数组 = **双方**各多少架 (全海图两边都从自家航母起飞, 没有"只有攻方有
	//   飞机"的不对称可言)。标量仍旧口径 [airT,0] = 只有攻方有飞机 —— 既有 13 张图逐字不变。
	const airPerTeam=Array.isArray(airT)?[airT[0]|0,airT[1]|0]:((airT===undefined)?[2,2]:[airT,0]);
	for(let t=0;t<2;t++){ if(ZOMBIE_MODE==='solo'&&t!==player.team) continue; for(let v=0;v<airPerTeam[t];v++) new Plane(t,v%2); }
	// (2026-11-10: 舰载机甲板停放 capParkPlanes 钩随大舰子系统下架摘除)
// 海战载具编制 (2026-09-20N 海战批, 用户裁定"每队 2 坦克 + 2 两栖车 + 3 艇"): 只在有海面且战役显式
	//   给了 navalN 的图生成 (塔拉瓦); 其余 12 图 SEA=null ⇒ 零海战载具、零新增世界对象。
	//   typeof 守卫: 15d-naval 未加载的脚本链 (dev/verify-boot 的 12 图 LOAD 断言、部分探针) 不许因它报错。
	if(SEA&&CAMPAIGN.navalN&&typeof NavalCraft==='function') spawnNavalOrbat();
	// (2026-11-10: 大舰编制生成段随大舰子系统下架摘除 —— CAMPAIGN.capital 已随两海战图取消)
// 劫道模式: 沿公路生成护运车队 (纯AI, 不可驾驶)
	if(GAMEMODE==='convoy'&&CAMPAIGN.convoy) spawnConvoy(CAMPAIGN.convoy);
// 每车 1 名真实 AI 车组 (契约 §4 **v3 修订**; ★2026-11-28 票账批: 旧 crewSlots 名额记账已删, 车内只算驾驶员)。
// 口径: 每车 = 1 名真实 Bot 驾驶员 (crewBot, 唯一跑 AI 的) —— 所以这里**只创建 1 名 Bot**。
// 为什么: 各图 tankN=2~8 而 BOTS_PER_TEAM=11, 若每车配 3 名真 Bot, 诺曼底一队 11→21 人、斯大林格勒 14→30 人,
// 是用户未要求的平衡破坏。**全队 soldiers.length 必须与改造前一致** (本条的验收红线之一)。
for(const t of tanks){
const b=new Bot(t.team,CLS_POOL[randi(0,CLS_POOL.length-1)],nextName(t.team));
b.spawnInVehicle(t);
}
for(const pl of planes){
const b=new Bot(pl.team,CLS_POOL[randi(0,CLS_POOL.length-1)],nextName(pl.team));
b.pilotOf=pl;
pl.pilotBot=b;
b.spawnInVehicle(pl);
}
// 海战载具车组 (2026-09-20N 海战批): 每台艇/两栖车配 1 名 Bot —— 与坦克同款 spawnInVehicle(载具)。
// **不实现任何载人/卸兵/跳板放人机制** (用户裁定"不要有运兵船, 只有战斗船。两栖车也一样"):
// 一台载具永远只有 1 名车组, 没有乘员舱位、没有待卸步兵队列、没有抢滩放人脚本。
// ★2026-09-26E (审计 1): 从 startMatch 里抽成**可重入**的单源 navalCrewFill() —— 旧版只写死在这里,
//   是全库唯一一次配车组 ⇒ 艇的车组一旦被玩家接管 (20a 上艇即遣散车组) 或随艇沉没落水, 该艇永久
//   变成"漂在集结点、不动、不开火的空壳", 被击沉还照扣 4~5 票 (每台空艇每 ~60s 白送票)。
//   现在 15d 的 respawn() 与 14-bots 的部署扫描都调它 (与坦克的"车上认领 + 部署认领"两条路同规)。
navalCrewFill();
// 本页已开过局的标记 (2026-09-16 本批): 对局实体只增不减, 就地重开前必须先让上一局整体退场 ——
// beginFreshMatch (22-hud) 据此判断"世界还干净, 直接开局"还是"已经开过一局, 要先 retireMatchActors 退场"
window.__sfMatchSpawned=true;
// 指挥官编制生成 (2026-10-26 指挥官批, 设计 §5): 挂**世界构建尾** —— 此刻步兵/坦克/飞机/车组全部
// 落成而玩家尚未部署 (探针口径: 编制在玩家未部署时即存在)。步兵 3~5 人一组 ceil(n/5), 载具各成单位;
// 不开放图 (丧尸/海战) 也照建 (编制本身无副作用), 是否出兵种卡由 cmdClassAvailable 另管。
if(typeof cmdOrbatBuild==='function') cmdOrbatBuild();
}
