// ─────────────────────────────────────────────
// 11-soldiers.js —— 士兵网格/世界枪械模型
// 源: Index.original.html 第 3879-4034 行
// ─────────────────────────────────────────────
'use strict';
const _fwd=V3(), _rgt=V3(), _upv=V3(0,1,0), _v3Out=V3();
if(typeof globalThis!=='undefined') globalThis._v3Out=_v3Out;
function camForward(out){ camera.getWorldDirection(_fwd); if(out) return out.copy(_fwd); return _fwd.clone(); }
function camRight(out){ camera.getWorldDirection(_fwd); _rgt.crossVectors(_fwd,_upv).normalize(); if(out) return out.copy(_rgt); return _rgt.clone(); }
const soldiers=[];
const combatants=[];
let gunEvents=[];
function angleLerpTo(cur,tgt,maxStep){
let d=tgt-cur;
while(d>Math.PI)d-=TAU; while(d<-Math.PI)d+=TAU;
return cur+clamp(d,-maxStep,maxStep);
}
function angDiff(a,b){ let d=b-a; while(d>Math.PI)d-=TAU; while(d<-Math.PI)d+=TAU; return d; }
const uniformMats=(ZOMBIE_MODE?[0,1,2]:[0,1]).map(t=>{   // team2=丧尸档 (00-config TEAM_FACTION 按需挂档, 2026-10-06)
const F=TEAM_FACTION[t];
return {
coat:new THREE.MeshLambertMaterial({color:F.coat, map:TEX.cloth}), pants:new THREE.MeshLambertMaterial({color:F.pants, map:TEX.cloth}),
helm:new THREE.MeshLambertMaterial({color:F.helm, map:TEX.cloth}), skin:new THREE.MeshLambertMaterial({color:F.skin}),
};
});
// ★2026-11-19 卡顿审计批二: 枪模按 (kind|team|key) 缓存原型, 出货走 clone —— 重生风暴每次 respawn
// 都整套新建 Group + 数枚 Box/CylinderGeometry (launcher 分支还 new 一枚材质) = 成批阵亡后的老生代
// 几何分配尖峰 (GC 大停顿主源之一)。clone 共享几何/材质 (THREE Object3D.copy 语义), 每 respawn 只剩
// Mesh 壳分配; 组合有界 (kind×team×key) ⇒ 缓存会话内常驻, **卸载处一律不 dispose** (几何归原型所有,
// 15-vehicles/14-bots 各卸载点因此保持只 remove 不 dispose 的旧形态)。挂载路径只写组变换、量几何路径
// (gunGeomStations) 只读共享几何 ⇒ 共享无串扰。
const _wgCache=new Map();
function worldGunModel(kind,team,key){
const ck=kind+'|'+team+'|'+(key||'');
const hit=_wgCache.get(ck);
if(hit) return hit.clone();
const g=new THREE.Group();
const gm=vmMats.gun, wd=vmMats.wood;
const wg=key&&WPN_DEFS[key]?WPN_DEFS[key].wg:null;
if(kind==='smg'){
bx(gm,0.05,0.06,0.5,0,0,-0.1,g);
if(wg==='drum') { const d2=cyl(gm,0.075,0.075,0.05, 0,-0.1,-0.1,g,0); d2.rotation.x=HPI; }
else if(wg==='sidemag') bx(gm,0.16,0.028,0.05, -0.11,0.01,-0.12,g);
else if(wg==='c96a') bx(gm,0.026,0.1,0.05, 0,-0.08,-0.05,g);
else bx(gm,0.024,0.14,0.05,0,-0.09,-0.12,g);
} else if(kind==='mg'){
bx(gm,0.06,0.07,0.8,0,0,-0.15,g);
bx(wd,0.05,0.09,0.18,0,-0.04,0.28,g);
if(wg==='pan'){ const p2=cyl(gm,0.085,0.085,0.026, 0,0.09,-0.12,g,0); p2.rotation.x=HPI; }
else if(wg==='topmag') bx(gm,0.026,0.15,0.06, 0,0.13,-0.12,g);
else if(wg==='hopper') bx(gm,0.055,0.09,0.08, -0.06,0.06,-0.05,g);
cyl(gm,0.008,0.008,0.22, 0.035,-0.1,-0.42,g,0.3);
cyl(gm,0.008,0.008,0.22, -0.035,-0.1,-0.42,g,0.3);
} else if(kind==='atr'){
// 反坦克枪: 超长枪身
bx(gm,0.055,0.07,0.5, 0,0,0.08,g);
cyl(gm,0.017,0.017,0.85, 0,0.02,-0.6,g);
bx(gm,0.06,0.05,0.07, 0,0.02,-1.0,g);
bx(wd,0.045,0.08,0.18, 0,-0.04,0.32,g);
cyl(gm,0.008,0.008,0.26, 0.04,-0.1,-0.66,g,0.3);
cyl(gm,0.008,0.008,0.26, -0.04,-0.1,-0.66,g,0.3);
} else if(kind==='mortar'){
// 迫击炮: 背负式短管+座钣
const tube=cyl(gm,0.05,0.055,0.7, 0,0.08,-0.1,g);
tube.rotation.x=HPI-0.5;
bx(gm,0.24,0.03,0.28, 0,-0.1,0.1,g);
cyl(gm,0.01,0.01,0.34, 0.1,-0.02,-0.25,g,0.9);
cyl(gm,0.01,0.01,0.34, -0.1,-0.02,-0.25,g,0.9);
} else if(kind==='launcher'){
const tubeMat=new THREE.MeshLambertMaterial({color:team===0?0x4a5238:0x52524a});
const tube=cyl(tubeMat,0.075,0.075,1.5, 0,0.12,-0.15,g);
cyl(gm,0.085,0.078,0.09, 0,0.12,-0.86,g);
cyl(gm,0.085,0.078,0.08, 0,0.12,0.52,g);
bx(wd,0.04,0.08,0.06, 0,-0.02,0.02,g);
if(team===1) bx(vmMats.gunL,0.34,0.3,0.015, 0.02,0.1,-0.4,g);
} else if(kind==='pistol'){
// 手枪 (2026-11-04 副武器差异化批, 用户裁定"三款枪族造型"): 三族与第一人称 buildGunModel 的手枪族谱
// 一一对应 (09-weapons: 柯尔特式 m1911/p38/tt33 · 驳壳枪 c96 · 南部式 nambu)。坐标系同各枪: 原点≈
// 扳机位, +z=握把端 / -z=枪口端 (mountGunModel 转 π 后枪口朝角色前方); 抓握点由 gunGeomStations
// 按本几何现算, 双手 IK 自动落位, 无需另写锚点表。
const pfam=(key==='c96')?'broom':(key==='nambu'?'nambu':'colt');
if(pfam==='broom'){
// 驳壳枪: 方机匣 + 细枪管 + 前置弹匣 + 扫帚柄
bx(gm,0.034,0.05,0.15, 0,0.02,-0.02,g);
cyl(gm,0.011,0.011,0.14, 0,0.045,-0.15,g);
bx(gm,0.028,0.038,0.05, 0,0.046,0.03,g);
bx(gm,0.024,0.05,0.045, 0,-0.03,-0.05,g);
cyl(wd,0.016,0.02,0.075, 0,-0.012,0.05,g,0.25);
bx(gm,0.007,0.015,0.007, 0,0.06,-0.2,g);
} else if(pfam==='nambu'){
// 南部十四年式: 细长枪管 + 斜握把
bx(gm,0.028,0.042,0.14, 0,0.02,-0.01,g);
cyl(gm,0.009,0.009,0.12, 0,0.036,-0.13,g);
cyl(gm,0.015,0.015,0.045, 0,0.026,0.05,g,0);
bx(gm,0.024,0.08,0.045, 0,-0.042,0.04,g).rotation.x=-0.4;
bx(gm,0.018,0.05,0.03, 0,-0.028,0.038,g);
bx(gm,0.006,0.015,0.006, 0,0.05,-0.18,g);
} else {
// 柯尔特式 (m1911/p38/tt33): 套筒 + 短握把 + 小弹匣
bx(gm,0.03,0.046,0.17, 0,0.02,-0.02,g);
cyl(gm,0.012,0.012,0.09, 0,0.03,-0.13,g);
bx(gm,0.026,0.085,0.045, 0,-0.038,0.045,g).rotation.x=-0.25;
bx(gm,0.02,0.06,0.032, 0,-0.045,0.04,g);
bx(gm,0.006,0.016,0.006, 0,0.052,-0.11,g);
}} else if(kind==='radio'){
// 通讯仪 (2026-10-27 重做, 用户 7 项需求第 1 条): **不在这里另画一台** —— 整机几何与阵营配色走
// 09-weapons 的 buildRadioBody 单源 (第一人称 buildGunModel 的 radio 分支调的是同一个函数)。
// 为什么必须单源: 旧版本函数**根本没有 radio 分支**, 落进下面的步枪默认档 ⇒ 第三人称拿通讯仪时
// 手里是一把步枪 (用户实报 1.5)。若这里再抄一份建模, 第一/第三人称就会像"两条挂载路径"那样漂移
// (本仓 2026-09-21 契约 J 已经为挂枪吃过一次这个亏)。11-soldiers 本来就硬依赖 09-weapons 的
// bx/cyl/vmMats, 所以直接调用不额外加 typeof 守卫。
buildRadioBody(g,team);
} else {
bx(wd,0.05,0.07,0.75,0,0,-0.05,g);
cyl(gm,0.012,0.012,0.3,0,0.02,-0.55,g);
bx(wd,0.05,0.09,0.2,0,-0.05,0.32,g);
}
g.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
_wgCache.set(ck,g);
return g.clone();
}
function gunKindOf(key){
let d=WPN_DEFS[key];
if(d.model){ key=d.model; d=WPN_DEFS[key]; }
// 通讯仪 (2026-10-27, 用户 7 项需求第 1.5 条根因): 工具类手持件必须**先于**下面所有武器档判定。
// 它的 def 是 type:'tool' + radio:true, 不含 rocket/mortar/atRifle/pistol/auto, 旧版一路落到末尾的
// 默认档 (return 'rifle') ⇒ worldGunModel 建出步枪、GUN_MOUNT_BY_KIND/PRONE/CARRIED_FWD 也全走
// 步枪档; 玩家化身与 Bot 共用 mountGunModel, 所以两边一起错 (手里是步枪 + 整套步枪持握动画)。
if(d.radio) return 'radio';
if(d.rocket) return 'launcher';
if(d.mortar) return 'mortar';
if(d.atRifle) return 'atr';
// 2026-11-04 副武器差异化批: 手枪独立 kind (旧版映射 'smg' ⇒ 突击兵主/副武器落同一 smg 分支建出
// 逐几何一致的网格, 第三人称切副武器零变化, 用户实报)。持握姿态不加表项 = 走默认双手持枪 + armIK
// 双手反解到枪上 (用户裁定双手持枪), 与 radio (单手工具) 不同。
if(d.pistol) return 'pistol';
if(key==='bar'||key==='stg44'||d.wg==='pan'||d.wg==='topmag'||d.wg==='hopper') return 'mg';
if(d.type==='auto') return 'smg';
return 'rifle';
}
// ═════ 契约 J (2026-09-21 A#2 用户追加反馈): 武器持握骨架单源 ═════
// 角色正面朝 +Z (头盔帽檐/帽徽/背包全在 +Z 侧) ⇒ **+X = 角色左手侧, -X = 角色右手侧**。
// 旧版把 armR 建在 +X、枪挂在 +0.14 ⇒ 整套持枪是"左手持枪"的镜像: 枪插在左锁骨上、以锁骨为支点转
// (用户原话"武器仍是全插在左锁骨上的, 玩家动的时候也是以'武器模型插在左锁骨上'来动")。
// 这里把左右侧与挂点收成**单源**, 玩家 (20-player) 与 Bot (14-bots) 共用, 不再各写一份再漂移。
//   右手持枪 = 枪挂 -X 侧 · 低于肩关节 (肩 y=0.50 ⇒ 挂点 y=0.33 = 锁骨之下) · 在躯干前表面之外 (半深 0.13 ⇒ z=0.26)
const GUN_MOUNT={x:-0.15,y:0.33,z:0.26};   // 默认挂点 (= GUN_MOUNT_BY_KIND.default); 保留给旧引用与子集沙箱
// 按武器种类的挂点表 (Lead 裁定 2026-09-21 A#2 契约J 追加: 火箭筒走"扛肩式", 不列已知例外):
//   火箭筒 (launcher): 筒身**搁在右肩上** —— 史实姿态; 挂点抬到 y=0.56 ⇒ 筒体 (自身 y 偏 0.12, 半径 0.075/0.085)
//     整体在躯干盒 (顶 0.555) 之上, 且外偏到 x=-0.26 ⇒ 筒身在头/颈盒 (|x|≤0.16) 之外;
//   反坦克步枪 (atr): 略外偏抬高 (长管, 原本已达标, 这条只是留档);
//   迫击炮 (mortar): 低挂 + 外偏 (x=-0.28,y=0.24,z=0.30) —— 实测取证: 默认挂点下匍匐姿态筒尾压进头/颈盒 0.012m
//     (前推量方向相反: 0.34~0.50 反而加深到 0.047~0.05), 本挂点四姿态**头/颈与躯干全部 0 组**;
//   其余 (步枪/冲锋枪/机枪): 现冻结值不动。
const GUN_MOUNT_BY_KIND={
launcher:{x:-0.26,y:0.56,z:0.08},
atr:{x:-0.20,y:0.42,z:0.20},
mortar:{x:-0.28,y:0.24,z:0.30},
// 通讯仪 (2026-10-27, 用户 7 项需求第 1.5 条): 短粗手持件 —— 举在**胸前偏右**、贴近躯干前表面。
// 挂点 y 为什么是 0.40 而不是默认步枪的 0.33: 机模原点在握点, 握点比机身底面再低 0.095 (见 09-weapons
// buildRadioBody 的 RADIO_GRIP_Y + gunGeomStations 的"取该站位下缘"), 所以挂点 0.40 ⇒ 右手落在躯干
// 局部 y≈0.305 (胸口), 机身顶面 0.52 / 天线尖 0.72 —— 抬到嘴边而不挡住头盔, 是"举机通话"的姿态。
// x 收到 -0.17 (比步枪 -0.15 略外) 让天线与头盔盒 (|x|≤0.155) 分开, 臂长校验: 右肩 (-0.28,0.50,0) 到
// 握点 0.50m < 全伸 0.62m ⇒ armIK 有富余, 不会出现"够不到而把手钉在空气里"。
radio:{x:-0.17,y:0.40,z:0.30},
// 手枪 (2026-11-04 副武器差异化批, 挂点经 dev/verify-a21-j 全量复测定位): 手枪**无枪托**, 不适用
// "枪托抵肩"的躯干接触档 —— 挂点前移到握把端恰好不侵躯干盒 (站姿 I 档 z=0.33: 四姿态×双路径
// ①″ 零接触 / ④′ 双手 L=R=0), y=0.42 持枪于胸口 (② 约束 y<0.45), x=-0.17 双手合拢。
// 臂长校验: 右肩 (-0.28,0.50,0) 到握点 ≈0.39m; 左肩到护木点 ≈0.60m —— 后者贴近全伸 0.62m 是有意的
// (护木站位落在臂展内包络 |vx|≤hy(d) 的边界内; 超界时既有 gunAxisPoint 走 t 回退保手在枪上)。
pistol:{x:-0.17,y:0.42,z:0.33},
default:{x:-0.15,y:0.33,z:0.26},
};
// ── 匍匐挂点 (2026-09-26 A1 修): 挂点必须**随躯干俯角**给, 否则趴姿下枪与手一起埋进地面 ────────────
// 站立挂点的语义是"局部 y=沿身体向上, z=胸前向外"。躯干前倾 pp 之后, 这两个轴分别变成"沿身体向前"
// 与"**竖直向下**" —— 于是 z=+0.26 的"胸前偏移"在趴姿 (pp=1.5) 下就是往地下扎 0.26m: 实测挂点落到
// 骨盆之下 0.236m = 地面以下 0.016m (骨盆高 0.22), 枪身下缘与双手再往下 ~0.13m 全部穿地。
// 趴姿要的不是"胸前向外"而是"肩线之上、头侧之外" —— 所以在**世界系**里给出目标 (dy=离骨盆高,
// dz=骨盆前方距离), 再用 Rx(pp)⁻¹ 折回躯干局部: ly = dy·cos(pp) + dz·sin(pp), lz = -dy·sin(pp) + dz·cos(pp)。
// pp=1.5 时 default 折算得 (-0.24, 0.549, -0.061) ⇒ 世界 (高 0.32m / 前方 0.544m): 与右肩窝
// (躯干局部 (-0.28,0.50,0)) 同站、并肩线略上、在头盒 (|x|≤0.1) 与盔 (|x|≤0.155) 之外 —— 契约 J 的四条
// 判据 (头颈盒不相交 / 躯干盒仅枪托抵肩 / 双手到枪面 ≤0.06 / 挂点单源) 由 dev/verify-a21-j.js 复测。
const GUN_MOUNT_PRONE={          // x: 横向(右手侧) · dy: 离骨盆高 · dz: 骨盆前方
launcher:{x:-0.26,dy:0.12,dz:0.50},
atr:{x:-0.24,dy:0.10,dz:0.545},
mortar:{x:-0.28,dy:0.06,dz:0.55},
// 通讯仪: 趴姿下右手把机子撑在头侧前方 (dy 比步枪高 0.02 = 机子不被地面吞掉; dz 收到 0.40 —— 机模
// 只有 0.30 高, 按步枪的 0.545 会把它推到臂展外, armIK 只能钳到可达球面 ⇒ 手与机子脱开)。
radio:{x:-0.22,dy:0.12,dz:0.40},
// 手枪: 趴姿**双臂前伸**持枪 (dz≈步枪档 0.545 的 0.62) —— 收在胸前 (0.38) 时枪角 rx≈-1.5 把护木
// 站位旋到躯干正前, 左肩到目标变成纯横向 0.469m, 超出弯肘横向包络 (hy≈0.372m) ⇒ 左手脱枪 0.19m
// (a21-j ④′ 实测); 前伸到 0.62 后左肩到目标转为斜前向 d≈0.57, 双手 IK 全落枪面, 且枪盒离头/躯干更远。
pistol:{x:-0.24,dy:0.12,dz:0.62},
default:{x:-0.24,dy:0.10,dz:0.545},
};
// 站↔趴的过渡按**当前**骨盆俯角平滑混合 (站 0.05 / 蹲 0.14 / 疾跑 0.30 / 趴 1.50):
// 硬切换会在站→趴的 0.4s 里让枪瞬移半米; 骨盆俯角本身就是 dampF 过的, 用同一个量做插值权即连续。
const GUN_MOUNT_BLEND0=0.40, GUN_MOUNT_BLEND1=1.30;
// ★2026-11-11 性能批: 返回值槽位化 (旧版每次 new 一个 {x,y,z})。全部调用点 (14-bots updateMesh 挂点 /
// 20-player 姿态机挂点 / mountGunModel / _gunAnchorTorso 内部) 逐一核对过: 结果**即时串行消费**,
// 无同帧双持 —— 槽位复用逐位等价。数值全量写入 (站/蹲疾跑路径也经槽, 消费方不再共享 GUN_MOUNT 表对象)。
const _gm={x:0,y:0,z:0};
function gunMountOf(kind,pp){
const k=kind||'rifle';
const st=GUN_MOUNT_BY_KIND[k]||GUN_MOUNT_BY_KIND.default;
const p=pp||0;
if(p<=GUN_MOUNT_BLEND0){ _gm.x=st.x; _gm.y=st.y; _gm.z=st.z; return _gm; }  // 站/蹲/疾跑: 原值, 逐位不变
const pr=GUN_MOUNT_PRONE[k]||GUN_MOUNT_PRONE.default;
let kk=clamp((p-GUN_MOUNT_BLEND0)/(GUN_MOUNT_BLEND1-GUN_MOUNT_BLEND0),0,1);
kk=kk*kk*(3-2*kk);
const c=Math.cos(p), s=Math.sin(p);
const ly=pr.dy*c+pr.dz*s, lz=-pr.dy*s+pr.dz*c;
_gm.x=st.x+(pr.x-st.x)*kk; _gm.y=st.y+(ly-st.y)*kk; _gm.z=st.z+(lz-st.z)*kk;
return _gm;
}
// ═════ 持握姿态表 (单源) — 2026-10-27 通讯仪批 ═════
// 为什么需要这张表: 姿态机 (20-player updatePlayerAvatar / 14-bots updateMesh) 里的四分支
// (匍匐/交战/疾跑/警戒) 全部按"长枪双手持握"写死 —— 通讯仪是 5cm 厚的手持工具, 套上去就是
// "把对讲机当步枪抵肩", 而且还会跟着播换弹/抵肩动作 (用户 7 项需求第 1.5 条)。
// 口径: **判定只认 gunKindOf() 给出的 kind**, 姿态数值全部集中在这张表里 —— 姿态机不许再写
// 第二份"if(武器名==='radio')"的硬编码 (那会变成与挂点表并行的第二个漂移源)。
// 字段语义 (全部是躯干局部角, 与姿态机同一套符号):
//   shR/elR/shRz/shL/elL/shLz : 右/左肩前后摆 / 肘弯 / 肩外展 (乘 UPPER_MIRROR 之前的基准值)
//   gunX/gunY/gunZ            : gunG 目标角 (gunY 为负 = 机面转向角色脸侧, 让屏幕朝自己)
//   handK/handKL              : armIK 权重 (右手 1 = 反解到机身握点; 左手 0 = 自然下垂/扶机, 不抓护木)
//   noReload/noBrace          : 该 kind 不存在"拉栓换弹 / 抵肩架枪"这两件事, 姿态机据此整段跳过
const GUN_HOLD_BY_KIND={
radio:{
// 举机通话: 右手抬到胸口偏右 (与 GUN_MOUNT_BY_KIND.radio 的挂点同高), 肘弯大 ⇒ 机子贴近脸;
// 左臂自然下垂略内收 (史实上另一只手多半在按 PTT 或扶腰)。数值按"右肩到挂点 0.50m / 全伸 0.62m"
// 留 0.12m 富余反推 —— 保证 armIK 不把目标钳到可达球面 (钳了就会出现"手贴不到机身")。
shR:-1.02, elR:-1.62, shRz:-0.30, shL:-0.30, elL:-0.62, shLz:0.30,
gunX:0.12, gunY:-0.42, gunZ:0.10,
handK:1, handKL:0, noReload:true, noBrace:true,
},
};
// 取表: 没有条目的 kind (步枪/冲锋枪/机枪/火箭筒/迫击炮…) 返回 null ⇒ 姿态机走原路径, 逐位不变。
// 入参就是 gunKindOf() 的返回值, 所以调用方不需要认识武器键, 也不需要再判一次类型。
function gunHoldOf(kind){ return (kind&&GUN_HOLD_BY_KIND[kind])?GUN_HOLD_BY_KIND[kind]:null; }
const ARM_SIDE={R:-1,L:1};                 // mkArm 的 side 参数: 右=-1 (-X) / 左=+1 (+X)
// 枪模在 gunG 内的前推量 (单源): 长武器不给前推量时枪托/管尾会落进躯干 —— 火箭筒管长 1.5、AT 步枪 0.85 尤其明显。
// launcher 0.20→0.30 (2026-09-21 A#2 扛肩式收尾, 实测取证): 扛肩挂点下 0.20 时匍匐姿态筒尾仍压进头/颈盒 0.012m,
// 0.30 时四姿态头/颈盒 0 组、躯干仅"抵肩接触" 0.034m(肩窝距 0.136 ≤0.30) —— 见 dev/out/tmp-infantry-gunmount-sweep.txt。
// 通讯仪 0.14: 枪模前推量的语义是"把长枪身从躯干里推出来", 而通讯仪只有 5cm 厚、且挂点已在胸前
// 0.30 —— 沿用 0.30 会让它悬在身前 30cm 处脱离手 (armIK 够不到, 手被钳在可达球面上)。
const CARRIED_FWD={rifle:0.30,smg:0.30,mg:0.30,atr:0.24,launcher:0.30,mortar:0.30,radio:0.14,pistol:0.06};   // 手枪 0.06 (2026-11-04): 枪短, 沿用步枪 0.30 会把手枪推出手外 (IK 钳臂长 ⇒ 脱手)
// 上半身镜像符号单源 (契约 §12.2 的数学依据, 别再改回去):
//   镜像平面 x=0 下旋转矩阵的共轭 M·R·M⁻¹ 为 Rx(θ)→Rx(θ) (不变) / Ry(θ)→Ry(-θ) / Rz(θ)→Rz(-θ);
//   Euler 顺序 XYZ 时逐分量成立 ⇒ 肩链的 rotation.y / rotation.z **目标值**写回时乘这个符号, rotation.x 不动。
//   姿态数值本身不重调 (只乘符号), 两边 (Bot 与玩家) 共用同一个符号, 杜绝各调一套。
//   例外 (不取反): pelvis.rotation.y (侧身站姿 blade) —— 现有 -blade 恰好是"左肩在前"= **右手持枪的标准侧身**,
//   它本来就是对的; 取反会变成左手持枪的站姿。
const UPPER_MIRROR=-1;
function setUpperMirror(){ return UPPER_MIRROR; }
// 统一挂载: 玩家与 Bot **只此一条路径** (旧版两条各写一份, 玩家的漏了局部位移 ⇒ 枪比 Bot 后退 0.2~0.3m 退回锁骨)。
//   建模型 → gunG 内前推 CARRIED_FWD[kind] + 微降 0.02 (与 Bot 原值一致) → rotation.order='YXZ' → rotation.y=PI
//   (worldGunModel 的枪口朝模型 -Z, 角色正面朝 +Z ⇒ 转半圈对齐) → add 进 gunG。
//   返回枪模对象 (调用方保存引用以便 remove/visible)。
function mountGunModel(gunG,kind,team,key){
if(!gunG||typeof worldGunModel!=='function') return null;
const g=worldGunModel(kind||'rifle',team,key);
const fwd=(CARRIED_FWD[kind]!==undefined)?CARRIED_FWD[kind]:CARRIED_FWD.rifle;
// 挂点随枪种更新 (Lead 裁定: gunG 不再建骨架时写死一个点 —— 扛肩式火箭筒与步枪挂点不同):
const mo=gunMountOf(kind||'rifle');
if(gunG.position&&gunG.position.set) gunG.position.set(mo.x,mo.y,mo.z);
g.position.set(0,-0.02,fwd);
g.rotation.order='YXZ';
g.rotation.y=Math.PI;
gunG.add(g);
return g;
}
// ═════ 契约 J §12.4.3 (2026-09-21 A#2 用户追加反馈·最高优先): 手臂反解 + 枪上抓握点 (单源) ═════
// 用户投诉"武器只是插在锁骨上、不像被手握着" ⇒ 手到枪的距离**不能靠调姿态值凑**, 改成构造性保证:
// 姿态机照旧算基准 → 在"双手持枪"状态用 armIK 把双手**反解到枪上的抓握点**。
// 骨长与 mkArm 同源: 肩→肘 0.32 (elm.position.y=-0.32) / 肘→手组 0.30 (hand.position.y=-0.30) ⇒ 全伸 0.62。
const ARM_L1=0.32, ARM_L2=0.30;
// 手臂反解 (契约 §12.4.3 冻结语义):
//   target = **躯干局部系** {x,y,z}; 直接把"手部中心送到 target"所需的**绝对角**写进 sh.rotation.{x,y,z}
//   与 elm.rotation.x, 返回末端残差(m)。**不乘 setUpperMirror()** —— 反解在躯干空间求解, 输出即最终角;
//   镜像只作用于姿态机的基准值 (写回前乘), 与 IK 输出混合时两边已在同一坐标系。
//   可达性: 目标超臂长时把目标钳到可达球面, 残差如实返回 (调用方据此判断"够不到")。
//   纯算术 (asin/atan2, 无矩阵/四元数) ⇒ 只加载子集脚本的沙箱桩也能跑。
function armIK(sh,elm,target){
if(!sh||!elm||!target||!sh.rotation||!elm.rotation) return null;
const vx=target.x-sh.position.x, vy=target.y-sh.position.y, vz=target.z-sh.position.z;
const d=Math.hypot(vx,vy,vz);
if(!(d>1e-6)) return 0;
const L1=ARM_L1, L2=ARM_L2;
const dc=clamp(d,Math.abs(L1-L2)+0.01,L1+L2-0.002);   // 钳到可达球面
// 肘弯 β: 肩→手距离 dc 与 (L1,L2,β) 的余弦定理
const cosB=clamp((dc*dc-L1*L1-L2*L2)/(2*L1*L2),-1,1);
const beta=Math.acos(cosB);
// 肩局部系里"手相对肩"的向量 h=(0, hy, hz): 上臂沿 -Y, 前臂绕肩局部 X 弯 β ⇒ 手在肩局部 YZ 平面内
const hy=-(L1+L2*cosB), hz=L2*Math.sin(beta);
const s=dc/d, tx=vx*s, ty=vy*s, tz=vz*s;               // 目标方向上的可达点
// 肩角: R_sh = Rx(θx)·Rz(θz) (关节默认 Euler 序 XYZ, rotation.y=0)
const thZ=Math.asin(clamp(tx/(-hy),-1,1));
const y1=hy*Math.cos(thZ);
const thX=Math.atan2(y1*tz-hz*ty, y1*ty+hz*tz);
sh.rotation.x=thX; sh.rotation.y=0; sh.rotation.z=thZ;
elm.rotation.x=-beta;
// 残差: 用写回的角复算手位 (超臂长时即"够不到多少米")
const cX=Math.cos(thX), sX=Math.sin(thX);
const hx2=-hy*Math.sin(thZ), hy2=y1*cX-hz*sX, hz2=y1*sX+hz*cX;
return Math.hypot(hx2-vx,hy2-vy,hz2-vz);
}
// 枪模抓握点 (契约 §12.4.3): 由 **GUN_MOUNT + gunCarryOffset + 枪模几何现算**, 不写死坐标; 返回躯干局部系。
//   gunCarryOffset = mountGunModel 给枪模的局部位移 (0,-0.02,CARRIED_FWD[kind])。
//   几何: 沿枪身轴 (模型 z; worldGunModel 各枪都是 +z=枪托端、-z=枪口端) 取两个站位 ——
//     握把 = 模型原点所在站位 (各枪的扳机/握把都在原点附近, 这也是 carryOffset 的基准);
//     护木 = 从枪托端向前 40% 处;
//   高度取该站位上枪体的**下缘** (手从下方握住枪身 ⇒ 手中心落在枪体表面)。
//   几何来源: 逐网格读 geometry.parameters (真 three 有); 桩沙箱没有 parameters 时退化为"只按各部件 position 求轴范围"
//   —— 仍是几何信息而非写死坐标, 桩里能跑、只是略粗。缓存按 kind 一份 (建一次临时模型)。
const _gunAnchorCache={};
const _euT={x:0,y:0,z:0}; // _eulerXYZ 复用槽 (2026-11-11 性能批): 唯一调用点 _gunAnchorTorso 即时消费
function _eulerXYZ(p,rx,ry,rz){ // 躯干局部 = Rx·Ry·Rz·gunG局部 (与 three 的 Euler 'XYZ' 同序; 纯算术)
// 自别名安全 (2026-11-11): 调用方可能把上一轮返回的 _euT 原样传回 (探针 handTorso 即如此),
// 逐分量先写 _euT.x 再读 p.x 会读到已覆盖的新值 ⇒ 入参三轴必须先快照进局部。
const px=p.x, py=p.y, pz=p.z;
if(!rx&&!ry&&!rz){ _euT.x=px; _euT.y=py; _euT.z=pz; return _euT; }
const a=Math.cos(rx||0), b=Math.sin(rx||0), c=Math.cos(ry||0), d=Math.sin(ry||0), e=Math.cos(rz||0), f=Math.sin(rz||0);
const m00=c*e, m01=-c*f, m02=d;
const m10=a*f+b*e*d, m11=a*e-b*f*d, m12=-b*c;
const m20=b*f-a*e*d, m21=b*e+a*f*d, m22=a*c;
_euT.x=m00*px+m01*py+m02*pz; _euT.y=m10*px+m11*py+m12*pz; _euT.z=m20*px+m21*py+m22*pz;
return _euT;
}
function gunGeomStations(kind){
const k=kind||'rifle';
if(_gunAnchorCache[k]) return _gunAnchorCache[k];
let zMin=Infinity, zMax=-Infinity;
const parts=[];
if(typeof worldGunModel==='function'){
const g=worldGunModel(k,0,null);   // 临时模型只为量几何 (不进任何场景)
if(g&&g.traverse) g.traverse(o=>{
if(!o.isMesh) return;
const pr=(o.geometry&&o.geometry.parameters)||{};
let hx=0,hy=0,hz=0;
if(pr.width!==undefined){ hx=pr.width/2; hy=pr.height/2; hz=pr.depth/2; }
else if(pr.radiusTop!==undefined||pr.radiusBottom!==undefined){
const r=Math.max(pr.radiusTop||0,pr.radiusBottom||0); hx=r; hy=(pr.height||0)/2; hz=r;
const rx=o.rotation?Math.abs(o.rotation.x||0):0;
if(Math.abs(rx-HPI)<0.35){ const t=hy; hy=hx; hz=t; }   // cyl() 默认绕 X 转 90° ⇒ 轴从 Y 换到 Z
}
const px=o.position?o.position.x:0, py=o.position?o.position.y:0, pz=o.position?o.position.z:0;
parts.push({x:px,y:py,z:pz,hy});
if(pz-hz<zMin) zMin=pz-hz;
if(pz+hz>zMax) zMax=pz+hz;
});
}
if(!parts.length||!(zMax>zMin)){ zMin=-0.5; zMax=0.5; parts.push({x:0,y:0,z:0,hy:0.03}); }
const zGrip=clamp(0,zMin,zMax);
const zFore=zMin+(zMax-zMin)*0.40;
const yAt=z=>{ let best=null,bd=Infinity; for(const p of parts){ const dd=Math.abs(p.z-z); if(dd<bd){ bd=dd; best=p; } } return best?(best.y-best.hy):0; };
const res={grip:{x:0,y:yAt(zGrip),z:zGrip}, fore:{x:0,y:yAt(zFore),z:zFore}, zMin:zMin, zMax:zMax};
_gunAnchorCache[k]=res;
return res;
}
const _gco={x:0,y:0,z:0}; // gunCarryOffset 复用槽 (2026-11-11 性能批): 唯一调用点 _gunAnchorTorso 即时消费
function gunCarryOffset(kind){
const k=kind||'rifle';
const fwd=(CARRIED_FWD[k]!==undefined)?CARRIED_FWD[k]:CARRIED_FWD.rifle;
_gco.x=0; _gco.y=-0.02; _gco.z=fwd;
return _gco;
}
// ── 枪上锚点链槽位契约 (2026-11-11 性能批, 调用点逐一核对过) ──
// 旧版每次 gunGripPoint/gunForePoint/gunAxisPoint 调用分配 3~15 个短命对象 (每 Bot 每帧 ~15-25 个,
// 22 人 × LOD ≈ 每帧 250-350 个 = 全库剩余最大的常驻 GC 源)。槽位化规则:
//   · 三个对外槽各独立: gunGripPoint→_gaGrip / gunForePoint→_gaFore / gunAxisPoint→_gaAxis;
//   · 枪轴点内部临时槽 _gatA/_gatB **不写**对外槽 —— 14-bots 的 gp(_gaGrip) 在 gunAxisPoint 回退循环
//     与两次 armIK 之间一直活着, 内部若借用对外槽会把 gp 冲掉;
//   · 消费即时: 20-player 右臂块 (gunGripPoint→回退→armIK) 在左臂块 (gunForePoint→gunAxisPoint→armIK)
//     之前完成, 同槽不跨块存活; mountGunModel / 两处挂点 dampF 均单调用即用。
const _gaGrip={x:0,y:0,z:0}, _gaFore={x:0,y:0,z:0}, _gaAxis={x:0,y:0,z:0};
const _gatA={x:0,y:0,z:0}, _gatB={x:0,y:0,z:0}, _gatP={x:0,y:0,z:0};
// ★2026-11-18 卡顿审计: 单兵单帧 8~31 次锚点求值 (grip+fore+gunAxisPoint×n) 参数完全相同 ⇒
//   grip/fore 各一槽 memo (交替调用不互踩)。命中路径只做值拷贝进 out —— 不把缓存对象别名出去、
//   不写任何对外槽 (perfreg T3 槽位契约逐字保持); 被跳过的 _eulerXYZ/_gatP/gunMountOf 均为纯求值,
//   产物仅在本函数内即时消费。跨兵参数不同自然失效 (每姿态帧首调必 miss)。
const _gac={grip:{k:null,rx:0,ry:0,rz:0,pp:0,v:{x:0,y:0,z:0}},fore:{k:null,rx:0,ry:0,rz:0,pp:0,v:{x:0,y:0,z:0}}};
function _gunAnchorTorso(kind,which,rx,ry,rz,pp,out){
const _c=_gac[which];
if(_c&&_c.k===kind&&_c.rx===rx&&_c.ry===ry&&_c.rz===rz&&_c.pp===pp){
const _m=_c.v; out.x=_m.x; out.y=_m.y; out.z=_m.z; return out;
}
const st=gunGeomStations(kind), a=(which==='fore')?st.fore:st.grip, co=gunCarryOffset(kind);
// 模型空间 → gunG 局部: mountGunModel 把模型 rotation.y=PI (x→-x, z→-z) 并加 carryOffset
_gatP.x=-a.x+co.x; _gatP.y=a.y+co.y; _gatP.z=-a.z+co.z;
const p=_eulerXYZ(_gatP,rx,ry,rz);
const mo=gunMountOf(kind,pp);   // 挂点按枪种取 (扛肩式火箭筒挂点不同) + 按躯干俯角取 (趴姿挂点不同, A1)
out.x=mo.x+p.x; out.y=mo.y+p.y; out.z=mo.z+p.z;
_c.k=kind; _c.rx=rx; _c.ry=ry; _c.rz=rz; _c.pp=pp; _c.v.x=out.x; _c.v.y=out.y; _c.v.z=out.z;
return out;
}
function gunGripPoint(kind,rx,ry,rz,pp){ return _gunAnchorTorso(kind,'grip',rx,ry,rz,pp,_gaGrip); }   // 握把点 (躯干局部系)
function gunForePoint(kind,rx,ry,rz,pp){ return _gunAnchorTorso(kind,'fore',rx,ry,rz,pp,_gaFore); }   // 护木点 (躯干局部系)
// 可达性辅助 (调用方用): 把"沿枪身轴从握把到护木的某点"作为 IK 目标, 使左/右手**永远落在枪上**。
//   t=0 → 握把, t=1 → 护木; 返回躯干局部点。护木点超臂长时调用方可取可达的 t (见 20-player 的左臂处理)。
function gunAxisPoint(kind,t,rx,ry,rz,pp){
const k=kind||'rifle';
const gp=_gunAnchorTorso(k,'grip',rx,ry,rz,pp,_gatA), fp=_gunAnchorTorso(k,'fore',rx,ry,rz,pp,_gatB);
const u=clamp(t,0,1);
_gaAxis.x=gp.x+(fp.x-gp.x)*u; _gaAxis.y=gp.y+(fp.y-gp.y)*u; _gaAxis.z=gp.z+(fp.z-gp.z)*u;
return _gaAxis;
}
// ═════ 腿部骨骼常量 + 两连杆矢状面反解 (单源) ═════
// LEG_L1/LEG_L2 = 髋→膝 / 膝→踝 的骨长 (mkLeg 的骨盒与关节站位即由它们决定 —— 改这里就是改骨架);
// LEG_ANKLE2SOLE = 踝关节到鞋底的距离 (军靴盒 0.15×0.1×0.24 挂在 knee 局部 (0,-0.46,0.04) ⇒ 鞋底
//   在踝下 0.03m)。反解输入 fy 是**踝关节**世界高 ⇒ 鞋底高 = fy - LEG_ANKLE2SOLE。
const LEG_L1=0.46, LEG_L2=0.48, LEG_ANKLE2SOLE=0.03;
// 两连杆矢状面反解 (大腿 LEG_L1 / 小腿 LEG_L2):
//   输入 = 骨盆(髋关节)高 hp (相对地面) + 脚**踝关节**目标 (fy 世界高, dz 相对髋的前后偏移);
//   输出 = {hip:相对"正下方"的世界大腿角, knee:膝弯角 (0=直腿)}。
//   为什么必须反解而不是写死角度: 骨盆前倾 pp 是 dampF 过渡的 (站→趴要 ~0.4s), 写死角度的腿在这段时间里
//   指向地面 → 实测趴姿切换瞬间脚穿地 0.72m; 蹲姿稳态两脚也各穿地 0.17/0.29m。反解 + 减去 pp 之后,
//   脚**始终**落在目标高度, 与骨盆高度/前倾进度无关。kneeUp/pole 方向即膝弯方向: pole-up (膝峰在髋踝线
//   上方) 几何上必然伴随小腿"向脚尖方向折" = 反关节超伸 —— 趴姿自 2026-11-13b 批⑤起改 kneeUp=false
//   (膝落回贴地段 + 膝弯转人类屈曲方向, 与 20-player/14-bots 两处消费点同批同规)。
//   ★ 2026-09-26 (A2): 本函数从 14-bots 的 Bot.prototype.legIK 提到这里做**单源** —— 玩家第三人称
//   (20-player) 当时没跟这次反解改造, 两条路径各写一份 ⇒ 玩家长时间保持"修前"的穿地数值。
// 交替双槽 (2026-11-11 性能批): 六个调用点 (14-bots LL,RR / cL,cR 与 20-player 同两对) 全部是
// "A,B 连续两调后同帧消费" —— 交替命中保证两份结果同时活着; 结果只读, 下一帧复用。
const _legA={hip:0,knee:0}, _legB={hip:0,knee:0}; let _legFlip=0;
function legIKPose(hp,fy,dz,kneeUp){
const a=LEG_L1, b=LEG_L2;
const dy=fy-hp;
let D=Math.hypot(dy,dz);
D=clamp(D,Math.abs(a-b)+0.03,a+b-0.012);
const dir=Math.atan2(-dz,-dy);
const cosB=clamp((a*a+D*D-b*b)/(2*a*D),-1,1);
const beta=Math.acos(cosB);
const hipW=kneeUp?dir+beta:dir-beta;
const inner=Math.acos(clamp((a*a+b*b-D*D)/(2*a*b),-1,1));
const bend=Math.PI-inner;
const o=(_legFlip^=1)?_legA:_legB;
o.hip=hipW; o.knee=kneeUp?-bend:bend;
return o;
}
const _soldierFlBaseL=(typeof NIGHT_GEAR!=='undefined'&&NIGHT_GEAR.flConeL)?NIGHT_GEAR.flConeL:14;
const _soldierFlGeo=new THREE.ConeGeometry(1.0,_soldierFlBaseL,10,1,true);
const _soldierFlMat=new THREE.MeshBasicMaterial({color:0xffedd0,transparent:true,opacity:0.12,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false});
function buildSoldierMesh(team,name){
const U=uniformMats[team];
const root=new THREE.Group();
const pelvis=new THREE.Group(); pelvis.position.y=0.94; root.add(pelvis);
const torsoG=new THREE.Group(); pelvis.add(torsoG);
bx(U.coat,0.44,0.55,0.26, 0,0.28,0, torsoG);
const headG=new THREE.Group(); headG.position.set(0,0.62,0); torsoG.add(headG);
bx(U.skin,0.2,0.22,0.2, 0,0.1,0, headG);
// 阵营特色头盔/军帽
// ★2026-11-03 穿模修复 (用户实测: 方头四上角总从盔里探出来): 头盒半宽 0.1 → 上角离轴线 0.1414, 而旧盔在
//   头顶高度的截面半径只有 0.134~0.142, 且 10 段多面体还要再内缩 ~4% ⇒ 四角必然穿出。四盔统一放大球冠
//   半径并微调冠高 (头顶轮廓位移 ≤6mm, 剪影不变), 保证**多面体化后**的盔面在 [盔沿, 头顶] 全程压住四角
//   (裕量 ≥3mm, 判据钉 dev/verify-crushhead-20261103.js)。头盒/爆头命中球 (13-combat r=0.26) 均不动。
//   顺带修: 日军星徽/国军青天白日徽旧 z 值本就埋在盔面内侧 (旧盔该高度截面半径 > 徽章 z) 从未露出,
//   随新盔尺寸一并挪到盔面上 (前缘出盔面 ~2mm, 后缘埋入固定)。
let helm;
const hs=TEAM_FACTION[team].helmet;
if(hs==='pot'){
helm=new THREE.Mesh(new THREE.SphereGeometry(0.162,10,8,0,TAU,0,HPI*1.2),U.helm);
helm.position.set(0,0.154,0);
headG.add(helm);
} else if(hs==='stahl'){
helm=new THREE.Mesh(new THREE.SphereGeometry(0.165,10,8,0,TAU,0,HPI*1.35),U.helm);
helm.position.set(0,0.145,0); helm.scale.z=1.15;
headG.add(helm);
// 国军M35: 正面青天白日徽 (新盔该高度 z 向截面半径 ≈0.1784, 徽章前缘出面 ~1mm / 后缘埋入盔面)
if(TEAM_FACTION[team].sym==='✷'){
bx(new THREE.MeshLambertMaterial({color:0x2050b0}),0.032,0.032,0.008, 0,0.17,0.1755, headG);
bx(new THREE.MeshLambertMaterial({color:0xe8e8e8}),0.016,0.016,0.01, 0,0.17,0.1775, headG);
}
} else if(hs==='ssh'){
helm=new THREE.Mesh(new THREE.SphereGeometry(0.167,10,8,0,TAU,0,HPI*1.28),U.helm);
helm.position.set(0,0.153,0); helm.scale.y=1.1;
headG.add(helm);
} else if(hs==='jp'){
helm=new THREE.Mesh(new THREE.SphereGeometry(0.165,10,8,0,TAU,0,HPI*1.22),U.helm);
helm.position.set(0,0.146,0);
headG.add(helm);
const brim=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.17,0.025,10),U.helm);
brim.position.set(0,0.1,0); headG.add(brim);
bx(new THREE.MeshLambertMaterial({color:0xd8b840}),0.02,0.024,0.008, 0,0.16,0.1535, headG);
} else {
// 八路军帽: 布帽+短帽檐(朝前)+红星
const cap=bx(U.helm,0.21,0.09,0.21, 0,0.19,0, headG);
bx(U.helm,0.18,0.028,0.07, 0,0.155,0.12, headG);
bx(new THREE.MeshLambertMaterial({color:0xc03028}),0.024,0.024,0.008, 0,0.19,0.106, headG);
}
const mkArm=(side)=>{
const sh=new THREE.Group(); sh.position.set(side*0.28,0.5,0); torsoG.add(sh);
bx(U.coat,0.13,0.32,0.13,0,-0.16,0,sh);
const elm=new THREE.Group(); elm.position.y=-0.32; sh.add(elm);
bx(U.coat,0.115,0.28,0.115,0,-0.14,0,elm);
const hand=new THREE.Group(); hand.position.y=-0.3; elm.add(hand);
bx(U.skin,0.09,0.09,0.09,0,0,0,hand);
sh.userData.swing=0;
return {sh,elm,hand};
};
const armL=mkArm(ARM_SIDE.L), armR=mkArm(ARM_SIDE.R);
const mkLeg=(side)=>{
const hip=new THREE.Group(); hip.position.set(side*0.12,0,0); pelvis.add(hip);
bx(U.pants,0.16,LEG_L1,0.16,0,-LEG_L1/2,0,hip);
const knee=new THREE.Group(); knee.position.y=-LEG_L1; hip.add(knee);
bx(U.pants,0.14,LEG_L2,0.14,0,-LEG_L2/2,0,knee);
bx(new THREE.MeshLambertMaterial({color:0x2e2820,map:TEX.cloth}),0.15,0.1,0.24,0,-LEG_L2+0.02,0.04,knee); // B8/P3-12 军靴 (鞋底 = 踝下 0.03)
return {hip,knee};
};
const legL=mkLeg(-1), legR=mkLeg(1);
const gunG=new THREE.Group(); gunG.position.set(GUN_MOUNT.x,GUN_MOUNT.y,GUN_MOUNT.z); gunG.rotation.order='YXZ'; torsoG.add(gunG);
bx(team===0?U.pants:U.coat,0.3,0.34,0.14, 0,0.3,-0.18, torsoG);
bx(new THREE.MeshLambertMaterial({color:0x3a3428,map:TEX.cloth}),0.4,0.08,0.28, 0,0.02,0, torsoG); // B8/P3-12 装具/背包带
// 步兵战术手电筒 (右胸挂载, 指向前方)
const flGrp=new THREE.Group();
flGrp.position.set(0.12,0.34,0.16);
bx(new THREE.MeshLambertMaterial({color:0x262624}),0.04,0.04,0.10, 0,0,0, flGrp);
const flGlow=(typeof _nightGlowSprite==='function')?_nightGlowSprite('rgba(255,250,225,1)','rgba(255,230,160,0.6)',0.45):null;
if(flGlow){ flGlow.position.set(0,0,0.05); flGrp.add(flGlow); }
const flCone=new THREE.Mesh(_soldierFlGeo,_soldierFlMat);
flCone.rotation.x=-HPI;
flCone.position.set(0,0,_soldierFlBaseL*0.5);
flGrp.add(flCone);
flGrp.flCone=flCone; flGrp.baseL=_soldierFlBaseL;
flGrp.visible=false;
torsoG.add(flGrp);
root.traverse(o=>{ if(o.isMesh){ o.castShadow=true; } });
const c=document.createElement('canvas'); c.width=128; c.height=32;
const g2=c.getContext('2d');
g2.font='bold 20px sans-serif'; g2.textAlign='center';
g2.fillStyle=team===0?'#a8ccff':'#ffb3a6';
g2.strokeStyle='rgba(0,0,0,.8)'; g2.lineWidth=4;
g2.strokeText(name,64,22); g2.fillText(name,64,22);
const tag=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthTest:false}));
tag.scale.set(0.9,0.22,1); tag.position.y=2.05; tag.renderOrder=5;
root.add(tag);
scene.add(root);
return {root,pelvis,torsoG,headG,armL,armR,legL,legR,gunG,tag,flGrp};
}
