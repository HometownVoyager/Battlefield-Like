// ─────────────────────────────────────────────
// 15e-navmodels.js —— 海战载具剪影几何工厂 (2026-09-20N 海战批)
// 用户第 8 条路线: 00-config 剪影规格表 → 数据驱动工厂 → 程序化 Canvas 贴图, **不引入任何外部资源**。
// 数据单源: 全部视觉尺寸读 NAVAL_SPEC[key] (字段说明见 00-config 表头注释); 本文件只按
//   spec.shape / spec.kind / spec.float / spec.paint 走**离散档**分支 —— 调数值不用改这里的代码。
// 本文件是纯工厂: 不建实例、不进 world、不碰 AI/物理/武器 —— 由 15d-naval.js 的 NavalCraft 构造器调用
//   (index.html 里 15e 排在 15d 之前: 两边都走函数声明/const, 倒序会在 TDZ 里抛错)。
//
// ── 冻结签名 (§11.2, 任何人不得单方面改动) ──
// navBuildModel(spec) → { grp, turretG, wheels, muzzles:{main,secondary?,mg?,torpedo?},
//                         nodes:{pontoon?,propeller?,rudder?,flags?} }
//   grp      THREE.Group —— 原点 = 载具几何中心在地面/水面基准处, **+z 为艏(前)**, y 向上, x 右舷
//   turretG  THREE.Group|null —— 2026-09-21 炮艇重做后**四种载具全都有炮塔** (艇也走真炮塔档)
//   wheels   THREE.Mesh[] —— 每项 userData{sx,lz,vy,baseY} (与 Tank.wheels 同口径); 艇 = []
//   muzzles  main 必给; secondary/mg/torpedo 按 spec 给 (spec.secondary/mg 为 null 则不给该键)
//   nodes    pontoon(カミ 前后浮筒, Object3D[]) / propeller(尾部螺旋桨组) / rudder / flags(队旗)
//            + sight(炮塔观瞄镜心 Object3D —— 挂 turretG 下 ⇒ 世界坐标即炮手镜机位; 2026-11-01 审计注: 现仅艇登记, 两栖车消费侧走 20-player 的 dims.sightY/spec.sightH 降级链) / barrel(炮管 Mesh)
// ── 本工厂额外返回 (冻结签名的补充键, 原键一个不动) ──
//   mainG    主炮回旋组 (两栖车 === turretG; **艇同样 === turretG** ⇒ 15d 只转 turretG 一条路径即可)
//   pitchG   主炮俯仰组 (转它做俯仰; 世界炮口 = muzzles.main.getWorldPosition())
//   barrelPivot  炮管俯仰组 === pitchG (2026-09-21 冻结补键: WS2 炮手镜/后坐动画取件用)
//   turretHit {r,y0,y1} 炮塔命中圆柱 (r = 塔总成外缘半径; y0/y1 = 塔底/塔顶, **相对 grp 原点**)
//   secG/pitchG2  副武器(双联 .50)回旋/俯仰组; 该型无副武器时 null
//   tubeG    [鱼雷管枢轴...] 与 muzzles.torpedo 同序 (艇: [0,1]=艏组左·右 / [2,3]=艉组左·右)
//   dims     {L,W,H,hullY,bot,roof,deckY,waterline} + 炮塔增量 {turretY,turretH,sightY} 规格快照 (只读)
// ★ muzzles.* / tubeG 是**挂在炮管·发射管层级上**的 Object3D: 世界位置一律用 getWorldPosition() 取;
//   静止(炮塔 yaw=0/俯仰=0)时相对 grp 的坐标另存在每个节点的 userData.nmLocal (供 15d 校对/兜底)。
//
// ── 尺寸口径 (改动前必读, 也是给 verifier 的量测口径) ──
// ① 长/宽: **整车包围盒**对齐 spec.hullL / spec.hullW (±15% 红线内; 2026-09-22 两栖车重做后实测
//    最差 lvt +11.1% / 0.0% · kami 0.0% / −0.5% —— 两栖车那 0.9m 全是艉架/桨/舵 (车体本身严格 = hullL);
//    **カミ 的总长含前后浮筒** (NM_AMPH.kami.bl = 1−2×NM_PONT_L×(1−NM_PONT_EMBED) = 0.64; hullL 7.40
//    ⇒ 车体 4.74m —— 与史实 Ka-Mi 车体 4.8m / 含浮筒 7.42m 同口径)。★ 2026-09-25 勘误: 本段旧写
//    "≈0.595 ⇒ 4.4m", 那是把常量代错的笔算 —— 0.595 反而不符合同一句引的史实 4.8m。常量与自检的
//    "桨叶净空 ≥0.10"红线都是按 0.64 调出来的 (强行改 0.595 实测净空 0.095 转红), 故以代码为准。
//    行走机构/艉部/旗杆一律按 S.bodyL 派生, 不按总长。
//    高: 00-config 表头原文 hullL/hullW/hullH/hullY = "车体/艇体 长/宽/高/中心高" ⇒ 车体盒严格按
//    hullH 建、按 hullY 定心 (两栖车 hullY=1.30 而 hullH=1.95 ⇒ 车体盒 0.325~2.275, 正是"高大方箱车体"),
//    炮塔/上层建筑再按 spec.tur.h / spec.cupH 落在车体顶面之上。⇒ 两栖车整车高 = 车体 + 炮塔(高于 hullH);
//    **艇(2026-09-21 起也有炮塔)同口径**: 艇体盒 = hullH (bot..roof), 主甲板压到 bot+dkM·hullH (收窄干舷),
//    炮塔/舰桥/桅桁落在甲板之上 ⇒ 整车高 ≈ hullH + 炮塔 (2026-09-21B 缩艇+放大塔后实测 pt +12.4% /
//    gyorai +12.3%, 仍在 ±15% 内 —— **余量只剩 2.6pt, 再抬塔/抬甲板就会破线**)。
//    **为什么不能按"整车高 ≤ hullH×1.15"字面口径**: カミ hullH=1.55 而炮塔高 0.58+cupH 0.10 ⇒
//    车体盒只剩 0.68m, 与用户"高大方箱车体/审美不能落下"直接冲突; 史实 LVT(A)-1 全高 2.49m 也是
//    "车体 ~1.9 + 炮塔 ~0.6"。而"艇要装得下大炮塔(用户裁定的海上的坦克)"同理会顶破字面口径 ⇒ 艇沿两栖车口径。
//    若 Lead 裁定要字面口径, 只改 NM_HULL_FIT 一个系数 (炮塔让位给车体), 但艇会退回"小得可怜的炮塔"。
// ② 履带中心半距 = min(spec.trkSx, hullW/2 − 履带带宽/2): Lead 已在数据侧把 trkSx 改成与 hullW 自洽
//    (lvt 1.95→1.20 / kami 1.70→1.05), 故当前走 spec 值; 这条 min 只作安全网 —— 谁把 trkSx 调回
//    坦克口径 (位于车体盒外侧), 整车宽也仍不会越界。15e 不写死任何载具尺寸。
// ③ 艇炮炮管长: NAVAL_SPEC 已给显式值 (pt 2.30 / gyorai 1.80, 2026-09-21 随大炮塔加长) ⇒ 直接读 spec.barrelL;
//    若某型填 0 (未定长) 则自动走 hullL×NM_BAR_MUL 兜底比例。
// ④ 艇鱼雷管: 管数 = spec.torpedo (表里改数就改管数); 分组/朝向/每侧管数走 NM_BOAT[shape].tube 档;
//    muzzles.torpedo 的**索引语义**必须与 15d fireTorpedo 一致 ([0,1]=艏对左·右 / [2,3]=艉对左·右)。
// ⑤ 关节硬规约 (2026-09-21"连接不紧密"对治批, **四种载具同一口径**): 相接件必须体积重叠 ≥ NM_JOINT(0.08m),
//    禁止面贴合; 浮件判据 = 与任何件均无体积重叠 且 最近距离 >0.02m。薄片/矮件 (旗面 0.03 / 桨叶 0.06 等)
//    的嵌合深度受自身厚度上限 ⇒ 逐个登记豁免并报出实测重叠。量化取证: dev/_naval-model-selfcheck.js (真 three r152)。
// ⑥ 桨叶净空 (2026-09-21B 用户点名"螺旋桨和后边的板子重合"): 两栖车 桨叶 ↔ **任何**板件 ≥0.10m
//    (只有桨轴例外 —— 桨叶必须与它正体积相交, 否则桨就成了浮件); 艇 桨叶 ↔ 艉板/舵 ≥0.25m 且桨轴穿进艉板 ≥0.10m。
//    两栖车旧版是**整块艉轴轭架**把两支桨整只包住 (实测桨叶 z 全落在轭架 z 内, 正体积相交 0.06m) ⇒ 本轮
//    改成开放式艉架: 两根支柱 (咬进车体盒) + 一块小艉鳍 (连通到舵) + 独立桨轴护罩 ×2 + 桨轴 ×2。
// ⑦ 单一连通体 (2026-09-21B 新增判据): 把"正体积相交"当边做并查集, 每台载具必须只有一个连通块。
//    逐件浮件扫描有盲区 —— 旧版 lvt 的整个炮塔总成悬在车体顶面之上 0.0585m, 只靠炮管蹭艏唇板连通,
//    每件都"有相交"所以扫描报 0 浮件, 但整块总成并不是接在车体上的。⇒ 本轮给两栖车补了炮塔座圈 nmAmphRing。
// ⑧ 回转扫掠净空 (2026-09-21B verifier 扩面后的判据, 自检对**四型**都跑): 炮管总成 (pitchG 链, 去掉炮盾)
//    绕塔轴 24 个 yaw 的精确 OBB ↔ 每个静态件 ≥ 红线 (艇 NM_TUR_CLEAR 0.10 / 两栖车 NM_TUR_CLEAR_A 0.05);
//    塔体等回转件用"顶点实测绕轴圆柱"(比 AABB 角紧), 座圈咬合槽内那几件按设计接合链豁免并逐条打印。
//    ★ 本判据第一版只跑 pt/gyorai ⇒ 漏掉了 LVT 主炮穿艏唇板 (炮管下缘 2.514 vs 唇板顶缘 2.561, 穿透 0.047m,
//      正前方 ±45° 共 16/72 个采样)。修法: 艏端唇板顶缘压到车体顶面 + NM_UPLIP_TOP(0.12), 实测净空 0.119m;
//      艉端唇板不在扫掠圈内 (炮管后伸只到 −1.6·hullL) 保持原高。教训写在这里: **判据覆盖面本身就是缺陷面**。
// ── 硬约束 (与 I2 批坦克护栏同档) ──
// ① 纯程序化几何 + Canvas 程序化贴图, 无任何 Loader/图片/http; ② 无光源、无相机;
// ③ **每台载具的材质全部新建** —— 不得跨载具共享可变材质实例 (残骸换材质时会连带改到别人);
// ④ 每台载具网格数 ≤44 (2026-09-21 上限由 34 上调: 艇体分段舷弧 +6 件、真炮塔总成 +7 件;
//    2026-09-21B 两栖车尾部由 1 件大轭架改为 7 件艉架 (支柱×2/护罩×2/桨轴×2/艉鳍) 并补座圈/挡水沿/舷号板;
//    实测 lvt 43 / kami 41 / pt 41 / gyorai 35, 仍留 ≥1 件余量 —— **再加件之前先看这个上限**);
// ⑤ wheels 必须是 Mesh 数组且带 userData{sx,lz,vy,baseY}。
// ⑥ 不做 this.grp.scale 整体缩放: 缩放会连带炮口高度/履带接地漂移, 一律"按 spec 实尺寸建模"。
// ─────────────────────────────────────────────
'use strict';

// ══════════════════════════════════════════════════════════════════════
// 一、结构系数 (无量纲比值 / 板厚, 单位米) —— 放这里的只有"板厚/比例", 载具尺寸一律从 spec 读
// ══════════════════════════════════════════════════════════════════════
const NM_HULL_FIT=1.00;     // 车体盒高 = hullH × 该值 (口径①: 1.00 = 表头原文"车体高"口径)
const NM_PLATE=0.10;        // 通用装甲板/甲板厚度
// ── 行走机构 (2026-09-22 重做): 履带收窄成"带条", 负重轮比带条宽 ⇒ 侧视是一整排轮子压在履带上 ──
const NM_TRKW=0.12;         // 负重轮宽基准 = hullW × 该值 (口径②的安全网也用它)
const NM_TRK_RIBBON=0.090;  // 履带**带条**宽 = hullW × 该值 (窄于负重轮 ⇒ 轮子露在带条之前可见)
const NM_WHW=1.12;          // 负重轮宽 = 负重轮宽基准 × 该值
const NM_WHEEL_LIFT=0.02;   // 轮心高 = 轮半径 ×(1+该值) (轮底离地 2% 半径, 坦克工厂是 0.06m 固定值)
const NM_TRK_BOT=0.02;      // 履带下缘 = 轮半径 × 该值 (≈轮底 ⇒ 履带与轮同时接地; 旧值 0.22 让轮子吊在带子下面)
const NM_TRK_L=0.86;        // 履带带长 = **车体长** × 该值 (两端恰好被主动轮/诱导轮盖住)
const NM_WMARGIN=0.115;     // 首尾轮心留边 = hullL × 该值 (与 tankBuildGear 的 0.75m 同口径)
const NM_SPR_R=0.86;        // 主动轮半径 = 轮半径 × 该值 (8 棱柱 ⇒ 侧视读作"带齿驱动轮")
const NM_IDL_R=0.66;        // 诱导轮半径 = 轮半径 × 该值
const NM_SPR_Z=0.38;        // 主动轮/诱导轮中心 z = hullL × 该值 (履带带条两端内一档)
const NM_PONT_L=0.225;      // カミ 单节浮筒长 = hullL × 该值 (前后各一; 史实浮筒 ≈0.22L)
const NM_PONT_H=0.92;       // 浮筒高 = boxH × 该值 (顶面低于车体甲板 ⇒ 不进炮管扫掠圈)
const NM_PONT_EMBED=0.20;   // 浮筒内端咬进车体 = 单节浮筒长 × 该值 (与车体体积相交 ⇒ 不是"搁在旁边的板")
const NM_PONT_LATCH=0.10;   // 浮筒连接卡扣宽 = hullW × 该值 (史实可拆卸浮筒的接合件, 兼"两件是一体"的证据)
// 浮筒参数里有两处被 NM_AMPH.kami.bl 引用 ⇒ 必须在表**之前**声明 (const 有 TDZ)。
// ── 两栖车形体档 (2026-09-22 史实剪影重做批; 全比值, 尺寸一律从 spec 派生) ──
//   设计口径 (用户 2026-09-22 裁定): 车体 = **一张连续曲面** —— 艏部收窄/船底上翘/舷侧折角(浮力箱)/
//   甲板倒角都是同一张面上的转折。旧版那些"外挂薄板"(浮箱缘 / 艏艉上翘唇板 / 挡水沿 各是独立薄板,
//   顶点探出车体轮廓) 正是用户判词"散架"的来源, 本轮全部并入断面 ⇒ 浮箱就是车体的舷侧折角。
//   st 表 = 纵向站位 [t, wb, yb, wc, yc, yt, wd, ytop] (t: 0=艏 1=艉; 宽 × hullW/2, 高 × boxH 自 bot 起算)
//     wb 底半宽 / yb 底高 / wc 折角(舷)半宽 / yc 折角下缘 / yt 折角上收点 / wd 甲板半宽 / ytop 甲板高
//   两型的分工: LVT 舷侧折角明显 (wc−wb=0.354) 且艏部是"跳板式"钝艏; カミ 船体更圆 (wc−wb=0.236)、
//   艏柱前倾、艉部收窄更狠 ⇒ 侧视/俯视都一眼可辨 (自检的签名互异断言依赖这一点)。
const NM_AMPH={
 lvt:{ pw:0, pontY:0, bl:1.00,
  st:[[0.000,0.520,0.620,0.870,0.700,0.840,0.840,0.920],
      [0.045,0.580,0.420,0.920,0.620,0.780,0.890,0.960],
      [0.110,0.620,0.220,0.955,0.520,0.740,0.920,0.990],
      [0.240,0.646,0.070,0.990,0.450,0.790,0.950,1.000],
      [0.450,0.646,0.000,1.000,0.435,0.800,0.958,1.000],
      [0.760,0.646,0.000,1.000,0.435,0.800,0.958,1.000],
      [0.900,0.630,0.030,0.970,0.440,0.800,0.930,1.000],
      [1.000,0.560,0.140,0.860,0.460,0.800,0.820,0.990]],
  door:{w:0.60,h:0.46,y:0.26} },      // 方艉艉门 (史实 LVT 的艉跳板): 宽/高 × hullW / boxH, 底高 × boxH
 kami:{ pw:0.995, pontY:0.020, bl:1-2*NM_PONT_L*(1-NM_PONT_EMBED),  // = 0.64 ⇒ kami 车体 0.64×hullL (见文件头①; hullL 含浮筒)
  st:[[0.000,0.400,0.700,0.800,0.760,0.860,0.770,0.900],
      [0.050,0.460,0.480,0.875,0.680,0.820,0.840,0.940],
      [0.120,0.520,0.260,0.925,0.640,0.820,0.880,0.970],
      [0.260,0.660,0.080,0.932,0.680,0.870,0.905,1.000],
      [0.450,0.700,0.000,0.936,0.700,0.920,0.912,1.000],
      [0.760,0.700,0.000,0.936,0.700,0.920,0.912,1.000],
      [0.900,0.660,0.040,0.900,0.700,0.910,0.880,1.000],
      [1.000,0.540,0.200,0.780,0.700,0.900,0.740,0.980]] },
};
// ── 船体/浮筒通用 ──
const NM_DECK=0.75;         // 艇体主甲板高兜底 = 艇底 + hullH × 该值 (两栖车不用它; 艇实际读 NM_BOAT[shape].dkM)
const NM_BAR_MUL=0.09;      // 艇炮炮管长兜底 = hullL × 该值 (口径③: spec.barrelL=0 时)
const NM_MG_L=0.05;         // 副武器(机枪/机炮)管长 = hullL × 该值
const NM_TUBE_R=0.045;      // 鱼雷管半径 = hullW × 该值
const NM_TUBE_L=0.24;       // 鱼雷管长 = hullL × 该值
const NM_PROP_R=0.075;      // 螺旋桨半径 = hullW × 该值 (史实 LVT 双桨 ≈0.5m 直径; 旧值 0.05 只有 0.33m)
const NM_GRD=0.22;          // 螺旋桨轴高 = 静水吃水 × 该值 (艇尾水下)
// ── 尾部/桨轴总成系数 (2026-09-21B · 用户点名"螺旋桨和后边的板子重合"对治批) ──
//   判据 (自检断言): 桨叶 (NM_PROP_T 薄片) 与**任何**板件净空 ≥0.10m; 桨叶必须与桨轴正体积相交;
//   支柱/艉鳍必须与车体盒正体积相交; 整车仍是**单一连通体** (防"连接分散")。
const NM_PROP_X=0.22;       // 桨轴/艉架中心半距 = hullW × 该值 (两舷对称, 桨盘落在车体后缘之外)
const NM_PROP_T=0.06;       // 桨叶薄片厚度 (m) —— 薄片豁免件 (仍要求与桨轴正体积相交)
const NM_PROP_HMIN=1.05;    // 桨轴最低高 = 桨叶半径 × 该值 (桨叶下缘不扎进滩地)
// —— 净空红线 (2026-09-21B 口径): 自检断言与下面所有取值共用这几个数, 禁止各处另写 0.10/0.05/0.25 ——
const NM_TUR_CLEAR=0.10;    // 艇: 炮塔 360° 回转最小实体净空 (m); 也是两栖车桨叶净空红线
// 两栖车同判据的**独立红线** (2026-09-21B verifier 抓到 LVT 主炮穿艏唇板后才立的): 两栖车没有抬塔底的
//   余量 (塔顶是整车高的唯一来源), 故该型按 Lead 的修复要求取 0.05。2026-09-22 重做后实测炮管↔艏甲板
//   净空 0.09~0.12m (全 24 yaw), 塔体圆柱↔浮箱折角 ≥0.20m。
const NM_TUR_CLEAR_A=0.05;  // 两栖车: 回转件 ↔ 静态件 最小实体净空 (m)
const NM_PROP_CLEAR=0.25;   // 艇: 桨叶 ↔ 艉板/舵 净空 (m) —— 用户点名"螺旋桨和后边的板子不要重合"
// 两栖车桨叶净空: 取 0.13 ⇒ 实测最小净空 0.13 ≥ 红线 0.10, 且"往板里挪 0.05"必破 0.10
// (自检的阴性对照④按这条设计余量取证: 余量必须 < 0.15, 否则 0.05 注入抓不到 —— 见 dev/_naval-model-selfcheck.js)。
const NM_PROP_CLEAR_A=0.13; // 两栖车 桨叶前沿 → 艉架后缘 z 净空 (m)
const NM_SKEG_W=0.055;      // 艉架(车体↔桨轴支柱)宽 = hullW × 该值 (每舷一件, 上端咬进车体)
const NM_SHAFT_R=0.017;     // 桨轴半径 = hullW × 该值 (**直径 ≥NM_JOINT**: 舵与桨毂都挂在桨轴上, 轴太细会把
                            //   这两处接合的判据上限卡死在轴径上)
const NM_PROP_AFT=0.032;    // 桨盘后移量 = hullL × 该值 (桨盘整体退到艉面之后 ⇒ 桨叶不再钻进车体/浮筒)
const NM_RUDW_A=0.30;       // 单侧舵宽 = hullW × 该值 (桨后各一片, 内缘留 0.07·hullW 缝给舵间横梁;
                            //   旧版是跨中一块大板 ⇒ 侧视像"多出一片尾鳍")
const NM_RUDH_A=0.26;       // 舵高 = boxH × 该值 (史实 LVT 舵 ≈0.5m 高)
const NM_RUD_CZ=0.06;       // 舵心高 = 桨轴高 + boxH × 该值
const NM_RUD_AFT=0.15;      // 舵前缘 → 桨叶后缘 (m) ⇒ 桨叶↔舵净空 = 该值 (≥红线 0.10)
const NM_PROP_PITCH=0.50;   // 桨叶桨距角 (rad, 绕自身径向轴) —— 决定桨叶 AABB 的 z 半厚, 净空由它派生
const NM_PONTHI=0.12;       // 浮筒底 = **桨盘顶 + 该值** (m) —— 桨就在艉筒正下方, 这条净空必须构造性成立
                            //   (下限 = bot + boxH×0.03, 无桨的型走下限)
const NM_RUD_T=0.10;        // 舵厚 (= NM_PLATE; 非薄片 ⇒ 必须与桨轴嵌合 ≥NM_JOINT)
const NM_RING_FIT=1.06;     // 座圈外径 = 塔半径 × 该值 (与艇 NM_TUR_RING 同口径)
const NM_AMPH_RING=0.22;    // 两栖车炮塔座圈高 (m): 下 0.10 压进车体顶面 / 上 0.12 与塔体互嵌 0.10
// ── 艇尾/回转净空系数 (2026-09-21B) ──
// 桨组后移量 (m): 旧值 ≈0.17 (桨组贴在艉板后 0.11) ⇒ 实测桨叶↔艉板只有 0.20m < 红线 0.25, 玩家看到"桨与后板重合"。
//   本轮取 0.26 ⇒ 实测桨叶↔艉板 0.29m (对 AABB 最近的艉板; 对舵因 x 向错开 0.37~0.46 更远, AABB 0.50)。
//   余量 0.04 是**故意留窄**的: 自检的阴性对照往板里挪 0.05m 必须能跌破 0.25 (见 dev/_naval-model-selfcheck.js ④)。
const NM_PROP_SET=0.26;     // 艇: 桨组后移量 (m); 桨叶↔艉板净空 = NM_PROP_SET + 桨叶中心偏移0.16 − 艉板后缘0.13
const NM_TUR_LIFT=0.12;     // 艇: 塔底高出艏甲板面 (m) = NM_TUR_CLEAR + 0.02 (实测最小净空 pt 0.114 / 九三式 0.120)
// 艇体/炮塔关节系数 (2026-09-21 炮艇重做批; 全是板厚/嵌合深度量级, 不随载具尺寸缩放)
const NM_JOINT=0.08;        // 关节硬规约: 相接件最小体积重叠 (m) —— 自检按此判"弱接合", 违反即报告
const NM_DECK_EMBED=0.10;   // 甲板/上层建筑压进下层件的深度 (= NM_PLATE, 保证关节 ≥NM_JOINT 且不露缝)
const NM_SHEER_STEP=0.10;   // 舷弧相邻分段的 z 向搭接 (m) —— 段间不留缝, 高度差即舷弧台阶
const NM_RAILW_B=0.055;     // 艇舷缘栏板宽 = hullW × 该值 (外缘正好落在 hullW/2 ⇒ 艇宽基准件)
const NM_RAILH_B=0.20;      // 艇舷缘栏板高 (m; 兼鱼雷管托架 —— 管心落在栏板顶面 ⇒ y 向重叠 = 该值)
const NM_TUR_RING=0.34;     // 炮塔回转环座高 (m): 压进艏甲板 0.09 / 高出甲板 0.25 —— 2026-09-21B 由 0.20 抬高,
                            //   因为塔底必须离开艏甲板/艏楔 ≥NM_TUR_LIFT(0.12), 环座得把这段"座圈"填满
                            //   (环座与塔体互嵌 = 0.25−0.12 = 0.13 ≥NM_JOINT)
const NM_SEAT=0.01;         // 关节装配余量 (m): 按 NM_JOINT(0.08) 设计的节点统一再抬 0.01 ⇒ 实测 0.09,
                            //   防浮点边界把 0.08 算成 0.07999… 被自检判成"弱接合"
const NM_SIGHT_R=0.10;      // 炮塔观瞄镜座半径 (m); 镜座高 = 0.16, 压进顶盖 0.10
const NM_YARD_H=0.09;       // 桅横桁截面边长 (m): 与桅杆互嵌 0.08 (≥NM_JOINT)
const NM_DARK=0x33352e;     // 枪炮/履带/管件暗色 (与 15-vehicles 的 0x363830 同档)
const NM_DECK_COL=0xb08a5e; // 木质艇甲板基色 (与 TEX.deckWood 灰木纹相乘)
const NM_PONT_COL=0x8f8046; // 浮筒独立色 (カミ 可拆卸浮筒 —— 用色差拉开与车体涂装的剪影)

// ══════════════════════════════════════════════════════════════════════
// 二、规格适配层: NAVAL_SPEC → 归一化 S (字段名与 NAVAL_SPEC 一一对应)
// ══════════════════════════════════════════════════════════════════════
// 缺省兜底 (无 spec/缺字段时用; 数值取 4 型里最保守的 gyorai 档) —— 键名与 NAVAL_SPEC 完全同名
const NM_DEF={
 kind:'boat', shape:'gyorai', float:'hull', paint:'plain',
 col:0x54544a, colT:0x3f3f38, team:0,
 hullL:18.2, hullW:5.20, hullH:2.20, hullY:1.15, trkSx:1.20, whR:0.38, whN:5,
 tur:null, barR:0.05, barrelL:0, brake:0, cupH:0.10,
 draft0:0.85, pontoon:0, torpedo:0, secondary:null, mg:null,
};
function navSpec(spec){
const s=spec||{}, pick=(v,d)=>(v!==undefined&&v!==null)?v:d;
const L=pick(s.hullL,NM_DEF.hullL), W=pick(s.hullW,NM_DEF.hullW), H=pick(s.hullH,NM_DEF.hullH);
const hy=pick(s.hullY,H*0.60);                       // 车体盒中心高 (表头: "中心高")
const boxH=H*NM_HULL_FIT;                            // 车体盒高 (口径①)
const bot=hy-boxH/2, roof=hy+boxH/2;                 // 车体底面(龙骨/履带上方) / 车体顶面(甲板)
const kind=pick(s.kind,NM_DEF.kind), shape=pick(s.shape,NM_DEF.shape);
const float=pick(s.float,NM_DEF.float), paint=pick(s.paint,NM_DEF.paint);
const trkW=W*NM_TRKW;
// 履带中心半距: 口径② —— spec.trkSx 与"车体半宽留出履带厚"取 min (单源, 不写死)
const trkSx=Math.min(pick(s.trkSx,NM_DEF.trkSx),Math.max(trkW*0.5,W/2-trkW*0.5));
const whR=pick(s.whR,NM_DEF.whR), whN=Math.max(1,pick(s.whN,NM_DEF.whN)); // whN≥1: 轮距公式要除以 (whN-1)
const tur=s.tur?Object.assign({},s.tur,{ringZ:pick(s.tur.ringZ,0)}):(s.tur===null?null:NM_DEF.tur);
// 首上跳板 (旧版的独立斜板) 在 2026-09-22 重做里并入车体断面 (NM_AMPH.st 的艏部两站) ⇒ 这三个派生量作废。
const barrelL=(pick(s.barrelL,NM_DEF.barrelL)>0)?s.barrelL:L*NM_BAR_MUL; // 口径③
const draft0=pick(s.draft0,NM_DEF.draft0);
// 车体长 = 总长 × NM_AMPH[shape].bl (カミ 的总长含前后浮筒 ⇒ 车体 = 0.64 倍; 其余型 = 1.00)。
//   ★ 行走机构/艉部/旗杆一律按**车体长**派生 —— 按总长算会让履带与主动轮甩出车体之外。
const bodyL=L*((kind==='amph'&&NM_AMPH[shape]&&NM_AMPH[shape].bl)||1);
return {raw:s,kind,shape,float,paint,team:pick(s.team,NM_DEF.team),
 L,W,H,boxH,hy,bot,roof,
 col:pick(s.col,NM_DEF.col), colT:pick(s.colT,pick(s.col,NM_DEF.col)),
 tur,barR:pick(s.barR,NM_DEF.barR),barrelL,brake:pick(s.brake,NM_DEF.brake)?1:0,cupH:pick(s.cupH,NM_DEF.cupH),
 // 炮手观瞄镜高 (相对 deckY): spec 给了就用 spec; 未给 → null, 由建塔时退到"塔顶面"(几何自洽, 见 navBoatTurret)
 sightH:(s.sightH===undefined||s.sightH===null)?null:s.sightH,
 trkW,trkSx,whR,whN,whW:trkW*NM_WHW,whY:whR*(1+NM_WHEEL_LIFT),
 draft0,bodyL,pontoon:pick(s.pontoon,NM_DEF.pontoon),torpedo:pick(s.torpedo,NM_DEF.torpedo), // 管数 (建几具)
 // 艇: 主甲板高 = 艇底 + hullH×NM_BOAT[shape].dkM —— 2026-09-21 收窄干舷 (0.75→0.62/0.68), 舷弧另由艏/艉段抬升
 // (两栖车甲板 = 车体顶面 roof)
 deckY:(kind==='boat')?(bot+H*((NM_BOAT[shape]&&NM_BOAT[shape].dkM)||NM_DECK)):roof,
 // 水线(模型系 y) = 静水吃水 draft0 (15d 用 grp.position.y = waterY − draft0 对齐); 夹进食水区间防表值越界
 wl:Math.min(Math.max(draft0,bot+NM_PLATE*0.2),((kind==='boat')?bot+H*NM_DECK:roof)-NM_PLATE*0.2)};
}
// 贴图兜底取值 (02-scene 的 TEX 表; 缺键回落 grime —— 保证沙箱/加载间隙也能建模型)
function nmTex(name,alt){ return TEX[name]||TEX[alt||'grime']||null; }

// ══════════════════════════════════════════════════════════════════════
// 三、材质: **每台载具全新一套** (硬约束③ —— 绝不跨载具共享可变材质实例)
// ══════════════════════════════════════════════════════════════════════
function navMats(S){
const two=S.paint!=='plain';                          // 涂装分档: plain 单色 / two·camo 走第二色 colT
// 2026-09-21B 贴图分件 (02-scene 的 4 张新贴图: steelPlate 钢板铆钉 / stencil 编号喷涂; 口径 = 白底相对明度,
//   材质 color 只定色相): 车体 body(steelPlate) · 涂装第二色 tone · 履带/管件 dark · 桨/排气 rust ·
//   舷侧水线带 side(waterline) · 舱盖 hatch · 舷号 mark(stencil) · 旗 flag。每台载具全部 new (硬约束③)。
const M={
 body:new THREE.MeshLambertMaterial({color:S.col, map:nmTex('steelPlate','grime')}),
 tone:new THREE.MeshLambertMaterial({color:two?S.colT:S.col, map:nmTex('steelPlate','grime')}),
 dark:new THREE.MeshLambertMaterial({color:NM_DARK, map:nmTex('metalBrush')}),
 rust:new THREE.MeshLambertMaterial({color:S.colT, map:nmTex('rust')}),      // 排气/管件/桨 (锈蚀)
 steel:new THREE.MeshLambertMaterial({color:S.colT, map:nmTex('steelPlate','grime')}), // 艉架铸件/护罩
 side:new THREE.MeshLambertMaterial({color:S.col, map:nmTex('waterline')}),  // 舷侧水线带 (贴图下缘=污带)
 hatch:new THREE.MeshLambertMaterial({color:two?S.colT:S.col, map:nmTex('steelPlate','grime')}),
 mark:new THREE.MeshLambertMaterial({color:S.col, map:nmTex('stencil','grime')}),   // 舷号/队标喷涂
 flag:new THREE.MeshLambertMaterial({color:nvTeamCol(S), map:null}),
};
if(S.kind==='boat'){
 M.wet =new THREE.MeshLambertMaterial({color:S.colT, map:nmTex('barnacle')}); // 水下艇底 (藤壶藻绿)
 M.deck=new THREE.MeshLambertMaterial({color:NM_DECK_COL, map:nmTex('deckWood','wood')}); // 木质甲板
}
if(S.pontoon>0) M.pontoon=new THREE.MeshLambertMaterial({color:NM_PONT_COL, map:nmTex('rust')}); // 浮筒独立色
return M;
}
function nvTeamCol(S){ // 队旗色: 单源 TEAM_COL (00-config), 缺则回落到本车涂装
try{ if(typeof TEAM_COL!=='undefined'&&TEAM_COL&&TEAM_COL[S.team]!==undefined) return TEAM_COL[S.team]; }catch(e){}
return S.colT;
}

// ══════════════════════════════════════════════════════════════════════
// 四、几何小工具 (与 tankBuildHull 的逐行写法等价, 只是 4 型共用 → 少 30 行重复)
// ══════════════════════════════════════════════════════════════════════
function nmBox(p,w,h,d,mat,x,y,z){ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); m.position.set(x,y,z); p.add(m); return m; }
function nmCyl(p,rt,rb,h,seg,mat,x,y,z){ const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg),mat); m.position.set(x,y,z); p.add(m); return m; }
// 炮管/机枪管: 圆柱绕 x 转 90° → 轴沿 +z (艏向)
function nmTube(p,r0,r1,len,seg,mat,x,y,z){ const m=nmCyl(p,r0,r1,len,seg,mat,x,y,z); m.rotation.x=HPI; return m; }
// 船体断面放样 (2026-09-22 两栖车重做批): secs = [[z, [[x,y]×N]] ...] 自艏至艉, 每断面点数一致且**逆时针**
//   (自 +z 看: 底右 → 沿右舷上行 → 甲板自右向左 → 沿左舷下行)。相邻断面同序号顶点连成四边形 ⇒ 一张连续曲面;
//   首尾各以凸多边形三角扇封口。**为什么必须是放样而不是多个 Box 拼**: 用户判词"散架"的几何本质就是
//   拼块外挂 —— 车体一旦是"一张面", 舷侧折角(浮力箱)/艏部收窄/甲板倒角都是面上的转折, 件与件之间就没有
//   "贴上去的板子"。法线用非索引几何 + computeVertexNormals ⇒ 面法线 (硬边), 与 Box 观感一致。
function nmLoft(parent,secs,mat,name){
const P=[],U=[];
const push=(p,u,v)=>{ P.push(p[0],p[1],p[2]); U.push(u,v); };
// 四边形 (a→b→c→d 环绕方向即外法线方向): 每面 UV 铺满 0..1 (与 BoxGeometry 同口径)
const quad=(a,b,c,d)=>{ push(a,0,0);push(b,1,0);push(c,1,1); push(a,0,0);push(c,1,1);push(d,0,1); };
for(let i=0;i<secs.length-1;i++){
const zA=secs[i][0], zB=secs[i+1][0], A=secs[i][1], B=secs[i+1][1], n=A.length;
for(let k=0;k<n;k++){
const k2=(k+1)%n;
quad([A[k][0],A[k][1],zA],[B[k][0],B[k][1],zB],[B[k2][0],B[k2][1],zB],[A[k2][0],A[k2][1],zA]);
}
}
const cap=(sec,flip)=>{ const z=sec[0], p=sec[1];
for(let k=1;k<p.length-1;k++){
if(flip){ push([p[0][0],p[0][1],z],0,0); push([p[k+1][0],p[k+1][1],z],1,0); push([p[k][0],p[k][1],z],0,1); }
else { push([p[0][0],p[0][1],z],0,0); push([p[k][0],p[k][1],z],1,0); push([p[k+1][0],p[k+1][1],z],0,1); }
} };
cap(secs[0],false); cap(secs[secs.length-1],true);   // 艏盖法线 +z / 艉盖 −z
const g=new THREE.BufferGeometry();
g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));
g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));
g.computeVertexNormals();
const m=new THREE.Mesh(g,mat); if(name) m.name=name; parent.add(m); return m;
}
// 三叶螺旋桨 (三片桨叶 + 桨毂, **合成一件几何**): 桨毂沿 z (与桨轴同心), 桨叶绕 z 均布 120° 并带桨距。
//   为什么合成一件: 网格预算 (四型 ≤44 件) 且桨叶必须与桨轴正体积相交 —— 单件几何的 AABB 含桨毂,
//   与桨轴 (细圆柱) 相交即成立; 桨叶厚度 0.06 < NM_JOINT ⇒ 归"薄片件" (自检按薄片豁免深度, 仍要求相交)。
//   ★顶点**逐点算**: 不用 BoxGeometry.applyMatrix4 / toNonIndexed —— 那两个方法在 dev 沙箱的最小几何桩里
//   没有, 一个纯视觉件不该把 15e 钉死在完整 three API 上 (旧写法会让 dev/_naval-selfcheck 整型回落到兜底盒)。
function nmPropHalfZ(r,t){                                   // 桨叶 AABB 的 z 半厚 (净空判据的输入, 单源)
const P=NM_PROP_PITCH;
return Math.max(0.16*r*Math.sin(P)+0.5*t*Math.cos(P),0.5*t*1.5);
}
function nmPropGeo(r,t){
const hub=Math.max(t*0.95,NM_JOINT*1.15);                 // 毂 ≥NM_JOINT: 毂↔桨轴的接合深度不受毂尺寸限制
const cp=Math.cos(NM_PROP_PITCH), sp=Math.sin(NM_PROP_PITCH);
const V=[],UV=[];
// 凸盒的 12 个三角形 (6 面 × 2): 传"本地半尺寸 + 逐点变换", 逐面按外法线环绕 (与 BoxGeometry 同口径)
function box(hx,hy,hz,xf){
const c=[];
for(let i=0;i<8;i++){
const sx=(i&4)?1:-1, sy=(i&2)?1:-1, sz=(i&1)?1:-1;
c.push(xf(sx*hx,sy*hy,sz*hz));
}
const F=[[0,2,3,1],[4,5,7,6],[0,4,6,2],[1,3,7,5],[0,1,5,4],[2,6,7,3]];
const Q=[[0,0],[1,0],[1,1],[0,1]];
for(const f of F){
// ★2026-09-26 修 (绕向): F 表这几组角序看着像"外法线环绕", 实际是**内翻**的 —— 以第一面 [0,2,3,1] 为例,
// 角 0/1/2/3 是 (−x,−y,−z)/(−x,−y,+z)/(−x,+y,−z)/(−x,+y,+z) 的编号顺序, 直接按 (0,2,3) 出的法线是 +x,
// 而这是 −x 面 ⇒ 每片桨叶 (毂+3 叶 = 4 个凸盒) 整件朝里。实测 (dev/probe-winding): 四片桨叶
// 符号体积 −0.0031~−0.0039、外向率 4.2% (24 面里仅 1 面朝外), 螺旋桨在光照下是"内面被点亮"的黑片。
// 修法: 保持 F 表不动, 逐面把三角形序反过来 (a,c,b) 与 (a,d,c), UV 跟着同一置换 —— 法线随即朝外。
V.push(c[f[0]],c[f[2]],c[f[1]], c[f[0]],c[f[3]],c[f[2]]);
UV.push(Q[0],Q[2],Q[1], Q[0],Q[3],Q[2]);
}
}
box(hub*0.5,hub*0.5,Math.max(t*0.75,hub*0.5),(x,y,z)=>[x,y,z]);            // 桨毂 (与桨轴同轴)
for(let k=0;k<3;k++){
const ca=Math.cos(k*TAU/3), sa=Math.sin(k*TAU/3), by=r*0.48;              // 桨叶中心半径
box(r*0.15,r*0.48,t*0.5,(x,y,z)=>{                                        // 先绕自身 y 轴桨距 → 抬到半径 → 绕 z 均布
	const px=x*cp+z*sp, pz=-x*sp+z*cp, py=y+by;
	return [px*ca-py*sa, px*sa+py*ca, pz];
});
}
const P3=new Float32Array(V.length*3), U2=new Float32Array(UV.length*2);
for(let i=0;i<V.length;i++){ P3[i*3]=V[i][0]; P3[i*3+1]=V[i][1]; P3[i*3+2]=V[i][2]; }
for(let i=0;i<UV.length;i++){ U2[i*2]=UV[i][0]; U2[i*2+1]=UV[i][1]; }
const out=new THREE.BufferGeometry();
out.setAttribute('position',new THREE.Float32BufferAttribute(P3,3));
out.setAttribute('uv',new THREE.Float32BufferAttribute(U2,2));
out.computeVertexNormals();
return out;
}
// 炮口节点: 挂在俯仰组/管枢轴上; grp 局部静止坐标由 navLocalize 统一补写 userData.nmLocal
function nmMuzzle(parent,name,x,y,z){
const o=new THREE.Object3D(); o.name='mz_'+name; o.position.set(x,y,z); parent.add(o);
o.userData.nm={name}; return o;
}
// 静止时(各 yaw/pitch=0)相对 grp 的坐标: 沿父链累加 position
function navLocalize(root,o){
let x=0,y=0,z=0,n=o;
while(n&&n!==root){ x+=n.position.x; y+=n.position.y; z+=n.position.z; n=n.parent; }
return V3(x,y,z);
}
// 队旗 (独立旗杆 + 旗面; nodes.flags = 旗面, 15d 可做飘动) —— **两栖车专用**:
//   2026-09-21 起艇的旗挂在桅横桁上 (不再往甲板插一根独立旗杆: 用户判词"各个部分连接不紧密")。
//   baseY = 旗杆脚下的甲板高 (两栖车 = 车体顶面 roof)。
function navBuildFlag(R,S,M,x,z,baseY){
const h=S.H*0.26, r=Math.max(0.025,S.W*0.012), y0=(baseY!==undefined)?baseY:S.roof;
// 2026-09-21B 连通性: 旧版旗杆脚**正好停在**车体顶面 (面贴合, 零体积相交) ⇒ 车体与旗分成两个连通块。
//   现在杆脚压进顶面 NM_DECK_EMBED (0.10) ⇒ 与车体盒正体积相交, "从任一网格可达任一网格"成立。
nmCyl(R.grp,r,r,h+NM_DECK_EMBED,6,M.dark,x,y0-NM_DECK_EMBED+(h+NM_DECK_EMBED)*0.5,z);
const f=nmBox(R.grp,S.W*0.15,h*0.30,0.02,M.flag,x+S.W*0.075,y0+h*0.80,z);
R.nodes.flags=f; return f;
}
// 螺旋桨 (3 段柱 = 三叶板) 的共用落位: nodes.propeller = 枢轴组, 15d 转它的 rotation.z
// (两栖车两支 / 艇两支; 每支 1 件 —— 三角板在三叶剪影与网格预算间取平衡)

// ══════════════════════════════════════════════════════════════════════
// 五、两栖车 (spec.kind='amph'): LVT(A)-1 / 特二式内火艇 カミ
//   ★2026-09-22 史实剪影重做批 (用户裁定: 旧版 LVT"散架" / カミ"棺材" ⇒ 史实剪影 + 一体化)
//   · LVT(A)-1（旧判词"散架"）：旧版浮力箱 = "贴在舷侧的 0.10 薄缘" + 艏/艉各一块**外挂**上翘唇板,
//     首上另铺一块斜板, 尾部四件悬在车后 —— 侧视就是"零件挂在车壳外面"。本轮四件事:
//     ① **浮力箱并入车体断面**: 断面在 yc 处外折到舷宽 wc ⇒ 浮箱 = 车体的舷侧折角, 不再是贴片;
//     ② 车体 = **一张断面放样曲面** (艏部收窄 + 船底上翘 = 跳板艏 / 方艉带艉门 / 甲板中央微凹);
//     ③ 行走机构改史实布局 (负重轮压在履带带条外侧可见 + 两端主动轮·诱导轮给带条封口);
//     ④ 下水线分色 (折角即分色线): 下体 M.tone / 上体 M.body = 史实 LVT 双色涂装。
//   · カミ（旧判词"棺材"）：旧版 = "方箱车体 + 前后两块与车体等高的大方浮筒" ⇒ 侧视就是一口箱子
//     插着两块板。本轮: 车体断面走**船形** (前倾艏柱 + 船底上收 + 收窄艉), 浮筒改**船形浮筒**
//     (艏艉柱收口), 内端咬进车体 0.20×筒长 + 连接卡扣压顶 ⇒ 是"挂上去的两个浮体", 不是"箱子"。
// ── 剪影分工 (自检"四型两两形状签名互异"断言仍要成立) ──
//   LVT  = 舷侧折角浮箱 + 跳板艏 + 外露负重轮 + 方艉艉门 + 前左 37mm 塔 + 双桨双舵
//   カミ = 船形车体 + 前后可拆船形浮筒(独立色+卡扣) + 中部 37mm 塔 + 双桨双舵
// ── 几何硬约束 (与全库同口径, 自检逐条断言) ──
//   ① 相接件体积重叠 ≥NM_JOINT(0.08); ② 整车单连通 (以"正体积相交"为边); ③ 炮塔 360° 扫掠净空
//   ≥NM_TUR_CLEAR_A(0.05); ④ 桨叶净空 ≥NM_TUR_CLEAR(0.10) 且与桨轴正体积相交; ⑤ 网格 ≤44; ⑥ 无外挂贴片。
// ══════════════════════════════════════════════════════════════════════
// 行走机构 (史实布局): 履带带条在下 (窄) / 负重轮压在带条外侧 (侧视可见) / 两端主动轮·诱导轮封口。
//   为什么旧版观感是"轮子吊在带子下面": 旧 NM_TRK_BOT=0.22 ⇒ 履带下缘只到 0.22×轮半径 (比轮底高 0.3m),
//   且履带带条比轮子还宽 (0.16 vs 0.16×1.12 的轮宽看起来一样) ⇒ 侧视只见一条黑带。本轮: 带条收窄到
//   0.090·hullW、负重轮宽 0.12·hullW、履带下缘 = 0.02×轮半径 (与轮底齐平) ⇒ "一排轮子压在履带上"。
function navBuildGear(R,S,M){
const g=R.grp;
const whR=S.whR, whW=S.whW, trkW=S.W*NM_TRK_RIBBON;
const trkBot=whR*NM_TRK_BOT, trkTop=S.bot+S.boxH*0.03;
const trkY=(trkBot+trkTop)*0.5, trkH=Math.max(trkTop-trkBot,whR*0.45);
const BL=S.bodyL;
const w0=-BL*(0.5-NM_WMARGIN), step=BL*(1-2*NM_WMARGIN)/Math.max(1,S.whN-1);
for(const sx of[-1,1]){
nmBox(g,trkW,trkH,BL*NM_TRK_L,M.dark,sx*S.trkSx,trkY,0).name='nmTrack';   // 履带带条 (窄于负重轮)
for(let i=0;i<S.whN;i++){                                                   // 负重轮 (压在带条外侧 ⇒ 侧视可见)
const lz=w0+i*step;
const wh=nmCyl(g,whR,whR,whW,10,M.dark,sx*S.trkSx,S.whY,lz);
wh.rotation.z=HPI;
wh.userData={sx:sx*S.trkSx,lz,vy:0,baseY:S.whY};
R.wheels.push(wh);
}
// 主动轮 (艏) / 诱导轮 (艉): 八棱鼓 ⇒ 侧视读作"驱动轮/张紧轮", 同时给履带带条两端封口
const spr=nmCyl(g,whR*NM_SPR_R,whR*NM_SPR_R,trkW*1.10,8,M.dark,sx*S.trkSx,S.whY,BL*NM_SPR_Z);
spr.rotation.z=HPI; spr.name='nmDriveWheel';
const idl=nmCyl(g,whR*NM_IDL_R,whR*NM_IDL_R,trkW*0.94,8,M.dark,sx*S.trkSx,S.whY-S.whR*0.08,-BL*NM_SPR_Z);
idl.rotation.z=HPI; idl.name='nmIdlerWheel';
}
}
// 断面放样表 → 世界坐标断面 (nmLoft 的输入)。宽 × hullW/2, 高 × boxH 自 bot 起算; 8 点逆时针。
//   inset / ycLift 只给"下水线下体"用 (内收 0.01m + 上缘抬 0.08m ⇒ 与下体在折角带内正体积相交)。
// part='lower' = 底→折角 (下水线以下) / 'upper' = 折角→甲板。**两片共享折角那两条棱** (同一条折线, 各自
//   成面) ⇒ 既不重叠 (不会 z-fighting) 也不留缺口; 且没有"内缩+上抬"的偏移台阶 (旧写法在艏端断面缩得
//   很小时两片互相穿插, 侧视能看到一个豁口 —— 已废)。两片都是 4/6 点断面, 点序仍为逆时针。
function nmAmphSecs(S,P,part){
const hw=S.W*0.5, bot=S.bot, boxH=S.boxH, out=[];
for(const st of P.st){
const z=S.L*P.bl*(0.5-st[0]);                        // t: 0=艏 1=艉; +z 为艏 (车体长度 = P.bl×总长)
const wb=st[1]*hw, wc=st[3]*hw, wd=st[6]*hw;
const yb=bot+boxH*st[2], yc=bot+boxH*st[4], yt=bot+boxH*st[5], ytp=bot+boxH*st[7];
out.push([z,(part==='lower')
?[[wb,yb],[wc,yc],[-wc,yc],[-wb,yb]]
:[[wc,yc],[wc,yt],[wd,ytp],[-wd,ytp],[-wc,yt],[-wc,yc]]]);
}
return out;
}
// 车体: **一张连续曲面** (nmLoft)。折角外缘 = 浮力箱舷宽, 甲板中央 (wd) 略窄于折角 ⇒ 甲板自带倒角边。
//   bodyL 与 hullL 的区别见 navSpec: カミ 的总长含前后浮筒, 车体 = 0.64 倍 —— 艉架/桨/舵/旗杆
//   一律挂在**车体**上 (挂到总长去 = 零件悬在车体之后)。
function navBuildHullBox(R,S,M){
const g=R.grp, P=NM_AMPH[S.shape]||NM_AMPH.lvt;
nmLoft(g,nmAmphSecs(S,P,'upper'),M.body,'nmHullBox');                    // 上体 (折角→甲板; 高口径量测基准件)
nmLoft(g,nmAmphSecs(S,P,'lower'),M.tone).name='nmHullLower'; // 下体 (底→折角上收)
// 方艉艉门 (LVT 的艉跳板): 突出艉面 0.03、咬进车体 0.09 ⇒ 读作"门"而非贴片。位置在艉面 y 中部,
//   桨盘在 y≈0.2~0.5 且 z 更靠后 (下方靠后) ⇒ 与桨叶净空判据无涉 (AABB 上 y 向已分离)。
if(P.door){
nmBox(g,S.W*P.door.w,S.boxH*P.door.h,NM_PLATE*1.2,M.tone,0,S.bot+S.boxH*P.door.y,-S.L*P.bl*0.5+NM_JOINT*0.25).name='nmSternDoor';
}
return {sternZ:-S.bodyL*0.5, bowZ:S.bodyL*0.5, deckY:S.roof};   // 艉端面按**车体长** (カミ 的总长含浮筒)
}
// カミ 可拆卸浮筒 (前后各一): 断面放样 —— 艏/艉柱收口 + 舯部等宽; 内端咬进车体 NM_PONT_EMBED×筒长;
//   顶面由**连接卡扣**压住并咬进车体甲板侧 ⇒ 车体→卡扣→浮筒是一条实体积链 (自检的"单连通体"判据)。
//   纵向: 浮筒外端正好落在 hullL/2 —— **总长 = spec.hullL 是含浮筒的全长** (史实 Ka-Mi 7.42m 即含浮筒;
//   不带浮筒的车体只有 4.8m)。内端 = hullL/2 − 筒长, 与车体端面 (= P.bl×hullL/2) 重叠 NM_PONT_EMBED×筒长。
function navBuildPontoon(R,S,M){
const g=R.grp, P=NM_AMPH.kami, L=S.L, W=S.W, boxH=S.boxH;
const ptL=L*NM_PONT_L, pln=ptL*(1+NM_PONT_EMBED);        // 实际筒长 = 设计筒长 + 套住车体端部的那一段
const pH=boxH*NM_PONT_H, pW=W*P.pw;
// 安装高 = max(筒底下限, 桨盘顶 + NM_PONTHI) —— 桨盘顶由桨参数现算 (单源), 使'浮筒不切螺旋桨'构造性成立
const propR2=W*NM_PROP_R;
const propY2=Math.max(S.draft0*NM_GRD*1.35,propR2*NM_PROP_HMIN);
const y0=Math.max(S.bot+boxH*0.03,propY2+propR2+NM_PONTHI), y1=y0+pH;
// 竖向位置由 NM_PONTHI 定: 筒底必须高过桨盘顶 (桨就在艉浮筒的正下方) —— 自检的桨叶净空判据会核对这一点。
for(const sz of[1,-1]){
// 浮筒纵向站位 [t(0=外端 1=内端), w(×筒宽/2), yb(底高 ×筒高)] —— 船形: 外端收成尖艏并抬头 (前两站 = 艏柱收口,
//   取代旧版"方块 + 一块斜板"的拼法); 舯部 4 站渐宽; 内端 (套接段) 全宽平底, 埋进车体端部
//   ⇒ 与车体正体积咬合 = 自检"单连通体"判据的一条边。
const PS=[[0.00,0.14,0.66],[0.09,0.40,0.44],[0.20,0.70,0.24],[0.36,0.92,0.08],[0.58,1.00,0.00],[1.00,1.00,0.00]];
const secs=PS.map(ps=>{
// 2026-09-25 修: 站位参数 ps[0] 已是 0~1 归一值, 旧版又乘了一次 sp=pln/ptL ⇒ 筒长变 1.44×ptL
// (比设计的 pln 长 20%), 内端落到 hullL/2−1.44×ptL 而不是注释写的 hullL/2−筒长, 每端多吞 0.67m 车体、
// 连接卡扣还探出艉端面。这里按本块注释的口径直接写 pln*ps[0] (t 已不再需要)。
const t=ps[0], w=pW*0.5*ps[1], yb=y0+pH*ps[2], z=sz*(L*0.5-pln*t);
return [z,[[w,yb],[w,y1-pH*0.14],[w*0.82,y1],[-w*0.82,y1],[-w,y1-pH*0.14],[-w,yb]]];
});
// ★2026-09-26 修 (绕向): 断面串必须**沿 −z 方向**排列 —— nmLoft 的四边形环绕 (A[k]→B[k]→B[k2]→A[k2])
//   据此定外法线; sz=+1 一侧 z=L/2−pln·t 递减 ✓, 而 sz=−1 一侧 z 是递增的 ⇒ 那半个浮筒整体内翻。
//   实测 (dev/probe-winding): 一件 nmPontoon 符号体积 −6.25、外向率 0% (光照下是个黑筒)。
//   这里把该侧的断面串直接倒过来, 两侧就都满足契约 (secs[0] 恒在 +z 侧, 艏/艉盖法线也随之正确)。
if(sz<0) secs.reverse();
const G=new THREE.Group(); g.add(G);
nmLoft(G,secs,M.pontoon,'nmPontoon');
// 连接卡扣: 跨在浮筒顶面、内端咬进车体甲板侧 (史实可拆卸浮筒的接合件; 同时把"两件是一体"写在几何上)
nmBox(G,W*NM_PONT_LATCH,NM_PLATE*1.7,ptL*0.34,M.steel,0,y1-NM_PLATE*0.30,
      sz*(L*0.5-pln*0.72)).name='nmPontLatch';
R.nodes.pontoon.push(G);
}
}
// 炮塔: 按 spec.tur 走档 (smallRound 铸造圆 / hex 六角) + 炮盾 + 炮管 + 车长塔 + 同轴机枪
//   2026-09-21 连接性修补 (Lead 裁决⑤, **不动任何 spec 尺寸**) 全部保留; 母面 = 甲板中央面 (S.roof),
//   断面表在舷侧段保持 ytop=1.00 ⇒ 炮塔座圈正好落在平整的甲板中央面上 (与旧版同高, 不改命中/相机)。
function navBuildTurret(R,S,M){
const t=S.tur; if(!t) return null;
const gx=(S.shape==='lvt')?-S.W*0.13:0;                           // LVT 史实炮塔位: 车体前部偏左
const R2=Math.max(t.w,t.l)/2, h=t.h, roofTop=h*1.08;
nmCyl(R.grp,R2*NM_RING_FIT*0.94,R2*NM_RING_FIT,NM_AMPH_RING,14,M.tone,gx,S.roof-NM_DECK_EMBED+NM_AMPH_RING*0.5,t.ringZ).name='nmAmphRing';
const G=new THREE.Group();
G.position.set(gx,S.roof+NM_SEAT*2,t.ringZ);                      // 塔底 = 甲板面 + 0.02, 与座圈互嵌 0.10
R.grp.add(G); R.turretG=G; R.mainG=G;
const matT=(S.paint==='plain')?M.body:M.tone;
if(t.shape==='hex'){
const hx=nmCyl(G,R2*0.86,R2,h,6,matT,0,h*0.5,0); hx.rotation.y=Math.PI/6; hx.name='nmTurretBody';
}else{
nmCyl(G,R2*0.84,R2,h*0.88,14,matT,0,h*0.44,0).name='nmTurretBody';
nmCyl(G,R2*0.58,R2*0.84,h*0.36,14,matT,0,h*0.90,0).name='nmTurretRoof';
}
const cupE=NM_JOINT+NM_SEAT, cupH=Math.max(S.cupH,NM_PLATE*0.6);
nmCyl(G,R2*0.11,R2*0.13,cupH+cupE,10,M.hatch,t.w*0.10,roofTop-cupE+(cupH+cupE)*0.5,-t.l*0.16).name='nmHatch';
const shW=Math.max(NM_PLATE*6.2,t.w*0.40);
const mgX=Math.max(0.05,shW*0.5-NM_PLATE*0.5);
const pz=Math.max(t.l/2-NM_PLATE,R2*0.90);
R.pitchG=new THREE.Group(); R.pitchG.position.set(0,h*0.45,pz); G.add(R.pitchG);
nmBox(R.pitchG,shW,Math.max(NM_PLATE*4.6,h*0.78),NM_PLATE*4.4,matT,0,0,0).name='nmMantlet';
nmTube(R.pitchG,S.barR*0.78,S.barR,S.barrelL,8,M.dark,0,0.02,S.barrelL*0.5);
if(S.brake){ nmTube(R.pitchG,S.barR*1.45,S.barR*1.45,S.barrelL*0.20,8,M.dark,0,0.02,S.barrelL*0.90); }
R.muzzles.main=nmMuzzle(R.pitchG,'main',0,0.02,S.barrelL+NM_PLATE*0.6);
if(S.raw&&S.raw.mg){
const mgL=S.L*NM_MG_L;
nmTube(R.pitchG,0.045,0.05,mgL,6,M.dark,mgX,-0.05,mgL*0.78);
R.muzzles.mg=nmMuzzle(R.pitchG,'mg',mgX,-0.05,mgL*0.78+mgL*0.5+NM_PLATE*0.4);
}
return G;
}
// 两栖车总装
function navBuildAmph(spec,S,M,R){
const HB=navBuildHullBox(R,S,M);
navBuildGear(R,S,M);
if(S.float==='pontoon'||S.pontoon>0) navBuildPontoon(R,S,M);
navBuildTurret(R,S,M);
navBuildAmphTail(R,S,M,HB);
// 旗杆落位 (2026-09-22): 浮筒型 (カミ) 挂**艉浮筒顶面** —— 挂在车尾甲板会伸进炮塔 360° 扫掠圈
//   (カミ 的环座在中部 ringZ=0.55, 炮管后伸 2.0m 绕塔轴划出的圆半径 2.8m > 车体半长 2.2m ⇒ 车尾没有任何
//    位置躲得开); 浮筒在车体之外、且顶面低于炮管下缘 ⇒ 既不与炮管相撞, 也更像史实那支浮筒旗杆。
if(S.float==='pontoon'||S.pontoon>0){
const ptL=S.L*NM_PONT_L, pln=ptL*(1+NM_PONT_EMBED), pH=S.boxH*NM_PONT_H;
const propR3=S.W*NM_PROP_R;
const dT=Math.max(S.draft0*NM_GRD*1.35,propR3*NM_PROP_HMIN)+propR3;
const y0=Math.max(S.bot+S.boxH*0.03,dT+NM_PONTHI)+pH;
navBuildFlag(R,S,M,-S.W*0.30,-(S.L*0.5-pln*0.52),y0);
}else navBuildFlag(R,S,M,-S.W*0.42,-S.bodyL*0.40);
}
// 尾部总成: 开放艉架 (看得见桨) + 双桨 + **每舷一片舵** + 舵间横梁。
//   旧版是一块跨中的大舵板 ⇒ 侧视像"多出一片尾鳍"; 本轮按史实改双舵 (各在桨后) + 横梁连成总成。
//   纵向三条线 (全部从单源常量派生, 谁改常量这里自动跟随):
//     艉架后缘 = 桨盘z − (NM_PROP_CLEAR_A + 桨叶z半厚)  ⇒ 桨叶↔艉架净空 = NM_PROP_CLEAR_A
//     桨盘 z   = 车体尾端 (车身长的一半) − NM_PROP_AFT
//     舵前缘   = 桨盘z − (NM_RUD_AFT + 桨叶z半厚)        ⇒ 桨叶↔舵净空 = NM_RUD_AFT
function navBuildAmphTail(R,S,M,HB){
const g=R.grp, W=S.W;
const propR=W*NM_PROP_R, shaftR=W*NM_SHAFT_R, xn=W*NM_PROP_X;
const propY=Math.max(S.draft0*NM_GRD*1.35,propR*NM_PROP_HMIN);
const hz=nmPropHalfZ(propR,NM_PROP_T);
const propZ=HB.sternZ-S.bodyL*NM_PROP_AFT;
const strutZ1=HB.sternZ+NM_DECK_EMBED, strutZ0=propZ+NM_PROP_CLEAR_A+hz;   // +z 为艏 ⇒ 艉架后缘落在桨盘之前
// 上端必须伸到**尾端底面之上**: 该面高 = bot + boxH×尾站底高 (NM_AMPH 表的最后一站), 再多咬 0.12
const stLast=(NM_AMPH[S.shape]||NM_AMPH.lvt).st; const sternBotY=S.bot+S.boxH*stLast[stLast.length-1][2];
const strutY0=propY-shaftR*1.6, strutY1=sternBotY+NM_JOINT*1.5;
for(const sx of[-1,1])                                    // 艉架: 上端咬进车体尾段, 下端包住桨轴
nmBox(g,W*NM_SKEG_W,strutY1-strutY0,strutZ1-strutZ0,M.dark,sx*xn,(strutY0+strutY1)*0.5,(strutZ0+strutZ1)*0.5).name='nmShaftStrut';
// 桨轴: 前端埋进艉架, 尾端**穿过舵**并探出 NM_JOINT ⇒ 舵-轴是体积咬合 (不再是悬在轴后的一块板)
const rudZ=propZ-NM_RUD_AFT-hz-NM_RUD_T*0.5;             // 舵心 z (前缘 = 桨叶后缘 − NM_RUD_AFT)
const shaftZ0=rudZ-NM_RUD_T*0.5, shaftZ1=strutZ1;   // 尾端齐舵后缘: 轴穿过舵身 ⇒ 咬合 = 舵厚, 不再多探
for(const sx of[-1,1]){
const sh=nmCyl(g,shaftR,shaftR,shaftZ1-shaftZ0,6,M.dark,sx*xn,propY,(shaftZ0+shaftZ1)*0.5);
sh.rotation.x=HPI; sh.name='nmPropShaft';
}
const PG=new THREE.Group(); PG.position.set(0,propY,propZ); PG.name='nmPropG'; g.add(PG);
// 2026-09-25 修: 桨叶要挂在自己那根桨轴的枢轴上 —— 15d 驱动的是 nodes.propeller 的 rotation.z,
// 而本组原点落在**车体中线**上。旧版把桨叶直接摆成 (±xn,0,0) 的子件 ⇒ 转的是"整组绕中线":
// 桨盘以 xn 为半径在横剖面里划圈 (LVT 半径 ≈0.55m), 一开动就周期性扫进车体、扫出船底。
// 每舷加一个原点落在自己轴心的子枢轴 (桨叶再挂进去) ⇒ 世界 AABB 与旧版逐点相同 (零几何漂移),
// 只有转轴变了; 自检按名字收件 (nmPropBlade/nmPropShaft) 也照旧收得到。
for(const sx of[-1,1]){
const pv=new THREE.Group(); pv.position.set(sx*xn,0,0); pv.name='nmPropPivot';
const pm=new THREE.Mesh(nmPropGeo(propR,NM_PROP_T),M.rust);
pm.name='nmPropBlade'; pv.add(pm);
PG.add(pv);
}
R.nodes.propeller=PG;
// 舵 ×2 (各自在桨后 NM_RUD_AFT) + 横梁; 15d 转 nodes.rudder 驱动口不变 —— 逐片 nmRudderPivot 子枢轴偏转。
//   舵前缘正好压住桨轴尾端 (轴从舵中间穿出 ⇒ 舵-轴体积咬合 ≥NM_JOINT), 不再需要艉鳍那类额外连接件。
const RG=new THREE.Group(); RG.name='nmRudderG';
RG.position.set(0,propY+S.boxH*NM_RUD_CZ,rudZ);
g.add(RG);
// ★2026-11-01 修: 每片舵挂"原点落在自己舵杆上"的 nmRudderPivot 子枢轴 (照抄上面 nmPropPivot 修法) ——
//   旧式两片舵直接挂在艉中线上的 RG 里, 转整组 = 两片舵**绕中线公转**, 满舵 0.5rad 时一舷前掠
//   xn·sin(0.5)≈0.24m 越过自定 NM_RUD_AFT 桨前净空、AABB 扫进桨盘 (与 2026-09-25 桨枢轴同族病, 舵漏修)。
for(const sx of[-1,1]){
const pv=new THREE.Group(); pv.position.set(sx*xn,0,0); pv.name='nmRudderPivot';
nmBox(pv,W*NM_RUDW_A,S.boxH*NM_RUDH_A,NM_RUD_T,M.dark,0,0,0).name='nmRudder';
RG.add(pv);
}
nmBox(RG,xn*2-NM_PLATE*0.3,NM_RUD_T*0.9,NM_RUD_T*0.9,M.dark,0,NM_RUD_T*0.25,0).name='nmRudderBar';
R.nodes.rudder=RG;
}
// ══════════════════════════════════════════════════════════════════════
// 六、艇 (spec.kind='boat'): PT 艇(Elco 80') / 九三式鱼雷艇 —— 2026-09-21 炮艇重做批
//   用户判词: "各个部分连接不紧密, 臃肿且奇丑无比" + "我需要的是小炮艇, 像海上的坦克,
//   现在却只有小得可怜的还有视角锁定的炮塔" ⇒ 本轮四件事:
//   ① 滑行艇体: 深V窄底 + 收窄干舷 (主甲板压到 bot+0.62·hullH, 原 0.75) + 三段舷弧 (艏 0.70/舯 0.62/艉 0.66)
//      —— 舷弧用**盒件高度差分档 + z 向搭接**表达 (用户口径"分段高度差", 曲面一律不用)
//   ② 大型封闭回转炮塔: 塔体落艏甲板的回转环座上, 走 spec.tur.shape 离散档 (bigRound/smallRound)。
//      15d 的 turretG 路径本就能转满 360° (this.turretG.rotation.y=this.turretYaw) ⇒ 本文件只需保证
//      "转一圈扫不到任何静态件" (甲板/舰桥/桅桁/鱼雷管全在扫掠圈外)
//   ③ 舰桥/桅桁/舷侧装备连成一体: 舰桥压进中甲板 0.10 · 桅杆压进甲板 0.10 且与横桁互嵌 0.09 ·
//      舷缘栏板通长压进干舷 (外缘正好 = hullW/2 ⇒ 艇宽基准也由它给出)
//   ④ 鱼雷管保留但"贴合艇体": 管身搁在舷缘栏板顶面 (y 向重叠 = 栏板高 0.20), 管心收进 hullW/2
//      (原版 px=0.26~0.48×W 会把管外挂到艇宽之外) —— 组序/朝向仍严格服从 15d fireTorpedo 的索引契约。
//   关节硬规约 (对治"连接不紧密"): 相接件体积重叠 ≥ NM_JOINT(0.08); 浮件判据 = 与任何件均无体积重叠
//   且最近距离 >0.02。量化取证: dev/_naval-model-selfcheck.js (真 three.js r152, 逐件扫码)。
// ══════════════════════════════════════════════════════════════════════
// 艇型档 (键 = spec.shape; 表里只有**无量纲比值**) —— 载具尺寸一律读 spec (数据单源纪律)
//   uwW 水下窄底宽(×hullW) · freeW 舷宽基数(×hullW) · bowR 艏楔三角柱半径(×hullL, 底面宽 1.732r)
//   zMF/zMS 前|中 / 中|后 分段边界(×hullL) · freeR 艉板前缘(−hullL×该值)
//   wF/wM/wS 三段舷宽(×hullW×freeW) · dkF/dkM/dkS 三段甲板高(bot + hullH×该值 ⇒ 差即舷弧)
//   house*/mast*/yard* 舰桥与桅桁(×hullW/×hullH/×hullL) · exh* 舷侧消音排气管 · funnel 烟囱档
//   tube = 鱼雷管组 [z(×hullL), 出管朝向, 每侧管数], **组序 = [艏组, 艉组]** —— 必须与 15d
//          fireTorpedo 的索引契约一致 (tubes[0,1]=艏对左·右 / [2,3]=艉对左·右; 2 管型只用到 [0,1])
const NM_BOAT={
 // 2026-09-21B (用户"更短 + 炮塔更明显"): 两型的 dkF/dkM/dkS 各压低一档 (pt 0.700/0.620/0.660→0.660/0.620/0.650;
 //   九三式 0.730/0.650/0.690→0.640/0.600/0.630) —— 大塔 (h 0.88→1.05 / 0.75→0.90) 要占高度, 而整车高
 //   红线是 hullH±15% (pt 2.6⇒2.99 / 九三式 2.2⇒2.53); 干舷压低后仍是"深V滑行艇", 且塔更显眼。
 //   houseZ 再后移一档 (pt 0.035→0.010): 舰桥退到回转圈之外 ⇒ 塔 360° 净空由 0.02m 升到 ≥0.12m。
 pt:{ uwW:0.62, freeW:0.97, bowR:0.141, zMF:0.108, zMS:-0.150, freeR:0.494,   // Elco 80'
      wF:0.980, wM:1.000, wS:0.980, dkF:0.660, dkM:0.620, dkS:0.650,
      houseW:0.460, houseH:0.200, houseL:0.115, houseZ:0.010,
      mastH:0.220, mastZ:-0.090, yardW:0.320,
      tube:[[-0.041,1,1],[-0.352,-1,1]],                                     // 4 管: 艏对前向 / 艉对后向
      exhW:0.060, exhH:0.140, exhL:0.200, exhZ:-0.140, funnel:0 },
 gyorai:{ uwW:0.58, freeW:0.95, bowR:0.150, zMF:0.110, zMS:-0.160, freeR:0.494, // 九三式鱼雷艇
      wF:0.980, wM:1.000, wS:0.980, dkF:0.640, dkM:0.600, dkS:0.630,
      // houseH 0.22→0.18 (上一批) 保持: 舰桥顶 yM+0.18·hullH 落后于炮管扫掠面 0.17m (自检扫掠断言)
      houseW:0.420, houseH:0.180, houseL:0.115, houseZ:0.010,
      mastH:0.190, mastZ:-0.100, yardW:0.300,
      tube:[[-0.198,1,1]],                                                   // 2 管: 舷侧前向
      exhW:0, exhH:0, exhL:0, exhZ:0, funnel:1 },
};
// 炮塔档 (键 = spec.tur.shape): bigRound = 大型封闭铸造圆塔 —— **两型艇都用它** (PT 全尺寸 / 九三式按艇体缩一档,
//   尺寸全在 spec.tur, 本表只管比例); smallRound = 轻装甲圆塔 (2026-09-21 Lead 裁决④ 后**暂无实装型**, 留档给
//   日后的小型艇 —— 与两栖车 navBuildTurret 的 hex 档同例, 自检里有一支"留档档仍可建塔"的对照组)。
//   **与两栖车 navBuildTurret 刻意分档**: 两栖车塔是 37mm 级小塔、落在车体顶面无净空约束;
//   艇塔落艏甲板环座且必须 360° 净空 —— 合并会让两边互相牵制。
//   bodyR/bodyRt 塔体下/上半径(×塔半径) · bodyTop 塔体占塔高比 · roofR 顶盖半径(×塔半径) · roofH 顶盖占塔高比
//   pivotY 炮耳(俯仰轴)占塔高比 —— 0.50 让炮管轴线高于舰桥顶; 低矮塔若炮耳在腰上, 炮管扫掠圈会**擦到舰桥顶棱**
//          (九三式塔 0.60 高时实测 y 向只剩 0.024m ⇒ 炮管扫到桥顶, 故本轮同时把该型舰桥压低 0.04·hullH 并后移)
//   bustle* 尾舱 (宽×tw / 高×th / 深×tl / 后移×tl/2) —— "又大又重"最好认的剪影件
const NM_TURT={
 bigRound:{bodyR:0.94, bodyRt:0.80, bodyTop:0.86, roofR:0.82, roofH:0.14, pivotY:0.50,
           bustleW:0.62, bustleH:0.52, bustleD:0.32, bustleZ:0.92},
 smallRound:{bodyR:0.88, bodyRt:0.76, bodyTop:0.84, roofR:0.76, roofH:0.16, pivotY:0.62,
           bustleW:0.56, bustleH:0.46, bustleD:0.28, bustleZ:0.90},
};
// 艇炮塔总成: 回转环座(静态) + 塔体/顶盖/尾舱/观瞄镜(turretG) + 炮盾/炮管(pitchG)
//   返回 {tY0,tH,top,sightY,r,yHit0} —— 供 navBuildBoat/入口写 dims/turretHit (不另算第二套数)
function navBoatTurret(R,S,M,yF){
const g=R.grp;
const t=S.tur, TB=(t&&t.shape==='bigRound')?NM_TURT.bigRound:NM_TURT.smallRound;
// spec.tur 缺失时的兜底: 塔径按艇宽 / 塔高按艇高 / 环座按艇长派生 —— 仍不写死任何载具尺寸
const tw=t?t.w:S.W*0.40, tl=t?t.l:S.W*0.44, tH=t?t.h:S.H*0.34, ringZ=t?t.ringZ:S.L*0.26;
const tR=Math.max(tw,tl)*0.5, tY0=yF+NM_TUR_LIFT, tTop=tY0+tH, mat=(S.paint==='plain')?M.body:M.tone;
// ① 回转环座 (静态件; 自检扫掠集里**唯一豁免** = 回转副的静态半环, 与塔体设计互嵌 ≥0.09):
//    2026-09-21B 抬高到 NM_TUR_RING(0.34): 塔底离艏甲板/艏楔 NM_TUR_LIFT(0.12) ⇒ 360° 净空红线 0.10 有 0.12 实余量
//    (旧版塔底只离艏甲板 0.02 ⇒ 实测最小净空 0.020m, 这就是"炮塔不敢做大"的直接原因)。
//    中心抬 NM_SEAT ⇒ 下 0.09 压进艏甲板 / 上 0.25 露出, 甲板→环座(0.09)→塔体(0.13) 是一条实体积链。
nmCyl(g,tR*1.06,tR*1.06,NM_TUR_RING,16,M.tone,0,yF+NM_TUR_RING*0.5-NM_DECK_EMBED+NM_SEAT,ringZ).name='nmTurretRing';
// ② 塔体 (下大上小的铸造体) + 顶盖 (压进塔体 NM_JOINT+NM_SEAT, 不在 0.08 边界上判): 回转组原点 = (0, 塔底, 环座心)
//    ⇒ dims.turretY 直接读 turretG.position.y; 15d 只转 turretG.rotation.y 一条路径 (艇无需 mainG 分支)
const G=new THREE.Group(); G.position.set(0,tY0,ringZ); g.add(G);
R.turretG=G; R.mainG=G;
nmCyl(G,tR*TB.bodyRt,tR*TB.bodyR,tH*TB.bodyTop,16,mat,0,tH*TB.bodyTop*0.5,0).name='nmTurretBody';
const roofH=tH*(1-TB.bodyTop)+NM_JOINT+NM_SEAT;
nmCyl(G,tR*TB.roofR,tR*TB.roofR*1.02,roofH,16,mat,0,tH*TB.bodyTop-(NM_JOINT+NM_SEAT)+roofH*0.5,0).name='nmTurretRoof';
// ③ 尾舱 (塔后储物/配重; 与塔体 AABB 互嵌 ≥0.16·tl) —— 塔体收窄后仍要"重"的观感
nmBox(G,tw*TB.bustleW,tH*TB.bustleH,tl*TB.bustleD,mat,0,tH*0.34,-tl*0.5*TB.bustleZ).name='nmBustle';
// ③b 舷号/队标喷涂板 ×2 (TEX.stencil, §5"塔侧加队标/舷号"): 贴在塔体两舷弧面上, 内缘埋进塔体;
//     外缘 0.88·tR + 半厚 ≤ 尾舱角 (R_body 的主项) ⇒ 不改变回转扫掠包络
for(const sx of[-1,1])
nmBox(G,NM_PLATE*0.8,tH*0.26,tl*0.30,M.mark,sx*tR*0.88,tH*0.46,0).name='nmHullMark';
// ③c 塔顶舱盖 (辨识细节): 压进顶盖 0.14, 只探出 0.02 ⇒ 不抬高整车高 (炮塔顶面 = 高度包络的基准)
nmCyl(G,tR*TB.roofR*0.30,tR*TB.roofR*0.34,NM_PLATE*1.6,10,M.hatch,tw*0.18,tTop-tY0-NM_PLATE*0.6,tl*0.10).name='nmTurretHatch';
// ④ 观瞄镜座 (炮手镜的实体件): 镜心 y = deckY + spec.sightH; spec 未给则退到塔顶面 (几何自洽)
//    ⇒ 镜座底 = 镜心 −0.10 = 顶盖面下 0.10 (嵌合 NM_DECK_EMBED); nodes.sight 就是镜心本身 (WS2 机位)
//    2026-09-21B: 塔高 (pt 0.88→1.05 / 九三式 0.75→0.90) 与塔底 (+0.12) 都抬了 ⇒ spec.sightH 同步抬到
//    "镜心落在新塔顶面" (pt 1.25 / 九三式 1.09); 自检断言镜座压进顶盖 ≥NM_JOINT 会当场核对这个自洽性。
const sightY=(S.sightH!==null&&S.sightH!==undefined)?S.deckY+S.sightH:tTop;
const sX=tw*0.26, sZ=tl*0.20;
nmCyl(G,NM_SIGHT_R*0.90,NM_SIGHT_R,0.16,10,mat,sX,sightY-tY0-0.02,sZ).name='nmSight';
const so=new THREE.Object3D(); so.name='nmSightEye'; so.position.set(sX,sightY-tY0,sZ+NM_SIGHT_R); G.add(so);
R.nodes.sight=so;
// ⑤ 炮盾 + 炮管 (pitchG = barrelPivot): 炮盾后缘咬进塔体 (AABB 重叠 ≥0.12), 炮口锚点挂在 pitchG 上
//    俯仰轴高 = tH×TB.pivotY (档位值见 NM_TURT 注释: 小塔抬高炮耳换取舰桥顶净空)
R.pitchG=new THREE.Group();
R.pitchG.position.set(0,tH*TB.pivotY,Math.max(tl*0.5-NM_PLATE,tR*0.92));
G.add(R.pitchG);
nmBox(R.pitchG,tw*0.52,tH*0.52,NM_PLATE*2.4,mat,0,0.02,0).name='nmMantlet';
R.nodes.barrel=nmTube(R.pitchG,S.barR*0.78,S.barR,S.barrelL,8,M.dark,0,0.02,S.barrelL*0.5);
R.nodes.barrel.name='nmBarrel';
// ⑤b 抽气装置 (bore evacuator): 炮管 0.55 处一圈鼓包 —— §5"炮管加炮口制退器/抽气装置", 让炮管一眼是"炮"。
//     它的半径 > barR ⇒ 会略微加大炮管扫掠盒的 y 半高 (自检扫掠用的就是这支盒), 舰桥顶余量已按它算过。
nmTube(R.pitchG,S.barR*1.70,S.barR*1.70,S.barrelL*0.22,10,M.dark,0,0.02,S.barrelL*0.55).name='nmEvacuator';
if(S.brake){ nmTube(R.pitchG,S.barR*1.45,S.barR*1.45,S.barrelL*0.20,8,M.dark,0,0.02,S.barrelL*0.90).name='nmBrake'; }
R.muzzles.main=nmMuzzle(R.pitchG,'main',0,0.02,S.barrelL+NM_PLATE*0.6);
return {tY0,tH,top:tTop,sightY,r:tR*1.06,yHit0:yF-NM_DECK_EMBED,ringZ};
}
function navBuildBoat(spec,S,M,R){
const g=R.grp, L=S.L, W=S.W, H=S.H, P=NM_BOAT[S.shape]||NM_BOAT.pt;
const bot=S.bot, wl=S.wl;
// ── 纵向/垂向分段 (spec 尺寸 × 档位比值; 无一处写死载具尺寸) ──
const zMF=L*P.zMF, zMS=L*P.zMS;
const freeFront=L*0.5-L*P.bowR*1.5, freeRear=-L*P.freeR;        // 艏楔背面 / 艉板前缘
const wF=W*P.freeW*P.wF, wM=W*P.freeW*P.wM, wS=W*P.freeW*P.wS;
const yF=bot+H*P.dkF, yM=S.deckY, yS=bot+H*P.dkS;              // 艏/舯/艉甲板高 ⇒ 舷弧 = 三档高度差
// ① 水下窄底 (深V; 顶面埋进干舷 NM_DECK_EMBED —— 原版停在水线 = 面贴合, 浮件扫描会命中)
nmBox(g,W*P.uwW,wl+NM_DECK_EMBED-bot,freeFront-freeRear,M.wet,0,(bot+wl+NM_DECK_EMBED)*0.5,(freeFront+freeRear)*0.5);
// ② 干舷三段 (相邻段 z 向搭接 NM_SHEER_STEP; 段顶高差 = 舷弧台阶)
const fbSeg=[[freeRear,zMS+NM_SHEER_STEP,wS,yS],[zMS,zMF+NM_SHEER_STEP,wM,yM],[zMF,freeFront,wF,yF]];
for(const[a,b,w,y]of fbSeg) nmBox(g,w,y-wl,b-a,M.side,0,(wl+y)*0.5,(a+b)*0.5);
// ③ 尖艏 (3 段柱三角柱, 顶点朝 +z): 底面宽 1.732r ≈ 艏段舷宽 ⇒ 接缝无宽度台阶
const br=L*P.bowR;
nmCyl(g,br,br,yF-bot,3,M.body,0,(bot+yF)*0.5,L*0.5-br);
// ④ 连续甲板三段 (板厚 NM_PLATE: 每段压进本段干舷 0.10; 艏板前伸 0.15 咬进艏楔, 艉板后伸 0.02 咬进艉段)
const dkF0=zMF+0.02, dkM0=zMS+0.02, dkS0=freeRear-0.02, dkFF=freeFront+0.15;
nmBox(g,wF*1.008,NM_PLATE,dkFF-dkF0,M.deck,0,yF-NM_PLATE*0.5,(dkFF+dkF0)*0.5);
nmBox(g,wM*1.008,NM_PLATE,(zMF+NM_SHEER_STEP)-dkM0,M.deck,0,yM-NM_PLATE*0.5,(zMF+NM_SHEER_STEP+dkM0)*0.5);
nmBox(g,wS*1.008,NM_PLATE,(zMS+NM_SHEER_STEP)-dkS0,M.deck,0,yS-NM_PLATE*0.5,(zMS+NM_SHEER_STEP+dkS0)*0.5);
// ⑤ 宽艉板 (transom): 前缘咬进艉段干舷 0.09 (原版艉板与干舷之间有 0.14m 空隙 ⇒ 浮件)
const tpD=NM_PLATE*2.2;
nmBox(g,wS*1.002,yS-bot,tpD,M.body,0,(bot+yS)*0.5,freeRear-(tpD*0.5-0.09)).name='nmTransom';
// ⑥ 舷缘栏板 (通长左右各一): 压进干舷 x 向 ≥0.10, 外缘正好 = hullW/2 (艇宽基准件);
//    一件同时承担"舷侧装备连成一体"与鱼雷管托架 (原版那两条 0.5L 的舷侧管架由此省掉)
const railW=W*NM_RAILW_B, railX=W*0.5-railW*0.5, railY=yM+NM_RAILH_B*0.35, railZ0=-L*0.485, railZ1=L*0.27;
for(const sx of[-1,1]) nmBox(g,railW,NM_RAILH_B,railZ1-railZ0,M.tone,sx*railX,railY,(railZ0+railZ1)*0.5);
// ⑦ 舰桥 (压进中甲板 0.10) + 前挡风板 (压进舰桥 0.10) —— 与桅/横桁/甲板串成一体
const hW=W*P.houseW, hH=H*P.houseH, hL=L*P.houseL, hZ=L*P.houseZ, hTop=yM+hH;
nmBox(g,hW,hH+NM_DECK_EMBED,hL,M.tone,0,yM+(hH-NM_DECK_EMBED)*0.5,hZ);
nmBox(g,hW*0.94,NM_PLATE*1.6,NM_PLATE*1.3,M.tone,0,hTop-NM_PLATE*0.9,hZ+hL*0.5-NM_PLATE*0.6).rotation.x=-0.34;
// ⑧ 桅杆 (压进中甲板 0.10) + 横桁 (与桅杆互嵌 0.08) + 队旗 (挂横桁右半; 旗面 0.03 薄片 —— 豁免表内件)
const mZ=L*P.mastZ, mR=Math.max(0.045,W*0.010), mH=H*P.mastH, mTop=yM+mH, yw=W*P.yardW;
nmCyl(g,mR,mR,mH+NM_DECK_EMBED,6,M.dark,0,yM+(mH-NM_DECK_EMBED)*0.5,mZ);
nmBox(g,yw,NM_YARD_H,NM_YARD_H,M.dark,0,mTop-NM_YARD_H,mZ);
const fW=yw*0.30, fH=mH*0.42;
R.nodes.flags=nmBox(g,fW,fH,0.03,M.flag,yw*0.12+fW*0.5,mTop-NM_YARD_H*0.5-fH*0.5,mZ);
// ⑨ 动力/排气: PT 艇 = 舷侧消音排气管 (压进干舷, 外缘不越 hullW/2); 九三式 = 烟囱 (与舰桥互嵌 0.10)
if(P.funnel){
const fR=W*0.055, fH2=H*0.30, fZ=hZ-hL*0.5-fR+NM_DECK_EMBED;
nmCyl(g,fR*0.86,fR,fH2+NM_DECK_EMBED,8,M.rust,0,yM+(fH2-NM_DECK_EMBED)*0.5,fZ);
}else{
const eW=W*P.exhW, eH=H*P.exhH, eOut=Math.min(wM*0.5+NM_DECK_EMBED,W*0.5-NM_PLATE*0.1);
for(const sx of[-1,1]) nmBox(g,eW,eH,L*P.exhL,M.rust,sx*(eOut-eW*0.5),wl+eH*1.3,L*P.exhZ);
}
// ⑩ 大型回转炮塔 (环座/塔体/顶盖/尾舱/观瞄镜/炮盾/炮管) —— 本批主角
const T=navBoatTurret(R,S,M,yF);
R.boatTurret=T;
// ⑪ 副武器 (spec.secondary: PT 双联 .50 / 九三式无): 座圈落舰桥顶, 座体压进舰桥顶 0.09
if(S.raw&&S.raw.secondary){
const n=Math.max(1,S.raw.secondary.n||1), mgL=L*NM_MG_L, sZ=hZ-hL*0.28;
// 座体高 NM_PLATE+0.20: 压进舰桥顶 0.09 后座顶仍高出 0.21 ⇒ 管身 (φ0.084) 整根嵌在座体内 (嵌合 0.084 ≥NM_JOINT)
const bH=NM_PLATE+0.20, mgR=0.042;
R.secG=new THREE.Group(); R.secG.position.set(0,hTop,sZ); g.add(R.secG);
nmCyl(R.secG,W*0.062,W*0.078,bH,10,M.tone,0,bH*0.5-NM_DECK_EMBED+0.01,0);
R.pitchG2=new THREE.Group(); R.pitchG2.position.set(0,bH-0.16,0); R.secG.add(R.pitchG2);
for(let i=0;i<n;i++){
const ox=(i-(n-1)/2)*(W*0.035);
nmTube(R.pitchG2,mgR*0.80,mgR,mgL,6,M.dark,ox,0.02,mgL*0.5);
}
R.muzzles.secondary=nmMuzzle(R.pitchG2,'secondary',0,0.02,mgL+NM_PLATE*0.5);
}
// ⑫ 鱼雷发射管 (每具一个枢轴组 tubeG, 与 muzzles.torpedo 同序): 搁在舷缘栏板顶面 ⇒ y 向重叠 = 栏板高;
//    管心收进 hullW/2 (原版外挂); 组序 [艏组, 艉组] 与每侧左右顺序见 NM_BOAT.tube 注释
const tubeR=W*NM_TUBE_R, tubeL=L*NM_TUBE_L;
const tubeX=W*(0.5-NM_RAILW_B*0.5-NM_TUBE_R*0.88), tubeY=railY+NM_RAILH_B*0.5;
R.muzzles.torpedo=[];
for(const[tz,dir,cnt]of P.tube){
for(let i=0;i<cnt;i++){
for(const sx of[-1,1]){
if(S.torpedo>0&&R.muzzles.torpedo.length>=S.torpedo) continue;   // 上限 = spec.torpedo (单源)
const TG=new THREE.Group(); TG.position.set(sx*tubeX,tubeY,L*tz); g.add(TG);
nmTube(TG,tubeR,tubeR*0.92,tubeL,8,M.rust,0,0,0);
R.tubeG.push(TG);
R.muzzles.torpedo.push(nmMuzzle(TG,'torpedo'+(R.muzzles.torpedo.length+1),0,0,dir*(tubeL*0.5+NM_PLATE)));
}
}
}
// ⑬ 舵 + 双桨 (2026-09-21B · 用户点名"螺旋桨和后边的板子不要重合"):
//   旧版: 舵前缘距桨叶只有 0.07m / 艉板距桨叶 0.20m, 桨轴 0.42m 只从艉板里探出 0.19m ⇒ 桨像是"贴在舵上"。
//   本轮: ① 舵做成**穿艉板的舵柱板** (与艉板的 z 嵌合 = 0.28~0.33 ≥NM_JOINT, 自检连通性/接合深度会核对);
//         ② 桨组整体后移 NM_PROP_SET(0.26) ⇒ 实测桨叶↔艉板 0.29m / 桨叶↔舵 0.50m (AABB; ≥0.25 红线);
//         ③ 桨轴长度**现算** (尾端 = 桨盘 −0.23, 前端 = 艉板内 0.10) ⇒ 穿进艉板 0.12m ≥0.10, 传动关系看得见。
// ★ 2026-09-26 A12 修: 旧写法 `R.nodes.rudder=nmBox(...).name='nmRudder'` —— `=` 右结合, 于是
//   nodes.rudder 收的是**字符串** 'nmRudder' (对象被丢掉)。15d 的舵驱动是 `if(nd.rudder&&nd.rudder.rotation)`,
//   字符串没有 .rotation ⇒ 整条舵动画成为死代码 (艇怎么打舵, 舵面都不动)。拆成两句:
//   命名一句、登记一句 (同文件 586/595 的写法)。
const rud=nmBox(g,W*0.05,H*0.14,L*0.02,M.dark,0,wl*0.5,freeRear-0.01); rud.name='nmRudder';
R.nodes.rudder=rud;
const PGZ=freeRear-NM_PROP_SET;
const shaftAft=PGZ-0.23, shaftFwd=freeRear+0.09-NM_DECK_EMBED;   // 艉板 z 区间 = [freeRear−tpD+0.09, freeRear+0.09]
const PG=new THREE.Group(); PG.position.set(0,wl*0.55,PGZ); PG.name='nmPropG'; g.add(PG);
// 2026-09-25 修: 每舷一个"原点落在自己轴心"的枢轴 (同两栖车) —— 旧版把桨轴与桨叶直接摆成
// (±0.14W,0,·) 的子件, 15d 转 PG.rotation.z 时两根**桨轴**会一起绕艉中线公转 (开动时轴在甲板/船底之间扫)。
// 子件改挂枢轴后世界位置逐点不变, 只有转轴正确。
for(const sx of[-1,1]){
const pv=new THREE.Group(); pv.position.set(sx*W*0.14,0,0); pv.name='nmPropPivot'; PG.add(pv);
const sh=nmCyl(pv,W*0.012,W*0.012,shaftFwd-shaftAft,6,M.dark,0,0,(shaftFwd+shaftAft)*0.5-PGZ);
sh.rotation.x=HPI; sh.name='nmPropShaft';                                        // 桨轴: 穿进艉板 0.12
const b=nmCyl(pv,W*NM_PROP_R,W*NM_PROP_R*0.6,NM_PROP_T,3,M.rust,0,0,-0.19);
b.rotation.x=HPI; b.name='nmPropBlade';
}
R.nodes.propeller=PG;
}

// ══════════════════════════════════════════════════════════════════════
// 七、入口: navBuildModel(spec) —— 冻结签名
// ══════════════════════════════════════════════════════════════════════
function navBuildModel(spec){
const S=navSpec(spec);
const M=navMats(S);
const R={grp:new THREE.Group(),turretG:null,mainG:null,pitchG:null,secG:null,pitchG2:null,
 wheels:[],muzzles:{},nodes:{pontoon:[]},tubeG:[],props:[],S,M,boatTurret:null};
if(S.kind==='amph') navBuildAmph(spec,S,M,R); else navBuildBoat(spec,S,M,R);
// 炮口/管口的 grp 局部静止坐标 (userData.nmLocal: 供 15d 取用, 不依赖父级矩阵)
for(const k in R.muzzles){
const v=R.muzzles[k];
(Array.isArray(v)?v:[v]).forEach(m=>{ if(m){ const p=navLocalize(R.grp,m); m.userData.nmLocal={x:p.x,y:p.y,z:p.z}; } }); // ★2026-11-01: 存纯数值三元组 —— userData 禁对象引用红线 (V3 虽无环, 纪律按序列化链立)
}
R.grp.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=false; } }); // 全件投影 (与 Tank.buildMesh 同口径)
// ── 炮塔增量 (2026-09-21 冻结): barrelPivot === pitchG; turretHit/dims 增量只给炮艇 ──
//   两栖车的炮塔命中走 15d 的 vehHitCyl 口径 (kind='amph' 分支), 本文件不替它另立一套
const dims={L:S.L,W:S.W,H:S.H,hullY:S.hy,bot:S.bot,roof:S.roof,deckY:S.deckY,waterline:S.wl};
let turretHit=null;
if(S.kind==='boat'&&R.boatTurret){
const T=R.boatTurret;
dims.turretY=T.tY0;      // 炮塔回转组底面 y (grp 局部) = turretG.position.y
dims.turretH=T.tH;       // 塔体总高 (塔底面→顶盖面) = spec.tur.h
dims.sightY=T.sightY;    // 炮手观瞄镜心 y = deckY + spec.sightH (WS2 炮手镜机位的直接读数)
turretHit={r:T.r,y0:T.yHit0,y1:T.top};   // 炮塔命中圆柱 (y 相对 grp 原点)
}
return { grp:R.grp, turretG:R.turretG, wheels:R.wheels, muzzles:R.muzzles, nodes:R.nodes,
 mainG:R.mainG, pitchG:R.pitchG, secG:R.secG, pitchG2:R.pitchG2, tubeG:R.tubeG,
 barrelPivot:R.pitchG, turretHit, dims };
}
