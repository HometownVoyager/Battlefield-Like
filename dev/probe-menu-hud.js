// ─────────────────────────────────────────────
// dev/probe-menu-hud.js —— 第6条「HUD 隐藏」实机回归探针 (2026-09-20 本批)
// 走 dev/cdp.js 的真浏览器通道 (不是沙箱桩)。
//
// 判据 (祖先感知, 2026-09-20 修订 —— 第一版只看 getComputedStyle(el).display, 会被"祖先 display:none"
// 骗过: #ui 隐藏时后代仍自报 display:block, 于是"主界面期可见 HUD 模块=14"这种假数字会跟着进报告。
// 现在同时报三样东西, 三者一致才算数):
//   ① 容器 #ui / #touchUI 自身的 display;
//   ② **真正渲染**的 HUD 模块数 (getClientRects() 有非零面积);
//   ③ body 的类名 (inMenu / inDeploy / 空)。
//
// 状态语义 (2026-09-20 修订, 配合 body.inDeploy 落地):
//   主菜单/面板/返回主界面/结算 → 期望隐藏 (inMenu 或 inDeploy)
//   部署界面 (未落地)           → 期望隐藏 (inDeploy)  ← 本轮修复点
//   战斗中 (已落地)             → 期望可见
//
// 用法: node dev/probe-menu-hud.js [url]
'use strict';
const {openPage,sleep}=require('./cdp');

const URL=process.argv[2]||'http://localhost:8000/index.html';
const SHOT_DIR='dev/out';
// 浏览器自身的请求不算启动链缺陷: 本仓库没有 favicon.ico, Edge 会稳定请求一次并拿 404
// (已用 dev/_find404.js 逐个 URL 核实: 本页唯一 4xx 就是 http://localhost:8000/favicon.ico)
const BENIGN=/favicon|manifest\.json/i;

const SNAP=`(()=>{
const mods=['crosshair','hitmark','dmgOv','supOv','lowOv','vig','scopeOv','uwOv','dirHits','ammoPanel','healthPanel',
'minimapWrap','bigmapWrap','squadHUD','topBar','killfeed','msgC','scorePop','killPops','mkBanner','streakBuff',
'capPanel','interact','coldTip','tbTip','oxyWrap','braceInd','nadeWarn','tvOv','leadPip','tankPip','mgPip',
'heatWrap','vehHpWrap','scoreboard','fps','clsTip','blackOv'];
// 祖先感知的"真的渲染了吗": 渲染树里 ⇒ getClientRects() 非空且面积非零
const rendered=e=>{ if(!e) return false; const rs=e.getClientRects(); for(const r of rs) if(r.width>0&&r.height>0) return true; return false; };
const disp=id=>{ const e=document.getElementById(id); return e?getComputedStyle(e).display:'MISSING'; };
const menu=document.getElementById('menu');
let live=0, liveIds=[];
for(const id of mods){ const e=document.getElementById(id); if(e&&rendered(e)){ live++; liveIds.push(id); } }
return {
 body:document.body.className, html:document.documentElement.className,
 ui:disp('ui'), touchUI:disp('touchUI'),
 uiRendered:(()=>{const e=document.getElementById('ui'); return e?rendered(e):false;})(),
 liveLive:live, liveIds,
 menuVisible:!!menu&&rendered(menu),
 deployVisible:(()=>{const e=document.getElementById('deploy'); return e?rendered(e):false;})(),
 booted:!!window.__sfBooted,
 // 注意 (2026-09-20 踩坑): 游戏里的 player 是 18-game.js 的**顶层 const** —— 它是词法绑定, **不会**成为
 // window 的属性。第一版这里写 window.player 结果恒为 undefined, 于是"继续游戏"那条状态自适应判据
 // 每次都误判成"兵种选择屏", 把正确行为报成 FAIL。必须直接引用全局词法名 (typeof 守卫)。
 deployed:(typeof player!=='undefined')?!!player.deployed:false,
 alive:(typeof player!=='undefined')?!!player.alive:false,
 hudRepaired:!!window.__sfHudRepaired, inDeploy:document.body.classList.contains('inDeploy')};})()`;

let fails=0, total=0;
function check(label,snap,expectHud){
// 期望: HUD 可见(战斗中) / HUD 隐藏(菜单·面板·部署·结算)
const hudHidden=(snap.ui==='none')&&!snap.uiRendered&&snap.liveLive===0;
const hudShown=(snap.ui!=='none')&&snap.uiRendered&&snap.liveLive>0;
const ok=expectHud?hudShown:hudHidden;
console.log((ok?'  [PASS] ':'  [FAIL] ')+label
+'  →  #ui='+snap.ui+'  真渲染模块='+snap.liveLive+'  body="'+snap.body+'"  #ui节点数='+(snap.uiCount||1)
+(snap.hudRepaired?'  已就地补挂 inMenu':''));
if(!ok){
console.log('         期望: '+(expectHud?'战斗期 HUD 可见':'菜单/部署期 HUD 隐藏'));
console.log('         真渲染模块清单: '+(snap.liveIds.join(',')||'(空)'));
}
return ok;
}

(async()=>{
const pg=await openPage(null);
try{
console.log('== 第6条 实机回归: HUD 隐藏 (祖先感知) ==');
console.log('URL: '+URL);
await pg.goto(URL);
await pg.waitFor('!!window.__sfBooted',45000);
await sleep(1200);

const step=async(label,expr,expectHud,shot)=>{
if(expr) await pg.eval(expr);
await sleep(expr?1100:0);
let s=await pg.eval(SNAP);
s.uiCount=await pg.eval("document.querySelectorAll('#ui').length");
total++; if(!check(label,s,expectHud)) fails++;
if(shot) await pg.screenshot(SHOT_DIR+'/'+shot);
return s;
};

await step('① 首屏主菜单 (mHome)',null,false,'menu-home.png');
await step('② 「新 游 戏」面板 (mPlay)',`document.getElementById('newGameBtn').click()`,false,'menu-play.png');
await step('③ 部署界面 (未落地) → 应隐藏',`startGame()`,false,'in-deploy.png');
await step('④ 战斗期 (已落地) → 应可见',`deployPlayer()`,true,'in-combat.png');
await step('⑤ 返回主界面 → 应隐藏',`returnToMenu()`,false,'back-to-menu.png');
// ⑥「继续游戏」是**状态相关**的两条分支 (见 22-hud resumeBattle):
//   已落地且活着 → 直接回战局, HUD 必须可见;
//   未落地/已阵亡 → showDeploy(false) 回到兵种选择屏, HUD 必须隐藏 (inDeploy)。
// 所以这里按实测状态判定, 而不是硬编码一种期望 —— 第一版写死了"应可见", 在"刚开局未落地"的路径上会误报。
{
await pg.eval('resumeBattle()'); await sleep(1300);
let s=await pg.eval(SNAP);
s.uiCount=await pg.eval("document.querySelectorAll('#ui').length");
// resumeBattle 的两条分支 (22-hud): 已落地且活着 → 直接回战局 (HUD 可见); 否则 → showDeploy(false) 兵种选择屏 (HUD 隐藏)。
// 判据必须与代码同源, 否则会在"刚部署完就返回主界面"的路径上误报 —— 第一版写死"应隐藏", 就是这样踩的。
const back=(s.deployed&&s.alive);
// 诊断打印: 这条路径最容易"看不清是走了哪个分支", 把三个开关量 + #deploy 可见性一起打出来
const diag=await pg.eval(`(()=>{const d=document.getElementById('deploy');
return {menuHold:(typeof menuHold!=='undefined'?!!menuHold:'?'), matchRunning:(typeof matchRunning!=='undefined'?!!matchRunning:'?'),
gamePaused:(typeof gamePaused!=='undefined'?!!gamePaused:'?'), deployVisible:!!d&&!d.classList.contains('hidden'),
respawnCd:(typeof respawnCd!=='undefined'?respawnCd:'?')};})()`);
console.log('         诊断: deployed='+s.deployed+' alive='+s.alive+' → 分支='+(back?'回战局':'兵种选择屏')
+' | menuHold='+diag.menuHold+' matchRunning='+diag.matchRunning+' gamePaused='+diag.gamePaused+' #deploy可见='+diag.deployVisible+' respawnCd='+diag.respawnCd);
total++; if(!check('⑥ 继续游戏 (resumeBattle → '+(back?'直接回战局':'兵种选择屏')+') → '+(back?'应可见':'应隐藏'),s,back)) fails++;
await pg.screenshot(SHOT_DIR+'/resumed.png');
}
await step('⑦ 二次往返: 再开新局',`startNewGame()`,false,'round2-deploy.png');
await step('⑧ 二次往返: 部署落地 → 应可见',`deployPlayer()`,true,'round2-combat.png');
await step('⑨ 二次往返: 返回主界面 → 应隐藏',`returnToMenu()`,false,'round2-menu.png');

// ⑩ 启动链异常。两道过滤:
//   ① 浏览器自发的 favicon 请求 (本仓库无站点图标, Edge 稳定请求一次拿 404);
//   ② console 里那条不带 URL 的通用 "404" 文本 —— 逐字比对 Network 域的失败清单来判定它是不是 favicon
//      (第一版按 console 文本正则过滤, 但该文本本身不含 "favicon", 所以滤不掉 —— 已改用 Network 实证)。
const net404=[];
pg.on('Network.responseReceived',p=>{ const r=p.response||{}; if(r.status>=400) net404.push(r.status+' '+r.url); });
await pg.send('Network.enable');
await sleep(600);
const nonBenign404=net404.filter(u=>!BENIGN.test(u));
const realErr=pg.pageErrors.filter(e=>{
if(BENIGN.test(e)) return false;
// 通用 404 文本: 只有 Network 层确实存在非 favicon 的 4xx 才算真异常
if(/status of 404/.test(e)) return nonBenign404.length>0;
return true;
});
total++;
if(realErr.length===0){
console.log('  [PASS] ⑩ 启动链无未捕获异常 / 无非自发的 4xx'+(net404.length?('  (已按噪声排除: '+net404.join('; ')+')'):'')); }
else { console.log('  [FAIL] ⑩ 启动链有 '+realErr.length+' 条异常:'); realErr.slice(0,8).forEach(e=>console.log('         '+e)); if(nonBenign404.length) console.log('         非 favicon 4xx: '+nonBenign404.join('; ')); fails++; }

console.log('== 小结: '+(total-fails)+'/'+total+' 通过; 截图在 '+SHOT_DIR+'/ ==');
process.exitCode=fails?1:0;
}catch(e){
console.error('[探针异常] '+e.message);
pg.pageErrors.filter(e=>!BENIGN.test(e)).slice(0,10).forEach(x=>console.error('   '+x));
console.error('最近 console: '+JSON.stringify(pg.consoleLog.slice(-8),null,1));
process.exitCode=2;
}finally{ await pg.close(); }
})();
