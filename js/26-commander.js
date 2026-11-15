// ─────────────────────────────────────────────
// 26-commander.js —— 指挥官模式 (设计定稿 2026-10-25, 开工批 2026-10-26)
//
// 定位: 指挥官不是独立对局模式, 是**兵种级 RTS 附加层** (设计 §0)。四块新地全在本文件,
// 外部文件只留最小接线:
//   ① 兵种三件套: cls5 指挥官 (09a-defs CLASSES / 00-config FACTIONS.cls 第六行) + 通讯仪主武器
//      (无火力工具, 右键开图) + 整局双向锁 (R10, 盖章在 23-deploy deployPlayer)。
//   ② 编制与命令: 开局定编 (cmdOrbatBuild, 挂 startMatch 尾 = 世界构建尾, 玩家未部署即存在);
//      四词汇命令 free/attack_move/hold/strike 直接覆写目标状态不动 Bot 决策核心 ——
//      步兵消费点在 14-bots decide 的 CMD 块 (SQUAD 块同款范式), 坦克在 15-vehicles driveAI
//      首分支, 飞机在 16-aircraft planeAI strike 块。编制挂组不挂人 (D16): 组令在 unit.order 上,
//      组员阵亡重生自动回组续令; 非 free 态禁自发上 idle 载具 (cmdBotFree 单源)。
//   ③ 指挥地图: 底图开局烘焙一次 (cmdBake, 地形/道路/水面/建筑 footprint), 可破坏建筑炸毁后
//      footprint 打废墟色补丁 (D19, 挂 g.onDead 包装); 实时层敌显**复用小地图敌显管线单源**
//      (R12: getMapVisDist 视野圆 + MAP_ALL_INTEL 全图开关 + 观战/死亡旁路, cmdMapDotVis 为
//      探针判据); 点选单位下令, 滚轮缩放/拖拽平移。
//   ④ 时间减速: 帧长三态化 (常速/减速/停) 接在 24-main 的 cmdDtGate —— K 时停 (specTimeConsume)
//      返回 0 时减速不复活 (D14 时停优先); 读条资源 cmdFocus (命名避开交互读条网 readBarActive,
//      D5 锚点 7s/恢复 1/3); 两设置开关 (R9); 观战减速无收支 (R8); 布势冻结 (D21) 同走本门。
//
// 红线: 普通兵种/观战/时停/小地图零回归 —— 所有新路径都以 cls===5 或 typeof CMD 模块为门。
// ‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧
'use strict';
// ═══════════════ 一、常量与全局态 ═══════════════
// 减速参数 (D5 锚点, 实现期可调): 流速 0.2x / 按住式 / 满读条支撑 7s / 恢复 = 消耗的 1/3 (21s 回满)。
// REARM_FRAC: 读条耗尽后的重新起用阈值 (占满格比例)。迟滞防"耗尽↔恢复"逐帧抖动 (见 cmdFrameTick)。
// ★2026-10-26 交互重做批 (用户裁定「N 太远」): 减速键 N → V。近战键让位到 N (见 19-input 的说明块) ——
//   两键互换是唯一不给任何一方留下"够不着"的方案: V 在 WASD 手位上, 近战是高频瞬时动作、减速是持续按住,
//   持续按住的那只手更适合放在食指能压住的 V 上。
const CMD_TIME={ SLOW_MUL:0.2, FOCUS_MAX:7, REGEN_MUL:1/3, REARM_FRAC:0.25, KEY:'KeyV' };
// 指挥态三命令键 (用户需求 4: E=到此处防守 / F=进攻此处·飞机=向此处投弹 / R=自由推进)。
// 与 19-input 的既有键表**不共享语义**: 这三个键只在指挥地图开着时归地图 —— 关图后 E=右倾身 / F=互动 /
//   R=装填 逐位不变。所以这是"键位复用"而不是"改键", 不需要第二套键位配置, 也不会波及任何既有功能。
// 分流的唯一判据是 cmdMapKeyGate (本文件导出), 19-input 只问它一句, 不许自己再写一份键名判断。
const CMD_KEYS={ hold:'KeyE', attack:'KeyF', free:'KeyR' };
// 集火 (用户需求 3: 左键点目标 → 附近己方火力集中打它)。R=吃令半径 / DUR=持续秒数 / MARK_R=地图上的标记半径(m)
// 半径语义: 以集火点为中心的**圆内**己方单位吃令 —— 这样"点哪里"与"谁能听到"是同一个几何量, 玩家可预期。
const CMD_FIRE={ R:60, DUR:14, MARK_R:9 };
// R9 两设置项 ("游戏内容设置"区, 与「地图全图信息」同栏目): 默认档保平衡 (耗读条 + 自己也慢)。
const CMD_SETTINGS={
focusCost:(localStorage.getItem('sf_cmd_focus')??'1')==='1',   // 减速消耗读条 (默认开; 关=观战级玩具档)
selfExempt:localStorage.getItem('sf_cmd_self')==='1',          // 减速对我无效 (默认关; 开=超人档)
};
function cmdSettingsSet(k,v){
CMD_SETTINGS[k]=v;
localStorage.setItem(k==='focusCost'?'sf_cmd_focus':'sf_cmd_self',v?'1':'0');
}
// 队色表 (D6 色盲友好: 队色+队号双编码; v1 只活在指挥地图)
const CMD_SQUAD_COLORS=['#5aa0ff','#3fd6d0','#ffd75a','#6be07a'];
const CMD_SQUAD_NAMES=['1','2','3','4','5','6'];
const CMD_ENEMY_COL='#ff5040';
// 指挥官态 (局数据): lockedDir = R10 双向锁 (null=首次部署前 / 'in'=本局已选指挥官, 换不出 /
// 'out'=本局已选他种, 换不进)。换局复位 (cmdResetMatch, 挂 resetPlayerForNewMatch)。
const CMD={
orbat:null,          // {squads:[{kind:'inf',id,members,order,ratio}], tanks:[{kind:'tank',id,veh,order}], planes:[...]}
lockedDir:null,
focus:CMD_TIME.FOCUS_MAX,   // 指挥读条余量 (秒); 观战不消耗 (R8)
slowOn:false,         // 本帧减速是否生效 (只读视图, 探针/HUD 用)
slowLock:false,       // 读条耗尽后的迟滞锁: 恢复到 REARM_FRAC 前不许再进减速 (防逐帧抖动)
mapOn:false,          // 指挥地图开着
mapDeploy:false,      // 布势版 (D21: 世界冻结 + 配比/初始命令 + 确认开战)
// (旧字段 pick 已随两步下令链退场删除, 见 cmdMapBind 左键分支的说明块; sel 保留 = 面板/选中环兼容读)
deploySeen:false,     // 本局布势界面是否已出过 (只在首次选指挥官卡时自动弹一次)
sel:null,             // 选中的 unit
bake:null,            // {cv, S, half} 底图 (烘焙完成后的成品, cmdBakeNeeded 读它)
_bj:null,             // 底图烘焙**作业** (预算式续算中); 完成即搬到 bake 并置 null (见 cmdBakeAdvance)
_pauseHid:false,      // D20 暂停优先: 暂停期地图是否被临时藏起 (布尔账本, 见 cmdMapPauseGate)
view:null,            // {cx,cz,scale} 视图 (世界中心 + px/m)
_follow:true,         // 视图跟随玩家 (拖拽后取消)
// ── 2026-10-26 交互重做批新增 (用户需求 3/4) ──
hl:null,              // 高亮选中的**可指挥项** (单位对象; 滚轮切换, 同一时刻只有一个)
cursor:null,          // 鼠标在地图上的世界坐标 {x,z} (E/F 的落点 = 这里, 不是选中单位的位置)
focusFire:null,       // 集火点 {x,z,t0,until} (左键点目标; null=无集火)
};
// ═══════════════ 二、兵种/观战 门 (R10/D3/D15) ═══════════════
function cmdClassAvailable(){
// D3: v1 仅标准征服局开放 —— 丧尸局 / 海战图 (有海战载具编制或大舰的图) 不出指挥官兵种卡。
// 海战图判据取编制数据源 (23-deploy spawnNavalOrbat 读同一组字段), 不另写一套"哪些图算海战"。
if(typeof ZOMBIE_MODE!=='undefined'&&ZOMBIE_MODE) return false;
const camp=(typeof CAMPAIGN!=='undefined')?CAMPAIGN:null;
if(!camp) return true;
if(camp.navalN) return false;                                 // 塔拉瓦类: 海战载具编制
if(camp.capital&&camp.capital.length) return false;           // 全海图: 大舰编制
return true;
}
function cmdIsCommander(){ return !!(typeof player!=='undefined'&&player&&player.cls===5&&typeof CLASSES!=='undefined'&&CLASSES[5]&&CLASSES[5].commander); }
// R10 兵种卡门: 返回 null=可选, 否则返回禁选原因文案 (22-hud 卡点击/23-deploy 卡渲染共用)。
// 兵种卡(指挥官位)仅局内首次部署可选 —— 首次部署后按锁定方向禁选: 'in'=已锁指挥官(其余卡全锁),
// 'out'=本局未选指挥官(指挥官卡锁)。文案键与 00b-i18n 词典对齐。
function cmdClassCardGate(i){
if(CMD.lockedDir==='in'&&i!==5) return '本局已锁定指挥官';
if(i!==5) return null;
if(!cmdClassAvailable()) return '本图不开放';
if(player.spectator||(typeof player.specWant==='boolean'&&player.specWant)) return '与观战模式互斥'; // D15 反向
if(CMD.lockedDir==='out') return '本局未选指挥官';
return null;
}
// D15 指挥官与观战态互斥: 指挥官局观战开关置灰 (战斗中开关/选兵阶段/双击兵种卡三路径全在
// 22-hud 巡飞弹卡的同一个 onclick 里, 三条共用本门)。
function cmdSpecToggleGate(){
if(CMD.lockedDir==='in') return '指挥官局不能开观战';
return null;
}
// R10 盖章单源: deployPlayer 落地时调 (cls=最终兵种)。
// ★2026-10-26 反馈批 (用户需求 4「指挥官模式下玩家仍然会有小队跟随」): 盖章即定方向, 顺手结算
//   "玩家私人小队 ↔ 指挥官编制"的互斥 —— 见下方 cmdDisbandPlayerSquad 说明块。
function cmdLockStamp(cls){
if(CMD.lockedDir) return;
if(!cmdClassAvailable()) { CMD.lockedDir='out'; return; }     // 不开放图没有"选入"可言
CMD.lockedDir=(cls===5)?'in':'out';
if(CMD.lockedDir==='in'){ cmdOrbatAdopt(cmdDisbandPlayerSquad()); }
else if(CMD.lockedDir==='out'){ cmdSquadRestore(); }
}
// ── 玩家私人小队 (SQUAD.members) 与指挥官编制互斥 (2026-10-26 反馈批, 用户需求 4) ──
// ①现象: 指挥官局玩家身边仍跟着 3 名私人小队 (23-deploy startMatch 组建, T/Y 跟随照常) —— 但指挥官
//   的部队已全部进了 cmdOrbat 编制表, 同一批战场两套指挥系统并存。
// ②为什么不在 startMatch 拦: 组队发生在 startMatch, 那时玩家还没选兵种 (cmdIsCommander() 恒 false);
//   兵种在部署页才定。所以解散挂在 R10 盖章点 (cmdLockStamp) —— "本局最终兵种已定"的唯一单源,
//   确认开战与 deployPlayer 落地两条路径都汇到这里。
// ③解散不是一扔了之: 这 3 人被组队抢先占掉, cmdOrbatBuild 的 !s.inSquad 过滤把他们排除在编制外,
//   直接清 SQUAD.members 会留下 3 个"不属于任何系统"的孤儿 Bot。cmdOrbatAdopt 把他们**收编进现编制**
//   (优先并入 <5 人的组, 满了开新组), 已下的组令/配比全部保留 (收编不清 order/ratio)。
// ④撤销布势 / 改选其他兵种 (cmdDeployUndo → lockedDir 回 null → 再盖章 'out') 时 cmdSquadRestore
//   原样还编: 出编制、回 SQUAD.members —— 撤销的语义是"这次选择作废", 私人小队也该跟着回来。
// ⑤为什么解散时不重排序号/重建面板: 收编只动 members 与 cmdGrp, cmdOrbatReindex 收尾;
//   SQUAD 空了之后 22-hud 的小队 HUD (SQUAD.members.length 门) 自动隐藏, T/Y 无对象自然 no-op。
function cmdDisbandPlayerSquad(){
const freed=[];
if(typeof SQUAD!=='undefined'&&SQUAD&&SQUAD.members){
for(const s of SQUAD.members){ if(s){ s.inSquad=false; freed.push(s); } }
SQUAD.members.length=0;
}
CMD._disbanded=freed;
return freed;
}
function cmdOrbatAdopt(bots){
if(!CMD.orbat||!bots||!bots.length) return;
for(const b of bots){
if(!b) continue;
let u=null;
for(const s of CMD.orbat.squads){ if(s.members.length<5){ u=s; break; } }
if(!u){ u={kind:'inf',id:0,members:[],order:{mode:'free',x:0,z:0},ratio:null}; CMD.orbat.squads.push(u); }
u.members.push(b); b.cmdGrp=u;
}
cmdOrbatReindex();
}
function cmdSquadRestore(){
const list=CMD._disbanded;
CMD._disbanded=null;
if(!list||!list.length||typeof SQUAD==='undefined'||!SQUAD) return;
for(const b of list){
if(!b) continue;
const u=b.cmdGrp;
if(u&&CMD.orbat){
const i=u.members.indexOf(b);
if(i>=0) u.members.splice(i,1);
}
b.cmdGrp=null;
b.inSquad=true;
SQUAD.members.push(b);
try{ if(b.mesh&&b.mesh.tag&&b.mesh.tag.material) b.mesh.tag.material.color.set(0xffffff); }catch(e){}
}
// 撤空了的组就地摘除 (成员都走了还留着 = 地图/面板上的幽灵空组), 再重排序号
if(CMD.orbat) CMD.orbat.squads=CMD.orbat.squads.filter(s=>s&&s.members.length);
cmdOrbatReindex();
}
// ═══════════════ 三、编制 (设计 §5: 开局定编, 挂世界构建尾) ═══════════════
// 己方步兵按 ceil(n/5) 分组、每组 3~5 人; 每辆坦克/每架飞机各一个单位 (编制挂载具对象 ——
// 15-vehicles 坦克同对象复位重生已查实, 挂对象即跨战损存续)。玩家小队 (SQUAD.members) 与
// 车组/飞行员/大舰炮手不进步兵组 (车组跟载具单位走)。
function cmdOrbatBuild(){
CMD.orbat={squads:[],tanks:[],planes:[]};
if(typeof soldiers==='undefined'||typeof player==='undefined') return CMD.orbat;
// ★2026-10-26 交互重做批 修复 (用户需求 2: 小队位置与成员显示位置严重偏差/漂移):
//   ①现象: 指挥地图上队标 (队号) 与它自己的队员点对不上, 两拨像素各走各的; 队伍一上车/一重生,
//     偏差就换一个方向, 看起来像"漂移"。
//   ②根因: 编制按**开局那一刻**的散兵快照切组 (foot 过滤掉 onVehicle/pilotOf 等), 但切完之后
//     组员会被 14-bots 的 spawn 自动上 idle 载具 (D16 只在非 free 态禁)、阵亡重生换落点、被迫上阵位 ——
//     组员集合于是长期包含"此刻坐在几十米外的车里"的人。而绘制/命中/下令三条链对**同一个组**用了
//     **两种**口径: 队标与队员点只画 `alive&&!onVehicle` 的人 (质心 A), 选中环与点选命中却用 `alive`
//     全部人 (质心 B)。A≠B 时同一个组在图上就有两个"中心", 玩家点队标选中的却是另一个中心的那一坨。
//   ③口径: 组成员身份**只在编制建立时**确定, 之后不许再按"此刻在不在车上"重新划分谁属于这组 ——
//     全文件统一一个过滤函数 cmdSquadShown (见下), 绘制/命中/下令/质心四处全部走它。
//     在车上/阵位的组员不是"离开本组", 而是"本组暂时不在那个位置出现", 两件事不能混为一谈。
const foot=soldiers.filter(s=>s&&s.team===player.team&&!s.onVehicle&&!s.pilotOf&&!s.inSquad&&!s.zombie);
const n=foot.length;
if(n>0){
const g=Math.max(1,Math.ceil(n/5));                           // ceil(n/5); n<5 单组 (小局边界)
// ★2026-10-26 反馈批 (用户需求 3「选中相对集中的几人为一队」): 编组从「数组序均匀切片」改为**就近聚合**。
//   旧写 foot.filter((_,i)=>i%g===gi) 按下标取模切片, 而 foot 顺序=出生数组序 (与空间无关), 同组的人
//   经常散在基地对角 —— 指挥地图上一组的队标/命令圈罩住的是一片彼此不相邻的点, "集中管理"无从谈起。
//   就近聚组 (贪心最近邻, 规模与旧写同规格):
//   ①目标规模均衡 (n=14,g=3 → 5/5/4);
//   ②每组从「离已分组质心最远的未分配者」起种子 (避免组间粘连), 再反复并入离组质心最近的未分配者
//     直到满员 —— 组内天然空间紧凑, 队标罩住的就是一片真实邻域。n≤20 级别, O(n²) 无谓。
const un=foot.slice();
const base=Math.floor(n/g), rem=n-base*g;
for(let gi=0;gi<g;gi++){
const want=base+(gi<rem?1:0);
let seed=null,sd=-1;
if(gi===0){ seed=un[0]; }
else{
let ax=0,az=0,m=0;
for(const u2 of CMD.orbat.squads) for(const b2 of u2.members){ ax+=b2.pos.x; az+=b2.pos.z; m++; }
ax/=m||1; az/=m||1;
for(const b of un){ const d=(b.pos.x-ax)*(b.pos.x-ax)+(b.pos.z-az)*(b.pos.z-az); if(d>sd){ sd=d; seed=b; } }
}
un.splice(un.indexOf(seed),1);
const members=[seed];
while(members.length<want&&un.length){
const cx2=members.reduce((a,b)=>a+b.pos.x,0)/members.length;
const cz2=members.reduce((a,b)=>a+b.pos.z,0)/members.length;
let best=null,bi=0,bd=1e18;
for(let i2=0;i2<un.length;i2++){ const b=un[i2]; const d=(b.pos.x-cx2)*(b.pos.x-cx2)+(b.pos.z-cz2)*(b.pos.z-cz2); if(d<bd){ bd=d; best=b; bi=i2; } }
members.push(best); un.splice(bi,1);
}
const u={kind:'inf',id:gi,members,order:{mode:'free',x:0,z:0},ratio:null};
for(const b of members) b.cmdGrp=u;                           // 编制挂组不挂人 (D16): 命令从组读
CMD.orbat.squads.push(u);
}
}
if(typeof tanks!=='undefined') for(const t of tanks){
if(!t||t.team!==player.team) continue;
const u={kind:'tank',id:CMD.orbat.tanks.length,veh:t,order:{mode:'free',x:0,z:0}};
t.cmdOrder=u.order; CMD.orbat.tanks.push(u);
}
if(typeof planes!=='undefined') for(const pl of planes){
if(!pl||pl.team!==player.team) continue;
const u={kind:'plane',id:CMD.orbat.planes.length,veh:pl,order:{mode:'free',x:0,z:0}};
pl.cmdOrder=u.order; pl.strikePt=null; CMD.orbat.planes.push(u);
}
cmdOrbatReindex();
return CMD.orbat;
}
// ── 单位显示的**唯一**过滤口径 (绘制 / 点选 / 下令 / 质心 四处共用) ──
// 返回该单位此刻**在地图上应该出现在哪里**的那批人: 活着 + 步行 (在车上/阵位上的组员不单独占点 ——
// 他们由载具单位自己代表, 与 22-hud 小地图 "if(!sol.alive||sol.onVehicle) continue" 同一条口径)。
// 关键点: 这是**显示**口径, 不是**归属**口径 —— 组员集合 (unit.members) 永不因上下车而变。
function cmdSquadShown(u){
if(!u||!u.members) return [];
const out=[];
for(const b of u.members){ if(b&&b.alive&&!b.onVehicle) out.push(b); }
return out;
}
// 单位质心 (世界坐标); 无人可显时返回 null (调用方据此跳过绘制/命中)。
// ★这是"队标画在哪 / 点选命中哪 / 选中环画在哪"的**同一份**答案 —— 旧写三处各算一遍且口径不同。
function cmdUnitCenter(u){
if(!u) return null;
if(u.kind==='inf'){
const sh=cmdSquadShown(u);
if(!sh.length) return null;
let ax=0,az=0;
for(const b of sh){ ax+=b.pos.x; az+=b.pos.z; }
return {x:ax/sh.length,z:az/sh.length,n:sh.length};
}
const v=u.veh;
if(!v||!v.pos) return null;
return {x:v.pos.x,z:v.pos.z,n:1};
}
// 编制序号重排 (用户需求 4 的列表依赖它): 单位在列表里的顺序 = 这个 id; 队色/队名/编号全部按 id 取模。
// ★为什么需要重排: cmdMapHit 的命中优先级、面板顺序、滚轮切换顺序都以"同一份列表"为准 ——
//   旧写三处各自 forEach 三个数组 (squads/tanks/planes), 顺序虽然一致但**没有统一的扁平列表**, 于是
//   滚轮切换要再写一遍三连 forEach。这里给出唯一扁平表 (cmdUnits), 谁要遍历就调它。
function cmdOrbatReindex(){
if(!CMD.orbat) return;
let i=0;
for(const s of CMD.orbat.squads) s.id=i++;
for(const t of CMD.orbat.tanks) t.id=i++;
for(const p of CMD.orbat.planes) p.id=i++;
}
// 全部可指挥单位 (扁平, 顺序即列表顺序/滚轮顺序/命中优先级); 无编制返回空数组。
function cmdUnits(){
if(!CMD.orbat) return [];
const out=[];
for(const s of CMD.orbat.squads) out.push(s);
for(const t of CMD.orbat.tanks) out.push(t);
for(const p of CMD.orbat.planes) out.push(p);
return out;
}
// ── 票尽清空 (设计 D 条款「地图战损灰显/票尽清空」的后半句, 2026-10-27 排查批 补实现) ──
// 载具与士兵的重生门是同一条: 坦克 15-vehicles / 飞机 16-aircraft / 步兵 14-bots 都是
// `respawnT<=0 && !matchOver && tickets[team]>0` ⇒ 本队兵力票归零后, 阵亡单位**永远不会再出现**。
// 旧写没有任何清账路径: 这种"死透的单位"原样留在编制表里 —— 面板永远多一行灰"全灭"、滚轮切换
// 会停在上面、E/F/R 能对残骸下令 (令挂在一个永远无法执行的载体上)、集火半径还会把它算进
// "n 个单位"的播报。设计明写"票尽清空", 这里补上单源: 判据 = 单位已无任何可上阵成员 且 本队票尽。
//   · 坦克/飞机: veh 已死 + tickets[veh.team]<=0 (还剩票的灰显等重生, 不动 —— 那是"战损灰显"档);
//   · 步兵组: 全员死亡 + tickets[player.team]<=0 (有人活着或还有票 ⇒ 组还在产出, 保留)。
// 注意 tickets 未定义 (极端沙箱) 时整体 no-op —— 探针沙箱大多不建 tickets, 判据必须带 typeof 门,
// 否则 verify-commander 里按 下标读 orbat.tanks[0] 的既有断言会被裁剪打空。裁剪后重排序号 + 高亮/
// 选中账若正指着被裁单位一并归零 (滚轮 cmdHlStep 的 i<0 分支会重新从列表头接上)。
// 调用点只有 cmdFrameTick 每帧一处 (数组长度个位数, 全量扫描可忽略); 单位退场时顺手把挂载具上的
// cmdOrder/strikePt 摘干净 (与 cmdResetMatch 的换局摘账同一纪律)。
function cmdOrbatPrune(){
if(!CMD.orbat||typeof tickets==='undefined'||!tickets) return;
const _tm=(typeof player!=='undefined'&&player)?player.team:-1;
let changed=false;
const gone=[];
for(let i=CMD.orbat.tanks.length-1;i>=0;i--){
const u=CMD.orbat.tanks[i];
if(u&&u.veh&&!u.veh.alive&&!(tickets[u.veh.team]>0)){ u.veh.cmdOrder=null; gone.push(u); CMD.orbat.tanks.splice(i,1); changed=true; }
}
for(let i=CMD.orbat.planes.length-1;i>=0;i--){
const u=CMD.orbat.planes[i];
if(u&&u.veh&&!u.veh.alive&&!(tickets[u.veh.team]>0)){ u.veh.cmdOrder=null; u.veh.strikePt=null; u.veh.strikeT0=undefined; gone.push(u); CMD.orbat.planes.splice(i,1); changed=true; }
}
if(_tm>=0) for(let i=CMD.orbat.squads.length-1;i>=0;i--){
const u=CMD.orbat.squads[i];
if(u&&u.members&&!u.members.some(b=>b&&b.alive)&&!(tickets[_tm]>0)){ gone.push(u); CMD.orbat.squads.splice(i,1); changed=true; }
}
if(!changed) return;
cmdOrbatReindex();
if(CMD.hl&&gone.indexOf(CMD.hl)>=0) CMD.hl=null;
if(CMD.sel&&gone.indexOf(CMD.sel)>=0) CMD.sel=null;
}
// 单位名 (面板/播报/地图标签的**唯一**来源; 旧写同一条拼串在 5 处各写一遍且取模不一致)。
function cmdUnitName(u){
if(!u) return '';
if(u.kind==='inf') return t2('步兵{0}组',CMD_SQUAD_NAMES[u.id%CMD_SQUAD_NAMES.length]);
if(u.kind==='tank') return (u.veh&&u.veh.name)||('坦克'+(u.id+1));
return (u.veh&&u.veh.name)||('飞机'+(u.id+1));
}
// 单位色 (队色单源): 步兵按队色表取模; 坦克/飞机同表顺延 (与旧写逐位一致, 只是收敛到一处)。
function cmdUnitColor(u){
if(!u) return '#cfd8c2';
return CMD_SQUAD_COLORS[u.id%CMD_SQUAD_COLORS.length];
}
// 换局/回菜单复位 (挂 22-hud resetPlayerForNewMatch)
// ★2026-10-26 排查轮二审 修复 (换局时旧 Bot 上的 cmdGrp 指针残留): 旧注释写「旧 Bot 对象上残留的
//   cmdGrp 随退场一起失效」—— 那是**基于对象生命周期**的乐观假设, 而 14-bots 的 decide 是直接读
//   `this.cmdGrp.order` 的 (不经过 cmdBotCmd 的 !CMD.orbat 守卫), 换局窗口里只要还有一帧跑到某个旧
//   Bot 的 decide, 就会拿着上一局的组令继续推进 (且组令指向的坐标来自上一张地图/上一局布势)。
//   换局就地摘干净: 人->cmdGrp, 坦克->cmdOrder, 飞机->cmdOrder+strikePt 一并归位。
function cmdResetMatch(){
if(typeof soldiers!=='undefined') for(const b of soldiers){ if(b&&b.cmdGrp) b.cmdGrp=null; }
if(typeof tanks!=='undefined') for(const tk of tanks){ if(tk&&tk.cmdOrder) tk.cmdOrder=null; }
if(typeof planes!=='undefined') for(const pl of planes){ if(!pl) continue; if(pl.cmdOrder) pl.cmdOrder=null; pl.strikePt=null; }
CMD.orbat=null; CMD.lockedDir=null; CMD.focus=CMD_TIME.FOCUS_MAX;
CMD.slowOn=false; CMD.slowLock=false; CMD.sel=null; CMD.bake=null; CMD.view=null; CMD._follow=true;
CMD.deploySeen=false;
CMD._pauseHid=false;
CMD._disbanded=null;   // 私人小队解散账 (反馈批用户需求 4): 换局作废 —— SQUAD.members 由换局链自己清
CMD.hl=null; CMD.cursor=null; CMD.focusFire=null;   // 交互重做批: 高亮/光标/集火都是局数据, 换局归零
CMD._bj=null;   // 底图烘焙作业 (预算式续算): 换局必须作废, 否则新图会接着旧图的采样游标画
if(CMD.mapOn) cmdMapClose(false);
CMD.mapDeploy=false;
}
// ── 编制全令归 free (2026-10-27 排查批: 撤销布势的收尾单源, 23-deploy cmdDeployUndo 消费) ──
// 语义: 把编制内所有单位 (步兵组/坦克/飞机) 的命令账一次性归回 free, 飞机连 strike 任务账
// (strikePt/strikeT0, 同生同灭口径与 cmdOrderUnit 的 free 分支逐位一致) 一并清。
// 静音面: 不响反馈音、不重置 repath —— 调用场景是"整份布势作废", 不是玩家逐个下令。
// 为什么必须存在: cmdDeployUndo 复位了配比/锁章/看图账/私人小队, 唯独没清**初始令** —— 玩家布势时
// 用 E/F/R 下过的 hold/attack/strike 原样留在编制表上。撤销后改选普通兵种时, 玩家已不是指挥官
// (开不了图), 这批幽灵令却照常被 14-bots/15-vehicles/16-aircraft 消费, 全军按一份"没人能取消的
// 布势令"打满整局 —— 正是 cmdDeployUndo 注释"五份账漏一份=半撤销"里的第六份。
function cmdOrbatClearOrders(){
if(!CMD.orbat) return;
for(const s of CMD.orbat.squads){ if(!s) continue; s.order.mode='free'; s.order.x=0; s.order.z=0; }
for(const tk of CMD.orbat.tanks){ if(!tk) continue; tk.order.mode='free'; tk.order.x=0; tk.order.z=0; }
for(const p of CMD.orbat.planes){
if(!p) continue;
p.order.mode='free'; p.order.x=0; p.order.z=0;
if(p.veh){ p.veh.strikePt=null; p.veh.strikeT0=undefined; }
}
}
// ── 14-bots 消费接口 ──
function cmdBotCmd(bot){
if(!bot||!bot.cmdGrp||!CMD.orbat) return null;
const o=bot.cmdGrp.order;
return (o.mode&&o.mode!=='free')?o:null;
}
// D16: 非 free 态禁自发上 idle 载具 (重生自动上车 pickIdleDeployVehicle 与 decide 85m 认领两处共用);
// free 态 (含无编制 Bot) 返回 true = 零回归。
function cmdBotFree(bot){ return !cmdBotCmd(bot); }
// ── 指挥官编制集中生成 (2026-10-26 反馈批, 用户需求 3「同一个队伍的队员集中生成」) ──
// 重生落点单源: 返回该 Bot 应集中的落点 (组内存活成员质心附近), null = 维持 pickSpawnPoint 原落点。
// 消费点只有 14-bots spawn 一处 (门: this.cmdGrp && cmdIsCommander() —— 非指挥官局零回归)。
// 落点闸与玩家小队开局铺开 (23-deploy) 同一套: occBlocked(死袋/封锁) + freeSpot(站得住) +
// NAV.spawnSpot(就近搬到"走得出去"的位置)。锚选"存活成员质心"而非"上次出生点": 质心随战线自然前移,
// 组员重生永远落在队伍当前位置附近 —— 集中生成的字面语义; 全组死光时无锚, 自动回常规出生点,
// 不会把整队反复空投进同一个死人堆。
function cmdSquadSpawnNear(bot){
const u=bot&&bot.cmdGrp;
if(!u||u.kind!=='inf'||!CMD.orbat) return null;
let ax=0,az=0,m=0;
for(const b of u.members){
if(!b||b===bot||!b.alive) continue;
const p=b.onVehicle?b.onVehicle.pos:b.pos;
if(!p) continue;
ax+=p.x; az+=p.z; m++;
}
if(!m) return null;
ax/=m; az/=m;
for(let k=0;k<6;k++){
const ang=Math.random()*Math.PI*2, rr=6+Math.random()*3;
const wx=ax+Math.cos(ang)*rr, wz=az+Math.sin(ang)*rr;
if(typeof occBlocked==='function'&&occBlocked(wx,wz)) continue;
if(typeof freeSpot==='function'&&!freeSpot(wx,wz,0.6)) continue;
if(typeof spawnEdgeOk==='function'&&!spawnEdgeOk(wx,wz)) continue;   // 出生离边门 (2026-11-13): 编制集中生成同样不出边带
let sx=wx,sz=wz;
if(typeof NAV!=='undefined'&&NAV&&NAV.spawnSpot){ const sp2=NAV.spawnSpot(wx,wz,12); sx=sp2[0]; sz=sp2[1]; }
return {x:sx,z:sz};
}
return null;
}
// ── 15-vehicles 消费接口: driveAI think 块首分支读 ──
function cmdTankCmd(t){
if(!t||!t.cmdOrder||t.cmdOrder.mode==='free') return null;
return t.cmdOrder;
}
// ═══════════════ 四、命令分发单源 (设计 §4: squadOrderMove 的扩展范式) ═══════════════
// 命令 = 直接覆写目标状态 + 重置 repath; 词汇: free / attack_move / hold (步兵&坦克) · strike (仅飞机)。
function cmdOrderUnit(unit,mode,x,z){
if(!unit) return false;
const o=unit.order;
if(unit.kind==='plane'){
const pl=unit.veh;
if(mode==='strike'&&pl){
pl.strikePt={x:+x,z:+z}; pl.strikeT0=(typeof nowT==='number')?nowT:0;
o.mode='strike'; o.x=+x; o.z=+z;
}else if(mode==='free'){
// ★2026-10-26 排查轮二审 修复 (free 后 strikeT0 残留 = 幽灵任务时间戳): 16-aircraft 的 strike 块用
//   "strikeT0!==undefined && nowT-strikeT0>45" 判 45s 超时, 并把 strikeT0 当作「本次任务开始时刻」。
//   旧写 free 分支只清 strikePt 不清时间戳 —— free 的语义是「忘掉这次任务」, 时间戳属于任务的一部分,
//   留着它会让后续任何一次「strikePt 被别的路径重置而 strikeT0 没重置」的组合直接跳过 45s 判定
//   (或反过来立刻判超时)。清空到 undefined, 与 strikePt 同生同灭。
if(pl){ pl.strikePt=null; pl.strikeT0=undefined; }
o.mode='free'; o.x=0; o.z=0;
}else{
// ★2026-10-26 排查轮 P1 修复: 旧写对**任何**非 strike 词汇都静默改写成 free 并 return true ——
//   面板却对飞机照样渲染「进攻此点 / 到此防守」按钮, 玩家看到「命令: 飞机 → 进攻此点」的成功反馈,
//   飞机实际只是自由巡航 (反馈与行为不符, 且 attack_move/hold 对飞机本无语义)。
//   改为与步兵/坦克分支同规: 不认识的词汇直接拒绝 (return false), 调用方据此不给成功反馈。
return false;
}
}else{
if(mode==='free'){ o.mode='free'; o.x=0; o.z=0; }
else if(mode==='attack_move'||mode==='hold'){ o.mode=mode; o.x=+x; o.z=+z; }
else return false;
if(unit.kind==='inf'){
for(const b of unit.members){ if(b){ b.decisionT=0; b.repathT=0; b.path=null; b.defendPt=null; } }
}else if(unit.veh){
const v=unit.veh;
v.repathT=0; if(v.path!==undefined) v.path=null;
// ★2026-10-26 排查轮二审 修复 (下命令后坦克最多 0.9s 才动): 15-vehicles driveAI 的令消费块挂在
//   "if(this.thinkCD<=0)" 里面, 而 thinkCD 每轮重置成 rand(0.6,0.9) —— 玩家在地图上点了「进攻此点」,
//   反馈音立刻响、命令线立刻画出来, 但车要等到下一次 think 才换目标 (坦克巡航速度下 ~7m 的迟滞)。
//   玩家连点两次改令时更明显: 第二次点击看起来「没反应」。下令 = 重算目标的时机, 冷却归零是单源解法
//   (步兵分支同理已重置 decisionT/repathT)。注意只清 thinkCD, 不碰别的思考态 —— 下一帧仍走完整选点逻辑。
if(v.thinkCD!==undefined) v.thinkCD=0;
}
}
// 下令反馈音 (电台咔哒, AudioSys 合成器现成)
try{ if(typeof AudioSys!=='undefined'&&AudioSys.click){ AudioSys.click(1500,0.3,0.05); AudioSys.click(1100,0.25,0.06); } }catch(e){}
return true;
}
// ═══════════════ 五、时间减速 + 布势冻结 (设计 §6 / D21; 24-main 消费) ═══════════════
function cmdSlowAllowed(){
if(typeof matchOver!=='undefined'&&matchOver) return false;
if(typeof gamePaused!=='undefined'&&gamePaused) return false;
if(typeof menuHold!=='undefined'&&menuHold) return false;
if(typeof player==='undefined'||!player) return false;
if(player.spectator) return player.alive;                     // R8: 观战减速可用, 无收支
// 指挥官: 活着已部署才可用 (D12 口径并入: 死亡期不能下令则慢放无意义)
return cmdIsCommander()&&player.alive&&player.deployed;
}
function cmdSlowKeyHeld(){ return !!(typeof keys!=='undefined'&&keys[CMD_TIME.KEY]); }
// ★暂停/菜单/结算期强制回常速 (2026-10-26 修复): cmdFrameTick 挂在 24-main 主循环末段 (191 行),
//   而 gamePaused||matchOver||menuHold 的冻结分支在那之前就 return 了 —— 按住 V 时按 Esc 暂停,
//   松手也收不到任何 tick, CMD.slowOn 会一直挂 true (冻结期看不出来, 一恢复战斗就凭空慢放 0.2x,
//   且读条被继续扣到 0)。冻结分支里补一次同源自愈, 保证松手即回常速在任何帧都成立。
// ★2026-10-26 排查轮: 冻结分支 (24-main:51) 里也必须调一次 —— 只挂在 document.hidden 分支等于没修
//   (隐藏标签页是后台切换, 而按 Esc 暂停走的是**可见**的冻结分支, 那里 return 在 cmdFrameTick 之前)。
function cmdSlowFreezeHeal(){
 CMD.slowOn=false;
}
// 减速是否吃资源: 指挥官 + focusCost 开; 观战恒免费 (R8)
function cmdSlowCostly(){ return !player.spectator&&CMD_SETTINGS.focusCost; }
function cmdFrameTick(rdt){
// ── R11 定身完整性兜底 + D20 边界三连每帧复验 (2026-10-26 排查轮二审) ──
// 放在最前: 本帧的任何后续读取 (读条 HUD/地图重绘) 都应该看到"已经自洽"的状态。
// 收图用 cmdMapClose(true) (带重锁) 而非 cmdMapForceClose: 这条路径的典型触发是"开图期间被塞进了
// 载具座位", 玩家仍在战斗、人还活着, 只是不该继续看图 —— 收图后必须把鼠标交还给他。
// cmdMapClose 内部的 relock 已经自带上限条件 (alive&&deployed&&!matchOver), 死亡/结算路径不会误锁。
if(CMD.mapOn&&cmdMapMustClose()) cmdMapClose(true);
const allowed=cmdSlowAllowed()&&cmdSlowKeyHeld();
let drain=false;
// 读条耗尽 (D5): 只强制回常速, 不关地图不锁功能。★2026-10-26 排查轮修闪烁 —— 旧写 "耗尽即 slowOn=false"
//   与本帧下面的恢复分支同帧打架: focus 归 0 后同 tick 又回 0.0056s, 下一 tick allowed 又成立 ⇒ 减速按帧
//   反复开关, 实测 dt 在 0.0167/0.0033 之间逐帧跳 (平均 ~60% 速度), 永远回不到干净常速。
//   改为**迟滞门**: 耗尽后要等读条恢复到 FOCUS_REARM (满格 1/4) 才允许重新进入减速。
//   迟滞态只在"确实吃读条"的档位成立 —— 观战/免费档无收支, 不存在耗尽, 不引入额外状态。
const costly=cmdSlowCostly();
if(costly&&CMD.focus<=0) CMD.slowLock=true;
else if(!costly||CMD.focus>=CMD_TIME.FOCUS_MAX*CMD_TIME.REARM_FRAC) CMD.slowLock=false;
if(allowed&&costly&&CMD.slowLock){ CMD.slowOn=false; }
else CMD.slowOn=allowed;
// 收支 (真实秒): 按住耗 1/s; 常速下恢复 REGEN_MUL/s (恢复<消耗, 防滥用); 观战/免费档不动账
if(CMD.slowOn&&costly){ CMD.focus=Math.max(0,CMD.focus-rdt); drain=true; }
else if(!CMD.slowOn&&cmdSlowAllowed()&&!player.spectator&&CMD.focus<CMD_TIME.FOCUS_MAX){
CMD.focus=Math.min(CMD_TIME.FOCUS_MAX,CMD.focus+rdt*CMD_TIME.REGEN_MUL);
}
cmdFocusHudTick(drain);
// ── 底图预算式预热 (2026-10-26 排查轮三审) ──
// 每帧推进一步, **地图没开也推**: 玩家从 startMatch → 部署页选兵种 → 点指挥官卡进布势之间有几秒到
// 几十秒的部署页时间, 足够把底图烘完, 于是"进布势/开图"那一刻底图多数已经就位, 连"生成中"都看不到。
// 放在 cmdMapTick 之前: 本帧刚推进的部分本帧就能画出来 (开图中每帧都是在续画的)。
// ★2026-10-27 排查批 修复 (预热只接了一半 —— 有"推进"没"起作业"): 本函数旧写只有 `if(CMD._bj) advance`,
//   而起作业 (cmdBakeBegin) 只存在于 cmdMapDraw / cmdDeployOpen ⇒ 部署页期间作业根本不存在,
//   "部署页时间足够烘完"的承诺落空; cmdDeployOpen 入口只好留着同步整烘兜底 ⇒ 点卡进布势当帧
//   依旧僵住 (三审要修的 0.1~0.7s 卡顿原样复发)。这里补**起作业门**: 编制已建 (startMatch 尾) +
//   本图可能开指挥地图 (cmdClassAvailable: 丧尸/海战图永不开图, 不白烧每帧 8ms 采样预算) +
//   玩家不在观战队列 (观战与指挥官互斥 D15, 观战局同样永不开图)。之后每帧 advance, 部署页的
//   几秒~几十秒足以烘完; 普通局玩成非指挥官时多花的只是一段部署页内的分帧采样 (有上界)。
if(!CMD.bake&&!CMD._bj&&CMD.orbat&&cmdClassAvailable()){
const _pp=(typeof player!=='undefined')?player:null;
if(_pp&&!_pp.spectator&&_pp.specWant!==true){ try{ cmdBakeBegin(); }catch(e){} }
}
if(CMD._bj){ try{ cmdBakeAdvance(CMD_BAKE_BUDGET_MS); }catch(e){ CMD._bj=null; } }
cmdOrbatPrune();   // 票尽清空 (设计 D 条款补实现, 见 cmdOrbatPrune): 死透且无票的单位当帧出编制
cmdMapTick(rdt);
}
// 世界帧长门 (24-main): 输入 specTimeConsume 之后的 dt。三态: 布势冻结=0 / 减速=×SLOW_MUL / 常速原样。
// D14 (K 时停优先): dt<=0 (时停/暂停) 时原样放行 —— 减速绝不把冻结"复活"成 0.2x。
function cmdDtGate(rdt,dt){
if(typeof dt!=='number'||dt<=0) return dt;
if(CMD.mapOn&&CMD.mapDeploy) return 0;                        // D21 布势 = 全局冻结 + UI 可操作
if(CMD.slowOn) return dt*CMD_TIME.SLOW_MUL;
return dt;
}
// 本体链豁免 (R9/D4 "对我无效"超人档): 减速中玩家走真实时间; 默认 (关) 玩家同减速 —— 复用观战者
// 不吃冻结的同源思路: 默认路径 pdt≡dt 零漂移。
function cmdPlayerDt(pdt,rdt){
if(CMD.slowOn&&CMD_SETTINGS.selfExempt&&cmdSlowAllowed()) return rdt;
return pdt;
}
// 座驾豁免: 同上, 只豁免玩家正在开的那台 (playerDriven), 其余载具照吃世界帧长。
function cmdRideDt(v,base,rdt){
if(CMD.slowOn&&CMD_SETTINGS.selfExempt&&v&&v.playerDriven) return rdt;
return base;
}
// ═══════════════ 六、指挥地图 (设计 §4) ═══════════════
// 近全屏 (D8: 四周留窄缝可见战场边缘), 挂 #ui (吃 inMenu/inDeploy/hudHide 既有显隐压制网, 不另开特判)。
function cmdMapWrapEl(){ return document.getElementById('cmdMapWrap'); }
// ★2026-10-26 修复 (用户需求 6: 局内指挥地图根本不显示) —— 单源显隐函数。
//   ①现象: 布势阶段 (选兵种后自动弹的那张图) 一切正常; 一旦确认开战、局内按右键开图, 只有一块空白暗板,
//     地图与右侧面板全不见 (面板文字还压在左上角), 且**整局再也开不出来**。
//   ②根因: cmdMapInit 把 `display:flex` 写在 cssText 里 (一次性), 而 cmdMapClose / cmdMapPauseGate 收图时
//     写 `w.style.display=''` —— 置空的是**内联 display 这个属性本身**, 于是 `display:flex` 这条内联声明被
//     彻底抹掉, wrap 回落到计算值 display:block。block 下 `#cmdMapStage` 的 `flex:1` 不生效 (它只在 flex 容器里
//     才是 flex 项), 高度塌成 0 ⇒ canvas 属性尺寸 1191×200 / 显示尺寸 1191×0 ⇒ 画布高度为 0 = 什么都看不见。
//     布势版之所以正常, 是因为它每次进入都重建了宿主顺序 (cmdMapReparent) 而从未走过"先关再开"。
//   ③口径: 显隐**只有一个入口** = 本函数, 且只动 class (.hidden 是 display:none!important, 与全仓一致);
//     内联 display:flex 在 cmdMapInit 里写一次, 之后**任何路径都不许再写 wrap 的 style.display**。
//     这样"关→开"与"首开"走的是同一条 DOM 路径, 不可能再出现两套状态。
function cmdMapWrapShow(on){
const w=cmdMapWrapEl();
if(!w) return;
w.classList.toggle('hidden',!on);
}
// 布势期的宿主切换 (D21): 战斗指挥地图挂 #ui (吃 inMenu/inDeploy/hudHide 压制网); 布势界面开在
// **选兵阶段** (部署页之上) —— inDeploy 会把整个 #ui 藏掉, 布势版就地改挂 body (离开压制网, 自管显隐)。
function cmdMapReparent(forDeploy){
const w=cmdMapWrapEl();
if(!w) return;
const want=forDeploy?document.body:document.getElementById('ui');
if(!want||w.parentNode===want) return;
want.appendChild(w);
w.style.zIndex=forDeploy?500:320;
}
function cmdMapUIOpen(){ return CMD.mapOn; }
function cmdMapImmobilized(){ return CMD.mapOn&&!CMD.mapDeploy; }   // R11 定身; 布势期人未落地无所谓
// 姿态门 (D18): 仅步行于地面可开 —— onGround 且非载具/阵位/伞降/游泳/控弹。
function cmdMapCanOpen(){
if(!cmdIsCommander()||!player.alive||!player.deployed) return false;
if(typeof matchOver!=='undefined'&&matchOver) return false;
if(typeof gamePaused!=='undefined'&&gamePaused) return false;
if(typeof menuHold!=='undefined'&&menuHold) return false;
// D20: 部署页/暂停面板开着时不可开 (部署页=选兵阶段, D1 死亡期口径同段)
const dep=document.getElementById('deploy');
if(dep&&!dep.classList.contains('hidden')) return false;
const p=player;
if(p.onVehicle||p.onNaval||p.onMG||p.onAT||p.onAA||p.onMortar||p.onBattery||p.loiter) return false;   // (2026-11-10: capitalGun 项随大舰子系统下架摘除)
if(!p.onGround||p.chute||p.swim||p.flying) return false;
return true;
}
function cmdMapToggle(){
// 布势期"关图"= 确认开战 (cmdDeployConfirm 布势首分支): 2026-10-26 反馈批起**画布右键在布势期已改为
//   无操作** (用户裁定取消右键退出, 见 cmdMapBind) —— 本分支只剩触屏 tCmdMap 按钮这一个调用方 (24-main),
//   触屏没有右键, 这个"跳过布势"入口对它是必要的; Esc 走 19-input 直调 cmdDeployConfirm。
if(CMD.mapOn&&CMD.mapDeploy){ cmdDeployConfirm(); return; }
if(CMD.mapOn){ cmdMapClose(true); return; }
if(!cmdMapCanOpen()){ if(typeof showScorePop==='function') showScorePop(t2('指挥地图: 需徒步于地面')); return; }
cmdMapOpen();
}
function cmdMapOpen(){
if(!cmdMapInit()) return;
CMD.mapOn=true; CMD.mapDeploy=false; CMD.sel=null;
CMD._pauseHid=false;                   // 新开图的显隐账本归零 (暂停残留不跨图)
// ★2026-10-26 排查轮二审 修复 (拖拽一次 = 本局永久失去"跟随玩家"): 旧写只在 cmdResetMatch 与
//   cmdDeployOpen 里设 _follow, 而拖拽 (cmdMapBind mousedown 空白处) 把它置 false 之后**没有任何
//   回暖路径** —— 玩家在地图上拖一下视角, 这一整局每次开图都停在老位置上, 而设计本意 (CMD._follow
//   字段注释"视图跟随玩家 (拖拽后取消)") 只是本次看图期间拖开后不跟随。开图 = 新的一次看图。
//   实现: 开图即重新跟随 + 视图中心锚回玩家 (缩放档保留 —— 视野大小是玩家偏好, 与跟不跟随无关)。
//   与"手动关图再开"同源: 关图不清 _follow (拖拽态在关图期间保留), 复位点只有**开图**这一处。
CMD._follow=true;
if(typeof player!=='undefined'&&player&&player.pos){
if(CMD.view){ CMD.view.cx=player.pos.x||0; CMD.view.cz=player.pos.z||0; }
}
// 交互重做批: 开图即高亮第一个单位 (理由同 cmdDeployOpen); 集火/光标是本次看图的新账, 一并归零。
CMD.cursor=null;
{ const us=cmdUnits(); CMD.hl=us.length?us[0]:null; CMD.sel=CMD.hl; }

cmdMapReparent(false);
cmdMapWrapShow(true);
if(document.pointerLockElement) document.exitPointerLock();
cmdMapResize();
cmdMapDraw();
if(typeof showScorePop==='function') showScorePop(t2('指挥地图 · 滚轮切单位 · E=防守此处 · F=进攻此处 · R=自由推进 · 左键=集火 · 中键拖动=平移 · 右键=关闭'));
}
function cmdMapClose(relock){
const wasDeploy=CMD.mapDeploy;
CMD.mapOn=false; CMD.mapDeploy=false;
CMD._pauseHid=false;                   // 暂停期临时隐藏的账本随关图归零 (否则下次开图会被静默藏起来)
cmdMapWrapShow(false);                // ★单源显隐 (见 cmdMapWrapShow 的根因块): 这里**不许**再写 style.display —— 正是它抹掉了 cssText 里的 display:flex
if(wasDeploy) cmdMapReparent(false);   // 布势版挂 body, 收起时搬回 #ui 压制网
// ★2026-10-26 排查轮二审 修复 (暂停中关图 = 指针被抢回去, 暂停面板点不动):
//   ①现象: 开图中按 Esc 暂停 (暂停面板盖上来, 地图被 cmdMapPauseGate 藏起), 再按 Esc 关图 ——
//     地图确实关了, 但指针锁被重新抢回去 ⇒ 鼠标消失, 暂停面板上的「继续/设置/返回主界面」一个都点不动,
//     玩家只能再按一次 Esc 才恢复。这条路径在"暂停期间地图还开着"时 100% 复现。
//   ②根因: relock 的上限条件只查了"活着/已部署/未结算", 漏了"未暂停"与"未回菜单" ——
//     而暂停态恰恰是"已经主动放开鼠标给 UI"的状态, 任何自动重锁都是对它的破坏。
//   ③口径: 指针锁的**唯一职责**是把鼠标交还战斗。冻结态 (暂停/结算/菜单/部署页) 一律不锁 ——
//     与 19-input 的 pointerlockchange 补锁判据 (!gamePaused && !menuHold && 无 .screen) 同源。
if(relock&&typeof lockPointer==='function'&&player.alive&&player.deployed
 &&!(typeof matchOver!=='undefined'&&matchOver)
 &&!(typeof gamePaused!=='undefined'&&gamePaused)
 &&!(typeof menuHold!=='undefined'&&menuHold)){
lockPointer();
}
}
// 结算/死亡/换局强制关 (D20/D1) —— 不重锁指针 (那些路径自己管指针)
function cmdMapForceClose(){ if(CMD.mapOn) cmdMapClose(false); }
// ── D20 边界三连的"每帧复验"支: 定身兜底 (R11 完整性) ──
// ★2026-10-26 排查轮二审 修复 (开图态可以被别的子系统"绕过去"): R11 说开图期玩家定身, 但定身只在
//   20-player 本帧的移动段生效 —— 一旦有**任何**路径把人塞进座位 (触控交互按钮直调 tryInteract、
//   观察者幽灵坦克召唤、观战切换、载具重生抢占 etc.), 那一路的 update 分支就 return 在定身代码之前,
//   地图还开着、人已经在开车开炮了。此时唯一正确的行为不是"继续定身"而是**关图** (姿态门 D18 说
//   坐车不能指挥) —— 让状态回到自洽, 而不是靠"每一条上车路径都记得检查"的散装纪律。
//   判据只取硬条件 (身份/生死/座位/结算), **不含姿态抖动** (onGround/chute): 玩家开图时被爆炸掀起来
//   一瞬不该把地图闪关掉。布势期 (mapDeploy) 人未落地, 一律豁免。
function cmdMapMustClose(){
if(!CMD.mapOn||CMD.mapDeploy) return false;
if(typeof player==='undefined'||!player) return false;
if(!cmdIsCommander()||!player.alive||!player.deployed) return true;
if(player.onVehicle||player.onNaval||player.onMG||player.onAT||player.onAA||player.onMortar||player.onBattery||player.loiter) return true;   // (2026-11-10: capitalGun 项随大舰子系统下架摘除)
if(typeof matchOver!=='undefined'&&matchOver) return true;
return false;
}
// ── D20 暂停优先级 (布势版地图 z-index 500 压过 .screen 20) ──
// ★2026-10-26 排查轮二审 修复 (布势期按 Esc 暂停 = 被自己的地图盖死): 布势版地图为了脱离 #ui 的
//   显隐压制网 (inDeploy 会把整个 #ui 藏掉) 就地挂在 body 上并抬到 z-index 500, 而暂停面板
//   (#pauseOv) 是 css .screen 的 z-index 20 —— 暂停面板确实打开了, 却被地图完全盖住, 玩家看到的
//   是"按了 Esc 什么也没发生"(且暂停期世界冻结, 更像死机)。设计 D20 明写"暂停菜单优先于指挥地图"。
//   实现取**显隐对账**而不是改 z-index: 暂停期把地图藏起来 (暂停面板自然露出), 解除暂停后由
//   cmdMapTick 同源放回 —— 不引入第二套层级数值, 也不动 css (.screen 的 20 是全局约定)。
// 显隐状态记在 CMD._pauseHid 上 (布尔账本) 而不是每帧读 classList: 本仓沙箱 (dev/_bootstub) 的
// classList.contains 恒 false, 只读 DOM 的对账在探针里永远判成"已经显示中" ⇒ 无法断言。
// 布尔账本 + 幂等写入是同一纪律 (状态变了才写 DOM), 且真 DOM 与桩 DOM 行为一致。
function cmdMapPauseGate(){
const w=cmdMapWrapEl();
if(!w) return;
const frozen=(typeof gamePaused!=='undefined'&&gamePaused)||(typeof menuHold!=='undefined'&&menuHold)||(typeof matchOver!=='undefined'&&matchOver);
const wantHide=!!(CMD.mapOn&&frozen);
if(CMD._pauseHid===wantHide) return;                     // 稳态零 DOM 写入 (本仓 HUD 对账纪律)
CMD._pauseHid=wantHide;
// 显隐仍走单源 (cmdMapWrapShow): 暂停期藏起来、解冻期放回去, 两条都是同一个 class 开关 ——
// 旧写在 else 分支手工 remove('hidden') 再补一句 style.display='' 的"双保险", 正是那句把 display:flex 抹掉的
// (用户实报的"局内指挥地图根本不显示"就是这个双保险造成的, 见 cmdMapWrapShow 的根因块)。
if(wantHide) cmdMapWrapShow(false);
else if(CMD.mapOn) cmdMapWrapShow(true);                  // 地图已经关掉时不要把它"放回"来 (由 cmdMapClose 管)
}
// DOM 构建 (幂等; 动态建在 #ui 里 —— index.html 只加 script 行, 结构归本文件)
function cmdMapInit(){
if(cmdMapWrapEl()) return true;
const ui=document.getElementById('ui');
if(!ui) return false;
const w=document.createElement('div');
w.id='cmdMapWrap'; w.className='hidden';
// ★pointer-events:auto 必带 (2026-10-26 修复): #ui 是 pointer-events:none 的纯展示层 (css/style.css:22),
//   该属性会被**全部后代继承** —— 指挥地图挂 #ui 后不显式放开, 点选单位/右键下令/滚轮缩放/拖拽平移/
//   右侧面板按钮一个都收不到鼠标事件 (图上只有画面, 完全点不动)。.classCard (css:397) / .bigBtn
//   等既有可交互件都在各自规则里显式写 pointer-events:auto, 本图同源照做。
//   · background 用**不透明**深底 (2026-10-26 反馈批, 用户需求 6「变明变暗」): 旧 rgba(10,14,8,.92)
//     透出 8% 的战场 —— 身后爆炸/枪口焰每一下都从面板与边距底下渗过来, 读作"界面无端忽明忽暗"。
//     四周 2.2% 露出战场窄缝是 D8 的既有设计, 不受影响 (那是 wrap 外面, 不是透出来的)。
w.style.cssText='position:absolute;inset:2.2%;z-index:320;display:flex;gap:8px;background:rgb(10,14,8);border:2px solid rgba(210,200,160,.45);border-radius:8px;pointer-events:auto;';
const mc=document.createElement('div');
mc.style.cssText='flex:1;position:relative;min-width:0;';
const cv=document.createElement('canvas');
cv.id='cmdMapCv';
// 画布自身尺寸由 cmdMapResize 按"居中正方形"写入 (width/height/left/top/transform 五件), 这里只给定位与光标。
// ★不要写 inset/width:100%/height:100% —— 那会让画布跟着舞台变成宽扁矩形, 方形地图只占中间一块 (见 cmdMapResize)。
cv.style.cssText='position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);cursor:crosshair;';
mc.appendChild(cv);
const bar=document.createElement('div');
bar.id='cmdMapBar';
bar.style.cssText='position:absolute;top:6px;left:50%;transform:translateX(-50%);font:13px/1.5 sans-serif;color:#e8eee0;text-shadow:0 1px 2px #000;background:rgba(0,0,0,.5);padding:3px 14px;border-radius:6px;pointer-events:none;white-space:nowrap;';
mc.appendChild(bar);
w.appendChild(mc);
const pnl=document.createElement('div');
pnl.id='cmdMapPanel';
pnl.style.cssText='width:250px;flex:none;display:flex;flex-direction:column;gap:6px;overflow-y:auto;padding:8px;font:12px/1.5 sans-serif;color:#dfe6d2;';
w.appendChild(pnl);
ui.appendChild(w);
cmdMapBind(cv,w);
return true;
}
function cmdMapBind(cv,w){
let drag=null;
cv.addEventListener('contextmenu',e=>{ e.preventDefault(); e.stopPropagation(); });
cv.addEventListener('mousedown',e=>{
// ★吞掉冒泡 (2026-10-26 修复): 19-input 的 mousedown 挂在 **window** 上且无条件执行
//   (mouseDown=true 开火 / mouse2Down+ads 机瞄 / 丢锁补锁) —— 指挥地图点选单位·拖拽平移·右键下令
//   每一次点击都会冒泡上去: 左键走火一发 + 触发 lockPointer 补锁 (把刚为点选释放的指针锁又抢回去,
//   十字准星瞬移 + 地图点一下就锁死鼠标), 右键下令同时进机瞄。地图内的操作必须由地图自己消费。
e.stopPropagation(); e.preventDefault();
if(CMD.mapOn&&CMD.mapDeploy&&typeof gamePaused!=='undefined'&&gamePaused) return;
const [wx,wz]=cmdMapToWorld(e);
CMD.cursor={x:wx,z:wz};
if(e.button===0){
// ── 左键 = 三档 (2026-10-26 交互重做批, 用户需求 3/4) ──
//   ①点到自己人 → 高亮选中它 (等于"滚轮切到这一项", 两种选人方式并存, 不互相排斥);
//   ②点到别处 → **集火** 该点附近 60m 内的己方火力 (用户需求 3 的原话: 左键点目标 → 附近火力集中打它)。
//     这条是地图上最高频的战术动作, 所以放在"没点到自己人"的默认档 —— 地图上绝大多数像素都是"别处"。
//   ③布势期 (人未落地) 不集火: 那时全场还没开打, 集火没有可打的敌人, 只保留选人。
//   旧写的"点目标模式下令第二步 (CMD.pick)"整条链随面板重做一起退场 —— 三命令键 (E/F/R) 直接以
//   光标位置为落点, 不再需要"先按按钮再点地图"的两步式。
const u=cmdMapHit(e);
if(u){ CMD.hl=u; CMD.sel=u; cmdMapDraw(); cmdMapPanelTick(); return; }
if(CMD.mapDeploy) return;
cmdFocusFire(wx,wz);
return;
}else if(e.button===2){
// ── 右键 = 退出指挥态 (战斗期) ──
// ★2026-10-26 反馈批 (用户需求 2): 布势期**取消右键退出** —— 旧写布势右键=cmdDeployConfirm(跳过布势),
//   手滑一下就把整套布势 (配比+初始令) 按默认提交了。布势的出口只剩「✚ 确认开战」按钮与 Esc
//   (19-input 同规); 触屏 tCmdMap 按钮的"开/关"语义另行保留 (它不是右键, 见 cmdMapToggle 注释)。
if(CMD.mapDeploy) return;
cmdMapToggle();
return;
}else if(e.button===1){
// ── 中键按住拖动 = 平移视图 (2026-10-27 排查批 修复"拖拽平移从未接线") ──
//   ①现象: 本文件多处注释宣称"拖拽平移"可用 (滚轮改切人时"缩放另有两条现成路径 (拖拽平移仍保留…)",
//     cmdMapOpen 的 _follow 复暖块也描述"拖拽 (mousedown 空白处) 把它置 false"), 但 mousedown 从未给
//     drag 赋过值 —— drag 只在 mousemove/mouseup 出现, 首帧 `if(!drag||!CMD.view) return;` 恒 bail:
//     平移整条链是死代码, CMD._follow 也从来没有任何交互路径置 false (只有布势入口置过)。战斗期
//     视图只能跟着玩家走, 滚轮又被改派成切人 ⇒ 玩家没有任何手段看一眼战线别处。
//   ②键位: 左键=集火 (最高频, 按下即触发不能挪用)、右键=关图、滚轮=切人 —— 唯一空闲的是中键。
//     中键按住拖动 = 平移, 与 19-input 的中键语义 (飞机锁定切换) 不冲突: 那条在指针锁内且本处理器
//     已 stopPropagation, 地图开着时根本到不了。布势期视图是整图钳中档 (cmdViewClamp hw>=MH 居中),
//     平移是几何 no-op, 不必分支。
//   ③_follow 置 false = 既有注释宣称的语义 ("拖拽后取消跟随"); 复位点只有开图 (cmdMapOpen)。
drag={x:e.clientX,y:e.clientY};
CMD._follow=false;
return;
}
});
addEventListener('mouseup',()=>{ drag=null; });
cv.addEventListener('mousemove',e=>{
// 光标世界坐标**每帧都记** (2026-10-26 交互重做批): E/F 的落点是光标位置而不是选中单位的位置 ——
// 用户需求原文 "E=把光标位置设为到此处防守的目标", 所以鼠标停在哪就必须知道哪。
if(CMD.view){ const w0=cmdMapToWorld(e); CMD.cursor={x:w0[0],z:w0[1]}; }
if(!drag||!CMD.view) return;
const k=cmdMapPxPerM();
CMD.view.cx-=(e.clientX-drag.x)/k;
CMD.view.cz-=(e.clientY-drag.y)/k;
drag={x:e.clientX,y:e.clientY};
cmdMapDraw();
});
// ★2026-10-26 交互重做批 (用户需求 4): 滚轮 = **切换高亮单位** (不再缩放)。
//   ①用户原话: "一次只高亮选中一个可指挥选项, 其余的在列表里隐藏/压缩, 用滚轮切换" —— 滚轮在这张图上
//     从"缩放视图"改成"换人", 因为"要操作谁"是比"看多大"高频得多的动作, 而缩放另有两条现成路径
//     (拖拽平移仍保留; 视图自动跟随玩家, 需要看全局时用布势的整图档)。
//   ②语义: 沿 cmdUnits() 的扁平顺序循环 (队 1 → 队 2 → … → 坦克 → 飞机 → 回队 1)。滚上=上一个, 滚下=下一个,
//     与列表视觉顺序一致 (列表也是这个顺序)。
//   ③切人不动视图: 高亮是"我要给谁下令", 视图是"我在看哪片地", 两件事各自独立。
//   ④吞掉冒泡: 与旧写同规, 滚轮不许漏进全局切枪/缩放管道。
cv.addEventListener('wheel',e=>{
e.preventDefault();
e.stopPropagation();
const dir=e.deltaY<0?-1:1;
cmdHlStep(dir);
cmdMapDraw();
cmdMapPanelTick();
},{passive:false});
}
// ── 高亮单位切换 (滚轮唯一入口; 用户需求 4) ──
// 循环顺序 = cmdUnits() 的扁平顺序 (与右侧列表逐行一致)。空编制/无单位时静默返回。
// 为什么不是"只在高亮项上滚": 指针位置与列表无关 (鼠标可能停在地图上任何地方), 滚轮必须**全局**生效 ——
//   否则玩家得先把鼠标精确移到那一条上才能切人, 与"滚轮切单位"的意图相反。
function cmdHlStep(dir){
const us=cmdUnits();
if(!us.length){ CMD.hl=null; return; }
let i=us.indexOf(CMD.hl);
if(i<0) i=(dir>0)?-1:0;                 // 没有高亮时: 滚下=从头, 滚上=从尾
i=(i+dir+us.length)%us.length;
CMD.hl=us[i];
CMD.sel=us[i];                          // 高亮 = 选中 (旧 sel 语义保留, 面板/选中环/右键快捷全部继续可用)
if(typeof AudioSys!=='undefined'&&AudioSys.click) AudioSys.click(1250,0.16,0.04);
}
function cmdMapCvEl(){ return document.getElementById('cmdMapCv'); }
// 元素矩形兜底 (沙箱/探针的 DOM 桩没有 getBoundingClientRect): 缺方法时按 800×600 全屏算
function cmdRect(el){
try{ if(el&&typeof el.getBoundingClientRect==='function'){ const r=el.getBoundingClientRect(); if(r&&r.width>0) return r; } }catch(e){}
return {left:0,top:0,width:800,height:600};
}
function cmdMapPxPerM(){
const cv=cmdMapCvEl();
if(!cv||!CMD.view) return 1;
return Math.max(0.05,CMD.view.scale*Math.min(cv.width,cv.height)/((typeof MAP_SIZE!=='undefined'?MAP_SIZE:320)/2+30));
}
// 整图适配缩放 (D8 "近全屏看懂全局"): 由 cmdMapPxPerM 的定义反解 ——
//   k = scale * min(W,H) / MH, 而世界半幅也是 MH ⇒ 屏幕半幅能装下的条件就是 scale <= 0.5。
//   取 0.46 留 8% 边距 (地图边缘的旗点数字/编队标签不被画布边框切掉)。
// ★2026-10-26 排查轮二审 修复 (布势"看全局"实为只看 55%): 旧写 cmdDeployOpen 里直接
//   CMD.view={cx:0,cz:0,scale:1} 并注释"布势看全局" —— 但 scale=1 时 320 图的世界半幅 190m
//   要 190*min(W,H)/190 = min(W,H) 像素, 而画布只有一半 ⇒ 只能看到地图中央约 55%,
//   四角出生区与外围旗点全在画外。布势阶段的第一件事就是"看清全图再布阵", 这是硬需求。
function cmdMapFitScale(){ return 0.46; }
function cmdMapToWorld(e){
const cv=cmdMapCvEl();
const r=cmdRect(cv);
const px=((e.clientX-r.left)/r.width)*cv.width;
const py=((e.clientY-r.top)/r.height)*cv.height;
if(!CMD.view) return [0,0];
const k=cmdMapPxPerM();
return [CMD.view.cx+(px-cv.width/2)/k, CMD.view.cz+(py-cv.height/2)/k];
}
function cmdMapToCv(x,z){
const cv=cmdMapCvEl();
if(!cv||!CMD.view) return [0,0];
const k=cmdMapPxPerM();
return [cv.width/2+(x-CMD.view.cx)*k, cv.height/2+(z-CMD.view.cz)*k];
}
// 屏幕坐标 → 命中的可指挥单位 (最近者, 16px 容差)。
// ★2026-10-26 交互重做批: 位置一律取 cmdUnitCenter —— 与队标绘制、选中环**同一份**坐标 (用户需求 2 的
//   根因就是这个函数用了 `alive` 全集而绘制用了 `alive&&!onVehicle`, 两条链的中心点不是同一个点)。
function cmdMapHit(e){
if(!CMD.orbat) return null;
const cv=cmdMapCvEl();
if(!cv) return null;
const r=cmdRect(cv);
const px=((e.clientX-r.left)/r.width)*cv.width;
const py=((e.clientY-r.top)/r.height)*cv.height;
let best=null,bd=16*16;
for(const u of cmdUnits()){
if(u.kind!=='inf'&&u.veh&&!u.veh.alive) continue;
const c=cmdUnitCenter(u);
if(!c) continue;
const [qx,qy]=cmdMapToCv(c.x,c.z);
const d=(qx-px)*(qx-px)+(qy-py)*(qy-py);
if(d<bd){ bd=d; best=u; }
}
return best;
}
// ── 三命令键的落点解析 (E/F/R 的唯一入口; 用户需求 4) ──
// 落点 = **光标位置** (CMD.cursor, 由 mousemove 实时记账), 不是高亮单位的位置 —— 用户原文
// "E = 把光标位置设为到此处防守的目标 / F = 把光标位置设为进攻此处或向此处投弹的目标"。
// 光标还没动过 (刚开图没移鼠标) 时退回视图中心: 那时"光标位置"在语义上就是屏幕中心, 与视图中心重合。
function cmdCursorPt(){
if(CMD.cursor) return CMD.cursor;
if(CMD.view) return {x:CMD.view.cx,z:CMD.view.cz};
return {x:0,z:0};
}
// 命令键总入口 (19-input 的 keydown 分流点调它; 返回 true = 已消费, 调用方不再走默认键义)。
//   hold → E · attack → F · free → R。没有高亮单位时先按"离光标最近的单位"兜底高亮, 免得玩家
//   开图后直接按 E 什么都不发生 (那会被读作"按键没接上")。
function cmdKeyCommand(kind){
if(!CMD.mapOn||!CMD.orbat) return false;
if(!CMD.hl){ cmdHlNearest(); if(!CMD.hl) return true; }
const u=CMD.hl;
if(kind==='free'){
cmdOrderUnit(u,'free');
cmdMapAnnounce(u,'free');
} else if(kind==='hold'){
const p=cmdCursorPt();
if(!cmdOrderUnit(u,'hold',p.x,p.z)){ cmdMapAnnounceFail(u,'hold'); return true; }
cmdMapAnnounce(u,'hold');
} else if(kind==='attack'){
const p=cmdCursorPt();
const mode=(u.kind==='plane')?'strike':'attack_move';
if(!cmdOrderUnit(u,mode,p.x,p.z)){ cmdMapAnnounceFail(u,mode); return true; }
cmdMapAnnounce(u,mode);
} else return false;
cmdMapDraw();
cmdMapPanelTick();
return true;
}
// 没有高亮时按"离光标最近"兜底 (距离不限: 指挥图是全局视野, 玩家按 E 的意图一定是"我刚在看的那一片")。
function cmdHlNearest(){
const us=cmdUnits();
if(!us.length){ CMD.hl=null; return; }
const p=cmdCursorPt();
let best=null,bd=1e18;
for(const u of us){
if(u.kind!=='inf'&&u.veh&&!u.veh.alive) continue;
const c=cmdUnitCenter(u);
if(!c) continue;
const d=(c.x-p.x)*(c.x-p.x)+(c.z-p.z)*(c.z-p.z);
if(d<bd){ bd=d; best=u; }
}
CMD.hl=best; CMD.sel=best;
}
// 命令反馈播报 (单源: 名字走 cmdUnitName, 词汇文案只在这里定义一次)
function cmdMapAnnounce(u,mode){
if(typeof showScorePop!=='function') return;
const verb=(mode==='free')?t2('自由推进'):((mode==='hold')?t2('防守此点'):((mode==='strike')?t2('投弹此点'):t2('进攻此点')));
showScorePop(t2('命令: {0} → {1}',t2(cmdUnitName(u)),verb));
}
function cmdMapAnnounceFail(u,mode){
if(typeof showScorePop!=='function') return;
if(mode==='hold') showScorePop(t2('命令: {0} → {1}',t2(cmdUnitName(u)),t2('此兵种不支持防守指令')));
else if(mode==='strike'||mode==='attack_move') showScorePop(t2('命令: {0} → {1}',t2(cmdUnitName(u)),t2('此兵种不支持该指令')));
}
// ── 集火 (用户需求 3: 左键点目标 → 附近己方火力集中打它) ──
// 口径: 以集火点为圆心、半径 CMD_FIRE.R 内的**己方**战斗单位 (步兵 Bot / 坦克车组 / 飞机) 全部改为优先打
// 该点附近的敌人, 持续 CMD_FIRE.DUR 秒。实现走**既有命令系统**: 集火不是第五种命令词汇, 而是给半径内
// 每个单位挂一个"临时优先目标点" (unit.focus), 由 14-bots / 15-vehicles / 16-aircraft 的既有选目标
// 代码把 focus 点附近的敌人排在前面 —— 这样"集火"与"自由推进/进攻/防守"不冲突, 也不会多出一套状态机。
// 到期自动失效 (读 CMD.focusFire.until), 玩家点别处 = 覆盖, 无需手动取消。
function cmdFocusFire(x,z){
if(!cmdIsCommander()) return;
CMD.focusFire={x:+x,z:+z,t0:(typeof nowT==='number'?nowT:0),until:(typeof nowT==='number'?nowT:0)+CMD_FIRE.DUR};
CMD.hl=null; CMD.sel=null;                     // 集火是"对一片区域下令", 不针对某个单位 → 清掉高亮
// 广播: 半径内己方单位记下 focus 点 (消费点见 cmdFocusTarget)
let n=0;
for(const u of cmdUnits()){
if(u.kind!=='inf'&&u.veh&&!u.veh.alive) continue;
const c=cmdUnitCenter(u);
if(!c) continue;
const d=Math.hypot(c.x-x,c.z-z);
if(d>CMD_FIRE.R) continue;
u.focus={x:+x,z:+z,until:CMD.focusFire.until};
n++;
// 飞机: 集火对它是"去投弹" (16-aircraft 只认 strikePt, 不认地面集火分数) —— 只在它当前无令且还有弹时
// 才接管, 免得把玩家刚下的投弹点顶掉。这条判断不引入新状态: 复用既有 strike 令与 _cmdOrderClear 语义。
if(u.kind==='plane'&&u.veh&&u.veh.alive&&u.order.mode==='free'&&(u.veh.bombs||0)>0){
cmdOrderUnit(u,'strike',x,z);
}
}
if(typeof showScorePop==='function'){
showScorePop(n?t2('集火: {0} 个单位 → 该点',n):t2('集火: 半径内没有己方单位'));
}
if(typeof AudioSys!=='undefined'&&AudioSys.click){ AudioSys.click(1600,0.3,0.05); AudioSys.click(900,0.25,0.07); }
cmdMapDraw();
cmdMapPanelTick();
}
// 集火消费接口 (14-bots perceive / 15-vehicles tankPerceive / 16-aircraft 用):
// 返回该单位当前有效的集火点 {x,z} (过期/无令/该单位不在半径内 = null)。判据只在这里写一次 ——
// 三个消费点都不许自己再算"集火还剩几秒 / 我在不在半径里"。
function cmdFocusOf(unit){
if(!unit||!unit.focus) return null;
const t=(typeof nowT==='number')?nowT:0;
if(t>unit.focus.until){ unit.focus=null; return null; }
return unit.focus;
}
// 载具 → 所属指挥单位 (15-vehicles 的车组集火取令用)。编制挂对象 (unit.veh === 载具), 因此按对象反查;
// 无编制/未开指挥图 (CMD.orbat 为空) 返回 null ⇒ 消费方拿到 0 分, 行为逐位不变。
function cmdFindUnitOfVeh(v){
if(!v||!CMD.orbat) return null;
for(const t of CMD.orbat.tanks) if(t.veh===v) return t;
for(const p of CMD.orbat.planes) if(p.veh===v) return p;
return null;
}
// 集火候选排序加分: 给定候选目标坐标, 返回应加的分数 (离集火点越近越高; 无集火 = 0 零回归)。
// 单源给三条 AI 用 —— 半径内一律 +BIG (相当于"这就是我要的目标"), 半径外按距离线性衰减到 0。
const CMD_FOCUS_SCORE_R=45;   // 集火"命中圈"半径 (m): 圈内目标直接顶到最前
function cmdFocusBonus(unit,x,z){
const f=cmdFocusOf(unit);
if(!f) return 0;
const d=Math.hypot(x-f.x,z-f.z);
if(d<=CMD_FOCUS_SCORE_R) return 1e6;                 // 圈内: 无条件优先
if(d>=CMD_FOCUS_SCORE_R*3) return 0;                 // 圈外 3 倍半径: 无感
return 1e5*(1-(d-CMD_FOCUS_SCORE_R)/(CMD_FOCUS_SCORE_R*2));
}
// ── R12 敌显单源断言口径: 与小地图/大地图同一条管线 ──
// ★2026-10-26 排查轮二审 修复 (R12 "完全复用单源"实为**两套判据**, 夜间/暴雨档两图读数不一致):
//   ①现象: 夜里敌人朝你开了一枪 (小地图立刻亮出他的红点), 打开指挥地图却看不见他 —— 同一时刻同一敌人,
//     小地图显示、指挥地图不显示; 暴雨档更明显 (小地图近显 90m, 指挥地图只有 54m 的雾圈)。
//   ②根因: 旧写是**自己重算**的一套判据 (只取 getMapVisDist 视野圆), 完全没读 mmEnemyVis —— 而
//     "近距离常显半径 WX_MM_NEAR + 开火后 WX_MM_FIRE 秒内显形"这条夜/雨规只写在 mmEnemyVis 里
//     (00-config:1356 的合成单源)。设计 R12 原文要求 "mmEnemyVis 判据 + 全图开关 + 视野圆蒙版",
//     旧写只落实了后两项 ⇒ "单源"宣称不成立。
//   ③现在: 点判据**全权委托** mmEnemyVis(第三个参数吃实体开火时间戳), 本图只负责画法 ——
//     远处压暗交给同款视野圆蒙版 (见 cmdMapDraw 的 "R12 视野圆蒙版" 段, 与小地图第 2 层同一画法)。
//     于是"小地图显示什么, 指挥地图就显示什么"成为逐点可对账的事实, 而不是注释里的口号。
//   mmEnemyVis 缺失时 (只加载 26-commander 的极端沙箱) 退回旧口径, 保证不炸。
function cmdMapDotVis(x,z,lastFire){
// 判据**全权委托** mmEnemyVis —— 这是设计 R12「完全复用小地图敌显管线单源」的字面落实:
//   · 白天晴档 WX_MM_NEAR=0 ⇒ 恒 true (2026-09-06 全显裁定, 零回归)
//   · 夜间 60m / 暴雨暴雪 90m 近距常显 (WX_MM_NEAR, 00-config 合成单源)
//   · 开火暴露: nowT-lastFire < WX_MM_FIRE (2.5s) 即显形 —— lastFire 由调用点按实体类型取
//   · MAP_ALL_INTEL 全图开关 / 观战 / 死亡旁路全显 —— 也都在 mmEnemyVis 内部
if(typeof mmEnemyVis==='function') return mmEnemyVis(x,z,lastFire);
// 退化口径 (只装配 26-commander 的极端沙箱, 22-hud 未加载): 按白天全显处理, 不静默隐藏任何东西。
return true;
}
// ── 底图烘焙 (R6: 开局烘焙一次; D19: 废墟补丁单点重画) ──
// ★2026-10-26 排查轮三审 修复 (开图/进布势当帧整帧僵住 0.1~0.7s, 且**只在部分地图**发作):
//   ①现象: 点指挥官卡进布势、或右键开指挥地图, 画面僵住一下再跳出来 (不是"慢慢画出来")。
//     沙箱实测 (node/V8, 与浏览器同引擎) 单次同步烘焙: 诺曼底 105ms / 斯大林格勒 135ms /
//     塔拉瓦 271ms / 库尔斯克 473ms / 滇缅 695ms / 百团黄土 733ms —— 同一段代码在 15 张图差 7 倍。
//   ②上一轮的修法及为什么不够: 上一轮把采样步进 4px→6px, 卡顿相对 4px 的 562ms 降到 1/7。
//     但步进是**除法**, 而根因是**每张图 heightAt 的单点价格差 13 倍**: 实测 (µs/次)
//     诺曼底 2.5 / 草原 4.2 / 百团黄土 33.8 —— 差距全在 rawHeight 的特征数上 (黄土: 5 条沟壑折线
//     + 10 条坡道 + 2 塬面 + 3 峁 + 2 渡台, 每个采样点都要逐段算距离并 smoothstep)。
//     于是"6px 够用"只对诺曼底成立, 对黄土仍是 0.48s 整帧僵死。
//     **任何固定步进都治不了这个病** —— 它不是采样密度问题, 是"单帧干完全部活"的时序问题。
//   ③现在的口径 (预算式增量烘焙): 把烘焙拆成**可续算的作业** (CMD._bj), 每帧只推进
//     CMD_BAKE_BUDGET_MS 毫秒, 推到哪记在哪; 地形色带逐行推进, 道路/建筑/废墟钩子在这些行跑完后
//     一次性收尾。于是**单帧上限与地图无关** (105ms 的图与 733ms 的图, 单帧都不超过一个预算),
//     玩家看到的是底图在 0.2~1s 内逐渐画出来, 而不是整帧僵住。
//     视觉产物与旧写**逐像素一致**: 步进仍是 6px, 色带判据/道路/建筑画法一个字没改,
//     变的只是"什么时候画完", 不是"画成什么样"。
//   ④预热: cmdFrameTick 每帧也推进一步 (地图没开也推) ⇒ 从 startMatch 到玩家点卡进布势之间的
//     那段部署页时间就足以烘完, 多数玩家根本不会看到"生成中"。
//   ⑤为什么不是"降采样 + 模糊放大": 那会改掉视觉产物 (海岸线/沟壑边缘被插值糊掉), 属于未经
//     用户裁定的视觉回归。本修复只动时序, 不动画面。
const CMD_BAKE_BUDGET_MS=8;   // 每帧烘焙预算 (ms)。单源: 想更顺滑就调小, 想更快画完就调大
function cmdBakeNeeded(){ return !CMD.bake; }
// 作业在跑但底图还没就位 (= 该画"生成中"占位, 而不是当成"没开图")
function cmdBakeBusy(){ return !CMD.bake&&!!CMD._bj; }
function cmdBakeBegin(){
if(CMD.bake||CMD._bj) return;
const S=880, half=S/2;
const cv=document.createElement('canvas'); cv.width=S; cv.height=S;
const c=(cv.getContext&&cv.getContext('2d'))||null;
if(!c){ CMD.bake={cv,S:1,half:0}; return; }   // 沙箱/探针 DOM 桩没有 2d 上下文: 记空底图桩, 不炸
const MH=(typeof MAP_SIZE!=='undefined'?MAP_SIZE:320)/2+30;
CMD._bj={cv,c,S,half,MH,py:0,step:6,phase:0};
}
// 推进烘焙作业; budgetMs<=0 = 一次跑完 (探针/极端沙箱/兜底)。返回 true = 底图已可用 (CMD.bake 就位)。
function cmdBakeAdvance(budgetMs){
const j=CMD._bj;
if(!j) return !!CMD.bake;
const unlimited=!(budgetMs>0);
const hasT=(typeof performance!=='undefined'&&performance&&typeof performance.now==='function');
const t0=hasT?performance.now():0;
const MH=j.MH, S=j.S, half=j.half, step=j.step, c=j.c;
// 阶段 0: 地形色带逐行推进 (唯一可续算的部分 —— j.py 是续算游标)
if(j.phase===0){
while(j.py<S){
const py=j.py;
for(let px=0;px<S;px+=step){
const x=(px-half)/half*MH, z=(py-half)/half*MH;
const wy=(typeof waterYAt==='function')?waterYAt(x,z):-1e8;
const gy=(typeof heightAt==='function')?heightAt(x,z):0;
let col;
if(wy>-1e8&&wy>gy+0.05){ col=gy<wy-3?'#1d3a52':(gy<wy-1?'#2a5570':'#3f7285'); }
else if(gy>34) col='#8d9490';
else if(gy>20) col='#5d6b4c';
else if(gy>8)  col='#55663f';
else           col='#4c5e3a';
c.fillStyle=col; c.fillRect(px,py,step,step);
}
j.py=py+step;
if(!unlimited&&hasT&&(performance.now()-t0)>=budgetMs) return false;   // 预算用完: 下帧从这里续
}
j.phase=1;
}
// 阶段 1: 既有单源底图素 (与部署图/大地图同一族函数) + 建筑 footprint —— 行已跑完, 一次性收尾
if(j.phase===1){
const toM=(x,z)=>[half+x/MH*half, half+z/MH*half];
if(typeof drawBaseMapBigMap==='function'){ try{ drawBaseMapBigMap(toM,c,MH,S); }catch(e){} }
// 建筑 footprint: BOXES 里"高>=1.5m 且有模型"的件; 可破坏组 (b.dGroup) 暖棕 / 永久件灰。
// 已死组 = 废墟色 (世界构建期预塌的"历史废墟"直接按死画)。
if(typeof BOXES!=='undefined'){
for(const b of BOXES){
if(!b||!b.mesh) continue;
if((b.maxY-(b.gh||0))<1.5) continue;
const [ax,ay]=toM(b.minX,b.minZ);
const w=(b.maxX-b.minX)/MH*half, h=(b.maxZ-b.minZ)/MH*half;
c.fillStyle=(b.dGroup&&b.dGroup.dead)?'#3a342c':(b.dGroup?'#6e5a3a':'#565a58');
c.fillRect(ax,ay,Math.max(w,1.2),Math.max(h,1.2));
}
}
CMD.bake={cv:j.cv,S,half};   // 底图自此刻起可用 (cmdBakeNeeded 转 false)
j.phase=2;
}
// 阶段 2: D19 废墟补丁回调 (幂等: g._cmdHook 记账, 换局重烘不会重复套壳)
if(j.phase===2){
if(typeof DESTRUCTIBLES!=='undefined'){
for(const g of DESTRUCTIBLES){
if(!g||g._cmdHook) continue;
g._cmdHook=true;
const prev=g.onDead;
g.onDead=(gg)=>{ try{ cmdMarkRubble(gg); }catch(e){} if(prev) prev(gg); };
}
}
CMD._bj=null;
}
return !!CMD.bake;
}
// 同步整烘 (保名保签名: 探针/极端沙箱/首次开图的兜底路径)。游戏主循环走 cmdBakeAdvance 的预算路径。
function cmdBake(){
cmdBakeBegin();
cmdBakeAdvance(0);
}
// D19: 单点重画废墟色块 (组心 ± 估算半径), 不做全图重烘焙
function cmdMarkRubble(g){
if(!CMD.bake||!g||!CMD.bake.half) return;
const c=(CMD.bake.cv.getContext&&CMD.bake.cv.getContext('2d'))||null;
if(!c) return;
const MH=(typeof MAP_SIZE!=='undefined'?MAP_SIZE:320)/2+30;
const half=CMD.bake.half;
const toM=(x,z)=>[half+x/MH*half, half+z/MH*half];
let r=2.5;
try{ if(g.meshes&&g.meshes.length) r=Math.max(2.5,Math.sqrt(g.meshes.length)*1.6); }catch(e){}
const [px,py]=toM(g.cx,g.cz);
c.fillStyle='#3a342c';
c.beginPath(); c.arc(px,py,r/MH*half,0,Math.PI*2); c.fill();
}
// 画布尺寸 (2026-10-26 交互重做批 修复"方形地图只占 59% 画布宽"):
//   ①现象: 地图是正方形的 (世界半幅 = MAP_SIZE/2+30 两轴相同), 而舞台是宽扁的 (整幅宽 × 整幅高),
//     适配缩放按 min(W,H) 算 ⇒ 方形地图只能撑满高度, 左右各留一大片空黑; 实测 933×594 的舞台里
//     地图只占 546×546 = 58% 的宽度, 右侧面板又占掉 250px, 于是"看全局"变成看一小块。
//   ②口径: 把**画布本身**改成居中的正方形 (边长 = min(舞台宽, 舞台高)), 舞台剩余宽度自然成为左右留白。
//     于是 min(W,H) === 边长, 地图正好铺满画布, 不需要再动 cmdMapPxPerM 的公式 (一处改动, 全链同源)。
//   ③为什么不改成"非等比拉伸": 会破坏 cmdMapToCv/cmdMapToWorld 的往返一致性 (两轴比例不同 ⇒
//     点选命中与绘制错位), 那正是用户报的"位置偏差"的同类问题, 不能为了填满画布引入。
function cmdMapResize(){
const cv=cmdMapCvEl();
if(!cv) return;
const r=cmdRect(cv&&cv.parentElement);
const side=Math.max(200,Math.round(Math.min(r.width,r.height)));
if(cv.width!==side||cv.height!==side){ cv.width=side; cv.height=side; }
// CSS 尺寸同步 (绝对定位居中): 只写变化的值, 稳态零 DOM 写入 (本仓 HUD 对账纪律)
const cssW=side+'px';
if(cv.style){
if(cv.style.width!==cssW) cv.style.width=cssW;
if(cv.style.height!==cssW) cv.style.height=cssW;
if(cv.style.left!=='50%') cv.style.left='50%';
if(cv.style.top!=='50%') cv.style.top='50%';
if(cv.style.transform!=='translate(-50%,-50%)') cv.style.transform='translate(-50%,-50%)';
}
}
// 视图世界边界钳制 (2026-10-26 反馈批, 用户需求 6「战斗内开图随机缺右边的一块」的病根):
//   战斗版 scale=1 时窗口半宽 = (S/2)/k = MH/2 米 —— 视图跟着玩家走, 玩家靠近地图东/西边缘时窗口
//   探出世界边界, 探出的那一条是底图烘焙范围 [-MH,+MH] 之外的地方, 只有近黑底色 ⇒ 玩家读作
//   "缺了一块"; 玩家一跑动它时有时无 ⇒ "随机"。钳制口径: 窗口不大于世界时视图中心钳在 ±(MH-半窗),
//   窗口盖满世界 (布势 0.46 档, 半窗≈2.17·MH) 时居中 —— 两条都保证画布每一像素都落在底图内,
//   "缺块"在几何上不再可能。随动/拖拽/开图三条改视图的路径都汇到 cmdMapDraw, 钳在这里 = 单点收口。
function cmdViewClamp(S,k){
if(!CMD.view) return;
const MH=(typeof MAP_SIZE!=='undefined'?MAP_SIZE:320)/2+30;
const hw=(S/2)/Math.max(1e-4,k);
if(hw>=MH){ CMD.view.cx=0; CMD.view.cz=0; return; }
const lim=MH-hw;
CMD.view.cx=Math.max(-lim,Math.min(lim,CMD.view.cx));
CMD.view.cz=Math.max(-lim,Math.min(lim,CMD.view.cz));
}
// 每帧 tick (24-main 末段, 真实帧长): 布势期也要画 (冻结的是世界, UI 实时)
function cmdMapTick(rdt){
// D20 暂停优先对账放最前 (并且要在 !CMD.mapOn 早退**之前**跑一次): 暂停期间 cmdFrameTick 整个被
// 24-main 的冻结分支跳过, 解冻当帧由这里把地图放回来 —— 若放在早退之后, "暂停中被 cmdMapMustClose
// 强关"这条路会留下一个永远 hidden 的地图与 CMD.mapOn=true 的自相矛盾状态。
cmdMapPauseGate();
if(!CMD.mapOn) return;
cmdMapResize();
if(CMD._follow&&typeof player!=='undefined'&&player.alive&&CMD.view){
CMD.view.cx=player.pos.x; CMD.view.cz=player.pos.z;
}
cmdMapDraw();
cmdMapPanelTick();
}
function cmdMapDraw(){
const cv=cmdMapCvEl();
if(!cv) return;
const c=(cv.getContext&&cv.getContext('2d'))||null;
if(!c){   // 沙箱/探针 DOM 桩没有 2d 上下文: 逻辑层照常可测, 只把底图桩同步落好再退出
if(cmdBakeNeeded()){ try{ cmdBake(); }catch(e){ CMD.bake={cv:document.createElement('canvas'),S:1,half:0}; CMD.bake.cv.width=1; CMD.bake.cv.height=1; } }
return;
}
c.globalAlpha=1;   // ★跨帧画笔状态自愈 (2026-10-26 反馈批): 上一帧任何残留 alpha 都不许污染本帧底图/蒙版/旗点
// 底图来源: ①已就位 → 直接贴; ②作业在跑 → 画"生成中"占位, 由 cmdFrameTick 的预算下一帧续算;
//   ③两者都没有 → 起作业 (当帧也走占位, 绝不整帧僵住)。
// ★2026-10-26 排查轮三审 修复 (开图/进布势当帧整帧僵住 0.1~0.7s): 旧写在这里 `if(cmdBakeNeeded())
//   cmdBake();` —— 在**渲染帧内同步**把 21609 个采样点跑完 (黄土图实测 0.48s, 滇缅 0.7s)。
//   现在渲染帧只起作业/贴现成底图, 真正的采样由 cmdFrameTick 按 CMD_BAKE_BUDGET_MS 预算**分帧**推进
//   (见 cmdBakeAdvance 说明块: 视觉产物逐像素不变, 变的只是"什么时候画完")。
if(cmdBakeNeeded()&&!CMD._bj){
try{ cmdBakeBegin(); }catch(e){ CMD.bake={cv:document.createElement('canvas'),S:1,half:0}; CMD.bake.cv.width=1; CMD.bake.cv.height=1; }
}
if(!CMD.view) CMD.view={cx:player.pos.x||0,cz:player.pos.z||0,scale:1};
const S=cv.width,H=cv.height;
const k=cmdMapPxPerM();
cmdViewClamp(S,k);   // 视图世界边界钳制 (用户需求 6「随机缺右边的一块」的病根, 见函数说明块)
c.clearRect(0,0,S,H);
c.fillStyle='#10150c'; c.fillRect(0,0,S,H);
// 底图 (含烘焙期画好的路/河/建筑 footprint), 按视图变换贴图; 空底图桩 (无 2d 上下文环境) 画纯色底
const MH=(typeof MAP_SIZE!=='undefined'?MAP_SIZE:320)/2+30;
if(CMD.bake&&CMD.bake.half){   // ★2026-10-26 三审: 必须带 CMD.bake 存在性判断 —— 预算式烘焙期间 bake 仍是 null (作业在 CMD._bj), 裸读 .half 直接抛 (探针⑦当场抓到)
const bakeScale=k/(CMD.bake.half/MH);
c.save();
c.translate(S/2,H/2);
c.scale(bakeScale,bakeScale);
c.translate(-(CMD.bake.half+ (CMD.view.cx/MH*CMD.bake.half)), -(CMD.bake.half+(CMD.view.cz/MH*CMD.bake.half)));
c.imageSmoothingEnabled=true;
c.drawImage(CMD.bake.cv,0,0);
c.restore();
}else if(cmdBakeBusy()){
// 底图生成中 (预算式烘焙还没跑完): 画同色调底 + 进度条, 让"正在生成"这件事对玩家可见,
// 而不是一片纯黑让人以为卡了。进度按已推进的行数算 (j.py/S), 与真实剩余量成正比。
c.fillStyle='#2c3520'; c.fillRect(0,0,S,H);
const jb=CMD._bj;
const pr=jb&&jb.S?Math.max(0,Math.min(1,jb.py/jb.S)):0;
c.fillStyle='#8fa06a'; c.fillRect(0,H-6,Math.max(2,S*pr),6);
c.fillStyle='rgba(230,240,210,.85)'; c.font='bold 14px sans-serif'; c.textAlign='center';
c.fillText((typeof t2==='function'?t2('底图生成中…'):'底图生成中…'),S/2,26);
}else{ c.fillStyle='#2c3520'; c.fillRect(0,0,S,H); }
// 视野圆蒙版 (R12: 与小地图同款渐变, 圆心=玩家; 全图开关/观战/死亡旁路全显)
if(!((typeof MAP_ALL_INTEL!=='undefined'&&MAP_ALL_INTEL)||player.spectator||!player.alive)){
const vd=(typeof getMapVisDist==='function')?getMapVisDist():9999;
const rPx=vd*k;
const [ppx,ppy]=cmdMapToCv(player.pos.x,player.pos.z);
if(rPx<Math.max(S,H)*1.2){
const g2=c.createRadialGradient(ppx,ppy,Math.max(0,rPx*0.72),ppx,ppy,Math.max(rPx,12));
g2.addColorStop(0,'rgba(12,16,9,0)');
g2.addColorStop(0.85,'rgba(12,16,9,0.7)');
g2.addColorStop(1,'rgba(12,16,9,0.98)');
c.fillStyle=g2; c.fillRect(0,0,S,H);
}
}
// 旗点 (占领态着色+争夺进度弧, 与小地图同款色板)
if(typeof FLAGS!=='undefined'){
for(const f of FLAGS){
const [px,py]=cmdMapToCv(f.x,f.z);
c.beginPath(); c.arc(px,py,11,0,Math.PI*2);
c.fillStyle=f.owner===0?'rgba(90,140,220,.8)':f.owner===1?'rgba(220,110,90,.8)':f.owner===2?'rgba(120,185,140,.85)':'rgba(160,160,150,.65)';
c.fill();
if(f.capTeam!==-1&&f.cap>0.03){
c.beginPath(); c.arc(px,py,13,-Math.PI/2,-Math.PI/2+f.cap*Math.PI*2);
c.strokeStyle=f.capTeam===2?'#b4e8b8':'#fff'; c.lineWidth=2; c.stroke();
}
c.fillStyle='#fff'; c.font='bold 11px sans-serif'; c.textAlign='center';
c.fillText(f.id,px,py+4);
}
}
// 己方单位 (2026-10-26 反馈批 重写, 用户需求 7 + 6):
//  · 用户需求 7: **选中的唯一高亮** (队色全亮 + 既有白环/四角准星), 其余一律**厚灰** —— 灰色垫层 +
//    灰色本体, 队色只留给选中的那个 (队色索引在右侧列表仍在)。旧写"其余 55% 透明"在深色底图上
//    读作"若隐若现", 不是用户要的"厚灰"。
//  · 用户需求 6 (变明变暗) 的病根之一: 旧写用 c.globalAlpha 做"其余压暗", 而 tank/plane 分支的
//    continue (车没了/飞机坠毁) 会**跳过循环尾部的 alpha 复位** —— 尾单位的残窗 alpha 一路泄漏到
//    本帧的敌军/选中环/玩家箭头, 还跨帧污染下一帧的底图/蒙版/旗点 (整图忽明忽暗, 与飞机坠毁同
//    步, 所以"原因不明")。现在彻底不用 globalAlpha 做压暗: 灰色直接走 fillStyle, 画笔 alpha 恒 1;
//    循环出口再兜一道复位。continue 全部在任何绘图之前, 无状态可漏。
if(CMD.orbat){
for(const u of cmdUnits()){
const hl=(CMD.hl===u);
const col=hl?cmdUnitColor(u):'#8f948b';           // 未选中 = 厚灰 (用户需求 7)
if(u.kind==='inf'){
const sh=cmdSquadShown(u);
for(const b of sh){
const [px,py]=cmdMapToCv(b.pos.x,b.pos.z);
if(!hl){ c.fillStyle='rgba(140,146,138,.38)'; c.beginPath(); c.arc(px,py,6,0,Math.PI*2); c.fill(); }   // 厚灰垫层
c.fillStyle=col; c.beginPath(); c.arc(px,py,hl?3.5:3,0,Math.PI*2); c.fill();
}
const ctr=cmdUnitCenter(u);
if(ctr){
const [px,py]=cmdMapToCv(ctr.x,ctr.z);
c.font=hl?'bold 14px sans-serif':'bold 12px sans-serif'; c.textAlign='center';
c.strokeStyle='rgba(0,0,0,.85)'; c.lineWidth=hl?4:3;
c.strokeText(CMD_SQUAD_NAMES[u.id%CMD_SQUAD_NAMES.length],px,py-8);
c.fillStyle=hl?cmdUnitColor(u):'#a9aea5';
c.fillText(CMD_SQUAD_NAMES[u.id%CMD_SQUAD_NAMES.length],px,py-8);
}
cmdDrawOrderLine(c,u.order,col);
} else if(u.kind==='tank'){
const v=u.veh;
if(!v) continue;
const [px,py]=cmdMapToCv(v.pos.x,v.pos.z);
const dead=!v.alive;
if(!hl&&!dead){ c.fillStyle='rgba(140,146,138,.30)'; c.fillRect(px-8,py-8,16,16); }   // 厚灰垫层
c.fillStyle=dead?'rgba(120,120,118,.5)':col;
c.fillRect(px-(hl?6:5),py-(hl?6:5),hl?12:10,hl?12:10);
if(dead&&v.respawnT>0&&typeof tickets!=='undefined'&&tickets[v.team]>0){
c.fillStyle='#cfd4c8'; c.font='9px sans-serif'; c.textAlign='center';
c.fillText(Math.ceil(v.respawnT/(v.kind==='tank'&&typeof tankRespawnMul==='function'?tankRespawnMul(v.team):1))+'s',px,py-9);
}
if(!dead) cmdDrawOrderLine(c,u.order,col);
} else {
const v=u.veh;
if(!v||!v.alive) continue;
const [px,py]=cmdMapToCv(v.pos.x,v.pos.z);
if(!hl){ c.fillStyle='rgba(140,146,138,.30)'; c.beginPath(); c.arc(px,py,9,0,Math.PI*2); c.fill(); }   // 厚灰垫层
c.save(); c.translate(px,py); c.rotate(Math.PI-(v.yaw||0));
c.fillStyle=col;
const s0=hl?7:6;
c.beginPath(); c.moveTo(0,-s0); c.lineTo(s0*0.75,s0*0.83); c.lineTo(0,s0*0.42); c.lineTo(-s0*0.75,s0*0.83); c.closePath(); c.fill();
c.restore();
cmdDrawOrderLine(c,u.order,col);
}
}
c.globalAlpha=1;   // ★循环出口复位 (双保险): 上游任何残留都不许带进集火/敌军/选中环/指针段 (if(CMD.orbat) 仍开着, 集火块在它里面)
// 集火标记 (用户需求 3): 红色脉冲圈 + 十字 + 剩余秒数, 让"我已经让全队打这里"可见
// ★2026-10-27 排查批 修复: 旧写只画不清 —— CMD.focusFire 过期后 (until 已过) 红圈与"集火 0s"倒计时
//   永远挂在图上, 直到玩家再点一次别处/换局才消失 (各 unit.focus 由 cmdFocusOf 自行过期, 本账无人收)。
//   过期当帧即清账 (与 cmdFocusOf 的"过期即 null"同一口径), 到点自然收场。
if(CMD.focusFire){
const f=CMD.focusFire;
const t=(typeof nowT==='number')?nowT:0;
if(t>=f.until){ CMD.focusFire=null; }
else{
const [fx,fy]=cmdMapToCv(f.x,f.z);
const left=Math.max(0,f.until-t);
const pulse=0.5+0.5*Math.sin(t*6);
c.strokeStyle='rgba(255,80,64,'+(0.55+0.4*pulse)+')'; c.lineWidth=2;
c.beginPath(); c.arc(fx,fy,10+3*pulse,0,Math.PI*2); c.stroke();
c.setLineDash([5,4]);
c.beginPath(); c.arc(fx,fy,CMD_FIRE.R*k,0,Math.PI*2); c.stroke();
c.setLineDash([]);
c.beginPath(); c.moveTo(fx-7,fy); c.lineTo(fx+7,fy); c.moveTo(fx,fy-7); c.lineTo(fx,fy+7); c.stroke();
c.fillStyle='#ffb0a0'; c.font='bold 11px sans-serif'; c.textAlign='center';
c.fillText(t2('集火')+' '+Math.ceil(left)+'s',fx,fy-14);
}
}
}
// 敌军 (R12 单源逐点过滤; 载具按形状)
// ★2026-10-26 排查轮二审 修复: 三个调用点都要**带上实体的开火时间戳** —— mmEnemyVis 的第三参数是
//   "开火后 mapFireT 秒内显形"的唯一输入, 旧写这里全都不传 (undefined) ⇒ 即使点判据委托给了
//   mmEnemyVis, 夜间/暴雨档也永远只能靠"近距常显半径"看见敌人, 开火暴露这条规则在指挥地图上等于没有。
//   时间戳取值与小地图/大地图**逐点同源** (22-hud drawMinimap/drawBigMap 的同名循环):
//   步兵 s.lastFiredT / 坦克 t.crew.lastFiredT / 飞机 max(crew,crewBot) —— 射手可能是机组 Bot 也可能是 crew 记账体。
if(typeof soldiers!=='undefined'){
for(const s of soldiers){
if(!s||!s.alive||s.onVehicle||s.zombie) continue;
if(s.team===player.team) continue;
if(!cmdMapDotVis(s.pos.x,s.pos.z,s.lastFiredT)) continue;
const [px,py]=cmdMapToCv(s.pos.x,s.pos.z);
c.fillStyle=CMD_ENEMY_COL; c.beginPath(); c.arc(px,py,3,0,Math.PI*2); c.fill();
}
}
if(typeof tanks!=='undefined') for(const t of tanks){
if(!t||!t.alive||t.team===player.team) continue;
if(!cmdMapDotVis(t.pos.x,t.pos.z,t.crew&&t.crew.lastFiredT)) continue;
const [px,py]=cmdMapToCv(t.pos.x,t.pos.z);
c.fillStyle=CMD_ENEMY_COL; c.fillRect(px-4.5,py-4.5,9,9);
}
if(typeof planes!=='undefined') for(const pl of planes){
if(!pl||!pl.alive||pl.team===player.team) continue;
if(!cmdMapDotVis(pl.pos.x,pl.pos.z,Math.max(pl.crew?pl.crew.lastFiredT:-99,pl.crewBot?pl.crewBot.lastFiredT:-99))) continue;
const [px,py]=cmdMapToCv(pl.pos.x,pl.pos.z);
c.fillStyle=CMD_ENEMY_COL;
c.beginPath(); c.moveTo(px,py-5); c.lineTo(px+4,py+4); c.lineTo(px-4,py+4); c.closePath(); c.fill();
}
// 选中环 (高亮单位): 位置与队标/命中**同源** (cmdUnitCenter)。集火时高亮被清空 (集火是对区域下令)。
if(CMD.hl){
const ctr=cmdUnitCenter(CMD.hl);
if(ctr){
const [px,py]=cmdMapToCv(ctr.x,ctr.z);
c.strokeStyle='#fff'; c.lineWidth=2;
c.beginPath(); c.arc(px,py,16,0,Math.PI*2); c.stroke();
// 四角准星 (比整圈更"像瞄准", 与菜单/布势界面的黄铜描边风格呼应)
c.strokeStyle='rgba(240,220,158,.9)'; c.lineWidth=2;
for(const [sx,sy] of [[1,1],[1,-1],[-1,1],[-1,-1]]){
c.beginPath();
c.moveTo(px+sx*20,py+sy*20); c.lineTo(px+sx*20,py+sy*14);
c.moveTo(px+sx*20,py+sy*20); c.lineTo(px+sx*14,py+sy*20);
c.stroke();
}
}
}
// 光标位置 (E/F 的落点): 一小段十字虚线 —— 玩家必须能看见"命令会落在哪", 否则 E/F 是盲操作。
// 只在有高亮单位时画 (没单位时 E/F 无意义, 画了反而像有东西可下)。
// ★2026-10-27: 去掉 !CMD.mapDeploy 门 —— 布势期 E/F 现在真的会下令 (见 cmdMapKeyGate 根因块),
//   落点光标必须跟着可见, 否则布势里按 E/F 仍是盲操作 (与战斗期两套可见性 = 两套口径)。
if(CMD.cursor&&CMD.hl){
const [cx2,cy2]=cmdMapToCv(CMD.cursor.x,CMD.cursor.z);
c.strokeStyle='rgba(230,240,210,.55)'; c.lineWidth=1;
c.setLineDash([4,4]);
c.beginPath(); c.moveTo(cx2-10,cy2); c.lineTo(cx2+10,cy2); c.moveTo(cx2,cy2-10); c.lineTo(cx2,cy2+10); c.stroke();
c.setLineDash([]);
}
// 玩家指针
if(player.alive){
const [px,py]=cmdMapToCv(player.pos.x,player.pos.z);
c.save(); c.translate(px,py); c.rotate(-(player.yaw||0));
c.fillStyle='#fff';
c.beginPath(); c.moveTo(0,-7); c.lineTo(4.5,6); c.lineTo(-4.5,6); c.closePath(); c.fill();
c.restore();
}
// 标题条 (文案单源: 与 19-input/面板 的键位说明共用同一份措辞)
const bar=document.getElementById('cmdMapBar');
if(bar){
const want=CMD.mapDeploy
?t2('布势阶段 · 战场冻结 · 滚轮切单位 · E=防守 F=进攻 R=自由 · 右侧调配比 · 确认开战后解冻')
:(t2('滚轮切单位 · E=防守此处 · F=进攻此处/投弹 · R=自由推进 · 左键=集火 · 中键拖动=平移 · 右键=退出'));
if(bar.textContent!==want) bar.textContent=want;
}
}
function cmdDrawOrderLine(c,o,col){
if(!o||o.mode==='free') return;
const [sx,sy]=cmdMapToCv(o.x,o.z);
c.strokeStyle=col; c.lineWidth=1.6; c.setLineDash(o.mode==='hold'?[6,4]:[]);
c.beginPath(); c.arc(sx,sy,8,0,Math.PI*2); c.stroke();
c.setLineDash([]);
if(o.mode==='hold'){ c.beginPath(); c.moveTo(sx-5,sy); c.lineTo(sx+5,sy); c.moveTo(sx,sy-5); c.lineTo(sx,sy+5); c.stroke(); }
}
// ═══════════════ 右侧面板 (2026-10-26 交互重做批 全量重写) ═══════════════
// 用户需求 4 的三条硬约束, 逐条对应到实现:
//  ①"一次只高亮选中一个可指挥选项" → 列表里**只有高亮项**是完整行 (队名+状态+按键提示), 其余压缩成
//    一行极窄的色条 (只有队色 + 队号, 高度 10px), 视觉上"缩到看不见但还能数出有几项"。
//    这样做的理由: 完全隐藏会让玩家失去"我还有几个单位"的空间感, 而列表本身是滚轮切换的**索引**,
//    索引全藏起来就成了盲滚。压缩到 10px 行高既满足"其余压缩", 又保留索引。
//  ②"用滚轮切换" → 滚轮直接改 CMD.hl (cmdHlStep), 面板只做显示。
//  ③"E/F/R 三键" → 高亮项下方直接印出这三个键, 键位与语义在同一行里, 玩家不用去翻说明。
// 美术风格对齐开始界面 (用户需求 4 末句): 羊皮纸/黄铜色板 —— 底 #141a10 半透明, 描边 rgba(210,200,160,.45),
//   高亮描边 #f0dc9e + 内发光, 文字 #e8dcb0/#f0e2b0, 与 .classCard / .bigBtn / #menuDock 同一族颜色。
const CMD_UI={
frame:'background:rgba(20,26,16,.55);border:1px solid rgba(210,200,160,.28);border-radius:6px;',
hl:'background:linear-gradient(180deg,rgba(200,175,95,.26),rgba(120,100,50,.18));border:1px solid #f0dc9e;box-shadow:0 0 14px rgba(230,195,110,.35) inset;border-radius:6px;',
title:'font:bold 13px/1.5 sans-serif;letter-spacing:2px;color:#e8dcb0;',
txt:'font:12px/1.5 sans-serif;color:#e8dcb0;',
dim:'font:11px/1.4 sans-serif;color:#a8a48c;',
key:'display:inline-block;min-width:16px;text-align:center;font:bold 11px/16px sans-serif;color:#1a1c14;background:#e0ca8a;border-radius:3px;padding:0 4px;',
};
function cmdMapPanelTick(){
const pnl=document.getElementById('cmdMapPanel');
if(!pnl||!CMD.orbat) return;
// 2Hz 重建 (列表含存活数/命令态, 变化不频繁; 交互按钮重建后焦点无依赖)
pnl._t=(pnl._t||0)-1;
if(pnl._t>0) return;
pnl._t=30;
// 面板底色/描边与开始界面同族 (一次性写, 幂等: 只在首次或样式被外部改动时重写)
if(pnl._cmdSkin!==1){
pnl._cmdSkin=1;
pnl.style.background='linear-gradient(180deg,rgba(14,18,10,.92),rgba(10,13,7,.96))';
pnl.style.borderLeft='2px solid rgba(210,200,160,.45)';
pnl.style.borderRadius='6px';
pnl.style.boxShadow='0 0 24px rgba(0,0,0,.6) inset';
}
const hl=CMD.hl||CMD.sel;
let h='';
h+='<div style="'+CMD_UI.title+';text-align:center;padding-bottom:4px;border-bottom:1px solid rgba(210,200,160,.28)">'
+(CMD.mapDeploy?t2('布势阶段'):t2('指挥'))+'</div>';
// ── 单位列表: 高亮项完整, 其余压缩 ──
h+='<div style="margin-top:6px">';
for(const u of cmdUnits()){
const alive=(u.kind==='inf')?(u.members.filter(b=>b&&b.alive).length):((u.veh&&u.veh.alive)?1:0);
const total=(u.kind==='inf')?u.members.length:1;
const col=cmdUnitColor(u);
const isHl=(hl===u);
const o=u.order;
const verb=o.mode==='free'?t2('自由推进'):(o.mode==='hold'?t2('防守'):(o.mode==='strike'?t2('投弹'):t2('进攻')));
if(isHl){
h+='<div class="cmdUnit" data-u="'+cmdUnitKey(u)+'" style="'+CMD_UI.hl+'margin:3px 0;padding:6px 8px;cursor:pointer">';
h+='<div style="'+CMD_UI.txt+'font-weight:bold;color:'+col+'">'+t2(cmdUnitName(u))+'</div>';
h+='<div style="'+CMD_UI.dim+'margin-top:2px">'+alive+'/'+total+' · '+verb+(alive?'':' · '+t2('全灭'))+'</div>';
// 三命令键 (飞机: E/R 灰掉, F=投弹) —— 键位提示与 19-input 的分流表逐字一致
const canHold=(u.kind!=='plane'), canAtk=true;
h+='<div style="margin-top:5px;display:flex;gap:6px;align-items:center;opacity:'+(canHold?1:0.4)+'">'
+'<span style="'+CMD_UI.key+'">E</span><span style="'+CMD_UI.dim+'">'+t2('防守此处')+'</span></div>';
h+='<div style="margin-top:3px;display:flex;gap:6px;align-items:center;opacity:'+(canAtk?1:0.4)+'">'
+'<span style="'+CMD_UI.key+'">F</span><span style="'+CMD_UI.dim+'">'+(u.kind==='plane'?t2('向此处投弹'):t2('进攻此处'))+'</span></div>';
h+='<div style="margin-top:3px;display:flex;gap:6px;align-items:center">'
+'<span style="'+CMD_UI.key+'">R</span><span style="'+CMD_UI.dim+'">'+t2('自由推进')+'</span></div>';
h+='</div>';
}else{
// 压缩行: 只剩一条色条 + 队号 (高度 10px) —— 可点 (点它 = 切到它), 但视觉上退到背景
h+='<div class="cmdUnit" data-u="'+cmdUnitKey(u)+'" style="margin:1px 0;height:10px;border-radius:3px;cursor:pointer;'
+'background:linear-gradient(90deg,'+col+' 0px,'+col+' 3px,rgba(255,255,255,.05) 3px);'
+'display:flex;align-items:center;padding-left:8px;opacity:'+(alive?0.85:0.35)+'">'
+'<span style="font:9px/10px sans-serif;color:#a8a48c">'+(u.kind==='inf'?CMD_SQUAD_NAMES[u.id%CMD_SQUAD_NAMES.length]:(u.kind==='tank'?'T':'A'))+'</span>'
+'</div>';
}
}
h+='</div>';
// 布势期: 每组配比编辑 + 撤销 + 确认开战 (D21 + 用户需求 6)
if(CMD.mapDeploy){
h+='<div style="'+CMD_UI.frame+'margin-top:8px;padding:6px 8px">';
h+='<div style="'+CMD_UI.title+'font-size:12px">'+t2('兵种配比')+'</div>';
for(const s of CMD.orbat.squads){
const cur=cmdRatioOf(s);
h+='<div style="margin:5px 0;padding:4px 6px;background:rgba(255,255,255,.04);border-radius:4px;border-left:2px solid '+cmdUnitColor(s)+'">';
h+='<div style="'+CMD_UI.dim+'font-weight:bold;color:'+cmdUnitColor(s)+'">'+t2(cmdUnitName(s))+' ('+s.members.length+t2('人')+')</div>';
for(let ci=0;ci<5;ci++){
h+='<div style="display:flex;justify-content:space-between;align-items:center;'+CMD_UI.dim+'">'
+'<span>'+t2(CLASSES[ci].name)+'</span>'
+'<span><button class="cmdRat" data-sq="'+s.id+'" data-ci="'+ci+'" data-d="-1" style="width:22px;cursor:pointer;background:#3a3422;color:#f0e6c0;border:1px solid #8a7c50;border-radius:3px;">−</button> '
+'<b style="color:#e8dcb0;display:inline-block;min-width:14px;text-align:center">'+cur[ci]+'</b> '
+'<button class="cmdRat" data-sq="'+s.id+'" data-ci="'+ci+'" data-d="1" style="width:22px;cursor:pointer;background:#3a3422;color:#f0e6c0;border:1px solid #8a7c50;border-radius:3px;">＋</button></span></div>';
}
h+='</div>';
}
h+='</div>';
// 撤销布势 (用户需求 6: 允许撤销布局 + 退出并重选兵种)。实现全在 23-deploy 的 cmdDeployUndo 单源 ——
// 本文件只负责给出这个按钮 (typeof 守卫: 极端沙箱/旧文件子集里没有该函数就不画, 不炸)。
h+='<button id="cmdDeployUndo" style="width:100%;margin-top:6px;padding:7px;font:bold 12px sans-serif;background:linear-gradient(180deg,#3a3422,#2a2618);color:#d8cba0;border:1px solid #8a7c50;border-radius:5px;cursor:pointer;">'+t2('↩ 撤销布势 (重选兵种)')+'</button>';
h+='<button id="cmdDeployGo" style="width:100%;margin-top:5px;padding:9px;font:bold 14px sans-serif;background:linear-gradient(180deg,#7a6a2a,#4a3f18);color:#fff8dc;border:1px solid #ffd75a;border-radius:5px;cursor:pointer;letter-spacing:2px;">'+t2('✚ 确认开战')+'</button>';
}
if(!CMD.mapDeploy&&cmdIsCommander()){
h+='<div style="'+CMD_UI.frame+'margin-top:8px;padding:5px 7px;'+CMD_UI.dim+'line-height:1.6">'
+t2('指挥读条')+': <b style="color:#e8dcb0">'+Math.ceil(CMD.focus)+'/'+CMD_TIME.FOCUS_MAX+'s</b><br>'
+'<span style="'+CMD_UI.key+'">V</span> '+t2('按住减速 (消耗读条)')+'</div>';
}
pnl.innerHTML=h;
// 接线
// ★2026-10-26 交互重做批: 点列表行 = 高亮该项 (与滚轮/地图点选同一条状态 CMD.hl, 三条选人路径并存)。
pnl.querySelectorAll('.cmdUnit').forEach(el=>{
el.onclick=()=>{
const u=cmdUnitOf(el.dataset.u);
if(u){ CMD.hl=u; CMD.sel=u; cmdMapDraw(); }
pnl._t=0; cmdMapPanelTick();
};
});
pnl.querySelectorAll('.cmdRat').forEach(b=>{
// ★2026-10-26 排查轮 P0 修复: 这里原本**漏写 `b.onclick=`** —— 整个函数体在绑定阶段就被执行:
//   ① 没人点也立刻 cmdRatioAdj 改配比; ② `pnl._t=0` 把本函数首行的 `if(pnl._t>0) return` 守卫
//   清零后又递归调 cmdMapPanelTick ⇒ 无界自递归 (实测 Maximum call stack size exceeded, 7509 层);
//   ③ 抛点在 767 行 `#cmdDeployGo` 绑定**之前** ⇒ 「确认开战」永不绑定。布势期 player.alive/deployed
//   都是 false, 19-input 的 Esc 门 (43 行) 与右键门 (419 行) 都不成立 ⇒ 布势唯一出口死掉 = 软锁死;
//   且 cmdFrameTick 在 24-main:196 无 try, 异常每帧冒出 loop() 跳过渲染。
//   既有探针全绿的原因: _bootstub 的 querySelectorAll 恒返回 [] (第 22/40 行), 三个 forEach 全空转。
b.onclick=()=>{
const sq=+b.dataset.sq, ci=+b.dataset.ci, d=+b.dataset.d;
const s=CMD.orbat.squads.find(x=>x.id===sq);
if(s){ cmdRatioAdj(s,ci,d); }
pnl._t=0; cmdMapPanelTick();
};
});
const go=document.getElementById('cmdDeployGo');
if(go) go.onclick=()=>{ cmdDeployConfirm(); };
// 撤销布势 (用户需求 6): 单源在 23-deploy 的 cmdDeployUndo —— 本文件只调, 不重复实现收图/复位逻辑。
// 收图这一步由 cmdDeployUndo 内部走 cmdMapClose(false) 复用宿主搬运 (布势版挂 body, 战斗版挂 #ui)。
const undo=document.getElementById('cmdDeployUndo');
if(undo) undo.onclick=()=>{
if(typeof cmdDeployUndo==='function'){ cmdDeployUndo(); }
else if(typeof showScorePop==='function'){ showScorePop(t2('撤销布势: 当前版本不支持')); }
};
}
let _cmdUnitSeq=1;
function cmdUnitKey(u){
if(!u._key) u._key='u'+(_cmdUnitSeq++);
return u._key;
}
function cmdUnitOf(key){
if(!CMD.orbat) return null;
for(const s of CMD.orbat.squads) if(s._key===key) return s;
for(const t of CMD.orbat.tanks) if(t._key===key) return t;
for(const p of CMD.orbat.planes) if(p._key===key) return p;
return null;
}
// ── D21 布势: 配比 = 生成期参数, Bot 直接按配比落装 (setClass 单源重落) ──
// ★2026-10-26 排查轮二审 修复 (配比读数与人数脱钩 / 第 6 个幽灵槽):
//   ①旧写 b.cls%5 对 cls 越界不设防 —— cls=undefined ⇒ NaN 下标 (ratio[NaN] 建出一个**隐藏的第 6 槽**,
//     面板只画 0..4 五项 ⇒ "合计 5 人却只显示 4" 的读数错位); cls=5 (指挥官) 会被折叠成 0 (步枪兵),
//     把一个"配比里根本不该有的兵种"画成第 1 类。cls 必须落在 0..4 才计入, 其余忽略 (合计 <= 人数)。
//   ②"配比读数与真实兵种分布脱钩"(B-6) 的根因不在缓存, 而在**没有第二处按配比落装**: 旧链路里
//     s.ratio 只在首次初始化时读一次成员 cls, 之后 14-bots spawn 每命重掷 CLS_POOL[randi] ⇒ 真实分布
//     越跑越散, 而 s.ratio 冻在开局那一刻。这里的语义边界要写清楚 (防止后人"顺手"把它改成实时统计):
//       · s.ratio = **期望配比** (玩家在布势界面编辑的那份), 只在首次由实际分布初始化, 之后由
//         cmdRatioAdj/cmdRatioApply 改写 —— 它不是"当前分布"的镜像, 改成实时统计会让玩家每点一下
//         ＋/− 都被下一次重算抹掉 (编辑行为直接失效)。
//       · 让"期望分布 == 真实分布"成立的是 cmdRatioWantBot (重生落装单源, 见下), 不是本函数。
//     布势面板画的也正是这份期望值 (那是玩家正在调的东西), 因此不存在"面板与事实不符"。
function cmdRatioOf(s){
if(!s||!s.ratio){
if(!s) return [0,0,0,0,0];
s.ratio=[0,0,0,0,0];
for(const b of s.members){
const ci=(b&&typeof b.cls==='number'&&b.cls>=0&&b.cls<5)?(b.cls|0):-1;
if(ci>=0) s.ratio[ci]++;
}
}
return s.ratio;
}
// ── D21 生成期配比 → Bot 落装 (14-bots spawn 消费) ──
// ★2026-10-26 排查轮二审 修复 (布势调好的配比被重生重掷抹掉): 设计 D21 原文「配比是生成期参数,
//   Bot 直接按配比落装」—— 但 14-bots 的 spawn() 每一条命都 setClass(CLS_POOL[randi(...)]) 重掷,
//   于是玩家在布势界面辛苦调好的「1 组 2 个狙击手」在第一次阵亡后就散成随机兵种, 布势的全部价值
//   只维持到第一个战损。这里提供**取兵种单源**: 目标配比 = cmdRatioOf(s) (玩家编辑后的期望分布),
//   实际分布 = 组内当前 cls 统计; 缺哪个就从"超额"的类里挪一个过来 (贪心, 保持总数守恒且稳定)。
//   返回 0..4 = 该按这个兵种落装; 返回 null = 无编制/无需调整, 调用方走原来的随机 (零回归)。
function cmdRatioWantBot(bot){
// ★2026-10-27 排查批 修复 (普通局零回归破口): cmdOrbatBuild 挂 startMatch 尾是**无条件**建编
//   (23-deploy 调用点注释明写"不开放图也照建 (编制本身无副作用)"), 于是普通局里 Bot 同样带 cmdGrp
//   —— 本函数若无指挥官门, 普通局的死亡重生也会走"配比补差": want 惰性初始化自全组成员的当前 cls
//   (含死者的旧 cls), have 只统计活人 ⇒ gap 恰好落在死者旧兵种位 ⇒ 死者**永远按旧兵种复活**,
//   14-bots spawn 的 CLS_POOL 每命重掷被静默替换 (旧口径: 每条命独立随机)。这违反本文件红线
//   "普通兵种零回归 —— 所有新路径都以 cls===5 为门"。配比是 D21 布势的交付物 (玩家编辑过的期望
//   分布), 只对指挥官局有意义; 门加在判据单源这里, 不加在 14-bots 调用点 (那边不许长第二份判据)。
//   指挥官局不受影响: 玩家 cls===5 恒成立 (含死亡期), 布势配比照常约束重生落装。
if(!bot||!bot.cmdGrp||!CMD.orbat||!cmdIsCommander()) return null;
const s=bot.cmdGrp;
const want=cmdRatioOf(s);
if(!want) return null;
const alive=s.members.filter(b=>b&&b.alive!==false);
if(!alive.length) return null;
const have=[0,0,0,0,0];
for(const b of alive){
const ci=(typeof b.cls==='number'&&b.cls>=0&&b.cls<5)?(b.cls|0):-1;
if(ci>=0) have[ci]++;
}
// ★2026-10-27 排查批 修复 (多余的"摘自己"扣减把贪心补差拧向死者旧兵种): 旧写在这里把 bot 自己的旧 cls
//   从 have 里再扣一次 ("它此刻的 cls 可能还是旧值") —— 但本函数唯一调用点是 14-bots spawn 的落装行,
//   那一刻 bot 还是**死人** (构造器/die 都置 alive=false, spawn 要到落装行之后才置 true), 它根本没被
//   filter 进 have。扣减 = 凭空把 have[myCi] 清掉一档 (clamp 在 0), gap 在旧兵种位被虚增 ⇒ 死者总是
//   优先按旧兵种复活, 玩家布势调的配比被它对抗 (实测例: want=[2,1,1,1,0]、实际分布已漂到 [3,1,1,0,0],
//   死一人后 alive 恰好等于 want, 正确答案是把缺的 cls3 补上; 旧扣减却让死者又复活成第 3 个步枪手,
//   分布永远回不到 want)。正确口径: have 就是"活着的人"的分布, want 合计=全组人数, 死人=待补的空位,
//   sum(gap)=死亡数>=1 恒有正差 ⇒ 贪心补差天然把分布收拢回 want, 不需要任何摘除动作。
let pick=-1,bestGap=0;
for(let ci=0;ci<5;ci++){
const gap=want[ci]-have[ci];
if(gap>bestGap){ bestGap=gap; pick=ci; }
}
return pick>=0?pick:null;
}
function cmdRatioAdj(s,ci,d){
const cur=cmdRatioOf(s);
const total=s.members.length;
const sum=cur.reduce((a,b)=>a+b,0);
if(d>0){ if(sum>=total) return; cur[ci]++; }
else { if(cur[ci]<=0) return; cur[ci]--; }
cmdRatioApply(s);
}
function cmdRatioApply(s){
const cur=cmdRatioOf(s);
const pool=[];
for(let ci=0;ci<5;ci++) for(let k=0;k<cur[ci];k++) pool.push(ci);
// 保持队形稳定: 按成员现有 cls 的接近度分配 (简单顺序填充即可 —— 配比是生成期参数)
for(let i=0;i<s.members.length&&i<pool.length;i++){
const b=s.members[i];
if(b&&b.cls!==pool[i]&&typeof b.setClass==='function'){ try{ b.setClass(pool[i]); }catch(e){} }
}
}
// 布势入口: 首次选指挥官卡自动进 (23-deploy 卡片点击处调); 可重复进入 (选卡再点布势按钮)
function cmdDeployPhase(){ return CMD.mapOn&&CMD.mapDeploy; }
function cmdDeployOpen(){
if(!cmdMapInit()) return;
// ★2026-10-27 排查批 修复 (三审的分帧修复被本行架空): 旧写在这里 `cmdBake()` 同步整烘 —— 预热没跑完时
//   (大图 0.7s 级 / 玩家点击快) 一次性把剩余采样跑完, "进布势当帧整帧僵住"原样复发。改为与 cmdMapDraw
//   同款的"起作业"口径: 底图没就位就让作业在跑, 当帧画"生成中"占位, 由 cmdFrameTick 的预算路径续算
//   (预热起作业门见 cmdFrameTick 的 ★2026-10-27 块 —— 部署页期间通常早已烘完, 这里只是兜底)。
if(cmdBakeNeeded()&&!CMD._bj){ try{ cmdBakeBegin(); }catch(e){} }
CMD.mapOn=true; CMD.mapDeploy=true; CMD.sel=null;
CMD._pauseHid=false;
CMD.deploySeen=true;
// 私人小队互斥 (2026-10-26 反馈批, 用户需求 4): 进布势即解散收编 —— 让布势地图从第一帧起就看到
// 完整编制 (含被 startMatch 组队占掉的那 3 人); 确认开战盖章路径的同名调用幂等 (SQUAD 已空=零操作)。
// 撤销布势走 cmdDeployUndo → cmdSquadRestore 原样还编 (23-deploy 接线)。
cmdOrbatAdopt(cmdDisbandPlayerSquad());
// 交互重做批: 进布势先高亮第一个可指挥单位 (用户需求 4 "一次只高亮一个" —— 进界面就必须有一个是亮的,
// 否则 E/F/R 三个键按下去没有作用对象, 玩家第一反应是"键没接上")。
CMD.hl=null; CMD.cursor=null; CMD.focusFire=null;
{ const us=cmdUnits(); if(us.length) CMD.hl=us[0]; }
// 布势看全局: 视图居中 + 整图适配缩放 (cmdMapFitScale 单源)。_follow 关掉 —— 布势期玩家还没落地,
// "跟随玩家"没有意义, 而且 player.pos 此时是上一局/默认值, 跟着它会把视图带偏。
CMD.view={cx:0,cz:0,scale:cmdMapFitScale()}; CMD._follow=false;
cmdMapReparent(true);                              // 布势版挂 body (部署页之上, 不吃 inDeploy 压制)
cmdMapWrapShow(true);
if(document.pointerLockElement) document.exitPointerLock();
cmdMapResize(); cmdMapDraw(); cmdMapPanelTick();
}
function cmdDeployConfirm(){
// 确认开战: 收起布势地图 (部署页就在身后), 世界解冻 (cmdDtGate 不再回 0)。
// ★ 必须**先** cmdMapClose: close 靠读 mapDeploy 判断"布势版挂在 body, 收起要搬回 #ui 压制网" ——
//   先清标志再收图 = 宿主永远滞留 body (布势后再开战斗图会连显隐压制网一起绕过)。
cmdMapClose(false);
CMD.mapDeploy=false;
// ★2026-10-26 交互重做批 修复 (用户需求 6 的「确认之后兵种锁定」在确认那一刻没生效):
//   ①现象 (真浏览器实测): 布势点「确认开战」→ 收起布势回部署页 (人还没落地), 此刻 lockedDir 仍是 null
//     ⇒ 点别的兵种卡**直接换成**别的兵种 (cls 5→2 成功, 无任何提示), 再落地时 cmdLockStamp(2) 盖章 'out'
//     —— 刚确认的整套布势 (指挥官 + 配比 + 初始令) 被静默作废。
//   ②根因: R10 的盖章只挂在 deployPlayer 落地那一刻 (23-deploy), 而「确认布势」是一个**语义上的提交点**
//     (玩家已经用确认按钮表态「就按这个打」), 提交之后到落地之间没有任何锁。
//   ③口径: 确认即盖章 (cmdLockStamp 是既有单源, 幂等: 已有 lockedDir 就直接 return, 不覆盖)。
//     与「撤销布势」不冲突 —— cmdDeployUndo (23-deploy 单源) 会把 lockedDir 复位成 null, 所以
//     「撤销 → 重选兵种 → 再确认」这条链照常成立, 撤销正是用户需求 6 的前半句。
//     副作用面: 只有布势确认这一条路径新增盖章 (非指挥官玩家走不到这里), 其余零回归。
if(typeof cmdLockStamp==='function') cmdLockStamp(player.cls);
const dep=document.getElementById('deploy');
if(dep&&dep.classList.contains('hidden')&&typeof showDeploy==='function'&&player.alive) showDeploy(false);
if(typeof AudioSys!=='undefined'&&AudioSys.click) AudioSys.click(1300,0.3,0.06);
}
// ═══════════════ 七、指挥读条 HUD (挂 #ui, 2Hz 文案 + 每帧宽度) ═══════════════
function cmdFocusHudTick(drain){
const wrap=document.getElementById('cmdFocusWrap');
// ★2026-10-26 排查轮二审 修复: 裸引用 matchOver —— 本文件其余全部站点都写 typeof 守卫 (本文件唯一
//   一处例外), 单独加载 26-commander 的探针/沙箱里 matchOver 未定义 ⇒ ReferenceError 抛在
//   每帧的 cmdFrameTick 里 (24-main:196 无 try) ⇒ 整个 loop 中断, 画面与输入全停。守卫化零成本。
if(!cmdIsCommander()||!player.alive||!player.deployed||(typeof matchOver!=='undefined'&&matchOver)){
if(wrap) wrap.style.display='none';
return;
}
// ★2026-10-26 反馈批 (用户需求 1「指挥读条常驻显示, 且与占领读条下方的文字重叠」):
//   ①常驻 → 按需: 满格且不在减速时**隐藏**。读条只有两态值得占屏幕 —— 正在消耗 (减速中) 与恢复中;
//     满格静默 (资源的存在感由部署提示 / 右侧面板 / 帮助页承担)。免费档 (focusCost 关) 无收支,
//     drain 恒 false, 改用 CMD.slowOn 判"减速进行中"。
//   ②重叠修复: 旧位 bottom:15.5% (1080p ≈167px) 正好压在 #capPanel (bottom:110px, 旗字母+占领条+
//     状态文字总高 ~60px, 顶缘 ~170px) 的占领文字上。上移到 bottom:186px, 与 capPanel 顶缘留出空隙。
const costly=cmdSlowCostly();
if(!(drain||CMD.slowOn||(costly&&CMD.focus<CMD_TIME.FOCUS_MAX-0.01))){
if(wrap) wrap.style.display='none';
return;
}
if(!wrap){
const ui=document.getElementById('ui');
if(!ui) return;
const d=document.createElement('div');
d.id='cmdFocusWrap';
d.style.cssText='position:absolute;left:50%;bottom:186px;transform:translateX(-50%);width:130px;pointer-events:none;';
d.innerHTML='<div id="cmdFocusLab" style="font:10px sans-serif;color:#cfe0b8;text-shadow:0 1px 2px #000;text-align:center;"></div>'
+'<div style="height:5px;background:rgba(0,0,0,.55);border:1px solid rgba(210,200,160,.4);border-radius:3px;overflow:hidden;">'
+'<div id="cmdFocusBar" style="height:100%;width:100%;background:#7fd4c8;"></div></div>';
ui.appendChild(d);
}
const w=document.getElementById('cmdFocusWrap');
w.style.display='block';
const bar=document.getElementById('cmdFocusBar');
const lab=document.getElementById('cmdFocusLab');
const f=clamp(CMD.focus/CMD_TIME.FOCUS_MAX,0,1);
if(bar) bar.style.width=(f*100).toFixed(1)+'%';
if(bar) bar.style.background=drain?'#ffd75a':'#7fd4c8';
if(lab){
const want=drain?t2('减速中…'):(f>=1?t2('指挥读条'):(CMD_SETTINGS.focusCost?t2('指挥读条 恢复中'):'∞'));   // 键位不在此处重复 (词条单源 = cmdSpecHudKeys / 面板)
if(lab.textContent!==want) lab.textContent=want;
}
}
// ═══════════════ 八、部署期提示 (23-deploy deployPlayer 调) ═══════════════
function cmdDeployHint(){
if(!cmdIsCommander()) return;
if(typeof SHOW_CTL_HINTS!=='undefined'&&!SHOW_CTL_HINTS) return; // 详细操作开关 (2026-11-09 批): 关=部署页键位提示不弹
// typeof 守卫与本文件其余 showScorePop 站点同规 (2026-10-27 排查批: 这里是全文件唯一一处裸调用)
if(typeof showScorePop==='function') showScorePop(t2('指挥官 · 持通讯仪右键开指挥地图 · 滚轮切单位 · E=防守 F=进攻 R=自由 · 左键=集火 · 按住 V 减速'));
}
// 减速键词条单源 (观战提示行 22-hud 票数行 / 23-deploy 部署提示 共用)
// ★2026-10-26 排查轮二审 修复 (死代码 = 词条实际有两个硬编码副本): 旧实现本函数全库无调用点 ——
//   真正的词条在两处各硬编码了一份。接线到这两处, 让"词条怎么拼"只有一份。
//   ★2026-10-27 排查批 二次跟走: 22-hud 票数行当时**并没有**真接线 (仍硬编码旧键名 'N=减速(不耗资源)'),
//     而换键批把 i18n 词典键改成了 V ⇒ 该行 t() 查表必 miss (英文整句退回中文) 且键名错 —— 本批补上
//     接线并纠正键名; 23-deploy 的 fallback 字面量同样从 N 纠正为 V (探针旧判据正是被它的注释喂绿的)。
//   注入文本本身已带 i18n 键 (整句是键, t() 可整串翻译), 这里返回**未翻译**词条, 由调用方整体 t() 一次
//   (零翻译漂移)。键名再改时只动本函数返回值 + 词典整句键, 两处调用点不再各自持有副本。
function cmdSpecHudKeys(){ return ' · V=减速'; }
// ═══════════════ 九、键盘分流 (19-input 消费; 2026-10-26 交互重做批) ═══════════════
// 指挥地图开着时, 三个命令键归地图 (E=防守 / F=进攻·投弹 / R=自由推进)。19-input 的 keydown 只问
// 本函数一句"这个键现在归你吗", 不许自己再写一份键名判断 —— 键表 (CMD_KEYS) 因此只有一份。
// 返回 true = 已消费 (调用方必须 return, 不再走该键的默认语义: E 右倾身 / F 互动 / R 装填)。
// 为什么必须在这里而不是在 19-input 里直接 switch 键名: 这三条语义**只在地图开着时**成立, 关图后
// 三个键的默认语义一个字都不能变 —— 判据与语义绑在一起才不会漂移。
// ★2026-10-27 修复 (用户实报: 开局前的部署阶段 E/R/F 按下均无效) —— 布势期不再是"吞掉"档:
//   ①现象: 选指挥官卡进布势界面后, 面板高亮行明明印着 E=防守此处 / F=进攻此处 / R=自由推进,
//     标题条也写着同样的三个键, 帮助页写着"E/F/R 下初始令", 但按下去三个键全无反应。
//   ②根因 (两段叠加, 缺一都不会全灭):
//     · E/F: 旧写 `if(CMD.mapDeploy) return code!==CMD_KEYS.free;` —— 布势期 E/F 直接 return true
//       ("吞掉")**却不执行任何命令**, 于是 19-input 提前 return, 世界侧零变化。
//     · R: 该分支对 R 返回 **false**(="不归地图"), 19-input 于是继续往下走; 而开图早退块的最后一句是
//       `if(e.code!==CMD_TIME.KEY) return;` ⇒ R 既没被地图执行、也没被放行到战斗语义, 两头落空。
//     两者合起来正是用户看到的现象: 三个键一个都不响。
//   ③为什么当初会写"吞掉": 注释理由是"布势期人还没落地, 光标落点没有战术意义"。这条前提是错的 ——
//     布势界面的核心交付就是**初始令** (设计 D21: 配比 + 初始命令), 玩家正要在开打前指定"1 组去 A 点防守"。
//     而且界面上三处文案 (帮助页 / 标题条 / 面板高亮行) 一直在承诺这三个键可用, 实现与自己的 UI 相反。
//   ④口径: 布势期与战斗期**完全同规** —— 三个键都执行命令 (落点仍取光标, 见 cmdCursorPt)。
//     "误触改令"的顾虑由两件事兜住: 布势期世界冻结 (cmdDtGate 回 0, 令不会立刻被执行成位移),
//     且面板每 2Hz 重画把每组的当前令印在行上 (玩家看得见改成了什么)。
//   ★单一函数: 早期实现把"吞掉"与"执行"拆成 cmdMapKeyGate / cmdMapKeySwallow 两个函数, 19-input
//   必须先问 swallow 再问 gate —— 两个函数的判据一旦漂移就会出现"吞掉但没执行"或"执行了两次"。
//   现在只有本函数一处, 19-input 只问它一句; 且**不存在"返回 true 但什么都没做"的分支** ——
//   这正是本 bug 的形态, 作为不变量写在这里。
function cmdMapKeyGate(code){
if(!CMD.mapOn) return false;
const isCmd=(code===CMD_KEYS.hold||code===CMD_KEYS.attack||code===CMD_KEYS.free);
if(!isCmd) return false;
if(code===CMD_KEYS.hold) return cmdKeyCommand('hold');
if(code===CMD_KEYS.attack) return cmdKeyCommand('attack');
return cmdKeyCommand('free');
}
