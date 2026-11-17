// ─────────────────────────────────────────────
// 04b-fire.js —— 可燃植被/火焰蔓延/树木倒伏/火源系统
// 载入顺序约束: 必须在 05c-layouts 之前 (buildWorld 在脚本载入期执行,
// tree()/bush() 等布置函数要向本模块的燃料表注册); 对 08-effects 的
// spawnP/PT 与 13/15/16 的实体表只在运行期函数体内引用, 无载入期依赖。
// ─────────────────────────────────────────────
'use strict';
// ===== 火焰网格: 全图均匀格子 (3m), 记录燃料量/燃烧态/受热 =====
// 燃料在世界构建期由植被注册: 灌木/草丛/庄稼/树篱/竹林/枯树; 树木单独按对象管理。
// 火源 (坦克残骸/坠机/燃烧弹) 点燃格子 → 格子烧完自身燃料并向邻格积热 → 蔓延。
const FRES=3;
const FN=Math.ceil((MAP_SIZE+40)/FRES)+1;
const FOFF=(MAP_SIZE+40)/2;
const FUEL=new Float32Array(FN*FN);
const FHEAT=new Float32Array(FN*FN);
const FBURN=new Float32Array(FN*FN);   // >0 = 燃烧已持续秒数
const FEXPIRE=new Float32Array(FN*FN); // 燃烧寿命上限(秒): 燃烧弹点燃的格提前强制熄灭, 蔓延继承 (0=不限, 残骸/树木火)
const FATT=new Array(FN*FN).fill(null); // 点火者 (击杀归属)
const FIRE_ACTIVE=[];                  // 正在燃烧的格子索引
const HEATED=[];                       // 受热但未燃的格子 (需要衰减)
const FIRE_SOURCES=[];                 // 持续火源: 坦克残骸/坠机
const FUEL_MAX=1.15;
// ── 蔓延速度总乘子 (2026-10-05 用户追加裁定, 两刀合一) ──
// ① 总体削弱: 全图全档火焰蔓延放慢两成 —— 基线平衡改动, 与天气无关, 是零回归红线 R1 的**明示例外**
//    (天气设计纲要 §6 已登记; 不接受"改前逐位"对账的只有这一处火势基线)。
// ② 天气压火: ×WX_CFG.fireMul (天气设计纲要 §4.2/§5-12; 晴朗/多云 ×1 = 未裁定的档不改蔓延)。
// 单源落点只有一处: updateFires 的 8 邻格积热率 —— 蔓延本质是"邻格积热 vs 0.25 冷却"的赛跑,
// 引燃阈值 0.8 / 冷却率 / 燃料消耗一律不动; 暴雨档 0.85×0.8×0.35≈0.24/s < 冷却 0.25 ⇒ 积热追不上冷却, 火不成链。
const FIRE_SPREAD_NERF=0.8;
const FIRE_SPREAD=FIRE_SPREAD_NERF*WX_CFG.fireMul;
// ── 火势与天气深化辅助 (二期: 伤害/燃烧时间/受潮消耗速率/暴雨熄灭单源) ──
function wxFireDmg(){ return (typeof WX_CFG!=='undefined'&&WX_CFG.fireDmgMul!==undefined)?WX_CFG.fireDmgMul:1.0; }
function wxBurnRate(){ return (typeof WX_CFG!=='undefined'&&WX_CFG.burnRateMul!==undefined)?WX_CFG.burnRateMul:1.0; }
function wxStormExt(){ return (typeof WX_CFG!=='undefined'&&WX_CFG.stormExtinguish)?WX_CFG.stormExtinguish:0; }

// ═══ 2026-11-13 性能批 A: 火焰视觉粒子全局预算门 ═══
// 结构事实 (读码确认): 树木 (updateBurningTrees)/生物 (updateCreaturesBurning)/持续火源 (FIRE_SOURCES)/
// 燃烧格 (FIRE_ACTIVE) 的火粒子**全部**走 08-effects 的统一 spawnP 池 (PARTICLE_MAX 帽 + 挤旧回收),
// 没有绕池的独立火焰链; 但"池帽"只限并发数 —— 火源多时火粒子以每帧几十发的速率挤占池子, 把非火特效
// (弹着尘/血雾/水花) 挤出池, 且每可见 Sprite = 1 个透明 draw call。本门 = **每帧全局火粒子 spawn 预算**
// (档位随 2026-11-08 applyFxQuality 同一旋钮 fxMaxIdx: 标准 26 / 精简 14 / 增强 44), 只拦视觉 spawnP 调用;
// 火种伤害账 (fireDamageTick/燃烧DOT)、蔓延判定 (igniteCell/igniteArea/FHEAT)、灯池火源登记
// (FIRE_SOURCES/FIRE_ACTIVE/SMOKES —— 08-effects updateFireLights 的候选来源) 一概不动。
const FIRE_FX_BUDGET_STEPS=[26,14,44];
let _fireFxN=0;   // 本帧已用预算 (updateFires 顶部清零; 24-main 每帧恰调一次 updateFires)
function fireFxOK(){
if(typeof window!=='undefined'&&window.FIRE_FX_UNLIMITED) return true;   // 回退旗 (A): 置真=关预算门, 火粒子回到无上限旧口径 (typeof 守卫: verify-fire 直调 04b 无 window)
if(_fireFxN>=(FIRE_FX_BUDGET_STEPS[SETTINGS.fxMaxIdx]||26)) return false;
_fireFxN++;
return true;
}

// ===== 生物附着燃烧系统 (Ignite / Burning DOT) =====
// ★2026-11-04b 免着火批 (用户实报: 调试模式/自由观战模式下玩家"不会被着火"):
//   player.damage() 早对 spectator 免伤, 但燃烧链是另一套 —— igniteCreature 照样写 burnTimer,
//   updateCreaturesBurning / fireDamageTick / 燃烧弹云 / 树爆 照样跑火焰粒子与 addTrauma,
//   于是观战者身上冒火、屏幕抖、掉血调用空转, 视觉上就是"观战者被点着了"。
//   这里立单一判据: 观战态 (含调试 spectator 与自由观战 specView/spectator) 一律不进入任何燃烧路径。
//   与 18-game damage 的 this.spectator 同谓词, 不另立第二套"谁算观战"。
function creatureIgnitable(s){
return !!(s&&s.alive&&!s.spectator);
}
if(typeof window!=='undefined') window.creatureIgnitable=creatureIgnitable;
function igniteCreature(s, attacker){
  if(!creatureIgnitable(s)||(typeof seatShielded==='function'&&seatShielded(s))) return;
  if(typeof waterYAt==='function'){
    const wy=waterYAt(s.pos.x,s.pos.z);
    if(wy>-1e8&&(s.pos.y||0)<wy+0.3) return; // 涉水灭火/免疫
  }
  const dur=(typeof WX_CFG!=='undefined'&&WX_CFG.burnDur!==undefined)?WX_CFG.burnDur:3.5;
  if(dur<=0) return;
  s.burnTimer=Math.max(s.burnTimer||0, dur);
  if(attacker) s.burnAttacker=attacker;
  if(!s.burnTickT) s.burnTickT=0.4;
}
if(typeof window!=='undefined') window.igniteCreature=igniteCreature;

let _burnFrame=0;
function updateCreaturesBurning(dt){
  const dmgMul=wxFireDmg();
  if(typeof combatants==='undefined'||!combatants) return;
  // ★2026-11-13 性能批 E: 生物燃烧账**隔帧交错**推进 —— 每个燃烧生物只在奇/偶帧之一真实结算, 两帧 dt 在
  //   s._burnAcc 累积后一并推进 ⇒ burnTimer 烧减/burnTickT 0.4s 伤害跳/DPS 总量逐位不变 (dt 累积钟, 不用
  //   setTimeout —— 沙箱 _bootstub 的 setTimeout 是 no-op), 节流的只是采样频率: 水面灭火判据与火焰粒子
  //   spawn 的每生物频次减半 (粒子再过 A 的全局预算门)。按下标交错, 避免全体生物同帧结算的尖峰。
  _burnFrame^=1;
  for(let si=0;si<combatants.length;si++){
    const s=combatants[si];
    // 观战者不着火 (2026-11-04b): 免疫期间顺手清掉残留账 (从活人切成观战的那条路径), 解冻/关闭调试后不带火
    if(s&&s.spectator&&(s.burnTimer||s.burnTickT)){ s.burnTimer=0; s.burnTickT=0; s.burnAttacker=null; }
    if(!creatureIgnitable(s)||!s.burnTimer||s.burnTimer<=0) continue;
    s._burnAcc=(s._burnAcc||0)+dt;
    if(!(typeof window!=='undefined'&&window.BURN_NO_STAGGER)&&((si+_burnFrame)&1)===0) continue;   // E: 本生物本帧跳过 (账已入 _burnAcc, 下帧一并推进); 回退旗 BURN_NO_STAGGER=旧每帧结算 (d2 仍走 _burnAcc 累积, DPS 等价)
    const d2=s._burnAcc; s._burnAcc=0;
    if(typeof waterYAt==='function'){
      const wy=waterYAt(s.pos.x,s.pos.z);
      if(wy>-1e8&&(s.pos.y||0)<wy+0.3){
        s.burnTimer=0;
        continue;
      }
    }
    s.burnTimer-=d2;
    s.burnTickT=(s.burnTickT||0.4)-d2;
    if(s.burnTickT<=0){
      s.burnTickT=0.4;
      const dmg=3.2*dmgMul;
      s.damage(dmg, s.burnAttacker||null, false);
      if(s.isPlayer&&typeof addTrauma==='function') addTrauma(0.08);
    }
    if(typeof camera!=='undefined'&&camera&&Math.hypot(s.pos.x-camera.position.x,s.pos.z-camera.position.z)<70&&Math.random()<0.55&&fireFxOK()){
      const gy=s.pos.y||(typeof heightAt==='function'?heightAt(s.pos.x,s.pos.z):0);
      spawnP(PT.flash,s.pos.x+rand(-0.2,0.2),gy+rand(0.4,1.2),s.pos.z+rand(-0.2,0.2),rand(-0.15,0.15),rand(1.0,1.8),rand(-0.15,0.15),rand(0.3,0.5),1.0,rand(0.2,0.35),0.85,-1,true);
      if(Math.random()<0.25&&fireFxOK()) spawnP(PT.dark,s.pos.x,gy+rand(0.8,1.4),s.pos.z,rand(-0.1,0.1),rand(0.8,1.4),rand(-0.1,0.1),0.6,1.2,rand(0.8,1.3),0.4,0.08);
    }
  }
}
const fCellI=(x,z)=>{
const i=clamp(Math.floor((x+FOFF)/FRES),0,FN-1), j=clamp(Math.floor((z+FOFF)/FRES),0,FN-1);
return j*FN+i;
};
function fuelAdd(x,z,amt){
const ci=fCellI(x,z);
if(FUEL[ci]<FUEL_MAX) FUEL[ci]=Math.min(FUEL_MAX,FUEL[ci]+amt);
}
// 火格 → 占用网格: 燃烧期间记占用, Bot/坦克寻路绕开火线 (buildOccupancy 重建时恢复)
function occMarkFire(ci){
if(!OCC.data) return;
const fx=(ci%FN)*FRES-FOFF, fz=Math.floor(ci/FN)*FRES-FOFF;
const i0=clamp(Math.floor((fx-1.4+OCC.off)/OCC.res),0,OCC.N-1), i1=clamp(Math.ceil((fx+1.4+OCC.off)/OCC.res),0,OCC.N-1);
const j0=clamp(Math.floor((fz-1.4+OCC.off)/OCC.res),0,OCC.N-1), j1=clamp(Math.ceil((fz+1.4+OCC.off)/OCC.res),0,OCC.N-1);
for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++) OCC.data[j*OCC.N+i]=1;
occTouch(fx-1.4,fz-1.4,fx+1.4,fz+1.4); // 增量重烘焙脏矩形 (03-terrain; 缺它=火线不进寻路)
}
let fireNavT=0;
function igniteCell(ci,attacker,lifeCap){
if(FUEL[ci]<=0.05||FBURN[ci]>0) return;
FBURN[ci]=0.001;
FATT[ci]=attacker||null;
FEXPIRE[ci]=lifeCap||0;
FIRE_ACTIVE.push(ci);
HEATED.push(ci);
occMarkFire(ci);
if(fireNavT<=0) fireNavT=5;
}
function igniteArea(x,z,r,attacker,lifeCap){
const ci0=fCellI(x,z), n=Math.ceil(r/FRES);
const cx0=ci0%FN, cz0=Math.floor(ci0/FN);
for(let dj=-n;dj<=n;dj++)for(let di=-n;di<=n;di++){
const i=clamp(cx0+di,0,FN-1), j=clamp(cz0+dj,0,FN-1);
const ci=j*FN+i;
if(FUEL[ci]<=0.05||FBURN[ci]>0) continue;
const wx=(ci%FN)*FRES-FOFF+FRES/2, wz=j*FRES-FOFF+FRES/2;
const dx=wx-x, dz=wz-z;
if(dx*dx+dz*dz<=(r+1.4)*(r+1.4)) igniteCell(ci,attacker,lifeCap);
}
}
// ===== 持续火源 (坦克残骸/坠机残骸): 自身喷射火焰 + 点燃周围植被 + 灼烧圈内单位 =====
// follow (★2026-10-03 修"船开走火/烟浮空"): {ship,an} —— 载具航行中着火就点常燃火源, 旧版把世界
//   坐标一次烤死 ⇒ 车一开, 火焰/烟雾/灼烧圈全漂在原地。带 follow 的源每帧在 updateFires 里重投影到
//   锚点 (局部坐标) 的世界位姿; an 可为 {position:{x,y,z}} 形状的局部锚 (capAnchorWorld 只读 .position)。
//   载具没了 (复位/移除) 则当场掐火。大舰子系统 (15h, 原 capAnchorWorld 定义处) 已于 2026-11-10
//   随纯海战图下架归档, 本函数自那起**落籍本文件** (坦克/卡车/小艇燃烧 follow 仍在用)。
// 锚点世界坐标 (烟囱口等局部锚): 用载具位姿手算 —— 不依赖 grp 的 matrixWorld (沙箱里 updateMatrixWorld 是桩)
let _cawP=null; // capAnchorWorld 复用槽 (2026-11-11 性能批): 唯一调用点 updateFires 的 follow 重投影
// 每帧每燃烧载具 1 次, 消费即时 (s.x/s.y/s.z 读后即弃)。懒建 V3 —— 顶层禁 new THREE (库纪律)。
function capAnchorWorld(s,an){
if(!_cawP) _cawP=V3();
const c=Math.cos(s.yaw), n=Math.sin(s.yaw);
const ax=an.position.x, az=an.position.z;
_cawP.set(s.pos.x+ax*c+az*n, s.pos.y+an.position.y, s.pos.z-ax*n+az*c);
return _cawP;
}
function addFireSource(x,z,y,r,ttl,dps,attacker,follow){
const s={x,z,y,r,ttl,dps,attacker:attacker||null,acc:0,smk:0,igniteT:0,follow:follow||null};
FIRE_SOURCES.push(s);
return s; // 返回源对象: 残骸开始沉入地下时 removeFireSource 提前熄火
}
function removeFireSource(s){
if(!s) return;
const i=FIRE_SOURCES.indexOf(s);
if(i>=0) FIRE_SOURCES.splice(i,1);
}
// ===== 载具残血起火 (2026-11-09 批): hp<maxHp×VEH_BURN_FRAC 时点火; 燃烧掉血账在载具自己的 update 里走 =====
// 地面/舰艇载具带 follow 火源, dps=0 —— 火源只做视觉+点燃植被, 车体伤害走燃烧账 (update 每 tick 直扣 hp),
// 不与火源圈的灼烧结算叠加。follow 锚走 capAnchorWorld 通用位姿换算 (本文件上方, 只读 pos+yaw, 对坦克/卡车/
// 舰艇一律成立), 载具 die 置 alive=false ⇒ updateFires 的 follow 块当帧 ttl=0 自动掐火, 残骸火源无缝接管。
// 飞机不带火源 (飞行拖火会沿航线点燃全图), 视觉由 Plane.update 燃烧分支直喷粒子。
function vehBurnIgnite(v,attacker){
if(v.burning) return;
v.burning=true;
v.burnBy=attacker||null;
v.burnSrc=(v.kind!=='plane'&&typeof addFireSource==='function')
?addFireSource(v.pos.x,v.pos.z,(v.pos.y||0)+1.3,2.6,VEH_BURN_TIME+3,0,v.burnBy,{ship:v,an:{position:{x:0,y:1.3,z:0}}})
:null;
}
// ===== 火情查询 (Bot 躲避/选点用): 距最近燃烧格/火源圈的净距 < clear 即视为威胁 =====
// 返回 {dx,dz} 指向最近火心的向量 (bot 据此背火逃离), 无火 null。clear=需保持的净距(m):
// bot 逃命触发 2.0 / 掩体与驻守点过滤 2.8 (格心半宽~2, 即距格心 >4.8m 才算安全落点)
function fireThreat(x,z,clear){
let bd=1e9, bx=0, bz=0;
const n=Math.ceil((clear+3)/FRES);
const ci0=fCellI(x,z), cx0=ci0%FN, cz0=Math.floor(ci0/FN);
for(let dj=-n;dj<=n;dj++)for(let di=-n;di<=n;di++){
const i=cx0+di, j=cz0+dj;
if(i<0||j<0||i>=FN||j>=FN) continue;
const ci=j*FN+i;
if(FBURN[ci]<=0) continue;
const fx=(ci%FN)*FRES-FOFF+FRES/2, fz=j*FRES-FOFF+FRES/2;
const dd=Math.hypot(x-fx,z-fz)-2.0;
if(dd<bd){ bd=dd; bx=fx; bz=fz; }
}
for(const s of FIRE_SOURCES){
const dd=Math.hypot(x-s.x,z-s.z)-s.r;
if(dd<bd){ bd=dd; bx=s.x; bz=s.z; }
}
if(bd>clear) return null;
return {dx:bx-x, dz:bz-z};
}
const TREE_LIVE=[];        // 活树记录 (flushTreeBatch 回填实例索引); 数组本体仅沙箱断言读 (verify-fire/verify-sink), 逐树状态走 floraHash
const FLORA_HASH=new Map(); // 3m 格 → 植被记录数组 (碾压/爆炸/点燃查询)
let FLORA_HASH_N=0;         // 已登记记录数 (2026-09-20 I5: 植被遮蔽索引的失效判据 —— 世界重建/后补植株都会 +1)
function floraHashAdd(rec){
const ci=fCellI(rec.x,rec.z);
let arr=FLORA_HASH.get(ci);
if(!arr){ arr=[]; FLORA_HASH.set(ci,arr); }
arr.push(rec);
FLORA_HASH_N++;
}
function floraNear(x,z,r,cb){
const ci0=fCellI(x,z), n=Math.ceil(r/FRES);
const cx0=ci0%FN, cz0=Math.floor(ci0/FN);
for(let dj=-n;dj<=n;dj++)for(let di=-n;di<=n;di++){
const i=clamp(cx0+di,0,FN-1), j=clamp(cz0+dj,0,FN-1);
const arr=FLORA_HASH.get(j*FN+i);
if(!arr) continue;
for(const rec of arr){ if(!rec.dead) cb(rec); }
}
}
function killCyl(c){
if(!c) return;
c.dead=true; c.r=0; c.y1=c.y0-1;
}
// ===== 灌木: 两片交叉叶面 (并入独立 InstancedMesh), 无碰撞, 可燃/可碾 =====
const BUSH_BATCH=[];
const BUSH_LIVE=[];        // 灌木记录: 逐株状态经 floraHash 供燃烧/碾压读写; 数组本体仅沙箱断言读 (verify-fire/verify-sink)
function bush(x,z,s=1){
if(!propFree(x,z,0.8*s)) return;
propTake(x,z,0.8*s);
const g0=heightAt(x,z)-0.05;
const yaw0=wr(0,Math.PI);
const inst=[[yaw0,wr(-0.2,0.2),s*wr(0.4,0.58)],[yaw0+HPI+wr(-0.2,0.2),wr(-0.25,0.1),s*wr(0.4,0.58)]];
BUSH_BATCH.push({x,z,s,g0,inst});
fuelAdd(x,z,1.0);
}
let BUSH_IM=null;
function flushBushes(){
if(!BUSH_BATCH.length) return;
const n=BUSH_BATCH.length;
BUSH_IM=new THREE.InstancedMesh(treeLeafGeo,MAT.leaves,n*2);
BUSH_IM.castShadow=false; BUSH_IM.receiveShadow=false;
BUSH_IM.frustumCulled=false;
instColorInit(BUSH_IM); // 灌木烧毁染焦黑的前置 (与 registerBurnableInst 同一口径, 见该函数注)
const _m=new THREE.Matrix4(), _p=new THREE.Vector3(), _q=new THREE.Quaternion(), _e=new THREE.Euler(), _s=new THREE.Vector3();
BUSH_BATCH.forEach((b,bi)=>{
const rec={kind:'bush',x:b.x,z:b.z,s:b.s,g0:b.g0,im:BUSH_IM,li0:bi*2,alive:true,dead:false};
b.inst.forEach(([ry,rx,ls],k)=>{
_p.set(b.x,b.g0+0.62*b.s,b.z);
_e.set(rx,ry,0); _q.setFromEuler(_e); _s.setScalar(ls);
_m.compose(_p,_q,_s);
BUSH_IM.setMatrixAt(bi*2+k,_m);
});
BUSH_LIVE.push(rec);
floraHashAdd(rec);
});
world.add(BUSH_IM);
BUSH_BATCH.length=0;
}
// ===== 灌木散布: 各布局通用 (密度随主题草量/画质缩放), 避开道路/河道/田块/旗点/建筑 =====
const BURN_INST=[]; // {im, byCell:Map} —— 烧毁后按格隐藏的实例批 (草丛/庄稼)
function scatterBushes(){
if(CAMPAIGN.city) return; // 城市组: 无灌木 (瓦砾/街垒为掩体语言)
const q=SETTINGS.quality===0?0.6:(SETTINGS.quality===1?0.85:1);
const n=Math.round(FLORA_CFG.bushN*THEME.grassMul*q);   // 2026-09-20 I5: 基数 150 提为单源 (00-config FLORA_CFG; 缺省仍 150 ⇒ 其余图零变化)
const TR3=MAP_SIZE/2-10;
let placed=0;
for(let i=0;i<n*3&&placed<n;i++){
const x=wr(-TR3,TR3), z=wr(-TR3,TR3);
if(roadDist(x,z)<5) continue;
if(inRiverChannel(x,z)) continue;
// 环礁 (2026-09-18): 湿沙/浅水不生灌木; 2026-09-20 I5: 阈值提到单源 FLORA_CFG.shoreGuard
// (环礁=22m=沙丘脊线, 迎海面/湿沙保持开阔火力场; 其余主题缺省 15 与旧版逐字一致)
if(SEA&&shoreDist(x,z)>-FLORA_CFG.shoreGuard) continue;
if(SEA&&rectDist(x,z,SEA.runway.x0,SEA.runway.z0,SEA.runway.x1,SEA.runway.z1)<=0) continue; // 跑道面
if(RURAL_FIELDS.length&&fieldAt(x,z)) continue;
if(CROP_FIELDS.length) { // 庄稼软遮蔽田内不落灌木 (保持田块整洁)
let inCrop=false;
for(const f of CROP_FIELDS){ if(x>f.x0-1&&x<f.x1+1&&z>f.z0-1&&z<f.z1+1){ inCrop=true; break; } }
if(inCrop) continue;
}
let near=false;
for(const f of CAMPAIGN.flags){ if(Math.hypot(x-f.x,z-f.z)<f.r+6){ near=true; break; } }
if(near) continue;
if(!freeSpot(x,z,1.2)) continue;
bush(x,z,wr(0.8,1.5));
placed++;
}
flushBushes();
}
// 注册草丛/庄稼实例批: 烧毁时按格染焦黑 + 沉入 (旧注释"零缩放隐藏"为史前口径, 现走 queueSink)
// 实例批 instanceColor **建模期白初始化** (2026-10-24 用户报"被烧毁的植物没变黑炭色就消失"):
// 烧尽路径的染色守卫是 "instanceColor 非空才 setColorAt" —— 而这三类批 (草丛/庄稼/灌木) 建模期
// 从未初始化 instanceColor ⇒ 守卫恒假, 烧尽只沉入不变黑。全白 (1,1,1) 与旧观感逐位一致
// (instanceColor 是乘法项); 放在建模期而不是烧毁瞬间, 还免去运行中 null→非null 触发
// 该材质 getProgram 重编译的一次性卡顿 (树干批 643 行的惰性创建是既有已验收行为, 不动)。
function instColorInit(im){
if(!im||!im.setColorAt||im.instanceColor) return;
const c=new THREE.Color(1,1,1);
for(let i=0;i<im.count;i++) im.setColorAt(i,c);
im.instanceColor.needsUpdate=true;
}
function registerBurnableInst(im,byCell){
instColorInit(im);
BURN_INST.push({im,byCell,dirty:false});
}
// ═══════════ 植被软遮蔽 (2026-09-20 I5: 灌木/树冠挡视野 · 玩家与 Bot 同规则) ═══════════
// 用户口径 (已确认): "灌木/树冠挡视野, 但只在命中遮挡时生效、且不挡子弹"。
// 为什么独立成一支: 烟雾是球体 (08-effects), 庄稼是矩形田 (05b), 植被是**逐株蓬面** —— 数据源
//   只能是 FLORA_HASH 的逐株记录 (灌木/蕨丛/乔木/椰树); 但对外接口语义与 smokeBlocksLOS /
//   cropBlocksLOS **完全一致** (ax,ay,az,bx,by,bz → 布尔), 在 14-bots.perceive 里并排 continue。
// 不挡子弹: 本函数只在 AI 视线判定里查询; raySoldiers/raycastWorld/fireBullet/vehHitCyl 一律不引用
//   (dev/verify-foliage.js ⑥ 用全仓库引用检索把这条线守住)。
// 数值口径 (皆由 05b 的建模尺寸反推, 不是拍脑袋):
//   灌木 bush: 蓬面主体带 g0+0.15s ~ g0+1.10s —— 两片交叉叶面 5×5 各缩放 0.4~0.58s, 最高叶尖
//     约 g0+2.0s 属稀薄边缘; "只在命中遮挡时生效"就不把视觉边缘当实心墙。水平半宽 1.30s
//     (叶面外接半径 1.0~1.45s 的代表值)。s=1.35 时墩高 1.49m ⇒ 站立可见/蹲下隐, 手感有梯度。
//   蕨丛 fern: 低矮 (g0+0.10 ~ g0+0.75, r 1.0) —— 只挡匍匐/蹲姿的低视线。
//   乔木 tree: 冠层带 g0+1.00s ~ g0+5.40s, r 2.30s —— 三片 5×5 叶面挂在 3.4s/4.0s/4.6s, 叶面
//     半高 2.0~2.9s ⇒ 冠层下缘 0.5~1.4s (取中值 1.0s)。**树干本身不遮挡** (树干段 0~1.0s 仍由
//     既有 CYLS 硬碰撞管): 于是"树后看不见但子弹照穿"正是用户要的语义。
//   椰树 palm: 冠只长在干顶 (cyl.y1 = g0+5.8~12m), 取 [y1-1.8, y1+0.3] / r 3.2 —— 地面步兵平视
//     从冠下穿过 (与实机视觉一致), 塔顶/车长镜/飞机俯视时才会被椰冠挡。
//   枯树 dead / 树篱 hedge / 竹丛 bamboo **不入表**: 枯树无叶; 树篱已有 addBoxCollider 硬掩体
//     (raycastWorld 已挡); 竹丛是细杆无蓬面 —— 再列一遍就是两套代码做同一件事 (纲领 §2)。
const FOLIAGE_LOS={bushLow:0.15,bushTop:1.10,bushR:1.30,fernLow:0.10,fernTop:0.75,fernR:1.00,
treeLow:1.00,treeTop:5.40,treeR:2.30,palmDrop:1.80,palmRise:0.30,palmR:3.20};
const FLORA_LOS_STAT={built:0,cells:0,refs:0,ms:0,calls:0,tested:0,blocked:0}; // 实测统计口 (dev/verify-foliage 读)
const FOLIAGE_LOS_MAXCELL=512; // 单次查询最多步进 512 个 3m 格 (>640 图对角线 302 格; 兜底防死循环)
let _floraLosIdx=null, _floraLosKey=-1, _floraLosStamp=0;
function floraLosBand(rec){
const s=rec.s||1, g=rec.g0||0;
switch(rec.kind){
case 'bush': return {lo:g+FOLIAGE_LOS.bushLow*s, hi:g+FOLIAGE_LOS.bushTop*s, r2:(FOLIAGE_LOS.bushR*s)*(FOLIAGE_LOS.bushR*s)};
case 'fern': return {lo:g+FOLIAGE_LOS.fernLow, hi:g+FOLIAGE_LOS.fernTop, r2:FOLIAGE_LOS.fernR*FOLIAGE_LOS.fernR};
case 'tree': return {lo:g+FOLIAGE_LOS.treeLow*s, hi:g+FOLIAGE_LOS.treeTop*s, r2:(FOLIAGE_LOS.treeR*s)*(FOLIAGE_LOS.treeR*s)};
case 'palm':{ const y1=rec.cyl?rec.cyl.y1:g; return {lo:y1-FOLIAGE_LOS.palmDrop, hi:y1+FOLIAGE_LOS.palmRise, r2:FOLIAGE_LOS.palmR*FOLIAGE_LOS.palmR}; }
default: return null; // 枯树/树篱/竹丛等: 不参与软遮蔽 (见上表说明)
}
}
// 索引: FLORA_HASH 是 3m 格 → 逐株记录, 但单株蓬面半径可达 4m 级 (椰冠), 若只登记"株心所在格",
// 视线就会漏掉从邻格伸过来的冠层。故按**蓬面圆覆盖的格**做膨胀登记 —— 查询时只走视线真正经过的
// 格 (与 floraNear 同一张格网/同一批记录对象), 不做任何全量遍历。
function buildFloraLosIndex(){
const t0=Date.now();
const idx=new Map();
let cells=0, refs=0;
for(const arr of FLORA_HASH.values()){
for(const rec of arr){
if(rec._fl===undefined) rec._fl=floraLosBand(rec);   // 每株只算一次高度带/半径
const b=rec._fl; if(!b) continue;
const r=Math.sqrt(b.r2);
const i0=clamp(Math.floor((rec.x-r+FOFF)/FRES),0,FN-1), i1=clamp(Math.floor((rec.x+r+FOFF)/FRES),0,FN-1);
const j0=clamp(Math.floor((rec.z-r+FOFF)/FRES),0,FN-1), j1=clamp(Math.floor((rec.z+r+FOFF)/FRES),0,FN-1);
for(let j=j0;j<=j1;j++) for(let i=i0;i<=i1;i++){
const ci=j*FN+i;
let a=idx.get(ci);
if(!a){ a=[]; idx.set(ci,a); cells++; }
a.push(rec); refs++;
}
}
}
_floraLosIdx=idx; _floraLosKey=FLORA_HASH_N;
FLORA_LOS_STAT.built++; FLORA_LOS_STAT.cells=cells; FLORA_LOS_STAT.refs=refs; FLORA_LOS_STAT.ms=Date.now()-t0;
}
// 植被遮蔽查询: 视线 A→B 是否被活着的灌木蓬面/蕨丛/树冠/椰冠挡住。
// 早退链: 无植被 → 同点 → 只步进线段经过的格 (粗筛) → 每格内先剔死株/倒伏株 → 线段-圆盘判别式
// → y 区间与蓬面高度带相交才算遮挡。A/B 是"眼位", 与 smoke/crop 同一套调用口径 (米)。
function foliageBlocksLOS(ax,ay,az,bx,by,bz){
if(!FLORA_HASH_N) return false;
if(_floraLosKey!==FLORA_HASH_N) buildFloraLosIndex();   // 世界重建/后补植株 → 自动重建一次
const idx=_floraLosIdx; if(!idx||!idx.size) return false;
const dx=bx-ax, dz=bz-az, dy=by-ay;
const L2=dx*dx+dz*dz;
if(L2<1e-6) return false;   // 同点: 无视线方向
FLORA_LOS_STAT.calls++;
// 粗筛: Amanatides-Woo 3m 格步进 (只问视线经过的格)
let i=clamp(Math.floor((ax+FOFF)/FRES),0,FN-1), j=clamp(Math.floor((az+FOFF)/FRES),0,FN-1);
const iE=clamp(Math.floor((bx+FOFF)/FRES),0,FN-1), jE=clamp(Math.floor((bz+FOFF)/FRES),0,FN-1);
const sI=dx>0?1:(dx<0?-1:0), sJ=dz>0?1:(dz<0?-1:0);
const dI=sI?Math.abs(FRES/dx):Infinity, dJ=sJ?Math.abs(FRES/dz):Infinity;
let tI=sI?((sI>0?(i+1)*FRES-FOFF:i*FRES-FOFF)-ax)/dx:Infinity;
let tJ=sJ?((sJ>0?(j+1)*FRES-FOFF:j*FRES-FOFF)-az)/dz:Infinity;
const stamp=++_floraLosStamp;
// 2026-09-20 I5 审计修复 (foliage/task-7 查出): 旧版在步进后若"下一格已越过 t=1"就直接 break ——
// 但那一格正是**刚迈进去的视线终点格**, 于是终点格永远没被扫描 (起点格扫了), 判定方向不对称:
// "敌人站在灌木丛里" (B=株心) 在 island 实测漏判 164/1752 株 (9.4%), 反向仅 19 株 (1.1%)。
// 现改为只标记 stop, 下一轮先把新格扫完再退 (与审计侧 losFixed 的最小修法逐字一致)。
let stop=false;
for(let guard=0;guard<FOLIAGE_LOS_MAXCELL;guard++){
const arr=idx.get(j*FN+i);
if(arr){
for(let k=0;k<arr.length;k++){
const rec=arr[k];
if(rec.dead||rec.alive===false||rec.fall) continue;   // 烧毁/炸没/碾毁/倒伏 → 不再遮挡
if(rec._ls===stamp) continue;                          // 同一株跨多格: 本次查询只精算一次
rec._ls=stamp;
FLORA_LOS_STAT.tested++;
const b=rec._fl;
// 精算: XZ 线段 vs 蓬面圆 (判别式 q²-4L2·c) → 相交参数区间, 再判区间两端 y 是否碰到高度带
const fx=ax-rec.x, fz=az-rec.z;
const q=2*(fx*dx+fz*dz), c=fx*fx+fz*fz-b.r2;
const disc=q*q-4*L2*c;
if(disc<0) continue;
const sq=Math.sqrt(disc);
let t0=(-q-sq)/(2*L2), t1=(-q+sq)/(2*L2);
if(t0<0) t0=0; if(t1>1) t1=1;
if(t0>t1) continue;
const ya=ay+dy*t0, yb=ay+dy*t1;
const ylo=ya<yb?ya:yb, yhi=ya<yb?yb:ya;
if(ylo<=b.hi&&yhi>=b.lo){ FLORA_LOS_STAT.blocked++; return true; }
}
}
if(i===iE&&j===jE) break;
if(stop) break;                // 上一轮已判定"刚进入的格就是视线终点格", 本轮已扫过它
if(tI<tJ){ i+=sI; tI+=dI; } else { j+=sJ; tJ+=dJ; }
if(Math.min(tI,tJ)>1) stop=true;
}
return false;
}
let _fm=null,_fp=null,_fs=null,_fq=null,_fq2=null,_fa=null,_fe=null,_fc=null,_charCol=null;
let _charredFloraMat=null; // 焦黑材质单例 (2026-10-24f: 原挂 window —— 无 window 的裸 Node 沙箱 verify-fire 在烧尽路径直接 ReferenceError, 收编模块级; 名字不变, verify-fixes 字符串断言仍命中)
function fireTmp(){
if(_fm) return;
_fm=new THREE.Matrix4(); _fp=new THREE.Vector3(); _fs=new THREE.Vector3();
_fq=new THREE.Quaternion(); _fq2=new THREE.Quaternion(); _fa=new THREE.Vector3();
_fe=new THREE.Euler(); _fc=new THREE.Vector3(); _charCol=new THREE.Color(0x241d16);
_wlQ=new THREE.Quaternion(); // 柳实例批运行期四元数载体 (懒建, 2026-11-11; compose 读 ._x 故必须真实例+分量赋值)
}
// ===== 植被消失 (烧尽/被炸/被碾): 碰撞即死, 视觉残留 → 停留一段时间后沉入地下消失 =====
// 各类植被沉入深度 (盖过自身高度): 灌木矮/竹丛高
const FLORA_SINK_DEPTH={bush:1.9,fern:1.6,hedge:3.8,dead:4.6,bamboo:8.4,palm:10.5};
// blasted=炸没 (爆风/碾压, 直接消失不出残株黑炭); charred=**烧毁** (2026-10-24 用户指定:
// 只有火烧进来的消亡才染焦黑炭色 —— 旧版把染色挂在 !blasted 上, 碾碎枯树/碾没灌木也会走黑炭材质,
// 语义混线; 且实例批因 instanceColor 未初始化而恒不生效, 两条一起修)。
function vanishFlora(rec,blasted,charred){
if(rec.dead) return;
rec.dead=true; rec.alive=false;
if(rec.box) killBox(rec.box);
if(rec.cyl){ killCyl(rec.cyl); if(typeof markNavDirty==='function') markNavDirty(); }
// 视觉残留: 停留数秒后沉入地下 (残株逐渐没入土中, 全沉后删除; 被烧毁时染焦黑色)
if(rec.kind==='bush'&&rec.im){
fireTmp();
if(charred&&rec.im.setColorAt&&rec.im.instanceColor){
  rec.im.setColorAt(rec.li0,_charCol);
  rec.im.setColorAt(rec.li0+1,_charCol);
  rec.im.instanceColor.needsUpdate=true;
}
queueSink({inst:{im:rec.im,idxs:[rec.li0,rec.li0+1]},depth:FLORA_SINK_DEPTH.bush,rest:rand(4,8),sink:2.2});
} else if(rec.meshes){
if(charred){
  fireTmp();
  if(!_charredFloraMat){
    _charredFloraMat = new THREE.MeshLambertMaterial({color:0x241d16});
  }
  for(const m of rec.meshes){
    if(m&&m.material){
      try{ m.material=_charredFloraMat; }catch(e){}
    }
  }
}
const ms=rec.meshes.filter(m=>m&&m.parent);
if(ms.length) queueSink({objs:ms,depth:FLORA_SINK_DEPTH[rec.kind]||3.2,rest:rand(4,8),sink:2.4});
}
const gy=heightAt(rec.x,rec.z);
for(let k=0;k<(blasted?6:4);k++){
spawnP(blasted?PT.dirt:PT.smoke,rec.x+rand(-0.5,0.5),gy+rand(0.2,0.9),rec.z+rand(-0.5,0.5),rand(-1.2,1.2),rand(0.6,1.8),rand(-1.2,1.2),rand(0.3,0.6),0.8,rand(0.4,0.8),0.8,blasted?4:0.5);
}
if(blasted) for(let k=0;k<3;k++) spawnP(PT.spark,rec.x,gy+0.5,rec.z,rand(-3,3),rand(1,4),rand(-3,3),0.12,-0.05,rand(0.2,0.4),1,6,true);
}
// ===== 树篱破碎 (2026-11-16 批3): 旧版树篱被碾/被炸/烧尽都只是"直接消失" (vanishFlora 尘土+沉入),
// 用户要求与墙体同款物理碎块化。树篱专用档: 抛叶质碎块 (spawnDebris 96 块池; 与实心砖墙的砌块区分 ——
// 树篱块更小更碎、带叶簇贴图), 烧毁档抛焦黑碎块。调用点: crushCoverBox (坦克碾/爆炸扫掠共汇, 05-world)
// 与烧尽二段 (updateFires 的 HEDGE_CRUMBLE 定时账)。无 CANNON 的沙箱 spawnDebris 自动跳过, 尘照扬。
const HEDGE_CRUMBLE=[]; // {rec,t}: 烧毁后先焦黑停留, t 到点再物理碎块化 (dt 账, 时停里随战场冻结)
function hedgeChar(rec){
// 一段 (烧尽): 碰撞即死 + 材质换焦黑 (与 vanishFlora charred 档同款 _charredFloraMat), 视觉停留等碎块化
// ★2026-11-17 修 (用户实报"没有变黑后破碎"): 碰撞击杀必须走 killOne 而不是 killBox —— 树篱盒的 box.mesh
// 正指着树篱视觉网格, killBox 会连视觉一起 world.remove ⇒ 焦黑材质还没显形树篱就整个消失, 且 2.5~5s 后的
// hedgeShatter 二段因 mesh.parent 已空永远不触发 (HEDGE_CRUMBLE 账空转)。killOne 只杀碰撞+占格, 视觉留场。
if(!rec||rec.dead) return;
rec.dead=true; rec.alive=false;
if(rec.box&&typeof killOne==='function') killOne(rec.box);
fireTmp();
if(!_charredFloraMat) _charredFloraMat=new THREE.MeshLambertMaterial({color:0x241d16});
if(rec.meshes) for(const m of rec.meshes){ if(m&&m.material){ try{ m.material=_charredFloraMat; }catch(e){} } }
}
function hedgeShatter(rec,charred,alreadyDead){
// 二段: 碰撞+视觉一并摘除, 抛树篱质碎块 (绿叶/焦黑), 尘/烟与 vanishFlora blasted 档同源;
// alreadyDead=true = 烧尽二段路径 (hedgeChar 已摘碰撞换焦黑), 这里只补视觉摘除+碎块
if(!rec) return;
if(!alreadyDead){
if(rec.dead) return;
rec.dead=true; rec.alive=false;
if(rec.box) killBox(rec.box);
}
const gy=heightAt(rec.x,rec.z);
if(rec.meshes) for(const m of rec.meshes){ if(m&&m.parent) world.remove(m); }
if(typeof spawnDebris==='function'&&window.CANNON){
const mat=charred?(_charredFloraMat||(typeof hedgeMat!=='undefined'?hedgeMat:null)):(typeof hedgeMat!=='undefined'?hedgeMat:null);
if(mat){
// ★2026-11-17 修 (用户实报"多块只有其中一块散碎片"): 碎块沿树篱段长轴散布 —— 旧版 6~7 块全堆在段心
// 1.6m 半径内, 而一段树篱 4.4m 长 ⇒ 观感是"只有中间一团碎了, 两头凭空消失"。轴向/半长由建模器写进
// rec (05b hedgerow: ax/az=局部轴世界向, hl≈2.2), 旧记录缺字段时回落段心散布 (行为不劣化)。
const _ax=(typeof rec.ax==='number')?rec.ax:1, _az=(typeof rec.az==='number')?rec.az:0;
const _hl=(typeof rec.hl==='number')?rec.hl:1.1;
const nD=charred?8:9;
for(let k=0;k<nD;k++){
const u=nD>1?((k/(nD-1))*2-1):0;   // -1..1 沿段轴均匀铺开, 两端 0.9×hl 内收半拍防越界
const px=rec.x+_ax*u*_hl*0.9-_az*rand(-0.55,0.55);
const pz=rec.z+_az*u*_hl*0.9+_ax*rand(-0.55,0.55);
spawnDebris(mat,px,gy+rand(0.5,1.6),pz,rand(0,TAU),
rand(0.34,0.72),rand(0.26,0.52),rand(0.3,0.6),px,pz);
}
}
}
// 尘烟沿段轴多点起爆 (同上: 单点尘=中段炸两头无感的另一半病根)
{
const _ax=(typeof rec.ax==='number')?rec.ax:1, _az=(typeof rec.az==='number')?rec.az:0;
const _hl=(typeof rec.hl==='number')?rec.hl:1.1;
for(let k=0;k<(charred?4:6);k++){
const u=rand(-1,1);
spawnP(charred?PT.smoke:PT.dirt,rec.x+_ax*u*_hl*0.8-_az*rand(-0.6,0.6),gy+rand(0.2,1.2),rec.z+_az*u*_hl*0.8+_ax*rand(-0.6,0.6),rand(-1.6,1.6),rand(0.6,2),rand(-1.6,1.6),rand(0.3,0.6),0.9,rand(0.4,0.8),0.85,charred?0.5:4);
}
}
if(charred) for(let k=0;k<3;k++) spawnP(PT.spark,rec.x,gy+0.6,rec.z,rand(-2,2),rand(1,3),rand(-2,2),0.1,-0.05,rand(0.2,0.4),1,5,true);
if(typeof markNavDirty==='function') markNavDirty();
}
// ===== 树木倒伏 =====
const FALLING=[];      // 倒伏动画中的树
const BURNING_TREES=[]; // 树冠着火的树
function treeFall(tr,dx,dz){
if(tr.fall||!tr.alive) return;
tr.alive=false;
killCyl(tr.cyl);
const l=Math.hypot(dx,dz);
if(l<0.05){ const a=rand(0,TAU); dx=Math.sin(a); dz=Math.cos(a); }
else { dx/=l; dz/=l; }
tr.fall={t:0,dx,dz,dur:rand(0.9,1.2)*(0.7+0.35*tr.s),hit:false}; // 大树惯性大, 倒得略慢
FALLING.push(tr);
const gy=tr.g0+0.25;
for(let k=0;k<5;k++) spawnP(PT.dirt,tr.x+rand(-0.6,0.6),gy,tr.z+rand(-0.6,0.6),dx*rand(1,2.5)+rand(-1,1),rand(0.5,1.5),dz*rand(1,2.5)+rand(-1,1),rand(0.25,0.5),0.7,rand(0.5,0.9),0.85,3);
// 不触发寻路重建: 倒树不挡路, 残干占位留到下次重建自然放行 (碾林/连倒时避免高频 rebake)
}
// ===== 枯树/椰树倒伏 (2026-09-26 用户报: 这两类被炸只会原地消失, 没有乔木那样的"向爆心反方向倒下") =====
// 这两类是**对象式**植被 (每株是独立网格: 枯树 2 件 / 椰树 1 个 Group), 不在 TREE_IM 实例批里,
// 故姿态写各网格自身的 position/quaternion (treeInstanceMatrices 写的是实例矩阵), 倒伏曲线/触地扬尘/
// 残骸停留后沉入**全部复用乔木那一套** (同一个 FALLING 列表 + queueSink), 不另立第二套动画。
// 与乔木的唯一差异是"株高"与"姿态写在哪": 对象式植被没有 scale 字段 (株高取自 cyl 段长), 姿态写
// 各网格自身的 position/quaternion 而不是 TREE_IM 的实例矩阵; 倒向/时长/回弹/扬尘/沉入/碰撞体处理
// 都与乔木同规 (killCyl 即杀且不触发寻路重建 —— 见 treeFall 的注释)。
function floraTopple(rec,dx,dz){
if(!rec||rec.fall||rec.dead||rec.alive===false) return;
const base=[];
if(rec.meshes) for(const m of rec.meshes){
if(!m||!m.position||!m.parent) continue;      // 已沉入/已摘出场景的网格不再参与
const q=m.quaternion;
base.push({m,px:m.position.x,py:m.position.y,pz:m.position.z,qx:q?q.x:0,qy:q?q.y:0,qz:q?q.z:0,qw:q?q.w:1});
}
if(!base.length){ vanishFlora(rec,true); return; }  // 无可见网格 (缩水桩/异常记录): 退回旧的"炸没"路径
const l=Math.hypot(dx,dz);
if(l<0.05){ const a=rand(0,TAU); dx=Math.sin(a); dz=Math.cos(a); }
else { dx/=l; dz/=l; }
const h=rec.cyl?Math.max(1,rec.cyl.y1-rec.cyl.y0):(rec.kind==='palm'?8:3.4); // 株高: 倒伏时长与扬尘半径都按它
const s=clamp(h/4,0.5,2.0);                    // 等效"乔木 scale" (乔木树干 4s 高, 见 05b tree())
rec.alive=false;
if(rec.cyl) killCyl(rec.cyl);
rec.fall={t:0,dx,dz,dur:rand(0.9,1.2)*(0.7+0.35*s),hit:false,obj:true,s,base};
FALLING.push(rec);
const gy=rec.g0+0.25;
for(let k=0;k<5;k++) spawnP(PT.dirt,rec.x+rand(-0.6,0.6),gy,rec.z+rand(-0.6,0.6),dx*rand(1,2.5)+rand(-1,1),rand(0.5,1.5),dz*rand(1,2.5)+rand(-1,1),rand(0.25,0.5),0.7,rand(0.5,0.9),0.85,3);
}
function treeIgnite(tr,attacker){
if(tr.burnT>=0||(!tr.alive&&!tr.fall)) return;
if(tr.burnT<0){
tr.burnT=0;
// 烧毁时间总体增加 (基准 6.0~8.5s), 受天气受潮系数缩放
const bRate=wxBurnRate();
tr.burnDur=rand(6.0,8.5)/Math.max(0.2,bRate);
tr.igniter=attacker||null;
tr.fT=0; tr.iT=0;
BURNING_TREES.push(tr);
}
}
// ═══ 2026-11-13 性能批 D: 树批实例矩阵局部上传 (GPU 侧) ═══
// 倒伏/沉入每帧写实例矩阵后整批 needsUpdate ⇒ 全量重传 (TREE_IM 数千实例 × 64B × 每树每帧, 多树并发
// 燃烧期 = 每帧 K 次全量)。改按"本帧脏段"标脏: BufferAttribute.updateRange {offset,count} (r152 语义;
// vendor lib/three.min.js 实证: 部分上传后 count 自动复位 -1 ⇒ 23b 世界还原/05b 建图的全量写回不残留
// 旧区间, 正确性安全)。同帧多树写合并成外接区间 (区间外实例的数组数据本就正确, 顺带多传无害, 正确性优先),
// 下一帧首写自动重置。帧戳 _imFr 在 updateFires 顶部自增 (24-main 每帧恰调一次, 树写全部发生在本帧其后;
// dev/verify-fire 的直调顺序 updateBurningTrees→updateFires 同样成立: 窗口=相邻两次 updateFires 之间)。
let _imFr=0;
function fireImDirty(a,i0,n){
if(typeof window!=='undefined'&&window.IM_FULL_UPLOAD){ a.needsUpdate=true; if(a.updateRange) a.updateRange.count=-1; return; }   // 回退旗 (D): 整批全量上传旧口径 (typeof 守卫同上)
a.needsUpdate=true;
if(a._upFr!==_imFr){ a._upFr=_imFr; a._upMin=i0; a._upMax=i0+n-1; }
else{ if(i0<a._upMin)a._upMin=i0; if(i0+n-1>a._upMax)a._upMax=i0+n-1; }
if(!a.updateRange) a.updateRange={offset:0,count:-1};
a.updateRange.offset=a._upMin*16;
a.updateRange.count=(a._upMax-a._upMin+1)*16;
}
function treeInstanceMatrices(tr,th,dy=0){
fireTmp();
// 绕根部水平轴旋转: 轴=(dz,0,-dx) —— 树冠倒向 (dx,dz); dy=整体垂直偏移 (残骸沉入地下用)
// 2026-09-12 修复: 锚点位置与实例姿态必须同转 —— 旧版只旋转锚点、姿态恒竖直,
// 倒伏全程树干/叶面保持直立沿弧线"滑行", 观感诡异; 现按同一轴角写出旋转四元数
// (trunk 直接套用, 叶面 premultiply 叠加在原朝向之上), 呈现真实翻倒。
const ax=_fa.set(tr.fall.dz,0,-tr.fall.dx);
_fq.setFromAxisAngle(ax,th);
const cs=Math.cos(th), sn=Math.sin(th);
const px=tr.x, py=tr.g0, pz=tr.z;
const rot=(ox,oy,oz,out)=>{
out.set(
px+ox*cs+(ax.y*oz-ax.z*oy)*sn+ax.x*(ax.x*ox+ax.y*oy+ax.z*oz)*(1-cs),
py+oy*cs+(ax.z*ox-ax.x*oz)*sn+ax.y*(ax.x*ox+ax.y*oy+ax.z*oz)*(1-cs),
pz+oz*cs+(ax.x*oy-ax.y*ox)*sn+ax.z*(ax.x*ox+ax.y*oy+ax.z*oz)*(1-cs)
);
return out;
};
const im=TREE_IM.trunks;
rot(0,2.2*tr.s,0,_fp); _fp.y+=dy;
_fm.compose(_fp,_fq,_fs.setScalar(tr.s));
im.setMatrixAt(tr.ti,_fm);
const lm=TREE_IM.leaves;
if(!tr.charred) for(let i=0;i<3;i++){
rot(0,(3.4+i*0.6)*tr.s,0,_fp); _fp.y+=dy;
_fe.set(tr.lf[i][1],tr.lf[i][0],0);
_fq2.setFromEuler(_fe);
_fq2.premultiply(_fq);
_fm.compose(_fp,_fq2,_fs.setScalar(tr.lf[i][2]));
lm.setMatrixAt(tr.li+i,_fm);
}
fireImDirty(im.instanceMatrix,tr.ti,1);
if(!tr.charred) fireImDirty(lm.instanceMatrix,tr.li,3);
// 燃烧树冠世界坐标 (火焰跟随)
rot(0,3.6*tr.s,0,_fc); _fc.y+=dy;
tr.cx=_fc.x; tr.cy=_fc.y; tr.cz=_fc.z;
}
// 垂柳倒伏姿态 (2026-11-10 柳树批): 与 treeInstanceMatrices 同一套 Rodrigues 旋转 (绕根部水平轴
// 轴=(dz,0,-dx)), 只是柳树在 05b 的 WLOW_IM 三张实例批 (干1/枝3/叶冠19) 里, 部件表 (wt/wb/wl:
// 相对株根的偏移+基础四元数+缩放) 由 05b 建模期算好挂在记录上 —— 这里只做"整体绕根翻转"一件事:
// 偏移按 Rodrigues 手算旋转, 姿态 = 倒伏四元数 R⊗q0 (Hamilton 积手算, ax.y=0 展开 —— 沙箱桩
// Quaternion 无 set/multiply, 与 floraObjMatrices 同款纪律)。焦黑后叶冠不再重写 (实例已被零缩放
// 隐藏, 烧尽沉入期只写干/枝让残骸下沉 —— 与乔木 charred 只跳叶面同义)。
let _wlQ=null; // 真实例懒建 (fireTmp): vendor compose 读 ._x 私有字段, 普通对象四元数=旋转全 NaN=实机整批隐形 (2026-11-11 实机回归病根); 顶层 new THREE 会炸无 THREE 装载器 (verify-firecap 同日实录) → 库纪律=let null+fireTmp 懒建, 分量赋值走 setter 落 _x
function willowInstanceMatrices(tr,th,dy=0){
fireTmp();
const f=tr.fall;
const axx=f.dz, axz=-f.dx;                    // 轴 = (dz,0,-dx), ax.y 恒为 0
const cs=Math.cos(th), sn=Math.sin(th);
const hw=Math.sin(th*0.5), cw=Math.cos(th*0.5); // 半角 → R=(axx·hw, 0, axz·hw, cw)
const rqx=axx*hw, rqz=axz*hw;
const px=tr.x, py=tr.g0, pz=tr.z;
const imT=WLOW_IM.trunks, imB=WLOW_IM.branches, imL=WLOW_IM.leaves;
const put=(im,ii,p)=>{
const ox=p.ox, oy=p.oy, oz=p.oz;
const k=(axx*ox+axz*oz)*(1-cs);
_fp.set(
px+ox*cs-axz*oy*sn+axx*k,
py+oy*cs+(axz*ox-axx*oz)*sn+dy,
pz+oz*cs+axx*oy*sn+axz*k);
// R ⊗ q0 (Hamilton 积; R.y=0 的展开) —— 与 floraObjMatrices 同式
const q=p.q;
_wlQ.x=cw*q[0]+rqx*q[3]-rqz*q[1];
_wlQ.y=cw*q[1]-rqx*q[2]+rqz*q[0];
_wlQ.z=cw*q[2]+rqx*q[1]+rqz*q[3];
_wlQ.w=cw*q[3]-rqx*q[0]-rqz*q[2];
_fs.set(p.sx,p.sy,p.sz);
_fm.compose(_fp,_wlQ,_fs);
im.setMatrixAt(ii,_fm);
};
put(imT,tr.wi,tr.wt);
for(let k=0;k<3;k++) put(imB,tr.wi*3+k,tr.wb[k]);
if(!tr.charred) for(let k=0;k<19;k++) put(imL,tr.wi*19+k,tr.wl[k]);
fireImDirty(imT.instanceMatrix,tr.wi,1);
fireImDirty(imB.instanceMatrix,tr.wi*3,3);
if(!tr.charred) fireImDirty(imL.instanceMatrix,tr.wi*19,19);
// 燃烧树冠世界坐标 (火焰跟随): 冠带中点 (0,3.5,0) 绕根旋转 —— 与 treeInstanceMatrices 尾段同义
const kc=axz*3.5*(1-cs);
_fc.set(px-axz*3.5*sn+axx*kc, py+3.5*cs+dy, pz+axx*3.5*sn+axz*kc);
tr.cx=_fc.x; tr.cy=_fc.y; tr.cz=_fc.z;
}

// 竹丛倒伏姿态 (2026-11-15 竹子批): 与 willowInstanceMatrices 同一套 Rodrigues 整体绕根翻转 (轴=(dz,0,-dx)),
// 只是竹丛在 05b 的 BAMBOO_IM 单张杆实例批里, 部件表 (bst: 偏移+基础四元数+缩放, bn=杆数) 按
// 丛连续段 [bi, bi+bn) 改写。竹无叶冠 ⇒ 无"焦黑叶冠零缩放"支路 —— 烧尽=杆实例全染炭色, 倒伏残骸
// (整丛黑杆) 在沉入期照常写矩阵下沉 (与柳干/枝同义, 与乔叶不同)。
function bambooInstanceMatrices(tr,th,dy=0){
fireTmp();
const f=tr.fall;
const axx=f.dz, axz=-f.dx;                    // 轴 = (dz,0,-dx), ax.y 恒为 0
const cs=Math.cos(th), sn=Math.sin(th);
const hw=Math.sin(th*0.5), cw=Math.cos(th*0.5); // 半角 → R=(axx·hw, 0, axz·hw, cw)
const rqx=axx*hw, rqz=axz*hw;
const px=tr.x, py=tr.g0, pz=tr.z;
const im=BAMBOO_IM.stalks;
for(let k=0;k<tr.bn;k++){
const p=tr.bst[k];
const ox=p.ox, oy=p.oy, oz=p.oz;
const kk=(axx*ox+axz*oz)*(1-cs);
_fp.set(
px+ox*cs-axz*oy*sn+axx*kk,
py+oy*cs+(axz*ox-axx*oz)*sn+dy,
pz+oz*cs+axx*oy*sn+axz*kk);
// R ⊗ q0 (Hamilton 积; R.y=0 的展开) —— 与 willowInstanceMatrices 同式 (沙箱桩 Quaternion 无 set/multiply)
const q=p.q;
_wlQ.x=cw*q[0]+rqx*q[3]-rqz*q[1];
_wlQ.y=cw*q[1]-rqx*q[2]+rqz*q[0];
_wlQ.z=cw*q[2]+rqx*q[1]+rqz*q[3];
_wlQ.w=cw*q[3]-rqx*q[0]-rqz*q[2];
_fs.set(p.sx,p.sy,p.sz);
_fm.compose(_fp,_wlQ,_fs);
im.setMatrixAt(tr.bi+k,_fm);
}
fireImDirty(im.instanceMatrix,tr.bi,tr.bn);
// 燃烧竹丛世界坐标 (火焰跟随): 冠带中点 (0,3.2,0) 绕根旋转 —— 与 willowInstanceMatrices 尾段同义
const kc=axz*3.2*(1-cs);
_fc.set(px-axz*3.2*sn+axx*kc, py+3.2*cs+dy, pz+axx*3.2*sn+axz*kc);
tr.cx=_fc.x; tr.cy=_fc.y; tr.cz=_fc.z;
}

// 对象式植被 (枯树/椰树) 的倒伏姿态: 与 treeInstanceMatrices 同一套 Rodrigues 旋转公式与同一角度曲线,
// 只是把结果写给各网格的 position/quaternion。四元数按分量手算 (R ⊗ q0) —— 沙箱 THREE 桩没有
// clone/copy/set, 而这条路径要在 dev/verify-fire 的桩里跑, 所以不依赖任何实例方法。
// 旋转轴沿"水平且垂直于倒向"的单位向量 (dz,0,-dx), 锚点 = 株根 (rec.x, rec.g0, rec.z)。
function floraObjMatrices(rec,th,dy=0){
const f=rec.fall, base=f.base;
const axx=f.dz, axz=-f.dx;                    // 轴 = (dz,0,-dx), ax.y 恒为 0
const cs=Math.cos(th), sn=Math.sin(th);
const hw=Math.sin(th*0.5), cw=Math.cos(th*0.5); // 半角 → 单位四元数 R=(axx·hw, 0, axz·hw, cw)
const rx=axx*hw, rz=axz*hw;
const px=rec.x, py=rec.g0, pz=rec.z;
for(const b of base){
const m=b.m; if(!m||!m.position) continue;
const ox=b.px-px, oy=b.py-py, oz=b.pz-pz;
const k=(axx*ox+axz*oz)*(1-cs);
m.position.set(
px+ox*cs-axz*oy*sn+axx*k,
py+oy*cs+(axz*ox-axx*oz)*sn+dy,
pz+oz*cs+axx*oy*sn+axz*k);
if(!m.quaternion) continue;
// R ⊗ q0 (Hamilton 积; R.y=0 的展开)
const qw=cw*b.qw-rx*b.qx-rz*b.qz;
const qx=cw*b.qx+rx*b.qw-rz*b.qy;
const qy=cw*b.qy-rx*b.qz+rz*b.qx;
const qz=cw*b.qz+rx*b.qy+rz*b.qw;
m.quaternion.x=qx; m.quaternion.y=qy; m.quaternion.z=qz; m.quaternion.w=qw;
// 真 three: 直接写分量不会同步 rotation (渲染走 quaternion, 但世界还原/其他读者可能读 rotation)
if(m.rotation&&m.rotation.setFromQuaternion) m.rotation.setFromQuaternion(m.quaternion);
}
}
// 触地瞬间: 树冠沿线扬尘 + 近距离镜头轻震 (倒伏的"重量感")
function treeFallImpact(tr){
const f=tr.fall, gy=tr.g0+0.25, reach=3.4*(tr.s||f.s||1);
for(let k=0;k<6;k++){
const rr=reach*rand(0.55,1.05);
spawnP(PT.dirt,tr.x+f.dx*rr+rand(-0.8,0.8),gy+rand(0.1,0.5),tr.z+f.dz*rr+rand(-0.8,0.8),f.dx*rand(0.5,1.4)+rand(-0.8,0.8),rand(0.4,1.1),f.dz*rand(0.5,1.4)+rand(-0.8,0.8),rand(0.3,0.6),0.8,rand(0.5,0.9),0.85,3);
}
spawnP(PT.smoke,tr.x+f.dx*reach*0.7,gy+0.5,tr.z+f.dz*reach*0.7,f.dx*0.4,0.7,f.dz*0.4,1.2,1.6,rand(0.9,1.4),0.5,0.1);
if(Math.hypot(tr.x-camera.position.x,tr.z-camera.position.z)<25&&typeof addTrauma==='function') addTrauma(0.08);
}
function updateFallingTrees(dt){
for(let i=FALLING.length-1;i>=0;i--){
const tr=FALLING[i];
const f=tr.fall;
f.t+=dt;
let th;
if(f.t<f.dur){
const k=f.t/f.dur;
// 角加速 (重力矩随倾角增大越倒越快) 但掺 25% 线性项: 纯 k² 起步前 ~0.4s 倾角近乎为零,
// 观感像"碾压后隔了很久才倒"; 现接触后 0.2s 内即可见树头倾斜
th=1.5*k*(0.75*k+0.25);
}else{
if(!f.hit){ f.hit=true; treeFallImpact(tr); }
// 触地回弹: 树冠砸地后树干小幅回弹震荡并快速衰减 (只向直立侧回弹, 避免砸进地里)
const u=f.t-f.dur;
th=clamp(1.5-0.09*Math.exp(-3.5*u)*Math.sin(10.5*u),1.32,1.5);
}
if(f.obj) floraObjMatrices(tr,th);
else if(tr.kind==='willow') willowInstanceMatrices(tr,th);   // 柳=实例批 (WLOW_IM), 与乔木同曲线不同批
else if(tr.kind==='bamboo') bambooInstanceMatrices(tr,th);   // 竹=实例批 (BAMBOO_IM), 与柳同款单张杆批 (2026-11-15)
else treeInstanceMatrices(tr,th);
if(f.t>=f.dur+0.7){
tr.restCrown={x:tr.cx||tr.x,y:tr.cy||tr.g0+3.4*(tr.s||f.s||1),z:tr.cz||tr.z};
FALLING.splice(i,1);
// 倒树残骸登记沉入: 原地停留一段时间后连干带冠沉入地下 (见 updateTreeSinks / scheduleFloraObjSink)
if(f.obj) scheduleFloraObjSink(tr); else scheduleTreeSink(tr);
}
}
}
// ===== 倒树残骸沉入: 停留 16~22s 后 3.6s 匀速沉入地下, 全沉后实例零缩放删除 =====
const TREE_SINKS=[];
function scheduleTreeSink(tr){
if(tr.sinkQ) return;
tr.sinkQ=true;
TREE_SINKS.push({tr,t:0,rest:rand(16,22),dur:3.6});
}
// 对象式植被 (枯树/椰树) 残骸沉入: 与乔木同一处停留/沉没口令 (16~22s 后 3.6s 沉入), 但下沉动画
// 走 08-effects 的 queueSink (对象网格逐个下移, 全沉时移除网格并标死) —— 不写实例矩阵。
function scheduleFloraObjSink(rec){
if(rec.sinkQ) return;
rec.sinkQ=true;
const ms=rec.meshes?rec.meshes.filter(m=>m&&m.parent):null;
if(!ms||!ms.length){ rec.dead=true; return; }
queueSink({objs:ms,depth:FLORA_SINK_DEPTH[rec.kind]||3.6,rest:rand(16,22),sink:3.6,
onDone(){ rec.dead=true; }});
}
function updateTreeSinks(dt){
for(let i=TREE_SINKS.length-1;i>=0;i--){
const s=TREE_SINKS[i];
s.t+=dt;
if(s.t<s.rest) continue;
const k=Math.min(1,(s.t-s.rest)/s.dur);
if(s.tr.kind==='willow') willowInstanceMatrices(s.tr,1.5,-3.6*k);   // 柳: 三张实例批同沉 (焦黑叶冠已零缩放, 只写干/枝)
else if(s.tr.kind==='bamboo') bambooInstanceMatrices(s.tr,1.5,-3.6*k); // 竹: 杆实例批同沉 (2026-11-15)
else treeInstanceMatrices(s.tr,1.5,-3.6*k);
if(k>=1){
// 全沉: 树干/叶面实例零缩放删除, 记录标死 (floraNear 不再返回该树)
fireTmp();
_fm.makeScale(0,0,0);
if(s.tr.kind==='willow'){
WLOW_IM.trunks.setMatrixAt(s.tr.wi,_fm);
for(let k2=0;k2<3;k2++) WLOW_IM.branches.setMatrixAt(s.tr.wi*3+k2,_fm);
for(let k2=0;k2<19;k2++) WLOW_IM.leaves.setMatrixAt(s.tr.wi*19+k2,_fm);
fireImDirty(WLOW_IM.trunks.instanceMatrix,s.tr.wi,1);
fireImDirty(WLOW_IM.branches.instanceMatrix,s.tr.wi*3,3);
fireImDirty(WLOW_IM.leaves.instanceMatrix,s.tr.wi*19,19);
s.tr.dead=true;
TREE_SINKS.splice(i,1);
continue;
}
if(s.tr.kind==='bamboo'){
for(let k2=0;k2<s.tr.bn;k2++) BAMBOO_IM.stalks.setMatrixAt(s.tr.bi+k2,_fm);
fireImDirty(BAMBOO_IM.stalks.instanceMatrix,s.tr.bi,s.tr.bn);
s.tr.dead=true;
TREE_SINKS.splice(i,1);
continue;
}
TREE_IM.trunks.setMatrixAt(s.tr.ti,_fm);
const lm=TREE_IM.leaves;
for(let k2=0;k2<3;k2++) lm.setMatrixAt(s.tr.li+k2,_fm);
fireImDirty(TREE_IM.trunks.instanceMatrix,s.tr.ti,1);
fireImDirty(lm.instanceMatrix,s.tr.li,3);
s.tr.dead=true;
TREE_SINKS.splice(i,1);
}
}
}
function updateBurningTrees(dt){
fireTmp();
const sExt=wxStormExt();
for(let i=BURNING_TREES.length-1;i>=0;i--){
const tr=BURNING_TREES[i];
// 暴雨博弈 (情况 A): 暴雨有概率在树木倒伏前将树冠火浇灭 (树木幸存)
if(sExt>0&&!tr.fall&&Math.random()<dt*sExt*0.8){
  tr.burnT=-1;
  BURNING_TREES.splice(i,1);
  const cr=tr.restCrown||{x:tr.x,y:tr.g0+3.6*tr.s,z:tr.z};
  spawnP(PT.smoke,cr.x,cr.y+0.5,cr.z,0,1.2,0,1.2,1.8,rand(1.2,2.0),0.5,0.06);
  continue;
}
tr.burnT+=dt;
const crown=(tr.restCrown||(tr.fall?{x:tr.cx||tr.x,y:tr.cy||tr.g0+2,z:tr.cz||tr.z}:{x:tr.x,y:tr.g0+3.6*tr.s,z:tr.z}));
tr.fT-=dt;
if(tr.fT<=0){
tr.fT=rand(0.1,0.2);
if(crown.y!==undefined&&Math.hypot(crown.x-camera.position.x,crown.z-camera.position.z)<110&&fireFxOK()){
// 树冠火同样加大火头 (与地面植被火焰观感一致)
spawnP(PT.flash,crown.x+rand(-0.8,0.8)*tr.s,crown.y+rand(-0.4,0.6),crown.z+rand(-0.8,0.8)*tr.s,rand(-0.4,0.4),rand(1.2,2.4),rand(-0.4,0.4),rand(1.0,1.7),1.7,rand(0.3,0.55),0.85,-1,true);
if(Math.random()<0.4&&fireFxOK()) spawnP(PT.dark,crown.x,crown.y+1,crown.z,rand(-0.4,0.4),rand(1,2),rand(-0.4,0.4),1.0,1.7,rand(1.2,2),0.5,0.1);
}
}
tr.iT-=dt;
if(tr.iT<=0){
tr.iT=0.5;
igniteArea(tr.x,tr.z,2.2,tr.igniter);
}
if(!tr.fall&&tr.burnT>tr.burnDur){
const a=rand(0,TAU);
treeFall(tr,Math.sin(a),Math.cos(a));
}
	if(tr.fall&&!FALLING.includes(tr)&&tr.burnT>tr.burnDur+2.6){
	// 烧尽: 树冠消失, 树干焦黑留在原地 (残骸随后与倒树一同沉入地下)
	if(tr.kind==='willow'){
	// 柳 (2026-11-10 批): 叶冠 19 实例零缩放隐藏 + 干/枝实例染焦黑 —— 实例批在 WLOW_IM, 与乔木平行
	_fm.makeScale(0,0,0);
	const lm2=WLOW_IM.leaves;
	for(let k2=0;k2<19;k2++) lm2.setMatrixAt(tr.wi*19+k2,_fm);
	fireImDirty(lm2.instanceMatrix,tr.wi*19,19);
	WLOW_IM.trunks.setColorAt(tr.wi,_charCol);
	WLOW_IM.branches.setColorAt(tr.wi*3,_charCol);
	WLOW_IM.branches.setColorAt(tr.wi*3+1,_charCol);
	WLOW_IM.branches.setColorAt(tr.wi*3+2,_charCol);
	WLOW_IM.trunks.instanceColor.needsUpdate=true;
	WLOW_IM.branches.instanceColor.needsUpdate=true;
	}else if(tr.kind==='bamboo'){
	// 竹 (2026-11-15 批): 杆实例全部染焦黑 —— 竹无叶冠可隐, 倒伏残骸=整丛黑杆, 沉入期照常 (bambooInstanceMatrices)
	const bim=BAMBOO_IM.stalks;
	for(let k2=0;k2<tr.bn;k2++) bim.setColorAt(tr.bi+k2,_charCol);
	bim.instanceColor.needsUpdate=true;
	}else{
	const lm=TREE_IM.leaves;
	for(let k2=0;k2<3;k2++){ _fm.makeScale(0,0,0); lm.setMatrixAt(tr.li+k2,_fm); }
	fireImDirty(lm.instanceMatrix,tr.li,3);
	TREE_IM.trunks.setColorAt(tr.ti,_charCol);
	TREE_IM.trunks.instanceColor.needsUpdate=true;
	}
	tr.charred=true;
	spawnP(PT.smoke,tr.x,tr.g0+0.5,tr.z,0,1,0,1.4,2,rand(1.5,2.5),0.6,0.1);
	BURNING_TREES.splice(i,1);
	scheduleTreeSink(tr);
	}
}
}
// ===== 爆炸对植被: 近处树/竹直接吹倒 (倒向背离爆心), 中距累积伤害, 灌木类直接炸没 =====
// 2026-09-26: 枯树/椰树并入"倒伏"口径 —— 旧版这两类与灌木同列 (d<radius*0.85 直接 vanishFlora),
// 即"被炸到就原地消失", 没有乔木那种立即向**背离爆心**方向翻倒的观感 (用户实机报)。
// 现在三类同规: 近距 (0.75R+0.9) 即刻倒伏; 中距 (R+2.6) 累积伤害, 第二次爆炸才倒。
function explosionFlora(p,radius){
if(radius<=0) return;
const hits=[];
floraNear(p.x,p.z,radius+3,rec=>hits.push(rec));
for(const rec of hits){
const d=Math.hypot(rec.x-p.x,rec.z-p.z);
if(rec.kind==='tree'||rec.kind==='dead'||rec.kind==='palm'||rec.kind==='willow'||rec.kind==='bamboo'){
if(!rec.alive) continue;                         // 已倒伏/已炸没: 不再响应 (倒树残骸由沉入系统收尾)
const obj=rec.kind!=='tree'&&rec.kind!=='willow'&&rec.kind!=='bamboo'; // 柳/竹与乔木同为实例批 (04b willow/bambooInstanceMatrices), 不走对象网格 floraTopple
if(d<radius*0.75+0.9){
const dx=rec.x-p.x+rand(-0.5,0.5), dz=rec.z-p.z+rand(-0.5,0.5);
if(obj) floraTopple(rec,dx,dz); else treeFall(rec,dx,dz);
}else if(d<radius+2.6){
rec.dmg=(rec.dmg||0)+1;
if(rec.dmg>=2){
const a=rand(0,TAU);
if(obj) floraTopple(rec,Math.sin(a),Math.cos(a)); else treeFall(rec,Math.sin(a),Math.cos(a));
}
}
}else if(d<radius*0.85){
// ★2026-11-17 修 (用户实报"多段树篱只有一段出碎片"): 爆炸扫到的树篱段此前走 vanishFlora 直接消失 ——
// 只有一段被 05-world 的箱扫掠 (crushCoverBox→hedgeShatter) 够到才出碎块, 其余段无声蒸发。现在全部
// 段统一叶质碎块化 (dead 守卫防与箱扫掠双杀: hedgeShatter 内 rec.dead 早退)。
if(rec.kind==='hedge'&&typeof hedgeShatter==='function') hedgeShatter(rec,false,false);
else vanishFlora(rec,true);
}
}
}
// ===== 坦克碾压: 车体碰到树/竹/枯树 → 撞倒/碾碎; 灌木直接碾没 =====
// 距离度量与 15-vehicles 的三圆碰撞模型对齐 (舱段 ±1.95 + 圆半径 1.55):
// 取"树干中心到车体轴向舱段的垂距"。旧版按坦克中心到树心的距离判定 (阈值~2.2m),
// 而树干圆柱在车头圆处 (中心距 ~3.5-3.8m) 就把坦克拦停减速 —— 正面冲撞永远够不到
// 碾压半径, 只有侧身擦过 (圆柱推挤沿径向、不减速前进) 才偶发触发, 行为不一致。
// 现改为车体接触即撞倒: 阈值略大于圆柱拦截半径 (1.5+c.r), 同帧先碾倒再杀碰撞体,
// 正面/侧面/倒车行为一致。倒向 = 车辆运动方向 (倒车撞树则向车尾倒)。
function floraCrushTank(t){
if(Math.abs(t.vel)<0.8) return;
const sn=Math.sin(t.yaw), cs=Math.cos(t.yaw);
const hits=[];
floraNear(t.pos.x,t.pos.z,4.5,rec=>hits.push(rec));
const mv=Math.sign(t.vel)||1;
let hitAny=false;
for(const rec of hits){
const rx=rec.x-t.pos.x, rz=rec.z-t.pos.z;
const aRaw=rx*sn+rz*cs;
const aC=clamp(aRaw,-1.95,1.95);
const d=Math.hypot(rx-sn*aC,rz-cs*aC);
// 各向异性接触半径: 树在舱段端点之外 (正对车头/车尾) 用鼻端精确半径 1.55 (与三圆碰撞模型一致,
// 不提前压树); 树在车身侧旁用 1.9 (贴合履带/挡泥板视觉半宽 ~2.0, 旧版侧擦可碾的量级)
const rad=(Math.abs(aRaw)>1.95?1.55:1.9);
if(rec.kind==='tree'||rec.kind==='willow'||rec.kind==='bamboo'){   // 竹 (2026-11-15): 压倒非碾没 (树同款, 倒向车辆运动方向)
if(!rec.alive) continue;
if(d<rad+0.35*rec.s){
treeFall(rec,sn*mv+rand(-0.2,0.2),cs*mv+rand(-0.2,0.2));
hitAny=true;
spawnP(PT.dirt,rec.x,rec.g0+0.6,rec.z,rand(-1.5,1.5),rand(1,3),rand(-1.5,1.5),0.3,0.6,0.5,0.85,3);
}
}else if(rec.kind==='dead'){
// 枯树: ★2026-11-17 批5 (用户裁定): 碾压并入"倒伏"口径 —— 旧版"一碰即碎"走 vanishFlora (视觉原地
// 停留→沉入), 用户实机报"部分枯树没有其他树倒下的相应代码, 只会逐渐沉下去"。改走 floraTopple
// (倒向车辆运动方向, 与树/竹/爆炸路径同支), 倒伏残骸照常停留 16~22s 后沉入。
// 2026-09-26 的"已倒伏不再二次登记"守卫 (alive 门) 原样保留 —— 否则同一批网格会同时挂在两个沉入
// 任务上 (倒伏残骸 16~22s + 碾碎 4~8s), 两个任务各写自己的 y0 基线, 网格会跳变。
if(rec.alive===false) continue;
if(d<rad+0.3){
floraTopple(rec,sn*mv+rand(-0.2,0.2),cs*mv+rand(-0.2,0.2));
hitAny=true;
spawnP(PT.dirt,rec.x,rec.g0+0.5,rec.z,rand(-1.5,1.5),rand(1,2.5),rand(-1.5,1.5),0.3,0.6,0.5,0.85,3);
}
}else if(d<2.0){
if(rec.alive===false) continue;   // 同上: 倒伏中的椰树等不再被碾碎重登记
// ★2026-11-17 修: 车体中心 2m 内的树篱此前走 vanishFlora 直接消失 (侧擦/倒车路径绕过了箱扫掠), 统一碎块化
if(rec.kind==='hedge'&&typeof hedgeShatter==='function') hedgeShatter(rec,false,false);
else vanishFlora(rec,false);
hitAny=true;
}
}
if(hitAny){
t.vel*=0.94;
t.suspPV=(t.suspPV||0)-Math.sign(t.vel)*0.12;
if(t.playerDriven&&typeof addTrauma==='function') addTrauma(0.1);
}
}
// ===== 火焰网格主更新 =====
const FFX=new Float32Array(FN*FN); // 每格火苗喷发计时
let fireDmgT=0, fireFlameN=0;
let _barrelHeatT=0;   // 油桶受热账节流钟 (2026-11-18 油桶殉爆批, 0.4s tick 同 fireDmgT)
function updateFires(dt){
fireFlameN=0;
_fireFxN=0;          // A: 每帧火粒子预算重置
_imFr++;             // D: 实例矩阵局部上传的帧戳 (树写全部发生在本帧其后)
// 树篱烧毁二段调度 (2026-11-16 批3): 焦黑停留 2.5~5s 后物理碎块化 (dt 账 —— 时停/布势冻结里随战场冻住)。
// 旧 rec 若已被世界重建/还原摘出场景 (mesh 无 parent) 就地出账, 防跨局幽灵碎块。
for(let i=HEDGE_CRUMBLE.length-1;i>=0;i--){
const hc=HEDGE_CRUMBLE[i];
hc.t-=dt;
if(hc.t<=0){
const hm=hc.rec&&hc.rec.meshes&&hc.rec.meshes[0];
if(hm&&hm.parent) hedgeShatter(hc.rec,true,true);
HEDGE_CRUMBLE.splice(i,1);
}
}
updateCreaturesBurning(dt); // 生物附着燃烧推进 (每帧)
// ── 持续火源 ──
for(let i=FIRE_SOURCES.length-1;i>=0;i--){
const s=FIRE_SOURCES[i];
s.ttl-=dt;
// 随舰重投影 (2026-10-03): 见 addFireSource 的 follow 注 —— 火心每帧贴回锚点世界位姿
if(s.follow){
const f=s.follow;
if(!f.ship||!f.ship.alive){ s.ttl=0; }
else if(typeof capAnchorWorld==='function'){ const p=capAnchorWorld(f.ship,f.an); s.x=p.x; s.y=p.y; s.z=p.z; }
}
if(s.ttl<=0){ FIRE_SOURCES.splice(i,1); continue; }
s.acc-=dt;
if(s.acc<=0){
s.acc=rand(0.08,0.16);
const dCam=Math.hypot(s.x-camera.position.x,s.z-camera.position.z);
if(dCam<130&&fireFxOK()){
spawnP(PT.flash,s.x+rand(-0.8,0.8),s.y+rand(0,0.6),s.z+rand(-0.8,0.8),rand(-0.3,0.3),rand(1.4,2.6),rand(-0.3,0.3),rand(0.6,1.1),1.6,rand(0.25,0.45),0.9,-1,true);
if(Math.random()<0.5&&fireFxOK()) spawnP(PT.dark,s.x+rand(-0.7,0.7),s.y+0.8,s.z+rand(-0.7,0.7),rand(-0.3,0.3),rand(1,2),rand(-0.3,0.3),0.9,1.7,rand(1.2,2.2),0.55,0.1);
if(SETTINGS.quality>=1&&Math.random()<0.5&&fireFxOK()) spawnP(PT.spark,s.x,s.y+0.4,s.z,rand(-2,2),rand(2,5),rand(-2,2),0.1,-0.03,rand(0.3,0.7),1,4,true);
}
}
s.igniteT-=dt;
if(s.igniteT<=0){
s.igniteT=0.7;
igniteArea(s.x,s.z,s.r*0.85,s.attacker);
}
}
// ── 油桶受热账 (2026-11-18 油桶殉爆批): 火源圈 / 燃烧草格 / 燃烧弹云三路 0.4s 记账 → 到点殉爆
//   (05-world barrelDamage 单源, 判据见 00-config BARREL)。旧口径火烧对桶毫无反应 —— 桶站火里永远不炸。
//   无火早退 (绝大多数帧零开销); 桶混在树圆柱表里不建缓存 (06-engineering CYLS.splice 会让缓存下标漂移,
//   2026-11-17 批 RGRID 同族教训), 全 CYLS 扫描 2.5 次/s 数量级可忽略; dps 口径对齐 fireDamageTick
//   (0.4s tick × dps, 步兵灼烧同款), 圈判据也对齐 (火源 r+0.4→桶放宽到 r+0.6 / 燃烧格 2.7m / y 带 3.5)。
_barrelHeatT-=dt;
if(_barrelHeatT<=0){
_barrelHeatT=0.4;
const _smOK=(typeof SMOKES!=='undefined');
let _smIn=0;
if(_smOK) for(let k=0;k<SMOKES.length;k++){ const sm=SMOKES[k]; if(sm.incin&&sm.t<sm.dur-0.5) _smIn++; }
if((FIRE_SOURCES.length>0||FIRE_ACTIVE.length>0||_smIn>0)&&typeof barrelDamage==='function'&&typeof CYLS!=='undefined'&&typeof BARREL!=='undefined'){
for(let i=0;i<CYLS.length;i++){
const c=CYLS[i];
if(!c||!c.explosive||c.dead) continue;
let dps=0;
for(let k=0;k<FIRE_SOURCES.length;k++){ const fs=FIRE_SOURCES[k];
if(Math.hypot(c.x-fs.x,c.z-fs.z)<fs.r+0.6&&Math.abs((c.y0+c.y1)/2-fs.y)<3.5){ dps+=BARREL.fireDps; break; } }
if(!dps){
// 燃烧草格: 桶底 3×3 邻域任一燃烧格 ≤2.7m 记热 (步兵灼烧同款圈判据)
const ci0=fCellI(c.x,c.z), cxi=ci0%FN, czi=(ci0/FN)|0;
for(let dj=-1;dj<=1&&!dps;dj++)for(let di=-1;di<=1;di++){
const ni=cxi+di, nj=czi+dj;
if(ni<0||nj<0||ni>=FN||nj>=FN) continue;
const ci=nj*FN+ni;
if(FBURN[ci]<=0) continue;
const cx=(ci%FN)*FRES-FOFF+FRES/2, cz=Math.floor(ci/FN)*FRES-FOFF+FRES/2;
if(Math.hypot(c.x-cx,c.z-cz)<2.7){ dps+=BARREL.cellFireDps; break; }
}
}
if(!dps&&_smOK){
// 燃烧弹云: 云不落 FUEL 格 (裸地/水泥地也能烤桶); t<dur-0.5 与云内步兵灼烧窗同门
for(let k=0;k<SMOKES.length;k++){ const sm=SMOKES[k];
if(sm.incin&&sm.t<sm.dur-0.5&&Math.hypot(c.x-sm.x,c.z-sm.z)<sm.r+0.6){ dps+=BARREL.fireDps; break; }
}
}
if(dps>0) barrelDamage(c,dps*0.4,null);   // 火烧殉爆无主 (与 fireDamageTick 的 att=FATT/fs.attacker 不同: 桶爆的溅射本就中立)
}
}
}
// ── 燃烧格子: 耗燃料/积热蔓延/视觉 ──
const sExt=wxStormExt(), bRate=wxBurnRate();
for(let i=FIRE_ACTIVE.length-1;i>=0;i--){
const ci=FIRE_ACTIVE[i];
let age=FBURN[ci]+dt;
FBURN[ci]=age;
const cx=(ci%FN)*FRES-FOFF+FRES/2, cz=Math.floor(ci/FN)*FRES-FOFF+FRES/2;

// 暴雨博弈 (情况 A): 暴雨有概率在植被烧毁前浇灭火焰 (植被幸存)
if(sExt>0&&Math.random()<dt*sExt){
  FBURN[ci]=0; FHEAT[ci]=0; FATT[ci]=null;
  FIRE_ACTIVE[i]=FIRE_ACTIVE[FIRE_ACTIVE.length-1]; FIRE_ACTIVE.pop();
  if(Math.hypot(cx-camera.position.x,cz-camera.position.z)<90){
    const gy=heightAt(cx,cz);
    spawnP(PT.smoke,cx,gy+0.4,cz,0,1.0,0,1.0,1.6,rand(1.0,1.8),0.45,0.05);
  }
  continue;
}

// 烧毁需要时间总体增加: 基准消耗速率 0.055, 且乘以天气受潮乘子 burnRateMul
FUEL[ci]-=dt*0.055*bRate;
// 寿命上限: 燃烧弹火系到点强制熄灭 (满燃料格自然烧尽需 ~8.4-9.6s, 上限使其提前熄火)
if(FEXPIRE[ci]>0&&age>=FEXPIRE[ci]) FUEL[ci]=0;
// 向 8 邻格积热 (斜向减半): 受热≥0.8 且有燃料 → 蔓延
// 参数按"稀草也能成链"校验: 邻格净受热≈0.6/s, 草格烧尽前(~2-4s)必引燃下一格
const cxi=ci%FN, czi=(ci/FN)|0;
for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){
if(!di&&!dj) continue;
const ni=cxi+di, nj=czi+dj;
if(ni<0||nj<0||ni>=FN||nj>=FN) continue;
const nj2=nj*FN+ni;
if(FBURN[nj2]>0||FUEL[nj2]<=0.05) continue;
if(!FHEAT[nj2]) HEATED.push(nj2);
FHEAT[nj2]+=dt*(di&&dj?0.42:0.85)*FIRE_SPREAD;   // ×蔓延总乘子 (总体削弱 0.8 × 天气 fireMul; 头注两刀)
if(FHEAT[nj2]>=0.8) igniteCell(nj2,FATT[ci],FEXPIRE[ci]);
}
// 视觉: 距相机近时喷火苗 (每格独立计时, 每帧总量限流)
FFX[ci]-=dt;
if(age>0.12&&FFX[ci]<=0&&fireFlameN<14){
const dCam=Math.hypot(cx-camera.position.x,cz-camera.position.z);
if(dCam<95){
FFX[ci]=rand(0.14,0.32);
fireFlameN++;
const gy=heightAt(cx,cz);
const inten=clamp(FUEL[ci],0.25,1);
// 2026-09-02 植被火焰加大: 火头体积/蹿升速度/滞空提升, 燃烧观感更醒目 (与燃烧弹缩短存在时间配合)
if(fireFxOK()) spawnP(PT.flash,cx+rand(-1.1,1.1),gy+rand(0.15,0.8),cz+rand(-1.1,1.1),rand(-0.3,0.3),rand(1.2,2.6)*inten+0.6,rand(-0.3,0.3),rand(0.8,1.3)*inten+0.4,1.6,rand(0.32,0.55),0.85,-1.4,true);
if(Math.random()<0.3&&fireFxOK()) spawnP(PT.dark,cx,gy+0.8,cz+rand(-0.5,0.5),rand(-0.3,0.3),rand(0.8,1.6),rand(-0.3,0.3),0.95,1.7,rand(1,1.8),0.45,0.1);
else if(SETTINGS.quality>=1&&Math.random()<0.35&&fireFxOK()) spawnP(PT.spark,cx,gy+0.4,cz,rand(-1.5,1.5),rand(1.5,4),rand(-1.5,1.5),0.09,-0.03,rand(0.25,0.55),1,3,true);
}
}
// 烧尽 (情况 B): 清格 + 该格植被视觉变为焦黑色并沉入 (草丛/庄稼/灌木/枯树等)
if(FUEL[ci]<=0){
FUEL[ci]=0; FBURN[ci]=0; FHEAT[ci]=0;
FEXPIRE[ci]=0;
FATT[ci]=null;
FIRE_ACTIVE[i]=FIRE_ACTIVE[FIRE_ACTIVE.length-1]; FIRE_ACTIVE.pop();
const cx2=(ci%FN)*FRES-FOFF+FRES/2, cz2=Math.floor(ci/FN)*FRES-FOFF+FRES/2;
const gy2=heightAt(cx2,cz2);
if(Math.hypot(cx2-camera.position.x,cz2-camera.position.z)<90){
spawnP(PT.dark,cx2,gy2+0.5,cz2,rand(-0.2,0.2),rand(0.8,1.4),rand(-0.2,0.2),1.0,1.8,rand(1.4,2.2),0.5,0.1);
}
	// 草丛/庄稼实例: 烧尽后染焦黑炭色, 残株停留数秒, 随后沉入地下消失
	for(const bi of BURN_INST){
	const arr=bi.byCell.get(ci);
	if(arr&&arr.length){
	fireTmp();
	if(bi.im&&bi.im.setColorAt&&bi.im.instanceColor){
	for(let idx of arr) bi.im.setColorAt(idx,_charCol);
	bi.im.instanceColor.needsUpdate=true;
	}
	queueSink({inst:{im:bi.im,idxs:arr},depth:1.6,rest:rand(3.5,6.5),sink:2.0});
	bi.byCell.delete(ci);
	}
	}
	// 格内灌木等对象植被消失 (枯树/椰树若已倒伏则跳过: 残骸已挂在自己的沉入任务上, 见 scheduleFloraObjSink)
const arr=FLORA_HASH.get(ci);
if(arr) for(const rec of arr) if(!rec.dead&&rec.alive!==false&&rec.kind!=='tree'&&rec.kind!=='willow'&&rec.kind!=='bamboo'){
if(rec.kind==='hedge'){ hedgeChar(rec); HEDGE_CRUMBLE.push({rec,t:rand(2.5,5)}); } // 树篱: 先焦黑停留, 再物理碎块化 (2026-11-16 批3, 用户指定"变黑后破碎")
else vanishFlora(rec,false,true); // 烧尽 ⇒ 染焦黑 (灌木/蕨丛/枯树; 乔木/柳/竹走自己的树冠-树干链, 柳/竹被格子火点燃由 treeIgnitePass 认领)
}
if(fireNavT<=0) fireNavT=5;
}
}
// ── 受热衰减 ──
for(let i=HEATED.length-1;i>=0;i--){
const ci=HEATED[i];
if(FBURN[ci]>0){ FHEAT[ci]=0; HEATED[i]=HEATED[HEATED.length-1]; HEATED.pop(); continue; }
FHEAT[ci]-=dt*0.25;
if(FHEAT[ci]<=0){ FHEAT[ci]=0; HEATED[i]=HEATED[HEATED.length-1]; HEATED.pop(); }
}
// ── 火点燃树木: 低频扫描燃烧格附近树冠 (树不占燃料格, 由格子引燃) ──
fireDmgT-=dt;
if(fireDmgT<=0){
fireDmgT=0.4;
treeIgnitePass();
fireDamageTick();
}
if(fireNavT>0){
fireNavT-=dt;
if(fireNavT<=0&&typeof markNavDirty==='function') markNavDirty();
}
// 倒树/沉树残骸动画 (与火同帧推进, 避免在 24-main 另挂更新点)
updateTreeSinks(dt);
// 火源动态光照推进 (残骸/燃烧弹/植被火动态点光源与自然跳动)
if(typeof updateFireLights==='function') updateFireLights(dt);
}
// 候选去重 Set/回调复用 (2026-11-01 性能批): 火情期每 0.4s 一轮, 旧版每轮 new Set + 每格一个新闭包。
// Set/游标/回调全在模块级, treeIgnitePass 只做装载与遍历。
const _tiSeen=new Set();
let _tiCx=0, _tiCz=0, _tiFatt=0;
function _tiFloraCb(rec){
if((rec.kind!=='tree'&&rec.kind!=='willow'&&rec.kind!=='bamboo')||_tiSeen.has(rec)) return;
_tiSeen.add(rec);
const d=Math.hypot(rec.x-_tiCx,rec.z-_tiCz);
if(d<3.0&&rec.alive&&rec.burnT<0) treeIgnite(rec,_tiFatt);
}
function treeIgnitePass(){
_tiSeen.clear();
for(const ci of FIRE_ACTIVE){
const cx=(ci%FN)*FRES-FOFF+FRES/2, cz=Math.floor(ci/FN)*FRES-FOFF+FRES/2;
_tiCx=cx; _tiCz=cz; _tiFatt=FATT[ci];
floraNear(cx,cz,3.2,_tiFloraCb);
}
}
// 火焰伤害: 燃烧格/火源圈内的步兵 (含玩家) 与坦克持续掉血, 击杀归点火者 (受天气伤害乘子缩放与附着燃烧点燃)
function fireDamageTick(){
const dmgMul=wxFireDmg();
const victims=combatants.slice();
for(const s of victims){
if(!creatureIgnitable(s)||seatShielded(s)) continue;   // 2026-09-26E 审计 2: 含艇上乘员; 2026-11-04b: 含观战者免着火
let att=null, fireDmg=0;
const ci0=fCellI(s.pos.x,s.pos.z);
const cxi=ci0%FN, czi=(ci0/FN)|0;
for(let dj=-1;dj<=1&&!fireDmg;dj++)for(let di=-1;di<=1;di++){
const ni=cxi+di, nj=czi+dj;
if(ni<0||nj<0||ni>=FN||nj>=FN) continue;
const ci=nj*FN+ni;
if(FBURN[ci]<=0) continue;
const cx=(ci%FN)*FRES-FOFF+FRES/2, cz=Math.floor(ci/FN)*FRES-FOFF+FRES/2;
if(Math.hypot(s.pos.x-cx,s.pos.z-cz)<2.7){ fireDmg=5.2*dmgMul; att=FATT[ci]; break; }
}
if(!fireDmg){
for(const fs of FIRE_SOURCES){
if(Math.hypot(s.pos.x-fs.x,s.pos.z-fs.z)<fs.r+0.4&&Math.abs((s.pos.y||0)-fs.y)<3.5){ fireDmg=fs.dps*0.4*dmgMul; att=fs.attacker; break; }
}
}
if(!fireDmg) continue;
s.damage(fireDmg,att,false);
igniteCreature(s,att);
if(s.isPlayer){ addTrauma(0.12); }
if(Math.hypot(s.pos.x-camera.position.x,s.pos.z-camera.position.z)<80&&fireFxOK()){
const gy=s.pos.y||heightAt(s.pos.x,s.pos.z);
spawnP(PT.flash,s.pos.x+rand(-0.25,0.25),gy+rand(0.5,1.3),s.pos.z+rand(-0.25,0.25),rand(-0.3,0.3),rand(1,2),rand(-0.3,0.3),rand(0.4,0.7),1.2,rand(0.25,0.4),0.9,-1,true);
}
}
for(const t of tanks){
if(!t.alive) continue;
let onFire=false, att=null;
for(const fs of FIRE_SOURCES){
if(Math.hypot(t.pos.x-fs.x,t.pos.z-fs.z)<fs.r+1.6){ onFire=true; att=fs.attacker; break; }
}
if(!onFire){
const ci=fCellI(t.pos.x,t.pos.z);
const cxi=ci%FN, czi=(ci/FN)|0;
for(let dj=-1;dj<=1&&!onFire;dj++)for(let di=-1;di<=1;di++){
const ni=cxi+di, nj=czi+dj;
if(ni<0||nj<0||ni>=FN||nj>=FN) continue;
const ci2=nj*FN+ni;
if(FBURN[ci2]>0&&FUEL[ci2]>0){ onFire=true; att=FATT[ci2]; break; }
}
}
if(onFire) t.takeDmg(3*dmgMul,att);
}
}

// ═══════════ 环境炮击 (雾林=树爆 2026-09-13 / 草原=炮火犁地 2026-09-13 库尔斯克改版) ═══════════
// 历史原型: 许特根森林战役的标志性杀伤 —— 炮弹在树梢高度空爆, 弹片/木刺自上而下泼洒,
// 林冠下暴露人员无处可躲, 唯有顶盖(建筑/碉堡/掩体=coldSheltered 同判定)与壕沟(低于炸点地面
// deep 米)能保命; 防火带开阔地无树冠, 炸点不落在那 (安全带, 但暴露于直射火)。
// 草原 (steppe 库尔斯克改版, 用户裁定"节制版"): 地面爆炸 (无林冠) —— 炮火犁地+点燃麦田,
// 热区=强点圈+中带散布, 间隔/杀伤放宽 (shelling 调参单源在 CAMPAIGN.steppe.shelling)。
// 玩家与 Bot 一视同仁 (同质化纲领第2条): Bot 经 tbThreat 逃离弹着圈 (与火情规避同一路径);
// 玩家有 prep 秒炮弹啸音 + HUD 红字预警。炸点只落在旗圈/强点圈/走廊热区附近, 开局 6s 后首轮。
const TB_THREATS=[];  // 活动弹着威胁 {x,z,r,t} (t=剩余秒) —— Bot 逃离/选点过滤用
let tbT=6;            // 开局 6s 后第一轮齐射
const TB_PENDING=[];  // 在途炮弹 {x,z,t}
// 环境炮击参数: 雾林=TREEBURST 单源; 草原=steppe.shelling 覆盖 (节制版: 间隔长/杀伤小/贴地炸)
const TB=(typeof STEPPE!=='undefined'&&STEPPE&&STEPPE.shelling)?Object.assign({},TREEBURST,STEPPE.shelling):TREEBURST;
const TB_GROUND=!!(typeof STEPPE!=='undefined'&&STEPPE); // 草原=地面爆 (无林冠空爆)
function tbThreat(x,z,clear){
let bd=1e9, bx=0, bz=0;
for(const s of TB_THREATS){
const dd=Math.hypot(x-s.x,z-s.z)-s.r;
if(dd<bd){ bd=dd; bx=s.x; bz=s.z; }
}
if(bd>clear) return null;
return {dx:bx-x, dz:bz-z};
}
// 遮蔽判定: 头顶有静态顶盖 (建筑/碉堡/掩体) 或身处壕沟/弹坑底 (低于炸点地面 deep 米)
function tbSheltered(px,py,pz,gy){
if(coldSheltered(px,py,pz)) return true;
return (py||0)<=gy-TB.deep;
}
// 热区: 雾林=旗圈附近 (拉锯焦点)+中线走廊随机点; 草原=强点圈 (争夺焦点)+中带散布
// —— 环境炮击只落在战区, 后方基地不受袭扰
function tbPickZone(){
if(TB_GROUND&&typeof SPOTS!=='undefined'&&SPOTS.length&&Math.random()<0.7){
const s=SPOTS[Math.floor(Math.random()*SPOTS.length)];
return {x:s.x+rand(-24,24), z:s.z+rand(-24,24)};
}
const fs=CAMPAIGN.flags;
if(fs.length){
const f=fs[Math.floor(Math.random()*fs.length)];
if(Math.random()<0.75) return {x:f.x+rand(-26,26), z:f.z+rand(-26,26)};
}
if(TB_GROUND) return {x:rand(-180,180), z:rand(-220,220)};
return {x:rand(-180,180), z:rand(-90,90)};
}
function updateTreeBursts(dt){
if(!CAMPAIGN.wood&&!CAMPAIGN.steppe) return;
// 在途炮弹倒计时 → 引爆
for(let i=TB_PENDING.length-1;i>=0;i--){
const s=TB_PENDING[i];
s.t-=dt;
if(s.t>0) continue;
TB_PENDING.splice(i,1);
tbDetonate(s.x,s.z);
}
// 威胁寿命衰减
for(let i=TB_THREATS.length-1;i>=0;i--){
TB_THREATS[i].t-=dt;
if(TB_THREATS[i].t<=0) TB_THREATS.splice(i,1);
}
// 玩家 HUD 红字预警: 在途弹着圈内的暴露人员 (每帧判定, 独立元素 #tbTip —— 不与严寒提示互抢)
if(player&&player.alive&&!player.onVehicle&&typeof tbHudShow==='function'){
let warn=false;
for(const s of TB_PENDING){
const d=Math.hypot(s.x-player.pos.x,s.z-player.pos.z);
if(d<TB.r*1.3&&!tbSheltered(player.pos.x,player.pos.y,player.pos.z,heightAt(player.pos.x,player.pos.z))){ warn=true; break; }
}
if(warn) tbHudShow(t(TB_GROUND?'⚠ 炮击! 弹片横飞 — 卧倒或找顶盖(建筑/碉堡)':'⚠ 树爆! 弹片自树冠泼下 — 找顶盖(建筑/碉堡)或卧倒壕沟'));
else tbHudHide();
}
// 齐射生成
tbT-=dt;
if(tbT>0) return;
tbT=rand(TB.minGap,TB.maxGap);
const cz=tbPickZone();
const nShells=Math.round(rand(TB.shells[0],TB.shells[1]));
for(let k=0;k<nShells;k++){
const a=Math.random()*TAU, rr=Math.random()*TB.spread;
TB_PENDING.push({x:cz.x+Math.sin(a)*rr, z:cz.z+Math.cos(a)*rr, t:TB.prep+k*TB.gap});
}
// 炮击预警: 玩家在热区附近 → 啸音提示 (齐射一次); 弹着圈内的玩家另有 HUD 红字 (每帧段)
if(player&&player.alive){
const dNear=Math.min.apply(null,TB_PENDING.map(s=>Math.hypot(s.x-player.pos.x,s.z-player.pos.z)));
if(dNear<260) AudioSys.mortarThunk(clamp(dNear,12,160));
}
}
function tbDetonate(x,z){
const gy=heightAt(x,z), by=gy+TB.h;
const dCam=Math.hypot(x-camera.position.x,z-camera.position.z);
if(TB_GROUND){
// 草原炮火犁地: 贴地爆炸 (尘柱+火光) + 小弹坑; 落在麦田内 → 点燃植株 (烈焰麦田)
if(dCam<200) explosionFXSmall({x,y:gy+0.6,z});
if(dCam<180) AudioSys.explosion('barrage',dCam,AudioSys.panOf({x,z})); // 重炮犁地档 (★2026-11-15c)
if(typeof crater==='function'&&dCam<150) crater(x,z,1.8,true);
for(const cf of (typeof CROP_FIELDS!=='undefined'?CROP_FIELDS:[])){
if(x>cf.x0&&x<cf.x1&&z>cf.z0&&z<cf.z1){ igniteArea(x,z,4.5,null); break; }
}
}else{
// 视觉: 林冠空爆闪光+黑烟 + 下落木刺火星 + 地面尘环 (距相机 200m 限流)
if(dCam<200){
spawnP(PT.flash,x,by,z,rand(-1,1),rand(0.5,1.5),rand(-1,1),rand(2.2,3.2),1.8,rand(0.4,0.6),0.95,-1,true);
for(let k=0;k<5;k++){
spawnP(PT.dark,x+rand(-2,2),by+rand(-1,1),z+rand(-2,2),rand(-2,2),rand(-0.5,1),rand(-2,2),rand(1.2,2),1.9,rand(1.2,2.2),0.5,0.1);
}
if(SETTINGS.quality>=1){
for(let k=0;k<8;k++){
spawnP(PT.spark,x+rand(-1.5,1.5),by+rand(-1,1),z+rand(-1.5,1.5),rand(-6,6),rand(-9,-3),rand(-6,6),0.12,-0.06,rand(0.5,0.9),0.8,4,true);
}
}
spawnP(PT.dark,x,gy+0.6,z,0,rand(1.2,2),0,rand(1.8,2.6),1.9,rand(1,1.6),0.4,0.1);
}
if(dCam<180) AudioSys.explosion('barrage',dCam,AudioSys.panOf({x,z})); // 林冠空爆档 (★2026-11-15c)
// 留疤: 小弹坑 (运行期 crater, 不涉种子)
if(typeof crater==='function'&&dCam<150) crater(x,z,1.5,true);
}
// 杀伤: 半径内暴露人员 (玩家+Bot 一视同仁; 载具内乘员由车体承伤), 中心线性平方衰减
for(const s of combatants){
if(!creatureIgnitable(s)||seatShielded(s)) continue;   // 2026-09-26E 审计 2: 含艇上乘员; 2026-11-04b: 含观战者免着火
const d=Math.hypot(s.pos.x-x,s.pos.z-z);
if(d>=TB.r) continue;
if(tbSheltered(s.pos.x,s.pos.y,s.pos.z,gy)) continue;
const k=1-d/TB.r;
s.damage(TB.dmg*k*k,null,false);
if(s.isPlayer) addTrauma(0.3);
}
for(const t of tanks){
if(!t.alive) continue;
const d=Math.hypot(t.pos.x-x,t.pos.z-z);
if(d>=TB.r) continue;
const k=1-d/TB.r;
t.takeDmg(TB.tankDmg*k*k,null);
}
// 弹着威胁登记: Bot 在圈内逃离 6s (复用火情规避路径)
TB_THREATS.push({x,z,r:TB.r+4,t:6});
}

// 树爆 HUD (#tbTip): 独立于严寒提示 (双方各用各的元素, 状态键比较防重复写 DOM)
function tbHudShow(line){
const elm=document.getElementById('tbTip');
if(!elm) return;
if(elm._line!==line){ elm._line=line; elm.innerHTML=line; elm.style.display='block'; }
}
function tbHudHide(){
const elm=document.getElementById('tbTip');
if(elm&&elm._line){ elm._line=null; elm.style.display='none'; }
}
