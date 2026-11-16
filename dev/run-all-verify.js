// ─────────────────────────────────────────────
// dev/run-all-verify.js —— 全量验收套件 (2026-09-20 本批)
// 逐条跑本仓库全部沙箱探针/验证脚本 + 真浏览器探针, 汇总退出码与关键末行。
// 用途: 交付前一次跑完, 避免"逐个手敲命令漏掉某个回归"。
// 用法: node dev/run-all-verify.js            # 只跑沙箱 (不需要外网/浏览器)
//       node dev/run-all-verify.js --browser  # 追加真浏览器探针 (需要 Edge; CDN 走 dev/vendor 离线桩)
'use strict';
const {execFileSync}=require('child_process');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const WITH_BROWSER=process.argv.includes('--browser');

// 沙箱套件: [脚本, 附加参数, 说明]
const SANDBOX=[
['dev/verify-boot.js',[],'启动链: 全战役 LOAD'],
['dev/verify-procgen.js',[],'随机战场: 种子不变式/净空/同种子全同 (数据阶段)'],
['dev/verify-zombie.js',[],'丧尸模式: FSM/感染链/票务豁免/ZP/工事血量/单队多队'],
['dev/verify-hudfix-20261007.js',[],'2026-10-07c 批: 随机图无UI根因(复核块唯一+时序)/丧尸solo结算页(丧尸战果行)/F1 HUD开关/版本戳'],
['dev/verify-text.js',[],'文本编码 + i18n 键闭环 + 版本戳'],
['dev/verify-layouts.js',[],'13 图布局指纹'],
['dev/verify-worldrestore.js',[],'世界还原快照'],
['dev/verify-fire.js',[],'植被燃烧/倒伏/碾压'],
['dev/verify-firecap.js',[],'火力点上限'],
['dev/verify-sink.js',[],'植被下沉'],
['dev/verify-spec.js',[],'观战/幽灵坦克'],
['dev/verify-specbatch.js',[],'观战修复批: 挡弹/出生闸门(全类)/开关生效点/座驾保护/按需召唤/信息层/时停/游泳/指挥闸门 (2026-09-26H + 27I)'],
['dev/verify-specthird.js',[],'观战连狙 + 第三人称'],
['dev/verify-tankai.js',[],'坦克交战 AI + 互撞'],
['dev/verify-vehmodels.js',[],'坦克/飞机剪影规格'],
['dev/verify-foliage.js',[],'植被密度 + 遮蔽视野'],
['dev/_audit-foliage-ref.js',['11','20000'],'植被遮蔽独立审计对照'],
['dev/probe-bots.js',['0'],'Bot 行为 (乱斗 + 1v1)'],
['dev/probe-planes.js',['0'],'AI 飞机不撞山'],
['dev/probe-slope.js',[],'坡度物理'],
['dev/probe-menu-hud.js',[],''],
['dev/verify-nav-20260926.js',[],'A* 寻路核心: 纯函数 / 无假失败 / 索引式堆 (含 --neg 阴性对照)'],
['dev/verify-fixbatch-20260926.js',[],'2026-09-26 修复批: 海战命中·绕向 / 出生死袋闸 / P1 十条 (含 --neg)'],
['dev/verify-navspots-20260926.js',[],'出生点·旗点可站立性 + 开局实际落点体检'],
['dev/verify-animfix-20260926.js',[],'2026-09-26 动画/模型批: 挂点/腿反解/布娃娃/履带/炮位/建筑 (含 --neg)'],
['dev/verify-tread-20260927.js',[],'坦克行走机构: 履带=绕轮闭合带/花纹沿环向/侧视轮可见度/端轮/侧裙板分片 (2026-09-28 带环口径重写, 含阴性对照)'],
['dev/verify-batch-20261024e.js',[],'2026-10-24f 批: 坦克队色信标/重坦提速/水乡石桥引桥坡道反向修复 (三种子正负落差双分支)'],
['dev/verify-batch-20261024f.js',[],'2026-10-24f 批第二波: 敌方载具信标倒三角(友方保持)/观战四弹种全配/观战手雷预瞄/烧毁植被黑炭化后再消失'],
['dev/verify-nadecancel-20261025.js',[],'2026-10-25 批: 举雷/换弹读条化(X取消+受击打断+抢态收尾归位)/补给弹药改储备超上限账 (含 --neg)'],
['dev/verify-commander-20261026.js',[],'2026-10-26 指挥官模式批: cls5+通讯仪/整局双向锁/开局编制(挂组不挂人)/四词汇命令/帧长三态门(减速+布势冻结)/指挥地图(R12敌显单源+D19废墟补丁) (含 --neg)'],
 ['dev/verify-cmdui-20261027.js',[],'2026-10-27 指挥官交互重做批: 队位三处同源(cmdSquadShown+cmdUnitCenter)/集火(半径广播+候选加分, 14-bots·15-vehicles 消费点)/三命令键 E·F·R+滚轮切高亮+左键集火右键退出/显隐单源 cmdMapWrapShow(局内地图不显示的根因)+画布居中正方形/确认即盖章/减速键 N→V·近战键 V→N (含 --neg)'],
 ['dev/verify-radio-20261027.js',[],'2026-10-27 通讯仪批: 对讲机剪影建模(第一/第三人称同源配色·对齐阵营)/gunKindOf 增 radio 档(第三人称不再拿步枪)/挂点与持握姿态单源 (含 --neg)'],
 ['dev/verify-deployundo-20261027.js',[],'2026-10-27 布势批: cmdDeployUndo 撤销布势重选兵种(清 lockedDir/复位配比/回部署页)+确认开战即盖章后兵种卡禁选 (含 --neg)'],
 ['dev/verify-cmdbatch2-20261027.js',[],'2026-10-26 指挥官反馈批: 读条按需显隐+避开占领条/布势右键退出取消/编制就近聚组+重生集中生成/私人小队互斥(解散收编·撤销还编)/兵种卡金边+模式说明/指挥地图缺块钳制+alpha卫生+厚灰高亮 (含 --neg)'],
['dev/verify-matseam-20260927.js',[],'建筑材质一致性: 逐块色相收敛 / 贴图平铺闭合与接缝连续 / 帆布密度归一 (含阴性对照)'],
['dev/verify-uvref-20260928.js',[],'材质克隆 uvRef 保真: 永久件/受损档不丢贴图密度登记 (2026-09-28D "不可破坏建筑各部位像两种材料" 回归闸, 含阴性对照)'],
['dev/verify-uvscale.js',[],'贴图密度归一: UV_DENSITY↔MAT/就地材质逐值 / 全场构件 UV 跨度×S=世界尺寸 / 非盒环绕不动 / 共享几何不改写 (2026-11-01 贴图批收编: 此前不在册, 静默红五周)'],
['dev/verify-svgtex.js',[],'SVGTEX 40 生成器: XML 良构 / url(#id) 引用 / stitchTiles / 滤镜域 (2026-11-01 贴图批收编: 桩补星空 Points 四件后恢复可跑)'],
['dev/verify-phase2-20260928.js',[],'阶段二批: D3 贴图清算(永久件提亮取消+圆柱/圆锥 UV 归一, 观战名牌 userData 环修复回归)/D1 观战态击落全链(直伤/溅射/触地/玩家座机/副作用投毒/时停口径/观战名牌现场)/D9 第三人称本体世界还原摘除复现与复位 (2026-09-28)'],
['dev/verify-phase3-20260928.js',[],'阶段三批 P1 平衡首轮: 兵种 8→5/武器距离衰减生态位/移速系数/栓动换弹/高抛弧单源/火箭弹判定与爆圈分档/医疗箱与工程兵键位 (2026-09-28; 2026-10-01 补登进套件 + P1-h 判据跟码 + 去注释器 CRLF 修)'],
['dev/verify-structscore.js',[],'地图可破坏物得分: 归属/合并角标/链式/还原/源码接线 (2026-09-26 破坏得分批)'],
['dev/verify-destruct-20260927N.js',[],'破坏机制批: 命中判据/撞塌动量/掩体与油桶/坍塌碾压/血量归一/屋盖承伤/受损档/永久件材质 (2026-09-27N)'],
['dev/verify-aimassist.js',[],'瞄准吸附: 档位/近失误转命中(真链+真伤害入口)/隔墙·队友·大偏阴性对照/载具主炮·航炮接线/AI 不吃 (2026-09-27)'],
['dev/verify-fixbatch-20261104b.js',[],'2026-11-04b 时停五项批: 时停击杀/破坏即现(生成当帧贴位姿)/部署不继承上次选择/时停引擎·环境·周期声静音/调试观战免着火/雨雪粒子三轴不跟随镜头(含升降)'],
['dev/verify-timestopfix.js',[],'时停修复批: 冻结帧零伤害(静止炮弹不再隔空引爆)/观察者弹丸按真实帧长走完生命周期(AI 的逐位冻住)/巡飞弹制导不再被冻住/海战音频逐艇取帧长/回菜单·结算复位/常驻时停读数 (2026-09-27M)'],
['dev/verify-killattr.js',[],'击杀来源归因+方向弧: 弹体自带src标签+命中/爆炸重盖章(火箭飞行中切枪不串账/迫击炮弹真创建点)/throwNade四档映射/方向弧定格世界方位随转向重算+同侧合并/updateHUD接线 (2026-09-29)'],
['dev/verify-judgment-20261101.js',[],'判定批: 玩家死亡播报爆头位透传(☠不再丢)/反坦克雷链爆改挂游戏时钟(时停·暂停不再照爆)/出生保护开火即解除补全四条直接出膛口(火箭·坦克主炮·AT炮·迫击炮) (2026-11-01)'],
['dev/verify-parity-20261103.js',[],'2026-11-03 三问批: Bot打断网(受创>25打断换弹/举雷/包扎/上炮前摇)+弹药账对齐(开火扣槽位/换弹扣备弹/弹尽寻补给)+真附身呈现层全量镜像(视模式换弹/举雷/包扎/开火反馈+finishReload让位)+火力点命中体parity(玩家迫击炮蹲姿)+丧尸追击双bug(0s宽限/同目标重锁/aggroT刷新) (含 --neg)'],
['dev/verify-deathdrop-20261103.js',[],'2026-11-03 死亡掉雷批: 死亡掉落手中雷+引信继承读条 — 玩家>25致命一击=打断点掉雷(厨雷账nadeFuse余值直带; 烟雾/燃烧/AT带标准引信, 哨兵99绝不带走)+出手弧死亡=die()钩掉落+收弧防复活双雷+Bot前摇致命=打断点掉雷(引信=全长×前摇剩余比)+受创非致命照旧收回/尸变不掉/载具内不掉/空手零掉落对照 (含 --neg 六补丁: 两处打断点掉雷拆/die钩拆/引信继承断/比例断/哨兵带走病)'],
['dev/verify-nademap-20261103.js',[],'2026-11-03 预瞄批: 贴地圈可见弧段(旧整环作废=厨雷后爆炸范围只剩小圈病根)+开放弧去填充+弹跳段预瞄点提亮+预瞄地图标记(小/大地图落点圈+圈内目标黄边, NADE_MAP_MARK 游戏内容设置开关实时生效)'],
['dev/verify-deathflight-20261103.js',[],'2026-11-03 排查批: 射手死亡弹道留存契约 — 手雷(nades)/火箭弹(shells)射手死后照飞照炸+巡飞弹 die 原地起爆(loiterDetonate 既有行钉回归)+子弹=即时射线无在飞实体; 全部真创建路径+真死亡链 (含 --neg 注入式阴性: 死后清弹三病各被对应判据抓红)'],
['dev/verify-crushhead-20261103.js',[],'2026-11-03 碾压/头盔批: 坦克碾压99/日系chiha形80(键=shape非wc, 卡车两栖不动)+碾而不死宽限1.2s(墙钟门防连续碾事实秒杀+友军同款侧挤清壳)+四盔球冠放大消方头四角穿模(真mesh参数重算多面体压角裕量≥2.5mm)+日军星徽/国军徽章出盔面(旧z埋在盔内从未露出) (含 --neg)'],
['dev/verify-specweapon-20261104.js',[],'2026-11-04 附身武器镜像+第三人称手枪差异化+火箭筒换弹批 (含 --neg): 附身武器单源 svHostCurSlot(heldWpnKey台账→slots[1]兼容退回)+svHostWeaponMirror(possess/tick同源 curW钉定+VM换枪门idle/draw)+svHostActionMirror副武器pReloadT镜像+22-hud弹药面板同源+13-combat fireRocket出膛反馈钩 / gunKindOf pistol独立档(旧smg=照搬冲锋枪)+三枪族colt/broom/nambu(p38·tt33同colt族)+站姿挂点{-0.17,0.42,0.33}匍匐{-0.24,dy0.12,dz0.62}(a21-j全量复测定位: ①″零接触④′双手L=R=0)+CARRIED_FWD 0.06+无持握表=双手默认 / bazooka 3.6→2.4·schreck 3.8→2.5(garand/thompson金丝雀)'],
['dev/verify-fieldfix-20261105.js',[],'2026-11-05 实机反馈三虫批: 第三人称手电光锥锚定(truncateConeMesh fz 语义=灯口前向偏移, 士兵两处调用误传 baseL*0.5 ⇒ 锥体整体前漂 11m)+巡飞弹TV视角本体在场(updateCamera 顶部每帧 hide 而本体显示只在第三人称分支 ⇒ TV制导恒隐)+圆柱顶端站立(_cmCylCb 补 0.56 跨步豁免与 _cmBoxCb 同规 + standHeight 补圆柱顶面支撑, 桶/草垛/筒仓顶从此站得住) (含 --neg 五补丁)'],
['dev/verify-loiterview-20261106.js',[],'2026-11-06 巡飞弹背追三虫批: ①背追档手电整链锚弹体(playerFlashlightTick 旧版不分档全按相机锚 ⇒ 光柱悬在背追机位前; ltBack 档起点=弹体/朝向=弹鼻, TV 弹头档相机锚不变) ②弹体可见性单写者(fireLoiter 出膛 false + 仅 updateCamera loiter 分支能翻回 ⇒ 真观战 alive=false 自由视角/死亡镜头永隐; 收拢 updateLoiters 末尾, 唯一隐藏态=TV档) ③制导中本体不再跟转(旧制导期持续回写本体角被用户裁定推翻, 改退场一次性对齐=退出画面不跳的等价实现) (含 --neg 五补丁+--only 单补丁亲验)'],
['dev/verify-flyaim-loiterkey-20261106.js',[],'2026-11-06 飞行瞄准×巡飞弹改键批: 观战两飞行(气动H/悬停双击空格)右键=瞄准ADS(键鼠/触屏/手柄三门摘flying, thirdPersonOn排ads自动强制第一人称)+气动加速右键→空格(specFlightMove读keys.Space)+巡飞弹加速右键→空格(_ltSpace吞边沿同构_ltRClick)+视角切换F→U(loiter门插KeyU首, F还原纯交互=tryInteract首行loiter门吞)+右键按住=全屏开镜(LOITER_ZOOM_FOV=30≈2.8x, 强制第一人称, 松开恢复原档)+弹体可见性单写者纳入开镜态(防第三人称档开镜糊脸)+TV灵敏度跟当前fov(camera.fov/74)+触屏跳跃/手柄A走kd(Space)同链自动获得加速 (含 --neg 14补丁)'],
['dev/verify-loiterfreeze-20261107.js',[],'2026-11-07 巡飞弹操控定身批: 操控巡飞弹期间本体定身(悬停态原地悬停/步行态重力链照常; 旧写 specFlightMove 消费同一份输入=悬停上升+气动前飞同根)+气动中发射就地切悬停(vel+_aeroSpd 清零)+退场吞空格边沿(_ltSpace=!!keys.Space 帧首清零上提, 跳跃/悬停升/气动加速三门; 地上连跳真身=退场残空格)+C/Z/X 姿态键定身+小地图弹体中心/菱形标记常显(naval 包装层同布) (含 --neg 9 补丁行为级转红)'],
['dev/verify-timestophud-20261108.js',[],'2026-11-08 时停HUD批: 10Hz 低频HUD段(hudSlowT)旧吃世界 dt ⇒ 时停中小地图/罗盘/顶栏停绘而观察者仍动; 修=24-main updateHUD(dt,pdt) 传观察者帧长+节流钟吃 pdt(单参退化 dt 兼容 T7 旧口径) (含 --neg 3 补丁)'],
['dev/verify-perfgfx-20261108.js',[],'2026-11-08 性能与画面批: 主菜单「性能与画面...」子面板(画质迁入+五旋钮: 渲染缩放/阴影刷新档位化+关档单源门/视距雾距乘子/粒子动态上限/降水密度乘子)+存档三态校验+UI循环钮三账同步 (含 --neg 6 补丁)'],
['dev/verify-ffneutral-20261109.js',[],'2026-11-09 中立批: 投掷手雷中立(frag explodeAt noFF 参+AT雷溅射-1, 触发引信仍只认敌方=裁定A)+观战本尊全步兵武器中立(coFfFire spectator 门+座位排除 onNaval/capitalGun=裁定C, 火箭盖章门+手持迫击炮门)+友军击杀照常记分(裁定B不加同队门)+吸附ff门跟走; 阴性=非观战枪/火箭/迫击炮·附身宿主弹·Bot迫击炮·航弹仍敌我过滤 (含 --neg 七补丁)'],
['dev/verify-vehburn-20261109.js',[],'2026-11-09 四项批①: hp<10% 起火≤10s 烧毁 (vehBurnIgnite 单源+follow 火源 dps=0+燃烧账直扣 hp+禁自修+飞机不带火源)+#vehBurnTip 警告+Bot 弃车弃船 (含 --neg 八补丁)'],
['dev/verify-vehburnfix-20261110.js',[],'2026-11-10 载具烧毁漂移修复批: 烧毁/激流当帧停帧 (15-vehicles/16-aircraft 燃烧账 die 后 return+!alive 守卫)+烧毁零漂移(孤立平坦地逐帧扫描)+激流死亡零漂移+低空烧毁单次 die (含 --neg 三补丁)'],
['dev/verify-aircollide-20261110.js',[],'2026-11-10 空情三虫批: ①飞机撞楼=机体扫掠线段 (旧位→新位 rayBox/rayCyl+机鼻余量 1.5×size; 旧版只查地形/水面地板 ⇒ 直穿楼房/塔/烟囱) + 细树干 foliage 豁免 (树/枯树/垂柳/竹) + 撞点 damageStructures(7,260) ②Plane.die(attacker,crash) crash 档: 坠地/撞楼/撞机=碰撞系机毁一律机毁人亡, 不读 AUTO_EXIT_VEH 自动跳伞 (用户裁定"过于非人类"); 火力系机毁照旧可跳伞 ③updatePlaneCollisions(dt): 心距<1.7×size 和+相对速度收拢>2m/s ⇒ 双 die(crash) 同毁互记; 收拢门豁免同速并行编队/出生相邻; dt<=0 (时停/布势) 不判; 接线 24-main 飞机循环后 (含 --neg 六补丁; N5 被 N4 掩盖/N6 被 N1 掩盖 ⇒ --only 单补丁亲见转红)'],
['dev/verify-willow-20261110.js',[],'2026-11-10 柳树批: 淞沪垂柳连接修复 (枝根钉干顶/冠蓬枝梢带/条顶锚冠带, 探针侧手算四元数复算) + 实例批化 WLOW_IM 3 张 (旧 ~1800 draw call→3) + 交互接入 (登记 TREE_LIVE/FLORA_HASH/燃料 + treeIgnitePass 认柳/爆炸掀倒/坦克撞倒/格烧尽排除/焦黑沉入) + golden 保序子列流钉 (含 --neg 九补丁; N1 让 W1~W4 全缺 ⇒ --only 单补丁亲见转红)'],
['dev/verify-achieve-20261111.js',[],'2026-11-11 成就系统批: 主菜单「战绩数据」→「数据成就」+ #mData 双页签 (战绩数据默认/成就) + js/27-achievements.js 轮询普查账 (开局 startMatch 建账, 0.5s 读权威状态位 FUEL<=0.05/tr.fall/charred/rec.dead/g.dead/b.dead/c.dead/w.alive) + 四成就 (夷陵之火/比夷陵之火还要好/自刎归天真雷真炸/狗熊岭之王) + 观战门 (spectator 期间压住退出补弹) + sf_ach 持久化跨 boot + Toast 挂 body + 缩账法行为级验收 (含 --neg 七补丁; N1 掩盖 S2~S7 ⇒ --only 单补丁亲见转红)'],
['dev/verify-perfreg-20261111.js',[],'2026-11-11 卡顿回归排查批: ①OCC 簇级脏区 (occTouch→OCC.pendList 簇表+occRectMerge 并簇+CAP=12 退化单矩形兜底; NAV.refresh 逐簇 bakeRegion, 两处远距真火不走全量烘焙) + buildSpatialIndex 集合变更戳 (_colIdxDirty 门, RGRID.idxRebuilds 可观测) ②渲染税摘除 (画布 CSS 滤镜/q2 默认半频阴影/碎块不投影/SMOKES_MAX=5 挤旧) ③零分配槽位化 (枪锚点链三对外槽+内部临时槽不互踩/legIKPose 交替双槽/capAnchorWorld 槽/tankRideH+坦克碰撞模块回调/gunEvents 原地压实) ④HUD 去重 (tickets hudHTML 指纹/存续条宽量化) ⑤decide 距离门前置 (纯谓词重排) — 含 ★槽位契约坑判据: 探针持槽引用跨帧=假红 (radio 批 ④⑤ 跟钉实录)'],
 ['dev/verify-obstacleavoid-20261112.js',[],'2026-11-12 实机反馈批 (士兵避车+三面板排版): ①_botMoveProbe 加载具壳体障碍探针 (_vehObsTest/_vehObsDims/_vehProbeBlocked, OBB+0.5m, 坦克/卡车/两栖艇同参推挤尺寸, 残骸照挡, toVehicle 认领目标豁免+yMax1.9 高门+游泳/甲板放行) ②外接盒粗筛随 yaw 旋转 (wex/wez 世界轴界 — ★端到端探针 T7 实锤: 横车 yaw=HPI 时局部 mx/mz 当世界界正好互换 ⇒ ±0.55/±1.1/±1.65 全误放行, 侧腹撞壳 minSurf -0.5) ③脱困绕行点拒壳内+dirFlip 兜底侧移也要过探针 ④moveDir 备选角扫描自然沿壳绕行 (端到端: 横在路中的坦克 26m 直奔目标, minSurf +0.23 贴壳绕过+越过+到达) ⑤三面板排版 (setCard 卡片行/helpCard+hkRow 键位表/helpPts 要点, 含 --neg 三补丁: 探针门退场/绕行点门退场/粗筛退回局部界)'],
 ['dev/verify-dynreload-deathcam-20261112.js',[],'2026-11-12 动态换弹速度×死亡时视角批: ①动态换弹 (sf_dynreload 默认关, 换弹耗时=预设×已耗/弹匣: dynReloadFac 单源+玩家 tryReload 单点+14-bots 六处 Bot 同规; VM 动画/读条/3P 镜像 nt 比例自动跟随) ②死亡时视角=击杀者 (sf_deathcam 默认自己: die() 目标解析 slots/crewBot, 自杀/环境死/无 slots 回退; killcam 档=0.5s 原镜头→剪切击杀者背后追尾+部分去饱和滤镜+#kcInd; killcamEnd 单源收账 showDeploy/endMatch/enterSpecView 三点; 重部署时序零改动) (含 --neg 十补丁; N5 掩盖 N10 与相机判据 ⇒ --only 单补丁亲见转红)'],

['dev/verify-specneut-20261113.js',[],'2026-11-13 观战中立×七项修复批: ①观战小队中立 (14-bots 小队指令块 spectator 门+22-hud 小队HUD隐藏+小地图/大地图/部署图着色单源 solMapDotColor: 观战本队不再画小队白点) ②观战武器中立补全 (对空链 planeHitTest excludeTeam 观战放行/投掷物出手 team=-1: 反坦克雷·航弹·迫击炮弹载具触发圈+接触引信对双方都认/载具击杀归因三处 coFfFire: 观战步战火力毁己方载具照常记分播报) ③飞机残骸建筑扫掠 (updatePlaneWrecks fall 段旧位→新位 rayBox/rayCyl+机鼻余量, 命中就地迫降贴面+rest 落账不打 crater+die 后 0.6s 双 boom 豁免窗+撞楼死亡位拉回命中面前 0.5m 防嵌墙) ④Q附身门 (幽灵坦克驾驶/巡飞弹操控/座位态 19-input 键位门+dbgSpecPossess 第二道门) ⑤换弹中左键不再取消 (与按 R 同义; 举雷左键例外保留) ⑥投掷物世界模型放大 NADE_WORLD_SCALE 1.5→2.5 ⑦出生离边门 SPAWN_EDGE_MARGIN=20 (17-emplacements spawnEdgeOk/spawnEdgeClamp 单源+pickSpawnPoint 候选闸+findFreeSpawn/NAV.spawnSpot/cmdSquadSpawnNear/小队铺开五条路径) (含 --neg)'],['dev/verify-loiterfix-20260928.js',[],'巡飞弹制导重做+击落交接原子化: 鼠标直控(解析式/上限/松手即停/不下沉/真事件记账/清账)/残骸先行+副作用try(阴性=死而不隐)/时停口径 (2026-09-28B; 2026-11-06 判据跟走: L1"本体姿态跟随弹体"被用户裁定推翻 ⇒ 改钉 notFollowed+exitAligned 两条)'],
['dev/verify-loiterarm-20261113.js',[],'2026-11-13 巡飞弹离膛武装批: 出膛保护 0.8s 时长豁免(巡航≈10m 无敌穿墙窗, 用户实报)改真实弹药离膛武装距离 LOITER_ARM_DIST=3 (00-config 单源): ①命中检测逐帧照跑含未武装段, 未武装撞掩体/单位=哑弹撞毁(不炸不伤+冒烟+提示条, loiterDespawn 静默退场) ②未武装段地形不引爆+贴地爬升钳制保留(坡地发射病根照旧护住) ③武装判定按飞行米数与弹速无关(加速 40m/s 不拉长豁免窗) ④TV OSD 加速标(tvBotL 后缀 ▸▸ 加速; 开镜 tvZoom 既有) (含 --neg; N1 行为红被 N2 累积掩盖, T8 锚逐补丁可辨)'],

['dev/verify-batch-20261114.js',[],'2026-11-14 四项批: ①飞机票数 有人机整体=TICKET_COST.plane(3)=机体(plane-1)2+驾驶员1(空机照旧整机3; 跳伞驾驶员单独阵亡照常-1; 旧账=机体3+驾驶员1=4票/架) ②冻结世界AI不得行动: 坦克乘员起火弃车加dt>0门(时停里不下车, 解冻第一帧照常弃车)+飞行员<32%跳伞挂_bailPend解冻消费(_bailCrew单源, respawn复位) ③音频冻结账升级: 24-main喂入从specTimeFrozen()改权威世界冻结账((rdt>0&&dt<=0)||gamePaused||matchOver||menuHold)——修暂停洞(时停+暂停旧账setTimeFrozenMute(false)恢复引擎lastVol=照常轰鸣)与布势洞(cmdDtGate回0从未进音频账) ④兵力票池倍率加回大厅(index.html #hubHmulSeg ×0.5/×1/×2 + 22-hud写sf_hmul, startGame开局读档83/165/330) (含 --neg; 红名↔补丁: N1→T1a+A1, N2→T2a+A2, N3→T3a/T3b+A3, N4→T4d~T4g+A4, N5→T5b+A5)'],
['dev/verify-proneknee-20261113.js',[],'2026-11-13b 批⑤ 趴姿膝弯方向: legIKPose 趴姿三消费点(20-player LL/RR+14-bots LL/RR) kneeUp false 化 —— 旧 pole-up 档膝峰拱到髋线之上 0.25~0.37 且小腿向脚尖方向折=反关节超伸(用户实报"趴下移动膝盖向上弯曲, 和正常人类相反"); pole 翻下=膝贴地段 0.09 级+膝弯转人类屈曲方向 (含 --neg; N1→⑤-3/⑤-4+N1源码, N2→N2源码)'],
['dev/verify-railclip-20261114.js',[],'2026-11-14 批③ 护栏穿墙修复通用化(先报红砖两楼后报"大部分有护栏的都有这个问题"): ①collideMove 横推双门改眼线 skip(盒/柱底面高于 pos.y+1.5=头顶上方几何横推永不作为, 压回分支整体删除——首版压回档实测站立被压下0.95m钉死) ②headGrazeBlocked 起跳预检窗改 (pos.y+1.5, pos.y+1.7] 整段 0.2m(旧 6cm 档护栏 0.9~1.1 大多漏网) ③05a 塔台顶棚整体抬 0.6(柱 2.3→2.9/顶板 2.21→2.81, 站护栏 0.95 余量 0.07); 护栏安全判据 rail_top ≤ ceiling_bottom−1.7 (含 --neg; 红名↔补丁: N1→③-3/③-5/③-6, N2→③-8, N3→③-4; ★N3 from 串必须吃满整行到 _hcS.hit=Infinity 否则 hit 复位被注释=headGrazeBlocked 带陈旧 hit 恒 true)'],
['dev/verify-bulletparticle-20261114.js',[],'2026-11-14 批⑥ 曳光截面方→圆(用户实报"打出的子弹的粒子总是方形"): tracerGeo BoxGeometry(0.035,0.035,1.6) 侧影从正后方看恒为方块 → 8 段圆柱 CylinderGeometry(0.0175,0.0175,1.6,8,1)+一次性 rotateX(HPI) 烘 Z 轴(配 spawnTracer lookAt 的 +Z 弹道朝向约定), 半径 0.0175 与旧盒半宽一致, 池化 Mesh 复用与 340m/s 步进回池不动 (含 --neg; N1→①两源码+⑥-1 圆柱参数+⑥-5 池化几何)'],
['dev/verify-restart-20261114.js',[],'2026-11-14 批④ 回主页再开局失效(用户实报"没反应/多点几次才进, 时好时坏"; 沙箱全链路诊断证两条复开逻辑路径干净⇒实机失效=异常击穿): ①startGame 对 startMatch(+zombie钩) try/catch 尾部旗标保底(menuHold/matchOver/matchRunning/showDeploy 永远执行) ②loop 帧级护栏 rAF 之后整段 try/catch+节流告警(前3帧带栈后每600帧心跳)+兜底渲染 (含 --neg; 红名↔补丁: N1→④-1/④-2, N2→⑤-1/⑤-2; ★22-hud 全 CRLF 锚须 \\r\\n, 摘护栏的 NEG from 串必须吃满整块否则孤儿 catch 炸语法)'],
['dev/verify-airfix-20261114.js',[],'2026-11-14 飞机坠毁分档×残骸落点×炮弹对空×调试部署×撞楼成就批: ①撞楼演出分档 (die 第三参 bld: 楼面一炸无弹坑+残骸贴楼/贴地+restT 到点二次爆炸消失; 坠地=触地一炸+弹坑+沉入地下旧口径) ②explosionFX 弹坑高度门 (crater 恒打 heightAt=爆点正下方地面⇒半空/楼面爆炸隔空盖坑病根; 爆点高于地面 2.2m 不盖+noCrater 显式参) ③残骸落点分档 (命中面法线 ny 分档: 顶面 ny>0.5 贴楼顶安放 onTop/侧面顺墙滑落轻微反弹由地面档收尾——旧贴墙 0.4m 悬浮=浮空病根; 收尾: 贴楼顶 onTop 二爆当帧原地消失 (二令, 不沉)/其余沉入地下 4.6) ④updateShells 对空 (planeHitTest 线段-球接坦克主炮/火箭筒/反坦克炮/岸防/舰炮全家, excludeTeam=弹体队友机豁免, 观战 team=-1 不豁免) ⑤调试模式冷却 bypass (22-hud onclick+24-main disabled 双门, specWillBe 单源) ⑥成就 likud_pilot (die 撞楼档盖 _achPilotBld+死亡边沿轮询读后即清) (含 --neg; 红名↔补丁: N1→T1b/T1c/T2c/T2e-4/T4d, N2→T2e-3, N3→T3a/T3c, N4→T4b, N5→T3i-2, N6→T3f, N7→T5a/T5b/T5c, N8→T6b/T6c, N9→T7b/T7c)'],
['dev/verify-touchpad-20260928.js',[],'触控审计修复+手柄支持: TV制导触控记账/preventDefault按需/取消卡键/灵敏度单源/ADS门/手柄全键位·死区·断开释放·非战斗归还 (2026-09-28C)'],
['dev/verify-roofghost-20260928.js',[],'屋顶永久化(教堂/谷仓墙恒存⇒顶恒存, 可毁房阴性对照)+幽灵坦克开火静音(真坦克发声阴性对照)+越野穿越(crush整类放行且不碾毁/高墙与dGroup仍阻挡) (2026-09-28C)'],
['dev/verify-hudfb-20260928.js',[],'阶段一 HUD/反馈批: D2 操控方式分组/D5 机瞄小准星/D6 准星残留(缓存失配阴性对照+五退场路径)/D7 击杀确认(盖档时序+确定性命中音)/D8 受击方向屏缘弧(步兵+坦克/飞机/舰船乘员) (2026-09-28)'],
['dev/verify-phase4-7a.js',[],'P3 阶段四 7a 飞行模型重写: fctl 意图接口单源/协调转弯/伪升力/速度耦合(俯冲加速+永不失速)/失控螺旋/dt=0 冻结复诵/airmg 吸附档/火控 HUD 四件套接线+D6 收尾纪律 (2026-09-30)'],
['dev/verify-phase4-7b.js',[],'P3 阶段四 7b-乙/丙 AI 全重写+锁定/接管: steerToward 原语/统一 lead/不双打/反应窗(AA+缠斗)/规避与三域参数化/拒止带; 锁定 35°·500m 空中优先/Space 接管老飞行员代打(诚实弹道管线+全包)/终止四条+冷却 (2026-09-30)'],
['dev/verify-airground-balance.js',[],'空对地平衡批 (2026-09-30 用户裁定): Bot 高炮对机弹伤×GROUNDGUN_VS_AIR(玩家档不减)/AA 交战距离单源 140/步兵·坦克·两栖车一律不索敌伞降目标(还击路径保留 botEngageR)'],
['dev/verify-phase4-7c.js',[],'P3 阶段四 7c 对空命中单源: planeHitR/planeHitTest/planeNearTest 三件套(旧四套口径+溅射第五处全收口)/fireMGBurst 双轨合并+遮挡(F7 隔山打消除)/高炮近炸 8·11 引信保留判定同源/轻武器对空 Q3(敌机实体化+AIRMG_SCRATCH 刮血档 Bot×GROUNDGUN_VS_AIR)/机炮弹 noAirHit 旗标防双份 (2026-09-30)'],
['dev/verify-phase4-7d.js',[],'P3 阶段四 7d-甲 高炮多机分摊账本: aaSpreadTarget 认领最少优先+粘滞到目标亡+跨队不计, enemyPlaneAlive 保留存在性判据; 交接面冻结核对(fireFlak 管线/AAGUNS 结构/PLANE_TAKEOVER 签名) (2026-09-30)'],
['dev/verify-nade-trigger-20260930.js',[],'手雷触发引信+四弹种建模+贴地预瞄+投掷起点 (2026-09-30 批2): 引爆=引信到点 且 触地/命中合法目标(阴性=空中到点不炸/未武装不炸/友军不炸/普通雷撞载具不炸/举满3.8s不自爆) / buildNadeMesh 单源四件(手上=出手=三人称手上) / 出手点=右手+方向汇聚准星(阴性=旧相机起点屏幕x展开≈0) / 预演总画地面落点圈(贴地椭圆; 三人称与一人称形状不同) + 反坦克炸药触载具即炸(阴性=普通雷撞载具不炸) + 弹着点#naDot 与真弹爆点投影同点'],
['dev/verify-fixes-20261010-batch2.js',[],'2026-10-10 第二批修复: 丧尸双队分流/旗点大灯调柔/动态光照与渲染卡顿治理'],
['dev/verify-animfix-20261012.js',[],'2026-10-12 左臂朝向 + 读条取消/互斥批 (含 --neg): 六处动作位姿过 vmHandLFix 单源(袖管落掌心左侧/掌心逐位不变) / readBarActive-Busy-cancelReadBar 单源(取弹抢状态即打断且不留模型不回血) / X·左键·H·✕ 四条取消路同源'],
['dev/verify-perf-20261024.js',[],'2026-10-24 性能排查批 (含行为断言): 阴影半频刷新(q0/q1 30Hz·q2 逐帧·夜间跳过) / 大灯真灯池 60/75m 滞回+夜间链零分配 / 火源灯 85/110m 滞回+0.2s 扫描+活取源坐标(follow 随舰) / Bot 手电 raycast 0.12s 节流 / 版本戳 20261024a'],
['dev/verify-batch-20261030.js',[],'2026-10-30 五项批: 票尽观战部署放行(specWillBe 单源+四门)/读条同键再按=极少加快(2.5%)/其他动作键打断=双击确认(barStealArmed 单源+全动作键+HUD提示)/中性观战结算(END_SVG_SPEC+胜方副标题)/迫击炮削弱(半径5.25·伤100·玩家CD4.5·Bot CD6~9·结构圈5) (含 --neg)'],
['dev/verify-specview-20261101.js',[],'真附身呈现层批(2026-11-01)+实机修复轮(2026-11-02) (含 --neg): 宿主模型FP收纳=.root真身(★buildSoldierMesh包装对象, 旧h.mesh.visible无效写=实机两身体病根)+阵亡/登车还原守卫 / 姿态旗镜像(updateCamera eyeTgt口径) / 钉脚底+yaw+π+眼高随宿主 / HUD换宿主心(_hv/_hhp: 血条/体力/低血晕影/绷带行; curW镜像=弹药面板) / 反馈链不记分(出膛vmFireKick+命中白档+击杀onHostKill红档, 14-bots·25-zombies两门) / VM换弹镜像 / 👁指示条按罗盘底边重定位+脱离键两模式分文案 / 附身键吞(键盘+鼠标双监听器, 手柄/触屏ADS同门) / 👁全屏层门(重部署/暂停/结算开着即收起, _svOverlayOpen+_svIndShow单源)'],
['dev/verify-botai-20261103.js',[],'Bot AI 机制优化批 (2026-11-03 实机反馈, 含 --neg): perceive 当前目标预算优先复核(隔墙开火主根因: 耗尽不再沿用旧通视) / 机枪座开火瞬间 LOS 预检+断视改压最后目击位 / 火箭筒预检收紧到目标实际距离 / 士兵间软分离 _soldierSep(挤在一起主根因) / 驻点占用账 coverCrowdAt 三处消费 / 目标粘滞 objHoldT(半路掉头往返) / 上车贴壳判定+顶壳6s超时拉黑(兵挤坦克前上不了车; ★探针抓出首版轴配对反了)'],
['dev/verify-botprox-20261114.js',[],'Bot 近距感知批 (2026-11-14 实机反馈, 含 --neg): 面对面擦肩没看见两根因修复 —— ①近距强制感知 PROX_SPOT_R=12m 内候选射线不吃 RAY_BUDGET 预算门(超发入账, 与当前目标优先复核同款特权; 混战超订阅时更新序靠后的 Bot 每轮 0 发新目标射线=贴脸陌生敌人永远进不了 target) ②heardClose 脚步感知提到 FOV 门之前(旧 heard 在门后=死代码; 站立/奔跑 9m 全向/蹲行 4m 蹲姿潜行保留; 听枪仍走 gunEvents 兜底不锁目标) (红名↔补丁: P1→S1/S2/S4/S9, P2→S2/S4/S5/S6, P3→S3)'],
['dev/verify-restart2-20261114.js',[],'重开局系统性BUG批 (2026-11-14 用户实报"一局结束重开=地图静态/没载具/UI消失/卡死"+焦黑树篱不还原, 含 --neg): ①残骸动态碰撞盒把 BOXES 撑大+下标进 RGRID, restorePristineWorld 只截数组不重建索引(2026-11-11 性能批把 NAV.refresh 条件化后 23b 无参调用失约) ⇒ 脏下标喂 BOXES[undefined] 抛 TypeError 被 24-main 帧级护栏吞掉=四症状同根(startMatch 死在 new Tank 之前=没载具) — 修=NAV.refresh(true) 强制重建(04-collision:11 注释承诺口径)+eachBoxNear/eachCylNear/raycastWorld 四处脏下标守卫 ②树篱/枯树/竹丛/蕨丛焦黑=vanishFlora 换 m.material 不进快照不还原 — 修=WSN.flora 补拍 mm 原材质引用+写回(★块必须在 flora 循环体内, 首版放循环外 st 未定义=还原中途抛错被探针当场抓出) ③returnToMenu 补 killcamEnd 第四点收账 ④24-main 首错上屏 loopErrBar (红名↔补丁: N1→②-4+次生②-5/③-2, N2→⑤-3, N3→④-1/④-2, N4→⑥-1)'],
['dev/verify-exploff-20261114.js',[],'"手雷对友方造成伤害"设置批 (2026-11-14 用户令, sf_explo_ff 默认开+友方手雷告警, 含 --neg): 三伤害总口单源收口 — explodeAt noFF 受开关压制(关=普通手雷同队归零, 自炸照旧)/splashDamage team=-1 归一化到 attacker 队(级联覆盖坦克炮弹/火箭/AT炸药/航弹/迫击炮观战/舰艇透传; 无主爆炸 attacker=null 不受开关)/loiterDetonate 直击段 _ltFF 同队门 + updateNades 友方手雷(非自己扔·非迫击炮/航弹)7m 告警随开关 + 设置卡 exploFfBtn 即时生效落盘 (红名↔补丁: N1→③-T2, N2→③-T3, N3→③-T4, N4→④-T6a, N5→②-T0+次生⑤-T7a(②-T1被N1组合掩盖), N6→⑤-T7b)'],
['dev/verify-mapshrink-20261114.js',[],'缩图批: 六图 360/380 界内/连通/地标/自检'],
['dev/verify-mapfix-20261115.js',[],'多图修批 (2026-11-15 用户实报, 含 --neg; 地铁项随地铁站删除摘除)+莫斯科残墙迁位(M1 不压教堂/不骑墙·M1b 教堂旗净空·M2 工厂旗 132m)+百团 R10 南移 27.3m/前哨拉距 59m+胡康水态门/河道过界/水位 0.44+草原水塔腿 1.909 — NEG2: 摘墙足迹/摘水态门 全部转红'],
['dev/verify-conecollide-20261115.js',[],'2026-11-15 锥体碰撞批: 国会穹顶 7 档/教堂尖顶 45° 转位加大三档/水塔锥顶两档 noNav 分层近似圆柱 + OCC 烘焙 noNav 豁免 (悬空饰件不占地面格, 行为测试+对照组) + 钟塔接缝 h7.05→7.2 (含 --neg)'],
['dev/verify-waterentry-20261115.js',[],'2026-11-15 入水特效批: waterSplash 五参 (spd=入水速度) 粒子档位 6/14/24 + AudioSys.splash 四参透传 + Bot dry→wet 边沿 (14-bots moveDir, 大落差 scale 2.2/big) + 坦克 3.4/卡车 2.6 车体级跃迁账 + 飞机触水先溅后毁 (含 --neg)'],
['dev/verify-audio3-20261115c.js',[],'2026-11-15c 音效完全推倒重写批: 契约面 (bypass Set/naval 段三写点/splash 四参/引擎 pitch 写法) + 四档案表 (每枪 sid 全覆盖/炮 13 条/爆 18 kind/引擎 9 档+旧档别名) + 逐阵营坦克/飞机引擎档实spawn (normandy+songhu+baituan, 权重档读 tk.wc) + identity 接线锚 (sid/mgSid 四 style/坦克炮三档/planeMG/flak20/naval_*/battery/loiter/truck) + 行为 (每发变奏/未知回落/旧数字口径/tankJp saw pitch1.35/truck square/radial vs inline) + 远枪限流 (含 --neg)'],
['dev/verify-crater-20261115.js',[],'2026-11-15 自适应弹坑批 (二轮修黑弧): terrainSurfaceY 单源 (渲染弦面同格同对角) + 顶点贴地不变式 (≥弦面+0.04) + 绕向翻正法线朝上 + 125 顶点 BufferGeometry/贴花档材质/36 上限账/无 Torus rim (桩补真 setIndex/computeVertexNormals; 含 --neg)'],
['dev/verify-bamboo-20261115.js',[],'2026-11-15 竹子批: BAMBOO_IM 实例批+燃烧倒伏碾压链+淞沪竹带 (含 --neg 摘碾压转红)'],
['dev/verify-fieldfix2-20261116.js',[],'2026-11-16 八项批+11-17 返修: 树篱三链路/Bot 坦克修理/撞机规避/掉雷开关/主动优化/布娃娃背包/时停关灯 (含 --neg 14 补丁)'],
['dev/probe-renderstat.js',['0'],'渲染规模遥测 (2026-10-24): mesh/sprite/阴影投射者/材质去重/灯池清点 (诊断工具, 恒 0 退出; 全图请手跑 `node dev/probe-renderstat.js all [night]`)'],
];
const BROWSER=[
['dev/probe-animfix-20261012.js',[],'2026-10-12 左臂朝向 + 读条取消/✕: 真渲染器左臂两端坐标(含 BAR/百式物理换匣逐相位) + 读条/✕ 布局事实 + 真点 ✕/真 keydown X + 真 rAF 下被抢走不留模型 (需 :8000 静态服)'],
 ['dev/probe-deployundo-20261027.js',[],'2026-10-27 布势撤销/确认锁定 真浏览器全链: 选卡进布势(宿主/撤销按钮)→真点改配比→真点撤销(四态归位+宿主搬回+6 卡解锁)→重选→确认盖章(0~4 卡立刻变灰带🔒, 指挥官卡仍可选)→真点被锁卡只弹原因→落地后仍锁 (需 :8000 静态服)'],
 ['dev/probe-cmdui-20261027.js',[],'2026-10-27 指挥官交互重做 真浏览器: 局内地图真可见(wrap=flex/mc 有高/mc 766 方形画布)/真 wheel 切高亮可逆/面板 1 完整行+8 压缩条/真 keydown E·F·R 三命令(落点=光标)/真左键空地=集火(世界坐标逐位对)/真左键单位=改高亮/真右键退出/关图后三键归还/真按住 V=slowOn+0.2x 帧长+读条掉 (需 :8000 静态服)'],
['dev/probe-deploy-hud.js',[],'第6条: 部署界面隐藏 HUD'],
['dev/probe-menu-hud.js',[],'第6条: HUD 隐藏全路径回归'],
['dev/probe-inmenu-watch.js',[],'inMenu 时间线'],
];

const results=[];
function run(rel,args,note){
const f=path.join(root,rel);
if(!fs.existsSync(f)){ results.push({rel,note,code:'MISSING',tail:''}); return; }
let code=0,out='';
try{
out=execFileSync(process.execPath,[f,...args],{cwd:root,encoding:'utf8',timeout:20*60*1000,stdio:['ignore','pipe','pipe']});
}catch(e){
code=(e.status===undefined||e.status===null)?('ERR:'+(e.signal||'?')):e.status;
out=(e.stdout||'')+(e.stderr||'');
}
const lines=String(out).split(/\r?\n/).filter(l=>l.trim());
results.push({rel,note,code,tail:lines.slice(-2).join(' | ').slice(0,140)});
}

console.log('===== 全量验收套件 =====');
for(const [rel,args,note] of SANDBOX){
if(rel==='dev/probe-menu-hud.js'&&!WITH_BROWSER) continue;
process.stdout.write(('  '+rel).padEnd(42));
run(rel,args,note);
const r=results[results.length-1];
console.log(String(r.code).padStart(4)+'   '+note+(r.code!==0?'   ← 关键输出: '+r.tail:''));
}
if(WITH_BROWSER){
console.log('  --- 真浏览器 (Edge + CDP, CDN 走 dev/vendor 离线桩) ---');
for(const [rel,args,note] of BROWSER){
process.stdout.write(('  '+rel).padEnd(42));
run(rel,args,note);
const r=results[results.length-1];
console.log(String(r.code).padStart(4)+'   '+note+(r.code!==0?'   ← 关键输出: '+r.tail:''));
}
}
console.log('\n===== 明细 (末两行) =====');
for(const r of results) console.log('  ['+String(r.code).padStart(4)+'] '+r.rel+'\n         '+r.tail);
// 失败的用例连跑 3 次做稳定性判定 (排除 CPU/IO 抖动造成的偶发, 而不是直接把偶发当成回归)
const bad=results.filter(r=>r.code!==0);
if(bad.length){
console.log('\n===== 失败项稳定性复核 (各连跑 3 次) =====');
for(const b of bad){
const args=(b.rel.includes('_audit-foliage-ref')?['11','20000']:(b.rel.includes('probe-bots')?['0']:(b.rel.includes('probe-planes')?['0']:[])));
let stable=0, tails=[];
for(let i=0;i<3;i++){
run(b.rel,args,b.note);
const last=results[results.length-1];
tails.push(last.code);
if(last.code===0) stable++;
else if(last.tail) tails.push(last.tail);
}
console.log('  '+b.rel+'  → 3 次结果: '+tails.filter(t=>typeof t!=='string').join('/')
+(stable?'   ⇒ **偶发** (单次失败+'+stable+'次通过), 需人工判断是否环境抖动':'   ⇒ **稳定失败**, 是回归'));
if(stable) console.log('         失败那次的关键输出: '+b.tail);
}
}
const finalBad=results.filter(r=>r.code!==0);
console.log('\n===== 合计: '+(results.length-finalBad.length)+'/'+results.length+' 次运行 exit=0 =====');
if(finalBad.length){ console.log('最终仍未通过:'); finalBad.forEach(b=>console.log('  ✗ '+b.rel+'  exit='+b.code)); process.exitCode=1; }
else console.log('全部通过 ✔');
