// ─────────────────────────────────────────────
// dev/verify-corpsegravity-20261125.js —— 2026-11-25 实机两症状批②:
//   ① 死亡动画"就地倒下"时, 空中死亡的尸体无视重力悬浮 (Bot/玩家/丧尸三路)
//   ② 倒下动画不自然 —— 原 (t/0.6) 线性, 起步快末段慢, 不符合重力加速度
// 用法: node dev/verify-corpsegravity-20261125.js [--neg]
// 判据:
//   T0 源码锚: 三路 13m/s² 坠落积分行 + (t/0.6)² 加速度曲线 + 跨命/跨局清零
//   T1 Bot 空中死亡: 半空 die → 逐帧 update → y 单调降到 standHeight, x/z 不变, 落地后不沉
//   T2 玩家空中死亡: 半空 deathRag=null → 逐帧 playerAvatarDeath → y 单调降到 standHeight, x/z 不变
//   T3 加速度曲线: Bot 倒地角早期慢/后期快 (k² 判据), 且竖直坠落也是早期慢后期快
//   T4 丧尸空中死亡: 半空 die → update → y 单调降到 standHeight
//   --neg: N1 拆 Bot 重力行 → T1/T3 红; N2 拆玩家重力行 → T2 红
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const stub=require('./_bootstub.js');
require('./_bootpatch.js').patch(stub.sandbox);
{const P=Object.getPrototypeOf(stub.THREE.Group.prototype); if(!P.clear) P.clear=function(){ this.children.length=0; };}
const _ensureStyle=e=>{ if(e&&e.style&&!e.style.setProperty) e.style.setProperty=(k,v)=>{ e.style[k]=v; }; return e; };
{const doc=stub.document,og=doc.getElementById.bind(doc),oc=doc.createElement.bind(doc);
doc.getElementById=id=>_ensureStyle(og(id));
doc.createElement=t=>_ensureStyle(oc(t));}
const CANNON=(()=>{
const V3=stub.THREE.Vector3;
class Quat{constructor(){this.x=0;this.y=0;this.z=0;this.w=1;}set(){return this;}setFromEuler(){return this;}copy(){return this;}}
return {
Vec3:V3,Quaternion:Quat,
World:class{constructor(){this.gravity=new V3();this.broadphase=null;this.solver={iterations:0};this.bodies=[];}addBody(b){this.bodies.push(b);}removeBody(b){const i=this.bodies.indexOf(b);if(i>=0)this.bodies.splice(i,1);}add(b){this.addBody(b);}remove(b){this.removeBody(b);}addConstraint(){}removeConstraint(){}step(){}},
Body:class{constructor(o){Object.assign(this,o||{});this.shapes=[];this.position=new V3();this.velocity=new V3();this.quaternion=new Quat();this.angularDamping=0;this.linearDamping=0;}addShape(s){this.shapes.push(s);}},
Box:class{},Sphere:class{},Material:class{},ContactMaterial:class{},NaiveBroadphase:class{},PointToPointConstraint:class{},
};})();

const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const FILES=[...html.matchAll(/src="(js\/[^"?]+)/g)].map(m=>m[1]);

// ── NEG 阴性对照: 两补丁 ──
const NEG=process.argv.includes('--neg');
const SRC={},PATCH_MAP={};
const NEG_PATCHES=[
// N1 Bot 重力行拆: 去掉竖直积分 (只留 k² 曲线) ⇒ T1/T3 坠落判据红
['js/14-bots.js','this._deathVy-=13*dt;','this._deathVy-=0*dt;'],
// N2 玩家重力行拆 ⇒ T2 红
['js/20-player.js','p._deathVy-=13*dt;','p._deathVy-=0*dt;'],
];
if(NEG) for(const [f,from,to] of NEG_PATCHES){
if(SRC[f]===undefined) SRC[f]=fs.readFileSync(path.join(root,f),'utf8');
if(SRC[f].indexOf(from)<0){ console.log('✗ NEG 锚缺失: '+f+' :: '+JSON.stringify(from.slice(0,60))); process.exit(1); }
PATCH_MAP[f]=(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC[f]).split(from).join(to);
}
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:fs.readFileSync(path.join(root,f),'utf8'));

function boot(campIdx){
for(const k in stub.byId)delete stub.byId[k];
const ctx=vm.createContext(Object.assign({},stub.sandbox));
ctx.document=stub.document; ctx.window=stub.window; ctx.CANNON=CANNON;
ctx.localStorage={_s:{sf_campaign:String(campIdx),sf_deathfx:'1'},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of FILES) vm.runInContext(srcOf(f),ctx,{filename:f});
return ctx;
}
const PASS=[];let FAILN=0;
function ok(cond,label){
if(cond){ PASS.push(label); console.log('  ✔ '+label); }
else { FAILN++; console.log((NEG?'  ● [期望红] ':'  ✘ ')+label); }
}
let IDXS=1; { const c0=boot(0); IDXS=vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="stalingrad")',c0); }
const ctx=boot(IDXS);
const G=s=>vm.runInContext(s,ctx);
let err0=null;
try{ G("document.getElementById('startBtn').onclick();"); }catch(e){ err0=String(e&&e.stack||e); }
if(!err0){ try{ G('if(!player.alive||!player.deployed) deployPlayer();'); }catch(e){ err0='deployPlayer: '+String(e&&e.stack||e); } }
if(err0||!G('player.alive')){ console.log('  ✘ 开局/部署失败 '+(err0||'player.alive=false')); process.exit(1); }
ok(html.includes("__sfStyleVer='20261128c'"),'前置: 版本戳 20261128c 在位 (index.html 内联)');

// ══ T0 源码锚 ══
console.log('T0 源码锚');
const src14=srcOf('js/14-bots.js'),src20=srcOf('js/20-player.js'),src25=srcOf('js/25-zombies.js');
const src23=srcOf('js/23-deploy.js'),src22=srcOf('js/22-hud.js');
ok(src14.includes('this._deathVy-=13*dt;')&&src14.includes('this.pos.y=Math.max(gh,this.pos.y+this._deathVy*dt);'),'T0a ★Bot 13m/s² 坠落积分行 verbatim');
ok(src14.includes('const k=k0*k0;'),'T0b ★Bot 姿态 (t/0.6)² 加速度曲线');
ok(src20.includes('p._deathVy-=13*dt;')&&src20.includes('p.pos.y=Math.max(gh,p.pos.y+p._deathVy*dt);'),'T0c ★玩家 13m/s² 坠落积分行 verbatim');
ok(src20.includes('const k0=clamp(p._deathT/0.6,0,1), k=k0*k0;'),'T0d ★玩家 (t/0.6)² 加速度曲线 + 首帧姿态快照');
ok(src25.includes('this._deathVy-=13*dt;')&&src25.includes('const k=k0*k0;'),'T0e ★丧尸坠落积分 + 加速度曲线');
ok(src23.includes('p._deathVy=undefined; p._deathT=undefined; p._dfPose=null;'),'T0f ★玩家跨命清零');
ok(src14.includes('this._deathVy=undefined;')&&src25.includes('sol._deathVy=undefined;'),'T0g ★Bot/丧尸跨命/跨态清零');

// ══ T1 Bot 空中死亡坠落 ══
console.log('T1 Bot 空中死亡: 半空 die → y 降到 standHeight, x/z 不变, 落地不沉');
G('__g1={};');
G(`(()=>{
const s=soldiers.find(x=>x&&!x.onVehicle&&!x.ragdolled)||soldiers[0];
if(!s){ __g1.err='无士兵'; return; }
const gx=10,gz=10, gy=standHeight(gx,gz);
s.pos.set(gx,gy+24,gz); s.vel.set(0,0,0); s.onVehicle=null; s.ragdolled=false;
s.crouch=false; s.prone=false; s.mesh.root.position.set(gx,gy+24,gz);
s.die(null);
__g1.deadY=s.pos.y; __g1.gy=gy;
__g1.trace=[];
for(let i=0;i<40;i++){ s.update(0.05); __g1.trace.push(+s.pos.y.toFixed(3)); }
__g1.finalY=s.pos.y; __g1.finalX=s.pos.x; __g1.finalZ=s.pos.z;
__g1.meshY=s.mesh.root.position.y;
})()`);
if(G('!!__g1.err')){ ok(false,'T1-prep 失败 '+G('__g1.err')); }
else{
const startY=G('__g1.deadY'), gy=G('__g1.gy'), finalY=G('__g1.finalY');
ok(finalY<=gy+0.05&&finalY>=gy-0.05,`T1a ★落地钳在 standHeight: 死高 ${startY.toFixed(1)} → 终高 ${finalY.toFixed(2)} vs 地面 ${gy.toFixed(2)}`);
ok(G('Math.abs(__g1.finalX-10)<0.01')&&G('Math.abs(__g1.finalZ-10)<0.01'),'T1b ★x/z 钉死亡点 (水平不漂移)');
// 单调下降: 相邻帧不回升, 且落地后不再下沉
const trace=G('__g1.trace');
let mono=true; for(let i=1;i<trace.length;i++) if(trace[i]>trace[i-1]+1e-6) mono=false;
ok(mono,'T1c ★坠落全程单调不回升');
const tail=trace.slice(-3); let settled=true; for(const y of tail) if(Math.abs(y-finalY)>0.02) settled=false;
ok(settled,'T1d ★落地后不再下沉 (末 3 帧稳定)');
}

// ══ T2 玩家空中死亡坠落 ══
console.log('T2 玩家空中死亡: 半空 deathRag=null → y 降到 standHeight, x/z 不变');
G('__g2={};');
G(`(()=>{
const p=player, av=playerAvatarEnsure();
if(!av){ __g2.err='无 avatar'; return; }
p.deathRag=null; p.alive=false;   // 走 playerAvatarDeath 死亡分支
const gx=-20,gz=-20, gy=standHeight(gx,gz);
p.pos.set(gx,gy+24,gz); p.vel.set(0,0,0);
p._deathVy=undefined; p._deathT=undefined; p._dfPose=null;
__g2.gy=gy; __g2.deadY=p.pos.y;
__g2.trace=[];
for(let i=0;i<40;i++){ updatePlayerAvatar(0.05); __g2.trace.push(+p.pos.y.toFixed(3)); }
__g2.finalY=p.pos.y; __g2.finalX=p.pos.x; __g2.finalZ=p.pos.z;
})()`);
if(G('!!__g2.err')){ ok(false,'T2-prep 失败 '+G('__g2.err')); }
else{
const gy=G('__g2.gy'), finalY=G('__g2.finalY'), deadY=G('__g2.deadY');
ok(finalY<=gy+0.05&&finalY>=gy-0.05,`T2a ★玩家落地钳在 standHeight: 死高 ${deadY.toFixed(1)} → 终高 ${finalY.toFixed(2)} vs 地面 ${gy.toFixed(2)}`);
ok(G('Math.abs(__g2.finalX+20)<0.01')&&G('Math.abs(__g2.finalZ+20)<0.01'),'T2b ★玩家 x/z 钉死亡点');
const trace=G('__g2.trace'); let mono=true; for(let i=1;i<trace.length;i++) if(trace[i]>trace[i-1]+1e-6) mono=false;
ok(mono,'T2c ★玩家坠落全程单调不回升');
const tail=trace.slice(-3); let settled=true; for(const y of tail) if(Math.abs(y-finalY)>0.02) settled=false;
ok(settled,'T2d ★玩家落地后不再下沉');
}

// ══ T3 加速度曲线 (重力感) ══
console.log('T3 加速度曲线: 倒地角早期慢/后期快, 竖直坠落早期慢/后期快');
G('__g3={};');
G(`(()=>{
const s=soldiers.find(x=>x&&!x.onVehicle&&!x.ragdolled)||soldiers[0];
const gx=30,gz=30, gy=standHeight(gx,gz);
s.pos.set(gx,gy+40,gz); s.vel.set(0,0,0); s.onVehicle=null; s.ragdolled=false;
s.crouch=false; s.prone=false; s.mesh.root.position.set(gx,gy+40,gz);
s.deathDir=1; s._deathVy=undefined;
s.die(null); s.deathDir=1;
__g3.dy=[]; __g3.drot=[];
let py=s.pos.y, pr=0;
for(let i=0;i<12;i++){ s.update(0.05);
 __g3.dy.push(+(py-s.pos.y).toFixed(4)); py=s.pos.y;
 const r=Math.abs(s.mesh.root.rotation.x); __g3.drot.push(+(r-pr).toFixed(4)); pr=r;
}
})()`);
{
const dy=G('__g3.dy'), drot=G('__g3.drot');
// 竖直: 前段增量 < 后段增量 (加速)。用第2帧 vs 第8帧比较, 排除首帧初值抖动
const earlyDy=dy[1], lateDy=dy[7];
ok(lateDy>earlyDy*1.5,`T3a ★竖直坠落加速: 前期 ${earlyDy} → 后期 ${lateDy} (后期更快 ≥1.5×)`);
// 倒地角: 前段增量 < 后段增量 (k² 加速度)
const earlyRot=drot[1], lateRot=drot[7];
ok(lateRot>earlyRot*1.4&&earlyRot>0,`T3b ★倒地角加速: 前期 ${earlyRot} → 后期 ${lateRot} (重力感, 线性档两者近似相等)`);
}

// ══ T4 丧尸空中死亡坠落 ══
console.log('T4 丧尸空中死亡: 半空 die → y 降到 standHeight');
G('__g4={};');
G(`(()=>{
if(typeof Zombie!=='function'){ __g4.err='无 Zombie 构造'; return; }
if(!uniformMats[2]) uniformMats[2]=uniformMats[1];   // 沙箱非丧尸模式未初始化 ZTEAM 资源, 补挂供构造
if(!TEAM_FACTION[2]) TEAM_FACTION[2]=TEAM_FACTION[1];
const z=new Zombie(40,40,'walker');
if(!z||!z.pos||!z.mesh){ __g4.err='Zombie 构造异常'; return; }
const gy=standHeight(40,40);
z.pos.set(40,gy+18,40); z.vel.set(0,0,0);
z.die(null);
__g4.gy=gy; __g4.deadY=z.pos.y;
for(let i=0;i<40;i++) z.update(0.05);
__g4.finalY=z.pos.y; __g4.finalX=z.pos.x; __g4.finalZ=z.pos.z;
})()`);
if(G('!!__g4.err')){ ok(false,'T4-prep 失败 '+G('__g4.err')); }
else{
const gy=G('__g4.gy'), finalY=G('__g4.finalY'), deadY=G('__g4.deadY');
ok(finalY<=gy+0.05&&finalY>=gy-0.05,`T4a ★丧尸落地钳在 standHeight: 死高 ${deadY.toFixed(1)} → 终高 ${finalY.toFixed(2)} vs 地面 ${gy.toFixed(2)}`);
ok(G('Math.abs(__g4.finalX-40)<0.01')&&G('Math.abs(__g4.finalZ-40)<0.01'),'T4b ★丧尸 x/z 钉死亡点');
}

console.log('');
console.log('verify-corpsegravity-20261125: PASS='+PASS.length+' FAIL='+FAILN+(NEG?' (--neg)':''));
if(NEG){
console.log('[阴性对照] 期望红 ≥4 项 (N1→T1/T3, N2→T2)');
process.exitCode=FAILN>0?0:1;
}else if(FAILN>0) process.exit(1);
