// ─────────────────────────────────────────────
// dev/verify-timestopfix.js —— 观战时停修复批沙箱 (2026-09-27M, 不进 index.html)
// 用法: node dev/verify-timestopfix.js
// 原理: 复用 dev/_bootstub.js 的桩 (THREE/DOM/WebAudio), 加载**全部真实脚本**(与 index.html 同序),
//       用真起点 startBtn.onclick 开局 → 观战者部署 (cls=5 + sf_exp=1) → specTimeToggle() 开时停,
//       再直接驱动各**真更新链** (updateShells/updateTracers/updateNades/updateFlak/updateLoiters/
//       updateCasings/updatePlayer/updateHUD/returnToMenu/endMatch)。
// 断言 (T1~T8) —— 每条都带阴性对照 (冻结 ≠ 把东西废掉; 归属判错就红):
//   T1 单源/口径: specTimeShotDt 三分支 —— 非时停一律 dt (零漂移) / 时停玩家⇒真实帧长 / AI·缺 rdt⇒dt;
//   T2 ★ P0-1 冻结点不再"隔空引爆": AI 炮弹冻在半空 3 帧, 0.4m 外的靶兵**零伤害**、炮弹位置与寿命逐位不变;
//      对照 —— 解除时停后同一发炮弹立刻照旧命中 (跳过的只是冻结帧, 不是把炮弹废掉);
//   T3 ★ P0-2/P1-3 观察者打出的弹丸按真实帧长走完全生命周期 (曳光回池 / 炮弹过期 / 弹壳落地 / 高炮弹过期 /
//      手雷落体), 同一帧里 AI 的同类弹丸逐位不动 (tracers·shells·flak·nades·casings 五个系统);
//   T4 ★ P1-3 巡飞弹: 时停里操控中的弹体照飞 (位置/寿命真的在变), 缺真实帧长的直调退化不动;
//      并验 19-input 制导期间 J/K 仍放行 (旧版让位 ⇒ 制导中无法解冻的死局);
//   T5 ★ P1-5 海战音频: 主循环链 (updatePlayer(pdt,dt)) 传下去的第一个实参是**世界帧长** (时停=0);
//      逐艇解析 —— 冻结时非座驾艇的周期声计时完全不动 (静音), 只有观察者开的那条艇照常出声;
//   T6 ★ P1-4 生命周期: 时停中回主菜单 (returnToMenu) 就地解除, 「继续」回来世界真的在走;
//      endMatch 同样复位 (状态残留不带进下一局);
//   T7 ★ P2-6 常驻指示: 顶部栏观战信息行在时停中带 "⏸ 时停中 (K 继续)" 读数, 解除后消失;
//   T8 静态接线: 六个弹丸系统的帧长解析调用点 + 主循环第二实参 + 单源函数体 (一件不缺)。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const {sandbox,document,window,byId}=require('./_bootstub.js');
// ── 桩补丁 (与 verify-aimassist 同源: 几个 Vector3/材质方法 + WebAudio 参数对象) ──
const V3c=sandbox.THREE.Vector3;
if(!V3c.prototype.addScalar) V3c.prototype.addScalar=function(s){ this.x+=s; this.y+=s; this.z+=s; return this; };
if(!V3c.prototype.divideScalar) V3c.prototype.divideScalar=function(s){ s=s||1; this.x/=s; this.y/=s; this.z/=s; return this; };
if(!V3c.prototype.project) V3c.prototype.project=function(){ this.x=0; this.y=0; this.z=1; return this; };
if(!V3c.prototype.cross) V3c.prototype.cross=function(v){ return this.crossVectors(this,v); };
if(!V3c.prototype.negate) V3c.prototype.negate=function(){ this.x=-this.x; this.y=-this.y; this.z=-this.z; return this; };
for(const k of ['MeshLambertMaterial','MeshBasicMaterial','MeshStandardMaterial','MeshPhongMaterial','PointsMaterial','SpriteMaterial']){
const C=sandbox.THREE[k];
if(!C||!C.prototype) continue;
if(!C.prototype.clone) C.prototype.clone=function(){ return new C(Object.assign({},this,{color:this.color})); };
if(!C.prototype.dispose) C.prototype.dispose=function(){};
}
const AP=()=>({value:0,setValueAtTime(){},setTargetAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}});
const O3=sandbox.THREE.Object3D;
if(O3&&O3.prototype&&!O3.prototype.clear) O3.prototype.clear=function(){ if(this.children) this.children.length=0; return this; };
const BA=sandbox.THREE.BufferAttribute;
if(BA&&BA.prototype&&!BA.prototype.setXYZ) BA.prototype.setXYZ=function(i,x,y,z){ if(this.array){ this.array[i*this.itemSize]=x; this.array[i*this.itemSize+1]=y; this.array[i*this.itemSize+2]=z; } return this; };
if(!sandbox.THREE.Line) sandbox.THREE.Line=class extends O3{constructor(g,m){super();this.geometry=g||{};this.material=m||{};this.isLine=true;}};
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
// 真键位链 (19-input 用全局 addEventListener('keydown')): 收集表按 boot 清空, __key 派发同形事件
const handlers={};
sandbox.addEventListener=(t,f)=>{ (handlers[t]=handlers[t]||[]).push(f); };
sandbox.removeEventListener=()=>{};
// 桩忠实化 (T7 要跑 updateHUD): 真 DOM 的 CSSStyleDeclaration 有 setProperty, 而共享桩的 style 只是 `{}`
// ⇒ 22-hud 的 hudStyle 一碰到自定义属性 (--gap 之类) 就抛 "st.setProperty is not a function"。
// 这是**桩不忠实**、不是被测代码的问题 (与 _bootstub 里 setMatrixAt / lastChild 那几处同规): 就地补一个
// 写进字段的 setProperty, 并挂在 getElementById/createElement/querySelector 三个入口上 (元素是懒建的)。
const patchStyle=(el)=>{ if(el&&el.style&&typeof el.style.setProperty!=='function')
el.style.setProperty=function(k,v){ this[k]=v; }; return el; };
{
const g=document.getElementById.bind(document), c=document.createElement.bind(document), q=document.querySelector.bind(document);
document.getElementById=(id)=>patchStyle(g(id));
document.createElement=(t)=>patchStyle(c(t));
document.querySelector=(s)=>patchStyle(q(s));
}
// ── 全链文件表 (与 index.html 同序; 含 15c/15d/15e/15f 与 22b) ──
const FILES=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/22a-menuart.js','js/22b-speclayer.js','js/23-deploy.js','js/23b-worldrestore.js','js/24-main.js'];
function load(ctx,file){ vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file}); }
// 沙箱内小工具 (顶层 var: 桩的 globalThis 指向共享 sandbox, 写 globalThis.x 会落到别的 context 上)
const PRELUDE=`var __TSF=(function(){
function flatSpot(){
const lim=MAP_SIZE/2-20;
for(let i=0;i<4000;i++){
const x=(Math.random()*2-1)*lim, z=(Math.random()*2-1)*lim;
if(occBlocked(x,z)) continue;
let ok=true;
for(let d=-6;d<=6;d+=2){ if(Math.abs(heightAt(x+d,z)-heightAt(x,z))>1.0||Math.abs(heightAt(x,z+d)-heightAt(x,z))>1.0){ ok=false; break; } }
if(ok) return {x,z,y:heightAt(x,z)};
}
return {x:0,z:0,y:heightAt(0,0)};
}
function mkBot(team,x,z,name){
const b=new Bot(team,0,name||'靶'); b.alive=true; b.pos.set(x,heightAt(x,z),z); b.vel.set(0,0,0);
b.onVehicle=null; b.spectator=false; b.hp=100000; b.maxHp=100000;
return b;
}
function clearTroops(){ for(const s of soldiers) s.alive=false; soldiers.length=0; combatants.length=0; }
function ai(team){ return {team:team===undefined?0:team,isPlayer:false,alive:true,pos:V3(0,0,0),kills:0,deaths:0,score:0}; }  // 非玩家的射手/归属占位 (只读 .team/.isPlayer/.alive/.pos)
function mkShell(owner,pos,vel,life){
const s={pos:pos.clone(),vel:vel.clone(),team:(owner&&owner.team!==undefined)?owner.team:0,owner:owner,
life:life===undefined?3.6:life,kind:'tank',dmgV:400,trail:9};
shells.push(s); return s;
}
function bit(a,b){ return a.x===b.x&&a.y===b.y&&a.z===b.z; }
return {flatSpot,mkBot,clearTroops,ai,mkShell,bit};
})();`;
function boot(){
for(const k in byId) delete byId[k];
for(const k in handlers) delete handlers[k];
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document; ctx.window=window;
ctx.localStorage={_s:{sf_campaign:'0',sf_exp:'1'},getItem(k){return (k in this._s)?this._s[k]:null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
ctx.CANNON=(window&&window.CANNON)||{Body:class{constructor(o){Object.assign(this,o||{});}},World:class{add(){}},Box:class{},Sphere:class{},Vec3:V3c,Material:class{},ContactMaterial:class{}};
for(const f of FILES) load(ctx,f);
vm.runInContext(PRELUDE,ctx,{filename:'prelude'});
ctx.__key=(code)=>{ for(const f of (handlers.keydown||[])) f({code,repeat:false,preventDefault(){},stopPropagation(){}}); };
try{ vm.runInContext(`document.getElementById('startBtn').onclick();`,ctx); }catch(e){ console.log('  开局异常: '+e); }
return ctx;
}
const VM=(ctx,expr)=>vm.runInContext(expr,ctx);
const SRC={};
function read(rel){ if(!(rel in SRC)) SRC[rel]=fs.readFileSync(path.join(root,rel),'utf8'); return SRC[rel]; }
let PASS=0,FAILS=0;
function ok(cond,label){ if(cond){ PASS++; console.log('  ✔ '+label); } else { FAILS++; console.log('  ✘ '+label); } }
function exc(tag,e){ ok(false,tag+' 推演异常: '+String(e&&e.stack||e)); }
function note(s){ console.log('  · '+s); }

console.log('══ 观战时停修复批 (dev/verify-timestopfix.js) ══');
const ctx=boot();
// 观战者部署 (与 _timestop-audit 同路径): cls=5 + 实验模式 ⇒ 可开观战; specTimeToggle 需 alive+未结算+未暂停
const SPEC_DEPLOY=`(()=>{try{
player.team=0; player.cls=3; player.spectator=true; player.specUsed=true; selectedSpawn=-1; deployPlayer();
return {alive:player.alive,spec:player.spectator,isPlayer:player.isPlayer,paused:SPEC_TIME.paused};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`;
const dep=VM(ctx,SPEC_DEPLOY);
if(typeof dep==='string'){ console.log('  ✘ 观战者部署失败: '+dep); process.exit(1); }
ok(dep.alive===true&&dep.spec===true&&dep.isPlayer===true&&dep.paused===false,
'前置: 观战者已部署 (isPlayer=true, 时停默认关 —— 归属判据 shoot∈player 与全库射手字段同源)');

// ═════ T1 单源/口径 ═════
console.log('T1 单源: specTimeShotDt (非时停 ⇒ 一律世界帧长 / 时停 ⇒ 只有玩家自己打出的走真实帧长)');
{
const r=VM(ctx,`(()=>{try{
// ① 非时停: 不分成谁打的, 一律 dt (= 旧行为, 零漂移)
const a=specTimeShotDt({isPlayer:true},0.05,0.011), b=specTimeShotDt({isPlayer:false},0.05,0.011), c=specTimeShotDt(null,undefined,0.011);
// ② 时停
specTimeToggle();
const frozen=specTimeFrozen();
const d=specTimeShotDt({isPlayer:true},0.05,0), e=specTimeShotDt({isPlayer:false},0.05,0), f=specTimeShotDt(player,0.05,0), g=specTimeShotDt(null,0.05,0);
const h=specTimeShotDt({isPlayer:true},undefined,0);   // 缺真实帧长 ⇒ 退化 (冻结), 不返回 undefined
return {a,b,c,frozen,d,e,f,g,h};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof r==='string'){ exc('T1',r); } else {
ok(r.a===0.011&&r.b===0.011&&r.c===0.011,'T1 非时停: 玩家/AI/缺参一律返回世界帧长 (普通战斗逐位不变的机制侧证明)');
ok(r.frozen===true,'T1 前置: 时停已开 (specTimeFrozen=true, 世界帧长 0)');
ok(r.d===0.05&&r.f===0.05&&r.e===0&&r.g===0&&r.h===0,
'T1 ★ 时停: 玩家 (含本体 player) ⇒ 真实帧长; AI/无主/缺真实帧长 ⇒ 世界帧长 0 (不是 undefined)');
}
}

// ═════ T2 P0-1: 冻结点不再"隔空引爆" ═════
console.log('T2 ★ P0-1 冻结点命中判定: 静止的炮弹不再以 0.5m 前瞻重跑命中判定');
{
const r=VM(ctx,`(()=>{try{
const sp=__TSF.flatSpot();
__TSF.clearTroops();
const b=__TSF.mkBot(1,sp.x,sp.z,'靶');
const sh=__TSF.mkShell(__TSF.ai(0),V3(sp.x,sp.y+1.2,sp.z-0.4),V3(0,0,190),3.6);  // 弹道朝靶兵, 相距 0.4m
const p0=sh.pos.clone(), life0=sh.life, hp0=b.hp;
const frozenFrames=[];
for(let f=0;f<3;f++){
updateShells(specTimeConsume(1/60),specTimePlayerDt(1/60,specTimeConsume(1/60)));   // 与主循环同参: (0, 真实帧长)
frozenFrames.push(b.hp);
}
const frozen={hp:b.hp,moved:!__TSF.bit(sh.pos,p0),life:sh.life,inTable:shells.indexOf(sh)>=0,vel:sh.vel.z};
// 解除时停: 同一发炮弹在**正常世界**里照旧命中 (证明跳过的只是冻结帧)
specTimeReset();
updateShells(1/60,1/60);
const after={hp:b.hp,inTable:shells.indexOf(sh)>=0,moved:!__TSF.bit(sh.pos,p0)};
specTimeToggle();   // 复原: 时停重新打开 (后续用例都在时停态下跑)
return {hp0,frozen,after,life0:frozen.life,lv0:life0,dHp:frozen.hp-hp0,dHpAfter:after.hp-frozen.hp,z:+sh.pos.z.toFixed(3)};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof r==='string'){ exc('T2',r); } else {
note('冻结 3 帧 (dt=0, 真实帧长 0.0167): 靶兵 hp '+r.hp0+' → '+(r.hp0+r.dHp)+'; 炮弹位移='+r.frozen.moved+', 在表='+r.frozen.inTable+', life='+r.life0);
note('解除时停后 1 帧 (dt=1/60): 靶兵再掉 '+(-r.dHpAfter)+' 血, 炮弹出表='+(r.after.inTable===false));
ok(r.dHp===0,'T2 ★ 冻结期间零伤害: 一发**不动**的炮弹不再把 0.4m 外的活人引爆 (旧版每帧 0.5m 前瞻 ⇒ 实测掉 404 血)');
ok(r.frozen.moved===false&&r.frozen.inTable===true&&r.life0===3.6&&r.frozen.vel===190,
'T2 ★ 冻结期间整发不动: 位置逐位不变 / life 不减 / 速度不被重力改 (不是"动了但没判")');
ok(r.after.inTable===false&&r.dHpAfter<0,'T2 ★ 阴性对照: 解除时停后同一发炮弹立刻照旧命中并出表 (跳过的只是冻结帧, 不是把炮弹废掉)');
}
}

// ═════ T3 P0-2/P1-3: 观察者的弹丸走完全生命周期, AI 的逐位不动 ═════
console.log('T3 ★ P0-2/P1-3 五个弹丸系统: 玩家自己打出的照飞照回收, AI 的随战场冻住');
{
const r=VM(ctx,`(()=>{try{
const ai=__TSF.ai(0);
const o=V3(0,40,0), dirf=V3(0,0,-1);
// ① 曳光: 20 条玩家的 + 20 条 AI 的
const tp0=tracerPool.length, tr0=tracers.length;
for(let i=0;i<20;i++) spawnTracer(o,dirf,60,player);
for(let i=0;i<20;i++) spawnTracer(o,dirf,60,ai);
const aiTr=tracers[tr0+20];
const aiTrP={x:aiTr.m.position.x,y:aiTr.m.position.y,z:aiTr.m.position.z};
for(let f=0;f<60;f++) updateTracers(0,1/60);
const trAfter=tracers.length, tpAfter=tracerPool.length;
const aiTrStill=tracers.indexOf(aiTr)>=0;
const aiTrPos={x:aiTr.m.position.x,y:aiTr.m.position.y,z:aiTr.m.position.z};
// ③ 弹壳 (只有玩家一个来源): 冻结下照常抛壳 → 上抛 → 落体 (40 帧 0.667s 已过顶点, 净高度低于起点)
const cs0=casings.length;
spawnCasing(V3(0,60,0),V3(1,0,0),V3(0,1,0));
const cas=casings[casings.length-1];
const cy0=cas.m.position.y;
for(let f=0;f<40;f++) updateCasings(0,1/60);
const cy1=cas.m.position.y, cLife=cas.life, cyAt=cas.m.position.y;
for(let f=0;f<10;f++) updateCasings(0);            // 缺真实帧长 ⇒ 退化不动
const cyBad=cas.m.position.y;
// ③ 高炮弹: 玩家的 + AI 的
const f0=flakShots.length;
fireFlak({x:0,y:60,z:0},player,dirf);
fireFlak({x:20,y:60,z:0},ai,dirf);
const fl0=flakShots[f0].pos.z, al0=flakShots[f0+1].pos.z;
for(let f=0;f<10;f++) updateFlak(0,1/60);
const flMoved=flakShots[f0].pos.z!==fl0, alMoved=flakShots[f0+1].pos.z!==al0;
const flLife=flakShots[f0].life;
// ④ 手雷: 玩家的 + AI 的 (fuse 不衰减 = 冻结期间不会"停着炸"); 用长引信避免真爆炸的连带开销
const n0=nades.length;
nades.push({m:new THREE.Mesh(),pos:V3(0,60,0),vel:V3(0,0,0),fuse:9,thrower:player,team:0,spin:V3(1,0,0.5),bounces:0,at:true});
nades.push({m:new THREE.Mesh(),pos:V3(20,60,0),vel:V3(0,0,0),fuse:9,thrower:ai,team:0,spin:V3(1,0,0.5),bounces:0,at:true});
for(let f=0;f<10;f++) updateNades(0,1/60);
const pFuse=nades[n0].fuse, aFuse=nades[n0+1].fuse, pNadeY=nades[n0].pos.y, aNadeY=nades[n0+1].pos.y;
// ⑤ 炮弹: 双方各一发 (life 0.5s), 冻结下只有玩家的会过期
const s0=shells.length;
const pSh=__TSF.mkShell(player,V3(0,400,0),V3(0,0,190),0.5);
const aSh=__TSF.mkShell(ai,V3(40,400,0),V3(0,0,190),0.5);
const aPos0=aSh.pos.clone();
for(let f=0;f<40;f++) updateShells(0,1/60);
const pOut=shells.indexOf(pSh)<0, aIn=shells.indexOf(aSh)>=0, aSame=__TSF.bit(aSh.pos,aPos0)&&aSh.life===0.5;
return {tp0,tpAfter,tr0,trAfter,aiTrStill,aiTrSame:aiTrPos.x===aiTrP.x&&aiTrPos.y===aiTrP.y&&aiTrPos.z===aiTrP.z,
cs0,cy0,cy1,cLife,cyAt,cyBad,flMoved,alMoved,flLife,pFuse,aFuse,pNadeY,aNadeY,pOut,aIn,aSame,
n0,nCount:nades.length};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof r==='string'){ exc('T3',r); } else {
note('曳光 60 帧: 表 '+r.tr0+' → '+r.trAfter+' (玩家的 20 条全部按 traveled>=max 回池 ⇒ 池 '+r.tp0+' → '+r.tpAfter+'); AI 的 20 条仍在表且位置逐位不变='+r.aiTrSame);
note('弹壳 40 帧: y '+r.cy0.toFixed(2)+' → '+r.cy1.toFixed(2)+' (先上抛后落体; life '+r.cLife.toFixed(3)+'s, 缺真实帧长时停在 '+r.cyBad.toFixed(2)+'); 高炮弹: 玩家的动='+r.flMoved+'/AI 的动='+r.alMoved+' (玩家的 life '+r.flLife.toFixed(2)+')');
note('手雷 10 帧: 玩家的 fuse '+r.pFuse.toFixed(3)+' (y '+r.pNadeY.toFixed(2)+') / AI 的 fuse '+r.aFuse.toFixed(3)+' (y '+r.aNadeY.toFixed(2)+')');
note('炮弹 40 帧 (0.667s, life 0.5): 玩家的出表='+r.pOut+'; AI 的仍在表='+r.aIn+' 且位置/寿命逐位不变='+r.aSame);
ok(r.trAfter===r.tr0+20&&r.tpAfter===r.tp0+20&&r.aiTrStill&&r.aiTrSame,
'T3 ★ 曳光: 玩家 20 条全部回收进池 (旧版 340*0=0 ⇒ 永不回收, 每条新弹 new 一个 Mesh), AI 20 条原地冻住');
ok(r.cy1<r.cy0&&r.cyBad===r.cy1,'T3 ★ 弹壳 (全部属玩家): 时停下照常抛壳→落体 (否则冻在半空 = "打出的东西冻在枪口"); 缺真实帧长时退化为停住');
ok(r.flMoved===true&&r.alMoved===false&&r.flLife<2.05,'T3 ★ 高炮弹: 玩家打出的在飞 (life 递减), AI 的逐位不动');
ok(r.pFuse<9&&r.aFuse===9&&r.pNadeY<60&&r.aNadeY===60,'T3 ★ 手雷/迫击炮弹: 玩家的照落 (引信在走), AI 的连引信都不动 (不会"停着炸")');
ok(r.pOut===true&&r.aIn===true&&r.aSame===true,'T3 ★ 炮弹: 玩家的按 life 正常过期 (不再常驻), AI 的整发冻结 (位置/life 逐位不变)');
ok(r.nCount===r.n0+2-0,'T3 收尾: 场景里没有多出未清账的弹丸表项 (nades '+r.n0+' → '+r.nCount+')');
}
}

// ═════ T4 P1-3: 巡飞弹制导 + 19-input 的 J/K 放行 ═════
console.log('T4 ★ P1-3 巡飞弹: 时停里操控中的弹体照飞 (旧版弹不动 = 观察者被定住)');
{
const r=VM(ctx,`(()=>{try{
const sp=__TSF.flatSpot();
player.pos.set(sp.x,sp.y,sp.z); player.yaw=0; player.pitch=0;
const d=fireLoiter(player,V3(sp.x,sp.y+1.6,sp.z),V3(0,0,-1));
if(!d) return 'EXC: fireLoiter 返回空';
const p0=d.pos.clone(), t0=d.t, life0=d.life;
for(let f=0;f<30;f++) updateLoiters(0,1/60);
const moved=+d.pos.distanceTo(p0).toFixed(3), dt30=+(d.t-t0).toFixed(4), dl=+(life0-d.life).toFixed(4);
const p1=d.pos.clone();
for(let f=0;f<10;f++) updateLoiters(0);           // 缺真实帧长 ⇒ 整枚停住 (退化分支)
const movedByBad=+d.pos.distanceTo(p1).toFixed(6);
// 制导期间 J/K 仍放行 (旧版 !player.loiter 让位 ⇒ 制导中无法解冻)
const k0=SPEC_TIME.paused;
__key('KeyK');
const kAfter=SPEC_TIME.paused;
__key('KeyK');                                    // 复原
loiterDespawn(d);
return {moved,dt30,dl,movedByBad,k0,kAfter,left:!!player.loiter,dead:d.dead,gone:scene.children.indexOf(d.mesh)<0};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof r==='string'){ exc('T4',r); } else {
note('30 帧 (0.5s, 真实帧长): 弹体前进 '+r.moved+'m, d.t +'+r.dt30+'s, life -'+r.dl+'s; 缺真实帧长时位移 '+r.movedByBad+'m');
note('制导中派发 KeyK: paused '+r.k0+' → '+r.kAfter+' (再按一次复原); 弃弹后 player.loiter='+r.left+', 已出场景='+r.gone);
ok(r.moved>3&&r.dt30>0.49&&r.dl>0.49,'T4 ★ 时停里操控中的巡飞弹照飞 (0.5s 前进 '+r.moved+'m; 旧版 step=spd*0 ⇒ 定住不动)');
ok(r.movedByBad===0,'T4 退化分支: 调用方没给真实帧长时整枚停住 (不会拿 dt=0 硬飞)');
ok(r.k0===true&&r.kAfter===false&&r.left===false&&r.gone===true,
'T4 ★ 制导期间 J/K 仍放行 (KeyK 真的解除了时停 —— 旧版让位 ⇒ 弹体冻住 + 不能解冻的死局), 弃弹已收尾');
}
}

// ═════ T5 P1-5: 海战音频逐艇取帧长 ═════
console.log('T5 ★ P1-5 海战音频: 世界帧长传下去 + 逐艇解析 (冻结的非座驾艇彻底静音)');
{
const r=VM(ctx,`(()=>{try{
const dt=specTimeConsume(1/60), pdt=specTimePlayerDt(1/60,dt);
// ① 主循环链: updatePlayer(pdt,dt) 传下去的第一个实参必须是**世界**帧长
let seen=null; const orig=AudioSys.navalAudioTick;
AudioSys.navalAudioTick=function(a,b){ seen=[a,b]; };
updatePlayer(pdt,dt);
AudioSys.navalAudioTick=orig;
// ② 逐艇解析: 合成两条艇 (A = 我在开, B = 别人的), 都摆在相机附近 (可听范围内)
const cam=camera.position;
const mk=(x,z,driven)=>({pos:V3(cam.x+x,cam.y,z+cam.z),state:'run',alive:true,floating:true,kind:'boat',
vel:6,playerDriven:driven,spec:{key:'t',spd:12},
engine:null});
const A=mk(0,14,true), B=mk(6,14,false);
navalCraft.push(A,B);
player.onNaval=A;
const dbg=()=>{ const o=AudioSys.navalAudioDebug().crafts; return {a:o[o.length-2],b:o[o.length-1]}; };
const d0=dbg();
AudioSys.navalAudioTick(0,pdt);              // 冻结帧: A 跟本体同速, B 静音
const d1=dbg();
AudioSys.navalAudioTick(0,pdt);
const d2=dbg();
const aT0=d0.a.wetT, aT1=d1.a.wetT, aT2=d2.a.wetT;      // A: 0 → rand → 递减
const bNull=d1.b.wetT===null&&d2.b.wetT===null;          // B: 从未被本函数碰过 (连记账表都没有)
player.onNaval=null;
AudioSys.navalAudioTick(0,pdt);              // 连 A 也不是座驾了 ⇒ 整片海面静音
const d3=dbg();
const aNoRide=d3.a.wetT===aT2;
AudioSys.navalAudioTick(1/60,pdt);           // 世界在走: 两条艇都在管
const d4=dbg();
const bAlive=d4.b.wetT!==null;
// 收尾: 摘掉合成艇, 复原座位字段
navalCraft.length-=2;
return {dt,pdt,seen,bNull,aT0,aT1,aT2,aNoRide,bAlive,movedA:aT1!==aT0&&aT2!==aT1};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof r==='string'){ exc('T5',r); } else {
note('主循环链 updatePlayer(pdt,dt) 传给音频的实参 = ['+JSON.stringify(r.seen)+'] (同帧世界帧长 '+r.dt+' / 本体链 '+r.pdt.toFixed(4)+')');
note('逐艇: 座驾艇的 wetT '+r.aT0+' → '+r.aT1+' → '+r.aT2+' (改骑乘后 '+r.aNoRide+' 保持不变); 非座驾艇读数始终 null='+r.bNull+' (冻结期从未进过本函数)');
ok(r.dt===0&&r.seen&&r.seen[0]===0&&r.seen[1]>0,
'T5 ★ 海战音频收到的是**世界**帧长 (时停 = 0; 旧版直接把 pdt 喂进去 ⇒ 整片海面静止而所有艇照响)');
ok(r.movedA===true,'T5 ★ 观察者开的那条艇照常出声 (周期声计时按本体链帧长走)');
ok(r.bNull===true&&r.aNoRide===true,'T5 ★ 其余艇世界冻结 ⇒ 本帧完全跳过 (破水/履带计时一动不动 = 静音)');
ok(r.bAlive===true,'T5 阴性对照: 世界恢复后同一条艇立刻回到管 (不是被摘出记账表)');
}
}

// ═════ T7 P2-6: 常驻时停指示 (先跑: T6 会把时停关掉) ═════
console.log('T7 ★ P2-6 常驻时停指示: #specTimeInd 逐帧对账 (冻结帧 dt=0 也要亮)');
{
const r=VM(ctx,`(()=>{try{
const ind=()=>document.getElementById('specTimeInd').style.display;
specTimeReset();
updateHUD(0);                                       // 冻结帧也不许漏: 读数不能挂 10Hz 那段 (那段走 dt)
const off=ind();
specTimeToggle();
updateHUD(specTimeConsume(1/60));                   // 时停帧: 世界帧长 0
const on=ind();
updateHUD(0);
const on2=ind();
specTimeReset();
updateHUD(1/60);
const off2=ind();
// 顶部栏 10Hz 段不承接本读数 (它在逐帧段); 该段 2026-11-08 起节流钟吃观察者帧长 (时停中小地图/罗盘随人重绘, 见 verify-timestophud-20261108), 兵力/旗点等世界数据冻结时值本就不变
return {off,on,on2,off2,text:document.getElementById('specTimeInd').textContent,hasEl:!!document.getElementById('specTimeInd')};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof r==='string'){ exc('T7',r); } else {
note('#specTimeInd 的 display: 时停关 → "'+r.off+'" / 时停开 → "'+r.on+'" (再一帧 dt=0 → "'+r.on2+'") / 再关 → "'+r.off2+'"; 文案 "'+r.text+'"');
ok(r.on==='block'&&r.on2==='block'&&r.off==='none'&&r.off2==='none',
'T7 ★ 时停中有常驻读数且**冻结帧也照常对账** (旧版只有一次 showScorePop, 之后没有任何"我现在停着"的确定读数; 挂 10Hz 段会因 dt=0 永不重绘)');
ok(r.hasEl===true,'T7 读数元素存在 (#specTimeInd; 文案是 index.html 的裸 data-i18n 静态节点, 由 applyI18n 盖章 ⇒ 沙箱桩里读不到, 静态齐备性见 T8)');
}
}

// ═════ T6 P1-4: 回主菜单/结算复位 ═════
console.log('T6 ★ P1-4 生命周期: 时停随"回主菜单 → 继续"与结算收尾 (旧版跨菜单残留)');
{
const r=VM(ctx,`(()=>{try{
specTimeToggle();                                  // 开时停
const before={paused:SPEC_TIME.paused,frozen:specTimeFrozen()};
returnToMenu();                                    // 战局未结束 ⇒ menuHold (战场原地挂着)
const inMenu={paused:SPEC_TIME.paused,menuHold};
resumeBattle();                                    // 「继 续 游 戏」
const after={paused:SPEC_TIME.paused,frozen:specTimeFrozen(),wdt:specTimeConsume(1/60)};
specTimeToggle();                                  // 再开一次, 验结算路径
const beforeEnd=SPEC_TIME.paused;
endMatch(-1);
const end={paused:SPEC_TIME.paused,frozen:specTimeFrozen()};
return {before,inMenu,after,beforeEnd,end,matchOver};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof r==='string'){ exc('T6',r); } else {
note('开时停 → returnToMenu: paused '+r.before.paused+' → '+r.inMenu.paused+' (menuHold='+r.inMenu.menuHold+'); resumeBattle 后 frozen='+r.after.frozen+', 世界帧长='+r.after.wdt);
note('结算前再开一次 (paused='+r.beforeEnd+') → endMatch(-1): paused='+r.end.paused+', frozen='+r.end.frozen+', matchOver='+r.matchOver);
ok(r.before.paused===true&&r.inMenu.paused===false,'T6 ★ 回主菜单就地解除时停 (旧版: 回来时 paused=true, 战场静止而玩家已忘了按过 K)');
ok(r.after.frozen===false&&r.after.wdt>0,'T6 ★ 「继 续 游 戏」回来世界真的在走 (specTimeConsume 不再是 0)');
ok(r.beforeEnd===true&&r.end.paused===false&&r.end.frozen===false,'T6 ★ 结算 (endMatch) 同样复位: 状态残留不带进下一局');
}
}

// ═════ T8 静态接线 ═════
console.log('T8 静态接线: 六个弹丸系统 + 主循环 + 单源');
{
const main=read('js/24-main.js'), veh=read('js/15-vehicles.js'), air=read('js/16-aircraft.js'),
combat=read('js/13-combat.js'), eff=read('js/08-effects.js'), aud=read('js/01-audio.js'),
pl=read('js/20-player.js'), sp2=read('js/22b-speclayer.js'), inp=read('js/19-input.js'),
hud=read('js/22-hud.js'), m21=read('js/21-match.js'), i18n=read('js/00b-i18n.js');
const need=[['specTimeShotDt',sp2],['function specTimeShotDt(owner,rdt,dt)',sp2]];
ok(need.every(([s,f])=>f.indexOf(s)>=0),'T8 单源在 22b (specTimeShotDt(owner,rdt,dt)) + 归属判据是 owner.isPlayer');
ok(main.indexOf('updateShells(dt,rdt)')>=0&&main.indexOf('updateFlak(dt,rdt)')>=0&&main.indexOf('updateNades(dt,rdt)')>=0&&
main.indexOf('updateLoiters(dt,rdt)')>=0&&main.indexOf('updateTracers(dt,rdt)')>=0&&main.indexOf('updateCasings(dt,rdt)')>=0&&
main.indexOf('updatePlayer(pdt,dt)')>=0,
'T8 24-main: 六个弹丸系统 + updatePlayer 都拿到真实帧长 (粒子的 updateParticles(dt) 保持世界帧长)');
ok(veh.indexOf('function updateShells(dt,rdt)')>=0&&veh.indexOf('SD(s.owner,rdt,dt)')>=0&&
air.indexOf('function updateFlak(dt,rdt)')>=0&&air.indexOf('FD(f.owner,rdt,dt)')>=0,
'T8 15-vehicles/16-aircraft: 逐发帧长 + 冻结整发跳过 (命中判定/拖尾/入水一并不跑)');
ok(combat.indexOf('function updateNades(dt,rdt)')>=0&&combat.indexOf('ND(n.thrower,rdt,dt)')>=0&&
combat.indexOf('function updateLoiters(dt,rdt)')>=0&&combat.indexOf('specTimeShotDt(d.owner,rdt,dt)')>=0&&
combat.indexOf('spawnTracer(origin.clone().addScaledVector(dir,1.2),dir,Math.max(1,endD-1.5),shooter)')>=0,
'T8 13-combat: 手雷按 thrower / 巡飞弹按 owner / 曳光把 shooter 一路带到 08-effects (归属不从运行时猜)');
ok(eff.indexOf('function spawnTracer(o,dir,dist,owner)')>=0&&eff.indexOf('owner:owner||null')>=0&&
eff.indexOf('function updateTracers(dt,rdt)')>=0&&eff.indexOf('SD(t.owner,rdt,dt)')>=0&&
eff.indexOf('function updateCasings(dt,rdt)')>=0&&eff.indexOf('specTimePlayerDt(rdt,dt)')>=0,
'T8 08-effects: 曳光记住归属 / 弹壳整条链归玩家 (三处调用点全是玩家视角武器)');
ok(aud.indexOf('function navalAudioTick(dt,ownDt)')>=0&&aud.indexOf('specTimeRideDt(c,ownDt,dt)')>=0&&
aud.indexOf("if(typeof dt!=='number') dt=1/60;")>=0&&aud.indexOf("if(!(cdt>0)) continue;")>=0,
'T8 01-audio: 海战音频逐艇取帧长 + dt=0 不再被 "补 1/60" 的兜底换掉 (旧兜底正是"照响"的第二个来源)');
ok(pl.indexOf('function updatePlayer(dt,wdt)')>=0&&pl.indexOf('navalAudioTick(wdt,dt)')>=0,
'T8 20-player: updatePlayer 收世界帧长并把它交给海战音频 (本体链帧长仍作第二实参)');
// 观战工具键那一小段**内部**不许再有 loiter 让位门 (别的分支上的 !player.loiter 是正当的, 不在此断言)
const toolBlock=(()=>{ const i=inp.indexOf('观战工具键'); const j=inp.indexOf('if(!player.alive||!pointerLocked) return;',i); return i<0||j<0?'':inp.slice(i,j); })();
ok(toolBlock.indexOf('KeyJ')>=0&&toolBlock.indexOf('KeyK')>=0&&toolBlock.indexOf('player.loiter')<0,
'T8 ★ 19-input: 观战工具键那一小段不再对制导中的玩家让位 (只剩"观战者+活着"这一条门; 动态链见 T4 KeyK)');
ok(hud.indexOf("hudShow('specTimeInd'")>=0&&hud.indexOf('specTimeFrozen()')>=0&&hud.indexOf("if(typeof specTimeReset==='function') specTimeReset();")>=0&&
m21.indexOf("if(typeof specTimeReset==='function') specTimeReset();")>=0,
'T8 22-hud/21-match: 读数逐帧对账 (#specTimeInd, 不在 10Hz 段内) + 回主菜单/结算两处复位 (读数与复位同一个单源函数)');
ok(read('index.html').indexOf('id="specTimeInd"')>=0&&read('css/style.css').indexOf('#specTimeInd')>=0&&
i18n.indexOf("'⏸ 时停中 · K 继续':'⏸ Time stopped · K to resume'")>=0&&
sp2.indexOf('打出的弹丸也照飞')>=0,
'T8 元素/CSS/i18n/文案: #specTimeInd 齐备 (裸 data-i18n 取键) + 新增词条 + "弹丸照飞"口径 (词典中文原文即键)');
}

console.log('\n结果: '+PASS+' 通过 / '+FAILS+' 失败');
process.exit(FAILS?1:0);
