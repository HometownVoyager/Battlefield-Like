# 独立验收终版报告 · 20260921B 批 (8 条 + 贴图)

> ⚠ **本文件主体是"修 LVT 前"的首轮验收记录 (冻结版 A)**。naval 按 Lead 裁决修完 LVT 穿模后,
> 我在**最终冻版 B** 上做了完整复验, 结论见文末 **§13 复验 (最终冻版 B)** —— ④⑤ 由 FAIL 转 **PASS 23/23**。
> 交付请以 §13 的指纹与结论为准。

> 验收者: teammate `verifier` (task-3)。**不采信任何作者自报**: 每条都是自己重跑或自己量。
> 全部探针写在 `dev/` 下, **未改 js/**、未改任何他人自检/探针文件 (`dev/_battery-selfcheck.js`、
> `dev/_naval-model-selfcheck.js`、`dev/_navmodel-selfcheck.js`、`dev/_firepoint-selfcheck.js`、
> `dev/tmp-shallow-amph.js`、`dev/probe-modelshots.js` 一行未动)。真 three.js 一律用
> `dev/vendor/three.min.js` (r152, 与 `index.html` 的 CDN 同版)。

## 0. 被验版本 (冻结版指纹)

| 项 | 值 |
|---|---|
| `index.html` sha256 | `4b99d0327ec5779e42ad23e6fcc22c122d9191eb523bdce1df82e8d24c1ac6ba` |
| `js/` 全树指纹 (39 个 .js 按文件名排序的 sha256 列表再哈希) | `cdc000da91551be16373962b83a192b7bf95434beeb9de5bc9fdbaef0342d489` |
| 逐文件 sha256 清单 | `dev/out/_verify-b-frozen-fingerprint.txt` |
| 关键文件 | `15f-battery.js` 25653D27… · `06-engineering.js` A5C3018B… · `15-vehicles.js` 43554EEF… · `00-config.js` D50228F0… · `02-scene.js` 960D88B0… · `15d-naval.js` D9BF0EC8… · `15e-navmodels.js` FC0FFB53… · `17-emplacements.js` 749F32D3… · `05c-layouts.js` 3E45B0FD… · `14-bots.js` 4E623DBB… · `20-player.js` 3B18E6F1… |

工作树在验收期间被并发改动过 (06-engineering 00:39 炮箍改挂管 / 15f 与 14-bots 兜底清理 01:08-01:11 /
20-player 注释 01:13 / 口径文档 §12)。**本报告全部结论都基于上表的冻结版**: 第一批 4 支探针 + ③ 探针
在冻结后已**原样重跑** (`dev/out/refreeze-*.txt`), 数字与首次一致。

## 1. 结论总表

| # | 项 | 结论 | 权威证据 |
|---|---|---|---|
| ① | 反舰炮台浮空件 | **PASS** 20/20 | `node dev/_verify-b-battery.js` |
| ② | 迫击炮两脚架 | **PASS** 21/21 | `node dev/_verify-b-mortar.js` |
| ③ | 固定火力点翻新 | **PASS** 25/25 | `node dev/_verify-b-firepoints.js` |
| ④⑤ | 两栖坦克 / 舰船 | **FAIL** 22/23 | `node dev/_verify-b-navalmodels.js` — 见 §5 |
| ⑥ | 空间/交互纪律 | **5 条 PASS + 1 条 FAIL(即④⑤那条)** | 见 §6 |
| ⑦ | 两栖车浅水 | **PASS** | `dev/tmp-shallow-amph.js` + `dev/_verify-b-shallow-frames.js` + `dev/verify-naval.js` |
| ⑧ | 弹速 190 + life 缩 | **PASS** 20/20 | `node dev/verify-20260921B-speed.js` |
| 贴图 | 4 张新程序化贴图 | **PASS** 9/9 (Node 侧) | `node dev/_verify-b-tex.js` + `node dev/verify-svgtex.js` |
| 既有套件 | 8 支全绿 | **PASS** | `dev/out/_verify-b-suites.log` |

**唯一 FAIL: 两栖车 LVT(A)-1 的主炮炮管在炮塔朝前时与自己艏端上翘唇板实体相交 (最大穿透 0.047m)。**
详见 §5 —— 这是本批新模型的空间逻辑缺陷 (§6-1 不穿模), 建议修后再交付。

---

## 2. ① 反舰炮台浮空件 (js/15f-battery.js) — PASS 20/20

**命令**: `node dev/_verify-b-battery.js` → exit 0 (原始输出 `dev/out/refreeze-_verify-b-battery.txt`)

**方法** (不是复述作者自检): 先用 `_bootstub` 全量启动 island 取 4 门真落位 (SW/SE/NW/NE, baseY 7.39/5.86/1.47/0.76),
再在**真 three.js r152** 上下文里加载真 `00-config` + 真 `15f-battery.js`, 用这些落位 `new Battery(...)`,
逐件 `Box3.setFromObject` 量世界 AABB, 再用 `grp.matrixWorld⁻¹` 转回**组局部系** (平台方块与 `face` 对齐 ⇒ 水平红线必须在组系里判)。

| 断言 | 实测 |
|---|---|
| 4 门 × 26 件, 组局部水平 \|x\|,\|z\| ≤ `BATTERY_PAD_HW` 6.2 | 最大 **5.229** ✓ |
| 无高浮件 y ≤ 3.2 | 最高 **2.651** ✓ |
| **12 发待发弹世界 y = baseY+0.155** | 偏差全部 **0.000** ✓ (旧写法 = 2×baseY+0.13) |
| 弹底缘贴台面 (平台顶 0.06) | 0.055 ✓ (5mm 刻意嵌入, 防悬空) |
| 弹与座圈无穿透 | 2.076 > 1.85 ✓ |
| 测距仪 3 腿(脚落平台面 0.060~0.063)+1 箱+1 镜, 全在 ±6.2 | 5 件 ×4 门 ✓ |
| 击毁态: 待发弹不在 `reg.meshes` | 3 发/门, 入链 0 ✓ |
| 浮件扫描 | 0 命中 ✓ |
| **阴性对照** (内存里打回口径 §1 旧写法) | 弹世界高跳到 `2×baseY+0.13` (SW 14.92)、测距仪偏出 4.23~5.25m ⇒ 探针非空转 ✓ |

## 3. ② 迫击炮两脚架 (js/06-engineering.js) — PASS 21/21

**命令**: `node dev/_verify-b-mortar.js` → exit 0 (原始输出 `dev/out/refreeze-_verify-b-mortar.txt`)

真 three 加载真 `00-config` + 真 `06-engineering.js`, 直接调 `deployMortar(owner,0,0,0)`, 遍历 `MORTARS[0].grp`
逐件量世界 AABB; 件名按**几何签名**标注 (炮箍现在挂在 `tube` 下, 顺序法必然错位)。

| 断言 | 实测 | 旧版 (同口径) |
|---|---|---|
| 12 件网格 + 炮箍 `ring.parent===tube` | ✓ | — |
| `MORTARS` 记录字段 `[alive,cd,cdLock,face,grp,owner,tube,user,x,y,z]` | 逐字段不变 ✓ | — |
| **两腿顶 ↔ 炮箍正体积相交** | 三轴重叠 [0.100, **0.061**, 0.092] ×2 | **分离 0.210m** (文档 0.208) |
| **两腿脚 AABB 下缘** | **0.009** (脚垫 0.000) | **悬空 0.083** (文档 0.082) |
| 横杆 ↔ 两腿 | [0.159, 0.027, 0.025] ×2 ✓ | 只连两腿 |
| 浮件 / 每件接合对象 | 0 命中, 12 件各有相交 ✓ | — |
| 炮箍世界中心 = 管轴 t=0.80 | 偏差 0 ✓ | — |
| **活值复核** `tube.rotation.x` 0.40~0.80 (开火 0.5 / 玩家俯仰) | 全程仍相交, 最小接合 0.023m ✓ | — |
| 契约: 落位/朝向/user/cd/cdLock/alive/owner、`coverPoints` +1、`tube` 仍是 grp 直接子件 | ✓ | — |
| **阴性对照** (内存打回旧写法: 腿长 0.42 固定 / 位置 (±0.15,0.28,0.30) / 炮箍在炮口端) | 旧炮箍 AABB `y=[0.687,0.788] z=[0.222,0.351]` **与文档 §2 表逐位相同**; 腿顶间隙 0.210 / 腿脚 0.083 ⇒ 旧基线独立确认 ✓ | |

## 4. ③ 固定火力点 (js/17-emplacements.js + js/05c-layouts.js) — PASS 25/25

**命令**: `node dev/_verify-b-firepoints.js` → exit 0 (原始输出 `dev/out/refreeze-_verify-b-firepoints.txt`)

**方法** (关键): 桩几何量不了 `fpBar/fpRod` 的 `quaternion.setFromUnitVectors` 朝向, 所以本项**让整局跑在真 three.js 上**
(39 个脚本全量启动, 只把 `WebGLRenderer` 换成桩; 几何/矩阵/Box3 全是纯数学)。启动实测 5.4s, `console.error` 0 条。
→ ATGUNS=10 · MG42S=8 · AAGUNS=4 · BOXES=6696 · CYLS=526 · PROPS=2522。

| 断言 | 实测 |
|---|---|
| A-1/A-2 每门反坦克炮 **22 件网格**, 22 个件名与源码单源一致 | 10/10 ✓ |
| A-3 每挺重机枪 **16 件网格** | 8/8 ✓ |
| B-1 浮件扫描 | 18 座 × 22/16 件 **0 命中** ✓ |
| B-2 每件要么正体积相交, 要么本身是薄片 (≤0.06) | 最小非零接合 **0.064m** ✓ |
| **C-1 atGun 真开火**: 实弹出膛点 = 模型炮口 (制退器前缘 z=2.69) 世界坐标 | 10/10, 差 **0.010~0.011m** (= 契约 2.7 vs 2.69 的 1cm) ✓ |
| C-2 实弹出膛点 = `炮位 + dir*2.7` 解析式 | 逐位一致 (Δ=0) ✓ |
| C-3 炮管中线在 grp 局部 y=0 | ✓ |
| **C-4/C-5/C-6 mg42 真开火**: 实弹 eye = `(mg.x, mg.y+0.12, mg.z)`; 枪口 = eye+dir*1.35; 与模型枪口箍前缘比 | 逐位一致; 模型对齐差 **0.000~0.088m** (8/8) ✓ |
| C-7 枪管中线局部 y=0.12 (= `EMPL_MG_EYE`) | ✓ |
| D-1/D-2/D-3 atGun 条目字段、`grp.position.y = groundFit(...)+0.85`、与 `g.y` 差 ≤0.05 | ✓ (最大 0.004) |
| D-4/D-5/D-6 朝向 order=YXZ & rotation.y=face、碰撞圆柱 `{r:0.6,y0,y1=g0+1.2}`、`propTake 2.7` | 10/10 ✓ |
| D-7/D-8/D-9 mg42 契约式 `grp.position.y=groundFit+1.0`、朝向、`propTake 2.3` | 8/8 ✓ |
| D-10 `AT_CREW_DIST=0.9` | ✓ |
| **E-0/E-1 360° 回转**: 24 个 yaw 下炮管胶囊 (r=0.115) 与**自家沙袋墙**最近距离 | 10 门全部 ≥ 半径 (零穿透) ✓ (AABB 口径会虚报 7~34mm, 已用精确判据复核) |

## 5. ④⑤ 两栖坦克 / 舰船 — **FAIL** 22/23

**命令**: `node dev/_verify-b-navalmodels.js` → exit 1; 明细另见 `node dev/_verify-b-navalbarrel.js`
(原始输出 `dev/out/_verify-b-navalmodels.txt` / `dev/out/_verify-b-navalbarrel.txt`)

### 5.1 PASS 的 22 项

| 断言 | 实测 |
|---|---|
| ④⑤-1 包围盒**长/宽** vs `hullL/hullW` ±15% (与作者自检文件头口径一致) | lvt +6.7%/+3.7% · kami +3.7%/+4.2% · pt +1.8%/−0.0% · gyorai +2.6%/+0.0% ✓ |
| ④⑤-2 材质实例互不共享 (两两交集为空) | 每台 9~10 套, 交集 0 ✓ |
| ④⑤-3 浮件 | 43/41/41/35 件全部 **0 命中** ✓ |
| ④⑤-4 **桨叶↔任何其他件净空** | lvt 0.130 (nmShaftGuard) · kami 0.130 (nmStrut) · pt/gyorai 0.290 (nmTransom); 均 ≥ 口径判据 (两栖 0.10 / 艇 0.25); 桨叶↔桨轴正体积相交 ✓ |
| ④⑤-5/6 **桨叶↔艉板 / 桨叶↔舵** (用户点名"螺旋桨和后板不重合") | pt **0.290 / 0.503m** · gyorai **0.290 / 0.452m** ≥0.25 ✓ (设计式 `NM_PROP_SET` 复算吻合) |
| ④⑤-8~13 §9 决定表 | pt `hullL 20.5` / 塔 `3.10×3.35×1.05 @ringZ 5.35`; gyorai `hullL 15.5` / 塔 `2.70×2.90×0.90 @ringZ 3.65`; 塔等比档 0.871; 艇宽不变 (6.40/5.20) ✓ |
| ④⑤-15 观瞄镜心 = `deckY + spec.sightH` | pt 2.912 = 1.662+1.25 · gyorai 2.460 = 1.370+1.09 ✓ |
| ④⑤-16 **tubeG 组序** | pt 4 管: 艏对 z=−0.841 > 艉对 z=−7.216, 左右 x=−2.77,2.77,−2.77,2.77 ✓; gyorai 2 管单组 (与 `NM_BOAT` 表 + `spec.torpedo=2` 一致) ✓ |
| ④⑤-17/18 wheels | 两栖车 12/10 个负重轮且每项是 Mesh + `userData{sx,lz,vy,baseY}`; 艇 `[]` ✓ |
| ④⑤-19/20/21/22 契约 | 四型都有 `muzzles.main`; dims 8 字段齐; 艇有 turretY/turretH/sightY+turretHit; 两栖车不给炮塔命中增量 ✓ |
| ④⑤-23 `muzzles.main` 落在炮管前端 | 四型 0.060m ≤0.15 ✓ |

### 5.2 **FAIL 详情: LVT(A)-1 炮管穿艏端上翘唇板**

```
⑤b 精确扫掠 (实体表面采样 64×16 + 端盖 64×8×2, 72 个 yaw):
   lvt    扫掠对最小净空  0.000m  ((无名回转柱) ↔ (无名静态件)@[0,2.325,3.617])
         ✘ (无名回转柱) ↔ (无名静态件)@[0,2.325,3.617] 净空 0.000m
           回转件 r=0.08 (主炮炮管, L=2.1) ; 静态件 size[3.244,0.14,0.676] rot[0.55,0,0]
   kami   扫掠对最小净空 0.181m ✓ · pt 0.197m ✓ · gyorai 0.188m ✓
```

- 相交件: **`15e-navmodels.js:365` 的艏端上翘唇板** (`nmBox(g, W*0.998, NM_PLATE*1.4, lipL, M.tone, 0, S.roof+NM_PLATE*0.5, L*0.455).rotation.x=NM_UPLIP`,
  LVT 上即局部 `(0, 2.325, 3.617)`、`size 3.244×0.14×0.676`、`rot.x=0.55`) **↔ 主炮炮管** (`navBuildTurret` 里 `nmTube(pitchG,…, S.barrelL=2.1)` 的无名管件, r=0.08)。
- 量值: 炮管轴线 y≈2.594 (局部), 唇板顶缘 y≈2.561 ⇒ **最大穿透 0.047m**; 受影响 yaw = **330°,335°,340°,345°,350°,355°,0°,5°,10°,15°,20°,25°,30°,35°,40°,45°** (16/72 采样点, 即"塔朝前 ±45°")。
- 三种互相独立的判据一致: ① 逐件 AABB 三轴重叠 [0.16, 0.047, 0.649]; ② 线段↔OBB 精确距离 0.0327 − r 0.08 = **−0.047**; ③ 实体表面采样净空 **0.000**。
- **为什么作者自检没抓到**: `dev/_naval-model-selfcheck.js` 的"炮塔 360° 净空"只对 **pt / gyorai** 两型输出断言行
  (`pt: 炮塔 360° … 最小净空 0.114m` / `gyorai: … 0.120m`), **两栖车 lvt/kami 没有跑这条** —— 已核对该自检输出 (76 项全绿)。
- 复现: `node dev/_verify-b-navalmodels.js` (⑤b 一节) 与 `node dev/_verify-b-navalbarrel.js` (逐 yaw 明细)。
- 影响面: 仅 LVT; 炮塔朝前 (冲滩时最常用射向) 时炮管下缘与艏唇板顶缘重叠约 5cm —— 属 §6-1「不穿模」缺陷。
  参考数值 (供作者决定改法): 唇板顶缘 y=2.561 / 炮管轴线 y=2.594 (r=0.08)、唇板 `rot.x=0.55`、`lipL=L*0.085`、`lipY=S.roof+NM_PLATE*0.5`。

## 6. ⑥ 空间/交互纪律 (口径 §6 六条)

| # | 纪律 | 结论 | 断言/证据 |
|---|---|---|---|
| 1 | 不穿模 (要么正体积相交 ≥0.08, 要么净空 ≥0.10; 不许贴面/悬空/埋进去) | **FAIL (1 处)** | 反舰炮台/迫击炮/火力点/载具四族扫描均通过 (最小非零接合 0.064m, 薄片豁免已单列); **唯一违反 = §5.2 LVT 炮管↔艏唇板 (穿透 0.047m)** |
| 2 | 不浮空 (浮件扫描 0) | **PASS** | 4 门炮台×26 件、迫击炮 12 件、18 座火力点×22/16 件、四型载具 43/41/41/35 件 —— 全部 0 命中 |
| 3 | 开火点与模型一致 | **PASS** | atGun 10/10 ≤0.011m · mg42 8/8 ≤0.088m · 岸炮 `Battery.fire`/舰炮 `NavalCraft.fireMain` 真开火捕获 (⑧ 探针) · 迫击炮见下"登记未改" |
| 4 | 交互半径与站位不变 | **PASS** | 运行时读数与契约一致: `AT_CREW_DIST=0.9` (00-config:1173) · `EMPL_MG_EYE=0.12 / EMPL_MG_MUZ=1.35` (13-combat:140) · `BATTERY_CREW_DIST=2.7` (15f:59) · `propTake` 2.7/2.3 · 迫击炮回收 3.5 (06-eng:70) · 上艇 陆上 4.5/水上 2.5 (20a-seats:315) · `EMP_REARM_T=6`。模型侧只暴露 `grp/yaw/pitch/muzzle()`, 交互函数体未随模型改动 |
| 5 | 视觉尺寸与物理尺寸自洽 | **PASS** | 艇 L/W ±15% ✓ (pt +1.8%/−0.0%, gyorai +2.6%/+0.0%); 两栖车车体盒对 hullH ±0.0% (作者自检同口径) 且整车高 +56.7%/+71.9% 为**既有口径**(含炮塔, 文档 §4 记载改造前 +61%); `verify-vehmodels` 10/0 通过 |
| 6 | 无新增全局状态 (换局不留残件) | **PASS** | `node dev/verify-worldrestore.js` → **10 组用例 0 失败 exit 0** (含破坏-还原敏感度对照); 本批模型只往既有容器写 (`world` / `grp` / `MORTARS` / `BATTERIES` / `TEX`), 15e 新增量全是顶层 `const NM_*` |

## 7. ⑦ 两栖车浅水 — PASS

**冻结版重跑** (真浏览器 CDP, 串行): `node dev/tmp-shallow-amph.js` → exit 0 (原始输出 `dev/out/refreeze-tmp-shallow-amph.txt`)

| 档 | 本批前 (口径 §7 记载) | 冻结版实测 |
|---|---|---|
| flood=0, 水深 0.999m | 浮航态速度压到 1.12 m/s、4 HP/s 擦礁掉血 (75 帧 −15 HP) | `state=run` vel 4.08、**dmgFwd=0**、前进 9.75m |
| flood=0, 水深 0.638m 起步 | 切履带态前先掉 7.2 HP | `state=run`、**dmgFwd=0**、前进 13.57m |
| flood=0, 0.45~0.55m | 履带态 3.2~3.9 m/s, 0 掉血 | `state=run`、**dmgFwd=0**、前进 11.1~12.2m |
| flood=0.35 (吃水 0.575) 水深 0.64m | **`state='ground'`**、推力归零、3.75s 挪 1.1m、掉 11.4 HP; 倒车只退 1.86m | `state=run`、**dmgFwd=0**、前进 13.57m、**倒车 8.60m**、dmgRev=0 |

**14/14 档** (flood ∈ {0, 0.35} × 水深 {0.999, 0.791, 0.638, 0.541, 0.444, 0.287, 0.131}) 全部 `dmg=0 / state=run`。

**逐帧取证** (补 Lead 探针证不了的"0 **帧** ground"): `node dev/_verify-b-shallow-frames.js` → exit 0
(窗口 700×460; dt 被 `24-main.js:17` 钳到 ≤0.05s, fps 6.0~6.4 ⇒ 每帧恒 0.05s, 逐帧序列确定):

| 量 | flood=0 | flood=0.35 |
|---|---|---|
| 601 帧: 起点水深 → 终点 | 1.193m → 干地 | 1.192m → 干地 |
| 0.05~1.2m 带内帧数 | 125 | 125 |
| **`state==='ground'` 帧数 (全程/带内)** | **0 / 0** | **0 / 0** |
| 观测到的 state 集合 | `{run}` | `{run}` |
| **hp 下降帧数 / 单帧最大跌幅** | **0 / 0** | **0 / 0** |
| 前进 / 倒车位移 | 29.16m / 11.11m | 29.16m / 11.11m |
| NaN 帧 | 0 | 0 |

**艇的浅水红线未破**: `node dev/verify-naval.js` → **9 通过 / 0 失败 / 2 跳过, exit 0** (原始输出 `dev/out/_verify-b-naval.txt`):
红线3 `PT state=ground 位移=0m` ‖ `LVT state=run 位移=49.976m`; 红线4④ 搁浅倒车 17.671m `脱困=true`; 红线7③ 两栖车 70s `搁浅帧=0`。

## 8. ⑧ 弹速统一 190 — PASS 20/20

**命令**: `node dev/verify-20260921B-speed.js` → exit 0 (原始输出 `dev/out/refreeze-verify-20260921B-speed.txt`)

- 运行时单源: `SHELL_SPD=190` · `SHELL_SPD_NAVAL=190` · `NAVAL_SPEC.{lvt,kami,pt,gyorai}.main.spd` 全 190 · `batteryGunDef().spd=190`。
- **6/6 开火点真开火** (钩子在 `shells.push`/`flakShots.push` 上读实际初速): 全部 **190.000 m/s**; life = 3.600/3.600/2.400/2.050/3.400/3.000。
- 射程包线: +1.33% / +1.33% / +1.33% / −0.13% / +2.13% / −0.87% —— 全部 |Δ| ≤5%。
- 全仓扫 (剥注释, 39 个 js × 8 条旧字面量模式): **0 命中**。
- 残留兜底字面量: **5 处 → 1 处** (Lead 清理后复测): 仅 `14-bots.js:1759`
  `const spd=(typeof SHELL_SPD_NAVAL==='number')?SHELL_SPD_NAVAL:115;`。
  ⚠ 这是**代码**字面量 (不是注释); 有 `typeof` 守卫 ⇒ 真链不可达, 但若按口径字面严格执行"全仓不存在硬写字面量", 这 1 处仍需清。

## 9. 贴图 (§9 决定表 4 张新程序化贴图) — PASS 9/9 (Node 侧)

**命令**: `node dev/_verify-b-tex.js` → exit 0; `node dev/verify-svgtex.js` → 40 个生成器全通过

| 键 | 类型 | 尺寸 | 2D 调用数 | 结论 |
|---|---|---|---|---|
| `TEX.steelPlate` | CanvasTexture | 128×128 | 505 | ✓ |
| `TEX.concrete` | CanvasTexture | 128×128 | 1137 | ✓ |
| `TEX.canvas` | CanvasTexture | 128×128 | 221 | ✓ |
| `TEX.stencil` | CanvasTexture | 128×64 | 76 | ✓ |

启动链 39 脚本 **0 异常 / console.error 0 条**; 4 张 wrapS/colorSpace/anisotropy 与 `makeTex` 单源一致; 都被材质引用
(`05c-layouts.js:2521-2524`); `TEX` 表 36 键。
**真浏览器侧**: Lead 的 after 截图 (`dev/out/modelshots/after/`, 12 张) 与启动日志已出; 我未为本条另开浏览器。

## 10. 既有套件重跑 (冻结版, 8/8 exit 0)

| 套件 | 结果 |
|---|---|
| `dev/verify-fire.js` | 全部通过 ✔ |
| `dev/verify-layouts.js` | ALL LAYOUT CHECKS PASSED (island fp=308319, 12 图) |
| `dev/verify-buildings.js` | ALL BUILDING INVARIANTS PASSED |
| `dev/probe-spawn.js` / `probe-spawnspot.js` / `probe-spawnpoints.js` | exit 0 |
| `dev/verify-worldrestore.js` | 10 组用例 0 失败 |
| `dev/verify-vehmodels.js` | 10 通过 / 0 失败 |
| `dev/_naval-model-selfcheck.js` (作者) | 76 项全绿 exit 0 |
| `dev/_navmodel-selfcheck.js` (作者) | exit 0 |

## 11. 未能验证 / 登记未改

**未能验证 (原因)**
1. **真浏览器目视项** (炮台正常/击毁近景、迫击炮/火力点近景、载具侧后视): 属人眼项; Lead 已出 before/after 12 张,
   我不重复开浏览器。我这边只做几何量测。
2. **手感冒烟测试** (弹速 190 的主观手感): 口径 §8 明列"不给断言, 交用户实机确认"。
3. **`14-bots` 提前量受控实验** (Bot 对 200m 靶首发误差): 口径 §8 列为受控实验; 本次只做解析核算 + 6 处开火点实弹读数。
4. **两栖车 spec 尺寸"不动"**: 无改造前基线可比 (口径 §9 声明不动; 实测 lvt `7.95/3.25/1.95`、kami `7.40/2.85/1.55`)。
5. **`20-player.js` "仅注释" 声明**: 仓库最后一次提交是 2026-09-13, 本批全部改动未提交 ⇒ `git diff` 无法隔离本批,
   故该声明无法逐字核验 (只核到: 交互常量与函数体结构与契约一致)。

**登记未改 (口径明确"不动", 非本批回归)**
1. **迫击炮出膛点 `mo.y+0.25`**: `13-combat.emplMortarShell` = `V3(mo.x, mo.y+0.25, mo.z)`, 而模型管口轴心 (t=1) 在局部
   y=0.928 / z=0.423 ⇒ **出膛点比管口低 0.678m**。口径 §2 明列"弹道不动" ⇒ 本批未触碰, 仅登记 (Lead 已要求写入本栏)。
2. **两栖车整车高**: lvt 3.06m = hullH +56.7%、kami 2.66m = +71.9% (含炮塔/负重轮; 文档 §4 记载改造前 +61%) ——
   作者自检口径为"车体盒对 hullH ±15% (0.0%), 整车高属既有口径", 我按同口径判 PASS 并把数字列出。
3. **LVT 桨叶↔桨轴护罩 0.130m**: 单源 `NM_PROP_CLEAR_A=0.16` 是"桨叶中心面→支柱后缘"的 z 参数 (面-面 0.130 与设计吻合),
   口径 §4 对"桨叶↔任何板件"的判据是 0.10 ⇒ PASS。

## 12. 复现命令一览

```
node dev/_verify-b-battery.js          # ① 20/20
node dev/_verify-b-mortar.js           # ② 21/21
node dev/_verify-b-firepoints.js       # ③ 25/25
node dev/_verify-b-navalmodels.js      # ④⑤ 22/23 (含 FAIL)
node dev/_verify-b-navalbarrel.js      # ④⑤ FAIL 逐 yaw 明细
node dev/_verify-b-shallow-frames.js   # ⑦ 逐帧 (CDP, 独占浏览器)
node dev/tmp-shallow-amph.js           # ⑦ Lead 探针复跑 (CDP)
node dev/verify-naval.js               # ⑦ 艇红线 9/0/2
node dev/verify-20260921B-speed.js     # ⑧ 20/20
node dev/_verify-b-tex.js              # 贴图 9/9
node dev/verify-svgtex.js              # SVG 材质 40 生成器
node dev/_naval-model-selfcheck.js     # 作者自检 76 项 (独立重跑)
node dev/_navmodel-selfcheck.js        # 作者自检 (独立重跑)
```

---

# §13 复验 (最终冻版 B) —— ④⑤ 转 PASS

## 13.1 新冻版指纹

| 项 | 值 |
|---|---|
| `index.html` sha256 | `4b99d0327ec5779e42ad23e6fcc22c122d9191eb523bdce1df82e8d24c1ac6ba` (未变) |
| `js/` 全树指纹 | **`39f385b63f7982e740b8b47a6f1a7e3a2f99c2e8d78f4cc13ebc24a5dd958f2c`** (首轮冻版 A 为 `cdc000da…`) |
| 逐文件 sha256 清单 | `dev/out/_verify-b-final-fingerprint.txt` |
| 本轮改动 | `js/15e-navmodels.js` (01:57) · `js/14-bots.js` (01:46, 兜底字面量清理) · `dev/_naval-model-selfcheck.js` (01:55, 覆盖面) |

## 13.2 ④⑤ 复验: **PASS 23/23** (原 22/23, FAIL 已消除)

命令: `node dev/_verify-b-navalmodels.js` → **exit 0 / 23 项全过**; `node dev/_verify-b-navalbarrel.js` → exit 0
(原始输出 `dev/out/final-_verify-b-navalmodels.txt` / `dev/out/final-_verify-b-navalbarrel.txt`)

| 型 | 我的⑤b 实体表面采样 (72 yaw, 权威口径) | 我的 navalbarrel 线段-OBB 口径 | 判据 口径 0.10 / Lead 0.05 |
|---|---|---|---|
| **lvt** | **0.121m** (对 `nmBowLip`@[0,2.159,3.617], yaw=0°) | **0.119m** | ✓ / ✓ |
| kami | 0.181m | 0.181m | ✓ / ✓ |
| pt | 0.197m | 0.472m | ✓ / ✓ |
| gyorai | 0.188m | 0.213m | ✓ / ✓ |

- 修复前 lvt = **实体相交 (穿透 0.047m)**; 修复后 lvt = **0.121m 净空**。两种独立量法 (表面密集采样 / 线段-OBB 距离−半径) 相差 2mm, 互相印证。
- 修复点核对 (不采信自报): `15e-navmodels.js` 新增 `NM_UPLIP_TOP=0.12`, 唇板顶缘 = 车体顶面+0.12 (旧 2.561 → 新 2.395), 倾角/长度不变; 唇板与炮盾已具名 (`nmBowLip` / `nmMantlet`), 我的 ⑤b 因此能按件名报出命中件。
- 与首轮结论的差异来源: 首轮 FAIL 的 `(无名回转柱) ↔ (无名静态件)@[0,2.325,3.617]` 就是同一对件 (炮管 ↔ 艏唇板), 修复后该件改名 `nmBowLip` 且顶缘降 0.166m ⇒ 净空由 −0.047 变 +0.121。**结论一致, 无矛盾**。

## 13.3 作者自检覆盖面: 四型全跑 + "故意验" (fault injection)

- `node dev/_naval-model-selfcheck.js` → **87 项全绿 exit 0**; 四型的 `炮塔 360° / 炮管扫掠 / 塔体回转件` 断言行**都在输出里**
  (首轮只有 pt/gyorai): lvt 炮管 0.079 / 塔体 0.057 · kami 0.131 / 0.681 · pt 0.114 / 0.576 · gyorai 0.170 / 0.280 (艇红线 0.10 / 两栖车 0.05)。
  (其 lvt 0.079 低于我的 0.121, 是因为它把"炮管+炮盾"建成**保守 OBB 盒**(半尺寸 [0.227,0.100,1.050]), 我量的是圆柱实体表面 ⇒ 它是下界, 两者都 ≥ 红线。)
- **覆盖面故意验** (我另写 `dev/_verify-b-selfcheck-coverage.js`, 复制自检副本注入坏值, 跑完即删副本, 不改作者文件):
  把 lvt / kami 的净空强制改成 −1 后, 副本**分别变红 exit 1**, 且报出该型的 2 条净空断言 (炮管扫掠 + 塔体回转件) ⇒
  **扩面确实接上了, 不是假绿**。

## 13.4 回归: 只动 15e (+14-bots 清理), 其余 7 项逐位不变

| 探针 | 最终冻版 | 与首轮冻版 A 的逐行比对 |
|---|---|---|
| `dev/_verify-b-battery.js` | 20/20 exit 0 | **逐行一致** (仅 PowerShell 包装行不同) |
| `dev/_verify-b-mortar.js` | 21/21 exit 0 | **逐行一致** |
| `dev/_verify-b-firepoints.js` | 25/25 exit 0 | **逐行一致** (仅启动耗时 6707→7330ms) |
| `dev/verify-20260921B-speed.js` | 20/20 exit 0 | 唯一实质差异: 兜底字面量 **1 处 → 0 处** (Lead 清理生效, 已独立核验) |

## 13.5 ⑦ 浅水回归 (可选项, 已跑): 结论不变, 并解释了一次 0.75 HP 的偶发

`node dev/tmp-shallow-amph.js` 在最终冻版上跑了 **2 次**: 两次都是 **14/14 档 `state=run` / 0 ground 档 / 0 掉血**。

四次运行汇总 (首轮冻版 A 前 / A / B / B 重跑):

| 运行 | 档数 | 总掉血 | ground 档 |
|---|---|---|---|
| 冻版前首跑 | 14 | 0.00 | 0 |
| 冻版 A 重跑 | 14 | 0.00 | 0 |
| **冻版 B 第 1 次** | 14 | **0.75** | 0 |
| 冻版 B 第 2 次 | 14 | 0.00 | 0 |

对那 0.75 HP 的**归因取证** (`dev/_verify-b-shallow-dmg.js`, 真浏览器; 包住实例 `takeDmg` 记录伤害量/攻击者/调用栈):
- 6 次重复该档 (flood 0/0.35 × 水深 0.109~0.131, 各 3 次): **伤害事件 0 次, 掉血 0.00**, `state` 全程 `run`。
- 0.75 = 原始伤害 2.5 × `TANK_ARMOR` 0.3 (`15d:484` 非穿甲减免) ⇒ 是**一次普通战斗命中**, 不是擦礁/浅水伤害
  (浅水擦礁 `15d:756` 与搁浅磨损 `15d:_grind` 都已 `!isAmph` 排除, 且会连续扣血而非一次性 0.75)。
- 来源: 该探针的"战场隔离"只在 t=0 执行一次, 而**游戏会持续重生 AI** —— 我在运行末尾统计到
  `liveSoldiers=34 / liveTanks=4` (隔离时全部置死), 重生单位在数分钟的扫描期间向测试车开火。
  ⇒ 0.75 HP 是**探针环境的重生 AI 战斗伤害**, 与 ⑦ 口径无关; 掉血发生在**倒车段**、`dmgFwd` 四次运行全为 0。
- 判据结论: **"全水深 0 帧 `state='ground'` + 前进段 0 掉血 + 浅水可前进/可倒车" 成立**;
  "0 HP 损失"在 6/6 受控重复 + 3/4 完整扫描中成立, 1/4 出现 0.75 战斗伤害已归因。

## 13.6 §13 结论

| # | 项 | 最终冻版 B |
|---|---|---|
| ① ② ③ ④⑤ ⑥ ⑦ ⑧ + 贴图 | — | **全部 PASS** (④⑤ 23/23; ⑥-1 不穿模的最后一条已消除) |
| 既有套件 8 支 | — | exit 0 全绿 (首轮冻版 A 已跑; 本轮的 15e 改动只影响载具模型, 已由 ④⑤/自检/verify-naval 覆盖) |
| 唯一遗留 | — | 无 FAIL; 遗留项仅为 §11 的"未能验证/登记未改"清单 |
