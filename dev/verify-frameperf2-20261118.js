// ─────────────────────────────────────────────
// dev/verify-frameperf2-20261118.js —— 全局卡顿审计修复批 (2026-11-18 用户报"明显可感的卡顿"):
//   T1 24-main 重复 updateFires 摘除 (7fb72eb 误插: 火焰蔓延/燃烧账每帧推进 2×, 火池 360s 实跑 180s)
//   T2 指挥官底图烘焙门 (cmdFrameTick 起作业门 + cmdDeployOpen 门补 cmdIsCommander; advance 行不动=探针钉保留)
//   T3 非指挥官不烘焙 (行为钉: 90 帧 cmdFrameTick 后 bake/_bj 恒 null —— 旧写每帧 8-10ms×约1.5s 人人有份)
//   T4 指挥官照常烘焙 (行为钉: cls=5 后 cmdFrameTick 一次即起作业)
//   T5 tankPerceive 两段式同果 (评分段无射线收槽 → 按分降序 LOS 复核取第一个过线者: 近车被挡时
//      仍选中"分更低但看得见"的远车 = 与旧逐候选 LOS+评分完全同果; 常态射线 ~N→~1 发)
//   T6 感知相位出生打散 (aiPerT=rand(0,TANK_PER_T): 旧写全员同相位, 每 0.14s 全场坦克同帧感知 = 尖峰成簇)
//   T7 底盘碰撞 pass2 跳过 (第一遍零接触 ⇒ 位姿未变第二遍必然零接触)
//   T8 旗布 30Hz + 平方距离 (波形=nowT 纯函数, 采样帧逐位同值; needsUpdate 只在步进帧置位)
//   T9 强点扫描平方距离 (updateSpots 与 updateFlags 同批)
//   T10 降水粒子逐帧步进 (★2026-11-18 实机返修回滚 30Hz: 雨落速 27-36m/s 半帧率更新=时间混叠,
//       实机观感"雨雪严重抖动/帧率很低"; 位移总量守恒救不了采样欠步; wxShiftPrecip 每帧照跑 = fixbatch 源文本钉保持)
//   T11 布娃娃整世界 step 跳过 (全员冻结且无散落残骸 ⇒ step 跳过; 冻结具钉回快照/解冻探速不经 step ⇒ 判据不变)
//   T12 cmdFocusHudTick 缓存 (非指挥官稳态零 getElementById; 可见路径元素缓存+变了才写)
//   T13 spawn lane 表 0.5s 缓存 (重生风暴共享建表; FLAGS/SPOTS 换代失效; convoy 直通保 RNG 流)
//   T14 resolveRuntimeSurfaces 候选复用 (稳态零数组/闭包分配)
//   T15 _gunAnchorTorso memo (grip/fore 各一槽; 命中只值拷贝进 out 不碰对外槽; 参数切换后正确重算)
//   T16 24-main 部署按钮 span 跨帧缓存 (死亡期每帧 querySelector → 命中后零查询)
//   T17 降水逐帧步进在位 (源码钉: _wxStepAcc 累加账不得复活 + dt 直乘两行在位)
// 用法: node dev/verify-frameperf2-20261118.js [--neg]
//   --neg = 阴性对照 (单跑逐补丁应用, 目标判据必须报红, 对认按红名):
//     N1 摘烘焙指挥官门 → T3 红 (非指挥官烘焙复发)
//     N2 24-main 复插重复 updateFires → T1 红
//     N3 tankPerceive 摘 LOS 复核守卫 → T5 红 (高分被挡目标被选中 = 旧病复活)
//     N4 旗布节流阈值归零 → T8 红 (逐帧重写 45 顶点)
//     N5 降水写入隔帧跳过 (节流复发模拟) → T10 红 (写入数<60)
//     N6 布娃娃 step 门摘除 → T11 红 (全员冻结仍整世界 step)
//     N7 摘锚点 memo 登记行 → T15 源码钉红
//     N8 lane 缓存 TTL 恒假 → T13 红 (每次重建)
//     N9 摘部署按钮 span 缓存 → T16 红
// ★沙箱注: _bootstub 的 sandbox.globalThis=sandbox 遮蔽真 globalThis ⇒ 注入一律裸名赋值;
//   跨 vm 取对象 === 不可靠 ⇒ 引用比较一律写成上下文内单表达式;
//   flagGeo/precip 的 attributes.position 为普通对象 ⇒ needsUpdate 可 defineProperty 计数。
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
// N1 摘烘焙指挥官门 → T3 红
['js/26-commander.js','cmdClassAvailable()&&cmdIsCommander()','cmdClassAvailable()'],
// N2 复插重复 updateFires → T1 红
['js/24-main.js','updateTreeBursts(dt); // 环境炮击: 许特根树爆(空爆) / 草原炮火犁地(贴地+点麦田) (04b-fire)','updateFires(dt);\nupdateTreeBursts(dt); // 环境炮击: 许特根树爆(空爆) / 草原炮火犁地(贴地+点麦田) (04b-fire)'],
// N3 tankPerceive 摘 LOS 复核守卫 → T5 红 (高分被挡目标被选中)
['js/15-vehicles.js','if(hit&&hit.dist<hl-1.2) continue;',';'],
// N4 旗布节流阈值归零 → T8 红 (逐帧重写)
['js/21-match.js','f._clothT=1/30;','f._clothT=0;'],
// N5 降水写入隔帧跳过 (节流复发模拟) → T10 红
['js/08-effects.js','pos.needsUpdate=true;','pos._nuT=!pos._nuT; pos.needsUpdate=pos._nuT;'],
// N6 布娃娃 step 门摘除 → T11 红
['js/12-ragdolls.js','if(_ragLive||DEBRIS.list.length) RAG.world.step(1/60,Math.min(dt,0.05),4);','RAG.world.step(1/60,Math.min(dt,0.05),4);'],
// N7 摘锚点 memo 登记行 → T15 源码钉红
['js/11-soldiers.js','_c.k=kind; _c.rx=rx; _c.ry=ry; _c.rz=rz; _c.pp=pp;',';'],
// N8 lane 缓存 TTL 恒假 → T13 红
['js/17-emplacements.js','nowT-_lc.t<0.5','false'],
// N9 摘部署按钮 span 缓存 → T16 红
['js/24-main.js',"btn._spC||(btn._spC=btn.querySelector('[data-i18n]'))","btn.querySelector('[data-i18n]')"],
];
if(NEG) for(const [f,from,to] of NEG_PATCHES){
if(SRC[f]===undefined) SRC[f]=fs.readFileSync(path.join(root,f),'utf8');
if(SRC[f].indexOf(from)<0){ console.log('✗ NEG 锚缺失: '+f+' :: '+from.slice(0,60)); process.exit(1); }
PATCH_MAP[f]=(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC[f]).split(from).join(to);
}
if(NEG) console.log('NEG 载入补丁键: '+Object.keys(PATCH_MAP).join(', ')+' | 24-main updateFires 计数='+((PATCH_MAP['js/24-main.js']||'').match(/updateFires\(dt\);/g)||[]).length);
const LC=require('./_loadcache.js'); // 2026-11-19 效率批
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:LC.src(root,f));
const SCR={}; // 按 f memo 编译 (srcOf(f) 每进程恒定: PATCH_MAP 模块载入期定死 ⇒ 键 f 安全)

function boot(campIdx,extraLs){
for(const k in stub.byId)delete stub.byId[k];
const ctx=vm.createContext(Object.assign({},stub.sandbox));
ctx.document=stub.document; ctx.window=stub.window; ctx.CANNON=CANNON;
ctx.localStorage={_s:Object.assign({sf_campaign:String(campIdx)},extraLs||{}),getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of FILES) (SCR[f]||(SCR[f]=new vm.Script(srcOf(f),{filename:f}))).runInContext(ctx); // 2026-11-19 效率批: 编译缓存 (8 boot)
return ctx;
}
const PASS=[];let FAILN=0;
function ok(cond,label){
if(cond){ PASS.push(label); console.log('  ✔ '+label); }
else { FAILN++; console.log('  ✘ '+label); }
}
ok(/__sfStyleVer='202611(19|20|21)[a-z]'/.test(html),'前置: 版本戳 20261119x-20261121x 在位 (index.html 内联, 正则兼容并行升戳)');

// ── 源码钉 (无需 boot) ──
const s24=srcOf('js/24-main.js'),s26=srcOf('js/26-commander.js'),s15=srcOf('js/15-vehicles.js'),
s21=srcOf('js/21-match.js'),s08=srcOf('js/08-effects.js'),s12=srcOf('js/12-ragdolls.js'),
s11=srcOf('js/11-soldiers.js'),s17=srcOf('js/17-emplacements.js'),s05=srcOf('js/05-world.js'),s16=srcOf('js/16-aircraft.js');

ok((s24.match(/updateFires\(dt\);/g)||[]).length===1,'T1 24-main updateFires(dt) 恰好 1 处 (重复调用已摘)');
ok(s24.includes('btn._spC||(btn._spC=btn.querySelector'),"T16 24-main 部署按钮 span 跨帧缓存 (btn._spC) 在位");
ok(s26.includes('cmdClassAvailable()&&cmdIsCommander()')&&s26.includes('cmdIsCommander()&&cmdBakeNeeded()'),'T2 烘焙双入口指挥官门在位 (cmdFrameTick+cmdDeployOpen)');
ok(s26.includes('if(CMD._bj){ try{ cmdBakeAdvance(CMD_BAKE_BUDGET_MS); }catch(e){ CMD._bj=null; } }'),'T2b advance 预算行原样保留 (verify-commander 探针钉不漂)');
ok(s15.includes('aiPerT=(_tkPhaseSeq++)%8*(TANK_PER_T/8)'),'T6a 感知相位出生打散在位 (确定性序号, 不消费 rand)');
ok(s15.includes('if(pass===1&&!hitObstacle) break;'),'T7 底盘 pass2 零接触跳过在位');
ok(s15.includes('_tkPerIdx.sort(_tkPerCmp)')&&s15.includes('const hit=raycastWorld(V3(ex,ey,ez),V3(hx,hy,hz),hl);'),'T5a tankPerceive 两段式结构在位 (评分槽+降序复核)');
ok(s21.includes('_fr2=f.r*f.r')&&s21.includes('f._clothT=1/30'),'T8a 旗布平方距离+30Hz 节流在位');
ok(s21.includes('_sr2=s.r*s.r')&&!s21.includes('Math.hypot(c.pos.x-s.x'),'T9 强点扫描平方距离在位 (hypot 已摘)');
ok(!s08.includes('_wxStepAcc')&&s08.includes('let y=arr[i3+1]-dt*WX_CFG.precipFall;')&&s08.includes('let y=arr[i3+1]-dt*sp;'),'T17 降水逐帧步进在位 (_wxStepAcc 30Hz 累加账已回滚=实机雨雪抖动)');
ok(s08.includes('wxShiftPrecip(ddx,ddy,ddz)'),'T10a wxShiftPrecip 每帧调用行原样 (fixbatch 源文本钉)');
ok(s12.includes('if(_ragLive||DEBRIS.list.length) RAG.world.step'),'T11a 布娃娃整步跳过门在位');
ok(s11.includes('_c.k=kind; _c.rx=rx; _c.ry=ry; _c.rz=rz; _c.pp=pp;'),'T15a 锚点 memo 登记行在位');
ok(s11.includes('const _m=_c.v; out.x=_m.x; out.y=_m.y; out.z=_m.z;'),'T15b memo 命中=值拷贝进 out (不别名/不碰对外槽)');
ok(s17.includes('nowT-_lc.t<0.5')&&s17.includes("GAMEMODE!=='convoy'"),"T13a lane 表 0.5s 缓存+convoy 直通在位");
ok(s05.includes('const cand=_rtCand; cand.length=0;'),'T14 resolveRuntimeSurfaces 候选复用在位');
ok(s16.includes('_fkMinX')&&s16.includes('if(s.pos.x<_fkMinX||s.pos.x>_fkMaxX'),'T7b updateFlak 线段 AABB 快筛在位');

// ── 场地: 运行时自选首个满足 [坦克≥3 + 旗点≥1 + 可开指挥地图] 的战役 (两段式/旗布测试前提; 地图重排免疫) ──
const IDX_C=(()=>{ const c0=boot(0);
return vm.runInContext('(function(){for(let i=0;i<CAMPAIGNS.length;i++){const c=CAMPAIGNS[i];if(c.tanks&&c.tanks.length>=3&&c.flags&&c.flags.length>0&&!c.zombie&&!c.navalN&&!(c.capital&&c.capital.length))return i;}return 0;})()',c0); })();
const ctx=boot(IDX_C);
stub.window.__idx=IDX_C;   // T5 诊断用
const G=s=>vm.runInContext(s,ctx);
let err0=null;
try{ G("document.getElementById('startBtn').onclick();"); }catch(e){ err0=String(e&&e.stack||e); }
if(!err0){ try{ G('if(!player.alive||!player.deployed) deployPlayer();'); }catch(e){ err0='deployPlayer: '+String(e&&e.stack||e); } }
if(err0||!G('player.alive')){ console.log('  ✘ 开局/部署失败 '+(err0||'player.alive=false')); process.exit(1); }
G('for(const s of soldiers) s.protUntil=0; player.protUntil=0;');
ok(G('typeof CMD!=="undefined"&&CMD.orbat&&cmdClassAvailable()'),'前置: 编制已建+本图可开指挥地图 (烘焙门测试前提)');

// T3 非指挥官不烘焙 (行为钉)
G('CMD.bake=null; CMD._bj=null; player.cls=0;');
for(let i=0;i<90;i++) G('cmdFrameTick(1/60)');
ok(G('CMD.bake===null&&CMD._bj===null'),'T3 非指挥官 90 帧后底图烘焙从未起作业 (旧写每帧 8-10ms 采样已消失)');

// T4 指挥官照常烘焙 (行为钉)
G('player.cls=5;');
G('cmdFrameTick(1/60)');
ok(G('CMD._bj!==null||(CMD.bake&&CMD.bake.half!==undefined)'),'T4 指挥官 cls=5 后一帧即起烘焙作业 (部署页预热保留)');
G('CMD._bj=null; CMD.bake=null;');   // 摘作业, 后续测试不再烧采样预算

// T5 tankPerceive 两段式同果 (行为钉): 近车(高分)被挡 ⇒ 仍选中远车(低分但看得见)
ok(G('tanks.filter(t=>t.alive).length>=3'),'前置: 场上坦克 ≥3 (两段式测试前提)');
const T5SETUP=`(function(){
window.__rwOrig=raycastWorld;
const mine=tanks.filter(t=>t.team===player.team&&t.alive);
const foe=tanks.find(t=>t.team!==player.team&&t.alive&&!t.playerDriven);
if(mine.length<2||!foe) return '需要 2 辆己方坦克+1 辆敌方AI坦克';
const A=mine[0],B=mine[1];
A.pos.x=foe.pos.x; A.pos.z=foe.pos.z+18; A.pos.y=heightAt(A.pos.x,A.pos.z);
B.pos.x=foe.pos.x; B.pos.z=foe.pos.z+40; B.pos.y=heightAt(B.pos.x,B.pos.z);
foe.yaw=0; foe.turretYaw=0; foe.tVehTgt=null; foe.tMemT=0; foe.aiPerT=0; foe.tLastSeenT=-99;
window.__tkB=B;
const T=tankAITune();
const vis=T.vis*(THEME.fogMul||1)*(NIGHT_MODE?NIGHT_CFG.viewDMul:1)*WX_CFG.viewDMul;
let n=0;
raycastWorld=function(o,d,l){
const ex2=o.x+d.x*l, ez2=o.z+d.z*l;
if(Math.abs(ex2-B.pos.x)<2.5&&Math.abs(ez2-B.pos.z)<2.5){ n++; return null; }   // 朝 B 的视线放行 (可见)
return {dist:2};   // 其余一律视为被挡 (★必须近距命中: dist<hl-1.2 才判挡; dist=hl 会被当成"打中目标本身"=通视)
};
foe.tankPerceive(0.05);
raycastWorld=window.__rwOrig;
window.__rwN=n;
return {picked:(foe.tVehTgt===B),n:n,perN:_tkPerN,vis:vis,dA:Math.hypot(A.pos.x-foe.pos.x,A.pos.z-foe.pos.z),dB:Math.hypot(B.pos.x-foe.pos.x,B.pos.z-foe.pos.z),yaw:foe.yaw,team:foe.team,mine:mine.length};
})()`;
{const r=G(T5SETUP);
if(!r||!r.picked){ console.log('    [T5 诊断] r='+(typeof r==='string'?r:JSON.stringify(r))+' 场地='+(G('CAMPAIGNS[window.__idx].id')||'?')); }
ok(r&&r.picked===true,'T5 近车(高分)被挡时仍选中看得见的远车 (两段式=旧口径同果)');
ok(r&&r.n>=1,'T5b 远车视线确有放行 (复核射线确实发出, n='+((r&&r.n)||0)+')');}

// T6 感知相位打散 (行为钉): 场上坦克 aiPerT 横跨 ≥2 个相位槽 (旧写全员同相位=同帧尖峰成簇)
ok(G('(function(){const ts=tanks.filter(t=>t.alive&&t.aiPerT!==undefined);const set={};for(const t of ts)set[t.aiPerT]=1;return ts.length>=2&&Object.keys(set).length>=2;})()'),'T6b 坦克感知相位错开 (≥2 个相位槽, 旧写恒同相位)');

// T8 旗布 30Hz (行为钉): 60 帧 @1/60 → needsUpdate 写入 ~30 次
if(G('FLAGS.length>0')){
G('(function(){const fp=FLAGS[0].flagGeo.attributes.position;window.__nuW=0;Object.defineProperty(fp,"needsUpdate",{get(){return this._nu;},set(v){if(v)window.__nuW++;this._nu=v;},configurable:true});})()');
for(let i=0;i<60;i++) G('updateFlags(1/60)');
const nu=Number(G('window.__nuW'));
ok(nu>=20&&nu<=35,'T8b 旗布顶点重写 30Hz 化 (60 帧写入 '+nu+' 次, 旧写=60)');
}else{ ok(false,'T8b 场地无旗点 (canyon 布局变更?)'); }

// T10 降水逐帧步进 (行为钉, 2026-11-18 实机回滚 30Hz: 快速运动粒子半帧率更新=时间混叠抖动): canyon 原档可能无降水, 就地切 rain 档重建
G('WX_CFG.precip="rain"; WX_CFG.precipFall=27; initWeather();');
if(G('!!precipObj')){
G('(function(){const pp=precipObj.geometry.attributes.position;window.__pw=0;Object.defineProperty(pp,"needsUpdate",{get(){return this._nu;},set(v){if(v)window.__pw++;this._nu=v;},configurable:true});})()');
for(let i=0;i<60;i++) G('updateWeather(1/60)');
const pw=Number(G('window.__pw'));
ok(pw===60,'T10b 降水粒子逐帧步进 (60 帧写入 '+pw+' 次; 30Hz 节流=30 → 实机雨雪抖动已回滚)');
}else{ ok(false,'T10b initWeather 未建降水对象 (rain 档)'); }

// T11 布娃娃整步跳过 (行为钉)
G('if(!RAG.world) RAG.world={step:function(){}};   // 惰建对账: 无人伤亡时 RAG.world 为 null (真实游戏里 updateRagdolls 早退, 门不参与)');
G('(function(){const ws=RAG.world.step;window.__stepN=0;RAG.world.step=function(){window.__stepN++;return ws.apply(this,arguments);};})()');
G(`(function(){
window.__rag={frozen:true,t:9,parts:[{body:{velocity:{x:0,y:0,z:0},angularVelocity:{x:0,y:0,z:0},position:{x:50,y:2,z:50},quaternion:{x:0,y:0,z:0,w:1}}}],snap:[{x:50,y:2,z:50,qx:0,qy:0,qz:0,qw:1}]};
RAG.list.push(window.__rag);
updateRagdolls(1/60);                       // 全员冻结+无残骸 ⇒ step 应被跳过
window.__s1=window.__stepN;
window.__deb={t:9,hy:0.3,landed:false,body:{position:{x:60,y:5,z:60},velocity:{x:0,y:-1,z:0},angularVelocity:{x:0,y:0,z:0}},mesh:{position:{copy(){}},quaternion:{copy(){}}}};
DEBRIS.list.push(window.__deb);
updateRagdolls(1/60);                       // 有散落残骸 ⇒ step 照跑
window.__s2=window.__stepN;
DEBRIS.list.pop();
updateRagdolls(1/60);                       // 残骸清掉又回全员冻结 ⇒ 再跳过
window.__s3=window.__stepN;
RAG.list.pop();
})()`);
ok(Number(G('window.__s1'))===0,'T11b 全员冻结+无残骸 ⇒ RAG.world.step 跳过');
ok(Number(G('window.__s2'))===1,'T11c 有散落残骸 ⇒ step 照跑 (残骸物理不受影响)');
ok(Number(G('window.__s3'))===1,'T11d 残骸清掉后回到跳过 (门是动态的)');

// T12 cmdFocusHudTick 缓存 (行为钉)
G('_cfWrap=null;_cfBar=null;_cfLab=null;_cfHidden=null;_cfW=-1;_cfDrain=null;');   // 探针冷启动 (清 T4 期可能的缓存)
G('(function(){const og=document.getElementById;window.__gN=0;document.getElementById=function(id){if(id==="cmdFocusWrap")window.__gN++;return og(id);};})()');
G('player.cls=0;');   // T4 之后 cls=5, 先降回非指挥官
for(let i=0;i<40;i++) G('cmdFocusHudTick(false)');
const g1=Number(G('window.__gN'));
ok(g1===1,'T12b 非指挥官稳态 40 次调用仅首次隐藏落 1 次查询 (旧写每次 1 发), g1='+g1);
G('player.cls=5; player.alive=true; player.deployed=true; CMD.focus=CMD_TIME.FOCUS_MAX*0.5; CMD.slowOn=true;');
for(let i=0;i<40;i++) G('cmdFocusHudTick(true)');
const g2=Number(G('window.__gN'));
ok(g2>=1&&g2<=2,'T12c 指挥官可见路径 40 次调用仅建元素期查 1-2 次 (旧写每次 3-4 发), g2='+g2);

// T13 lane 缓存 (行为钉): 同 nowT 窗口两次 pickSpawnFor 共享同一 lane 表对象
ok(G('(function(){pickSpawnFor(0);const a=_laneCache[0];if(!a)return false;pickSpawnFor(0);return _laneCache[0]===a&&_laneCache[0].lanes.length>0;})()'),'T13b 同窗口两次 pickSpawnFor 共享 lane 表 (重生风暴免重复建表)');

// T15 锚点 memo (行为钉): 参数切换后正确重算, 交错调用不串 (★gunGripPoint 返回共享槽 ⇒ 每次调用后即时快照标量)
{const r=G(`(function(){
const A=gunGripPoint("rifle",0.10,0.20,0.30,0); const ax=A.x,ay=A.y,az=A.z;
const F=gunForePoint("rifle",0.10,0.20,0.30,0); const fx=F.x,fy=F.y,fz=F.z;
const A2=gunGripPoint("rifle",0.10,0.20,0.30,0);      // memo 命中
const a2x=A2.x,a2y=A2.y,a2z=A2.z;
const F2=gunForePoint("rifle",0.10,0.20,0.30,0);      // memo 命中 (grip/fore 各一槽不互踩)
const f2x=F2.x,f2y=F2.y,f2z=F2.z;
const B=gunGripPoint("rifle",0.15,0.25,0.35,0);       // 参数切换 → miss 重算
const bx=B.x,by=B.y,bz=B.z;
const A3=gunGripPoint("rifle",0.10,0.20,0.30,0);      // 切回 → 命中且值=A
const a3x=A3.x,a3y=A3.y,a3z=A3.z;
return {eq1:(ax===a2x&&ay===a2y&&az===a2z),eq2:(fx===f2x&&fy===f2y&&fz===f2z),
eq3:(bx!==ax||by!==ay||bz!==az),eq4:(a3x===ax&&a3y===ay&&a3z===az),
A:[ax,ay,az],B:[bx,by,bz]};
})()`);
ok(r&&r.eq1&&r.eq2&&r.eq3&&r.eq4,'T15c 锚点 memo 参数键正确 (切换/切回/交错全对)');
if(!r||!(r.eq1&&r.eq2&&r.eq3&&r.eq4)) console.log('    [T15 诊断] '+JSON.stringify(r));}

console.log('');
console.log('正向 '+PASS.length+'/'+(PASS.length+FAILN)+(FAILN?('  失败 '+FAILN+' 项'):'  全过'));

// ── NEG 阴性对照: 单补丁单 boot, 目标判据必须报红 ──
if(NEG){
console.log('\n── NEG 阴性对照 (每补丁独立 boot, 目标判据须红) ──');
const IDX=IDX_C;
function negBoot(){ return boot(IDX); }
function negStart(ctx){
const g=s=>vm.runInContext(s,ctx);
g("document.getElementById('startBtn').onclick();");
g('if(!player.alive||!player.deployed) deployPlayer();');
g('for(const s of soldiers) s.protUntil=0; player.protUntil=0;');
return g;
}
let negRed=0,negTot=0;
function negCheck(name,fn,label){
negTot++;
try{ const red=fn(); if(red){ negRed++; console.log('  ✓ '+name+' 预期红: '+label); } else console.log('  ✗ '+name+' 未转红 (判据失效!): '+label); }
catch(e){ negRed++; console.log('  ✓ '+name+' 预期红 (抛错也算红): '+String(e&&e.message||e).slice(0,80)); }
}
// N1 摘烘焙门 → 非指挥官烘焙复发 (红=bake/_bj 被起作业)
negCheck('N1',()=>{ const c=negBoot(),g=negStart(c); for(let i=0;i<90;i++) g('cmdFrameTick(1/60)');
return !g('CMD.bake===null&&CMD._bj===null'); },'T3 (非指挥官 bake 被起作业=红)');
// N2 复插重复 updateFires → 源码钉红 (红=计数≠1)
negCheck('N2',()=>{ const s=srcOf('js/24-main.js'); return (s.match(/updateFires\(dt\);/g)||[]).length!==1; },'T1 (updateFires 计数≠1=红)');
// N3 摘 LOS 复核守卫 → 高分被挡目标被选中 (红=picked=false 即选中了被挡近车)
negCheck('N3',()=>{ const c=negBoot(),g=negStart(c); const r=g(T5SETUP); return !!(r&&typeof r==='object'&&r.picked===false); },'T5 (被挡近车被选中=红)');
// N4 旗布阈值归零 → 60 帧写 60 次
// N4 旗布阈值归零 → 逐帧重写 (红=写入数>35)
negCheck('N4',()=>{ const c=negBoot(),g=negStart(c); g('(function(){const fp=FLAGS[0].flagGeo.attributes.position;window.__nuW=0;Object.defineProperty(fp,"needsUpdate",{get(){return this._nu;},set(v){if(v)window.__nuW++;this._nu=v;},configurable:true});})()');
for(let i=0;i<60;i++) g('updateFlags(1/60)'); const n=Number(g('window.__nuW')); return n>35; },'T8b (逐帧重写=红)');
// N5 降水写入隔帧跳过 (节流复发模拟) → 写入数<60 (红=节流复活)
negCheck('N5',()=>{ const c=negBoot(),g=negStart(c); g('WX_CFG.precip="rain"; WX_CFG.precipFall=27; initWeather();'); if(!g('!!precipObj')) return false;
g('(function(){const pp=precipObj.geometry.attributes.position;window.__pw=0;Object.defineProperty(pp,"needsUpdate",{get(){return this._nu;},set(v){if(v)window.__pw++;this._nu=v;},configurable:true});})()');
for(let i=0;i<60;i++) g('updateWeather(1/60)'); const n=Number(g('window.__pw')); return n<60; },'T10b (写入数<60=节流复发=红)');
// N6 布娃娃 step 门摘除 → 全员冻结仍 step
negCheck('N6',()=>{ const c=negBoot(),g=negStart(c); g('(function(){if(!RAG.world) RAG.world={step:function(){}};const ws=RAG.world.step;window.__stepN=0;RAG.world.step=function(){window.__stepN++;return ws.apply(this,arguments);};window.__rag={frozen:true,t:9,parts:[{body:{velocity:{x:0,y:0,z:0},angularVelocity:{x:0,y:0,z:0},position:{x:50,y:2,z:50},quaternion:{x:0,y:0,z:0,w:1}}}],snap:[{x:50,y:2,z:50,qx:0,qy:0,qz:0,qw:1}]};RAG.list.push(window.__rag);updateRagdolls(1/60);})()');
return Number(g('window.__stepN'))>0; },'T11b (冻结仍整世界 step=红)');
// N7 摘 memo 登记行 → 源码钉红 (红=钉消失)
negCheck('N7',()=>{ const s=srcOf('js/11-soldiers.js'); return !s.includes('_c.k=kind; _c.rx=rx;'); },'T15a (登记行被摘=红)');
// N8 lane 缓存 TTL 恒假 → 每次重建 (红=同一性断裂)
negCheck('N8',()=>{ const c=negBoot(),g=negStart(c); return !g('(function(){pickSpawnFor(0);const a=_laneCache[0];if(!a)return false;pickSpawnFor(0);return _laneCache[0]===a;})()'); },'T13b (缓存恒失效=红)');
// N9 摘 span 缓存 → 源码钉红 (红=钉消失)
negCheck('N9',()=>{ const s=srcOf('js/24-main.js'); return !s.includes('btn._spC'); },'T16 (缓存被摘=红)');
console.log('阴性对认: '+negRed+'/'+negTot+' 红'+(negRed===negTot?'  (全部对认)':'  (有未转红项!)'));
process.exit(negRed===negTot?0:1);
}
process.exit(FAILN?1:0);
