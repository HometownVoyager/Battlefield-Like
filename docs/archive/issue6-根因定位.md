# 第6条「部分地图主页没有隐藏UI」根因定位报告

> 2026-09-20 · Lead 独立定位 · 证据全部来自**真浏览器实机**（Edge + CDP），非静态阅读推测

## 一、结论（先说答案）

**`body.inMenu` 的增删逻辑本身没有 bug；问题出在"部署界面"这一段没有隐藏战斗 HUD。**

具体地说：`startGame()` 摘掉 `inMenu`（`js/22-hud.js:974`）之后会调用 `showDeploy(true)` 显示 `#deploy` 面板。
而 `#deploy` 的 `.screen` 背景只是 **94%~97% 不透明**的径向渐变（`css/style.css:245`）：
- 它不是 `#ui` 的兄弟遮罩，而是**靠半透明盖住**底下的 `#ui`（z-index 20 vs 10）；
- 于是 `#ui` 里的小地图、血条、弹药面板、顶栏会从遮罩底下**透出来**。

观感就是用户说的"主页没有隐藏 UI"。

## 二、实测证据

### 证据 1：`inMenu` 时间线（排除"菜单期真的显示了 HUD"）

方法：给 `DOMTokenList.prototype.add/remove/toggle` 打补丁，记录每一次对 `body.classList` 的 `inMenu` 操作及调用栈。
探针：`dev/probe-inmenu-watch.js`

全代码库对 `inMenu` 的写入只有 6 处：

| 位置 | 操作 | 场景 |
|---|---|---|
| `js/22-hud.js:787` | add | `returnToMenu()` 返回主界面 |
| `js/22-hud.js:798` | remove | `resumeBattle()` 回到战局 |
| `js/22-hud.js:974` | remove | `startGame()` 开局（**含部署阶段**） |
| `js/21-match.js:384` | add | `endMatch()` 结算 |
| `js/24-main.js:267` / `:286` | add | 启动期 + 末尾状态机权威自检 |

实测时间线（节选）：

```
t+5270ms  remove("inMenu")  startGame (22-hud.js:974)
t+10469ms add("inMenu")     returnToMenu (22-hud.js:787)
t+11778ms remove("inMenu")  startGame (22-hud.js:974)
t+14412ms add("inMenu")     returnToMenu (22-hud.js:787)
t+20796ms add("inMenu")     21-match.js:384   ← 结算
```

逐步骤 `#ui` 的 computed `display` 实测结果：

| 步骤 | `#ui` display | 判定 |
|---|---|---|
| 首屏主菜单 | `none` | 正确 |
| 点「新 游 戏」面板 | `none` | 正确 |
| **进入战场（部署界面）** | **`block`** | **★ 这就是问题** |
| 战斗期 | `block` | 正确 |
| 返回主界面 | `none` | 正确 |
| 结算 | `none` | 正确 |

**主菜单 / 面板切换 / 结算 / 返回主界面的每一条路径上 HUD 都被正确隐藏** —— 所以"菜单期显示 HUD"在标准路径上复现不出来，必须往部署界面找。

### 证据 2：部署期 HUD 模块清单

方法：遍历 `#ui` 内全部 HUD 模块，取 computed style + `getBoundingClientRect`。
探针：`dev/probe-deploy-hud.js`（视口 1570×905）

```
--- ① 部署界面 (未落地) ---
deploy=flex [0,0,1570,905]   menu=none   ui=block   body=""   deployed=false
   部署期可见的 HUD 模块 (11 个)，全部 opacity=1：
     ammoPanel    rect=[1417,796,127,85]
     healthPanel  rect=[26,832,230,49]
     minimapWrap  rect=[18,18,190,190]
     topBar       rect=[444,14,682,114]
     killfeed     / fps 等
--- ② 战斗期 (对照) ---
ui=block menu=none deploy=none deployed=true      (14 个模块可见 = 正确)
--- ③ 主界面 (对照) ---
ui=none  menu=flex  body="inMenu"                 (正确)
```

截图 `dev/out/deploy-hud.png` 肉眼可辨：**小地图、血条(100)、弹药面板(8) 从遮罩底下清晰透出**。

### 证据 3：与用户截图交叉印证

用户截图里同时存在四类元素：

1. `#mPlay` 开始面板（标题/副标题/五个按钮）+ 左上角 `#menuArt` 战役沙盘与阵营盾徽 → 菜单层
2. 小地图 + 左上台军兵力/旗点/计时（`#minimapWrap` / `#topBar`）
3. 左下 "100" + 长条（`#healthPanel`）
4. 右下 "M1 加兰德 / 8 / 手雷 ×3"（`#ammoPanel`）

其中 2/3/4 只可能来自 `#ui`。而按证据 1，"菜单期"不可能出现 `#ui` ——
因此用户看到的"主页"实际是**部署界面那一段**（部署面板 + 从底下透出的战斗 HUD），
这也解释了用户"一部分地图"的观感差异：不同地图的部署面板内容高度不同（兵种卡/出生点列表长度，
以及是否有「观战载具」等额外出生项），面板外的**透出面积**因此不同 —— 面板内容越短，HUD 露得越多。

## 三、修复口径（已下达给 `js/22-hud.js` / `css/style.css` 的 owner）

1. 新增 `body.inDeploy` 状态（**不复用 `inMenu`** —— 后者的语义是"菜单/结算"，
   与 `resumeBattle()`/`startGame()` 的成对摘挂逻辑耦合，塞进部署会让状态机变浑）。
2. `css/style.css` 里与 L52 同构新增：
   `body.inDeploy #ui, body.inDeploy #touchUI { display:none !important; }`
3. 挂/摘点严格成对：`showDeploy()` 挂、`deployPlayer()` 摘；
   注意 `resumeBattle()` 走的是 `showDeploy(false)`，这条路径也要摘干净。
4. **不接受**"把 `.screen` 背景改成 100% 不透明"这种糊法：HUD 仍在渲染树里（白烧性能），
   用户要的是"隐藏 UI"。

## 四、本批新增的验证设施（可复用）

| 文件 | 用途 |
|---|---|
| `dev/cdp.js` | Edge/Chrome CDP 无头探针库：`openPage` / `eval` / `waitFor` / `click` / `key` / `screenshot` / `close`；已内置 `confirm()` 对话框自动接受（否则「新游戏」的二次确认会永久阻塞协议求值） |
| `dev/probe-menu-hud.js` | 主菜单 HUD 隐藏回归（首屏 / 面板 / 进战场 / 返回 / 二次往返 / 继续游戏 + 启动链异常检查） |
| `dev/probe-inmenu-watch.js` | `inMenu` 增删时间线（带调用栈），用于定位"谁在什么时候放出了 HUD" |
| `dev/probe-deploy-hud.js` | 部署期 HUD 露出清单（逐模块矩形 + 是否被面板盖住） |
| `dev/probe-deploy-cover.js` | 堆叠上下文全量数据（display/opacity/z-index/背景/elementFromPoint） |
| `dev/_brace-scan.js` | 括号配平定位器（本批用它定位过一次 `class Bot` 提前闭合事故） |

运行前置：`node .serve.js`（8000 端口）+ 外网可访问 `cdn.jsdelivr.net`（three/cannon 从 CDN 加载）。
