// 调参台 (一次性, 不入册): 真 cannon 复刻 12-ragdolls spawnRagdoll 装配 + updateRagdolls 地面支撑,
// 量化普通档/全锁档(v2)/软限位档(v3) 的关节弯折角, 给"加固的度"选参数。
// 复刻源: mkPart 几何/质量/阻尼, P2P 主锚表 (cons=[...]), secP 副锚 (父子同减 (0,d,0)),
// 初始冲量 (attacker 档), updateRagdolls 平地支撑 (浅层速度式/深层限幅), 无碰撞 (filterGroup 0)。
'use strict';
const path=require('path');
const C=require(path.join(__dirname,'..','lib','cannon.min.js'));

const GY=-11, DT=1/60, T=3.0, ITERS=5;
// 部件表: [名, 半宽x, 半高y, 半深z, 质量, hy=min(sy,sz), 站位y(相对脚底), 锚点]
const H=0.97;
const PARTS={
pelvis:{hx:0.2,hy:0.13,hz:0.12,m:6,at:[0,H,0]},
torso:{hx:0.22,hy:0.25,hz:0.13,m:9,at:[0,H+0.39,0]},
head:{hx:0.1,hy:0.11,hz:0.1,m:2.5,at:[0,H+0.79,0]},
armL:{hx:0.06,hy:0.28,hz:0.06,m:2,at:[-0.31,H+0.35,0]},
armR:{hx:0.06,hy:0.28,hz:0.06,m:2,at:[0.31,H+0.35,0]},
legL:{hx:0.075,hy:0.45,hz:0.075,m:4,at:[-0.12,H-0.47,0]},
legR:{hx:0.075,hy:0.45,hz:0.075,m:4,at:[0.12,H-0.47,0]},
};
const JOINTS=[ // [child, parent, 主锚child, 主锚parent]
['torso','pelvis',[0,-0.26,0],[0,0.13,0]],
['head','torso',[0,-0.13,0],[0,0.27,0]],
['armL','torso',[0,0.24,0],[-0.31,0.2,0]],
['armR','torso',[0,0.24,0],[0.31,0.2,0]],
['legL','pelvis',[0,0.47,0],[-0.12,0,0]],
['legR','pelvis',[0,0.47,0],[0.12,0,0]],
];
const SEC_D={spine:0.20,neck:0.10,arm:0.18,leg:0.24};   // v2 轴距
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

function build(cfg,rng){
const world=new C.World();
world.gravity.set(0,GY,0);
world.broadphase=new C.NaiveBroadphase();
world.solver.iterations=ITERS;
const bodies={};
for(const k in PARTS){
const p=PARTS[k];
const b=new C.Body({mass:p.m,collisionFilterGroup:0,collisionFilterMask:0});
b.addShape(new C.Box(new C.Vec3(p.hx,p.hy,p.hz)));
b.position.set(p.at[0],p.at[1],p.at[2]);
b.quaternion.setFromEuler(0,0,0,'YXZ');
b.angularDamping=0.4; b.linearDamping=0.08;
world.addBody(b); bodies[k]=b;
}
const V3=(x,y,z)=>new C.Vec3(x,y,z);
const P2P=(A,pa,B,pb,mf)=>{
const c=new C.PointToPointConstraint(A,V3(pa[0],pa[1],pa[2]),B,V3(pb[0],pb[1],pb[2]),mf);
world.addConstraint(c); return c;
};
const cons=[];
for(const [ch,pa,ac,ap] of JOINTS) cons.push(P2P(bodies[ch],ac,bodies[pa],ap));   // 主锚: 默认 1e6
const secD=cfg.secD, secMF=cfg.secMF;
if(secD){
// secP: 父子主锚同减 (0,d,0); 关节类别 = child 名映射
const cls=k=>k==='torso'?'spine':(k==='head'?'neck':(k[0]==='a'?'arm':'leg'));
for(const [ch,pa,ac,ap] of JOINTS){
const d=secD[cls(ch)];
cons.push(P2P(bodies[ch],[ac[0],ac[1]-d,ac[2]],bodies[pa],[ap[0],ap[1]-d,ap[2]],secMF));
}
}
// 死亡冲量 (attacker 档): 攻击者在 +x 8m 外
const ix=1,iz=0;
for(const k in bodies){
const imp=2.8+rng()*2.7, mult=0.7+rng()*0.6;
bodies[k].velocity.set(0.6*rng()*2+ix*imp*mult,0.5+rng()*3.0,0.6*rng()*2+iz*imp*mult);
bodies[k].angularVelocity.set((rng()*10-5),(rng()*8-4),(rng()*10-5));
}
return {world,bodies};
}
// updateRagdolls 平地支撑复刻 (gh=0, rgL=1)
function groundStep(bodies){
for(const k in bodies){
const b=bodies[k];
const hy2=Math.min(PARTS[k].hy,PARTS[k].hz);
const pen=hy2-b.position.y;
if(pen>0){
if(pen>0.1){ b.position.y+=Math.min(pen,0.06); if(b.velocity.y<0) b.velocity.y*=-0.25; }
else{ b.velocity.y=b.velocity.y*0.85+Math.min(pen*240,45)*DT; }
b.velocity.x*=0.6; b.velocity.z*=0.6;
b.angularVelocity.x*=0.78; b.angularVelocity.y*=0.78; b.angularVelocity.z*=0.78;
}
}
}
const upDir=b=>{ const v=new C.Vec3(0,1,0); b.quaternion.vmult(v,v); return v; };
const bendDeg=(ch,pa)=>{ const a=upDir(ch),b=upDir(pa); const d=Math.max(-1,Math.min(1,a.x*b.x+a.y*b.y+a.z*b.z)); return Math.acos(d)*180/Math.PI; };

function run(cfg,seed){
const rng=mulberry(seed);
const {world,bodies}=build(cfg,rng);
const maxBend={}, setSum={}, setN=0;
for(const [ch,pa] of JOINTS){ maxBend[ch]=0; }
let travel=0; const p0={x:bodies.pelvis.position.x,z:bodies.pelvis.position.z};
let t=0;
while(t<T){
world.step(DT);
groundStep(bodies);
for(const [ch,pa] of JOINTS){ const g=bendDeg(bodies[ch],bodies[pa]); if(g>maxBend[ch]) maxBend[ch]=g; }
t+=DT;
}
travel=Math.hypot(bodies.pelvis.position.x-p0.x,bodies.pelvis.position.z-p0.z);
const settled={};
for(const [ch,pa] of JOINTS) settled[ch]=bendDeg(bodies[ch],bodies[pa]);
return {maxBend,settled,travel};
}

const CONFIGS={
'普通(6主锚)': {secD:null},
'v2全锁(d满×1e6)': {secD:SEC_D,secMF:1e6},
'v3a d满×300': {secD:SEC_D,secMF:300},
'v3b d半×300': {secD:{spine:0.10,neck:0.05,arm:0.09,leg:0.12},secMF:300},
'v3c d半×600': {secD:{spine:0.10,neck:0.05,arm:0.09,leg:0.12},secMF:600},
'v3d d半×1200': {secD:{spine:0.10,neck:0.05,arm:0.09,leg:0.12},secMF:1200},
'v3e d短×300': {secD:{spine:0.06,neck:0.03,arm:0.05,leg:0.07},secMF:300},
};
const SEEDS=[11,23,37,51,66,79,90,104];
const NAMES=Object.keys(CONFIGS);
console.log('关节: spine(躯干↔骨盆) neck(头) armL/armR legL/legR — maxBend=3s 内最大弯折角(度), settled=落定角, travel=骨盆水平位移(m)');
for(const name of NAMES){
const agg={};
for(const [ch] of JOINTS) agg[ch]={mx:0,set:0};
let trav=0;
for(const s of SEEDS){
const r=run(CONFIGS[name],s);
for(const [ch] of JOINTS){ agg[ch].mx=Math.max(agg[ch].mx,r.maxBend[ch]); agg[ch].set+=r.settled[ch]; }
trav+=r.travel;
}
const fmt=Object.keys(agg).map(ch=>ch+': max '+agg[ch].mx.toFixed(0)+'°/set '+(agg[ch].set/SEEDS.length).toFixed(0)+'°').join(' | ');
console.log('\n['+name+']  travel(avg)='+ (trav/SEEDS.length).toFixed(2)+'m');
console.log('  '+fmt);
}
