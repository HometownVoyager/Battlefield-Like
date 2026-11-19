// ─────────────────────────────────────────────
// dev/verify-ragdoll2-20261120.js —— 布娃娃批⑥二/三版回归探针 (钉 js/12-ragdolls.js 两个实机修复)
// 用法: node dev/verify-ragdoll2-20261120.js [--neg]
// 背景 (两个刚修好的实机 bug, 都在 js/12-ragdolls.js):
//   (a) 布娃娃子网格 (手/靴/腰带/背包) 曾误传 CANNON.Body 当网格宿主 ("g.add is not a function" 帧异常
//       横幅 + 半成品孤儿件站立/悬空定格) → 现宿主=**部件网格** (tMesh/armLm/armRm/legLm/legRm), 且生成段
//       有 try 护栏: 抛错→清账 (摘网格/刚体/约束/RAG.list)→return false→调用方走无物理倒地回退。
//   (b) 头盔锁死在头部件网格上: `buildHelmetInto(parts[parts.length-1].mesh, bot.team, U);` 单行直挂,
//       无独立盔刚体、无 P2P 约束 (cons 恒 6 条); 布娃娃=7 部件 (pelvis,torso,head,armL,armR,legL,legR),
//       entry push 进 RAG.list (字段含 parts/cons/t); 冻结: updateRagdolls 在 RAG_STILL_T=2.5s 静止后
//       置 entry.frozen=true。
// 判据:
//   T1 击杀链: 开局部署后真 die() 链杀两名 —— 一名敌方步兵 + 一名玩家同阵营下车步兵 ⇒ 两具布娃娃覆盖
//      两阵营 (baituan: cpc=八路布帽 / jp=日军九〇式, 头盔样式随 bot.team 走), RAG.list.length===2,
//      每具 parts.length===7 / cons.length===6。
//   T2 统一性 (逐具): 头部件网格 ≥2 子网格, 按 11-soldiers.buildHelmetInto 真实逻辑分样式 ——
//      帽檐式 (hs='cap': 盒几何子件 ≥4, 含头盒本体; 无盔球) / 盔球式 (其余: 存在球几何子件);
//      躯干网格 ≥2 子件 (背包+腰带), 每臂 ≥1 子件 (手), 每腿 ≥1 子件 (靴)。
//   T3 冻结: updateRagdolls(1/60)×200 ⇒ 每具 frozen===true, 且头盔子件仍挂头部件网格 (parent 链完好)。
//      前置口径 (诚实说明): 沙箱 CANNON 桩 world.step 是 no-op (无积分/无阻尼), 真实游戏里尸体落定后
//      速度已被结算衰减到 ~0; 桩环境不落定 ⇒ 生成初速 (≤5.5m/s) 永存, 冻结门一开下一帧就被解冻探速
//      (RAG_THAW_V2=0.81) 打回。T3 先把部件速度清零 = 建立真实游戏中"尸体已落定静止"的同一前置,
//      冻结门全链 (stillT 累计→RAG_STILL_T→freezeRagdoll 快照→解冻探速无外冲量保持) 照走真代码路径。
//   --neg 阴性对照 (deathflight NEG_PATCHES 机制; 两支**各自独立 boot** —— 同文件补丁互毒隔离是既定教训):
//      NEG-A: `0,-0.30,0, armLm)` → `0,-0.30,0, armL)` 重引入 body-as-host ⇒ bx 内 g.add 抛错 ⇒
//             生成护栏清账 return false ⇒ RAG.list.length 断言红 (连带红允许, 必须诚实)。
//      NEG-B: `buildHelmetInto(parts[parts.length-1].mesh, bot.team, U);` → '' ⇒ T1 仍绿 (布娃娃照常
//             生成), 头盔断言红, 躯干/手臂/腿断言仍绿 (恰好定向红)。
// 沙箱要点 (承 verify-deathflight-20261103): _bootstub+_bootpatch / CANNON 桩 (Body 故意无 .add ——
//   专抓 body-as-host) / FILES 从 index.html 的 src="(js/...)" 属性解析 (绝不手写清单) / boot(campIdx)
//   建 vm context (localStorage sf_campaign) / startBtn.onclick+deployPlayer+protUntil=0 / ok() 助手。
// 判几何种类只准用 geometry.parameters 字段 (_bootstub 桩几何无 is* 旗标): parameters.radius→球 /
//   parameters.radiusTop→柱 / parameters.width→盒。
// 击杀前把两名受害者挪到离所有存活建筑 AABB ≥3m 的开阔陆地 (真实落位, 非造假) —— 防邻墙 ragCollide
//   逐帧推挤破坏 2.5s 静止判据; 布娃娃生成/击杀链仍是真 die() 链。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const stub=require('./_bootstub.js');
require('./_bootpatch.js').patch(stub.sandbox);
// Obj3.clear 桩补齐 (deployPlayer 的 UI 清理会调; 真 THREE 有 Group.clear)
{const P=Object.getPrototypeOf(stub.THREE.Group.prototype); if(!P.clear) P.clear=function(){ this.children.length=0; };}
// style.setProperty 桩补齐 (22-hud.hudStyle 的 CSSOM 写法)
const _ensureStyle=e=>{ if(e&&e.style&&!e.style.setProperty) e.style.setProperty=(k,v)=>{ e.style[k]=v; }; return e; };
{const doc=stub.document,og=doc.getElementById.bind(doc),oc=doc.createElement.bind(doc);
doc.getElementById=id=>_ensureStyle(og(id));
doc.createElement=t=>_ensureStyle(oc(t));}
// CANNON 桩 (与 verify-deathflight-20261103 同源): die→spawnRagdoll 需要 World/Body 等。
//   Body **没有** .add 方法 —— 故意的, 专抓 "把 CANNON.Body 当网格宿主" 的 bug (NEG-A 由此转红)。
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
console.log('载入清单: 解析 index.html 得 '+FILES.length+' 个脚本');

// ── NEG 阴性对照 (只在 --neg 打补丁; 两支各自独立 boot, 不合并) ──
const NEG=process.argv.includes('--neg');
const SRC={};
const rawSrc=f=>{ if(SRC[f]===undefined) SRC[f]=fs.readFileSync(path.join(root,f),'utf8'); return SRC[f]; };
const NEG_PATCHES={
// NEG-A: 手盒宿主从部件网格 armLm 换回刚体 armL (重引入 body-as-host; mkPart 返回的就是刚体)
A:[['js/12-ragdolls.js','0,-0.30,0, armLm)','0,-0.30,0, armL)'],
],
// NEG-B: 头盔锁死单行整行摘除 (布娃娃照常 7 部件生成, 头部件无盔子件)
B:[['js/12-ragdolls.js','buildHelmetInto(parts[parts.length-1].mesh, bot.team, U);',''],
],
};
function patchedSrc(patches,label){
const PATCH_MAP={};
for(const [f,from,to] of patches){
const s=rawSrc(f);
if(s.indexOf(from)<0){ console.log('✗ NEG 锚缺失 ('+label+'): '+f+' :: '+from); process.exit(1); }
PATCH_MAP[f]=(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:s).split(from).join(to);
}
return f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:rawSrc(f));
}

function boot(campIdx,srcOf){
for(const k in stub.byId)delete stub.byId[k];
const ctx=vm.createContext(Object.assign({},stub.sandbox));
ctx.document=stub.document; ctx.window=stub.window; ctx.CANNON=CANNON;
ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of FILES) vm.runInContext(srcOf(f),ctx,{filename:f});
return ctx;
}

// 探针战役 = baituan (cpc vs jp): 两阵营头盔样式分属两支 —— cpc='cap' 帽檐式 (八路布帽) / jp='jp' 盔球式
//   (九〇式+帽檐+星徽), T2 的样式分支两路都被真阵营踩到 (战役锚按 id 查, 不手写序号)。
const CAMP=(()=>{
const c0=boot(0,rawSrc);
const i=vm.runInContext('CAMPAIGNS.findIndex(c=>c.id===\'baituan\')',c0);
if(i<0){ console.log('✗ CAMPAIGNS 无 baituan (探针战役锚漂移)'); process.exit(1); }
return i;
})();

// ── 单次完整流程: boot → 开局部署 → (①源码防回退, 仅无补丁跑) → T1 击杀链 → T2 结构 → T3 冻结 ──
function runMode(tag,patches,srcGuard){
console.log('');
console.log('══════ '+tag+' ══════');
const results=[];
const ok=(cond,label)=>{ results.push({label,pass:!!cond}); console.log('  '+(cond?'✔':'✘')+' '+label); };
const ctx=boot(CAMP,patchedSrc(patches,tag));
const G=s=>vm.runInContext(s,ctx);
// ── ① 源码防回退 (只读源; NEG 跑跳过 —— 打补丁后锚必然不在, 不算判据) ──
if(srcGuard){
const s12=rawSrc('js/12-ragdolls.js');
ok(s12.includes('const armL=b, armLm=parts[parts.length-1].mesh;')
&&s12.includes('0,-0.30,0, armLm)')&&s12.includes('0,-0.30,0, armRm)')
&&s12.includes('0,-0.43,0.04, legLm)')&&s12.includes('0,-0.43,0.04, legRm)'),
'① 手/靴宿主=部件网格 (armLm/armRm/legLm/legRm 四锚 verbatim)');
ok(s12.includes('bx(soldierAccMat(0x3a3428,true),0.4,0.08,0.28, 0,-0.23,0, tMesh).castShadow=false;'),
'① 腰带宿主=躯干部件网格 (tMesh verbatim)');
ok(s12.includes('}catch(e2){')&&s12.includes('return false;')&&s12.includes('RAG.list.splice(_ei,1);'),
'① 生成段 try 护栏 (抛错→清账→return false→调用方回退无物理死亡动画)');
ok(s12.includes('const head=b;')&&s12.includes('buildHelmetInto(parts[parts.length-1].mesh, bot.team, U);'),
'① 头盔锁死头部件网格 (const head=b + buildHelmetInto 单源直挂, 无独立盔刚体)');
ok(s12.includes('cons=[P2P(torso,[0,-0.26,0],pelvis,[0,0.13,0]),P2P(head,[0,-0.13,0],torso,[0,0.27,0]),P2P(armL,[0,0.24,0],torso,[-ST.armX,0.2,0]),P2P(armR,[0,0.24,0],torso,[ST.armX,0.2,0]),P2P(legL,[0,0.47,0],pelvis,[-ST.legX,0,0]),P2P(legR,[0,0.47,0],pelvis,[ST.legX,0,0])];'),
'① cons 恰 6 条 P2P verbatim 整行 (无头盔约束)');
}
// 开局 + 部署 (承 deathflight)
let err0=null;
try{ G("document.getElementById('startBtn').onclick();"); }catch(e){ err0=String(e&&e.stack||e); }
if(!err0){ try{ G('if(!player.alive||!player.deployed) deployPlayer();'); }catch(e){ err0='deployPlayer: '+String(e&&e.stack||e); } }
if(err0||!G('player.alive')){ ok(false,'前置: 开局/部署失败 '+(err0||'player.alive=false')); return results; }
G('for(const s of soldiers) s.protUntil=0; player.protUntil=0;'); // 出生保护 0.5s: 免伤会吞掉整条击杀链, 全清
ok(G('soldiers.length')>0,'前置: 战场已开局并部署 (soldiers='+G('soldiers.length')+', player.team='+G('player.team')+')');

// ── 公用 vm 片段 ──
G(`
function _pickInf(kind){
for(var i=0;i<soldiers.length;i++){ var s=soldiers[i];
if(!s.alive||s.isPlayer||s.onVehicle||s.spectator||s.capCrew) continue;
if(kind==='enemy'){ if(s.team===player.team) continue; } else { if(s.team!==player.team) continue; }
return s;
}
return null;
}
function _openSpot(a0){
// 开阔陆地落位 (承 deathflight 落位范式): 陆地 + 离所有存活建筑/箱体 AABB ≥3m —— 防邻墙 ragCollide
//   逐帧推挤破坏 RAG_STILL_T 静止判据; 受害者挪位是落位, 击杀链仍是真 die() 链
for(var da=0;da<Math.PI*2;da+=0.13){
var a=a0+da;
for(var d=8;d<48;d+=4){
var x=player.pos.x+Math.sin(a)*d, z=player.pos.z+Math.cos(a)*d;
if(heightAt(x,z)<=waterYAt(x,z)+0.4) continue;
var clear=true;
for(var k=0;k<BOXES.length;k++){ var bx2=BOXES[k]; if(bx2.dead) continue;
var cx=Math.max(bx2.minX,Math.min(x,bx2.maxX)), cz=Math.max(bx2.minZ,Math.min(z,bx2.maxZ));
if((x-cx)*(x-cx)+(z-cz)*(z-cz)<9){ clear=false; break; }
}
if(clear) return {x:x,z:z};
}
}
return null;
}
`);

// ══ T1 击杀链: 敌兵 + 同阵营下车步兵 真 die() 链 ⇒ 两具布娃娃 (覆盖两阵营) ══
console.log('T1 击杀链: 敌兵+同阵营下车步兵真 die() ⇒ RAG.list===2, 每具 parts=7/cons=6 (头盔无独立刚体)');
const t1=G(`(function(){
try{
var n0=RAG.list.length;
var E=_pickInf('enemy'); if(!E) return {err:'无敌方下车步兵'};
var spotE=_openSpot(0); if(!spotE) return {err:'无开阔陆地落位 (敌)'};
E.pos.set(spotE.x,heightAt(spotE.x,spotE.z),spotE.z); E.crouch=false; E.prone=false;
E.damage(500,player,false);                                        // 真死亡链 → die → spawnRagdoll
if(E.alive) return {err:'敌兵未死 (damage 未走真 die 链)'};
var eR=!!E.ragdolled;
var F=_pickInf('friendly'); if(!F) return {err:'无同阵营下车步兵'};
var spotF=_openSpot(2.1); if(!spotF) return {err:'无开阔陆地落位 (友)'};
F.pos.set(spotF.x,heightAt(spotF.x,spotF.z),spotF.z); F.crouch=false; F.prone=false;
F.damage(500,player,false);
if(F.alive) return {err:'同阵营步兵未死 (damage 未走真 die 链)'};
var fR=!!F.ragdolled;
return {n0:n0,n1:RAG.list.length,eR:eR,fR:fR,eTeam:E.team,fTeam:F.team,pTeam:player.team,
parts:RAG.list.map(function(r){return r.parts.length;}),
cons:RAG.list.map(function(r){return r.cons.length;})};
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t1.err){ ok(false,'T1 异常 '+t1.err); }
else{
ok(t1.n0===0,'前置: 击杀前无存量布娃娃 (RAG.list='+t1.n0+')');
ok(t1.eR,'T1 ★敌兵布娃娃已生成 (真 die→spawnRagdoll, bot.ragdolled=entry)');
ok(t1.fR,'T1 ★同阵营下车步兵布娃娃已生成 (真 die→spawnRagdoll)');
ok(t1.eTeam!==t1.fTeam&&t1.eTeam!==t1.pTeam&&t1.fTeam===t1.pTeam,'T1 击杀覆盖两阵营 (敌='+t1.eTeam+' 友='+t1.fTeam+' 玩家='+t1.pTeam+')');
ok(t1.n1===2,'T1 ★RAG.list.length===2 (两真死亡链各一具, 实得 '+t1.n1+')');
ok(t1.parts.length===2&&t1.parts.every(n=>n===7),'T1 ★两具布娃娃均 parts.length===7 (pelvis..legR, 实得 '+JSON.stringify(t1.parts)+')');
ok(t1.cons.length===2&&t1.cons.every(n=>n===6),'T1 ★两具布娃娃均 cons.length===6 (旧独立头盔刚体+P2P 已摘, 实得 '+JSON.stringify(t1.cons)+')');
}

// ══ T2 统一性 (逐具): 头/躯干/臂/腿 子网格构成, 按 buildHelmetInto 阵营真实逻辑 ══
console.log('T2 统一性: 头部件 ≥2 子网格+阵营样式 (帽檐式/盔球式), 躯干 ≥2 / 臂 ≥1 / 腿 ≥1 子件');
G(`
function __meshKind(m){
var p=m&&m.geometry&&m.geometry.parameters;
if(!p) return 'none';
if(p.radius!==undefined) return 'sphere';
if(p.radiusTop!==undefined||p.radiusBottom!==undefined) return 'cyl';
if(p.width!==undefined) return 'box';
return 'other';
}
function __analyzeRagdoll(idx,team){
var r=RAG.list[idx];
if(!r||r.parts.length!==7) return {err:'布娃娃#'+idx+' 无或部件数≠7 (parts='+(!r?'0':r.parts.length)+')'};
var P=r.parts, out={idx:idx,team:team,parts:7,cons:r.cons.length};
out.headIsHead=(P[2].mesh.material===uniformMats[team].skin);   // 头部件识别: 材质=阵营肤色单源
out.headKids=P[2].mesh.children.length;
var spheres=0,boxes=0;
(function walk(o){ for(var i2=0;i2<o.children.length;i2++){ var c=o.children[i2]; var k=__meshKind(c);
if(k==='sphere') spheres++; if(k==='box') boxes++; walk(c); } })(P[2].mesh);
if(__meshKind(P[2].mesh)==='box') boxes++;   // 头部件本体=盒 (mkPart BoxGeometry): 帽檐式计数含它
out.spheres=spheres; out.boxes=boxes; out.hs=TEAM_FACTION[team].helmet;
out.torsoKids=P[1].mesh.children.length;
out.armKids=[P[3].mesh.children.length,P[4].mesh.children.length];
out.legKids=[P[5].mesh.children.length,P[6].mesh.children.length];
return out;
}
`);
if(!t1.err&&t1.n1===2){
const TEAMS=[t1.eTeam,t1.fTeam];   // entry 序=击杀序 (spawnRagdoll 同步 push): #0=敌 #1=友
for(let i=0;i<2;i++){
const a=G('__analyzeRagdoll('+i+','+TEAMS[i]+')');
const who=(TEAMS[i]===t1.pTeam)?'友军':'敌军';
if(a.err){ ok(false,'T2 #'+i+' 异常 '+a.err); continue; }
const tag2='#'+i+' ('+who+' hs='+a.hs+')';
ok(a.headIsHead&&a.parts===7,'T2 '+tag2+' 头部件识别 (parts[2]=肤色头部件, 挂件宿主=部件网格)');
ok(a.headKids>=2,'T2 '+tag2+' 头盔 ★头部件网格 ≥2 子网格 (实得 '+a.headKids+')');
if(a.hs==='cap') ok(a.boxes>=4&&a.spheres===0,'T2 '+tag2+' 头盔 ★帽檐式: 盒几何子件 ≥4 含头盒本体 (盒='+a.boxes+' 球='+a.spheres+')');
else ok(a.spheres>=1,'T2 '+tag2+' 头盔 ★盔球式: 存在球几何子件 (球='+a.spheres+' 盒='+a.boxes+')');
ok(a.torsoKids>=2,'T2 '+tag2+' 躯干 ≥2 子件 (背包+腰带, 实得 '+a.torsoKids+')');
ok(a.armKids[0]>=1&&a.armKids[1]>=1,'T2 '+tag2+' 手臂 ≥1 子件×2 (手, 实得 '+a.armKids.join('/')+')');
ok(a.legKids[0]>=1&&a.legKids[1]>=1,'T2 '+tag2+' 腿 ≥1 子件×2 (靴, 实得 '+a.legKids.join('/')+')');
}
}
else ok(false,'T2 未执行: 布娃娃数量不足 (T1 '+(t1.err?('异常 '+t1.err):('实得 '+t1.n1))+')');

// ══ T3 冻结: updateRagdolls(1/60)×200 ⇒ frozen ×2 且头盔子件 parent 链完好 ══
console.log('T3 冻结: updateRagdolls(1/60)×200 ⇒ frozen===true ×2, 头盔子件 parent 链仍完好');
const t3=G(`(function(){
try{
var n0=RAG.list.length;
// 沙箱前置: 桩 world.step 无积分/无阻尼 ⇒ 生成初速永存 (实测 ~5m/s), 冻结门一开即被解冻探速打回。
//   清零 = 建立真实游戏"尸体已落定静止"的同一前置; 冻结门全链照走真代码 (见文件头口径)。
var v0max=0;
for(var r2 of RAG.list) for(var p2 of r2.parts){
v0max=Math.max(v0max,Math.hypot(p2.body.velocity.x,p2.body.velocity.y,p2.body.velocity.z));
p2.body.velocity.set(0,0,0); p2.body.angularVelocity.set(0,0,0);
}
for(var i=0;i<200;i++) updateRagdolls(1/60);
return {n0:n0,n1:RAG.list.length,v0max:v0max,
frozen:RAG.list.map(function(r){return !!r.frozen;}),
headKids:RAG.list.map(function(r){return r.parts[2]?r.parts[2].mesh.children.length:-1;}),
parentOK:RAG.list.map(function(r){return r.parts[2]?r.parts[2].mesh.children.every(function(c){return c.parent===r.parts[2].mesh;}):false;})};
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t3.err){ ok(false,'T3 异常 '+t3.err); }
else{
const fz=t3.frozen.filter(Boolean).length;
const hkOk=t3.headKids.filter(n=>n>=2).length;
const pkOk=t3.parentOK.filter(Boolean).length;
ok(t3.n0===2&&t3.n1===2,'T3 前置: 200 步窗口两具布娃娃在手且未到期移除 (清零前峰值速度 '+t3.v0max.toFixed(1)+'m/s)');
ok(fz===2,'T3 ★两具布娃娃均 frozen===true (RAG_STILL_T=2.5s 静止门, 实冻 '+fz+')');
ok(hkOk===2&&pkOk===2,'T3 ★头盔子件仍挂头部件网格 (≥2 子件且 parent 链完好 ×2 具)');
return results;
}
}

// ── 模式调度: 正常跑一次全绿; --neg 跑两支各自独立 boot, 恰好定向红 ──
const MODES=[];
if(!NEG) MODES.push({tag:'正常模式 (无补丁)',patches:[],srcGuard:true});
else{
MODES.push({tag:'NEG-A (body-as-host 回流: armLm→armL)',patches:NEG_PATCHES.A,srcGuard:false,
expect:{mustRed:['RAG.list.length'],mustGreen:['开局并部署']}});
MODES.push({tag:'NEG-B (头盔锁死单行摘除)',patches:NEG_PATCHES.B,srcGuard:false,
expect:{mustRed:['头盔'],mustGreen:['RAG.list.length','躯干','手臂','腿','开局并部署'],onlyRedWith:'头盔'}});
}
let exitBad=false;
for(const m of MODES){
const results=runMode(m.tag,m.patches,m.srcGuard);
const reds=results.filter(r=>!r.pass), greens=results.filter(r=>r.pass);
console.log('────');
console.log(m.tag+': 通过 '+greens.length+' 项, 失败 '+reds.length+' 项');
if(!NEG){
if(reds.length) exitBad=true;
}else{
if(!reds.length){ console.log('✗ '+m.tag+' 全绿 = 判据空转!'); exitBad=true; }
for(const sub of m.expect.mustRed){ if(!reds.some(r=>r.label.includes(sub))){ console.log('✗ '+m.tag+' 定向红缺失: 含"'+sub+'"的断言未红'); exitBad=true; } }
for(const sub of m.expect.mustGreen){ if(!greens.some(r=>r.label.includes(sub))){ console.log('✗ '+m.tag+' 应绿断言转红: 含"'+sub+'"'); exitBad=true; } }
if(m.expect.onlyRedWith){ for(const r of reds){ if(!r.label.includes(m.expect.onlyRedWith)){ console.log('✗ '+m.tag+' 越界红 (定向红只许"'+m.expect.onlyRedWith+'"族): '+r.label); exitBad=true; } } }
}
}
if(NEG&&!exitBad) console.log('阴性对照定向红达成: 判据分辨力在位');
if(exitBad) process.exitCode=1;
