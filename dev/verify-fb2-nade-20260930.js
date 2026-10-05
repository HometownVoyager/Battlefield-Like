// ─────────────────────────────────────────────
// dev/verify-fb2-nade-20260930.js —— 全攻击方式命中/击杀反馈三档化 + 手雷弹道预演/投掷强化批 (2026-09-30)
// 用法: node dev/verify-fb2-nade-20260930.js
// 断言:
//   S1 源码锚:
//     F1 三档标识单源 (21-match: _hitCls/markHitCls/hmShow/onPlayerHitAny/onPlayerWreck + 40ms 红档守卫
//         + CSS --hmC 双外框 + index.html hmF/nadeArc 元素) ·
//     F2 弹种接线全覆盖 (fireBullet='mg' / updateShells·updateFlak·shellHitNaval·torpedoHitTest='shell' /
//         nadeExplode·explodeAt·loiterDetonate='explo' / 近战·碾压='mg') ·
//     F3 击毁红档五条死链 (坦克/战机/舰艇/卡车/岸炮 die → onPlayerWreck) ·
//     F4 手雷投掷单源 (NADE_THROW 四档 + NADE_BLAST_R=10 + releaseNade 四路接表, 旧硬编码初速绝迹) ·
//     F5 持掷输入 (G/3/4/6 按住瞄准, AT/烟/燃 nadeFuse=99 哨兵 + keyup 三键收口) ·
//     F6 updateNadeArc (22-hud 逐帧段挂载 + NADE_THROW 同源);
//   B1 三档标识行为: shell/explo 类互斥切换, kill 同档变红, 40ms 守卫挡同帧白档 (阴性: 拨 _killT 可盖回),
//      onPlayerHit 缺省 cls 回 'mg';
//   B2 接线行为: splashDamage(fbCls) / nadeExplode / updateFlak 三条真链各自点亮对应档位 (目标先回满血、
//      站位 3~4.5m 保证"受伤但活着" —— 致命一击走 die 链, 不出白档, 那是另一条判据);
//      空坦克 takeDmg(99999) 真死链 → onPlayerWreck 红档 (击毁反馈);
//   B3 手雷数值: NADE_THROW/NADE_BLAST_R 值锚; releaseNade 真调用出弹 (水平初速 > 旧 15 上限);
//      explodeAt 9.5m 处仍受伤 (旧半径 9 打不到 —— 半径加大的行为级证据, 阴性: 10.8m 圈外不受伤);
//      落点先扫"净空平地" (探针卫生: 位移/爆炸类判据不贴建筑) ;
//   B4 弹道预演行为: 持雷瞄准期 #nadeArc 显示且点串>3+落点圈在, 松手即收; 圈半径单源 = NADE_BLAST_R。
// 判据口径: 源码锚按签名子串定位 (不记行号); 行为断言调用游戏自身接口 (splashDamage/nadeExplode/
// updateFlak/releaseNade/updateNadeArc), 不重写第二套状态机; 每组至少一条阴性对照。
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
// 2026-09-30 批: 预演落点圈改走 SVG (setAttribute('d', ...)); 桩的 setAttribute 是空实现 ⇒ 加一层记账
if(!e.__realAttr){ e.__realAttr=1; e.__attrs=e.__attrs||{};
const sa=e.setAttribute.bind(e); e.setAttribute=(k,v)=>{ e.__attrs[k]=v; sa(k,v); }; }
return e; };
{ const g=document.getElementById.bind(document),c=document.createElement.bind(document);
document.getElementById=id=>patchEl(g(id)); document.createElement=t=>patchEl(c(t)); }
// FILES 与 index.html 实载清单逐个对齐 (D1 教训: 探针载入清单缺哪个, 那个子系统就不存在) —— 直接解析 index.html
const idxSrc=fs.readFileSync(path.join(root,'index.html'),'utf8');
const FILES=[...idxSrc.matchAll(/src="(js\/[^"?]+)/g)].map(m=>m[1]);
if(FILES.length<41) { console.log('  ✘ FILES 解析异常: 只抓到 '+FILES.length+' 个脚本 (应 ≥41)'); process.exit(1); }
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document; ctx.window=window; ctx.__evH=handlers;
const Quat=class{ constructor(){this.x=0;this.y=0;this.z=0;this.w=1;} set(x,y,z,w){this.x=x;this.y=y;this.z=z;this.w=w;return this;} setFromEuler(){return this;} setFromAxisAngle(){return this;} copy(q){Object.assign(this,q);return this;} mult(){return this;} normalize(){return this;} };
const CV3=sandbox.THREE.Vector3;
const CANNON_STUB={Vec3:CV3,Quaternion:Quat,
World:class{ constructor(){ this.gravity=new CV3(); this.broadphase=null; this.solver={iterations:0}; this.bodies=[]; } addBody(b){ this.bodies.push(b); } removeBody(b){ const i=this.bodies.indexOf(b); if(i>=0) this.bodies.splice(i,1); } add(b){ this.addBody(b); } remove(b){ this.removeBody(b); } addConstraint(){} removeConstraint(){} step(){} },
Body:class{ constructor(o){ Object.assign(this,o||{}); this.shapes=[]; this.position=new CV3(); this.velocity=new CV3(); this.angularVelocity=new CV3(); this.quaternion=new Quat(); } addShape(s){ this.shapes.push(s); } },
Box:class{}, Sphere:class{}, Material:class{}, ContactMaterial:class{}, NaiveBroadphase:class{}, PointToPointConstraint:class{}};
ctx.CANNON=CANNON_STUB;
ctx.localStorage={_s:{sf_campaign:'0',sf_exp:'1'},getItem(k){return (k in this._s)?this._s[k]:null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of FILES) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
try{ vm.runInContext(`SPAWN_PROT=0; document.getElementById('startBtn').onclick(); for(const s of combatants) s.protUntil=0;`,ctx); }catch(e){ console.log('  开局异常: '+e); }
const R=x=>vm.runInContext(x,ctx);
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const strip=s=>s.replace(/\/\/[^\n]*/g,'');
let PASS=0, FAILS=0;
const ok=(c,msg)=>{ if(c){ PASS++; console.log('  ✔ '+msg); } else { FAILS++; console.log('  ✘ '+msg); } };
const has=(src,sub,msg)=>ok(src.indexOf(sub)>=0,msg+'   [源码含: '+JSON.stringify(sub.slice(0,56))+'…]');
const lacks=(src,sub,msg)=>ok(strip(src).indexOf(sub)<0,msg+'   [源码已无: '+JSON.stringify(sub.slice(0,56))+'…]');
const count=(src,sub)=>src.split(sub).length-1;

console.log('══ 全攻击反馈三档化 + 手雷弹道预演批 (dev/verify-fb2-nade-20260930.js) ══');

// ═════ S1 源码锚 ═════
console.log('S1 源码锚');
{
const match=read('js/21-match.js'), combat=read('js/13-combat.js'), veh=read('js/15-vehicles.js'),
air=read('js/16-aircraft.js'), naval=read('js/15d-naval.js'), trucks=read('js/15b-trucks.js'),
bat=read('js/15f-battery.js'), game=read('js/18-game.js'), cfg=read('js/00-config.js'),
input=read('js/19-input.js'), hud=read('js/22-hud.js'), css=read('css/style.css'), idx=read('index.html');
console.log('  ─ F1 三档标识单源');
has(match,'let _hitCls=\'mg\'','F1a _hitCls 缺省枪械档');
has(match,'function markHitCls(c)','F1b 盖章单源 markHitCls');
has(match,'function hmShow(cls,kill)','F1c 标记单源 hmShow (红/白共槽)');
has(match,'nowT-(hm._killT||-9)<0.04','F1d 40ms 红档守卫 (同结算拍白档不降级)');
has(match,'function onPlayerHitAny(cls)','F1e 聚合白档 onPlayerHitAny (0.09s 音效节流)');
has(match,'function onPlayerWreck()','F1f 击毁红档 onPlayerWreck');
has(css,'#hitmark.shell { --hmC:#ffb340; }','F1g shell 档琥珀色 (CSS 变量单源)');
has(css,'#hitmark.explo { --hmC:#ffd23f; }','F1h explo 档黄色');
has(css,'#hitmark.kill { --hmC:#ff5343; }','F1i kill 档整体变红 (含外框)');
has(css,'#hitmark.shell .hmF::before','F1j 四角括号伪面 (shell)');
has(css,'border:3px dashed var(--hmC)','F1k 锯齿环伪面 (explo)');
has(idx,'<b class="hmF"></b>','F1l hitmark 外框元素');
has(idx,'<div id="nadeArc">','F1m 弹道预演容器');
has(idx,'<svg id="naSvg"','F1m2 预演容器内是 SVG 贴地圈 (2026-09-30 批重做: 屏幕正圆→贴地椭圆)');
console.log('  ─ F2 弹种接线');
ok(count(strip(combat),"markHitCls('mg')")>=1,'F2a fireBullet 出膛盖 mg 档 (冲掉上发爆炸残留)');
has(combat,'function splashDamage(p,attacker,team,radius,dmgMax,dmgVeh,ap,fbCls)','F2b splashDamage 第 8 参 fbCls');
has(combat,'onPlayerHitAny(fbCls||\'explo\')','F2c splashDamage 聚合白档接线');
has(combat,'R=R||NADE_BLAST_R','F2d explodeAt 爆圈缺省单源');
ok(count(strip(combat),"markHitCls('explo')")>=2,'F2e nadeExplode+explodeAt 盖 explo 档 (×'+count(strip(combat),"markHitCls('explo')")+'≥2)');
has(combat,"splashDamage(n.pos,n.thrower,n.team,5.5,95,340,true,'explo')","F2f 反坦克炸药爆圈 5→5.5 (带档位戳)");
has(combat,"splashDamage(p,d.owner,-1,9.5,240,560,true,'explo')","F2g 巡飞弹引爆带档位戳");
has(veh,"splashDamage(p,s.owner,s.team,(s.kind==='at')?(s.rocket?12:9):7,s.kind==='at'?70:150,110,true,'shell')","F2h updateShells 溅射带 shell 档");
ok(count(strip(veh),"markHitCls('shell')")>=1,'F2i updateShells 直击盖 shell 档');
ok(count(strip(veh),"onPlayerHitAny('shell')")>=3,'F2j updateShells 直击三路反馈 (坦克/卡车/兵 ×'+count(strip(veh),"onPlayerHitAny('shell')")+'≥3)');
has(veh,"onPlayerHitAny('mg')",'F2k 碾压反馈接线');
ok(count(strip(air),"markHitCls('shell')")>=3,'F2l updateFlak 三路盖 shell 档 (对机/对兵/对坦克 ×'+count(strip(air),"markHitCls('shell')")+'≥3)');
has(air,"onPlayerHitAny('mg')",'F2m 航炮空空显式分层反馈 (noAirHit 弹唯一对空收口)');
has(naval,"function navalSplash(p,attacker,team,radius,dmgMax,dmgVeh,ap,fbCls)",'F2n navalSplash 同源 fbCls');
has(naval,"markHitCls('shell')",'F2o shellHitNaval/torpedoHitTest 盖 shell 档');
has(game,"onPlayerHitAny('mg')",'F2p 近战 (刺刀) 反馈接线');
console.log('  ─ F3 击毁红档五条死链');
ok(count(strip(veh),"onPlayerWreck()")>=1,'F3a Tank.die 击毁红档');
ok(count(strip(air),"onPlayerWreck()")>=1,'F3b Plane.die 击落红档');
ok(count(strip(naval),"onPlayerWreck()")>=1,'F3c 舰艇 beginDestroy 击沉红档');
ok(count(strip(trucks),"onPlayerWreck()")>=1,'F3d Truck.die 击毁红档');
ok(count(strip(bat),"onPlayerWreck()")>=1,'F3e 岸炮 die 打塌红档');
has(bat,"onPlayerHitAny('shell')",'F3f 岸炮 takeDmg 白档 (可击毁硬目标)');
console.log('  ─ F4 手雷投掷单源');
has(cfg,'const NADE_THROW={','F4a NADE_THROW 单源表');
has(cfg,'frag:{v:26,up:2.4}','F4b 手雷 26 (≈31m 档, 旧 15)');
has(cfg,'at:{v:21,up:2.2}','F4c 反坦克雷 21 (旧 12)');
has(cfg,'smoke:{v:21,up:2.4}','F4d 烟雾 21 (旧 12)');
has(cfg,'incin:{v:22,up:2.6}','F4e 燃烧 22 (旧 13)');
has(cfg,'const NADE_BLAST_R=10','F4f 爆圈 9→10 (微量加大)');
ok(count(strip(game),'NADE_THROW.')>=4,'F4g releaseNade 四路接表 (×'+count(strip(game),'NADE_THROW.')+'≥4)');
lacks(game,'multiplyScalar(13).add(V3(0,2.6,0))','F4h 旧燃烧瓶硬编码初速绝迹');
lacks(game,'multiplyScalar(15).add(V3(0,2.4,0))','F4i 旧手雷硬编码初速绝迹');
console.log('  ─ F5 持掷输入');
ok(count(input,'player.nadeFuse=99')>=3,'F5a AT/烟/燃 nadeFuse=99 哨兵 (Cook 自爆只归普通雷) ×'+count(input,'player.nadeFuse=99'));
ok(count(strip(input),'VM.stateDur=999')>=4,'F5b G/3/4/6 按住=哨兵态 (×'+count(strip(input),'VM.stateDur=999')+'≥4)');
has(input,"(e.code==='Digit3'||e.code==='Digit4'||e.code==='Digit6')&&player.nadeHeld",'F5c keyup 三键收口 (松手=出手)');
lacks(input,'VM.stateDur=0.6;','F5d 旧"按键即扔"瞬发态绝迹');
console.log('  ─ F6 弹道预演');
has(hud,'function updateNadeArc()','F6a updateNadeArc 定义');
has(hud,'updateNadeArc();','F6b updateHUD 逐帧段挂载');
has(hud,'NADE_THROW[type]','F6c 初速与实弹同源 (00-config 单源)');
has(combat,'waterDepthAt(nx,nz)>0.6','F6d 入水哑火同口径 (>0.6m) —— 物理已收口到 13-combat nadeStep');
has(hud,'nadeArcRingR(type)','F6e 落点圈半径按弹种分档');
has(hud,'nadeStep(st,NADE_ARC_STEP)','F6f 预演物理 = 实弹 (nadeStep 单源, 2026-09-30 批: 旧版是 updateNades 的抄写件)');
}

// ═════ B1 三档标识行为 ═════
console.log('B1 三档标识 (行为)');
{
const out=R(`(()=>{ const out={};
const hm=document.getElementById('hitmark');
player.alive=true;
hmShow('shell',false); out.s1=hm.classList.contains('shell')&&!hm.classList.contains('explo')&&!hm.classList.contains('kill');
onPlayerHitAny('explo'); out.s2=hm.classList.contains('explo')&&!hm.classList.contains('shell');
markHitCls('shell'); onPlayerWreck();
out.k1=hm.classList.contains('kill')&&hm.classList.contains('shell');   // 击毁: 同档变红 (形状保留)
hm._killT=-99;                                                          // 阴性: 拨旧红档时刻 → 白档应可盖回
hmShow('mg',false);
out.s3=!hm.classList.contains('kill')&&!hm.classList.contains('shell')&&!hm.classList.contains('explo');
onPlayerHit({dummy:1},false);                                           // 缺省 cls → 回 mg 档 (读 _hitCls='mg')
out.s4=!hm.classList.contains('shell')&&!hm.classList.contains('explo')&&hm.style.opacity==1;
return out; })()`);
ok(out.s1===true,'B1 shell 档白标 (琥珀括号类, 无 explo/kill)');
ok(out.s2===true,'B1 explo 档白标 (锯齿环类, 互斥切换)');
ok(out.k1===true,'B1 击毁红档 = kill+shell 双类 (同档变红, 形状保留)');
ok(out.s3===true,'B1-阴性 拨 _killT 后 mg 白档可盖掉红档 —— 40ms 守卫判据非空转');
ok(out.s4===true,'B1 onPlayerHit 缺省 cls 落 mg 档 (opacity 照常点亮)');
}

// ═════ B2 接线行为 ═════
console.log('B2 弹种接线 (行为)');
{
const out=R(`(()=>{ const out={};
const hm=document.getElementById('hitmark');
hm._killT=-99;                                           // B1 的 kill 拍还挂着 40ms 守卫 (沙箱 nowT 不走), 先清账
const aliveEnemy=skip=>soldiers.find(x=>x.team!==player.team&&x.alive&&!x.onVehicle&&!skip.includes(x));
const skip=[];
const s=aliveEnemy(skip); if(!s){ out.noTarget=1; return out; }
skip.push(s);
s.hp=100;                                                // 目标回满血: 这些判据只认"白档" (致命一击走 die 链, 不在此列)
const bp=V3(s.pos.x+3,s.pos.y+0.5,s.pos.z);              // 3m 外爆点: dmg=45 (被挡 ×0.25=11) —— 受伤必活着
splashDamage(bp,player,player.team,6,80,100,false,'shell');
out.shells=hm.classList.contains('shell');               // 炮弹溅射 → shell 档
out.dmg1=s.hp<100;
const s2=aliveEnemy(skip);
if(s2){ skip.push(s2);
s2.hp=100;
const bp2=V3(s2.pos.x+4.5,s2.pos.y+0.5,s2.pos.z);        // 4.5m: explodeAt dmg=74 (被挡 18.5) —— 同样"伤而不杀"
nadeExplode({pos:bp2,thrower:player,team:player.team});  // 普通手雷分支 = explodeAt 路径
out.explo=hm.classList.contains('explo')&&!hm.classList.contains('shell');
out.dmg2=s2.hp<100;
} else { out.explo='noTarget'; }
const s3=aliveEnemy(skip);
if(s3){
flakShots.push({pos:V3(s3.pos.x,s3.pos.y+1,s3.pos.z),vel:V3(0,-5,0),team:player.team,owner:player,life:1.7});
updateFlak(1/60,1/60);                                   // 高炮弹对地面兵 (弹片圈直中)
out.flak=hm.classList.contains('shell');
out.flakDmg=!s3.alive||s3.hp<100;
} else { out.flak='noTarget'; }
// 空坦克真死链 → onPlayerWreck 红档 (击毁反馈主断言): 摘掉乘员/驾驶员 = 空车, 红档只能来自 onPlayerWreck
const t=tanks.find(x=>x.alive&&x.team!==player.team);
if(t){
t.playerDriven=false; t.crewBot=null;
t.takeDmg(99999,player,true);
out.wreck=hm.classList.contains('kill');
out.wreckAlive=!t.alive;
} else { out.wreck='noTank'; }
return out; })()`);
ok(!out.noTarget,'B2 场上有可打敌兵');
ok(out.shells===true,'B2 splashDamage(fbCls=\'shell\') → 琥珀括号档点亮');
ok(out.dmg1===true,'B2 溅射确实伤到目标 (非空转)');
ok(out.explo==='noTarget'||out.explo===true,'B2 nadeExplode (explodeAt 路) → 黄锯齿环档点亮'+(out.explo==='noTarget'?' (场上无第二敌兵, 跳过)':''));
ok(out.explo==='noTarget'||out.dmg2===true,'B2 手雷爆圈确实伤到目标');
ok(out.flak==='noTarget'||out.flak===true,'B2 updateFlak 弹片命中 → shell 档'+(out.flak==='noTarget'?' (场上无第三敌兵, 跳过)':''));
ok(out.flak==='noTarget'||out.flakDmg===true,'B2 高炮弹片确实伤到目标');
ok(out.wreck==='noTank'||out.wreck===true,'B2 空坦克击毁真死链 → 红档 (onPlayerWreck)'+(out.wreck==='noTank'?' (场上无敌坦克, 跳过)':''));
ok(out.wreck==='noTank'||out.wreckAlive===true,'B2 坦克确实被打到 alive=false');
}

// ═════ B3 手雷数值 ═════
console.log('B3 手雷投掷/爆圈 (行为)');
{
const out=R(`(()=>{ const out={};
out.cfgFrag=NADE_THROW.frag.v; out.cfgAt=NADE_THROW.at.v; out.cfgBlast=NADE_BLAST_R;
const n0=nades.length;
player.nadeCount=1; player.nadeFuse=3.8; player.nadeIsAT=false; player.nadeIsSmoke=false; player.nadeIsIncin=false;
player.vel=V3(0,0,0);
player.releaseNade();
out.thrown=nades.length===n0+1;
const n=nades[nades.length-1];
const vh=Math.hypot(n.vel.x,n.vel.z);
out.vh=vh; out.fuse=n.fuse;
// 阴性对照: 旧初速 15 → 平飞水平分量 ≤15; 新表 26 → 水平分量必然 >15.5 (俯仰只减不增)
out.faster=vh>15.5;
// 净空平地扫描 (探针卫生): 爆炸/位移类判据不贴建筑 —— 8 向 8m 无遮挡 + 缓坡
let spot=null;
for(let i=0;i<400&&!spot;i++){
const x=player.pos.x+(Math.random()*160-80), z=player.pos.z+(Math.random()*160-80);
const gh=heightAt(x,z);
if(waterYAt(x,z)>-1e8) continue;
if(Math.abs(gh-heightAt(x+4,z))>0.4||Math.abs(gh-heightAt(x,z+4))>0.4) continue;
let blocked=false;
for(let a=0;a<8;a++){ const dx=Math.sin(a*Math.PI/4), dz=Math.cos(a*Math.PI/4);
if(raycastWorld(V3(x,gh+1.2,z),V3(dx,0,dz),8)){ blocked=true; break; } }
if(!blocked) spot={x,z,gh};
}
out.spot=!!spot;
if(spot){
const s=soldiers.find(x2=>x2.team!==player.team&&x2.alive&&!x2.onVehicle);
if(s){
// 爆点在净空地中心, 目标放 9.5m —— 旧半径 9 打不到的位, 新半径 10 打得到 (行为级证据)
n.pos.set(spot.x,spot.gh+0.6,spot.z);
s.pos.set(spot.x+9.5,heightAt(spot.x+9.5,spot.z),spot.z);
s.hp=100;
explodeAt(V3(spot.x,spot.gh+0.6,spot.z),player);
out.blastHit=(s.hp<100)||!s.alive;
const s2=soldiers.find(x2=>x2.team!==player.team&&x2.alive&&!x2.onVehicle&&x2!==s);
if(s2){
s2.pos.set(spot.x+10.8,heightAt(spot.x+10.8,spot.z),spot.z);
const hp1=s2.hp;
explodeAt(V3(spot.x,spot.gh+0.6,spot.z),player);
out.blastMiss=(s2.hp===hp1)&&s2.alive;                  // 阴性: 10.8m 圈外不受伤
} else out.blastMiss='noTarget2';
} else { out.blastHit='noTarget'; out.blastMiss='noTarget'; }
} else { out.blastHit='noSpot'; out.blastMiss='noSpot'; }
return out; })()`);
ok(out.cfgFrag===26&&out.cfgAt===21,'B3 NADE_THROW 值锚 (frag='+out.cfgFrag+' at='+out.cfgAt+')');
ok(out.cfgBlast===10,'B3 NADE_BLAST_R=10');
ok(out.thrown===true,'B3 releaseNade 真调用出弹 (nades +1)');
ok(out.faster===true,'B3 出手水平初速 '+out.vh.toFixed(1)+'m/s > 旧 15 上限 (引信 '+out.fuse+'s, 31m 档)');
ok(out.spot===true,'B3 净空平地扫描命中 (判据场地非空转)');
ok(out.blastHit===true,'B3 9.5m 处爆伤命中 (旧半径 9 打不到的位)');
ok(out.blastMiss===true,'B3-阴性 10.8m 处圈外不受伤 —— 爆圈判据非空转');
}

// ═════ B4 弹道预演行为 ═════
console.log('B4 弹道预演 (行为)');
{
// 桩不忠实补齐 (2026-09-28 firstChild 同族): 沙箱 V3 桩没有 project/applyMatrix4 (真 three 有),
// 相机桩没有矩阵/updateMatrixWorld —— updateNadeArc 的投影段在沙箱里会 TypeError。这里按真 three
// 的公式补原型 (行为判据只认"画了多少点/圈在不在", 不认像素位置), 相机矩阵给恒等+缩放 (z×0.02
// 保证 30m 内 z<1 不被 behind/z>1 分支吞掉)。
R(`(()=>{
const VP=THREE.Vector3.prototype;
if(!VP.applyMatrix4) VP.applyMatrix4=function(m){ const e=m.elements;
const x=this.x,y=this.y,z=this.z;
const w=(e[3]*x+e[7]*y+e[11]*z+e[15])||1;
this.x=(e[0]*x+e[4]*y+e[8]*z+e[12])/w;
this.y=(e[1]*x+e[5]*y+e[9]*z+e[13])/w;
this.z=(e[2]*x+e[6]*y+e[10]*z+e[14])/w;
return this; };
if(!VP.project) VP.project=function(cam){ return this.applyMatrix4(cam.matrixWorldInverse).applyMatrix4(cam.projectionMatrix); };
const mat=(s,tx,ty,tz)=>{ const e=new Float32Array(16); e[0]=e[5]=e[10]=s; e[15]=1; e[12]=tx; e[13]=ty; e[14]=tz; return {elements:e}; };
camera.matrixWorld=mat(1,0,0,0);
camera.matrixWorldInverse=mat(1,-camera.position.x,-camera.position.y,-camera.position.z);
camera.projectionMatrix=mat(0.02,0,0,0);
camera.updateMatrixWorld=()=>{};
})()`);
const out=R(`(()=>{ const out={};
const box=document.getElementById('nadeArc');
player.alive=true; player.spectator=false; matchOver=false;
player.nadeIsAT=false; player.nadeIsSmoke=false; player.nadeIsIncin=false;
player.nadeFuse=3.8; player.vel=V3(0,0,0); player.onVehicle=null;
// 净空平地: 相机与玩家一起搬过去 (点串>3 需要至少 ~1m 的落地滑翔距离)
let spot=null;
for(let i=0;i<400&&!spot;i++){
const x=player.pos.x+(Math.random()*160-80), z=player.pos.z+(Math.random()*160-80);
const gh=heightAt(x,z);
if(waterYAt(x,z)>-1e8) continue;
if(Math.abs(gh-heightAt(x+4,z))>0.4||Math.abs(gh-heightAt(x,z+4))>0.4) continue;
spot={x,z,gh};
}
player.pos.set(spot.x,spot.gh,spot.z);
camera.position.set(spot.x,spot.gh+1.62,spot.z);
camera.rotation.set(0,0,0);
// 逆矩阵随搬场重算 (真机由渲染器每帧刷新, 沙箱桩要手动同步): 不刷新 ⇒ 落点相对量翻正,
// updateNadeArc 的 behind 分支把整段预演吞掉 (0 点 0 圈的假阴性, 本批首跑踩到)
camera.matrixWorldInverse.elements[12]=-spot.x;
camera.matrixWorldInverse.elements[13]=-spot.gh-1.62;
camera.matrixWorldInverse.elements[14]=-spot.z;
camera.updateMatrixWorld();
VM.state='nade'; player.nadeHeld=true;
updateNadeArc();
out.show=box.style.display;
let vis=0; for(const d of box.children) if(d.style.display==='block'&&d.className==='na') vis++;
out.dots=vis;
const ringPath=document.getElementById('naBlast');
out.ring=ringPath?ringPath.style.display:'none';
out.ringPt=ringPath?String((ringPath.__attrs&&ringPath.__attrs.d)||'').split(/[ML]/).length-1:0;
out.ringR=nadeArcRingR('frag');
player.nadeHeld=false;
updateNadeArc();
out.hide=box.style.display;
return out; })()`);
ok(out.show==='block','B4 持雷瞄准期 #nadeArc 显示');
ok(out.dots>3,'B4 点串渲染 ('+out.dots+' 点 > 3)');
ok(out.ring==='block','B4 落点圈在 (SVG 贴地环)');
ok(out.ringPt>=12,'B4 落点圈是逐点投影出来的环 ('+out.ringPt+' 段 ≥12, 不是屏幕正圆)');
ok(out.ringR===10,'B4 圈半径单源 = NADE_BLAST_R ('+out.ringR+')');
ok(out.hide==='none','B4 松手即收 (nadeHeld=false → display none)');
}

console.log('──────────────────────────────');
console.log('合计: '+PASS+' 通过, '+FAILS+' 失败');
process.exit(FAILS?1:0);
