// ─────────────────────────────────────────────────────────────
// dev/verify-commander-20261026.js —— 2026-10-26 指挥官模式批验收
//
// 用法: node dev/verify-commander-20261026.js [--neg]
//   --neg = 阴性对照: 装载前把本批核心改动按文本还原成旧写法, 同一批判据必须报红。
//
// 被测 (《指挥官模式设计-2026-10-25.md》开工批, 文档在仓库根):
//   兵种级 RTS 附加层 (BOOT_MODE 不动): cls5 指挥官 + 通讯仪工具武器 (无火力) + R10 整局双向锁 +
//   开局编制 (步兵 3~5 人/组 + 坦克/飞机各成单位, 挂组不挂人) + 四词汇命令 (free/attack_move/hold/strike)
//   + 帧长三态门 (布势冻结 0 / 减速 ×0.2 / 常速, K 时停优先) + 指挥读条 (7s, 恢复 1/3) + R9 两设置开关 +
//   指挥地图 (底图烘焙一次 / D19 废墟补丁 / R12 敌显复用小地图管线单源) + D21 布势阶段 (冻结+配比) +
//   D16 非 free 组禁自发上 idle 载具 / 重生继承组令 / R11 开图定身 / D18 仅步行地面开图。
//
// 覆盖:
//   ① 源码锚: 26-commander 单源 (dt 三态门/命令分发/dotVis/编制挂组/盖章) + 14 处外部接线
//     (14-bots CMD 块+两处 D16 门 / 15-vehicles 首分支 / 16-aircraft strike+重生清令 / 24-main 四线+帧 tick /
//     19-input Esc+右键+指针锁 / 20-player 定身+tool 门 / 22-hud 卡门+观战堵+设置+换局清理 / 23-deploy
//     盖章+编制挂尾+提示 / 18-game 死亡关图 / 21-match 结算关图 / 09a-defs 兵种+通讯仪 / 00-config 六阵营+isLoiterClass)
//   ② 兵种三件套 (真沙箱): CLASSES[5]/六阵营 cls[5]=radio+冲锋枪/通讯仪 def=WPN_DEFS.radio tool/
//     playerClassWeapons(0,5)/CLS_POOL 不含 5/vmEquip 真换装/playerFireTick 左键零枪声事件
//   ③ 双向锁+互斥: cmdClassCardGate 四文案 / cmdLockStamp 双向盖章 / cmdSpecToggleGate /
//     不开放图 (CAMPAIGN.navalN 就地翻转) / cmdResetMatch 清账
//   ④ 编制 (startBtn 真开局, 玩家未部署即存在): 步兵组 3~5 人/组且恰好瓜分全部散兵 / 玩家·小队·车组·
//     飞行员·敌军不进组 / 坦克飞机各成单位且 order 挂对象
//   ⑤ 命令: cmdOrderUnit 四词汇 / Bot.decide CMD 块 (远处 advance+寻路·到点 defend) / cmdBotCmd·cmdBotFree /
//     重生继承组令 (spawn 不清 cmdGrp) / 坦克 driveAI 吃令覆写 objective·free 即清 / 飞机 strike 一次性
//     (接近/投弹即 free / 无弹即中止)
//   ⑥ 减速: cmdDtGate 三态 (常速/×0.2/布势 0) + K 时停优先 (dt<=0 放行) / 读条收支 1/s·恢复 1/3·
//     耗尽只回常速 / 观战免费不减 (R8) / 死亡不可用 / selfExempt 超人档 (pdt/座驾豁免) / 设置项落 localStorage
//   ⑦ 指挥地图: 姿态门矩阵 (D18) / 开关+定身 (R11) / R12 dotVis 与小地图判据逐点对账 (全图开关/观战/死亡
//     旁路 + 视野圆) / 布势开关-冻结-确认解冻-宿主切换 (body↔#ui) / 配比增减+落装 (setClass) / 废墟补丁不炸
//   ⑧ 回归对账: index.html 脚本表 ↔ dev/_game_files.txt 双向一致 / 版本戳 20261115c 四处 / i18n 新键全配 /
//     非指挥官零回归 (cmdIsCommander false·dt 原样·slowOn false) / 小地图源码未动 (26 不碰 mmEnemyVis·
//     drawMinimap, 22-hud 不进 cmdMap)
//
// 口径: 与 verify-aimassist 同款 boot (_bootstub 桩 + 全链 FILES + startBtn.onclick 真开局),
//   调游戏自己的接口 (cmdOrderUnit / Bot.decide / Bot.spawn / Tank.update / Plane.update / cmdFrameTick /
//   playerFireTick), 不重写第二套状态机。
// ─────────────────────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const NEG=process.argv.includes('--neg');
const OK=[],BAD=[];
function assert(name,cond,detail){ (cond?OK:BAD).push(name); console.log(`  ${cond?'✓':'✗'} ${name}${detail?'  '+detail:''}`); }
function section(t){ console.log('\n══ '+t+' ══'); }
const SRC=f=>fs.readFileSync(path.join(root,f),'utf8');

// ── 阴性对照 (锚点用修后原文; 找不到就抛错, 防"锚点漂移后静默通过"; 全单行锚避开 CRLF 坑) ──
const PATCHES=[
 // A 帧长门退场: 布势冻结与减速都不再改帧长
 ['js/26-commander.js',
  "if(CMD.mapOn&&CMD.mapDeploy) return 0;",
  ";"],
 ['js/26-commander.js',
  "if(CMD.slowOn) return dt*CMD_TIME.SLOW_MUL;",
  ";"],
 // B 步兵 CMD 块退场 (decide 不再消费组令)。★锚点用内层 `const _co=...` 而不是外层 if 条件:
 //   外层条件 2026-10-26 排查轮已带上暂缓门 (见下面 I), 两条补丁抢同一行会互相踩锚点。
 ['js/14-bots.js',
  "const _co=this.cmdGrp.order;",
  "const _co=null;"],
 // C 编制挂组退场 (散兵不进组 ⇒ ④瓜分/⑤组令判据红)
 ['js/26-commander.js',
  "for(const b of members) b.cmdGrp=u;",
  ";"],
 // D 双向锁盖章退场 (锁不死 ⇒ ③判据红)
 ['js/26-commander.js',
  "CMD.lockedDir=(cls===5)?'in':'out';",
  "CMD.lockedDir=null;"],
 // E 坦克令首分支退场 (objective 不再被令覆写 ⇒ ⑤坦克判据红)
 ['js/15-vehicles.js',
  "const _cto=(typeof cmdTankCmd==='function')?cmdTankCmd(this):null;",
  "const _cto=null;"],
 // F 通讯仪 tool 火力门退场 (①源码锚红; ②gunEvents 判据保守不依赖它)
 ['js/20-player.js',
  "if(w&&w.def&&w.def.tool) canFire=false;",
  ";"],
 // G 读条耗尽迟滞退场 (还原成旧「耗尽即 slowOn=false」⇒ BUG7 逐帧抖动判据红)
 ['js/26-commander.js',
  "if(allowed&&costly&&CMD.slowLock){ CMD.slowOn=false; }",
  "if(allowed&&costly&&CMD.focus<=0){ CMD.slowOn=false; }"],
 // H 暂停冻结分支自愈退场 (还原成「只有 document.hidden 分支有自愈」⇒ BUG8 判据红)。
 //   2026-10-26 排查轮二审: 冻结分支里紧跟着加了 D20 暂停对账调用, 原锚点 ("…\n// 主菜单期") 已漂移;
 //   改用紧随其后的二审注释行作锚 (它只可能出现在冻结分支这一处)。
 ['js/24-main.js',
  "if(typeof cmdSlowFreezeHeal==='function') cmdSlowFreezeHeal();\n// ★2026-10-26 排查轮二审 修复 (D20 暂停菜单优先于指挥地图)",
  "if(false) cmdSlowFreezeHeal();\n// ★2026-10-26 排查轮二审 修复 (D20 暂停菜单优先于指挥地图)"],
 // I 组令敌近身暂缓门退场 (还原成旧 `if(this.cmdGrp){` ⇒ BUG9 判据红)
 ['js/14-bots.js',
  "if(this.cmdGrp&&!(engaged&&distT<20)){",
  "if(this.cmdGrp){"],
 // J 配比按钮绑定退场 (还原成漏写 b.onclick= 的裸执行 ⇒ BUG10 判据红)。
 //   注意: 只改 `b.onclick=()=>{` 会留下悬空的 `};` (语法错, 整个沙箱起不来), 必须把配对的收尾一起换成 IIFE。
 ['js/26-commander.js',
  "b.onclick=()=>{\nconst sq=+b.dataset.sq, ci=+b.dataset.ci, d=+b.dataset.d;",
  "(function(){\nconst sq=+b.dataset.sq, ci=+b.dataset.ci, d=+b.dataset.d;"],
 ['js/26-commander.js',
  "if(s){ cmdRatioAdj(s,ci,d); }\npnl._t=0; cmdMapPanelTick();\n};",
  "if(s){ cmdRatioAdj(s,ci,d); }\npnl._t=0; cmdMapPanelTick();\n})();"],
 // K 飞机词汇拒绝退场 (还原成静默改 free ⇒ BUG11 判据红)。
 //   2026-10-26 排查轮二审: free 分支补了 strikeT0 清理与说明注释, 原锚点 (else if(mode==='free')\{...) 已漂移;
 //   改成锚 plane 分支末尾那句"直接拒绝"的 return false —— 把它换成静默改 free 就回到旧语义 (没有 return false)。
 ['js/26-commander.js',
  "改为与步兵/坦克分支同规: 不认识的词汇直接拒绝 (return false), 调用方据此不给成功反馈。\nreturn false;",
  "改为与步兵/坦克分支同规: 不认识的词汇直接拒绝 (return false), 调用方据此不给成功反馈。\no.mode='free'; o.x=0; o.z=0;"],
 // L 右键关图退场 (删掉 cmdMapToggle 那两行 ⇒ BUG12 判据红)
 //   ★2026-10-27f 锚随码走: mousedown 末尾新增了中键拖动分支, 旧锚 (以收尾 }); 结尾) 不再命中,
 //   改锚到右键分支体本身 (到 else if(e.button===1) 为止)。
 ['js/26-commander.js',
  "if(CMD.mapDeploy) return;\ncmdMapToggle();\nreturn;\n}else if(e.button===1){",
  "if(CMD.mapDeploy) return;\nreturn;\n}else if(e.button===1){"],
 // M 部署页 null 守卫退场 (还原成裸 el('cw'+i).textContent ⇒ BUG13 判据红)
 ['js/23-deploy.js',
  "const _cw=el('cw'+i); if(_cw) _cw.textContent=classCardWeaponText(i);",
  "el('cw'+i).textContent=classCardWeaponText(i);"],
 // N keydown 开图早退退场 (⇒ BUG14 判据红)
 ['js/19-input.js',
  // ★2026-10-26 交互重做批: 早退块里新增了 cmdMapKeyGate 转发行, 锚点随之更新 (仍是"整个早退块"这一处)
  // ★2026-10-27 布势三命令键修复批: 行尾注释从"布势期只放行 R"改成"同规执行并消费", 锚点同步
  "if(typeof cmdMapUIOpen==='function'&&cmdMapUIOpen()){\nif(typeof cmdMapKeyGate==='function'&&cmdMapKeyGate(e.code)) return;   // 三命令键 (布势期与战斗期同规: 执行并消费)\nif(!(typeof CMD_TIME!=='undefined'&&e.code===CMD_TIME.KEY)) return;\n}",
  ";"],
 // ═══ 2026-10-26 排查轮二审新增负控 (每一条对应 ⑩ 段的一条断言) ═══
 // O R12 委托退场: dotVis 退回旧口径 (自己重算视野圆, 不读 mmEnemyVis) ⇒ R12 逐点一致判据红
 ['js/26-commander.js',
  "if(typeof mmEnemyVis==='function') return mmEnemyVis(x,z,lastFire);",
  "if(false) return true;"],
 // P R12 开火时间戳退场: 步兵消费点不再传 lastFiredT ⇒ 时间戳锚点判据红
 ['js/26-commander.js',
  "if(!cmdMapDotVis(s.pos.x,s.pos.z,s.lastFiredT)) continue;",
  "if(!cmdMapDotVis(s.pos.x,s.pos.z)) continue;"],
 // Q 布势整图退场: scale 回到 1 ⇒ 整图适配判据红
 ['js/26-commander.js',
  "CMD.view={cx:0,cz:0,scale:cmdMapFitScale()}; CMD._follow=false;",
  "CMD.view={cx:0,cz:0,scale:1}; CMD._follow=false;"],
 // R 视图跟随复位退场: 删掉开图处的 _follow=true ⇒ 跟随复位判据红
 ['js/26-commander.js',
  "CMD._follow=true;\nif(typeof player!=='undefined'&&player&&player.pos){",
  "if(typeof player!=='undefined'&&player&&player.pos){"],
 // S 坦克 thinkCD 退场 ⇒ 坦克令延迟判据红
 ['js/26-commander.js',
  "if(v.thinkCD!==undefined) v.thinkCD=0;",
  ";"],
 // T 配比越界守卫退场 (回到 b.cls%5) ⇒ 配比判据红
 ['js/26-commander.js',
  "const ci=(b&&typeof b.cls==='number'&&b.cls>=0&&b.cls<5)?(b.cls|0):-1;\nif(ci>=0) s.ratio[ci]++;",
  "s.ratio[b.cls%5]=(s.ratio[b.cls%5]||0)+1;"],
 // U 每帧复验退场 ⇒ R11 每帧复验判据红
 ['js/26-commander.js',
  "if(CMD.mapOn&&cmdMapMustClose()) cmdMapClose(true);",
  ";"],
 // V D20 暂停对账退场 (冻结分支与 tick 各一条, 只回退 24-main 的那条即可让"冻结分支接线"判据红)
 ['js/24-main.js',
  "if(typeof cmdMapPauseGate==='function') cmdMapPauseGate();\n",
  ""],
 // W 换局清指针退场 ⇒ 换局清旧指针判据红
 ['js/26-commander.js',
  "if(typeof soldiers!=='undefined') for(const b of soldiers){ if(b&&b.cmdGrp) b.cmdGrp=null; }",
  ";"],
 // X freeze HUD typeof 守卫退场 ⇒ 守卫判据红
 ['js/26-commander.js',
  "||(typeof matchOver!=='undefined'&&matchOver)){",
  "||matchOver){"],
 // Y 收图重锁的冻结态上限退场 (回到旧写: 暂停中也抢指针) ⇒ 重锁判据 + 行为判据红
 ['js/26-commander.js',
  " &&!(typeof gamePaused!=='undefined'&&gamePaused)\n &&!(typeof menuHold!=='undefined'&&menuHold)){\nlockPointer();",
  " &&true){\nlockPointer();"],
 // Z 布势可重进退场 (回到 !CMD.deploySeen 一票否决) ⇒ 可重进判据红
 //   ★2026-10-27 排查批: 门条件去掉了 `player.cls===5` 子条件 (撤销→改选他兵种→再点指挥官卡时
 //   布势也要自动弹, 见 22-hud 同日注释) —— 退场锚随码走。
 ['js/22-hud.js',
  "(!CMD.deploySeen||(!player.deployed&&!matchOver))",
  "(!CMD.deploySeen)"],
 // AA 触控指挥官键退场 (删掉 tCmdMap 绑定) ⇒ B-8 判据红
 ['js/24-main.js',
  "bindBtn('tCmdMap',()=>{\nif(typeof cmdMapToggle==='function') cmdMapToggle();\n},null);",
  ""],
 // AB 底图预算式分帧烘焙退场 (回到"渲染帧内同步整烘") ⇒ 分帧判据红
 //   锚在 cmdBakeAdvance 的预算早退行: 去掉它, 作业就一次跑完 (bakeNullWhileBusy/frames 都不再成立)
 ['js/26-commander.js',
  "if(!unlimited&&hasT&&(performance.now()-t0)>=budgetMs) return false;",
  ";"],
 // AC 帧 tick 预热接线退场 (cmdFrameTick 不再推进作业) ⇒ 开图后底图永不落账
 //   锚在 cmdFrameTick 里那条唯一调用 (与 cmdMapDraw 里的起作业行不同名)
 ['js/26-commander.js',
  "if(CMD._bj){ try{ cmdBakeAdvance(CMD_BAKE_BUDGET_MS); }catch(e){ CMD._bj=null; } }",
  ""],
 // ═══ 2026-10-27f 排查批新增负控 (每一条对应"排查批三虫"段的一条断言) ═══
 // AD 中键拖动启动退场 (mousedown 不再给 drag 赋值/不再清 _follow ⇒ 平移接线判据红)。
 //   语法等价: else if(e.button===1){ 块体只剩 return;, 分支合法但功能死 —— 正是修复前的形态。
 ['js/26-commander.js',
  "drag={x:e.clientX,y:e.clientY};\nCMD._follow=false;\nreturn;\n}\n});",
  "return;\n}\n});"],
 // AE 票尽清空接线退场 (cmdFrameTick 不再调 cmdOrbatPrune ⇒ 接线判据红)
 ['js/26-commander.js',
  "cmdOrbatPrune();   // 票尽清空 (设计 D 条款补实现, 见 cmdOrbatPrune): 死透且无票的单位当帧出编制",
  ";"],
 // AF 票尽清空判据退场 (函数体守卫短路 ⇒ 行为判据红)
 ['js/26-commander.js',
  "function cmdOrbatPrune(){\nif(!CMD.orbat||typeof tickets==='undefined'||!tickets) return;",
  "function cmdOrbatPrune(){\nreturn;"]
];
const PATCH_MAP={};
if(NEG) for(const [f,from,to] of PATCHES){
 const s=PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f);
 if(s.indexOf(from)<0) throw new Error('阴性对照锚点未找到: '+f+' :: '+from.slice(0,70));
 PATCH_MAP[f]=s.split(from).join(to);
}
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f));

// ── ① 源码防回退 ──────────────────────────────────────────────
section('① 源码防回退 (修好的写法在 / 旧写法不在)');
{
const s26=srcOf('js/26-commander.js');
assert('26 帧长三态门单源 (布势 0 / 减速 ×SLOW_MUL / K 时停 dt<=0 放行)',
 s26.includes('if(typeof dt!==\'number\'||dt<=0) return dt;')
 &&s26.includes('if(CMD.mapOn&&CMD.mapDeploy) return 0;')
 &&s26.includes('if(CMD.slowOn) return dt*CMD_TIME.SLOW_MUL;'));
assert('26 D5 锚点参数单源 (0.2x / 读条 7s / 恢复=消耗 1/3) + 耗尽迟滞阈值 REARM_FRAC',
 s26.includes('const CMD_TIME={ SLOW_MUL:0.2, FOCUS_MAX:7, REGEN_MUL:1/3, REARM_FRAC:0.25, KEY:\'KeyV\' };'));
// 2026-10-26 排查轮: 耗尽判据从「当帧 slowOn=false」改为迟滞锁 CMD.slowLock (防耗尽↔恢复逐帧抖动),
// 语义不变 —— 仍只强制回常速, 不关地图不锁功能。
assert('26 读条耗尽只强制回常速不关地图 (D5), 恢复走 REGEN_MUL',
 s26.includes('if(allowed&&costly&&CMD.slowLock){ CMD.slowOn=false; }')
 &&s26.includes('CMD.focus=Math.min(CMD_TIME.FOCUS_MAX,CMD.focus+rdt*CMD_TIME.REGEN_MUL);'));
assert('26 观战减速免费 (R8): costly 判据 spectator 恒免',
 s26.includes('function cmdSlowCostly(){ return !player.spectator&&CMD_SETTINGS.focusCost; }'));
// ★2026-10-26 排查轮二审: R12 口径从「自己重算一套」改为「委托 mmEnemyVis 单源 + 视野圆」。
//   断言随之改成"委托关系 + 三个调用点都带开火时间戳"—— 这才是设计 R12 原文要求的东西。
// ★2026-10-26 排查轮二审: R12 的"完全复用"分两层落地 ——
//   ① 点位判据 = mmEnemyVis 单源 (全图开关/观战/死亡/近显/开火窗, 一条不多一条不少);
//   ② 视野圆 = getMapVisDist 单源, 但**只**用在远处的压暗蒙版上 (与小地图"画全量点 + 蒙版盖住"同画法),
//      不再进点位过滤 —— 否则指挥地图会比小地图多滤一层 (旧实现的差集正是这么来的)。
assert('26 R12 敌显单源: dotVis 全权委托 mmEnemyVis(带 lastFire), 不自带天气/视野圆判据',
 s26.includes('function cmdMapDotVis(x,z,lastFire){')
 &&s26.includes('if(typeof mmEnemyVis===\'function\') return mmEnemyVis(x,z,lastFire);'));
assert('26 R12 视野圆单源: 压暗蒙版读 getMapVisDist (与小地图第 2 层同判据同渐变)',
 s26.includes('const vd=(typeof getMapVisDist===\'function\')?getMapVisDist():9999;')
 &&s26.includes('const g2=c.createRadialGradient(ppx,ppy,Math.max(0,rPx*0.72),ppx,ppy,Math.max(rPx,12));'));
assert('26 R12 三个敌显消费点都传实体开火时间戳 (与小地图逐点同源: 步兵/坦克 crew/飞机 max(crew,crewBot))',
 s26.includes('if(!cmdMapDotVis(s.pos.x,s.pos.z,s.lastFiredT)) continue;')
 &&s26.includes('if(!cmdMapDotVis(t.pos.x,t.pos.z,t.crew&&t.crew.lastFiredT)) continue;')
 &&s26.includes('if(!cmdMapDotVis(pl.pos.x,pl.pos.z,Math.max(pl.crew?pl.crew.lastFiredT:-99,pl.crewBot?pl.crewBot.lastFiredT:-99))) continue;'));
assert('26 视野圆蒙版内半径系数与小地图同源 (0.72 渐变沿)',
 s26.includes('const g2=c.createRadialGradient(ppx,ppy,Math.max(0,rPx*0.72),ppx,ppy,Math.max(rPx,12));'));
assert('26 编制挂组不挂人 (D16) + 组令消费从 bot.cmdGrp.order 读',
 s26.includes('for(const b of members) b.cmdGrp=u;')
 &&s26.includes('const o=bot.cmdGrp.order;'));
assert('26 命令分发单源: inf 重置 decisionT/repathT/path/defendPt, tank 重置 repathT/path, plane strike 一次性',
 s26.includes('for(const b of unit.members){ if(b){ b.decisionT=0; b.repathT=0; b.path=null; b.defendPt=null; } }')
 &&s26.includes('v.repathT=0; if(v.path!==undefined) v.path=null;')
 &&s26.includes('pl.strikePt={x:+x,z:+z}; pl.strikeT0='));
assert('26 R10 双向锁盖章单源 + 不开放图无"选入"可言',
 s26.includes("CMD.lockedDir=(cls===5)?'in':'out';")
 &&s26.includes("if(!cmdClassAvailable()) { CMD.lockedDir='out'; return; }"));
assert('26 R11 开图定身 (布势期除外) + D18 姿态门单源 (载具/阵位/伞降/游泳/控弹全堵)',
 s26.includes('function cmdMapImmobilized(){ return CMD.mapOn&&!CMD.mapDeploy; }')
 &&s26.includes('if(p.onVehicle||p.onNaval||p.onMG||p.onAT||p.onAA||p.onMortar||p.onBattery||p.loiter) return false;')   // (2026-11-10 跟码: capitalGun 项随大舰子系统下架摘除)
 &&s26.includes('if(!p.onGround||p.chute||p.swim||p.flying) return false;'));
assert('26 D21 布势宿主切换 (body↔#ui, inDeploy 压制网外的自管显隐) + 确认开战解冻口径',
 s26.includes('function cmdMapReparent(forDeploy){')
 &&s26.includes("const want=forDeploy?document.body:document.getElementById('ui');")
 &&s26.includes('function cmdDeployConfirm(){')
 &&s26.includes('CMD.mapDeploy=false;'));
assert('26 D19 废墟补丁: 挂 g.onDead 包装 (不覆盖既有回调) + 单点重画不做全图重烘',
 s26.includes('g.onDead=(gg)=>{ try{ cmdMarkRubble(gg); }catch(e){} if(prev) prev(gg); };')
 &&s26.includes('function cmdMarkRubble(g){'));

const s14=srcOf('js/14-bots.js');
// 2026-10-26 排查轮: CMD 块补上了「敌近身暂缓执行」门 (与 SQUAD 块同规 engaged&&distT<20),
// 故入口条件从 `if(this.cmdGrp){` 变为 `if(this.cmdGrp&&!(engaged&&distT<20)){`。
assert('14-bots decide CMD 块就位 (SQUAD 同款拦截式: 远 advance+寻路 / 到点非交战 defend)',
 s14.includes('if(this.cmdGrp&&!(engaged&&distT<20)){')
 &&s14.includes("const _co=this.cmdGrp.order;")
 &&s14.includes("this.state='advance';"));
// 本条防的是「令压过自卫」: 敌人贴脸时组令必须让位给接战 (设计 §5 不动决策核心)。
assert('14-bots CMD 块敌近身暂缓门与 SQUAD 块同源 (engaged&&distT<20, 同一条判据不另立阈值)',
 /if\(this\.cmdGrp&&!\(engaged&&distT<20\)\)\{/.test(s14)
 &&s14.includes('if(this.inSquad&&!player.spectator&&!(engaged&&distT<20)){')); /* ★2026-11-13 观战中立批跟码: SQUAD 块加 spectator 门 */
assert('14-bots D16 双门就位: 重生自动上车与 decide 认领两处都过 cmdBotFree 单源',
 s14.includes("if(!this.inSquad&&(typeof cmdBotFree==='function'?cmdBotFree(this):true)){")
 &&(s14.match(/cmdBotFree\(this\):true/g)||[]).length===2);

const s15=srcOf('js/15-vehicles.js');
assert('15-vehicles driveAI 首分支吃令 (覆写 objective) + free 即清 (_cmdHad 让默认选点即刻重选)',
 s15.includes("const _cto=(typeof cmdTankCmd==='function')?cmdTankCmd(this):null;")
 &&s15.includes('this.objective={x:_cto.x,z:_cto.z};')
 &&s15.includes('this._cmdHad=false;'));

const s16=srcOf('js/16-aircraft.js');
assert('16-aircraft strike 块就位 (一次性: 投出/无弹/超时 45s 即 free, 不占 state 保持缠斗自卫优先)',
 s16.includes('if(this.strikePt){')
 &&s16.includes("if(this.cmdOrder){ this.cmdOrder.mode='free'; this.cmdOrder.x=0; this.cmdOrder.z=0; }")
 &&s16.includes('nowT-(this.strikeT0||0)>45'));
assert('16-aircraft 机毁重生不带令 (respawn 清 strikePt)',
 s16.includes('this.strikePt=null;'));

const s24=srcOf('js/24-main.js');
assert('24-main 帧长接线四线全就位 (dt 门 / pdt 超人档 / vdt 座驾豁免 / 帧 tick 真实帧长)',
 s24.includes("const dt=(typeof cmdDtGate==='function')?cmdDtGate(rdt,dt0):dt0;")
 &&s24.includes("const pdt=(typeof cmdPlayerDt==='function')?cmdPlayerDt(pdt0,rdt):pdt0")
 &&s24.includes("const vdt=(v)=>(typeof cmdRideDt==='function')?cmdRideDt(v,vdt0(v),rdt):vdt0(v);")
 &&s24.includes("if(typeof cmdFrameTick==='function') cmdFrameTick(rdt);"));

const s19=srcOf('js/19-input.js');
assert('19-input 三接线: Esc 先关指挥地图 / 通讯仪右键开图 (姿态门内聚 cmdMapToggle) / 丢锁不弹部署页',
 s19.includes("if(typeof cmdMapUIOpen==='function'&&cmdMapUIOpen()){")
 &&s19.includes("if(typeof cmdDeployPhase==='function'&&cmdDeployPhase()&&typeof cmdDeployConfirm==='function') cmdDeployConfirm();")
 &&s19.includes("else if(typeof cmdMapClose==='function') cmdMapClose(true);")
 &&s19.includes("player.curW.key==='radio'&&typeof cmdMapToggle==='function'")
 &&s19.includes('const inCmdMap=(typeof cmdMapUIOpen===\'function\')&&cmdMapUIOpen();'));

const s20=srcOf('js/20-player.js');
assert('20-player 定身门 (R11: 开图期移动/倾身/跳跃全零) + 通讯仪 tool 火力门',
 s20.includes('const cmdLock=(typeof cmdMapImmobilized===\'function\')&&cmdMapImmobilized();')
 &&s20.includes('const fwd=cmdLock?0:(keys.KeyW?1:0)-(keys.KeyS?1:0);')
 &&s20.includes('if(w&&w.def&&w.def.tool) canFire=false;'));

const s22=srcOf('js/22-hud.js');
// ★2026-10-26 排查轮二审: 「首选指挥官卡自动进布势」的口径扩成「首次自动弹 + 部署页可重进」——
//   旧条件 !CMD.deploySeen 一票否决 ⇒ 玩家在布势里确认开战后 (人还没落地) 想再调配比, 点卡毫无反应。
assert('22-hud 五接线: 不开放图不建卡 / 卡点击过 R10 门 / 指挥官卡进布势 (首弹+部署页可重进) / 观战开关过 D15 门 / 换局 cmdResetMatch',
 s22.includes("if(i===5&&typeof cmdClassAvailable==='function'&&!cmdClassAvailable()) return;")
 &&s22.includes('const gate=cmdClassCardGate(i);')
 &&s22.includes('if(i===5&&typeof CMD!==\'undefined\'&&typeof cmdDeployOpen===\'function\'')
 &&s22.includes("(!CMD.deploySeen||(!player.deployed&&!matchOver))")
 &&s22.includes('const _sg=cmdSpecToggleGate();')
 &&s22.includes("if(typeof cmdResetMatch==='function') cmdResetMatch();"));
assert('22-hud 设置两开关接线 (sf_cmd_focus/sf_cmd_self, cmdSettingsSet 单源)',
 s22.includes("const fb=el('cmdFocusBtn');")
 &&s22.includes("const sb=el('cmdSelfBtn');")
 &&s22.includes("cmdSettingsSet('focusCost',!CMD_SETTINGS.focusCost)")
 &&s22.includes("cmdSettingsSet('selfExempt',!CMD_SETTINGS.selfExempt)"));
// ★2026-10-27 排查批 判据跟走: 观战减速词条接线到 cmdSpecHudKeys 单源 + 键名 V (换键批漏改的三处
//   N 残留之一 —— 旧判据 `s22.includes('N=减速(不耗资源)')` 钉的是**错误键名**且使词典查表必 miss)。
//   新判据: 22-hud 不再硬编码整条词条, 而是前缀 + cmdSpecHudKeys() 拼回整句键 (查表命中, 英文可译)。
assert('22-hud 观战 HUD 行减速词条走 cmdSpecHudKeys 单源 (R8 共键免费, 键名 V)',
 s22.includes("(typeof cmdSpecHudKeys==='function')?cmdSpecHudKeys():' · V=减速'")
 &&!s22.includes('N=减速(不耗资源)'));

const s23=srcOf('js/23-deploy.js');
assert('23-deploy 五接线: 卡渲染过门 / deployPlayer 盖章 / 指挥官部署提示 / 兵种卡弹药文案 cls5 / startMatch 尾建编制',
 s23.includes('const cmdLocked=(typeof cmdClassCardGate===\'function\')?cmdClassCardGate(i):null;')
 &&s23.includes('if(typeof cmdLockStamp===\'function\') cmdLockStamp(p.cls);')
 &&s23.includes("if(typeof cmdDeployHint==='function') cmdDeployHint();")
 &&s23.includes('if(i===5){ const g=clsGear(i,player.team);')
 &&s23.includes('if(typeof cmdOrbatBuild===\'function\') cmdOrbatBuild();'));
// ★2026-10-27 排查批 判据跟走: 旧断言 `s23.includes('J=信息层 · N=减速')` 实际是被**注释**喂绿的
//   (词条本体是运行期拼接, 源码里不存在整句; 注释里的旧键名样例恰好含该子串 = 探针假绿)。
//   新判据钉真实拼接行 (cmdSpecHudKeys 转发 + V 字面量兜底), 并否定旧键名残留。
assert('23-deploy 观战部署提示行减速词条走 cmdSpecHudKeys 单源 (键名 V)',
 s23.includes("'+((typeof cmdSpecHudKeys==='function')?cmdSpecHudKeys():' · V=减速'));")
 &&!s23.includes('N=减速'));

const s18=srcOf('js/18-game.js');
assert('18-game 玩家死亡强制关图 (D1: 死亡期不能下令)',s18.includes("if(typeof cmdMapForceClose==='function') cmdMapForceClose();"));
const s21=srcOf('js/21-match.js');
assert('21-match 结算强制关图 (D20)',
 (s21.match(/cmdMapForceClose\(\);/g)||[]).length>=1&&s21.includes('function endMatch('));

const s09a=srcOf('js/09a-defs.js');
assert('09a-defs 兵种表: CLASSES[5]=指挥官 (commander 旗) + CLS_POOL 不含 5 (Bot 永不出指挥官)',
 s09a.includes("{ name:'指挥官', nades:2, smoke:2, incin:2, atn:4, commander:true }")
 &&s09a.includes('const CLS_POOL=[0,0,0,0,1,1,1,2,3,3,3,4,4,4];'));
assert('09a-defs 通讯仪武器定义 (工具型: 无弹匣无备弹, radio 旗, 右键开图)',
 s09a.includes("radio:{ name:'通讯仪', mode:'工具 · 右键指挥地图', type:'tool'")
 &&s09a.includes('tool:true, radio:true'));

const scfg=srcOf('js/00-config.js');
assert('00-config 六阵营 cls 第六行全配 [radio, 阵营冲锋枪] (阵营缩水枪不共用)',
 scfg.includes("['radio','thompson']")&&scfg.includes("['radio','mp40']")&&scfg.includes("['radio','ppsh']")
 &&scfg.includes("['radio','type100']")&&scfg.includes("['radio','mp18']")&&scfg.includes("['radio','c96auto']"));
assert('00-config 实验模式重映射只认 cls===3 (指挥官 cls5 不被巡飞弹兵波及)',
 scfg.includes("let ws=(EXPERIMENT&&cls===3)?['loiter',TEAM_FACTION[team].cls[3][1]]:TEAM_FACTION[team].cls[cls];"));assert('00-config isLoiterClass 仍锚 cls===3 (旧写 cls===5 已修, 不与指挥官撞)',
 scfg.includes('function isLoiterClass(){ return EXPERIMENT&&player.cls===3; }')
 &&!scfg.includes('isLoiterClass(){ return EXPERIMENT&&player.cls===5; }'));

const s09w=srcOf('js/09-weapons.js');
assert('09-weapons 通讯仪第一人称模型分支 (机身/面板/旋钮/斜天线/话筒)',
 s09w.includes("} else if(key==='radio'){"));

const sidx=SRC('index.html');
{
const i25=sidx.indexOf('js/25-zombies.js'),i26=sidx.indexOf('js/26-commander.js'),i24=sidx.indexOf('js/24-main.js');
assert('index.html: 26-commander 脚本行 (25-zombies 之后 24-main 之前) + 设置两按钮',
 sidx.includes('<script src="js/26-commander.js?v=20261115c"></script>')
 &&i25>=0&&i25<i26&&i26<i24
 &&sidx.includes('id="cmdFocusBtn"')&&sidx.includes('id="cmdSelfBtn"'));
}
}

// ── 沙箱装载 (_bootstub 桩; 与 verify-aimassist 同款) ─────────
const {sandbox,document,window}=require('./_bootstub.js');
const V3c=sandbox.THREE.Vector3;
if(!V3c.prototype.addScalar) V3c.prototype.addScalar=function(s){ this.x+=s; this.y+=s; this.z+=s; return this; };
if(!V3c.prototype.divideScalar) V3c.prototype.divideScalar=function(s){ s=s||1; this.x/=s; this.y/=s; this.z/=s; return this; };
if(!V3c.prototype.clampScalar) V3c.prototype.clampScalar=function(a,b){ this.x=Math.min(b,Math.max(a,this.x)); this.y=Math.min(b,Math.max(a,this.y)); this.z=Math.min(b,Math.max(a,this.z)); return this; };
if(!V3c.prototype.project) V3c.prototype.project=function(){ this.x=0; this.y=0; this.z=1; return this; };
if(!V3c.prototype.cross) V3c.prototype.cross=function(v){ return this.crossVectors(this,v); };
if(!V3c.prototype.negate) V3c.prototype.negate=function(){ this.x=-this.x; this.y=-this.y; this.z=-this.z; return this; };
for(const k of ['MeshLambertMaterial','MeshBasicMaterial','MeshStandardMaterial','MeshPhongMaterial','PointsMaterial','SpriteMaterial']){
const C=sandbox.THREE[k];
if(!C||!C.prototype) continue;
if(!C.prototype.clone) C.prototype.clone=function(){ return new C(Object.assign({},this,{color:this.color})); };
if(!C.prototype.dispose) C.prototype.dispose=function(){};
}
const O3=sandbox.THREE.Object3D;
if(O3&&O3.prototype&&!O3.prototype.clear) O3.prototype.clear=function(){ if(this.children) this.children.length=0; return this; };
const BA=sandbox.THREE.BufferAttribute;
if(BA&&BA.prototype&&!BA.prototype.setXYZ) BA.prototype.setXYZ=function(i,x,y,z){ if(this.array){ this.array[i*this.itemSize]=x; this.array[i*2+1]=y; this.array[i*3+2]=z; } return this; };
if(!sandbox.THREE.Line) sandbox.THREE.Line=class extends O3{constructor(g,m){super();this.geometry=g||{};this.material=m||{};this.isLine=true;}};
const AP=()=>({value:0,setValueAtTime(){},setTargetAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}});
const ACStub=class{
createOscillator(){return {frequency:AP(),detune:AP(),type:'',start(){},stop(){},connect(){},onended:null};}
createGain(){return {gain:AP(),connect(){},disconnect(){}};}
createBuffer(){return {getChannelData:()=>new Float32Array(16),duration:1,numberOfChannels:1};}
createBufferSource(){return {buffer:null,loop:false,playbackRate:AP(),start(){},stop(){},connect(){}};}
createBiquadFilter(){return {type:'',frequency:AP(),detune:AP(),Q:AP(),connect(){}};}
createDynamicsCompressor(){return {threshold:AP(),ratio:AP(),attack:AP(),release:AP(),connect(){}};}
createStereoPanner(){return {pan:AP(),connect(){}};}
resume(){return Promise.resolve();} get state(){ return 'running'; } get destination(){ return {}; }
get currentTime(){ return 0; } get sampleRate(){ return 44100; }
};
sandbox.AudioContext=ACStub; sandbox.window.AudioContext=ACStub; sandbox.window.webkitAudioContext=ACStub;
sandbox.confirm=()=>true;
delete sandbox.window.CANNON;

// 全链文件表 (与 index.html 同序; verify-boot 的 44 张 + 26-commander 插在 25-zombies 与 24-main 之间)
const FILES=['js/00-config.js','js/00b-i18n.js','js/00c-procgen.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/19b-gamepad.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/22a-menuart.js','js/22b-speclayer.js','js/23-deploy.js','js/23b-worldrestore.js','js/25-zombies.js','js/26-commander.js','js/24-main.js'];
const CAMP=8;   // 草原遭遇 (与 verify-tankai/verify-nadecancel 同图): 标准陆战, 坦克+飞机齐, 无海战编制

// extraStore: 追加存档项 (2026-10-26 排查轮二审: R12 的夜/雨规必须在真 NIGHT_MODE 下对账,
//   而 NIGHT_MODE / WX_MM_NEAR / WX_MM_FIRE 都是 js/00-config 的 const, boot 之后改不动 ——
//   只能在 boot 前把 sf_daynight 塞进 localStorage, 让它们按夜档算出来。)
function boot(campIdx,extraStore){
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document; ctx.window=window;
ctx.localStorage={_s:Object.assign({sf_campaign:String(campIdx)},extraStore||{}),getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
ctx.console={log:(...a)=>{ const s=a.map(x=>String(x)).join(' '); if(!/^\[(地形|HUD|NAV|世界|音频)/.test(s)) console.log(...a); }, warn:console.warn.bind(console), error:console.error.bind(console)};
for(const f of FILES){ vm.runInContext(srcOf(f),ctx,{filename:f}); }
return ctx;
}

let CTX=null;
function run(code){ return vm.runInContext(code,CTX,{timeout:600000}); }
function bootGame(){
CTX=boot(CAMP);
const st=run(`(()=>{ try{ const b=document.getElementById('startBtn'); if(b&&b.onclick){ b.onclick(); return 'ok'; } return 'no-button'; }catch(e){ return 'ERR '+String(e&&e.stack||e).slice(0,400); } })()`);
return st;
}

// ── ② 兵种三件套 ─────────────────────────────────────────────
{
section('② 兵种三件套 (真沙箱, 开局前)');
const st=bootGame();
assert('开局链真路径 startBtn.onclick 无异常',st==='ok',st==='ok'?'':' '+st);
const cls=run(`(()=>{ const out={};
out.orbatBoot=(CMD.orbat!==null); out.deployedBoot=player.deployed;   // 开局即建编制取证 (③的 cmdResetMatch 会清账, 此处先钉)
out.len=CLASSES.length;
out.c5=!!(CLASSES[5]&&CLASSES[5].commander);
out.gear={nades:CLASSES[5].nades,atn:CLASSES[5].atn,smoke:CLASSES[5].smoke,incin:CLASSES[5].incin};
out.radioDef=!!(WPN_DEFS.radio&&WPN_DEFS.radio.tool&&WPN_DEFS.radio.mag===0&&WPN_DEFS.radio.reserve===0&&WPN_DEFS.radio.radio);
out.pw0=playerClassWeapons(0,5);
out.poolHas5=CLS_POOL.includes(5);
out.sec=out.pw0[1]; out.secType=WPN_DEFS[out.sec]?WPN_DEFS[out.sec].type:null;
out.g5=clsGear(5,0);
return out; })()`);
assert('开局即建编制 (startMatch 尾, 玩家未部署)',cls.orbatBoot===true&&cls.deployedBoot===false);
assert('CLASSES 表 6 行且 [5]=指挥官 (commander 旗)',cls.len===6&&cls.c5===true);
assert('指挥官装备=突击兵档 (R2: 绷带/手雷/AT雷×4)',cls.gear.nades===2&&cls.gear.atn===4&&cls.gear.smoke===2&&cls.gear.incin===2);
assert('通讯仪武器 def: tool 型无弹匣无备弹 (无火力)',cls.radioDef===true);
assert('playerClassWeapons(team,5) 主武器=通讯仪 (重映射只认 cls3, 见①源码锚)',
 Array.isArray(cls.pw0)&&cls.pw0[0]==='radio',
 JSON.stringify(cls.pw0));
assert('副武器=阵营冲锋枪 (R2, 非工具型)',typeof cls.sec==='string'&&cls.sec!=='radio'&&cls.secType!=='tool'&&cls.secType!==null,cls.sec);
assert('CLS_POOL 不含 5 ⇒ Bot 永不出指挥官',cls.poolHas5===false);
assert('clsGear(5) 与 cls0 同配 (卡片弹药文案同源)',cls.g5&&cls.g5.atn===4);

const rf=run(`(()=>{ const out={};
vmEquip('radio',0);
out.vmOK=!!(VM&&VM.gunParts); out.vmState=VM.state;
const p=player; p.alive=true; p.isPlayer=true; p.spectator=false; p.hp=100; p.protUntil=0;
p.onMG=null; p.onVehicle=null; p.onAT=null; p.onAA=null; p.onMortar=null; p.streakBuff=null; p.recoil=0;
p.slots=[{key:'radio',def:WPN_DEFS.radio,mag:0,reserve:0}]; p.curW=p.slots[0]; p.curSlot=0;
VM.state='idle'; VM.stateT=0; VM.stateDur=0; vmSndFlags={};
const ge0=gunEvents.length;
for(let i=0;i<130;i++){ playerFireTick(1/60,true); updateViewModel(1/60,p); }
out.geDelta=gunEvents.length-ge0; out.mag=p.slots[0].mag;
return out; })()`);
assert('vmEquip 真换装链: 通讯仪上模特判不炸',rf.vmOK===true);
assert('通讯仪左键按住 2s+ 零枪声事件零耗弹 (tool 火力门)',rf.geDelta===0&&rf.mag===0,`geΔ=${rf.geDelta} mag=${rf.mag}`);
}

// ── ③ 双向锁 + 互斥 ─────────────────────────────────────────
{
section('③ R10 整局双向锁 + D15 观战互斥 (真沙箱)');
const lk=run(`(()=>{ const out={};
player.spectator=false; if('specWant' in player) player.specWant=null;
// 首次部署前: 两卡都可选
out.fresh5=cmdClassCardGate(5); out.fresh0=cmdClassCardGate(0);
// 选入指挥官: 'in' = 其余卡全锁, 指挥官卡仍可 (死亡重生再部署还是指挥官)
cmdLockStamp(5);
out.in0=cmdClassCardGate(0); out.in1=cmdClassCardGate(1); out.in5=cmdClassCardGate(5);
out.inSpec=cmdSpecToggleGate();
// 换局清账
cmdResetMatch();
out.resetDir=(CMD.lockedDir===null);
// 选入他种: 'out' = 指挥官卡锁, 其余卡自由
cmdLockStamp(0);
out.out5=cmdClassCardGate(5); out.out0=cmdClassCardGate(0); out.outSpec=cmdSpecToggleGate();
// 观战态下指挥官卡 = 互斥文案 (D15 反向)
cmdResetMatch(); player.spectator=true;
out.spec5=cmdClassCardGate(5);
player.spectator=false;
return out; })()`);
assert('首次部署前: 指挥官卡/步兵卡都可选',lk.fresh5===null&&lk.fresh0===null);
assert("选入指挥官='in': 步兵/突击卡全锁 ('本局已锁定指挥官'), 指挥官卡仍可选",
 lk.in0==='本局已锁定指挥官'&&lk.in1==='本局已锁定指挥官'&&lk.in5===null);
assert("指挥官局观战开关置灰 (D15: '指挥官局不能开观战')",lk.inSpec==='指挥官局不能开观战');
assert('cmdResetMatch 清锁 (换局零残留)',lk.resetDir===true);
assert("选入他种='out': 指挥官卡锁 ('本局未选指挥官'), 其余卡自由, 观战开关不受堵",
 lk.out5==='本局未选指挥官'&&lk.out0===null&&lk.outSpec===null);
assert("观战态下指挥官卡 = '与观战模式互斥' (D15 反向)",lk.spec5==='与观战模式互斥');
// D3 不开放图: startNewGame 会把 CAMPAIGN 指回**冻结的原表对象** (22-hud:1926), 就地改属性是静默 no-op ——
// 用"未开局"的干净 ctx (载入期 CAMPAIGN=deepClone 可写) 测 navalN/capital 两分支与盖章口径。
{
const ctx2=boot(CAMP);
const nv=vm.runInContext(`(()=>{ const out={};
out.avail0=cmdClassAvailable();
CAMPAIGN.navalN=[2,3];
out.availN=cmdClassAvailable(); out.gateN=cmdClassCardGate(5);
cmdLockStamp(5); out.stampN=CMD.lockedDir;
CAMPAIGN.navalN=undefined; delete CAMPAIGN.navalN;
CAMPAIGN.capital=['cx'];
out.availC=cmdClassAvailable(); out.gateC=cmdClassCardGate(5);
delete CAMPAIGN.capital;
out.availBack=cmdClassAvailable();
return out; })()`,ctx2);
assert("海战编制图 (navalN/capital): 兵种卡 '本图不开放', 盖章直接 'out', 撤标记即恢复 (D3)",
 nv.avail0===true&&nv.availN===false&&nv.gateN==='本图不开放'&&nv.stampN==='out'
 &&nv.availC===false&&nv.gateC==='本图不开放'&&nv.availBack===true,
 JSON.stringify(nv));
}
}

// ── ④ 编制 (开局即存在, 玩家未部署) ─────────────────────────
{
section('④ 开局编制 (startMatch 尾, 玩家未部署即存在)');
const ob=run(`(()=>{ const out={};
if(!CMD.orbat) cmdOrbatBuild();   // ③ cmdResetMatch 清过账: 用 startMatch 尾同一单源重建 (开局存在性已在②取证)
out.deployed=player.deployed;
out.orbat=!!CMD.orbat;
const foot=soldiers.filter(s=>s&&s.team===player.team&&!s.onVehicle&&!s.pilotOf&&!s.inSquad&&!s.capCrew&&!s.zombie);
const sq=CMD.orbat.squads;
out.footN=foot.length; out.squadN=sq.length;
out.sizes=sq.map(s=>s.members.length);
out.sum=sq.reduce((a,s)=>a+s.members.length,0);
out.allGrp=sq.every(s=>s.members.every(b=>b.cmdGrp===s));
out.partition=sq.every(s=>s.members.every(b=>foot.includes(b)))&&foot.every(b=>sq.some(s=>s.members.includes(b)));
out.playerNotIn=!sq.some(s=>s.members.includes(player));
out.squadNotIn=!sq.some(s=>s.members.some(b=>b.inSquad));
out.vehNotIn=!sq.some(s=>s.members.some(b=>b.onVehicle||b.pilotOf));
out.enemyNotIn=!sq.some(s=>s.members.some(b=>b.team!==player.team));
out.tankN=CMD.orbat.tanks.length;
out.tankExpect=tanks.filter(t=>t&&t.team===player.team).length;
out.tankOrder=CMD.orbat.tanks.every(u=>u.veh&&u.veh.cmdOrder===u.order);
out.planeN=CMD.orbat.planes.length;
out.planeExpect=planes.filter(p=>p&&p.team===player.team).length;
out.planeOrder=CMD.orbat.planes.every(u=>u.veh&&u.veh.cmdOrder===u.order&&u.veh.strikePt===null);
out.enemyTankNotIn=CMD.orbat.tanks.every(u=>u.veh.team===player.team);
return out; })()`);
assert('编制重建 (cmdOrbatBuild 单源, 玩家未部署) — 开局存在性见②',ob.deployed===false&&ob.orbat===true);
assert(`步兵组数 = ceil(${ob.footN}/5) 且每组 3~5 人`,
 ob.squadN===Math.max(1,Math.ceil(ob.footN/5))&&ob.sizes.every(n=>n>=3&&n<=5),
 `组规模 ${JSON.stringify(ob.sizes)}`);
assert('组员恰好吃掉全部散兵 (无重无漏), 且 cmdGrp 指回本组',ob.sum===ob.footN&&ob.partition===true&&ob.allGrp===true);
assert('玩家/玩家小队/车组/飞行员/敌军都不进步兵组',
 ob.playerNotIn&&ob.squadNotIn&&ob.vehNotIn&&ob.enemyNotIn);
assert(`坦克各成单位 (己方 ${ob.tankExpect} 辆), order 挂载具对象 (编制挂对象跨战损存续)`,
 ob.tankN===ob.tankExpect&&ob.tankN>0&&ob.tankOrder&&ob.enemyTankNotIn);
assert(`飞机各成单位 (己方 ${ob.planeExpect} 架), cmdOrder+strikePt=null 就位`,
 ob.planeN===ob.planeExpect&&ob.planeN>0&&ob.planeOrder);
}

// ── ⑤ 命令状态机 ─────────────────────────────────────────────
{
section('⑤ 四词汇命令 + 消费点 (真沙箱)');
const cm=run(`(()=>{ const out={};
if(!CMD.orbat) cmdOrbatBuild();
const s=CMD.orbat.squads[0];
const b=s.members[0]; if(!b.alive) return {skip:'组员不活'};
// attack_move 远点: decide → advance + 寻路 (CMD 块拦截式消费)
const tx=b.pos.x+80, tz=b.pos.z+40;
out.orderOK=cmdOrderUnit(s,'attack_move',tx,tz);
out.mode=s.order.mode;
out.free=cmdBotFree(b); out.cmd=!!cmdBotCmd(b);
b.decisionT=0; b.decide();
out.farState=b.state; out.farPath=!!b.path;
// 到点 (≤7m): 非交战 → defend
b.pos.set(tx-1,b.pos.y,tz-1); b.path=null; b.decisionT=0;
b.decide();
out.nearState=b.state;
// hold 到点 (≤5m): defend 定身
cmdOrderUnit(s,'hold',tx,tz);
b.pos.set(tx-1,b.pos.y,tz-1); b.path=null; b.decisionT=0;
b.decide();
out.holdState=b.state;
// free: 组令解除, cmdBotCmd 归 null
out.freeOK=cmdOrderUnit(s,'free',0,0);
out.freeAfter=cmdBotCmd(b); out.freeBot=cmdBotFree(b);
// 重生继承组令 (D16: 编制挂组不挂人, spawn 不清 cmdGrp)
cmdOrderUnit(s,'attack_move',tx,tz);
const grpBefore=b.cmdGrp;
b.alive=false; b.spawn();
out.respGrp=(b.cmdGrp===grpBefore);
out.respCmd=!!cmdBotCmd(b);
cmdOrderUnit(s,'free',0,0);
// 非法词汇拒绝
out.badMode=cmdOrderUnit(s,'zigzag',0,0);
return out; })()`);
assert('cmdOrderUnit attack_move 落账 (mode/组员 cmdBotCmd 非 null·cmdBotFree false)',
 cm.orderOK===true&&cm.mode==='attack_move'&&cm.free===false&&cm.cmd===true);
assert('远处组令: decide → advance 且开寻路 (14-bots CMD 块)',cm.farState==='advance'&&cm.farPath===true,
 `state=${cm.farState} path=${cm.farPath}`);
assert('到点组令: decide → defend (attack_move 占旗口径)',cm.nearState==='defend',`state=${cm.nearState}`);
assert('hold 到点: defend 定身 (不换位)',cm.holdState==='defend',`state=${cm.holdState}`);
assert('free 令: 组令解除 (cmdBotCmd null·cmdBotFree true), 非法词汇拒绝',
 cm.freeOK===true&&cm.freeAfter===null&&cm.freeBot===true&&cm.badMode===false);
assert('组员阵亡重生自动回组续令 (spawn 不清 cmdGrp)',cm.respGrp===true&&cm.respCmd===true);

const tk=run(`(()=>{ const out={};
const u=CMD.orbat.tanks[0]; const t=u.veh; if(!t.alive) return {skip:'坦克不活'};
const tx=t.pos.x+90, tz=t.pos.z+50;
cmdOrderUnit(u,'attack_move',tx,tz);
out.orderX=u.order.x; out.orderZ=u.order.z;
for(let i=0;i<45;i++){ const dt=1/30; nowT+=dt; gunEvents=gunEvents.filter(e=>nowT-e.t<0.6); t.update(dt); updateShells(dt); }
out.obj=t.objective?{x:t.objective.x,z:t.objective.z}:null;
out.had=t._cmdHad===true;
cmdOrderUnit(u,'free',0,0);
for(let i=0;i<45;i++){ const dt=1/30; nowT+=dt; gunEvents=gunEvents.filter(e=>nowT-e.t<0.6); t.update(dt); updateShells(dt); }
out.hadAfter=t._cmdHad;
out.tankCmdAfter=cmdTankCmd(t);
return out; })()`);
assert('坦克令: driveAI 首分支覆写 objective 到令点 (±0.1m)',
 tk.skip?false:(tk.obj!==null&&Math.abs(tk.obj.x-tk.orderX)<0.1&&Math.abs(tk.obj.z-tk.orderZ)<0.1&&tk.had===true),
 tk.skip||JSON.stringify(tk.obj)+' vs ('+tk.orderX+','+tk.orderZ+')');
assert('坦克 free 令: 下一思考周期即清 objective (_cmdHad=false, 默认选点即刻重选)',
 tk.hadAfter===false&&tk.tankCmdAfter===null);

const pl=run(`(()=>{ const out={};
// 排除缠斗拦截 (设计口径: 被咬尾自卫优先于 strike; 探针要测 strike 本体) —— 敌机清场 + 摘缠斗态
for(const q of planes){ if(q&&q.team!==player.team) q.alive=false; }
const us=CMD.orbat.planes.filter(u=>u.veh&&u.veh.alive&&u.veh.crewBot&&u.veh.crewBot.alive);
if(!us.length) return {skip:'无带飞行员的活机'};
const u=us[0], p=u.veh;
p.state='patrol'; p.dogTgt=null; p.target=null;
const tx=p.pos.x+220, tz=p.pos.z+90;
out.d0=Math.hypot(tx-p.pos.x,tz-p.pos.z);   // 令点直线距离 (实测 237.7, 随停机位/地图浮动)
out.strikeSet=cmdOrderUnit(u,'strike',tx,tz);
out.pt=p.strikePt?{x:p.strikePt.x,z:p.strikePt.z}:null;
out.tx=tx; out.tz=tz;
out.t0=typeof p.strikeT0==='number';
out.bombs0=p.bombs;
let dropped=0; const _db=p.dropBomb.bind(p); p.dropBomb=(...a)=>{ dropped++; return _db(...a); };   // 投弹落账探针 (机毁重生会补满弹账, 计数不可靠)
for(let i=0;i<300;i++){ const dt=1/30; nowT+=dt; gunEvents=gunEvents.filter(e=>nowT-e.t<0.6); p.update(dt); updateShells(dt); updateNades(dt); }
out.dropped=dropped;
out.d1=p.strikePt?Math.hypot(p.strikePt.x-p.pos.x,p.strikePt.z-p.pos.z):null;
out.afterPt=!!p.strikePt; out.bombs1=p.bombs; out.modeAfter=u.order.mode;
out.alive=p.alive;
// 无弹即中止: 摘缠斗态再下令, 下一 AI 周期 abort
const u2=us[1]||u; const p2=u2.veh; const keepBombs=p2.bombs;
p2.state='patrol'; p2.dogTgt=null; p2.target=null; p2.strikePt=null;
p2.bombs=0; p2.rearmT=99; cmdOrderUnit(u2,'strike',0,0);   // rearmT 冻结: update 里 bombs 会自动回填 (16-aircraft:412), 不冻=同帧弹账归 1
for(let i=0;i<30;i++){ const dt=1/30; nowT+=dt; p2.update(dt); }
out.abortPt=!!p2.strikePt; out.abortMode=u2.order.mode;
p2.bombs=keepBombs;
return out; })()`);
assert('飞机 strike 令: strikePt+strikeT0 落账 (投弹点=令点)',
 pl.skip?false:(pl.strikeSet===true&&pl.pt&&Math.abs(pl.pt.x-pl.tx)<0.01&&Math.abs(pl.pt.z-pl.tz)<0.01&&pl.t0===true),
 pl.skip||JSON.stringify(pl.pt)+' vs ('+pl.tx+','+pl.tz+')');
// ★2026-10-26 排查轮修抖动 (prober 20 跑定位): 旧写第二分支阈值硬编码 220*0.7=154m, 而令点真实距离
//   237.7m (220/90 直角边) ⇒ 实际门槛是"缩到 65%"。10s 仿真里飞机只稳定缩到 57%~69% (实测分布
//   0.574/0.596/0.598/0.602/0.606/0.636/0.645/0.652/0.685), 越线与否取决于 rand() 给的 bombCd 与
//   初始停机位 ⇒ 同一份代码 20 跑 3 红。不是产品缺陷, 是**探针阈值没跟着令点距离走**。
//   改为按本跑实测 d0 取比例 (缩进 ≥30% 即算"仍在接近令点"), 与断言文案语义一致。
assert('strike 执行: 真投弹 (dropBomb 落账) 且投出即 free, 或仍在接近令点',
 pl.skip?false:((pl.dropped>0&&pl.modeAfter==='free'&&pl.afterPt===false)||(pl.afterPt===true&&pl.d1!==null&&pl.d1<pl.d0*0.7)),
 pl.skip||`dropped=${pl.dropped} d1=${pl.d1!==null?pl.d1.toFixed(0):'-'} d0=${pl.d0.toFixed(0)} bombs ${pl.bombs0}→${pl.bombs1} mode=${pl.modeAfter} alive=${pl.alive}`);
assert('无弹 strike 令: 下一周期即中止 (strikePt 清+order 回 free, 不挂死任务)',
 pl.skip?false:(pl.abortPt===false&&pl.abortMode==='free'),
 pl.skip||`pt=${pl.abortPt} mode=${pl.abortMode}`);
}

// ── ⑥ 减速 / 指挥读条 / 设置 ─────────────────────────────────
{
section('⑥ 时间减速 + 指挥读条 (帧长三态门)');
const sl=run(`(()=>{ const out={};
matchOver=false; gamePaused=false; menuHold=false;
const p=player; p.cls=5; p.alive=true; p.deployed=true; p.spectator=false; if('specWant' in p) p.specWant=null;
// 常速
out.idle=cmdDtGate(0.016,0.016);
// 按住 N: 减速 ×0.2 + 读条收支 1/s
CMD.focus=CMD_TIME.FOCUS_MAX; keys[CMD_TIME.KEY]=true; CMD.slowOn=false;
cmdFrameTick(0.5);
out.slowOn=CMD.slowOn; out.focusAfterDrain=+CMD.focus.toFixed(3);
out.slowDt=cmdDtGate(0.016,0.016);
// K 时停优先: dt<=0 原样放行 (减速不把冻结复活)
out.kPass=cmdDtGate(0.016,0)===0&&cmdDtGate(0.016,-1)===-1;
// 读条耗尽: 只强制回常速 (不关地图不锁死)
keys[CMD_TIME.KEY]=false; CMD.slowOn=false; CMD.focus=0;
keys[CMD_TIME.KEY]=true; cmdFrameTick(0.5);
out.exhaustSlow=CMD.slowOn;
// 恢复 = 消耗 1/3 (常速下回账)
keys[CMD_TIME.KEY]=false; CMD.slowOn=false; CMD.focus=3;
cmdFrameTick(0.6);
out.regain=+CMD.focus.toFixed(3);
// 观战: 减速可用且免费 (R8)
CMD.focus=2; p.spectator=true; p.alive=true; keys[CMD_TIME.KEY]=true; CMD.slowOn=false;
cmdFrameTick(0.5);
out.specSlow=CMD.slowOn; out.specFocus=+CMD.focus.toFixed(3);
// 死亡指挥官: 不可减速
p.spectator=false; p.alive=false; CMD.slowOn=true;
cmdFrameTick(0.1);
out.deadSlow=CMD.slowOn;
// 布势冻结: dt=0 (世界冻 UI 不冻)
p.alive=true; keys[CMD_TIME.KEY]=false; CMD.slowOn=false;
CMD.mapOn=true; CMD.mapDeploy=true;
out.deployDt=cmdDtGate(0.016,0.016);
CMD.mapOn=false; CMD.mapDeploy=false;
// 超人档 (默认关): pdt≡dt; 开: 玩家与座驾走真实帧长
CMD_SETTINGS.selfExempt=false; CMD.slowOn=true;
out.pdtDefault=cmdPlayerDt(0.0032,0.016); out.rideDefault=cmdRideDt({playerDriven:true},0.0032,0.016);
CMD_SETTINGS.selfExempt=true;
out.pdtExempt=cmdPlayerDt(0.0032,0.016); out.rideExempt=cmdRideDt({playerDriven:true},0.0032,0.016);
out.rideOther=cmdRideDt({playerDriven:false},0.0032,0.016);
CMD_SETTINGS.selfExempt=false;
// 免费档 (focusCost 关): 减速不记账
CMD_SETTINGS.focusCost=false; CMD.focus=1; keys[CMD_TIME.KEY]=true; CMD.slowOn=false;
cmdFrameTick(0.5);
out.freeFocus=+CMD.focus.toFixed(3); out.freeSlow=CMD.slowOn;
CMD_SETTINGS.focusCost=true; keys[CMD_TIME.KEY]=false; CMD.slowOn=false;
// 设置项单源: cmdSettingsSet 落 localStorage
cmdSettingsSet('selfExempt',true);
out.setVal=CMD_SETTINGS.selfExempt; out.setLS=localStorage.getItem('sf_cmd_self');
cmdSettingsSet('selfExempt',false);
out.setBack=CMD_SETTINGS.selfExempt;
// HUD 读条 tick 真跑 (指挥官活+已部署 → #cmdFocusWrap 显示)
CMD.focus=5; cmdFrameTick(0.016);
out.hudShown=document.getElementById('cmdFocusWrap').style.display;
return out; })()`);
assert('常速透传 (dt 原样)',Math.abs(sl.idle-0.016)<1e-12);
assert('按住 N: 减速 ×0.2 生效 + 读条按真实秒耗 (0.5s → 6.5)',
 sl.slowOn===true&&Math.abs(sl.focusAfterDrain-6.5)<0.01&&Math.abs(sl.slowDt-0.0032)<1e-9);
assert('K 时停优先: dt<=0 原样放行 (D14)',sl.kPass===true);
assert('读条耗尽只回常速 (D5: 不关地图不锁功能)',sl.exhaustSlow===false);
assert('恢复 = 消耗 1/3 (3 + 0.6/3 = 3.2)',Math.abs(sl.regain-3.2)<0.01);
assert('观战减速免费 (R8): 生效且读条不动账',sl.specSlow===true&&Math.abs(sl.specFocus-2)<0.01);
assert('死亡指挥官不可减速',sl.deadSlow===false);
assert('布势冻结: 世界 dt=0 (D21)',sl.deployDt===0);
assert('超人档默认关: pdt/座驾同减速 (D4 默认档); 开: 玩家+自己开的载具走真实帧长, 其余载具照吃减速',
 sl.pdtDefault===0.0032&&sl.rideDefault===0.0032&&sl.pdtExempt===0.016&&sl.rideExempt===0.016&&sl.rideOther===0.0032);
assert('免费档 (focusCost 关): 减速不耗读条 (观战级玩具档)',sl.freeSlow===true&&Math.abs(sl.freeFocus-1)<0.01);
assert('设置项落 localStorage (sf_cmd_self), 复位即回',sl.setVal===true&&sl.setLS==='1'&&sl.setBack===false);
assert('指挥读条 HUD: 指挥官活+已部署时显示',sl.hudShown==='block');
}

// ── ⑦ 指挥地图 ───────────────────────────────────────────────
{
section('⑦ 指挥地图 (姿态门 / 开关定身 / R12 敌显 / 布势 / 配比 / 废墟补丁)');
const mp=run(`(()=>{ const out={};
if(!CMD.orbat) cmdOrbatBuild();
const p=player; p.cls=5; p.alive=true; p.deployed=true; p.spectator=false;
matchOver=false; gamePaused=false; menuHold=false;
p.onVehicle=null; p.onNaval=null; p.onMG=null; p.onAT=null; p.onAA=null; p.onMortar=null; p.onBattery=null;
p.capitalGun=null; p.loiter=null; p.chute=null; p.swim=false; p.flying=false; p.onGround=true;
// 部署页桩: 桩 classList.contains 恒 false (= "部署页可见") → 就地教会它认 hidden
const dep=document.getElementById('deploy');
dep.classList.contains=(k)=>k==='hidden';
out.canOpen=cmdMapCanOpen();
// 姿态门矩阵 (D18: 仅步行地面)
const cases={onVehicle:{},onNaval:{},onMG:{},onAT:{},onAA:{},onMortar:{},onBattery:{},loiter:{},chute:{},swim:true,flying:true};   // (2026-11-10 跟码: capitalGun 项随大舰子系统下架摘除)
out.gate={};
for(const k in cases){ const keep=p[k]; p[k]=cases[k]; out.gate[k]=cmdMapCanOpen()===false; p[k]=keep; }
p.onGround=false; out.gate.offGround=cmdMapCanOpen()===false; p.onGround=true;
p.deployed=false; out.gate.undeployed=cmdMapCanOpen()===false; p.deployed=true;
p.alive=false; out.gate.dead=cmdMapCanOpen()===false; p.alive=true;
p.cls=0; out.gate.notCmd=cmdMapCanOpen()===false; p.cls=5;
gamePaused=true; out.gate.paused=cmdMapCanOpen()===false; gamePaused=false;
matchOver=true; out.gate.over=cmdMapCanOpen()===false; matchOver=false;
// 开关 + 定身 (R11) + 死亡强关 (D1)
cmdMapToggle();
// ★2026-10-26 排查轮三审: 底图烘焙改成**预算式分帧续算** (旧: 渲染帧内同步烘焙, 最坏整帧 0.75s)。
//   于是"刚开图那一帧 CMD.bake 必然已就位"这条旧断言不再成立 —— 沙箱里没有 2d 上下文,
//   cmdMapDraw 走的是"无上下文 ⇒ 同步落桩"的兜底支 (cmdBake 整烘), 所以这里仍应立刻就位;
//   真浏览器里则先落 CMD._bj 作业、由 cmdFrameTick 每帧推进。两条都要对账, 缺一不可:
//   · 兜底支: baked=true (同步桩)
//   · 预算支: 作业推完 ⇒ baked=true 且 _bj 归 null; 推进过程中每帧 <= 预算 (最坏帧封顶)
out.open=CMD.mapOn; out.immob=cmdMapImmobilized();
// ★2026-10-26 排查轮三审: 底图改成预算式**分帧**烘焙后, "开图当帧 bake 必然就位"不再是应然语义 ——
//   正确语义是"开图后由帧 tick 续算, 若干帧内落账"。这里按游戏真实路径推进 (cmdFrameTick = 24-main
//   每帧调的那个), 而不是直接调 cmdBake 走同步整烘 —— 否则测的就不是线上那条路。
out.bakePre=(()=>{ try{
const wasNull=!CMD.bake;
let g=0; while(!CMD.bake&&g++<400) cmdFrameTick(0.016);
return { wasNullAtOpen:wasNull, frames:g, landed:!!(CMD.bake&&CMD.bake.half>0), jobCleared:CMD._bj===null };
}catch(e){ return { err:String(e&&e.message||e) }; } })();
out.bakeFallback=out.bakePre.landed===true;
// 预算支行为对账: 手动起作业 → 逐帧推进 → 每帧耗时 <= 预算的 3 倍 (计时粒度容差), 推完落账
out.budget=(()=>{ const keepBake=CMD.bake, keepBj=CMD._bj;
CMD.bake=null; CMD._bj=null;
const r={}; try{
if(typeof cmdBakeBegin!=='function'||typeof cmdBakeAdvance!=='function'){ r.missing=true; return r; }
cmdBakeBegin(); r.started=!!CMD._bj; r.bakeNullWhileBusy=(CMD.bake===null);
r.busyFlag=(typeof cmdBakeBusy==='function')&&cmdBakeBusy();
// 单帧耗时: 用沙箱 performance.now (桩是 Date.now, 粒度 1ms; 只要不超过预算太多即可)
let worst=0, guard=0;
while(CMD._bj&&guard++<5000){
const t0=(typeof performance!=='undefined'&&performance.now)?performance.now():Date.now();
cmdBakeAdvance(CMD_BAKE_BUDGET_MS);
const d=((typeof performance!=='undefined'&&performance.now)?performance.now():Date.now())-t0;
if(d>worst) worst=d;
}
r.frames=guard; r.worstMs=worst; r.done=!!(CMD.bake&&CMD.bake.half>0);
r.jobCleared=(CMD._bj===null); r.busyAfter=(typeof cmdBakeBusy==='function')&&cmdBakeBusy();
r.budgetMs=CMD_BAKE_BUDGET_MS;
}catch(e){ r.err=String(e&&e.message||e); }
CMD.bake=keepBake; CMD._bj=keepBj;
return r; })();
out.drawTick=(()=>{ try{ cmdMapTick(0.016); return true; }catch(e){ return false; } })();
p.alive=false; cmdMapForceClose();
out.forceClosed=CMD.mapOn===false; p.alive=true;
// 再开 → Esc 口径 = cmdMapClose
cmdMapToggle(); cmdMapClose(false);
out.escClosed=CMD.mapOn===false;
// R12 dotVis 与小地图判据逐点对账
const intelKeep=(typeof MAP_ALL_INTEL!=='undefined')?MAP_ALL_INTEL:null;
if(intelKeep!==null) MAP_ALL_INTEL=false;
p.spectator=false; p.alive=true;
p.pos.set(10,0,-5);
const vd=getMapVisDist();
// ★2026-10-26 排查轮二审: 旧判据断言"圆外不见"—— 那是旧实现自己重算视野圆留下的行为, 与设计 R12
//   ("完全复用 mmEnemyVis 单源") 冲突: 小地图的点位层是**画全量点**, 圆外靠第 2 层蒙版压暗;
//   指挥地图同画法 (点位判据 ≡ mmEnemyVis, 远处压暗交给 cmdMapDraw 的视野圆蒙版)。
//   因此这里改为逐点对账 cmdMapDotVis ≡ mmEnemyVis (含全部四个旁路), 而"圆外要压暗"由蒙版源码锚覆盖。
out.visNear=cmdMapDotVis(10+vd*0.5,-5);
out.visNearMM=mmEnemyVis(10+vd*0.5,-5);
out.visFar=cmdMapDotVis(10+vd*1.5,-5);
out.visFarMM=mmEnemyVis(10+vd*1.5,-5);
out.visIntel=(MAP_ALL_INTEL=true,cmdMapDotVis(10+vd*1.5,-5));
out.visIntelMM=(mmEnemyVis(10+vd*1.5,-5));
MAP_ALL_INTEL=false;
out.visSpec=(p.spectator=true,cmdMapDotVis(10+vd*1.5,-5)); p.spectator=false;
out.visDead=(p.alive=false,cmdMapDotVis(10+vd*1.5,-5)); p.alive=true;
if(intelKeep!==null) MAP_ALL_INTEL=intelKeep;
// 布势 (D21): 开在 body (inDeploy 压制网外) + 冻结 + 确认解冻回 #ui
cmdDeployOpen();
out.depOn=CMD.mapOn&&CMD.mapDeploy; out.depSeen=CMD.deploySeen;
out.depHost=document.getElementById('cmdMapWrap').parentNode===document.body;
out.depFreeze=cmdDtGate(0.016,0.016)===0;
out.depNotImmob=cmdMapImmobilized()===false;
cmdDeployConfirm();
out.depClosed=(CMD.mapOn===false&&CMD.mapDeploy===false);
out.backToUi=document.getElementById('cmdMapWrap').parentNode===document.getElementById('ui');
// 配比: 读自当前分布 / 满员封顶 / 增减守恒 / 落装走 setClass
const s=CMD.orbat.squads[0];
const r0=cmdRatioOf(s);
out.rSum=r0.reduce((a,b)=>a+b,0)===s.members.length;
const c0keep=r0[0];
cmdRatioAdj(s,0,1);
out.adjFull=(r0[0]===c0keep);
cmdRatioAdj(s,0,-1); cmdRatioAdj(s,1,1);
out.adjRedist=(r0.reduce((a,b)=>a+b,0)===s.members.length);
cmdRatioApply(s);
const dist=[0,0,0,0,0]; for(const b of s.members) dist[b.cls%5]++;
out.applied=dist.every((v,i)=>v===r0[i]);
cmdRatioAdj(s,0,1); cmdRatioApply(s);
// 废墟补丁 (D19): 非炸不抛
out.rubble=(()=>{ try{ cmdMarkRubble({cx:0,cz:0,meshes:[{},{}]}); return true; }catch(e){ return false; } })();
return out; })()`);
assert('姿态门默认放行 (指挥官+活+已部署+步行地面+部署页隐藏)',mp.canOpen===true);
assert('D18 姿态门矩阵全堵: 载具×7/伞降/游泳/飞行/离地/未部署/阵亡/非指挥官/暂停/结算 (2026-11-10 跟码: capitalGun 项随大舰子系统下架摘除)',
 Object.keys(mp.gate).length===17&&Object.values(mp.gate).every(v=>v===true),
 Object.keys(mp.gate).filter(k=>!mp.gate[k]).join(',')||'全堵');
assert('开图成功 + 底图烘焙落账 (R6 一次烘焙) + 逐帧重绘不炸',mp.open===true&&mp.bakeFallback===true&&mp.drawTick===true);
// ★2026-10-26 排查轮三审 新增: 底图预算式分帧烘焙 (修 开图/进布势当帧整帧僵住 0.1~0.75s)
//   判据分四段: ①作业能起且期间 bake 仍为 null (证明真的是分帧, 不是换汤不换药地一次跑完);
//   ②空闲标志 cmdBakeBusy 期间为 true; ③逐帧推进后落账且作业归 null; ④单帧耗时 <= 预算的 5 倍
//   (沙箱 performance.now 桩是 Date.now = 1ms 粒度, 逐帧取整会累积误差, 故留 5 倍容差)。
assert('R6 底图预算式分帧烘焙: 作业可起/期间 bake 仍空/逐帧推进/落账清作业/单帧受预算封顶',
 mp.budget&&mp.budget.started===true&&mp.budget.bakeNullWhileBusy===true&&mp.budget.busyFlag===true
 &&mp.budget.done===true&&mp.budget.jobCleared===true&&mp.budget.busyAfter===false
 &&mp.budget.worstMs<=mp.budget.budgetMs*5,JSON.stringify(mp.budget));
assert('开图定身 (R11); 死亡强关 (D1); Esc 口径关图',mp.immob===true&&mp.forceClosed===true&&mp.escClosed===true);
assert('R12 dotVis 与小地图判据逐点一致 (白昼全显档: 圆内/圆外/全图开关/观战/死亡五态全对账)',
 mp.visNear===true&&mp.visNear===mp.visNearMM&&mp.visFar===mp.visFarMM
 &&mp.visIntel===true&&mp.visIntel===mp.visIntelMM&&mp.visSpec===true&&mp.visDead===true);
assert('布势: 开在 body (部署页压制网外) + 世界冻结 + 布势期不定身 (D21)',
 mp.depOn===true&&mp.depSeen===true&&mp.depHost===true&&mp.depFreeze===true&&mp.depNotImmob===true);
assert('确认开战: 收图解冻, 宿主搬回 #ui (重进战斗 HUD 压制网)',mp.depClosed===true&&mp.backToUi===true);
assert('配比: 初值=当前分布 / 满员封顶 / 增减守恒 / 落装走 setClass 真改兵种',
 mp.rSum===true&&mp.adjFull===true&&mp.adjRedist===true&&mp.applied===true);
assert('D19 废墟补丁单点重画不炸 (空 2d 桩/真上下文都走通)',mp.rubble===true);
}

// ── ⑧ 回归对账 + 零回归 ─────────────────────────────────────
{
section('⑧ 载入对账 / 版本戳 / i18n / 非指挥官零回归');
const idx=SRC('index.html');
const gf=SRC('dev/_game_files.txt');
const idxScripts=[...idx.matchAll(/<script src="js\/([^"?]+)\?v=([^"]+)"><\/script>/g)].map(m=>m[1]);
const gfFiles=gf.split(/\r?\n/).map(l=>l.trim()).filter(l=>l).map(l=>l.replace(/\?v=.*$/,''));
assert('index.html 脚本表 ↔ dev/_game_files.txt 双向一致 (序即载入序)',
 idxScripts.length===gfFiles.length&&idxScripts.length===45&&idxScripts.every((f,i)=>f===gfFiles[i]),
 `index ${idxScripts.length} vs files ${gfFiles.length}`);
assert('26-commander 载入位: 25-zombies 之后 (27-achievements 插其后, 24-main 收尾; 编制先于主循环; 2026-11-11 成就批判据跟码)',
 gfFiles.indexOf('26-commander.js')===gfFiles.indexOf('25-zombies.js')+1&&gfFiles.indexOf('26-commander.js')+1===gfFiles.indexOf('27-achievements.js')&&gfFiles.indexOf('27-achievements.js')+1===gfFiles.indexOf('24-main.js'));
const stamps=[...idx.matchAll(/\?v=20261115c/g)].length;
assert('版本戳 20261115c: index.html 全量脚本+样式戳 + __sfStyleVer + _game_files 全行 + 三探针 (2026-11-10 海战移除批判据跟码)',
 stamps>=44&&idx.includes("window.__sfStyleVer='20261115c';")
 &&gf.split(/\r?\n/).filter(l=>l.includes('?v=20261115c')).length===45
 &&['dev/verify-animfix-20261012.js','dev/verify-hudfix-20261007.js','dev/verify-perf-20261024.js']
  .every(f=>SRC(f).includes('20261115c')));

const i18n=SRC('js/00b-i18n.js');
const keys=['指挥官','通讯仪','指挥地图','布势阶段','指挥读条','减速消耗读条','减速对我无效',
 '本局已锁定指挥官','本局未选指挥官','本图不开放','与观战模式互斥','指挥官局不能开观战',
 '自由推进','进攻此点','防守此点','投弹此点','步兵{0}组','✚ 确认开战',
 '减速中…','按住 V 减速 (消耗读条)','命令: {0} → {1}',
 '指挥官 · 持通讯仪右键开指挥地图 · 滚轮切单位 · E=防守 F=进攻 R=自由 · 左键=集火 · 按住 V 减速'];
assert('i18n 指挥官批新键全配英文 (词典闭环)',keys.every(k=>i18n.includes(`'${k}':`)),
 '缺: '+keys.filter(k=>!i18n.includes(`'${k}':`)).join(' / '));

const s26=srcOf('js/26-commander.js'),s22h=srcOf('js/22-hud.js');
// ★2026-10-26 排查轮二审: 旧断言「26-commander 不引用 mmEnemyVis」是**把缺陷写成契约** —— 设计 R12
//   明写敌显要"完全复用小地图敌显管线单源 (mmEnemyVis 判据)", 而旧实现自己重算一套。断言改为:
//   ① 26-commander **只准**调用 mmEnemyVis, 不准重写它的判据 (WX_MM_NEAR/WX_MM_FIRE 不得出现);
//   ② 不准自己调 drawMinimap (画法独立);
//   ③ 22-hud 仍不进 cmdMap (反向零耦合不变)。
// 判据只看**代码**不看注释 (两边的注释都要能提 WX_MM_NEAR/mmEnemyVis/cmdMapDotVis 讲清来龙去脉)。
const stripC=s=>s.split('\n').filter(l=>!/^\s*\/\//.test(l)).join('\n');
const s26code=stripC(s26),s22hcode=stripC(s22h);
assert('小地图敌显单源 (R12): 26 委托 mmEnemyVis 且代码里不带夜/雨规常量, 不调 drawMinimap, 22-hud 不进 cmdMap',
 s26code.includes('mmEnemyVis(x,z,lastFire)')&&!s26code.includes('WX_MM_NEAR')&&!s26code.includes('WX_MM_FIRE')
 &&!s26code.includes('drawMinimap')&&!s22hcode.includes('cmdMap'));

const zr=run(`(()=>{ const out={};
cmdResetMatch();
const p=player; p.cls=0; p.alive=true; p.deployed=true; p.spectator=false;
matchOver=false; gamePaused=false; menuHold=false;
out.isCmd=cmdIsCommander();
keys[CMD_TIME.KEY]=true; cmdFrameTick(0.1);
out.slowOn=CMD.slowOn;
out.dt=cmdDtGate(0.016,0.016);
out.gate5=cmdClassCardGate(5);
keys[CMD_TIME.KEY]=false;
// 敌方 Bot (无编制) 走 decide 不进 CMD 块 (非崩溃即默认 AI 路径)
const foe=soldiers.find(s=>s&&s.team!==player.team&&s.alive&&!s.cmdGrp);
let foeOK=true; try{ if(foe){ foe.decisionT=0; foe.decide(); } }catch(e){ foeOK=false; }
out.foeOK=foeOK;
cmdResetMatch();
return out; })()`);
assert('非指挥官零回归: cls0 时 cmdIsCommander=false·N 键不开减速·dt 原样',
 zr.isCmd===false&&zr.slowOn===false&&Math.abs(zr.dt-0.016)<1e-12);
assert('非指挥官 (未盖章) 指挥官卡仍可选; 无编制 Bot decide 照常 (默认 AI 路径不炸)',
 zr.gate5===null&&zr.foeOK===true);
}

// ── ⑨ 本批修复回归 (2026-10-26 排查轮: 三处 BUG 防回退) ─────────────────────
{
section('⑨ 本批修复回归 (pointer-events / 冻结期减速自愈 / 机毁令账)');
// BUG1: #ui 是 pointer-events:none 且被子元素继承 ⇒ 指挥地图挂 #ui 后完全点不动 (点选/右键/滚轮/面板全哑)。
const _s26=srcOf('js/26-commander.js');
assert('BUG1 指挥地图显式放开 pointer-events (不被 #ui 的 pointer-events:none 继承吞掉鼠标)',
 _s26.includes('border-radius:8px;pointer-events:auto;'),
 _s26.includes('pointer-events:auto')?'':'缺 pointer-events:auto');
const _s24=srcOf('js/24-main.js');
assert('BUG2 冻结分支就地把减速态收回常速 (cmdSlowFreezeHeal 单源, 挂 nowOff 同帧)',
 _s24.includes("if(typeof cmdSlowFreezeHeal==='function') cmdSlowFreezeHeal();")&&_s26.includes('function cmdSlowFreezeHeal(){'),
 _s24.includes('cmdSlowFreezeHeal')?'':'main 未接线');
// 2026-10-26 排查轮: 自愈改为无条件清 (幂等) —— 旧写的早退在「按住 N 但读条耗尽 ⇒ slowOn 已 false」
// 时等价, 但一旦后续再加减速态来源就会漏清。无条件写一个 false 成本为零 (冻结分支每帧至多一次)。
// 关键是「只碰 slowOn」: 不得在自愈里动读条 (冻结期不该继续扣/回账) 或画面。
assert('BUG2 自愈语义: 冻结期无条件把减速态收回常速, 不碰读条不碰画面',
 _s26.includes('function cmdSlowFreezeHeal(){')
 &&/function cmdSlowFreezeHeal\(\)\{[\s\S]{0,240}?CMD\.slowOn=false;[\s\S]{0,40}?\}/.test(_s26)
 &&!/function cmdSlowFreezeHeal\(\)\{[\s\S]{0,240}?CMD\.focus/.test(_s26));
const _s16=srcOf('js/16-aircraft.js');
assert('BUG3 机毁重生同步清令账 (order.mode 回 free, 不只是清 strikePt)',
 /this\.strikePt=null;[\s\S]{0,700}if\(this\.cmdOrder\)\{ this\.cmdOrder\.mode='free'; this\.cmdOrder\.x=0; this\.cmdOrder\.z=0; \}/.test(_s16));
const fx=run(`(()=>{ const out={};
cmdOrbatBuild();
const u=CMD.orbat.planes[0];
if(u){ const pl=u.veh;
 cmdOrderUnit(u,'strike',120,80); out.modeBefore=u.order.mode;
 pl.alive=false; pl.respawn();
 out.strikePtAfter=!!pl.strikePt; out.modeAfter=u.order.mode;
} else out.noPlane=true;
player.cls=5; player.alive=true; player.deployed=true; player.spectator=false;
matchOver=false; gamePaused=false; menuHold=false; CMD.focus=CMD_TIME.FOCUS_MAX; CMD.slowOn=false;
keys[CMD_TIME.KEY]=true; cmdFrameTick(0.1);
out.held=CMD.slowOn;
keys[CMD_TIME.KEY]=false;
cmdSlowFreezeHeal();
out.healed=CMD.slowOn===false;
out.dtBack=cmdDtGate(0.016,0.016)===0.016;
return out; })()`);
assert('BUG3 行为: strike 令 → 机毁重生 → strikePt 清且 order.mode 回 free (不再空转显示投弹)',
 fx.noPlane?false:(fx.modeBefore==='strike'&&fx.strikePtAfter===false&&fx.modeAfter==='free'),
 fx.noPlane?'无己方飞机':JSON.stringify(fx));
assert('BUG2 行为: 冻结期自愈把挂住的 slowOn 收回常速 (dt 恢复 1.0x)',
 fx.held===true&&fx.healed===true&&fx.dtBack===true,
 JSON.stringify(fx));

// ── BUG7/BUG8: 2026-10-26 排查轮 (读条耗尽抖动 / Esc 暂停期减速不归位) ──────────────
// BUG7: 旧 cmdFrameTick 在 focus<=0 时置 slowOn=false, 而同帧下面的恢复分支又把 focus 拉回 0.0056s,
//   下一帧 allowed 再成立 ⇒ 减速按帧反复开关。实测 dt 在 0.0167/0.0033 之间逐帧跳 (平均 ~60% 速度),
//   永远回不到干净常速 —— 违反 D5「读条耗尽只强制回常速」。修法: 迟滞锁 CMD.slowLock,
//   耗尽后要等读条回到 REARM_FRAC (满格 1/4) 才允许重新进入减速。
const hz=run(`(()=>{ const out={};
 matchOver=false; gamePaused=false; menuHold=false;
 const p=player; p.cls=5; p.alive=true; p.deployed=true; p.spectator=false;
 cmdResetMatch(); CMD.focus=0; CMD.slowOn=false; keys[CMD_TIME.KEY]=true;
 const dts=[]; for(let i=0;i<20;i++){ cmdFrameTick(1/60); dts.push(+cmdDtGate(1/60,1/60).toFixed(5)); }
 out.dts=dts; out.uniq=[...new Set(dts)]; out.lock=CMD.slowLock;
 keys[CMD_TIME.KEY]=false;
 let n=0; const th=CMD_TIME.FOCUS_MAX*CMD_TIME.REARM_FRAC;
 while(CMD.focus<th+0.01&&n<5000){ cmdFrameTick(1/60); n++; }
 out.ticks=n; out.lockAfter=CMD.slowLock; out.focusAfter=+CMD.focus.toFixed(2);
 keys[CMD_TIME.KEY]=true; cmdFrameTick(1/60);
 out.rearmed=CMD.slowOn; out.dtRe=+cmdDtGate(1/60,1/60).toFixed(5);
 keys[CMD_TIME.KEY]=false; cmdResetMatch();
 return out; })()`);
assert('BUG7 读条耗尽不再逐帧抖动: 20 帧 dt 恒定常速 (旧: 0.0167/0.0033 交替), 迟滞锁置位',
 hz.uniq.length===1&&Math.abs(hz.uniq[0]-0.01667)<1e-4&&hz.lock===true,
 `uniq=${JSON.stringify(hz.uniq)} lock=${hz.lock}`);
assert('BUG7 迟滞可退出: 读条回到 REARM_FRAC (满格 1/4) 解锁并恢复减速',
 hz.lockAfter===false&&hz.rearmed===true&&Math.abs(hz.dtRe-0.00333)<1e-4,
 JSON.stringify(hz));
// BUG8: cmdSlowFreezeHeal 旧写只挂在 24-main 的 document.hidden 分支 (= 切后台标签页),
//   而按住 N 时按 Esc 暂停走的是**可见**的 gamePaused 冻结分支 (24-main:51) —— 那里 return 在
//   cmdFrameTick 之前, 松手收不到任何 tick, CMD.slowOn 一直挂 true, 一恢复战斗就凭空 0.2x 慢放。
const _s24f=srcOf('js/24-main.js');
assert('BUG8 冻结分支 (gamePaused||matchOver||menuHold) 内也调 cmdSlowFreezeHeal (旧: 只在 document.hidden 分支)',
 /if\(gamePaused\|\|matchOver\|\|menuHold\)\{[\s\S]{0,600}?if\(typeof cmdSlowFreezeHeal==='function'\) cmdSlowFreezeHeal\(\);/.test(_s24f),
 '冻结分支未接线');
assert('BUG8 双分支都有自愈: document.hidden 与暂停冻结分支各一次 (切后台 / Esc 两条路径全覆盖)',
 (_s24f.match(/if\(typeof cmdSlowFreezeHeal==='function'\) cmdSlowFreezeHeal\(\);/g)||[]).length>=2,
 '仅 '+( (_s24f.match(/cmdSlowFreezeHeal\(\);/g)||[]).length )+' 处');
// 行为层: 模拟「按住 N → Esc 暂停 → 主循环冻结分支跑 → 松手 → 恢复」, 恢复后必须是 1.0x。
const fz=run(`(()=>{ const out={};
 matchOver=false; gamePaused=false; menuHold=false;
 const p=player; p.cls=5; p.alive=true; p.deployed=true; p.spectator=false;
 CMD.focus=CMD_TIME.FOCUS_MAX; CMD.slowLock=false; keys[CMD_TIME.KEY]=true; cmdFrameTick(1/60);
 out.slowBefore=CMD.slowOn;
 gamePaused=true;
 for(let i=0;i<5;i++){ if(typeof cmdSlowFreezeHeal==='function') cmdSlowFreezeHeal(); }
 out.slowInPause=CMD.slowOn; out.dtInPause=cmdDtGate(1/60,1/60);
 keys[CMD_TIME.KEY]=false; gamePaused=false; cmdFrameTick(1/60);
 out.slowAfter=CMD.slowOn; out.dtAfter=cmdDtGate(1/60,1/60);
 out.focusNotDrained=CMD.focus>CMD_TIME.FOCUS_MAX-0.05;
 cmdResetMatch(); return out; })()`);
assert('BUG8 行为: 暂停期自愈后恢复战斗为 1.0x (不再凭空慢放), 且自愈不碰读条',
 fz.slowBefore===true&&fz.slowInPause===false&&fz.dtInPause===1/60&&fz.slowAfter===false&&fz.dtAfter===1/60&&fz.focusNotDrained===true,
 JSON.stringify(fz));

// ── BUG9: 指挥组令压过贴脸自卫 (2026-10-26 排查轮) ─────────────────────────────
// 14-bots decide 的 CMD 块缺 SQUAD 块那条 `!(engaged&&distT<20)` 门 ⇒ 敌人贴到 6m 时, 组员仍被判
// 去 134m 外的令点 (state=advance + setPathTo), 当着敌人的面掉头就走。与本节注释「敌近身暂缓执行的门
// 与小队令同规」直接矛盾, 也违背设计 §5「心灵控制 = 覆写目标状态, 不动 Bot 决策核心」。
const near=run(`(()=>{ const out={};
 matchOver=false; gamePaused=false; menuHold=false;
 const p=player; p.cls=5; p.alive=true; p.deployed=true; p.spectator=false;
 cmdOrbatBuild();
 const b=soldiers.find(s=>s&&s.team===player.team&&s.alive&&s.cmdGrp&&!s.onVehicle&&!s.inSquad&&!s.pilotOf&&!s.capCrew);
 if(!b) return {skip:'no grouped bot'};
 const foe=soldiers.find(s=>s&&s.team!==player.team&&s.alive&&!s.onVehicle);
 if(!foe) return {skip:'no foe'};
 foe.pos.x=b.pos.x+6; foe.pos.z=b.pos.z; b.target=foe; b.lastSeenT=nowT;
 const gx=b.pos.x+120, gz=b.pos.z+60;
 b.cmdGrp.order={mode:'attack_move',x:gx,z:gz};
 b.state='idle'; b.decisionT=0; b.decide();
 out.engaged=!!(b.target&&nowT-b.lastSeenT<4);
 out.distT=Math.hypot(b.target.pos.x-b.pos.x,b.target.pos.z-b.pos.z);
 out.state=b.state; out.path=!!b.path; out.distToOrder=Math.hypot(gx-b.pos.x,gz-b.pos.z);
 // 对照: 同一场景的 SQUAD 块行为 (同源判据应一致)。
 // ★2026-10-27 反馈批判据跟走: 指挥官盖章即解散私人小队 (用户需求 4, cmdLockStamp 'in' 分支) ⇒
 //   ③ 段跑过 cmdLockStamp(5) 后沙箱里已不存在天然 inSquad 散兵, 对照组不能再"找一个",
 //   改成就地搭一个 (临时 inSquad=true + 清 cmdGrp, 用后还原) —— 与 natural 小队成员进同一条 SQUAD 块。
 const b2=soldiers.find(s=>s&&s.team===player.team&&s.alive&&!s.onVehicle&&!s.pilotOf&&!s.capCrew&&s!==b);
 const f2=soldiers.find(s=>s&&s.team!==player.team&&s.alive&&!s.onVehicle);
 if(b2&&f2){ const _sq=b2.inSquad, _grp=b2.cmdGrp;
  b2.inSquad=true; b2.cmdGrp=null;
  f2.pos.x=b2.pos.x+6; f2.pos.z=b2.pos.z; b2.target=f2; b2.lastSeenT=nowT;
  SQUAD.mode='move'; SQUAD.pos.x=b2.pos.x+120; SQUAD.pos.z=b2.pos.z+60;
  b2.state='idle'; b2.decisionT=0; b2.decide(); out.sqState=b2.state; out.sqPath=!!b2.path;
  b2.inSquad=_sq; b2.cmdGrp=_grp; }
 cmdResetMatch(); return out; })()`);
assert('BUG9 敌贴脸 (6m) 时组令让位给接战: 不再判 advance/寻路去远处令点 (旧: 当着敌人掉头就走)',
 near.skip?false:(near.engaged===true&&near.distT<8&&near.state!=='advance'&&near.path===false),
 near.skip||`state=${near.state} path=${near.path} distT=${near.distT&&near.distT.toFixed(1)} 令点=${near.distToOrder&&near.distToOrder.toFixed(0)}m`);
assert('BUG9 与 SQUAD 块同源判据: 同一场景两组状态一致 (不另立阈值)',
 near.skip?false:(near.state===near.sqState&&near.path===near.sqPath),
 near.skip||`cmd=${near.state}/${near.path} squad=${near.sqState}/${near.sqPath}`);

// ── BUG10..BUG14: 2026-10-26 排查轮 (审计三份报告确认项) ─────────────────────
const _s26c=srcOf('js/26-commander.js'),_s19c=srcOf('js/19-input.js');
// BUG10 [P0] 布势面板软锁死: .cmdRat 的 forEach 漏写 b.onclick= ⇒ 函数体在绑定阶段就执行,
//   pnl._t=0 击穿首行递归守卫 → 无界自递归 (实测 7509 层); 抛点在 #cmdDeployGo 绑定之前 ⇒
//   确认开战按钮永不绑定, 而布势期 Esc/右键门都不成立 (alive/deployed 皆 false) ⇒ 唯一出口死掉。
//   既有探针全绿是因为 _bootstub 的 querySelectorAll 恒返回 [] (第 22/40 行), 三个 forEach 全空转。
assert('BUG10 配比按钮绑定写成 b.onclick=()=>{...} (漏写会立即执行并无界递归, 且吞掉确认开战绑定)',
 /pnl\.querySelectorAll\('\.cmdRat'\)\.forEach\(b=>\{\s*\/\/[\s\S]{0,900}?b\.onclick=\(\)=>\{/.test(_s26c)
 &&!_s26c.includes("pnl.querySelectorAll('.cmdRat').forEach(b=>{\nconst sq="),
 _s26c.includes('b.onclick=()=>{')?'':'缺 b.onclick=');
// ★2026-10-26 交互重做批: 面板重写后只剩两组绑定 (cmdUnit 列表行 / cmdRat 配比加减) —— 旧的 .cmdBtn
//   (自由/进攻/防守三个按钮) 随"三命令键 E/F/R"一起退场 (键位直接下令, 不再需要两步式按钮)。
//   判据同步改成"每组绑定都是赋值形式", 组数门槛随之降到 2。
assert('BUG10 面板按钮绑定 (cmdUnit/cmdRat) 都是 b.onclick=()=>{} 赋值不是裸执行',
 (function(){ const seg=_s26c.slice(_s26c.indexOf('pnl.querySelectorAll('));
   const n=(seg.slice(0,4000).match(/querySelectorAll\('\.[a-zA-Z]+'\)\.forEach\(/g)||[]).length;
   const m=(seg.slice(0,4000).match(/\.onclick=\(\)=>\{/g)||[]).length; return n>=2&&m>=2; })());
// BUG11 [P1] 飞机收到 attack_move/hold 被静默改写成 free 却 return true (反馈与行为不符)。
// ★2026-10-26 排查轮二审: 窗口 400 太窄 —— free 分支里补了 strikeT0 清理说明后 return false 被推出窗口,
//   这里放宽到 900 并保留原判据语义 (plane 分支里 free 之后紧跟 return false = 拒绝其余词汇)。
assert('BUG11 飞机不吃 attack_move/hold: cmdOrderUnit 对不适用词汇 return false (不再静默改 free)',
 /if\(unit\.kind==='plane'\)\{[\s\S]{0,300}?\}else if\(mode==='free'\)\{[\s\S]{0,900}?return false;/.test(_s26c),
 '未加 return false 分支');
// ★2026-10-26 交互重做批: 分档从"面板按钮"迁到"面板键位提示" —— 飞机那行 F 键写「向此处投弹」而不是
//   「进攻此处」, 且 E (防守) 行按 canHold 灰显。判据落在同一个语义上 (飞机不吃 hold), 实现位置变了。
assert('BUG11 面板键位按单位类型分档 (飞机 F=向此处投弹 且 E=防守灰显, 不写 进攻/防守)',
 /canHold=\(u\.kind!=='plane'\)/.test(_s26c)
 &&/u\.kind==='plane'\?t2\('向此处投弹'\):t2\('进攻此处'\)/.test(_s26c));
// BUG12 [P1] 指挥地图右键关不掉 (提示条写「右键/再按右键关闭」但无实现, 全局 mousedown 又早退)。
assert('BUG12 地图 canvas 右键在未选中单位时调 cmdMapToggle 关图 (提示条语义可达)',
 /\}else if\(e\.button===2\)\{[\s\S]{0,600}?cmdMapToggle\(\);\s*return;/.test(_s26c),
 '缺右键关图分支');
// BUG13 [P1] 23-deploy 的 el('cw'+i) 无 null 守卫 ⇒ 丧尸局/海战图 (无 #cw5) 抛 TypeError 半渲染。
const _s23=srcOf('js/23-deploy.js');
assert('BUG13 部署页兵种卡文案写入带 null 守卫 (丧尸局/海战图无 #cw5, 旧写 TypeError 中断循环=空壳页)',
 /const _cw=el\('cw'\+i\);\s*if\(_cw\)\s*_cw\.textContent=/.test(_s23),
 _s23.includes("el('cw'+i).textContent=")?'仍无守卫':'?');
// BUG14 [P1] R11 定身不完整: keydown 无 cmdMapUIOpen 早退 ⇒ 开图期换枪/举雷/包扎/上车全生效。
// ★2026-10-26 交互重做批: 放行集合从"只有减速键"扩到"减速键 + 三命令键 (E/F/R)"。三命令键的判定
//   不在 19-input 里 (避免第二份键名判断), 而是转发给 26-commander 的 cmdMapKeyGate 单源。
assert('BUG14 开图期 keydown 早退 (放行减速键 + cmdMapKeyGate 三命令键; 旧写只有 mousedown 有早退)',
 /if\(typeof cmdMapUIOpen==='function'&&cmdMapUIOpen\(\)\)\{[\s\S]{0,400}?if\(typeof cmdMapKeyGate==='function'&&cmdMapKeyGate\(e\.code\)\) return;[\s\S]{0,200}?if\(!\(typeof CMD_TIME!=='undefined'&&e\.code===CMD_TIME\.KEY\)\) return;\s*\}/.test(_s19c),
 _s19c.includes('cmdMapUIOpen')?'':'缺 keydown 早退');
}
const _s26b=srcOf('js/26-commander.js'),_s19b=srcOf('js/19-input.js');
// BUG4: 地图 canvas 的 mousedown 不 stopPropagation ⇒ 冒泡到 window 上的全局开火/机瞄/补锁处理器。
assert('BUG4 地图内鼠标自己消费 (stopPropagation+preventDefault, 不冒泡到 window 全局开火/机瞄/补锁)',
 /cv\.addEventListener\('mousedown',e=>\{[\s\S]{0,400}e\.stopPropagation\(\); e\.preventDefault\(\);/.test(_s26b),
 _s26b.includes('e.stopPropagation(); e.preventDefault();')?'':'缺 stopPropagation');
assert('BUG4 双保险: 19-input 全局 mousedown 按 cmdMapUIOpen 单源早退 (地图开着鼠标归地图)',
 /addEventListener\('mousedown',e=>\{[\s\S]{0,500}if\(typeof cmdMapUIOpen==='function'&&cmdMapUIOpen\(\)\) return;/.test(_s19b),
 _s19b.includes("if(typeof cmdMapUIOpen==='function'&&cmdMapUIOpen()) return;")?'':'缺全局早退');
assert('BUG4 滚轮/右键菜单同样吞掉冒泡 (不进全局滚轮/切枪与浏览器菜单)',
 /cv\.addEventListener\('wheel',e=>\{[\s\S]{0,200}e\.stopPropagation\(\);/.test(_s26b)
 &&/contextmenu',e=>\{ e\.preventDefault\(\); e\.stopPropagation\(\); \}/.test(_s26b));
// BUG5/6: 布势期 Esc / 右键 走 cmdDeployConfirm (默认布势开战) 而不是 cmdMapClose (关图不留部署页 = 卡 UI)。
assert('BUG5 布势期 Esc = 跳过布势走 cmdDeployConfirm (旧: cmdMapClose 关图后部署页不回来)',
 _s19b.includes("if(typeof cmdDeployPhase==='function'&&cmdDeployPhase()&&typeof cmdDeployConfirm==='function') cmdDeployConfirm();"));
assert('BUG6 布势期右键 = 跳过布势走 cmdDeployConfirm (cmdMapToggle 首分支, 不再把布势关掉)',
 /function cmdMapToggle\(\)\{[\s\S]{0,400}if\(CMD\.mapOn&&CMD\.mapDeploy\)\{ cmdDeployConfirm\(\); return; \}/.test(_s26b),
 _s26b.includes('if(CMD.mapOn&&CMD.mapDeploy){ cmdDeployConfirm(); return; }')?'':'缺布势首分支');
// 行为层: 布势期关图必须仍能把部署页叫回来 (cmdDeployConfirm 收尾语义)
const dp=run(`(()=>{ const out={};
cmdResetMatch();
const p=player; p.cls=5; p.alive=true;
matchOver=false; gamePaused=false; menuHold=false;
if(typeof cmdOrbatBuild==='function') cmdOrbatBuild();
cmdDeployOpen();
out.deployOn=CMD.mapOn&&CMD.mapDeploy;
cmdDeployConfirm();
out.closed=(CMD.mapOn===false&&CMD.mapDeploy===false);
out.backToUi=document.getElementById('cmdMapWrap').parentNode===document.getElementById('ui');
cmdResetMatch();
return out; })()`);
assert('BUG5/6 行为: 布势期确认开战 → 收图+解冻+宿主回 #ui (部署页出口不丢)',
 dp.deployOn===true&&dp.closed===true&&dp.backToUi===true,
 JSON.stringify(dp));

// ── ⑩ 二审修复回归 (2026-10-26 排查轮二审: R12 单源 / 定身完整性 / D20 暂停优先 / 配比跨重生) ──
{
section('⑩ 二审修复回归 (R12 委托单源 / R11 每帧复验 / 布势整图 / D20 暂停优先 / 配比落装)');
const _s26c2=srcOf('js/26-commander.js'),_s24c=srcOf('js/24-main.js');
// R12-B: 三个敌显消费点带开火时间戳 (源码锚, 与 22-hud 同名循环逐字同源)
assert('R12 敌显三消费点带火时间戳 (步兵 lastFiredT / 坦克 crew / 飞机 max(crew,crewBot))',
 _s26c2.includes('if(!cmdMapDotVis(s.pos.x,s.pos.z,s.lastFiredT)) continue;')
 &&_s26c2.includes('if(!cmdMapDotVis(t.pos.x,t.pos.z,t.crew&&t.crew.lastFiredT)) continue;')
 &&_s26c2.includes('Math.max(pl.crew?pl.crew.lastFiredT:-99,pl.crewBot?pl.crewBot.lastFiredT:-99)'));
// 行为: 白天全显口径下指挥地图与小地图逐点一致 (含开火窗与过期窗)
const r12=run(`(()=>{ const out={};
cmdResetMatch();
const p=player; p.cls=5; p.alive=true; p.deployed=true; p.spectator=false;
matchOver=false; gamePaused=false; menuHold=false;
p.pos.set(0,0,0);
out.neutral=(typeof MAP_ALL_INTEL!=='undefined')?MAP_ALL_INTEL:null;
if(typeof MAP_ALL_INTEL!=='undefined') MAP_ALL_INTEL=false;
const rows=[];
const vd=(typeof getMapVisDist==='function')?getMapVisDist():9999;
out.vd=vd;
for(const d of [10,90,200,Math.round(vd)+40,900]){
 for(const lf of [undefined,nowT-1,nowT-9]){
  rows.push({d:d,lf:lf===undefined?'-':(lf===nowT-1?'fresh':'stale'),
   dot:cmdMapDotVis(d,0,lf), mm:(typeof mmEnemyVis==='function'?mmEnemyVis(d,0,lf):null)});
 }
}
out.rows=rows;
out.same=rows.every(r=>r.dot===r.mm);
if(out.neutral!==null) MAP_ALL_INTEL=out.neutral;
cmdResetMatch();
return out; })()`);
assert('R12 行为 (白昼全显档): cmdMapDotVis 与 mmEnemyVis 逐点等同 (10/90/200/视野圆外/900m × 无火/刚开火/过期)',
 r12.same===true, JSON.stringify(r12.rows));
// R11-B: 每帧复验 —— 开图中被塞进座位就该收图 (不是继续定身)
const r11=run(`(()=>{ const out={};
cmdResetMatch();
const p=player; p.cls=5; p.alive=true; p.deployed=true; p.spectator=false;
matchOver=false; gamePaused=false; menuHold=false; p.onGround=true; p.onVehicle=null;
const dep=document.getElementById('deploy'); dep.classList.contains=(k)=>k==='hidden';
cmdMapOpen();
out.opened=CMD.mapOn===true;
out.stayOpen=(cmdMapMustClose()===false);
p.onVehicle={kind:'tank'};
out.mustClose=cmdMapMustClose();
cmdFrameTick(0.016);
out.closedAfterTick=CMD.mapOn===false;
p.onVehicle=null;
cmdMapOpen(); p.cls=0; out.notCommander=cmdMapMustClose(); p.cls=5; cmdMapClose(false);
cmdResetMatch();
return out; })()`);
assert('R11 每帧复验: 开图中被塞进载具座位 → cmdFrameTick 当帧收图 (旧: 定身被座位分支 return 绕过)',
 r11.opened===true&&r11.stayOpen===true&&r11.mustClose===true&&r11.closedAfterTick===true&&r11.notCommander===true,
 JSON.stringify(r11));
// 判据必须**只**取硬条件: 把 cmdMapMustClose 的函数体切出来单独看, 里面不得出现姿态抖动项
// (onGround/chute/swim/flying) —— D18 姿态门 (cmdMapCanOpen) 里当然有这些, 那是开图前的一次性判定;
// 每帧复验若也吃姿态, 玩家开图时被一发炮弹掀离地面就会闪关地图 (比不修更糟)。
const mustCloseBody=(()=>{ const i=_s26c2.indexOf('function cmdMapMustClose(){'); if(i<0) return '';
 const j=_s26c2.indexOf('\n}',i); return j>0?_s26c2.slice(i,j):''; })();
assert('R11 复验判据只取硬条件 (非指挥官/座位/结算), 不吃 onGround 抖动 (被炸飞不该闪关地图)',
 mustCloseBody.length>0&&!/onGround|chute|swim|flying/.test(mustCloseBody),
 mustCloseBody?'':'找不到 cmdMapMustClose 函数体');
// 布势整图适配
const fit=run(`(()=>{ const out={};
cmdResetMatch();
const p=player; p.cls=5; p.alive=true; p.deployed=false;
matchOver=false; gamePaused=false; menuHold=false;
if(typeof cmdOrbatBuild==='function') cmdOrbatBuild();
cmdDeployOpen();
out.scale=CMD.view&&CMD.view.scale;
out.follow=CMD._follow;
const cv=document.getElementById('cmdMapCv'); cv.width=1000; cv.height=700;
const k=cmdMapPxPerM();
out.halfW=(cv.width/2)/k; out.halfH=(cv.height/2)/k;
out.MH=(typeof MAP_SIZE!=='undefined'?MAP_SIZE:320)/2;
out.fits=(out.halfW>=out.MH&&out.halfH>=out.MH);
cmdDeployConfirm(); cmdResetMatch();
return out; })()`);
assert('布势视图整图适配 (旧 scale=1 只能看到地图中心 ~55%): 可见半幅 >= 地图半幅',
 fit.fits===true, JSON.stringify(fit));
// _follow 复位
const fl=run(`(()=>{ const out={};
cmdResetMatch();
const p=player; p.cls=5; p.alive=true; p.deployed=true; p.spectator=false;
matchOver=false; gamePaused=false; menuHold=false; p.onGround=true;
p.pos.set(30,0,-40);
const dep=document.getElementById('deploy'); dep.classList.contains=(k)=>k==='hidden';
cmdMapOpen();
out.follow0=CMD._follow;
CMD._follow=false;
CMD.view={cx:999,cz:999,scale:2};
cmdMapClose(false);
out.followAfterClose=CMD._follow;
cmdMapOpen();
out.followAfterReopen=CMD._follow;
out.cx=CMD.view&&CMD.view.cx; out.scaleKept=CMD.view&&CMD.view.scale;
cmdMapClose(false); cmdResetMatch();
return out; })()`);
assert('视图跟随复位: 拖拽 (_follow=false) 后重新开图恢复跟随且中心锚回玩家, 缩放档保留',
 fl.follow0===true&&fl.followAfterReopen===true&&Math.abs(fl.cx-30)<1e-6&&fl.scaleKept===2,
 JSON.stringify(fl));
// 坦克令延迟
const tk=run(`(()=>{ const out={};
cmdResetMatch();
const p=player; p.cls=5; p.alive=true; p.deployed=true;
matchOver=false; gamePaused=false; menuHold=false;
cmdOrbatBuild();
const u=CMD.orbat.tanks[0];
if(!u||!u.veh) return 'NO_TANK';
u.veh.thinkCD=0.85;
out.before=u.veh.thinkCD;
const okF=cmdOrderUnit(u,'attack_move',50,60);
out.ok=okF; out.after=u.veh.thinkCD; out.mode=u.order.mode;
cmdResetMatch();
return out; })()`);
assert('坦克下令清 thinkCD (旧: 最长 0.9s 后才换目标 = 点了没反应)',
 typeof tk==='object'&&tk.ok===true&&tk.before===0.85&&tk.after===0&&tk.mode==='attack_move',
 typeof tk==='string'?tk:JSON.stringify(tk));
// 配比越界 + 跨重生落装
const rat=run(`(()=>{ const out={};
cmdResetMatch();
const p=player; p.cls=5; p.alive=true; p.deployed=true;
matchOver=false; gamePaused=false; menuHold=false;
cmdOrbatBuild();
const s=CMD.orbat.squads[0];
s.ratio=null;
if(s.members[0]) s.members[0].cls=9;
if(s.members[1]) s.members[1].cls=undefined;
const r=cmdRatioOf(s);
out.len=r.length;
out.sum=r.reduce((a,b)=>a+b,0);
out.members=s.members.length;
out.noSixth=(r[5]===undefined);
out.want=(typeof cmdRatioWantBot==='function');
const b=s.members.find(x=>x&&x.alive!==false);
out.wantVal=out.want&&b?cmdRatioWantBot(b):'NA';
out.botNoGrp=(out.want?(cmdRatioWantBot({cls:1})===null):true);
cmdResetMatch();
return out; })()`);
assert('配比: cls 越界/缺失不计入 (无 NaN 幽灵第 6 槽, 合计<=人数) + cmdRatioWantBot 给出 0..4 或 null',
 rat.len===5&&rat.noSixth===true&&rat.sum<=rat.members&&rat.want===true
 &&(rat.wantVal==='NA'||(rat.wantVal>=0&&rat.wantVal<5))&&(rat.wantVal==='NA'||rat.wantVal===null||true)&&rat.botNoGrp===true,
 JSON.stringify(rat));
// ★2026-10-27 排查批: 落装点 bot 必是死人 (spawn 入口 alive=false) ⇒ have 天然不含自己, 无需"摘自己"扣减。
//   定案区分新旧行为: 4 人组, want=[1,1,1,1,0], 活人 cls=[0,1,2] 恰好等于 want 去掉死者那份 ⇒ 唯一正差在
//   cls3, 死者应按 cls3 复活; 旧扣减把 have[0] 虚扣 1 ⇒ gap 在 cls0 虚增, 死者按旧兵种 cls0 复活 (判据红)。
const rat2=run(`(()=>{ const out={};
cmdResetMatch();
const p=player; p.cls=5; p.alive=true; p.deployed=true;
matchOver=false; gamePaused=false; menuHold=false;
cmdOrbatBuild();
const s=CMD.orbat.squads.find(x=>x&&x.members&&x.members.length>=4);
if(!s){ out.pick='NO-SQUAD'; cmdResetMatch(); return out; }
const M=s.members;
for(const b of M){ if(b) b.alive=false; }
const aliveCls=[0,1,2];
let ai=0;
for(const b of M){ if(b&&ai<aliveCls.length){ b.alive=true; b.cls=aliveCls[ai++]; } else if(b){ b.alive=false; b.cls=0; } }
const dead=M.find(b=>b&&b.alive===false);
dead.cmdGrp=s;
s.ratio=[1,1,1,1,0];
out.want=cmdRatioOf(s).join('');
out.pick=cmdRatioWantBot(dead);
cmdResetMatch();
return out; })()`);
assert('配比补差不被"摘自己"扣减带偏: 分布已合 want 时死者按正差位 (cls3) 复活, 不按旧兵种 (cls0)',
 rat2.pick===3,'want='+rat2.want+' pick='+JSON.stringify(rat2.pick));
// D20 暂停优先 (布势版 z500 压过 .screen 20 ⇒ 暂停面板被盖死)
const pg=run(`(()=>{ const out={};
cmdResetMatch();
const p=player; p.cls=5; p.alive=true;
matchOver=false; gamePaused=false; menuHold=false;
cmdOrbatBuild(); cmdDeployOpen();
out.opened=CMD.mapOn&&CMD.mapDeploy;
// ★2026-10-26 交互重做批: 显隐改成**单源 class 开关** (cmdMapWrapShow) —— 旧的"再补一句
//   style.display='none'/''"正是"局内开图看不见"的根因 (它抹掉了 cssText 里的 display:flex)。
//   沙箱 DOM 桩的 classList 是空实现 (contains 恒 false), 所以断言落在布尔账本 CMD._pauseHid 上,
//   另加一条源码判据保证"显隐只走 cmdMapWrapShow"。
gamePaused=true; cmdMapPauseGate();
out.hiddenInPause=(CMD._pauseHid===true);
const v=CMD._pauseHid; cmdMapPauseGate(); out.idem=(CMD._pauseHid===v);
gamePaused=false; cmdMapPauseGate();
out.backAfterResume=(CMD._pauseHid===false);
gamePaused=true; cmdMapPauseGate();
out.hidAgain=(CMD._pauseHid===true);
gamePaused=false;
cmdDeployConfirm();
out.closedClean=(CMD.mapOn===false&&CMD._pauseHid===false);
cmdResetMatch();
return out; })()`);
assert('D20 暂停优先: 暂停期地图自动隐去 (露暂停面板), 解除即放回, 幂等且关图清零',
 pg.opened===true&&pg.hiddenInPause===true&&pg.idem===true&&pg.backAfterResume===true
 &&pg.hidAgain===true&&pg.closedClean===true, JSON.stringify(pg));
assert('D20 冻结分支 (24-main) 也跑同源对账 (暂停期 cmdFrameTick 整个被跳过)',
 _s24c.includes("if(typeof cmdMapPauseGate==='function') cmdMapPauseGate();"));
// 暂停中关图不得抢指针 (否则暂停面板点不动 —— 只能再按一次 Esc 才恢复)
// 源码里换行 + 前导空格把正则的空白吃掉不对, 直接按"三段连写"判 (去掉空白后比对, 与 CRLF/缩进无关)
assert('收图重锁指针带冻结态上限 (暂停/菜单中不重锁, 与 19-input 补锁判据同源)',
 (()=>{ const flat=_s26c2.replace(/\s+/g,'');
 return flat.includes("if(relock&&typeoflockPointer==='function'&&player.alive&&player.deployed&&!(typeofmatchOver!=='undefined'&&matchOver)&&!(typeofgamePaused!=='undefined'&&gamePaused)&&!(typeofmenuHold!=='undefined'&&menuHold)){lockPointer();"); })());
{
const rl=run(`(()=>{ const out={};
cmdResetMatch();
const p=player; p.cls=5; p.alive=true; p.deployed=true; p.spectator=false;
matchOver=false; gamePaused=false; menuHold=false; p.onGround=true;
const dep=document.getElementById('deploy'); dep.classList.contains=(k)=>k==='hidden';
let locked=0; const _lk=(typeof lockPointer==='function')?lockPointer:null;
try{ lockPointer=()=>{ locked++; }; }catch(e){}
cmdMapOpen(); cmdMapClose(true);
out.lockNormal=locked;
cmdMapOpen(); gamePaused=true; const before=locked; cmdMapClose(true); out.lockPaused=locked-before;
gamePaused=false; cmdMapOpen(); menuHold=true; const b2=locked; cmdMapClose(true); out.lockMenu=locked-b2;
menuHold=false;
if(_lk){ try{ lockPointer=_lk; }catch(e){} }
cmdResetMatch();
return out; })()`);
assert('行为: 正常关图重锁指针 / 暂停中关图不重锁 / 菜单期关图不重锁',
 rl.lockNormal===1&&rl.lockPaused===0&&rl.lockMenu===0, JSON.stringify(rl));
}
// 布势可重进 (第二次点指挥官卡在部署页仍应能开布势)
assert('布势可重进: 22-hud 指挥官卡分支不再被 !CMD.deploySeen 一票否决 (部署页 + 已是 cls5 + 未落地)',
 /if\(i===5&&typeof CMD!=='undefined'&&typeof cmdDeployOpen==='function'[\s\S]{0,200}?!player\.deployed/.test(srcOf('js/22-hud.js')));
// 换局清旧指针
const rs=run(`(()=>{ const out={};
const p=player; p.cls=5; p.alive=true; p.deployed=true;
matchOver=false; gamePaused=false; menuHold=false;
cmdOrbatBuild();
const b=CMD.orbat.squads[0]&&CMD.orbat.squads[0].members[0];
const tkv=CMD.orbat.tanks[0]&&CMD.orbat.tanks[0].veh;
const plv=CMD.orbat.planes[0]&&CMD.orbat.planes[0].veh;
cmdResetMatch();
out.botCleared=!!b&&b.cmdGrp===null;
out.tankCleared=(!tkv)||tkv.cmdOrder===null;
out.planeCleared=(!plv)||(plv.cmdOrder===null&&plv.strikePt===null);
out.orbat=CMD.orbat===null;
return out; })()`);
assert('换局清旧 Bot 指针 (cmdGrp/cmdOrder/strikePt) —— 14-bots decide 直读 cmdGrp, 不经过 cmdBotCmd 守卫',
 rs.botCleared===true&&rs.tankCleared===true&&rs.planeCleared===true&&rs.orbat===true,
 JSON.stringify(rs));
// R12 夜间档: 必须在真 NIGHT_MODE 下验 (白天 WX_MM_NEAR=0 ⇒ 恒 true, 测不出任何东西)
{
const nctx=boot(CAMP,{sf_daynight:'night'});
const nr=vm.runInContext(`(()=>{ const out={};
out.night=!!(typeof NIGHT_MODE!=='undefined'&&NIGHT_MODE);
out.near=(typeof WX_MM_NEAR!=='undefined')?WX_MM_NEAR:null;
out.fire=(typeof WX_MM_FIRE!=='undefined')?WX_MM_FIRE:null;
cmdResetMatch();
const p=player; p.cls=5; p.alive=true; p.deployed=true; p.spectator=false;
matchOver=false; gamePaused=false; menuHold=false;
p.pos.set(0,0,0);
if(typeof MAP_ALL_INTEL!=='undefined') MAP_ALL_INTEL=false;
const R=out.near||60;
const rows=[];
for(const d of [R*0.5,R*0.95,R*1.6,900]){
 for(const lf of [undefined, nowT-1, nowT-9]){
  rows.push({d:Math.round(d),lf:lf===undefined?'-':(lf===nowT-1?'fresh':'stale'),
   dot:cmdMapDotVis(d,0,lf), mm:(typeof mmEnemyVis==='function'?mmEnemyVis(d,0,lf):null)});
 }
}
out.rows=rows;
out.same=rows.every(r=>r.dot===r.mm);
// 夜规语义本体: 近距常显 / 远处无火隐 / 远处刚开火显 / 过期再隐
out.nearVis=cmdMapDotVis(R*0.5,0);
out.farHid=cmdMapDotVis(R*1.6,0);
out.farFire=cmdMapDotVis(R*1.6,0,nowT-1);
out.farStale=cmdMapDotVis(R*1.6,0,nowT-9);
out.specAll=(p.spectator=true,cmdMapDotVis(900,0)); p.spectator=false;
out.deadAll=(p.alive=false,cmdMapDotVis(900,0)); p.alive=true;
out.intelAll=(MAP_ALL_INTEL=true,cmdMapDotVis(900,0)); MAP_ALL_INTEL=false;
return out; })()`,nctx);
assert('R12 夜档真身: NIGHT_MODE=true 时 dotVis 与 mmEnemyVis 逐点等同 (近/远 × 无火/刚开火/过期 × 900m)',
 nr.night===true&&nr.same===true, JSON.stringify({near:nr.near,fire:nr.fire,bad:nr.rows.filter(r=>r.dot!==r.mm)}));
assert('R12 夜规语义: 近距常显 / 远处无火隐 / 刚开火显形 / 过期再隐 / 观战·死亡·全图开关旁路全显',
 nr.nearVis===true&&nr.farHid===false&&nr.farFire===true&&nr.farStale===false
 &&nr.specAll===true&&nr.deadAll===true&&nr.intelAll===true, JSON.stringify(nr));
}
// B-8 移动端入口 (2026-10-26 排查轮二审): 触屏没有右键也没有 N 键 ⇒ 指挥官在移动端等于无技能兵种
{
const _idx=SRC('index.html'),_s24t=srcOf('js/24-main.js'),_css=SRC('css/style.css'),_i18=SRC('js/00b-i18n.js');
assert('B-8 移动端指挥官入口: #tCmdMap/#tSlow 按钮 + 24-main 绑定 (tCmdMap→cmdMapToggle 单源) + cmdIsCommander 门控',
 _idx.includes('id="tCmdMap"')&&_idx.includes('id="tSlow"')
 &&/bindBtn\('tCmdMap',\(\)=>\{\s*if\(typeof cmdMapToggle==='function'\) cmdMapToggle\(\);/.test(_s24t)
 &&/bindBtn\('tSlow',\(\)=>\{\s*if\(typeof CMD_TIME!=='undefined'\) keys\[CMD_TIME\.KEY\]=true;/.test(_s24t)
 &&_s24t.includes("show('tCmdMap',base&&(typeof cmdIsCommander==='function')&&cmdIsCommander());")
 &&_s24t.includes("show('tSlow',base&&(typeof cmdIsCommander==='function')&&cmdIsCommander());"));
assert('B-8 触控键有样式与 i18n 键 (移动端切英文不得留中文)',
 _css.includes('#tCmdMap {')&&_css.includes('#tSlow {')
 &&_i18.includes("'指挥':'CMD'")&&_i18.includes("'减速':'SLOW'"));
}
// freeze HUD 的 typeof 守卫
assert('cmdFocusHudTick 的 matchOver 走 typeof 守卫 (裸引用会在缺全局时每帧抛断主循环)',
 _s26c2.includes("||(typeof matchOver!=='undefined'&&matchOver)){")&&!_s26c2.includes('||matchOver){'));
}

// ── 2026-10-27f 排查批: 拖拽平移恢复 / 票尽清空 (设计 D 后半句补实现) / 失败词条 ──
{
const _s26f=srcOf('js/26-commander.js');
// 虫1 中键拖动: mousedown 旧写从不给 drag 赋值 (drag 只在 mousemove/mouseup 出现) ⇒ 首帧 !drag 恒 bail,
// 平移整链死代码; CMD._follow 也从无交互置 false 路径 (只有布势入口), 与 cmdMapOpen/_follow 复暖注释
// 和滚轮注释"拖拽平移仍保留"的宣称相反 —— 注释宣称≠实现, 锚钉两行连写 (mousemove 处没有 _follow 行)。
assert('中键拖动平移接线 (button===1 分支启动 drag + _follow=false; 左键集火/右键关图语义不动)',
 _s26f.includes('else if(e.button===1){')
 &&_s26f.includes('drag={x:e.clientX,y:e.clientY};\nCMD._follow=false;'));
// 虫2 票尽清空: 坦克 15-vehicles/飞机 16-aircraft/士兵 14-bots 的重生门都是 tickets[team]>0 ⇒
// 票尽+死透的单位永不再现, 旧写无任何清账路径 (面板灰行/滚轮停靠/对残骸下令永久残留)。
assert('票尽清空单源: cmdOrbatPrune 定义 + cmdFrameTick 每帧接线 + 三类判据 (死 veh+票尽 / 全灭组+票尽) + tickets typeof 门',
 _s26f.includes('function cmdOrbatPrune(){')
 &&_s26f.includes('cmdOrbatPrune();')
 &&_s26f.includes('!(tickets[u.veh.team]>0)')
 &&_s26f.includes('!u.members.some(b=>b&&b.alive)&&!(tickets[_tm]>0)')
 &&_s26f.includes("typeof tickets==='undefined'||!tickets) return"));
// 虫3 开图失败词条: 旧串"手持通讯仪"在两条入口上都是错的 (右键路径已持通讯仪, 触屏路径不需要)。
assert('开图失败/平移词条跟走 (徒步于地面 / 两句平移词条都在)',
 _s26f.includes("t2('指挥地图: 需徒步于地面')")
 &&_s26f.includes('左键=集火 · 中键拖动=平移 · 右键=关闭')
 &&_s26f.includes('左键=集火 · 中键拖动=平移 · 右键=退出'));
// 行为: 票尽+死坦克=出编制且高亮清账 / 还有票=保留 (战损灰显档) / 全灭组+票尽=出编制。
// 沙箱 tickets 是真对局账 (开局 boot), 场景就地改账后还原; 无坦克/无组的小局跳过对应臂。
const pr=run(`(()=>{ const out={};
cmdResetMatch(); cmdOrbatBuild();
const tk=CMD.orbat.tanks[0];
out.noTank=!tk;
if(tk){
 tk.veh.alive=false; tickets[tk.veh.team]=0; CMD.hl=tk; CMD.sel=tk;
 const before=CMD.orbat.tanks.length;
 cmdOrbatPrune();
 out.pruned=CMD.orbat.tanks.length===before-1;
 out.hlCleared=CMD.hl===null&&CMD.sel===null;
}
const tk2=CMD.orbat.tanks[0];
if(tk2){
 tk2.veh.alive=false; tickets[tk2.veh.team]=5;
 cmdOrbatPrune();
 out.kept=CMD.orbat.tanks.indexOf(tk2)>=0;
 tk2.veh.alive=true; tickets[tk2.veh.team]=10;
}
const sq=CMD.orbat.squads[0];
out.noSquad=!sq;
if(sq){
 for(const b of sq.members) if(b) b.alive=false;
 tickets[player.team]=0;
 const bs=CMD.orbat.squads.length;
 cmdOrbatPrune();
 out.squadPruned=CMD.orbat.squads.length===bs-1;
 tickets[player.team]=20;
}
cmdResetMatch();
return out; })()`);
const okPrune=(pr.noTank===true)||(pr.pruned===true&&pr.hlCleared===true);
const okKeep=!(('kept' in pr))||pr.kept===true;
const okSquad=(pr.noSquad===true)||(pr.squadPruned===true);
assert('票尽清空行为: 死坦克+票尽=出编制(高亮清账) / 还有票=保留(灰显档) / 全灭组+票尽=出编制',
 okPrune&&okKeep&&okSquad, JSON.stringify(pr));
}

// ── 汇总 ─────────────────────────────────────────────────────
console.log(`\n${NEG?'[阴性对照] ':''}verify-commander: ${OK.length} 通过, ${BAD.length} 失败`);
if(BAD.length){ console.log('失败项:'); for(const b of BAD) console.log('  ✗ '+b); process.exit(1); }
process.exit(0);
