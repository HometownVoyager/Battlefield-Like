# 诺曼底农田真实化改造计划（第一关试点）

## 目标
把诺曼底 1944 从"草地上撒房子"改造成**真正的博卡日农田战场**：农田块田地 + 断续树篱围田（四方通透）+ 下沉土路 + 农田色带 + 高杆庄稼（小麦/玉米）作为**软隐蔽**——可穿行、子弹穿透、只遮 Bot 视线。改造完成后您实机验收（混合方式：您直觉反馈 + 截图对照），验收通过后再做淞沪（稻田水网）。

## 一、地形：田块语义（js/03-terrain.js）
1. **新增 `RURAL_FIELDS` 田块定义表**（诺曼底门控，手工坐标约 12 块：麦田/玉米田/牧草/果园，每块 35~55m，铺满 ±110 区域，避开旗点圈、基地、公路走廊 20m）：色带和作物实例化共用这一个表，避免逻辑漂移。
2. **下沉土路**：`heightAt()` 内加诺曼底分支——`roadDist(x,z)<4` 时下凹约 0.45m（smoothstep，模板照抄现有战壕 L84-88 但减半深度）。所有系统（物理/视觉/寻路/地基）高度经 heightAt 自动同步；0.45m 在 placeAt maxDh 容差内。
3. **农田色带**：地面网格顶点色循环（L186 噪声之前）加诺曼底分支——按 `RURAL_FIELDS` 判定所在田块，给乘法色差：麦田金黄、玉米绿、牧草亮绿、翻耕褐、田埂深色细线（复刻现有道路 1.16/0.94/0.72 的乘法调制手法，±0.2 内）。MAT.grass 是 vertexColors，无需动材质。

## 二、庄稼软遮蔽（新系统，仿烟雾）
4. **`CROP_FIELDS` 全局数组 + `cropBlocksLOS()`**（放 05c-layouts.js 或 05b-props.js）：数组记录每块庄稼田的世界 AABB + 作物顶高；`cropBlocksLOS` 做视线线段与矩形相交判定（照抄 08-effects.js `smokeBlocksLOS` 的 t 投影法），且要求视线在交点的插值高度低于作物顶高（麦 1.3m：蹲伏 1.0~1.15 隐形、站立 1.4~1.62 露头；玉米 2.3m：站着也隐形——真实的高杆作物差异）。
5. **Bot 索敌接入**：js/14-bots.js `perceive()` 在 L270 烟雾检查旁并列加 `if(CROP_FIELDS.length&&cropBlocksLOS(...)) continue;`。子弹链路（raycastWorld/rayCyl/raySoldiers）**不改**——子弹穿透庄稼（与烟雾同一套逻辑，符合您"不挡弹只遮视线"的定案）；已交战的 Bot 会保留目标约 8 秒朝庄稼扫射压制（与烟雾现有行为一致，是有意的真实感）。
6. **视觉**：05c-layouts.js buildWorld 草 InstancedMesh（L574）后加诺曼底作物 InstancedMesh——交叉两片大面片（照抄 L548-574 dummy 模式，一次性几何+逐实例矩阵），`transparent:true + alphaTest:0.4 + DoubleSide`（与树/草同机制），depthWrite 默认开 → 玩家和 Bot 视觉遮挡自动成立。每块田 800~1200 株，间距 1.2m，随机摇摆朝向。纹理 canvas 只用 fillRect/stroke/arc（**不用渐变/ellipse**，验证沙箱桩不支持）。
7. **动物世界注意**：作物**不写 CYLS/BOXES/不入 PROPS**（避免 OCC 占格堵 Bot 寻路、避免千级道具互斥检查 O(n²) 爆炸），只用 freeSpot 逐株避建筑足迹。

## 三、树篱围田与布局（js/05c-layouts.js, js/05b-props.js）
8. **先修 hedgerow 断点 bug**（05b-props.js L138）：现有 `propTake(x,z,2.4)` 半径 2.4×2=4.8 > 4m 步距 → 每两段必拒一段（现有树篱是断点墙）。改为 `propTake 1.7`（1.7×2=3.4 < 步距 3.6），全局生效，所有战役受益；需回归互斥检查。
9. **断续树篱围田**：layoutRural 按 `RURAL_FIELDS` 边界铺树篱段——每面 2~3 段（每段 8~16m），段间留 6~12m 天然豁口，**不围死、四方通透**（您确认的围法）；公路走廊（roadDist<10）跳过；旗点 25m 内少放；靠 freeSpot/propFree 自动避开建筑与现有道具。保留现有 7 处树篱/石墙不做大改。
10. **果园**：村庄附近 3~4 簇小树（tree 复用，scale 0.55~0.7 密集簇）。
11. **树木散布（L528-540）避让**：树/枯树落点避开田块内部（农田整洁），田块外散布照旧。
12. 原有村庄建筑、弹坑、沙袋、瞭望塔、石墙、草垛全部保留。

## 四、HUD（js/22-hud.js, js/23-deploy.js）
13. 小地图 `drawMinimap`（L35 后）与部署图 `drawDeployMap`（L79-80 后）各加一段：遍历 CROP_FIELDS，矩形 4 角经 toMap/toM 变换画半透明浅绿多边形（旋转坐标系下不能 fillRect）。

## 五、沙箱与回归（dev/）
14. **同步 2 个地形复刻副本**（verify-layouts.js makeTerrain、verify-buildings.js makeTerrain）：诺曼底下沉土路公式必须同步，否则 g0 高度断言失真。
15. 三个沙箱全量回归：verify-layouts（种子确定性/互斥/弹药箱）、verify-buildings（门带/楼梯/屋顶/落地）、verify-boot（11 战役开场路径）。
16. **新增旗点净空断言**：verify-layouts 加"旗点 r+8 范围内无树篱碰撞盒"（防围田堵旗点）+ 田块内树篱段数统计。

## 六、文档
17. README 第四节加"农田系统（诺曼底博卡日：田块色带/下沉土路/断续树篱/庄稼软遮蔽 cropBlocksLOS）"行 + 变更记录追加一行。

## 实施顺序
地形（RURAL_FIELDS/下沉路/色带）→ 庄稼系统（CROP_FIELDS/cropBlocksLOS/视觉）→ hedgerow 修复 + 布局围田 → HUD → 沙箱同步 + 回归 → README → 交付实机验收清单（重点：蹲麦田/玉米田试隐形、树篱豁口走位、Bot 进田扫射、村心开阔地对峙、小地图/部署图农田块）。

## 风险
- Bot 寻路：树篱断续+豁口 6~12m + 避开公路走廊，理论上不会堵死；旗点净空断言兜底。
- 性能：新增约几百树篱碰撞盒（BOXES 全量扫描 +5~10%，可接受）+ 每田 800-1200 株实例（InstancedMesh 单次绘制）。
- 验证失真：两个沙箱地形副本必须同步（第 14 条硬性要求）。