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
['dev/verify-loiterfix-20260928.js',[],'巡飞弹制导重做+击落交接原子化: 鼠标直控(解析式/上限/松手即停/不下沉/真事件记账/清账)/残骸先行+副作用try(阴性=死而不隐)/时停口径 (2026-09-28B; 2026-11-06 判据跟走: L1"本体姿态跟随弹体"被用户裁定推翻 ⇒ 改钉 notFollowed+exitAligned 两条)'],
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
