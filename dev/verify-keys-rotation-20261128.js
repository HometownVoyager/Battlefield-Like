// ─────────────────────────────────────────────
// dev/verify-keys-rotation-20261128.js —— 2026-11-28 键位轮换批 (戳 20261128d):
//   用户令: 投掷/近战/选号键组 3→4→5→N 循环一圈 —— 3=军刀(原N) / 4=AT雷(原3) / 5=烟雾+反坦克兵
//   火箭筒切换(原4, 整块搬) / N=工程兵选工事型号(原5); **6 (燃烧弹/迫击炮) 与 G (普通手雷) 不动**。
//   改动面 (全库盘点): ①19-input 四块 e.code 轮换 + 块内 barStealArmed 键标识跟走 + keyup 持掷松手
//   列表 (Digit3,D4,D6)→(D4,D5,D6) ②19b-gamepad RS=近战→Digit3 / 十字左=(工程?KeyN:Digit5) /
//   十字右 AT=Digit4 ③24-main 触屏 tBuild5→KeyN / tMelee→Digit3 / tSmoke→Digit5 / tATN→Digit4
//   ④文案跟走: 22-hud 弹药栏 [3]/[4]→[4]/[5] · 23-deploy 兵种卡+工程提示 · 20-player 工程HUD提示 ·
//   00b-i18n 词典键值同步 · index.html 两套游戏说明键位表 · 06-engineering 注释。
//   合成入口纪律: 手柄 padKd / 触屏 kd 都派发 KeyboardEvent 走同一条 keydown 处理器 —— 改派=改派发码,
//   消费端零分叉; keyup 侧 Digit3 (军刀) 不在松手列表 ⇒ 触屏 tMelee ku('Digit3') 无副作用。
// 用法: node dev/verify-keys-rotation-20261128.js [--neg]
// 判据:
//   T0 源码锚 (五文件全量+旧布局绝迹负向) + T1 行为断言 (真开局沙箱, 真键派发)。
//   --neg (七补丁, 红名↔补丁): N1 军刀还原 KeyN→T0a/T1a / N2 AT还原 Digit3→T0b/T1b(+T1c 前置链) /
//      N3 烟雾还原 Digit4→T0c/T1d(+T1e 前置链) / N4 选号还原 Digit5→T0d/T1g / N5 keyup 列表还原→
//      T0e/T1j / N6 手柄三处还原→T0f / N7 触屏四处还原→T0g。
//   沙箱要点承 verify-throwq-deathfall-seatfire-20261122 (真键派发) 与 verify-ffkill-firelight-specesc
//   -20261128 (boot 骨架): pointerLocked 直置 (战斗键总门 !alive||!pointerLocked, :208)。
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
Box:class{},Sphere:class{},Material:class{},ContactMaterial:class{},NaiveBroadphase:class{},
PointToPointConstraint:class{constructor(a,pa,b,pb){this.bodyA=a;this.pivotA=pa;this.bodyB=b;this.pivotB=pb;}},
};})();

const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const FILES=[...html.matchAll(/src="(js\/[^"?]+)/g)].map(m=>m[1]);
console.log('载入清单: 解析 index.html 得 '+FILES.length+' 个脚本');

// ── NEG 阴性对照: 七补丁 (正常跑不启用) ──
const NEG=process.argv.includes('--neg');
const SRC={},PATCH_MAP={};
const NEG_PATCHES=[
// N1 军刀键还原 (19-input): Digit3 军刀块 → 挂回 KeyN ⇒ T0a 红 (锚绝迹) + T1a 红 (按3不切刀)
['js/19-input.js',"if(e.code==='Digit3'){","if(e.code==='KeyN'){"],
// N2 AT键还原 (19-input): Digit4 AT块 → 挂回 Digit3 ⇒ T0b 红 + T1b 红 (按4不举AT; T1c 松手前置链同红)
['js/19-input.js',"if(e.code==='Digit4'){","if(e.code==='Digit3'){"],
// N3 烟雾键还原 (19-input): Digit5 烟雾块 → 挂回 Digit4 ⇒ T0c 红 + T1d 红 (按5不举烟; T1e 前置链同红)
['js/19-input.js',"if(e.code==='Digit5'){","if(e.code==='Digit4'){"],
// N4 选号键还原 (19-input): KeyN 选号门 → 挂回 Digit5 ⇒ T0d 红 + T1g 红 (按N不换号)
['js/19-input.js',"if(e.code==='KeyN'&&(player.cls===4||ZOMBIE_MODE)){","if(e.code==='Digit5'&&(player.cls===4||ZOMBIE_MODE)){"],
// N5 keyup 持掷松手列表还原 (19-input): (D4,D5,D6)→(D3,D4,D6) ⇒ T0e 红 + T1j 红 (军刀键松手误出手雷)
['js/19-input.js',"if((e.code==='Digit4'||e.code==='Digit5'||e.code==='Digit6')&&player.nadeHeld){","if((e.code==='Digit3'||e.code==='Digit4'||e.code==='Digit6')&&player.nadeHeld){"],
// N6 手柄还原 (19b-gamepad): RS=KeyN / 十字左=(工程?Digit5:Digit4) / 十字右=Digit3 ⇒ T0f 红
['js/19b-gamepad.js',"{b:11,dn:()=>padKd('Digit3'),up:()=>padKu('Digit3')}","{b:11,dn:()=>padKd('KeyN'),up:()=>padKu('KeyN')}"],
['js/19b-gamepad.js',"{b:14,dn:()=>padKd(player.cls===4?'KeyN':'Digit5'), up:()=>{padKu('KeyN'); padKu('Digit5');}}","{b:14,dn:()=>padKd(player.cls===4?'Digit5':'Digit4'), up:()=>{padKu('Digit4'); padKu('Digit5');}}"],
['js/19b-gamepad.js',"{b:15,dn:()=>padKd('Digit4'),up:()=>padKu('Digit4')}","{b:15,dn:()=>padKd('Digit3'),up:()=>padKu('Digit3')}"],
// N7 触屏还原 (24-main): tBuild5/tMelee/tSmoke/tATN 四处派发码还原 ⇒ T0g 红
['js/24-main.js',"bindBtn('tBuild5',()=>kd('KeyN'),()=>ku('KeyN'));","bindBtn('tBuild5',()=>kd('Digit5'),()=>ku('Digit5'));"],
['js/24-main.js',"bindBtn('tMelee',()=>kd('Digit3'),()=>ku('Digit3'));","bindBtn('tMelee',()=>kd('KeyN'),()=>ku('KeyN'));"],
['js/24-main.js',"bindBtn('tSmoke',()=>kd('Digit5'),()=>ku('Digit5'));","bindBtn('tSmoke',()=>kd('Digit4'),()=>ku('Digit4'));"],
['js/24-main.js',"bindBtn('tATN',()=>kd('Digit4'),()=>ku('Digit4'));","bindBtn('tATN',()=>kd('Digit3'),()=>ku('Digit3'));"],
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
const listeners={};
const addL=(t,f)=>{ (listeners[t]=listeners[t]||[]).push(f); };
ctx.addEventListener=addL;
ctx.document=Object.assign({},stub.document,{addEventListener:addL,removeEventListener(){}});
ctx.window=Object.assign({},stub.window,{addEventListener:addL,removeEventListener(){}});
ctx.dispatchEvent=ev=>{ if(!ev.preventDefault) ev.preventDefault=()=>{}; if(!ev.stopPropagation) ev.stopPropagation=()=>{}; for(const f of (listeners[ev.type]||[]).slice()) f(ev); return true; };
ctx.KeyboardEvent=class{ constructor(t,o){ o=o||{}; this.type=t; this.code=o.code; this.repeat=!!o.repeat; } };
ctx.MouseEvent=class{ constructor(t,o){ o=o||{}; this.type=t; this.button=o.button; } };
ctx.CANNON=CANNON;
ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
ctx.__T=1000;
ctx.performance={now:()=>ctx.__T};
for(const f of FILES) vm.runInContext(srcOf(f),ctx,{filename:f});
vm.runInContext('var __step=(n)=>{ for(let i=0;i<n;i++){ __T+=16.7; loop(); } };',ctx);
return ctx;
}
const PASS=[];let FAILN=0;const REDS=[];
function ok(cond,label){
const id=(label.match(/^(T[01][a-z]\d?)\b/)||[])[1]||null;   // 断言 id 取自标签首词 (T0a/T1b/…; 前置行无 id)
if(cond){ PASS.push(id||label); console.log('  ✔ '+label); }
else { FAILN++; if(id) REDS.push(id); console.log((NEG?'  ● [期望红] ':'  ✘ ')+label); }
}
let IDXS=1; { const c0=boot(0); IDXS=vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="stalingrad")',c0); }
const ctx=boot(IDXS);
const G=s=>vm.runInContext(s,ctx);
const KD=c=>G(`dispatchEvent(new KeyboardEvent('keydown',{code:'${c}'}));`);
const KU=c=>G(`dispatchEvent(new KeyboardEvent('keyup',{code:'${c}'}));`);
let err0=null;
try{ G("document.getElementById('startBtn').onclick();"); }catch(e){ err0=String(e&&e.stack||e); }
if(!err0){ try{ G('if(!player.alive||!player.deployed) deployPlayer();'); }catch(e){ err0='deployPlayer: '+String(e&&e.stack||e); } }
if(err0||!G('player.alive')){ console.log('  ✘ 开局/部署失败 '+(err0||'player.alive=false')); process.exit(1); }
G('pointerLocked=true;');   // 19-input 战斗键总门 (!alive||!pointerLocked, :208) — 沙箱无 pointerlockchange, 直置 (throwq 批同款)
G('__step(3);');            // 等 VM 回 idle (部署装备链跑完)
ok(html.includes("__sfStyleVer='20261128d'"),'前置: 版本戳 20261128d 在位 (index.html 内联)');

// ══ T0 源码锚 ══
console.log('T0 源码锚');
const s19=srcOf('js/19-input.js'),s19b=srcOf('js/19b-gamepad.js'),s24=srcOf('js/24-main.js'),
s22=srcOf('js/22-hud.js'),s23=srcOf('js/23-deploy.js'),s20p=srcOf('js/20-player.js'),
s00b=srcOf('js/00b-i18n.js'),s06=srcOf('js/06-engineering.js');
// ① 军刀 = Digit3 (原 KeyN)
{ const i3=s19.indexOf("if(e.code==='Digit3'){"), iSW=s19.indexOf('switchSlot(player.curSlot===2?(player._lastGunSlot||0):2,true);');
ok(i3>=0&&iSW>i3&&s19.slice(i3,i3+60).includes('近战重做批'),'T0a ★军刀块挂 Digit3 (switchSlot 军刀行在块内, KeyN 旧位绝迹)');
ok(!/if\(e\.code==='KeyN'\)\{\s*\/\/ ★2026-11-20 近战重做批/.test(s19),'T0a2 旧 KeyN 军刀块绝迹 (负向)');
}
// ② AT雷 = Digit4 (原 Digit3)
{ const i4=s19.indexOf("if(e.code==='Digit4'){"), iAT=s19.indexOf('player.nadeFuse=99; player.nadeIsAT=true;');
ok(i4>=0&&iAT>i4&&s19.slice(i4,i4+140).includes('举 AT 中再按 4'),'T0b ★AT雷块挂 Digit4 (nadeFuse=99 哨兵在块内)');
ok(!s19.includes("barStealArmed('Digit3')"),'T0b2 旧 AT 键标识 barStealArmed(\'Digit3\') 绝迹 (负向)');
}
// ③ 烟雾 = Digit5 (原 Digit4; cls3 火箭筒分支随块整搬)
{ const i5=s19.indexOf("if(e.code==='Digit5'){"), iSM=s19.indexOf('NADE_COOK_FUSE.smoke'), iRK=s19.indexOf("switchSlot(player.slots.findIndex(s=>s&&s.def.rocket),true)");
ok(i5>=0&&iSM>i5&&s19.slice(i5,i5+40).includes('观战不切火箭筒'),'T0c ★烟雾块挂 Digit5 (NADE_COOK_FUSE.smoke 在块内)');
ok(i5>=0&&iRK>i5&&iRK<s19.indexOf("if(e.code==='Digit6')"),'T0c2 ★反坦克兵 cls3 火箭筒切换分支随块搬入 Digit5 (原 4 键整块语义)');
}
// ④ 工程选号 = KeyN (原 Digit5)
ok(s19.includes("if(e.code==='KeyN'&&(player.cls===4||ZOMBIE_MODE)){")&&s19.includes('const _ml=engMenuList(player);')&&s19.includes('player.buildSel=((player.buildSel||0)+1)%_ml.length;'),'T0d ★工程选号块挂 KeyN (cls4||ZOMBIE 门原样; ★20261128d 循环走 engMenuList 单源=丧尸非工程兵只基础三件)');
ok(!s19.includes('%BUILD_MENU.length'),'T0d3 旧全量菜单循环 %BUILD_MENU.length 绝迹 (负向; 菜单收窄走 engMenuList)');
ok(!s19.includes("if(e.code==='Digit5'&&(player.cls===4||ZOMBIE_MODE))"),'T0d2 旧 Digit5 选号门绝迹 (负向)');
// ⑤ keyup 持掷松手列表 (D3,D4,D6)→(D4,D5,D6)
ok(s19.includes("if((e.code==='Digit4'||e.code==='Digit5'||e.code==='Digit6')&&player.nadeHeld){"),'T0e ★keyup 持掷松手列表改 D4/D5/D6 (4=AT 5=烟雾 6=燃烧)');
ok(!s19.includes("if((e.code==='Digit3'||e.code==='Digit4'||e.code==='Digit6')&&player.nadeHeld)"),'T0e2 旧松手列表 (D3,D4,D6) 绝迹 (负向)');
// ⑥ 手柄 (19b)
ok(s19b.includes("{b:11,dn:()=>padKd('Digit3'),up:()=>padKu('Digit3')}")&&s19b.includes("padKd(player.cls===4?'KeyN':'Digit5')")&&s19b.includes("{b:15,dn:()=>padKd('Digit4'),up:()=>padKu('Digit4')}"),'T0f ★手柄三处改派: RS近战=Digit3 / 十字左=(工程?KeyN:烟雾Digit5) / 十字右AT=Digit4');
// ⑦ 触屏 (24-main)
ok(s24.includes("bindBtn('tBuild5',()=>kd('KeyN'),()=>ku('KeyN'))")&&s24.includes("bindBtn('tMelee',()=>kd('Digit3'),()=>ku('Digit3'))")&&s24.includes("bindBtn('tSmoke',()=>kd('Digit5'),()=>ku('Digit5'))")&&s24.includes("bindBtn('tATN',()=>kd('Digit4'),()=>ku('Digit4'))"),'T0g ★触屏四处改派: tBuild5=KeyN / tMelee=Digit3 / tSmoke=Digit5 / tATN=Digit4');
// ⑧ 弹药栏与兵种卡文案
ok(s22.includes("t2('AT雷[4] ×{0}'")&&s22.includes("t2('烟雾[5] ×{0}'")&&!s22.includes('AT雷[3] ×{0}')&&!s22.includes('烟雾[4] ×{0}'),'T0h ★22-hud 弹药栏键号 [3]/[4]→[4]/[5] (旧号绝迹)');
ok(s23.includes("t('AT雷[4]×{0}'")&&s23.includes("t('烟雾弹[5]×{0}'")&&s23.includes('工程兵 · 按 N 选工事'),'T0i ★23-deploy 兵种卡四弹种键号+工程部署提示 (按 N 选工事)');
ok(s20p.includes("t2('<b>N</b> 工事: {0}")&&!s20p.includes('<b>5</b> 工事'),'T0j ★20-player 工程 HUD 常驻提示 5→N (旧锚绝迹)');
// ⑨ 词典键值同步 (key 即中文原文, 词典与调用点必须同步改 —— 只改一侧=英文回退穿帮)
ok(s00b.includes("'AT雷[4]×{0}'")&&s00b.includes("'烟雾弹[5]×{0}'")&&s00b.includes("'AT雷[4] ×{0}'")&&s00b.includes("'烟雾[5] ×{0}'")&&!s00b.includes("'AT雷[3]×{0}'")&&!s00b.includes("'烟雾弹[4]×{0}'"),'T0k ★i18n 弹种键号词条四处同步 (旧键绝迹)');
ok(s00b.includes("'<b>N</b> 工事: {0} ({1})")&&s00b.includes("'G / 4 / 5 / 6'")&&s00b.includes("'烟雾(5) / 工程兵选工事(N)'")&&s00b.includes("'AT雷(4)'")&&s00b.includes("'近战(军刀)'"),'T0k2 ★i18n 工程提示/键位帽/十字键说明/近战帽词条同步 (★20261128d 价格位双价串改键: ({1}点)→({1}), 词典随调用点同步)');
// ⑩ index.html 两套说明面板 + 06 注释
ok(html.includes('<span class="hkKey" data-i18n>3</span><span class="hkDesc" data-i18n-html>近战(军刀)')&&html.includes('<span class="hkKey" data-i18n>4</span><span class="hkDesc" data-i18n-html>反坦克雷')&&html.includes('<span class="hkKey" data-i18n>5</span><span class="hkDesc" data-i18n-html>烟雾弹')&&html.includes('<span class="hkKey" data-i18n>N</span><span class="hkDesc" data-i18n-html>切换工事'),'T0l ★index.html 说明面板键帽轮换 (近战3/AT4/烟雾5/工事N)');
ok(html.includes('G / 4 / 5 / 6')&&html.includes('<b>4</b> AT雷 · <b>5</b> 烟雾弹')&&html.includes('烟雾(5) / 工程兵选工事(N)')&&html.includes('按<b>N</b>选到后'),'T0l2 ★index.html 调试模式四弹种/手柄十字键/医疗箱说明同步');
ok(s06.includes('★2026-11-28 键位轮换后=KeyN'),'T0m 06-engineering 选号注释跟走 ( Digit5→KeyN)');

// ══ T1 行为断言 (真开局沙箱, 真键派发) ══
console.log('T1 行为断言 (真键派发)');
// T1a 军刀 = Digit3 二态 (切第3槽军刀 / 再按切回枪槽)
// ★沙箱坑 (throwq 批同款): 部署装备链 VM 'draw' 在无 rAF 沙箱里不推进 —— 各测试前直接置 idle。
G('__resetInput=()=>{ player.nadeHeld=false; player.nadeIsAT=false; player.nadeIsSmoke=false; player.nadeIsIncin=false; VM.state="idle"; VM.stateT=0; VM.stateDur=0; vmSndFlags={}; };');
{ const hasSabre=G('!!(player.slots[2]&&player.slots[2].def&&player.slots[2].def.melee)');
  G('__resetInput(); __step(1);');   // VM 'draw' 在沙箱不推进, 每次按键前置 idle (= 等抽枪动画播完)
  const s0=G('player.curSlot');
  KD('Digit3'); const s1=G('player.curSlot');
  G('__resetInput();');              // vmEquip 后 VM 回 'draw', 再置 idle
  KD('Digit3'); const s2=G('player.curSlot');
  ok(hasSabre&&s0===0&&s1===2&&s2===0,'T1a ★按3=切军刀槽(slot2)/再按切回枪槽 (hasSabre='+hasSabre+' '+s0+'→'+s1+'→'+s2+')');
}
// T1b/T1c AT雷 = Digit4 举雷/松手出手
G('player.atNades=2; __resetInput(); __step(1);');
{ KD('Digit4');
  const r=G('({h:player.nadeHeld,at:player.nadeIsAT,vm:VM.state})');
  KU('Digit4');
  const r2=G('({h:player.nadeHeld,dur:VM.stateDur})');
  ok(r.h===true&&r.at===true&&r.vm==='nade','T1b ★按4=举AT雷 (nadeHeld+nadeIsAT+VM nade)');
  ok(r2.h===false&&r2.dur===0.55,'T1c ★松4=出手弧起步 (nadeHeld清+stateDur 0.55) — N2/N5 期望红');
  G('__resetInput();');
}
// T1d/T1e 烟雾 = Digit5 (普通兵种)
G('player.smokeCount=2; __resetInput(); __step(1);');
{ KD('Digit5');
  const r=G('({h:player.nadeHeld,sm:player.nadeIsSmoke})');
  KU('Digit5');
  const r2=G('player.nadeHeld');
  ok(r.h===true&&r.sm===true,'T1d ★按5=举烟雾弹 (原4键语义整块迁入)');
  ok(r2===false,'T1e ★松5=出手 (keyup 列表含 Digit5) — N3/N5 期望红');
  G('__resetInput();');
}
// T1f 反坦克兵(cls3) 按5=火箭筒分支: 无火箭筒槽 ⇒ 不举烟 (旧4键分支语义随块搬入)
{ const cls0=G('player.cls');
  G('player.cls=3; player.smokeCount=2; __resetInput(); __step(1);');
  KD('Digit5');
  const h=G('player.nadeHeld');
  G('player.cls='+cls0+'; __resetInput();');
  ok(h===false,'T1f ★反坦克兵按5走火箭筒分支 (无槽 no-op, 不误举烟雾)');
}
// T1g 工程选号 = KeyN (cls4): 换号且 Digit5 不再换号
{ const cls0=G('player.cls');
  G('player.cls=4; player.buildSel=0; __resetInput(); __step(1);');
  KD('KeyN'); const b1=G('player.buildSel');
  KD('KeyN'); const b2=G('player.buildSel');
  KD('Digit5'); const b3=G('player.buildSel');
  G('player.cls='+cls0+';');
  ok(b1===1&&b2===2&&b3===2,'T1g ★工程兵按N循环选工事 (0→1→2), 按5不再换号 ('+b1+'/'+b2+'/'+b3+')');
}
// T1h 燃烧 = Digit6 不动 + 松手照旧
G('player.incinCount=1; __resetInput(); __step(1);');
{ KD('Digit6');
  const r=G('({h:player.nadeHeld,ic:player.nadeIsIncin})');
  KU('Digit6');
  const r2=G('player.nadeHeld');
  ok(r.h===true&&r.ic===true&&r2===false,'T1h ★6键不动: 举燃烧/松手出手照旧 (回归钉)');
  G('__resetInput();');
}
// T1i 普通手雷 = G 不动
G('player.nadeCount=2; __resetInput(); __step(1);');
{ KD('KeyG');
  const r=G('({h:player.nadeHeld,at:player.nadeIsAT,sm:player.nadeIsSmoke,ic:player.nadeIsIncin})');
  ok(r.h===true&&!r.at&&!r.sm&&!r.ic,'T1i ★G键不动: 举普通雷 (回归钉)');
  KU('KeyG'); G('__resetInput();');
}
// T1j 军刀键 (Digit3) 松手不吃雷账: 举普通雷中按3 (持掷中切刀被读条门挡, 无妨) 再松开 ⇒ nadeHeld 保持
// (新松手列表无 Digit3; 旧列表 D3,D4,D6 会误出手=N5)
G('__resetInput(); __step(1);');
{ KD('KeyG'); const h0=G('player.nadeHeld');
  KD('Digit3');
  KU('Digit3'); const h1=G('player.nadeHeld');
  KU('KeyG');
  G('__resetInput();');
  ok(h0===true&&h1===true,'T1j ★举雷中按3再松3不误出手 (nadeHeld 保持 '+h0+'→'+h1+') — N5 期望红');
}
// T1k Digit1/Digit2 切枪不动 (回归钉)
G('__resetInput(); __step(1);');
{ KD('Digit2'); const s1=G('player.curSlot');
  G('__resetInput();');   // 第一次切枪 vmEquip 进 'draw', 置 idle 再切回
  KD('Digit1'); const s0=G('player.curSlot');
  ok(s1===1&&s0===0,'T1k ★1/2 切枪不动 (回归钉 '+s0+'↔'+s1+')');
}

// ══ 收官 ══
console.log('');
console.log(NEG?'── NEG 阴性对照判定 ──':'── 正向判定 ──');
console.log('通过 '+PASS.length+' / 红 '+FAILN+' 条'+(NEG?' (红名: '+REDS.join(',')+')':''));
if(NEG){
// 精确红名集合: 七补丁并施下应恰好翻红的断言 (补丁→断言映射见文件头; T1c/T1e 为前置链正判据,
//   并施时被 N2/N3 的改道接力绕开, 属正向专判 —— 见映射注)
const EXPECT=['T0a','T0a2','T0b','T0c','T0c2','T0d','T0d2','T0e','T0e2','T0f','T0g','T1a','T1b','T1d','T1g','T1j'];
const miss=EXPECT.filter(x=>!REDS.includes(x)), extra=REDS.filter(x=>!EXPECT.includes(x));
console.log('期望红名 '+EXPECT.length+' 项: 漏红 '+(miss.length?miss.join(','):'无')+' · 多红 '+(extra.length?extra.join(','):'无'));
console.log('映射: N1→T0a/T0a2/T1a · N2→T0b/T1b · N3→T0c/T0c2/T1d · N4→T0d/T0d2/T1g · N5→T0e/T0e2/T1j · N6→T0f · N7→T0g');
process.exit(miss.length===0&&extra.length===0?0:1);
}
process.exit(FAILN===0?0:1);
