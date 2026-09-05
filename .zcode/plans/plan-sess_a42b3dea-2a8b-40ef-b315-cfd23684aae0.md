## 目标：新增 3 个战役，补齐"地形×玩法"缺口

背景虚构化（用户已定）：战役起架空名，阵营/武器沿用现有 6 派系。全部复用现有框架（旗点/基地/道路/战壕/主题/天气/建筑体系），不新增武器。

### 动画前定案（已通过提问确认）
- 遭遇战：无旗点纯绞肉（死亡/载具毁扣票，先清零输）
- 劫道：纯 AI 卡车车队（不可驾驶）；护运方=车队+2 坦克+少量步兵，劫道方=步兵多+反坦克火力翻倍+无坦克
- 草原掩体：稀疏（灌木/枯树/土坎/干草垛/电话线杆/2~3 栋木棚）
- 坦克翻倍（仅草原遭遇战）

### 三个新战役
| id | 标题 | 阵营 | 地形 | 玩法 |
|---|---|---|---|---|
| steppe | 草原遭遇 1943 · 无垠波地 | 苏/德 | 新 `steppe` 波状草原 | 新 `clash` 遭遇战 |
| woodline | 雾林守线 1944 · 落叶雾林 | 美/德 | 新 `woods` 高疏落叶林 | 现有攻防（德军攻） |
| canyon | 断崖公路 1940 · 山谷劫道 | 八路/日军 | 新 `mountain` 山脊夹谷公路 | 新 `convoy` 劫道/护运 |

### 实施顺序与里程碑
**M1 = ①+②（两条新基础在一条线上产出，一次实机验证）**
1. **无旗点加固（遭遇战和劫道共同的前置）**
   - `17-emplacements.js:62` 加载期 `FLAGS[len/2]` 加长度守卫
   - `17-emplacements.js` `frontlinePoint()` 空 FLAGS 时回退到"两基地中点/阵营前出点"
   - `14-bots.js` `pickObjective()` 加 `clash`/`convoy` 分支 + `decide()` 空 objective 守卫；`pickSpawnFor` 候选=基地+阵营前出点
   - `15-vehicles.js` `driveAI()` 加分支：clash 时坦克推向敌前出点/敌基，convoy 时护运坦克跟随车队
2. **00-config**：3 个 `CAMPAIGNS` 条目（含新字段：`spawns` 前出点列表、`tankMul`、`convoy:{truckN:5,hp:320,spd:4.5,escapeN:3,escortTeam:1,...}`）；`THEMES` +3（steppe/woods/mountain）；`WEATHER` +3
3. **03-terrain** `rawHeight` +3 case：steppe 平缓波地；mountain 谷底零起伏、两侧山脊（`h=(1-e^{-(z/18)²})×(山脊噪声)`，保证公路走廊平整）；woods 中等起伏
4. **05c-layouts** +3 布局函数：layoutSteppe（稀疏掩体+浅战壕+谷仓/木棚+前出点机枪位）、layoutWoods（守方五旗沙袋/碉堡/木屋/战壕，复用 alpine/jungle 素材）、layoutCanyon（谷底公路+两侧坡地伏击位/石块/枯树，路上不放建筑）
5. **21-match**：`clash` 分支（无占点扣票，死亡扣票即可，超时比兵力）；`convoy` 分支（车队全毁→劫道方胜；≥3 辆突围→护运方胜；超时比已毁/突围数）；HUD 模式行文案
6. **22-hud**：票数 ∞ 规则按模式调（assault/demolition 防守方 ∞、clash 双方实票、convoy 双方 ∞）；小地图画前出点/车队点；convoy 顶部目标行"车队剩余 X 辆 · 已突围 Y"
7. **23-deploy**：出生点列表加入 `CAMPAIGN.spawns`；坦克按 `tankMul` 翻倍（clash×2）；旗点初始归属逻辑对空 FLAGS 免疫；`matchTime` 按模式设定
8. **M1 实机验证**：你进游戏选"草原遭遇 1943"和"雾林守线 1944"各打一局，我提出验证点，你反馈+截图（我不碰浏览器）

**M2 = ③断崖公路（最大的新系统单独做）**
1. **新文件 `15b-trucks.js`**（index.html 加载它）：`Truck` 类——卡车网格（驾驶室+货厢+6 轮，用现有 boxGeo/MAT 拼）/ 沿 `CAMPAIGN.roads[0]` 航点行驶（速度 `dampF`，贴地 `heightAt`，参照坦克 line 202）/ `takeDmg/die`（爆炸 FX+残骸 3 段碰撞体 `registerDynCollider`，**不重生、不计票**）
2. **13-combat + 16-aircraft**：5 处命中管线加 `trucks` 循环（bullets/shells/splashDamage/splashDamageFF/nade 近爆/飞机扫射）
3. **21-match** convoy 胜负判定 + **23-deploy** `startMatch` 按 `CAMPAIGN.convoy` 生成车队
4. **14-bots**：护运方 Bot 目标=跟随车队点；劫道方 Bot 目标=伏击位，车队进射程才打（接火逻辑复用现有索敌）
5. **M2 实机验证**：你打"断崖公路 1940"，我出验证清单（车队速度手感/卡车血量/伏击位视野/寻路是否堵路）

### 工程配套
- `dev/verify-layouts.js` 自动发现新战役（无需改列表），但需给 convoy 图补一条不变量：公路走廊无建筑压路、伏击点可选通
- 每次 M 完成后按 README「更新工作流」改 README（子系统表+变更记录）
- 回归：`node dev/verify-layouts.js` / `verify-buildings.js` / `verify-rooffall.js`（不跑浏览器）

### 风险与对策
- 卡车物理碰撞（玩家/Bot 与行驶中的卡车穿模）：v1 不做实体互推，先让你实机定夺要不要
- 空 FLAGS 是全逻辑硬伤点，M1 的第一步必须先做掉
- 若你实机发现 convoy 数值不对（车速/血量/逃生数），改 `CAMPAIGN.convoy` 字段即可重生成，无需动逻辑
