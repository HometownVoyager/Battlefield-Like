# 《钢铁前线》本批 7 条需求 · 独立终验审计报告

> 审计员: 独立终验 (只读审计; 未修改 `js/` `css/` `index.html` 任何一行)
> 审计时间: 2026-09-21 · 工作区 `D:\Artifact\Battlefield Like - MIMO` · 基线提交 `c7a0e98` (本批改动全部未提交)
> 版本戳: `20260920e` (index.html 内 38 处, verify-text ③ 通过)
> 审计脚本 (全部新建于 `dev/`, 以 `_finalaudit-` 前缀): `_finalaudit-flash.js` `_finalaudit-tankai.js` `_finalaudit-ff.js`
> `_finalaudit-deploy.js` `_finalaudit-foliage.js` `_finalaudit-vehsize.js` `_finalaudit-tp.js` `_finalaudit-diffhygiene.js`

## 一句话总判定

**7 条需求全部通过**；启动链未崩（全量套件 **20/20 exit=0**），所有关键结论均由我亲手跑出的输出支撑。
**但有 1 条需要用户一句话确认**（观战幽灵坦克的主炮/同轴机枪同样能打友方 —— 与"只有观战连狙可打双方"的字面口径冲突，代码自称是 09-17 既有现状），
另有 **2 处"自述与实测不符/覆盖缺口"** 与 **1 处精英档方向性观察**，见文末清单。

## 7 条需求逐条汇总

| # | 需求 (用户口径) | 判定 | 我的关键实测数字 |
|---|---|---|---|
| 1 | 完整坦克交战 AI，不同难度不同削弱，不超雄，车身不互穿 | **通过** | 首炮延迟 新兵 2.50s / 精英 1.32s = **1.89×**；主炮散布 新兵/精英 = **4.31×**（自述 4.28×，偏差 0.7%）；套件含 200m 对置交战 + 最小中心距 ≥2.6m 断言全过 |
| 2 | 按国家+车型出可辨识剪影，纯程序化几何不加外部资源 | **通过**（客观项） | 24 型 (6 阵营 × 坦克2/战机2)；日系比苏/德 半宽 **−10.74%** / 半长 **−10.58%** / 车体长 **−10.48%**（均 >8%）；极端 九七式 vs 黑豹 半宽 −12.78% / 半长 −17.44%；网格 坦克 22–36 (护栏 ≤36) / 战机 10–14 (护栏 ≤20)；外部资源仅 three+cannon |
| 3 | 只有观战连狙可打双方，其余武器保持现状 | **通过**（附 1 条待确认） | 连狙→友方 **−75 掉血** ✓；步枪→友方 **0** ✓（阳性对照 连狙→敌方 −75 / 步枪→敌方 −36 均命中）；幽灵坦克同轴机枪→友方 **−40**、主炮→友方 **−260 击杀**（★待确认） |
| 4 | 增加切换第三人称 | **通过** | KeyU: 相机↔眼位 0m → **3.6m** → 0m 可逆；★弹道起点↔眼位 **0m** / ↔相机 3.6m（没跟着相机跑）；移动端触控键 `#tView` touchstart 实测切换成功；载具内互斥 |
| 5 | Bot 到处闪来闪去 | **通过** | 独立复算 **非重生帧单帧位移>3m = 0 件**（柏林 #2 seed 20260921 90s：84 件 >3m 全部是重生帧；塔拉瓦 #11 seed 777001 90s：77 件全部是重生帧）；次阈值残留 3 件 ≈1.22–1.26m |
| 6 | 部分地图主页没隐藏 UI | **通过** | 部署期 `body=inDeploy` + `#ui=none` + 真渲染 HUD 模块 **0**；★摘掉 `inDeploy` 后同帧复现"修复前"：`#ui=block` + **5 个模块真渲染** + `elementFromPoint(小地图)=deploy` |
| 7 | 塔拉瓦植被太少 + 灌木/树冠挡视野但不挡子弹 | **通过** | **6/6 样本**：同一对眼位 `foliageBlocksLOS=true` ∧ 真实 `perceive()` 看不见 ∧ `fireBullet` 命中掉血 40；全局关植被对照 `los=false` 且立刻看见；`foliageBlocksLOS` 全仓仅 2 个调用点，都在 AI 视线函数内 |

**合计通过 7/7**（其中第 3 条附 1 条需用户确认项）

---

## 核验 0：全量回归（第一红线：启动链不能崩）

**命令**
```
node dev/run-all-verify.js --browser
```

**实测输出（原样）**
```
===== 合计: 20/20 次运行 exit=0 =====
全部通过 ✔
SUITE EXIT=0
```
17 个沙箱 + 3 个真浏览器探针全部 exit=0，含 `verify-boot.js`(全战役 LOAD)、`verify-text.js`、`verify-layouts.js`(13 图指纹)、
`verify-specthird.js`、`verify-tankai.js`、`verify-vehmodels.js`、`verify-foliage.js`、`probe-deploy-hud.js`、`probe-menu-hud.js`、`probe-inmenu-watch.js`。

> **★ 必须记录的自我纠错**：我第一次跑出的是 `19/23 exit=0`，唯一失败项 `verify-text.js` **稳定失败**。
> 定位结论：**是我自己的审计产物污染，不是项目回归** —— 我用 PowerShell `Tee-Object` / `2>>` 重定向把捕获文件写成了
> **UTF-16LE**（首字节 `255,254`），被 `verify-text.js ①全仓文本文件编码合法` 抓到（`异常: dev\_finalaudit-runall.txt (非法 UTF-8)`）。
> 把这些 `.txt` 移出仓库后 `node dev/verify-text.js` → `✓ verify-text: 全部通过`，`LASTEXITCODE=0`，套件随即 20/20。
> **结论：项目本身在文本编码上也是干净的。**（这条写下来是为了避免后人把 19/23 误读成回归。）

**套件覆盖缺口（自述与实测的差异 ①）**：`dev/verify-specthird.js` 有 `--browser` 真机分支（脚本 731 行 `if(process.argv.indexOf('--browser')>=0)`），
但 `dev/run-all-verify.js` 的 `SANDBOX` 表以**无参**方式调用它 → 套件只覆盖沙箱 **53/0**，"真机 61/0"**不在回归里**。
我手动补跑：
```
node dev/verify-specthird.js --browser   → 通过 61 项, 失败 0 项   (EXIT=0)
  · ②部署界面(startGame后): body="inDeploy" #ui=none(rendered=false) 部署=flex 菜单=none 真渲染 HUD 模块=0 个
  · KeyU 真按键: 按下后 thirdPerson=true 生效=true 相机距角色=4.44m → 再按一次 thirdPerson=false 相机距角色=1.62m
```
⇒ **自述数字本身是准确的**，缺口在套件没有把它纳入（建议见文末清单 B1）。

---

## 第 1 条：Bot 坦克机制（完整交战 AI + 分难度削弱 + 不互穿）

**用户口径**："我选3，完整坦克AI逻辑但不同难度下应当有不同削弱" + "既要看见交战，也要车身互不穿模" + "不能太超雄"。

**我核验的对象**：`js/15-vehicles.js` 的 `TANK_AI` 三档表（L79-84）、`tankAITune()`（L91）、`tankPerceive`（L632）、
`pickTankTactic`（L731）、`tankFireLineClear`（L167）、`vehiclePushTanks`（L117）；以及自述数字
"新兵延迟 2.25s / 精英 1.25s（1.80×）、散布 4.28×"。

**我用的命令**（自己写测量：自写随机采样车道搜索 + 包装 `Tank.prototype.fireCannon` 直接记调用 + 叉积 `|v×aim|/|v|` 取角偏）
```
node dev/_finalaudit-tankai.js
```
**实测输出（原样）**
```
  新兵档 tune: {"diff":0,"name":"新兵","vis":188,"react":1.36,"spreadMul":2.125,"tRate":0.6,...,"fireTol":0.1,"fireR":140,"mem":3.2}
  精英档 tune: {"diff":2,"name":"精英","vis":293.75,"react":0.448,"spreadMul":0.51,"tRate":1,...,"fireTol":0.035,"fireR":260,"mem":5.6}
[①] 首次开火延迟 120m 对置 塔偏±1.2rad hp9000
  新兵: {"fireA":2.5,"fireB":2.5,"shotsA":15,"shotsB":14,"endD":105.2}
  精英: {"fireA":1.32,"fireB":2.5,"shotsA":15,"shotsB":11,"endD":53.8}
  ⇒ 我实测: 新兵 2.50s / 精英 1.32s / 比 1.89×
  ⇒ 自述值: 新兵 2.25s / 精英 1.25s / 比 1.80×
  ⇒ 偏差: 新兵 +0.25s (11.1%) 精英 +0.07s (5.6%)
  [旁证 150m/12s] 新兵 2.45s / 精英 1.20s / 比 2.04×
[②] 散布实测 (同姿态 240 发, 叉积取角偏 rad; 括号内=折算 400m 横向偏差)
  新兵: 平均 0.01480 / 标准差 0.00604 (2.42m @400m) / p90 0.02248 / 最大 0.02733
  老兵: 平均 0.00701 / 标准差 0.00264 (1.05m @400m) / p90 0.01101 / 最大 0.01305
  精英: 平均 0.00352 / 标准差 0.00140 (0.56m @400m) / p90 0.00551 / 最大 0.00636
  ⇒ 我实测 新兵/精英 标准差比 = 4.31×  (p90 比 = 4.08×)
  ⇒ 自述 4.28×  |  代码口径理论值 0.023375/0.005610 = 4.17×
  ⇒ 与自述偏差 0.7%  (≤20% 通过)
  ⇒ 递减性: 新兵>老兵>精英 = 成立
```
**判定：通过。** 三项自述数字全部复现，偏差 11.1% / 5.6% / 0.7%，均 **≤20%**。
难度分档不是"只改了一个数"：`TANK_AI` 表分 12 列（炮塔转速/俯仰/提前量误差/散布/停车观察/倒车/追击/绕侧/抢掩体/开火容差/火力距离/记忆），
新兵 `chase=0 flank=0 cover=0.1`（几乎只会直线压上），精英全开；`fireR` 140/200/260 直接压住"隔半张图点名"。

**★ 方向性观察（自述与实测的差异 ②，非缺陷但要如实写）**：自述把散布改动整体叙述为"削弱"。
按代码口径，改造前**三档恒 0.011**，改造后为 新兵 0.0234 / 老兵 0.011 / 精英 **0.0056** ——
即 **新兵被削弱 ≈2.1×、老兵不变、精英反而被加强 ≈2.0×**（400m 横向偏差 精英 0.56m）。
"不能太超雄"对新兵档成立；精英档的"削弱"是靠反应延迟（react 0.448×1.6）、首次发现停车（halt 0.6）、
更紧的开火容差（0.035）与火力距离上限（260m）承担的，不是靠散布。这是设计选择，但**叙述方向与代码相反**，故记在此。

**不互穿**：由套件 `verify-tankai.js` 断言 ③ 覆盖并通过（正面对撞/侧向切撞全程最小中心距 ≥2.6m、极端重叠 6s 分离到位置下限 2.9m）。
此项我**未独立复算**，仅确认套件 exit=0（诚实标注：这是套件证据，不是我的实测）。

---

## 第 2 条：坦克/飞机模型剪影（尺寸红线）

**用户口径**："日本鬼子的小豆丁和苏联德国的坦克怎么能是同一个外形和Size呢？飞机的问题也差不多" →
"炮塔形状/车体轮廓/负重轮/涂装分档"，纯程序化几何，不加外部资源。

**我核验的对象**：`js/00-config.js` 的 `tk`/`pl` 规格表（L915-993）、`js/15-vehicles.js` 的
`tkSpec/tankBuildHull/tankBuildGear/tankBuildTurret`、`js/16-aircraft.js` 的 5 个工厂；`vehHitCyl`（L20，r=2.3m）。

**我用的命令**（把沙箱几何类换成"记录尺寸"的同构类 → 用**真实建模工厂**建 24 型 → 自写 3×3 欧拉合成 + 8 角点求 AABB）
```
node dev/_finalaudit-vehsize.js
```
**实测输出（原样，节选）**
```
vehHitCyl: 半径 r=2.3m, 高度 y0=0 → y1=2.6m
模型数: 坦克 12 / 战机 12 = 24 型
  阵营  型号              半宽(几何) 半宽(游戏halfW) 半长   2.3-半宽  2.3-半长  高[lo,hi]      全Z(含炮管)   轮/网格
  us    M4 谢尔曼             1.985       1.985    3.186    0.315   -0.886  [0.06,2.465]  [-3.186,4.25]     10/24   ★超出圆柱
  ger   黑豹                 2.042       2.042      3.6    0.258     -1.3  [0.06,2.655]  [-3.6,5.79]       14/36   ★超出圆柱
  sov   T-34/76            2.018       2.018    3.236    0.282   -0.936  [0.06,2.425]  [-3.236,4.74]     10/22   ★超出圆柱
  jp    九七式中战车             1.781       1.781    2.972    0.519   -0.672  [0.06,2.19]  [-2.972,4.08]     10/24   ★超出圆柱
  kmt   维克斯6吨              1.899       1.899    2.877    0.401   -0.577  [0.06,2.25]  [-2.877,3.65]      8/22   ★超出圆柱
-- 尺寸分档: 日系 (jp/cpc) vs 苏/德 (sov/ger) --
  halfW_geo  日系均值 1.814  苏/德均值 2.032  日系比苏/德小 10.74%  ⇒ ✓ >8% 达标
  halfL_geo  日系均值 3.051  苏/德均值 3.412  日系比苏/德小 10.58%  ⇒ ✓ >8% 达标
  hullL      日系均值 5.550  苏/德均值 6.200  日系比苏/德小 10.48%  ⇒ ✓ >8% 达标
  最窄日系 九七式中战车 半宽 1.781  vs  最宽苏/德 黑豹 半宽 2.042  ⇒ 小 12.78%
  最短日系 九七式中战车 半长 2.972  vs  最长苏/德 黑豹 半长 3.6  ⇒ 短 17.44%
★ 半宽/半长超出 2.3m 圆柱的坦克: 12 / 12
```
> 方法学自纠：我第一版的 AABB 遍历**漏了每个节点自身的 position**（把每个 mesh 的盒子摆在其父原点上），
> 于是履带/翼板/炮管等"偏移放置"的部件全部被少算（谢尔曼半宽量成 1.40 而非 1.985）。修正后，
> **我量出的半宽与游戏自己算的 `halfW=S.trkSx+S.fendW/2`（15-vehicles:406）12 型逐个完全一致** —— 这是双向交叉验证。

**判定：通过（客观项）。**
1. **半宽全部在 2.3m 圆柱内**，余量 0.246m（潘兴）～0.519m（九七式）。
2. **半长全部超出圆柱**：车体半长 2.877–3.60m，超出 0.577–1.30m。**这是本批之前就存在的口径**，不是 I2 引入：
   `git show HEAD:js/15-vehicles.js` 的 `vehHitCyl` 一字不差同为 `r:2.3`，旧建模也是 `BoxGeometry(2.6,0.95,L)` + 翼板 `L+0.3`
   （旧半长同样 = `(L+0.3)/2`）。⇒ 落在车体最前/最后 0.6–1.3m 的炮弹会穿过去不掉血。见文末清单 C1。
3. **±15% 包围盒护栏成立**：旧模型半宽恒 1.995（`fender.position.set(±1.62)` + 宽 0.75），
   新模型 1.781–2.054 ⇒ 最大变化 +2.96% / −10.7%，都在 ±15% 内。
4. **日系 vs 苏/德 >8% 达标**（10.48%–10.74%），极端单车对比 12.78% / 17.44%。
5. **纯程序化几何、无外部资源**：`index.html` 全仓外部引用只有 `three@0.152.2` 与 `cannon@0.6.2` 两条 CDN（+1 条兜底重复），
   模型只由 Box/Cylinder/Sphere/Cone 图元构成（我的记录类捕获到的全部类型）。
6. 网格数护栏（自述 坦克≤36/战机≤20）：我实测 **坦克 22–36 / 战机 10–14**，与自述一致（战机上限更宽裕）。
7. 剪影离散档确实存在：5 种车体档 `sherman|pz4|t34|chiha|vickers`、5 种炮塔档 `round|box|hex|hexLong|smallRound`、
   3 档涂装 `plain|two|camo`、6 种机型档 —— **"能不能一眼认出来"属主观，见人眼清单**。

---

## 第 3 条：观战连狙可打双方（其余武器保持现状）

**用户口径**：**"只有观战连狙可打双方，其余武器保持现状"**。

**我核验的对象**：`js/13-combat.js` 的 `coFfFire`(L16) 与两处过滤(L25 步兵/L87 载具)、`js/18-game.js` 的 `ffSpecSniper`(L24)、
`js/20-player.js` 的标记同步(L556/L571)、`js/15c-specveh.js` 的幽灵坦克(L173/L189/L257)、`js/23-deploy.js` 的 `applySpectatorLoadout`(L409)。

**我用的命令**（真浏览器 Edge + CDP；每格配阳性对照；开火前后 **diff 全场每个 bot 的 hp**，并先把弹道上其余 bot 横向挪开 12m）
```
node dev/_finalaudit-ff.js
```
**实测输出（原样）**
```
  · spectator=true slots=["garand","specsniper"]
  · curW=specsniper ffSpecSniper=true
  · curW=garand ffSpecSniper=false
  · 幽灵坦克 onVehicle=ghost ffAll=true muzzle=true
  A1 连狙→敌方 (阳性对照)  目标=贝克(队1)  目标中弹=是  全部中弹者: 贝克(队1) -75
  A2 连狙→友方  目标=布鲁尔(队0)  目标中弹=是  全部中弹者: 布鲁尔(队0) -75
  B1 步枪→敌方 (阳性对照)  目标=穆勒(队1)  目标中弹=是  全部中弹者: 穆勒(队1) -36
  B2 步枪→友方  目标=布鲁尔(队0)  目标中弹=否  全部中弹者: (无人中弹)
  C1 同轴机枪→友方  目标=厄本(队0)  目标中弹=是  全部中弹者: 厄本(队0) -40
  C2 同轴机枪→敌方 (阳性对照)  目标=沃尔夫(队1)  目标中弹=是  全部中弹者: 沃尔夫(队1) -40
  C3 主炮→友方 (14m)  目标=厄本(队0)  目标中弹=是  全部中弹者: 厄本(队0) -260 ☠, 贝克(队1) -31 ☠, 霍夫曼(队1) -260 ☠
  C4 主炮→敌方 (阳性对照, 14m)  目标=施密特(队1)  目标中弹=是  全部中弹者: 雷本(队0) -60, 布鲁尔(队0) -88, 施密特(队1) -55.5
  页面异常: 0 条
```
> 方法学自纠（两处假阴性，记录以免误判实现者）：
> ① 第一版对幽灵坦克用了 `playerFireOrigin()` 当弹道起点，而它实际从 `g.muzzle`/`g.coaxMuzzle()` 出膛 ⇒ **连阳性对照都是 0 伤害**；
> ② 第一版按 **bot 姓名**做 hp 键，而每阵营只有 14 个姓名、场上有 40+ 人 ⇒ 同名互相比较，凭空冒出"-260"幽灵伤害；
> ③ 同轴机枪有 `mgT` 0.08s 冷却（15c `if(this.mgT>0) return;`），同一同步块里第二枪被静默吞掉。
> 三处修掉后，8 格全部有可解释结果且阳性对照全中。

**判定：通过（附 1 条待确认）。**
- (а) **观战连狙→友方 −75** ⇒ 达成用户诉求（连狙可打双方），且阳性对照证明不是"没打中"。
- (б) **普通步枪→友方 0**（而步枪→敌方 −36 命中）⇒ **没有意外放宽其它武器**，与"其余武器保持现状"一致。
- (в) **幽灵坦克主炮/同轴机枪也能打友方**（−260 击杀 / −40）。★ **待确认项**：
  - 代码自称 `ffAll` 是"幽灵坦克驾驶态（观战专属载具，**2026-09-17 观战扩展批**），主炮/同轴机枪沿用，不动"，
    并在 `13-combat.js:13` 明确写"为什么不直接开 `player.ffAll`: 那会连带把幽灵坦克主炮、同轴机枪、巡飞弹一起变成无差别火力 —— 违反用户口径"
    ⇒ 实现者的意图是"**只新增连狙这一把，不碰幽灵坦克**"。
  - 但 git 上**无法验证其"既有"**：`js/15c-specveh.js` 在 `HEAD` **根本不存在**（`fatal: path 'js/15c-specveh.js' exists on disk, but not in 'HEAD'`），
    HEAD 的 index.html 也不引用它，`GhostTank`/`ffAll`/`specsniper` 在 HEAD 全仓为 0 处 ⇒ 幽灵坦克与连狙**同属这一大坨未提交改动**。
  - 结论：若用户认为 09-17 那批（幽灵坦克无差别火力）已是"现状"，则本批**完全符合口径**；若用户按字面理解"只有连狙能打双方"，
    则幽灵坦克是一条**与字面口径冲突**的既有行为。**这是一句话就能裁定的事，故不判不通过，只标待确认。**

---

## 第 4 条：第三人称切换

**用户口径**："增加切换第三人称的功能"。

**我核验的对象**：`js/20-player.js` 的 `thirdPersonOn`(L801)/`playerFireOrigin`(L809)/`playerAimDir`(L830)/`thirdPersonCamera`(L904)、
`js/19-input.js` 的 `toggleThirdPerson`(L50)+KeyU(L56)、`js/24-main.js` 的 `bindBtn('tView',...)`(L252)、`index.html:101` 的 `#tView`。

**我用的命令**（真浏览器；键盘事件走 19-input 真实监听；弹道起点是注释自称"最容易埋 bug 的地方"，重点实测）
```
node dev/_finalaudit-tp.js
```
**实测输出（原样）**
```
[①] 第一人称 (基准)
    thirdPersonOn=false  相机↔眼位距离=0m  弹道起点↔眼位=0m  弹道起点↔相机=0m
    #tView 存在=true display=flex
[②] 按 KeyU 之后
    thirdPersonOn=true  相机↔眼位距离=3.6m
    相机=[-62.79,0.96,17.04]  眼位=[-65.21,-0.31,19.38]
[③] 第三人称下的弹道起点 (必须仍是角色眼位)
    弹道起点↔眼位=0m  弹道起点↔相机=3.6m
    ⇒ PASS 弹道从眼位出发, 不是从相机 (没有"从相机打出去"的偏移)
[④] 再按一次 KeyU (切回第一人称)
    thirdPersonOn=false  相机↔眼位距离=0m
[⑥] 在载具里 (第三人称应与载具视角互斥)  {"tp":false,"onVehicle":"ghost"}  ⇒ PASS
[⑦] 触控键 #tView (移动端上下文, localStorage.sf_mobile=1 后重载)
    MOBILE=true  {"MOBILE":true,"tViewDisplay":"flex","before":false,"mid":true}  (等 700ms 后) {"tp":true,"camDistToEye":3.6,"fireOriginDistToEye":0}
    ⇒ PASS 触控键真的切换了第三人称 (相机退到 3.6m, 弹道仍在眼位)
```
**判定：通过。** KeyU 与触控键两条入口都实测可切换、可逆；第三人称下弹道仍从角色眼位出发（0m）；
与载具视角互斥（幽灵坦克内 `tp=false`）。触控键在桌面上下文不生效是**设计**（`24-main.js:146 if(!MOBILE) return;` 使整个触控绑定块早退），
我用 `localStorage.sf_mobile=1` 重载到移动端上下文后实测通过 —— 这条同时验证了 Lead 的 `#tView` 接线。
观感（跟随/穿墙/抖动）见人眼清单。

---

## 第 5 条：Bot 到处闪来闪去

**用户口径**：修复闪现，且**不许用"降速/减量/掩盖"换数字**。

**我核验的对象**：`js/14-bots.js` 的 `dismountVehicle`(L203-227, `exitSlide`)、`emplMount`(L238)、`pinEmpl`(L256)、
常量块(L26-40)；以及自述探针 `dev/probe-botflash.js` 的判据本身。

**先答"判据是不是只统计总数下降"：不是。** `probe-botflash.js` L83-94 的 `classify()` **先判重生**
（`!p.alive&&c.alive → '重生(alive F→T)'`，最高优先级），L167-170 再把重生事件从分母里剔除，
并要求"跳变前后 mesh 都可见且都 alive"才算玩家真能看到的闪现；L234-242 还有一组"回归健康度"指标
（存活数/累计行进/击杀死亡/前摇次数/上下车调用数）专门用来识别"靠禁用或拖延换安静"。判据合格。

**我自己另写的抽样**（不同 PRNG 实现 xorshift32 + 不同 seed + 不同战役 + **直接挂钩** `Bot.prototype.spawn/spawnInVehicle/enterVehicle/dismountVehicle`
在调用帧打标，而不是靠 alive 位推断；直方图在 1.0–3.0m 之间细分 0.5m 箱，专门抓"把瞬移挪到 3m 阈值以下"）
```
node dev/_finalaudit-flash.js 2  20260921 90 3     # 柏林
node dev/_finalaudit-flash.js 11 777001   90 3     # 塔拉瓦环礁
```
**实测输出（原样，节选）**
```
=== 终验独立复算 · Bot 单帧位移 · 战役#2 berlin (assault/1) map=640 bot=47 seed=20260921 推演=90s 阈值=3m ===
源文件指纹 14-bots=5c0fa17f 15-vehicles=30c84ca1 17-empl=e7d6545b
挂钩结果 {"spawn":true,"spawnInVehicle":true,"enterVehicle":true,"dismountVehicle":true}
  [ 1.0,  1.5)      10  0.0110%     [ 1.5,  2.0)       2     [ 2.0,  2.5)       5     [ 2.5,  3.0)       7
-- 单帧位移 > 3m 事件: 84 件 (其中重生帧 84 件) --
★★ 非重生帧的单帧位移 > 3m 事件数 = 0  (其中"前后都可见且都存活"的可见闪现 = 0 件)
-- 对抗性检查: 非重生 + 前后可见 + 前后存活 + 单帧位移 > 1.2m (合法上限 ≈0.9m) = 0 件 --
   存活=42/47 击杀/死亡=17/13 结束时在炮位=6 在载具=11

=== 终验独立复算 · Bot 单帧位移 · 战役#11 island (assault/1) map=640 bot=43 seed=777001 推演=90s 阈值=3m ===
-- 单帧位移 > 3m 事件: 77 件 (其中重生帧 77 件) --
★★ 非重生帧的单帧位移 > 3m 事件数 = 0  (其中"前后都可见且都存活"的可见闪现 = 0 件)
-- 对抗性检查: 非重生 + 前后可见 + 前后存活 + 单帧位移 > 1.2m = 3 件 --
  t= 26.15s 小林         d= 1.26m 步 上车=否 下车=否 前摇=F→F st=advance→advance
  t=   113s 佐藤         d= 1.22m 步 上车=否 下车=否 前摇=F→F st=defend→defend
```
**判定：通过。**
- 两次独立复算（不同战役/不同 seed/不同 PRNG/不同归因手法）**非重生 >3m 事件都是 0**，与自述"43→0"一致。
- 所有 >3m 事件（84/77 件）**全部**落在重生帧，且样本行都是 `可见=F→T 存活=F→T`（尸体已隐藏 → 新位置现身），
  与 `spawn()` L146-150 的"重生登场过渡"设计相符 ⇒ 属设计必需位移，不是玩家可见的"闪现"。
- 代码侧确认不是"把瞬移挪到别处"：旧 `dismountVehicle` 的 `this.pos.set(px,0,pz)`（3.2~5.7m 硬位移）被换成
  `exitSlide` + `EXIT_SPD=3.6m/s` 逐帧跨出（≤0.18m/帧）；旧"前摇结束硬 set 到炮位"被换成
  `emplMount` 先**走过去**（`EMPL_STAND_R=1.8` 内才起前摇，`EMPL_APPROACH_R=18` 内 `setPathTo`）+
  `pinEmpl` 阻尼限速落位（`EMPL_SNAP_SPD=4.0`，`EMPL_SNAP_GUARD=5.5` 安全阀：离太远直接放炮，**绝不硬 set 过去**）。
  上车那一次 `pos.copy(v.pos)`（≤`VEH_BOARD_R=2.7`）发生在**同帧 `mesh.root.visible=false`**，属隐藏帧结清。
- 残留（如实记录）：非重生帧仍有 3 件 ≈1.22–1.26m 的单帧位移（90s/43 bot，`advance`/`defend` 状态、不在上下车/前摇链上），
  略高于步行理论上限（5.7m/s × AI LOD 补帧 0.15s ≈ 0.86m）。量级远低于 3m 阈值，**不构成"闪来闪去"**，
  但它是"未归因"的一类，建议后续用同一探针追一次（最小复现即上面第二条命令）。
- 未发现"降速/减量"换数字：健康度显示 90s 内仍产生 84/77 次重生、击杀 17/13、结束时 6 人在炮位、11 人在载具。

---

## 第 6 条：部分地图主页没有隐藏 UI

**用户口径**：修复"主页没隐藏 UI"（附截图）。

**我核验的对象**：`dev/issue6-根因定位.md` 的结论、`css/style.css` L56/L64（`body.inMenu` / `body.inDeploy` 规则）与 L257（`.screen` 背景）、
`js/22-hud.js` 的 `setDeployHudHidden/syncDeployHud`。

**我用的命令**（真浏览器；判据用**渲染事实** `getClientRects()` 面积 + `elementFromPoint`，不是 display 字符串；
并**在运行时摘掉 `body.inDeploy` 类**（不动任何文件）复现"修复前"）
```
node dev/_finalaudit-deploy.js
```
**实测输出（原样）**
```
[①] 首屏主菜单: body="inMenu" #ui=none rects=0 #menu=flex   渲染中的 HUD 模块: (无)
[②] 部署界面 —— 修复后: body="inDeploy" #ui=none rects=0 uiRect=null
    #deploy=flex z=20 bg=radial-gradient(at 50% 30%, rgba(40, 48, 34, 0.94), rgba(8, 10, 6, 0.97)) | color=rgba(0, 0, 0, 0)
    渲染中的 HUD 模块: (无)
    ⇒ 判定: PASS 修复生效 (body.inDeploy + #ui 不渲染 + 无模块渲染)
[③] 战斗期 (对照): body="" #ui=block 渲染模块 (5): ammoPanel@[1311,701,203,85], healthPanel@..., minimapWrap@[18,18,190,190], topBar@..., fps@...  ⇒ PASS
[④] 返回主界面 (对照): body="inMenu" #ui=none rects=0 渲染模块=0  ⇒ PASS
[⑥] 同一帧内摘掉 body.inDeploy —— 复现"修复前"
    body="" #ui=block rects=1 uiRect=[0,0,1540,810]
    渲染中的 HUD 模块 (5): ammoPanel@[1311,701,203,85], healthPanel@[26,737,230,49], minimapWrap@[18,18,190,190], topBar@[429,14,682,114], fps@[1500,791,32,15]
    elementFromPoint(小地图中心) = deploy
    #deploy 背景 = radial-gradient(at 50% 30%, rgba(40, 48, 34, 0.94), rgba(8, 10, 6, 0.97))
    ⇒ 判定: REPRODUCED 修复前 #ui 确实在渲染且被半透明遮罩盖住 (与 issue6 报告一致)
  页面异常: 0 条
```
**判定：通过。**
- **明确回答审计问题：修复前的现象确实如报告所称** —— 部署遮罩 `.screen` 的底色是
  `radial-gradient(... rgba(40,48,34,.94), rgba(8,10,6,.97))`，即 **94%~97% 不透明**；
  摘掉 `inDeploy` 后 `#ui` 立刻恢复渲染（`uiRect=[0,0,1540,810]`）且 5 个模块有真实矩形，
  `elementFromPoint(小地图中心)` 返回 **`deploy`** ⇒ HUD 在遮罩**底下**、靠半透明透出。截图证据 `dev/out/_finalaudit-deploy-prefix.png`
  肉眼可见：小地图、顶栏、左下"100"血条、右下"M1 加兰德 / 8 / 手雷 ×4" 从遮罩下透出 —— 与用户截图描述的四类元素一致。
- 修复由 `body.inDeploy` 单类承载（挂回即恢复隐藏），与 `inMenu` 同构、语义分离，**没有**采用"把背景调成不透明"的糊法。
- 判据**不是祖先盲**：`getClientRects()` 在祖先 `display:none` 时返回空，能反映真实渲染；
  `probe-deploy-hud.js` 还把"祖先盲计数（仅自身 display!=none）"单独列为对照（本次 21），不当判据。
- 补充：套件内 `verify-specthird.js --browser` 的真机四状态同样显示"部署期真渲染 HUD 模块 0 个（修复前 5 个）"，与我的结论互相印证。

---

## 第 7 条：塔拉瓦植被 + 灌木/树冠挡视野但不挡子弹

**用户口径**：**"灌木/树冠挡视野，但只在命中遮挡时生效、且不挡子弹"**（玩家与 Bot 同规则）。

**我核验的对象**：`js/04b-fire.js` 的 `foliageBlocksLOS`(L251)+`FOLIAGE_LOS`(L208)、`js/00-config.js` 的 `FLORA_CFG`(L896)+
`FLORA_DENSITY_DEF`(L892)、`js/14-bots.js:423`、`js/15-vehicles.js:668`。

**引用点独立核对**（静态，全仓检索）
```
grep foliageBlocksLOS  →  全部命中:
  js/04b-fire.js:194 (注释) / :251 (定义) / :272 内
  js/14-bots.js:423     ← 所属函数 perceive()      (L398 起, AI 索敌视线)
  js/15-vehicles.js:668 ← 所属函数 tankPerceive()  (L632 起, 车组索敌视线)
```
⇒ **恰好 2 个调用点，都在 AI 视线函数体内**；`13-combat.js` 的弹道/命中链（`raySoldiers`/`fireBullet`/`vehHitCyl`）、
`raycastWorld` 一律不引用 ⇒ 报告"引用不在弹道/命中函数体内"**属实**。

**我用的命令**（同一几何下同时验三件事：LOS 判定 / **真实 `Bot.prototype.perceive()`** / **真实 `fireBullet` 命中**；含全局关植被对照）
```
node dev/_finalaudit-foliage.js 11 6
```
**实测输出（原样，节选）**
```
可作样本的灌木 (kind=bush, 未烧毁, s≥1.15): 960 株
  [样本1] 灌木(-127.7,152.5) s=1.2 高度带[3.52,4.66] 眼距6.43m
      ① 视线被挡 foliageBlocksLOS=true   (烟幕=null 庄稼=null)
      ② 真实 perceive(): 隔灌木看见=false  ⇒ ✓ 被挡住
      ③ 同一对眼位开枪: 掉血=40  ⇒ ✓ 子弹穿过命中
      ④ 对照A 仅标本株 dead: 仍被挡=true 看见=false (线上还有别的植株时属正常)
      ⑤ 对照B 全局关植被: los=false 看见=true  ⇒ ✓ perceive 本身正常, 挡视野确由植被承载
      ⇒ PASS
  ... (样本2-6 同构, 其中 4 个样本 ④ 也是"仅标本株 dead → 立刻看见")
===== 小结: 6/6 个样本通过 =====
FLORA_LOS_STAT={"built":1,"cells":5799,"refs":10469,"ms":2,"calls":141,"tested":418,"blocked":20}
```
**判定：通过。**
- **6/6 样本**同时满足：视线被挡 ∧ 真实 AI `perceive()` 看不见 ∧ 同一对眼位开枪**命中掉血 40** ⇒ "挡视野、不挡子弹"成立。
- 对照 B（`FLORA_HASH_N=0` 全局关植被）后 `los=false` 且立刻看见 ⇒ 挡视野确实由植被承载，`perceive()` 本身没坏。
- 高度带与建模尺寸同源（`FOLIAGE_LOS` 由 05b 建模尺寸反推：灌木 `g0+0.15s~1.10s`、乔木冠 `g0+1.00s~5.40s`、椰冠 `[y1-1.8,y1+0.3]`），
  树干本身不进遮蔽表（仍由既有 CYLS 硬碰撞管）⇒ "树后看不见但子弹照穿"正是用户要的语义。
- 塔拉瓦密度（客观部分）：`THEME.pacific.floraDensity` 覆盖单源 `FLORA_CFG` —— `bushN 340`（缺省 150）、
  `grassN [1000,2400,4200]`（缺省 [480,1050,1850]）、`groveBushArea 30`、`inlandClumpN 18`、`beachClumpN 9`；
  我的探针在 island 上取到 **960 株 s≥1.15 的灌木**作为可采样基数。
  缺省值等于改造前的写死魔数（`git show HEAD:js/04b-fire.js` 里确有 `const n=Math.round(150*THEME.grassMul*q)`，HEAD 无 `FLORA_CFG`）
  ⇒ 其余地图不吃新密度，与注释一致。**"够不够多"属观感，见人眼清单。**

---

## 核验 8：越界与重复实现（静态检查）

**我用的命令**
```
git diff --stat          # 38 files changed, 7626 insertions(+), 758 deletions(-)
node dev/_finalaudit-diffhygiene.js
```
**实测输出（原样，节选）**
```
-- ① 被注释掉的既有逻辑 (曾经生效 → 现在成注释) --
  (未发现: 没有"删掉的真代码以注释形态复活"的实例)
-- ② 新增调试残留 (console.log / TODO / FIXME / debugger) --
  [index.html] console.warn('[CSS] 样式表疑似缓存旧版, 已换 URL 重新载入: '+fresh.href);
  [js/05c-layouts.js] ... console.warn(...)   [js/22-hud.js] ... console.warn('[换局] ...')
  [js/24-main.js] console.warn('[HUD] 菜单期隐藏自检: #ui 节点数=...')
-- ③b 新增的命名常量块 (调参值放哪) --
  [js/00-config.js] SWIM_DEPTH/WADE_DEPTH/SWIM_SPD/... , OXY_MAX/OXY_DMG/... , UV_DENSITY
  [js/15-vehicles.js] TANK_VIEW_BASE=235 / TANK_VIEW_CONE=1.25 / TANK_REACT_MUL=1.6 / TANK_PER_T=0.14
  [js/17-emplacements.js] SPAWN_USE_CAP=2.5 / SPAWN_PT_W=70 / SPAWN_PT_CAP=2.5 / LANE_CROWD_W=34
-- ④ 同一文件内出现 ≥2 次的长语句 (疑似两套代码) --
  [js/14-bots.js] ×3 行 197,312,1074 : if(this.mgUse){ releaseEmpl(this.mgUse,true); this.mgUse=null; }
  (其余为 05c-layouts/05a-buildings/03-terrain 的逐地图布局同构段 —— 既有风格, 非本批引入)
```
**判定：基本干净，附 3 条小项。**
- ① **未发现**"被注释掉的既有逻辑"（方法：把 diff 里被删的真代码行规范化后，在当前文件中检索其"注释形态复活"）。
- ② 4 条 `console.warn` 全是诊断/自检（CSS 缓存、地形重刷、换局清理、菜单期 HUD 自检），**不是调试残留**；无 TODO/FIXME/debugger。
- ③ 新增调参值绝大多数是**命名常量**；`TANK_*` 放在 `js/15-vehicles.js`、`SPAWN_*` 放在 `js/17-emplacements.js`，
  未进 `00-config.js` 集中单源。**可接受**（单处定义、有注释、只被本文件用），但偏离本仓库"调参值集中 00-config"的惯例 —— 记为 C2。
- ④ `releaseEmpl` 三连（`enterVehicle`/`die`/`update`）是**同一件事三处重复**，但 `git diff` 显示这三处**不是本批新增**（HEAD 已有），
  建议后续抽 `releaseAllEmpl()`（记为 C2）。
- **注释与代码不一致（轻微）**：`js/13-combat.js:16` 注释称 `coFfFire` 让"**步兵判定 / 载具判定 / 压制惊动**三处同源"，
  但全仓 `coFfFire` 只有 **2 个调用点**（:25 步兵、:87 载具）；"压制惊动"那处（:119）用的是 `if(shooter.spectator) break;`，
  语义是"观战一律不压制/不惊动"，与 `coFfFire` 不同。行为上合理（注释 :116-118 自己也解释了为什么对友军也不放宽），
  但"三处同源"的表述夸大 ⇒ 建议改注释（记为 C2）。

---

## 我无法通过自动化验证、需要人眼/人工确认的清单

1. **坦克/飞机剪影是否"一眼可辨"**：客观项（尺寸分档 >8%、5 车体档 + 5 炮塔档 + 3 涂装档、24 型网格数）已达标，
   但"能不能认出这是九七式、那是黑豹"必须人眼看。建议逐阵营把两辆坦克并排截图（侧视 + 3/4 视角）比对：
   炮塔形状（圆/方箱/六角/加长六角/小型圆）、首上倾角、负重轮数量与半径、侧裙板、涂装分档。
2. **第三人称观感**：镜头跟随是否顺滑、贴墙/贴地时是否穿模或抖动、开镜是否强制回第一人称（注释自称如此，我未实测 ADS 那一支）。
3. **塔拉瓦植被密度是否"够多"**：数值上 `bushN 150→340`、`grassN` 约 2.1~2.3×，且林下灌丛/内陆灌丛/沙丘背坡各有加密带；
   但"够不够"是观感，需在塔拉瓦环礁实际跑一局看滩头→内陆的绿量梯度。
4. **坦克"不能太超雄"的手感**：数字上三档差异显著（延迟 1.89×、散布 4.31×、火力距离 140/200/260），
   但"被精英一炮点名是否挫败"只能人玩。特别请确认 **精英档散布比改造前更准（0.011→0.0056）** 这一方向是否可接受。
5. **观战幽灵坦克的无差别火力（★ 唯一待裁定项）**：请用户一句话确认"幽灵坦克主炮/同轴机枪打友方"是否属于 09-17 的既有现状。
6. **"部分地图"逐图遍历**：修复机制与地图无关（`showDeploy()` 挂 `inDeploy`、`deployPlayer()` 摘），
   我实测的是默认战役；若要 100% 覆盖，建议对 12 张图各跑一次 `dev/probe-deploy-hud.js`（现成探针，改 URL 参数即可）。
7. **真实鼠标 + 真实移动端手感**：我的触控验证是用 `localStorage.sf_mobile=1` + 合成 `touchstart` 事件完成的，
   不是真机手指触控。

---

## 必须修 / 建议修的最小项清单

### A. 阻断交付的：无
7 条需求无一条判不通过。启动链、布局指纹、世界还原、植被、观战、坦克 AI、模型规格的回归全绿。

### B. 建议修（很小，但值得做）
- **B1（套件覆盖缺口）**：`dev/run-all-verify.js` 的 `BROWSER` 表加入
  `['dev/verify-specthird.js',['--browser'],'观战连狙+第三人称 真机四状态']`。
  现状：该脚本的真机 61 项**不在回归里**，靠人记得手敲 `--browser`（我补跑过：61/0, exit 0）。
- **B2（注释漂移）**：`js/13-combat.js:16` 的"三处同源"与事实（`coFfFire` 2 个调用点）不符 ⇒ 改注释为"步兵判定 / 载具判定两处同源；
  压制惊动另按'观战不惊动'口径处理"。
- **B3（可选清理）**：`js/14-bots.js` 的 `releaseEmpl` 三连（197-199 / 312-314 / 1074-1076）抽成 `releaseAllEmpl()`。
  非本批引入，纯卫生问题。

### C. 待用户裁定（不是 bug，但需要一句话）
- **C1（幽灵坦克口径）**：见第 3 条 (в)。要么确认"09-17 既有现状"，要么按字面口径把幽灵坦克的
  `ffAll` 从 `coFfFire` 里摘出（**注意**：那会让幽灵坦克主炮/同轴机枪打不动友方，属行为变更，需用户明确要求）。
- **C2（精英档散布方向）**：见第 1 条方向性观察。若用户认为"削弱"应覆盖精英档，调 `TANK_AI[2].spreadK` 或 `DIFF_TABLE[2].spreadMul` 即可（单源）。
- **C3（非本批遗留：命中圆柱盖不住车体首尾）**：`vehHitCyl` 半径 2.3m 而 12 型车体半长 2.877–3.60m，
  车体最前/最后 0.577–1.30m 不在命中体内（HEAD 已如此，`r=2.3` 与 `hullL` 均未改）。
  若用户觉得"打坦克首尾不掉血"是问题，最小修法是把命中体从圆柱改成沿车体轴的分段胶囊/矩形（可复用 `vehiclePushTanks` 的
  `TANK_PUSH_R=1.45 / TANK_PUSH_OFF=1.85` 三圆近似），或把 r 提到 ≥3.6。**不建议**在本批临时改，会牵动 `SHELL_R`/`raySoldiers(pad)` 等既有口径。

---

## 附：本次审计用到的全部命令（可复现）

```powershell
node dev/run-all-verify.js --browser                  # 20/20 exit=0 全部通过
node dev/verify-specthird.js --browser                # 61/0 (套件未覆盖的真机分支)
node dev/_finalaudit-flash.js 2  20260921 90 3        # 非重生 >3m = 0 (柏林)
node dev/_finalaudit-flash.js 11 777001   90 3        # 非重生 >3m = 0 (塔拉瓦)
node dev/_finalaudit-tankai.js                        # 延迟 2.50/1.32s=1.89×; 散布 4.31×
node dev/_finalaudit-ff.js                            # 连狙→友方 -75; 步枪→友方 0; 幽灵坦克→友方 -260
node dev/_finalaudit-deploy.js                        # 修复后 0 模块; 摘 inDeploy 复现 5 模块
node dev/_finalaudit-foliage.js 11 6                  # 6/6 挡视野 ∧ 子弹穿过
node dev/_finalaudit-vehsize.js                       # 半宽 1.781-2.054 (<2.3); 半长 2.877-3.6 (>2.3)
node dev/_finalaudit-tp.js                            # KeyU/触控键切换; 弹道仍在眼位
node dev/_finalaudit-diffhygiene.js                   # 无注释掉的既有逻辑; 无调试残留
```
> 全部审计脚本只读仓库；`_finalaudit-*.js` 为本次新建。**未修改 `js/`、`css/`、`index.html` 任何一行**
> （可核：`git status` 中 `js/`、`css/`、`index.html` 的改动均为本批实现者原有改动，无我新增的条目）。
> 审计过程中的 `.txt` 捕获文件已移出仓库到 `%TEMP%\sf-finalaudit\`，以免污染 `verify-text.js` 的编码检查。
