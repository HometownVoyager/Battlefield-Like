// ─────────────────────────────────────────────
// dev/verify-eng-batch2-20261128.js —— 2026-11-28 工程兵系统第二批 (戳 20261128e):
//   ①建造点池: BUILD_POOL_INIT=10/CAP 10(工程15)/60s 回 1 点/25 杀回 1 点 (21-match updateBuildPool 单源,
//     24-main:267 接线; 局级复位在 22-hud resetPlayerForNewMatch, deploy 不再每命刷新 23-deploy 兜底);
//   ②建造得分: SCORE_TABLE.build=50/建造点, 实得分=(BUILD_COST[type]||1)×50 只给实际扣账件 (06 engBuildExec);
//   ③丧尸计费改版: isFreeItem 废止, 基础三件进 BUILD_ZP 定价 2, 支付=ZP 优先→ZP 不足兜底扣建造点→
//     两边都不足弹合并提示; exec 端读条再校验 (ZP 掉了转扣点/都不够取消); pendingBuild={type,cost(兜底价),zp};
//   ④菜单收窄: engMenuList 单源 (丧尸非工程兵只 sandbag/wire/hedge; 19-input KeyN 循环/20-player 提示行同源);
//   ⑤拒马 RGRID 直插修复 (用户实报"人工拒马不能阻拦人"): hedge 分支 built 后 rgridAddLastCyl() (油桶件
//     内联版抽成的单源, hedge/barrel 共用) —— 不断言窗口全量回退 (window.RGRID_OFF 不设, 那会掩盖修复);
//   ⑥修理三路损血缩放+工程免箱: 车内 dur=8×兵种系数(有箱0.8/无箱1.25)×损血缩放(损血<25% 线性, VEH_REPAIR_HEAL
//     分母) + noCrate 豁免"远离补给点"打断 (20a 座位 tick); 步行 tryEngVehRepair 同款损血缩放;
//     15-vehicles Bot 车组起步同款缩放; 非工程兵无箱拒修原门原样 ('附近没有补给箱, 无法维修');
//   ⑦死账清理: 14-bots 手抛迫击炮死分支绝迹 (全文件无 this.def.mortar) / recoverMortar 补 2 发炮弹残账删除 /
//     "弹药箱旁按F补给可回满"假话摘除 (恢复机制=建造点池) / 00b 词典合并键。
// 用法: node dev/verify-eng-batch2-20261128.js [--neg]
// 判据:
//   T0 源码锚 (六文件全量 + 假提示/isFreeItem/mortar/w.reserve/旧菜单循环负向) +
//   T1 行为断言 (普通局 boot 一份 + 丧尸 boot(sf_zsub:'solo') 一份; 真键派发 KeyN/KeyB/KeyX)。
//   --neg (十六补丁, 红名↔补丁): N1 拒马直插拆→T0f/T1e2/T1e3 · N2 兜底门拆→T0c/T1l · N3 得分平分→T0e/T1d2/
//      T1n2 (★sandbag/wire 件价=1 ⇒ ×50 与平分同值, T1d/T1k2 属正向专判不翻红) · N4 回复拆→T0k2/T1b/T1b3 ·
//      N5 击杀 grant 拆→T0k3/T1c · N6 免箱门拆→T0g2/T1h · N7 车内缩放拆→T0g/T1f/T1f4 · N8 步行缩放拆→
//      T0h/T1i2 (T1i 50% 损血不缩=与固定 8s 同值, 正向专判) · N9 noCrate 豁免拆→T0j/T1g/T1g2 ·
//      N10 局级重置拆→T0n/T1a · N11 菜单收窄拆→T0p/T1m2 · N12 deploy 兜底拆→T0m (T0-only: 局级复位已给 10) ·
//      N13 词典合并键删→T0q · N14 14-bots 死代码还魂→T0s2 · N15 recoverMortar 还魂→T0s · N16 假提示还魂→T0r。
//   T1l2 (双不足) 与 T1m/m3 (engMenuList 本身) 在 N2/N11 下结果不变 = 正向专判; N13 下 t2 缺词条回退原文同串。
//   T0-only 红 (N12/N13/N14/N15/N16) 见映射; EXPECT 精确比对 (漏红/多红都 exit 1)。
// 沙箱要点承 verify-keys-rotation-20261128 (boot 骨架/listeners 键派发/__step/NEG PATCH_MAP/ok-REDS-EXPECT) 与
//   verify-zombie (sf_zsub 预置 + beginFreshMatch 开局 + Bot 平移隔离) 与 verify-ridepose-batch-20261128
//   (engBuildExec 直调 + open-spot 螺旋扫描选点 + RGRID 直插断言) 与 verify-fieldfix2-20261116
//   (T5 座位/修理 idiom: player.onVehicle=t + AMMO_CRATES 合成箱 + dry corner 扫描 + 敌机冻结窗)。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const stub=require('./_bootstub.js');
require('./_bootpatch.js').patch(stub.sandbox);
{const P=Object.getPrototypeOf(stub.THREE.Group.prototype); if(!P.clear) P.clear=function(){ this.children.length=0; };}
{const V3P=stub.THREE.Vector3.prototype; if(!V3P.negate) V3P.negate=function(){ this.x=-this.x; this.y=-this.y; this.z=-this.z; return this; };}   // ★negate: 真三 Vector3 既有方法 (updateCamera 20-player:2635 fwdV.clone().negate(), 缺则帧护栏截断当帧)
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
Body:class{constructor(o){Object.assign(this,o||{});this.shapes=[];this.position=new V3();this.velocity=new V3();this.angularVelocity=new V3();this.quaternion=new Quat();this.angularDamping=0;this.linearDamping=0;}addShape(s){this.shapes.push(s);}},   // ★angularVelocity: verify-zombie 同款补齐 (spawnDebris 12-ragdolls:270 写它, 缺则帧护栏截断当帧=updateBuildPool 偶发漏帧)
Box:class{},Sphere:class{},Material:class{},ContactMaterial:class{},NaiveBroadphase:class{},
PointToPointConstraint:class{constructor(a,pa,b,pb){this.bodyA=a;this.pivotA=pa;this.bodyB=b;this.pivotB=pb;}},
};})();

const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const FILES=[...html.matchAll(/src="(js\/[^"?]+)/g)].map(m=>m[1]);
console.log('载入清单: 解析 index.html 得 '+FILES.length+' 个脚本');

// ── NEG 阴性对照: 十六补丁 (正常跑不启用) ──
const NEG=process.argv.includes('--neg');
const SRC={},PATCH_MAP={};
const NEG_PATCHES=[
// N1 拒马直插拆 (06 hedge 分支): 圆柱仍入 CYLS 但不进 RGRID 倒排表 ⇒ T0f 红 (锚行) + T1e2 红 (RGRID 缺) + T1e3 红 (collideMove 横推失效=用户实报病根复现)
['js/06-engineering.js','built=CYLS.length>cn; if(built) rgridAddLastCyl(); }','built=CYLS.length>cn; }'],
// N2 兜底门拆 (06 engBuild): ZP 不足不再转扣建造点 ⇒ T0c 红 + T1l 红 (丧尸②兜底建不出)
['js/06-engineering.js','}else if(bc>=cost){','}else if(false){'],
// N3 得分公式退回平分 (06 engBuildExec): 件价×50 → 一律 50 ⇒ T0e 红 + T1d2 红 (medkit 100→50) + T1n2 红 (丧尸 medkit 同)
['js/06-engineering.js','const _bScore=(tk.zp>0||tk.cost>0)?(BUILD_COST[tk.type]||1)*SCORE_TABLE.build:0;','const _bScore=(tk.zp>0||tk.cost>0)?SCORE_TABLE.build:0;'],
// N4 回复拆 (21-match updateBuildPool): _poolT 恒 0 ⇒ T0k2 红 + T1b 红 (59.98+4帧不回点) + T1b3 红 (工程 14 不涨)
['js/21-match.js','player._poolT=(player._poolT||0)+dt;','player._poolT=0;'],
// N5 击杀 grant 拆 (21-match): km 恒 0 ⇒ T0k3 红 + T1c 红 (26 杀不加点/记号不推进)
['js/21-match.js','const km=Math.floor((player.kills||0)/BUILD_POOL_KILL_STEP);','const km=0;'],
// N6 工程免箱门拆 (18 tryVehRepair): 非工程无箱也放行 ⇒ T0g2 红 + T1h 红 (cls0 无箱起修=原门失效)
['js/18-game.js',"if(!_isEng&&!_crate){ showScorePop('附近没有补给箱, 无法维修'); return; }",'if(false){ showScorePop(\'附近没有补给箱, 无法维修\'); return; }'],
// N7 车内缩放拆 (18 tryVehRepair 起步账): dur 回固定 8s ⇒ T0g 红 + T1f 红 (有箱 2.56) + T1f4 红 (无箱 4.0)
['js/18-game.js','this.vehRepair={t:0,dur:VEH_REPAIR_TIME*(_isEng?(_crate?ENG_REPAIR_MUL_CRATE:ENG_REPAIR_MUL_FIELD):1)*Math.min(1,(t.maxHp-t.hp)/t.maxHp/VEH_REPAIR_HEAL),tank:t,noCrate:_isEng&&!_crate};','this.vehRepair={t:0,dur:VEH_REPAIR_TIME,tank:t,noCrate:_isEng&&!_crate};'],
// N8 步行缩放拆 (18 tryEngVehRepair 起步账): dur 回固定 8s ⇒ T0h 红 + T1i2 红 (10% 损血 3.2→8)
['js/18-game.js','this.vehRepair={t:0,dur:VEH_REPAIR_TIME*Math.min(1,(best.maxHp-best.hp)/best.maxHp/VEH_REPAIR_HEAL),tank:best};','this.vehRepair={t:0,dur:VEH_REPAIR_TIME,tank:best};'],
// N9 noCrate 豁免拆 (20a 座位 tick): 工程无箱修理被"远离补给点"打断 ⇒ T0j 红 + T1g 红 (不回满) + T1g2 红 (打断弹字)
['js/20a-seats.js','let near=!!vr.noCrate;','let near=false;'],
// N10 局级重置拆 (22-hud resetPlayerForNewMatch): 开局 0 点 ⇒ T0n 红 + T1a 红 (部署后 buildCount 10)
['js/22-hud.js','player.buildCount=BUILD_POOL_INIT; player._poolT=0; player._poolKillMark=0;','player.buildCount=0; player._poolT=0; player._poolKillMark=0;'],
// N11 菜单收窄拆 (19-input KeyN): 循环回全量 BUILD_MENU ⇒ T0p 红 + T1m2 红 (非工程 4 连按 %8 不回原点)
['js/19-input.js','const _ml=engMenuList(player);   // ★20261128d 丧尸菜单收窄单源 (engMenuList): 非工程兵只循环基础三件','const _ml=BUILD_MENU;'],
// N12 deploy 兜底拆 (23-deploy): ⇒ T0m 红 (T0-only: 局级复位 resetPlayerForNewMatch 已给 10, T1a 不翻)
['js/23-deploy.js','if(p.buildCount==null) p.buildCount=BUILD_POOL_INIT;','if(false) p.buildCount=BUILD_POOL_INIT;'],
// N13 词典合并键删 (00b-i18n): ⇒ T0q 红 (三新键锚缺一)
['js/00b-i18n.js',"'ZP 不足 ({0}/{1}) 且建造点不足 ({2}/{3})':'Not enough ZP ({0}/{1}) nor build pts ({2}/{3})',",'// ★20261128d N13 词条移除'],
// N14 死代码还魂 (14-bots CRLF 单行): 手抛迫击炮死分支重插 ⇒ T0s2 红 (this.def.mortar 负向锚翻红)
['js/14-bots.js','if(!this.def.rocket&&this.mag>0){','if(!this.def.rocket&&!this.def.mortar&&this.mag>0){'],
// N15 recoverMortar 还魂 (06): 墓碑注释行后重插补弹残账 ⇒ T0s 红 (w.reserve 负向锚翻红; 沙箱不调回收无运行时扰动)
['js/06-engineering.js','// 病根随合并消失; 未来若给工程兵回配迫击炮槽, 在此处按 w.def.reserve 顶格补弹即可)。','// 病根随合并消失; 未来若给工程兵回配迫击炮槽, 在此处按 w.def.reserve 顶格补弹即可)。\nif(w){ w.reserve=Math.min(w.reserve+2,w.def.reserve); }'],
// N16 假提示还魂 (06): "弹药箱旁按F补给可回满"塞回不足提示 ⇒ T0r 红 (负向锚翻红)
['js/06-engineering.js','}else if(bc<cost){ showScorePop(t2(\'建造点数不足 ({0}/{1})\',bc,cost)); return; }   // ★20261128d: "弹药箱旁按F补给可回满"假话摘除; 恢复机制已裁定=建造点池 (60s/点+25杀/点+拆退无损)','}else if(bc<cost){ showScorePop(t2(\'建造点数不足 ({0}/{1}) — 弹药箱旁按F补给可回满\',bc,cost)); return; }'],
];
if(NEG) for(const [f,from,to] of NEG_PATCHES){
if(SRC[f]===undefined) SRC[f]=fs.readFileSync(path.join(root,f),'utf8');
const cnt=SRC[f].split(from).length-1;
if(cnt!==1){ console.log('✗ NEG 锚'+(cnt<1?'缺失':'不唯一(×'+cnt+')')+': '+f+' :: '+JSON.stringify(from.slice(0,60))); process.exit(1); }
PATCH_MAP[f]=(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC[f]).split(from).join(to);
}
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:fs.readFileSync(path.join(root,f),'utf8'));

function boot(campIdx,store){
for(const k in stub.byId)delete stub.byId[k];
const ctx=vm.createContext(Object.assign({},stub.sandbox));
const listeners={};
const addL=(t,f)=>{ (listeners[t]=listeners[t]||[]).push(f); };
ctx.addEventListener=addL;
ctx.document=Object.assign({},stub.document,{addEventListener:addL,removeEventListener(){}});
ctx.window=Object.assign({},stub.window,{addEventListener:addL,removeEventListener(){}});
ctx.dispatchEvent=ev=>{ if(!ev.preventDefault) ev.preventDefault=()=>{}; if(!ev.stopPropagation) ev.stopPropagation=()=>{}; for(const f of (listeners[ev.type]||[]).slice()) f(ev); return true; };
ctx.KeyboardEvent=class{ constructor(t,o){ o=o||{}; this.type=t; this.code=o.code; this.repeat=!!o.repeat; } };
ctx.MouseEvent=class{ constructor(t,o){ o=o||{}; this.type=t; this.button=o.button; } };
ctx.CANNON=CANNON;
ctx.localStorage={_s:Object.assign({sf_campaign:String(campIdx),sf_pseed:'424242'},store||{}),getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
ctx.__T=1000;
ctx.performance={now:()=>ctx.__T};
for(const f of FILES) vm.runInContext(srcOf(f),ctx,{filename:f});
vm.runInContext('var __step=(n)=>{ for(let i=0;i<n;i++){ __T+=16.7; loop(); } };',ctx);
return ctx;
}
const PASS=[];let FAILN=0;const REDS=[];
function ok(cond,label){
const id=(label.match(/^(T[01][a-z]\d?)\b/)||[])[1]||null;   // 断言 id 取自标签首词 (T0a/T1b3/…; 前置行无 id)
if(cond){ PASS.push(id||label); console.log('  ✔ '+label); }
else { FAILN++; if(id) REDS.push(id); console.log((NEG?'  ● [期望红] ':'  ✘ ')+label); }
}
const RESET_SRC='var __resetInput=(n)=>{ player.nadeHeld=false; player.nadeIsAT=false; player.nadeIsSmoke=false; player.nadeIsIncin=false; VM.state="idle"; VM.stateT=0; VM.stateDur=0; vmSndFlags={}; };';
const POPS_SRC='var __pops=[]; var __ssp0=showScorePop; showScorePop=function(m){ __pops.push(String(m)); __ssp0(m); };';

// ═════ 前置: 普通局真开局 + 部署 ═════
let IDXS=1; { const c0=boot(0); IDXS=vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="stalingrad")',c0); }
const ctx=boot(IDXS);
const G=s=>vm.runInContext(s,ctx);
const KD=c=>G(`dispatchEvent(new KeyboardEvent('keydown',{code:'${c}'}));`);
const KU=c=>G(`dispatchEvent(new KeyboardEvent('keyup',{code:'${c}'}));`);
let err0=null;
try{ G("document.getElementById('startBtn').onclick();"); }catch(e){ err0=String(e&&e.stack||e); }
if(!err0){ try{ G('if(!player.alive||!player.deployed) deployPlayer();'); }catch(e){ err0='deployPlayer: '+String(e&&e.stack||e); } }
if(err0||!G('player.alive')){ console.log('  ✘ 开局/部署失败 '+(err0||'player.alive=false')); process.exit(1); }
G('pointerLocked=true;');   // 19-input 战斗键总门 (!alive||!pointerLocked) — 沙箱无 pointerlockchange, 直置 (throwq 批同款)
G('__step(3);');            // 部署装备链跑完
G(RESET_SRC); G('__resetInput();');   // VM 'draw' 在沙箱不推进, 测试前置 idle (keys-rotation 批同款)
G(POPS_SRC);                // showScorePop 包一层捕获弹字 (非侵入: 原函数照调)
// 战场隔离 (探针不测 Bot 战斗链, 但 200/520 帧等待窗内玩家被第三方火力打死 ⇒ deployed=false 下游假红):
// 兵员平移 +400 (仍互战, 远离玩家) + 全部飞机冻结 (收尾还原) + 玩家出生保护拉满 (本探针无玩家受击判据)
G('for(const s of soldiers){ if(!s.isPlayer){ s.pos.x+=400; s.pos.z+=400; s.pos.y=heightAt(s.pos.x,s.pos.z); if(s.path) s.path.length=0; } }');
G('__planesFrozen=[]; for(const pl of planes){ if(pl&&pl.alive){ pl.alive=false; pl.respawnT=1e9; __planesFrozen.push(pl); } }');
G('player.protUntil=1e9;');
ok(html.includes("__sfStyleVer='20261128e'")&&(html.match(/\?v=20261128e/g)||[]).length>=1,'前置: 版本戳 20261128e 在位 (index.html ?v= ×'+(html.match(/\?v=20261128e/g)||[]).length+' + __sfStyleVer)');

// ══ T0 源码锚 ══
console.log('T0 源码锚');
const s00=srcOf('js/00-config.js'),s06=srcOf('js/06-engineering.js'),s18=srcOf('js/18-game.js'),s15=srcOf('js/15-vehicles.js'),
s20a=srcOf('js/20a-seats.js'),s21=srcOf('js/21-match.js'),s24=srcOf('js/24-main.js'),s23=srcOf('js/23-deploy.js'),
s22=srcOf('js/22-hud.js'),s20p=srcOf('js/20-player.js'),s19=srcOf('js/19-input.js'),s00b=srcOf('js/00b-i18n.js'),
s14=srcOf('js/14-bots.js'),s25=srcOf('js/25-zombies.js');
// ① 00-config 常量组
ok(s00.includes('const ENG_VEH_REPAIR_R=3.2;')&&s00.includes('const BUILD_POOL_INIT=10, BUILD_POOL_CAP=10, BUILD_POOL_CAP_ENG=15, BUILD_POOL_REGEN_SEC=60, BUILD_POOL_KILL_STEP=25;')&&s00.includes('const ENG_REPAIR_MUL_CRATE=0.8, ENG_REPAIR_MUL_FIELD=1.25;'),'T0a ★00-config 三组新常量逐字 (ENG_VEH_REPAIR_R / BUILD_POOL_* 五连 / ENG_REPAIR_MUL_*)');
ok(s00.includes('medkit:10,build:50};'),'T0a2 ★SCORE_TABLE.build=50 入表尾 (建造得分单价, 00-config)');
ok(s00.includes('const VEH_REPAIR_R=5.5, VEH_REPAIR_TIME=8, VEH_REPAIR_HEAL=0.25, VEH_REPAIR_DMG_FRAC=0.26'),'T0a3 修理五常量回归钉 (verify-fieldfix2:513 锚; VEH_REPAIR_TIME/HEAL=缩放分母单源)');
// ② 06-engineering: 菜单/计费/得分/直插
ok(s06.includes('function engMenuList(pl){')&&s06.includes("return BUILD_MENU.filter(t=>t==='sandbag'||t==='wire'||t==='hedge');"),'T0b ★engMenuList 单源 (丧尸非工程兵只基础三件; 全量=工程兵/普通)');
ok(s06.includes('barrel:1,tower:3,ammoc:2};'),'T0b2 BUILD_COST 补 tower:3/ammoc:2 兜底价 (06)');
ok(s06.includes('const BUILD_ZP={mg:150,tower:250,ammoc:80,sandbag:2,wire:2,hedge:2};'),'T0b3 ★BUILD_ZP 基础三件定价 2 (isFreeItem 废止后 ZP 单源价目)');
ok(s06.includes("'ZP 不足 ({0}/{1}) 且建造点不足 ({2}/{3})'")&&s06.includes('}else if(bc>=cost){'),'T0c ★丧尸计费三岔: ZP 优先→bc>=cost 兜底扣点→双不足合并提示 (06 engBuild)');
ok(s06.includes('pl.pendingBuild={type,cost,zp:zpCost,tx,tz,ry:Math.atan2(dir.x,dir.z)};'),'T0c2 pendingBuild={type,cost(兜底价),zp(0=走点)} 双记 (06)');
ok(s06.includes('if(tk.zp&&pl.isPlayer&&(player.pz|0)<tk.zp){')&&s06.includes("showScorePop(t2('ZP 已不足 · 改扣建造点'))"),'T0d ★exec 端再校验: 读条中 ZP 掉了转扣点/都不够取消 (06 engBuildExec 头部)');
ok(s06.includes('const _bScore=(tk.zp>0||tk.cost>0)?(BUILD_COST[tk.type]||1)*SCORE_TABLE.build:0;'),'T0e ★建造得分=件价×SCORE_TABLE.build (06 engBuildExec; N3 对认)');
ok((s06.match(/pl\.cls===4\?BUILD_POOL_CAP_ENG:BUILD_POOL_CAP/g)||[]).length===2,'T0e2 拆除退款+医疗箱失败退款 双处池封顶 (工程15/其他10, 06 ×2)');
ok(s06.includes("else if(tk.type==='hedge'){ const cn=CYLS.length; hedgehog(tk.tx,tk.tz); built=CYLS.length>cn; if(built) rgridAddLastCyl(); }"),'T0f ★拒马建造后 rgridAddLastCyl() 直插 (06 hedge 分支; N1 对认 — 人工拒马不能阻拦人病根)');
ok(s06.includes('function rgridAddLastCyl(){')&&s06.includes('if(built) rgridAddLastCyl();'),'T0f2 rgridAddLastCyl 单源 (油桶内联版抽出, hedge/barrel 共用)');
ok((s06.match(/push\(CYLS\.length-1\)/g)||[]).length===1,'T0t push(CYLS.length-1) 全文件恰 1 处 (rgridAddLastCyl 函数体内; 内联直插绝迹)');
ok(!s06.includes('— 弹药箱旁按F补给可回满'),'T0r "弹药箱旁按F补给可回满"假话绝迹 (06 负向; N16 对认)');
ok(!s06.includes('isFreeItem')&&!s06.includes('cost:isFreeItem'),'T0r2 isFreeItem 全绝迹 (06 负向: 免费规则废止)');
ok(!s06.includes('w.reserve=Math.min(w.reserve+2'),'T0s recoverMortar 补 2 发炮弹残账绝迹 (06 负向; N15 对认)');
ok(!s14.includes('this.def.mortar'),'T0s2 14-bots 手抛迫击炮死分支绝迹 (全文件无 this.def.mortar; CRLF 负向单行锚; N14 对认)');
// ③ 18-game 修理三路
ok(s18.includes('const _isEng=this.cls===4;')&&s18.includes("const _crate=(typeof vehRepairCrateNear==='function')&&vehRepairCrateNear(t.pos.x,t.pos.z);"),'前置锚: 车内修理 _isEng/_crate 判据行 (18)');
ok(s18.includes("if(!_isEng&&!_crate){ showScorePop('附近没有补给箱, 无法维修'); return; }"),'T0g2 ★非工程无箱拒修门原样 (18; N6 对认)');
ok(s18.includes('this.vehRepair={t:0,dur:VEH_REPAIR_TIME*(_isEng?(_crate?ENG_REPAIR_MUL_CRATE:ENG_REPAIR_MUL_FIELD):1)*Math.min(1,(t.maxHp-t.hp)/t.maxHp/VEH_REPAIR_HEAL),tank:t,noCrate:_isEng&&!_crate};'),'T0g ★车内起步账=8s×兵种系数×损血缩放+noCrate 记账 (18 tryVehRepair; N7 对认)');
ok(s18.includes('this.vehRepair={t:0,dur:VEH_REPAIR_TIME*Math.min(1,(best.maxHp-best.hp)/best.maxHp/VEH_REPAIR_HEAL),tank:best};'),'T0h ★步行起步账同款损血缩放 (18 tryEngVehRepair; N8 对认)');
// ④ 19-input 接线
ok(s19.includes("if(e.code==='KeyR'&&!player.onVehicle&&player.cls===4&&typeof player.tryEngVehRepair==='function'&&player.tryEngVehRepair()) return;"),'T0h2 KeyR 步行工程修车接线回归钉 (19-input; 上一批)');
ok(s19.includes('const _ml=engMenuList(player);   // ★20261128d 丧尸菜单收窄单源 (engMenuList): 非工程兵只循环基础三件')&&s19.includes('player.buildSel=((player.buildSel||0)+1)%_ml.length;')&&s19.includes('const bt=_ml[player.buildSel];'),'T0p ★KeyN 选件循环走 engMenuList 单源 (19-input; N11 对认)');
ok(!s19.includes('%BUILD_MENU.length'),'T0p2 旧全量菜单循环 %BUILD_MENU.length 绝迹 (19-input 负向)');
// ⑤ 15-vehicles / 20a-seats
ok(s15.includes('this.vehRepair={t:0,dur:VEH_REPAIR_TIME*Math.min(1,(this.maxHp-this.hp)/this.maxHp/VEH_REPAIR_HEAL)};'),'T0i ★Bot 车组修理起步同款损血缩放 (15-vehicles:1366)');
ok(s20a.includes('let near=!!vr.noCrate;'),'T0j ★座位 tick noCrate 豁免"远离补给点" (20a; N9 对认)');
ok(s20a.includes("if(!near&&typeof AMMO_CRATES!=='undefined') for(const ac of AMMO_CRATES){ if(ac.ship) continue; if(Math.hypot(ac.x-t.pos.x,ac.z-t.pos.z)<=VEH_REPAIR_R*1.35){ near=true; break; } }"),'T0j2 距离迟滞门 1.35×R 原样 (20a)');
// ⑥ 21-match 池 tick + 24-main 接线
ok(s21.includes('function updateBuildPool(dt){')&&s21.includes('const cap=player.cls===4?BUILD_POOL_CAP_ENG:BUILD_POOL_CAP;'),'T0k ★updateBuildPool 单源: matchRunning+deployed 双门+兵种 cap (21-match)');
ok(s21.includes('player._poolT=(player._poolT||0)+dt;'),'T0k2 ★60s 回点累加账 (21-match; N4 对认)');
ok(s21.includes('const km=Math.floor((player.kills||0)/BUILD_POOL_KILL_STEP);')&&s21.includes("showScorePop(t2('击杀×25 · 建造点 +1'))"),'T0k3 ★击杀 grant: 25 杀阈值差值+弹字 (21-match; N5 对认)');
ok(s24.includes('updateBuildPool(dt);'),'T0l updateBuildPool(dt) 接线 (24-main:267, updateSpots 之后)');
// ⑦ 23-deploy / 22-hud 生命周期
ok(s23.includes('if(p.buildCount==null) p.buildCount=BUILD_POOL_INIT;'),'T0m ★deploy 兜底 (每命不刷新, 23-deploy; N12 对认)');
ok(!s23.includes('p.buildCount=6'),'T0m2 旧 p.buildCount=6 每命刷新绝迹 (23-deploy 负向)');
ok(s22.includes('player.buildCount=BUILD_POOL_INIT; player._poolT=0; player._poolKillMark=0;'),'T0n ★局级复位三连 (22-hud resetPlayerForNewMatch; N10 对认)');
// ⑧ 20-player 提示行 + 00b 词典 + 25-zombies
ok(s20p.includes('const _ml2=engMenuList(player);')&&s20p.includes("const _cs=(ZOMBIE_MODE&&BUILD_ZP[bt2]!==undefined)?BUILD_ZP[bt2]+'ZP':BUILD_COST[bt2]+'点';")&&s20p.includes("'<b>N</b> 工事: {0} ({1}) · <b>B</b> 建造 · 剩 {2} 点'"),'T0o ★提示行走 engMenuList+ZP/点双价显示+丧尸非工程短句 (20-player clsTip)');
ok(s00b.includes("'ZP 不足 ({0}/{1}) 且建造点不足 ({2}/{3})':'Not enough ZP ({0}/{1}) nor build pts ({2}/{3})',")&&s00b.includes("'ZP 已不足 · 改扣建造点':'ZP ran out · paying build pts',")&&s00b.includes("'击杀×25 · 建造点 +1':'25 kills · build pt +1',")&&!s00b.includes("'ZP 点数不足 ({0}/{1}) — 击杀丧尸 / 占领旗点可得':"),'T0q ★i18n 三新键入典+旧 ZP 不足词条废止 (00b; N13 对认 — 墓碑注释残留不算词条)');
ok(s25.includes("BUILD_MENU.push('tower','ammoc');"),'T0z 丧尸局商店两件进菜单 (25-zombies:938 回归钉; 全菜单 8 件)');

// ══ T1 行为断言 (普通局) ══
console.log('T1 行为断言 (普通局: 建造点池/建造得分/拒马直插/修理三路)');
// T1a 池初始化 (部署后 10 点)
ok(G('player.buildCount')===10&&G('player._poolT|0')===0,'T1a ★部署后 buildCount=BUILD_POOL_INIT=10, _poolT=0 (22-hud 局级复位; N10 对认)');
// T1b 池回复 60s/点
G('player.buildCount=3; player._poolT=59.98; player._poolKillMark=0;');
G('__step(4);');
ok(G('player.buildCount')===4,'T1b ★_poolT 59.98+4帧(0.067s) 跨 60s 门 → 3→4 (60s/点; N4 对认)');
G('player.buildCount=10; player._poolT=59.98;');
G('__step(4);');
ok(G('player.buildCount')===10,'T1b2 cls0 满池 10 不涨 (cap=BUILD_POOL_CAP)');
G('player.cls=4; player.buildCount=14; player._poolT=59.98;');
G('__step(4);');
ok(G('player.buildCount')===15,'T1b3 ★工程兵 cap=15: 14→15 (BUILD_POOL_CAP_ENG; N4 对认)');
G('__step(200);');
ok(G('player.buildCount')===15,'T1b4 满池 200 帧仍 15 (溢出丢弃)');
G('player.cls=0;');
// T1c 池击杀 25杀/点
G('player.kills=24; player._poolKillMark=0; player.buildCount=5;');
G('player.kills=26;'); G('__step(2);');
const t1cdiag=NEG?'':(' [diag='+JSON.stringify(G('({mr:matchRunning,mo:matchOver,dep:player.deployed,alive:player.alive,k:player.kills,mk:player._poolKillMark,bc:player.buildCount,pt:+player._poolT.toFixed(3)})'))+']');
ok(G('player.buildCount')===6&&G('player._poolKillMark')===1,'T1c ★击杀跨 25 阈值 → +1 点且记号推进 (kills 24→26, 5→6; N5 对认; tank 车体+3 杀同式不另测)'+t1cdiag);
// T1d 建造得分 (engBuildExec 直调; 螺旋扫空位 — occBlocked+propFree 双闸, 固定坐标必假红)
G('__resetInput();');
const t1d=G(`(function(){
var out={};
player.buildCount=10;
var s0=player.score, bc0=player.buildCount;
var ok1=false, ok2=false;
outerA: for(var rr=2;rr<=18;rr+=1.2){ for(var a=0;a<12;a++){
var ax=player.pos.x+rr*Math.cos(a*Math.PI/6), az=player.pos.z+rr*Math.sin(a*Math.PI/6);
if(occBlocked(ax,az)) continue;
if(!propFree(ax,az,2.7)) continue;
player.pendingBuild={type:'sandbag',cost:1,zp:0,tx:ax,tz:az,ry:0};
engBuildExec(player);
if(player.buildCount===bc0-1){ ok1=true; break outerA; }
} }
out.ok1=ok1; out.dScore1=player.score-s0; out.bc1=player.buildCount;
var s1=player.score, bc1=player.buildCount;
outerB: for(var rr2=2;rr2<=18;rr2+=1.2){ for(var a2=0;a2<12;a2++){
var ax2=player.pos.x+rr2*Math.cos(a2*Math.PI/6+0.26), az2=player.pos.z+rr2*Math.sin(a2*Math.PI/6+0.26);
if(occBlocked(ax2,az2)) continue;
if(!propFree(ax2,az2,0.9)) continue;
player.pendingBuild={type:'medkit',cost:2,zp:0,tx:ax2,tz:az2,ry:0};
engBuildExec(player);
if(player.buildCount===bc1-2){ ok2=true; break outerB; }
} }
out.ok2=ok2; out.dScore2=player.score-s1; out.bc2=player.buildCount;
return out;
})()`);
ok(t1d.ok1&&t1d.dScore1===50&&t1d.bc1===9,'T1d ★sandbag 落成: +50 分 (BUILD_COST 1×SCORE_TABLE.build) 且建造点 10→9 (N3 正向专判: 件价 1 与平分同值)');
ok(t1d.ok2&&t1d.dScore2===100&&t1d.bc2===7,'T1d2 ★medkit 落成: +100 分 (件价 2×50) 且 9→7 (N3 对认: 平分档只得 50)');
// T1e 拒马直插 (本批主菜): 建成→RGRID 倒排表→collideMove 横推 (不设 window.RGRID_OFF — 那会走全量回退掩盖修复)
const t1e=G(`(function(){
var out={};
var cy0=CYLS.length;
var okb=false, bx=0, bz=0;
outerC: for(var rr=2;rr<=18;rr+=1.2){ for(var a=0;a<12;a++){
var ax=player.pos.x+rr*Math.cos(a*Math.PI/6+0.52), az=player.pos.z+rr*Math.sin(a*Math.PI/6+0.52);
if(occBlocked(ax,az)) continue;
if(!propFree(ax,az,1.35)) continue;
player.pendingBuild={type:'hedge',cost:1,zp:0,tx:ax,tz:az,ry:0};
engBuildExec(player);
if(CYLS.length>cy0){ okb=true; bx=ax; bz=az; break outerC; }
} }
out.okb=okb;
var c=CYLS[CYLS.length-1];
out.r=c?c.r:-9;
var N2=RGRID.N, idx=CYLS.length-1, inR=false;
if(RGRID.cylCells){
var i0=Math.max(0,Math.min(N2-1,Math.floor((c.x-c.r+RGRID.off)/RGRID.cell))), i1=Math.max(0,Math.min(N2-1,Math.floor((c.x+c.r+RGRID.off)/RGRID.cell)));
var j0=Math.max(0,Math.min(N2-1,Math.floor((c.z-c.r+RGRID.off)/RGRID.cell))), j1=Math.max(0,Math.min(N2-1,Math.floor((c.z+c.r+RGRID.off)/RGRID.cell)));
outerD: for(var j=j0;j<=j1;j++)for(var i=i0;i<=i1;i++){ var arr=RGRID.cylCells[j*N2+i]; for(var k=0;k<arr.length;k++) if(arr[k]===idx){ inR=true; break outerD; } }
}
out.inR=inR;
// 横推: 人站进拒马圆内 (中心偏 0.4/0.2 避开 d2=1e-8 退化档) → collideMove 应把人推出 r+radius=1.25
var pos={x:bx+0.4, y:heightAt(bx,bz), z:bz+0.2};
collideMove(pos,0.4,1.7);
out.push=Math.hypot(pos.x-bx,pos.z-bz);
return out;
})()`);
ok(t1e.okb&&t1e.r===0.85,'T1e 拒马落成: CYLS 末条 r=0.85 (hedgehog 建模既有值)');
ok(t1e.inR===true,'T1e2 ★RGRID.cylCells 含拒马下标 CYLS.length-1 (运行期直插; N1 对认)');
ok(t1e.push>=1.2,'T1e3 ★站进拒马圆内 collideMove(0.4,1.7) 横推出圆: 距心 '+t1e.push.toFixed(3)+'≥1.2 (阻拦人=用户实报; N1 对称)');
// T1f/g/h 座位修理三路 (fieldfix2 T5 idiom: player.onVehicle=t + 合成补给箱; dry corner 扫描)
G('player.cls=0; player.vehRepair=null;');
const t1f=G(`(function(){
var out={};
var t=null; for(var i=0;i<tanks.length;i++){ if(tanks[i].alive&&tanks[i].team===player.team){ t=tanks[i]; break; } }
out.prep=!!t;
if(!out.prep) return out;
out.friendly=t.team===player.team;
var dry=null;
{ var L=MAP_SIZE/2-30;
var cands=[[L,L],[-L,L],[L,-L],[-L,-L],[0,L],[0,-L],[L,0],[-L,0]];
var bs=-1;
for(var ci=0;ci<cands.length;ci++){ var cx=cands[ci][0], cz=cands[ci][1];
if(waterDepthAt(cx,cz)>0.1||inRiverWater(cx,cz)) continue;
var dmin=1e9; for(var k2=0;k2<AMMO_CRATES.length;k2++){ var ac=AMMO_CRATES[k2]; if(ac.ship) continue; dmin=Math.min(dmin,Math.hypot(ac.x-cx,ac.z-cz)); }
if(dmin>bs){ bs=dmin; dry=[cx,cz,dmin]; } } }
out.dry=!!dry;
if(!dry) return out;
// Phase A: 有箱 (合成箱贴车 2m) — 工程兵有箱系数 0.8
t.pos.set(60,heightAt(60,60),60); t.vel=0; t.burning=false; t.vehRepair=null;
var c0=AMMO_CRATES.length;
AMMO_CRATES.push({x:t.pos.x+2,z:t.pos.z,ship:false});
t.hp=t.maxHp*0.9;   // 损血 10% → 缩放 min(1,0.1/0.25)=0.4
player.onVehicle=t; t.playerDriven=true;
player.cls=4; player.vehRepair=null;
player.tryVehRepair();
out.aStarted=!!(player.vehRepair&&player.vehRepair.tank===t);
out.aDur=player.vehRepair?player.vehRepair.dur:-9;
out.aNoV=player.vehRepair?!!player.vehRepair.noCrate:null;
// X 取消 (真键派发 — KeyX 读条取消网含 vehRepair)
dispatchEvent(new KeyboardEvent('keydown',{code:'KeyX'}));
out.aCancel=player.vehRepair===null;
// Phase B: 无箱 (拆合成箱 + 车挪 dry corner 远离所有箱) — 工程兵无箱系数 1.25
AMMO_CRATES.length=c0;
t.pos.set(dry[0],heightAt(dry[0],dry[1]),dry[1]); t.vel=0; t.burning=false;
out.farMin=dry[2];
t.hp=t.maxHp*0.9;
player.vehRepair=null;
player.tryVehRepair();
out.bStarted=!!player.vehRepair;
out.bDur=player.vehRepair?player.vehRepair.dur:-9;
out.bNoV=player.vehRepair?!!player.vehRepair.noCrate:null;
// Phase C: 无箱账走完 (vr.t=vr.dur-0.05 → 座位 tick 推进) — 不动方向键 ⇒ 不被移动打断;
// noCrate 豁免 ⇒ 不被"远离补给点"打断; 完成回 25%×maxHp (0.9+0.25 封顶=满)
out.cPop0=__pops.length;
if(player.vehRepair) player.vehRepair.t=player.vehRepair.dur-0.05;
try{ __step(8); }catch(e){ out.cErr=String(e&&e.stack||e).slice(0,90); }
out.cDone=player.vehRepair===null;
out.cHpFull=(t.hp===t.maxHp);
out.cNoFarBreak=!__pops.slice(out.cPop0).some(function(m){ return m.indexOf('远离补给点')>=0; });
// Phase D: 满血拒修
t.hp=t.maxHp; player.vehRepair=null;
player.tryVehRepair();
out.dNoAccount=player.vehRepair===null;
// Phase E: 非工程兵 (cls0) 无箱拒修 (车仍在远离所有箱的角落)
player.cls=0; t.hp=t.maxHp*0.9; player.vehRepair=null;
out.ePop0=__pops.length;
player.tryVehRepair();
out.eNoAccount=player.vehRepair===null;
out.ePop=__pops.slice(out.ePop0).some(function(m){ return m.indexOf('附近没有补给箱, 无法维修')>=0; });
// 还原
player.onVehicle=null; t.playerDriven=false; t.hp=t.maxHp; t.vehRepair=null; player.vehRepair=null;
return out;
})()`);
if(!t1f.prep||!t1f.dry){ ok(false,'T1-prep 友方坦克+dry corner 就位 (prep='+t1f.prep+' dry='+t1f.dry+')'); }
else{
ok(t1f.aStarted&&Math.abs(t1f.aDur-2.56)<0.01,'T1f ★车内有箱修理: dur=8×0.8×0.4=2.56 (工程系数 0.8×损血缩放 0.4; N7 对认)');
ok(t1f.aNoV===false,'T1f2 有箱账 noCrate=false (箱在旁, 20a 迟滞门照常适用)');
ok(t1f.aCancel===true,'T1f3 X 键取消车内修理读条 (readBarActive 取消网含 vehRepair)');
ok(t1f.bStarted&&Math.abs(t1f.bDur-4.0)<0.01,'T1f4 ★车内无箱修理: dur=8×1.25×0.4=4.0 (工程系数 1.25; N7 对认)');
ok(t1f.bNoV===true,'T1f5 无箱账 noCrate=true (18 起步记账)');
ok(t1f.cDone&&t1f.cHpFull,'T1g ★无箱账 0.05s 走完: 账清且 10% 损血修满 (min(0.9+0.25,maxHp)=满血; N9 对称: 被打断则不回满)');
ok(t1f.cNoFarBreak===true,'T1g2 ★无箱修理不被"远离补给点"打断 (车在远离所有箱的角落; N9 对认 — noCrate 豁免拆则弹字翻账)');
ok(t1f.dNoAccount===true,'T1f6 满血拒修 (t.hp>=maxHp 起步门)');
ok(t1f.eNoAccount===true&&t1f.ePop===true,'T1h ★非工程兵无箱拒修: 无账且弹\'附近没有补给箱, 无法维修\' (原门原样; N6 对认)');
}
// T1i 步行工程修车 (tryEngVehRepair: ≤3.2m 贴受损友军坦克)
const t1i=G(`(function(){
var out={};
var t=null; for(var i=0;i<tanks.length;i++){ if(tanks[i].alive&&tanks[i].team===player.team){ t=tanks[i]; break; } }
out.prep=!!t;
if(!out.prep) return out;
player.cls=4; player.onVehicle=null; player.onNaval=null; player.onMG=null; player.vehRepair=null;
__resetInput();
t.pos.set(player.pos.x+2.5, heightAt(player.pos.x+2.5,player.pos.z), player.pos.z); t.vel=0; t.burning=false;
t.hp=t.maxHp*0.5;   // 损血 50% > 25% → 不缩
out.i1=player.tryEngVehRepair();
out.i1Dur=player.vehRepair?player.vehRepair.dur:-9;
player.vehRepair=null;
t.hp=t.maxHp*0.9;   // 损血 10% → 缩 0.4×
out.i2=player.tryEngVehRepair();
out.i2Dur=player.vehRepair?player.vehRepair.dur:-9;
player.vehRepair=null;
// VM 非 idle 拒起步 (举雷/包扎/锤击各有自己的双击确认网)
VM.state='nade'; VM.stateT=0; VM.stateDur=0.5;
out.i3=player.tryEngVehRepair();
out.i3Account=!!player.vehRepair;
VM.state='idle'; VM.stateT=0; VM.stateDur=0;
t.hp=t.maxHp;
return out;
})()`);
ok(t1i.prep&&t1i.i1===true&&Math.abs(t1i.i1Dur-8)<0.01,'T1i ★步行修车 50% 损血: 起步且 dur=8 (>25% 不缩; N8 正向专判: 固定档同值)');
ok(t1i.prep&&Math.abs(t1i.i2Dur-3.2)<0.01,'T1i2 ★步行修车 10% 损血: dur=8×0.4=3.2 (损血缩放; N8 对认)');
ok(t1i.prep&&t1i.i3===false&&t1i.i3Account===false,'T1i3 VM 非 idle 拒起步 (不武装不落账)');
// T1j 油桶火烧殉爆回归钉 (05-world barrelDamage 火源受热账; 用户裁定"已有就行")
const t1j=G(`(function(){
var out={};
player.buildCount=Math.max(player.buildCount,3);
var cy0=CYLS.length, bx=0, bz=0, okb=false;
outerE: for(var rr=2;rr<=18;rr+=1.2){ for(var a=0;a<12;a++){
var ax=player.pos.x+rr*Math.cos(a*Math.PI/6+0.78), az=player.pos.z+rr*Math.sin(a*Math.PI/6+0.78);
if(occBlocked(ax,az)) continue;
if(!propFree(ax,az,1.2)) continue;
player.pendingBuild={type:'barrel',cost:1,zp:0,tx:ax,tz:az,ry:0};
engBuildExec(player);
if(CYLS.length>cy0){ okb=true; bx=ax; bz=az; break outerE; }
} }
out.okb=okb;
if(!okb) return out;
var c=CYLS[CYLS.length-1];
out.explosive=!!(c.explosive&&!c.dead);
// 人挪远 dry corner + 兵员平移隔离 (8.7s 等待窗内不被第三方火力打断)
var L=MAP_SIZE/2-30, dry=null, bs=-1;
var cands=[[L,L],[-L,L],[L,-L],[-L,-L]];
for(var ci=0;ci<cands.length;ci++){ var cx=cands[ci][0], cz=cands[ci][1];
if(waterDepthAt(cx,cz)>0.1||inRiverWater(cx,cz)) continue;
var d=Math.hypot(cx-bx,cz-bz); if(d>bs){ bs=d; dry=[cx,cz]; } }
if(dry){ player.pos.set(dry[0],standHeight(dry[0],dry[1],player.pos.y+1),dry[1]); player.vel.x=0; player.vel.z=0; }
for(const s of soldiers){ if(!s.isPlayer&&s.alive){ s.pos.x+=400; s.pos.z+=400; s.pos.y=heightAt(s.pos.x,s.pos.z); if(s.path) s.path.length=0; } }
out.planesOff=[];
for(const pl of planes){ if(pl&&pl.alive){ pl.alive=false; out.planesOff.push(pl); } }   // 冻结全部飞机 (fieldfix2 T6 idiom; 收尾还原)
addFireSource(c.x,c.z,(c.y0||0)+0.5,3,30,20,null);
try{ __step(520); }catch(e){ out.err=String(e&&e.stack||e).slice(0,90); }
out.dead=c.dead===true;
for(const pl of out.planesOff) pl.alive=true;
return out;
})()`);
ok(t1j.okb&&t1j.explosive&&t1j.dead===true,'T1j ★工兵油桶+火源 r3: 520 帧 (8.7s) 受热殉爆 c.dead (BARREL.fireDps 14×0.4s 账; 回归钉)');
G('for(const pl of __planesFrozen){ pl.alive=true; pl.respawnT=0; }');   // 飞机解冻 (普通局收官)

// ══ T1 行为断言 (丧尸局) ══
console.log('T1 行为断言 (丧尸局: ZP 优先/兜底/双不足/菜单收窄)');
let PGIDX=1; { const c0=boot(0); PGIDX=vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="procgen")',c0); }
const zctx=boot(PGIDX,{sf_zsub:'solo'});
const GZ=s=>vm.runInContext(s,zctx);
const KDZ=c=>GZ(`dispatchEvent(new KeyboardEvent('keydown',{code:'${c}'}));`);
let zerr=null;
try{ GZ('beginFreshMatch();'); }catch(e){ zerr='start: '+String(e&&e.stack||e); }
if(!zerr){ try{ GZ('if(!player.alive||!player.deployed) deployPlayer();'); }catch(e){ zerr='deploy: '+String(e&&e.stack||e); } }
if(zerr||!GZ('player.alive')){ console.log('  ✘ 丧尸开局/部署失败 '+(zerr||'player.alive=false')); process.exit(1); }
GZ('for(const s of soldiers) s.protUntil=0; player.protUntil=1e9;');   // 玩家出生保护拉满 (本探针无玩家受击判据; 防 0.25s 窗外的偶发尸咬)
// Bot 平移 +800m 隔离 (verify-zombie idiom): 防感知/误杀污染 ZP 与建造断言
GZ('for(const s of soldiers){ if(!s.isPlayer&&!s.zombie){ s.pos.x+=800; s.pos.z+=800; s.pos.y=heightAt(s.pos.x,s.pos.z); if(s.path) s.path.length=0; } }');
GZ('pointerLocked=true;');
GZ('__step(3);');
GZ(RESET_SRC); GZ('__resetInput();');
GZ(POPS_SRC);
GZ(`var __ZSPOTS=[[20,20],[80,-40],[-70,50],[60,70],[-50,-80],[110,10],[-110,-10],[40,-110]];
var __zbPrep=(tag)=>{
stopDemolish(player,true); player.demolish=null;
if(player.pendingBuild&&typeof cancelBuild==='function') cancelBuild(player); else player.pendingBuild=null;
var sp=__ZSPOTS[tag%__ZSPOTS.length];
var px=sp[0], pz=sp[1], good=false;
// 选点与 engBuild 完全同源: 落点=player.pos+camForward()*2.4 (沙箱 getWorldDirection 桩不随 yaw 转动,
// 猜朝向必错 — 直接用游戏同源 camForward 验证 engBuild 将用的那个点; 不合闸则确定性挪点重扫)。
// 每候选走 1 帧 (同步相机+让丧尸自动工事先落账) 再验, KeyB 前零帧间隙 ⇒ 起造点=验证点。
for(var k=0;k<24&&!good;k++){
player.pos.set(px, heightAt(px,pz)+0.5, pz); player.vel.x=0; player.vel.z=0;
__resetInput(); __step(1);
var d=camForward(); d.y=0;
if(d.lengthSq()>=0.1){ d.normalize();
var fx=player.pos.x+d.x*2.4, fz=player.pos.z+d.z*2.4;
if(!occBlocked(fx,fz)&&propFree(fx,fz,2.7)&&Math.abs(fx)<MAP_SIZE/2-6&&Math.abs(fz)<MAP_SIZE/2-6&&waterDepthAt(fx,fz)<=0.1) good=true;
}
if(!good){ px+=13; pz-=7; }
}
return good;
};`);
ok(GZ('ZOMBIE_MODE')==='solo','前置: 丧尸局 ZOMBIE_MODE=solo (sf_zsub 沙箱预置)');
ok(GZ('player.pz|0')===200,'T1k0 ZP 开局 200 (ZCFG.zp.start)');
GZ('player.buildCount=10; player._poolT=0; player._poolKillMark=0;');   // 显式钉池账 (隔离 N10/N12 拆点影响, 池行为已在普通局判)
// ① ZP 优先: KeyN 选件 + KeyB 双按 → zp=2 cost=1 → 完成 pz -2 / 池不动 / +50 分 / BUILDS+1
GZ('var __zp1=__zbPrep(1);'); GZ('player.buildSel=0; player.pz=200;');
ok(GZ('__zp1')===true,'前置: 建造点①就位 (camForward 同源选点 24 候选内命中)');
KDZ('KeyN');
GZ('var __z1={sel:player.buildSel,ml:engMenuList(player)[player.buildSel]};');
KDZ('KeyB'); KDZ('KeyB');
const z1=GZ(`(function(){
var out={pend:!!player.pendingBuild};
if(player.pendingBuild){ out.type=player.pendingBuild.type; out.zp=player.pendingBuild.zp; out.cost=player.pendingBuild.cost; }
var s0=player.score, p0=player.pz|0, b0=player.buildCount, B0=BUILDS.length;
out.s0=s0; out.p0=p0; out.b0=b0; out.B0=B0;
if(player.pendingBuild){ VM.stateT=VM.stateDur; __step(2); }
out.s1=player.score; out.p1=player.pz|0; out.b1=player.buildCount; out.B1=BUILDS.length;
return out;
})()`);
ok(GZ('__z1.ml')==='wire'&&z1.pend&&z1.type==='wire'&&z1.zp===2&&z1.cost===1,'T1k ★ZP 优先: KeyN 选铁丝网+KeyB 双按 → pendingBuild {zp:2, cost:1} (BUILD_ZP.wire=2 兜底价 BUILD_COST.wire=1 双记)');
ok(z1.p1===z1.p0-2&&z1.b1===z1.b0&&z1.B1===z1.B0+1&&z1.s1===z1.s0+50,'T1k2 ★完成: pz 200→198 (ZP 优先支付) 且建造点池不动 (10) 且 BUILDS+1 且 +50 分 (件价 1×50; N3 正向专判)');
// ② 兜底: pz=0 池 8 → zp=0 扣点
GZ('var __zp2=__zbPrep(2);'); GZ('player.pz=0; player.buildCount=8; player.buildSel=0;');
ok(GZ('__zp2')===true,'前置: 建造点②就位');
KDZ('KeyB'); KDZ('KeyB');
const z2=GZ(`(function(){
var out={pend:!!player.pendingBuild};
if(player.pendingBuild){ out.type=player.pendingBuild.type; out.zp=player.pendingBuild.zp; out.cost=player.pendingBuild.cost; }
var b0=player.buildCount, p0=player.pz|0;
if(player.pendingBuild){ VM.stateT=VM.stateDur; __step(2); }
out.b0=b0; out.b1=player.buildCount; out.p1=player.pz|0;
return out;
})()`);
ok(z2.pend&&z2.zp===0&&z2.cost===1&&z2.b1===z2.b0-1&&z2.p1===0,'T1l ★ZP 不足兜底扣点: pendingBuild.zp=0 → 完成 8→7 且 pz 仍 0 (N2 对认: 兜底门拆则建不出)');
// ③ 双不足: pz=0 池 0 → 合并提示无账
GZ('var __zp3=__zbPrep(3);'); GZ('player.pz=0; player.buildCount=0;');
ok(GZ('__zp3')===true,'前置: 建造点③就位');
KDZ('KeyB'); KDZ('KeyB');
const z3p=GZ('__pops[__pops.length-1]||""');
ok(!GZ('player.pendingBuild')&&z3p.indexOf('ZP 不足')>=0&&z3p.indexOf('建造点不足')>=0,'T1l2 ★双不足: 无 pendingBuild 且弹合并提示\'ZP 不足 (0/2) 且建造点不足 (0/1)\' (N2/N13 正向专判: 拆后同走此岔/t2 回退原文)');
// ④ 菜单收窄: 非工程 3 件 + KeyN %3 回原点 + 工程 8 件
ok(GZ('engMenuList(player).length')===3&&GZ('engMenuList(player).join(",")')==='sandbag,wire,hedge','T1m ★丧尸非工程兵菜单=基础三件 (engMenuList; N11 正向专判: N11 只拆 KeyN 循环源不改本函数)');
GZ('var __zp4=__zbPrep(4);'); GZ('player.buildSel=0;');
ok(GZ('__zp4')===true,'前置: 建造点④就位');
var zseq=[];
for(let i=0;i<4;i++){ KDZ('KeyN'); zseq.push(GZ('player.buildSel')); }
ok(zseq.length===4&&zseq[0]===1&&zseq[1]===2&&zseq[2]===0&&zseq[3]===1,'T1m2 ★KeyN 连按 4 次: '+JSON.stringify(zseq)+' = %3 循环 (第 3 按回原点; N11 对认: %8 档为 1,2,3,4)');
GZ('player.cls=4;');
ok(GZ('engMenuList(player).length')===8&&GZ('engMenuList(player).indexOf("tower")')>=0&&GZ('engMenuList(player).indexOf("ammoc")')>=0,'T1m3 工程兵全菜单 8 件 (tower/ammoc 在; N11 正向专判)');
// ⑤ 工程 ZP 优先同规 + 工程建商店件走建造点+得分 100
GZ('var __zp5=__zbPrep(5);'); GZ('player.buildSel=0; player.buildCount=10; player.pz=200;');
ok(GZ('__zp5')===true,'前置: 建造点⑤就位');
KDZ('KeyB'); KDZ('KeyB');
const z5=GZ(`(function(){
var out={pend:!!player.pendingBuild};
if(player.pendingBuild){ out.type=player.pendingBuild.type; out.zp=player.pendingBuild.zp; out.cost=player.pendingBuild.cost; }
var s0=player.score, b0=player.buildCount;
if(player.pendingBuild){ VM.stateT=VM.stateDur; __step(2); }
out.s0=s0; out.s1=player.score; out.b0=b0; out.b1=player.buildCount;
out.diag={vm:VM.state, alive:player.alive, demol:!!player.demolish, nb:!!nearOwnBuild(player), pop:__pops[__pops.length-1]||''};
return out;
})()`);
ok(z5.pend&&z5.type==='sandbag'&&z5.zp===2&&z5.cost===1,'T1n ★工程兵 ZP 优先同规: cls4 建沙袋一样 zp=2 (ZOMBIE_MODE&&BUILD_ZP 有价即走 ZP, 与兵种无关)'+(z5.pend?'':' [diag='+JSON.stringify(z5.diag)+']'));
ok(z5.b1===z5.b0&&z5.s1===z5.s0+50,'前置: 工程沙袋完成 (池不动 +50 分)');
GZ('var __zp6=__zbPrep(6);'); GZ('player.buildSel=0;');
ok(GZ('__zp6')===true,'前置: 建造点⑥就位');
for(let i=0;i<4;i++) KDZ('KeyN');   // 全菜单 0→4 = medkit
ok(GZ('engMenuList(player)[player.buildSel]')==='medkit','前置: KeyN ×4 选到医疗箱 (全菜单下标 4)');
KDZ('KeyB'); KDZ('KeyB');
const z6b=GZ(`(function(){
var out={pend:!!player.pendingBuild};
if(player.pendingBuild){ out.type=player.pendingBuild.type; out.zp=player.pendingBuild.zp; out.cost=player.pendingBuild.cost; }
var s0=player.score, b0=player.buildCount;
if(player.pendingBuild){ VM.stateT=VM.stateDur; __step(2); }
out.s0=s0; out.s1=player.score; out.b0=b0; out.b1=player.buildCount;
return out;
})()`);
ok(z6b.pend&&z6b.type==='medkit'&&z6b.zp===0&&z6b.cost===2,'T1n3 工程建医疗箱 (无 ZP 价) 走建造点: pendingBuild {zp:0, cost:2}');
ok(z6b.b1===z6b.b0-2&&z6b.s1===z6b.s0+100,'T1n2 ★医疗箱落成: 建造点 -2 且 +100 分 (件价 2×50; N3 对认: 平分档只得 50)');

// ══ 收官 ══
console.log('');
console.log(NEG?'── NEG 阴性对照判定 ──':'── 正向判定 ──');
console.log('通过 '+PASS.length+' / 红 '+FAILN+' 条'+(NEG?' (红名: '+REDS.join(',')+')':''));
if(NEG){
// 精确红名集合: 十六补丁并施下应恰好翻红的断言 (映射见文件头;
//   正向专判=判据值在拆档下与期望同值或同岔, 不可能翻红 — N3 件价1×50≡平分 / N8 50%损血≡固定8s /
//   N2 双不足同岔 / N11 engMenuList 本身不改 / N12 局级复位已给 10 / N13 t2 回退原文同串)
const EXPECT=['T0c','T0e','T0f','T0g','T0g2','T0h','T0j','T0k2','T0k3','T0m','T0n','T0p','T0q','T0r','T0s','T0s2',
'T1a','T1b','T1b3','T1b4','T1c','T1d2','T1e2','T1e3','T1f','T1f4','T1g','T1g2','T1h','T1i2','T1l','T1m2','T1n2'];
const miss=EXPECT.filter(x=>!REDS.includes(x)), extra=REDS.filter(x=>!EXPECT.includes(x));
console.log('期望红名 '+EXPECT.length+' 项: 漏红 '+(miss.length?miss.join(','):'无')+' · 多红 '+(extra.length?extra.join(','):'无'));
console.log('映射: N1→T0f/T1e2/T1e3 · N2→T0c/T1l · N3→T0e/T1d2/T1n2 · N4→T0k2/T1b/T1b3/T1b4(链) · N5→T0k3/T1c · N6→T0g2/T1h · N7→T0g/T1f/T1f4 · N8→T0h/T1i2 · N9→T0j/T1g/T1g2 · N10→T0n/T1a · N11→T0p/T1m2 · N12→T0m · N13→T0q · N14→T0s2 · N15→T0s · N16→T0r');
console.log('注: T1b4 (满池仍15) 在 N4 档随 T1b3 链翻红 — 14 未涨成 15, 200 帧断言按 15 判即红; 属 N4 连带非独立判据');
process.exit(miss.length===0&&extra.length===0?0:1);
}
process.exit(FAILN===0?0:1);
