// ─────────────────────────────────────────────
// dev/probe-deploy-hud.js —— 第6条回归: 部署界面的战斗 HUD 是否真的被隐藏 (2026-09-20 本批)
//
// 背景 (根因见 dev/issue6-根因定位.md):
//   startGame() 摘掉 body.inMenu → showDeploy(true)。#deploy 的 .screen 背景只有 94~97% 不透明,
//   于是 #ui 里的小地图/血条/弹药面板/顶栏从遮罩底下透出来 —— 用户观感就是"主页没隐藏 UI"。
//   修复 = 新增 body.inDeploy + CSS 隐藏规则。
//
// 判据 (祖先感知, 2026-09-20 修订):
//   第一版探针只看每个模块**自身**的 getComputedStyle(el).display —— 那是祖先盲的:
//   #ui 被 display:none 时, 子孙仍自报 display:block, 于是修复后计数照样是 11, 会把正确的修复判成失败。
//   现在按**布局事实**判定: 在渲染树里 ⇒ getClientRects() 非空且面积非零。
//   输出同时给 ①#ui 的 display ②真正渲染的模块数与清单 ③body 类名, 三者互相印证。
//
// 用法: node dev/probe-deploy-hud.js [url]
'use strict';
const {openPage,sleep}=require('./cdp');
const URL=process.argv[2]||'http://localhost:8000/index.html';

const SURVEY=`(()=>{
const ids=['crosshair','hitmark','dmgOv','supOv','lowOv','vig','scopeOv','uwOv','dirHits','ammoPanel','healthPanel',
'minimapWrap','bigmapWrap','squadHUD','topBar','killfeed','msgC','scorePop','killPops','mkBanner','streakBuff',
'capPanel','interact','coldTip','tbTip','oxyWrap','braceInd','nadeWarn','tvOv','leadPip','tankPip','mgPip',
'heatWrap','vehHpWrap','scoreboard','fps','clsTip','blackOv'];
const rendered=e=>{ if(!e) return false; const rs=e.getClientRects(); for(const r of rs) if(r.width>0&&r.height>0) return true; return false; };
const rect=e=>{const r=e.getBoundingClientRect(); return [Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)];};
const disp=id=>{const e=document.getElementById(id); return e?getComputedStyle(e).display:'MISSING';};
const out={
 viewport:[innerWidth,innerHeight], body:document.body.className,
 ui:disp('ui'), touchUI:disp('touchUI'),
 uiRendered:(()=>{const e=document.getElementById('ui'); return e?rendered(e):false;})(),
 menu:disp('menu'), deploy:disp('deploy'), menuArt:disp('menuArt'),
 deployed:!!player.deployed, alive:!!player.alive,
 campaign:(typeof CAMPAIGN!=='undefined'&&CAMPAIGN.id)||'?'};
out.live=[]; out.selfDisplayOnly=0;
for(const id of ids){
const e=document.getElementById(id);
if(!e) continue;
if(getComputedStyle(e).display==='none') continue;
out.selfDisplayOnly++;                       // 只报"自己 display 不是 none"的 (总数, 祖先盲)
if(rendered(e)) out.live.push({id,rect:rect(e),op:getComputedStyle(e).opacity});
}
out.liveIds=out.live.map(x=>x.id);
return out;})()`;

let fails=0,total=0;
function verdict(label,s,expectHidden){
const ok=expectHidden ? (s.ui==='none'&&!s.uiRendered&&s.live.length===0) : (s.ui!=='none'&&s.uiRendered&&s.live.length>0);
total++; if(!ok) fails++;
console.log((ok?'  [PASS] ':'  [FAIL] ')+label);
console.log('         body="'+s.body+'"  #ui='+s.ui+'(rendered='+s.uiRendered+')  #deploy='+s.deploy
+'  #menu='+s.menu+'  #menuArt='+s.menuArt+'  战役='+s.campaign+'  视口='+s.viewport.join('x'));
console.log('         真正渲染的 HUD 模块 ('+s.live.length+'): '+(s.liveIds.join(', ')||'(无)'));
console.log('         祖先盲计数 (仅自身 display!=none, 仅供对照, 不作判据): '+s.selfDisplayOnly);
if(!ok){ console.log('         期望: '+(expectHidden?'HUD 完全隐藏':'HUD 可见')); s.live.forEach(x=>console.log('           ★ '+x.id+' rect='+JSON.stringify(x.rect)+' op='+x.op)); }
return ok;
}

(async()=>{
const pg=await openPage(null,{width:1600,height:1000});
try{
console.log('== 第6条回归: 部署界面隐藏战斗 HUD ==');
await pg.goto(URL);
await pg.waitFor('!!window.__sfBooted',45000);
await sleep(1200);

await pg.eval('startGame()'); await sleep(2600);
const s1=await pg.eval(SURVEY);
verdict('① 部署界面 (未落地) → 期望 HUD 完全隐藏',s1,true);
await pg.screenshot('dev/out/deploy-hud.png');

await pg.eval('deployPlayer()'); await sleep(2600);
const s2=await pg.eval(SURVEY);
verdict('② 战斗期 (已落地, 对照) → 期望 HUD 可见',s2,false);
await pg.screenshot('dev/out/combat-hud.png');

await pg.eval('returnToMenu()'); await sleep(1300);
const s3=await pg.eval(SURVEY);
verdict('③ 主界面 (对照) → 期望 HUD 完全隐藏',s3,true);
await pg.screenshot('dev/out/menu-hud.png');

console.log('== 小结: '+(total-fails)+'/'+total+' 通过 ==');
process.exitCode=fails?1:0;
}catch(e){
console.error('[探针异常] '+e.message);
pg.pageErrors.slice(0,8).forEach(x=>console.error('   '+x));
process.exitCode=2;
}finally{ await pg.close(); }
})();
