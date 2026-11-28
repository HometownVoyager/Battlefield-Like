// ─────────────────────────────────────────────
// dev/verify-loiterarm-20261113.js —— 巡飞弹离膛武装批 (2026-11-13)
// 用法: node dev/verify-loiterarm-20261113.js [--neg]
// 病根: fireLoiter 出膛保护 grace:0.8 (秒) —— updateLoiters 未武装段完全跳过命中检测 ⇒
//   巡航 13m/s 下 ≈10m 无敌穿墙窗 (能隔着墙/沙袋/单位飞过, 用户实报"飞出去有一小段无敌时间能穿墙")。
//   该豁免本是修"坡地发射直接爆炸"(引信第一帧撞坡自爆) 的遗留。
// 改口径 (真实弹药"离膛武装距离", LOITER_ARM_DIST=3 单源 00-config):
//   ①命中检测逐帧照跑 (含未武装段): 未武装撞掩体/单位 = **哑弹撞毁** (引信未武装不引爆:
//     不炸不伤, 冒烟+提示条, 走 loiterDespawn 静默退场);
//   ②未武装段地形不引爆, 保留贴地爬升钳制 (坡地发射病根照旧护住); 武装后照旧碰炸/触地炸;
//   ③武装判定从时长改飞行米数 (与弹速无关: 加速 40m/s 不拉长豁免窗);
//   ④TV OSD 加速标 (tvBotL 后缀 ▸▸ 加速, 与 updateLoiters boost 同判据; 右键开镜 tvZoom 既有)。
// 判据: T1 未武装哑弹 (贴脸墙 1.1m: 静默退场/不过墙面/人友无伤/提示条/TV 视角收账);
//   T2 武装碰炸 (墙 6.5m: 炸+玩家自伤+侧前兵溅射阵亡); T3 未武装埋地不炸+贴地爬升 / 武装触地即炸;
//   T4 武装距离按米数 (巡航≈3m ★ / 加速≈3m 不变★); T5 观战哑弹同口径 (静默无提示条);
//   T6 到期退场 (life 账不受武装段影响); T7 TV OSD 加速标 (boost 有/无标 + 开镜 ZOOM 跟走);
//   T8 源码防回退锚 (与 NEG 六补丁一一对应)。
//   --neg: 六补丁累积注入, 判据必须转红 (红名↔补丁对认: N1→T1 无伤双红; N2→T1 退场/过墙双红;
//     N3→T4a/T4b 红; N4→T3a 红; N5→T3b 红; N6→T1 无伤+T4a 红; T8 锚 a1/a3~a7 各随其补丁红)。
// 沙箱要点承 verify-specneut-20261113 (boot/SRC/PATCH_MAP/真开局+deployPlayer/protUntil 清账);
//   CF 走廊/合成盒承 verify-aircollide-20261110 (addBoxCollider 即时注册 RGRID; tmpBox 逐盒回滚)。
//   ★G 串内探针全局一律裸名隐式全局 (与游戏 function/var 同一真全局; globalThis 前缀与裸名混读在本沙箱不可靠)。
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

// ── NEG 阴性对照: 六补丁累积注入 (正常跑不启用) ──
const NEG=process.argv.includes('--neg');
const SRC={},PATCH_MAP={};
const NEG_PATCHES=[
// N1 未武装哑弹改引爆 (退回"第一帧自爆"口径): T1 无伤双红
['js/13-combat.js',"showScorePop(t2('⚠ 巡飞弹未武装即撞毁 (离膛 {0}m 内不引爆)',LOITER_ARM_DIST));","loiterDetonate(d,V3(hx,hy,hz),hitTank,hitSol,hitPlane); return;"],
// N2 未武装恢复跳过静态体检测 (旧穿墙口径): T1 退场/过墙双红
['js/13-combat.js','const wr=raycastWorld(d.pos,dir,hitD);','const wr=d.grace>0?null:raycastWorld(d.pos,dir,hitD);'],
// N3 武装判定回退时长制: T4a/T4b 红
['js/13-combat.js','d.grace-=step;','d.grace-=ldt;'],
// N4 未武装贴地爬升钳制拆: T3a 红
['js/13-combat.js','if(d.pos.y<gh+0.35) d.pos.y=gh+0.35;','if(false) d.pos.y=gh+0.35;'],
// N5 武装触地即炸拆: T3b 红
['js/13-combat.js','loiterDetonate(d,V3(nx,heightAt(nx,nz)+0.3,nz)); return;',';'],
// N6 武装距离回退 0.8 (常量单源拆): T1 无伤红 + T4a 红 (墙 1.1m 处已武装 ⇒ 引爆)
['js/00-config.js','const LOITER_ARM_DIST=3;','const LOITER_ARM_DIST=0.8;'],
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
let IDX=3; { const c0=boot(0); IDX=vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="normandy")',c0); } // 诺曼底 (aircollide 同源: 开阔走廊, CF 搜索实证可命中)
const ctx=boot(IDX);
const G=s=>vm.runInContext(s,ctx);

let err0=null;
try{ G("document.getElementById('startBtn').onclick();"); }catch(e){ err0=String(e&&e.stack||e); }
if(!err0){ try{ G('if(!player.alive||!player.deployed) deployPlayer();'); }catch(e){ err0='deployPlayer: '+String(e&&e.stack||e); } }
if(err0||!G('player.alive')){ console.log('  ✘ 开局/部署失败 '+(err0||'player.alive=false')); process.exit(1); }
G('for(const s of soldiers) s.protUntil=0; player.protUntil=0;');
ok(G('soldiers.length')>0,'前置: 战场已开局并部署 (soldiers='+G('soldiers.length')+', player.alive='+G('player.alive')+')');
ok(html.includes("__sfStyleVer='20261128e'"),'前置: 版本戳 20261128e 在位 (index.html 内联)');

// ── 场地: CF 走廊 (承 aircollide 同式: 38m 直走廊, 无盒无柱地形平缓) + 摆件/净空/复位工具 ──
G("CF=null; { const R=MAP_SIZE/2-70; const tallBox=(x0,z0,x1,z1,gy)=>{ for(const b of BOXES){ if(b.dead) continue; if(b.maxX<x0||b.minX>x1||b.maxZ<z0||b.minZ>z1) continue; if(b.maxY>gy-0.4&&b.minY<gy+1.5) return true; } return false; }; const tallCyl=(x0,z0,x1,z1,gy)=>{ for(const c of CYLS){ if(c.dead||c.foliage) continue; if(c.x<x0-(c.r+1.5)||c.x>x1+(c.r+1.5)||c.z<z0-(c.r+1.5)||c.z>z1+(c.r+1.5)) continue; if(c.y1>gy-0.4&&c.y0<gy+1.5) return true; } return false; }; for(let z=-R;z<=R&&CF===null;z+=13)for(let x=-R;x<=R-44;x+=13){ const gh=heightAt(x,z); if(gh<1||gh>45) continue; if(occBlocked(x,z)) continue; let flat=true; for(let xx=x-4;xx<=x+40&&flat;xx+=3){ if(Math.abs(heightAt(xx,z)-gh)>2) flat=false; } if(!flat) continue; if(tallBox(x-6,z-6,x+40,z+6,gh+5)) continue; if(tallCyl(x-6,z-6,x+40,z+6,gh+5)) continue; CF={x:x,z:z,gh:gh}; break; } }");
ok(G('!!CF')===true,'场地: 空旷走廊已找到');
G("_tmpB=[]; tmpBox=(x,y,z,w,h,d)=>{ const b=addBoxCollider(x,y,z,w,h,d); _tmpB.push(b); return b; }; clearTmpBoxes=()=>{ while(_tmpB.length){ const b=_tmpB.pop(); const bi=BOXES.indexOf(b); if(bi>=0){ if(RGRID.boxCells){ const {cell,N,off}=RGRID; const i0=clamp(Math.floor((b.minX+off)/cell),0,N-1),i1=clamp(Math.floor((b.maxX+off)/cell),0,N-1),j0=clamp(Math.floor((b.minZ+off)/cell),0,N-1),j1=clamp(Math.floor((b.maxZ+off)/cell),0,N-1); for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){ const arr=RGRID.boxCells[j*N+i]; const k=arr.indexOf(bi); if(k>=0) arr.splice(k,1); } } BOXES.splice(bi,1); } } }; clearCorr=(x0,z0,x1,z1)=>{ const cx=clamp(x0-110,-140,140); for(const s of soldiers){ if(s.alive&&s.pos.x>x0-8&&s.pos.x<x1+8&&s.pos.z>z0-8&&s.pos.z<z1+8){ s.pos.set(cx,heightAt(cx,s.pos.z)+1,s.pos.z); } } for(const t of tanks){ if(t.alive&&t.pos.x>x0-12&&t.pos.x<x1+12&&t.pos.z>z0-12&&t.pos.z<z1+12){ t.pos.set(cx,heightAt(cx,t.pos.z),t.pos.z); } } for(const t of trucks){ if(t.alive&&t.pos.x>x0-12&&t.pos.x<x1+12&&t.pos.z>z0-12&&t.pos.z<z1+12){ t.pos.set(cx-10,heightAt(cx-10,t.pos.z),t.pos.z); } } for(const p of planes){ if(p.alive&&p.pos.x>x0-12&&p.pos.x<x1+12&&p.pos.z>z0-12&&p.pos.z<z1+12){ p.pos.set(cx,120,p.pos.z); p.speed=0; } } }; _toCorr=()=>{ if(!player.alive||!player.deployed) deployPlayer(); player.protUntil=0; player.pos.set(CF.x,heightAt(CF.x,CF.z)+1.5,CF.z); player.vel.set(0,0,0); player.yaw=-Math.PI/2; player.pitch=0; player.spectator=false; }; _fire=(ox,oy,oz)=>{ const d=fireLoiter(player,V3(ox,oy,oz),V3(1,0,0)); return !!d; };");
ok(G('player.loiter')===null&&G('!!tmpBox')===true,'场地: 探针工具就绪 (弹道 +x, 起点走廊原点)');

// ══ T1 未武装哑弹: 贴脸墙 1.1m (武装窗 3m 内) ══
console.log('T1 未武装哑弹 (撞掩体不炸不穿)');
G("clearTmpBoxes(); clearCorr(CF.x,CF.z-8,CF.x+12,CF.z+8); tmpBox(CF.x+2.6,CF.gh+3,CF.z,1.2,6,12); _toCorr(); _t1s=(soldiers.filter(s=>s.alive)[0]||null); if(_t1s){ _t1s.pos.set(CF.x+6,heightAt(CF.x+6,CF.z+3),CF.z+3); } _t1={desp:false,f:-1,maxDx:0,o:CF.x+0.9}; if(_fire(CF.x+0.9,CF.gh+1.4,CF.z)){ for(let i=0;i<40;i++){ if(!player.loiter){ _t1.desp=true; _t1.f=i; break; } const dx=player.loiter.pos.x-_t1.o; if(dx>_t1.maxDx) _t1.maxDx=dx; updateLoiters(1/60,1/60); } }");
ok(G('_t1.desp')===true,'T1 ★未武装撞墙=哑弹静默退场 (frame='+G('_t1.f')+')');
ok(G('_t1.maxDx<1.2')===true,'T1 ★弹体未穿过墙面 (maxDx='+G('_t1.maxDx').toFixed(2)+'m < 墙面 1.1m)');
ok(G('player.alive')===true&&G('player.hp')===100,'T1 ★玩家无自伤 (哑弹不炸: hp='+G('player.hp')+')');
ok(G('!_t1s||_t1s.alive')===true,'T1 侧后兵无伤 (溅射未发生)');
ok(G("(document.getElementById('scorePop').textContent||'').indexOf('未武装即撞毁')>=0")===true,'T1 哑弹提示条在位 (scorePop)');
ok(G("document.getElementById('tvOv').style.display")==='none','T1 TV 视角已收 (tvOv 隐)');
ok(G('VM.root.visible')===true,'T1 一人称模型还原 (VM.root)');

// ══ T2 武装碰炸: 墙面 6.5m (> 武装 3m) ══
console.log('T2 武装撞墙照常引爆');
G("clearTmpBoxes(); clearCorr(CF.x,CF.z-8,CF.x+14,CF.z+8); tmpBox(CF.x+8.0,CF.gh+3,CF.z,1.2,6,12); _toCorr(); _t2s=(soldiers.filter(s=>s.alive)[0]||null); if(_t2s){ _t2s.pos.set(CF.x+5.5,heightAt(CF.x+5.5,CF.z+2.5),CF.z+2.5); } _t2={dead:false}; if(_fire(CF.x+0.9,CF.gh+1.4,CF.z)){ _t2.d=player.loiter; for(let i=0;i<70;i++){ if(!player.loiter) break; updateLoiters(1/60,1/60); } _t2.dead=_t2.d.dead; }");
ok(G('_t2.dead')===true,'T2 ★武装撞墙引爆 (弹体 dead 账)');
ok(G('player.hp<100||!player.alive')===true,'T2 ★自伤在账 (爆点 7.4m 在溅射半径 9.5 内: hp='+G('player.hp')+')');
ok(G('!!_t2s&&!_t2s.alive')===true,'T2 ★侧前兵吃溅射阵亡 (伤害链在, 爆点 3.2m)');

// ══ T3 未武装地形不炸+贴地爬升 / 武装触地即炸 ══
console.log('T3 地形口径: 未武装爬升护罩 + 武装触地炸');
G("clearTmpBoxes(); clearCorr(CF.x,CF.z-8,CF.x+8,CF.z+8); _toCorr(); _t3={a:false,b:false,f:false,loit1:false,dead1:false,y1:0,gh1:0}; _t3.f=_fire(CF.x+0.9,CF.gh+1.4,CF.z); if(_t3.f){ const d=player.loiter; d.pos.y=heightAt(d.pos.x,d.pos.z)+0.05; updateLoiters(1/60,1/60); _t3.loit1=!!player.loiter; _t3.dead1=!!d.dead; _t3.y1=d.pos.y; _t3.gh1=heightAt(d.pos.x,d.pos.z); _t3.a=!!player.loiter&&!d.dead&&(d.pos.y>=heightAt(d.pos.x,d.pos.z)+0.349); if(player.loiter){ d.grace=0; d.pos.y=heightAt(d.pos.x,d.pos.z)+0.05; updateLoiters(1/60,1/60); _t3.b=d.dead; } }");
ok(G('_t3.a')===true,'T3a ★未武装埋地不炸+贴地爬升 (loit1='+G('_t3.loit1')+' dead1='+G('_t3.dead1')+' y1='+G('_t3.y1').toFixed(2)+' gh1='+G('_t3.gh1').toFixed(2)+')');
ok(G('_t3.b')===true,'T3b ★武装触地即炸 (口径保留)');

// ══ T4 武装距离按米数 (与弹速无关) ══
console.log('T4 离膛武装距离 = 飞行米数制');
G("clearTmpBoxes(); clearCorr(CF.x,CF.z-8,CF.x+44,CF.z+8); _toCorr(); _t4a={dist:-1}; if(_fire(CF.x+0.9,CF.gh+1.4,CF.z)){ const d=player.loiter; const x0=d.pos.x, z0=d.pos.z; for(let i=0;i<300;i++){ if(!player.loiter) break; if(d.grace<=0){ _t4a.dist=Math.hypot(d.pos.x-x0,d.pos.z-z0); break; } updateLoiters(1/60,1/60); } if(player.loiter){ player.loiter.life=0.01; updateLoiters(1/60,1/60); } }");
ok(G('_t4a.dist>=2.4&&_t4a.dist<=3.6')===true,'T4a ★巡航武装距离≈LOITER_ARM_DIST=3 (dist='+G('_t4a.dist').toFixed(2)+'m)');
G("clearTmpBoxes(); clearCorr(CF.x,CF.z-8,CF.x+44,CF.z+8); _toCorr(); _t4b={dist:-1}; if(_fire(CF.x+0.9,CF.gh+1.4,CF.z)){ const d=player.loiter; const x0=d.pos.x, z0=d.pos.z; keys.Space=true; for(let i=0;i<300;i++){ if(!player.loiter) break; if(d.grace<=0){ _t4b.dist=Math.hypot(d.pos.x-x0,d.pos.z-z0); break; } updateLoiters(1/60,1/60); } keys.Space=false; if(player.loiter){ player.loiter.life=0.01; updateLoiters(1/60,1/60); } }");
ok(G('_t4b.dist>=2.4&&_t4b.dist<=3.6')===true,'T4b ★加速下武装距离不变 (米数制, 旧时长制 0.8s×40m/s≈32m 会红: dist='+G('_t4b.dist').toFixed(2)+'m)');

// ══ T5 观战哑弹同口径: 静默消失, 无提示条 ══
console.log('T5 观战哑弹 (静默退场口径)');
G("clearTmpBoxes(); clearCorr(CF.x,CF.z-8,CF.x+12,CF.z+8); tmpBox(CF.x+2.6,CF.gh+3,CF.z,1.2,6,12); _toCorr(); document.getElementById('scorePop').textContent=''; player.spectator=true; _t5={desp:false}; if(_fire(CF.x+0.9,CF.gh+1.4,CF.z)){ for(let i=0;i<20;i++){ if(!player.loiter){ _t5.desp=true; break; } updateLoiters(1/60,1/60); } } player.spectator=false;");
ok(G('_t5.desp')===true,'T5 ★观战未武装撞墙同样退场 (哑弹=观战触物同口径)');
ok(G('player.alive')===true,'T5 观战退场无爆炸无伤');
ok(G("(document.getElementById('scorePop').textContent||'').indexOf('撞毁')<0")===true,'T5 观战静默 (无哑弹提示条)');

// ══ T6 到期退场: life 账不受武装段影响 ══
console.log('T6 生命周期到期照常退场');
G("clearTmpBoxes(); _toCorr(); _t6={dead:false}; if(_fire(CF.x+0.9,CF.gh+1.4,CF.z)){ const d=player.loiter; d.life=0.01; updateLoiters(1/60,1/60); _t6.dead=d.dead; }");
ok(G('_t6.dead')===true,'T6 life 到期照常引爆退场 (OOB/life 分支不受武装段门影响)');

// ══ T7 TV OSD 加速标 / 开镜 ZOOM 标 ══
console.log('T7 TV OSD: 加速标 (boost) + 开镜 ZOOM 跟走');
G("clearTmpBoxes(); _toCorr(); _t7={b:false,n:false,z:false}; if(_fire(CF.x+0.9,CF.gh+1.4,CF.z)){ keys.Space=true; updateHUD(1/60,1/60); _t7.b=(document.getElementById('tvBotL').textContent||'').indexOf('加速')>=0; keys.Space=false; updateHUD(1/60,1/60); _t7.n=(document.getElementById('tvBotL').textContent||'').indexOf('加速')<0; mouse2Down=true; player._ltRClick=false; updateHUD(1/60,1/60); _t7.z=document.getElementById('tvZoom').style.display==='block'; mouse2Down=false; }");
ok(G('_t7.b')===true,'T7 ★TV OSD 加速标 (boost 时 tvBotL 后缀 ▸▸ 加速)');
ok(G('_t7.n')===true,'T7 未加速无标 (收账干净)');
ok(G('_t7.z')===true,'T7 右键开镜 ZOOM 标 (2026-11-10 OSD 批既有口径跟走)');

// ══ T8 源码防回退锚 ══
console.log('T8 源码防回退锚 (与 NEG 六补丁一一对应)');
{
const s13=srcOf('js/13-combat.js'),s00=srcOf('js/00-config.js'),s22=srcOf('js/22-hud.js'),s00b=srcOf('js/00b-i18n.js');
ok(s00.includes('const LOITER_ARM_DIST=3;'),'T8 锚1 00-config LOITER_ARM_DIST=3 单源在位');
ok(s13.includes('grace:LOITER_ARM_DIST'),'T8 锚2 fireLoiter 出膛账=武装距离 (旧 0.8 绝迹)');
ok(s13.includes("showScorePop(t2('⚠ 巡飞弹未武装即撞毁 (离膛 {0}m 内不引爆)',LOITER_ARM_DIST));"),'T8 锚3 13-combat 哑弹提示条在位 (N1)');
ok(s13.includes('const wr=raycastWorld(d.pos,dir,hitD);'),'T8 锚4 13-combat 命中检测逐帧无条件在位 (N2)');
ok(s13.includes('d.grace-=step;'),'T8 锚5 13-combat 武装判定按飞行米数 (N3)');
ok(s13.includes('if(d.pos.y<gh+0.35) d.pos.y=gh+0.35;'),'T8 锚6 13-combat 未武装贴地爬升钳制在位 (N4)');
ok(s13.includes('loiterDetonate(d,V3(nx,heightAt(nx,nz)+0.3,nz)); return;'),'T8 锚7 13-combat 武装触地即炸在位 (N5)');
ok(s13.includes('离膛武装批'),'T8 锚8 13-combat 批注在位');
ok(s00b.includes("'⚠ 巡飞弹未武装即撞毁 (离膛 {0}m 内不引爆)':"),'T8 锚9 i18n 哑弹提示词条在位');
ok(s00b.includes("'加速':'BOOST'"),'T8 锚10 i18n 加速标词条在位');
ok(s22.includes("const boost=(keys.Space&&!player._ltSpace);")&&s22.includes("(boost?' ▸▸ '+t2('加速'):'')"),'T8 锚11 22-hud TV OSD 加速标在位 (2026-11-14 跟码: frameperf 批②把三元式抽 const boost, 判据拆两半钉)');
}

console.log('────');
console.log('通过 '+PASS.length+' 项, 失败 '+FAILN+' 项'+(NEG?' (阴性对照: 有红=判据具备分辨力)':''));
if(FAILN){ process.exitCode=1; }
else if(NEG){ console.log('✗ 阴性对照全绿 = 判据空转!'); process.exitCode=1; }
