// ─────────────────────────────────────────────
// dev/verify-perf-20261024.js —— 2026-10-24 性能排查批沙箱
// 覆盖: ①阴影半频刷新 (q0/q1 30Hz, q2 逐帧) ②大灯真灯池 60/75m 滞回 + 夜间链零分配
//       ③火源灯 85/110m 滞回 + 0.2s 扫描节流 ④Bot 手电 raycast 0.12s 节流 ⑤版本戳 20261121b
// 用法: node dev/verify-perf-20261024.js
// 纪律: 载入清单从 index.html 动态解析 (逐条同序对账, 不写死数量)。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const {THREE,document,window,sandbox,mkElement,byId}=require('./_bootstub.js');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const html=read('index.html');

// ── 载入清单: 从 index.html 动态解析 (与实载逐条同序) ──
const FILES=[...html.matchAll(/<script src="(js\/[^"?]+)\?v=[^"]*"/g)].map(m=>m[1]);
function load(ctx,file){ vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file}); }
function boot(campIdx){
for(const k in byId) delete byId[k];
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document; ctx.window=window;
ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return (k in this._s)?this._s[k]:null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of FILES) load(ctx,f);
return ctx;
}
function startGame(ctx){
return vm.runInContext(`(()=>{try{const b=document.getElementById('startBtn');if(b&&b.onclick)b.onclick();else return false;return true;}catch(e){return 'ERR:'+String(e&&e.message||e);}})()`,ctx);
}
let PASS=0,FAILS=0;
function ok(cond,label){ if(cond){ PASS++; console.log('  ✔ '+label); } else { FAILS++; console.log('  ✘ '+label); } }

console.log('── T0 载入清单 (index.html 动态对账) ──');
{
const onDisk=fs.readdirSync(path.join(root,'js')).sort();
ok(FILES.length>=40,'T0 实载脚本 '+FILES.length+' 个 (动态解析, 与 js/ 目录对账)');
ok(onDisk.every(f=>FILES.indexOf('js/'+f)>=0),'T0 js/ 目录无漏载 ('+onDisk.length+' 个文件)');
}

console.log('── T1 阴影半频刷新 (shadowRefreshTick) ──');
{
const s2=read('js/02-scene.js'), m24=read('js/24-main.js');
ok(s2.includes('function shadowRefreshTick()'),'T1 02-scene 定义 shadowRefreshTick');
ok(/if\(f===0\)\{ renderer\.shadowMap\.autoUpdate=true; return; \}/.test(s2),'T1 显式档0才恢复逐帧 (autoUpdate=true) [2026-11-11 性能批判据跟码: q2 默认不再逐帧]');
ok(!/f===-1&&SETTINGS\.quality>=2/.test(s2),'T1 跟随画质档不再含 q2 逐帧旁支 [2026-11-11 判据跟码]');
ok(/renderer\.shadowMap\.autoUpdate=false;\nrenderer\.shadowMap\.needsUpdate=\(_shadowParity===0\)&&sun\.castShadow/.test(s2.replace(/\r/g,'')),'T1 q0/q1 mod-N 帧置 needsUpdate 且夜间 (sun.castShadow=false) 跳过 [2026-11-08 判据跟码]');
ok(s2.includes('renderer.shadowMap.needsUpdate=true; // 换档重灌'),'T1 applyQuality 换档后立即补一帧');
ok((m24.match(/shadowRefreshTick\(\);/g)||[]).length===2,'T1 24-main 恰两处调用 (冻结分支+战斗分支, 均在 render 前)');
// 行为: 诺曼底 (晴) 引导 → q1 奇偶翻转 / q2 默认也半频 (2026-11-11 性能批: 阴影 pass=第二遍全量绘制)
const ctx=boot(0);
ok(startGame(ctx)===true,'T1 #0 startGame');
vm.runInContext(`
var __t1a,__t1b,__t1c,__t1d,__t1e;
SETTINGS.quality=1;
shadowRefreshTick();
__t1a={au:renderer.shadowMap.autoUpdate,nu:renderer.shadowMap.needsUpdate,cs:sun.castShadow};
shadowRefreshTick();
__t1b={nu:renderer.shadowMap.needsUpdate};
sun.castShadow=false;
shadowRefreshTick();
shadowRefreshTick();
__t1d={nu:renderer.shadowMap.needsUpdate};
sun.castShadow=true;
SETTINGS.quality=2;
shadowRefreshTick();
__t1c={au:renderer.shadowMap.autoUpdate,nu:renderer.shadowMap.needsUpdate};
shadowRefreshTick();
__t1c2={nu:renderer.shadowMap.needsUpdate};
SETTINGS.shadowFreq=0;
shadowRefreshTick();
__t1e={au:renderer.shadowMap.autoUpdate};
SETTINGS.shadowFreq=-1;
`,ctx);
const t1a=vm.runInContext('__t1a',ctx),t1b=vm.runInContext('__t1b',ctx),t1c=vm.runInContext('__t1c',ctx),t1c2=vm.runInContext('__t1c2',ctx),t1d=vm.runInContext('__t1d',ctx),t1e=vm.runInContext('__t1e',ctx);
ok(t1a.au===false&&t1a.nu===false,'T1 行为: q1 首帧 autoUpdate=false, needsUpdate=false (mod2 计数器首帧不落) [2026-11-08 判据跟码]');
ok(t1b.nu===t1a.cs,'T1 行为: q1 次帧 needsUpdate 跟随 sun.castShadow('+t1a.cs+') (半频=每2帧1次) [2026-11-08 判据跟码]');
ok(t1d.nu===false,'T1 行为: 漫射/夜间 (sun.castShadow=false) 本应落帧的 mod2 位也不置 needsUpdate ⇒ 阴影 pass 跳过 [2026-11-08 判据跟码]');
ok(t1c.au===false,'T1 行为: q2 (shadowFreq=-1 默认) 也走半频: autoUpdate=false [2026-11-11 判据跟码]');
ok(((t1c.nu===true)?1:0)+((t1c2.nu===true)?1:0)===1,'T1 行为: q2 连续两 tick 恰落帧一次 (mod2 半频, 奇偶无关判据) [2026-11-11 判据跟码]');
ok(t1e.au===true,'T1 行为: 显式 shadowFreq=0 仍可逐帧 (档位旋钮保留) [2026-11-11 判据跟码]');
}

console.log('── T2 大灯真灯池滞回 + 夜间链零分配 ──');
{
const eff=read('js/08-effects.js');
ok(eff.includes('const _hlCands=[];')&&eff.includes('const _hlCmp=(a,b)=>a._d2-b._d2;'),'T2 大灯候选表/比较器模块级 (不再逐帧新建闭包)');
ok(/function nightGearTick\(dt\)\{[\s\S]{0,400}?_hlCands\.length=0;/.test(eff),'T2 nightGearTick 复用 _hlCands (无逐帧 const cands=[])');
ok(!eff.includes('_camDistSq=p=>'),'T2 旧版逐帧 _camDistSq 闭包绝迹');
ok(eff.includes('const _pfO=V3();')&&eff.includes('const o=_pfO.copy(eye)'),'T2 手电起点复用槽 _pfO (热循环零分配)');
ok(!eff.includes('eye.clone().addScaledVector'),'T2 手电起点旧版逐帧 clone 绝迹');
ok(/v\._hlReal===undefined\) v\._hlReal=false/.test(eff)&&eff.includes('_rHold2=(NIGHT_GEAR.headRealR+15)'),'T2 真灯滞回落码 (60m 进 / +15m 出)');
// 行为: 淞沪 (#3, 开局即暗光) — 注入假坦克验证 60/75m 滞回
const ctx=boot(3);
ok(startGame(ctx)===true,'T2 #3 startGame (songhu 暗光图)');
const r=vm.runInContext(`(()=>{
try{
tanks.length=0; trucks.length=0;                 // 清场: 只留注入载具
const veh={pos:V3(0,0,-59),yaw:0,alive:true,isAI:true,playerDriven:false,lightsOn:false,grp:new THREE.Group()};
tanks.push(veh);
camera.position.set(0,2,0);
nightGearTick(0.016);
const a=_hlPool[0].visible;
veh.pos.z=-65; nightGearTick(0.016);
const b=_hlPool[0].visible;
veh.pos.z=-80; nightGearTick(0.016);
const c=_hlPool[0].visible;
return {a,b,c};
}catch(e){ return 'ERR:'+String(e&&e.stack||e); }
})()`,ctx);
if(typeof r==='string'){ ok(false,'T2 行为推演异常: '+r.slice(0,160)); }
else{
ok(r.a===true,'T2 行为: 59m 上真灯 (engage <60m)');
ok(r.b===true,'T2 行为: 65m 保持真灯 (hold <75m, 旧版此处会掉灯翻转灯态)');
ok(r.c===false,'T2 行为: 80m 释放真灯 (>75m)');
}
}

console.log('── T3 火源灯 85/110m 滞回 + 0.2s 扫描节流 ──');
{
const eff=read('js/08-effects.js');
ok(eff.includes('const _fireAssign=[null,null,null,null];')&&eff.includes('_fireScanT=0.2;'),'T3 分配槽持久化 + 0.2s 扫描节流落码');
ok(eff.includes('const HOLD2=110*110, ENG2=85*85;'),'T3 滞回常量 (85m 进 / 110m 出)');
ok(/updateFireLights\._lastT===nowT\) return;/.test(eff),'T3 双入口去重守卫保留 (2026-10-10)');
// 行为: 淞沪暗光 — 真源走 addFireSource 单源
const ctx=boot(3);
ok(startGame(ctx)===true,'T3 #3 startGame');
const r=vm.runInContext(`(()=>{
try{
FIRE_SOURCES.length=0;
for(let i=0;i<4;i++) _fireAssign[i]=null;
for(let i=0;i<20;i++){ nowT+=0.016; updateFireLights(0.016); }   // 先跑干: 保证池已建且分配空
for(let i=0;i<4;i++) _fireAssign[i]=null;
const c=camera.position;
const fs=addFireSource(c.x+50,c.z,c.y,2,999,5,null);
nowT+=1; updateFireLights(0.2);
const a=_fireLightPool[0].light.visible;
fs.x=c.x+100; nowT+=1; updateFireLights(0.2);
const b=_fireLightPool[0].light.visible;
fs.x=c.x+120; nowT+=1; updateFireLights(0.2);
const d=_fireLightPool[0].light.visible;
removeFireSource(fs);
return {a,b,d};
}catch(e){ return 'ERR:'+String(e&&e.stack||e); }
})()`,ctx);
if(typeof r==='string'){ ok(false,'T3 行为推演异常: '+r.slice(0,160)); }
else{
ok(r.a===true,'T3 行为: 50m 火源点亮 (engage <85m)');
ok(r.b===true,'T3 行为: 100m 保持点亮 (hold <110m, 旧版 85m 硬门此处已熄灭翻转)');
ok(r.d===false,'T3 行为: 120m 释放 (>110m)');
}
}

console.log('── T4 Bot 手电 raycast 0.12s 节流 ──');
{
const src=read('js/14-bots.js');
ok(src.includes('m.flRayT=0.12;')&&src.includes('m.flOccD=hit?hit.dist'),'T4 节流+occD 缓存落码 (与大灯同款)');
// 行为: RGRID.gen 每次 raycastWorld +1 → 12 帧内只应发 1~3 发 (旧版 12 发)
const ctx=boot(3);
ok(startGame(ctx)===true,'T4 #3 startGame');
const r=vm.runInContext(`(()=>{
try{
const s=soldiers.find(x=>x.alive&&x.mesh&&x.mesh.flGrp&&!x.onVehicle);
if(!s) return {skip:true};
s.flashlight=true;
camera.position.set(s.pos.x,s.pos.y+1.6,s.pos.z+10);
const g0=RGRID.gen;
for(let i=0;i<12;i++){ nowT+=0.016; s.updateMesh(0.016,2.0); }
return {n:RGRID.gen-g0,vis:s.mesh.flGrp.visible,occ:s.mesh.flOccD!==undefined};
}catch(e){ return 'ERR:'+String(e&&e.stack||e); }
})()`,ctx);
if(typeof r==='string'){ ok(false,'T4 行为推演异常: '+r.slice(0,160)); }
else if(r.skip){ ok(false,'T4 无可测士兵 (开局未刷兵?)'); }
else{
ok(r.n>=1&&r.n<=3,'T4 行为: 12 帧 updateMesh 仅 '+r.n+' 发 raycast (节流 0.12s; 旧版为 12)');
ok(r.vis===true&&r.occ===true,'T4 行为: 光锥可见 + occD 缓存在位');
}
}

console.log('── T5 版本戳 20261121b ──');
{
const stamps=[...new Set([...html.matchAll(/<script src="js\/[^"?]+\?v=([^"]+)"/g)].map(m=>m[1]))];
ok(stamps.length===1&&stamps[0]==='20261121b','T5 全部 js 引用同一版本戳 '+stamps.join(','));
const gf=read('dev/_game_files.txt');
ok(!gf.includes('v=20260928h')&&gf.includes('v=20261121b'),'T5 dev/_game_files.txt 同步升戳');
}

console.log(FAILS?('\n✗ verify-perf-20261024: '+FAILS+' 项失败'):'\n✓ verify-perf-20261024: 全部通过 ('+PASS+' 项)');
process.exit(FAILS?1:0);
