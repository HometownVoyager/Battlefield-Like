// ─────────────────────────────────────────────
// dev/verify-crushdbg-zp-20261128.js —— 2026-11-28 三项批 (戳 20261128e):
//   ①坦克碾碎迟滞减速 (用户令"碾碎可被碾碎的地物/建筑的时候, 稍微迟滞减速一下", 范围裁定=crush地物+
//     撞塌建筑+树木/竹/枯树压倒): CRUSH_DRAG={dur:0.8, mul:0.45} (00-config) —— 置窗点三处 (15-vehicles
//     _tkBoxCb crush 分支 / STRUCT_RAM 撞塌分支 / 04b floraCrushTank 树·枯树), 消费点单源 (15-vehicles
//     Tank.update 位移段, 与 _zClingN 卡尸减速同口径: 只缩 mvx/mvz, 车速账 vel 不动), 系数自 ×0.55 起
//     随剩余窗口线性恢复到 ×1, 每次新碾毁刷新。
//   ②调试模式全免费建造 + 观战禁止建造 (用户裁定"调试模式开放全部建造,全部免费。观战模式应当无法建造"):
//     engMenuList 调试观战放行全菜单 (丧尸收窄/兵种门让位, tower/ammoc 可见) + engBuild 头部 !pl.alive
//     账目层保险 (自由观战/尸体不得起造) + _specFree 支付豁免 (cost/zp 双零进 pendingBuild ⇒ exec 扣款/
//     建造得分/拆除退款自然全走零) + 19-input KeyB/KeyN 门加 player.spectator (自由观战有上方 alive 总门
//     到不了这里) + 提示串免费档 (KeyN 弹字 + 20-player 调试提示行 + index.html/00b 长短说明)。
//   ③双队对抗 ZP 分池分显 (用户令"阵营对抗的时候分别显示双方的ZP"; 代码排查结论: ZP 池本只有 player.pz
//     一份, 双队"共享"观感=单一池设计): teams 局两支人类队各一池 —— 玩家队=player.pz (pzGain 同账单源),
//     对方队=zFoeZP (Bot 杀丧尸/占旗入账, 只进不出 —— Bot 不建造); 入账单源 zTeamZPGain (solo 恒 no-op,
//     单队计费逐位不变) + 击杀价单源 zKillZPOf (21-match onPlayerKill 与 25 Zombie.die Bot 分支共用) +
//     21-match 占旗 teams 整队入账 (玩家分支改 teams 让位防双发) + updateZpHud teams 双显 (词典键
//     '☣ 我方 {0} · 敌方 {1} ZP')。
// 用法: node dev/verify-crushdbg-zp-20261128.js [--neg]
// 判据:
//   T0 源码锚 (八文件: 00-config/15-vehicles/04b-fire/06-engineering/19-input/25-zombies/21-match/20-player
//      + 00b 词典 + 戳钉) + 旧写法绝迹负向。
//   T1 行为断言: 普通局 boot (碾碎迟滞 unit+集成+A/B 消费比 / 树压倒 / 调试免费建 / 观战拒建) +
//      丧尸 solo boot (调试免费建 ZP 不动 / 非观战照扣回归钉 / solo 分池 no-op) + teams boot (分池双显 /
//      Bot 杀丧尸入对方池 / 玩家杀入本队池 / zKillZPOf 价)。
//   --neg (十补丁, 红名↔补丁): N1 crush 置窗拆→T0b/T1a/T1b · N2 位移消费拆→T0c/T1c · N3 specFree 拆→
//      T0e/T1e/T1e3/T1i/T1i3/T1g2 · N4 alive 门拆→T0d/T1g2 · N5 全菜单拆→T0f/T1i2 · N6 KeyB 键门拆→T0g/T1e/
//      T1i · N7 对方池拆→T0i2/T1k/T1l · N8 双显拆→T0j/T1m · N9 占旗 grant 拆→T0k (T1 无旗点集成,
//      T0-only) · N10 树窗拆→T0c2/T1d。
//   正向专判: T1a2/T1b2 (碾毁事实与 ×0.92 扣速在 N1 下不变=拆的只是迟滞窗) / T1e2 (普通局非工程菜单本就
//      全量, N5 不改) / T1f (KeyN 门独立锚, N6 只拆 B 门) / T1k2 (玩家队路由走 if 支,
//      N7 只拆 else) / T1j (非观战计费链在 N3/N6 下不变) / T1l2 (玩家杀走 onPlayerKill→pzGain, N7 不涉) /
//      T1h (solo no-op 在 N7 下仍 no-op)。
// 沙箱要点承 verify-eng-batch2-20261128 (boot 骨架/__zbPrep camForward 同源选点/KeyB 双按确认/VM.stateT
//   直置走完) 与 verify-ridepose-batch-20261128 (new Tank 自建+直接置窗测位移 A/B) 与 verify-zombie
//   (sf_zsub 预置 + beginFreshMatch + Bot 平移隔离)。★植物测: 合成 rec 经 floraHashAdd 直插哈希格
//   (treeFall 只需 cyl/alive/s/g0/x/z; 测完不 __step, FALLING 动画不消费无 mesh 桩)。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const stub=require('./_bootstub.js');
require('./_bootpatch.js').patch(stub.sandbox);
{const P=Object.getPrototypeOf(stub.THREE.Group.prototype); if(!P.clear) P.clear=function(){ this.children.length=0; };}
{const V3P=stub.THREE.Vector3.prototype; if(!V3P.negate) V3P.negate=function(){ this.x=-this.x; this.y=-this.y; this.z=-this.z; return this; };}   // ★negate: 缺则 updateCamera 帧护栏截断当帧 (承 eng-batch2 探针课)
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
Body:class{constructor(o){Object.assign(this,o||{});this.shapes=[];this.position=new V3();this.velocity=new V3();this.angularVelocity=new V3();this.quaternion=new Quat();this.angularDamping=0;this.linearDamping=0;}addShape(s){this.shapes.push(s);}},   // ★angularVelocity: 缺则帧护栏截断 (eng-batch2 探针课)
Box:class{},Sphere:class{},Material:class{},ContactMaterial:class{},NaiveBroadphase:class{},
PointToPointConstraint:class{constructor(a,pa,b,pb){this.bodyA=a;this.pivotA=pa;this.bodyB=b;this.pivotB=pb;}},
};})();

const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const FILES=[...html.matchAll(/src="(js\/[^"?]+)/g)].map(m=>m[1]);
console.log('载入清单: 解析 index.html 得 '+FILES.length+' 个脚本');

// ── NEG 阴性对照: 十补丁 (正常跑不启用) ──
const NEG=process.argv.includes('--neg');
const SRC={},PATCH_MAP={};
const NEG_PATCHES=[
// N1 crush 置窗拆 (15-vehicles _tkBoxCb crush 分支): 件照碾但迟滞窗不置 ⇒ T0b 红 + T1a/T1b 红
['js/15-vehicles.js','T._crushDragT=nowT+CRUSH_DRAG.dur;   // ★20261128e 碾碎迟滞置窗 (消费在 Tank.update 位移段; 连碾每件刷新)','T._crushDragT=undefined;   // NEG: crush 置窗拆'],
// N2 位移消费拆 (15-vehicles Tank.update): 置窗照旧但系数永不生效 ⇒ T0c 红 + T1c 红 (A/B 同速)
['js/15-vehicles.js','if(this._crushDragT&&nowT<this._crushDragT){','if(false&&this._crushDragT&&nowT<this._crushDragT){'],
// N3 specFree 拆 (06 engBuild): 调试观战掉回普通计费链 ⇒ T0e 红 + T1e/T1i 红 (ZP 被扣) + T1g2 红 (自由观战直调建出账)
['js/06-engineering.js','const _specFree=!!(pl.isPlayer&&pl.spectator);','const _specFree=false;'],
// N4 alive 门拆 (06 engBuild): 尸体/自由观战账目层放行 ⇒ T0d 红 + T1g2 红
['js/06-engineering.js','if(!pl.alive) return;   // ★20261128e 观战/死亡不得起造','if(false) return;   // ★20261128e 观战/死亡不得起造'],
// N5 全菜单拆 (06 engMenuList): 调试观战掉回收窄/兵种门 ⇒ T0f 红 + T1i2 红 (丧尸收窄 8→3; T1e2 正向专判: 普通局非工程本就全菜单)
['js/06-engineering.js','if(pl&&pl.spectator) return BUILD_MENU;   // ★20261128e 调试观战全菜单','if(false) return BUILD_MENU;   // ★20261128e 调试观战全菜单'],
// N6 KeyB 键门拆 (19-input): 调试观战按 B 无效 ⇒ T0g 红 + T1e/T1i 红 (键路建不出; T1g 观战拒建仍绿=alive 总门; T1f 正向专判: N 门独立锚)
['js/19-input.js','if((player.cls===4||ZOMBIE_MODE||player.spectator)&&!player.onVehicle&&!player.onMG&&!player.onAT&&!player.onAA&&!player.onMortar){','if((player.cls===4||ZOMBIE_MODE)&&!player.onVehicle&&!player.onMG&&!player.onAT&&!player.onAA&&!player.onMortar){'],
// N7 对方池拆 (25-zombies zTeamZPGain): 对方队入账丢失 ⇒ T0i2 红 + T1k/T1l 红
['js/25-zombies.js','else zFoeZP=Math.max(0,zFoeZP+n);','else{}'],
// N8 双显拆 (25-zombies updateZpHud): teams 掉回单池串 ⇒ T0j 红 + T1m 红
['js/25-zombies.js',"const _zpSeg=(ZOMBIE_MODE==='teams')?t('☣ 我方 {0} · 敌方 {1} ZP',String(player.pz|0),String(zFoeZP|0)):('☣ '+(player.pz|0)+' ZP');","const _zpSeg=('☣ '+(player.pz|0)+' ZP');"],
// N9 占旗 grant 拆 (21-match): T0-only (无旗点集成判据)
['js/21-match.js',"if(ZOMBIE_MODE==='teams'&&(attacker===0||attacker===1)&&typeof zTeamZPGain==='function') zTeamZPGain(attacker,ZCFG.zp.flag);",';'],
// N10 树窗拆 (04b floraCrushTank tree 分支): 枯树行仍在 ⇒ T0c2 红 (计数 2→1) + T1d 红
['js/04b-fire.js','t._crushDragT=nowT+CRUSH_DRAG.dur;   // ★20261128e 碾碎迟滞置窗 (用户令范围含压倒树木/竹; 消费 15-vehicles Tank.update)','/* NEG: 树窗拆 */'],
];
for(const [f,from,to] of NEG_PATCHES){
if(!NEG){ if(!(fs.readFileSync(path.join(root,f),'utf8').includes(from))){ console.log('✘ NEG from 串不在源内: '+f+' :: '+from.slice(0,60)); process.exit(1); } }
else { PATCH_MAP[f]=(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:fs.readFileSync(path.join(root,f),'utf8')).split(from).join(to); }
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
const id=(label.match(/^(T[01][a-z]\d?)\b/)||[])[1]||null;
if(cond){ PASS.push(id||label); console.log('  ✔ '+label); }
else { FAILN++; if(id) REDS.push(id); console.log((NEG?'  ● [期望红] ':'  ✘ ')+label); }
}
const RESET_SRC='var __resetInput=(n)=>{ player.nadeHeld=false; player.nadeIsAT=false; player.nadeIsSmoke=false; player.nadeIsIncin=false; VM.state="idle"; VM.stateT=0; VM.stateDur=0; vmSndFlags={}; };';
const POPS_SRC='var __pops=[]; var __ssp0=showScorePop; showScorePop=function(m){ __pops.push(String(m)); __ssp0(m); };';
const OPEN_SRC=`var __openSpot=(r,off)=>{
for(var a=(off||0);a<(off||0)+120;a++){
var ang=a*2.399, rr=40+(a%25)*9; var px=Math.sin(ang)*rr, pz=Math.cos(ang)*rr;   // 半径循环复用 (旧写法半径线性外推, 大 off 角全部越过 MAP_SIZE/2-30 被 continue ⇒ 后段选点恒空)
if(Math.abs(px)>MAP_SIZE/2-30||Math.abs(pz)>MAP_SIZE/2-30) continue;
if(occBlocked(px,pz)||!propFree(px,pz,r)||waterDepthAt(px,pz)>0.05) continue;
var h0=heightAt(px,pz);
var flat=Math.abs(heightAt(px+6,pz)-h0)<0.35&&Math.abs(heightAt(px,pz+6)-h0)<0.35;
var busy=false;
for(const s of soldiers){ if(s.alive&&!s.zombie&&Math.hypot(s.pos.x-px,s.pos.z-pz)<70){ busy=true; break; } }
if(!busy){
busy=false;
floraNear(px,pz,9,function(){ busy=true; });
}
if(flat&&!busy) return [px,pz];
}
return null;
};`;

// ═════ 前置: 普通局真开局 + 部署 ═════
let IDXS=1; { const c0=boot(0); IDXS=vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="stalingrad")',c0); }
const ctx=boot(IDXS);
const G=s=>vm.runInContext(s,ctx);
const KD=c=>G(`dispatchEvent(new KeyboardEvent('keydown',{code:'${c}'}));`);
let err0=null;
try{ G("document.getElementById('startBtn').onclick();"); }catch(e){ err0=String(e&&e.stack||e); }
if(!err0){ try{ G('if(!player.alive||!player.deployed) deployPlayer();'); }catch(e){ err0='deployPlayer: '+String(e&&e.stack||e); } }
if(err0||!G('player.alive')){ console.log('  ✘ 开局/部署失败 '+(err0||'player.alive=false')); process.exit(1); }
G('pointerLocked=true;');
G('__step(3);');
G(RESET_SRC); G('__resetInput();');
G(POPS_SRC); G(OPEN_SRC); G('if(typeof SpecLayer!=="undefined") SpecLayer.on=false;');   // 观战信息层关: specLineOf 用 THREE.Line (沙箱无此桩), 该层不在本批测域
G('for(const s of soldiers){ if(!s.isPlayer){ s.pos.x+=400; s.pos.z+=400; s.pos.y=heightAt(s.pos.x,s.pos.z); if(s.path) s.path.length=0; } }');
G('__planesFrozen=[]; for(const pl of planes){ if(pl&&pl.alive){ pl.alive=false; pl.respawnT=1e9; __planesFrozen.push(pl); } }');
G('player.protUntil=1e9;');
ok(html.includes("__sfStyleVer='20261128e'")&&(html.match(/\?v=20261128e/g)||[]).length>=1,'前置: 版本戳 20261128e 在位 (index.html ?v= ×'+(html.match(/\?v=20261128e/g)||[]).length+' + __sfStyleVer)');

// ══ T0 源码锚 ══
console.log('T0 源码锚');
const s00=srcOf('js/00-config.js'),s15=srcOf('js/15-vehicles.js'),s04b=srcOf('js/04b-fire.js'),s06=srcOf('js/06-engineering.js'),
s19=srcOf('js/19-input.js'),s25=srcOf('js/25-zombies.js'),s21=srcOf('js/21-match.js'),s20p=srcOf('js/20-player.js'),
s00b=srcOf('js/00b-i18n.js');
ok(s00.includes('const CRUSH_DRAG={dur:0.8, mul:0.45};'),'T0a ★00-config CRUSH_DRAG 逐字 (dur 0.8 / mul 0.45)');
ok((s15.split('T._crushDragT=nowT+CRUSH_DRAG.dur;   // ★20261128e 碾碎迟滞置窗').length-1)===1,'T0b ★crush 分支置窗恰 1 处 (N1 对认: 拆则 0)');
ok(s15.includes('T._crushDragT=nowT+CRUSH_DRAG.dur;   // ★20261128e 撞塌建筑同入迟滞带'),'T0b2 ★STRUCT_RAM 撞塌置窗行在位');
ok(s15.includes('if(this._crushDragT&&nowT<this._crushDragT){')&&s15.includes('const _cgf=1-CRUSH_DRAG.mul*(1-_cgk);')&&s15.includes('mvx*=_cgf; mvz*=_cgf;'),'T0c ★Tank.update 位移段消费 (窗判+线性恢复公式+mv 缩放; N2 对认)');
ok((s04b.split('t._crushDragT=nowT+CRUSH_DRAG.dur;').length-1)===2,'T0c2 ★04b 树/枯树置窗恰 2 处 (treeFall+floraTopple; N10 对认: 拆则 1)');
ok(s06.includes('if(!pl.alive) return;   // ★20261128e 观战/死亡不得起造'),'T0d ★engBuild alive 账目层保险 (N4 对认)');
ok(s06.includes('const _specFree=!!(pl.isPlayer&&pl.spectator);')&&s06.includes('const cost=_specFree?0:(BUILD_COST[type]||1);')&&s06.includes('if(!_specFree&&ZOMBIE_MODE&&pl.isPlayer&&BUILD_ZP[type]!==undefined){'),'T0e ★engBuild specFree 三锚 (豁免旗+cost 双零+支付链门; N3 对认)');
ok(s06.includes('if(pl&&pl.spectator) return BUILD_MENU;   // ★20261128e 调试观战全菜单'),'T0f ★engMenuList 调试观战全菜单放行 (N5 对认)');
ok(s19.includes("if((player.cls===4||ZOMBIE_MODE||player.spectator)&&!player.onVehicle&&!player.onMG&&!player.onAT&&!player.onAA&&!player.onMortar){")&&s19.includes("if(e.code==='KeyN'&&(player.cls===4||ZOMBIE_MODE||player.spectator)){"),'T0g ★19-input KeyB/KeyN 门加 spectator (N6 对认: KeyB 门拆)');
ok(s19.includes("player.spectator?t2('建造选择: {0} (免费 · 按B放置)',t2(bn))"),'T0g2 ★KeyN 免费提示档 (词典键同批)');
ok(s25.includes('let zFoeZP=0;')&&s25.includes(' zFoeZP=ZCFG.zp.start;'),'T0h ★25-zombies 对方池声明+每局重置 (zombieMatchStart)');
ok(s25.includes('function zKillZPOf(kind){')&&s25.includes('function zTeamZPGain(team,n){')&&s25.includes('zTeamZPGain(attacker.team,zKillZPOf(this.kind));'),'T0i ★25-zombies 价单源+分池单源+Zombie.die Bot 分支钩');
ok(s25.includes('else zFoeZP=Math.max(0,zFoeZP+n);'),'T0i2 ★分池 else 支 (对方队入账; N7 对认)');
ok(s25.includes("const _zpSeg=(ZOMBIE_MODE==='teams')?t('☣ 我方 {0} · 敌方 {1} ZP',String(player.pz|0),String(zFoeZP|0)):('☣ '+(player.pz|0)+' ZP');")&&s00b.includes("'☣ 我方 {0} · 敌方 {1} ZP':'☣ Ours {0} · Enemy {1} ZP'"),'T0j ★updateZpHud teams 双显+词典键 (N8 对认)');
ok(s21.includes("if(c.isPlayer){ showKillPop(t('占领 {0} 点',f.id),SCORE_TABLE.flag); player.caps=(player.caps||0)+1; if(ZOMBIE_MODE&&ZOMBIE_MODE!=='teams') pzGain(ZCFG.zp.flag); }")&&s21.includes("zTeamZPGain(attacker,ZCFG.zp.flag);"),'T0k ★21-match 占旗: solo 玩家支保留+teams 整队 grant (N9 对认)');
ok(s21.includes('pzGain(zKillZPOf(victim.kind));'),'T0k2 ★onPlayerKill 击杀价走 zKillZPOf 单源');
ok(s20p.includes("· <b>E</b> 脱离 · <b>N</b>/<b>B</b> 免费建造'")&&s00b.includes("脱离 · <b>N</b>/<b>B</b> 免费建造':'Debug mode"),'T0l ★调试提示行+词典键值同步 (免费建造)');
// T0 负向: 旧写法绝迹
ok(!s19.includes("if(e.code==='KeyN'&&(player.cls===4||ZOMBIE_MODE)){")&&!s06.includes('const cost=BUILD_COST[type]||1;')&&!s21.includes("pzGain(victim.kind==='brute'?")&&!s25.includes("zHudEl.textContent='☣ '+(player.pz|0)+' ZP · '")&&!s21.includes('if(ZOMBIE_MODE) pzGain(ZCFG.zp.flag);'),'T0m ★旧写法绝迹六连 (旧 KeyN 门/旧 cost 行/旧 Bot 分支/旧击杀三元/旧单池串/旧占旗 grant)');

// ══ T1 普通局: 碾碎迟滞 ══
console.log('T1 碾碎迟滞 (unit + 集成 + A/B 消费比)');
const t1a=G(`(function(){
var out={};
var sp=__openSpot(9); out.prep=!!sp;
if(!out.prep) return out;
var sx=sp[0], sz=sp[1];
var m=sandbagWall(sx,sz,4,0);
out.wall=!!m;
var box=null;
for(const b of BOXES){ if(b.crush&&!b.dead&&Math.hypot((b.minX+b.maxX)/2-sx,(b.minZ+b.maxZ)/2-sz)<3){ box=b; break; } }
out.box=!!box;
var t=new Tank(player.team,0);
t.pos.set(sx,heightAt(sx,sz),sz); t.vel=6; t.playerDriven=false;
_tkC.t=t; _tkC.cx=(box.minX+box.maxX)/2; _tkC.cz=(box.minZ+box.maxZ)/2; _tkC.sn=1; _tkC.cs=0; _tkC.pass=0; _tkC.hit=false;
try{ _tkBoxCb(box); out.err=''; }catch(e){ out.err=String(e&&e.message||e).slice(0,80); }
out.dead=box.dead===true;
out.vel=Math.round(t.vel*1000)/1000;
out.dragSet=t._crushDragT===nowT+CRUSH_DRAG.dur;
out.dragVal=t._crushDragT||0;
tanks.splice(tanks.indexOf(t),1);
return out;
})()`);
ok(t1a.prep&&t1a.wall&&t1a.box,'T1-prep 沙袋墙+自建坦克就位 (开放平坦地)');
ok(t1a.dead&&Math.abs(t1a.vel-6*0.92)<0.01,'T1a2 碾毁事实: crush 盒置死 + vel×0.92 既有口径不变 (N1 下仍绿)');
ok(t1a.err===''&&t1a.dragSet,'T1a ★crush 分支置窗: _crushDragT=nowT+CRUSH_DRAG.dur (N1 对认)');
const t1b=G(`(function(){
var out={};
var sp=__openSpot(9); if(!sp) { out.prep=false; return out; }
out.prep=true;
var sx=sp[0]+30, sz=sp[1]+30;
sandbagWall(sx,sz,4,0);
var box=null;
for(const b of BOXES){ if(b.crush&&!b.dead&&Math.hypot((b.minX+b.maxX)/2-sx,(b.minZ+b.maxZ)/2-sz)<3){ box=b; break; } }
if(!box){ out.box=false; return out; }
out.box=true;
var t=new Tank(player.team,0);
t.pos.set(sx-3.4,heightAt(sx-3.4,sz),sz); t.yaw=Math.PI/2; t.vel=6;   // 朝 +x 开向墙
out.err=''; var hitK=-1;
for(var k=0;k<40;k++){ t.vel=6; try{ __step(1); }catch(e){ out.err=String(e&&e.message||e).slice(0,80); break; } if(box.dead){ hitK=k; break; } }
out.hitK=hitK;
out.dead=box.dead===true;
out.dragSet=t._crushDragT>0;
tanks.splice(tanks.indexOf(t),1);
return out;
})()`);
ok(t1b.prep&&t1b.box&&t1b.err===''&&t1b.hitK>=0,'T1-prep2 坦克驶入沙袋墙就位 (40 帧内判中) [err='+(t1b.err||'无')+' hitK='+t1b.hitK+' dead='+t1b.dead+' box='+t1b.box+' prep='+t1b.prep+']');
ok(t1b.dead&&t1b.dragSet,'T1b ★集成: Tank.update 碰撞pass 碾毁 crush 件且迟滞窗置上 (N1 对认)');
const t1c=G(`(function(){
var out={};
var sB=__openSpot(9,13), sA=__openSpot(9,54);   // 两点各自独立过闸 (平地/无植/无兵), 旧写法把 200m 外地形当已验证 = 坡度/水域噪声源
if(!sB||!sA){ out.prep=false; out.gotB=!!sB; out.gotA=!!sA; return out; }
out.prep=true;
function mk(x,z,drag){
var t=new Tank(player.team,0);
t.pos.set(x,heightAt(x,z),z); t.yaw=Math.PI/2; t.vel=6; t.playerDriven=false;
if(drag) t._crushDragT=nowT+CRUSH_DRAG.dur;
return t;
}
var A=mk(sA[0],sA[1],true), B=mk(sB[0],sB[1],false);
var ax0=A.pos.x, bx0=B.pos.x;
out.errA='';
for(var k=0;k<1;k++){ A.vel=6; B.vel=6; try{ __step(1); }catch(e){ out.errA=String(e&&e.message||e).slice(0,110); break; } }
out.ad=Math.round((A.pos.x-ax0)*1000)/1000;
out.bd=Math.round((B.pos.x-bx0)*1000)/1000;
out.ratio=Math.round(out.ad/Math.max(0.001,out.bd)*1000)/1000;
tanks.splice(tanks.indexOf(A),1); tanks.splice(tanks.indexOf(B),1);
return out;
})()`);
ok(t1c.prep&&t1c.errA==='','T1-prep3 A/B 双坦克就位 (各自独立选点, B 无窗对照) [errA='+(t1c.errA||'无')+' gotA='+t1c.gotA+' gotB='+t1c.gotB+' ad='+t1c.ad+' bd='+t1c.bd+']');
ok(t1c.bd>0.05,'T1c2 对照坦克本帧位移正常 (>0.05m; vel 6×dt×衰减)');
ok(t1c.ratio>0.45&&t1c.ratio<0.65,'T1c ★迟滞消费: 置窗坦克首帧位移 ≈ ×0.55 (实测 '+t1c.ratio+'; N2 对认: 消费拆则 ≈1)');
const t1d=G(`(function(){
var out={};
var sp=__openSpot(9,7); if(!sp){ out.prep=false; return out; }
out.prep=true;
var x=sp[0]-50, z=sp[1]-50, g0=heightAt(x,z);
var rec={x:x,z:z,kind:'tree',alive:true,s:1,g0:g0,cyl:{x:x,z:z,r:0.3,y0:g0,y1:g0+6}};
floraHashAdd(rec);
var t=new Tank(player.team,0);
t.pos.set(x,heightAt(x,z),z); t.vel=2;
try{ floraCrushTank(t); out.err=''; }catch(e){ out.err=String(e&&e.message||e).slice(0,80); }
out.fell=rec.alive===false;
var _fi=FALLING.indexOf(rec); if(_fi>=0) FALLING.splice(_fi,1);   // 合成 rec 无实例批账 (im/idx), 留 FALLING 队列会让 treeInstanceMatrices 每帧炸护栏饿死 VM tick —— 断言完即摘
out.dragSet=t._crushDragT===nowT+CRUSH_DRAG.dur;
tanks.splice(tanks.indexOf(t),1);
return out;
})()`);
ok(t1d.prep&&t1d.err===''&&t1d.fell,'T1d2 树压倒事实: 合成植被经 floraCrushTank 倒伏 (rec.alive=false)');
ok(t1d.dragSet,'T1d ★树压倒置窗: _crushDragT=nowT+CRUSH_DRAG.dur (N10 对认)');

// ══ T1 普通局: 调试免费建造 + 观战拒建 ══
console.log('T1 调试免费建造 (普通局, cls0 非工程)');
const t1e=G(`(function(){
var out={};
player.spectator=true; player.cls=0;
__resetInput();
out.ml=engMenuList(player).length;
var sp=__openSpot(6); out.prep=!!sp;
if(!out.prep) return out;
player.pos.set(sp[0],heightAt(sp[0],sp[1])+0.5,sp[1]);
__step(1); __resetInput();
var d=camForward(); d.y=0; if(d.lengthSq()>=0.1){ d.normalize(); out.spotGood=!occBlocked(player.pos.x+d.x*2.4,player.pos.z+d.z*2.4); } else out.spotGood=false;
var s0=player.score, b0=player.buildCount||0, B0=BUILDS.length;
dispatchEvent(new KeyboardEvent('keydown',{code:'KeyB'}));
dispatchEvent(new KeyboardEvent('keydown',{code:'KeyB'}));
out.pend=!!player.pendingBuild;
if(player.pendingBuild){ out.cost=player.pendingBuild.cost; out.zp=player.pendingBuild.zp; }
out.vm=VM.state; out.pop=__pops[__pops.length-1]||'';
if(player.pendingBuild){ VM.stateT=VM.stateDur; __step(2); }
out.B1=BUILDS.length; out.s1=player.score; out.b1=player.buildCount||0;
out.dB=B1out(B0,out.B1); function B1out(a,b){ return b-a; }
out.dS=out.s1-s0; out.dBk=out.b1-b0;
out.pzTouched=player.pz!==undefined&&player.pz!==0;
out.vmAfter=VM.state; out.pendAfter=!!player.pendingBuild;
player.spectator=false;
return out;
})()`);
ok(t1e.prep&&t1e.spotGood,'T1-prep4 调试建造点就位 (camForward 同源)');
ok(t1e.ml===6,'T1e2 ★调试观战全菜单: cls0 普通局 engMenuList=6 (N5 对认: 掉回非工程=0 件不可建)');
ok(t1e.pend&&t1e.cost===0&&t1e.zp===0,'T1e ★免费账: cls0 调试观战 KeyB 双按建出 pendingBuild {cost:0, zp:0} (N3/N6 对认) [diag pend='+t1e.pend+' cost='+t1e.cost+' vm='+t1e.vm+' pop='+t1e.pop+' spot='+t1e.spotGood+']');
ok(t1e.dB===1&&t1e.dS===0&&t1e.dBk===0&&!t1e.pzTouched,'T1e3 ★落成全零账: BUILDS+1 且 零分/零建造点/ZP 不沾 (N3 对认) [dB='+t1e.dB+' dS='+t1e.dS+' dBk='+t1e.dBk+' pzT='+t1e.pzTouched+' vmAfter='+t1e.vmAfter+' pendAfter='+t1e.pendAfter+']');
const t1f=G(`(function(){
var out={};
player.spectator=true; player.cls=0;
__resetInput();
var s0=player.buildSel||0;
dispatchEvent(new KeyboardEvent('keydown',{code:'KeyN'}));
out.cycled=player.buildSel!==s0;
player.spectator=false;
player.buildSel=s0;
return out;
})()`);
ok(t1f.cycled,'T1f ★调试观战 KeyN 循环放行 (N6 对认: KeyB 门拆只拆 B, N 门独立锚)');
const t1g=G(`(function(){
var out={};
player.spectator=true; player.cls=0;
__resetInput();
var b0=!!player.pendingBuild;
player.alive=false;
dispatchEvent(new KeyboardEvent('keydown',{code:'KeyB'}));
dispatchEvent(new KeyboardEvent('keydown',{code:'KeyB'}));
out.keyBlocked=!player.pendingBuild;
engBuild(player);
out.directBlocked=!player.pendingBuild;
player.alive=true; player.spectator=false;
return out;
})()`);
ok(t1g.keyBlocked,'T1g 自由观战 (alive=false) KeyB 键路拒建 (19-input alive 总门; N4/N6 下仍绿=上游挡)');
ok(t1g.directBlocked,'T1g2 ★engBuild 账目层 alive 保险: 自由观战直调不落账 (N4 对认: 门拆则建出)');

// ═════ 丧尸 solo boot ═════
console.log('T1 丧尸 solo: 调试免费建 + solo 分池 no-op');
let PGIDX=0; { const c0=boot(0); PGIDX=vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="procgen")',c0); }
const zctx=boot(PGIDX,{sf_zsub:'solo'});
const GZ=s=>vm.runInContext(s,zctx);
const KDZ=c=>GZ(`dispatchEvent(new KeyboardEvent('keydown',{code:'${c}'}));`);
let zerr=null;
try{ GZ('beginFreshMatch();'); }catch(e){ zerr='start: '+String(e&&e.stack||e); }
if(!zerr){ try{ GZ('if(!player.alive||!player.deployed) deployPlayer();'); }catch(e){ zerr='deploy: '+String(e&&e.stack||e); } }
if(zerr||!GZ('player.alive')){ console.log('  ✘ 丧尸开局/部署失败 '+(zerr||'player.alive=false')); process.exit(1); }
GZ('for(const s of soldiers) s.protUntil=0; player.protUntil=1e9;');
GZ('for(const s of soldiers){ if(!s.isPlayer&&!s.zombie){ s.pos.x+=800; s.pos.z+=800; s.pos.y=heightAt(s.pos.x,s.pos.z); if(s.path) s.path.length=0; } }');
GZ('pointerLocked=true;');
GZ('__step(3);');
GZ(RESET_SRC); GZ('__resetInput();');
GZ(POPS_SRC); GZ(OPEN_SRC); GZ('if(typeof SpecLayer!=="undefined") SpecLayer.on=false;');
GZ(`var __zSpot=(r)=>{
for(var a=0;a<40;a++){
var ang=a*2.399, rr=30+(a%25)*8; var px=Math.sin(ang)*rr, pz=Math.cos(ang)*rr;
if(Math.abs(px)>MAP_SIZE/2-30||Math.abs(pz)>MAP_SIZE/2-30) continue;
if(occBlocked(px,pz)||!propFree(px,pz,r)||waterDepthAt(px,pz)>0.05) continue;
player.pos.set(px,heightAt(px,pz)+0.5,pz); player.vel.x=0; player.vel.z=0;
__resetInput(); __step(1);
var d=camForward(); d.y=0;
if(d.lengthSq()>=0.1){ d.normalize();
var fx=player.pos.x+d.x*2.4, fz=player.pos.z+d.z*2.4;
if(!occBlocked(fx,fz)&&propFree(fx,fz,2.7)&&Math.abs(fx)<MAP_SIZE/2-6&&Math.abs(fz)<MAP_SIZE/2-6&&waterDepthAt(fx,fz)<=0.1) return true;
}
}
return false;
};`);
ok(GZ('typeof __zSpot')==='function','前置: __zSpot 就位 ('+GZ('typeof __zSpot')+')');
ok(GZ('ZOMBIE_MODE')==='solo','前置: 丧尸局 ZOMBIE_MODE=solo');
ok(GZ('player.pz|0')===200,'T1h0 solo ZP 开局 200');
const t1h=GZ(`(function(){
var out={};
player.spectator=false; player.cls=0;
var p0=player.pz|0, f0=zFoeZP|0;
zTeamZPGain(player.team,15); zTeamZPGain(1-player.team,40);
out.p1=player.pz|0; out.f1=zFoeZP|0;
out.noopP=out.p1===p0; out.noopF=out.f1===f0;
return out;
})()`);
ok(t1h.noopP&&t1h.noopF,'T1h ★solo 分池恒 no-op: zTeamZPGain 两路都不动账 (pz 200 / zFoe 不存在化; 单队计费逐位不变; N7 下仍绿)');
const t1i=GZ(`(function(){
var out={};
player.spectator=true; player.cls=0;
__resetInput();
out.ml=engMenuList(player).length;
out.prep=__zSpot(6);
if(!out.prep) return out;
var p0=player.pz|0, s0=player.score, b0=player.buildCount||0, B0=BUILDS.length;
dispatchEvent(new KeyboardEvent('keydown',{code:'KeyB'}));
dispatchEvent(new KeyboardEvent('keydown',{code:'KeyB'}));
out.pend=!!player.pendingBuild;
if(player.pendingBuild){ out.cost=player.pendingBuild.cost; out.zp=player.pendingBuild.zp; }
if(player.pendingBuild){ VM.stateT=VM.stateDur; __step(2); }
out.p1=player.pz|0; out.s1=player.score; out.b1=player.buildCount||0; out.B1=BUILDS.length;
out.dP=out.p1-p0; out.dS=out.s1-s0; out.dBk=out.b1-b0; out.dB=out.B1-B0;
player.spectator=false;
return out;
})()`);
ok(t1i.prep,'T1-prep5 丧尸调试建造点就位');
ok(t1i.ml===8,'T1i2 ★丧尸调试观战全菜单=8 (含 tower/ammoc 商店铺; N5 对认: 掉回收窄=3)');
ok(t1i.pend&&t1i.cost===0&&t1i.zp===0,'T1i ★丧尸调试免费账: pendingBuild {cost:0, zp:0} (N3/N6 对认)');
ok(t1i.dB===1&&t1i.dP===0&&t1i.dS===0&&t1i.dBk===0,'T1i3 ★丧尸落成全零账: BUILDS+1 且 pz/分/建造点全不动 (N3 对认: 掉回 ZP 优先则 pz-2)');
const t1j=GZ(`(function(){
var out={};
player.spectator=false; player.cls=0;
__resetInput();
out.prep=__zSpot(7);
if(!out.prep) return out;
player.pz=200; player.buildCount=8;
dispatchEvent(new KeyboardEvent('keydown',{code:'KeyB'}));
dispatchEvent(new KeyboardEvent('keydown',{code:'KeyB'}));
out.pend=!!player.pendingBuild;
if(player.pendingBuild){ out.zp=player.pendingBuild.zp; out.cost=player.pendingBuild.cost; }
var p0=player.pz|0;
if(player.pendingBuild){ VM.stateT=VM.stateDur; __step(2); }
out.p1=player.pz|0;
return out;
})()`);
ok(t1j.prep&&t1j.pend&&t1j.zp===2&&t1j.cost===1&&t1j.p1===198,'T1j ★非观战计费回归钉: solo 普通身份建基础件 pz 200→198 (ZP 优先原账; N3/N6 下仍绿=非观战链零变化)');

// ═════ 丧尸 teams boot ═════
console.log('T1 丧尸 teams: 分池双显');
const tctx=boot(PGIDX,{sf_zsub:'teams'});
const GT=s=>vm.runInContext(s,tctx);
let terr=null;
try{ GT('beginFreshMatch();'); }catch(e){ terr='start: '+String(e&&e.stack||e); }
if(!terr){ try{ GT('if(!player.alive||!player.deployed) deployPlayer();'); }catch(e){ terr='deploy: '+String(e&&e.stack||e); } }
if(terr||!GT('player.alive')){ console.log('  ✘ teams 开局/部署失败 '+(terr||'player.alive=false')); process.exit(1); }
GT('for(const s of soldiers) s.protUntil=0; player.protUntil=1e9;');
GT('for(const s of soldiers){ if(!s.isPlayer&&!s.zombie){ s.pos.x+=800; s.pos.z+=800; s.pos.y=heightAt(s.pos.x,s.pos.z); if(s.path) s.path.length=0; } }');
GT('pointerLocked=true; __step(3);');
GT(RESET_SRC); GT('__resetInput();'); GT('if(typeof SpecLayer!=="undefined") SpecLayer.on=false;');
ok(GT('ZOMBIE_MODE')==='teams','前置: ZOMBIE_MODE=teams');
ok(GT('player.team')===0||GT('player.team')===1,'前置: 玩家在人类队 (0/1)');
const t1k=GT(`(function(){
var out={team:player.team};
out.p0=player.pz|0; out.f0=zFoeZP|0;
zTeamZPGain(1-player.team,15);
out.f1=zFoeZP|0;
zTeamZPGain(player.team,40);
out.p1=player.pz|0;
return out;
})()`);
ok(t1k.f0===200&&t1k.p0===200,'T1k0 ★teams 双池开局各 200 (zombieMatchStart 双置)');
ok(t1k.f1===t1k.f0+15,'T1k ★对方队入账: zTeamZPGain(foe,15) → zFoeZP +15 (N7 对认)');
ok(t1k.p1===t1k.p0+40,'T1k2 ★玩家队路由: zTeamZPGain(own,40) → pzGain 同账 +40 (N7 下仍绿: 走 if 支)');
const t1l=GT(`(function(){
var out={};
var sol=null;
for(const s of soldiers){ if(s.alive&&s.team!==player.team&&!s.zombie&&!s.isPlayer&&!s.onVehicle&&!s.onNaval){ sol=s; break; } }
out.sol=!!sol;
var f0=zFoeZP|0;
var zw=spawnZombie(60,60,'walker');
out.zw=!!zw;
if(zw){ zw.pos.set(60,heightAt(60,60),60); zw.die(sol); }
out.f1=zFoeZP|0; out.dF=out.f1-f0;
var p0=player.pz|0;
var zw2=spawnZombie(70,70,'walker');
if(zw2){ zw2.pos.set(70,heightAt(70,70),70); zw2.die(player); }
out.p1=player.pz|0; out.dP=out.p1-p0;
return out;
})()`);
ok(t1l.sol&&t1l.zw&&t1l.dF===15,'T1l ★集成: 对方队 Bot 杀丧尸 → zFoeZP +15 (Zombie.die→zTeamZPGain→else 支; N7 对认)');
ok(t1l.dP===15,'T1l2 ★集成: 玩家杀丧尸 → player.pz +15 (onPlayerKill→pzGain 原账; N7 下仍绿)');
ok(GT('zKillZPOf("brute")')===40&&GT('zKillZPOf("boomer")')===25&&GT('zKillZPOf("walker")')===15,'T1m3 ★zKillZPOf 价单源 (brute 40/boomer 25/其余 15)');
const t1m=GT(`(function(){
updateZpHud();
var el=document.getElementById('zHudEl');
var s=el?el.textContent:'';
return {s:s, dual:s.indexOf('我方')>=0&&s.indexOf('敌方')>=0, hasPz:s.indexOf(String(player.pz|0))>=0, hasFoe:s.indexOf(String(zFoeZP|0))>=0};
})()`);
ok(t1m.dual&&t1m.hasPz&&t1m.hasFoe,'T1m ★teams 双显: 药丸同时含 我方/敌方 与两队池值 (N8 对认)');
ok(GZ('(function(){ updateZpHud(); return (typeof zHudEl!=="undefined"&&zHudEl)?zHudEl.textContent:""; })()').indexOf('敌方')<0,'T1m2 solo 药丸无双显 (词典键只在 teams 分支; 单池串逐位不变) [txt='+GZ('(function(){ updateZpHud(); return (typeof zHudEl!=="undefined"&&zHudEl)?zHudEl.textContent:""; })()')+']');

// ══ 收官 ══
console.log('');
console.log(NEG?'── NEG 阴性对照判定 ──':'── 正向判定 ──');
console.log('通过 '+PASS.length+' / 红 '+FAILN+' 条'+(NEG?' (红名: '+REDS.join(',')+')':''));
if(NEG){
const EXPECT=['T0b','T0c','T0c2','T0d','T0e','T0f','T0g','T0i2','T0j','T0k','T1a','T1b','T1c','T1d','T1e','T1e3','T1g2','T1i','T1i2','T1i3','T1k','T1l','T1m'];
const miss=EXPECT.filter(x=>!REDS.includes(x)), extra=REDS.filter(x=>!EXPECT.includes(x));
console.log('期望红名 '+EXPECT.length+' 项: 漏红 '+(miss.length?miss.join(','):'无')+' · 多红 '+(extra.length?extra.join(','):'无'));
console.log('映射: N1→T0b/T1a/T1b · N2→T0c/T1c · N3→T0e/T1e/T1e3/T1i/T1i3/T1g2 · N4→T0d/T1g2 · N5→T0f/T1i2 · N6→T0g/T1e/T1i · N7→T0i2/T1k/T1l · N8→T0j/T1m · N9→T0k · N10→T0c2/T1d');
process.exit(miss.length===0&&extra.length===0?0:1);
}
process.exit(FAILN===0?0:1);
