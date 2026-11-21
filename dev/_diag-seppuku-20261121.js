// ─────────────────────────────────────────────────────────────
// dev/_diag-seppuku-20261121.js —— 批B#30 行为沙箱 (自刎归天误判, 审计 #30)
//   A1 审计主链: 投雷(releaseNade 盖 _src='手雷') → 开一枪(playerShoot 盖 _src=枪名) → 真雷炸死自己
//      → 记录 killerName/killerSrc/deaths + ACH.update 后 seppuku 是否解锁 (审计断言: 修前不解锁)
//   A2 同 A1 但开枪在先投雷在后 (对照: 重盖章本来的口径 —— 爆炸前 _src 已被 nadeExplode 刷回)
//   B  举雷被击掉落 (dropHeldNade, 2026-11-03 契约雷) → 玩家先死于枪击 → 掉落雷爆炸 → 尸体不再死
//      (审计断言的"掉落雷炸死本人"链是否存在)
//   C  对照: 别人的雷炸死我 → 不解锁 (阴性)
//   D  纯投雷不开枪 (verify-achieve ⑥ 同款) → 应解锁 (回归哨兵)
// 用法: node dev/_diag-seppuku-20261121.js
// 桩法: 与 verify-achieve-20261111 同款 boot (真 three + 全脚本链 + startBtn 开局)。
// ─────────────────────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
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
const REAL_THREE=loadRealTHREE();
const html=SRC('index.html');
const FILES=[...html.matchAll(/src="(js\/[^"?]+)/g)].map(m=>m[1]);
function boot(campIdx,patchMap){
 const T=REAL_THREE;
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
 for(const f of FILES){ const src=(patchMap&&patchMap.get(f))||SRC(f); vm.runInContext(src,ctx,{filename:f}); }
 return ctx;
}
let IDX=-1;
{ const c0=boot(0); IDX=vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="normandy")',c0); }
const ctx=boot(IDX);
const G=(s)=>vm.runInContext(s,ctx,{timeout:300000});
const RESET="ACH.onFreshMatch(); (function(){ for(const k in ACH_STATE) delete ACH_STATE[k]; for(const k in ACH_TOASTED) delete ACH_TOASTED[k]; })();";
const SPOT=`(function(){ const R=MAP_SIZE/2-60; for(let z=-R;z<=R;z+=9)for(let x=-R;x<=R;x+=9){ const gh=heightAt(x,z); if(gh<1||gh>40) continue; let ok=true; for(const b of BOXES){ if(b.dead) continue; if(Math.max(b.minX-x,0,x-b.maxX)<4&&Math.max(b.minZ-z,0,z-b.maxZ)<4&&b.minY<gh+2&&b.maxY>gh-1){ ok=false; break; } } if(!ok) continue; for(const c of CYLS){ if(c.dead) continue; const dx=c.x-x,dz=c.z-z; if(dx*dx+dz*dz<9){ ok=false; break; } } if(!ok) continue; return {x:x,z:z,gh:gh}; } return null; })()`;

let err=null;
try{ G("document.getElementById('startBtn').onclick();"); }catch(e){ err='start: '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); }
console.log('boot: '+(err?('ERR '+err):'ok, ACH='+(G('typeof ACH!=="undefined"&&!!ACH'))));

function placePlayer(){ return G(`(function(){ const sp=${SPOT}; if(!sp) return false; player.team=0; player.cls=0; player.spectator=false; player.alive=true; player.deployed=true; player.hp=20; player.protUntil=0; player.nadeHeld=false; player.onVehicle=null; player.onMG=null; player.pos.set(sp.x,sp.gh,sp.z); player.killerName=''; player.killerSrc=''; player._achNadeSelf=false; rearmPlayerClass(0); ACH.onFreshMatch(); return true; })()`); }
// ↑ deaths 不清 (死亡边沿基线单调); ACH.onFreshMatch() 重拍基线 = 本局"至当前 deaths 为止无新边沿"

function runNades(follow){ return G(`(function(){ for(let i=0;i<400;i++){ updateNades(0.05,0.05); if(${follow?'nades.length&&player.alive':'false'}) player.pos.copy(nades[0].pos); if(nades.length===0) return i+1; } return -1; })()`); }

function report(tag){
 const r={
  alive:G('player.alive'), deaths:G('player.deaths'), kn:G('player.killerName'), ks:G('player.killerSrc'),
  srcNow:G('player._src'), seppuku:G('!!ACH.state().seppuku'), pilot:G('!!player._achPilotBld'), nadeSelf:G('!!player._achNadeSelf'),
 };
 console.log(`  ${tag}: alive=${r.alive} deaths=${r.deaths} killerName="${r.kn}" killerSrc="${r.ks}" _src="${r.srcNow}" seppuku=${r.seppuku} _achNadeSelf=${r.nadeSelf}`);
 return r;
}

// ── A1: 投雷 → 开一枪 → 真雷炸死自己 (审计 #30 主链) ──
console.log('\n══ A1 投雷→开枪→被自己雷炸死 (审计主链) ══');
{
 if(!placePlayer()){ console.log('  场地未找到, 跳过'); process.exit(2); }
 G(RESET);
 G(`player._src=''; player.releaseNade();`);            // 出手盖 _src='手雷' + 真雷入账 (引信=当前 nadeFuse)
 const n0=G('nades.length'); console.log('  投雷后 nades='+n0+' _src="'+G('player._src')+'"');
 G(`playerShoot(player.curW);`);                        // 开一枪 → _src 被盖成枪名
 console.log('  开枪后 _src="'+G('player._src')+'" curW='+G('player.curW&&player.curW.key'));
 const steps=runNades(true);
 report('A1 爆后(ACH.update 前)');
 G('ACH.update(1);');
 const r=report('A1 ACH.update 后');
 console.log(`  A1 判定: 期望(审计)=被自己雷炸死且不解锁 → deaths=${r.deaths} kn="${r.kn}" seppuku=${r.seppuku}`);
}

// ── A2: 开枪在先, 投雷在后 (nadeExplode 重盖章本来兜住的口径) ──
console.log('\n══ A2 开枪→投雷→炸死自己 (对照) ══');
{
 G(RESET); placePlayer();
 G(`playerShoot(player.curW);`);
 G(`player._src=''; player.releaseNade();`);
 const steps=runNades(true);
 G('ACH.update(1);');
 report('A2 ACH.update 后');
}

// ── B: 举雷被击掉落 (dropHeldNade) → 死于枪击 → 掉落雷爆炸 ──
console.log('\n══ B 举雷被击掉落→掉落雷爆炸 (审计同族链) ══');
{
 G(RESET); placePlayer();
 G(`player.hp=20; player.nadeHeld=true; player.nadeFuse=1.2; player.nadeCount=1; player.nadeIsAT=false; player.nadeIsSmoke=false; player.nadeIsIncin=false;`);
 G(`globalThis.__foe={name:'敌兵',team:1,pos:player.pos.clone().add(V3(3,0,3))};`);
 const dBefore=G('player.deaths');
 G(`player.damage(50,__foe,false);`);   // 致命>25 → 打断点掉雷 (hp 已扣) → die(__foe)
 const dMid=G('player.deaths');
 const dropSrc=G('nades.length?String(nades[0].src):"-"');
 console.log(`  枪击后: alive=${G('player.alive')} deaths=${dMid}(前${dBefore}) kn="${G('player.killerName')}" ks="${G('player.killerSrc')}" nades=${G('nades.length')} 掉雷src="${dropSrc}"`);
 const steps=runNades(false);
 const dAfter=G('player.deaths');
 G('ACH.update(1);');
 const r=report('B ACH.update 后');
 console.log(`  B 判定: 掉落雷爆炸${steps>=0?('@'+steps+'步'):'未爆'} deaths 枪击后=${dMid}→爆后=${dAfter} (尸体二次死亡=${dAfter>dMid}) seppuku=${r.seppuku} (期望 false: 尸体不吃溅射)`);
}

// ── C: 别人的雷炸死我 (阴性对照) ──
console.log('\n══ C 别人的雷炸死我 (阴性) ══');
{
 G(RESET); placePlayer();
 G(`globalThis.__foe2={name:'敌兵',team:1,pos:player.pos.clone().add(V3(1.5,0,1.5)),_src:'手雷'};`);
 G(`throwNade(__foe2,V3(player.pos.x,player.pos.y+1.4,player.pos.z),V3(0.1,-0.5,0.1),0);`);
 runNades(false);
 G('ACH.update(1);');
 const r=report('C ACH.update 后');
 console.log(`  C 判定: 期望不解锁 (killerName="${r.kn}"≠你) seppuku=${r.seppuku}`);
}

// ── D: 纯投雷不开枪 (回归哨兵, verify-achieve ⑥ 同款) ──
console.log('\n══ D 纯投雷→炸死自己 (回归哨兵) ══');
{
 G(RESET); placePlayer();
 G(`player._src=''; player.releaseNade();`);
 runNades(true);
 G('ACH.update(1);');
 const r=report('D ACH.update 后');
 console.log(`  D 判定: 期望解锁 seppuku=${r.seppuku} (killerSrc="${r.ks}")`);
}

// ── E: 自身雷归属判据直测 (观察钩: 别人雷炸我 / 自己雷炸自己 / 雷炸别人 三向) ──
console.log('\n══ E _achNadeSelf 盖章三向 (观察钩判据) ══');
{
 // E1 自己的雷炸自己 (跟雷爆点): 盖章
 G(RESET); placePlayer();
 G(`player._src=''; player.releaseNade();`);
 runNades(true);
 const e1={ stamped:G('!!player._achNadeSelf'), alive:G('player.alive') };
 G('ACH.update(1);');
 console.log(`  E1 自己雷炸自己: 盖章=${e1.stamped} alive=${e1.alive} seppuku=${G('!!ACH.state().seppuku')} (期望 全true)`);
 // E2 别人的雷炸我: 不盖章 (thrower=foe)
 G(RESET); placePlayer();
 G(`globalThis.__foe3={name:'敌兵',team:1,pos:player.pos.clone().add(V3(1.5,0,1.5)),_src:'手雷'};`);
 G(`throwNade(__foe3,V3(player.pos.x,player.pos.y+1.4,player.pos.z),V3(0.1,-0.5,0.1),0);`);
 runNades(false);
 const e2={ stamped:G('!!player._achNadeSelf'), alive:G('player.alive'), kn:G('player.killerName') };
 G('ACH.update(1);');
 console.log(`  E2 别人雷炸我: 盖章=${e2.stamped} alive=${e2.alive} killerName="${e2.kn}" seppuku=${G('!!ACH.state().seppuku')} (期望 盖章false/不解锁)`);
 // E3 自己的雷正常出手飞远 (无自伤): 不给自己盖章 (thrower 活着)
 G(RESET); placePlayer();
 G(`player.hp=100; player._src=''; player.releaseNade();`);
 const e3steps=runNades(false);
 const e3={ stamped:G('!!player._achNadeSelf'), alive:G('player.alive') };
 console.log(`  E3 自己雷飞远无自伤: 盖章=${e3.stamped} alive=${e3.alive} (期望 盖章false/自己活着)`);
}

// ── F: #10 出手弧雷模冻结 (vm 沙箱真状态机) ──
console.log('\n══ F 出手弧雷模 (举AT→松手→逐帧) ══');
{
 G(RESET); placePlayer();
 const arc=G(`(function(){
  const out={frames:[]};
  vmEquip('garand',0);
  player.nadeIsAT=true; player.nadeIsSmoke=false; player.nadeIsIncin=false;
  player.nadeHeld=true; player.nadeFuse=99; player.nadeCount=2;
  VM.state='nade'; VM.stateT=0; VM.stateDur=999; VM.nadeKind=null;
  updateViewModel(1/60,player);
  out.holdKind=VM.nadeKind; out.holdPick=(VM.nadeM===VM.nadeMs.at);
  // 松手 → 出手弧 (19-input keyup 同款两行)
  player.nadeHeld=false; VM.stateT=0; VM.stateDur=0.55;
  vmSndFlags={};
  for(let i=0;i<40;i++){
    updateViewModel(1/60,player);
    out.frames.push({nt:+(VM.stateT/VM.stateDur).toFixed(3),kind:VM.nadeKind,pick:(VM.nadeM===VM.nadeMs.at),thrown:nades.length>0,visible:VM.nadeM?VM.nadeMs.at.visible:null});
    if(VM.state!=='nade') break;
  }
  out.arcFrames=out.frames.filter(f=>f.thrown).length;
  out.kindSet=[...new Set(out.frames.map(f=>f.kind))].join(',');
  out.flash=out.frames.some(f=>f.thrown&&f.nt<0.55&&f.kind!=='at');
  return out; })()`);
 console.log(`  举雷帧: kind=${arc.holdKind} pick=${arc.holdPick}`);
 console.log(`  弧内帧: ${arc.frames.length} 帧 (出手后 ${arc.arcFrames} 帧) kind 集合=[${arc.kindSet}]`);
 console.log(`  弧内闪变(出手后 kind≠at): ${arc.flash}`);
 console.log(`  判定: 期望 kindSet='at' 且 flash=false (修前 flash=true: 出手后 ~2 帧翻 frag)`);
 console.log('  逐帧: '+arc.frames.map(f=>`${f.nt}:${f.kind}${f.thrown?'✱':''}`).join(' '));
}

// ── 补丁 boot 工具: 对指定 js 文件做源码替换后整体装载 (verify-achieve PATCH_MAP 同款桩法) ──
function runSeppuku(Gx,tag){
 Gx(`globalThis.__sp=(function(){ const R=MAP_SIZE/2-60; for(let z=-R;z<=R;z+=9)for(let x=-R;x<=R;x+=9){ const gh=heightAt(x,z); if(gh<1||gh>40) continue; let ok=true; for(const b of BOXES){ if(b.dead) continue; if(Math.max(b.minX-x,0,x-b.maxX)<4&&Math.max(b.minZ-z,0,z-b.maxZ)<4&&b.minY<gh+2&&b.maxY>gh-1){ ok=false; break; } } if(!ok) continue; for(const c of CYLS){ if(c.dead) continue; const dx=c.x-x,dz=c.z-z; if(dx*dx+dz*dz<9){ ok=false; break; } } if(!ok) continue; return {x:x,z:z,gh:gh}; } return null; })();`);
 Gx(`if(!__sp) throw new Error('no spot'); ACH.onFreshMatch(); (function(){ for(const k in ACH_STATE) delete ACH_STATE[k]; for(const k in ACH_TOASTED) delete ACH_TOASTED[k]; })(); player.team=0; player.cls=0; player.spectator=false; player.alive=true; player.deployed=true; player.hp=20; player.protUntil=0; player.nadeHeld=false; player.onVehicle=null; player.onMG=null; player.pos.set(__sp.x,__sp.gh,__sp.z); player.killerName=''; player.killerSrc=''; player._achNadeSelf=false; rearmPlayerClass(0); ACH.onFreshMatch();`);
 Gx(`player._src=''; player.releaseNade(); playerShoot(player.curW);`);
 Gx(`(function(){ for(let i=0;i<400;i++){ updateNades(0.05,0.05); if(nades.length&&player.alive) player.pos.copy(nades[0].pos); if(nades.length===0) break; } })()`);
 const g1={ alive:Gx('player.alive'), kn:Gx('player.killerName'), ks:Gx('player.killerSrc'), st:Gx('!!player._achNadeSelf'), sp:Gx('!!ACH.state().seppuku') };
 console.log(`  [${tag}] 爆后: alive=${g1.alive} killerName="${g1.kn}" killerSrc="${g1.ks}" _achNadeSelf=${g1.st} seppuku(边沿前)=${g1.sp}`);
 Gx('ACH.update(1);');
 const g2={ sp:Gx('!!ACH.state().seppuku'), left:Gx('!!player._achNadeSelf') };
 console.log(`  [${tag}] ACH.update 后: seppuku=${g2.sp} 字段已清=${!g2.left}`);
 return { g1, g2 };
}
function runArc(Gx,tag){
 const arc=Gx(`(function(){
  const out={frames:[]};
  vmEquip('garand',0);
  player.alive=true; player.spectator=false; player.onVehicle=null; player.onMG=null;
  player.nadeIsAT=true; player.nadeIsSmoke=false; player.nadeIsIncin=false;
  player.nadeHeld=true; player.nadeFuse=99; player.nadeCount=2;
  VM.state='nade'; VM.stateT=0; VM.stateDur=999; VM.nadeKind=null;
  updateViewModel(1/60,player);
  out.holdKind=VM.nadeKind; out.holdPick=(VM.nadeM===VM.nadeMs.at);
  player.nadeHeld=false; VM.stateT=0; VM.stateDur=0.55;
  vmSndFlags={};
  for(let i=0;i<40;i++){
    updateViewModel(1/60,player);
    out.frames.push({nt:+(VM.stateT/VM.stateDur).toFixed(3),kind:VM.nadeKind,pick:(VM.nadeM===VM.nadeMs.at),thrown:nades.length>0});
    if(VM.state!=='nade') break;
  }
  out.kindSet=[...new Set(out.frames.map(f=>f.kind))].join(',');
  out.flash=out.frames.some(f=>f.thrown&&f.nt<0.55&&f.kind!=='at');
  return out; })()`);
 console.log(`  [${tag}] 举雷帧 kind=${arc.holdKind} pick=${arc.holdPick} · 弧内 kind 集合=[${arc.kindSet}] · 出手后闪变=${arc.flash}`);
 return arc;
}

// ── G: 审计原文失败模式复现 —— 摘掉 13-combat 的 2026-09-29 重盖章行 (源码补丁 boot),
//      killerSrc 在 die 时就是枪名 → 旧判据假阴性; 专用字段应照样解锁 (解耦价值实证) ──
console.log('\n══ G 摘重盖章 boot: 投雷→开枪→炸死自己 (审计声称的 killerSrc=枪名 世界) ══');
{
 const bad=SRC('js/13-combat.js');
 const anchor='if(n.src&&n.thrower) n.thrower._src=n.src;';
 if(bad.indexOf(anchor)<0){ console.log('  重盖章锚未找到, 跳过'); }
 else{
  const ctx2=boot(IDX,new Map([['js/13-combat.js',bad.replace(anchor,'/* B#30 diag: 摘 2026-09-29 重盖章 (复现审计原文世界) */')]]));
  const G2=(s)=>vm.runInContext(s,ctx2,{timeout:300000});
  try{ G2("document.getElementById('startBtn').onclick();"); }catch(e){ console.log('  G boot err: '+String(e&&e.message)); }
  const r=runSeppuku(G2,'摘重盖章');
  console.log(`  G 判定: 旧世界 killerSrc="${r.g1.ks}"(枪名) → 旧判据必假阴性; 专用字段盖章=${r.g1.st} → 解锁=${r.g2.sp} (期望 true)`);
 }
}

// ── H: #10 修前对照 —— 10-viewmodel 回退旧换模行 (源码补丁 boot), 弧内应见 frag 闪变 ──
console.log('\n══ H 修前对照 boot (旧换模行): 出手弧应见 kind 翻 frag ══');
{
 const old10=SRC('js/10-viewmodel.js');
 const anchor='if(VM.nadeKind!==nk&&(player.nadeHeld||!VM.nadeM)) vmNadeShow(nk);';
 if(old10.indexOf(anchor)<0){ console.log('  修后换模行锚未找到, 跳过'); }
 else{
  const ctx3=boot(IDX,new Map([['js/10-viewmodel.js',old10.replace(anchor,'if(VM.nadeKind!==nk) vmNadeShow(nk);')]]));
  const G3=(s)=>vm.runInContext(s,ctx3,{timeout:300000});
  try{ G3("document.getElementById('startBtn').onclick();"); }catch(e){ console.log('  H boot err: '+String(e&&e.message)); }
  const arc=runArc(G3,'旧换模');
  console.log(`  H 判定: 修前弧内闪变=${arc.flash} (期望 true —— 出手后 kind 翻 frag ~30ms)`);
 }
}
console.log('\n_diag-seppuku 完成');
