// ─────────────────────────────────────────────
// 24-main.js —— 主循环/移动端触控/启动
// 源: Index.original.html 第 8531-8765 行
// ─────────────────────────────────────────────
'use strict';
let lastT=performance.now(), fpsAcc=0, fpsN=0, fpsShow=0, deployRefreshT=0;
function loop(){
requestAnimationFrame(loop);
if(document.hidden) return;
const now=performance.now();
let dt=Math.min((now-lastT)/1000,0.05);
if(gamePaused||matchOver) nowOff+=now-lastT;
lastT=now;
nowT=(now-nowOff)/1000;
fpsAcc+=1/Math.max(dt,0.001); fpsN++;
if(fpsN>=30){ fpsShow=Math.round(fpsAcc/fpsN); fpsAcc=0; fpsN=0; el('fps').textContent=fpsShow+' FPS'; }
// 暂停/对局结束: 战斗、移动、天气、旗点等全部冻结, 仅维持画面渲染
if(gamePaused||matchOver){
renderer.clear();
renderer.render(scene,camera);
if(player.alive&&!player.onMG&&VM.root.visible){
renderer.clearDepth();
renderer.render(vmScene,vmCamera);
}
return;
}
gunEvents=gunEvents.filter(e=>nowT-e.t<0.6);
NAV.budget=2;
updateNavDirty(dt);
updateWires(dt);
updateRisers(dt);
if(MOBILE&&window.updateTouchVis) updateTouchVis();
if(mortarMarker.visible&&!(player.alive&&player.onMortar)) mortarMarker.visible=false;
updatePlayer(dt);
updateCamera(dt);
updateSunShadow();
// 天空盒跟随相机, 避免远处被远裁剪面切黑
if(SKY) SKY.position.copy(camera.position);
// 小队标记浮动
if(SQUAD.marker&&SQUAD.marker.visible){
SQUAD.marker.position.set(SQUAD.pos.x,heightAt(SQUAD.pos.x,SQUAD.pos.z)+2.1+Math.sin(nowT*2.4)*0.18,SQUAD.pos.z);
}
updateWeather(dt);
updateSmokes(dt);
for(const s of soldiers){
// AI LOD: 远处降低更新频率(隔帧), 但把跳过的时间累积补回, 保证移动速度不变
s.tickAcc+=dt;
s.tickSkip--;
if(!s.alive||s.onVehicle||s.tickSkip<=0){
const useDt=Math.min(s.tickAcc,0.15);
s.update(useDt);
s.tickAcc=0;
const d2p=s.pos.distanceTo(camera.position);
s.tickSkip=d2p>110?3:d2p>60?2:1;
}
}
if(typeof BotDebug!=='undefined'&&BotDebug.on) BotDebug.update(dt);
updateMedCrates(dt);
updateBloodDecals(dt);
for(const t of tanks) t.update(dt);
for(const pl of planes) pl.update(dt);
updateTrucks(dt); // 劫道车队: 在炮弹判定前推进, 命中管线拿到当帧位置
updateSupplyPoints(dt); // 劫道方临时补给点: 限时失效
// 火焰蔓延/树木燃烧倒伏/倒伏动画 (04b-fire)
updateFires(dt);
updateTreeBursts(dt); // 许特根树爆: 环境炮击林冠空爆 (04b-fire, woodline 专属)
updateFallingTrees(dt);
updateBurningTrees(dt);
updatePlaneWrecks(dt);
updateWreckSinks(dt); // 被毁模型(载具/草木/房屋)残骸: 停留→沉入→删除 (08-effects)
updateRagdolls(dt);
updateShells(dt);
updateFlak(dt);
updateNades(dt);
updateLoiters(dt);
updateParticles(dt);
updateTracers(dt);
updateCasings(dt);
updateFlags(dt);
if(flashTimer>0){ flashTimer-=dt; if(flashTimer<=0) flashLight.intensity=0; }
if(player.alive&&player.curW&&!player.onMG&&!player.onVehicle&&!player.onAT&&!player.onAA&&!player.onMortar&&!player.loiter){
updateViewModel(dt,player);
} else if(player.alive&&!player.loiter&&(player.onMG||player.onAT||player.onAA)){
camera.fov=dampF(camera.fov,74,10,dt);
camera.updateProjectionMatrix();
}
player.mouseDX*=Math.pow(0.0001,dt*3);
player.mouseDY*=Math.pow(0.0001,dt*3);
updateHUD(dt);
renderer.clear();
renderer.render(scene,camera);
if(player.alive&&!player.onMG&&VM.root.visible){
renderer.clearDepth();
renderer.render(vmScene,vmCamera);
}
if(!player.alive&&player.deployed&&!matchOver){
respawnCd=Math.max(0,respawnCd-dt);
el('respawnTxt').textContent=respawnCd>0?`(${Math.ceil(respawnCd)})`:'';
const btn=el('deployBtn');
btn.disabled=respawnCd>0||tickets[player.team]<=0; // 己方兵力归零后按钮保持禁用 (2026-09-04)
}
// 部署界面打开期间(死亡等待/存活按Esc查看): 载具重生冷却/占用状态/旗点归属实时刷新 (0.5s 一次),
// 冷却走完的载具按钮即刻亮起可选 (2026-09-01 用户指定)
if(player.deployed&&!matchOver&&!el('deploy').classList.contains('hidden')){
deployRefreshT-=dt;
if(deployRefreshT<=0){
deployRefreshT=0.5;
refreshDeployList();
if(!player.alive) drawDeployMap();
}
}
}
// ===== 移动端触控输入 =====
function applyTouchScale(){
if(!MOBILE) return;
const k=(parseInt(localStorage.getItem('sf_tsize')||'100'))/100;
document.querySelectorAll('#touchUI .tbtn').forEach(b=>{ b.style.transform='scale('+k+')'; });
const st=el('tStick');
if(st){ st.style.width=(120*k)+'px'; st.style.height=(120*k)+'px'; }
}
if(MOBILE){
document.body.classList.add('mobile');
const stick={id:-1,cx:0,cy:0};
const look={id:-1,lx:0,ly:0};
const stickEl=el('tStick'), knob=el('tKnob');
let sprintLock=false;
const setMove=(dx,dy)=>{
const max=52;
const r=Math.hypot(dx,dy);
const cl=Math.min(r,max);
const nx=r>1e-3?dx/r:0, ny=r>1e-3?dy/r:0;
knob.style.transform=`translate(${nx*cl}px,${ny*cl}px)`;
const fx=dx/max, fy=dy/max;
keys.KeyW=fy<-0.32; keys.KeyS=fy>0.32;
keys.KeyA=fx<-0.32; keys.KeyD=fx>0.32;
keys.ShiftLeft=sprintLock||(r>max*1.05&&fy<-0.55);
};
const resetMove=()=>{
knob.style.transform='translate(0px,0px)';
keys.KeyW=keys.KeyS=keys.KeyA=keys.KeyD=false;
keys.ShiftLeft=sprintLock;
};
const homeStick=()=>{ stickEl.style.left='40px'; stickEl.style.top=(innerHeight-180)+'px'; };
document.addEventListener('touchstart',e=>{
AudioSys.resume();
if(!pointerLocked) return;
for(const t of e.changedTouches){
const x=t.clientX,y=t.clientY;
if(t.target&&t.target.closest&&(t.target.closest('.tbtn')||t.target.closest('.screen'))) continue;
if(x<innerWidth*0.42&&y>innerHeight*0.4&&stick.id===-1){
stick.id=t.identifier; stick.cx=x; stick.cy=y;
stickEl.style.left=(x-60)+'px'; stickEl.style.top=(y-60)+'px';
} else if(look.id===-1){
look.id=t.identifier; look.lx=x; look.ly=y;
}
}
if(e.target===renderer.domElement&&e.cancelable) e.preventDefault();
},{passive:false});
document.addEventListener('touchmove',e=>{
if(!pointerLocked) return;
for(const t of e.changedTouches){
if(t.identifier===stick.id){
setMove(t.clientX-stick.cx,t.clientY-stick.cy);
} else if(t.identifier===look.id&&player.alive){
const s=0.0052*SETTINGS.sens*(player.ads?0.5:1);
player.yaw-=(t.clientX-look.lx)*s;
player.pitch-=(t.clientY-look.ly)*s;
player.pitch=clamp(player.pitch,-1.45,1.45);
player.mouseDX=(t.clientX-look.lx)*2.2;
player.mouseDY=(t.clientY-look.ly)*2.2;
look.lx=t.clientX; look.ly=t.clientY;
}
}
if(e.cancelable) e.preventDefault();
},{passive:false});
const endTouch=e=>{
for(const t of e.changedTouches){
if(t.identifier===stick.id){ stick.id=-1; resetMove(); homeStick(); }
if(t.identifier===look.id){ look.id=-1; }
}
};
document.addEventListener('touchend',endTouch);
document.addEventListener('touchcancel',endTouch);
const bindBtn=(id,down,up)=>{
const b=el(id);
b.addEventListener('touchstart',e=>{ e.preventDefault(); e.stopPropagation(); AudioSys.resume(); down&&down(); },{passive:false});
b.addEventListener('touchend',e=>{ e.preventDefault(); e.stopPropagation(); up&&up(); },{passive:false});
};
const kd=c=>dispatchEvent(new KeyboardEvent('keydown',{code:c}));
const ku=c=>dispatchEvent(new KeyboardEvent('keyup',{code:c}));
bindBtn('tFire',()=>{ mouseDown=true; },()=>{ mouseDown=false; });
bindBtn('tFire2',()=>{ mouseDown=true; },()=>{ mouseDown=false; });
bindBtn('tAds',()=>{
mouse2Down=true;
if(player.alive&&!player.loiter&&!player.onMG&&!player.onVehicle&&!player.onAT&&!player.onAA&&!player.onMortar) player.ads=true;
},()=>{ mouse2Down=false; player.ads=false; });
bindBtn('tJump',()=>{ keys.Space=true; },()=>{ keys.Space=false; });
bindBtn('tCrouch',()=>kd('KeyC'),()=>ku('KeyC'));
bindBtn('tProne',()=>kd('KeyZ'),()=>ku('KeyZ'));
bindBtn('tReload',()=>kd('KeyR'),()=>ku('KeyR'));
bindBtn('tNade',()=>kd('KeyG'),()=>ku('KeyG'));
bindBtn('tHeal',()=>kd('KeyH'),()=>ku('KeyH'));
bindBtn('tUse',()=>kd('KeyF'),()=>ku('KeyF'));
bindBtn('tSwap',()=>{ kd(player.curSlot===0?'Digit2':'Digit1'); },()=>{ ku('Digit1'); ku('Digit2'); });
bindBtn('tSprint',()=>{
sprintLock=!sprintLock;
keys.ShiftLeft=sprintLock;
el('tSprint').classList.toggle('on',sprintLock);
},null);
bindBtn('tSkill',()=>kd('KeyB'),()=>ku('KeyB'));
bindBtn('tBuild5',()=>kd('Digit5'),()=>ku('Digit5'));
bindBtn('tMelee',()=>kd('KeyV'),()=>ku('KeyV'));
	bindBtn('tSmoke',()=>kd('Digit4'),()=>ku('Digit4'));
	bindBtn('tIncin',()=>kd('Digit6'),()=>ku('Digit6'));
	bindBtn('tATN',()=>kd('Digit3'),()=>ku('Digit3'));
bindBtn('tSquad',()=>kd('KeyT'),()=>ku('KeyT'));
bindBtn('tFollow',()=>kd('KeyY'),()=>ku('KeyY'));
bindBtn('tScore',()=>{
const sb=el('scoreboard');
const on=sb.style.display!=='block';
sb.style.display=on?'block':'none';
if(on) updateScoreboard();
},null);
bindBtn('tMenu',()=>{
if(player.deployed&&!matchOver) showDeploy(false);
},null);
// 按兵种/装备动态显示技能按键
window.updateTouchVis=function(){
const base=player.alive&&player.deployed;
const noMount=!player.onVehicle&&!player.onMG&&!player.onAT&&!player.onAA&&!player.onMortar;
const show=(id,on)=>{ const b=el(id); if(b&&b.style.display!==(on?'flex':'none')) b.style.display=on?'flex':'none'; };
show('tSkill',base&&noMount&&(player.cls===4||player.cls===6||player.cls===7));
el('tSkill').textContent=player.cls===7?'建造':player.cls===6?'迫击炮':'医疗箱';
show('tBuild5',base&&noMount&&player.cls===7);
show('tMelee',base&&noMount);
	show('tSmoke',base&&noMount&&(player.smokeCount||0)>0);
	show('tIncin',base&&noMount&&(player.incinCount||0)>0);
	show('tATN',base&&noMount&&(player.atNades||0)>0);
show('tSquad',base);
show('tFollow',base);
};
resetMove();
homeStick();
applyTouchScale();
addEventListener('resize',homeStick);
}

applyQuality();
document.body.classList.add('inMenu'); // 菜单/结算期间隐藏战斗 HUD (航拍动态不叠游戏 UI)
initMenuUI();
loop();
