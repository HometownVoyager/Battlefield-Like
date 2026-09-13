// ─────────────────────────────────────────────
// 19-input.js —— 键鼠输入/换弹/切枪
// 源: Index.original.html 第 6937-7076 行
// ─────────────────────────────────────────────
'use strict';
const keys={};
let pointerLocked=false;
addEventListener('keydown',e=>{
if(e.code==='Tab'){ e.preventDefault(); document.getElementById('scoreboard').style.display='block'; updateScoreboard(); }
if(e.code==='Escape'&&!e.repeat){
if(player.deployed&&player.alive&&!matchOver) togglePause();
return;
}
if(e.repeat) return;
if(gamePaused) return;
keys[e.code]=true;
// 实验模式: P 切换 AI 调试层 (bot 状态标签+寻路线), 仅供调参
if(e.code==='KeyP'&&EXPERIMENT&&typeof BotDebug!=='undefined') BotDebug.toggle();
// 战场大地图: M 开关 (全域北向视图; 仅部署存活时, 暂停/菜单/部署界面不响应)
if(e.code==='KeyM'&&player.deployed&&player.alive) toggleBigMap();
// 观战模式: 双击空格 = MC创造式悬停飞行开关 (无重力可悬停; 若在气动飞行中则切为悬停)
if(e.code==='Space'&&player.spectator&&player.alive&&!player.onVehicle&&!player.loiter){
const tapT=performance.now();
if(tapT-(player._spaceTapT||0)<300){
if(!player.flying){
player.flying=true; player.flyAero=false;
player.crouch=false; player.prone=false; player.onGround=false;
player.vel.y=Math.max(player.vel.y,2.5);
showScorePop('创造悬停飞行 · WASD移动 空格升/Shift降 · 落地退出');
}else if(player.flyAero){
player.flyAero=false;
showScorePop('切换: 创造悬停 (空格升/Shift降)');
}else{
player.flying=false;
showScorePop('飞行关闭');
}
AudioSys.click(1050,0.3,0.05);
}
player._spaceTapT=tapT;
}
if(!player.alive||!pointerLocked) return;
if(e.code==='KeyR') tryReload();
if(e.code==='KeyC'){ if(player.onVehicle&&player.onVehicle.kind==='tank'){ player.tankView=!player.tankView; } else { player.crouch=!player.crouch; player.prone=false; } }
if(e.code==='KeyZ'&&!player.onMG&&!player.onVehicle&&!player.onAT&&!player.onAA&&!player.onMortar){ player.prone=!player.prone; if(player.prone){ player.crouch=false; player.braced=false; } }
if(e.code==='KeyX'&&!player.prone){
if(player.braced){ player.braced=false; AudioSys.metalSlide(0.18,0.08,500,900); }
else if(player.canBrace){
player.braced=true; player.braceYaw=player.yaw;
AudioSys.metalSlide(0.3,0.13,320,170); AudioSys.click(700,0.3,0.05);
}
}
if(e.code==='Digit1') switchSlot(0);
if(e.code==='Digit2') switchSlot(1);
if(e.code==='KeyV'){ if(VM.state==='idle'&&!player.onMG&&!player.onVehicle&&!player.onAT&&!player.onAA&&!player.onMortar&&player.meleeCd<=0){ VM.state='melee'; VM.stateT=0; VM.stateDur=0.5; player.meleeCd=0.7; vmSndFlags={}; AudioSys.metalSlide(0.15,0.06,1200,2000); } }
if(e.code==='KeyG'){
if(player.nadeCount>0&&VM.state==='idle'&&!player.onMG&&!player.onVehicle&&!player.onAT&&!player.onAA&&!player.onMortar&&!player.loiter){
VM.state='nade'; VM.stateT=0; VM.stateDur=999;
player.nadeHeld=true; player.nadeFuse=3.8; player.nadeIsAT=false; player.nadeIsSmoke=false; player.nadeIsIncin=false;
vmSndFlags={};
AudioSys.click(1600,0.25,0.04);
}
}
if(e.code==='Digit3'){
if(player.atNades>0&&VM.state==='idle'&&!player.onMG&&!player.onVehicle&&!player.onAT&&!player.onAA&&!player.onMortar&&!player.loiter){
VM.state='nade'; VM.stateT=0; VM.stateDur=0.6;
player.nadeHeld=false; player.nadeIsAT=true; player.nadeIsSmoke=false; player.nadeIsIncin=false;
vmSndFlags={};
AudioSys.click(1200,0.3,0.05);
}
}
if(e.code==='Digit4'){
if(player.cls===5&&VM.state==='idle'&&!player.loiter){ switchSlot(player.slots.findIndex(s=>s&&s.def.rocket)); }
else if(player.smokeCount>0&&VM.state==='idle'&&!player.onMG&&!player.onVehicle&&!player.onAT&&!player.onAA&&!player.onMortar&&!player.loiter){
VM.state='nade'; VM.stateT=0; VM.stateDur=0.6;
player.nadeHeld=false; player.nadeIsAT=false; player.nadeIsSmoke=true; player.nadeIsIncin=false;
vmSndFlags={};
AudioSys.click(1000,0.28,0.05);
}
}
if(e.code==='Digit6'){
if(player.incinCount>0&&VM.state==='idle'&&!player.onMG&&!player.onVehicle&&!player.onAT&&!player.onAA&&!player.onMortar&&!player.loiter){
VM.state='nade'; VM.stateT=0; VM.stateDur=0.6;
player.nadeHeld=false; player.nadeIsAT=false; player.nadeIsSmoke=false; player.nadeIsIncin=true;
vmSndFlags={};
AudioSys.click(880,0.3,0.05);
}
}
if(e.code==='KeyH'){
// 观战模式: H = 气动飞行开关 (复用巡飞弹飞行动作: 沿视线前飞不可悬停, 右键加速, 俯冲触地落地)
if(player.spectator&&player.alive&&!player.onVehicle&&!player.loiter){
if(!player.flying||!player.flyAero){
player.flying=true; player.flyAero=true;
player.crouch=false; player.prone=false; player.onGround=false;
player._aeroSpd=Math.max(player._aeroSpd||0,13);
player.vel.y=Math.max(player.vel.y,2.5);
showScorePop('气动飞行 · 沿视线前飞 · 右键加速 · 俯冲触地落地');
}else{
player.flying=false; player.flyAero=false;
showScorePop('飞行关闭');
}
AudioSys.click(1050,0.3,0.05);
return;
}
if(VM.state==='idle'&&player.bandages>0&&player.hp<100&&player.bandaging<=0&&!player.onVehicle&&!player.onMG&&!player.onAT&&!player.onAA&&!player.loiter){
player.bandaging=2.6;
VM.state='bandage'; VM.stateT=0; VM.stateDur=2.6;
vmSndFlags={};
showScorePop('包扎中…');
AudioSys.metalSlide(0.14,0.25,400,700);
}
}
if(e.code==='KeyB'){
if(player.cls===6&&!player.onVehicle&&!player.onMG&&!player.onAT&&!player.onAA&&!player.onMortar){
if(!player.mortarPlaced){
const fd=camForward();fd.y=0;if(fd.lengthSq()<0.1)return;fd.normalize();
deployMortar(player,player.pos.x+fd.x*1.6,player.pos.z+fd.z*1.6,Math.atan2(fd.x,fd.z));
} else recoverMortar(player);
} else if(player.cls===7&&!player.onVehicle&&!player.onMG&&!player.onAT&&!player.onAA&&!player.onMortar){
engBuild(player);
} else if(player.cls===4&&!player.onVehicle&&!player.onMG&&!player.onAT&&!player.onAA&&!player.onMortar){
if((player.medkitT||0)<=nowT){
const fd=camForward();fd.y=0;
const ok=fd.lengthSq()>0.1;
if(ok) fd.normalize();
placeMedkit(player,player.pos.x+(ok?fd.x*1.2:0),player.pos.z+(ok?fd.z*1.2:0));
player.medkitT=nowT+30;
} else showScorePop('医疗箱冷却中 ('+Math.ceil(player.medkitT-nowT)+'s)');
}
}
if(e.code==='Digit5'&&player.cls===7){
player.buildSel=((player.buildSel||0)+1)%BUILD_MENU.length;
const bt=BUILD_MENU[player.buildSel];
const bn=bt==='mg'?mgDefOfTeam(player.team).name:BUILD_NAMES[bt];
showScorePop('建造选择: '+bn+' (消耗'+BUILD_COST[bt]+'点 · 按B放置)');
}
if(e.code==='KeyF'){
// 巡飞弹制导中: F 切换 第一/第三 视角; 平时为互动
if(player.loiter){ player.loiterView=player.loiterView?0:1; AudioSys.click(1400,0.25,0.05); }
else tryInteract();
}
if(e.code==='KeyT') squadOrderMove();
if(e.code==='KeyY') squadOrderFollow();
});
addEventListener('keyup',e=>{
keys[e.code]=false;
if(e.code==='Tab') document.getElementById('scoreboard').style.display='none';
if(e.code==='KeyG'&&player.nadeHeld){
player.nadeHeld=false;
VM.stateT=0; VM.stateDur=0.55;
}
});
let mouseDown=false, mouse2Down=false;
addEventListener('mousedown',e=>{
if(!pointerLocked){
// 战斗进行中指针锁定丢失(浏览器可能拒绝立即重锁): 点击画布补锁
if(player.deployed&&player.alive&&!matchOver&&!gamePaused&&document.querySelectorAll('.screen:not(.hidden)').length===0) lockPointer();
return;
}
if(e.button===0) mouseDown=true;
if(e.button===2){
mouse2Down=true;
// 巡飞弹制导中右键是"加速"而非机瞄; 气动飞行中右键是加速
if(player.alive&&!player.loiter&&!player.flying&&!player.onMG&&!player.onVehicle&&!player.onAT&&!player.onAA&&!player.onMortar) player.ads=true;
}
});
addEventListener('mouseup',e=>{
if(e.button===0) mouseDown=false;
if(e.button===2){ mouse2Down=false; player.ads=false; }
});
addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('mousemove',e=>{
if(!pointerLocked||!player.alive) return;
const d=WPN_DEFS[VM.key]||{};
const zoomFac=player.ads?(d.adsFov||60)/74:1;
const s=0.0022*SETTINGS.sens*zoomFac;
player.yaw-=e.movementX*s;
player.pitch-=e.movementY*s;
player.pitch=clamp(player.pitch,-1.45,1.45);
player.mouseDX=e.movementX; player.mouseDY=e.movementY;
});
// ESC 暂停切换: 暂停时退出指针锁定并盖暂停面板, 恢复时重新锁定
function togglePause(){
gamePaused=!gamePaused;
// 暂停静音: 环境(风/雨)+坦克/飞机引擎 (旧版 setAmbientMute 未导出, 静音从未生效)
if(AudioSys.setAmbientMute) AudioSys.setAmbientMute(gamePaused);
const ov=document.getElementById('pauseOv');
if(!ov) return;
if(gamePaused){
ov.classList.remove('hidden');
document.exitPointerLock&&document.exitPointerLock();
}else{
ov.classList.add('hidden');
lockPointer();
}
}
document.getElementById('pauseResumeBtn').addEventListener('click',()=>{ togglePause(); });
document.addEventListener('pointerlockchange',()=>{
if(MOBILE) return;
pointerLocked=document.pointerLockElement===renderer.domElement;
if(!pointerLocked&&player.alive&&player.deployed&&!matchOver&&!gamePaused){
showDeploy(false);
}
});
function lockPointer(){
if(MOBILE){ pointerLocked=true; return; }
try{ const r=renderer.domElement.requestPointerLock(); if(r&&r.catch) r.catch(()=>{}); }catch(e){}
}
function tryReload(){
if(player.spectator) return; // 观战: 弹药每0.5s自动回满, 永不换弹 —— 拦截手动R/空仓点击/打空自动换弹/巡飞弹引爆后的自动换弹 (2026-09-11 修复不定时换弹)
const w=player.curW;
if(!w||player.onMG||player.onVehicle||player.onAT||player.onAA) return;
if(VM.state!=='idle') return;
if(w.mag>=w.def.mag||w.reserve<=0) return;
VM.state='reload'; VM.stateT=0;
VM.stateDur=w.def.reload*(player.streakBuff?player.streakBuff.reloadMul:1); // 连杀增益: 换弹加速 (2026-09-11)
vmSndFlags={};
}
function switchSlot(i){
if(i===player.curSlot||!player.slots[i]||player.onMG||player.onVehicle||player.onAT||player.onAA||player.loiter) return;
if(VM.state!=='idle'&&VM.state!=='fire') return;
player.curSlot=i;
player.curW=player.slots[i];
vmEquip(player.curW.key,player.team);
}
