// ─────────────────────────────────────────────
// dev/verify-airfix-20261114.js —— 飞机坠毁分档 × 残骸落点 × 炮弹对空 × 调试部署 × 撞楼成就批 (2026-11-14)
// 用法: node dev/verify-airfix-20261114.js [--neg]
// 五令:
//   ① 撞楼坠机演出分档: 撞楼 = 楼面一炸 (无弹坑) + 残骸贴楼/贴地 + restT 到点二次爆炸消失;
//      坠地 = 触地一炸 + 弹坑 + 残骸沉入地下 (旧口径保留)。
//      病根 A (诡异弹坑): explosionFX 的 crater 恒打 heightAt(x,z) = 爆点正下方的地面 ⇒ 半空/楼面
//      爆炸隔空在地上盖坑 (高炮空炸/楼面中弹全中招) ⇒ 加高度门 (爆点高于地面 2.2m 不盖) + noCrater 参。
//      病根 B (浮空): 残骸坠落段建筑扫掠"就地迫降"沿来向回退 0.4m 贴在墙面上 = 半空悬浮静置,
//      restT 到点再整体直沉 4.6m ⇒ 拆成两档: 顶面命中 (命中面法线 ny=+1) 贴楼顶安放 / 侧面命中
//      顺墙滑落 (轻微反弹+保留坠势) 由地面档收尾。
//   ② 调试模式 (含待生效) 冷却读数中点「部署」= 直接部署 (22-hud onclick bypass + 24-main 按钮不灰);
//      非调试照旧无反应; 冷却读数本身不受影响 (24-main 递减不碰)。
//   ③ 成就「利库德集团最好的飞行员」: 驾机撞楼而亡 —— 事件制 (同自刎归天族): 16-aircraft die 撞楼档
//      在玩家死亡链盖 player._achPilotBld, 27-achievements 死亡边沿轮询读后即清。
//   ④ 坦克炮弹/火箭筒/反坦克炮/岸防炮/舰炮 (updateShells 全家) 命中飞机: 7c 单源 planeHitTest
//      线段-球接入, excludeTeam=弹体队 (友机豁免; 观战/幽灵坦克 team=-1 不豁免=可打双方)。
// 判据: T1 explosionFX 高度门三态; T2 撞楼 die 无坑+wreck.bld / 坠地 die 照旧盖坑 (对照组);
//   T3 撞楼残骸全链 (侧面滑落不悬浮不穿楼/贴地无坑无炸/收尾二次爆炸杀兵仍无坑) + 非撞楼对照 (落地盖坑);
//   T4 顶面命中贴楼顶 (onTop); T5 炮弹对空击落 + 友军豁免对照; T6 调试冷却 bypass 双态;
//   T7 成就解锁; T8 源码防回退锚。
//   --neg: 九补丁累积注入 (N1 坑门拆 / N2 撞楼档拆 / N3 滑落拆 / N4 贴顶拆 / N5 落地坑门拆 /
//     N6 二次爆炸拆 / N7 对空判定拆 / N8 部署 bypass 拆 / N9 成就判据拆), 红名↔补丁对认。
// 沙箱要点承 verify-loiterarm-20261113 / verify-specneut-20261113 (boot/SRC/PATCH_MAP/真开局+
//   deployPlayer/protUntil 清账; CF 走廊/合成盒 addBoxCollider 即时注册 RGRID; 裸名隐式全局)。
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
console.log('载入清单: 解析 index.html 得 '+FILES.length+' 个脚本');

// ── NEG 阴性对照: 九补丁累积注入 (正常跑不启用) ──
const NEG=process.argv.includes('--neg');
const SRC={},PATCH_MAP={};
const NEG_PATCHES=[
// N1 弹坑高度门拆 (回退无条件盖坑): T1b 高空爆炸隔空盖坑红
['js/08-effects.js','if(!noCrater&&p.y-heightAt(p.x,p.z)<2.2) crater(p.x,p.z,rand(1.2,1.7),true,p.y);','crater(p.x,p.z,rand(1.2,1.7),true);'],
// N2 撞楼档拆 (第三参丢): T2a wreck.bld 红 + T2b 低空撞楼 die 隔空盖坑红
['js/16-aircraft.js','this.die(this.lastHitBy||null,true,true);','this.die(this.lastHitBy||null,true);'],
// N3 侧面滑落拆 (回退贴墙悬浮静置): T3a 滑落段 state 红 + 终点贴地红
['js/16-aircraft.js','w.vel.set(-_plSwD.x*2.2,w.vel.y*0.45,-_plSwD.z*2.2);',"w.state='rest'; w.vel.set(0,0,0);"],
// N4 贴顶拆 (顶面命中悬浮 4.5m): T4 贴顶高度红
['js/16-aircraft.js','w.pos.y=_plSwHit.y+0.45;','w.pos.y=_plSwHit.y+4.5;'],
// N5 落地坑门拆 (撞楼残骸落地也盖坑): T3a 落地无坑红
['js/16-aircraft.js','if(!w.bld){','if(true){'],
// N6 收尾二次爆炸拆: T3d 二爆杀兵红
['js/16-aircraft.js','if(w.bld){','if(false){'],
// N7 对空判定拆: T5 炮弹打不下飞机红
['js/15-vehicles.js','const ph=(typeof planeHitTest===\'function\')?planeHitTest(s.pos,dir,hitD,s.team):null;','const ph=null;'],
// N8 调试部署 bypass 拆: T6a 调试冷却点击无反应红
['js/22-hud.js',"if(!player.alive&&(player.spectator||player.specWillBe())) deployPlayer();",';'],
// N9 成就判据拆: T7 解锁红
['js/27-achievements.js',"if(player._achPilotBld){ player._achPilotBld=false; achUnlock('likud_pilot'); }",';'],
];
if(NEG) for(const [f,from,to] of NEG_PATCHES){
if(SRC[f]===undefined) SRC[f]=fs.readFileSync(path.join(root,f),'utf8');
if(SRC[f].indexOf(from)<0){ console.log('✗ NEG 锚缺失: '+f+' :: '+from); process.exit(1); }
PATCH_MAP[f]=(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC[f]).split(from).join(to);
}
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:fs.readFileSync(path.join(root,f),'utf8'));

function boot(campIdx){
for(const k in stub.byId)delete stub.byId[k];
const ctx=vm.createContext(Object.assign({},stub.sandbox));
ctx.document=stub.document; ctx.window=stub.window; ctx.CANNON=CANNON;
ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of FILES) vm.runInContext(srcOf(f),ctx,{filename:f});
return ctx;
}
const PASS=[];let FAILN=0;
function ok(cond,label){
if(cond){ PASS.push(label); console.log('  ✔ '+label); }
else { FAILN++; console.log('  ✘ '+label); }
}
let IDX=3; { const c0=boot(0); IDX=vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="normandy")',c0); } // 诺曼底 (aircollide/loiterarm 同源: 开阔走廊)
const ctx=boot(IDX);
const G=s=>vm.runInContext(s,ctx);

let err0=null;
try{ G("document.getElementById('startBtn').onclick();"); }catch(e){ err0=String(e&&e.stack||e); }
if(!err0){ try{ G('if(!player.alive||!player.deployed) deployPlayer();'); }catch(e){ err0='deployPlayer: '+String(e&&e.stack||e); } }
if(err0||!G('player.alive')){ console.log('  ✘ 开局/部署失败 '+(err0||'player.alive=false')); process.exit(1); }
G('for(const s of soldiers) s.protUntil=0; player.protUntil=0;');
ok(G('soldiers.length')>0,'前置: 战场已开局并部署 (soldiers='+G('soldiers.length')+', player.alive='+G('player.alive')+')');
ok(html.includes("__sfStyleVer='20261121c'"),'前置: 版本戳 20261121c 在位 (index.html 内联)');

// ── 场地: CF 走廊 (承 loiterarm 同式) + 探针工具 ──
G("CF=null; { const R=MAP_SIZE/2-70; const tallBox=(x0,z0,x1,z1,gy)=>{ for(const b of BOXES){ if(b.dead) continue; if(b.maxX<x0||b.minX>x1||b.maxZ<z0||b.minZ>z1) continue; if(b.maxY>gy-0.4&&b.minY<gy+1.5) return true; } return false; }; const tallCyl=(x0,z0,x1,z1,gy)=>{ for(const c of CYLS){ if(c.dead||c.foliage) continue; if(c.x<x0-(c.r+1.5)||c.x>x1+(c.r+1.5)||c.z<z0-(c.r+1.5)||c.z>z1+(c.r+1.5)) continue; if(c.y1>gy-0.4&&c.y0<gy+1.5) return true; } return false; }; for(let z=-R;z<=R&&CF===null;z+=13)for(let x=-R;x<=R-44;x+=13){ const gh=heightAt(x,z); if(gh<1||gh>45) continue; if(occBlocked(x,z)) continue; let flat=true; for(let xx=x-4;xx<=x+40&&flat;xx+=3){ if(Math.abs(heightAt(xx,z)-gh)>2) flat=false; } if(!flat) continue; if(tallBox(x-6,z-6,x+40,z+6,gh+5)) continue; if(tallCyl(x-6,z-6,x+40,z+6,gh+5)) continue; CF={x:x,z:z,gh:gh}; break; } }");
ok(G('!!CF')===true,'场地: 空旷走廊已找到');
G("_tmpB=[]; tmpBox=(x,y,z,w,h,d)=>{ const b=addBoxCollider(x,y,z,w,h,d); _tmpB.push(b); return b; }; clearTmpBoxes=()=>{ while(_tmpB.length){ const b=_tmpB.pop(); if(b&&!b.dead) killBox(b); } }; clearCorr=(x0,z0,x1,z1)=>{ const cx=clamp(x0-110,-140,140); for(const s of soldiers){ if(s.alive&&s.pos.x>x0-8&&s.pos.x<x1+8&&s.pos.z>z0-8&&s.pos.z<z1+8){ s.pos.set(cx,heightAt(cx,s.pos.z)+1,s.pos.z); } } for(const t of tanks){ if(t.alive&&t.pos.x>x0-12&&t.pos.x<x1+12&&t.pos.z>z0-12&&t.pos.z<z1+12){ t.pos.set(cx,heightAt(cx,t.pos.z),t.pos.z); } } for(const t of trucks){ if(t.alive&&t.pos.x>x0-12&&t.pos.x<x1+12&&t.pos.z>z0-12&&t.pos.z<z1+12){ t.pos.set(cx-10,heightAt(cx-10,t.pos.z),t.pos.z); } } for(const p of planes){ if(p.alive&&p.pos.x>x0-12&&p.pos.x<x1+12&&p.pos.z>z0-12&&p.pos.z<z1+12){ p.pos.set(cx,120,p.pos.z); p.speed=0; } } }; _mkWreck=(x,y,z,vx,vy,vz,bld,ageT)=>{ const wm=new THREE.Group(); planeWrecks.push({m:wm,pos:V3(x,y,z),vel:V3(vx,vy,vz),yaw:0,pitch:0,roll:0,rollV:0,attacker:null,team:0,state:'fall',smokeT:1,restT:24,col:null,size:3,ageT:(ageT===undefined?0:ageT),bld:!!bld,onTop:false}); return planeWrecks[planeWrecks.length-1]; }; _rmWreck=(w)=>{ if(w.fireSrc){ removeFireSource(w.fireSrc); w.fireSrc=null; } if(w.col){ killDynCollider(w.col); w.col=null; } const i=planeWrecks.indexOf(w); if(i>=0){ if(w.m&&w.m.parent) w.m.parent.remove(w.m); planeWrecks.splice(i,1); } };");
ok(G('!!tmpBox&&!!_mkWreck')===true,'场地: 探针工具就绪 (合成盒/伪残骸/清扫)');

// ══ T1 explosionFX 弹坑高度门 ══
console.log('T1 explosionFX 高度门: 低空盖坑 / 高空不盖 / noCrater 显式压');
G("clearTmpBoxes(); clearCorr(CF.x,CF.z-8,CF.x+40,CF.z+8); _t1={}; const _c0=runtimeCraters.length; explosionFX(V3(CF.x+6,heightAt(CF.x+6,CF.z)+0.5,CF.z)); _t1.low=runtimeCraters.length-_c0; explosionFX(V3(CF.x+6,heightAt(CF.x+6,CF.z)+8,CF.z)); _t1.high=runtimeCraters.length-_c0-0; _t1.high=_t1.high-_t1.low; explosionFX(V3(CF.x+6,heightAt(CF.x+6,CF.z)+0.5,CF.z),true); _t1.nc=runtimeCraters.length-_c0-_t1.low-_t1.high;");
ok(G('_t1.low===1')===true,'T1a ★低空爆炸 (地面上 0.5m) 照旧盖坑 (+'+G('_t1.low')+')');
ok(G('_t1.high===0')===true,'T1b ★高空爆炸 (地面上 8m) 不再隔空盖坑 (+'+G('_t1.high')+') —— 撞楼诡异弹坑病根');
ok(G('_t1.nc===0')===true,'T1c noCrater 显式参压掉低空盖坑 (+'+G('_t1.nc')+')');

// ══ T2 撞楼 die 分档: 无坑 + wreck.bld / 坠地对照照旧盖坑 ══
console.log('T2 撞楼 die: 楼面一炸无坑 / 坠地 die 弹坑照旧');
G("clearTmpBoxes(); clearCorr(CF.x,CF.z-8,CF.x+40,CF.z+8); var _p1=null,_p2=null; for(const p of planes){ if(p.alive&&p.team!==player.team){ if(!_p1) _p1=p; else if(!_p2) _p2=p; } } if(_p1){ _p1.respawn(); _p1.alive=true; _p1.playerDriven=false; _p1.crewBot=null; _p1.pos.set(CF.x+10,heightAt(CF.x+10,CF.z)+1.5,CF.z); } if(_p2){ _p2.respawn(); _p2.alive=true; _p2.playerDriven=false; _p2.crewBot=null; _p2.pos.set(CF.x+20,heightAt(CF.x+20,CF.z)+1.5,CF.z); } _t2={}; const _wk0=planeWrecks.length, _c1=runtimeCraters.length; if(_p1){ _p1.die(null,true,true); _t2.bldWreck=planeWrecks.length>_wk0?planeWrecks[planeWrecks.length-1]:null; _t2.bldFlag=!!(_t2.bldWreck&&_t2.bldWreck.bld); _t2.dead1=!_p1.alive; } _t2.cratBld=runtimeCraters.length-_c1; if(_p2){ _p2.die(null,true); } _t2.cratGnd=runtimeCraters.length-_c1-_t2.cratBld; _t2.dead2=_p2?!_p2.alive:false; _t2.wk2=planeWrecks.length-_wk0;");
ok(G('_t2.dead1')===true,'T2a 撞楼 die 机毁 (alive=false)');
ok(G('_t2.bldFlag')===true,'T2b ★残骸带 bld 档 (撞楼演出链入账)');
ok(G('_t2.cratBld===0')===true,'T2c ★撞楼 die 不盖弹坑 (+'+G('_t2.cratBld')+') —— 旧版爆点在楼面、坑在正下方地上');
ok(G('_t2.cratGnd>=1')===true,'T2d 对照: 坠地 die 照旧盖坑 (+'+G('_t2.cratGnd')+')');
if(G('_t2.bldWreck')){ G('_rmWreck(_t2.bldWreck)'); }
G('for(const w of planeWrecks.slice(-2)) _rmWreck(w);');

// ══ T2e 端到端: 平飞撞楼 (走 Plane.update 扫掠调用点) ⇒ die(bld) 链 ══
console.log('T2e 端到端撞楼: 扫掠调用点传 bld (NEG N2 亲见转红钉)');
G("clearTmpBoxes(); clearCorr(CF.x,CF.z-10,CF.x+40,CF.z+10); tmpBox(CF.x+30,CF.gh+5,CF.z,1.2,10,12); var _p3=null; for(const p of planes){ if(p.team!==player.team){ _p3=p; break; } } if(_p3){ _p3.respawn(); _p3.alive=true; _p3.playerDriven=false; _p3.crewBot=null; _p3.pos.set(CF.x+27.4,CF.gh+5,CF.z); _p3.yaw=Math.PI/2; _p3.pitch=0; _p3.roll=0; _p3.speed=40; if(_p3.fctl){ _p3.fctl.bank=0; _p3.fctl.pitchT=0; } } _t2e={}; const _wk2e=planeWrecks.length, _c2e=runtimeCraters.length; for(let f=0;f<70&&_p3&&_p3.alive;f++) _p3.update(1/60); _t2e.dead=_p3?!_p3.alive:false; _t2e.wk=planeWrecks.length-_wk2e; _t2e.bld=planeWrecks.length>_wk2e?!!planeWrecks[planeWrecks.length-1].bld:false; _t2e.cr=runtimeCraters.length-_c2e; for(const w of planeWrecks.slice(_wk2e)) _rmWreck(w); clearTmpBoxes();");
ok(G('_t2e.dead')===true,'T2e-1 平飞撞楼机毁 (扫掠→die 全链, aircollide 同判据)');
ok(G('_t2e.wk===1')===true,'T2e-2 残骸恰好 +1');
ok(G('_t2e.bld')===true,'T2e-3 ★撞楼档从调用点入账 (wreck.bld=true) —— NEG N2 钉');
ok(G('_t2e.cr===0')===true,'T2e-4 撞面 5m 高 die 无地面弹坑');

// ══ T3 撞楼残骸全链: 侧面滑落 → 贴地无坑 → 收尾二次爆炸 (仍无坑) ══
console.log('T3 撞楼残骸: 滑落不悬浮 / 贴地无坑 / 二次爆炸');
G("clearTmpBoxes(); clearCorr(CF.x,CF.z-10,CF.x+40,CF.z+10); var face=CF.x+29.4; tmpBox(CF.x+30,CF.gh+3,CF.z,1.2,6,12); var w3=_mkWreck(face-1.0,CF.gh+4,CF.z,6,-2,0,true,0); _t3={stillFall:false,rest:false,y:-1,x:1e9,cr:0,boomKill:false,boomCr:0}; const _c2=runtimeCraters.length; for(let f=0;f<150;f++){ updatePlaneWrecks(1/60); if(f===12) _t3.stillFall=(w3.state==='fall'); if(w3.state==='rest') break; } _t3.rest=(w3.state==='rest'); _t3.y=w3.pos.y; _t3.x=w3.pos.x; _t3.cr=runtimeCraters.length-_c2; _t3.outside=(w3.pos.x<face); var _s3=null; for(const s of soldiers){ if(s.alive){ _s3=s; break; } } if(_s3){ _s3.pos.set(w3.pos.x-1.5,heightAt(w3.pos.x-1.5,w3.pos.z)+1,w3.pos.z); } w3.restT=0.01; updatePlaneWrecks(1/60); _t3.boomKill=_s3?!_s3.alive:false; _t3.boomCr=runtimeCraters.length-_c2; _t3.sinking=w3.sinking===true; _rmWreck(w3);");
ok(G('_t3.stillFall')===true,'T3a ★撞墙后仍处下落段 (state=fall, 不再贴墙悬浮迫降)');
ok(G('_t3.rest')===true,'T3b ★滑落至地面收尾 (state=rest)');
ok(G('Math.abs(_t3.y-(heightAt(_t3.x,_t3.x*0+CF.z)+0.45))<0.06')===true,'T3c ★贴地安放 (y='+G('_t3.y').toFixed(2)+' ≈ gh+0.45) —— 浮空病根修复');
ok(G('_t3.outside')===true,'T3d 未穿墙 (x='+G('_t3.x').toFixed(2)+' < 墙面 '+G('face')+')');
ok(G('_t3.cr===0')===true,'T3e ★撞楼残骸落地不炸不盖坑 (+'+G('_t3.cr')+')');
ok(G('_t3.boomKill')===true,'T3f ★restT 到点二次爆炸 (1.5m 兵阵亡)');
ok(G('_t3.boomCr===0')===true,'T3g ★二次爆炸仍无弹坑 (+'+G('_t3.boomCr')+') —— 撞楼全程无坑');
ok(G('_t3.sinking')===true,'T3h 二爆后进入消失段 (sinking)');

// ══ T3b 非撞楼对照: 坠地残骸照旧"触地一炸+弹坑" ══
console.log('T3b 坠地对照: 触地一炸+弹坑+贴地 (旧口径保留)');
G("clearTmpBoxes(); clearCorr(CF.x,CF.z-10,CF.x+40,CF.z+10); var w3b=_mkWreck(CF.x+15,CF.gh+6,CF.z,0,-1,0,false,0); _t3b={}; const _c3=runtimeCraters.length; for(let f=0;f<150;f++){ updatePlaneWrecks(1/60); if(w3b.state==='rest') break; } _t3b.rest=(w3b.state==='rest'); _t3b.y=w3b.pos.y; _t3b.cr=runtimeCraters.length-_c3; _rmWreck(w3b);");
ok(G('_t3b.rest')===true,'T3b-1 坠地残骸落地 (state=rest)');
ok(G('Math.abs(_t3b.y-(heightAt(CF.x+15,CF.z)+0.45))<0.06')===true,'T3b-2 贴地安放 (y='+G('_t3b.y').toFixed(2)+' ≈ 落点 gh+0.45)');
ok(G('_t3b.cr>=1')===true,'T3b-3 ★触地一炸+弹坑照旧 (+'+G('_t3b.cr')+') —— 用户令"坠毁在地上→出现爆炸坑"');

// ══ T3i 撞楼档开阔坠地对照 (无墙 involvement, NEG N5 亲见转红钉): 落地不炸不盖坑 ══
console.log('T3i 撞楼残骸开阔坠地: 无墙滑落干扰, 落地静默不盖坑');
G("clearTmpBoxes(); clearCorr(CF.x,CF.z-10,CF.x+40,CF.z+10); var w3i=_mkWreck(CF.x+15,CF.gh+6,CF.z,0,-1,0,true,0); _t3i={}; const _c3i=runtimeCraters.length; for(let f=0;f<150;f++){ updatePlaneWrecks(1/60); if(w3i.state==='rest') break; } _t3i.rest=(w3i.state==='rest'); _t3i.cr=runtimeCraters.length-_c3i; _rmWreck(w3i);");
ok(G('_t3i.rest')===true,'T3i-1 撞楼残骸开阔落地 (state=rest)');
ok(G('_t3i.cr===0')===true,'T3i-2 ★落地不炸不盖坑 (+'+G('_t3i.cr')+') —— NEG N5 钉 (落地坑门)');

// ══ T4 顶面命中: 贴楼顶安放 (onTop) ══
console.log('T4 顶面命中: 贴楼顶不悬浮');
G("clearTmpBoxes(); clearCorr(CF.x,CF.z-10,CF.x+40,CF.z+10); tmpBox(CF.x+30,CF.gh+3,CF.z,1.2,6,12); var top=CF.gh+6; var w4=_mkWreck(CF.x+30,top+4,CF.z,0,-9,0,false,2); _t4={}; const _c4=runtimeCraters.length; for(let f=0;f<120;f++){ updatePlaneWrecks(1/60); if(w4.state==='rest') break; } _t4.rest=(w4.state==='rest'); _t4.y=w4.pos.y; _t4.onTop=w4.onTop===true; _t4.cr=runtimeCraters.length-_c4; _t4.inxz=Math.abs(w4.pos.x-(CF.x+30))<4.5&&Math.abs(w4.pos.z-CF.z)<4.5; w4.restT=0.01; updatePlaneWrecks(1/60); _t4.gone=planeWrecks.indexOf(w4)<0; _t4.nosink=w4.sinking!==true; _t4.removed=!w4.m.parent; _rmWreck(w4);");
ok(G('_t4.rest')===true,'T4a 顶面命中转入静止 (state=rest)');
ok(G('Math.abs(_t4.y-(top+0.45))<0.06')===true,'T4b ★贴在楼顶 (y='+G('_t4.y').toFixed(2)+' ≈ 顶+0.45) —— "落在建筑上"');
ok(G('_t4.onTop')===true,'T4c onTop 档入账 (收尾二爆原地消失)');
ok(G('_t4.cr===0')===true,'T4d 楼顶迫降不隔空盖地面坑 (+'+G('_t4.cr')+')');
ok(G('_t4.inxz')===true,'T4e 迫降点在盒投影内');
ok(G('_t4.gone')===true,'T4f ★restT 到点当帧从残骸表摘除 (二令: 贴楼顶不再下沉)');
ok(G('_t4.nosink')===true,'T4g 不进入下沉段 (sinking 未置位) —— 二令钉');
ok(G('_t4.removed')===true,'T4h 网格当帧摘出场景 (原地消失)');

// ══ T5 炮弹对空: 击落敌机 / 友机豁免 ══
console.log('T5 坦克炮弹命中飞机');
G("clearTmpBoxes(); clearCorr(CF.x-40,CF.z-10,CF.x+40,CF.z+10); var PB=null,PF=null; for(const p of planes){ if(p.team!==player.team){ if(!PB) PB=p; } else if(!PF) PF=p; } if(PB){ PB.respawn(); PB.alive=true; PB.playerDriven=false; PB.crewBot=null; PB.pos.set(CF.x+20,CF.gh+15,CF.z); PB.pitch=0; PB.roll=0; PB.speed=0; } if(PF){ PF.respawn(); PF.alive=true; PF.playerDriven=false; PF.crewBot=null; PF.pos.set(CF.x+20,CF.gh+25,CF.z); PF.pitch=0; PF.roll=0; PF.speed=0; } _t5={}; const _wk5=planeWrecks.length, _c5=runtimeCraters.length, _sh5=shells.length; if(PB){ shells.push({pos:V3(CF.x-30,CF.gh+15,CF.z),vel:V3(SHELL_SPD,0,0),team:player.team,owner:player,life:3.6,kind:'tank',dmgV:520,trail:0,src:'探针坦克炮'}); for(let f=0;f<40&&shells.length>_sh5;f++) updateShells(1/60,1/60); } _t5.dead=!PB.alive; _t5.wk=planeWrecks.length-_wk5; _t5.shells=shells.length-_sh5; _t5.cr=runtimeCraters.length-_c5; if(PF){ shells.push({pos:V3(CF.x-30,CF.gh+25,CF.z),vel:V3(SHELL_SPD,0,0),team:player.team,owner:player,life:3.6,kind:'tank',dmgV:520,trail:0,src:'探针坦克炮'}); const _sh6=shells.length; for(let f=0;f<40&&shells.length>=_sh6;f++) updateShells(1/60,1/60); _t5.fAlive=PF.alive; _t5.fHp=PF.hp; _t5.fMax=PF.maxHp; _t5.fPass=(shells.length-_sh5)>=1; if(PF.alive){ PF.hp=PF.maxHp; } } while(shells.length>_sh5) shells.pop(); for(const w of planeWrecks.slice(_wk5)) _rmWreck(w);");
ok(G('_t5.dead')===true,'T5a ★坦克炮弹击落敌机 (alive=false, dmgV=520 vs hp'+G('PB?PB.maxHp:0')+')');
ok(G('_t5.wk>=1')===true,'T5b 击落走完整 die 链 (残骸 +'+G('_t5.wk')+')');
ok(G('_t5.shells===0')===true,'T5c 弹体命中即耗 (shells 回落 '+G('_t5.shells')+')');
ok(G('_t5.cr===0')===true,'T5d 半空击落不隔空盖地面坑 (+'+G('_t5.cr')+')');
ok(G('_t5.fAlive===true&&_t5.fHp===_t5.fMax')===true,'T5e ★友机豁免 (team 门: hp='+G('_t5.fHp')+'/'+G('_t5.fMax')+')');
ok(G('_t5.fPass===true')===true,'T5f 弹体穿过友机不耗 (与坦克/卡车同门)');

// ══ T6 调试模式冷却 bypass ══
console.log('T6 调试模式: 冷却读数中点「部署」直接部署');
G("clearTmpBoxes(); _t6={}; if(player.alive){} player.spectator=false; player.damage(999,null,false); setRespawnCd(8); el('deployBtn').onclick(); _t6.ctlAlive=player.alive; player.spectator=true; setRespawnCd(8); el('deployBtn').onclick(); _t6.dbgAlive=player.alive; _t6.deployed=player.deployed; _t6.cd=respawnCd; _t6.specUsed=player.specUsed===true;");
ok(G('_t6.ctlAlive===false')===true,'T6a ★非调试: 冷却中点击无反应 (alive='+G('_t6.ctlAlive')+')');
ok(G('_t6.dbgAlive===true&&_t6.deployed===true')===true,'T6b ★调试模式: 冷却中点击直接部署 (alive=true)');
ok(G('_t6.specUsed')===true,'T6c 部署走完整 deployPlayer 链 (观战局盖章 specUsed 落账)');
ok(G('_t6.cd===8')===true,'T6d ★冷却读数不受影响 (respawnCd='+G('_t6.cd')+' 照常在账, 逐帧递减不碰)');

// ══ T7 成就「利库德集团最好的飞行员」 ══
console.log('T7 成就: 驾机撞楼而亡');
G("_t7={}; try{ ACH.resetAll(); }catch(e){} player._achPilotBld=true; ACH.update(1); _t7.got=!!ACH.state().likud_pilot; _t7.def=ACH.defs.some(d=>d.id==='likud_pilot'); _t7.n=ACH.defs.length; _t7.cleared=player._achPilotBld===false;");
ok(G('_t7.def')===true,'T7a 成就表入册 (defs 含 likud_pilot, 共 '+G('_t7.n')+' 条)');
ok(G('_t7.got')===true,'T7b ★死亡边沿轮询解锁 (ACH_STATE.likud_pilot 落账)');
ok(G('_t7.cleared')===true,'T7c 普查字段读后即清 (不跨死亡误触发)');

// ══ T8 源码防回退锚 ══
console.log('T8 源码锚 (与 NEG 九补丁一一对应)');
const rd=f=>fs.readFileSync(path.join(root,f),'utf8');
const s16=rd('js/16-aircraft.js'), s08=rd('js/08-effects.js'), s15=rd('js/15-vehicles.js'), s22=rd('js/22-hud.js'), s24=rd('js/24-main.js'), s27=rd('js/27-achievements.js');
ok(s08.includes('if(!noCrater&&p.y-heightAt(p.x,p.z)<2.2) crater(p.x,p.z,rand(1.2,1.7),true,p.y);'),'T8 锚1 08-effects 弹坑高度门+noCrater 在位');
ok(s16.includes('die(attacker,crash,bld){')&&s16.includes('bld:!!bld, onTop:false,'),'T8 锚2 16-aircraft die 第三参+残骸分档字段在位');
ok(s16.includes('this.die(this.lastHitBy||null,true,true);')&&s16.includes('explosionFX(this.pos.clone(),!!bld);'),'T8 锚3 撞楼 die 调用+楼面无坑爆在位');
ok(s16.includes('w.pos.y=_plSwHit.y+0.45;')&&s16.includes('w.vel.set(-_plSwD.x*2.2,w.vel.y*0.45,-_plSwD.z*2.2);'),'T8 锚4 顶面贴楼+侧面滑落在位');
ok(s16.includes('if(!w.bld){')&&s16.includes('if(w.bld){')&&s16.includes('if(w.onTop){')&&s16.includes('depth:4.6'),'T8 锚5 落地坑门/二次爆炸/贴顶原地消失/沉深 4.6 在位');
ok(s15.includes("planeHitTest(s.pos,dir,hitD,s.team)")&&s15.includes('if(hitPl){ hitPl.takeDmg'),'T8 锚6 updateShells 对空判定+空中直击在位');
ok(s22.includes("if(!player.alive&&(player.spectator||player.specWillBe())) deployPlayer();"),'T8 锚7 22-hud 调试冷却 bypass 在位');
ok(s24.includes('btn.disabled=respawnCd>0&&!(player.spectator||player.specWillBe());'),'T8 锚8 24-main 冷却按钮放行在位');
// ★20261121c B#30 跟码: 自刎成就新增专用普查字段 _achNadeSelf 与 _achPilotBld 同行清账, 锚跟新合并行 (判据不变=撞楼普查字段不跨局携带)
ok(s27.includes("achUnlock('likud_pilot');")&&s27.includes("player._achPilotBld=false; player._achNadeSelf=false; }   // 撞楼/自刎普查字段不跨局携带"),'T8 锚9 成就判据+跨局清账在位');

console.log('');
console.log('通过 '+PASS.length+' / 失败 '+FAILN);
process.exit(FAILN?1:0);
