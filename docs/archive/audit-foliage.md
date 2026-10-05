# I5 植被批独立审计报告 (task-7 · V2)

审计者: `foliage`（实现者/验证者分离关卡；本报告**不写任何 `js/` 文件**）
审计时间: 2026-09-20 17:40~18:05
被审计 revision（SHA1 前 12 位，审计期间未变；05c 在 17:18 后被改过一次，本报告所有实测均在该版本上完成）:

| 文件 | SHA1 | 大小 | mtime |
|---|---|---|---|
| `js/00-config.js` | `3B08810AC4F8` | 93859 | 09-20 17:10:17 |
| `js/04b-fire.js` | `166D2F42A780` | 39545 | 09-20 16:59:13 |
| `js/05b-props.js` | `DC091025B618` | 33798 | 09-20 13:30:15 |
| `js/05c-layouts.js` | `88BDA1686FD7` | 127141 | 09-20 17:18:22 |
| `js/14-bots.js` | `6005B5156FBD` | 92041 | 09-20 17:07:48 |
| `js/15-vehicles.js`（跨任务接线，见 §1/§7） | `76FA59F81062` | 70006 | 09-20 17:41:50 |
| `dev/verify-foliage.js` | `0519A9CD743A` | 30890 | 09-20 17:24:05 |

**独立性声明**: 审计**没有**复用实现者的探针 `dev/verify-foliage.js` 的任何代码。对照脚本
`dev/_audit-foliage-ref.js` 自带 ① 独立 boot（CORE 链 `00-config..05c`，不载 14/15/16，不受其它任务改动影响）
② 独立参考实现（归一化方向 + 圆心投影/垂距/半弦长，与生产代码的二次判别式不同源）
③ 第二重抽样参考实现（沿视线每 0.05 m 采样，零共享数学）④ 审计侧"最小修法"复现（只存在于审计脚本内）。

> 结论速览: **通过 5/6，不通过 1/6**。唯一必须修的**代码缺陷**是 `js/04b-fire.js` 格步进循环的**端点格漏判**（3 行改动，修法已被本审计独立验证充分）。
>
> ⚠ **另有一条跨任务告警（非 I5 缺陷，但会让 I5 验收探针变红）**: `js/15-vehicles.js:668`（`Tank.tankPerceive` 感知层，tank-ai 于 17:41 接入）也调用了 `foliageBlocksLOS`。它**不在任何弹道/命中函数体内**（本审计用"引用所在函数"逐一判定），语义上不违反"不挡子弹"；但 `dev/verify-foliage.js` 的 ⑥ 用的是**文件名**启发式（`15-vehicles.js` 里住着 `vehHitCyl`），于是现在报 `✘ 遮蔽函数被接进了弹道/命中链: 15-vehicles.js`、退出码 1。**需要 Lead 裁决口径**（详见 §1 与 §7-0）。

---

## 1. 不挡子弹（用户口径硬约束） —— 判定: **通过**

**结论**: 找不到任何路径让 `foliageBlocksLOS` 影响 `raySoldiers` / `raycastWorld` / `fireBullet` / `vehHitCyl` 的命中结果。三重论证：

1. **引用面论证**: 全仓库 `foliageBlocksLOS` 只出现 3 处（本审计按"引用所在函数"逐一判定，不只看文件名）：
   ```
   04b-fire.js:251  [foliageBlocksLOS]      ← 定义
   14-bots.js:423   [perceive]              ← 步兵 Bot 感知
   15-vehicles.js:668 [tankPerceive]        ← 车组 Bot 感知 (tank-ai 于 17:41 接入, 见 §7-0)
   弹道/命中函数体内的引用: 0
   ```
   四个弹道入口的**全部**调用点里没有任何一处引用遮蔽层：
   - `raySoldiers` 定义 `13-combat.js:19`；调用 `13-combat.js:69`、`13-combat.js:426`、`15-vehicles.js:1192`、`18-game.js:106`、`20-player.js:819`
   - `fireBullet` 定义 `13-combat.js:48`；调用 `13-combat.js:141`、`14-bots.js:542`、`14-bots.js:1781`、`15-vehicles.js:988`、`15-vehicles.js:1025`、`15c-specveh.js:194`、`16-aircraft.js:244`、`20-player.js:628`
   - `vehHitCyl` 定义 `15-vehicles.js:20`；调用 `13-combat.js:61`、`13-combat.js:417`、`15-vehicles.js:1184`、`16-aircraft.js:252`、`20a-seats.js:27`、`20-player.js:821`
   - `raycastWorld` 定义 `04-collision.js:27`；**33 处调用点**（7 个文件），无一处经过植被遮蔽层
2. **状态论证**: 遮蔽函数只**读** `FLORA_HASH`，只**写**记录上的 `rec._fl`（蓬面带缓存）/`rec._ls`（本次查询去重戳）与自己的索引/统计全局；不触碰 `BOXES`/`CYLS`/`PROPS`/`FUEL`/`FLORA_HASH` 结构。运行期实证（5000 次调用前后）：
   ```
   PROPS 2490→2490  CYLS 506→506  BOXES 5805→5805  FLORA_HASH 2017→2017
   ✔ 遮蔽查询不增删任何碰撞体/植被表条目 (只读 + rec._fl/_ls 缓存)
   ```
3. **行为论证**: 灌木记录**不带任何碰撞体**（`BUSH_LIVE.filter(r=>r.cyl||r.box).length === 0`），因此不可能进 `CYLS`/`BOXES`；对同一株合成灌木（s=1.50），硬射线穿过而软遮蔽生效：
   ```
   灌木记录带 cyl/box 的株数=0
   合成灌木 s=1.50 @(-150,-150)  硬射线 12m: 无命中
   ✔ raycastWorld 穿过灌木不命中 (子弹可穿)
   同一视线 foliageBlocksLOS=true (应为 true: 软遮蔽照常生效)
   ✔ 同一株: 挡视线 / 不挡弹
   ```
   树/椰树干的既有 `CYLS` 未被本批改动（`tree()`/`palm()` 未改；`05b-props.js` 在本批中**零改动**）。

**验收探针 ⑥ 现在是红的（跨任务，非本批代码缺陷）**: `dev/verify-foliage.js` 的 ⑥ 按**文件名**判定弹道链（`ballistic=['13-combat.js','04-collision.js','15-vehicles.js','11-soldiers.js','12-ragdolls.js','09-weapons.js']`），而 `15-vehicles.js:668` 的引用落在 `Tank.tankPerceive`（感知层，与 `smokeBlocksLOS`/`cropBlocksLOS` 并列）里 —— 该文件同时住着 `vehHitCyl`，于是被文件名启发式误判。当前实测：

```
$ node dev/verify-foliage.js
⑥ 不挡子弹 ...
   foliageBlocksLOS 引用: {"04b-fire.js":1,"14-bots.js":1,"15-vehicles.js":2}
  ✘ 遮蔽函数被接进了弹道/命中链: 15-vehicles.js (违反"不挡子弹")
✘ 1 项未通过        (exit 1)
```

→ **语义判定: 不违反用户约束**（子弹照穿灌木，坦克只是"看不穿"；且该分支只在 AI 车组 `this.crewBot&&!this.playerDriven` 时执行，玩家驾驶的坦克不受影响）。但 I5 的验收门禁要变绿，需要 Lead 先定口径（见 §7-0）。

**命令**: `node dev/_audit-foliage-ref.js 11 20000`（看【F】节）+ `grep -rn "foliageBlocksLOS" js/`

---

## 2. 性能与粗筛 —— 判定: **通过**

**结论**: 有真粗筛，且是"索引 + 逐格"两级；最坏情况（400 m 视线）单次最大 71.4 µs，游戏口径（10~95 m）平均每查只精算 1.81 株。

**代码证据**:
- `buildFloraLosIndex()`（`04b-fire.js:226-247`）把每株按**蓬面圆覆盖的格**做膨胀登记（`r=sqrt(r2)` 求 i/j 范围），因此查询只需走视线真正经过的格，且不会漏掉"从邻格伸过来的冠层"。
- `foliageBlocksLOS()`（`251-296`）用 Amanatides-Woo 3 m 格步进，每格内先剔死株/倒伏株（`rec.dead||rec.alive===false||rec.fall`），再做线段-圆盘判别式与高度带相交判定，命中即 `return true`。
- 索引失效判据 `FLORA_HASH_N`（`98`/`104`/`253`）：世界重建或后补植株自动重建一次（沙箱里后补灌木也能被立刻查到）。

**实测（island，2156 条植被记录，索引 5770 格/10428 引用/单格最多 8 株，建索引 3 ms）**:
```
游戏口径 10~95m × 20000 次: 平均精算 1.81 株/次 (全图 2156 株)
400m 最密视线 (穿蓬面最多的一条): 1000 次: 单次最大=35.90µs  均值=7.64µs
4000 条 400m 随机视线: 单次最大=71.40µs  均值=6.44µs  最坏一条: (-292,156)→(-31,-147)
全图对角线 888m: 单次最大=56.90µs
步进上界: 图内任意视线 ≤ 2×(FN-1)+1 = 455 步; 守卫 FOLIAGE_LOS_MAXCELL=512 ⇒ 守卫覆盖全图 (不会截断)
成本上界: 步数 × 单格最多株数 = 455×8 ≈ 3640 次记录测试 (全图记录 2156)
```
- **格索引上界（Lead 指定问题）**: 直线穿格数 ≤ `|Δi|+|Δj|+1 ≤ 2×(FN−1)+1`；640 图 `FN=228` ⇒ **455 步**，守卫 `FOLIAGE_LOS_MAXCELL=512` 覆盖全图（888 m 对角线实测不截断）。单次成本上界 = 455 步 × 单格最多 8 株 ≈ **3640 次记录测试**（对比全量扫描 2156 株/次：最坏情况下索引甚至不占优，但那是"整条视线把所有格都穿一遍"的理论极值，游戏内视距 ≤95 m 时实测 1.81 株/次）。
- 一次性成本: 首次查询触发建索引 **3 ms**（游戏内第一帧感知时；非每帧）。

**命令**: `node dev/_audit-foliage-ref.js 11 20000`（看【D】节）

---

## 3. 滩头纪律（坐标实测） —— 判定: **通过**

**判据**: `shoreDist(x,z)`（环礁有符号岸距：陆上为负，绝对值 = 入陆距离 u；`-22` 即沙丘脊线 `ridge.u1`）。按 `shoreDist` 分带对**全部**植被记录普查：

```
bush (1752): >-6(湿沙/迎海面)=0  -6~-16(干沙滩/迎海面)=0  -16~-22(脊线区)=0  -22~-34(背坡)=255  <-34(内陆)=1497
             最靠岸 shoreDist=-22.22 @(-147.7,84.7)
fern (75):   >-6=0  -6~-16=0  -16~-22=0  -22~-34=12  <-34=63   最靠岸 -24.22 @(-21.0,149.4)
palm (265):  >-6=0  -6~-16=0  -16~-22=15  -22~-34=43  <-34=207  最靠岸 -16.40 @(145.4,-40.2)
tree (62):   >-6=0  -6~-16=0  -16~-22=5   -22~-34=11  <-34=46   最靠岸 -17.10 @(-169.6,-117.7)
跑道矩形内植被=0 (应为 0)
✔ shoreDist>-16 区间灌木=0 (滩头火力场保留)
```
- task-7 点名的 `shoreDist > -16 ~ -6` 区间: **灌木 0 株**（更严格的 `> -22` 也是 0）。最近的灌木在 `-22.22 @(-147.7,84.7)`，即刚好落在脊线以北 0.22 m —— 符合 `FLORA_CFG.shoreGuard=22` 的口径。
- 椰树/野树最靠岸 `-16.4 / -17.1`：这是 K 段椰林**改造前既有**的 `u≥16` 口径（`palmGrove` 的 `shoreDist>-16` 守卫），本批未改；且椰冠带在 `cyl.y1-1.8 ~ +0.3`（离地 5.8~12 m），地面平视不受其遮挡（见【A】的 `palmDrop/palmRise` 语义），不影响"滩头开阔火力场"。
- 旗点圈内植被 1 处: `palm@机场(-53,-82)` —— 既有椰林，非本批新增灌木（K2 段 `vegOK` 对新增灌木要求 `>f.r+2` 留白）。

**命令**: `node dev/_audit-foliage-ref.js 11 20000`（看【E】节）

---

## 4. 玩家与 Bot 同规则 —— 判定: **通过（判定为"非缺陷"；是否动小地图需 Lead 裁决）**

**结论**: 玩家侧**不存在**"能否看见敌人"的 LOS 判定，因此没有"未同步"的不一致缺陷。

**证据（如何确认）**:
- 全仓库检索"敌人/可见性"相关逻辑，玩家侧只有两处绘制分支：`js/22-hud.js:275-282`（小地图）与 `js/22-hud.js:480-486`（大地图），两处都写着同一行注释：
  `// 全部敌人实时显示 (2026-09-06 用户指定: 原仅开火后 2.5s 显形)` —— 这是**用户明确指定**的全局显示，不是 LOS 判定。
- 仓库自身的口径写在 `js/13-combat.js:160`: `// 弹速引 SHELL_SPD ... LOS 检查只 Bot 需要, 留在 Bot 调用方`。
- 玩家"看不看得见"由**渲染几何本身**承担：灌木/树冠是真实网格（`BUSH_IM` / `TREE_IM.leaves`），玩家的视野天然被挡 —— 这正是"玩家与 Bot 同一支代码/同一规则"的落地方式：同一批植被，对玩家是画面遮挡，对 Bot 是 `foliageBlocksLOS` 查询。

**若 Lead 认为小地图也必须吃植被遮蔽**（属新需求，会与 2026-09-06 用户口径冲突，建议先问用户）—— 最小修法（**本审计未落盘**）: 在 `js/22-hud.js:279` 与 `js/22-hud.js:484` 的 `else` 敌人分支各加一道 `&&!foliageBlocksLOS(playerEyeX,playerEyeY,playerEyeZ,s.pos.x,s.pos.y+1.4,s.pos.z)`；注意小地图是 10 Hz 低频刷新，40 个敌人 × 1 次查询的开销可忽略，但需新开 `playerEye` 取位（`player.pos.y+1.62`）。

---

## 5. 边界与鲁棒性 —— 判定: **不通过（1 项真缺陷）**

### 5a. 端点格漏判（**必须修**）

**位置**: `js/04b-fire.js:267-294`（`foliageBlocksLOS` 的格步进循环），缺陷在 `291-293` 的顺序：

```js
291: if(i===iE&&j===jE) break;
292: if(tI<tJ){ i+=sI; tI+=dI; } else { j+=sJ; tJ+=dJ; }
293: if(Math.min(tI,tJ)>1) break;   // ← 步进后直接退出: 刚进入的这一格从未被扫描
```

**机制**: 循环先扫当前格、再判断是否到终点格、再步进。当线段在"刚步进进入的那一格"里结束时，`tI/tJ`（离开该格的下一次边界穿越参数）必然 `>1`，于是 `293` 直接 `break`，**该格（= 视线终点格）从未被 `idx.get()` 取用**。起点格因为第一轮就扫，所以不受影响 ⇒ **方向不对称**。

**影响量化（island，独立参考实现对照）**:
```
200 对随机点: 漏判=1 误报=0
20000 对随机点: 参考判挡=3780 生产判挡=3743 漏判=37 误报=0 (0.185%)
灌木 1752 株, 场景="敌人站在灌木里"(B=株心, 观察者 30m 外): 参考判挡但生产漏判 164 株 (9.4%)
反向场景="观察者站在灌木里"(A=株心): 参考判挡但生产漏判 19 株 (1.1%)
```
- 失配样本的拦路株全部落在 `t≈1.00~1.03`（视线终点附近），例如
  `A=(-237,52) B=(-161,139) 生产=false 参考=true 拦路: bush@t=1.001`。
- 方向不对称（正向 9.4% vs 反向 1.1%）**证明这是漏检而不是设计口径**：同一株灌木，从东边看能挡、从西边看不挡。
- **不是环礁特有**: normandy（0 号战役）同样复现 —— `8/121 株 (6.6%)`、`7/3000 对 (0.233%)` ⇒ 全 13 张图共病。
- 实现者的验收探针 `dev/verify-foliage.js:285-297`（②b，循环在 `288`）用 **400 对**随机点做"索引 vs 暴力参考"交叉校验，恰好没抽中（本审计 200 对就命中 1 对）⇒ 建议把该交叉校验样本量提到 ≥20000 对。

**最小修法（本审计在 `dev/_audit-foliage-ref.js` 内复现并验证充分，未落盘）**: 把 `293` 的"立即 break"改成"标记 + 下一轮先扫完新格再退"：

```js
let stop=false;
for(let guard=0;guard<FOLIAGE_LOS_MAXCELL;guard++){
  ... 扫格 (原样) ...
  if(i===iE&&j===jE) break;
  if(stop) break;                       // ← 新增: 上一轮已判定"新格是最后一格", 本轮已扫过它
  if(tI<tJ){ i+=sI; tI+=dI; } else { j+=sJ; tJ+=dJ; }
  if(Math.min(tI,tJ)>1) stop=true;      // ← 改: 只标记, 不 break
}
```
**修法验证（审计侧实测）**:
```
审计侧最小修法 (losFixed, 仅改 break 时机): 与独立参考不一致 0 株; 修法救回的漏判 164 株
✔ 最小修法充分: 1752 株端点场景与独立参考完全一致 (修回 164 株漏判)
最小修法在 4000 对随机点上与参考不一致 0 对
```

**复现命令**: `node dev/_audit-foliage-ref.js 11 20000`（看【B】【C】节）
**判定**: 不通过。修完请把 `dev/verify-foliage.js` 的 ②b 抽样提到 20000 对再复跑一次。

### 5b. 实例数/容量/面数 —— 通过

```
构建期不变量: BUSH_IM.count=3504  BUSH_LIVE=1752 (每株 2 实例)   ✔ 按需分配, 无固定上限
草丛: 分配=3240 落位=2776 落位率=85.7%
scene 可绘制: Mesh=6636 InstancedMesh=5
按类: palm=265 bush=1752 fern=75 tree=62 dead=2
解析三角面 (审计侧独立估算): 灌木 7008 蕨丛 600 野树 2108 椰树 83740 草丛 5552 → 合计 99048
```
- `BUSH_IM` 容量 = `BUSH_BATCH.length*2`（`flushBushes()` 按需 `new InstancedMesh`），不存在"容量假设"被触及的问题；草丛 `InstancedMesh` 分配 = `grassCount`，写入循环恰好 `grassCount` 次（`05c-layouts.js:2229`），无越界。
- 面数审计侧独立估算 ≈ **99 048**，与实现者探针的 99 006 一致（差异来自椰树每株叶/椰个数的取整）。新增植被**不新增 draw call 类别**：灌木/树/草丛各自 1 个实例批；新增成本是 75 丛蕨 × 4 片独立 Mesh = **+300 Mesh 节点**（既有 `fernClump()` 实现，非本批新写）。
- 占位表 `PROPS` 由 713（`dev/baseline-20260918_layouts.txt`）涨到 **2405**：其中 ≈1629 来自新增灌木 + 75 来自蕨丛。`PROPS` 只在布局期被 `propFree` 线性查重，运行期碰撞走 `BOXES/CYLS`，无运行期代价。

### 5c. 烧毁后遮蔽消失 —— 通过

```
烧毁复核: 挡视线灌木 @(-110.7,93.0) → vanishFlora 后 dead=true between=false
✔ 烧毁后遮蔽消失 (dead 早退生效)
```
（`foliageBlocksLOS` 每格先剔 `rec.dead||rec.alive===false||rec.fall`，索引无需重建。）

### 5d. 统计口自洽 —— 通过

`FLORA_LOS_STAT` 的 `calls/tested/blocked/cells/refs/ms` 均为单调计数且与独立测量一致；游戏口径平均精算 1.81 株/次（远低于实现者探针的 ≤60 门槛）。

---

## 6. 与既有机制的回归 —— 判定: **通过**

| 命令 | 退出码 | 关键输出 |
|---|---|---|
| `node dev/verify-fire.js`（默认 0,5） | **0** | 全部通过 ✔（火焰蔓延/树倒伏/炸没灌木/坦克碾树/火源退场） |
| `node dev/verify-fire.js 11` | **0** | 全部通过 ✔ island: 燃料格=3977 燃料总量=2793.7 活树=59 灌木=1742；点燃 1 格 → 峰值 34 格 / 烧尽 73.0s |
| `node dev/verify-layouts.js` | **0** | `ALL LAYOUT CHECKS PASSED`；island: boxes=5438 cyls=480 props=2405 trees=59 ammo=9 PASS |
| `node dev/verify-sink.js` | **0** | `沉入系统推演全部通过 ✔`；island: 灌木 炸没→停留→沉入→实例删除 ✓ |

**与 `dev/baseline-20260918_layouts.txt` 的对照（注意基线是 09-18 旧地图版，不能全部归因 I5）**: island `props 713→2405`（≈ 新增灌木 1629 + 蕨丛 75，可归因 I5）；`trees 83→59`（09-19 四面环海改版 + K2 段随机流/propFree 占位变化共同作用；实现者已把 `THEME.pacific.treeN` 230→560 补偿，`00-config.js:864`）；`boxes 4361→5438 / cyls 496→480` 属其它批次地图改版 —— **I5 不新增任何 BOXES/CYLS**（见【1】）。

**其余 13 张图的零变化核对**（Lead 指定）: 用 0 号战役（normandy）实跑，`FLORA_CFG` 恰为缺省表
`{"bushN":150,"shoreGuard":15,"grassN":[480,1050,1850],"grassTries":1,"groveBushArea":0,...}` ⇒ 林下段 0 次迭代、
`scatterBushes` 退化为旧的 `150*grassMul*q`、草丛 `grassTries=1`（随机数消耗与旧版逐次一致），无异常、无崩溃。
`00-config.js` 的 `FLORA_CFG` 段（`870-896`）无重复/缺失，`floraDensity` 仅 pacific 一份，与 `FACTIONS.tk` 段（`897+`）不重叠。

---

## 7. 跨任务接线告警（不在 task-7 的 6 条必查项内，但影响 I5 验收门禁）

### 7-0. `js/15-vehicles.js:668` 调用 `foliageBlocksLOS`（tank-ai / task-1 的改动，17:41 落盘）

```js
// 15-vehicles.js:663-668 (Tank.tankPerceive, 与 smokeBlocksLOS/cropBlocksLOS 并列)
// 植被软遮蔽 (2026-09-20 I5 联动, 用户口径: 灌木/树冠挡视野但不挡子弹): 车长视线与步兵 perceive 同一套口径,
// 坦克同样看不穿灌丛 —— 纲领第2条"玩家与 Bot、各兵种同规则". 车长镜/潜望镜**不豁免** (Lead 2026-09-20 裁定: ...)
if(typeof foliageBlocksLOS==='function'&&foliageBlocksLOS(ex,ey,ez,t.pos.x,ty,t.pos.z)) continue;
```

**审计判定**:
- **不是弹道改动**: 引用落在 `Tank.tankPerceive`（感知层，`15-vehicles.js:632` 起），`turretAI`/`fireBullet`/`vehHitCyl`/`rayCyl` 函数体内零引用（本审计用"引用所在函数"逐一判定，不是文件名猜测）。
- **不违反用户约束**: 子弹照穿灌木；坦克只是"看不穿"。且调用点上游是 `if(this.crewBot&&this.crewBot.alive&&!this.playerDriven)`（`15-vehicles.js:459`），**玩家驾驶的坦克不受影响**。
- **`typeof` 守卫**保证只加载子集的沙箱探针不会因缺模块整段报错（与仓库既有纪律一致）。
- **但它让 `dev/verify-foliage.js` 的 ⑥ 变红**（文件名启发式把 `15-vehicles.js` 整文件当弹道链），I5 验收因此 exit 1。

**需要 Lead 裁决（二选一，本审计不落盘）**:
- **(A) 保留坦克接线（推荐，与注释里引用的 Lead 裁定一致）**: 把 `dev/verify-foliage.js:382-384` 的 ⑥ 从"文件名清单"升级为"**引用所在函数**"判定 —— 本审计脚本已实现该判定（`dev/_audit-foliage-ref.js` 的【F0】节，输出 `弹道/命中函数体内的引用: 0`），可直接照搬。
- **(B) 回退坦克接线**: 由 tank-ai 移除 `15-vehicles.js:668` 一行；但这与"各兵种同规则"的用户口径相悖。

**复现命令**: `node dev/verify-foliage.js`（看 ⑥，exit 1）；`node dev/_audit-foliage-ref.js 11 20000`（看【F】节，弹道函数体内引用 = 0）

---

## 合计: **通过 5/6，不通过 1/6，存疑 0**

| # | 必查项 | 判定 |
|---|---|---|
| 1 | 不挡子弹 | 通过（语义与调用路径均成立；验收探针 ⑥ 因 §7-0 跨任务接线变红，需 Lead 定口径） |
| 2 | 性能/粗筛 | 通过 |
| 3 | 滩头纪律 | 通过 |
| 4 | 玩家与 Bot 同规则 | 通过（小地图是否同步 = 需 Lead 裁决的新需求，本批不改是正确判断） |
| 5 | 边界与鲁棒性 | **不通过**（5a 端点格漏判；5b/5c/5d 通过） |
| 6 | 既有机制回归 | 通过（4 个既有探针全绿；`dev/verify-foliage.js` 自身因 §7-0 红） |

## 必须修的最小项清单（按优先级）

1. **【必修·代码】`js/04b-fire.js:291-293` 端点格漏判**（3 行改动，修法见 5a；本审计已独立验证修法与参考实现 0 不一致）。影响: 全 13 张图，"敌人站在灌木里反而被看见" 9.4%（island 1752 株中的 164 株）；随机视线漏判率 0.185%。
2. **【必修·口径，需 Lead 裁决】§7-0 `js/15-vehicles.js:668`（tank-ai）接入 `foliageBlocksLOS` 使 I5 验收探针 ⑥ 变红**：语义上不违反"不挡子弹"（弹道函数体内零引用），但门禁需 Lead 选 (A) 把 ⑥ 升级为"引用所在函数"判定，或 (B) 回退该行。
3. **【建议】`dev/verify-foliage.js:285-297` 交叉校验样本 400 对 → ≥20000 对**（当前样本量不足以暴露 5a；本审计 200 对即命中 1 对）。
4. **【建议】`js/05c-layouts.js:2235` 草丛滩头阈值仍写死 `-15`**，未走单源 `FLORA_CFG.shoreGuard`（22）—— 单源不一致（草丛非遮蔽物，不违反用户"灌木/树丛留白"口径，但"密度魔数进单源"这条在草丛上没做全）。最小修法: `if(SEA&&(shoreDist(x,z)>-FLORA_CFG.shoreGuard||rectDist(...)<=0)) continue;`
5. **【文档】基线数字不一致**: `05c-layouts.js:1808` 写"改造前 99 株灌木"，`dev/verify-foliage.js:179` 注释写"改造前 bush=121"（121 恰是 normandy 的实测值）。建议统一为 island 的实测基线。
6. **【余量】蕨丛 75 丛 vs 验收门槛 60** —— 余量仅 25%，后续再动 `groveFernArea`（620）或椰林圈半径会掉到门槛下。
7. **【提示】首次 `perceive()` 触发 3 ms 建索引**（一次性）。若想消除该帧毛刺，可在 `buildWorld` 末尾预热一次查询；非必须。

## 复现命令汇总

```bash
node dev/_audit-foliage-ref.js 11 20000   # 独立对照: A~H 全部证据 (island)
node dev/_audit-foliage-ref.js 0 3000     # 缺省路径核对 (normandy, 其余 13 图零变化)
node dev/verify-foliage.js                # 实现者验收探针 (当前 exit 1: 仅 ⑥ 因 §7-0 红)
node dev/verify-fire.js 11                # 回归: island 可燃/碾毁 (exit 0)
node dev/verify-layouts.js                # 回归: 13 图布局不变量 (exit 0)
node dev/verify-sink.js                   # 回归: 植被下沉 (exit 0)
```
