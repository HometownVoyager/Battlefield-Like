// ─────────────────────────────────────────────────────────────────
// dev/verify-fieldfix2-20261116.js —— 战场修复第二批 (2026-11-16 批 + 2026-11-17 实机返修), 不进 index.html
// 用法: node dev/verify-fieldfix2-20261116.js [--neg]
// 覆盖:
//   T1 树篱建模朝向 (叶团纯局部坐标; 双旋转修复 —— 模型∥碰撞盒∥篱线)
//   T2 树篱烧尽二段链 (hedgeChar 用 killOne 保视觉 → HEDGE_CRUMBLE 到点 hedgeShatter) + noTop
//   T3 碎块沿段轴散布 (ax/az/hl; 修复"多段只有中段出碎片"的另一半: 段心堆料)
//   T4 爆炸/碾压路由统一 hedgeShatter (explosionFlora + floraCrushTank 不再 vanishFlora 直消)
//   T5 坦克修理玩家侧 (tryVehRepair 起步/开火打断/重伤打断; vehRepairCrateNear 单源)
//   T6 坦克修理 Bot 侧 (起步门/驻车 hold/8s 完成回血/开火+重伤打断 —— 2026-11-17 Bot/玩家同步)
//   T7 撞机规避 planeAvoidScan (对头 → _avoid; 2026-11-17 tcp/miss 双符号修正后行为验证)
//   T8 死亡掉雷开关 NADE_DEATH_DROP (玩家/Bot 同走 dropHeldNade 单源门)
//   T9 主动优化 (perfOptPurge 行为 + perfOptTick 低帧两窗触发)
//   T10 布娃娃背包粘躯干 (torso 子网格 + traverse dispose)
//   T11 时停关手电就地停留修复 (nightGearLightsOn 唤醒门; 夜档独立 ctx)
//   T12 源码防回退锚点汇总 (HUD/i18n/index.html/接线/碰撞消费点)
// NEG (--neg): 14 补丁全注入, 每枚按名对认 ≥1 红。
// 沙箱要点承 verify-batch-20261114 (boot/G/__step/NEG PATCH_MAP/真开局+deployPlayer)。
// ★G 串内探针全局一律裸名隐式全局 (与游戏 function/var 同一真全局)。
// ─────────────────────────────────────────────────────────────────
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
Body:class{constructor(o){Object.assign(this,o||{});this.shapes=[];this.position=new V3();this.velocity=new V3();this.angularVelocity=new V3();this.quaternion=new Quat();this.angularDamping=0;this.linearDamping=0;}addShape(s){this.shapes.push(s);}},
Box:class{},Sphere:class{},Material:class{},ContactMaterial:class{},NaiveBroadphase:class{},PointToPointConstraint:class{},
};})();

// (_hedgeBlobGeo 所需的忠实经纬球桩已升入共享 dev/_bootstub.js _SphereGeo2 —— 本探针不再局部补, 避免双源漂移)

const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const FILES=[...html.matchAll(/src="(js\/[^"?]+)/g)].map(m=>m[1]);
console.log('载入清单: 解析 index.html 得 '+FILES.length+' 个脚本');

// ── NEG 阴性对照 (正常跑不启用) ──
const NEG=process.argv.includes('--neg');
const SRC={},PATCH_MAP={};
const NEG_PATCHES=[
// N1 T1拆: 叶团双旋转回退 (南北向篱 90° 反): T1 红
['js/05b-props.js','blobs.push({x:o+wr(-0.2,0.2)','blobs.push({x:cs*o+wr(-0.2,0.2)'],
// N2 T2拆: killOne→killBox (烧尽即摘视觉, 二段永不触发): T2 红
['js/04b-fire.js',"if(rec.box&&typeof killOne==='function') killOne(rec.box);","if(rec.box) killBox(rec.box);"],
// N3 T3拆: 沿轴散布回退 (u=0 全堆段心): T3 红
['js/04b-fire.js','const u=nD>1?((k/(nD-1))*2-1):0;','const u=0;'],
// N4 T4拆: 爆炸/碾压路由回退 vanishFlora 直消 (两处): T4 红 —— 判据=碎块入池增量 (hedgeShatter 9 块 vs vanishFlora 0 块;
// mesh 存活区分不了两路: vanishFlora→killBox 同样当场摘视觉 = "直接消失"的实锤)
['js/04b-fire.js',"if(rec.kind==='hedge'&&typeof hedgeShatter==='function') hedgeShatter(rec,false,false);","if(rec.kind==='hedge') vanishFlora(rec,true);"],
// N5 T6拆: Bot 起步门摘: T6 起步红
['js/15-vehicles.js','if(!this.vehRepair&&this.hp<this.maxHp*0.6&&nowT-(this.lastDmgT||-99)>4){','if(false){'],
// N6 T5/T6拆: 主炮开火打断 Bot 支摘: 开火打断红
['js/15-vehicles.js','else if(!this.playerDriven&&this.vehRepair){ this.vehRepair=null; }','else if(!this.playerDriven&&this.vehRepair){;}'],
// N7 T6拆: Bot 修理 tick 摘 (永不完成/不回血): T6 完成红
['js/15-vehicles.js','if(!this.playerDriven&&this.vehRepair){\nif(!this.alive||this.burning){ this.vehRepair=null; }','if(!this.playerDriven&&false){\nif(!this.alive||this.burning){ this.vehRepair=null; }'],
// N8 T6拆: 驻车 hold 摘 (修理照常开车): T6 驻车红
['js/15-vehicles.js','if(this.vehRepair){\nthis.vel=dampF(this.vel,0,4,dt); this.path=null; this.progT=0; this.lastPos.copy(this.pos);','if(this.vehRepair&&false){\nthis.vel=dampF(this.vel,0,4,dt); this.path=null; this.progT=0; this.lastPos.copy(this.pos);'],
// N9 T7拆: 规避置账摘 (_avoid 永不写): T7 红 (对头 miss 恰为 0, margin 归零挡不住 —— 改摘置账行)
['js/16-aircraft.js','pl._avoid={a:(left<right?a-HPI:a+HPI),t:PLANE_AVOID.hold};','pl._avoid=null;'],
// N10 T8拆: 掉雷门摘 (关闭仍落雷): T8 关闭支红
['js/13-combat.js','if(!NADE_DEATH_DROP) return;','if(false) return;'],
// N11 T9拆: perfOptTick 早退摘 (低帧两窗永不清场): T9 tick 红
['js/24-main.js',"if(typeof PERF_OPT==='undefined'||PERF_OPT===0) return;",'if(true) return;'],
// N12 T11拆: 手电链唤醒门摘 (时停关灯灯不收): T11 红
['js/24-main.js','||_hlRideOn||_flChainOn)','||_hlRideOn)'],
// N13 T5拆: 龙牙 antiTank 摘: T13 行为红
['js/05a-buildings.js','box.antiTank=true;','box.antiTank=false;'],
// N14 T2.5拆: 树篱顶可站回退 (noTop 门摘): T12 锚红
['js/04-collision.js','if(b.dead||b.noTop) return;','if(b.dead) return;'],
];
if(NEG) for(const [f,from,to] of NEG_PATCHES){
if(SRC[f]===undefined) SRC[f]=fs.readFileSync(path.join(root,f),'utf8');
if(SRC[f].indexOf(from)<0){ console.log('✗ NEG 锚缺失: '+f+' :: '+from.slice(0,80)); process.exit(1); }
PATCH_MAP[f]=(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC[f]).split(from).join(to);
}
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:fs.readFileSync(path.join(root,f),'utf8'));
const rawOf=f=>fs.readFileSync(path.join(root,f),'utf8');
function has(f,s){ return srcOf(f).indexOf(s)>=0; }

function boot(campIdx,store){
for(const k in stub.byId)delete stub.byId[k];
const ctx=vm.createContext(Object.assign({},stub.sandbox));
ctx.document=stub.document; ctx.window=stub.window; ctx.CANNON=CANNON;
ctx.localStorage={_s:Object.assign({sf_campaign:String(campIdx)},store||{}),getItem(k){return (k in this._s)?this._s[k]:null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
ctx.__T=1000;
ctx.performance={now:()=>ctx.__T};
for(const f of FILES) vm.runInContext(srcOf(f),ctx,{filename:f});
vm.runInContext('var __step=(n)=>{ for(let i=0;i<n;i++){ __T+=16.7; loop(); } };',ctx);
return ctx;
}
const PASS=[];let FAILN=0;const FAILS=[];
function ok(cond,label){
if(cond){ PASS.push(label); console.log('  ✔ '+label); }
else { FAILN++; FAILS.push(label); console.log('  ✘ '+label); }
}
const G=(ctx,s)=>vm.runInContext(s,ctx);

// ═════ 前置: 真开局 + 部署 + 清出生保护 ═════
const ctx=boot(3);
let err0=null;
try{ G(ctx,"document.getElementById('startBtn').onclick();"); }catch(e){ err0=String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); }
if(!err0){ try{ G(ctx,'if(!player.alive||!player.deployed) deployPlayer();'); }catch(e){ err0='deployPlayer: '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); } }
if(err0||!G(ctx,'player.alive')){ console.log('  ✘ 开局/部署失败 '+(err0||'player.alive=false')); process.exit(1); }
G(ctx,'for(const s of soldiers) s.protUntil=0; player.protUntil=0;');
ok(G(ctx,'soldiers.length')>0,'前置: 战场已开局并部署 (soldiers='+G(ctx,'soldiers.length')+', tanks='+G(ctx,'tanks.length')+')');

// ═════ T1 树篱建模朝向 ═════
console.log('T1 树篱建模朝向 (叶团纯局部坐标 → 模型长轴 ∥ 碰撞盒长轴 ∥ 篱线, 任意走向)');
let hedgeRecs=[];
{
const r=G(ctx,`
(function(){
var out={rows:[],err:null};
// 隔离地图预存树篱: 探针只认自己种下的 rec
FLORA_HASH.forEach(function(a){ for(var i=0;i<a.length;i++){ if(a[i]&&a[i].kind==='hedge') a[i]._pre=1; } });
function hedgeRecsNear(x,z,rad){
var arr=[]; FLORA_HASH.forEach(function(a){ for(var i=0;i<a.length;i++){ var rc=a[i]; if(rc.kind==='hedge'&&!rc._pre&&!rc._mk&&Math.hypot(rc.x-x,rc.z-z)<rad) arr.push(rc); } }); return arr;
}
var cands=[[80,100],[120,140],[160,180],[200,60],[240,100],[100,200],[220,220],[60,260],[260,60],[180,300]];
function tryRow(x1,z1,x2,z2){
var n0=FLORA_HASH_N; hedgerow(x1,z1,x2,z2);
var recs=hedgeRecsNear((x1+x2)/2,(z1+z2)/2,14);
for(var i=0;i<recs.length;i++) recs[i]._mk=1;
return {made:FLORA_HASH_N-n0, recs:recs};
}
var targets=[{a:[0,14],tag:'Z'},{a:[14,0],tag:'X'},{a:[0,14],tag:'Z'},{a:[14,0],tag:'X'}];
var placed=0;
for(var ci=0;ci<cands.length&&placed<4;ci++){
var cx=cands[ci][0], cz=cands[ci][1];
var t=targets[placed];
var row=(t.tag==='Z')?tryRow(cx,cz-10,cx,cz+10):tryRow(cx-10,cz,cx+10,cz);
if(row.recs.length>=2){
var dx=t.a[0], dz=t.a[1], L=Math.hypot(dx,dz), dxn=dx/L, dzn=dz/L;
var worstPar=0, minBoxPar=0;
for(var k=0;k<row.recs.length;k++){
var rc=row.recs[k];
var g=rc.meshes[0].geometry, pa=g.attributes.position.array;
var nx=1e9,xx=-1e9,nz=1e9,xz=-1e9;
for(var p=0;p<pa.length;p+=3){ if(pa[p]<nx)nx=pa[p]; if(pa[p]>xx)xx=pa[p]; if(pa[p+2]<nz)nz=pa[p+2]; if(pa[p+2]>xz)xz=pa[p+2]; }
rc._xSpan=xx-nx; rc._zSpan=xz-nz;
// 模型长轴方向 (局部 X 旋转 ry): dir=(cos ry,-sin ry) 应 ∥ (dxn,dzn)
var ry=rc.meshes[0].rotation.y;
var dirX=Math.cos(ry), dirZ=-Math.sin(ry);
var par=Math.abs(dirX*dzn-dirZ*dxn); worstPar=Math.max(worstPar,par);
// 碰撞盒长轴 ∥ 篱线 (bw>bd ⇒ 盒长轴在 X, 与 dxn 比; 否则与 dzn 比)
var bw=rc.box.maxX-rc.box.minX, bd=rc.box.maxZ-rc.box.minZ;
var bpar=Math.abs(1-((bw>bd)?dxn:dzn)); minBoxPar=Math.max(minBoxPar,bpar);
rc._ry=ry;
}
out.rows.push({tag:t.tag, n:row.recs.length, worstPar:worstPar, minBoxPar:minBoxPar, xLong:row.recs.every(function(rc){return rc._xSpan>rc._zSpan*1.3;}), xs:row.recs.map(function(rc){return +rc._xSpan.toFixed(2);}), zs:row.recs.map(function(rc){return +rc._zSpan.toFixed(2);}), recs:row.recs});
placed++;
}
}
out.nMade=placed;
globalThis.__hrows=out.rows;
return out;
})()
`);
ok(r&&r.nMade===4,'T1 前置: 四条测试树篱row落地 (Z/X/Z/X, 自由候选点; 得 '+((r&&r.nMade)||0)+')');
for(const row of (r&&r.rows||[])){
ok(row.xLong,'T1['+row.tag+'向] 叶团几何局部 X 加长 (旧双旋转档此断言翻) n='+row.n+' xSpan='+row.xs+' zSpan='+row.zs);
ok(row.worstPar<0.27,'T1['+row.tag+'向] 模型长轴∥篱线 (|sinθ|<0.27≈15°, 实测 '+row.worstPar.toFixed(3)+')');
ok(row.minBoxPar<0.05,'T1['+row.tag+'向] 碰撞盒长轴∥篱线 (盒门 |sin ry|>0.5 与旧版同账)');
}
hedgeRecs=(r&&r.rows&&r.rows[0]&&r.rows[0].recs)||[];
ok(hedgeRecs.length>=2&&hedgeRecs.every(rc=>rc.box.noTop===true),'T3.6 树篱碰撞盒 noTop=true (顶部不可站; 04-collision 消费见 T12)');
ok(hedgeRecs.length>=2&&hedgeRecs.every(rc=>typeof rc.ax==='number'&&typeof rc.hl==='number'),'T3 建模器写入 rec.ax/az/hl (碎块沿轴散布的数据源)');
}

// ═════ T2 烧尽二段链 ═════
console.log('T2 树篱烧尽二段链 (hedgeChar 保视觉焦黑 → HEDGE_CRUMBLE 到点 hedgeShatter 碎块化)');
{
const rec=hedgeRecs[0];
const r=G(ctx,`
(function(){
var rec=globalThis.__hrows[0].recs[0];
var out={};
var d0=DEBRIS.list.length;
hedgeChar(rec);
out.dead=rec.dead===true;
out.meshKept=!!(rec.meshes[0]&&rec.meshes[0].parent);   // killOne 修复点: 焦黑期视觉留场
out.charred=(rec.meshes[0]&&rec.meshes[0].material)===_charredFloraMat;
HEDGE_CRUMBLE.push({rec:rec,t:0.05});
globalThis.__d0=d0;
return out;
})()
`);
ok(r.dead,'T2a hedgeChar 置 dead+摘碰撞');
ok(r.meshKept,'T2b 焦黑期视觉留场 (killOne; killBox 回退档此红 = 烧黑破碎缺失根因)');
ok(r.charred,'T2c 材质换 _charredFloraMat');
G(ctx,'__step(4)');
const r2=G(ctx,`
(function(){
var rec=globalThis.__hrows[0].recs[0];
return {gone:!(rec.meshes[0]&&rec.meshes[0].parent), debris:DEBRIS.list.length-globalThis.__d0, crumbleLeft:HEDGE_CRUMBLE.length};
})()
`);
ok(r2.gone,'T2d 倒计时到点 hedgeShatter 摘视觉 (二段触发)');
ok(r2.debris>=7,'T2e 焦黑碎块入池 (期望 8, 实得 '+r2.debris+')');
ok(r2.crumbleLeft===0,'T2f HEDGE_CRUMBLE 账清');
}

// ═════ T3 碎块沿段轴散布 ═════
console.log('T3 碎块沿段轴散布 (修"只有中段一团散碎片")');
{
const r=G(ctx,`
(function(){
var rec=globalThis.__hrows[0].recs[1];
var d0=DEBRIS.list.length;
hedgeShatter(rec,false,false);
var nd=DEBRIS.list.slice(d0);
// 投影到 rec 轴 (ax,az) 与垂轴
var ax=rec.ax, az=rec.az, uMin=1e9,uMax=-1e9,vMin=1e9,vMax=-1e9;
for(var i=0;i<nd.length;i++){
var px=nd[i].body.position.x-rec.x, pz=nd[i].body.position.z-rec.z;
var u=px*ax+pz*az, v=px*(-az)+pz*ax;
if(u<uMin)uMin=u; if(u>uMax)uMax=u; if(v<vMin)vMin=v; if(v>vMax)vMax=v;
}
return {n:nd.length, uSpan:uMax-uMin, vSpan:vMax-vMin};
})()
`);
ok(r.n>=7,'T3a 绿叶碎块入池 (期望 9, 实得 '+r.n+')');
ok(r.uSpan>2.0,'T3b 碎块沿段轴铺开 (轴向跨度 '+r.uSpan.toFixed(2)+'m > 2.0; 段半长 hl='+G(ctx,'globalThis.__hrows[0].recs[1].hl')+')');
ok(r.vSpan<2.0,'T3c 垂轴不散 (横抖 ±0.55 + 块尺寸, 跨度 '+r.vSpan.toFixed(2)+'m < 2.0)');
}

// ═════ T4 爆炸/碾压路由统一 ═════
console.log('T4 爆炸/碾压树篱路由统一 hedgeShatter (不再 vanishFlora 直消)');
{
const r=G(ctx,`
(function(){
var out={};
var rows=globalThis.__hrows;
if(!rows||rows.length<4) return {err:'rows<4'};
var recE=rows[2].recs[0], recC=rows[3].recs[0];   // 新鲜行 (T2/T3 已消耗 rows[0])
var d0=DEBRIS.list.length;
explosionFlora({x:recE.x,z:recE.z},7);
out.expDead=recE.dead===true;
out.expMeshGone=!(recE.meshes[0]&&recE.meshes[0].parent);
out.expDebris=DEBRIS.list.length-d0;   // hedgeShatter 9 块 vs vanishFlora 0 块 (mesh 存活区分不了两路: killBox 都摘)
var d1=DEBRIS.list.length;
var fake={pos:V3(recC.x+1.5,0,recC.z), vel:2, yaw:0, playerDriven:false, suspPV:0};
var s0=fake.suspPV;
floraCrushTank(fake);
out.crushDead=recC.dead===true;
out.crushMeshGone=!(recC.meshes[0]&&recC.meshes[0].parent);
out.crushDebris=DEBRIS.list.length-d1;
out.crushSlow=fake.suspPV<s0;   // 碾撞减速反馈在
return out;
})()
`);
ok(r.expDead&&r.expMeshGone&&r.expDebris>=7,'T4a 爆炸 → hedgeShatter (死+视觉摘+碎块 '+r.expDebris+' 块; vanishFlora 回退档碎块 0 此红)');
ok(r.crushDead&&r.crushMeshGone&&r.crushSlow&&r.crushDebris>=7,'T4b 坦克碾 (车心 2m 内) → hedgeShatter (碎块 '+r.crushDebris+' 块)');
}

// ═════ T5 坦克修理玩家侧 ═════
console.log('T5 坦克补给箱修理 玩家侧 (tryVehRepair / fireCannon+takeDmg 打断 / 单源距离门)');
{
const r=G(ctx,`
(function(){
var out={};
var t=null; for(var i=0;i<tanks.length;i++){ if(tanks[i].alive&&tanks[i]!==player.onVehicle){ t=tanks[i]; break; } }
if(!t) return {err:'no tank'};
out.tank=t.name;
var c0=AMMO_CRATES.length;
AMMO_CRATES.push({x:t.pos.x+2,z:t.pos.z,ship:false});
var hp0=t.maxHp*0.5; t.hp=hp0;
player.onVehicle=t; t.playerDriven=true; player.vehRepair=null;
player.tryVehRepair();   // 经 19-input R 键同款入口 (player 方法)
out.started=!!(player.vehRepair&&player.vehRepair.tank===t);
t.fireCannon();   // 开火打断钩 (玩家支)
out.brokeByFire=player.vehRepair===null;
player.tryVehRepair();
out.restarted=!!player.vehRepair;
t.takeDmg(t.maxHp*0.3+1,null,true);   // 单次 >26% 重伤打断钩
out.brokeByDmg=player.vehRepair===null;
out.healed=t.hp>hp0-1;   // takeDmg 扣 30%: hp 应 ≈50%-30%+0 = 20% 区间; 只验账已扣非 NaN
// 距离门负例: 拆走补给箱后不得起修
player.tryVehRepair();   // 此时箱还在 → 起修
var had=!!player.vehRepair;
if(player.vehRepair) player.cancelReadBar(null,true);
AMMO_CRATES.pop();
t.hp=t.maxHp*0.5;
player.tryVehRepair();
out.gateBlocks=!player.vehRepair&&had;   // 箱在场能起修; 箱拿走后起修失败
out.crateBack=(AMMO_CRATES.push({x:t.pos.x+2,z:t.pos.z,ship:false})>c0);
player.onVehicle=null; t.playerDriven=false; player.vehRepair=null;
return out;
})()
`);
if(r.err){ ok(false,'T5 前置: 找到无人坦克 ('+r.err+')'); }
else{
ok(r.started,'T5a tryVehRepair 起修 (账挂 player.vehRepair.tank)');
ok(r.brokeByFire,'T5b 开火打断 (fireCannon 钩)');
ok(r.restarted&&r.brokeByDmg,'T5c 重伤>26% 打断 (takeDmg 钩)');
ok(r.gateBlocks&&r.crateBack,'T5d 距离门: 箱不在 R 内拒修 / 箱在场可修 (vehRepairCrateNear 单源)');
}
}

// ═════ T6 坦克修理 Bot 侧 ═════
console.log('T6 坦克补给箱修理 Bot 侧 (2026-11-17 Bot/玩家同步: 起步门/驻车/8s 完成/打断)');
{
const r=G(ctx,`
(function(){
var out={};
var t=null;
for(var i=0;i<tanks.length;i++){ var o=tanks[i]; if(o.alive&&!o.playerDriven&&o!==player.onVehicle&&o.crewBot&&o.crewBot.alive){ t=o; break; } }
var b=t?t.crewBot:null;
if(!t){
for(var j=0;j<tanks.length;j++){ if(tanks[j].alive&&!tanks[j].playerDriven&&tanks[j]!==player.onVehicle){ t=tanks[j]; break; } }
if(!t) return {err:'no tank'};
for(var k=0;k<soldiers.length;k++){ var s=soldiers[k]; if(s.alive&&!s.isPlayer&&!s.onVehicle&&!s.spectator){ b=s; break; } }
if(!b) return {err:'no bot'};
t.crewBot=b; b.onVehicle=t;
}
// 选远离双方基地/敌车的角落 (防感知打断): 取 4 角中 min(距各基地, 距敌车) 最大且非水者
var corners=[[24,24],[24,336],[336,24],[336,336]];
var eb={x:BASES.length?BASES[1-t.team].x:320,z:BASES.length?BASES[1-t.team].z:320};
var mb={x:BASES.length?BASES[t.team].x:40,z:BASES.length?BASES[t.team].z:40};
var best=null,bs=-1e9;
for(var i=0;i<corners.length;i++){
var c=corners[i];
if(waterDepthAt(c[0],c[1])>0.1||inRiverWater(c[0],c[1])) continue;   // 激流链单查 waterDepthAt 不够 (浅河道照样掉血)
var dmin=Math.min(Math.hypot(c[0]-eb.x,c[1]-eb.z),Math.hypot(c[0]-mb.x,c[1]-mb.z));
for(var j=0;j<tanks.length;j++){ var o=tanks[j]; if(o!==t&&o.alive&&o.team!==t.team) dmin=Math.min(dmin,Math.hypot(c[0]-o.pos.x,c[1]-o.pos.z)); }
if(dmin>bs){ bs=dmin; best=c; }
}
if(!best) return {err:'no dry corner'};
t.pos.set(best[0],0,best[1]); t.pos.y=heightAt(best[0],best[1]);
if(b.pos) b.pos.copy(t.pos);
t.vel=0; t.tTarget=null; t.tVehTgt=null; t.tMemT=0; t.aiHaltT=0; t.lastDmgT=-99; t.thinkCD=0; t.path=null; t.vehRepair=null;
// 冻结敌方飞机 (10s 等待窗内敌机俯冲以 >26% 重伤打断修理 = 测试环境污染, 非实现缺陷); 收尾还原
globalThis.__planesOff=[];
for(var pi=0;pi<planes.length;pi++){ var pl=planes[pi]; if(pl&&pl.alive&&pl.team!==t.team){ pl.alive=false; globalThis.__planesOff.push(pl); } }
var c0=AMMO_CRATES.length;
AMMO_CRATES.push({x:t.pos.x+2,z:t.pos.z,ship:false});
var hp0=t.maxHp*0.4; t.hp=hp0;
t.crewBot=b; b.onVehicle=t;
// 等待窗环境隔离: 屏蔽第三方伤害 (激流/流弹/溅射/地雷) —— 打断测试前还原, 不遮蔽被测打断链
var _td0=t.takeDmg;
t.takeDmg=function(a,at,ap){ if(globalThis.__noDmg) return; return _td0(a,at,ap); };
globalThis.__noDmg=true;
__step(120);
out.started=!!t.vehRepair;
if(!out.started){ out.diag={tgt:!!t.tTarget,vt:!!t.tVehTgt,dmg:nowT-(t.lastDmgT||-99),crate:vehRepairCrateNear(t.pos.x,t.pos.z),cmd:!!(typeof cmdTankCmd==='function'&&cmdTankCmd(t))}; }
globalThis.__bt=t; globalThis.__bb=b; globalThis.__bc0=c0;
var px=t.pos.x, pz=t.pos.z;
globalThis.__bpos={x:px,z:pz};
__step(120);
out.held=!!t.vehRepair&&Math.hypot(t.pos.x-px,t.pos.z-pz)<1.5;   // 驻车: 不开车不寻路
__step(360);   // 累计 ~10s > 8s 读条
globalThis.__noDmg=false; t.takeDmg=_td0;   // 还原伤害链 (打断测试走真链)
out.alive=t.alive===true;   // 等待窗内不许被打死 (环境纯净性)
out.done=(t.vehRepair===null);
out.hpPct=Math.round(t.hp/t.maxHp*1000)/10;
out.hpUp=t.hp>=t.maxHp*0.63;   // 40%+25%=65% (±燃烧/小伤)
// 打断: 主炮
t.vehRepair={t:0,dur:8}; t.fireCannon();
out.fireBreak=t.vehRepair===null;
// 打断: 重伤
t.vehRepair={t:0,dur:8}; t.takeDmg(t.maxHp*0.3+1,null,true);
out.dmgBreak=t.vehRepair===null;
// 打断: 起火 (tick)
t.vehRepair={t:0,dur:8}; t.burning=true; __step(2); t.burning=false;
out.burnBreak=t.vehRepair===null;
// 收尾还原
while(AMMO_CRATES.length>c0) AMMO_CRATES.pop();
for(var pr=0;pr<globalThis.__planesOff.length;pr++) globalThis.__planesOff[pr].alive=true;
t.crewBot=null; b.onVehicle=null; t.vehRepair=null; t.hp=t.maxHp; t.burning=false;
return out;
})()
`);
if(r.err){ ok(false,'T6 前置: 无人坦克+自由Bot ('+r.err+')'); }
else{
ok(r.started,'T6a 起步门: 残血40%+脱战+箱在R内 → 驻车自修'+(r.started?'':(' (diag='+JSON.stringify(r.diag)+')')));
ok(r.held,'T6b 驻车 hold: 修理中不开车 (2s 位移<1.5m)');
ok(r.alive,'T6b2 等待窗内坦克存活 (环境纯净性; 红=被第三方火力打死)');
ok(r.done,'T6c 8s 读条走完账清 (tick 摘负此红)');
ok(r.hpUp,'T6d 完成回血 +25%×maxHp (40%→≥63%, 实测 '+r.hpPct+'%)');
ok(r.fireBreak,'T6e 主炮开火打断 (fireCannon Bot 支; N6 对认)');
ok(r.dmgBreak,'T6f 重伤>26% 打断 (takeDmg Bot 支)');
ok(r.burnBreak,'T6g 起火打断 (update tick burning 门)');
}
}

// ═════ T7 撞机规避 planeAvoidScan ═════
console.log('T7 撞机规避 (对头 merge → _avoid 置账; tcp/miss 双符号修正后行为)');
{
const r=G(ctx,`
(function(){
var out={};
var p1=new Plane(0); planes.push(p1); p1.respawn();
var p2=new Plane(1); planes.push(p2); p2.respawn();
p1.pos.set(300,80,300); p1.yaw=0; p1.speed=60; p1._avoid=null; p1._avT=0;
p2.pos.set(300,80,400); p2.yaw=Math.PI; p2.speed=60; p2._avoid=null; p2._avT=0;
planeAvoidScan(p1,0.5);
out.avoid=!!(p1._avoid&&p1._avoid.t>0);
out.hold=p1._avoid?p1._avoid.t.toFixed(2):null;
// 远离负例: p2 挪到身后 200m 同向 → 不得触发
p1._avoid=null; p1._avT=0; p2.pos.set(300,80,100); p2.yaw=0; p2.speed=60;
planeAvoidScan(p1,0.5);
out.noFalse=!p1._avoid;
p1.alive=false; p2.alive=false;
return out;
})()
`);
ok(r.avoid,'T7a 对头 100m/相对 120m/s → _avoid 置账 (旧 tcp/miss 双取负档此红)');
ok(r.hold==='1.20','T7b hold=PLANE_AVOID.hold 1.2s');
ok(r.noFalse,'T7c 远离/同向不误触');
ok(has('js/16-aircraft.js','+this.team*10'),'T7d 巡航高度按队错层 (静态锚; 出生错层见 A17)');
}

// ═════ T8 死亡掉雷开关 ═════
console.log('T8 死亡手雷落下开关 NADE_DEATH_DROP (玩家/Bot 同走 dropHeldNade 单源)');
{
const r=G(ctx,`
(function(){
var out={};
NADE_DEATH_DROP=true;
var n0=nades.length;
dropHeldNade({pos:V3(500,2,500),isPlayer:true,team:0,nadeFuse:2});
out.onPlayer=nades.length-n0===1;
dropHeldNade({pos:V3(510,2,500),isPlayer:false,team:1,state:'nade',nadeAnimT:0.4});
out.onBot=nades.length-n0===2;
NADE_DEATH_DROP=false;
var n1=nades.length;
dropHeldNade({pos:V3(520,2,500),isPlayer:true,team:0,nadeFuse:2});
dropHeldNade({pos:V3(530,2,500),isPlayer:false,team:1,state:'nade',nadeAnimT:0.4});
out.offBoth=nades.length-n1===0;
NADE_DEATH_DROP=true;
return out;
})()
`);
ok(r.onPlayer&&r.onBot,'T8a 开: 玩家/Bot 手中雷落场 (nades +2)');
ok(r.offBoth,'T8b 关: 双方掉雷就地消失 (N10 对认)');
ok(G(ctx,'NADE_DEATH_DROP')===true,'T8c 默认值 =是 (localStorage sf_nadedrop 缺省)');
}

// ═════ T9 主动优化 ═════
console.log('T9 主动优化 (perfOptPurge 清碎屑层 / perfOptTick 低帧两窗触发)');
{
const r=G(ctx,`
(function(){
var out={};
spawnDebris(MAT.stone,600,3,600,0,1,1,1,600,600);
spawnDebris(MAT.stone,602,3,600,0,1,1,1,602,600);
out.seeded=DEBRIS.list.length>=2;
var n=perfOptPurge(false);
out.purged=(DEBRIS.list.length===0&&n>=2);
// perfOptTick 行为: 低帧两窗 → 清场 + 冷却
PERF_OPT=1; gamePaused=false; matchOver=false; menuHold=false;
spawnDebris(MAT.stone,604,3,600,0,1,1,1,604,600);
_poWin=2; _poN=20; _poCd=0; _poLow=0; _poArmed=true;   // fps=10 < 24
perfOptTick(0);
out.low1=(_poLow===1&&!_poCd);
_poWin=2; _poN=20;
perfOptTick(0);
out.fired=(_poCd===8&&DEBRIS.list.length===0);
out.rearmGate=!_poArmed;
PERF_OPT=0;
perfOptTick(0);   // 关闭档: 直接早退, 不吃账
out.offGate=(PERF_OPT===0&&_poCd===8);   // 早退不改冷却 (没清也没重置——只验证 no-op 不炸)
PERF_OPT=1;
return out;
})()
`);
ok(r.seeded&&r.purged,'T9a perfOptPurge 清 DEBRIS (返回计数 '+r.purged+')');
ok(r.low1,'T9b 低帧第一窗: 只挂账不触发 (_poLow=1)');
ok(r.fired,'T9c 第二窗: 清场+8窗冷却 (标准档 thr=24; N11 对认)');
ok(r.rearmGate,'T9d 触发后 disarmed (迟滞防锯齿)');
ok(r.offGate,'T9e 关闭档 no-op');
}

// ═════ T10 布娃娃背包 ═════
console.log('T10 布娃娃背包粘躯干 (torso 子网格 + dispose traverse)');
{
const r=G(ctx,`
(function(){
var out={};
var s=null; for(var i=0;i<soldiers.length;i++){ var x=soldiers[i]; if(x.alive&&!x.isPlayer&&!x.onVehicle&&!x.spectator&&x!==globalThis.__bb){ s=x; break; } }
if(!s) return {err:'no bot'};
var r0=RAG.list.length;
s.die(null);
out.spawned=RAG.list.length>r0;
var nr=RAG.list[RAG.list.length-1];
out.hasPack=false; out.parts=0;
if(nr){ for(var i=0;i<nr.parts.length;i++){ var p=nr.parts[i]; out.parts++; if(p.mesh&&p.mesh.children&&p.mesh.children.length>=1){ out.hasPack=true; } } }
return out;
})()
`);
if(r.err){ ok(false,'T10 前置: 自由Bot ('+r.err+')'); }
else{
ok(r.spawned,'T10a die → 布娃娃入池');
ok(r.hasPack,'T10b 躯干带背包子网格 ('+r.parts+' 部件中含子件; 旧版全裸此红)');
ok(has('js/12-ragdolls.js','p.mesh.traverse(o=>{ const g=o&&o.geometry;'),'T10c dispose 走 traverse (回收背包子几何)');
}
}

// ═════ T12 源码防回退锚点 (静态) ═════
console.log('T12 源码防回退锚点汇总');
{
ok(has('js/00-config.js',"localStorage.getItem('sf_nadedrop')!=='0'"),'A1 NADE_DEATH_DROP 解析 (缺省=是)');
ok(has('js/00-config.js',"parseInt(localStorage.getItem('sf_perfopt'),10)")&&has('js/00-config.js','const VEH_REPAIR_R=4.5, VEH_REPAIR_TIME=8, VEH_REPAIR_HEAL=0.25, VEH_REPAIR_DMG_FRAC=0.26'),'A2 PERF_OPT 三档解析+修理五常量单源');
ok(has('js/18-game.js','||!!this.vehRepair')&&has('js/18-game.js','tryVehRepair(){'),'A3 修理读条入取消网+起步口');
ok(has('js/19-input.js',"player.onVehicle.kind==='tank'&&typeof player.tryVehRepair==='function'"),'A4 R 键座位分支接线');
ok(has('js/20a-seats.js',"showScorePop('维修被打断: 移动')")&&has('js/20a-seats.js','VEH_REPAIR_R*1.35'),'A5 玩家修理 tick (移动/远离门)');
ok(has('js/20-player.js',"showScorePop('维修被打断: 下车')"),'A6 下车打断');
ok(has('js/22-hud.js','坦克维修中: {0}s'),'A7 HUD 读条链维修分支');
ok(has('js/22-hud.js','nadeDropBtn')&&has('js/22-hud.js','perfOptBtn')&&has('js/22-hud.js','_poNames'),'A8 两设置钮绑定');
ok(has('index.html','nadeDropBtn')&&has('index.html','perfOptBtn'),'A9 两 setCard 静态卡');
ok(has('js/00b-i18n.js','死亡时手雷落下')&&has('js/00b-i18n.js','主动优化'),'A10 i18n 词条');
ok(has('js/08-effects.js','function nightGearLightsOn()'),'A11 手电链可见态谓词');
ok(has('js/05a-buildings.js','groundFit(x,z,ry+HPI/2,0.58,0.58)')&&has('js/05a-buildings.js','box.antiTank=true;'),'A12 龙牙贴坡+antiTank');
ok(has('js/15-vehicles.js','!b.crush&&!b.antiTank&&b.maxY-b.gh<=TANK_STEP'),'A13 低矮豁免反坦克锥例外 (挡坦克)');
ok(has('js/15-vehicles.js','if(typeof vehRepairCrateNear===\'function\')')||has('js/15-vehicles.js','function vehRepairCrateNear'),'A14 补给箱距离门单源');
ok(has('js/04b-fire.js','if(rec.kind===\'hedge\'){ hedgeChar(rec); HEDGE_CRUMBLE.push'),'A15 烧尽树篱二段调度');
ok(has('js/23b-worldrestore.js','HEDGE_CRUMBLE.length=0'),'A16 跨局账清');
ok(has('js/16-aircraft.js','planeAvoidScan(this,dt);')&&has('js/16-aircraft.js','diveClaimedBy(t,this)) sc-=250;')&&has('js/16-aircraft.js','+this.team*12'),'A17 规避接线+汇聚抑制+出生错层');
ok(has('js/24-main.js','perfOptPurge(PERF_OPT===2)')&&has('js/24-main.js','perfOptTick(rdt);'),'A18 主动优化决策/接线');
ok(has('js/12-ragdolls.js','BoxGeometry(0.3,0.34,0.14)'),'A19 背包子网格建模');
ok(has('js/04-collision.js','if(b.dead||b.noTop) return;'),'A20 树篱顶不可站 (_shBoxCb 门; N14 对认)');
}

// ═════ T11 时停关手电 (独立亮图 ctx —— 用户 BUG 场景是亮图: 夜图 isDarkEnvironment 恒真, 旧唤醒门塌不了;
// 放最后避免污染主 ctx) ═════
console.log('T11 时停期间关手电 → 光柱/光源就地收起 (唤醒门 _flChainOn)');
{
const ctx2=boot(3);
let err2=null;
try{ G(ctx2,"document.getElementById('startBtn').onclick();"); }catch(e){ err2=String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); }
if(!err2){ try{ G(ctx2,"player.team=0; player.cls=3; player.spectator=true; player.specUsed=true; selectedSpawn=-1; deployPlayer();"); }catch(e){ err2='specDeploy: '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); } }
if(err2||!G(ctx2,'player.alive&&player.spectator')){ ok(false,'T11 前置: 夜档观战部署 '+(err2||'')); }
else{
G(ctx2,'player.flashlight=true; __step(8);');
const vis=G(ctx2,'!!(_playerFlashlight&&_playerFlashlight.visible)||!!(_playerFlSpill&&_playerFlSpill.visible)||!!(_playerFlCone&&_playerFlCone.visible)');
ok(vis,'T11a 亮图开灯: 手电链可见 (灯体/光锥至少其一)');
// 强制亮环境 (本图 isDarkEnvironment 可能恒真 ⇒ 旧唤醒门塌不了测不出; 用户 BUG 场景=亮图+手电): 
// 覆盖后唤醒门只剩余 _flChainOn 一条活路 —— 正档它撑住 tick, N12 档全塌。
G(ctx2,'__ide0=isDarkEnvironment; isDarkEnvironment=function(){return false;};');
G(ctx2,'specTimeToggle(); player.flashlight=false; __step(4);');
const off=G(ctx2,'!(_playerFlashlight&&_playerFlashlight.visible)&&!(_playerFlSpill&&_playerFlSpill.visible)&&!(_playerFlCone&&_playerFlCone.visible)');
ok(off,'T11b 时停中关灯: 链就地隐藏 (旧档 tick 断粮灯常驻此红; N12 对认)');
G(ctx2,'specTimeToggle(); isDarkEnvironment=__ide0;');
ok(G(ctx2,'specTimeFrozen()')===false,'T11c 时停已解除');
}
}

// ═════ 汇总 ═════
console.log('');
console.log('═══ 结果: '+PASS.length+' 过 / '+FAILN+' 红 ═══'+(NEG?' (NEG 阴性档: 红即对认)':''));
if(NEG&&FAILS.length){ console.log('NEG 红名清单 (↔补丁对认):'); for(const l of FAILS) console.log('  - '+l); }
process.exit(NEG?(FAILN>0?0:1):(FAILN===0?0:1));
