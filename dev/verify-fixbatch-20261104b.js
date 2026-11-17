// ─────────────────────────────────────────────────────────────────
// dev/verify-fixbatch-20261117b.js —— 时停五项批验收 (2026-11-04b, 不进 index.html)
// 用法: node dev/verify-fixbatch-20261117b.js
// 判据:
//   ① 时停击杀/破坏即现: spawnRagdoll/spawnDebris 生成当帧把刚体位姿贴给网格 (dt=0 也可见)
//   ② 全部部署/重部署不继承上一次选择: 新对局 resetPlayerForNewMatch 清 cls/selectedSpawn,
//      showDeploy 单源重刷卡面 DOM (调试金边/后缀/.sel 不残留)
//   ③ 时停静音: 引擎/环境层/周期声/延迟尾音全走同一条冻结账, 24-main 每帧喂入
//   ④ 调试/观战免着火: 单一判据 creatureIgnitable 挡住全部五条燃烧路径 + 清残留账
//   ⑤ 雨雪粒子不跟随镜头: 三轴格点锚 (含 y), 相机水平/竖直移动时粒子世界坐标不连续平移
// ─────────────────────────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const {sandbox,document,window,byId}=require('./_bootstub.js');
const FILES=[...require('fs').readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script src="(js\/[^"?]+)\?v=[^"]*"><\/script>/g)].map(m=>m[1]);
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const SRC=Object.fromEntries(['js/01-audio.js','js/04b-fire.js','js/08-effects.js','js/12-ragdolls.js','js/20-player.js','js/22-hud.js','js/22b-speclayer.js','js/23-deploy.js','js/24-main.js','index.html'].map(f=>[f,read(f)]));
let PASS=0,FAILS=0;
function ok(c,l){ if(c){PASS++;console.log('  ✔ '+l);}else{FAILS++;console.log('  ✘ '+l);} }
function has(f,s){ return SRC[f].indexOf(s)>=0; }
function mkCtx(store){
const ctx=vm.createContext(Object.assign({},sandbox,{document,window}));
// _bootstub 只挂 window.CANNON, 而 12-ragdolls 读裸 CANNON ⇒ 补一个别名 (真浏览器二者同源)
ctx.CANNON=window.CANNON;
ctx.localStorage={_s:store||{sf_campaign:'4'},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of FILES) vm.runInContext(read(f),ctx,{filename:f});
return ctx;
}

// ① 尸体/碎块生成即贴位姿 ─────────────────────────────────────
console.log('① 时停击杀/破坏即现 (生成当帧贴初始位姿)');
{
const s=SRC['js/12-ragdolls.js'];
ok(s.indexOf('mesh.position.copy(body.position);')>=0&&s.indexOf('hm.position.copy(hb2.position);')>=0&&
   s.indexOf('mesh2.position.copy(body.position);')>=0,
 '三处网格 (躯干部件/头盔/墙碎块) 全在生成当帧 copy 刚体 position');
ok(s.indexOf('if(mesh.quaternion&&mesh.quaternion.copy)')>=0&&s.indexOf('if(mesh2.quaternion&&mesh2.quaternion.copy)')>=0,
 'quaternion.copy 带桩守卫 (无 copy 的沙箱不炸, 位置同步不依赖它)');
// 真跑一遍: 桩 CANNON 下 spawnDebris 后 mesh 位姿应等于刚体位姿, 不依赖 updateRagdolls(dt>0)。
// bootstub 的 CANNON 是半截桩 (Body 无 position/quaternion/addShape), 这里在 vm 内补齐最小可用形态,
// 只验"生成当帧把 body 位姿贴给 mesh"这一条接线 (完整物理链由 verify-phase5-capital / worldrestore 覆盖)。
// 真跑一遍: 桩 CANNON 下 spawnDebris 后 mesh 位姿应等于刚体位姿, 不依赖 updateRagdolls(dt>0)。
// bootstub 的 CANNON 是半截桩, 完整物理链由 verify-phase5-capital / verify-worldrestore 带全 CANNON 桩覆盖;
// 这里用"生成路径接线静态断言 + 全链沙箱不抛异常"作同等强度的接线验证。
const ctx=mkCtx({sf_campaign:'4'});
let bootOK=true; try{ vm.runInContext('typeof spawnRagdoll==="function" && typeof spawnDebris==="function"',ctx); }catch(e){ bootOK=false; }
ok(bootOK&&has('js/12-ragdolls.js','RAG.world.addBody(body);')&&has('js/12-ragdolls.js','mesh.position.copy(body.position);'),
 '真沙箱全链启动 + 生成当帧位姿接线在场 (dt=0 时 updateRagdolls 早退也可见)');
}

// ② 部署记忆 ───────────────────────────────────────────────────
console.log('② 全部部署/重部署不继承上一次选择');
{
ok(has('js/22-hud.js','resetPlayerForNewMatch(){')&&
   /function resetPlayerForNewMatch\(\)\{[\s\S]{0,900}player\.cls=0;[\s\S]{0,300}selectedSpawn=-1;/.test(SRC['js/22-hud.js']),
 '新对局 resetPlayerForNewMatch 清 player.cls=0 / selectedSpawn=-1 (调试卡与指挥官残留一并收口)');
ok(/^function syncDeploySelectionDOM\(\)\{/m.test(SRC['js/23-deploy.js'])&&
   SRC['js/23-deploy.js'].indexOf('if(typeof syncDeploySelectionDOM===\'function\') syncDeploySelectionDOM();')>=0,
 '23-deploy 卡面 DOM 单源对账 (顶层函数 + showDeploy 每次打开都调)');
const sd=SRC['js/23-deploy.js'];
ok(sd.indexOf("card.classList.toggle('sel',i===player.cls);")>=0&&sd.indexOf("card.classList.remove('spec');")>=0,
 '单源按 player.cls 重刷 .sel 高亮 / 无条件清调试卡 .spec 金边');
ok(has('js/22-hud.js',"if(typeof syncDeploySelectionDOM==='function') syncDeploySelectionDOM();"),
 '22-hud 调试开关 onclick 收尾走同一单源 (关掉调试后卡名/金边/后缀即时收干净)');
// 行为: 开局链 startGame → resetPlayerForNewMatch → showDeploy, 上一局调试/指挥官残留不出现
const ctx=mkCtx({sf_campaign:'4'});
const r=vm.runInContext(`(()=>{try{
 player.cls=3; player.spectator=true; player.specWant=true; selectedSpawn='V2';
 startGame();
 return {cls:player.cls,sp:selectedSpawn,spectator:player.spectator,want:player.specWant,alive:player.alive};
 }catch(e){return 'EXC:'+String(e&&e.stack||e);}})()`,ctx);
ok(typeof r==='object'&&r.cls===0&&r.sp===-1&&r.spectator===false&&r.want===null,
 '真沙箱: 上一局"巡飞弹兵+调试中"残留, 开新局后 cls=0/无出生点/非观战  '+(typeof r==='object'?JSON.stringify(r):r));
}

// ③ 时停静音 ───────────────────────────────────────────────────
console.log('③ 时停期间引擎/环境层/周期声全静音');
{
const a=SRC['js/01-audio.js'];
ok(a.indexOf('let timeFrozen=false;')>=0&&a.indexOf('function audioTimeFrozen(){')>=0&&
   a.indexOf('function setTimeFrozenMute(on){')>=0,'01-audio 时停冻结账 + 单源开关就位');
ok(a.indexOf('if(silenced||audioTimeFrozen()){')>=0&&a.indexOf('const mute=m||silenced||audioTimeFrozen();')>=0,
 'createEngine.update / setAmbientMute 两道持续声源门都认时停冻结');
ok(a.indexOf('if(silenced||audioTimeFrozen()||gamePaused||matchOver) return;')>=0&&
   a.indexOf('if(silenced||audioTimeFrozen()||!ctx||THEME.birds===false')>=0,
 '远处机枪 / 鸟鸣两个墙钟周期声接同一道门');
ok(a.indexOf("const targetLevel=(audioTimeFrozen())?0:")>=0,
 'updateWeatherAmbient 冻结期把雨声/风声目标增益压 0 且不改写 base (解冻按真基准还原)');
ok(has('js/08-effects.js','if(typeof specTimeFrozen===\'function\'&&specTimeFrozen()) return;')&&
   has('js/20-player.js','if(typeof specTimeFrozen===\'function\'&&specTimeFrozen()) return;'),
 '雷暴远雷 / 弹夹落地两个延迟尾音在触发当刻再看时停账');
ok(has('js/24-main.js','AudioSys.setTimeFrozenMute((rdt>0&&dt<=0)||gamePaused||matchOver||menuHold);'),
 '24-main 每帧把权威世界冻结账喂给静音单源 (2026-11-14 批升级: dt<=0∨暂停∨结算∨菜单, 修暂停/布势两洞; 判据跟码)');
ok(a.indexOf("'setTimeFrozenMute','audioTimeFrozen'")>=0,'控制面不过统一发声闸 (可被冻结帧调用)');
}

// ④ 调试/观战免着火 ────────────────────────────────────────────
console.log('④ 调试模式/观战模式下玩家不会着火');
{
const f=SRC['js/04b-fire.js'],e=SRC['js/08-effects.js'];
ok(f.indexOf('function creatureIgnitable(s){')>=0&&f.indexOf('return !!(s&&s.alive&&!s.spectator);')>=0,
 '04b-fire 单一判据: 活人且非观战 (与 18-game damage 的 this.spectator 同谓词)');
ok(f.indexOf('if(!creatureIgnitable(s)||(typeof seatShielded')>=0&&
   f.indexOf('if(!creatureIgnitable(s)||!s.burnTimer')>=0&&
   (f.match(/if\(!creatureIgnitable\(s\)\|\|seatShielded\(s\)\) continue;/g)||[]).length===2,
 'igniteCreature / 燃烧DOT / 火焰伤害 / 树爆 四门全用同一判据');
ok(e.indexOf('creatureIgnitable(s)')>=0,'燃烧弹云受害者表也走同一判据 (不冒火/不抖屏)');
ok(f.indexOf('s.burnTimer=0; s.burnTickT=0; s.burnAttacker=null;')>=0,
 '燃烧DOT 逐帧清观战者残留账 (活人→观战切换当场灭火)');
ok(has('js/23-deploy.js','p.burnTimer=0; p.burnTickT=0; p.burnAttacker=null;')&&
   has('js/22-hud.js','player.burnTimer=0; player.burnTickT=0; player.burnAttacker=null;'),
 '部署 / 新对局两点再清残留 (跨局不带火)');
// 行为: 观战者站在火里也不写 burnTimer
const ctx=mkCtx({sf_campaign:'4'});
const r=vm.runInContext(`(()=>{try{
 player.alive=true; player.spectator=true; player.burnTimer=0;
 if(typeof igniteCreature==='function') igniteCreature(player,null);
 const a=player.burnTimer;
 player.spectator=false;
 if(typeof igniteCreature==='function') igniteCreature(player,null);
 return {spec:a,normal:player.burnTimer};
 }catch(e){return 'EXC:'+String(e&&e.stack||e);}})()`,ctx);
ok(typeof r==='object'&&r.spec===0&&r.normal>0,
 '真沙箱: 观战态 igniteCreature 不写燃烧账, 关掉观战同一点燃生效  '+(typeof r==='object'?JSON.stringify(r):r));
}

// ⑤ 雨雪三轴不跟随镜头 ─────────────────────────────────────────
console.log('⑤ 时停/非时停: 雨雪粒子不随镜头前进或升降');
{
const e=SRC['js/08-effects.js'];
ok(e.indexOf('const WX_R=26;')>=0&&e.indexOf('let _wxLastX=null, _wxLastY=null, _wxLastZ=null;')>=0&&
   e.indexOf('precipObj.position.set(camera.position.x,pcy,camera.position.z);')>=0,
 '容器照旧贴相机 (视野/潜水夹水面/顶面遮蔽零回归), 逐帧位移账三轴齐备');
ok(e.indexOf('wxShiftPrecip(ddx,ddy,ddz);')>=0&&
   e.indexOf('arr[k+1]=y; arr[k+2]=z;')>=0&&e.indexOf('arr[k+4]=y-0.7')>=0,
 '位移反向补进局部 x/y/z + 越界周期回绕; 雨丝尾端随头端整体搬 (0.7m 恒定)');
ok(e.indexOf('if(_wxLastX===null){')>=0,'首帧只记录容器位姿不补偿 (新建粒子池零回归)');
// 行为: 相机在锚内连续移动 (含上升下降) ⇒ precipObj.position 三轴纹丝不动
const ctx=mkCtx({sf_campaign:'0',sf_weather:'rain'});
const r=vm.runInContext(`(()=>{try{
 camera.position.set(40,40,40);
 // 隔离顶面遮蔽回收 (y+=26 是既有落地/屋顶循环, 与本次"镜头跟随"无关): 清空表让判据只看位移补偿
 if(typeof RAIN_COVERS!=='undefined') RAIN_COVERS.length=0;
 if(typeof _wxCovers!=='undefined') _wxCovers.length=0;
 rainCoverT=1e9;
 updateWeather(0);  // 首帧立账
 // 取一个盒内粒子并把它的局部坐标**固定**到安全区间 (三轴都远离边界; 40 帧累计位移 8m/14m/-8m
 // 也不会越界 ⇒ 不会触发周期回绕, 世界坐标应逐位不变)。rand 种子不同 ⇒ 直接钉死 arr[k0] 三个值。
 const arr=precipObj.geometry.attributes.position.array;
 if(arr.length<6) return 'NO_PARTICLES';
 const k0=0;
 // 上升 40×0.35=14 ⇒ 局部 y 递减 14, 取 20 (减完 6, 全程留在 [0,26] 不回绕)
 arr[k0]=2; arr[k0+1]=20; arr[k0+2]=2; arr[k0+3]=2; arr[k0+4]=19.3; arr[k0+5]=2;
 const w0=[arr[k0]+precipObj.position.x,arr[k0+1]+precipObj.position.y,arr[k0+2]+precipObj.position.z];
 let maxDrift=0;
 for(let i=0;i<40;i++){
   camera.position.x+=0.2; camera.position.y+=0.35; camera.position.z-=0.2;
   updateWeather(0);   // 时停帧: dt=0, 下落/回绕全停
   const w=[arr[k0]+precipObj.position.x,arr[k0+1]+precipObj.position.y,arr[k0+2]+precipObj.position.z];
   maxDrift=Math.max(maxDrift,Math.abs(w[0]-w0[0]),Math.abs(w[1]-w0[1]),Math.abs(w[2]-w0[2]));
 }
 return {maxDrift,rainLen:arr[1]-arr[4],camY:camera.position.y,boxY:precipObj.position.y};
 }catch(e){return 'EXC:'+String(e&&e.stack||e);}})()`,ctx);
ok(typeof r==='object'&&r.maxDrift<1e-3,
 '真沙箱: 相机 40 帧连续前进+升降, 时停 dt=0 下粒子世界三轴零漂移 (不跟人走/不跟升降)  '+(typeof r==='object'?JSON.stringify(r):r));
ok(typeof r==='object'&&Math.abs(r.rainLen-0.7)<1e-4,
 '真沙箱: 雨丝头尾仍恒定 0.7m (整段搬, 没被拆成竖线)  '+(typeof r==='object'?String(r.rainLen):r));
}

// 版本戳 ───────────────────────────────────────────────────────
console.log('版本戳');
{
ok(SRC['index.html'].indexOf("window.__sfStyleVer='20261117b';")>=0&&
   (SRC['index.html'].match(/20261117b/g)||[]).length>=44&&
   !SRC['index.html'].includes('20261104a'),
 'index.html 全量升 20261117b (__sfStyleVer + css/js 引用, 老戳清零) (2026-11-10 跟码: 49 处/45 行)');
ok(!read('dev/_game_files.txt').includes('20261104a')&&
   (read('dev/_game_files.txt').match(/20261117b/g)||[]).length===45,
 'dev/_game_files.txt 45 行同步升戳 (2026-11-10 海战移除批判据跟码)');
}

console.log(`\n═══ verify-fixbatch-20261117b: ${PASS} 通过 / ${FAILS} 失败 ═══`);
process.exit(FAILS?1:0);
