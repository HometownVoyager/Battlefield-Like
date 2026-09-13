// ─────────────────────────────────────────────
// 17-emplacements.js —— 反坦克炮/医疗箱/出生点
// 源: Index.original.html 第 6608-6767 行
// ─────────────────────────────────────────────
'use strict';
const ATGUNS=[], AAGUNS=[];
function atGun(x,z,face){
// 落点互斥: 炮+护盾+轮架+后掩护墙整机登记一个占位圈(墙尖距中心2.6m); 被占贴边外推, 无净位即放弃
const po=propFree(x,z,2.7)?[x,z]:propPushOut(x,z,2.7);
if(!po) return;
x=po[0]; z=po[1];
const g0=heightAt(x,z);
// 后方掩护墙降到0.5m: 低于炮管(0.85m), 360°回旋时炮管不再穿墙/挡弹
sandbagWall(x-Math.sin(face)*1.6,z-Math.cos(face)*1.6,3.5,face,0.5,false);
const gfit=groundFit(x,z,face,1.2,1.2);
const grp=new THREE.Group();
grp.position.set(x,gfit.y+0.85,z);
grp.rotation.order='YXZ';
grp.rotation.set(gfit.pitch,face,gfit.roll);
const yaw=new THREE.Group(); grp.add(yaw);
const pitch=new THREE.Group(); yaw.add(pitch);
const shield=new THREE.Mesh(new THREE.BoxGeometry(2.0,0.95,0.06),MAT.metal);
shield.position.set(0,0.15,0.30); yaw.add(shield);
const barrel=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.08,2.6,8),vmMats.gun);
barrel.rotation.x=HPI; barrel.position.z=1.3; pitch.add(barrel);
pitch.add(new THREE.Mesh(new THREE.BoxGeometry(0.32,0.3,0.6),vmMats.gunL));
const wl=new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.4,0.12,12),vmMats.gunL);
wl.rotation.z=HPI; wl.position.set(0.75,-0.35,0); grp.add(wl);
const wr2=wl.clone(); wr2.position.x=-0.75; grp.add(wr2);
grp.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
world.add(grp);
propTake(x,z,2.7); // 反坦克炮整机+掩护墙占位
CYLS.push({x,z,r:0.6,y0:g0,y1:g0+1.2});
ATGUNS.push({x,z,y:g0+0.85,face,grp,yaw,pitch,user:null,cd:0,cdLock:0,kind:'at'});
}
// yDeck: 塔顶/平台固定高度 (2026-09-09 柏林防空塔: 屋顶平台高炮; 省略=按地形取高)
function aaGun(x,z,yDeck){
const onDeck=yDeck!==undefined&&yDeck!==null;
if(!onDeck){
const po=propFree(x,z,1.2)?[x,z]:propPushOut(x,z,1.2);
if(!po) return;
x=po[0]; z=po[1];
}
const g0=onDeck?yDeck:heightAt(x,z);
const gfit=onDeck?{y:g0,pitch:0,roll:0}:groundFit(x,z,0,1.0,1.0);
const grp=new THREE.Group();
grp.position.set(x,gfit.y+1.15,z);
grp.rotation.order='YXZ';
grp.rotation.set(gfit.pitch,0,gfit.roll);
const yaw=new THREE.Group(); grp.add(yaw);
const pitch=new THREE.Group(); pitch.position.y=0.1; yaw.add(pitch);
const b1=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.06,1.7,8),vmMats.gun);
b1.rotation.x=HPI; b1.position.set(0.22,0,0.85); pitch.add(b1);
const b2=b1.clone(); b2.position.x=-0.22; pitch.add(b2);
pitch.add(new THREE.Mesh(new THREE.BoxGeometry(0.7,0.35,0.7),vmMats.gunL));
const ped=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.28,1.1,8),vmMats.gunL);
ped.position.y=-0.6; grp.add(ped);
const base=new THREE.Mesh(new THREE.CylinderGeometry(0.9,1.0,0.18,10),MAT.metal);
base.position.y=-1.1; grp.add(base);
grp.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
world.add(grp);
propTake(x,z,1.2);
CYLS.push({x,z,r:0.7,y0:g0,y1:g0+1.4});
AAGUNS.push({x,z,y:g0+1.25,grp,yaw,pitch,user:null,cd:0,cdLock:0,kind:'aa'});
}
// 反坦克炮/防空炮: 按旗点间隔与基地通用摆放
// 落点避障(全局互斥): 占用格(建筑/沙袋/弹药箱碰撞)+道具占位(树/箱/杂物/其他炮)+建筑足迹三重检查,
// 随机偏移失败再贴边外推, 全败返回 null → 调用方放弃该火力点, 绝不穿模
function findClearSpot(x,z,spread,r){
for(let t=0;t<14;t++){
const px=x+rand(-spread,spread), pz=z+rand(-spread,spread);
if(!occBlocked(px,pz)&&propFree(px,pz,r)&&freeSpot(px,pz,0.6)) return [px,pz];
}
const po=propPushOut(x,z,r);
if(po&&!occBlocked(po[0],po[1])&&freeSpot(po[0],po[1],0.6)) return po;
return null;
}
// 反坦克炮按相邻旗对中点摆放; 斯大林格勒 14 点改版后旗链拉长 —— 只在中带 (距图心 80m 内) 布炮,
// 避免两翼 home 区(纵深无敌方坦克常态化)堆满反坦克炮; 其他战役保持全旗对布放 (行为零变化)
const atMidBand=CAMPAIGN.id==='stalingrad';
for(let i=0;i<FLAGS.length-1;i++){
const a=FLAGS[i], b=FLAGS[i+1];
const mx=(a.x+b.x)/2, mz=(a.z+b.z)/2;
if(atMidBand&&Math.hypot(mx,mz)>80) continue;
if(onBridge(mx,mz)!==false) continue; // 桥面不布反坦克炮 (2026-09-12 胡康巨桥: 桥面留给通行/塔楼/桥头碉堡)
const sp=findClearSpot(mx,mz,10,2.7);
if(sp) atGun(sp[0],sp[1],Math.atan2(b.x-a.x,b.z-a.z)+HPI*(i%2?1:-1));
}
if(FLAGS.length>2){ const sp=findClearSpot(FLAGS[0].x,FLAGS[0].z,14,2.7); if(sp) atGun(sp[0],sp[1],rand(0,TAU)); }
if(BASES.length){
{ const p1=findClearSpot(BASES[0].x+(BASES[0].x<0?10:-10),BASES[0].z+10,8,1.2); if(p1) aaGun(p1[0],p1[1]); }
{ const p2=findClearSpot(BASES[1].x+(BASES[1].x<0?10:-10),BASES[1].z-10,8,1.2); if(p2) aaGun(p2[0],p2[1]); }
}
// 中央旗防空炮: 旗在桥面上时跳过 (胡康巨桥 —— 塔顶 FLAK_DECKS 高炮已覆盖, 桥心不摆炮挡行车道)
if(FLAGS.length&&onBridge(FLAGS[Math.floor(FLAGS.length/2)].x,FLAGS[Math.floor(FLAGS.length/2)].z)===false){
const fm=FLAGS[Math.floor(FLAGS.length/2)]; const p3=findClearSpot(fm.x,fm.z,12,1.2); if(p3) aaGun(p3[0],p3[1]);
}
// 塔顶高炮 (2026-09-09 柏林防空塔): FLAK_DECKS 由 05a flakTower 登记平台坐标/高度 —— 平台炮位固定不偏移
for(const d of FLAK_DECKS) aaGun(d.x,d.z,d.y);
// 无旗点战役 (遭遇/劫道): 阵营前出点各配反坦克炮+重机枪, 面向敌方基地
// 炮位/机枪位带垂直侧移(perp), 车队出发地等贴路前出点的工事不会被甩到路心
// 劫道(断崖公路)除外: 伏击山谷不设任何固定火力点
if(GAMEMODE!=='convoy'){
for(const sp of (CAMPAIGN.spawns||[])){
const eb=BASES[1-sp.team];
const face=Math.atan2(eb.x-sp.x,eb.z-sp.z);
const g1=findClearSpot(sp.x-Math.sin(face)*4+Math.cos(face)*4.5,sp.z-Math.cos(face)*4-Math.sin(face)*4.5,5,2.7);
if(g1) atGun(g1[0],g1[1],face);
const g2=findClearSpot(sp.x+Math.sin(face)*3-Math.cos(face)*4.5,sp.z+Math.cos(face)*3+Math.sin(face)*4.5,4,2.3);
if(g2) mg42(g2[0],g2[1],face,sp.team);
}
}
NAV.refresh();
function findFreeSpawn(x,z){
// 除占用格外必须避开建筑足迹: 屋顶/楼板高于 1.75m 不入占用格,
// 只查 occBlocked 会把玩家部署上屋顶 (standHeight 会站到顶面)
for(let r=0;r<7;r++){
for(let i=0;i<8;i++){
const px=x+rand(-2,2)+Math.cos(i*0.785)*r*1.6, pz=z+rand(-2,2)+Math.sin(i*0.785)*r*1.6;
if(!occBlocked(px,pz)&&freeSpot(px,pz,0.6)) return [px,pz];
}
}
return [x,z];
}
const MED_CRATES=[];
const medkitTex=(()=>{
const c=document.createElement('canvas'); c.width=64; c.height=64;
const g=c.getContext('2d');
g.fillStyle='#d8d4c4'; g.fillRect(0,0,64,64);
g.fillStyle='#b8b4a4'; g.fillRect(0,0,64,6); g.fillRect(0,58,64,6);
g.fillStyle='#c03a2a';
g.fillRect(26,14,12,36); g.fillRect(14,26,36,12);
const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace;
return t;
})();
svgApply(medkitTex,'medkit');
const medkitMat=new THREE.MeshLambertMaterial({map:medkitTex});
// 医疗箱占位登记归还: 箱子耗尽/消失时从 PROPS 摘除, 不永久占住地面
function releaseMedkitProp(c){
if(!c.pt) return;
const i=PROPS.indexOf(c.pt);
if(i>=0) PROPS.splice(i,1);
c.pt=null;
}
function removeMedkit(c){
releaseMedkitProp(c);
scene.remove(c.mesh);
MED_CRATES.splice(MED_CRATES.indexOf(c),1);
}
function placeMedkit(owner,x,z){
// 同队 5m 内已有医疗箱 → 不新放: 刷新寿命/用量并转移归属 (扎堆医疗箱精简为一个补给点)
for(const c of MED_CRATES){
if(c.team===owner.team&&c.uses>0&&c.life>0&&Math.hypot(c.x-x,c.z-z)<5){
c.uses=8; c.life=120; c.owner=owner; c.team=owner.team;
return true;
}
}
// 旧箱回收 (同 owner 的上一处)
for(let i=MED_CRATES.length-1;i>=0;i--){
if(MED_CRATES[i].owner===owner) removeMedkit(MED_CRATES[i]);
}
// 落点避障: 占位占用格+道具登记+建筑足迹三查, 偏移兜底, 仍无净位则放弃 (不压弹药箱/沙袋/炮位/墙脚)
// 足迹查豁免旗点平台标记 (footRect 中心=旗点坐标, 0.8 高平台可放箱); 2026-09-12 百团改版:
// verify-layouts 抓到运行时医疗箱落进碉堡足迹 (=埋进墙里), 补齐这项空间避让
let px=x,pz=z,ok=false;
for(const [ox,oz] of [[0,0],[0.9,0.5],[-0.9,0.5],[0.5,-0.9],[-0.5,-0.9],[1.4,0],[-1.4,0],[0,1.4],[0,-1.4]]){
if(occBlocked(x+ox,z+oz)) continue;
if(!propFree(x+ox,z+oz,0.85)) continue;
let footHit=false;
for(const f of B_FOOT){
const fcx=(f.x0+f.x1)/2, fcz=(f.z0+f.z1)/2;
let isFlagRect=false;
for(const fl of FLAGS){ if(Math.abs(fcx-fl.x)<0.1&&Math.abs(fcz-fl.z)<0.1){ isFlagRect=true; break; } }
if(isFlagRect) continue;
if(x+ox>f.x0-0.85&&x+ox<f.x1+0.85&&z+oz>f.z0-0.85&&z+oz<f.z1+0.85){ footHit=true; break; }
}
if(footHit) continue;
px=x+ox; pz=z+oz; ok=true; break;
}
if(!ok){
if(owner.isPlayer) showScorePop('此处放不下医疗箱');
return false;
}
const gh=standHeight(px,pz,owner.pos.y+1);
const m=new THREE.Mesh(new THREE.BoxGeometry(0.6,0.42,0.6),medkitMat);
m.position.set(px,gh+0.21,pz);
m.rotation.y=rand(0,TAU);
m.castShadow=true;
scene.add(m);
MED_CRATES.push({x:px,z:pz,y:gh,team:owner.team,owner,uses:8,life:120,mesh:m,pt:propTake(px,pz,0.85)});
AudioSys.click(700,0.3,0.06);
if(owner.isPlayer) showScorePop('医疗箱已放置');
return true;
}
function updateMedCrates(dt){
for(let i=MED_CRATES.length-1;i>=0;i--){
const c=MED_CRATES[i];
c.life-=dt;
if(c.life<=0||c.uses<=0){ removeMedkit(c); continue; }
c.mesh.position.y=c.y+0.21+Math.sin(nowT*2.2+i)*0.02;
// 贴身自动补给仅对 Bot (soldiers 不含玩家); 玩家走 F 交互 → 医疗箱升级为需交互的补给点
for(const s of soldiers){
if(c.uses<=0) break;
if(!s.alive||s.team!==c.team||s.onVehicle) continue;
if(s.bandages>=s.maxBandages) continue;
if((s.bandRefillT||0)>nowT) continue;
if(Math.hypot(s.pos.x-c.x,s.pos.z-c.z)<2.6&&Math.abs(s.pos.y-c.y)<3){
s.bandages=s.maxBandages;
s.bandRefillT=nowT+8;
c.uses--;
if(c.owner&&c.owner!==s){ c.owner.score=(c.owner.score||0)+10; if(c.owner.isPlayer) showScorePop('+10 补给绷带'); }
}
}
}
}
// 死亡热度记录: AI选出生点时规避高危区
const DEATH_HEAT=[];
function noteDeath(x,z){
DEATH_HEAT.push({x,z,t:nowT});
if(DEATH_HEAT.length>50) DEATH_HEAT.shift();
}
// 当前"前线"参考点: 破袭=最近补给库, 攻防/征服=最近的敌方/争夺旗, 遭遇/劫道=两基地中点
function frontlinePoint(team){
if(GAMEMODE==='demolition'){
const d=nearestDepot(BASES[team].x,BASES[team].z);
if(d) return d;
}
if(!FLAGS.length){
if(GAMEMODE==='convoy'){
// 劫道: 前线=存活车队重心 (车队开到哪, 战斗焦点在哪)
let n=0,sx=0,sz=0;
for(const t of trucks){ if(t.alive){ sx+=t.pos.x; sz+=t.pos.z; n++; } }
if(n) return {x:sx/n,z:sz/n};
return {x:0,z:0};
}
return {x:(BASES[0].x+BASES[1].x)/2,z:(BASES[0].z+BASES[1].z)/2};
}
let best=null,bd=1e9;
for(const f of FLAGS){
if(f.owner===team&&f.capTeam===-1) continue;
const dd=Math.hypot(f.x-BASES[team].x,f.z-BASES[team].z);
if(dd<bd){ bd=dd; best=f; }
}
return best||FLAGS[0];
}
function pickSpawnFor(team){
const opts=[];
if(BASES.length) opts.push({x:BASES[team].x,z:BASES[team].z,base:true});
for(const f of FLAGS) if(f.owner===team) opts.push(f);
for(const sp of spawnPtsOf(team)) opts.push({x:sp.x,z:sp.z,spawn:true});
// 劫道: 护运方随车重生 (无基地), 劫道方回伏击点重生
if(GAMEMODE==='convoy'&&CAMPAIGN.convoy&&team===CAMPAIGN.convoy.escortTeam){
for(const t of trucks){
if(!t.alive||t.escaped) continue;
opts.push({x:t.pos.x+rand(-3,3),z:t.pos.z+rand(-4,4),spawn:true});
}
}
const fl=frontlinePoint(team);
let best=opts[0],bs=-1e9;
for(const o of opts){
let sc=rand(0,25);
// 前线偏好: 距离当前战斗焦点越近越好
sc-=Math.hypot(fl.x-o.x,fl.z-o.z)*0.85;
// 危险评估: 附近敌人
let nearestEnemy=1e9,eCnt=0;
for(const c of combatants){
if(c.alive&&c.team!==team){
const d=Math.hypot(c.pos.x-o.x,c.pos.z-o.z);
if(d<nearestEnemy) nearestEnemy=d;
if(d<45) eCnt++;
}
}
if(nearestEnemy<16) sc-=280;
else if(nearestEnemy<30) sc-=100;
sc-=eCnt*16;
// 死亡热度: 该点附近近期阵亡越多越危险 → 绕开绞肉机
let heat=0;
for(const h of DEATH_HEAT){
if(nowT-h.t<25&&Math.hypot(h.x-o.x,h.z-o.z)<24) heat++;
}
sc-=heat*32;
// 正被己方争夺的旗点加分 (支援占领)
for(const f of FLAGS){ if(f.capTeam===team) sc+=40-Math.hypot(f.x-o.x,f.z-o.z)*0.3; }
// 基地保底安全分
if(o.base) sc+=14;
if(sc>bs){ bs=sc; best=o; }
}
return best;
}
