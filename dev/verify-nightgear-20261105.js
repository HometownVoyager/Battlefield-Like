// ─────────────────────────────────────────────
// dev/verify-nightgear-20261105.js —— 时停照明弹批 + 调试模式装备批 沙箱 (2026-11-05, 不进 index.html)
// 用法: node dev/verify-nightgear-20261105.js [--neg]
//   --neg = 阴性对照: 装载前把本批核心改动按文本还原成旧写法, 同一批判据必须报红。
// 原理: 复用 dev/_bootstub.js 桩 + **受控时钟直接驱动 24-main 的 loop()** (时停账/24-main 门只在主循环里
//       生效, 直调 nightGearTick 测不出真实行为), 以诺曼底 夜/晴 各 boot 一遍全部真实脚本。
// 断言 (T1~T5):
//   T1 时停照明弹 (用户实报"时停不会影响点位的周期照明弹释放"): 观战部署 → 常速下照明弹相位/_ngT 推进
//      → K 时停 → 相位/缓降高度/飘移/探照灯扫掠全冻结 (战斗钟 _ngT 只吃世界帧长); 解冻恢复推进;
//      顺带: 火光 flicker 相位钟 _fireT 同批收编 (T5 源码钉, 运行期不搭火源)。
//   T2 调试模式手电 (用户实报"人身上没有手电筒和L键相关内容"): 夜图观战部署自动持手电 (23-deploy 单源),
//      第一人称真 SpotLight 亮; L 键可开可关 (spectator=true 不再是门; 票尽真观战 alive=false 天然排除)。
//   T3 幽灵坦克大灯 (用户实报"坦克上的大灯没有实际效果"): F 召唤上车 → L 开灯 → 假光锥在场 + 真灯池
//      竞上 (SpotLight visible 且贴车头, 幽灵坦克入 cands)。
//   T4 白天大灯 + 照明弹不冒: 晴天图 L 开幽灵大灯 → 真灯照样亮 (24-main 门放宽 _hlRideOn) 且 FLARES
//      恒空 / 探照灯恒空 (08 isDark 门兜住, 晴天不因开车灯长出照明弹)。
//   T5 静态接线: 消费点表逐条子串断言 (不写死行号) + 载入清单与 index.html 实载同序对账 + 版本戳。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const NEG=process.argv.includes('--neg');
const OK=[],BAD=[];
function assert(name,cond,detail){ (cond?OK:BAD).push(name); console.log(`  ${cond?'✓':'✗'} ${name}${detail?'  '+detail:''}`); }
function section(t){ console.log('\n══ '+t+' ══'); }
const SRC=f=>{ const p=PATCH_MAP[f]; return p!==undefined?p:fs.readFileSync(path.join(root,f),'utf8'); };

// ── 阴性对照 (锚点 = 修后原文单行; 找不到就抛错) ──
const PATCHES=[
 // N1 照明弹相位退回 nowT 墙钟 ⇒ 时停里照常升空 (本批病根复现)
 ['js/08-effects.js',
  'const p=((_ngT-fl.t0)%NIGHT_GEAR.flarePeriod+NIGHT_GEAR.flarePeriod)%NIGHT_GEAR.flarePeriod;',
  'const p=((nowT-fl.t0)%NIGHT_GEAR.flarePeriod+NIGHT_GEAR.flarePeriod)%NIGHT_GEAR.flarePeriod;'],
 // N2 手电渲染门退回排除 spectator ⇒ 调试模式无手电
 ['js/08-effects.js',
  'const on=!!(player&&player.alive&&!player.onVehicle&&!player.onNaval&&player.flashlight);',
  'const on=!!(player&&player.alive&&!player.spectator&&!player.onVehicle&&!player.onNaval&&player.flashlight);'],
 // N3 幽灵坦克退出大灯候选链 ⇒ 真灯池永远轮不到它
 ['js/08-effects.js',
  "if(typeof SPECVEH!=='undefined'&&SPECVEH&&SPECVEH.alive&&SPECVEH.lightsOn){ SPECVEH._d2=_hlD2(SPECVEH); cands.push(SPECVEH); }",
  ''],
 // N4 24-main 门退回 ⇒ 晴天白天开大灯整段不跑, 真灯不亮
 ['js/24-main.js',
  "||_hlRideOn)&&typeof nightGearTick==='function')",
  ")&&typeof nightGearTick==='function')"],
 // N5 L 键步行门退回 !player.spectator ⇒ 调试模式按 L 无反应
 ['js/19-input.js',
  "}else if(player.alive){   // ★2026-11-05 调试模式装备批: 去 !player.spectator 门 —— 调试观战活着就是作战单位, 手电照常; 票尽真观战 alive=false 天然排除",
  '}else if(player.alive&&!player.spectator){'],
];
const PATCH_MAP={};
if(NEG) for(const [f,from,to] of PATCHES){
 const s=PATCH_MAP[f]!==undefined?PATCH_MAP[f]:fs.readFileSync(path.join(root,f),'utf8');
 if(!s.includes(from)) throw new Error('NEG 锚失配 ('+f+'): '+from.slice(0,60));
 PATCH_MAP[f]=s.split(from).join(to);
}

// ── 桩补丁 (与 verify-daynight 同源 + loop() 直驱所需) ──
const {sandbox,document,window,byId}=require('./_bootstub.js');
const _Color=sandbox.THREE.Color;
const V3c=sandbox.THREE.Vector3;
if(!V3c.prototype.negate) V3c.prototype.negate=function(){ this.x=-this.x; this.y=-this.y; this.z=-this.z; return this; };
if(!V3c.prototype.lengthSq) V3c.prototype.lengthSq=function(){ return this.x*this.x+this.y*this.y+this.z*this.z; };
if(!_Color.prototype.getHex){ _Color.prototype.getHex=function(){ const c=typeof this.c==='number'?this.c:0; return c; }; }
if(!_Color.prototype.lerp){
const _p=h=>{ h=typeof h==='number'?h:parseInt(String(h).replace('#',''),16)||0; return [(h>>16)&255,(h>>8)&255,h&255]; };
_Color.prototype.lerp=function(target,a){
const c0=_p(this.c), c1=_p(target&&target.c!==undefined?target.c:target);
const mix=c0.map((v,i)=>Math.round(v+(c1[i]-v)*a));
this.c=(mix[0]<<16)|(mix[1]<<8)|mix[2];
return this;
};
}
if(!sandbox.THREE.SpotLight){
sandbox.THREE.SpotLight=class extends sandbox.THREE.Object3D{
constructor(c,i,d,a,p,dec){ super(); this.color=c; this.intensity=i||0; this.distance=d||0; this.angle=a||0; this.penumbra=p||0; this.decay=dec||1; this.castShadow=false; this.visible=true;
this.target=new sandbox.THREE.Object3D(); this.target.updateMatrixWorld=()=>{}; }
};
}
sandbox.THREE.PointLight=class extends sandbox.THREE.Object3D{
constructor(c,i,d,dec){ super(); this.color=c; this.intensity=i||0; this.distance=d||0; this.decay=dec||1; this.castShadow=false; }
};
for(const _mk of ['MeshBasicMaterial','MeshLambertMaterial','MeshPhongMaterial','MeshStandardMaterial','SpriteMaterial','Material']){
const M=sandbox.THREE[_mk];
if(M&&M.prototype&&!M.prototype.clone) M.prototype.clone=function(){ const c=Object.create(Object.getPrototypeOf(this)); Object.assign(c,this); return c; };
}
const O3=sandbox.THREE.Object3D;
if(O3&&O3.prototype&&!O3.prototype.clear) O3.prototype.clear=function(){ if(this.children) this.children.length=0; return this; };
const Q4=sandbox.THREE.Quaternion;
if(Q4&&Q4.prototype){
if(!Q4.prototype.copy) Q4.prototype.copy=function(q){ this.x=q.x; this.y=q.y; this.z=q.z; this.w=(q.w!==undefined)?q.w:1; return this; };
if(!Q4.prototype.setFromEuler) Q4.prototype.setFromEuler=function(){ return this; };
}
if(!sandbox.THREE.Line) sandbox.THREE.Line=class extends O3{constructor(g,m){super();this.geometry=g||{};this.material=m||{};this.isLine=true;}};
const BA=sandbox.THREE.BufferAttribute;
if(BA&&BA.prototype&&!BA.prototype.setXYZ) BA.prototype.setXYZ=function(i,x,y,z){ if(this.array){ this.array[i*this.itemSize]=x; this.array[i*this.itemSize+1]=y; this.array[i*this.itemSize+2]=z; } return this; };
const AP=()=>({value:0,setValueAtTime(){},setTargetAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}});
const ACStub=class{
createOscillator(){return {frequency:AP(),detune:AP(),type:'',start(){},stop(){},connect(){},onended:null};}
createGain(){return {gain:AP(),connect(){},disconnect(){}};}
createBuffer(){return {getChannelData:()=>new Float32Array(16),duration:1,numberOfChannels:1};}
createBufferSource(){return {buffer:null,loop:false,playbackRate:AP(),start(){},stop(){},connect(){},onended:null};}
createBiquadFilter(){return {type:'',frequency:AP(),detune:AP(),Q:AP(),connect(){}};}
createDynamicsCompressor(){return {threshold:AP(),ratio:AP(),attack:AP(),release:AP(),connect(){}};}
createStereoPanner(){return {pan:AP(),connect(){}};}
resume(){return Promise.resolve();} get state(){return 'running';} get destination(){return {};}
get currentTime(){return 0;} get sampleRate(){return 44100;}
};
sandbox.AudioContext=ACStub; sandbox.window.AudioContext=ACStub; sandbox.window.webkitAudioContext=ACStub;
sandbox.confirm=()=>true;
// 键盘注册表: 19-input 走裸全局 addEventListener —— 沙箱里收进 handlers 供 __key 重放
const handlers={};
sandbox.addEventListener=(t,f)=>{ (handlers[t]=handlers[t]||[]).push(f); };

// ── 全链文件表 (与 index.html 实载同序; T5 动态对账, 不写死数字) ──
const FILES=['js/00-config.js','js/00b-i18n.js','js/00c-procgen.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/19b-gamepad.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/22a-menuart.js','js/22b-speclayer.js','js/23-deploy.js','js/23b-worldrestore.js','js/25-zombies.js','js/26-commander.js','js/24-main.js'];
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
function load(ctx,file){ vm.runInContext(SRC(file),ctx,{filename:file}); }

function boot(store){
for(const k in byId) delete byId[k];
for(const k in handlers) delete handlers[k];
// HUD 桩缺 style.setProperty: 包一层 document, 元素取出一律补齐
const patchStyle=(el)=>{ if(el&&el.style&&!el.style.setProperty) el.style.setProperty=(k,v)=>{ el.style[k]=v; }; return el; };
const docH=new Proxy(document,{get(t,k){
if(k==='createElement'||k==='createElementNS') return (...a)=>patchStyle(t[k](...a));
if(k==='getElementById') return (id)=>patchStyle(t.getElementById(id));
return t[k];
}});
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=docH; ctx.window=window;
ctx.localStorage={_s:Object.assign({sf_campaign:'0',sf_exp:'1'},store||{}),getItem(k){return (k in this._s)?this._s[k]:null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
ctx.CANNON=(window&&window.CANNON)||{Body:class{constructor(o){Object.assign(this,o||{});}},World:class{add(){}},Box:class{},Sphere:class{},Vec3:sandbox.THREE.Vector3,Material:class{},ContactMaterial:class{}};
ctx.__T=1000;                                    // 受控时钟: 每帧 +16.7ms, loop() 直驱
ctx.performance={now:()=>ctx.__T};
for(const f of FILES) load(ctx,f);
ctx.__key=(code)=>{ for(const f of (handlers.keydown||[])) f({code,repeat:false,preventDefault(){},stopPropagation(){}}); };
try{ vm.runInContext(`document.getElementById('startBtn').onclick();`,ctx); }catch(e){ console.log('  开局异常: '+e); }
vm.runInContext(`var __step=(n)=>{ for(let i=0;i<n;i++){ __T+=16.7; loop(); } };
var __key2=(c)=>__key(c);
var __snapFlare=()=>{ const fl=FLARES[0]; if(!fl) return null;
const p=((_ngT-fl.t0)%NIGHT_GEAR.flarePeriod+NIGHT_GEAR.flarePeriod)%NIGHT_GEAR.flarePeriod;
return {p, y:(fl.sp&&fl.sp.visible)?fl.sp.position.y:null, vis:!!(fl.sp&&fl.sp.visible), ngT:_ngT, nowT:+nowT.toFixed(3)}; };`,ctx);
return ctx;
}
const VM=(ctx,expr)=>vm.runInContext(expr,ctx);
const SPEC_DEPLOY=`(()=>{try{
player.team=0; player.cls=3; player.spectator=true; player.specUsed=true; selectedSpawn=-1; deployPlayer();
pointerLocked=true;
return {alive:player.alive,spec:player.spectator,night:NIGHT_MODE,fl:player.flashlight};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`;

// ═════ T1 时停照明弹 ═════
function t1(){
section('T1 时停照明弹: 常速推进 → K 时停全冻结 → 解冻恢复 (战斗钟 _ngT)');
const ctx=boot({sf_daynight:'night'});
const dep=VM(ctx,SPEC_DEPLOY);
assert('T1 前置: 夜图观战部署 (alive+spectator+NIGHT_MODE)',typeof dep==='object'&&dep.alive===true&&dep.spec===true&&dep.night===true,JSON.stringify(dep));
if(typeof dep!=='object') return;
VM(ctx,`__step(5)`);                        // 先跑几帧: nightGearTick 惰性建 FLARES
VM(ctx,`FLARES[0].t0=_ngT-2;`);            // 拨到燃烧窗 (判据对齐 verify-daynight T4 拨相手法)
VM(ctx,`SEARCHLIGHTS.length=0; _searchBeams.length=0; SEARCHLIGHTS.push({x:player.pos.x+40,z:player.pos.z,y:player.pos.y+3,az0:0.3,phase:0});`);   // 诺曼底无静态登记, 就地搭一座 (verify-daynight T4 同法)
VM(ctx,`__step(5)`);
const a=VM(ctx,`__snapFlare()`);
assert('T1 前置: 照明弹燃烧窗可见 (sp 可见)',a&&a.vis===true&&a.y!==null,JSON.stringify(a));
VM(ctx,`__step(90)`);                       // 常速 1.5s
const b=VM(ctx,`__snapFlare()`);
assert('T1 常速: 相位随战斗钟推进 (p 增大)',b&&a&&b.p>a.p,'p '+a.p.toFixed(3)+' → '+b.p.toFixed(3));
const toggled=VM(ctx,`specTimeToggle()`);
assert('T1 前置: K 时停已开',toggled===true);
VM(ctx,`__step(120)`);                      // 冻结 2s
const c1=VM(ctx,`__snapFlare()`);
VM(ctx,`__step(120)`);                      // 再冻 2s
const c2=VM(ctx,`__snapFlare()`);
assert('T1 ★ 时停: 照明弹相位冻结 (p 不动)',c1&&c2&&c1.p===c2.p,'p '+c1.p.toFixed(6)+' vs '+c2.p.toFixed(6));
assert('T1 ★ 时停: 缓降高度冻结 (sp.y 不动)',c1&&c2&&c1.y!==null&&c1.y===c2.y,'y '+c1.y+' vs '+c2.y);
// 探照灯扫掠同钟
const az1=VM(ctx,`(_searchBeams[0])?_searchBeams[0]._beam.root.rotation.y:null`);
VM(ctx,`__step(120)`);
const az2=VM(ctx,`(_searchBeams[0])?_searchBeams[0]._beam.root.rotation.y:null`);
assert('T1 ★ 时停: 探照灯扫掠冻结 (az 不动)',az1!==null&&az1===az2,'az '+(az1===null?'无光柱':az1.toFixed(6))+' vs '+(az2===null?'无光柱':az2.toFixed(6)));
VM(ctx,`specTimeToggle()`);                 // 解冻
VM(ctx,`__step(90)`);
const d=VM(ctx,`__snapFlare()`);
assert('T1 解冻: 相位恢复推进',d&&d.p>c2.p,'p '+c2.p.toFixed(3)+' → '+d.p.toFixed(3));
}

// ═════ T2 调试模式手电 ═════
function t2(){
section('T2 调试模式手电: 部署自动持电 + L 键开/关 (spectator 不再是门)');
const ctx=boot({sf_daynight:'night'});
const dep=VM(ctx,SPEC_DEPLOY);
assert('T2 前置: 部署自动持手电 (23-deploy isDarkEnvironment 单源)',typeof dep==='object'&&dep.fl===true,JSON.stringify(dep));
if(typeof dep!=='object') return;
VM(ctx,`__step(5)`);
const lit=VM(ctx,`({vis:_playerFlashlight?_playerFlashlight.visible:null, it:_playerFlashlight?_playerFlashlight.intensity:null})`);
assert('T2 ★ 观战步行: 第一人称真 SpotLight 亮',lit.vis===true&&lit.it>0,JSON.stringify(lit));
VM(ctx,`__key('KeyL'); __step(3)`);
const off=VM(ctx,`({fl:player.flashlight, vis:_playerFlashlight?_playerFlashlight.visible:null})`);
assert('T2 ★ L 关: 键已到 (spectator=true 不再拦) + 灯灭',off.fl===false&&off.vis===false,JSON.stringify(off));
VM(ctx,`__key('KeyL'); __step(3)`);
const on2=VM(ctx,`({fl:player.flashlight, vis:_playerFlashlight?_playerFlashlight.visible:null})`);
assert('T2 ★ L 再开: 灯复亮',on2.fl===true&&on2.vis===true,JSON.stringify(on2));
}

// ═════ T3 幽灵坦克大灯 (夜图) ═════
function t3(){
section('T3 幽灵坦克大灯: F 召唤上车 → L → 假光锥在场 + 真灯池竞上');
const ctx=boot({sf_daynight:'night'});
const dep=VM(ctx,SPEC_DEPLOY);
if(typeof dep!=='object'){ assert('T3 前置: 部署',false,JSON.stringify(dep)); return; }
const sm=VM(ctx,`(()=>{try{ specVehSummon(); return {onV:player.onVehicle?player.onVehicle.kind:null, alive:SPECVEH?SPECVEH.alive:null}; }catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
assert('T3 前置: 幽灵坦克已召唤并上车',typeof sm==='object'&&sm.onV==='ghost'&&sm.alive===true,JSON.stringify(sm));
if(typeof sm!=='object') return;
VM(ctx,`__key('KeyL'); __step(10)`);
const r=VM(ctx,`(()=>{ try{
const g=SPECVEH;
const nearLit=_hlPool.filter(sl=>sl.visible&&sl.intensity>0&&Math.hypot(sl.position.x-g.pos.x,sl.position.z-g.pos.z)<9).length;
return {on:g.lightsOn, hl:!!g._hl, cone:!!(g._hl&&g._hl.cones[0]&&g._hl.cones[0].visible), inCands:g._d2!==undefined, nearLit};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
assert('T3 L 开灯: lightsOn + 灯组已建',r.on===true&&r.hl===true,JSON.stringify(r));
assert('T3 ★ 假光锥在场 (grp 可见链)',r.cone===true);
assert('T3 ★ 幽灵坦克已入大灯候选 (cands)',r.inCands===true);
assert('T3 ★ 真灯池竞上: 可见 SpotLight 贴车头 (≤9m)',r.nearLit>=1,'nearLit='+r.nearLit);
}

// ═════ T4 白天大灯 + 照明弹不冒 ═════
function t4(){
section('T4 晴天: L 开幽灵大灯 → 真灯照样亮; 照明弹/探照灯恒空 (isDark 门)');
const ctx=boot({});                          // 缺省 = 晴天白天
const dep=VM(ctx,SPEC_DEPLOY);
assert('T4 前置: 白天部署 (NIGHT_MODE=false / 手电不自动发)',typeof dep==='object'&&dep.night===false&&dep.fl===false,JSON.stringify(dep));
if(typeof dep!=='object') return;
VM(ctx,`specVehSummon(); __key('KeyL'); __step(10)`);
const r=VM(ctx,`(()=>{ try{
const g=SPECVEH;
const nearLit=_hlPool.filter(sl=>sl.visible&&sl.intensity>0&&Math.hypot(sl.position.x-g.pos.x,sl.position.z-g.pos.z)<9).length;
return {on:g.lightsOn, dark:isDarkEnvironment(), nearLit, flareN:FLARES.length, flInit:_flaresInit, beamN:_searchBeams.length};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
assert('T4 前置: 晴天判据 isDarkEnvironment=false',r.dark===false,JSON.stringify(r));
assert('T4 ★ 大灯真灯在晴天照样亮 (24-main 门 _hlRideOn)',r.on===true&&r.nearLit>=1,'nearLit='+r.nearLit);
assert('T4 ★ 照明弹恒空 (旗点不冒弹)',r.flareN===0&&r.flInit===false,'flareN='+r.flareN+' init='+r.flInit);
assert('T4 ★ 探照灯恒空 (SEARCHLIGHTS 夜档才登记)',r.beamN===0,'beamN='+r.beamN);
}

// ═════ T5 静态接线 ═════
function t5(){
section('T5 静态接线: 单行源码钉 + 载入清单对账 + 版本戳');
const pins=[
 ['js/08-effects.js','战斗钟声明+推进','let _ngT=0;'],
 ['js/08-effects.js','nightGearTick 吃世界帧长','_ngT+=dt;'],
 ['js/08-effects.js','照明弹相位走战斗钟','const p=((_ngT-fl.t0)%NIGHT_GEAR.flarePeriod+NIGHT_GEAR.flarePeriod)%NIGHT_GEAR.flarePeriod;'],
 ['js/08-effects.js','照明弹飘移走战斗钟','const drift=Math.sin(_ngT*0.35+fl.x)*1.2;'],
 ['js/08-effects.js','探照灯扫掠走战斗钟','const az=b.az0+Math.sin(_ngT*0.22+b.phase)*1.05;'],
 ['js/08-effects.js','照明弹段 isDark 门','if(isDark){'],
 ['js/08-effects.js','手电门去 spectator','const on=!!(player&&player.alive&&!player.onVehicle&&!player.onNaval&&player.flashlight);'],
 ['js/08-effects.js','幽灵坦克入大灯候选链',"if(typeof SPECVEH!=='undefined'&&SPECVEH&&SPECVEH.alive&&SPECVEH.lightsOn){ SPECVEH._d2=_hlD2(SPECVEH); cands.push(SPECVEH); }"],
 ['js/08-effects.js','火光 flicker 走 _fireT','const flick=0.82+0.18*Math.sin(_fireT*12.0+item.seed)'],
 ['js/08-effects.js','_fireT 推进','_fireT+=dt;'],
 ['js/19-input.js','L 键步行门去 spectator','}else if(player.alive){   // ★2026-11-05 调试模式装备批: 去 !player.spectator 门'],
 ['js/24-main.js','座驾大灯门 _hlRideOn','const _hlRideOn=!!(player&&((player.onVehicle&&player.onVehicle.lightsOn)||(player.onNaval&&player.onNaval.lightsOn)));'],
 ['js/24-main.js','门放宽接线','||_hlRideOn)&&typeof nightGearTick===\'function\')'],
 ['js/23-deploy.js','部署提示补 L','· E=脱离 · L=手电/大灯'],
];
for(const [f,label,needle] of pins) assert('T5 '+f+' :: '+label,SRC(f).includes(needle),SRC(f).includes(needle)?'':'缺锚: '+needle.slice(0,50));
// i18n: 词典键 = index.html 段落全文 (zh 原文即键纪律) + 短提示词条同步
const i18n=SRC('js/00b-i18n.js');
const eI=i18n.indexOf("':'<b>DEBUG MODE");
let s=eI>=0?i18n.lastIndexOf("\n'",eI)+2:-1;
const key=s>0?i18n.slice(s,eI):'';
assert('T5 i18n 长词条键与 index.html 段落全文一致 (含 L)',key.length>100&&html.includes(key),'len=' + key.length);
assert('T5 i18n 短提示词条补 L',i18n.includes("'调试模式 · 双击空格=悬停飞行 · H=气动飞行 · F=召唤幽灵坦克 · K=时停 · J=信息层 · Q=附身Bot · E=脱离 · L=手电/大灯 · V=减速'"));
// 载入清单对账 (动态解析, 不写死数字)
const htmlScripts=(html.match(/<script src="js\/[^"?]*\?v=[^"]*"/g)||[]).map(x=>x.replace(/<script src="/,'').replace(/"$/,'').split('?')[0]);
assert('T5 载入清单 = index.html 实载脚本逐条同序 ('+FILES.length+' 个)',JSON.stringify(htmlScripts)===JSON.stringify(FILES));
// 版本戳
const stamps=[...html.matchAll(/20261109b/g)];
const stampSet=[...new Set(stamps.map(m=>m[0]))];
assert('T5 版本戳 20261109b 全量唯一',stamps.length>40&&stampSet.length===1&&html.includes("window.__sfStyleVer='20261109b';"),'×'+stamps.length);
const gf=fs.readFileSync(path.join(root,'dev/_game_files.txt'),'utf8');
assert('T5 dev/_game_files.txt 同步升戳',gf.includes('v=20261109b')&&!gf.includes('20261104b'));
}

t1(); t2(); t3(); t4(); t5();
console.log('\n──────────────────────────────────');
console.log((NEG?'[阴性对照] ':'')+'PASS '+OK.length+' / FAIL '+BAD.length);
if(BAD.length){ console.log('红账:\n - '+BAD.join('\n - ')); process.exit(1); }
