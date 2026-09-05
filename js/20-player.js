// ─────────────────────────────────────────────
// 20-player.js —— 降落伞/交互/玩家控制/相机
// 源: Index.original.html 第 7077-7817 行
// 2026-08-24 切分: 座驾/工事操作 → 20a-seats.js (原第388-609行)
// ─────────────────────────────────────────────
'use strict';
// ===== 降落伞模型 (玩家跳伞 / Bot 空降) =====
let playerChuteMesh=null;
function chuteLine(g,from,to,mat){
const d=V3(to.x-from.x,to.y-from.y,to.z-from.z);
const len=d.length();
if(len<0.01) return;
const m=new THREE.Mesh(new THREE.CylinderGeometry(0.013,0.013,len,3),mat);
m.position.set(from.x+d.x*0.5,from.y+d.y*0.5,from.z+d.z*0.5);
m.quaternion.setFromUnitVectors(V3(0,1,0),d.normalize());
g.add(m);
}
function mkChute(scale=1){
const g=new THREE.Group();
const mat=new THREE.MeshLambertMaterial({color:0x9aa08c,side:THREE.DoubleSide});
const canopy=new THREE.Mesh(new THREE.SphereGeometry(2.3,12,7,0,TAU,0,1.05),mat);
canopy.scale.set(1,0.75,1);
canopy.castShadow=true;
g.add(canopy);
const lm=new THREE.MeshBasicMaterial({color:0x33352c});
const rim=2.3*Math.sin(1.05), rimY=2.3*Math.cos(1.05)*0.75;
for(const a of [0.4,1.97,3.54,5.11]){
chuteLine(g,V3(Math.sin(a)*rim,rimY-0.1,Math.cos(a)*rim),V3(0,-3.3,0),lm);
}
g.scale.setScalar(scale);
return g;
}
function mkChuteForBot(){ return mkChute(0.78); }
// 固定火力点使用前摇 (2026-09-02 用户指定): 按F后需原地操作 EM_CAST_DUR 秒才上机, 移动/再按F/受伤取消
function mountMG(mg){
player.onMG=mg; mg.user=player;
player.pos.x=mg.x-Math.sin(mg.face)*0.85;
player.pos.z=mg.z-Math.cos(mg.face)*0.85;
player.yaw=mg.face+Math.PI; player.pitch=0; player.ads=false;
VM.root.visible=false;
document.getElementById('heatWrap').style.display='block';
}
function mountAT(g){
player.onAT=g; g.user=player;
player.pos.x=g.x-Math.sin(g.face)*AT_CREW_DIST; // 站位单源常量 (00-config)
player.pos.z=g.z-Math.cos(g.face)*AT_CREW_DIST;
player.yaw=g.face+Math.PI; player.pitch=0; player.ads=false;
VM.root.visible=false;
document.getElementById('heatWrap').style.display='block';
}
function mountAA(g){
player.onAA=g; g.user=player;
player.pos.x=g.x; player.pos.z=g.z-0.9;
player.pitch=0.5; player.ads=false;
VM.root.visible=false;
document.getElementById('heatWrap').style.display='block';
}
function mountMortar(m){
player.onMortar=m; m.user=player;
VM.root.visible=false;
document.getElementById('heatWrap').style.display='block';
showScorePop('迫击炮瞄准中');
}
function tryInteract(){
if(!player.alive||player.loiter) return;
if(player.spectator) return; // 观战: 不使用载具/阵位/补给 (自由观察专用)
if(player.onVehicle){
const t=player.onVehicle;
if(t.kind==='plane'){
// 跳伞
t.playerDriven=false;
player.onVehicle=null;
player.pos.set(t.pos.x,t.pos.y-2.5,t.pos.z);
player.vel.set(t.fwdDir().x*6,0,t.fwdDir().z*6);
player.chute=true;
player.onGround=false;
if(!playerChuteMesh){ playerChuteMesh=mkChute(); scene.add(playerChuteMesh); }
VM.root.visible=true;
document.getElementById('heatWrap').style.display='none';
showScorePop('跳伞!');
return;
}
t.playerDriven=false; t.isAI=true; t.vel=0;
player.onVehicle=null;
for(const off of [[3.2,0],[-3.2,0],[0,4],[0,-4],[4,4]]){
const px=t.pos.x+off[0], pz=t.pos.z+off[1];
if(!occBlocked(px,pz)){ player.pos.set(px,0,pz); break; }
player.pos.set(t.pos.x+3.2,0,t.pos.z);
}
player.pos.y=standHeight(player.pos.x,player.pos.z,t.pos.y+2);
player.vel.set(0,0,0);
VM.root.visible=true;
document.getElementById('heatWrap').style.display='none';
return;
}
if(player.onMG){
releaseEmpl(player.onMG,true); player.onMG=null; // 下炮: 触发上炮冷却
VM.root.visible=true;
document.getElementById('heatWrap').style.display='none';
return;
}
if(player.onAT){ releaseEmpl(player.onAT,true); player.onAT=null; VM.root.visible=true; document.getElementById('heatWrap').style.display='none'; return; }
if(player.onAA){ releaseEmpl(player.onAA,true); player.onAA=null; VM.root.visible=true; document.getElementById('heatWrap').style.display='none'; return; }
// 迫击炮: 上炮/下炮 (架设后所有人可用, 回收=迫击炮手按B)
if(player.onMortar){
const m3=player.onMortar;
releaseEmpl(m3,true); player.onMortar=null; VM.root.visible=true;
document.getElementById('heatWrap').style.display='none';
return;
}
// 使用前摇进行中再按F: 取消上机 (释放占位, 不触发上炮冷却)
if(player.useCast){
const ug=player.useCast.g;
if(ug&&ug.user===player) ug.user=null;
player.useCast=null;
showScorePop('使用已取消');
return;
}
{
const m2=MORTARS.find(m=>m.alive&&empReady(m)&&Math.hypot(m.x-player.pos.x,m.z-player.pos.z)<2.8);
if(m2){
m2.user=player; // 前摇占位: 一门炮同一时刻只允许一个操作者(玩家/Bot同规)
player.useCast={kind:'mortar',g:m2,t:0,dur:EM_CAST_DUR};
AudioSys.click(700,0.25,0.05);
showScorePop('操作迫击炮…保持不动 (移动取消)');
return;
}
}
for(const t of tanks){
if(!t.alive||t.team!==player.team) continue;
if(Math.hypot(t.pos.x-player.pos.x,t.pos.z-player.pos.z)<4.5){
if(t.crewBot){ t.crewBot.dismountVehicle(false); showScorePop('你接管了坦克'); }
t.playerDriven=true; t.isAI=false; t.vel=0;
player.onVehicle=t;
player.ads=false; player.nadeHeld=false;
player.yaw=t.yaw+t.turretYaw+Math.PI; player.pitch=0;
VM.root.visible=false;
document.getElementById('heatWrap').style.display='block';
return;
}
}
for(const mg of MG42S){
if(!empReady(mg)) continue;
if(Math.hypot(mg.x-player.pos.x,mg.z-player.pos.z)<2.6){
mg.user=player;
player.useCast={kind:'mg',g:mg,t:0,dur:EM_CAST_DUR};
AudioSys.click(700,0.25,0.05);
showScorePop('操作机枪…保持不动 (移动取消)');
return;
}
}
for(const g of ATGUNS){
if(!empReady(g)) continue;
if(Math.hypot(g.x-player.pos.x,g.z-player.pos.z)<3){
g.user=player;
player.useCast={kind:'at',g,t:0,dur:EM_CAST_DUR};
AudioSys.click(700,0.25,0.05);
showScorePop('操作反坦克炮…保持不动 (移动取消)');
return;
}
}
for(const g of AAGUNS){
if(!empReady(g)) continue;
if(Math.hypot(g.x-player.pos.x,g.z-player.pos.z)<3){
g.user=player;
player.useCast={kind:'aa',g,t:0,dur:EM_CAST_DUR};
AudioSys.click(700,0.25,0.05);
showScorePop('操作防空炮…保持不动 (移动取消)');
return;
}
}
if(player.resupplyCd<=0){
for(const ac of AMMO_CRATES){
if(Math.hypot(ac.x-player.pos.x,ac.z-player.pos.z)<2.6){
player.grabAction={kind:'ammo',crate:ac};
VM.state='grab'; VM.stateT=0; VM.stateDur=0.85; vmSndFlags={};
document.getElementById('interact').style.display='none';
return;
}
}
// 劫道模式: 护运玩家唯一的补给=存活运输车 (贴车 3.6m 内全补给)
if(GAMEMODE==='convoy'&&CAMPAIGN.convoy.escortTeam===player.team){
for(const t of trucks){
if(!t.alive||t.escaped) continue;
if(Math.hypot(t.pos.x-player.pos.x,t.pos.z-player.pos.z)<3.6&&Math.abs(t.pos.y-player.pos.y)<3){
player.grabAction={kind:'truck',crate:t};
VM.state='grab'; VM.stateT=0; VM.stateDur=0.85; vmSndFlags={};
document.getElementById('interact').style.display='none';
return;
}
}
}
// 劫道方临时补给点 (限时失效): team0 玩家专用
if(player.team===0){
for(const sp of SUPPLY_POINTS){
if(Math.hypot(sp.x-player.pos.x,sp.z-player.pos.z)<2.8){
player.grabAction={kind:'supply',crate:sp};
VM.state='grab'; VM.stateT=0; VM.stateDur=0.85; vmSndFlags={};
document.getElementById('interact').style.display='none';
return;
}
}
}
}
if(player.bandResupCd<=0&&player.bandages<player.maxBandages){
for(const c of MED_CRATES){
if(c.team!==player.team||c.uses<=0) continue;
if(Math.hypot(c.x-player.pos.x,c.z-player.pos.z)<2.6){
player.grabAction={kind:'medcrate',crate:c};
VM.state='grab'; VM.stateT=0; VM.stateDur=0.85; vmSndFlags={};
document.getElementById('interact').style.display='none';
return;
}
}
}
}
let camTrauma=0, dmgFlash=0;
function addDmgFlash(x){ dmgFlash=Math.min(1,dmgFlash+x); } // owner 接口 (2026-09-06 B7b/P2-14: 15-vehicles 跨文件写改经此)
function addTrauma(x){ camTrauma=Math.min(1.2,camTrauma+x); }
// 严寒 HUD (#coldTip): 文案变化才写 DOM (状态键比较), 离开露天/进屋即隐藏
function coldHudShow(line){
const elm=document.getElementById('coldTip');
if(!elm) return;
if(elm._line!==line){ elm._line=line; elm.innerHTML=line; elm.style.display='block'; }
}
function coldHudHide(){
const elm=document.getElementById('coldTip');
if(elm&&elm._line){ elm._line=null; elm.style.display='none'; }
}
// 观战飞行双模式 (2026-09-01 用户指定, 两者是不同东西):
//  创造悬停(flyAero=false): MC创造式 —— 无重力可悬停, WASD水平 + 空格升/Shift降, 松键缓停
//  气动飞行(flyAero=true):  复用巡飞弹飞行动作 —— 始终沿视线方向前飞不可停, 右键加速(13→40m/s), 俯冲触地落地
function specFlightMove(p,dt){
if(p.flyAero){
const cp=Math.cos(p.pitch), sp=Math.sin(p.pitch);
const dirx=-Math.sin(p.yaw)*cp, diry=sp, dirz=-Math.cos(p.yaw)*cp;
const spd=dampF(p._aeroSpd||13,(mouse2Down?40:13),2.2,dt); // 速度数值与巡飞弹同一组
p._aeroSpd=spd;
p.vel.set(dirx*spd,diry*spd,dirz*spd);
p.pos.x+=p.vel.x*dt; p.pos.y+=p.vel.y*dt; p.pos.z+=p.vel.z*dt;
collideMove(p.pos,0.42);
const gh=standHeight(p.pos.x,p.pos.z,p.pos.y+0.6);
if(p.pos.y<gh){
p.pos.y=gh;
if(p.vel.y<-0.5){ specLand(p); return; } // 俯冲触地: 切回行走
}
}else{
const sy=Math.sin(p.yaw), cy=Math.cos(p.yaw);
const fwd=(keys.KeyW?1:0)-(keys.KeyS?1:0), str=(keys.KeyD?1:0)-(keys.KeyA?1:0);
let tx=-sy*fwd+cy*str, ty=0, tz=-cy*fwd-sy*str;
if(keys.Space) ty+=1;
if(keys.ShiftLeft) ty-=1;
const tl=Math.hypot(tx,ty,tz);
if(tl>0.01){ tx/=tl; ty/=tl; tz/=tl; }
p.vel.x=dampF(p.vel.x,tx*13,3,dt);
p.vel.y=dampF(p.vel.y,ty*11,3,dt);
p.vel.z=dampF(p.vel.z,tz*13,3,dt);
p.pos.x+=p.vel.x*dt; p.pos.y+=p.vel.y*dt; p.pos.z+=p.vel.z*dt;
collideMove(p.pos,0.42);
const gh=standHeight(p.pos.x,p.pos.z,p.pos.y+0.6);
if((p._flyT||0)>0.3&&p.pos.y<=gh+0.05){ specLand(p); return; } // 悬停降落: 落地即切回行走
}
if(p.pos.y>135){ p.pos.y=135; p.vel.y=Math.min(0,p.vel.y); } // 升限: 防止飞出战场
p._flyT=(p._flyT||0)+dt;
}
function specLand(p){
p.pos.y=standHeight(p.pos.x,p.pos.z,p.pos.y+0.6);
p.vel.set(0,0,0);
p.flying=false; p.flyAero=false; p._aeroSpd=0; p.onGround=true;
AudioSys.footstep(true,0);
showScorePop('落地 · 行走状态');
}
// 摔落伤害: 落地瞬间按竖直冲击速度线性结算 (2026-09-02 用户指定); 河道/水面缓冲免伤, 观战免伤由 damage() 兜底
function fallDamage(p){
if(p.vel.y>=-FALL_SAFE_V||inRiverChannel(p.pos.x,p.pos.z)) return;
const dmg=(-p.vel.y-FALL_SAFE_V)*FALL_DMG_MUL;
p.damage(dmg,null,false);
showScorePop('⚠ 摔落 -'+Math.round(dmg));
}
function updatePlayer(dt){
if(!player.alive){ return; }
const p=player;
p.meleeCd-=dt; p.resupplyCd-=dt;
p.bandResupCd=Math.max(0,(p.bandResupCd||0)-dt);
p.suppressV=Math.max(0,p.suppressV-dt*0.8);
// 固定火力点使用前摇: 移动打断, 计时满上机 (目标被夺则提示)
if(p.useCast){
const uc=p.useCast;
if(keys.KeyW||keys.KeyA||keys.KeyS||keys.KeyD||keys.Space||p.flying){
if(uc.g&&uc.g.user===p) uc.g.user=null;
p.useCast=null;
showScorePop('移动打断');
}else{
uc.t+=dt;
if(uc.t>=uc.dur){
const g2=uc.g;
p.useCast=null;
if(uc.kind==='mg'&&g2.user===p) mountMG(g2);
else if(uc.kind==='at'&&g2.user===p) mountAT(g2);
else if(uc.kind==='aa'&&g2.user===p) mountAA(g2);
else if(uc.kind==='mortar'&&g2.alive&&g2.user===p) mountMortar(g2);
else{ if(g2&&g2.user===p) g2.user=null; showScorePop('目标已被占用'); }
}
}
}
// 呼吸回血(削弱): 仅能自然恢复到70, 满血需绷带
if(nowT-p.lastDmgT>6&&p.hp<70) p.hp=Math.min(70,p.hp+4*dt);
// 绷带包扎
if(p.bandaging>0){
p.bandaging-=dt;
if(p.bandaging<=0){
p.bandages--;
p.hp=Math.min(100,p.hp+BANDAGE_HEAL);
showScorePop('包扎完成 +45');
AudioSys.click(1200,0.3,0.06);
}
}
// TV制导中: 视角切至巡飞弹, 左键提前引爆; 本体物理照常模拟 (跳跃中发射也会正常落地)
if(p.loiter){
if(mouseDown&&!p._ltClick){ p._ltClick=true; if(p.loiter) loiterDetonate(p.loiter,p.loiter.pos.clone()); }
if(!mouseDown) p._ltClick=false;
if(!mouse2Down) p._ltRClick=false;
// 观战飞行中引导巡飞弹: 本体保持飞行机动 (视角同时舵控TV弹), 无重力
if(p.spectator&&p.flying){ specFlightMove(p,dt); updateInteractHint(); return; }
p.vel.x=dampF(p.vel.x,0,8,dt);
p.vel.z=dampF(p.vel.z,0,8,dt);
p.vel.y-=13*dt;
if(p.chute&&p.vel.y<-3.2) p.vel.y=-3.2;
p.pos.x+=p.vel.x*dt; p.pos.y+=p.vel.y*dt; p.pos.z+=p.vel.z*dt;
collideMove(p.pos,0.42);
const gh=standHeight(p.pos.x,p.pos.z,p.pos.y+0.6);
if(p.pos.y<=gh){
if(!p.onGround&&p.vel.y<-4){ p.landDip=Math.min(1,-p.vel.y*0.1); AudioSys.footstep(true,0); }
if(!p.onGround) fallDamage(p);
p.pos.y=gh; p.vel.y=0; p.onGround=true;
if(p.chute) p.chute=false;
} else if(p.pos.y>gh+0.05) p.onGround=false;
p.landDip=Math.max(0,p.landDip-dt*3);
if(p.chute){
if(!playerChuteMesh){ playerChuteMesh=mkChute(); scene.add(playerChuteMesh); }
playerChuteMesh.position.set(p.pos.x,p.pos.y+3.8,p.pos.z);
playerChuteMesh.rotation.set(Math.sin(nowT*0.7)*0.12,0,Math.cos(nowT*0.6)*0.08);
} else if(playerChuteMesh){ scene.remove(playerChuteMesh); playerChuteMesh=null; }
updateInteractHint();
return;
}
p.recoilPitch*=Math.pow(0.0001,dt*0.7);
p.recoilYaw*=Math.pow(0.0001,dt*0.7);
p.recoilPitch=clamp(p.recoilPitch,-0.2,0.2);
// 架枪检测: 胸前有齐腰遮挡且头顶上方无遮挡 (架枪时沿架设方向检测, 避免转头就脱离)
p.canBrace=false;
if(p.onGround&&!p.prone&&!p.onVehicle&&!p.onMG&&!p.onAT&&!p.onAA&&Math.hypot(p.vel.x,p.vel.z)<0.8){
const bd=p.braced?V3(-Math.sin(p.braceYaw),0,-Math.cos(p.braceYaw)):camForward(); bd.y=0;
if(bd.lengthSq()>0.1){
bd.normalize();
const chestY=p.pos.y+(p.crouch?0.72:1.05);
const hit=raycastWorld(V3(p.pos.x,chestY,p.pos.z),bd,1.15);
if(hit&&hit.kind!=='ground'){
const over=raycastWorld(V3(p.pos.x,chestY+0.55,p.pos.z),bd,1.3);
if(!over) p.canBrace=true;
}
}
}
if(p.braced&&(!p.canBrace||!p.onGround||p.prone)) p.braced=false;
// 架枪状态: 以支点为轴, 视角限制在架设方向左右一定范围内
if(p.braced){
const rel=clamp(angDiff(p.braceYaw,p.yaw),-0.72,0.72);
p.yaw=p.braceYaw+rel;
p.pitch=clamp(p.pitch,-0.5,0.42);
}
if(p.onVehicle){ if(p.onVehicle.kind==='plane') updatePlayerPlane(dt); else updatePlayerTank(dt); return; }
if(p.onAT){ updatePlayerAT(dt); return; }
if(p.onAA){ updatePlayerAA(dt); return; }
if(p.onMG){ updatePlayerMG(dt); return; }
if(p.onMortar){ updatePlayerMortar(dt); return; }
// 观战模式: 弹药/物资每0.5s回满 (无限补给) + 创造飞行分支 —— 2026-09-01 用户指定
if(p.spectator){
if(!p._specSupT||nowT-p._specSupT>0.5){
p._specSupT=nowT;
for(const s of p.slots){ s.mag=s.def.mag; s.reserve=s.def.reserve; }
const g2=clsGear(p.cls,p.team);
p.nadeCount=g2.nades; p.atNades=g2.atn; p.smokeCount=g2.smoke; p.incinCount=g2.incin;
p.bandages=p.maxBandages;
}
if(p.flying){ specFlightMove(p,dt); updateInteractHint(); return; }
}
const fwd=(keys.KeyW?1:0)-(keys.KeyS?1:0);
const str=(keys.KeyD?1:0)-(keys.KeyA?1:0);
if(p.pendingBuild&&VM.state==='build'&&(fwd!==0||str!==0||keys.Space)){ cancelBuild(p); showScorePop('建造已取消'); }
const wantSprint=keys.ShiftLeft&&fwd>0&&!p.ads&&p.stamina>0.05&&!p.crouch&&p.bandaging<=0;
if(wantSprint&&p.prone) p.prone=false;
if(wantSprint) p.braced=false;
p.sprinting=wantSprint;
p.holdBreath=keys.ShiftLeft&&p.ads;
let leanTgt=0;
if(!p.sprinting&&!p.prone&&p.onGround&&!p.braced){ leanTgt=(keys.KeyQ?-1:0)+(keys.KeyE?1:0); }
p.leanT=dampF(p.leanT,leanTgt,10,dt);
if(p.spectator) p.stamina=1; // 观战: 无限体力 —— 冲刺/屏息/跳跃均不消耗 (2026-09-02 用户指定)
else if(p.sprinting){ p.stamina=Math.max(0,p.stamina-dt*0.22/STAM_SPRINT_MUL); p.stamUseT=nowT; }
else if(p.holdBreath){ p.stamina=Math.max(0,p.stamina-dt*0.3); p.stamUseT=nowT; }
else if(nowT-(p.stamUseT||0)>1) p.stamina=Math.min(1,p.stamina+dt*0.16);
if(p.holdBreath&&p.stamina<=0.02) p.holdBreath=false;
let speed=p.prone?1.15:p.crouch?2.2:(p.sprinting?6.4:4.3);
if(p.ads) speed*=0.55;
if(p.bandaging>0) speed*=0.45;
if(VM.state==='reload') speed*=0.8;
if(nowT-(p.wireT||-9)<0.3) speed*=0.42;
// 深谷激流: 徒涉大龙河严重减速
if(inRiverChannel(p.pos.x,p.pos.z)) speed*=0.38;
const sy=Math.sin(p.yaw), cy=Math.cos(p.yaw);
let mx=(-sy*fwd + cy*str), mz=(-cy*fwd - sy*str);
const ml=Math.hypot(mx,mz);
if(ml>0.01){ mx/=ml; mz/=ml; }
if(p.braced&&(fwd!==0||str!==0)){ p.braced=false; AudioSys.metalSlide(0.16,0.07,500,900); }
if(p.braced){ mx=0; mz=0; }
const accel=p.onGround?38:6;
p.vel.x=dampF(p.vel.x,mx*speed,accel*dt>1?12:accel,dt);
p.vel.z=dampF(p.vel.z,mz*speed,accel*dt>1?12:accel,dt);
if(keys.Space&&p.onGround&&p.stamina>0.1){ p.vel.y=4.6; p.onGround=false; p.stamina-=0.08; p.stamUseT=nowT; p.crouch=false; p.prone=false; p.braced=false; }
p.vel.y-=13*dt;
if(p.chute){
if(p.vel.y<-3.2) p.vel.y=-3.2;
if(p.onGround) p.chute=false;
// 降落伞模型: 头上打开圆顶+系绳
if(!playerChuteMesh){ playerChuteMesh=mkChute(); scene.add(playerChuteMesh); }
playerChuteMesh.position.set(p.pos.x,p.pos.y+3.8,p.pos.z);
playerChuteMesh.rotation.set(Math.sin(nowT*0.7)*0.12,0,Math.cos(nowT*0.6)*0.08);
} else if(playerChuteMesh){ scene.remove(playerChuteMesh); playerChuteMesh=null; }
p.pos.x+=p.vel.x*dt; p.pos.y+=p.vel.y*dt; p.pos.z+=p.vel.z*dt;
collideMove(p.pos,0.42);
const gh=standHeight(p.pos.x,p.pos.z,p.pos.y+0.6);
if(p.pos.y<=gh){
if(!p.onGround&&p.vel.y<-4){ p.landDip=Math.min(1,-p.vel.y*0.1); AudioSys.footstep(true,0); }
if(!p.onGround) fallDamage(p);
p.pos.y=gh; p.vel.y=0; p.onGround=true;
} else if(p.pos.y>gh+0.05) p.onGround=false;
p.landDip=Math.max(0,p.landDip-dt*3);
// 激流: 持续受创并被冲向下游 (桥面不受影响)
if(inRiverChannel(p.pos.x,p.pos.z)){
p.damage(RAPIDS_DMG*dt,null,false);
const rd=riverDirAt(p.pos.x,p.pos.z);
if(rd){ p.pos.x+=rd[0]*1.5*dt; p.pos.z+=rd[1]*1.5*dt; }
if(nowT-(p._rapidsHintT||-9)>2.5){ p._rapidsHintT=nowT; showScorePop('⚠ 雨季激流! 快离开河道或上桥'); }
}
const sp2=Math.hypot(p.vel.x,p.vel.z);
p.stepT=(p.stepT||0)-dt*sp2*(p.sprinting?1.25:1);
if(p.stepT<=0&&sp2>0.8&&p.onGround){ p.stepT=1.55; AudioSys.footstep(p.sprinting,0); }
const w=p.curW;
p.fireT-=dt;
p.bloom=Math.max(0,p.bloom-dt*4);
if(mouseDown&&w&&VM.state==='idle'&&p.fireT<=0&&!matchOver&&!p.sprinting&&p.bandaging<=0){
if(w.mag>0){
if(w.def.type==='auto'||!p.fireHeld){
playerShoot(w);
}
} else {
if(!p.fireHeld){ AudioSys.click(2600,0.2,0.03); tryReload(); }
}
p.fireHeld=true;
}
if(!mouseDown) p.fireHeld=false;
if(p.nadeHeld){
p.nadeFuse-=dt;
if(p.nadeFuse<=0){
p.nadeHeld=false;
p.nadeCount--;
VM.state='idle'; VM.gunParts.gun.visible=true; VM.nadeM.visible=false;
explodeAt(p.pos.clone().add(V3(0,1,0)),p);
}
}
// ── 严寒失温 (2026-09-05 城市组·斯大林格勒, 严厉版): 露天静止 COLD_OFF 秒起每秒 COLD_DMG (可冻死);
//    移动/进建筑(头顶有遮蔽)/载具/固定火力位/跳伞/巡飞弹制导 即中断 —— Bot 同判定 (一视同仁) ──
if(CAMPAIGN.cold&&!p.spectator){
const coldMoved=Math.hypot(p.vel.x,p.vel.z)>0.6;
const coldBusy=p.onVehicle||p.onMG||p.onAT||p.onAA||p.onMortar||p.chute||p.flying||p.loiter||p.useCast;
if(coldMoved||coldBusy||coldSheltered(p.pos.x,p.pos.y,p.pos.z)){
coldHudHide();
p._coldT=0; p._coldAcc=0;
}else{
p._coldT=(p._coldT||0)+dt;
if(p._coldT>COLD_OFF-8) coldHudShow(`❄ 严寒 · 露天静止 ${Math.min(COLD_OFF,Math.ceil(p._coldT))}/${COLD_OFF}s — 移动或进入建筑`);
if(p._coldT>COLD_OFF){
p._coldAcc=(p._coldAcc||0)+COLD_DMG*dt;
if(p._coldAcc>=1){ const d=Math.floor(p._coldAcc); p._coldAcc-=d; p.damage(d,null,false); }
coldHudShow('❄ <b>失温中</b> -'+COLD_DMG+'/秒 · 快移动或进屋!');
}
}
}
updateInteractHint();
}
function playerShoot(w){
const p=player;
w.mag--;
// 巡飞弹不挂普通射速CD(rpm10→6秒): 装填动画+实际飞行就是间隔,
// 否则换弹完毕后还要干等到火控计时结束才能再射
p.fireT=w.def.loiter?0:60/w.def.rpm;
const dir=camForward();
if(w.def.mortar){
// 迫击炮: 高抛曲射
vmFireKick(); addTrauma(0.3);
AudioSys.mortarThunk(0);
const v=dir.clone().multiplyScalar(27);
v.y=Math.max(v.y+9,13);
v.addScaledVector(p.vel,0.3);
const m=new THREE.Mesh(nadeGeoAT,vmMats.gun);
m.castShadow=true; m.position.copy(camera.position); scene.add(m);
nades.push({m,pos:camera.position.clone().addScaledVector(dir,0.7),vel:v,fuse:9,thrower:p,team:p.team,spin:V3(4,0,1),bounces:0,mortar:true});
spawnP(PT.dark,camera.position.x+dir.x,camera.position.y+dir.y,camera.position.z+dir.z,dir.x,1.5,dir.z,0.6,2,0.7,0.6,0.3);
return;
}
if(w.def.loiter){
// 巡飞弹: 发射后进入TV制导视角, 装填延迟到引爆之后
vmFireKick(); addTrauma(0.45);
spawnP(PT.flash,camera.position.x+dir.x,camera.position.y+dir.y,camera.position.z+dir.z, dir.x*2,dir.y*2,dir.z*2, 0.7,7,0.1,1,0,true);
spawnP(PT.dark,camera.position.x+dir.x,camera.position.y+dir.y,camera.position.z+dir.z, dir.x*2,1.5,dir.z*2, 0.9,2.4,0.9,0.7,0.5);
fireLoiter(p,camera.position.clone().addScaledVector(dir,0.9),dir);
return;
}
if(w.def.rocket){
const sp=w.def.spreadAds*(Math.PI/180)*0.5;
const rv=camRight(), uv=rv.clone().cross(dir).negate();
dir.addScaledVector(rv,rand(-sp,sp)).addScaledVector(uv,rand(-sp,sp)).normalize();
vmFireKick(); addTrauma(0.4);
fireRocket(p,camera.position.clone(),dir,w.def,V3());
return;
}
const adsB=VM.adsBlend;
let spread=lerp(w.def.spreadHip,w.def.spreadAds,adsB)*(Math.PI/180)*0.5;
spread*=(1+p.bloom*1.4)*(p.prone?0.5:p.crouch?0.8:1)*(p.onGround?1:2.2)*(Math.hypot(p.vel.x,p.vel.z)>1?1.4:1);
if(p.holdBreath) spread*=0.4;
if(p.braced) spread*=0.35;
const rv=camRight(), uv=rv.clone().cross(dir).negate();
dir.addScaledVector(rv,rand(-spread,spread)).addScaledVector(uv,rand(-spread,spread)).normalize();
p.bloom=Math.min(1,p.bloom+0.16);
const rec=w.def.recoil*0.011*(p.prone?0.68:p.crouch?0.85:1)*(adsB>0.5?0.85:1)*(p.braced?0.45:1);
p.recoilPitch+=rec;
p.recoilYaw+=rand(-1,1)*w.def.recSide*0.006;
p.pitch+=rec*0.55;
p.yaw+=rand(-1,1)*w.def.recSide*0.003;
vmFireKick();
addTrauma(w.def.kick*0.9);
AudioSys.gunshot(w.def.snd,0,0);
const o=camera.position.clone();
p._src=w.def.name||''; // 击杀来源: 当前武器名
fireBullet(p,o,dir,w.def,null);
if(!w.def.enbloc||w.mag>0){
const cp=camera.position.clone().add(camForward().multiplyScalar(0.35)).add(camRight().multiplyScalar(0.14)).add(V3(0,-0.05,0));
if(w.def.type!=='bolt') spawnCasing(cp,camRight(),V3(0,1,0));
}
if(w.def.enbloc&&w.mag===0){
setTimeout(()=>AudioSys.ping(),80);
const clipP=camera.position.clone().add(camForward().multiplyScalar(0.4));
spawnCasing(clipP,camRight(),V3(0,1.5,0));
}
if(w.def.type==='bolt'&&w.mag>0){
VM.state='bolt'; VM.stateT=0; VM.stateDur=w.def.boltT||1.0;
vmSndFlags={};
}
if(w.mag===0&&w.def.type!=='bolt'){ setTimeout(tryReload,350); }
else if(w.mag===0){ setTimeout(tryReload,1000); }
}
function updateInteractHint(){
// 2026-09-06 B6/P2-25: 10Hz 节流 (状态签名瞬变时旁路立即刷新 —— 上下载具/阵位/阵亡/观战切换不受节流影响)
const sig=(player.onVehicle?1:0)|(player.onMG?2:0)|(player.onMortar?4:0)|(player.onAT?8:0)|(player.onAA?16:0)|(player.spectator?32:0)|(player.alive?64:0)|(player.useCast?128:0);
if(sig===updateInteractHint._sig&&nowT-updateInteractHint._t<0.1) return;
updateInteractHint._sig=sig; updateInteractHint._t=nowT;
// 兵种技能常驻小提示 (右下角)
const tip=document.getElementById('clsTip');
	let tt='';
	if(player.alive&&player.deployed&&!player.onVehicle&&!player.onMG&&!player.onAT&&!player.onAA){
	if(player.loiter) tt='<b>左键</b> 自爆 · <b>右键</b> 加速 · <b>鼠标</b> 制导 · <b>F</b> 切换视角';
	else if(player.onMortar) tt='<b>左键</b> 发射 · <b>鼠标</b> 调弹道 · <b>F</b> 离开';
	else if(player.cls===4) tt='<b>B</b> 放置医疗箱';
	else if(player.cls===6) tt=player.mortarPlaced?'<b>F</b> 上炮 · <b>B</b> 靠近回收':'<b>B</b> 架设迫击炮';
	else if(isLoiterClass()) tt=player.spectator
?'观战中 · <b>双击空格</b> 悬停飞行 · <b>H</b> 气动飞行(右键加速) · <b>左键</b> TV弹制导/手动引爆 · 触地消失 · 弹药无限'
:'<b>左键</b> 发射巡飞弹(TV制导) · <b>6</b> 燃烧弹';
else if(player.cls===7){
const bt2=BUILD_MENU[player.buildSel||0];
const bn2=bt2==='mg'?mgDefOfTeam(player.team).name:BUILD_NAMES[bt2];
tt='<b>5</b> 工事: '+bn2+' ('+BUILD_COST[bt2]+'点) · <b>B</b> 建造 · 剩 '+(player.buildCount||0)+' 点';
}
}
if(tip._last!==tt){ tip._last=tt; tip.innerHTML=tt; tip.style.display=tt?'block':'none'; }
const elm=document.getElementById('interact');
if(player.spectator){ elm.style.display='none'; return; } // 观战: 隐藏载具/阵位/补给互动提示
if(player.useCast){ // 固定火力点使用前摇进度
elm.style.display='block';
elm.innerHTML='使用中… '+Math.max(0,(player.useCast.dur-player.useCast.t)).toFixed(1)+'s (移动中止)';
return;
}
if(player.onVehicle&&player.onVehicle.kind==='plane'){ elm.style.display='block'; elm.innerHTML='<b>F</b> 跳伞 · <b>W/S</b>油门 <b>A/D</b>压坡转向 <b>鼠标</b>拉杆 <b>左键</b>机枪 <b>右键/B</b>炸弹'; return; }
if(player.onVehicle){ elm.style.display='block'; elm.innerHTML='<b>F</b> 离开坦克 · <b>WASD</b>驾驶 <b>左键</b>主炮 <b>右键</b>机枪 <b>C</b>炮手镜'; return; }
if(player.onMG){ elm.style.display='block'; elm.innerHTML='<b>F</b> 离开机枪'; return; }
if(player.onMortar){ elm.style.display='block'; elm.innerHTML='<b>F</b> 离开迫击炮 · <b>左键</b> 发射 · <b>鼠标</b> 调整弹道'; return; }
if(player.onAT){ elm.style.display='block'; elm.innerHTML='<b>F</b> 离开反坦克炮'; return; }
if(player.onAA){ elm.style.display='block'; elm.innerHTML='<b>F</b> 离开防空炮'; return; }
for(const t of tanks){
if(t.alive&&t.team===player.team&&Math.hypot(t.pos.x-player.pos.x,t.pos.z-player.pos.z)<4.5){
elm.style.display='block'; elm.innerHTML='<b>F</b> '+(t.crewBot?'接管':'进入')+' '+t.name; return;
}
}
for(const mg of MG42S){
if(!mg.user&&Math.hypot(mg.x-player.pos.x,mg.z-player.pos.z)<2.6){
elm.style.display='block'; elm.innerHTML='<b>F</b> 使用 '+((mg.def&&mg.def.name)||'重机枪'); return;
}
}
for(const g of ATGUNS){
if(!g.user&&Math.hypot(g.x-player.pos.x,g.z-player.pos.z)<3){
elm.style.display='block'; elm.innerHTML='<b>F</b> 使用反坦克炮'; return;
}
}
for(const g of AAGUNS){
if(!g.user&&Math.hypot(g.x-player.pos.x,g.z-player.pos.z)<3){
elm.style.display='block'; elm.innerHTML='<b>F</b> 使用防空炮'; return;
}
}
for(const m of MORTARS){
if(!m.alive||m.user) continue;
if(Math.hypot(m.x-player.pos.x,m.z-player.pos.z)<2.8){
elm.style.display='block';
elm.innerHTML=(m.owner===player)?'<b>F</b> 使用迫击炮 · <b>B</b> 回收':'<b>F</b> 使用迫击炮';
return;
}
}
if(player.resupplyCd<=0){
for(const ac of AMMO_CRATES){
if(Math.hypot(ac.x-player.pos.x,ac.z-player.pos.z)<2.6){
elm.style.display='block'; elm.innerHTML='<b>F</b> 补充弹药'; return;
}
}
// 劫道模式: 护运玩家只能贴车补给
if(GAMEMODE==='convoy'&&CAMPAIGN.convoy.escortTeam===player.team){
for(const t of trucks){
if(!t.alive||t.escaped) continue;
if(Math.hypot(t.pos.x-player.pos.x,t.pos.z-player.pos.z)<3.6){
elm.style.display='block'; elm.innerHTML='<b>F</b> 从运输车补充补给'; return;
}
}
}
if(player.team===0){
for(const sp of SUPPLY_POINTS){
if(Math.hypot(sp.x-player.pos.x,sp.z-player.pos.z)<2.8){
elm.style.display='block'; elm.innerHTML='<b>F</b> 从临时补给点补充补给'; return;
}
}
}
}
if(player.bandResupCd<=0&&player.bandages<player.maxBandages){
for(const c of MED_CRATES){
if(c.team!==player.team||c.uses<=0) continue;
if(Math.hypot(c.x-player.pos.x,c.z-player.pos.z)<2.6){
elm.style.display='block'; elm.innerHTML='<b>F</b> 拿取绷带'; return;
}
}
}
elm.style.display='none';
}
let camBobT=0;
function updateCamera(dt){
const p=player;
		// 巡飞弹TV制导视角: 默认弹头第一视角(隐藏弹体, F 切换第三人称追尾可看到弹体)
		if(p.loiter&&p.alive){
		const d=p.loiter;
		const f=loiterForward(d);
		camera.rotation.order='YXZ';
		if(p.loiterView){
		d.mesh.visible=true;
		const back=f.clone().negate(); back.y+=0.34; back.normalize();
		let cd=6.8;
		const hit=raycastWorld(d.pos,back,cd);
		if(hit) cd=Math.max(1.6,hit.dist-0.4);
		camera.position.copy(d.pos).addScaledVector(back,cd);
		camera.lookAt(d.pos.x+f.x*12,d.pos.y+f.y*12,d.pos.z+f.z*12);
		camera.fov=dampF(camera.fov,70,8,dt);
		} else {
		d.mesh.visible=false; // 真弹头视角: 弹体不可见, 摄像机就在光学头罩处
		camera.position.copy(d.pos).addScaledVector(f,0.5).add(V3(0,0.05,0));
		camera.rotation.set(d.pitch,d.yaw,Math.sin(nowT*2.2)*0.05+Math.sin(nowT*31)*0.006);
		camera.fov=dampF(camera.fov,85,8,dt);
		}
		camera.updateProjectionMatrix();
		return;
		}
if(p.chute){
// 跳伞第三人称: 镜头后拉并微微下视, 能看到降落伞和周围环境
const trg=V3(p.pos.x,p.pos.y+0.8,p.pos.z);
const behind=V3(-Math.sin(p.yaw)*Math.cos(p.pitch),Math.sin(p.pitch)+0.3,-Math.cos(p.yaw)*Math.cos(p.pitch));
const hit=raycastWorld(trg,behind.clone().negate().normalize(),7.5);
const dd=hit?Math.max(2.8,hit.dist-0.5):6.5;
camera.position.set(trg.x+behind.x*dd, trg.y+behind.y*dd, trg.z+behind.z*dd);
camera.lookAt(trg.x,trg.y,trg.z);
camera.fov=dampF(camera.fov,68,8,dt);
camera.updateProjectionMatrix();
return;
}
if(!p.alive){
// 死亡镜头: 环绕注视布娃娃尸体约2秒
if(p.deathCamT>0){
p.deathCamT-=dt;
p.deathCamYaw+=dt*0.5;
const ragOk=p.deathRag&&RAG.list.indexOf(p.deathRag)>=0;
const tb=ragOk?p.deathRag.parts[0].body.position:p.deathPos;
if(tb){
const dirB=V3(Math.sin(p.deathCamYaw),0.5,Math.cos(p.deathCamYaw)).normalize();
const hit=raycastWorld(V3(tb.x,tb.y+0.5,tb.z),dirB,6.2);
const dd=hit?Math.max(1.4,hit.dist-0.4):5.6;
camera.position.set(tb.x+dirB.x*dd, tb.y+0.5+dirB.y*dd, tb.z+dirB.z*dd);
const gmin=heightAt(camera.position.x,camera.position.z)+0.35;
if(camera.position.y<gmin) camera.position.y=gmin;
camera.lookAt(tb.x,tb.y+0.3,tb.z);
camera.fov=dampF(camera.fov,60,5,dt);
camera.updateProjectionMatrix();
return;
}
}
const t=nowT*0.05;
camera.position.set(Math.sin(t)*80,42,Math.cos(t)*80);
camera.lookAt(0,2,0);
return;
}
if(p.onVehicle){
const t=p.onVehicle;
camTrauma=Math.max(0,camTrauma-dt*2.2);
const sh=camTrauma*camTrauma*0.04;
if(t.kind==='plane'){
// 飞机追尾视角
const fd=t.fwdDir();
const anchor=V3(t.pos.x,t.pos.y,t.pos.z);
const back=fd.clone().negate(); back.y+=0.34; back.normalize();
camera.position.copy(anchor).addScaledVector(back,13).add(V3(Math.sin(nowT*53)*sh,Math.sin(nowT*67)*sh,0));
camera.lookAt(anchor.x+fd.x*22,anchor.y+fd.y*22,anchor.z+fd.z*22);
camera.fov=dampF(camera.fov,72+t.speed*0.2,6,dt);
camera.updateProjectionMatrix();
return;
}
if(p.tankView){
// 舱内(车长)视角: 隐藏炮管防止穿模
t.pitchG.visible=false;
const a=t.yaw+t.turretYaw;
camera.rotation.order='YXZ';
camera.rotation.set(p.pitch+Math.sin(nowT*53)*sh*0.5, p.yaw+Math.sin(nowT*67)*sh*0.5, 0);
camera.position.set(t.pos.x+Math.sin(a)*1.8, t.pos.y+1.95, t.pos.z+Math.cos(a)*1.8);
camera.fov=dampF(camera.fov,30,10,dt);
camera.updateProjectionMatrix();
document.getElementById('scopeOv').style.display='block';
return;
}
document.getElementById('scopeOv').style.display='none';
if(t.pitchG) t.pitchG.visible=true;
const anchor=V3(t.pos.x,t.pos.y+2.6,t.pos.z);
camera.rotation.order='YXZ';
camera.rotation.set(p.pitch+Math.sin(nowT*53)*sh, p.yaw+Math.sin(nowT*67)*sh, 0);
const fwdV=V3(-Math.sin(p.yaw)*Math.cos(p.pitch), Math.sin(p.pitch), -Math.cos(p.yaw)*Math.cos(p.pitch));
const back=fwdV.clone().negate(); back.y+=0.35; back.normalize();
let camD=10.5;
const hit=raycastWorld(anchor,back,camD);
if(hit) camD=Math.max(2.5,hit.dist-0.5);
camera.position.copy(anchor).addScaledVector(back,camD);
camera.fov=dampF(camera.fov,68,10,dt);
camera.updateProjectionMatrix();
return;
}
const eyeTgt=p.prone?0.48:p.crouch?1.12:1.62;
p.eyeH=dampF(p.eyeH,eyeTgt,12,dt);
let ex=p.pos.x, ey=p.pos.y+p.eyeH, ez=p.pos.z;
const sp2=Math.hypot(p.vel.x,p.vel.z);
if(sp2>0.5&&p.onGround) camBobT+=dt*(p.sprinting?11:7.4)*clamp(sp2/4.2,0.4,1.5);
const bobA=clamp(sp2/4.2,0,1)*(p.ads?0.3:1)*(p.onMG?0:1);
ey+=Math.sin(camBobT*2)*0.021*bobA;
ex+=Math.cos(camBobT)*0.011*bobA*Math.cos(p.yaw);
ez+=Math.cos(camBobT)*0.011*bobA*-Math.sin(p.yaw);
ey-=p.landDip*0.16;
camera.position.set(ex,ey,ez);
camTrauma=Math.max(0,camTrauma-dt*2.2);
const sh=camTrauma*camTrauma*0.05;
const shX=(Math.sin(nowT*67)+Math.sin(nowT*41))*sh;
const shY=(Math.sin(nowT*53)+Math.sin(nowT*31))*sh;
const rollBob=Math.sin(camBobT)*0.006*bobA;
camera.rotation.set(0,0,0);
camera.rotation.order='YXZ';
camera.rotation.y=p.yaw+shY*0.5+p.recoilYaw;
camera.rotation.x=p.pitch+shX*0.5+p.recoilPitch;
camera.rotation.z=rollBob+shX*0.3-p.leanT*0.2;
// 侧身探头(防穿墙)
if(Math.abs(p.leanT)>0.02){
const rx2=Math.cos(p.yaw), rz2=-Math.sin(p.yaw);
const sgn=Math.sign(p.leanT);
let off=Math.abs(p.leanT)*0.45;
const lr=raycastWorld(V3(camera.position.x,camera.position.y,camera.position.z),V3(rx2*sgn,0,rz2*sgn),off+0.25);
if(lr) off=Math.max(0,lr.dist-0.25);
camera.position.x+=rx2*off*sgn;
camera.position.z+=rz2*off*sgn;
camera.position.y-=Math.abs(p.leanT)*0.05;
}
}
