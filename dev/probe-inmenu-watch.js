// ─────────────────────────────────────────────
// dev/probe-inmenu-watch.js —— 第6条根因定位: 谁在什么时候摘掉了 body 的 inMenu
// (2026-09-20 本批新建)
//
// 做法: 真浏览器打开游戏 → 在页面里给 body.classList 打补丁记录每一次增删(含调用栈) →
// 然后驱动「选战役 → 开新局 → 部署 → 回主界面 → 再开一局」全流程, 打印时间线。
// 这样"哪个地图/哪一步把 HUD 放出来"就是可复核的事实, 不再靠猜。
//
// 用法: node dev/probe-inmenu-watch.js [url]
'use strict';
const {openPage,sleep}=require('./cdp');
const URL=process.argv[2]||'http://localhost:8000/index.html';

const INSTALL=`(()=>{
if(window.__sfWatchInstalled) return 'already';
window.__sfWatchInstalled=true;
window.__sfTimeline=[];
const stamp=()=>{ const t=performance.now(); return 't+'+Math.round(t)+'ms'; };
const push=(op,extra)=>window.__sfTimeline.push(stamp()+'  '+op+(extra?('  '+extra):'')+'   [body="'+document.body.className+'"]');
for(const m of ['add','remove','toggle']){
const orig=DOMTokenList.prototype[m];
DOMTokenList.prototype[m]=function(...args){
let r;
try{ r=orig.apply(this,args); }finally{
if(this===document.body.classList&&(args[0]==='inMenu')){
const st=new Error().stack.split('\\n').slice(2,5).map(s=>s.trim().replace(/^at\\s+/,'')).join(' <- ');
push(m+'("'+args.join('","')+'")', st.slice(0,220));
}
}
return r;
};
}
push('WATCH-INSTALLED (body="'+document.body.className+'")');
return 'ok';
})()`;

(async()=>{
const pg=await openPage(null);
let bad=0;
try{
console.log('== 第6条根因定位: inMenu 时间线 ==');
await pg.goto(URL);
await pg.waitFor('!!window.__sfBooted',45000);
console.log('watch 安装: '+await pg.eval(INSTALL));

const step=async(label,expr,waitMs)=>{
if(expr) await pg.eval(expr);
await sleep(waitMs||900);
const st=await pg.eval(`(()=>{const cs=e=>{const n=document.getElementById(e); return n?getComputedStyle(n).display:'MISSING';};
const menu=document.getElementById('menu');
return {body:document.body.className, ui:cs('ui'), menu:cs('menu'), menuArt:cs('menuArt'),
deploy:cs('deploy'), end:cs('end'), deployed:!!player.deployed, alive:!!player.alive,
matchOver:typeof matchOver!=='undefined'?!!matchOver:'?', menuHold:typeof menuHold!=='undefined'?!!menuHold:'?'};})()`);
// 判定 (2026-09-20 修订): HUD (#ui) 的期望可见性由**当时的屏幕状态**决定, 不是"菜单期一律 none":
//   - 战斗中的屏幕 (deploy=none 且 menu=none 且末屏非 #end) → #ui 必须可见;
//   - 其余 (主菜单 / 面板 / 部署界面 inDeploy / 结算) → #ui 必须隐藏。
// 旧版把"部署界面"也当成"HUD 应可见", 在 body.inDeploy 落地后必然误报 —— 部署期现在也隐藏 HUD。
const inCombat=(st.menu==='none'&&st.deploy==='none'&&st.end==='none');
const wantUi=inCombat?'block':'none';
const ok=(st.ui===wantUi);
console.log((ok?'  ok  ':'  ★   ')+label+'  ui='+st.ui+'(期望 '+wantUi+(inCombat?', 战斗中':', 菜单/部署/结算')+') menu='+st.menu
+' deploy='+st.deploy+' body="'+st.body+'" deployed='+st.deployed+' alive='+st.alive+' matchOver='+st.matchOver+' menuHold='+st.menuHold);
if(!ok) bad++;
return st;
};

await step('A 首屏 (主菜单)',null,1500);
await step('B 点「新 游 戏」',`document.getElementById('newGameBtn').click()`,700);
await step('C 进入战场 startGame()',`startGame()`,2500);
await step('D 部署 (deployPlayer)',`deployPlayer()`,2500);
await step('E 返回主界面 returnToMenu()',`returnToMenu()`,1200);
await step('F 再开新局 startGame()',`startGame()`,2500);
await step('G 立即返回主界面 returnToMenu()',`returnToMenu()`,1200);

// 结算路线: 直接把兵力打空并判负, 看 21-match 的 inMenu 挂载与 24-main 自检
await step('H 开新局',`startGame()`,2000);
await step('I 部署',`deployPlayer()`,1800);
await step('J 强制结算 (endMatch)',`typeof endMatch==='function'?endMatch(0):'no-endMatch'`,2000);
await step('K 结算后返回主界面',`returnToMenu()`,1200);

const tl=await pg.eval('window.__sfTimeline');
console.log('\n--- inMenu 时间线 ('+tl.length+' 条) ---');
tl.forEach(l=>console.log('  '+l));
console.log('\n--- console 警告/错误 ---');
pg.consoleLog.filter(c=>c.type==='warning'||c.type==='error'||c.type==='dialog').slice(0,25).forEach(c=>console.log('  ['+c.type+'] '+c.text));
console.log('\n--- 未捕获异常 ---');
pg.pageErrors.slice(0,15).forEach(e=>console.log('  '+e));
console.log('\n== 结论: '+bad+' 个步骤里 ui 未被隐藏 (菜单/主界面期间) ==');
process.exitCode=bad?1:0;
}catch(e){
console.error('[探针异常] '+e.message);
pg.pageErrors.slice(0,10).forEach(x=>console.error('   '+x));
process.exitCode=2;
}finally{ await pg.close(); }
})();
