// ─────────────────────────────────────────────
// dev/verify-throwq-deathfall-seatfire-20261122.js —— 2026-11-22 实机三症状批:
//   ① 投掷键连点卡手 (G/3/4/6 出手弧接续) ② 就地倒下死亡模型不可见 ③ 上载具不清着火
// 用法: node dev/verify-throwq-deathfall-seatfire-20261122.js [--neg]
// 判据:
//   T0 源码锚: nadeArcTakeover 单源函数+flush 行+四键接线 (19-input) / 死亡环绕喂帧行+航拍喂帧行
//      (20-player) / updateCreaturesBurning 座位灭火门 (04b-fire) —— 全 verbatim。
//   T1 出手弧接续 (真键派发, seatbar 同款): 举雷→松手进弧 (0.55s) → 弧中按 G 不再吃键:
//      已出手段 (k>0.5) 直接重举 (不双掷); 未出手段 (k<0.5) 先 flush 立即出手再重举 (一次点击一颗);
//      异键弧中接续 (G弧中按3=frag 立即出手+换举 AT); 最后一颗 flush 后空手不自举 (nadeHeld 保持 false,
//      哨兵自愈契约); idle 起步/同键重按不重置引信/持雷异键双击确认三条旧契约回归不变。
//   T2 就地倒下死亡镜头 (sf_deathfx=1): player.die → deathCamT=0.8 + deathRag=null ⇒ updateCamera 死亡
//      环绕 10 帧内 avatar visible=true + 骨盆下坠 (改前恒隐=模型直接消失); deathCamT 归零后航拍段
//      avatar 仍 visible (尸体留到部署页); playerAvatarDeath 的 deathRag 分支 (布娃娃档自隐) 源码锚不动。
//   T3 上车灭火: igniteCreature 着火 → 无座位继续烧 (40 帧掉血) → onVehicle 一帧灭火清账 (burnTimer/
//      burnTickT/burnAttacker 全清, 掉血停止); 座位上拒新点火 (igniteCreature seatShielded 既有门回归);
//      Bot 同规 (入座灭火/无座位照烧)。
//   --neg (五补丁, 红名↔补丁): N1 flush 行拆→T0b+T1c/T1d/T1e/T1f / N2 G接线拆→T0c+T1b /
//      N3 死亡环绕喂帧拆→T0g+T2a/T2b / N4 座位灭火门拆→T0i+T3b+T3e (T3c 级联红: T3b 失败后身上余烧, 点火门放行前 burnTimer 已 >0) / N5 航拍喂帧拆→T0h+T2c。
//      N1/N2 同文件 19-input 链式补丁, N3/N5 同文件 20-player 链式补丁 (均不同行互不遮蔽)。
// 沙箱要点承 verify-tiltfall-20261121 (boot/CANNON 桩/真开局+deployPlayer) 与
// verify-seatbar-20261120 (listeners 捕获+真键派发)。
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
console.log('载入清单: 解析 index.html 得 '+FILES.length+' 个脚本');

// ── NEG 阴性对照: 五补丁 (正常跑不启用) ──
const NEG=process.argv.includes('--neg');
const SRC={},PATCH_MAP={};
const NEG_PATCHES=[
// N1 flush 行拆: 弧中未出手段不再立即出手 ⇒ T1 flush 断言全红 (rnN 不再 +1 / 计数不再即扣)
['js/19-input.js','if(VM.stateDur>0&&VM.stateDur<=10&&(VM.stateT/VM.stateDur)<0.5) player.releaseNade();   // 未出手段: 立即出手 (零吞键)',';'],
// N2 G 键接线拆: 出手弧中按 G 落回双击确认网 (第一按被吃) ⇒ T1b 红
['js/19-input.js','if(ok&&nadeArcTakeover()&&player.nadeCount>0){','if(false&&nadeArcTakeover()&&player.nadeCount>0){'],
// N3 死亡环绕喂帧拆: 就地倒下档死亡环绕期 avatar 恒隐 ⇒ T2a/T2b 红
['js/20-player.js','updatePlayerAvatar(dt);   // ★2026-11-22 环绕喂帧 (就地倒下档看本体倒地; 布娃娃档 deathRag 分支自隐零变化)',';'],
// N4 座位灭火门拆: 上车后照烧 ⇒ T3b/T3d 红
['js/04b-fire.js',"if(s&&s.burnTimer&&typeof seatShielded==='function'&&seatShielded(s)){ s.burnTimer=0; s.burnTickT=0; s.burnAttacker=null; s._burnAcc=0; continue; }",';'],
// N5 航拍喂帧拆: 环绕结束进航拍 avatar 又隐 ⇒ T2c 红
['js/20-player.js','if(!p.spectator) updatePlayerAvatar(dt);',';'],
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
// listeners 捕获 (seatbar 同款): keydown/keyup 真派发用; document/window 各给本 boot 私有副本
const listeners={};
const addL=(t,f)=>{ (listeners[t]=listeners[t]||[]).push(f); };
ctx.addEventListener=addL;
ctx.document=Object.assign({},stub.document,{addEventListener:addL,removeEventListener(){}});
ctx.window=Object.assign({},stub.window,{addEventListener:addL,removeEventListener(){}});
ctx.dispatchEvent=ev=>{ if(!ev.preventDefault) ev.preventDefault=()=>{}; if(!ev.stopPropagation) ev.stopPropagation=()=>{}; for(const f of (listeners[ev.type]||[]).slice()) f(ev); return true; };
ctx.KeyboardEvent=class{ constructor(t,o){ o=o||{}; this.type=t; this.code=o.code; this.repeat=!!o.repeat; } };
ctx.MouseEvent=class{ constructor(t,o){ o=o||{}; this.type=t; this.button=o.button; } };
ctx.CANNON=CANNON;
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
ok(html.includes("__sfStyleVer='20261122b'"),'前置: 版本戳 20261122b 在位 (index.html 内联)');

// ══ T0 源码锚 ══
console.log('T0 源码锚');
const src19=srcOf('js/19-input.js'),src20=srcOf('js/20-player.js'),src04b=srcOf('js/04b-fire.js');
ok(src19.includes('function nadeArcTakeover(){')===true,'T0a ★nadeArcTakeover 出手弧接续单源函数在位 (19-input)');
ok(src19.includes('if(VM.stateDur>0&&VM.stateDur<=10&&(VM.stateT/VM.stateDur)<0.5) player.releaseNade();')===true,'T0b ★未出手段 flush 行 verbatim (19-input)');
ok(src19.includes('if(ok&&nadeArcTakeover()&&player.nadeCount>0){')===true,'T0c ★KeyG 弧中接线 verbatim');
ok(src19.includes('if(ok&&nadeArcTakeover()&&player.atNades>0){')===true,'T0d ★Digit3 弧中接线 verbatim');
ok(src19.includes('if(ok&&nadeArcTakeover()&&player.smokeCount>0){')===true,'T0e ★Digit4(烟雾) 弧中接线 verbatim');
ok(src19.includes('if(ok&&nadeArcTakeover()&&player.incinCount>0){')===true,'T0f ★Digit6(燃烧) 弧中接线 verbatim');
ok(src20.includes('updatePlayerAvatar(dt);   // ★2026-11-22 环绕喂帧 (就地倒下档看本体倒地; 布娃娃档 deathRag 分支自隐零变化)')===true,'T0g ★死亡环绕喂帧行 verbatim (20-player)');
ok(src20.includes('if(!p.spectator) updatePlayerAvatar(dt);')===true,'T0h ★航拍段喂帧行 verbatim (20-player)');
ok(src04b.includes("if(s&&s.burnTimer&&typeof seatShielded==='function'&&seatShielded(s)){ s.burnTimer=0; s.burnTickT=0; s.burnAttacker=null; s._burnAcc=0; continue; }")===true,'T0i ★座位灭火门 verbatim (04b-fire)');
ok(src20.includes('if(p.deathRag){ av.root.visible=false; return av; }')===true,'T0j playerAvatarDeath 布娃娃档自隐分支不动 (契约G① 既有行)');

// ══ T1 出手弧接续 (真键派发) ══
console.log('T1 出手弧接续: 弧中按 G/3 = 接下一轮, 一次点击一颗');
G(`
pointerLocked=true;   // 19-input 战斗键总门 (!alive||!pointerLocked) — 沙箱无 pointerlockchange, 直置 (seatbar 同款)
player.__rn=player.releaseNade; player.__rnN=0;
player.releaseNade=function(){ player.__rnN++; player.__rn(); };
player.nadeCount=3; player.smokeCount=1; player.incinCount=1; player.atNades=2;
player.nadeHeld=false; player.nadeIsAT=false; player.nadeIsSmoke=false; player.nadeIsIncin=false; player.nadeFuse=0;
VM.state='idle'; VM.stateT=0; VM.stateDur=0; vmSndFlags={};
`);
G(`dispatchEvent(new KeyboardEvent('keydown',{code:'KeyG'}));`);
ok(G('player.nadeHeld')===true,'T1-prep 按下 G = 举雷 (nadeHeld, 哨兵 999)');
ok(G('VM.stateDur')===999&&G('VM.state')==='nade','T1-prep VM 哨兵持雷段 (stateDur=999)');
G(`dispatchEvent(new KeyboardEvent('keyup',{code:'KeyG'}));`);
ok(G('player.nadeHeld')===false&&G('VM.stateDur')===0.55,'T1-prep 松手 = 进 0.55s 出手弧 (nadeHeld=false)');
ok(G('player.__rnN')===0,'T1-prep 弧刚起步未出手 (releaseNade 未跑)');
// (a) 已出手段 (k>0.5): 弧中按 G = 直接重举, 不双掷
G(`VM.stateT=0.30; updateViewModel(1/60, player);`);   // k=0.545>0.5 ⇒ 走真出手
ok(G('player.__rnN')===1&&G('player.nadeCount')===2,'T1a-prep 弧走完前半段真出手 (rnN=1, 计数 3→2)');
G(`dispatchEvent(new KeyboardEvent('keydown',{code:'KeyG'}));`);
ok(G('player.nadeHeld')===true&&G('VM.stateDur')===999,'T1b ★已出手段弧中按 G = 直接重举 (不吃键, 哨兵 999; 改前: 落双击确认网第一按被吃)');
ok(G('player.__rnN')===1,'T1b-2 重举不双掷 (releaseNade 未再跑, 新雷未出手)');
// (b) 未出手段 (k<0.5): 弧中按 G = flush 立即出手 + 重举 (一次点击一颗)
G(`dispatchEvent(new KeyboardEvent('keyup',{code:'KeyG'}));`);
G(`updateViewModel(1/60, player);`);   // stateT≈0.017, k≈0.03 << 0.5 未出手
ok(G('player.__rnN')===1,'T1c-prep 第二颗雷弧内未出手');
G(`dispatchEvent(new KeyboardEvent('keydown',{code:'KeyG'}));`);
ok(G('player.__rnN')===2&&G('player.nadeCount')===1,'T1c ★未出手段弧中按 G = flush 立即出手 (rnN 1→2, 计数 2→1) + 重举');
ok(G('player.nadeHeld')===true&&Math.abs(G('player.nadeFuse')-G('NADE_FUSE_T'))<1e-6,'T1c-2 重举=新雷引信全长 (NADE_FUSE_T)');
// (c) 异键弧中接续: frag 弧中按 3 = frag 立即出手 + 换举 AT
G(`dispatchEvent(new KeyboardEvent('keyup',{code:'KeyG'}));`);
G(`updateViewModel(1/60, player);`);
G(`dispatchEvent(new KeyboardEvent('keydown',{code:'Digit3'}));`);
ok(G('player.__rnN')===3&&G('player.nadeCount')===0,'T1d ★frag 弧中按 3 = frag 立即出手 (rnN→3, frag 计数 1→0) + 换举 AT');
ok(G('player.nadeIsAT')===true&&G('player.nadeFuse')===99&&G('player.nadeHeld')===true,'T1d-2 AT 账就位 (哨兵引信 99)');
// (d) 最后一颗 flush 后空手不自举 (哨兵自愈契约)
G(`player.atNades=1;`);
G(`dispatchEvent(new KeyboardEvent('keyup',{code:'Digit3'}));`);
G(`updateViewModel(1/60, player);`);
G(`dispatchEvent(new KeyboardEvent('keydown',{code:'Digit3'}));`);
ok(G('player.__rnN')===4&&G('player.atNades')===0,'T1e ★最后一颗弧中按 3 = flush 出手 (atNades 1→0) 后空手不自举');
ok(G('player.nadeHeld')===false&&G('VM.stateDur')===999,'T1e-2 空手态 = nadeHeld 保持 false + 哨兵段 (下帧 10-viewmodel 自愈回 idle, 与上载具外摘同路)');
// (e) 旧契约回归: idle 起步 / 同键重按不重置引信 / 持雷异键双击确认
G(`VM.state='idle'; VM.stateT=0; VM.stateDur=0; vmSndFlags={}; player.nadeFuse=0; player.nadeIsAT=false; player.nadeIsSmoke=false; player.nadeIsIncin=false; player.nadeCount=2; player.atNades=2;`);
G(`dispatchEvent(new KeyboardEvent('keydown',{code:'KeyG'}));`);
ok(G('player.nadeHeld')===true&&G('VM.stateDur')===999,'T1f idle 起步回归 (normal raise 不受影响)');
G(`player.nadeFuse=2.0;`);
G(`dispatchEvent(new KeyboardEvent('keydown',{code:'KeyG'}));`);
ok(Math.abs(G('player.nadeFuse')-2.0)<1e-6,'T1f-2 持雷同键重按不重置引信 (烹饪契约, 2026-10-25 保留)');
G(`dispatchEvent(new KeyboardEvent('keydown',{code:'Digit3'}));`);
ok(G('player.nadeIsAT')===false,'T1f-3 持雷异键首按只武装不吃雷 (双击确认保留)');
G(`dispatchEvent(new KeyboardEvent('keydown',{code:'Digit3'}));`);
ok(G('player.nadeIsAT')===true&&G('player.nadeHeld')===true,'T1f-4 持雷异键次按确认 = 换举 AT (2026-10-30 契约保留)');
G(`delete player.releaseNade;`);

// ══ T2 就地倒下死亡镜头 ══
console.log('T2 就地倒下 (sf_deathfx=1): 死亡环绕/航拍段本体可见并倒地');
G(`
player.alive=true; player.deployed=true; player.spectator=false; player.specView=false; player.specViewHost=null;
player.hp=100; player.deathCamT=0; player.deathRag=null; player.killcam=null;
player.chute=false; player.loiter=null; player.onVehicle=null; player.onNaval=null;
player.onMG=null; player.onAT=null; player.onAA=null; player.onMortar=null; player.onBattery=null;
player.deathFallErr=null;
try{ player.die(null,false); }catch(e){ player.deathFallErr=String(e&&e.stack||e).split('\\n')[0]; }
`);
ok(G('player.deathFallErr')===null,'T2-prep die() 无异常'+(G('player.deathFallErr')?(' ('+G('player.deathFallErr')+')'):''));
ok(G('player.alive')===false&&G('player.deathRag')===null&&Math.abs(G('player.deathCamT')-0.8)<1e-6,'T2-prep 就地倒下档: deathRag=null + 死亡环绕 0.8s (deathFallMode 生效)');
G('for(let i=0;i<10;i++) updateCamera(1/60);');
ok(G('playerAvatar&&playerAvatar.root.visible')===true,'T2a ★死亡环绕期本体可见 (改前恒隐 = 用户实报"模型直接消失")');
ok(G('(playerAvatar&&playerAvatar.pelvis?playerAvatar.pelvis.position.y:9)')<0.6,'T2b ★本体倒地中: 骨盆 y='+G('(playerAvatar&&playerAvatar.pelvis?playerAvatar.pelvis.position.y:9)').toFixed(2)+' <0.6 (playerAvatarDeath 契约G② dampF→0.22; 改前姿态机根本没帧)');
ok(G('player.deathCamT')>0&&G('player.deathCamT')<0.8,'T2-prep2 环绕计时已推进 (死亡分支确实在跑)');
G('player.deathCamT=0; updateCamera(1/60);');
ok(G('playerAvatar&&playerAvatar.root?playerAvatar.root.visible:false')===true,'T2c ★航拍段 (环绕结束→部署页空窗) 尸体仍可见 (改前一进航拍又被顶部 hide 收走)');
ok(src20.includes('if(p.deathRag){ av.root.visible=false; return av; }')===true,'T2d 布娃娃档自隐分支源码不动 (ragdoll 档行为零变化)');

// ══ T3 上车灭火 ══
console.log('T3 上车灭火 (seatShielded 座位=免点+灭火单源)');
G(`player.alive=true; player.hp=100; player.onVehicle=null; player.spectator=false; player.deathCamT=0; player.deathRag=null;`);
G(`igniteCreature(player,null,true);`);
ok(G('player.burnTimer')>0,'T3a-prep 玩家已着火 (burnTimer>0)');
G('for(let i=0;i<40;i++) updateCreaturesBurning(1/60);');
ok(G('player.burnTimer')>0,'T3a 对照: 无座位 40 帧照烧 (burnTimer 仍在)');
ok(G('player.hp')<100,'T3a-2 无座位燃烧掉血 (hp='+G('player.hp').toFixed(1)+'<100, 0.4s 跳伤在跑)');
G(`player.hp=100; player.onVehicle={kind:'tank',alive:true}; updateCreaturesBurning(1/60);`);
ok(G('player.burnTimer')===0&&G('player.burnTickT')===0&&G('player.burnAttacker')===null,'T3b ★上车一帧灭火清账 (burnTimer/burnTickT/burnAttacker 全清)');
ok(G('player.hp')===100,'T3b-2 车内不再掉血');
G(`igniteCreature(player,null,true);`);
ok(G('player.burnTimer')===0,'T3c 座位上拒新点火 (igniteCreature seatShielded 既有门回归)');
G(`player.onVehicle=null;`);
G(`
_bot=null; for(const s of soldiers){ if(s.alive&&!s.onVehicle&&s!==player&&!s.spectator){ _bot=s; break; } }
_botErr=null;
try{ igniteCreature(_bot,null,true); }catch(e){ _botErr=String(e&&e.stack||e).split('\\n')[0]; }
`);
ok(G('_botErr')===null&&G('_bot.burnTimer')>0,'T3d-prep Bot 已着火'+(G('_botErr')?(' ('+G('_botErr')+')'):''));
G('updateCreaturesBurning(1/60);');
ok(G('_bot.burnTimer')>0,'T3d 对照: Bot 无座位照烧');
G(`_bot.onVehicle={kind:'tank',alive:true}; updateCreaturesBurning(1/60);`);
ok(G('_bot.burnTimer')===0,'T3e ★Bot 入座同规灭火 (combatants 全体, 不只玩家)');

console.log('');
console.log('verify-throwq-deathfall-seatfire-20261122: PASS='+PASS.length+' FAIL='+FAILN+(NEG?' (--neg)':''));
if(NEG){
console.log('[阴性对照] 期望红 '+FAILN+' 项 (红=判据具备分辨力; N1→T0b+T1c/T1d/T1e, N2→T0c+T1b, N3→T0g+T2a/T2b, N4→T0i+T3b+T3e (T3c 级联), N5→T0h+T2c)');
console.log('[阴性对照] 定向绿: T1a-prep/T1b-2 (弧真出手照旧) / T1f 全组 (idle·烹饪·双击确认三契约) / T2d (布娃娃档分支) / T3a (无座位照烧对照)');
process.exitCode=1;   // 阴性模式固定退出码 1 (与 melee/tiltfall 同款口径)
}else if(FAILN>0) process.exit(1);
