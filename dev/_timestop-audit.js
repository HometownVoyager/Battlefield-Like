// ─────────────────────────────────────────────
// dev/_timestop-audit.js —— 观战时停子系统审计 (2026-09-27; 2026-09-27M 修复批**改判**)
// 用法: node dev/_timestop-audit.js
// 性质: **取证工具** —— 它断言的是"当前实测行为", 不是"期望行为"。列出的四条缺陷在 2026-09-27M
//   修复批里全部落地 (P0-2/P1-3 弹丸归属帧长、P0-1 冻结帧命中判定、P1-4 生命周期、P1-5 海战音频),
//   于是本文件按自己的老规矩**改判成修复后的期望值**, 修复前实测到的数值留在各条 note 里作对照
//   (验收判据在 dev/verify-timestopfix.js; 本文件只负责"同一套样例现在读多少")。
// 目的: 把"时停 = 往 20+ 个 update 注入 dt=0"这一范式下的行为**量出来** (不是读代码猜):
//   P1 定点发射器在 dt=0 下的真实行为 (原假设"每帧一发" —— 实测**否**: 节拍器一旦回填成正值就被冻住);
//   P2 寿命类对象的回收: tracers 靠 traveled(340*dt) / shells·nades 靠 life-=dt ⇒ dt=0 全不回收 ——
//      修复后**玩家自己打出的**按真实帧长照常回收 (旧版: 120 次开火 ⇒ tracers 0→120 线性无上限);
//   P3 时停里照常开火 (本体链走真实帧长 —— 这是"不冻观察者"的裁定, 保留); 但**判定**只在有帧长时跑 ⇒
//      冻在半空的炮弹不再把 0.4m 外的活人隔空引爆 (旧版: 3 帧 404 血);
//   P4 生命周期与音频: 时停随回主菜单复位 (旧版残留 ⇒ 回来时战场仍静止) + 海战音频收世界帧长
//      (旧版收 pdt ⇒ 整片海面静止而所有艇照响)。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const {sandbox,document,window}=require('./_bootstub.js');
const V3c=sandbox.THREE.Vector3;
if(!V3c.prototype.addScalar) V3c.prototype.addScalar=function(s){ this.x+=s; this.y+=s; this.z+=s; return this; };
if(!V3c.prototype.divideScalar) V3c.prototype.divideScalar=function(s){ s=s||1; this.x/=s; this.y/=s; this.z/=s; return this; };
if(!V3c.prototype.project) V3c.prototype.project=function(){ this.x=0; this.y=0; this.z=1; return this; };
const O3=sandbox.THREE.Object3D;
if(O3&&O3.prototype&&!O3.prototype.clear) O3.prototype.clear=function(){ if(this.children) this.children.length=0; return this; };
const BA=sandbox.THREE.BufferAttribute;
if(BA&&BA.prototype&&!BA.prototype.setXYZ) BA.prototype.setXYZ=function(i,x,y,z){ if(this.array){ this.array[i*this.itemSize]=x; this.array[i*this.itemSize+1]=y; this.array[i*this.itemSize+2]=z; } return this; };
if(!sandbox.THREE.Line) sandbox.THREE.Line=class extends O3{constructor(g,m){super();this.geometry=g||{};this.material=m||{};this.isLine=true;}};
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
// 死亡链会走 12-ragdolls 的 CANNON 初始化: 桩里 window.CANNON 有, 全局没有 ⇒ 这里补到全局 (探针不测布娃娃)
const FILES=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/22a-menuart.js','js/22b-speclayer.js','js/23-deploy.js','js/23b-worldrestore.js','js/24-main.js'];
const PRELUDE=`var __TS=(function(){
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
return {flatSpot};
})();`;
function load(ctx,file){ vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file}); }
function boot(){
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document; ctx.window=window;
ctx.localStorage={_s:{sf_campaign:'0',sf_exp:'1'},getItem(k){return (k in this._s)?this._s[k]:null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
// 死亡链会走 12-ragdolls 的 CANNON 初始化 (桩里只有 window.CANNON) —— 补到全局, 免得"命中即死"的用例
// 因布娃娃初始化抛错而误判成"伤害结算失败"。
ctx.CANNON=(window&&window.CANNON)||{Body:class{constructor(o){Object.assign(this,o||{});}},World:class{add(){}},Box:class{},Sphere:class{},Vec3:V3c,Material:class{},ContactMaterial:class{}};
for(const f of FILES) load(ctx,f);
vm.runInContext(PRELUDE,ctx,{filename:'prelude'});
try{ vm.runInContext(`document.getElementById('startBtn').onclick();`,ctx); }catch(e){ console.log('  开局异常: '+e); }
return ctx;
}
const VM=(ctx,expr)=>vm.runInContext(expr,ctx);
let PASS=0,FAILS=0;
function ok(cond,label){ if(cond){ PASS++; console.log('  ✔ '+label); } else { FAILS++; console.log('  ✘ '+label); } }
function note(s){ console.log('  · '+s); }

console.log('══ 观战时停审计 (dev/probe-timestop-audit.js) ══');
const ctx=boot();
const SPEC_START=`(()=>{try{
player.team=0; player.cls=5; player.spectator=true; player.specUsed=true; selectedSpawn=-1; deployPlayer();
specTimeToggle();
return {frozen:specTimeFrozen(),paused:SPEC_TIME.paused,alive:player.alive,spec:player.spectator};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`;
const st=VM(ctx,SPEC_START);
if(typeof st==='string'){ console.log('  ✘ 观战+时停前置失败: '+st); process.exit(1); }
ok(st.frozen===true&&st.paused===true&&st.spec===true,'前置: 观战者已部署且时停已开 (specTimeFrozen=true)');

// ═════ P1 定点发射器在 dt=0 下的真实行为 (原假设"每帧一发" —— 实测**否**) ═════
console.log('P1 定点发射器 (火源/燃烧树/受损车烟/在途炮弹拖尾) 在 dt=0 下的真实行为');
{
const r=VM(ctx,`(()=>{try{
// ① "你正想看的那场爆炸": 20 颗普通粒子 (不属任何发射器), 就放在相机附近
const P=V3(camera.position.x,0,camera.position.z);
const np={x:P.x+6,z:P.z+6};
for(let i=0;i<20;i++) spawnP(PT.flash,np.x+rand(-1,1),heightAt(np.x,np.z)+1,np.z+rand(-1,1),0,1,0,1,2,0.6,1,0,true);
const watch=particles.slice(-20);
// ② 一个持续火源 (坦克残骸同款): 必须落在 04b 的距离闸门 (相机 130m) 内, 否则它根本不喷
const fs1={x:P.x+10,z:P.z+10};
const src=addFireSource(fs1.x,fs1.z,heightAt(fs1.x,fs1.z),5,120,10,null);
// ③ 一发在途坦克炮弹 (拖尾喷射无距离闸门)
const shp={x:P.x-9,z:P.z-9};
shells.push({pos:V3(shp.x,heightAt(shp.x,shp.z)+2,shp.z),vel:V3(0,0,190),team:0,owner:{team:0,isPlayer:false},life:3.6,kind:'tank',dmgV:100,trail:0});
const n0=particles.length;
const per={fires:0,shells:0,trees:0};
const frames=90;
for(let f=0;f<frames;f++){
const a=particles.length; updateFires(0); per.fires+=particles.length-a;
const b=particles.length; updateShells(0); per.shells+=particles.length-b;
const c=particles.length; updateBurningTrees(0); per.trees+=particles.length-c;
}
const watchAlive=particles.filter(p=>watch.indexOf(p)>=0).length;
const age0=particles.filter(p=>p.age===0).length;
// 火源的节拍器有没有被冻在正值上 (⇒ 之后不再喷)
const acc=FIRE_SOURCES.length?FIRE_SOURCES[0].acc:null, tr=shells.length?shells[shells.length-1].trail:null;
return {n0,before:n0,after:particles.length,max:PARTICLE_MAX,watchAlive,age0,frames,per,
shellAlive:shells.length,srcStill:FIRE_SOURCES.indexOf(src)>=0,dCam:+Math.hypot(fs1.x-camera.position.x,fs1.z-camera.position.z).toFixed(1),
acc,tr};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof r==='string'){ console.log('  ✘ P1: '+r); FAILS++; } else {
note('90 帧 (dt=0): 粒子 '+r.n0+' → '+r.after+' (上限 '+r.max+'); 各发射器贡献: 火源 '+r.per.fires+' / 在途炮弹拖尾 '+r.per.shells+' / 燃烧树 '+r.per.trees+' (火源距相机 '+r.dCam+'m)');
note('冻结后节拍器读数: 火源 acc='+r.acc+', 炮弹 trail='+r.tr+' (都是**正值** ⇒ 之后不再到点); 你插进去看的那 20 颗存活 '+r.watchAlive+'/20, age=0 的共 '+r.age0+' 颗');
ok(r.per.fires<=3&&r.per.shells<=4&&r.per.trees<=3,
'P1 ★ 更正/冻结点行为: 发射器不是"每帧一发" —— 节拍器一旦回填成正值就被冻住 (90 帧里各最多多喷一帧的量');
ok(r.watchAlive===20,'P1 因此粒子池不会被环境发射器吃干 (你想定住看的那 20 颗全在)');
ok(r.shellAlive===1,'P1 ★ 但**在途炮弹本身**常驻: 90 帧不推进也不过期 (life-=0) —— 它会一直占着拖尾粒子与表项');
}
}

// ═════ P2 寿命类回收 (2026-09-27M 修复后: 玩家自己打出的照常回收; AI 的随战场冻住) ═════
console.log('P2 观战者开火: 曳光回池 / 炮弹过期 (旧版 dt=0 下二者都不回收 ⇒ 线性加对象)');
{
const r=VM(ctx,`(()=>{try{
const o=V3(0,40,0), d=V3(0,0,-1), ai={team:0,isPlayer:false,alive:true,pos:V3(0,0,0)};
const tp0=tracerPool.length, tr0=tracers.length, pa0=particles.length;
const shots=120;
for(let i=0;i<shots;i++) spawnTracer(o,d,60,player);   // 观战者按住扳机 (4参=射手: 归属判据)
for(let i=0;i<20;i++) updateTracers(0,1/60);           // 每帧 340/60=5.67m ⇒ 20 帧走完 60m 全程
const trAfter=tracers.length, tpAfter=tracerPool.length, paT=particles.length;
// 阴性对照: 同一批参数换成 AI 的射手 ⇒ 一条都不许动
const trA0=tracers.length;
for(let i=0;i<10;i++) spawnTracer(o,d,60,ai);
const aiOne=tracers[trA0];
const aiP0={x:aiOne.m.position.x,y:aiOne.m.position.y,z:aiOne.m.position.z};
for(let i=0;i<20;i++) updateTracers(0,1/60);
const aiStill=tracers.length-trA0, aiSame=aiOne.m.position.x===aiP0.x&&aiOne.m.position.y===aiP0.y&&aiOne.m.position.z===aiP0.z;
// 炮弹: 生命周期同样按归属走 (幽灵坦克主炮 CD 恒 0 ⇒ 想打多少发打多少发; life 0.5s 只为把等待压到 0.7s)
const sh0=shells.length;
for(let i=0;i<60;i++){
shells.push({pos:V3(o.x,o.y-1,o.z),vel:V3(0,0,190),team:-1,owner:player,life:0.5,kind:'tank',dmgV:100,trail:0});
}
for(let i=0;i<40;i++) updateShells(0,1/60);           // 40 帧 0.667s > life 0.5s
const shAfter=shells.length, paS=particles.length, pmax=PARTICLE_MAX;
// 阴性对照: AI 的炮弹 40 帧后仍逐位不动
const aSh={pos:V3(20,400,0),vel:V3(0,0,190),team:0,owner:ai,life:0.5,kind:'tank',dmgV:100,trail:0};
shells.push(aSh);
const ap0=aSh.pos.clone();
for(let i=0;i<40;i++) updateShells(0,1/60);
const aiShSame=(aSh.pos.x===ap0.x&&aSh.pos.y===ap0.y&&aSh.pos.z===ap0.z)&&aSh.life===0.5&&shells.indexOf(aSh)>=0;
shells.splice(shells.indexOf(aSh),1);
for(const t of tracers.slice(trA0)){ t.m.visible=false; tracerPool.push(t.m); }
tracers.length=trA0;
return {tp0,tpAfter,tr0,trAfter,shots,sh0,shAfter,pa0,paT,paS,pmax,aiStill,aiSame,aiShSame};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof r==='string'){ console.log('  ✘ P2: '+r); FAILS++; } else {
note('120 次开火 + 20 帧 (每帧真实帧长 1/60): tracers '+r.tr0+' → '+r.trAfter+', 空闲池 '+r.tp0+' → '+r.tpAfter+' (旧版: 120 条全在表、池 0→0)');
note('60 发玩家炮弹 (life 0.5s, 40 帧 0.667s): shells '+r.sh0+' → '+r.shAfter+'; 粒子 '+r.paT+' → '+r.paS+' / 上限 '+r.pmax+' (修复前实测: 60 发全部常驻)');
ok(r.trAfter===0&&r.tpAfter===r.tp0+r.shots,
'P2 ★ 玩家自己打出的曳光按 traveled>=max 回池 (全部回池: 表 0 / 池 +'+r.shots+')');
ok(r.aiStill===10&&r.aiSame===true,'P2 ★ 阴性对照: 同一批参数下 AI 的 10 条曳光逐位不动 (归属判据真的在分人, 不是"一律照飞")');
ok(r.shAfter===r.sh0&&r.aiShSame===true,
'P2 ★ 玩家炮弹按 life 正常过期 (不再常驻) 而 AI 的整发冻结 (位置/寿命逐位不变)');
ok(r.paS<=r.pmax,'P2 粒子池仍有界 ('+r.paS+' ≤ '+r.pmax+')');
}
}

// ═════ P3 时停里开火与结算 (开火保留 = 观战特权; 判定只在有帧长时跑) ═════
console.log('P3 时停里开火与结算: 射速走真实帧长 (保留); 炮弹不再以 0.5m 前瞻隔空引爆');
{
const r=VM(ctx,`(()=>{try{
const sp=__TS.flatSpot();
const dt=specTimeConsume(1/60);              // 世界帧长 (时停 ⇒ 0)
const pdt=specTimePlayerDt(1/60,dt);         // 本体链帧长 (时停 ⇒ 真实)
// ① 玩家开火节拍走 pdt: 连续 60 帧扣扳机 (观战者弹药无限), 弹匣应真的下去 (不冻观察者 ⇒ 保留)
player.curW.mag=player.curW.def.mag; player.fireT=0; VM.state='idle';
const mag0=player.curW.mag;
for(let f=0;f<60;f++){ mouseDown=true; playerFireTick(pdt,true); }
mouseDown=false;
const mag1=player.curW.mag;
// ② 炮弹的 0.5m 前瞻: 把一发"静止"炮弹放在一名敌兵身前 0.4m 处 (靶兵给足血: 只看伤害不看死亡链)
const b=new Bot(1,0,'靶'); b.alive=true; b.pos.set(sp.x,sp.y,sp.z); b.onVehicle=null; b.hp=100000; b.maxHp=100000;
const sh={pos:V3(sp.x,sp.y+1.2,sp.z-0.4),vel:V3(0,0,190),team:0,owner:player.curW&&{team:0,isPlayer:false},life:3.6,kind:'tank',dmgV:400,trail:9};
shells.push(sh);
const hp0=b.hp;
for(let f=0;f<3;f++) updateShells(dt,pdt);   // 与主循环同参: step=0 ⇒ 这一发整发跳过
const hp1=b.hp;
// ③ 阴性对照 (同一几何换成观察者自己的炮弹): 照常飞、照常结算伤害
const sh2={pos:V3(sp.x,sp.y+1.2,sp.z-0.4),vel:V3(0,0,190),team:0,owner:player,life:3.6,kind:'tank',dmgV:400,trail:9};
shells.push(sh2);
for(let f=0;f<3;f++) updateShells(dt,pdt);
const hp2=b.hp;
return {dt,pdt,mag0,mag1,hp0,hp1,hp2,shLeft:shells.indexOf(sh)>=0,sh2Left:shells.indexOf(sh2)>=0};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof r==='string'){ console.log('  ✘ P3: '+r); FAILS++; } else {
note('世界帧长 dt='+r.dt+' / 本体链帧长 pdt='+r.pdt.toFixed(4)+' (时停下两者不同源)');
note('60 帧扣扳机: 弹匣 '+r.mag0+' → '+r.mag1+'; 静止炮弹 (AI) 3 帧后: 靶兵 hp '+r.hp0+' → '+r.hp1+', 炮弹仍在表='+r.shLeft+'; 观察者自己的一发 3 帧后 hp → '+r.hp2);
ok(r.dt===0&&r.pdt>0,'P3 前置: 时停下世界帧长 0 而本体链拿到真实帧长 (观战者例外)');
ok(r.mag1<r.mag0,'P3 时停期间玩家照常开火 (弹匣 '+r.mag0+'→'+r.mag1+'): 射速/换弹走 pdt —— 这是"不冻观察者"的裁定, 保留');
ok(r.hp1===r.hp0,'P3 ★★ 冻结期间零伤害: 一发**不动**的炮弹不再把 0.4m 外的靶兵引爆 (旧版每帧 0.5m 前瞻重跑 ⇒ 实测 404 血)');
ok(r.hp2<r.hp1,'P3 ★ 阴性对照: 同一几何下观察者自己打出的炮弹照常命中 (归属判据生效, 不是把命中判定整体关掉)');
}
}

// ═════ P4 生命周期: 跨"回主菜单→继续"复位 + 海战音频收世界帧长 ═════
console.log('P4 生命周期与音频: 回主菜单即解除时停; 海战音频 tick 收世界帧长并逐艇解析');
{
const r=VM(ctx,`(()=>{try{
const before=SPEC_TIME.paused;
returnToMenu();                       // 战局未结束 ⇒ menuHold (战场原地挂着)
const inMenu={paused:SPEC_TIME.paused,frozen:specTimeFrozen(),menuHold};
resumeBattle();                       // 「继 续 游 戏」
const after={paused:SPEC_TIME.paused,frozen:specTimeFrozen(),wdt:specTimeConsume(1/60)};
specTimeToggle();                     // 再开一次: 音频那一段要在**冻结态**下量
const frozenAgain=specTimeFrozen();
// 海战音频: 记录 updatePlayer 传进去的两个帧长 (第一实参 = 世界帧长; 主循环的调法就是 updatePlayer(pdt,dt))
let seen=null; const orig=AudioSys.navalAudioTick;
AudioSys.navalAudioTick=function(a,b){ seen=[a,b]; };
updatePlayer(specTimePlayerDt(1/60,specTimeConsume(1/60)),specTimeConsume(1/60));
AudioSys.navalAudioTick=orig;
specTimeReset();
return {before,inMenu,after,frozenAgain,audioDt:seen&&seen[0],ownDt:seen&&seen[1],worldDt:seen&&seen[0]};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof r==='string'){ console.log('  ✘ P4: '+r); FAILS++; } else {
note('开时停 → 回主菜单: paused='+r.inMenu.paused+' frozen='+r.inMenu.frozen+'; 继续战局后: paused='+r.after.paused+' 世界帧长='+r.after.wdt+' (再开一次='+r.frozenAgain+')');
note('海战音频 tick 收到 = [世界帧长 '+r.audioDt+' (修复前收到的是本体链 pdt='+r.ownDt.toFixed(4)+'), 本体链帧长 '+r.ownDt.toFixed(4)+']');
ok(r.before===true&&r.inMenu.paused===false&&r.after.frozen===false,
'P4 ★ 时停随"回主菜单"就地复位 (旧版: 回主菜单再继续 ⇒ 回来时 paused=true, 战场仍是静止的)');
ok(r.audioDt===0&&r.worldDt===0&&r.ownDt>0,
'P4 ★ 时停下海战音频收到**世界**帧长 0 (逐艇解析后只有观察者开的艇按本体链走) —— 旧版直接把 pdt 喂进去 ⇒ 整片海面静止而所有艇照响');
}
}

console.log('\n结果: '+PASS+' 通过 / '+FAILS+' 失败');
process.exit(FAILS?1:0);
