// ─────────────────────────────────────────────
// dev/verify-destruct-20260927N.js —— 破坏机制批 (A1/A2/A3/A4/B1/B2/B3/B4/B5/B6) 沙箱验收
// 用法: node --stack-size=4000 dev/verify-destruct-20260927N.js [map...]   (默认 berlin island)
// 原理: 真脚本链 + 共享桩 (dev/_bootstub.js) + CANNON 全桩; 全部断言走游戏内真入口
//       (damageStructures / damageStructureBy / Tank.update / destroyStructure / 世界还原),
//       不复制被测逻辑。爆点一律取**真实落点** (成员盒中心 / 地面), 不构造"地下 10m 起爆"这类夹具。
//   T1  命中判据: 成员盒中心落点零伤害率 = 0 · 竖直门限不变量 (dy>vGate 的活组不掉血) · ±60m 垂直零伤害
//   T2  撞塌按动量: 慢蹭 (2.2 m/s) 不掉血 · 全速 (8 m/s) ≈ k·v² · 冷却期内不重复结算 (旧版 1.9 m/s 拆整组)
//   T3  撞塌计分归属 (B4): 撞塌归车组/车长, 得分与 demol 与炮弹同一套账
//   T4  可碾掩体可被炸毁 (A3): 命中即摘 (网格移除) · 半径外不受影响
//   T5  油桶引爆 (A3): 圈内桶死 + 网格摘除 + 连锁引爆 · 溅射伤人
//   T6  坍塌碾压 (A4): 落体覆盖矩形内的步兵受伤/圈外不受伤 · 屋盖坍塌同口径
//   T7  血量按组规模归一 (B1): 公式单调 · hp0=hpFull · noScale 组 (破袭库/炮位胸墙) 原地不动 · 每盒分摊收敛
//   T8  屋盖承伤 (B2): 直接轰屋顶 → ref.dmg 上升 → 归零即整片坍塌 (done+承重件击杀)
//   T9  受损中间态 (B3): 掉血换材质档 · 世界还原回退档位与原材质
//   T10 永久件标记 (B5, 2026-09-28 提亮已取消): 计数与独立 census 一致 · 判据逐条成立 · 材质不带 permTier · 不碰可毁/可碾/植被件
//   T11 两图破坏在线 (B6): 滇缅公路 (burma) 建成村落 ⇒ 组数>0; 断崖公路 (canyon) 无结构 (设计口径) 但掩体可炸
//   T12 阴性对照: 跨组共用视觉网格 = 0 (隐形墙) · 组内成员盒全部 alive 起步 · 无"整组悬空"
//   T13 世界还原: 血量回满 · 受损档回退 · 屋盖承伤回快照 · 被引爆的油桶复活
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const stub=require('./_bootstub.js');
const root=path.resolve(__dirname,'..');
const THREE=stub.THREE;
class BoxG extends THREE.BoxGeometry{ constructor(w,h,d){ super(w,h,d); this.parameters={width:w,height:h,depth:d}; } }
class CircG extends THREE.CircleGeometry{ constructor(r,s){ super(r,s); this.parameters={radius:r,segments:s}; } }
class CylG extends THREE.CylinderGeometry{ constructor(rt,rb,h,s){ super(rt,rb,h,s); this.parameters={radiusTop:rt,radiusBottom:rb,height:h,radialSegments:s}; } }
class PlaneG extends THREE.PlaneGeometry{ constructor(w,h,sg,sh){ super(w,h,sg,sh); const p=this.attributes.position,y=new Float32Array(p.count); p.__y=y; p.setY=(i,v)=>{y[i]=v;}; p.getY=(i)=>y[i]; this.parameters={width:w,height:h,widthSegments:sg,heightSegments:sh}; } }
THREE.BoxGeometry=BoxG; THREE.CircleGeometry=CircG; THREE.CylinderGeometry=CylG; THREE.PlaneGeometry=PlaneG;
class V3{ constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;} set(x,y,z){this.x=x;this.y=y;this.z=z;return this;} copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;} }
class Quat{ constructor(){this.x=0;this.y=0;this.z=0;this.w=1;} set(x,y,z,w){this.x=x;this.y=y;this.z=z;this.w=w;return this;} setFromEuler(){return this;} copy(q){Object.assign(this,q);return this;} }
const CANNON_STUB={Vec3:V3,Quaternion:Quat,
World:class{ constructor(){ this.gravity=new V3(); this.broadphase=null; this.solver={iterations:0}; this.bodies=[]; } addBody(b){ this.bodies.push(b); } removeBody(b){ const i=this.bodies.indexOf(b); if(i>=0) this.bodies.splice(i,1); } add(b){ this.addBody(b); } remove(b){ this.removeBody(b); } addConstraint(){} removeConstraint(){} step(){} },
Body:class{ constructor(o){ Object.assign(this,o||{}); this.shapes=[]; this.position=new V3(); this.velocity=new V3(); this.angularVelocity=new V3(); this.quaternion=new Quat(); } addShape(s){ this.shapes.push(s); } },
Box:class{}, Sphere:class{}, Material:class{}, ContactMaterial:class{}, NaiveBroadphase:class{}, PointToPointConstraint:class{}};
const FILES=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/15g-capmodels.js','js/15h-capital.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/22a-menuart.js','js/23-deploy.js','js/23b-worldrestore.js','js/24-main.js'];
function boot(i){
for(const k in stub.byId) delete stub.byId[k];
const ctx=vm.createContext(Object.assign({},stub.sandbox));
ctx.document=stub.document; ctx.window=stub.window; ctx.CANNON=CANNON_STUB;
ctx.localStorage={_s:{sf_campaign:String(i)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of FILES) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
return ctx;
}
let PASS=0, FAILS=0;
const ok=(c,m)=>{ if(c){ PASS++; console.log('  ✔ '+m); } else { FAILS++; console.log('  ✘ '+m); } };
const VM=(c,s)=>vm.runInContext(s,c);
const MAPID=['normandy','stalingrad','berlin','songhu','baituan','burma','moscow','hukawng','steppe','woodline','canyon','island'];
const idxOf=id=>MAPID.indexOf(id);
const maps=process.argv.slice(2).length?process.argv.slice(2):['berlin','island'];

// ═════ T1 命中判据 (A1) ═════
function t1(){
console.log('T1 命中判据: 到最近成员碰撞盒的三维距离 + 竖直门限');
for(const id of maps){
const ctx=boot(idxOf(id));
const r=VM(ctx,`(()=>{
const VG=STRUCT_HIT.vGate;
const ALIVE=()=>DESTRUCTIBLES.filter(g=>!g.dead);
// ① 零伤害率: 每组抽最多 12 个成员盒, 在**盒中心**起爆 (手雷 4.5/45), 该组必须掉血
// ② 同时累计竖直门限不变量: 每次爆炸前记下"竖直差 > vGate 的存活组"的血量, 爆后不允许掉血
let probed=0, zero=0, checked=0, dviol=0;
const all=ALIVE();
const gstep=Math.max(1,Math.floor(all.length/60));
for(let gi=0;gi<all.length;gi+=gstep){
const g=all[gi];
if(g.bb.maxX-g.bb.minX>60) continue;
const bi=g.bi.filter(i=>BOXES[i]&&!BOXES[i].dead);
if(!bi.length) continue;
const bstep=Math.max(1,Math.floor(bi.length/12));
for(let k=0;k<bi.length;k+=bstep){
const b=BOXES[bi[k]];
const p={x:(b.minX+b.maxX)/2,y:(b.minY+b.maxY)/2,z:(b.minZ+b.maxZ)/2};
const watch=[];
for(const h of ALIVE()){ if(h===g) continue; if(boxDist3(p,h.bb).dy>VG) watch.push([h,h.hp]); }
const h0=g.hp;
damageStructures(p,4.5,45,null);
probed++;
if(!g.dead&&g.hp>=h0-1e-6) zero++;
for(const [h,hp] of watch){ if(h.dead) continue; checked++; if(h.hp<hp-1e-6) dviol++; }
if(g.dead) break;
}
}
// ③ ±60m 垂直: 只改 y, 该组一点血都不该掉
const g3=ALIVE().find(g=>g.bi.some(i=>BOXES[i]&&!BOXES[i].dead));
const b3=BOXES[g3.bi.find(i=>BOXES[i]&&!BOXES[i].dead)];
const cx=(b3.minX+b3.maxX)/2, cy=(b3.minY+b3.maxY)/2, cz=(b3.minZ+b3.maxZ)/2;
const h3=g3.hp;
damageStructures({x:cx,y:cy+60,z:cz},4.5,45,null);
const up=g3.dead?0:(h3-g3.hp);
const h4=g3.hp;
damageStructures({x:cx,y:cy-60,z:cz},4.5,45,null);
const dn=g3.dead?0:(h4-g3.hp);
return {probed,zero,dviol,checked,up:+up.toFixed(4),dn:+dn.toFixed(4)};
})()`);
ok(r.probed>100&&r.zero===0,`T1[${id}] 成员盒中心落点零伤害率 = 0 (${r.zero}/${r.probed} 盒空放)`);
ok(r.checked>100&&r.dviol===0,`T1[${id}] 竖直门限: dy>vGate 的存活组无一掉血 (${r.dviol}/${r.checked} 观测)`);
ok(r.up===0&&r.dn===0,`T1[${id}] 爆点 ±60m (只改 y) 零伤害 (上 ${r.up} / 下 ${r.dn})`);
}
}

// ═════ T2/T3 撞塌按动量 + 计分归属 ═════
function t2(){
console.log('T2/T3 坦克撞塌: 按动量扣血 · 正撞门限 · 冷却 · 得分归属');
const ctx=boot(idxOf('berlin'));
const r=VM(ctx,`(()=>{
const K=STRUCT_RAM.k, MIN=STRUCT_RAM.minSpeed, CD=STRUCT_RAM.cd;
// 找一个"底盒贴地"的墙组当靶 (ram 需要车体能碰到盒子: 盒顶高于地面 0.7 以上)
let g=null, box=null;
for(const gg of DESTRUCTIBLES){
if(gg.dead) continue;
for(const i of gg.bi){ const b=BOXES[i];
if(!b||b.dead) continue;
if(b.maxY-b.gh<1.2||b.maxY-b.gh>6) continue;
if(gg.hpNom>600) continue;
g=gg; box=b; break; }
if(g) break;
}
if(!g) return {none:true};
// 血量夹具: 400 (轻档 20 分) —— 只为把"掉多少血"算干净
g.hpNom=400; g.hpFull=400; g.hp=400; g.hp0=400;
const bx=(box.minX+box.maxX)/2, bz=(box.minZ+box.maxZ)/2;
const alongX=(box.maxX-box.minX)>=(box.maxZ-box.minZ);
const nx=alongX?1:0, nz=alongX?0:1;         // 撞击面法线 (朝 +x 或 +z)
const half=alongX?(box.maxX-box.minX)/2:(box.maxZ-box.minZ)/2;
const t=new Tank(0,0);
t.crew.score=0; t.crewBot=null; t.playerDriven=true;   // playerDriven: 跳过 update 里的"无人驾驶自动刹停", 车速才是夹具设定值
const reset=()=>{ t._ramT=undefined; t.suspP=0; t.suspPV=0; };
// 正撞停车: 车体在 +n 侧, 车头朝 -n (即朝墙), 前碰撞圆自然落在贴距内
const parkFront=(dist)=>{ t.pos.x=bx+nx*(half+dist); t.pos.z=bz+nz*(half+dist); t.pos.y=box.maxY-0.6; t.yaw=Math.atan2(-nx,-nz); reset(); };
// 侧擦停车: 车体沿墙 (行进方向 ⊥ 墙法线), 与墙面保持贴距
const parkSide=(dist)=>{ const tx=alongX?0:1, tz=alongX?1:0;   // 与 n 垂直的切向
t.pos.x=bx+nx*(half+dist); t.pos.z=bz+nz*(half+dist); t.pos.y=box.maxY-0.6;
t.yaw=Math.atan2(tx,tz); reset(); };
const step=(v,n)=>{ for(let i=0;i<n;i++){ t.vel=v; t.update(0.05); } };
// ① 低于门槛 1.6 m/s: 只被挡住, 不掉血
parkFront(3.2); step(1.6,3);
const belowDmg=+(400-g.hp).toFixed(2);
// ② 2.2 m/s (旧版 >1.9 即"整组当场销毁"): 现在只按 k·v² 扣 10.6
const hp1=g.hp; parkFront(3.2); step(2.2,3);
const slowDmg=+(hp1-g.hp).toFixed(2);
// ③ 侧擦 8 m/s: 车贴着墙横着蹭, 法向·行进 ≈ 0 ⇒ 不拆楼 (旧版照样拆)
const hp2=g.hp; parkSide(1.2); step(8.0,3);
const sideDmg=+(hp2-g.hp).toFixed(2);
// ④ 全速正撞 8 m/s: 一次 k·v² = 140.8, 且同一辆车的冷却窗口内不重复结算 (3 帧仍是 140.8)
const hp3=g.hp; parkFront(3.2); step(8.0,3);
const ramDmg=+(hp3-g.hp).toFixed(2);
// ⑤ 冷却: 直接连撞 3 次 (不重置 _ramT) 也只有一次结算 —— 与 ④ 同一条断言
// ⑥ 打光: 连续正撞到死 (playerDriven ⇒ 归属玩家账号, 不在这里断言)
parkFront(3.2);
let guard=0;
while(!g.dead&&guard++<40){ t.vel=14; t.update(0.05); if(guard%6===0) t._ramT=undefined; }
// ⑦ 归属 (B4): 换一辆"车组驾驶"的车 (playerDriven=false ⇒ attacker=crew) 撞掉另一组 ⇒ 记到车组账上
let g2=null, box2=null;
for(const gg of DESTRUCTIBLES){
if(gg.dead||gg===g) continue;
for(const i of gg.bi){ const b=BOXES[i];
if(!b||b.dead||b.maxY-b.gh<1.2||b.maxY-b.gh>6) continue;
g2=gg; box2=b; break; }
if(g2) break;
}
let crewScore=0, playerScore=0, killedByCrew=false;
if(g2){
g2.hpNom=60; g2.hpFull=60; g2.hp=60; g2.hp0=60;     // 轻档 20 分
const b2x=(box2.minX+box2.maxX)/2, b2z=(box2.minZ+box2.maxZ)/2;
const aX=(box2.maxX-box2.minX)>=(box2.maxZ-box2.minZ), n2x=aX?1:0, n2z=aX?0:1;
const h2=aX?(box2.maxX-box2.minX)/2:(box2.maxZ-box2.minZ)/2;
const t2=new Tank(0,0);
t2.crewBot=null; t2.playerDriven=false; t2.crew.score=0;
player.score=0;
let gd=0;
while(!g2.dead&&gd++<40){
t2.pos.x=b2x+n2x*(h2+3.2); t2.pos.z=b2z+n2z*(h2+3.2); t2.pos.y=box2.maxY-0.6;
t2.yaw=Math.atan2(-n2x,-n2z); t2._ramT=undefined; t2.vel=14;
t2.update(0.05);
}
killedByCrew=!!g2.dead; crewScore=t2.crew.score; playerScore=player.score;
}
return {none:false,K,MIN,CD,belowDmg,slowDmg,sideDmg,ramDmg,
expectSlow:+(K*2.2*2.2).toFixed(2),expect:+(K*64).toFixed(1),dead:!!g.dead,guard,
crewScore,playerScore,killedByCrew};
})()`);
if(r.none){ ok(false,'T2 取到贴地墙组样本'); return; }
ok(r.belowDmg===0,`T2 低速 1.6 m/s (< minSpeed ${r.MIN}) 不掉血 (${r.belowDmg})`);
ok(Math.abs(r.slowDmg-r.expectSlow)<1e-6,`T2 2.2 m/s 只按动量扣 ${r.expectSlow} (实测 ${r.slowDmg}; 旧版 >${r.MIN} 即整组销毁)`);
ok(r.sideDmg===0,`T2 侧擦 8 m/s 不拆楼 (掉血 ${r.sideDmg})`);
ok(Math.abs(r.ramDmg-r.expect)<1e-6,`T2 全速 8 m/s 正撞 = k·v² = ${r.expect}, 且冷却窗口内 3 帧只结算一次 (实测 ${r.ramDmg})`);
ok(r.killedByCrew&&r.crewScore===20&&r.playerScore===0,
`T3 撞毁记到车组账上 (车组 ${r.crewScore}/20 · 玩家 ${r.playerScore} —— 不越界)`);
}

// ═════ T4 可碾掩体可被炸毁 (A3) ═════
function t4(){
console.log('T4 可碾掩体 (沙袋/木箱/石墙/树篱/倒木) 被爆炸摘除');
const ctx=boot(idxOf('island'));
const r=VM(ctx,`(()=>{
const cs=BOXES.filter(b=>!b.dead&&b.crush&&!b.dGroup);
if(!cs.length) return {none:true};
const b=cs[Math.floor(cs.length/2)];
const cx=(b.minX+b.maxX)/2, cz=(b.minZ+b.maxZ)/2, cy=(b.minY+b.maxY)/2;
// 对照组: 20m 外的另一件掩体
const far=cs.find(o=>Math.hypot((o.minX+o.maxX)/2-cx,(o.minZ+o.maxZ)/2-cz)>20);
const before=cs.length;
damageStructures({x:cx,y:cy,z:cz},4.5,45,null);
let goneNow=0;
for(const o of cs){ if(o.dead) goneNow++; }
const bDead=!!b.dead, meshOff=!!(b.mesh&&world.children.indexOf(b.mesh)<0);   // 沙箱桩 remove() 不清 parent, 按"是否还在 world 里"判
return {none:false,cand:before,goneNow,bDead,meshOff,farAlive:far?!far.dead:true,
farDist:far?+Math.hypot((far.minX+far.maxX)/2-cx,(far.minZ+far.maxZ)/2-cz).toFixed(1):-1};
})()`);
if(r.none){ ok(false,'T4 取到可碾掩体样本'); return; }
ok(r.bDead&&r.meshOff,`T4 掩体被炸毁并摘除视觉网格 (dead=${r.bDead} mesh 摘除=${r.meshOff})`);
ok(r.goneNow>=1,`T4 一发手雷带走 ${r.goneNow} 件掩体 (命中即摘)`);
ok(r.farAlive,`T4 半径外掩体不受影响 (${r.farDist}m 外仍存活)`);
}

// ═════ T5 油桶引爆 (A3) ═════
function t5(){
console.log('T5 油桶: 引爆 + 网格摘除 + 连锁 + 溅射伤人');
const ctx=boot(idxOf('burma'));
const r=VM(ctx,`(()=>{
const bs=CYLS.filter(c=>c.explosive&&!c.dead);
if(!bs.length) return {none:true};
const a=bs[0];
// 连锁夹具: 把第二只桶搬到 a 旁边 2m (连锁引爆半径 = 爆炸有效半径 7.5m, 2m 必连锁)
const b=bs.find(o=>o!==a);
if(b){ b.x=a.x+2; b.z=a.z; b.y0=a.y0; b.y1=a.y1; }
// 假步兵 (测试替身): splashDamage 只读 pos/alive/team/isPlayer 与 damage()
const dummy={pos:V3(a.x+2.0,(a.y0+a.y1)/2,a.z),alive:true,team:9,isPlayer:false,hp:100,
damage(amt){ this.hp-=amt; }};
combatants.push(dummy);
// 夹具把邻桶搬到了 a 旁边 ⇒ 空间索引 (RGRID) 里它还记在旧格上。走既有的全量回退开关
// (window.RGRID_OFF) 消除"索引陈旧"这个夹具伪差异 —— 04-collision 就是为这类对照留的这条开关。
const prevOff=window.RGRID_OFF; window.RGRID_OFF=true;
damageStructures({x:a.x,y:(a.y0+a.y1)/2,z:a.z},4.5,45,null);
window.RGRID_OFF=prevOff;
const res={none:false,aDead:!!a.dead,
aMesh:!!(a.mesh&&world.children.indexOf(a.mesh)<0),
meshKept:!!a.mesh,bDead:b?!!b.dead:false,dummyHp:+dummy.hp.toFixed(1)};
combatants.pop();
return res;
})()`);
if(r.none){ ok(false,'T5 取到油桶样本'); return; }
ok(r.aDead&&r.aMesh,`T5 油桶被引爆 (CYLS 摘账 + 网格移出 world)`);
ok(r.meshKept,`T5 网格引用保留 (世界还原靠 world.children 快照放回, 不能置空)`);
ok(r.bDead,`T5 连锁引爆 2m 外的邻桶`);
ok(r.dummyHp<100,`T5 油桶爆炸溅射伤人 (2m 处步兵 ${r.dummyHp}/100)`);
}

// ═════ T6 坍塌碾压 (A4) ═════
function t6(){
console.log('T6 坍塌碾压: 落体覆盖范围内步兵受伤, 圈外不受伤');
const ctx=boot(idxOf('berlin'));
const r=VM(ctx,`(()=>{
let g=null;
for(const gg of DESTRUCTIBLES){ if(!gg.dead&&(gg.bb.maxY-gg.bb.minY)>2.5&&(gg.bb.maxX-gg.bb.minX)<14) { g=gg; break; } }
if(!g) return {none:true};
const cx=(g.bb.minX+g.bb.maxX)/2, cz=(g.bb.minZ+g.bb.maxZ)/2, gy=heightAt(cx,cz);
const inside={pos:V3(cx,gy,cz),alive:true,team:9,isPlayer:false,hp:100,damage(a){this.hp-=a;}};
const outside={pos:V3(g.bb.maxX+12,gy,g.bb.maxZ+12),alive:true,team:9,isPlayer:false,hp:100,damage(a){this.hp-=a;}};
combatants.push(inside,outside);
const tanksBefore=tanks.length;
destroyStructure(g,false,null);
const res={none:false,inHp:+inside.hp.toFixed(1),outHp:+outside.hp.toFixed(1),
top:+g.bb.maxY.toFixed(1),gy:+gy.toFixed(1),tanks:tanksBefore};
combatants.pop(); combatants.pop();
return res;
})()`);
if(r.none){ ok(false,'T6 取到多层墙组样本'); return; }
ok(r.inHp<100,`T6 落体覆盖矩形内步兵被砸 (100 → ${r.inHp}, 顶面 ${r.top}m/地面 ${r.gy}m)`);
ok(r.outHp===100,`T6 圈外步兵不受影响 (${r.outHp})`);

const ctx2=boot(idxOf('berlin'));
const r2=VM(ctx2,`(()=>{
let g=null;
for(const gg of DESTRUCTIBLES){ if(gg.roofRef&&!gg.roofRef.done&&gg.roofRef.bands&&gg.roofRef.bands.length){ g=gg; break; } }
if(!g) return {none:true};
const rf=g.roofRef;
const b=rf.bands.find(x=>x&&!x.dead); if(!b) return {none:true};
const cx=(b.minX+b.maxX)/2, cz=(b.minZ+b.maxZ)/2, gy=heightAt(cx,cz);
const inside={pos:V3(cx,gy,cz),alive:true,team:9,isPlayer:false,hp:100,damage(a){this.hp-=a;}};
combatants.push(inside);
collapseRoof(rf,false,null);
const res={none:false,inHp:+inside.hp.toFixed(1),done:!!rf.done};
combatants.pop();
return res;
})()`);
if(r2.none){ ok(false,'T6 取到屋盖坍塌样本'); return; }
ok(r2.inHp<100&&r2.done,`T6 屋盖坍塌砸伤室内步兵 (100 → ${r2.inHp}, done=${r2.done})`);
}

// ═════ T7 血量归一 (B1) ═════
function t7(){
console.log('T7 血量按组规模归一');
for(const id of maps){
const ctx=boot(idxOf(id));
const r=VM(ctx,`(()=>{
const SC=typeof structHPScale==='function'?structHPScale:null;
let bad=0, noScale=0, tot=0, noScaleBad=0;
let minPB=1e9, maxPB=0;
for(const g of DESTRUCTIBLES){
if(g.dead) continue;
tot++;
if(g.noScale){
noScale++;
if(g.hp!==g.hpNom||g.hpFull!==g.hpNom) noScaleBad++;
continue;
}
const exp=Math.max(1,Math.round(g.hpNom*SC(g.n||1)));
if(g.hp!==exp||g.hpFull!==exp) bad++;
if(g.hp0!==g.hpFull) bad++;
const pb=g.hp/Math.max(1,g.n);
if(pb<minPB) minPB=pb; if(pb>maxPB) maxPB=pb;
}
// 单调性: n 越大血量倍数越大 (同一名义血量下)
const mono=(SC(1)<=SC(6))&&(SC(6)<=SC(24))&&(SC(24)<=SC(200));
return {tot,bad,noScale,noScaleBad,mono,
lo:+minPB.toFixed(2),hi:+maxPB.toFixed(2),ratio:+(maxPB/Math.max(1e-9,minPB)).toFixed(1)};
})()`);
ok(r.tot>0&&r.bad===0,`T7[${id}] ${r.tot} 组血量 = 名义×scale(n) 且 hp0=hpFull (违例 ${r.bad})`);
ok(r.mono,'T7 曲线单调 (n↑ ⇒ 倍数↑)');
ok(r.noScaleBad===0,`T7[${id}] noScale 组原地不动 (${r.noScale} 组: 破袭库/炮位胸墙)`);
ok(r.ratio<=40,`T7[${id}] 每盒分摊血量极差 ${r.lo}~${r.hi} (${r.ratio}×, 旧版 88×)`);
}
}

// ═════ T8 屋盖承伤 (B2) ═════
function t8(){
console.log('T8 直接轰屋顶: ref 承伤 → 整片坍塌');
const ctx=boot(idxOf('berlin'));
const r=VM(ctx,`(()=>{
let g=null;
for(const gg of DESTRUCTIBLES){ if(gg.roofRef&&!gg.roofRef.done&&gg.roofRef.hp>0) { g=gg; break; } }
if(!g) return {none:true};
const rf=g.roofRef;
const b=rf.bands.find(x=>x&&!x.dead)||rf.bands[0];
const p={x:(b.minX+b.maxX)/2,y:(b.minY+b.maxY)/2,z:(b.minZ+b.maxZ)/2};
const hp0=rf.hp, d0=rf.dmg||0;
damageStructures(p,7.5,300,null);
const d1=rf.dmg||0;
// 走满血条 (直接用 roofDamage 追加剩余量: 本测试要证的是"承伤归零 ⇒ 整片坍塌", 不是"要几发炮弹")
roofDamage(rf,rf.hp,null);
return {none:false,hp:+hp0.toFixed(0),d0,d1:+d1.toFixed(1),done:!!rf.done,
bandsDead:rf.bands.every(x=>!x||x.dead),area:rf.area?+rf.area.toFixed(1):0};
})()`);
if(r.none){ ok(false,'T8 取到屋盖样本'); return; }
ok(r.d1>0,`T8 直接轰屋顶 → ref 承伤 (hp ${r.hp} → dmg ${r.d1})`);
ok(r.done&&r.bandsDead,`T8 承伤归零 ⇒ 整片坍塌 (承重件全击杀=${r.bandsDead})`);
ok(r.area>0,`T8 血条按投影面积给定 (area ${r.area} m²)`);
}

// ═════ T9 受损中间态 (B3) ═════
function t9(){
console.log('T9 受损中间态 + 世界还原回退');
const ctx=boot(idxOf('berlin'));
const r=VM(ctx,`(()=>{
const g=DESTRUCTIBLES.find(x=>!x.dead&&x.meshes&&x.meshes.length);
if(!g) return {none:true};
const m0=g.meshes[0].material;
damageStructureBy(g,g.hp0*0.5,null);
const tier1=g.dmgTier, hasKey=!!(g.meshes[0].material&&g.meshes[0].material.dmgTier);
const swapped=(g.meshes[0].material!==m0);
damageStructureBy(g,g.hp0*0.25,null);
const tier2=g.dmgTier;
// 世界还原: 血量回满 + 材质档回退
const rp=typeof restorePristineWorld==='function'?restorePristineWorld():null;
const tierAfter=g.dmgTier;
const matBack=(g.meshes[0].material===m0);
const hpBack=(g.hp===g.hpFull);
return {none:false,tier1,hasKey,swapped,tier2,tierAfter,matBack,hpBack,rp:!!rp};
})()`);
if(r.none){ ok(false,'T9 取到可毁组样本'); return; }
ok(r.tier1===1&&r.hasKey&&r.swapped,`T9 掉血 50% → 换受损档材质 (tier=${r.tier1} 材质已换=${r.swapped} 带档标记=${r.hasKey})`);
ok(r.tier2===2,`T9 掉血 75% → 加重档 (tier=${r.tier2})`);
ok(r.tierAfter===0&&r.matBack&&r.hpBack,`T9 世界还原: 档位回 0 + 原材质复原 + 血量回满`);
}

// ═════ T10 永久件标记口径 (B5) ═════
// 2026-09-28 用户裁定**取消提亮** (D3: 逐盒提亮在分段墙上读作"各部位明暗不一") —— structMatPerm 已改为
// 原样返回, perm 盒标记保留。断言随之改为: perm 标记口径不变 + 材质**不得**再带 permTier (提亮已移除)。
// census 口径 2026-09-28 对齐现行两处标记点 (09-28C 漂移销账):
//   ① markPermPieces (B5) = 高件 (≥1.6m 且高出地面≥1.5m) 且 无 dGroup/crush/flora/roof;
//   ② pitchedRoof 永久屋盖 (09-28C 用户裁定「不可破坏建筑的房顶也改为不可破坏」) = 薄的 perm 件
//      (roof 记账标记已摘, 只剩 perm) —— 旧 census 漏掉这类 = 1856/1252 漂移的来源。
function t10(){
console.log('T10 永久件 ("看着像墙却打不烂") 标记口径 (提亮已取消)');
const ctx=boot(idxOf('normandy'));
const r=VM(ctx,`(()=>{
let perm=0, permBad=0, census=0, thin=0, wrongSide=0;
for(const b of BOXES){
if(b.dead||!b.mesh) continue;
const tall=(b.maxY-b.minY>=1.6)&&(b.maxY-b.gh>=1.5);
const immune=!b.dGroup&&!b.crush&&!b.flora&&!b.roof;
if(immune&&tall) census++;
if(b.perm){ perm++;
if(!immune) permBad++;
else if(!tall) thin++;
if(b.mesh.material&&b.mesh.material.permTier!==undefined) permBad++;   // 提亮已取消: 不应再有 permTier 变体
}
if(!immune&&b.mesh.material&&b.mesh.material.permTier!==undefined) wrongSide++;
}
const cars=DESTRUCTIBLES.filter(g=>!g.dead).length;
return {perm,census,thin,permBad,wrongSide,cars};
})()`);
ok(r.perm>0&&r.census>0&&r.census+r.thin===r.perm,`T10 永久件 = 高件 census (${r.census}) + 永久屋盖薄带 (${r.thin}) = ${r.perm}`);
ok(r.permBad===0,'T10 每件都无可毁/可碾/植被/roof 记账标记, 且材质不带 permTier (提亮已取消)');
ok(r.thin>0,'T10 永久屋盖薄带在账 (09-28C 用户裁定: 不可破坏建筑房顶永久)');
ok(r.wrongSide===0,`T10 可毁/可碾件一件都没被改成永久档 (误伤 ${r.wrongSide}; 本图可毁组 ${r.cars})`);
}

// ═════ T11 两图破坏在线 (B6) ═════
function t11(){
console.log('T11 B6: 滇缅公路建成村落 / 断崖公路口径');
const b=boot(idxOf('burma'));
const r=VM(b,`(()=>{ const br=BUILD_REG.filter(x=>x.type==='cnHouse').length;
const crush=BOXES.filter(x=>!x.dead&&x.crush).length;
return {groups:DESTRUCTIBLES.length,huts:br,crush,boxes:BOXES.length}; })()`);
ok(r.groups>0&&r.huts>0,`T11[burma] 村落建成 ⇒ 图内可毁组 ${r.groups} 组 (竹/瓦房 ${r.huts} 栋, 碰撞盒 ${r.boxes})`);
const c=boot(idxOf('canyon'));
const r2=VM(c,`(()=>({groups:DESTRUCTIBLES.length,crush:BOXES.filter(x=>!x.dead&&x.crush).length,boxes:BOXES.length}))()`);
ok(r2.groups===0&&r2.crush>0,`T11[canyon] 无建筑 (设计口径: 山区劫道, 全图 ${r2.boxes} 盒) 但掩体可炸 (${r2.crush} 件 crush)`);
}

// ═════ T12 阴性对照 ═════
function t12(){
console.log('T12 阴性对照: 跨组共用网格 / 成员盒起步存活 / 整组悬空');
for(const id of maps){
const ctx=boot(idxOf(id));
const r=VM(ctx,`(()=>{
// ① 同一视觉网格被**两个可毁组**共用 (打 A 组摘掉 B 组视觉的隐形墙) —— 同组多盒共网格是正常形态
const byMesh=new Map(); let shared=0, cross=0;
for(const g of DESTRUCTIBLES){
if(g.dead) continue;
for(const i of g.bi){ const b=BOXES[i]; if(!b||!b.mesh) continue;
const m=b.mesh;
let s=byMesh.get(m);
if(!s){ s={g,gs:new Set([g])}; byMesh.set(m,s); }
else { if(!s.gs.has(g)) cross++; s.gs.add(g); }
}
}
for(const s of byMesh.values()) if(s.gs.size>1) shared++;
// ② 起步态: 活组里不存在一开始就死的成员盒
let deadIn=0;
for(const g of DESTRUCTIBLES){ if(g.dead) continue; for(const i of g.bi){ const b=BOXES[i]; if(b&&b.dead) deadIn++; } }
// ③ 整组悬空 (窄口径: 组底高出足迹地形 2.5m 且下方 1.2m 内无他盒支撑)
let float=0;
for(const g of DESTRUCTIBLES){
if(g.dead) continue;
const cx=(g.bb.minX+g.bb.maxX)/2, cz=(g.bb.minZ+g.bb.maxZ)/2;
const gy=heightAt(cx,cz);
if(g.bb.minY-gy<2.5) continue;
let sup=false;
eachBoxNear(g.bb.minX-1.2,g.bb.minZ-1.2,g.bb.maxX+1.2,g.bb.maxZ+1.2,b=>{
if(sup||b.dead||b.maxY>g.bb.minY+0.05||b.maxY<g.bb.minY-1.2) return;
if(b.minX<g.bb.maxX&&b.maxX>g.bb.minX&&b.minZ<g.bb.maxZ&&b.maxZ>g.bb.minZ) sup=true;
});
if(!sup) float++;
}
return {shared,cross,deadIn,float};
})()`);
ok(r.shared===0&&r.cross===0,`T12[${id}] 跨组共用视觉网格 = 0 条 (隐形墙阴性, 跨组盒 ${r.cross})`);
ok(r.deadIn===0,`T12[${id}] 活组内起步无死盒 (${r.deadIn})`);
ok(r.float===0,`T12[${id}] 整组悬空 = 0 (${r.float})`);
}
}

// ═════ T13 世界还原一致性 ═════
function t13(){
console.log('T13 世界还原: 血量/受损档/屋盖承伤/油桶');
const ctx=boot(idxOf('berlin'));
const r=VM(ctx,`(()=>{
const g=DESTRUCTIBLES.find(x=>!x.dead);
damageStructureBy(g,g.hp0*0.4,null);
const rf=(()=>{ for(const x of DESTRUCTIBLES){ if(x.roofRef&&!x.roofRef.done&&x.roofRef.hp>0) return x.roofRef; } return null; })();
if(rf){ const b=rf.bands.find(y=>y&&!y.dead); if(b) damageStructures({x:(b.minX+b.maxX)/2,y:(b.minY+b.maxY)/2,z:(b.minZ+b.maxZ)/2},7.5,300,null); }
const barrel=CYLS.find(c=>c.explosive&&!c.dead);
if(barrel) barrelBlast(barrel,null);
const before={hp:g.hp,tier:g.dmgTier||0,dmg:rf?(rf.dmg||0):0,barrel:barrel?!!barrel.dead:null};
restorePristineWorld();
const after={hp:g.hp,full:g.hpFull,tier:g.dmgTier||0,dmg:rf?(rf.dmg||0):0,
barrel:barrel?!!barrel.dead:null,barrelR:barrel?+barrel.r.toFixed(2):0,barrelMesh:barrel?!!(barrel.mesh&&barrel.mesh.parent):null};
return {before,after,hasRef:!!rf,hasBarrel:!!barrel};
})()`);
ok(r.after.hp===r.after.full&&r.after.tier===0,`T13 血量回满且受损档回退 (${r.after.hp}/${r.after.full}, tier ${r.after.tier})`);
if(r.hasRef) ok(r.after.dmg===0,`T13 屋盖承伤回快照 (${r.before.dmg} → ${r.after.dmg})`);
if(r.hasBarrel) ok(r.after.barrel===false&&r.after.barrelR>0.4&&r.after.barrelMesh,`T13 被引爆的油桶复活 (r=${r.after.barrelR} 网格归位=${r.after.barrelMesh})`);
}

// ── 入口 ──
console.log('== 破坏机制批 (2026-09-27N) 沙箱验收 ==');
t1(); t2(); t4(); t5(); t6(); t7(); t8(); t9(); t10(); t11(); t12(); t13();
console.log(`== 结果: ${PASS} 通过 / ${FAILS} 失败 ==`);
process.exit(FAILS?1:0);
