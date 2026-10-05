// ─────────────────────────────────────────────
// dev/verify-touchpad-20260928.js —— 触控审计修复 + 手柄支持 (2026-09-28C, 不进 index.html)
// 用法: node dev/verify-touchpad-20260928.js
// 断言:
//   T1 触控源码断言: touchmove 有 TV 制导记账分支 / preventDefault 只拦已捕获触摸 / 捕获门含 alive+deployed /
//      bindBtn 有 touchcancel / tJump 走 kd('Space') / tSkill 文案走 t2 / ADS 门含 onBattery (键鼠+触屏) /
//      lookZoomMul 单源被键鼠·触屏·手柄三入口引用 / CSS 竖屏 tFire2 避让;
//   G1 手柄行为 (沙箱+假 gamepad): RT/LT/A/RB 按住态 · LT 的 ADS 门 · 右摇杆转视角解析式 · 死区 ·
//      TV 制导记账 tvDX/tvDY · 工程兵十字左=5 · Start 暂停 · LS 切枪 · 断开全释放 · 非战斗归还。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const {sandbox,document,window,byId}=require('./_bootstub.js');
require('./_bootpatch.js').patch(sandbox);
const _V3=sandbox.THREE.Vector3, _O3=sandbox.THREE.Object3D, _BA=sandbox.THREE.BufferAttribute;
if(_O3&&_O3.prototype&&!_O3.prototype.clear) _O3.prototype.clear=function(){ if(this.children) this.children.length=0; return this; };
if(!_V3.prototype.negate) _V3.prototype.negate=function(){ this.x=-this.x; this.y=-this.y; this.z=-this.z; return this; };
if(!_V3.prototype.cross) _V3.prototype.cross=function(v){ return this.crossVectors(this,v); };
if(_BA&&_BA.prototype&&!_BA.prototype.setXYZ) _BA.prototype.setXYZ=function(i,x,y,z){ if(this.array){ this.array[i*this.itemSize]=x; this.array[i*this.itemSize+1]=y; this.array[i*this.itemSize+2]=z; } return this; };
sandbox.confirm=()=>true;
const handlers={};
sandbox.addEventListener=(t,f)=>{ (handlers[t]=handlers[t]||[]).push(f); };
sandbox.removeEventListener=()=>{};
const patchStyle=el=>{ if(el&&el.style&&typeof el.style.setProperty!=='function') el.style.setProperty=function(k,v){this[k]=v;}; return el; };
{ const g=document.getElementById.bind(document),c=document.createElement.bind(document),q=document.querySelector.bind(document);
  document.getElementById=id=>patchStyle(g(id)); document.createElement=t=>patchStyle(c(t)); document.querySelector=s=>patchStyle(q(s)); }
const FILES=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/15g-capmodels.js','js/15h-capital.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/19b-gamepad.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/22a-menuart.js','js/22b-speclayer.js','js/23-deploy.js','js/23b-worldrestore.js','js/24-main.js'];
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document; ctx.window=window;
ctx.__evH=handlers;
ctx.localStorage={_s:{sf_campaign:'0',sf_exp:'1'},getItem(k){return (k in this._s)?this._s[k]:null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of FILES) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
try{ vm.runInContext(`document.getElementById('startBtn').onclick();`,ctx); }catch(e){ console.log('  开局异常: '+e); }
const VM=x=>vm.runInContext(x,ctx);
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
let PASS=0, FAILS=0;
const ok=(c,msg)=>{ if(c){ PASS++; console.log('  ✔ '+msg); } else { FAILS++; console.log('  ✘ '+msg); } };
const has=(src,sub,msg)=>ok(src.indexOf(sub)>=0,msg+'   [源码含: '+JSON.stringify(sub.slice(0,60))+'…]');

console.log('══ 触控审计修复 + 手柄支持 (dev/verify-touchpad-20260928.js) ══');

// ═════ T1 触控源码断言 ═════
console.log('T1 触控审计修复 (源码断言)');
{
const m=read('js/24-main.js'), inp=read('js/19-input.js'), css=read('css/style.css');
has(m,'if(player.loiter){\nplayer.tvDX+=dx; player.tvDY+=dy;','T1a touchmove TV制导=记账 tvDX/tvDY (与键鼠 2026-09-28B 同源)');
has(m,'if(owned&&e.cancelable) e.preventDefault();','T1b preventDefault 只拦已捕获触摸 (修"回菜单后面板滚动/滑条失灵")');
has(m,'if(!pointerLocked||!player.alive||!player.deployed) return;','T1c 捕获门含 alive+deployed (移动端 pointerLocked 一锁永真)');
has(m,"b.addEventListener('touchcancel',fin",'T1d bindBtn 补 touchcancel (系统手势打断不再卡死按下态)');
has(m,"bindBtn('tJump',()=>kd('Space'),()=>ku('Space'))",'T1e tJump 走 kd/ku (观战双击空格悬停触屏可达)');
has(m,'skb.textContent=t2(sk)','T1f tSkill 文案走 t2 查表 + 变更才写');
has(m,'!player.onMortar&&!player.onBattery) player.ads=true','T1g 触屏 ADS 门含 onBattery');
has(inp,'!player.onBattery&&!player.capitalGun) player.ads=true','T1h 键鼠 RMB ADS 门含 onBattery+capitalGun (锚随 2026-10-04 海战批: 炮位右键=副炮/防空扳机, 同门)');
has(inp,'function lookZoomMul()','T1i lookZoomMul 单源定义于 19-input');
has(inp,'0.0022*SETTINGS.sens*lookZoomMul()','T1j 键鼠 mousemove 引用单源');
has(m,'0.0052*SETTINGS.sens*lookZoomMul()','T1k 触屏 touchmove 引用单源');
has(css,'@media (orientation:portrait){ #tFire2','T1l 竖屏 tFire2 避让 tProne');
}

// ═════ G1 手柄行为 ═════
console.log('G1 手柄 (沙箱真链 + 假 gamepad)');
{
const r=VM(`(()=>{try{
const out={};
// 部署一名步兵 (与 verify-loiterfix 同式的真入口)
player.team=0; player.cls=0; selectedSpawn=-1; deployPlayer();
player.spectator=false; gamePaused=false; matchOver=false;
navigator.getGamepads=()=>[gp];
let held={};
const mkBtn=p=>({pressed:!!p});
const gp={index:5,id:'Test Pad',buttons:Array.from({length:16},()=>mkBtn(false)),axes:[0,0,0,0]};
padConnected(gp); out.on=PAD.on; out.idxSame=PAD.idx===5;
const P=(i,on)=>{ gp.buttons[i].pressed=!!on; };
const step=()=>window.updateGamepad(1/60);   // 沙箱里 window≠全局: 24-main 同款 typeof 守卫调 window.updateGamepad
// RT 开火 / A 跳 / LB 疾跑
P(7,1); P(0,1); P(4,1); step();
out.rt=mouseDown; out.a=!!keys.Space; out.lb=!!keys.ShiftLeft;
P(7,0); P(0,0); P(4,0); step();
out.rtUp=mouseDown; out.aUp=!!keys.Space; out.lbUp=!!keys.ShiftLeft;
// LT 瞄准: 步行进 ADS; 上岸防炮位不进 (门同款)
P(6,1); step(); out.ads=!!player.ads;
P(6,0); step(); out.adsUp=player.ads===false&&mouse2Down===false;
// 右摇杆: 解析式 (死区外) — yaw-=rx*3.4*sens*zoom*pdt
const DZ=v=>Math.sign(v)*(Math.max(Math.abs(v),0.22)-0.22)/(1-0.22);   // 模块同款径向归一 (轴值 0.6 ⇒ 0.4872)
const y0=player.yaw; gp.axes=[0,0,0.6,0]; step();
out.yawDelta=+(player.yaw-y0).toFixed(9);
out.yawExp=+(-DZ(0.6)*3.4*SETTINGS.sens*lookZoomMul()*(1/60)).toFixed(9);
out.mouseDX=player.mouseDX; out.mouseDXExp=DZ(0.6)*16;
// 死区: 0.1 < 0.22 不动
const y1=player.yaw; gp.axes=[0,0,0.1,0]; step(); out.deadzone=player.yaw===y1;
gp.axes=[0,0,0,0];
// TV 制导: 右摇杆记账 tvDX/tvDY
const d=fireLoiter(player,V3(0,60,0),V3(0,0,-1)); d.grace=0; d.life=9999;
player.tvDX=0; player.tvDY=0; gp.axes=[0,0,0.8,-0.5]; step();
out.tv={x:+player.tvDX.toFixed(6),y:+player.tvDY.toFixed(6)};
out.tvExp={x:+(DZ(0.8)*1000/60).toFixed(6),y:+(DZ(-0.5)*1000/60).toFixed(6)};
gp.axes=[0,0,0,0]; updateLoiters(1/60,1/60); out.tvCleared=player.tvDX===0&&player.tvDY===0;
loiterDespawn(d);
// 工程兵: 十字左 = Digit5 (非工程 = Digit4)
player.cls=4; P(14,1); step(); out.dig5=!!keys.Digit5; P(14,0); step(); out.dig5Up=!keys.Digit5;
player.cls=0; P(14,1); step(); out.dig4=!!keys.Digit4; P(14,0); step(); out.dig4Up=!keys.Digit4;
// Start 暂停 (战斗中) + 再按恢复
P(9,1); step(); out.paused=gamePaused;
P(9,0); step(); P(9,1); step(); out.resumed=!gamePaused; P(9,0); step();
// LS 切枪 (部署动画态 VM.state 门内不可切 —— 先回到 idle, 与真机部署完成后同态)
VM.state='idle';
const slot0=player.curSlot; P(10,1); step(); out.swap=player.curSlot!==slot0; P(10,0); step();
// 断开: 按住态全释放
P(0,1); P(7,1); step(); out.heldA=!!keys.Space&&mouseDown===true;
padDisconnected(5); out.relA=!keys.Space&&mouseDown===false&&PAD.on===false;
// 非战斗归还: 重连, 杀掉玩家, 按住 RT/左摇杆
padConnected(gp); P(7,1); P(0,1); gp.axes=[0,-0.8,0,0]; player.alive=false; step();
out.relax={rt:mouseDown,w:!!keys.KeyW}; P(7,0); P(0,0); gp.axes=[0,0,0,0]; player.alive=true; step();
return out;
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`);
if(typeof r==='string'){ FAILS++; console.log('  ✘ G1 推演异常: '+r); }
else{
ok(r.on===true&&r.idxSame===true,'G1 连接: padConnected 置位 (on/idx)');
ok(r.rt===true&&r.rtUp===false,'G1 RT 开火: 按住=mouseDown, 抬起=松开');
ok(r.a===true&&r.aUp===false,'G1 A=跳跃: keys.Space 按住/抬起');
ok(r.lb===true&&r.lbUp===false,'G1 LB=疾跑: ShiftLeft 按住/抬起');
ok(r.ads===true&&r.adsUp===true,'G1 LT 瞄准: 步行进 ADS, 松开退出');
ok(Math.abs(r.yawDelta-r.yawExp)<1e-9,`G1 右摇杆=解析式: Δyaw=${r.yawDelta} = -0.6·3.4·sens·zoom·dt (期望 ${r.yawExp})`);
ok(Math.abs(r.mouseDX-r.mouseDXExp)<1e-9,'G1 右摇杆同时记账 mouseDX (视模型摇晃/载具读数)');
ok(r.deadzone===true,'G1 死区 0.22: 0.1 输入零响应');
ok(Math.abs(r.tv.x-r.tvExp.x)<1e-6&&Math.abs(r.tv.y-r.tvExp.y)<1e-6,'G1 TV制导: 满杆记账 tvDX/tvDY (≈1000px/s)');
ok(r.tvCleared===true,'G1 updateLoiters 消费后清账 (单源闭环)');
ok(r.dig5===true&&r.dig5Up===true,'G1 工程兵: 十字左=选工事 Digit5');
ok(r.dig4===true&&r.dig4Up===true,'G1 非工程: 十字左=烟雾 Digit4');
ok(r.paused===true&&r.resumed===true,'G1 Start=暂停/继续 (togglePause 真链)');
ok(r.swap===true,'G1 LS按=切枪 (switchSlot 真链)');
ok(r.heldA===true&&r.relA===true,'G1 ★ 断开: held 全释放 + on/idx 复位 (防卡键)');
ok(r.relax&&r.relax.rt===false&&r.relax.w===false,'G1 ★ 非战斗帧: 按住态逐帧归还 (死亡/面板不再带车走)');
}
}

console.log(FAILS?('\n✗ verify-touchpad: '+FAILS+' 项失败 ('+PASS+' 通过)'):'\n✓ verify-touchpad: 全部通过 ('+PASS+')');
process.exit(FAILS?1:0);
