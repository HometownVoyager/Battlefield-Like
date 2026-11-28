// ─────────────────────────────────────────────
// dev/verify-specpose-hudresidue-20261122.js —— 2026-11-22 观战附身呈现×提示条残留批:
//   ① 观战(视模式)附身Bot信息显示不全 —— 枪模/换弹举雷包扎开火反馈全不画 + 准星被压掉
//      定罪: 24-main vmScene 渲染门 player.alive 单条件 (2026-11-03 真附身批只放宽了 updateViewModel
//      状态机门 :262, 渲染门漏配对; 调试附身是活人不受影响故未暴露) + 22-hud 准星三档全 player.alive
//      (specViewHudTick 只在迁移帧还原一次, updateHUD 每帧压回 = 稳态恒无准星)。
//      修: 渲染门 (player.alive||player.specViewHost) + 准星 _chAlive 单源。
//   ② "自由观战…"提示条 (#specViewInd, body 直挂 z-index:40 > .screen:20, 不进 #ui) 残留到
//      结算页/主菜单/暂停罩 —— 定罪: 24-main 冻结分支 (gamePaused||matchOver||menuHold) return
//      在 specViewHudTick 常规调用点之前, 指示条唯一收起写点 (tick 内 _svOverlayOpen 门) 冻结期断粮。
//      修: 冻结分支 return 前补喂一帧同源 tick + 22-hud on 谓词加 !matchOver (终局 0.9s 空窗闪回也档掉)。
// 用法: node dev/verify-specpose-hudresidue-20261122.js [--neg]
// 判据:
//   T0 源码锚: 渲染门新行 (24-main) / 冻结分支补喂行位置 (menuCam 标记与 updateHUD 之间) /
//      updateViewModel 门回归钉 / on 谓词 !matchOver / 准星 _chAlive 四行 (22-hud) /
//      旧渲染门行已绝迹 (负向) / _svOverlayOpen 收起行+specViewPossess VM 可见行 (既有契约回归钉)。
//   T1 调试附身回归 (活人): dbgSpecPossess → vmScene 照常渲染 + 准星照常 (既有行为不受本批影响)。
//   T2 视模式附身呈现 (死者, 本批主修): specViewPossess(假宿主) → __step 真主循环 3 帧 ——
//      vmScene 每帧渲染 (改前恒 0=枪模/镜像动画全不画) + 准星 block (改前 none) + 弹药面板/血条读宿主
//      (curW 钉定既有契约) + 👁 指示条出附身文案; 脱离后 vmScene 停渲 + 准星收回。
//   T3 提示条残留三态 (本批主修): 自由观战指示条 display=block 起步 →
//      T3a 暂停 gamePaused=true 一帧冻结分支收起 / 解除恢复 (改前: 永压暂停罩) /
//      T3b menuHold=true + 注入 .screen 开着 → 收起 / 解除恢复 (改前: 永压主菜单) /
//      T3c endMatch → matchOver 冻结 → 指示条收起 (改前: 永压结算页与主菜单 = 用户实报)。
//   --neg (五补丁, 红名↔补丁): N1 渲染门拆 (24-main 渲染门去 specViewHost)→T0a/T0f/T2a /
//      N2 冻结补喂行拆 (24-main, specViewHudTick();\nreturn; → return;)→T0b+T3a/T3b/T3c /
//      N3 on 谓词拆 (22-hud 去 !matchOver)→T0d+T3c / N4 _chAlive 拆 (22-hud 回 player.alive)→T0e (仅锚, 行为无可辨红=已知口径) /
//      N5 _svOverlayOpen 收起行拆 (22-hud)→T0g+T3a/T3b。
//      N2 与 N3 在 T3c 上双归因 (前者断粮不喂帧, 后者喂了但谓词放行), 映射按此读。
// 沙箱要点承 verify-throwq-deathfall-seatfire-20261122 (CANNON 桩/真开局+deployPlayer/listeners 捕获)
// 与 verify-batch-20261114 (__T 受控时钟直驱 loop() —— 提示条残留三态必须过真主循环冻结分支)。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const stub=require('./_bootstub.js');
require('./_bootpatch.js').patch(stub.sandbox);
{const P=Object.getPrototypeOf(stub.THREE.Group.prototype); if(!P.clear) P.clear=function(){ this.children.length=0; };}
const _ensureStyle=e=>{ if(e&&e.style&&!e.style.setProperty) e.style.setProperty=(k,v)=>{ e.style[k]=v; }; return e; };
{const doc=stub.document,og=doc.getElementById.bind(doc),oc=doc.createElement.bind(doc);
doc.getElementById=id=>_ensureStyle(og(id));
doc.createElement=t=>_ensureStyle(oc(t));}
const CANNON=(()=>{
const V3=stub.THREE.Vector3;
class Quat{constructor(){this.x=0;this.y=0;this.z=0;this.w=1;}set(){return this;}setFromEuler(){return this;}copy(){return this;}}
return {
Vec3:V3,Quaternion:Quat,
World:class{constructor(){this.gravity=new V3();this.broadphase=null;this.solver={iterations:0};this.bodies=[];}addBody(b){this.bodies.push(b);}removeBody(b){const i=this.bodies.indexOf(b);if(i>=0)this.bodies.splice(i,1);}add(b){this.addBody(b);}remove(b){this.removeBody(b);}addConstraint(){}removeConstraint(){}step(){}},
Body:class{constructor(o){Object.assign(this,o||{});this.shapes=[];this.position=new V3();this.velocity=new V3();this.quaternion=new Quat();this.angularDamping=0;this.linearDamping=0;}addShape(s){this.shapes.push(s);}},
Box:class{},Sphere:class{},Material:class{},ContactMaterial:class{},NaiveBroadphase:class{},PointToPointConstraint:class{},
};})();

const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const FILES=[...html.matchAll(/src="(js\/[^"?]+)/g)].map(m=>m[1]);
console.log('载入清单: 解析 index.html 得 '+FILES.length+' 个脚本');

// ── NEG 阴性对照: 五补丁 (正常跑不启用) ──
const NEG=process.argv.includes('--neg');
const SRC={},PATCH_MAP={};
const NEG_PATCHES=[
// N1 渲染门拆: 视模式附身不再渲染 vmScene ⇒ T2a 红 (枪模恒不画) + T0a 红 + T0f (旧行绝迹负向断言) 红
['js/24-main.js','if((player.alive||player.specViewHost)&&!player.onMG&&VM.root.visible){','if(player.alive&&!player.onMG&&VM.root.visible){'],
// N2 冻结补喂行拆: 冻结分支不再喂 specViewHudTick ⇒ 残留三态全红 (T3a/T3b/T3c) + T0b 位置断言红
['js/24-main.js',"if(typeof specViewHudTick==='function') specViewHudTick();\nreturn;",'return;'],
// N3 on 谓词拆: 终局后指示条照常显 ⇒ T3c 红 (冻结补喂在但谓词放行; 与 N2 在 T3c 双归因)
['js/22-hud.js','const on=!matchOver&&(pos||(player.specView&&!player.alive));','const on=(pos||(player.specView&&!player.alive));'],
// N4 准星存活判据拆 (22-hud 回 player.alive): 只拆 T0e 源码锚。行为无可辨红为**已知口径** —— 真实流程
//    (自由飞行帧→附身) 里 specViewHudTick 迁移帧把准星还原成空串 (CSS 可见), updateHUD 旧写的 hudShow(false)
//    又被 hudStyle 去重缓存吞掉 ⇒ 拆后准星仍"碰巧可见" (静态 --gap 不再随帧更新是仅有的可感差异)。
//    本修=写点与真附身呈现契约对齐 (不靠迁移帧还原+缓存吞写的巧合组合), 故 NEG 只钉源码锚。
['js/22-hud.js','const _chAlive=player.alive||!!player.specViewHost;','const _chAlive=player.alive;'],
// N5 全屏层收起门拆: 暂停/主菜单期指示条不再收 ⇒ T3a/T3b 红 (T3c 靠 !matchOver 谓词仍绿)
['js/22-hud.js',"if(_svOverlayOpen()){ if(_svInd.style.display!=='none') _svInd.style.display='none'; return; }",';'],
];
if(NEG) for(const [f,from,to] of NEG_PATCHES){
if(SRC[f]===undefined) SRC[f]=fs.readFileSync(path.join(root,f),'utf8');
if(SRC[f].indexOf(from)<0){ console.log('✗ NEG 锚缺失: '+f+' :: '+JSON.stringify(from.slice(0,60))); process.exit(1); }
PATCH_MAP[f]=(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC[f]).split(from).join(to);
}
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:fs.readFileSync(path.join(root,f),'utf8'));

function boot(campIdx){
for(const k in stub.byId)delete stub.byId[k];
const ctx=vm.createContext(Object.assign({},stub.sandbox));
// listeners 捕获 (throwq 同款): 本探针不派发键, 保留同一 boot 形制
const listeners={};
const addL=(t,f)=>{ (listeners[t]=listeners[t]||[]).push(f); };
ctx.addEventListener=addL;
ctx.document=Object.assign({},stub.document,{addEventListener:addL,removeEventListener(){}});
ctx.window=Object.assign({},stub.window,{addEventListener:addL,removeEventListener(){}});
ctx.dispatchEvent=ev=>{ if(!ev.preventDefault) ev.preventDefault=()=>{}; if(!ev.stopPropagation) ev.stopPropagation=()=>{}; for(const f of (listeners[ev.type]||[]).slice()) f(ev); return true; };
ctx.KeyboardEvent=class{ constructor(t,o){ o=o||{}; this.type=t; this.code=o.code; this.repeat=!!o.repeat; } };
ctx.MouseEvent=class{ constructor(t,o){ o=o||{}; this.type=t; this.button=o.button; } };
ctx.CANNON=CANNON;
ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
ctx.__T=1000;
ctx.performance={now:()=>ctx.__T};   // 受控时钟 (batch-20261114 同款): __step 直驱 loop(), 冻结分支三态才能过真主循环
for(const f of FILES) vm.runInContext(srcOf(f),ctx,{filename:f});
vm.runInContext('var __step=(n)=>{ for(let i=0;i<n;i++){ __T+=16.7; loop(); } };',ctx);
return ctx;
}
const PASS=[];let FAILN=0;
function ok(cond,label){
if(cond){ PASS.push(label); console.log('  ✔ '+label); }
else { FAILN++; console.log((NEG?'  ● [期望红] ':'  ✘ ')+label); }
}
let IDXS=1; { const c0=boot(0); IDXS=vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="stalingrad")',c0); }
const ctx=boot(IDXS);
const G=s=>vm.runInContext(s,ctx);
let err0=null;
try{ G("document.getElementById('startBtn').onclick();"); }catch(e){ err0=String(e&&e.stack||e); }
if(!err0){ try{ G('if(!player.alive||!player.deployed) deployPlayer();'); }catch(e){ err0='deployPlayer: '+String(e&&e.stack||e); } }
if(err0||!G('player.alive')){ console.log('  ✘ 开局/部署失败 '+(err0||'player.alive=false')); process.exit(1); }
ok(html.includes("__sfStyleVer='20261128d'"),'前置: 版本戳 20261128d 在位 (index.html 内联)');

// vmScene 渲染间谍: renderer.render 实例OwnProperty 覆写 (stub render 本是空函数, 只数 vmScene 次数)
G(`
var __vmN=0; var __r0=renderer.render.bind(renderer);
renderer.render=function(s,c){ if(s===vmScene) __vmN++; __r0(s,c); };
var __vmDelta=function(){ var d=__vmN; __vmN=0; return d; };
var __svIndEl=function(){ var cs=document.body.children; for(var i=0;i<cs.length;i++){ if(cs[i].id==='specViewInd') return cs[i]; } return null; };
var __mkHost=function(){ return {alive:true,onVehicle:null,onNaval:null,capCrew:false,zombie:false,name:'假宿主',team:(player.team===0?1:0),
 pos:new THREE.Vector3(20,2,20),prone:false,crouch:false,yaw:1.1,pitch:0,
 mesh:{root:new THREE.Group()},slots:[{key:'thompson',def:WPN_DEFS.thompson,mag:27,reserve:90}],
 suppression:0.3,reloadT:0,pReloadT:0,bandageT:0,bandages:2,hp:88,state:'idle',nadeAnimT:0}; };
`);

// ══ T0 源码锚 ══
console.log('T0 源码锚');
const src24=srcOf('js/24-main.js'),src22=srcOf('js/22-hud.js');
ok(src24.includes('if((player.alive||player.specViewHost)&&!player.onMG&&VM.root.visible){   // ★2026-11-22b 附身可见批')===true,'T0a ★vmScene 渲染门并入 specViewHost (24-main, 单行锚)');
{ const _call=src24.indexOf("if(typeof specViewHudTick==='function') specViewHudTick();");
const _menuCam=src24.indexOf('const menuCam=menuHold&&!gamePaused;');
const _upd=src24.indexOf('updateHUD(dt,pdt);');
ok(_call>=0&&(src24.split("if(typeof specViewHudTick==='function') specViewHudTick();").length-1)===2&&_call>_menuCam&&_call<_upd,'T0b ★冻结分支补喂 specViewHudTick (位置: menuCam 标记之后 / updateHUD 常规点之前; 全文恰 2 处调用)');
}
ok(src24.includes('if((player.alive||player.specViewHost)&&player.curW&&!player.onMG')===true,'T0c updateViewModel 状态机门并入 specViewHost 回归钉 (2026-11-03 既有行不动)');
ok(src22.includes('const on=!matchOver&&(pos||(player.specView&&!player.alive));')===true,'T0d ★specViewHudTick on 谓词加 !matchOver (22-hud)');
ok(src22.includes('const _chAlive=player.alive||!!player.specViewHost;')===true
&&src22.includes('if(_chAlive&&player.loiter){')===true
&&src22.includes('_chAlive&&!player.ads&&!player.onVehicle){')===true
&&src22.includes('_chAlive&&player.ads&&!WPN_DEFS[VM.key]?.scoped')===true,'T0e ★准星三档 _chAlive 单源 (22-hud 四行)');
ok(!src24.includes('if(player.alive&&!player.onMG&&VM.root.visible){')===true,'T0f 旧渲染门 (player.alive 单条件) 已绝迹 (负向断言)');
ok(src22.includes("if(_svOverlayOpen()){ if(_svInd.style.display!=='none') _svInd.style.display='none'; return; }")===true,'T0g _svOverlayOpen 全屏层收起行回归钉 (2026-11-02 既有行不动)');
ok(srcOf('js/20-player.js').includes('if(typeof VM!==\'undefined\') VM.mirrorHost=false;         // 镜像标记跨目标清账 (换附身对象时旧镜像不得延续)')===true
&&src24.includes("if(typeof specViewTick==='function') specViewTick(pdt);")===true,'T0h 附身管线既有锚回归 (specViewPossess 镜像清账 + 24-main specViewTick 每帧旁路)');

// ══ T1 调试附身回归 (活人) ══
console.log('T1 调试附身回归: 活人附身既有呈现不受本批影响');
G(`
player.__hp0=player.hp; player.alive=true; player.spectator=true; player.specView=false; player.specViewHost=null; player._svSaved=null;
player.deathCamT=0; player.deathRag=null; player.killcam=null; player.loiter=null; player.chute=false;
player.onVehicle=null; player.onNaval=null; player.onMG=null; player.onAT=null; player.onAA=null; player.onMortar=null; player.onBattery=null;
player.thirdPerson=false; player.ads=false; player.nadeHeld=false;
VM.state='idle'; VM.stateT=0; VM.stateDur=0; vmSndFlags={};
var __h1=__mkHost();
dbgSpecPossess(__h1);
`);
ok(G('player.specViewHost')!==null&&G('VM.root.visible')===true,'T1-prep 调试附身挂账 + VM 可见 (既有行为)');
G('__vmDelta(); __step(2);');
ok(G('__vmDelta()')>0,'T1a 调试附身 vmScene 照常渲染 (活人门本就放行, 回归钉)');
ok(G("document.getElementById('crosshair').style.display")!=='none','T1b 调试附身准星照常 (活人 _chAlive 路径回归钉; 迁移帧还原后 inline 可为空串=CSS 可见, 只判不可见向)');
G('dbgSpecDetach();');

// ══ T2 视模式附身呈现 (死者, 本批主修①) ══
console.log('T2 视模式(自由观战)附身呈现: 死者附身 → 枪模渲染 + 准星 + 宿主读数');
G(`
player.alive=false; player.spectator=true; player.specView=true; player.specViewHost=null; player.specViewSpd=14;
player.deathCamT=0; player.deathRag=null; player.killcam=null; player.hp=0;
player.suppressV=0; player._svCurW=undefined;
VM.root.visible=false; VM.state='idle'; VM.stateT=0; VM.stateDur=0; vmSndFlags={}; player.nadeHeld=false;
__step(5);   // 自由飞行 5 帧 (真实流程: 票尽观战→自由飞行→左键附身; 迁移帧在此收齐 HUD 隐藏清单)
var __h2=__mkHost();
specViewPossess(__h2);
`);
ok(G('player.alive')===false&&G('player.specViewHost===__h2')===true,'T2-prep 视模式附身挂账 (死者+宿主)');
ok(G('VM.root.visible')===true&&G('VM.key')==='thompson','T2-prep VM 换宿主枪 + 模型账可见 (specViewPossess 既有单源)');
G('__vmDelta(); __step(3);');
const _t2a=G('__vmDelta()');
ok(_t2a>=3,'T2a ★vmScene 每帧渲染 (3 帧 ≥3 次, 实得 '+_t2a+'; 改前恒 0 = 枪模/换弹举雷包扎开火反馈全不画)');
ok(G("document.getElementById('crosshair').style.display")!=='none','T2b ★附身期准星在位 (真附身批"要显示准星"契约; 判不可见向 —— 迁移帧还原+缓存吞写下 inline 为空串=CSS 可见, N4 拆后此态仍绿为已知口径)');
ok(G("document.getElementById('magN').textContent")==='27'&&G("document.getElementById('wname').textContent")===G("WPN_DEFS.thompson.name"),'T2c 弹药面板读宿主 (magN=27 = curW 钉宿主既有契约, 改前已绿回归钉)');
ok(String(G("document.getElementById('hpNum').textContent"))==='88','T2c-2 血条读宿主 (_hv=88, 真附身读数心既有契约回归钉; hudText 写数值故 String 化)');
{ const _ind=G('__svIndEl()');
ok(!!_ind&&String(_ind.innerHTML).indexOf('👁 附身')>=0&&String(_ind.innerHTML).indexOf('假宿主')>=0,'T2d 👁 指示条出附身文案 (宿主名在内)');
}
ok(G('__h2.mesh.root.visible')===false,'T2e 宿主模型第一人称收纳 (specViewTick 逐帧既有契约回归钉)');
G('specViewDetach(false);');
ok(G('player.specViewHost')===null&&G('VM.root.visible')===false,'T2f-prep 脱离收账 (host null + VM 收起)');
G('__vmDelta(); __step(2);');
ok(G('__vmDelta()')===0,'T2f ★脱离后 vmScene 停渲 (自由观战无枪, 门随 host=null 关闭)');
ok(G("document.getElementById('crosshair').style.display")==='none','T2f-2 脱离后准星收回 (死态非附身 else 分支不动)');

// ══ T3 提示条残留三态 (本批主修②, 必须过真主循环冻结分支) ══
console.log('T3 提示条残留: 暂停/主菜单/终局三态指示条随全屏层收起');
G(`
player.specViewHost=null; player.specView=true; player.alive=false; player.specViewSpd=14;
__vmDelta(); __step(1);
`);
{ const _ind=G('__svIndEl()');
ok(!!_ind&&_ind.style.display==='block'&&String(_ind.innerHTML).indexOf('自由观战')>=0,'T3-prep 自由观战指示条在位 (display=block + 自由观战文案)');
}
// T3a 暂停: gamePaused 冻结分支一帧即收, 解除恢复
G('gamePaused=true; __vmDelta(); __step(1);');
{ const _ind=G('__svIndEl()');
ok(!!_ind&&_ind.style.display==='none','T3a ★暂停期指示条收起 (冻结分支补喂帧 + _svOverlayOpen 门; 改前: 永压暂停罩)');
}
G('gamePaused=false; __vmDelta(); __step(1);');
{ const _ind=G('__svIndEl()');
ok(!!_ind&&_ind.style.display==='block','T3a-2 暂停解除指示条恢复 (同一 _svIndShow 单源复显, 既有对账语义)');
}
// T3b 主菜单 (menuHold, 未终局挂起路径): 注入 .screen 开着 ⇒ 收起, 解除恢复
G(`
var __fakeScreens=[{classList:{contains:function(c){ return c!=='hidden'; }}}];
document.querySelectorAll=function(s){ return s==='.screen'?__fakeScreens:[]; };
_svScreens=null; menuHold=true; __vmDelta(); __step(1);
`);
{ const _ind=G('__svIndEl()');
ok(!!_ind&&_ind.style.display==='none','T3b ★主菜单期指示条收起 (menuHold 冻结分支补喂 + .screen 开着; 改前: 永压主菜单 = 用户截图实报)');
}
G(`
menuHold=false; _svScreens=null; document.querySelectorAll=function(){ return []; }; __vmDelta(); __step(1);
`);
{ const _ind=G('__svIndEl()');
ok(!!_ind&&_ind.style.display==='block','T3b-2 回战局 (resumeBattle 后) 指示条恢复');
}
// T3c 终局: endMatch → matchOver 冻结 → 指示条收起 (on 谓词 !matchOver 出迁移)
G('endMatch(0); __vmDelta(); __step(2);');
{ const _ind=G('__svIndEl()');
ok(G('matchOver')===true,'T3c-prep 终局已落账 (matchOver=true, 主循环由 matchOver 冻结)');
ok(!!_ind&&_ind.style.display==='none','T3c ★终局指示条收起 (改前: 永压结算页与主菜单 = 用户实报"残留至一局结束回到主页面"; N2 断粮 / N3 谓词放行 双归因)');
}

// ══ 汇总 ══
console.log('');
console.log(NEG?('NEG 模式: 期望红 '+FAILN+' 项, 绿 '+PASS.length+' 项'):'通过 '+PASS.length+' / 失败 '+FAILN);
if(!NEG&&FAILN>0) process.exit(1);
if(NEG){
console.log('NEG 期望红映射: N1→T0a/T0f/T2a  N2→T0b/T3a/T3b/T3c  N3→T0d/T3c  N4→T0e (仅源码锚, 行为无可辨红=已知口径见补丁注)  N5→T0g/T3a/T3b');
console.log('实得红项数: '+FAILN+' (五补丁定向, 全绿=补丁未生效要查)');
}
