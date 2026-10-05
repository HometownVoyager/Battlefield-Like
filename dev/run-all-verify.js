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
['dev/verify-naval.js',[],'海战: 10 条验收红线 (未落盘的被测对象按⊘跳过, exit=0)'],
['dev/verify-navalcap-20261001.js',[],'海战系统性大修: 旗点跟随/补给箱/甲板碰撞/大舰互撞/炮塔血量与接管/瘫舰中立/鱼雷航弹 (2026-10-01b)'],
['dev/verify-navalround4-20261002.js',[],'海战第四轮: 旗点图标id唯一/观战甲板搬运绕行/舰桥旗点出塔/艇推挤无限幅/Bot让路预折 (2026-10-02)'],
['dev/verify-navalround5-20261002.js',[],'海战第五轮: 甲板弹药箱舰体局部锚(舷外悬浮+埋舰体)/低旗躲主炮扫掠/F键甲板层优先级栈(补弹>上炮>登机>跳海)+提示同账/capExitNow艏艉退出点 (2026-10-02B)'],
['dev/verify-animfix-20260926.js',[],'2026-09-26 动画/模型批: 挂点/腿反解/布娃娃/履带/炮位/建筑 (含 --neg)'],
['dev/verify-tread-20260927.js',[],'坦克行走机构: 履带=绕轮闭合带/花纹沿环向/侧视轮可见度/端轮/侧裙板分片 (2026-09-28 带环口径重写, 含阴性对照)'],
['dev/verify-matseam-20260927.js',[],'建筑材质一致性: 逐块色相收敛 / 贴图平铺闭合与接缝连续 / 帆布密度归一 (含阴性对照)'],
['dev/verify-uvref-20260928.js',[],'材质克隆 uvRef 保真: 永久件/受损档不丢贴图密度登记 (2026-09-28D "不可破坏建筑各部位像两种材料" 回归闸, 含阴性对照)'],
['dev/verify-phase2-20260928.js',[],'阶段二批: D3 贴图清算(永久件提亮取消+圆柱/圆锥 UV 归一, 观战名牌 userData 环修复回归)/D1 观战态击落全链(直伤/溅射/触地/玩家座机/副作用投毒/时停口径/观战名牌现场)/D9 第三人称本体世界还原摘除复现与复位 (2026-09-28)'],
['dev/verify-phase3-20260928.js',[],'阶段三批 P1 平衡首轮: 兵种 8→5/武器距离衰减生态位/移速系数/栓动换弹/高抛弧单源/火箭弹判定与爆圈分档/医疗箱与工程兵键位 (2026-09-28; 2026-10-01 补登进套件 + P1-h 判据跟码 + 去注释器 CRLF 修)'],
['dev/verify-structscore.js',[],'地图可破坏物得分: 归属/合并角标/链式/还原/源码接线 (2026-09-26 破坏得分批)'],
['dev/verify-destruct-20260927N.js',[],'破坏机制批: 命中判据/撞塌动量/掩体与油桶/坍塌碾压/血量归一/屋盖承伤/受损档/永久件材质 (2026-09-27N)'],
['dev/verify-aimassist.js',[],'瞄准吸附: 档位/近失误转命中(真链+真伤害入口)/隔墙·队友·大偏阴性对照/载具主炮·航炮接线/AI 不吃 (2026-09-27)'],
['dev/verify-timestopfix.js',[],'时停修复批: 冻结帧零伤害(静止炮弹不再隔空引爆)/观察者弹丸按真实帧长走完生命周期(AI 的逐位冻住)/巡飞弹制导不再被冻住/海战音频逐艇取帧长/回菜单·结算复位/常驻时停读数 (2026-09-27M)'],
['dev/verify-killattr.js',[],'击杀来源归因+方向弧: 弹体自带src标签+命中/爆炸重盖章(火箭飞行中切枪不串账/迫击炮弹真创建点)/throwNade四档映射/方向弧定格世界方位随转向重算+同侧合并/updateHUD接线 (2026-09-29)'],
['dev/verify-loiterfix-20260928.js',[],'巡飞弹制导重做+击落交接原子化: 鼠标直控(解析式/上限/松手即停/不下沉/真事件记账/清账)/残骸先行+副作用try(阴性=死而不隐)/时停口径 (2026-09-28B)'],
['dev/verify-touchpad-20260928.js',[],'触控审计修复+手柄支持: TV制导触控记账/preventDefault按需/取消卡键/灵敏度单源/ADS门/手柄全键位·死区·断开释放·非战斗归还 (2026-09-28C)'],
['dev/verify-roofghost-20260928.js',[],'屋顶永久化(教堂/谷仓墙恒存⇒顶恒存, 可毁房阴性对照)+幽灵坦克开火静音(真坦克发声阴性对照)+越野穿越(crush整类放行且不碾毁/高墙与dGroup仍阻挡) (2026-09-28C)'],
['dev/verify-hudfb-20260928.js',[],'阶段一 HUD/反馈批: D2 操控方式分组/D5 机瞄小准星/D6 准星残留(缓存失配阴性对照+五退场路径)/D7 击杀确认(盖档时序+确定性命中音)/D8 受击方向屏缘弧(步兵+坦克/飞机/舰船乘员) (2026-09-28)'],
['dev/verify-phase4-7a.js',[],'P3 阶段四 7a 飞行模型重写: fctl 意图接口单源/协调转弯/伪升力/速度耦合(俯冲加速+永不失速)/失控螺旋/dt=0 冻结复诵/airmg 吸附档/火控 HUD 四件套接线+D6 收尾纪律 (2026-09-30)'],
['dev/verify-phase4-7b.js',[],'P3 阶段四 7b-乙/丙 AI 全重写+锁定/接管: steerToward 原语/统一 lead/不双打/反应窗(AA+缠斗)/规避与三域参数化/拒止带; 锁定 35°·500m 空中优先/Space 接管老飞行员代打(诚实弹道管线+全包)/终止四条+冷却 (2026-09-30)'],
['dev/verify-airground-balance.js',[],'空对地平衡批 (2026-09-30 用户裁定): Bot 高炮对机弹伤×GROUNDGUN_VS_AIR(玩家档不减)/AA 交战距离单源 140/步兵·坦克·两栖车一律不索敌伞降目标(还击路径保留 botEngageR)'],
['dev/verify-phase4-7c.js',[],'P3 阶段四 7c 对空命中单源: planeHitR/planeHitTest/planeNearTest 三件套(旧四套口径+溅射第五处全收口)/fireMGBurst 双轨合并+遮挡(F7 隔山打消除)/高炮近炸 8·11 引信保留判定同源/轻武器对空 Q3(敌机实体化+AIRMG_SCRATCH 刮血档 Bot×GROUNDGUN_VS_AIR)/机炮弹 noAirHit 旗标防双份 (2026-09-30)'],
['dev/verify-phase4-7d.js',[],'P3 阶段四 7d-甲 高炮多机分摊账本: aaSpreadTarget 认领最少优先+粘滞到目标亡+跨队不计, enemyPlaneAlive 保留存在性判据; 交接面冻结核对(fireFlak 管线/AAGUNS 结构/PLANE_TAKEOVER 签名) (2026-09-30)'],
['dev/verify-phase5-capital.js',[],'阶段五 P4 大舰子系统: 编制生成/甲板旗点绑定/缓慢巡航/可走甲板移动平台(乘员跟随+局部障碍绕行)/分区装甲/瘫痪=永久海上陆地/鱼雷/主炮齐射走共用炮弹链/小艇让路/登舰三座位互斥/航母简化起降(停放-弹射-拦阻-承载) (2026-09-30)'],
['dev/verify-nade-trigger-20260930.js',[],'手雷触发引信+四弹种建模+贴地预瞄+投掷起点 (2026-09-30 批2): 引爆=引信到点 且 触地/命中合法目标(阴性=空中到点不炸/未武装不炸/友军不炸/普通雷撞载具不炸/举满3.8s不自爆) / buildNadeMesh 单源四件(手上=出手=三人称手上) / 出手点=右手+方向汇聚准星(阴性=旧相机起点屏幕x展开≈0) / 预演总画地面落点圈(贴地椭圆; 三人称与一人称形状不同) + 反坦克炸药触载具即炸(阴性=普通雷撞载具不炸) + 弹着点#naDot 与真弹爆点投影同点'],
];
const BROWSER=[
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
