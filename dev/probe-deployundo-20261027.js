// ─────────────────────────────────────────────────────────────
// dev/probe-deployundo-20261027.js —— 2026-10-27 布势撤销 / 确认后兵种锁定 真浏览器验收
//
// 为什么必须另开真浏览器探针 (沙箱探针覆盖不到的东西):
//   · dev/_bootstub 的 querySelectorAll 恒返回 [] 且 classList.contains 恒 false ⇒ 「兵种卡是否真的
//     画上了 locked 样式」「地图 wrap 是否真的隐藏」「部署页是否真的可见」在沙箱里断言不了
//     (verify-deployundo-20261027.js 的 ⑦ 段只能验到「判据输入正确 + 函数不抛」);
//   · 本批的核心交付是样式与状态一致: 确认开战后卡片必须立刻变灰带🔒, 撤销后必须立刻变回可点。
//     这类「看得见」的事实只有真 DOM 能给答案。
//
// 判据全部走 DOM 属性与 computed style (本模型不能看图, 不做像素/截图判定):
//   className / getComputedStyle(card).opacity / cursor / .lock-icon 的 display / #deploy 的 hidden 类 /
//   #cmdMapWrap 的 parentNode 与 classList —— 都是可断言的确定事实。
//
// 用法: node dev/probe-deployundo-20261027.js [url]   (需 node .serve.js 在 8000 端口)
// ─────────────────────────────────────────────────────────────
'use strict';
const {openPage,sleep}=require('./cdp');
const URL=process.argv[2]||'http://127.0.0.1:8000/index.html';

let fails=0,total=0;
function ok(label,cond,detail){
total++; if(!cond) fails++;
console.log((cond?'  [PASS] ':'  [FAIL] ')+label+(detail?'\n         '+detail:''));
return cond;
}

// 兵种卡事实: class / 不透明度 / 光标 / 锁图标 display / title
const CARDS=[
"(()=>[...document.querySelectorAll('#classGrid .classCard')].map(c=>{",
" const li=c.querySelector('.lock-icon');",
" return {cls:c.className,op:getComputedStyle(c).opacity,cur:getComputedStyle(c).cursor,",
"  lock:li?getComputedStyle(li).display:'none',title:c.getAttribute('title')||''};",
"}))()"].join('');

// 全局快照: 布势/部署页/锁定方向/宿主/门判据
const SNAP=[
"(()=>{",
" const dep=document.getElementById('deploy');",
" const w=document.getElementById('cmdMapWrap');",
" return {",
"  lockedDir:(typeof CMD!=='undefined')?CMD.lockedDir:'NO_CMD',",
"  mapOn:(typeof CMD!=='undefined')?CMD.mapOn:null,",
"  mapDeploy:(typeof CMD!=='undefined')?CMD.mapDeploy:null,",
"  cls:player.cls, deployed:!!player.deployed, alive:!!player.alive,",
"  depHidden:dep?dep.classList.contains('hidden'):null,",
"  wrapHidden:w?w.classList.contains('hidden'):null,",
"  wrapHost:w&&w.parentNode?(w.parentNode.id||w.parentNode.tagName):null,",
"  undoBtn:!!document.getElementById('cmdDeployUndo'),",
"  goBtn:!!document.getElementById('cmdDeployGo'),",
"  gate0:(typeof cmdClassCardGate==='function')?cmdClassCardGate(0):'NO_FN',",
"  gate5:(typeof cmdClassCardGate==='function')?cmdClassCardGate(5):'NO_FN',",
" };})()"].join('');

// 一组配比 (期望值 + 成员实际 cls 分布)
const RATIO=[
"(()=>{ const s=CMD.orbat&&CMD.orbat.squads[0]; if(!s) return null;",
" const act=[0,0,0,0,0]; for(const b of s.members){ const ci=(b&&typeof b.cls==='number'&&b.cls>=0&&b.cls<5)?(b.cls|0):-1; if(ci>=0) act[ci]++; }",
" return {want:cmdRatioOf(s).slice(),act}; })()"].join('');
(async()=>{
const pg=await openPage(null,{width:1280,height:720});
try{
console.log('== 布势撤销 + 确认后兵种锁定 (真浏览器) ==');
await pg.enableCdnStub();
await pg.goto(URL);
await pg.waitFor('!!window.__sfBooted',60000);
await pg.eval('startGame()'); await sleep(900);

// ── ① 开局: 部署页 + 6 张卡全可选 ──
let s=await pg.eval(SNAP), c=await pg.eval(CARDS);
ok('① 开局在部署页, 未落地未盖章',s.depHidden===false&&s.deployed===false&&s.lockedDir===null,
  `depHidden=${s.depHidden} deployed=${s.deployed} lockedDir=${s.lockedDir}`);
ok('① 六张兵种卡 (含指挥官) 全部可点: 无 locked 类 / opacity=1 / 无锁图标',
  c.length===6&&c.every(x=>!/locked/.test(x.cls)&&x.op==='1'&&x.lock==='none'),
  JSON.stringify(c.map(x=>[x.cls,x.op,x.lock])));

// ── ② 点指挥官卡 → 布势地图弹出 (body 宿主) + 撤销按钮在场 ──
await pg.eval("document.querySelectorAll('#classGrid .classCard')[5].click()"); await sleep(900);
s=await pg.eval(SNAP);
ok('② 点指挥官卡进布势: mapOn+mapDeploy, 宿主=body, 撤销/确认按钮都在',
  s.mapOn===true&&s.mapDeploy===true&&s.wrapHost==='BODY'&&s.undoBtn===true&&s.goBtn===true,
  `mapOn=${s.mapOn} mapDeploy=${s.mapDeploy} host=${s.wrapHost} undo=${s.undoBtn} go=${s.goBtn}`);
ok('② 布势期地图真的可见 (wrap 无 hidden 类)',s.wrapHidden===false,`wrapHidden=${s.wrapHidden}`);

// ── ③ 改一组配比 (真点按钮, 走 26-commander 的接线) ──
// 注意: cmdRatioAdj 的 ＋ 有「合计满员就拒绝」的门 (配比是人数分配, 总数守恒), 所以直接点 ＋ 在满员组上
// 是**正确地什么都不做** (不是按钮没接上)。要必然改变分布, 序列必须是 −1 再 +1 (把 1 类的人挪给 0 类)。
const rBefore=await pg.eval(RATIO);
// 动态挑按钮: − 必须点在一个**有人**的兵种上 (cur[ci]<=0 时 cmdRatioAdj 正确地拒绝),
// + 点在另一个兵种上 —— 这样序列必然改变分布, 且不依赖开局随机出的具体兵种构成。
const clicked=await pg.eval([
  "(()=>{",
  " const s=CMD.orbat&&CMD.orbat.squads[0]; if(!s) return {ok:false,why:'no squad'};",
  " const cur=cmdRatioOf(s);",
  " const from=cur.findIndex(v=>v>0); if(from<0) return {ok:false,why:'all empty'};",
  " const to=cur.findIndex((v,i)=>i!==from); if(to<0) return {ok:false,why:'no target'};",
  " const q=(ci,d)=>document.querySelector('.cmdRat[data-sq=\"0\"][data-ci=\"'+ci+'\"][data-d=\"'+d+'\"]');",
  " const a=q(from,-1), b=q(to,1);",
  " if(!a||!b) return {ok:false,why:'button missing',from,to};",
  " a.click(); b.click(); return {ok:true,from,to,cur:cur.slice()}; })()"].join(''));
await sleep(500);
const rAfter=await pg.eval(RATIO);
ok('③ 布势配比 −/+ 按钮真生效 (真 DOM 点击, 不是直调函数)',
  clicked.ok===true&&!!rBefore&&!!rAfter&&JSON.stringify(rBefore.want)!==JSON.stringify(rAfter.want),
  `click=${JSON.stringify(clicked)} before=${JSON.stringify(rBefore&&rBefore.want)} after=${JSON.stringify(rAfter&&rAfter.want)}`);
ok('③ 配比合计守恒 (改配比只挪人, 不增不减)',
  !!rAfter&&rAfter.want.reduce((a,b)=>a+b,0)===rBefore.want.reduce((a,b)=>a+b,0),
  `${JSON.stringify(rBefore&&rBefore.want)} → ${JSON.stringify(rAfter&&rAfter.want)}`);

// ── ④ 点「↩ 撤销布势 (重选兵种)」: 五份账全归位 + 卡片全解锁 ──
await pg.eval("document.getElementById('cmdDeployUndo').click()"); await sleep(700);
s=await pg.eval(SNAP); c=await pg.eval(CARDS);
const rUndo=await pg.eval(RATIO);
ok('④ 撤销后: 布势收图 ∧ 未落地 ∧ 锁定方向回 null',
  s.mapOn===false&&s.mapDeploy===false&&s.deployed===false&&s.lockedDir===null,
  `mapOn=${s.mapOn} mapDeploy=${s.mapDeploy} deployed=${s.deployed} lockedDir=${s.lockedDir}`);
ok('④ 撤销后部署页回来 (仍可见, 不是只剩 3D 画面)',s.depHidden===false,`depHidden=${s.depHidden}`);
ok('④ 撤销后地图宿主搬回 #ui 且 wrap 隐藏 (不滞留 body)',
  s.wrapHost==='ui'&&s.wrapHidden===true,`host=${s.wrapHost} wrapHidden=${s.wrapHidden}`);
ok('④ 撤销后六张卡全部重新可选 (真 DOM: 无 locked 类 / opacity=1 / 锁图标收起)',
  c.length===6&&c.every(x=>!/locked/.test(x.cls)&&x.op==='1'&&x.lock==='none'),
  JSON.stringify(c.map(x=>[x.cls,x.op,x.lock])));
ok('④ 撤销后配比按当前实际 cls 复位 (期望值 == 实际分布)',
  !!rUndo&&rUndo.want.every((v,i)=>v===rUndo.act[i]),JSON.stringify(rUndo));
// ── ⑤ 撤销后重选兵种 2 (真点卡) ──
await pg.eval("document.querySelectorAll('#classGrid .classCard')[2].click()"); await sleep(300);
s=await pg.eval(SNAP);
ok('⑤ 撤销后真能重选兵种: 点卡 2 ⇒ player.cls=2 (门放行, 不是弹「已锁定」)',
  s.cls===2,`cls=${s.cls} gate0=${s.gate0}`);

// ── ⑥ 重选指挥官 → 确认开战: 盖章 'in' + 卡片立刻变灰带锁 (本批核心交付) ──
await pg.eval("document.querySelectorAll('#classGrid .classCard')[5].click()"); await sleep(800);
await pg.eval("document.getElementById('cmdDeployGo').click()"); await sleep(700);
s=await pg.eval(SNAP); c=await pg.eval(CARDS);
ok('⑥ 确认开战即盖章 (lockedDir=in, 人还没落地)',s.lockedDir==='in'&&s.deployed===false,
  `lockedDir=${s.lockedDir} deployed=${s.deployed}`);
ok('⑥ 确认后不重建部署页也立刻刷新卡样式: 0~4 卡带 locked + opacity<1 + 锁图标显示',
  c.slice(0,5).every(x=>/locked/.test(x.cls)&&x.op!=='1'&&x.lock!=='none'),
  JSON.stringify(c.map(x=>[x.cls,x.op,x.lock])));
ok('⑥ 确认后指挥官卡自身仍可选 (可重进布势调布局): 无 locked / opacity=1',
  !/locked/.test(c[5].cls)&&c[5].op==='1',JSON.stringify(c[5]));
ok('⑥ 确认后卡 title 带禁选原因 (玩家能读到为什么灰)',
  c[0].title.indexOf('本局已锁定指挥官')>=0,`title[0]=${c[0].title}`);
ok('⑥ 确认后门判据与样式一致: gate(0) 非 null ∧ 卡 0 已灰',
  s.gate0!==null&&/locked/.test(c[0].cls),`gate0=${s.gate0}`);

// ── ⑦ 真点被锁的卡: 兵种不变 + 弹出禁选原因 ──
await pg.eval("document.querySelectorAll('#classGrid .classCard')[0].click()"); await sleep(250);
s=await pg.eval(SNAP);
const pop=await pg.eval("document.getElementById('scorePop').textContent");
ok('⑦ 点被锁的步兵卡: player.cls 不变 (仍是 5) 且弹「指挥官: 本局已锁定指挥官」',
  s.cls===5&&pop.indexOf('本局已锁定指挥官')>=0,`cls=${s.cls} pop=${pop}`);

// ── ⑧ 落地后再开部署页: 卡仍锁 (整局双向锁跨落地/死亡) ──
await pg.eval('deployPlayer()'); await sleep(600);
s=await pg.eval(SNAP);
ok('⑧ 落地后锁定方向不变 (lockedDir=in, deployed=true)',
  s.lockedDir==='in'&&s.deployed===true,`lockedDir=${s.lockedDir} deployed=${s.deployed}`);
await pg.eval('showDeploy(false)'); await sleep(700);
c=await pg.eval(CARDS);
ok('⑧ 落地后重开部署页: 卡仍锁 (Esc→部署页 这条曾能改兵种的路径已堵)',
  c.slice(0,5).every(x=>/locked/.test(x.cls)),JSON.stringify(c.map(x=>x.cls)));

// ── ⑨ 撤销入口只属于布势面板 ──
// 说明: #cmdMapPanel 是懒重建的 (cmdMapPanelTick 按 2Hz 重写 innerHTML), 关图后残留的旧 DOM 节点会一直
// 挂着直到下次重建 —— 所以「页面里存不存在 #cmdDeployUndo」不是有效判据; 有效判据是**面板重建后**它消失。
await pg.eval('cmdMapOpen()'); await sleep(700);
const cp=await pg.eval([
  "(()=>({mapOn:CMD.mapOn,mapDeploy:CMD.mapDeploy,",
  "  undoBtn:!!document.getElementById('cmdDeployUndo'),",
  "  goBtn:!!document.getElementById('cmdDeployGo')}))()"].join(''));
ok('⑨ 战斗期指挥地图 (非布势) 的面板里没有撤销/确认按钮 (它们只属于布势面板)',
  cp.mapOn===true&&cp.mapDeploy===false&&cp.undoBtn===false&&cp.goBtn===false,
  JSON.stringify(cp));
await pg.eval('cmdMapClose(false)'); await sleep(300);

// ── ⑩ 全程无未捕获异常 ──
const errs=(pg.pageErrors||[]).filter(x=>!/favicon|404|Failed to load resource/.test(x));
ok('⑩ 全程无未捕获页面异常 (404 资源噪音已排除)',errs.length===0,errs.slice(0,4).join(' | '));

console.log('== 小结: '+(total-fails)+'/'+total+' 通过 ==');
process.exitCode=fails?1:0;
}catch(e){
console.error('[探针异常] '+e.message);
pg.pageErrors.slice(0,8).forEach(x=>console.error('   '+x));
process.exitCode=2;
}finally{ await pg.close(); }
})();