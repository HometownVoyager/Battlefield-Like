// ─────────────────────────────────────────────
// dev/_naval-selfcheck.js —— 15d-naval.js 本体自检 (2026-09-20N 海战批 · task-2 · owner: naval-hull)
// 用法: node dev/_naval-selfcheck.js
//
// 目的: 在 headless 沙箱里对 4 型海战载具逐一断言并**报出量化数字** (验收证据):
//   ① 吃水随 flood 单调增 (draft0+flood*0.5, 且 pos.y 跟随水面)
//   ② 横倾方向与转向一致 (横倾弹簧符号 vs 实际 yawRate 符号)
//   ③ 浪涌与浮标同波 (seaWaveOffset 单源: 同一 (x,z,t) 逐点等值 + 浮标实测位移逐点比对)
//   ④ 剖面分工: PT 艇硬搁浅线 (实测二分) / d<17m 速度归零 / 两栖车同位置履带态继续前进
//      + 两栖车 flood=0 永不 'ground' (履带态不做搁浅判定, 定稿 §3.5 边界)
//   ⑤ 搁浅可倒车脱困 (倒车推力 ×groundingRevMul)
//   ⑥ flood>1 沉没全链: 倾斜 → 下沉 → 乘员落水且转游泳态 (真 updatePlayer 验证 player.swim) → wreck
//   ⑦ 重生: muster + 22m 横向铺开, 逐点断言落在 sea.navRing[43,200] 且不搁浅
//   ⑧ 武器端到端: 主炮打艇(15-vehicles 接线) / 双联.50 打艇(13-combat 接线) / 鱼雷命中灌满 flood /
//      鱼雷撞滩哑火 / 主炮打坦克(既有陆战管线零回归)
//   ⑨ 两栖车水陆双态穿越 (浮航 → 履带, 全程不停车)
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
// 共享桩 (dev/_bootstub.js) + verify-tankai 同源的三处补桩 (缺了是"桩能力不足"的假失败)
const {sandbox,document,window}=require('./_bootstub.js');
const V3c=sandbox.THREE.Vector3;
V3c.prototype.addScalar=function(s){ this.x+=s; this.y+=s; this.z+=s; return this; };
V3c.prototype.divideScalar=function(s){ s=s||1; this.x/=s; this.y/=s; this.z/=s; return this; };
for(const k of ['MeshLambertMaterial','MeshBasicMaterial','MeshStandardMaterial','MeshPhongMaterial','PointsMaterial','SpriteMaterial']){
  const C=sandbox.THREE[k];
  if(!C||!C.prototype) continue;
  if(!C.prototype.clone) C.prototype.clone=function(){ return new C(Object.assign({},this,{color:this.color})); };
  if(!C.prototype.dispose) C.prototype.dispose=function(){};
}
const AP=()=>({value:0,setValueAtTime(){},setTargetAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}});
// ── 补桩: _bootstub 的 element 桩缺 lastChild, 且 remove() 是空实现 ──
// 21-match 的 addKillfeed 在击杀播报 >6 条时执行 `while(kf.children.length>6) kf.lastChild.remove();`:
//   ① 无 lastChild ⇒ 抛 "Cannot read properties of undefined (reading 'remove')"
//      (verifier 红线7 的间歇 ERR@帧N 就是这颗地雷, 与游戏代码无关);
//   ② 只补 lastChild 而 remove() 仍是空实现 ⇒ while 永真 → **死循环** (比抛错更坏)。
// 真 DOM 两件事都天然成立; 这里按真语义补齐 (parentNode + 真正从 children 摘除), 让本自检不受影响。
const _hardEl=el=>{
  if(!el||typeof el!=='object'||el._navalHardened) return el;
  el._navalHardened=1;
  try{ if(!('lastChild' in el)) Object.defineProperty(el,'lastChild',{get(){ return (el.children&&el.children.length)?el.children[el.children.length-1]:null; },configurable:true}); }catch(e){}
  try{
    const _add=el.appendChild, _pre=el.prepend;
    if(typeof _add==='function') el.appendChild=function(c){ if(c&&typeof c==='object') c.parentNode=this; const r=_add.call(this,c); return r===undefined?c:r; };
    if(typeof _pre==='function') el.prepend=function(c){ if(c&&typeof c==='object') c.parentNode=this; const r=_pre.call(this,c); return r===undefined?c:r; };
    el.remove=function(){ const p=this.parentNode; if(p&&p.children){ const i=p.children.indexOf(this); if(i>=0) p.children.splice(i,1); } this.parentNode=null; };
  }catch(e){}
  return el;
};
{
  const d=sandbox.document;
  const _byId=d.getElementById.bind(d), _ce=d.createElement.bind(d), _ceNS=d.createElementNS.bind(d);
  d.getElementById=id=>_hardEl(_byId(id));
  d.createElement=t=>_hardEl(_ce(t));
  d.createElementNS=(ns,t)=>_hardEl(_ceNS(ns,t));
}
class ACStub{
  createOscillator(){ return {frequency:AP(),detune:AP(),type:'',start(){},stop(){},connect(){},onended:null}; }
  createGain(){ return {gain:AP(),connect(){},disconnect(){}}; }
  createBuffer(){ return {getChannelData:()=>new Float32Array(16),duration:1,numberOfChannels:1}; }
  createBufferSource(){ return {buffer:null,loop:false,playbackRate:AP(),start(){},stop(){},connect(){},onended:null}; }
  createBiquadFilter(){ return {type:'',frequency:AP(),detune:AP(),Q:AP(),connect(){}}; }
  createDynamicsCompressor(){ return {threshold:AP(),ratio:AP(),attack:AP(),release:AP(),connect(){}}; }
  createStereoPanner(){ return {pan:AP(),connect(){}}; }
  resume(){ return Promise.resolve(); }
  get state(){ return 'running'; }
  get destination(){ return {}; }
  get currentTime(){ return 0; }
  get sampleRate(){ return 44100; }
}
sandbox.AudioContext=ACStub;
sandbox.window.AudioContext=ACStub;
sandbox.window.webkitAudioContext=ACStub;
delete sandbox.window.CANNON;      // 不测布娃娃: 摘掉 CANNON 让 ragInit 走它自己的未就绪分支
// 加载表: probe-water 的 33 个文件 + 海战批 4 个 (15e/15f 允许缺失或抛错 —— 自检对象是 15d)
const FILES=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/15g-capmodels.js','js/15h-capital.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/23-deploy.js','js/24-main.js'];
const SOFT=new Set(['js/15e-navmodels.js','js/15f-battery.js']);   // 队友件: 抛错只记警告
let checks=0,failures=0,notes=[];
const chk=(c,m)=>{ checks++; console.log((c?'  ✓ ':'  ✗ ')+m); if(!c) failures++; };
const info=m=>console.log('    · '+m);
// 战役索引 (island) —— 用小上下文只读 00-config
function campaignIdx(id){
  const ctx=vm.createContext(Object.assign({},sandbox));
  ctx.document=document; ctx.window=window; ctx.globalThis=ctx;
  ctx.localStorage={_s:{},getItem(){return null;},setItem(){},removeItem(){}};
  vm.runInContext(fs.readFileSync(path.join(root,'js/00-config.js'),'utf8'),ctx,{filename:'00-config'});
  return vm.runInContext(`CAMPAIGNS.findIndex(c=>c.id==='${id}')`,ctx);
}
const ISLAND=campaignIdx('island');
if(ISLAND<0){ console.error('找不到 island 战役'); process.exit(1); }
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document; ctx.window=window; ctx.globalThis=ctx;
ctx.localStorage={_s:{sf_campaign:String(ISLAND)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
ctx.console={log:(...a)=>{ const s=a.map(x=>String(x)).join(' '); if(!/^\[(地形|HUD|NAV|世界)/.test(s)) console.log('    | '+s); },warn:console.warn.bind(console),error:console.error.bind(console)};
function load(f){
  try{ vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f}); return 'ok'; }
  catch(e){
    if(SOFT.has(f)){ notes.push(f+' 加载抛错 (软): '+String(e&&e.message)); return 'soft'; }
    console.error('✗ 加载失败 '+f+': '+String(e&&e.stack||e)); process.exit(1);
  }
}
console.log('== 15d-naval.js 本体自检 (island #'+ISLAND+') ==');
for(const f of FILES){ if(!fs.existsSync(path.join(root,f))){ notes.push(f+' 不存在 (跳过)'); continue; } load(f); }
const run=code=>vm.runInContext(code,ctx);
const start=run(`(()=>{ try{ const b=document.getElementById('startBtn'); if(b&&b.onclick){ b.onclick(); return 'ok'; } return 'no-button'; }catch(e){ return 'ERR '+String(e&&e.stack||e); } })()`);
info('开局入口: '+start+(start!=='ok'?'  ← 23-deploy 开局链未跑通, 本自检改为纯单机构造':''));
// ── VM 内助手 ──
vm.runInContext(`
globalThis.__N=(function(){
const S={};
// 摆放到指定离岸距离 d (南湾 x=0; 海侧 z=z0+d)
S.off=(d,yaw)=>({x:0,z:shoreZAt(0)+d,yaw:(yaw===undefined?0:yaw)});
// 放置并复位: 位置/朝向/水态/吃水/血量全按"刚出生"口径
S.place=(n,x,z,yaw)=>{
  n.pos.set(x,0,z); n.yaw=yaw; n._prevYaw=yaw; n.vel=0; n.lastVel=0;
  const d=waterDepthAt(x,z);
  n.floating=(n.kind==='boat')||(d>-1e8&&d>=n.spec.wadeDepth);
  n.draft=navalDraftOf(n);
  const wy=waterYAt(x,z);
  n.pos.y=(wy>-1e8)?wy-n.draft:heightAt(x,z);
  n.baseY=n.pos.y; n.waveY=0; n.state='run'; n.alive=true; n.hp=n.maxHp; n.flood=0;
  n.roll=0; n.rollV=0; n.pitch=0; n.pitchV=0;
  n.suspP=0; n.suspR=0; n.suspPV=0; n.suspRV=0;
  n.torpLeft=n.spec.torpedo||0; n.cannonCd=0; n.secT=0; n.mgT=0; n.torpCd=0;
  n.grp.visible=true; n.grp.position.copy(n.pos); n.grp.rotation.set(0,n.yaw,0);
  return n;
};
S.sim=(dt,frames,pre)=>{ for(let i=0;i<frames;i++){ nowT+=dt; if(pre) pre(dt); updateNaval(dt); } };
S.drive=(n,fwd,turn,dt,frames)=>{ const v=[]; for(let i=0;i<frames;i++){ nowT+=dt; n.drive(fwd,turn,dt); updateNaval(dt); v.push(n.vel); } return v; };
S.shell=(dt,frames,track)=>{ for(let i=0;i<frames;i++){ nowT+=dt; updateNaval(dt); updateShells(dt); if(track&&!track.alive) break; if(track&&track.state==='sinking') break; } };
S.player=(dt,frames)=>{ for(let i=0;i<frames;i++){ nowT+=dt; updateNaval(dt); updatePlayer(dt); } };
S.snap=n=>({x:+n.pos.x.toFixed(3),y:+n.pos.y.toFixed(3),z:+n.pos.z.toFixed(3),yaw:+n.yaw.toFixed(4),
  vel:+n.vel.toFixed(3),hp:+n.hp.toFixed(1),flood:+n.flood.toFixed(4),state:n.state,alive:!!n.alive,
  floating:!!n.floating,draft:+n.draft.toFixed(4),depth:+(n.depth<-1e8?-999:n.depth).toFixed(4),
  roll:+n.roll.toFixed(4),pitch:+n.pitch.toFixed(4),wave:+n.waveY.toFixed(5),base:+n.baseY.toFixed(4),
  d:+shoreDist(n.pos.x,n.pos.z).toFixed(2),torp:n.torpAmmo,respT:+n.respawnT.toFixed(1)});
// 玩家复位 (与 probe-water 同口径)
S.pReset=(x,y,z)=>{
  const p=player;
  p.alive=true; p.deployed=true; p.spectator=false; p.flying=false; p.flyAero=false; p.loiter=null;
  p.hp=100; p.crouch=false; p.prone=false; p.ads=false; p.nadeHeld=false; p.braced=false; p.bandaging=0;
  p.pos.set(x,y,z); p.vel.set(0,0,0); p.onGround=false; p.chute=false;
  p.stamina=1; p.suppressV=0; p.bloom=0; p.fireT=0; p.landDip=0; p.lastDmgT=-99; p.onVehicle=null; p.onNaval=null;
  p.diveD=0; p.oxy=1; p._drownAcc=0; p.navalExit=null; p.swim=false;
  keys.KeyW=false; keys.KeyS=false; keys.KeyA=false; keys.KeyD=false; keys.ShiftLeft=false; keys.Space=false;
  return p;
};
S.pSnap=()=>({alive:!!player.alive,swim:!!player.swim,onV:!!player.onVehicle,onN:!!player.onNaval,
  hp:+player.hp.toFixed(1),y:+player.pos.y.toFixed(3),x:+player.pos.x.toFixed(2),z:+player.pos.z.toFixed(2),
  wd:+(waterDepthAt(player.pos.x,player.pos.z)<-1e8?-999:waterDepthAt(player.pos.x,player.pos.z)).toFixed(3),
  ws:waterStateAt(player.pos.x,player.pos.y,player.pos.z).state});
return S;
})();`,ctx);
// 每个测试用独立实例 (互不干扰), 标记 __test 便于统计
const N=()=>run('__N');
const mk=(key,team,ord)=>run(`(()=>{ const c=new NavalCraft('${key}',${team},${ord}); c._test=1; return navalCraft.length-1; })()`);
const S=n=>run(`__N.snap(navalCraft[${n}])`);
const place=(n,x,z,yaw)=>run(`__N.place(navalCraft[${n}],${x},${z},${yaw})`);
const off=(d)=>run(`__N.off(${d})`);
const sim=(dt,frames,pre)=>run(`__N.sim(${dt},${frames}${pre?','+pre:''})`);
const drive=(n,fwd,turn,secs)=>run(`__N.drive(navalCraft[${n}],${fwd},${turn},1/60,${Math.round(secs*60)})`);
// 测试实例 (team 用 0/1 交替, ord 取大号避免与开局编队撞位)
const KEY=['lvt','kami','pt','gyorai'];
const INST={};
for(let i=0;i<KEY.length;i++) INST[KEY[i]]=mk(KEY[i],i%2,9+i);
// 清场: 23-deploy 开局生成的编队一律封存到图角 (不驱动/不索敌/不重生), 保证实验对象唯一
run(`(()=>{ for(const c of navalCraft){ if(c._test===1) continue; c.aiDrive=false; c.crewBot=null; c.driverBot=null;
  c.playerDriven=false; c.alive=false; c.state='wreck'; c.respawnT=1e9; c.pos.set(400,0,400); c.grp.visible=false; } })()`);
console.log('\n── ① 环境 / 建模接入 ──');
{
  chk(run('typeof NavalCraft')==='function','NavalCraft 类已定义');
  chk(run('Array.isArray(navalCraft)'),'navalCraft 注册表是数组');
  for(const k of KEY){
    const fb=run(`navalCraft[${INST[k]}].modelFallback`);
    const meshes=run(`(()=>{ let n=0; navalCraft[${INST[k]}].grp.traverse(o=>{ if(o.isMesh||o.geometry) n++; }); return n; })()`);
    chk(fb===false,`${k}: 15e navBuildModel 已接入 (兜底盒未启用), 网格数=${meshes}`);
  }
  info('navalCraft 总数='+run('navalCraft.length')+'  其中开局编制(23-deploy)='+run('navalCraft.filter(c=>c._test!==1).length')+' 型键='+run(`navalCraft.filter(c=>c._test!==1).map(c=>c.spec.key+'/'+c.team).join(',')`));
}
console.log('\n── ② 吃水随 flood 单调增 (draft=draft0+flood*0.5) ──');
{
  for(const k of KEY){
    const n=INST[k], P=off(70);
    const rows=[],ys=[],drafts=[];
    let mono=true,fid=true;
    for(const fl of [0,0.25,0.5,0.75,1.0]){
      place(n,P.x,P.z,P.yaw);
      run(`navalCraft[${n}].flood=${fl}; navalCraft[${n}].draft=navalDraftOf(navalCraft[${n}]);`);
      sim(1/60,90);
      const s=S(n);
      rows.push(`flood=${fl.toFixed(2)}→draft=${s.draft}`);
      ys.push(s.y); drafts.push(s.draft);
      const want=run(`NAVAL_SPEC['${k}'].draft0`)+0.5*fl;
      if(Math.abs(s.draft-want)>1e-6) fid=false;
      if(drafts.length>1&&!(drafts[drafts.length-1]>drafts[drafts.length-2])) mono=false;
    }
    chk(fid&&mono,`${k}: 吃水 5 档严格单调增且等于公式 [${rows.join(' ')}]`);
    info(`${k}: 浮态 y 随吃水下行 ${ys.map(v=>v.toFixed(3)).join(' → ')} (含 ±${run('NAVAL_CFG.waveAmp')}m 浪涌, 故 y 不单调是正常的)`);
    // 浮态贴合水面: pos.y ≈ 水面 - 吃水 (+浪涌)
    place(n,off(70).x,off(70).z,off(70).yaw); sim(1/60,60);
    const s=S(n);
    const wy=run(`waterYAt(${s.x},${s.z})`);
    chk(Math.abs((s.y-(s.wave||0))-(wy-s.draft))<0.05,
      `${k}: 浮力贴合水面 |pos.y-浪涌-(水面-吃水)|=${Math.abs(s.y-s.wave-(wy-s.draft)).toFixed(4)}m`);
  }
}
console.log('\n── ③ 浪涌与浮标同波 (seaWaveOffset 单源) ──');
{
  let eq=true;
  for(const [x,z,t] of [[0,220,1.0],[12,-180,3.7],[-90,60,9.25],[200,10,0.5]]){
    const a=run(`navalWaveAt(${x},${z},${t})`), b=run(`seaWaveOffset(${x},${z},${t})`);
    if(a!==b) eq=false;
  }
  chk(eq,'③a 同 (x,z,t) 两处调用逐位相同 (navalWaveAt ≡ seaWaveOffset)');
  const buoy=run(`(()=>{ const b=BUOYS[0]; return b?{x:b.m.position.x,z:b.m.position.z,ph:b.ph}:null; })()`);
  if(!buoy){ info('③ BUOYS 为空 (该战役无浮标) —— 跳过浮标比对'); }
  else{
    const n=INST.pt;
    place(n,buoy.x,buoy.z,0);
    const rows=[]; let maxAbs=0,maxRel=0;
    for(const t of [0.4,1.1,2.3,3.9,5.5]){
      run(`nowT=${t}; updateBuoys(1/60);`);
      const by=run(`BUOYS[0].m.position.y-(SEA.level+0.35)`);
      const cw=run(`seaWaveOffset(${buoy.x},${buoy.z},nowT)`);
      rows.push(`t=${t}: 浮标=${by.toFixed(5)} 艇波=${cw.toFixed(5)} 差=${(by-cw).toFixed(6)}`);
      maxAbs=Math.max(maxAbs,Math.abs(by-cw));
      maxRel=Math.max(maxRel,Math.abs(by-cw)/(Math.abs(cw)+1e-6));
    }
    chk(maxAbs<1e-6,`③b 浮标位移 vs 波场逐点等值: 最大绝对差 ${maxAbs.toExponential(2)}m (浮标随机相位 ph=${buoy.ph.toFixed(3)} 保留但不再参与位移)`);
    rows.forEach(r=>info(r));
    // 艇与浮标同波: 艇在浮标位置处的浪涌 = 浮标位移
    run(`nowT=4.0; updateBuoys(1/60);`);
    place(n,buoy.x,buoy.z,0);
    run(`nowT=4.0; navalCraft[${n}].update(1/60);`);
    const cw=run(`navalCraft[${n}].waveY`), by=run(`BUOYS[0].m.position.y-(SEA.level+0.35)`);
    chk(Math.abs(cw-by)<1e-9,`③c 同位置同帧: 艇浪涌 ${cw.toFixed(6)} = 浮标位移 ${by.toFixed(6)}`);
  }
}
console.log('\n── ④ 剖面分工: PT 硬搁浅线 / 两栖车履带态 (定稿 §1.1 / §3.5) ──');
{
  // 航道勘察: 礁盘上密布龙牙/木桩 (设计意图), 先把"哪条线能开"量出来, 后面的航行走勘察通过的线
  const n=INST.pt;
  const scan=(x,d)=>{
    place(n,x,run(`shoreZAt(${x})`)+d,0);
    return run(`(()=>{ const c=navalCraft[${n}];
      const rad=Math.max(2.2,c.spec.hullW*0.5+0.4), off=Math.max(2.5,c.spec.hullL*0.34);
      return {dep:+waterDepthAt(${x},shoreZAt(${x})+${d}).toFixed(3),
        hard:c._navalBlockedAt(${x},shoreZAt(${x})+${d},rad,off)?1:0,
        soft:c._navalBlockedAt(${x},shoreZAt(${x})+${d},rad,off,'soft')?1:0}; })()`);
  };
  let laneX=null;
  for(const x of [-64,0,70,-30,30]){
    const rows=[];
    for(const d of [17.5,19,22,26,30,36,45]){
      const s=scan(x,d);
      rows.push(`d${d}:${s.dep.toFixed(2)}m${s.hard?'⛔':(s.soft?'~':'·')}`);
    }
    info(`航道 x=${x}: ${rows.join(' ')}`);
    if(laneX===null&&scan(x,19).hard===0&&scan(x,26).hard===0) laneX=x;
  }
  info('选用航道 x='+laneX+' (⛔=硬结构阻挡 ~=细桩擦碰 ·=畅通)');
  chk(laneX!==null,'④ 存在一条"礁盘外→硬搁浅线"的畅通航道 (供本组航行断言使用)');
  const z0=run(`shoreZAt(0)`);
  // 二分求 PT 硬搁浅临界离岸距离 d* (水深 = draft0)
  let lo=10,hi=25;
  for(let i=0;i<40;i++){ const mid=(lo+hi)/2; const dp=run(`waterDepthAt(0,${z0+mid})`); if(dp<run(`NAVAL_SPEC.pt.draft0`)) lo=mid; else hi=mid; }
  const dStar=(lo+hi)/2, hStar=run(`waterDepthAt(0,${z0+dStar})`);
  info(`岸线 z0=${z0.toFixed(1)}  PT 硬搁浅临界 d*=${dStar.toFixed(3)}m (水深 ${hStar.toFixed(4)}m = draft0 0.95)`);
  chk(dStar>16.5&&dStar<17.8,`④ PT 硬搁浅线 ≈17.15m (实测 ${dStar.toFixed(3)}m)`);
  // PT 在 d=17.0 (浅于临界) → 速度归零; 与"零油门对照"比位移 ⇒ 证明位移不是推进造成的
  {
    const n=INST.pt; const P=off(17.0);
    place(n,P.x,P.z,Math.PI);
    const p0=S(n);
    const vs=drive(n,1,0,2.0);
    const p1=S(n);
    const disp=Math.hypot(p1.x-p0.x,p1.z-p0.z);
    // 对照: 同一位置零输入 2s (礁盘上木桩挤推/浪涌造成的位移基线)
    place(n,P.x,P.z,Math.PI);
    const q0=S(n);
    sim(1/60,120);
    const q1=S(n);
    const idle=Math.hypot(q1.x-q0.x,q1.z-q0.z);
    chk(p1.state==='ground'&&Math.abs(p1.vel)<0.05&&disp<3&&Math.abs(disp-idle)<1.5,
      `④a PT @d=17.0m(水深 ${p1.depth.toFixed(3)}<draft 0.95) → state=${p1.state}, |vel|=${Math.abs(p1.vel).toFixed(4)}m/s; 2s 位移=${disp.toFixed(3)}m vs 零油门对照 ${idle.toFixed(3)}m (推进贡献≈0)`);
  }
  // PT 在浅水带 (d=19m, 水深 1.05 ∈ [draft, draft+pad)) 可正常航行, 速度受 ×0.40 限; 走天然剖面朝岸开则停在硬搁浅线
  {
    const n=INST.pt;
    const spdFull=run(`NAVAL_SPEC.pt.spd`);
    const LX=-30;                                   // 勘察选出的畅通线 (x=0 有硬障碍带)
    const zAt=x=>run(`shoreZAt(${x})`);
    place(n,off(90).x,off(90).z,0);                 // 深水满速对照
    drive(n,1,0,2.5);
    const vDeep=S(n).vel;
    place(n,LX,zAt(LX)+19,0);                       // 浅水带朝海开 2s (不与障碍带纠缠)
    const p0=S(n);
    drive(n,1,0,2.0);
    const p1=S(n);
    const disp=Math.hypot(p1.x-p0.x,p1.z-p0.z);
    chk(p1.state==='run'&&p1.vel>4&&disp>6,
      `④b PT @x=${LX},d=19m(水深 ${p1.depth.toFixed(3)}, 浅水带) 朝海开: state=${p1.state}, vel=${p1.vel.toFixed(2)}m/s (满速×0.40=${(spdFull*0.4).toFixed(2)}, 深水对照 ${vDeep.toFixed(2)}), 2s 位移=${disp.toFixed(2)}m`);
    // 反向: 从 d=26m 沿同一畅通线朝岸开 11s → 必须顶在硬搁浅线 (实测 17.117) 上停下
    place(n,LX,zAt(LX)+26,Math.PI);
    drive(n,1,0,8.0);
    const dwell=run(`(()=>{ const c=navalCraft[${n}]; for(let i=0;i<180;i++){ nowT+=1/60; c.drive(1,0,1/60); updateNaval(1/60); } return +shoreDist(c.pos.x,c.pos.z).toFixed(3); })()`);
    const dep2=run(`waterDepthAt(navalCraft[${n}].pos.x,navalCraft[${n}].pos.z)`);
    const st2=run(`navalCraft[${n}].state`), v2=run(`+navalCraft[${n}].vel.toFixed(3)`);
    chk(st2==='ground'&&dwell>16.8&&dwell<17.6&&Math.abs(v2)<0.05,
      `④b2 PT 从 d=26m 朝岸开 11s → 顶在 d=${dwell}m (硬搁浅线实测 17.117m) 停下: state=${st2}, vel=${v2}, 水深 ${dep2.toFixed(3)}`);
    // 切深航道 (x=-64) 全程畅通: 这是 §5.2/§1.1 的设计分工依据 (艇沿航道进逼, 礁盘障碍带挡在别处)
    const ch=run(`(()=>{ const out=[]; for(const d of [18,22,26,30,36]) out.push(d+':'+waterDepthAt(-64,shoreZAt(-64)+d).toFixed(2)); return out.join(' '); })()`);
    info(`切深航道 x=-64 水深: ${ch} (设计 2.45m 下切 —— 艇可沿航道贴到 d=18m 而不触底)`);
  }
  // 两栖车在同一位置: d=17.0 → 浮航态继续前进; d=8.0 → 履带态继续前进
  for(const d of [17.0,8.0]){
    const n=INST.lvt; const P=off(d);
    place(n,P.x,P.z,Math.PI);
    const p0=S(n);
    drive(n,1,0,2.0);
    const p1=S(n);
    const disp=Math.hypot(p1.x-p0.x,p1.z-p0.z);
    chk(p1.floating===(d===17.0)&&p1.state!=='ground'&&disp>2.5,
      `④c LVT @d=${d.toFixed(1)}m(水深 ${p1.depth.toFixed(3)}) → ${p1.floating?'浮航态':'履带态'}, state=${p1.state}, vel=${p1.vel.toFixed(2)}m/s, 2s 位移=${disp.toFixed(2)}m (继续前进)`);
  }
  // 边界断言 (Lead 定稿口径): 两栖车 flood=0 时扫全线, state 永不为 'ground'
  {
    const n=INST.lvt; let bad=null,rows=[];
    for(let d=5;d<=60;d+=2.5){
      const P=off(d);
      place(n,P.x,P.z,Math.PI);
      drive(n,1,0,0.6);
      const s=S(n);
      rows.push(`${d.toFixed(0)}m:${s.state}${s.floating?'F':'T'}`);
      if(s.state==='ground') bad=`d=${d} 水深=${s.depth}`;
    }
    chk(!bad,`④d 两栖车 flood=0 全线 5..60m 履带/浮航均不搁浅 (${rows.slice(0,10).join(' ')} …)`+(bad?' 反例: '+bad:''));
  }
  // 浅水刮擦 + 减速 (与深水同输入对照)
  {
    const n=INST.pt; const P=off(22.5);
    const spdFull=run(`NAVAL_SPEC.pt.spd`);
    place(n,P.x,P.z,Math.PI);
    const hp0=run(`navalCraft[${n}].hp`);
    const vs=drive(n,1,0,1.0);
    const s=S(n);
    chk(hp0-s.hp>3.4&&s.vel<spdFull*run('NAVAL_CFG.shallowSpdMul')+0.5,
      `④e PT @d=22.5m(礁盘, 水深 ${s.depth.toFixed(3)}∈[draft, draft+pad)) 浅水: vel=${s.vel.toFixed(2)} ≤ 满速×${run('NAVAL_CFG.shallowSpdMul')}=${(spdFull*run('NAVAL_CFG.shallowSpdMul')).toFixed(2)}m/s, 1s 刮擦伤害=${(hp0-s.hp).toFixed(2)} (>${(run('NAVAL_CFG.shallowScrub')*0.85).toFixed(1)}, 满值 ${run('NAVAL_CFG.shallowScrub')}/s)`);
  }
}
console.log('\n── ⑤ 搁浅可倒车脱困 (倒车推力 ×groundingRevMul) ──');
{
  const n=INST.pt; const P=off(16.0);
  place(n,P.x,P.z,Math.PI);          // 艏朝陆, 倒车向海
  const p0=S(n);
  const vs=drive(n,-1,0,0.8);
  const mid=S(n);
  const vs2=drive(n,-1,0,4.2);
  const p1=S(n);
  const disp=Math.hypot(p1.x-p0.x,p1.z-p0.z);
  const revLimit=run(`NAVAL_SPEC.pt.rev`)*run(`NAVAL_CFG.groundingRevMul`);
  // 判据: 倒车把吃水线重新"抬"回水面以上 (depth ≥ draft ⇒ state 由 'ground' 回到 'run') 且确实后移
  chk(p1.state==='run'&&p1.depth>run(`NAVAL_SPEC.pt.draft0`)&&disp>1.0,
    `⑤ 倒车脱困: 起始 state=${mid.state} 水深${mid.depth.toFixed(3)} → 5s 后 state=${p1.state} 水深${p1.depth.toFixed(3)}(>draft 0.95) 后移=${disp.toFixed(2)}m (倒车推力上限 ${revLimit.toFixed(2)}m/s; 礁盘上有硬障碍带, 后移距离按可行空间计)`);
  const maxG=Math.max(...vs.map(Math.abs));
  chk(maxG<=revLimit+0.5,`⑤b 搁浅中倒车速度未超上限: max|vel|=${maxG.toFixed(3)} ≤ ${(revLimit+0.5).toFixed(2)}`);
}
console.log('\n── ⑥ flood>1 沉没全链 (倾斜→下沉→乘员落水转游泳→wreck) ──');
for(const k of KEY){
  const n=INST[k]; const P=off(70);
  place(n,P.x,P.z,0);
  // 车组用真 Bot (14-bots 的车组契约): 落水后它自己的 update 会按水深转游泳态
  run(`(()=>{ const b=new Bot(${(k==='kami'||k==='gyorai')?1:0},0); b.alive=true; b.hp=100;
    b.onVehicle=navalCraft[${n}]; navalCraft[${n}].crewBot=b; b.pos.set(navalCraft[${n}].pos.x,0,navalCraft[${n}].pos.z);
    globalThis.__crew=b; })()`);
  // 用 flood>1 触发 (而非 hp<=0) —— 直接验"进水满则沉"这条独立入口
  run(`navalCraft[${n}].flood=1.02; navalCraft[${n}].takeDmg(1,null,true);`);
  const t0=S(n);
  const tiltT=run('NAVAL_CFG.sinkTilt'), sinkT=run(`NAVAL_SPEC['${k}'].sinkT`);
  sim(1/60,Math.round(tiltT*60*0.5));
  const tMid=S(n);
  sim(1/60,Math.round(tiltT*60*0.5)+6);
  const tTilt=S(n);
  const crew1=run(`({stillOn:!!navalCraft[${n}].crewBot, onV:!!__crew.onVehicle, alive:!!__crew.alive,
    x:+__crew.pos.x.toFixed(2), y:+__crew.pos.y.toFixed(3), z:+__crew.pos.z.toFixed(2),
    wd:+(waterDepthAt(__crew.pos.x,__crew.pos.z)<-1e8?-999:waterDepthAt(__crew.pos.x,__crew.pos.z)).toFixed(3)})`);
  sim(1/60,Math.round(sinkT*60)+30);
  const tEnd=S(n);
  chk(t0.state==='sinking'&&t0.alive===false,`${k}: flood>1 → state='sinking', alive=false (t=0)`);
  chk(Math.abs(tMid.roll)>0.15,`${k}: ① 倾斜段 0.4s 时 |roll|=${Math.abs(tMid.roll).toFixed(3)} rad (>0.15)`);
  chk(Math.abs(tTilt.vel)<0.01,`${k}: ① 倾斜段速度衰减到 0 (|vel|=${Math.abs(tTilt.vel).toFixed(4)})`);
  chk(crew1.onV===false&&crew1.stillOn===false&&crew1.alive===true,
    `${k}: ③ 乘员落水: onVehicle=null craft.crewBot=null 且 alive=true (落点水深 ${crew1.wd}m > SWIM_DEPTH ${run('SWIM_DEPTH')} ⇒ 游泳态)`);
  chk(tEnd.state==='wreck'&&tEnd.alive===false,`${k}: ④ 全链终点 state='wreck' (t=${(tiltT+sinkT).toFixed(1)}s 后), pos.y=${tEnd.y.toFixed(2)} (水面 0 → 沉底)`);
  const wb=run(`navalCraft[${n}].wreckBs?navalCraft[${n}].wreckBs.length:0`);
  chk(wb===3,`${k}: ④ 残骸登记水下掩体碰撞体 ${wb} 个`);
  const near=run(`(()=>{ const w=navalCraft[${n}]; const r=navalNear(w.pos.x,w.pos.z,12); return r?(r===w?'__SELF__':r.spec.key):null; })()`);
  chk(near!=='__SELF__',`${k}: wreck 不再被 navalNear 索敌 (12m 内返回 ${near===null?'null':'他船 '+near}), 也不计入 navalCount=${run(`navalCount(${(k==='kami'||k==='gyorai')?1:0})`)}`);
}
{
  // 乘员落水 (车组 Bot): 用**场上真 Bot** 走一遍, 落水后跑它自己的 update 验游泳态与朝岸游
  const n=INST.pt;
  const P=off(70);
  place(n,P.x,P.z,0);
  const picked=run(`(()=>{ const b=soldiers.find(s=>s.alive&&s.team===0&&!s.onVehicle&&typeof s.update==='function');
    if(!b) return null;
    b.onVehicle=navalCraft[${n}]; navalCraft[${n}].crewBot=b;
    b.pos.set(navalCraft[${n}].pos.x,navalCraft[${n}].pos.y,navalCraft[${n}].pos.z);
    globalThis.__bot=b; return {team:b.team,hp:+b.hp.toFixed(0)}; })()`);
  if(!picked) info('⑥b 场上无可用真 Bot —— 跳过车组落水实机验证 (玩家侧 ⑥c 已实测)');
  else{
    // 给车组 Bot 的 damage 打桩: 沉没链若对乘员有任何伤害, 这里必须记下来 (判"乘员落水 alive"的**因果**归属)
    run(`(()=>{ const b=__bot; globalThis.__cdmg=[]; const od=b.damage.bind(b);
      b.damage=function(amt,att,head){ __cdmg.push({amt:+amt.toFixed(1),src:(att&&(att.name||att._src))||String(att)}); return od(amt,att,head); }; })()`);
    run(`navalCraft[${n}].flood=1.02; navalCraft[${n}].takeDmg(1,null,true);`);
    sim(1/60,Math.round((run('NAVAL_CFG.sinkTilt')+0.2)*60));
    const c1=run(`({onV:!!__bot.onVehicle,x:+__bot.pos.x.toFixed(2),y:+__bot.pos.y.toFixed(3),z:+__bot.pos.z.toFixed(2),vis:!!__bot.mesh.root.visible,crew:!!navalCraft[${n}].crewBot,ws:waterStateAt(__bot.pos.x,__bot.pos.y,__bot.pos.z).state,sd:+shoreDist(__bot.pos.x,__bot.pos.z).toFixed(1)})`);
    run(`for(let i=0;i<900;i++){ nowT+=1/60; __bot.update(1/60); }`);
    const c2=run(`({alive:!!__bot.alive,swim:!!__bot.swim,y:+__bot.pos.y.toFixed(3),wd:+waterDepthAt(__bot.pos.x,__bot.pos.z).toFixed(3),x:+__bot.pos.x.toFixed(2),z:+__bot.pos.z.toFixed(2),ws:waterStateAt(__bot.pos.x,__bot.pos.y,__bot.pos.z).state,sd:+shoreDist(__bot.pos.x,__bot.pos.z).toFixed(1)})`);
    chk(c1.onV===false&&c1.crew===false,`⑥b 车组 Bot 落水: onVehicle=null, craft.crewBot=null, mesh 可见=${c1.vis}, 落点水态=${c1.ws}`);
    chk(c2.alive&&c2.wd>run('SWIM_DEPTH'),`⑥b 落水后存活且在水深 ${c2.wd}m (>SWIM_DEPTH ${run('SWIM_DEPTH')}) 的水里, 水态=${c2.ws}`);
    // 硬判据 (naval-ai 已在 Bot.update 首部按 waterStateAt 对账补位 swim): 车组也必须转游泳态
    chk(c2.swim===true,`⑥b 真 Bot 落水后转游泳态 (swim=${c2.swim}, 水态=${c2.ws}); 15s 离岸 ${c1.sd}m → ${c2.sd}m (位移 ${Math.hypot(c2.x-c1.x,c2.z-c1.z).toFixed(2)}m)`);
    chk(c2.sd<=c1.sd+0.5,'⑥b 落水后未被带向外海 (离岸距离未增大)');
    // 硬判据: 沉没链自身对乘员**零伤害** (把"乘员 alive"的因果钉死, 防活战场流弹污染判据)
    const cd=run(`__cdmg.length`), cds=run(`JSON.stringify(__cdmg.slice(0,3))`);
    chk(cd===0,`⑥b 沉没链自身对车组零伤害 (damage 打桩命中 ${cd} 次${cd?' '+cds:''}) ⇒ 乘员 alive 不是"侥幸没被打"`);
  }
}
{
  // 乘员落水 (玩家): 真 updatePlayer 验证 player.swim
  const n=INST.gyorai;
  const P=off(70);
  place(n,P.x,P.z,0);
  run(`__N.pReset(${P.x},0,${P.z}); player.onNaval=navalCraft[${n}]; navalCraft[${n}].playerDriven=true;`);
  run(`navalCraft[${n}].flood=1.02; navalCraft[${n}].takeDmg(1,null,true);`);
  sim(1/60,Math.round((run('NAVAL_CFG.sinkTilt')+0.3)*60));
  const p1=run('__N.pSnap()');
  run(`__N.player(1/60,180)`);
  const p2=run('__N.pSnap()');
  chk(p1.onV===false&&p1.onN===false&&p1.alive===true,
    `⑥c 玩家落水: onVehicle=null onNaval=null 且 alive=true (hp=${p1.hp})`);
  chk(p2.swim===true&&p2.ws==='swim',`⑥c 玩家落水后真 updatePlayer 180 帧 → player.swim=${p2.swim}, 水态=${p2.ws}, 水深=${p2.wd}m, hp=${p2.hp} (不溺水)`);
}
console.log('\n── ⑦ 重生: muster + 22m 横向铺开, 落在 sea.navRing 内且不搁浅 ──');
{
  const muster=run('JSON.stringify(CAMPAIGN.sea.muster)');
  info('muster = '+muster);
  const N0=run('CAMPAIGN.navalN[0]'), N1=run('CAMPAIGN.navalN[1]');
  const rows=[];
  let ok=true, gapOk=true, notGrounded=true;
  for(let t=0;t<2;t++){
    const keys=[t===0?'lvt':'kami',t===0?'pt':'gyorai'];
    let prev=null;
    for(const k of keys){
      const start=(k==='lvt'||k==='kami')?0:N0;
      const cnt=(k==='lvt'||k==='kami')?N0:N1;
      for(let i=0;i<cnt;i++){
        const ord=start+i;
        const id=mk(k,t,ord);
        run(`navalCraft[${id}].respawn(true,true)`);
        const s=S(id);
        const dep=run(`waterDepthAt(navalCraft[${id}].pos.x,navalCraft[${id}].pos.z)`);
        const ring=run('CAMPAIGN.sea.navRing');
        const d0=run(`NAVAL_SPEC['${k}'].draft0`);
        rows.push(`t${t}/${k}#${ord}: d=${s.d} draft0=${d0.toFixed(2)} depth=${dep.toFixed(2)} face=${run(`navalCraft[${id}].yaw`).toFixed(3)}`);
        if(!(s.d>=ring.d0&&s.d<=ring.d1)) ok=false;
        if(dep<d0+0.05) notGrounded=false;
        if(prev){ const gap=Math.hypot(s.x-prev.x,s.z-prev.z); if(Math.abs(gap-22)>0.01) gapOk=false; }
        prev=s;
        run(`navalCraft[${id}].alive=false; navalCraft[${id}].respawnT=1e9;`);   // 清场: 不污染后续测试
      }
    }
  }
  const ring=run('JSON.stringify(CAMPAIGN.sea.navRing)');
  rows.forEach(r=>info(r));
  chk(ok,`⑦a ${rows.length} 个重生点全部落在 navRing ${ring} 内`);
  chk(notGrounded,'⑦b 全部重生点水深 ≥ draft0+0.05 (重生不搁浅)');
  chk(gapOk,'⑦c 相邻重生点间距 = 22.0m (队内序号横向铺开)');
  // 朝向 = muster.face
  const f0=run(`(()=>{ const id=${mk('pt',0,0)}; navalCraft[id].respawn(true,true); return navalCraft[id].yaw; })()`);
  chk(Math.abs(f0-run('CAMPAIGN.sea.muster[0].face'))<1e-9,`⑦d 重生朝向 = muster.face (${f0.toFixed(3)})`);
  // 冷却 55..70
  {
    const id=mk('pt',0,0);
    run(`navalCraft[${id}].die(null)`);
    const rt=run(`navalCraft[${id}].respawnT`);
    chk(rt>=55&&rt<=70,`⑦e 战损重生冷却 = ${rt.toFixed(1)}s ∈ [55,70] (§6.3)`);
    run(`navalCraft[${id}].respawn(true,true)`);
  }
}
console.log('\n── ⑧ 武器端到端 ──');
{ // 主炮打艇 (updateShells 的 shellHitNaval 接线)
  const a=mk('pt',0,0), b=mk('gyorai',1,0);
  const P=off(70);
  place(a,P.x,P.z,0); place(b,P.x+60,P.z,0);       // 两艇相距 60m, 同向
  run(`shells.length=0`);
  const aim=run(`(()=>{ const A=navalCraft[${a}],B=navalCraft[${b}];
    const o=A.muzzle('main'); const t={x:B.pos.x,y:B.pos.y+B.spec.hullY,z:B.pos.z};
    const d=new THREE.Vector3(t.x-o.x,t.y-o.y,t.z-o.z).normalize(); return {x:d.x,y:d.y,z:d.z}; })()`);
  const hp0=run(`navalCraft[${b}].hp`);
  run(`navalCraft[${a}].fireMain(new THREE.Vector3(${aim.x},${aim.y},${aim.z}))`);
  const nShell=run('shells.length');
  run(`__N.shell(1/60,120,navalCraft[${b}])`);
  const hp1=run(`navalCraft[${b}].hp`);
  chk(nShell===1&&hp0-hp1>100,`⑧a 主炮对艇 (走 15-vehicles 接线): 出膛 1 发, 60m 命中 → 目标 hp ${hp0}→${hp1} (伤害 ${(hp0-hp1).toFixed(0)}, 弹速 ${run(`NAVAL_SPEC.pt.main.spd`)}m/s)`);
  chk(run('shells.length')===0,`⑧a 炮弹命中后已清出在途表 (shells=0)`);
  run(`navalCraft[${a}].alive=false; navalCraft[${b}].alive=false;`);
}
{ // 双联 .50 打艇 (fireBullet 的 navalBulletTest 接线)
  const a=mk('pt',0,0), b=mk('gyorai',1,0);
  const P=off(70);
  place(a,P.x,P.z,0); place(b,P.x+30,P.z,0);
  const hp0=run(`navalCraft[${b}].hp`);
  const hits=run(`(()=>{ let n=0; const A=navalCraft[${a}],B=navalCraft[${b}];
    const o=A.muzzle('secondary');
    const dir=new THREE.Vector3(B.pos.x-o.x,B.pos.y+B.spec.hullY-o.y,B.pos.z-o.z).normalize();
    for(let i=0;i<40;i++){ nowT+=1/60; A.secT=0; if(A.fireSecondary(dir)) n++; }
    return n; })()`);
  const hp1=run(`navalCraft[${b}].hp`);
  const per=run(`NAVAL_SPEC.pt.secondary.dmg*TANK_ARMOR`);
  chk(hits>0&&hp0-hp1>20,`⑧b 双联 .50 对艇 (走 13-combat fireBullet 接线): ${hits} 轮齐射 → 目标 hp ${hp0}→${hp1} (每发非ap伤害 ${per.toFixed(1)}×2 管)`);
  run(`navalCraft[${a}].alive=false; navalCraft[${b}].alive=false;`);
}
{ // 鱼雷命中 → 灌满 flood
  const a=mk('pt',0,0), b=mk('gyorai',1,0);
  const P=off(70);
  place(a,P.x,P.z,0); place(b,P.x+110,P.z,0);
  run(`torpedoes.length=0`);
  const aim=run(`(()=>{ const A=navalCraft[${a}],B=navalCraft[${b}];
    const dx=B.pos.x-A.pos.x, dz=B.pos.z-A.pos.z; const l=Math.hypot(dx,dz);
    return {x:dx/l,y:0,z:dz/l,ammo:A.torpAmmo}; })()`);
  run(`navalCraft[${a}].fireTorpedo(1,new THREE.Vector3(${aim.x},0,${aim.z}))`);
  const nT=run('torpedoes.length'), ammo=run(`navalCraft[${a}].torpAmmo`);
  run(`__N.sim(1/60,${Math.round(9*60)},()=>{})`);
  const bs=S(b);
  chk(nT===1&&ammo===run(`NAVAL_SPEC.pt.torpedo`)-1,`⑧c 鱼雷出管: 在途 ${nT} 条, torpAmmo ${aim.ammo}→${ammo}`);
  chk(bs.state==='sinking'||bs.state==='wreck',`⑧c 鱼雷命中 110m 外目标 → 目标 state=${bs.state} flood=${bs.flood} (命中即灌满 flood, 直接进沉没链)`);
  run(`navalCraft[${a}].alive=false; navalCraft[${b}].alive=false;`);
}
{ // 鱼雷撞滩哑火
  const a=mk('pt',0,0);
  const P=off(40);
  place(a,P.x,P.z,Math.PI);            // 朝陆发射
  run(`torpedoes.length=0`);
  run(`navalCraft[${a}].fireTorpedo(0,new THREE.Vector3(Math.sin(Math.PI),0,Math.cos(Math.PI)))`);
  run(`__N.sim(1/60,${Math.round(20*60)},()=>{})`);
  const alive=run('torpedoes.length');
  const st=run(`(()=>{ const t=torpedoes[0]; return t?+waterDepthAt(t.pos.x,t.pos.z).toFixed(3):null; })()`);
  chk(alive===0,`⑧d 鱼雷撞滩哑火: 朝岸发射后 20s 在途表清空 (无残留, 对岸零伤害)`);
  run(`navalCraft[${a}].alive=false;`);
}
{ // 主炮打坦克 (既有陆战管线零回归): 坦克摆在岸上, 艇在礁盘外, 炮弹跨水线打岸
  const a=mk('pt',0,0);
  const t0=run(`(()=>{ const t=tanks.find(x=>x.alive&&x.team===1); return t?tanks.indexOf(t):-1; })()`);
  if(t0<0) info('⑧e 场上无存活坦克 —— 跳过陆战回归');
  else{
    const z0=run('shoreZAt(-30)');
    const P={x:-30, z:z0+26};              // 艇在礁盘 (浅水), 面向陆; 目标坦克站在岸边浅水里 (保持弹道不穿滩头障碍带)
    place(a,P.x,P.z,Math.PI);
    const tx=-30, tz=z0+5;
    run(`(()=>{ const t=tanks[${t0}]; t.pos.set(${tx},0,${tz}); t.pos.y=heightAt(${tx},${tz}); t.vel=0; t.crewBot=null; t.alive=true; t.hp=t.maxHp; })()`);
    const hp0=run(`tanks[${t0}].hp`);
    const aim=run(`(()=>{ const A=navalCraft[${a}],T=tanks[${t0}];
      const o=A.muzzle('main'); const d=new THREE.Vector3(T.pos.x-o.x,T.pos.y+1.3-o.y,T.pos.z-o.z).normalize(); return {x:d.x,y:d.y,z:d.z}; })()`);
    run(`navalCraft[${a}].fireMain(new THREE.Vector3(${aim.x},${aim.y},${aim.z}))`);
    const path=run(`(()=>{ const out=[]; const T=tanks[${t0}];
      for(let i=0;i<120;i++){ nowT+=1/60; updateNaval(1/60); updateShells(1/60);
        const s=shells[shells.length-1];
        if(i%6===0||shells.length===0) out.push('f'+i+':n='+shells.length+(s?'@'+s.pos.z.toFixed(0)+'m':'命中'));
        if(shells.length===0) break; }
      return out.slice(0,6).join(' '); })()`);
    info('⑧e 弹道: '+path);
    const hp1=run(`tanks[${t0}].hp`);
    chk(hp0-hp1>100,`⑧e 主炮对岸 (既有 shells 管线零回归): 跨 ${(P.z-tz).toFixed(0)}m (水面+滩头) 命中岸上坦克, hp ${hp0}→${hp1} (伤害 ${(hp0-hp1).toFixed(0)})`);
  }
  run(`navalCraft[${a}].alive=false;`);
}
{ // 溅射对艇 (13-combat splashDamage 接线)
  const b=mk('gyorai',1,0);
  const P=off(70);
  place(b,P.x,P.z,0);
  const hp0=run(`navalCraft[${b}].hp`);
  run(`splashDamage(new THREE.Vector3(${P.x+3},0,${P.z}),null,0,7,150,110,true)`);
  const hp1=run(`navalCraft[${b}].hp`);
  chk(hp0-hp1>10,`⑧f 溅射对艇 (13-combat splashDamage 接线): 半径内一发 150 / 距 3m → hp ${hp0}→${hp1} (伤害 ${(hp0-hp1).toFixed(0)})`);
  run(`navalCraft[${b}].alive=false;`);
}
console.log('\n── ⑨ 两栖车水陆双态穿越 (浮航 → 履带, 全程不停车) ──');
{
  const n=INST.lvt;
  const P=off(60);
  place(n,P.x,P.z,Math.PI);
  const rows=[]; let trans=null,prevFloat=null,minV=1e9,anyGround=false,distAfter=0;
  for(let i=0;i<240;i++){
    run(`__N.drive(navalCraft[${n}],1,0,1/60,60)`);       // 每秒 60 帧
    const s=S(n);
    if(prevFloat!==null&&prevFloat!==s.floating&&!trans) trans={...s,t:(i+1)};
    if(prevFloat!==null&&prevFloat!==s.floating&&trans) distAfter=Math.hypot(s.x-trans.x,s.z-trans.z);
    prevFloat=s.floating;
    if(s.state==='ground') anyGround=true;
    minV=Math.min(minV,s.vel);
    if(i%20===0) rows.push(`${((i+1)/60).toFixed(1)}s d=${s.d} depth=${s.depth} ${s.floating?'浮航':'履带'} state=${s.state} v=${s.vel.toFixed(2)}`);
  }
  const s=S(n);
  rows.forEach(r=>info(r));
  chk(anyGround===false,`⑨ 穿越全程无 'ground' (履带态不做搁浅判定)`);
  chk(!!trans,`⑨ 检测到水陆态切换: ${trans?`depth=${trans.depth.toFixed(3)} (wadeDepth=${run(`NAVAL_SPEC.lvt.wadeDepth`)})`:'未切换'}`);
  chk(s.x!==undefined&&Math.abs(s.d)<run('CAMPAIGN.sea.navRing.d0'),`⑨ 已冲上滩头: 最终离岸 d=${s.d}m (<navRing d0=${run('CAMPAIGN.sea.navRing.d0')}), 位移=${Math.hypot(s.x-P.x,s.z-P.z).toFixed(1)}m`);
  chk(minV>0.5,`⑨ 全程未停车: 最低速度 ${minV.toFixed(2)}m/s`);
}
// ── ⑩ AI 集成诊断 (仅 NAVAL_AI_DIAG=1 时跑): 给 naval-ai/Lead 定位"红线7 AI"用 ──
// 判据归属: 用同一套 15d 物理 + 真 Bot 驱动, 打印 AI 自主模式/离岸/状态轨迹 —— 区分"物理不让上岸"与"AI 没在开"
if(process.env.NAVAL_AI_DIAG==='1'){
  console.log('\n── ⑩ AI 集成诊断 (NAVAL_AI_DIAG=1) ──');
  for(const [k,team,label] of [['pt',0,'艇 team0'],['lvt',0,'两栖车 team0']]){
    const id=mk(k,team,0);
    const mu=run(`JSON.stringify(navalMusterSpot(${team},0))`);
    run(`(()=>{ const c=navalCraft[${id}]; const sp=navalMusterSpot(${team},0);
      c.pos.set(sp.x,sp.y===undefined?0:sp.y,sp.z); c.yaw=sp.face||0; c._prevYaw=c.yaw; c.vel=0;
      const b=new Bot(${team},0); b.alive=true; b.hp=100; b.spawnInVehicle(c);
      b.pos.set(c.pos.x,c.pos.y,c.pos.z); globalThis.__aibot=b; })()`);
    const rows=[];
    for(let sec=0;sec<70;sec++){
      run(`for(let i=0;i<60;i++){ nowT+=1/60; updateNaval(1/60); __aibot.update(1/60); }`);
      const s=run(`(()=>{ const c=navalCraft[${id}]; const g=(typeof navalAIDebug==='function')?navalAIDebug(c):null;
        return {d:+shoreDist(c.pos.x,c.pos.z).toFixed(1),dep:+(waterDepthAt(c.pos.x,c.pos.z)<-1e8?-999:waterDepthAt(c.pos.x,c.pos.z)).toFixed(2),
          fl:c.floating?1:0,st:c.state,v:+c.vel.toFixed(2),mode:g?(g.mode||''):'',alive:!!c.alive,x:+c.pos.x.toFixed(0),z:+c.pos.z.toFixed(0)}; })()`);
      if(sec%5===0||sec===69) rows.push(`${sec}s: 离岸${s.d}m 水深${s.dep} ${s.fl?'浮':'履带'} ${s.st} v=${s.v} mode=${s.mode} (${s.x},${s.z})`);
      if(!s.alive){ rows.push(`${sec}s: 载具已被摧毁 → 停止采样`); break; }
    }
    info(label+' @muster'+mu);
    rows.forEach(r=>info('   '+r));
  }
}
// ── ⑪ 红线5 复现诊断 (仅 NAVAL_AI_DIAG=2): 完全照 verifier 的 harness 走一遍, 找出"乘员 alive=false"的真凶 ──
// 关键点: 那段 step() 只跑 updateNaval + updateShells (不跑 bot.update) ⇒ 若 Bot 仍掉血, 凶手一定在载具链上,
//   故这里给 Bot.damage 打桩记录**每一次伤害的来源与调用栈** (不猜, 取证)。
if(process.env.NAVAL_AI_DIAG==='2'){
  console.log('\n── ⑪ 红线5 复现诊断 (NAVAL_AI_DIAG=2) ──');
  const id=mk('pt',0,0);
  run(`(()=>{ const c=navalCraft[${id}]; const P=(function(){ for(let x=-260;x<=260;x+=4)for(let z=-260;z<=260;z+=4){ const d=waterDepthAt(x,z); if(d>=3.4&&d<=7.0) return {x,z}; } return null; })();
    c.pos.set(P.x,0,P.z); c.yaw=0; c._prevYaw=0; c.vel=0; c.alive=true; c.hp=c.maxHp; c.flood=0; c.state='run';
    const b=new Bot(0,0,'落水探针'); b.spawnInVehicle(c); b.alive=true; b.hp=100; b.pos.set(c.pos.x,c.pos.y||0,c.pos.z);
    if(!c.driverBot) c.driverBot=b;
    globalThis.__probe=b; globalThis.__dmg=[];
    const od=b.damage.bind(b);
    b.damage=function(amt,att,head){ globalThis.__dmg.push({amt:+amt.toFixed(1),src:(att&&att.name)||String(att),hp:+b.hp.toFixed(1),st:(new Error().stack||'').split('\\n').slice(1,4).join(' <- ')}); return od(amt,att,head); };
    })()`);
  run(`shells.length=0; torpedoes.length=0`);
  const hits=run(`(()=>{ const out=[]; for(let k=0;k<10&&navalCraft[${id}].alive&&navalCraft[${id}].flood<=1;k++){ navalCraft[${id}].takeDmg(900,null,false); out.push(+navalCraft[${id}].flood.toFixed(3)); } return out; })()`);
  info('flood 逐发='+JSON.stringify(hits)+'  crew 占位 alive='+run(`navalCraft[${id}].crew.alive`)+'  crewBot='+run(`navalCraft[${id}].crewBot?'Bot':'null'`)+'  driverBot==probe: '+run(`navalCraft[${id}].driverBot===__probe`));
  const rows=[];
  for(let f=0;f<900;f++){
    run(`nowT+=1/60; updateNaval(1/60); updateShells(1/60);`);
    if(f%120===0||f===899){
      const s=run(`(()=>{ const b=__probe,c=navalCraft[${id}];
        return {f:${f},alive:!!b.alive,hp:+b.hp.toFixed(1),onV:!!b.onVehicle,crewBot:!!c.crewBot,driverBot:!!c.driverBot,
          y:+b.pos.y.toFixed(2),hd:+headDepthAt(b.pos.x,b.pos.y,b.pos.z).toFixed(2),ws:waterStateAt(b.pos.x,b.pos.y,b.pos.z).state,state:c.state}; })()`);
      rows.push(JSON.stringify(s));
    }
  }
  rows.forEach(r=>info('   '+r));
  const dmg=run(`JSON.stringify(__dmg)`);
  info('Bot.damage 打桩记录: '+dmg);
  info('结论线索: bot.alive='+run(`!!__probe.alive`)+'  crew 占位 alive='+run(`navalCraft[${id}].crew.alive`));
  // ── 对照组: 打开"活战场"(敌方艇 AI 在跑) —— 验证"乘员阵亡"是不是被流弹打死, 而不是沉没链杀的 ──
  const id2=mk('pt',0,0);
  const P2=run(`(()=>{ for(let x=-260;x<=260;x+=4)for(let z=-260;z<=260;z+=4){ const d=waterDepthAt(x,z); if(d>=3.4&&d<=7.0) return {x,z}; } return null; })()`);
  run(`(()=>{ const c=navalCraft[${id2}]; c.pos.set(${P2.x},0,${P2.z}); c.yaw=0; c._prevYaw=0; c.alive=true; c.hp=c.maxHp; c.flood=0.9;
    const b=new Bot(0,0,'对照乘员'); b.spawnInVehicle(c); b.alive=true; b.hp=100; b.pos.set(c.pos.x,c.pos.y||0,c.pos.z);
    c.driverBot=b; globalThis.__p2=b; globalThis.__d2=[];
    const od=b.damage.bind(b);
    b.damage=function(amt,att,head){ globalThis.__d2.push({amt:+amt.toFixed(1),src:(att&&(att.name||att._src))||String(att)}); return od(amt,att,head); };
    // 敌方艇 (真 AI, 会在 900 帧里对它开火): 放在 170m 外的同一条深水带上
    const e=new NavalCraft('gyorai',1,0); e._test=1;
    e.pos.set(${P2.x},0,${P2.z}+170); e.yaw=Math.PI; e._prevYaw=e.yaw; e.alive=true; e.hp=e.maxHp;
    const eb=new Bot(1,0,'敌艇车组'); eb.spawnInVehicle(e); eb.alive=true; eb.hp=100; eb.pos.set(e.pos.x,0,e.pos.z);
    e.driverBot=eb; e.aiDrive=true; globalThis.__enemy=e; globalThis.__ebot=eb;
    })()`);
  run(`navalCraft[${id2}].takeDmg(900,null,false)`);
  run(`for(let f=0;f<900;f++){ nowT+=1/60; updateNaval(1/60); updateShells(1/60); __ebot.update(1/60); }`);
  const c2=run(`(()=>{ const b=__p2,c=navalCraft[${id2}],e=__enemy;
    return {crew_alive:!!b.alive,crew_hp:+b.hp.toFixed(1),dmg_events:JSON.stringify(__d2),craft_state:c.state,
      enemy_alive:!!e.alive,enemy_torps:(typeof torpedoes!=='undefined')?torpedoes.length:0,enemy_vel:+e.vel.toFixed(1)}; })()`);
  info('对照组 (敌方 AI 艇在场 900 帧): '+JSON.stringify(c2));
  // ── 对照组2: **活战场复现** —— 把开局编队全部复活+配 AI (等同 verifier 套件跑到红线5 时的世界状态) ──
  //   这一步是判定归属的关键: 若乘员在这版 harness 里阵亡, 就把凶手钉在"流弹溅射"上而不动我的沉没链。
  const id3=mk('pt',0,0);
  const P3=run(`(()=>{ for(let x=-260;x<=260;x+=4)for(let z=-260;z<=260;z+=4){ const d=waterDepthAt(x,z); if(d>=3.4&&d<=7.0) return {x,z}; } return null; })()`);
  run(`(()=>{ let n=0;
    for(const c of navalCraft){ if(c._test===1) continue;
      const sp=navalMusterSpot(c.team,c.ord); if(!sp) continue;
      c.pos.set(sp.x,sp.y===undefined?0:sp.y,sp.z); c.yaw=sp.face||0; c._prevYaw=c.yaw; c.vel=0;
      c.alive=true; c.hp=c.maxHp; c.flood=0; c.state='run'; c.grp.visible=true; c.engineOn=true;
      const b=new Bot(c.team,0); b.spawnInVehicle(c); b.alive=true; b.hp=100; b.pos.set(c.pos.x,c.pos.y,c.pos.z);
      c.driverBot=b; c.aiDrive=true; n++;
    } return n; })()`);
  const id3s=run(`(()=>{ const c=navalCraft[${id3}]; c.pos.set(${P3.x},0,${P3.z}); c.yaw=0; c._prevYaw=0; c.alive=true; c.hp=c.maxHp; c.flood=0.9; c.state='run';
    const b=new Bot(0,0,'活战场乘员'); b.spawnInVehicle(c); b.alive=true; b.hp=100; b.pos.set(c.pos.x,c.pos.y||0,c.pos.z);
    c.driverBot=b; globalThis.__p3=b; globalThis.__d3=[];
    const od=b.damage.bind(b);
    b.damage=function(amt,att,head){ globalThis.__d3.push({amt:+amt.toFixed(1),src:(att&&(att.name||att._src))||String(att)}); return od(amt,att,head); };
    return navalCraft.length-1; })()`);
  run(`navalCraft[${id3s}].takeDmg(900,null,false)`);
  run(`for(let f=0;f<900;f++){ nowT+=1/60; updateNaval(1/60); updateShells(1/60); }`);
  const c3=run(`(()=>{ const b=__p3,c=navalCraft[${id3s}];
    return {crew_alive:!!b.alive,crew_hp:+b.hp.toFixed(1),craft_state:c.state,nDmg:__d3.length,dmg:JSON.stringify(__d3.slice(0,4)),
      liveCraft:navalCraft.filter(x=>x.alive&&x._test!==1).length,shells:shells.length}; })()`);
  info('对照组2 (活战场 900 帧): '+JSON.stringify(c3));
  info('判定: 若 dmg 非空 ⇒ 乘员是**被流弹/溅射打死**的 (与沉没链无关, 判据需隔离); 若 crew_alive=true ⇒ 沉没链自身零伤害');
}
// ── ⑫ 击杀播报桩地雷回归 (仅 NAVAL_AI_DIAG=3): 证明"补 lastChild"这条真的挡住了 verifier 红线7 那种 ERR ──
if(process.env.NAVAL_AI_DIAG==='3'){
  console.log('\n── ⑫ 击杀播报桩地雷 (NAVAL_AI_DIAG=3) ──');
  const r=run(`(()=>{ try{ const kf=el('killfeed'); for(let i=0;i<9;i++) addKillfeed({name:'A',team:0,_src:'x'},{name:'B',team:1,isPlayer:false},false); return {ok:true,children:kf.children.length,lastChild:!!kf.lastChild}; }catch(e){ return {ok:false,err:String(e&&e.message||e)}; } })()`);
  info('addKillfeed ×9 (超过 6 条会走 kf.lastChild.remove()): '+JSON.stringify(r));
  chk(r.ok===true,'⑫ 击杀播报 9 连发不抛错 (桩已补 lastChild; 修复前此处必抛 "reading \'remove\'")');
}
console.log('\n══════ 合计: '+(checks-failures)+'/'+checks+' 项通过 ══════');
if(notes.length){ console.log('备注:'); notes.forEach(n=>console.log('  - '+n)); }
if(failures) { console.log('失败项: '+failures); process.exitCode=1; }
else console.log('全部通过 ✔');
