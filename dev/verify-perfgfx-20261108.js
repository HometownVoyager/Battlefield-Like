// ─────────────────────────────────────────────────────────────
// dev/verify-perfgfx-20261108.js —— 2026-11-08 性能与画面批 验收
//   主菜单新增「⚙ 性能与画面...」子面板 (#mPerfGfx, 与游戏内容设置同级): 画质三连钮迁入 +
//   五个即时生效的性能/画质旋钮。五个旋钮的档位值单源在 00-config 步进表 (UI 循环钮/应用点/探针共读):
//     ① 渲染缩放 sf_rscale  → applyQuality setPixelRatio ×RENDER_SCALE_STEPS[renderScaleIdx]
//     ② 阴影刷新 sf_shfrq   → shadowRefreshTick 档位化 (-1 跟随画质=旧行为逐位 / 0 逐帧 / 1 半频 / 2 ¼频 / 3 关)
//                             "关"走单源门 sunShadowAllowed() —— 压住 02-scene 建灯 / applySceneEnvironment /
//                             08-effects initWeather 三处 sun.castShadow 重写点, 换天气不复活
//     ③ 视距 sf_vdist       → dryFogFar() 末尾 ×VIEWDIST_STEPS[viewDistIdx] (水下雾/雾色自动继承)
//     ④ 特效粒子 sf_fxmax   → PARTICLE_MAX const→let + applyFxQuality() (调低立即回收超出)
//     ⑤ 降水密度 sf_pmul    → initWeather 两分支 n=round(precipN×PRECIP_MUL_STEPS[precipIdx])
// 覆盖: T0 载入对账 / T1 源码防回退 / T2 版本戳 / T3 存档载入校验(null/合法/非法) /
//       T4 沙箱行为(五旋钮逐项 + UI 循环钮点击链)。
// 用法: node dev/verify-perfgfx-20261108.js [--neg]
//   --neg = 阴性对照 (6 补丁, 全部单行锚, 病灶注回), 对认按红名:
//     N1 摘渲染缩放乘子  ⇒ T4 渲染缩放三断言红 + T1 乘子钉红
//     N2 摘视距乘子      ⇒ T4 雾距比值两断言红 + T1 乘子钉红
//     N3 阴影节流恒逐帧  ⇒ T4 半频/¼频计数两断言红 + T1 档位钉红
//     N4 摘粒子回收裁剪  ⇒ T4 调低立即回收断言红 + T1 裁剪钉红
//     N5 摘降水乘子(两处)⇒ T4 雪粒减半断言红 + T1 乘子钉红
//     N6 摘 sunShadowAllowed 关档早退 ⇒ T4 关档不被换天气复活断言红 + T1 门体钉红
//     T0/T2/T3 及各恢复类断言在 NEG 下仍绿。
// 口径: verify-perf-20261024 同款轻量 boot (bootstub 桩 + index.html 动态载入清单), 不开局 ——
//       22-hud initMenuUI 在脚本装载期接线 (verify-timestophud 已证 startBtn 装载期即有 onclick),
//       scene/sun/WX_CFG/PT 装载期即存在, 行为测试无需世界构建。renderer 桩本探针加窄扩展:
//       setPixelRatio 记账 + getPixelRatio 回读 (仅本进程 sandbox, 不落盘)。
// ─────────────────────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const NEG=process.argv.includes('--neg');
const {THREE,document,window,sandbox,byId}=require('./_bootstub.js');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const OK=[],BAD=[];
function assert(name,cond,detail){ (cond?OK:BAD).push(name); console.log(`  ${cond?'✓':'✗'} ${name}${detail?'  '+detail:''}`); }
function section(t){ console.log('\n══ '+t+' ══'); }
const html=read('index.html');

// renderer 桩窄扩展: 记录像素比 (在 boot 前打补丁, boot 浅拷贝共享同一 THREE)
const _BaseRenderer=sandbox.THREE.WebGLRenderer;
sandbox.THREE.WebGLRenderer=class extends _BaseRenderer{
  constructor(){ super(); let _pr=1; this.setPixelRatio=v=>{ _pr=v; }; this.getPixelRatio=()=>_pr; }
};

// ── 载入清单: 从 index.html 动态解析 (逐条同序, 不写死数量) ──
const FILES=[...html.matchAll(/<script src="(js\/[^"?]+)\?v=[^"]*"/g)].map(m=>m[1]);
function load(ctx,file){ vm.runInContext(read(file),ctx,{filename:file}); }

// ── 阴性对照 (单行锚; N5 锚在雨/雪两分支各一次, split/join 全换) ──
const PATCHES=[
 ['js/02-scene.js',')*(RENDER_SCALE_STEPS[SETTINGS.renderScaleIdx]||1));','));'],
 ['js/02-scene.js','*(NIGHT_MODE?NIGHT_CFG.fogFarMul:1)*(VIEWDIST_STEPS[SETTINGS.viewDistIdx]||1);','*(NIGHT_MODE?NIGHT_CFG.fogFarMul:1);'],
 ['js/02-scene.js','if(f===0||(f===-1&&SETTINGS.quality>=2)){ renderer.shadowMap.autoUpdate=true; return; }','if(true){ renderer.shadowMap.autoUpdate=true; return; }'],
 ['js/08-effects.js','while(particles.length>PARTICLE_MAX) recycleP(particles.shift());',''],
 ['js/08-effects.js','const n=Math.round(WX_CFG.precipN*(PRECIP_MUL_STEPS[SETTINGS.precipIdx]||1));','const n=WX_CFG.precipN;'],
 ['js/02-scene.js','if(SETTINGS.shadowFreq===3) return false;',''],
];
const PATCH_MAP={};
if(NEG) for(const [f,from,to] of PATCHES){
 const s=PATCH_MAP[f]!==undefined?PATCH_MAP[f]:read(f);
 if(s.indexOf(from)<0) throw new Error('阴性对照锚点未找到: '+f+' :: '+from.slice(0,70));
 PATCH_MAP[f]=s.split(from).join(to);
}
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:read(f));

function boot(campIdx){
 for(const k in byId) delete byId[k];
 const ctx=vm.createContext(Object.assign({},sandbox));
 ctx.document=document; ctx.window=window;
 ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return (k in this._s)?this._s[k]:null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
 for(const f of FILES) vm.runInContext(srcOf(f),ctx,{filename:f}); // NEG 补丁在源码串上应用, 勿二次读盘
 return ctx;
}
// 存档载入校验专用迷你上下文: 只装 00-config (自包含: clamp 内置; 触屏探测链要 window/navigator/matchMedia 桩)
function cfgCtx(store){
 const ctx=vm.createContext({console,window:{},navigator:{maxTouchPoints:0},matchMedia:()=>({matches:false}),
  localStorage:{_s:store,getItem(k){return (k in this._s)?this._s[k]:null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}}});
 load(ctx,'js/00-config.js');
 return ctx;
}
const S=ctx=>vm.runInContext('SETTINGS',ctx);

// ── T0 载入清单 ──
section('T0 载入清单 (index.html 动态对账)');
{
 const onDisk=fs.readdirSync(path.join(root,'js')).sort();
 assert('T0 实载脚本 '+FILES.length+' 个 (动态解析, 与 js/ 目录对账)',FILES.length>=40&&onDisk.every(f=>FILES.indexOf('js/'+f)>=0));
}

// ── T1 源码防回退 ──
section('T1 源码防回退 (新写法在 / 旧写法绝迹)');
{
 const s00=srcOf('js/00-config.js'), s02=srcOf('js/02-scene.js'), s08=srcOf('js/08-effects.js'),
       s22=srcOf('js/22-hud.js'), idx=srcOf('index.html'), i18n=read('js/00b-i18n.js');
 // 00-config: 步进表单源 + SETTINGS 字段 + 五键载入
 assert('T1 00-config 四步进表单源定义',
  s00.includes('const RENDER_SCALE_STEPS=[1,0.85,0.7,0.55];')&&s00.includes('const VIEWDIST_STEPS=[1,0.8,0.6];')&&
  s00.includes('const FXMAX_STEPS=[280,140,560];')&&s00.includes('const PRECIP_MUL_STEPS=[1,0.5,0.25];'));
 assert('T1 00-config SETTINGS 五新字段 (缺省档: 跟随画质/全部标准)',
  s00.includes('renderScaleIdx:0, shadowFreq:-1, viewDistIdx:0, fxMaxIdx:0, precipIdx:0'));
 assert('T1 00-config 五键存档载入 (sf_rscale/sf_shfrq/sf_vdist/sf_fxmax/sf_pmul)',
  ['sf_rscale','sf_shfrq','sf_vdist','sf_fxmax','sf_pmul'].every(k=>s00.includes("localStorage.getItem('"+k+"')")));
 // 02-scene: 三个应用点 + 门
 assert('T1 applyQuality 渲染缩放乘子恰 1 处',(s02.match(/\*\(RENDER_SCALE_STEPS\[SETTINGS\.renderScaleIdx\]\|\|1\)\)/g)||[]).length===1);
 assert('T1 dryFogFar 视距乘子恰 1 处 (水下雾/雾色自动继承)',(s02.match(/\*\(VIEWDIST_STEPS\[SETTINGS\.viewDistIdx\]\|\|1\);/g)||[]).length===1);
 assert('T1 sunShadowAllowed 单源门定义恰 1 处 + 关档早退在',
  (s02.match(/function sunShadowAllowed\(\)\{/g)||[]).length===1&&s02.includes('if(SETTINGS.shadowFreq===3) return false;'));
 assert('T1 旧内联 castShadow 写法全库绝迹 (02-scene+08-effects 零残留)',
  !s02.includes('sun.castShadow = NIGHT_MODE ? false')&&!s08.includes('sun.castShadow = NIGHT_MODE ? false'));
 assert('T1 shadowRefreshTick 档位化 (关档兜底 + ¼频 mod4)',
  s02.includes('if(f===3){ renderer.shadowMap.autoUpdate=false;')&&s02.includes('%((f===2)?4:2)'));
 // 08-effects: 粒子上限动态化 + 降水乘子
 assert('T1 PARTICLE_MAX let 化 + applyFxQuality + 超出回收裁剪恰 1 处',
  s08.includes('let PARTICLE_MAX=280;')&&(s08.match(/function applyFxQuality\(\)\{/g)||[]).length===1&&
  (s08.match(/while\(particles\.length>PARTICLE_MAX\) recycleP\(particles\.shift\(\)\);/g)||[]).length===1);
 assert('T1 initWeather 降水密度乘子恰 2 处 (雨+雪)',
  (s08.match(/Math\.round\(WX_CFG\.precipN\*\(PRECIP_MUL_STEPS\[SETTINGS\.precipIdx\]\|\|1\)\)/g)||[]).length===2);
 // 22-hud: 面板注册 + 接线
 assert("T1 showPanel 表注册 mPerfGfx (不注册不显示)",s22.includes("'mGameplaySet','mPerfGfx'"));
 assert('T1 面板开/返接线 + 五旋钮接线全在',
  s22.includes("el('perfSetBtn')")&&s22.includes("el('perfGfxBackBtn')")&&
  ['rscaleBtn','shfrqBtn','vdistBtn','fxmaxBtn','pmulBtn'].every(b=>s22.includes("el('"+b+"')")));
 // index.html: 面板结构
 const iSet=idx.indexOf('<div id="mSet"'), iGS=idx.indexOf('<div id="mGameplaySet"'), iPG=idx.indexOf('<div id="mPerfGfx"');
 const setBlk=iSet>=0&&iGS>iSet?idx.slice(iSet,iGS):'';
 const pgBlk=iPG>=0?idx.slice(iPG,idx.indexOf('<div id="',iPG+10)):'';
 assert('T1 index.html: 三面板齐 + 顺序 (mSet < mGameplaySet < mPerfGfx)',iSet>=0&&iGS>iSet&&iPG>iGS);
 assert('T1 mSet 段: 性能与画面入口在 / 画质三连钮已迁出 (零 qualBtn 残留)',
  setBlk.includes('id="perfSetBtn"')&&!setBlk.includes('qualBtn'));
 assert('T1 mPerfGfx 段: 标题+画质三连钮+五旋钮+返回钮全在',
  pgBlk.includes('性 能 与 画 面')&&(pgBlk.match(/class="optBtn qualBtn/g)||[]).length===3&&
  ['rscaleBtn','shfrqBtn','vdistBtn','fxmaxBtn','pmulBtn','perfGfxBackBtn'].every(b=>pgBlk.includes('id="'+b+'"')));
 // i18n: 静态键闭环钉 (全量闭环由 verify-text 看管)
 assert('T1 00b-i18n 新词条在 (入口按钮/面板标题)',
  i18n.includes("'⚙ 性能与画面...':'⚙ Performance & Graphics...'")&&i18n.includes("'性 能 与 画 面':'PERFORMANCE & GRAPHICS'"));
}

// ── T2 版本戳 ──
section('T2 版本戳 20261120b');
{
 const idx=read('index.html'), gf=read('dev/_game_files.txt');
 assert('T2 index.html ≥48 处 20261120b + __sfStyleVer + _game_files 45 行 + 旧 20261108c 清零 (2026-11-10 海战移除批判据跟码)',
  [...idx.matchAll(/20261120b/g)].length>=48&&idx.includes("window.__sfStyleVer='20261120b';")
  &&gf.split(/\r?\n/).filter(l=>l.includes('?v=20261120b')).length===45
  &&!idx.includes('20261108c')&&!gf.includes('20261108c'));
}

// ── T3 存档载入校验 (迷你上下文直装 00-config) ──
section('T3 sf_* 五键载入: null 判没存过 / 合法写入 / 非法回落默认');
{
 const d=cfgCtx({});
 assert('T3-a 无存档 → 全缺省 (缩放100/阴影跟随/视距标准/粒子标准/降水标准)',
  ['renderScaleIdx','viewDistIdx','fxMaxIdx','precipIdx'].every(k=>S(d)[k]===0)&&S(d).shadowFreq===-1);
 const l=cfgCtx({sf_rscale:'2',sf_shfrq:'3',sf_vdist:'1',sf_fxmax:'2',sf_pmul:'1'});
 assert('T3-b 合法档位号 → 逐项写入 (缩放70%/关/近/增强/精简)',
  S(l).renderScaleIdx===2&&S(l).shadowFreq===3&&S(l).viewDistIdx===1&&S(l).fxMaxIdx===2&&S(l).precipIdx===1);
 const x=cfgCtx({sf_rscale:'9',sf_shfrq:'4',sf_vdist:'3',sf_fxmax:'-1',sf_pmul:'abc'});
 assert('T3-c 非法值 (越界/负数/非数字) → 一律回落缺省',
  ['renderScaleIdx','viewDistIdx','fxMaxIdx','precipIdx'].every(k=>S(x)[k]===0)&&S(x).shadowFreq===-1);
}

// ── T4 沙箱行为 (全链装载, 不开局) ──
const ctx=boot(0);
const G=(s)=>vm.runInContext(s,ctx,{timeout:120000});

section('T4-a 渲染缩放: 画质档像素比上限 × 用户档');
{
 G('SETTINGS.quality=1; SETTINGS.renderScaleIdx=0; applyQuality();');
 assert('T4-a1 缺省 (100%) 不改画质档上限 (dpr1×q1 上限1.5 → min=1)',Math.abs(G('renderer.getPixelRatio()')-1)<1e-9);
 G('SETTINGS.renderScaleIdx=3; applyQuality();');
 assert('T4-a2 55% 档即时生效 (1×0.55)',Math.abs(G('renderer.getPixelRatio()')-0.55)<1e-9);
 G('devicePixelRatio=2; SETTINGS.renderScaleIdx=1; applyQuality();');
 assert('T4-a3 dpr2 时与画质档上限相乘 (min(2,1.5)×0.85=1.275)',Math.abs(G('renderer.getPixelRatio()')-1.275)<1e-9);
 G('devicePixelRatio=1; SETTINGS.renderScaleIdx=0; applyQuality();');
}

section('T4-b 视距: dryFogFar 末尾乘子 (水下雾/雾色继承, AI 索敌不在链上)');
{
 const b0=G('SETTINGS.viewDistIdx=0; applyQuality(); dryFogFar()');
 G('SETTINGS.viewDistIdx=1; applyQuality();');
 assert('T4-b1 近档 ×0.8',Math.abs(G('dryFogFar()')-b0*0.8)<1e-6);
 G('SETTINGS.viewDistIdx=2; applyQuality();');
 assert('T4-b2 更近档 ×0.6',Math.abs(G('dryFogFar()')-b0*0.6)<1e-6);
 G('SETTINGS.viewDistIdx=0; applyQuality();');
}

section('T4-c 阴影刷新: 档位节律 + 关档单源门 (换天气/昼夜不复活)');
{
 assert('T4-c0 前置: 沙箱昼档 (NIGHT_MODE=false, 节律计数只读 sun.castShadow 与天气无关)',G('NIGHT_MODE')===false);
 let c=0; G('sun.castShadow=true; SETTINGS.shadowFreq=-1; SETTINGS.quality=1;');
 for(let i=0;i<8;i++){ G('shadowRefreshTick()'); if(G('renderer.shadowMap.needsUpdate')===true) c++; }
 assert('T4-c1 跟随画质 (缺省-1, q1) = 半频: 8 帧 4 次 needsUpdate',c===4,'次='+c);
 G('sun.castShadow=true; SETTINGS.shadowFreq=2; renderer.shadowMap.needsUpdate=false;');
 let c2=0; for(let i=0;i<8;i++){ G('shadowRefreshTick()'); if(G('renderer.shadowMap.needsUpdate')===true) c2++; }
 assert('T4-c2 ¼频档: 8 帧 2 次 (半频再省一半)',c2===2,'次='+c2);
 G('SETTINGS.shadowFreq=0; shadowRefreshTick();');
 assert('T4-c3 逐帧档 autoUpdate=true',G('renderer.shadowMap.autoUpdate')===true);
 G('sun.castShadow=false; SETTINGS.shadowFreq=1; renderer.shadowMap.needsUpdate=false; shadowRefreshTick(); shadowRefreshTick();');
 assert('T4-c4 漫射/夜间 (castShadow=false): 应落帧的 mod2 位也不置 needsUpdate ⇒ 阴影 pass 跳过',G('renderer.shadowMap.needsUpdate')===false);
 // 关档单源门: 用 sunVis 驱动 (不依赖沙箱图默认天气), 原值先捕后还原
 const sv0=G('WX_CFG.sunVis');
 G('WX_CFG.sunVis=1; SETTINGS.shadowFreq=-1; applySceneEnvironment();');
 assert('T4-c5 门基线: 日间 sunVis=1 → castShadow=true',G('sun.castShadow')===true);
 G('SETTINGS.shadowFreq=3; applySceneEnvironment();');
 assert('T4-c6 关档: 门压 castShadow=false',G('sun.castShadow')===false);
 G('applySceneEnvironment();');
 assert('T4-c7 关档不被 applySceneEnvironment 复活',G('sun.castShadow')===false);
 G('SETTINGS.shadowFreq=-1; applySceneEnvironment();');
 assert('T4-c8 恢复跟随: 门回到 sunVis 档 true',G('sun.castShadow')===true);
 G('WX_CFG.sunVis='+JSON.stringify(sv0==null?null:sv0)+'; applySceneEnvironment();');
}

section('T4-d 特效粒子: 上限动态化 + 调低立即回收');
{
 const n0=G('SETTINGS.fxMaxIdx=2; applyFxQuality(); for(let i=0;i<200;i++) spawnP(PT.smoke,0,50,0,0,0,0,1,0,5,0.5); particles.length');
 assert('T4-d1 增强档 (560): 200 粒全保留不裁',n0===200,'n='+n0);
 const n1=G('SETTINGS.fxMaxIdx=1; applyFxQuality(); particles.length');
 assert('T4-d2 精简档 (140): 调低瞬间回收超出 (200→≤140)',n1<=140,'n='+n1);
 const n2=G('SETTINGS.fxMaxIdx=0; applyFxQuality(); for(let i=0;i<100;i++) spawnP(PT.smoke,0,50,0,0,0,0,1,0,5,0.5); particles.length');
 assert('T4-d3 回标准档 (280): 上限即时抬高 (140+100=240 ≤280)',n2===240,'n='+n2);
}

section('T4-e 降水密度: initWeather 重建按乘子缩粒');
{
 const wxp0=G('WX_CFG.precip');
 G("WX_CFG.precip='snow'; WX_CFG.precipN=420; SETTINGS.precipIdx=0; initWeather();");
 const c0=G('window.getActivePrecipObj()?window.getActivePrecipObj().geometry.attributes.position.count:-1');
 assert('T4-e1 基线: 雪粒 420 全量 (真 three count=420 / bootstub 桩 count=数组长 1260, 二者取一)',c0===420||c0===1260,'count='+c0);
 G('SETTINGS.precipIdx=1; initWeather();');
 const c1=G('window.getActivePrecipObj()?window.getActivePrecipObj().geometry.attributes.position.count:-1');
 assert('T4-e2 精简档 ×0.5: 重建后粒数减半',c1===c0/2,'count='+c1+' (基线 '+c0+')');
 G('SETTINGS.precipIdx=2; initWeather();');
 const c2=G('window.getActivePrecipObj()?window.getActivePrecipObj().geometry.attributes.position.count:-1');
 assert('T4-e3 极简档 ×0.25: 重建后 1/4',c2===Math.round(c0/4),'count='+c2);
 G('WX_CFG.precip='+JSON.stringify(wxp0==null?null:wxp0)+'; SETTINGS.precipIdx=0; initWeather();');
}

section('T4-f UI 循环钮: 点击链 (落盘+内存+apply 三账同步)');
{
 assert('T4-f0 前置: 装载期接线完成 (五钮 onclick 是函数)',
  ['rscaleBtn','shfrqBtn','vdistBtn','fxmaxBtn','pmulBtn','perfSetBtn','perfGfxBackBtn'].every(b=>typeof G("el('"+b+"').onclick")==='function'));
 G("el('rscaleBtn').onclick();");
 assert('T4-f1 渲染缩放点击: 档+1 + 存档落盘 + applyQuality 跟手 (1×0.85)',
  G('SETTINGS.renderScaleIdx')===1&&G("localStorage.getItem('sf_rscale')")==='1'&&Math.abs(G('renderer.getPixelRatio()')-0.85)<1e-9);
 G("el('rscaleBtn').onclick();el('rscaleBtn').onclick();el('rscaleBtn').onclick();");
 assert('T4-f2 循环回绕: 85→70→55→100 (4 档环)',G('SETTINGS.renderScaleIdx')===0);
 G("el('shfrqBtn').onclick();el('shfrqBtn').onclick();el('shfrqBtn').onclick();el('shfrqBtn').onclick();el('shfrqBtn').onclick();");
 assert('T4-f3 阴影刷新 5 档环: 跟随→逐帧→半频→¼频→关→跟随',G('SETTINGS.shadowFreq')===-1&&G("localStorage.getItem('sf_shfrq')")==='-1');
 G("el('vdistBtn').onclick();el('vdistBtn').onclick();el('vdistBtn').onclick();");
 assert('T4-f4 视距 3 档环回绕 + 落盘',G('SETTINGS.viewDistIdx')===0&&G("localStorage.getItem('sf_vdist')")==='0');
 G("el('fxmaxBtn').onclick();");
 assert('T4-f5 特效粒子点击 → 精简档 + 落盘',G('SETTINGS.fxMaxIdx')===1&&G("localStorage.getItem('sf_fxmax')")==='1');
 G("el('pmulBtn').onclick();");
 assert('T4-f6 降水密度点击 → 精简档 + 落盘',G('SETTINGS.precipIdx')===1&&G("localStorage.getItem('sf_pmul')")==='1');
}

// ── ⑤ 汇总 ──
section('⑤ 汇总');
console.log(`  ${NEG?'NEG':'正向'} ${OK.length} 绿 / ${BAD.length} 红`);
if(BAD.length){ console.log('  红名: '+BAD.join(' · ')); process.exit(1); }
console.log('  verify-perfgfx-20261108 全绿');
