// README 变更记录插入 (一次性脚本, 跑完即删) — UTF-8 node 脚本, 避免 bash GBK 乱码
// 用法: node dev/_readme-insert-tmp.js "<r1 结果>" "<r2 结果>"
'use strict';
const fs=require('fs');
const R1=process.argv[2]||'(待补)', R2=process.argv[3]||'(待补)';
const P='README.md';
const L=fs.readFileSync(P,'utf8').split('\n');
// 锚断言
if(!L[135].startsWith('| 2026-11-17')) { console.log('✗ L136 锚不符'); process.exit(1); }
if(!L[136].includes('PLAN.md')) { console.log('✗ L137 锚不符'); process.exit(1); }
// 1) 摘出错插进 §② 文档表的 2026-11-17 行 (上一批的变更记录进错了表)
const row1117=L.splice(135,1)[0];
if(!row1117.includes('四项批')) { console.log('✗ 摘出行不含 四项批'); process.exit(1); }
// 2) 定位 §八 变更记录表的 |---|---|---| 分隔行
const sec8=L.findIndex(s=>s.startsWith('## 八、变更记录'));
if(sec8<0){ console.log('✗ 找不到 §八'); process.exit(1); }
let ruleIdx=-1;
for(let i=sec8;i<L.length;i++){ if(L[i]==='|---|---|---|'){ ruleIdx=i; break; } }
if(ruleIdx<0){ console.log('✗ 找不到 §八 表分隔行'); process.exit(1); }
if(!L[ruleIdx+1].startsWith('| 2026-11-16')) { console.log('✗ §八 首条非 2026-11-16'); process.exit(1); }
// 3) 新条目 (2026-11-18 十三项批)
const row=newrow();
function newrow(){
const t='| 2026-11-18（**十三项实报批**，戳 20261117a→**20261117b**） | '
+'①**i18n 收口**：EN 主标题 STEEL FRONT（gameLogo 挂 data-i18n+document.title 随语言）/兵种卡「巡飞弹兵·观战中/调试中」两处裸拼收进 t2()/killfeed 击杀双方名走 t()/**84 Bot 人名拉丁转写**（施泰纳→Steiner、李云龙→Li Yunlong…，EN 击杀播报主体）/运输车突围/飞机接管/清场播报/暂停面板等 **~140 个词典键**补齐。'
+'②**手雷预瞄大地图补飞行中弹点**：drawBigMap 补 #ffd050 3px 点（与小地图同款，落第 4 层暗色遮罩前）。'
+'2.5/2.ex **投射物楼层=地面+不穿墙**：nadeStep 拆 nadeStep（引信烧减+子步循环）+_nadeMove（单子步积分/盒/载具圈/水/触发全链），单步位移 >0.24m 按子步推进（薄墙 0.15~0.3m+0.06 判定带必中；航弹末速 ~75m/s 6 子步封顶，每弹每帧 ≤8 次邻近查询）；盒回调分档即决：表外弹（at/bomb/mortar 出手即武装）**任意盒面即爆**（撞墙即炸老口径），表内弹（手雷/烟/燃）**顶面=楼板落地视作触地**（armed 才爆，未武装照旧弹跳）；弹跳位置沿命中面弹出 0.02（旧写只翻速度=嵌墙滞留）。'
+'2.6 **烟雾/燃烧弹可烹饪**：NADE_COOK_FUSE={smoke:1.8,incin:1.6} 真引信起烧（旧 99 哨兵只挂账），出手带烹饪余值（releaseNade 两处 throwNade + dropHeldNade 掉雷继承 <90 档），at 保持撞炸（冲击引信烹饪无意义）。'
+'③**读条终局收口**：endMatch/returnToMenu 补 cancelReadBar(null,true)+显式藏 _demolishBar（终局回菜单不再残留读条）。'
+'④**电车车厢×平板车皮模型重做**：tramWreck 16→**35 件**（转向架轮轴×2/侧窗残柱×6/端门歪斜门叶/烧毁长椅残段×2/顶盖肋条×3 随塌陷角歪/裙板铆接补板+铆钉条×2/残留涂装；**旧转向架原是 dEnd 后的裸 mesh=摧毁后残留孤儿，本批移进窗口随组死**）；红十月平板车皮 3→**20 件/皮**×2（木铺板/侧梁端梁枕梁/制动台踏板+罩壳/制动缸/铆钉线×4/锈渍档×3）；railFlatcar 8→**23 件**（同工具箱）；**账目（dBox 12 次/dEnd hp=520/solidBox/coverPoints/NAV_CLEARS）与 wr 流逐位不动**，新增 dVis() 纯视觉登记帮手（=mesh+窗口内手动 _dG.meshes.push，不新增碰撞账；dEnd 只收 dBox 专建 mesh）。'
+'⑤**枯树碾压并入倒伏**：floraCrushTank 死支 vanishFlora→floraTopple（与活树同款倒伏+已倒伏不二次登记守卫保留，不再"原地消失沉入"）。'
+'⑥**指挥官 ESC 盖章分流**：cmdDeployConfirm(esc)——布势期**下过令/调过配比**（CMD.deployTouched，四处令令点盖章）才 stamp，没布过势的 ESC 不锁兵种；✚确认开战按钮（不带参）照旧无条件盖章；cmdDeployUndo 撤销连带作废 deployTouched（章/账双清）。'
+'⑦**非盒几何碎块兜底**：spawnWallDebris 遇无 Box 参数几何按 THREE.Box3().setFromObject 世界包围盒 2×2×2 切块兜底（圆柱/圆锥件炸楼不再"直接消失"，守卫+try 包裹）。'
+'⑧**基地三帐篷朝营区中心**：ry=atan2(-(b.z-tz),b.x-tx)（tent 门向局部 +x），wr 流零消耗。'
+'⑨**坦克残骸排斥步兵**：Tank.update !alive 分支 wreckBs 在位期 vehiclePushSoldiers 纯推出（moving=false 无碾压/crushDmg=0/yMax 1.9/前向带 1.5 非对称关），与残骸碰撞账同生死（onHalf 摘盒即停）。'
+'⑩**坦克本身一律占 3 票**：TICKET_COST={tank:3,plane:3}（轻/重档位消费点退场）——车毁一律收车体票（有人车/空车同规，观战座驾豁免），乘员死亡照旧每人 1 票（death chains+settleCrewSlotDeath 不动）。'
+'⑪**暂停面板卡片化+键帽表**：#pauseSettingPanel→**4 张 setCard 卡**（灵敏度量纲 20-200 与主菜单对齐（旧 10-400）+新增「详细操作提示」开关 pauseCtlHintsBtn 同账 sf_ctlhints 与主菜单镜像）；#pauseHelpPanel→helpKeys **hkRow 键帽表 ≥18 行**（补 G/3/4/6 等键位）。'
+'⑫**架枪机制**：研究后**留存**（老机制无副作用，用户裁定不删）。'
+'**判据**：新 dev/verify-20261117b **43/0**（T1 读条收口/T2 大地图弹点/T3 楼层引爆+40m/s 薄墙子步必炸+侧撞弹出面外+未武装弹跳/T4 烹饪引信/T5 残骸排斥/T6 枯树倒伏/T7 Box3 兜底/T8 帐篷朝向/T9 ESC 分流含撤销/T10 3 票/T11 i18n/T12 暂停面板）+--neg 4 补丁逐个亲见转红；'
+'**跟码修钉三支**：verify-cmdui Esc 正则钉 cmdDeployConfirm()→(true)；verify-nade-trigger F1i 锚（触发判据补 boxBlow 段）；**verify-specneut T4 判据加固**——①观战 AT雷原本把 100hp 己方坦克当场炸毁→die() registerDynCollider 注册的 3 只 2.5×1.9×2.5 残骸盒正躺 ② 的弹道走廊（旧码单步 0.45m 踩进盒心 0.44m 才爆，爆点 y=0.59 离地 0.10 巧过 <0.3 代理；新码子步在盒面就爆 0.32 被误判"没落地"）→修=**hp 500 活过①**（splashDamage 载具 340 ap 圈缘命中 ≈185，只掉血不摧毁=走廊无残骸盒，活车不注册 RGRID 盒）+**弹道走廊净空采样**（0.75~6m 步距 ±0.5 带、盒带 [sg+0.05,sg+1.6]）+坡度门，55/0×2 稳+NEG 27 红对认。'
+'**run-all 两轮**：r1 '+R1+' → r2 '+R2+'。'
+' | css/style.css, index.html, js/00-config.js, js/00b-i18n.js, js/04b-fire.js, js/05a-buildings.js, js/05b-props.js, js/05c-layouts.js, js/12-ragdolls.js, js/13-combat.js, js/15-vehicles.js, js/15b-trucks.js, js/18-game.js, js/19-input.js, js/21-match.js, js/22-hud.js, js/23-deploy.js, js/26-commander.js, dev/verify-20261117b.js, dev/run-all-verify.js, dev/_game_files.txt, dev/verify-specneut-20261113.js |';
return t;
}
// 4) 插入: 新条目在上, 11-17 行次之
L.splice(ruleIdx+1,0,row,row1117);
fs.writeFileSync(P,L.join('\n'),'utf8');
// 5) 复核
const L2=fs.readFileSync(P,'utf8').split('\n');
console.log('✓ 文档表首行=',L2[135].slice(0,30));
const s82=L2.findIndex(s=>s.startsWith('## 八、变更记录'));
let r2i=-1; for(let i=s82;i<L2.length;i++){ if(L2[i]==='|---|---|---|'){ r2i=i; break; } }
console.log('✓ §八 首条=',L2[r2i+1].slice(0,40));
console.log('✓ §八 次条=',L2[r2i+2].slice(0,40));
console.log('✓ 总行数',L2.length);
