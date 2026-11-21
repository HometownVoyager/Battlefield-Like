// ═══════════════════════════════════════════════════════════════════════════
// 27-achievements.js —— 成就系统 (2026-11-11 成就批)
// 设计文档: 仓库根《成就系统设计-2026-11-11.md》。要点:
//   · R1 轮询账: 不往火/破坏/死亡路径插桩。开局 (startMatch) 对世界拍"普查快照",
//     主循环 0.5s 低频按各系统**既有权威状态位**复核进度, 零写点:
//     燃料格 FUEL<=0.05 / 树 tr.fall·charred·dead / 植被 rec.dead / 结构 g.dead /
//     掩体 b.dead / 油桶 c.dead / 铁丝网 w.alive===false。
//   · R2 口径: 按"一局内世界状态"计, 不做击杀归因 —— 任何来源 (玩家/Bot/环境炮击/
//     油桶链) 的烧毁/破坏/倒伏都推进; 归因制会被环境炮击与 Bot 残骸火制造永久死库存,
//     成就在该局数学上不可完成 (草原炮火犁地就是现成反例)。
//   · R5 观战 (2026-11-11 用户改令, 原门撤销): 观战模式**也可以**达成成就 —— 不设 spectator 门,
//     解锁判据只看世界状态位与玩家尸检字段 (死亡等待期/部署页/观战一视同仁)。
//   · R8 兼容: 本文件顶层只定义常量/函数+读存档, **不摸 DOM/场景**; 三处接线
//     (23-deploy startMatch / 24-main 主循环 / 22-hud showPanel) 全部 typeof ACH 守卫
//     —— 硬编码 FILES 清单的旧探针 (停在 26-commander) 不载本文件, 守卫保证零回归。
// ═══════════════════════════════════════════════════════════════════════════

// ── 成就定义表 (数据驱动): 加成就只改这张表 + 00b-i18n 词条 ──
const ACH_DEFS=[
 {id:'yiling_fire',  name:'夷陵之火',        desc:'在一局游戏中烧掉全部可以烧掉的东西', kind:'burn_all'},
 {id:'better_yiling',name:'比夷陵之火还要好', desc:'在一局游戏中破坏掉全部可以破坏掉的东西（包括可燃物）', kind:'destroy_all'},
 {id:'seppuku',      name:'自刎归天',        desc:'自己被自己的手雷炸死一次', kind:'self_nade'},
 {id:'bear_king',    name:'狗熊岭之王',      desc:'在一局游戏中令全部的树倒下', kind:'fell_all'},
 {id:'likud_pilot',  name:'利库德集团最好的飞行员', desc:'驾驶飞机撞上建筑而死亡一次', kind:'plane_bld'},   // 2026-11-14 用户令: 事件制成就 (同自刎归天族), 判据见 achEvaluate 死亡边沿块
];

// ── 存档 (R6): localStorage['sf_ach'] = {id: 时间戳ms}, recLoad 范式 (损坏视为空) ──
function achLoadState(){
 try{
  const r=JSON.parse(localStorage.getItem('sf_ach')||'{}');
  return (r&&typeof r==='object'&&!Array.isArray(r))?r:{};
 }catch(e){ return {}; }
}
let ACH_STATE=achLoadState();
function achSaveState(){ try{ localStorage.setItem('sf_ach',JSON.stringify(ACH_STATE)); }catch(e){} }

let ACH_CENSUS=null;   // 本局普查账 (startMatch 重建; null = 尚无对局)
let ACH_PROG={burn:{done:0,total:0},trees:{fell:0,burned:0,total:0},dest:{done:0,total:0}};
let _achAcc=0,_achLastDeaths=-1,_achTabsWired=false;
const ACH_TOAST_Q=[];
let ACH_TOAST_EL=null;

function _achT(){ return (typeof t2==='function')?t2.apply(null,arguments):arguments[0]; }

// ── 开局普查账 (R3): startMatch 是"新局世界必然 pristine"的唯一漏斗
//    (beginFreshMatch→restorePristineWorld→startGame→startMatch; reload 引导分支直达 startGame)。
//    构建期预塌废墟 (dead=true) / 已死植被天然不入账; 局内新建工事 (丧尸模式) 不在快照里, 天然排除。 ──
function achBuildCensus(){
 const cells=[],trees=[],flora=[],structs=[],props=[],barrels=[],wireList=[];
 try{
  // 可燃格: 开局燃料 >0.05 的格子 (草丛/庄稼/灌木/树篱/竹/枯树/椰树/柳的燃料都在格账里)
  if(typeof FUEL!=='undefined'&&FUEL&&FUEL.length){ for(let ci=0;ci<FUEL.length;ci++){ if(FUEL[ci]>0.05) cells.push(ci); } }
  // 植被全账: FLORA_HASH 是全部逐株植被的统一索引 (乔木/柳/枯树/椰树/灌木/蕨/树篱/竹)。
  // 树=tree/willow/palm/dead 四类 (枯树/椰树算"树": 冬季图过半是枯树、塔拉瓦椰树是树主体, 不纳入则两图不可完成);
  // 竹丛/灌木/蕨/树篱走植被对象账; 草丛/庄稼无逐株记录, 由格子账覆盖。
  if(typeof FLORA_HASH!=='undefined'&&FLORA_HASH&&FLORA_HASH.forEach){
   FLORA_HASH.forEach(arr=>{
    if(!arr) return;
    for(let i=0;i<arr.length;i++){
     const rec=arr[i];
     if(!rec||rec.dead||rec.alive===false) continue;
     const k=rec.kind;
     if(k==='tree'||k==='willow'||k==='palm'||k==='dead') trees.push(rec);
     else if(k==='bush'||k==='fern'||k==='hedge'||k==='bamboo') flora.push(rec);
    }
   });
  }
  if(typeof DESTRUCTIBLES!=='undefined'&&DESTRUCTIBLES){ for(let i=0;i<DESTRUCTIBLES.length;i++){ const g=DESTRUCTIBLES[i]; if(g&&!g.dead) structs.push(g); } }
  if(typeof BOXES!=='undefined'&&BOXES){ for(let i=0;i<BOXES.length;i++){ const b=BOXES[i]; if(b&&b.crush&&!b.flora&&!b.dead) props.push(b); } } // 树篱 crush 盒走植被账, 不重复计
  if(typeof CYLS!=='undefined'&&CYLS){ for(let i=0;i<CYLS.length;i++){ const c=CYLS[i]; if(c&&c.explosive&&!c.dead) barrels.push(c); } }
  if(typeof wires!=='undefined'&&wires){ for(let i=0;i<wires.length;i++){ const w=wires[i]; if(w&&w.alive!==false) wireList.push(w); } }
 }catch(e){ ACH_CENSUS=null; return; }
 ACH_CENSUS={cells:cells,trees:trees,flora:flora,structs:structs,props:props,barrels:barrels,wires:wireList};
 _achLastDeaths=(typeof player!=='undefined'&&player)?(player.deaths||0):-1;
 if(typeof player!=='undefined'&&player){ player._achPilotBld=false; player._achNadeSelf=false; }   // 撞楼/自刎普查字段不跨局携带 (与 deaths 基线同步重建; 2026-11-14 / ★2026-11-21 审计 B#30)
}

// ── 解锁 (R6): 永久落盘 + 弹框。双保险防"不停跳出来" (2026-11-11 实机反馈批):
//    ① ACH_STATE 永久账守卫 (重复解锁 no-op); ② ACH_TOASTED 会话闩 —— 即使存档被外力清空
//    (存档损坏重建/调试清账), 同一成就本会话也只弹一次, 结构上杜绝弹框重播。 ──
const ACH_TOASTED={};
function achUnlock(id){
 if(ACH_STATE[id]) return;
 ACH_STATE[id]=Date.now();
 achSaveState();
 if(ACH_TOASTED[id]) return;
 ACH_TOASTED[id]=1;
 let def=null;
 for(let i=0;i<ACH_DEFS.length;i++){ if(ACH_DEFS[i].id===id){ def=ACH_DEFS[i]; break; } }
 achToast(def||{id:id,name:id,desc:'',kind:''});
}

// ── 弹框 (R7 · 2026-11-11 加料版): 右上 killfeed 下方, 挂 body (F1 藏 HUD 不吞, 同 #hudHideTip 先例)。
//    金带头章 + 🏆 徽章脉动 + 名称/描述/进度三行 + 高光扫过; 同帧多成就排队逐条播 (4.2s 展示 + 0.4s 淡出)。
//    沙箱无 DOM 环境静默。 ──
function achProgText(kind){ // 进度行单源: 解锁瞬间 ACH_PROG 已是本局最新值 (弹框与成就面板共用)
 if(!ACH_PROG) return '';
 if(kind==='burn_all'&&ACH_PROG.burn.total>0) return _achT('可燃物')+' '+ACH_PROG.burn.done+'/'+ACH_PROG.burn.total;
 if(kind==='fell_all'&&ACH_PROG.trees.total>0) return _achT('树木')+' '+ACH_PROG.trees.fell+'/'+ACH_PROG.trees.total;
 if(kind==='destroy_all'&&ACH_PROG.dest.total>0) return _achT('可破坏物')+' '+ACH_PROG.dest.done+'/'+ACH_PROG.dest.total;
 return '';
}
function achPosMode(){ // 弹窗位置 (2026-11-11 用户令): sf_ach_pos 'tr'=右上竖卡 / 'bc'=正下横匾; 每次弹出现读 ⇒ 设置改档即时生效
 try{ return localStorage.getItem('sf_ach_pos')==='bc'?'bc':'tr'; }catch(e){ return 'tr'; }
}
function achToast(def){
 ACH_TOAST_Q.push(def);
 achToastPump();
}
function achToastPump(){
 if(ACH_TOAST_EL&&ACH_TOAST_EL._achBusy) return;   // 上一条还在播
 if(!ACH_TOAST_Q.length) return;
 const def=ACH_TOAST_Q.shift();   // ★勿删 shift: 浏览器里裸名 name 会静默解析成 window.name (空串), 成就名恒空 —— def 携名称/描述/进度三料
 if(typeof document==='undefined'||!document.createElement){ ACH_TOAST_Q.length=0; return; }
 if(!ACH_TOAST_EL){
  ACH_TOAST_EL=document.createElement('div');
  ACH_TOAST_EL.id='achToast';
  if(document.body&&document.body.appendChild) document.body.appendChild(ACH_TOAST_EL);
 }
 const box=ACH_TOAST_EL;
 box._achBusy=true;
 const bc=achPosMode()==='bc';
 try{ box.className=bc?'posBC':'posTR'; }catch(e){}   // 位置双形制 (同一 DOM 骨架, 纯 CSS 分形: posTR 右上竖卡滑入 / posBC 正下横匾升起)
 const prog=achProgText(def.kind);
 box.innerHTML='<div class="achTRibbon">'+_achT('成就已达成')+'</div>'
  +'<div class="achTBody"><div class="achTIco">🏆</div>'
  +'<div class="achTMain"><div class="achTName">'+_achT(def.name)+'</div>'
  +'<div class="achTDesc">'+_achT(def.desc||'')+'</div>'
  +(prog?'<div class="achTProg">'+prog+'</div>':'')
  +'</div></div>';
 if(box.classList){
  box.classList.remove('show');
  void (box.offsetWidth||0);   // 重排触发重播动画 (mkBanner 同款技巧)
  box.classList.add('show');
 }
 setTimeout(function(){
  if(box.classList) box.classList.remove('show');
  setTimeout(function(){ box._achBusy=false; achToastPump(); },400);
 },4200);
}

// ── 进度复核 (R1): 全部读既有状态位; 观战门只压"解锁", 进度数字照常披露 ──
function achEvaluate(){
 const c=ACH_CENSUS;
 if(!c) return;
 // 自刎归天 (R4): 自击不进 killfeed (die() 里 attacker!==this 门), 播报层拿不到自刎事件
 // ⇒ 只能轮询玩家尸检字段; deaths 变化=死亡边沿 (每局建账时同步基线, 跨局无陈旧边沿)。
 if(typeof player!=='undefined'&&player&&(player.deaths||0)!==_achLastDeaths){
  _achLastDeaths=(player.deaths||0);
  // ★2026-11-21 审计 B#30: 自刎判据补专用普查字段 _achNadeSelf (盖章点=下方 nadeExplode 观察钩, 判据=
  //   "炸死死者的这颗雷的归属者===死者本人") —— 与 killerSrc 解耦: killerSrc 是"最后一次开火"单值
  //   字段 (20-player 每枪覆盖 _src, die 时 killSrcLabel 转抄), 投雷后再开一枪旧判据读到枪名 = 假阴性
  //   (13-combat nadeExplode 的 2026-09-29 重盖章虽在爆炸结算前把 _src 刷回本弹标签, 但成就判据不该
  //   依赖这条单值转发链)。读后即清: 陈旧字段不得让之后任何一次普通死亡误触发; onFreshMatch 建账时
  //   同步清 (不跨局携带, 与 _achPilotBld 同款)。
  if(player.alive===false&&player.killerName==='你'&&player._achNadeSelf){ player._achNadeSelf=false; achUnlock('seppuku'); }
  if(player.alive===false&&player.killerName==='你'&&player.killerSrc==='手雷') achUnlock('seppuku');
  // 利库德集团最好的飞行员 (2026-11-14 用户令): 驾机撞楼而亡 —— 与自刎归天同族的事件制成就,
  // 轮询账摸不到"楼面撞击"这个瞬间事件, 由 16-aircraft die() 撞楼档在玩家死亡链上盖 _achPilotBld
  // 普查字段 (同一同步链: 字段与 deaths++ 同帧), 死亡边沿读到即解锁。读后即清: 陈旧字段不得让
  // 之后任何一次普通死亡误触发; startMatch 建账时同步清 (不跨局携带)。
  if(player._achPilotBld){ player._achPilotBld=false; achUnlock('likud_pilot'); }
 }
 // 可燃格烧尽: FUEL<=0.05 (与蔓延门的"无燃料"判据同阈值; 燃烧弹 FEXPIRE 强制清零路径同样命中)
 let burnCells=0;
 if(c.cells.length&&typeof FUEL!=='undefined'&&FUEL){
  for(let i=0;i<c.cells.length;i++){ if(FUEL[c.cells[i]]<=0.05) burnCells++; }
 }
 // 树 (tree/willow/palm/dead): 烧尽=charred(树冠火烧穿)‖dead(沉没消失, 被坦克推倒后沉掉也算了账);
 // 倒伏=fall(treeFall/floraTopple 的幂等门标记)‖dead‖!alive。
 let treeBurn=0,treeFell=0;
 for(let i=0;i<c.trees.length;i++){
  const tr=c.trees[i];
  if(tr.charred===true||tr.dead===true) treeBurn++;
  if(tr.fall!=null||tr.dead===true||tr.alive===false) treeFell++;
 }
 // 植被对象 (bush/fern/hedge/bamboo): vanishFlora 置 dead+!alive (烧尽/炸没/碾没三路同一收口)
 let floraDone=0;
 for(let i=0;i<c.flora.length;i++){ const r=c.flora[i]; if(r.dead===true||r.alive===false) floraDone++; }
 // 结构组 / 掩体 props / 油桶 / 铁丝网
 let structDone=0;
 for(let i=0;i<c.structs.length;i++){ if(c.structs[i].dead) structDone++; }
 let propDone=0;
 for(let i=0;i<c.props.length;i++){ if(c.props[i].dead) propDone++; }
 let barrelDone=0;
 for(let i=0;i<c.barrels.length;i++){ if(c.barrels[i].dead) barrelDone++; }
 let wireDone=0;
 for(let i=0;i<c.wires.length;i++){ if(c.wires[i].alive===false) wireDone++; }
 const burnTotal=c.cells.length+c.trees.length;
 const burnDone=burnCells+treeBurn;
 const destTotal=c.trees.length+c.flora.length+c.structs.length+c.props.length+c.barrels.length+c.wires.length;
 const destDone=treeFell+floraDone+structDone+propDone+barrelDone+wireDone;
 ACH_PROG={burn:{done:burnDone,total:burnTotal},trees:{fell:treeFell,burned:treeBurn,total:c.trees.length},dest:{done:destDone,total:destTotal}};
 // ── 四成就判据 (R4)。比夷陵之火还要好 = 夷陵之火判据 ∪ 全部可破坏物, 各分账空则豁免 (草丛-only 图也能达成) ──
 const burnOk=burnTotal>0&&burnDone===burnTotal;   // 夷陵之火: 账非空才判 (纯海战图无植被不弹)
 if(burnOk) achUnlock('yiling_fire');
 if(c.trees.length>0&&treeFell===c.trees.length) achUnlock('bear_king');
 const burnAll=burnDone===burnTotal;               // 比夷陵之火还要好: 空账豁免 (无植被图烧账天然满足)
 const fellAll=c.trees.length===0||treeFell===c.trees.length;
 const structAll=c.structs.length===0||structDone===c.structs.length;
 const floraAll=c.flora.length===0||floraDone===c.flora.length;
 const propAll=c.props.length===0||propDone===c.props.length;
 const barrelAll=c.barrels.length===0||barrelDone===c.barrels.length;
 const wireAll=c.wires.length===0||wireDone===c.wires.length;
 const grandTotal=burnTotal+c.flora.length+c.structs.length+c.props.length+c.barrels.length+c.wires.length;
 if(grandTotal>0&&burnAll&&fellAll&&structAll&&floraAll&&propAll&&barrelAll&&wireAll) achUnlock('better_yiling');
}

// ── 主循环 tick: 0.5s 节流; dt<=0 (时停/布势冻结) 不评 —— 世界冻结没有新事件 ──
function achTick(dt){
 if(!ACH_CENSUS||!(dt>0)) return;
 _achAcc+=dt;
 if(_achAcc<0.5) return;
 _achAcc=0;
 achEvaluate();
}

// ── 数据成就面板 (R9): 页签切换 + 成就列表渲染。全部防御式写法
//    (bootstub 桩无 getAttribute/部分无 querySelectorAll, 探针开面板不得炸)。 ──
function achSetPane(which){
 try{
  if(typeof document==='undefined'||!document.getElementById) return;
  const rec=document.getElementById('dataRecPane'), ach=document.getElementById('dataAchPane');
  if(rec&&rec.classList) rec.classList.toggle('hidden',which!=='rec');
  if(ach&&ach.classList) ach.classList.toggle('hidden',which!=='ach');
  const tabs=document.getElementById('dataTabs');
  if(tabs&&typeof tabs.querySelectorAll==='function'){
   const bs=tabs.querySelectorAll('.tab-btn');
   for(let i=0;i<bs.length;i++){
    const b=bs[i];
    if(!b||!b.classList) continue;
    const dt=b.getAttribute?b.getAttribute('data-dt'):null;
    b.classList.toggle('active',dt===which);
   }
  }
 }catch(e){}
}
function achRenderPanel(){
 try{
  if(typeof document==='undefined'||!document.getElementById) return;
  const box=document.getElementById('dataAchPane');
  if(!box) return;
  const total=ACH_DEFS.length;
  let done=0;
  for(let i=0;i<ACH_DEFS.length;i++){ if(ACH_STATE[ACH_DEFS[i].id]) done++; }
  let h='<div class="achSum">'+_achT('已达成 {0}/{1}',done,total)+'</div>';
  for(let i=0;i<ACH_DEFS.length;i++){
   const d=ACH_DEFS[i], got=!!ACH_STATE[d.id];
   let prog='';
   if(ACH_CENSUS) prog=achProgText(d.kind);   // 弹框/面板共用单源 (achProgText 自带 total>0 门)
   h+='<div class="achRow'+(got?' done':'')+'">'
     +'<div class="achIco">'+(got?'🏆':'🔒')+'</div>'
     +'<div class="achMain"><div class="achName">'+_achT(d.name)+'</div>'
     +'<div class="achDesc">'+_achT(d.desc)+'</div>'
     +(prog?'<div class="achProg">'+prog+'</div>':'')
     +'</div>'
     +'<div class="achState">'+_achT(got?'已达成':'未达成')+'</div>'
     +'</div>';
  }
  h+='<div class="achNote">'+_achT('成就一经达成永久保存')+'</div>';
  box.innerHTML=h;
 }catch(e){}
}
function achOnPanelShown(){
 // 页签按钮惰性接线 (首次打开时; 真浏览器 DOM 齐备, 桩环境静默跳过)
 try{
  if(typeof document!=='undefined'&&document.getElementById&&!_achTabsWired){
   const tabs=document.getElementById('dataTabs');
   if(tabs&&typeof tabs.querySelectorAll==='function'){
    const bs=tabs.querySelectorAll('.tab-btn');
    let wired=false;
    for(let i=0;i<bs.length;i++){
     const b=bs[i];
     if(!b||!b.addEventListener) continue;
     wired=true;
     b.addEventListener('click',function(){
      const w=(b.getAttribute)?b.getAttribute('data-dt'):null;
      if(w==='rec'||w==='ach'){ achSetPane(w); if(w==='ach') achRenderPanel(); }
     });
    }
    if(wired) _achTabsWired=true;
   }
  }
 }catch(e){}
 achSetPane('rec');   // 每次打开面板都回到默认页签 (战绩数据)
 achRenderPanel();
}

// ── 自刎普查账观察钩 (★2026-11-21 审计 B#30): "自己被**自己的手雷**炸死"这个事实轮询账摸不到 ——
//    尸检字段 killerName/killerSrc 只记"击杀者名"+"最后一次开火来源", killerSrc 是单值字段: 投雷后
//    开过一枪就被枪名覆盖 (20-player playerShoot 每枪写 _src; 18-game die 经 killSrcLabel 转抄)。与
//    _achPilotBld 同族走"事件结算点盖章 + 死亡边沿读后即清"。结算点 = 13-combat nadeExplode (手雷
//    击杀归因处 —— 2026-09-29 重盖章同一函数): 本钩**只读观察**不改爆炸行为 —— 爆炸结算前归属者
//    (thrower) 活着、结算后死了 ⇒ 同步链内"这颗雷炸死了本人"成立, 盖 player._achNadeSelf (判据=
//    炸死死者的这颗雷的归属者===死者本人, 与 killerSrc 完全解耦)。只认普通手雷 (frag: 排除 AT炸药/
//    航弹/迫击炮弹/烟雾/燃烧, 与旧 killerSrc==='手雷' 判据同宽 —— 后者原样保留, 探针钉区)。
//    dropHeldNade (2026-11-03 死亡掉雷契约雷) 与普通出手同走 frag 分支 = 两路一并覆盖。
//    typeof 守卫: 硬编码 FILES 清单不载 13-combat 的旧探针里钩自动不存在, 零回归 (R8 口径);
//    13-combat 先于本文件载入 (index.html :819/:847), 顶层 function 声明的全局绑定可再赋值,
//    唯一调用点 13-combat updateNades 按名解析 ⇒ 调用时必经本钩。
if(typeof nadeExplode==='function'){
 const _achNadeExplode0=nadeExplode;
 nadeExplode=function(n){
  const th=(n&&n.thrower&&n.thrower.isPlayer&&n.thrower.alive&&!(n.at||n.bomb||n.mortar||n.smokeN||n.incinN))?n.thrower:null;
  const r=_achNadeExplode0(n);
  if(th&&th.alive===false) th._achNadeSelf=true;   // 结算窗口内归属者死亡 = 被自己的这颗雷炸死 (27-achievements 死亡边沿读, 读后即清)
  return r;
 };
}

// ── 对外单源 (三处接线全部 typeof ACH 守卫; 探针经 census()/state()/defs() 直达内部账) ──
const ACH={
 update:achTick,                // 24-main 主循环: 0.5s 低频轮询
 onFreshMatch:achBuildCensus,   // 23-deploy startMatch: 开局普查建账
 onPanelShown:achOnPanelShown,  // 22-hud showPanel('mData'): 页签复位+成就列表渲染
 census:function(){ return ACH_CENSUS; },
 prog:function(){ return ACH_PROG; },
 state:function(){ return ACH_STATE; },
 defs:ACH_DEFS,
 resetAll:function(){ try{ for(const k in ACH_STATE) delete ACH_STATE[k]; for(const k in ACH_TOASTED) delete ACH_TOASTED[k]; localStorage.removeItem('sf_ach'); }catch(e){} },   // 清除游戏数据 (21-match clearGameData) 调: 内存账+弹框闩同步清+存档键移除 (重达成可再弹)
};
