// ═══ 临时诊断 (不入册): 军刀三式 FP/3P 曲线真值测量 —— ★2026-11-20 三轮实机反馈批 (斩跨身扫/劈立刃) ═══
// 用法: node dev/_diag-melee-swing-tmp.js [--quiet]
//   逐帧驱动 FP 三式 (真 startMelee → updateViewModel) 与 3P 姿态机 (updatePlayerAvatar), 量:
//   FP: VM.root/gun 位姿 + handR 跟随 + 刀尖/宽面法线**视空间**合成轨迹 (root→sway→inner→gun 链式欧拉合成);
//   3P: gunG 三轴总角/挂点位移 + 右肩角。判据按三轮批合格线逐条 PASS/FAIL。
//   原始行 JSON 落 dev/out/_melee-swing-rows.json (刺式逐位 diff 用: 改曲线前后 fpThrust 必须逐字段相等)。
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
// --baseline: 两份 melee 文件改用 git HEAD 版本 (改前真值; 供刺式逐位 diff / 前后对照)
const BASELINE=process.argv.includes('--baseline');
const GIT_BASE={};
if(BASELINE){
const cp=require('child_process');
for(const f of ['js/10-viewmodel.js','js/20-player.js'])
GIT_BASE[f]=cp.execSync(`git show HEAD:${f}`,{encoding:'utf8',cwd:root});
}
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
Body:class{constructor(o){Object.assign(this,o||{});this.shapes=[];this.position=new V3();this.velocity=new V3();this.angularVelocity=new V3();this.quaternion=new Quat();this.angularDamping=0;this.linearDamping=0;}addShape(s){this.shapes.push(s);}},
Box:class{},Sphere:class{},Material:class{},ContactMaterial:class{},NaiveBroadphase:class{},PointToPointConstraint:class{},
};})();
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const FILES=[...html.matchAll(/src="(js\/[^"?]+)/g)].map(m=>m[1]);
const SRC=f=>GIT_BASE[f]!==undefined?GIT_BASE[f]:fs.readFileSync(path.join(root,f),'utf8');
const ctx=vm.createContext(Object.assign({},stub.sandbox));
ctx.document=stub.document; ctx.window=stub.window; ctx.CANNON=CANNON;
ctx.localStorage={_s:{sf_campaign:'3',sf_pseed:'424242'},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of FILES) vm.runInContext(SRC(f),ctx,{filename:f});
const G=s=>vm.runInContext(s,ctx);
G("document.getElementById('startBtn').onclick();");
G('if(!player.alive||!player.deployed) deployPlayer();');
G('for(const s of soldiers) s.protUntil=0; player.protUntil=0;');
G('function _vmIdle(){ for(var i=0;i<50;i++){ if(VM.state==="idle") break; updateViewModel(1/60,player); } }');
G('function _toSabre(){ _vmIdle(); if(player.curSlot!==2) switchSlot(2,true); _vmIdle(); }');

// ── 欧拉合成 (three.js 'XYZ' 语义: R=Rx·Ry·Rz, v'=Rx(Ry(Rz·v))) ──
function rotXYZ(e,v){
if(Array.isArray(e)) e={x:e[0],y:e[1],z:e[2]};
const cx=Math.cos(e.x),sx=Math.sin(e.x),cy=Math.cos(e.y),sy=Math.sin(e.y),cz=Math.cos(e.z),sz=Math.sin(e.z);
let x=v.x*cz - v.y*sz, y=v.x*sz + v.y*cz, z=v.z;          // Rz
const x2=x*cy + z*sy, z2=-x*sy + z*cy;                     // Ry
const y3=y*cx - z2*sx, z3=y*sx + z2*cx;                    // Rx
return {x:x2,y:y3,z:z3};
}
// FP 视空间合成链: root→sway→inner→gun (各层 'XYZ'), 加位置
function fpChain(o,local){
let p=rotXYZ(o.gr,local); p={x:p.x+o.gp[0],y:p.y+o.gp[1],z:p.z+o.gp[2]};
p=rotXYZ(o.ir,p); p={x:p.x+o.ip[0],y:p.y+o.ip[1],z:p.z+o.ip[2]};
p=rotXYZ(o.sr,p); p={x:p.x+o.sp[0],y:p.y+o.sp[1],z:p.z+o.sp[2]};
p=rotXYZ(o.rr,p); p={x:p.x+o.rp[0],y:p.y+o.rp[1],z:p.z+o.rp[2]};
return p;
}
// 方向量链 (只转不移) —— 刀轴俯角/宽面法线用
function fpDir(o,local){
let p=rotXYZ(o.gr,local);
p=rotXYZ(o.ir,p); p=rotXYZ(o.sr,p); p=rotXYZ(o.rr,p);
return p;
}
const TL={x:0,y:0.003,z:-0.65};        // FP 刀尖局部 (buildSabreBody: 刀尖收薄件到 -0.655)
const NL={x:0,y:1,z:0};                // 宽面法线局部 (+Y, 修5 后宽面朝 ±Y)

// ── FP 采样 (一式一跑, 沙箱内逐帧, 行带回节点侧合成) ──
function fpSample(kind,frames,dur){
G('_toSabre();');
G('player.meleeCd=0; _vmIdle();');
const idle=G('({rr:[VM.root.rotation.x,VM.root.rotation.y,VM.root.rotation.z],gr:[VM.gunParts.gun.rotation.x,VM.gunParts.gun.rotation.y,VM.gunParts.gun.rotation.z],gp:[VM.gunParts.gun.position.x,VM.gunParts.gun.position.y,VM.gunParts.gun.position.z],hp:[VM.arms.R.position.x,VM.arms.R.position.y,VM.arms.R.position.z],rp:[VM.root.position.x,VM.root.position.y,VM.root.position.z],sp:[VM.sway.position.x,VM.sway.position.y,VM.sway.position.z],sr:[VM.sway.rotation.x,VM.sway.rotation.y,VM.sway.rotation.z],ip:[VM.inner.position.x,VM.inner.position.y,VM.inner.position.z],ir:[VM.inner.rotation.x,VM.inner.rotation.y,VM.inner.rotation.z]})');
G(`startMelee('${kind}');`);
const rows=G(`(function(){
var rows=[]; var dur=${dur}, fr=${frames};
for(var i=1;i<=fr;i++){
updateViewModel(1/60,player); player.meleeCd=Math.max(0,player.meleeCd-1/60);
var r=VM.root, g=VM.gunParts.gun, h=VM.arms.R;
rows.push({st:VM.state, nt:i/(fr),
rr:[r.rotation.x,r.rotation.y,r.rotation.z],
gr:[g.rotation.x,g.rotation.y,g.rotation.z],
gp:[g.position.x,g.position.y,g.position.z],
hp:[h.position.x,h.position.y,h.position.z],
rp:[r.position.x,r.position.y,r.position.z],
sp:[VM.sway.position.x,VM.sway.position.y,VM.sway.position.z],
sr:[VM.sway.rotation.x,VM.sway.rotation.y,VM.sway.rotation.z],
ip:[VM.inner.position.x,VM.inner.position.y,VM.inner.position.z],
ir:[VM.inner.rotation.x,VM.inner.rotation.y,VM.inner.rotation.z]});
}
return rows; })()`);
// 节点侧合成: 刀尖/法线视空间 + 俯角 + 手跟随偏差
const R2=(r,v)=>rotXYZ({x:r[0],y:r[1],z:r[2]},v);
for(const r of rows){
const o={gr:r.gr,gp:r.gp,ir:r.ir,ip:r.ip,sr:r.sr,sp:r.sp,rr:r.rr,rp:r.rp};
const tip=fpChain(o,TL), org=fpChain(o,{x:0,y:0,z:0}), nrm=fpDir(o,NL);
r.tip=[+tip.x.toFixed(3),+tip.y.toFixed(3),+tip.z.toFixed(3)];
let dx=tip.x-org.x, dy=tip.y-org.y, dz=tip.z-org.z;
const hl=Math.hypot(dx,dy,dz)||1;
r.elev=+Math.asin(Math.max(-1,Math.min(1,dy/hl))).toFixed(3);             // 刀轴方向视空间俯仰 (asin(dir.y), 非位置向量)
r.faceZ=+(nrm.z/Math.hypot(nrm.x,nrm.y,nrm.z)).toFixed(2);                // 宽面法线视空间 z 分量 (|z|大=面朝/背镜头)
r.pitchGun=+(r.rr[0]+r.gr[0]).toFixed(3);                                 // 枪系总俯角 (root.rx+gun.rx, 三轮批口径)
let dh=0; for(let k=0;k<3;k++) dh+=Math.pow((r.hp[k]-idle.hp[k])-(r.gp[k]-idle.gp[k]),2);
r.handDev=+Math.sqrt(dh).toFixed(3);                                      // 手跟随握点偏差 (Δ手−Δ握)
}
return {idle,rows};
}

// ── 3P 采样 ──
function p3Sample(kind,frames,dur){
G('_toSabre();');
G('player.meleeCd=0; _vmIdle();');
G('var av=playerAvatarEnsure(); for(var i=0;i<30;i++) updatePlayerAvatar(1/60);');
const base=G('({gR:[av.gunG.rotation.x,av.gunG.rotation.y,av.gunG.rotation.z],gp:[av.gunG.position.x,av.gunG.position.y,av.gunG.position.z],shR:av.armR.sh.rotation.x})');
G(`player.meleeCd=0; startMelee('${kind}');`);
const rows=G(`(function(){
var rows=[]; var av=playerAvatarEnsure();
for(var i=1;i<=${frames};i++){
updateViewModel(1/60,player); player.meleeCd=Math.max(0,player.meleeCd-1/60); updatePlayerAvatar(1/60);
rows.push({nt:i/${frames}, meleeK:+((player.meleeT||0)/(player.meleeDur||${dur})).toFixed(3),
gR:[+av.gunG.rotation.x.toFixed(3),+av.gunG.rotation.y.toFixed(3),+av.gunG.rotation.z.toFixed(3)],
gp:[+av.gunG.position.x.toFixed(3),+av.gunG.position.y.toFixed(3),+av.gunG.position.z.toFixed(3)],
shR:+av.armR.sh.rotation.x.toFixed(3)});
}
return rows; })()`);
return {base,rows};
}

const QUIET=process.argv.includes('--quiet');
const out={};
let FAILN=0,PASSN=0;
function ck(cond,label,detail){
if(cond){ PASSN++; if(!QUIET) console.log('  ✔ '+label+(detail||'')); }
else { FAILN++; console.log('  ✘ '+label+(detail||'')); }
}
const f2=x=>(+x).toFixed(3);

console.log('══ FP 三式 (相机/视空间, +x右 +y上 -z向前; dur 斩0.5 劈0.7 刺0.35) ══');
out.fpSlash=fpSample('slash',30,0.5);
{
const rs=out.fpSlash.rows;
console.log('斩 nt→ tipX tipY elev pitchGun gunRZ rootRY handDev faceZ');
for(const r of rs){ if(Math.round(r.nt*30)%3===0||r.nt===0.2||r.nt===0.4||r.nt===0.6)
console.log('  '+f2(r.nt)+'  '+f2(r.tip[0])+'  '+f2(r.tip[1])+'  '+f2(r.elev)+'  '+f2(r.pitchGun)+'  '+f2(r.gr[2])+'  '+f2(r.rr[1])+'  '+f2(r.handDev)+'  '+r.faceZ); }
const wPeak=Math.max(...rs.filter(r=>r.nt>=0.13&&r.nt<=0.26).map(r=>r.tip[0]));
const swMin=Math.min(...rs.filter(r=>r.nt>0.26&&r.nt<0.97).map(r=>r.tip[0]));
const mid=rs.find(r=>Math.abs(r.nt-0.4)<1e-9);
const plateau=rs.find(r=>Math.abs(r.nt-0.6)<1e-9);
const rys=rs.map(r=>r.rr[1]);
const ryAmp=Math.max(...rys)-Math.min(...rys);
const devMax=Math.max(...rs.map(r=>r.handDev));
console.log('  [斩] 引刀tipX峰='+f2(wPeak)+' 扫段tipX谷='+f2(swMin)+' 中段(0.40) elev='+f2(mid.elev)+' pitchGun@plateau(0.60)='+f2(plateau.pitchGun)+' rz@mid='+f2(mid.gr[2])+' rootRY摆幅='+f2(ryAmp)+' 手偏差峰='+f2(devMax)+' faceZ@mid='+mid.faceZ);
ck(wPeak>=0.45,'FP斩 判据1: 引刀刀尖视空间 x ≥+0.45 (实测 '+f2(wPeak)+')');
ck(swMin<=-0.55,'FP斩 判据2: 扫段刀尖 x 谷 ≤−0.55 (实测 '+f2(swMin)+')');
ck(mid.elev>=-0.35&&mid.elev<=0,'FP斩 判据3: 扫击中段(0.40)刀轴视空间俯角 ∈[−0.35,0] 放平 (实测 '+f2(mid.elev)+', 枪系总俯角@扫击平台 '+f2(plateau.pitchGun)+')');
ck(mid.gr[2]<=-0.5,'FP斩 判据4: 扫击中段 rz ≤−0.5 立刃 (实测 '+f2(mid.gr[2])+')');
ck(ryAmp>=0.8,'FP斩 判据5: root ry 摆幅 ≥0.8 腰真转 (实测 '+f2(ryAmp)+')');
ck(devMax<=0.05,'FP斩 判据6: 手-握点偏差 ≤0.05 (实测 '+f2(devMax)+')');
out.fpSlashM={wPeak,swMin,mid:{elev:mid.elev,pitchGun:plateau.pitchGun,rz:mid.gr[2]},ryAmp,devMax};
}
out.fpChop=fpSample('chop',42,0.7);
{
const rs=out.fpChop.rows;
console.log('劈 nt→ tipX tipY elev gunRX gunRZ rootRX handDev');
for(const r of rs){ if(Math.round(r.nt*42)%4===0)
console.log('  '+f2(r.nt)+'  '+f2(r.tip[0])+'  '+f2(r.tip[1])+'  '+f2(r.elev)+'  '+f2(r.gr[0])+'  '+f2(r.gr[2])+'  '+f2(r.rr[0])+'  '+f2(r.handDev)); }
const dn=rs.filter(r=>r.nt>=0.31&&r.nt<=0.63);
const rzPeak=Math.min(...dn.map(r=>r.gr[2]));
let monoY=true; for(let i=1;i<dn.length;i++) if(dn[i].tip[1]>=dn[i-1].tip[1]+1e-6) monoY=false;
const dx=Math.max(...dn.map(r=>r.tip[0]))-Math.min(...dn.map(r=>r.tip[0]));
const lastM=rs.filter(r=>r.st==='melee').pop();   // 收势残差取最后一个 melee 帧 (nt=1 那帧已被收尾硬 set 归零)
const resR=Math.max(...lastM.rr.map((v,k)=>Math.abs(v-out.fpChop.idle.rr[k])));
const resG=Math.max(...lastM.gr.map(Math.abs));
const resP=Math.max(...lastM.gp.map(Math.abs));
const devMax=Math.max(...rs.map(r=>r.handDev));
console.log('  [劈] dn段rz峰='+f2(rzPeak)+' dn段tipY单调降='+monoY+' dn段tipX行程='+f2(dx)+' 收势残差 rot='+f2(Math.max(resR,resG))+' pos='+f2(resP)+' 手偏差峰='+f2(devMax)+' faceZ@dn峰='+dn[dn.length-1].faceZ);
ck(rzPeak<=-0.9,'FP劈 判据1: dn 段 rz 峰值 ≤−0.9 立刃 (实测 '+f2(rzPeak)+')');
ck(monoY&&dx>=0.08,'FP劈 判据2: 刀尖轨迹带斜向 (tipY 单调降='+monoY+', tipX 行程 '+f2(dx)+')');
ck(Math.max(resR,resG)<=0.02,'FP劈 判据3: 起收回举刀位 残差 ≤0.02rad (实测 rot '+f2(Math.max(resR,resG))+')');
ck(resP<=0.03,'FP劈 判据3b: 收势握点残差 ≤0.03m (实测 '+f2(resP)+')');
ck(devMax<=0.05,'FP劈 判据4: 手-握点偏差 ≤0.05 (实测 '+f2(devMax)+')');
out.fpChopM={rzPeak,monoY,dx,resR:Math.max(resR,resG),resP,devMax};
}
out.fpThrust=fpSample('thrust',21,0.35);
{
const rs=out.fpThrust.rows;
const rzPeak=Math.min(...rs.map(r=>r.gr[2]));
const tipMaxZ=Math.max(...rs.map(r=>r.tip[2]));
console.log('  [刺] 行数='+rs.length+' 枪系rx谷='+f2(Math.min(...rs.map(r=>r.gr[0])))+' tipZ峰(前伸)='+f2(tipMaxZ));
out.fpThrustM={rows:rs.length};
}

console.log('══ 3P 三式 (gunG 总角; 基线 rotY='+f2(out.p3&&0||0)+') ══');
out.p3Slash=p3Sample('slash',30,0.5);
{
const b=out.p3Slash.base, rs=out.p3Slash.rows;
console.log('斩 nt→ gunX gunY gunZ dPosX shR');
for(const r of rs){ if(Math.round(r.nt*30)%3===0)
console.log('  '+f2(r.nt)+'  '+f2(r.gR[0])+'  '+f2(r.gR[1])+'  '+f2(r.gR[2])+'  '+f2(r.gp[0]-b.gp[0])+'  '+f2(r.shR)); }
const span=Math.max(...rs.map(r=>r.gR[1]))-Math.min(...rs.map(r=>r.gR[1]));
const zMin=Math.min(...rs.map(r=>r.gR[2]));
const dxMax=Math.max(...rs.map(r=>r.gp[0]-b.gp[0]));
console.log('  [3P斩] 基线gY='+f2(b.gR[1])+' gunY扫幅(峰谷)='+f2(span)+' gunZ谷='+f2(zMin)+' gunOffX峰(dPosX)='+f2(dxMax));
ck(span>=2.2,'3P斩 判据1: gunY 扫幅总峰 ≥2.2rad (实测 '+f2(span)+')');
ck(zMin<=-0.7,'3P斩 判据2: gunZ 立刃峰 ≤−0.7 (实测 '+f2(zMin)+')');
ck(dxMax>=0.25,'3P斩 判据3: gunOffX 峰 ≥0.25 (实测 '+f2(dxMax)+')');
out.p3SlashM={span,zMin,dxMax};
}
out.p3Chop=p3Sample('chop',42,0.7);
{
const b=out.p3Chop.base, rs=out.p3Chop.rows;
console.log('劈 nt→ gunX gunY gunZ dPosY dPosZ shR');
for(const r of rs){ if(Math.round(r.nt*42)%4===0)
console.log('  '+f2(r.nt)+'  '+f2(r.gR[0])+'  '+f2(r.gR[1])+'  '+f2(r.gR[2])+'  '+f2(r.gp[1]-b.gp[1])+'  '+f2(r.gp[2]-b.gp[2])+'  '+f2(r.shR)); }
const zMin=Math.min(...rs.map(r=>r.gR[2]));
const yDrift=Math.max(...rs.map(r=>r.gR[1]))-Math.min(...rs.map(r=>r.gR[1]));
console.log('  [3P劈] gunZ谷='+f2(zMin)+' gunY行程='+f2(yDrift));
ck(zMin<=-1.0,'3P劈 判据1: gunZ 立刃峰 ≤−1.0 (实测 '+f2(zMin)+')');
out.p3ChopM={zMin,yDrift};
}

// ── 原始行落盘 (刺式 diff / 报告用) ──
try{ fs.writeFileSync(path.join(root,'dev','out','_melee-swing-rows.json'),JSON.stringify(out,null,1)); }catch(e){ console.log('(rows 落盘失败: '+e+')'); }
console.log('\n────');
console.log('判据: 通过 '+PASSN+' 项, 失败 '+FAILN+' 项'+(FAILN?'\n✗ 有判据未达标':''));
process.exitCode=FAILN?1:0;
