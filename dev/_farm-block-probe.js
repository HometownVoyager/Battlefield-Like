// ─────────────────────────────────────────────
// dev/_farm-block-probe.js —— 取证探针: 诺曼底"农田草丛阻拦迫击炮弹/火箭弹"真身 (不进 Index.html)
// 2026-09-28 阶段三 P1 平衡首轮 · 用户实报「迫击炮弹和反坦克兵火箭弹等会被诺曼底的农田草丛阻拦」
// 载入清单 = 游戏 index.html 实载 41 脚本全量 (D1 判据盲区教训, 见 probe-files-blindspot 记忆)。
// 方法: 真实世界构建 (normandy) 后,
//   A) 对每块大田: 从田缘向对缘按典型出膛高度打水平射线, 逐段自扫 BOXES/CYLS/地形, 分类首个阻挡者
//      (树篱 box.flora.kind='hedge' / 地形擦地 / 树干 cyl / 其他盒);
//   B) 真火箭: fireRocket → 逐帧 updateShells, 记录爆炸点与"距目标短了多少", 分类阻挡者;
//   C) 真迫击炮: deployMortar → emplMortarShell → 逐帧 updateNades, 记录引爆点/短路数/命中盒分类,
//      并记录全程对树篱顶 (2.2m) 的最小越障余量。
// 用法: node dev/_farm-block-probe.js
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const {sandbox,document,window}=require('./_bootstub.js');
require('./_bootpatch.js').patch(sandbox);
const _O3=sandbox.THREE.Object3D;
if(_O3&&_O3.prototype&&!_O3.prototype.clear) _O3.prototype.clear=function(){ if(this.children) this.children.length=0; return this; };
sandbox.confirm=()=>true;
const handlers={};
sandbox.addEventListener=(t,f)=>{ (handlers[t]=handlers[t]||[]).push(f); };
sandbox.removeEventListener=()=>{};
const FILES=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/19b-gamepad.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/22a-menuart.js','js/22b-speclayer.js','js/23-deploy.js','js/23b-worldrestore.js','js/24-main.js'];
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document; ctx.window=window; ctx.__evH=handlers;
const Quat=class{ constructor(){this.x=0;this.y=0;this.z=0;this.w=1;} set(x,y,z,w){this.x=x;this.y=y;this.z=z;this.w=w;return this;} setFromEuler(){return this;} setFromAxisAngle(){return this;} copy(q){Object.assign(this,q);return this;} mult(){return this;} normalize(){return this;} };
const CV3=sandbox.THREE.Vector3;
const CANNON_STUB={Vec3:CV3,Quaternion:Quat,
World:class{ constructor(){ this.gravity=new CV3(); this.broadphase=null; this.solver={iterations:0}; this.bodies=[]; } addBody(b){ this.bodies.push(b); } removeBody(b){ const i=this.bodies.indexOf(b); if(i>=0) this.bodies.splice(i,1); } add(b){ this.addBody(b); } remove(b){ this.removeBody(b); } addConstraint(){} removeConstraint(){} step(){} },
Body:class{ constructor(o){ Object.assign(this,o||{}); this.shapes=[]; this.position=new CV3(); this.velocity=new CV3(); this.angularVelocity=new CV3(); this.quaternion=new Quat(); } addShape(s){ this.shapes.push(s); } },
Box:class{}, Sphere:class{}, Material:class{}, ContactMaterial:class{}, NaiveBroadphase:class{}, PointToPointConstraint:class{}};
ctx.CANNON=CANNON_STUB;
ctx.localStorage={_s:{sf_campaign:'0',sf_exp:'0'},getItem(k){return (k in this._s)?this._s[k]:null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of FILES) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
try{ vm.runInContext(`document.getElementById('startBtn').onclick();`,ctx); }catch(e){ console.log('  开局异常: '+e); }
const R=x=>vm.runInContext(x,ctx);
const V3=(x,y,z)=>new CV3(x,y,z);

// ── 自扫: 沿 [o→d, maxD] 找首个阻挡者并分类 (与 raycastWorld 同构, 但保留命中对象以便分类) ──
// 返回 {t, kind:'hedge'|'ground'|'cyl'|'box', obj}
function scanRay(o,d,maxD){
let bestT=maxD, best=null;
for(const b of R('BOXES')){
const r=R(`rayBox`)(o,d,b,bestT);
if(r&&r.t<bestT){
bestT=r.t;
const fl=b.flora&&b.flora.kind?b.flora.kind:null;
best={t:r.t,kind:fl||'box',obj:fl?('hedge:'+fl):('box')};
}
}
for(const c of R('CYLS')){
const r=R(`rayCyl`)(o,d,c,bestT);
if(r&&r.t<bestT){ bestT=r.t; best={t:r.t,kind:'cyl',obj:'cyl(r'+c.r.toFixed(2)+',y0..y1 '+c.y0.toFixed(1)+'..'+c.y1.toFixed(1)+')'}; }
}
// 地形擦地 (同 raycastWorld: dir.y<0.35 才查, 1.8m 步进 + 二分)
if(d.y<0.35){
let t=0.5; const step=1.8;
while(t<bestT){
const x=o.x+d.x*t, y=o.y+d.y*t, z=o.z+d.z*t;
if(y<=R('heightAt')(x,z)){
let lo=t-step, hi=t;
for(let i=0;i<6;i++){ const m=(lo+hi)/2; (o.y+d.y*m<=R('heightAt')(o.x+d.x*m,o.z+d.z*m))?hi=m:lo=m; }
if(hi<bestT) best={t:hi,kind:'ground',obj:'terrain'};
break;
}
t+=step;
}
}
return best;
}
const fmtP=p=>'('+p.x.toFixed(1)+','+p.y.toFixed(1)+','+p.z.toFixed(1)+')';

console.log('══ 诺曼底农田阻拦取证 (dev/_farm-block-probe.js) ══');
// ── 世界普查 ──
{
const cf=R('CROP_FIELDS'), rf=R('RURAL_FIELDS');
const hedgeN=R('BOXES').filter(b=>b.flora&&b.flora.kind==='hedge').length;
console.log(`[普查] CROP_FIELDS=${cf.length} RURAL_FIELDS=${rf.length} BOXES=${R('BOXES').length} (其中树篱=${hedgeN}) CYLS=${R('CYLS').length}`);
for(const f of rf) console.log(`  田 ${f.t||'?'} x[${f.x0}..${f.x1}] z[${f.z0}..${f.z1}]`);
}

// ── A) 田块横向射线普查: 典型出膛高度, 首个阻挡者分类 ──
console.log('\n[A] 横穿田块射线: 各高度首个阻挡者 (距离=m, 分类)');
{
const fields=[
{x0:-4,z0:-66,x1:44,z1:-26,name:'麦田东'},
{x0:52,z0:48,x1:108,z1:92,name:'麦田东南'},
{x0:48,z0:-72,x1:104,z1:-40,name:'玉米地东'},
{x0:-102,z0:46,x1:-50,z1:96,name:'麦田西北'},
];
for(const f of fields){
const cx0=f.x0+3, cx1=f.x1-3, cz=(f.z0+f.z1)/2;
const gh0=R('heightAt')(cx0,cz), gh1=R('heightAt')(cx1,cz);
console.log(` 田[${f.name}] 西缘g=${gh0.toFixed(2)} 东缘g=${gh1.toFixed(2)} 跨距=${Math.abs(cx1-cx0).toFixed(0)}m`);
for(const h of [0.5,1.4,2.4,3.5]){
const o=V3(cx0,gh0+h,cz), d=V3(1,0,0);
const hit=scanRay(o,d,Math.abs(cx1-cx0)+30);
console.log(`   出膛高${h}m: `+(hit?`${hit.kind} @${hit.t.toFixed(1)}m ${hit.obj}`:'直穿无阻'));
}
}
}

// ── B) 真火箭: 田缘 → 60m 外目标 (模拟反坦克兵横穿农田打坦克) ──
console.log('\n[B] 真火箭 (fireRocket→updateShells): 田缘打 60m 外目标');
{
const mkShooter=()=>({team:0,isPlayer:false,pos:V3(0,0,0),lastFiredT:0,suppression:0,noticeThreat(){},damage(){},alive:true});
const origin=V3(-2,R('heightAt')(-2,-46)+1.4,-46);      // 麦田东西缘
const tx=58, tz=-46;                                     // 60m 外同纬度
const tank={pos:V3(tx,R('heightAt')(tx,tz),tz),alive:true,team:1,takeDmg(){this.hp=(this.hp===undefined?1000:this.hp)-1;}};
R('tanks').push(tank);
const sh=mkShooter();
R('fireRocket')(sh,origin.clone(),V3(tx-origin.x,0.6,tz-origin.z).normalize(),{atDmg:360},null);
let steps=0,last=null;
while(R('shells').length&&steps<600){
last=R('shells')[0].pos.clone();
R('updateShells')(0.016,0.016); steps++;
}
const hitTank=tank.hp!==undefined;
const short=Math.hypot(tx-last.x,tz-last.z);
const seg=scanRay(last.clone().add(V3(0,0.05,0)),V3(0.02,0,0).add(V3((tx-last.x),(tank.pos.y+1-last.y),(tz-last.z)).normalize()),3);
console.log(`  步数=${steps} 终点${fmtP(last)} 距目标短路=${short.toFixed(1)}m 打中坦克=${hitTank}`);
console.log(`  终点处阻挡者: ${seg?seg.kind+' '+seg.obj:'(终点=坦克命中/水面/过期)'}`);
R('tanks').splice(R('tanks').indexOf(tank),1);
}

// ── C) 真迫击炮: 田缘架炮 → 40/80/120m 目标 (更新 updateNades 到引爆) ──
console.log('\n[C] 真迫击炮 (deployMortar→emplMortarShell→updateNades): 田缘打纵深目标');
{
const owner={team:0,isPlayer:false,alive:true,mortarPlaced:false,onMortar:false,mortUse:false,onVehicle:false,onMG:false,onAT:false,onAA:false,pos:V3(0,0,0),noticeThreat(){},suppression:0};
let mx=-6,mz=-46;
for(let t=0;t<40&&R('occBlocked')(mx,mz);t++){ mx-=2; }    // 找一个 occBlocked=false 的架设点 (向田外退)
const ok=R('deployMortar')(owner,mx,mz,Math.PI/2);        // 炮口朝 +x (yaw 使 +Z 转向 +x)
console.log(`  架炮@(${mx},${mz}) ok=${ok} occBlocked=${R('occBlocked')(-6,-46)}`);
const mo=R('MORTARS')[R('MORTARS').length-1];
for(const dH of [40,80,120]){
const tx=mx+dH, tz=mz;
// 弹道顶点预估 (现公式: tof=clamp(dH/84,0.9,2.1), vy=0.5*g*tof ⇒ apex=vy²/2g)
const tof=Math.max(0.9,Math.min(2.1,dH/84)), vy=0.5*9.8*tof;
console.log(`  ── 目标${dH}m: 现公式弹道顶点≈${(vy*vy/19.6).toFixed(1)}m+炮口0.7m (树篱顶2.2m, 麦顶1.15m/玉米顶2.0m)`);
R('emplMortarShell')(mo,owner,tx,tz);
let steps=0,prev=null,lastPos=null,minHedgeClear=99;
while(R('nades').length&&steps<1200){
const n=R('nades')[R('nades').length-1];
const p=n.pos;
// 越障余量: 沿途若穿过树篱 x 区间, 记录弹高-篱顶最小差
prev=p.clone();
R('updateNades')(0.016,0.016); steps++;
if(!R('nades').length){ lastPos=prev; break; }
}
if(!lastPos) lastPos=R('nades').length?R('nades')[R('nades').length-1].pos.clone():null;
// 分类引爆点: 附近 0.5m 内有没有树篱盒 / 是否贴地
let cls='地面/引信';
if(lastPos){
const p=lastPos;
for(const b of R('BOXES')){
if(b.flora&&b.flora.kind==='hedge'&&p.x>b.minX-0.3&&p.x<b.maxX+0.3&&p.z>b.minZ-0.3&&p.z<b.maxZ+0.3&&p.y<b.maxY+0.3&&p.y>b.minY-0.3){ cls='树篱'; break; }
}
const gh=R('heightAt')(p.x,p.z);
if(p.y<gh+0.4) cls=cls==='树篱'?'树篱':'贴地(地形)';
}
const short=lastPos?Math.hypot(tx-lastPos.x,tz-lastPos.z).toFixed(1):'?';
console.log(`  目标${dH}m: 步数=${steps} 引爆点${lastPos?fmtP(lastPos):'?'} 短路=${short}m 分类=${cls}`);
// 清账: 移除本枚 (若还在)
while(R('nades').length){ const n=R('nades').pop(); if(n.m) R('scene').remove(n.m); }
}
}

console.log('\n[D] 地形剖面: 田块中线高度采样 (看是否有隐形起伏/凹地)');
{
for(const [x0,x1,z,name] of [[-4,44,-46,'麦田东'],[52,108,70,'麦田东南'],[48,104,-56,'玉米地东']]){
let prof=[],mn=99,mx=-99;
for(let x=x0;x<=x1;x+=6){ const g=R('heightAt')(x,z); prof.push(g.toFixed(1)); mn=Math.min(mn,g); mx=Math.max(mx,g); }
console.log(`  ${name}: min=${mn.toFixed(2)} max=${mx.toFixed(2)} 剖面[${prof.join(' ')}]`);
}
}
console.log('\n══ 取证完毕 ══');
