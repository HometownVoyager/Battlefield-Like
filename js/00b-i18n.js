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
'进 入 战 场':'DEPLOY','返 回':'BACK','返 回 战 斗':'BACK TO COMBAT','部 署':'DEPLOY',
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
'本图最高 {0}':'Map best {0}','票':'tickets','在场':'in field','得分':'SCORE',
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
'草原遭遇 1943':'Steppe Encounter 1943','无垠波地 · 装甲不期而遇':'Endless swells · armor meets head-on','遭遇战·无目标绞肉':'Clash · no objectives, pure grind',
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
'<b>左键</b> 发射 · <b>鼠标</b> 调弹道 · <b>F</b> 离开':'<b>LMB</b> fire · <b>Mouse</b> arc · <b>F</b> leave',
'<b>B</b> 放置医疗箱':'<b>B</b> place medkit',
'<b>F</b> 上炮 · <b>B</b> 靠近回收':'<b>F</b> man mortar · <b>B</b> recover',
'<b>B</b> 架设迫击炮':'<b>B</b> deploy mortar',
'观战中 · <b>双击空格</b> 悬停飞行 · <b>H</b> 气动飞行(右键加速) · <b>左键</b> TV弹制导/手动引爆 · 触地消失 · 弹药无限':'Spectating · <b>double-tap Space</b> hover · <b>H</b> glide (RMB dash) · <b>LMB</b> guide/detonate · vanishes on impact · infinite ammo',
'<b>左键</b> 发射巡飞弹(TV制导) · <b>6</b> 燃烧弹':'<b>LMB</b> launch loiter round (TV) · <b>6</b> incendiary',
'<b>5</b> 工事: {0} ({1}点) · <b>B</b> 建造 · 剩 {2} 点':'<b>5</b> piece: {0} ({1} pts) · <b>B</b> build · {2} left',
'<b>F</b> 拿取绷带':'<b>F</b> take bandages',
'迫击炮已架设 (F 上炮 · B 靠近回收)':'Mortar deployed (F man · B recover)',
'需靠近自己的迫击炮才能回收':'Move closer to your mortar to recover it','迫击炮已回收':'Mortar recovered',
'建造点数不足 ({0}/{1}) — 弹药箱旁按F补给可回满':'Not enough build pts ({0}/{1}) — resupply at an ammo crate',
'此处无法建造':'Cannot build here','超出战场边界':'Outside the battlefield',
'建造中: {0} … (移动取消)':'Building: {0} … (move to cancel)','位置被占用, 建造取消':'Spot taken, build cancelled',
'{0} · 建成 (剩余 {1} 点)':'{0} · built ({1} pts left)',
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
'观战中 · 免伤 · 不被索敌 · 双击空格悬停/H气动飞行':'Spectating · invulnerable · undetected · double-tap Space to hover / H glide',
'兵种技能':'CLASS SKILL','工事':'BUILD',
// ── 游戏说明 (FIELD MANUAL) ──
'快速上手':'QUICK START',
'进入战场后: 选兵种 → 选出生点 → 按 <b>部署</b> 落地。跟随小队标记进攻, 站进旗圈占领据点, 活下去比什么都重要。':'After deploy: pick a class → pick a spawn → press <b>DEPLOY</b>. Follow your squad marker, stand in flag circles to capture, and staying alive matters most.',
'基础操作':'BASIC CONTROLS',
'<b>WASD</b> 移动 · <b>Shift</b> 疾跑(机瞄时为屏息稳枪) · <b>空格</b> 跳跃':'<b>WASD</b> move · <b>Shift</b> sprint (hold breath while aiming) · <b>Space</b> jump',
'<b>左键</b> 射击 · <b>右键</b> 机瞄/瞄准镜 · <b>R</b> 装填 · <b>1/2</b> 切换武器 · <b>V</b> 近战':'<b>LMB</b> fire · <b>RMB</b> aim/scope · <b>R</b> reload · <b>1/2</b> weapon slots · <b>V</b> melee',
'<b>C</b> 蹲 · <b>Z</b> 卧倒 · <b>X</b> 在掩体上架枪(大幅提升精度) · <b>Q/E</b> 左右侧身探头':'<b>C</b> crouch · <b>Z</b> prone · <b>X</b> brace on cover (big accuracy boost) · <b>Q/E</b> lean',
'蹲下/卧倒/架枪都会显著降低枪口晃动; 疾跑后停下稍等呼吸恢复再开枪更准。':'Crouch/prone/brace all steady your aim noticeably; after sprinting, pause a beat to catch your breath before shooting.',
'投掷物与医疗':'GRENADES & MEDICAL',
'<b>G</b> 手雷(可按住烹饪引信) · <b>3</b> 反坦克雷 · <b>4</b> 烟雾弹 · <b>6</b> 燃烧弹 · <b>H</b> 绷带包扎(+45生命, 受击会打断)':'<b>G</b> grenade (hold to cook) · <b>3</b> AT mine · <b>4</b> smoke · <b>6</b> incendiary · <b>H</b> bandage (+45 HP, interrupted when hit)',
'燃烧弹: 红色烈焰烟云, 同样遮蔽视线, 云内步兵持续灼烧(突击兵/巡飞弹兵携带)。':'Incendiary: a blazing red cloud that blocks sight and roasts infantry inside (carried by Assault / Loiter troop).',
'医护兵按 <b>B</b> 放置医疗箱, 队友靠近按 <b>F</b> 取绷带; 受伤后脱战只会缓慢回血到70。':'Medics press <b>B</b> to drop a medkit; teammates press <b>F</b> near it for bandages. Out of combat you only regenerate slowly up to 70 HP.',
'载具与固定武器':'VEHICLES & EMPLACEMENTS',
'靠近载具/重机枪/反坦克炮/防空炮/迫击炮/弹药箱按 <b>F</b> 使用。':'Press <b>F</b> near vehicles, heavy MGs, AT/AA guns, mortars, or ammo crates to use them.',
'<b>坦克</b>: WASD 驾驶 · 左键主炮(圆环为落点) · 右键同轴机枪 · <b>C</b> 炮手镜 · F 下车; 车速够快可撞塌砖墙':'<b>Tank</b>: WASD drive · LMB main gun (ring shows impact point) · RMB coax MG · <b>C</b> gunner optic · F exit; ram brick walls at speed to smash them',
'<b>飞机</b>: W/S 油门 · A/D 压坡转向 · 鼠标拉杆 · 左键机枪 · 右键/B 投弹 · F 跳伞':'<b>Plane</b>: W/S throttle · A/D bank · Mouse stick · LMB guns · RMB/B bombs · F bail out',
'固定机枪持续射击会过热(屏幕下方热量条), 红色时需停火冷却。':'Fixed MGs overheat on sustained fire (heat bar at screen bottom) — hold fire when red and let them cool.',
'兵种与技能':'CLASSES & SKILLS',
'步枪兵 / 冲锋枪手 / 突击兵 / 狙击手 / 医护兵 / 反坦克兵 / 迫击炮兵 / 工程兵, 各带不同主武器与投掷物。':'Rifleman / SMG Gunner / Assault / Sniper / Medic / Anti-Tank / Mortarman / Engineer — each with distinct weapons and throwables.',
'医护兵 <b>B</b> 放医疗箱 · 迫击炮兵 <b>B</b> 架设/回收迫击炮 · 工程兵 <b>B</b> 建造、<b>5</b> 切换工事(沙袋墙/铁丝网/拒马/MG42) · 架好的迫击炮全员可 <b>F</b> 操作':'Medic <b>B</b> medkit · Mortarman <b>B</b> deploy/recover mortar · Engineer <b>B</b> build, <b>5</b> pick piece (sandbags/wire/hedgehog/MG42) · deployed mortars usable by anyone via <b>F</b>',
'<b>实验模式</b>(游戏设置中开关): 反坦克兵替换为非史实的 <b>巡飞弹兵</b> — 火箭筒式发射器射出小型巡飞弹, 弹上TV制导: <b>F</b> 切换第一/第三视角, 左键自爆, <b>右键加速冲刺</b>(松开回落巡航); 触碰目标/地面即爆, 额外携带燃烧弹(按<b>6</b>)。':'<b>EXPERIMENTAL</b> (toggle in Settings): Anti-Tank becomes the unhistorical <b>Loiter Munition Troop</b> — fires a small loitering munition with onboard TV guidance: <b>F</b> 1st/3rd person, LMB detonate, <b>RMB dash</b> (release to cruise); detonates on contact, plus incendiaries (<b>6</b>).',
'小队与指挥':'SQUAD & COMMAND',
'<b>T</b> 标记进攻位置 · <b>Y</b> 令小队跟随 · <b>M</b> 战场大地图 · <b>Tab</b> 战场记分板':'<b>T</b> attack marker · <b>Y</b> squad follow · <b>M</b> tactical map · <b>Tab</b> scoreboard',
'战局目标与胜负':'OBJECTIVES & WINNING',
'占领模式: 站在旗帜圈内占领据点; 攻防/征服: 任意一方占满全部旗点→敌方兵力归零; 破袭战: 摧毁敌方全部补给库。':'Capture: stand inside a flag circle to take it. Assault/Conquest: hold every flag to drain enemy tickets. Sabotage: destroy all enemy depots.',
'一方兵力归零后不立即判负: 该方封重生(含坦克/飞机/你的再部署), 对方须 <b>①攻防/征服先占满全部旗点 ②消灭场上全部残兵</b> 才算获胜 (敌方坦克存活与否不影响胜负)。':'Zero tickets does not end the match: that side loses respawns (vehicles too), and the winner must <b>① hold all flags (assault/conquest) ② wipe every survivor</b> (surviving enemy tanks do not matter).',
'兵力归零方场上仅剩最后 1 人、且(攻防/征服)对方已占满全部旗点时启动 <b>30 秒清场倒计时</b>: 时间到仍未被歼灭则直接判对方胜 (防止最后一人躲藏拖局; 旗点被翻回则倒计时复位重来)。':'When the wiped side is down to their last man (and the enemy holds all flags), a <b>30s wipe timer</b> starts: if he survives it, the enemy wins (stops last-man hide-and-seek; retaking a flag resets the timer).',
'遭遇战: 无旗点, 双方从对角相向推进; 劫道战: 炸毁整支护运车队→劫道方胜, 半数卡车突围→护运方胜。':'Clash: no flags, both sides push from opposite corners. Convoy heist: destroy the whole convoy to win as heister; half the trucks escaping wins it for the escort.',
'击杀、占领、摧毁坦克和救治队友都会得分, 阵亡会消耗本方兵力票。':'Kills, captures, tank destruction and revives score points; deaths burn your team\'s tickets.',
'<b>连杀奖励</b>: 5 秒内连续击杀/摧毁可叠连杀 —— 达成 3/6/9 杀档位即获"战意"增益(移速/换弹/减伤随档提升, 持续 5~7 秒), 连杀期间每次击杀得分按 ×1.5/×2/×3 结算; 阵亡清零。':'<b>KILLSTREAKS</b>: kills within 5s of each other stack — at 3/6/9 you earn a "Fervor" buff (speed/reload/damage-cut by tier, 5–7s), and each kill scores ×1.5/×2/×3; dying resets it.',
'暂停与结算':'PAUSE & RESULTS',
'<b>Esc</b> 暂停(战斗/移动/天气全部冻结, 再按 Esc 或点按钮继续); 一局结束后战场活动同样全部停止。':'<b>Esc</b> pauses (combat/movement/weather all freeze; Esc again or the button resumes). After the match ends, all battlefield activity stops.',
'触屏操作':'TOUCH CONTROLS',
'左侧虚拟摇杆移动, 右侧滑动转视角; 屏幕按钮对应开火/瞄准/跳跃/蹲/趴/换弹/手雷/绷带/互动/切枪等, 长按疾跑键锁定疾跑。':'Left stick moves, right side swipes to aim; on-screen buttons cover fire/aim/jump/crouch/prone/reload/grenade/bandage/use/swap; hold sprint to lock it.',
'触控按键大小可在 游戏设置 中调整。':'Touch button size is adjustable in Settings.',
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
applyI18n();
