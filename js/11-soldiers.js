// ─────────────────────────────────────────────
// 11-soldiers.js —— 士兵网格/世界枪械模型
// 源: Index.original.html 第 3879-4034 行
// ─────────────────────────────────────────────
'use strict';
const _fwd=V3(), _rgt=V3(), _upv=V3(0,1,0);
function camForward(){ camera.getWorldDirection(_fwd); return _fwd.clone(); }
function camRight(){ camera.getWorldDirection(_fwd); _rgt.crossVectors(_fwd,_upv).normalize(); return _rgt.clone(); }
const soldiers=[];
const combatants=[];
let gunEvents=[];
function angleLerpTo(cur,tgt,maxStep){
let d=tgt-cur;
while(d>Math.PI)d-=TAU; while(d<-Math.PI)d+=TAU;
return cur+clamp(d,-maxStep,maxStep);
}
function angDiff(a,b){ let d=b-a; while(d>Math.PI)d-=TAU; while(d<-Math.PI)d+=TAU; return d; }
const uniformMats=[0,1].map(t=>{
const F=TEAM_FACTION[t];
return {
coat:new THREE.MeshLambertMaterial({color:F.coat, map:TEX.cloth}), pants:new THREE.MeshLambertMaterial({color:F.pants, map:TEX.cloth}),
helm:new THREE.MeshLambertMaterial({color:F.helm, map:TEX.cloth}), skin:new THREE.MeshLambertMaterial({color:F.skin}),
};
});
function worldGunModel(kind,team,key){
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
} else {
bx(wd,0.05,0.07,0.75,0,0,-0.05,g);
cyl(gm,0.012,0.012,0.3,0,0.02,-0.55,g);
bx(wd,0.05,0.09,0.2,0,-0.05,0.32,g);
}
g.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
return g;
}
function gunKindOf(key){
let d=WPN_DEFS[key];
if(d.model){ key=d.model; d=WPN_DEFS[key]; }
if(d.rocket) return 'launcher';
if(d.mortar) return 'mortar';
if(d.atRifle) return 'atr';
if(d.pistol) return 'smg';
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
default:{x:-0.24,dy:0.10,dz:0.545},
};
// 站↔趴的过渡按**当前**骨盆俯角平滑混合 (站 0.05 / 蹲 0.14 / 疾跑 0.30 / 趴 1.50):
// 硬切换会在站→趴的 0.4s 里让枪瞬移半米; 骨盆俯角本身就是 dampF 过的, 用同一个量做插值权即连续。
const GUN_MOUNT_BLEND0=0.40, GUN_MOUNT_BLEND1=1.30;
function gunMountOf(kind,pp){
const k=kind||'rifle';
const st=GUN_MOUNT_BY_KIND[k]||GUN_MOUNT_BY_KIND.default;
const p=pp||0;
if(p<=GUN_MOUNT_BLEND0) return st;            // 站/蹲/疾跑: 原值, 逐位不变
const pr=GUN_MOUNT_PRONE[k]||GUN_MOUNT_PRONE.default;
let kk=clamp((p-GUN_MOUNT_BLEND0)/(GUN_MOUNT_BLEND1-GUN_MOUNT_BLEND0),0,1);
kk=kk*kk*(3-2*kk);
const c=Math.cos(p), s=Math.sin(p);
const ly=pr.dy*c+pr.dz*s, lz=-pr.dy*s+pr.dz*c;
return {x:st.x+(pr.x-st.x)*kk, y:st.y+(ly-st.y)*kk, z:st.z+(lz-st.z)*kk};
}
const ARM_SIDE={R:-1,L:1};                 // mkArm 的 side 参数: 右=-1 (-X) / 左=+1 (+X)
// 枪模在 gunG 内的前推量 (单源): 长武器不给前推量时枪托/管尾会落进躯干 —— 火箭筒管长 1.5、AT 步枪 0.85 尤其明显。
// launcher 0.20→0.30 (2026-09-21 A#2 扛肩式收尾, 实测取证): 扛肩挂点下 0.20 时匍匐姿态筒尾仍压进头/颈盒 0.012m,
// 0.30 时四姿态头/颈盒 0 组、躯干仅"抵肩接触" 0.034m(肩窝距 0.136 ≤0.30) —— 见 dev/out/tmp-infantry-gunmount-sweep.txt。
const CARRIED_FWD={rifle:0.30,smg:0.30,mg:0.30,atr:0.24,launcher:0.30,mortar:0.30};
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
function _eulerXYZ(p,rx,ry,rz){ // 躯干局部 = Rx·Ry·Rz·gunG局部 (与 three 的 Euler 'XYZ' 同序; 纯算术)
if(!rx&&!ry&&!rz) return {x:p.x,y:p.y,z:p.z};
const a=Math.cos(rx||0), b=Math.sin(rx||0), c=Math.cos(ry||0), d=Math.sin(ry||0), e=Math.cos(rz||0), f=Math.sin(rz||0);
const m00=c*e, m01=-c*f, m02=d;
const m10=a*f+b*e*d, m11=a*e-b*f*d, m12=-b*c;
const m20=b*f-a*e*d, m21=b*e+a*f*d, m22=a*c;
return {x:m00*p.x+m01*p.y+m02*p.z, y:m10*p.x+m11*p.y+m12*p.z, z:m20*p.x+m21*p.y+m22*p.z};
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
function gunCarryOffset(kind){
const k=kind||'rifle';
const fwd=(CARRIED_FWD[k]!==undefined)?CARRIED_FWD[k]:CARRIED_FWD.rifle;
return {x:0,y:-0.02,z:fwd};
}
function _gunAnchorTorso(kind,which,rx,ry,rz,pp){
const st=gunGeomStations(kind), a=(which==='fore')?st.fore:st.grip, co=gunCarryOffset(kind);
// 模型空间 → gunG 局部: mountGunModel 把模型 rotation.y=PI (x→-x, z→-z) 并加 carryOffset
const p=_eulerXYZ({x:-a.x+co.x, y:a.y+co.y, z:-a.z+co.z}, rx, ry, rz);
const mo=gunMountOf(kind,pp);   // 挂点按枪种取 (扛肩式火箭筒挂点不同) + 按躯干俯角取 (趴姿挂点不同, A1)
return {x:mo.x+p.x, y:mo.y+p.y, z:mo.z+p.z};
}
function gunGripPoint(kind,rx,ry,rz,pp){ return _gunAnchorTorso(kind,'grip',rx,ry,rz,pp); }   // 握把点 (躯干局部系)
function gunForePoint(kind,rx,ry,rz,pp){ return _gunAnchorTorso(kind,'fore',rx,ry,rz,pp); }   // 护木点 (躯干局部系)
// 可达性辅助 (调用方用): 把"沿枪身轴从握把到护木的某点"作为 IK 目标, 使左/右手**永远落在枪上**。
//   t=0 → 握把, t=1 → 护木; 返回躯干局部点。护木点超臂长时调用方可取可达的 t (见 20-player 的左臂处理)。
function gunAxisPoint(kind,t,rx,ry,rz,pp){
const k=kind||'rifle';
const gp=_gunAnchorTorso(k,'grip',rx,ry,rz,pp), fp=_gunAnchorTorso(k,'fore',rx,ry,rz,pp);
const u=clamp(t,0,1);
return {x:gp.x+(fp.x-gp.x)*u, y:gp.y+(fp.y-gp.y)*u, z:gp.z+(fp.z-gp.z)*u};
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
//   脚**始终**落在目标高度, 与骨盆高度/前倾进度无关。kneeUp=true 用于趴姿 (膝朝上, 腿贴地不穿地)。
//   ★ 2026-09-26 (A2): 本函数从 14-bots 的 Bot.prototype.legIK 提到这里做**单源** —— 玩家第三人称
//   (20-player) 当时没跟这次反解改造, 两条路径各写一份 ⇒ 玩家长时间保持"修前"的穿地数值。
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
return kneeUp?{hip:hipW,knee:-bend}:{hip:hipW,knee:bend};
}
function buildSoldierMesh(team,name){
const U=uniformMats[team];
const root=new THREE.Group();
const pelvis=new THREE.Group(); pelvis.position.y=0.94; root.add(pelvis);
const torsoG=new THREE.Group(); pelvis.add(torsoG);
bx(U.coat,0.44,0.55,0.26, 0,0.28,0, torsoG);
const headG=new THREE.Group(); headG.position.set(0,0.62,0); torsoG.add(headG);
bx(U.skin,0.2,0.22,0.2, 0,0.1,0, headG);
// 阵营特色头盔/军帽
let helm;
const hs=TEAM_FACTION[team].helmet;
if(hs==='pot'){
helm=new THREE.Mesh(new THREE.SphereGeometry(0.15,10,8,0,TAU,0,HPI*1.2),U.helm);
helm.position.set(0,0.16,0);
headG.add(helm);
} else if(hs==='stahl'){
helm=new THREE.Mesh(new THREE.SphereGeometry(0.155,10,8,0,TAU,0,HPI*1.35),U.helm);
helm.position.set(0,0.15,0); helm.scale.z=1.15;
headG.add(helm);
// 国军M35: 正面青天白日徽
if(TEAM_FACTION[team].sym==='✷'){
bx(new THREE.MeshLambertMaterial({color:0x2050b0}),0.032,0.032,0.008, 0,0.17,0.148, headG);
bx(new THREE.MeshLambertMaterial({color:0xe8e8e8}),0.016,0.016,0.01, 0,0.17,0.15, headG);
}
} else if(hs==='ssh'){
helm=new THREE.Mesh(new THREE.SphereGeometry(0.152,10,8,0,TAU,0,HPI*1.28),U.helm);
helm.position.set(0,0.155,0); helm.scale.y=1.1;
headG.add(helm);
} else if(hs==='jp'){
helm=new THREE.Mesh(new THREE.SphereGeometry(0.142,10,8,0,TAU,0,HPI*1.22),U.helm);
helm.position.set(0,0.165,0);
headG.add(helm);
const brim=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.17,0.025,10),U.helm);
brim.position.set(0,0.1,0); headG.add(brim);
bx(new THREE.MeshLambertMaterial({color:0xd8b840}),0.02,0.024,0.008, 0,0.16,0.135, headG);
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
return {root,pelvis,torsoG,headG,armL,armR,legL,legR,gunG,tag};
}
