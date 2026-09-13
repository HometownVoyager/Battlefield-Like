// ─────────────────────────────────────────────
// 15-vehicles.js —— 坦克/炮弹/溅射伤害
// 源: Index.original.html 第 5637-6206 行
// (2026-09-06 B7a: 切分遗留的 15a-defs.js 死表已删, 数据单源在 00-config FACTIONS[...].tanks)
// ─────────────────────────────────────────────
'use strict';
const tanks=[], shells=[];
// 坦克/反坦克炮弹重力: 近似平直弹道, 基本不受重力影响
const SHELL_G=0.5;
// 主炮弹速/射程 (2026-09-01 压制力增强: 130m/s×3.5s=455m → 150m/s×4.5s≈675m)
const SHELL_SPD=150;
// ── 载具命中圆柱单源 (2026-09-06 B7b/P2-2): 旧 7 处内联, 同一辆坦克两套命中体积(子弹 2.2/炮弹 2.3) ──
// 半径统一 2.3 (命中体积修正, 非玩法 nerf); 卡车无炮弹路径, 保留 2.2 口径
function vehHitCyl(t){ return {x:t.pos.x,z:t.pos.z,r:2.3,y0:t.pos.y,y1:t.pos.y+2.6}; }
function truckHitCyl(t){ return {x:t.pos.x,z:t.pos.z,r:2.2,y0:t.pos.y+0.2,y1:t.pos.y+2.5}; }
// ── 载具步兵碰撞/推出/碾压单源 (2026-09-06 B7b/P2-3): Tank/Truck 逐行同构块参数化 ──
// ── 厂房坦克产能 (2026-09-06 斯大林格勒点位改版): 苏军持"厂房"旗 → 重生倍速 + 出厂区 ──
// FACTORY_FLAG 缓存旗点对象 (05c 已建 FLAGS); tankRespawnMul=重生倒计时消耗倍率 ——
// 占领/失守瞬间自动作用于全部未重生完的该队坦克, 无需翻转钩子; 仅苏军(队0)享受, 德军恒 1
const FACTORY_FLAG=FACTORY_FLAG_ID?FLAGS.find(f=>f.id===FACTORY_FLAG_ID):null;
function tankRespawnMul(team){
return (team===0&&FACTORY_FLAG&&FACTORY_FLAG.owner===0)?FACTORY_SPEED_MUL:1;
}
function vehiclePushSoldiers(veh,hx,hz,o){
const csb=Math.cos(veh.yaw), snb=Math.sin(veh.yaw);
for(const s of combatants){
if(!s.alive||s.onVehicle) continue;
if(o.checkSpectator&&s.spectator) continue;
if(s.pos.y>veh.pos.y+o.yMax) continue;
const relx=s.pos.x-veh.pos.x, relz=s.pos.z-veh.pos.z;
const lx=relx*csb-relz*snb;
const lz=relx*snb+relz*csb;
if(Math.abs(lx)>=hx+0.38||Math.abs(lz)>=hz+0.38) continue;
const frontal=o.symmetricFrontal?(lz>hz-o.frontalBand):(veh.vel>0?(lz>hz-o.frontalBand):(lz<-(hz-o.frontalBand)));
if(o.moving&&frontal&&s.team!==veh.team){
o.crusher._src=veh.name; // 碾压击杀来源: 记入载具名
s.damage(o.crushDmg,o.crusher,false);
if(!s.alive) continue;
}
const penX=hx+0.38-Math.abs(lx);
const penZ=hz+0.38-Math.abs(lz);
let lateral=penX<penZ;
if(o.moving&&frontal) lateral=true;
if(lateral){
const sgn=lx>=0?1:-1;
const amt=penX<0.5?penX:Math.min(penX,(3+o.pushVel)*o.dt*2.2);
s.pos.x+=csb*sgn*amt; s.pos.z+=-snb*sgn*amt;
} else {
const sgn=lz>0?1:-1;
s.pos.x+=snb*sgn*penZ; s.pos.z+=csb*sgn*penZ;
}
if(s.isPlayer) collideMove(s.pos,0.42);
}
}
// 2026-09-02 装甲抗性: 坦克对"非反装甲"伤害(机枪/步枪子弹、火烧、飞机扫射、炸弹/迫击炮溅射等)按此倍率减免;
// 巡飞弹/坦克炮/固定炮/反坦克攻击(火箭筒/反坦克枪/炸药)仍全额生效 —— takeDmg 第3参 ap=true 表示反装甲伤害
// (2026-09-02 用户调参: 减免倍率 0.4 → 0.3, 非反装甲伤害只吃三成)
const TANK_ARMOR=0.3;
const wreckMat=new THREE.MeshLambertMaterial({color:0x1e1c18,map:TEX.grime}); // B8/P3-12 残骸焦污
// ── 越野跨越 (2026-09-04 用户指定): 低矮且无法摧毁的障碍(油桶/石碾/碎石堆/矮木箱/木凳等,
// 自身高度≤1.3m(顶面相对其地面), 且无 dGroup 可撞塌/无 crush 可碾毁)直接驶上跨越 —— 不阻挡也不碾毁,
// 障碍保持完好; 可摧毁的(沙袋/木箱/石墙, 高速撞毁/碾毁)与高障碍(拒马1.5m/石柱/建筑)维持原判定 ──
const TANK_STEP=1.3;
function tankRideH(x,z,baseY){
// 坦克底盘目标高度: 地面与脚下/前方 2.2m 足印内可跨越障碍顶面取高者 (阻尼过渡呈上坡爬越感)
// 2026-09-06 B5/P0-2: 全量扫描改 RGRID 邻近候选 (查询半径 2.25; 圆柱 r+1.9≤4.0 ⇒ 全场 r≤2.1 恒成立)
let h=heightAt(x,z);
const r2=2.2*2.2;
eachBoxNear(x-2.25,z-2.25,x+2.25,z+2.25,b=>{
if(b.dead) return;
if(b.maxY<=baseY-0.25||b.maxY>baseY+TANK_STEP) return; // 足印内平齐/已过/太高都不算
// 可跨越 = 障碍自身低矮(顶面高出其地面≤1.3m) 且 无 dGroup 撞塌/无 crush 碾毁 的可放行类别;
// <0.7m 的本来就放行 (与碰撞循环口径一致), 高度按自身相对地面判定 — 不随坦克瞬时高度漂变
const bh=b.maxY-b.gh;
if(bh>0.7&&(bh>TANK_STEP||b.dGroup||b.crush)) return;
const cx=clamp(x,b.minX,b.maxX), cz=clamp(z,b.minZ,b.maxZ);
const dx=x-cx, dz=z-cz;
if(dx*dx+dz*dz<r2&&b.maxY>h) h=b.maxY;
});
eachCylNear(x-4.0,z-4.0,x+4.0,z+4.0,c=>{
if(c.r<0.3) return;
if(c.y1-c.y0>TANK_STEP) return; // 自身低矮
if(c.y1<=baseY-0.25||c.y1>baseY+TANK_STEP) return;
const dx=x-c.x, dz=z-c.z, q=c.r+1.9;
if(dx*dx+dz*dz<q*q&&c.y1>h) h=c.y1;
});
return h;
}
function tankSurfH(x,z){
// 悬挂采样面高度: 地面与足下可跨越障碍顶面取高者 —— 不做 baseY 频带过滤,
// 前/后/左/右采样点一旦贴到障碍顶面就推动俯仰/侧倾弹簧, 越过时产生"上坡-颠簸-下坡"的跨越姿态
// 2026-09-06 B5/P0-2: 全量扫描改 RGRID 邻近候选 (盒 1.6 / 圆柱 r+1.5≤4.0)
let h=heightAt(x,z);
eachBoxNear(x-1.6,z-1.6,x+1.6,z+1.6,b=>{
if(b.dead) return;
const bh=b.maxY-b.gh;
if(bh>0.7&&(bh>TANK_STEP||b.dGroup||b.crush)) return;
const cx=clamp(x,b.minX,b.maxX), cz=clamp(z,b.minZ,b.maxZ);
const dx=x-cx, dz=z-cz;
if(dx*dx+dz*dz<1.55*1.55&&b.maxY>h) h=b.maxY;
});
eachCylNear(x-4.0,z-4.0,x+4.0,z+4.0,c=>{
if(c.r<0.3||c.y1-c.y0>TANK_STEP) return;
const dx=x-c.x, dz=z-c.z, q=c.r+1.5;
if(dx*dx+dz*dz<q*q&&c.y1>h) h=c.y1;
});
return h;
}
class Tank {
constructor(team,variant){
this.kind='tank';
this.team=team; this.variant=variant||0;
this.def=TEAM_FACTION[team].tanks[this.variant];
this.name=this.def.name;
this.hp=this.def.hp; this.maxHp=this.def.hp; this.alive=true;
this.pos=V3(); this.yaw=0; this.turretYaw=0; this.turretPitch=0; this.vel=0;
this.playerDriven=false; this.isAI=true;
this.crew={ name:this.name, team, kills:0, deaths:0, score:0, isPlayer:false, isCrew:true, pos:this.pos, alive:true, lastFiredT:-99, damage(){}, vel:V3() };
this.cannonCd=0; this.mgT=0; this.mgBurst=0; this.mgPause=0;
this.objective=null; this.thinkCD=0; this.stuckT=0; this.lastPos=V3(); this.smokeT=0;
this.path=null; this.pathI=0; this.repathT=0; this.reverseT=0; this.progT=0;
this.suspP=0; this.suspR=0; this.suspPV=0; this.suspRV=0; this.lastVel=0; this.wreckBs=null;
this.tTarget=null; this.tMemT=0; this.threatYaw=null;
this.respawnT=0; this.wheels=[];
this.buildMesh();
this.muzzle=V3();
this.engine=AudioSys.createEngine('tank');
tanks.push(this);
this.respawn(true,true); // 开局首次生成不播报 (initial=true: 恒走主基地, 厂房产能只作用于战损重生)
}
buildMesh(){
const D=this.def;
this.matBody=new THREE.MeshLambertMaterial({color:D.col, map:TEX.grime});
const matB=new THREE.MeshLambertMaterial({color:0x363830,map:TEX.metalBrush}); // B8/P3-12 负重轮/炮盾
const L=D.hullL;
this.grp=new THREE.Group();
const h=new THREE.Mesh(new THREE.BoxGeometry(2.6,0.95,L),this.matBody); h.position.y=1.0; this.grp.add(h);
const gl=new THREE.Mesh(new THREE.BoxGeometry(2.6,0.24,1.15),this.matBody);
gl.position.set(0,1.12,L/2-0.18); gl.rotation.x=-0.62; this.grp.add(gl);
const gr=new THREE.Mesh(new THREE.BoxGeometry(2.6,0.22,0.9),this.matBody);
gr.position.set(0,1.05,-L/2+0.15); gr.rotation.x=0.55; this.grp.add(gr);
const fenderL=new THREE.Mesh(new THREE.BoxGeometry(0.75,0.08,L+0.3),this.matBody);
fenderL.position.set(-1.62,1.32,0); this.grp.add(fenderL);
const fenderR=fenderL.clone(); fenderR.position.x=1.62; this.grp.add(fenderR);
this.trackTex=TEX.track.clone(); this.trackTex.needsUpdate=true;
this.trackTex.wrapS=this.trackTex.wrapT=THREE.RepeatWrapping;
this.trackTex.repeat.set(1,4);
const trackMat=new THREE.MeshLambertMaterial({map:this.trackTex});
for(const sx of [-1.62,1.62]){
const tr=new THREE.Mesh(new THREE.BoxGeometry(0.62,0.92,L+0.25),trackMat);
tr.position.set(sx,0.68,0); this.grp.add(tr);
for(let i=0;i<5;i++){
const wh=new THREE.Mesh(new THREE.CylinderGeometry(0.36,0.36,0.66,10),matB);
wh.rotation.z=HPI;
wh.position.set(sx,0.42,-L/2+0.75+i*(L-1.5)/4);
wh.userData={sx,lz:-L/2+0.75+i*(L-1.5)/4,vy:0,baseY:0.42};
this.grp.add(wh); this.wheels.push(wh);
}
}
this.turretG=new THREE.Group(); this.turretG.position.y=1.78; this.grp.add(this.turretG);
if(D.heavy){
const tb=new THREE.Mesh(new THREE.BoxGeometry(2.2,0.72,2.6),this.matBody); tb.position.y=0.12; this.turretG.add(tb);
const tf=new THREE.Mesh(new THREE.BoxGeometry(2.2,0.6,0.5),this.matBody); tf.position.set(0,0.1,1.4); tf.rotation.x=-0.35; this.turretG.add(tf);
} else {
const tc=new THREE.Mesh(new THREE.CylinderGeometry(1.15,1.28,0.72,12),this.matBody); tc.position.y=0.12; this.turretG.add(tc);
}
const cup=new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.38,0.28,10),this.matBody);
cup.position.set(D.heavy?-0.55:-0.4,0.56,-(D.heavy?0.5:0.3)); this.turretG.add(cup);
this.pitchG=new THREE.Group(); this.pitchG.position.set(0,0.15,D.heavy?1.5:1.05); this.turretG.add(this.pitchG);
const mant=new THREE.Mesh(new THREE.BoxGeometry(0.85,0.6,0.4),this.matBody); this.pitchG.add(mant);
const bar=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.13,D.barrelL,8),matB);
bar.position.set(0,0.02,D.barrelL/2); bar.rotation.x=HPI; this.pitchG.add(bar);
if(D.heavy){
const mb=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.16,0.42,8),matB);
mb.position.set(0,0.02,D.barrelL-0.1); mb.rotation.x=HPI; this.pitchG.add(mb);
}
const coax=new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.05,0.9,6),matB);
coax.position.set(0.42,-0.05,0.7); coax.rotation.x=HPI; this.pitchG.add(coax);
this.barrelTip=D.barrelL+(D.heavy?1.6:1.15);
this.grp.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
world.add(this.grp);
}
aimDir(){
const a=this.yaw+this.turretYaw, p=this.turretPitch;
return V3(Math.sin(a)*Math.cos(p),Math.sin(p),Math.cos(a)*Math.cos(p));
}
coaxMuzzle(){
const a=this.yaw+this.turretYaw;
const sn=Math.sin(a),cs=Math.cos(a);
return V3(this.pos.x+cs*0.42+sn*2.2,this.pos.y+1.88,this.pos.z-sn*0.42+cs*2.2); // 前向 2.2 与视觉管口对齐 (P2-20: 旧 1.25 缩在管中)
}
update(dt){
// 炮管可见性单点维护: 仅玩家乘本车且开车长镜(炮手镜)时隐藏防穿模, 其余状态(下车/第三人称跟车/残骸)一律恢复
// (旧实现只在 20-player 相机分支里切 visible, 下车后无人恢复 → 车外看坦克光秃秃没炮管)
this.pitchG.visible=!(this.playerDriven&&player.tankView);
	if(!this.alive){
	this.respawnT-=dt*tankRespawnMul(this.team); // 厂房在手: 苏军坦克重生倒计时倍速消耗 (22~29s)
	this.engine.update(0,0);
	// 兵力票归零 → 该队坦克封重生 (清场阶段敌方不再补充载具, 2026-09-04)
	if(this.respawnT<=0&&!matchOver&&tickets[this.team]>0) this.respawn();
	return;
	}
	this.cannonCd-=dt; this.mgT-=dt; this.mgPause-=dt;
	// 深谷激流: 坦克误入河道即熄火受淹 (AI寻路只会走大桥)
	if(inRiverChannel(this.pos.x,this.pos.z)){
	this.vel=dampF(this.vel,0,5,dt);
	this.takeDmg(VEH_RAPIDS_DMG*dt,null,true); // 激流属于环境惩罚, 不享受装甲减免
	if(this.playerDriven&&Math.random()<dt*2) showScorePop('⚠ 激流熄火! 快倒车离开河道');
	}
// 无人闲置的坦克脱战后缓慢检修回血, 修到40%以上AI步兵才会重新接管
if(!this.playerDriven&&!this.crewBot&&this.hp<this.maxHp&&nowT-(this.lastDmgT||-99)>10){
this.hp=Math.min(this.maxHp,this.hp+this.maxHp*0.025*dt);
}
const dCam=this.pos.distanceTo(camera.position);
this.engine.update(58+Math.abs(this.vel)*7, clamp(0.3-dCam/110,0,0.3)*(0.55+Math.abs(this.vel)*0.08));
// 乘员严重受损时弃车逃生
if(this.crewBot&&!this.playerDriven&&this.hp<this.maxHp*0.25){
this.crewBot.dismountVehicle(true);
}
if(this.crewBot&&this.crewBot.alive&&!this.playerDriven){ this.driveAI(dt); this.turretAI(dt); }
else if(!this.playerDriven){ this.vel=dampF(this.vel,0,4,dt); }
const sn=Math.sin(this.yaw), cs=Math.cos(this.yaw);
// 坡度物理 (2026-09-12 百团改版, 全战役生效): 上坡 30°起渐进减速, TANK_SLOPE_MAX(70°)以上封死(等高线滑移);
// 下坡永不硬封、只走减速带 —— 这是防卡死阀门: 对称封坡时, 凸形崖壁上"最后一步中点坡度≤限值但落点局部
// 坡度>限值", 倒车第一步中点坡度更大 → 进退不得。下坡放行后: 直壁下崖=单向慢爬 (沟壑=史实反坦克壕,
// 下去就得出坡道/渡口), AI 坦克由 OCC 沟壁占用格挡住不会下崖。
let mvx=sn*this.vel*dt, mvz=cs*this.vel*dt;
{
const dist=Math.hypot(mvx,mvz);
if(dist>1e-5){
const h0=heightAt(this.pos.x,this.pos.z), h1=heightAt(this.pos.x+mvx,this.pos.z+mvz);
const dh1=h1-h0;
const sl=Math.abs(dh1)/dist, lim=Math.tan(TANK_SLOPE_MAX*DEG);
if(dh1>0&&sl>lim){
const gx=heightAt(this.pos.x+2,this.pos.z)-heightAt(this.pos.x-2,this.pos.z);
const gz=heightAt(this.pos.x,this.pos.z+2)-heightAt(this.pos.x,this.pos.z-2);
const gl=Math.hypot(gx,gz);
if(gl>1e-4){
const cx2=-gz/gl, cz2=gx/gl, t2=(mvx*cx2+mvz*cz2)*0.9;
mvx=cx2*t2; mvz=cz2*t2;
}else{ mvx=0; mvz=0; }
this.vel*=0.55;
}else if(sl>Math.tan(30*DEG)){
// 30°→70° 减速至 30%; 下坡超过 70° 时公式会外推出负系数(=不动点冻结), 故钳 12% 爬行挡下限
const f=Math.max(0.12,1-(sl-Math.tan(30*DEG))/(lim-Math.tan(30*DEG))*0.7);
mvx*=f; mvz*=f;
}
}
}
this.pos.x+=mvx; this.pos.z+=mvz;
	// 底盘对齐碰撞: 沿车体轴线三个圆, 两遍推挤解算减少楔入卡死;
	// 按撞击法线与行进方向的夹角保留车速: 直撞重挫, 斜擦可贴墙滑行
	// (旧实现任意接触 vel*=0.5, 轻微擦碰就降到爬行, 极易进退两难)
	let hitObstacle=false;
	for(let pass=0;pass<2;pass++){
	for(const off of [-1.95,0,1.95]){
	const cxp=this.pos.x+sn*off, czp=this.pos.z+cs*off;
	// 2026-09-06 B5/P0-2: 全量扫描改 RGRID 邻近候选 (推挤测试半径 1.55, 查询余量至 1.56)
	eachBoxNear(cxp-1.56,czp-1.56,cxp+1.56,czp+1.56,b=>{
	if(b.dead||this.pos.y+2<b.minY||this.pos.y>b.maxY) return;
	if(b.maxY-b.gh<0.7) return;
	const cx=clamp(cxp,b.minX,b.maxX), cz=clamp(czp,b.minZ,b.maxZ);
	const dx=cxp-cx, dz=czp-cz;
	const d2=dx*dx+dz*dz;
	if(d2>=1.55*1.55) return;
	// 坦克冲撞可毁墙体: 车速足够时直接撞塌整段结构
	if(b.dGroup&&!b.dGroup.dead&&Math.abs(this.vel)>1.9){
	destroyStructure(b.dGroup);
	this.vel*=0.58;
	this.suspPV-=Math.sign(this.vel)*0.9;
	if(this.playerDriven) addTrauma(0.28);
	return;
	}
	// 2026-09-02 越野碾压: 掩体(沙袋/木箱/石墙/树篱/倒木, 挂牌 crush)车速足够时直接碾毁通过, 不再被阻拦
	if(b.crush&&Math.abs(this.vel)>1.5){
	crushCoverBox(b);
	this.vel*=0.92;
	this.suspPV-=Math.sign(this.vel)*0.25;
	if(this.playerDriven) addTrauma(0.12);
	return;
	}
	// 2026-09-04 越野跨越: 低矮且无法摧毁的障碍(自身高度≤1.3m: 顶面相对其地面, 无 dGroup 可撞塌/无 crush 可碾毁)
	// 直接放行不阻挡不碾毁, 底盘高度由 tankRideH 抬升作出爬越效果
	if(!b.dGroup&&!b.crush&&b.maxY-b.gh<=TANK_STEP) return;
	let pnx=0, pnz=0;
	if(d2>1e-8){
	const d=Math.sqrt(d2);
	pnx=dx/d; pnz=dz/d;
	const push=Math.min(0.35,(1.55-d)/d); // 推挤限幅: 防深穿一帧瞬移再撞别处
	this.pos.x+=dx*push; this.pos.z+=dz*push;
	} else {
	// 圆心已进入盒内: 沿穿透最浅轴整体顶出, 防楔死原地
	const l=Math.min(cxp-b.minX,b.maxX-cxp), r2=Math.min(czp-b.minZ,b.maxZ-czp);
	if(l<r2){ pnx=(cxp-b.minX<b.maxX-cxp)?-1:1; this.pos.x+=pnx*(l+1.55); }
	else { pnz=(czp-b.minZ<b.maxZ-czp)?-1:1; this.pos.z+=pnz*(r2+1.55); }
	}
	if(pass===0){
	const mvX=sn*Math.sign(this.vel), mvZ=cs*Math.sign(this.vel);
	const facing=-(pnx*mvX+pnz*mvZ);
	this.vel*=facing>0.5?0.35:facing>0.15?0.66:0.92;
	}
	hitObstacle=true;
	});
	eachCylNear(cxp-3.7,czp-3.7,cxp+3.7,czp+3.7,c=>{
	if(c.r<0.3) return;
	// 2026-09-04 越野跨越: 低矮圆柱(油桶/石碾/碎石堆等不可摧毁, 自身高度≤1.3m)直接驶过, 高度由 tankRideH 承接
	if(c.y1-c.y0<=TANK_STEP) return;
	const dx=cxp-c.x, dz=czp-c.z;
	const rr=c.r+1.5, d2=dx*dx+dz*dz;
	if(d2<rr*rr&&d2>1e-8){
	const d=Math.sqrt(d2), push=Math.min(0.3,(rr-d)/d*0.6);
	this.pos.x+=dx*push; this.pos.z+=dz*push;
	this.vel*=0.75;
	hitObstacle=true;
	}
	});
	}
	}
if(hitObstacle&&this.isAI) this.stuckT+=dt*2.2;
for(const t2 of tanks){
if(t2===this||!t2.alive) continue;
const dx=this.pos.x-t2.pos.x, dz=this.pos.z-t2.pos.z;
const d2=dx*dx+dz*dz;
if(d2<4.6*4.6&&d2>1e-6){
const d=Math.sqrt(d2), push=(4.6-d)/d*0.5;
this.pos.x+=dx*push; this.pos.z+=dz*push;
}
}
const lim=MAP_SIZE/2+6;
this.pos.x=clamp(this.pos.x,-lim,lim); this.pos.z=clamp(this.pos.z,-lim,lim);
// 碾平铁丝网
if(Math.abs(this.vel)>0.8&&wires.length){
for(let wi=wires.length-1;wi>=0;wi--){
const w=wires[wi];
const dxw=w.x-this.pos.x, dzw=w.z-this.pos.z;
if(dxw*dxw+dzw*dzw<2.8*2.8){
if(w.grp) world.remove(w.grp);
wires.splice(wi,1);
for(let k=0;k<3;k++) spawnP(PT.dirt,w.x+rand(-1,1),heightAt(w.x,w.z)+0.3,w.z+rand(-1,1),rand(-1,1),rand(0.5,1.2),rand(-1,1),rand(0.25,0.4),0.6,rand(0.4,0.7),0.8,2);
markNavDirty();
}
}
}
// 底盘高度: 地面与可跨越障碍顶面的较高者 (2026-09-04 越野跨越)
this.pos.y=dampF(this.pos.y,tankRideH(this.pos.x,this.pos.z,this.pos.y),8,dt);
// 碾压植被: 行进中撞上树顺势撞倒 (倒向车头方向), 灌木直接碾没 (见 04b-fire)
if(Math.abs(this.vel)>0.8&&typeof floraCrushTank==='function') floraCrushTank(this);
// 实体碰撞: 步兵无法穿入车体; 友军挤开, 敌军按行进方向与车速判定碾压
vehiclePushSoldiers(this,2.05,this.def.hullL/2+0.45,{dt,crusher:this.playerDriven?player:(this.crewBot||this.crew),moving:Math.abs(this.vel)>1.2,yMax:1.9,frontalBand:1.5,symmetricFrontal:false,crushDmg:320,pushVel:Math.abs(this.vel)});
// 履带滚动与路轮
this.trackTex.offset.y-=this.vel*dt*0.55;
for(const wh of this.wheels) wh.rotation.x+=this.vel*dt/0.36;
// 悬挂: 地形姿态 + 加减速俯仰弹簧 (采样面含可跨越障碍顶面 → 跨越时前后轮先后抬落, 车体俯仰颠簸)
const sn2=Math.sin(this.yaw), cs2=Math.cos(this.yaw);
const hF=tankSurfH(this.pos.x+sn2*2.4,this.pos.z+cs2*2.4), hB=tankSurfH(this.pos.x-sn2*2.4,this.pos.z-cs2*2.4);
// 左侧采样: (-cs,+sn) 垂直于行进方向
const hL=tankSurfH(this.pos.x-cs2*1.6,this.pos.z+sn2*1.6), hR=tankSurfH(this.pos.x+cs2*1.6,this.pos.z-sn2*1.6);
const accel=(this.vel-this.lastVel)/Math.max(dt,0.001); this.lastVel=this.vel;
const tgtP=-Math.atan2(hF-hB,4.8)-clamp(accel*0.011,-0.09,0.09);
const tgtR=Math.atan2(hR-hL,3.2);
this.suspPV+=((tgtP-this.suspP)*46-this.suspPV*7.5)*dt;
this.suspP+=this.suspPV*dt;
this.suspRV+=((tgtR-this.suspR)*46-this.suspRV*7.5)*dt;
this.suspR+=this.suspRV*dt;
// 每个路轮独立行程: 采样各自地面高度, 弹簧上下浮动
for(const wh of this.wheels){
const ud=wh.userData;
const wx=this.pos.x+sn2*ud.lz+cs2*ud.sx;
const wz=this.pos.z+cs2*ud.lz-sn2*ud.sx;
const wgh=tankSurfH(wx,wz);
const hullY=this.pos.y-this.suspP*ud.lz+this.suspR*ud.sx;
const tgtY=ud.baseY+clamp(wgh-hullY,-0.17,0.17);
ud.vy+=((tgtY-wh.position.y)*70-ud.vy*9)*dt;
wh.position.y+=ud.vy*dt;
}
this.grp.position.copy(this.pos);
this.grp.rotation.order='YXZ';
this.grp.rotation.set(this.suspP,this.yaw,this.suspR);
this.turretG.rotation.y=this.turretYaw;
this.pitchG.rotation.x=-this.turretPitch;
const dir=this.aimDir();
this.muzzle.set(this.pos.x+dir.x*this.barrelTip,this.pos.y+1.93+dir.y*this.barrelTip,this.pos.z+dir.z*this.barrelTip);
if(this.hp<this.maxHp*0.45){
this.smokeT-=dt;
if(this.smokeT<=0){ this.smokeT=0.12;
spawnP(PT.dark,this.pos.x+rand(-0.8,0.8),this.pos.y+1.8,this.pos.z+rand(-0.8,0.8),rand(-0.3,0.3),rand(1,2),rand(-0.3,0.3),0.7,1.4,rand(0.8,1.4),0.7,0.2);
}
}
}
driveAI(dt){
this.thinkCD-=dt; this.repathT-=dt;
if(this.thinkCD<=0){
this.thinkCD=rand(0.6,0.9);
if(GAMEMODE==='demolition'){
const dp=nearestDepot(this.pos.x,this.pos.z);
const bf=dp?{x:dp.x,z:dp.z}:FLAGS[0];
if(!this.objective||this.objective.x!==bf.x){ this.objective=bf; this.repathT=0; }
} else if(GAMEMODE==='clash'){
// 遭遇战: 无旗点 —— 坦克向最近的敌方前哨/敌基推进, 到位后原地炮战
if(!this.objective){
const cands=spawnPtsOf(1-this.team).map(s=>({x:s.x,z:s.z}));
const eb=BASES.length?BASES[1-this.team]:basePos(1-this.team);
cands.push({x:eb.x,z:eb.z});
let best=null,bd=1e9;
for(const c of cands){
const d=Math.hypot(c.x-this.pos.x,c.z-this.pos.z)+rand(0,50);
if(d<bd){ bd=d; best=c; }
}
this.objective=best?{x:best.x,z:best.z}:null;
this.repathT=0;
}
} else if(GAMEMODE==='convoy'){
// 劫道: 护运方坦克跟随车队 (劫道方无坦克)
const escT=(CAMPAIGN.convoy&&CAMPAIGN.convoy.escortTeam!==undefined)?CAMPAIGN.convoy.escortTeam:1;
if(this.team===escT){
let best=null,bd=1e9;
for(const t of trucks){
if(!t.alive) continue;
const d=Math.hypot(t.pos.x-this.pos.x,t.pos.z-this.pos.z);
if(d<bd){ bd=d; best=t; }
}
if(best){ this.objective={x:best.pos.x,z:best.pos.z}; this.repathT=0; }
}
} else {
const retreat=this.hp<this.maxHp*0.26;
let best=null,bs=-1e9;
for(const f of FLAGS){
let sc=-Math.hypot(f.x-this.pos.x,f.z-this.pos.z)*0.8;
if(retreat){ if(f.owner===this.team) sc+=200; }
else {
if(f.owner!==this.team) sc+=130;
if(f.owner===this.team&&f.capTeam!==-1&&f.capTeam!==this.team) sc+=220;
// 与友方坦克分散
for(const t2 of tanks){ if(t2!==this&&t2.alive&&t2.team===this.team&&t2.objective===f) sc-=90; }
}
sc+=rand(0,30);
if(sc>bs){ bs=sc; best=f; }
}
if(this.objective!==best){ this.objective=best; this.repathT=0; }
}
}
const f=this.objective;
if(!f) return;
// 倒车脱困
if(this.reverseT>0){
this.reverseT-=dt;
this.vel=dampF(this.vel,-this.def.rev,3,dt);
this.yaw+=this.revTurn*dt;
if(this.reverseT<=0){ this.repathT=0; this.stuckT=0; }
return;
}
const dObj=Math.hypot(f.x-this.pos.x,f.z-this.pos.z);
const engagedStop=this.tTarget&&this.tTarget.kind==='tank'&&this.tMemT>0&&this.losOK&&this.tDist<110;
if(dObj<20||engagedStop){
this.vel=dampF(this.vel,0,4,dt);
this.path=null;
return;
}
// A*寻路
if(!this.path||this.repathT<=0){
NAV.budget=Math.max(NAV.budget,1);
this.path=NAV.findPath(this.pos.x,this.pos.z,f.x+rand(-6,6),f.z+rand(-6,6));
this.pathI=0; this.repathT=rand(5,7); this.progT=0;
}
let steer=null;
if(this.path&&this.pathI<this.path.length){
const wp=this.path[this.pathI];
const dx=wp[0]-this.pos.x, dz=wp[1]-this.pos.z;
if(dx*dx+dz*dz<20){ this.pathI++; }
else steer=Math.atan2(dx,dz);
}
if(steer===null){ steer=Math.atan2(f.x-this.pos.x,f.z-this.pos.z); }
// 宽车体触须微调
let bestAng=0,found=false;
for(const a of [0,0.3,-0.3,0.6,-0.6]){
const px=this.pos.x+Math.sin(steer+a)*6.5, pz=this.pos.z+Math.cos(steer+a)*6.5;
const lx=Math.cos(steer+a)*1.3, lz=-Math.sin(steer+a)*1.3;
if(!occBlocked(px,pz)&&!occBlocked(px+lx,pz+lz)&&!occBlocked(px-lx,pz-lz)){ bestAng=a; found=true; break; }
}
if(found) steer+=bestAng;
const diff=angDiff(this.yaw,steer);
this.yaw=angleLerpTo(this.yaw,steer,this.def.turn*dt);
this.vel=dampF(this.vel,Math.abs(diff)>0.75?2.0:this.def.spd,3,dt);
// 进度式卡住检测
this.progT+=dt;
if(this.progT>1.1){
if(this.pos.distanceTo(this.lastPos)<1.0){
this.stuckT+=1;
this.reverseT=rand(1.2,1.8);
this.revTurn=(Math.random()<0.5?1:-1)*0.5;
if(this.stuckT>=4&&this.crewBot){ this.crewBot.dismountVehicle(false); this.stuckT=0; }
} else this.stuckT=Math.max(0,this.stuckT-1);
this.lastPos.copy(this.pos);
this.progT=0;
}
}
turretAI(dt){
// 目标选择: 贴近步兵/反坦克威胁 > 敌坦克 > 远处步兵
if(this.tMemT>0) this.tMemT-=dt;
this.retargetT=(this.retargetT||0)-dt;
if(this.retargetT<=0){
this.retargetT=0.4;
let best=null,bs=-1e9,bd=0;
for(const t of tanks){
if(!t.alive||t.team===this.team) continue;
const d=t.pos.distanceTo(this.pos);
if(d<260){ const sc=170-d*0.45; if(sc>bs){ bs=sc; best=t; bd=d; } }
}
for(const s of combatants){
if(!s.alive||s.team===this.team||s.onVehicle||s.spectator) continue;
const d=Math.hypot(s.pos.x-this.pos.x,s.pos.z-this.pos.z);
if(d>140) continue;
if(SMOKES.length&&smokeBlocksLOS(this.pos.x,this.pos.y+1.9,this.pos.z,s.pos.x,s.pos.y+1,s.pos.z)) continue;
if(CROP_FIELDS.length&&cropBlocksLOS(this.pos.x,this.pos.y+1.9,this.pos.z,s.pos.x,s.pos.y+1,s.pos.z)) continue;
let sc=90-d*0.9;
if(d<30) sc+=110;
const atThreat=s.cls===5||(s.atn||0)>0||(s.atNades||0)>0;
if(atThreat) sc+=(d<70?150:60);
if(s.empUse&&s.empUse.kind==='at') sc+=260;
else if(s.mgUse||s.empUse) sc+=70;
if(sc>bs){ bs=sc; best=s; bd=d; }
}
if(best){
if(best!==this.tTarget){ this.aimReact=rand(0.7,1.3)*DIFF_TABLE[SETTINGS.diff].react*2+0.35; this.losOK=false; }
this.tTarget=best; this.tMemT=4; this.tDist=bd;
}
else if(this.tMemT<=0){ this.tTarget=null; this.losOK=false; }
}
let aimYaw=null, aimPitch=0;
const tgt=this.tTarget&&(this.tTarget.alive!==false)?this.tTarget:null;
if(tgt){
const isTank=tgt.kind==='tank';
const lead=isTank?clamp(this.tDist/SHELL_SPD,0,1.2):0;
const tx=tgt.pos.x+(isTank?Math.sin(tgt.yaw)*tgt.vel*lead:0);
const tz=tgt.pos.z+(isTank?Math.cos(tgt.yaw)*tgt.vel*lead:0);
aimYaw=Math.atan2(tx-this.pos.x,tz-this.pos.z);
const dh=Math.hypot(tx-this.pos.x,tz-this.pos.z);
aimPitch=clamp(Math.atan2((tgt.pos.y+(isTank?1.3:1.0))-(this.pos.y+1.93),Math.max(dh,2)),-0.15,0.3);
} else if(this.threatYaw!==null){
aimYaw=this.threatYaw;
}
this.aimReact=(this.aimReact||0)-dt;
if(aimYaw!==null){
const wantTY=angDiff(this.yaw,aimYaw);
// 拟人反应: 未反应时炮塔转速减半且不开火
const rate=this.def.tRate*0.6*(this.aimReact>0?0.45:1);
this.turretYaw=angleLerpTo(this.turretYaw,wantTY,rate*dt);
this.turretPitch=dampF(this.turretPitch,aimPitch,3,dt);
if(tgt&&this.aimReact<=0&&Math.abs(angDiff(this.turretYaw,angDiff(this.yaw,aimYaw)))<0.05){
const dir=this.aimDir();
const o=this.muzzle.clone();
const dh=Math.hypot(tgt.pos.x-this.pos.x,tgt.pos.z-this.pos.z);
const isTank=tgt.kind==='tank';
if(this.cannonCd<=0&&(isTank||dh>10)){
const chk=raycastWorld(o,dir,dh);
this.losOK=(!chk||chk.dist>dh-3.5);
if(this.losOK&&SMOKES.length&&smokeBlocksLOS(o.x,o.y,o.z,tgt.pos.x,tgt.pos.y+1.2,tgt.pos.z)) this.losOK=false;
if(this.losOK&&CROP_FIELDS.length&&cropBlocksLOS(o.x,o.y,o.z,tgt.pos.x,tgt.pos.y+1.2,tgt.pos.z)) this.losOK=false;
if(this.losOK){ this.fireCannon(); }
else this.cannonCd=0.6;
}
// 同轴机枪打步兵
if(!isTank&&dh<95&&this.mgT<=0&&this.mgPause<=0){
if(this.mgBurst<=0) this.mgBurst=randi(7,12);
this.mgT=0.09;
const mdir=dir.clone();
mdir.x+=rand(-0.022,0.022); mdir.y+=rand(-0.015,0.015); mdir.z+=rand(-0.022,0.022); mdir.normalize();
const mo=this.coaxMuzzle();
(this.crewBot||this.crew)._src=this.name; // 同轴机枪击杀来源: 载具名
fireBullet(this.crewBot||this.crew,mo,mdir,MG_BULLET_DEF,mo);
if(--this.mgBurst<=0) this.mgPause=rand(0.35,0.8);
}
}
}
}
fireCannon(customDir){
if(this.cannonCd>0) return;
this.cannonCd=this.def.reload;
let dir=this.aimDir();
if(customDir) dir=customDir;
else if(this.isAI){
const err=0.011;
dir.x+=rand(-err,err); dir.y+=rand(-err,err)*0.6; dir.z+=rand(-err,err); dir.normalize();
}
const origin=this.muzzle.clone();
const shooter=this.playerDriven?player:(this.crewBot||this.crew);
shooter._src=this.name; // 坦克炮击杀来源: 载具名 (射手进炮即记入)
AudioSys.cannon(this.pos.distanceTo(camera.position));
spawnP(PT.flash,origin.x,origin.y,origin.z, dir.x*3,dir.y*3,dir.z*3, 1.0,10,0.12,1,0,true);
spawnP(PT.dark,origin.x,origin.y,origin.z, dir.x*3+rand(-1,1),1.5,dir.z*3+rand(-1,1), 1.0,3,0.9,0.7,0.5);
if(this.playerDriven) addTrauma(0.5);
this.suspPV-=0.55*Math.cos(this.turretYaw);
this.suspRV+=0.4*Math.sin(this.turretYaw);
shells.push({pos:origin.clone(),vel:dir.clone().multiplyScalar(SHELL_SPD),team:this.team,owner:shooter,life:4.5,kind:this.def.heavy?'heavy':'tank',dmgV:this.def.dmg,trail:0});
shooter.lastFiredT=nowT;
gunEvents.push({x:origin.x,z:origin.z,team:this.team,t:nowT,shooter});
}
firePlayerMG(dir){
if(this.mgT>0) return;
this.mgT=0.08*(player.streakBuff?player.streakBuff.reloadMul:1); // 连杀增益: 同轴机枪射速 (2026-09-12)
const o=this.coaxMuzzle();
player._src=this.name; // 玩家同轴机枪击杀来源: 载具名
fireBullet(player,o,dir,MG_BULLET_DEF,o);
AudioSys.gunshot('mg',0,0);
addTrauma(0.02);
}
takeDmg(amt,attacker,ap){
if(!this.alive) return;
// 2026-09-02 装甲抗性: 非反装甲伤害(未标记 ap)按 TANK_ARMOR 减免 —— 轻武器/火烧只是挠痒,
// 只有巡飞弹/坦克炮/固定炮/反坦克攻击(ap=true)才能重创坦克
if(!ap) amt*=TANK_ARMOR;
this.hp-=amt;
this.lastDmgT=nowT;
if(this.playerDriven){ addDmgFlash(0.35); addTrauma(0.3); }
else if(attacker&&attacker.pos){
this.threatYaw=Math.atan2(attacker.pos.x-this.pos.x,attacker.pos.z-this.pos.z);
setTimeout(()=>{ if(this.threatYaw!==null) this.threatYaw=null; },6000);
}
if(this.hp<=0) this.die(attacker);
}
die(attacker){
this.alive=false;
this.respawnT=rand(40,52);
this.vel=0; this.crew.alive=false;
if(this.playerDriven){
this.playerDriven=false;
player.onVehicle=null;
player.damage(999,attacker,false);
}
if(this.crewBot){
const cb=this.crewBot;
this.crewBot=null;
cb.onVehicle=null;
cb.mesh.root.visible=true;
cb.pos.set(this.pos.x,this.pos.y,this.pos.z+1.5);
cb.damage(999,attacker,false);
}
if(attacker&&attacker.team!==this.team){
attacker.kills=(attacker.kills||0)+1;
// 玩家得分取 registerKillScore 返回值 (含连杀倍率, 2026-09-11); Bot 仍按基础分
if(attacker.isPlayer) attacker.score=(attacker.score||0)+registerKillScore('摧毁坦克',SCORE_TABLE.tank);
else attacker.score=(attacker.score||0)+SCORE_TABLE.tank;
addKillfeed(attacker,{name:this.name,team:this.team,isPlayer:false},false);
}
tickets[this.team]=Math.max(0,tickets[this.team]-(this.def.heavy?TICKET_COST.tankHeavy:TICKET_COST.tankLight));
explosionFX(this.pos.clone().add(V3(0,1.4,0)));
AudioSys.explosion(this.pos.distanceTo(camera.position));
this.grp.traverse(o=>{ if(o.isMesh){ if(!o.userData.mat0) o.userData.mat0=o.material; o.material=wreckMat; } });
this.grp.rotation.x=this.suspP+rand(-0.1,0.1);
const wsn=Math.sin(this.yaw), wcs=Math.cos(this.yaw);
this.wreckBs=[];
for(const off of [-1.9,0,1.9]){
this.wreckBs.push(registerDynCollider(this.pos.x+wsn*off,this.pos.y+0.95,this.pos.z+wcs*off,2.5,1.9,2.5));
}
// 燃烧残骸 = 持续火源: 点燃周围植被, 灼烧贴近的步兵 (击杀归击毁者), 残骸停留期内燃烧
const restT=rand(24,30);
this.fireSrc=addFireSource(this.pos.x,this.pos.z,this.pos.y+1.3,3.3,restT,22,attacker||null);
igniteArea(this.pos.x,this.pos.z,3.2,attacker||null);
explosionFlora(this.pos,5.5);
// 残骸停留 restT 秒后沉入地下: 开始下沉即熄火(不再是火源), 半沉撤碰撞, 全沉隐藏模型
// (模型体随坦克重生复用, "删除"即隐藏; 重生时恢复可见)
if(this.sinkJob) finishSinkJob(this.sinkJob);
const self=this;
this.sinkJob=queueSink({objs:[this.grp],depth:4.2,rest:restT,sink:4,noRemove:true,
onRest(){ if(self.fireSrc){ removeFireSource(self.fireSrc); self.fireSrc=null; } },
onHalf(){ if(self.wreckBs){ for(const b of self.wreckBs) killDynCollider(b); self.wreckBs=null; } },
onDone(){ self.grp.visible=false; self.sinkJob=null; }
});
}
respawn(silent,initial){
// 出生在基地前方开阔地, 避免卡基地围墙; 空车等待步兵上车
// 无基地战役(劫道): 出生在本阵营主力前出点旁 (护运坦克=谷口集结地)
// 提前结清上一轮残骸的下沉任务与火源 (残骸模型体重生复用)
if(this.sinkJob){ finishSinkJob(this.sinkJob); this.sinkJob=null; }
if(this.fireSrc){ removeFireSource(this.fireSrc); this.fireSrc=null; }
const bp=basePos(this.team);
// 同variant多车(东线4辆/西线3辆)按队内序号错位前后排, 避免叠在同一点 (2026-09-02 加载具配套)
const ord=tanks.filter(t=>t.team===this.team).indexOf(this);
// 厂房产能 (2026-09-06 斯大林格勒): 苏军持"厂房"旗 → 战损坦克重生在红十月厂区西停车场
// (双列×4 位, 列距 8m 行距 11m, 车头朝南对车辆大门); 沦陷/中立 → 回主基地, 加速同步失效;
// 开局首生成(initial)不走此分支 —— 开局坦克仍从主基地出发投入战线
if(!initial&&this.team===0&&FACTORY_FLAG&&FACTORY_FLAG.owner===0&&FACTORY_SPAWN&&BASES.length){
const fcol=Math.floor(ord/4), frow=ord%4;
this.pos.set(FACTORY_SPAWN.x+fcol*8,0,FACTORY_SPAWN.z+(frow-1.5)*11);
this.pos.y=heightAt(this.pos.x,this.pos.z);
this.yaw=FACTORY_SPAWN.yaw||0;
} else {
const colSide=this.variant===0?1:-1;
const rowN=Math.floor(ord/2);
const zo=BASES.length? colSide*10-rowN*16 : (this.variant===0?4:-4)-rowN*8;
this.pos.set(bp.x+(this.team===0?15:-15),0,bp.z+zo);
this.pos.y=heightAt(this.pos.x,this.pos.z);
this.yaw=this.team===0?HPI:-HPI;
}
this.turretYaw=0; this.turretPitch=0;
this.hp=this.maxHp; this.alive=true; this.isAI=true; this.playerDriven=false;
this.crew.alive=true;
this.crewBot=null; this.claimBot=null; this.noEnterT=0;
this.stuckT=0; this.vel=0; this.path=null; this.reverseT=0; this.tTarget=null; this.threatYaw=null;
this.suspP=0; this.suspR=0; this.suspPV=0; this.suspRV=0;
if(this.wreckBs){ for(const b of this.wreckBs) killDynCollider(b); this.wreckBs=null; }
this.grp.visible=true;
this.grp.rotation.set(0,this.yaw,0);
this.grp.traverse(o=>{ if(o.isMesh&&o.userData.mat0) o.material=o.userData.mat0; });
// 己方坦克战损重生: 文字播报让玩家知道本方坦克已回场 (silent=构造时首次生成)
if(!silent&&this.team===player.team) announceVehRespawn(this);
}
}
function enemyTankNear(sol,dist){
for(const t of tanks) if(t.alive&&t.team!==sol.team&&Math.hypot(t.pos.x-sol.pos.x,t.pos.z-sol.pos.z)<dist) return t;
return null;
}
function nearestDepot(x,z){
let best=null,bd=1e9;
for(const d of DEPOTS){
if(d.destroyed) continue;
const dd=Math.hypot(d.x-x,d.z-z);
if(dd<bd){ bd=dd; best=d; }
}
return best;
}
function updateShells(dt){
for(let i=shells.length-1;i>=0;i--){
const s=shells[i];
s.life-=dt;
if(s.life<=0){ shells.splice(i,1); continue; }
const step=s.vel.length()*dt;
const dir=s.vel.clone().normalize();
	s.vel.y-=SHELL_G*dt;
s.trail-=dt;
if(s.trail<=0){ s.trail=0.05; spawnP(PT.spark,s.pos.x,s.pos.y,s.pos.z,0,0,0,0.16,-0.1,0.09,1,0,true); }
let hitD=step+0.5, hit=null, hitTank=null, hitTruck=null, hitSol=null;
const wr=raycastWorld(s.pos,dir,hitD);
if(wr){ hitD=wr.dist; hit=wr; }
for(const t of tanks){
if(!t.alive||t.team===s.team) continue;
const r=rayCyl(s.pos,dir,vehHitCyl(t),hitD);
if(r){ hitD=r.t; hit=r; hitTank=t; hitSol=null; }
}
for(const t of trucks){
if(!t.alive||t.team===s.team) continue;
const r=rayCyl(s.pos,dir,truckHitCyl(t),hitD);
if(r){ hitD=r.t; hit=r; hitTruck=t; hitTank=null; hitSol=null; }
}
const sr=raySoldiers(s.pos,dir,hitD,{team:s.team,isPlayer:false});
if(sr){ hitD=sr.t; hitSol=sr.sol; hitTank=null; hitTruck=null; hit=sr; }
if(hit){
const p=V3(s.pos.x+dir.x*hitD,s.pos.y+dir.y*hitD,s.pos.z+dir.z*hitD);
if(hitTank){ hitTank.takeDmg(s.dmgV?s.dmgV+rand(-30,30):(s.kind==='at'?rand(300,380):rand(260,330)),s.owner,true); }
if(hitTruck){ hitTruck.takeDmg(s.dmgV?s.dmgV+rand(-30,30):(s.kind==='at'?rand(300,380):rand(260,330)),s.owner); }
if(hitSol){ hitSol.damage(260,s.owner,false); }
explosionFXSmall(p);
AudioSys.explosion(p.distanceTo(camera.position)*1.6);
splashDamage(p,s.owner,s.team,7,s.kind==='at'?70:150,110,true);
damageStructures(p,7.5,s.kind==='at'?180:300);
shells.splice(i,1);
continue;
}
s.pos.addScaledVector(dir,step);
}
}
function explosionFXSmall(p){
spawnP(PT.flash,p.x,p.y+0.3,p.z,0,1,0, 1.6,10,0.12,1,0,true);
for(let i=0;i<6;i++) spawnP(PT.dark,p.x+rand(-0.5,0.5),p.y+rand(0.2,1),p.z+rand(-0.5,0.5), rand(-1.5,1.5),rand(1,3),rand(-1.5,1.5), rand(0.6,1),1.8,rand(0.7,1.3),0.8,0.6);
for(let i=0;i<6;i++) spawnP(PT.dirt,p.x,p.y+0.2,p.z, rand(-4,4),rand(2,6),rand(-4,4), rand(0.25,0.5),0.5,rand(0.5,0.9),0.9,8);
}
// 溅射已单源到 13-combat splashDamage (2026-09-06 B7b/P2-6)
