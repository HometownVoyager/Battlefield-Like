# 更新计划（PLAN.md）—— 待验收 / 待办 / 计划特性 总表

> 本文档整合 README（开发手册）中**尚未关闭的事项**与新特性的前瞻计划，按四区组织：
> **§1 本轮新特性（待实机验收）→ §2 计划特性（已定意向）→ §3 开发待办 → §4 历史批次待验收清单**，文末附回归基线。
> 工作方式（固定约定，见 README §4.6）：改代码 → Node 沙箱回归 → **用户实机验收（截图/现象反馈，不做浏览器操作）** → 修订 → 同步 README 第五、八节并更新本文档。
> **⚠️ 文档管理规则**：**未完成的文档需要放在主目录，完成了的文档需要放到docs文件夹**。
> 每完成一项：条目标 ✅ 并注明批次号；已关闭事项从本文档移除（README §8 变更记录为唯一历史事实，本文档是前瞻视图）。

## 一.68 性能排查与光照渲染优化(2026-10-24, 待实机验收)
承用户报「总是卡顿，推测与光照渲染效率有关」。排查用新遥测探针 `dev/probe-renderstat.js`（15 战役全量实测后注册 run-all-verify）定位成本结构，落地四项修复：
1. **成本结构排序（排查结论）**：①Draw Call 体量第一（每帧独立 Mesh 5735~11257、唯一材质 483~859、阴影通道翻倍）——静态合批当时仅 solidBox 走 `_bldBatch`，**20261007 指导书「Phase 2 已全面落地 100%」与代码不符**（后续最大杠杆，见交付文档）；②灯数抖动→材质 program 重评（three r152 按 visible 剔灯，可见灯数一变全材质重跑 getProgram ⇒ 暗图/雨图周期性顿挫；`isDarkEnvironment()` 对任何雨图为真 ⇒ 白天雨图也跑夜间灯链）；③夜间灯链每帧闭包/数组分配与排序；④Bot 手电遮挡射线无节流；⑤q0/q1 阴影每帧全刷。
2. **A 阴影半频**（02-scene `shadowRefreshTick` + 24-main 两渲染分支 `renderer.clear()` 前接线 + applyQuality 换档补刷一帧）：q2 恒 autoUpdate；q0/q1 奇偶帧 needsUpdate≈30Hz。
3. **B 大灯池滞回**（08-effects nightGearTick）：候选距离平方进复用数组、仅近 2 盏实体化；**滞回带 60/75m**（engage=headRealR、hold=+15m）杜绝临界抖动（=灯数抖动病根）；occD 判定只对入池候选做且 75m 外跳过。
4. **C 火源灯扫描降频+活取坐标**（updateFireLights 重写）：0.2s 节拍收候选（engage 85m/hold 110m+存活校验），每帧只剩闪烁+`_firePos()` 活读源坐标（顺带修掉烘焙坐标致 follow 船火源不跟船的隐患）；`_lastT` 双调守卫与 maxActiveLights=暗2/亮1 原样保留（2026-10-10 裁定）。
5. **D Bot 手电射线 0.12s 节流**（14-bots `flRayT`，闪烁锥只消费缓存 occD）+ 玩家手电起点 `_pfO` 复用槽（零分配军规）。爆炸 flashLight 常驻可见=既有稳定灯数设计，未动。
6. **判据**：新 `dev/verify-perf-20261024.js` **34/0**（行为级：阴影奇偶帧/换档补刷、大灯 59/65/80m 三段滞回、火源 85/110m 滞回+源移动灯跟走、Bot 节流 RGRID 计数 12 帧 1~3 发、版本戳唯一）；`verify-fixes-20261010-batch2` 仍绿；全量 run-all-verify 改前/改后失败集逐条相同（预存红账零新增）。版本戳 `20261012a→20261024a`（js 47 处，css 不动）。
7. **实机关注点**：①白天图 q0/q1 帧率应整体抬升（阴影半频）；②夜图/雨图在燃烧残骸、开灯车队附近移动时的周期性顿挫应明显减轻（灯池滞回+火源降频）；③夜间大灯 60~75m 带内远灯常亮属滞回设计而非 bug；④q2 高画质的阴影行为不变。
8. **后续（未做，登记待办）**：静态构件合并批（Draw Call 最大杠杆）；修正 20261007 指导书 Phase 2 状态描述。

## 一.69 随机地形降级为地图卡 × 下钻二级菜单(2026-10-24, 待实机验收)
承用户裁定：「UI 显示上随机地形地图应与其他地图并列（而非与游戏模式并列），点进去再有二级菜单」。讨论中三项定夺
（业界惯例佐证：AoE/CoE 系「地图列表内随机图条目 → 二级配置步」通行做法）：
**①二级菜单=左栏原位下钻**（地图列表切换为随机战场配置页+`‹ 返回地图列表`，右栏简报同步）；**②随机卡不属于任何战区、末位钉卡**，
任何战区筛选下都可见；**③两页一致**——丧尸生存页的随机卡（原本就列在丧尸图列表里但无种子配置入口）也点开同一子页。
1. **结构**（index.html）：删第三个模式标签 `data-mode="procgen"`（只剩 历史战役/丧尸生存）；原 `#hubProcgenOpts` 选项块
   改造为 `#hubProcgenPage` 下钻子页（返回按钮+推演模式+种子+收藏，控件原样搬迁）。
2. **交互**（22-hud）：新状态量 `hubPgOpen`；随机卡固定标题「★ 随机地形战场 / 战术演练 · 程序化生成」（战役表 title 是
   "上局已生成世界"名，直用会误导）；点随机卡 = `hubMode` 跟随（历史战役页→procgen、丧尸页保持 zombie）+ 子页开；
   `‹ 返回`只关面板不清选择（开局仍用已配置种子）；切标签保留选择；进大厅若上局是随机图直接落子页。
3. **丧尸页随机卡补缺**：简报/阵营改随**当前输入种子**推演（`calcPGInfo`，原先误用上局世界名/阵营）；`sf_pseed`
   存储与 `seedChanged→reload` 判定从「procgen 模式页」放宽为「选中卡是随机地形」——丧尸图从此可固定种子复现。
4. **样式**（style.css）：`.map-card.pg` 金色虚线框区别史战卡；`#hubPgBack` 返回按钮；`.hub-subpage`。
5. **判据**：`verify-combathub-20261008` 探针同步改版（两标签 DOM；TC-06 加西欧筛选钉卡断言；TC-07 重写为
   卡片下钻/返回/丧尸页联动 7 断言）**70/0 绿**；`verify-text`（i18n 键闭环+戳统一）、`verify-hudfix` T6、
   `verify-boot-settlement-and-fixed-fav` 26/0 绿；全量 run-all-verify 复盘揪出**另三处版本戳钉**随批升
   （`verify-perf-20261024` T5、`verify-animfix-20261012` 戳断言改单枚口径、`dev/_game_files.txt` 41 处清单），
   两探针复跑 **34/0、66/0** 全绿。剩余失败集=README 记录的预存红账（zombie 8/worldrestore 植被 2/hudfix T4/
   fire 探针自崩/naval/timestopfix/airground/phase4-7d/nade-trigger/fixbatch/animfix-20260926/matseam——全在本批
   零改动子系统）。i18n：+4 键（随机地形战场/战术演练 · 程序化生成/‹ 返回地图列表/随机战场），删废弃键「战术演练 (随机地形)」。
6. **实机关注点**：①历史战役页任何战区筛选下列表末位都有「★ 随机地形战场」虚线金卡；②点卡进种子页、返回不开局；
   ③丧尸页点随机卡同样出种子页，固定种子开局应复现同图；④上局打完随机图回大厅应直接落在种子页。
7. **实机验收①②修复轮（2026-10-24c）**：用户 Ctrl+F5 实测两报——**①点随机卡左栏不切换**（病根=卡片 onclick 只调
   `updateHubRightPanel` 漏调 `syncCombatHubUI`，左栏视图切换全在后者；状态变量对而 DOM 不动，探针只钉了状态没钉 DOM）；
   **②丧尸页两张随机卡**（病根=丧尸分支循环只排 opensea/canyon，procgen 被收进列表，末位钉卡又追加一次）。修：
   循环补排 procgen、onclick 改走 `syncCombatHubUI`、战区条显隐从「hubMode==='campaign'」改为「非丧尸页且列表视图」
   （返回后随机卡仍选中时筛选条应回来）。探针补 **DOM 级断言**（点卡后 `#hubProcgenPage` 去 hidden 且
   `#hubMapGrid` display=none、返回后反之）与**两页随机卡唯一性**断言（丧尸页/全部筛选各 pg=1）——**74/0**；
   全部筛选=14 史战图+1 钉尾卡=15。版本戳随修复轮升 `20261024c`（index 49 处+清单 41+三探针钉）。

## 一.70 随机图三档规模 × 多聚落骨架 × 农田掩体批(2026-10-24e, 待实机验收)
承用户四项裁定（AskUserQuestion 定案）：**三档规模** 300/380/480+玩家选档 / **农田**「1+3，量做区分」+绿黄双保底 /
**田缘掩体** 每田 2~3 边墙+田内草垛 / **反公式化**「1+3，地标应当随机缺席」。同修实机 BUG「西欧随机图整图无农田且无绿田」
（病根=①抽中 town 群系 `fields:null` 按设计无田而简报许诺了田 ②farm 田型逐块独立均匀抽可全黄无绿）。
详见 `finished-docs/交付文档-随机图三档规模与骨架多样化-2026-10-24.md`。要点：
1. **规模**（00-config/22-hud/index）：`PG.size` 读取链 URL `?pgsize=` > `sf_pgsize` > 380，与群系/主题同不占随机流；
   战役条目 `mapSize`/`botMul`(0.95·1.1·1.3)/`tankN`(1·2·3) 随档；大厅随机图页「战场规模」三段选择器 `#hubPgSizeSeg`，
   改档并入 `needReload` 整页重载；00c 全常量随 HALF 参数化（高度场网格 GN=Math.round(SZ/5)+1）。
2. **骨架**（00c）：farm/town 抽 mono 40%/dual 32%/linear 28%——mono=旧构+卫星小村（零漂移锚）；dual=双村对峙 ±0.42·HALF、
   基地钉主村外侧 58~72m；linear=走廊三村 ±0.46·HALF、基地钉两端。旗族随骨架分派（dual=广场+村口+中场+前哨、
   linear=广场+村口×2+走廊旗）；净空分档（linear 主村窄档 max(36,46·max(0.8,SK))——旧值 74 令 linear 100% 卡 3 旗）；
   中场旗横距=max(间距需求,净空需求)；`trunk1` 方向修正（旧写法反向起自副村）。
3. **农田+掩体**（00c 数据定计划→05c 建造）：田数档 FARM_FN{300:[9,12]/380:[11,14]/480:[14,17]}、town 贴边碎田
   TOWN_FN{[2,3]/[3,5]/[4,6]}、water 水田；**绿黄双保底**=首块钉 corn 绿/次块钉 wheat 黄/water 首块 rice+保底块兜底
   （旧兜底误排 water 已修）。每田计划 `f.walls`(2~3 边,过滤路≥4.5/基地≥26)+`f.hay`(1~3,田内路净空≥6,碎田不塞)；
   05c 执行：中式 `stoneWall 0.85m`/欧式 `hedgerow 2.2~3m 可破坏`、草垛=MAT.hay+CYLS 硬碰撞+coverPoints 进 Bot 寻位；
   野地孤树 `PGDATA.singles`(12·SK+0~4)。多聚落广场件随 SETTLE 下发（主村 3 件/副村 1 件）。
4. **地标随机缺席**（00c）：主村教堂/碉楼 75% · 欧主村风车 55% · 副村小地标 35% · 干线厂 55%/段滚点（缺席无替代桩）；
   落位旋转扇扫 0/±0.6/±1.2/π 重试（dual/linear 主街⊥骨架轴贴 connector 的病根）。
5. **探针/基线**：`verify-procgen` 全量重写 **506/0**（A=380 三群系结构不变量、B=300/480 扫描 SZTAB 距离窗、
   同种子同规模全同·跨规模不同图、统计段 240 种子=骨架三型各 ≥15%+地标窗+田均 ≥9+墙/田 ≥2.2+跨河 0）；
   `_pgbase-capture` 指纹扩 settleS/singles/skeleton/size 重钉 22 种子——**设计变更取代 2026-10-07b 逐位承诺**；
   风车统计窗改欧式池分母（中式副村是碉楼，混池上限≈50%×70% 是窗口错）。全量 run-all-verify：升戳曾漏
   `verify-perf`/`verify-animfix-20261012` 两探针戳钉与 `_game_files.txt` 清单（新红两条），随批升齐复绿 34/0·66/0；
   剩余 11 条红=README 在案预存红账（全在本批零改动子系统）。i18n +5 键；`campSubT` 两处重复合一
   （搬家未删旧块病）。
6. **实机验收反馈轮（2026-10-24g，用户两报→三项 AskUserQuestion 定案）**：用户报①「农田大多在边缘，
   要分布在战场中间/中间两边/侧翼，成为左右战局的因素」②「大部分图没有诺曼底一人多高植物」（病根=田被
   拒绝采样挤到边缘+pasture/till 平田无植株+town 上批零田，高杆庄稼系统其实一直在）。定案=每图抽田带模板/
   战斗区只种高杆/新增高草丛软遮蔽。**战区田带**（00c）：对峙轴=基地 0→1、横向带 中路 ≤34K/中侧 ≤78K
   （K=max(0.8,SK)）；四模板加权抽签 中路青纱帐带 30%/双翼田带 30%/中侧混合 25%/横贯田带 15%；主田带田
   强制 corn/wheat（首玉米=青纱帐保底+绿保底、次小麦），两段重试+极小田(14~24)救援兜底（belt≥2 达标率
   300 图 96%/380·480 100%）；pasture/till 只作边田；全田打 `zn` 战区标签（几何单源）。town 碎田环带内收
   55→40 且全种 corn/wheat。**高草丛**（00c 规划→05c 建造）：无田空带 2~6 丛（中路/中侧优先，避田 9/路 5.5/
   旗 r+3/聚落 r+10），billboard 草丛+`CROP_FIELDS h1.4` 复用庄稼软遮蔽（蹲伏隐/遮 Bot 视线/无碰撞/子弹穿透/
   可燃）+对峙轴带低灌木加密(16·K 株)。判据：verify-procgen 增至 **535/0**（模板∈四型/belt 全高杆全在 c+m/
   zn 与几何一致/草丛计划合法性+统计段 四型各 ≥12%·belt≥2 ≥94%·青纱帐 ≥97%·战区田占比 ≥25%）；基线**三钉**
   （FP 再扩 fieldTpl/grass）；全链 boot 行为验证（草丛注册 CROP_FIELDS、草丛内两眼互盲=true）。期间树被并发
   两波推进至 20261024f（见一.71/72），本轮随批升戳 `20261024g`（index 49+清单 41+三探针钉，f 批两探针无戳钉）。
   实机关注：田带手感（穿中路庄稼地/绕翼侧田墙）/草丛蹲伏隐与燃烧弹点田/三模板辨识度。
   **反馈轮补修（同日，回归期三修）**：①**加密灌木未渲染**——bush() 只入 BUSH_BATCH、由 scatterBushes 尾的
   flushBushes() 统一实例化，本批加密块放在其后=批永不渲染；块前移至 scatterBushes() 之前合批（单 BUSH_IM，
   23b 世界复原 snapIM(BUSH_IM) 语义不变），且门从 `PG.biome==='farm'` 钉死为 `CAMPAIGN.layout==='procgen'`
   &&farm——PG 在预设图也存在（群系哈希自随机种子），不钉 layout 则预设图 1/3 概率误入+wr() 流被消费 ⇒ 预设
   布局逐帧漂移（探针钉种子故未爆）。②**verify-sink #14 偶发红（~1/10）定案**——活树篱碰撞箱挂空网格。三步
   定位（boot 打桩→桩 world.remove 打调用栈→加 addSeq/w0 上下文）：沙箱 window 桩跨 boot 共享，normandy 局
   startMatch 写的 `__sfMatchWorldStart=1159` 泄漏进 procgen 局（世界 1418 项），开局 retireMatchActors 台账
   清扫按陈旧边界整段摘掉后段 259 项网格——树篱箱活/网格没了=隐形墙。真页每次载入即新 window 无此泄漏（探针
   boot 补 `delete window.__sfMatchWorldStart` 复位对局期全局）；**顺手修真缺陷**：清扫段加边界兜底——边界后
   网格若仍背活碰撞箱（工程沙袋墙跨就地换局正是此列！）一并 killBox+植被记录标死，不留幽灵碰撞。③诊断
   （SINKDBG/SINK_PSEED/SINK_TRACE）全撤。判据：verify-sink 10/10 稳绿、procgen 535/0、layouts 全过、
   batch-f 30/0、perf 34/0、hudfix 仅预存 T4、fire 3=在案预存、worldrestore 2(scene 台账)=在案预存且本轮
   改动均不触 scene.children。

## 一.71 存活坦克队色信标 × 重坦提速 × 水乡坡道反向修复 × 风车方顶/外浮修复(2026-10-24f, 待实机验收)
承用户四报：①「被击毁的坦克不明显，经常浪费弹药——给存活的坦克加飞机同款的带阵营颜色上标」；②「增加重型坦克的速度，只比对应的轻坦慢一些」；③「随机地图-江南水乡楼梯是反的，高的地方没有连接桥面」；④「风车很多内部构件跑到外面浮空，方顶奇丑无比」。要点：
1. **坦克信标**（15-vehicles Tank.buildMesh）：16-aircraft 飞机信标同款 canvas 三角 Sprite（TEAM_COL 队色+白描边），scale 2.4m / y=3.8（底缘 2.6>最高车长帽顶 ~2.5、炮管仰角让空）、depthTest=false+renderOrder 9 同飞机口径；**update 顶部单行维护** `beacon.visible=alive&&!(playerDriven&&player.tankView)` + 脉动同飞机式（0.6+0.4·sin）——早退分支前执行，死车/沉没/重生/第一人称车长镜全覆盖，die/respawn 零改动。
2. **重坦提速**（00-config）：真重坦=潘兴/黑豹/KV-1（heavy 字段是"第二辆"槽位标记，一式中战车/T-26 不在此列），旧 6.5/7.0/5.7 与对应轻坦差 0.6/1.1/3.1——KV-1 慢出三档追不上战线；现收 7.7/7.6/8.0（差 0.6/0.5/0.8），rev 同比例 4.2/4.1/4.3，turn/reload/火控不动（"重"留在转向与装填）。
3. **引桥坡道反向**（05a stoneBridge）：旧码 `sy=gEnd+rise*t`（t=0 在桥端）⇒ 坡道在**桥端贴地、背离桥面爬到桥面高**——高端悬空不接桥面（实机"楼梯是反的"），且 gEnd 采在桥端侧岸坡低谷、平地桥也造反向凹坡（实测定量：某岸桥端 -0.49/远端顶 -0.07=桥面）。改：落差按**远端实地** gFar 采样、坡面 `sy=dy-rise·t`（桥端=桥面严格齐平）、中段贴地封底（缺口 ≤1.25m 落到地面）、|落差|≤0.15 或 ≥2.5 不建坡。淞沪石桥同函数同修复。
4. **风车**（05a windmill）：①"方顶"两病根=八角件（8 段 Cylinder 顶点在 θ=0/45..）零旋转——帽角顶在每面墙正中=菱形/方块观感 + 4.0×1.9×4.0 **轴对齐实体碰撞盒**角点 r2.83 从帽体/红锥里戳出（黑楔）；修=帽体/座圈/锥顶统一转 `ry-HPI/4` 帽面对齐墙面 + 碰撞盒换 **CYLS r2.3 圆柱碰撞体**（rayCyl/RGRID 全链同权）严格藏进帽体。②尾舵架整组旧悬在塔后 y7.15~8.0 半空（帽底 8.36 之下、无任何连接）——斜梁加长 2.6m 内端埋入座圈（|z|2.2@y8.55）、外挑至尾轴 y8.1，短吊柱闭合框架。
5. **判据**：新 `dev/verify-batch-20261024e.js` **82/0**（已注册 run-all-verify）——①信标 Sprite/位高/尺寸/材质+update 源含 alive 显隐与脉动行（不钉行号）；②五阵营数值+轻-重差窗 [0.4,0.9]+轻坦零回归；③三种子（100008/100012/100018，splitmix32 落 water 群系）×每桥每岸：坡道实体盒（BOXES min/max 形状）逐段吻合修正式 ±0.55、顶步贴桥面 ±0.4、末段落远端实地 ±0.4、坡向与落差同号——**正/负落差双分支实测**（下坡岸 3/上坡岸 8）。出图验收：`dev/_wmview.js`（草原风车 iso=帽面对齐无黑楔/尾架从帽后长出）、`dev/_wmpg.js`（水乡桥侧视=坡道自桥面下落接岸）。
6. **全量 run-all-verify**：11 条稳定红与本批改前预存红账**逐条相同**（verify-zombie / hudfix T4 丧尸累计 / worldrestore scene 台账 56→76 / fire / fixbatch-20260926 / naval / animfix-20260926 / matseam / airground-balance / phase4-7d / nade-trigger；_audit-foliage-ref 偶发 1 次环境抖动）——**本批零新增**；worldrestore 做 A/B 对照（临时撤本批三文件改动）失败逐字相同 ⇒ 非本批引入（他批在飞/在案）。本批触达子系统探针全绿：vehmodels/tankai/buildings/layouts/zfight/sink/procgen/perf/hudfix-T6 戳。
7. **版本戳** `20261024d→20261024e`（index.html 49 处+__sfStyleVer+verify-hudfix/verify-perf/verify-animfix-20261012 三探针钉+_game_files.txt，随批四处一起升）。实机关注：①残骸不再被当活车打（信标只悬在存活车上方，隔烟雾可辨）；②KV-1/黑豹/潘兴行进与倒车手感（应只比同级中坦略慢）；③水乡/淞沪桥头坡道走向（桥端应与桥面齐平向岸落地）；④风车塔帽=对齐八角鼓座+红锥、塔后尾架应从帽底长出。
## 一.72 敌方载具信标倒三角 × 观战四弹种全配 × 观战手雷预瞄 × 烧毁植被黑炭化(2026-10-24f 第二波, 待实机验收)
承用户四报：①「把敌机、敌坦克上方的三角标改为倒三角」——**返工口径**：首版把飞机/坦克信标 canvas 不分队全改了倒三角，用户纠正「友方的也换了？」后改为**只有敌方倒三角、友方保持原正三角**（判据单源 00-config `beaconInverted(team)`=team!==player.team，startGame 先赋 player.team 再落载具 ⇒ 建模期判定安全；玩家换队视角自动翻转）；②「为观战模式增加全部种类的手雷」；③「观战模式没有手雷预瞄线、预瞄范围显示」；④「被烧毁的植物会变成黑炭色再消失」。要点：
1. **敌方信标倒三角**（16-aircraft/15-vehicles 各自 canvas 两分支）：`beaconInverted(this.team)` 真=倒三角 `moveTo(32,59)→(59,5)→(5,5)`，假=原正三角 `moveTo(32,5)→(59,57)→(5,57)`；队色/位高/尺寸/脉动/显隐口径一律不动（§一.71①的产物契约原样）。
2. **观战四弹种**（00-config 新 `specGear()` 单源={nades:4,smoke:4,incin:4,atn:4}）：观战 0.5s 补给回满（20-player）/ rearmPlayerClass / 23-deploy 落装三处玩家侧入口统一走它，Bot 侧 clsGear 原样零回归——旧版按兵种表 ⇒ 狙击手观战没有 AT雷/燃烧弹、实验反坦克兵观战没有烟雾弹/AT雷；19-input Digit4 的「反坦克兵切火箭筒」补 `!player.spectator`（观战槽无火箭筒，findIndex(-1) 把 4 键整个吞掉 ⇒ 观战按 4=烟雾弹）；兵种卡武器行观战态显示四弹种全配；游戏说明（中英）补「投掷物四种全配」句（顺带把观战连狙描述里过期的「半自动·4x」修成定义一致的「全自动·4x」）。
3. **观战手雷预瞄**（22-hud updateNadeArc）：显示条件摘掉 `!player.spectator`——弹道点串/贴地落点圈/精确弹着点/预计投掷距离+圈内人数全套对观战者亮出（物理走 13-combat nadeStep 单源纯函数，与时停无耦合；松手收雷显隐对账观战态同样生效）。
4. **烧毁植被黑炭化**（04b-fire）：病根=烧尽染色守卫 `bi.im.instanceColor` 在**从未初始化** instanceColor 的实例批上恒假 ⇒ 草丛/庄稼/灌木烧尽只沉入不变黑。修=新 `instColorInit(im)`（白初始化，观感零变化）在建模期对四处实例批生效（registerBurnableInst=草丛/庄稼、flushBushes=灌木、flushTreeBatch=树干）；`vanishFlora(rec,blasted,charred)` 把染焦黑从 `!blasted` 改为显式 `charred`——只有火烧进来的消亡（烧尽调用点传 true）才染黑（0x241d16 实例色/_charredFloraMat 材质），碾压/炸没路径不再误挂黑炭语义。建树干批白初始化顺带免去运行中 instanceColor null→非null 触发 getProgram 重编译的一次性卡顿。既有沉入链（停留 3.5~8s→沉入→零矩阵消失）不变=「变黑**再**消失」。**顺手修**：`_charredFloraMat` 从 `window._xxx` 挂载收编为模块级单例（名字不变）——裸 Node 沙箱 verify-fire 的烧尽路径在 `window` 未定义下 ReferenceError 整探针崩溃（**A/B 实证为预存崩**：撤本批语义改回 `!blasted` 旧口径，同一行同一错崩溃）；修复后 verify-fire 跑通全程，暴露其下被崩溃掩盖的 **3 条预存断言红**（树冠着火后未倒伏 / 倒伏后树干碰撞体未移除 / 火焰每跳伤害 2.34——**A/B 实证预存**：撤本批语义后三条红与数值逐位相同），红账由"崩溃"转为"3 条断言红"，待后续批次消账。
5. **判据**：新 `dev/verify-batch-20261024f.js` **30/0**（已注册 run-all-verify）——①两文件敌/友两分支+单源判据源断言+beaconInverted 双队视角行为断言+信标产物契约零回归（注：实例色断言须用上下文内 THREE.Color 换算期望值，vendor three 开 ColorManagement 存 linear 空间值）；②specGear 四弹种+clsGear 兵种表零回归+rearmPlayerClass 观战/非观战双分支落装+四处接线源断言；③**行为断言**：spectator 持雷 → #nadeArc/#naBlast/#naSpot/#nadeChargeTip 全亮出+点串 18 点，松手全收干净；④建模期白初始化+烧毁染焦黑（灌木实例色 0x241d16）+无 charred 不染黑负对照+mesh 类换焦黑材质。**触达面探针全绿**：verify-vehmodels 10/0 · verify-batch-20261024e 82/0（信标产物契约）· verify-spec 60/0 · verify-specthird 58/0 · verify-timestopfix 35/0 · verify-foliage / verify-sink / verify-fixes-20261010-batch2（_charredFloraMat 字符串断言仍命中）/ verify-boot / verify-text（i18n 键闭环+戳）全过。
6. **全量 run-all-verify**：剩余 **11 条稳定红=预存红账逐条同名**（zombie / hudfix T4 丧尸累计 / worldrestore scene 台账 56→76 / **fire** / fixbatch-20260926 / naval 红线7 / animfix-20260926 / matseam（自建 THREE 桩缺 BufferGeometry 的旧崩）/ airground-balance / phase4-7d / nade-trigger）——**本批零新增**；两处说明：①fire 见 §4（崩溃→3 条预存断言红，A/B 归因在案）；②nade-trigger 为**布局随机敏感**探针（世界布局 Math.random ⇒ 投影类 B3/B4 判据好布局 1~2 红 / 坏布局 9~15 红，同树两种样本实测均在；撤观战放开 A/B 红集不变）⇒ 非本批引入。fixbatch 的 VEH_HIT_TOP 源锚与 animfix 的棕榈叶源锚均落在他批未提交改动区（本批 15-vehicles/05b-props 的 diff 仅信标/instColorInit 两个 hunk）。
7. **版本戳** `20261024e→20261024f`（index.html 48 处+__sfStyleVer+_game_files.txt+verify-perf/verify-hudfix/verify-animfix-20261012 三探针钉）。实机关注：①敌机/敌坦克头顶应为尖朝下倒三角、友方仍尖朝上（换队后对调）；②观战 G/3/4/6 四键都应出手且每 0.5s 回满，持雷有弧线+落点圈；③火烧过的草/庄稼/灌木应先黑一截再沉没，被坦克碾掉的仍保持原色。
## 一.73 举雷/换弹读条化 × 补给弹药改账(2026-10-25, 待实机验收)
承用户裁定：「现在拿起手雷/换弹就无法取消，这不好——为手雷和换弹增加包扎同款按 X 取消与同样的打断机制；拿取物资仍原时机，但子弹数改为『总弹量上限+弹夹容量』（有意超上限）而非直接填满弹夹」。
1. **举雷待发并入读条取消网**（18-game/10-viewmodel/19-input）：`readBarActive()` 扩认 `VM 'nade'+nadeHeld`；X/✕ 取消=**收雷回袋不消耗**（`cancelReadBar` 摘 `nadeHeld`，模型层 `vmAbortAction` 收雷模回枪——只收哨兵持雷段 stateDur>10，松手出手弧 0.55s 不误杀）；受击打断弹「举雷被打断!」；HUD 读条=普通雷引信倒数（分母新单源 `NADE_FUSE_T=3.8`，00-config，19-input 举起处同源），AT/烟雾/燃烧无计时显满条「已举起 · X 收回」。**左键不取消举雷**（19-input mousedown 负条件排除——举雷是按住瞄准的持续态，误点左键不该把雷收掉；收雷只有 X/✕ 两条有意路径）。
2. **换弹并入取消网**（同链）：X 取消/受击打断=**弹药不结算**（`finishReload` 只在自然走完那条路）；读条显示剩余秒数，**座位门**——上车/上炮后 VM 冻结（24-main 不跑 updateViewModel），条不显示、下车自续走；`cancelReadBar` 账目旗（nadeHold/rl）在 `vmAbortAction` **之前**取（模型层一收 VM.state 回 idle，事后判必扑空）。
3. **换弹中止的模型归位单源**（10-viewmodel 新 `vmReloadRestore()`）：弹匣/弹夹/火箭弹/枪栓/拉机柄/滑轨六件归位——自然走完（nt≥1）与被取消/被抢走走**同一份**还原（旧版换弹中被 F 取弹药抢走 VM.state ⇒ 弹匣留在半路=「枪缺弹匣」滞留，同族于包扎绷带卷滞留）。栓 z0 改**无条件下捕获**（旧版只捕无拉机柄的枪，带拉机柄的栓动枪取消后无从归位）；slide 三把手枪静止位各不同（-0.03/0.01/-0.02），同捕 z0 不写死。
4. **六处抢态入口先收当前动作**（20-player 五处取弹药/补给/医疗箱 + 06-engineering 建造）：`vmAbortAction()` 前置于 `VM.state='grab'/'build'`（幂等）——换弹/包扎/举雷被 F/B 抢走都先归位，不再静默丢态。
5. **补给弹药新账**（18-game `doGrabResolve`）：投掷物+绷带仍全满；子弹 `mag 原样不动，reserve=备用上限+弹夹容量`（汤普森 300+30=330）——超出量恰一匣 ⇒ 与旧版「双满」相比总弹数不亏，只多一道自己按 R 的手续。观战 0.5s 无限补给（20-player:715）与出生配装不在此列、维持双满。
6. **游戏说明**（index.html 帮助 4 处+暂停面板 1 处）：R 装填/X 架枪/G 手雷/弹药箱四行补「X 取消/受击打断/子弹进弹袋」措辞（i18n 词典同键同步）；i18n +9 键（四弹种收条 5+换弹条 1+打断文案 2+帮助行改写）。
7. **判据**：新 `dev/verify-nadecancel-20261025.js` **34/0**（已注册 run-all-verify；--neg 阴性对照 14 红=取消网/弹药账/模型层两分支四块全被证明有分辨力）——真沙箱行为：举雷 X 取消（雷模收起·雷不消耗）/举雷受击打断/`tryReload` 真入口起手/换弹中弹匣确实离位/取消归位/自然走完 3→30·90→63 回归/换弹受击打断/`doGrabResolve` 汤普森 330+kar98 105 且弹夹原样。`verify-animfix-20261012` 两处锚随批更新（readBarActive 扩容行/左键负条件）**66/0**；verify-text 161 键闭环绿；verify-hudfix 仅预存 T4；verify-perf 34/0。
8. **版本戳** `20261024g→20261025a`（index.html 49 处+__sfStyleVer+_game_files.txt 41 处+verify-perf/verify-hudfix/verify-animfix-20261012 三探针钉）。实机关注：①举雷中按 X 雷收回且数量不减、再按 G 重举；②持雷被击中弹「举雷被打断!」且雷收回；③R 换弹出现读条、X 取消弹匣归位、被击中弹「换弹被打断!」且弹数不变；④弹药箱按 F 后弹夹不满、备用弹超上限一匣；⑤上车时换弹条消失、下车继续换完。
9. **★反馈轮①（20261025b）交互动作抢占**：承用户修正「打断=读条期间做其他交互动作会打断读条」。新单源 `player.stealBar()`（18-game，紧挨 cancelReadBar：安静收读条，账目+模型两层同一出口）——调用点=各入口**确认会起步之后**（空按不抢：无目标 F/冷却中 V/同槽 1/满血或没绷带 H/没雷 G·3·4·6/离炮远 6 回收都不白丢读条；迫击炮回收的抢占在 startMortarRecover 找到炮之后）：19-input 动作键 V/G·3·4·6/H/B/6 迫击炮 + `switchSlot(i,viaKey)`/`tryReload(viaKey)`（**同键重按不抢**：换弹中 R 不重启、同种雷重举不重烧引信；异种雷按键=换举）；20-player F 交互栈 **14 处**（四类炮位前摇/上坦克/登艇/登舰×2/登机×2/上炮塔/跳海/5 取物——取物点由裸 vmAbortAction 升级 stealBar，连 nadeHeld/bandaging 账目旗一起收）；06-engineering 建造前置点移到全部早退后。**系统侧不抢**：viaKey 只来自按键（键盘+手柄 LS），空仓自动换弹/程序换枪不带——不会抢走玩家举着的雷。上坦克分支旧「只摘 nadeHeld、换弹冻车上」顺带统一为打断（第 8 条实机关注⑤的口径随之作废，见交付文档 §6）。
10. **★反馈轮②受伤门槛**：承用户裁定「会被高于 25 的单次伤害打断」——新单源 `READBAR_DMG_GATE=25`（00-config），18-game damage 读条打断链改 `amt>READBAR_DMG_GATE&&readBarActive()`（判减免后最终 amt；死亡清账仍无条件）。≤25 刮伤（枪弹蹭伤/火蚀/严寒激流跳伤）不再打断任何读条（含包扎——全族统一口径）；>25 重创（爆炸/狙/近战）才打断。i18n 帮助两行随改（「单次受创>25或改做其他动作会打断」）。
11. **★顺手修（他批未提交代码，A/B 归因在案）**：05c-layouts 草丛实例批 `cap=r²·2.1` 但循环发 `cap*2` 候选，通过率高时 k 越过 cap ⇒ setMatrixAt 越界（**实机=世界构建即崩**；探针=verify-sink 稳定红，上轮全量唯一账外红）。修=`k>=cap` 时 continue 且旋转/缩放两发 wr() 提前消费（RNG 流与旧跑逐位一致，procgen 基线指纹不动）。git diff 该段全在 20261024e 批 + 行内、与本批 8 文件零重叠。修后 verify-sink 5/5 稳绿。
12. **判据与戳**：verify-nadecancel 扩到 **48/0**（--neg 20 红，新增受伤门/stealBar/tryReload·switchSlot 抢占四块阴性对照；行为新增：25/6 不断·26 断双案、R 重按不重启、switchSlot 抢占、系统 R 不抢雷、stealBar 安静、包扎被抢占）；verify-animfix 受击锚+行为 7→26 随机制走（66/0）；verify-batch-f Digit4 源锚随改写（30/0）；procgen 535/0·layouts·boot·text·perf 全绿。版本戳 `20261025a→20261025b`（index.html 49+清单 41+三探针钉）。实机关注（反馈轮）：换枪/R/近战/F 交互打断读条且无"已取消"刷屏；同键重按不重烧不重启；≤25 不断·>25 断。
## 一.74 指挥官模式开工批：兵种级 RTS 指挥层(2026-10-26, 待实机验收)
承开工令：按仓库根《指挥官模式设计-2026-10-25.md》（三轮捉虫 v3 定稿，R1~R12 明裁+D 条款）全量落地。**定位=兵种级附加层，非独立对局模式**（BOOT_MODE 不动，入口=兵种卡）。新文件 `js/26-commander.js`（~830 行，单源全量）+ 14 处外部接线。要点：
1. **指挥官三件套**：`CLASSES[5]={name:'指挥官',commander:true}`（**仅玩家可选**——`CLS_POOL` 仍 0..4，Bot 永不出指挥官）；`WPN_DEFS.radio`（`tool:true` 无火力，20-player playerFireTick 的 tool 门禁开火）；六阵营兵种表第 6 槽=`['radio',阵营冲锋枪]`（ger=mp40 非突击兵的 stg44）。
2. **R10 整局双向锁**：单源 `cmdLockStamp`（23-deploy 部署一处盖章：首选招指挥官='in' 此后含死亡重生永远换不出 / 否则='out' 本局中途换不进）+ 兵种卡全过 `cmdClassCardGate` 门（原因文案走 i18n）；丧尸局/海战图（navalN/capital）无指挥官卡（`cmdClassAvailable`，开局编制照建无副作用）。
3. **开局编制**（`cmdOrbatBuild`，不开放图的局也照建）：本方步兵（排除车载/飞行员/小队/舰炮手/丧尸）按 `foot.filter((_,i)=>i%g===gi)` 整编 ≤5 组挂 `bot.cmdGrp`（**挂组不挂人**——重生自动归队续令 D16）；坦克/飞机编制**挂对象**（`vehicle.cmdOrder`，同对象复位重生存活）；非 free 态 Bot 禁自发上车（14-bots 两处门）。
4. **四词汇命令**（`cmdOrderUnit`：自由推进/攻击移动/原地防守 + 飞机专属指定投弹点）：attack-move 途中接战、到点占旗；飞机接令进攻击航线投弹（途中被咬自卫）、投完自动复飞补弹、无弹中途令作废恢复自由；坦克战损地图灰显、重生恢复。
5. **帧长三态门**（24-main `cmdDtGate` 布势冻结=0/减速×0.2/直通，**K 时停 dt≤0 直通=时停优先**；nowOff 既有账目自动同步 nowT）：减速=按住键 0.2×全场 + 焦点 7s 耗尽回常速 + 1/3 回复；`cmdPlayerDt`/`cmdRideDt` 豁免玩家本人与正在开的那台（设置"对我无效"档，默认关=零漂移）；死亡期禁用、观战免费可用。小地图/观战/时停链零改动。
6. **指挥地图**（举通讯仪右键开，`cmdMapToggle` 单源把关 D18 姿态门=仅步行地面）：canvas 全图（地形/建筑/旗点占领态）+ 己方按队着色带队号 + 缩放平移点选下令；**R12 敌显完全复用小地图管线单源**（同 mmEnemyVis 来源+地图全图信息开关+视野圆蒙版；白天全显=2026-09-06 现状裁定，探针加逐点一致断言）；**D19 废墟补丁**（炸塌建筑 footprint 变废墟色块，挂破坏回调）；**R11 开图定身**、受击不踢出、Esc 只关图连按两次才暂停；观战三路径置灰（指挥官局观战开关灰）。
7. **D21 布势阶段**：本局首选招指挥官 → 冻结布势地图（敌我不动=cmdDtGate 回 0）：调各组兵种配比（该组按配比落装）+ 预下初始命令 + 「默认布势」跳过按钮；确认开战收图解冻（**源序修复**：`cmdDeployConfirm` 必须先 `cmdMapClose` 再清 `mapDeploy`——close 靠该标志判断布势版挂 body 要搬回 #ui，先清再收=压制网永久滞留 body，探针抓出的真源缺陷）。
8. **判据**：新 `dev/verify-commander-20261026.js` **124/0**（已注册 run-all-verify；`--neg` 14 阴性补丁 **31 红**对认：帧长门/减速/编制门/组令继承/双向锁/坦克令/通讯仪 tool 门/读条迟滞/冻结自愈/敌近身门/配比绑定/飞机词汇/右键关图/部署空守卫/开图键盘门各块均有分辨力）——含：源锚 35 条、装备三件套（举通讯仪 130 帧零 gunEvents）、双向锁+丧尸/海战免指挥官（新鲜 ctx2 规避 startNewGame 后 CAMPAIGN 冻结不可写的桩坑）、编制动态期望、四词汇行为（远令前进/近令守点/hold 定身/重生归队/坦克目标±0.1/飞机投弹 spy+无弹作废）、减速焦点矩阵 14 态、姿态门 18 案、布势收图 reparent、i18n 22 键、**小地图源零染指断言**（26 不含 mmEnemyVis/drawMinimap、22-hud 不含 cmdMap）。
9. **全量 run-all-verify**：11 条稳定红与上批（§一.72-6）预存红账**逐条同名同断言**（zombie 8 / hudfix T4 丧尸累计 / worldrestore scene 台账 56→76 / fire 3 / fixbatch VEH_HIT_TOP / naval 红线7 两栖车 / animfix-20260926 / matseam / airground R3 / phase4-7d S4 / nade-trigger 布局随机）——**本批零新增**；唯一账外红 `verify-phase3-20260928` **3 条=本批有意语义变更**（兵种 5→6/槽 5→6/通讯仪无衰减表）——锚随码走三处（P1-a 六兵种、P1-b 六槽+第 6 槽 radio 锚+副武器=阵营冲锋枪修正 SEC 表、P1-c1 tool 豁免同火箭弹）修后 **65/0**；verify-aimassist 全量跑 1 红单跑两连 40/0=布局随机偶发族非本批。
10. **版本戳** `20261025b→20261026b`（index.html 50 处+__sfStyleVer+`dev/_game_files.txt` 46+verify-hudfix/verify-perf/verify-animfix-20261012 三探针钉）。实机验收清单=设计文档 **§11 十六项**（含布势/双向锁/敌显三态/废墟色块/减速矩阵/观战灰/丧尸海战免指挥官）。
## 一.76 布势期三命令键失效修复批：E/F/R 在部署阶段按下均无效(2026-10-27, 待实机验收)
承用户实机报的一行 bug：**「开局前的部署的时候，E/R/F 按下均无效」**。
1. **现象**：选指挥官卡 → 进布势界面 (战场冻结) → 面板高亮行印着 `E 防守此处` / `F 进攻此处` / `R 自由推进`，标题条也写着同样三个键，帮助页写着「E/F/R 下初始令」——按下去**三个键全无反应**。战斗期 (局内开图) 三个键正常。
2. **根因（两段叠加，缺一都不会全灭）**：`26-commander.cmdMapKeyGate` 旧写 `if(CMD.mapDeploy) return code!==CMD_KEYS.free;` ——
   · **E/F**：返回 `true`（已消费）却**不执行任何命令**，调用方 `19-input` 提前 `return` ⇒ 世界侧零变化。这是最坏的一种写法：把「我吃了这个键」与「我做了这件事」解耦，按键被静默丢弃。
   · **R**：该分支对 R 返回 `false`（不归地图），`19-input` 于是继续往下走；而开图早退块的最后一句是 `if(e.code!==CMD_TIME.KEY) return;` ⇒ R 既没被地图执行、也没被放行到战斗语义，**两头落空**。
   两段合起来正是用户看到的一个都不响。
3. **为什么当初会写吞掉**：注释理由是「布势期人还没落地，光标落点没有战术意义」。这条前提本身是错的 —— 布势界面的核心交付就是**初始令**（设计 D21 = 配比 + 初始命令），玩家正要在开打前指定「1 组去 A 点防守」。而且三处界面文案一直在承诺这三个键可用，**实现与自己的 UI 相反**。
4. **修法**：布势期与战斗期**完全同规** —— `cmdMapKeyGate` 删掉 mapDeploy 分支，三个键都走 `cmdKeyCommand`（落点仍取光标 `cmdCursorPt`）。配套 `cmdMapDraw` 的光标十字去掉 `!CMD.mapDeploy` 门（落点必须可见，否则布势里按 E/F 仍是盲操作）。
5. **误触改令的顾虑由两件事兜住**：布势期世界冻结（`cmdDtGate` 回 0，令不会立刻被执行成位移）；面板每 2Hz 重画把每组的当前令印在行上（玩家看得见改成了什么）。
6. **写进不变量**：`cmdMapKeyGate` **不存在「返回 true 但什么都没做」的分支** —— 这正是本 bug 的形态。
7. **判据**：`dev/verify-cmdui-20261027.js` 新增 **③b 段 8 条**（布势入口 mapOn+mapDeploy+世界冻结 / E=hold 落点逐位对 / F=attack_move / R=free / **可反复改令**（第二次 E 落点跟着光标变）/ 非命令键仍不归地图 / 布势期飞机 F=strike / 收尾可正常收图）+ 1 条源码防回退钉（`cmdMapKeyGate` 函数体内**剥注释后**不得出现 `CMD.mapDeploy`）+ 1 条阴性对照 F2（恢复旧写 ⇒ ③b 段 6 条全红；实测 E 的观测值是 `[true, "free", [0,0]]` —— 返回 true 却零执行，精确复现用户现象）。`dev/probe-cmdui-20261027.js` 新增 **①b 段 4 条真浏览器断言**（真 keyDown/keyUp 走 19-input 全局链 → order 真的变了）。改后：**verify-cmdui 65/0（--neg 38/27）**、**probe-cmdui 27/27**。
8. **版本戳** `20261027a→20261027b`（index.html 50 处+`__sfStyleVer`+`dev/_game_files.txt` 46+四探针钉）。**实机关注**：布势界面按 E/F/R 三个键都要有反应（面板行上的令文字与地图上的命令线立刻变），滚轮仍切单位，右键/Esc 仍确认开战。
## 一.75 指挥官交互重做批：对讲机建模 / 队位同源 / 集火 / 三命令键 / 键位对调 / 局内地图不显示(2026-10-27, 待实机验收)
承用户七项需求（第 1、1.5、2、3、4、5、6、7 项）。本批分三块并行施工：Lead（交互层与地图显隐）+ radio-dev（通讯仪）+ deploy-dev（布势撤销）。
1. **① 通讯仪按参考图重做成对讲机 + 配色对齐阵营**（radio-dev）：`09-weapons.buildRadioBody(g,team)` 建 22 件网格（机身/上段窄块/天线根/显示面板/扬声器格栅/金属旋钮/PTT 侧键/绿色 LED），剪影按参考图量出的比例落常量（总高 0.30m、宽:高=157:379、上段 45×100 占 26%、天线根 24 宽）；阵营配色单源 `radioPalette(team)` 取 `FACTIONS[team].coat` 压暗派生（六阵营主色 `#43483c/#424448/#4e4d3e/#56503c/#444d51/#545751` 互不相同）。`buildGunModel(key)` 改 `buildGunModel(key,team)`（唯一生产调用点 `10-viewmodel:56 vmEquip` 已透传）。
2. **①.5 第三人称拿通讯仪显示步枪模型 + 播步枪动作**（radio-dev）：根因=`11-soldiers.gunKindOf(key)` 只按 rocket/mortar/atRifle/pistol/auto 分类，radio 的 def 是 `type:'tool'` ⇒ 一路落到末尾 `return 'rifle'`，于是 `worldGunModel('rifle')` 建出步枪、`GUN_MOUNT_BY_KIND/PRONE/CARRIED_FWD` 全走步枪档、玩家化身与 Bot 共用 `mountGunModel` 一起错。修=① `if(d.radio) return 'radio'` 前置档；② 四张表各补 radio 档（站姿 `{-0.17,0.40,0.30}` 胸前偏右、匍匐 `{x:-0.22,dy:0.12,dz:0.40}`、前推量 0.14 而非步枪 0.30）；③ 新 `GUN_HOLD_BY_KIND` 持握姿态单源（右手 IK 权重 1/左手 0/`noReload`/`noBrace` 旗标 ⇒ 姿态机整段跳过换弹与抵肩），判定只认 `gunKindOf()` 的 kind，姿态机不再写武器名硬编码。
3. **② 队标与队员位置严重偏差/漂移**（Lead）：**根因不是坐标算错，是绘制/命中/选中环三处各写一份过滤口径**（`filter(b=>b.alive)` vs `filter(b=>b.alive&&!b.onVehicle)`）——组里有人上车时队标画在 A、点下去命中 B、选中环画在 C。收敛三单源：`cmdSquadShown(u)`（唯一显示口径 `alive&&!onVehicle`）、`cmdUnitCenter(u)`（唯一中心点）、`cmdUnits()`（唯一扁平顺序）；绘制/命中/选中环/滚轮/面板列表全只读这三个。
4. **③ 集火**（Lead）：左键点地图空地 → `cmdFocusFire(x,z)` 给 `CMD_FIRE.R`(60m) 内全部己方单位挂 `unit.focus={x,z,until:nowT+CMD_FIRE.DUR(14)}`。**刻意不做第五个命令词汇**——把 `cmdFocusBonus(unit,x,z)` 加进既有目标打分（`14-bots.perceive` 与 `15-vehicles.tankPerceive` 两个消费点；圈内 +1e6 顶到最前、3 倍半径外 0 ⇒ 缺函数时零回归）；飞机在 `order.mode==='free'` 且有弹时转一次性 `strike`。地图画脉动红环 + 虚线杀伤圈 + 「集火 Ns」倒计时。
5. **④ 指挥态交互重做**（Lead）：一次只**高亮**一个可指挥项（`CMD.hl`，发光/加粗描边/字号加大），其余项在列表里**压缩成 10px 色条**（旧版是满屏按钮）；**滚轮**在扁平表上循环切高亮（`cmdHlStep`，旧版滚轮是缩放已废）；**E**=光标处防守（`hold`）、**F**=光标处进攻（`attack_move`）/飞机「向此处投弹」（`strike`）、**R**=自由推进（`free`），三键统一走 `cmdMapKeyGate(code)` 单一分流（布势期与战斗期**同规执行**、关图期全 false —— 见 §一.76 的实机 bug 修正）；**左键**点己方单位=改高亮、点空地=集火；**右键**=退出指挥态（`cmdMapToggle`，布势期=确认开战）。面板美术对齐开始界面：`CMD_UI` 羊皮纸/黄铜色板。
6. **⑤ 减速键 N→V，近战键 V→N**（Lead）：`CMD_TIME.KEY='KeyV'`；`19-input` 近战块改 `KeyN`、`24-main` 触控 `tMelee` 改 `KeyN`、`19b-gamepad` RS 键改 `KeyN`、i18n 与 index.html 帮助同步。**裁定理由**：V 在 WASD 手位，减速是**按住**的持续动作必须左手可及；近战瞬时且有手柄/触屏等价键位。
7. **⑥ 局内指挥地图根本不显示 —— 根因**（Lead）：开图/关图/暂停三处各自写 `w.style.display=''`，而 `display:flex` **只存在于 `cssText` 里**，被 `display=''` 抹掉后 wrap 回落 `display:block` ⇒ 内层 `mc`（`flex:1`）高度塌成 0 ⇒ canvas 0×0 ⇒ 「地图开了但什么都没有」。修=新单源 `cmdMapWrapShow(on)` 只切 `.hidden` class（**永不碰 inline style**），四处调用点全改走它。同批 `cmdMapResize` 把 canvas 从铺满舞台改成**居中正方形**（`side=min(W,H)`+`left/top:50%`+`translate(-50%,-50%)`）——旧版方形地图只占舞台宽度 58%。
8. **⑥ 布势可撤销 / 确认即锁**（deploy-dev + Lead）：`cmdDeployUndo()`（实现全在 `23-deploy`，26 的面板按钮以 `typeof` 守卫调它）= 收图 + 兵种配比复位成「按当前实际 cls 统计」+ `player.deployed=false` + **`CMD.lockedDir=null`（撤章）** + 清 `CMD.hl/sel/cursor/focusFire` 四份看图期临时账 + `showDeploy(false)` 回部署页；`player.deployed` 已 true 时直接 `return false`（落地后不许把人踢回未落地）。另一侧：`cmdDeployConfirm` 现在就是 R10 的**语义提交点**——收图后立刻 `cmdLockStamp(player.cls)` 盖 'in'/'out'，于是「确认了就不能再换兵种」在**落地之前**也成立（旧版要等 `deployPlayer` 才盖章，中间那段窗口能改）。盖章/撤章成对出现在同一条链上，单源仍是 `CMD.lockedDir`。配套：`23-deploy.syncClassCardLock()` 抽成单源、`22-hud.updateHUD` 在部署页开着且 `(lockedDir|deployed)` 签名变化时调它——修「确认后卡片样式还停在全部可选、点下去才说不能」。
9. **⑦ 游戏说明**（Lead）：index.html 帮助面板 3 处键位改写（V 减速 / N 近战 ×2）+ 新增「指挥官兵种」整节（三命令键/集火/滚轮切单位/减速/布势撤销三段）；i18n 新增约 20 键（`防守此处`/`进攻此处`/`向此处投弹`/`自由推进`/`↩ 撤销布势 (重选兵种)`/`布势已撤销 · 可重新选择兵种`/`集火`/`集火: {0} 个单位 → 该点`/`滚轮切单位 · E=防守此处 · …` 等）。
10. **判据**：新 `dev/verify-cmdui-20261027.js` **65/0**（`--neg` 38/27 对认，含 ③b 布势期三命令键段；显隐单源/高亮切换/集火半径/集火过期/队位同源/三命令键/减速键/确认盖章/画布正方形/14-bots 消费点/15-vehicles 消费点/近战键 ×2/19-input 转发与键位，15 条负控补丁全红）；`dev/verify-radio-20261027.js` **40/0**（`--neg` 19/21 对认，10 条文本补丁全红）；`dev/verify-deployundo-20261027.js` **47/0**（`--neg` 29/18）；`dev/probe-deployundo-20261027.js` **22/22**（真浏览器布势全链）、`dev/probe-cmdui-20261027.js` **27/27**（真浏览器交互：含 ①b 布势期真按 E/F/R 三条；局内地图真可见/真 wheel 切高亮/真 keydown E·F·R/真左键集火落点逐位对/真右键退出/真按住 V=0.2x 帧长）；`dev/verify-commander-20261026.js` 随批改锚 **146/0**（`--neg` 95/51）；`verify-text` 169 条静态文案闭环绿。五条新探针均已注册 `dev/run-all-verify.js`（两条走 `--browser` 浏览器段）。**锚随码走**：`verify-specthird` T7 的既有键清单把 `KeyV` 换成 `KeyN`（减速键改读单源 `CMD_TIME.KEY`、19-input 不再持有 `KeyV` 字面量，属本批有意语义变更）+ 补一条「减速键没有回退成硬编码」判据，改后 **59/0**。全量 run-all-verify **51/96 exit=0**，失败集与基线**逐条同名**（12 条稳定预存红：zombie / hudfix-20261007 / worldrestore / fire / fixbatch-20260926 / naval / animfix-20260926 / matseam-20260927 / airground-balance / phase4-7d / nade-trigger-20260930 + specthird 首次跑时锚未更新，改锚后 3/3 通过），**本批零新增**。
11. **版本戳** `20261026b→20261027a`（index.html 50 处+`__sfStyleVer`+`dev/_game_files.txt` 46+verify-perf/verify-hudfix/verify-animfix-20261012/verify-commander-20261026 四探针钉）。**实机关注**：①第三人称举通讯仪应是台对讲机且不播拉栓/抵肩；②指挥地图上队标/点选/选中环三点重合不漂移；③左键点地图有红环+倒计时且附近单位真转火；④滚轮切高亮、E/F/R 三命令、右键退出；⑤V 减速按住有效、N 近战；⑥局内开图能看见地图且是居中的正方形；⑦布势里点撤销回部署页能重选兵种、点确认后其余卡立刻变灰。
## 一.77 指挥官模式实机反馈七项修复批(2026-10-27, 待实机验收)
承用户实机试玩七报：①指挥读条常驻显示且与占领条下方文字重叠；②布势期应取消右键退出；③同队队员应集中生成/相对集中的几人编为一队；④指挥官模式下玩家仍带私人小队跟随；⑤指挥官兵种卡应有新模式标识边框与说明；⑥战斗内右键开指挥地图「随机缺右边一块 + 原因不明地变明变暗」；⑦选中哪个队伍/载具只高亮哪个，其余队友加厚灰。
1. **① 读条非常驻 + 避开占领条**（Lead）：病根=`cmdFocusHudTick` 无条件显示 wrap（`bottom:15.5%`≈167px @1080p，正压 `#capPanel`（bottom:110px、高 ~60px）顶缘）。修=**按需显隐三态**：读条消耗中(drain) / 减速中(slowOn) / 收费档恢复期(costly&&focus 未满) 才显示，免费档满格常速隐藏；位置 `bottom:186px` 让开占领面板。
2. **② 布势右键退出取消**（Lead）：`cmdMapBind` 右键分支加 `if(CMD.mapDeploy) return;` —— 布势期右键无操作（退出布势唯一出口=确认/撤销两按钮，防误触丢整局布势）；战斗期右键关图不变；`cmdMapToggle` 的布势分支保留（触屏 tCmdMap 仍可达，语义=确认开战）。
3. **③ 就近聚组 + 集中生成**（Lead）：`cmdOrbatBuild` 弃轮转平均（`foot.filter((_,i)=>i%g===gi)` 会把同街散兵分到对角组），改**贪心近邻聚类**：组容量=base+(gi<rem)，种子取离已分质心最远者、成员逐个取离组质心最近者。重生集中生成：14-bots `spawn()` 新钩（`cmdGrp.kind==='inf'` 且 `cmdIsCommander()`）调新单源 `cmdSquadSpawnNear(bot)`=向存活组员（车载取车位）质心 6~9m 环 6 次落点（`occBlocked`/`freeSpot`/`NAV.spawnSpot` 三门），全组阵亡回退原落点；`laneDx/laneDz` 透传不扰动 pickObjective 路线权重。
4. **④ 私人小队互斥（解散收编）**（Lead）：指挥官局不再保留玩家私人小队（否则 3 名队友在编制图上不可令，且 `cmdOrbatBuild` 的 `!inSquad` 过滤会漏掉他们）。`cmdLockStamp` 盖 'in'：`cmdDisbandPlayerSquad()`（清 SQUAD.members+inSquad，账 `CMD._disbanded`）→ `cmdOrbatAdopt()` 收编进编制（优先填 <5 的组，否则新组）；盖 'out'：`cmdSquadRestore()` 还编（牌色复原+空组清理+重索引）。接线三处：`cmdDeployOpen` 进布势即解散收编（布势图第一帧即全编制）、`23-deploy.cmdDeployUndo` ④c 还编、`cmdResetMatch` 清 `_disbanded`。
5. **⑤ 兵种卡金边 + 模式说明**（Lead）：22-hud 卡片 `i===5` 加 `cmdCard` class；css 金色边框+内发光；卡内新说明行「新模式 · 指挥官: 右键开指挥地图统一步/坦/空 · E/F/R 下令 · 左键集火 · V 减速」，i18n 入典。
6. **⑥ 缺块 + 变明变暗 = 双病根**（Lead）：**变明变暗**=`cmdMapDraw` 单位循环 globalAlpha 泄漏——坦克分支 `if(!v) continue;`、飞机分支 `if(!v||!v.alive) continue;` 跳过循环底部的 alpha 复位，0.55 半透明漏给后续敌军点/选中环/指针，并**跨帧**带进下一帧底图/烘焙/蒙版（亮度脉动与飞机战损同步=「原因不明」）。修=单位循环整段去 globalAlpha，画笔入口+循环出口双复位。**缺右边一块**=战斗期视图窗（scale=1 → MH 米宽）在玩家贴边时探出烘焙世界 [-MH,+MH]，出界=黑虚空；修=新单源 `cmdViewClamp(S,k)`（窗≥世界时居中归零，否则钳在 ±(MH−hw)），布势整图不受影响。另 wrap 底 `rgba(10,14,8,.92)`→不透明 `rgb(10,14,8)` 杜绝战斗期枪口焰透图；D8 屏缘 2.2% 世界缝隙为有意设计不动。
7. **⑦ 唯一高亮 + 厚灰**（Lead）：单位循环弃 alpha 压暗——非高亮单位体色 `#8f948b` + 灰晕底衬（步兵圆晕/坦克矩形晕/飞机大圆晕）、标签 `#a9aea5`；选中单位保留队色+白环/四角十字。厚灰与 alpha 卫生同一段落地，杜绝第二条泄漏路径。
8. **判据**：新 `dev/verify-cmdbatch2-20261027.js` **35/0**（`--neg` 24/11 对认：读条门/布势右键/聚组 while/14-bots 钩/盖章接线/撤销还编/视图钳制/alpha 卫生/厚灰/卡 class/_disbanded 清账 11 补丁全红）；沙箱段含聚组双簇实验（两簇 4+4、簇内 <10m、簇间 >70m）、`cmdSquadSpawnNear`（近质心 <25m / 全灭 null / 无组 null）、解散-收编-还编全链幂等、读条三态显隐（含免费档）、视图钳制、换局清账。`dev/verify-commander-20261026.js` **判据跟走**：⑨ 段 BUG9 对照组原「找一个天然 inSquad 散兵」在 ③ 段盖章解散后已无对象（`squad=undefined/undefined`），改就地搭对照组（临时 inSquad=true+清 cmdGrp，用后还原），改后 **146/0**（`--neg` 按设计全红、25 锚点全命中）。全量 run-all-verify **52/103 exit=0**，失败集与预存红账**逐条同名**（12 稳定：zombie / hudfix-20261007 / worldrestore / fire / fixbatch-20260926 / naval / animfix-20260926 / matseam-20260927 / airground-balance / phase4-7d / nade-trigger-20260930 + nav 偶发 1/0/0；timestopfix 偶发 0/0/0），**本批零新增**。
9. **版本戳** `20261027b→20261027c`（index.html 50 处+`__sfStyleVer`+`dev/_game_files.txt` 46+verify-animfix-20261012/verify-hudfix/verify-perf/verify-commander 四探针钉）。**实机关注**：①满格未减速时读条消失、减速/回条时出现且不再压占领条文字；②布势期右键无反应、战斗期右键仍退出；③编制图上同街散兵同组、组员重生落在队友附近；④选指挥官后私人小队跟随消失、撤销布势后跟随回来；⑤兵种卡金边+说明行；⑥战斗期贴边开图右侧不再缺块、飞机战损时地图不再忽明忽暗；⑦滚轮选中谁只有谁彩色，其余全厚灰。
## 一.78 指挥官子系统内联逻辑自查五虫批(2026-10-27d, 待实机验收)
承用户令「指挥官模式子系统的内联逻辑自行完成一轮 BUG/过于不合理之处的排查和修复」：全链通读 26-commander.js + 八个消费文件 + 三份既有探针，五虫全落地（详见《指挥官模式设计-2026-10-25.md》2026-10-27d 速查节）。
1. **布势期 Esc 实际弹暂停不确认开战**（19-input）：`cmdMapUIOpen` 分支旧写嵌在 Esc 处理器 `player.deployed&&player.alive` 门内，布势期两值皆 false ⇒ 永远走不到确认单源，Esc 落进 else 变 `togglePause(true)`（三处注释宣称"布势 Esc=确认"，三键失效批修了 E/F/R 漏了 Esc）。修=分支上提门外 + `&&!gamePaused`（D20 暂停优先：暂停中 Esc 只解暂停，顺带修掉旧写"暂停中 Esc 会去关被藏起的战斗地图"）。
2. **布势配比被"摘自己"扣减对抗**（26-commander `cmdRatioWantBot`）：唯一调用点（14-bots spawn 落装行）此刻 bot 必是死人（构造器/die 置 alive=false，落装行之后才置 true），have 统计天然不含它 ⇒ 旧"把自己从 have 摘掉"扣减凭空虚增旧兵种位 gap，死者总按旧兵种复活、玩家配比被永久拉回旧分布。修=删扣减（want 合计=全组人数，死人=待补空位，贪心天然收拢回 want）+ 两处引旧值注释剥离。
3. **撤销布势不清初始令**（23-deploy `cmdDeployUndo` + 新单源 `cmdOrbatClearOrders`）：撤销复位配比/锁章/看图账/私人小队，唯独没清布势期 E/F/R 下的 hold/attack/strike ⇒ 撤销后改选普通兵种，全军按一份"没人能取消的幽灵令"打满整局。修=撤销链新增 ④b-2 步（全单位归 free + 飞机 strikePt/strikeT0 同清，静音幂等）。
4. **集火标记过期永挂"集火 0s"**（`cmdMapDraw`）：unit.focus 由 cmdFocusOf 自行过期，显示账 `CMD.focusFire` 无人收 ⇒ 红圈+倒计时画到换局。修=画时过期当帧即清账。
5. **布势重进门漏路径**（22-hud）：旧门含 `player.cls===5` 子条件 —— "撤销→改选步兵→再点指挥官卡"时布势不自动弹且无补进入口。修=去掉该子条件（凡未落地点指挥官卡都进布势；死亡不清 deployed 已核实，"死了等重生不许重进"的门不变）。
6. **判据**：`verify-commander-20261026` **147/0**（+1 条"补差不被摘自己带偏"定案断言：分布已合 want 时死者按正差位 cls3 复活而非旧兵种 cls0；Z 负控锚随码走）；`verify-cmdui-20261027` **66/0**（+Esc 上提源码钉 + 阴性对照 P=恢复旧嵌套 ⇒ 钉红，`--neg` 28 红对认）；`verify-deployundo-20261027` **49/0**（+②b 段 2 条：撤销前初始令在账 / 撤销后全令归 free+strike 账同清）。全量 run-all-verify 失败集与预存红账逐条同名（11 条稳定红零新增）。
7. **版本戳** `20261027c→20261027d`（index.html 50 处+`__sfStyleVer`+`_game_files.txt`+hudfix/perf/animfix/commander/cmdbatch2 五探针钉）。**实机关注**：①布势界面按 Esc 应直接确认开战回部署页（不再弹暂停）；②暂停中按 Esc 只解暂停、解冻后地图原样回来；③布势调好配比后故意让人阵亡几次，该组兵种构成应向配比收拢而非漂回旧分布；④布势确认→撤销→改选步兵开局的整局全军自由推进（无幽灵令）；⑤集火圈 14 秒后自动消失。
## 一.79 指挥官子系统内联逻辑自查第二轮五虫批(2026-10-27e, 补登——该批此前只落设计文档速查节与记忆, PLAN/README 漏登)
同一用户令「指挥官模式子系统内联逻辑自查」的第二轮独立排查（不与 27d 批共改动面），五虫全落地，详细论证见《指挥官模式设计-2026-10-25.md》2026-10-27e 速查节。
1. **普通局 Bot 重生兵种被编制配比锁死（零回归红线破口）**（26-commander `cmdRatioWantBot`）：`cmdOrbatBuild` 挂 startMatch 尾无条件建编 ⇒ 普通局 Bot 同样带 cmdGrp，而本函数缺指挥官门 ⇒ 死者重生走"配比补差"，gap 恰落在死者旧兵种位 ⇒ 死者永远按旧兵种复活、CLS_POOL 每命重掷被静默替换。修=函数头补 `!cmdIsCommander()` 门（判据单源在 26 侧，14-bots 不长第二份）。
2. **底图预热只接一半 + 布势入口同步整烘兜底（三审卡顿修复被架空）**（`cmdFrameTick`/`cmdDeployOpen`）：只有"推进"没有"起作业"，部署页期间作业根本不存在；cmdDeployOpen 旧 `cmdBake()` 同步整烘使进布势当帧僵死复发。修=cmdFrameTick 补起作业门（orbat 已建 + cmdClassAvailable + 非观战队列），cmdDeployOpen 降为"起作业"口径分帧续算。
3. **观战减速词条三处 N→V 漂移 + 探针被注释喂绿**（22-hud 票数行/词典 EN/23-deploy fallback）：旧键名 `N=减速(不耗资源)` 使 t() 查表 miss；verify-commander 旧判据 `s23.includes('J=信息层 · N=减速')` 实为被 23-deploy 注释喂绿（运行期拼接串无整句）。修=22-hud 接 `cmdSpecHudKeys` 单源拼整句、EN 译文/fallback 纠正、判据改钉真实拼接行。
4. **死代码**（26-commander）：`cmdFocusOfBot` 全库零调用（注释宣称的消费方式与事实不符）、`CMD.pick` 两步下令链退场后的只写残留。修=删除并留防复刻注释。
5. **cmdDeployHint 裸调 showScorePop**：全文件唯一无 typeof 守卫站点。修=补守卫。
6. **判据**：verify-commander 147/0（两条观战词条判据随码改锚）+ verify-cmdui 66/0 + verify-deployundo 49/0 + verify-cmdbatch2 35/0；全量 run-all 稳定红零新增。**版本戳** `20261027d→20261027e`。
## 一.80 指挥官子系统内联逻辑自查第三轮三虫批(2026-10-27f, 待实机验收)
同一用户令的第三轮独立排查。全链重读 26-commander.js + 九个消费文件 + 四条探针判据/阴性锚，三虫全落地（详见《指挥官模式设计-2026-10-25.md》2026-10-27f 速查节）。**三虫全是"注释宣称≠实现/设计承诺未兑现"型。**
1. **拖拽平移从未接线（注释宣称的交互不存在）**（26-commander `cmdMapBind`）：`drag` 只在 mousemove/mouseup 出现，mousedown 从不给它赋值 ⇒ 首帧 `if(!drag||!CMD.view) return` 恒 bail，平移整链是死代码；`CMD._follow` 也从无交互置 false 路径（只有布势入口置过），与 cmdMapOpen 的 _follow 复暖注释块和滚轮注释"缩放另有两条现成路径（拖拽平移仍保留…）"直接矛盾——战斗期视图只能跟玩家走、滚轮已改派切人 ⇒ 玩家没有任何手段看战线别处。修=**中键按住拖动=平移**（左键=集火/右键=关图/滚轮=切人后唯一空闲键；中键语义与 19-input 的飞机锁定不冲突——地图开着时 stopPropagation 根本到不了那边），拖动起手置 `CMD._follow=false`（复位点=开图，既有语义）；开图弹报与战斗标题条补"中键拖动=平移"词条（i18n 两块×2 处 + index.html 帮助页同步）。
2. **票尽清空未实现（设计 D 条款后半句落空）**（新单源 `cmdOrbatPrune`，挂 cmdFrameTick）：坦克 15-vehicles/飞机 16-aircraft/士兵 14-bots 的重生门都是 `tickets[team]>0` ⇒ 本队兵力票归零后阵亡单位永不再现，旧写无任何清账路径——面板永远多一行灰"全灭"、滚轮停靠死单位、E/F/R 能对永不能执行的载体下令、集火播报还把它们算进"n 个单位"。修=判据"单位已无任何可上阵成员 且 本队票尽"（坦克/飞机：veh 死+票尽；步兵组：全灭+票尽；**还有票的死车不动**=既有"战损灰显"档），裁剪即重排序号 + 高亮/选中账归零 + 载具 cmdOrder/strikePt 摘账（与 cmdResetMatch 同纪律）；tickets 未定义的极端沙箱整体 no-op（探针按下标读 orbat.tanks[0] 的既有断言不被裁剪打空）。
3. **开图失败词条两路全错**（`cmdMapToggle`）：'指挥地图: 需步行于地面, 手持通讯仪' 的"手持通讯仪"在两条入口上都不成立——右键路径在调它**之前**已验过手里是通讯仪（失败原因不可能是没拿），触屏 tCmdMap 路径压根不需要。修=改'指挥地图: 需徒步于地面'（i18n 两块×2 处）。
4. **判据**：`verify-commander-20261026` **151/0**（+3 正钉：中键拖动接线锚/票尽清空单源+接线/词条跟走，+1 条沙箱行为断言：死坦克+票尽=出编制且高亮清账、还有票=保留、全灭组+票尽=出编制；NEG 新增 AD/AE/AF 三补丁逐条亲见转红，`--neg` 52 红=27e 账 49+3 逐条对认；L 补丁"右键关图退场"锚随码走——旧锚以 mousedown 收尾 `});` 结尾，中键分支插入后不再命中，改锚到右键分支体本身）；`verify-cmdui-20261027` 66/0（战斗标题条词条键随码跟走）；`verify-deployundo-20261027` 49/0；`verify-cmdbatch2-20261027` 35/0。全量 run-all-verify **两轮 exit=0**（套件白名单对账零意外红；两轮 tail 视图差集逐一单跑归因：hudfix T4「Zombie.die 累计 +1」=在案稳定红、naval 红线7=在案偶发红、phase3 P1-i2=js/19-input.js 既有态缺 `Digit5&&cls===4` 锚——该文件本批未触碰、animfix run-all 环境性偶发而单跑 66/0）。`verify-perf` 34/0（升戳钉随走）。
5. **版本戳** `20261027e→20261027f`（并发批随即将全库戳扫至 20261028a，本批七处探头钉随扫同步——27e 记忆"d→f 实录"同款并发场景，探针复验全绿）（index.html 50 处+`__sfStyleVer`+`_game_files.txt` 46 行+hudfix/perf/animfix/commander/cmdbatch2 五探针钉）。**实机关注**：①局内开图后**按住鼠标中键拖动**应平移视图、松手前视图不再跟人走，关图再开恢复跟随；②把一方兵力票打空后，其阵亡的坦克/飞机应从指挥地图面板与滚轮列表里消失（还有票时的灰车/灰机保留并显示重生倒计时）；③非指挥官普通局零回归（本轮三虫全部收在 26 一侧或地图 UI 层）。
## 一.81 丧尸模式与随机地图指导文档复盘批 (2026-10-28a, 待实机验收)
用户令: 核对《丧尸模式与随机地图-子系统深度重构与修复工程指导.md》所列问题是否仍存在, 存在则认真修复。逐条审计结论: **①胜负流/票数流失 (21-match updateFlags 丧尸专门流 + isTeamEliminated 单源 + zombieInfect 扣票重生) ②质心分队 (zAnchor/update 聚集点按队采样) ③副桥路网 connector (00c §2 二/三桥桥堍接巷) ④单队基地"守点旁 8m" ⑤菜单大厅单源+ZOMBIE_MODE 载入期常量化 ⑥BUILD_COST/ZP 商店 ⑦timeTxt 双钟消歧** 均已在 2026-10-07b/c/d/e 与 2026-10-11 批次落地, 零动作。**坦克驻车防扒车一条按 10-07d 用户裁定改口径为"停桩=车被慢慢拆掉", 不按指导档阶段三执行。** 本批修复仍在场的九项:
1. **近战伤害延时脱离主时钟 + 无三维门 (红线2)** (25-zombies `zMelee` + 14-bots 刺刀): 双处 `setTimeout(380)` 改实例账 (`_pendAtk`/`_pendMelee`) 由 dt 积分驱动 (暂停/时停不再隔空掉血), 结算补 `dy<1.8` 高度门 (旧判据纯水平距离, 高台/楼板隔空抓杀病根); 14-bots 结算放 update 最前 (不受上炮/座位早退影响)。
2. **自爆尸被杀不殉爆** (25-zombies `die`): 拆 `zBoomBlast` 单源 (爆圈 explodeAt + 载具直伤 + 尸群连锁), 引信到期 (zBoom) 与被杀/连锁炸死 (die) 共用; 被杀殉爆保留击杀者记账与 zStats, `_boomDone` 防双爆, alive 守卫保证链式殉爆有限步终结。
3. **丧尸卡墙只会蹭墙滑步** (25-zombies update): `_blkT>1.0s` 且目标 >8m 时借 `NAV.findPath` 取前 2~3 路标充能拐过转角再切回直线冲锋; 冷却 6s/只 + **全局每帧 3 次预算** (nowT 换帧重置, 百尸同帧撞墙错峰); 寻路充能同 zAlertHorde 口径刷 `_zSeenT` 6s chase 窗。
4. **人类 Bot 见丧尸贴脸仍切刺刀白送** (14-bots :954): 入口加 `!(this.target&&this.target.zombie)` 守卫, 尸潮局 Bot 保持枪械交战; 普通对战零变化。
5. **水乡主河假性激流** (00c :1224/:1231): `d: 2.8→1.8` — 旧值落进 inRiverChannel "d>2=深谷激流" 档 (坦克误入熄火吃 VEH_RAPIDS_DMG/步兵被冲移受创); 1.8 关闭激流, `_waterStrip` 浅河支把水面钳到 SHALLOW_RIVER_MAX=1.15 ⇒ 中心水深 1.15m 全程涉渡 (SWIM_DEPTH=1.35 之下), 乡村小河口径。
6. **支汊/鱼塘悬空浮水 (指导 §4.4(1) 病根实锤)** (03-terrain heightAt): procgen water 群系的水文只在 00c 产折线/圆表, hgrid 烘焙不含下切 ⇒ `_waterStrip`/鱼塘圆盘 (都按 heightAt 取位) 浮在未下切地面 ~8cm。修=补进 heightAt 修正链与 RIVER 同层 (支汊 -1.2 sstep(cw=DELTA.w) / 鱼塘 lotus -0.65·fish -0.85 sstep(r+1.2)), **hgridClear 早已把这两族记入带内特征** (半径逐位一致) ⇒ 快路/精修同源; 钉 `layout==='procgen'` 严禁淞沪 delta (rawHeight 内已有) 双份叠加; 附 procgen 塘底/汊滩泥滩色带 (镜像淞沪参)。
7. **单队基地 30m 净空掏空广场** (00c `canTake`): solo 基地贴核心 8m ⇒ 30m 圆把钟楼/民居/围墙驱逐成荒地; 收窄到 **12m** (罩住出生点/弹药箱 ±3m 与部署站位), 广场肌理保留成"被围困的中心聚落"; 双队/普通模式 30m 不变。
8. **丧尸局建造职业锁死 + 提示 undefined** (19-input KeyB/Digit5 + 06-engineering): 门改 `cls===4||ZOMBIE_MODE` (座位门不变); 丧尸基础件 sandbag/wire/hedge **全职业免费** (pendingBuild cost:0 ⇒ 落成扣款/拆除退款自然归零); 商店三件 ZP 价收 **`BUILD_ZP` 单源** (engBuild 扣款与 Digit5 弹窗同读, 旧版 tower/ammoc 查 BUILD_COST 落空 ⇒ "消耗undefined点"); i18n 词条键随参量同步。
9. **选 1 队开局顶栏/结算穿帮 0 队** (22-hud tickets 左格 + 21-match 结算 bar): solo 右格被丧尸在场数占位 ⇒ 左格是玩家唯一队伍行, 旧硬编码 TEAM_NAME[0] 改读 `player.team` (teams/普通模式仍显 0 队)。
10. **顺手修 (探针逼出)**: `zDefPosts`/`zVehPosts` 兜底补点从"盲推 rand"改过 occBlocked/深水门 (12 次尝试), 且**先取整再过门** — 实录浮点 .5 格边界翻格 (sin(5π/6)≈0.4999… ⇒ 原始点 390 行格空/存储点 391 行格被结构 ±0.6 边距堵死), 门对存储点自洽成为不变式 (Bot 落点=存储点)。
11. **判据**: `verify-zombie` **47/0** (连续 6 轮; 判据跟走 10-11 批滞留: 初生免伤 `_riseT` 清窗/感染队列 `flushZombieInfections` 手动冲/ZCFG 分档形状+12min/`getZCurrentInterval` 等值钉 + T4 dt 账冲账 + 跑者摆 zw0 对侧去"连锁唤醒"偶发 + 防区点断言提前到 T6 造沙袋之前); `verify-zombie2` **全绿** (+T8b 新钉: 被杀殉爆爆圈 + 近战 Y 轴门 3m 高差不受伤/同面照常命中 + T7 主炮改环搜 32 方位"弹道三查全清"落点 — 10-24 田带批后庄稼参与开火预检, 固定方位被挡 0.6s 退避不出膛); `verify-fixes-20261011` 12min 跟走 (`ZCFG.solo.surviveT+1`); `verify-procgen` **535/0**; `verify-boot` 15 图 LOAD OK 零失败 (预设图逐位零漂移红线 5 守住 — 本批全部改动面钉 procgen/ZOMBIE_MODE/solo)。run-all-verify 结果见 README 2026-10-28a 行。
12. **版本戳** `20261027f→20261028a` (index.html 50 处+`__sfStyleVer`+`_game_files.txt`+hudfix/perf/animfix/commander/cmdbatch2 六处探头钉随扫; 27f 批预告的并发扫戳即本批)。**实机关注**: ①单队生存选 1 队 (德军/日军) 开局: 顶栏左侧应显示所选阵营与真实人数, 结算页兵力条同; ②水乡群系: 鱼塘/支汊水面应镶嵌在下凹河床/塘底, 步兵涉水过主河全程涉渡无激流伤害, 坦克可低速涉过不再熄火掉血; ③非工程兵 (突击兵) 进丧尸局按 B/5 可建造, 沙袋/铁丝/拒马免费, 提示无 undefined; ④瞭望塔顶玩家不再被塔底丧尸隔空抓伤; ⑤射杀自爆尸应当场殉爆并波及周围; ⑥丧尸攻村应绕墙 rather than 集体卡墙挠墙; ⑦人类 Bot 遇尸潮应开枪射击而非拔刀冲锋。

## 一.82 五项批：票尽观战部署放行 × 读条同键加速/双击打断 × 中性观战结算 × 迫击炮削弱 (2026-10-30, 待实机验收)
承用户五项诉求 (讨论确认后一批落地): ①兵力票耗尽卡重部署页, 切观战后仍无法重部署 → 观战开关开着即可部署; ②读条中同键再按不应取消 → 改为略微加快 (每按 2.5%); ③读条中用其他动作打断需连按两下 (0.5s 窗口); ④观战结算应为观战专属 (中性化); ⑤迫击炮超模 → 半径 5.25/伤害 100/CD 标准档 (用户追加"伤害≤100")。
1. **①票尽观战部署放行**: 新单源 `specWillBe()` (18-game) = **本次部署解决后**的观战态 (`typeof specWant==='boolean'?specWant:!!spectator`; specWant 是"待生效"意图, 要到 deployPlayer 才落进 spectator, 门必须问"解决后"而不是"现在"; `specWant=false` 显式关与未设都返回 false)。四处门全改 `tickets<=0 && !specWillBe()` 才禁用/拦截 (23-deploy 部署按钮 disabled + deployPlayer 早退 / 22-hud deployBtn onclick / 24-main 死亡页每帧 disabled 刷新); 部署页票尽双文案 (有观战意图→「⚠ 己方兵力已耗尽 · 部署将以观战身份入场」/ 无→原文案等待清场结算, i18n 新键)。正确性依据: `fieldCount()` 本就排除观战者 (21-match) ⇒ 清场判定/最后一人 30s 倒计时/双归零豁免均不受观战部署影响; 观战部署不扣票 (die 才扣)。
2. **②同键再按=极少加快** (BAR_PRESS_BOOST=0.025 单源, 00-config): 包扎 H (**倒计时账+VM 动画账双账同步**推进 `player.bandaging-=BANDAGE_T×2.5%` 钳 0.01 交 tick 结算 + `VM.stateT+=stateDur×2.5%`) / 拆除 B·回收 6 (`demolish.t+=DEMOLISH_T×2.5%`) / 前摇 F (`useCast.t+=dur×2.5%`, 占位保留不取消) / 换弹 R (`VM.stateT+=stateDur×2.5%`); 举雷同键重按维持原语义 (无效果, 不是完成型读条)。
3. **③双击打断** (BAR_ARM_WIN=0.5 单源): 新单源 `barStealArmed(key)` (18-game) — 无读条→直通放行并清账; 读条中首按→记键+时间戳返回 false (不抢); 0.5s 内**同键**再按→放行 (账清空)。**不代抢** — 抢占仍由调用方在"确认起步"处 `stealBar()` (attempt-then-steal 处第二次按目标消失/起步失败也不白丢读条); 键身份=e.code 或 'SW'+槽位 (换枪)。接线 **27 处**: 19-input 11 处 (近战 N/手雷 G/AT雷 3/烟雾 4/燃烧 6/迫击炮架设 6/包扎 H/建造拆除 B/换弹 R/换枪 SW+槽位) + 20-player tryInteract F 交互栈 14 处 (登舰×2/取物×5/上炮塔/登机×2/跳海/上迫击炮/上坦克/登艇) + 06-engineering 2 处 (迫击炮回收/建造); HUD 读条标签武装态 0.5s 窗内追加「▶ 再按一次打断」。X 键/左键取消 (举雷除外)/受击>25 打断/移动打断前摇保持**单击立即**; 「确认起步才抢」纪律原样保留。
4. **账目卫生**: `barArmKey` 在 cancelReadBar (含 stealBar/受击/X/左键) 与四处**自然走完**点 (包扎 tick/前摇 finish/拆除回收/换弹 finishReload) 清账 — 旧键不得残留到下一条读条的双击窗里。
5. **④中性观战结算** (21-match endMatch): 观战局判据与 recCommit **同源** `!REC.counted` (结算瞬间在观战态或本局观战态部署过); 图标 `END_SVG_SPEC` (钢灰"观战之眼") + 标题「对 局 结 束」(沿用平局灰色配色) + 副标题末段「胜方 · 某某军」/平局; 本局得分/战绩卡/兵力对比条/「不计入历史记录」说明全保留; 非观战局逐字节不变; i18n 三键 (对 局 结 束/胜方/平局)。
6. **⑤迫击炮削弱** (13-combat nadeExplode 迫击炮分支): 爆炸半径 7.5→**5.25** / 步兵伤害 135→**100** / 结构伤害圈随爆径 7→5 (210 不动) / 玩家 CD 3.2→**4.5s** (20a-seats, heatFill 分母兜底同步) / Bot CD 4.2~6.5→**6~9s** (14-bots); 载具 150/射程 13~51m/连杀加速均不动; 00-config 爆圈注释更账; 两侧对称削弱 (同一份弹道/爆炸单源), 连杀 reloadMul 照旧生效。
7. **判据**: 新 `verify-batch-20261030` **50/0** (源码锚四组 + 沙箱行为: barStealArmed 武装矩阵六态 / R·F 推进量逐位对 / specWillBe 四态矩阵+票尽拦截战报 / 迫击炮爆炸参数间谍 5.25·100·150·struct5·210); 阴性对照 **19 红/31 绿** (14 补丁逐条亲见转红)。判据跟走: `verify-nadecancel-20261025` **48/0** (R 重按判据从"stateT 原样"跟走为"推进 stateDur×BAR_PRESS_BOOST", 探针侧**从源码解析 BOOST 常量**不写第二份死值; tryReload/switchSlot/近战/包扎四条源码锚随新门; 行为测试 (a)(b) 改双击语义; NEG 补丁 G 拆两条随码走) 阴性 21 红; `verify-animfix-20261012` **66/0** (19-C「H 再按=取消包扎」锚跟走为同键加速锚: 旧取消写法断言不在+加速双账锚在); 戳钉五探头 (hudfix/perf/animfix-20261012/commander/cmdbatch2) 16 处随扫 20261030a。run-all-verify **两轮**: 首轮因并发升戳作废 (27d 教训重演), 次轮干净通过 — 失败集=预存红账逐条同名 (hudfix T4/worldrestore 植被2/fire 3项/fixbatch-20260926/animfix-20260926/matseam-20260927/airground-balance/phase4-7d/nade-trigger-20260930 稳定红 + naval/nav 在案偶发), **零新增** (nav-20260926 本轮通过; 其偶发性另有三连单跑绿在案)。
8. **版本戳** `20261028a→20261030a` (index.html 50 处+`__sfStyleVer`+`_game_files.txt` 46 行+五探针钉)。**实机关注**: ①票尽+观战开关开着: 部署按钮可点、点部署以观战者入场 (免伤/不被索敌/幽灵坦克 F 可用), 关着照旧禁用, 开关从关到开后按钮下一帧亮起; ②包扎 H/回收 6/拆除 B/前摇 F/换弹 R 连按=略微变快不取消不重启 (每按≈快 2.5%); ③读条中按其他动作键一下不打断只亮「▶ 再按一次打断」, 0.5s 内再按才打断, 换键不共用确认; **F 交互栈也双击** (读条中上坦克/上艇/补给需连按两次 F, 紧急逃生多按一下属预期); ④观战局结算=「对 局 结 束」+灰眼图标+「胜方 · 某某军」, 普通局结算逐字节不变; ⑤迫击炮爆圈肉眼变小 (与手雷同级偏小)/满血兵中心命中不再必死 (100 伤+5.25m 衰减)/玩家连发 4.5s、Bot 6~9s; ⑥EN 下新文案全有英文。

## 一.83 自查批：预存稳定红清理 × 云层快照翻倍真修 × 两栖车登陆三层修复 × 工作区清理 (2026-11-01, 待实机验收)
承用户指令"自行排查+修复一轮 BUG，再清理工作区的无用文件/文件夹"。基线 run-all 定型 **10 条稳定红**（与一.82 登记的预存红账逐条同名），本批逐条根因定位：**1 条真游戏 BUG**（云层快照翻倍）+ **1 条真 AI 缺陷三层修复**（两栖车登陆，仍红如实登记）+ **8 条探针判据漂移跟走**；另完成工作区清理（未跟踪 3092 项 → 套件+点名工具+基线全保留，删 ~3120 件 ≈70MB）。
1. **真修①云层快照翻倍** (02-scene + 23b-worldrestore)：病根链=世界快照 `WSN.sceneKids` 把云精灵当普通场景项收账 → `restorePristineWorld()` 先 `_wsnRestoreGraph(scene,…)` 把快照里的**旧一代云**原样带回 → 末尾 `applySceneEnvironment()` → `rebuildClouds()` 又建**新一代云**，而登记表 `_cloudSprites` 里攥着的旧代引用已被快照复原"复活"且换代后成孤儿移不掉 ⇒ **每轮回菜单云量稳态翻倍**（阴天档 20→40 个 Sprite，探针实测 56→76、extra=20 全 Sprite、gone=0）。修=云精灵打 `_isCloud` 标记（与 08-effects `_isPrecip` 同款先例）+ 快照过滤加 `||c._isCloud` —— **天气层不属于世界快照**（同降水口径），还原后由 applySceneEnvironment 按当档重建恰好一代；天体/灯只在 boot 建一次不重建，无同类风险，`_wsnRestoreGraph` 的整段 children 清零重建天然清掉旧云。判据：`verify-worldrestore` **10 组 0 失败全绿**（原"scene 台账 56→76"两条稳定红转绿；T7 幂等/T9 回菜单/T11 就地重开同步过）。
2. **真修②两栖车 Bot 永不上岸三层修复** (14-bots，红线7 ③)：逐层探针取证（--ai 诊断 + 自建逐 5s 采样: 航路点/距点/前方船/沿岸台坎测绘/车头射线剖面）。**第一层=航道口插点陷阱**：`navAmphRoute` 无条件插"航道口"点，塔拉瓦南湾口点水深仅 0.28m < 涉水 0.55 ⇒ 车要朝浅口开而中间航点每条航向都过 `navSafeYaw(minDep=0.25)` 的前向水深门被掰向深水侧，**永远进不了 26m 换点圈** ⇒ "末段=直冲滩头"分支走不到。修=口点**水深门**（`navDepth(口)≥wade` 才插；设计 §5.2 自述"礁盘平台直穿可行，不为了走航道绕远"——浅口插点本身反设计）。**第二层=浪线拔河门**：`amphAI` 旧版 `depth<wade` 即切陆战层，但陆战层的推进/战术目标是**沿岸**旗点/掩体 —— 车还在浪里就被它带着沿岸开，水深一过 wade 又被海图航路拽回，浪线上永动拔河（实测 40s 停在离岸 10m/水深 0.55，上岸=0 开火=0）。修=接管门改判**真上岸**（`navShoreD≤0`），浪线最后一段仍归海图航路，与 §3.5"上岸复用坦克陆战层"本意一致。**第三层=滩头走廊**：`navBeachPt` 旧选点只做 findClearSpot 占用清障，不验"海→点"坡度走廊 —— 滩头堡地基平台（padHeight 台坎，实测 -0.33 海床→+2.45 平面一级跳）顶在浪线时履带态被 `slopeGateMove` 拒爬台坎顶死。修=候选滩头点**走廊验证**（离岸 10m→点 7 采样无 >1.2m 台阶跳变，挡道就沿岸切向 ±6..30 重找）+ `navAmphRoute` 末段插"滩头点正前方 12m 海上过渡点"（末跳=垂直登陆，与走廊验证同线）+ 过渡点换点半径收紧 7m（沿用 26m 会在离过渡点十几米处提前切向斜穿台坎）。**实测推进：红线7 ③ 终离岸 38m→20.3m、终水深 1.87→1.13**。**仍红如实登记**：剩余病根=礁盘浪线**散布**的反登陆大件/堡基台坎（探针实测 ≥3 处独立阻挡：台坎 [24,176]/[17,169] + 浮航硬阻挡体 [-4,198]），需"接近浪线时沿岸重扫最近干净登陆走廊"的运行时重定向，且哪些豁口是设计上的预定登陆通道要用户裁定（末段去避让试过=提前撞浮航硬阻挡，已回滚并留注释）。艇的两档用例（就近湾/远湾×3）本批前后均过。
3. **探针判据跟走 8 条**（预存红账清账）：①`verify-fire` 4 红=10-05 天气批后沙箱战役（缅甸=storm 档）火伤 ×0.45/积热 ×0.35/燃烧 ×0.45 —— 火焰机制探针钉 `sf_weather='clear'` 回机制基线（蔓延段判据本就动态读 fireMul 不受影响）→ 全绿；②`verify-hudfix` T4=spawnZombie 自带 `_riseT=1.2` 起身免伤窗（10-28a 防同帧瞬杀设计），探针原地击杀须先清窗（与 verify-zombie 同款跟走）→ 37/0；③`verify-airground` R3=交战距离门 2026-10-05 起乘 `WX_CFG.rangeMul`（天气契约 R6 内联相乘钉死），写死米数的样点在阴天档（×0.9=126m）全体漂移 —— 样点改按当档公式 0.92×/1.15×eff 动态取位（hold 案相对炮位取距）→ 12/12；④`verify-phase4-7d` S4=flakShots 弹 B13 批加 `age:0`（舰体实体判定豁免窗），冻结正则跟走 → 11/11；⑤`verify-fixbatch` 15=命中柱构建 7c 批抽 vehHitCyl 单源后 `y1:t.pos.y+VEH_HIT_TOP` 字面量变赋值式，锚随码走 → 55/0；⑥`verify-animfix` 05b=棕榈叶性能批改 InstancedMesh 逐实例矩阵，下垂不变量同式迁移 `_pmE.set(p+HPI, a, 0,'YXZ')` → 39/0；⑦`verify-matseam`=02-scene 天体批 boot 期直建星空 Points（BufferGeometry+Float32BufferAttribute+Points+PointsMaterial），轻桩补四件 → 44/0；⑧`verify-nade-trigger` B3/B4 布局随机红（1~15 条，在案自 10-24）治理：净空扫描加"**走廊全程在图内+不落水**"（出图=heightAt 边缘哨兵 ⇒ 点串整段缺席）+ 选点 **6 选 1 就地全指标验收**（点串成形+落点环闭合+真投弹与预演同点+厨雷档三件）+ 厨雷档读数**就地捕获消费**（旧版断言二次重跑，预演模拟内的随机反弹散射让二次跑与验收分叉）+ B3/B4 环境不可测时显式「⚠ 跳过」不计数（预演有任何输出仍从严判）→ 连跑 6 轮全绿。
4. **判据汇总**：run-all-verify **两轮**：基线轮 10 条稳定红（hudfix T4/worldrestore×2/fire 4项/fixbatch/animfix/matseam/airground/phase4-7d/nade-trigger + naval 红线7）→ 本批后 **两轮均 61/65** exit=0（唯一稳定红=naval 红线7 上述遗留，失败集逐条同名，**零新增**）；修复面 9 探针单跑全绿（worldrestore 10 组/fire/hudfix 37/0/airground 12/12/phase4-7d 11/11/fixbatch 55/0/animfix 39/0/matseam 44/0/nade-trigger 6 连跑）。
5. **版本戳** `20261030a→20261101a`（index.html 50 处+`__sfStyleVer`+`_game_files.txt` 46 行+五探针钉随扫）。**实机关注**：①任意对局→结算/回主菜单→再开局：天上云量应恒为该天气档一代（阴天 20 朵），反复回菜单不翻倍；②塔拉瓦/珊瑚海实机看两栖车 Bot：应能推进到浪线附近并尝试登滩（较改前明显接近岸线），滩头堡附近仍可能顶住（已登记遗留）；③高炮 Bot 在雨/雪图的索敌开火距离应比晴天近（rangeMul 生效，非回归）；④火焰伤害/倒伏手感与 10-05 天气批一致（探针钉晴朗只影响沙箱）。
6. **工作区清理**（用户令）：未跟踪 3092 项清到 45 项（套件 verify-*/probe-* 全保留 + PLAN/README 点名自检工具 5 件 `_pgbase-capture/_pgdump/_pgpng/_wmpg/_wmview` + `dev/_pgfarm-baseline.json` 基线 + 3 个游戏文件 + 设计文档/参考图）。删除 ~3120 件 ≈70MB：dev PNG 渲染产物 **3002**（tracked `render-model.js`/`render-aamodel.js` 随时可再出图）/ `dev/out/` 49MB（gitignored CDP 产物）/ `dev/tmp-tests/` 17MB（bak 残骸）/ `dev/*.log` 5 / `_fullsuite-*.txt` 3 / `_cmd-audit-*.md` 3 / `_pgsnap-*.json` 2 / 一次性草稿探针 **36**（含本批 `_wr-debug/_naval-debug/_mk-naval-debug`）。引用完整性核对：被 tracked 文件引用的未跟踪文件（引用对账脚本）全部保留；git 索引内 dev 136 文件不动；文档搬迁完整性核对：finished-docs 43 份与被删 docs/archive 32 份（9 月底旧档/被后批次取代稿，git 历史可寻回）为前批次有意行为，非丢档。

## 一.84 判定自查批：玩家死亡播报爆头位透传 × 反坦克雷链爆挂游戏时钟 × 出生保护"开火即解除"补全 (2026-11-01, 待实机验收)
承用户指令"自行排查+修复一轮**判定相关**的BUG，再清理工作区的无用文件/文件夹"（继一.83 通用排查轮之后的第二轮，定向"判定"面）。全量对账结论（逐面过堂，无新增缺陷）：21-match 终局判定（终局前奏哨兵/同归零豁免/1v1 对齐倒计时/丧尸专门流/丧尸票流失）、updateFlags/updateSpots 占领判定（争夺冻结/守方快回落/瘫舰旗退出/丧尸无意占领）、fireBullet 弹道裁决链（soldier→naval→plane→tank/truck→水→墙的最近者胜次序 + 友军豁免 + 水面遮蔽 + 收窄后 endD 终点钳制）、updateShells（时停逐发帧长/友军免疫/shPad 判定半径）、nadeStep 触发引信"武装+接触"双条件、Tank/Plane.die 乘员账（v3 三人车组/观战座驾豁免）、票务写入 15 处对账无失衡、specWillBe 四门、barStealArmed 四处自然走完清账、mmEnemyVis 敌显单源、recCommit/specUsed 盖章、换局复位链（specWant 作废/战绩五项复位）——均与在案契约一致。实锤 **3 处修复**；另 1 条既有偶发对账（verify-wipe T11 首跑红"矮障碍不阻挡 位移=0.589"，复跑 3 轮全绿=种子随机偶发非回归，与种子不可复现在案 1/20 偶发同类）。
1. **修复①玩家死亡播报丢爆头位** (18-game die)：旧 `addKillfeed(attacker,this,false)` 硬编码 —— Bot die 链 (14-bots:548) 传 isHead，唯独"玩家被爆头击杀"时播报永远不出 ☠（被爆头杀与被普通杀在播报上不可辨，读作"爆头判定没生效"）。修=爆头位透传 `!!isHead`（die(attacker,isHead) 形参本就在手，行为面只有播报图标一行）。
2. **修复②反坦克雷链爆挂浏览器时钟** (15-vehicles mineBlast/MINE_CHAIN + updateMineTriggers(dt) + 24-main 传参)：邻近链爆旧用 `setTimeout(120~300ms)` —— Esc 暂停 / K 时停期间照常到点，**冻结的战场里链爆照样炸人**（与 2026-10-28a 丧尸近战 setTimeout→dt 账同族病，本库第三例）。修=链爆改挂游戏时钟账 `MINE_CHAIN`（{m,t}），`updateMineTriggers(dt)` 逐帧消费（账消费排在 `!MINES.length` 早退**之前**——MINES 里 dead 项常驻不依赖底数），24-main 传世界帧长 ⇒ 时停/布势 dt=0 整列停住、Esc 暂停/菜单/结算整段不跑（冻结分支 return 之前），非时停逐位同延时（0.12+rand×0.18s）。
3. **修复③出生保护"开火即解除"契约漏洞** (13-combat fireRocket/emplATFire/emplMortarShell + 15-vehicles Tank.fireCannon)：清账旧只挂 fireBullet（其注释宣称"玩家/Bot/炮位共用的**唯一出膛口**"），但火箭筒/坦克主炮/反坦克炮/迫击炮四条路**不走 fireBullet** ⇒ 部署落地 2s 保护期内照样开火——载具出生直接进车开主炮、落地掏火箭筒即打，都是"免疫输出"窗口（注释宣称≠实现病型）。修=四处同契约补 `if(shooter&&shooter.protUntil) shooter.protUntil=0`（fireBullet 原清账不动；炮位冷却"在炮上换人不重置"口径不受影响）。
4. **判据**：新 `dev/verify-judgment-20261101.js` **18/0**（T1 爆头致死播报 ☠ + 普通致死 ✕ 不带 ☠ + 击杀数入账；T2 链爆账 dt=0 冻结不消费/dt>0 消费完/3m 圈入账 20m 外不连/旧 setTimeout 链串在 15-vehicles 绝迹；T3 四条直接出膛口开火即清保护 + 弹体入膛 + fireBullet 原账在位〔13-combat 清账 ≥4 处、15-vehicles ≥1 处〕）——已注册 run-all-verify。域邻探针单跑：verify-killattr 18/0 · verify-phase3-20260928 65/0 · verify-timestopfix 35/0 · verify-wipe 91/0（首跑 T11 偶发见上）· verify-batch-20261030 50/0。全量 run-all-verify **两轮均 64/69** exit=0（新判据探针 +1 入册后运行数 65→69；两轮唯一稳定红=naval 红线7〔一.83 遗留，红线7③"上岸并开火"仍不满足〕，失败集逐条同名**零新增**；两轮各有一个互不相同的偶发单败——首轮 verify-zombie / 次轮 verify-matseam，稳定性复核均 3/3 全绿=环境抖动非回归）。
5. **版本戳** `20261101a→20261101b`（index.html 50 处 + `__sfStyleVer` + `_game_files.txt` 46 行 + 五探针钉随扫，旧值全库绝迹）。**实机关注**：①被 Bot 爆头击杀时右上角播报应出现 ☠（此前永远 ✕）；②草原雷区打爆一颗雷后立刻 Esc 暂停或 K 时停——邻近雷**不应**继续连环爆（旧版会冻结中照炸）；③部署落地 2 秒保护期内开火箭筒/坦克主炮/AT 炮/迫击炮后立即挨打应正常掉血（旧版这几条路上开火不破免伤）；④其余全无手感变化（修复①只动一个图标、②只动暂停期的雷、③只动 2s 窗口内）。
6. **工作区清理（增量轮）**：一.83 大清后本轮全量对账——js/ 46 文件与 index.html 实载清单逐名一致（零死文件）；未跟踪 46 项=套件 + 点名工具 5 件 + 基线 + 3 游戏文件 + 设计文档/参考图全保留（`verify-judgment-20261101.js` 新增入册）；本轮新增删除=`dev/out/` 4 件本日探针 CDP 产物（gitignored，套件运行即重写）+ 空目录 `.zcode/tmp_crops/`；根目录 `诊断-UI显示.html` 经引用核对=README §8 在册的**用户侧一键诊断工具**（PLAN 验收清单"两步定位法"引用，非残留），`对讲机参考.jpg`/《指挥官模式设计》按一.83 口径保留。

## 一.85 贴图/模型自查批:uvGeo 直构漏网收编 × 航母甲板贴片分层 × 三路审计对码再修十二组 × 工作区清理 (2026-11-01, 待实机验收)
承用户指令"自行排查+修复一轮**贴图/模型相关**的BUG,再清理工作区的无用文件/文件夹"(继一.83 通用轮/一.84 判定轮之后第三轮,定向贴图/模型面)。取证=沙箱探针红账 + 离屏渲染目检(19 张,零新增缺陷) + **三路并行代码审计**(载具建模/建筑贴图/海战建模,共 25 条发现逐条对码核验——"审计词条不当圣旨",驳回留档见交付文档)。实锤 **17 组**(自查四 + 三路审计十三):
1. **修复①贴图密度归一漏网 26 处**(05a-buildings + 05-world uvGeo 失败路径 + _structbase 桩):verify-uvscale 17/23 三红病根=uvGeo 归一只在帮手发生,05a 直接 `new Mesh(boxGeo)` 的 20 盒+9 圆柱+龙牙圆锥全裸奔(面 UV 恒 0..1,风车斜梁 vs 辐条密度差数十倍)。修=全部包 uvGeo;圆柱失败路径旧把"缺 position 的盒形克隆"**缓存顶替原几何**(桩 clone 翻 type 污染探针)→改直接返回原几何;桩 NonBoxGeo.clone 补类型保持。→ **23/23**。
2. **修复②航母甲板贴片共面**(15g-capmodels):verify-surf coral/ironbottom 各 86 条"同单位残留"全为大舰甲板涂装/槽/索/框压甲板顶面(boot 消解器跑在舰体生成**之前**,此类无人管)。修=划线/槽/框落 **decal 档**(renderOrder 2);拦阻索=实体索不吃档、索心抬 d+0.055;弹射槽/升降机框抬 0.015/0.045 真分层。→ **22/22 全图 0 残留**。教训:decal 档只解"贴片 vs 结构",贴片 vs 贴片要真 3D 分层。
3. **审计⑥tbBox UV 塌缩**(15-vehicles):手写盒几何对全六面统一传 (y旗,x旗)——±X 面 v 恒定/±Y 面 u 恒定=UV 塌成一条线;唯一调用点裙板 M.tone 带 grime 贴图 ⇒ 全阵营坦克侧裙拉丝条纹。修=按**面内两轴**取 UV(±X:u=z旗 v=y旗/±Y:u=x旗 v=z旗/±Z 不变)。
4. **审计⑦uvGeo 圆柱缓存键缺形状参数**(05-world):键只含 r/h/θ ⇒ 同尺寸不同 radialSegments/heightSegments/openEnded/thetaStart 的圆柱**共享克隆=第二根被第一根几何顶替**(几何替换级)。键补四参数。
5. **审计⑧⑨Canvas 兜底贴图两病**(02-scene):stone 列距 60 不整除 256=每贴右缘 2px 背景缝切花岗岩(修=列距 64 整周期+过缝对侧补**同色**副本,与 brick 同规);sandbag 行 22/列 44 不整除 128 + `rgb(randi,randi,randi)` 三通道各抖各的(修=与 SVG 版同规行 32×4/列 42.7×3 + shade() 只抖明度)。
6. **审计⑩螺旋桨悬空**(16-aircraft):桨盘 z=0.50·FL+0.08s 悬在机鼻前 8cm(星型机头无桨毂锥最明显)。修=前移至 0.50·FL−0.02s 埋进桨毂锥/整流罩(`this.prop` 引用与自转链零改动)。
7. **审计⑪观战名牌随残骸克隆**(16-aircraft Plane.die):`_specTag` 挂 grp 下,`grp.clone()` 带进残骸=depthTest:false+renderOrder 7 **隔墙冻结帧常显**(与 09-28 信标同族病——信标/夜航灯当年摘了,名牌是 10-24f 后的件漏摘)。修=clone 前摘除后挂回(全库 `grp.clone()` 仅此一处)。`_specLine` 挂 scene 无此病。
8. **审计⑫两栖车双舵"绕艉中线公转"满舵扫进桨盘**(15e+15d,审计 P2):双舵总成挂在艉中线、15d 转**整组** ⇒ 满舵 0.5rad 一舷前掠 ≈0.24m 扫进桨盘——与 09-25 桨枢轴同族病(桨修了舵漏修)。修=每片舵挂 `nmRudderPivot` 子枢轴(照抄 nmPropPivot),15d 逐子枢轴施加同一偏转角(驱动入口仍 nodes.rudder 一个;艇单舵无 pivot 回退整组转)。
9. **审计⑬⑭userData 红线两处**(15e/15d):nmLocal 存 V3 对象引用→纯数值三元组;残骸材质账 `mat0`(Material→map→canvas)只在还原不删→**还原即 delete**(死后再沉重捕获,零行为)。
10. **审计⑮⑯大舰两处零体积贴合**(15g):舰桥翼台内面与塔身侧面严格共面(非 pagoda 档)→中心内移 0.06 真嵌入;主桅底与塔顶纯面贴合→圆柱加长 0.12 下探(顶位/横桁/雷达关系不动)。
11. **审计⑰+驳回留档**:契约键注记两处(15e sight 仅艇+降级链在 / 15g funnels·masts·props 备用无填充);**驳回**:05a ~14 处直构=审计跑在①之前已包零残余;Torus 无 uvGeo 分支=口径如此;makeTex repeat×uvRef"双乘"=同一观感两半校准不盲改;truckTarpMat 单例=无写点即 MAT 纪律;同轴机枪/幽灵炮塔/翼挂架"缝隙"三条=逐点复算均嵌入非缝隙;测距仪命中盒上沿差 1.35m=10-04 命中胶囊刚收紧过,反向放宽属平衡域留实机;艇"桨叶↔舵 0.50m"注释 vs 复算 ~0.23~0.245=自检判据绿以其量法为准。
12. **探针对齐四条**:svgtex 桩补 BufferGeometry/Float32BufferAttribute/Points/PointsMaterial 四件(10-05 星空批打崩五周,不在册无人知)+**收编 run-all**;uvscale A 段 cloth 判据与契约对齐(挂 05a 就地材质逐值校验);surf per-map 补**追赶消解**(舰体 boot 后进 world、沙箱无帧循环,174 对伪红→0;耗时上界 2000→4000ms);matseam CV_SEL.stone 56→60 跟码(石砌块随⑧变宽)。
13. **判据汇总**:域内复跑全绿=uvscale 23/23 · svgtex 40 生成器 · surf 22/22 · matseam 44/0×3 · phase2 · tread 279/0 · vehmodels 10/0 · _naval-model-selfcheck 87 · _amph-parts · _wreck-selfcheck · phase5-capital 41 · surfmodel 11/0 · animfix-20260926 39/0。run-all-verify **两轮 64/68、65/71 均 exit=0**——唯一稳定红=naval 红线7(一.83 遗留,3/3 稳定复核,与本批零改动面);次轮一个 verify-zombie 单败=module load 环境崩(复核 0/0/1,单跑 47/0),失败集逐条同名**零新增**;在册 66=基线 64+收编 2。
14. **版本戳** `20261101b→20261101c`(index.html 50 处+`__sfStyleVer`+`_game_files.txt` 46 行+五探针钉 19 处随扫=115 处,旧值全库绝迹;五枚钉探针复跑全绿)。**工作区清理**:删 56 件(一次性探针 14+闭案诊断 11+孤儿数据 3+渲染产物 23+本批一次性工具 5;tracked 18+untracked 15+产物 23),备份 tar 在系统 TEMP;dev/ 由 198→**151** 件;保留判定见交付文档 §七。
15. **实机关注**:①带风车/水塔的图:构件贴图与同图构件同尺度(不再"一根杆上的纹突然变粗变细");②珊瑚海/铁底湾 200m 外看航母飞行甲板:划线/拦阻索稳定不闪,近看索悬在甲板上方几厘米;③坦克侧裙(四号/黑豹):磨损贴图正常颗粒,不再拉丝条纹;④侧视飞机:桨根装在机鼻上无悬空缝(零式等星型机头最明显);⑤观战信息层下击落敌机:残骸上无冻结名牌;⑥近看石墙:无每 1.5m 一道竖向细缝;沙袋工事无杂色袋;⑦两栖车满舵回转:尾舵各自绕舵杆偏转,舵叶不插进螺旋桨;大舰舰桥翼台/主桅根部无共面闪烁;⑧其余零行为改动。

## 一.86 性能优化批:热循环零分配第二轮 × 灯链/Bot/载具/寻路/座位 HUD 全链 (2026-11-01, 待实机验收)
承用户指令"自行排查+修复一轮**性能优化**相关的BUG/严重问题,注意一下光照渲染方面,其他方面也要注重"(继一.83~一.85 后同日第四轮,定向性能面,继一.66 后的零分配第二轮)。取证=逐文件热路径通读(灯链/Bot 感知与移动/载具物理/弹道裁决/寻路/座位与 HUD DOM 写点)+ 三项硬检查(①光照契约:灯池全部常驻 visible 开关、无运行期增删灯——灯数抖动⇒three r152 材质 getProgram 重选的病根在案;②热循环零分配军规;③每处复用槽的重入与生命周期逐点核对:每槽单一消费者/同步消费不跨调用持有)。全部改动=**行为逐位等价重构**(平方预门带 1.000001 余量,过门者仍走原 hypot;整数格启发式 hypot→sqrt 逐位同值;10Hz 节流两处沿用 updatePlayerTank._pipT/_rngT 在案口径),零手感改动:
1. **光照渲染链(08-effects)**:①`_hlWorld` 车灯锚缓存——夜图灯光链每帧每车 tkSpec(3 对象)改 `veh._hlA` 首算缓存(tkSpec/dims 字段同源);②playerFlashlightTick `camForward()`→`_pfF/_pfR` 复用槽;③updateFireLights 0.2s 扫描 `new Set`+每次闭包数组→模块 `_fireFresh` 复用+`_fireTaken` 线性查重(≤4 个取用槽)。灯池滞回(大灯 60/75m·火源 85/110m+0.2s 扫描)/flashLight 常驻/阴影半频 shadowRefreshTick 在案契约零触碰。
2. **Bot 层(14-bots)**:ikRes 由 toFixed 串舍入改 `Math.round(×10000)/10000`(数值逐位等价,verify-a21-j 只读显示);moveDir/flee 的 7 方向避障闭包提升为 `_botMoveProbe`+`MOVE_DA/FLEE_DA` 常量表(每帧每 Bot 每方向 1 闭包→0);perceive 外提 envLum/darkRatio+距离平方预门;batteryTargetFor(电池炮 Bot 索敌)0.3s 结果缓存(失效判据原样:alive/sinking/wreck/team)。
3. **载具层(15-vehicles/15b/15d/15h)**:tankSurfH 静态查询 `_tsQ`+盒/圆柱两回调模块化;updateShells/15d/15h 弹方向 `copy().normalize()` 复用槽;vehHitCyl/truckHitCyl 查询槽(_shCyl/_shTrkCyl);vehiclePushSoldiers 参数对象 `_vpsOpts` 单源(坦克/卡车/两栖三写点,逐字段每调用前重写);navalHitCyl 加可选 out 参(**默认路径仍分配**——15f 返回并持有结果,只改 15d 推挤链即时消费点);capPush 角点阵提升 `_capCC/_capCS/_capCA/_capCB`;capPushBody IIFE 的 sup 查找去内层函数。
4. **弹道/碰撞/火(13-combat/04-collision/04b-fire)**:fireBullet 圆柱槽+_fbPan(平移比每弹一 V3→0);loiterForward 复用槽(2 调用点串行已核);nadeStep 盒候选回调 `_ndBoxCtx` 上下文对象;raycastWorld 地面命中法线常量 `_rcGnd`(消费点即时读);buildSpatialIndex boxCells/cylCells 原地复用(length=0 替代整表重建);collideMove/standHeight 回调模块化;treeIgnitePass `_tiSeen` Set 复用+floraNear 回调提升。
5. **寻路(07-nav)**:findPath 10 个闭包(_hSwap/_hUp/_hDown/push/pop/expand/settle/isSettled 等)提升至 IIFE 作用域(每次寻路 10 闭包→0,`_fpHLen/_fpPopDir` 游标随代重置);路径回溯去 toW 解构(每路标一数组→0);expand 启发式整数格 sqrt。verify-nav 8/0。
6. **座位/HUD 层(16-aircraft/20a-seats/20-player/22-hud/21-match)**:①Plane.velVec/fwdDir 加可选 out 参(缺省仍新 V3,全库调用点兼容);②updatePlayerPlane 投影闭包提升模块 `_seatPrj/_seatPut`(+_seatPrjV 槽),扫射弹着点(74 次 heightAt/帧)与航弹 CCIP(60 步积分/帧)改 **10Hz 节流+世界命中点缓存逐帧重投影**(屏幕位置随相机连续,世界参考点最多滞后 0.1s——`updatePlayerPlane._pipT/_spH/_ccH`,updatePlayerTank._rngT 同款口径);airPip rel2 标量化+data-d 去重写;③updatePlayerAA 提前量圈标量化(每机一 V3→0)+lead 复用槽;④迫击炮 vo/海战 cdF·co·aimDir·dv/AT·岸防·MG 的 camForward() 换复用槽(每槽单一消费函数);⑤**heatFill 全座位写点 `_lw/_lb` 去重写**(坦克/飞机/迫击炮/AT/岸防/AA/MG/海战八写点同键=跨座位缓存一致;hudText/hudStyle Map 缓存因双写点不可用,元素挂键与 D6 纪律同源);⑥navalSeatHud 面板全字段元素挂 `_t/_lc` 去重写+display 按 DOM 实际值幂等写(hudHideReal 同款);⑦updateNadeArc 预演零分配(`_naSt` 状态槽+`_naPool` 点串池化裸 {x,y,z,bounce} 记录——st.pos.distanceTo 只读 x/y/z 不要求 V3 实例;首触地/爆点模块记录+置位旗;playerThrowOrigin/Dir 加可选 out);⑧updateHUD 部署页元素缓存(`_depEl`)+updateDirHits transform 按 `_lRot` 去重写+children 索引化。
7. **放弃/暂缓留档**(逐条评估后不进本批):updateRagdolls 坡度早退(需"地形坡度有界"未证假设,动判断面);raycastWorld 地面步进格上限(桥面/地形 Lipschitz 无界,无法证明等价);drawMinimap 离屏底图重写(工程量大);updateCamera 飞机追尾分支 4 alloc(视角函数最高危,留下一批);planeAI 前瞻节流/capitalCapsule 缓存/坦克碰撞环闭包提升(可变捕获状态,槽别名风险)。
8. **判据**:全 edited 15 文件 node --check 绿;域内探针=perf 34/34 · fire 全绿 · nav-20260926 8/0×4(首轮 7/1=种子偶发,与在案 1/20 布局随机同类) · hudfix 37/0 · animfix-20261012 66/0 · boot 绿 · nade-trigger **88/0(F1o/F1p/F1s 三条源码钉判据跟走:签名加 out 参/预演 st 换复用槽——钉随码走)** · aimassist 40/0(首轮 39/1 同为种子偶发) · killattr 18/0 · zombie 47/0 · airground 12/0 · sink 全绿;**phase5-capital 首跑 S3 红=`bot moveDir 水障放行` 源码钉仍钉旧内联字面量 `this.swim||this.onCapDeck`——避障探针提升 `_botMoveProbe(b,a)` 后字面量成 `b.swim||b.onCapDeck`(14-bots:57, 门本身单点未动),判据跟走修钉后 41/41**。run-all-verify 两轮:首轮 **63/71** exit=0(失败=naval 稳定红 + phase5 S3 钉,后者连跑 1/1/1 被套件判"稳定失败"实为判据漂移非回归——修钉单跑 41/41 后次轮套件内亦 0/绿)、次轮 **64/68** exit=0(**唯一失败=verify-naval 稳定红 1/1/1=一.83 遗留 naval 红线7,与预存红账逐条同名,零新增**)。
9. **版本戳**:本批零升戳——一.85 已升 `20261101c` 且未实机验收,本批 JS 改动随同戳首载(实机首次加载 20261101c 即含本批)。
10. **实机关注**:①夜图(ironbottom/nightsea)开手电/车灯/近火源的帧率与灯光稳定(灯数不抖=无材质重选顿挫);②飞机座舱 HUD:扫射/CCIP 落点 pip 世界点 10Hz 刷新(高速俯冲时参考点轻微滞后属预期),炮线准星与锁定框仍逐帧;③持雷预瞄:点串/落点圈/圈内人数与改前一致;④各座位装填条与海战面板读数正常,跨座位切换无残留错值;⑤Bot 移动/感知/丧尸行为不变;⑥其余零行为改动。

承用户两报：①「很多动作仍然有左臂太靠右，看起来左臂是长在右肩上」（举例=补给箱取弹药、火箭筒换弹）；
②「打绷带等读条动作进行的时候，会被取弹药等其他行动强行打断，但不要出现模型滞留；同时可以点击 X 取消」。
1. **左臂朝向（10-viewmodel）**：病根=臂组枢轴在手腕、袖管沿手局部 +z 后延 0.25m，而各动作分支的 `handLOverride`
   字面量是「腕位 + rotY=0」手调的（包扎更是 **+1.2** 反角），叠加根姿态 `HIP.pos.x=0.17` 把整个 inner 推到画面右侧
   ⇒ 袖管（肩端）落在掌心**右侧**，读作「左臂长在右肩上」。2026-10-05 只在默认握位修过（rotY=-1.0），动作覆盖位姿漏改。
   修法=新单源 `VM_LARM_Y=-0.95` + `vmHandLSnap(pose)`（掌心保点 = `vmPalmOf` 反解腕位 `vmWristFor`；已在带内则恒等返回）
   + 其字面量入口 `vmHandLFix(pos,rot)`：**掌心逐位不变**（手不从道具上滑走，父坐标系偏差 ≤1e-16m）、只把袖管转到画面左下。
   ①**七处字面量位姿**全部改走 `vmHandLFix`：grab / 火箭筒换弹 / 旧版换匣×2 / 建锤 / 举雷 / 包扎（实测肩端 x：grab +0.130→−0.150、
   火箭筒 +0.114→−0.166、包扎 +0.279→−0.312）；
   ②**第七处**（排查中发现的漏网）=下置弹匣的**物理**换匣（BAR / 百式，`vmHoldPose` 的 `side=1` 左手持匣路径）：它的 rotY 由
   「枪系抓握角 × 收束插值」解算而来（中途段实测 −0.09~−0.24）⇒ 袖管落在画面**右**半（肩端 x=+0.13~+0.17），同款症状；
   现在左手持匣也过 `vmHandLSnap`（端点=默认握位 −1.0，在带内 ⇒ 恒等，端点帧零漂移），逐相位肩端 x 全为负。
2. **读条互斥（18-game / 20-player / 06-engineering 同规）**：`readBarActive()` / `readBarBusy()` / `cancelReadBar(msg,quiet)`
   三件单源收口「包扎 bandaging / 拆除回收 demolish / 固定火力点前摇 useCast」三条读条：账目层清零+炮位占位交还，
   模型层交 `vmAbortAction()`（绷带卷+左臂缠臂环+持刀左臂，幂等）。包扎 tick 改为与拆除读条同规的派生判据
   （身体被上炮/上车/上艇/进炮位/驾巡飞弹/取弹占用，或 VM 动作态被抢走 ⇒ 按「被打断」收账，**不再一路 tick 到满照样回血**）；
   前摇启动时反向收掉包扎；受击打断、死亡、再部署、换局复位全部改走同一出口。
3. **读条取消（4 条路同一出口）**：① 屏下方读条条（22-hud `_demolishBar` 由「拆除专用」扩成通用读条）新增可点 **✕**
   (`#castCancelBtn`，pointer-events:auto + stopPropagation，触屏/未锁指针可用)；② **X 键**（指针锁定时 DOM 点不到，键盘侧唯一总能按到的取消键）；
   ③ **左键**（读条中左键=取消，且**吞掉这次点击**——取消后 VM 立刻回 idle，不吞就会顺势走火）；④ 原键再按（H 取消包扎 / 6 取消回收 / F 取消前摇 / B 取消拆除）。
   读条时长收 `BANDAGE_T=2.6` 单源（00-config），新增 9 条 i18n 词条。
4. **判据**：新 `dev/verify-animfix-20261012.js` **63/0**（含 `--neg` 阴性对照：把 `vmHandLSnap` 与互斥闸按文本还原 ⇒ 42/21 报红，
   证明判据真的在测这两处；BAR/百式那组另带**页内**阴性对照「关掉归位」⇒ 肩端 x 由 −0.13 回到 +0.13）+ 新真浏览器探针
   `dev/probe-animfix-20261012.js` **19/19**（真渲染器左臂两端坐标 + 布局事实 + 真 `Input.dispatchMouseEvent` 点 ✕ / 真 keydown X /
   真主循环 rAF 下被抢走不留模型），两条均已注册 `dev/run-all-verify.js`。
   版本戳 `20261010a → 20261012a`（css `20261010b → 20261012b`，48 处）。**基线说明**：本批前的既有失败（zombie/spec/specbatch/naval/
   worldrestore/fire/matseam/hudfix T4·T6/nade-trigger/airground/phase4-7d/fixbatch VEH_HIT_TOP/animfix-20260926 05b 棕榈叶）与本批无关，
   详见 README §8 2026-10-12 行；本批改动面相关探针 `verify-text`/`verify-phase3-20260928`(65/0 读条回收批)/`verify-fixes-20261010*`/
   `verify-hudfb-20260928` 全绿。
5. **实机关注点**：①六个动作的左臂是否都在画面左下（袖管出画或贴左缘）、手是否仍站在原来的道具位置上；②包扎/拆除/前摇读条时，
   点 ✕、按 X、点左键、再按原键四种取消是否都干净（绷带卷与白环立刻消失、不再回血）；③读条中按 F 取弹药/上炮/上艇是否强行打断
   且不留模型；④指针锁定期间 ✕ 点不到属预期，用 X 或左键。

## 一.87 观战子系统五项批 × 真附身呈现层 × 实机修复轮 (2026-11-01~02, 待实机验收)
承用户三项需求（①大灯两盏两道光+照明范围 ②观战终局横幅中性化 ③0 票可进观战+新「自由观战」模式）与两轮实机反馈
（「附身全方位像两个人叠在一起」→ 全面重做呈现层；Ctrl+F5 复测七张截图再修）。用户裁定：附身交互=两套都要
（视模式左键附身+Q/E 轮换+右键脱离；调试模式 Q/E 附身脱离）；观战终局横幅=中性文案；结算口径=按原阵营显示并计入
历史（调试模式因能干涉战局才不计入）；**附身=只读借眼**——宿主击杀不进玩家记分链。
1. **大灯真灯池双灯 (00-config/08-effects)**：旧池按台竞选（每台 1 盏 SpotLight）=「两盏大灯一道光」；改 `headRealN:2`
   台×**左右灯口各 1 盏**（池容量 `headRealN*2`，竞选位逐灯轮换）＋用户实报照明范围小 `headRange` 36→52、假光锥
   `headConeL` 26→40 同比放大。同屏真光源总数红线 ≤3 不变。
2. **观战终局横幅中性化 (21-match)**：观战者不属于任何一方——「胜利在望/败局在即」改中性「胜方 X」（普通存活玩家原样保留）。
3. **自由观战模式 (20-player/18-game/21-match/22-hud/23-deploy/24-main)**：票尽/死亡可进 MC 式旁观者——自由飞行
   （WASD+滚轮调速+Space/Shift 升降，零碰撞零地形吸附）、左键准星射线附身 Bot（±5.7° 视锥内最近者，隔墙/登载具者不可）、
   Q/E 距离序环绕轮换、右键原地脱离（相机位化作自由观战）；`specViewWillBe` 观战部署不耗票不清场（承一.82 specWillBe 门，
   补 `!specView` 排除）；👁 状态徽标条；结算按原阵营显示并计入历史（recCommit 判据 !REC.counted 不变——自由观战非调试）。
4. **调试模式 Q/E 附身 (20-player/19-input/15c-specveh)**：旧观战更名「调试模式」；Q 附身准星 Bot / E 脱离（观察位存还原），
   本体冻结门（updatePlayer 对 specViewHost 早退）+ avatar 恒隐；F 召唤幽灵坦克朝向玩家视向（yaw+π 角系口径）。
5. **真附身呈现层 (20-player/22-hud/23-deploy/19-input/00b-i18n)**：①**HUD 换宿主心**——血条/体力（Bot 无体力账⇒恒满）/
   低血晕影/绷带行读 `_hv/_hhp`，弹药面板经 `player.curW` 镜像钉到宿主主武器（`_svCurW` 账四处还原）；②**反馈链不记分**——
   宿主出膛=vmFireKick+微震镜（13-combat 调试附身门）、宿主命中三档白档（士兵/对空/装甲）、宿主受击=红闪+震镜+来向弧
   （14-bots damage，die 判定前）、宿主击杀=红档+0.25s 节流音（`onHostKill` 单源，14-bots/25-zombies 两门，**不进
   onPlayerKill**）；③**VM 动作镜像**——视角武器换宿主枪（vmEquip）、宿主换弹⇒VM 换弹动画/时长=宿主剩余（走玩家既有管线，
   R 键已吞不会打架）；④**只读借眼**——附身中战斗/交互键一律吞（U/J/K 例外放行，keyup 不经过不留死账）；⑤战斗 HUD 全量
   保留，只收本体动作类面板（雷弧/交互/镜筒/枪械热量）；顶栏观战词条附身中隐藏（「左键可开火」与只读矛盾）。
6. **实机修复轮 2026-11-02（用户七张截图实证）**：★**病根=buildSoldierMesh 返回包装对象（root/headG/gunG…），上一轮五处
   全写 `h.mesh.visible`=普通对象闲散属性，three.js 不读 ⇒ 宿主第三人称整套模型从未被藏掉**——两个身体/宿主 3P 枪怼脸
   成巨物/相机钻进头盔黑屏（582/583/584/585/587 全为此病）。修=五处写点全改 `.root.visible`（调试逐帧按视角收纳·视模式
   恒收·svHostModelRestore 单源·再部署·换局）+ **还原守卫**（阵亡不还原=布娃娃接管、登车登艇不还原=车内自管，14-bots
   上车惯例 root.visible=false）；**姿态旗镜像** prone/crouch 随宿主（updateCamera 步行分支在 specViewTick 之后仍把
   eyeH 往玩家自身姿态阻尼——旗不镜像则卧姿宿主眼高漂 0.2~0.5m；dbgSpecPossess 存/deployPlayer·换局·脱离四路还原）；
   👁 指示条固定 top:84px 压罗盘条（顶栏高度随战况横幅浮动）→ 显示时按罗盘 `getBoundingClientRect().bottom` 实测重定位
   到其下 10px；脱离键两模式分文案（视模式=右键/调试=E）+ i18n 词条同步。小队面板（#squadHUD top:214）与顶部无重叠
   （小地图底 212px，设计间隙 2px——用户问询核实为指示条压罗盘的同一观感）。
7. **判据**：新 `dev/verify-specview-20261101.js` **44/0**（源码锚 30+行为 14：假宿主矩阵=钉脚底/yaw+π/姿态旗/eyeH/FP 收纳
   .root/U 第三人称还原/E 脱离全账还原/二次 Q 不覆盖观察位账/死亡·登车自动脱离+守卫不还尸/视模式眼位+恒收/换弹镜像/
   HUD 显隐矩阵/svHostFireFx；阴性 13 补丁=22 红，含「.root 退回 h.mesh.visible」病根复现钉）入册 run-all。
   **run-all 两轮 66/72、65/69 exit=0**（唯一稳定红=naval 红线7 一.83 遗留 1/1/1；r1 一个 matseam 偶发 1/0/0=在案环境抖动型，
   失败集逐条同名**零新增**）。**判据跟走三件**：①specbatch T10 观战文案清单随更名批走「调试模式」新串（旧「观战模式」
   系词条本批前已被更名替换，T10 未跟=2 红）；②版本戳钉清单补全——commander-20261026（7 处）与 cmdbatch2-20261027
   （2 处）也钉戳字面量，随 20261101d 一起升；③★**行尾还原事件**：本仓库行尾混用实况（纯 LF：00b-i18n/08-effects/
   13-combat/15c/18-game/19-input/21-match/24-main/25-zombies/css/index.html/_game_files；纯 CRLF：00-config/14-bots/
   20-player/22-hud/23-deploy；混合：run-all-verify）——Edit 工具在 win32 会把**整文件**规一化为 CRLF，纯 LF 文件被编辑后
   探针多行 `\n` 锚全崩（nadecancel/commander/phase3/animfix/specbatch 首轮 6 探针稳定红，逐根因=行尾非代码），node
   整文件 `\r\n→\n` 还原后全绿。教训：**锚失配先查字节行尾**（`git show HEAD:file | node 查 \r\n 计数`；`cat -A` 经 sed
   管道会被削 `\r` 误导——在案"sed 削 CRLF 坑"的又一变体）。
8. **版本戳** `20261101c→20261101d`（index.html 50 处+`__sfStyleVer`+`_game_files.txt` 46 行+三探针钉随扫，旧值全库绝迹）。
9. **实机关注**：①附身第一人称：屏上**只有一具身体**（视角武器=宿主枪），无头盔/枪体怼脸巨物、无黑屏；②血条/弹药/绷带/
   低血晕影随宿主走，宿主开枪有后坐+枪口焰+震镜、命中出白档、击杀出红档+音（右上得分**不**增加）；③U 切第三人称=追尾宿主
   单具身体；④宿主阵亡/登车自动脱离且不还尸体模型；⑤👁 徽标条在罗盘条下方不重叠；⑥夜图每台开灯载具左右各一道光锥、
   照明范围明显变远；⑦观战局终局横幅「胜方 X」中性；⑧调试模式 Q/E 附身脱离、幽灵坦克面向玩家。

## 一.112 竹子机制批 × 柏林地铁站整体删除 × 国会一楼地板 × 莫斯科建筑固化 × 天气×地图雾叠加 × 撞机 CCD (2026-11-15, 待实机验收)
**竹子**：05b bambooClump 升级为树同款记录 (kind:'bamboo', burnT/fall/charred/dead 全链字段)+WLOW_IM 同款 BAMBOO_IM/BAMBOO_BATCH 实例批 (instColorInit 白初始化)+flushBamboos 并入 buildWorld；04b 九处接线 (bambooInstanceMatrices 倒伏/焦黑染黑/沉入同沉/全沉零缩放 dead=true/火格跳烧/引燃回调/explosionFlora 近倒远累计/floraCrushTank 倒向行进向)+fuelAdd+CYLS foliage；05c 淞沪 layoutDelta **尾部** ⑨ 江南竹丛带 (主河两岸+支汊+村环+丝厂——排序在最后 ⇒ 柳树金序列 will=75 逐位不动)+胡康竹丛 146 丛沿用新链；23b 快照 BAMBOO_IM。判据：新 dev/verify-bamboo-20261115.js (**23/0**+NEG 摘碾压亲见转红+柳 75/胡康树 680 金序列守卫)。
**柏林地铁站整体删除** (用户令「彻底删除，并在文档内也完成移除」)：00-config metro 对象删+两处让位街块复位统一网格；03-terrain METRO/metroDep/metroFlatRect/metroFlatY/metroLiftNodes/metroLiftY/metroClear 全删+heightAt/padHeight/hgridClear×2/cityUrban 四触点摘除；05a metroPavilion+地铁网整节 (solidStair/metroHall/metroTunnel/metroStation ~270 行) 删；05-world metroBlocked+freeSpot METRO_RECTS 块+两调用点删；05c metroStation() 调用删+注释更新；22a menuart 地铁画块删。探针：五处 terrain 副本 (fire/buildings/layouts/rooffall/_structbase) metro 函数族+ctx 注入+柏林地铁断言全摘 (rooffall 桩补 AudioSys.panOf——20261115c 音效批预存红对认)，verify-mapshrink 5d 摘，verify-mapfix diagBerlin+旧 NEG1/NEG2 摘 (NEG3/NEG4 编号留空)，run-all 描述跟改；专档台账删除，README/纲领/批档 metro 活段摘除 (历史行注记保留)。
**国会大厦一楼地板** (用户实机「一楼是草地还能长树」)：室内整片 MAT.woodDark 木地板 33.6×23.6 (厚 0.31，顶面=楼面+0.09——用户追令「稍微高出地面一些」；<gh+0.5 ⇒ OCC 自动豁免不挡寻路)+补 B_FOOT 足迹登记 (旧版漏登=植被长进室内根因)。
**莫斯科建筑固化** (用户裁定「全部建筑变不可破坏，与柏林区分同质化」)：config moscow **solidStructs:true** 单源，05-world damageStructureBy/roofDamage 双口早退——爆炸/撞塌/油桶/坍塌链/塌顶全部零作用 (与柏林国会 indestr 同语义；不改建筑形制)。
**天气×地图雾叠加** (雾林守线 1944 用户报「天气与地图迷雾冲突」)：根因=Bot 索敌 viewD 与坦克目视 vis 是独立常数不吃地图主题雾 (14-bots 旧注释自证「索敌与雾距不硬联动」)→两处乘 THEME.fogMul 纳入单链 (woods 0.42 ⇒ 雾林 Bot 索敌 95→40m 档)，天气 WX_CFG.viewDMul 在其后继续**叠加**；场景雾 dryFogFar 本就 fogFarMul×fogMul 相乘不动；clear 图 ×1 逐位不变。
**撞机 CCD** (用户令「用算法优化飞机相撞」)：updatePlaneCollisions 离散距离判改**匀速直线扫掠** (最近接近点 t*=(rel·d0)/|rel|² 截 [0,dt] 判 rr 内——240m/s 对头每帧掠过超窗不再漏判)+广相门 (帧内可达距离=rr+(|va|+|vb|)·dt 免算 fwdDir)；单元测试：18m/帧对头 (离散漏判档) CCD 必抓、并行同速对收拢门照旧豁免。
**升戳 20261115c→d** (index.html 49 处+_game_files.txt 45 处+verify-hudfix/verify-perf 戳钉)。**判据面**：bamboo 23/0+NEG·mapfix 13/0·mapshrink 55/0·fire/buildings/layouts/rooffall 全绿 (buildings 草原 windmill 1 红=预存在案)。实机关注：①淞沪河岸竹丛燃烧/炸倒/碾压；②柏林无地铁痕迹+街块复位；③国会一楼木地板微高出+室内无草树；④莫斯科炮轰建筑不倒；⑤雾林雨天能见度进一步压低+Bot 同步变近视；⑥飞机对头相撞判定。

## 一.113 八项实机反馈批 × 树篱三链路返修 × Bot 坦克修理同步 (2026-11-16, 待实机验收)

**用户令 (八项)**: ①坦克在补给箱一定范围内按 R 修理回血 (8s 读条回 25%，移动/开火/下车打断，单次受伤>26% 也打断)；②白色水泥锥只有竖直状态不贴坡——修复；②.5 白色水泥锥没挡坦克——补上 (Bot 寻路字段同查)；③树篱/矮墙等可毁地物被摧毁直接消失——要墙体同款 cannon 破碎动画，树篱碎块与实心砖墙区分+应有燃烧变黑后破碎；③.5 更改树篱材质/模型 (活像实心墙)；③.6 树篱顶部不能站人侧面挡人；④"游戏内容设置"加"死亡时手里的手雷落下 是/否" (Bot+玩家)；⑤"性能与画面"加"主动优化 关闭/标准/激进" (帧率降低时迅速清除碎块等)；⑥规避飞机撞机；⑦士兵死亡布娃娃背后的背包会消失——修复且要粘在背上；⑧时停期间关掉手电，光柱光源就地停留不跟随——修复。
**11-17 实机返修 (用户报三虫+同步令)**: 树篱模型方向与碰撞判定垂直错 90° ("貌似只做了一个方向")；树篱被摧毁多块只有一块散碎片；没有"燃烧相应的变黑后破碎"；令"大部分机制需要 Bot 和玩家同步"。
**①坦克修理**: 18-game tryVehRepair 起步口 (vehRepairCrateNear 单源距离门, 舰上箱除外)+账挂 player.vehRepair 入 readBarActive 取消网+19-input R 座位分支+22-hud 读条链分支+20a tick (移动/远离 1.35R/起火)+20-player 下车+15-vehicles fireCannon/firePlayerMG/takeDmg 三钩。**②龙牙**: groundFit/applyFit 贴坡+box.antiTank 三消费点 (_tkBoxCb 低矮豁免例外/_tsBoxCb/_trBoxCb 放行；本就进 OCC⇒NAV 绕行无需新寻路字段)。**③树篱三链路 (11-17 返修实锤)**: ★双旋转坑——建模器把世界偏移 (cs·o,−sn·o) 写进局部坐标又被 mesh 的 ry 转一次 ⇒ 世界轴向 (cos 2ry,−sin 2ry)：东西向篱恰好对齐、南北向反 90°、斜向歪 45°；修=叶团纯局部坐标 (局部 X 加长, 与旧 boxGeo 约定同账) 。★killBox 吞视觉——树篱盒 box.mesh 正指视觉, 烧尽一段 hedgeChar 必须走 killOne (碰撞死视觉留), killBox 连视觉 world.remove ⇒ 焦黑没显形+HEDGE_CRUMBLE 二段 mesh.parent 空永不触发。★三路摧毁路由——crushCoverBox(箱扫掠) 之外 explosionFlora/floraCrushTank 仍走 vanishFlora 直消 = 一排篱只有一段出碎片；三路统一 hedgeShatter (dead 守卫防双杀)。碎块沿段轴散布 (rec.ax/az/hl 建模器写入, 9/8 块 uSpan 3.96m 确定值)+尘烟沿轴多点。**③.5 叶团重做**: 4 团 SphereGeometry(1,7,5) 合并 BufferGeometry+确定性哈希抖动+computeVertexNormals；killBox 摘 mesh/hedgeChar 换材质/queueSink/23b mm 快照全兼容 (单 Mesh 非 Group)。**③.6**: box.noTop + 04-collision _shBoxCb `b.dead||b.noTop` 早退。**④⑤**: NADE_DEATH_DROP (sf_nadedrop, dropHeldNade 单源四调用点全过门)+PERF_OPT 三档 (sf_perfopt, 24-main perfOptTick 1s 滑窗+两窗迟滞+8 窗冷却+perfOptPurge 清碎屑层——11-17 提为文件顶层, 原 loop 内局部探针不可见; 22-hud 两钮+index.html 两卡+i18n)。**⑥撞机**: PLANE_AVOID 预测扫描 (0.35s 低频+3s 前瞻+26m miss 门+逃逸方位 hold 1.2s)+巡航/出生按队错层 (+team*10/+team*12)+diveClaimedBy 同目标汇聚抑制 ×3 打分点；★11-17 修正 tcp/miss **双符号** (rel=v_me−v_o ⇒ t*=+Δ·rel/|rel|², Δ(t)=Δ−rel·t——旧负号对真威胁恒跳过=扫描失灵)。**⑦**: 12-ragdolls torso 背包子网格 (pantMat 0.3×0.34×0.14 粘背)+dispose traverse 回收子几何。**⑧**: 08-effects nightGearLightsOn 谓词并入 24-main nightGearTick 唤醒门 (时停关灯 tick 断粮病根)。
**Bot 同步**: 坦克修理 Bot 车组同规自动修 (tank.vehRepair 账+起步门=残血<60%+脱战 4s+箱在 R+无指挥官令; driveAI 驻车 hold 接敌/机动令让位; update tick 8s 回 25%; fireCannon/AI 同轴/takeDmg 三钩与玩家同款; respawn 清账)。掉雷双覆盖核查 ✓ (14-bots:638/686+18-game:217/265 同走单源门)。
**判据**: 新 dev/verify-fieldfix2-20261116.js **77/0** (树篱朝向世界几何三层断言+烧黑二段+沿轴散布+四路路由+玩家/Bot 修理全链+对头规避+掉雷开关+主动优化两窗+背包+亮图时停关灯) + NEG 14 补丁 22 红全对认。★桩升级 (照 conecollide 先例): 共享 _bootstub _SphereGeo2 升忠实经纬球 (indexed)+Geo.setIndex 存储——_hedgeBlobGeo 读真球三数组, Geo2 8 顶点无 uv/index 全体含篱图探针炸桩 (桩不忠实非被测代码问题)。★桩危机收尾 (11-17): 局部桩表 31 支 (verify-*×22+probe-*×8+_spec-audit/_dbg-7c) 经 _codemod-faithsph-20261117 统一升忠实经纬球 (SphereGeometry:Geo→_FF17Sph(Geo) extends 本文件 Geo 保 no-op 面; _structbase 独立 _SB17Sph+dispose; vehmodels 走 mk 包裹)+uvscale ④b 判据跟码修钉 (忠实球每面 uv 跨度天然<1, 旧桩盒式 0..1=桩时代假绿; 球面改界内判, 柱/锥仍每面 0..1) 23/23 绿。★探针环境隔离: Bot 修理 10s 等待窗坦克被打死 (敌机俯冲+浅河道激流——waterDepthAt 单查不够须 inRiverWater) ⇒ 冻敌机+等待窗屏蔽 takeDmg (打断测试前还原)；亮图 isDarkEnvironment 恒真测不出唤醒门 ⇒ 测试内覆盖 false 模拟用户场景。
**升戳 20261115d→20261116a** (index.html 49+_game_files.txt 45+hudfix/perf 钉+**animfix 滞留钉 20261115c 跟升**)。run-all 注册补登 bamboo+fieldfix2。实机关注: ①任意走向树篱模型∥碰撞∥篱线；②烧树篱焦黑停留 2.5~5s 再碎块化；③炸/碾每段都散碎片；④树篱顶不可站；⑤龙牙贴坡挡坦克；⑥坦克补给箱旁按 R 修理+Bot 坦克残血自动修；⑦飞机不再对头互撞；⑧时停关手电灯就地收。

## 一.111 音效系统完全推倒重写: 每枪独立音色 × 坦克引擎三档 × 炮/爆/机枪全谱系细分 (2026-11-15c, 待实机验收)

**用户令**: 「我希望将游戏内的音效完全推倒并重新设计和制造一套，现在用的基本是从初版Demo继承下来的，太过简陋。不同枪械的音效，轻（此处特指全部尺寸的日本坦克）、大、小三种坦克的三种引擎音效……总之就是要足够细分，不要吝惜。」技术路线用户裁定 = **程序合成推倒重写**（零音频资产，沙箱/闸门/冻结账全兼容）。

**一、01-audio.js 内核推倒重造**（原 997 行 → ~1250 行，原地重写保加载位次与 AudioSys 全局）：声明式分层档案表单源——`GUN_PROFILES`（旧 snd 五家族缺省档保留 + **每把在役武器一条独立音色** 38 条 + 载具/固定机枪 9 条：vcoax/mg_mg42 撕布/mg_92 慢沉/mg_maxim 水冷闷/mg_air/planeMG/navalSec/navalMG/flak20）/ `CANNON_PROFILES` 13 条（tkJp 57mm 浅咣·tkMed 75mm·tkHeavy 88-90mm 深锤·atgun·battery·naval_lvt/kami/pt/gyorai·rocket_bazooka/schreck/loiter 带 hiss 尾焰层·generic）/ `EXPLOSION_PROFILES` 18 kind（新增 thunder 天穹闷响·drum 亮 pop·collapse 闷隆+大量散落·tankdie/planedie/truckdie 带**殉爆连响 pops 层**·torpedo 水下闷爆·barrage 重炮犁地）/ `ENGINE_KINDS` 9 档 + `ENGINE_ALIASES`（tank→tankSmall·plane→planeInline）。**每发变奏**：频点 ±7%（jf）/响度 ±9%（jv）逐发抖动 ⇒ 连发不重样。**真声像**：新 `AudioSys.panOf(pos)` 单源（相机右基向量 matrixWorld[0..2] · 方向 XZ）——旧 cannon 收 pan 参数但函数体从不使用（病修正）；cannon/explosion 全链出声像。兼容面：全部旧 API 名保留；explosion/cannon 第一参收到**数字**=旧调用口径回落 generic 档。

**二、引擎三档（用户裁定口径）**：`tankJp`=**日系全系不分尺寸**（九七式/一式 + cpc 缴获两版，判据 `tk.shape==='chiha'` **在前**——一式 heavy:true 也归日系；saw 粗糙波 + pitch1.35 高转嘶吼 + 纹理噪声更粗）/ `tankBig`=潘兴·黑豹·KV-1（**读 `tk.wc==='heavy'` 不读 def.heavy**——heavy 是槽位标记非车重（2026-10-24 批口径），T-26/一式 heavy:true 实为轻/中坦；pitch0.8 低沉 lp240）/ `tankSmall`=其余轻中坦（谢尔曼/四号/T-34/维克斯/T-26）。飞机两档跟剪影单源 `pl.nose`（inline: P-51/BF-109/零式/隼=det18 lp900 平滑高转 / radial: P-47/FW-190/La-5/IL-2/霍克III/伊-16/九九式=det26 lp700 粗哑拍频）。**卡车首配引擎**（truck 档 square 柴油哒哒；15b 构造建档+update 频响+die/突围即停——车队首次有声）。海战 amph/boat 基档（navalAudEngine 塑形契约 osc/osc2/lp 原样接管；15d 构造与 01-audio 重生建档双点随 kind 口径）。幽灵坦克 tankSmall（开火静音红线不动）；巡飞弹 loiter 专用电嗡档（pitch1.6，13-combat 顶层建档 'plane'→'loiter'）。

**三、identity 全链接线**：WPN_DEFS 43 条全加 `sid` 字段（node codemod 逐条机械插入；★radio 行 `radio:{` 无空格+尾行 `\n` 被正则 `\s*$` 吃掉两坑，手工补）；`MG_BULLET_DEF` sid='vcoax' + `mgBulletDef` 按 `FACTION_MG.style` 经新单源 `mgSid()` 分档 + 20a 枪座玩家声同步；fireBullet/玩家开火全走 `def.sid||def.snd`；坦克炮/爆炸 17 处调用点全带档位（explodeAt 增第 5 参 kind，frag 路径传入）。

**契约红线全数原样**（多支在册探针钉死）：bypass 13 键 verbatim / 24-main 冻结喂账 / `navalAudioTick(wdt,dt)` / navalAudEngine 三写点 / splash 四参签名 / 幽灵坦克开火静音 / 远枪限流（dist>70·100ms窗4发）/ `'tank'/'plane'` 旧档别名可用（verify-batch-20261114 直调 createEngine('tank') 兼容）。

**判据**：新 dev/verify-audio3-20261115c.js **47/0** = 契约面（bypass/naval/splash/引擎 pitch 写法 verbatim）+ 四档案表（在役武器 sid 全覆盖·炮 13·爆 18·引擎 9+别名）+ **逐阵营实 spawn 引擎档**（normandy: M4/四号=tankSmall·潘兴/黑豹=tankBig·P-51/BF-109=planeInline·P-47/FW-190=planeRadial; songhu: 维克斯/T-26=tankSmall·九七/一式=tankJp; baituan: 缴获双车=tankJp）+ identity 接线锚 14 组 + 行为面（每发变奏 bandpass 抖动层 3/3 全不同·未知 sid 回落·旧数字口径·tankJp saw 60→81·tankBig 60→48·truck square·radial det26/lp700 vs inline det18/lp900·panOf）+ 远枪限流；**NEG 3 补丁亲见转红**（N1 garand 档改名→T2b / N2 引擎映射硬编码 tankSmall→T3a/b/c+T4e / N3 bypass 摘键→T1a）。**verify-audio2-20261115 退役删档**（T2-T4 钉旧合成内部 osc3 表/58→18Hz/bp1b 层随推倒过期 = 过期锚清账先例；仍有效契约面 bypass/splash 四参/行为 init 全数并入 audio3）。**老探针判据跟码修钉**：verify-ffneutral-20261109 T9 锚1/锚2（explodeAt 增第 5 参 kind 两锚随码）+ 顺手清 11-10 海战下架遗留的 N4 NEG 过期锚（`!shooter.capitalGun` 已摘项）——修钉后正向 39/0×3 + --neg 22/17 有红=判据具分辨力；r1 唯一稳定红即此两锚（tankai 为在案偶发 3/3 复绿）。**run-all 两轮**：r1 102/107 → **r2 101/101 全部通过 ✔**（audio3 47/0 在册套件内亲见）。换弹音裁定：10-viewmodel 按机构分档（栓动/漏夹/弹匣/弹板/弹鼓）本已各自独立参数，**维持不动**（报告声才是主辨识面）。**升戳 20261115b→c**（index.html 49 + dev/_game_files.txt 45 + 23 支戳钉探针；★坑又账：Git Bash `grep -rl` 输出带 \r 尾 ⇒ sed 批量 22 文件 "can't read"，照 11-14 批先例 `tr -d '\r'` 收口）。

### 待验收（用户实机清单）
1. 每把枪听感区分（同族栓动如毛瑟/三八式/中正式/汉阳造各有音色）+ 同枪连发每发微变奏不机械重复。
2. 坦克引擎三档：日系坦克（含八路军缴获）=高转嘶吼 vs 潘兴/黑豹/KV-1=低沉 vs 谢尔曼/四号/T-34/维克斯/T-26=中档；坦克炮声同样三档（日系浅咣/中型/重坦深锤）。
3. 飞机直列（P-51/BF-109/零式/隼）vs 星型（P-47/FW-190/La-5/IL-2/霍克III/伊-16/九九式）两档引擎。
4. 车队运输卡车首次有引擎声（路边能听到卡车开过）。
5. 枪座重机枪四档：MG42 撕布 / 九二式慢沉 / 水冷马克沁闷 / M1919 气冷；坦克同轴/航炮/舰载机枪各自音色。
6. 爆炸按类型分档：手雷/AT炸药/迫击炮/航弹/炮弹落地/地雷/坦克殉爆（带连响）/坠机/鱼雷（闷）/雷暴远雷/油桶/楼板坍塌。
7. 火箭筒发射音（巴祖卡/坦克杀手/巡飞弹各档+尾焰嘶声）；巡飞弹飞行电嗡档。
8. 远处炮声/爆炸有左右声像；水下闷响/时停静音/结算静默/暂停静音照旧。

## 一.110 锥体碰撞普查 × 教堂侧楼修形 × 入水特效/音效 × 音效全套重制 × 自适应弹坑 (2026-11-15, 实机已确认)
承用户五令（1 锥体碰撞不遗漏 / 1.5 教堂侧楼屋顶+二三楼接缝 / 2 入水特效音效随速度尺寸 / 3 音效全套重制 / 4 弹坑自适应贴地），中途令**禁浏览器截图验证**（碰撞信息以 CYLS/BOXES 代码账本为准），四项实机均已确认修复后收尾。**①锥体**：全库 cone 过堂，真缺碰撞的悬空锥体仅三处——教堂尖顶（`ConeGeometry(4.2,3.4,4)`+`ry+HPI*1.5` 45° 平边对墙全覆盖，用户令"转45度再加大"，三档碰撞 3.5/2.2/0.8）、国会穹顶（七档漏斗带面半径 6.9/3.1/4.5/5.9+顶针 2.4/1.5/0.6）、水塔锥顶（1.7/0.6）——全部 `noNav:1` 分层近似圆柱，OCC 烘焙加 `c.noNav` 豁免门（高空饰件不占地面格，圆厅照常走人）；钟塔底层墙 h 7.05→7.2 消 15cm 沟缝。**②入水**：waterSplash 五参 `(p,scale,big,bubbles,spd)`（粒子 n 随 spd、水柱 ×spdF、白沫冠、气泡；音频四参透传），四新消费点=Bot（moveDir 干→湿边沿 `_wStatePrev` 账+`_wyPrev` 落差折算 scale0.6~2.2）、坦克（`_wasInWater` 账 3.4+气泡）、卡车（2.6 档）、飞机触水坠机（先溅后毁 2.2~4.2 随下沉率）；玩家/炮弹本就有未动。**③音效**：契约面零动（bypass Set/naval 段逐字/引擎节点名/静默冻结账）；枪声+第二裂响+中频体层+近距机械咔哒、爆炸五层（次声重锤 58→18Hz/1.4s 等）、引擎三层化（osc3 次八度+ns→nbp→ng2 纹理噪声）、splash f0 双调制+嘶声+回浪、炮声/脚步/弹啸/跳弹/受伤/迫击炮/高炮/远机枪全套加层。**④弹坑（二轮修黑弧）**：病根=渲染地形是 terrainRenderY 弦面而非 heightAt，曲率段弦高 0.3~1.2m ⇒ 坑体沉进渲染面之下只剩唇缘露弧+一轮修绕向朝下全剔除——修=03-terrain 新 **terrainSurfaceY 单源**（同格距同 PlaneGeometry 对角，python 提取打包 three.min.js 证实）+05b 顶点改采+绕向翻正 `(a,a+1,b)`；125 顶点 BufferGeometry/唇缘脊 0.8r 峰 0.13r+0.05 余量/外沿 1.18r 熔回；贴花契约与 36 账不动。**判据**：新探针四支全绿入册——conecollide 18/0+waterentry 26/0+audio2 21/0+crater 21/0，NEG 3+3+3+3 补丁全数亲见转红（红名↔补丁对认）；crater 探针桩补真 setIndex/computeVertexNormals（照 Group.clear 先例）；★坑：createEngine 节点懒建须先 setTimeFrozenMute(false) 否则 nodes=null 假红。**run-all 两轮**：r1 101/107 + r2 105/113——预存红 fixbatch-20260926 ✗1「splashDamage 掩体遮挡」=11-13 零分配批改掉旧字面量的过期锚，判据跟码修钉后 55/0（11-14 批在案预存账清零）；loiterview/tankai 偶发单跑 3/3·2/3 绿；botai 偶发率偏高（9 跑 4 红）但选择性 A/B（摘 noNav skip ×4）3/4 绿且签名相同 ⇒ 预存与本批无关（下批 triage）；surf 22/22+worldrestore 10/0 契约单验绿。**升戳 20261115a→b**（22 文件：index.html 49+game_files 45+戳钉探针 20 支）。详见 `finished-docs/批-锥体碰撞×入水特效×音效重制×自适应弹坑-2026-11-15.md`。

## 一.109 多图实机反馈修批: 四图基地对角错位 × 百团营距/R10 × 莫斯科墙/厂 × 胡康水面三项 × 草原水塔 × 柏林地铁结构四修 (2026-11-15, 待实机验收)
承用户多图问题单（OverAll+1.1~5.1）。**OverAll**：草原/雾林/莫斯科/胡康双方主基地按用户裁定**对角错位**重排（消除隔图对望）。**1.1/1.2 百团**：主基地/中路前哨/南进攻营拉开（前哨距≥55m）+ R10 堑口南移距桥≥20m（旧 14.5m 把沟压平）。**2.1/2.2 莫斯科**：残墙迁位（不压教堂实体足迹/无房屋级足迹重叠）+ 工厂锚西移旗距 186→132m。**3.1/3.2/3.3 胡康**：`inRiverWater=inRiverChannel&&waterDepthAt>0.2` 水态门（干岸不再吃激流）+ 水面条带补到可玩边界（±195 实测有水）+ 水位系数 0.55→0.44。**4.1 草原**：水塔四腿收进罐底投影。**5.1 柏林地铁 a~d**：隧道带 street:1 桥式抬升（heightAt 权威覆盖 metroLiftY，坦克如过桥）+ 坑底压平+石板底板 + 护环 pad 杀侧墙沟 + 胸墙/顶板封缝 + metroTunnel 纯建造件重写——**结构与通行四项已修**；用户裁定地铁停止迭代，厅内裙摆/带面草色/洞口行人竖坎/带端视觉坑四项**落专档收尾**（实测数据+参数级修法：`finished-docs/柏林地铁站-整改台账与后续修法-2026-11-15.md`，下一批照抄施工，不动 heightAt 则五处 shim 零同步）。**判据**：新 dev/verify-mapfix-20261115.js（29 断言 0 红 + NEG 4 组亲见转红）入册；五处 shim 副本全套 metro 函数同步；05c 棚屋街内禁落门**前置**（placeAt 成功即登记足迹，后门留孤儿足迹）。run-all 三红全数归因处置：vehburnfix ④-1 激流锚改水态门（12/0）、verify-nav 判据两层修钉（内段晕距+侧移走廊/杂物归因放行，8/0×3 稳定）、foliage 审计簇内双株改逐株烧（exit=0）；预存红账 fixbatch/windmill/tankai 偶发在案。**升戳 20261114g→20261115a**（含 dev 戳钉探针 20 支 85 处跟升）。**实机关注**：①四图基地对角；②百团营距/R10；③莫斯科教堂周边/厂旗距；④胡康干岸不误伤+水位+河道到边；⑤草原水塔腿；⑥柏林：坦克碾过隧道带、坑底石板、侧墙无沟、洞口封严（观感四项见专档）。详见 `finished-docs/批-多图实机反馈修批-2026-11-15.md`。

## 一.108 六图缩图批: 柏林/莫斯科/百团/草原/雾林 640→360 × 胡康 640→380 (2026-11-14, 待实机验收)
承用户指令「柏林1945、百团大战1940、莫斯科保卫战1941、草原遭遇1943、胡康河谷1943、雾林守线1943，这些地图均具备明显的、严重的大且空的特征……保留全部核心特征，保留标志性建筑，对这些地图进行缩小，最多有限略大于诺曼底1944的地图」；AskUserQuestion 两裁定：胡康=380²、其余 360²（诺曼底 320 的 1.125 倍）；柏林/莫斯科城市街区「全等比硬缩」（街宽 16→9m、街块 59×79→33×44、模块 80→45，用户选的"更废墟围城"口径）。
1. **缩放纪律（通用）**：位置类全缩（关于图心 ×0.5625/×0.59375——均匀缩放保方向保共线 ⇒ 坡道-沟线/桥-河道/路-街网相对关系天然保持）；**剖面宽度类一律不缩**（河沟 w/d/bottom/talus、坡道跨沟长度与 w、渡台、桥 len/w/yaw、metro 厅 26×18 与 r9 广场、隧道截面 6、旗/强点 r、龙牙带厚 12/9m、装甲缺口宽、雷带宽 18m、村社/台地 r、炮火犁地全参、建筑单件尺寸）；THEMES 计数 ×0.316 保每面积密度；`botMul:[1.25,1.25]` 删除（回标准 11=每面积强度与 320 图同口径）、berlin/moscow tankN 8→7（注释自证东欧标准）、matchMin:22 保留；02-scene 雾距/22a-menuart 植被的 `mapSize>=640` 档自动降档，HGRID/OCC/NAV 固定格径格数随图幅收缩，03-terrain 零改动（全读语义表）。
2. **各图要点**（三个实施智能体+复核轮，规格留档 `dev/_shrink-spec-*-20261114.md`×3）：柏林=全等比硬缩街网+metro 双厅保尺寸重排（北厅 z 微调脱梯段浮点振荡带）+让位三处重算+`cityBlockRows` 恢复默认 16 间距（每块落屋数不变，城区 52 栋/旧 83=面积密度 ×2.9）；莫斯科=厂区 yard 外扩包固定围墙群+锚点南移 21.9m（唯一无街相交放法）+厂旗/factorySpawn/道路随移，城区 74 栋/旧 114；百团=坡道 R1~R10 **平移保尺寸**（跨沟向盖满剖面全宽，中线最陡 48.3°≤坦克 70°、OCC 全放行）+渡台平移保尺寸（旗台差 0.00m）+前出点净空重钉 ≥14m（带宽不缩位置缩，北/南营外移）；胡康=**巨桥集群原值保留**（大桥/桥西/桥东三旗+grand len76+桥头堑——桥头旗缩了会落桥面上），外圈缩，ford 滩心缩 r26 不缩（滩心水深 0.08m），北石拱桥 x/z 缩 len48 保；草原=龙牙带厚/缺口半宽/雷带宽保中心缩，**7 强点全在 NAV 主分量 5074 格**（死袋专项：风车/北原哨塔/东岗塔外推 6.6~10.1m 出占领圈）、雷 72 枚缺口内 0；雾林=3 堑口平移保尺寸（中线落差 ≤0.39m）+西墙缺口走廊穿行验证+岭上村旗=台面高。
3. **复核轮修 3 处缩图真回归**（verify-buildings 揪出）：柏林北站货栈 barn 纯缩值压进街块（互穿 2.8×11.5m，HEAD 时距 25m）→ 移锚+庭院散布内缩自适应 `max(2,min(12,span/2−2))`（宽块逐位零漂移）+metro 北厅 z0 微调，verify-buildings 柏林/莫斯科 PASS。
4. **顺手修的真 BUG（布势撤销配比顺序缺陷）**：`cmdDeployUndo` ②配比重算块在 ④c 私人小队还原（cmdSquadRestore 改编制成员集）**之前** ⇒ 撤销后缓存配比停在收编前口径（verify-deployundo ③ 两红，被本批 botMul 删除改变聚组暴露的潜伏缺陷）→ 重算块整体移到 ④c 之后，47/2→**49/0**。
5. **判据**：新 `dev/verify-mapshrink-20261114.js`（boot 六图 56 断言：mapSize/界内/旗距≥45/findPath 76 条/地标抽查/NAV 主分量/越界自检）入册（注册表 95→96）；RIVER 手抄副本 5 处同步（verify-layouts/_structbase/verify-buildings/verify-fire/verify-rooffall）；verify-layouts 六图阈值×0.85 跟走+probe-slope 七组重钉+verify-fixbatch ②-d/②-m 坐标跟走+verify-tankai（200m 车道实测仍放下+lane() 升级平行线采样）+verify-destruct T2/T3 夹具补最薄边过滤（A/B 证物理零回归）；_wreck-selfcheck 指纹重录（HEAD 对照：六图变=预期、normandy/stalingrad/burma/island 四图变=05a 全局建筑件几何非布局漂移已注明）。
6. **run-all 三轮**：基线 94/98（唯一稳定红=fixbatch-20260926 ✗1 预存）→ r1 98/108（deployundo 新稳定红=上条真 BUG，修后 49/0；botai/nade 各 1 偶发复核 7/7 绿）→ r2 **95/102 唯一稳定红=预存 fixbatch ✗1**（loiterview 偶发 2/2 复绿）——**零新增稳定红**；预存红账另含 verify-buildings 草原 windmill 1 红+verify-strongpoint island 5 红（HEAD 实证）。**升戳 20261114f→g**（22 文件 179 处=index.html 49+_game_files.txt 45+20 支戳钉探针；node split-join 逐文件计数，零残留；hudfix/perf/fixbatch-20261104b/text 四探针抽跑绿）。
7. **实机关注**：①六图都应"紧凑但不堵"——柏林/莫斯科街巷 9m 级坦克错车紧但可走、地标尺寸不变；②百团 10 条坡道+2 渡台全部可通行、三路进攻营都能走出；③胡康巨桥尺寸/位置与旧版一致、徒涉滩可涉渡、北石拱桥通车；④草原 7 强点占领/出生权照旧、缺口走廊可穿、无强点站桩；⑤雾林三堑口下谷底、西墙缺口可穿；⑥Bot 回标准 11/队；⑦指挥官布势调配比→撤销→重进，配比读数=组内实际兵种。详见 `finished-docs/批-六图缩图-2026-11-14.md`。

承用户两令：①「现在载具在血量<10%然后自然掉血到损毁的时候，模型位置会发生一次漂移，原因不详，需要修复。」②「彻底去掉两个彻底失败破产的纯海战地图及其相关代码，移动到D:\Artifact\Battlefield Like\archive文件夹中。」
1. **①病根=烧毁账 die() 后不 return**：hp<10% 起火→燃烧 dps 烧到 0 的那一帧 die() 播完后，同帧 update 余段（姿态/物理/位置积分）继续对已死车体写入 ⇒ 模型跳一次位。修=15-vehicles Tank / 16-aircraft Plane 燃烧账 `die(...); return;`+`if(!this.alive) return;` 守卫（15b-trucks/15d-naval 当年就带，坦克/飞机漏）。并发批「碰撞三蟲抓」(aircollide-20261110, 见其批次条目) 同日落地：坠地机毁人亡 `!crash` 档（碰撞系机毁一律走死亡链，跳伞不成立）+飞机撞楼 `damageStructures(_plSwHit,7,260,…)` 击落者归属 —— 两者使 vehburn die 接线钉与 structscore T10 计数钉需跟码（见第 6 条）。
2. **②海战下架范围**：coral/ironbottom 两战役条目（00-config）+15g-capmodels+15h-capital 整文件+index.html 两条 script 标签+21 个 js 全链摘除（03 opensea 海床/05c 两图布局/04 舰体碰撞/13 大舰接触块与吃雷钩/14 Bot 大舰编队摆渡 19 处/15v capitalShellHit/15d 吃雷钩注记/16 停机弹射拦阻/18/19 座位门/20 ②b 甲板交互层+大海致命化/21 capFlagActive+capCrew 记分/22 大舰地图符号+弹药面板+锁夜/23 部署大舰/23b capitalReset/24 巡航 tick/25/26 capCrew）。战役 14→13。
3. **归档**：`archive/naval-coral-ironbottom-20261110/` = 15g/15h 原文+两图条目史料摘录（00config 915-1026 行）+6 支海战探针（naval/navalcap/round4/round5/round6/phase5-capital）+3 支大舰 dev 工具（_probe-capdeck/_probe-capplayer/verify-seabatch）+归档 README（含保留件清单与恢复指引）。
4. **保留件**（岛图河湖共用）：15d/15e/15f 小艇两栖车全家+onNaval+navalCraft+sfNavalMapSymbols+planeFloorY+planeTgtVel（原 capTgtVel 艇/机分支收编 16-aircraft）+ironbottom 标定史实注释。
5. **dev 侧**：81 支探针载入清单批量摘 15g/15h 两项（r1 曾因 ENOENT 全线红——探针载入盲区教训的批量形态）；6 海战探针退册；vehburn 两支入册。
6. **判据跟码 19 支全绿**：vehburn-20261109 三钉（!crash 门/大舰炮位行/详细操作开关 7→6）+r1 稳定红 16 支：旧戳钉×11（cmdbatch2/crushhead/fieldfix/fixbatch-20261104b/flyaim/loiterfreeze/loiterview/perfgfx/timestophud/parity/commander，20261109b→20261110b/50→48 处/46→44 行）+F 交互栈双击门 14→7 ×2（batch-20261030/nadecancel，大舰甲板层 7 处随下架）+commander D18 姿态门+自带脚本清单 46→44+19-input ADS 门 capitalGun 项（flyaim/touchpad）+parity 附身候选 capCrew+ffneutral T7/T8/锚4 coFfFire 座位排除+structscore T10 调用点 10→11（三蟲抓① 飞机撞楼新调用点漏跟=新增调用点必须跟计数钉的教训）。
7. **run-all 两轮对账**：r1 首跑 65/81（16 稳定红+1 偶发）→ 跟码后 r2 **80/80 全部通过 ✔**（r2 含并发会话新登记 aircollide/willow 两支同绿）；nade-trigger r1 偶发（0/1/0）单跑 88/0=在案种子偶发族。
8. **版本戳** `20261109b→20261110b`（index.html 48 处+`__sfStyleVer`+_game_files.txt 44 行+vehburn 戳钉判据跟码）。
9. **实机关注**：①坦克/飞机残血起火烧毁瞬间模型不再跳位；②战役列表无珊瑚海/铁底湾，其余 13 图开局/旗点/票务正常；③岛图河道小艇/两栖车照常；④烧毁残骸照常燃烧冒烟、死亡掉雷/击杀播报不变。

## 一.106 中立批: 投掷手雷中立 × 观战武器中立 (2026-11-09, 待实机验收)

承用户两项: 「①所有投掷性手雷都应当是中立的, 会同时杀伤友军和敌军 ②观战模式下的所有枪械也应当都是中立的, 命中的时候会杀伤友军和敌军」。三条裁定: **仅爆炸伤害中立**(触发引信仍只认敌方——武装雷碰友军穿过去, 落地才炸); **击杀照常记分**(归因链不加同队门); **座位武器不含**(观战者坐真实载具开火维持原队伍口径)。

1. **①投掷手雷中立**(仅爆炸面): frag 走 explodeAt 加第 4 参 `noFF`(13-combat)——手雷分支传 true 跳过同队×0(自炸 s!==attacker 例外不动); boomer 殉爆/航弹叠爆/钢水包/丧尸链不传=旧口径逐位不变(丧尸自爆不伤同队的行为依赖仍在)。反坦克炸药走 nadeExplode 溅射 team 传 **-1**(与地雷/油桶/巡飞弹手动引爆同约定; 连带溅射圈可及载具/艇舰/飞机, 与 mineBlast 同口径)。烟雾/燃烧无直接伤害(燃烧弹地面火本就无队伍判定); 烟雾/燃烧/AT 的**触发引信逐位不动**(nadeContactTarget+载具触发圈仍只认敌方=裁定 A, nade-trigger B2 友军阴性原样自绿锁定)。throwNade 弹体 team 字段不动(死亡掉雷 T1/敌雷接近警告/预演抛物线全不受扰)。
2. **②观战本尊全步兵武器中立**: 判定单源 `coFfFire`(13-combat) 加 `shooter.spectator` 门——一处放开三处同源(raySoldiers 步兵弹道/子弹刮友军载具/naval+capital 射线门); 顶部注释整段重写(2026-09-20"只有观战连狙可打双方"口径被本批裁定取代)。**座位排除**: `spectator&&!onNaval&&!capitalGun` —— 艇机炮/大舰副炮走 fireBullet(shooter=player), 不排除就借门变无差别火力; 观战者可达的真实座位只有这两个(固定炮位被 tryInteract ③ 挡住, 真坦克/真飞机被"不得征用真载具"挡住; 幽灵坦克 ffAll 覆盖不依赖新门)。**观战本尊火箭筒**: fireRocket 盖章 `spectator?-1:team`(幽灵坦克 team:-1 同约定, 下游命中/溅射链全通)。**观战本尊手持迫击炮**: nadeExplode mortar 分支 `thrower.spectator?-1:team`——不在弹体上盖章(保住敌雷接近警告与迫击炮弹载具触发圈旧口径), Bot 迫击炮逐位不变。压制/惊动口径不动(观战开火本就不压制不惊动任何一方); 附身宿主开火=宿主 Bot 的弹不中立(表现层单向读零写点契约)。巡飞弹整链不动(既往裁定)。
3. **瞄准吸附跟走**(吸附契约"吸附对象集=子弹可命中集"): 20-player 吸附 ff 门 `!!p.ffSpecSniper` → `!!(p.ffSpecSniper||p.spectator)`。刺刀摘旗注释改历史注记(新口径下观战刺刀伤友军由 spectator 门兜着, 摘旗不再阻断; 代码保留防锚漂移)。
4. **击杀照常记分**(裁定 B): 归因链零改动——友军击杀照加 kills/score/killfeed(本批探针 T1b 钉死不加同队门); AI 反击链既有同队门+观战门(14-bots damage())保证友军误伤不引发还击锁定、观战开火不惊动任何人, 零改动。
5. **判据**: 新 `dev/verify-ffneutral-20261109.js` **正向 40/0 ×3 轮**(T1 一颗炸三点/T1b 照记分/T2 AT 雷/T3 引信三态/T4 观战步枪+双阴性/T5 火箭盖章/T6 手持迫击炮三态/T7 coFfFire 矩阵/T8 座位不泄漏/T9 源码锚)+**NEG 七补丁 17 红逐名对认**。判据跟走: verify-specthird T2/T3 改写为新口径(观战普通步枪伤友军; 阴性对照换非观战态)修后 59/0; verify-batch-20261030 迫击炮 splashDamage 精确串锚(NEG 补丁+源码锚两处)跟新 50/0; verify-spec/specbatch/aimassist/nade-trigger/deathdrop/killattr/zombie-doublekill/fixbatch/nademap/sink/specview/specweapon/deathflight 十三件全绿零波及。**探针坑两录**: ①fireBullet 里坦/卡/艇是硬挡弹目标(先于士兵收窄 wallD)而 raySoldiers 只测士兵 ⇒ 摆位预检必须载具净空+射线前沿身份双校验重试环(_stageShot), 否则"观战打友军不掉血"假红; ②kill 精确计数断言须先把旁观单位搬出爆圈(部署场上别单位恰在 10m 内=多记一杀)。
6. **版本戳** 20261109a→**20261109b**(index.html+__sfStyleVer+_game_files.txt+戳钉探针随升, node 整文替换)。
7. **run-all**: r1 80/84 exit=0 —— 唯一稳定红=naval×4(在案预存红线7, 重试 1/1/1), **零新增红**; 本批探针 ffneutral 0 红; r2 用户裁定不跑(2026-11-10, 版本戳 20261109b 已落, 戳钉探针/hudfix/perf/animfix/text/boot 单跑见 r1 同款全绿)。
8. **实机关注**: ①朝队友脚下扔普通雷/反坦克炸药: 友军掉血乃至炸死, 击杀播报照出、击杀数照加; 自己站圈里照炸; ②武装雷贴着队友身体飞过去**不炸**, 落地才炸; ③调试观战用主武器/火箭筒/手持迫击炮打友军: 掉血照杀; ④观战吸附可掰向友军(与可命中集一致); ⑤观战者上友军舰船/大舰炮位开火: 仍不打友军(座位武器不含); ⑥非观战正常作战: 枪/火箭/迫击炮/航弹照旧不打友军; Bot 误扔的雷现在也可能炸到队友与玩家。

## 一.105 四项批: 载具残血起火 × 页签排序 × 详细操作开关 × 自动脱离载具 (2026-11-09, 待实机验收)

承用户四项: 「①任何载具生命值低于10%的时候一段时间内自动掉血至0损毁(仍会正常受伤), 此时应当有显示警告。Bot AI 方面也要对齐 ②把"性能与画面"移到"游戏内容"和"language"选项卡之间 ③游戏内容设置增加"游戏中显示详细操作"(是/否), 关闭后不再显示"左键 开火"这类操作说明与"任意一方占满全部旗点"之类的局外说明 ④游戏内容设置增加"自动脱离载具"(是/否), 开启后载具被击毁自动下车脱离(飞机跳伞)」。三问裁定: 页签顺序=操作方式→语言→性能与画面→游戏内容(单块移动); 详细操作关=**保留单键交互入口**(F 进入坦克/F 补充弹药等, 多键明细才藏); 自动脱离**默认关**。

1. **①载具残血起火**(四家族单源接线): 常量单源 `VEH_BURN_FRAC=0.10/VEH_BURN_TIME=10`(00-config) —— hp<maxHp×10% 点火, 燃烧账每秒烧 maxHp×1%/s ⇒ 自起火起 ≤10s 必烧毁; **点火单源 `vehBurnIgnite`**(04b-fire): 置 burning/burnBy(击杀归因=点燃者)+follow 火源(dps=0: 只做视觉+点燃植被, 车体伤害走 update 燃烧账直扣 hp 不走 takeDmg ⇒ 不刷红闪/lastDmgT/flood; follow 锚走 capAnchorWorld 通用位姿只读 pos+yaw 对坦克/卡车/舰艇通用; 载具 die 置 alive=false ⇒ follow 块当帧自动掐火, 残骸火源无缝接管); **飞机不带火源**(飞行拖火会沿航线点燃全图)改机体每 tick 喷火粒/烟(burnFxT 节拍)。四家族(坦克 15/飞机 16/卡车 15b/舰艇 15d) takeDmg 扣血后各插一行点火检查+update 各插燃烧账; **起火禁自修**(坦克闲置回血门加 !burning —— 无人车 +2.5%/s 若不门会盖过 -1%/s 燃烧; 舰艇无自修已核); respawn 三处复位 burning/burnBy/burnSrc(车体模型重生复用不得跨生死携带)。**排除项**: 大舰维持瘫痪不沉契约(已有 fireHp 0.25 起火先例)/火力点迫击炮无 HP/观战幽灵坦克 specRide 免伤。
2. **警告**: `#vehBurnTip`(仿 #tbTip 持久红字条, index.html+style.css) — 22-hud updateHUD 载具血量条块旁驱动: player.onVehicle/onNaval 任一座驾 burning ⇒ 显「⚠ 载具起火! 即将损毁 —— 快脱离!」, 脱险/烧毁即隐(hudShow/hudText 指纹去重)。
3. **Bot 对齐**: 14-bots 乘员同步块头部插 **坦克座驾 burning ⇒ dismountVehicle(true) 立即弃车**(bailing 档: noEnterT 12s 防复上+撤位滑步+压制值)+pickObjective 重选; **舰艇 Bot 起火 crewOut() 弃船落水**(玩家不弹, 留舰到沉没由既有弃船链接管); 飞行员 32% 跳伞先于 10% 起火线(既有, 零改动); 登车/登船 40% 血门天然挡住起火载具(既有, 零改动)。
4. **②页签排序**: index.html #mSet 仅移动「性能与画面」块(268-271)插入「语言」之后 ⇒ DOM 序 操作方式→语言→性能与画面→游戏内容; 接线按 id 零 JS 改动零新词条。
5. **③详细操作开关** `SHOW_CTL_HINTS`(sf_ctlhints 默认开, 即时生效不 reload): 隐藏面=**多键操作明细**(20-player updateInteractHint 的幽灵/舰艇/飞机/坦克/大舰炮位/迫击炮六明细行+右下 #clsTip 兵种常驻键位表整块; 22-hud #nadeN 五载具操作行——飞机行留"炸弹×N"存量、navalSeatHud 操作行; #braceInd '[X] 架枪' 键位态)+**局外说明**(#tickets modeLine 模式说明含"任意一方占满全部旗点"句; 观战键位行含 cmdSpecHudKeys)+**一次性键位提示**(23-deploy 部署页两 pop+调试模式 pop/26-commander cmdDeployHint/19-input 建造选择; 读条行"再按一次打断"后缀)。**保留面**(用户裁定): 单键交互入口(F 使用迫击炮/F 进入坦克/F 补充弹药/F 拿取绷带/F 跳海/登机弹射等)、'▙ 已架枪' 状态、wipeLine 实时战况、战报/得分/状态条; 19-input "观战模式·不指挥小队"两 pop 属按键反馈应答保留(非主动键位教学); 读条行 "X 收回" 属词典整句键不动(摘除需 churn i18n 收益趋零, 记录在案)。
6. **④自动脱离载具** `AUTO_EXIT_VEH`(sf_autoexit 默认关): 20-player 新 `autoExitWreck(v,bail)` 单源 —— 坦克=occBlocked 五向探针车旁落位(复用 specRideEject 落位段)+座位态清账+VM 恢复; 飞机=与 F 离机跳伞逐字同口径(机下 2.5m+机头前向 6m/s+开伞 chute); Tank.die/Plane.die 玩家分支插 `else if(AUTO_EXIT_VEH&&player.alive)`(观战 specRideEject 旧链不动); **crewSlots 结算不变**(2 名额仍随车阵亡, 玩家是唯一逃生者); 舰艇弃船弹出是既有行为不受开关影响; 默认关=照旧车毁人亡(⑥-3 恢复类断言钉死)。
7. **判据**: 新 `dev/verify-vehburn-20261109.js`(timestophud 同款真 three boot+开局; ②行为段直驱 takeDmg/update) **正向 39/0**: ①源码钉 15 条(四家族四件套/点火单源/Bot 弃车弃船/autoExitWreck/隐藏面清单/页签 idx 序/戳)+②点火阈值(≥10% 不点火/<10% 点火/burnBy 归因/follow 火源 dps=0)+③燃烧账(起火中无人车净掉血=自修被禁实钉/400 帧内烧毁/正常受创照常 hp=maxHp-100/respawn 复位)+④飞机烧毁+坦克乘员弃车+④b 海战图沙箱舰艇弃船(★★normandy 无 navalCraft ⇒ 海图单独 boot)+⑤警告显隐+⑥自动脱离四态(开=车毁存活落位≤7m/默认关=照旧死=恢复类/机毁跳伞)+⑦开关四态(modeLine 藏显/nadeN 藏显)。**★探针坑两新**: ①**顶层 const 词法绑定遮蔽 globalThis 属性** —— 探针沙箱里 `globalThis.ATK=...` 后裸 `ATK` 仍解析到 00-config `const ATK=CAMPAIGN.atk||0`(词法绑定优先) ⇒ attacker=0⇒burnBy=null 假红; 沙箱注入变量命名须避开游戏词法名(grep `^const X` 先查) ②跨 vm 边界两次 G() 取对象做 === 不可靠 ⇒ 恒等断言一律写成上下文内单表达式 `G('a===b')`。**NEG 8 补丁 13 红逐名对认**(全单行锚): N1 摘坦克点火⇒②-2/3/4+③-1/2/4 红; N2 燃烧账 hp-=0⇒③-1/2 红; N3 摘 Tank.die 自动脱离⇒⑥-1/2 红; N4 摘 modeLine 门⇒⑦-1 红; N5 警告恒隐⇒⑤-1 红; N6 摘 Bot 弃车⇒④-2 红; N7 摘舰艇弃船⇒④b-1 红; N8 页签钉反转(标签改名)⇒页签序红; 恢复类(②-1/③-3/⑥-3/⑦-3/4)NEG 下仍绿 ✓。**判据跟码修钉**: verify-specview-20261101 T22 顶栏观战词条源码钉跟新为带 SHOW_CTL_HINTS 门的新表达式(本批把该行纳管, 修后 **48/0**); run-all r1 80/89=naval×4(在案预存红线7)+specview×4(本判据跟走项, 修后单跑 48/0)+botai×1(在案偶发, 复核 0/0/0); r2 80/86=naval×4(预存)+matseam×1(在案偶发, 单跑 44/0; r1 的 botai 偶发未复现 53/0)——两轮偶发互不同同在案模式, **零新增红, 唯一稳定红=naval 红线7**。
8. **版本戳** 20261108d→**20261109a**(index.html ×50+`__sfStyleVer`+`_game_files.txt` ×46+16 戳钉探针随升, node 整文替换; **_game_files.txt 最初漏扫** —— 戳钉对账清单除探针外必须含 _game_files.txt, 本批由 timestophud 探针的 46 行断言兜住补扫)。
9. **实机关注**: ①坦克/两栖车被打到 <10% 血: 车体起火(火苗+点燃周围植被)+屏中红字警告, ~10s 内烧毁(其间照常可被打); 烧毁后转残骸火源照旧; ②飞机 <10% 冒火粒, ~10s 内坠毁; ③Bot 坦克残血起火后乘员应立刻下车跑路, 舰艇乘员落水弃船; ④游戏设置页序: 操作方式→语言→性能与画面→游戏内容; ⑤游戏内容设置两新钮: 「游戏中显示详细操作」关掉后 驾驶载具/炮位的键位明细行/右下兵种键位表/顶部模式说明/部署页键位提示全消失, 但"F 进入坦克""F 补充弹药"仍在; ⑥「自动脱离载具」打开后车毁瞬间应落在车旁存活(飞机=跳伞), 舰艇照旧弃船; 默认关时照旧车毁人亡; ⑦EN 界面两新钮+起火警告词条显示正常。

## 一.104 性能与画面批: 主菜单新子面板 × 画质迁入 × 五性能旋钮单源落地 (2026-11-08, 待实机验收)

承用户两问一令: 「现在画质的三个选项是否是实际上处于脑死亡的状态? 如果是的话, 就优化一下」「我希望有一个和"游戏内容设置…"同级的"性能与画面…"的选项卡, 先把画质选项放进去, 再另外加几个影响性能消耗和画质的选项」。**调查结论 (双探索子代理全库扫 + 关键链亲读核实): 画质三档不是脑死亡** —— `sf_qual→SETTINGS.quality` 共 11 处真实读取点: 02-scene `applyQuality`(像素比上限 1/1.5/2·阴影视锥 42/60/80·贴图 1024/1536/2048·软硬阴影·CSS 滤镜)+`dryFogFar`(雾距 240/340/420)+`shadowRefreshTick`(高画质逐帧/低中半频), 22-hud 水下雾 9/15/21, 04b-fire 燃烧火星 q≥1 门控, 08-effects 爆炸余烬/冲击波/滞留烟 q≥1/q2 分档, 05c/04b 植被树草密度(建图期)。**体感弱的真因**: 同 dpr 屏幕低/中档像素比无差 + 植被密度只重建地图后生效 + 面板零说明。本批把"优化"落在: 迁入新面板+逐项说明+新增五个真旋钮。

1. **新面板 `#mPerfGfx`**(index.html 静态段, 照 mGameplaySet 抄): 「⚙ 性能与画面...」入口钮落 mSet 画质原位(与 🎮 游戏内容设置 同级同款); **画质三连钮整段迁入**(qualBtn class 不动 ⇒ 22-hud `querySelectorAll('.qualBtn')` 接线与暂停菜单 pauseQualBtn 同步链零改动); 六节各带 `data-i18n-html` 说明行(画质档影响面逐项列出+植被"重建地图后生效"注记); **showPanel 硬编码表(22-hud:1637)加 'mPerfGfx'**(不注册不显示); style.css 零改动(全用现成 .mSub/.secLabel/.rowFlex/.optBtn 类)。
2. **五旋钮单源落地**(档位值单源=00-config 步进表 `RENDER_SCALE_STEPS/VIEWDIST_STEPS/FXMAX_STEPS/PRECIP_MUL_STEPS`; **存档存档位号非值**——步进值将来调整不破老存档; 载入三态=null 判没存过/合法写入/非法回落, 与 sf_aim 同规): ①**渲染缩放** `sf_rscale`(100/85/70/55%)→applyQuality `setPixelRatio(画质档上限×用户档)`(dpr2+中画质+85% 实测 1.275) ②**阴影刷新** `sf_shfrq`(跟随画质/逐帧/半频/¼频/关)→shadowRefreshTick mod-N 档位化(-1 跟随=旧行为逐位: q2 逐帧·q0/q1 半频); **"关"走新单源门 `sunShadowAllowed()`**——压住三处 `sun.castShadow` 重写点(02-scene 建灯/applySceneEnvironment/08-effects initWeather), 旧口径三处内联改一处漏一处就会被换天气复活 ③**视距** `sf_vdist`(标准/近×0.8/更近×0.6)→dryFogFar 末尾乘子(水下雾基准/雾色自动继承; AI 索敌不在此函数不受影响) ④**特效粒子** `sf_fxmax`(280/140/560)→PARTICLE_MAX const→let+新 `applyFxQuality()`(调低瞬间回收超出, spawnP 既有 per-spawn 上限照常兜底) ⑤**降水密度** `sf_pmul`(×1/×0.5/×0.25)→initWeather 雨/雪两分支 `n=round(precipN×mul)`, 点击重调 initWeather 重建池。五钮全走 aimAssistBtn 单钮循环模式(点按循环+即时落盘+apply+文案 t() 同步)。
3. **判据**: 新 `dev/verify-perfgfx-20261108.js`(verify-perf 同款轻量 boot 不开局; renderer 桩窄扩展 setPixelRatio 记账+getPixelRatio 回读) **正向 48/0**: T0 载入对账/T1 源码防回退 16 钉/T2 戳/T3 存档三态/T4-a 缩放三态(含 dpr2 相乘)/T4-b 雾距比值/T4-c 节律计数(半频 8 帧 4 次·¼频 8 帧 2 次·castShadow=false 应落帧位不置)+关档门(sunVis 驱动不依赖沙箱图默认天气)+复活钉/T4-d 粒子调低立即回收(200→140→240 账)/T4-e 降水重建比值(**bootstub THREE 桩 position.count=数组长 3×, 比值断言免疫桩差**)/T4-f 五钮点击链三账同步+回绕。**NEG 6 补丁 18 红逐名对认**(全单行锚): N1 摘缩放乘子⇒T4-a2/a3/f1+钉红; N2 摘视距⇒b1/b2+钉; N3 节流恒逐帧⇒c1(次=8)/c2(次=0)+钉; N4 摘裁剪⇒d2(n=200)/d3(n=280, 既有 per-spawn 上限兜住≠240)+钉; N5 摘降水⇒e2/e3(恒 1260)+钉; N6 摘关档早退⇒c6/c7(换天气复活实锤)+钉; 恢复类全绿。**判据跟码修钉**: verify-perf T1 三钉+两行为断言跟新 shadowRefreshTick mod-N 新体+补夜间跳过行为钉(t1d), 修后 **35/35**。
4. **排除项(裁定记录)**: AI 视距/感知频率**不进面板**(动 gameplay 平衡, 非画面旋钮); 灯池滞回 75/85/110 魔数收编+动态灯档**另批**(夜图限定+需先单源化); antialias/camera.far 不暴露(重建 WebGL context/牵动天穹与阴影投影)。
5. **run-all 两轮**(在册 83 跑次): r1 **79/83**·r2 **79/83**, 唯一非零=verify-naval(在案稳定预存红线7, 两轮 3/3 复跑同账)——**零新增红**。verify-text(新增 27 i18n 键闭环)/verify-perfgfx/verify-perf 均 exit=0。
6. **版本戳** 20261108c→**20261108d**(index.html ×50+`__sfStyleVer`+`_game_files.txt` ×46+14 戳钉探针随升, node 整文替换; **git grep 只搜已跟踪文件**——升戳清单须 `grep -rl` 全列, 本批 14 个戳钉探针多未跟踪, git grep 漏后 grep 补扫齐)。
7. **实机关注**: ①主菜单 游戏设置→「⚙ 性能与画面...」: 画质三档+五旋钮逐档点按均即时生效(植被密度除外=下局生效); ②渲染缩放 55% 档画面变糊+帧数显著上升(低配机最大头); ③阴影刷新=关 后回战备大厅换天气, 影子不应回来; ④视距"更近"档大图远景提前入雾但 Bot 照常索敌; ⑤暴雨+降水密度"极简"雨丝明显变稀; ⑥EN 界面 PERFORMANCE & GRAPHICS 等新词条显示正常。

## 一.103 瞄准吸附×爆头批: 双靶点判定×设置迁入游戏内容设置 (2026-11-08, 待实机验收)

承用户两项(讨论确认后落地): 「把瞄准吸附的选项放入游戏内容设置」「优化一下吸附的判定, 现在总是无法爆头, 明明瞄的很准」。

1. **②爆头判定修复(病根实锤, 本批核心)**: 吸附对每个士兵只有**胸口一个靶点**(y+1.10, r=0.45), 而爆头命中几何是头部球(站立 eyeY+0.06=y+1.68, r=0.26, raySoldiers 13-combat)——瞄准站立敌人头部时射线在胸球外 0.13m ⇒ over>0 ⇒ "已指着本体不动"守卫不生效 ⇒ **被向下掰 0.29k 米(与距离无关)**: 轻度 0.21~0.24m 逼近球半径 0.26(散布一抖即死)/标准档 0.28~0.33m 直接超出 ⇒ 站立敌人任何距离都爆不了头; 蹲/卧敌人的头在胸球内(0.65~1.55 罩住 1.21/0.56)反而没事——与用户体感"总是无法爆头"特指站着的人吻合。**修(B 方案, 两选项讨论后用户拍板)**: 士兵改**双靶点**(①爆头球, 与 raySoldiers 命中几何同位同径: 站1.68/蹲1.21/卧0.56, r=0.26 ②胸口旧行为)+**暂存槽末尾统一裁决**(gA/gO 六槽+aaOn 旗, 零分配; 必须暂存: 瞄胸时头球 over>0 会先抢注全局绕过守卫)——头/胸任一"已指着"(over≤0)⇒ 整兵不掰(吸附绝不与爆头瞄准对抗, 保"起点→准星命中点"契约即 specthird T6 口径); 差一点打中头 ⇒ 掰向**头部**(落点进球 35% 深=距球心 ~0.09m=真爆头); 差一点打中身体 ⇒ 掰向胸口(旧行为不变)。人体遮挡检查扩展 'solHead' 档(bTag 判据改双串)。业界口径佐证(GDC 主机辅助瞄准设计): 辅助瞄躯干但**绝不把瞄头的枪拽离头部**——旧实现恰好违反后半句。
2. **①设置迁移**: 瞄准吸附档位钮从游戏设置(mSet)迁入「游戏内容设置」(mGameplaySet)面板顶部, 改面板同款**单钮循环**(🎯 瞄准吸附: 轻度, 点击 关→轻度→标准→关; sel 态=非关档; t() 词典键'瞄准吸附'/'关'/'轻度'/'标准'全在册); 22-hud 接线移入 initMenuUI 的游戏内容设置开关段(expBtn 同段, syncA 惯例), 旧 .aimBtn 三钮接线+初值同步两处删; 游戏说明"游戏设置内"→"游戏内容设置内"+补"已瞄着头或身体时绝不掰动 (不抢爆头)", i18n 两键(面板说明键串变更+说明键串变更)同步。
3. **判据**: `verify-aimassist` **46/0**(原 40+新 T8 六条: ①瞄头守卫=正对爆头球心原样返回 assisted 不动(旧病根回归钉, 撤头球测试或守卫必红) ②瞄头直射 isHead 透传(damage 第三参 spy) ③差一点打中头(头顶 0.35m, over≈0.08°)⇒ lastTarget='solHead' ④落点对球心最近距离 0.196m<0.26 ⑤★★真伤害入口救援弹 isHead=true ⑥瞄胸照旧 lastTarget='sol' 头球不抢候选; 选点比 T2 多一道头高射线通查(openSpot 只保胸高)); T7 判据跟走: hud 钉 'aimAssistBtn'+html 钉面板位置(id 在 mGameplaySet 之后+旧 data-a= 绝迹); 本文件沿惯例无 NEG 桩, T8① 即回归钉。`verify-specthird` **59/0**(T6 轨迹契约守卫零波及)。**run-all 一轮 78/91 exit=0**: 红账四条全归因——①verify-spec=并发 specsniper 批(一.102, 免验证轮)滞留钉 rpm===300, 本批代跟走 300→600 后 **60/0**; ②verify-parity-20261103=本批升戳清单漏钉(20261108b→c 补扫)后 **51/0**(教训: 升戳清单必须按 `grep -rl` 全列逐个过, 不凭记忆列); ③verify-naval=在案稳定预存红线7; ④_audit-foliage-ref=在案偶发(复核 0/0/0)。**行为面零新增红**。戳钉七连检(hudfix/perf/animfix/loiterfreeze/timestophud/crushhead/fieldfix)全绿。
4. **版本戳** `20261108b→20261108c`(index.html ×50+`__sfStyleVer`+`_game_files.txt` ×46+13 戳钉探针随升, node 整文替换——fixbatch 文件名注释型历史伪影同规随走)。
5. **实机关注**: ①瞄准吸附开关在 游戏设置→游戏内容设置 面板第一位, 单钮点击循环三档, EN 界面显示 AIM ASSIST: Light 等; ②轻度/标准档瞄站立敌人头部开枪应能爆头(击杀播报 ☠), 标准档尤其(旧版任何距离都爆不了); ③瞄头时准星不应感觉"被拽向胸口"; ④瞄身体差一点时依旧被轻轻掰中(旧行为); ⑤蹲/卧敌人爆头与旧版一致; ⑥隔墙/队友挡道仍不吸(T3 口径)。

## 一.102 观战连狙手感二改: 腰射散布×射速 (2026-11-08, 待实机验收)

承用户实机:「不开镜散布太大太大, 射速只有我预想的二分之一」。specsniper 两数值: spreadHip 4.2→1.0(旧值居全库步枪带中游 2.5~6, 狙击枪腰射理应远紧; spreadAds 0.05 不动)+rpm 300→600(唯一消费点 20-player fireT=60/rpm, 无隐藏减半系数, 翻倍即实测翻倍)。用户令免验证轮, 仅 node --check+升戳。**版本戳 20261108a→20261108b**。

## 一.101 时停HUD批: 时停中小地图/罗盘随观察者重绘 (2026-11-08, 待实机验收)

承用户实机一项: 「现在时停状态下地图不会更新, 我觉得这不合适」。**病根**=updateHUD 的 10Hz 低频段(小地图/罗盘/顶栏票旗/大地图, 22-hud hudSlowT 节流)旧吃**世界 dt** —— 时停 dt=0 ⇒ `hudSlowT-=0` 永不归零, 段内一切停绘; 而观察者本人仍在走动/飞行(2026-09-27 裁定「冻的是战场不是观战者」), 小地图/罗盘恰恰是"跟着观察者转"的显示 ⇒ 冻结期导航全瞎。与 2026-09-27M 同族病的另一面: 当时把时停读数 #specTimeInd 从这段摘出来逐帧画(探针 T7), 这批把这段本身解冻。

1. **修法两行**(零新增字段): 24-main `updateHUD(dt,pdt)` 传**观察者帧长**(pdt 已有单源: 时停=真实帧长/指挥超人档豁免减速, 非时停 pdt≡dt ⇒ 普通战斗零漂移); 22-hud 节流钟 `hudSlowT-=(pdt===undefined?dt:pdt)`(单实参旧调用/旧探针直调退化 dt, 与 T7 旧口径逐位兼容)。段内世界数据(兵力/旗点/时钟)冻结时值本就不变, 重绘走 hudText 指纹去重, 无副作用; 大地图 M 不涉(本就 alive 门, 观战者开不了)。
2. **判据**: 新 `dev/verify-timestophud-20261108.js` **正向全绿**(②时停中转观察者 40 帧 小地图/罗盘各重绘 5 次·旧写 0 次/③非时停节流照常/④单实参 updateHUD(0) 依旧不重绘=旧口径零漂移/①源码钉+戳)+**NEG 3 补丁 5 红逐名对认**(N1 节流行还原 ⇒ ②行为级亲见 次=0; N2 主循环实参还原/N3 签名摘 pdt ⇒ 源码钉红, N3 兼 ②红; ③④恢复类在 NEG 下仍绿)。桩坑复踩复用 timestopfix 同款 patchStyle(hudStyle 自定义属性)。
3. **回归**: verify-timestopfix 35/0(T7 时停读数逐帧口径不受影响)+hudfb 64/0(单实参调用全兼容)。**套件登记补漏**: run-all 系手工策展清单——上批 loiterfreeze 漏登(上批"72 探针"未含自家新探针), 本批 catch-up 补登+timestophud 随批登记 ⇒ 在册 80 条。**run-all 两轮**(80 条): r1 82/88=naval×4(稳定预存红线7)+nav×1/botai×1(偶发, 复核各 3/3 绿, 均在案)+两新探针 0; r2 78/82=仅 naval×4——**预存红账零新增**。**版本戳 20261107a→20261108a**(index.html ×50+__sfStyleVer+_game_files.txt ×46+13 戳钉探针随升)。

## 一.100 巡飞弹操控定身批: 本体冻结×退场吞空格×小地图弹体中心 (2026-11-07, 待实机验收)

承用户实机四项: ①「悬浮状态下操纵巡飞弹时按空格加速会使得本体上升。如果在地上会让本体不停跳跃」②「H键飞行+按空格加速的情况下发射巡飞弹, 巡飞弹视角内自己一个人向前飞出」③「操作巡飞弹的时候玩家无法行动(无法转向、移动等, 仍会正常受伤和受重力影响下落, H键飞行自动切换为悬停)」④「不按M展开大地图时仍能显示巡飞弹; 操作巡飞弹时小地图以巡飞弹为中心」。**①②同根**=updatePlayer 制导分支旧写 `spectator&&flying` 继续跑 specFlightMove 消费同一份输入(悬停空格=本体上升/气动空格=沿视线40m/s前飞); **③在地上连跳的真身=操控退场瞬间仍按着空格**(诊断探针实测: 操控中弹活着时步行态不起跳, 弹死/引爆后残空格在步行态反复起跳 vel.y=+4.6 循环)。裁定③落地为**操控定身**: 输入全灭只冻操作不冻结算。

1. **定身冻结**(20-player 制导分支): 悬停态(flying)原地悬停——三轴速度阻尼归零/无重力/不积分位移, 步行态走既有重力链照常下落(受伤/回血/回体照常); 旧 specFlightMove 机动分支删除。
2. **气动→悬停就地切换**(13-combat fireLoiter): `shooter.flying&&shooter.flyAero` ⇒ 切悬停+vel 清零+_aeroSpd 清零(退场后再按 H 从巡航 13 起步)。**退场吞空格边沿**(detonate+despawn 两处清账行): `player._ltSpace=!!keys.Space` —— 退场瞬间按住的空格, 松开前不吃残跳/残升/残加速; `_ltSpace` 清零上提到 updatePlayer 帧首(原在制导分支内, 退场后没人清); 三处消费点加 `!p._ltSpace` 门: 跳跃(1165)/悬停升+自由飞行升(specFlightMove+specViewMove ty+=1)/气动加速(40 档)。**C/Z/X 姿态键**(19-input)加 `!player.loiter` 门(撑枪/蹲/趴=身体动作; 武器键不动)。
3. **小地图弹体中心**(22-hud drawMinimap+海军包装层同布两处): 操控中 cx/cz/rot 跟弹体(pos/yaw); 弹体菱形标记(#3ee8d8, 与大地图同款缩配 9px)**常显**(不开 M 也可见); 本体箭头从钉死 (half,half) 改 toMap 实际位置+`rotate(rot-player.yaw)` 相对朝向(未操控时位移/旋转均零=逐位等价); 机器箭头 rot 消费改单源 rot 变量。面板提示追加「本体定身」(i18n 键随更)。
4. **判据**: 新 `dev/verify-loiterfreeze-20261107.js` **正向 29/0**(②悬停 90 帧 Δy=0.00 旧写+12.96/③气动发射即 flyAero=false+|v|=0+60 帧位移 0.00m 旧写 36.43m/④引爆后按住空格 90 帧不起跳+松开重按恢复/④b 悬停残升同构/⑤普通跳·悬停升·气动加速三回归 0 漂移/⑥drawMinimap 操控中冒烟/①源码钉+戳)+**NEG 9 补丁行为级亲见转红**(N1 Δy=12.96/N2 d=36.43/N3+N4 jumped=true/N5 松开跳不了/N6 Δy=9.75/N7-N9 源码红)。**判据跟码修钉三处**: loiterview N2 锚(清账行加吞边沿)、flyaim 气动加速行锚+面板/i18n 两判据、**verify-spec T2**「气动飞行延续」→「悬停延续」(气动中发射即切悬停是裁定直接结果, T 弃弹延续悬停态)。
5. **run-all 两轮同账 72 探针**: 失败各 2=verify-spec×1(旧判据, 修后 60/0×3)+naval 红线7×1(预存, 复核对认一致)——**预存红账零新增**。**版本戳 20261106b→20261107a**(index.html ×50+__sfStyleVer+_game_files.txt ×46+12 戳钉探针随升, 旧戳全库绝迹)。诊断探针两枚(悬停上升/气动前飞/地上连跳三症状复现)用毕即删。

## 一.99 巡飞弹退场朝向二次裁定批: 引爆/消失后本体=发射时朝向 (2026-11-06, 待实机验收)

承用户二次实报（一.96 ③的补全裁定）：「现在巡飞弹引爆/消失后玩家的朝向仍然是巡飞弹最后的朝向，而非发射时的朝向。」一.96 批按"退出画面不跳"旧意实现的**退场一次性对齐**（loiterDetonate/loiterDespawn 清账时把本体角对到弹体末态）被本裁定推翻——**本体朝向不被弹体污染**优先。修=两处清账行拆到只剩 `player.loiter=null`（13-combat detonate+despawn 两处）：制导中不回写（一.96 ③）+ 退场也不写（本批）⇒ 本体角自发射起纹丝不动，引爆/静默消失/T 弃弹三路退场一致停在**发射时朝向**；退场瞬间视角从弹体末向跳回本体 = 裁定直接结果（有意为之）。specTeleportToLoiter 注释同步改口径（视角朝向=发射时朝向，位置传送/速度清零/落地保护语义不动）。

1. **判据跟码修钉两探针**：verify-loiterfix L1 `exitAligned`→`exitKept`（detonate 后本体角仍逐位=发射时 bodyYaw0/bodyPitch0）；verify-loiterview T2 退场断言 `yawAligned/pitchOk`→`keptYaw/keptPitch`（走 loiterDespawn 静默消失路；L1 走引爆路 ⇒ 两退场路径都有判据）。**N2 阴性补丁反转成注入式**——旧"拆除式"在拆无可拆后必须反转：把 11-05 病灶行原样注回两处清账行 ⇒ keptYaw/keptPitch 翻红 + 绝迹钉 ×2，`--only=N2` 单补丁亲验恰 2 红对认（NEG 补丁语义=病灶复现，不是机械取反）。T5 绝迹钉升级为全 13-combat 绝迹（`player.yaw=d.yaw` ×0）。
2. **探针脆化修复三则（12 连跑 0 红的代价）**：①**前置采样点**：旧版 T1 在窗口末尾才采 player.loiter ⇒ 窗口内被清账时前置假红，改**出膛即采样** + 诊断字段（loiterEnd/dDead/dPos/aliveEnd/mouseEnd，假红自辨）；②**探针围栏必须在 fireLoiter 之前**：`d.pos=origin.clone()` 出膛即定 + **弹道=shooter.yaw/pitch（fireLoiter 忽略 dir 参）** ⇒ 围栏放 fire 之后防不住首帧；**OOB 出界分支不受 grace 豁免每帧都查**（MAP_SIZE=320 ⇒ 边界 158），随机部署点贴图缘 + 朝外随机朝向 ⇒ 弹体出界被静默清账（T1 观战 despawn ×4 红）/静默引爆（T3 detonate→damageStructures→ragInit 桩缺 CANNON.World 崩 EXC，实录各一）——修=T1 贴缘钳制 / T2·T3 图心传送全部前移到 fire 之前 + grace=9999/life=9999；③弹道方向真相：fireLoiter 的 dir 参不决定飞行方向，探针不能假设"朝 -Z 飞"。
3. **并发协同实录**：另一会话 一.98（飞行瞄准×改键批）与本批同树并行——升戳 20261106a→b、单写者行纳入 lz 开镜门（布尔方向 `(!loiterView||lz)`=一.98 教训②）、灵敏度跟 fov；本批 T5 单写者钉/N4b 阴性锚两度跟码修钉。**verify-loiterview 正 34/0 ×12 连跑 · NEG 5 补丁 13 红对认 · --only=N2 单补丁 2 红亲验 · verify-loiterfix 18/0**。**run-all 两轮=合并树（含 一.98 改动）**：首轮 80/86 exit=0（naval ×4 稳定预存红线7；zombie ×1 偶发=module load 环境崩在案模式 + fieldfix ×1 偶发，均套件复核 0/0/0）；次轮 78/86 exit=0（naval ×4 稳定复核 1/1/1；fieldfix/botai 偶发各 ×1 复核 0/1/0）——**稳定红唯一=naval 红线7，预存红账零新增**（86 项含 一.98 新探针与失败项自动复核连跑；一.98 item9「待填」同读此合并树两轮）。
4. **实机验收关注**：TV/背追视角里转向全程本体纹丝不动（WASD 移动也按发射朝向走）；引爆/出界静默消失/T 弃弹三路退场后玩家朝向都=发射时朝向（视角从弹体末向跳回本体——有意设计）；T 弃弹的落点保护/速度清零语义不变。

## 一.97 实机反馈三虫批: 第三人称手电光锥锚定 × 巡飞弹TV视角本体在场 × 圆柱顶端站立 (2026-11-05, 待实机验收)
承用户实报三件：①「开着手电筒的时候切换第三人称，会使得光锥漂移到某个地方去」②「在巡飞弹视角中无法看到玩家本体」③「现在很多圆柱体的顶端无法被站立，一上去就会被挤开」。三修全单源、不动既有契约：
1. **手电光锥前漂 11m（①病根=fz 实参语义误读，一.95 批新写的士兵锥两处调用全中）**：`truncateConeMesh(cone,baseL,occD,fz)` 的 fz 是**锥父空间里灯口的前向偏移**（车灯链传 `veh._hl.fz`=灯口在 grp 前方的偏移量），锥体几何以中点居中 ⇒ 内部 `position.z=fz+effL/2` 恰使顶点落在灯口。士兵灯体就是 flGrp 原点 ⇒ 应传 **0**；一.95 批新写的 20-player 玩家 avatar 与 14-bots Bot 两处调用把"满长静止位 position.z=baseL*0.5"误当 fz 传入 ⇒ 顶点恒被抬到灯口前 effL/2、满长整体前漂 baseL/2=11m（flConeL=22）且截断时"起点悬空+长度不缩"双错——第一人称的 VM 锥（08-effects 自带锚定）是对的，所以只有切第三人称才看见"光锥漂到别处悬空"（用户截图：锥体悬在坡外半空）。修=两处实参改 0（truncateConeMesh 单源语义不动）。判据=运行期不变量 `|position.z−scale.x·baseL/2|≈0`（对任意遮挡档位成立，旧写法恒差 baseL/2=11 必红），玩家/Bot 双调用方各测。
2. **巡飞弹TV制导视角本体消失（②病根=显示链单点漏接）**：updateCamera 顶部每帧 `playerAvatarHide()`（防所有提前 return 分支留残影），而 `updatePlayerAvatar` 只在步行第三人称分支（thirdPersonCamera）被调 ⇒ TV制导分支提前 return 后本体在世界里恒隐，弹体回看发射位只剩空地（调试观战悬停引导时尤常用）。修=loiter 分支 return 前补 `updatePlayerAvatar(dt)`：本体照常摆姿态钉在发射位、TV 相机仍在弹体上、TV 画面取向零变化；附身视模式（specViewHost）在 updatePlayerAvatar 内部自门仍恒隐，与第三人称分支同一套纪律。
3. **圆柱顶端站不住（③病根=圆柱只挂横推账、缺跨步豁免与支撑账）**：`_cmBoxCb` 有纵重叠 slack + `maxY−pos.y≤0.56` 跨步豁免两道门，`_cmCylCb` 只有纵重叠门 ⇒ 跳上桶/草垛/筒仓/水塔顶后脚下沉 0.2m 横推立即接管=被侧面挤飞；且 `standHeight` 只查盒（_shBoxCb）不查柱 ⇒ 圆柱顶面从无脚下高度，站上去也随即下陷。修=两处对齐盒语义：`_cmCylCb` 补 `c.y1−pos.y≤0.56` 跨步豁免；`standHeight` 补 `_shCylCb`（采样点在圆内 r+0.05 且顶面 ≤curY+0.55 ⇒ h=顶面）+ eachCylNear 接线。高柱（烟囱/水塔帽）跨步档外照常是墙、圆外采样不支撑（双对照断言钉住，豁免不误放行）；玩家借 standHeight curY=脚+0.6 的既有跨步档可跳上草垛档（与箱类同手感）。
**判据**：新 `dev/verify-fieldfix-20261105.js`（受控时钟直驱 loop()，桩与 一.95 探针同源）**正向 26/0**（T1 手电锥不变量玩家/Bot 双调用方+3P 灯组在场；T2 fireLoiter 后 avatar 在场/钉发射位/TV 相机在弹体；T3 跨步档不横推+柱顶支撑+圆外不支撑+跨步档外与高柱照常横推双对照；T5 源码钉 6+顺序钉+载入清单 46 项同序+戳）+ **--neg 5 补丁 11 红逐一对应**（对照组保持绿）。**run-all 两轮同账 76/81 exit=0**：唯一稳定红=`verify-naval` 红线7（预存，本批零海战改动）；偶发各一次且互不相同——r1 `_audit-foliage-ref`（复核 0/0/0+补跑 5 连绿；该审计自述"运行期碰撞走 BOXES/CYLS 与植被无关"，~1/20 采样偶发在案）、r2 `verify-botai-20261103`（复核 0/0/0）——预存红账零新增。**版本戳 20261105a→20261105b**（index.html ×50+`__sfStyleVer`+`_game_files.txt` ×46+九戳钉探针同步）；**并发批（一.96，同夜另一会话）随后按纪律升 20261106a 并对本批新探针同步重钉**——合并树复测：本批探针 26/0+NEG 11 红、一.96 探针 35/0、animfix 66/0、nightgear 41/0，两批零冲突（一.96 与本批同改 updateCamera loiter 分支：本批补本体显示、彼批删弹体 visible 双写改单写者，正交互认）。探针坑两则：**NEG 多行锚在混行尾文件必失配**（20-player 实测 CRLF/LF 混存，改单行锚）；**活战场上钉"开灯 Bot"须逐帧回血+重开灯+任一可见帧采样**（交战/阵亡会写 flashlight=false，die() 摘灯组）。

## 一.96 巡飞弹背追三虫批: 背追光柱锚弹体 × 弹体全视角可见 × 制导本体不随转 (2026-11-06, 待实机验收)
承用户 2026-11-05 深夜实报三件（附背追档截图）：①「手电筒打开状态下的背视角下的巡飞弹，光柱会保持在第一人称的相对位置，我希望把光柱的起点位置改为巡飞弹本身的位置」②「现在巡飞弹在其他视角下可见吗？我希望是可见的」③「现在巡飞弹视角内转向会带着本体一起转向，需要修复」。逐项落地：
1. **①病根=手电链不分档全按相机锚**：`08-effects playerFlashlightTick` 把真 SpotLight/近景溢光/丁达尔光柱全部钉在 `camera.position`+持枪偏移上、光柱朝向 `camera.quaternion` —— 而巡飞弹 F 背追档（`loiterView=1`，机位在弹体后上方 ~6.8m）下 `thirdPersonOn()` 被 `!p.loiter` 互斥门排除（返回 false）⇒ `tp=false`，光柱照常显示但起点/朝向全跟背追相机走（截图：光锥悬在弹体左上方，与弹体朝向脱钩）。修 = **ltBack 档**（正在操控巡飞弹 `player.loiter` 且 `loiterView` 真值）：手电整链锚弹体本身 —— 起点=弹体+弹鼻光学头罩前 0.4m、朝向=`loiterForward(lt)`（共享槽 `_loF` 立即拷入 `_pfF` 不跨帧持有）、光柱姿态 `rotation.set(lt.pitch,lt.yaw,0)`（锥体绕光轴旋转对称 roll 恒 0）、遮挡射线/SpotLight 照点/溢光全部从弹体起算。**TV 弹头档（loiterView=0）相机就钉在弹体上，维持相机锚零变化**（第一人称观感不变）。vm 灯 `vml.visible=!tp&&!lt`（制导中 viewmodel 整体是隐的，vm 灯同步熄）。
2. **②病根=弹体可见性三处零散写**：`fireLoiter` 出膛写 `mesh.visible=false`，全库唯一能翻回来的是 `updateCamera` loiter 分支（TV 藏/背追显），而那道分支的门是 `p.loiter&&p.alive` ⇒ **真观战（alive=false，票尽观战）自由视角与死亡镜头里弹体永隐**（fireLoiter 的 false 无人解）。F 背追档本来就可见（用户截图为证）。修 = **可见性收拢单写者**：`updateLoiters` 末尾 `d.mesh.visible=!(player.alive&&!player.loiterView)` —— 唯一隐藏态 =「镜头真的在弹鼻上」（玩家活着 + TV 档），其余一切视角（F 背追/本体第三人称/真观战自由视角/死亡镜头）一律可见；`fireLoiter` 初始值改同式（`!(shooter.alive&&!player.loiterView)`，真观战出膛即可见）；`updateCamera` loiter 两分支的 visible 写删除（20-player 绝迹钉）。
3. **③病根=制导期持续回写本体角**：`13-combat updateLoiters` 制导段 `player.yaw=d.yaw; player.pitch=...`（旧注释口径"本体姿态跟随弹体⇒退出 TV 视角画面不跳"）= 鼠标每转一点，发射者本体就跟着转一点 —— 本体第三人称/附身呈现层里看得见原地转圈，WASD 移动方向也被弹体朝向带跑。用户裁定推翻该口径（`verify-loiterfix-20260928` L1 旧正向断言"本体姿态跟随弹体"同批**判据跟码修钉**为 notFollowed+exitAligned 两条）。修 = 制导段回写两行删除；**"退出画面不跳"原意改为退场一次性对齐**：`loiterDetonate`/`loiterDespawn` 在 `player.loiter===d` 清账时把本体角对到弹体末态（`player.yaw=d.yaw; player.pitch=clamp(d.pitch,-1.45,1.45)`）—— 制导中本体纹丝不动，退场那一瞬才转一次（观感是一刀切不是持续跟转）；T 键弃弹传送的"视角朝向不变"语义不变（旧口径下"不变"的实际值就是弹体朝向，退场对齐等价实现，13-combat 定案注释已改写）。
4. **判据**：新 `dev/verify-loiterview-20261106.js`（复用 _bootstub 桩+受控时钟直驱 24-main loop）**正向 35/0**（T1 夜图调试观战：TV 档光柱贴相机 ≤1.0m 行为不变钉 → 背追档光柱起点距弹心 ≤0.6m 且距相机 >3m + 真 SpotLight ≤0.6m + 溢光随弹 ≤2m → 回 TV 再贴相机；T2 普通兵：3000px 增量掰弹体 |Δyaw|=0.0418/|Δpitch|=0.0318 恰为角速度上限截断值 + 本体角逐位不动 + loiterDespawn 退场对齐 player.yaw===d.yaw；T3 TV 藏/背追显/回 TV 再藏/alive=false 显四态；T5 单行钉 8+绝迹钉 3（updateLoiters 制导段无本体角回写/退场对齐恰两处/updateCamera loiter 分支无 mesh.visible 写）+清单 46 项同序+版本戳）+ **--neg 五补丁 13 红逐一对应**（N1→T1 背追四红/N3→T2 本体红/N4a+b→T3 两红+静态两红/N2→静态两红；累积应用时 N2 的行为级红被 N3 掩盖 —— 跟随行插回后退场前 player.yaw 本来就===d.yaw，故加 `--only=N2` 单补丁模式亲见转红 yawAligned=false ✓）；旧 `verify-loiterfix-20260928` 18/0（新判据下）。
5. **run-all 两轮对账**：首轮 **75/79 exit=0**（唯一失败=verify-naval ×4，稳定性复核 1/1/1=稳定失败，与 2026-11-01 起各批同一预存红红线7，本批零海战改动）；次轮 **76/82 exit=0**（naval ×4 同上 + **verify-fieldfix 偶发 ×1**——套件自复核 1/0/0 后两连过 + 单体连跑 4/4 绿：其 T1 是活战场采样（交战/阵亡摘灯组），与前批"r1 foliage-audit/r2 botai 偶发互不同"同一在案模式；本批改动不触其判据面——T1 无巡飞弹、T2 仅 TV 档相机锚路径本批零改动）。**预存红账零新增**。
6. **版本戳** 20261105b→**20261106a**（index.html ×50+`__sfStyleVer`+`_game_files.txt` ×46+十戳钉探针随升，老戳全库绝迹；本批新探针负向钉用 `!includes('20261105b')` 未随 sed——旧戳负向检查保真）。
6. **实机关注**：①夜图调试观战开手电发巡飞弹按 F 背追：光柱应从弹体鼻锥发出、随弹体转向而转向、不再悬在镜头前；②TV 弹头档光柱观感应与改前完全一致；③制导中持续大幅转向：本体（第三人称回看/附身画面）不再跟着转，WASD 仍按发射时朝向移动；④弹体引爆/T 弃弹传送/触物消失的瞬间视角切回本体时朝向=弹体末向（一刀切，不跳回发射时旧向）；⑤票尽真观战发巡飞弹：自由视角里弹体模型应可见（旧版隐身）。

## 一.98 飞行瞄准×巡飞弹改键批: 观战飞行右键可瞄准 × 气动/巡飞弹加速改空格 × 巡飞弹 F→U+右键开镜 (2026-11-06, 待实机验收)

承用户两件需求（讨论轮四项裁定后定稿）：①「我希望H键飞行和双击空格键的飞行的时候，右键也能瞄准。同时将H键飞行时的加速功能从鼠标右键改为空格键」②「将巡飞弹飞行时的加速键也改为空格，切换视角的按键改为U，右键功能改为画面局部放大（方便瞄准），局部放大时固定为第一人称（机制类似于玩家第三人称时瞄准）」。四项裁定：放大形态=**全屏开镜式**（非画中画，与步兵 ADS 同款 fov 链）；放大交互=**按住右键**（松开恢复）；气动中双击空格切悬停**保留**（用户自选，接受快速连按补加速的 300ms 双击窗误触）；开镜画面配套=**保持现有 TV 滤镜+准星**（不加十字分划）。键位终局表：气动飞行=右键瞄准/空格加速；悬停飞行=右键瞄准/空格上升不变；巡飞弹=空格加速/右键开镜+强制第一人称/U 切视角/左键自爆不变/F 无操作；步行全不变。

1. **观战飞行右键=瞄准（病根=ADS 门写死 `!player.flying`）**：`19-input mousedown` 右键 ADS 门、触屏 `24-main tAds`、手柄 `19b padAds` 三处同门摘 `!player.flying`（保留 `!player.loiter`——制导中右键=开镜不是武器 ADS）。瞄准链零新增代码：`thirdPersonOn()` 本就排除 `p.ads` ⇒ 飞行中 U 开了第三人称时按右键自动切第一人称、松开自动回第三人称（与步行同机制）；fov 收窄走 updateViewModel 既有 `lerp(74, curW.adsFov)` 链、灵敏度走 `lookZoomMul` 既有单源；观战连狙（副武器）4x 镜在飞行中照常可用。悬停飞行 Space=上升与双击开关语义不动（用户裁定保留气动中双击切悬停）。
2. **气动加速 右键→空格**：`20-player specFlightMove` aero 分支 `(mouse2Down?40:13)` → `(keys.Space?40:13)`（13→40 dampF 参数不动）。触屏跳跃钮/手柄 A 键本就走 `kd('Space')` 键盘同链 ⇒ 两平台**自动获得加速**，零适配代码。
3. **巡飞弹加速 右键→空格 + `_ltSpace` 吞边沿**：`13-combat` boost 判定 `mouse2Down&&!player._ltRClick` → `keys.Space&&!player._ltSpace`；`fireLoiter` 置 `player._ltSpace=!!keys.Space`（发射瞬间空格按住——跳跃中发射场景——不继承加速，完整松开一次后生效，与 `_ltRClick`「按住右键机瞄发射」同构）；清账点=制导分支 `if(!keys.Space) p._ltSpace=false;`（与 `_ltRClick` 清零同点同构）。**零新增状态字段的清账义务**：退出制导后残留旗无害（boost 判定门 `player.loiter` 短路，下次发射重置）。
4. **巡飞弹视角切换 F→U**：`19-input` KeyU 行插 loiter 门（`if(player.loiter){loiterView 翻转+AudioSys.click} else if(player.onNaval) navalCycleView(); else toggleThirdPerson();`——loiter 与座位互斥，门序放最前保险）；KeyF 摘 loiter 分支恢复纯 `tryInteract()`——其第一行 `if(!player.alive||player.loiter) return` 恒吞制导中按键，无任何误交互（补给箱/上炮/登舰全在 tryInteract 内部，逐条核过）。
5. **右键=全屏开镜放大（复用旧 boost 判据位，零新增状态字段）**：开镜判定 `lz = mouse2Down && !player._ltRClick`（与旧加速判定完全同构——天然吞掉「按住右键机瞄发射」的边沿：机瞄中发射不进开镜，完整松开再按才开镜）。`updateCamera` loiter 分支：视角档 `third = lz?0:p.loiterView`（**放大强制第一人称**，机制同步兵第三人称 ADS），fov 目标 `tgtFov = lz?LOITER_ZOOM_FOV:(third?70:85)`（新常量 `LOITER_ZOOM_FOV=30`≈2.8x，与 NAVAL_SCOPE_FOV 同区），两档 dampF 平滑过渡、松开恢复原档；**弹体可见性单写者判据纳入开镜态**（13-combat `d.mesh.visible=!(player.alive&&(!player.loiterView||lz))`——否则第三人称档开镜时弹体模型在相机前 0.5m 糊脸；一.96 批单写者契约保持，隐藏态从「TV 档」扩为「TV 档或开镜中」）；TV 灵敏度 `sens` 从写死 `*(85/74)` 改 `*(camera.fov/74)`——开镜收窄时灵敏度等比缩放，fov 阻尼过渡中手感连续。左键自爆/触碰引爆/寿命/T 弃弹传送全不动；开镜时 TV 滤镜+中央准星照常（用户裁定不加十字分划）。
6. **观战飞行+制导并存自洽**（观战气动飞行中发射巡飞弹的既有能力）：空格=本体气动加速+弹体加速同时（与改前右键同时加速行为对齐）；右键=开镜优先（ADS 门保留 `!player.loiter`）；U=切弹视角优先（loiter 门在 KeyU 首位）；相机=loiter 分支在 updateCamera 最前。
7. **文案全库同步**（grep 盘清 13 处）：气动飞行弹窗/顶栏观战+调试提示（含 EN 侧）/实验模式说明（i18n :345 + index.html :373）/调试+观战模式说明段补「两种飞行中左键都能开火 · 右键都能瞄准」/巡飞弹弹药面板提示 →「空格 加速 · 右键 开镜 · U 切换视角」（22-hud :1086 + i18n :100）；中文原文即键——新键配新 EN 条目、孤儿旧键清理。
8. **判据**：新 `dev/verify-flyaim-loiterkey-20261106.js`（verify-parity 同款 boot+**注入可记录 addEventListener/dispatchEvent 桩走真键鼠处理链**——keydown/mousedown/mouseup 事件级测试；弹体与玩家全程抬高空 heightAt+80 避开命中检测干扰）**正向 32/0**（源码防回退 17：三门无 flying/KeyU 门序/KeyF 纯交互/fov 双写点 tgtFov/boost+吞边沿三行/灵敏度/可见性/i18n 新旧键/戳；行为 15：Space 45 帧 aeroSpd 13→34.8 而右键恒 13/dispatch 飞行右键 ads=true+mouseup 复位/thirdPersonOn 门/KeyU 翻转 0→1→0/KeyF 无操作/巡飞 Space 45 帧 spd→34.8/发射瞬间按住空格吞边沿 45 帧恒 13/updatePlayer 真实清账路径松开恢复/开镜 fov 70→30.2/相机贴弹鼻 0.50m/开镜中弹体隐藏/松开恢复第三人称档 loiterView 不被改写）+ **--neg 14 补丁 24 红**（红名逐条对认：源码 13+行为 11；恢复类断言 ⑥-4/⑥-8/③-2/i18n/戳在 NEG 下保持绿=对照组）。**探针教训**：①本批实锤「Edit 批量多连发漏一处」——19-input ADS 门 Edit 漏发，探针 ①/③-1 红+用户实机「飞行中右键无效」三方互相印证后补发；②可见性判据布尔方向写反（`!(loiterView||lz)` 与 `(!loiterView||lz)` 语义相反）被 ⑥-7 抓出当场修；③⑤ 清旗账在 updatePlayer 制导分支而非 updateLoiters——只跑 updateLoiters 的探针测不到「松开恢复加速」，改走 updatePlayer(1/60) 真实路径。
9. **run-all 两轮**：首轮 **78/83 exit=0**、次轮 **78/83 exit=0**（同账同数）——稳定失败仅 `verify-naval` ×4（复跑 1/1/1，2026-11-01 起各批同一预存红红线7，本批零海战改动）；两轮偶发各一次且互不相同（r1 `_audit-foliage-ref` / r2 `verify-aimassist`，各自复核 3 连 0/0/0=在案环境抖动型，与 一.97 批"r1 foliage/r2 botai 互不同"同一模式）；本批新探针入册两轮均 [0] 全绿 32，**预存红账零新增**（与 一.96 会话同树并行，run-all=合并树口径）。
10. **版本戳** 20261106a→**20261106b**（index.html ×50+`__sfStyleVer`+`_game_files.txt` ×46+13 戳钉探针文件 node 整文替换随升——含 parity/loiterview/crushhead 等上批同日戳钉全量，旧戳全库绝迹；node utf8 整文替换保行尾，规避 sed 行尾坑）。
11. **实机关注**：①观战气动/悬停飞行中按住右键=开镜瞄准（武器机瞄/观战连狙 4x 随武器），U 第三人称飞行中右键=瞬间切第一人称、松开回第三人称；②气动飞行按住空格=加速（松开回落 13），右键不再加速；③巡飞弹：空格按住=加速、右键按住=开镜放大且强制弹头第一人称（第三人称档下开镜→弹鼻视角+画面收窄，松开→回背追档）、U 切弹体视角、F 无操作；④机瞄状态下发射巡飞弹：出膛不进开镜（吞边沿），完整松开右键再按才开镜；⑤机瞄状态下按住空格发射：出膛不加速；⑥触屏跳跃钮/手柄 A 按住=气动/巡飞弹加速。

## 一.95 时停照明弹 × 调试模式 L 键装备批 (2026-11-05, 待实机验收)

承用户报两件：①「为调试模式也添加 L 键手电筒/大灯等相关机制，现在人身上没有手电筒和 L 键相关内容，坦克上的大灯则没有实际效果」②「现在时停不会影响点位的周期照明弹释放，这是一个 BUG」。落地五件：
1. **时停照明弹真修（战斗钟单源）**：实证病根不在照明弹自身 —— `24-main` 的 nowOff 记账单位是**秒**而 `nowT=(now-nowOff)/1000` 表盘是**毫秒**，差 1000 倍 ⇒ 时停/指挥减速期间游戏时钟 nowT 实际只被拖慢 ~0.1%（沙箱受控时钟逐帧插桩实锤：`frozen:true, consume:0` 而 nowT 3 帧 +0.05s 照走），一切 nowT 基相位都在"冻结"里继续动，照明弹只是被看见的那一个。修 = **08-effects 夜战装备全部换战斗钟**：`_ngT`（nightGearTick 首行 `+=dt`，只吃世界帧长）供照明弹相位/缓降/飘移与探照灯扫掠；`_fireT`（updateFireLights 双入口经 `_lastT` 去重只累一次）供火光 flicker/抖动 —— 时停 dt=0 全冻结、指挥减速 ×0.2 同步慢放，非时停零漂移。**24-main 单位错位本身本批不修**（修了会波及观察者链上混用 nowT 的门：体能回充/观战补给节流/HUD 指纹节流，需专项批逐处对账），已在 24-main 病根行留已知问题注记。
2. **照明弹/探照灯 isDark 门**（随第 4 件新增）：大灯 L 键现在能把 nightGearTick 在晴天白天也拉起来，照明弹/探照灯是暗光装备 —— 亮环境不建不跑（`if(isDark)` 包裹照明弹段，bestFlare 提到门外=亮环境灯池恒走全灭分支），雨天昼行为不变，晴天开车灯不会凭空长出照明弹。
3. **调试模式战术手电**（用户实报"人身上没有手电筒和 L 键相关内容"病根）：旧版两道 spectator 门把调试观战（spectator=true 但 alive，正常作战单位）的手电全锁死 —— `19-input` L 键步行分支 `!player.spectator` 删除（票尽真观战 alive=false 天然排除）；`08-effects playerFlashlightTick` 的 `on` 判据同删 `!player.spectator`。夜图部署自动持电（23-deploy 既有单源不变）+ L 键开/关 + 提示语照常。
4. **幽灵坦克大灯**（用户实报"坦克上的大灯没有实际效果"病根）：幽灵坦克是 15c 单例，**不在 tanks/trucks/navalCraft 任何一张表里** ⇒ 大灯候选/真灯池竞选/假光锥防穿墙三段全扫不到它，按 L 只亮假光锥、真 SpotLight 永远轮不到 ⇒ 地面照不亮。修 = nightGearTick 候选收集尾补一行（`SPECVEH && alive && lightsOn` 入 cands，收车 SPECVEH=null 自动退出）；`24-main` 门再放宽一档 `_hlRideOn`（玩家当前座驾开着大灯也拉起 nightGearTick，晴天白天按 L 才有真光）。挂点走 tkSpec 缺省档 —— TB_TK_DEF 默认 hullW2.6/hullY1.0/hullH0.95 与幽灵车体几何同参，无需特判。
5. **文案与词典**：部署提示补 `· L=手电/大灯`（23-deploy 与 00b-i18n 词条键同步）；游戏说明「调试模式」段补 `<b>L</b> 战术手电(步行)/载具大灯(含幽灵坦克, 夜晚照明)`（index.html 与 00b-i18n 长词条 726 字键全文一致已验）。
**判据**：新 `dev/verify-nightgear-20261105.js`（受控时钟直驱 24-main loop()，不直调 nightGearTick —— 时停账只在主循环生效）**正向 41/0**（T1 时停照明弹/探照灯扫掠冻结+解冻恢复；T2 观战部署自动持电+L 开关；T3 幽灵坦克假光锥+真灯池竞上贴车头；T4 晴天真灯照样亮+照明弹/探照灯恒空；T5 源码钉 15+i18n 键全文对账+载入清单 46 项同序+版本戳）+ **--neg 5 补丁 12 红逐一对应**；`verify-daynight` T4 拨相判据跟走 2 处（`fl.t0=nowT-X` → `_ngT-X`）后其 10 条红经**全量回退副本对照实证为本批之前既有**（T5/T6 八条=探针字面量被 2026-10-05 天气批等未提交旧批改掉+载入清单 43 过期，T1/T3 四条两树逐名一致；daynight 不在 run-all 注册表）；`verify-timestopfix` 35/0 不受扰。**run-all 两轮逐字一致 73/77 次 exit=0**，唯一稳定失败=`verify-naval` 红线7（海战 AI 导航，与 2026-11-01 各批同一预存红，本批零海战改动）——预存红账零新增。**版本戳 20261104b→20261105a**（index.html ×50 + `_game_files.txt` ×46 + 八戳钉探针同步）。桩补齐：`_bootstub` Object3D.quaternion 补 copy/set/setFromEuler（手电光锥 `quaternion.copy` 本批起真跑）。

## 一.94 碾压/头盔批: 坦克碾压 99/80 分档 × 碾而不死宽限挤开 × 四盔方头四角穿模修复 (2026-11-03, 待实机验收)

承用户两条: ①「坦克的碾压伤害改为 99, 日本鬼子的小坦克和缴获版本改为 80, 而且最好被碾一下之后像被友方坦克挤开一样挤开 (防止连续碾压导致体感上没有改动)」 ②「全部 Bot 士兵等, 头是方形, 头盔是球体切一部分, 方形脑袋上边四个角总是穿模探出来」(附两截图)。逐项落地:

1. **①病根=逐帧重复结算**: 旧 320 不止"一击必杀"——`vehiclePushSoldiers` 的前沿带 (frontalBand 1.5m+入射余量) 内**每帧都判碾**, 坦克 8m/s 碾过一条 1.88m 深的带 ≈ 14 帧连续结算 ⇒ 只把 320 改 99, 第二帧照样死, 体感零变化 (用户点名要防的正是这个)。
2. **分档单源** (00-config): `TANK_CRUSH_DMG=99` / `TANK_CRUSH_DMG_CHIHA=80` / `TANK_CRUSH_CD=1.2`; Tank 构造器按 `def.tk.shape==='chiha'` 分档 (键=剪影形**非 wc 车重**): jp 九七式中战车/一式中战车 + cpc 九七式(缴获)/一式(缴获) 四车 80; 谢尔曼/潘兴/四号/黑豹/T-34/KV-1/**维克斯6吨(light)**/T-26 全 99 (维克斯是轻坦也 99 ⇒ 探针实证分档键不是车重)。调用点改 `_o.crushDmg=this.crushDmg`。**范围护栏**: 卡车 300 / 两栖车 320 不动 (用户口径只说坦克)。
3. **幸存宽限+挤开**: `vehiclePushSoldiers` 每兵挂 `s._crushCd` **墙钟账** (逐车逐帧衰减): 门 `!(s._crushCd>0)` 挡宽限期内重复结算, 碾而幸存即发 1.2s; **推挤不设门** —— 既有侧向限幅推挤 (与友军挤开**同一支代码**) 照常把人清出车壳 OBB+0.38m (实测 ~0.1s 出壳), 宽限走完若仍贴车前才再吃一次 (宽限≠免死金牌, 站坦克前不动照样被连续碾死)。
4. **平衡注记** (丧尸局): walker 100 血 → 碾后 1 血存活需二次接触; brute 380 → ~4 次接触 (1.2s 间隔); "机动碾压/甩落可清丧尸"仍成立, 但不再是逐帧秒清; 玩家被 AI 坦克碾 = 1 血 + 被挤开 ("碾一下"体感本尊)。
5. **②病根=几何必穿**: 头盒半宽 0.1 ⇒ 上四角离轴 **0.1414**; 旧盔在头顶高度的截面半径仅 0.134~0.142 (pot 恰好零裕量相切), 10 段球冠多面体化再内缩 ~4% (45° 方位弦因子 0.963) ⇒ 四角必然穿出。修=四盔统一放大球冠+冠高微调 (pot .15→.162/y.154; stahl .155→.165/y.145; ssh .152→.167/y.153; jp .142→.165/y.146), **多面体化后**盔面在 [盔沿,头顶] 全程压住四角, 真裕量 4.1~5.1mm; 头盒与爆头命中球 (13-combat r=0.26) 不动, 剪影位移 ≤8mm。**单点修复全量生效**: Bot/玩家第三人称/丧尸/观战镜像全走 `buildSoldierMesh` 一处。
6. **顺带修两枚隐性埋没徽章**: 日军星徽 (旧 z=0.135) / 国军青天白日徽 (旧 0.148/0.15) 在旧盔同高度截面半径 (0.142~0.177) **内侧 = 从未露出过** (有盔阵营的徽章一直是埋的); 按新盔面重排 (星 0.1535 / 蓝 0.1755 / 白 0.1775), 前缘出面 ~1mm、后缘埋入固定。
7. **判据**: 新 `dev/verify-crushhead-20261103.js` (island=us vs jp 真开局, 阵营换挂 TEAM_FACTION[0] 实测全六阵营) **正向 26/0**: 源码钉 8 + Tank 分档实测 3 + 测试坦克清场还原 + 碾压行为 5 (99→1 血发宽限 / 30 拍贴带零二次结算 / 侧挤出壳 |x|≥2.42 / 宽限走完 1 血必死 / 友军零掉血护栏) + 头盔几何 7 (**真 built mesh 的 geometry.parameters 重算弦多面体压角裕量**: pot 4.95 / stahl 5.12 / ssh 4.08 / jp 5.02mm; 布帽=盒不在修复面; 两徽章出面+埋入) + 版本戳; **--neg 7 补丁 13 红**逐一对应 (旧盔负裕量实测 −7.4/−3.8/−9.0/−19.4mm 与手算穿模方向一致; 宽限拆掉 30 拍即尸; 友军护栏/布帽/范围护栏阴性下保持绿=分辨力)。
8. **版本戳** 20261103b→c 本批首升; **死亡掉雷批 (一.93) 并发顺延 c→d 并同步本批探针钉** (全树 d 零残留, 本批采纳 d 随行) —— 升戳并发首见"第三方把我新写的探针钉也一起扫了", run-all 对账时按全树现值口径即可。
9. **实机关注**: ①坦克慢速碾过满血步兵: 应见 99/80 一次伤害 (1 血幸存) + 人被履带侧向"挤开"滑出车旁, 而非原地消失; ②站在坦克正前不动: 1.2s 一次持续掉血, 仍会死 (宽限不是无敌); ③日军/缴获轻坦碾同一个人伤害明显低一档 (80 vs 99 的击杀数差异可在结算复核); ④任意阵营士兵近看: 头盔四沿下方不再露出方头四角; 日军头盔正面有星徽、国军 (KMT) 盔正面有青天白日徽 (此前从未显示过)。

## 一.93 死亡掉雷批: 死亡掉落手中雷 × 引信继承读条 (2026-11-03, 待实机验收)

承一.91 排查批遗留口径的用户裁定: 「死亡时手里捏的雷要'掉落在原地'，并继承读条时间」。快速落地:

1. **病根闭环**（承一.91: 手里雷=全游戏唯一真"原地消失"的弹体）三条路径: ①玩家 >25 受创打断 (damage 内 cancelReadBar 收雷不消耗) ②死亡清账 (die 内 cancelReadBar) ③**出手弧中阵亡** (updateViewModel 随 alive 停摆 ⇒ 弧永不走出手帧; vmAbortAction 明确不收弧="不属于可中止段")。Bot 侧=三问批打断网把前摇 nadeAnimT 清零。
2. **dropHeldNade 单源 (13-combat, throwNade 之后)**: 死亡瞬间手里雷就地脱手 —— 胸口微抖 ±0.15 + 小抛落 (照常翻滚/弹跳), 弹种/归属/队伍/击杀账与出手件完全同链 (死者照记击杀, 与死亡弹道留存同规); 载具/大舰内保险丝不落。
3. **引信继承读条**: 玩家普通雷 = **nadeFuse 余值直带** (厨雷账举起即烧 20-player; 烧到 0=已武装 ⇒ 掉地即炸, 与持雷"武装+接触"双条件一致); 烟雾/燃烧/反坦克 = 各自标准引信 (1.8/1.6/1.6), **哨兵 99 绝不带走** (否则引信到点永不武装=哑弹); Bot 前摇 = 3.4×(nadeAnimT/0.8) **按剩余比继承** —— 越接近出手被杀, 尸体上的雷越烫。
4. **接线三点**: ①玩家 damage >25 打断点: hp≤0 (已扣减) ∧ nadeHeld ⇒ 掉雷代替收回 (随后的 cancelReadBar 只收玩家侧账/模型, 碰不到已入账弹体); ②玩家 die() 钩: nadeHeld ∨ (VM 'nade' ∧ nadeThrowT≤0) ⇒ 掉落+**收弧** (VM 回 idle + nadeM 隐 + 枪还原 —— 防复活后残留弧走出手=双雷); ③Bot damage >25 打断点: hp≤0 ⇒ 前摇中掉雷 (清账前)。die() 钩兜非打断路径 (≤25 致命/出手弧)。
5. **口径**: 受创<致命照旧收回不消耗 (2026-10-25 打断网语义零改动); 丧尸尸变早退不掉 (人没死透); 载具/大舰内不掉; 空手死亡零掉落。
6. **判据**: 新 `dev/verify-deathdrop-20261103.js` 正向 **25/0** (T1 真实哨兵态持雷半程: 掉落引信精确 2.0 + 距尸 1.16m + 账旗摘 + VM 收回 + 40 步 ≈2.0s 引爆时序独立印证; T2 全熟 0.60s 触地即炸; T3 烟雾哨兵 99→掉落 1.8; T4 出手弧阵亡照掉+收弧; T5 Bot 前摇 0.2→引信 0.85=3.4×0.25; T6 AT 掉落即武装; T7 空手死亡零掉落对照) + **--neg 六补丁 6 红** (两处打断点掉雷拆/die 钩拆/引信继承断/比例断/哨兵带走病, T7 保持绿=分辨力); deathflight 探针复跑 14/0 (die() 改动守护)。
7. **版本戳** 20261103c→d (index.html 50 处+`__sfStyleVer`+_game_files.txt+七探头钉随升, 老戳清零; 并发预瞄批 c 后顺延)。
8. **实机关注**: ①贴脸击杀正在举雷的 Bot/玩家, 尸体旁应有一颗短引信雷很快爆; ②举满 3.8s 全熟雷死亡=落地即炸; ③死亡镜头里雷从尸体位置弹出翻滚; ④复活后手里不残留雷模/出手弧。

## 一.92 手雷预瞄批: 贴地圈可见弧段(厨雷小圈病根) × 弹跳段预瞄点提亮 × 预瞄地图标记(小/大地图落点圈+圈内黄边+设置开关) (2026-11-03, 待实机验收)

承用户两条: ①「预瞄线在地图上也要有呈现, 就用一个小圈就行; 范围内的目标红点/蓝点/绿点等再加一层黄色边(可见预瞄线同款黄色); 再加一个『游戏内容设置』里的选项来开关」 ②「爆炸范围显示在计时归零后就变成一个小圈了, 而且似乎不显示第一次弹射开始的预瞄线」(附第一人称厨雷截图: 引信 0.0s, 屏上只剩 0.45m 弹着点小圈)。逐项落地:

1. **②病根=贴地圈的"整环作废"口径** (`22-hud nadeGroundRing`): 旧版 36 个采样点**任一点投影落在相机身后即整圈作废**(宁可不出圈不画假圈)。厨雷 (引信烧到 0) 预演引信钳 `max(0.1,0)`, 落点就在本体前 3~4m, **10m 杀伤圈的后半弧全在相机身后** ⇒ 整圈被裁, 屏上只剩 NADE_ARC_SPOT_R=0.45m 的弹着点小圈——正是截图工况 (满引信时落点 15~25m, 圈完整在身前, 所以只有厨雷档看得见)。修=**画可见弧段**: 身后/贴面点断路 (`seg=0`, 下一可见点 `M` 重起笔), 只画真在面前的弧——几何上诚实 (不把裁掉的半边硬连成假圆), 玩家站进圈里也能凭前弧+弹着点小圈读出"自己在圈内"。返回值 `{d,full}`: full=整环可见 (闭合 `Z`, 照旧填充); **开放弧去填充只留描边** (SVG 开路径的隐式闭合填充会横穿屏面) —— 经 `naSet` 新增 `sfill` 档走**内联 style.fill** (style.css 类样式压不过 setAttribute, 只能内联; 还原写空串把控制权交还类样式)。配套 `nadeProj` 加 `near` 参 (圈用 0.4m): 擦着相机平面的采样点会投影到极远屏坐标、与邻点连线在屏上扫出假线, 宁可断弧。`nadeGroundRing` 签名不变, 同族探针锚零漂移; 满环 37 点闭合与 `verify-nade-trigger` B3 的 `ringPt>=30` 判据兼容。
2. **②b"第一次弹射开始的预瞄线不显示"** (`css/style.css .na.na-bounce`): 弹跳/滚动段点串**一直在画** (updateNadeArc 点串 `rec.bounce` 分流), 但旧样式 4px/.45α/**无投影**/0.65 不透明度在亮草地上有效可见度不足三成 ≈ 隐形。提亮一档: 5px/`rgba(255,195,85,.9)`/带投影 `0 0 3px rgba(0,0,0,.55)`/opacity .9 —— 仍与空中实心段 (6px/.85α) 保持主次之分。
3. **①预瞄地图标记** (`22-hud`): 预演激活帧把落点/圈半径/圈内目标挂进模块账 `_naMapMark={on,x,z,r}` + `_naMarks[]` (对象/数组复用零分配, 20261101 性能批同规)。账源与提示条**同一遍圈同一份判据** (`d3<=blastR || (d2<=blastR && |dy|<=3)`)——计数 ("圈内 N 人") 与地图黄边读同一份 `_naMarks`, 两处永不漂移; 黄边**不问 mmEnemyVis** (夜/雨显形规): 圈内计数本就无视能见度, 即将挨炸的目标标黄同理。消费两处: `drawMinimap` 第 4 层 (顶层, 蒙版之上——夜/雨档第 2 层蒙版会压暗远处点位本身, 黄边在顶层才读得清) 画落点小圈 (半径=杀伤圈×`invRangeHalf` 按图比例, 心=落点, 中心一枚小点) + 圈内目标黄边环 (r=4.4 于点位外圈); `drawBigMap` (M 键) 同款 (全域比例 `r/MH*(S/2)`, 黄边 r=5.5)。黄色=`rgba(255,205,90,.95)` 与世界预瞄圈 naBlast 描边同款。预演早退 (停瞄准/阵亡/换弹) 同步清账, 图上不得残留。
4. **①开关** (`00-config`+`index.html`+`22-hud initMenuUI`+`00b-i18n`): `let NADE_MAP_MARK=localStorage.getItem('sf_nade_map')!=='0'` (默认开; 单源 00-config 与 MAP_ALL_INTEL 同区)。「游戏内容设置」子面板新增 `#nadeMapMarkBtn` (🎯 手雷预瞄地图标记: 开/关 + 说明行), `initMenuUI` 接线**实时生效不重载** (地图全图信息口径): 关掉即停画地图侧标记, 世界内预瞄线不受影响。i18n +2 键 (标题/说明)。
5. **判据**: 新 `dev/verify-nademap-20261103.js` **48 过 / 0 红** (S1 源码锚 26: 可见弧段口径/`{d,full}`/sfill 档/账单源+清账两处/两图消费/设置三件套/i18n/CSS 新旧值/run-all 自注册; B1 行为: 近环 (环心 4m) partial `M×2 L×22` 多子路径 / 远环 (30m) full 37 点 `Z` 闭合 / **整环在身后=null 阴性** / sfill 内联 none↔空串; B2 端到端厨雷复现: fuse=0 + `player.vel` 反向削速 (预瞄出手式 `addScaledVector(player.vel,0.4)` 单源, 落点 3.5m ∈ 圈内) ⇒ naBlast 照画+`style.fill==='none'`+`M×2`+账挂上; B3 小地图: 落点圈心/半径逐位对 (10.6px)+圈内敌黄边 (4.4)+**圈外敌无黄边阴性**+**开关关=黄色绝迹阴性**+按钮 onclick 翻转+`sf_nade_map` 记账; B4 大地图: 15.3px 落点圈+黄边 5.5)。**A/B 亲见转红**: 翻回旧 nadeGroundRing (`return null` 整环作废)/旧 CSS/关掉小地图标记块 ⇒ F3h/F3i/B1 近环×2/B3 两判据**六条精确转红**、阴性对照全绿 ⇒ 复原复跑 48/0。run-all 两轮失败集与预存红账逐条相同 (naval 红线7 稳定红 ×4 + aimassist 种子偶发 1+3 次复核全过) = **零新增**。
6. **探针坑 (新账三笔)**: ①`_bootstub:55` 桩 **已有 no-op `applyMatrix4/project`** (`return this`) ⇒ 旧条件补丁 `if(!VP.applyMatrix4)` 形同虚设、投影全程哑掉——`verify-nade-trigger` B3/B4 的"6 选 1 全 0 点 envSkip"长期假绿与此同根 (本批以**无条件覆写真公式**修本探针, 未动他探针与他桩); ②录制型 2D 桩方法必须返回**代理自身**——裸 target 上 `.addColorStop` 无 trap 断链 (drawBigMap 蒙版 `createRadialGradient(...).addColorStop(...)` 实测崩; drawMinimap 因晴档跳过蒙版而漏现); ③录制桩 `findArc` 必须返回**参数数组**——返回调用条目则断言取错下标 (数据逐位对上、断言全红的迷惑象); 另: 沙箱 `camForward` 走 Object3D 桩 position-only matrixWorld ⇒ `setCam` 俯仰**不驱动**瞄准方向, 厨雷近落点用 `player.vel` 削速驱动而非俯角。
7. **版本戳** `20261103a→20261103b` (index.html 50 处+`__sfStyleVer`+`_game_files.txt` 46 行+六探头 hudfix/perf/animfix/commander/cmdbatch2/parity 钉随升, 全库老戳清零)。
8. **实机关注点**: ①厨雷 (引信烧到 0) 瞄准: 爆炸圈应显示为本体前方的**虚线弧段** (离圈沿越近弧越短, 站进圈里=看得到前弧+弹着点小圈), 不再只剩一个小圈; ②持雷瞄准期左上小地图: 预计落点处一个黄色小圈 (大小=爆炸范围按图比例) + 圈内目标点位外圈描黄边 (敌红点/友蓝点/小队白点/丧尸绿点都描, 与"圈内 N 人"同账); ③M 大地图同样呈现; ④游戏内容设置→「🎯 手雷预瞄地图标记」开关**实时生效** (关=只留世界内预瞄线, 下次进设置重开即回); ⑤弹跳/滚动段的预瞄点串 (第一次弹射之后) 应明显可见 (比空中段略小略淡但不再隐形); ⑥开放弧档 (玩家在圈内/圈沿) 的爆炸圈只有虚线描边没有淡黄填充——这是去假填充的有意口径。

## 一.90 三问批: Bot 打断网接入 × 弹药账对齐+弹尽补给 × 真附身呈现层全量镜像 × 火力点命中体 parity × 丧尸追击双 bug (2026-11-03, 待实机验收)

用户三问: ①Bot 是否受打断机制影响? 附身时为何看不到宿主消耗弹药/换弹等大批动作, 请优化 ②固定火力点上的 Bot 似乎有类似减伤的加成? 如果有的话给玩家也加上 ③丧尸对固定火力点上的 Bot 士兵完全忽视 (不索敌不攻击, 例: 操作迫击炮的 Bot 丧尸从旁边过都不打)。三个探索子智能体并行取证后逐项落地:

1. **调查结论 (三问各答)**: ① Bot 完全不在打断网——换弹=独立 `reloadT` 计时器、举雷=0.8s `nadeAnimT` 硬直、包扎=计时器, `Bot.damage` 重写版没有任何打断门; "附身看不到动作"三层根因=Bot 槽位账只在出生/换弹完成写 (开火只扣 `this.mag` ⇒ 附身面板两次换弹间是冻结旧值) + 备弹从不扣减 (恒满) + 视模式附身 VM 整层不做 (`updateViewModel` 门只放活人 + `specViewPossess` 视模式不换枪 + `svHostFireFx` 只对调试附身)。② 全库**不存在任何 gunner 减伤乘区** (dmgCut/dmgMul/减伤 全库仅连杀增益/伞降/难度表/空对地四类, 均与火力点无关)——"打不动"= AT/AA 炮碰撞圆柱物理挡弹 (`fireBullet` 的 `raycastWorld` 在 `raySoldiers` 之前截短 wallD) + 配套沙袋墙 + `emplMGFire` 持续压制攻击者 (散布×(1+suppression)) + 迫击炮手蹲姿小命中体; 玩家当 gunner 走同一条 `raySoldiers`/受击路径且额外吃难度 pDmg 列+连杀减伤 (同一门炮上玩家比 Bot gunner 更硬)。**唯一真实不对称=迫击炮位: Bot 蹲 (`14-bots:1785 crouch=true`) 玩家站**——补齐即"给玩家也加上"。③ 丧尸候选过滤只排 `onVehicle`/`zombie`/`spectator`——gunner 本是合法候选; "完全忽视"的两个真 bug 在感知锁定层 (见 4)。
2. **Bot 打断网 (14-bots `Bot.damage`)**: `amt>READBAR_DMG_GATE(25)` 打断 换弹 (reloadT/pReloadT 清零, 不结算) / 举雷·AT雷前摇 (`state='combat'`+nadeAnimT=0, 雷不消耗) / 包扎 (bandageT=0, 不回血不耗绷带) / 上炮前摇 (emCast 清+g.user 交还, 与 die():616 同式) / 弹尽贴箱补给 (supplyT=0); 25 与刮伤不断; 死亡清账仍由 die() 收。与玩家 `18-game:196` 同一常量同一门槛语义。
3. **弹药账对齐 (14-bots)**: 开火五处同步槽位账 (`aimShot` 主/副武器、AT 枪、迫击炮曲射、舰船反坦克枪——`slots[0/1].mag` 随 `this.mag/pMag` 逐发同步); 换弹完成真扣 reserve (主/副双账三写: mag/槽位mag/reserve; 无槽位=丧尸子类维持旧满仓); 换弹起手全部过 `canReload()` 门 (备弹尽不再起永久 reloadT 循环); **弹尽寻补给** `drySeekSupply()`: 最近岸上 AMMO_CRATES ≤45m → `state='toSupply'` 步行 → 贴箱 1.7m 站 1.2s 补满 (reserve=上限+一匣 + 投掷物照补, 与玩家 `doGrabResolve` 同账) → 弹匣空自然起换弹; 无箱 10s 战地搜刮保底 (就地补一个弹匣备弹, 防无箱图/丧尸局永久哑火); decide() 承诺期不抢状态; 近敌 (<14m 可见) 弃补给转身接战; die/spawn 跨命清账。
4. **丧尸追击双 bug (25-zombies 感知锁定层)**: ①脱见宽限: 旧 `nowT-(this.zTgt?0:this._zSeenT)>6` 在 zTgt 存活时恒为 `nowT-0>6` (页面墙钟开局 6s 后恒真) ⇒ 追击中**一拍**没看见立即丢恨回游荡 (注释宣称"脱见 6s"实际宽限=0s) → 改 `nowT-this._zSeenT>6` 真 6s; ②同目标重锁定门: 旧 `if(this.zTgt!==best&&...)` 前置让"重见**同一个**目标"永远救不回 chase——钉死在炮位、蹲姿低轮廓的 gunner 一旦被丢, 丧尸带着 zTgt 在游荡分支里径直从旁边走过 (会动的 Bot 靠频繁重暴露走"更近目标/受击迁怒"等旁路自救, gunner 没有这条命) → 摘前置, 视野有人即回 chase; ③视线保持刷新 aggroT (否则 aggroT 到期先在 zTgt 分支掉、只靠 0.22s 后的重锁续命)。顺手: 附身候选排除丧尸 (`specViewPickHost`/`specViewCycle` 加 `b.zombie`——Zombie extends Bot 同在 soldiers, 旧版可附身丧尸)。
5. **真附身呈现层全量镜像 (20-player/24-main/13-combat/18-game/10-viewmodel/22-hud)**: ①`specViewPossess` 两模式统一换装 (视模式不再收枪, VM 挂宿主主武器); ②`24-main` updateViewModel 门放宽到 `specViewHost`; ③**`svHostActionMirror` 单源**: 宿主换弹→VM 换弹动画+读条 (`reloadT` 归零而弹匣未满=被打断→`vmAbortAction` 同帧收, 弹药不结算语义与玩家一致)、举雷/AT雷前摇→持雷哨兵镜像 (`nadeHeld` 承接 hold 姿态, 离岗即收不重放出真雷)、包扎→bandage 镜像 (bandageT 驱动, 容差 0.12s 防掐自然收尾); ④`13-combat` 出膛反馈钩子放开到视模式附身 (`svHostFireFx`: VM 后坐+枪口焰/枪口灯+微震镜); ⑤`18-game finishReload` 镜像让位 (specViewHost 时 return——换弹镜像是宿主账, 防玩家侧跨账写); ⑥`10-viewmodel` 包扎打断判定 `VM.mirrorHost` 旁路 + 换弹走完清账 + 出真雷兜底门; ⑦`22-hud` 读条门放宽到附身 + 宿主举雷/包扎镜像条 + ✕附身守卫 (镜像读条不可被玩家掐) + 投掷物行带宿主雷账 (旧"只显绷带"口径); `VM.mirrorHost` 标记="当前 VM 动作是镜像, 不吃玩家账"; 两条 detach 链收镜像账。
6. **火力点命中体 parity (20-player/20a-seats)**: `mountMortar` 玩家蹲姿 (`crouch=true`, `updatePlayerMortar` 逐帧兜底) + `mountMG/mountAT/mountAA` 站姿 (清附身上炮前的蹲姿) + 下炮还原——与 Bot 逐位同规; 其余"减伤感"为物理挡弹双方同享, **不新增任何减伤乘区** (用户问句是条件式"如果有的话", 结论=无显式减伤, 只补真实不对称一项)。
7. **判据**: 新 `dev/verify-parity-20261103.js` 正判 **51/0 ×6 轮稳定** (①源码防回退 22 锚含旧写法绝迹; ②normandy 真开局行为 13 断言: 开火扣槽位账主/副/换弹扣备弹/打断五类/25·6 门槛/canReload 门/弹尽必有出路/贴箱补给两支路+搜刮保底全链; ③蹲站 parity 3; ④procgen·solo 真开局丧尸 4: 同目标重见回 chase/aggroT 刷新/3s 宽限不掉/7s 掉——nowT=墙钟 ⇒ 宽限判据同步驱动下确定; ⑤附身镜像 7) + **阴性 31 红/20 绿** (15 处单行补丁逐一对上红名; CRLF 文件一律单行锚)。
8. **run-all-verify 两轮对账**: 首轮 **69/83 次运行 exit=0** (5 红名逐条归因零行为回归: foliage+audit=一.89 遗留"恰好1处"护栏已修钉为"全在 perceive 内"/nadecancel+batch-20261030=换弹走完行加 mirrorHost 锚跟码/touchpad T1g=一.88 遗留 specViewHost 门锚跟码/naval 红线7=预存稳定红同名; 修钉探针定跑全绿 specview 48/0·nadecancel 48/0·batch1030 50/0·touchpad 28/0·foliage·audit) / 次轮 **69/74 exit=0, 唯一稳定红=naval 红线7 (预存, 1/1/1 与红账同名) + nade-trigger 单次偶发 (套件复核 3/3 绿+单跑 88/0×2, 在案种子偶发型), 零新增红名**。
9. **版本戳** `20261102b→20261103a` (index.html 50 处 + `__sfStyleVer` + `_game_files.txt` 46 行 + 七探头 hudfix/perf/animfix/commander-20261026/cmdbatch2-20261027 跟升, 全库 grep 老戳清零; PLAN/README 历史行文保留旧戳字样不动)。
10. **实机关注**: ①死后观战 LMB 附身现在能看到: 宿主第一人称枪+开火后坐/枪口焰+换弹动画与读条条+举雷持雷+包扎+弹药面板**实时递减**、备弹随换弹扣减 (弹药账对齐后 curW 镜像读数即宿主真账); ②Bot 换弹/举雷中吃大伤会当场打断 (观感=收枪/收雷, 不再"硬直挨打照走完"); ③Bot 弹尽会跑去弹药箱补给 (可见的"没弹了去拿弹"), 无箱图 10s 后就地搜刮续弹; ④丧尸不再无视炮位 gunner——被丢后重见即扑、丧尸炮击溅射的迁怒不再"冲一下就散"; ⑤玩家上迫击炮位是蹲姿 (被弹面积与 Bot 相同), MG/AT/AA 位强制站姿。

文件: js/14-bots.js, js/25-zombies.js, js/20-player.js, js/20a-seats.js, js/24-main.js, js/13-combat.js, js/18-game.js, js/10-viewmodel.js, js/22-hud.js, dev/verify-parity-20261103.js(新), dev/run-all-verify.js, index.html, dev/_game_files.txt, dev/verify-{hudfix-20261007,perf-20261024,animfix-20261012,commander-20261026,cmdbatch2-20261027}.js, PLAN.md, README.md

## 一.91 排查批:射手死亡与在飞弹体——"一死弹体原地消失"证伪 × 死亡弹道留存契约入册 (2026-11-03, 零游戏代码改动)
承用户报「似乎玩家/Bot 一死, 扔出的手雷、发射的巡飞弹、子弹等就原地消失了?」(期望口径: 巡飞弹→原地爆炸, 其余→按原轨迹运动)。**排查结论: 问题基本不存在, 现状已是该口径, 无需修复**:
1. **逐弹种审计** (详细证据表见《排查-射手死亡与在飞弹体-2026-11-03.md》): ①手雷/烟雾/燃烧/反坦克炸药/迫击炮弹/航弹=出手即入全局 `nades[]` 账, `updateNades` 无投掷者存活门 (移除仅 引爆/入水哑火/换局还原 三处); ②坦克主炮/火箭筒/反坦克炮/舰炮/岸炮=全局 `shells[]`, `updateShells` 无 owner 存活门; ③子弹=`fireBullet` 即时射线, 不存在"在飞的子弹"; ④高炮弹 `flakShots[]`/鱼雷 `torpedoes[]` 同样无门; ⑤**巡飞弹=玩家 die() 内既有 `loiterDetonate(this.loiter,...)` 原地起爆行** (基线期既有代码; Bot 无巡飞弹兵种)。唯一会"消失"的手雷=死时还在手里/举雷读条中 (未出手) ——死亡打断读条是 2026-10-25/11-03 批的既有打断设计, "死亡掉落手中雷"属新游戏内容待裁定, 本批未动。
2. **契约回归探针** `dev/verify-deathflight-20261103.js` (真创建路径+真死亡链, 弹体按引用追踪): T1 手雷 Bot 出手→击杀射手→死后 1s 仍在账仍积分→武装后触地引爆离账; T2 `fireRocket`→击杀射手→死后照飞 25.5m/life 照衰减 (6 方位重试防环境撞物); T3 `fireLoiter` 真发射→击杀玩家→loiterDetonate 原地起爆 (d.dead/回收/摘网格/溅射结算 ×1)。**正向 14/0 绿; --neg 注入式阴性** (死后清 nades/死后清 shells/die() 静默弃弹三病注入) **6 红**各被对应判据抓到=判据具备分辨力。已入 run-all 名册——今后任何人在弹体更新循环加"射手存活门"或动 die() 巡飞弹引爆行, 套件当场报红。
3. **改动面**: 仅新探针 + run-all 名册一行 + 文档登记; **零游戏代码改动, 版本戳零升 (20261103a 维持)**。用户观测解释: ①死亡时 TV 制导视角收回, 巡飞弹在死亡镜头外远处起爆 (爆炸链真实发生); ②死亡打断手里雷/读条 (既有设计)。


## 一.92 附身武器镜像单源 × 第三人称手枪差异化 × 火箭筒换弹 2/3 (2026-11-04, 待实机验收)

用户三问 (原话): ①附身观察发现"Bot 手上的实际武器和模型外观显示武器不同"的严重系统性 BUG——附身看到宿主手持火箭筒却连续打出枪械子弹 ②第三人称下突击兵切换副武器外观无变化, 副武器建模动作疑似照搬冲锋枪 ③火箭筒换弹时间缩减至现在的 2/3。

1. **修复①病根链 (三层叠加, 非单点)**: ①槽位层——Bot 无 curW 概念, 当前武器由各开火分支自决 (AT/迫击炮兵对人员目标**永远打副槽手枪自卫** 14-bots:2258-2266, 主槽火箭筒只对装甲开火; "手里那把"的既成事实台账是 `heldWpnKey`); ②附身层——`specViewPossess`/`specViewTick` **钉死 slots[0]** (主武器槽) ⇒ 附身瞬间宿主已持副武器或附身中切枪, 视角永远停在主武器; ③动作层——`svHostActionMirror` 只镜像主武器 reloadT (副武器 pReloadT 不镜像) + `fireRocket` 无出膛反馈钩。**用户看到的"拿火箭筒打枪械子弹"=Bot 自卫行为 (设计如此) + 呈现层不跟随 (真 BUG)**。
2. **修复①落地 (两单源五接线)**: `svHostCurSlot(h)` (台账→槽位单源: heldWpnKey≠wpnKey 且 slots[1].key===heldWpnKey ⇒ slots[1], 否则退 slots[0] = 旧假宿主结构逐位兼容) + `svHostWeaponMirror(h)` (curW 钉定 + VM 换枪, 门=VM.key≠w.key 且 VM.state∈{idle,draw} —— 镜像动作中不抢, 打断归位下一帧补换)。接线: specViewPossess 同源换装 / specViewTick 两分支×2 / svHostActionMirror 插副武器分支 (pReloadT 镜像+打断 vmAbortAction 同帧收; **主武器分支逐字不动**=verify-specview 源码锚) / 22-hud 弹药面板同源 / 13-combat fireRocket 出膛钩 (svHostFireFx 同款, 宿主打火箭也有后坐+枪口焰)。**边界已核**: fireGate 要求 reloadT≤0 才进开火分支 ⇒ 主武器换弹中不可能切枪; fireRocket 打在 pReloadT 期下一 tick 自愈; vmFireKick 读 WPN_DEFS[VM.key] 对任意枪成立; 全链零写宿主账 (只读借眼)。
3. **修复②三枪族造型 (用户裁定"三款枪族造型")**: `gunKindOf` pistol 独立档 (旧 `return 'smg'` = 第三人称拿冲锋枪模, 病根) + `worldGunModel` pistol 分支三族: **colt 柯尔特式** (m1911/p38/tt33: 套筒+短握把+小弹匣) / **broom 驳壳枪** (c96: 方机匣+前置弹匣+扫帚柄) / **nambu 南部十四年式** (细长管+斜握把), 与第一人称 buildGunModel 族谱一一对应; 坐标系同各枪 (原点≈扳机, +z=握把端), 抓握点由 gunGeomStations 按几何现算。**双手持枪** (用户裁定)=不加 GUN_HOLD_BY_KIND.pistol 表项, 走默认机械+armIK, 通信仪单手表不受影响。`CARRIED_FWD.pistol=0.06` (枪短, 沿用步枪 0.30 会把手枪推出手外)。
4. **修复②挂点重定位 (a21-j 全量复测定位, 本批最大暗礁)**: 首版挂点落地后 `dev/verify-a21-j.js` 当场抓出几何回归 (④′ 匍匐左手到枪面 0.184/0.199 > 0.06, ①″ +3 组)。**A/B 归因** (内存还原旧 pistol→smg 映射, sha256 校验复原) 证实系本批引入非既有账。**根因** (沙箱包 armIK/gunForePoint 逐帧实测): 匍匐枪角 rx≈−1.5 把 0.078m 护木站位旋到躯干正前, 挂点又收胸前 ⇒ 左肩到目标纯横向 0.469m, 超两连杆弯肘横向包络 hy(0.475)≈0.372m —— 直距 0.475≤臂长 0.62, 既有 gunAxisPoint 走 t 回退判据 (只测直距) 测不出这种失效。**定位扫描** (5 键×4 姿态×双路径全组合): 站姿 **{−0.17,0.42,0.33}** + 匍匐 **{−0.24,dy0.12,dz0.62}** 全绿 —— 手枪无枪托, **零接触**优于抵肩接触 (①″ 四姿态×双路径躯干盒 0 相交); 匍匐 dz≈步枪档 0.545=双臂前伸自然姿态。南部式握把斜置盒世界 AABB 超柯尔特族 2mm (蹲姿 2mm 侵盒) ⇒ 握把 0.05→0.04 收齐。**修后 a21-j**: ④′ Bot 0.005/0.056·玩家 0.000/0.037 (**与旧映射基线逐位同**), ①″ 25/29 回基线数, ①′ Bot 0/玩家 2 (预存)。
5. **修复③火箭筒换弹 2/3**: 09a-defs `WPN_DEFS.reload` 单源 (玩家 tryReload/Bot ×6 换弹点/VM 动画归一全链自动跟随): **bazooka 3.6→2.4 / schreck 3.8→2.5**。Bot 侧 fireT=3.6 再射击间隔是另一本账不随动 (注释在案); garand 2.4/thompson 2.5 金丝雀防批量替换误伤 (探针钉)。
6. **判据**: 新 `dev/verify-specweapon-20261104.js` **正向 38/0** (源码锚 16: 附身单源 7+手枪 6+换弹 3; 行为 22: 假 AT 宿主 heldWpnKey='m1911' ⇒ 附身瞬间 VM 即换 m1911+首帧 tick 钉 curW+零写账+pReloadT=1.8 镜像精确+打断同帧收+火箭出膛反馈+脱离还原+**无台账旧宿主兼容守卫**; 5 键 kind/三族指纹互异+同族一致/Bot switchVisualGun 端到端含换回原枪逐位复原/**玩家第三人称 thompson→m1911 挂枪模型真变** (0.5→0.252m 盒)+金丝雀) + **--neg 13 补丁 26 红** (附身三层各拆+手枪五拆+换弹两拆全串锚, 12 绿=守卫项不依赖被拆行为)。既有探针**锚跟码修钉两件**: verify-specview (PATCH 锚+正则计数跟新写法, 48/0) / verify-radio (CARRIED_FWD 新键+kind 判据跟码, 40/0)。**run-all 两轮对账**: 首轮 **76/88 次运行 exit=0**, 失败集全归因: naval ×4=预存稳定红红线7 / zombie ×2+matseam ×3=在案偶发名 (ledger 2026-11-01) / **deathflight ×1=探针 T3 判据环境盲区** (updateLoiters 逐步 1.1m 前瞻命中不分敌我, T1/T2 残留朝向若近距有静体/士兵 ⇒ 弹体在裹 splash 探针前早起爆, d.dead/released/meshOut 全过而 splash×0 = run-all 稳定性复核自判"偶发 0/1/0"; 修=T3 补 T2 同款六方位重试, 修后 8/8 绿) / **specweapon ×1=新探针自身判据 bug** (spawn 兵种随机可滚到短枪 thompson 自有模型 0.5m, 旧判据 zlen>0.7 钉长度误判; 修=对初值逐位复原 zlen===初值, 修后 12/12 绿)。两修均零游戏代码改动。次轮 **72/76 exit=0, 唯一失败=naval ×4 (预存稳定红红线7), 零新增红名** (本批两探针及全部既有探针次轮全绿)。
7. **版本戳** `20261103d→20261104a` (index.html ×50 + `__sfStyleVer` + _game_files.txt ×46 + 七戳钉探针 ×28 逐文件计数断言, 老戳清零; 升戳与 run-all 无并发, 升后 hudfix/perf/parity 三探针当场回绿)。
8. **实机关注**: ①Q 附身 AT 兵——对人员目标时视角武器是**手枪**且有手枪后坐/枪口焰, 对装甲才换火箭筒 (火箭出膛同样有反馈); ②附身看宿主副武器换弹也有动画与读条, 宿主受创打断则同帧收; ③附身中弹药面板跟宿主手里那把; ④步兵切副武器第三人称**三种造型肉眼可辨** (柯尔特/驳壳/南部), 趴姿双臂前伸持枪双手都在枪上; ⑤火箭筒换弹读条约 2.4/2.5s (旧 3.6/3.8), Bot 再射击间隔不变。

文件: js/20-player.js, js/11-soldiers.js, js/13-combat.js, js/22-hud.js, js/09a-defs.js, dev/verify-specweapon-20261104.js(新), dev/verify-specview-20261101.js, dev/verify-radio-20261027.js, dev/verify-deathflight-20261103.js(T3判据修钉), dev/run-all-verify.js, index.html, dev/_game_files.txt, dev/verify-{hudfix-20261007,perf-20261024,animfix-20261012,commander-20261026,cmdbatch2-20261027,parity-20261103,crushhead-20261103}.js, PLAN.md, README.md, finished-docs/交付文档-附身武器镜像×手枪差异化×火箭筒换弹-2026-11-04.md(新)
## 一.89 Bot AI 机制优化批: 隔墙开火 × 挤堆卡死 × 兵挤坦克上不了车 (2026-11-02, 待实机验收)

用户附身观战实报三项: ①好几个人挤在一起、卡在一起, 不知道在干什么 ②总是隔着墙对目标开火 (可破坏与不可破坏墙都有) ③士兵在坦克面前向坦克挤但就是上不去 (注意平衡性)。三症状各查出真根因, 全部单点修复, 零手感损伤口径。

1. **A·perceive 当前目标优先复核 (14-bots, 隔墙开火主根因)**: RAY_BUDGET (12 发/帧全 Bot 共享) 被排前的 Bot 吃干时, 循环内对「当前目标」走 isCur 分支**零检测直接沿用旧通视状态** ⇒ lastSeenT 每周期照常刷新 ⇒ 开火门 (`nowT-lastSeenT<0.6`) 永远开着, 人缩到墙后仍朝其实时坐标泼弹。修: perceive 循环外先对当前目标做带优先权的通视复核 (世界遮挡 -0.6m 裕量 + 烟/庄稼/植被/潜水四门, 与循环内逐位同口径; 超预算也照发 —— 每次 perceive 至多 +1 发, 22 人表 ≈ +2.3 发/帧, 换「不隔墙开火」), 循环内 isCur 分支只消费 `_curBlk` 结论; lastSeenT 停止刷新 ⇒ 0.6s 后开火门自然关上、转压制, 3s 后 isCur 失效回落正常索敌, 8s 记忆清账不动。
2. **B·机枪座开火预检+断视压制 (14-bots mgUse 分支)**: 旧版 engaged 门 (<4s) 内始终朝 target **实时坐标**开火且无开火瞬间 LOS 预检 ⇒ 目标缩进掩体后最长 ~3.4s 隔墙扫射。修: `mgVis=lastSeenT<0.6` (与步枪开火门同源) 才打活人坐标且开火瞬间预检 (被挡 `mg.fireT=0.12` 短退避, 不烧每帧预检射线); 刚丢失 (<2.5s) 改压**最后目击位** (压制弹, 弹道自己撞墙, 与步枪 supFireT 同语义); 射速间隔在炮上/散热档/俯仰同源等既有口径零触碰。
3. **C·火箭筒预检收紧 (14-bots)**: 旧版 `raycastWorld(eye,dir,65)` 定长+`chk.dist>50` 放行, 与目标实际距离脱钩 —— 墙在 50m 外就是隔墙发火箭 (一次性弹药还可能自伤)。修: 射线打到目标实际距离 dTk、`chk.dist>dTk-3` 才放行 (与下方反坦克枪分支同款)。反坦克枪分支原本就对, 零改动。
4. **E·士兵间软分离 (14-bots `_soldierSep`, 挤堆/卡死主根因)**: 全库此前**没有任何士兵-士兵推挤** (collideMove 只推静态世界) ⇒ 选中同一掩体点/旗心的 Bot 全部叠进同一格, 叠死后又各自触发脱困侧蹿 (观感=反复横移打摆)。修: 每人只推**自己**离开邻居 (对称分离由双方各跑一遍、各推一半保证), 分离半径 0.85m、单帧限幅 0.22m、推完过一次 collideMove 防顶进墙 + 就地重站高 (驻停 Bot 没有 moveDir 的逐帧 standHeight); 参与名单与命中管线同口径 (raySoldiers): 死人/在车/大舰炮手/观战者不推, |dy|>1.6 (楼上下/桥上下) 不推, 任一方俯卧推力减半, **玩家只被让路不被推**; 调用点在 update 移动段前, 上炮/前摇/包扎/乘员/伞降/下车跨出/近战各自早退或显式排除。O(n)/人·帧, 22 人表 ≈ 500 次平方距离/帧, 零分配。
5. **F·驻点占用账 (14-bots `coverCrowdAt`, 挤堆第二根因)**: 掩体/驻守点「谁评谁上」没有占用概念 —— 一窝 Bot 对同一批 coverPoints 评出**同一个**最优解, 全队先后叠进同一格。修: 数同队活人里「打算去/已站在」该点 1.7m 内的个数 (意向=coverPt/defendPt/pushPt 三落点字段 + 现位, 同一人只计一次), 评分时逐点加罚: defendPt 选择 ×9 / findCoverFrom ×5 / findCoverToward ×5。不预约不锁点 (死亡/改主意自动失效), 只作评分偏置; 单源就是本函数。
6. **H·目标粘滞防抖 (14-bots objHoldT, 「不知道在干什么」)**: 旧版每拍 6% 概率随机 `pickObjective()` ⇒ Bot 走到半路掉头往返。修: pickObjective 选定即 `objHoldT=rand(4,7)` 承诺期, 期间 6% 门不生效 (计时在 update 定时段衰减); **紧急例外**: 己方旗正被敌方占领 (`owner===team&&capTeam!==-1&&capTeam!==team`) 立即重选不受粘滞约束 (四种 objective 形状——FLAGS/攻防合成/clash 合成/convoy 合成——都显式带 capTeam 字段, 判据安全)。
7. **I·上车触达改贴壳判定+顶壳超时拉黑 (14-bots toVehicle, 兵挤坦克上不了车根因)**: 旧门 `d<VEH_BOARD_R(2.7, 以车心为准)` 而 vehiclePushSoldiers 把步兵挡在「车壳 OBB+0.38m」之外 —— 车体半长+0.83 > 2.7 对**所有坦克**成立 (hullL 最短 4.6 ⇒ 3.13m), 从首尾方向接近的 Bot 被永久顶在前装甲上够不到判定圈 (侧向接近 1.68~2.98m 偶尔能进 = 实机「时灵时不灵」)。修: 改按**车壳表面距离**判 (与 15-vehicles:998 的推挤几何同源同参: 横向 |lx| 比 halfW、纵向 |lz| 比 hullL/2+0.45), 贴壳 ≤0.55m 即上 —— 可见的人永远贴着车壳消失 (2026-09-20 闪现修复「消失点贴车壳」原则不变), 任何车长/任何方向都成立; 贴壳带 (<1.6m) 却上不去的兜底: 顶壳 6s 放弃认领归建 + 该车个人拉黑 12s (vehFailV/vehFailT, decide 认领循环跳过 —— 否则下一拍又认领同一辆, 在坦克前无限 yo-yo)。平衡: 认领纪律不变 (每车同时仍只有一人认领/8s 窗)、无新全局冷却、必须物理贴壳才上。
8. **判据**: 新 `dev/verify-botai-20261103.js` **53/0 两轮稳定** (46 文件全链真开局, 与 verify-commander-20261026 同款桩; 行为断言: T1 预算耗尽+墙 lastSeenT 冻结 / 耗尽+无墙照常刷新 / 优先射线超发证据 · T2 墙+全场饥饿 20 拍零刷新端到端 · T3 机枪拦截+0.12 退避+断视压制 · T4 58m 目标+53m 墙不发 (旧口径 dist>50 放行) / 无墙照发 · T5 旧推挤边界 0.45m 一帧上车 (旧门 4.35>2.7 永远够不到) / 远处不上不计时 / 顶壳 6s 超时+拉黑 12s+decide 不再认领 · T6 对称分离收敛/死人·观战·楼上下·俯卧减半·玩家只让路五阴性/update 全链生效 · T7 占用账意向/现位/同一人只计一次/敌队不计+三消费点源码 · T8 粘滞 300 拍零换/归零恢复 6% 门/己方旗被夺紧急重选 · T9 源码防回退 11 锚含旧写法绝迹) + **阴性 17 红** (--neg 七补丁各有目标断言转红: A→T1×2+T2+T9A / B→T3×2 / C→T4+T9C / I→T5+T9I / E→T6+T9E / F→T7 / H→T8×2+T9H×2)。**★探针抓出首版轴配对反了**: `_surf` 初版把横向比 hullL/2、纵向比 halfW ⇒ 假坦克 debug surf=2.3 (实际贴壳 0.45) 永不上车 —— 轴口径对齐 vehiclePushSoldiers (hx=halfW/hz=hullL/2) 后 53/0; 又: T4 场2 初版把场1 的靶车留在场上以 0m 抢走 eTank, T1 场3 初版 Δt=4s 已超 3s 记忆门走不进复核分支 —— 都是探针自身几何/窗口错, 与实现无关。
9. **run-all-verify 未跑完** (用户裁定立即收尾让出并发, 第一轮中途终止未出结果): 待补两轮回归对账 + probe-bots 行为验收; 定向探针 verify-botai-20261103 正反两轮已绿 (53/0×2 + 阴性 17 红)。
10. **版本戳** `20261102a→20261102b` (index.html 50 处+`__sfStyleVer`+`_game_files.txt` 46 行+五探头 hudfix/perf/animfix/commander/cmdbatch2, 全库 grep 老戳清零; PLAN/README 的历史行文保留旧戳字样不动)。
11. **实机关注**: ①乱斗里 Bot 不再朝墙/烟后泼弹 (枪响后目标进掩体 ≤0.6s 停火转压制, 压制弹打的是最后目击位); ②同点汇聚显著减少——掩体/旗圈周围 Bot 自然散开, 不再一坨叠着左右打摆; ③步兵接近任何坦克从任何方向贴壳即上车, 卡住时 6s 后自动放弃归建; ④机枪座目标进掩体后很快转为朝原目击位压制而非扫墙; ⑤火箭筒兵不再对 50m 外有墙的坦克浪费火箭。

文件: js/14-bots.js, dev/verify-botai-20261103.js(新), dev/run-all-verify.js, index.html, dev/_game_files.txt, dev/verify-{hudfix-20261007,perf-20261024,animfix-20261012,commander-20261026,cmdbatch2-20261027}.js, PLAN.md, README.md

## 一.88 观战实机反馈第二轮: 鼠标吞键 × 指示条全屏层门 (2026-11-02, 待实机验收)

用户实机反馈三项: ①附身时右键仍触发瞄准动作 ②Esc 重部署/Esc+Esc 暂停时观战信息条压在图层上方 ③附身不得影响宿主行动。

1. **鼠标吞键门 (19-input mousedown)**: 上批 keydown 侧已有吞键门 (Q/E/U/J/K 白名单), 但**鼠标是独立监听器**——调试附身 (player.alive=true) 走不到视模式分支, 右键照旧 `player.ads=true` ⇒ FP 视角里宿主的枪做出瞄准动作 (用户实报)。修=视模式分支后插 `if(player.specViewHost) return;` (在读条取消分支之前): 左/中/右键一律吞掉, 不进 ADS、不 cancel 读条; 左键 mouseDown 本就因 updatePlayer 冻结 (20-player:799) 打不出去, 现在连账也不置。手柄 (19b padAds) / 触屏 (24-main tAds) 的 ADS 门补 `!player.specViewHost` 同门。
2. **👁 指示条全屏层门 (22-hud)**: 指示器挂 body 上 z-index:40, 高于全屏层 .screen (z-index:20) ⇒ 重部署页/暂停罩/结算页开着时它压在图层上方 (用户实报)。修=`_svOverlayOpen()` (.screen 四件=menu/deploy/end/pauseOv 静态缓存表逐帧查 hidden 类 + gamePaused 旗双判据, 零分配纪律) 任一开着即收起, 关闭后下一帧 `_svIndShow()` 单源复显 (带罗盘实测重定位——定位逻辑从进位 show 分支提出, 复显走同一条); 面板收起账 (_svHudOn/_svHudPos) 不动——#ui 内 HUD 本就被 .screen 盖住。
3. **宿主行动不受影响 (全库审计)**: specViewHost 全部读点过堂——13-combat×4 (出膛火光/命中白档×3) / 14-bots×2 (受击/die 击杀门) / 25-zombies / 21-match (onHostKill) / 22-hud×5 (换心/顶栏/复位/脱离) / 23-deploy——全是**表现层单向读**; 宿主 AI 无任何 specViewHost 读点, 宿主侧唯一写点仍是 `mesh.root.visible` 显隐 (呈现, 不改行为); curW 指针镜像在输入吞净后无玩家侧写者 (开火链 updatePlayer 冻结 / tryReload 键吞 / vmReloadRestore 纯视觉)。

**探针**: verify-specview-20261101.js **48/0** (新增 4 断言: 鼠标吞键门位置序 / 手柄+触屏同门 / _svOverlayOpen+_svIndShow 单源; ⑦ 行为=gamePaused⇒👁收起·恢复⇒复显·脱离⇒收起——**探针坑: getElementById('specViewInd') 对 createElement+appendChild 建的真身会另造 byId 新壳, 须走 document.body.children 找**) + **阴性 26 红/22 绿** (新增 4 锚全转红; ⑦ 阴性 paused:"block" 亲见病根复现)。**run-all 未跑 (用户裁定电脑没电不重复验证; 定向探针正反两轮已绿)**。**版本戳 20261101d→20261102a** (index.html 50 处+_game_files.txt 46 行+五探头 hudfix/perf/animfix/commander/cmdbatch2, 全库 grep 老戳定增量)。

文件: js/19-input.js, js/19b-gamepad.js, js/24-main.js, js/22-hud.js, dev/verify-specview-20261101.js, dev/run-all-verify.js, index.html, dev/_game_files.txt, dev/verify-{hudfix-20261007,perf-20261024,animfix-20261012,commander-20261026,cmdbatch2-20261027}.js, PLAN.md, README.md

## 一.66 性能优化与架构缺陷重构工程 (2026-10-08a, 待实机验收)
严格依据《性能优化与架构缺陷重构工程指导-20261007.md》Phase 0~3 落地四阶段重构与治理：
1. **Phase 0 阻断缺陷与显存泄漏修补**：
   - 任务 0.1 (20-player): 下车状态机重置（tankView=false, navalGun=false, scopeOv 隐藏, fov=74 复原），下车候选点受阻时安全回退上方。
   - 任务 0.2 (02-scene, 22-hud, 23b-worldrestore): 建立 WebGL 资源递归释放器 disposeActorHierarchy(obj)，设 _SHARED_MATS 白名单；换局 retireMatchActors 彻底释放 Mesh/材质/几何体。
   - 任务 0.3 (10-viewmodel): vmEquip 换枪前递归遍历释放 VM.inner 子级非白名单独占几何体，根除换枪显存持续攀升。
   - 任务 0.4 (16-aircraft): 防隧穿 3D 点到线段扫掠检测 distSqPointToSegment；严格保留 f.age > 0.02 出膛自爆豁免。
   - 任务 0.5 (18-game, 21-match, 22-hud): MATCH_TIMERS 异步定时器安全池，阵亡/换局/结算集中清理 clearMatchTimers()。
2. **Phase 1 物理与寻路热循环减负**：
   - 任务 1.1 (12-ragdolls): 布娃娃与碎块 Cannon 刚体掩码置零（collisionFilterGroup: 0, collisionFilterMask: 0），消除无意义狭相计算；积分步长上限保护与迭代限制。
   - 任务 1.2 (07-nav): A* 寻路退化治理（_heapTouched O(K) 清理替代 3.3 万项全图清零；expand 邻树收集 meetCandidates 规避 16,641 次全图双向兜底扫描；compFreeList 递归回收分量 ID）。
   - 任务 1.3 (14-bots): 全局帧射线预算器 RAY_BUDGET (每帧上限 12)；perceive 视距粗筛与预算约束；probe 避障依赖 2D occBlocked，仅卡死 (stuckT > 0.25s) 且有预算才发 3D 射线。
   - 任务 1.4 (01-audio): WebAudio 瞬态节点自动断开解绑 scheduleNodeRelease，避免 AudioContext 节点幽灵滞留。
   - 任务 1.5 (06-engineering, 04-collision): 工程兵建造碰撞网格增量刷新 spatialIndexAddBox，消除每造工事全图重建开销。
3. **Phase 2 渲染 Draw Call 治理与地形重构**：
   - 任务 2.1 (05a-buildings, 05-world): 静态建筑不可毁（非 destr）同材质构件几何合并 (bldBatchBegin/bldBatchEnd)，大幅削减独立 Mesh 与 Draw Call，保留碰撞注册与 NAV_CLEARS。
   - 任务 2.2 (05b-props): 塔拉瓦椰树叶片与构件使用 THREE.InstancedMesh 实例化，保留 rec.meshes = [grp] 契约与倒伏/沉入/燃烧机制。
   - 2.3 (03-terrain, 05c-layouts): 地形 4x4 分块（16 块）绑定包围球视锥裁剪，保持 refreshTerrainMesh 接口不变。
   - 2.4 (05-world): 阴影通道轻量化裁剪，mesh() 默认 castShadow = false，主体显式开启，装饰细碎构件关闭阴影。
4. **Phase 3 HUD 与数学槽优化**：
   - 任务 3.1 (22-hud): 60 FPS 直写 DOM 迁移为 hudText/hudStyle 等去重包装，载具/座位切换清理对应缓存槽。
   - 任务 3.2 (22-hud): 小地图朝向 sin/cos 计算外提。
   - 任务 3.3 (11-soldiers, 15-vehicles, 03-terrain): camForward(out), camRight(out), vehHitCyl(t, out), rayCyl 槽位复用，消除每帧垃圾回收压力。
- 判据与全量回归：verify-buildings (15 图 PASS), verify-destruct-20260927N (50/0), verify-worldrestore (10/0), verify-spec (60/0), verify-specbatch (79/0), verify-hudfix-20261007 (37/0), verify-foliage (全绿), verify-procgen (259/0), verify-zombie (46/0), verify-fire 11 (全绿), verify-boot (15 战役 LOAD OK), verify-text (全绿)。
- 版本戳升级: 20261007e -> 20261008a (全量 48 处同步更新)。

## 一.65 随机地图生成算法改造 · 群系化(2026-10-07e,待实机验收)
承裁定④后半"群系化(下批)"+ 收尾 2026-10-07d 遗留的随机图生成缺陷。**群系表**(00-config `PG_BIOMES`: farm 农村平原/town 城郊镇集/water 水乡河网; 键序=哈希取模序; `PG.biome` 由 splitmix32(seed) 独立哈希抽取**不占 PG 随机流** ⇒ farm 同种子逐位=2026-10-07b 基线, `dev/_pgfarm-baseline.json` 钉 12 种子, verify-procgen 每次逐位比对)。**town**(病根: 旧版按主街折点比例取锚, 62~82m 主街折点全落广场 22m 净空内 ⇒ 105 图 73% 只 2 旗)=主街加长 96~124 + "离核心 ≥26m 折点"锚点制 → 支巷×3(向外放射)+次街×2(法向 46~60, 新类 `cls='sub'`)+排屋采样(次街步距 5.0~6.6 恒建)+铁路货线(核心 66~80m 外, 05c railLine 逐段铺+小地图/部署图折线)+旗点 广场/东街/西街(次街端外延 20/30m 接巷 或 街内端点回溯)/站前(货线 ±14 顶点窗口×两侧法向×半径 15/19/23 共 84 候选, 预筛广场净空后取"与既有旗间距最大"), 无农田+林地 0~2。**water**(病根一: 滨河街沿**主桥切线**直铺, 河湾处街尾滑到对岸/入水 ⇒ 19/125 图带跨河路面; 病根二: 旗点极坐标抽样 74~95m 半径带半数落水/被广场净空拒 ⇒ 63% 图只 2 旗)=主河 9 顶点三级中点位移折线(端点钉半径 178)+石桥 2~3(kind stone)+徒涉滩(距桥 ≥55 外围顶点)+支汊 1~2 出图缘+鱼塘 2~4+水田 rice+**滨河街沿岸线偏移**(`bankPt`, 街心=主桥头核心/对岸堍)+**growClear 四级阶梯**(直连→远河 via→沿本岸绕→**拦河截断 growCap** 逐步判跨河遇河即停, 折线终点=本岸临水点)+**岸别单源** `bankOf/bankNrm/bankPt` 同为左法向口径(+1 侧=`CORE_BANK`; 符号写反=本岸街铺到对岸, seed 100350 实测固化为红线⑥)+旗点=**路网折点**(广场=主桥头堍/二桥=非主桥本岸桥堍 `WATERWORKS` 锚点/渡口=滩头接巷端点/对岸·上村=两案路顶点打分"间距最大 − 0.5×|环距−84|") ⇒ 旗数 4~5 恒真。**建造阶段**(05c/05-world)=铁路铺装 + 水乡桥头工事(每桥两岸桥头沙袋, footFree 门) + `placeAt` 新增 `noWater` 门(滨河地块 8 次抖动 ±2.5m 可能入水; 手摆图不传 ⇒ 零漂移) + **桥面旗弹药箱修**(旧版硬编码主桥 `bridgePt(-4,1.4)`: 水乡 2~3 桥时二桥旗箱摆到主桥 ~90m 外 + 桥头旗箱位与主桥旗箱**完全重合**=道具互斥破坏; 现"旧位 ≤16m 逐位沿用, 否则距旗最近桥 + 桥面内夹取贴旗点")。判据: **verify-procgen 重写为群系感知 259/0**(通用 21 条×3 群系×4 种子 + farm 基线逐位 + town/water 专属 + 同种子全同 + 非 procgen 零写入 + **240 种子统计段**: 分布均衡/旗数达标率/town 次街排屋恒 ≥2 均 ≥4/water 跨河违规 0·桥 2~3 恒真·滩 ≥25%·塘均 ≥2)+layouts **ALL PASS**(含 procgen 全链)+boot/zombie/zombie2/text 等全绿; 实测统计 farm 85/town 84/water 71, 旗数 farm{3:10,4:20,5:55}(3 旗为**基线原样**, 不追改以免动随机流)/town{3:4,4:80}/water{4:42,5:29}, 跨河违规 **0**, 桥{2:31,3:40}, 滩 31/71, 塘均 2.8, 次街排屋均 5.3。自检工具(临时脚手架): `dev/_pgdump.js`+`dev/_pgpng.py` 平面图渲染(farm/town/water 出图核对: 村舍沿街/次街垂直/滨河街随河湾/桥位/鱼塘/水田形态)。**已知边界**: "镇集地块总量 > 农村"未达(33.7 vs 33.5, 镇集身份改由结构断言承载: 次街/铁路/无农田/排屋线密度); 讨论稿 E 其余候选群系(丘陵密林/黄土沟壑/雪原冻土/山地隘口)未实现, 追加键须置于**键尾**并同步 `dev/_pgbase-capture.js` 哈希表(否则既有随机图群系归属全变)。验收清单: ①同种子三群系观感(farm 田野/town 街区+铁路/water 河网+桥+鱼塘); ②镇集次街排屋与站前货栈巷战手感; ③水乡"桥=咽喉"(桥头沙袋/渡口滩); ④小地图·部署图铁路折线; ⑤每图 30~37 地块在低画质档帧率。版本戳 20261007d → **20261007e**(49 处)。**全量回归**: run-all-verify 50 条沙箱探针 **45/61 次运行 exit=0**, 最终 4 条红**全为既有预存红账**(sink #13 ironbottom queueSink / naval 红线7 两栖车上岸开火 / airground R3 / phase4-7d S4), 与本批零交集; 顺带修探针盲区: `dev/verify-sink.js` 载入清单缺 `js/00c-procgen.js`(2026-10-07 批新增 00c 时漏补) ⇒ 跑到 procgen 图即 `PGDATA is not defined` 整篇崩溃、被误记进"同一条预存红" —— 补入后 procgen 沉没链 8 项全绿, 该探针只剩 #13。建造阶段逐群系开机: `SF_PSEED=100001`(town)/`SF_PSEED=12345`(water) 各 `verify-boot 14` LOAD OK; layouts 的 procgen 通路本就跑 42=water/7=town 两种子。EN 词条: 群系卡名×3 + 群系名×3 + 新旗点名×7 + sub 模板键(动态种子串走 `campSubT` 模板, 22-hud 两处)。
## 一.64 丧尸压力重构 × 幻影旗修复 × 主基地居中与附属建筑 × 预设图入口(2026-10-07d,待实机验收)
承五条反馈(四裁定, 见讨论稿)+中途追加四条+实机两报。**反坦克压力链**(裁定①扒车+自爆尸)=25-zombies cling 扒车(12m 扫车/2.8m 贴车/免装甲直伤 walker 3·runner 2.5·brute 12 每秒+lastDmgT 断边打边修)+车速>4.5 持续 0.6s 甩落自伤 15+vehiclePushSoldiers clingVeh 豁免+Tank._zClingN 减速(≥2 层×0.78/≥4 层×0.55)+turretAI 3.4m 机枪贴身死角(仅丧尸)+主炮 bruteOK(20m 外重尸 worth HE)+自爆尸 boomer 变体(180s 解锁/0.8s 引信冲刺/explodeAt R7+9m 车 vehDmg 180×(1−d/12)+6m 尸链/击杀 ZP25)。**节奏**(裁定②+追加提量 75+全域散布)=ZCFG.ramp cap 42→75·every1 1.15→0.85s+常规刷 60% 全图远域(均匀打分, 包围主题)/40% 近场环+L4D 事件波 FSM(静默 75~110s→预警 6s 播报"远处传来嘶吼"→连刷 8~16 只 0.35s/只, 波内 runner ×1.6·移速 ×1.25; 首波 90s, zombieMatchStart zSurgeT=0 修正首波被拖 180s 的 bug)。**绕行智能**(追加③)=卡 0.55s 侧向绕(±90° 挑 occBlocked 放行侧 0.8s, zDir() 单点注入不双移)+卡 1.6s 砸工事兜底; moveDir 一线避障分层不动。**火力支援索敌**(追加①)=14-bots 迫击炮无目标时轰最近尸群心(9m 簇≥3 只, 26~130m)+16-aircraft 飞机巡逻候选加尸潮密度分(9m 簇×16); 仅 ZOMBIE_MODE 内。**幻影旗修复**(裁定③前半)=applyFlagOwnership 尾部 solo 早退(旧版就近拆分兜底把最远 2 旗分给 1 队); 旗=中立 ZP 资源点(占旗+100)。**主基地居中**(裁定③后半)=00c procgen solo 双基地改写为村镇核心(baseAng 偏 8m, 路网从核心生长=环形路)+05c buildWorld 入口预设图取距原点最近旗外侧 7m(诺曼底=教堂旁)+营区布景 solo 只画一套。**基地附属建筑**(追加④全局要素)=基地**外侧**(背向中心; 第一版沿用帐篷 sgn 朝内=火制走廊/主街/基线走廊所在, 全量回归抓到三条真回归: 淞沪迫击炮弹道被民居拦截 killattr T3·城市图侵街 layouts·雾林守线路标穿墙 nav——翻外侧后全绿, 教训入交付文档)民居+木屋各一, placeAt 失败弃置, 海图除外。**预设图入口**(裁定④前半)=迷你大厅「战场地图」选择器(随机战场+全部陆地预设, Z_EXCLUDE canyon/coral/ironbottom)+ZOMBIE_MODE 放开(opensea/canyon 不开放)。**实机两报**=①startNewGame 丧尸页清 sf_zsub+写 sf_mzstart 直达键+整页重载(ZOMBIE_MODE 载入期常量+基地居中已烙进世界, 就地翻不回来); ②攻防守方票数 ×1.25 改 ×(ZOMBIE_MODE?1:1.25)(尸潮=共同威胁, 不再纯粹两队对抗)。判据: verify-zombie2-20261007 **63/0**(T1~T18 全链, 含 T17/T18 双修指纹)+verify-zombie 46/0(参数钉同步 cap75/every0.85/全域散布上限放开)+killattr 18/0+layouts ALL PASS+nav 8/0 回归修复; 群系化(裁定④后半)**见一.65 本批已落地**。验收清单: ①坦克停桩被尸群围拆/移动甩尸/自爆尸炸车有预警腹鼓; ②全图到处有丧尸(包围感)+预警播报后大波冲击; ③丧尸撞墙会绕不傻撞; ④迫击炮/飞机炸尸群不炸空点; ⑤solo 无敌旗/占旗+100ZP; ⑥诺曼底丧尸局基地在教堂旁+基地后有民居木屋; ⑦迷你大厅可选预设陆地地图; ⑧丧尸局点「新游戏」回标准征服; ⑨攻防丧尸局两军票数相同。
## 一.63 随机图无UI根因补刀 × 丧尸solo结算页 × F1 HUD开关(2026-10-07c,待实机验收)
承实机三报: ①**任意模式进随机地图整场无战斗HUD**(部署页可见能开打能结算, #ui 整局被压)——根因=**2026-10-07b 只把 24-main 的 inMenu 复核块前移到 initMenuUI 之前、旧位置的同一块没删**: mzstart 直达开局时 startGame 刚摘 inMenu, loop() 之后的旧块又按 `!inMenu&&!player.deployed&&!matchOver` 盖回去(部署页在 #ui 外故能玩)。修=删残留旧块只留前移块; verify-hudfix T1 三判据+植回旧块的阴性对照。②**丧尸solo结算页严重不合理**("德军 330票·0在场"无中生有+副标题"征服")——endMatch: solo 局兵力条第二行改 ☣丧尸战果行(已消灭 zStats/场上存活, 绿条=清剿进度), endSub modeName 位改"丧尸模式·单队生存/双队对抗"; 25-zombies 新增 zStats.killed 单源(die 累计/开局复位)。③**F1 隐藏/显示战斗HUD**(用户提案采纳)=body.hudHide 与 inMenu/inDeploy 同构整体压 #ui+#touchUI, 19-input 仅已部署响应+preventDefault, 提示条挂 body(挂 #ui 会跟着消失), 不进存档刷新回显; 帮助行+词条同步。判据: verify-hudfix-20261007 37/0(已注册 run-all-verify)。验收清单: ①随机图三入口(随机征服/丧尸solo/teams)落地后 HUD 全在; ②普通战役卡零回归; ③solo 结算两行=我方+☣丧尸、无第二队伍名、副标题含"丧尸模式·单队生存"; ④F1 战斗中隐藏/恢复、部署/暂停/结算页不受影响、刷新回显; ⑤EN 词条。
## 一.62 丧尸模式二次实修 × 随机战场 v3(2026-10-07b,待实机验收)
四报根因与修法: ①**UI 不显示**=24-main inMenu 复核块跑在 initMenuUI 之后把直达开局刚摘的 HUD 盖回去 → 复核块前移(复核先于自动开局); mzstart 顺带清 sf_openplay。②**撤三大波**(用户点名)=ZCFG.phases 删除改 ZCFG.ramp 连续爬坡(every 4.2→1.15s/cap 10→42/rampT 540s/runner 100s·brute 260s 解锁), 刷点环绕人类质心 38~62m(旧边缘环 228m 步行 2.5min 不进画=见不到丧尸根因), 候选偏好视线遮挡; zAnchor/zNearestHuman 单源。③**Bot 守基地**=zDefPosts(team) 防区单源(基地 9~22m 12 方位槽)+14-bots 虚拟旗 {id:'守',_zp} 不进 FLAGS 不触发占领。④**随机图 v3**=380 图全参数重标+加密(间距 6.5~10.5/旗环 3~5·2~3 栋/院落 50%/散居 6~9)+footFree 足迹回避(算法道具不进 B_FOOT)。验收清单: ①迷你大厅两入口进局后**有 HUD 有部署界面**(inMenu 修复的直接证据); ②丧尸局 30 秒内见到丧尸从遮挡后出现、持续有压力(再无"三大波空窗"); ③Bot 全程守基地不跑旗(solo/teams 两档); ④空种子连开两局图不同/钉种子复现; ⑤新图 380 尺度建筑密度/丘陵/围栏观感(多试几个种子)。
## 一.61 迷你游戏大厅 × 丧尸模式实机修复 × 随机战场 v2(2026-10-07,待实机验收)

> 承用户首轮实机六报:①迷你面板全空白(showPanel 漏 mMini)+按钮位次;②种子固定(00c 回写 sf_pseed 根因)且无输入;③从战役卡进随机图=无丧尸无UI还两队(根因:卡路清 sf_zsub);3.1 单队模式凭空两队(own:1 旗+敌票条);3.2 Bot 照常征服推进;3.3 无阵营/天气/昼夜选择;④图大/空/平、建筑公式化、夺点一条线。裁定:**随机地图作战整体撤出战役列表,只从迷你游戏大厅进**(大厅=丧尸模式+随机战场·标准征服两入口,共享种子/阵营/昼夜/天气选项)。
> 落地: 大厅重构(index.html mMini+22-hud initMiniPanel)/种子语义(空=每局随机,数字=钉死)/单队生存真实化(05c 清 own+票条显 ☣ 丧尸数)/14-bots 守势评分分支/procgen v2(地图 520+三层噪声高度场网格 105×105+沿路·核心·旗圈压平+地基坡度门+村舍簇·院落·散居·临街围栏·路旁树+旗点极坐标散布吸附路面/接短巷)。
> 判据: verify-procgen 122/0(贴路/非一条线/不回写/高度场/压平新判据)·verify-zombie 38/0(T2 摆尸射线门逐字复刻感知公式+归位清节流)·verify-boot procgen 全链启动·verify-nav/navspots HEAD 清单补 00c/25-zombies 后 8/0。版本戳 20261007a(49 处)。**待实机验收清单**: ①迷你大厅两入口+选项齐(阵营名随种子变化)②空种子连开两局图不同/钉种子复现③单队生存: 无第二队伍·旗全中立·票条 ☣ 计数·撑过10分钟胜利·全灭失败④双队: Bot 守旗不远征·丧尸照常⑤新图观感: 丘陵起伏·村舍簇·围栏·密度·旗点不一条线(多试几个种子)⑥昼夜/天气在丧尸局生效。

## 一.60 本轮平衡批:体能回体 × 出生朝向 × 生成/补给箱平衡 × F 键准星锁定 × 难度标准档(2026-10-06,待实机验收)

> 承用户五报(同日四项裁定经 AskUserQuestion):①巡飞弹/固定火力点不回体 + 跑步开枪掉速且体能异常加快;②难度太高"精英总被秒杀",要求综合全局降难;③补给箱露天乱摆+生成点无避敌,落地/拿补给即被秒(要兼顾 Bot);③.5 补给箱与迫击炮贴近时 F 选中歧义,要求"准星对准谁 F 就锁谁"的通用机制;④出生面朝最近敌人。裁定:**屏息只降耗**(激活逻辑不动)/**难度只削 Bot 对玩家**(互殴烈度不变)/**标准档力度**/**生成软惩罚+保护延长**(非硬门)。详见 `finished-docs/交付文档-平衡批-体能生成出生难度交互-2026-10-06.md`。

### ① 体能(20-player)
- **回体单源 stamRegenTick**("1s 冷却窗+0.16/s"):主步行链与**八处早退分支**(巡飞弹 TV 制导/坦克/飞机/onAT/onAA/onMG/onBattery/onMortar/onNaval/大舰炮位)共用——旧版这些分支在体能结算前 return ⇒ 体能冻结(不耗也不回)。观战飞行分支补 `p.stamina=1`(旧版连恒满都到不了)。
- **屏息降耗 0.3→0.12/s**(≈冲刺 1.36 倍,满条 8.3s):病根是"按住 Shift 冲刺时开镜自动激活屏息"的交互陷阱(旧耗速=冲刺 3.4 倍+开镜减速),裁定保留自动激活只降耗。

### ④ 出生朝向(14-bots + 23-deploy)
- 单源 `spawnYawAt`(最近存活敌人,玩家在 Bot 选敌内):玩家部署从实际落点起算、Bot spawn() 同款——旧版玩家面朝世界原点、Bot 沿用上一命朝向,双双向背敌落地。载具出生按车体朝向覆盖不变;无敌时回退旧逻辑。

### ③ 生成平衡(17-emplacements + 00-config + 05c-layouts)
- **pickSpawnPoint 评分纳入敌情+死亡热度**(与 Bot lane 层同款数值:<16m−280/<30m−100/45m 内每敌−16/热度−32):玩家与 Bot 两条路径单源共享,软惩罚不设硬门;Bot 形成"lane 粗判+落点精判"两级。
- **SPAWN_PROT 0.5→2s**(玩家/Bot 同享,开火即清账不变)。
- **补给箱贴墙/靠掩体**:随机采样段谓词与早退时机逐位保留(wr 流零漂移,layouts 13 图指纹实证),首个净位先记账,24 个确定性环位按 `crateCoverScore`(建筑足迹边距 1.7m 甜区为主、沙袋/树干等道具 1.3m 次之,margin 二分反演距离)优选,>+0.3 才换位;基地箱/甲板箱/桥面箱不动。

### ③.5 F 键准星锁定(20-player)
- 单源 `xcInteractLock()`:执行半径内+可用判据同款(empReady/敌我/资源门)+屏幕中心射线夹角最小且视线不被遮挡(容差 0.8m,角度阈 `atan2(half,dist)+3.2°`)⇒ `{kind,obj}`。tryInteract 13 类地面候选各自只改"候选选取"一处(锁定类用锁定对象、其余让位;无锁定逐位走旧栈);提示层同款守卫=**提示与执行同一单源**。座位/甲板/跳帮/前摇/观战层(①~⑥)不参与(自身状态操作无歧义)。顺带补齐机枪/迫击炮/AT/AA 提示的 empReady(修"重建冷却期提示可用按 F 无响应"在案残留)。

### ② 难度标准档(00-config + 13-combat + 14-bots + 15-vehicles + 16-aircraft)
- **DIFF_TABLE 拆对玩家列 pReact/pSpread/pDmg/pVis**(原四列=互殴语义逐位不变):新兵 1.0/2.0/0.6/0.72、老兵 0.68/1.25/0.8/0.85、精英 0.5/1.05/0.9/0.95 —— 精英对玩家≈旧老兵档、新兵再友好 ~15%,梯度保留。
- 接线(全部按目标 isPlayer 分流):fireBullet 枪弹 pDmg;**HEAD_CAP 镜枪豁免对玩家关闭**(Bot 镜狙爆头对玩家 240 一枪必杀→封顶 95 两枪,打 Bot 仍一枪)——"总被秒杀"主诉源;perceive 视距/反应/甩枪、damage 还击、aimShot 散布;坦克 AI 对玩家驾驶的车反应/首炮/散布 ×1.3 + **炮弹直击步兵对玩家 260→180**;高炮对玩家座机反应 ×1.3/散布 ×1.4/伤害 pDmg;战机缠斗对玩家反应 ×1.5/进入距 ×0.85/射速 ×1.15,对地扫射对玩家 ×0.8/×1.15。

### 判据与预存红账
- 全量 run-all-verify 58 次 42 全绿;稳定红 4 条**全部经 HEAD worktree 基线证实预存**(与本批无关):verify-sink #13 ironbottom queueSink、verify-naval 红线7(在案偶发族)、verify-airground-balance R3(HEAD 同红+A/B 二次定责)、verify-phase4-7d S4(HEAD 同红)。
- 锚随码走 4 处(断言注明批次+语义不变):spec T8(60/0)、phase3 S2a(65/0)、phase4-7a S9(37/0)、navalround5 登机计数 3→4(23/0)。**layouts 13 图指纹全过=随机流零漂移实证**。
- 版本戳 20261006a → 20261006b(47 处)。

## 一.59 本轮修复：终局判定补漏（同归零死局 + 1v1 倒计时对齐）× 雨雪顶面遮挡（2026-10-06，待实机验收）

> 承用户两报：①「雨雪天气下有房顶的室内也漏雨雪」②「双方都是 0 剩余人数时无法结束战局；双方都剩 1 人时先只剩一人的先跑完 30 秒而输掉」。两项取舍经 AskUserQuestion 用户裁定：终局=对齐倒计时+平局；遮挡=所有水平顶面。

### 终局判定（21-match + 22-hud）
- **同归零死局**：`z0&&z1` 分支旧版只有"双方场上都清空→平局"一个出口，一方先被清空时无任何判定（`else if` 链够不到）⇒ 战局永挂；且同归零局"占满全旗"无人能完成（双方封重生）⇒ **旗权条件同归零豁免**：一方清空→对方立即胜，同帧双清→平局（T3 口径保留）。
- **1v1 倒计时对齐**：门槛 `flagsLostOf(1-zt)===0` 在同归零局一并豁免；双方都剩最后 1 人时**后启动者把双方计时都重置 30s**（先剩 1 人者不再先跑完先输），双双到点=平局、单侧到点=对方胜（旧口径）。到点判定移出累计循环兜同帧。
- **实现教训**：启动/对齐与扣减拆两段——同帧内先对齐后扣减会留 1 帧错位（0.05s），先到点方被误判负（T18 首跑抓获 `wT=[0.05,-0.00]`）。
- HUD wipeLine 同归零后不再显示"须占满全部旗点+"。
- 判据：**verify-wipe 88→91 全绿**（T16 同归零一方清空即胜/T17 豁免+对齐 29.95:29.95/T18 双到点平局；T9 旧门槛用例保留绿=非同归零口径不变的阴性自证）。

### 雨雪顶面遮挡（08-effects）
- **RAIN_COVERS**：每 1s 重扫 BOXES，收编"带可见网格的水平面板"（厚 ≤1.5m + 最小边 ≥0.8m + 面积 ≥1.6㎡）；`!b.mesh` 拒收（隐形纯碰撞体不让雨半空消失），竖墙/沙袋墙/小箱被几何门槛挡掉；屋顶/楼板/桥面/碉堡顶/帐篷顶/塔台全命中。
- **粒子顶面终结**：头部进投影且低于顶面 ⇒ 原地回收（y 回盒顶 + **x/z 重随机**——不重随机会让屋顶上方粒子单向滞留、旷野密度越抽越薄），与落地/落水同款视觉。每帧短名单（高于盒底 + 投影搭上 ±26m 盒），盒顶之上高顶面保留（桥下=干物理正确）。
- **破坏零钩子**：killBox 置 dead ⇒ 短名单 `b.dead` 当帧剔除=**塌顶当帧漏雨**；23b 还原复活同批对象=自动恢复。已知边界：大舰甲板在 15g 独立碰撞体系不在 BOXES，舰面仍穿（另批接）。
- 判据：**verify-weather 291→300 全绿**（T9 雨/雪双路径：收编+三类拒收/投影下 35s 零粒子/塌顶漏雨样本 13077/顶外零回归）。
- 回归：daynight 84、fire、hudfb 64、boot 全绿；menuart 1 红=预存（战役数 14 vs 表 12，stash 复现，另案）。

## 一.58 本轮修复：五支镜狙换弹改「从枪身下方往上塞」= 腹面上顶路径 × 入口前移弹仓口 × 抬枪入画（2026-10-05，待实机验收）

> 承用户第四道口径（先令"上网查这些枪怎么换弹"、看过核查表后裁定）：「把那些狙击枪都改成'从枪身下方往上塞'」—— 五支镜狙 = 春田 M1903A4 / Kar98k ZF41 / 莫辛 PU / 九七式狙击 / 中正式狙击（`d.scoped`）。其余枪未动。

### 路径（五支共用一支，几何全从模型量）
- **自下而上**：夹自画面右下（弹袋）沿枪身右下缘上升 → 收到**弹仓口正下方** → 贴腹面**上顶**：夹顶先进枪身、依枪体自遮挡逐步没入（**不是瞬移消失**），整只没入即隐形；拳在夹**正下方**顶夹底上推，到腹面即停（`min(c.y,belly+hy)` 钳位，指节不进枪身）。
- **入口前移 12cm 的依据（出图实证）**：夹的造型静止位在机匣后桥，其后桥正下方离镜头太近、投影正好落在画面下缘之外 —— 整段动作在画外。前移到**弹仓位置**：既合弹匣该待的地方，又因离镜头更远而抬进画面。
- **腹面单源**：`vmPortPlan` 新测 `bellyY` = 道具足迹下**最低底面**（枪托底/机匣底；只取 min y0，侧旁枪栓底面高不会抬高腹面）；没入终点 = 腹面 + 3cm（夹底沉腹面内侧 2.5mm）。
- **抬枪入画**（新手法）：换弹期根姿态抬 7cm（k0.14-0.34 抬 / k0.72-0.90 落回；同包扎态"整体抬高到视野中部"，根姿态把枪+双臂一起带走，左握把手不会脱手）。
- **滚转收幅**：镜狙 0.5 → 0.32 rad（不再需要把受弹口摆向镜头；用户既有红线"不得大幅翻滚"）；非镜枪桥夹仍自上压入、滚转不动。
- 镜管不再参与：此路彻底绕开"镜管压住受弹口 + 从正上方硬塞"两条旧病。

### 工具修正（dev/_vmreload-view.js，Dev 件不入库）
- **透视深度插值**：原光栅用屏幕线性插值 z —— 透视档下会让"被大三角面盖住的近处小件"反被画出来（实证：藏进枪托腹内的夹在 game 档透出、同帧正交档正确遮住）。已改插 **1/z（标准透视校正）**，正交档保持线性；[pose] 行补 root/rootR/clipW 世界坐标。**"藏进枪身"类判据只信修正后的 game 档**。

### 判据与回归
- 出图：五支镜狙 × 全相位亲视（夹+手自画面下缘入画 → 贴腹面 → 上顶没入 → 手停在腹面下）；**加密扫描 9 相位 × 5 键 = 0 穿模**。
- verify-boot exit 0（全链 LOAD + ironbottom 票据）；verify-animfix 39/0；verify-hudfb 64/0；verify-nade-trigger 107/0；verify-aimassist 40/0；verify-phase4-7b 42/42；verify-matseam 44/0；verify-vehmodels 10/0；verify-fixbatch 55/0。
- **既有边缘量（非本批引入）**：非镜栓动在 k0.62-0.66 有手掌贴枪托 ~2.2cm（略超 2cm 核定融合容差；相位加密后才显形，用户裁）。
- 版本戳 `__sfStyleVer` 20261005c → **20261005d**（index.html 内 47 处 ?v= 同步）。

### 实机验收清单（用户）
① 五支镜狙换弹：夹+手**从画面下方**上来 → 在枪身腹面（弹仓口）往上顶、夹被枪体吞进去 → 手撤离并回握把；全程**不从枪身上方**经过、不碰镜管。② 换弹期枪整体抬起约 7cm（为把腹面动作带进画面），不喜可调小/取消。③ 非镜栓动（桥夹自顶压）、加兰德漏夹、弹匣类（含 BAR）与上一版手感一致。

## 一.57 本轮修复：第一人称换弹动画三次裁定批 = 拳位偏移重定（道具不再被拳+袖吞）× 加兰德真受弹口 × 漏夹/换匣路径与节奏重排（2026-10-05，待实机验收）

> 承用户三次指令：③「核心是空间逻辑问题」（文档给了首轮"怼顶消失"的病）；④（Ctrl+F5 强刷后实机复验）「现在 M1 加兰德的换弹动画是：弹夹穿模卡在右手腕上，从步枪枪机正上方硬塞入步枪」→ 本批（三次裁定，结构定案）。前一版（一.56）的浏览器缓存疑点已被强刷排除：**是代码病**。

### 病根（两条都在空间逻辑，不在参数）

- **① 拳把夹"吞"了**：抓握偏移照抄了"手贴住道具"的直觉 —— 夹位 + (0.008,-0.022,-0.038)。拳盒半深 0.05 > 夹半深 0.03 ⇒ 夹后半截埋进拳里、前半截顶着一袖之隔的袖管 ⇒ 实机"弹夹穿模卡在右手腕上"。**同一偏移对弹匣类同病**（拳盒比匣半深大）。
- **② 机匣顶是实心板**：落位怎么调都是在"穿"机匣顶 ⇒ 实机"从步枪枪机正上方硬塞入"。数值穿模探针查不出这条（0.005 容差下"沉进顶面"本就是 0 越界），**必须出图判观感**。

### 修法

- **抓握单源重定**（`vmHandGun` 延迟解算，10-viewmodel）：拳位 = 道具位 + 枪系偏移 **(右 1cm, 下 1.6cm, 后 hz+4.6cm)** —— 拳在道具**下后方**、拳面前沿贴道具背面 4mm 设计内融合，整只道具露在拳前上方；拳姿态 = **根姿态 + 枪系抓握偏角**（随枪的俯仰/滚转一起走，根姿态定型后统一解算）。栓动桥夹 / 加兰德漏夹 / 顶置·下置弹匣 四条路径统一换用。
- **加兰德真受弹口**（09-weapons，仅 `srcKey==='garand'`；M1 卡宾枪借同款模型但换弹是旧版，仍实心机匣）：机匣拆成左右壁(各 1.25cm)+前壁，口宽 2.5cm（夹 2.2cm，单侧 1.5mm 净空），口沿 0.0525、仓底即枪身木面 0.0255（深 2.7cm）；枪管尾端退到 z=-0.09 让出夹的下落道（原先管尾伸进道里）。
- **漏夹时间轴重排**：携行位(画面右下, k0.10) → 举到枪右前上方(k0.30) → 收口上对正(k0.44) → **落口沿正上方并把 x 收回中**(k0.50, 夹比仓口只窄 6mm, 不在口上横移) → **压入：夹底沉进口内 3cm**(k0.60, 拳底恰好压到口沿即止) → 手撤离(k0.58-0.72 抬向右后) → **枪栓复进把夹推到底**(k0.66-0.84, 夹顶没到仓底之下 ⇒ 就地隐形, 消失有机械原因)。枪**向镜头侧滚**(rz +0.20, 旧版滚反了口面背对镜头)。
- **撤离中途位出画**：四条路径的中途位 (0.05,0.115,0.15) 距镜头仅 23cm ⇒ 成"大屏手"; 改 (0.145~0.155,-0.02~-0.045,0.075~0.085), 出右缘后落回默认握位。

### 判据与回归

- 出图 `dev/_vmreload-view.js` (game 实机取景 900×506 + VMTAG 上色): 加兰德 10 相位逐帧亲视 —— 拳在夹下后方、夹整只可见、k0.50→0.60 沉进口内、0.80 后手已撤夹已在仓内; kar98/zb26/bar 复视同构。
- 数值穿模扫描: 22 键(夹/匣全库) × 6 相位 **0 穿模**; verify-boot exit=0(全链 LOAD + ironbottom 票据); verify-animfix 39/0; verify-hudfb 64/0; verify-nade-trigger 107/0; verify-aimassist 40/0; verify-phase4-7b 42/42; verify-matseam 44/0。
- 版本戳 `__sfStyleVer` 20261005b → **20261005c** (index.html 内 47 处 ?v= 同步)。

### 实机验收清单（用户）

① M1 加兰德: 漏夹是**捏在手里**从右前上方来 → 沉进机匣口内 → 手撤离 → 枪栓把它推到底（不再"卡手腕"、不再"从正上方硬塞"）；② 栓动桥夹（Kar98/中正/莫辛/三八式/汉阳造）: 夹整只可见、手在夹下后方；③ 顶置弹匣（DP-28/九六式/捷克式/歪把子/反坦克枪）与 BAR 下置弹匣: 匣整只可见、手不在匣里；④ 手枪/冲锋枪仍是一.56 的旧版快速换匣（本批未动）。

## 一.56 本轮修复：第一人称换弹动画二次裁定批 = 手枪/冲锋枪完全回调旧版（vmLegacy 15 键）× 机枪/反坦克枪/BAR 保留物理换匣并收幅 × 栓动/狙击取夹行程与滚转收幅（2026-10-05，待实机验收）

> 承用户两道指令：①「换弹基本都是从上方塞入弹夹，狙击枪则是从右侧面塞入弹夹，和现实严重不符且穿模、不符合物理规律」→ 全枪种重做（首轮）；②首轮实机复验「现在正是全是把弹夹从枪的正上面放入！手枪的换弹动作非常浮夸！请把手枪、冲锋枪的换弹动作完全回调，并认真优化步枪、狙击枪的换弹动作」→ 本批（二次裁定，架构定案）。

### 手枪/冲锋枪/卡宾 = 完全回调（`d.vmLegacy` 单源标记，09a-defs）

- **15 键**：m1911/p38/tt33/nambu/c96/c96auto（手枪）+ mp40/thompson/ppsh/stg44/type100/mp18（冲锋枪）+ m1carb（卡宾）+ mortar/specsniper（无匣件特种枪，补覆盖率漏洞——旧版左手辅位动作对全通用分支生效，漏标即丢）。
- reload 弹匣分支按 vmLegacy **原样恢复 HEAD 旧版**快速换匣：下拉 0.18 → 短隐 0.06 → 自下方推入 + 左手固定辅位（逐行照抄，含其既有接触，不"顺手修"）。
- **浮夸根因**：首轮"携匣大回环"——出匣 0.42 / 入榫 0.5（约一根枪长），弹匣甩出画面、整条手臂跟甩，用户判「全是正上面放入/浮夸」。连带撤销：MP18 左横插单源 `vmMagCycleSide`（删除）、驳壳枪桥夹压弹链（`clipLoad` 标记 ×2 + 09-weapons 桥夹道具件 + 探针豁免），clipLoad 全库绝迹。

### 机枪/反坦克枪/BAR = 保留首轮物理路径 + 幅度红线 ≤0.18

- `vmMagCycle` 单源保留给 dp28(pan)/type96·zb26(topmag)/type11(hopper)/type97at·boys·ptrd(atr)/bar（下置）：旧版「顶置弹匣沉进机匣再从枪身里升回来」是立项要修的反物理，**不随本轮回调**。
- **幅度红线**：出匣 0.14+坠势 0.04、入榫 0.16、倾斜 ≤0.06rad（≈一只弹匣长的行程），持匣手跟随不变；写死进单源注释，后续再动此函数不得超红线。

### 栓动/狙击/漏夹 = 认真优化（收幅不改结构）

- 取夹/撤夹行程收敛：(0.24,−0.22,0.14)→(0.19,−0.15,0.12)、撤夹 (0.26,−0.12,0.14)→(0.20,−0.10,0.12)——手臂不再甩出画面；漏夹/桥夹手位、开合栓节奏、手陷机匣修复（首轮）全保持。
- **镜狙击滚转 0.62→0.45 rad**（35° 翻船感 → 26° 斜口仍够压弹），ry/rx/ox 系数同比收；**压入点 (0.038,0.078,0) 不动**——镜管净空是枪体空间几何（夹左缘 0.027 > 管半径 0.021+2mm），与滚转无关。

### 判据与回归

- `dev/_vmreload-view.js`（vm 沙箱换弹姿态出图 + 数值穿模自检）：37 键 × 10 相位 = 370 姿势 **0 穿模**；补漏后 12 键终扫 48 姿势 0 穿模。**vmLegacy 路径豁免门槛**（旧版既有接触：k≥0.7 左手辅位贴机匣 ~1.8cm、入榫末段 ~8mm——用户裁定原样回调即接受现状，探针内注释注明，勿再当新病报）。
- verify-boot 全链 LOAD OK（41 文件 + ironbottom 票据）；版本戳 `__sfStyleVer` 20261005a → **20261005b**（index.html 单处）。
- 出图复核：kar98zf 右视 = 枪身 26° 右滚 + 镜管让位 + 弹夹随手斜向受弹口；dp28 顶压中段 = 弹盘悬于机匣正上方 ≤0.16；thompson/nambu/c96 = 旧版小幅换匣（与回调前一致）。

### 实机验收清单（用户）

① 手枪（南部/C96/快慢机/1911/P38/TT33）与冲锋枪（汤姆逊/MP40/波波沙/STG44/百式/花机关）换弹手感应与首轮改动**之前**一致；② DP-28/九六式/捷克式/歪把子/反坦克枪 = 顶置换匣（上抛上压、小幅度）；③ BAR 下置换匣（下拉下推、小幅度）；④ 栓动/狙击 = 取夹→压弹→撤夹连贯，狙击枪身微右滚不再大幅翻滚；⑤ 加兰德漏夹压入与"叮"不变。

## 一.53 本轮新特性：昼夜模式 N1+N2 全量落地 = 夜间修正层(视觉/感知/信息) + 四项照明装备 + 车毁黑锥修复（2026-10-05，待实机验收）

> 承 2026-10-05《昼夜模式设计》（设计文档在仓库根，六条裁定 R1-R6 双方确认勿再议），用户令"开工，完成N1和N2"。实机验收由用户执行，探针先行。

### N1 视觉+感知+信息（纯调参/门控，白天零回归第一红线）

- **单源三件**（00-config，`THEME` 冻结后）：`NIGHT_CFG`（视觉+玩法+小地图全参数）、`NIGHT_MODE`（ironbottom **强制 true**，否则读 `sf_daynight`）、`NIGHT_GEAR` + `SEARCHLIGHTS[]` 登记表。菜单昼夜钮（22-hud `.optBtn dnBtn` 惯例，ironbottom 置灰锁夜 + 提示行）。
- **视觉**（02-scene 5 处门控）：exposure 0.72 / dryFogFar ×0.55 / dryFogNear 40×0.8 / 雾色 `nightFogColor` 向夜蓝 lerp 0.6 / 天空换月亮+星点（Points，sizeAttenuation:false）/ 云 ×0.35 / hemi ×0.45 / sun=月色 0xa8c0e0 ×0.30 / vmScene 灯 ×0.5；10-viewmodel 枪口灯与 08 flashLight 距离 ×2.2；01-audio 鸟鸣夜档静音；22a `MA_TINT` 补 nightsea + `_maDim` 夜档压暗沙盘。**关键钉死点**：initWeather 写绝对光强 ⇒ 夜档系数以 `_nSun/_nHemi` 内联乘进每个天气写点与**雷暴闪电路径**（否则夜图被闪电打回白天亮度）。
- **玩法**：Bot viewD ×0.55（蹲姿 0.85 门随动）/ 听声 65/70 ×1.5 / 交火半径三处（botEngageR·EMPL_AA_ENGAGE_R·huntR）×0.7 / aim assist 距离 ×0.65（锥角/K 不动，分档契约不破）。
- **小地图夜规（R3 复活 2026-09-06 旧规）**：`mmEnemyVis` 单源 = 开火 2.5s 内 OR 距离<60m；观战/死亡旁路全显；drawMinimap/drawBigMap 两图四类图标（兵/坦克/卡车/机）共用。
- **白天档**：所有消费点 `NIGHT_MODE` 门控，白天分支表达式逐位未动（探针 T1 双向验证）。

### N2 照明装备（R4 四项全批）

- **车辆大灯（L 键**——V/H 均被近战/包扎占用，通读全键表后定 L）：坦克/卡车/小艇（tkSpec 挂点单源/艏部甲板）；假光锥+辉光全员可建，真 SpotLight 池 ≤2 按相机距离竞选（`sl.target` 已入 scene）；AI 状态机=行进开灯/交战关灯、卡车常亮、小艇 'run' 才亮；开灯车对 Bot viewD ×1.8 且无视 FOV 门（暴露判据）。
- **旗点周期照明弹**：仅 conquest/assault 陆上旗点（跳过 `f.ship` 甲板旗）；28s 周期错峰+8s 燃烧窗，地面亮斑+缓降光点；真 PointLight 仅 1 盏给最近旗点；半径内 Bot viewD ×1.4；**相位只走 Math.random，绝不进 wr/wri 布局种子**。
- **探照灯**：05a 灯塔 + 05c 滩头静态灯位登记 `SEARCHLIGHTS`；光柱 additive 锥 ±60° 扫掠；照中玩家记 `_searchLitT` ⇒ Bot ×2.0 且无视 FOV 门。旗舰探照灯按设计"看工期"殿后未做。
- **飞机翼尖夜航灯**：红/绿反相闪 Sprite（仅夜档创建）；die() 按信标同款先摘后 clone 再挂回（残骸不闪灯）。
- **灯预算红线**：真 PointLight 同屏 ≤3（枪口+爆炸+照明弹）、真 SpotLight ≤2。

### 车毁黑锥修复（用户实报"开灯坦克被毁留黑色不透明锥体"）

- **根因**：坦克/卡车/舰艇残骸焦黑化都是 `grp.traverse(o=>{if(o.isMesh) o.material=wreckMat})` 整组换材质——大灯假光锥是 grp 里的 **Mesh**（被换成不透明焦黑=黑锥残留），灯口辉光是 **Sprite**（isMesh=false 不在换材质之列=残骸上两个发光点）。
- **修法**：单源 `vehHeadlightKill(veh)`（08-effects：摘 `_hl.grp`+`lightsOn=false`），**Tank.die / Truck.die / NavalCraft.beginDestroy 三处在焦黑化 traverse 之前调用**；拆灯不进 mat0 账，与 15-vehicles/15d 的 respawn 材质还原链两不相扰（重生后按需重建）。主力舰座位走 onCapital 不设灯，无需接线。
- **探针 T6**：真实 die() 链验证拆灯（灯组物理摘除/光锥材质不被 wreckMat 覆写/死车退出灯池竞选）+ 卡车/舰艇接线静态断言。

### 判据与回归

- **新探针 `verify-daynight`（84 断言）**：T1 白天零回归（baituan 昼档逐位）· T2 夜档视觉+normandy overcast×夜+ironbottom 锁夜+校准样本 · T3 感知/信息（昼 vs 夜双向：85m/65m/96m/探照灯/照明弹/听枪/吸附/小地图矩阵）· T4 装备行为（大灯状态机/灯池预算/照明弹生命周期/探照灯照中/翼尖灯）· T6 车毁拆灯 · T5 静态接线 ~30 条 + **载入清单与 index.html 动态对账（不写死脚本数）**。
- **共享桩补齐（dev/_bootstub）**：`_Color.getHex/lerp`（夜档 nightFogColor 真调）+ `SpotLight`（带 target.updateMatrixWorld）+ PointLight 形参存储——**ironbottom 强制夜档 ⇒ 夜链路必须能过共享桩，否则所有载铁底湾的旧探针 LOAD 即炸**；verify-sink 私有桩同款补齐。`Obj3.remove` 补 `m.parent=null`（对齐真 THREE）。
- **判据随契约升级 4 处**：verify-airground S4 与 verify-phase4-7b S5（AA 交战行锚拆两段——夜档 ×rangeMul 插中间）、verify-touchpad T1h（ADS 门含 capitalGun，2026-10-04 海战批遗留）、verify-specbatch T10（KeyL 唯一出现=大灯键，非观战工具）。
- **T3 逐块清场**：夜档 boot 多块共靴时上一块 Bot 随机落位会偷靶（实测 ~1/3 偶发），各块开头 clearTroops/clearVehicles 后连跑 4 次 84/0 稳定全绿。
- **最终全量 62 支回归：52 过 / 10 红，10 红全部为下述登记在案的既有账（均白天跑，夜档代码不执行；两支载铁底湾的 navalround4/5/6 已全绿）**：verify-naval 红线7③（两栖车上岸不开火偶发族，§一.49 定责）· verify-menuart IDX 12<14（珊瑚海/铁底湾入表后未扩）· verify-20260921B-speed 与 verify-phase4-7d 的 FLAK_SPD 380 旧冻结（平衡批已定 460）· verify-uvscale cloth 未登记+UV 跨度 · verify-strongpoint BUILD_REG 空 · verify-a21-a4/a21-j（a21 族既有）· verify-surf 珊瑚海 lane · verify-sink #13 ironbottom「实例批下沉零缩放」（该探针未适配新海图的既有暴露——此前被 c.lerp 崩溃挡住从未跑到过 ironbottom，夜档零实例不相干）。
- 版本戳 20261004a → **20261005a**（47 处）。
- **实机验收清单（用户）**：①任选 3 图开「黑夜」：画面可辨不灰白、月亮星星云、雾距；②白天档冒烟（零回归红线）；③铁底湾锁夜钮置灰；④夜战 Bot 交火距离手感 ≈50m；⑤小地图夜规三态+观战全显；⑥坦克 L 大灯开关与 AI 车灯、开灯车更易被咬；⑦旗点照明弹节奏与地面亮斑；⑧灯塔/滩头探照灯扫掠与被照中风险；⑨飞机翼尖红绿灯；⑩**开灯坦克打爆后残骸无黑锥**（本批 bug 复验）。


> 承 2026-10-04 两轮海战审计合并清单（coral/ironbottom），用户裁定"全部开工修复"。

### 系统性 P0（第一梯队）

- **F1 炮手票务悬崖**＝capCrewSpawn 契约写"die() 零票务副作用"，但 Bot.die() 无条件扣 1 票 ⇒ 瘫舰时 spec.ticket(120~130) 外每个炮手再漏 1 票（BB 一次瘫掉 129-139 票=票池 40%），逐塔点名也各漏。修＝**14-bots Bot.die 免票分支**（capCrew：不扣票 + respawnT 钉 1e9，击杀归因/战报照旧）。
- **A1/B12 capLeadPoint 双病**＝艇（15d vel 是标量）读 vel.x ⇒ NaN 诸元；机（Plane 无 vel 字段）恒零提前量 ⇒ 大舰 AA 只打迎头机。修＝新单源 **capTgtVel**（大舰 velX/velZ、艇标量按航向分解、机走 velVec()），capLeadPoint 改吃它。
- **B1 主炮提前量死代码**＝capBallistic 读 targetPos.velX/vx，但传入的是 capAimPoint 纯 V3 克隆 ⇒ 两分支全死。修＝fireMainSalvo 加 tgtEnt 形参（aiTick 传实体），速度经 capTgtVel 显式入参；玩家接管主炮打视线落点不传＝诚实弹道。
- **V2 命中胶囊艏艉外溢**＝单胶囊 r=hullW/2 直抵艏艉端点（艏部可见半宽仅 ~0.6m ⇒ 近失弹算 hull）。修＝**7 段变径胶囊**（艏尖 0.16R→艉 0.86R，段半径取放样宽度外包络），capitalRayHit/TorpedoHit/Splash 三处逐段测；旧字段保留=中段胶囊（兼容旧探针）。
- **A2 摆渡链清理**＝下客后 ferryTgt 残留（靠 !dr 兜底自愈一帧）；pickIdleNaval 无距离门 ⇒ 重生 Bot 认领几百米外空艇=游过致命大海自净。修＝capBotTick 下客即清 ferryTgt；pickIdleNaval 加 **NAVAL_CLAIM_R=110**（**仅 opensea 生效**——岛图认领远艇是既有行为，塔拉瓦红线7 依赖）+ 摆渡中艇不认领。

### 火控/飞机链（第二梯队）

- **F2 CV 死局**＝航母 main:null、secR 走全局 480，敌 BB mainR 620/环心距 516 ⇒ 全程纯靶子。修＝**规格级 spec.secR=580**（cv_us/cv_jp）+ `_pickShipTarget` 索敌门分档（无主炮按 secR）+ 副炮交战门同步；劣势保留（仍被 620 压一档）。
- **B13 高炮弹穿舰岛**＝updateFlak 只测机/步兵/坦克/海床。修＝加 capitalSolidAt/capSuperSolidAt 空炸判定，出膛豁免 0.02s（≈9m，防空炮位坐于上层建筑顶防出膛自炸）。
- **B14 轰炸瞄水线**＝dive aimY=deckY*0.6 ⇒ 世界水线上 2~5m（干舷之下）。修＝瞄**甲板面+1.2m**；投弹释放门按预测落点算提前量（capTgtVel 单源）；补**机-舰实体碰撞**（只撞舰体带——首版含上层建筑被 probe-planes 实测出"投弹改出撞岛自杀 7/8"后收窄，舰岛掠过维持既有视觉简化）。

### 操作/反馈栈（第三梯队）

- **U1/U2 主炮反馈栈**＝22-hud 无 capitalGun 分支（弹药面板显示步枪）+ 开火零后座。修＝HUD 加**炮位读数分支**（炮名+舰结构值+装填/冷却秒数+报废红字）+ fireMainSalvo 玩家射手 addTrauma(0.5)（与 15d 小艇主炮同档）。
- **V5 副炮/AA 出膛点**＝弹出生在座圈基座中心（贴脸目标先撞自家结构）。修＝沿射向前推 CAP_SEC_MUZZLE 2.6 / CAP_AA_MUZZLE 1.9。
- **V6 齐射炮口焰**＝只有 0 号管出火。修＝逐管炮口焰（硝烟保持塔心一团）。
- **U4/U5/U7 输入门漏 capitalGun**＝炮位座位上 G/3/4/6 挂手雷状态机（下炮瞬间扔活雷）、V 近战/H 包扎/B 建造/Z/X 全生效、右键误进 ADS。修＝19-input 加炮位座位门（与 onNaval/onBattery 同规一处挡完，只放行 F 下炮 + C 换炮位）+ switchSlot/ADS 补门。
- **U3 C 键换炮位**＝新单源 capGunCycle（本舰主→副→防空顺次循环，报废跳过，走 capGunMount 单源）。
- **V3 相机三处**＝thirdPersonOn 互斥清单漏 onCapital/capitalGun（炮位上第三人称追尾钻舰岛）；死亡镜头/第三人称相机地面下限=heightAt+0.35（opensea=海床 −22m 水下滤镜）。修＝互斥清单补两座位；两处下限改 max(地形, 水面)（与 capGunAimDist 同式）。
- **U12 步枪打舰零特效**＝弹着点连火星都没有。修＝capitalBulletTest 零伤分支补火星+灰尘+跳弹音（不扣血）。
- **U9 瘫舰红档**＝玩家打瘫敌舰只有得分弹字。修＝cripple 补 onPlayerWreck()（与击落战机同一条大目标击杀反馈）。
- **舰炮波及甲板步兵**＝主炮命中点对步兵零伤害（登舰读作"安全"）。修＝capitalShellHit 补 splashDamage(p,owner,team,7,240,560,ap,'explo')（友军免伤由 team 门自理）。

### 模型/视觉（第四梯队）

- **V1 夜战名实不符**＝ironbottom 复用 pacific 晴天白天+海上鸟叫，全库无夜间管线。修＝新 **nightsea 主题**（月夜档：深蓝黑夜幕/暗雾/半球光 0.55/月光 0.5 + birds:false + 植被归零）配 ironbottom；不做完整灯光管线（另案）。
- **V4 大舰零水花零引擎声**＝修＝CapitalShip 挂 createEngine('tank')（时停静音同 15d 残骸态口径）+ 巡航尾迹/艏波粒子（PT.drop，260m 相机距离门）。
- **V7 .50 俯仰视觉 ×0.8**＝与审计 14 的 yaw*0.6 同族（弹道全额、视觉 0.8）。修＝15d pitchG2 改全额。
- **V8 单烟囱冒烟**＝受损/瘫痪烟只出 0 号锚。修＝逐 smokeAnchors 出烟。
- **V9 海图符号压叠**＝注释说"大舰画在艇之下"，执行序写反（艇先画被 150m 舰轮廓盖住）。修＝小/大地图两处交换为先舰后艇。
- **V10 落水水花不分弹种**＝一切炮弹 1.3 档。修＝updateShells 按 dmgV 三档（舰炮级 ≥600→3.2 / 中口径 ≥200→1.8 / 其余 1.3）。

### 判据与回归

- **探针判据随契约升级 2 处**：verify-navalcap S10c（瞄准点锚 deckY*0.6→deckY+1.2）；verify-phase5 R8（瘫舰票 = spec.ticket，旧式逐炮手 +1 = 票务悬崖本体）。**navalcap S2a 补测前 capitalFlagTick(1/60)**（沙箱无 RAF ⇒ startMatch 复位后旗坐标残位属环境伪影，实测 tick 后偏差=0；与 S2b 阴性段同惯例）。
- 全绿：verify-boot 14 战役 LOAD ✓ · **navalcap 58/58** · **phase5-capital 41/41** · navalround6 44/44 · navalround5 23/23 · navalround4 20/20 · seabatch 8/8 · navalcrew 31/31 · naval-model 87/87 · killattr 18/18 · wipe 81/81 · text ✓ · probe-planes **14 战役无撞山 ✓**。
- **既有红（A/B 已定责，均与本批无关）**：_naval-selfcheck ③b/③c（浮标波场等值 2.62e-1m）、_navalai ①/⑦、verify-naval 红线7③（两栖车上岸不开火，~20% 命中率偶发族，§一.49 已登记）。
- 版本戳 20261003a → **20261004a**（47 处）。

### 悬置（审计清单中未在本批处理，待裁定）

- **F7 机毁票 = 机+飞行员各 1**：与坦克"车组各记一次"同规，不改。
- **D5 铁底湾舰载机无回收**（无航母可降落）、**V4 螺旋桨几何**（15g props 空表，属建模任务，须出图裁定）、**U6 兵种提示文案**、**U13 下车位移细节**、**E 级交互语义项**：留待用户逐条裁定。

## 一.55 实机反馈批：天气三项补全 = 天体接入天气层（日盘/月盘月斑/星空可隐可淡）× 天穹灰度+雾色亮度（亮度链补全）× 云层密度分级 + 全非晴档亮度重调 + 影随盘/曝光乘子（口追⑥⑦⑧⑨）（2026-10-05，待实机验收）

> 承 §一.54 天气批实机反馈四条: "无论什么天气白天都太阳当空照、夜晚都圆月明星（离谱且诡异）" /
> "非晴档都应有比较密集的云, 暴雨/暴雪天最密、特别密" / "没有太阳、下着暴雨的白天也那么亮？" /
> "暴雨天还是挺亮的, 而且只要是白天地上就亮且有光影/影子"。
> 设计单源《天气系统设计纲要.md》头注⑥⑦⑧⑨ + 新 §4.3 (天体/天穹/云/雾色/曝光) + §4.1 终版表已同步。

### 口追⑨ 追补（二轮实机反馈: 影随盘 + 天气曝光乘子; WEATHER_CFG 27 字段收官）

- **影随盘**: 硬影子此前无条件投射（"只要是白天地上就有影子"的病根）→ `sun.castShadow = NIGHT_MODE?true:WX_CFG.sunVis>=0.5` —— 只有晴朗/细雪（日盘可见）留影, 阴/雨/暴/中雪/暴风雪 = 漫射光**无影**; 夜档月光影子不受门（昼夜批零回归）。无影档顺带省 shadow pass。
- **曝光乘子 `expoMul`**: 曝光是全局亮度总闸（昼 1.05/夜 NIGHT_CFG.exposure 0.72）, 天气在其上再乘（阴 0.9/雨 0.8/暴 0.7/细雪 0.95/中雪 0.9/暴雪 0.72）—— 暴雨昼总亮度 ≈ 晴天 35%（expo 0.7 × 光照合成 1.416/2.8）; ACES 保高光, 枪焰/闪电/探照灯/照明弹不受累。与 sun/hemi 折扣（只压光照）、fogDim（只压雾色）、skyLum（只压天穹）互补, 各管一段。
- **探针**: verify-weather 268→**291 断言**（CELEST_SPEC 九列; 曝光逐档复刻; castShadow 七案例含细雪边界 sunVis=0.5 恰好留影; CE_SNAP 局部改名 sunSp 防遮蔽全局方向光）; 回归链 daynight 84/0 · boot ✔ · fire 全过。

### 单源扩充（WEATHER_CFG 18→27 字段, 全部晴档=1/0 现状逐位）

- **天体**: `sunVis/moonVis/starVis` 昼日盘/夜月盘(含月斑)/星空 不透明度乘子, 0 时整体 `visible=false`; 光照强度另走 sunMul, 盘隐藏≠光灭 (阴天是漫射光不是黑夜)。终版: 阴 0/0.25/0.15 · 雨 0/0.1/0 · 暴 0/0/0 · 细雪 0.5/0.5/0.5 · 中雪 0.3/0.25/0.2 · 暴雪 0/0/0。
- **天穹**: `skyGrey` 混灰率 × `skyLum` 灰目标亮度因子 (`_skyGreyMix(s,w,lum)`, 目标灰=基色亮度×lum; <1 即去饱和并压暗, 暴雨 0.55 出暗天, 暴风雪 0.9 保白毛风亮灰); 夜档同函数混夜色板, 夜空不会被提亮。
- **雾色**: `fogDim` 亮度乘子 (`_fogDimCol`), 昼夜两档同乘 —— 雾距压到 0.25 后视野大半是雾色, 不压雾色=拿亮灰漆满世界 (口追⑧ 病根); 水下雾 22-hud 快照当前色自动继承。终版: 阴 0.85/雨 0.7/暴 0.55/细雪 0.9/中雪 0.9/暴雪 0.75。
- **云层**: `cloudN/cloudOpMul` (晴 9×1 / 阴 20 / 雨 30 / 暴 42 / 细雪 16 / 中雪 24 / 暴雪 42); 非晴档同时放宽云带幅面 (±600→±750) 压低云底 (180-280→150-300) 加大云块, 每朵 rand 消耗数不变; 云朵画布 `_puff=255×min(1,skyLum)×(1-0.35×skyGrey)` (暴/暴雪≈100 深灰云盖)。
- **亮度重调 (口追⑧)**: 原 阴/暴 hemiMul 1.15 反而提亮环境光, 与"暴雨白天发暗"相悖 → 全非晴档 sunMul/hemiMul 压暗: 阴 0.5/0.9 · 雨 0.55/0.85 · 暴 0.42/0.72 · 细雪 0.55/0.95 · 中雪 0.85/0.9 · 暴雪 0.45/0.8。

### 消费点（全部 02-scene 四处 + 探针; R7 无新增字符串比较）

建穹五站 `_skyGreyMix(st[i],skyGrey,skyLum)` · 建雾色 `_fogDimCol(_fogBase,fogDim)` · 建天体三精灵 opacity (SpriteMaterial 本就 transparent, r152 默认) · 云块 cloudN/cloudOpMul/_puff。晴档: 建雾原值逐位 + 云 9×1 rand 序列逐位 = 零回归。

### 探针与回归

- **verify-weather 222→291 断言**: T8 规格表七档九字段逐档对账 + 02-scene 静态接线 + 七 boot 场景行为学 (场景图遍历认天体: 位置 -380,480 + scale 太阳220/月110/月斑 z=169 区分; 云=transparent 精灵 scale≥150; 星=780 顶点 Points) + 曝光/castShadow 逐档 (细雪边界钉 sunVis≥0.5 阈值) + 晴档雾色原值/云 9/曝光 1.05 零回归; WX_SPEC sun/hemi 列同步口追⑧ 值。
- **探针新坑 (登记)**: _bootstub Sprite 桩缺 `isSprite` 旗标 (Points/LineSegments 有、Sprite 没有, 此前无探针认过精灵) → 已补; 场景图遍历认类型必先对账桩旗标; 快照局部变量勿与全局方向光 `sun` 重名 (遮蔽)。
- **回归链全绿**: verify-weather 291/0 (两连) · verify-daynight 84/0 (天气×夜复合断言改引用 WX_CFG 档值复刻 —— 钉次序不钉数字) · verify-boot ✔ · verify-fire 全部通过 (火势行为学不涉本批)。
- **R1 例外清单扩至 ⑥⑦⑧⑨** (非晴档视觉与旧版不同, 系用户点名); **R3 校准样本下移**: ironbottom 夜 sun 0.165→0.15 / hemi 0.5175→0.405 / 曝光 0.72→0.648 —— 系"非晴档压暗"直接结果, 实机若嫌铁底湾夜过黑, 单点拧 WEATHER_CFG.overcast 即可。
- 版本戳 20261005a→**20261005b** (index.html 46 处)。

## 一.54 本轮新特性：天气模式选择 = 全图五档天气选择器（跟随地图+晴/多云/小雨/暴雨）× 七档单源系数层（雪图映射+夜档相乘联动）× 口追五条（压火势/雨族雾距/雾渐变/重档粒子）（2026-10-05，待实机验收）

> 承 2026-10-05《天气系统设计纲要.md》（仓库根，设计单源；开工中用户口追五条已全部回填文档头注与 §4 系数表）。游玩模式五引擎一律不动（§7 边界外）。

### 单源与解析

- **00-config 四件**：`WX_IDENTITY` 身份表（原 `WEATHER` 查表收编，15 图 id→身份档）+ `WX_SNOW_MAP` 雪族判据（身份==='snow'：斯大林格勒/莫斯科）+ 解析 `sf_weather`(map|clear|overcast|rain|storm)→`WEATHER_EFF` 7 值（clear/overcast/rain/storm/snowLight/snowMid/snowBlizzard；雪图映射：跟随→snowMid / 多云→snowLight / 小雨→snowMid / 暴雨→snowBlizzard / 晴朗=雪停）+ `WEATHER_CFG` 七档 18 字段总表 → `WX_CFG` 唯一消费入口。**相乘顺序钉死（R3）**：白天基线 × NIGHT_CFG × WEATHER_CFG（ironbottom overcast×夜校准样本不漂移）。
- **菜单五按钮**（index.html 昼夜行旁 `.wxBtn`）：落 `sf_weather` → reload（同昼夜惯例，点当前档不重载）；ironbottom **不锁天气**（只锁夜）；「跟随地图」选中时 `wxHint` 小字提示生效档（本图=小雨）；雪图四档文案换 雪停/细雪/中雪/暴风雪（data-wx 不变，文案按图族解析，00b-i18n 11 词条双语）。

### 十二处消费点收编（R7：全库禁新增 `WEATHER===` 字符串比较，探针全库审计 0 违规）

02-scene dryFogFar ×fogFarMul + dryFogNear 40×fogNearMul（渐变）· 08-effects 粒子建池（precip/precipN）+ sun/hemi 折扣 · updateWeather 落速 precipFall + **闪电门 `WX_CFG.lightning===true`（R4：雪族恒 false）** · 01-audio 雨声 audioLevel + 暴风雪风声分支（低通+LFO 阵风，一期复用噪声源）· 13-combat 衰减 `_fe=(def.fallE||220)×fallEMul`（R5 只收 fallE，HEAD_CAP 位置不动）+ 辅瞄 ×aimMul · 14-bots 索敌 ×viewDMul / 听枪×2 ×hearGunMul / 交火半径×3（botEngageR/EMPL_AA_ENGAGE_R/huntR）×rangeMul · 15-vehicles 车长视距 ×viewDMul · 22-hud mmEnemyVis 雨规（合成单源 `WX_MM_NEAR/WX_MM_FIRE`：近显取较小/开火取较长；夜+暴雨=60/2.5 夜规全盖，暴雨昼 90/2.5）· 04b-fire 8 邻格积热率 ×`FIRE_SPREAD`。

### 口追五条（R1 明示例外，均用户点名实机反馈）

① **天气压火** fireMul：晴/阴 1.0 / 细雪 0.75 / 小雨·中雪 0.6 / 暴雨·暴风雪 0.35 —— 重档积热 0.238/s < 冷却 0.25 ⇒ **火不成链**（消费点唯一=积热率，R9）。② **火势总体削弱两成** `FIRE_SPREAD_NERF=0.8`（与天气无关的基线平衡）。③ **雨族雾距重定**（实机两轮加压）：校准值 0.78 作废 → 小雨 0.4 / 暴雨 0.25 / 暴风雪 0.23（snowMid 0.85 校准值不动）。④ **雾渐变**：新增 fogNearMul 雾起提前（小雨 20m / 暴雨·暴风雪 14m / 细雪 32m），根治"40m 内零雾+远处一面墙"。⑤ **重档粒子约 4 倍**：暴雨 720→2800 / 暴风雪 900→3600（轻档校准值不动，密度比拉到 4~6 倍）。

### 探针与回归

- **新探针 `verify-weather`（222 断言全绿）**：T1 解析表（14 图跟随+四档映射两族覆盖）· T2 零回归指纹（R1 样本：斯大林格勒'小雨'→snowMid 与跟随地图**逐位同值**；晴朗档三图=clear 基线）· T3 衰减（规格公式复刻 + fallS 内不变 + HEAD_CAP 序）· T4 感知行为学（昼/夜暴雨索敌双向 45/60/20/40m + 照明弹 36m 乘子次序 + 听枪 60/72m + 吸附 130/100m）· T5 闪电红线（暴风雪 lightningT 不减 / 缅甸链照常）· T6 小地图合成 · T7 静态接线 + R7 全库审计 + 火势行为学（晴 1.9s / 小雨 5s / 暴雨不成链）+ 载入清单动态对账。
- **回归链**：verify-daynight **84/0** · verify-boot 全过 · verify-fire 全过（判据升级**天气感知**：`0.85×FIRE_SPREAD−0.25≤0` ⇒ 断言"火被压制"，其余档维持"密集燃料区必成链"）。
- **verify-boot 桩件补两处既有假阴**（昼夜批遗留，非本批回归）：`_Color.lerp/getHex` + `SpotLight` —— 铁底湾锁夜 boot #13 曾在 nightFogColor/探照灯构建即崩，从未跑完过。
- **探针坑实录**（verify-weather 头注）：①仓库 CRLF——JS 正则 `.` 不匹配 `\r` 且 `$` 不认 `\r` ⇒ `/\/\/.*$/` 剥注释整条失配（用 `[\s\S]`）；②stormFlash 置 1 后同帧衰减；③`0.8×0.35` 浮点≠字面 0.28（乘积断言用容差）；④stub LineSegments 旗标是 `isLine`；⑤吸附正例几何敏感（偏移改绕 Y 定角旋转）；⑥清场后必须补靶（空表=吸附假阴性）。

### 二期可选池（不进本批）

闪电瞬间索敌突增 · 大灯雨雾有效距离衰减 · 主菜单背景随天气联动 · 暴风雪吹雪漂移 · 真风声资源 · 天气压引燃概率/燃烧时长。

## 一.51 本轮修复：海战实机反馈第五轮 = 甲板弹药箱舰体局部锚（舷外悬浮+埋舰体）+ 前主炮旗低旗化（poleH）+ F 键甲板层优先级栈（补弹>上炮>登机>跳海）+ capExitNow 艏艉退出点真修（2026-10-02B，待实机验收）

> 承用户对 2026-10-02 第四轮的追加报："把你的发现一并处理了，另外跳海和补充弹药等其他行为的 F 键冲突。现在弹药箱在船外悬浮着。"

- **①弹药箱悬浮船外（实机新报）**＝上批舰桥旗挪到右舷走道 (8.3,+14) 后，05c 的甲板旗弹药箱仍按旗点 ±4 **随机散布**（freeSpot 只懂 2D 道具互斥、不懂舰体几何），随机到 lx=12.3 > 甲板半宽 9.0 ⇒ 箱子悬在舷外水面上空；随机进 |lx|<5.8 带则埋进甲板室/舰塔。修＝弹药箱改**舰体局部锚**：00-config 每面甲板旗加 `crateL:[lx,lz]`（12 面）、每艘基地舰加 `baseCrateL`（4 艘），新单源 `capShipLocalXY(idx,lx,lz)`（与 15h capDeckBind 的 world→local 互逆，T2 往返零漂移盖章），05c 有锚即**强放不走随机**；锚位判据（甲板矩形内/护栏内/box 净空≥0.2/与中线大件同侧走道间隙≥0.84/底高=capDeckWorldY）写进 00-config 注释、硬门在 round5 探针 T1 四查。调试中抓到第二处漏：05c:2540 运行期 FLAGS 映射表没拷 crateL/poleH（箱子全走旧随机、低旗全失效）⇒ 补拷。
- **②F 键冲突（跳海 vs 补弹 vs 登机）**＝tryInteract 甲板分支旧版无条件 return ⇒ 通用段的弹药箱补弹（~:330）与停机登机在甲板上**永远不可达**——箱边按 F 要么被 capGunNear 吃掉去上炮、要么弹"跳海"提示；提示层同病（箱边漏出通用"补充弹药"、艇靠帮漏出"F 进入 PT 艇"，按 F 却是跳海＝审计 20 的甲板版）。修＝甲板层优先级栈 **①已上炮(下炮) → ②箱边补弹(同参 2.6m/resupplyCd 门) → ③炮位接管半径(上炮) → ④停机 7m(登机) → ⑤舷缘(capCanExitNow<2.2m, 跳海)**；提示层整段与分派同序重写（舷缘不可用时提示"走到舷缘再按 F 跳海"），i18n 补 4 条 EN 词条。箱子锚位与各炮位座圈错开 ≥2.6m ⇒ 补弹/上炮无同时可及重叠区。
- **③capExitNow 艏艉退出点（round5 探针 T4② 揪出的既有缺陷）**＝跳海的艏艉向退出坐标写 `deck.hl*0.5`——deck.hl 本身已是**半长**(bb 72)，再折半=36m ⇒ 从艏艉向 1/3 段按 F 跳海，人被"传送"到 36m 处高炮塔旁**还在甲板上**（F 看似没反应）。修＝`hl+1.4`（与舷侧 outX=capDeckHW+1.4 同余量）。
- **④前主炮旗低旗化（上批顺手发现 b）**＝铁底湾前主炮旗 (0,+27) 距 #2 高炮塔心 (0,36) 仅 9m——该塔炮轴高（甲板+6.0/6.3）正落在旗面带（+5.5~7.0）内，塔一转向旗面就被炮管周期性扫穿；#1/#3 塔炮轴只有甲板+3.0（平射够不着）且水平距 25/75m 超炮管长（ringR×3.30≈17.8/18.5m）。修＝**低旗**：00-config 旗点加 `poleH:4.5`，05c 旗杆/旗面挂高按 poleH 走（缺省 7=旧几何逐位），15h capitalFlagTick 的 poleTop 同步——旗面带降到甲板+3.0~4.5，距炮管下缘（6.0−0.75=5.25）净空 0.75m，满俯仰（−0.06rad，仅玩家手动）仍余 0.2m。旗点原位不动（占领圈/旗名/i18n 零扰动）；玩家手动满仰角扫旗面＝已裁定接受的残余。
- **⑤基地箱埋舰体（上批顺手发现 a）**＝旧 BASES±(3,±3) 换算舰局部 (±3,3) 埋进甲板室墙面（|lx|=3<5.8）。修＝baseCrateL (−7.9,0) 左舷走道中段（距舰心 7.9m ≤ layouts 基地箱 10m 判据；第一版 (−7.9,12) 14.4m 被 verify-layouts 揪出超距后收拢）。陆图 capBaseShipIdx=-1 路径逐位同旧。
- **⑥版本戳**＝specbatch T10 揪出 `__sfStyleVer='20261001d'` 与 46 处 `?v=20261002` 不同步（上批漏升半边）⇒ 统一 **20261002b**（46 处 + styleVer）。
- **判据**：新探针 verify-navalround5-20261002.js **23/23 全绿**（T1 甲板箱四查实跑 / T2 全战役 12+4 锚往返零漂移+capShipLocalXY 本体+旧锚双阴性 / T3 全部 12 面旗扫掠判据（水平可达门+低旗竖直净空）+旧 7m 杆判红阴性 / T4①箱边 F=补弹 ②冷却中=顺栈跳海 ③炮位=上炮下炮 ④ab 提示同账 / T5 ironbottom 烟囱+低旗×2+基地箱锚位实查）；回归链 navalround4 20、navalcap 58、seabatch 8、phase5-capital 41、specbatch 79、layouts 13 图全过、text ✓。

## 一.50 本轮修复：海战实机反馈第四轮 = 阵营栏图标 id 撞车 + 观战者甲板搬运/绕行 + 舰桥旗点出塔 + 艇↔艇推挤去 0.5m 限幅 + Bot 让路预折（2026-10-02，待实机验收）

> 承用户对 2026-10-01d 的五条复报。
> 落地细节见「finished-docs/交付文档-海战实机反馈第四轮-20261002.md」；本批探针 `dev/verify-navalround4-20261002.js` **20/20 全绿**（T1 图标 id 唯一+旧方案撞车阴性 / T2 观战搬运+绕行+空旷阴性 / T3 甲板旗"杆+旗面"双判据+旧坐标判红阴性 / T4a 对开不换位 / T4b 让路+净空阴性+镜像）。

### 根因与修法（要点）

- **阵营栏一方灰色**：旗点图标 DOM id 用旗名（两军旗点同名）⇒ 6 图标 3 唯一 id——前半行被后半军的旗状态覆盖、后半行从未上色（停留无 class 灰）。修复：id 按 FLAGS 索引（23-deploy 建 / 22-hud 读同序）。
- **观战甲板无碰撞 + 船上移动慢（同根）**：capRideCollect 排除观战玩家 ⇒ ①舰走人不跟（甲板=跑步机, 逆舰向净速度≈0）②capLocalSolve 不对他跑（上层建筑全体不拦）。修复：删排除, 观战者与普通玩家同一支搬运+绕行（时停冻战场不冻观察者口径不受影响: 冻结帧舰不动=恒等映射）。
- **旗帜卡在结构里**：两图舰桥旗局部坐标 (0,+10)/(7.2,+2) 在舰桥塔足迹内/贴墙——旗杆穿塔、旗面挥进舰岛。修复：统一移到右舷走道局部 (+8.3,+14)（杆距墙面 2.3m/命中盒 2.1m, 旗面挥向内侧与 pagoda 外挑层相切, 避开翼台 z≤4.1 与艏炮座 z≥29.8）；搬运链自动跟随。
- **友舰穿模**：navalPushCraft 的 0.5m 绝对限幅 < 每帧穿透增量（29+29m/s 对开 0.97m/帧）⇒ 推挤追不上积分=对穿。修复：删绝对限幅, 只留 (3+spd)·dt·2.2 平滑限（高闭合速恒全量解算, 深穿透分帧"顶住"）。
- **友舰撞船**：Bot 驾驶无"前方有船"感知, 追同一航点/撞己方大舰顶着开。修复：NAV_AI.avoid{Look,Pad,Turn,Slow} 单源 + navVesselAhead, navSteer 唯一接线点做让路预折（不分敌我; 反舷侧 1.0rad——镜像对称自动错船; 22m 内油门 0.45 折地板 0.2; 只折前进舵, 倒车脱困不受管）。

### 判据与回归

- 全绿：navalround4 20/20 · phase5-capital 41 · navalcap 58 · seabatch 8 · specbatch 79 · layouts 零漂移 · text。
- **A/B 定责三处既有红（均与本批无关, 关断改动后逐位复现）**：_navalai ①(0/2)/⑦(minShore 27.4m)、_naval-selfcheck ③b/③c（浮标波场等值, 同值 2.62e-1m）、verify-naval 红线7③（两栖车上岸不开火, 1/4~1/3 环境偶发族）。三处留待独立立案。
- **顺手发现（未动）**：旗舰基地弹药箱埋在舰桥塔基里（BASES±(3,∓3)=局部 ±3）; bb 前主炮旗 (0,+27) 周期性被 #2 炮塔炮管扫过（炮管轴高=甲板+6.0）。均待用户裁定是否下批处理。
- 版本戳 20261001d → 20261002（46 处）。

## 一.49 本轮修复：海战实机反馈第三轮 = 双 OBB SAT 舰-舰碰撞 + capPushBody 双门（挤人下海根治）+ 超射塔炮座 + 炮手随炮/多联装建模 + 瞄准圈 aaAimR 分档 + 残血钉零 + 巡飞弹甲板空域收窄 + 停机抬量 plParkLift（2026-10-01d，待实机验收）

> 承用户对 2026-10-01c 的七条复报 (附三张观战截图)。
> 落地细节见「finished-docs/交付文档-海战实机反馈第三轮-20261001d.md」；`dev/verify-navalcap-20261001.js` 49→**58 断言全绿**（新增 S19–S26）；verify-phase5-capital 41 全绿（R12 随 SAT 重写、R17/R19/R20 随 plParkLift 重钉）。

### 根因与修法（要点）

- **舰-舰穿模**（"撞船穿模仍十分严重"）：capPushCap 旧版只测对方**中心**是否落进本舰外接矩形 ⇒ T-bone/斜擦时艏已插入而中心在外, 判不出对穿。修复: **双 OBB 2D SAT**（两舰局部 x/z 共 4 轴, 沿穿透最浅轴各退一半 +5cm 余量）, 分离量用**逃逸量** min(escR,escL)（重叠深度在包含情形=被含宽度, 推不开）; capPushCraft 同口径; capCorners 单源。S19。
- **Bot 被挤下海 / 甲板行进受阻**（①⑦同根）：capPushBody 水线层旧版无上限高度门 ⇒ 邻舰 hull 矩形在本舰甲板高度横扫整片乘员; 两舰贴帮时两片甲板矩形各自夹持互相对挤。修复: **水线上限门**（pos.y>hullH×0.75 ⇒ 该舰舷侧不挡）+ **护栏执法单源**（支撑舰 sup 判定, 别舰甲板重叠不双夹）。S20（含阴性对照）。
- **超射塔浮空**（"大炮塔仍然有浮空的"）：bb 第二座主炮（ringZ 36）塔底 y=15.2 而甲板室只到 z=24, 塔底悬空。修复: 15g 补 **cpBarbette 环形炮座**（ringR×0.95, 甲板面→塔底）+ 命中盒（塔座可被打）+ 主炮塔命中盒下沿延到塔底。S21。
- **炮手不自然/小炮简陋/无法转向开火**（三条修一层）：① cpBuildMount 按 `spec.barrels` 出**多联装**管数（四联/三联/双联/单管）+ 炮座圈 + 弹药箱 + 随管数加宽防盾（S26）；② 炮手网格转角 = **局部**瞄准角 turYaw/secAimY/aaAimY 同一数据源（旧用世界系 yaw, 局部系读作横躺；出生朝向同修）（S23）；③ **瞄准圈 aaAimR 420 ≠ 开火圈 aaR 170**（开火圈是 2026-10-01 平衡裁定不动）—— _pickPlaneTarget 索敌圈旧按 aaR ⇒ 170m 外连目标都拿不到, 改按 aaAimR + aiTick 分档（420 跟踪/170 出弹）；舷角闸门（aaArc）改按**舰心**取舷角（旧按炮位自身 ⇒ 艏艉线上目标全炮位被闸哑）（S22a/S22b）。
- **0 血赖着不死**：非整值伤害（溅射/伞降倍率）留 0<hp<1 残血, 名牌 Math.round 显示 "0/100" 而人还活。修复: Bot.damage 里 hp∈(0,1) ⇒ 钉 0 = 击杀（票务照常）。S24。
- **巡飞弹近甲板提前引爆**：capitalSolidAt 实体带旧到甲板面+2.6 ⇒ 贴甲板掠过撞空气爆。修复: 收窄到 **+0.25**（甲板上空=空域）; 13-combat 航弹甲板触发带同步; S17a 重钉（+0.1 实体/+1.5 不拦）。
- **飞机嵌在甲板里**：机模原点在机身轴（无起落架建模）, 机腹在原点以下。修复: 新单源 **plParkLift**（fr×size+0.24×size）接线 capParkPlanes/capTryArrest/capArrestTick 三链; S25 + phase5 R17/R19/R20 重钉。
- **探针卫生**：capitalReset 不还原 pos.x/z/yaw ⇒ S18/S19 残位毒化 S20（S18/S19 改全量还原, S20 ③ 前提显式化）; phase5 R12 SAT 贴合复查加 1e-6 容差（浮点假红 1/6）; verify-naval 红线7③ 偶发再登记（10 连跑 2-3 挂, 布局随机, 本批未触及开火链）。

### 判据

- S19 T-bone SAT 检出+分离 / S20 双门+护栏阴性 / S21 炮座承托（埋深 ≤0.5m）/ S22a 全链出弹 / S22b 远圈转塔不出弹 / S23 炮手随炮逐位相等 / S24 残血即死+票务 / S25 停放拦阻两链高度 / S26 多联装+塔底盒。
- 全量 run-all-verify 46/47（唯一失败 verify-naval 红线7 偶发, 复核 3 连跑全过）; 版本戳 20261001c → 20261001d（47 处）。

## 一.48 本轮修复：海战实机反馈第二轮 = 炮位支撑足迹/接管链位置化 + 甲板炮手 + 大海致命化 + Bot 扎堆根治 + 手雷/巡飞弹对舰实体 + 跳帮放行（2026-10-01c，待实机验收）

> 承用户对 2026-10-01b 的五条复报 + 一条设想（"大海应该十分危险: 上浮迅速耗体力条, 耗尽只能下沉"）。
> 落地细节见「finished-docs/交付文档-海战实机反馈第二轮-20261001c.md」；`dev/verify-navalcap-20261001.js` 41→**49 断言全绿**（新增 S12–S18, 含阴性对照）；verify-phase5-capital S6 锚收窄（`this.respawnT`——炮手 `b.respawnT=1e9` 是 Bot 实体钉, 非舰重生计时）、Obj3 桩补 quaternion.copy、R8 票务期望按"Bot 死亡各扣 1 票"口径重钉（瘫舰 = spec.ticket + 炮手数），41 全绿。

### 根因与修法（要点）

- **炮塔仍浮空**：上批 S5 审计只查"高度"不查"支撑足迹"——bb 副炮/防空旧坐标 lz 25/27/−42 越出甲板室端面 ([−40.3,+24.0]) 却保持甲板室顶高度 ⇒ 悬在主甲板上空 2.4m。修复: 坐标收回足迹内（lz 22/18/−33, 00-config 单源）+ **S12 足迹审计**（每座炮位必须落在甲板室/主甲板之一, 叠置塔支撑=下塔顶）。
- **无法接管（两根）**：① tryInteract 大舰分支挂在 `player.onCapital` 座位字段上——部署直落甲板的玩家该字段为空 ⇒ F 无效而提示照显（提示与判据脱节）⇒ 触发器改 `capDeckOf(脚下)` 单源, capCanExitNow/capExitNow 增舰参; ② capGunNear 竖直权重 0.6 把"甲板面玩家 vs 甲板室顶炮座"（高差 2.3m 罚 1.4m）推出 gunR 3.4 ⇒ 永远选不中 ⇒ 权重 0.35（水平为主）。
- **甲板炮手**（用户"炮塔内部也没有 Bot"）：真 Bot 实例（可命中/被索敌）+ 网格挂舰体局部系（零同步）+ respawnT=1e9（die 不扣票零票务副作用）; 编制=主炮每塔1+副炮每座1+防空每3座1（bb9/cv7）; 炮位报废⇒该炮手阵亡、瘫舰⇒全员阵亡、玩家接管⇒隐身、复位⇒换新; 五处排除（小队/占旗×2/fieldCount/记分板）+ 24-main 循环跳过。
- **大海致命化**（terr:'opensea' 门, 陆战图零变化）：玩家游泳只耗不回（seaSwimDrain 0.13/s ⇒ ~7.7s 耗尽）⇒ 强制下沉（seaSinkRate, 浮不上潜不下, 泳速×0.55）⇒ 头入水接既有憋气链 ×seaDrownMul 3（22s→~7s）⇒ 落水 ~15s 带走; Bot 宽限 seaBotGrace 2.5s 后 seaBotDmg 18/s 溺伤（~5.5s 耗尽）⇒ 部署复活回舰自净。
- **Bot 海里扎堆根因**：capBotTick 旧口径"目标旗在别舰⇒贴舷缘就跳下去游泳", 而旗跟着舰巡航跑（舰 4m/s > 泳速）⇒ 整队落水追船永追不上。修复: pickObjective 跨舰远旗不选（boardR 外跳过, 落水者同门）+ capBotTick 只贴帮才跳（双保险）+ 大海致命化兜底。
- **手雷/巡飞弹穿舰**：旧版大舰接触只在 at/bomb/mortar 档、只认敌舰、只认甲板矩形。新单源 **capitalSolidAt**（点查询, 不分敌我, 舰体矩形比甲板大一圈⇒舷侧也拦）全弹种接线 + 未武装表内弹甲板面休息弹跳; 巡飞弹补 capitalRayHit(team=-1) 射线 + 入体兜底, 舰体伤害走 explodeAt→capitalSplash 既有链。
- **跳帮放行**（用户裁定"围栏像能量力场"）：capPushBody 甲板层在"被夹方向舷缘外是另一舰甲板面（高差<1.8m）"时让位, 探测距离分档 [1.2,2.8,4.4]（hull 贴合时甲板缘间还隔 1.5~3m 舷侧走道, 只探 1.2m 够不着）; bb-bb 间隙 ~3m 跑跳可达, cv 甲板外漂直接搭接; 无邻舰照常夹回（S18 阴性）。

### 判据

- S12 足迹审计（全 4 舰型）/ S13 炮手三联（编制/在表挂舰随舰/报废阵亡+复位换新）/ S14 接管链（onCapital=null 上炮+炮手隐身+源锚）/ S15 玩家海泳四源锚+参数档 / S16 Bot 溺伤动态+pickObjective 过滤（farDist=381m）/ S17 capitalSolidAt 三态+射线+接线锚 / S18 跳帮放行（贴帮 0 推移 vs 无邻舰 0.34m 夹回）。
- 全量 run-all-verify 与 aimassist 偶发（T2★★ 随机散布预算型, 11 连跑 1 挂, 非本批）登记见 README §8。

## 一.47 本轮修复：海战系统性大修 = 旗点/补给箱跟随同账 + 甲板平台收口 + 大舰互撞 + 分炮塔血量与玩家接管 + 瘫舰灰色中立化 + 鱼雷/航弹对舰接线 + 载入期生成舰队（2026-10-01b，待实机验收）

> 承用户 2026-10-01 实机反馈: 八条系统性 BUG（旗帜漂移/甲板无碰撞/补给箱失效/人不随船/物件浮空/船互相穿过/两栖车意义不明/起始界面无船）+ 三条期望（分炮塔血量与操控 / 瘫舰=灰色中立陆地 / 大炮巨舰+空战+轰炸的影响力）。
> 落地细节见「finished-docs/交付文档-海战系统性大修-20261001b.md」；沙箱判据 `dev/verify-navalcap-20261001.js`（**29 断言全绿**, 含 3 处阴性对照, 已登记 run-all-verify）。

### 根因与修法（要点）

- **补给箱失效（实锤）**：`capDeckPropTick` 只搬网格不更新 `c.x/c.z`，交互判据停在 t=0 海面 ⇒ `capDeckPropTick` 网格与判据坐标**同帧同账**。
- **鱼雷穿舰（实锤）**：`capitalTorpedoHit` 首版全库零调用 ⇒ 接线 `15d updateTorpedoes`（小艇没接住再问大舰）。
- **航弹哑弹（实锤）**：`nadeStep` 载具触发圈只查 tanks/trucks ⇒ 航弹穿飞行甲板落水哑火 ⇒ 补小艇 2.6m 圈 + **大舰甲板接触**（`capDeckOf` + 爆点=甲板面, 优先于入水哑火）。
- **大舰互撞**：新增 `capPushCap()`——等质量各让一半、沿穿透更浅的轴分离（+5cm 余量防浮点贴合）、`updateCapital` 每帧调用。
- **分炮塔血量**（数值单源 `CAPITAL_SPEC.*.turHp`, 结算 `CAPITAL_CFG.turSpill=0.35`）：15g 命中盒带 `part/pi` ⇒ `takeDmg` 按部件记账+溢出进舰体；打空 ⇒ `_partDead` 报废（残态定格+AI 守卫+开火守卫）；**废塔不再是装甲**（后续命中按 hull 全额）。
- **炮位接管**（`player.capitalGun={ship,type,idx}`）：F 上炮/下炮（优先级: 下炮→上炮→舷缘跳海），视角即炮口（`gunSlew`/`gunPitch` 分档 + 转塔到位门），开火与 AI 同一单源（`fireMainSalvo/fireSecondary/fireAA`），归因随人；AI 不碰接管炮位；接管中被炸废就地弹人。
- **瘫舰=无阵营陆地**（用户裁定, 旧"照走照占"作废）：`cripple()` 甲板旗就地中立化（灰旗半桅）；**`capFlagActive(f)` 单源**接 updateFlags/胜负判定/部署列表/部署图/Bot 目标五处；`capBasePos` 基地舰瘫 ⇒ 回退本队另一艘巡航大舰。
- **起始界面有船**：大舰改**载入期生成**（24-main boot, capturePristineWorld 之前 ⇒ 进开局快照）；startMatch/就地重开 `capitalEnsureOrbat()` 复位复用；retireMatchActors 大舰段复位不摘除；23b 还原追加 `capitalReset()`；菜单航拍 `updateCapital` 照跑但停火（`menuHold` 守卫）。
- **飞机对舰/撞水线**：`planeFloorY()` 单源（地形/水面取高, 旧撞地线=海床+2 ⇒ 海图无撞水线）；巡逻评分补大舰（挂弹才点名）与小艇；大舰俯冲瞄准点抬甲板面。
- **编制**（用户裁定"两栖车意义不明/飞机太少/小船太多"）：coral `navalN [2,4]→[0,2]`、`airN [2,2]→[4,4]`；ironbottom `navalN [0,4]→[0,2]`；航母瘫痪 ⇒ 停放舰载机紧急弹射。

### 判据

- `verify-navalcap-20261001` 29/29：S1 载入期生成+复用不重建 · S2 旗点绑定/跟随（阴性: 不 tick 不动）· S3 补给箱三坐标同账 · S4/S4b 甲板站立/护栏/capCarryDelta/乘员搬运 · S5 舰模锚定审计（主塔承托面/副炮防空不悬空/capDeckHW 上界）· S6 capPushCap（阴性+分离+各让一半）· S7 编制 · S8/S8b 炮塔血量路由（阴性: 无 part 不进炮塔账）/报废/透传/接管链 · S9 瘫舰中立五处 · S10 鱼雷/航弹/飞机 · S11 数值锚。
- 版本戳 `20261001a → 20261001b`（47 处）。

## 一.39 本轮修复：阶段三 P1 平衡首轮批 = 兵种 8→5 合并 + 武器生态位 + 迫击炮/火箭弹反草丛 + 出生保护/伤害对称化 + 工事读条回收（2026-09-28，待实机验收）

> 承《缺陷登记与路线图-2026-09-28.md》§五 阶段三（P1 平衡首轮）。
> 落地细节见「finished-docs/交付文档-阶段三P1平衡首轮批-20260928.md」；沙箱判据 `dev/verify-phase3-20260928.js`（55 断言，登记 run-all-verify）+ `dev/_farm-block-probe.js`（农田取证）。

### 用户裁定（会话内问定，7 项）

1. 医护兵**删除**，医疗箱并入工程兵建造菜单（第 5 件）。
2. 突击兵与冲锋枪兵合并为**突击兵**：STG-44 保留（德军例外），BAR/DP-28/Type96/ZB-26/Type11 全部退场。
3. STG44 **保留并调进生态位**（散布+距离衰减 = 中距压制位，不做"激光枪"）。
4. 栓动步枪换弹小幅加快（3.1~3.8s → 2.6~3.0s）+ **移速随武器变化**（手枪最快）。
5. 反坦克兵火箭筒：**加大子弹判定 + 增大爆炸范围 + 加快弹速**（弹速×2 已在 09-28C 批落地）。
6. "被 Kar98k 一枪秒"：优化但**不要用力过猛** + 给刚出生的玩家和 Bot **极其短暂的无敌时间**（追加裁定：≤0.4~0.6 秒、**开火立即结束**）。
7. 追加：工程兵制造的东西加**读条回收**；STG44 也常秒人 → 排查同类；工程兵施工时右臂绕手腕大幅甩动 → 修复。

### 病根（取证实锤）

- **"农田草丛阻拦"真身不是草**：`dev/_farm-block-probe.js` 实测庄稼/灌木全是软遮蔽（只挡 Bot 视线）；
  真阻挡者 = ①田块 rolling 地形缓坡（田内 1.5~2.1m 高差，火箭弹胸口平飞撞"隐形坡"）②树篱 2.2m 实体盒
  ③迫击炮弹道被弹速×2 改得过平（顶点仅 1~3.2m）。
- **"敌方 Kar98k 一枪秒我、我不能秒它"**：难度倍率 `dmgMul` **只加在 Bot 伤害上**（`if(!shooter.isPlayer)`）
  —— 精英 ×1.25 时 kar98 88→110 连身体都一枪秒；且全表排查：非镜枪 13 把 dmg×headMul≥100（爆头全员秒）、
  STG44 是 550rpm 高速融化（非一枪，0.33s 内 3 发）。
- **锤击动画诡异**：`buildArms` 臂组枢轴在**手腕**（袖子段向 +z 延伸 0.25m），build 态整臂 rot.x 到
  -1.15 rad = 上臂绕拳头抡。
- **迫击炮平地解在坡地系统性偏近**（修前 40m 试射短 4.9m = 田块高差）：mortarVel 缺落点高差项。

### 落地

- **兵种 8→5 全链**（步枪/突击/狙击/反坦克/工程）：`09a-defs` CLASSES/CLS_POOL、`00-config` 六阵营 cls
  表与实验模式重映射（cls5→3）、`14-bots` cls 重映射+工程兵 Bot 架炮、`19-input`/`19b-gamepad`/`20-player`
  /`22-hud`/`23-deploy`/`24-main` 键位提示触屏、`00b-i18n` 词典、index.html 静态帮助。
- **武器生态位**：全现役武器表 fallS/fallE/fallF（13-combat fireBullet 单源衰减，玩家 Bot 共用）+
  wSpd 移速系数（手枪 1.0 … 火箭筒 0.9，玩家/Bot 同乘）；栓动换弹 ≤3.0；STG44 spreadHip 3.4/
  fallS38/fallE180/fallF0.5。
- **反草丛**：迫击炮高抛弧单源 `mortarArcTof`（顶点 1.4~3.0s 抛物线，80m 弧顶 6.7m 越树篱）+ mortarVel
  落点高差项 dy（坡地精确）；火箭弹 `AT_SHELL_PAD=0.45` 判定（15-vehicles，士兵圈经 raySoldiers pad 同步
  放大）+ 爆炸半径分档 9（at）/7。
- **出生保护 0.5s**（`00-config` SPAWN_PROT 单源 let，探针可置 0）：Bot `spawn()` 与玩家 `deployPlayer()`
  落地盖章 protUntil；两个伤害入口（14-bots/18-game）各一道闸——**只挡敌方来源**（摔落/溺水/严寒/车毁链
  不拦），`fireBullet` 开火即清账（无敌帧内不许输出，玩家/Bot/炮位共用同一出膛口=单源）。
- **伤害对称化**：四方普通栓动（kar98/莫辛/三八/中正式）dmg→78（精英 ×1.25=97.5<100，**谁都秒不死满血
  身体**）；STG44 27/550→24/500（DPS -19%）；**爆头封顶 HEAD_CAP=95**（fireBullet 在难度倍率与衰减之后
  取 min，非镜枪爆头满血必活；**狙击镜枪豁免**——一枪爆头=狙击手专属）；Bot 瞄准竖直偏置
  rand(-0.12,0.2)→rand(-0.15,0.1)（爆头从"常发"回落"偶发"）。
- **工事读条回收**（06-engineering）：BUILDS 建造登记（捕获碰撞盒/网格/归属/成本）+ 1.2s 读条
  （B 靠近自己工事=拆除退全款 / 6 靠近自己迫击炮=读条回收 / 再按取消 / 受击·离开·开始别的动作打断）；
  拆除走既有单源：沙袋/MG killBox（碰撞盒+网格+OCC 脏矩形同拆）、医疗箱 removeMedkit、铁丝网 alive=false、
  拒马摘网格清 CYLS、PROPS 占位圈就近释放（原地可重建）；22-hud 屏下方读数条；受击打断挂 player.damage。
- **锤击动画**：10-viewmodel build 态肩点补偿（臂摆 ±0.6 rad + 位置按绕肩端旋转几何逐帧补回，袖子端定住、
  手腕走弧线），大幅抡击交还给锤子本体（-1.6 rad）。

### 判据

- `dev/verify-phase3-20260928.js` **55 断言 0 失败**：S1 P1-a~k（兵种/生态位/衰减/wSpd/迫击炮单源/火箭弹/
  医疗箱/移速接线）+ S2（SPAWN_PROT/HEAD_CAP 单源、fireBullet 清账、盖章点、读条回收接线）+
  B1 衰减生效 · B2 迫击炮 40/80/110m 短路 <10% 且 80m 弧顶 6.7m · B3 火箭弹 44m 命中 · B4 兵种池 ·
  B5 Bot 配置 · B6 实验模式 · **B7 出生保护**（独立沙箱：盖章/敌伤挡/环境伤不挡/开火解除/到期恢复/玩家同口径）·
  **B8 伤害对称**（四方栓动 78、精英<100、STG44 24/500、15m 实弹 100→22）· **B9 爆头封顶**（非镜 100→5、
  镜枪 500→260 不封顶）· **B10 读条回收**（登记/占格/读条中/完成拆除/OCC 清格/退全款/迫击炮回收链）。
- 既有探针受害点修复（语义更新而非放松）：verify-spec T1 旧 8 兵种索引 5→3、**T6 阴性对照翻转**（
  "AT 弹不命中"已被用户裁定推翻 → 0.5m 双命中 + 1.2m 双不命中的有界外扩对照）；verify-specbatch T3
  兵种卡 5→3；verify-text 三条 index.html 静态帮助换新文案；verify-hudfb 开局挂 SPAWN_PROT 豁免。
- 全量 `run-all-verify`：**34/34 探针 exit=0 全绿**（naval 布局指纹偶发项本批连跑未复现）。
- 版本戳 `?v=20260928i → ?v=20260928j`。

## 一.46 本轮修复：手雷 = 触发引信双条件 + 投掷起点右手化 + 举雷待发常驻 + 总画地面落点圈（2026-09-30l，待实机验收）

> 承同一日手雷批（触发引信 + 四弹种建模 + 贴地预瞄）后用户的**五条复报**。落地细节见
> finished-docs/交付文档-手雷触发引信与投掷起点与举雷待发-20260930l.md；沙箱判据 dev/verify-nade-trigger-20260930.js
> （**107 断言**，本批从 63 扩到 107）。

### 用户裁定（会话内问定，三项）

1. 举雷瞄准期间引信**继续计时**（保留"厨雷"），但**计时归零本身不炸** —— 引爆 = 引信到点 **且**
   （触地 | 命中合法目标）。⇒ 空炸与"手中自爆"两条路径**整体删除**。
2. 投掷弹道剖面**保持固定初速平直快球**（只修起点与显示）—— 不动 NADE_THROW 初速表。
3. 预演**总是画地面落点范围**（真弹爆点在半空的唯一情形 = 撞敌，那时再叠空炸环）。

### 病根与修复（五条）

1. **自雷**：旧"烧引信到点在自己脚下 `explodeAt`"（20-player）碰上"按住=举雷瞄准"这个**唯一**的
   投掷瞄准动作 ⇒ 举满 3.8s 必炸自己。修复：`p.nadeFuse=Math.max(0,p.nadeFuse-dt)` 到 0 为止，不自爆。
2. **预演点串是一条线段**：出手点写 `camera.position`（18-game 与 22-hud 各写一遍）⇒ 起点落在相机轴线
   上 ⇒ 弹道整条都在相机轴线所在竖直平面内 ⇒ **投影数学上必然是一条穿过准星的直线**。修复：
   `playerThrowOrigin()`（右手，眼右 0.24 / 下 0.30）+ `playerThrowDir(o)`（汇聚 `tpAimPoint` 准星命中点），
   两处调用同源。判据：点串屏幕 x 展开 54px，**旧起点对照组 0px**。
3. **"按空炸做"**：`nadeStep` 旧首行 `if(st.fuse<=0) return 'blow'` + 举雷期引信在烧 ⇒ 举一会儿预演就
   只剩空炸环。修复：双条件收口（见裁定 1），且预演**总画**地面圈（入水哑火另给 `.naWater` 冷色档）。
4. **三人称与一人称完全一致**：同 2 的起点在相机轴线上（三人称相机后拉后起点仍在其轴线上）。修复：
   起点改挂**身体**（右手）⇒ 同一弹道在两视角形状不同（首点偏移 55.9px → 661.8px）。
5. **举雷姿势只保持 0.45s 就回持枪**：动作靠 `p.nadeThrowT`（0.45s）衰减计时驱动（按一次性投掷写的），
   衰减完姿势回基准、`handK` 回 1 **把双手 IK 抓回枪上**，且三人称手上一直握着步枪。修复：
   `playerNadeReady()` 单源判据 + **蓄力位姿常驻**（与投掷弧起点同姿态，松手无缝）+ `handK=0` +
   `avNadeSync` 挂**真雷模**（buildNadeMesh 单源，与一人称手上件/出手件同模）。

### 落地与判据

- 单源常量：`NADE_IMPACT`/`NADE_ARM_T` 删；新增 `NADE_ARMED_BY_FUSE`（表内=引信到点才武装，
  表外=出手即武装，反坦克炸药/航弹/迫击炮零变化）。`updateNades` 里"撞墙改引信"那句删除。
- 判据：`verify-nade-trigger` **107 全绿**（含 B2-自雷阴性：真 `updatePlayer` 400 帧零掉血；
  B2-核心：空中到点不炸；B4：点串非直线 + 三人称形状不同 + 厨雷档照样有地面圈）；`verify-fb2-nade` 82 全绿；
  `verify-phase4-7b` 42 全绿（S15 两处锚随 nadeStep 搬迁更新）。
- 出图取证：`dev/render-model.js` 新增 `av` 模式 + `CROP=` / `ONLYHAND=1`，美式卵形/苏式木柄在拳中姿态已验。
- 版本戳 `?v=20260930k → ?v=20260930l`（45 处，含 `__sfStyleVer`）。
- 全量 `run-all-verify`：**46/50 次运行 exit=0**；未绿的三个（`dev/_audit-foliage-ref.js` 植被遮蔽审计 /
  `dev/verify-naval.js` 海战红线 / `dev/verify-matseam-20260927.js` 材质接缝）经稳定性复核均为**偶发**
  （重跑 3/3、3/3、2/3 通过），且三个子系统本批**一行未动** —— 与手雷批无交集。

### 实机验收清单（用户，五条一一对应复报）

1. **自雷**：按住 `G`（或 3/4/6）举雷**任意久**（>10s）—— 不炸手、不掉血；松手仍能正常投出。
2. **落地范围**：举雷时看地面 —— **总有一圈贴地椭圆 + 中心小圈**；准星指向远处/脚下时圈都在地上（不是悬空/不是屏幕正圆）。
3. **空间感**：一人称看那条点串 —— 应从**右下角划出**、远端收敛回准星（不再是准星正前方的竖直一条线）。
4. **两人称一致**：按 `U` 切第三人称 —— 点串应从**手上**飞出、与一人称形状不同；两视角落点圈指向同一点。
5. **举雷姿势**：第三人称举雷期间 —— 人**一直保持举雷蓄力位姿、手里握着那颗真雷、步枪收起**；松手才做投掷甩臂。
6. **引爆口径**：普通雷落地后**会弹跳滚动**，引信到点（3.8s）在哪停就在哪炸；若举久了（引信烧短）再扔，则**落地即炸**；
   投进深水只哑火（圈变冷色）；撞到敌兵躯干半空炸。

## 一.45 本轮修复：接管飞行员低空交战 + 航弹锁定制导/反坦克化 + Bot 对空微削（2026-09-30k，待实机验收）

> 承一.44 的四条用户实机反馈。落地细节见 finished-docs/交付文档-接管低空交战与航弹锁定制导-20260930k.md。

### 病根与修复

1. **接管对低空敌机不去打**（用户猜"保持高度机制"命中）：①拉起闸 `minAGL=40` 一刀切，敌机低空时
   追击必须下 40m 以下=攻击几何永远被顶掉；②追击点强钳"地形+48m"，敌机 20m 低空时瞄准点顶在他
   上方 30m，机头平掠弹道从头顶飞过。**修复**＝`PLANE_TAKEOVER` 增 `diveAGL:20` 双档拉起闸
   （目标在下方>4m 用俯冲档，平飞/爬升维持 40 老闸，追坠机悬顶手感不变）+ 追击钳高收窄为防钻地
   `ghA+8`（改出安全单点交给 diveAGL）。对地扫射/投弹剖面同吃 diveAGL=20（旧 40m 把对地也压成浅打）。
2. **航弹反坦克化**：旧 `9.5m/170/260无ap`（260×TANK_ARMOR0.3=78 挠痒）→ **`13m/210/1350+ap`**
   （直接命中 ≈1300：轻坦必杀/中坦击毁级/重坦残废；巡飞弹 560+ap 同族更重）+ 结构 12/460 + 弹坑 2.4。
3. **航弹锁定+接管**：投弹瞬间本机带锁（E/中键，锁在机上 `pl.lockTgt`）⇒ updateNades 以
   `BOMB_GUIDE_RATE=1.4`rad/s 限角速度把弹掰向目标（只改方向不改模长，落体/引信/入水全走原链；
   目标亡退回诚实弹道；无锁=纯弹道）。接管代打的自动投弹同吃——`aiPilotTgt` 即玩家锁，
   飞行员+航弹都为一把锁服务。投弹提示「航弹制导: 目标名」。时停逐枚 ndt 冻结弹不拐。
4. **Bot 对空微削**：`AIR2AIR_BOT_MUL=0.80`（fireMGBurst 对空显式分层处按射手身份收口，
   玩家/接管代打档不减；难度倍率仍由 takeDmg 的 dmgMul 内部叠加；GROUNDGUN_VS_AIR 另一杆不相干）。

### 判据与回归

- 7b **37→42 全绿**：S8/S13 重钉（双档签名、`minAGL+8` 绝迹）+ S15/S16 新增（制导全接线/威力钉值）
  + R9 重钉（俯冲档托底 minAgl 18.6、档下零违规开火）+ R11 重钉（追低空目标改"压下去打"）
  + **R13 新增**（低空敌机向下打 minPitchT=-0.6、托底 19.7m、咬到 34m）+ **R14 新增**（过冲修正
  场景：无制导惯性飞 ~115m 必过冲，制导掰回正中坦克 1180 伤；无锁阴性弹道不拐）。
- 7c 21 全绿（S2/R2a 重钉 + r2a2 玩家档豁免钉值）；7d 12 全绿（S4 签名重钉）；7a 38/spec 全绿；
  全家桶 **run-all-verify 40/40 exit=0 全绿**（2026-09-30k 批，probe-planes 12 战役无撞山、
  naval 偶发项未复现）。
- 探针插曲两则：R14 首版 180° 掉头场景物理不可能改过冲修正；锁源首版误读 `player.lockTgt`
  （恒 undefined=永不制导）被弹道探针抓出，改读本机 `this.lockTgt`（带 playerDriven 门卫）。

### 待验收（用户实机清单）

- 低空敌机：锁定 → Space 接管应压下去咬住开火；对地剖面更深；航弹带锁会拐、直接命中重创坦克；
  接管自动投弹同样制导；Bot 咬你略松（-20%），自己打不变。
- 版本戳 `20260930j → 20260930k`（45 处）。

## 一.44 本轮修复：AI 接管飞行员"过度躲避"改破转反咬 + 接管冷却 8→3s（2026-09-30j，待实机验收）

> 用户实机反馈原话："AI 接管后总是过度躲避，等到队友击败了锁定敌人，躲还躲不好总是被击中，窝囊且废物"。
> 全部改动在决策层（aiPilotFly / takeDmg 玩家分支），flightStep 积分零改动；落地细节见
> finished-docs/交付文档-接管飞行员破转反咬与冷却3秒-20260930j.md。

### 病根与修复

1. **咬尾侦察漏了"后半球"判据（过度躲避主源）**：注释写"敌机在我后半球"，代码只判了
   "他机头瞄我"（`f·dv>0.72|dv|`）——对头遭遇战（双方机头相对）也触发规避 = 平白弃攻。
   **修复**＝补真·后半球检查 `mf·dv>0.05|dv|`（他在我机尾 ±87° 外不触发）。
2. **躲避动作"恒定满舵转圈"= 躲不好**：随机方向的匀速圆周恰好是 lead 提前量最好跟的轨迹，
   敌机/高炮照打不误。**修复**＝破转方向改"朝威胁转"（`aiEvDir=dyT>0?-1:1`，bank−1→yaw增），
   大角速度偏转敌机跟踪的同时把炮口往他头上带。
3. **规避窗内零开火 + 窗后扫描立刻再触发 = 躲到队友收人头**：旧版整窗禁射，窗毕 2.6s 冷却一过，
   咬尾条件仍成立（敌人还在后面）就再躲，永不还手。**修复**＝两段式规避窗：前 55% 满舵破转甩弹道
   （零开火，R10a/b 口径不变），后 45% **反舵回扫威胁方向**照常开火（咬尾机炮同一门限
   `|dy|<0.14 ∧ d<160×eng`、同一 `fireMGBurst(player,0.8)` 诚实弹道管线）——破转变成反攻的
   前半段；窗毕几何上威胁已到机头方向，扫描不再触发，接管自然回到攻击剖面。
4. **威胁源记账 `aiEvSrc`**（对象引用不过夜纪律）：只有敌机威胁记源（反咬有语义）；
   高炮/航弹（对地威胁）＝全窗破转。**敌机射手是机组 Bot 不是 Plane**（fireMGBurst 传
   `crewBot||crew`），挨打置窗按 `attacker.onVehicle.kind==='plane'` 归位到座机再记源，
   否则最高频置窗路径永远记不到敌机。构造/激活/收账/die/respawn/跳伞离机 六处清账。
5. **接管冷却 cd 8→3s**（用户裁定）：`PLANE_TAKEOVER.cd=3` 单源（00-config），
   接管收账/交还后玩家空窗期 8s→3s。

### 判据与回归

- verify-phase4-7b：S8 重钉（cd:3）；**新增 S14b**（后半球判据/破转朝威胁/反咬段 fireMGBurst/
  威胁引用五处清账 四条静态）**+ R10e**（后半球咬尾置窗记源 · 对头不触发 · 前段满舵朝威胁 ·
  整窗机头转向威胁且窗毕清账进冷却）；R4c/R4f/R5b 冷却钉值 8→3——**37 断言全绿**。
- verify-phase4-7d：S4 交接面冻结签名重钉（cd:3）——11 断言全绿。
- 存量：7a(37)/verify-spec(60, T8 版本戳)/probe-planes 12 战役无撞山全过。

### 待验收（用户实机清单）

- 锁定敌机 → Space 接管：敌机咬我尾时，接管飞行员破转后会**转回去咬他**并开火，不再无限躲；
  对头遭遇直接对射不躲。
- 接管飞行员被高炮打时仍会破转甩（对地威胁无"反咬"语义，属预期）。
- 目标被击落/交还后，冷却提示从 ~8s 变 ~3s，很快能再次 Space 接管。
- 版本戳 `20260930i → 20260930j`。

## 一.43 本轮修复：缠斗低空保护（Bot 飞机低空晃悠/动作生硬）+ 防空炮散架修复（2026-09-30i，待实机验收）

> 承一.42（7a~7d）两条用户实机反馈。落地细节见 finished-docs/交付文档-缠斗低空保护与防空炮散架修复-20260930i.md。

### 病根与修复

1. **缠斗贴地兜圈**（"低空晃悠"主因）：满坡咬圈伪升力下沉 ≈8.5m/s + 近距死锁（脱离线 340>进入线 300），
   旧保护只有机下 gh+14 尾守卫（边咬边抬一点俯仰），改出动力学吃光余量 → 贴地兜圈。与接管热修④
   "gh+12 不够改出"同一坑。**修复**＝缠斗低空三参（00-config PLANE_AI 单源）：
   `aimAGL:36` 追击点钳"瞄准点下方地形+36"（不往地里瞄，接管侧 floorY 同手法）+
   `breakAGL:30` 本机 AGL<30 整帧放弃攻击几何（坡度减半+满杆+满油，零开火）+
   `joinAGL:44` 入场门（低空不接新缠斗，与 breakAGL 构成 14m 滞回）。
2. **贴线单帧横跳**（"动作生硬"主因）：净空贴地形规避 need 线时逐帧"规避↔攻击几何"交替，
   俯仰 1~2Hz 猛豚。**修复**＝规避带改出提交 `avdT=1.0s`（非俯冲态触发后钉住 1s 不回攻击几何；
   俯冲态不提交；巡逻→俯冲换态清账）。
3. **巡逻 S 形摆头**：旧巡逻追角速度恒定 0.1rad/s 的绕圈航点，飞机角速度 ≈0.35rad/s 永远追不上
   也甩不掉 → 周期 ~25s 的醉汉巡航。**修复**＝定坡度盘旋（机头=方位角切向+半径误差修正 ±0.6rad），
   一坡度定圆；各机自然沿圈散开（不再全员追同一航点）。
4. 顺带：缠斗速度目标 d=90 一档跳变 → `lerp(spd[0],spd[1],clamp((d-60)/80,0,1))` 连续过渡。
   俯冲对地剖面（dive 态）**维持 7b-乙 现状**（低空进入是攻击动作；gh+16 退出线→climb 节奏未动）。
5. **防空炮散架**（7d-乙 B 方案转录四条断线，离屏渲染取证）：①立柱顶 −0.235 vs 炮箱底 −0.08
   → 回转部悬空 0.155m；②轮底 −1.10 离地悬空 5cm 且轮轴与立柱间无承力件；③引杆近端与轮轴错位
   0.16m；④托架臂挂在立柱侧面半空、座椅整串吊空。**修复**＝立柱加高至顶 −0.045（与炮箱底嵌合
   0.035）+ yaw 层加回转转盘（坐柱顶，座椅/托架臂/炮架的可视载体，yaw 子件 6→7）+ 轮心 −0.85
   轮底精确接地 + 拖车臂×2（立柱↔轮轴）+ 立柱足垫 + 引杆重钉贴轴/远端触地 + 座椅链落到盘面。
   群组契约零漂移（pitch 7 子件/炮口 ~1.8m/击杀圆柱 r0.7·h1.4/AAGUNS.push 不动，塔炮同吃）；
   落地图 `dev/_model-aaaacur0-*.png` 三视图连接成一体。

### 判据与回归

- verify-phase4-7b：S8 重钉 PLANE_AI 签名；**新增 R12a**（贴地缠斗 4s 改出，收场 AGL 34.1>30，
  保底线下零开火）**/R12b**（高位咬贴地目标 5s 盘旋最低 AGL 29.8>24，旧版一路下沉）——34 断言全绿。
- verify-phase4-7d：S5 重钉（引杆贴轴/轮心接地/立柱加高三锚点）+ R6 yaw 7 子件 + **连接算术判据**
  （立柱顶≥炮箱底 · 轮底=地面±2cm · 转盘底=柱顶±5mm）——11 断言全绿。
- 存量：7a(37)/7c(21)/probe-planes 12 战役无撞山（<2.5m 帧 0）；**全家桶 run-all-verify 40/40 exit=0 全绿**（2026-09-30i 批，含 timestopfix 35/killattr 18/loiterfix 17/touchpad 28/roofghost 22/hudfb 63/airground-balance 12 等既有链）。

### 待验收（用户实机清单）

- Bot 互咬/咬玩家保持在 ~30m 以上缠斗，诱到低空会在 AGL≈30 主动拉起脱离；巡逻定坡度盘旋不摆头；
  贴地/山脊改出一次连贯拉起。
- 防空炮模型成形：炮架坐柱、座椅连转盘、轮子接地带拖车臂、尾撬触地；回转/俯仰整体联动。
- 防空炮火力手感不变（7d-乙 射速/弹速/伤害口径未动）。
- 版本戳 `20260930h → 20260930i`。

## 一.42 本轮新特性：P3 阶段四空战重写 7a~7d 收官 = 飞行模型重写 + 空战 AI 全重写 + 锁定/AI 接管 + 空对地平衡 + 对空命中单源/轻武器对空 + 高炮分摊账本 + 防空炮四联20定稿（2026-09-30，待实机验收）

> 承《设计盘点-P3空战重写-20260930.md》§5/§6（子批 7a → 7b-甲乙丙 → 空对地平衡批 → 7c → 7d-甲乙丙）。
> 各子批落地细节：finished-docs/交付文档-阶段四7a飞行与火控批-20260930.md · 交付文档-阶段四7b甲反空热修批-20260930.md ·
> 交付文档-阶段四7b乙丙-AI重写与锁定接管-20260930.md · 交付文档-空对地平衡批-地面火力与跳伞保护-20260930.md ·
> 交付文档-阶段四7c对空命中单源与7d甲分摊账本-20260930.md（判据 verify-phase4-7a/7b/airground-balance/7c/7d 全登记 run-all-verify，**40/40 全绿**）。

### 本轮收官内容（7c + 7d-甲 + 7d-乙）

1. **对空命中单源**（7c）：`planeHitR`(唯一机型命中半径 2.4×size) / `planeHitTest`(线段-球) / `planeNearTest`(点距)
   三件套；旧四套口径（fireMGBurst 手写平径 3.2 球测 / 高炮近炸点距 / 巡飞弹圆柱+兜底 / aimAssist 候选）+
   splashDamage ff 对机圈共五处全部收口；fireMGBurst 对空补 raycastWorld 遮挡（**F7 隔山打消除**）；
   高炮近炸引信 8/11 保留、判定同源。
2. **轻武器对空**（Q3 裁定）：fireBullet 敌机实体化 —— 挡弹道 + 刮血档 `AIRMG_SCRATCH_SOL=[1,3]`/`AIRMG_SCRATCH_MG=[2,5]`，
   Bot 射手 ×GROUNDGUN_VS_AIR（玩家档不减）；**索敌不放开**（平衡批裁定），机炮弹 `noAirHit` 旗标防双份。
3. **高炮多机分摊账本**（7d-甲）：`aaSpreadTarget` 认领最少优先（平手取近）+ 粘滞到目标亡 + 只计本队；
   `enemyPlaneAlive` 退役为存在性判据（归队/退炮位两消费点保留）。
4. **防空炮建模定稿**（7d-乙，用户三选一定 B）：四联 20mm Flakvierling 风（轮式拖车底盘/2×2 四身管/双弹鼓/
   托架臂座椅/小盾），`aaGun` 建模段整体重写，群组契约 grp>yaw>pitch / 击杀圆柱 r0.7·h1.4 /
   AAGUNS.push 条目结构零漂移（塔炮同吃一座建模函数）；落地图 `dev/_aafinal-*.png`（render-aamodel.js）。
5. **防空炮火力双升**（7d-乙 用户裁定「射速和弹速也要有所提升」）：EMPL_AA_CD 0.34→**0.22**（玩家/Bot 同档）；
   弹速独立立户 **FLAK_SPD 460**（旧借 SHELL_SPD 380，调高炮不再牵动坦克炮），Bot 引导与玩家指示圈两处
   提前量同源换算，life 2.05→1.7 保 ~780m 射程包线；Bot 对机 DPS 相对平衡批前 ≈0.77 未回潮。
6. **交接面冻结核对**（7d-丙）：fireFlak→flakShots 管线 / AAGUNS 条目结构 / PLANE_TAKEOVER 签名钉进
   verify-phase4-7d S4（弹速/life 为 7d-乙 后新冻结态）+ S5/R5/R6 乙批钉；版本戳 `20260930g → 20260930h`。

### 待验收（用户实机清单汇总）

- 7a：飞行手感/火控辅助（lead pip/CCIP/airmg 吸附）。
- 7b：E/中键锁定、Space 接管（老飞行员代打·全包）、接管保底高度 40m+规避（热修）、新手档穿高炮区抽查。
- 空对地平衡批：高炮 140m 交战/弹伤减半、玩家高炮火力不变、跳伞全程不点名、伞上开枪被还击。
- 7c：空空缠斗无隔山打、贴地扫射挨还击但只是刮血、机枪工事对空刮血、多门高炮分摊不集火。
- 7d-乙：防空炮四联观感（轮式底盘/四管/弹鼓）、射速弹速提升手感、AI 飞机挨高炮强度未回潮。

## 一.41 本轮修复：击杀来源归因（弹体自带标签+命中重盖章）+ 受击方向弧逐帧重算（2026-09-29，待实机验收）

> 承用户三条实机反馈：①巴祖卡击杀小兵播报显示柯尔特 M1911；②坦克被"打不动的武器"（STG44/M1911）击毁；
> ③受击方向弧不随角色转向变化。①②同根：来源标签挂在射手身上、击杀结算那一刻才读。

### 病根/口径

- `_src` 是射手身上的可变标签（每次开火覆盖），而 `killSrcLabel` 在击杀时才读 ⇒ 一切**延迟杀伤**弹体
  （火箭/手雷/迫击炮弹/炮弹）飞行期间射手再开别的枪，播报就记成后开的枪。即时命中链（子弹）无此问题。
- 缺陷①的直接病灶：玩家火箭筒分支 `fireRocket(...)` 后提前 `return`，走不到 `p._src=当前武器名`
  （20-player:808）；Bot 火箭两处（14-bots 打坦克/打舰船）同样不写。
- 缺陷②的真凶：火箭/迫击炮弹等延迟弹体的标签被覆盖。取证纠正：普通手雷走 `explodeAt` **没有坦克伤害圈**，
  伤坦克的爆炸只有走 `splashDamage` 的那几路（坦克炮/火箭/反坦克炮/迫击炮弹/AT炸药/航弹/巡飞弹/舰岸炮）。
- 缺陷③：`addDirHit` 入帧算一次写死 DOM transform，之后不更新。

### 落地（2026-09-29 问询定案：弹体自带标签 / 弧定格世界方位只随玩家转向重算）

- **A 弹体自带标签**（创建点 11 处加 `src`）：`fireRocket`(=def.name, **发射时同步盖章 shooter._src**)/
  反坦克炮/迫击炮×3/throwNade 按弹种映射/坦克主炮/幽灵坦克/舰炮/岸炮/航弹。
- **B 命中重盖章**（4 处，伤害结算前一行 `owner._src=弹体src`）：`updateShells` 命中块 / `shellHitNaval` /
  `nadeExplode` / 巡飞弹引爆块（含直击三路）。击杀链与结算同步 ⇒ 播报必读本弹标签。
- **C 方向弧**：`addDirHit` 定格 `d._wAng`（合并分支续传）+ 新增 `updateDirHits()` 每帧按
  `_wAng-player.yaw+π` 重算（yaw+1 ⇒ rel−1，弧反向滑动、世界指向不变；攻击者走位不追踪=裁定口径）；
  22-hud `updateHUD` 逐帧段接线（typeof 守卫）。

### 判据与回归

- 新增 **dev/verify-killattr.js（18 断言 0 失败）**：T1 玩家火箭（发射即盖章+飞行中覆盖→重盖章→播报
  [巴祖卡 M9]）/ T2 Bot 火箭→坦克（[坦克杀手]）/ T3 迫击炮弹→坦克（真创建点，[迫击炮]）/ T4 弹种标签
  映射 / T5 弧转向随动 −1rad + 同侧合并 / T6 updateHUD 接线。载入清单运行时解析 index.html（41 脚本）。
  探针侧四坑（未部署/CANNON 裸全局/水网+双高射线+方位轮转/**出生保护 SPAWN_PROT=0 整批豁免**）已记档。
- 既有回归：verify-wipe **81/0**（T12/T14 原红=出生保护后旧探针未豁免，补两行即绿，非本次引入）；
  phase3 65/0；timestopfix 35/0（批跑偶发一次 23/10，单跑三连绿）；naval 9/0；fire 全过。
- 版本戳 `20260928k → 20260929a`（41 处）。详见 `finished-docs/交付文档-击杀归因与方向弧-2026-09-29.md`。

## 一.40 本轮追补：P1 首轮追补① = 爆头封顶只认 Bot 射手 + headMul 爆头倍率分档 + 瞄准加成（散布/后坐）梳理（2026-09-28k，待实机验收）

> 承一.39 首轮批的四条用户实机反馈：①"我远距爆头也不能秒人，十分不爽"（并问狙击枪远距衰减）；
> ②"不同种类枪的爆头倍率也值得区分，比如狙击大于步枪大于冲锋枪"；
> ③"同一个武器的瞄准对非瞄准状态应该有一定加成，不同武器的瞄准状态加成也应当有所区分"；
> ④"Z键和C键的动作应当有加成吗？还是有吧，不过必须非常微小"。

### 病根/口径

- **封顶误伤玩家**：j 批 HEAD_CAP=95 不分射手敌我 ⇒ 玩家非镜枪爆头同样被封 95（五血必活），"爆头秒人"
  近远距一起被堵死。衰减本身不是拦路者 —— 镜栓动 fallS/fallE/fallF=90/300/0.85（300m 爆头 204 照样秒）、
  普通栓动 70/260/0.8（地板 156 也远超 100）；真身=封顶口径过宽。
- **headMul 失序**：旧表冲锋枪 1.8~1.9 ≈ 自动步枪 1.9、手枪 2.0 反超冲锋枪、非镜栓动 2.5 与镜狙击同档
  —— 无层级可言。

### 落地

- `js/13-combat.js`：封顶条件收窄加 `!shooter.isPlayer` —— 保护只朝玩家单向：Bot 爆头永远秒不死玩家
  （95 必活），**玩家爆头照杀**（kar98 近距 187 / 280m 仍 150，全程一枪）；Bot 互射仍封顶（战场消耗节奏
  维持 j 批）。`js/00-config.js` 单源注释同步。
- `js/09a-defs.js` **headMul 分档**（用户裁定"狙击>步枪>冲锋枪"）：非镜栓动 2.5→**2.4**（kar98/莫辛/
  三八/中正式 4 把）、冲锋枪 1.8/1.9→**1.6**（汤普森/MP40/波波沙/百式/花机关/快慢机 6 把）、
  手枪 2.0→**1.7**（5 把；M1911/TT-33 不再两枪爆头）；镜狙击 2.5 / 骑枪 2.1~2.2 / 自动步枪·轻机枪·
  卡宾 1.9 / 反坦克枪 1.5~1.6 反器材特例 不动。全表单调：**2.5 > 2.4 > 2.2·2.1 > 1.9 > 1.7 > 1.6 > 1.5**。
- **瞄准加成梳理**（用户裁定③"瞄准对非瞄准有加成且分武器区分"）：机制本就在（20-player
  `lerp(spreadHip,spreadAds,adsBlend)` + 呼吸 0.4/依托 0.35，Bot 用自身瞄准模型不吃此表），失序四处——
  ①加兰德腰射 2.2→**3.0**（原为全场最佳，比手枪/冲锋枪还准）；②骑枪族腰射 5.2~5.8→**4.4~5.0**
  （短枪管不再比全尺寸栓动差）；③**火箭筒散布改 lerp**（原只吃 spreadAds，表里 spreadHip 从未生效=
  腰射白嫖瞄准精度）；④**瞄准后坐折扣分档**：镜狙 0.7 / 非镜栓动 0.78 / 其余 0.85（原一刀切 0.85）。
  加成倍数（hip/ads）成档：**镜狙 250 > 反坦克枪 60~100 > 栓动 35~60 > 半自动 21 > 骑枪 17~20 >
  自动步枪/轻机枪 6.8~7.6 > 卡宾/手枪 5~6 > 冲锋枪 3.8~4**（冲锋枪=腰射武器收益最小是刻意设计）。
- **姿势加成（裁定后撤销，维持原样）**：用户问询"Z/C 动作应当有加成吗？还是有吧，不过必须非常微小"
  —— 曾按"非常微小"试收 0.95/0.9，**用户随即裁定撤销更改、维持原档**：散布 蹲 ×0.8 / 趴 ×0.5、
  后坐 0.85 / 0.68 不变；探针 S2i 把原值钉死防后续漂移。Bot 侧姿势精度（14-bots 0.75/0.55）是其
  自身瞄准模型，不动；屏息 0.4 / 依托 0.35 是主动技能不是姿势，保留。

### 判据

- `dev/verify-phase3-20260928.js` **64 断言 0 失败**：B8e 分档表断言 + B8f 玩家冲锋枪爆头实弹
  （500→466 = 21×1.6，旧 1.8 会是 462）+ B9 重写五断言（Bot 爆头 100→5 / 玩家 kar98 爆头 500→313
  =187.2 豁免 / 玩家 280m 爆头 500→350 =149.8 / Bot 爆头打玩家 100→5 / 镜枪 500→260 不封顶）+
  S2b 源码断言收窄口径（`!shooter.isPlayer&&dmg>HEAD_CAP`）+ B8g/h/h2 瞄准加成分档单调 +
  S2h（火箭筒散布 lerp + 瞄准后坐分档折扣）+ S2i 姿势加成微小化。
- 全量 `run-all-verify`：35/37 exit=0 —— 仅 verify-naval 批跑偶发 2 次（单跑三连绿 = 已知 ~1/20
  布局指纹抖动，非回归，naval 链不经过本批任何改动面）。
- 版本戳 `?v=20260928j → ?v=20260928k`。

## 一.38 本轮修复：阶段二 重立案清算批 = D1 观战击落浮空 + D3 贴图不一致 + D9 第三人称隐身 + D10 观战指向线（2026-09-28，用户实机验收通过 ☑）

> 承《缺陷登记与路线图-2026-09-28.md》§五 阶段二（批次③ D3 诊断批 + 批次④ D1 诊断批，实际合并落地，另顺带清账 D9/D10）。
> 落地细节见「finished-docs/交付文档-阶段二重立案清算批-20260928.md」；沙箱判据 `dev/verify-phase2-20260928.js`（登记 run-all-verify）+ `dev/_d1spec.js` 观战复现链。

### 病根（四条，全部实锤）

- **D1 被当空击毁的飞机浮空固定（重立案→关闭）**：病根在**观战信息层**——22b-speclayer 名牌 Sprite
  挂进 `plane.grp` 且 `t.userData.host=h.host` 自引用环；观战期击毁 → `die()` 的 `grp.clone()` 内
  THREE `Object3D.copy` 对 userData 做 `JSON.parse(JSON.stringify(...))` 抛循环结构异常 → 中断在
  `alive=false` 与 `grp.visible=false` 之间 = 死而不隐挂天；"一段时间后消失" = 35~48s 重生计时清走，
  与坠落无关。平时不复现（名牌只在观战期挂载）；此前两轮探针"全绿"是**判据盲区里的绿**
  （游戏实载 41 脚本、探针只载 39，22b/19b 从未进沙箱——教训：探针载入清单必须与游戏实载一致）。
- **D3 贴图不一致（重立案→关闭，两层病根）**：层一 = B5 永久件逐盒 +6% 提亮把带门窗的墙拆成一墙两色
  拼块（**用户裁定取消提亮**：structMatPerm 直通、perm 盒标记保留）；层二 = uvGeo 只有 Box 分支，
  烟囱/草垛类圆柱侧面 UV 0..1 直通（"烟囱巨砖"），新增 Cylinder/Cone 归一分支（侧面按弧长/斜长、
  端盖按半径归一，分类走 g.groups，仅带 uvRef 材质生效，参数键缓存）。
- **D9 第三人称本体偶发隐身（随批报告→关闭）**：playerAvatar 是对局中首次按 U 才 scene.add 的惰性
  常驻对象，不在开局快照里 ⇒ 世界还原 `_wsnRestoreGraph` 把它摘出场景（parent=null）而模块引用还在
  ⇒ 下一局每帧 visible=true 写在已脱离场景的节点上 = 本体与枪模不渲染、命中判定照常（"该中弹还是中弹"）。
  clearMatchEffects 对同类惰性对象（小队标记/降落伞）均有"摘除后置空"，唯独漏了 playerAvatar。
- **D10 观战指向线跨局全灭（顺带发现→关闭）**：D9 同族——specLineOf 的 scene.add 惰性线被世界还原
  摘出而 `u._specLine` 引用残留，下一局观战指向线全灭。名牌挂在单位 grp 里随单位走，无此问题。

### 落地

- `js/22b-speclayer.js`：删除名牌 `userData.host` 环源（全库无读者）；specLineOf 自愈
  （取线时 `if(!l.parent) scene.add(l)`）。
- `js/16-aircraft.js`：die() 结构性加固——`grp.visible=false` 提前到 `alive=false` 之后立即执行，
  交接块（信标摘除/clone/残骸挂载/入列）整体 try/catch，"死而不隐"从结构上不可能。
- `js/05-world.js`：structMatPerm 直通（取消提亮，用户裁定，启动日志同步）；uvGeo 新增
  Cylinder/Cone 归一分支。
- `js/20-player.js` + `js/23b-worldrestore.js`：新增 `playerAvatarReset()`（摘 parent+置空引用，
  下次 ensure 原地重建），clearMatchEffects 按降落伞同款 typeof 守卫调用。

### 判据

- `dev/verify-phase2-20260928.js`（全绿）：D3a 提亮取消/perm 标记保留/markPermPieces 幂等 ·
  D3b 圆柱归一（丝厂烟囱+谷仓草垛正例 + uvGeo 直调 + 树皮阴性对照，诺曼底/淞沪双图）·
  D9a-c 还原摘除复现 + reset 重建回场景 + 无 reset 阴性对照 ·
  D1-K1~K7（直伤/溅射/触地/玩家座机四击落路径 × 副作用投毒×3 × 时停冻结两态口径 × 观战名牌现场）·
  D10a-c 指向线还原摘出复现 + 自愈重挂；
- `dev/_d1spec.js` 观战现场复现链：修前 die 链抛循环结构异常（红）、修后全绿，钉死 D1 因果；
- verify-destruct T10 / verify-roofghost 判据随"取消提亮"同步改口径（材质带 permTier 即违规、
  消息注明提亮已按裁定取消）；T10 census 对齐现行两处标记点（高件 1252 + 09-28C 永久屋盖薄带 604
  = 1856，既留漂移红一并销账）；verify-specbatch T6 名牌断言翻转（原断言要求 userData.host 存在
  = 断言的是 D1 环源本身，改为"标签在且无环"）。
- 全量 `run-all-verify`：34 探针 exit=0 全绿（一次过，无需稳定性复跑）。首跑 4 稳定红均已查明：verify-text/verify-spec =
  版本戳升 i 时 `__sfStyleVer` 漏改（探针正确抓到不一致，补改后绿）；verify-specbatch = 上述断言
  翻转；verify-destruct = 上述 T10 census 对齐（见文末回归基线）。

### 实机验收（用户 2026-09-28 已验收通过 ☑）

1. D1：观战模式（无时停无幽灵坦克）击落 AI 战机 → 本体立即消失、残骸拖焰坠地燃爆，无浮空；
2. D3：带门窗不可毁墙明暗一致无拼块；烟囱砖块与墙面同尺度；
3. D9：打完一局 → 新一局按 U，本体与枪模必显示；
4. D10：跨局再进观战，指向线正常显示。

## 一.37 本轮修复：阶段一「轻量速赢」HUD/反馈批 = D2+D5+D6+D7+D8（2026-09-28，待实机验收）

> 承《缺陷登记与路线图-2026-09-28.md》§五 阶段一（批次① 操控与准星 + 批次② 命中/受击反馈），五项互不踩、一次实机验收。
> 落地细节见「finished-docs/交付文档-阶段一HUD反馈批-20260928.md」；沙箱判据 `dev/verify-hudfb-20260928.js`（63 断言，登记 run-all-verify）。

### 落地（五项）

- **D2 操控方式独立分组**（回链登记 D2）：画质行只剩画质；独立「操作方式」节 = 自动/触屏/键鼠三并列按钮
  当前档高亮（`sf_mobile` 删键='auto'/'1'/'0' 直接映射，键契约未变）；旧"操控: xx"循环按钮删除；
  手柄说明进节内；i18n 词典补键（操作方式/自动/触屏/键鼠 + 说明，中英齐全）。切换沿用旧口径：写档后整页重载。
- **D5 机瞄保留小准星**（回链登记 D5）：`ads&&!scoped` 不再隐藏准星 —— 反坦克枪侧偏机瞄特批并入通用规则，
  非镜武器机瞄屏上保留 5px 小准星；带镜武器仍走镜内分划；腰射动态 gap 不变。
- **D6 坦克准星残留**（回链登记 D6，病根实锤）：tankPip/mgPip/leadPip 是双写点字段（20a-seats 直写
  style.display 绕过 hudStyle 去重缓存）⇒ 出车那一帧兜底 hudShow 因缓存里还是进车前的 'none' 而**漏写** = 残留。
  新增 `hudHideReal`（按 DOM 实际值幂等写）接管三 pip 兜底（与 mgHeatWrap 既有兜底同款）。
- **D7 击杀确认**（回链登记 D7，定位更正）：21-match 的红/白档与升档音本就存在（09-13 结算批引入），
  真病根是**同帧盖档时序** —— 致命一击 die()→onPlayerKill 出红档后，fireBullet 返回路径上的 onPlayerHit
  当帧把它盖回白档。修：①13-combat 命中步兵补 `sr.sol.alive` 守卫（致命一击不再补白档）；
  ②onPlayerKill 定时器挂 hm._t 接管收账槽 + 车毁多杀红档音 0.25s 合并；③载具命中 20% 抽奖音收敛为
  确定性 onPlayerHitVeh（白档标记 + 0.12s 节流音）。
- **D8 受击方向指示**（回链登记 D8，定位更正；**三稿，终稿=用户裁定**）：旧 addDirHit 小三角（90px 处
  22px，肉眼难辨）重做；一稿 60vh 圆环顶弧（实机：「太大、没尖锐/紧迫感和美感」）与二稿 clip-path 楔标
  （实机：「偏离中心太远且太不规则」）均被打回，且用户点名批评流程 —— **视觉类应先问再改**；
  三稿按 AskUserQuestion 裁定落地：**战地式窄弧（等宽 ≈45° 圆滑短弧，radial 弧带+conic 遮罩，纯圆弧
  无锯齿）+ 中距 ≈150px**，出生 0.3s 脉冲 + 红辉光，rotate 指向来向，1s 渐隐 + ±0.6rad 同侧多源合并；
  新增 addVehDmgDir 单源接坦克/飞机/舰船三处 takeDmg 的 playerDriven 分支 —— 载具乘员同样有方向指示；
  步兵路径不变。

### 判据

- `dev/verify-hudfb-20260928.js`（**63/63**，含 6 条阴性对照：D6 缓存毒化证明旧路径漏写、D5 腰射动态 gap、
  D3 手动 onPlayerHit 复现盖档、B4 两态不出弧等；源码锚一律签名子串定位、"已无"类剥注释再查；
  D8 三件旧形态各配一条"已废"防回流锚）；
- 全量 `run-all-verify`（改码冻结后干净重跑）：**36 条 33/39 exit=0** —— `verify-destruct-20260927N`
  稳定红 = §一.36 已登记的 T10 遗留项（非本批）；`verify-aimassist` 偶发 1 红 = 环境抖动（单跑 10/10 绿，
  本批改动不在吸附链路）；其余全绿（含本批 `verify-hudfb` 63/63）；版本戳 `20260928e→20260928h`
  （43 处，Node fs 改；批内四跳 —— f/g 被用户实机看一/二稿时加载，三稿定稿升 h 保缓存击穿）。

### 实机验收清单（用户操作 → 应看到）

1. **D2**：游戏设置 → 画质行只有三档画质；其下独立「操作方式」节：自动/触屏/键鼠三按钮、当前档高亮；
   点另一档 → 重载后生效并高亮；语言切 EN → 该节全英文。
2. **D5**：步兵持冲锋枪/步枪等非镜枪械按住右键机瞄 → 屏上仍有 5px 小准星；狙击枪开镜 → 镜内分划、屏准星消失。
3. **D6**：进坦克打几炮再按 F 下车（重复几次、换车试）→ 坦克落点圆环/机枪圆圈零残留；阵亡/被炸出/换座/进观战后同样干净。
4. **D7**：①打伤敌人 → 准星处白色标记+命中音；②打死敌人 → **红色**标记+明显更重的击杀音（与白档一眼可分，不再"击杀没表示"）；
   ③机枪/反坦克枪扫坦克 → 每发命中都有白色标记与声音（不再 20% 抽奖）。
5. **D8**：被敌方任何方向射击 → 准星外一圈（≈150px）出现指向伤害来源的**等宽红色窄弧**（战地式，
   360° 各向可辨，两端柔和渐隐），1 秒后渐隐；
   同侧连续受击不叠影；**在坦克/飞机/舰船上被击中同样出现**；与红闪叠加不刺眼。
6. **D1 攒问（随本批验收一并答，两小问）**：
   ① 上次看到"飞机浮空固定"是**怎么打下来的**（巡飞弹 / 防空炮 / 战机互咬 / 其他）？
   ② 当时是否处于**时停（K）或观战模式**？（时停冻残骸是既定裁定口径，若是则另算）

## 一.36 本轮修复：不可破坏建筑"各部位像两种材料" = 材质克隆丢 uvRef（2026-09-28E，待实机验收）

### 起因（用户实报，附五张截图：诺曼底谷仓/灰白楼/砖楼×2 + 淞沪砖库）

「各个不可破坏建筑的各个部分的材质一致性非常差劲，像是挨了涂鸦一样，急需修复。」

### 病根（一条链，不在这几批贴图本身）

**05-world `_matShade`（B5 永久件档 / B3 受损档的池化克隆）用 three 原生 `Material.clone()`，注释自己写明
"clone() 不复制自定义字段"，却只回写了 dmgTier/permTier，漏了 `uvRef`** ⇒ 挂了变体材质的件全部丢失
贴图密度登记 ⇒ `uvGeo`（按 uvRef 归一盒面 UV 的单源）把它们当"未登记"跳过 ⇒ BoxGeometry 六面 UV
0..1 **原样拉伸铺满各自的小面**：每段墙/檐带/坡板/山墙的砖石木纹比例各不相同 —— 实机就是"拼贴涂鸦"：

- 谷仓坡顶/山墙（solidBox 永久件）：整张贴图拉到 7.6~10m 宽 ⇒ "木板"≈1.2m 一条 = 斑马条带 + 山墙发白；
- 砖楼檐带/女儿墙/屋面板：砖放大 ~2 倍、色调发闷（= 截图顶部那圈"大砖带"）；
- 抹灰楼/石裙墙：石块拉成巨块、抹灰斑纹错档 ⇒ "白模+贴皮"感；
- 淞沪丝厂/教堂/工事等全部永久件同病（`_uvdensity-audit` 当时的"密度 1.0×"结论只覆盖**原材质**件，
  变体克隆件不在它的"未登记"告警视野里 —— 审计盲区，见判据②）。

对照计数（修复前，诺曼底）：perm 克隆 121 件**全部**丢 uvRef；offset 克隆丢 138 件（多数是
perm→offset 链式克隆，源头同此）。原材质与 depthVariant 直挂件不受影响 —— 这就是为什么
2026-09-20c/09-27Q/09-28B 三批贴图重做后"总还有几栋楼不对"。

### 修复

- `05-world._matShade`：克隆后补 `if(mat.uvRef!==undefined) m.uvRef=mat.uvRef;`（与 `depthVariant`
  05-world.js 同一纪律，一行）。受损档（实战中墙面变暗档）此前同样丢 uvRef —— 打伤一面墙
  变色那一刻起该组全部网格贴图拉伸，本修一并根治。

### 判据

- 新增 `dev/verify-uvref-20260928.js`（登记 run-all-verify）：① 诺曼底+淞沪两图全库
  brick/plaster/stone/wood/woodDark/roof 盒面材质 uvRef 零丢失；② 阴性对照 —— 把砖墙材质
  人为克隆抹掉 uvRef 复刻旧 bug，判据必须报红（诺曼底抓到 241 件）；③ 抽查谷仓木构件全部带 uvRef。
- 外观复核：`dev/_bldview.js`（新，离线建筑渲染器：真 three 全链 + SVG 贴图结构层栅格化 + 透视
  软件光栅出 PNG，用法 `node --stack-size=4000 dev/_bldview.js <战役> <类型> <序号> <视图>`）——
  修复前两层楼檐带砖≈墙砖 2 倍、修复后全楼同尺度同调；谷仓斑马顶/异色山墙同图消失。
  （取证工具不登记 run-all-verify。）

### 已知遗留（非本批引入，如实记录）

`verify-destruct-20260927N` T10 两项红：perm 件清点 1856 vs 1252（604 件低于"高≥1.6m"门槛）+
1211 件共用网格无 permTier —— 与 09-28C 屋顶永久化批的口径漂移（本批 uvRef 一行不参与该清点），
留待该批实机验收时一并对表。

## 一.35 本轮修复：结算排版 + 屋顶永久化 + 幽灵坦克静音/越野 + 弹速×2（2026-09-28C，待实机验收）

### 起因（用户五项，2026-09-28）
① 结算画面排版不美观；② 不可破坏建筑的房顶应改为不可破坏；③ 幽灵坦克开火没有音效（无间隔开火加音效太吵）；④ 各种炮弹、枪弹的子弹速度乘二；⑤ 幽灵坦克被"普通坦克能碾压的东西"阻挡，越野能力需增强（用户已知这是刻意设计，但仍裁定放宽）。

### 落地
1. **结算排版**（css/style.css）：`.endPanel` 820→880 —— 7 张战绩卡（7×104+6×10=788px）在 820 面板（内衬 40×2）里差 48px，第 7 张"摧毁数"孤行坠底左角；880（=主菜单蒙版宽）后单行 7 卡。观战「不计入历史」徽章 `inline-block→display:table` 独占一行居中（旧版悬在得分卡右腰）。兵力对比条 640→700。
2. **屋顶永久化**（js/05-world.js `pitchedRoof`）：`roofRefFinalize`（血量+roof 标记）只在**有可毁承重墙**（传入 wallGs）时登记；无 wallGs 的房（教堂/谷仓/帐篷——墙是 wallSeg 默认 destr:false 永久件）屋盖不再可轰塌，并整片按 B5 永久件档提亮（structMatPerm 池化克隆）；`markPermPieces` 加 `b.perm` 幂等守卫。四座 indestr 地标本就无 roofRef，不受影响。
3. **幽灵坦克静音**（js/15c-specveh.js）：删 `fireCannon`/`firePlayerMG` 的两处发声（AudioSys.cannon / gunshot）；特效与弹丸照旧。
4. **弹速×2**：`SHELL_SPD`/`SHELL_SPD_NAVAL` 190→380（单源；AI 提前量/炮口补偿/岸炮/高炮全链自动跟随；life 不动 ⇒ 包线×2）；`fireRocket` 85→170；迫击炮 tof 除数减半（13-combat `dH/84,0.9~2.1`、14-bots `dist2/30,0.85~1.7`，落点解恒精确）。枪弹=即时命中射线，无弹速。
5. **幽灵越野**（js/15c-specveh.js）：放行条件 `b.crush ‖ (!b.dGroup && ≤TANK_STEP)` —— crush 掩体整类穿越且**不碾毁**（世界原样，无实体感口径不变）；高墙/dGroup 仍阻挡。

### 判据与回归
- `verify-20260921B-speed` 重锚 380：**20/0**（③ 包线口径改"恰好×2±1%"；④ 新增 190/85/42/15 防回流模式）。
- 新增 `dev/verify-roofghost-20260928.js`（已登记 run-all-verify）：**22/0** —— 柏林 545 roof 盒全有 hp+可毁承重墙；诺曼底教堂/谷仓上层区 roof 盒=0+perm≥4；幽灵开火 0 发声+弹丸照出（真坦克发声阴性对照）；crush 3m/1.1m 穿越+boxDead=false、高墙/dGroup 阻挡（阴性对照）。
- `verify-boot`/`verify-text`/`verify-structscore` 44/0/`verify-spec` 57/0/`verify-worldrestore` 10/0/`verify-rooffall` 全绿。**全家桶未跑**（token 预算；下批先补跑）。verify-rooffall 曾红=水面批漏同步该探针地形副本 `waterSurfRegStrip`（继承性问题，本批顺手补齐）。

### 实机验收清单（用户操作 → 应看到）
1. 打一局到结算：7 张战绩卡**一行排齐**（无孤行）；观战局时"观战模式·本局不计入历史记录"徽章在**得分卡正下方居中**（不再贴其右侧）。
2. 找教堂/谷仓（诺曼底/斯大林格勒），用坦克炮/飞机轰屋顶：**屋顶不再塌**，墙照旧打不烂；屋顶比可毁房的顶**略亮一档**（永久件标记）。
3. 观战召唤幽灵坦克按住左键连射/右键机枪：**无炮声/枪声**，炮口焰与弹道照旧。
4. 任意坦克主炮：弹速明显变快、弹道更平（AI 提前量自适应仍会互中）；迫击炮弹飞行时间减半。
5. 幽灵坦克开进沙袋/木箱/树篱：**直接穿过**，掩体留在原地；撞城墙/楼房照旧被挡。

## 一.35 触控模式审计修复 + 手柄支持(2026-09-28D,待实机验收)

### 起因

> 检查一下触控模式是否一切正常,再加上手柄支持。—— 2026-09-28 第六报

### 落地(逐条证据见「finished-docs/archive/交付文档-触控审计与手柄支持-20260928D.md」)

- **触控审计 8 项修复**:①触屏 TV 制导补记账分支(旧版输入被弹体覆写 = 完全无效,与键鼠 2026-09-28B 同源);②移动端 pointerLocked 恒真 + touchmove 无条件 preventDefault ⇒ 打过一局后面板滚动/设置滑条失灵(捕获门补 alive+deployed、preventDefault 只拦已捕获触摸);③bindBtn 补 touchcancel(系统手势打断不再卡死开火键);④开镜灵敏度单源 `lookZoomMul()`(旧触屏写死 0.5:狙击镜过快、炮手镜不收窄;键鼠/触屏/手柄三入口共用);⑤触控按钮 EN 残留(全量 data-i18n + 词典 22 键,tSkill 变更才写);⑥竖屏 tFire2 与"趴"重叠(CSS 避让);⑦岸防炮位 ADS 门补 onBattery(键鼠+触屏);⑧tJump 改走 kd/ku(观战双击空格触屏可达)。
- **手柄子系统**(新增 `js/19b-gamepad.js`,主循环逐帧轮询):与触控同一套合成输入架构(只写 keys/mouseDown/yaw/tvDX 单源,消费端零改动);Xbox 标准键位(RT 开火/LT 瞄准/双摇杆/A 跳/B 蹲/X 互动/Y 换弹/LB 疾跑/RB 手雷/LS 切枪/RS 近战/Back 战况/Start 暂停/十字键投掷物);右摇杆 rad/s 模型 + 径向死区 0.22 + TV 制导满杆记账;断开即释放全部按住态、非战斗帧逐帧归还;说明页新增「手柄操作」节(双语)。

### 回归基线

- `dev/verify-touchpad-20260928.js`(新增,**28/0**):T1 触控 12 条源码断言 + G1 手柄 16 条沙箱真链(假 gamepad:按住态/ADS 门/摇杆解析式(死区归一化)/死区/TV 记账清账/工程兵十字左/Start/切枪/断开全释放/非战斗归还);已登记 run-all-verify。
- `verify-text` 全过(键闭环+目录 1:1+单戳 20260928d);`verify-loiterfix-20260928` **17/0**(19-input mousemove 改动复跑)。

## 一.34 本轮修复：巡飞弹 TV 制导重做 + 击落视觉交接原子化 + 砖/抹灰贴图二次校准（2026-09-28B，待实机验收）

### 起因

> 材质问题仍十分严重。
> 另外现在巡飞弹转向十分生硬还随机失控，原因不明。
> 现在被巡飞弹击毁的飞机会挂在天上固定不动，都需要修复。
> —— 2026-09-28 第五报（附实机截图×2，观战·巡飞弹发射器视角）
>
> 这是另外一张材质不一致的参考图。/ 这是另外一张材质不一致的纺织厂参考图。
> —— 2026-09-28 追报（附实机截图×2：诺曼底灰白楼 / 淞沪砖构大厂房）

### 落地（逐条证据见「finished-docs/archive/交付文档-巡飞弹与材质不一致-20260928B.md」）

- **① 巡飞弹 TV 制导 = 鼠标直控**（`13-combat.updateLoiters` + `19-input` mousemove + `18-game` 新字段
  `tvDX/tvDY`）：旧版鼠标增量写**本体** yaw/pitch、弹体以 1.9 rad/s 有限角速度"追角" ⇒ 甩镜时弹体落后
  （实测 1.1 rad 要追 34 帧 ≈0.57 s）、**超存的角差永远留在本体角里**，松手后弹体继续拐（"随机失控"）。
  现在 19-input 制导期间只把 movementX/Y **记账**进 `player.tvDX/tvDY`（不碰本体角），updateLoiters 把增量
  **直接**转成弹体姿态、逐帧限角速度（yaw 2.5 / pitch 1.9 rad·s⁻¹，85/74 视场灵敏度补偿）、**超出的增量丢弃**；
  `player.yaw=d.yaw`（本体角=弹体角，退出 TV 视角画面不跳）；引爆/静默退场统一清账（tvDX/tvDY=0，
  下一枚出膛不会"先拐一下"）。
- **② 击落视觉交接原子化**（`16-aircraft Plane.die`）：残骸克隆 + 入 `planeWrecks` + `grp.visible=false`
  **整段提前**到记分/战报/布娃娃/兵力/特效之前，且副作用整段 try/catch —— 旧版记分链任何一环抛异常
  （记分 DOM / cannon / killfeed）都会留下"死而不隐"的飞机挂在天上（`update()` 对 `!alive` 早退，永远不修）。
  探针里用注入 `showKillPop` 抛异常**复现**了旧顺序的挂空机制，并验证新顺序异常不逃逸、交接照常完成。
- **③ 砖贴图 8×16 块/贴**（`02-scene` canvas+SVG 同步，`uvRef=1.8` 不变 ⇒ 单砖 0.225×0.1125 m）：
  旧 64×32px 大砖在大厂房立面读作"玩具积木"（用户追报图取证：`_uvdensity-audit` 诺曼底/淞沪全量
  盒面密度中位=1.80/2.00 m/贴、跨度 1.0× —— **不是 UV 拉伸，是贴图内砖块太少**）；逐块只抖明度
  （旧整列同色 ⇒ 墙面竖向色带）、行内奇偶错缝、越界半块取对边同列色（平铺闭合）；砖缝压暗 #6e5849、
  高光/阴影条收细收淡（旧米白宽缝让受光/背光面读作两种材料 = 用户说的"不一致"）。
- **④ 抹灰二次校准**：28 首版"去离散图形"把合成明度调制压到 ~2%，实机读作"没上材质的白模"
  （诺曼底灰白楼追报图）。现 4 层 fBm（大修补斑 −16% / 晒褪斑 +9% / 细颗粒 / 微齿）合成调制 ~5-8%，
  `stitchTiles="stitch"` 无缝、**仍无任何离散图形**、单层 op≤0.5（不会退回"圆点/毛线"）。
- **⑤ 桩保真**（`dev/_bootstub.js`）：`BufferGeometry` 补 `clearGroups/addGroup`、伪 DOM 补 `firstChild` ——
  新带环几何让 13 条探针 `g.clearGroups is not a function` 假红清零（回归基线曾整体变红的前因）。

### 回归基线

- `dev/verify-loiterfix-20260928.js`（新增，**17/0**）：增量→姿态逐位=解析式 / 上限丢弃 / 零输入 120 帧
  逐位不变（阴性：旧公式同态 3s 还要再拐 1.10 rad）/ 20 s 零下沉 / 本体角=弹体角 / 真 mousemove 记账 /
  引爆清账 / 源码顺序（残骸+隐藏 早于 记分+布娃娃，try 包裹）/ 正常+打断双路径行为 / 时停口径三条。
- `verify-matseam-20260927`（**44/0**）：砖平铺闭合+接缝连续+逐块色相（选择器随 8×16 新尺寸更新）；
  抹灰新判据「无离散图形 + 层数/缝合/存在感 ∈[30%,95%]、单层 ≤0.5」。
- `run-all-verify` 全量 **29/29 exit=0**。版本戳 `20260928b`（行走机构带环批已盖 42 处，本批共用）。

## 一.33 本轮修复：坦克行走机构全重做 = 履带带环 + 独立侧裙板（2026-09-28A，待实机验收）

### 起因

> 现在裙甲是一整个侧面且让坦克轮穿模凸出来了……请完全重新设计履带和裙甲，让其贴合现实。
> —— 另外现在德国坦克的裙甲均有图中所示的问题，太高，高出来一块。（2026-09-28 第四报，附实机截图）

（同一部位的第三次实报：2026-09-27 的两次补丁都打在**实心履带盒**上 —— 第一次摆正花纹位相、
第二次把盒子的 ±X 面喷成装甲侧板并把轮子外移 6cm。症结是盒体本身：一个从地面砌到车体下缘的实心块，
侧面**只能**是一整块板，轮子要么被挡住、要么穿模凸出。）

### 落地（逐条证据见「finished-docs/archive/交付文档-行走机构带环-20260928A.md」）

- **① 履带 = 绕全部轮子的闭合带**（`15-vehicles.trackBandGeo`）：侧视轮廓 = 接地段直线 + 两端圆弧
  （绕主动轮/诱导轮）+ 回程段直线（+端轮抬起时的切线段）；内外两条轮廓**同构等长**（直线外移 `TB_TH`、
  圆半径 +`TB_TH`）⇒ 按索引配对连成 4 面带（外=花纹 / 内+两侧=金属）。三角形绕向在 builder 里按
  "几何法线 vs 期望外法线"**自动校正**；两侧共用一份几何。
- **② 端轮（主动轮/诱导轮）烘进同一几何**（省 4 个 Mesh —— 黑豹原本已顶到网格数上限 36，现反降到 33）；
  抬高档按剪影档 `TB_END_LIFT{sherman/pz4/t34/chiha/vickers}`（谢尔曼主动轮在前抬 · 四号/黑豹前后都抬 ·
  T-34 前置大诱导轮贴地而后置主动轮抬得最高），端轮顶面恒与回程段同高 ⇒ 回程段永远是水平直线。
- **③ 负重轮回到带环之内**（不再穿模）：轮心 = 履带中心线、轮宽 `trkW−0.02`（比带窄 2cm）⇒ 轮面比带外沿
  **内收 1cm**；轮底 = 带环内底面（`TB_GAP=0.08`），带环外底面 = **0.03**（与旧履带盒的地面间隙逐位一致）；
  回程段内面比轮顶高 `TB_TOP_GAP=0.05`（悬挂 ±0.17m 上跳不顶穿）。
- **④ 花纹沿环向滚动**：花纹只在带环**外表面**，`v` 沿环向累加、`u` 跨带宽 ⇒ 花纹条横跨履带；**环长取整贴**
  （`tileLen = 环长/round(环长/1.5)` ⇒ 闭合处无缝、条距 ≈17~20cm）；**闭合段反卷**（第 0 站另存一份 v 加整圈的
  副本 —— 否则接地段那一段 UV 倒插值、花纹反向跑）；`update()` 滚动量式子不变、**符号改 `-=`**（v 沿材料流向
  递增），符号与 UV 方向由探针**闭环校验**。
- **⑤ 侧裙板 = 独立分片**（`tankBuildSkirt`，四号/黑豹各 4 片/侧，`00-config` 的 `skirt: 3/2 → 4/4`）：
  挂在翼板外侧、外沿 = `halfW`、内面离带环外沿 1.5cm、下缘停在轮心略上方（露下半个轮），分片**合并单网格**；
  有裙板的车翼板收窄到 `trkW+0.02` 让出位置 ⇒ **半宽/推力框口径 `halfW` 逐位不变（本批纯视觉、不动平衡）**。
  **追加修（第四报"太高，高出来一块"）**：首版上缘写到"车体顶面下 4cm"（四号 1.48m / 黑豹 1.58m，
  高过翼板顶面 0.99/1.03m 约半米）⇒ 实机上裙板从履带一直砌到车体顶。现改为 **上缘 = 翼板顶面**
  （`y1 = S.fendY + 0.04`，从翼板外沿往下挂）—— 真实 Schürzen 只遮上半截行走机构，车体侧面在翼板以上
  完整可见；探针新增"裙板上缘 = 翼板顶面"判据（旧写法必红）。
- **⑥ 翼板**从"旧履带盒顶 +5cm"下移到"带环顶面之上 5cm"（压着履带）；**⑦ 幽灵坦克**（`15c-specveh`）复用同一套
  带环几何（浅灰两段材质、不挂花纹），观战者看到的那辆车与真坦克同一口径。

### 回归基线

- 重写 `dev/verify-tread-20260927.js`：**279 ✓ / 0 ✗**（12 型全量：带环结构 / 花纹条横跨带宽 / 接地段
  dv/dz<0 / 条距 / **侧视可见度 = 带环侧面盖住轮面 ≤25%（实测 0~0.2%）** / 轮在带内不穿模 / 端轮嵌在端弧内 /
  裙板 4×2 分片与外沿 / 裙板上缘=翼板顶面 / 环长整数贴 / **滚动方向闭环** + **旧写法阴性对照**：
  侧面盖住轮面 100%、轮凸出侧板 +7cm）。
- `dev/verify-animfix-20260926.js` 的 A5/B7 锚点与判据随机制重做：**39 ✓ / 0 ✗**；`--neg` 时 5 条带环判据
  **全部翻红**（证明判据不是空转）。
- `dev/verify-vehmodels.js` 的 THREE 桩补 `BufferGeometry`（自建几何的包围盒/网格数不再失真）：**10 ✓ / 0 ✗**；
  网格数上限 36 下实测最大 **33**（黑豹；旧版 36）。自建几何一律**直接写 `geometry.groups`**（不走
  `addGroup/clearGroups`）⇒ 全库 30+ 个探针的 THREE 桩零改动。
- 全家桶 `node dev/run-all-verify.js`：本批三轮分别为 **28/28**（裙板追加修前）→ **29/34** → **27/31**（追加修后，
  均为本批探针全绿）。**唯一稳定红 = `verify-matseam` 的"plaster 墙脚返潮带渐变"一条 —— 不是本批的锅**：
  并行会话 2026-09-28 01:10 按"材质问题仍十分严重"的新实报把 plaster 贴图整个重做成纯 fBm 噪声
  （离散图形全删，含那条渐变），它自己批次的判据还没跟上；`verify-naval` 的两次红为已知偶发（复核轮 0/0/0 全过）。
  本批探针终态：`verify-tread` **279 ✓/0 ✗** · `verify-animfix` **39/0** · `verify-vehmodels` **10/0**。
  （中途曾有 13 条探针因自建几何调 `clearGroups` 而假红 —— 沙箱桩没有该方法 —— 改为直接写
  `geometry.groups` 后全库探针零改动复原。）
  版本戳 `20260927q → 20260928a → 20260928b`（index.html 42 处 + `__sfStyleVer`，两次均 Node `fs` 改）。
- 新增工具 `dev/render-model.js`（离线软件光栅器：把真 three 建的模型投影成 PNG 自查外观，含 `ghost`）——
  它的存在本身是本批的教训：数值判据全绿时，一个手写盒几何的"漏了一个 +X 面"只有看图才暴露。
- 实机验收要点（用户侧）：侧视图 = 一条细带环绕着一排清晰的轮（轮不穿出任何板）；四号/黑豹的主动轮/诱导轮
  明显抬高、履带在两端上坡、裙板 4 片带缝挂在翼板外侧、**上缘与翼板顶面齐平（第四报"太高"的修）**、
  只露下半截轮；开动时整条环朝后滚、与地面不打滑。

## 一.32 本轮修复：建筑材质 / 履带行走机构 / 观战结算判定（2026-09-27Q，三项全部落地待实机验收）

### 起因

> 部分建筑出现了严重的材质不一致问题，需要修复。
> 结算时"观战模式"的判断存在问题，会将选了一下观战模式再取消的情况判定为观战模式不予计量，and so on。
> 现在坦克的履带是水平方向布置和运转的，和现实情况的位相呈垂直，需要修复。
> —— 稍等一下，坦克的轮子侧面处仍有履带！可以是裙甲之类的，不能是履带。

### 落地（逐条证据见「finished-docs/archive/交付文档-材质与行走机构-20260927Q.md」）

- **① 观战结算判定收窄**（用户实报"选了一下又取消 ⇒ 判成观战局不予计量"）：`specUsed` 的**唯一盖章点**
  从兵种卡开关（点开即盖、永不回退）收进 `23-deploy.deployPlayer()` 的意图结算之后 ——
  语义变成"**本局在观战态下部署过**"；`22-hud` 不再盖章，确认框/游戏说明/中英词条同步改写
  （"只点开开关又取消的不算"）。结算判据仍为 `!spectator && !specUsed`（粘性保留 ⇒ 开观战刷完再关照旧不计）。
  **待用户裁定**：是否进一步改成"只看结算瞬间是否观战"的纯实时口径（那会让"开观战刷完关掉"也计入历史）。
- **② 履带行走机构重做**（`15-vehicles`）：花纹**逐面烘焙 UV**（`trackBoxPrep`）——只出现在履带环向的
  四个面（顶/底/前后断面），符号按"后置主动轮 + 前置诱导轮"取；纹理矩阵退出该链路（`repeat=1/rotation=0`），
  `update()` 的滚动一行未动。履带盒改**两段材质** `[履带贴图, M.tone]`：±X 侧面 = **装甲侧板（裙甲）**，
  索引重排成 2 段 groups（一个 mesh 仍只 2 段 draw call）；**负重轮横向外移 6cm**（`whSx = trkSx+0.06`）
  ⇒ 轮外沿比侧板凸 7cm、侧视图 = 侧板 + 一排凸出的轮。顺带修好一处埋着的缺陷：四号/黑豹的**侧裙板旧挂点
  埋在履带箱里**（6 件分片全白建），现挂到履带外沿 +3.5cm 与侧板同层。
- **③ 建筑材质一致性**（`02-scene` + `00-config` + `05a`）：砖/石/木/瓦的逐块色从"三通道各抖各的"
  （stone 实测色相跨度 13°~156° = 拼色马赛克）收敛为**只抖明度**（`shade(base,k,w)`，Canvas 兜底版与
  SVG 精修版两边同源）；贴图元素**平铺闭合**（`wrapOffs`：越界元素在对边补同形副本；砖改列色表 ⇒
  左右缘半砖同色）+ **接缝连续**（抹灰墙脚返潮带由硬边矩形改成两端归零的渐变）；`TEX.cloth` 补登
  `UV_DENSITY.cloth=1.6` 并在 `05a` 挂 `uvRef` ⇒ 帐篷帆布密度跨度 **17.1× → 1.00×**。

### 回归基线

- 新增 `dev/verify-tread-20260927.js`（**146 ✓ / 0 ✗**）：真 three + 真建模段量"逐面采样 v 的变化轴/符号"、
  侧面 dv/dz=0 与材质分段、轮子外凸、裙板挂点、条距、以及**旧写法阴性对照**。
- 新增 `dev/verify-matseam-20260927.js`（**42 ✓ / 0 ✗**）：录制画布读 Canvas 兜底版真实配色 + 解析 SVG
  精修版元素 ⇒ 色相极差 ≤20° 且明度极差 ≥8%、平铺闭合、接缝连续、帆布密度实测跨度、两条阴性对照。
- 既有判据随机制/文案更新：`verify-animfix-20260926` 第 15 条（源码防回退 + 阴性对照锚点）**37/0**、
  `verify-specbatch` 观战文案 EN 词条清单 **79/0**、`verify-vehmodels` **10/0**（包围盒/halfW/网格数）、
  `verify-svgtex` 全过（40 个生成器）、`verify-text` 全过。
- 全家桶 `node dev/run-all-verify.js`：**28/28 次运行 exit=0 · 全部通过 ✔**（含新登记的第 27、28 条）。
  版本戳 `20260927p → 20260927q`（index.html 42 处 + `__sfStyleVer`）。
- 实机验收要点（用户侧）：坦克侧视图应是"侧板 + 一排凸轮"、尾部断面横档沿车高往上滚；石墙/木墙不再拼色、
  抹灰墙不再每 1.8m 一道横线、帐篷织纹粗细一致；兵种卡上点开观战开关再取消后打完的局照常进历史记录。

## 一.31 本轮修复：观战时停修复批（2026-09-27M，P0-1/P0-2/P1-3/P1-4/P1-5/P2-6 全部落地；P2-7 留长期）

### 起因

> 开工修复。   ← 用户原话（承接 §一.30 的时停问题清单）

### 落地（逐条证据见「finished-docs/archive/交付文档-时停修复批-20260927M.md」）

- **帧长单源**（`22b-speclayer` 新增 `specTimeShotDt(owner,rdt,dt)`）：非时停一律返回世界帧长（**零行为漂移**）；
  时停时只有 `owner.isPlayer` 的投射物走真实帧长 —— 判据与 `fireBullet` 的"非玩家吃难度分档"同一个字段，
  不另立一套"谁算玩家"；调用方没给真实帧长（部分沙箱/直调探针）退化为世界帧长（冻结），不返回 undefined。
- **六个弹丸系统接线**（`24-main` 把 `rdt` 传下去；各系统**逐发/逐条**解析）：炮弹 `updateShells`（15-vehicles）·
  高炮弹 `updateFlak`（16-aircraft）· 手雷/迫击炮弹 `updateNades`（13-combat，按 `thrower`）·
  巡飞弹 `updateLoiters`（13-combat，按 `owner`）· 曳光 `updateTracers`（08-effects，`spawnTracer` 新增第 4 参
  持有人 = 射手，`fireBullet` 唯一调用点带上 `shooter`）· 弹壳 `updateCasings`（整条链归玩家 —— 三处调用点
  全是玩家视角武器）。**粒子仍走世界帧长**（冻结点上炸开的火焰/尘土就该定格；池 280 上限有界）。
- **P0-1 冻结点不再判定**：冻结帧整发跳过（不动/不过期/不跑命中判定）⇒ 静止炮弹不再把 0.4m 外的活人
  "隔空引爆"（旧版 `hitD=step+0.5` 的前瞻每帧重跑，实测 404 血）。阴性对照：解除时停后同一发炮弹立刻照旧命中。
- **P0-2/P1-3 观察者的弹丸并入观察者链**：寿命/回收判据不再被 0 帧长卡死（曳光按 `traveled>=max` 回池、
  炮弹按 `life` 过期）⇒ 幽灵坦克无 CD 连射不再线性堆对象（旧版 120 次开火 → 120 个新 Mesh、60 发炮弹常驻）。
- **P1-3 巡飞弹制导不再被冻住**：操控中"你本人就是弹体"，帧长归本体链；`19-input` 的观战工具键**不再对制导让位**
  （旧版让位 ⇒ 时停中发射就成了"弹不动 + 不能解冻"的死局）。
- **P1-4 生命周期**：`returnToMenu` 与 `endMatch` 各补一次 `specTimeReset()` ⇒ 时停挂到主菜单的残留消失，
  「继续游戏」回来世界真的在走（换局路径原有复位不变，三处同源）。
- **P1-5 海战音频**：`updatePlayer(dt,wdt)` 收世界帧长并交给 `navalAudioTick(dt,ownDt)`，内部**逐艇**用
  `specTimeRideDt` 解析帧长 ⇒ 冻结的非座驾艇这一帧完全跳过（周期声 + 音色塑形一并停），
  只有观察者正在开的那条艇照常出声；`dt=0` 不再被 `if(!(dt>0)) dt=1/60` 的旧兜底换掉（那正是"照响"的第二来源）。
- **P2-6 常驻时停读数**：顶部栏观战信息行前挂「⏸ 时停中 (K 继续)」胶囊，读数与主循环消费同一个谓词
  （`specTimeFrozen`），10Hz 随顶部栏刷新；`specTimeStatus` 不再是死代码式的摆设（口径进 HUD，不新增 DOM）。
- **明确不改的口径**（不是漏洞）：① 时停中观察者**照常开火并造成伤害** —— 用户既有裁定"幽灵坦克可对双方开火"
  +"不冻观察者"；② 粒子不并入观察者链（定格是想要的观感，且有界）；③ 世界炮弹停在半空（冻结的战场就该静）。

### 留待裁定 / 遗留

- **P2-7（结构性，长期项）**：以主循环"显式 frozen 分支"取代"dt=0 注入"，可一次性消掉"每个系统都得自己 dt=0
  安全"的负担；本批按裁定不动 —— 现方案已把清单上的行为缺陷清零，范式重构留待更大批次。

### 回归基线

- 新增 `dev/verify-timestopfix.js`（**35 断言 0 失败**，连跑 3 次全绿；已登记 run-all-verify）：
  单源三分支 / 冻结帧零伤害 + 解冻即命中 / 五个弹丸系统"玩家的走完生命周期 + AI 的逐位冻住" /
  巡飞弹照飞 + KeyK 制导中放行 / 海战音频逐艇取帧长 / 回菜单·结算复位 / 顶部栏读数 / 静态接线 12 条。
- `dev/_timestop-audit.js`（取证工具，按自己的规矩**改判为修复后期望值**）**14/0**，修复前实测数值留在 note 里作对照。
- 专项：`verify-specbatch` **79/0**（新增 `updatePlayer(pdt,dt)` 接线断言）· `verify-spec` 57/0 ·
  `verify-specthird` 58/0（第三人称准星契约未受影响）· `verify-text` 全过（戳 `20260927o → 20260927p` 41 处 + `__sfStyleVer`，
  index.html 静态文案 98 条闭环含新增的 `#specTimeInd`）。
- 全家桶 `node dev/run-all-verify.js`：**26/26 次运行 exit=0 · 全部通过 ✔**（含本批新登记的第 26 条
  `verify-timestopfix`，桶内 35/0）；12 个改动 js + index.html + css 逐文件 `node --check` 全过。
  逐条读数记在「finished-docs/archive/交付文档-时停修复批-20260927M.md」§3。

## 一.30 本轮：观战时停子系统审计（清单待裁定）+ 瞄准吸附特性（2026-09-27，吸附已实现待实机验收）

### 起因

> 自行深度思考和查找一下时间停止相关子系统设计方面有哪些大问题/BUG或者不合理之处，列出一个清单来。
> 另外我希望给瞄准模式（包括开镜和普通瞄准）和载具火力瞄准增加一个轻度的自动吸附。

### 落地（② 已实施；逐条证据见「finished-docs/archive/交付文档-时停审计与瞄准吸附-20260927.md」）

- **② 瞄准吸附单源**（`13-combat` 的 `AIM_PROFILES` / `aimAssistTier` / `aimAssistDir` + 只读视图 `AIM_ASSIST`）：
  **只掰"差一点打中"的那一枪** —— 逐目标算角半径 `rAng`，仅当弹道擦不到本体（`over=ang-rAng>0`）且
  擦出距离 ≤ 本档容差 `cone` 时，按 `(over+0.35·rAng)×k` 掰向本体 35% 深（两道夹：不越过目标中心、不超硬上限 `cap`）；
  **已经指着本体的不动** ⇒ 保住"起点→准星命中点"契约（`verify-specthird` T6 58/58 守住）。
  遮挡双检（世界射线 + 人体射线）⇒ 隔墙/穿过队友一律不吸。接线 11 处（步兵枪弹/火箭筒 · 坦克主炮与同轴 MG ·
  固定 MG/反坦克炮/防空炮/岸防炮/舰炮主炮与并列机炮 · 战机航炮），**AI 一枪不吃**（判据是调用点 + `shooter===player`）。
  档位 `SETTINGS.aim`（0 关 / 1 轻度默认 / 2 标准）在游戏设置内、落 `sf_aim`、**改档即时生效**；关档时零分配零漂移。
  新探针 `dev/verify-aimassist.js` **40 断言 0 失败（连跑 8 次全绿）**（含真链 `playerFireTick→playerShoot→fireBullet`
  捕获真出膛方向、真实伤害入口掉血、隔墙/队友挡道/大偏三条阴性、坦克主炮 1.8° 真失误掰进车体、航炮与固定机枪座
  真链、AI 阴性对照、接线点赋值目标扫描）。

### 待裁定（时停审计，共 7 条 + 1 条已核对阴性；本轮**未改**时停 js，见交付文档 §1）

> **2026-09-27M 已全部处置**：P0-1 / P0-2 / P1-3 / P1-4 / P1-5 / P2-6 六条由「一.31 时停修复批」落地
> （帧长单源 + 六个弹丸系统接线 + 生命周期复位 + 海战音频逐艇 + 常驻读数），**P2-7 结构性项留长期**。
> 本节以下条目保留为**问题清单的原始记录**（当时的实测数值与措辞不下修）。

- **P0-1** 冻结点附近伤害照常结算：`updateShells` 的 `hitD=step+0.5` 每帧重跑（实测静止炮弹 3 帧把 0.4m 外
  靶兵打掉 404 血）；步兵 hitscan 一枪一条命 ⇒ 时停 = 单方面屠杀窗口（幽灵坦克主炮 CD 恒 0 最坏）。
- **P0-2** dt=0 下寿命类对象永不回收：`spawnTracer` 池永不回填（120 次开火 → 120 个新 Mesh）、
  `shells.life-=dt` 常驻（60 发 + 120 颗拖尾粒子）⇒ 观战者按住扳机即线性增长。
- **P1-3** 观察者例外漏了"你打出的弹"与"你正在制导的巡飞弹"（`updateLoiters(dt)` 冻住了观察者本体）。
- **P1-4** 时停状态跨"回主菜单→继续"残留（`SPEC_TIME.paused` 不随 menuHold/returnToMenu 复位）。
- **P1-5** 海战音频是唯一按真实帧长推进的声源（`updatePlayer(pdt)` → `navalAudioTick(dt)`）。
- **P2-6** 无 HUD 常驻时停指示（`specTimeStatus` 是死代码）。
- **P2-7** 结构性建议：以"显式 frozen 分支"取代"dt=0 注入"，可一次性消掉 P0-1/P0-2/P1-3 的机制侧原因。
- **已核对为阴性**：定点发射器在 dt=0 下**不会**每帧一发（节拍器被冻在正值，90 帧各最多多喷一帧的量）。

### 回归基线

**全家桶 `node dev/run-all-verify.js` 27/28 次运行 exit=0**（新登记的 `verify-aimassist` 首跑即 40/0）——
唯一未通过的是 **`verify-naval` 红色 7「艇进近礁盘 + 两栖车上岸开火」**：桶内连跑 3 次结果 0/0/0，
判定为**既有偶发**（连跑两次数值都不同；本批只动玩家侧链路，AI 不经 `updatePlayerNaval`/`updatePlayer*`）。
专项：`dev/verify-aimassist.js`（新）40/0 连跑 8 次全绿 · `dev/verify-specthird.js` 58/0（准星契约）·
`verify-specbatch` 79/0 · `verify-wipe` 81/0 · `verify-fire` 全过 · `verify-tankai` 全过 · `verify-zfight` 45/45 ·
`verify-text`（戳 `20260927a → 20260927o` 42 处 + `__sfStyleVer` 同步）· `verify-records` 11 组 ·
`verify-returntomenu` 13 组 · `verify-menucam` 4 组 · `verify-menucards` 32/0 · 各改动文件 `node --check` 全过 ·
`dev/_timestop-audit.js`（新，取证工具，不登记 run-all-verify）12/12 = 四条现状复现。

## 一.29 本轮修复：破坏机制批（2026-09-27N，A/B 类全部开工 + C4 顺带；C 类 C1~C3 按裁定不动）

### 起因

> 上一批《finished-docs/archive/交付文档-共面闪烁渲染管线重写与破坏子系统审计-20260927.md》§2 的 19 条破坏清单 + 用户裁定：
> 「开工修复、完善。**C类C1~C3不动**。」

### 落地（详见 `finished-docs/archive/交付文档-破坏机制批-20260927N.md`）

- **A1 命中判据**：组心平面距 → **到最近成员碰撞盒的三维距离**（盒内 0）+ 一层楼高的竖直门限（`vGate 3.4`）；
  新增 `boxDist3` / `structBounds`（包围盒廉价早退，永远保守）。成员盒正中落点空放 **9.3%/10.2% → 0**；
  爆点 ±60m 改 y 由 45/45 → **0/0**；长墙最远端 26.57 → **45**。
- **A2 撞塌**：`|vel|>1.9 即整组销毁` → **按动量扣血**（`k·v²`）+ 正撞门限（`face 0.35`）+ 冷却（0.32s），
  不满足条件时退回原有弹性推挤。2.2 m/s 从"拆整组"降为 **10.65 伤害**；侧擦 8 m/s **0 伤害**。
- **A3 掩体/油桶**：爆炸新增近场扫掠 —— 可碾掩体（沙袋/石墙/木箱/树篱/倒木）命中即摘；
  油桶挂 `mesh/explosive`，可**引爆 + 连锁（≤3 层）+ 溅射 + 引燃**（旧版永远炸不掉、碾不掉）。
- **A4 坍塌碾压**：落体覆盖矩形（组成员盒并集 / 屋盖承重带并集）内步兵吃 `70+9×落体高`（钳 200）、
  载具 ×0.55，attacker 透传 ⇒ "站在楼里看着天花板塌下来不会死"这件事关掉了。
- **B1 血量归一**：构建期末尾单点后处理 `hp = 名义 × clamp(0.6+0.4√(n/6), 0.75, 2.6)`，`hp0=hpFull` 建图期定死；
  `noScale` 例外 = 破袭补给库（720）与反舰炮位胸墙（`BATTERY_HP`，运行期会被复位链写回）。
  每盒分摊极差 **88× → 11.1×（berlin）/ 6.4×（island）**。
- **B2 屋盖承伤**：`roofRefFinalize` 给坡顶碰撞带/平顶板/山墙挂 `ref.hp`（按投影面积），
  爆炸每个 ref 只记一次伤害 ⇒ **直接轰屋顶终于有效果**（旧版零效果）；世界还原回 `ref.dmg`。
- **B3 受损中间态**：按剩余血量两档换**池化克隆**材质（暗 0.86 / 0.72，写 `dmgTier` 痕迹），
  还原 / 破袭复位时回退原材质（绝不就地改共享材质）。
- **B4 撞塌计分**：撞塌改走 `damageStructureBy` = 与炮弹同一套账（attacker 透传车长/车组），
  实测"车组 +20、玩家账 0"。
- **B5 永久件材质档**：`markPermPieces()` 普查"高 ≥1.6m 且高出地面 ≥1.5m、不在可毁组、不可碾、非植被非屋顶"
  的盒 → 轻微提亮（与受损变暗反向）。normandy **1130 件**与独立 census 一致、误伤 0。
- **B6 两图**：滇缅公路（burma）**根因是村落房 placeBuild 全数落空**（12m 环 + 高差 0.85 在丛林图必然失败）
  ⇒ 放宽到 20m/1.2 并给每个营地各建一座：**0 → 16 组可毁物**；断崖公路（canyon）无建筑属设计口径，
  由 A3 让 96 件掩体可炸。
- **C4 尘源/屏震**：随 A1 一起 —— 命中件透传，尘源/屏震/碎石堆按**被击中的那一块**算（长墙远端听得到震得到）。

### 待裁定 / 遗留

- **C1/C2/C3 按用户裁定未动**（碎块 96 FIFO / 弹坑 36 FIFO / 废墟不成为新掩体）。
- **B2 新增了"无顶楼"中间形态**（屋盖被打光但墙还在）—— 有意保留；若要"屋顶一没就整栋塌"，一处分支即可。
- 破坏的**遮挡测试**（炸点与结构之间有山/楼时减伤）仍未做（审计里成本最高那条），当前以竖直门限 + 最近盒替代。
- 两处**既有**验证器问题（按批次边界未修）：`dev/verify-rooffall.js` 缺 `waterSurfRegStrip` 注入；
  `dev/verify-naval.js` 红线7 `fired≥1` 是偶发断言（A/B 实测：改前树与改后树各 5 次都是 1/5 开火 ⇒ 约 20% 命中率）。
- **可调旋钮**（都在 00-config）见交付文档 §5。

### 回归基线（本批）

`dev/verify-destruct-20260927N.js` **49/0**（新增，已接入 `run-all-verify`）；`verify-structscore` **44/0**
（夹具按新判据更新：爆点取成员盒中心、调用点 9→10）；`run-all-verify` 全量 24 脚本 **24/24 exit=0 全部通过**
（注：其中 `verify-naval` 红线7 是**既有偶发** —— A/B 实测改前树/改后树各 5 次都只有 1/5 开火，
该脚本能否绿取决于运气；本批未改它）；`verify-surf` 22/22 · `verify-zfight` 45/45 不变。

## 一.28b 本轮再追补：船顶 + 贴地石带（2026-09-27M，已实现，待实机验收）

### 起因

> 船顶部和图一的场景一直存在图层打架的现象。（附两张实机截图：①塔拉瓦图，绿色草地上一道砖纹石带，
> 带缘有成片"砖色/草色"交错的条纹；②同图水面上一艘 PT 艇，木甲板上灰钢板与木纹互相穿插）

### 根因（四条，逐条有量化证据）

1. **舰艇从来没被消解过（一行错名）**：`resolveRuntimeSurfaces` 里写的是 `typeof NAVALS!=='undefined'`，
   而 15d 的数组名是 **`navalCraft`** —— `NAVALS` 全库不存在 ⇒ `typeof` 守卫恒为 false ⇒ 舰艇从不入队。
   代价（新工具 `dev/_zfight-naval.js` 实测）：**甲板段顶面与干舷段顶面完全共面 12.7m²**（两板同高，甲板比干舷宽
   0.8% ⇒ 面积几乎全叠），木纹与钢板贴图互相穿插 = 用户截图里船顶那条"花纹"。
2. **档距 2 单位 < 噪声底**：两块**独立三角化**的面即使数学共面，光栅化后的插值深度本身带 1~2 LSB 噪声；
   档距 2 只比噪声大 0~1 LSB ⇒ **相邻档之间仍在抢像素**（"消解器说已分开、实机还是闪"）。
3. **法线桶宽 < 配对窗口**：配对窗口是夹角 ≤1°（dn≥0.99985），而法线桶宽 0.6°（QN=96）⇒ 窗口内的对子可以落在
   **相隔 2 个桶**里，而配对只查 ±1 桶 ⇒ 整类漏检（全图残留里 berlin 2 / normandy 3 / steppe 2 / moscow 1 对
   都带"桶距(法线)2 · 夹角 0.7°~0.98°"）。
4. **"件 ↔ 地形"这一大类消解器结构性看不见**：地形是一整张 680m 网格 ⇒ 超 200m 上限，从来不是候选件。
   而**埋到顶的石墙/地基裙墙/薄铺装**的顶面与地形面处处同高（`dev/_atpos` 实测：椰林营区石件顶面 4.56 =
   地形 4.556），两片像素直接对抢 ⇒ 用户图一那条"砖色从草地里透出来"的条纹带（像素抽样：条纹带里 6~8% 是
   砖色、85% 是草色 —— 正是两片交错）。

### 落地

- **`NAVALS` → `navalCraft`**（`05-world.resolveRuntimeSurfaces`）：舰艇入队；`dev/_zfight-naval.js` 新增"运行期拾取"
  自检 —— 建一艘 PT 艇塞进 `navalCraft` 后跑队列，`SURF_RT.roots 2 → 27`、艇上材质落 0/4/8 三档（分开）。
- **档距 2 → 4**（`SURF_CONFLICT.step`）：4 LSB = 噪声上限的 2 倍 = 本库能给出的最小安全档距；单件最大向屏内推
  16 → 32 单位（覆盖层阶梯全负、与之正交，不会被越过）。
- **法线桶 QN 96 → 48**（桶宽 0.6° → 1.19° > 配对窗口 1°）：窗口内的对子必然落在 ±1 桶内 —— 邻桶搜索的
  充分性这才成立。代价：同桶件数变多，但平面 1cm 桶仍把不同面的件分开（实测建图期耗时见下表）。
- **贴地件从 1 档起步**（③b，新增判据 `flushOf`）：件的**朝上面**在面内 3×3 采样里有 ≥2 点与 `heightAt` 之差
  ≤4cm ⇒ 判"与地形共面"，该件档梯**从 1 档起**（0 档 = 与地形同深 = 抢像素）⇒ 那条交线带稳定归地形（背景赢），
  不再两边翻。同时**贴地件必须入着色表**（哪怕一个约束对都没有 —— 它的对手是地形，本来就不在约束图里，
  旧口径"只给有约束的件分档"会让孤立贴地件永远停在 0 档）。只认**朝上面**：立在地面上的件是底面贴地，
  背面剔除、与地形无颜色之争；若连底面也算，全图 1383 件入表、相邻件链式挤爆档梯（实测比不改更差）。
- **模型级补"预着色同档对"**（`resolveModelSurfaces`）：两侧都已被世界级预着色、且档位相同时，谁都不会管它
  （世界级的盒面模型看不见圆柱/合并几何，模型级又按纪律跳过预着色件）—— 让步给面小的一侧抬一档。
- **工具**：新增 `dev/_zfight-naval.js`（海战模型共面扫描 + 消解前后对比 + 运行期拾取自检）、
  `dev/_find-overlay.js`（贴地薄片普查）、`dev/_find-stone.js`（按材质色普查 stone 件）、
  `dev/_atpos.js`（某坐标附近的件与地形高差，用来认实机截图里的物件）；`dev/_zfight-why.js` 的残留对打印补上世界坐标。

### 实测（全 12 图，`dev/verify-surf.js` 22/22 · `dev/verify-surfmodel.js` 11/11 · `dev/verify-zfight.js` 45/45）

| 三角形级"会闪"对（跑空运行期队列） | 本批修前 | 修后 |
|---|---|---|
| 诺曼底 / 柏林 / 淞沪 / 百团 / 缅甸 / 森林线 / 峡谷 | 9 / 2 / 6 / 4 / 1 / 1 / 0 | **0 / 0 / 0 / 0 / 0 / 0 / 0** |
| 莫斯科 / 斯大林格勒 / 胡康 / 草原 / 塔拉瓦 | 8 / 3 / 10 / 4 / 1 | 5 / 1 / 9 / 3 / 1 |

残留（已归因，全部是**几何模型边界**）：圆锥/圆柱按盒近似（雪帽↔锥顶 1.21m²，莫斯科+斯大林格勒各 1 对）、
无参数合并几何（胡康 9 对 / 0.25m² 全属此类）、`超小件`（<0.15m）、反坦克炮 炮闩↔炮管 0.013m²（圆柱真面 vs 盒面）。

### 待实机验收

1. **船**（本轮主修）：看 PT 艇/九三式鱼雷艇/登陆艇的**甲板**（木纹不应再与灰钢板穿插）、干舷与甲板交界、炮塔座圈。
   对照：`?nosurf=1` 时船顶应重新出现成片花纹。
2. **图一那类"贴地石带"**：中障壁石墙、各建筑地基裙墙、椰林营区石件、岸炮位胸墙 —— 带缘的"砖色/草色"条纹
   应变成干净草色（地形赢），石件本体该露的照旧露。
3. 上一批的验收项（载具/斜置屋顶/远景桥面/手里的枪）在**档距翻倍**后应更干净；若某处出现"多退了一档"的
   错位（近处看板子被前面 1m 内的东西吃掉），报位置（这是档距翻倍的代价面）。
4. 控制台读数新增"贴地 N 件"：`[深度分层] 共面消解: … · 贴地 539 件 · 本档 {"1":637,…} …`。

## 一.28 本轮追补：共面闪烁追修（2026-09-27L，已实现，待实机验收）

### 起因

> 我看图层贴图打架的问题仍大量存在啊，请修复。

（§一.27 的"覆盖层阶梯 + 构建期消解"只覆盖了**轴对齐**世界件与建图期几何，用户实机仍能看到成片闪烁。）

### 根因（三条，逐条由独立三角形扫描 + 逐对归因工具定位）

1. **消解器的面模型错**：旧口径用"件的**世界 AABB 六个轴对齐面**"顶替真实面，且**整类排除 `rotation.x/z≠0` 的件**
   （并沿子树传染）⇒ "斜置屋顶板 / 瓦砾堆 / 斜墙"这类真面重合**压根不是候选**（柏林 160/166、诺曼底 75/132 对残留）。
2. **世界变换累乘漏了欧拉序**：消解器自己累乘世界变换（不读 `matrixWorld`，沙箱里没有），却只按默认 `XYZ` 算 ——
   实测 island 5383 件盒里 **2669 件是 `rotation.order='YXZ'`**（炮位/炮塔/斜置件），面平面整体偏（位置最大偏 2.1m）⇒
   消解器"看不见"真实共面。
3. **法线量化只查同桶**：共面的两件法线常差 0.1°~1°（各段各自算 ry），量化 1/96 后落进**相邻**桶 ⇒ 整类漏检。

附带两条小缺陷：hukawng 一堵墙接头处需要 7 个互斥档位（上限 6 ⇒ 贪心截断把两件压到同档）；反坦克炮"驻锄↔弹药箱"
的设计间隙正好 2cm，与容差边界重合 ⇒ 消解器与验证器两条实现在浮点末位上各判一侧。

### 落地

- **② 真实面模型**（`05-world.resolveCoplanarConflicts`）：候选放开 tilt，每个盒/柱出**六个真实面**（面心 + 单位法线 +
  面内矩形，含缩放），配对按法线夹角（同向 ≤1° 或反向）+ 平面距 + 矩形交叠；反向面用**支撑函数**算区间交叠量。
- **世界变换自累乘 + 欧拉序**：`_rot3` 读 `o.rotation.order`（六种序全实现，与 three 逐值比对 0 偏差）。
- **法线邻桶常查**：±1 桶 × 平面 ±3 桶，用 (Δ法线, Δ平面) 字典序去重；去掉"只在桶边界才查"的旧分支。
- **档位上限 6 → 8**、**容差加 1e-6 松弛**（`tolEps`，消解器取略宽的一侧 ⇒ 验证器认定的"严格共面对"必被消解）。
- **模型级消解器补"预着色纪律"**（`resolveModelSurfaces`）：单位子树同时在两套消解器辖区内（世界级管"单位件↔世界件"，
  模型级管"模型内件对"），模型级把 `units>0` 的件**读回当预着色节点**，只给未落档件分档 —— 否则复跑时"该退到 0 档
  的那件退不回去"（k=0 只是不改材质，不会撤掉 c1 变体），相邻两件会一起停在 c1。
- **视角武器纳入消解**（`resolveRuntimeSurfaces`）：`vmScene` 是独立场景 + 独立深度范围（`vmCamera` near=0.01 ⇒
  30cm 处 1 LSB≈0.5µm），世界级/单位级都扫不到它，而玩家**一直看着它**。实测每把枪有 2 对**真·同平面**贴合面
  （最大 34cm²：木托↔机匣），按"枪是贴脸看"给一支更小的交叠下限 `SURF_RT_VMMINAREA=0.0004`；以 `gunParts`
  身份变化触发重做（`VM.inner` 每次换枪重建）。实测残留 <1µm 同档对：每枪 2 对 → 全局仅剩 1 对 2.8cm²。
- **工具**：新增 `dev/_zfight-why.js`（逐对归因"为什么没被消解"，带桶距/夹角）、`dev/_xfcheck.js`（手工累乘 vs
  `matrixWorld` 逐对象比对）、`dev/_zfight-rootframe.js`（根相对 vs 世界坐标的平面距）；`_zfight-tri.js` 修两处**假阴性**
  （平面桶键带 mesh 号 ⇒ 只能同网格内配对；同一对从两侧各计一次）并补"跑空运行期消解队列"；`verify-surf` 的独立
  扫描器同步换成真实面模型 + 法线邻桶。

### 实测（全 12 图，`dev/verify-surf.js` 22/22 · `dev/verify-surfmodel.js` 11/11）

| 指标 | 修前（§一.27 口径） | 修后 |
|---|---|---|
| 三角形级"会闪"对（含单位模型，跑空运行期队列） | 诺曼底 134 / 柏林 166 / island 41（面积 12.7 / 12.3 / 1.7 m²） | 诺曼底 9 / **柏林 0** / island 1（0.4 / 0 / 0.1 m²） |
| 全图同单位残留（`verify-surf` 独立扫描） | 柏林 422 对 / 诺曼底 134 对 | **12 图全 0** |
| 视角武器（vmScene，独立深度范围）真·同平面对 | 每把枪 2 对（最大 34cm²） | 全局剩 1 对 2.8cm² |
| 世界级消解器规模 | 候选 2219~6354 · 约束对 1915~5406 | 候选 1716~10212 · 约束对 1627~7433 · 落档 0~3242 件 · 建图期 24~1189ms |

残留（已归因，均为**几何模型边界**而非"两块平板重合"）：圆锥/圆柱近似（雪帽↔锥顶 1.21m²）、无参数合并几何、
0.012~0.015m² 细缝（在 `minArea` 之下）、模型内 2~6cm 近共面（只在 >150m 远景争）。

### 待实机验收

1. 近看**载具/飞机/士兵/炮位**：车体接缝、炮盾与炮架、机翼与机身不应再有成片材质闪动。
   另：**手里的枪**（木托↔机匣贴合面，本轮首次纳入消解）不应再有小块闪动。
2. 看**斜置屋顶板、瓦砾堆、斜墙、沙袋墙接头**（本轮修复的主战场）与**门框/窗洞边缘**。
3. 远景桥面铺装、栈桥木板、弹坑焦土、水面边缘不应细碎闪。
4. `?nosurf=1` A/B：正常 URL 不闪而 `?nosurf=1` 闪的位置 = 消解器救回来的位置。
5. 控制台两行读数：`[深度分层] 共面消解: …`（建图期一次）与 `[深度分层] 模型共面消解: …`（单位模型逐个）。
6. 进图耗时：最重的莫斯科约 +1.2s、柏林约 +0.8s（一次性，非帧率）。

## 一.27 本轮：共面闪烁渲染管线重写 + 破坏子系统审计（2026-09-27J，渲染已实现待实机验收；审计清单待裁定）

### 起因

> 自行深度思考和查找一下破坏与可破坏物相关子系统设计方面有哪些大问题/BUG或者不合理之处，列出一个清单来。
> 另外存在系统性问题：现在当两个面重合的时候，图层会打架使得显示的材质一闪一闪的，你能重写一下这方面的渲染管线来解决这个问题吗？

### 落地（② 已实施；逐条证据见「finished-docs/archive/交付文档-共面闪烁渲染管线重写与破坏子系统审计-20260927.md」§1）

- **① 覆盖层阶梯 `SURF_LANES`**（`05-world` 深度块，全库 polygonOffset 仅此一张表）：`base 0/0` · `pavement −1/−4` ·
  `decal −1/−6` · `patchWater −2/−8` · `surf −3/−12`；最小档 4 LSB = 深度噪声地板（1~2 LSB）的 2~4 倍
  —— **旧表 −1/−2/−3 每档正好 1 LSB，正踩在地板上，这是"实机仍闪"的数值根因**。
- **② 构建期共面消解 `resolveCoplanarConflicts()`**（`24-main` 在 `capturePristineWorld()` 之前调一次）：
  扫"面重合 / 薄埋"件对（同轴 + 平面距 ≤2cm + 面内交叠 ≥0.04m²；反向面按**区间交叠量** ov∈(0,2cm) 判），
  按投影面积降序贪心着色，落败件换"向屏内 +2 units/档、≤6 档"的材质变体 ⇒ **胜负写死在构建期**，与相机无关。
  幂等（已落档件以预着色节点读回）· 绝不就地改共享材质（按 材质×档 池化克隆）· `?nosurf=1` 只关本条。
- **③ 同表 renderOrder**：不写深度的半透明覆盖层之间排序也由同一张表派生（`surfaceLane`）。
- **覆盖层登记补齐**：弹坑焦土/血渍 → `decal`；河道支流/结冰/鱼塘藕塘/海面/河冰 → `patchWater`；碎浪泡沫 → `surf`
  （旧版这些贴花**完全没登记**，是远景细碎闪的主因）。
- **实测规模**（`dev/verify-surf.js` 12 图）：候选件 25(canyon)~8710(moscow)、约束对 0~7206、落档 0~2822 件、
  耗时 1~1162ms（**只在建图期**）、材质变体 1~21、**同单位残留全 12 图 = 0**。

### 待裁定（① 只出清单，本轮未改 js/ 破坏代码；共 19 条，见交付文档 §2）

- **A 类（口径，P0/P1）**：A1 命中判据＝"组心平面距"（无 Y、无遮挡；手雷落在成员盒正中有 **9.3%**(柏林) /
  **10.2%**(莫斯科) 完全不掉血；爆点在组心上方 60m 与贴墙命中扣血逐位相同）· A2 一次爆炸横扫整栋（均 3.9~5.1 组、
  峰 14；坦克 1.9m/s 撞塌整组且**绕过 hp**）· A3 沙袋/石墙/木箱抗爆、油桶根本炸不掉（而灌木反被炸没；
  各图 297~902 个"只能碾、不会被炸"的掩体盒）· A4 坍塌不伤人、不留痕。
- **B 类（模型）**：B1 血量按组不按面积（hp/盒 极值 **2.6 vs 230**）· B2 屋顶/楼板无独立血量 · B3 无受损中间态 ·
  B4 撞塌/反坦克雷不计分 · B5"像墙却打不烂"占比（诺曼底 **18.2%**、柏林 8.6%）· B6 胡康/峡谷**整图 0 组可毁物**。
- **C 类（表现资源）**：C1 碎块 96 FIFO（一栋楼 44~91 块）· C2 弹坑 36 FIFO · C3 破坏只减掩体不创掩体 ·
  C4 尘源/音效以组心为准。
- **D 类（已核查为阴性，避免重复怀疑）**：killBox 兄弟扫描 274 万次/4ms 不是瓶颈 · 跨组共用网格 0 条 ·
  幻影命中 0 · 整组悬空 0（12 图）· 台账无运行期追加 + 碎块几何有 dispose。

### 回归基线

**全家桶 `node dev/run-all-verify.js` 23/23 exit=0 · 全部通过**（含 13 图布局 / 世界还原 / 火焰 / 观战 / 海战 /
寻路 / 出生点 / 破坏得分 / Bot 行为 / 飞机不撞山）。另跑名单外的两个专项：`dev/verify-surf.js` **22/22**、
`dev/verify-zfight.js` **45/45**。`dev/verify-rooffall.js` 报 `waterSurfRegStrip is not defined` —— **该验证器自带
03-terrain 副本漏注入 `waterSurfRegStrip`（另 4 个同源 harness 都注入了），与本批改动无关，属既有待修**；
新增只读探针 `dev/_destruct-audit.js` / `_destruct-immune.js` / `_destruct-ab.js`（12 图取证工具，不参与 index.html）。

## 一.26 本轮追补：观战批 I（3 条实报 + 1 条删减令，2026-09-27I，已实现，待实机验收）

### 起因

> 注意到当前做的很不彻底，观战模式仍能选几个海战相关载具、时停等对海战载具完全无影响、时停的时候玩家也不能动……时停之外的时间流速控制建议直接删了！

### 落地（4 项；逐条证据见「finished-docs/archive/交付文档-观战修复批-20260926H.md」§6）

- **I1 出生闸门扩到全类**：`23-deploy buildSpawnList` 的 `specBlocked` 由 `tank||plane` 改为 `!!player.spectator`（本表每一项都是真载具：tanks+planes+navalCraft）⇒ **舰艇/两栖车也置灰**并注明「观战不可征用」；
  `deployPlayer` 的结构闸门同步为"删掉一切 `V<n>` 选中项"（旧版只挡 tank/plane，正是用户实报的口子）。想开艇仍可走近按 **F** 现场上艇（干预权不变）。
- **I2 时停对海战生效**：`15d-naval updateNaval` 删掉 `if(!(dt>0)) dt=1/60;` 这道兜底 —— 它把时停的 0 换成满速帧长，
  **架空了 `NavalCraft.update` 自己的 `dt>0` 守卫**（用户实报"时停对海战载具完全无影响"）。现在 dt=0 就是不推进，与陆战 `t.update(0)` 同一口径。
- **I3 观察者例外（"时停的时候玩家也不能动"是缺陷）**：时停冻的是**战场**，不是观战者 —— `24-main` 新拆一支 `pdt=specTimePlayerDt(rdt,dt)`
  喂给本体链（`updatePlayer`/`updateCamera`/信息层/视角武器），座驾由 `vdt(v)=specTimeRideDt(v,rdt,dt)` **逐台**判（判据单源 = `13-combat specRide`，含幽灵坦克；`updateNaval(dt,pdt)` 第二实参同源）。
  非时停时 `pdt≡dt`、`vdt≡dt` ⇒ 普通战斗零行为漂移。副产：FPS 表改按**真实**帧时间统计（否则时停下显示 1000 FPS）。
- **I4 慢放/单步删除**（用户："时停之外的时间流速控制建议直接删了"）：`22b-speclayer` 的档位表 `SPEC_TIME_SCALES`（1/0.5/0.25/0.1）与"单步 1 帧"整段删除，
  `SPEC_TIME` 只剩 `{paused}`；`19-input` 只留 `J`/`K` 两键（`,`/`.`/`L` 摘除）；文案与 EN 词典同步换（旧 3 条词条删除）。

### 与一.25 的关系（口径变更，非回归）

- 一.25 的 **A2「舰艇保留」** 与 **B7「慢放/单步」** 两条口径被本轮**取代**（用户 2026-09-27 明令）：前者是 2026-09-22「部署界面上艇 = 唯一上艇路」的旧裁定，后者是"档位越加越复杂"的自纠。
- 其余 7 条修复（A1/A3/A4/B6/B8/C2/D1）与「按需召唤幽灵坦克」一字未动。

### 回归基线

`dev/verify-specbatch.js` **79 断言 0 失败**（新增 T7b 海战时停 / T7c 观察者例外；T2、T7 判据翻面）· `dev/_spec-audit.js` 判据再翻面 **8/0**
（改取塔拉瓦图 + 补海战脚本链，舰艇那一半不再空过）· `dev/verify-spec.js` **57/0**（T8 接线改判）·
`dev/verify-specthird.js` **58/0**（T7 接线改判）· 全家桶 `node dev/run-all-verify.js` **23/23 exit=0**（末次干净重跑）。


---

## 一.25 本轮修复：观战子系统修复批（9 项裁定 + 2 项新增，2026-09-26H，已实现，待实机验收）

### 起因

> C.14 是刻意为之，测试需求里包含对战局无上限的干预。
> 还有像是 B.5、B.13 等要么是刻意为之的，要么是太复杂不做的。
> 要修复的：1、2、3、4、10、11、12、15、17。
> 另外：观战模式操纵双方载具会被索敌和击毁，而且会带着观战模式的玩家一起死。
> 我希望开局的时候幽灵坦克不出现，只在按下 F 的时候按需出现。

### 编号口径（18 条清单的平铺序号，由用户原话自证）

A1..A4=1..4 · B1..B9=5..13 · C1..C3=14..16 · D1=17 · E1=18（“C.14 = 观战者是第三阵营”、
“B.13 = 入口唯一且隐蔽”两条各自落在 C/B 段的平铺第 14/13 项）。
⇒ 本轮修复 = **A1·A2·A3·A4·B6·B7·B8·C2·D1**（观战挡弹/出生闸门/开关生效点/座驾保护/信息层/时间控制/游泳/不指挥小队/文案 i18n）。

### 实现要点（逐条 file:行证据见「finished-docs/archive/交付文档-观战修复批-20260926H.md」）

- **A1**：`13-combat raySoldiers` 候选过滤补 `s.spectator` —— 一处生效即覆盖全部弹道调用方。
- **A2**：`23-deploy buildSpawnList` 对观战者把 tank/plane 置灰 + 注明「观战不可征用」（舰艇保留 = 2026-09-22 裁定② 的唯一上艇路）。★**已由一.26/I1 取代**（舰艇/两栖车一并置灰）。
- **A3**：战斗中开观战 = `confirm()` 二次确认 + `player.specWant` 待生效，`23-deploy deployPlayer` 开头结算；**关闭立即生效**。
- **A4 + 实报①**：新判据单源 `13-combat specRide(v)`（观战者座驾 = 本体延伸）——
  **5 处不被索敌**（enemyTankNear / tankPerceive ×2 / planeAI / navalNear / 岸炮 pickTarget）+
  **3 处不被击毁**（Tank/Plane/NavalCraft.takeDmg）+ **不共死兜底**（`20-player specRideEject`：
  车毁即安全脱离，0 死/0 票/0 杀，2 个轻量乘员名额也不结算）。
- **B6/B7**：新文件 `js/22b-speclayer.js`（`SpecLayer` 名牌+指向线；`SPEC_TIME` 倍率表）
  + `24-main` 主循环：`dt=specTimeConsume(rdt)` 且未消费的时间计进 `nowOff`（世界与 `nowT` 同速）；
  健位 `J` 信息层 / `K` 暂停 / `,` `.` 慢放 / `L` 单步（仅观战态生效，关掉即回 ×1）。
- **B8**：`20-player` 的 `swimming` 判定摎掉 `!p.spectator`。
- **C2**：`19-input` —— 观战态 T 只保留弃弹传送，非控弹的进攻标记与 Y 改为提示「观战模式 · 不指挥小队」。
- **D1**：`00b-i18n` 补 16 条 EN 词条（含 2026-09-26G 审计 D1 漏网的 9 条）；`index.html` 观战帮助段整段改写。
- **新增②**：胡灵坦克彻底改为按需召唤 —— `23-deploy` 删出生项 `G` 与预置，
  唯一入口 = `20-player tryInteract ③ → specVehSummon()`；再部署改走 `specVehStow()`（场上不留车）。

### 本轮不做（裁定保留现状）

B1 自由相机 · B2 跟随锁定 · B3 切人 · B4 killcam · B5 观战式 HUD · B9 入口隐蔽（彩蛋）·
C1 第三阵营（**刻意为之**: 测试需求包含对战局无上限的干预）· C3 口径不一致· E1 设计如此。

### 回归基线

`dev/verify-specbatch.js`（新）**61 断言 0 失败** · `dev/_spec-audit.js` 判据翻面 **8/0** ·
`dev/verify-spec.js` 改判 **57/0** · `dev/verify-fixbatch-20260926.js` **55/0** · `dev/verify-a21-a4.js` **20/20** ·
全家桶 `node dev/run-all-verify.js` **24/24 exit=0** · 版本号 `?v=20260926f → ?v=20260926g`（40 处 + `__sfStyleVer`）。

## 一.24 本轮特性：地图可破坏物得分（已实现，待实机验收）+ 观战子系统设计审计清单（未修复，等裁定）（2026-09-26G）

### 起因（用户 2026-09-26 两项指令）

> 自行深度思考和查找一下观战模式相关子系统设计方面有哪些大问题/BUG或者不合理之处，哪里"不够'观战'"，列出一个清单来。
> 另外增加一个破坏地图内可破坏物加分的机制。

### 已实现：破坏地图可破坏物得分

- **单源**：`00-config STRUCT_SCORE`（light 20 / big 60 / bigHp 520 / cap 120，血量分档 + `g.score` 可逐组覆盖）
  + 结算战绩新项 `REC_STATS.demol`（「摧毁数」，结算卡/历史记录/数据面板自动跟着变）。
- **归属**：`damageStructures(p,radius,amt,attacker)` 新增第 4 参；全库 9 个调用点逐一带 owner/thrower
  （唯一例外 = 反坦克雷无主，雷本身没有 owner 字段）；`destroyStructure(g,silent,attacker)` 沿链式坍塌透传。
- **四条边界**：①有主才有分（无主爆炸/预塌 silent 不计）②每组只结算一次（`g.dead` 门）③拆墙不进连杀
  （不走 `registerKillScore`，不喂 3/6/9 档、不吃倍率 —— 否则"开坦克轰村子"就是刷分捷径）④一批爆炸的
  多组摧毁**合并成一条角标**（"摧毁结构 ×6 +120"，不是 6 条 +20）。
- **判据链**：`dev/verify-structscore.js`（新）**43 断言 0 失败**；`dev/verify-records.js` 11 组全绿
  （两处硬编码的"六项战绩"改成按 `REC_STATS.length` 取，避免以后再漂）；**全家桶 21/21 exit=0**；
  版本戳 `?v=20260926e → ?v=20260926f`（40 处 `?v=` + `index.html:17` 的 `window.__sfStyleVer` 同步）。
- **过程记录（两次首跑红, 均非本批代码缺陷, 已查明并留证）**：① `verify-fixbatch` 的"飞行员收回硬上限"判据被 **CRLF 行尾**
  搞红（探针的注释剔除正则在 CRLF 行上不生效 ⇒ 注释里的历史写法被当成回退）——已把工作树里被 CRLF 化的文件统一回 LF,
  该套件 55/0 ✅; ② `verify-spec` T3 的 `bloodMat.clone is not a function` 是该探针**材质桩缺 `clone()`**（血贴片走每贴片克隆,
  仅推演中真出现血贴片时命中, 实测 1/8）——已给桩补 `clone()`（只补桩能力、不动断言）, 8 连跑 8 绿 ✅。

### 观战子系统审计清单（18 条，**未修复** —— 等裁定后另批开工；逐条证据见「finished-docs/archive/交付文档-破坏得分与观战审计-20260926G.md」§2）

- **BUG / 结构性缺陷（4）**：① 观战者身体是"**幽灵掩体**"（子弹/炮弹在他身上就停，自己不掉血）·
  ② 观战者能从部署界面直接坐进**真坦克/战机**（拿走 AI 载具，与"常规载具一概不用"的明写口径冲突）·
  ③ 观战开关**战斗中可达**（Esc 丢指针锁 → 部署界面 → 兵种卡二次点击，即时免伤+无限弹）·
  ④ 观战者开真载具时车毁链劈叉（驾驶员免伤不死，车组 2 个名额照结算掉票）。
- **"不够观战"（9）**：没有脱离肉体的**自由相机**（仍会被墙挡、升限 135m）· 没有**跟随/锁定目标**
  与环绕推拉 · 没有切人/观战列表 · 没有死亡回放(killcam) · HUD 不是观战式的（自己的弹药/血条照显）·
  世界内看不到 Bot 名字/队属/目标/血量 · 无时间控制（暂停/慢放）· 观战者进水不游泳（沉底 + 水下滤镜）·
  入口唯一且隐蔽（必须实验模式 + 双击巡飞弹兵卡）。
- **战局污染（3）**：观战者火力真实扣票/记杀/推动清场（能单方面把两边票打空）· 观战者能用 T/Y 指挥
  本方 Bot 小队 · 他既不被 AI 看见/打到，又不计入占旗与清场 —— 看到的战场与结算口径不一致。
- **i18n 遗漏（1 条 / 9 处）**：悬停·气动·飞行关闭·幽灵坦克就位·落地·开关观战等运行时文案不在 EN 词典
  （`t()` 无命中回退中文 ⇒ EN 界面闪中文）。
- **建议优先级**：先 A1（一行：`raySoldiers` 排除 spectator）+ B1/B2（自由相机 + 跟随锁定 = 观战的核心价值），
  再 A2/A3 + C1/C2（把观战钉死成"不影响战局"），最后 D1（文案）。

## 一.23 本轮修复：水域/水战子系统审计批（41 条全部开工，2026-09-26F，已实现，待实机验收）

### 起因
用户 2026-09-26「全部开工修复。」—— 承接上一批交付的 **41 条水域/水战审计清单**（P0 4 / P1 12 / P2 25）。

### 落地（41/41；逐条细节、数字与复现命令见「finished-docs/archive/交付文档-水域水战审计修复-20260926F.md」）
- ✅ **P0**：① **舰艇车组复配**（`navalCrewFill` 可重入单源 + `15d._respawnTick` + `14-bots.pickIdleNaval` 三条补人路径，与坦克同规）
  ② **艇上玩家座位装甲豁免**（`seatShielded(s)` 单源替换 5 处只认 `onVehicle` 的清单）
  ③ **淞沪水网网格/判定同源**（水面查询改"条带段 + 沿段插值"：覆盖 928 点无洞、索引等价 10404 点全同）
  ④ **Bot 过桥不再落水**（`moveDir` 改读水态单源 `waterStateAt`：两桥 y 下坠 0.00m，旧口径 −9.01/−2.71）
- ✅ **P1**：岸炮占用跨局清账 · 艇↔艇/艇↔坦克分离（`navalPushCraft`：三圆最深穿透 + 中心连线方向 + 0.5m 限幅）·
  艇上 1/2 换枪 / 右键 ADS / U 键 / 阵亡座位 / 观战空格 五处座位门 · `batteryAimSolve` 单源（15f 死 AI 委托活路径）·
  窗口取最大 → 沿段插值（同源最大偏差 6.14m → 0.39m）· `shoreDirAt` 哨兵（河道自救方向恢复）·
  浅河物理水深上限 1.15（滇缅游泳档 40% → 0）· 游泳态不吃激流 ×0.38（泳速 2.0 > 冲移 1.5，落水可自救）·
  世界边缘单源（`WORLD_MESH_HALF` / `WORLD_ACTOR_LIMIT`）· 涉水/入水音效 + 水里不走干地脚步
- ✅ **P2**：吃水 / 落位高度 / 重生错位 / 浮姿（`FLOAT_PAD`）/ 湿沙档（`WET_SPD`）/ 旗点容差（`FLAG_DY_TOL`）/ 道具水体门 /
  冻结分支衰减 / `seaClock`（菜单海面动画）/ 波场入玩家浮力 / 雨盒水面裁剪 / 血贴片水面 / 水下雾基准重采 / 鱼雷在途音效 /
  鱼雷返回值 / 装填读数 / 两栖车深水 F / 提示次序 · **红线 6 端到端补上**（炮位击沉载具：1 发 hp 620→237 flood 0.5；
  艇炮摧毁炮位：1 发胸墙 520→284）

### 判据链（全部绿）
- `dev/_watercov-selfcheck.js`（新）**23/23** · `dev/_waternav-audit-verify.js`（新）**24/24** · `dev/_bridgebot-verify.js`（新）两图各 7 条
- `dev/_riverprof-probe.js`（新，结构量）· `dev/verify-naval.js`（红线 6 补 E2E 后 **9 通过 / 0 失败 / 2 跳过**）· `dev/probe-spawn.js` 桩保真度补齐

### 复审（用户口径"确保不会越修越坏"）
查出的 3 条稳定失败**都不是游戏代码缺陷，而是本批有意改语义后既有判据/调用约定按旧语义读**；收口一律**改设计**：
① `navalCrewFill` 挂在 `respawn()` 本体 ⇒ 探针的受控载具拿到 AI 驾驶（红线 3/4 假红）⇒ 改挂 `_respawnTick`（对局重生路径）；
② `navalPushCraft` 会推搁浅的艇 ⇒ "硬搁浅位移<1m"被推成 11m ⇒ 搁浅方不被推、且当不可动障碍；
③ 浅水余量改单源后小 0.1m ⇒ 艇 AI 进近行为变（红线 7）⇒ 显式化 `NAV_AI.depthMargin=0.1`（逐值等于旧字面量）。
全量回归 `dev/run-all-verify.js` **22/24**：唯一未通过的是 `verify-naval`，且为**偶发**（红线 7 ③"两栖车上岸并开火≥1"；套件稳定性段 0/0/1，另跑 3 次 9/0/2、8/1/2、9/0/2）。根因=试验艇被布在集结点（与编制艇三圆重叠）+ 本批新增的艇↔艇分离把它顶开 ⇒ 起点漂移 ⇒ 有时射程内无目标；底层的"种子下世界构建不可复现"（`mgSpot` 用 `Math.random`）是本仓既有属性。**一次失败的"改判据"尝试已如实记录并还原**（探针 spawn 让位 34m ⇒ 红线 3/4 稳定失败，不做掩盖式修改）。游戏内不受影响（编制落位 22m 间距，分离开局不触发）。

### 刻意不做
撞击伤害/动量交换（改平衡，用户未要求；本条要的是"不穿模 + 顶住感"）· 海面网格波动（静态几何；改法是"人与船同波"）。

---

## 一.22 本轮：枯树/椰树倒伏（已实现，待实机验收）+ 水域/水战子系统审计清单（未修复，等裁定）（2026-09-26E）

### 起因

> 用户 2026-09-26 两件事：「自行深度思考和查找一下**水域和水战相关子系统设计方面**有哪些大问题/BUG或者不合理之处，列出一个清单来。」
> +「另外**枯树和椰子树没有普通树那样被炸到后立马向爆炸[反]方向倒下**的机制，请添加。」

### 落地：② 枯树/椰树倒伏（逐条细节见 `finished-docs/archive/交付文档-枯树椰树倒伏与水域水战审计-20260926E.md`）

- ✅ **口径**：`explosionFlora` 把 `dead`(枯树)/`palm`(椰树) 从"炸没"并入乔木的**倒伏**口径 —— 近距（`0.75R+0.9`）立即向**背离爆心**方向翻倒，
  中距（`R+2.6`）累积伤害、第二次爆炸才倒；倒向/时长/触地扬尘/残骸停留 16~22s 后 3.6s 沉入**与乔木同源**。
- ✅ **实现**（`04b-fire`）：新增 `floraTopple`（对象式植被入口）+ `floraObjMatrices`（绕根部水平轴的 Rodrigues 旋转，
  姿态写各网格 `position/quaternion`，四元数 `R⊗q0` 按分量手算 —— 沙箱桩无 `clone/copy/set`）+ `scheduleFloraObjSink`（走 08-effects 的 `queueSink`）。
- ✅ **顺带必须修**（`23b-worldrestore`）：植被快照原**只存网格 y** ⇒ 倒伏会写 x/z 与姿态，不补的话**下一局椰树/枯树歪在原地**。
  现按件存 7 个数（position xyz + quaternion），还原时逐元素写回。
- ✅ **防重复沉入三处补门**：已倒伏株不再响应后续爆炸 / 不再被坦克"碾碎"二次登记 / 不再被火焰烧尽顺手炸没（同一批网格挂两个沉入任务会 y 基线互踩）。
- **刻意不改**（如实记录）：坦克碾压与火焰烧尽仍是"一碰即碎/原地消失"（用户本次只点"被炸到"；两条都是既有明写口径）。

### 验收（三条独立判据链）

- `dev/verify-fire.js` 新增 4b 节 **12 条断言**（近距立即倒 / 不是炸没 / 碰撞体即杀 / **倒向点积** / 收敛 / 已登记沉入 / 变换被改写 /
  **阴性对照**"再炸不重登记" / **阳性对照**"灌木仍走炸没"）：normandy/burma/berlin/moscow（枯树 dot 1.12~1.20）、island（椰树 dot 1.15）全绿。
- `dev/_fallgeo-check.js`（**新建**，真 three r152 几何取证）：椰冠落点水平位移 7.99m ≈ 株高·sin1.5、落地高 0.48m、干轴·竖直 0.06、
  枯树两件间距全程不变（刚体翻转）、根锚点未平移；**阴性对照**（倒向取反）判据报红 cos=−0.994。
- `dev/verify-worldrestore.js` 新增 `toppleDev` 指标：倒伏后偏差 **-1 → 2.4629**（敏感度）、还原后 **0**（逐元素回位）；
  顺带补齐该探针 `Obj3.quaternion` 桩缺失的 x/y/z/w 分量（桩保真度，不是被测代码缺陷）。

### 待实机验收（请按现象看，详见交付文档 §6）

1. 椰树（塔拉瓦）与枯树（柏林/莫斯科/诺曼底/滇缅）：**手雷/火箭筒/坦克炮/航弹在旁边炸 ⇒ 树立刻朝远离爆点的一侧翻倒**（1~2s 倒完、带扬尘），
   不再是"原地冒土消失"；倒下的树躺十几秒后沉入地下。
2. 坦克**直接开过去**仍是"一碰即碎"（没改）；同一株**再炸一次**无异常（不抖、不瞬移）。
3. 中距（7~8m）炸一次只是"晃一下"，**第二次**才倒（与乔木一致）。
4. 炸倒一片椰林 → 打完这局回主界面 → 航拍里的椰林/枯木**直立完好**；就地开新一局同样完好。

### ① 水域/水战子系统审计清单（**本轮一行代码未动**，等裁定）

四路并行通读（水域地形/游泳 · 海战载具本体 · 战斗·编制·部署链 · 水面渲染/音效），合并去重后 **41 条**（P0 4 / P1 12 / P2 25），
逐条带 `文件:行` 证据与可观察后果，清单与复核结论见 `finished-docs/archive/交付文档-枯树椰树倒伏与水域水战审计-20260926E.md` §5。

- **P0 四条**：① **舰艇车组一去不返** —— 全库唯一配车组的地方是 `startMatch`；沉没 `crewOut()` 与玩家上艇都把人摘走且不返还，
  重生 `respawn()` 只清空；而"闲置载具重新配组"只扫 `tanks`（14-bots `pickIdleDeployVehicle` / `decide` 上车分支）。
  ⇒ 开局几分钟后全队舰艇逐台变**无人漂航的靶船**（不开船不开炮、被击沉还照扣 4~5 票）。
  ② **艇上玩家"子弹免疫、溅射满额"** —— 海战座位刻意不挂 `onVehicle`（20a 契约），而 `splashDamage`/`explodeAt` 的豁免清单只认 `onVehicle`
  ⇒ 一发炮弹命中你乘的艇，舷侧溅射对玩家按步兵满额结算（`lerp(150,10,d/7)`，d≈1.8m ⇒ ≈114 > 100 HP），而坦克里的玩家/车组零伤。
  ③ **淞沪水网"视觉在水里、判定在岸上"** —— `waterSampleY` 按离散圆近似（半径 `hw+1.2`）而采样间距 ≈12m ⇒ 可见水面 **29.7% 判干**、
  中心线 27% 为干（干段长 3.3m 与算式 `12.16−2×4.43` 逐位吻合）；一次坏掉游泳/水下滤镜/憋气/入水弹道/Bot 涉水五件事。
  ④ **Bot 上桥必落水（AI 过不了河）** —— `moveDir` 拿 `waterDepthAt`（强制取河床、无视桥面）当"是否在水里"的判据 ⇒ 站在胡康大桥上被判游泳，
  同帧被拽到桥下水面（y −0.20 → −8.92）；胡康两座桥 + 淞沪两座桥触发，而这两图的主攻轴正是过桥。
- **P1 十二条**（岸炮跨局占用 / 艇间无碰撞 / 艇上 1-2 换枪打破座驾读数 / 右键 ADS 漏门控 / 阵亡不清 `onNaval` / 15f 死 AI 路径 /
  `waterYAt` 窗口取最大使物理水位高出渲染面 6.14m / `shoreDirAt` 近岸恒 null / 滇缅·莫斯科河不入 OCC / 胡康河"落水必死" /
  世界边缘三边界不同源 / 涉水音效整类缺失）与 **P2 二十五条** 见交付文档。


---

## 一.21 本轮修复：地图与载具设计缺陷批（2026-09-26D，已实现，待实机验收）

### 起因
用户 2026-09-26「自行深度思考和查找一下地图和载具设计方面有哪些大问题/BUG或者不合理之处，列出一个清单来」→ 我出 **19 条清单**（P0 5 / P1 8 / P2 6）→ 用户「穿模是真的。全部开工修复。修复完了之后再审查一遍，确保不会越修越坏！」

### 落地（19/19；逐条细节、数字与复现脚本见 `finished-docs/archive/交付文档-地图与载具缺陷批-20260926.md`）
- ✅ **P0-1 断崖公路伏击点被挖成 2.87~5.66m 的坑**（`03-terrain`）：出生平台削深上限 2m，高地改取"当地高 −0.4m"浅台（其余图逐位不变）。
- ✅ **P0-2 柏林/莫斯科守方工事摆进攻方开局旗圈**（`00-config`+`05c`+`23-deploy`）：`attackerFlagPicks` 单源，布局端与归属端共读；工事命中 0/2 攻方旗。
- ✅ **P0-3 草原强点死袋（本批最重）**：①`07-nav` 判据改"同一条走廊"（格开放=格心空或四象限≥3空；边=中线或其 ±1.5m 并行线贯通）②强点工事环外推 9.5~11.5m + 散布 10m 净空（`spawnKeepClear`）+ `17-emplacements` 炮位外推 10m ③麦田农庄院口敞开（南/西成院门）。**13 次 boot 判罪 0**（修前多次 1~3）。
- ✅ **P0-4/P0-5 坦克出生朝向与落位**（`15-vehicles`）：yaw 改"指向敌基地"（12 图 0° 偏差，修前斯大林格勒 138~148° 背对）；新增 `tankSpawnOk`（占用格+水深+车体三圆+四角 25° 坡门）+ 环向找净位。
- ✅ **P1-6 命中体积**：复核（上半场已改 `VEH_HIT_TOP` 单源 + 舰船胶囊）；半径 2.3 圆柱**有意保留**（理由见交付文档 §5-①）。
- ✅ **P1-7 AI 坦克感知海战载具**（`15-vehicles`）：候选并入 `navalCraft`，炮塔 AI 引入 `isVeh`（主炮对艇）。
- ✅ **P1-8 水深刻度归一**（`00-config`）：`VEH_WATER_DEPTH=SWIM_DEPTH`（塔拉瓦礁盘 14m 环岛带不再"看着能过、开进去掉血"）。
- ✅ **P1-9 战机扫射载具口径**（`16-aircraft`）：删手写 `takeDmg(3)`，改弹体 `vehDmg=mgDmg×0.18`（强度不变、从此有遮挡）。
- ✅ **P1-10 海战炮弹扫掠**（`15d`+`15-vehicles`）：`shellHitNaval(s,dt)`，包络 = `vel×dt`（低帧率不再跳艇）。
- ✅ **P1-11 玩家鱼雷闸门**（`20a-seats`）：`max(reload, NAVAL_TORP_CD)`（不再"报发射成功但海里没有雷"）。
- ✅ **P1-12 AT 炮回旋限界**（`00-config`+`20a-seats`+`14-bots`）：±100°，视角/炮口/弹道同向钳制（炮口距操作手 ≥0.886m、距后方墙 ≥1.272m）。
- ✅ **P1-13 飞行员等待单位**（`16-aircraft`）：`+=dt`（10 秒真是 10 秒，不再 4 帧抓人）。
- ✅ **P2-14 平板车朝向**（`05c`）：柏林/百团/莫斯科 8 台按轨道走向转 90°。
- ✅ **P2-15 教堂复合体足迹**（`05c`）：4 个调用点统一 `{oz:-2.55}`（塔楼不再探出选址矩形 2.55m）。
- ✅ **P2-16 田地重叠**（`00-config`）：草原 12×48m / 诺曼底 6×10m 两处重叠消除。
- ✅ **P2-17 死配置**：`defSide` 归位（`defWorks()` 缺省读它）；`alpine`/`main.recoil`/`floodDrain`/`CREW_N` 复核为**休眠字段**并就地注明（交付文档 §5-②）。
- ✅ **P2-18 植被落水**（`03-terrain`+`05c`）：新增 `inWaterBody` 通用水体门（野树+草丛），12 图树落水 0 株（修前滇缅 646 / 莫斯科冰面 594 / 胡康 147 / 淞沪 230 格）。
- ✅ **P2-19a 岸炮打自己**（`15f`+`20a-seats`+`14-bots`）：方向机 ±100° + 俯角下限**逐角反解**（胸墙余量 ≥0.48m、最低炮口离台面 1.748m）。
- ✅ **P2-19b 塔拉瓦碉堡穿模**（`05c`）：中障壁两座椰木掩体 (±34/36,42)→(±34/36,34)；阴性对照 29 段相交 → 0。

### 验收（新增 2 个复核脚本 + 4 个专项探针）
- `dev/_audit-fixes-verify-20260926.js`（13 项断言：5 条源码口径 + 8 条沙箱几何/行为）**13 通过 / 0 失败**
- `dev/_mapfix-verify-20260926.js`（平板车朝向 / 教堂足迹 / 田地重叠 / 树落水四项普查 + 水下格判据漏检）12 图全绿
- `dev/verify-navspots-20260926` 13 次 boot **判罪 0** · `dev/verify-nav-20260926` 正向 **8/0** + 阴性对照 **7/1 报红**
- 专项探针：`_spawnflat-probe` / `_defworks-probe` / `_steppe-pocket-probe` / `_village-cell-dump`（均含阴性对照或反向对照）

### 复审（"确保不会越修越坏"：候选为空 ⇒ 游戏代码零改动，只修过期判据）
全量 `dev/run-all-verify.js` ⇒ **21/21 次运行 exit=0**。两条红都做了因果定位，**均不是游戏代码缺陷，而是判据仍按
旧语义写、而本批有意改了语义**：
1. `verify-nav` ④ 拿**放宽前**的严格中线 `lineClear` 判路径段 —— 本批把边判据放宽成 `edgeOK`（中线**或** ±1.5m
   平行线），必然假红（雾林守线 8 段；连跑 6 次恒为 8 ⇒ 非随机漂移）。定位脚本 `dev/_navleg-diag.js` 证明那 8 段是
   "擦一件 1~2m 点状道具、侧面 0.5~1.25m 即空走廊"，不是穿墙 ⇒ `07-nav` **导出 `edgeOK`**（判据单一来源，不在探针里
   另抄一份平移逻辑）、探针 ④ 改判 `NAV.edgeOK`（严格中线只报不判）、新增 ⑦ **真几何合成对照**：1m 厚 × 14m 长墙必须
   被拒；点状道具逐档量出上限（0.2~0.8m 立方放行、1.0m 立方与墙一律判死）。**不改游戏代码**的理由：这类段是"擦角"，
   `14-bots moveDir` 每帧 1.1m 内探 7 方向 + 连续卡 3 次插绕行点，0.5~1.25m 走廊在绕行能力内；改平滑器会动全图路径形状。
2. `verify-fixbatch` ②-h 与本批自带的 `_audit-fixes-verify-20260926` 都在找 P1-13 的旧写法（帧单位 `+=3` / 带括号的
   `(this.pilotWaitT+=dt)`）⇒ 改查"按 `dt` 每帧累加 + 到期清零回退"，且**先去行注释**再查旧写法不在（注释里刻意留旧写法
   作对照，否则判据会被自己的注释绊倒）。行为断言实测 **10.0s**；`_audit-fixes-verify` 顺带踩到"它下半截是模板串、
   串内不能写反斜杠"的坑（`split('\n')` 会被模板求值吃掉）⇒ 改 `String.fromCharCode(10)` + `indexOf('//')` 现算。
逐条细节与量测见 `finished-docs/archive/交付文档-地图与载具缺陷批-20260926.md` §9。

### 待实机验收（请按现象看，详见交付文档 §7）
1. 断崖公路伏击点**不再是坑**（浅台，能看见公路）；2. 柏林/莫斯科攻方开局旗圈**没有**守方工事；
3. 草原 7 个强点**都能进出**、工事环更松、麦田农庄**有院门**；4. 坦克出生**车头指向敌方基地**、无压件；
5. 塔拉瓦：守方坦克**会打艇**、礁盘浅水**不再熄火**、椰木掩体**不再穿石障壁**、岸炮压炮**不穿自家胸墙**、
   上炮视角被钳在 ±100°（AT 炮同理）；6. 滇缅/莫斯科/淞沪/胡康**河里不再长树**；
7. 柏林/百团/莫斯科的**平板车与轨道平行**；8. 战机扫射**受遮挡**、飞行员等 10s 才被收回座舱。

---

## 一.20 本轮修复：性能批（2026-09-26B，已实现，待实机验收）

### 起因
用户「自行深度思考和查找一下性能优化方面有哪些大问题/BUG或者不合理之处，列出一个清单来」→ 我出 14 条清单
（冻结级 3 / 帧级 2 / 渲染端 4 / 物理·冗余·回收 5）→ 用户「全部开工修复。修复完了之后再审查一遍，确保不会越修越坏！」
→ 落 **9 条改 + 5 条实测驳回/复核订正**，另顺带修掉 3 处（含我自己第一版写错、复查时发现的一个真漏洞）。

### 已改（逐条实测，详见 `finished-docs/archive/交付文档-性能批-20260926.md`）
- ✅ **① `NAV.refresh()` 全量重烘焙**（`03-terrain` `07-nav`）：静态地貌层缓存 + 脏矩形增量重烘焙。
  胡康 **1177 → 11 ms**、断崖 726→1、塔拉瓦 577→7、莫斯科 302→17、淞沪 291→5、百团 254→9、
  雾林 175→7、柏林 140→8、草原 146→4。局部改动（塌墙/点火/碾网/造工事）增量 0~2ms vs 全量 130~150ms。
- ✅ **② 桥梁一行让四张图高度快路归零**（`03-terrain`）：`if(BRIDGES.length) m=-1` 改为按桥矩形距离记账；
  顺带修掉地基平台 `reach2` 提前跳过（柏林实测地形差 2.5e-4m）。`heightAt` 胡康 **12~14 → 2.96 µs**，
  快路命中率 **0% → 86~95%**（胡康/塔拉瓦/断崖/莫斯科/柏林/雾林），400m 眼位射线 0.7 → 0.115 ms。
- ✅ **④ 每帧对象 churn**（`14-bots` `13-combat`）：`perceive` 每候选 2 个 V3、`moveDir` 每探测 2 个 V3、
  `raySoldiers` 每候选 1 个对象 —— 三处改复用槽（前提逐处核过：只读入参、结果走共享槽、不跨迭代持有）。
- ✅ **⑤ `updateHUD` 写入去重**（`22-hud`）：五支包装（含 `--gap` 走 `setProperty`）。
  稳态每帧路径 DOM 写入 **~30 → 0 次**；28 项"值变了必须落到 DOM"判据全绿。
- ✅ **⑧ 逐实例材质共享**（`05b-props`）：棕榈果 ~1500 / 竹杆 ~1000 / 警示桩 / 弹坑埂 → 模块级共享
  （全库零材质写点，渲染逐像素相同）。
- ✅ **⑬ RGRID 去重戳按需扩容**（`04-collision`）：运行期新增碰撞盒越出容量后去重静默失效。
- ✅ **顺带**：`15f-battery` 落位的三连重建（NAV.refresh 内部本就调前两个）→ 只留一支。

### 实测驳回 / 复核订正（5 条，理由与数据见交付文档 §5）
- ③ 射线地形推进**不改采样口径**（根因是 ②，已消）；⑥ 实例批不是 draw call 洪水（真凶是逐件 mesh）；
  ⑦ `far` 与天空球+太阳贴片绑定，缩 far 会切掉天空；⑨ 画质档位**复核订正**（点按钮即生效，原判断部分不成立）；
  ⑩ SAP 广相**实测驳回**（1.02× 提速 + 位置差均值 1.52m）；⑭ 音频近场限流不改（会听得见地丢枪声）。

### 留待裁定（本批未动，均为"可见行为变更且沙箱无法验证"）
- 棕榈逐件 mesh（塔拉瓦 ~5400 格 ≈ 全图网格 70%）→ 需重构 `floraHashAdd({meshes:[grp]})` 的整株隐藏/燃烧/还原链路
- 170 刚体静置期 2.37ms/步（cannon 默认不睡）→ 开 `allowSleep` 需逐处补 `wakeUp()`
- RGRID 13m 格距（密集区单格 327 个盒，60m 射线过 354 个盒）

### 验收判据
`dev/_equiv-hgrid.js`（快路等价 232,901 点全绿）/ `dev/_navincr.js`（增量≡全量：**11 图 × 8 场景 = 88 组全绿**，
含 `open`/四张边表逐格 + 分量划分规范化 + 两条表不变量）/ `dev/_hudwrite.js`（28 项全绿）/
`dev/run-all-verify.js` 全量套件（三次跑分 21/21、23/24、21/21；那 1 项是**输入侧偶发** —— 同一 `?seed=42`
独立 boot 两次的世界都不同，见 `dev/_seeddet.js` 与交付文档 §7.3）。

### 需用户裁定的一项口径（本批未动）
布局期随机不统一：`06-engineering mgSpot()` 用 `Math.random`（`rand`），其余布局走可播种的 `wr` ⇒
**同一 seed 下世界构建不可复现**，任何按布局断言的探针都会偶发（约 1/20）。修它（`rand`→`wr`）会位移
可播种随机流 ⇒ 各图布局全变、`verify-layouts` 指纹（fp=311147）失效。**要不要修请裁定。**

---


### 起因

> 用户 2026-09-26：「开工修复。」—— 承接 2026-09-26 的**独立缺陷审计**（另一轮通读，交 P0 9 / P1 16 / P2 约 20 条清单）。
> 本批落 P0 全部 + P1 中"便宜且判据清楚"的 10 条；P2 里的 i18n 缺口、`vmEquip` 几何泄漏等留作下一批。

### 落地（20 行 = P0 全 9 条 + P1 十条；"出生点"一条拆成"死袋闸 + 坐标搬家"两行；逐条注释都在源码里带 ★2026-09-26 标记）

**A 类：07-nav A* 核心（P0 前三条同源，一处不修则整批寻路都在错误状态上跑）**

| 编号 | 条目 | 一句话 |
|---|---|---|
| A1 | 访问代**两格制** | `gen++` 使第 N+1 次调用的"入堆代"撞上第 N 次调用的"落定代" ⇒ 上一轮已落定的格子在新搜索里被当成"已入堆"跳过、兜底扫描还会把陈旧 came 链当会合点 ⇒ `findPath` **不是纯函数**（实测同 (起,终) 连跑六次弹出数 30604/2/30604/2… 交替）。改 `gen+=2` + 回卷重建 |
| A2 | 预算按**落定数**计 | 旧版拿"两分量格数之和"（落定容量）当"堆弹出次数"上限 ⇒ 同格改优重推会多弹一次、弹出先撞顶返回 null（hukawng 基地→图心 弹出 30604 即判无解，而 `pruned=0` 分量表自己说可达）。拆成 settled（正确性）/ popped（性能软上限）两个计数 |
| A3 | 堆换成**索引式最小堆** | 真根因：`NN*4` 容量的惰性删除堆在长查询上**越界写**（TypedArray 越界静默丢弃）⇒ 堆读到上一轮残值、两棵树永不收敛；抬上限到 1000 万也照样 null（落定仅 4674）。换 `heapPos` 索引式堆（容量 2*NN、每格每方向一项、改进走原地降键）⇒ 弹出数 == 落定数。实测量：hukawng 长查询 90000 弹出 → **最大 11742**，全 12 图平均 1346 |
| A4 | 出生"死袋闸" | 5m 格 + 0.9m 线采样是保守判据：强点工事环（草原遭遇 7 个 spawns）或一件随机落在门线上的道具就能把点位圈成 2~5 格死袋，落进去的兵对任何目标恒 null。新增 `NAV.spawnSpotOk/spawnSpot`，接进 `spawnLandingClear` 与兜底搬迁（含 23-deploy 开局小队 3 人的独立落点） |
| A5 | 百团南进攻营搬家 | (-262,-205) 在南沟**南侧**那片与主塬不通的川地（848 格分量，跨分量查询 18/18 null）→ 移到主塬西南缘 (-262,-120)（站得住 + 主分量 13069 格，且符合本图"前出点须避开沟壑带"的既定规则）；营地布景按 sp 坐标现算，自动跟随 |

**B 类：战斗机 / 海战 / 命中口径**

| 编号 | 条目 | 一句话 |
|---|---|---|
| B1 | 生还飞行员不再永久扣机 | 旧版"飞行员还活着就 `respawnT=3` 无限回退"，而飞行员活着 = `<32% 血跳伞生还`（crewBot 已摘、pilotBot 在地面）⇒ 该队空中支援整局消失。加 10s 硬上限 + 走 `enterVehicle` 收回座舱（松炮位认领/收伞，不新增士兵） |
| B2 | 艇体纳入挡弹裁决 | 旧版 `navalBulletTest` 排在步兵/坦克结算**之后**，只做事后剪辑 ⇒ 艇后 3m 的士兵与艇一起挨弹。抽 `navalRayQuery` 只读查询，在裁决前收窄 `wallD`；扣血仍在原处单点施加（不重复） |
| B3 | `splashDamage` 掩体遮挡 | 与 `explodeAt` **同一条式子**（爆炸点→胸口射线被挡则 ×0.25）。旧版只有场景爆炸有遮挡 ⇒ 隔一整栋楼的手雷照样满伤、同一颗航弹两个模型口径不一致 |
| B4 | 命中上限按族取 | 旧版一律 `hullH*1.05` = **舷缘**高：LVT 2.05 / カミ 1.63 vs 模型炮塔顶 2.78 / 2.39 ⇒ 打车顶的子弹从头顶飞过。两栖车改用坦克口径 `VEH_HIT_TOP`（15-vehicles 提为具名常量，与 `navalHitCyl→vehHitCyl` 同源），艇取 `max(舷缘, dims 塔顶)` |
| B5 | 15e 几何绕向 | カミ 后侧浮筒（`sz<0` 侧断面 z 递增，违反放样契约）整体内翻（符号体积 −6.25、外向率 0%）⇒ 断面串按 z 方向归一；螺旋桨凸盒 F 表逐面反向（4 片桨叶体积 −0.003、外向率 4.2% = 内面被点亮的黑片）⇒ 逐面反序 + UV 同置换 |

**C 类：P1 十条**

| 编号 | 条目 | 一句话 |
|---|---|---|
| C1 | 难度 0 存不住 | `parseInt('0')\|\|1` ⇒ 选"新兵"后任意一次 reload 跳回"老兵"。改 null 判读（与 sf_vol "0 是合法音量"同规） |
| C2 | 空车战报假乘员 | 空车分支明确"0 死 0 杀"，战报却写 `· 乘员×3` ⇒ 有人才写乘员数 |
| C3 | `deployMortar` 无落点门 | 贴墙按 B / Bot 就地架炮会把炮架进碰撞体（炮身埋墙、上炮位站不进去、coverPoints 多一个废掩体点）⇒ 加 `occBlocked` + 边界门（与 engBuild 同口径） |
| C4 | 回收炮弹进错枪 | `find(mortar)\|\|slots[0]` 在无迫击炮槽时把 2 发记到主武器上 ⇒ 去掉兜底 |
| C5 | 铁丝网碾平后**永久消失** | 碾平走 `splice` 删条目，而 23b 重开复位是"截断式"（表只增不减的前提）⇒ 条目保留 + `dead` 标记（03-terrain 占位 / isWire / 碾平循环三处跳过），23b 复位清 dead + 显回模型 |
| C6 | 持雷状态机卡死 | 上坦克/上艇/上炮位都会摘 `nadeHeld` 而不复位 VM ⇒ `stateDur=999` 哨兵态永不推进（手里永远握着雷、开不了火，999 秒后凭空扔出）。视模型 `nade` 分支加自愈：哨兵态下发现手上没雷 ⇒ 回 idle，不触发投掷 |
| C7 | 岸防炮击杀来源 | `if(shooter===b\|\|!shooter._src)` 只在"炮手身上没标签"时才挂 ⇒ 玩家上炮前开过枪就一直记"卡宾枪"。改为无条件写 |
| C8 | 雾林"岭上村"拿错模板 | 分档条件 `own===1` 在本图**永不成立**（7 面旗都没写 own）⇒ 德军村社强点拿到美军出发营区模板（帐篷×2）。改按 id 点名（不动 own ⇒ 开局归属零变化） |
| C9 | 莫斯科龙牙穿堡 | 两座机枪堡 (118,∓45)/(118,57) 就在龙牙线上，龙牙先落位、碉堡后建 ⇒ 堡内嵌 4 颗（实测 118,-46 / 118,54 / 118,60 / 121,60）。按堡足迹跳过相邻站位（全场龙牙 28→22，堡内 0） |
| C10 | 迫击炮额度跨命不清 | `Bot.spawn()` 不复位 `mortarPlaced` ⇒ 架过炮的迫击炮兵阵亡重生后再也不架（玩家侧本来就在部署复位里清） |

### 验收（新增 3 个探针 + 3 个临时量测脚本）

- `dev/verify-nav-20260926.js`（A 类判据，含 `--neg` 阴性对照）：**正向 6/6 绿**（110 查询 × 4 次纯函数 / 同分量零假失败 / 干净端点零穿墙段 / 无查询撞硬上限 / 无重复弹出）；**阴性对照按预期报红**（旧写法同入参 4 次 6/9 图不一致）。
- `dev/verify-fixbatch-20260926.js`（B/C 类判据，含 `--neg`）：**正向 54 ✓ / 0 ✗**；**阴性对照 5 红**（逐条证明判据能分辨修与未修）。关键实测：艇后士兵掉血 0 而艇掉血 6 / 隔墙溅射 6.2 vs 同侧 24.9（正好 1/4）/ 生还飞行员 9s 带机归队（旧写法 40s 模拟内永不复活）/ 龙牙堡内 0 颗。
- `dev/verify-navspots-20260926.js`（出生/旗点体检，端到端口径 = **实际步兵落点**）：草原遭遇 27 人**零人卡死袋**；百团南进攻营已回主分量。
- 临时量测（不进套件）：`dev/_navaround.js`（单点邻域字符图 + 最近主分量可站立格）、`dev/_finemap.js`（occBlocked 细网格字符图）、`dev/_navcap.js`（海战载具命中上限 vs 模型实测顶面）。
- 既有套件：`_naval-model-selfcheck` 87 ✓ / `verify-seabatch` 8 ✓ / `verify-bugfix-20260925` 71 ✓ / `run-all-verify`（见 §回归基线）。

### 待实机验收（请用户按现象看）

1. **寻路**：Bot 是否不再"卡在房子之间/原地站桩"（尤其胡康河谷跨图、草原遭遇三个强点、百团南线）。
2. **战机**：把敌机打到跳伞后，过 35~48s + 10s 是否还会回来（旧版此后再也不来）。
3. **对射**：隔着小艇打艇后的人是否不再"一枪两人掉血"；手雷隔墙伤害是否明显变小。
4. **命中**：打两栖车顶部/塔身是否开始掉血（旧版只有打舷侧才有用）。
5. **观感**：カミ 后侧浮筒与四片螺旋桨在光照下不再是黑面（绕向修正）。

---

## 一.18 本轮修复：通读全库缺陷批（2026-09-25A，已实现，待实机验收）

### 起因

> 用户 2026-09-25：「自行深度思考和查找一下有哪些BUG，列出一个清单来。」→ 我通读 `js/` 全部 34 文件 +
> `index.html` + `css/style.css`，交 **30 条**清单（A 功能 / B 建模 / C UI·i18n / D 泄漏·死代码 四类）→ 用户「开工」。

### 落地（24 条，逐条细节见 `finished-docs/archive/交付文档-通读缺陷批-20260925.md`）

| 类 | 条目 | 一句话 |
|---|---|---|
| A1 | `explodeAt` 空攻击者 | 钢水包爆炸**零伤害**+火区不生成（异常被 05-world 吞掉）⇒ 无主爆炸守卫 |
| A2 | 沙袋墙缺参 | 百团 3 处墙建在 NaN（`Math.cos(undefined)`）+ 6 个 NaN 掩体点 |
| A3 | `ramps[i].x` 不存在 | 雾林 3 个堑口 8 件标桩全建在 NaN（表里只有 x0/x1） |
| A4 | 岸防炮漏出门卫 | 炮位上按 G ⇒ **下炮自动扔出一颗活雷**（同源：Z/C/H/B/3/4/6 也生效） |
| A5 | Bot 双占炮位 | `decide()` 缺 `mortUse` 提前 return ⇒ 迫击炮被 MG42 任期永久占位 |
| A6 | 水下雾不回位 | 潜水时回主菜单 ⇒ 菜单航拍整片蓝绿（冻结分支不跑 updateUnderwaterFx） |
| B1 | 首上装甲板参数位 | 板长挂在 z 上 ⇒ 近垂直车变成"前伸搁板"、T-34 大倾角看不见 |
| B2 | カミ 浮筒二次缩放 | 筒长 1.44×ptL（设计 1.2×）⇒ 深吞车体 1.07m（设计 0.67m） |
| B3 | カミ `bl` 口径 | 代码 0.64 / 文档 0.595 自相矛盾 ⇒ **以代码为准**（0.64×7.40=4.74m ≈ 史实 4.8m），文档勘误 |
| B4 | 螺旋桨公转 | 桨叶/桨轴绕**车体中线**划圈 ⇒ 每舷独立枢轴 + 15d 逐枢轴驱动 |
| B5 | 两个材质未定义 | `MAT.earth/concrete` 从未定义 ⇒ 窑洞=砖墙、龙牙=石料（兜底静默生效） |
| B6 | `waterTower` 重名 | 05c 覆盖 05a ⇒ 草原车站拿到斯大林格勒的矮塔；改名 `stationWaterTower` |
| B7 | 鱼雷兜底左右不分 | 无锚点兜底两舷算到同一侧（左舷取负） |
| C1 | boot-play 兜底被压掉 | `.hidden{!important}` 必胜 ⇒ 选战役重载后首帧菜单空白 |
| C2 | i18n 键不匹配 | EN 模式"📁 占旗点战役"仍中文（emoji 不在键里 —— 全词典唯一永不命中的键） |
| C3 | 遮挡从未生效 | 裸属性 vs `:not([data-i18n=""])`；且摘除早于盖章 ⇒ 选择器修正 + 摘除挪到 `i18nBoot` |
| C4 | 开局页假"阵亡小结" | `showDeploy(true)` + `lifeStartT` 不复位 |
| C5 | 三项设置不落盘 | 画质/灵敏度/音量 ⇒ `sf_qual/sf_sens/sf_vol`（存滑条原值，与 sf_tsize 同规） |
| C6 | 结算按钮文案 | "再来一局" → 「返 回 主 界 面」（README 2026-09-16 就记了，只 HTML 没跟上） |
| C7 | three.js 载两次 | 同一 URL 两个 `<script>` |
| C8 | 死亡 HUD 残留 | `#interact/#clsTip/#heatWrap` 残留到 showDeploy 盖上 |
| C9 | 样式探针误报 | 窄窗/移动端 `#menuArt` 按设计 `none` ⇒ 每次加载误报 + 重复拉样式表 |
| D1 | 尸体几何不回收 | 每具 7~8 个几何常驻（材质共享不能删，几何可删） |
| D2 | DDA 上界 | `ci>N` → `ci>N-1`（白跑一轮） |

顺带删掉 6 行死 CSS（`#hint/#ctrlHelp/#helpBtn`，全库无引用）。**未修 6 条**(ALPINE 死分支 / buildRailBridge 未接线 /
`navStats.meet` 语义 / 15d sinkJob 等无读者字段 / 死 CSS 已删 / 雪峰山太行山残留配置)，理由见交付文档 §6。

### 回归

`dev/verify-bugfix-20260925.js` **71/71**（新写，含 6 组阴性对照）· `_naval-model-selfcheck` 87/87 ·
`_naval-selfcheck` 80/80 · `verify-vehmodels` 10/10 · `verify-seabatch` 8/8 · `verify-spec` 56/56 ·
`verify-specthird` 58/58 · `verify-naval` 9/9 · 其余 20+ 个 verify/`_selfcheck` 全绿（清单见交付文档 §7）。
另修好两处**判据自身缺陷**（写死行号被注释顶偏）：`verify-20260921B-speed` ④-2 改按内容定位、
`verify-a21-a7` 改按文件过滤（该脚本 30/31 → **28/28**）。版本戳 `20260922a → 20260925a`（41 处）。

### 待实机验收（逐项可执行，详表见交付文档 §8）

- [ ] 炸钢水包 ⇒ 附近双方**掉血 + 起火**（改前无伤害无火）
- [ ] 百团前出点各**两堵**沙袋墙；雾林堑口两端有木箱/油桶标桩
- [ ] 迫击炮上的 Bot 离开后，该炮**能重新被玩家 F 接手**
- [ ] 岸防炮上按 G/Z/C/H/B/3/4/6 **无反应**；下炮后才正常
- [ ] 潜水→返回主界面：菜单背景**正常**（不是蓝绿）
- [ ] 四号/九七式有近垂直首上装甲；T-34 大倾角可辨
- [ ] カミ 浮筒不再吞车头；两栖车/艇开动时**桨原地自转**
- [ ] 窑洞=土坯色、龙牙=水泥色；草原车站是**四腿砖柱**水塔
- [ ] 选战役重载首帧即「开始游戏」面板；EN 存档刷新不闪中文
- [ ] EN 模式战役文件夹标题 = `📁 Flag Campaigns (N)`
- [ ] 新开局兵种页**无**"本次存活 0:00…"假小结（真阵亡那条仍显示）
- [ ] 改设置→选战役→回设置，三项设置**保留**
- [ ] 结算按钮写「返 回 主 界 面」；死亡镜头无残留提示/热量条
- [ ] 窄窗(≤620px)/手机加载**无** `[CSS] 样式表疑似缓存旧版` 警告
- [ ] 连续就地面重开 3~4 局，帧率/显存不持续下滑

---

## 一.17 本轮修复 + 重做：观战 F 键（鱼雷/下车/幽灵坦克）三义冲突 + 两台两栖车史实剪影重做（2026-09-22A 观战F冲突·两栖车重做批，已实现，待实机验收）

### 起因（用户实报 + 四项裁定）

> 现在观战模式下按F的鱼雷、下车功能和召唤幽灵坦克的功能存在严重冲突。
> 重新设计制造两个两栖车的模型，现在一个是散架的，一个像个棺材，都需要全盘重做。
> （方式）建议不要使用浏览器操作来实机验证，而是让我代为实机操作验证，你则提出问题询问我。

**开工前用户裁定**：① F 键 = **状态优先级栈**（艇上时召唤不可用）；② 观战者**不能**走路/游泳登艇，只能从部署界面选舰艇出生项；
③ 「散架」= LVT(A)-1 / 「棺材」= カミ；④ 重做方向 = **史实剪影 + 一体化**。

### 根因（F 键冲突是三条独立缺陷叠加）

| # | 现象 | 真因 | 位置 |
|---|---|---|---|
| ① | 在艇上按 F 永远召唤幽灵坦克，鱼雷/下船在真输入链上不可达 | `tryInteract` 的观战分支排在海战座位分支**之前**并直接 return | js/20-player |
| ② | 按一次 F 后"人钉在艇上却开着白车"（状态机劈叉） | `specVehBoard` 不清 `player.onNaval` ⇒ 两个座位字段同时非空，`updatePlayer` 仍走 `updatePlayerNaval` | js/15c-specveh |
| ③ | UI 上同样显示成"F 召唤并进入幽灵坦克" | `updateInteractHint` 的观战分支同样排在最前，把鱼雷/下船提示盖掉 | js/20-player |
| ④ | （取证时新发现）"步行→上艇"提示不刷新 | 提示指纹 `sig` 里**没有 `onNaval` / `onVehicle.kind`** | js/20-player |

### 实现要点

1. **`tryInteract` 改语义优先级栈**：① 幽灵坦克上=下车 → ② 海战舰艇上=深水鱼雷/可涉水·搁浅下船 → ③ 其余=召唤幽灵坦克；
   观战者只在前两态放行（用户裁定②）。
2. **两个座位字段双向互斥**：`specVehBoard` 上白车即 `navalSeatRelease()`；`navalBoard` 上艇即 `specVehStow()`（幂等）。
3. **提示行与 tryInteract 逐级同序**；**HUD 操作行**补 F 的"下船"语义（旧版永远写 `[F] 鱼雷`）；
   观战横幅 `F=幽灵坦克` → `F=按状态(…)`；i18n 英文条目同步。
4. **提示指纹补 `onNaval`(2048) + `onVehicle.kind==='ghost'`(4096)**。
5. **两台两栖车从"多个 Box 拼"改成"一张断面放样曲面"**（新增 `nmLoft`）：浮力箱 = 车体的**舷侧折角**（不再是外挂薄缘/唇板），
   艏部收窄+船底上翘（跳板艏），下水线上下**折角即分色线**；行走机构改史实布局（负重轮压履带外侧 + 两端主动轮/诱导轮）；
   尾部改**开放艉架 + 三叶桨 + 每舷一片舵 + 舵间横梁**；カミ 浮筒改**船形放样**并**套住车体端部**（咬合 0.20×筒长）+ 连接卡扣。
6. **新增 `S.bodyL`**：カミ 的 `spec.hullL` 是**含浮筒全长**（史实 7.42m 即含浮筒，车体 4.8m）⇒ 车体 = 0.64×hullL（**2026-09-25 勘误**：此处旧写 0.595×hullL ≈4.4m，与同句引的史实 4.8m 自相矛盾；0.64×7.40=4.74m 才是常量真正算出来的值，见 `js/15e-navmodels.js` 文件头①），
   行走机构/艉部/旗杆一律按车体长派生（旧版按总长算 ⇒ 艉架/桨/舵被甩到车体之后 1.6m）。
7. **新工具**：`dev/_modelview.js`（纯 Node 软件光栅器，四格视图 + ZOOM 近景四格，用户指定不做浏览器操作）、
   `dev/_amph-parts.js`（两栖车逐件 AABB + 关键净空）、`dev/_fkey-selfcheck.js`（F 语义优先级栈行为自检，16 项）、
   `dev/_bootpatch.js`（把 verify-seabatch 的桩补齐抽成共享模块）。

### 顺带修掉的三处相邻缺陷

- **提示指纹漏位**（真缺陷，见上 ④）；
- `verify-seabatch` 第④条判据只看**盒体** ⇒ 旗面（挂在 `CYLS` 旗杆上）必然被误报"悬空件"（缺口；
  实测 42 件 → 计入 CYLS 后 34 件）；
- `verify-seabatch` 第⑦条**自身语法错、从未真跑过**（段内重复声明 `let stairTop`）+ "顶步"读数取到**最下一级**
  （steps 自下而上建）。修好后判据第一次真正执行，并把接地判定改成按**梯脚盒 footprint 地形区间**
  （island 6 座：5 座恰好 −0.05 = 设计值，第 6 座 −0.0643 是 footprint 下地形 3.1cm 起伏造成的零余量问题）。

### 验收清单（请逐项试并反馈；详见 `finished-docs/archive/交付文档-观战F冲突与两栖车重做-20260922A.md` §4）

**A. F 键（均需在观战模式下）**
- [ ] 幽灵坦克上按 F ⇒ 下车且**车立刻消失**
- [ ] 深水艇上按 F ⇒ **发射鱼雷**；提示行写 `[F] 鱼雷`（不是"召唤幽灵坦克"）
- [ ] 浅滩/搁浅艇上按 F ⇒ **下船**；提示行写 `F 下船`
- [ ] 上岸空手按 F ⇒ **召唤并进入幽灵坦克**
- [ ] 步行/游泳靠近本方艇按 F ⇒ **不上艇**（按裁定②应召唤白车）
- [ ] 海战 HUD 操作行尾随水深在 `[F] 鱼雷` / `[F] 下船` 间切换

**B. 两台两栖车（外观）**
- [ ] LVT(A)-1：舷侧折角读作"浮力箱"；**不再有支棱在外的小板子**；负重轮压在履带外看得见
- [ ] カミ：不再像"棺材"；浮筒是**船形收口**且**套在车体上**（有卡扣）
- [ ] 两台的桨都**看得见**（旧版被后板包住）；每舷一片舵 + 舵间横梁；桨叶与艉架/舵有明显缝隙

### 已知取舍（待用户裁定）

- 观战者不能走路登艇 = **刻意**（用户裁定②）；日后想开只需在 tryInteract 第③层加一条半径判定。
- カミ 车体 = 0.64×hullL（≈4.74m，**2026-09-25 勘误**：旧写 0.595×hullL≈4.4m）：若实机觉得车体太短/太长，调 `spec.hullL` 即可（**一行数据**，建模端自动跟随；调完跑 `_naval-model-selfcheck` 看桨叶净空红线）。
- LVT 整车长 +11.1% 全部来自艉架/桨/舵（车体严格 = hullL）；若越界敏感可收 `NM_PROP_AFT`/`NM_RUD_AFT`，代价是桨叶净空余量。

### 回归基线（本批实测）

`_fkey-selfcheck` 16/16（含阴性对照）· `_naval-model-selfcheck` 87/87 · `_naval-selfcheck` 80/80 ·
`verify-seabatch` 8/8 · `verify-spec` 56/56 · `verify-specthird` 58/58 · `verify-naval` 9/9（2 条真浏览器档跳过）·
`verify-boot` 12/12 · `verify-layouts` ALL PASS · `verify-buildings` PASS · `verify-zfight` 44/44 ·
`verify-strongpoint` 50/50 · `verify-watchtower`/`verify-wreckleftover`/`verify-uvscale`/`verify-text`/
`verify-menuart`/`verify-svgtex`/`verify-menucards` 全通过。版本戳 `20260921b → 20260922a`。

---

## 一.16 本轮修复（用户二报）：窗下材质不一致 / 跳墙判定收尾 + index.html 编码事故抢修（2026-09-20c/d 窗下材质·跳墙判定批，已实现，待实机验收）

### 起因（用户实机二报 + 追加反馈）

> 仍是系统性问题：窗户下面的部分和总体材质总是不同，且碰撞也有严重BUG，会造成无法跳墙，更加诡异的穿墙等BUG。
> （追加）刷新后开始界面变成这个逼样了。（附截图：菜单/战斗界面中文全乱码 + 左上小地图黑块）

### 根因

| # | 现象 | 真因 | 位置 |
|---|---|---|---|
| ① | 窗下材质与整面墙不一致 | **`BoxGeometry` 六个面的 UV 恒为 0..1"铺满整面"** ⇒ 贴图密度 = 面世界尺寸 ÷ 贴图覆盖，随构件尺寸漂移。`wallSeg` 把一面墙按开洞切成"整段墙板 / 窗台段(`[c0,c1,y0,b]`，窗下那截) / 门楣段 / 墙垛"，同一面砖墙上 3.8m 整段墙板的砖≈0.31m、1.4m 窗台段的砖只有 0.11m、0.9m 墙垛 0.07m（同材质密度跨度实测：岛上 47×、诺曼底 166×、最大 1314×） | js/02-scene（贴图/材质）+ js/05-world（建网格） |
| ② | "无法跳墙"（第二真因） | 上一批把斜置链走向修正后，大截面贴片改用"0.68s 格心距 + 0.32s 端内缩"：缺口虽为 0，但**法向外溢 0.44~0.60m** —— 斜置楼板/屋盖四周一圈隐形台阶，玩家贴墙起跳被挡在外面 | js/05-world `solidBox` |
| ③ | 刷新后界面全乱（**自伤事故**） | 改版本戳时误用 Windows PowerShell 5.1 的 `Get-Content -Raw` + `Set-Content -Encoding UTF8`：按系统 ANSI(936) 读 UTF-8、再以带 BOM 的 UTF-8 写回 ⇒ ①全文中文变乱码 ②271 个字符被 `?` 吃掉 ③**10 处 `</div>` 的左尖括号被当成汉字后半字节吞掉** ⇒ DOM 错位 9 个未闭合 div（菜单期 HUD 不隐藏、小地图黑块） | index.html |

### 实现要点

1. **世界空间盒面投影（贴图密度归一）**：新增 `00-config UV_DENSITY`（每材质登记"一张贴图覆盖的世界边长 S"，米，各向同性）+ `02-scene` 挂 `MAT.*.uvRef` + `05-world uvGeo/scaleBoxUV`（在 `mesh()` 里生效）—— 按 `(尺寸,S)` **克隆缓存**几何，令每面 `UV 跨度 = 该面世界尺寸 / S`（面序 px,nx=(d,h) / py,ny=(w,d) / pz,nz=(w,h)），**不动 `boxGeo` 的跨材质共享基准几何**；`05a/05b/05c/15b` 四处 `new THREE.Mesh(boxGeo(...))` 直建点补包 `uvGeo`。S 取"该材质面积占比最大构件的旧观感"（brick/plaster 1.8、stone/wood/woodDark 2.0、sandbag 1.33、metal/metalDark 1.2、roof 3.0、hay 1.1、rubble 0.8）⇒ 典型大件观感不变、小件自动对齐。口径边界：绿篱 `TEX.hedge`（明确"六面各映射整图"）不登记；玻璃/铝/车体/雪盖无贴图材质不受影响；**圆柱/锥的环绕 UV 保持原样**（环绕+端面混合坐标，归一化会破坏端面）。
2. **大截面贴片改"贴边主格 + 四角补角"**：`s2=clamp(0.9×短边,0.34,1.6)`、格心距 `0.62s2`（<1/√2 ⇒ 任意倾角相邻格必重叠）、主格贴边铺（`ins=s2/2`）+ 4 个 `0.6s2` 角格（角格外溢仅 0.124·s2）；细长件块径改 `short×((长/短)<1.4?1.15:1.0)`。
3. **index.html 抢修**：GBK 反编码还原原始字节 → 用 `git show HEAD:index.html` 逐行修"ASCII 骨架仍是 HEAD 子序列"的行（55）→ 用 `00b-i18n.js` 中文键对齐（10）→ 剩余按上下文显式映射（29）→ 补回 10 处缺失左尖括号 → 按**原始字节文件的逐行 div 深度剖面**核对（94 行差异全消、0 处剖面不一致、末尾深度 0）。版本戳升 `?v=20260920d`；§七 工作流加警示：改版本戳禁用 PowerShell 文本管道，改用编辑器或 Node `fs`。

### 验收清单（请逐项试并截图反馈）

- [ ] **① 窗下材质**：进砖房/石房，对着**窗户**看：窗台段（窗下那截）、门楣段、两侧墙垛与整段墙板的**砖块大小/密度应完全一致**（不再"窗下像另一种材料"）；顺带看木屋/沙袋墙/屋面板是否也自洽。
- [ ] **② 跳墙**：找矮墙（≈1.0~1.3m）、窗台、沙袋墙、栈桥边沿：贴墙起跳应能站上去，墙边不应有看不见的阻挡；2.3m 以上的高墙跳不上去属正常（跳跃上限 1.34m）。
- [ ] **③ 界面**：Ctrl+F5 后菜单/战斗 HUD 中文正常、左上小地图正常显示（不再是黑块）；版本戳 `?v=20260920d`。

### 已知遗留（本批未动）

- `dev/probe-metro.js` 3 红（与 §一.15 同一条，本批之前既有）。
- `dev/probe-factory.js` ⑥"Bot 部署上车"偶发红、`dev/probe-bots.js` 单图偶发红：**多次重跑复现为随机波动**（本批改动只动几何 UV 属性，与 AI/物理无关），留作下一批排查。
- 圆柱/锥（树干/管/柱）的贴图密度未归一：环绕+端面混合 UV，归一化会破坏端面，故本批只归一盒面（口径已写进 README §五）。

---

## 一.15 本轮修复（三桩系统性实机问题）：建筑判定同源 / 建筑地基平台 / 海岛地图四角（2026-09-20 建筑判定·地基平台批，已实现，待实机验收）

### 起因（用户实机三报 + 留言）

> ① 如图所示，海岛地图的四个角地域没有地图，请修复。
> ② 系统性问题：现在许多建筑都有模型和实际判定不一样的问题（主要是那些不可破坏的建筑），会导致莫名其妙掉下楼、穿墙等严重BUG，需要修复。
> ③ 系统性问题2：如图2所示，许多建立在斜坡上的建筑没有地板，导致进门就是大凹坑、楼梯台阶失效等严重问题，请修复。
> 我要去睡觉了，请自行完成任务，有问题就在项目里寻找答案吧。

### 根因（三条各自独立，均在沙箱里做了取证/对照）

| # | 现象 | 真因 | 位置 |
|---|---|---|---|
| ② | 斜置建筑"掉下楼 / 穿墙" | `solidBox` 斜置分支的长轴世界方向写错一个符号：`w>=d?cs:-sn` 在 `d>w`（长边沿本地 Z）时给出 `(-sn,cs)` = 本地 +Z 关于 X 轴的**镜像**（差 90°+）⇒ 碰撞小块链整条铺在**垂直**方向上：墙本身几乎无碰撞、站立面消失、墙两侧空中留幻影碰撞盒 | js/05-world.js `solidBox` |
| ② | 斜置楼板/平台边缘"踩空" | 大截面件按 `0.92s` 铺贴片且止于 ±(半长-s/2)：轴对齐方块铺斜置矩形须格心距 ≤ s/√2，且网格要盖住四角 —— 旧法四角留 0.3~0.5m 无碰撞、格心留 ~0.14s 洞 | 同上 |
| ③ | 坡地建筑"进门就是大凹坑、楼梯台阶失效" | 楼面=`hMax+0.06` 而**室内地面=原地形**：坡地建筑室内天然是个深达 `hMax-hMin` 的坑（实测最深 2.5m），楼梯梯脚落在坑底、门台阶常超 3 级封顶失效 | `foundation` + 03-terrain 地形 |
| ① | 海岛地图四角没有地图 | 海面色带按四支岸线的**法向偏移**铺，折线端点之外（=图幅四角）没有任何多边形覆盖 ⇒ 大地图/小地图/部署图/主菜单沙盘四角露背景色 | js/22-hud `drawSeaBands` + 00-config |

### 实现要点（口径全部写进 README §五）

1. **碰撞同源**：`solidBox` 斜置长轴改 `w>=d?cs:sn`；大截面件（`short*1.15>1.55`）先走 gap-free 档（步距 0.68s + 端内缩 0.32s 补角），薄条保持 0.92s 内缩链（控碰撞盒数量，全库 +3.4%）。**注：大截面档在本批之后被 §一.16 改为"贴边主格 + 四角补角"（gap-free 档法向外溢 0.44~0.60m 会形成隐形台阶，是"无法跳墙"的第二真因）**。
2. **建筑地基平台**：`foundation()` 在高差 >0.5m 时登记**定向矩形硬平台**（03-terrain `PADS/addPad/padHeight`）—— 矩形内地面恒等于楼面（多矩形重叠时**足迹权威**：归最近的那个平台，邻建裙坡不得越界），矩形外 ramp 米 `smoothstep` 回落地形；0.5m 以下不动地形（玩家一步迈过，不值得牵动紧邻道具/铁路）。地形网格由 `refreshTerrainMesh()` 在 `buildWorld` 末尾重刷，`addPad` 置 `HGRID.data=null` 使高度修正带失效。
3. **檐口碰撞带**：`pitchedRoof` 碰撞带长由 `ridgeLen`(含出檐) 改 `wallLen`(墙体足迹) —— 檐口是装饰，墙外不该有隐形盒（教堂檐口曾伸进钟塔 0.45m 压住楼梯净空）。
4. **HUD 四角**：新增 `00-config seaCoastRing()`（四支岸线接成岛屿闭合环，容差 3m，接不成环 → null 回退旧画法）；`drawSeaBands` 改为**整幅先铺深海底板**（地图矩形 ⊕ 岛屿环，偶奇填充）+ 礁缘/礁盘带；四图与主菜单沙盘共读。
5. **红十月平板车**：`groundFit` 增 `max`，车皮坐轨面最高处（均值会让一端埋进轨面）。

### 验收清单（请逐项试并截图反馈）

- [ ] **① 海岛地图**：按 M 打开大地图 / 部署界面部署图 / 左上小地图 —— 图幅**四个角**都应是深蓝海面（不再是背景色）；岛内陆地不得被涂成海。
- [ ] **② 建筑判定**：找几栋**斜着摆**的房子（诺曼底/滇缅/海岛等野外图最常见）：绕墙一圈不应穿墙；上二楼/屋顶/瞭望台/栈桥，站在楼板**边缘与四角**不应掉下去；墙边不应有看不见的阻挡。
- [ ] **③ 坡地建筑**：海岛（hangar/logCabin/椰木掩体）、百团（窑洞/村舍）、柏林/莫斯科（街区）—— 进门应是平的（不再是坑）、楼梯从地面起第一级就正常、门台阶不再出现"半人高的台阶"。
- [ ] 顺带看：建筑周围地面出现**平整的场地 + 缓坡裙边**（这是地基平台的正常外观）；紧邻的路/道具位置若有位移请截图反馈。

### 已知遗留（本批未动）

- `dev/probe-metro.js` 柏林地铁"Bot 地下穿行"3 项红：**本批之前就存在**（已用"关平台 + 还原 solidBox 旧式"两侧对照确认与本批无关，疑与 2026-09-20 Bot 导航翻新批的 NAV 改动有关），留作下一批处理。
- 室内残留 0.25~0.47m 的天然不平（未达 0.5m 门槛不削平）：玩家一步迈过，观感为"土地面略有起伏"。

---

## 一.14 本轮特性：观战模式扩展（连狙 / 弃弹传送 / 观战专属幽灵坦克 / 坦克炮弹增大）（2026-09-17 观战扩展批，已实现，待实机验收）

### 起因（用户指示，四项 + 一条补充）

> ① 把观战模式下副武器换成一把连狙（能开镜，高射速）；
> ② 观战模式下在操控巡飞弹的时候，按下 T 键可以让巡飞弹立马消失并让自身传送到巡飞弹的位置；
> ③ 给观战模式下增加一个独有的载具：全白色材质，不受到索敌和伤害，子弹、炮弹等会穿过去，可以开火对双方造成伤害；
> ④ 稍作增大坦克炮弹的体积和判定。
> 补充（讨论中提出）：观战的**两种飞行状态**下按左键也要能开火。

### 定案（逐条询问后由用户拍板，原始选项见对话）

| 项 | 用户裁定 |
|---|---|
| 连狙数值 | **全自动**（2026-09-17 二改：原半自动 → 全自动）· 300 发/分 · 单发 75 · 20 发弹匣 · **后坐力压低**（recoil 1.8→1.0 / recSide 0.42→0.24 / kick 0.09→0.05）；通用名「观战连狙」（非史实兵器），复用春田狙击模型（可开镜 4x） |
| 换装时机 | **即时生效 + 下次部署也生效**（兵种卡二次点击开关观战即换槽换模型） |
| T 键传送后状态 | **方案 A**：位置传送 + 速度清零，保持当时的飞行/行走状态，y 抬到地面以上并做一次碰撞挤推，视角朝向不变；**补充**：两种飞行状态下左键都能开火 |
| 幽灵载具机动 | **地面坦克式**（W/S 前后 · A/D 转向 · 鼠标炮塔 · 左键主炮 · 右键机枪 · C 车长镜 · F 下车） |
| 幽灵载具获取 | **两者都要**：部署界面「观战载具」出生项（仅观战显示、不占载具冷却）+ 走到车旁按 F 上车。**2026-09-17 二改（用户实报"开始时不选幽灵坦克就一整局没有"）**：观战者**每次部署都把车摆到落点旁**（4.5m 内空位，不选那一项也一样），且**任何地方按 F 都能召唤**（附近无车 → 车在身旁显形并直接上车）—— 不再被"开局那一次选择"绑死 |
| 幽灵载具外观 | **白色 + 轻微自发光**（保留车体体块与细节，阴天/逆光下仍是白车） |
| 坦克炮弹增大 | **+0.3m 判定半径**（步兵/载具/结构），视觉拖尾 0.16→0.26 并加亮芯 |

### 实现要点（含两处必须说明的取舍）

| 项 | 实现 |
|---|---|
| 连狙 | `09a-defs.specsniper`（`scoped:true`/`model:'springfield'`）+ `00-config.playerClassWeapons` 观战换装单源（**判据只看 `player.spectator`**：观战开关挂在兵种卡上，但开过之后仍可再点别的兵种卡）+ `23-deploy.applySpectatorLoadout` 即时换装 + `00-config`/`23-deploy` 兵种卡文案同源。观战弹药每 0.5s 回满 ⇒ 连狙天生无限弹、永不换弹 |
| 弃弹传送 | `13-combat.specTeleportToLoiter`（复用 `loiterDespawn` 静默退场）+ `19-input` KeyT 前置分支。**取舍**：T 原本是「小队进攻标记」—— 只在"观战 + 正在操控巡飞弹"时改为传送，其余情况原语义不变 |
| 飞行开火 | `20-player.playerFireTick(dt,canFire)` 单源：射速冷却/弹匣/扳机/空仓换弹从地面分支抽出，地面与**悬停·气动两条飞行分支**共用。**取舍**：引导巡飞弹时左键仍是"手动引爆"（优先级高于开火），机瞄（右键）在飞行中依旧不生效（右键是气动加速） |
| 幽灵坦克 | 新增 `js/15c-specveh.js`：**不进 `tanks`/`trucks`/`combatants` 任何表** —— 全库弹丸与索敌都是遍历这些表，独立类因此**天然**满足"不被索敌 + 弹丸穿透 + 爆炸免疫"；`takeDmg` 空实现=免伤；不调 `vehiclePushSoldiers`=人车互穿；开火走既有管线但**炮弹 `team=-1`**（无差别，与巡飞弹同源）+ 驾驶者 `player.ffAll=true`（`raySoldiers`/载具命中的敌我过滤跳过、己方载具击毁照常记分与播报）；开火不产生 `gunEvents`（不惊动 Bot）；行驶复用坦克 `tankRideH/tankSurfH` 底盘姿态单源，**不碾不撞**。获取两条路：部署界面出生项（`id:'G'`）+ 车旁 F；待用位=本方主基地后方 15m；换局/世界还原由 `retireMatchActors→specVehReset` 收车 |
| 炮弹增大 | `15-vehicles.SHELL_R=0.3` + `vehHitCylR/truckHitCylR` + `13-combat.raySoldiers(o,dir,maxD,shooter,pad)`（第 5 参兼容，子弹与其他调用方不传=原判定）；**反坦克炮/火箭弹（`kind:'at'`）保持原口径**（用户只要求坦克炮弹） |
| 沙箱兼容 | 新模块的所有跨文件调用都带 `typeof` 守卫（`24-main`/`23-deploy`/`20-player`/`22-hud`）—— 既有沙箱/探针各有自己的加载清单，缺这个可选文件不该让主循环、部署界面或交互报错（首轮回归正是被这一条抓出 4 个沙箱红） |

### 二改（2026-09-17 用户实机两条反馈，已实现）

| 反馈 | 修法 |
|---|---|
| 「快速把连狙改成全自动，后坐力降低」 | `09a-defs.specsniper`：`type:'semi' → 'auto'`（按住左键连发）、`mode:'全自动 · 4x'`、后坐力 **recoil 1.8→1.0 / recSide 0.42→0.24 / kick 0.09→0.05**；射速 300 发/分、单发 75、20 发弹匣不变 |
| 「开始时不选幽灵坦克的话一整局都没有了」 | 真因：旧版只在**选**「观战载具」那一项或打开部署界面时把车摆到主基地后方，不选就停在本方基地、观战者飞远了自然再也见不到。修法两条：①**部署必伴随** —— 观战者无论选哪个出生点，部署时都把幽灵坦克摆到**落点旁 4.5m 内空位**（`specVehPlaceNear`）；②**随处召唤** —— 观战者按 F 时若附近 4.5m 内没有车，就地把车召到身旁并直接上车（`specVehSummon`，1 号槽提示相应改成「F 召唤幽灵坦克」）。「观战载具」出生项保留（选它=部署即上车） |

**二改验证**：`dev/verify-spec.js` 扩到 **56 断言 0 失败**（T1 增补"全自动 + 后坐力压低"断言 · **T9 新增：部署必伴随（4.5m）+ 远地 F 召唤（0m，直接上车）**）；复跑关键回归 verify-wipe 81/0 · verify-boot 11/11 · verify-returntomenu 13 组 · verify-records 11 组 · verify-worldrestore 10 组 全绿；改动文件 `node --check` 通过。版本戳不变（`?v=20260917c`，改动仅 JS 与文档）。

### 实机验收清单（请逐项试并截图反馈）

1. **连狙**：实验模式下开局 → 兵种卡点两次「巡飞弹兵」开观战 → 卡片武器行应显示「巡飞弹发射器 · 观战连狙」；按 **2** 切副武器，**右键开镜**应出 4x 镜片、**按住左键连发**（5 发/秒，后坐力明显比春田小），身体两枪死、爆头一枪死；
2. **即时换装**：战斗中（活着时按 Esc 打开部署界面）在兵种卡上关掉/打开观战 → 手里若正握着副武器，应立即换成手枪/连狙（弹匣读数与模型同步）；
3. **飞行开火**：观战中双击空格悬停、或按 H 气动飞行，**左键应能开枪**（枪口火光/弹道/后坐正常）；RMB 在气动飞行下仍是加速；
4. **T 键弃弹传送**：观战 → 左键发射巡飞弹 → 弹体飞远（或飞到你想要的位置）→ 按 **T**：弹体应**无声无爆**地消失、TV 视角收回、你本人出现在弹体那一位置；**速度清零**（不会顺着弹道冲出去）、保持飞行或行走状态；
5. **T 键未控弹时**：观战但不操控巡飞弹时按 T，应仍是**小队进攻标记**（原功能未被吃掉）；
6. **幽灵坦克·获取（二改后）**：观战模式下**不管出生点选哪**，落地后白车都应就在身旁（约 4~5m）；飞走之后再按 **F** 应直接把车**召唤到脚下并上车**（不再需要回基地）；部署界面「▣ 幽灵坦克 · 观战载具」出生项仍在（选它=部署即上车）；
7. **幽灵坦克·外观与免疫**：车体应为**全白**（无迷彩、不投影）、有明显体块；让它停在敌人面前——**Bot/坦克/飞机都不应理它**，子弹炮弹火箭弹手雷**全部穿过去**（车内视角看不到任何被击中的反馈）；
8. **幽灵坦克·双方伤害**：用主炮/机枪打**敌方**与**己方**单位都应造成伤害并能击毁（己方坦克被击毁时也应有击杀播报）；**注意**：本车撞不塌墙也碾不毁掩体（只被建筑挡住），也不触发反坦克雷；
9. **坦克炮弹增大**：开坦克对远处步兵/车辆射击，**擦边命中应明显变多**（判定 +0.3m），弹道拖尾比从前更粗更亮；**反坦克炮/火箭筒手感应与从前一致**；
10. **不影响常态**：不开观战时，副武器仍是原来的手枪/火箭筒；观战局照旧**不进历史记录**（结算页那句提示仍在）。

---

## 一.13 本轮修复（P0）：结算 / 回主界面「停止一切音效」（2026-09-17 音效停止批，已实现，待实机验收）

### 起因（用户实报）

> 「结算后回到主页面，游戏结算时的音效没有停止！结算和返回主页面时应当停止一切音效。」

### 根因（两条，沙箱里做了两侧对照验证）

| 项 | 定案 |
|---|---|
| 根因①（结算静音不彻底） | `endMatch()` 只调 `setAmbientMute(true)` —— 它只压**环境层（风/雨）+ 引擎增益**：已排程的尾音照响，**定时器里排队的来源**也照响（雷暴远雷就是真实来源：`updateWeather` 里 `setTimeout(()=>AudioSys.explosion(dd*0.8), dd*2.6)` 的落点常在结算之后）；环境层的两个 `setInterval`（远处机枪对射 / 鸟鸣）只认 `gamePaused\|matchOver`，边界脆 |
| 根因②（回主界面反而解锁）★ | `returnToMenu()` 里一句 `setAmbientMute(false)`（原意"解除暂停静音"）把坦克/飞机引擎增益**还原成上一帧的音量** —— 而菜单期主循环冻结、引擎再不会更新，于是这条引擎声永远停不下来：**用户听到的"结算时的音效没停"主因就在这里**（结算时刚静音，回主界面又被解锁） |
| 顺带发现的隐患 | `createEngine().stop()` 旧实现只把增益压到 0 并保留 `nodes` —— "停过"的引擎再 `update()` 只会去改**已停振荡器**的频率，之后永远发不出声（本批置空 nodes 让下次 update 重建） |

### 实现要点（01-audio 新增静默闸门 + 生命周期接线）

| 项 | 说明 |
|---|---|
| 静默闸门 | 音频链改为 `comp → kill(新增增益节点) → master → destination`；`stopAll()` 把闸门 20ms 斜降到 0.0001（免爆音），`restoreAll()` 60ms 斜升回 1。**闸门一关，所有正在发声的节点（含已排程的尾音）立即听不见** |
| 挂起发声入口 | 返回的 API 统一过闸：静默期里 14 个发声入口（gunshot/explosion/click/cannon/…）一律空转 —— **定时器来源被同一道闸拦住**；`distantMG()/bird()` 另加 `silenced` 早退。控制面不过闸（`init/resume/setVol/setAmbientMute/stopAll/restoreAll/isSilenced/audioDebug`），`createEngine` 也不过闸（载具绝不能拿到 `undefined`；它的静默由引擎自身 `update` 处理） |
| 持续声源 | `stopAll()` 遍历引擎表逐个 `stop()`：增益归零 + 振荡器真停 + **nodes 置空**（下次 `update` 重建，修掉"停过就永远哑"） |
| 环境层 | `stopAll()` 把风/雨层增益压 0 并 `cancelScheduledValues`；`restoreAll()` 回各自基准。`setAmbientMute(m)` 改为 `mute = m \|\| silenced` —— **静默期里任何 `setAmbientMute(false)` 都不许解锁**（旧版那条漏法就此封死） |
| 调用点（严格对称） | **进静默**：`endMatch()`（结算冻结点）与 `returnToMenu()`（回主界面，旧版的 `setAmbientMute(false)` 就地删除）；**解除静默**：`resumeBattle()`（继续游戏回战局）与 `startGame()`（开新局/首局） |
| 诊断 | 新增只读视图 `audioDebug()` = `{inited, silenced, gate, engines, ambients}`：实机在控制台敲 `AudioSys.audioDebug()` 即可看出"闸门是否闭合、还有几个引擎在管" |
| 验证 | 新增 `dev/verify-audio-mute.js`（**10 组 0 失败**；AudioContext 桩带声源计数与增益记值，"还响不响"是可断言的）：T3 结算后 14 个入口全部 0 新声源 · **T4/T5 定时器来源两面对照**（未静默时同一来源确实发声：远雷 2 个声源 / 环境定时器 80 次触发 236 个声源；静默期均为 0）· **T6 回归对照**（静默期 `setAmbientMute(false)` 不许解锁）· **T7 用户原话路径**（结算 → 返回主页面 = 静默且无在管引擎）· T8 回战局/开新局解静默且引擎可重建发声 · T9 暂停静音互不干扰 · T10 控制面不被闸掉 |

### 实机验收清单（请逐项试并截图反馈）

1. **★ 核心场景（用户原话）**：打到结算（胜/负/平均可）→ 结算页出现那一刻，**枪炮声/引擎声/环境风声应立刻消失**；随后 1~2 秒内不应再冒出雷声或远处机枪声；
2. **★ 回主界面**：从结算页点「返 回 主 界 面」→ 主菜单里**完全安静**（不应有引擎轰鸣/风声/鸟鸣/枪声残留）；
3. 换一张有雨/雷暴的图（斯大林格勒/柏林）复测第 1、2 条 —— 雨声与远雷同样应立即停止；
4. **★ 继续游戏仍有声音**：战斗中按 Esc →「返 回 主 界 面」→ 主菜单安静 → 点「继 续 游 戏」回到战局后，枪声/引擎/环境声应正常回来；
5. **开新局仍有声音**：结算 → 回主菜单 →「新 游 戏」→「开 始 新 游 戏」→ 新一局声音正常（不能因为上一步静音了就整局没声）；
6. 暂停（Esc）仍与从前一致：暂停时环境/引擎静音、继续后恢复（暂停面板不套用静默期 —— 那是战斗内的暂停，不在本次口径内）；
7. 在结算页停留 10 秒再返回主菜单：这 10 秒内不应有任何声音；
8. 驾驶载具/观战后结算（引擎声最大的场景）→ 结算页与主菜单都应立刻安静（旧版最容易残留的一种）。

---

## 一.12 本轮修复（P0）：世界还原 —— 结算后回主菜单/同图重开都是"被摧残过的地图"（2026-09-17 世界还原批，已实现，待实机验收）

### 起因（用户实报 + 截图）

> 「仍存在巨大BUG，打完结算之后主界面的航拍图是经过摧残后的（你看，没有该有的农田和树篱、可摧毁的墙等），甚至还有场上剩余的人！再进入同一地图也是地物全都被摧残后的。」

### 根因（2026-09-16「就地重开」批次如实记下的"代价"到期兑现；沙箱复现定位，非猜测）

| 项 | 定案 |
|---|---|
| 根因①（世界被复用） | 就地重开只做"对局实体退场"（`retireMatchActors`），**世界本身始终是同一份**：`DESTRUCTIBLES` 的坍塌、被 `killBox` 推死（`dead` + AABB 置 99999）的碰撞盒、树篱/灌木/庄稼的 `dead` 与实例矩阵零缩放、火焰网格烧掉的燃料、运行期弹坑/工事/残骸 —— 全部留在场上。主菜单那圈航拍飞的正是这个世界 → **农田/树篱/可毁墙全没了** |
| 根因②（人还在） | 结算只是**冻结主循环**，不清场：Bot/坦克/飞机/卡车/布娃娃仍站在场上，`menuHold` 冻结后主菜单航拍就从他们头顶飞过。另外 `combatants`（"玩家 + 全部 Bot"的混编表）在 `retireMatchActors` 里**从未清空** —— 上一局的 Bot 会永久留在记分板等一切按 `combatants` 遍历的系统里 |
| 为什么以前没暴露 | 以前换图/重开靠**整页重载**（世界与全局态全部重建）；2026-09-16 改成就地重开后世界不再重建 —— 该批次已把这条代价写进 PLAN（"若实机觉得碍眼，再议是否把世界也一并重建"），本批就是兑现它 |

### 实现要点（新增 `js/23b-worldrestore.js`：开局快照 + 就地还原）

| 项 | 说明 |
|---|---|
| 快照时机 | 24-main 启动末尾（`initMenuUI()` 之前、主循环尚未开始）调 `capturePristineWorld()` —— 此刻世界已构建完毕（`buildWorld` 在脚本载入期执行完）、还没有任何一局开过。`ready=true` 后**不再覆盖**（重复调用是空操作：打烂之后重拍会把废墟当基线，沙箱 T2 把这条钉住） |
| 快照内容（逐项对应破坏入口） | ① **场景台账**：`world.children` / `scene.children` 列表本身（本局新增的一切都不在快照里 → 还原即摘除）；② **静态碰撞**：`BOXES`（dead + AABB）与 `CYLS`（dead/r/y1）；③ **可毁结构**：`DESTRUCTIBLES` 逐组 dead/hp + 屋顶坍塌链（从各组 `roofRef` 反查，不需新增登记表）done/dead；④ **植被**：`FLORA_HASH` 逐株状态（烧毁/倒伏/焦黑/碾碎/沉入）+ 各株网格 y（沉入动画会把网格推下地）+ 树木/灌木/草丛/庄稼实例批的 `instanceMatrix`/`instanceColor`；⑤ **火焰**：`FUEL` 燃料（FHEAT/FBURN/FEXPIRE/FATT 开局全零，还原整体清零）；⑥ **占位与登记表**：`PROPS`/`coverPoints`/`wires`/`MG42S`/`runtimeCraters`/`CROP_FIELDS`；⑦ **旗面归属**（旗色贴图 + 旗布顶点） |
| 还原做法 | `restorePristineWorld()` = 清运行期特效（粒子/拖痕/弹壳/烟/血贴片/布娃娃/碎块/在途弹/在途炮击/沉入任务；池化对象**连池一起丢弃**，否则复用会拿到"已被摘出场景"的精灵）+ `retireMatchActors()`（上一局实体与机制，旧路径原样复用）+ 场景台账整段复位（不在快照里的全摘除、快照里的按原序挂回）+ 上表逐项写回 |
| 不拍快照的两类 | ① **占用网格 `OCC` 与寻路 `NAV`**：还原后调 `NAV.refresh()` 按还原后的 `BOXES`/`CYLS`/`wires` **全量重建**（`buildOccupancy` 本就是全量重建，顺带抹掉火焰占用格与工程兵工事占用格 —— 比存一份 OCC 副本更可靠）；② **纯运行期特效**：直接清表，网格交给台账摘除 |
| 调用点（三处，判据明确） | ① `beginFreshMatch()`：就地开新一局前还原 → **新一局拿到干净世界**（对应"再进入同一地图也是被摧残后的"）；② `returnToMenu()` **仅在 `matchOver` 时**还原 → **结算后回主菜单看到的是干净地图**（对应"打完结算之后主界面的航拍图"）；③ 战局未结束（`menuHold`，还能从主菜单继续）**刻意不还原** —— 那一刻的背景就是"冻结的战场"本身，还原等于抹掉战局（沙箱 T10 阴性对照） |
| 顺带修 | `retireMatchActors()` 补清 `combatants`（保留玩家）—— 只增不减的老缺陷，上一局 Bot 会永久留在记分板/按 combatants 遍历的系统里（用户"场上还有上一局的人"的观感里就有它一份） |
| 旗高的特殊处理 | 旗高是**每帧向目标阻尼的动画量**（菜单待机期间一直在动），故复位写**目标位**（中立 = `gy+3.2`，与 `updateFlags` 同式）而不是快照读数 —— 得到一个稳定可比的复位状态；旗布顶点则逐元素写回 `flagBase` |
| 代价（如实记录） | 一次还原 = 台账 O(n) 重排 + 碰撞/植被写回 + `NAV.refresh()`（寻路网格重建，平时战斗中也在跑）；快照内存 < 2MB 量级（实例矩阵副本为主）。未做耗时实测，实机若感到卡顿可再议"只还原可见区域" |
| 验证 | 新增 `dev/verify-worldrestore.js`（**10 组 0 失败**）：T1 快照非空+边界 / T2 重复拍快照不覆盖（防"把废墟当基线"）/ **T3 破坏确实发生（敏感度对照：台账/碰撞盒/植被/燃料/占位/特效全部偏离基线）** / **T4 逐项还原（含 OCC 校验和、实例矩阵、旗面）** / **T5 视觉复位（可毁结构网格回挂、无"未毁却丢网格"、实例矩阵逐元素相等）** / **T6 场景无残留（人/尸体/残骸/粒子/在途弹清零，scene 台账项数复位）** / T7 幂等 / **T9 结算后回主菜单=干净地图（用户原话路径）** / **T10 冻结战局不还原（阴性对照）** / T11 就地重开单位数不累加（35→35） |

### 实机验收清单（请逐项试并截图反馈）

1. **★ 核心场景（用户原话）**：正常打完一局（胜/负/平均可）→ 结算页点「返 回 主 界 面」→ 主菜单背景航拍应是**完好的地图**：农田（麦田/玉米田成片）、树篱连成线、可毁的砖墙/木屋都在；**不该出现**上一局打出的弹坑、焦土、废墟、残骸；
2. **★ 人清干净**：同一时刻场上**不应有人**（活人/尸体/布娃娃都不该看到）、不应有坦克/飞机/卡车停在地图上 —— 只有地图本身与旗杆（旗面开局中立色）；
3. **★ 同图重开**：主菜单 →「新 游 戏」→ 不换地图 →「开 始 新 游 戏」→ 新一局的战场应是**干净地图**（上一局的坍塌墙体、被碾的树篱、烧掉的麦田、弹坑都不该带过来）；
4. 连打 3 局同一张图：每局开局都是干净地图（不是"第一局干净、第二局开始残破"）；
5. 征服图/攻防图各试一次（旗面归属与旗色应回开局态势：中立旗是灰白旗面，不该留着上一局的队伍旗色）；
6. 破袭战（百团大战）专项：炸掉补给库 → 结算 → 回主菜单 → 再开一局，**补给库完好**（该图验收入口，与 2026-09-16 批次同项）；
7. **★ 冻结战局不受影响**：战斗中（或兵种选择阶段）点「返 回 主 界 面」→ 主菜单背景应仍是**冻结的战场**（该残破就残破：这一局还要接着打），点「继 续 游 戏」能回到原战局继续打；
8. 性能体感：结算 → 回主菜单、以及「开 始 新 游 戏」的瞬间，不应有明显卡顿（可在同一会话连开 4~5 局比较）；
9. 底部边界：结算后回主菜单**再点「继 续 游 戏」应仍是灰的**（战局已结束，不该因为世界被还原而多出一个可继续的入口）。

---

## 一.11 本轮特性：结算全项历史纪录 + 观战不计入 + 主菜单「战绩数据」（2026-09-16 记录批，已实现，待实机验收）

### 起因（用户指示，四项）

> 「对结算的全部数据都加一个新纪录的功能（死亡数这种越低越好），观战模式应当正常计分，但明确写不计入历史记录。
> 主界面增加一个查看数据的按钮，点进去查看各个地图的历史最佳成绩。
> 另外把"新游戏"按钮移到"继续游戏"上边。」

### 定案（用户休息留言"有问题就在项目里寻找答案吧" → 按项目先例自动定案，逐条记此）

| 项 | 定案 |
|---|---|
| 纪录项 | **七项全记**：得分 + 击杀数/阵亡数/K·D 比/最大连杀/爆头数/占领点 六张战绩卡 —— 每张卡多一行"本图最高/最少 N"，破纪录时整卡描金 + 「新纪录!」徽章；得分卡原有的「本图最高 + 新纪录」保留（读数改走新存档） |
| 越低越好 | 方向登记在 00-config `REC_STATS` 的 `lower` 字段：**阵亡数 `lower:true`** —— 判定取更小值，最佳文案翻转成「本图最少 N」；数据面板表头带 **↓** 标注，底部注脚写明"箭头 ↓ = 该项越少越好" |
| 首战即纪录 | 该项此前没有记录时本局值直接成为纪录（第一次打这张图 = 立纪录，同样打徽章）；**`0` 是合法记录值**（一枪未发就阵亡的 0 杀也是纪录），"无记录"一律用 `undefined` 判定，不用 0 |
| 存档 | 新键 `sf_rec_<战役id>` = JSON `{v,plays,score,+六项}`；`plays` = 计入历史的对局数（面板显示"已战 N 局"）。旧键 `sf_best_<战役id>`（2026-09-13 批次的最高分）**只读兼容**：新键缺失时把它读成 score 纪录（其余项留空、plays 记 1），该图首次结算即迁入新结构（旧键保留不删） |
| 观战模式 | **照常计分**（结算页数值/胜负/角标与平时一模一样），但**本局不进历史记录**：不落盘、不打任何徽章、最佳行显示存档原值，并在结算页得分卡下方明写「观战模式 · 本局不计入历史记录」（数据面板底部同义注一行）。判据是**粘性标记** `player.specUsed`（本局开过观战）而非结算瞬间的 `player.spectator` —— 中途开过观战再关掉，那一局同样不算数（观战免伤·不被索敌·弹药无限） |
| 数据面板 | 主菜单新增「战 绩 数 据」按钮（`data-p="mData"`），面板「历 史 战 绩」= 一张 8 列表：地图 + 得分 + 六项纪录；每行带模式与"已战 N 局"（无记录 = 「未 征 战」+ 数值格 `—`），**每次打开重算**（同一会话内就地重开的对局会改写存档） |
| 按钮顺序 | 首页五按钮：**「新 游 戏」(最上) / 「继 续 游 戏」/ 「战 绩 数 据」/ 「游 戏 设 置」/ 「游 戏 说 明」**（新游戏移到继续游戏上方） |
| 顺带修 | `resetPlayerForNewMatch()` 补 `kills/deaths/score/headKills/caps/lifeKills/lifeScoreStart` 复位 —— 这些计数此前只在 PLAYER 初始化时置零，2026-09-16「就地重开」批次之后，同一会话第二局会把上一局的击杀/得分/阵亡累加（旧版结算页"本局得分"同样被污染，只是没人发现）；改成"比纪录"之后这是硬伤，故随本批修掉 |

### 实现要点

| 项 | 说明 |
|---|---|
| 单源 | 战绩项表 `REC_STATS`（00-config）= 结算卡标签 / 记录字段 / 面板列 三处共读：**加一项战绩只改这张表**；每项自带 `lower`（方向）与 `fmt`（显示格式，本局值与纪录值共用，保证两处显示一致） |
| 落盘时机 | `recCommit()` 在 `endMatch()` 里**立即**执行（不等 0.9s 的结算画面）：结算画面那段时间关页/返回/直接开新局都不丢记录；画面只消费它的返回值 |
| 结算页 | `recStatCardsHTML(R)` 出六张卡（值 + 标签 + 最佳行 + 徽章），得分卡走 `recBestText(null,best.score)`；观战局另有 `#endSpecNote` 提示（`hidden` 由 `REC.counted` 驱动） |
| 存档容错 | 非 JSON / 数组 / `null` / 字符串字段一律按"无记录"处理（`recKnown` 只认表里登记的键 + 有限数），脏存档不会把结算页拖崩 |
| 数据面板 | `recPanelHTML()`（21-match 出 HTML，持有 REC_STATS 与存档读数）+ 22-hud `showPanel('mData')` → `renderRecordsPanel()` 落 DOM；`#recWrap` 限高滚动 + `.recGrid` 最小宽 660px 横向滚动（11 图 × 8 列） |
| 双语 | 新增词条：`战 绩 数 据`/`历 史 战 绩`/`各图历史最佳成绩`/`本图最少 {0}`/`本图暂无记录`/`地图`/`已战 {0} 局`/`未 征 战`/`观战模式 · 本局不计入历史记录` + 面板注脚 |
| 验证 | 新增 `dev/verify-records.js`（11 组用例全绿）：首战即纪录 / 逐项比对（含阵亡越低越好）/ K/D 口径 / 观战不计入（含粘性标记的真实路径=兵种卡二次点击）/ 旧键迁移 / 脏存档容错 / 本局计数复位 / 面板读数与刷新 / 主菜单静态结构 |

### 实机验收清单（请逐项试并截图反馈）

1. 主菜单首页五个按钮，**最上面是「新 游 戏」**，下面依次「继 续 游 戏」/「战 绩 数 据」/「游 戏 设 置」/「游 戏 说 明」；「继续游戏」无战局时仍是灰的、位置不动；
2. 点「战 绩 数 据」→ 面板「历 史 战 绩」：11 张图各一行，没打过的显示「未 征 战」+ 数值格 `—`；底部注脚写「箭头 ↓ = 该项越少越好 · 观战模式的对局不计入历史记录」；
3. **★ 核心场景**：打一局到结算页 → 六张战绩卡**每张下面**都应有「本图最高 N」（阵亡卡是「本图最少 N」）；首次打这张图时六张卡 + 得分卡应**全部**带「新纪录!」徽章（首战即立纪录）→ 回主菜单 →「战绩数据」→ 该图行应显示这一局的纪录与「已战 1 局」；
4. **★ 破纪录判定**：再打一局同图，刻意打得比上一局差（少击杀、多阵亡）→ 结算页**不应**出现任何新纪录徽章，各卡最佳行仍是上一局的值（阵亡卡显示**旧**纪录，如「本图最少 3」）；
5. **★ 阵亡越低越好**：某一局阵亡数比历史最少还少（上局 3 死 → 本局 1 死）→ **只有阵亡卡**亮「新纪录!」并显示「本图最少 1」，其余五项不动；
6. **★ 观战不计入**：实验模式下选巡飞弹兵、再点一次该卡片开观战（卡片出现"· 观战中"）→ 打完一局 → 结算页数值照常（得分/击杀都在），但**没有任何新纪录徽章**，得分卡下方有蓝框一行「观战模式 · 本局不计入历史记录」；回「战绩数据」：该图纪录与「已战 N 局」**没有变化**；
7. 观战中途关掉（再点一次卡片）后打完这一局 → **同样不计入**（本局开过观战即不算数）；
8. **同图连打两局**（结算页回主菜单 → 新游戏 → 再打完）：第二局结算页的「本局得分/击杀/阵亡」应从 0 重新累计（修复前会把两局加在一起）；
9. 旧存档：升级前这张图若已打出过最高分（旧版 `sf_best_*`）→ 首次结算该图时得分卡「本图最高」应**仍是旧纪录**（不被本局低分顶掉），其余六项照常立纪录；
10. 切 English 抽查：首页 RECORDS / 面板 SERVICE RECORDS / 结算页「NEW RECORD!」「Map fewest N」「SPECTATOR MODE · THIS MATCH IS NOT RECORDED」；
11. 面板窄窗口（或把窗口拉窄）：战绩表可横向滚动，不挤成两行。

### 追加（用户插话 2026-09-17）：主菜单背景回到无 UI 航拍动态

> 「我插一句嘴，现在正常胜利后的开始界面是静态的结束前的视角，应当改成正常的无UI航拍地图视角」

| 项 | 定案 |
|---|---|
| 根因 | 主菜单背景本该是开局前那圈无 UI 航拍环绕（20-player `updateCamera` 里 `!p.alive` 那条分支：半径 80 / 高 42 / 注视原点）。但 24-main 的冻结分支（`gamePaused\|\|matchOver\|\|menuHold`）**只渲染不更新相机** —— 打完一局返回主界面时 `menuHold=true`，画面就停在"结束前那一帧"；而且冻结期 `nowT` 不前进，即便复用同一公式也只会得到一张静止的图 |
| 修法 | ①航拍几何抽成模块级 **`aerialCamPose(phase)`**（20-player）单源，开局前那条分支改调它（几何零变化）；②新增 **`updateMenuCamera(dt)`**：菜单期用**真实帧时间**推进相位，并把 `fov` 回初始档 74（上一局可能停在机瞄/炮镜的窄视场）、天空盒跟随相机（否则远裁剪面切黑）、清掉可能残留的镜片遮罩；③24-main 冻结分支里 `menuCam = menuHold && !gamePaused` 时调用它，并**跳过第一人称武器渲染**（菜单背景必须"无 UI"） |
| 边界（刻意不改的） | **暂停面板**（`gamePaused`）保持冻结的战场视角 —— 相机一动不动；**结算页**（`matchOver && !menuHold`）同样不切航拍，背景仍是"结束前那一帧"（用户只指了开始界面） |
| 验证 | 新增 `dev/verify-menucam.js`（4 组全绿；桩里给 `performance.now()` 装了可控时钟）：回主界面后相机在高空航拍位且**逐帧真的在动** / `fov` 回 74 / 暂停与结算期相机纹丝不动 / 四处接线（判据·驱动点·跳过武器·几何单源）静态固定 |

**追加验收**：打完一局（胜/负/平均可）→ 结算页点「返 回 主 界 面」→ 主菜单背景应立刻是**高空航拍地图**并**缓慢环绕运动**（不再是停住的那一帧）；按 Esc 暂停战斗时背景仍应是**冻结的战场视角**（不许被切成航拍）；结算页本身（未点返回前）背景保持原样。

### 追加 P0（用户插话 2026-09-17 二报）：一局结束后就地开新局会"等 1.5S 直接进入结算"

> 「又有严重BUG！一局结束后按照原来的配置开新游戏会等1.5S直接进入结算。」

| 项 | 定案 |
|---|---|
| 根因①（主因） | **终局前奏哨兵 `matchEndPending`/`matchEndT` 从不清零**（21-match）。`endMatch()` 落地后哨兵仍是那个 winner，而 `resetMatchState()` 也不清它 —— 就地重开的新一局**第一帧**就命中 `updateFlags` 的"胜负已定倒计时"分支直接弹结算；若上一局是在 **1.5s 前奏里**被"返回主界面 → 新游戏"打断的，残留的 `matchEndT` 恰好让新局在 **1.5 秒后**结算 —— 与用户看到的秒数完全对上 |
| 根因②（同族） | **`matchTime` 只由 `startMatch` 的 assault/demolition/clash/convoy 分支赋值，conquest 分支不赋**：征服图就地重开沿用上一局剩余时间，上局超时打完（`matchTime≤0`）则新局开局即超时 → 同样 1.5s 后结算 |
| 为什么以前没暴露 | 这两条都属于 2026-09-16「就地重开」新路径 —— 以前换图靠**整页重载**（全局态全部重建），所以永远碰不到 |
| 修法 | ①`endMatch()` 开头**就地消费哨兵**（`matchEndPending=null; matchEndT=0`）——哨兵生命周期严格等于"一次终局前奏"；②`resetMatchState()`（对局态复位唯一入口）**再清一次哨兵**并**按战役口径兜底 `matchTime=(CAMPAIGN.matchMin\|\|15)*60`**（startMatch 各模式分支随后照旧覆盖）；③`resetPlayerForNewMatch()` 顺带复位 `respawnCd`（上局阵亡剩下的部署冷却不该带到新局） |
| 验证 | 新增 `dev/verify-restart.js`（**5 组全绿**）：T2 ★ 用户原话的精确复现（1.5s 前奏中途开新局 → 新局跑满 2 秒仍不结算）· 打完一局开新局连跑 3 秒不结算 · **征服图**（斯大林格勒）超时打完后就地重开 `matchTime` 回到 900s 且不立刻超时 · `respawnCd`/本局计数复位 · **T5 阴性对照**（手工把哨兵恢复成修复前的脏状态 → 一帧就必须结算，证明断言对该 bug 敏感） |

**追加验收**：打完整一局（让它正常结算）→ 结算页「返 回 主 界 面」→「新 游 戏」→「开 始 新 游 戏」→ 新一局应**正常开始并一直打下去**（不该在 1 秒多后自己弹结算）；换**征服图**（斯大林格勒/滇缅/胡康）用同样步骤连打两局，第二局应给足**完整限时**（不再是开局即超时）。

---

## 一.10 本轮修复（P0）：同一张图打不完一场 + 主菜单「继续游戏」独立入口（2026-09-16 二批，已实现，待实机验收）

### 起因（用户反馈）

> 「修复如下严重BUG：现在同一地图无法真正结束一场战斗，返回主菜单后如果不换地图则只能再次进入同一场战斗的结算界面。
> 另外我希望将**继续游戏**的按钮移到主界面，点进去的时候**直接继续**，没有能继续的就是**灰暗色**，新游戏界面就只用来开新游戏。
> 新游戏会覆盖原先的游戏。」

### 根因（已在沙箱里复现并定位，非猜测）

`startGame()` 只复位了对局标志（`matchOver/menuHold/gamePaused/matchRunning`），**没有复位"玩家这一条命"**。于是同一张图打完一局后：

```
打完一局 → 从结算页回主菜单:  player.deployed=true, player.alive=true   ← 仍是上一局的活人
再点开局 → 兵种选择界面:      deployBtn=「部 署」被隐藏, resumeBtn=「返 回 战 斗」被顶上来
                              → 玩家只能点「返回战斗」= 直接被送回上一局那具冻结的战场/结算画面
```

换地图因为走整页重载（世界与脚本全部重建）所以不受影响 —— 这就是"不换地图就出不来"的原因。

### 定案（用户三项指示 + 用户的旧交互诉求）

| 项 | 定案 |
|---|---|
| 根因修复 | 新增 `resetPlayerForNewMatch()`（22-hud，在 `startGame` 内、`startMatch` 之前调用）：`deployed/alive/spectator/飞行/掩体/趴蹲/架枪/挂载点/投掷物状态/绷带/视角模型` 全部复位，站位回到本方基地、朝向地图中心，并清 `blackOv`/`scopeOv` 残留。新一局的兵种选择界面因此正确显示「部 署」 |
| 主界面 | 首页四按钮：**「继 续 游 戏」(最上) / 「新 游 戏」 / 「游 戏 设 置」 / 「游 戏 说 明」** |
| 继续游戏 | 点进去**直接继续**，不再先经过任何面板：**已落地且存活 → 直接回战斗**（跳过兵种/出生点选择，重锁指针、恢复 HUD）；尚未落地或已阵亡 → 进部署界面（兵种选择 / 重生），与"阵亡后重生"同一路径 |
| 置灰态 | 没有可继续的战局时「继续游戏」**置灰不可点**（`disabled` + `.off` 双保险，CSS `opacity:.38 + grayscale`），按钮位置不动 |
| 新游戏界面 | **只用来开新游戏**：面板标题改「新 游 戏」，底部按钮改「开 始 新 游 戏」，并加一行提示「开始新游戏会放弃当前未决出胜负的战局」；不再承担"回到旧局"的职责 |
| 新游戏覆盖旧局 | 点「新游戏」时若**有未决出胜负的战局**（`matchRunning && !matchOver`）→ 先二次确认「确定开始新游戏？当前未决出胜负的战局将被放弃。」；取消则原局原样挂着；确认则 `retireMatchActors()` 放弃旧局 + 就地开新局。旧局**已结算**时不再多问一句 |

### 实机验收清单（请逐项试并截图反馈）

0. **【二批补修】**点首页「新 游 戏」→ 应打开**新游戏面板**（战役卡片 + 选择阵营 + BOT 难度 + 在场人数 + 兵力票池），面板底部是「开 始 新 游 戏」；点它才真正开局。（此前首页「新游戏」被接成直接开局，把选地图那一屏跳过了 —— 已修：`#newGameBtn` 带 `data-p="mPlay"`，有未分胜负的战局时先弹确认再放行，面板内的「开始新游戏」才开局）
1. 打开游戏 → 主菜单应有四个按钮，最上面是**「继 续 游 戏」且是灰的**（还没有战局）、下面是「新 游 戏」；
   （**2026-09-17 记录批已改**：首页现为**五**按钮，顺序 = 新游戏 / 继续游戏 / 战绩数据 / 游戏设置 / 游戏说明 —— 用户新指示"把新游戏按钮移到继续游戏上边"，见 §一.11；其余验收项不受影响）
2. 点「新 游 戏」→ 面板标题是「新 游 戏」，底部按钮是「开 始 新 游 戏」→ 点它落到兵种选择；**此时底部应是「部 署」**（不该是「返 回 战 斗」）；
3. **★ 核心场景**：打完一局 → 结算页点「返 回 主 界 面」→ 主菜单（「继续游戏」应是**灰的**，因为这一局已经打完）→ **不换地图**直接点「新 游 戏」→「开 始 新 游 戏」→ 应正常开始**新的一局**（能看到新刷出的双方单位、兵力票回满），**绝不能**再被送回上一局的结算画面；
4. 同一张图连打 3 局（每局打完从结算页回菜单再开）：每局都应是全新的一局，结算页每局只出现一次；
5. 开局后（还没落地，还在选兵种）→ 点「返 回 主 界 面」→ 主菜单**「继续游戏」应是亮的** → 点它 → 回到刚才那一局的兵种选择（票与选择都还在）；
6. 落地参战 → 按 Esc →「返 回 主 界 面」→ 确认 → 主菜单点「继续游戏」→ **应直接回到战斗**（不再经过兵种选择），HUD 正常、能开枪能跑；
7. 战斗中返回主菜单后**不要点继续**，改点「新 游 戏」→ 应弹「确定开始新游戏？当前未决出胜负的战局将被放弃。」→ 点**取消**：原局还在（「继续游戏」仍亮，点进去还是刚才那一局）；再点「新 游 戏」→**确定** → 开新局，旧局作废；
8. 阵亡状态下从死亡部署界面返回主菜单 →「继续游戏」→ 应回到阵亡重生界面（而不是直接落地）；
9. 切 English 看主菜单：Continue / New Game / Settings / Field Manual 四个按钮，且 Continue 灰态文案正常。

---

## 一.9 本轮改进：战局中「返回主界面」（2026-09-16，已实现，待实机验收）

### 起因（用户反馈）

> 「现在在选取角色的界面游戏就已经开始了，而且还不能返回。」
> 我的想法是「在选取角色的界面游戏就已经开始」**不变**，但应当能够返回主界面。

### 定案（用户四项裁定，逐项书面确认后开工）

| 项 | 定案 |
|---|---|
| 开局节奏 | **「选取角色时游戏就已经开始」保持不变**：点「进入战场」仍是一次成局（全场 Bot/载具/旗点归属即时就位），兵种选择仍是这一局的部署环节。本批只加"出口"，不改开局语义 |
| 返回方式 | **会话内返回 + 冻结战局**（不刷新页面）：`menuHold` 冻结主循环（与暂停同级，战局数据原样留在内存），战斗 HUD 与触控层收进 `body.inMenu`，主菜单重新显示，并主动退出指针锁定 |
| 返回入口 | **三处**：① 兵种选择/部署界面底部「返 回 主 界 面」；② ESC 暂停面板「返 回 主 界 面」；③ 结算页 |
| 回到战局 | 主菜单主按钮按状态自适配：战局挂起时显示 **「返 回 战 斗」**（回到离开时的那一屏 —— 尚未落地=兵种选择，已落地=部署界面带「返回战斗」，已阵亡=重生界面）；未开局时显示原「进 入 战 场」 |
| 二次确认 | **按战况分档**：尚未落地（兵种选择阶段）直接返回，不打扰；**已落地参战**则弹确认「确定返回主界面？当前战局将被冻结，可从主界面继续。」，取消则战局完全不动 |
| 结算页 | 用户裁定 **「回到主菜单」直接取代「再来一局」**（结算页只保留一个主按钮）。对局已结束，返回不再二次确认 |
| 结算后回菜单 | 用户裁定 **战局已结束 = 菜单回到初始态**（`matchRunning` 清零 ⇒ 主按钮回到「进 入 战 场」），不留「返回战斗」这一无意义入口 |

### 实现要点（含两处必须说明的取舍）

| 项 | 说明 |
|---|---|
| 冻结判据拆成两个变量 | `gamePaused`＝"暂停面板开着"，`menuHold`＝"人在主菜单"。两者都能冻结主循环，但语义不同 —— 从暂停面板返回时**必须先把暂停态收回**，否则回到战局仍停在暂停面板上（沙箱 T5 断言把这条钉住）；`matchRunning` 另立，因为 `player.deployed` 在兵种选择阶段是 false，拿它当"这一局还在不在"的判据会让兵种选择阶段返回主界面后**丢掉回来入口**（沙箱回归当场抓出） |
| 全新一局＝**就地重开**，不整页重载 | 起初设计为"重载换干净世界"，但 `startMatch()` 只追加不清场（`soldiers/tanks/planes/trucks` 是全局累积表），就地开第二局会让两局单位同时活着参战，故补 `retireMatchActors()`（22-hud）在换局前整体退场：① 旧单位摘网格+标死；② 按 `startMatch` 开头记下的 **world 场景台账边界** 整段摘除本局新增（工程兵工事/迫击炮/医疗箱/残骸/弹坑，比逐个系统去记可靠）；③ 机制归位（**破袭补给库还原**、车队状态清零、补给点/医疗箱/地雷清空、固定炮位解绑、小队与玩家挂载点复位 + 清空累积表） |
| 顺带修（本批发现） | ① `endMatch` 现在会把暂停态复位并 `menuHold=false`（否则"人在菜单时打完"会把暂停面板叠在结算页上）；② `startGame` 增 `matchOver=false`（否则结算后就地重开的新一局一开局即结束态）；③ `togglePause` 先收起其他界面（旧版从部署界面按 Esc 会在部署面板上再叠一层暂停面板）；④ `startGame` 提级为模块级并统一在开头接好菜单按钮（旧版重载开局路径不经过 `showPanel`，会漏接 `onclick`）；⑤ 返回瞬间主动 `exitPointerLock` 有了 `menuHold` 门控，不再被误判成"战斗中丢锁"而弹回部署界面 |
| 代价（如实记录） | 同一会话内重开的第二局复用**同一个世界**：上一局打出的建筑坍塌/弹坑/焦土/树木倒伏会留在场上（属"同一张地图的战场痕迹"）。若实机觉得碍眼，再议"是否把世界也一并重建" —— **【已于 2026-09-17 世界还原批兑现：实机觉得碍眼，世界也一并还原，见 §一.12】** |

### 实机验收清单（请逐项试并截图反馈）

1. 打开游戏 → 点「进 入 战 场」→ 兵种选择界面出现，底部除「部 署」外应多一个**「返 回 主 界 面」**；此时点它 → **直接回主菜单，不弹任何确认**；主菜单主按钮应变成**「返 回 战 斗」**；
2. 点「返 回 战 斗」→ 应回到**刚才那一局**的兵种选择（兵力票、选中的兵种都还在），**不是**重开一局；
3. 选好兵种点「部 署」落地 → 按 **Esc** → 暂停面板上应多一个**「返 回 主 界 面」**：点它 → 弹确认框（文案含"冻结"字样）→ 点**取消**：战局完全不动；再点一次并**确定** → 回主菜单（主按钮＝「返 回 战 斗」）；
4. 从主菜单回战局后按 Esc：**不应**一进去就是暂停态（应正常能打）；
5. 打完整一局 → 结算页只有**一个**按钮**「返 回 主 界 面」**（原「再来一局」已按要求取代）→ 点它 → 主菜单，主按钮是**「进 入 战 场」**（战局已结束，没有"返回战斗"）；
6. 在结算页回主菜单后点「进 入 战 场」→ **应立即开局**（无整页刷新黑屏），落到兵种选择；打一会儿确认**没有上一局的残兵到处跑**、也没有两个战局同时在打；
7. **破袭战专项**（百团大战 1940）：打一局把补给库炸掉 → 回主菜单 → 再开一局 → 开局态势里**补给库应完好**（修复前会在新一局开局即判攻方胜）；
8. 同一会话连着开 3~4 局（每局打完从结算页回主菜单再进）：帧率不应逐局下滑，场上不应见到旧局的工事/医疗箱堆积；
9. 中途返回主菜单后**刷新页面**：应正常回到主菜单（不自动开局），再点「进 入 战 场」即新一局；
10. 触屏：兵种选择界面同样有「返 回 主 界 面」，点按正常。

---

## 一.0 本轮改版：主菜单/结算改版 + 中英双语 + 下架两图（2026-09-13，已实现，待实机验收）

| 项 | 定案 |
|---|---|
| 下架地图 | 雪峰山会战 1945 / 太行山 1943（用户裁定急功近利失败品移除；战役 13→11，全沙箱回归绿灯） |
| 主菜单 | 右侧停靠栏：开始游戏/游戏设置/游戏说明 三按钮纵排 + 右缘渐变黑蒙版；空白区透出所选战役地图的航拍动态（开局前的死亡环绕镜头即航拍相机）；实验模式开关移入 游戏设置 |
| 游戏说明 | 全面重写（快速上手/基础操作/投掷物与医疗/载具与固定武器/兵种与技能/小队与指挥/战局目标与胜负/暂停与结算/触屏 9 节），含原操作说明全部内容 |
| 结算画面 | SVG 胜负图标 + 本局得分卡（本图历史最高 `sf_best_<战役id>` + 新纪录徽章）+ 击杀/阵亡/K·D/最大连杀/爆头/占领 六战绩卡 + 双方兵力对比条 |
| 中英双语 | `js/00b-i18n.js` 词典（中文原文即键，约 260 条）；语言切换在 游戏设置（sf_lang 存档，切换即重载）；覆盖全部菜单/部署/结算/HUD 高频文案；旗点与出生点名保留原文（战场地名） |
| 文案精简 | 游戏说明之外的说明性文字全面瘦身（设置页键位说明块删除并入游戏说明、开局面板长提示缩短、暂停页副题精简） |

**实机验收清单**：①主菜单航拍动态是否可见、右栏蒙版与三按钮排版是否顺眼；②设置里切 English 再切回，各界面文案是否正确；③打一局看结算：图标/得分/历史最高/新纪录徽章/战绩卡/兵力条；④打出超过历史最高的分数 → 新纪录徽章应闪烁，重开一局历史最高保留；⑤实验模式开关从设置里开关巡飞弹兵正常。

---

## 一.1 本轮界面改进：主菜单左上角战役沙盘 + 阵营盾徽（2026-09-13，已实现，待实机验收）

### 定案（用户三项裁定，逐项书面确认后开工）

| 项 | 定案 |
|---|---|
| 位置形态 | **左上角竖排两张独立卡片**：地图在上（真实 240px 宽，约 260×260）、阵营在下（盾徽 82px 一枚，双方并排）；各带边框/圆角/深色半透明底与投影，与右侧停靠栏同一视觉语言 |
| 画面内容 | **纯图形不带文字**：地图=战术等高线沙盘（立体晕渲+色带等高线+路网/河流/桥/街网/旗点标记）；阵营=纹章盾（盾形+军旗场+徽记+头盔剪影+服饰色带） |
| 刷新记忆 | **保留**（`sf_campaign`/`sf_team` 存档不动）：左上角画面即"当前选择"的实时反映——刷新后一眼就能看出上次选的哪张图、哪个阵营；点盾徽可直接切阵营 |
| 顺带修 | ①刷新时本该隐藏的战斗 HUD **原生不显示**（不是先画后藏）；②英语存档首屏不再先闪中文（含部署/结算/暂停/说明页原先漏盖的双语章） |

### 实机验收清单（请逐项试并截图反馈）

【左上角画面】
1. 打开游戏（刷新几次）→ 左上角应有两张卡片：上面是**当前战役的沙盘图**（一眼应能读出地形特征：诺曼底绿野田块、斯大林格勒/柏林的灰色街网、淞沪蓝水织网、百团赭色沟壑+塬面、胡康纵贯深谷+中央大桥、草原铁路轴+东侧防线缺口、雾林北谷+西墙龙牙带）；
2. 点右侧"开始游戏"→ 逐张点战役卡片（会重载回本面板）→ **左上角沙盘应随之换图**，形状应与该图部署图（兵种选择页右侧那张）对得上；
3. 下面两枚盾徽：**当前所选阵营高亮（金边+发光），另一方压暗**；点一下盾徽 → 应立即切换高亮，并同步右侧"选择阵营"两个按钮的选中态；打一局后重开，所选阵营仍是它；
4. 换不同战役看盾徽：英美德（★锅盔/✠钢盔/☭锤镰）、太平洋与中国战场（☀旭日/✷十二芒/✭五角星）徽记与底色都应不相同；
5. 进入"游戏设置"或"游戏说明"面板 → 左上角画面应消失（保持这两页干净），返回后回来；
6. 手机/触屏模式或很窄的窗口 → 画面自动让位（不压住右侧按钮栏）。

【刷新不再闪 UI（本次核心修复）】
7. **刷新页面**（多试几次、Ctrl+F5 硬刷新）→ 屏幕上**不应出现**弹药面板/血条/小地图/罗盘/顶栏/记分板/FPS 等战斗 HUD 的任何一瞬（修复前会先现形一小会儿再消失）；主菜单期间直接就是干净画面+左上角两张卡片；
8. 点"进入战场"开始一局 → HUD 正常出现（弹药/血条/小地图/记分板照旧）；按 Esc 暂停、打完一局到结算页 → HUD 再次整体收干净。

> **若第 7 项仍不通过（2026-09-13 用户反馈"除诺曼底/百团/草原/断崖外都有此问题"）**：请按顺序做两步，我按结果定位 ——
> ① **双击打开项目根目录的 `诊断-UI显示.html`**（不需要服务器）并整页截图：它会直接给出「这份 CSS + `body.inMenu` 下 #ui 是 none 还是 block」「浏览器吃的是新版还是旧版样式表」「页面上有几个 #ui 节点」的结论；
> ② 若诊断页显示"✓ 隐藏正确"，那问题在游戏页运行时 —— 请在游戏首页按 **F12 → Console**，粘贴这一行回车，把输出截图发我（一行即可看出类是否还在、是否有多份 #ui）：
> `copy('#ui='+document.querySelectorAll('#ui').length+' body="'+document.body.className+'" display='+getComputedStyle(document.querySelector('#ui')).display)`
> （`copy()` 把结果写进剪贴板，直接粘给我也行。）

【英语界面（顺带修）】
9. 设置里切 English → 刷新 → 首屏不应先闪中文再变英文；部署页/结算页/暂停页/游戏说明页**整页**都应是英文（修复前只有菜单头部是英文，下面仍是中文）。

---

## 一.2 开局面板「战役」卡片排版修复（2026-09-13，已实现，待实机验收）

### 定案（用户反馈"图里的排版和换行不甚美观"+ 建议缩短草原副题）

| 项 | 定案 |
|---|---|
| 问题 | 旧卡用 `<br>` 硬折三行 + 只有 `min-width:150px`：卡宽随文案长短浮动、长副题被挤成两三行、整行参差不齐；文件夹卡把 `📁 占旗点战役 (8)` 与 `· 当前征服` 拼成一个标题，直接撑爆卡宽折行 |
| 改法 | 三行成块（标题/模式/副题）+ CSS `.campCard` 固定 196×102（窄屏 ≤980px 收 172），标题与模式单行带省略号、副题 `text-wrap:balance` 两行截断、整行等高对齐；"当前战役"从标题挪到副题行（`当前：{0}` / 点开选择战役），`title` 属性保留全文供悬停查看 **（注：卡宽/卡高两项已被下方「二轮修复 2026-09-16」取代 —— 172 + height:auto；其余不变）** |
| 文案 | steppe 副题按用户建议改为 `库尔斯克 · 钢麦绞杀`（同步 EN 词典 `Kursk · Steel and Wheat`） |
| 顺带修 | i18n 插值顺序：`t2('当前：{0}', t2(title))` 先查外层模板再插值，EN 下 `{0}` 仍是中文（实测 "Now: 诺曼底 1944"）→ 改为先译各字段再喂外层模板 |

### 实机验收清单（请逐项试并截图反馈）

10. 点"开始游戏"→ 战役卡片应**整行等高对齐**（不再有卡片高矮不一、副题挤成三行）；📁 占旗点战役卡标题不再折成两行；
11. 悬停任意卡片 → 浏览器提示条显示"战役 · 模式 · 副题"全文（省略号截断时用它确认没丢信息）；
12. 切 English 再看同一屏 → 英文卡同样不折行、不截断（已按最长英文字串定卡宽）；
13. 窗口拉窄到 ~900px → 卡片收窄一档并自动换行，不溢出面板。

### 二轮修复（2026-09-16，已实现，待实机验收）

用户反馈："让文件夹外的三个地图和文件夹不要换行" + "你看卡片，明显下面的空白有点大，所以请缩小一下卡片"。

| 项 | 定案（根因均为无头 Edge 实测值，非估算） |
|---|---|
| 折行根因 | 外层行可用宽 **719px** = 停靠栏 880 − 停靠栏内边距 104 − 子面板内边距 42 − 停靠栏滚动条 15；而"文件夹卡 + 3 张直排卡"需 4×196+3×8 = **808px** → 必然折成 2 行（截图里"断崖公路 1940"掉到第二行） |
| 空白根因 | 卡固定高 102px，而三行内容实测仅 **45px**（标题 18 + 模式 13 + 副题 14）+ 上下内边距 22 + 行距 6 = 73px → **卡底空出 29px** |
| 改法 | ① 卡宽 196→**172**：4×172+3×8 = 712 ≤ 719，一行放下；② 卡高改 `height:auto` + `justify-content:center`（卡高随内容、行内由 flex stretch 自动等高、内容垂直居中 → 空白归零）；③ 标题字距 `.5px→0`：英文最长标题 'Hundred Regiments 1940' 163→**152px**，落进 172 卡的内容宽 158px（否则英文界面下该标题被省略号截断）；④ 窄屏档 ≤980px 由 172 收 **160** |
| 折行兜底 | 保留外层 `flex-wrap`：窗口窄到装不下 4 张时照旧换行（只挤不溢出）。实测 870px 视口仍是一行（卡 160）、800px 视口回落到 2 行 |
| 已知例外 | 英文"断崖公路 1940"的**模式行** `Heist · destroy all trucks or let half escape`（174px）会省略号截断 —— 旧卡 196（内容 176）时仅富余 2px，属长期贴边项；卡片 `title` 悬停仍给全文。要根治需缩短该英文串（未做，等指示） |
| 验证工具 | 新增 `dev/verify-menucards.js`（无头 Edge 打真实 index.html 量卡片几何：4 视口 × 中英双语 × 8 条断言，把"折行/截断/卡底空白"变成可复跑的绿灯） |

**实机验收清单（二轮，编号接上表）**

14. 打开"开始游戏"→ **文件夹卡 + 百团/草原/断崖 四张卡应在同一行**（不再有卡片掉到第二行）；
15. 同一屏看卡片高度：**卡底不再留大片空白**（卡高贴着"标题/模式/副题"三行），整行仍是等高对齐、内容居中；
16. 悬停"百团大战 1940" → 提示条仍是完整"战役 · 模式 · 副题"；切 English 再看同一屏，标题不应出现省略号。

---

## 一、本轮新特性：连杀奖励机制（2026-09-11/12，已实现，待实机验收）

### 1.1 设计定案（用户裁定）

| 项 | 定案 |
|---|---|
| 连杀口径 | **沿用现有 5 秒多杀窗口**（21-match `KILL_STREAK_WIN=5`），击杀/爆头/摧毁坦克·运输车·战机计入；间隔超 5 秒或阵亡清零 |
| 奖励形式 | **临时增益 + 得分加成**（连杀越多得分增幅越高） |
| 档位节奏 | **3 / 6 / 9 杀递进**；同一条命每档发放一次，再触更高档=升级并刷新时长 |
| 适用范围 | **仅玩家**（Bot 加成=§2 计划项，本轮不做） |
| 增益时长 | **5 / 6 / 7 秒随档递增**（2026-09-12 用户裁定：原 30 秒太长） |

### 1.2 三档明细（数值单源：00-config `STREAK_REWARDS`，调参只改表）

| 档位 | 名称 | 得分倍率 | 移速 | 换弹时长 | 减伤 | 时长 |
|---|---|---|---|---|---|---|
| 3 杀 | 战意·壹 | ×1.5 | ×1.15 | ×0.8（快 20%） | — | 5s |
| 6 杀 | 战意·贰 | ×2.0 | ×1.20 | ×0.7（快 30%） | 15%（仅敌方来源伤害） | 6s |
| 9 杀 | 战意·叁 | ×3.0 | ×1.25 | ×0.6（快 40%） | 25%（仅敌方来源伤害） | 7s |

- 得分倍率作用于击杀/爆头/摧毁坦克(300)/运输车(150)/战机(250)——如 9 连杀时普通击杀 +300。
- 减伤只吃**敌方来源**伤害；摔落/严寒/激流/自伤不吃。
- **骑乘映射（2026-09-12 二次裁定「增益跟着人走」）**：同一 reloadMul（×0.8/0.7/0.6）随形态自动切换作用点——坦克=主炮 CD+同轴机枪周期；飞机=航炮间隔+投弹间隔（挂弹补给 8s/枚为后勤计时不动）；重机枪=过热积累放缓（散热不变）；迫击炮/反坦克炮/防空炮=射击冷却缩短；火力点暴露人员减伤照常生效（载具内乘员由车体承伤，减伤无感属正常）；HUD 角标按形态标注当前生效项（主炮加速/航炮加速/枪管降温/射速提升）。
- HUD：右下增益角标 `#streakBuff`（金/橙/炽红 三档配色 + 剩余秒数）+ 中下连杀横幅（已扩展至"九连杀"）+ 中央"连杀奖励·战意X"提示。
- 到期/阵亡/新对局（`resetMatchState`）即撤，三者都干净。

### 1.3 实机验收清单（请逐项试并截图反馈）

1. **触发**：5 秒内连续击杀 3 人 → 出"三连杀!"横幅 + 中央提示"连杀奖励 · 战意·壹 (得分×1.5, 5s)" + 右下金色角标倒数 5 秒；
2. **手感**：增益期间跑动明显更快、换弹更快；右下得分角标分数为加成后值（普通击杀 +150 / 爆头 +188）；
3. **升档**：窗口内继续杀到 6 → 升级"战意·贰"（橙色、6 秒、挨枪掉血肉眼可见变慢）；9 → "战意·叁"（炽红、7 秒）；
4. **清零**：停火超 5 秒再击杀 → 连杀从 1 重计、无倍率；阵亡 → 角标消失；"再来一局" → 状态干净；
5. **载具分**：连杀期间摧毁坦克/击落战机得分吃倍率（+450/×1.5、+750/×2.5 档…）；
6. **减伤边界**（可选，莫斯科/斯大林格勒）：增益期间摔落/严寒掉血**不**变少；
7. **骑乘映射（2026-09-12 二次裁定「增益跟着人走」）**：带增益上坦克 → 角标变"主炮加速"、主炮装填肉眼可见变快（热量条无跳变）；上重机枪 → "枪管降温"、持续扣扳机更久才过热；迫击炮/反坦克炮/防空炮 → "射速提升"、冷却明显缩短；上飞机 → "航炮加速"；
8. **形态切换**：增益期间下车/下炮 → 恢复步兵效果（移速/换弹）；在火力点上被击中掉血变慢（减伤生效）；增益到期后全部回落正常；
9. **观感**：角标配色/位置/时长读数是否顺眼，横幅与角标有无遮挡重叠。
10. **尸体起飞修复（2026-09-12，dev/probe-ragdoll.js 216 试次全过后的实机抽查）**：黄土沟壑/高山坡面上击杀 Bot 或被击杀 → 尸体应正常倒地翻滚下滑，头盔不再带飞整具尸体（修复前海拔 100m+ 处当场飞天）；顺坡翻滚数米后静止属正常物理。

### 1.4 杀敌续杯（2026-09-16 用户定案，已实现，待实机验收）

**要补的洞**：增益只在"恰好踩中 3/6/9"那一杀发放并开始计时（5/6/7 秒），踩档之后继续杀（4/5/7/8、尤其 9 杀之后的 10/11…）只叠连杀、不刷时长 —— 于是"9 杀档 7 秒"在你还在连续击杀时照样倒数到 0 消失；过了 9 杀更是一整条命都再也拿不到增益。

| 项 | 定案（用户在四个选项中逐条确认） |
|---|---|
| 触发口径 | **连杀窗口内击杀即续杯** —— 与连杀计数共用同一个 `KILL_STREAK_WIN=5` 秒窗口（不引入第二个时间常数）；停火超 5 秒＝断链，不再续，增益自然到期 |
| 续杯量 | **回满当前档时长**：3杀档 5s / 6杀档 6s / 9杀档 7s，**次数不限**（连杀不断就一直续）—— 满值就是 `STREAK_REWARDS[].dur`，**无需新增任何调参数** |
| 升级优先 | 踩中 3/6/9 的那一杀走 `grantStreakBuff`（发放/升级并刷新时长），不重复记续杯 |
| 计入口径 | **与连杀口径单源**：击杀/爆头/摧毁坦克·运输车·战机一律既叠连杀也续杯（同一入口 `registerKillScore`） |
| 清零 | 阵亡 `resetKillStreak` 照旧清空"连杀计数 + 增益 + 续杯数"；断链只停续杯，不提前收走剩余增益 |
| HUD 表现 | 续杯瞬间右下角标**秒数跳回满值** + 角标按当前档位色**亮一下**（0.45s 脉冲：CSS `#streakBuff.refill` / `@keyframes sbRefill`，光晕取 `currentColor`，三档各自成色）+ 一声短促确认音（880Hz 单声，区别于升档的 660→990 双音）；**不新增文字占位** |

**实现（三处接线，判定/时长/显示各一）**：`21-match` 新增 `killStreakRefills` 计数与 `refillStreakBuff()`（`b.until=nowT+b.dur` + `b.refillT=nowT`），`registerKillScore` 在"踩档→升级"之外对窗口内击杀调它 —— 判定变量 `chained` 必须在连杀重置**之前**取值（否则永远判成断链）；`grantStreakBuff` 记入 `dur`（续杯读它，满值单源）；`22-hud` 每帧按 `nowT-refillT<0.45` 挂/摘 `.refill`。00-config 注释与游戏说明双语条目同步。

**实机验收清单（请逐项试并截图反馈）**

1. 打出 3 连杀拿到"战意·壹"→ **5 秒内再杀一人**：右下角标秒数应**跳回 5s** 并亮一下（此时不应弹"连杀奖励"中央提示 —— 那代表升档，不是续杯）；
2. 连续每 5 秒内都有击杀 → 角标应一直不消失（每次击杀都回满）；停手 5 秒以上 → 不再回满，角标自然倒数到 0 消失；
3. 打到 9 杀"战意·叁"（7s）→ **继续在窗口内击杀**（第 10、11…杀）：角标持续续满 —— 旧版此处增益到期即永远消失，是本轮修掉的手感断点；
4. 续杯不改倍率：第 4 杀仍是 ×1.5（+150）、满档续杯期摧毁坦克仍是 ×3（+900）；
5. 阵亡 → 角标立刻消失；复活后连杀与续杯次数都从头算（同一条命每档仍各发放一次）。

---

## 一.4 本轮新特性：百团大战 1940 立体化改版（2026-09-12，已实现，待实机验收）

### 定案（用户四项裁定 + 中途意见）

| 项 | 定案 |
|---|---|
| 地形 | **升级 640 大地图**（同柏林规格），塬-沟-峁真高度场 |
| 点位 | **5 库·扇面+立体分层**（铁路库/窑洞村=塬面，东峁顶=山脊，西沟口/南沟仓=沟底） |
| 坡度物理 | **全局生效**；坦克爬坡上限用户裁定 70° |
| 沟壑 | **沟底可玩·坡道网络**（每沟 2~3 处缓坡坡道+沟底渡口/窑洞） |
| 中途意见 | "现在建筑太少太空荡" → 据点与村落加密包（日军铁路据点×3/村落×3/峁顶工事×2/基地加建） |

### 实机验收清单（请逐项试并截图反馈）

【地形/观感】
1. 选"百团大战 1940"开局 → 部署图一眼读出：赭色沟壑带（西/东/北/南四条大沟+贯穿中塬的巷沟）、浅色坡道线、五面旗分三层的扇面——不再是"一条线"；
2. 走到塬缘 → 中塬是真正的高台（塬面高于周边川地约 8~10m），沟是深沟大壑（约 14m），川地上有 2~3 座圆峁丘——一眼黄土高原沟壑区，不再是"平坦草地撒房子"。

【坡度物理（本次核心，请重点试）】
3. 开坦克对着沟壁陡崖全速冲 → 车头"啃"上崖壁后被挡住（爬行挡），**爬不上去**；倒车可以退走；
4. 在沟底开坦克对崖 → 同样仰攻不动；沿沟底走 → 找到浅色坡道/堑口 → 全速通过上塬；
5. 开坦克从塬缘冲下沟 → 可以下去（单向慢爬，明显减速）——下去后不出坡道就出不来（沟壑=反坦克壕），请体验并反馈这个"下去就困住"的度是否合适；
6. 步兵爬 40°+ 陡坡明显减速"手脚并用"，崖壁（近 80°）爬不上去；从崖缘走出去会腾空摔落（摔伤照旧）；其他图（莫斯科/断崖公路）的陡坡也应有同样手感——坡度物理是全局的；

【沟壑玩法】
7. 沟底可以走人：从南沟坡道下去 → 沟底有渡口台/粮仓/掩体 → 沿沟底渗透到别处坡道上来；Bot 也会走坡道和沟底（观察友军是否穿沟机动、会不会卡在崖下）；
8. 铁路桥（巷沟上）可走坦克 = 巷沟上的拉锯通道；

【建筑密度（本次加密，用户中途意见）】
9. 铁路沿线 3 处日军据点（碉堡/炮楼+兵舍+铁丝网+龙牙）、塬面两片村落+川地一村、东峁顶环形工事、西北峁/南峁哨塔木屋、双方基地碉堡/炮楼/粮秣库——确认不再"太空荡"；若密度还不够，报给我再加；

【HUD/节奏】
10. 小地图随旋转显示沟壑赭带与坡道浅线；对局 22 分钟；己方坦克 6 辆；攻方需摧毁 5 库方胜——节奏是否合适请反馈（5 库偏多可减为 4 库）；
11. 尸体物理抽查（承接上一批）：坡面击杀后尸体正常倒地翻滚、头盔不飞天。

---

## 一.5 本轮新特性：莫斯科保卫战城市边缘改版（2026-09-12，已实现，待实机验收）

### 定案（用户指令 + 按项目先例自动定案；用户就餐留言"有事要问的话就在项目里寻找答案吧"→ 依同质化纲领 §十 与城市组斯大林格勒/柏林管线执行）

| 项 | 定案 |
|---|---|
| 主题 | **城市边缘**（用户原话"我希望是城市边缘部分"）——西半=城网街区/厂区/编组站，东半=雪原村道（德军进攻轴）；告别"雪岭山村" |
| 地图 | **640 大地图**（对齐柏林/百团规格）：22 分钟、Bot×1.25、坦克 8/8、严寒启用（与斯大林格勒同管线） |
| 点位 | **三路扇面 6 旗**（纲领 §4.1-4 多维）：东村/河湾村两翼攻方出发（距德基最近自动归属）→ 编组站（北线·调车场）/街垒区（中线·主街路口）/工厂（南线·厂区）→ 教堂（纵深·距苏基 75m） |
| 大件 | **厂区**（redOctober 厂房移植：天车走台+钢水吊罐+铁路专用线；苏军持"工厂"旗=坦克产能 ×1.8+厂内重生，与斯大林格勒同机制）+ 编组站调车线 + 教堂地标 |
| 防御 | 城缘反坦克带 x≈118（龙牙双排交错+机枪堡×2+反坦克壕，主街公路缺口 z-16..16 为唯一装甲走廊）+ defWorks(0) 守方工事模板 |

### 实机验收清单（请逐项试并截图反馈）

【一眼读图】
1. 选"莫斯科保卫战 1941"开局 → 部署图/小地图应读出：西半灰色街网带（主街+5 纵街+2 横街+教堂广场）、6 旗三路扇面、南缘冰河蓝线——不再是"偏远山村"；
2. 城区地面为压土色建成区+街道沥青带，基本无草无树；树只出现在东郊雪原与城缘空隙。

【城市边缘手感】
3. 沿主街从东入城 → 两侧街块连片建筑（可进排楼/街墙废墟/庭院），街上有电车轨/街灯/车残骸，"街垒区"旗一带有钢轨街垒纵深（坦克碾不动，可绕可炸）；
4. 城缘带（V5"城缘街"以东的开阔雪原边）→ 开坦克直冲龙牙/反坦克壕 → 碾不动/爬不过，必须从主街公路缺口（图幅正中）过——缺口两侧有战壕和机枪堡欢迎你；
5. "工厂"旗（南线）：厂房可进、东西梯上天车走台（4.6m 制高）、吊罐打爆会爆炸起火；**苏军占住此点 → 我方坦克重生明显变快且从厂区西停车场出库；丢失后回主基**；
6. "编组站"旗（北线）：站在调车线之间（轨穿旗心=道口），平板车坦克碾不动，货栈可打塌；
7. "教堂"旗（纵深）：教堂塔楼立在广场北侧（纯地标不可毁核心区），旗圈在铺装广场上，是苏军主基前最后一道软肋；
8. 严寒：开局户外原地站 25 秒 → 屏幕下方蓝色警告随后掉血；进厂房/废楼或持续移动 → 立即停止；
9. 东郊两村（东村/河湾村）：木屋群+仓房+雪原茬田（蹲伏软遮蔽）；德军开局自动持有这两个出发旗；
10. Bot/坦克能沿街网与公路缺口推进战局（观察我方坦克不会傻站在龙牙前发呆）；冰河（图幅南缘）徒步/车辆通过只减速不掉血。

---

## 一.6 本轮新特性：胡康河谷巨桥改版（2026-09-12，已实现，待实机验收）

### 定案（用户指令 + 按项目先例自动定案；用户就餐留言"有事要问的话就在项目里寻找答案吧"→ 依同质化纲领 §十 与百团/莫斯科 640 管线执行）

| 项 | 定案 |
|---|---|
| 主题 | **巨型大龙河大桥**（用户原话"大桥远不够大，这个地图的主题就应当是巨大的大桥"）——跨 76m/面宽 14m/深谷 d=14 凌空, 门式塔楼×2 可登顶+塔顶高炮 |
| 地图 | **640 大地图**（对齐百团/莫斯科规格）：22 分钟、Bot×1.25、坦克 6/6、雨季深谷激流 |
| 点位 | **三路扇面 7 旗**（告别"五点一线"）：中线 桥西→大桥→桥东（桥头堡）／北线 西岸村→石拱桥→东岸寨（第二座桥, 车辆可通）／南线 西滩→徒涉滩→东滩; 显式 own 开局 3v3+桥心中立=双方抢桥 |
| 通路 | **三条过河通道**终结单线: 主桥（全员）/北石拱桥（全员）/南徒涉滩（滩心水深<0.3m 全员涉渡减速, 滩外激流不可徒涉） |
| 垂直立体 | 塔顶步道 dy+7.6 制高（爬梯登顶+塔顶 FLAK 高炮）/桥面层/谷底（坠谷=激流, 渡滩可爬回） |

### 实机验收清单（请逐项试并截图反馈）

【一眼读图】
1. 选"胡康河谷 1943"开局 → 部署图/小地图应读出：纵向深谷蓝带+两岸绿林、横贯中央的双桥线（主桥粗+北石桥细）、南段渡滩虚线圈、7 旗三路扇面与开局归属色（西 3 蓝/东 3 红/大桥灰）——不再是"五点一条线"；
2. 走到河谷边 → 深谷明显（谷深约 14m, 水面在岸下约 7.7m）, 雨季激流白沫; 大桥凌空跨谷, 两侧门式塔楼+水中墩排一眼读出"巨桥"。

【巨桥三件套（上轮三 BUG 修复复验）】
3. 桥两侧**不再有浮空拉索/吊杆**（已整体删除）——桥体=桥面+护栏+塔楼+墩排, 无悬空构件;
4. 河谷里**不再有泡在水里的哨亭**——两岸哨塔全部在岸上（河距≥30m）;
5. **登塔**：从桥头引道外侧找石垫台 → 单跑楼梯上塔顶步道 → 全程无高度断口、护栏豁口正对梯口, 两座塔都能上下; 塔顶有高炮可操作（对空）; 楼梯全程在岸上, 不再踩进激流区。

【三路通路】
6. 开坦克过**主桥**：桥面宽 14m 双向错车, 沙袋可碾, 桥头堑留道口; 塔楼门架横梁不碰车顶;
7. 开坦克走**北石拱桥**（西岸村↔东岸寨一线）：5 跨石墩老桥, 桥头有碉堡+沙袋环;
8. 步兵/坦克走**南徒涉滩**（西滩↔东滩一线）：滩心水没脚踝减速涉渡, 两岸有渡口阵地; 试试图从滩外（渡滩上下游）下河——应吃激流伤害被冲向下游（滩外仍不可徒涉）;
9. 坠谷/跳桥掉进激流 → 持续掉血被冲向下游, 顺流漂到渡滩可爬回岸（死路有活口）。

【立体与节奏】
10. 爬上塔顶 → 半场制高点, 视野盖主桥与两岸; Bot 会用塔顶高炮打飞机吗（可选观察）;
11. 对局 22 分钟、坦克 6/6、开局 3v3+大桥中立——双方第一波都在抢桥; 无头探针中盘旗权 3:3 对称、末段往复（东侧 AI 在无头探针里固有偏强, 实机手感以你为准）;
12. 尸体物理抽查（承接上批）：谷坡/塔顶击杀尸体正常倒地, 头盔不飞天。

---

## 一.7 本轮新特性：雾林守线·许特根雾林改版（2026-09-13，已实现，待实机验收）

### 定案（用户指令 + 按项目先例自动定案；用户留言"我要去睡觉了，有事要问的话就在项目里寻找答案吧，不建议使用浏览器操作来实机验证"→ 依同质化纲领§十 与百团/莫斯科/胡康 640 管线执行）

| 项 | 定案 |
|---|---|
| 历史原型 | **许特根森林战役 1944**（亚琛以南"雾林绞肉机"：美军攻入浓雾云杉密林，德军依托西墙工事带节节设防）。特色全部取自战役史实：能见度极低（用户原话点名保留并加强）、**树爆**（战役标志性杀伤：炮弹在树梢空爆、弹片自上而下泼洒）、**西墙防线**（龙牙+永备火力点节节设防）、**防火带**（林间开阔走廊）、**卡尔小径**（谷底泥径+坦克坟场+堑口）、**湿寒失温**（战壕病） |
| 地图 | **640 大地图**（对齐百团/莫斯科/胡康规格）：22 分钟、Bot×1.25、坦克 6/6、**cold:true 阴冷**、**atk:0 美军进攻**（史实口径美攻德守，旧版"德军进攻"退役） |
| 点位 | **三路扇面 7 旗**（告别旧版 5 旗一线 x 跨仅 146）：北线 雾谷哨→卡尔小径（谷底堑口）/中线 防火道西口→十字防火道→西墙缺口/南线 岭上村→坝路枢纽（纵深）；初始旗权=assault 自动规则（最近两旗归美军） |
| 大件 | **西墙防线**（龙牙双排约 190 颗碾不动+带后永备火力点×3+缺口两翼机枪+纵深战壕，主防火道缺口=唯一装甲走廊）+ **北谷卡尔小径**（谷深 8.5m 泥径+坦克坟场×3+车辆堑口×1/步兵堑口×2）+ **岭上村**（教堂地标+村社, 树爆庇护所） |
| 环境机制 | **树爆**（每 16~30s 齐射落旗圈/走廊热区, 2.3s 啸音预警后林冠空爆——顶盖内/壕沟内免伤, 防火带开阔地不落弹; Bot 与玩家同规则, Bot 复用火情逃离路径）+ **阴冷**（cold:true, 与莫斯科同管线）+ **能见度极低**（雾距 fogMul 0.42, 标准画质约 190m） |

### 实机验收清单（请逐项试并截图反馈）

【一眼读图】
1. 选"雾林守线 1944"开局 → 部署图/小地图应读出：北谷灰蓝带（横贯北部）+堑口浅色通道线+西墙深灰双线（中央留缺口）+7 旗三路扇面——不再是"五点一条线"；
2. 天空铅灰、雾气弥漫：**能见度明显极低**（远处树林融进灰雾, 约一个屏幕外就看不见）——比旧版浓得多；地面是腐叶棕褐而非绿草地, 树又密又高（暗杉）。

【树爆（本次核心新机制, 请重点试）】
3. 在旗点附近或走廊上停留 → 每隔一段时间听到炮弹啸音（约 2.3 秒）→ 头顶树冠处空爆闪光+木刺火星四溅+地面弹坑；屏幕下方红字"⚠ 树爆!"警告会提前出现；
4. **躲进任何建筑/碉堡/掩体顶盖下 → 不掉血**；**趴进战壕/弹坑底 → 不掉血**；站在林下空地/沙袋旁（无顶盖）→ 掉血明显（中心附近一炮很痛）；
5. 开坦克挨树爆 → 只轻微掉血（车体装甲减免, 骚扰不拆车）；
6. 观察 Bot：树爆落点圈内的 Bot 会**弃守掩体逃出弹着圈**（与逃离火线同款行为）；跑慢的会掉血；
7. 留意**防火带（土路走廊）上不落树爆**——开阔地是安全带但也会暴露在直射火力下，这就是"林下隐蔽 vs 走廊机动"的取舍。

【西墙防线（德军主防线, 节节设防）】
8. 从中路沿主防火道（土路）推进 → 西墙带前看到**双排龙牙**（坦克碾不动），只有中央缺口能过——缺口两翼有机枪和纵深战壕欢迎你；带后有 3 座永备碉堡面西死守；
9. 开坦克试图碾龙牙/绕带 → 被挡住；从缺口通过 →"西墙缺口"旗即突破口。

【北谷卡尔小径】
10. 到北线谷缘 → 深谷明显（谷深约 8.5m, 谷底泥径), 谷底有**烧毁坦克残骸**（装甲坟场）；谷壁陡坡步兵可攀但很慢, **Bot 不翻谷壁**, 只走三处堑口（中央车辆堑口可开坦克过谷, 两侧步兵堑口）；
11. 开坦克沿主防火道北上 → 经车辆堑口纵穿北谷（缓坡, 全速可通过）。

【岭上村与纵深】
12. 南线"岭上村"：教堂+谷仓+石屋的岭顶村社（屋顶/屋内=树爆庇护所）, 德军据点; 最东"坝路枢纽"=通往罗尔水坝的公路路卡（碉堡+兵舍）, 是美军最后一面旗。

【阴冷/其他】
13. 阴冷（同莫斯科）：开局户外原地站 25 秒 → 蓝色失温警告随后掉血; 进屋/碉堡或持续移动 → 立即停止;
14. 灌丛带（5 片幼杉密生区）：蹲进去**站立也难被 Bot 发现**（软遮蔽）, 子弹可穿过; Bot 会隔灌丛对你压制扫射;
15. 尸体物理抽查：北谷谷壁/堑口附近击杀 → 尸体正常倒地翻滚下滑, 头盔不飞天（probe-ragdoll woodline 三档坡度已过）。

---
## 一.8 本轮新特性：草原遭遇 1943 库尔斯克改版（2026-09-13，已实现，待实机验收）

### 定案（用户四项裁定 + 按项目先例自动定案；用户留言"不要使用浏览器操作来实机验证, 由用户实机, 有疑问多交流"→ 依同质化纲领§十 与百团/莫斯科/胡康/雾林 640 管线执行）

| 项 | 定案 |
|---|---|
| 历史原型 | **库尔斯克会战 1943**（普罗霍罗夫卡 7.12 装甲大遭遇 / 波尼里"库尔斯克的斯大林格勒"车站攻防 / 苏军大纵深防御·雷区+反坦克壕+龙牙引门带 / 七月金黄麦田） |
| 玩法模式 | **无旗+可争夺强点**（用户裁定保留遭遇战身份）：`spawns` 升级 7 强点——苏3 风车磨坊/北原哨/麦田农庄 + 德3 东岗/装甲坟场/南缺口 + **车站中立**；占领规则同旗（圈内无敌计时、双方在场僵持、中立×1.35 加速），占领**只给该点出生权不给票**；部署选项/Bot 重生/推进目标全线随战线进退 |
| 地图 | **640 大地图**（对齐百团/莫斯科/胡康/雾林规格）：22 分钟（clash matchMin 覆盖放开）、Bot×1.25、坦克 7/7 |
| 大件 | **普罗霍罗夫卡车站**（纵贯铁路+站房可毁+站台+水塔+货栈+调车场平板车×3+道口）+ **风车磨坊**（八角木塔+旋转风叶+外挂梯登 7.0m 瞭望台=半场制高）+ **装甲坟场**（缺口两侧残骸群 killing ground）+ **麦田农庄 khutor**（木屋×3+谷仓+院墙） |
| 防线 | **东带大纵深防线**（史实"坦克屠宰场"引门带）：雷区带(~150 枚, 车碾即炸可链爆, 避开缺口/公路)→反坦克壕×4 段→龙牙双排→**3 装甲走廊缺口**（北坟场/公路/南缺口），缺口两翼机枪+碉堡+铁丝网 |
| 环境机制 | **麦田火**（金麦×6+玉米×1 软遮蔽可燃——燃烧弹/炮弹可点着整片田）+ **炮火犁地**（用户裁定节制版：每 45~75s 齐射 2~3 发落强点圈/中带热区，贴地爆+弹坑+点燃麦田，Bot 同路规避） |

### 实机验收清单（请逐项试并截图反馈）

【一眼读图】
1. 选"草原遭遇 1943"开局 → 部署图/小地图应读出：纵贯铁路黑线（中央过车站）、东带深灰双线（三处留白=缺口）、赭色雷区点带、7 个菱形强点（苏3 蓝/德3 红/车站灰）+三路公路——不再是"一条对角线"；
2. 地面是金黄麦田带（南缘连片, 站着没入麦中即软遮蔽）+波状草原, 中带车站建筑群与西线风车一眼可辨。

【强点占领（本次核心新机制, 请重点试）】
3. 走进任意敌方/中立强点圈（圈内无敌方单位）→ 约 8~10 秒后播报"苏军 占领了强点「车站」"，小地图菱形变己方色；
4. 打开部署界面 → 出生点列表应包含**当前己方持有的强点**（丢掉的消失、夺回的回来）——占领的意义=战线推进的出生权；
5. 强点被敌方进入争夺中 → 小地图菱形金框闪烁；己方强点被夺 → 播报"⚠ 强点「X」失守"。

【东带防线与雷区】
6. 开坦克从东线公路缺口过防线带 → 缺口两翼有机枪+战壕欢迎你；试着从缺口以外的野地直线碾过去 → 龙牙/反坦克壕挡住, 只有三条走廊可过；
7. 开坦克在缺口外的野地绕行 → 碰到雷区（半埋圆盘+红白标桩）→ 车辆碾压即炸（伤害大, 附近雷连环爆）；**走廊内与公路上无雷**；步兵走进雷区应无事（反坦克雷不认人）；
8. 射击/炮击雷区 → 单颗雷被引爆会连锁引爆邻近的雷。

【车站与风车】
9. 车站：站房可进可打塌、站台能走上、水塔底下可穿行、调车场平板车坦克碾不动——车站旗圈横跨铁路, 双方开局都在抢；
10. 风车：从西墙外侧石阶上到瞭望台（全程不卡步、顶步与台面齐平）→ 半场制高, 可越护栏射击; 风叶在慢慢转；塔内有磨盘。

【麦田与炮火犁地】
11. 燃烧弹扔进麦田 → 整片田起火（躲在田里的人会被烧出来）；炮火犁地落进麦田也会点着；
12. 中带停留 → 每隔约 45~75 秒听到炮弹啸音（约 2.8 秒）→ 贴地爆炸+弹坑；进建筑/卧倒壕沟可躲；频率应是"氛围级骚扰"不致命——太凶/太痒都请反馈。

【节奏】
13. 对局 22 分钟、坦克 7/7、Bot 加强——装甲会战比重应明显偏高（载具互毁多）；强点拉锯应带动全线 Bot 三路推进；
14. 尸体物理抽查：坡地/风车台阶击杀尸体正常倒地, 头盔不飞天。

---
|---|---|---|
| **Bot 连杀加成**（用户 2026-09-11 指示"Bot也有加成"；本轮先做玩家侧，本条为后续批次） | Bot 击杀同样按 5 秒窗口计数并发放增益；形式建议**只发增益**（移速/换弹/减伤），不发得分倍率（记分板口径与 probe 断言不动） | ① `Bot` 类挂 streak 状态（die 时清）；② 增益对 Bot 射击间隔/移速的作用点在 14-bots（与玩家参数同源 `STREAK_REWARDS`）；③ `dev/probe-bots.js` 扩断言：连杀触发/增益生效/到期清除；④ 难度档是否缩放增益强度 → 待与用户讨论后排期 |
| **存量地图点位改版：一条线→多维立体**（用户 2026-09-12 指示，原话："现在地图的点位多是一条线，需要整改为多维的、立体的。"；纲领已入 README §4.1 第 4 条） | **平面多维**=旗点扇面/两翼/对角多路、有侧翼包抄与纵深拉锯；**垂直立体**=地下/地面/屋顶/山脊分层可进可争；无旗模式同样按"现实战场就是立体的"（用户口径）检视战场结构；"一条线"不作默认布局惯性，唯一豁免=日后特例立项（如河谷战役一类线性题材，一条线即设计主题） | ① 全图点名：待整改 2 图=诺曼底/滇缅（雪峰山/太行山已于 2026-09-13 下架）（**雾林已完成**：2026-09-13 许特根雾林改版 640：三路扇面 7 旗+西墙防线+北谷卡尔小径+树爆环境机制+阴冷，见 README §8）（六点沿主脊一线，山势立体但平面线性）；**淞沪已完成**（2026-09-12 五旗环形+丝厂枢纽，见 README §8）；**草原已完成**（2026-09-13 库尔斯克改版 640：无旗+7 可争夺强点+东带大纵深防线/雷区+车站/风车/坟场/农庄+炮火犁地，见 README §8 与 PLAN §1.8）；**百团已完成**（2026-09-12 立体化 640 大地图：5库塬面/山脊/沟底三层扇面+坡道网络+全局坡度物理，见 README §8）；**莫斯科已完成**（2026-09-12 城市边缘改版 640：三路扇面 6 旗+城网街块+厂区产能，见 README §8 与 PLAN §1.5）；**胡康已完成**（2026-09-12 巨桥改版 640：三路扇面 7 旗+巨型大桥+徒涉滩，见 README §8 与 PLAN §1.6）；草原/断崖公路（无旗）一并检视，斯大林格勒/柏林/柏林已完成；② 每图一案先审后做（特色清单交用户定案再动工，同质化纲领 §二.1）；③ 旗表/bases 在 00-config 单源重排；④ 立体层载体按图选址（地下/屋顶/隧道口/崖顶）；⑤ 验收=probe-match 旗权往复健康 + verify 全家桶 + 非改图指纹零漂移 |

---

## 三、开发待办（README 已登记未关闭）

| 项 | 来源 | 说明 |
|---|---|---|
| B10 二期：`solidBox`/`throwNade` opts 迁移 + 载入期摆世界收拢 | B7b 计划 | 清单 P2-15/P2-16 按计划移入 B10 |
| B10 二期：树沉没收敛例外（TREE_SINKS 独立实现） | B7b 计划 | P2-4 例外：收敛需再造双 mesh+漂移 API，成本>收益，留二期 |
| 断崖公路体验微调（山肩冲沟化） | 2026-09-10 地貌组 | §4.4 阶段 3 遗留项 |
| 阶段 4：草原/雾林战役组 | §4.4 | ~~草原遭遇（垄沟/羊肠水道+草垛微遮蔽）~~ **已完成**（2026-09-13 库尔斯克改版：麦田软遮蔽+草垛微遮蔽保留，大件=车站/风车，见 PLAN §1.8）；雾林已完成（2026-09-13 许特根改版） |
| 常驻底子 | §4.4 | 岩石/碎石坡道具、断崖 OCC 规则复查、田块/山脊/街区通用函数库 |

---

## 四、历史批次待验收清单（用户实机，详见 README §8 各条目）

- **2026-09-27M 观战时停修复批**（已实现，待实机验收）：时停中 AI 的弹丸整发冻住，**你自己打出的**照飞照回收
  （定点打一发 → 按 K 把它停在空中；或先按 K 再打 → 弹道照常飞出去并照常结算 —— 观战特权口径不变）；
  制导巡飞弹时也能按 K；顶部栏常驻「⏸ 时停中 (K 继续)」；回主菜单 / 战局结束自动解除时停；
  海战音频只剩自己在开的那条艇在响。清单与证据见 PLAN §一.31 + finished-docs/archive/交付文档-时停修复批-20260927M.md。
  实机关注点：① 时停中把一发炮弹打向人群附近，确认它**不会**隔空引爆冻结点旁的人（旧版会，实测 404 血）；
  ② 幽灵坦克连射几十发后控制台读 `tracers.length`/`shells.length` 不再线性增长（旧版每条曳光一个新 Mesh）；
  ③ 海战图开时停：除自己在开的艇外应听不到破水/履带周期声；④ 制导巡飞弹时按 K 应立刻停/走（旧版按了没反应）；
  ⑤ 回主菜单再「继续游戏」，战场应当是**在走**的（旧版仍是静止的）。
- **2026-09-27 瞄准吸附特性**（已实现，待实机验收）：游戏设置 →「瞄准吸附」三档（关/轻度默认/标准），
  只把"差一点打中的那一枪"轻轻掰进目标本体 35% 深；普通瞄准/开镜/载具火力（主炮·机枪·炮位·航炮）生效，
  隔墙/穿过队友一律不吸；`AIM_ASSIST` 只读视图可当场核对（控制台）；验收清单与数值表见 PLAN §一.30 + 交付文档。
  实机关注点：强度是否合手（可微调 `AIM_PROFILES`）、开镜档是否比腰射"更黏手"、载具主炮远距离手感是否变"会自动修正"。
- **2026-09-12 胡康巨桥改版**（已实现，待实机验收）：640 大地图深谷激流（w26/d14）+ 巨型大龙河大桥（跨76/宽14/门塔×2 可登顶+塔顶高炮/水中墩排）+ 三路扇面 7 旗（中线巨桥/北石拱桥/南徒涉滩三条过河通道, own 开局 3v3+桥心中立）+ 徒涉滩语义（ford 滩心涉渡/滩外激流）+ 桥面不布炮规则 + 雾距主题×图幅相乘重构；实机三 BUG 修复（浮空拉索删除/激流区哨塔迁岸/登塔梯岸上重设计+豁口随塔侧）；验收清单见 PLAN §1.6。

- **2026-09-12 淞沪环形水乡包**（已实现，待实机验收）：五旗环形（A东渡/B北圩/E丝厂/C西村/S南圩）+ 丝厂二层屋顶制高 + 圩田剖面 + 鱼塘藕塘水车柳林 + 石桥桥头堡 + 主河加深须过桥；验收清单见 README §8 2026-09-12(淞沪环形) 条。
- **2026-09-12 莫斯科城市边缘改版**（已实现，待实机验收）：640 大地图城网街块（主街+5纵街+2横街+16街块+教堂广场）+ 三路扇面 6 旗（东村/河湾村两翼→编组站/街垒区/工厂→教堂）+ 厂区坦克产能（苏军持"工厂"旗重生 ×1.8）+ 城缘反坦克带（龙牙/机枪堡/反坦克壕，公路缺口为唯一装甲走廊）+ 严寒启用 + 东郊冰河与雪原村道；验收清单见 PLAN §1.5。
- **2026-09-10 三图地貌包**：a. 淞沪一眼水乡（河道网+水田+田埂+农舍组团，石拱桥可走坦克，浅水减速无伤害）；b. 百团一眼黄土沟壑（深沟/塬面/窑洞可进可炸，铁路专线，Bot 不下沟）；c. 莫斯科一眼雪岭防线（雪线分带，龙牙碾不动，机枪堡可进，铁路木桥）。
- **2026-09-09 柏林加密**：主街街墙连片、庭院填充、街道家具（电车轨/残骸/街灯）、国会大厦打不烂无浮空、**帧率**（物件 +90%）、地铁穿行不受影响。
- **2026-09-09 柏林改版**：地铁两站/隧道穿行、防空塔上屋顶+塔顶 88 炮、三路推进 6 旗与小地图街网。
- **2026-09-06 斯大林格勒改版**：14 点位读图、厂房产能播报与出库、厂房沦陷回落、Bot 部署上车、防护夹墙观感、东郊麦茬软遮蔽。
- **2026-09-06 B8 SVG 材质**：胡康/雪峰山水面近观、冰面裂纹、弹坑焦土、帐篷/篷布/绷带等布纹。
- **B7a/B7b**：击杀/爆头/占旗记分与改前一致、结算节奏一致（本轮 verify-wipe 已覆盖记分单源）。

---

## 五、回归基线（每批必跑）

- **本轮（地图与载具设计缺陷批 2026-09-26D）已跑**：13 个改动 JS（00-config / 03-terrain / 05c-layouts / 07-nav / 14-bots / 15-vehicles / 15d-naval / 15f-battery / 16-aircraft / 17-emplacements / 20a-seats / 23-deploy）+ `index.html` 逐文件 `node --check` 全过 ✅ · **新增 2 个复核脚本**（`_audit-fixes-verify-20260926` 13 ✓/0 ✗ · `_mapfix-verify-20260926` 12 图四项普查全绿）+ **4 个专项探针**（`_spawnflat-probe` / `_defworks-probe`（含 TDZ 反向对照）/ `_steppe-pocket-probe` / `_village-cell-dump`）+ **13 次 boot 的 `verify-navspots-20260926` 判罪 0**（修前每次换局 1~3 个死袋）· **`run-all-verify` 全量 21/21 次运行 exit=0 · 全部通过 ✔**（verify-boot · verify-text（戳 `20260926b → 20260926c` 41 处 + `__sfStyleVer`）· **verify-layouts 12 图指纹** · verify-worldrestore · verify-fire · firecap · sink · spec · specthird · tankai · vehmodels · foliage · `_audit-foliage-ref` · probe-bots · probe-planes · probe-slope · **verify-nav-20260926 正向 8/0 + 阴性 7/1 报红** · **verify-fixbatch-20260926 55/0 + 阴性 5 红** · verify-navspots（实际落点 27 人 / 死袋 0 人）· verify-naval 9 通过/0 失败/2 跳过 · verify-animfix-20260926 36/0）· 作者既有契约套件（`_battery-selfcheck` 83/83 · `_fkey-selfcheck` 16/16 · `verify-bugfix-20260925` 71/71 · `probe-navtable` 0 退出）全绿 ✅
- **本轮"首跑红"的定位记录（两条，均为判据口径过期而非代码缺陷；定位脚本 `dev/_navleg-diag.js`）**：
  1. **`verify-nav` ④「干净端点路径零穿墙段」8 段红（雾林守线，连跑 6 次恒为 8 ⇒ 非 RNG 漂移）** ⇒ 本批 P0-3 把边判据从「格心连线全通」放宽成「中线**或** ±`NAV_EDGE_PAD`(1.5m) 平行线全通」（`edgeOK`），而探针仍按放宽前的严格中线 `lineClear` 判段 ⇒ 假红。逐段量测：8 段全是 5~7m 的**单格步**、中线被一件 **1~2m 点状道具**挡住、**侧面 0.5~1.25m 即空走廊**（±1.5m 平行线全通）⇒ 是"擦角"不是穿墙。修法：`07-nav` **导出 `edgeOK`** 作为不可通性的唯一判据（探针不再另抄一份平移逻辑），探针 ④ 改判 `NAV.edgeOK`、严格中线不过的段只报不判（附最小可通侧移），并新增 ⑦ **真几何合成对照**（`addBoxCollider` 摆件 + `NAV.refresh()` 重烘焙真 OCC）：1m 厚 × 14m 长墙**必须被拒**（实测拒）；点状道具**逐档量出可绕行上限** —— `0.2/0.4/0.6/0.8m 立方` 中线阻/走廊通（放行），`1.0m 立方` 走廊也阻（判死）⇒ 放宽的适用范围是量出来的，不是想当然。**教训：判据必须与被测语义同源；放宽是有意的，就别拿旧的严格口径去判输出。**
  2. **`verify-fixbatch` ②-h 两条红** ⇒ 字符面断言还在找 P1-13 的旧写法 `(this.pilotWaitT+=3)`（本批把单位从**帧**改成**秒**、并把累加从"3s 回退边界那一次"挪到**每帧**），行为断言因此测到 `-1s`。修法：断言改查"每帧 `+=dt` + 到期把回退清零"，并**先去掉行注释**再查旧写法不在（注释里刻意留旧写法作对照 —— 不去注释就会被自己的注释绊倒），行为断言实测 **10.0s**。**教训：源码判据要连单位一起断言（`+=3` 这种帧单位硬编码，语义上是"秒"的时候判据看不出来）。**
- **本轮（动画/模型缺陷批 2026-09-26B）已跑**：14 个改动 JS（00-config / 05a-buildings / 05b-props / 05c-layouts / 10-viewmodel / 11-soldiers / 12-ragdolls / 14-bots / 15-vehicles / 15b-trucks / 15e-navmodels / 16-aircraft / 20-player / 20a-seats）+ `dev/run-all-verify.js`（登记本批新探针）逐文件 `node --check` 全过 ✅ · **新增 1 个复核脚本** `verify-animfix-20260926`（A 类 12 条 + B 类 13 条 + C 类 3 条，含 `--neg`）**正向 36 ✓/0 ✗ · 阴性对照 20 组报红** ✅ · **真 three r152 量几何**（挂点世界高度 修前 −0.236m → 修后 +0.100m；玩家蹲姿鞋底 −0.210/−0.351m → +0.013/+0.003m 且与 Bot 逐位一致）· **真 cannon 0.6.2 量物理**（布娃娃七条约束初始误差 站 0.110 / 蹲 0.415 / 趴 0.415m → **全 0**；`probe-ragdoll` 陡坡最大升空 **4.93m → 0.02m**、滞空 109 帧 → 0 帧、各图 0/6 起飞）· **`dev/verify-a21-j.js` 修前修后同为 23/25**（①′ 头颈盒 0/56、④′ 手到武器面 0/56、② 挂点单源全绿；①″ 是 README 2026-09-25 已登记的**既有失败**，已用 `--nopp` 变体证明与本批无关，候选修法与影响面见交付文档 §4）· **`run-all-verify` 全量**（含本批新登记的第 24 条）：`verify-vehmodels` 10/10 · `verify-buildings` ALL PASSED · `verify-layouts` 12 图 ALL PASS（含本批**有意**布局改动：23 处射击孔恢复楣上段 + 2 图基地碉堡转向 ⇒ fp 整体上移）· `verify-worldrestore` 10/10 · `verify-sink` 全过 · `verify-boot` / `verify-text` / `verify-fire` / `firecap` / `spec` / `specthird` / `tankai` / `foliage` / `probe-bots` / `probe-planes` / `probe-slope` 全绿 ✅ —— **`run-all-verify` 合计 21/21 次运行 exit=0 · 全部通过 ✔**（另: `_battery-selfcheck` 83/83 · `_fkey-selfcheck` 16/16 · `verify-fixbatch-20260926` 55/0 · `probe-empl` 0 退出）（00-config / 05a-buildings / 05b-props / 05c-layouts / 10-viewmodel / 11-soldiers / 12-ragdolls / 14-bots / 15-vehicles / 15b-trucks / 15e-navmodels / 16-aircraft / 20-player / 20a-seats）+ `dev/run-all-verify.js`（登记本批新探针）逐文件 `node --check` 全过 ✅ · **新增 1 个复核脚本** `verify-animfix-20260926`（A 类 12 条 + B 类 13 条 + C 类 3 条，含 `--neg`）**正向 36 ✓/0 ✗ · 阴性对照 20 组报红** ✅ · **真 three r152 量几何**（挂点世界高度 修前 −0.236m → 修后 +0.100m；玩家蹲姿鞋底 −0.210/−0.351m → +0.013/+0.003m 且与 Bot 逐位一致）· **真 cannon 0.6.2 量物理**（布娃娃七条约束初始误差 站 0.110 / 蹲 0.415 / 趴 0.415m → **全 0**；`probe-ragdoll` 陡坡最大升空 **4.93m → 0.02m**、滞空 109 帧 → 0 帧、各图 0/6 起飞）· **`dev/verify-a21-j.js` 修前修后同为 23/25**（①′ 头颈盒 0/56、④′ 手到武器面 0/56、② 挂点单源全绿；①″ 是 README 2026-09-25 已登记的**既有失败**，已用 `--nopp` 变体证明与本批无关，候选修法与影响面见交付文档 §4）· **`run-all-verify` 全量**（含本批新登记的第 24 条）：`verify-vehmodels` 10/10 · `verify-buildings` ALL PASSED · `verify-layouts` 12 图 ALL PASS（含本批**有意**布局改动：23 处射击孔恢复楣上段 + 2 图基地碉堡转向 ⇒ fp 整体上移）· `verify-worldrestore` 10/10 · `verify-sink` 全过 · `verify-boot` / `verify-text` / `verify-fire` / `firecap` / `spec` / `specthird` / `tankai` / `foliage` / `probe-bots` / `probe-planes` / `probe-slope` 全绿 ✅ —— **`run-all-verify` 合计 21/21 次运行 exit=0 · 全部通过 ✔**（另: `_battery-selfcheck` 83/83 · `_fkey-selfcheck` 16/16 · `verify-fixbatch-20260926` 55/0 · `probe-empl` 0 退出）
- **本轮"首跑红"的定位记录（两条，均为本批自己引入并已修掉）**：
  1. `verify-worldrestore` 稳定报「运行期异常 `12-ragdolls.js setFromAxisAngle`」+ `verify-sink` 报「`CANNON.Quaternion is not a constructor`」 ⇒ 真因是本批 A4 初版**在生成路径上 `new CANNON.Quaternion()`**，而本仓多个沙箱的 `CANNON` 是半截桩（无 Quaternion 构造器）。改用 cannon 自身的 `body.quaternion.setFromEuler(th,yaw,0,'YXZ')`（已用真 cannon 实测 `vmult(局部+Y)` 与 `locP` 的站位方向一致）⇒ 两套全绿。**教训：跨沙箱的生成路径只能用全仓桩都实现过的 cannon API**。
  2. `verify-vehmodels` 4 项红（②⑤⑥⑨）⇒ 定位到 A5 初版给履带加的**两块侧贴面**：沙箱桩忽略网格旋转，一块躺在 x 向的 6m 长平面把实测包围盒/半宽整片撑破（半宽量到 3.05m）并顶破"坦克 ≤36 网格"护栏（黑豹 36→38）。改成"只动纹理矩阵、不加网格"（`rotation=π/2` + 贴数现算 + 滚动按每贴世界长度）⇒ 10/10。
- **本轮（A* 寻路核心 + 海战命中/绕向 + 出生死袋闸 2026-09-26A）已跑**：15 个改动 JS（07-nav / 17-emplacements / 00-config / 16-aircraft / 13-combat / 15d-naval / 15-vehicles / 15e-navmodels / 06-engineering / 03-terrain / 23b-worldrestore / 14-bots / 10-viewmodel / 15f-battery / 05c-layouts）+ index.html 逐文件 `node --check` 全过 ✅ · **新增 3 个探针**：`verify-nav-20260926`（A 类，含 `--neg`）**正向 6/6 · 阴性对照 6/9 图报"非纯"** · `verify-fixbatch-20260926`（B/C 类，含 `--neg`）**正向 54 ✓/0 ✗ · 阴性对照 5 红** · `verify-navspots-20260926`（出生/旗点体检 + 开局实际落点）**草原遭遇 27 人零人卡死袋、百团南进攻营已回主分量** · **`run-all-verify`（含本批新登记的三条）21/23 次运行 exit=0**（唯一重试仍红的是 `verify-naval` 红线7「两栖车 Bot 上岸并开火」——**已用回退 A/B 证明与本批无关**：把本批的 13-combat 挡弹与 15d 命中上限原地回退后连跑 4 次仍 3 红，且"艇 tReach=null"同样出现；该判据卡在阈值边缘（终水深 0.61 vs 0.55），舰船 AI 本身不走 `findPath`、不经本批任何改动）✅（verify-boot 12/12 · **verify-text**（版本戳 `20260925a → 20260926a` 40 处 + `__sfStyleVer` 同步）· **verify-layouts ALL PASS**（moscow fp=582422 / woodline fp=324870 含本批两处**有意**布局改动：龙牙 28→22 颗、岭上村模板换档）· verify-worldrestore 10 组 · verify-fire / firecap / sink / spec 56/56 · specthird 58/58 · tankai · vehmodels · foliage · probe-bots · probe-planes · probe-slope）· **作者既有契约套件**：`_naval-model-selfcheck` 87/87 · `_naval-selfcheck` 80/80 · `verify-seabatch` 8/8 · `verify-bugfix-20260925` 71/71 全绿 ✅ · 临时量测脚本 3 个（`_navaround` / `_finemap` / `_navcap`）。
- **本轮"首跑红"的定位记录（三条，全部查明并修掉；两条是本批自己该修的、一条是判据自身锚点过窄）**：
  1. `verify-bugfix-20260925` 静态键闭环报「06-engineering.js → 此处无法架设」缺词典 ⇒ 确是本批新增中文提示漏登记，补 `00b-i18n` 词条（并在我自己的验收探针里加同一条断言防复发）。
  2. `verify-spec` T8 报「index.html 版本戳与 `__sfStyleVer` 不一致」 ⇒ 本批只 +1 了 40 处 `?v=`，漏了内联 `window.__sfStyleVer`（同一个坑 2026-09-20d 那批也踩过），两处同步后 56/56。
  3. `probe-navtable` 报「补丁失败: 未匹配 return」 ⇒ 该探针原先**抄全了 07-nav 的整条 return 语句**做锚点，本批在导出表里加了 `spawnSpotOk/spawnSpot` 就失配 —— 与"判据别写死原文/行号"是同一教训；锚点改成稳定前缀 `... lineClear, `（加导出前后都存在）。
- **本轮（窗下材质·跳墙判定批 2026-09-20c/d）已跑**：7 个改动 JS（00-config/02-scene/05-world/05a/05b/05c/15b）+ 1 个改动桩（`dev/_structbase.js`，补真实 `BoxGeometry` 面 UV 与 `clone()`）+ 2 个新增脚本（`dev/verify-uvscale.js`、`dev/probe-wall.js`）`node --check` 全过 ✅ · **verify-uvscale（新）23/23** ✅（A 段载入**真实 02-scene**：UV_DENSITY 与 `MAT.*.uvRef` 逐值一致 / 有贴图建材无漏登记 / 雪盖与绿篱不受影响；B 段建**真实世界**：全部面 `UV 跨度×S = 世界尺寸`（最大偏差 7.6e-7m）/ 同材质"一张贴图覆盖的世界尺寸"跨度 **1.0000×** / 整段墙板 vs 窗台墙垛同密度 / 未登记材质与非盒构件保持原 UV / `uvGeo` 不改写共享几何；**阴性对照**：旧口径跨度 47×（岛）/166×（诺曼底））· **probe-wall**（逐墙片）13 战役：顶面偏差 **0.00m**、引擎口径站立面 0 缺口、超视觉墙面外溢 ≤0.10m（多数 0.05）、贴墙跳仿真"判定挡路 = 0"（失败全为物理上限/上方净空不足）· **全家桶**：verify-buildings（全战役 ALL PASS）· verify-layouts（ALL PASS，指纹零漂移）· verify-boot 12/12 · verify-padground 16/16 · verify-seaedges 13/13 · verify-svgtex(34 生成器) · verify-spec 56 · verify-wipe 81/0 · verify-restart 5 组 · verify-worldrestore 10 组 · verify-audio-mute 10 组 · verify-returntomenu 13 组 · verify-records 11 组 · verify-fallstam / sink / firecap / fire / text / menucam(4) / roof2 / menuart 全过 · **verify-menucards 32/0（无头 Edge 打真实 index.html）** · 探针 probe-struct（缺口/凹坑/门槛数与上一批持平，无漂移）/ water(50) / slope / spawn / spawnpoints / spawnspot / navtable / planes / empl / ragdoll / hukawng / songhu-fix / match 全过 · 版本戳 `?v=20260920b → ?v=20260920d`
- **本轮的两条「首跑红」定位记录（均非本批代码缺陷）**：
  1. **`probe-factory` ⑥「Bot 部署上车」/ `probe-bots` 单图偶发红**：多次重跑复现为随机波动（probe-factory 3 次里 1 次过、probe-bots island 2/2 过）；本批只动几何 UV 属性，与 AI/驾驶/寻路无关 ⇒ 属既有随机项。
  2. **index.html 编码事故（自伤）**：改版本戳误用 PowerShell 文本管道导致整页乱码 + 10 处 `</div>` 丢左尖括号（DOM 错位 9 个未闭合 div）。抢修后按**原始字节文件的逐行 div 深度剖面**核对：94 行差异全消、0 处剖面不一致、末尾深度 0、标签配平 0 错配；无头 Edge 真机打开验证菜单/小地图/中文正常、`bootFail` 未触发。教训写入 README §七。

- **本轮（观战扩展批 2026-09-17）已跑**：12 个改动文件 + 2 个新增文件（`js/15c-specveh.js` 与 `dev/verify-spec.js`）`node --check` 全过 ✅ · **verify-spec（新）53 断言 0 失败** ✅（T1 连狙定义/换装单源/部署配枪/即时换装三者同步 · T2 弃弹传送 · T3/T3b 幽灵坦克不入表+免伤+上下车+team=-1 炮弹+**友军与敌军同样吃伤害** · **T4★ 弹丸穿透**（穿过幽灵坦克命中其身后坦克；阴性对照=换成普通坦克则被挡住） · T5 悬停/气动两态开火 · T6 `SHELL_R` 判定（阴性对照=反坦克炮弹同几何仍不命中） · T7 生命周期收车/再召唤/换局 · T8 十三条接线静态断言）· **既有全家桶 18 个沙箱全绿** ✅（verify-wipe 81/0 · verify-boot 11/11 · **verify-layouts 11/11 PASS 指纹零漂移**：normandy 289331 / stalingrad 184535 / berlin 382950 / songhu 222293 / baituan 315037 / burma 71675 / moscow 546674 / hukawng 401167 / steppe 112079 / woodline 285421 / canyon 23848 · verify-buildings 11/11 · rooffall / roof2 / sink 11 图 / fire / firecap / fallstam / returntomenu(13) / restart(5) / records(11) / menucam(4) / worldrestore(10) / svgtex(31) / menuart / audio-mute(10)）· 探针 probe-bots（乱斗 60s 推演 + 1v1 决斗全过）/ probe-empl / probe-planes 均 0 退出 ✅ · 版本戳 `?v=20260917b → ?v=20260917c`
- **两种「首跑红」的定位记录（都不是本批代码缺陷，但仍按项目惯例查明并留证）**：
  1. **首轮 4 个沙箱红**（`verify-wipe`/`boot`/`sink`/`fallstam`/`records` 报 `LOAD FAIL js/24-main.js: updateSpecVeh is not defined`）——真因是**既有沙箱各有自己的加载清单**，清单里没有本批新增的 `js/15c-specveh.js`。**修法**：新模块的所有跨文件调用一律加 `typeof` 守卫（24-main 主循环 / 23-deploy 出生列表与部署 / 20-player 交互与提示 / 22-hud 小地图与换局收车），既修沙箱也符合项目"可选模块不拖垮主循环"的既有写法；加守卫后 18 个沙箱全绿。
  2. **verify-wipe T11「矮障碍不阻挡」偶发**（`80 通过 / 1 失败`）——本批**连跑 8 次 = 6 次 81/0、2 次 80/1**，与 2026-09-17 世界还原批记录的"基线副本连跑 8 次同样 2 次失败"完全同档；另用带追踪的临时副本查明：失败run 的位移发生在**第一帧、`vel` 恒为 0**（静态碰撞体推挤，非 AI/驾驶/武器），且该沙箱**根本不加载本批新增文件**、T11 走到的全是本批未改动的代码（`Tank.update` 推挤段 / `tankRideH/tankSurfH` / RGRID 查询 / 世界构建）⇒ 属该用例既有随机项（基地附近道具落点抖动），与本批无关。临时追踪脚本已删除。
- **本轮（音效停止批 2026-09-17）已跑**：3 个改动文件 + 1 个新增文件（`dev/verify-audio-mute.js`）`node --check` 全过 ✅ · **verify-audio-mute（新）10 组 0 失败** ✅（结算后 14 个发声入口 0 新声源 / 定时器来源两面对照：未静默时远雷 2 声源 · 环境定时器 80 次触发 236 声源，静默期均 0 / 静默期 `setAmbientMute(false)` 不许解锁 / 用户原话路径=结算→回主页面静默 / 回战局与开新局解静默且引擎可重建发声 / 暂停静音互不干扰 / 控制面不被闸掉）· **全家桶 19 个 verify 全绿** ✅（verify-wipe 81/0 · verify-layouts 11/11 指纹零漂移 · verify-worldrestore 10 组 · returntomenu 13 组 · restart 5 组 · records 11 组 · menucam 4 组 · boot / buildings / rooffall / roof2 / sink / fire / firecap / fallstam / svgtex / menuart / menucards(32/0)）· 版本戳 `?v=20260917a → ?v=20260917b`

- **本轮（世界还原批 2026-09-17）已跑**：2 个改动文件 + 1 个新增文件（`js/23b-worldrestore.js`）`node --check` 全过 ✅ · **verify-worldrestore（新）10 组 0 失败** ✅（T1 快照非空/边界 · T2 重复拍快照不覆盖 · **T3 ★破坏确实发生=敏感度对照**（还原若是空操作 T4~T6 必红）· **T4 ★逐项还原**（碰撞盒/圆柱/可毁结构/屋顶链/植被/实例矩阵/燃料/占位表/旗面 + **OCC 校验和**）· **T5 ★视觉复位**（可毁结构网格回挂 world、无"未毁却丢网格"、实例矩阵逐元素相等、植被网格不被沉入动画留在半空）· **T6 ★场景无残留**（人/尸体/碎块/粒子/在途弹清零，scene 台账项数复位）· T7 幂等 · **T9 ★用户路径**：打烂 → 结算 → 回主界面 = 干净地图 · **T10 阴性对照**：冻结战局不还原（继续游戏仍能接着打）· T11 就地重开单位数不累加 35→35）· **verify-wipe 81/0** ✅（首跑 80/1 是**文档已记录的 T11「矮障碍不阻挡」坦克碾压随机项偶发**；本批专门做了对照实验：把本批改动全部撤回的基线副本连跑 8 次**同样 2 次失败**，改后的当前树同批连跑 8 次 0 次失败（此前另一轮抽样里当前树曾 3/6 —— 该用例本就随机，两侧都会偶发）→ 与本批改动无关，属该用例既有偶发）· verify-boot 11/11 ✅ · verify-returntomenu 13 组 ✅ · verify-restart 5 组 ✅ · verify-records 11 组 ✅ · verify-menucam 4 组 ✅ · **verify-layouts 11/11 PASS（本批未动世界构建/布局，指纹零漂移）** ✅ · verify-buildings / rooffall / roof2 / sink / fire / firecap / fallstam / svgtex / menuart / menucards(32/0) 全过 ✅ · 版本戳 `?v=20260916f → ?v=20260917a`（新脚本 `js/23b-worldrestore.js` 与全部引用一起换戳，避免 file:// 直开吃缓存旧脚本；**同日音效停止批再升到 `?v=20260917b`，见 §一.13**）

- **本轮（P0 就地重开·对局态复位 2026-09-17 二报）已跑**：3 个改动文件 `node --check` 全过 ✅ · **verify-restart（新）5 组全绿** ✅（T2★ 用户原话精确复现：1.5s 前奏中途开新局 → 新局跑满 2 秒仍不结算 / 打完一局开新局连跑 3 秒不结算 / 征服图 900s 限时复位 / respawnCd 与本局计数复位 / **T5 阴性对照**：脏哨兵一帧必结算）· verify-wipe 81/0 ✅ · verify-boot 11/11 ✅ · verify-returntomenu 13 组 ✅ · verify-records 11 组 ✅ · verify-menucam 4 组 ✅ · verify-layouts 11/11 PASS（指纹零漂移）✅ · verify-buildings / sink / fire / fallstam 全过 ✅
- **本轮（战绩记录批 + 主菜单背景航拍 2026-09-17）已跑**：8 个改动文件 `node --check` 全过 ✅ · **verify-records（新）11 组全绿** ✅（首战即纪录/逐项比对含"阵亡越低越好"/K-D 口径/观战不计入含粘性真实路径/旧键 `sf_best_*` 迁移/脏存档容错/本局计数复位/面板读数与刷新/主菜单静态结构）· **verify-menucam（新）4 组全绿** ✅（回主界面后相机在高空航拍位且**逐帧真的在动**、`fov` 回 74、暂停与结算期相机纹丝不动、四处接线静态固定；桩里给 `performance.now()` 装了可控时钟）· **verify-wipe 81/0** ✅（首跑 80/1 为文档已记录的 T11「矮障碍不阻挡」坦克碾压随机项偶发，连跑 2 次均 81/0）· verify-boot 11/11 ✅ · **verify-returntomenu 13 组全绿** ✅ · **verify-layouts 11/11 PASS（指纹零漂移）** ✅：normandy 289331 / stalingrad 184535 / berlin 382950 / songhu 222293 / baituan 315037 / burma 71675 / moscow 546674 / hukawng 401167 / steppe 112079 / woodline 285421 / canyon 23848 · verify-buildings / rooffall / sink / fire / firecap / fallstam / svgtex(31) / menuart 全过 ✅ · 版本戳 `?v=20260916d → ?v=20260916f`
- **本轮（同图重开 P0 修复 + 主菜单「继续游戏」批 2026-09-16 二批）已跑**：`node --check` 全过 ✅ · **verify-returntomenu 扩到 13 组用例全绿**（新增 T0 首页按钮态/置灰、T9★「同图打完→回菜单→开新一局」把 P0 根因钉死：**开局后 `player.deployed/alive` 必须为 false、兵种选择界面必须给「部 署」**、T11「新游戏覆盖未打完的局」确认/取消、T3/T4 继续游戏"未落地回兵种选择 / 存活直接回战斗"）✅ · verify-wipe **81/0** ✅（首跑 80/1 是 T11「矮障碍不阻挡(车体未被推离)」——坦克碾压判定含随机项的老偶发，与 2026-09-13 批次记录过的同一现象一致；连跑 3 次均 81/0）· verify-boot 11/11 ✅ · verify-layouts 11/11（**指纹零漂移**）✅ · verify-buildings / sink / fire / fallstam / firecap / menucards(32/0) ✅
- **本轮（返回主界面批 2026-09-16）已跑**：8 个改动文件 `node --check` 全过 ✅ · **verify-wipe 81/0** ✅（关键：本批一度把 `startGame` 困在 `initMenuUI` 作用域内、并改成"点进入战场就整页重载"，两处都让 verify-wipe 的 `startBtn.onclick()` 失效 —— 60/1 → 12/17；现以"就地重开 + `startGame` 提级模块级"修回，工作树与 HEAD 两版测试文件各跑一遍均 0 失败）✅ · **verify-returntomenu（新）11 组用例全绿**：开局仍是一次成局 / 兵种选择阶段返回(无确认) / 回到战局接续同一局(票与单位数不变) / 已落地返回需二次确认(取消不动) / 暂停面板返回后不是暂停态 / 丢锁门控 / 结算页接管冻结权 / 结算页返回为初始态 / 首屏开局不重载 / 结算后就地重开单位数不累加(35→35) / 常规首屏 ✅ · verify-boot 11/11 ✅ · verify-layouts 11/11 PASS（**本批未动世界/寻路/布局，指纹与基线逐字节一致=零漂移**：normandy 289331 / stalingrad 184535 / berlin 382950 / songhu 222293 / baituan 315037 / burma 71675 / moscow 546674 / hukawng 401167 / steppe 112079 / woodline 285421 / canyon 23848）✅ · verify-buildings ALL PASSED ✅ · verify-sink / fire / fallstam / firecap ✅ · verify-menuart / menucards 32/0 ✅
- **本轮（续杯 + 战役卡二次排版批 2026-09-16）已跑**：5 个改动文件 `node --check` 全过 ✅ · **verify-wipe 81/0**（原 61/0；T15 续杯新增 20 条：发放/续满/升级优先/9 杀后仍续/断链不续/窗口 5.000s 边界/阵亡清零/倍率不受影响 + HUD 与 CSS 再接线）✅ · verify-boot 11/11 ✅ · verify-layouts 11/11 PASS（**本批未动世界/寻路/布局，指纹与 2026-09-13 基线逐字节一致=零漂移**：normandy 289331 / stalingrad 184535 / berlin 382950 / songhu 222293 / baituan 315037 / burma 71675 / moscow 546674 / hukawng 401167 / steppe 112079 / woodline 285421 / canyon 23848）✅ · verify-menuart 11/11 战役 × 33 份 SVG ✅ · **verify-menucards（新）32/0**：无头 Edge 打真实 index.html，4 视口 × 中英双语实测"文件夹卡+3 张直排卡"同处一行（1600/1280 视口卡宽 172、900 视口 160）、标题零截断、卡底空白 0px ✅
- **本轮（菜单画面+首屏+战役卡排版批 2026-09-13）已跑**：`node --check` 全过 ✅ · **verify-menuart（新）11/11 战役 × 33 份 SVG 全过**（XML 良构/url(#) 闭合/同页 id 唯一/非法数值/空产出与退化）✅ · verify-layouts 11/11 PASS ✅ · verify-boot 13/13 ✅ · verify-wipe 61/0（首跑 60/1 为偶发，连跑 3 次全 61/0）✅ · verify-svgtex(31) ✅ · **浏览器实测（本机 Edge 无头）**：①游戏页首帧 `getComputedStyle(#ui)=display:none`（`<body class="inMenu">` 原生承担，摘类后 block）；②11 张沙盘 + 双方盾徽落入 DOM 且同页 id 无冲突；EN 存档下 `lang-en` 盖章后被摘除、英文文案生效；兜底 `bootFail` 未误触发；③**战役卡排版逐卡实测**：中英双语下 13 张卡 `scrollWidth ≤ clientWidth`（零截断）、外层 4 张尺寸统一 196×102、副题均 1 行 ✅
  （注：该批"零截断"结论有实测口径偏差 —— 2026-09-16 复测显示英文"断崖公路"模式行 174px > 旧卡内容宽 176px 中的可用值，仅富余 2px；本批已把它记为已知例外，见 §一.2 二轮表）
- **布局指纹（当前树基线，2026-09-13 菜单批后）**：normandy 289331 / stalingrad 184535 / berlin 382950 / songhu 222293 / baituan 315037 / burma 71675 / moscow 546674 / hukawng 401167 / steppe 112079 / woodline 285421 / canyon 23848。**说明**：normandy 与 steppe 相对上一份记录（224445 / 109848）的差异经受控实验确认属**本会话之前的未提交批次**（暂存工作树 → `git checkout HEAD` 三个文件 → 复跑得同一组指纹），与本批改动无关；本批对布局的改动为零（仅战役副题文本）。
- **沙箱全家桶**：verify-layouts / buildings / rooffall / boot / sink / wipe / svgtex / fire / firecap / fallstam / menuart / **menucards（需本机 Edge）** / **uvscale（新）** / padground / seaedges / **probe-wall（新）** + probe-bots / planes / empl / match / metro / factory / struct / water / slope（各脚本用法见 README §2 目录树）。
- **本轮（连杀奖励批）已跑**：9 个改动 JS `node --check` 全过 ✅ · verify-wipe 61/0 ✅ · verify-boot 13/13 ✅；probe-match 长跑被中止未完成（本批不涉世界/寻路/布局，风险低，下批合并跑）。
- **本轮（莫斯科城市边缘批 2026-09-12）已跑**：5 个改动 JS `node --check` 全过 ✅ · verify-layouts 13/13（moscow 本体 fp 533680；未动 7 图与百团批快照逐字节一致；normandy/stalingrad/berlin/songhu/baituan 5 图系会话前未提交批次造成的漂移，还原本批改动实测无关，以当前树为新基线）✅ · verify-buildings 13/13 ✅ · verify-rooffall/boot/sink/fire/firecap/fallstam/wipe(61)/svgtex(31) ✅ · probe-bots/planes/empl/metro/factory/slope/ragdoll ✅ · probe-match moscow 3 局（德 1/苏 2，旗权往复健康）✅
- **本轮（胡康巨桥批 2026-09-12，含实机三 BUG 修复）已跑**：8 个改动 JS `node --check` 全过 ✅ · verify-layouts 13/13（胡康 fp 113060→401167 本体；**非改 12 图与改前基线指纹逐字节一致=零漂移**）✅ · verify-boot 13/13 ✅ · verify-buildings 13/13（修村寨足迹重叠 4 处）✅ · verify-rooffall/roof2/sink（修基地碉堡出生环带）/fire/firecap/fallstam/wipe(61)/svgtex(31) ✅ · probe-songhu-fix/hukawng(新增)/bots/planes/empl/metro/slope/ragdoll ✅ · probe-factory 1 项偶发连跑 3 次全过 ✅ · probe-match hukawng 4 局（own 修正后开局 3v3+中地区对称, 东胜 4/4 与 burma 对照同分布=探针东侧固有偏强）✅ · 胡康专项断言阴性验证 3 组全红（跨 76→60/ford r→0.01/谷深 d→3）✅
- **布局指纹**：本批仅莫斯科条目/布局函数改动；verify-layouts 新增莫斯科专项断言 6 条；verify-sink 结构选取跳过 onDead 组（修钢水包钩子干扰碎石堆计数断言）。
- **本轮（雾林许特根批 2026-09-13）已跑**：9 个改动 JS `node --check` 全过 ✅ · verify-layouts 13/13（woodline fp 120499→285421 本体；12 图与改前工作树指纹逐字节一致=零漂移）✅ · verify-boot 13/13（woodline assault 330→413）✅ · verify-buildings/rooffall/roof2/sink/fire/firecap/fallstam/wipe(61)/svgtex(31) ✅ · probe-bots/planes/empl/slope/ragdoll/metro/factory/hukawng/songhu-fix ✅ · probe-match woodline 2 局（初始 [0,0,1,1,1,1,1], 旗权 2,5↔6,1 往复健康, 20.3/20.4 分钟美军胜）✅ · 雾林专项断言阴性验证 2 组全红（沙箱副本谷深 8.5→3 红"谷深不足"/走廊内单颗龙牙红"走廊被堵"——借阴性验证把走廊断言从"只抓横跨墙"修正为"走廊内任何高度>0.4 实体盒"）✅
- **布局指纹**（当前树基线, 2026-09-13 雾林批后）：normandy 224445 / stalingrad 184535 / berlin 382950 / songhu 222293 / baituan 315037 / burma 71675 / moscow 546674 / hukawng 401167 / steppe 109848 / woodline 285421 / canyon 23848 / xuefeng 195355 / taihang 316007。
- **工作区清理（2026-09-28，无游戏代码改动，verify-text 全过）**：dev/ 283→105 —— 一次性探针/-tmp 变体/_patch*.py/输出产物（dev/out/、*.txt/log/png）共 171+203 项已删；保留集 = run-all-verify 注册表 ∪ 记忆契约点名工具 ∪ 被保留代码点名者（依赖检查脚本自动把关）；备份 tar 在系统 TEMP（sf-cleanup-backup-20260928.tar.gz），tracked 删除可 git checkout -- 还原。31 份历史交付/审计/设计文档移入 finished-docs/archive/（本文档与 README §8 的 33 处文件名引用已同步改写）。今后约定：交付文档写 finished-docs/；一次性探针收批即删，长期工具才进 run-all-verify 注册表或记忆契约。
- **本轮（巡飞弹TV遮罩加点料×跳跃头顶钗制批 2026-11-10）已跑**：**①TV遮罩 OSD**：#tvOv 由光秃扫描线扩为 FPV 风格视讯（四角标×4／顶栏 ●REC 闪烁+TV制导·TV GUIDANCE+时间码 T+mm:ss.d+▂▄▆█ LINK 信号条／中央分划刻度+中心框／底栏 离地(AGL)·速度／右栏 离机距离／存续条 280px 按 life/lifeMax 排空／存续<4s 整框红脉冲 tvOv.low+填充条转红（与 magN 同阈值）／右键开镜显 ZOOM ×2.8 标——与 updateCamera 同判据 mouse2Down&&!_ltRClick）；逐帧驱动全走 hudText/hudStyle 去重缓存；弹体存续上限出膛记账 d.lifeMax=24（HUD 兜底 ||24）；i18n 三字码词条 离地ALT/速度SPD/离机DST。**②跳跃头顶钳制**：病根=竖直只有 standHeight 落地支撑无「天花板」概念——上升段头(pos.y+1.7)探进上方盒/柱纵带 ⇒ collideMove 横推接管，楼板正下方 d≈0 走「最近边」整只横向甩出=实报穿模穿墙。修=两件套缺一不可：headCeilClamp 单源（04-collision，零分配槽 _hcS，底面穿越窗=(上帧头顶,本帧头顶]，XZ 半径 0.42 与横推同口径，命中取最低底面钳 pos.y=底面-1.7）+ HEAD_GRAZE=0.06 擦碰容差进 _cmBoxCb/_cmCylCb 纵带门（钳停那帧 pos.y+1.7 与底面仅差浮点尾数，无容差横推仍接管；底面低于该档的肩高障碍照常横推）；接线=20-player 两条步兵积分路径（步行+TV制导本体），Bot 竖直 dampF 贴地永不上升不接线。**判据**：新 dev/verify-tvosd-headbonk-20261110.js 正向 27/0+NEG 4 补丁 13 红对认（N1 摘步行钳制 ⇒ 连跳 maxY=0.783 探入楼板+被横推甩出 2.42m=病灶精确复现；负对照 桌沿不误钳/落地墙照推/测试盒卫生恒绿）。**探针坑四新**：①测试盒以世界原点为中心没罩住出生位=全链假绿（盒须以玩家为准）②天花板压 3.0m 档假绿——自由跳高仅 4.6²/26≈0.814m 根本撞不到，须压 2.0m 档并双断言（≤上限 且 >0.2m 证真撞过）③NEG 多行锚撞 22-hud CRLF 必失配（单行锚）④探针卫生勿写 BOXES.length=idx（截断数组），逐个 indexOf+splice。**并发**：大舰下架批同树并行——戳 20261110a→b 由并行会话升 index.html/_game_files.txt，本批补钉 5 戳钉探针；verify-vehburn 3 红（die 接线/SHOW_CTL_HINTS 行数/大舰面板行）属并行批进行时漂移非本批引入。run-all 未跑（用户裁定尽快收尾），待实机验收
　详表见 README ⑧八同日行与 finished-docs/批-巡飞弹TV遮罩OSD×跳跃头顶钗制-2026-11-10.md。
- **本轮（淞沪垂柳修复×实例批化×交互接入批 2026-11-10）已跑**：**①连接重写（05b willowTree）**：旧病=三根主枝盒中心硬摆离干轴 0.5m 半空（干顶实际只随 tilt 歪 ±0.17m）+冠片/垂条各自独立散布=枝不接干/冠不裹枝/条不挂冠；修=主枝根**钉干顶**（干顶世界位+枝向×0.58−0.12 下嵌，顺干倾斜）+冠片 7 片蓬进枝梢高度带 [3.0,4.0]+垂条 12 条顶**锚进冠带** [3.3,3.9] 水平钳进冠幅（中心=条顶+q·(0,−L/2,0)，微摆只偏下摆）；部件姿态全程手算四元数（_wqAxis/_wqMul/_wqRotV，不调 THREE 方法=轻沙箱桩无 set/multiply 纪律），建模期与运行期读同一份部件表（wt/wb/wl）永不漂移。**②实例批化**：WILL_BATCH+flushWillows()（buildWorld 末尾 flushTreeBatch 之后）→ 干/枝/叶冠 3 张 InstancedMesh（WLOW_IM），淞沪 ~79 棵×23 件 ≈1800 draw call→3；实例索引 干=wi/枝=wi*3+k/叶=wi*19+k（前 7 冠后 12 条，04b 同序）；instColorInit 白初始化+frustumCulled=false 三张全关。**③交互接入（旧版纯摆设根因=不入 TREE_LIVE/FLORA_HASH/燃料表）**：05b 登记四件套（TREE_LIVE.push kind:'willow'+floraHashAdd+fuelAdd(1.0)+CYLS foliage:true 三虫批①口径）+04b 五处门（treeIgnitePass 认柳 3.2m 邻域/explosionFlora 认柳 obj=false 走实例批矩阵/floraCrushTank 认柳车体接触即撞倒/格烧尽排除柳不 vanish/烧尽焦黑=19 叶零缩放+干枝 4 实例染 _charCol）+willowInstanceMatrices(tr,th,dy) 单源（Rodrigues 手算绕根轴旋转+冠锚跟随；倒伏/沉入 th=1.5+dy=−3.6k/焦黑叶冠跳过三态全走它）+沉入与乔木同口令（16~22s+3.6s 匀速，全沉 23 实例零缩放+dead 出账）+23b snapIM 三张批快照还原（倒伏/焦黑/沉入态随世界快照走）。**④wr 流保序**：每棵柳 135 次 wr 消耗顺序逐位保持（1+3×2+7×8+12×6）——79 调用位与改前 golden 采集逐位一致；拒绝采样（propFree/freeSpot）在消耗 wr 之前 early-return ⇒ 接受位=调用序**保序子列**（本轮 75/79 拒 4），golden 钉子列而非等长逐位（PROPS Math.random 泄漏下拒哪几棵可跨轮波动，子列判据对任何拒绝组合成立）。**判据**：新 dev/verify-willow-20261110.js（vehburn 同款真 three boot，战役钉 songhu+天气钉 clear=柳图默认 rain 压火）**正向 39 绿/0 红×3 稳定**（源钉 7+登记 9+连接性 5〔探针侧手算四元数复算：枝根≤0.35m 实测 max0.237/条顶锚冠带/条挂冠 1.35m 实测 max1.256〕+燃烧链 5+爆炸掀倒 4+碾压 4+地面火链 2+golden 子列钉 1）+**NEG 9 补丁 --only 单钉逐个亲见转红**（N1 登记降级 kind→②-1/②-6/⑧-1 · N2 枝脱锚→③-1 · N3 条顶脱锚→③-3/4/5 · N4 点火不认柳→⑦-2 · N5 爆炸不认柳→⑤-1~4 · N6 碾压不认柳→⑥-1/2/4 · N7 叶不隐藏→④-3 · N8 沉入不分派→④-5 · N9 flushWillows 摘除→②-6/7/8+④-3/4/5+⑤-4+⑥-4；累积模式 N1 让 W1~W4 全缺互相掩盖故加 --only）。**受影响既有探针**：verify-sink（选择器补 kind==='tree'——柳入 TREE_LIVE 后首个 alive 可能是柳）/fire/foliage/layouts 全过。**run-all 两轮**：r1（柳探针注册前进场）80/82 exit=0 唯一红 aimassist 偶发（3× 复核 1/0/0，后连跑 5 绿归因）；r2（柳探针进册首秀）84/86 exit=0 **柳探针 39/0 全绿**+两偶发 _audit-foliage-ref/verify-fieldfix（各 3× 复核 0/0/0，r1 皆绿）——两轮合计 164/168 **稳定红=0**（历史 naval 红线7 随海战图下架消失）。**探针坑五新**：①willowN 陷阱=采集脚本 __wtLog.length 是调用数(79) 而 TREE_LIVE 接受数=75（拒绝在 wr 消耗前 early-return）②沉入断言不能拿"沉前 y>0.5"（全沉终态=零缩放平移分量也归 0）须下沉增量双采样+终态零缩放+标死三段式③NEG 整行替换 if 留孤儿 else=语法错，用 if(false) 门（乔木空路径 setMatrixAt(NaN) 是静默 no-op 不炸）④NEG 摘 flushWillows ⇒ WLOW_IM=null，所有直读 G 表达式与 sim 循环（焦黑分支/倒伏分派）都会抛 TypeError——阴性轮要红名不要崩溃，全部 !!WLOW_IM 短路+try/catch⑤N1 让 W1~W4 全 undefined ⇒ 各行为段 [skip] 守卫。**升戳 20261110b→c**（node 整文替换：index.html 48+_game_files.txt 44+16 戳钉探针 72=164 处，代码零残留，18 戳钉探针复跑全绿；b 值由并行海战移除批所升）；并发多会话同树（海战移除/巡飞弹TV/空情三虫）全程重 grep WLOW_IM/flushWillows/kind:'willow' 确认零覆盖。**实机关注**：①淞沪沿河/村口/草原村柳枝干冠条连贯无悬空枝盒②燃烧弹或沿岸火烧进柳下→0.4s 内树冠起火→6~8.5s 烧倒→焦黑停留 16~22s→沉入③爆炸近距掀倒（背离爆心）/坦克撞柳即倒（×0.94 减速）④柳 draw call ~1800→3⑤世界还原含柳三态。**范围裁定**：柳软遮蔽（floraLosBand 加柳档）会改 Bot 感知+verify-foliage bandOf 交叉验证需跟走——超出"修复连接+交互"范围记后续项。
　详表见 README ⑧八同日行与 finished-docs/批-淞沪垂柳修复实例批化交互接入-2026-11-10.md。
### 2026-11-11 实机回归修复：淞沪柳全消失（compose 普通对象四元数 NaN）
用户实机报「我注意到，现在的情况是柳树全都消失了。」（昨日批收尾探针 39/0×3 全绿——实机专属路径漏检）。**病根两处同型（皆批内新代码）**：vendor three.min.js 的 Matrix4.compose 读四元数 ._x/_y/_z/_w 私有字段（minified 实证 compose(t,e,n){…r=e._x…}），05b flushWillows _q（:275）与 04b willowInstanceMatrices _wlQ（:556）却是普通对象 {x,y,z,w}（注释误信「compose 只读分量」）→ 旋转+缩放分量全 NaN → 75 棵×23 实例顶点被 GPU 整批丢弃=实机隐形；平移分量 te[12..14] 不受影响 ⇒ 探针 ②-9 平移钉+③ 探针侧复算+④ 沉入平移增量钉全漏检（沙箱照绿）。**修**：两处改 new THREE.Quaternion() 真实例+按分量赋值走 setter 落 _x（不调 .set/multiply 纪律保持；bootstub Quaternion 可构造/compose no-op=桩无感；flushBushes/flushTreeBatch 既有先例同款）。**判据升级**：verify-willow 增 ②-10 初始矩阵全量 NaN+零旋转列扫描/②-11 旋转分量数学期望逐位钉/④-6 交互态扫描 → 正向 42/0×3（bug 在场时三钉全红=回归钉亲验）；NEG 锚未动映射不变；sink/fire/foliage/layouts 四桩探针全过；run-all 两轮：r1 78/95（窗口内含并行批升戳+脚本清单 44→45 变动：firecap 红=**本批首版修复自引入回归**（04b 顶层 new THREE ⇒ 无 THREE 装载器加载期 ReferenceError，当场修=fireTmp 懒初始化纪律，复跑 exit=0）+commander/fieldfix/loiterview 稳定红=并行批载入钉（归并行批）+matseam 偶发）；r2 82/102（柳探针/firecap 全绿；稳定红仅 commander/fieldfix/loiterview/achieve-20261111 四支全数并行批在途面〔含其当日新探针〕，nav/aimassist/deathflight 偶发单次）——**本批 owns 面（柳/firecap/sink/fire/foliage/layouts）两轮全绿**；升戳 20261110c→d（并行批 2026-11-11 00:26 所升——时序在本批代码修复之后、扫描不含本批文件，恰好一并 cache-bust 本批修复；本批未另升戳）。**新律三条**：①compose/实例矩阵路径禁普通对象四元数（真实例+分量赋值）；②矩阵类断言必须含全量有限性扫描——只钉平移的矩阵钉漏检 NaN 旋转；③模块顶层禁 new THREE——无 THREE 装载器（verify-firecap 单文件隔离装载）加载期即 ReferenceError（本批首版修复实录；改走 04b fireTmp 懒初始化纪律后 exit=0）。
　详表见 README ⑧八同日行与 finished-docs/批-淞沪垂柳修复实例批化交互接入-2026-11-10.md 实机回归节。

### 2026-11-11 成就系统批 + 实机反馈批（数据成就双页签 / 四成就 / 连跳修复 / 弹框加料+位置双形制 / 观战可达成 / 清除游戏数据 / 终身统计）
主令：「将主页面"战绩数据"改为"数据成就"，增加成就系统…（四示例成就）…观战模式无法达成成就」；实机反馈：「达成一次成就之后就会导致成就不停跳出来」「弹出框显示过于简陋，需要多加料」+ 改令「观战模式也可以达成成就」+「设置页再增加一个按钮：清除游戏数据」+「数据统计里增加总共击毁载具数、总共击杀数、总共死亡数、总共胜利数、总共失败数、总共占领旗点数等」；追加令：「游戏内容设置里控制成就提示是从右上部分还是正下方跳出来。两个地方跳出来的时候形制应当不太一样，但都要多加料。」设计文档《成就系统设计-2026-11-11.md》（R1 轮询普查账/R2 状态制否决归因/R3 七账口径/R4 判据/R5 观战〔后撤销〕/R6 sf_ach/R7 弹框〔后加料+双形制〕/R8 新文件兼容/R9 UI/R10 升戳 + §6 实机反馈批增补）。**实现**：新文件 js/27-achievements.js（普查账+0.5s 轮询+四成就+弹框+面板，顶层零 DOM）+三接线 typeof 守卫+双页签 UI+i18n+CSS；实机反馈批：ACH_TOASTED 会话闩+achToastPump shift 修复+加料 DOM（头章/🏆脉动/名称/描述/进度 achProgText 单源/高光扫过）+sf_ach_pos 位置双形制（posTR 右上竖卡/posBC 正下横匾，achPosBtn 单钮循环即时生效）+R5 观战门撤销（achIsSpec 删除）+clearGameData（sf_rec_*/sf_best_*/sf_ach/sf_stats 四类全清设置保留，clearDataBtn 两段式确认）+sf_stats 终身累计（statsAccumulate(winner) 挂 endMatch recCommit 后 winner 同源，观战局 counted 门不累计，vehKills 四处 die 链钩〔岸炮不计〕，recLifeHTML 六格）。**判据**：verify-achieve-20261111 正向 **69 绿/0 红**+NEG 10 补丁全开 47绿/22红全数对认（N1↔②-1~5+①接线/N2↔⑦-1+⑨-3 连带/N3↔⑥-5+①/N4↔①判据/N5↔③-3/N6↔①改名/N7↔⑨-1~3/N8↔①四处钩/N9↔⑪-3/4/N10↔⑫-1/2/5）+--only=N1/N2/N4 亲见转红；verify-text 全过。**探针坑五新**：①⑧-1 假红=四段各自 RESET 后采样存档只剩单成就 ⇒ 字面量 seed 与段序解耦；②ctx.setTimeout 同步执行 ⇒ 弹框链同帧顶掉内容，缩账须防 better_yiling 同帧双解锁（③⑩ 只缩烧账留植被/结构账）；③NEG 行中 // 注释三连坑（N3 吃 ") achUnlock"/N5 吃单行 try/catch 的 "}catch"/N10 吃 for 行尾 " }"）⇒ 整语句锚+块注释；④vm 裸名读未定义全局=ReferenceError ⇒ globalThis._x 读；⑤bootstub localStorage 原无 length/key ⇒ clearGameData 遍历需枚举能力（桩+探针 boot 双补）。**升戳 20261110d→20261111a**（index 49+_game_files 45+17 戳钉探针；d 值已被用户实机测试消费过=缓存风险，必须升）。**run-all 两轮**：r1 78/90——唯一 ✗ 面 commander×4/fieldfix×4/loiterview×4 = **本批插入 27-achievements 造成的判据漂移**（commander 载入位钉「26 紧跟 24」、fieldfix/loiterview FILES 清单 44 缺 27），跟码修钉三处（commander 载入位断言改 26→27→24 链、两探针 FILES 表插 'js/27-achievements.js'）后单跑全绿（151/0 · 34/0 · 26/0，fieldfix 的 T2 ragInit EXC 系偶发当场复跑绿）；本批新探针 verify-achieve r1 即 **69/0 exit=0**。r2 82/84——唯一红 _audit-foliage-ref ×2 = 柳批在案偶发族，3× 复核 0/0/0。**两轮合计稳定红 = 0**。
　详表见 README ⑧八同日行与 成就系统设计-2026-11-11.md §6。

### 2026-11-11 卡顿回归排查与修复批（火情放大 NAV 退级全量=主犯 / 簇级脏区 / 渲染税摘除 / 零分配槽位化 / HUD 去重）
主令：「现在我感觉卡顿问题比之前更严重了，请完成对于低效代码的排查和修复。该任务的广度和深度都较大，请善用子智能体功能。」→ 三路子智能体并行审计（全 45 脚本热路径 / 火情→OCC→NAV 链路专项 / 渲染分帧专项）交叉验证。**归因结论（乘法不是加法）**：柳树批把火情从单点变多前线，点燃旧版 NAV 增量算法的退级路径——occTouch 散点并成单外接矩形→面积超 REBAKE_FULL_FRAC=4%→fullBakeGrid（640 图 128~143ms）× fireNavT 5s = 每隔几秒定帧一次。**修复五组**：①OCC/NAV 簇级脏区：occTouch→OCC.pendList 簇表（occRectMerge 相交/≤3 格并簇+OCC_CLUSTER_CAP=12 退化单矩形兜底）+occDiffRects 行程聚类→OCC.dirtyList（簇表）+dirty（并集）双账+occDirtyClear 双清；NAV.refresh 逐簇 bakeRegion（任一簇超 4% 才全量兜底，navStats.fullBakes/partBakes/skipBakes 可观测）+buildSpatialIndex 按 _colIdxDirty 集合变更戳跳过（唯一失效点=树篱 CYLS.splice 已置戳，RGRID.idxRebuilds 供探针）；buildOccupancy 全量重建有意保留（2~5ms 正确性锚）。②渲染税：q1/q2 画布 CSS 滤镜摘除（不再每帧全屏合成）/阴影 -1 默认全档半频（显式 shadowFreq=0 才逐帧，换档补刷保留）/炸楼碎块 castShadow=false（塌楼瞬间不再 +192 draw call）/SMOKES_MAX=5 挤最旧。③零分配槽位化：枪锚点链三对外槽（_gaGrip/_gaFore/_gaAxis）+内部临时槽不写对外槽+legIKPose 交替双槽+_eulerXYZ/_gm/_gco+tankRideH/坦克碰撞模块回调+capAnchorWorld 懒建槽+gunEvents 原地压实（枪锚链每帧 250-350 分配=全库最大常驻 GC 源）+decide 距离门前置。④HUD：tickets 走 hudHTML 指纹去重+FPV 存续条宽量化整数%。⑤verify-perf T1 阴影判据跟码（q2 契约变更重钉：源码断言+奇偶无关行为断言）。**判据**：新探针 verify-perfreg-20261111 **43/0**（T1 簇合并/CAP 退化含退化矩形 ≥2R+10、T2 两处远距真火 fullBakes=0+partBakes≥2+集合门置戳/复位、T3 锚点三槽互不踩、T4 交替双槽、T6 烟雾挤旧、T7-T10 源码断言）+老探针跟走全绿（nav 8/fire/botai 53/animfix 39+66/perfgfx 48/willow 42/vehburnfix 12/achieve 69/perf 38/hudfix/text）。**★本批两条新律**：①**探针持槽引用跨帧=假红**——verify-radio ④-a/b/c⑤-c 把 gunMountOf 返回值存进 out 后隔数百帧序列化，槽位化后四份引用同 _gm 只剩最后调用值；A/B stash 对照（stash→探针→pop）证 HEAD 与工作树 got/want 逐位一致=游戏无罪判据失配→就地数值快照修钉（radio 40/0）；②**槽位函数必须自别名安全**——探针 handTorso `_eulerXYZ(h,...)` 传回上轮槽，逐分量先写再读读到已覆盖值→FK 损坏（⑤-e 0.0349m 假红）→入口 `const px=p.x,py=p.y,pz=p.z` 快照加固（游戏调用点本不踩，零行为变更）。bootstub 补桩：AudioParam ramp×4 位点+SpriteMaterial.dispose。**run-all**：r1 80/84 唯一稳定红=verify-radio（上述修钉后单跑绿）；r2 83/84 唯一红 matseam 偶发（3× 复核 0/0/0，在案偶发族）；perfreg 补入 run-all SANDBOX 清单后 r3 **84/85** 唯一红 aimassist 偶发（3× 0/0/0）且 **perfreg 入册首跑 43/0**——三轮合计稳定红 0（r3 首跑曾因清单新条目漏尾逗号整轮崩：ASI 把后续 `['...']` 行解析成计算成员访问=undefined 塞进数组，`node --check` 查不出，隔离 eval 才暴露=本批新律④）。**升戳 20261111a→20261111b**（171 处/19 文件，未与 run-all 并发）。
　详表见 README ⑧八同日行与 finished-docs/批-卡顿回归排查与修复-2026-11-11.md（含"有意不动清单"五项裁定留档+实机验收清单）。

### 2026-11-12 实机反馈批：士兵避车 × 三面板排版（游戏说明键位表化 / 设置卡片行化）
三令：「士兵不会把载具等当作障碍物，导致被卡住」「游戏说明部分排版太过于凌乱」「游戏内容设置和性能与画面的内部排版也很凌乱」。面板方案经用户裁定（均选推荐项）：设置=卡片行式，说明=键位表+要点化。
**①士兵避车（js/14-bots.js）**：`_botMoveProbe` 加载具壳体障碍探针三件套（`_vehObsDims/_vehObsTest/_vehProbeBlocked`，OBB+0.5m，尺寸与推挤**同参**：坦克 hx=max(2.05,halfW)/hz=hullL/2+0.45、卡车 1.05/3.7、两栖艇同坦克；残骸照挡=街口卡死最常出实体；toVehicle 认领目标豁免〔贴壳才够到 _surf<0.55 上车判定〕+yMax1.9 高门+游泳/甲板行人放行）；moveDir 备选角扫描自然沿壳绕行，dirFlip 兜底侧移也要过探针（不通则本帧驻足）；脱困绕行点（stuckN≥3 垂直插点）拒壳内。**★端到端探针实锤第二病根**：首版 T7 红（minSurf −0.5）——`_vehObsTest` 的轴对齐外接盒粗筛拿**局部** mx/mz 当**世界**轴界，横车（yaw=HPI）两界正好互换 ⇒ ±0.55/±1.1/±1.65 全误放行侧腹撞壳（`probes[BFBFBFB]` 对称指纹定位）；修=世界 AABB `wex=|mx·cs|+|mz·sn| / wez=|mx·sn|+|mz·cs|` 随 yaw 旋转（yaw=0 与旧界相同，T3/T4 判据零扰动）；修后 minSurf **+0.23**（贴壳 23cm 绕过+越过+到达）×5 轮全绿。
**②游戏说明键位表化**（index.html+style.css+00b-i18n.js ~40 词条双语拆分）：分节卡片 helpCard / 键位表 hkRow（hkKey 键帽+hkDesc 动作）/ 小节 hkSub / 要点列表 helpPts（▸）；设置面板卡片行化：setCard（setTitle+setCtrls 控件右+setDesc 说明），全部按钮 id 与词条字节保留，画质三按钮行保留 setCtrls 内。
**判据**：新 dev/verify-obstacleavoid-20261112.js（bootstub 全链真开局，战役8）正向 **30/0×5 轮** + **--neg 三补丁 14 红全数对认**（A 探针门退场 12 红/B 绕行点门 T2-b/C 粗筛退回局部界 T2-i+T4x-a，三新钉亲见转红）；受影响探针 botai 53/0（NEG 17 红=预存账一致）·parity 51 全绿·perfreg 43/0·radio 40/0·achieve/aimassist/perfgfx/text 全绿。**run-all 两轮**：r1 81/89——唯二稳定红 hudfix T5+cmdui 指挥官锚=**本批键位表化判据漂移**（F1/集火锚改 hkRow 形制），判据跟码修钉后单跑全绿；r2 **83/83 全部通过 ✔** 零红。**升戳 20261111b→20261112a**（171 处/19 文件，未与 run-all 并发）。
**探针坑四新**：①OBB 前的粗筛轴界必须随 yaw 旋转（判别点取"两界之间"窗 |dx|∈(mx,mz) 才钉得住）；②端到端红先逐帧插桩（pos/sd/分支/七角探针序列/探针点独立挡放）再归因——"lookahead 盲区"是假病根，真身是粗筛误放行；③openSpot 净空环要带周边环（occBlocked 第三参未传=深水按挡，undefined≠false）；④NEG 'to' 串删中间条件后必须括号平衡。
　详表见 README ⑧八同日行与 finished-docs/批-士兵避车与三面板排版-2026-11-12.md。

### 2026-11-12 动态换弹速度 × 死亡时视角=击杀者（killcam）批（游戏内容设置两新项）
两令：「①动态换弹速度：开/关，默认关。开启后实际换弹速度=预设换弹速度*(已消耗的弹夹容量/总弹夹容量)。②死亡时视角：自己/击杀者，默认自己。选择"击杀者"时：先是一瞬间和现在相同的视角，随后转入击杀自己的 Bot 的有滤镜第三人称（和 U 键第三人称不同。如果是自杀则和选择"自己"时相同），再正常切入重部署页面。重部署页面不变且不会受这个选项影响。」——三路子智能体代码调研（设置UI/换弹链/死亡相机链）+ killcam 网络检索（时长宜短/部分去饱和优于全灰/收尾压黑过渡）后施工。
**①动态换弹速度（sf_dynreload 默认关）**：单源 `dynReloadFac(mag,cap)`（00-config，系数=已耗÷弹匣，满匣〔被换弹门拦〕/容量非法回退 1）；玩家唯一生产点 19-input tryReload 的 `VM.stateDur` 尾乘——VM 动画/读条/3P 镜像/R 加速全按 nt 比例自动跟随（调研实证无固定时间线）；**Bot 与玩家同规**：14-bots 六处 reloadT 起点全乘（唯二真实变档点=1985 主动补弹 <40% 档，弹尽档系数恒 1 行为不变）；车载/固定武器纯 CD 制不在范围。
**②死亡时视角（sf_deathcam 默认自己）**：die() 目标解析（slots/crewBot 双认；自杀/环境死 null/丧尸等无 slots ⇒ null 回退）→ updateCamera 死亡分支 killcam 档（specView 让位后）：**0.5s 落回原死亡环绕（=现状视角）→ 首帧剪切击杀者背后追尾**（dampF 跟随+遮挡收近+地水下限+fov60，纯观察不附身）+ 画布部分去饱和滤镜 grayscale(0.62)（只在窗口临时挂，平时恒 'none' 的 2026-11-11 性能批口径不破坏）+ #kcInd 角标；**killcamEnd 收账单源**三点接线（showDeploy/endMatch/enterSpecView）+分支自愈；**重部署页面时序零改动**（die() 两个 addMatchTimeout 原样钉死）。
**判据**：新 dev/verify-dynreload-deathcam-20261112.js（真 three boot 真开局）**正向 43/0**（换弹三档数值+fac 单元+killcam 真链 12 断言+设置钮四例）+ **NEG 十补丁全开 15 红全数对认** + --only=N4/N5/N6/N7/N10 单钉亲见转红（N5 掩盖 N10/相机面、N4/N5 掩盖 N6/N7 行为面）。**探针坑三新**：①沙箱同步 setTimeout 桩令 die() 的 addMatchTimeout(showDeploy) 当帧执行=killcam 账被当帧收掉的假红（实机异步无此问题）→ 探针 boot 改队列不执行；②开局后 curW=null 须 rearmPlayerClass(0) 建槽；③bootstub classList no-op → 探针补 Set 版可观测 classList。
**run-all 两轮**：r1 **84/84 全部通过 exit=0**（新探针入册首跑 43/0）；r2 **88/90**——唯二单次红 fieldfix/botai 均 3× 复核 0/0/0=偶发（run-all 自带复核+本机复跑 26/0、53/0 双确认，在案偶发族与本批零交集）——**两轮稳定红=0**。**升戳 20261112a→b**（171 处/19 文件，未与 run-all 并发）。
**实机关注**：①开动态换弹打 1~2 发即换明显变快、打空=原时长、动画读条不错拍②死亡视角=击杀者：0.5s 原镜头→硬切击杀者背后追尾（灰滤镜+☠角标）→2.8s 照常进部署页；自杀/坠地/淹水/丧尸杀不切；被坦克打死切乘员视角③击杀者同帧换杀跟布娃娃不崩④死亡视角=自己一切照旧⑤killcam 期 2~3 秒轻微帧率开销属滤镜合成预期。
　详表见 README ⑧八同日行与 finished-docs/批-动态换弹速度与死亡视角击杀者-2026-11-12.md。

### 2026-11-13 观战中立 × 七项修复批
七令：①观战小队 Bot 地图白点+仍跟随玩家 ②飞机残骸坠落穿楼（系统性）③幽灵坦克/巡飞弹中按 Q 附身视角错乱（用户提议：该两态禁 Q）④换弹中左键取消换弹难受（希望=按 R 同效）⑤观战不够中立：幽灵坦克车载机枪/观战连狙打不中"开局己方"飞机、AT 雷无法直击"己方"载具 ⑥投掷物模型放大 ⑦出生离世界边缘屏障（防"房子朝向+边缘"卡死）。两路子智能体调研（小队/着色/coFfFire/投掷链/出生链 + 飞机坠落-残骸链/Q附身/换弹取消链）后施工。
**①观战小队中立（22-hud/23-deploy/14-bots/18-game 小队HUD）**：着色单源 `solMapDotColor(s)`（22-hud 紧跟 mmEnemyVis）：观战→己方一律蓝 `#5a9eff`（**白点=指挥官特权视角，观战不发**）/敌红；普通局 inSquad 白照旧；小地图+大地图循环、部署图着色全消费单源；观战隐藏小队 HUD 面板；14-bots 小队令块加 `!player.spectator` 门——观战期间小队**不再听玩家令**按 pickObjective 正常作战。
**②飞机残骸穿楼（16-aircraft 四处）**：残骸坠落段补建筑扫掠（复用 alive 段共享零分配扫掠槽 `_plSw*`，机鼻余量 `(w.size||3)*1.5`；命中沿来向拉回 0.4 + `state='rest'`；爆炸/结构伤害 `ageT>0.6` 门）；地面贴地档加 `state==='fall'` 门（防楼内嵌地）；残骸记录补 size/ageT；**撞楼 die 位拉回命中面前 0.5m**（旧出生位≈帧末积分位已嵌墙）。
**③Q 附身门（20-player 单点）**：`dbgSpecPossess` 头部门（onVehicle/onNaval/loiter → 拒绝+提示"驾驶/巡飞弹中无法附身"）。19-input 观战工具键块**不放门**——timestopfix T8 契约"块内不许出现 loiter 让位门"（2026-11-06 flyaim 裁定巡飞中 J/K 照常），r1 首版双门实锤该契约回归后收拢单点。
**④换弹左键豁免（19-input）**：左键取消入口加 `!(VM.state==='nade'&&player.nadeHeld||VM.state==='reload')`——换弹中左键=无事发生（与 R 同效不打断）；**举雷左键取消=2026-10-25 有意例外保留**。
**⑤观战中立补齐（13-combat/20-player+归因三文件）**：对空链 `planeHitTest(…,coFfFire(shooter)?-1:shooter.team)`（中立全队可命中）；投掷物出手盖章中立 `team:(thrower.spectator?-1:thrower.team)`（throwNade+手持迫击炮弹）→AT 雷触发圈按弹体 team 直击"己方"载具（引信武装+接触语义不变）；归因门三处 `attacker&&(coFfFire(attacker)||attacker.team!==this.team)`（15-vehicles/16-aircraft/15d-naval）→观战毁"己方"资产照常记分。
**⑥投掷物放大（09-weapons）**：`NADE_WORLD_SCALE` 1.5→2.5（出手件单源；VM 手模/预瞄圈不耦合）。
**⑦出生离边（00-config 单源+五路接线）**：`SPAWN_EDGE_MARGIN=20`；17-emplacements `spawnEdgeLim/Ok/Clamp` 三件套（lim=MAP_SIZE/2−4−20）+pickSpawnPoint 候选闸（rejEdge 入 _spawnDiag）+findFreeSpawn 循环闸+兜底钳回；07-nav spawnSpot 快路/搬迁/fallback 三门；26-commander cmdSquadSpawnNear；23-deploy 小队铺开。
**判据**：新 dev/verify-specneut-20261113.js（boot 淞沪，14 NEG 补丁）**正向 55/55**（T1 着色矩阵/T2 行为面直调 decide 含非观战对照/T3 空中立端到端 40m/T4 AT 雷引信点直击/T5 归因记分/T6 残骸贴楼顶/T7 die 位墙面外/T8 拒附身双态+步行照常/T9 读条口径/T10 离边四链/T11 锚 21）+ **NEG 27 红全数对认**（N1~N11b 红名↔补丁逐一对账，绿项恰为未补丁对照）。**探针坑四新**：①NAV.findPath 返回 [x,z] 数组对（followPath 用 wp[0]/wp[1]），.x/.z 读法=NaN；②T2 对照 bot 须距玩家 >10m（follow 分支 d>10 门）否则落 defend 假红；③T4 手雷步进 splice 时序 → wrap nadeExplode 捕获引信瞬间坐标；④T7 淞沪无 40m 纯陆地走廊 → 接受深水走廊（水面当"地面"）。老探针跟码：verify-nade-trigger NADE_WORLD_SCALE 钉 1.5→2.5。
**run-all 两轮**：r1 80/109——7 稳定红全部归因**判据跟码、零真回归**（phase4-7c S4 对空锚/structscore damageStructures 调用点 11→12/timestopfix T8 契约〔Q 门收拢 20-player 单点〕/commander SQUAD 锚/nadecancel+animfix+batch-20261030 LMB 锚×3；vehburnfix 偶发 3×复核绿），跟码修钉后单跑全绿；r2 **85/85 全部通过 exit=0 零稳定红**。**升戳 20261112b→20261113a**（49 处/index.html + dev 全量戳钉同步）。
**实机关注**：①观战小队蓝点不跟随+小队 HUD 消失②连狙/幽灵坦克机枪可击落"己方"飞机且得分③AT 雷直击"己方"载具爆炸④残骸贴楼顶不穿楼⑤幽灵坦克/巡飞弹中 Q 无效（弹提示）⑥换弹中左键不打断⑦手雷出手件 2.5×⑧出生点离边 ≥20m。
　详表见 README ⑧八同日行与 finished-docs/批-观战中立×七项修复-2026-11-13.md。


### 2026-11-13 巡飞弹离膛武装距离 × TV 加速标批
两令：①「巡飞弹飞出去有一小段无敌时间能穿墙…应当是当初修复'在有坡度的地方发射巡飞弹会直接爆炸'的BUG的遗留…希望优化/修复，使其更加贴合现实」②「巡飞弹视角的 hud 在加速/右键放大的时候应当有变动」。
**病根**：fireLoiter grace:0.8（秒）+ updateLoiters 未武装分支全跳命中检测 ⇒ 巡航 ≈10.4m / 加速 ≈32m 无敌穿墙窗（起爆圈 9.5m/240 贴脸必死，当初为护坡地自爆整段豁免）。
**改口径（真实弹药离膛武装距离）**：LOITER_ARM_DIST=3（00-config 单源）——①命中检测（静态体/坦克/飞机/士兵不分敌我）逐帧照跑含未武装段；②未武装撞掩体/单位=**哑弹撞毁**（不炸不伤+冒烟+scorePop「⚠ 巡飞弹未武装即撞毁 (离膛 3m 内不引爆)」+loiterDespawn 静默退场；观战触物静默口径不变无提示条）；③未武装段地形不引爆+贴地爬升钳制保留（坡地发射病根照旧护住），武装后碰炸/触地炸零改动；④grace 账=剩余未武装飞行距离按 step 扣减，与弹速无关（加速 40m/s 不再拉长豁免窗）。**②TV OSD**：tvBotL 后缀「▸▸ 加速」（boost 同判据 keys.Space&&!player._ltSpace；开镜 tvZoom 2026-11-10 既有跟走）。
**判据**：新 dev/verify-loiterarm-20261113.js（boot 诺曼底 CF 走廊，六 NEG 补丁）**正向 36/0**（T1 哑弹五断言+过墙钉 maxDx<1.1/T2 武装碰炸三断言/T3 掠地爬升+武装触地炸/T4 巡航 3.03m≈3★ 加速不变★/T5 观战静默/T6 life 到期/T7 OSD 三断言/T8 锚 11）+ **NEG 23 红↔6 补丁对认**（锚 1/3/4/5/6/7 逐补丁红；N1 行为红被 N2 累积掩盖、T3 后红=泄漏链，均已知规则）。
**探针坑三新**：①globalThis 前缀与裸名混读不可靠（globalThis.X 赋值后裸读 X=ReferenceError）⇒ 探针全局一律裸名隐式全局（与游戏 function/var 同一真全局）；②CF 走廊豁免带 gh−0.4 以下地基盒不在豁免列 ⇒ "埋地"测试射线打中地下盒=哑弹假红，改"掠地 gh+0.05"（净空带内）才等价真实坡地掠行；③行为测试弹体账泄漏链（T4 测完武装态弹体仍在飞 ⇒ 后续 _fire 全 null）⇒ 每测尾 life=0.01+step 清账。
**升戳 20261113a→b**（index.html 49 处 + dev/_game_files.txt + dev 探针戳钉全量，未与 run-all 并发；★与并行 frameperf 批同戳 b，后续批升戳须跟码修钉本批戳钉）。
**run-all 两轮**：r1 85/89——本批探针 **0 败**（含 --neg）；obstacleavoid ✗1=偶发（3× 单跑复绿 30/0）；fixbatch ✗1=**并行 frameperf 批（run-all 未完）splashDamage 零分配改造（V3→_exOrg.set 槽）探针锚未跟码**——本批 13-combat 只动 fireLoiter/updateLoiters、splashDamage 未触碰且本会话开工首读已是 _exOrg 版，非本批回归。r2 **85/89**——唯一稳定红=fixbatch ✗1（套件 3 连跑 1/1/1=稳定，并行批自有账），obstacleavoid 偶发未复现，**本批零新增红**。
**实机关注**：①贴墙/贴掩体发射=哑弹浪费（弹撞毁+提示条，不炸膛）②坡地发射照常可用③3m 外撞墙/触地照常炸④TV 视角加速标 ▸▸ 加速 / 开镜 ZOOM ×2.8 变动⑤观战触物照旧静默。
　详表见 README ⑧同日行与 finished-docs/批-巡飞弹离膛武装距离与TV加速标-2026-11-13.md。


### 2026-11-14 飞机票数 × 冻结世界AI行动 × 音频冻结账 × 兵力票池批
四令：①「把飞机占的票数改为3，上面的驾驶员是1」②「时停中将坦克血量打至<=10%乘员主动下车（即使是在时停中）」③「时停时暂停，引擎声照常轰鸣。我认为这是一系列系统性BUG，请全面排查和修复」④「重新加回来选人数倍率的机制」。①口径询问未获应答，按唯一能让「改为3」产生实际变化的读法落地（有人机整体 3 票），实机验收可纠偏。存在并行会话：施工前全量 grep 现值、Edit 遇并行改动整文件重读后合并。
**①飞机票数（16-aircraft Plane.die）**：旧账=机体 TICKET_COST.plane(3)+驾驶员(Bot.die)1=**4 票/架**；新账 die 时 hadCrew 捕获 ⇒ 机体扣 `hadCrew?plane-1:plane` ⇒ **有人机整体 3 票（机 2+驾驶员 1）**，空机（含飞行员先跳伞）照旧 3，跳伞驾驶员单独阵亡照常 -1（全寿命上限仍 4）；常量不动（勿硬编码 3）。
**②冻结世界 AI 不得行动**：病根=14-bots 乘员起火弃车判定不吃 dt——乘员 Bot 走 onVehicle 旁路每帧都进 update（时停里 useDt=0 照样调用）⇒ 时停里照常弃车。修=`if(v.burning&&v.kind==='tank'&&dt>0)` 门：冻结期只挂 burning 账不动人，解冻第一帧照常弃车（死亡链不走此门）。同族：飞行员 <32% 跳伞在 takeDmg（事件驱动，时停里玩家照常打飞机）⇒ 跳伞块抽 `_bailCrew()` 单源+takeDmg 时停只挂 `_bailPend`，update(dt>0) 消费补跳，respawn 复位（不跨生死）。舰艇侧 15d update 头部 `if(!(dt>0)) return` 天然挡住，零改动。口径：死亡链（车毁/机毁人亡）不算 AI 行动照常结算，弃车/跳伞是要移动世界的 AI 动作冻结期一律推迟。
**③音频冻结账升级（24-main）**：喂入从 specTimeFrozen() 改**权威世界冻结账** `(rdt>0&&dt<=0)||gamePaused||matchOver||menuHold`，移到 dt 计算之后。**暂停洞**（=用户实报复现）：specTimeActive() 要求 !gamePaused ⇒ 暂停期喂入恒 false，setTimeFrozenMute(false) 把引擎增益恢复 lastVol——先开时停再按 Esc，togglePause 的 setAmbientMute(true) 静音立刻被下一帧喂入撤销；**布势洞**：cmdDtGate 布势回 0 从未进音频账。其余音频面排查全闭合零改动（createEngine 门+过渡账/ambMutes+updateWeatherAmbient/distantMG·bird 四态门/08-effects:464+20-player:1323 两处 setTimeout 尾音门/舰艇 navalAudioTick 逐艇 cdt 门）。rdt>0 门挡同毫秒双 rAF 退化帧；指挥减速（×0.2）不属于冻结，声音照常。
**④兵力票池加回大厅**：机制单源一直在（00-config HMUL+startGame `tk=Math.round(START_TICKETS*mul/2)` 读 sf_hmul），旧主菜单 hmulBtn 行随菜单改版被删（d66cef3）。新 UI=index.html 大厅「战场规模」行后 `#hubHmulSeg` ×0.5/×1/×2（i18n「兵力票池」键既有）+22-hud 接线写 sf_hmul，**开局读档生效**（×0.5≈83/×1≈165/×2≈330）；主菜单侧 .sizeBtn/.hmulBtn 死接线保留不动。
**判据**：新 dev/verify-batch-20261114.js（boot 淞沪+斯大林格勒，受控时钟直驱 loop）**正向 38/0**（T1 票数 有人机 die Δ=3★/驾驶员阵亡/空机 Δ=3 照旧；T2 乘员 冻结 10 帧仍在车上★/解冻 8 帧弃车/无时停对照；T3 跳伞 挂账不跳★/冻结帧账不动/解冻 3 帧补跳/对照立即跳；T4 音频八态含★时停+暂停保持静音★与★布势转静音★；T5 票池 index.html 锚+接线锚+83/165/330 端到端；A1~A5 防回退锚）+ **NEG 13 红↔5 补丁全数对认**（N1→T1a+A1/N2→T2a+A2/N3→T3a·T3b+A3/N4→T4d~T4g+A4〔T4h 绿=长度对齐已知规则〕/N5→T5b+A5）。**探针坑**：T5c 首版红=攻势图 startMatch 对守方票 ×1.25（83→104 不对称）⇒ 换 conquest 斯大林格勒做倍率判据。**老探针跟码修钉两支**：verify-fixbatch-20261104b（24-main 喂入锚→权威账串）+verify-vehburn-20261109（弃车锚→&&dt>0 版）；verify-aircollide ⑥-3 空机票 Δ 不变、verify-loiterfix L2 位置锚不受影响。
**升戳 20261113b→20261114a**（index.html 49 处+dev/_game_files.txt 45 行；★升戳坑新账：2026-11-10 海战移除批把版本戳断言铺进**全部 verify 探针** ⇒ 升戳必须 dev 全量 split-join，本批 16 探针文件 80 处——r1 曾按旧"四探头"口径漏面致大面积红）。**run-all 三轮**：r1 大面积红=升戳面误判（中途回归修复）+loiterarm 锚11 预存红（frameperf 批② TV OSD 抽 const boost 未跟码，本批跟码修钉）；r2 89/97（稳定红=fixbatch-20260926 预存〔并行 frameperf 批自有账〕+loiterfreeze 跟码竞态 2× 复绿）；r3 **90/97**——唯一稳定红=fixbatch-20260926 ✗1「splashDamage 掩体遮挡与 explodeAt 同式」（frameperf 批 V3→_exOrg 零分配改造自有账，非本批回归），loiterview ×1 偶发 3× 复绿；本批探针在套件内 exit=0（正/阴两态亲见）。
**实机关注**：①击落有人 AI 战机敌票条一次掉 3（旧 4），空机仍 3，跳伞兵补枪 -1；②时停里坦克 ≤10% 乘员不再下车、飞机机组不弹，解冻瞬间才弃车/跳伞；③时停+Esc 暂停全程静音，指挥官布势/K时停静音，减速照常；④大厅「战场规模」下新增「兵力票池」选择，下一局生效。
　详表见 README ⑧同日行与 finished-docs/批-飞机票数×冻结世界AI行动×音频冻结账×兵力票池-2026-11-14.md。


### 2026-11-14 巡飞弹OSD沉浸 × 护栏穿墙通用化 × 回主页再开局 × 趴姿膝弯 × 曳光圆柱批
五令六项：①「巡飞弹视角应该沉浸一点, 把血条、播报这些东西藏起来」②「巡飞弹视角的hud在加速/右键放大的时候应当有变动」③护栏穿墙修复（先报红砖两层小楼, 本批续报「不止红砖两层小楼有这个问题, 似乎大部分有护栏的都有这个问题」⇒ 通用化）④「回主页后再开新对局没反应/多点几次才进, 时好时坏」⑤「趴下移动膝盖向上弯曲, 和正常人类相反」⑥「打出的子弹的粒子总是方形的, 这不好」（①②⑤ 于前段会话落地, 本会话收口）。存在并行会话（同日票池批）: 全程 grep 戳现值/Edit 遇并行改动重读合并/升戳不与 run-all 并发。
**①②巡飞弹 OSD 沉浸+动态（22-hud）**：`_ltImmHud(hide)` 单源——TV 制导中隐藏战斗 HUD/播报层；OSD 驱动块逐帧写底栏读数（离地/速度+boost「▸▸ 加速」后缀/离机距离）、时间码、开镜 ZOOM ×N 实时读数、存续条；`hudClass('tvOv', low+boost+zoom)` 三态类；退场清账。
**③护栏穿墙修复+通用化（04-collision + 05a-buildings + 20-player）**：三件套——①collideMove 横推双门改**眼线 skip**（盒/柱底面高于 pos.y+1.5 = 头顶上方几何横推永不作为；旧压回分支整体删除——首版教训：压回档站立在眼线盒内被单帧压下 0.95m 落地块重着陆=跳跃每帧被吃，TMPDBG 实锤后重设计）；②headGrazeBlocked 起跳预检窗改 **(pos.y+1.5, pos.y+1.7]** 整段 0.2m（旧 6cm 窗护栏 0.9~1.1 档大多漏网）；③05a 塔台顶棚整体抬 0.6（柱 2.3→2.9/顶板 2.21→2.81，站护栏 0.95 头 2.65 原探进板底 2.12 达 0.53m，抬后余量 0.07）。**护栏安全判据 rail_top ≤ ceiling_bottom−1.7** ⇒ 三档无缝（≥净高档起跳由 headCeilClamp 穿越窗接管 / 0~0.2 探入档预检拦下 / ≤0.88 档穿越窗正常接管）。四处护栏核完：两楼 0.84 ✓/塔台 0.95（抬顶）✓/F2 rails 净空 0.5 ✓/屋面井开放天空 ✓。
**④回主页再开局双护栏（22-hud + 24-main）**：沙箱全链路诊断（repro 八支）证明两条复开逻辑路径全部干净 ⇒ 实机失效是**异常击穿**：①startGame 对 startMatch(+zombie钩) try/catch——中途抛 ⇒ 尾部旗标（menuHold/matchOver/matchRunning/showDeploy）永不执行=菜单僵住，半初始化再点=时好时坏；护栏后旗标保底执行+warn 带栈。②loop 帧级护栏 rAF 之后整段 try/catch——rAF 首位重排只保链条救不了函数体中途炸（每帧异常=画面僵死但 DOM 活）；节流告警 _loopErrN（前 3 帧带栈后每 600 帧心跳）+兜底渲染一帧防黑死。
**⑤趴姿膝弯方向（11-soldiers 单源 + 20-player/14-bots 两消费点）**：legIKPose 的 kneeUp（pole 向上=膝峰在髋踝线上方）几何上必然伴随小腿向脚尖方向折=反关节超伸；趴姿三消费点全 false 化 ⇒ 膝落回贴地段（0.09 级，交替极值 0.007 不入地）+膝弯转人类屈曲方向（脚跟朝臀）。站/蹲分支本就 false 不动。
**⑥曳光截面方→圆（08-effects）**：tracerGeo BoxGeometry(0.035,0.035,1.6) 正后方侧影恒方块 → 8 段圆柱 CylinderGeometry(0.0175,0.0175,1.6,8,1)+一次性 rotateX(HPI) 把 Y 轴烘到 Z 轴（配 spawnTracer lookAt 的 +Z 弹道朝向约定——three.js 普通物体 lookAt 本地 +Z 指向目标）；半径与旧盒半宽一致，池化复用与 340m/s 步进回池零改动。
**判据**：五支探针全绿——tvosd 重写 27/0（①②③判据）+ 新 dev/verify-proneknee-20261113.js **9/0**（NEG 4 红对认）+ 新 dev/verify-railclip-20261114.js **15/0**（NEG 5 红对认：N1→③-3/③-5/③-6, N2→③-8, N3→③-4）+ 新 dev/verify-bulletparticle-20261114.js **10/0**（NEG 4 红对认）+ 新 dev/verify-restart-20261114.js **14/0**（NEG 4 红对认：N1→④-1/④-2, N2→⑤-1/⑤-2）。
**探针坑七新**：①NEG 摘护栏必须吃满整块（孤儿 catch 炸语法）+22-hud 全 CRLF 锚须 \r\n；②N3 补丁串吃满整行（源行 prevHead 与 _hcS.hit=Infinity 同行，只锚前半段 ⇒ hit 复位被注释=headGrazeBlocked 带陈旧 hit 恒 true，诊断实录 hit=0.00）；③选点判据须在测试高度+二维蛇形网格（一维 120m 走不出连续建筑区；RGRID_OFF 选点前开）；④自己推的测试盒会推自己的探针点（护栏盒=胸高障碍⇒独立场地+净空探测；圆柱圆心勿进玩家）；⑤沙箱向量桩 applyQuaternion 失真（合法四元数转出零向量）+欧拉分解不唯一（(-π,0,-π)≡(0,π,0)）⇒ 朝向判据改手写四元数向量旋转；⑥趴姿绝对高度判据错（出生位世界坐标可为负⇒相对 avatar root）；⑦scene.children 随战况随机增长⇒不翻倍判据=BOXES 精确相等+scene 存活带 0.5~1.6×（翻倍=≥2×）。
**升戳 20261114a→b**（index.html 49 处 + dev/_game_files.txt + 19 支戳钉探针全量 sed；升戳前 grep 现值——并行会话已升 a，未与 run-all 并发）。
**实机关注**：①②巡飞弹视角 HUD 隐藏+▸▸加速/ZOOM×N 动态③站任意护栏顶起跳不再被甩出（0.9~1.1 档起跳被拦属预期）④回主页再开局应一次到位，若失效看控制台 [startGame]/[主循环] 护栏告警带栈即真实病灶⑤趴姿膝盖向下贴地弯曲⑥曳光正后方看是圆形光点。
　详表见 README ⑧同日行与 finished-docs/批-巡飞弹OSD沉浸×护栏穿墙通用化×回主页再开局×趴姿膝弯×曳光圆柱-2026-11-14.md。


### 2026-11-14 飞机坠毁分档 × 残骸落点 × 炮弹对空 × 调试部署 × 撞楼成就批
四令一附：①「飞机撞到建筑后过一段时间仍会向下竖直平移一段固定距离后消失，黑色爆炸坑仍出现在正下方的地上，十分诡异」+方案「坠毁在地上→爆炸坑+残骸沉入；毁在建筑上→无坑+残骸二次爆炸消失」1.5「残骸不要浮空，要么落在地上，要么落在建筑上」②「调试模式后可以点击冷却读数中的部署按钮直接部署（仅限调试，冷却读数不受影响）」③成就「利库德集团最好的飞行员」=驾驶飞机撞建筑死亡一次 ④「坦克炮弹等也能命中飞机并正常造成伤害」。
**①坠毁演出分档（16-aircraft+08-effects）**：**病根 A 隔空弹坑**=explosionFX 的 crater 恒打 heightAt(x,z)（爆点正下方地面）⇒ 楼面/半空爆炸在地上盖坑（高炮空炸/楼面中弹同病）⇒ 修=**弹坑高度门**（爆点高于支撑地面 2.2m 不盖；2.2 依据=坠地 die 门 floor+2/手雷炮弹触地 1m 级照旧；水面上 heightAt 是水底深水自然不盖）+`explosionFX(p,noCrater)` 显式压坑参（撞楼 die 楼面一炸传 !!bld、残骸收尾二爆传 true ⇒ 撞楼全程无坑）。**病根 B 残骸浮空**=残骸坠落段建筑扫掠"就地迫降"沿来向回退 0.4m 贴墙面 rest=半空悬浮 24s 再直沉 4.6m ⇒ 修=**命中面法线分档**（rayBox 共享槽 _rbR 本就回传 ny，_plSwTake 增记）：顶面 ny>0.5 贴楼顶安放 y=hit.y+0.45+onTop 入账（"落在建筑上"）；侧面（圆柱 ny 恒 0 归此）顺墙滑落 vel=(-dir·2.2, vel.y·0.45, -dir·2.2) 保留坠势由地面档收尾（ageT>0.6 高速真坠照给一次结构伤害 _wkDmg 一锤账，不在此爆炸防双 boom）；地面档撞楼残骸（w.bld）**不炸不盖坑**只落账火源/焦黑/碰撞，非撞楼照旧触地一炸+弹坑。**收尾分档**：撞楼档 restT 到点二次爆炸（noCrater+音效+溅射 9/165/240+结构 8/280 同坠撞口径）+沉深 onTop?3.2:4.6（贴顶沉浅档不捅穿矮楼）；坠地档照旧 queueSink(4.6) 沉入不加炸。die(attacker,crash,bld) 第三参仅撞楼扫掠调用点传；空中撞机双亡（a.die(bPilot,true)）不传走地面档；残骸补 bld/onTop 字段（旧探针手搓残骸无字段=旧口径天然兼容）。
**②调试冷却 bypass（22-hud+24-main）**：onclick `if(respawnCd>0){ if(!player.alive&&(player.spectator||player.specWillBe())) deployPlayer(); return; }`（specWillBe 单源含兵种卡开关待生效态；!player.alive 门防活人 Esc 页残值触发）；24-main `btn.disabled=respawnCd>0&&!(spectator||specWillBe())`（disabled 按钮收不到 click，只改 onclick 不够）；冷却读数不受影响=逐帧递减不碰+deployPlayer 无冷却门（实读确认）+每死 setRespawnCd(8) 重置无残值。
**③成就 likud_pilot（27-achievements+00b-i18n+16-aircraft）**：事件制同自刎归天族——轮询账摸不到"楼面撞击"瞬间 ⇒ die() 撞楼档在玩家死亡链盖 player._achPilotBld（与 damage(999) 同步链、与 deaths++ 同帧），死亡边沿读到即解锁；**读后即清+startMatch 建账同步清**（不跨局携带防陈旧字段误触发）；口径=玩家在机上（playerDriven 含 AI 接管）撞楼即算，观战座驾 eject 不死不算，调试免伤死不了不计；i18n 'The Likud\'s Finest Pilot' 成对；achProgText 未知 kind 回空=无进度行同自刎形制。
**④炮弹对空（15-vehicles updateShells）**：7c 单源 planeHitTest（线段-球，planeHitR=2.4×size）接入 shells 全家（坦克主炮/火箭筒/反坦克炮/岸防炮/舰炮）；excludeTeam=弹体队友机豁免（与坦克/卡车同门），观战/幽灵坦克 team=-1 不豁免可打双方（观战中立批口径）；伤害与坦克直击同式（dmgV±30 / at 300~380 / 260~330 ⇒ P-51 hp100 直击即落），takeDmg 跳伞/起火/难度乘区/受击反馈全链复用；命中点=弹道-球面最近候选与地形/坦克/卡车/士兵同池竞争；子弹链（fireBullet→planeHitTest）与高炮近炸（planeNearTest）7c 批已收口，本批补的正是"炮弹打不到飞机"缺口。
**判据**：新 dev/verify-airfix-20261114.js（boot 诺曼底 CF 走廊+合成盒）**正向 55/0**（T1 高度门三态/T2 撞楼 die 分档+坠地对照/**T2e 端到端平飞撞楼走扫掠调用点**/T3 撞楼残骸全链〔滑落不悬浮不穿墙/贴地/不炸不盖坑/restT 二爆杀兵仍无坑/入消失段〕+T3b 坠地对照+T3i 开阔坠地对照/T4 顶面贴楼 onTop/T5 炮弹对空〔击落+残骸+弹耗+半空无坑+友机豁免+穿过不耗〕/T6 调试 bypass 双态+specUsed/冷却不变/T7 成就三态/T8 锚 9）+ **NEG 18 红↔9 补丁全数对认**（N1→T1b/T1c/T2c/T2e-4/T4d, N2→T2e-3, N3→T3a/T3c, N4→T4b, N5→T3i-2, N6→T3f, N7→T5a/T5b/T5c, N8→T6b/T6c, N9→T7b/T7c）。
**探针坑四新**：①**killDynCollider 不摘 RGRID 格账**（dead 标记+挪 99999，库内 BOXES 索引终身稳定）——探针手写 BOXES.splice 清盒令后注册残骸碰撞体索引错位 ⇒ eachBoxNear 回吐 undefined 当场炸（T3b 首跑实录），清合成盒一律走游戏单源 killBox；②伪残骸/die 直调测不到"调用点传参"（T2 直调 die 测的是 die 本体，NEG 摘调用点第三参不红）⇒ 补 T2e 端到端钉 N2；③NEG 累积掩盖又一例（N3 滑落拆=贴墙 rest 令残骸永不到地面档 ⇒ N5 被掩护）⇒ 补 T3i 无墙开阔坠地解掩（loiterarm N1/N2 同族）；④planes 选取门——T2 杀光前两架敌机后按 alive 选机得 null（循环空转 T2e-4 假绿），与 T5 同口径不查 alive 选中即 respawn 复活。
**老探针核对零改动**：specneut T6 残骸贴楼顶（新档贴顶 top+0.45 在旧判据 y>top-0.6 内）/T7 die 位拉回/T11 源码锚两串保留；phase2 D1 fall→rest 状态机不变；explosionFX 高度门对 crater 直调系（surf/worldrestore/phase4-7b）零影响。
**升戳 20261114b→20261114c**（index.html 49+dev/_game_files.txt 45+19 支戳钉探针 83=177 处；升戳前 grep 现值，未与 run-all 并发；★坑实录：Git Bash `grep -l | xargs sed` 列表行带 \r 尾（末行除外）⇒ 18/19 "can't read"，改 for 循环+tr -d '\r' 全量到位）。
**run-all 两轮**：r1 **87/107**——4 稳定红全数归因**判据跟码、零真回归**（structscore T10 damageStructures 调用点 12→14〔本批滑落结构伤害+收尾二爆两新调用点〕/aircollide die 签名锚+die(...,true) 恰两处锚〔撞楼加第三参后恰一处+新三参一处〕/achieve ACH_DEFS 四条→五条/batch-20261030 24-main disabled 锚〔调试放行尾〕，逐支修钉后单跑 45/0·28/0·69/0·50/0 全绿）+fixbatch-20260926 预存；r2 **97/107**——唯一稳定红=fixbatch-20260926 ✗1「splashDamage 掩体遮挡与 explodeAt 同式」（并行 frameperf 批 V3→_exOrg 零分配改造自有账，前两批在案非本批回归），偶发四支（nav/aimassist/timestopfix/loiterview）各 3× 复核走绿+单跑复核 35/0·46/0·8/0·34/0 全绿；本批探针套件内 exit=0 两轮（正/阴两态亲见）。
**实机关注**：①撞楼=楼面一炸地上无坑+残骸顺墙滑落楼脚燃烧约 24s 二爆消失，俯冲撞顶=残骸贴楼顶燃烧二爆消失②坠地=触地一炸+弹坑+沉入（旧样）③任何死法残骸最终贴地或贴楼顶不再半空定住④调试冷却中部署可点即部署、关调试照旧无反应、读数照走⑤撞楼死亡弹「🏆 利库德集团最好的飞行员」+数据面板入册（EN "The Likud's Finest Pilot"）⑥坦克主炮/火箭筒/反坦克炮/岸防/舰炮可击落飞机，友军不打友机，观战/幽灵坦克打双方。
　详表见 README ⑧同日行与 finished-docs/批-飞机坠毁分档×残骸落点×炮弹对空×调试部署×撞楼成就-2026-11-14.md。

### 2026-11-14 Bot 擦肩近距感知修复批（面对面走过像没看见）
承用户报「Bot 面对面擦肩走过却像没看见」，令含排查审计+优化双交付。**广度审计**（两并行子智能体全库过堂）：
RAY_BUDGET 只被 14-bots 步兵 perceive 消费（坦克 tankPerceive/丧尸/炮位/舰艇全部无预算，无饿死面；
boatAI 的 huntClose=120m 是全库唯一把近距豁免做对的）；MG 机枪座操作手继承 perceive 同享病灶。
**根因×2**：①**新目标获取饿死**（主根因）——perceive 每 0.16s/人，候选射线吃 RAY_BUDGET 12 发/帧全体共享；
2026-11-03 批只修了「当前目标」优先复核，新目标仍吃预算门，22 人混战超订阅 2~10 倍 ⇒ 更新序靠后的 Bot
每轮拿 0 发新目标射线，贴脸的陌生敌人永远进不了 target（面对面走来正是新目标）——verify-botprox S1 红先实锤；
②**近距脚步感知死代码**——`heard(d<9)` 在 FOV 门之后才算，背后贴到 2m 也被朝向门 continue（S5 红先实锤）。
**修复**（js/14-bots.js 三处）：①`PROX_SPOT_R=12` 近距强制感知——12m 内候选射线不吃预算门（超预算照发=
与当前目标优先复核同款超发特权，照旧入账；近距射线短成本低；远距饿死语义保持=botai-T2 26m 端到端兼容）；
②`heardClose=d<(e.crouch?4:9)` 提到 FOV 门之前——站立/奔跑 9m 全向、**蹲行 4m**（蹲姿潜行背刺保留）；
听枪不豁免 FOV（gunEvents 兜底块记 lastSeenPos 不锁目标的既有语义不动）。雾/烟/庄稼/植被/墙遮挡链照走。
**探针兼容面**（改前摸清）：botai-T1 235 字面钉 used>maxPerFrame（超发语义沿用）/T2 钉 26m 饿死（豁免半径
12<26）/T9-A 三源码锚逐字保留/foliage-⑦ 首现顺序不重排/daynight-_eSearchLit 豁免保留/airground-S3 伞降门
逐字保留/cmdui 评分块保留/specneut RAY_BUDGET 形状契约不改。
**判据**：新 dev/verify-botprox-20261114.js（boot 草原遭遇+mkPairSpot perceive 级净空先验选点）**正向 20/0**
（S1 耗尽+面对面 8m 索敌+超发入账/S2·S4 耗尽+背后站立索敌/S5·S6 充足+背后·蹲行 3m 索敌/S9 10m+耗尽索敌/
守卫 S3 蹲行 6m 不可见·S7 墙挡·S8 13m 饿死·S10 基线·T2 听枪不锁目标/T3 锚 6）+ **红先亲见转红**（修前
7 核心+6 守卫形态精确）+ **NEG 3 补丁 12 红对认**（P1→S1/S2/S4/S9、P2→S2/S4/S5/S6、P3→S3，守卫 NEG 下绿）。
**既有探针回归**：botai 53/0·airground 12/0·foliage 全过·cmdui 66/0·specneut 55/0·probe-bots 金丝雀全过·
daynight/weather **A/B 对照失败名单逐名一致**（临时回退本批复跑 diff=IDENTICAL，13/104 红全为并行批预存）。
**升戳 20261114d→e**（index.html 49+_game_files.txt 45+20 支戳钉探针=22 文件 179 处，node split-join 全量）。
**run-all 两轮**：r1 **94/99**（唯一稳定红=fixbatch-20260926 ✗1 splashDamage 在案预存〔并行 frameperf 批自有账〕；ffneutral 偶发 1 次复核 3/3+单跑 39/0×2 归零）+r2 **92/96**（唯一稳定红仍=fixbatch-20260926 同一条，零偶发）；本批 botprox 套件内 exit=0 两轮。实机关注见 finished-docs/批-Bot擦肩近距感知修复-2026-11-14.md。
**观察项登记**（本批不改）：AT 炮 enemyTankNear 数组序取目标/AA 炮跟踪不受 140m 交战半径约束/
飞机对地选目标无 LOS/tankPerceive 无预算无上限（性能面）/15f pickTarget 死代码。

### 2026-11-14 重开局系统性BUG × 爆炸友伤开关 × 焦黑树篱还原批
承用户报：「现在一局结束后重开一局会有各种各样的大BUG，比如地图静态、没有载具、UI消失、彻底卡死等系统性问题」
「被烧掉的植物（尤其是树篱）在返回主页后的航拍视角中是焦黑色，没有重置」+两令：游戏内容设置加「手雷对友方造成伤害」
（默认开，关闭后手雷/坦克炮弹等爆炸不伤友军，Bot/玩家同规）+友方手雷补近距离告警。两并行子智能体全链路调查定位。
**①重开局四症状同根**（主根因，沙箱真机复现实锤）：残骸动态碰撞盒（Tank.die→registerDynCollider→addBoxCollider）
局内把 BOXES 撑大并把下标写进 RGRID.boxCells；restorePristineWorld 只 `_wsnTrim` 截数组**不重建索引**——
2026-11-11 性能批把 NAV.refresh 改「集合变更才重建」（`_colIdxDirty||forceFull`）后，23b 无参调用在没拆过树篱时
`_colIdxDirty=false` **永不重建**（04-collision.js:11 注释承诺的 forceFull 口径从未接线）⇒ 脏下标带进新一局，
standHeight/raycastWorld/eachBoxNear 喂 `BOXES[bi]=undefined` 抛 TypeError——被 2026-11-14 上午批刚加的两道护栏
（startGame try/catch、loop 帧级 try/catch）**吞成静默**：startMatch 死在第一个 Bot.spawn（new Tank 之前）=没载具、
updateHUD 永不到=UI 消失、帧帧早退只渲染=地图静态/卡死，四症状一张脸。修复：23b `NAV.refresh(true)` 强制重建+
04-collision 四查询点（eachBoxNear/eachCylNear/raycastWorld 盒柱两路）脏下标守卫（防未来同类回归）。
**②焦黑树篱还原**：树篱/枯树/竹丛/蕨丛的焦黑=vanishFlora 换 `m.material=_charredFloraMat`（per-mesh 材质档，
非 instanceColor）——快照没拍材质引用、还原没写回 ⇒ 回主页航拍焦黑残留。修复：WSN.flora 快照补拍 `mm`
（原材质引用数组）+⑤ 循环写回（★首版把写回块放在 flora for-of 循环体外 ⇒ `st is not defined` 还原中途抛错
连带 NAV.refresh 不跑，被本批新探针当场抓出后归位——探针价值实证）。椰树 grp 无 material 自然跳过（既有反向缺陷
另案登记）。**③护栏收口三件**：startGame try 护栏扩围罩住 resetMatchState/resetPlayerForNewMatch（旧形状
"点开始没反应"仍在护栏外）；returnToMenu 补 killcamEnd 第四点收账（killcam 中回主页不再挂 grayscale+☠到菜单）；
24-main 帧级护栏**首错上屏** #loopErrBar（body 直挂件，HUD 停更时仍可见——本批病灶被静默数日的直接教训）。
**④爆炸友伤开关**（sf_explo_ff，默认开=现行为）：三伤害总口单源收口——explodeAt `noFF` 受开关压制（关=普通手雷
同队归零，自炸 s===attacker 照旧不免）；splashDamage team=-1/undefined 且 attacker 有真实队时**归一化到 attacker 队**
（级联覆盖坦克炮弹/火箭筒/AT炸药/航弹/迫击炮观战/巡飞溅射，并经 navalSplash 透传覆盖舰艇；无主爆炸 attacker=null：
地雷/油桶/钢水包无队可认保持无差别=口径注记写进设置说明）；loiterDetonate 直击三行 `_ltFF` 同队门。
**⑤友方手雷告警**（用户令 2.5）：updateNades 放宽——开关开启时友方（非自己扔）手雷/AT炸药/燃烧弹 7m 内也告警；
**迫击炮弹/航弹除外**（真实队号溅射本就同队免伤，告警会误报）；开关关闭=友雷不再伤人告警一并停用；敌雷告警不受影响。
设置卡 #exploFfBtn 进游戏内容设置（nadeMapMark 卡之后），即时生效不重载；i18n +2 键。
**判据**：新 dev/verify-restart2-20261114.js（boot 诺曼底+真 Tank.die 残骸链）**正向 19/0**（残骸 BOXES+3/还原
true+BOXES 精确截回/RGRID 零脏下标/残骸位查询不炸/复开 tanks=10/90 帧稳定/盒柱脏下标单测×2/树篱焦黑→材质还原/
killcam 收账三态）+ **NEG 12红↔4补丁对认**（N1→②-4+次生②-5/③-2，N2→⑤-3，N3→④-1/④-2，N4→⑥-1；①段源码
断言按惯例读原始文件 NEG 下绿）；新 dev/verify-exploff-20261114.js（boot 淞沪+真雷链）**正向 22/0**（默认开伤友军/
关=frag友军零伤+敌军照伤/splashDamage 归一化+无主不受影响/巡飞直击同队免伤/友雷告警四态/设置按钮翻转+落盘）+
**NEG 15红↔6补丁对认**（N1→③-T2，N2→③-T3，N3→③-T4，N4→④-T6a，N5→②-T0+次生⑤-T7a，N6→⑤-T7b）。
**老探针跟码修钉两支**：verify-restart-20261114（N1/N2 NEG 锚吃到本批改的护栏块 → 锚随码改吃新块）、
verify-ffneutral-20261109（N1 锚=本批改的 explodeAt FF 行）。**升戳 20261114e→f**（index.html 49+dev/_game_files.txt
45+21 支戳钉探针；Git Bash `grep -rl|xargs sed` 路径反斜杠化 21/21 "can't read" 又现，改 for+glob 枚举）。
**run-all 两轮**：r1/r2 同账 **94/98 次运行 exit=0**——唯一失败=fixbatch-20260926 ✗1「splashDamage 掩体遮挡与
explodeAt 同式」（frameperf 并行批在案预存，正向+稳定性复核 3 次同条零漂移）；本批两支新探针套件内 exit=0
（正/阴两态亲见）。实机关注：①打完一局（含打爆载具）→结算/回主页→重开，地图应有载具、Bot 照动、HUD 全;
②烧焦树篱/枯树回主页航拍应回绿色;③游戏内容设置新开关默认开（现行为），关闭后友方爆炸不再误伤+友雷告警停用;
④若再遇"世界冻结/没载具"，屏幕顶部应出现红色「⚠ 帧异常」条（护栏首错上屏），把文案抄报即可定位。

## 一.114 四项批：模型重做 × 障碍物子弹判定 × 断崖公路 × 补给箱设置 (2026-11-17, 补登——该批此前只落 README §八, PLAN 漏登; 一.79 先例)

**用户令 (四项)**: 1 模型重做风格统一（坦克残骸 44→19 件/轿车残骸 6→13 件/运输卡车 11→21 件，碰撞盒+PROPS+coverPoints 账逐位不动）；2 障碍物/拒马子弹判定（钢轨街垒全碰撞盒挂 bulletPass 单弹道口 raycastWorld 穿弹；反坦克拒马改逐梁线段判定空隙穿弹）；3 断崖公路 1940 出生上崖顶（伏击点 6→14.5~21.3m 崖顶+3m 通行走廊；Bot 反装甲兵索敌纳入卡车；卡车 hp 320→800）；4 游戏内容设置「点位周边补给箱数量 1/2」（sf_crates，第二箱贴掩体优选落位，默认 1 档全图布局指纹零漂移）。判据 verify-20261117 四支全绿+NEG 对认；详见 README §八 2026-11-17 行。

## 一.115 十三项实报批: i18n 收口 × 大地图弹点 × 手雷楼层子步 × 读条终局收口 × 车厢模型 × 枯树倒伏 × 指挥官 ESC 分流 × 油桶殉爆机制 × 投射物弹性削减 (2026-11-18, 补登——该批此前只落 README §八, PLAN 漏登; 一.79 先例)

**用户原始令**（油桶殉爆与弹性削减两项）+实机十三项。核心：**油桶三路记账**（子弹 fireBullet wr.cyl 单弹道口/爆炸 damageStructures ③×blastMul/火烧 04b 受热账 0.4s tick，hp 懒建 100）+殉爆留火池（addFireSource r2.3/ttl/dps+attacker 归属）；nadeStep 拆子步（单步 >0.24m 按子步推进，薄墙必中；盒顶=楼板落地视作触地）；弹性削减（落地 0.38→0.24/切向 0.68→0.60/盒顶 0.4→0.26/盒侧 0.5→0.34）；i18n ~140 词典键+84 人名拉丁转写；油桶材质重做锈红桶皮 Group（CYLS 账逐位不动）；帐篷 ry=atan2(dx,dz) 二修；坦克残骸排斥步兵；坦克一律 3 票；暂停面板卡片化+键帽表；架枪留存。判据 dev/verify-20261117b **48/0**+--neg 44/4；六稳定红 A/B 基线（c6cdde8 worktree）全归因本批非预存。详见 README §八 2026-11-18 十三项行。

## 一.116 油桶殉爆延续 × 弹坑系统 × 油桶残骸 × 火池六分钟 (2026-11-18, 待实机验收)

**用户令 (四道)**: 1 油桶爆炸后就地留下残骸且模型要足够"油桶残骸"；2 地图开局就有几个爆炸坑且永不消失——"严重的系统性全局性问题"（裁定=布局遗迹坑保留但限时自然消失，寿命≤人造坑几倍）；3 地板略高于地面时弹坑呈甜甜圈形=全局性 BUG（一轮盒顶骑升实测"厚一点的甜甜圈"+处方**"将地板视作一种'地面'"**）；4 油桶爆炸的火改为持续 6 分钟且不受天气等影响。

**①残骸**: 05b barrelWreck(x,z,gy)=压瘪焦黑桶身（_BARREL_G.body scale1.14/0.37/0.92 歪斜）+翻口沿+滚箍残片×2+焦土贴花 crater(1.15,supY=桶底)；纯视觉不入 CYLS/BOXES 账（5c688ae 裁定延伸）、不进快照=还原摘除；05-world barrelBlast 接线。**②弹坑生命周期**: CRATER={freshTtl:150,scarTtl:450=3×,fadeWin:45}+CRATER_LIFE 双账并行（runtimeCraters 三处既有消费点零改动）+24-main updateCraters(dt)（dt≤0 时停冻结）+23b cratersResetLife 还原钩+m.parent 探活自愈+尾窗淡出。**③甜甜圈全局修**: crater 第五参 supY（explosionFX 透传爆点）+04-collision craterBoxTop 逐顶点盒顶支撑+05b craterFloorTop 面层感知（薄盒件 (bt,bt+0.15] 窗）骑**面层顶+0.02**/裸盒顶+0.05 同规地形+台阶门>0.9 弃坑防尖刺。**④火池二令**: poolTtl 14→360+noWx 整链（04b addFireSource 第 9 只/灼烧兵坦克双路 fs.noWx?1:fireDmgMul/igniteCreature 3.5s+burnNoWx/updateCreaturesBurning 3.2×/FNOWX=Uint8Array 落格——暴雨浇灭·受潮消耗·蔓延压火三乘子全豁免视同晴档+蔓延继承；树冠火保持全局天气博弈）。**⑤顺带**: 23b WSN.cyl 快照补 hp 第 5 位+还原复位（桶 hp 懒建跨局残留）。

**判据**: 新 dev/verify-20261118a **74/0 ×6 稳**（T1 子弹记账/T2×blastMul/T3 火烧三路/T4 余火烤毙/T5 弹性削减/T6 戳/T7 生命周期 15 断言/T8 铺装层骑面+0.02 逐位+全顶点窗+裸盒对照——★探针锚带 2.6m 盒净空门防沙袋/拒马矮盒顶拉走顶点/T9 残骸 4 件构成+纯视觉钉/T10 火池 6 分钟+暴雨档灼烧 6.4·燃料 0.055·时长 3.5 逐位晴档）+**--neg 31红↔10补丁全对认**（N1 子弹/N2 ③直调/N3 受热账/N4 反弹/N5 火池/N6 deaden updateCraters/N7 逐顶点骑升/N8 残骸接线/N9 ttl/N10 noWx）。**桩忠实化**: _bootstub Obj3 rotateX/Y/Z+材质 clone()（craterMat.clone/rotateY 沙箱炸桩=桩不忠实非被测代码问题）+局部桩三支同规跟补（worldrestore/fire/structscore）。**预存红 A/B 清账**: willow 40绿/2红+nade-trigger B1（三角数 NaN）=HEAD worktree 同红非本批（nade-trigger 87/1 比基线 86/2 净赚一绿）。判据跟码: verify-airfix（crater supY 锚+NEG）+verify-crater（T4f）双支绿（58/0、21/0）。**run-all r1 首过 136/148**（12 支红经 3 连跑复核=稳定红 10+偶发 2）：预存 5 支（HEAD worktree 对照同红=phase2/phase3/probe-bots/willow 40绿2红/nade-trigger 87/1）；**桩回归 5 支当场修复**（verify-boot/layouts/sink/uvscale/probe-renderstat 局部桩与共享 _structbase 材质类缺 clone ⇒ craterMat.clone 建图即炸——同规补 clone 后单跑 exit=0 复核）；偶发 2 支（loiterview 0/0/0 在案偶发；本批 20261118a 1/0/0 两根因当场修=①T1 射线走廊被布局圆柱挡（起点落圆柱内 t 为负）→ placeBarrelClear 走廊净空落桶 ②T8b 125 顶点中 1~7 个 ±0.07 混合桩抖动→支撑窗放宽"不沉底"判据（N7 沉底 ghA+0.05 仍远出窗），修后 74/0 复跑确认）；r2 用户令免跑。实机验收清单见 finished-docs/批-油桶殉爆延续×弹坑系统×油桶残骸×火池六分钟-2026-11-18.md。

## 一.117 低弹变红 × 严寒天气分级 × 火焰驱寒 × 受冻特效 (2026-11-18, 待实机验收)

**用户令 (两道)**: 1 现有子弹数 <= 弹夹总容量/2（向下取整）时, 现有子弹数变红色; 2 对有寒冷机制的地图根据天气进行效果分级, 火焰可以驱散寒冷, 载具内不受寒冷效果, 寒冷掉血有倒计时+受冻特效, 倒计时不得与现有 UI 重叠且可在游戏内容设置里隐藏。

**①低弹变红**: 22-hud magN 色判据 w.mag<=Math.floor(w.def.mag/2)（旧 max(2,mag*0.25) 25% 阈值作废; 8 发匣 4 发即红/30 发匣 15 发即红=恰过半分界; 机枪 ∞ 档不吃红; hudStyle 去重缓存口径不变）。**②严寒天气分级**: 失温参数进 WEATHER_CFG.coldOff/coldDmg 字段（R7 单源纪律: 消费点读 WX_CFG 字段零字符串比较）——雪图四级阶梯 晴 40/1 < 细雪 30/1 < 中雪 25/2（本图缺省档=现行值零回归）< 暴风雪 15/3, 非雪档 25/2=现行; COLD_OFF/COLD_DMG 保留为兜底缺省; 玩家(20-player)/Bot(14-bots) 同参, Bot 冻僵反应判据随 cOff 缩放。**③火焰驱寒**: 04b nearWarmFire(x,y,z,pad) 纯查询（取暖半径=灼烧圈 r+1.5m+竖向门 |dy|≤2.5m+ttl≤0 跳过, 只读 FIRE_SOURCES 不写账）——火边寒意 4 倍速消退且不再积累, HUD 🔥 近火取暖, #coldFx 退散; 玩家/Bot 同规。**④载具免疫+死亡收尾**: onVehicle/炮位/chute/flying/loiter/useCast 既有 coldBusy 豁免保留; updatePlayer 生死早退之前补收尾（冷块在地面分支, 阵亡/观战到不了那——旧版死亡后提示条+结霜残留到重部署, 顺带修）。**⑤冻僵倒计时**: 失温掉血行内嵌 <span.cccd>⏱ 冻僵倒计时 Ns</span>（hp/cDmg 估算距冻死秒数——回血 gate 被失温掉血 lastDmgT 压住=估算成立; 零新增 UI 面=不与任何现有 HUD 重叠, 落既有 #coldTip 槽位）; 游戏内容设置新卡「严寒倒计时」(#coldCdBtn 单钮循环, COLD_CD_SHOW+sf_coldcd 落盘, 每帧读旗改档即时生效, i18n 键闭环)。**⑥受冻特效**: #coldFx 全屏层（#ui 内 vig 上 scopeOv 下, 菜单/部署期随层隐藏）四角结霜+冷色晕影+coldFxDrive 单源缓动（dampF, 变了才写）——积寒渐起 0.16→0.46/掉血期 0.55+.freezing CSS 亮度呼吸脉冲/近火退散。

**判据**: 新 dev/verify-20261118c **48/0**（T0 戳/T1 updateHUD 行为钉 4/8 红·5/8 常·30 发匣 15/16 分界+机枪豁免/T2 七档逐位+R7+缺省零回归/T3 斯大林格勒真步进——25.3s 起冻·2s 掉 4·暴风雪 15/3·细雪 30/1 行为级·移动豁免·火圈边寒意 25.5→17.5 取暖期 hp 停扣·倒计时显隐·观战收尾/T4 nearWarmFire 真值表/T5 Bot 源码钉/T6 设置卡+点击循环落盘/T7 特效收敛·挂摘档·稳态不落 DOM）+ --neg 14红↔6补丁全对认（N1 nearWarmFire 短路→T3d/T4a; N2 摘玩家分级→T3e/T3f; N3 摘 Bot 驱寒→T5b; N4 摘倒计时行→T3b-1; N5 摘掉血档特效→T3a-4; N6 阈值回 25%→T1a/b/c）。

**探针三坑入档**: ①NEG N4 直换分号会让后随 else 悬空炸语法 ⇒ 替换保 if/else 结构（if(false)0;）②沙箱 globalThis.x= 写在 stub.sandbox 上、裸名读不到 ⇒ 探针注入一律 var x= ③boot() 清共享 stub.byId ⇒ 中途对照 boot（ctx3）后再点钮=点到别的 ctx 的 handler（首版 T6f 假红根因: 点击断言须先于对照 boot）。

**run-all 两轮**（跑在工作树上, 含并行会话「卡顿审计」未提交在途改动, 红账逐支归因）: r1 **103/125**（稳定红 5=probe-bots/phase2/phase3/willow/nade-trigger 与 20261118a 预存账同名; timestopfix 偶发 0/0/1 —— A/B HEAD worktree 4 跑同签名红 ⇒ 预存偶发）; r2 **104/131**（新现红三支: sink 复跑 0/3=抖动、botai 复跑 1/3=在案偶发、cmdbatch2 复跑 3/3 稳红但 HEAD 4 跑全绿=非本批引入, 根因=并行 26-commander 卡顿审计 cmdFocusHudTick 缓存化首调隐藏写跳过、判据跟码义务归该批）; 本批探针 verify-20261118c 两轮均 48/0; 升戳 20261118b→**20261118c**（index.html 49 处+css 链+__sfStyleVer+_game_files.txt 45 行+戳钉探针 28 支同扫, 旧戳清零断言原样保留）。实机验收清单见 finished-docs/批-低弹变红×严寒天气分级×火焰驱寒×受冻特效-2026-11-18.md。

## 一.118 全局卡顿审计修复 × 低效代码全域批 (2026-11-18, 待实机验收)

**用户令**: "我感觉现在存在明显可感的卡顿问题，请完成对于整个项目各个领域内低效代码的审计和修复。该任务的广度和深度都较大，请善用子智能体功能。"——5 个子智能体分域只读审计（核心热路径/AI·Bot/载具域/世界地形特效域/玩家UI域），主会话汇总按收益逐项修复。

**逻辑病**: 24-main 重复 updateFires 摘除——7fb72eb 插 updateCraters 行时误粘了一份 updateFires，火焰蔓延/燃烧账每帧推进 2×（火池 360s 实跑 180s=上一批"火池六分钟"令被它打折）。

**指挥官烘焙门**: cmdFrameTick 起作业门+cmdDeployOpen 门补 cmdIsCommander——底图只有指挥官能看见（开图/布势两入口都以指挥官为前提），普通玩家此前也照烧每帧 8-10ms×约1.5s（开局进战斗卡一阵的主源之一）；布势门判据 player.cls===5&&!player.deployed ⇒ 点指挥官卡即成立，部署页预热保留；cmdBakeAdvance 预算行不动（verify-commander 探针钉）。

**坦克感知两段式**: tankPerceive 评分段（视距×雾×夜×天气/大灯暴露/前向视锥/集火分/残血/粘滞，无射线）收进模块级复用槽 _tkPerC → 按分降序 _tkPerIdx.sort 逐个 LOS 复核（raycastWorld/烟幕/庄稼/植被）取第一个过线者——与旧"逐候选 LOS+评分取最高分通过者"完全同果（评分与 LOS 无关+Array.sort 稳定保序=平分先见先得），常态车长射线 ~候选数→~1 发。**感知相位出生打散**: _tkPhaseSeq 8 槽确定性序号 aiPerT=(_tkPhaseSeq++)%8*(TANK_PER_T/8)——旧写全员同相位，每 0.14s 全场坦克同帧全量感知+LOS=尖峰成簇主源；**不走 rand（RNG 流纪律）**: rand 错峰首版令 tankai 车道搜索/交战时序漂移 1/21 红，A/B worktree 定位后改序号。**底盘碰撞 pass2 跳过**: 第一遍零接触 ⇒ 位姿未变第二遍必然零接触，省一半底盘邻域查询（推挤回调顺序敏感不动）。

**updateFlak AABB 快筛**: 逐弹先做线段 AABB（余量 2.6>坦克判半径 2.3）——斯大林格勒弹幕期每发 61 人全表 distSqPointToSegment（V8 慢路径）是 17.7ms 尖峰放大器。**旗/强点**: updateFlags/updateSpots hypot→平方距离（_fr2/_sr2 预存平方半径）+旗布 30Hz 节流（波形=nowT 纯函数，采样帧逐位同值；needsUpdate 只在真写过顶点的帧置位；旗杆 y dampF 保持逐帧=worldrestore 钉）。**降水 30Hz**: _wxStepAcc 累计 dt 一次性补偿（总位移逐位守恒；wxShiftPrecip 每帧照跑=fixbatch 源文本钉；时停 dt=0 自然不步进；needsUpdate 只在步进帧置位；★实机雨雪时间混叠抖动，已回滚见 一.119）。**布娃娃**: 全员冻结且无散落残骸 ⇒ RAG.world.step 整步跳过（冻结具 step 后本就钉回快照、解冻探速读外力直写 body.velocity 不经 step ⇒ 判据不变；ragCollide 自带速度早退故散落残骸不另冻结）。

**杂项十二**: Tank threatYaw setTimeout→threatYawT dt 账（弹幕刮血期每次受击挂 6s 定时器闭包+暂停/时停照走=11-01 雷链同族病）；卡车绷带补给 0.5s 节流；两栖负重轮 tankSurfH→heightAt（纯视觉悬挂）；resolveRuntimeSurfaces 候选数组/闭包模块级复用（_rtCand/_rtPush，稳态恒空仍每帧新建）；_gunAnchorTorso grip/fore 双槽 memo（单兵单帧 8~31 次同参求值；命中只值拷贝进 out 不把缓存别名出去=perfreg T3 槽位契约逐字保持；被跳过的 _eulerXYZ/_gatP/gunMountOf 均为纯求值）；spawn lane 表 0.5s 缓存 _laneCache（FLAGS/SPOTS 表换代即失效；convoy 车队 lane 随车动+建表消耗 rand 抖动 ⇒ 直通不缓存保 RNG 流）；cmdFocusHudTick 元素缓存+_cfHidden 幂等+宽度 1% 量化（**隐藏首调仍落一次 display='none'**——探针读 getElementById 壳元素=cmdbatch2 ⑥ 契约，并行会话把该红归因本批的判据跟码义务就地兑现；bar/lab 壳元素按需补登）；24-main 部署按钮 span 跨帧缓存（btn._spC）。

**判据**: 新 dev/verify-frameperf2-20261118 **34/0**（T1 重复摘除/T2 烘焙双门源码钉+advance 行保留钉/T3 非指挥官 90 帧不烘焙行为钉/T4 指挥官一帧起作业/T5 两段式同果行为钉——近车高分被挡仍选中远车低分可见（★探针坑: 桩 raycast 被挡要返回近距命中 {dist:2}，返回 {dist:hl} 会被 hl-1.2 容差判成"打中目标本身"=通视假绿；★gunGripPoint 返回共享槽 ⇒ 断言须即时快照标量，读引用全是最后一次调用的值）／T6 相位错开 ≥2 槽/T7 pass2+flak AABB 源码钉/T8 旗布 30Hz 行为钉（needsUpdate 计数 30±5）+平方距离/T9 强点/T10 降水 30Hz 行为钉/T11 布娃娃 step 三态行为钉（★RAG.world 惰建: 无人伤亡时为 null，探针须先补 {step}）/T12 HUD 缓存行为钉（getElementById 计数 1/40、1/40）/T13 lane 缓存同一性/T14 候选复用/T15 memo 参数键（切换/切回/交错）/T16 span 缓存/T17 步进账源码钉）+ **--neg 9红↔9补丁全对认**（N1 摘烘焙门/N2 复插重复 updateFires/N3 摘 LOS 复核守卫/N4 旗布阈值归零/N5 降水门恒真/N6 摘 step 门/N7 摘 memo 登记行/N8 lane TTL 恒假/N9 摘 span 缓存；★NEG 行为判据极性=「坏状态成立才红」，源码钉极性=「钉消失才红」，首版六支极性反写全部假绿）。诊断探针 dev/probe-framespike-20261118（逐帧 wall 直方图+最慢 12 帧逐系统归因+高频助手调用计数+规模快照，恒 0 退出，与 probe-frameprofile 互补——平均剖析看不见的偶发尖帧在这里现形）。

**前后对照**（沙箱 JS 900 帧）: camp0 mean 4.60→4.08ms、p99 15.45→9.49ms、>8ms 帧 7.7%→2.7%（-65%）；camp5 mean 3.30→2.35ms、>8ms 0.2%；tankPerceive 尖峰 6.3→1.6ms、updateFires -35%、updateFlags -37%（143.9→91.3µs）、updateWeather 暴雨档约减半（330→153µs）；剩余尖峰=14-bots 域（Bot.update 20ms 重生风暴帧，并行会话占用）与偶发事件帧（旗点占领 drawFlagTex/NAV 脏区重建）。

**回归**: 靶向 31 支+新支全绿——cmdbatch2 35/0（判据跟码：隐藏首落 display='none' 满足壳元素契约）、tankai 21/0（RNG 流回正）、verify-20261118a 74/0（戳断言随扫）、verify-20261118c 48/0；**run-all r1 107/129 + r2 108/132**（稳定红 5=probe-bots/phase2/phase3/willow/nade-trigger 在案同名零新增；偶发 botai/timestopfix/killattr 复跑绿/_audit-foliage-ref 复跑绿）；预存红 A/B 双树同签名清账（strongpoint ②③④⑤ BUILD_REG/island SPOTS=预存、wipe craterMat.clone 桩缺、daynight ironbottom 夜档、frameperf-terrain baituan 违例1=采样偶发、zombie2 7 失败在案待 triage）。升戳 20261118c→**20261118d**（index.html 49 处+__sfStyleVer+_game_files.txt 45 行+戳钉探针 28 支同扫，负向断言保 .js 文件名引用不误伤）。实机验收清单见 finished-docs/批-全局卡顿审计修复-2026-11-18.md。

## 一.119 雨雪抖动返修 × 降水 30Hz 步进回滚 (2026-11-18, 待实机验收)

**用户报**: "现在天气效果的雨滴/雪粒会严重抖动，而且显得'帧率很低'。请完成修复，修复不了就回滚相应的部分。"（并行会话两笔穿墙修 b24b340/2f7e7d3 不涉 08-effects.js ⇒ 病根锁定 一.118 第⑥项）。

**根因=时间混叠**: 雨落速 27-36m/s，30Hz 步进=60fps 下隔帧才更新位置（每步 0.9-1.2m），快速运动小物体半帧率更新是经典时间混叠——一.118 声称的"位移总量逐位守恒"救不了采样欠步；且 _wxStepAcc 累计器的步进节奏随帧时长波动（隔 2 帧与步长突变交替）节拍差加重抖动；雪粒横向漂移 sin 项同理。"逐帧插值补救"不成立：保持 30Hz 物理仍需每帧写全部粒子位置=成本没省（本项收益本就只有 330→153µs≈0.18ms/帧，vs 视觉损伤不值）。

**处置=整体回滚**: js/08-effects.js 摘 _wxStepAcc 累加账、恢复 dt 直乘逐帧步进+needsUpdate 每帧置位——与 538d537^（2c5a954 版）**逐位一致**（diff 验证 BITEXACT）。旗布 30Hz 节流（慢速大曲面=真不可辨）不动保留；其余 15 项修复不受影响。

**判据跟码**（verify-frameperf2-20261118）: T10b 改钉"降水逐帧步进——60 帧写 60 次（30Hz 节流=30 即红）"；T17 改钉"_wxStepAcc 不得复活+dt 直乘两行在位"；N5 阴性补丁换"写入隔帧跳过"（`pos._nuT=!pos._nuT; pos.needsUpdate=pos._nuT`）→写入数<60 红。正向 **34/0** + **--neg 9/9 对认**；verify-weather exit=0、verify-fixbatch 28/0（wxShiftPrecip 每帧调用钉原样）。

**回归**: run-all r1 **105/132**——稳定红 6=在案 5（probe-bots/phase2/phase3/willow/nade-trigger）+ **tankai（新红，非本批）**：A/B 三连 3/3 稳红，且 HEAD 不含本批回滚时同签名 1/21 红（"新兵档双方都开了火 (延迟可测)"）——窗口 538d537→2f7e7d3 内只有并行会话两笔穿墙修，其 14-bots 改动（botSafeStand 自动蹲/趴落位+collideMove 第三参姿态高+安全落位提前到横推前）直接改 Bot 站位/推挤口径，新兵档交战延迟判据出窗，待实机验收/后续批裁定；偶发 timestopfix(1/1/0)/botai(0/0/1)=在案偶发族。

**教训入档**: 快速运动的小物体（雨/雪/曳光/碎片）不得降采样步进——30Hz 节流只适用于慢速大曲面（旗布/布料）与纯逻辑账；"总位移守恒"≠视觉连续（时间混叠）。升戳 20261118d→**20261118e**（index.html 49 处+__sfStyleVer+_game_files.txt 45 行+戳钉探针 28 支同扫）。实机验收清单见 finished-docs/批-雨雪抖动返修-2026-11-18.md。


## 一.120 验证套件并行化瘦身: run-all 并行执行器 × 9 支重探针热点手术 × 14 件过期/临时探针归档 (2026-11-19, 待实机验收)

**用户令**: 每轮施工跑探针占 75%~90% 时间、任何任务都超一小时——对验证脚本做低效审计+修复+切除不必要部分。

**基线实测**: Σ单跑 1208.8s (113 项并行 12 路实测累计; 旧 run-all 顺序执行 ≈20 分钟+失败复核×3 顺序 ≈25 分钟)。瓶颈分解: 单次全链 boot ≈1.5s (读盘 26ms+编译 56ms 均可缓存, 执行 ~1.4s 是世界构建本体); 重探针=多 boot (destruct 17/nav 15/navspots 14/boot 14/fixbatch 10/specbatch 11)+模拟推演; run-all 旧执行器对失败探针顺序重跑 3 次 (6 支稳定红每轮纯浪费 40-60s)。

**run-all-verify.js 执行器重写** (SANDBOX/BROWSER 清单逐字节不动): ①沙箱段 execFile 异步池并行 (默认 -j10; 每探针独立进程互不共享状态, 并行安全性逐一核对: verify-strongpoint 不在套件、specthird 写 os.tmpdir 且本批加 pid 后缀防并发互踩) ②失败稳定性复核并行发车+**在案稳定红台账 RED_LEDGER** (probe-bots/phase2/phase3/willow/nade-trigger/tankai 失败即报在案跳复核, 转绿照常显示=修复仍能被发现; 新红仍走复核通道) ③--only 名字过滤 (施工期定向跑) + --rerun N (0=跳过) ④红名关键输出优选 (✘/FAIL/堆栈行优先, 不再被 [HUD] 自检样板行顶掉——probe-bots 红的真身 barrelWreck grp.rotateY 缺失由此首见) ⑤SIGINT 回收子进程。浏览器段保持顺序 (随机端口+独立 userDir, 保守)。

**9 支重探针手术** (共享桩 dev/_loadcache.js: 读盘 memo+vm.Script 编译缓存, runInContext 逐 ctx 语义逐位等价): procgen (编译缓存+biome 分类改轻 ctx=纯种子哈希免整图生成×15+种子不回写提出循环 12→1+跨段 (seed,size) 上下文 memo, 确定性对照块保 fresh build 侧; **75.7→36.7s**; 535 通过逐字一致) / boot (14→13 boot, i=0 复用探序号 pristine ctx) / nav (补丁版 07-nav 只编一次+ci=0 与⑦复用探序号 ctx, 15→13 boot; 判定 9✓/1✗ 一致) / navspots (14→13; 333/30/2 一致) / destruct (17 boot 缓存; 50/0 一致) / fixbatch-20260926 (SRC memo+PATCH_MAP 文本只编一次; 55/0 一致) / vehburn (**真 THREE 解析 3→1**+序号查询轻量化 3→2 真 boot; **13.6→6.5s**; 39 绿一致) / tankai (缓存; **20.7→12.0s**; 1/21 在案红签名原样; lane() 缓存主动放弃=同 ctx 只调一次零收益, 跨 ctx 复用不安全因各 boot 未播种 rand 世界不同) / sink (14→13 boot+**偶发根治三件套**: sf_pseed='424242' 钉 procgen 种子——旧 ?seed=42 钉不住 procgen 战役 ⇒ PG.rnd=true 每局随机抽种子 ⇒ 精确计数断言随抽签翻红=偶发真凶; +Math.random mulberry32 播种 (先例 roofghost); 3 连跑全绿, 14 行判定一致)。**全部只改探针输入与缓存, 零 js/ 游戏代码改动**。★方法教训: 探针输出含运行间随机量的 (nav 逐图统计/procgen 群系抽签), 等价验证必须取判定行 (✓/✗+合计) 而非全文 diff——原版自身两次跑即不同。

**切除 14 件** 归档 archive/dev-probes-cleanup-20261118/: _dbg-7c/_spec-audit (陈旧快照判据已漂移) + fix-deathcam-anchor/fix-perfquick (一次性 patcher 已消费) + _spawnflat/_steppe-pocket/_tankspawn (-tmp) /_vegwater/_dbg-nademap-tmp/_navleg-diag/_navcap (自称临时件, 死袋判据已由在册探针接管)。★盘点子智能体误报 _structbase.js 孤儿——复核发现 verify-uvscale.js:22 活依赖, 保留 (grep 漏报人工兜住)。

**回归**: 全量 -j10 **108/117 exit=0 墙钟 97.0s** (对比改造前 ≈25 分钟 = **≈15×**); 稳定红 6=在案台账逐支对认; 偶发 3 (matseam woodDark 明度抖动/loiterview T3/botprox S6 边界) 复核 3/3 全过=本批未引入任何新红。★ specthird 固定 tmp 路径加 pid 后缀 (并行隐患顺手修)。

**文档**: README §七·4 补新用法与红账口径 + §八本批行; 交付文档 finished-docs/批-验证套件并行化瘦身-2026-11-19.md (含给用户的五项裁定清单: 漏登补登 3 绿 2 需跟码/语义类提速选项/二三档切除候选/偶发族确定性化推广/戳钉判据改读 _game_files.txt 结构性改造)。

**实机验收**: 全量跑一轮墙钟量级; --only 定向秒级反馈; --rerun 0 快速档; 红名输出病灶可读。

## 一.121 验证套件瘦身二波: 三裁定落地 × 「减少重复验证」新令手术 (2026-11-19, 待实机验收)

**用户令①**: 一波交付文档五项裁定批复 = 补登 3 支全绿 / procgen 扫掠 240→60 / 二档切除全归档。

**用户令②**: 「我希望各个脚本可以减少重复验证的次数，并且能省则省。」

**裁定落地**: ①procgen 统计段 60 种子窗 **100037..100096** (240 宇宙滑窗扫描选定, **阈值零改动**——拒绝按 60 样本重校准, 严格度不降; farm=24/town=20/water=16 三群系最均衡窗) 535/0 ×3 连跑, 单跑 36.7→**15.9s**。②3 支全绿补登 SANDBOX (verify-tvosd-headbonk-20261110 / verify-frameperf-fx-20261113 / verify-walkstep-ceiling-20261118, 清单 108→111, 诊断工具 probe-renderstat 仍居尾)。③二档 8 件归档 archive/dev-probes-cleanup-20261118/ (_naval-selfcheck/_naval-model-selfcheck/_navalai-selfcheck/_navalcrew-selfcheck/probe-naval/_zfight-naval 海战自检残件 + verify-fixes.js + _fkey-selfcheck.js; 引用核查: _naval-model-selfcheck 仅被 _firepoint-selfcheck/_modelview **注释**提及=历史溯源指针, 归档后已把 3 处注释同步改指 archive 路径)。

**「减少重复验证」手术** (全部判定行等价法逐一验证):

- **tankai 6 boot→1 单世界** (23.3→**3.8s**, 套件最大头): 六段同战役同图仅差 SETTINGS.diff (本就支持运行期热切=tankAITune 按 diff 现算+分档缓存, duel() 一直热切)。合并三前提: ①确定性三件套 (sf_pseed='424242'+mulberry32 播种, sink 同款) ②三车道 (200/120/160) 在任何 mutate 之前**预搜存表** (lane 同世界几何确定性; 全程实搜 9 次→3 次) ③PRELUDE clear() 接 **restorePristineWorld() 单源** (23b 快照 boot 期已拍——残骸/火源/弹坑/沉没账/植被倒伏段间不再互泄)。红账语义原样: 1/21「新兵档双方都开了火」签名逐字一致; 确定性实证=两次运行断言行逐字节一致 (仅加载期 ms 日志漂移)。
- **nav 纯函数检验 4→2**: 同入参连跑 4 次改 2 次 (保留 1 组对照仍抓「残留状态污染本次」主病灶; 统计分母 gQueries×4→×2 跟码), 判定 8✓/0✗ 与 HEAD 逐字一致。
- **LC 接线 +6**: specbatch(11 boot)/structscore(10)/spec(9)/specthird(9)/aimassist(7) load 换 LC.script + frameperf2 (srcOf→LC.src + 按 f 编译 memo)。
- **真 THREE 解析去重 +6**: dynreload 6→1 次 / willow·achieve·parity·vehburnfix 各 3→1 (per-boot WebGLRenderer/prototype 补丁幂等, vehburn 先例) / phase2 LC 接线 (633KB 只解析一次; 类构建必须逐 ctx 不省)。
- **sink 桩忠实化**: 自带 THREE 桩 Obj3 补 rotateX/Y/Z no-op (与 _bootstub 2026-11-18 同款) —— 05b barrelWreck grp.rotateY 缺失 = moscow 坠机段偶发红真身 (桩不足假红非断言失败; 消掉后套件不再为其烧 3×31.8s 复核 CPU), solo 2 连跑全绿。
- **fixbatch 补线+过期锚跟码**: ★一波交付文档/提交信息称 fixbatch 已接线——**实为虚报** (git show e8b67ae 文件清单无此文件, 本波子智能体审计对照发现), 本波真正落地 (LC.src + 按 f 编译 memo, 正向 55/0); NEG 过期锚判据跟码 (feedName 2026-11-17 批走词典+观战豁免), --neg 复活 (46✓/6✗ 按设计报红)。

**回归**: 全量 -j10 = **109/117 exit=0 墙钟 93.4s** (一波 97.0s→, 基线 ≈25min≈15×→≈16×); 稳定红 6 = 在案签名逐支对认 (tankai 1/21 同签名), 偶发 loiterview 复核 3/3 过, timestopfix solo 2 绿 1 红 = 在案偶发族原样 (本批零触碰)。零 js/ 游戏代码改动; 新登 3 支全绿。

**待裁定遗留**: probe-bots 同款 rotateY 桩缺口=在案红真身, 修桩可解锁更深断言但改变裁定红语义 (未动); timestopfix/killattr/botai/loiterview 偶发族确定性三件套推广 (各自验证轮); nightgear/fixes-20261010 过期钉跟码; LC 二三档 ~12 支 (单支省 0.08-0.4s 收益递减)。

## 一.122 卡顿审计三案收尾: NAV 直写时代快路径 × 14-bots 重生风暴手术 (2026-11-19, 待实机验收)

11-18 审计批 (一.118 前身「全局卡顿审计修复」) 点名的"本批未动"三案收尾; 用户令边界=天气雨雪保持逐帧步进回滚态 (08-effects 零触碰, 探针 T10 批纪律钉)。drawFlagTex 捕获帧**归因撤回** (3 轮新抓帧 updateFlags ≤630µs=事件帧/GC 噪声误登账)。

**①NAV 直写时代快路径** (07-nav+03-terrain): 稳态 refresh 跳过 buildOccupancy 全量重建 (2.6-7.4ms/次 → 按登记簇直接烘焙=亚毫秒; 运行期占用改动自 2026-11-11 起全走直写四路 ⇒ OCC.data 已正确+全图差分恒空, 全量重建对这些改动纯冗余)。**1全:3快 配额** (killOne 盲置 0 角案收敛, 全量后重武装)。**门控双计数** _occAddSeq/_occAddSyncN (03-terrain): addBoxCollider 只入 BOXES 表 (裸直调=探针/合成摆件, 要等全量收编 ⇒ 回退全量=A/B 实锤回归案专项闸), registerDynCollider 入表后同时直写收编 ⇒ 追加数==收编数放行; 全量尾部清零。★首版单计数把 registerDynCollider (载具/飞机/卡车残骸, 坦克战高频) 也误判未收编=快路径永不 engage——写探针时发现, 改双计数。**旗翻型强制全量**: 碾铁丝网 (15-vehicles alive 翻无直写) markNavDirty(true) + **兼修旧漏报** (玩家拆除 updateDemolish 旧版从不报 NAV)。mutator 审计: 运行期直写四路全覆盖, 裸 addBoxCollider 全在构建期。

**②14-bots SAFE 集六项**: F1.2 出生链融合 (pickSpawnFor lane 循环+pickSpawnPoint tryRings 两遍 combatants 全表扫各融一遍; nearestEnemy=min/eCnt=序无关/crowd 同队原序 ⇒ 逐位同值) / F1.3 枪模缓存 _wgCache (kind|team|key, clone 出货=真 Object3D.copy 深递归子件共享几何材质, _bootstub clone 忠实化配套) / F3bc 掩体候选有界插入 top-12/top-10 槽 (严格小于前插=稳定全排序取前 K 同果)+threat 端 heightAt/org 外提 / F4 defend crowd 反转 (decide 一次扫进 _clmS 槽, r2c=1.7*1.7 局部保 FP, ×9 权重不动) / F7 AA 选Target 0.25s 缓存 (**含 alive 门**=认领目标亡下一帧即重投账本——首版无门被 phase4-7d R3 当场抓红) / F8 手雷聚拢三轴平方 (7*7*1.000001 相对裕量=875 行同款)。**跳过** (设计判断): _soldierSep 网格/perceive 两段式/lane 分帧缓存/风暴错峰/cover 射线预算/tankSurfH 信封/heightAt memo (前批已裁定)。**新登账候选**: updateNades 3.3-10.4ms 尖峰、GC 大停顿 ~每 300 帧 (最慢帧系统间游走=GC 被记到当时在跑的系统头上)。

**探针**: dev/verify-frameperf3-20261119 正 **52/52**+NEG **7/7** (buildOccupancy 裸名重绑计数=「全量重建是否发生」唯一判据出口; ★NEG 逐补丁隔离 boot——本探针三支 07-nav 补丁互斥, frameperf2"全部同跑"模式只适用互不相干补丁组); 判据跟码四处: verify-botai T7 (defend 内联化改钉 crowd*9 新源行, 54/0) / verify-fixbatch ②-k (铁丝网探针改走真碾平链路: 裸 NAV.refresh() 在快路径下看不见旗翻) / verify-phase4-7d R3 (11/11) / frameperf2 戳钉正则随升戳。

**回归**: run-all #1 116/127 抓到 2 真回归 (探针跟码+AA alive 门, 修后全绿) + frameperf3 T7b 偶发 (复核 3/3 过); #2 108/115=6 支在案红逐支对认+loiterview (**A/B 定罪: clean HEAD worktree solo 6 跑 3 红 PASS33/FAIL1 同签名=预存偶发族非本批引入**)。**前后对照** (probe-framespike camp0 900 帧): updateNavDirty 均值 16.2µs (改前每次 refresh 2.6-7.4ms), 最慢 12 帧仅 1 帧见 NAV (配额全量 6.6ms, 频率≈1/4), 其余=GC/事件帧游走同改前。升戳 20261118e→**20261119a** (index.html 49+__sfStyleVer+_game_files.txt 45+戳钉探针 28 支同扫)。详档 finished-docs/批-卡顿审计三案收尾-2026-11-19.md。

## 一.123 终局结算双条件全模式统一 × 火焰特效重做 (2026-11-19, 待实机验收)

用户两令: ①"要求'一方人数归零'且'另一方占领全部点位'同时满足时结算游戏。现在总是前者满足了就结束结算了"; ②"优化火的特效/粒子, 现在一个圆圈太简陋, 要与整体风格统一"。裁定: ①**全模式统一** (有点位图一律双条件; 破袭炸库/劫道护送的目标胜利路径不加门槛; 强点按 capturable 数据声明计); ②火焰=**方案2 贴图+活体** (专用贴图+SVG feTurbulence 精修, 纵拉≈2:1, 逐粒随机相位摇摆, 生命色带 白热→黄→橙→暗红; 粒子数/预算/上限全不动, 只换"长什么样"不换"有多少"); ③火苗尺寸**与现状相近**。

**①终局双条件** (21-match): `flagsLostOf(team)` 单源改写——旗点 (FLAGS) 之外并入 `SPOTS` 的 `capturable` 数据声明 (2026-09-21 WS3 同款哲学: 遭遇战全点可争/岛礁中立点可争/百团·断崖固定出生点不可争不计; 循环写法省旧 filter 每帧分配)。单侧归零结算 (:318/:323) 由"无旗模式豁免"改**须 flagsLostOf(对方)==0**; 双归零分支保持 draw; 1v1 对齐保留但豁免收窄到对称 1v1+新 paradox 门 `fieldCount(1-zt)>0` (修旧病: 被清场方持全旗时倒计时到期反判其胜)。30s 清场倒计时门槛 (:332) 与播报 (:294/:302 "须占领全部点位(余 {0} 处)+") 同源跟走; 22-hud wipeLine/modeLine (遭遇战·破袭·劫道词条新增) + 00b-i18n 五键 EN 同步。**verify-wipe 判据跟码重写**: T16/T17 改双条件语义 (flEarly 占满前采样+对称 1v1 对齐), T18 倒计时非启动断言, 新 T19 百团混编归属/T20 遭遇战强点 `fl===capN`/T21 断崖公路无点位图自然豁免护栏 (FLAGS=0+固定出生点不可争 ⇒ 归零即结=统一规则不误伤) —— **107/0 绿**。

**②火焰重做** (08-effects+02-scene+04b+16): **PT.flame** 专用舌形贴图 (Canvas 兜底=三段径向渐变纵轴堆叠泪滴, 与 radialTex 同 API 面桩兼容; SVG 精修=02-scene svgFlame 泪滴轮廓+feTurbulence 各向异性位移, svgReg('puffFlame') 同款管线) —— **白芯贴图**: 塑形归贴图、色带归材质 color。**spawnFlame** 帮手 (spawnP 补 `return p;`+老路 `p.ramp=0` 清账行=池化复用不串样式, 与 uuid 分池无关的确定性隔离): 附加账 stretch∈[1.7,2.2] 纵拉/swayA∈[0.45,0.95]/swF∈[5,9] rad/s (与 updateSmokes 火舌 fk 同数量级, nowT 秒钟)/双轴异频相位 (z ×0.83 频率 ×1.7 相位=扭动)/rotation=0 舌形朝上。**updateParticles 火苗分支** (零分配: 色带插值读 FLAME_RAMP 静态表+color.setRGB 复用材质 Color 对象; 老粒子无 ramp 走原路径逐位不变)。**换装六站**: 04b 生物附着/树冠火/持续火源/格火 + 16-aircraft 翼残骸火/机燃拖火 → spawnFlame; **保留 PT.flash**: 枪口焰/爆炸/灼痕 (fireDamageTick)/tbDetonate/flak——圆盘贴图干回本职。**SMOKES 燃烧弹云火舌** 换 PT.flame+纵拉 1.6 (updateSmokes 闪烁改 set(w,w*1.6) 保比——顺带修一处真 bug: 首版 spawn 处 rand 抽两次 x/y 不成比例, 探针 T6 当场抓红改单抽)。预算门 (fireFxOK 12 处)/FIRE_FX_BUDGET_STEPS/fireFlameN<14 限流/PARTICLE_MAX 池帽全原样。

**探针**: 新 dev/verify-firefx2-20261119 **正 44/0+NEG 3/3** (轻沙箱 00-config+08-effects; T1 贴图/T2 精修接线/T3 附加账/T4 摇摆解析式逐位+色带两端通道容差/T5 老路+清账/T6 云火舌/T7 站点钉+预算门原样; NEG 摘清账行/摘分支/火舌回退三补丁逐补丁隔离 boot)。**判据跟码**: frameperf-fx 计数包装 `t===PT.flash||t===PT.flame` (T-E 窗口 [100,240] 口径不变, 43/0)。**桩忠实化两处**: _bootstub _Color.setRGB (火苗色带真 THREE 本就有) + V3.addScalar (updateSmokes 云团 g*dt 增长消费); verify-fire/verify-firecap 轻沙箱 spawnFlame 委托桩 (spawnP 本就是 no-op 桩, 视觉火不在其测量范围)。**run-all 登记** verify-wipe+verify-firefx2 (清单 113→115, eval 核账)。

**回归**: 全量 -j10 **112/120 exit=0 墙钟 132s** —— 6 支在案红逐支对认 + loiterview (PASS33/FAIL1 同签名=预存偶发族) + botai (T2 墙落索敌=在案偶发族) 原样。★**A/B 定罪两件预存红** (clean HEAD worktree 同签名复现, 非本批引入, 待用户裁定是否登记台账/跟码): verify-weather (WX_SPEC 14 条 vs CAMPAIGNS 13 图——coral/ironbottom 下架后未跟码+全图 fog 指纹过期) 与 verify-daynight (T2 铁底 R5 锁夜=测已下架图) —— 两件均**不在 run-all SANDBOX** (历史脱册), 不影响套件绿账。升戳 20261119a→**20261119b** (index.html 49+__sfStyleVer+_game_files.txt 45+戳钉探针 28 支同扫负向断言保 .js 文件名)。详档 finished-docs/批-终局双条件与火焰重做-2026-11-19.md。

## 一.124 布娃娃一致性 × 军刀近战重做 × 火力点不下车等九项 (2026-11-20, 待实机验收)

九任务工单: ③烧毁击杀归因/④改兵种界面不切调试/⑤维修距离 4.5→5.5/⑥布娃娃一致性(两轮实机对抗)/⑦死亡动画选项/①军刀近战重做/②固定火力点不下车。①②按用户令委托子智能体实现(隔离布娃娃上下文), 主线程侦察定案+收尾回归。升戳 20261119b→**20261120a→20261120b**。

**⑥布娃娃** (12-ragdolls): 实机"帧异常 g.add is not a function+站桩孤儿半成品"真凶=手/靴子网格误传 CANNON.Body 当 bx 宿主→生成段中断, 已 add 部件成孤儿。终态三层: 手/靴/腰带/背包宿主全改**部件网格** (`const armLm=parts[parts.length-1].mesh`)+spawnRagdoll 生成段 try 护栏 (抛错→清账 bodies/meshes/constraints→return false→Bot/玩家/丧尸三路回退无物理死亡)+**头盔与头相对锁死** (buildHelmetInto 直建头部件网格=头心系与活体逐位同框, 无刚体无约束; 旧独立刚体+P2P 松挂+死亡弹开整段摘除=2026-09-12 盔弹射类根除; 日盔球/我帽檐照旧)。⑦deathFxBtn 单钮 就地倒下⇄布娃娃 (deathFallMode 单源三路门)。**③归因**: 15-vehicles/15b/15d takeDmg 有归属受击重盖章 lastHitBy+燃烧账/打爆 die(burnBy||lastHitBy||null) 双章回退+章不跨生死; 16-aircraft 口径外维持旧单章。**④**: 战地整备点自己巡飞弹兵卡=早退提示, 不弹调试确认 (调试≡旧观战, 战斗中路径封死, 唯一开启口=选兵/阵亡部署页); specbatch T3 跟走新契约。**⑤** VEH_REPAIR_R 5.5。**①军刀** (09a-defs/19-input/18-game/10-viewmodel/09-weapons/11-soldiers/20-player/23-deploy/14-bots/22-hud/00b-i18n): 第三槽+N 切换 (switchSlot 复用, _lastGunSlot 记账, 无拔刀动画)+startMelee 单源三式 (LMB 刺45/RMB 斩35 扇形120°+遮挡/MMB 劈70, 0.35/0.5/0.7s, VM 态驱动命中 0.4/0.35/0.5)+FP/3P 刀模+四表登记+vmEquip 不进 draw+Bot 45·军刀归因+HUD melee 档。**②坐姿** (18-game/19-input/20-player/22-hud): seatReload/seatReloadDur 新账+tryReload 重构 (冻账收编/火力点分支)+reloadDurOf 单源抽取+okH/readBarBusy 摘五旗+座位收尾 VM 归位+左键开炮豁免+下机静默清账+岸防炮键门放行 H/R+双击打断零新代码继承。

**探针**: 新 3 支入册 run-all (115→118): verify-ragdoll2 **28/0**/verify-melee **55/0**/verify-seatbar **102/0** (各 NEG 定向红+隔离 boot+真击杀键链+忠实 CANNON 桩 Body 无 .add)。判据跟走 ~15 支全绿: specbatch 79/0 (④契约)/fixbatch 29/0 (头盔旧刚体钉→锁死钉)/vehburnfix (BURN_RET 双章+BURN_RET_AIR 分立, NEG 6红对认)/audio3 47/0 (T2b 豁免 melee)/frameperf2 34/34+frameperf3 52/52 (戳窗)/fieldfix2 (A2 5.5)/nadecancel (旧 N 钉→新单行)/cmdui/radio/specweapon (CARRIED_FWD+sabre)/20261118c (红门 !melee)/animfix (mousedown 锚换新; knifeM 三件套兼容)/batch-20261030 (计数 11→10+barArmKey 2→3)/dynreload (N1 锚跟 reloadDurOf)。

**回归**: r1 129/144 抓 6 新红逐支分诊 (5 判据跟走+2 戳窗) 修后全绿; r2 **113/120 exit=0 墙钟 100.4s**=6 在案稳定红对认+botprox 偶发族 3/3 复核过=零新回归。套件外遗留记账待裁定: verify-a21-j 22/25 红 (WPN_DEFS 键切片被 sabre 截断的既有盲区)+verify-cmdui --neg 的 26-commander 锚 (2026-11-17 批6 改写)。详档 finished-docs/批-布娃娃军刀与火力点不下车-2026-11-20.md。
