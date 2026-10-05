// ─────────────────────────────────────────────
// 15b-trucks.js —— 劫道模式 AI 运输车队 (不可驾驶)
// 车队沿 CAMPAIGN.roads[0] 航点链自动行驶, 可被子弹/炮弹/爆炸摧毁,
// 毁后原地留残骸(碰撞体), 不重生、不计兵力票 (胜负只看车队)
// 加载于 15-vehicles 之后: 运行期被 13/15/16/21/22/23/24 引用
// ─────────────────────────────────────────────
'use strict';
const trucks=[];
let CONVOY_STATE=null;
// 车队路径: 道路折线 (roads[0]) 收起为航点链 (roads 需按行车方向顺序书写)
let _convoyPathCache=null;
function convoyPath(){
// 2026-09-06 B6/P2-27: 模块级缓存 (道路表局内不变; 调用方只读遍历, 每帧重建路径数组是纯浪费)
if(_convoyPathCache) return _convoyPathCache;
const R=CAMPAIGN.roads||[];
if(!R.length) return [];
const P=[[R[0][0],R[0][1]]];
for(const r of R) P.push([r[2],r[3]]);
_convoyPathCache=P;
return P;
}
const truckTarpMat=new THREE.MeshLambertMaterial({color:0x6a5a44,map:TEX.cloth}); // B8/P3-12
class Truck {
constructor(team,i){
this.kind='truck';
this.team=team;
this.name='运输卡车';
this.hp=(CAMPAIGN.convoy&&CAMPAIGN.convoy.hp)||320;
this.maxHp=this.hp;
this.alive=true; this.escaped=false;
this.pos=V3(); this.yaw=0; this.vel=0;
this.idx=i;
this.wpI=0;
this.wreckBs=null;
this.sunk=false; this.sinking=false;
this.startU=i*((CAMPAIGN.convoy&&CAMPAIGN.convoy.gap)||15); // 列队间距: 沿行进方向提前 startU
this.buildMesh();
this.placeAtColumn();
trucks.push(this);
this.grp.position.copy(this.pos);
this.grp.rotation.set(0,this.yaw,0);
}
buildMesh(){
this.grp=new THREE.Group();
const addM=(g,x,y,z,mat)=>{
const mm=mat||MAT.metalDark;
const m=new THREE.Mesh(uvGeo(g,mm),mm); m.position.set(x,y,z); m.castShadow=true;
this.grp.add(m);
return m;
};
// 底盘
addM(boxGeo(2.1,0.35,6.4),0,0.95,0);
// 驾驶室
const cab=addM(boxGeo(1.9,0.85,1.3),0,1.5,1.75,MAT.metal);
addM(boxGeo(1.9,0.5,1.3),0,1.25,2.02);
// 货厢 + 帆布
const bed=addM(boxGeo(2.05,1.1,3.55),0,1.6,-0.85,MAT.woodDark);
const tarp=new THREE.Mesh(boxGeo(1.85,0.45,3.2),truckTarpMat); tarp.position.set(0,2.05,-0.85); tarp.castShadow=true; this.grp.add(tarp);
// 引擎盖
addM(boxGeo(1.75,0.42,0.9),0,1.28,2.72);
// 车轮 (轴沿 X: z 轴旋转 HPI)
this.wheels=[];
const wGeo=new THREE.CylinderGeometry(0.45,0.45,0.34,10);
for(const [wx,wz] of [[-1.12,2.0],[1.12,2.0],[-1.12,-0.4],[1.12,-0.4],[-1.12,-2.2],[1.12,-2.2]]){
const w=new THREE.Mesh(wGeo,MAT.rubble);
w.rotation.z=HPI;
w.position.set(wx,0.45,wz);
w.castShadow=true;
this.grp.add(w);
this.wheels.push(w);
}
world.add(this.grp);
}
// 列队初始位: 沿路径从起点前进 startU (0=领队车在最前端)
placeAtColumn(){
const P=convoyPath();
if(P.length<2){ this.pos.set(0,0,0); return; }
let u=this.startU, i=0;
while(i<P.length-1&&u>0){
const dx=P[i+1][0]-P[i][0], dz=P[i+1][1]-P[i][1];
const L=Math.hypot(dx,dz)||1;
if(u>=L){ u-=L; i++; }
else{
const t=u/L;
this.pos.set(P[i][0]+dx*t,0,P[i][1]+dz*t);
this.yaw=Math.atan2(dx,dz);
this.wpI=i;
this.pos.y=heightAt(this.pos.x,this.pos.z);
return;
}
}
// u 耗尽(领队车)或超出路径: 取当前段起点
this.pos.set(P[i][0],0,P[i][1]);
this.yaw=i<P.length-1?Math.atan2(P[i+1][0]-P[i][0],P[i+1][1]-P[i][1]):0;
this.wpI=Math.min(i,P.length-2);
this.pos.y=heightAt(this.pos.x,this.pos.z);
}
update(dt){
if(!this.alive){
// 残骸沉没已收敛 queueSink (2026-09-06 B7b/P2-4): 静置1.2s→沉入3.6s→半沉(40%)撤碰撞→全沉移除, 冒烟走 onTick
if(this.escaped||this.sunk||this.sinking) return;
}
const P=convoyPath();
if(this.wpI>=P.length-1){
// 抵达终点: 突围西口
this.escaped=true; this.alive=false;
if(CONVOY_STATE){ CONVOY_STATE.esc++; CONVOY_STATE.left=Math.max(0,CONVOY_STATE.left-1); }
addKillMsg(`运输车突围! 已突围 ${CONVOY_STATE?CONVOY_STATE.esc:0} 辆`,(CAMPAIGN.convoy&&CAMPAIGN.convoy.escortTeam!==undefined)?CAMPAIGN.convoy.escortTeam:1);
world.remove(this.grp);
return;
}
const tgt=P[this.wpI+1];
const dx=tgt[0]-this.pos.x, dz=tgt[1]-this.pos.z;
const d=Math.hypot(dx,dz);
if(d<2.8){ this.wpI++; return; }
const spd=(CAMPAIGN.convoy&&CAMPAIGN.convoy.spd)||4.2;
const steer=Math.atan2(dx,dz);
this.yaw=angleLerpTo(this.yaw,steer,2.2*dt);
this.vel=dampF(this.vel,spd,2.5,dt);
this.pos.x+=Math.sin(this.yaw)*this.vel*dt;
this.pos.z+=Math.cos(this.yaw)*this.vel*dt;
this.pos.y=dampF(this.pos.y,heightAt(this.pos.x,this.pos.z),8,dt);
// 实体碰撞: 步兵不可穿入车体; 行进正面的敌军碾压, 其余侧向挤出 (同坦克模式)
vehiclePushSoldiers(this,1.05,3.7,{dt,crusher:this,moving:this.vel>0.8,yMax:2.0,frontalBand:1.4,symmetricFrontal:true,crushDmg:300,pushVel:this.vel});
// 护运方补给: 紧贴本车的护运士兵自动补绷带 (运输车是护运方唯一补给来源)
for(const s of combatants){
if(!s.alive||s.team!==this.team||s.onVehicle) continue;
if(s.bandages>=s.maxBandages||(s.bandRefillT||0)>nowT) continue;
if(Math.hypot(s.pos.x-this.pos.x,s.pos.z-this.pos.z)<3&&Math.abs(s.pos.y-this.pos.y)<3){
s.bandages=s.maxBandages;
s.bandRefillT=nowT+9;
}
}
this.grp.position.copy(this.pos);
// ★ 2026-09-26 B16 修: 卡车也要吃地形姿态 (旧版只有 yaw ⇒ 上坡/过坎时整车水平穿过坡面: 车头埋土、
//   后轮悬空)。口径与坦克同源: 车头/车尾与左右两侧各取两点 heightAt, 得俯仰/侧倾, 再过 dampF。
//   只写 grp.rotation = 纯观感, 不碰 pos / 碰撞盒 / 碾压判定。
{
const cp=Math.cos(this.yaw), sp2=Math.sin(this.yaw);
const SH=(typeof tankSurfH==='function')?tankSurfH:heightAt;   // 与坦克同一采样面 (含可跨越障碍顶)
// 符号与坦克逐字一致 (15-vehicles 悬挂段): 前高 ⇒ 俯仰为负 (抬头); 右高 ⇒ 侧倾为正。
const pitchT=-Math.atan2(SH(this.pos.x+sp2*2.6,this.pos.z+cp*2.6)-SH(this.pos.x-sp2*2.6,this.pos.z-cp*2.6),5.2);
const rollT=Math.atan2(SH(this.pos.x+cp*1.1,this.pos.z-sp2*1.1)-SH(this.pos.x-cp*1.1,this.pos.z+sp2*1.1),2.2);
this.suspP=dampF(this.suspP||0,pitchT,7,dt);
this.suspR=dampF(this.suspR||0,rollT,7,dt);
}
this.grp.rotation.order='YXZ';
this.grp.rotation.set(this.suspP||0,this.yaw,this.suspR||0);
// ★ 2026-09-26 A10 修: 车轮滚动速率按**几何半径**折算 (与坦克 update 同一口径) —— 旧版写死 ×1.6
// = 0.72 倍车速 ⇒ 车轮比车体慢 28% (明显打滑)。半径取不到时回退 0.45 (本车 wGeo 的实测值)。
for(const w of this.wheels){ const wr=(w.geometry&&w.geometry.parameters&&w.geometry.parameters.radiusTop)||0.45; w.rotation.x+=this.vel*dt/wr; }
}
takeDmg(amt,attacker){
if(!this.alive) return;
this.hp-=amt;
if(this.hp<=0) this.die(attacker);
}
die(attacker){
this.alive=false;
if(CONVOY_STATE){ CONVOY_STATE.destroyed++; CONVOY_STATE.left=Math.max(0,CONVOY_STATE.left-1); }
explosionFX(this.pos.clone().add(V3(0,0.8,0)));
AudioSys.explosion(this.pos.distanceTo(camera.position)*0.9);
for(let i=0;i<8;i++) spawnP(PT.dark,this.pos.x+rand(-1,1),this.pos.y+rand(0.3,1.5),this.pos.z+rand(-1,1),rand(-1,1),rand(1,3),rand(-1,1),1.0,2.0,rand(0.8,1.4),0.85,0.6);
for(let i=0;i<4;i++) spawnP(PT.flash,this.pos.x+rand(-0.5,0.5),this.pos.y+rand(0.4,1.2),this.pos.z+rand(-0.5,0.5),rand(-0.5,0.5),rand(0.5,1.5),rand(-0.5,0.5),0.4,0.6,0.15,1,0,true);
crater(this.pos.x,this.pos.z,1.4,true);
// 油料起火: 残骸会沉入地下消失, 只留瞬时火点引燃周边草丛/灌木 (无持续火源, 见 04b-fire)
if(typeof igniteArea==='function'){
igniteArea(this.pos.x,this.pos.z,2.6,attacker||null);
explosionFlora(this.pos,4.5);
}
	// 残骸: 烧黑+倾角+碰撞体, 然后逐渐沉入地下消失 (update 中处理)
	if(typeof vehHeadlightKill==='function') vehHeadlightKill(this); // 夜战大灯先拆 (N2): 同 Tank.die, 焦黑化会把光锥换成不透明材质
	this.grp.traverse(o=>{ if(o.isMesh) o.material=wreckMat; });
	this.grp.rotation.set(rand(-0.08,0.08),this.yaw,rand(-0.22,0.22));
	this.grp.position.y=this.pos.y+0.2;
	this.wreckBs=registerDynCollider(this.pos.x,this.pos.y+0.7,this.pos.z,2.4,1.5,6.4);
	this.sinking=true;
queueSink({objs:[this.grp],rest:1.2,sink:3.6,depth:3.8,
onHalf:()=>{ if(this.wreckBs) killDynCollider(this.wreckBs); },
onTick:(dtk,k)=>{ if(k<0.9&&Math.random()<dtk*2.2) spawnP(PT.dark,this.pos.x+rand(-1.4,1.4),this.grp.position.y+rand(0.3,1.2),this.pos.z+rand(-1.4,1.4),rand(-0.3,0.3),rand(0.4,1.2),rand(-0.3,0.3),0.5,1.1,rand(0.7,1.2),0.5,0.45); },
onDone:()=>{ world.remove(this.grp); this.sunk=true; }});
if(attacker){
attacker.kills=(attacker.kills||0)+1;
// 玩家得分取 registerKillScore 返回值 (含连杀倍率, 2026-09-11); Bot 仍按基础分
if(attacker.isPlayer) attacker.score=(attacker.score||0)+registerKillScore('摧毁运输车',SCORE_TABLE.truck);
else attacker.score=(attacker.score||0)+SCORE_TABLE.truck;
addKillfeed(attacker,this,false);
if(attacker.isPlayer&&typeof onPlayerWreck==='function') onPlayerWreck(); // 击毁红档 (2026-09-30 批): 卡车无乘员死亡链
}
addKillMsg(`运输车被摧毁! 剩余 ${CONVOY_STATE?CONVOY_STATE.left:0} 辆`,attacker?attacker.team:player.team);
}
}
function updateTrucks(dt){
if(!trucks.length) return;
for(const t of trucks) t.update(dt);
}
// 开局生成车队 (23-deploy startMatch 调用)
function spawnConvoy(cfg){
CONVOY_STATE={total:cfg.trucks,left:cfg.trucks,destroyed:0,esc:0,over:false};
const escortTeam=cfg.escortTeam!==undefined?cfg.escortTeam:1;
for(let i=0;i<cfg.trucks;i++) new Truck(escortTeam,i);
}
