// ─────────────────────────────────────────────
// 20a-seats.js —— 玩家座驾/工事操作: 坦克/飞机/迫击炮/反坦克炮/防空炮/重机枪
// 2026-08-24 由 20-player.js 切分: 原第 388-609 行 (玩家本体/交互/相机仍在 20-player.js)
// ─────────────────────────────────────────────
'use strict';
// 2026-09-06 B6/P2-26: 座驾 HUD 元素引用缓存 (原每帧多次 getElementById)
const seatElm=id=>updatePlayerTank._els[id]||(updatePlayerTank._els[id]=document.getElementById(id));
// ═════════════════════════════════════════════════════════════════════════════
// 载具机枪热量条 (2026-09-21 A#3 契约A, owner: sea-hud)
//
// 与固定 MG42 (#heatWrap) 的**同一套读数口径**: 热量字段是载具实例上的 heat(0..1)/heatLock,
// 由 tank-core (15-vehicles 的 vehMgHeatTick/vehMgHeatAdd) 写入 —— **本文件只读**, 一个字节都不写回:
// 玩家侧不做任何"散热/积热"计算 (那是 00-config VEH_MG_HEAT 单源 + 15-vehicles 的共用函数)。
//   · 显示条件: 玩家在坦克/艇上, 且该载具带 heat 数字字段 (缺字段的载具/未落盘的 tank-core ⇒ 自动不显示);
//   · 幽灵坦克 (kind==='ghost') 一律不显示 (契约 §4: 不积热、不显示条);
//   · 过热 (heat>=1 或 heatLock): 条变红 + **出一次** AudioSys.metalSlide(0.4,0.3,400,200) —— 与
//     20a-seats.updatePlayerMG 的固定 MG 过热提示**逐参同档**; 用"当前过热的载具"做边沿判定, 换车不误响、
//     同一辆车持续过热只响一次 (降到解锁值以下才复位)。
let _mgHeatOverVeh=null;
function vehMgHeatHud(v){
const wrap=seatElm('mgHeatWrap'), fill=seatElm('mgHeatFill');
const ok=!!(v&&v.kind!=='ghost'&&typeof v.heat==='number');
if(!ok){
if(wrap&&wrap.style.display!=='none') wrap.style.display='none';
_mgHeatOverVeh=null;
return;
}
const h=clamp(v.heat,0,1);
const over=(v.heat>=1||v.heatLock===true);
if(wrap&&wrap.style.display!=='block') wrap.style.display='block';
if(fill){
// 变了才写 (2026-11-01 性能批): 旧版每帧无条件赋 style, 同值赋值也触发 CSSOM 失效
const wv=(h*100)+'%';
if(fill._lw!==wv){ fill._lw=wv; fill.style.width=wv; }
const bg=over?'#ff5a3a':(h>0.7?'linear-gradient(90deg,#e8c56a,#e83a1a)':'linear-gradient(90deg,#8fd8f0,#e8c56a)');
if(fill._lb!==bg){ fill._lb=bg; fill.style.background=bg; }
}
if(over&&_mgHeatOverVeh!==v){
_mgHeatOverVeh=v;
if(typeof AudioSys!=='undefined'&&AudioSys.metalSlide) AudioSys.metalSlide(0.4,0.3,400,200);
}
if(!over) _mgHeatOverVeh=null;
}
function updatePlayerTank(dt){
const p=player, t=p.onVehicle;
if(!t.alive){ p.onVehicle=null; return; }
if(t.kind==='plane') return; // 飞机由Plane.update驱动
const fwd=(keys.KeyW?1:0)-(keys.KeyS?1:0);
const turn=(keys.KeyD?1:0)-(keys.KeyA?1:0);
t.vel=dampF(t.vel,fwd<0?-t.def.rev:fwd*t.def.spd,2.5,dt);
t.yaw-=turn*t.def.turn*dt*(fwd<0?-1:1);
// ★2026-11-16 批1 坦克修理读条推进 + 移动/起火/远离打断 (开火打断在 fireCannon/firePlayerMG;
//   重伤打断在 Tank.takeDmg; 下车打断在 20-player tryInteract)。前进输入立即打断 (vel 阻尼爬升慢,
//   只判 |vel| 会迟 ~0.3s), 原地转向不算移动; 远离门 1.35×R 迟滞防边界抖动。
if(p.vehRepair){
const vr=p.vehRepair;
if(vr.tank!==t||!t.alive||t.burning){ p.vehRepair=null; if(t.burning) showScorePop('维修被打断: 起火'); }
else if(fwd!==0||Math.abs(t.vel)>VEH_REPAIR_MOVE){ p.vehRepair=null; showScorePop('维修被打断: 移动'); }
else{
let near=false;
if(typeof AMMO_CRATES!=='undefined') for(const ac of AMMO_CRATES){ if(ac.ship) continue; if(Math.hypot(ac.x-t.pos.x,ac.z-t.pos.z)<=VEH_REPAIR_R*1.35){ near=true; break; } }
if(!near){ p.vehRepair=null; showScorePop('维修被打断: 远离补给点'); }
else{
vr.t+=dt;
if(vr.t>=vr.dur){
p.vehRepair=null;
t.hp=Math.min(t.maxHp,t.hp+t.maxHp*VEH_REPAIR_HEAL);
showScorePop('维修完成 +25%');
if(typeof AudioSys!=='undefined'&&AudioSys.metalSlide) AudioSys.metalSlide(0.5,0.4,260,120);
}
}
}
}
const wantTY=angDiff(t.yaw,p.yaw+Math.PI);
t.turretYaw=angleLerpTo(t.turretYaw,wantTY,t.def.tRate*dt);
let wantPitch=clamp(p.pitch,-0.12,0.32);
if(p.tankView){
// 炮手镜: 测距并抬炮补偿弹道下坠
// 320m 测距 10Hz 节流 (2026-11-01 性能批, 与 _pipT 同档): 全程 DDA + 逐坦克圆柱测距, 结果只进
// wantPitch 的阻尼目标 (dampF 6/s), 100ms 新鲜度不可感。距离缓存 _rngD, 射线期间走复用槽。
if(nowT-updatePlayerTank._rngT>=0.1){
updatePlayerTank._rngT=nowT;
const cd=camForward(_scF), co=_scO.copy(camera.position);
let D=320;
const wr2=raycastWorld(co,cd,D);
if(wr2) D=wr2.dist;
for(const t2 of tanks){
if(t2===t||!t2.alive) continue;
const r2=rayCyl(co,cd,vehHitCyl(t2,_scCyl),D);
if(r2) D=r2.t;
}
updatePlayerTank._rngD=D;
}
	wantPitch=clamp(p.pitch+SHELL_G*updatePlayerTank._rngD/(2*SHELL_SPD*SHELL_SPD),-0.12,0.35);
}
t.turretPitch=dampF(t.turretPitch,wantPitch,6,dt);
p.fireT-=dt;
// 准星汇聚: 主炮朝相机瞄准点开火
// 瞄准吸附 (2026-09-27 用户要求"载具火力瞄准"): 主炮走**直瞄重火力**档, 且只在玩家自己开的这条链上算 ——
// 传给 15-vehicles 的 fireCannon(customDir) 作为出膛方向 (关档/无候选时传 null ⇒ 与旧版逐字同一路径);
// 幽灵坦克 (kind==='ghost') 是 team=-1 的无差别火力 ⇒ 放开同队过滤, 与它的炮弹口径一致。
if(mouseDown&&t.cannonCd<=0&&!matchOver){
let ad=null;
if(typeof aimAssistDir==='function') ad=aimAssistDir(t.muzzle,t.aimDir(),'heavy',{team:t.team,ff:t.kind==='ghost',self:t});
t.fireCannon(ad);
if(p.streakBuff){ t.cannonCd*=p.streakBuff.reloadMul; t.cdMax=t.cannonCd; }   // 连杀增益: 主炮加速 (2026-09-12)
}
// 同轴机枪(右键)
if(mouse2Down&&!matchOver){
const cd=camForward(_scF);
const co=_scO.copy(camera.position);
let aimD=200;
const wr=raycastWorld(co,cd,aimD);
if(wr) aimD=wr.dist;
const aimP=_scA.copy(co).addScaledVector(cd,aimD);
let dir=_scD.copy(aimP).sub(t.coaxMuzzle()).normalize();
if(dir.dot(t.aimDir())>0.85){
dir.x+=rand(-0.012,0.012); dir.y+=rand(-0.009,0.009); dir.z+=rand(-0.012,0.012); dir.normalize();
// 瞄准吸附 (2026-09-27): 同轴机枪 = 机枪档; 同样挂在散布之后 (掰的是这一发的最终方向)
if(typeof aimAssistDir==='function') dir=aimAssistDir(t.coaxMuzzle(),dir,'mg',{team:t.team,ff:t.kind==='ghost',self:t});
t.firePlayerMG(dir);
}
}
p.pos.copy(t.pos);
p.vel.set(0,0,0);
// 2026-09-06 B6/P2-26: DOM 引用缓存 + 落点 pip 10Hz 节流 (原每帧 36 步弹道迭代+射线+2 次 getElementById)

if(nowT-updatePlayerTank._pipT>=0.1){
updatePlayerTank._pipT=nowT;
const pip=seatElm('tankPip');
{
const sp2=t.aimDir().multiplyScalar(SHELL_SPD);
const simP=_scO.copy(t.muzzle);   // 复用槽 (2026-11-01 性能批): 旧版 muzzle.clone + 每步 clone
let hitP=null;
for(let i=0;i<36;i++){
	sp2.y-=SHELL_G*0.1;
const step=sp2.length()*0.1;
const dirN=_scD.copy(sp2).normalize();
const wr=raycastWorld(simP,dirN,step);
if(wr){ hitP=_scA.copy(simP).addScaledVector(dirN,wr.dist); break; }
simP.addScaledVector(dirN,step);
if(simP.y<heightAt(simP.x,simP.z)){ hitP=simP; break; }
}
if(!hitP) hitP=simP;
const v=hitP.project(camera);
if(v.z<1){
pip.style.display='block';
pip.style.left=((v.x*0.5+0.5)*innerWidth)+'px';
pip.style.top=((1-(v.y*0.5+0.5))*innerHeight)+'px';
} else pip.style.display='none';
}
// 同轴机枪准星: 从摄像机出发避免自碰撞
{
let mgSrc=camera.position.clone();
let mgDir=camForward();
let mgD=180;
const mgw=raycastWorld(mgSrc.clone().addScaledVector(mgDir,2.5),mgDir,mgD);
let mgHit;
if(mgw) mgHit=mgSrc.addScaledVector(mgDir,mgw.dist+2.5); else mgHit=mgSrc.clone().addScaledVector(mgDir,mgD);
const mgv=mgHit.project(camera);
const mpip=seatElm('mgPip');
if(mgv.z<1){
mpip.style.display='block';
mpip.style.left=((mgv.x*0.5+0.5)*innerWidth)+'px';
mpip.style.top=((1-(mgv.y*0.5+0.5))*innerHeight)+'px';
} else mpip.style.display='none';
}
}
const _heat=seatElm('heatFill');
_heat.style.width=(clamp(1-t.cannonCd/(t.cdMax||t.def.reload),0,1)*100)+'%';
_heat.style.background=t.cannonCd<=0?'#8fd18f':'linear-gradient(90deg,#e8c56a,#e83a1a)';
vehMgHeatHud(t); // 机枪热量条 (2026-09-21 A#3): 只读 tank-core 写的 t.heat/t.heatLock; 幽灵坦克在函数内早退
updateInteractHint();
}
updatePlayerTank._els={}; updatePlayerTank._pipT=0; updatePlayerTank._rngT=0; updatePlayerTank._rngD=320;
// 座位链逐帧复用槽 (2026-11-01 性能批): 相机前向/位置/瞄准点/方向各一槽, 本帧内串行消费不持有
const _scF=V3(0,0,1), _scO=V3(), _scA=V3(), _scD=V3(0,0,1), _scCyl={x:0,z:0,r:2.3,y0:0,y1:0};
const _scCylT={x:0,z:0,r:2.2,y0:0,y1:0};
// 投影/落点写入单源 (2026-11-01 性能批): 旧版 updatePlayerPlane 每帧新建 _prj/_put 两个闭包 + 每次投影一个 V3。
// 投影走 _seatPrjV 复用槽 —— 返回值由调用方本帧内同步消费 (读 x/y 即丢), 不跨调用持有 ⇒ 单槽安全。
const _seatPrjV=V3();
function _seatPrj(x,y,z){ const v=_seatPrjV.set(x,y,z).project(camera); return (v.z<1&&Math.abs(v.x)<1.05&&Math.abs(v.y)<1.05)?v:null; }
function _seatPut(id,v){ const e2=seatElm(id);
if(v){ e2.style.display='block'; e2.style.left=((v.x*0.5+0.5)*innerWidth)+'px'; e2.style.top=((1-(v.y*0.5+0.5))*innerHeight)+'px'; }
else e2.style.display='none'; }
function updatePlayerPlane(dt){
const p=player, pl=p.onVehicle;
if(!pl.alive){ p.onVehicle=null; return; }
const hf=seatElm('heatFill');   // 去重写 (2026-11-01 性能批): _lw/_lb 键与 vehMgHeatHud 共用 ⇒ 跨座位缓存一致
const hv=(pl.bombs/pl.def.bombs*100)+'%';
if(hf._lw!==hv){ hf._lw=hv; hf.style.width=hv; }
if(hf._lb!=='#9fc0e8'){ hf._lb='#9fc0e8'; hf.style.background='#9fc0e8'; }
// ═══ 飞机火控 HUD (P3-7a 2026-09-30, 用户痛点"驾驶时对空对地全无辅助, 只能碰运气") ═══
// 四件套全走"世界点 → camera.project 投影"(leadPip 同款), 不用屏幕中心 —— 追尾相机 lookAt
// 前方 22m 带俯角, 屏幕中心与弹道方向差 ~7-11°, 那正是旧版"准星缺失+视差"手感灾难的主因。
// 收尾纪律 (D6): 四个 pip 都是 20a 直写 style 的双写点字段, 22-hud 兜底 sweep 里必须逐个 hudHideReal。
const _prj=_seatPrj, _put=_seatPut;   // 模块级单源 (2026-11-01 性能批): 旧版每帧新建两个闭包 + 每次投影一个 V3
// ① 炮线准星 (boresight): 机枪出膛线 (pos+fwd×2.4 沿 fwdDir) 远点投影 —— 十字永远钉在弹道方向上
const fd=pl.fwdDir(_scF);
_put('gunPip',_prj(pl.pos.x+fd.x*300,pl.pos.y+fd.y*300,pl.pos.z+fd.z*300));
// ② 扫射弹着点 + ③ 航弹落点 (CCIP): 地形步进 (74 次 heightAt/帧) 与 60 步弹道积分 10Hz 节流
//    (updatePlayerTank._rngT 同款口径) —— 命中世界点缓存进 _spH/_ccH, **逐帧重投影**: 屏幕位置仍随相机
//    连续, 只有世界参考点最多滞后 0.1s (对地面参考点可接受; ① 准星仍逐帧)。
//    ③ 物理原样: 与 dropBomb 逐字同式初值 (vel×0.85, vy=min(fv.y,0)-4) + updateNades 同款
//    半隐式积分 (vy 先减 g 再进位) + fuse 6s 上限 —— 首个触地点即爆点, 6s 未触地按空中爆点标。
const sp=updatePlayerPlane._spH, cc=updatePlayerPlane._ccH;
if(nowT-updatePlayerPlane._pipT>=0.1){
updatePlayerPlane._pipT=nowT;
let sOK=false;
{ let sx=pl.pos.x+fd.x*2.4, sy=pl.pos.y+fd.y*2.4, sz=pl.pos.z+fd.z*2.4;
for(let d=8;d<600;d+=8){
const px2=sx+fd.x*8, py2=sy+fd.y*8, pz2=sz+fd.z*8;
if(py2<=heightAt(px2,pz2)){ const mx=(sx+px2)/2,my=(sy+py2)/2,mz=(sz+pz2)/2;
if(my<=heightAt(mx,mz)){ sp.x=mx; sp.y=my; sp.z=mz; } else { sp.x=px2; sp.y=py2; sp.z=pz2; }
sOK=true; break; }
sx=px2; sy=py2; sz=pz2;
} }
sp.ok=sOK;
if(pl.bombs>0){
const fv=pl.velVec(_scD);
let bx=pl.pos.x, by=pl.pos.y-1, bz=pl.pos.z, vx=fv.x*0.85, vy=Math.min(fv.y,0)-4, vz=fv.z*0.85, bt=0, bOK=false;
while(bt<6){ vy-=0.98; bx+=vx*0.1; by+=vy*0.1; bz+=vz*0.1; bt+=0.1;
if(by<=heightAt(bx,bz)+0.05||bt>=6-1e-9){ cc.x=bx; cc.y=by; cc.z=bz; bOK=true; break; } }
cc.ok=bOK;
} else cc.ok=false;
}
_put('strafePip',sp.ok?_prj(sp.x,sp.y,sp.z):null);
_put('ccipPip',cc.ok?_prj(cc.x,cc.y,cc.z):null);
// ④ 空空指示框: 最近敌机屏幕投影 + 距离读数 + "咬住可开火"高亮 (机头夹角 <3.2° 且 <280m = airmg 吸附档接得上的窗口)
let ep=null,ed=1e9;
for(let i2=0;i2<planes.length;i2++){ const e2=planes[i2]; if(!e2.alive||e2.team===pl.team) continue; const d=e2.pos.distanceTo(pl.pos); if(d<ed){ ed=d; ep=e2; } }
if(ep&&ed<420){
const v=_prj(ep.pos.x,ep.pos.y,ep.pos.z);
if(v){
const e4=seatElm('airPip');
e4.style.display='block'; e4.style.left=((v.x*0.5+0.5)*innerWidth)+'px'; e4.style.top=((1-(v.y*0.5+0.5))*innerHeight)+'px';
const dds=String(Math.round(ed)); if(e4._dd!==dds){ e4._dd=dds; e4.setAttribute('data-d',dds); }
// rel2 标量化 (2026-11-01 性能批): 与 V3(...).normalize() 逐位同判 (零向量长度归 1 ⇒ dot=0)
const rx=ep.pos.x-pl.pos.x, ry=ep.pos.y-pl.pos.y, rz=ep.pos.z-pl.pos.z;
const rl=Math.sqrt(rx*rx+ry*ry+rz*rz)||1;
const ang=Math.acos(clamp((rx*fd.x+ry*fd.y+rz*fd.z)/rl,-1,1));
e4.style.opacity=(ang<0.056&&ed<280)?'1':'0.55';
} else seatElm('airPip').style.display='none';
} else seatElm('airPip').style.display='none';
// ── 7b-丙 锁定/接管 HUD (2026-09-30): 维持/冷却/终止的单源都在 16-aircraft (planeLockMaintain/
//    planeTakeoverEnd), 这里只做投影与文案 —— 双写点纪律 D6: lockPip/planeLockHud 已入 22-hud 兜底 sweep。
//    锁定窗锥: 锁 35°/500m · 维持 45°/560m (00-config PLANE_LOCK 单源)。
planeLockMaintain(pl);
if((player.takeoverCd||0)>0) player.takeoverCd=Math.max(0,player.takeoverCd-dt);
const lt=pl.lockTgt;
if(lt&&lt.alive){
const v=_prj(lt.pos.x,lt.pos.y+(lt.kind?1.4:1.0),lt.pos.z);
if(v) _put('lockPip',v); else seatElm('lockPip').style.display='none';
} else seatElm('lockPip').style.display='none';
let lkTxt='';
if(pl.aiPilotOn&&pl.aiPilotTgt) lkTxt=t2('AI 接管中 · {0} · Space 交还',t2(pl.aiPilotTgt.name||(pl.aiPilotTgt.kind==='tank'?'坦克':'地面目标')));
else if(lt&&lt.alive) lkTxt=t2('已锁定 {0} · {1}m · Space 接管',t2(lt.name||(lt.kind==='tank'?'坦克':'地面目标')),String(Math.round(pl.pos.distanceTo(lt))));
else if((player.takeoverCd||0)>0) lkTxt=t2('AI 飞行员歇息 {0}s',String(Math.ceil(player.takeoverCd)));
const lkEl=seatElm('planeLockHud');
if(lkEl._t!==lkTxt){ lkEl._t=lkTxt; lkEl.textContent=lkTxt; } // 文案变化才写 DOM; display 每帧直写 (sweep 兜底隐藏后要能自己恢复)
lkEl.style.display=lkTxt?'block':'none';
updateInteractHint();
}
updatePlayerPlane._pipT=0; updatePlayerPlane._spH={ok:false,x:0,y:0,z:0}; updatePlayerPlane._ccH={ok:false,x:0,y:0,z:0};
function updatePlayerMortar(dt){
const p=player, m=p.onMortar;
p.crouch=true; p.prone=false;   // 命中体 parity (2026-11-03): Bot 迫击炮手蹲姿小命中体 (14-bots), 玩家旧版站着 = 挨打面更大, 同规补齐 (mountMortar 已盖, 此处逐帧兜底)
// 解除 ±0.6rad 回旋限制: 炮身 360° 随动视角
const rel=angDiff(m.face+Math.PI,p.yaw);
p.yaw=m.face+Math.PI+rel;
p.pitch=clamp(p.pitch,0.55,1.35);
p.pos.x=m.x-Math.sin(m.face+rel)*0.85;
p.pos.z=m.z-Math.cos(m.face+rel)*0.85;
p.pos.y=standHeight(p.pos.x,p.pos.z,p.pos.y+1); p.vel.set(0,0,0);
m.grp.rotation.y=m.face+rel;
m.cd-=dt;
const dir=camForward(_scF);   // 复用槽 (2026-11-01 性能批): 每帧 clone 是纯垃圾
const vo=_scA.set(m.x+dir.x*60,m.y+dir.y*60,m.z+dir.z*60);   // 同上; vo 本帧内同步消费 (标记位/开火读 x/z)
// 落点指示圈: 实时显示炮弹落点
mortarMarker.visible=true;
mortarMarker.position.set(vo.x,heightAt(vo.x,vo.z)+0.07,vo.z);
mortarMarker.rotation.y+=dt*1.2;
const mscale=0.85+Math.sin(nowT*3.2)*0.08;
mortarMarker.scale.setScalar(mscale);
if(mouseDown&&m.cd<=0&&!matchOver){
m.cd=4.5*(p.streakBuff?p.streakBuff.reloadMul:1); m.cdMax=m.cd; // 玩家冷却档 3.2→4.5 (★2026-10-30 用户裁定⑤削弱); Bot AI rand(6,9) 显式节奏分叉; 连杀增益: 射速提升 (2026-09-12)
emplMortarShell(m,p,vo.x,vo.z); // 弹道/弹体/击杀来源/炮口烟单源 (13-combat)
AudioSys.metalSlide(0.35,0.18,140,50);
addTrauma(0.12);
}
// 炮管俯仰随视角(高抛→炮管更竖直), 开火后阻尼回位
m.tube.rotation.x=dampF(m.tube.rotation.x,0.62-(p.pitch-0.95)*0.3,5,dt);
const hf=seatElm('heatFill'); const wv=(clamp(1-m.cd/(m.cdMax||4.5),0,1)*100)+'%';
if(hf._lw!==wv){ hf._lw=wv; hf.style.width=wv; }
updateInteractHint();
}
function updatePlayerAT(dt){
const p=player, g=p.onAT;
g.cd-=dt;
	// 回旋限界 (★2026-09-26 修, P1-12): 炮口 2.69m 而操作手在后方 0.9m ⇒ 360° 回旋会用炮管穿人
	// (真实反坦克炮的方向机也有限界)。视角与炮口**同向**钳在 ±AT_YAW_MAX 内: 准星、炮管、弹道三者恒一致
	// (不是"炮不动人照转"那种假限界 —— 那种会让弹道偏出准星)。
	const rel0=angDiff(g.face+Math.PI,p.yaw);
	const rel=clamp(rel0,-AT_YAW_MAX,AT_YAW_MAX);
	p.yaw=g.face+Math.PI+rel;
	p.pitch=clamp(p.pitch,-AT_PITCH_DOWN,0.6);   // 俯角下限单源 (00-config): 旧 -0.55 让炮口入地 0.55m
g.yaw.rotation.y=rel;
g.pitch.rotation.x=-p.pitch;
p.pos.x=g.x-Math.sin(g.face)*AT_CREW_DIST; // 站位单源常量 (00-config; P2-19: 旧 1.3 嵌进后方沙袋墙 0.35m)
p.pos.z=g.z-Math.cos(g.face)*AT_CREW_DIST;
p.pos.y=standHeight(p.pos.x,p.pos.z,p.pos.y+1);
p.vel.set(0,0,0);
if(mouseDown&&g.cd<=0&&!matchOver){
let dir=camForward(_scF);   // 复用槽 (2026-11-01 性能批)
// 瞄准吸附 (2026-09-27): 反坦克炮 = 直瞄重火力档 (打坦克/步兵都是同一发穿甲弹)
if(typeof aimAssistDir==='function') dir=aimAssistDir(V3(g.x,g.y+0.3,g.z),dir,'heavy',{team:p.team,ff:false});
emplATFire(g,p,dir); // 冷却/炮口/弹速/特效/击杀来源单源 (13-combat, 与 Bot 同一份)
if(p.streakBuff) g.cd*=p.streakBuff.reloadMul; // 连杀增益: 装填加速 (2026-09-12)
g.cdMax=g.cd;
addTrauma(0.45);
}
const hf=seatElm('heatFill'); const wv=(clamp(1-g.cd/(g.cdMax||3.6),0,1)*100)+'%';
if(hf._lw!==wv){ hf._lw=wv; hf.style.width=wv; }
updateInteractHint();
}
// ═════════════════════════════════════════════════════════════════════════════
// 岸防炮座位 (2026-09-21 A#9 用户第 9 条 / 契约 §6, owner: sea-hud)
//
// 「有人才动, 无人完全静止」的**玩家那一半**: 15f-battery 的 Battery.update 已删掉全部自动索敌开火,
// 玩家上炮后由本函数每帧驱动 —— 与 updatePlayerAT 同构 (同一套转向/俯仰/站位/开火/装填条口径),
// 差别只有两处: ① 炮位是 Battery 实例 (face 基准 + yaw/pitch 两级组, 见 15f), ② 站位常量 2.7m。
// 座位字段 player.onBattery (契约冻结) —— 不是 onVehicle/onNaval 的别名: onVehicle 一挂上, 22-hud 的
// 坦克分支会读 t.cannonCd/.def 直接抛错, 24-main 的视角武器门也会误判 (与 2026-09-20N onNaval 同款理由)。
// 上下炮本身不在本文件: batteryMountPlayer/batteryDismountPlayer 在 15f-battery (契约 §6 的函数归属),
// 由 infantry 在 20-player.tryInteract 里 typeof 调用 (本文件零改动 20-player.js)。
function updatePlayerBattery(dt){
const p=player, g=p.onBattery;
if(!g) return;
// 炮位被摧毁 (胸墙组归零) → 同帧下炮: 与 updatePlayerTank 的 `!t.alive ⇒ 解座` 同一纪律。
// (15f 的 die() 只清炮位自己的占用字段, 不碰玩家座位 —— 座位收尾归本文件)
if(!g.alive){ batteryDismountPlayer(); return; }
// 冷却递减单源在 15f updateBatteries (`b.cd-=dt`, 注释明言"与谁瞄准/开火无关") —— 旧版此处本地再扣一次 ⇒
// 玩家射速≈2×契约值 (Bot 侧 updateBatteryGun 无本地扣减, 故只有玩家翻倍; 装填条读同一份 cd 故静默, ★2026-11-21 P1-1)。
// 转向/俯仰: 与 updatePlayerAT 逐式同构 —— 相机 yaw 为权威, 炮的 yaw 组写"相对 face 的回旋量",
// 于是 aimYaw()=face+yaw.rotation.y=p.yaw-π 恒等于相机前向 (炮管指向准星)。g.face 是炮位基准朝向
// (面海, 落位/建模/站位全读它), 不随鼠标改 —— 与 atGun 的 g.face/g.yaw 命名与语义完全一致。
// ★2026-09-26 修 (P1-19a): 回旋限界 ±BATTERY_YAW_MAX + 俯角下限逐角解算 (batteryPitchFloor) ——
//   旧版无回旋限制且俯角定角 -0.42, 炮管会从自家胸墙/操作手身上穿过去 ("岸炮打自己")。
// 视角与炮口同向钳制 (与 updatePlayerAT 的 AT_YAW_MAX 同规): 准星=炮管=弹道, 不给假限界。
const rel0=angDiff(g.face+Math.PI,p.yaw);
const rel=clamp(rel0,-((typeof BATTERY_YAW_MAX==='number')?BATTERY_YAW_MAX:1.745),((typeof BATTERY_YAW_MAX==='number')?BATTERY_YAW_MAX:1.745));
p.yaw=g.face+Math.PI+rel;
const PITMIN=(typeof batteryPitchFloor==='function')?batteryPitchFloor(rel):((typeof BATTERY_PITCH_MIN==='number')?BATTERY_PITCH_MIN:-0.42);
const PITMAX=(typeof BATTERY_PITCH_MAX==='number')?BATTERY_PITCH_MAX:0.75;
p.pitch=clamp(p.pitch,PITMIN,PITMAX);
g.yaw.rotation.y=rel;
g.pitch.rotation.x=-p.pitch;
// 站位: 炮位沿 -face 2.7m (单源 batteryStandSpot, 与 atGun 的 AT_CREW_DIST 同规); 高度走 standHeight
const sp=(typeof batteryStandSpot==='function')?batteryStandSpot(g):null;
if(sp){ p.pos.x=sp.x; p.pos.z=sp.z; p.pos.y=standHeight(p.pos.x,p.pos.z,p.pos.y+1); }
p.vel.set(0,0,0);
// 左键开炮: 方向 = 相机前向 (准星汇聚, 与 updatePlayerAT 的 camForward 同式); 冷却/炮口/弹速/特效/
// 击杀来源单源在 15f 的 Battery.fire (batteryFire 唯一入口) —— 本文件不写弹道数值。
if(mouseDown&&g.cd<=0&&!matchOver&&typeof batteryFire==='function'){
let dir=camForward(_scF);   // 复用槽 (2026-11-01 性能批)
// 瞄准吸附 (2026-09-27): 岸防炮 = 直瞄重火力档 (对海对岸双用); 舰艇是它的主目标 (角半径大 ⇒ 窗口自然更宽)
if(typeof aimAssistDir==='function') dir=aimAssistDir(V3(g.x,g.y+1.0,g.z),dir,'heavy',{team:p.team,ff:false});
if(batteryFire(g,dir,p)){
if(p.streakBuff) g.cd*=p.streakBuff.reloadMul;  // 连杀增益: 装填加速 (与 atGun 同源, 2026-09-12 口径)
g.cdMax=g.cd;
addTrauma(0.45);                                 // 与 updatePlayerAT 的开炮震屏同档
}
}
const hf=seatElm('heatFill');
const wv=(clamp(1-g.cd/(g.cdMax||((typeof BATTERY_RELOAD_A==='number')?BATTERY_RELOAD_A:3.6)),0,1)*100)+'%';
if(hf._lw!==wv){ hf._lw=wv; hf.style.width=wv; }
const bg=g.cd<=0?'#8fd18f':'linear-gradient(90deg,#e8c56a,#e83a1a)';
if(hf._lb!==bg){ hf._lb=bg; hf.style.background=bg; }
updateInteractHint();
}
function updatePlayerAA(dt){
const p=player, g=p.onAA;
g.cd-=dt;
// 解除"防空炮只能对空": 俯仰可下压平射, 弹片同时可命中地面士兵/载具
p.pitch=clamp(p.pitch,-0.45,1.35);
g.yaw.rotation.y=p.yaw+Math.PI;
g.pitch.rotation.x=-p.pitch;
p.pos.x=g.crew?g.crew.x:g.x; p.pos.z=g.crew?g.crew.z:(g.z-AA_CREW_DIST); // 站位单源 (00-config + 建炮时的避障点): 退出炮口 1.7m 扫掠圈
p.pos.y=standHeight(p.pos.x,p.pos.z,p.pos.y+1);
p.vel.set(0,0,0);
// 提前量指示圈
const pip=seatElm('leadPip');
let ep=null,bd=1e9;
for(let i2=0;i2<planes.length;i2++){ const pl2=planes[i2]; if(pl2.alive&&pl2.team!==p.team){ const dx=pl2.pos.x-g.x,dy=pl2.pos.y-g.y,dz=pl2.pos.z-g.z; const d=Math.sqrt(dx*dx+dy*dy+dz*dz); if(d<bd){ bd=d; ep=pl2; } } }   // 标量化 (2026-11-01 性能批): 每机一个 V3 是纯垃圾, 与 distanceTo 逐位同值
if(ep&&bd<280){
const tof=bd/FLAK_SPD; // 7d-乙: 高炮弹速单源 FLAK_SPD (旧借 SHELL_SPD; 2026-09-06 B7a/P2-8 起单源化)
const lead=_scA.copy(ep.pos).addScaledVector(ep.velVec(_scD),tof);   // 复用槽 (2026-11-01 性能批): clone+velVec 每帧两_alloc
const v=lead.project(camera);
if(v.z<1&&Math.abs(v.x)<1.1&&Math.abs(v.y)<1.1){
pip.style.display='block';
pip.style.left=((v.x*0.5+0.5)*innerWidth)+'px';
pip.style.top=((1-(v.y*0.5+0.5))*innerHeight)+'px';
} else pip.style.display='none';
} else pip.style.display='none';
if(mouseDown&&g.cd<=0&&!matchOver){
g.cd=EMPL_AA_CD*(p.streakBuff?p.streakBuff.reloadMul:1); g.cdMax=g.cd; // 与 Bot 同档单源 (D1=c); 连杀增益: 射速提升 (2026-09-12)
p._src='防空炮'; // 击杀来源: 固定防空炮
let dir=camForward(_scF);   // 复用槽 (2026-11-01 性能批)
// 瞄准吸附 (2026-09-27): 防空炮单列"对空"档 —— 目标含飞机 (提前量指示圈照旧, 吸附只做近失误兜底, 不替玩家算提前量)
if(typeof aimAssistDir==='function') dir=aimAssistDir(V3(g.x,g.y+1.2,g.z),dir,'air',{team:p.team,ff:false});
fireFlak(g,p,dir);
addTrauma(0.1);
p.recoilPitch+=0.004;
p.lastFiredT=nowT;
}
const hf=seatElm('heatFill'); const wv=(clamp(1-g.cd/(g.cdMax||EMPL_AA_CD),0,1)*100)+'%';
if(hf._lw!==wv){ hf._lw=wv; hf.style.width=wv; }
updateInteractHint();
}
function updatePlayerMG(dt){
const p=player, mg=p.onMG;
// 解除水平角度限制: 机枪可360°回旋; 俯仰放宽可压向坡下近距目标
p.pitch=clamp(p.pitch,-0.7,0.45);
p.pos.y=standHeight(p.pos.x,p.pos.z,p.pos.y+1);
p.vel.set(0,0,0);
mg.yaw.rotation.y=angDiff(mg.face+Math.PI,p.yaw);
mg.pitch.rotation.x=-p.pitch*0.9;
mg.fireT-=dt;
mg.heat=Math.max(0,mg.heat-dt*(mouseDown?0:0.22)); // 玩家散热档 0.22 且开火不散 (Bot 0.15 常散=显式节奏分叉)
if(mouseDown&&mg.fireT<=0&&mg.heat<1&&!matchOver){
let dir=camForward(_scF);   // let: 下面的瞄准吸附会把 dir 换成"掰过的新方向"; 复用槽 (2026-11-01 性能批)
const spread=0.011+mg.heat*0.015; // 玩家输入散布 (随热量; Bot 走 0.02*(suppression+0.7))
const rv=camRight(_scO), uv=_scA.copy(rv).cross(dir).negate();   // 复用槽 (2026-11-01 性能批): clone+cross+negate 链每发三_alloc
dir.addScaledVector(rv,rand(-spread,spread)).addScaledVector(uv,rand(-spread,spread)).normalize();
p.recoilPitch+=0.0022;
p.pitch=clamp(p.pitch+0.0012,-0.7,0.45);
p.yaw+=rand(-1,1)*0.0018;
addTrauma(0.06);
AudioSys.gunshot(mgSid(mg.def),0,0); // 架设重机枪按阵营型号分档 (★2026-11-15c: MG42 撕布/九二式慢沉/水冷闷/气冷, 单源 mgSid 00-config)
const h0=mg.heat;
// 瞄准吸附 (2026-09-27): 固定重机枪 = 机枪档; 挂在散布 (随热量) 之后 ⇒ 掰的是这一发的最终方向
if(typeof aimAssistDir==='function') dir=aimAssistDir(V3(mg.x,mg.y+0.1,mg.z),dir,'mg',{team:p.team,ff:false});
emplMGFire(mg,p,dir); // 弹道/冷却/热量/特效/击杀来源单源 (13-combat, 与 Bot 同一份; headMul 统一 1.9)
if(p.streakBuff&&mg.heat>h0) mg.heat=h0+(mg.heat-h0)*p.streakBuff.reloadMul; // 连杀增益: 枪管降温——只放缓积热, 散热速率不变 (2026-09-12)
if(mg.heat>=1){ AudioSys.metalSlide(0.4,0.3,400,200); } // 过热提示: emplMGFire 内已累加热量
}
const hf=seatElm('heatFill'); const wv=(mg.heat*100)+'%';
if(hf._lw!==wv){ hf._lw=wv; hf.style.width=wv; }
updateInteractHint();
}
// ═════════════════════════════════════════════════════════════════════════════
// 海战座位: 艇 / 两栖车 (2026-09-20N 海战批, owner: naval-crew)
//
// 为什么另开一条链 (updatePlayerNaval) 而不是塞进 updatePlayerTank:
//   ① 载具本体是 15d-naval 的 NavalCraft, 只有 drive/fireMain/fireSecondary/fireMG/fireTorpedo/
//      turretAimAt/muzzle 这套接口, 没有 Tank 的 def/cannonCd/pitchG 语义 (照抄坦克那条会读出一片 undefined);
//   ② 座位字段用 player.onNaval (定稿 §11.6), **不碰 player.onVehicle** —— onVehicle 一挂上,
//      22-hud 的坦克 HUD 分支会读 t.cannonCd 并 .toFixed() 直接抛异常, 24-main 的视角武器门也会误判。
//
// 三条用户裁定 (原话 → 落地口径, 见 海战系统设计定稿-20260920.md §〇):
//   ① "走到艇边按 F 上艇; 涛上必须游泳贴近" ⇒ 陆上 dist<4.5; 水上 (waterDepthAt(player)>SWIM_DEPTH) dist<2.5
//   ② "不要有运兵船, 只有战斗船。两栖车也一样" ⇒ 本链**零载人/卸兵/跳板放人**分支 (每台载具只有 1 名车组)
//   ③ "靠岸/搁浅后从舷侧或艏跳板步行下船" ⇒ 限速跨出 (EXIT_SPD 3.6m/s, 单轴单帧硬上限 0.25m), 全程无 pos.set
const NAVAL_BOARD_R_LAND=4.5;    // 陆上上艇半径 (用户裁定①)
const NAVAL_BOARD_R_WATER=2.5;   // 水上上艇半径 (用户裁定①: 必须游泳贴近)
const NAVAL_EXIT_SPD=3.6;        // 下艇跨出限速 (m/s): 与 14-bots EXIT_SPD 同档 (2026-09-20 闪现修复口径)
const NAVAL_EXIT_MAX_T=2.0;      // 跨出超时(秒): 被挡住就地结束 —— 不做"强制落位", 强制落位就是瞬移
const NAVAL_EXIT_STEP=0.25;      // 单轴单帧位移硬上限(米): 合成 ≤0.36m, 恒在 0.5m 验收线内
const NAVAL_EXIT_OFF=2.7;        // 下艇落点半径: 船壳边 2.7m (与 14-bots VEH_BOARD_R 同口径)
// 座位状态 (全部挂在 player 上, 不新增全局可变对象):
//   p.onNaval   = 正在驾驶的 NavalCraft | null   (座位单源, 定稿 §11.6)
//   p.navalExit = {x,z,t} 下艇跨出目标 | null    (跨出阶段: 只推进位移, 不响应驾驶/开火)
//   p.navalCd   = {main,sec,torp} 本地武器冷却  (开火闸门与 HUD 装填条同源)
//   p.navalW    = 上艇时暂存的手持武器槽 (下艇原样交还; 上艇期间 curW=null)
//   p.navalFire = {torp:本座位已发射鱼雷数}      (15d torpAmmo 缺失时的兜底读数, 见 navalTorpedoLeft)
//   p.navalTP0  = 上艇前的第三人称开关 (下艇原样还原; 见 updateCamera 的海战相机分支)

// 上艇半径 (按**玩家脚下**水深分档; 单源: F 交互 / 提示 HUD / 探针都读这一份)。
// ★口径 (2026-09-20N 与 15d/verifier 对齐): 这两个数字是**艇体距** —— "到艇壳侧面的距离", 不是中心距。
//   15d 的 navalNear 实现为 `中心距 - spec.hullW*0.5 < r` (15d-naval.js:965), 与用户裁定
//   "走到艇边按 F 上艇"完全一致 (LVT 半宽 1.625m ⇒ 中心 6.1m 处仍算贴着船壳)。
//   下面的兜底扫描 (15d 未落盘时) 必须用同一口径, 否则两条路径会有隐藏的 1.6~3.2m 行为差。
function navalBoardRadius(){
const p=player;
return (typeof waterDepthAt==='function'&&waterDepthAt(p.pos.x,p.pos.z)>SWIM_DEPTH)?NAVAL_BOARD_R_WATER:NAVAL_BOARD_R_LAND;
}
// 半径内最近的可上载具: 优先走 15d 的 navalNear(x,z,r,team) (单源); 15d 未落盘时退回**同口径**的只读扫描
// (艇体距 = 中心距 - hullW/2, 且排除 sinking/wreck —— 与 15d:960-969 逐式一致)。
// 过滤: 存活 / 非残骸非沉没 / 本方 —— 敌方载具不可上, 沉没中的也不可上 (定稿 §2.1 可沉没)。
function navalNearestBoardable(){
const p=player, r=navalBoardRadius();
const ok=c=>!!c&&c.alive&&c.state!=='wreck'&&c.state!=='sinking'&&c.team===p.team;
if(typeof navalNear==='function'){ const c=navalNear(p.pos.x,p.pos.z,r,p.team); return ok(c)?c:null; }
if(typeof navalCraft==='undefined'||!Array.isArray(navalCraft)) return null;
let best=null,bd=r;
for(const c of navalCraft){
if(!ok(c)) continue;
const d=Math.hypot(c.pos.x-p.pos.x,c.pos.z-p.pos.z)-((c.spec&&c.spec.hullW)||0)*0.5;   // 艇体距 (与 navalNear 同口径)
if(d<bd){ bd=d; best=c; }
}
return best;
}
// 鱼雷剩余数 (定稿 §11.9⑧: 15d 公开只读字段 craft.torpAmmo)。
// 只在 torpAmmo 不是数字时才退回"spec.torpedo 减本座位已发射数" —— 那是 15d 未落盘期间的过渡兜底,
// 不再去探测别的字段名 (口径冻结, 避免多份候选名各读各的)。
function navalTorpedoLeft(c){
if(!c) return 0;
if(typeof c.torpAmmo==='number') return Math.max(0,Math.round(c.torpAmmo));
const base=(c.spec&&c.spec.torpedo)||0;
const fired=(player.navalFire&&player.navalFire.torp)||0;
return Math.max(0,base-fired);
}
// 能否步行下船 (用户裁定③): 搁浅态 / 水深浮不起船体 (≤draft+0.45 浅水带, 与 15d 浅水刮擦同档) / 能蹚水。
// 深水里不给下船 —— 那是"弃船", 归沉没链 (15d crewOut / 本文件 navalStartExit 的 forced 分支)。
// 自洽性: 鱼雷撞滩哑火, 能下船的浅水本来也发不出鱼雷 ⇒ F 的两义 (下船 / 鱼雷) 不会互相抢。
function navalCanFootExit(c){
if(!c) return false;
if(c.state==='ground') return true;
if(typeof waterDepthAt!=='function') return false;
const d=waterDepthAt(c.pos.x,c.pos.z);
// ★2026-09-26E (审计 9): 吃水取 15d 的只读单源 draftNow() —— 旧版这里与 22-hud 各手抄一份
// (spec.draft0 + flood*0.5), 改口径只改一处就会静默分叉。typeof 守卫: 缺 15d 的沙箱退化为原式。
const draft=(c.draftNow&&typeof c.draftNow==='function')?c.draftNow():(((c.spec&&c.spec.draft0)||0)+(c.flood||0)*0.5);
return d<=Math.max(draft+0.45,WADE_DEPTH);
}
// 此刻按 F 是"下船"还是"鱼雷" (★2026-09-26E 审计 12): 无鱼雷载具 (LVT/カミ) 恒为下船 ——
// 旧版 F 的两义靠 navalCanFootExit 分, 而它对 torpedo:0 的载具在深水恒 false ⇒ 走到"鱼雷"那一支,
// 弹"该载具无鱼雷发射管", 而提示行对无鱼雷载具又完全不提 F ⇒ 玩家只能"开回浅水脱身" (死路)。
// 两栖车的设计语义是"能下水也能上岸" ⇒ 深水按 F = 下水游泳 (跨出链 navalExitTick 已按深水给浮力位)。
function navalCanExitNow(c){
if(!c) return false;
if(navalCanFootExit(c)) return true;
return !(c.spec&&c.spec.torpedo>0);
}
// 下艇落点: 船壳边 2.7m, 优先"朝岸"的那一侧 (shoreDirAt = 03-terrain 的落水自救/游向岸单源),
// 再依次取左右舷与艏/艉跳板向; 被实体挡住就换方向, 并选水深最浅的一侧 (能站住/能蹚)。
function navalExitSpot(c){
const lat=[Math.cos(c.yaw),-Math.sin(c.yaw)];              // 舷侧 (与艏向垂直; yaw→方向约定 forward=(sin,cos))
const fwd=[Math.sin(c.yaw),Math.cos(c.yaw)];               // 艏 / 艉跳板向
const dirs=[];
const sd=(typeof shoreDirAt==='function')?shoreDirAt(c.pos.x,c.pos.z):null;
if(sd) dirs.push(sd);
dirs.push([lat[0],lat[1]],[-lat[0],-lat[1]],fwd,[-fwd[0],-fwd[1]]);
let best=null,bd=1e9;
for(const d of dirs){
for(const r of [NAVAL_EXIT_OFF,NAVAL_EXIT_OFF+1.3]){      // 2.7m 船壳边优先, 被占就外挪 1.3m
const x=c.pos.x+d[0]*r, z=c.pos.z+d[1]*r;
if(typeof occBlocked==='function'&&occBlocked(x,z,true)) continue;  // 实体阻挡 (ignoreWater: 水障放行)
const dep=(typeof waterDepthAt==='function')?waterDepthAt(x,z):0;
if(dep<bd){ bd=dep; best={x,z}; }
break;
}
}
return best||{x:c.pos.x+lat[0]*NAVAL_EXIT_OFF,z:c.pos.z+lat[1]*NAVAL_EXIT_OFF};
}
// F: 上艇 (接管驾驶位) —— 与坦克接管同规: 车组下车 → 玩家拿座位 → 手持武器收起。
// 位移结清在**同一帧** (VM 收起 + pos 贴合), 与 14-bots enterVehicle 的"隐藏帧同时结清差量"同口径;
// 上艇半径由用户裁定 (4.5/2.5), 即被隐藏的位移上限, 不自行缩小。
function navalBoard(c,silent){
if(!c||!c.alive||c.state==='wreck'||c.state==='sinking') return false;
const p=player;
// ★2026-09-22 座位互斥的另一半 (与 15c-specveh 的 specVehBoard 成对): 上艇前先把幽灵坦克收掉 ——
//   否则 p.onVehicle 还指着白车, 15c 的 updateSpecVeh 会继续驱动它, 而 p.onNaval 又把相机/输入交给艇。
//   specVehStow 是幂等的 (SPECVEH 为空即直接 return), 观战以外的路径下它什么都不做。
if(p.onVehicle&&p.onVehicle.kind==='ghost'&&typeof specVehStow==='function') specVehStow();
const cb=c.driverBot||c.crewBot;                       // 驾驶位同一时刻只有一人: 车组交还
if(cb&&typeof cb.dismountVehicle==='function') cb.dismountVehicle(false);
c.driverBot=null; if(c.crewBot) c.crewBot=null;
c.playerDriven=true;
p.onNaval=c; p.navalExit=null;
p.onVehicle=null;   // 座位互斥的另一半 (上艇即清坦克座位字段): 正常路径下本来就是 null, 这里是显式双向清理
p.navalCd={main:0,sec:0,torp:0};
p.navalFire={torp:0};
if(p.navalW===undefined||p.navalW===null) p.navalW=p.curW||null;   // 暂存手持武器
p.curW=null;   // 收起手持武器: 24-main 的视角武器门 + 22-hud 的弹药面板据此让位给座驾读数
p.navalTP0=p.thirdPerson; p.thirdPerson=true;          // 默认追尾第三人称 (C 三态: 第三人称 → 炮手镜 → 艏向第一人称)
p.navalGun=false;                                      // 上艇一律从第三人称起 (C 键三态的单源开关, 见 navalCycleView)
p.swim=false; p.wading=false; p.ads=false; p.prone=false; p.braced=false; p.tankView=false;
// ★2026-09-26E (审计 15): 上艇必须**同时复位潜水态字段** —— 旧版只清 swim/wading, 而 oxy/headDepth 只在
// 步行水态块里推进 ⇒ 游泳后上艇: 呼吸条按"上次的 headDepth>0"长期挂在屏幕上且永不回满 (对照: 15d crewOut
// 专门重置了 player.oxy, 说明作者知道该字段需要交接, 上艇这条路漏了)。
p.diveD=0; p.oxy=1; p._drownAcc=0; p.headDepth=-1;
p.vel.set(0,0,0);
p.pos.copy(c.pos);                                     // 隐藏帧内结清差量 (同帧, 不留"人在艇外状态在艇上"的一帧)
if(typeof waterYAt==='function') p.pos.y=Math.max(p.pos.y,waterYAt(c.pos.x,c.pos.z));
// ★ 相机系 ↔ 艇体系差 π (2026-09-21 修): 相机前向 = (-sin(p.yaw),-cos(p.yaw)), 艇艏向 = (sin(c.yaw),cos(c.yaw))
//   ⇒ "看艏"的相机 yaw = c.yaw+π —— 坦克 (20-player:179 t.yaw+turretYaw+π) / 飞机 (16-aircraft:456) /
//   机枪位 (20-player:45) / 岸炮位 (15f:604) **全部**是 +π, 只有海战座位漏了 ⇒ 第三人称相机被摆在艏前
//   12.8m 朝艉看、第一人称朝艉 (探针 dev/_navalai-* 实测相机前向·艏向 = −1.00)。炮手镜若继承这个反向就全废。
p.yaw=c.yaw+Math.PI; p.pitch=0;
VM.root.visible=false;
const hw=document.getElementById('heatWrap'); if(hw) hw.style.display='block';
if(!silent){ AudioSys.metalSlide(0.3,0.15,400,900); showScorePop(t2('你接管了 {0}',t2(c.name))); }
if(typeof navalSeatHud==='function') navalSeatHud(c);
updateInteractHint();
return true;
}
// 交还座位 (下艇到位/超时、部署复位、弃船共用): **位置保持不动** —— 玩家是 navalExitTick 逐帧限速走到
// 船壳边的, 这里再落一次位就又是瞬移。载具回"无驾驶"状态 (playerDriven=false, 车组不返还: 与坦克接管同规)。
function navalSeatRelease(){
const p=player, c=p.onNaval;
p.onNaval=null; p.navalExit=null;
if(c) c.playerDriven=false;
p.curW=(p.slots&&p.slots[p.curSlot])?p.slots[p.curSlot]:(p.navalW||null);   // 交还手持武器
p.navalW=null; p.navalCd=null; p.navalFire=null;
p.navalGun=false;                                   // 炮手镜开关随座位一起清 (22-hud 的每帧兜底也会清, 这里是主路径)
if(p.navalTP0!==undefined){ p.thirdPerson=p.navalTP0; p.navalTP0=undefined; } // 还原上艇前的视角开关
p.vel.set(0,0,0);
VM.root.visible=true;
const hw=document.getElementById('heatWrap'); if(hw) hw.style.display='none';
vehMgHeatHud(null); // 机枪热量条: 下艇即收 (与 heatWrap 同段; updateHUD 每帧还有一道兜底扫)
if(typeof navalSeatHud==='function') navalSeatHud(null);
updateInteractHint();
}
// 开始下艇跨出 (F 下船 / 沉没弃船同一条路径)
function navalStartExit(c,forced){
const p=player;
if(p.navalExit||!c) return;
const sp=navalExitSpot(c);
p.navalExit={x:sp.x,z:sp.z,t:NAVAL_EXIT_MAX_T};
if(c) c.playerDriven=false;                             // 交还驾驶权: 艇自行减速/漂 (车组不返还)
if(forced) showScorePop(t2('弃船! 快游开'));             // 键已存在 (沉没链)
AudioSys.metalSlide(0.2,0.1,500,800);
}
// 跨出推进: 每帧朝落点限速走 (单轴 ≤ NAVAL_EXIT_STEP), 高度同样限速趋近 (深水贴水面游泳位, 否则踩地面)。
// ★ 全程没有 pos.set —— 这正是 2026-09-20 修掉的"下艇/上车硬瞬移"根因, 不许退回去。
function navalExitTick(p,dt){
const ex=p.navalExit; if(!ex) return;
ex.t-=dt;
const dx=ex.x-p.pos.x, dz=ex.z-p.pos.z;
const d=Math.hypot(dx,dz);
const step=Math.min(d,NAVAL_EXIT_SPD*dt,NAVAL_EXIT_STEP);
if(d>1e-4){ p.pos.x+=dx/d*step; p.pos.z+=dz/d*step; }
const deep=(typeof waterDepthAt==='function'&&waterDepthAt(p.pos.x,p.pos.z)>SWIM_DEPTH);
let ty=p.pos.y;
if(deep) ty=(typeof waterYAt==='function'?waterYAt(p.pos.x,p.pos.z):0)-FLOAT_PAD;   // 游泳浮力位 (00-config FLOAT_PAD 单源, 2026-09-26E 审计 32)
else if(typeof standHeight==='function') ty=standHeight(p.pos.x,p.pos.z,p.pos.y+1);
p.pos.y+=clamp(ty-p.pos.y,-NAVAL_EXIT_STEP,NAVAL_EXIT_STEP);
p.vel.set(0,0,0);
if(d<=0.08||ex.t<=0) navalSeatRelease();                // 到位/超时 → 交还座位 (位置就地, 由步行态接管)
}
// F(水上): 发射鱼雷 —— side 省略 = 自动选管 (定稿 §11.9②: 0 左舷 / 1 右舷 / undefined 自动)
function navalFireTorpedo(c){
const p=player;
if(!c||!c.spec||!(c.spec.torpedo>0)){ showScorePop(t2('该载具无鱼雷发射管')); return false; }
const st=p.navalCd||(p.navalCd={main:0,sec:0,torp:0});
if(st.torp>0){ showScorePop(t2('鱼雷装填中')); return false; }     // 键已存在
if(navalTorpedoLeft(c)<=0){ showScorePop(t2('鱼雷 ×{0}',0)); return false; }
if(typeof c.fireTorpedo!=='function') return false;
// ★2026-09-26 修 (P1-11 闸门口径): 本座位的节奏闸门必须**不短于** 15d 的齐射间隔 NAVAL_TORP_CD(1.2s),
//   否则 20a 放行、15d 拒发 (PT 艇 spec.reload=1.0 < 1.2): 玩家看到"鱼雷发射!"+HUD 计数 +1, 海里没有雷。
//   取 max(reload, NAVAL_TORP_CD) —— 真正的"能不能发"仍由 15d 的 torpAmmo/冷却单源裁定。
const TCD=(typeof NAVAL_TORP_CD==='number')?NAVAL_TORP_CD:1.2;
const fired=c.fireTorpedo();                             // 无参 = 自动选管 (15d 内部挑管/走位)
// ★2026-09-26E (审计 13): 返回值必须看 —— 15d 在 "非存活 / sinking / wreck / 冷却中 / 无弹" 时 return false,
//   而旧版忽略返回值 ⇒ 沉没倾覆段 (0.8s) 按 F 照样弹"鱼雷发射!"+HUD 计数+音效, 海里却没有雷。
//   (2026-09-26 的 P1-11 只对齐了两边的闸门时长, 没处理返回值。)
if(fired===false){ showScorePop(t2('鱼雷发射管已失效')); return false; }
if(p.navalFire) p.navalFire.torp=(p.navalFire.torp||0)+1;
st.torp=Math.max(c.spec.reload||0,TCD);                  // 本座位节奏闸门 (真正的弹药上限归 15d torpAmmo)
showScorePop(t2('鱼雷发射!'));                           // 键已存在
AudioSys.metalSlide(0.35,0.22,300,120);
addTrauma(0.3);
return true;
}
// 主循环分派入口 (20-player updatePlayer 按 p.onNaval 调用) —— 与 updatePlayerTank 同构
function updatePlayerNaval(dt){
const p=player, c=p.onNaval;
if(!c) return;
// ① 载具被毁/沉没 → 弃船: 玩家这一侧只负责"从座位上下来并落水", 沉没表现归 15d 的沉没链
if(!c.alive||c.state==='wreck'||c.state==='sinking'){
if(!p.navalExit) navalStartExit(c,true);
navalExitTick(p,dt);
return;
}
// ② 下艇跨出阶段: 只推进位移, 不响应驾驶/开火 (相机同时交回步行态 —— 见 updateCamera)
if(p.navalExit){ navalExitTick(p,dt); return; }
// ③ 驾驶: W/S 前后, A/D 转向 —— 输入原样交给 15d 的 drive(fwd,turn,dt)
const fwd=(keys.KeyW?1:0)-(keys.KeyS?1:0);
const turn=(keys.KeyD?1:0)-(keys.KeyA?1:0);
if(typeof c.drive==='function') c.drive(fwd,turn,dt);
// ④ 视角: 相机锁在船首系 (艇会持续转向, 完全自由视角会让船头甩出画面)。鼠标给出 ±1.55rad 的舷侧观察,
//    超限处**直接钳住并回写 p.yaw** ⇒ 鼠标没有"看不见的余量"(推到极限后回拉即刻响应, 无死区)。
//    ★ 基准 = c.yaw+π (相机系与艇体系差 π, 见 navalBoard 的注释): 旧代码用 c.yaw 作基准, 相机被摆在艏前。
//    炮手镜态 (p.navalGun) 不钳: 炮塔能转满 360°, 视线必须跟着炮塔自由转 (见 ⑤)。
const camBase=c.yaw+Math.PI;
if(!p.navalGun){
const look=clamp(angDiff(camBase,p.yaw),-1.55,1.55);
p.yaw=camBase+look;
p.pitch=clamp(p.pitch,-0.18,0.36);
}
// ⑤ 贴座: 与坦克同一口径 (位置跟随载具, 步行态速度清零; 游泳/涉水态由座位接管, 避免输入被 p.swim 闸住)
p.pos.copy(c.pos);
p.vel.set(0,0,0);
p.swim=false; p.wading=false;
// ⑥ 瞄准: 两种输入源 (用户裁定"第三人称仍可开炮, 只在炮手镜态改瞄准输入源")
//    ① 第三人称/艏向第一人称: 相机中心射线求落点 (与坦克"准星汇聚"同一做法), 炮塔/炮座交给 15d
//    ② 炮手镜 (p.navalGun): 相机机位=炮塔观瞄点, 视线=炮塔指向 ⇒ 相机中心射线会**自指**, 不能当输入源;
//       改为把鼠标视线 (p.yaw/p.pitch) 直接落到炮塔上, 由 15d 按 spec.tRate 限速回转 (稳像: 相机随后跟炮塔)。
if(p.navalGun){
const want=p.yaw+Math.PI;                                   // 相机 yaw → 世界方位 (差 π)
const pit=clamp(p.pitch,(typeof NAVAL_PIT_MIN==='number'?NAVAL_PIT_MIN:-0.10),
                        (typeof NAVAL_PIT_MAX==='number'?NAVAL_PIT_MAX:0.35));
p.pitch=pit;                                                // 俯仰限幅 (炮管不指天/不插甲板, 与 15d 同源)
const dh=120;                                               // 合成目标点距离 (只用于求俯仰角, 与命中无关)
const ty=(c.pos.y||0)+1.8+Math.tan(pit)*dh;
if(typeof c.turretAimPoint==='function') c.turretAimPoint(c.pos.x+Math.sin(want)*dh,ty,c.pos.z+Math.cos(want)*dh,dt);
else if(typeof c.turretAimAt==='function') c.turretAimAt(c.pos.x+Math.sin(want)*dh,c.pos.z+Math.cos(want)*dh,dt);
}
const cdF=camForward(_scF), co=_scO.copy(camera.position);   // 复用槽 (2026-11-01 性能批): 每帧 clone×2 是纯垃圾
let aimD=620;
const wr=raycastWorld(co,cdF,aimD);
if(wr) aimD=wr.dist;
const aimP=co.addScaledVector(cdF,aimD);
if(!p.navalGun&&typeof c.turretAimAt==='function') c.turretAimAt(aimP.x,aimP.z,dt);
// 开火方向: 炮口→瞄准点 (与坦克同口径); 拿不到炮口就退回相机前向
let aimDir=camForward(_scF);   // cdF 在 aimP 合成后已死, 同槽轮换
let mzMain=null;   // 主炮炮口 (瞄准吸附的遮挡射线起点; 缺读数时用炮心替代)
if(typeof c.muzzle==='function'){
const mz=c.muzzle('main');
if(mz&&typeof mz.x==='number'){ mzMain=mz; const dv=_scA.copy(aimP).sub(mz); if(dv.lengthSq()>1e-6) aimDir=dv.normalize(); }
}
// ⑦ 开火: 左键主炮 / 右键机炮 (两栖车 secondary=null ⇒ 右键走同轴机枪)。主炮冷却单源在艇体 c.cannonCd
//    (15d update 递减 / fireMain 写入), 座位闸 st.main 是它的同步镜像 (HUD 装填条读它; 与坦克乘 cd 本体同款)
//    —— 旧版双闸各写各的, st.main 先到 0 而 fireMain 内 cannonCd>0 静默 false ⇒ 空枪震屏 + 节奏失真 (★2026-11-21 P1-2)。
const st=p.navalCd||(p.navalCd={main:0,sec:0,torp:0});
st.main-=dt; st.sec-=dt; st.torp-=dt;
if(mouseDown&&!matchOver&&st.main<=0&&c.cannonCd<=0&&typeof c.fireMain==='function'){
// 瞄准吸附 (2026-09-27 用户要求"载具火力瞄准"): 舰炮主炮 = 直瞄重火力档 (对艇是大目标 ⇒ 收容窗口自然更宽)
let md=aimDir;
if(typeof aimAssistDir==='function') md=aimAssistDir(mzMain||V3(c.pos.x,c.pos.y+2,c.pos.z),aimDir,'heavy',{team:c.team,ff:false,self:c});
if(c.fireMain(md)){                                    // false (沉没/残骸/冷却未清) ⇒ 不结算: 不重置 st.main 也不震屏
if(p.streakBuff){ c.cannonCd*=p.streakBuff.reloadMul; c.cdMax=c.cannonCd; }   // 连杀增益乘艇体 cd 本体 (与 updatePlayerTank 同款, 2026-09-12)
st.main=c.cannonCd;                                    // 座位闸/HUD 装填条与艇体 cd 单源同步
addTrauma(0.3);
}
}
const sdef=(c.spec&&c.spec.secondary)||null;
if(mouse2Down&&!matchOver&&st.sec<=0){
// 瞄准吸附 (2026-09-27): 并列机炮 / 艇载机枪 = 机枪档 (炮口读数走 coaxMuzzle: 它就是这两者的炮口单源)
let sd=aimDir;
if(typeof aimAssistDir==='function'){
const smz=(typeof c.coaxMuzzle==='function')?c.coaxMuzzle():null;
sd=aimAssistDir((smz&&typeof smz.x==='number')?smz:V3(c.pos.x,c.pos.y+1.6,c.pos.z),aimDir,'mg',{team:c.team,ff:false,self:c});
}
if(sdef&&typeof c.fireSecondary==='function'){ c.fireSecondary(sd); st.sec=sdef.rof||0.1; addTrauma(0.12); }
else if(c.spec&&c.spec.mg&&typeof c.fireMG==='function'){ c.fireMG(sd); st.sec=c.spec.mg.rof||0.1; addTrauma(0.06); }
}
// ⑧ HUD: 座驾读数 (22-hud 追加段的 navalSeatHud) + F/驾驶提示 (20-player updateInteractHint)
vehMgHeatHud(c); // 机枪热量条 (2026-09-21 A#3): 艇载机枪与坦克同一条读数 (heat/heatLock 由 15d 写入)
if(typeof navalSeatHud==='function') navalSeatHud(c);
updateInteractHint();
}
