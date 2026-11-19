// ─────────────────────────────────────────────
// dev/verify-frameperf3-20261119.js —— 全局卡顿审计修复批三 (2026-11-19, "本批未动"三案收尾):
//   T1  NAV 直写时代快路径: registerDynCollider (残骸/占用直写+occTouch) 后 refresh 跳过 buildOccupancy
//       全量重建, 按登记簇直接烘焙 (火情期每 5s 一帧的 2.6-7.4ms → 亚毫秒)
//   T2  快路径 skip 分支: 无登记簇 ⇒ 连烘焙都不做 (OCC.data 未被直写过=导航输入未变)
//   T3  1全:3快 配额: 连续 3 次快刷后回插一次全量重建 (killOne 盲置 0 角案收敛), 全量后重新武装
//   T4  门控双计数 (_occAddSeq/_occAddSyncN, 03-terrain): 裸直调 addBoxCollider (只入 BOXES 表不写
//       OCC.data) ⇒ 回退全量, 新盒被收编变阻挡 —— A/B 实锤过的回归案 (verify-nav 1m 厚墙) 的专项闸
//   T5  markNavDirty(true) 强制全量 (旗翻型改动: 碾铁丝网/玩家拆除 —— 无占用直写配套); markNavDirty()
//       普通延迟刷新走快路径消费登记簇
//   T6  枪模缓存 _wgCache (11-soldiers worldGunModel): 按 kind|team|key 缓存原型, 出货=clone
//       (真 THREE.Object3D.copy 语义: 深递归 clone, 子件共享 geometry/material, 实例彼此独立)
//       —— 重生风暴每次 respawn 全套枪模几何+材质分配的 GC 压力源
//   T7  pickSpawnFor 双遍 combatants 全表扫融合为一遍 (重生风暴主项: 每 bot × ~28-67 lane × 2 全表);
//       nearestEnemy 取 min / eCnt 计数与序无关, crowd 加法保持同队原序 ⇒ 逐位同值
//   T8  findCoverFrom 有界插入 top-12 槽 (严格小于才前插=稳定全排序取前 12 同果) + threat 端
//       heightAt/org 外提 (原每候选重算一遍 + 新建一枚 V3)
//   T9  aaSpreadTarget 0.25s 结果缓存 (无粘滞档时炮上操作者 60Hz 每帧 planes×combatants 双重全表;
//       batteryTargetFor 同款新鲜度口径)
//   T10 批纪律: 天气降水保持逐帧步进回滚态 (_wxStepAcc 不得复活) —— 本批不触碰 08-effects
// 判据口径: 行为判据红=坏状态成立; 源码钉红=钉被摘。buildOccupancy 调用计数用裸名重绑定
// (frameperf2 T5 raycastWorld 同款), 是"全量重建是否发生"的直接判据 (stats 不直接暴露)。
// 用法: node dev/verify-frameperf3-20261119.js [--neg]
//   --neg = 阴性对照 (★逐补丁隔离 boot: 每补丁单独应用+独立世界, 目标判据必须报红, 对认按红名;
//     本探针三支 07-nav 补丁互斥不可同跑, 见 NEG 段注):
//     N1 快路径门杀 (恒假) → T1/T2 红 (快路径永不 engage, 每次 refresh 都全量)
//     N2 摘双计数门 → T4 红 (裸 addBoxCollider 不被收编 = NAV 陈旧格, A/B 实锤案复活)
//     N3 摘 markNavDirty(true) 强制位 → T5 红 (旗翻型改动后仍走快路径 = 全量不发生)
//     N4 摘枪模缓存登记行 → T6 红 (缓存恒空)
//     N5 摘 cover top-12 弹出上限 → 源码钉红 (T8 结构钉被摘)
//     N6 摘 AA 0.25s 缓存 → T9 红 (TTL 内也重算 = 缓存失效)
//     N7 摘 defend 内联 crowd 权重行 → 源码钉红 (T-P23 被摘 = 挤占惩罚消失)
// ★沙箱注: 裸名重绑定 top-level function 声明 (buildOccupancy/raycastWorld) 合法且跨脚本可见;
//   combatants/planes/coverPoints 是 const 数组 ⇒ 只能 splice 原地替换, 不得重新赋值绑定。
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
Body:class{constructor(o){Object.assign(this,o||{});this.shapes=[];this.position=new V3();this.velocity=new V3();this.angularVelocity=new V3();this.quaternion=new Quat();this.angularDamping=0;this.linearDamping=0;}addShape(s){this.shapes.push(s);}},
Box:class{},Sphere:class{},Material:class{},ContactMaterial:class{},NaiveBroadphase:class{},PointToPointConstraint:class{},
};})();

const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const FILES=[...html.matchAll(/src="(js\/[^"?]+)/g)].map(m=>m[1]);

// ── NEG 阴性对照 (正常跑不启用) ──
const NEG=process.argv.includes('--neg');
const SRC={},PATCH_MAP={};
const NEG_PATCHES=[
// N1 快路径门杀 (恒假) → 每次 refresh 全量
['js/07-nav.js','_navFastN<3','false'],
// N2 摘双计数门 → 裸 addBoxCollider 不被收编
['js/07-nav.js','_occAddSeq===_occAddSyncN','true'],
// N3 摘 markNavDirty(true) 强制位
['js/07-nav.js','function markNavDirty(forceFull){ if(forceFull) _navFullReq=true; _navDirtyT=0.6; }','function markNavDirty(forceFull){ _navDirtyT=0.6; }'],
// N4 摘枪模缓存登记行
['js/11-soldiers.js','_wgCache.set(ck,g);',';'],
// N5 摘 cover top-12 弹出上限
['js/14-bots.js','if(cands.length>12){ cands.pop(); candsP.pop(); }',';'],
// N6 摘 AA 0.25s 缓存
['js/14-bots.js','if(self._aaScT!==undefined&&nowT-self._aaScT<0.25&&self._aaScC&&self._aaScC.alive) return self._aaScC;',';'],
// N7 摘 defend 内联 crowd 权重行
['js/14-bots.js','const dd=d+rand(0,14)+crowd*9;','const dd=d+rand(0,14);'],
];
if(NEG) for(const [f,from,to] of NEG_PATCHES){
if(SRC[f]===undefined) SRC[f]=fs.readFileSync(path.join(root,f),'utf8');
if(SRC[f].indexOf(from)<0){ console.log('✗ NEG 锚缺失: '+f+' :: '+from.slice(0,60)); process.exit(1); }
PATCH_MAP[f]=(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC[f]).split(from).join(to);
}
if(NEG) console.log('NEG 载入补丁键: '+Object.keys(PATCH_MAP).join(', '));
const LC=require('./_loadcache.js'); // 2026-11-19 效率批
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:LC.src(root,f));
const SCR={}; // 按 f memo 编译

function boot(campIdx,extraLs){
for(const k in stub.byId)delete stub.byId[k];
const ctx=vm.createContext(Object.assign({},stub.sandbox));
ctx.document=stub.document; ctx.window=stub.window; ctx.CANNON=CANNON;
ctx.localStorage={_s:Object.assign({sf_campaign:String(campIdx)},extraLs||{}),getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of FILES) (SCR[f]||(SCR[f]=new vm.Script(srcOf(f),{filename:f}))).runInContext(ctx); // 编译缓存
return ctx;
}
const PASS=[];let FAILN=0;
function ok(cond,label){
if(cond){ PASS.push(label); console.log('  ✔ '+label); }
else { FAILN++; console.log('  ✘ '+label); }
}
ok(/__sfStyleVer='202611(1[89]|20)[a-z]'/.test(html),'前置: 版本戳 20261118x-20261120x 在位 (index.html 内联, 正则兼容本批升戳)');

// ── 源码钉 (无需 boot) ──
const s07=srcOf('js/07-nav.js'),s03=srcOf('js/03-terrain.js'),s15=srcOf('js/15-vehicles.js'),
s06=srcOf('js/06-engineering.js'),s17=srcOf('js/17-emplacements.js'),s11=srcOf('js/11-soldiers.js'),
s14=srcOf('js/14-bots.js'),s08=srcOf('js/08-effects.js');

ok(s07.includes('if(!forceFull&&baked&&OCC.data&&_navFastN<3&&!_navFullReq&&_occAddSeq===_occAddSyncN){'),'P1 快路径门在位 (配额+双计数齐平门)');
ok(s07.includes('navStats.fastBakes=(navStats.fastBakes||0)+1;')&&s07.includes('_navFastN++;'),'P2 快路径计数账在位 (fastBakes+配额推进)');
ok(s07.includes('else{ navStats.skipBakes++; navStats.lastDirty=0; } // 无登记簇 ⇒ OCC.data 未被直写过, 导航输入未变'),'P3 快路径 skip 分支在位');
ok(s07.includes('_navFastN=0;   // 全量重建后重新放开快路径配额 (1全:3快)'),'P5 全量后配额重武装在位');
ok(s07.includes('_occAddSeq=0; _occAddSyncN=0;'),'P4 全量尾部门控计数对清零在位');
ok(s07.includes('function markNavDirty(forceFull){ if(forceFull) _navFullReq=true; _navDirtyT=0.6; }'),'P6 markNavDirty(forceFull) 强制位在位');
ok(s07.includes('NAV.refresh(_navFullReq); _navFullReq=false;'),'P7 updateNavDirty 驱动 refresh 在位');
ok(s03.includes('var _occAddSeq=0, _occAddSyncN=0;'),'P8 门控双计数声明在位 (03-terrain)');
ok(s03.includes('_occAddSeq++;'),'P9 addBoxCollider 追加计数在位 (裸直调=未收编)');
ok(s03.includes('_occAddSyncN++;   // 本盒已直写收编'),'P10 registerDynCollider 直写收编计数在位');
ok(s15.includes('markNavDirty(true); // ★2026-11-19'),'P11 碾铁丝网旗翻强制全量在位 (15-vehicles)');
ok(s06.includes("if(typeof markNavDirty==='function') markNavDirty(true);"),'P12 玩家拆除强制全量在位 (06-engineering, 兼修旧漏报)');
ok(s17.includes('if(c.team===team){ if(d<28) crowd+=1-d/28; }')&&s17.includes('else { if(d<nearestEnemy) nearestEnemy=d; if(d<45) eCnt++; }'),'P13 pickSpawnFor 融合单遍扫在位 (28m 拥挤+45m 敌账同权)');
ok(s17.includes('sc-=crowd*LANE_CROWD_W;'),'P14 lane 拥挤权重行原样 (34 分软天平)');
ok(s17.includes('if(c.team===team){ if(d<22) crowd+=1-Math.exp(-d/4.5); }')&&s17.includes('const ePen=(eNear<16)?280:((eNear<30)?100:0);'),'P15 pickSpawnPoint tryRings 融合+敌近惩罚档原样');
ok(s11.includes('const _wgCache=new Map();')&&s11.includes('const hit=_wgCache.get(ck);')&&s11.includes('_wgCache.set(ck,g);')&&s11.includes('return g.clone();'),'P16 枪模缓存四件套在位 (11-soldiers worldGunModel)');
ok(s14.includes('const _clmS=[];')&&s14.includes('const _fcD=[],_fcP=[];'),'P17 防守收账槽+掩体候选槽声明在位 (14-bots)');
ok(s14.includes('if(pos>=12) continue;')&&s14.includes('if(cands.length>12){ cands.pop(); candsP.pop(); }'),'P18 findCoverFrom 有界插入 top-12 在位');
ok(s14.includes('if(cands.length>10){ cands.pop(); candsP.pop(); }'),'P19 findCoverToward 有界插入 top-10 在位');
ok(s14.split('const org=V3(threat.x,Math.max(threat.y,heightAt(threat.x,threat.z))+1.5,threat.z);').length-1===2,'P20 射线起点 org 两处外提 (findCoverFrom/Toward 各一, 原每候选重算)');
ok(s14.includes('if(self._aaScT!==undefined&&nowT-self._aaScT<0.25&&self._aaScC&&self._aaScC.alive) return self._aaScC;')&&s14.includes('self._aaScT=nowT; self._aaScC=best;'),'P21 AA 选Target 0.25s 缓存读写两行在位 (含 alive 门=认领目标亡即重投, R3 语义)');
ok(s14.includes('7*7*1.000001'),'P22 手雷聚拢三轴平方比较在位 (1.000001 相对裕量=875 行同款)');
ok(s14.includes('const dd=d+rand(0,14)+crowd*9;')&&s14.includes('const r2c=1.7*1.7;')&&s14.includes('if(hm) crowd++;'),'P23 defend 内联 crowd 账在位 (权重×9/1.7m 半径/只数同队)');
ok(!s08.includes('_wxStepAcc'),'T10 批纪律: 降水逐帧步进回滚态保持 (_wxStepAcc 未复活, 本批零触碰 08-effects)');

// ── 场地: camp0 起局 (NAV 场地/枪模/出生链测试前提; 探针不驱动世界 tick, 只直调被测函数) ──
const ctx=boot(0);
const G=s=>vm.runInContext(s,ctx);
let err0=null;
try{ G("document.getElementById('startBtn').onclick();"); }catch(e){ err0=String(e&&e.stack||e); }
if(!err0){ try{ G('if(!player.alive||!player.deployed) deployPlayer();'); }catch(e){ err0='deployPlayer: '+String(e&&e.stack||e); } }
if(err0||!G('CAMPAIGNS.length>0')){ console.log('  ✘ 开局/部署失败 '+(err0||'CAMPAIGNS 空')); process.exit(1); }
G('for(const s of soldiers) s.protUntil=0; player.protUntil=0;');
ok(G('typeof NAV!=="undefined"&&typeof NAV.refresh==="function"&&!!NAV.stats'),'前置: NAV 可用 (refresh+stats)');

// buildOccupancy 调用计数 (裸名重绑定; "全量重建是否发生"的直接判据)
G('(function(){ window.__boOrig=buildOccupancy; window.__boN=0; buildOccupancy=function(){ window.__boN++; return window.__boOrig(); }; })()');
const boN=()=>Number(G('window.__boN'));
function NAVf(k){ return Number(G('NAV.stats.'+k+'||0')); }
function delta(a,b){ return {f:b.f-a.f,p:b.p-a.p,sk:b.sk-a.sk,fb:b.fb-a.fb}; }
// 归位: 起局后先走一次全量 (尾账把配额/门控计数清零), 再清残留登记 (探针专局, 不影响真局)
G('NAV.refresh(true); occDirtyClear(); if(OCC.pendList) OCC.pendList=null;');
if(!G('!!OCC.data&&NAV.stats')){ console.log('  ✘ OCC 未建 (场地异常)'); process.exit(1); }

// 空地点位器 (避开建筑/水): 探针摆件互不重叠
G(`(function(){ window.__freeSpots=[]; const R=MAP_SIZE*0.30;
for(let t=0;t<4000&&window.__freeSpots.length<10;t++){
const x=(Math.random()*2-1)*R, z=(Math.random()*2-1)*R;
if(NAV.blocked2D(x,z)) continue;
let far=true; for(const q of window.__freeSpots){ if(Math.hypot(q.x-x,q.z-z)<8){ far=false; break; } }
if(far) window.__freeSpots.push({x:x,z:z});
} })()`);
const spots=G('window.__freeSpots');
ok(Array.isArray(spots)&&spots.length>=9,'前置: 找到 ≥9 个互距 8m 的空地摆件位 (实得 '+(Array.isArray(spots)?spots.length:0)+')');
if(!Array.isArray(spots)||spots.length<9){ console.log('  ✘ 场地空位不足, 中止 (占用过密?)'); process.exit(1); }

// T1 registerDynCollider → 快路径 (直写收编 ⇒ 双计数齐平, 跳过 buildOccupancy)
{
G('window.__boN=0;');
const b0={f:NAVf('fullBakes'),p:NAVf('partBakes'),sk:NAVf('skipBakes'),fb:NAVf('fastBakes')};
G(`(function(){ const s=window.__freeSpots[0]; registerDynCollider(s.x,heightAt(s.x,s.z)+1,s.z,2,2,2); NAV.refresh(); })()`);
const d1=delta(b0,{f:NAVf('fullBakes'),p:NAVf('partBakes'),sk:NAVf('skipBakes'),fb:NAVf('fastBakes')});
ok(boN()===0,'T1a registerDynCollider+refresh 跳过 buildOccupancy 全量重建 (直写收编=双计数齐平)');
ok(d1.fb===1&&d1.p>=1,'T1b 快路径按登记簇直接烘焙 (fastBakes+1, partBakes+'+d1.p+')');
ok(G('NAV.blocked2D(window.__freeSpots[0].x,window.__freeSpots[0].z)')===true,'T1c 摆件落格即阻挡 (占用直写+NAV 簇烘焙双账齐)');
ok(Number(G('OCC.pendList&&OCC.pendList.length||0'))===0,'T1d 登记簇已消费清账 (pendList 空)');
}

// T2 无登记簇 → 快路径 skip 分支 (连烘焙都不做)
{
G('occDirtyClear(); if(OCC.pendList) OCC.pendList=null; window.__boN=0;');
const b0={f:NAVf('fullBakes'),p:NAVf('partBakes'),sk:NAVf('skipBakes'),fb:NAVf('fastBakes')};
G('NAV.refresh()');
const d2=delta(b0,{f:NAVf('fullBakes'),p:NAVf('partBakes'),sk:NAVf('skipBakes'),fb:NAVf('fastBakes')});
ok(boN()===0,'T2a 无登记簇 refresh 走快路径 (buildOccupancy 未跑)');
ok(d2.sk===1&&d2.fb===0&&d2.f===0,'T2b skip 计数+1 且零烘焙 (fastBakes/fullBakes/partBakes 全不动)');
}

// T3 1全:3快 配额 + 全量后重武装
{
G('NAV.refresh(true); occDirtyClear(); if(OCC.pendList) OCC.pendList=null; window.__boN=0;');   // 配额归零 (强制全量, 尾账清计数)
G('(function(){ window.__ks=[]; for(let k=1;k<=4;k++){ const s=window.__freeSpots[k]; window.__ks.push(registerDynCollider(s.x,heightAt(s.x,s.z)+1,s.z,2,2,2)); } })()');
let fastN=0, fullAt=-1;
for(let k=0;k<4;k++){
const b0=NAVf('fastBakes');
G(`killDynCollider(window.__ks[${k}]); NAV.refresh();`);
const fb=NAVf('fastBakes');
if(boN()>0){ fullAt=k; G('window.__boN=0;'); break; }
if(fb>b0){ fastN++; } else break;
}
ok(fullAt===3&&fastN===3,'T3a 连续 3 次快刷后第 4 次回插全量 (1全:3快; 实得 快'+fastN+'后全量@'+fullAt+')');
const b0f=NAVf('fastBakes');
G('occTouch(window.__freeSpots[5].x-1,window.__freeSpots[5].z-1,window.__freeSpots[5].x+1,window.__freeSpots[5].z+1); NAV.refresh();');
ok(boN()===0&&NAVf('fastBakes')>b0f,'T3b 全量后配额重武装 (下次 refresh 重新走快路径)');
}

// T4 裸直调 addBoxCollider → 双计数门关 → 全量收编 (A/B 实锤回归案专项闸)
{
G('NAV.refresh(true); occDirtyClear(); if(OCC.pendList) OCC.pendList=null; window.__boN=0;');
const s=spots[6];
G(`addBoxCollider(${s.x},heightAt(${s.x},${s.z})+1,${s.z},2,2,2); NAV.refresh();`);
ok(boN()===1,'T4a 裸 addBoxCollider (只入 BOXES 表不写 OCC.data) ⇒ refresh 回退全量重建');
ok(G(`NAV.blocked2D(${s.x},${s.z})`)===true,'T4b 新盒被全量重建收编变阻挡 (verify-nav 1m 厚墙案)');
}

// T5 markNavDirty(true) 强制全量 / markNavDirty() 快路径消费
{
G('NAV.refresh(true); occDirtyClear(); if(OCC.pendList) OCC.pendList=null; window.__boN=0;');
G('markNavDirty(true); occTouch(window.__freeSpots[7].x-1,window.__freeSpots[7].z-1,window.__freeSpots[7].x+1,window.__freeSpots[7].z+1); updateNavDirty(0.7);');
ok(boN()===1,'T5a markNavDirty(true) ⇒ 延迟刷新强制全量 (旗翻型改动无占用直写配套)');
G('window.__boN=0;');
const b0p=NAVf('partBakes');
G('markNavDirty(); occTouch(window.__freeSpots[8].x-1,window.__freeSpots[8].z-1,window.__freeSpots[8].x+1,window.__freeSpots[8].z+1); updateNavDirty(0.7);');
ok(boN()===0,'T5b markNavDirty() 普通延迟刷新走快路径 (buildOccupancy 未跑)');
ok(NAVf('partBakes')>b0p,'T5c 延迟刷新按登记簇直接烘焙 (驱动链 markNavDirty→updateNavDirty→refresh 全通)');
}

// T6 枪模缓存 (行为钉): 实例独立 + 子件深拷贝齐备 + 几何共享 + 缓存键 kind|team
{
const r=G(`(function(){
const a=worldGunModel('smg',0,null), b=worldGunModel('smg',0,null);
const ga=[],gb=[]; a.traverse(o=>{ if(o.isMesh) ga.push(o.geometry); }); b.traverse(o=>{ if(o.isMesh) gb.push(o.geometry); });
worldGunModel('rifle',1,null); worldGunModel('mg',0,null);
return {distinct:a!==b, n:ga.length, same:ga.length===gb.length&&ga.every((g,i)=>g===gb[i]),
size:_wgCache.size, rifleIn:_wgCache.has('rifle|1|'), mgIn:_wgCache.has('mg|0|')};
})()`);
ok(!!r&&r.distinct,'T6a 两次取枪=彼此独立的组实例 (clone 出货, 不共享实例)');
ok(!!r&&r.n>0&&r.same,'T6b 深拷贝子件齐备且 geometry 共享 (真 Object3D.copy 语义; 浅拷贝桩=空壳即红)');
ok(!!r&&r.size>=3&&r.rifleIn&&r.mgIn,'T6c 缓存按 kind|team 收纳 (实得 size='+((r&&r.size)||0)+')');
if(!r||!(r.distinct&&r.same)) console.log('    [T6 诊断] '+JSON.stringify(r));
}

// T7 pickSpawnFor 融合单遍扫 (行为烟测: 出点有效+两次调用稳定)
{
const r=G(`(function(){
const a=pickSpawnFor(0); const lim=MAP_SIZE/2;
if(!a||!isFinite(a.cx)||!isFinite(a.cz)) return {ok:false,r:a};
if(Math.abs(a.cx)>lim||Math.abs(a.cz)>lim) return {ok:false,oob:true,cx:a.cx,cz:a.cz};
const b=pickSpawnFor(0);
return {ok:true,kind:a.kind||'?',two:!!b&&isFinite(b.cx)};
})()`);
ok(!!r&&r.ok===true,'T7a pickSpawnFor(0) 出有效 lane 点 (融合后评分链无缺账)');
ok(!!r&&r.two===true,'T7b 连续两次调用稳定 (重生风暴连发不炸)');
if(!r||!(r.ok&&r.two)) console.log('    [T7 诊断] '+JSON.stringify(r));
}

// T8 findCoverFrom 有界插入 top-12 (行为钉): 10 个不挡弹候选 + 1 个挡弹候选 (共 11 = 配额内) ⇒ 选中挡弹者
// 判据语义 (照 14-bots 原口径): 射线从威胁打向候选 —— 落空 (null)=视线穿=不算掩体; 打在威胁与候选
// 之间 (hit.dist≤dist-0.8)=有遮挡=合格掩体。heightAt 重绑平地 (探针专局) ⇒ org/dir 各候选同构,
// 桩内按 dir 反解候选身份 (dir.y=-0.6/|v| 恒定 → |v|=-0.6/dir.y → 候选 bot 相对 dx=20+dir.x*|v|),
// 只有挡弹者 (dx=6) 回 {dist:3}, 其余全回 null —— 候选身份与几何比率解耦, 判别零漂移。
{
const r=G(`(function(){
const b=soldiers.find(s=>s&&s.findCoverFrom)||(typeof combatants!=='undefined'?combatants.find(s=>s&&s.findCoverFrom):null);
if(!b) return {err:'no bot'};
const svCP=coverPoints.splice(0,coverPoints.length), svRW=raycastWorld, svHA=heightAt, svCd=b.coverCd;
b.coverCd=0;
const bx=b.pos.x, bz=b.pos.z, th={x:bx+20,y:10,z:bz};
try{
heightAt=function(){ return 10; };   // 平地 (探针专局, finally 还原)
coverPoints.length=0;
const pts=[];
for(let d=3;d<=13;d++){ if(d===6) continue; pts.push({x:bx+d,y:0,z:bz}); }   // 10 个不挡弹 (视线穿)
pts.push({x:bx+6,y:0,z:bz});                                                // 第 11 个: 唯一挡弹者 (排扫描序末位)
for(const p of pts) coverPoints.push(p);
raycastWorld=function(o,d,l){ const mag=(d.y!==0)?(-0.6/d.y):l; const dx=20+d.x*mag; return (Math.abs(dx-6)<0.5)?{dist:3}:null; };
const cp=b.findCoverFrom(th);
return {hit:!!cp&&Math.abs(cp.x-(bx+6))<0.01&&Math.abs(cp.z-bz)<0.01, got:cp?{x:cp.x-bx,z:cp.z-bz}:null};
}finally{
coverPoints.length=0; for(const q of svCP) coverPoints.push(q);
raycastWorld=svRW; heightAt=svHA; b.coverCd=svCd;
}
})()`);
ok(!!r&&r.hit===true,'T8 top-12 槽内扫描序无关 (唯一挡弹候选排在末位仍被选中 = 稳定全排序取前 12 同果)');
if(!r||r.hit!==true) console.log('    [T8 诊断] '+JSON.stringify(r));
}

// T9 aaSpreadTarget 0.25s 缓存 (行为钉): TTL 内短路由 (挪机也不换), TTL 过重算, 粘滞档直通
{
const r=G(`(function(){
const svP=planes.splice(0,planes.length), svC=combatants.splice(0,combatants.length), t0=nowT;
try{
const P={alive:true,team:1,pos:{x:100,y:50,z:100}};
const P2={alive:true,team:1,pos:{x:10,y:50,z:10}};
planes.push(P,P2);
const c1={alive:true,team:0,empUse:{kind:'aa'},_aaTgt:P};
const c2={alive:true,team:0,empUse:{kind:'aa'},_aaTgt:P2};
combatants.push(c1,c2);
const self={_aaTgt:null};
const a1=aaSpreadTarget(0,self,0,0);            // 平手取近者=P2, 结果入缓存
P2.pos.x=300; P2.pos.z=300;                     // TTL 内挪远 P2
const a2=aaSpreadTarget(0,self,0,0);            // 缓存短路由: 仍回 P2 (不重算)
P2.alive=false;                                 // TTL 内认领目标亡
const a2b=aaSpreadTarget(0,self,0,0);           // alive 门: 缓存即失效 → 重投账本取 P (R3 语义)
nowT=t0+0.3;                                    // 越过 TTL
const a3=aaSpreadTarget(0,self,0,0);            // 重算: 仍取 P
const self2={_aaTgt:P};
const a4=aaSpreadTarget(0,self2,0,0);           // 粘滞档: 直通 _aaTgt, 不看缓存
nowT=t0;
return {c1:a1===P2, c2:(a2===P2), c2b:(a2b===P), c3:(a3===P), c4:(a4===P), fresh:(self._aaScC===P)};
}finally{
planes.splice(0,planes.length); for(const q of svP) planes.push(q);
combatants.splice(0,combatants.length); for(const q of svC) combatants.push(q);
}
})()`);
ok(!!r&&r.c1===true,'T9a 无粘滞档认领数平手取近者 (分摊账本语义不变)');
ok(!!r&&r.c2===true,'T9b TTL 内缓存短路由 (挪机也不换目标 = 0.25s 新鲜度)');
ok(!!r&&r.c2b===true,'T9b2 认领目标亡 ⇒ 缓存即失效重投账本 (alive 门, R3 重派语义, 不吃 0.25s 延迟)');
ok(!!r&&r.c3===true,'T9c 越过 TTL 重算 (缓存不永久)');
ok(!!r&&r.c4===true,'T9d 粘滞档直通 (缓存只服务无粘滞路径)');
ok(!!r&&r.fresh===true,'T9e 重算后缓存账同步刷新 (_aaScC)');
if(!r||!(r.c2&&r.c3)) console.log('    [T9 诊断] '+JSON.stringify(r));
}

console.log('');
console.log('正向 '+PASS.length+'/'+(PASS.length+FAILN)+(FAILN?('  失败 '+FAILN+' 项'):'  全过'));

// ── NEG 阴性对照: 逐补丁独立 boot (每补丁单独应用+单 boot, 目标判据必须报红) ──
// ★本探针 NEG 必须 isolation 制: N1/N2/N3 同 patch 07-nav 的门表达式, 同跑会互相毒化
//   (N1 门杀会让 N2/N3 的世界也门死) —— frameperf2 的"全部补丁同跑"模式只适用于互不相干的补丁组。
if(NEG){
console.log('\n── NEG 阴性对照 (逐补丁隔离 boot, 目标判据须红) ──');
function negStart(c){
const g=s=>vm.runInContext(s,c);
g("document.getElementById('startBtn').onclick();");
g('if(!player.alive||!player.deployed) deployPlayer();');
g('NAV.refresh(true); occDirtyClear(); if(OCC.pendList) OCC.pendList=null;');
g('(function(){ window.__boOrig=buildOccupancy; window.__boN=0; buildOccupancy=function(){ window.__boN++; return window.__boOrig(); }; })()');
g(`(function(){ window.__freeSpots=[]; const R=MAP_SIZE*0.30;
for(let t=0;t<4000&&window.__freeSpots.length<2;t++){
const x=(Math.random()*2-1)*R, z=(Math.random()*2-1)*R;
if(NAV.blocked2D(x,z)) continue;
if(window.__freeSpots.length&&Math.hypot(window.__freeSpots[0].x-x,window.__freeSpots[0].z-z)<8) continue;
window.__freeSpots.push({x:x,z:z});
} })()`);
return g;
}
// 单补丁 boot: 只应用 NEG_PATCHES[pi], 其余文件走 LC 共享编译缓存
function bootNeg(pi){
const [pf,from,to]=NEG_PATCHES[pi];
const txt=LC.src(root,pf);
if(txt.indexOf(from)<0){ console.log('✗ NEG 锚缺失: '+pf+' :: '+from.slice(0,60)); process.exit(1); }
const patched=txt.split(from).join(to);
for(const k in stub.byId)delete stub.byId[k];
const ctx=vm.createContext(Object.assign({},stub.sandbox));
ctx.document=stub.document; ctx.window=stub.window; ctx.CANNON=CANNON;
ctx.localStorage={_s:{sf_campaign:'0'},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of FILES){ const sc=(f===pf)?new vm.Script(patched,{filename:f}):LC.script(root,f); sc.runInContext(ctx); }
return ctx;
}
let negRed=0,negTot=0;
function negCheck(name,pi,fn,label){
negTot++;
try{ const c=bootNeg(pi), g=negStart(c); const red=fn(c,g);
if(red){ negRed++; console.log('  ✓ '+name+' 预期红: '+label); } else console.log('  ✗ '+name+' 未转红 (判据失效!): '+label); }
catch(e){ negRed++; console.log('  ✓ '+name+' 预期红 (抛错也算红): '+String(e&&e.message||e).slice(0,80)); }
}
// N1 快路径门杀 → registerDynCollider+refresh 也全量 (红=boN>0)
negCheck('N1',0,(c,g)=>{ const f0=Number(vm.runInContext('NAV.stats.fastBakes||0',c));
g('(function(){ const s=window.__freeSpots[0]; registerDynCollider(s.x,heightAt(s.x,s.z)+1,s.z,2,2,2); NAV.refresh(); })()');
return Number(vm.runInContext('window.__boN',c))>0; },'T1 (快路径永不 engage=红)');
// N2 摘双计数门 → 裸 addBoxCollider 不被收编 (红=落格仍不阻挡)
negCheck('N2',1,(c,g)=>{
g('(function(){ const s=window.__freeSpots[1]; addBoxCollider(s.x,heightAt(s.x,s.z)+1,s.z,2,2,2); NAV.refresh(); })()');
return vm.runInContext('NAV.blocked2D(window.__freeSpots[1].x,window.__freeSpots[1].z)',c)!==true; },'T4 (新盒不阻挡=NAV 陈旧格=红)');
// N3 摘 markNavDirty(true) 强制位 → 强制全量不发生 (红=boN===0)
negCheck('N3',2,(c,g)=>{
g('(function(){ markNavDirty(true); occTouch(window.__freeSpots[0].x-1,window.__freeSpots[0].z-1,window.__freeSpots[0].x+1,window.__freeSpots[0].z+1); updateNavDirty(0.7); })()');
return Number(vm.runInContext('window.__boN',c))===0; },'T5a (强制全量丢失=红)');
// N4 摘枪模缓存登记行 → 缓存恒空 (红=size<3)
negCheck('N4',3,(c,g)=>{
const r=vm.runInContext(`(function(){ worldGunModel('smg',0,null); worldGunModel('rifle',1,null); worldGunModel('mg',0,null); return _wgCache.size; })()`,c);
return Number(r)<3; },'T6c (缓存不收纳=红)');
// N5 摘 cover top-12 弹出上限 → 源码钉红 (钉被摘, 补丁后文本判)
negCheck('N5',4,(c,g)=>{ const [,from,to]=NEG_PATCHES[4];
const s=LC.src(root,'js/14-bots.js').split(from).join(to);
return !(s.includes('if(cands.length>12){ cands.pop(); candsP.pop(); }')&&s.includes('if(pos>=12) continue;')); },'P18 (top-12 结构钉被摘=红)');
// N6 摘 AA 缓存 → TTL 内也重算 (红=挪机后即换目标)
negCheck('N6',5,(c,g)=>{
const r=vm.runInContext(`(function(){
const svP=planes.splice(0,planes.length), svC=combatants.splice(0,combatants.length), t0=nowT;
try{
const P={alive:true,team:1,pos:{x:100,y:50,z:100}};
const P2={alive:true,team:1,pos:{x:10,y:50,z:10}};
planes.push(P,P2);
combatants.push({alive:true,team:0,empUse:{kind:'aa'},_aaTgt:P},{alive:true,team:0,empUse:{kind:'aa'},_aaTgt:P2});
const self={_aaTgt:null};
aaSpreadTarget(0,self,0,0);
P2.pos.x=300; P2.pos.z=300;
return aaSpreadTarget(0,self,0,0)===P2;
}finally{
planes.splice(0,planes.length); for(const q of svP) planes.push(q);
combatants.splice(0,combatants.length); for(const q of svC) combatants.push(q);
nowT=t0;
}
})()`,c);
return r!==true; },'T9b (TTL 内重算=缓存失效=红)');
// N7 摘 defend 内联 crowd 权重行 → 源码钉红 (挤占惩罚消失, 补丁后文本判)
negCheck('N7',6,(c,g)=>{ const [,from,to]=NEG_PATCHES[6];
const s=LC.src(root,'js/14-bots.js').split(from).join(to);
return !s.includes('const dd=d+rand(0,14)+crowd*9;'); },'P23 (权重行被摘=红)');
console.log('阴性对认: '+negRed+'/'+negTot+' 红'+(negRed===negTot?'  (全部对认)':'  (有未转红项!)'));
process.exit(negRed===negTot?0:1);
}
process.exit(FAILN?1:0);
