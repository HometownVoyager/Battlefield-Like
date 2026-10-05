// ─────────────────────────────────────────────
// dev/verify-hudfb-20260928.js —— 阶段一「轻量速赢」HUD/反馈批 (2026-09-28, 缺陷登记 D2/D5/D6/D7/D8)
// 用法: node dev/verify-hudfb-20260928.js
// 断言:
//   S1 源码断言:
//     D5 非镜机瞄小准星分支 (旧 atRifle 特批分支已并入) ·
//     D6 pip 兜底走 hudHideReal (按 DOM 实际值幂等写, 不再去重缓存) ·
//     D7 命中反馈 sr.sol.alive 守卫 + 载具命中确定性 onPlayerHitVeh + kill 档接管收账槽 + 车毁多杀红档音合并 ·
//     D8 addVehDmgDir 单源 + 坦克/飞机/舰船三 takeDmg 接线 + 屏缘弧 CSS ·
//     D2 操作方式三按钮 (sf_mobile 直接映射) + i18n 词典键;
//   B1 D6 行为: 20a-seats 直写 style.display + 缓存毒化 = 旧病根现场 —— 阴性对照证明 hudShow 路径确实漏写,
//      再证 updateHUD 兜底 (hudHideReal) 把 DOM 真写回 none; 五条退场路径 (下车/非坦克座/阵亡/观战/AA 下来) 逐条;
//   B2 D5 行为: 非镜 ADS → crosshair 可见且 --gap=5px / 带镜 ADS → 收 / 腰射 → 动态 gap (阴性对照);
//   B3 D7 行为: 真死链 damage(999) → hitmark 红档 (class kill + opacity 1) /
//      手动 onPlayerHit 复现"红档被盖回白档"机制 (阴性对照, 即 13-combat 守卫所挡的那一枪) /
//      onPlayerHitVeh 白档; kill 音 0.25s 合并与 veh 音 0.12s 节流为源码锚;
//   B4 D8 行为: addDirHit 新建 / 同侧(±0.6rad)合并 / 异侧并存 / addVehDmgDir 三态
//      (playerDriven+在座 → 出弧; 非玩家载具 → 不出; 不在座 → 不出)。
// 判据口径: 源码锚一律按签名子串定位 (不记行号); 行为断言调用游戏自身接口 (updateHUD/damage/onPlayerKill/
// addDirHit), 不重写第二套状态机; 每组至少一条阴性对照证明判据非空转。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const {sandbox,document,window,byId}=require('./_bootstub.js');
require('./_bootpatch.js').patch(sandbox);
const _O3=sandbox.THREE.Object3D;
if(_O3&&_O3.prototype&&!_O3.prototype.clear) _O3.prototype.clear=function(){ if(this.children) this.children.length=0; return this; };
sandbox.confirm=()=>true;
const handlers={};
sandbox.addEventListener=(t,f)=>{ (handlers[t]=handlers[t]||[]).push(f); };
sandbox.removeEventListener=()=>{};
// ── 桩能力补齐 (探针侧, 同 verify-touchpad 惯例): ──
// ① style.setProperty —— hudStyle 对 '--gap' 等自定义属性走 setProperty, 桩缺它会静默丢写;
// ② classList —— 桩默认空转, D7 要断言 hitmark 的 kill 类, 必须换成真 Set 实现。
function realCL(el){
const set=new Set(); const sync=()=>{ el.className=[...set].join(' '); };
return { add:(...cs)=>{cs.forEach(c=>set.add(c));sync();},
remove:(...cs)=>{cs.forEach(c=>set.delete(c));sync();},
toggle(c,f){ if(f===undefined){ set.has(c)?set.delete(c):set.add(c);} else if(f) set.add(c); else set.delete(c); sync(); return set.has(c); },
contains:c=>set.has(c) };
}
const patchEl=e=>{ if(!e) return e;
if(e.style&&!e.style.setProperty) e.style.setProperty=function(k,v){ this[k]=v; };
if(!e.__realCL){ e.classList=realCL(e); e.__realCL=1; }
return e; };
{ const g=document.getElementById.bind(document),c=document.createElement.bind(document);
document.getElementById=id=>patchEl(g(id)); document.createElement=t=>patchEl(c(t)); }
const FILES=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/15g-capmodels.js','js/15h-capital.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/19b-gamepad.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/22a-menuart.js','js/22b-speclayer.js','js/23-deploy.js','js/23b-worldrestore.js','js/24-main.js'];
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document; ctx.window=window; ctx.__evH=handlers;
// CANNON 桩 (成例同 verify-destruct-20260927N): B3 的真死链 Bot.die 会走 spawnRagdoll → ragInit,
// 沙箱没有真 cannon CDN ⇒ 用最小桩让布娃娃构造不抛 (本探针不推进布娃娃物理, 构造成功即够)。
const Quat=class{ constructor(){this.x=0;this.y=0;this.z=0;this.w=1;} set(x,y,z,w){this.x=x;this.y=y;this.z=z;this.w=w;return this;} setFromEuler(){return this;} setFromAxisAngle(){return this;} copy(q){Object.assign(this,q);return this;} mult(){return this;} normalize(){return this;} };
const CV3=sandbox.THREE.Vector3;
const CANNON_STUB={Vec3:CV3,Quaternion:Quat,
World:class{ constructor(){ this.gravity=new CV3(); this.broadphase=null; this.solver={iterations:0}; this.bodies=[]; } addBody(b){ this.bodies.push(b); } removeBody(b){ const i=this.bodies.indexOf(b); if(i>=0) this.bodies.splice(i,1); } add(b){ this.addBody(b); } remove(b){ this.removeBody(b); } addConstraint(){} removeConstraint(){} step(){} },
Body:class{ constructor(o){ Object.assign(this,o||{}); this.shapes=[]; this.position=new CV3(); this.velocity=new CV3(); this.angularVelocity=new CV3(); this.quaternion=new Quat(); } addShape(s){ this.shapes.push(s); } },
Box:class{}, Sphere:class{}, Material:class{}, ContactMaterial:class{}, NaiveBroadphase:class{}, PointToPointConstraint:class{}};
ctx.CANNON=CANNON_STUB;
ctx.localStorage={_s:{sf_campaign:'0',sf_exp:'1'},getItem(k){return (k in this._s)?this._s[k]:null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of FILES) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
try{ vm.runInContext(`SPAWN_PROT=0; document.getElementById('startBtn').onclick(); for(const s of combatants) s.protUntil=0;`,ctx); }catch(e){ console.log('  开局异常: '+e); } // 出生保护豁免 (2026-09-28 阶段三): 探针不模拟时间
const R=x=>vm.runInContext(x,ctx);
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const strip=s=>s.replace(/\/\/[^\n]*/g,'');          // 剥 // 行注释 (判据不得被自己的注释绊倒)
let PASS=0, FAILS=0;
const ok=(c,msg)=>{ if(c){ PASS++; console.log('  ✔ '+msg); } else { FAILS++; console.log('  ✘ '+msg); } };
const has=(src,sub,msg)=>ok(src.indexOf(sub)>=0,msg+'   [源码含: '+JSON.stringify(sub.slice(0,56))+'…]');
const lacks=(src,sub,msg)=>ok(strip(src).indexOf(sub)<0,msg+'   [源码已无: '+JSON.stringify(sub.slice(0,56))+'…]');

console.log('══ 阶段一 HUD/反馈批: D2 操控分组 + D5 机瞄准星 + D6 准星残留 + D7 击杀确认 + D8 受击方向 (dev/verify-hudfb-20260928.js) ══');

// ═════ S1 源码断言 ═════
console.log('S1 源码断言');
{
const hud=read('js/22-hud.js'), combat=read('js/13-combat.js'), match=read('js/21-match.js'),
idx=read('index.html'), i18n=read('js/00b-i18n.js'), cfg=read('js/00-config.js'),
veh=read('js/15-vehicles.js'), air=read('js/16-aircraft.js'), naval=read('js/15d-naval.js'),
game=read('js/18-game.js'), css=read('css/style.css');
console.log('  ─ D5 机瞄保留小准星');
has(hud,'else if(player.alive&&player.ads&&!WPN_DEFS[VM.key]?.scoped&&!player.onVehicle){','D5a 非镜机瞄独立分支 (带镜仍收)');
ok(strip(hud).indexOf("--gap','5px')")>=0,'D5b 分支内 5px 档存在 (源码含 --gap 5px)');
lacks(hud,'atRifle&&!player.onVehicle','D5c 旧"仅反坦克枪特批"分支已并入 (代码面消失)');
console.log('  ─ D6 准星残留');
has(hud,'function hudHideReal(id){ const st=el(id).style; if(st.display!==\'none\') st.display=\'none\'; }','D6a hudHideReal 按 DOM 实际值幂等写 (绕开去重缓存)');
has(hud,"hudHideReal('tankPip'); hudHideReal('mgPip');",'D6b tankPip/mgPip 兜底走 hudHideReal');
has(hud,"hudHideReal('leadPip')",'D6c leadPip 兜底走 hudHideReal');
lacks(hud,"hudShow('tankPip',false)",'D6d 旧 hudShow 缓存路径已移出 pip 兜底');
lacks(hud,"hudShow('leadPip',false)",'D6e leadPip 同上');
console.log('  ─ D7 击杀确认');
has(combat,'if(shooter.isPlayer&&sr.sol.alive) onPlayerHit(sr.sol,sr.head);','D7a 致命一击不再补白档 (alive 守卫, 红档不被同帧盖掉)');
lacks(combat,'Math.random()<0.2) AudioSys.hitmarkSnd(false)','D7b 载具命中音 20% 抽奖已废');
has(combat,"typeof onPlayerHitVeh==='function') onPlayerHitVeh()",'D7c 载具命中反馈接线 (21-match 单源)');
has(match,'function onPlayerHitVeh(cls)','D7d onPlayerHitVeh 定义 (2026-09-30 批起带弹种档形参; 旧锚 `onPlayerHitVeh()` 随三档标识机制改写退役)');
has(match,'_lastVehHitSndT>=0.12','D7e 载具命中音 0.12s 确定性节流');
has(match,'hm._t=setTimeout(()=>hm.style.opacity=0,kill?320:140)','D7f 收账槽共槽单点 (hmShow: 红 320/白 140, 白档不清红档定时器这条语义保留)');
has(match,'_lastKillSndT>=0.25','D7g 车毁多杀红档音 0.25s 合并');
console.log('  ─ D8 受击方向指示');
has(match,'function addVehDmgDir(vessel,attacker)','D8a addVehDmgDir 单源 (21-match)');
has(match,'Math.atan2(attacker.pos.x-player.pos.x,attacker.pos.z-player.pos.z)','D8b 来向=attacker→player 世界角');
has(match,'Math.abs(angDiff(rel,oa))<0.6','D8c 同侧 ±0.6rad 合并');
has(match,'o._rm=setTimeout(()=>o.remove(),1500)','D8d 1.5s 收账 (1s 后渐隐)');
has(veh,'addVehDmgDir(this,attacker)','D8e 坦克 takeDmg 接线');
has(air,'addVehDmgDir(this,attacker)','D8f 飞机 takeDmg 接线');
has(naval,'addVehDmgDir(this,attacker)','D8g 舰船 takeDmg 接线');
has(game,'addDirHit(a);','D8h 步兵受击路径保持 (18-game player.damage)');
has(css,'mask:conic-gradient(from -22.5deg','D8i 窄弧 ≈45° 角向遮罩 (三稿=用户裁定: 战地式窄弧)');
has(css,'transparent 140px, rgba(255,84,54,.95) 146px','D8j 等宽弧带 半径≈150px 中距 (用户裁定)');
has(css,'animation:dirHitPulse .3s ease-out','D8m 出生脉冲 (紧迫感; 只动 opacity/filter)');
has(match,'rotate(${-ed}rad)','D8l transform 只剩 rotate (半径由 CSS 画, 不再径向外推)');
lacks(css,'left:-90px; top:-90px; width:180px','D8k 旧 90px 小三角 CSS 已废');
lacks(css,'width:60vh','D8n 一稿 90° 圆环弧已废 (用户反馈: 太大/无尖锐感)');
lacks(css,'clip-path:polygon(0% 16px','D8o 二稿楔标已废 (用户反馈: 太远/太不规则) → 三稿窄弧');
console.log('  ─ D2 操作方式分组');
ok(idx.indexOf('ctrlModeBtn')<0,'D2a 旧"操控: xx"循环按钮已从 index.html 移除');
has(idx,'class="optBtn ctrlBtn" data-c="auto"','D2b 自动按钮 (删键=自动检测)');
has(idx,'data-c="1"','D2c 触屏按钮 (sf_mobile=1)');
has(idx,'data-c="0"','D2d 键鼠按钮 (sf_mobile=0)');
has(idx,'<div class="secLabel" data-i18n>操作方式</div>','D2e 独立「操作方式」节');
has(idx,'画质</div>','D2f 画质节仍在');
has(hud,"document.querySelectorAll('.ctrlBtn')",'D2g 三按钮绑定');
has(hud,"localStorage.removeItem('sf_mobile')",'D2h 自动档=删键');
has(hud,"localStorage.setItem('sf_mobile',c)",'D2i 触屏/键鼠=写档');
has(cfg,"if(ov==='1') return true;","D2j sf_mobile 键契约未变 (00-config MOBILE 仍读 '1'/'0'/删键)");
has(i18n,"'操作方式':'CONTROLS','自动':'Auto','触屏':'Touch','键鼠':'Mouse & Keys',",'D2k i18n 词典补键 (节名+三档)');
}

// ═════ B1 D6 行为: 残留病根现场 + 兜底真写 ═════
console.log('B1 D6 准星残留 (行为)');
{
const out=R(`(()=>{ const out={};
player.onVehicle=null; player.onAA=null; player.onNaval=null; player.alive=true; player.deployed=true;
const tp=document.getElementById('tankPip'), lp=document.getElementById('leadPip'), mp=document.getElementById('mgPip');
// 病根现场: 20a-seats 直写 display='block' (绕过缓存), 而 hudStyle 缓存里还记着进车前的 'none'
tp.style.display='block';
_hw('tankPip').s.display='none';
hudShow('tankPip',false);            // 阴性对照: 旧兜底路径 —— 缓存命中 ⇒ 漏写, DOM 仍是 block
out.negOld=tp.style.display;
updateHUD(1/60);                     // 新兜底 (hudHideReal) 读 DOM 实际值 ⇒ 必须真写回
out.fixed=tp.style.display;
// 五条退场路径逐条 (D6 验收清单): 每条都先把 pip 直写成 block (座驾链的写法), 再跑到对应状态收
const paths=[];
const probe=state=>{ tp.style.display='block'; mp.style.display='block'; lp.style.display='block';
Object.assign(player,state); updateHUD(1/60);
paths.push([tp.style.display,mp.style.display,lp.style.display]); };
probe({onVehicle:null});                                   // ① 正常下车 (F)
probe({onVehicle:{kind:'plane',pos:{x:0,y:100,z:0},hp:50,maxHp:100,cannonCd:0,bombs:3,speed:0,name:'测试机'}});  // ② 换座/上飞机 (非坦克座)
probe({onVehicle:null,alive:false});                       // ③ 阵亡
probe({onVehicle:null,alive:true,spectator:true});         // ④ 进观战
probe({onVehicle:null,alive:true,spectator:false,onAA:null}); // ⑤ 从 AA 下来 (leadPip 归 AA 管)
player.alive=true; player.spectator=false;
out.paths=paths;
// 机枪热量条兜底 (既有 A#3 行为, D6 验收连带): 不在坦克/艇上 ⇒ 收
const mh=document.getElementById('mgHeatWrap'); mh.style.display='block';
updateHUD(1/60); out.mgHeat=mh.style.display;
return out; })()`);
ok(out.negOld==='block','B1-阴性 hudShow 缓存命中确实漏写 (DOM 仍 block) —— 证明判据不是空转');
ok(out.fixed==='none','B1 updateHUD 兜底把 tankPip 真写回 none (D6 主断言)');
ok(out.paths.every(p=>p[0]==='none'&&p[1]==='none'&&p[2]==='none'),'B1 五条退场路径 (下车/换座/阵亡/观战/AA) tankPip+mgPip+leadPip 全收: '+JSON.stringify(out.paths));
ok(out.mgHeat==='none','B1 机枪热量条不在座即收 (既有兜底未回归)');
}

// ═════ B2 D5 行为: 机瞄小准星 ═════
console.log('B2 D5 机瞄保留小准星 (行为)');
{
const out=R(`(()=>{ const out={};
const ch=document.getElementById('crosshair');
player.alive=true; player.deployed=true; player.onVehicle=null; player.loiter=null; player.spectator=false;
const keys=Object.keys(WPN_DEFS);
const scoped=keys.find(k=>WPN_DEFS[k].scoped);
const plain=keys.find(k=>!WPN_DEFS[k].scoped&&!WPN_DEFS[k].atRifle);
VM.key=plain; player.ads=true; updateHUD(1/60);
out.adsPlain=ch.style.display; out.gap=ch.style['--gap'];
VM.key=scoped; updateHUD(1/60);
out.adsScoped=ch.style.display;
player.ads=false; updateHUD(1/60);
out.hip=ch.style.display; out.hipGap=ch.style['--gap'];
player.ads=true; VM.key=plain; updateHUD(1/60);   // 复位
player.ads=false;
return out; })()`);
ok(out.adsPlain==='block','B2 非镜武器 ADS → 准星保留 (旧版此处隐藏 = D5 主断言)');
ok(String(out.gap)==='5px','B2 ADS 小准星档 --gap=5px (与反坦克枪同规)');
ok(out.adsScoped==='none','B2 带镜武器 ADS → 收 (镜内自带分划)');
ok(out.hip==='block'&&out.hipGap!=='5px','B2 阴性: 腰射走动态 gap ('+out.hipGap+') —— 证明 5px 档确实来自 ADS 分支');
}

// ═════ B3 D7 行为: 击杀红档不被盖 ═════
console.log('B3 D7 击杀确认 (行为)');
{
const out=R(`(()=>{ const out={};
const hm=document.getElementById('hitmark');
const s=soldiers.find(x=>x.team!==player.team&&x.alive&&!x.onVehicle);
if(!s){ out.noTarget=1; return out; }
out.killsBefore=player.kills||0;
s.damage(999,player,false);            // 真死链: damage → die → onPlayerKill (红档 + 升档音)
out.dead=!s.alive;
out.killClass=hm.classList.contains('kill');
out.killOpacity=hm.style.opacity;
onPlayerHit(s,false);                  // 2026-09-30 起: hmShow 的 150ms 红档守卫应当把这一下白档**挡掉** (机制升级, 原病根不再复现)
out.guarded=hm.classList.contains('kill');
hm._killT=-99;                         // 阴性对照: 绕开守卫 (把红档时刻伪造成很久以前) ⇒ 白档应能照旧盖掉红档, 证明守卫判据非空转
onPlayerHit(s,false);
out.overwritten=!hm.classList.contains('kill');
onPlayerKill(s,false);                 // kill 档接管收账槽: 白档定时器被清, 红档回来了
out.restored=hm.classList.contains('kill');
hm._killT=-99;                         // 同理绕开守卫再验载具白档
onPlayerHitVeh();                      // 载具命中白档 (13-combat 载具分支调的同一函数)
out.vehWhite=!hm.classList.contains('kill')&&hm.style.opacity==1;
out.killsAfter=player.kills||0;
return out; })()`);
ok(!out.noTarget,'B3 场上有可打敌兵 (目标非空)');
ok(out.dead,'B3 真死链生效 (damage(999) 后敌兵阵亡)');
ok(out.killClass===true&&out.killOpacity==1,'B3 击杀瞬间准星处出红档 (kill 类 + opacity 1)');
ok(out.guarded===true,'B3 150ms 红档守卫: 击杀后同帧白档被挡 (2026-09-30 机制升级, 原 B3 阴性对照的病根由此关死)');
ok(out.overwritten===true,'B3-阴性 绕开守卫 (hm._killT=-99) 后 onPlayerHit 确实会盖掉红档 —— 守卫判据非空转');
ok(out.restored===true,'B3 onPlayerKill 接管收账槽 (clearTimeout) 红档可恢复');
ok(out.vehWhite===true,'B3 onPlayerHitVeh 出白档 (无 kill 类)');
ok((out.killsAfter|0)>=(out.killsBefore|0),'B3 击杀记账链无抛错 (kills '+(out.killsBefore|0)+'→'+(out.killsAfter|0)+')');
}

// ═════ B4 D8 行为: 屏缘方向弧 ═════
console.log('B4 D8 受击方向指示 (行为)');
{
const out=R(`(()=>{ const out={};
const box=document.getElementById('dirHits');
box.children.length=0;                       // 清场
player.yaw=0;
addDirHit(0);                                // 新建
out.n1=box.children.length;
out.tf=(box.children[0]&&box.children[0].style.transform)||'';
addDirHit(0.1);                              // 同侧 (Δ0.1rad) → 合并
out.n2=box.children.length;
addDirHit(Math.PI);                          // 异侧 (Δ≈π) → 并存
out.n3=box.children.length;
// addVehDmgDir 三态: attacker 放 x 负向 ⇒ worldAng=-π/2 ⇒ rel=π/2, 与既有 {π+0.1, 2π} 两条都差 >0.6 ⇒ 必出新高
const v={playerDriven:true,pos:player.pos};
player.onVehicle=v;
addVehDmgDir(v,{pos:{x:player.pos.x-1000,z:player.pos.z,y:0}});
out.n4=box.children.length;
v.playerDriven=false;
addVehDmgDir(v,{pos:{x:player.pos.x-1000,z:player.pos.z,y:0}});
out.n5=box.children.length;                  // 阴性: 非玩家载具不出弧
player.onVehicle=null;
addVehDmgDir(v,{pos:{x:player.pos.x-1000,z:player.pos.z,y:0}});
out.n6=box.children.length;                  // 阴性: 不在座不出弧
return out; })()`);
ok(out.n1===1,'B4 addDirHit 新建 1 条弧');
ok(/rotate\(-?[0-9.]+rad\)/.test(out.tf||''),'B4 弧带 rotate 旋转 (transform='+out.tf+')');
ok(out.n2===1,'B4 同侧 (±0.6rad) 多源合并为同一条 ('+out.n2+')');
ok(out.n3===2,'B4 异侧并存 (2 条)');
ok(out.n4===3,'B4 座驾受击 (playerDriven+在座) → addVehDmgDir 出弧');
ok(out.n5===3,'B4-阴性 非玩家载具不出弧');
ok(out.n6===3,'B4-阴性 不在座不出弧 (车毁那一拍 onVehicle 已清)');
}

console.log('──────────────────────────────');
console.log('合计: '+PASS+' 通过, '+FAILS+' 失败');
process.exit(FAILS?1:0);
