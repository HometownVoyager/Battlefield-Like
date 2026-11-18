// ─────────────────────────────────────────────
// dev/verify-aimassist.js —— 瞄准吸附批沙箱 (2026-09-27, 不进 index.html)
// 用法: node dev/verify-aimassist.js
// 原理: 复用 dev/_bootstub.js 的桩 (THREE/DOM/WebAudio), 加载**全部真实脚本**(与 index.html 同序),
//       用真起点 startBtn.onclick 开局, 再直接驱动 20-player/20a-seats/16-aircraft 的**真开火链**。
// 断言 (T1~T7):
//   T1 单源/关档: aimAssistTier 读 SETTINGS.aim; 关档时 aimAssistDir **原样返回入参引用** (零分配/零漂移);
//   T2 ★ 轻度: 对 60m 外敌人的"近失误"(0.5° 偏) —— 原弹道 raySoldiers 判空 (打不中), 吸附后判中;
//      再走**真实伤害入口** fireBullet: 吸附弹掉血 / 阴性对照 (同一几何不吸附) 不掉血;
//      最后走**真链** (playerFireTick → playerShoot → fireBullet: 捕获真出膛方向 + hp 预算);
//   T3 ★ 阴性对照三条 (都不许吸): 队友 / 隔墙 (addBoxCollider 造的实墙) / 大偏 (15°);
//      以及"队友站在弹道上"的人体遮挡 —— 不吸附 (不制造打队友);
//   T4 档位单调: 开镜 > 普通瞄准, 标准 > 轻度 (同几何掰角更大, 且都不超过硬上限);
//   T5 ★ 载具火力真链三条: 坦克主炮 (20a updatePlayerTank → 15-vehicles fireCannon → shells) 的出膛方向
//      确实被掰向 120m 外的敌车、关档时与 aimDir() 逐位一致 (泊位自检重试: 地形遮挡会被如实报出来);
//      战机航炮与固定重机枪座 (16-aircraft fireMGBurst / 20a updatePlayerMG) 用**捕获真出膛方向**判
//      (追踪弹是 1/(def.tracer) 概率生成的, 不能当判据; 随机散布靠 Math.random 归零压掉) ——
//      AI 走的是同一批函数但 shooter≠player, 另有逐位不变的阴性对照;
//   T6 只读视图: AIM_ASSIST 计数 (shots/assisted/blocked) 与实测一致;
//   T7 静态接线: 各玩家开火链的 aimAssistDir 调用点 + 设置项 (sf_aim/按钮/词典) 一件不少
//      + 赋值目标扫描 (接线点的 dir/ad/md/sd 必须是 let: const 只在扣扳机那一刻炸, 子串断言看不见)。
//   T8 ★ 爆头批 (2026-11-08): 士兵双靶点 —— 正对爆头球心绝不掰 (旧病根: 只瞄胸 ⇒ 瞄站立敌人的头被向下掰
//      0.29k 米, 标准档任何距离都爆不了头); 差一点打中头 ⇒ 掰向头部 (落点进球 35% 深 = 真爆头, 真伤害入口
//      isHead 透传); 瞄胸照旧 (头球不抢身体候选)。本文件沿惯例无 NEG 桩, T8 第一条就是旧病根的回归钉
//      (撤掉头球测试或"已指着"守卫它必红)。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const {sandbox,document,window,byId}=require('./_bootstub.js');
// ── 桩补丁 (与 _finalaudit-tankai 同源: 几个 Vector3/材质方法 + WebAudio 参数对象) ──
const V3c=sandbox.THREE.Vector3;
if(!V3c.prototype.addScalar) V3c.prototype.addScalar=function(s){ this.x+=s; this.y+=s; this.z+=s; return this; };
if(!V3c.prototype.divideScalar) V3c.prototype.divideScalar=function(s){ s=s||1; this.x/=s; this.y/=s; this.z/=s; return this; };
if(!V3c.prototype.clampScalar) V3c.prototype.clampScalar=function(a,b){ this.x=Math.min(b,Math.max(a,this.x)); this.y=Math.min(b,Math.max(a,this.y)); this.z=Math.min(b,Math.max(a,this.z)); return this; };
// 20a updatePlayerTank 的落点 pip 会调 project(camera) (桩里只有 Vector3, 没有摄像机投影)
if(!V3c.prototype.project) V3c.prototype.project=function(){ this.x=0; this.y=0; this.z=1; return this; };
// 20-player 的开火链用 cross/negate (真 THREE 有, 共享桩只有 crossVectors)
if(!V3c.prototype.cross) V3c.prototype.cross=function(v){ return this.crossVectors(this,v); };
if(!V3c.prototype.negate) V3c.prototype.negate=function(){ this.x=-this.x; this.y=-this.y; this.z=-this.z; return this; };
if(!V3c.prototype.normalize || V3c.prototype.lengthSq===undefined) throw new Error('V3 桩缺件');
for(const k of ['MeshLambertMaterial','MeshBasicMaterial','MeshStandardMaterial','MeshPhongMaterial','PointsMaterial','SpriteMaterial']){
const C=sandbox.THREE[k];
if(!C||!C.prototype) continue;
if(!C.prototype.clone) C.prototype.clone=function(){ return new C(Object.assign({},this,{color:this.color})); };
if(!C.prototype.dispose) C.prototype.dispose=function(){};
}
const AP=()=>({value:0,setValueAtTime(){},setTargetAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}});
// 共享桩 (_bootstub) 比 verify-specbatch 的私有桩少的三件: Object3D.clear (10-viewmodel vmEquip 走
// deployPlayer 路径必调) / BufferAttribute.setXYZ (22b 指向线) / THREE.Line (22b 的线对象)。
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
// ── 全链文件表 (与 index.html 同序; 含 15c/15d/15e/15f 与 22b) ──
const FILES=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/22a-menuart.js','js/22b-speclayer.js','js/23-deploy.js','js/23b-worldrestore.js','js/24-main.js'];
function load(ctx,file){ require('./_loadcache.js').script(root,file).runInContext(ctx); } // 2026-11-19 效率批: 读盘+编译缓存 (7 boot)
// 沙箱内小工具 (与 _finalaudit-tankai 同风格: 只在沙箱内定义一次)
// ★ 用顶层 `var` 而不是 `globalThis.__AA`: 桩里的 globalThis 指向**共享的 sandbox 对象** (跨 boot 污染),
//   写 globalThis.x 会落到共享对象上而不进本 context 的全局 —— 首个 boot 里读不到的坑就是这么来的。
const PRELUDE=`var __AA=(function(){
function mkBot(team,x,z,name){
const b=new Bot(team,0,name||'靶'); b.alive=true; b.pos.set(x,heightAt(x,z),z); b.vel.set(0,0,0);
b.onVehicle=null; b.spectator=false; b.hp=100;
return b;
}
function rotY(dx,dz,a){ const c=Math.cos(a),s=Math.sin(a); return {x:dx*c+dz*s,z:-dx*s+dz*c}; }
// 找一对"近乎同高 + 全程无静态遮挡"的点: A=(ax,az) 射手位, B 在其 -Z 方向 len 米处
function openSpot(len,ys){
const lim=MAP_SIZE/2-16;
for(let i=0;i<6000;i++){
const ax=(Math.random()*2-1)*lim, az=(Math.random()*2-1)*lim;
const bx=ax, bz=az-len;
if(Math.abs(bz)>lim) continue;
const ha=heightAt(ax,az), hb=heightAt(bx,bz);
if(Math.abs(ha-hb)>1.0) continue;
if(occBlocked(ax,az)||occBlocked(bx,bz)) continue;
const o=V3(ax,ha+1.6,az), t=V3(bx,hb+1.10,bz);
const d=t.clone().sub(o); const L=d.length(); d.normalize();
const hit=raycastWorld(o,d,Math.max(0.1,L-0.6));
if(hit) continue;
// 额外的水平射线 (载具链: 炮口/航炮高度也要通, 否则吸附的遮挡检查会判 blocked)
let ok2=true;
if(ys) for(const yy of ys){
const L2=len-0.6+8;   // +8m: 炮口/炮塔前移与目标点都在车体之前, 最后这一段也要通
if(raycastWorld(V3(ax,ha+yy,az),V3(0,0,-1),L2)){ ok2=false; break; }
if(raycastWorld(V3(ax,ha+yy,az),V3(0,0,1),L2)){ ok2=false; break; }   // 坦克炮塔 aimDir 是 +Z (桩的 camForward 是 -Z)
}
if(!ok2) continue;
return {ax,az,bx,bz,ha,hb};
}
return null;
}
// 从 O 指向 T 的方向, 再绕世界 Y 轴偏 angDeg 度
function offDir(O,T,angDeg){
const dx=T.x-O.x, dy=T.y-O.y, dz=T.z-O.z;
const L=Math.hypot(dx,dy,dz)||1;
const r=rotY(dx/L,dz/L,angDeg*Math.PI/180);
return V3(r.x,dy/L,r.z).normalize();
}
function angDeg(a,b){
const la=Math.hypot(a.x,a.y,a.z)||1, lb=Math.hypot(b.x,b.y,b.z)||1;
const d=(a.x*b.x+a.y*b.y+a.z*b.z)/(la*lb);
return Math.acos(Math.max(-1,Math.min(1,d)))*180/Math.PI;
}
function clearTroops(){ for(const s of soldiers) s.alive=false; soldiers.length=0; combatants.length=0; }
function clearVehicles(){ for(const t of tanks) t.alive=false; for(const t of trucks) t.alive=false;
try{ for(const p of planes) p.alive=false; }catch(e){} }
return {mkBot,rotY,openSpot,offDir,angDeg,clearTroops,clearVehicles};
})();`;
function boot(opts){
const o=opts||{};
for(const k in byId) delete byId[k];
const store=Object.assign({sf_campaign:'0'},o.store||{});
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document; ctx.window=window;
ctx.localStorage={_s:store,getItem(k){return (k in this._s)?this._s[k]:null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
const files=(o.files||FILES);
for(const f of files) load(ctx,f);
vm.runInContext(PRELUDE,ctx,{filename:'prelude'});
return ctx;
}
const VM=(ctx,expr)=>vm.runInContext(expr,ctx);
// ── 断言收集 ──
let PASS=0,FAILS=0;
function ok(cond,label){ if(cond){ PASS++; console.log('  ✔ '+label); } else { FAILS++; console.log('  ✘ '+label); } }
function exc(tag,e){ ok(false,tag+' 推演异常: '+String(e&&e.stack||e)); }
const START=`document.getElementById('startBtn').onclick();`;
function enter(ctx){
const err=VM(ctx,`(()=>{try{ ${START} }catch(e){ return String(e&&e.message||e); } return null; })()`);
if(err){ ok(false,'开局 (真路径 startBtn.onclick): '+err); return false; }
return true;
}
const read=(f)=>fs.readFileSync(path.join(root,f),'utf8');

// ═════ T1 单源 / 关档零漂移 ═════
function t1(){
console.log('T1 单源与关档: 档位读 SETTINGS.aim, 关档原样返回入参引用 (零漂移)');
const ctx=boot({store:{sf_aim:'0'}});   // 存档关档 ⇒ 开局即关
const r=VM(ctx,`(()=>{try{
const o=V3(3,4,5), d=V3(0,0,-1);
const ref=aimAssistDir(o,d,'hip',{team:0});
const ref2=aimAssistDir(o,d,'ads',{team:0});
const t0={same:ref===d,same2:ref2===d,tier:AIM_ASSIST.tier,stored:SETTINGS.aim};
SETTINGS.aim=1;
const low=aimAssistTier();
SETTINGS.aim=2;
const std=aimAssistTier();
SETTINGS.aim=7;                 // 非法值 ⇒ 关 (不崩)
const bad=aimAssistTier();
SETTINGS.aim=1;
return {t0,low,std,bad};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof r==='string'){ exc('T1',r); return; }
ok(r.t0.stored===0&&r.t0.tier===0,'T1 存档 sf_aim=0 被 00-config 读进 SETTINGS.aim (关档)');
ok(r.t0.same===true&&r.t0.same2===true,'T1 ★ 关档: aimAssistDir 原样返回入参引用 (=== 同一对象 ⇒ 零分配/零行为漂移)');
ok(r.low===1&&r.std===2&&r.bad===0,'T1 档位单源: 1→轻度 / 2→标准 / 非法值→关 (aimAssistTier 一处判)');
}

// ═════ T2 轻度: 近失误变命中 (几何 + 真实伤害入口) ═════
function t2(){
console.log('T2 ★ 轻度吸附: 60m 近失误 (0.5° 偏) 由"打不中"变"打中", 且走真伤害入口掉血');
const ctx=boot({store:{sf_aim:'1'}});
if(!enter(ctx)) return;
const r=VM(ctx,`(()=>{try{
player.team=0; player.cls=0; selectedSpawn=-1; deployPlayer();
__AA.clearTroops(); __AA.clearVehicles();
const sp=__AA.openSpot(60);
if(!sp) return 'NOPLACE';
const O=V3(sp.ax,sp.ha+1.6,sp.az), T=V3(sp.bx,sp.hb+1.10,sp.bz);
const b=__AA.mkBot(1,sp.bx,sp.bz,'靶');
const miss=__AA.offDir(O,T,0.5);                       // 0.5° 偏: 60m 兵角半径≈0.43° ⇒ 擦出 0.07° (真失误, 但"差一点")
const hit0=raySoldiers(O,miss,200,player,0,true);
const def=player.curW&&player.curW.def?player.curW.def:{dmg:30,headMul:2.6,snd:'smg',type:'auto',rpm:600,recoil:1,recSide:1};
const res=aimAssistDir(O,miss,'hip',{team:player.team,ff:false});
const hit1=raySoldiers(O,res,200,player,0,true);
const bendAmt=AIM_ASSIST.lastBend;                    // 掰了多少度
const residual=__AA.angDeg(res,__AA.offDir(O,T,0));   // 掰完之后与"正对胸口"的残差
const err0=__AA.angDeg(miss,__AA.offDir(O,T,0));      // 原始偏差 (0.5°)
// 真实伤害入口: 同一发弹, 吸附方向打中 / 原方向打不中 (阴性对照)
b.hp=100; fireBullet(player,O,res,def,null); const hpAssisted=b.hp;
b.hp=100; fireBullet(player,O,miss,def,null); const hpRaw=b.hp;
// 队友不做目标 (同几何): 换成同队士兵 ⇒ 不吸附
b.team=0;
const resMate=aimAssistDir(O,miss,'hip',{team:player.team,ff:false});
const mateSame=(resMate===miss);
b.team=1;
// ③ 真链 (不是直调 fireBullet): 走 20-player 的开火单源 playerShoot (= 两条接线的其中一条) ——
//    砂箱里把相机摆在 O 点 (桩的 camForward 恒为 -Z), 把靶兵放到 -Z 轴侧偏 0.5° 处, 扣一帧扳机。
//    这一条专门防"接线处把 const 方向赋值"这类静态断言看不见的错 (T7 只看源码子串)。
b.hp=100; b.pos.set(O.x+Math.tan(0.5*Math.PI/180)*60,O.y-0.5+0.0,O.z-60);
player.pos.set(O.x,O.y-1.6,O.z); camera.position.set(O.x,O.y,O.z);
player.curW.mag=player.curW.def.mag; player.fireT=0; VM.state='idle'; player.ads=false;
// 把"随机散布"压到接近 0 (架枪×0.35 · 屏息×0.4 · 蹲×0.8 · bloom 归零) ⇒ 这一条才可复现;
// 否则散布会把"已经吸正的"子弹又抖出去 (那是设计的随机性, 不是吸附失效)。
player.braced=true; player.holdBreath=true; player.crouch=true; player.prone=false;
player.bloom=0; player.wading=false; player.onGround=true; player.vel.set(0,0,0);
const aChain0=AIM_ASSIST.assisted;
let cap=null; const _fb0=fireBullet;
fireBullet=function(sh,o,dd,def,v){ if(!cap) cap={x:dd.x,y:dd.y,z:dd.z}; return _fb0.apply(this,arguments); };
const _rnd0=Math.random; Math.random=()=>0.5;        // 散布/后坐随机量归零 (rand 是 const, 只能从源头压): 这一条要的是"方向"不是"散布"
for(let i=0;i<10;i++){ player.curW.mag=player.curW.def.mag; player.fireT=0; VM.state='idle'; mouseDown=true; playerFireTick(0.016,true); if(b.hp<100) break; }
mouseDown=false; fireBullet=_fb0; Math.random=_rnd0;
const hpChain=b.hp, chainBend=AIM_ASSIST.assisted-aChain0;
const Tnow=V3(b.pos.x,b.pos.y+1.10,b.pos.z);        // 靶兵当前的胸口 (旧 T 是移动前的位置: 差 0.5m 横 + 1.1m 竖)
const chainOff=cap?__AA.angDeg(cap,__AA.offDir(O,Tnow,0)):-1, chainRaw=__AA.angDeg(__AA.offDir(O,Tnow,0.5),__AA.offDir(O,Tnow,0));
return {err0:+err0.toFixed(4),residual:+residual.toFixed(4),bend:+bendAmt.toFixed(3),
rawHit:!!hit0,assistHit:!!hit1&&hit1.sol===b,hpAssisted,hpRaw,mateSame,hpChain,chainBend,chainOff,chainRaw:0.5,
shots:AIM_ASSIST.shots,assisted:AIM_ASSIST.assisted};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof r==='string'){ exc('T2',r); return; }
ok(r.rawHit===false,'T2 前置: 0.5° 偏的原始弹道确实打不中 (raySoldiers 判空) —— 断言有区别力');
ok(r.assistHit===true,'T2 ★ 吸附后弹道命中该敌兵 (raySoldiers 判中, 且是同一个体)');
ok(r.bend>0.1&&r.bend<=1.4,'T2 掰角在"轻度"档的量级与硬上限内 (实测 '+r.bend+'°, 硬上限 1.3°×档位倍率)');
ok(r.hpAssisted<100&&r.hpRaw===100,'T2 ★ 真伤害入口: 吸附弹掉血 ('+r.hpAssisted+') / 原始弹不掉血 ('+r.hpRaw+')');
ok(r.mateSame===true,'T2 阴性对照: 同队士兵不做吸附对象 (同几何下原样返回)');
ok(r.chainBend>=1&&r.chainOff>0&&r.chainOff<0.45&&r.hpChain<100,'T2 ★★ 真链 (20-player playerShoot → fireBullet): 出膛方向真被掰向目标 ('+r.chainRaw+'° → '+r.chainOff+'°) 且 ≤10 枪内命中 ('+r.hpChain+' 血; 散布是随机的, 故用多枪预算)');
ok(r.residual<r.err0&&r.residual<0.35,'T2 掰向目标: 原始偏差 '+r.err0+'° → 残差 '+r.residual+'° (躯干角半径 ≈0.36° ⇒ 落进身体)');
ok(r.shots>0&&r.assisted>0,'T2 只读视图计数: shots='+r.shots+' assisted='+r.assisted);
}

// ═════ T3 阴性对照: 隔墙 / 队友挡道 / 大偏 ═════
function t3(){
console.log('T3 ★ 阴性对照: 隔墙不吸 / 人挡在前面不吸 / 大偏不吸');
const ctx=boot({store:{sf_aim:'2'}});   // 用最强档: 若最强档都不误吸, 轻度更不会
if(!enter(ctx)) return;
const r=VM(ctx,`(()=>{try{
player.team=0; player.cls=0; selectedSpawn=-1; deployPlayer();
__AA.clearTroops(); __AA.clearVehicles();
const sp=__AA.openSpot(50);
if(!sp) return 'NOPLACE';
const O=V3(sp.ax,sp.ha+1.6,sp.az), T=V3(sp.bx,sp.hb+1.10,sp.bz);
const b=__AA.mkBot(1,sp.bx,sp.bz,'靶');
const near=__AA.offDir(O,T,1.2);   // 50m 兵角半径≈0.52° ⇒ 擦出 0.68° (真失误)
const a0=AIM_ASSIST.assisted;
// ① 隔墙: 在弹道中点立一道 3m 高的实墙 (addBoxCollider = 世界碰撞体单源)
const mid=V3().copy(O).lerp?null:null;
const mx=(O.x+T.x)/2, mz=(O.z+T.z)/2, my=(O.y+T.y)/2;
const box=addBoxCollider(mx,my,mz,3.0,3.0,0.6);
const wallRes=aimAssistDir(O,near,'ads',{team:player.team,ff:false});
const wallSame=(wallRes===near);
// ② 人体遮挡: 把墙撤掉 (移到地下), 换一名**队友**站在弹道中点上
if(box){ box.y0=-9999; box.y1=-9990; if(box.h!==undefined){ box.h=0; } }
try{ box.dead=true; }catch(e){}
const mate=__AA.mkBot(0,mx,mz,'友');
const blockRes=aimAssistDir(O,near,'ads',{team:player.team,ff:false});
const blockSame=(blockRes===near);
mate.alive=false;
// ③ 大偏 15°: 远超收容角 ⇒ 不吸
const far=__AA.offDir(O,T,15);
const farSame=(aimAssistDir(O,far,'ads',{team:player.team,ff:false})===far);
// ④ 贴脸 1m (<1.2m) 不做
const Otoo=V3(sp.bx,sp.hb+1.6,sp.bz+1.0);
const dToo=__AA.offDir(Otoo,T,1.2);
const tooSame=(aimAssistDir(Otoo,dToo,'ads',{team:player.team,ff:false})===dToo);
return {wallSame,blockSame,farSame,tooSame,blocked:AIM_ASSIST.blocked,dAssisted:AIM_ASSIST.assisted-a0};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof r==='string'){ exc('T3',r); return; }
ok(r.wallSame===true,'T3 ★ 隔墙不吸 (世界射线遮挡: 目标前 0.6m 内有碰撞体 ⇒ 原样返回)');
ok(r.blockSame===true,'T3 ★ 队友站在弹道上不吸 (人体遮挡: 沿射线第一个被打中的不是目标)');
ok(r.farSame===true,'T3 15° 大偏不吸 (收容角外: 大偏仍是大偏)');
ok(r.tooSame===true,'T3 贴脸 (<1.2m) 不做吸附 (那是直接命中, 不需要帮)');
ok(r.blocked>=1,'T3 遮挡计数 blocked='+r.blocked+' (只读视图与实测一致)');
}

// ═════ T4 档位单调 (开镜 > 普通 / 标准 > 轻度) ═════
function t4(){
console.log('T4 档位单调: 开镜 > 普通瞄准; 标准 > 轻度; 都受硬上限约束');
const ctx=boot({store:{sf_aim:'1'}});
if(!enter(ctx)) return;
const r=VM(ctx,`(()=>{try{
player.team=0; player.cls=0; selectedSpawn=-1; deployPlayer();
__AA.clearTroops(); __AA.clearVehicles();
const sp=__AA.openSpot(60);
if(!sp) return 'NOPLACE';
const O=V3(sp.ax,sp.ha+1.6,sp.az), T=V3(sp.bx,sp.hb+1.10,sp.bz);
const b=__AA.mkBot(1,sp.bx,sp.bz,'靶');
const dir=__AA.offDir(O,T,0.5);
SETTINGS.aim=1;
const hipL=aimAssistDir(O,dir,'hip',{team:0}); const bHipL=AIM_ASSIST.lastBend;
const adsL=aimAssistDir(O,dir,'ads',{team:0}); const bAdsL=AIM_ASSIST.lastBend;
SETTINGS.aim=2;
const hipS=aimAssistDir(O,dir,'hip',{team:0}); const bHipS=AIM_ASSIST.lastBend;
const adsS=aimAssistDir(O,dir,'ads',{team:0}); const bAdsS=AIM_ASSIST.lastBend;
SETTINGS.aim=1;
// 硬上限: 把偏差推到收容角内部最大处, 掰角仍 ≤ cap×档位倍率
const edge=__AA.offDir(O,T,1.4);
const bEdge=(aimAssistDir(O,edge,'ads',{team:0}),AIM_ASSIST.lastBend);
return {bHipL:+bHipL.toFixed(3),bAdsL:+bAdsL.toFixed(3),bHipS:+bHipS.toFixed(3),bAdsS:+bAdsS.toFixed(3),bEdge:+bEdge.toFixed(3)};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof r==='string'){ exc('T4',r); return; }
ok(r.bAdsL>r.bHipL,'T4 开镜 > 普通瞄准 (轻度档: '+r.bAdsL+'° vs '+r.bHipL+'°)');
ok(r.bHipS>r.bHipL&&r.bAdsS>r.bAdsL,'T4 标准 > 轻度 (同武器的掰角单调递增: hip '+r.bHipL+'→'+r.bHipS+', ads '+r.bAdsL+'→'+r.bAdsS+')');
ok(r.bEdge<=1.8*1.25+1e-6,'T4 ★ 硬上限生效: 最大掰角 '+r.bEdge+'° ≤ cap(1.8°)×档位倍率(1.25) —— 不会有"弹道拐弯"');
}

// ═════ T5 载具火力真链: 坦克主炮 + 战机航炮 ═════
function t5(){
console.log('T5 ★ 载具火力: 坦克主炮 (20a→15-vehicles) 与战机航炮 (16-aircraft) 的出膛方向真被掰向目标');
const ctx=boot({store:{sf_aim:'1'}});
if(!enter(ctx)) return;
const r=VM(ctx,`(()=>{try{
player.team=0; player.cls=0; selectedSpawn=-1; deployPlayer();
__AA.clearTroops(); __AA.clearVehicles();
const sp=__AA.openSpot(120,[1.93,80.0]);
if(!sp) return 'NOPLACE';
// ── 坦克主炮 ── (选点带自检: 摆好几何后先直接问一次 aimAssistDir —— 掰不动就换点重来,
//    避免把"这一处地形在炮口射线上有遮挡"误报成"主炮没接吸附")
const pv=tanks.filter(v=>v.team===0)[0], ev=tanks.filter(v=>v.team===1)[0];
pv.alive=true; ev.alive=true; pv.hp=pv.maxHp; ev.hp=ev.maxHp;
pv.playerDriven=true; player.onVehicle=pv;
player.yaw=0; player.pitch=0;
let aim0=null, to=null, a0=-1, spotTries=0, spotOK=false;
for(;spotTries<14&&!spotOK;spotTries++){
const s2=__AA.openSpot(120,[1.93]);
if(!s2) break;
pv.pos.set(s2.ax,heightAt(s2.ax,s2.az),s2.az); pv.vel=0; pv.yaw=0; pv.turretYaw=0; pv.turretPitch=0;
player.yaw=pv.yaw+Math.PI; player.pitch=0;
const ad=pv.aimDir().clone().normalize();
pv.muzzle.set(pv.pos.x+ad.x*pv.barrelTip,pv.pos.y+1.93+ad.y*pv.barrelTip,pv.pos.z+ad.z*pv.barrelTip);
const rot=__AA.rotY(ad.x,ad.z,1.8*Math.PI/180);              // 敌车摆在炮轴偏 1.8° 的方位上 (120m 车角半径≈1.24° ⇒ 擦出 0.56°: 真失误)
const rdir=V3(rot.x,ad.y,rot.z).normalize();
const ideal=pv.muzzle.clone().addScaledVector(rdir,120);
ev.pos.set(ideal.x,ideal.y-1.0,ideal.z);                     // pos.y+1.0 = 车体中心 落在理想射线上
ev.yaw=0; ev.vel=0;
aim0=pv.aimDir().clone().normalize();
const evc=ev.pos.clone().addScaledVector(V3(0,1.0,0),1);   // 车体中心 (pos.y+1.0)
to=evc.clone().sub(pv.muzzle).normalize();
a0=__AA.angDeg(aim0,to);
spotOK=(aimAssistDir(pv.muzzle,aim0,'heavy',{team:pv.team,ff:pv.kind==='ghost',self:pv})!==aim0);
}
pv.cannonCd=0; shells.length=0; mouseDown=true; updatePlayerTank(1/60); mouseDown=false;
const sh=shells[shells.length-1];
const dv=sh?sh.vel.clone().normalize():null;
const aHit=dv?__AA.angDeg(dv,to):-1;
const turretBend=dv?__AA.angDeg(aim0,dv):-1;
// 关档对照: 同一几何再打一发, 必须与炮轴逐位一致
SETTINGS.aim=0;
pv.cannonCd=0; shells.length=0; mouseDown=true; updatePlayerTank(1/60); mouseDown=false;
const sh0=shells[shells.length-1];
const dv0=sh0?sh0.vel.clone().normalize():null;
const off0=dv0?__AA.angDeg(aim0,dv0):-1;
SETTINGS.aim=1;
player.onVehicle=null; pv.playerDriven=false;
// ── 战机航炮 (16-aircraft fireMGBurst: 真链, 用 tracers[].dir 读出膛方向) ──
const pl=planes.filter(p=>p.alive)[0]||planes[0];
pl.playerDriven=true; pl.alive=true;
pl.pos.set(sp.ax,sp.ha+80,sp.az); pl.yaw=0; pl.pitch=0; pl.roll=0; pl.speed=50;
const fd=pl.fwdDir().clone().normalize();
const po=pl.pos.clone().addScaledVector(fd,2.4);
const prot=__AA.rotY(fd.x,fd.z,0.5*Math.PI/180);          // 目标摆到机头方向偏 0.5° 处
const tdir=V3(prot.x,0,prot.z).normalize();
const ptgt=po.clone().addScaledVector(tdir,60);
const pbot=__AA.mkBot(1,ptgt.x,ptgt.z,'地面靶');
pbot.pos.y=ptgt.y-1.10;                                  // 让"胸口"落在理想射线上 (吸附目标点 = 胸口)
// 判据 = **捕获出膛方向** (fireBullet 是唯一出膛口, AI 与玩家共用): 追踪弹按 def.tracer 概率生成 (1/2),
// 不能再当判据; hp 也不能 (散布是随机的, 只作"顺带看看"的非判据读数)。
let capP=null; const _fbP=fireBullet;
// 捕获出膛方向 (注意: 必须是普通函数 —— 箭头函数没有 arguments)
const capHook=(slot)=>function(sh,o,dd,def,v){ if(!slot.cap) slot.cap={x:dd.x,y:dd.y,z:dd.z}; return _fbP.apply(this,arguments); };
const P={cap:null};
fireBullet=capHook(P);
pbot.hp=100; tracers.length=0;
pl.fireMGBurst(player,0);                                // spreadMul=0 ⇒ 无随机, 可复现
fireBullet=_fbP;
capP=P.cap;
const tr=tracers[tracers.length-1];
const bast=tr?__AA.angDeg(tr.dir,fd):-1, bhit=tr?__AA.angDeg(tr.dir,tdir):-1;
const planeHit=pbot.hp;
const planeOff=capP?__AA.angDeg(capP,tdir):-1;
// AI 阴性对照: 同一函数, shooter 不是玩家 ⇒ 不许吸 (同一几何, 同一发弹)
pbot.hp=100; tracers.length=0;
const A={cap:null};
fireBullet=capHook(A);
pl.fireMGBurst(pl.crew||{team:1,pos:pl.pos},0);
fireBullet=_fbP;
const aiDirOff=A.cap?__AA.angDeg(A.cap,fd):-1, planeAiHit=pbot.hp;
const trAI=tracers[tracers.length-1];
const aiOff=trAI?__AA.angDeg(trAI.dir,fd):-1;
// ── 固定重机枪座 (20a updatePlayerMG, 真链): 假机枪座 (只需 seat 链读的那几个字段) + 靶兵 ──
const cd0=camForward();                                   // 机枪座的基准方向 = 相机前向 (桩恒为 -Z)
const rotM=__AA.rotY(cd0.x,cd0.z,0.5*Math.PI/180);
const mgdir=V3(rotM.x,cd0.y,rotM.z).normalize();
const mg={x:po.x,y:po.y,z:po.z,face:0,yaw:{rotation:{y:0}},pitch:{rotation:{x:0}},heat:0,fireT:0,alive:true,user:null,def:null};
player.onMG=mg;
const mgt=po.clone().addScaledVector(mgdir,60);
const mbot=__AA.mkBot(1,mgt.x,mgt.z,'枪座靶'); mbot.pos.y=mgt.y-1.10;
const mgMiss=__AA.angDeg(cd0,mgdir);                        // 手瞄偏 0.5°
mbot.hp=100;
tracers.length=0;
const M={cap:null};
fireBullet=capHook(M);
const _rnd1=Math.random; Math.random=()=>0.5;         // 机枪输入散布归零 (判据是方向, 不是手感)
mouseDown=true; updatePlayerMG(1/60); mouseDown=false;
Math.random=_rnd1; fireBullet=_fbP;
const capM=M.cap;
const trM=tracers[tracers.length-1];
const mBend=trM?__AA.angDeg(trM.dir,cd0):-1, mResid=trM?__AA.angDeg(trM.dir,mgdir):-1;
const mgOff=capM?__AA.angDeg(capM,mgdir):-1;
const mgHit=mbot.hp;
player.onMG=null;
return {a0:+a0.toFixed(4),aHit:+aHit.toFixed(4),turretBend:+turretBend.toFixed(4),off0:+off0.toFixed(9),
bast:+bast.toFixed(4),bhit:+bhit.toFixed(4),aiOff:+aiOff.toFixed(9),n:shells.length,
spotTries,spotOK,mgMiss:+mgMiss.toFixed(3),mBend:+mBend.toFixed(4),mResid:+mResid.toFixed(4),mgHit,planeHit,planeAiHit,
planeOff:+planeOff.toFixed(4),aiDirOff:+aiDirOff.toFixed(9),mgOff:+mgOff.toFixed(4)};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof r==='string'){ exc('T5',r); return; }
ok(r.spotOK===true,'T5 前置: 找到一处"炮口→敌车"无遮挡的泊位 (试了 '+r.spotTries+' 个点 —— 遮挡由地形决定, 不是吸附失效)');
ok(r.a0>1.7&&r.a0<1.9,'T5 前置: 敌车摆在炮轴偏 '+r.a0+'° 处 (1.8° = 120m 上真失误, 不是"已经在打")');
ok(r.aHit>0&&r.aHit<1.24,'T5 ★ 坦克主炮出膛方向被掰进车体 (与目标夹角 '+r.a0+'° → '+r.aHit+'° < 车角半径 1.24°)');
ok(r.turretBend>0.05&&r.turretBend<=1.5,'T5 主炮掰角在 heavy 档上限内 ('+r.turretBend+'°)');
ok(r.off0===0,'T5 ★ 关档对照: 同一几何下出膛方向与炮轴**逐位一致** (偏差 '+r.off0+'°)');
ok(r.planeOff>0&&r.planeOff<0.5*0.8&&r.aiDirOff===0,
'T5 ★ 战机航炮 (捕获真出膛方向): 玩家机被掰向靶兵 (0.5° → '+r.planeOff+'°; 顺带 hp '+Math.round(r.planeHit)+') / 同一几何 AI 机逐位不变 ('+r.aiDirOff+'°; hp '+Math.round(r.planeAiHit)+')');
ok(r.aiOff===0,'T5 ★ 阴性对照: AI 机走同一个 fireMGBurst 但 shooter≠player ⇒ 一枪不吸 (偏差 '+r.aiOff+'°)');
ok(r.mgMiss>0.4&&r.mgMiss<0.6,'T5 前置: 固定机枪座的手瞄偏差 '+r.mgMiss+'° (0.5°)');
ok(r.mgOff>0&&r.mgOff<r.mgMiss*0.9,'T5 ★ 固定重机枪座 (20a updatePlayerMG 真链): 出膛方向被掰向靶兵 ('+r.mgMiss+'° → '+r.mgOff+'°; 顺带 hp '+Math.round(r.mgHit)+')');
}

// ═════ T6 只读视图 ═════
function t6(){
console.log('T6 只读视图 AIM_ASSIST: 计数与实际开火一致');
const ctx=boot({store:{sf_aim:'1'}});
if(!enter(ctx)) return;
const r=VM(ctx,`(()=>{try{
player.team=0; player.cls=0; selectedSpawn=-1; deployPlayer();
__AA.clearTroops(); __AA.clearVehicles();
const sp=__AA.openSpot(60);
const O=V3(sp.ax,sp.ha+1.6,sp.az), T=V3(sp.bx,sp.hb+1.10,sp.bz);
const b=__AA.mkBot(1,sp.bx,sp.bz,'靶');
const s0={shots:AIM_ASSIST.shots,assisted:AIM_ASSIST.assisted};
for(let i=0;i<5;i++){ aimAssistDir(O,__AA.offDir(O,T,0.8),'hip',{team:0}); }   // 60m 士兵: 0.8° = 擦出 0.37° (真失误)
const s1={shots:AIM_ASSIST.shots,assisted:AIM_ASSIST.assisted};
for(let i=0;i<3;i++){ aimAssistDir(O,__AA.offDir(O,T,20),'hip',{team:0}); }   // 大偏: shots 记, assisted 不记
const s2={shots:AIM_ASSIST.shots,assisted:AIM_ASSIST.assisted};
return {s0,s1,s2,lastKind:AIM_ASSIST.lastKind,lastTarget:AIM_ASSIST.lastTarget};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof r==='string'){ exc('T6',r); return; }
ok(r.s1.shots===r.s0.shots+5&&r.s1.assisted===r.s0.assisted+5,'T6 5 次可吸的开火 ⇒ shots/assisted 各 +5');
ok(r.s2.shots===r.s1.shots+3&&r.s2.assisted===r.s1.assisted,'T6 ★ 3 次大偏 ⇒ shots +3 而 assisted 不动 (计数不被"看了就算吸"污染)');
ok(r.lastKind==='hip'&&r.lastTarget==='sol','T6 末次读数留档: kind='+r.lastKind+' target='+r.lastTarget);
}

// ═════ T7 静态接线 (源码断言: 漏接线/漏设置项会被点名) ═════
function t7(){
console.log('T7 静态接线清单: 玩家开火链 / 设置项 / 词典 / 说明');
const combat=read('js/13-combat.js'), pl=read('js/20-player.js'), seats=read('js/20a-seats.js');
const air=read('js/16-aircraft.js'), cfg=read('js/00-config.js'), hud=read('js/22-hud.js');
const html=read('index.html'), i18n=read('js/00b-i18n.js');
ok(combat.indexOf('function aimAssistDir(')>=0&&combat.indexOf('const AIM_PROFILES=')>=0&&combat.indexOf('function aimAssistTier(')>=0,
'T7 13-combat: 吸附单源三件套 (AIM_PROFILES / aimAssistTier / aimAssistDir)');
const nPl=(pl.match(/aimAssistDir\(/g)||[]).length, nSeats=(seats.match(/aimAssistDir\(/g)||[]).length;
ok(nPl>=2,'T7 20-player: 步兵开火链 2 处接线 (枪弹 + 火箭筒), 实测 '+nPl);
ok(nSeats>=6,'T7 20a-seats: 载具座驾链 ≥6 处接线 (坦克主炮/同轴 MG/固定 MG/反坦克炮/防空炮/岸防炮/舰炮主炮+副炮), 实测 '+nSeats);
ok(air.indexOf("shooter===player&&typeof aimAssistDir==='function'")>=0,'T7 16-aircraft: 航炮只在 shooter===player 时接 (AI 机不吃)');
ok(cfg.indexOf("'sf_aim'")>=0&&cfg.indexOf('sf_aim')>=0&&cfg.indexOf('aim:1')>=0,'T7 00-config: SETTINGS.aim + sf_aim 存档读取');
ok(hud.indexOf('aimAssistBtn')>=0&&hud.indexOf("localStorage.setItem('sf_aim'")>=0,'T7 22-hud: 设置按钮绑定 + 落盘 + 初值同步 (2026-11-08 迁入游戏内容设置, 单钮循环)');
ok(html.indexOf('id="aimAssistBtn"')>=0&&html.indexOf('data-a=')<0&&html.indexOf('id="aimAssistBtn"')>html.indexOf('id="mGameplaySet"'),
'T7 index.html: 瞄准吸附档位按钮在游戏内容设置面板内 (mGameplaySet 之后 + 旧 data-a 三档钮绝迹)');
ok(i18n.indexOf("'瞄准吸附':'AIM ASSIST'")>=0&&i18n.indexOf("'轻度':'Light'")>=0&&i18n.indexOf("'标准':'Standard'")>=0,
'T7 00b-i18n: 中文原文即键的 EN 词条齐 (瞄准吸附/轻度/标准)');
// 每个接线点的"赋值目标"必须不是 const 声明 (2026-09-27 首跑红的教训: playerShoot/updatePlayerMG 的 dir
// 原为 const, 改成 let 才装得下掰过的方向 —— 这种错静态子串断言看不见, 运行时只在真扣扳机那一刻炸)。
{
const bad=[];
for(const f of ['js/20-player.js','js/20a-seats.js','js/16-aircraft.js']){
const lines=read(f).split('\n');
for(let i=0;i<lines.length;i++){
const m=lines[i].match(/(?:^|[^.\w])([A-Za-z_$][\w$]*)\s*=\s*(?:typeof aimAssistDir[^;]*?)?aimAssistDir\(/);
if(!m) continue;
const name=m[1];
let decl=null;
for(let j=i;j>=0;j--){
const d=lines[j].match(new RegExp('(const|let|var)\\s+'+name+'\\s*='));
if(d){ decl=d[1]; break; }
}
if(decl!=='let'&&decl!=='var') bad.push(f.split('/')[1]+':'+(i+1)+' '+name+' ('+(decl||'?')+')');
}
}
ok(bad.length===0,'T7 ★ 接线点赋值目标可重写 (let/var; const 会在扣扳机那一刻抛 TypeError)'+(bad.length?(' —— 违规: '+bad.join(', ')):''));
}
}

// ═════ T8 ★ 爆头批 (2026-11-08): 士兵双靶点 ═════
function t8(){
console.log('T8 ★ 爆头批: 瞄头绝不掰 (不抢爆头) / 差一点打中头掰向头部 (救援成真爆头) / 瞄胸照旧');
const ctx=boot({store:{sf_aim:'1'}});
if(!enter(ctx)) return;
const r=VM(ctx,`(()=>{try{
player.team=0; player.cls=0; selectedSpawn=-1; deployPlayer();
__AA.clearTroops(); __AA.clearVehicles();
// 选点: openSpot 只保证胸高射线通, 头高 (hb+1.68) 也必须通 —— 否则遮挡检查会把"没掰"误判成"守卫生效"
let sp=null,O=null,Hc=null;
for(let i=0;i<8&&!sp;i++){
const s2=__AA.openSpot(60); if(!s2) break;
const o2=V3(s2.ax,s2.ha+1.6,s2.az), hc2=V3(s2.bx,s2.hb+1.68,s2.bz);
const d2=hc2.clone().sub(o2); const L2=d2.length(); d2.normalize();
if(raycastWorld(o2,d2,Math.max(0.1,L2-0.6))) continue;
sp=s2; O=o2; Hc=hc2;
}
if(!sp) return 'NOPLACE';
const b=__AA.mkBot(1,sp.bx,sp.bz,'靶');
const Cc=V3(sp.bx,b.pos.y+1.10,sp.bz);             // 胸口靶点 (旧行为)
const def=player.curW&&player.curW.def?player.curW.def:{dmg:30,headMul:2.6,snd:'smg',type:'auto',rpm:600,recoil:1,recSide:1};
const closest=(dir,P)=>{                           // 射线对点 P 的最近距离 (判"这一枪算不算进爆头球")
const vx=P.x-O.x, vy=P.y-O.y, vz=P.z-O.z;
const t=Math.max(0,vx*dir.x+vy*dir.y+vz*dir.z);
const dx=vx-dir.x*t, dy=vy-dir.y*t, dz=vz-dir.z*t;
return Math.sqrt(dx*dx+dy*dy+dz*dz);
};
const dmgOf=(fireDir)=>{                           // 真伤害入口一发: isHead 由 damage 第三参透传 (killattr 契约)
let head=null; const _d=b.damage.bind(b);
b.damage=function(a,at,h){ head=!!h; return _d(a,at,h); };
b.hp=100; fireBullet(player,O,fireDir,def,null);
delete b.damage;                                   // 摘实例 spy, 还原原型方法
return {hp:b.hp,isHead:head};
};
// ① 瞄头守卫: 正对爆头球心 ⇒ 原样返回 (旧病根: 射线在胸球外 0.13m ⇒ over>0 ⇒ 被向下掰 ~0.29k 米)
const dirH=__AA.offDir(O,Hc,0);
const a0=AIM_ASSIST.assisted;
const resH=aimAssistDir(O,dirH,'ads',{team:player.team});
const guardSame=(resH===dirH), assisted0=AIM_ASSIST.assisted-a0;
const h0=dmgOf(dirH);
// ② 救援: 瞄头顶上方 0.35m (60m 处 over≈0.08°, 真差一点; 胸球擦出 0.46° 远 ⇒ 头球赢 min-over)
const dirUp=__AA.offDir(O,V3(Hc.x,Hc.y+0.35,Hc.z),0);
const resU=aimAssistDir(O,dirUp,'ads',{team:player.team});
const bendTarget=AIM_ASSIST.lastTarget, bendU=AIM_ASSIST.lastBend;
const missU=closest(resU,Hc);
const hU=dmgOf(resU);
// ③ 胸口照旧: 瞄胸球下方 0.5m (over≈0.05°) ⇒ 仍掰向胸口 —— 头球不抢身体候选
const dirLo=__AA.offDir(O,V3(Cc.x,Cc.y-0.50,Cc.z),0);
const resL=aimAssistDir(O,dirLo,'ads',{team:player.team});
const targetL=AIM_ASSIST.lastTarget;
const missL=closest(resL,Cc);
return {guardSame,assisted0,h0Hp:h0.hp,h0Head:h0.isHead,
bendTarget,bendU:+bendU.toFixed(3),missU:+missU.toFixed(3),hUHp:hU.hp,hUHead:hU.isHead,sameU:(resU===dirUp),
targetL,missL:+missL.toFixed(3)};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof r==='string'){ exc('T8',r); return; }
ok(r.guardSame===true&&r.assisted0===0,'T8 ★ 瞄头守卫: 正对爆头球心原样返回 (assisted 不动) —— 吸附绝不与爆头瞄准对抗 (旧病根在此转红)');
ok(r.h0Hp<100&&r.h0Head===true,'T8 ★ 瞄头直射 = 真爆头 (fireBullet 伤害入口 isHead 透传; hp '+r.h0Hp+')');
ok(r.sameU===false&&r.bendTarget==='solHead','T8 ★ 差一点打中头 (头顶 0.35m) ⇒ 掰向头部 (lastTarget='+r.bendTarget+', 掰 '+r.bendU+'°)');
ok(r.missU<0.26,'T8 ★ 掰完落进爆头球 (对球心最近距离 '+r.missU+'m < 半径 0.26m)');
ok(r.hUHead===true,'T8 ★★ 真伤害入口: 救援弹 isHead=true —— 吸附帮打出爆头 (hp '+r.hUHp+')');
ok(r.targetL==='sol'&&r.missL<0.45,'T8 瞄胸照旧: 掰向胸口 (lastTarget='+r.targetL+', 落点距胸心 '+r.missL+'m) —— 头球不抢身体候选');
}

console.log('══ 瞄准吸附验收 (dev/verify-aimassist.js) ══');
const ONLY=process.env.ONLY||'';   // ONLY=t2 node dev/verify-aimassist.js —— 单测调试用
for(const f of [t1,t2,t3,t4,t5,t6,t7,t8]){
if(ONLY&&f.name!==ONLY) continue;
try{ f(); }catch(e){ exc(f.name,e); }
}
console.log('\n结果: '+PASS+' 通过 / '+FAILS+' 失败');
process.exit(FAILS?1:0);
