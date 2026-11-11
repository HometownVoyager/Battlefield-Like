// ─────────────────────────────────────────────
// 06-engineering.js —— 迫击炮/工程兵/铁丝网
// 源: Index.original.html 第 2341-2501 行
// ─────────────────────────────────────────────
'use strict';
// ===== 迫击炮架设 + 工程兵工事 =====
const MORTARS=[];
function deployMortar(owner,x,z,yaw){
if(!owner.alive||owner.mortarPlaced||owner.onMortar||owner.mortUse||owner.onVehicle||owner.onMG||owner.onAT||owner.onAA) return false;
// 落点校验 (2026-09-26 补): 旧版**不查落点** —— 玩家贴墙按 B / Bot 在掩体后就地架设, 都会把炮架进碰撞体
// 内部 (炮身埋进墙里、上炮位站不进去, 而且 coverPoints 里凭空多一个用不了的掩体点)。口径与 engBuild 的
// 建造门完全一致 (occBlocked + 战场边界), 提示文案同规; 失败返回 false, 调用方 (19-input/14-bots) 已按布尔处理。
if(occBlocked(x,z)){ if(owner.isPlayer) showScorePop(t2('此处无法架设')); return false; }
const lim=MAP_SIZE/2-4;
if(Math.abs(x)>lim||Math.abs(z)>lim){ if(owner.isPlayer) showScorePop(t2('超出战场边界')); return false; }
const gh=heightAt(x,z);
// 模型整体挂在 grp 下, grp.rotation.y=yaw → 炮口对准架设者视线方向(+Z)
const grp=new THREE.Group();
grp.position.set(x,gh,z); grp.rotation.y=yaw;
world.add(grp);
// ── 迫击炮几何 (2026-09-21B 重做) ──
// 旧版两脚架腿长 0.42 写死 + 位置写死 (y=0.28/z=0.30): 真 three.js 逐件量测, 腿顶离炮箍 **0.208m**、
//   腿脚离地 **0.082m** —— 视觉上就是"炮口前立着一个没连上的 A 形架"(用户实机截图 图三"支架似乎反了")。
// 现在发射管轴只由下面一支 axisAt(t) (t=0 管底 / t=1 管口) 解算, 炮箍与两脚架**共用同一支**:
//   腿长与脚位由炮箍现算 ⇒ 结构上不可能再脱开; 腿脚贴地、横杆接在两腿轴线中段。
// 交互 (上炮/回收/落点圈/弹道) 一律未动: grp 的落位与朝向、coverPoints、MORTARS 记录与旧版逐字段一致。
const TILT=0.62, TL=0.78, TY=0.42, TZ=0.06;                 // 发射管: 倾角 / 管长 / 管心高 / 管心 z(向炮口为 +z)
const base=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.34,0.09,10),vmMats.gun);
base.position.set(0,0.05,-0.1); base.rotation.x=0.08; grp.add(base);
const tube=new THREE.Mesh(new THREE.CylinderGeometry(0.056,0.062,TL,8),vmMats.gun);
tube.position.set(0,TY,TZ); tube.rotation.x=TILT; grp.add(tube);
const axisAt=t=>{ const s=(t-0.5)*TL; return [TY+Math.cos(TILT)*s, TZ+Math.sin(TILT)*s]; };  // → [y,z] (轴恒在 x=0 平面)
const CL=axisAt(0.80);                                      // 炮箍夹持点 (靠炮口一侧, 与真迫击炮同位置)
// ★炮箍挂在**管身上**(不是 grp 上): mo.tube.rotation.x 是活值 —— 开火瞬间被写成 0.5、随后阻尼回 0.62
//   (14-bots:1371-1374), 玩家的瞄准也按 p.pitch 写它 (20a-seats:168)。若炮箍留在 grp 上静止, 管一摆
//   就会从炮箍里"滑出去"(0.62→0.50 时管轴偏离炮箍心 3.2cm > 环内半径 0.052) —— 挂到管上则恒箍在管身同一站位。
//   两腿仍落地(静态), 与炮箍的配合量在 ±0.03m 内 (环半径 0.064 + 腿半径 0.018 ⇒ 仍正体积相交)。
const ring=new THREE.Mesh(new THREE.TorusGeometry(0.064,0.012,6,10),vmMats.gunL);
ring.position.set(0,(0.80-0.5)*TL,0); ring.rotation.x=HPI; tube.add(ring);
// 两脚架: 自炮箍左右外张落地 (腿脚 y=0.02 贴地, z 收在炮箍前后 0.06 内 —— 脚落在座钣之前、不压座钣)
const FX=0.30, FZ=CL[1]-0.06, FY=0.02;
for(const sx of [-1,1]){
const dx=sx*FX, dy=FY-CL[0], dz=FZ-CL[1], len=Math.hypot(dx,dy,dz);
const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.022,len,6),vmMats.gunL);
leg.position.set(dx*0.5,(CL[0]+FY)*0.5,(CL[1]+FZ)*0.5);
leg.quaternion.setFromUnitVectors(V3(0,1,0),V3(dx/len,dy/len,dz/len));
grp.add(leg);
const pad=new THREE.Mesh(boxGeo(0.09,0.035,0.13),vmMats.gunL);
pad.position.set(sx*FX,0.018,FZ); grp.add(pad);
}
// 横向连接杆: 接在两腿轴线 45% 处 (位置由同一支解算给, 不再写死 —— 旧版横杆只连两腿、不连炮身)
const CU=0.45, barY=CL[0]+(FY-CL[0])*CU, barZ=CL[1]+(FZ-CL[1])*CU;
const cross=new THREE.Mesh(new THREE.CylinderGeometry(0.014,0.014,FX*2*CU,5),vmMats.gunL);
cross.position.set(0,barY,barZ); cross.rotation.z=HPI; grp.add(cross);
// 方向机 (左: 自炮箍斜下拉出的螺杆 + 手轮) 与瞄准镜 (右: 炮箍上的支臂 + 镜筒) —— 两件都由炮箍起算, 天然连体
const wheelC=[-0.20,CL[0]-0.16,CL[1]+0.02];
const sdx=wheelC[0], sdy=wheelC[1]-CL[0], sdz=wheelC[2]-CL[1], sLen=Math.hypot(sdx,sdy,sdz);
const screw=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,sLen,6),vmMats.gunL);
screw.position.set(sdx*0.5,(CL[0]+wheelC[1])*0.5,(CL[1]+wheelC[2])*0.5);
screw.quaternion.setFromUnitVectors(V3(0,1,0),V3(sdx/sLen,sdy/sLen,sdz/sLen));
grp.add(screw);
const wheel=new THREE.Mesh(new THREE.CylinderGeometry(0.062,0.062,0.022,10),vmMats.gunL);
wheel.position.set(wheelC[0],wheelC[1],wheelC[2]); wheel.rotation.set(HPI,0,0.5); grp.add(wheel);
const arm=new THREE.Mesh(boxGeo(0.10,0.06,0.06),vmMats.gunL);
arm.position.set(0.075,CL[0]+0.01,CL[1]); grp.add(arm);
const sight=new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.028,0.20,8),vmMats.gunL);
sight.position.set(0.135,CL[0]+0.035,CL[1]+0.02); sight.rotation.x=HPI; grp.add(sight);
grp.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
coverPoints.push({x,z});
MORTARS.push({x,z,y:gh,face:yaw,grp,tube,user:null,cd:0,cdLock:0,owner,alive:true});
if(owner.isPlayer){ showScorePop('迫击炮已架设 (F 上炮 · 6 靠近回收)'); AudioSys.click(800,0.3,0.05); }
owner.mortarPlaced=true;
return true;
}
function recoverMortar(pl){
const m=MORTARS.find(mt=>mt.owner===pl&&mt.alive&&!mt.user&&Math.hypot(mt.x-pl.pos.x,mt.z-pl.pos.z)<3.5);
if(!m){ if(pl.isPlayer&&pl.mortarPlaced) showScorePop('需靠近自己的迫击炮才能回收'); return; }
world.remove(m.grp);
MORTARS.splice(MORTARS.indexOf(m),1);
pl.mortarPlaced=false;
// ★2026-09-26 修: 旧写法 `find(mortar) || slots[0]` 在"玩家身上已无迫击炮槽"时把 2 发炮弹记到**主武器**
// (卡宾枪) 上 —— 回收看着成功, 弹药却毫无变化 (那 2 发等于凭空消失)。没有迫击炮槽就不补 (弹药不进错枪)。
const w=pl.slots.find(s=>s&&s.def.mortar);
if(w){ w.reserve=Math.min(w.reserve+2,w.def.reserve); }
if(pl.isPlayer){ showScorePop('迫击炮已回收'); AudioSys.click(600,0.22,0.05); }
}
// ── 读条回收 (2026-09-28 阶段三 P1, 用户提议): 工程兵对自己建的东西**读条拆除** ─────────────
// B 靠近自己工事 = 1.2s 拆除读条 (退全款) / 再按取消 / 受击·离开·开始别的动作都打断;
// 6 靠近自己迫击炮 = 同一条读条走 recoverMortar。拆除走既有单源: 沙袋/MG killBox (碰撞盒+网格+OCC
// 脏矩形同拆), 医疗箱 removeMedkit, 铁丝网 alive=false+摘组, 拒马 摘网格+清 CYLS。占位圈 (PROPS)
// 就近释放让原地可以重建。BUILDS 在 22-hud 换局清理段随 MORTARS 一并清空。
const BUILDS=[];
const DEMOLISH_T=1.2;
function nearOwnBuild(pl){
let best=null,bd=2.8;
for(const b of BUILDS){ if(!b.alive||b.owner!==pl) continue;
const d=Math.hypot(b.tx-pl.pos.x,b.tz-pl.pos.z); if(d<bd){ bd=d; best=b; } }
return best;
}
function startDemolish(pl,b){
if(pl.demolish) return;
pl.demolish={b,t:0,mortar:false};
if(pl.isPlayer) showScorePop(t2('拆除中: {0} … (受击/移动取消 · 再按B加快)',t2(BUILD_NAMES[b.type])));   // ★2026-10-30: 同键再按=加快 (原"再按取消"口径已废)
}
function startMortarRecover(pl){
if(pl.demolish) return;
const m=MORTARS.find(mt=>mt.owner===pl&&mt.alive&&!mt.user&&Math.hypot(mt.x-pl.pos.x,mt.z-pl.pos.z)<3.5);
if(!m){ if(pl.mortarPlaced) showScorePop('需靠近自己的迫击炮才能回收'); return; }
// ★2026-10-25 反馈轮①: 找到炮=确认起步才抢读条 (离炮太远不白丢); ★2026-10-30 读条交互批: 改双击确认 (起步前)
if(pl.isPlayer&&player.readBarActive()){ if(!player.barStealArmed('Digit6')) return; player.stealBar(); }
pl.demolish={b:null,t:0,mortar:true};
if(pl.isPlayer) showScorePop('回收中: 迫击炮 … (受击/移动取消 · 再按6加快)');   // ★2026-10-30: 同键再按=加快 (原"再按取消"口径已废)
}
function stopDemolish(pl,quiet){
if(!pl.demolish) return;
pl.demolish=null;
if(!quiet&&pl.isPlayer) showScorePop('已取消');
}
function updateDemolish(pl,dt){
const d=pl.demolish; if(!d) return;
if(!pl.alive||pl.pendingBuild||(typeof VM!=='undefined'&&VM.state!=='idle')){ stopDemolish(pl,true); return; }
const cx=d.mortar?(()=>{const m=MORTARS.find(mt=>mt.owner===pl&&mt.alive); return m?{x:m.x,z:m.z}:null;})():{x:d.b.tx,z:d.b.tz};
if(!cx||(d.b&&!d.b.alive)||Math.hypot(cx.x-pl.pos.x,cx.z-pl.pos.z)>3.6){ stopDemolish(pl,true); return; }
d.t+=dt;
if(d.t<DEMOLISH_T) return;
pl.demolish=null;
if(pl.isPlayer) pl.barArmKey=null;   // ★2026-10-30: 拆除/回收自然走完清打断确认账 (旧键不得残留到下一条读条的双击窗里)
if(d.mortar){ recoverMortar(pl); return; }
const b=d.b; b.alive=false;
if(b.type==='sandbag'){ for(const bb of b.boxes) killBox(bb); }
else if(b.type==='hedge'){
for(const m of b.meshes) if(m.parent) world.remove(m);
for(let i=CYLS.length-1;i>=0;i--){ const c=CYLS[i]; if(Math.hypot(c.x-b.tx,c.z-b.tz)<1.3) CYLS.splice(i,1); }
}
else if(b.type==='wire'){ if(b.wire){ b.wire.alive=false; if(b.wire.grp.parent) world.remove(b.wire.grp); } }
else if(b.type==='mg'){
const m=b.mg;
if(m&&m.user){ b.alive=true; if(pl.isPlayer) showScorePop('有战友正在操作机枪, 无法拆除'); return; }
if(m){ if(m.grp.parent) world.remove(m.grp); const i=MG42S.indexOf(m); if(i>=0) MG42S.splice(i,1); }
for(const bb of b.boxes) killBox(bb); // MG 的前掩墙 (sandbagWall reg=false) 一并拆
}
else if(b.type==='medkit'){ if(b.crate) removeMedkit(b.crate); }
// 占位圈就近释放 (各件 propTake 都在自己中心) ⇒ 原地可重建
for(let i=PROPS.length-1;i>=0;i--){ const e=PROPS[i]; if(Math.hypot(e.x-b.tx,e.z-b.tz)<1.2) PROPS.splice(i,1); }
pl.buildCount=(pl.buildCount||0)+b.cost;
if(pl.isPlayer){ showScorePop(t2('{0} · 已拆除 (退还 {1} 点)',t2(BUILD_NAMES[b.type]),b.cost)); AudioSys.click(600,0.25,0.06); }
}
// 迫击炮落点指示圈
const mortarMarker=(()=>{
const g2=new THREE.Group();
const mmat=new THREE.MeshBasicMaterial({color:0xffc866,transparent:true,opacity:0.8,depthWrite:false,side:THREE.DoubleSide,fog:false});
const ring=new THREE.Mesh(new THREE.RingGeometry(0.8,1.02,26),mmat);
ring.rotation.x=-HPI; g2.add(ring);
const dot=new THREE.Mesh(new THREE.CircleGeometry(0.13,10),mmat);
dot.rotation.x=-HPI; dot.position.y=0.01; g2.add(dot);
for(const a of [0,HPI,Math.PI,Math.PI+HPI]){
const tick=new THREE.Mesh(new THREE.PlaneGeometry(0.07,0.34),mmat);
tick.rotation.x=-HPI;
tick.position.set(Math.sin(a)*1.22,0.005,Math.cos(a)*1.22);
tick.rotation.z=-a;
g2.add(tick);
}
g2.visible=false;
scene.add(g2);
return g2;
})();
// 建造菜单 (2026-09-28 阶段三 P1): **医疗箱并入工程兵建造** (用户裁定医护兵删除, 医疗箱=第 5 件建造) ——
// 建成的医疗箱与原医护兵放置的同一套 (17-emplacements placeMedkit: 8 次/120s, 同队取绷带), 建造点 2。
const BUILD_MENU=['sandbag','wire','hedge','mg','medkit'];
const BUILD_NAMES={sandbag:'沙袋墙',wire:'铁丝网',hedge:'拒马',mg:'重机枪',medkit:'医疗箱'};
const BUILD_COST={sandbag:1,wire:1,hedge:1,mg:3,medkit:2};
// 丧尸模式商店件 ZP 价 (2026-10-28 单源): 建造弹窗 (19-input Digit5) 与 engBuild 扣款同读此表 ——
// 旧版价目内联在 engBuild 里, Digit5 提示拿 BUILD_COST[tower/ammoc] 查空 ⇒ "消耗undefined点" 穿帮。
const BUILD_ZP={mg:150,tower:250,ammoc:80};
const BUILD_TIME={sandbag:2.2,wire:2.2,hedge:1.8,mg:3.4,medkit:2.0};
// 建造升起动画: 新建工事从地里逐渐升起
const RISERS=[];
function riseNewMeshes(ci,dur=0.85){
for(let i=ci;i<world.children.length;i++){
const m2=world.children[i];
if(!m2||(!m2.isMesh&&!m2.isGroup)) continue;
const ty=m2.position.y;
m2.position.y=ty-1.1;
RISERS.push({m:m2,ty,t:0,dur});
}
}
function updateRisers(dt){
for(let i=RISERS.length-1;i>=0;i--){
const r=RISERS[i]; r.t+=dt;
const k=clamp(r.t/r.dur,0,1), s=sstep(k);
r.m.position.y=r.ty-1.1*(1-s);
if(k>=1){ r.m.position.y=r.ty; RISERS.splice(i,1); }
}
}
// 工程兵建造: 按B开始锤击建造, 动画结束后工事落成
function engBuild(pl){
if(VM.state!=='idle') return;
const bc=pl.buildCount||0;
const type=BUILD_MENU[pl.buildSel||0];
const cost=BUILD_COST[type]||1;
// 丧尸模式点数商店 (2026-10-06 裁定④): mg/瞭望塔/弹药箱走 ZP 点数 (击杀丧尸/占旗所得), 不吃建造点;
// 基础工事免费件 (2026-10-28 修复, 指导 §4.6(2)): 沙袋/铁丝/拒马在丧尸模式**全职业免费** ——
// 不扣建造点不扣 ZP (读条建造照旧), 医疗箱仍吃建造点。普通模式 (非丧尸) 零变化。
let zpCost=0;
const isFreeItem=ZOMBIE_MODE&&(type==='sandbag'||type==='wire'||type==='hedge');
if(isFreeItem){
 // 免费放行: pendingBuild 记 cost:0 ⇒ 落成扣款/拆除退款都按 0 对账
}else if(ZOMBIE_MODE&&pl.isPlayer&&BUILD_ZP[type]!==undefined){
zpCost=BUILD_ZP[type];
if((player.pz|0)<zpCost){ showScorePop(t2('ZP 点数不足 ({0}/{1}) — 击杀丧尸 / 占领旗点可得',player.pz|0,zpCost)); return; }
}else if(bc<cost){ showScorePop(t2('建造点数不足 ({0}/{1}) — 弹药箱旁按F补给可回满',bc,cost)); return; }
const o=pl.pos.clone(); const dir=camForward(); dir.y=0;
if(dir.lengthSq()<0.1) return;
dir.normalize();
const tx=o.x+dir.x*2.4, tz=o.z+dir.z*2.4;
if(occBlocked(tx,tz)){ showScorePop(t2('此处无法建造')); return; }
const lim=MAP_SIZE/2-4;
if(Math.abs(tx)>lim||Math.abs(tz)>lim){ showScorePop(t2('超出战场边界')); return; }
if(!player.barStealArmed('KeyB')) return;   // ★2026-10-30 读条交互批: 建造起步=双击确认 (定位在全部早退之后=确认起造; 首按不建不置 pendingBuild, 只亮提示)
pl.pendingBuild={type,cost:isFreeItem?0:cost,zp:zpCost,tx,tz,ry:Math.atan2(dir.x,dir.z)};
player.stealBar();   // ★2026-10-25 反馈轮①升级: 定位在全部早退之后=确认起造才抢; 读条账目旗(nadeHeld/bandaging)与模型层一起收
VM.state='build'; VM.stateT=0; VM.stateDur=BUILD_TIME[type]||2.2; vmResetSndFlags();
showScorePop(t2('建造中: {0} … (移动取消)',t2(BUILD_NAMES[type])));
}
function cancelBuild(pl){
if(!pl.pendingBuild) return;
pl.pendingBuild=null;
if(VM.state==='build'){
VM.state='idle';
if(VM.gunParts) VM.gunParts.gun.visible=true;
if(VM.hammerM) VM.hammerM.visible=false;
vmResetSndFlags();
}
}
function engBuildExec(pl){
const tk=pl.pendingBuild; pl.pendingBuild=null;
if(!tk||!pl.alive) return;
if(occBlocked(tk.tx,tk.tz)){ showScorePop(t2('位置被占用, 建造取消')); return; }
const ci=world.children.length;
const bi=BOXES.length; // 读条回收: 捕获本次建造新增的碰撞盒 (killBox 拆除单源) 与网格
if(tk.type==='sandbag'){ sandbagWall(tk.tx,tk.tz,4,tk.ry); }
else if(tk.type==='wire'){ barbedWire(tk.tx,tk.tz,tk.ry,4.2,pl); }
else if(tk.type==='hedge'){ hedgehog(tk.tx,tk.tz); }
else if(tk.type==='mg'){ mg42(tk.tx,tk.tz,tk.ry,pl.team); }
else if(tk.type==='tower'){ watchtower(tk.tx,tk.tz,tk.ry); }          // 丧尸模式商店件: 瞭望塔 (2026-10-06)
else if(tk.type==='ammoc'){ ammoCrate(tk.tx,tk.tz,true); }            // 丧尸模式商店件: 弹药箱 (force 绕道具互斥)
else if(tk.type==='medkit'){
// 医疗箱: placeMedkit 自带落点避让 (多偏移兜底), 仍失败则**退还点数** (锤击动画已播, 不白扣)
if(!placeMedkit(pl,tk.tx,tk.tz)){
pl.buildCount=(pl.buildCount||0)+tk.cost;
if(pl.isPlayer) showScorePop(t2('此处放不下医疗箱 · 建造点已退还'));
return;
}
}
riseNewMeshes(ci,0.85);
if(tk.zp){ if(pl.isPlayer&&typeof pzGain==='function') pzGain(-tk.zp); }   // ZP 扣款 (商店件)
else pl.buildCount=(pl.buildCount||0)-tk.cost;
// 读条回收登记 (2026-09-28 阶段三 P1): 记下归属/落点/成本 + 类型专属引用, 拆除时按型走单源
const entry={type:tk.type,cost:tk.cost,tx:tk.tx,tz:tk.tz,ry:tk.ry,owner:pl,alive:true,
boxes:BOXES.slice(bi),meshes:world.children.slice(ci),wire:null,crate:null,mg:null};
if(tk.type==='wire') entry.wire=wires.find(w=>w.alive&&Math.hypot(w.x-tk.tx,w.z-tk.tz)<2.5&&w.builder===pl)||null;
if(tk.type==='medkit') entry.crate=MED_CRATES.find(c=>c.uses>0&&Math.hypot(c.x-tk.tx,c.z-tk.tz)<2.5&&c.owner===pl)||null;
if(tk.type==='mg') entry.mg=MG42S.find(m=>Math.hypot(m.x-tk.tx,m.z-tk.tz)<3)||null;
BUILDS.push(entry);
// 增量插入碰撞空间网格 (Phase 1 任务 1.5)
if(typeof spatialIndexAddBox==='function'){
for(let b=bi;b<BOXES.length;b++) spatialIndexAddBox(b);
}
// 工事血量 (2026-10-06 裁定④"工事可被破坏"): 登记为轻量 DESTRUCTIBLES 组 —— 命中走
// damageStructures 的 boxDist3 既有通道, hp 归零走 destroyStructure 通用拆毁 (碎石/Nav脏区)。
if(ZOMBIE_MODE&&typeof registerFortHP==='function') registerFortHP(entry,bi);
const gy=heightAt(tk.tx,tk.tz);
for(let i=0;i<7;i++) spawnP(PT.dirt,tk.tx+rand(-1.6,1.6),gy+rand(0.1,0.4),tk.tz+rand(-1.6,1.6),rand(-1,1),rand(0.5,1.6),rand(-1,1),rand(0.3,0.5),0.8,rand(0.5,0.9),0.85,2);
if(pl.isPlayer){ showScorePop(t2('{0} · 建成 (剩余 {1} 点)',t2(BUILD_NAMES[tk.type]),pl.buildCount)); AudioSys.metalSlide(0.25,0.2,300,150); }
markNavDirty();
}
// 铁丝网减速/伤害区域: 每帧检测 combatants (WIRES 专门存储)
// !alive 跳过 (2026-09-26): 被坦克碾平的铁丝网条目仍留在 wires 表里 (供 23b 重开复位),
// 但必须彻底失效 —— 否则"碾平了却还在减速/扎人"。
function isWire(x,z){for(const w of wires){if(!w.alive) continue;if(Math.hypot(w.x-x,w.z-z)<w.r) return w;}return null;} // wires 声明移至 05b-props (2026-09-05: 布局构建期 barbedWire 需在其前可用)
function updateWires(dt){
if(!wires.length) return;
for(const s of combatants){
if(!s.alive||s.onVehicle||s.onMG||s.onAT||s.onAA||s.onMortar||s.mortUse||s.mgUse||s.empUse) continue;
const w=isWire(s.pos.x,s.pos.z);
if(!w) continue;
s.wireT=nowT;
s.wireTick=(s.wireTick||0)-dt;
if(s.wireTick<=0){
s.wireTick=0.8;
const hostile=!w.builder||w.builder.team!==s.team;
if(hostile){
s.damage(4,(w.builder&&w.builder.alive)?w.builder:null,false);
if(s.isPlayer) AudioSys.hurt();
}
}
}
}

// 架设机枪: 每个旗点一挺, 交替面向两侧基地 (通用)
// 先建一次占用网格用于落点避障(不撞进建筑/沙袋), 摆完再重建把机枪沙袋墙纳入碰撞
buildOccupancy();
buildSpatialIndex();
const _mgPreBoxes=BOXES.length;
const mgSpot=(x,z,spread)=>{
for(let t=0;t<14;t++){
const px=x+rand(-spread,spread), pz=z+rand(-spread,spread);
// 大桥旗点: 机枪只摆两岸, 桥面留给步兵/坦克通行
if(onBridge(px,pz,1)) continue;
// 占用格+道具+建筑足迹三重避障: 机枪绝不压住弹药箱/沙袋/杂物或钻建筑
if(!occBlocked(px,pz)&&propFree(px,pz,2.3)&&freeSpot(px,pz,0.6)) return [px,pz];
}
const po=propPushOut(x,z,2.3);
if(po&&!occBlocked(po[0],po[1])) return po;
return null;
};
FLAGS.forEach((f,i)=>{
// 机枪朝向: 带显式 own 的旗点(斯大林格勒 14 点)面向敌方主基地 = home 点枪口对着反攻轴线;
// 无 own 的中性旗沿用奇偶交替旧规则 (其他战役行为零变化)
const tgt=BASES[f.own===0?1:(f.own===1?0:(i%2))];
const face=Math.atan2(f.x-tgt.x,f.z-tgt.z);
const sp=mgSpot(f.x,f.z,9);
if(sp) mg42(sp[0],sp[1],face);
});
if(FLAGS.length>=3){
const fm=FLAGS[Math.floor(FLAGS.length/2)];
const sp=mgSpot(fm.x,fm.z,14);
if(sp) mg42(sp[0],sp[1],rand(0,TAU));
}
buildOccupancy();
// 增量插入碰撞空间网格 (Phase 1 任务 1.5, 废除全量 buildSpatialIndex)
if(typeof spatialIndexAddBox==='function'){
for(let b=_mgPreBoxes;b<BOXES.length;b++) spatialIndexAddBox(b);
}
