// ─────────────────────────────────────────────
// dev/verify-tiltfall-20261121.js —— 2026-11-21 实机两症状批: 教堂旁坦克垂直姿态 × 蹲姿"就地倒下"不彻底
// 用法: node dev/verify-tiltfall-20261121.js [--neg]
// 判据:
//   T0 源码锚: _tsCylCb 悬空竖直闸两行 (gh memo + y1-gh>TANK_STEP) / 倒地块 fallK 行 / 展腿块首行 /
//      spawn·spawnInVehicle 两处 _deathLegs 清账 —— 全 verbatim。
//   T1 教堂尖顶 (斯大林格勒): 尖顶分带圆柱 (r3.5 基档, 采样半径 r+1.5=5m) 采样点 tankSurfH-地形 ≤1.35
//      —— 改前 12.29 (12.14-(-0.15), 悬空顶面 12.14 入悬挂账 ⇒ tgtP=-68.7°/真坦克 suspP 收敛 67°)。
//   T2 水塔锥顶 (斯大林格勒): 同上 (r1.7 档, 顶面 g0+8.5) —— 同一闸通杀。
//   T3 对照组: 合成贴地矮圆柱 (r0.8, 自身 1.1m) 照常入悬挂账 (闸不过杀, 可跨越障碍语义保留)。
//   T4 真坦克端到端: 塔旁 4.5m 车头朝塔 90 帧 update, |suspP|<0.2rad (改前 1.17rad=67°) 且 pos.y 不飞起
//      (tankRideH baseY 频带既有保护, 车+姿态两账分立)。
//   T5 就地倒下终态 (sf_deathfx=1): 蹲姿死=满倒 |rot|≈HPI + 展腿 knee→0.06 + 骨盆 0.14 + 尸体贴地
//      (root.y-pos.y≈0); 站姿死基准 |rot|≈HPI/骨盆 0.14 不变; 趴姿死 0.18 瘫倒档 |rot|≈16.2° 不变
//      (趴姿躯干已水平, root 再转 90°=头朝下插地, A#10 原判据成立)。
//   --neg (三补丁独立可辨, 红名↔补丁): N1 竖直闸拆→T1/T2 红 / N2 fallK 回退 0.55→T5 蹲姿角红 (膝仍展=
//      与 N3 可辨) / N3 展腿块拆→T5 蹲姿膝红 (角仍满倒=与 N2 可辨)。
// 沙箱要点承 verify-conecollide-20261115 (boot/SRC/PATCH_MAP/真开局+deployPlayer)。
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

// ── NEG 阴性对照: 三补丁 (正常跑不启用; 三支互不遮蔽: N1 动 15-vehicles, N2/N3 动 14-bots 不同行) ──
const NEG=process.argv.includes('--neg');
const SRC={},PATCH_MAP={};
const NEG_PATCHES=[
// N1 悬空竖直闸拆: T1/T2 悬空顶面重回悬挂账 (教堂尖顶 12.14 / 水塔 8.5)
['js/15-vehicles.js','if(c.y1-c.gh>TANK_STEP) return;',';'],
// N2 蹲姿缩幅回退 (9-21 旧裁定 0.55): T5 蹲姿 rot≈49.5° ≠ 满倒
['js/14-bots.js','const fallK=this.prone?0.18:1;','const fallK=this.prone?0.18:this.crouch?0.55:1;'],
// N3 蹲姿展腿块拆: T5 蹲姿 rot 仍满倒 (与 N2 可辨) 但 knee 冻在蹲姿角 2.03
// (★14-bots.js 是 CRLF 文件, NEG 锚一律单行 —— 多行 \n 锚永不命中, 本批实测)
['js/14-bots.js','if(_dfU){','if(false&&_dfU){'],
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
ctx.document=stub.document; ctx.window=stub.window; ctx.CANNON=CANNON;
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
ok(html.includes("__sfStyleVer='20261121a'"),'前置: 版本戳 20261121a 在位 (index.html 内联)');

// ══ T0 源码锚 ══
console.log('T0 源码锚');
const src15=srcOf('js/15-vehicles.js'),src14=srcOf('js/14-bots.js');
ok(src15.includes('if(c.gh===undefined) c.gh=heightAt(c.x,c.z);')===true,'T0a ★_tsCylCb 悬空竖直闸 gh memo 行 verbatim (15-vehicles)');
ok(src15.includes('if(c.y1-c.gh>TANK_STEP) return;')===true,'T0b ★_tsCylCb 顶面-脚下地形 >TANK_STEP 不入悬挂账 行 verbatim');
ok(src14.includes('const fallK=this.prone?0.18:1;')===true,'T0c ★倒地块 fallK 行 verbatim (蹲姿不再 0.55 缩幅, 14-bots)');
ok(src14.includes('if(!this._deathLegs) this._deathLegs={hl:this.mesh.legL.hip.rotation.x,kl:this.mesh.legL.knee.rotation.x,hr:this.mesh.legR.hip.rotation.x,kr:this.mesh.legR.knee.rotation.x};')===true,'T0d 蹲姿展腿首帧捕获行 verbatim');
ok((src14.match(/this\._deathLegs=null;/g)||[]).length===2,'T0e spawn/spawnInVehicle 两处 _deathLegs 跨命清账');

// ══ T1/T2 悬空顶饰不入悬挂账 (斯大林格勒: 教堂旗+水塔旗双地标) ══
console.log('T1/T2 教堂尖顶 + 水塔锥顶: tankSurfH 回地面账');
G('_sp=CYLS.filter(c=>c.noNav&&Math.abs(c.r-3.5)<0.01)[0]; _spTop=Math.max.apply(null,CYLS.filter(c=>c.noNav&&Math.hypot(c.x-_sp.x,c.z-_sp.z)<1).map(c=>c.y1));');
ok(G('!!_sp')===true,'T1-prep 教堂尖顶基档圆柱 (r3.5, noNav) 在册 (承 verify-conecollide T3)');
G('_s1=tankSurfH(_sp.x+2.1,_sp.z)-heightAt(_sp.x+2.1,_sp.z);');
ok(G('_s1')<=1.35,'T1 ★尖顶采样点 (塔心 2.1m < 基档采样半径 5m) tankSurfH-地形='+G('_s1').toFixed(2)+' ≤1.35 (改前 12.29 = 12.14 顶面-(-0.15) 地形 ⇒ tgtP=-68.7°)');
G('_wt=CYLS.filter(c=>c.noNav&&Math.abs(c.r-1.7)<0.01)[0];');
G('_s2=tankSurfH(_wt.x+1.0,_wt.z)-heightAt(_wt.x+1.0,_wt.z);');
ok(G('!!_wt')===true,'T2-prep 水塔锥顶档圆柱 (r1.7, noNav) 在册 (承 verify-conecollide T5)');
ok(G('_s2')<=1.35,'T2 ★水塔锥顶采样点 tankSurfH-地形='+G('_s2').toFixed(2)+' ≤1.35 (改前其顶面 g0+8.5 入账)');

// ══ T3 对照组: 贴地矮圆柱照常入账 ══
console.log('T3 对照组: 合成贴地矮圆柱 (可跨越语义保留)');
G("_ctl=null; { const R=300; outer: for(let z=-R;z<=R;z+=7)for(let x=-R;x<=R;x+=7){ const gh=heightAt(x,z); if(gh<-2||gh>60) continue; if(Math.abs(tankSurfH(x,z)-gh)>1e-6) continue; let flat=true; for(let dx=-3;dx<=3;dx+=3)for(let dz=-3;dz<=3;dz+=3){ if(Math.abs(heightAt(x+dx,z+dz)-gh)>0.8) flat=false; } if(!flat) continue; _ctl={x:x,z:z,gh:gh}; break outer; } }");
ok(G('!!_ctl')===true,'T3-prep 干净平地已找到 (tankSurfH==heightAt 且 7×7 平坦)');
G("_ci=CYLS.push({x:_ctl.x,z:_ctl.z,r:0.8,y0:_ctl.gh,y1:_ctl.gh+1.1})-1; window.RGRID_OFF=1; _s3=tankSurfH(_ctl.x,_ctl.z)-_ctl.gh; delete window.RGRID_OFF;");
// ★运行期 CYLS.push 不入 RGRID.cylCells 索引 (只有开局建场期入) ⇒ 对照组采样走 RGRID_OFF 全表扫路径, 与闸无关
ok(Math.abs(G('_s3')-1.1)<=0.05,'T3 ★贴地矮圆柱 (自身 1.1m ≤TANK_STEP) 顶面照常入悬挂账 (实得 +'+G('_s3').toFixed(2)+', 改前改后同值 = 闸不过杀)');
G('CYLS.splice(_ci,1);');

// ══ T4 真坦克端到端 ══
console.log('T4 真坦克: 塔旁 4.5m 朝塔 90 帧');
G("_gh0=heightAt(_sp.x+4.5,_sp.z); _tk=new Tank(0,0); _tkErr=null;");
G("_tk.pos.set(_sp.x+4.5,_gh0,_sp.z); _tk.yaw=Math.PI/2; _tk.vel=0;");
G("try{ for(let i=0;i<90;i++) _tk.update(0.0167); }catch(e){ _tkErr=String(e&&e.stack||e).split('\\n')[0]; }");
ok(G('_tkErr')===null,'T4a Tank.update 90 帧无异常'+(G('_tkErr')?(' ('+G('_tkErr')+')'):''));
ok(Math.abs(G('_tk.suspP'))<0.2,'T4b ★悬挂俯仰 |suspP|='+(Math.abs(G('_tk.suspP'))*180/Math.PI).toFixed(1)+'° <11.5° (改前 67.0°)');
ok(Math.abs(G('_tk.pos.y')-G('_gh0'))<1.3,'T4c 车不飞起: pos.y-地形='+(G('_tk.pos.y')-G('_gh0')).toFixed(2)+' <1.3 (tankRideH baseY 频带既有保护)');

// ══ T5 就地倒下终态 ══
console.log('T5 就地倒下 (蹲姿满倒+展腿 / 站姿基准 / 趴姿 0.18 档)');
G("_bC=null,_bS=null,_bP=null; for(const s of soldiers){ if(!s.alive||s.onVehicle||s===player) continue; if(!_bC) _bC=s; else if(!_bS) _bS=s; else if(!_bP) _bP=s; }");
ok(G('!!_bC&&!!_bS&&!!_bP')===true,'T5-prep 三名步战 Bot 已取得');
G("_bC.crouch=true; _bC.prone=false; for(let i=0;i<90;i++) _bC.updateMesh(0.0167,0); _pre={pv:+_bC.mesh.pelvis.position.y.toFixed(2)};");
ok(Math.abs(G('_pre.pv')-0.6)<0.05,'T5-prep 蹲姿收敛 pelvis='+G('_pre.pv')+' ≈0.6');
G("_bC.die(null,false); for(let i=0;i<50;i++) _bC.update(0.0167); _oC={rot:+_bC.mesh.root.rotation.x.toFixed(3),kn:+_bC.mesh.legL.knee.rotation.x.toFixed(3),pv:+_bC.mesh.pelvis.position.y.toFixed(3),dy:+(_bC.mesh.root.position.y-_bC.pos.y).toFixed(3)};");
ok(Math.abs(Math.abs(G('_oC.rot'))-1.5708)<0.03,'T5a ★蹲姿死满倒 |rot|='+(Math.abs(G('_oC.rot'))*180/Math.PI).toFixed(1)+'° ≈90° (改前 49.5° 锐角冻结)');
ok(Math.abs(G('_oC.kn')-0.06)<0.02,'T5b ★蹲姿展腿 knee='+G('_oC.kn')+' ≈0.06 直腿 (改前冻在蹲姿 2.03)');
ok(Math.abs(G('_oC.pv')-0.14)<0.02,'T5c 蹲姿骨盆 '+G('_oC.pv')+' ≈0.14 (与站姿尸体同款贴地)');
ok(Math.abs(G('_oC.dy'))<0.05,'T5d 尸体贴地: root.y-pos.y='+G('_oC.dy')+' ≈0 (残余抬升式两端归零)');
G("_bS.crouch=false; _bS.prone=false; for(let i=0;i<90;i++) _bS.updateMesh(0.0167,0); _bS.die(null,false); for(let i=0;i<50;i++) _bS.update(0.0167); _oS={rot:+_bS.mesh.root.rotation.x.toFixed(3),pv:+_bS.mesh.pelvis.position.y.toFixed(3)};");
ok(Math.abs(Math.abs(G('_oS.rot'))-1.5708)<0.03,'T5e 站姿死基准不变 |rot|='+(Math.abs(G('_oS.rot'))*180/Math.PI).toFixed(1)+'° ≈90°');
ok(Math.abs(G('_oS.pv')-0.14)<0.02,'T5f 站姿骨盆 '+G('_oS.pv')+' ≈0.14 不变');
G("_bP.crouch=false; _bP.prone=true; for(let i=0;i<90;i++) _bP.updateMesh(0.0167,0); _bP.die(null,false); for(let i=0;i<50;i++) _bP.update(0.0167); _oP={rot:+_bP.mesh.root.rotation.x.toFixed(3),pv:+_bP.mesh.pelvis.position.y.toFixed(3)};");
ok(Math.abs(Math.abs(G('_oP.rot'))-0.283)<0.03,'T5g 趴姿 0.18 瘫倒档不变 |rot|='+(Math.abs(G('_oP.rot'))*180/Math.PI).toFixed(1)+'° ≈16.2° (A#10: root 再转 90°=头朝下插地)');
ok(Math.abs(G('_oP.pv')-0.21)<0.03,'T5h 趴姿骨盆 '+G('_oP.pv')+' ≈0.21 不变 (本体已贴地)');

console.log('');
console.log('verify-tiltfall-20261121: PASS='+PASS.length+' FAIL='+FAILN+(NEG?' (--neg)':''));
if(NEG){
console.log('[阴性对照] 期望红 '+FAILN+' 项 (红=判据具备分辨力; N1→T1/T2, N2→T5a, N3→T5b; T5a 与 T5b 互补可辨)');
console.log('[阴性对照] 定向绿: T3 对照组 (闸拆后仍绿=非过杀) / T5e-h 站姿趴姿档 (N2/N3 后仍绿=仅蹲姿分支受影响)');
process.exitCode=1;   // 阴性模式固定退出码 1 (与 melee/ragdoll2 同款口径)
}else if(FAILN>0) process.exit(1);
