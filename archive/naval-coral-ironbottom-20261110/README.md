# 归档：两张纯海战地图 + 大舰子系统整体下架（2026-11-10）

**定性**：用户裁定——珊瑚海海战（coral）与铁底湾夜战（ironbottom）两张纯海战地图「彻底失败破产」，
连同大舰子系统（15g/15h）整体下架。相关代码从主线全链摘除，**被摘代码原文归档于本文件夹**，
主线所有摘除点均留有 `(2026-11-10: … 随大舰子系统下架摘除)` 式移除注记（共 21 个 js + index.html，
约 110 处），摘除原文可从 git 历史取回。

## 归档清单

| 文件 | 内容 |
| --- | --- |
| `15g-capmodels.js` | 大舰模型（战列舰/航母分型放样：舰岛、主副炮塔、高炮、弹射器、拦阻区、甲板室，命中盒/足迹） |
| `15h-capital.js` | 大舰子系统运行时（capitalShips 巡航/甲板移动平台/炮位接管/甲板旗点跟随/停机-弹射-拦阻/复位/火源） |
| `00config-extract-coral-ironbottom.txt` | 两张图的战役条目 + 全海图口径注释（原 js/00-config.js 915–1026 行：terr/layout:'opensea'、甲板旗点 ship:/crateL:/baseCrateL:、大舰编制 capital:[]、_capRing 巡逻环、sea.muster 等） |
| `probes/verify-naval.js` | 海战 10 条验收红线 |
| `probes/verify-navalcap-20261001.js` | 海战系统性大修验收（2026-10-01b） |
| `probes/verify-navalround4-20261002.js` | 海战第四轮（2026-10-02） |
| `probes/verify-navalround5-20261002.js` | 海战第五轮（2026-10-02B） |
| `probes/verify-navalround6-20261003.js` | 海战第六轮（2026-10-03） |
| `probes/verify-phase5-capital.js` | 阶段五 P4 大舰子系统验收（2026-09-30） |
| `dev-tools/_probe-capdeck.js` | 大舰甲板取证工具（直接读 15h 源码） |
| `dev-tools/_probe-capplayer.js` | 大舰玩家态取证工具（直接读 15h 源码） |
| `dev-tools/verify-seabatch.js` | 海战地图 7 项优化交付批次验收（未注册 run-all） |

## 主线摘除概览（2026-11-10 批）

- **整文件删除**：`js/15g-capmodels.js`、`js/15h-capital.js`（即本归档两支主件）。
- **index.html**：两条 script 标签摘除（版本戳 50→48 处），留移除注记。
- **js/00-config.js**：coral/ironbottom 两战役条目 + `_capRing` + 大舰基地前置钩（战役 14→13）；
  `NIGHT_MODE` 的 ironbottom 强制锁夜口径一并摘除。
- **地形/布局**：03-terrain `case 'opensea'` 全海海底图；05c-layouts 两图布局/浪花/浮标/甲板弹药箱落位。
- **碰撞/火**：04-collision capPushBody（舰体硬碰）、capDeckY（甲板移动平台）；04b-fire 随舰火源等。
- **战斗链**：13-combat 大舰甲板接触块、吃雷钩（15d 侧注记）、capSuperSolidAt 反弹候选；15-vehicles
  capitalShellHit 钩。
- **机**：16-aircraft 甲板停机/弹射/拦阻（capArrestTick/plParkLift/capLaunchPlane）、机-舰碰撞（B14）、
  对舰挂弹点名、高炮弹对舰判定；原 capTgtVel 的**艇/机分支收编为 planeTgtVel** 留在 16-aircraft。
- **人/椅**：20-player ②b 大舰甲板交互层、游泳登舰/舰载机登机、大舰炮位座位分派、大海致命化
  （opensea 只耗不回 + 强制下沉 + 溺水挣扎 ×seaDrownMul）；18-game/19-input capitalGun 座位门。
- **Bot**：14-bots 大舰编队/甲板旗/摆渡/离岸纪律/溺水伤等 19 处注记。
- **规则/界面**：21-match capFlagActive/capCrew 记分；22-hud 大舰地图符号/弹药面板/ironbottom 锁夜；
  23-deploy 大舰部署轮廓/编制/甲板吸附；23b-worldrestore capitalReset；24-main 巡航 tick/编制载入期生成；
  12-ragdolls 甲板布娃娃；17-emplacements 甲板出生豁免；25-zombies/26-commander capCrew 项。

## 保留件（未动，属岛图河湖既有功能，恢复时勿误删）

- `15d-naval.js` / `15e` / `15f`：**小艇与两栖车**（淞沪/岛屿等图的水网航道仍在用）。
- `onNaval` 舱位账、navalCraft、`navalCanFootExit`、小地图 `sfNavalMapSymbols`。
- `planeFloorY`（水面撞地地板，2026-10-01b 引入，注释已改写去 opensea 字样）。
- 对艇提前量 `planeTgtVel`（原 capTgtVel 收编，16-aircraft）。
- ironbottom 标定样例类**史实注释**保留原文。

## 判据跟码记录（本批探针侧改动）

- `verify-vehburn-20261109.js` 三钉跟码：①飞机支 `!crash` 门（同批三蟲抓①坠地机毁人亡不跳伞）
  ②22-hud 大舰炮位 nadeN 行摘除 ③20-player「详细操作开关」注释 7→6。
- 6 支海战探针退出 run-all 注册表并归档；`verify-seabatch.js`/`_probe-capdeck.js`/`_probe-capplayer.js`
  一并归档；约 75 支共用探针载入清单摘除 `'js/15g-capmodels.js'/'js/15h-capital.js'` 两项。

## 恢复指引

不建议恢复（用户裁定破产）。若确需恢复：从 git 历史取回 15g/15h 与各摘除点原文、回植两条 script 标签、
按 `00config-extract-coral-ironbottom.txt` 回植战役条目与 `_capRing`，并把 6 支海战探针重新登记
run-all-verify。版本戳以恢复当日新批为准（下架时为 20261110b）。
