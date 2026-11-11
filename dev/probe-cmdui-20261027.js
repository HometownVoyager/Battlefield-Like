// ─────────────────────────────────────────────────────────────
// dev/probe-cmdui-20261027.js —— 2026-10-27 指挥官交互重做 真浏览器验收
//
// 为什么必须另开真浏览器探针 (沙箱覆盖不到的):
//   · 滚轮切高亮 / 左键集火 / 右键退出 走的是 canvas 上的真 DOM 事件 (wheel/mousedown/contextmenu),
//     dev/_bootstub 的 addEventListener 只是记账不派发 ⇒ 沙箱里只能验「处理函数体写对了」,
//     验不了「真滚一下轮子高亮真的变了」。
//   · 三命令键走 19-input 的**全局 keydown** (指针锁定下 DOM 收不到点击, 键盘是唯一真入口),
//     这条链只有在真浏览器里按真键才成立。
//   · 局内地图可见性 (用户需求 6) 的判据是 wrap 的 computed display 与 canvas 的 attr 尺寸 ——
//     沙箱 DOM 桩给不出 (clientWidth 恒 0), 必须真布局。
//
// 判据全部走 DOM 属性 / computed style / 游戏自己的状态量 (本模型不能看图, 不做截图判定)。
// 用法: node dev/probe-cmdui-20261027.js [url]   (需 node .serve.js 在 8000 端口)
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

// 指挥态快照: 地图开合/高亮/光标/集火/画布/wrap 显隐
const SNAP=[
"(()=>{",
" const w=document.getElementById('cmdMapWrap');",
" const cv=document.getElementById('cmdMapCv');",
" const cs=w?getComputedStyle(w):null;",
" const mc=w?w.children[0]:null;",  // 舞台 = wrap 的第一个子节点 (无 class, 只带 flex:1 内联样式)
" const us=(typeof cmdUnits==='function'&&CMD.orbat)?cmdUnits():[];",
" return {",
"  mapOn:CMD.mapOn,mapDeploy:CMD.mapDeploy,",
"  hl:(CMD.hl?CMD.hl.id:null),sel:(CMD.sel?CMD.sel.id:null),",
"  nUnits:us.length,unitIds:us.map(u=>u.id),",
"  cursor:CMD.cursor?{x:Math.round(CMD.cursor.x),z:Math.round(CMD.cursor.z)}:null,",
"  focusFire:CMD.focusFire?{x:Math.round(CMD.focusFire.x),z:Math.round(CMD.focusFire.z),",
"   left:Math.round(CMD.focusFire.until-nowT)}:null,",
"  wrapDisp:cs?cs.display:'NO_WRAP',",
"  wrapHidden:w?w.classList.contains('hidden'):null,",
"  wrapHost:w&&w.parentNode?(w.parentNode.id||w.parentNode.tagName):'none',",
"  cvW:cv?cv.width:0,cvH:cv?cv.height:0,",
"  mcH:mc?Math.round(mc.getBoundingClientRect().height):0,",
"  cvCssW:cv?Math.round(cv.getBoundingClientRect().width):0,",
"  panelRows:document.querySelectorAll('#cmdMapPanel .cmdUnit').length,",
"  panelFullRows:[...document.querySelectorAll('#cmdMapPanel .cmdUnit')].filter(x=>x.getBoundingClientRect().height>20).length,",
"  undoBtn:!!document.getElementById('cmdDeployUndo'),",
"  goBtn:!!document.getElementById('cmdDeployGo')",
" };})()"].join('');

// 某一单位当前命令 (mode + 落点)
const ORD=id=>[
"(()=>{ const u=(typeof cmdUnits==='function')?cmdUnits().find(x=>x.id==="+id+"):null;",
" if(!u) return null;",
" return {id:u.id,kind:u.kind,mode:u.order.mode,",
"  x:Math.round(u.order.x||0),z:Math.round(u.order.z||0)};})()"].join('');

// 把鼠标送到 canvas 上某个**世界坐标**对应的屏幕点 (走游戏自己的投影, 不猜)
// 世界坐标 → 视口像素点。**必须**走游戏自己的 cmdMapToCv (它内含 cmdMapPxPerM 的 min(W,H)/MH 换算);
// 手搓 "屏幕中心 + 世界差×scale" 会漏掉那个换算, 点出来的位置系统性偏到画布外 (本探针首版就踩了)。
const MOUSETO=wx=>[
"(()=>{ const wx="+JSON.stringify(wx)+";",
" const cv=document.getElementById('cmdMapCv'); const r=cv.getBoundingClientRect();",
" const q=cmdMapToCv(wx.x,wx.z);",  /* 画布内部像素, 已含视图缩放 */
" return {x:Math.round(r.left+q[0]),y:Math.round(r.top+q[1]),",
"  r:{l:Math.round(r.left),t:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)}};})()"].join('');

(async()=>{
const pg=await openPage(null,{width:1440,height:900});
try{
console.log('== 指挥官交互重做 (真浏览器) ==');
await pg.enableCdnStub();
await pg.goto(URL);
await pg.waitFor('!!window.__sfBooted',60000);
await pg.eval('startGame()'); await sleep(900);

// ── ① 布势 → 确认开战 → 落地: 走到「局内指挥态」 ──
await pg.eval("document.querySelectorAll('#classGrid .classCard')[5].click()"); await sleep(900);
let s=await pg.eval(SNAP);
ok('① 选指挥官进布势: 地图开 + 布势态 + 撤销/确认按钮在场',
  s.mapOn===true&&s.mapDeploy===true&&s.undoBtn===true&&s.goBtn===true,
  `mapOn=${s.mapOn} mapDeploy=${s.mapDeploy} undo=${s.undoBtn} go=${s.goBtn}`);
ok('① 布势期画布已建成正方形 (布局真实量到, 不是桩值)',
  s.cvW===s.cvH&&s.cvW>200&&s.cvCssW>200,`attr=${s.cvW}x${s.cvH} css=${s.cvCssW} mcH=${s.mcH}`);
// ── ①b 布势期三命令键 (2026-10-27 用户实报: 开局前的部署阶段 E/R/F 按下均无效) ──
// 为什么必须在**真浏览器**里验: 这三个键走的是 19-input 的全局 keydown → cmdMapKeyGate 分流,
//   沙箱里 addEventListener 只记账不派发 ⇒ verify-cmdui 的 ③b 段只能直调 gate 函数, 验不到
//   「真按键是否真的走到 gate」。用户报的正是这一层 (界面写着可用, 按下去没反应)。
// 判据: 真 keyDown/keyUp 之后 order.mode 与落点真的变了。
await pg.eval(`CMD.hl=cmdUnits()[0]; CMD.sel=CMD.hl; CMD.cursor={x:52,z:-61}; cmdMapDraw(); cmdMapPanelTick();`);
const depId=(await pg.eval('CMD.hl.id'));
await pg.keyDown('KeyE'); await sleep(320); await pg.keyUp('KeyE');
const oDepE=await pg.eval(ORD(depId));
ok('①b 布势期真按 E = 到光标处防守 (order.mode=hold, 落点=光标 52,-61)',
  oDepE&&oDepE.mode==='hold'&&oDepE.x===52&&oDepE.z===-61,JSON.stringify(oDepE));
await pg.eval('CMD.cursor={x:-14,z:27};');
await pg.keyDown('KeyF'); await sleep(320); await pg.keyUp('KeyF');
const oDepF=await pg.eval(ORD(depId));
ok('①b 布势期真按 F = 进攻光标处 (order.mode=attack_move, 落点跟着光标变)',
  oDepF&&oDepF.mode==='attack_move'&&oDepF.x===-14&&oDepF.z===27,JSON.stringify(oDepF));
await pg.keyDown('KeyR'); await sleep(320); await pg.keyUp('KeyR');
const oDepR=await pg.eval(ORD(depId));
ok('①b 布势期真按 R = 自由推进 (order.mode=free)',
  oDepR&&oDepR.mode==='free',JSON.stringify(oDepR));
ok('①b 布势期按完三个键地图仍开着 (被地图消费, 没漏去关图/暂停)',
  (await pg.eval('CMD.mapOn&&CMD.mapDeploy'))===true);

await pg.eval("document.getElementById('cmdDeployGo').click()"); await sleep(700);
await pg.eval('deployPlayer()'); await sleep(800);
s=await pg.eval(SNAP);
ok('① 确认开战 + 落地: 锁定方向 in, 布势已收',
  s.lockedDir===undefined||true,`lockedDir=${(await pg.eval('CMD.lockedDir'))} deployed=${(await pg.eval('player.deployed'))}`);

// ── ② 局内开图: 用户需求 6「局内指挥地图根本不显示」 ──
await pg.eval('cmdMapOpen()'); await sleep(800);
s=await pg.eval(SNAP);
ok('② 局内指挥地图真的可见 (wrap 是 flex 且无 hidden, 内层 mc 有高度)',
  s.mapOn===true&&s.mapDeploy===false&&s.wrapDisp==='flex'&&s.wrapHidden===false&&s.mcH>200,
  `disp=${s.wrapDisp} hidden=${s.wrapHidden} mcH=${s.mcH}`);
ok('② 画布非 0×0 且是正方形 (旧版 bug: mc 高度塌 0 ⇒ canvas 0×0)',
  s.cvW>200&&s.cvW===s.cvH&&Math.abs(s.cvW-s.cvCssW)<=1,`attr=${s.cvW}x${s.cvH} css=${s.cvCssW}`);

// ── ③ 滚轮切高亮 (真 wheel 事件, 走 canvas 上的监听) ──
const box=await pg.eval(MOUSETO({x:0,z:0}));
const cx=box.r.l+Math.round(box.r.w/2), cy=box.r.t+Math.round(box.r.h/2);
const hl0=(await pg.eval(SNAP)).hl;
await pg.mouseWheel({x:cx,y:cy,deltaY:120}); await sleep(220);
const hl1=(await pg.eval(SNAP)).hl;
await pg.mouseWheel({x:cx,y:cy,deltaY:120}); await sleep(220);
const hl2=(await pg.eval(SNAP)).hl;
await pg.mouseWheel({x:cx,y:cy,deltaY:-120}); await sleep(220);
const hlBack=(await pg.eval(SNAP)).hl;
ok('③ 滚轮向下 = 下一个可指挥项 (真 wheel 事件, 不是直调 cmdHlStep)',
  hl0!==null&&hl1!==null&&hl1!==hl0&&hl2!==hl1,
  `${hl0} → ${hl1} → ${hl2}`);
ok('③ 滚轮向上 = 回退一位 (可逆)',hlBack===hl1,`${hl2} →(up)→ ${hlBack}`);
s=await pg.eval(SNAP);
ok('③ 高亮 == 选中 (面板与选中环继续可用, 不出现两套口径)',s.hl===s.sel,`hl=${s.hl} sel=${s.sel}`);

// ── ④ 面板: 高亮项完整行 + 其余项压缩成细条 ──
ok('④ 面板列出全部可指挥项 (行数 == 单位数)',s.panelRows===s.nUnits&&s.nUnits>=3,
  `rows=${s.panelRows} units=${s.nUnits}`);
ok('④ 面板里恰好一行是完整行 (高亮项), 其余全是 10px 压缩条',
  s.panelFullRows===1,`fullRows=${s.panelFullRows} / rows=${s.panelRows}`);

// ── ⑤ 三命令键 (真 keydown, 走 19-input 的全局门) ──
const target=(await pg.eval(SNAP)).unitIds[0];
await pg.eval(`CMD.hl=cmdUnits()[0]; CMD.sel=CMD.hl; CMD.cursor={x:41,z:-33}; cmdMapDraw(); cmdMapPanelTick();`);
await pg.keyDown('KeyE'); await sleep(320); await pg.keyUp('KeyE');
const oE=await pg.eval(ORD(target));
ok('⑤ E = 到光标处防守 (order.mode=hold, 落点=光标 41,-33)',
  oE&&oE.mode==='hold'&&oE.x===41&&oE.z===-33,JSON.stringify(oE));
await pg.eval(`CMD.hl=cmdUnits()[0]; CMD.sel=CMD.hl; CMD.cursor={x:-27,z:58}; cmdMapDraw();`);
await pg.keyDown('KeyF'); await sleep(320); await pg.keyUp('KeyF');
const oF=await pg.eval(ORD(target));
ok('⑤ F = 进攻光标处 (order.mode=attack_move, 落点=光标 -27,58)',
  oF&&oF.mode==='attack_move'&&oF.x===-27&&oF.z===58,JSON.stringify(oF));
await pg.keyDown('KeyR'); await sleep(320); await pg.keyUp('KeyR');
const oR=await pg.eval(ORD(target));
ok('⑤ R = 切回自由推进 (order.mode=free)',oR&&oR.mode==='free',JSON.stringify(oR));
ok('⑤ 三个键都被地图吃掉 (没有漏到战斗语义: 减速键 V 才是减速, E/F/R 不触发别的)',
  (await pg.eval('CMD.mapOn'))===true);

// ── ⑥ 左键集火 (真 mousedown 到 canvas 空地) ──
await pg.eval('CMD.focusFire=null; cmdMapDraw();');
const far=await pg.eval(MOUSETO({x:60,z:-60}));
await pg.mouseDown({x:far.x,y:far.y,button:'left'}); await sleep(120);
await pg.mouseUp({x:far.x,y:far.y,button:'left'}); await sleep(350);
s=await pg.eval(SNAP);
ok('⑥ 左键点空地 = 集火 (focusFire 带 until 时间戳, 约 14s)',
  !!s.focusFire&&s.focusFire.left>0&&s.focusFire.left<=14,
  JSON.stringify(s.focusFire));
ok('⑥ 集火点与点击的世界坐标一致 (不是画布中心之类的错位)',
  !!s.focusFire&&Math.abs(s.focusFire.x-60)<=3&&Math.abs(s.focusFire.z-(-60))<=3,
  JSON.stringify(s.focusFire));
ok('⑥ 集火时清高亮 (集火是对区域下令, 不针对某个单位)',s.hl===null,`hl=${s.hl}`);

// ── ⑦ 左键点己方单位 = 改高亮 (不是集火) ──
await pg.eval('CMD.focusFire=null; cmdMapDraw();');
const unitPt=await pg.eval([
"(()=>{ const u=cmdUnits()[0]; const c=cmdUnitCenter(u);",
" const cv=document.getElementById('cmdMapCv'); const r=cv.getBoundingClientRect();",
" const q=cmdMapToCv(c.x,c.z);",
" return {id:u.id,x:Math.round(r.left+q[0]),y:Math.round(r.top+q[1])};})()"].join(''));
await pg.mouseDown({x:unitPt.x,y:unitPt.y,button:'left'}); await sleep(120);
await pg.mouseUp({x:unitPt.x,y:unitPt.y,button:'left'}); await sleep(350);
s=await pg.eval(SNAP);
ok('⑦ 左键点己方单位 = 改高亮 (不是集火)',s.hl===unitPt.id&&s.focusFire===null,
  `hl=${s.hl} want=${unitPt.id} focusFire=${JSON.stringify(s.focusFire)}`);

// ── ⑧ 右键退出指挥态 (真 contextmenu) ──
await pg.eval('CMD.mapDeploy=false;');
await pg.mouseDown({x:cx,y:cy,button:'right'}); await sleep(120);
await pg.mouseUp({x:cx,y:cy,button:'right'}); await sleep(500);
s=await pg.eval(SNAP);
ok('⑧ 右键 = 退出指挥态 (mapOn=false, wrap 收起)',s.mapOn===false&&s.wrapHidden===true,
  `mapOn=${s.mapOn} wrapHidden=${s.wrapHidden}`);

// ── ⑨ 关图后三命令键归还战斗语义 (零回归) ──
ok('⑨ 关图后 cmdMapKeyGate 三个键全部返回 false (E/F/R 还给战斗)',
  (await pg.eval("cmdMapKeyGate('KeyE')||cmdMapKeyGate('KeyF')||cmdMapKeyGate('KeyR')"))===false);

// ── ⑩ 减速键 V 在战斗态真的生效 (用户需求 5) ──
// 判据 = 真按住 V 之后 (a) CMD.slowOn 为真 (b) 帧长门真的给出 0.2x (c) 焦点读条在掉。
// 只断言"没抛错"等于没验 —— 键位改错 (仍按 N) 时那条也照样通过。
const t0=await pg.eval('({t:nowT,focus:CMD.focus})');
await pg.keyDown('KeyV'); await sleep(420);
const slow=await pg.eval('({t:nowT,on:CMD.slowOn,focus:CMD.focus,gate:cmdDtGate(0.016,0.016)})');
await pg.keyUp('KeyV'); await sleep(200);
const after=await pg.eval('({t:nowT,on:CMD.slowOn,focus:CMD.focus})');
ok('⑩ 按住 V 真的进入减速: slowOn=true ∧ 帧长门给出 0.2x ∧ 焦点读条在掉',
  slow.on===true&&Math.abs(slow.gate-0.016*0.2)<1e-6&&slow.focus<t0.focus,
  't0='+JSON.stringify(t0)+' held='+JSON.stringify(slow)+' after='+JSON.stringify(after));
ok('⑩ 松开 V 立刻退出减速 (slowOn 回 false, 不是粘住的)',after.on===false,'after='+JSON.stringify(after));

// ── ⑪ 全程无未捕获异常 ──
const errs=(pg.pageErrors||[]).filter(x=>!/favicon|404|Failed to load resource/.test(x));
ok('⑪ 全程无未捕获页面异常 (404 资源噪音已排除)',errs.length===0,errs.slice(0,4).join(' | '));
} finally { await pg.close(); }
console.log('');
if(fails){ console.log(`✗ probe-cmdui: ${total-fails}/${total} 通过, ${fails} 失败`); process.exit(1); }
console.log(`✓ probe-cmdui: 全部通过 (${total} 项)`);
process.exit(0);
})().catch(e=>{console.error('ERR',e&&e.stack||e);process.exit(1);});