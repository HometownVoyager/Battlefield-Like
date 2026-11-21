// ─────────────────────────────────────────────────────────────
// dev/verify-achieve-20261111.js —— 2026-11-11 成就系统批验收
//   ① 主菜单「战绩数据」→「数据成就」改名 + #mData 双页签 (战绩数据默认页/成就) + i18n 键闭环
//   ② js/27-achievements.js: 开局普查账 (startMatch 唯一漏斗建账) + 0.5s 轮询 (全部读各系统
//     既有权威状态位: FUEL<=0.05 / tr.fall·charred·dead / rec.dead / g.dead / b.dead / c.dead / w.alive)
//   ③ 四成就: 夷陵之火 (可燃格+树烧尽) / 比夷陵之火还要好 (烧账∪全部可破坏物, 空账豁免) /
//     自刎归天 (真链: 真手雷炸死自己, die() 置 killerName='你'+killerSrc='手雷') /
//     狗熊岭之王 (全树倒伏 tr.fall) —— 缩账法: 探针把普查账缩到最小集再触发真事件
//   ④ 观战可达成 (2026-11-11 用户改令: R5 门已撤, spectator 照常解锁) + sf_ach 持久化跨 boot
//   ⑤ Toast 加料版 (金带头章/名称/描述/进度 + 防连跳双保险闩 ACH_TOASTED) + 成就页渲染 (achOnPanelShown 经 showPanel('mData') 真调用)
//   ⑥ 终身累计 sf_stats (击毁载具/击杀/死亡/胜负/占领 + 观战局不累计) + 清除游戏数据 (四类键全清, 设置保留)
// 用法: node dev/verify-achieve-20261111.js [--neg] [--only=N]
//   --neg = 阴性对照 (10 补丁, 对认按红名): N1 建账钩摘除 (startMatch) / N2 观战门回插 /
//   N3 自刎判据反转 / N4 倒伏判据摘 fall / N5 解锁不落盘 / N6 改名回退 / N7 面板接线摘除 /
//   N8 击毁载具钩摘除 / N9 观战局累计门摘除 / N10 清除数据枚举摘除。
//   --only=N = 只打第 N 个补丁 (N1 掩盖 S2~S7 全部普查判据; N4 连带 S5 倒伏账; 单补丁亲见转红)。
// 口径: 与 verify-aircollide-20261110 同款 boot (真 three + index.html 全脚本链 + startBtn 开局)。
// ─────────────────────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const NEG=process.argv.includes('--neg');
const OK=[],BAD=[];
function assert(name,cond,detail){ (cond?OK:BAD).push(name); console.log(`  ${cond?'✓':'✗'} ${name}${detail?'  '+detail:''}`); }
function section(t){ console.log('\n══ '+t+' ══'); }
const SRC=f=>fs.readFileSync(path.join(root,f),'utf8');

const patchStyle=(el)=>{ if(el&&el.style&&typeof el.style.setProperty!=='function') el.style.setProperty=function(k,v){ this[k]=v; }; return el; };
const _stub=require('./_bootstub.js');
{
const document=_stub.document;
const g=document.getElementById.bind(document), c=document.createElement.bind(document), q=document.querySelector.bind(document);
document.getElementById=(id)=>patchStyle(g(id));
document.createElement=(t)=>patchStyle(c(t));
document.querySelector=(s)=>patchStyle(q(s));
}

// ── 阴性对照 (一律单行锚) ──
const PATCHES_ALL=[
 // N1 病灶还原: startMatch 建账钩摘除 (普查账恒 null ⇒ S2~S7 全红)
 ['js/23-deploy.js', "if(typeof ACH!=='undefined'&&ACH.onFreshMatch) ACH.onFreshMatch(); // 成就普查账", "if(false&&typeof ACH!=='undefined'&&ACH.onFreshMatch) ACH.onFreshMatch(); // NEG N1 建账摘除"],
 // N2 病灶还原: 观战门回插 (2026-11-11 用户改令**之前**的旧口径: 观战不解锁 ⇒ ⑦-1 红)
 ['js/27-achievements.js', ' if(!c) return;', " if(!c) return;\n if(typeof player!=='undefined'&&player&&player.spectator===true) return; // NEG N2 观战门回插"],
 // N3 病灶还原: 自刎判据反转 (手雷字面量改成非; 锚含语句尾 ⇒ 注释钉行尾, 行中 // 会吃掉 ") achUnlock" 炸语法)
 ['js/27-achievements.js', "player.killerName==='你'&&player.killerSrc==='手雷') achUnlock('seppuku');", "player.killerName==='你'&&player.killerSrc!=='手雷') achUnlock('seppuku'); // NEG N3 自刎判据反转"],
 // N4 病灶还原: 倒伏判据摘 fall (treeFall 只置 fall ⇒ 狗熊岭之王永不达成)
 ['js/27-achievements.js', 'if(tr.fall!=null||tr.dead===true||tr.alive===false) treeFell++;', 'if(tr.dead===true||tr.alive===false) treeFell++; // NEG N4'],
 // N5 病灶还原: 解锁不落盘 (内存有、localStorage 无; 块注释 —— achSaveState 是单行 try/catch, 行中 // 会吃掉行尾 catch 炸语法)
 ['js/27-achievements.js', "localStorage.setItem('sf_ach',JSON.stringify(ACH_STATE));", "/* NEG N5 不落盘 */"],
 // N6 病灶还原: 主菜单按钮改名回退
 ['index.html', '>数 据 成 就</button>', '>战 绩 数 据</button> <!-- NEG N6 -->'],
 // N7 病灶还原: showPanel 成就页接线摘除 (成就面板恒空)
 ['js/22-hud.js', 'ACH.onPanelShown) ACH.onPanelShown(); // 数据成就页签', "ACH.onPanelShown) ; // NEG N7"],
 // N8 病灶还原: 击毁载具账摘除 (坦克 die 链钩 no-op ⇒ 终身击毁载具恒少计)
 ['js/15-vehicles.js', 'if(attacker.isPlayer) attacker.vehKills=(attacker.vehKills||0)+1; // 终身击毁载具账', '; // NEG N8 击毁载具钩摘除'],
 // N9 病灶还原: 观战局累计门摘除 (观战免伤刷数照进 sf_stats)
 ['js/21-match.js', 'if(!counted) return LIFE_STATS;', 'if(false) return LIFE_STATS; // NEG N9'],
 // N10 病灶还原: 清除数据枚举摘除 (按钮执行后四类键原地不动; 锚含行尾 " }" —— for 收口在同一行, 行中 // 会吃掉它炸语法)
 ['js/21-match.js', "if(k&&(k.indexOf('sf_rec_')===0||k.indexOf('sf_best_')===0||k==='sf_ach'||k==='sf_stats')) kill.push(k); }", "/* NEG N10 */ }"],
];
const _onlyArg=NEG?(process.argv.find(a=>a.startsWith('--only='))||''):'';
const PATCHES=_onlyArg?PATCHES_ALL.filter((p,i)=>String(i+1)===_onlyArg.slice(7)):PATCHES_ALL;
const PATCH_MAP={};
if(NEG) for(const [f,from,to] of PATCHES){
 const s=PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f);
 if(s.indexOf(from)<0) throw new Error('阴性对照锚点未找到: '+f+' :: '+from.slice(0,70));
 PATCH_MAP[f]=s.split(from).join(to);
}
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f));

// ── ① 源码防回退 ─────────────────────────────────────────────
section('① 源码防回退 (改名/页签/接线/普查口径/戳)');
{
const ih=srcOf('index.html'), gf=SRC('dev/_game_files.txt'), i18=srcOf('js/00b-i18n.js'),
      s27=srcOf('js/27-achievements.js'), s22=srcOf('js/22-hud.js'), s23=srcOf('js/23-deploy.js'),
      s24=srcOf('js/24-main.js'), s21=srcOf('js/21-match.js'),
      s15=srcOf('js/15-vehicles.js'), s15b=srcOf('js/15b-trucks.js'), s16=srcOf('js/16-aircraft.js'), s15d=srcOf('js/15d-naval.js'),
      css=SRC('css/style.css'), ra=SRC('dev/run-all-verify.js');
assert('index.html: 按钮+面板标题已改「数 据 成 就」(NEG N6 转)', ih.includes('>数 据 成 就</button>')&&ih.includes('<h2 class="mSubTitle" data-i18n>数 据 成 就</h2>'));
assert('index.html: #mData 双页签结构 (dataTabs + data-dt 双页 + dataRecPane/dataAchPane)',
 ih.includes('id="dataTabs"')&&ih.includes('data-dt="rec"')&&ih.includes('data-dt="ach"')
 &&ih.includes('id="dataRecPane"')&&ih.includes('id="dataAchPane"'));
const scripts=[...ih.matchAll(/src="(js\/[^"?]+)/g)].map(m=>m[1]);
assert('index.html: 27-achievements 插在 26-commander 与 24-main 之间 (verify-commander 插入位契约不破坏)',
 scripts.indexOf('js/26-commander.js')<scripts.indexOf('js/27-achievements.js')&&scripts.indexOf('js/27-achievements.js')<scripts.indexOf('js/24-main.js'));
assert('00b-i18n: 新键在/旧键删 (键闭环由 verify-text② 兜底)',
 i18.includes("'数 据 成 就':'DATA & AWARDS'")&&i18.includes("'战绩数据':'Records'")&&i18.includes("'成 就':'Achievements'")
 &&i18.includes("'成就已达成':'Achievement Unlocked'")&&i18.includes("'成就一经达成永久保存'")
 &&!i18.includes("'战 绩 数 据':'")&&!i18.includes("'观战模式无法达成成就'"));
assert('00b-i18n: 终身累计+清除数据词条齐',i18.includes("'总共击毁载具':'Total Vehicles Destroyed'")&&i18.includes("'总共击杀':'Total Kills'")
 &&i18.includes("'总共胜利':'Total Wins'")&&i18.includes("'总共失败':'Total Losses'")&&i18.includes("'总共占领旗点':'Total Flag Captures'")
 &&i18.includes("'🗑 清除游戏数据'")&&i18.includes("'⚠ 再点一次确认清除'")&&i18.includes("'终身累计':'LIFETIME TOTALS'"));
assert('00b-i18n: 四成就名+描述 EN 词条齐',i18.includes("'夷陵之火':'Fire of Yiling'")&&i18.includes("'比夷陵之火还要好':'Better than the Fire of Yiling'")
 &&i18.includes("'自刎归天':'Death by Own Grenade'")&&i18.includes("'狗熊岭之王':'King of Bear Ridge'"));
assert('27-achievements: 定义表五条 (id/name/kind; 2026-11-14 跟码 +likud_pilot)',(s27.match(/\{id:'/g)||[]).length===5&&s27.includes("id:'yiling_fire'")&&s27.includes("id:'better_yiling'")
 &&s27.includes("id:'seppuku'")&&s27.includes("id:'bear_king'")&&s27.includes("id:'likud_pilot'"));
assert('27-achievements: 普查口径单源 (FUEL>0.05 / FLORA_HASH 四树类 / DESTRUCTIBLES !dead / crush 盒排树篱 / explosive 桶 / wires alive)',
 s27.includes('if(FUEL[ci]>0.05) cells.push(ci)')&&s27.includes("k==='tree'||k==='willow'||k==='palm'||k==='dead'")
 &&s27.includes('if(g&&!g.dead) structs.push(g)')&&s27.includes('b.crush&&!b.flora&&!b.dead')
 &&s27.includes('c.explosive&&!c.dead')&&s27.includes('w.alive!==false'));
assert('27-achievements: 达成判据 (烧尽 FUEL<=0.05 / 树 charred‖dead / 倒伏 fall‖dead‖!alive / 空账豁免 burnAll-fellAll)',
 s27.includes('if(FUEL[c.cells[i]]<=0.05) burnCells++')&&s27.includes('if(tr.charred===true||tr.dead===true) treeBurn++')
 &&s27.includes('if(tr.fall!=null||tr.dead===true||tr.alive===false) treeFell++')
 &&s27.includes('const burnAll=burnDone===burnTotal;')&&s27.includes('const fellAll=c.trees.length===0||treeFell===c.trees.length;'));
assert('27-achievements: 自刎判据 (死亡边沿 deaths + killerName 你 + killerSrc 手雷; 自击不进 killfeed 只能轮询尸检字段)',
 s27.includes("(player.deaths||0)!==_achLastDeaths")&&s27.includes("player.alive===false&&player.killerName==='你'&&player.killerSrc==='手雷'"));
assert('27-achievements: 观战可达成 (R5 门已撤: 无 spec 门/无 achIsSpec) + 时停门 (dt<=0 不评) + 0.5s 节流',
 !s27.includes('if(spec) return;')&&!s27.includes('achIsSpec')
 &&s27.includes('if(!ACH_CENSUS||!(dt>0)) return;')&&s27.includes('_achAcc<0.5'));
assert('27-achievements: 防连跳双保险 (ACH_STATE 永久账守卫 + ACH_TOASTED 会话闩 + resetAll)',
 s27.includes('if(ACH_STATE[id]) return;')&&s27.includes('if(ACH_TOASTED[id]) return;')
 &&s27.includes('const ACH_TOASTED={};')&&s27.includes('resetAll:function'));
assert('27-achievements: 存档 sf_ach + Toast 挂 body (#achToast) + 页签复位默认 rec',
 s27.includes("localStorage.getItem('sf_ach')")&&s27.includes("document.body.appendChild(ACH_TOAST_EL)")
 &&s27.includes("achSetPane('rec');"));
assert('27-achievements: 加料弹框单源 (achProgText 进度行 + 头章/描述/进度 DOM + 位置双形制现读)',
 s27.includes('function achProgText(kind)')&&s27.includes("'<div class=\"achTRibbon\">'")&&s27.includes("'<div class=\"achTDesc\">'")
 &&s27.includes("'<div class=\"achTProg\">'")&&s27.includes('function achPosMode()')&&s27.includes("localStorage.getItem('sf_ach_pos')")&&s27.includes("posBC':'posTR"));
assert('index.html: 清除游戏数据按钮+说明 + 终身累计容器 (数据统计页签顶部)',
 ih.includes('id="clearDataBtn"')&&ih.includes('id="lifeStatsWrap"')
 &&ih.includes('<div class="secLabel" data-i18n>数据</div>')&&ih.includes('<div class="secLabel" data-i18n>终身累计</div>'));
assert('21-match: 终身累计单源 (statsLoad/statsAccumulate counted 门/veh/winner + recLifeHTML + clearGameData 四类键)',
 s21.includes("localStorage.getItem('sf_stats')")&&s21.includes('function statsAccumulate(winner)')
 &&s21.includes('if(!counted) return LIFE_STATS;')&&s21.includes('LIFE_STATS.veh=(LIFE_STATS.veh||0)+(player.vehKills||0)')
 &&s21.includes('winner===player.team')&&s21.includes('function recLifeHTML()')
 &&s21.includes('function clearGameData()')&&s21.includes("k.indexOf('sf_rec_')===0")&&s21.includes('ACH.resetAll'));
assert('21-match: endMatch 接线 (recCommit 后 statsAccumulate(winner), winner 与结算页同源)',
 s21.includes('statsAccumulate(winner); // 终身累计'));
assert('22-hud: lifeStatsWrap 刷新 + clearDataBtn 两段式接线 (武装/执行/回显)',
 s22.includes("el('lifeStatsWrap')")&&s22.includes("el('clearDataBtn')")&&s22.includes('clearGameData():0')&&s22.includes('再点一次确认清除'));
assert('css: 终身累计六格 + Toast 加料类 + 武装态',css.includes('.lifeGrid')&&css.includes('.lifeCell')&&css.includes('.achTRibbon')
 &&css.includes('.achTDesc')&&css.includes('.achTProg')&&css.includes('@keyframes achPulse')&&css.includes('.optBtn.danger'));
assert('接线三处 typeof 守卫 (23-deploy 建账 / 24-main 轮询 / 22-hud showPanel)',
 s23.includes("if(typeof ACH!=='undefined'&&ACH.onFreshMatch) ACH.onFreshMatch();")
 &&s24.includes("if(typeof ACH!=='undefined'&&ACH.update) ACH.update(dt);")
 &&s22.includes("ACH.onPanelShown) ACH.onPanelShown();"));
assert('四处击毁载具钩 (坦克/卡车/战机/舰艇 die 链 attacker.isPlayer; NEG N8 转)',
 s15.includes('attacker.vehKills=(attacker.vehKills||0)+1')&&s15b.includes('attacker.vehKills=(attacker.vehKills||0)+1')
 &&s16.includes('attacker.vehKills=(attacker.vehKills||0)+1')&&s15d.includes('attacker.vehKills=(attacker.vehKills||0)+1'));
assert('index.html: 成就弹窗位置设置 (游戏内容设置内 achPosBtn + 说明)',
 ih.includes('id="achPosBtn"')&&ih.includes('成就弹窗位置')&&ih.includes('从下升起'));
assert('22-hud: achPosBtn 单钮循环接线 (sf_ach_pos tr/bc 即时生效)',s22.includes("el('achPosBtn')")&&s22.includes('sf_ach_pos'));
assert('css: Toast 位置双形制 (posTR 右上竖卡 / posBC 正下横匾)',
 css.includes('#achToast.posTR')&&css.includes('#achToast.posBC')&&css.includes('#achToast.posTR.show')&&css.includes('#achToast.posBC.show'));
assert('00b-i18n: 弹窗位置词条',i18.includes("'成就弹窗位置':'Achievement Toast Position'")&&i18.includes("'右上':'Top Right'")&&i18.includes("'正下':'Bottom Center'"));
assert('css: 成就列表 + Toast 样式在册 (#dataAchPane/.achRow/.achState/#achToast)',
 css.includes('#dataAchPane')&&css.includes('.achRow')&&css.includes('.achState')&&css.includes('#achToast'));
assert('run-all 已登记本探针',ra.includes('verify-achieve-20261111.js'));
assert('版本戳 20261122b: index.html ≥48 处 + __sfStyleVer + _game_files 45 行 + 旧 20261110c 清零 (本批 c→d, 新文件+1)',
 [...ih.matchAll(/20261122b/g)].length>=48&&ih.includes("window.__sfStyleVer='20261122b';")
 &&gf.split(/\r?\n/).filter(l=>l.includes('?v=20261122b')).length===45
 &&gf.includes('27-achievements.js?v=20261122b')
 &&!ih.includes('20261110c')&&!gf.includes('20261110c'));
}

// ── 沙箱装载 (真 three; 与 verify-aircollide 同款 boot + sf_ach 预置) ──
function loadRealTHREE(){
 const m={exports:{}};
 const s={console,Math,JSON,Date,module:m,exports:m.exports,self:null,globalThis:null,
  window:{addEventListener(){},removeEventListener(){},devicePixelRatio:1},
  document:{createElementNS:()=>({style:{}}),createElement:()=>({style:{},getContext:()=>null})},
  navigator:{userAgent:'node'},requestAnimationFrame:()=>0,cancelAnimationFrame(){},performance:{now:()=>Date.now()},
  setTimeout:()=>0,clearTimeout(){},URL:{createObjectURL(){return ''},revokeObjectURL(){}},Blob:function(){},Image:function(){},
 };
 s.self=s; s.globalThis=s;
 vm.createContext(s);
 vm.runInContext(fs.readFileSync(path.join(root,'dev/vendor/three.min.js'),'utf8'),s,{filename:'dev/vendor/three.min.js'});
 return m.exports;
}
const REAL_THREE=loadRealTHREE(); // 2026-11-19 效率批: three.min.js 解析只做一次 (per-boot 补丁幂等, 先例 verify-vehburn-20261109)
const html=SRC('index.html');
const FILES=[...html.matchAll(/src="(js\/[^"?]+)/g)].map(m=>m[1]);
function boot(campIdx,achSeed){
 const T=REAL_THREE; // 效率批: 解析去重
 T.WebGLRenderer=class{ constructor(){ this.domElement=Object.assign(document.createElement('canvas'),{width:0,height:0}); this.shadowMap={enabled:false,type:0,autoUpdate:true};
  this.setSize=()=>{}; this.setPixelRatio=()=>{}; this.render=()=>{}; this.clear=()=>{}; this.clearDepth=()=>{};
  this.outputColorSpace=''; this.setClearColor=()=>{}; this.setAnimationLoop=()=>{}; } };
 const stub=_stub;
 const sandbox=stub.sandbox,document=stub.document,window=stub.window;
 sandbox.THREE=T; sandbox.window.THREE=T;
 const V3c=T.Vector3;
 if(!V3c.prototype.addScalar) V3c.prototype.addScalar=function(s){ this.x+=s; this.y+=s; this.z+=s; return this; };
 if(!V3c.prototype.divideScalar) V3c.prototype.divideScalar=function(s){ s=s||1; this.x/=s; this.y/=s; this.z/=s; return this; };
 T.Object3D.prototype.clear=function(){ this.children.length=0; return this; };
 const AP=()=>({value:0,setValueAtTime(){},setTargetAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}});
 class ACStub{
 createOscillator(){ return {frequency:AP(),detune:AP(),type:'',start(){},stop(){},connect(){},onended:null}; }
 createGain(){ return {gain:AP(),connect(){},disconnect(){}}; }
 createBuffer(){ return {getChannelData:()=>new Float32Array(16),duration:1,numberOfChannels:1}; }
 createBufferSource(){ return {buffer:null,loop:false,playbackRate:AP(),start(){},stop(){},connect(){},onended:null}; }
 createBiquadFilter(){ return {type:'',frequency:AP(),detune:AP(),Q:AP(),connect(){}}; }
 createDynamicsCompressor(){ return {threshold:AP(),ratio:AP(),attack:AP(),release:AP(),connect(){}}; }
 createStereoPanner(){ return {pan:AP(),connect(){}}; }
 resume(){ return Promise.resolve(); } get state(){ return 'running'; } get destination(){ return {}; }
 get currentTime(){ return 0; } get sampleRate(){ return 44100; }
 }
 sandbox.AudioContext=ACStub; sandbox.window.AudioContext=ACStub; sandbox.window.webkitAudioContext=ACStub;
 delete sandbox.window.CANNON;
 const byId={};
 const ctx=vm.createContext(Object.assign({},sandbox));
 ctx.document=Object.assign({},document,{getElementById:id=>{ if(!byId[id]){ byId[id]=document.createElement('div'); byId[id].id=id; } return byId[id]; }});
 const listeners={};
 const addL=(t,f)=>{ (listeners[t]=listeners[t]||[]).push(f); };
 ctx.addEventListener=addL; ctx.removeEventListener=()=>{};
 ctx.document.addEventListener=addL; ctx.document.removeEventListener=()=>{};
 ctx.window=Object.assign({},window,{addEventListener:addL,removeEventListener(){}});
 ctx.dispatchEvent=ev=>{ if(!ev.preventDefault) ev.preventDefault=()=>{}; if(!ev.stopPropagation) ev.stopPropagation=()=>{}; for(const f of (listeners[ev.type]||[]).slice()) f(ev); return true; };
 ctx.KeyboardEvent=class{ constructor(t,o){ o=o||{}; this.type=t; this.code=o.code; this.repeat=!!o.repeat; } };
 ctx.MouseEvent=class{ constructor(t,o){ o=o||{}; this.type=t; this.button=o.button; } };
 ctx.globalThis=ctx;
 ctx.setTimeout=(f)=>{ try{ f(); }catch(e){ console.log('  [异步桩] '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | ')); } return 0; };
 ctx.clearTimeout=()=>{};
 ctx.localStorage={_s:{sf_campaign:String(campIdx),sf_exp:'0',sf_pseed:'424242'},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];},get length(){return Object.keys(this._s).length;},key(i){const a=Object.keys(this._s);return i<a.length?a[i]:null;}};
 if(achSeed) ctx.localStorage._s.sf_ach=achSeed;
 for(const f of FILES){ vm.runInContext(srcOf(f),ctx,{filename:f}); }
 return ctx;
}
let IDX=-1;
{ const c0=boot(0); IDX=vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="normandy")',c0); }
const ctx=boot(IDX);
const G=s=>vm.runInContext(s,ctx,{timeout:300000});
let err=null;
try{ G("document.getElementById('startBtn').onclick();"); }catch(e){ err='start: '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); }
if(!err) try{ G("player.team=0; player.cls=0; player.spectator=false; player.alive=true; player.deployed=true;"); }catch(e){ err='playerInit: '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); }
assert('② 前置: 开局+玩家就位',!err&&G('typeof planes==="object"')===true,err||'');

// ── ② 开局普查账 ────────────────────────────────────────────
section('② 开局普查账: startMatch 漏斗建账 (FUEL/树/植被/结构/props/桶/铁丝网)');
{
assert('②-1 ACH 已载入且普查账非空 (NEG N1 转: 恒 null)',G('typeof ACH!=="undefined"&&!!ACH&&!!ACH.census()')===true);
assert('②-2 可燃格账 >0 (开局 FUEL>0.05 的格子)',G('!!ACH.census()')===true&&G('ACH.census().cells.length')>0,'cells='+G('ACH.census()?ACH.census().cells.length:-1'));
assert('②-3 树账 >0 且与 FLORA_HASH 四树类口径一致 (tree/willow/palm/dead, 排已死)',
 G('!!ACH.census()')===true
 &&G('(function(){var n=0; FLORA_HASH.forEach(function(arr){ if(!arr) return; for(var i=0;i<arr.length;i++){ var r=arr[i]; if(r&&!r.dead&&r.alive!==false&&(r.kind==="tree"||r.kind==="willow"||r.kind==="palm"||r.kind==="dead")) n++; } }); return n; })()')===G('ACH.census().trees.length'),
 'trees='+G('ACH.census()?ACH.census().trees.length:-1'));
assert('②-4 结构组账 >0 且排除构建期预塌 (全部 !dead 且与 DESTRUCTIBLES 现存口径一致)',
 G('!!ACH.census()')===true&&G('ACH.census().structs.length')>0&&G('ACH.census().structs.every(function(g){return !g.dead;})')===true
 &&G('ACH.census().structs.length')===G('DESTRUCTIBLES.filter(function(g){return !g.dead;}).length'),
 'structs='+G('ACH.census()?ACH.census().structs.length:-1')+'/'+G('DESTRUCTIBLES.length'));
G('if(ACH.census()){ globalThis._nc=ACH.census().cells.length; globalThis._nt=ACH.census().trees.length; globalThis._ns=ACH.census().structs.length; globalThis._nf=ACH.census().flora.length; globalThis._np=ACH.census().props.length; globalThis._nb=ACH.census().barrels.length; globalThis._nw=ACH.census().wires.length; }'); // N1 档账恒 null ⇒ 就地跳过 (探针不得 crash, 红由 ②-1~②-4 认领)
console.log(`  · 账目: 格=${G('globalThis._nc')} 树=${G('globalThis._nt')} 植被=${G('globalThis._nf')} 结构=${G('globalThis._ns')} props=${G('globalThis._np')} 桶=${G('globalThis._nb')} 铁丝网=${G('globalThis._nw')}`);
assert('②-5 树/植被/结构账均非空 (normandy 有林有村; 三账任一为空则该图成就口径失效)',G('globalThis._nt')>0&&G('globalThis._nf')>0&&G('globalThis._ns')>0);
}

// ── 工具: 清账重开 (重建普查账 + 清成就存档) ──
const RESET="ACH.onFreshMatch(); (function(){ for(const k in ACH_STATE) delete ACH_STATE[k]; for(const k in ACH_TOASTED) delete ACH_TOASTED[k]; })();"; // 闩同清: 各段解锁重新可弹 (⑩ 内容复读依赖)

// ── ③ 夷陵之火: 缩账到 1 格 + 真烧尽路径 ────────────────────
section('③ 夷陵之火: 真链烧尽 (igniteCell→updateFires 烧尽块→FUEL<=0.05 轮询) + 解锁/落盘/Toast');
{
G(RESET+" globalThis.__c0=ACH.census().cells[0]; ACH.census().cells.length=1; ACH.census().trees.length=0;"); // 只缩烧账: 植被/结构账保留 ⇒ better_yiling 不同帧双解锁 (旧版连播第二条顶掉 Toast 内容的假红根因)
G("igniteCell(__c0,player); FUEL[__c0]=0.001; for(let i=0;i<6;i++) updateFires(0.1);");
assert('③-1 真烧尽路径命中 (updateFires 烧尽块把 FUEL 归零)',G('FUEL[__c0]')<=0,'FUEL='+G('FUEL[__c0]'));
G("ACH.update(1);");
assert('③-2 夷陵之火解锁 (NEG N1 转: 账空恒不解锁)',G('!!ACH.state().yiling_fire')===true);
assert('③-3 解锁已落盘 sf_ach (NEG N5 转: 内存有账无)',G('(function(){ try{ return JSON.parse(localStorage.getItem("sf_ach")||"{}").yiling_fire?true:false; }catch(e){ return false; } })()')===true);
assert('③-4 Toast 已播 (挂 body #achToast: 头带+名称+描述+进度四料)',
 G('!!ACH_TOAST_EL')===true
 &&String(G('ACH_TOAST_EL.innerHTML')).includes('achTRibbon')&&String(G('ACH_TOAST_EL.innerHTML')).includes('成就已达成')
 &&String(G('ACH_TOAST_EL.innerHTML')).includes('夷陵之火')&&String(G('ACH_TOAST_EL.innerHTML')).includes('烧掉全部可以烧掉的东西')
 &&String(G('ACH_TOAST_EL.innerHTML')).includes('可燃物 1/1'),
 String(G('ACH_TOAST_EL.innerHTML')).slice(0,300));
}

// ── ④ 狗熊岭之王: 缩账到 1 树 + 真倒伏路径 ──────────────────
section('④ 狗熊岭之王: 真链倒伏 (treeFall 幂等门置 tr.fall → 倒伏判据轮询)');
{
G(RESET+" globalThis.__TR=null; (function(){ const T=ACH.census().trees; for(const t of T){ if(t.alive&&t.cyl&&!t.cyl.dead){ __TR=t; break; } } })();");
assert('④-1 候选树已选 (取自树账本体)',G('!!__TR')===true);
G("ACH.census().cells.length=0; ACH.census().trees.length=0; ACH.census().trees.push(__TR); ACH.census().flora.length=0; ACH.census().structs.length=0; ACH.census().props.length=0; ACH.census().barrels.length=0; ACH.census().wires.length=0; treeFall(__TR,1,0); ACH.update(1);");
assert('④-2 真倒伏已发生 (treeFall 置 fall; NEG N4 转: 判据摘 fall 永不解锁)',G('!!__TR.fall')===true);
assert('④-3 狗熊岭之王解锁',G('!!ACH.state().bear_king')===true);
}

// ── ⑤ 比夷陵之火还要好: 缩账到 1 结构组 + 真摧毁路径 ────────
section('⑤ 比夷陵之火还要好: 真链摧毁 (destroyStructure 置 g.dead) + 空账豁免口径 (无植被图可达成)');
{
G(RESET+" globalThis.__G0=null; (function(){ const S=ACH.census().structs; for(const g of S){ if(g&&!g.dead&&!g.onDead){ __G0=g; break; } } if(!__G0) __G0=S[0]; })();");
G("ACH.census().cells.length=0; ACH.census().trees.length=0; ACH.census().flora.length=0; ACH.census().structs.length=0; ACH.census().structs.push(__G0); ACH.census().props.length=0; ACH.census().barrels.length=0; ACH.census().wires.length=0; destroyStructure(__G0,false,null); ACH.update(1);");
assert('⑤-1 真摧毁已发生 (g.dead 置位)',G('!!__G0.dead')===true);
assert('⑤-2 比夷陵之火还要好解锁 (烧账空豁免+全分账空豁免; grandTotal>0 门仍在)',
 G('!!ACH.state().better_yiling')===true);
}

// ── ⑥ 自刎归天: 真链 (真手雷炸死自己) ───────────────────────
section('⑥ 自刎归天: 真雷真炸 (throwNade→updateNades→explodeAt noFF→damage→die→尸检字段)');
{
G(RESET+" globalThis.__SP=null; { const R=MAP_SIZE/2-60; for(let z=-R;z<=R&&!__SP;z+=9)for(let x=-R;x<=R;x+=9){ const gh=heightAt(x,z); if(gh<1||gh>40) continue; let ok=true; for(const b of BOXES){ if(b.dead) continue; if(Math.max(b.minX-x,0,x-b.maxX)<4&&Math.max(b.minZ-z,0,z-b.maxZ)<4&&b.minY<gh+2&&b.maxY>gh-1){ ok=false; break; } } if(!ok) continue; for(const c of CYLS){ if(c.dead) continue; const dx=c.x-x,dz=c.z-z; if(dx*dx+dz*dz<9){ ok=false; break; } } if(!ok) continue; __SP={x:x,z:z,gh:gh}; break; } }");
assert('⑥-1 自刎场地已找到 (无盒无柱, 真雷不串账)',G('!!__SP')===true);
G("player.alive=true; player.hp=20; player.protUntil=0; player.nadeHeld=false; player.spectator=false; player.onVehicle=null; player.pos.set(__SP.x,__SP.gh,__SP.z); player._src='手雷'; throwNade(player,V3(player.pos.x,player.pos.y+1.4,player.pos.z),V3(0.1,-0.5,0.1),0); globalThis._removed=false; for(let i=0;i<200;i++){ updateNades(0.05,0.05); if(nades.length===0){ _removed=true; break; } }");
assert('⑥-2 真雷已引爆离账',G('_removed')===true,'nades='+G('nades.length'));
assert('⑥-3 玩家已被自己的雷炸死 (alive=false + 尸检字段 你/手雷; 手雷中立批 s!==attacker 自伤保留)',
 G('player.alive')===false&&G('player.killerName')==='你'&&G('player.killerSrc')==='手雷',
 'killer='+G('player.killerName')+'/'+G('player.killerSrc'));
assert('⑥-4 死亡等待期不算观战 (spectator 保持 false, 成就窗口不关)',G('player.spectator')===false);
G("ACH.update(1);");
assert('⑥-5 自刎归天解锁 (NEG N3 转: 判据反转)',G('!!ACH.state().seppuku')===true);
// ⑧ 持久化改用字面量 seed (与段序解耦: 各段 RESET 只留本段解锁, 此处账上只有 seppuku —— 旧 ⑧-1 假红根因)
}

// ── ⑦ 观战可达成 (2026-11-11 用户改令: R5 门已撤) ───────────
section('⑦ 观战可达成: spectator=true 照常解锁 (R5 门已撤)');
{
G(RESET+" globalThis.__c1=ACH.census().cells[0]; ACH.census().cells.length=1; ACH.census().trees.length=0; ACH.census().flora.length=0; ACH.census().structs.length=0; ACH.census().props.length=0; ACH.census().barrels.length=0; ACH.census().wires.length=0; player.spectator=true; FUEL[__c1]=0; ACH.update(1);");
assert('⑦-1 观战期间照常解锁 (NEG N2 转: 观战门回插压住)',G('!!ACH.state().yiling_fire')===true);
G("player.spectator=false;");
assert('⑦-2 观战标记复位 (不影响后续)',G('player.spectator')===false);
}

// ── ⑧ 持久化跨 boot ─────────────────────────────────────────
section('⑧ 持久化: sf_ach 跨整页重载 (新 boot 预置存档 → 模块载入即恢复)');
{
const achSeed='{"yiling_fire":1,"bear_king":2,"better_yiling":3,"seppuku":4}'; // 字面量 seed: 与段序解耦 (各段 RESET 只留本段解锁)
const ctx2=boot(IDX,achSeed);
const s2=vm.runInContext('JSON.stringify({y:!!ACH_STATE.yiling_fire,b:!!ACH_STATE.bear_king,d:!!ACH_STATE.better_yiling,s:!!ACH_STATE.seppuku})',ctx2);
assert('⑧-1 新载入后四成就状态全恢复',s2==='{"y":true,"b":true,"d":true,"s":true}',s2);
}

// ── ⑨ 数据成就面板: showPanel('mData') 真调用 → 成就页渲染 ──
section('⑨ 面板: showPanel mData 接线 (renderRecordsPanel + ACH.onPanelShown) + 成就页内容');
{
G("showPanel('mData');");
const pane=String(G('document.getElementById("dataAchPane").innerHTML'));
assert('⑨-1 成就页已渲染且四成就齐 (NEG N7 转: 接线摘除恒空)',
 pane.includes('夷陵之火')&&pane.includes('比夷陵之火还要好')&&pane.includes('自刎归天')&&pane.includes('狗熊岭之王'),'len='+pane.length);
assert('⑨-2 页脚注在册 (成就一经达成永久保存) + 汇总行在册',pane.includes('成就一经达成永久保存')&&pane.includes('已达成'));
assert('⑨-3 解锁态徽章可辨 (🏆/🔒)',pane.includes('🏆')&&pane.includes('🔒'));
const life=String(G('document.getElementById("lifeStatsWrap").innerHTML'));
assert('⑨-4 终身累计六格已渲染 (数据统计页签)',life.includes('总共击毁载具')&&life.includes('总共击杀')&&life.includes('总共死亡')
 &&life.includes('总共胜利')&&life.includes('总共失败')&&life.includes('总共占领旗点'),'len='+life.length);
}

// ── ⑩ Toast 加料 + 位置双形制 + 防连跳闩 ────────────────────
section('⑩ Toast 加料版 + 位置双形制 (posTR/posBC) + 防连跳双保险闩');
{
G(RESET+" globalThis.__c2=ACH.census().cells[0]; ACH.census().cells.length=1; ACH.census().trees.length=0; if(ACH_TOAST_EL) ACH_TOAST_EL._achBusy=false; ACH_TOAST_Q.length=0; FUEL[__c2]=0; achEvaluate();"); // 只缩烧账 (同③): 单解锁单弹, 同步链不顶掉内容
const th=String(G('ACH_TOAST_EL?ACH_TOAST_EL.innerHTML:""'));
assert('⑩-1 加料弹框四料齐 (金带头章/名称/描述/进度)',
 th.includes('achTRibbon')&&th.includes('成就已达成')&&th.includes('夷陵之火')
 &&th.includes('在一局游戏中烧掉全部可以烧掉的东西')&&th.includes('可燃物 1/1'),th.slice(0,300));
assert('⑩-2 默认右上形制 (posTR 竖卡)',G('ACH_TOAST_EL?ACH_TOAST_EL.className:""')==='posTR');
G("localStorage.setItem('sf_ach_pos','bc'); ACH_TOAST_Q.length=0; achToast(ACH.defs[3]);");
assert('⑩-3 改档后正下横匾形制 (posBC, 现读即时生效; 同一 DOM 骨架)',
 G('ACH_TOAST_EL?ACH_TOAST_EL.className:""')==='posBC'&&String(G('ACH_TOAST_EL.innerHTML')).includes('achTRibbon'));
G("localStorage.setItem('sf_ach_pos','tr');");
assert('⑩-4 同一成就重复 achUnlock 不再排队 (ACH_STATE 守卫)',
 G('(function(){ ACH_TOAST_Q.length=0; achUnlock("yiling_fire"); return ACH_TOAST_Q.length; })()')===0);
assert('⑩-5 防连跳闩: 存档被外力清空后重解锁不弹 (只回账不弹框)',
 G('(function(){ for(const k in ACH_STATE) delete ACH_STATE[k]; ACH_TOAST_Q.length=0; achUnlock("yiling_fire"); return ACH_TOAST_Q.length+":"+(ACH_STATE.yiling_fire?1:0); })()')==='0:1');
G('ACH_TOAST_Q.length=0;');
}

// ── ⑪ 终身累计 sf_stats ─────────────────────────────────────
section('⑪ 终身累计 (击毁载具/击杀/死亡/胜负/占领; 观战局不累计)');
{
G("player.spectator=false; if(player.specView!==undefined) player.specView=undefined; delete player.specUsed; player.kills=7; player.deaths=2; player.caps=3; player.vehKills=5; statsAccumulate(player.team);");
assert('⑪-1 胜局累计五项全落账 (胜局不记负: losses 保持无账)',G('LIFE_STATS.kills')===7&&G('LIFE_STATS.deaths')===2&&G('LIFE_STATS.caps')===3&&G('LIFE_STATS.veh')===5&&G('LIFE_STATS.wins')===1&&G('LIFE_STATS.losses')===undefined,
 'k='+G('LIFE_STATS.kills')+' w='+G('LIFE_STATS.wins')+' l='+G('LIFE_STATS.losses'));
G("statsAccumulate(-1);");
assert('⑪-2 平局不记胜负, 战斗数据照累',G('LIFE_STATS.kills')===14&&G('LIFE_STATS.wins')===1&&G('LIFE_STATS.losses')===undefined);
G("player.specUsed=true; player.kills=3; statsAccumulate(player.team===0?1:0); delete player.specUsed; player.kills=0; player.deaths=0; player.caps=0; delete player.vehKills;");
assert('⑪-3 观战局不累计 (counted 与 recCommit 同口径; NEG N9 转)',G('LIFE_STATS.kills')===14);
assert('⑪-4 已落盘 sf_stats',G('(function(){ try{ return JSON.parse(localStorage.getItem("sf_stats")||"{}").kills; }catch(e){ return -1; } })()')===14);
}

// ── ⑫ 清除游戏数据 ──────────────────────────────────────────
section('⑫ 清除游戏数据 (记录/最高分/成就/统计全清, 设置保留)');
{
G("localStorage.setItem('sf_rec_normandy','{\"plays\":2}'); localStorage.setItem('sf_best_x','9'); localStorage.setItem('sf_lang','en'); localStorage.setItem('sf_ach','{\"yiling_fire\":1}'); localStorage.setItem('sf_stats','{\"kills\":99}'); globalThis._cgn=clearGameData();");
assert('⑫-1 四类数据键全清 (记录/最高分/成就/统计; NEG N10 转)',
 G('(function(){ return [localStorage.getItem("sf_rec_normandy"),localStorage.getItem("sf_best_x"),localStorage.getItem("sf_ach"),localStorage.getItem("sf_stats")].every(function(v){ return v===null; }); })()')===true);
assert('⑫-2 返回清除条数 ≥4',G('_cgn')>=4,'n='+G('_cgn'));
assert('⑫-3 设置类键保留 (sf_lang/sf_campaign)',G('localStorage.getItem("sf_lang")')==='en'&&G('localStorage.getItem("sf_campaign")')!==null);
assert('⑫-4 成就内存账+弹框闩同步清 (ACH.resetAll)',G('(function(){ var n=0; for(const k in ACH_STATE) n++; return n; })()')===0);
assert('⑫-5 统计内存账复位',G('(function(){ for(const k in LIFE_STATS) return false; return true; })()')===true);
G("localStorage.removeItem('sf_lang');");
}

// ── ⑬ 汇总 ──────────────────────────────────────────────────
section('⑬ 汇总');
console.log(`  正向 ${OK.length} 绿 / ${BAD.length} 红`);
if(BAD.length){ console.log('  红项: '+BAD.join(' · ')); process.exit(1); }
console.log('  verify-achieve-20261111 全绿');
