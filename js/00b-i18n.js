// ─────────────────────────────────────────────
// 00b-i18n.js —— 中英双语 (2026-09-13 正规化)
// 设计: 中文原文即键 —— t('占领 {0} 点', f.id) 带参插值; t('弹药已补充') 直查;
//      静态 HTML 标 data-i18n(纯文本)/data-i18n-html(含<b>等标签), applyI18n() 统一替换;
//      语言存档 sf_lang ('zh' 默认 / 'en'), 切换按钮在 游戏设置, 切换即重载生效。
// 覆盖范围: 全部菜单/设置/说明/部署/结算/暂停 + HUD 高频动态文案 (得分角标/播报/载具武器名)。
// 地图专名 (旗点/出生点名) 保留原文 —— 属于战场地名而非 UI 文案。
// ─────────────────────────────────────────────
'use strict';
const LANG=localStorage.getItem('sf_lang')==='en'?'en':'zh';
const I18N_EN={
// ── 通用 UI ──
'开 始 游 戏':'START','游 戏 设 置':'SETTINGS','游 戏 说 明':'FIELD MANUAL',
'战 绩 数 据':'RECORDS',
'继 续 游 戏':'CONTINUE','新 游 戏':'NEW GAME','开 始 新 游 戏':'START NEW GAME',
'开始新游戏会放弃当前未决出胜负的战局':'Starting a new game abandons the current match',
'确定开始新游戏？当前未决出胜负的战局将被放弃。':'Start a new game? The current match will be abandoned.',
'进 入 战 场':'DEPLOY','返 回':'BACK','返 回 战 斗':'BACK TO COMBAT','部 署':'DEPLOY',
'返 回 主 界 面':'MAIN MENU',
'确定返回主界面？当前战局将被冻结，可从主界面继续。':'Return to the main menu? The battle freezes and can be resumed from the menu.',
'再 来 一 局':'PLAY AGAIN','继 续 战 斗':'RESUME','已 暂 停':'PAUSED',
'STEEL FRONT · 第二次世界大战':'STEEL FRONT · WORLD WAR II',
// ── 开局: 战役/阵营/人数 ──
'战役':'CAMPAIGNS','点击卡片选择战役':'Click a card to pick a battle','选择阵营':'FACTION',
'BOT 难度':'BOT DIFFICULTY','新兵':'Recruit','老兵':'Veteran','精英':'Elite',
'在场人数':'SERVER SIZE','标准 11v11':'Standard 11v11','加强 16v16':'Reinforced 16v16','史诗 22v22':'Epic 22v22','超编 30v30':'Oversized 30v30',
'兵力票池':'TICKET POOL','×0.5':'×0.5','×1':'×1','×2':'×2',
'📁 占旗点战役 ({0})':'📁 Flag Campaigns ({0})','攻防 · 征服 · 拉锯':'Assault · Conquest · Tug','‹ 返回':'‹ Back',
' · 当前{0}':' · now {0}','攻防':'Assault','拉锯':'Tug','征服':'Conquest',
// ── 设置 ──
'画质':'QUALITY','低画质':'Low','中画质':'Medium','高画质·滤镜·软阴影':'High · Filter · Soft Shadows',
'鼠标灵敏度':'Mouse Sensitivity','音量':'Volume','触控按键大小':'Touch Button Size',
'语言 / Language':'LANGUAGE / 语言','中文':'中文','English':'English',
'实验模式':'EXPERIMENTAL',
// 2026-09-20N 补漏 (wreck-art 的跨图审计在 EN 模式下抓到): 22-hud:1014 用
//   `t(EXPERIMENT?'开':'关')` 拼接"实验模式: 开/关", 但这两个单字键此前不在词典里 ⇒
//   EN 界面渲染出 "⚙ EXPERIMENTAL: 关" (中英混杂). 全仓只有这一处取到这两个键.
'开':'ON','关':'OFF',
// 瞄准吸附 (2026-09-27): 档位按钮 + 设置说明 —— 与'画质'同段.
'瞄准吸附':'AIM ASSIST','轻度':'Light','标准':'Standard',
// 昼夜选择 (2026-10-05 设计 N1): 开始游戏面板, 与难度同段
'昼夜':'DAY / NIGHT','白天':'Day','黑夜':'Night','本图固定为黑夜':'This map is night-only',
// 天气选择 (2026-10-05 天气设计纲要 §5-11): 五按钮 + 生效档提示 —— 四档按钮文案由 22-hud 按图族
//   JS 解析 (data-wx 恒为四档键, 雪图换雪文案), 词典仍单源; 常规图/雪图各一套四档名。
'天气':'WEATHER','跟随地图':'Map Default','本图={0}':'Map: {0}',
'晴朗':'Clear','多云':'Cloudy','小雨':'Light Rain','暴雨':'Storm',
'雪停':'Snow Ends','细雪':'Light Snow','中雪':'Moderate Snow','暴风雪':'Blizzard',
// 夜档照明装备 (2026-10-05 设计 N2): L 键大灯提示
'大灯开启 · 看得清路, 也看得见你':'HEADLIGHTS ON · you see the road, they see you',
'大灯关闭':'HEADLIGHTS OFF',
// 操作方式分组 (2026-09-28 D2): 旧"操控: xx"JS拼接按钮改三并列按钮, 档位文案随之进词典
'操作方式':'CONTROLS','自动':'Auto','触屏':'Touch','键鼠':'Mouse & Keys',
'自动 = 按设备自动检测; 手柄连接后只在战斗中接管, 菜单与部署界面仍用键鼠/触屏。切换后重载生效。':'Auto = detect the device. A connected gamepad takes over in combat only; menus and deploy still use mouse, keyboard or touch. Reloads to apply.',
'普通瞄准/开镜/载具火力的弹道, 在<b>差一点点打中</b>时会被轻轻掰向目标; 明显打偏时不起作用, 隔墙/穿过队友一律不吸。改档即时生效。':'Hip-fire, ADS and vehicle fire bend slightly toward a target you <b>almost</b> hit. Big misses are unaffected, and it never pulls through walls or teammates. Applies instantly.',
'<b>瞄准吸附</b>(游戏设置内, 默认「轻度」): 差一点点打中的那一枪会被轻轻掰向目标 —— 普通瞄准/开镜/载具火力(主炮·机枪·炮位)都生效, 明显打偏时不起作用, 隔墙或穿过队友一律不吸。':'<b>AIM ASSIST</b> (in Settings, default "Light"): a shot that <i>just</i> misses bends slightly toward the target — hip-fire, ADS and vehicle fire (main gun, machine guns, emplacements) alike. Big misses are unaffected, and it never pulls through walls or teammates.',
// ── 部署 ──
'兵种':'CLASS','出生点':'SPAWN POINT','战场态势':'TACTICAL MAP',
'你被 {0} 击杀了':'You were killed by {0}',
'本次存活 {0} · 击杀 {1} · 获得 +{2} 分':'Survived {0} · {1} kills · +{2} pts',
'本局总计 {0} 杀 / {1} 死 / {2} 分':'Match: {0} kills / {1} deaths / {2} pts',
'⚠ 己方兵力已耗尽 · 本局无法再部署 · 等待清场结算':'⚠ Tickets depleted · redeploy disabled · awaiting wipe',
// ── 结算 ──
'胜  利':'VICTORY','战  败':'DEFEAT','平  局':'DRAW',
'本局得分':'SCORE','本图最高':'MAP BEST','新纪录!':'NEW RECORD!',
'击杀数':'KILLS','阵亡数':'DEATHS','最大连杀':'BEST STREAK','爆头数':'HEADSHOTS','占领点':'CAPTURES','K/D 比':'K/D',
'击杀':'Kill','阵亡':'Death',
'战 场 态 势 · 按 M 关闭':'TACTICAL MAP · M to close','战斗冻结 · 按 ESC 继续':'Combat frozen · press ESC to resume',
'本图最高 {0}':'Map best {0}','本图最少 {0}':'Map fewest {0}','本图暂无记录':'No record yet',
// ── 战绩数据面板 (2026-09-16 记录批) ──
'历 史 战 绩':'SERVICE RECORDS','各图历史最佳成绩':'Best results per map',
'箭头 ↓ = 该项越少越好 · 观战模式的对局不计入历史记录':'↓ = lower is better · spectator matches are not recorded',
'地图':'MAP','已战 {0} 局':'{0} matches','未 征 战':'NO RECORD',
'观战模式 · 本局不计入历史记录':'SPECTATOR MODE · THIS MATCH IS NOT RECORDED',
'票':'tickets','在场':'in field','得分':'SCORE',
'机体 {0}%':'Airframe {0}%','装甲 {0}%':'Armor {0}%','高度 {0}m':'Alt {0}m','就绪':'READY','全自动':'Full-auto',
'穿甲弹':'AP shell','高爆弹':'HE shell','导弹视角':'Missile cam',
'A/D 压坡转向 · 鼠标拉杆 · 炸弹 ×{0} [右键/B]':'A/D bank · mouse stick · bombs ×{0} [RMB/B]',
'主基地':'Main Base','随车队':'With Convoy','{0} 点':'Flag {0}',' (占用)':' (busy)',' (重生 {0}s)':' (respawn {0}s)',
'AT雷[3]×{0}':'AT mines[3] ×{0}','燃烧弹[6]×{0}':'Incendiary[6] ×{0}','燃烧弹[6]×2':'Incendiary[6] ×2',
'绷带×{0}':'Bandages ×{0}','AT雷×{0}':'AT mines ×{0}','主炮[左键] · 机枪[右键] · 视角[F]':'Main gun [LMB] · coax [RMB] · view [F]',
'鼠标 制导 · 左键 自爆 · 右键 加速 · F 切换视角':'Mouse guide · LMB detonate · RMB dash · F view',
'手雷 ×{0}':'Grenades ×{0}','绷带[H] ×{0}':'Bandage[H] ×{0}','AT雷[3] ×{0}':'AT mine[3] ×{0}',
'烟雾[4] ×{0}':'Smoke[4] ×{0}','燃烧[6] ×{0}':'Incendiary[6] ×{0}','医疗箱[B]':'Medkit[B]',
'攻防战 · 攻方占超一半且守方仅余1点→守方兵力流失 · 任意一方占满全部旗点→敌方兵力归零 · 全旗+歼灭残兵两条件齐备才判胜{0}':'Assault · attacker majority + defenders down to 1 flag bleeds their tickets · all flags = wipe · win needs all flags + survivors wiped{0}',
' · <span style="color:#9fd4e8">浅滩涉水减速 · 深水主河须过石桥</span>':' · <span style="color:#9fd4e8">shallows slow wading · deep main river needs the stone bridge</span>',
' · <span style="color:#9fd4e8">礁盘涉水 · 深水游泳[Shift下潜] · 水下憋气有限</span>':' · <span style="color:#9fd4e8">wade the reef flat · swim in deep water [Shift to dive] · breath is limited</span>',
// ── 水体/游泳 (2026-09-18 塔拉瓦批) ──
'憋气':'BREATH','憋气中 · [Shift] 下潜 · [空格] 上浮':'Holding breath · [Shift] dive · [Space] ascend',
'⚠ 溺水! 快上浮':'⚠ DROWNING! Ascend now','游泳中 · [Shift] 下潜':'Swimming · [Shift] dive','呼吸恢复中':'Recovering breath',
'⚠ 涉水熄火! 快倒车离开水面':'⚠ Engine flooded! Reverse out of the water',
'战 场 记 分 板':'SCOREBOARD',
'水中与水下':'WATER & DIVING',
'深水 (>1.35m) 自动转为游泳: 浮在水面, <b>Shift 下潜</b> / <b>空格 上浮</b>, 游泳与潜水时武器背起(不能开火/投掷/架设)。':'Deep water (>1.35m) puts you into a swim: you float at the surface, <b>Shift dives</b>, <b>Space ascends</b>, and your weapon is slung (no firing, throwing or bracing).',
// 同一行的 ">" 变体: data-i18n-html 的键取 el.innerHTML, 浏览器序列化文本节点时会把 '>' 转成 '&gt;' ——
// 两版都收, 英文界面才不会漏译这一行 (2026-09-18b)
'深水 (&gt;1.35m) 自动转为游泳: 浮在水面, <b>Shift 下潜</b> / <b>空格 上浮</b>, 游泳与潜水时武器背起(不能开火/投掷/架设)。':'Deep water (>1.35m) puts you into a swim: you float at the surface, <b>Shift dives</b>, <b>Space ascends</b>, and your weapon is slung (no firing, throwing or bracing).',
'水下憋气约 <b>22 秒</b>, 耗尽后持续溺水掉血, 出水 4 秒回满; 潜水时被水面遮蔽(岸上难以发现), 子弹与炮弹入水即失能。':'You can hold your breath for about <b>22 seconds</b>; past that you drown steadily, and surfacing refills it in 4s. Diving hides you from the shore, and bullets or shells that hit the water are stopped by it.',
'滩头礁盘可涉水据枪(精度下降), 岸防炮与木桩/龙牙/铁丝网布在礁盘上; 长栈桥桥下可潜泳穿过。':'You can wade the reef flat and still shoot (with worse accuracy); beach obstacles and coastal guns sit on the reef, and you can swim beneath the long pier.',
// ── 海战载具 (2026-09-20N 海战批) ──
'两栖车':'AMPHIBIOUS','快艇':'FAST BOAT',
'LVT(A)-1 两栖坦克':'LVT(A)-1 Amtank','特二式内火艇 カミ':'Type 2 Ka-Mi','PT 艇':'PT Boat','九三式鱼雷艇':'Type 93 Torpedo Boat',
'37mm M6 炮':'37mm M6 gun','37mm 炮':'37mm gun','37mm 艇艏炮':'37mm bow gun','25mm 机炮':'25mm cannon',
'双联 .50 机炮':'Twin .50 cal','同轴机枪':'Coax MG',
'鱼雷 ×{0}':'Torpedoes ×{0}','鱼雷 ×{0} · 装填 {1}s':'Torpedoes ×{0} · reloading {1}s','鱼雷发射!':'TORPEDO AWAY!','鱼雷装填中':'Reloading torpedoes','鱼雷发射管已失效':'Torpedo tube disabled',
'[左键] 主炮 · [右键] 机炮 · [F] 鱼雷':'[LMB] main gun · [RMB] autocannon · [F] torpedo',
'[左键] 主炮 · [右键] 机炮':'[LMB] main gun · [RMB] autocannon',
'吃水 {0}m · 水深 {1}m':'Draft {0}m · Depth {1}m',
'⚠ 搁浅! 倒车脱困':'⚠ AGROUND! Reverse out',
'⚠ 进水! 舰体正在下沉':'⚠ TAKING WATER! Going down',
'弃船! 快游开':'ABANDON SHIP! Swim clear',
'发动机':'Engine','航速':'Throttle','舰体':'Hull',
'反舰炮台':'Coastal Battery','反舰炮台已摧毁':'Coastal battery destroyed',
'岸防炮位 · 面海':'Coastal battery · seaward',
// 2026-09-20N task-5 追加: 玩家上艇链的三条文案 (中文原文即键)
'你接管了 {0}':'You have taken the {0}',
'<b>F</b> 下船 · <b>W/S</b>驾驶 <b>A/D</b>转向 <b>左键</b>主炮 <b>右键</b>机炮':'<b>F</b> disembark · <b>W/S</b> throttle <b>A/D</b> steer · <b>LMB</b> main gun · <b>RMB</b> autocannon',
'该载具无鱼雷发射管':'This craft has no torpedo tubes',
// 2026-09-21 炮手观测链 (WS2 · C 键三态 + 炮手镜) —— 中文原文即键, 与 19-input/20-player/22-hud 的文案逐字同源
'炮手镜 · 稳像倍镜':'Gunner optic · stabilized sight',
'炮手镜':'Gunner optic',
'艏向第一人称':'Bow first person',
'<b>C</b> 炮手镜 (稳像)':'<b>C</b> gunner optic (stabilized)',
'<b>C</b> 视角: 追尾':'<b>C</b> view: chase',
'<b>C</b> 视角: 艏向':'<b>C</b> view: bow',
'塔拉瓦环礁 1943':'Tarawa Atoll 1943','珊瑚滩头 · 环礁登陆':'Coral beachhead · Atoll landing','攻防·美军登陆':'Assault · US landing',
'破袭战 · 剩余补给库: {0}/{1}':'Sabotage · depots left: {0}/{1}',
// ── 战局播报 (21-match) ──
'{0} 占领了 {1} 点':'{0} captured flag {1}','占领 {0} 点':'CAPTURE {0}',
'⚠ {0} 占领了全部旗点 · {1} 兵力归零 · 消灭其场上残兵方可获胜':'⚠ {0} holds every flag · {1} tickets drained · wipe their survivors to win',
'补给库 {0} 被摧毁!':'Depot {0} destroyed!',
'胜负已定 · {0} · {1} 秒后结算':'Outcome decided · {0} · settling in {1}s',
'平局':'Draw','胜利在望':'victory imminent','败局在即':'defeat looming',
'须占领全部旗点(余 {0} 点)+ ':'must hold all flags ({0} left) + ',
'⚠ {0} 兵力耗尽 · {1} {2}消灭其场上残兵方可获胜':'⚠ {0} tickets gone · {1} {2}must wipe their survivors to win',
'⚠ {0} 场上仅剩最后 1 人 · {1} 秒清场倒计时 · 到时限未被歼灭则直接判负':'⚠ {0}: last man standing · {1}s wipe timer · they lose when it expires',
'⏳ 清场倒计时结束 · {0} 最后一人仍存活 · {1} 获胜':'⏳ Wipe timer expired · {0} last man survived · {1} wins',
'我方 {0} 已重生':'Our {0} has respawned','你':'YOU',
// ── 连杀 ──
'击杀':'Kill','爆头击杀':'HEADSHOT',
'双杀':'DOUBLE KILL','三连杀':'TRIPLE KILL','四连杀':'QUAD KILL','五连杀':'5 KILLSTREAK','六连杀':'6 KILLSTREAK','七连杀':'7 KILLSTREAK','八连杀':'8 KILLSTREAK','九连杀':'9 KILLSTREAK',
'{0} 连杀':'{0} KILLSTREAK',
'连杀奖励 · {0} (得分×{1}, {2}s)':'Killstreak · {0} (score ×{1}, {2}s)',
'战意·壹':'Fervor I','战意·贰':'Fervor II','战意·叁':'Fervor III',
' · 主炮加速':' · Main gun boost',' · 航炮加速':' · Aircraft guns boost',' · 枪管降温':' · Barrel cooling',' · 射速提升':' · Fire rate up',
// ── 兵种 ──
'步枪兵':'Rifleman','冲锋枪手':'SMG Gunner','突击兵':'Assault','狙击手':'Sniper',
'医护兵':'Medic','反坦克兵':'Anti-Tank','迫击炮兵':'Mortarman','工程兵':'Engineer','巡飞弹兵':'Loiter Munition Troop',
// ── 阵营 ──
'盟军':'Allies','德军':'Wehrmacht','苏军':'Red Army','国军':'NRA','八路':'8th Route','日军':'IJ Army',
'美国陆军':'US Army','德意志国防军':'German Wehrmacht','苏联红军':'Soviet Red Army','日本帝国陆军':'Imperial Japanese Army','国民革命军':'National Revolutionary Army','八路军':'Eighth Route Army',
// ── 战役 (标题/副题/模式名) ──
'诺曼底 1944':'Normandy 1944','乡野田园 · 树篱丛生':'Bocage country · hedgerow maze','攻防·盟军进攻':'Assault · Allies attack',
'斯大林格勒 1942':'Stalingrad 1942','严冬巷战 · 废墟工厂':'Winter urban combat · ruins & factories','征服·十四点争夺':'Conquest · 14 flags',
'柏林 1945':'Berlin 1945','帝国末日 · 逐街攻坚':'End of the Reich · street by street','攻防·苏军进攻':'Assault · Red Army attack',
'淞沪会战 1937':'Battle of Shanghai 1937','水乡血战 · 圩田水网':'Bloody water country · polder & canals','攻防·日军进攻':'Assault · IJA attack',
'百团大战 1940':'Hundred Regiments 1940','黄土沟壑 · 破袭铁路':'Loess ravines · rail sabotage','破袭·摧毁补给':'Sabotage · destroy depots',
'滇缅公路 1944':'Burma Road 1944','密林穿插 · 雨林争夺':'Jungle infiltration · rainforest fight','征服·丛林四点':'Conquest · 4 jungle flags',
'莫斯科保卫战 1941':'Battle of Moscow 1941','城市边缘 · 街垒纵深':'City outskirts · barricade depth','攻防·德军进攻':'Assault · Wehrmacht attack',
'胡康河谷 1943':'Hukawng Valley 1943','大龙河巨桥 · 三路拉锯':'Tanai grand bridge · three-way tug','拉锯·大桥七点':'Tug · 7 flags at the bridge',
'草原遭遇 1943':'Steppe Encounter 1943','库尔斯克 · 钢麦绞杀':'Kursk · Steel and Wheat','遭遇战·强点绞杀':'Clash · strongpoint grind',
'当前：{0}':'Now: {0}','点开选择战役':'Open to pick a battle',
'遭遇战 · 夺取强点推进战线 · 兵力打空后需清场残敌方胜':'Clash · take strongpoints to advance · after tickets run out, wipe remaining enemies to win',
'{0} 占领了强点「{1}」':'{0} captured strongpoint "{1}"','⚠ 强点「{0}」失守':'⚠ Strongpoint "{0}" lost',
'⚠ 炮击! 弹片横飞 — 卧倒或找顶盖(建筑/碉堡)':'⚠ Shelling! — go prone or find cover (buildings/bunker)',
'强点':'strongpoint','主强点':'main strongpoint',
'雾林守线 1944':'Hürtgen Holdout 1944','许特根雾林 · 西墙节节设防':'Hürtgen fog forest · Westwall defence in depth','攻防·美军进攻':'Assault · US Army attack',
'断崖公路 1940':'Cliff Road 1940','伏击山谷 · 劫道与反劫道':'Ambush valley · convoy heist & escort','劫道·车队全毁或突围':'Heist · destroy all trucks or let half escape',
// ── 载具 ──
'M4 谢尔曼':'M4 Sherman','M26 潘兴':'M26 Pershing','P-51 野马':'P-51 Mustang','P-47 雷电':'P-47 Thunderbolt',
'T-34/76':'T-34/76','KV-1 重型':'KV-1 Heavy','La-5':'La-5','IL-2 强击机':'IL-2 Sturmovik',
'四号坦克':'Panzer IV','黑豹':'Panther','BF-109':'Bf 109','FW-190':'Fw 190',
'九七式中战车':'Type 97 Chi-Ha','一式中战车':'Type 1 Chi-He','零式舰战':'A6M Zero','一式战 隼':'Ki-43 Hayabusa',
'维克斯6吨':'Vickers 6-Ton','T-26(援华)':'T-26 (Lend-Lease)','霍克III':'Hawk III','伊-16(援华)':'I-16 (Lend-Lease)',
'九七式(缴获)':'Type 97 (Captured)','一式(缴获)':'Type 1 (Captured)','隼(缴获)':'Hayabusa (Captured)','九九式(缴获)':'D3A (Captured)',
// ── 武器 ──
'M1 加兰德':'M1 Garand','M1 卡宾枪':'M1 Carbine','PTRD-41 反坦克枪':'PTRD-41 AT Rifle','STG 44':'StG 44',
'一〇〇式冲锋枪':'Type 100 SMG','三八式步枪':'Arisaka Type 38','三八式骑枪':'Type 38 Carbine',
'中正式(狙击)':'Chiang Kai-shek (Scoped)','中正式步骑枪':'Chiang Kai-shek Rifle','九七式狙击枪':'Type 97 Sniper',
'九七式自动炮':'Type 97 20mm AT','九六式轻机枪':'Type 96 LMG','勃朗宁 BAR':'M1918 BAR',
'南部十四年式':'Nambu Type 14','博伊斯反坦克枪':'Boys AT Rifle','坦克杀手 RPzB54':'Panzerschreck RPzB54',
'巡飞弹发射器':'Loiter Munition Launcher','巴祖卡 M9':'M9 Bazooka','快慢机(盒子炮)':'C96 (Box Cannon)',
'托卡列夫 TT-33':'TT-33 Tokarev','捷克式 ZB-26':'ZB-26','捷格加廖夫 DP-28':'DP-28','春田 M1903':'M1903 Springfield',
'春田 M1903A4':'M1903A4 Springfield','柯尔特 M1911':'M1911 Colt','歪把子(缴获)':'Type 11 (Captured)',
'毛瑟 Kar98k':'Mauser Kar98k','汉阳造八八式':'Hanyang 88','汤普森 M1A1':'Thompson M1A1','波波沙 PPSh-41':'PPSh-41',
'瓦尔特 P38':'Walther P38','老套筒(汉阳早期)':'Hanyang (Early)','花机关 MP18':'MP18',
'莫辛 M38 骑枪':'Mosin M38 Carbine','莫辛-纳甘 M91/30':'Mosin-Nagant M91/30','莫辛-纳甘 PU':'Mosin-Nagant PU',
'轻型迫击炮':'Light Mortar','驳壳枪 C96':'C96 Broomhandle','G33/40 骑枪':'G33/40','Kar98k ZF41':'Kar98k ZF41','MP40':'MP40',
'57mm 反坦克炮':'57mm AT Gun','防空炮':'AA Gun','巡飞弹 · TV制导':'Loiter Munition · TV Guide',
// ── 观战扩展批 (2026-09-17): 观战连狙 + 观战专属幽灵坦克 + 弃弹传送 ──
'观战连狙':'Spectator Auto Sniper','半自动 · 4x':'Semi-auto · 4x','全自动 · 4x':'Full-auto · 4x','幽灵坦克':'Ghost Tank',
'<b>F</b> 召唤幽灵坦克 (观战专属载具)':'<b>F</b> summon the Ghost Tank (spectator vehicle)',
'<b>F</b> 召唤并进入幽灵坦克 (观战专属载具)':'<b>F</b> summon & board the Ghost Tank (spectator vehicle)',
'[左键] 主炮 · [右键] 机炮 · [F] 下船':'[LMB] main gun · [RMB] autocannon · [F] leave craft',
'幽灵坦克 · 观战载具':'Ghost Tank · Spectator Vehicle',
'观战载具 · 免伤 · 不被索敌 · 弹丸穿透':'Spectator vehicle · invulnerable · undetected · shells pass through',
'无差别火力':'Hits both sides','主炮[左键] · 机枪[右键] · 车长镜[C] · 下车[F]':'Main gun [LMB] · coax MG [RMB] · commander optic [C] · dismount [F]',
'<b>F</b> 进入幽灵坦克 (观战专属载具)':'<b>F</b> board the Ghost Tank (spectator vehicle)',
'<b>F</b> 下车 · <b>W/S</b>驾驶 <b>A/D</b>转向 <b>鼠标</b>炮塔 <b>左键</b>主炮 <b>右键</b>机枪 <b>C</b>车长镜 · 观战专属':'<b>F</b> dismount · <b>W/S</b> drive <b>A/D</b> steer <b>Mouse</b> turret <b>LMB</b> main gun <b>RMB</b> coax <b>C</b> optic · spectator only',
'已进入幽灵坦克 · 观战专属载具':'Boarded the Ghost Tank · spectator vehicle',
'弃弹传送 · 已抵达弹体位置':'Round discarded · teleported to its position',
'副武器: {0}':'Secondary: {0}',
'观战模式已开启: 免伤·不被索敌·弹药无限·副武器连狙':'Spectator mode ON: invulnerable · undetected · infinite ammo · semi-auto sniper secondary',
'观战中 · 双击空格=悬停飞行 · H=气动飞行 · 左键开火 · 控弹时T=弃弹传送 · 靠近白车按F上车':'Spectating · double-tap Space hover · H glide · LMB fire · T (while guiding) discard & teleport · F near the white tank to board',
// ── 第三人称批 (2026-09-20): U = 步行第三人称开关 (操作提示 + 切换播报) ──
'第三人称: 开':'Third person: ON','第三人称: 关':'Third person: OFF',
'<b>U</b> 第三人称: 开':'<b>U</b> third person: ON','<b>U</b> 第三人称: 关':'<b>U</b> third person: OFF',
// 触控按钮文案 (与 #touchUI 同批; 桌面端按钮恒隐藏, 但这几条键要齐 —— 移动端切英文时按钮不能留中文)
'视角':'View',
// 2026-09-28C 触控审计: 按钮此前缺键缺 data-i18n ⇒ EN 界面整排中文残留; 本批全量补齐
'开火':'FIRE','瞄准':'AIM','跳':'JUMP','蹲':'CROUCH','趴':'PRONE','换弹':'RELOAD','雷':'NADE','绷带':'BANDAGE',
'互动':'USE','切枪':'SWAP','疾跑':'SPRINT','技能':'SKILL','近战':'MELEE','烟雾':'SMOKE',
'燃烧':'INCEND','AT雷':'AT MINE','小队':'SQUAD','跟随':'FOLLOW','战况':'SCORE',
'建造':'BUILD','迫击炮':'MORTAR','医疗箱':'MEDKIT',   // tSkill 技能键动态文案 (24-main updateTouchVis)
// ── 手柄 (2026-09-28C) ──
'手柄操作':'GAMEPAD',
'插上/连接手柄即自动生效 (Xbox 标准布局): RT 开火 · LT 瞄准 · 左摇杆 移动(推满外圈=疾跑) · 右摇杆 视角/巡飞弹制导 · A 跳 · B 蹲 · X 互动 · Y 换弹 · LB 疾跑(按住) · RB 手雷(按住烹饪) · LS按 切枪 · RS按 近战 · Back 战况(按住) · Start 暂停; 十字键: 上 绷带(H) · 下 趴(Z) · 左 烟雾(4)/工程兵选工事(5) · 右 AT雷(3)。':'Plugging in / pairing a pad enables it automatically (Xbox standard layout): RT fire · LT aim · left stick move (push to the rim to sprint) · right stick look / loiter guidance · A jump · B crouch · X use · Y reload · LB sprint (hold) · RB grenade (hold to cook) · LS click swap weapon · RS click melee · Back scoreboard (hold) · Start pause; D-pad: up bandage (H) · down prone (Z) · left smoke (4) / engineer build select (5) · right AT mine (3).',
'手柄只在战斗中接管, 菜单与部署界面仍用鼠标/触屏; 拔线或回到菜单会自动松开全部按住的键。':'The pad takes over only in combat — menus and the deploy screen stay on mouse/touch; unplugging or leaving to a menu releases every held button.',
'手柄已连接: {0}':'Gamepad connected: {0}','手柄已断开':'Gamepad disconnected',
// ── 工事 ──
'沙袋墙':'Sandbag Wall','铁丝网':'Barbed Wire','拒马':'Hedgehog','重机枪':'HMG',
// ── 载具/据点交互提示 (20-player) ──
'<b>F</b> 跳伞 · <b>W/S</b>油门 <b>A/D</b>压坡转向 <b>鼠标</b>拉杆 <b>左键</b>机枪 <b>右键/B</b>炸弹':'<b>F</b> bail out · <b>W/S</b> throttle <b>A/D</b> bank <b>Mouse</b> stick <b>LMB</b> guns <b>RMB/B</b> bombs',
'<b>F</b> 离开坦克 · <b>WASD</b>驾驶 <b>左键</b>主炮 <b>右键</b>机枪 <b>C</b>炮手镜':'<b>F</b> leave tank · <b>WASD</b> drive <b>LMB</b> main gun <b>RMB</b> coax <b>C</b> gunner optic',
'<b>F</b> 离开机枪':'<b>F</b> leave MG',
'<b>F</b> 离开迫击炮 · <b>左键</b> 发射 · <b>鼠标</b> 调整弹道':'<b>F</b> leave mortar · <b>LMB</b> fire · <b>Mouse</b> arc',
'<b>F</b> 离开反坦克炮':'<b>F</b> leave AT gun','<b>F</b> 离开防空炮':'<b>F</b> leave AA gun',
'<b>F</b> 使用 {0}':'<b>F</b> man {0}','<b>F</b> 使用反坦克炮':'<b>F</b> man AT gun','<b>F</b> 使用防空炮':'<b>F</b> man AA gun',
'<b>F</b> 使用迫击炮 · <b>B</b> 回收':'<b>F</b> man mortar · <b>B</b> recover','<b>F</b> 使用迫击炮':'<b>F</b> man mortar',
'<b>F</b> 补充弹药':'<b>F</b> resupply ammo','<b>F</b> 从运输车补充补给':'<b>F</b> resupply from truck','<b>F</b> 从临时补给点补充补给':'<b>F</b> resupply from cache',
'<b>F</b> 跳海':'<b>F</b> dive overboard','走到舷缘再按 F 跳海':'Walk to the deck edge and press F to dive overboard',
'<b>F</b> 登机 · <b>Space</b> 弹射起飞':'<b>F</b> board plane · <b>Space</b> catapult launch','登上 {0} · Space 弹射起飞':'Boarding {0} · Space to catapult launch',
'<b>F</b> 进入 {0}':'<b>F</b> enter {0}','<b>F</b> 接管 {0}':'<b>F</b> take over {0}',
'进入':'Enter','接管':'Take over',
'使用中… {0}s (移动中止)':'Using… {0}s (move to abort)',
// ── 得分/补给/建造 播报 ──
'弹药已补充':'Ammo resupplied','绷带已补充':'Bandages restocked','运输车补给完成':'Truck resupplied','补充点补给完成':'Cache restocked',
'包扎被打断!':'Bandaging interrupted!','使用被打断!':'Use interrupted!',
'包扎中…':'Bandaging…','医疗箱冷却中 ({0}s)':'Medkit cooldown ({0}s)',
'跳伞!':'Parachute!','迫击炮瞄准中':'Mortar aiming',
'⚠ 激流熄火! 快倒车离开河道':'⚠ Rapids stall! Reverse out of the river',
'MG42 通用机枪':'MG42',
'<b>左键</b> 自爆 · <b>右键</b> 加速 · <b>鼠标</b> 制导 · <b>F</b> 切换视角':'<b>LMB</b> detonate · <b>RMB</b> dash · <b>Mouse</b> guide · <b>F</b> view',
'<b>左键</b> 自爆 · <b>右键</b> 加速 · <b>鼠标</b> 制导 · <b>F</b> 切换视角 · <b>T</b> 弃弹传送':'<b>LMB</b> detonate · <b>RMB</b> dash · <b>Mouse</b> guide · <b>F</b> view · <b>T</b> discard & teleport',
'<b>左键</b> 发射 · <b>鼠标</b> 调弹道 · <b>F</b> 离开':'<b>LMB</b> fire · <b>Mouse</b> arc · <b>F</b> leave',
'<b>F</b> 上炮 · <b>B</b> 靠近回收':'<b>F</b> man mortar · <b>6</b> recover near it',
'观战中 · <b>双击空格</b> 悬停飞行 · <b>H</b> 气动飞行(右键加速) · <b>左键</b> 开火 · 副武器=观战连狙 · 免伤·不被索敌':'Spectating · <b>double-tap Space</b> hover · <b>H</b> glide (RMB dash) · <b>LMB</b> fire · secondary = semi-auto sniper · invulnerable · undetected',
'<b>左键</b> 发射巡飞弹(TV制导) · <b>6</b> 燃烧弹':'<b>LMB</b> launch loiter round (TV) · <b>6</b> incendiary',
'<b>5</b> 工事: {0} ({1}点) · <b>B</b> 建造 · <b>6</b> 架设迫击炮 · 剩 {2} 点':'<b>5</b> piece: {0} ({1} pts) · <b>B</b> build · <b>6</b> deploy mortar · {2} left',
'<b>5</b> 工事: {0} ({1}点) · <b>B</b> 建造 · <b>6</b> 回收迫击炮 · <b>F</b> 上炮 · 剩 {2} 点':'<b>5</b> piece: {0} ({1} pts) · <b>B</b> build · <b>6</b> recover mortar · <b>F</b> man it · {2} left',
'<b>F</b> 拿取绷带':'<b>F</b> take bandages',
'迫击炮已架设 (F 上炮 · 6 靠近回收)':'Mortar deployed (F man · 6 recover near it)',
'需靠近自己的迫击炮才能回收':'Move closer to your mortar to recover it','迫击炮已回收':'Mortar recovered',
'此处无法架设':'Cannot emplace here',   // 2026-09-26: 迫击炮落点门 (06-engineering deployMortar) 的提示
'建造点数不足 ({0}/{1}) — 弹药箱旁按F补给可回满':'Not enough build pts ({0}/{1}) — resupply at an ammo crate',
'此处无法建造':'Cannot build here','超出战场边界':'Outside the battlefield',
'建造中: {0} … (移动取消)':'Building: {0} … (move to cancel)','位置被占用, 建造取消':'Spot taken, build cancelled',
'{0} · 建成 (剩余 {1} 点)':'{0} · built ({1} pts left)',
// 读条回收 (2026-09-28 阶段三 P1)
'拆除中: {0} … (受击/移动/再按取消)':'Demolishing: {0} … (hit/move/press again to cancel)',
'回收中: 迫击炮 … (受击/移动/再按取消)':'Recovering: mortar … (hit/move/press again to cancel)',
'回收中: 迫击炮 …':'Recovering: mortar …',
'已取消':'Cancelled','拆除被打断!':'Demolish interrupted!',
'{0} · 已拆除 (退还 {1} 点)':'{0} · demolished ({1} pts refunded)',
'有战友正在操作机枪, 无法拆除':'A teammate is manning the MG — cannot demolish',
'建造选择: {0} (消耗{1}点 · 按B放置)':'Build: {0} ({1} pts · press B to place)',
'此处放不下医疗箱':'No room for a medkit here','医疗箱已放置':'Medkit placed','+10 补给绷带':'+10 bandage resupply',
// ── HUD 顶栏 ──
'({0}人)':'({0} in field)',
'拉锯战 · 三路渡河: 大桥/北石桥可通车 · 南徒涉滩可涉渡 · 滩外激流不可徒涉':'Tug of war · 3 river crossings: main & north bridge take tanks · south ford wadeable · rapids elsewhere are deadly',
'征服战 · 一方占超一半且对方仅余1点→对方兵力流失 · 占满全部旗点→敌方兵力归零 · 全旗+歼灭残兵两条件齐备才判胜':'Conquest · majority + enemy down to 1 flag bleeds their tickets · all flags drained = wipe · win = all flags + survivors wiped',
'遭遇战 · 无旗点 · 兵力打空后需清场残敌方胜':'Clash · no flags · after tickets run out, wipe remaining enemies to win',
'劫道战 · 毁车过半→劫道方胜, 突围过半→护运方胜 · 劫道方补给 {0} 分钟后失效 · 护运方贴车补{1}':'Heist · half trucks destroyed = heist wins, half escaped = escort wins · heist caches die after {0} min · escort resupplies at trucks{1}',
' · 剩余 {0} 辆 · 已突围 {1}':' · {0} trucks left · {1} escaped',
'⚠ {0} 兵力归零 · {1} 需{2}消灭其场上残兵(剩 {3} 人)方可获胜{4}':'⚠ {0} tickets gone · {1} {2}must wipe survivors ({3} left) to win{4}',
'占满全部旗点(余 {0} 点)+':'hold all flags ({0} left) + ',
' · ⏳ 最后一人清场倒计时 {0} 秒':' · ⏳ last-man wipe timer {0}s',
'观战中 · 免伤 · 不被索敌 · 双击空格悬停/H气动飞行 · 左键可开火 · 控弹时T=弃弹传送 · F=幽灵坦克(观战专属)':'Spectating · invulnerable · undetected · double-tap Space hover / H glide · LMB fires · T (guiding) discard & teleport · F board the Ghost Tank',
'观战中 · 免伤 · 不被索敌 · 双击空格悬停/H气动飞行 · 左键可开火 · 控弹时T=弃弹传送 · F=按状态(幽灵坦克上=下车/舰艇上=鱼雷·下船/其余=召唤幽灵坦克)':'Spectating · invulnerable · undetected · double-tap Space hover / H glide · LMB fires · T (guiding) discard & teleport · F is state-based (Ghost Tank: dismount / craft: torpedo or leave / otherwise: summon Ghost Tank)',
'兵种技能':'CLASS SKILL','工事':'BUILD',
// ── 游戏说明 (FIELD MANUAL) ──
'快速上手':'QUICK START',
'进入战场后: 选兵种 → 选出生点 → 按 <b>部署</b> 落地。跟随小队标记进攻, 站进旗圈占领据点, 活下去比什么都重要。':'After deploy: pick a class → pick a spawn → press <b>DEPLOY</b>. Follow your squad marker, stand in flag circles to capture, and staying alive matters most.',
'基础操作':'BASIC CONTROLS',
'<b>WASD</b> 移动 · <b>Shift</b> 疾跑(机瞄时为屏息稳枪) · <b>空格</b> 跳跃':'<b>WASD</b> move · <b>Shift</b> sprint (hold breath while aiming) · <b>Space</b> jump',
'<b>左键</b> 射击 · <b>右键</b> 机瞄/瞄准镜 · <b>R</b> 装填 · <b>1/2</b> 切换武器 · <b>V</b> 近战':'<b>LMB</b> fire · <b>RMB</b> aim/scope · <b>R</b> reload · <b>1/2</b> weapon slots · <b>V</b> melee',
'<b>C</b> 蹲 · <b>Z</b> 卧倒 · <b>X</b> 在掩体上架枪(大幅提升精度) · <b>Q/E</b> 左右侧身探头':'<b>C</b> crouch · <b>Z</b> prone · <b>X</b> brace on cover (big accuracy boost) · <b>Q/E</b> lean',
// 第三人称 (2026-09-20 第三人称批): 键位 U 的说明条目 —— 措辞与切换播报 '<b>U</b> 第三人称: 开' 同源 (步行=开关生效的场合)
'<b>U</b> 第三人称: 开/关 (步行可用; 开镜或上车时自动回到第一人称)':'<b>U</b> third person: ON/OFF (on foot; ADS or vehicles return to first person)',
'蹲下/卧倒/架枪都会显著降低枪口晃动; 疾跑后停下稍等呼吸恢复再开枪更准。':'Crouch/prone/brace all steady your aim noticeably; after sprinting, pause a beat to catch your breath before shooting.',
'投掷物与医疗':'GRENADES & MEDICAL',
'<b>G</b> 手雷(可按住烹饪引信) · <b>3</b> 反坦克雷 · <b>4</b> 烟雾弹 · <b>6</b> 燃烧弹 · <b>H</b> 绷带包扎(+45生命, 受击会打断)':'<b>G</b> grenade (hold to cook) · <b>3</b> AT mine · <b>4</b> smoke · <b>6</b> incendiary · <b>H</b> bandage (+45 HP, interrupted when hit)',
'燃烧弹: 红色烈焰烟云, 同样遮蔽视线, 云内步兵持续灼烧(突击兵/巡飞弹兵携带)。':'Incendiary: a blazing red cloud that blocks sight and roasts infantry inside (carried by Assault / Loiter troop).',
'医疗箱: 工程兵建造菜单第5件(按<b>5</b>选到后<b>B</b>建造), 放下后队友靠近按 <b>F</b> 取绷带; 受伤后脱战只会缓慢回血到70。':'Medkit: piece #5 in the Engineer build menu (pick with <b>5</b>, build with <b>B</b>); teammates press <b>F</b> near it for bandages. Out of combat you only regenerate slowly up to 70 HP.',
'载具与固定武器':'VEHICLES & EMPLACEMENTS',
'靠近载具/重机枪/反坦克炮/防空炮/迫击炮/弹药箱按 <b>F</b> 使用。':'Press <b>F</b> near vehicles, heavy MGs, AT/AA guns, mortars, or ammo crates to use them.',
'<b>坦克</b>: WASD 驾驶 · 左键主炮(圆环为落点) · 右键同轴机枪 · <b>C</b> 炮手镜 · F 下车; 车速够快可撞塌砖墙':'<b>Tank</b>: WASD drive · LMB main gun (ring shows impact point) · RMB coax MG · <b>C</b> gunner optic · F exit; ram brick walls at speed to smash them',
'<b>飞机</b>: W/S 油门 · A/D 压坡转向 · 鼠标拉杆 · 左键机枪 · 右键/B 投弹 · F 跳伞':'<b>Plane</b>: W/S throttle · A/D bank · Mouse stick · LMB guns · RMB/B bombs · F bail out',
'<b>舰艇/两栖车</b>: W/S 油门 · A/D 转向 · 左键主炮 · 右键机炮 · <b>C</b> 视角三态(追尾→炮手镜→艏向) · F 上/下船(深水时 F=鱼雷)':'<b>Boats & amtracks</b>: W/S throttle · A/D steer · LMB main gun · RMB autocannon · <b>C</b> cycles view (chase → gunner optic → bow) · F board/leave (F = torpedo in deep water)',
'<b>夜战</b>(选图时可选「黑夜」): <b>L</b> 车辆大灯开关 —— 照亮路面也暴露自己; 旗点上空有周期照明弹, 被探照灯照中会招致远距离集火; 黑夜里小地图只显示近距/开火的敌人。':'<b>Night combat</b> (pick "Night" when choosing a map): <b>L</b> toggles vehicle headlights — light the road, and be seen; flares rise periodically over flag points, and searchlight beams draw long-range fire; at night the minimap only shows nearby or recently firing enemies.',
'固定机枪持续射击会过热(屏幕下方热量条), 红色时需停火冷却。':'Fixed MGs overheat on sustained fire (heat bar at screen bottom) — hold fire when red and let them cool.',
'兵种与技能':'CLASSES & SKILLS',
'步枪兵 / 突击兵 / 狙击手 / 反坦克兵 / 工程兵, 各带不同主武器与投掷物; 武器还决定移速(手枪最快)与远距离伤害衰减。落地有 0.5 秒出生保护, 开火立即解除。':'Rifleman / Assault / Sniper / Anti-Tank / Engineer — each with distinct weapons and throwables; your weapon also sets move speed (pistols fastest) and long-range damage falloff. A brief 0.5 s spawn protection on landing; firing ends it instantly.',
'工程兵 <b>B</b> 建造 · 靠近自己工事 <b>B</b> 读条拆除(退点) · <b>5</b> 切换工事(沙袋墙/铁丝网/拒马/MG42/医疗箱) · <b>6</b> 架设/回收迫击炮 · 架好的迫击炮全员可 <b>F</b> 操作':'Engineer <b>B</b> build · <b>B</b> near your own piece to demolish it (timed, refunds pts) · <b>5</b> pick piece (sandbags/wire/hedgehog/MG42/medkit) · <b>6</b> deploy/recover mortar · deployed mortars usable by anyone via <b>F</b>',
'<b>实验模式</b>(游戏设置中开关): 反坦克兵替换为非史实的 <b>巡飞弹兵</b> — 火箭筒式发射器射出小型巡飞弹, 弹上TV制导: <b>F</b> 切换第一/第三视角, 左键自爆, <b>右键加速冲刺</b>(松开回落巡航); 触碰目标/地面即爆, 额外携带燃烧弹(按<b>6</b>)。':'<b>EXPERIMENTAL</b> (toggle in Settings): Anti-Tank becomes the unhistorical <b>Loiter Munition Troop</b> — fires a small loitering munition with onboard TV guidance: <b>F</b> 1st/3rd person, LMB detonate, <b>RMB dash</b> (release to cruise); detonates on contact, plus incendiaries (<b>6</b>).',
'<b>观战模式</b>(实验模式下, 在兵种卡「巡飞弹兵」上再点一次开关): 免伤 · 不被索敌 · 弹药无限, 本局不计入历史记录(只在兵种卡上点开开关又取消的不算)。战斗中开启会先确认, 且<b>下一次部署才生效</b>(关闭立即生效)。<b>双击空格</b>悬停飞行 / <b>H</b> 气动飞行, 两种飞行中<b>左键都能开火</b>; 副武器位换成 <b>观战连狙</b>(半自动·4x, 可开镜); 操控巡飞弹时按 <b>T</b> = 弹体立刻消失并把自身传送到弹体位置。观战者<b>不指挥小队</b>(T/Y 关闭), 出生列表里的坦克/战机/舰艇/两栖车<b>一律标注「观战不可征用」</b>(想开艇请走近按 <b>F</b> 上艇); <b>F</b> = 按需召唤<b>幽灵坦克</b>(全白 · 免伤 · 弹丸穿透 · 可对双方开火, 开场不预置)。观战工具: <b>J</b> 信息层(名字/队属/血量/交火指向线) · <b>K</b> 时停(冻结整个战场与游戏时钟; 你本人 · 正在开的座驾 · 你自己打出的弹丸都不受影响 —— 可以走到任何位置慢慢看, 也可以定点打一发再按 K 把它停在空中; 顶部栏常驻「⏸ 时停中」读数, 回主菜单或战局结束自动解除)。':'<b>SPECTATOR MODE</b> (Experimental on: click the "Loiter Munition Troop" class card a second time): invulnerable · undetected · infinite ammo, and the match is not recorded (merely flicking the switch on and off does not count). Enabling it mid-battle asks for confirmation and <b>takes effect on your next deploy</b> (disabling is immediate). <b>Double-tap Space</b> to hover / <b>H</b> to glide — <b>LMB fires in both flight modes</b>; the secondary slot becomes the <b>Spectator Semi-Auto Sniper</b> (4x, scoped); while guiding a loiter round, <b>T</b> discards it and teleports you to its position. Spectators give <b>no squad orders</b> (T/Y disabled), and every real vehicle in the spawn list (tank/aircraft/boat/amphibious) is marked <b>"unavailable to spectators"</b> (to take a boat, walk up to it and press <b>F</b>); <b>F</b> summons the all-white <b>Ghost Tank</b> on demand (invulnerable · shells pass through · hits both sides · nothing is pre-placed at match start). Spectator tools: <b>J</b> info layer (name/faction/health/targeting lines) · <b>K</b> time-stop (freezes the whole battle and the game clock; you, the vehicle you are driving and your own rounds keep moving — walk anywhere and study it, or fire a round and press K to hang it in mid-air; a permanent "⏸ Time stopped" readout sits in the top bar, and leaving to the main menu or ending the match clears it).',
'<b>观战模式</b>(实验模式下, 在兵种卡「巡飞弹兵」上再点一次开关): 免伤 · 不被索敌 · 弹药无限, 本局不计入历史记录。<b>双击空格</b>悬停飞行 / <b>H</b> 气动飞行, 两种飞行中<b>左键都能开火</b>; 副武器位换成 <b>观战连狙</b>(半自动·4x, 可开镜); 操控巡飞弹时按 <b>T</b> = 弹体立刻消失并把自身传送到弹体位置; 部署界面多出「<b>幽灵坦克</b>」出生项 (全白 · 免伤 · 弹丸穿透 · 可对双方开火), 也可走到它旁边按 <b>F</b> 上车。':'<b>SPECTATOR MODE</b> (Experimental on: click the "Loiter Munition Troop" class card a second time): invulnerable · undetected · infinite ammo, and the match is not recorded. <b>Double-tap Space</b> to hover / <b>H</b> to glide — <b>LMB fires in both flight modes</b>; the secondary slot becomes the <b>Spectator Semi-Auto Sniper</b> (4x, scoped); while guiding a loiter round, <b>T</b> discards it and teleports you to its position; the deploy screen gains a <b>Ghost Tank</b> spawn (all-white · invulnerable · shells pass through · hits both sides), or walk up to it and press <b>F</b>.',
'小队与指挥':'SQUAD & COMMAND',
'<b>T</b> 标记进攻位置 · <b>Y</b> 令小队跟随 · <b>M</b> 战场大地图 · <b>Tab</b> 战场记分板':'<b>T</b> attack marker · <b>Y</b> squad follow · <b>M</b> tactical map · <b>Tab</b> scoreboard',
'战局目标与胜负':'OBJECTIVES & WINNING',
'占领模式: 站在旗帜圈内占领据点; 攻防/征服: 任意一方占满全部旗点→敌方兵力归零; 破袭战: 摧毁敌方全部补给库。':'Capture: stand inside a flag circle to take it. Assault/Conquest: hold every flag to drain enemy tickets. Sabotage: destroy all enemy depots.',
'一方兵力归零后不立即判负: 该方封重生(含坦克/飞机/你的再部署), 对方须 <b>①攻防/征服先占满全部旗点 ②消灭场上全部残兵</b> 才算获胜 (敌方坦克存活与否不影响胜负)。':'Zero tickets does not end the match: that side loses respawns (vehicles too), and the winner must <b>① hold all flags (assault/conquest) ② wipe every survivor</b> (surviving enemy tanks do not matter).',
'兵力归零方场上仅剩最后 1 人、且(攻防/征服)对方已占满全部旗点时启动 <b>30 秒清场倒计时</b>: 时间到仍未被歼灭则直接判对方胜 (防止最后一人躲藏拖局; 旗点被翻回则倒计时复位重来)。':'When the wiped side is down to their last man (and the enemy holds all flags), a <b>30s wipe timer</b> starts: if he survives it, the enemy wins (stops last-man hide-and-seek; retaking a flag resets the timer).',
'遭遇战: 无旗点, 双方从对角相向推进; 劫道战: 炸毁整支护运车队→劫道方胜, 半数卡车突围→护运方胜。':'Clash: no flags, both sides push from opposite corners. Convoy heist: destroy the whole convoy to win as heister; half the trucks escaping wins it for the escort.',
'击杀、占领、摧毁坦克/建筑工事和救治队友都会得分, 阵亡会消耗本方兵力票。':'Kills, captures, destroyed tanks and fortifications, and healing teammates all score; deaths burn your team\'s tickets.',
'<b>连杀奖励</b>: 5 秒内连续击杀/摧毁可叠连杀 —— 达成 3/6/9 杀档位即获"战意"增益(移速/换弹/减伤随档提升, 持续 5~7 秒); 增益期间继续在窗口内击杀即"续杯"(时长回满, 连杀不断就能一直续); 连杀期间每次击杀得分按 ×1.5/×2/×3 结算; 阵亡清零。':'<b>KILLSTREAKS</b>: kills within 5s of each other stack — at 3/6/9 you earn a "Fervor" buff (speed/reload/damage-cut by tier, 5–7s); keep killing inside the window to REFILL it back to full, and the chain keeps it alive; each kill scores ×1.5/×2/×3; dying resets it.',
'暂停与结算':'PAUSE & RESULTS',
'<b>Esc</b> 暂停(战斗/移动/天气全部冻结, 再按 Esc 或点按钮继续); 一局结束后战场活动同样全部停止。':'<b>Esc</b> pauses (combat/movement/weather all freeze; Esc again or the button resumes). After the match ends, all battlefield activity stops.',
'触屏操作':'TOUCH CONTROLS',
'左侧虚拟摇杆移动, 右侧滑动转视角; 屏幕按钮对应开火/瞄准/跳跃/蹲/趴/换弹/手雷/绷带/互动/切枪等, 长按疾跑键锁定疾跑。':'Left stick moves, right side swipes to aim; on-screen buttons cover fire/aim/jump/crouch/prone/reload/grenade/bandage/use/swap; hold sprint to lock it.',
'触控按键大小可在 游戏设置 中调整。':'Touch button size is adjustable in Settings.',
// ── 2026-09-21 批次 A (sea-hud) ──
// ① 三人车组 (契约B): 载具血条上的乘员存活计数 + 记分板空名乘员的兜底称呼
'乘员 ×{0}':'Crew ×{0}','乘员':'Crew',
// ② 岸防炮人为操作 (契约D): 四门反舰炮台专名进 HUD 读数 (名字取自 CAMPAIGN.sea.batteries, 中文原文即键)
'西南岬反舰炮台':'Southwest Cape Coastal Battery','东南岬反舰炮台':'Southeast Cape Coastal Battery',
'西北岬反舰炮台':'Northwest Cape Coastal Battery','东北岬反舰炮台':'Northeast Cape Coastal Battery',
// ③ 岸防炮 F 交互提示两条 (原文在 20-player.js 的 updateInteractHint / tryInteract, 与本批 A#9 同批) ——
//    UI 文案归本文件, 故由 sea-hud 补录, 免 EN 界面残留中文
'<b>F</b> 操作岸防炮':'<b>F</b> man coastal battery','<b>F</b> 离开岸防炮':'<b>F</b> leave coastal battery',
// ── 2026-09-26 破坏得分批 ──
// ① 摧毁地图可破坏物的得分角标 (21-match.flushStructPop): 单组/同批多组两种形态, 大型结构另立一词
'摧毁结构':'Structure destroyed','摧毁大型结构':'Large structure destroyed',
'摧毁结构 ×{0}':'Structures destroyed ×{0}','摧毁大型结构 ×{0}':'Large structures destroyed ×{0}',
// ② 结算战绩新增一项 (REC_STATS.demol): 结算卡标签与「战绩数据」面板表头共用同一个键
'摧毁数':'DEMOLISHED',
// ── 2026-09-26H 观战批 ──
// ① 观战运行文案 9 条 (2026-09-26G 审计 D1 漏网名单): 观战飞行/落地/白车就位与开关回执 —— 旧版这些
//    文本 t() 查不到词条 ⇒ EN 界面在这些操作后闪中文 (同批其它文案都补过)。
'创造悬停飞行 · WASD移动 空格升/Shift降 · 落地退出':'Creative hover · WASD to move, Space up / Shift down · land to exit',
'切换: 创造悬停 (空格升/Shift降)':'Switched: creative hover (Space up / Shift down)',
'飞行关闭':'Flight off',
'气动飞行 · 沿视线前飞 · 右键加速 · 俯冲触地落地':'Aerodynamic flight · flies where you look · RMB boosts · dive into the ground to land',
'幽灵坦克已就位 · 观战专属载具':'Ghost Tank ready · spectator-only vehicle',
'落地 · 行走状态':'Landed · on foot',
'观战模式已关闭':'Spectator mode off',
'观战将随下次部署生效':'Spectator mode takes effect on your next deploy',
// ② 本批新增/改写的观战文案 (开关确认·待生效·座驾保护·工具键·信息层·时间控制)
'开启观战模式？本局将: 免伤 · 不被索敌 · 弹药无限 · 副武器换观战连狙, 且可对双方开火。注意: 下一次部署才生效; 生效(以观战者身份进入战场)后本局不计入历史记录 —— 只点开开关又取消的不算。':'Enable spectator mode? This match: no damage · not targeted · unlimited ammo · secondary swapped to the spectator sniper, and you can fire on both sides. Note: it takes effect on your NEXT deploy; the match is not recorded only once you actually enter the battle as a spectator — toggling the switch on and off does not count.',
'观战模式将于下次部署生效':'Spectator mode will take effect on your next deploy',
'座驾被毁 · 观战者安全脱离':'Vehicle destroyed · spectator extracted safely',
'观战模式 · 不指挥小队':'Spectator mode · no squad orders',
' (观战不可征用)':' (unavailable to spectators)',
'观战中 · 双击空格=悬停飞行 · H=气动飞行 · F=召唤幽灵坦克 · K=时停 · J=信息层':'Spectating · double-tap Space=hover flight · H=aerodynamic flight · F=summon Ghost Tank · K=time-stop · J=info layer',
'观战中 · <b>双击空格</b> 悬停飞行 · <b>H</b> 气动飞行(右键加速) · <b>左键</b> 开火 · 副武器=观战连狙 · 免伤·不被索敌 · <b>F</b> 召唤幽灵坦克':'Spectating · <b>double-tap Space</b> hover flight · <b>H</b> aerodynamic flight (RMB boost) · <b>LMB</b> fire · secondary = spectator sniper · no damage · not targeted · <b>F</b> summon Ghost Tank',
'<b>K</b> 时停(冻结战场 · 你本人仍可走动/飞行) · <b>J</b> 观战信息层':'<b>K</b> time-stop (freezes the battle · you can still walk/fly) · <b>J</b> spectator info layer',
'观战信息层: 开':'Spectator info layer: on','观战信息层: 关':'Spectator info layer: off',
'观战时停: 开 (K 继续 · 你本人仍可走动/飞行)':'Spectator time-stop: on (K to resume · you can still walk/fly)',
'观战时停: 关':'Spectator time-stop: off',
// 时停常驻指示 (2026-09-27M): #specTimeInd 胶囊 (顶部栏正下方, 逐帧对账). 触发句补一句"打出的弹丸也照飞"
'⏸ 时停中 · K 继续':'⏸ Time stopped · K to resume',
'观战时停: 开 (K 继续 · 你本人仍可走动/飞行; 打出的弹丸也照飞)':'Spectator time-stop: on (K to resume · you can still walk/fly; your own rounds keep flying)',
};
// 取词: LANG==='en' 查表 (无命中回退中文原文); 多参时对 {0}{1}… 插值 (中英同规则)
function t(s){
if(LANG==='en'){ const v=I18N_EN[s]; if(v!==undefined) s=v; }
if(arguments.length>1){
const a=Array.prototype.slice.call(arguments,1);
s=s.replace(/\{(\d+)\}/g,(m,i)=>{ const v=a[+i]; return v===undefined?'':String(v); });
}
return s;
}
// t2: 别名 —— 供局部变量名占用 `t` 的作用域使用 (如 22-hud 的 `const t=player.onVehicle`)
function t2(){ return t.apply(null,arguments); }
// 静态 DOM 应用: data-i18n=textContent / data-i18n-html=innerHTML。
// 属性有值=键; 属性为空(裸 data-i18n)=首见时把当前文案盖章为键再替换 —— EN 查词典, zh 原样。
function applyI18n(root){
(root||document).querySelectorAll('[data-i18n],[data-i18n-html]').forEach(el=>{
const isHtml=el.hasAttribute('data-i18n-html');
const attr=isHtml?'data-i18n-html':'data-i18n';
let k=el.getAttribute(attr);
if(!k){
k=(isHtml?el.innerHTML:el.textContent).replace(/\s+/g,' ').trim();
el.setAttribute(attr,k);
}
el[isHtml?'innerHTML':'textContent']=t(k);
});
}
// 执行时机 (2026-09-13 修): 本文件在 <body> 之前引入, 此处直接调用时 body 只解析到一半 ——
// 排在后面的静态节点 (部署/结算/暂停/帮助) 会漏盖章, 且 EN 存档会先显示中文再被替换 (刷新可见的闪烁)。
// 改为: head 里的同步调用点若 DOM 未就绪 → 挂 DOMContentLoaded, 全文档解析完再统一盖章。
// index.html 首屏引导脚本给 <html> 挂 lang-en, CSS 先把带键节点 visibility:hidden 挡住这段空窗。
// ★ 2026-09-25 修 (遮挡时机): 遮挡的**解除**点从 22-hud initMenuUI 末尾挪到本函数 applyI18n 之后。
//   旧顺序是 [解析期 initMenuUI 摘 lang-en] → [DOMContentLoaded applyI18n] —— 摘除早于盖章 ⇒
//   遮挡在上一步就失效, EN 存档照样先闪中文 (而 CSS 选择器修好后更是"摘掉遮挡时文本还是中文")。
//   applyI18n 调用后静态节点才真正是英文, 这一刻解除遮挡才成立。动态菜单文案由主脚本链在解析期
//   用 t()/t2() 直接写成目标语言 (不靠遮挡), 与本函数无先后冲突 —— 不会出现"中英混杂"。
function unmaskLangEn(){
try{ if(document.documentElement&&document.documentElement.classList) document.documentElement.classList.remove('lang-en'); }catch(e){}
}
function i18nBoot(){
applyI18n(); // 裸属性节点在此完成"盖章" (属性值 = 中文键), EN 查词典后写入英文
unmaskLangEn(); // 盖章完成才解除遮挡 (顺序不可颠倒)
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',i18nBoot,{once:true});
else i18nBoot();