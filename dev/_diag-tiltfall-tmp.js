// ─────────────────────────────────────────────
// dev/_diag-tiltfall-tmp.js —— 2026-11-21 实机两症状定罪沙箱 (临时诊断工具)
// 症状① 坦克在教堂旁总变成垂直姿态 (截图: 幽灵坦克车头上翘 ~75°)
// 症状② "就地倒下"档蹲姿死亡只倒 ~50° 冻在锐角
// 用法: node dev/_diag-tiltfall-tmp.js
// 沙箱要点承 verify-conecollide-20261115 (boot/SRC/真开局+deployPlayer)。
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

function boot(campIdx){
for(const k in stub.byId)delete stub.byId[k];
const ctx=vm.createContext(Object.assign({},stub.sandbox));
ctx.document=stub.document; ctx.window=stub.window; ctx.CANNON=CANNON;
ctx.localStorage={_s:{sf_campaign:String(campIdx),sf_deathfx:'1'},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of FILES) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
return ctx;
}
let IDX=1; { const c0=boot(0); IDX=vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="stalingrad")',c0); }
const ctx=boot(IDX);
const G=s=>vm.runInContext(s,ctx);
console.log('战役: '+G('CAMPAIGN.id')+' / deathFallMode='+G('deathFallMode()'));
let err0=null;
try{ G("document.getElementById('startBtn').onclick();"); }catch(e){ err0=String(e&&e.stack||e); }
if(!err0){ try{ G('if(!player.alive||!player.deployed) deployPlayer();'); }catch(e){ err0='deployPlayer: '+String(e&&e.stack||e); } }
if(err0||!G('player.alive')){ console.log('✘ 开局/部署失败 '+(err0||'player.alive=false')); process.exit(1); }

// ══ 症状①: 教堂钟塔尖顶分层圆柱 × tankSurfH ══
G(`
_spire=CYLS.filter(c=>c.noNav&&Math.abs(c.r-3.5)<0.01)[0];
_bands=CYLS.filter(c=>c.noNav&&Math.hypot(c.x-_spire.x,c.z-_spire.z)<1).map(c=>({r:c.r,y0:+c.y0.toFixed(2),y1:+c.y1.toFixed(2),band:+(c.y1-c.y0).toFixed(2)}));
_top=Math.max.apply(null,_bands.map(b=>b.y1));
// 坦克停在钟塔外墙 4.5m 处, 车头朝塔: 前采样点 = 塔心 2.1m (基档采样半径 r+1.5=5.0m 之内)
_tx=_spire.x+4.5, _tz=_spire.z;
_hF=tankSurfH(_tx-2.4,_tz), _hB=tankSurfH(_tx+2.4,_tz);
_gh=heightAt(_tx,_tz);
_tgtP=-Math.atan2(_hF-_hB,4.8);
_prof=[0.5,1.5,2.1,2.4,3.0].map(d=>+tankSurfH(_spire.x+d,_spire.z).toFixed(2));
// 真坦克端到端: 90 帧 update 看 suspP 收敛到哪
_tk=new Tank(0,0); _tkErr=null;
_tk.pos.set(_tx,_gh,_tz); _tk.yaw=Math.PI/2; _tk.vel=0;
try{ for(let i=0;i<90;i++) _tk.update(0.0167); }catch(e){ _tkErr=String(e&&e.stack||e).split('\\n')[0]; }
_suspP=_tk.suspP; _tkY=_tk.pos.y;
`);
const prof=G('_prof'), spire=G('_spire'), bands=G('_bands'), top=G('_top'), hF=G('_hF'), hB=G('_hB'), gh=G('_gh'), tgtP=G('_tgtP'), suspP=G('_suspP'), tkY=G('_tkY'), tkErr=G('_tkErr');
const DEG=180/Math.PI;
console.log('── 症状① 教堂钟塔 ('+spire.x.toFixed(1)+','+spire.z.toFixed(1)+') ──');
console.log('  尖顶分带圆柱: '+JSON.stringify(bands)+'  顶面 y1='+top.toFixed(2)+' (塔脚地形 '+gh.toFixed(2)+')');
console.log('  坦克@4.5m 朝塔: hF(前采样)='+hF.toFixed(2)+'  hB(后采样)='+hB.toFixed(2)+'  ⇒ tgtP='+(tgtP*DEG).toFixed(1)+'°');
console.log('  采样剖面(距塔心 0.5/1.5/2.1/2.4/3.0m): '+prof.join(' / '));
console.log('  真坦克 90 帧后: suspP='+(suspP*DEG).toFixed(1)+'°  pos.y='+tkY.toFixed(2)+' (地形 '+gh.toFixed(2)+', 不飞起但姿态炸) '+(tkErr?('update异常: '+tkErr):''));

// ══ 症状②: 蹲姿"就地倒下"终态 ══
G(`
_b=soldiers.find(s=>s.alive&&!s.onVehicle&&s!==player);
_b.crouch=true; _b.prone=false;
for(let i=0;i<90;i++) _b.updateMesh(0.0167,0);   // 蹲姿收敛 (绕开 AI, 只驱动姿态机)
_pre={pelvis:+_b.mesh.pelvis.position.y.toFixed(3),knee:+_b.mesh.legL.knee.rotation.x.toFixed(3),hip:+_b.mesh.legL.hip.rotation.x.toFixed(3)};
_b.die(null,false);
for(let i=0;i<50;i++) _b.update(0.0167);          // 0.84s > 0.6s 动画窗
_post={rot:+_b.mesh.root.rotation.x.toFixed(3),pelvis:+_b.mesh.pelvis.position.y.toFixed(3),knee:+_b.mesh.legL.knee.rotation.x.toFixed(3),hip:+_b.mesh.legL.hip.rotation.x.toFixed(3)};
// 站姿对照 + 趴姿对照
_b2=soldiers.find(s=>s.alive&&!s.onVehicle&&s!==player&&s!==_b);
_b2.crouch=false; _b2.prone=false;
for(let i=0;i<90;i++) _b2.updateMesh(0.0167,0);
_b2.die(null,false);
for(let i=0;i<50;i++) _b2.update(0.0167);
_stand={rot:+_b2.mesh.root.rotation.x.toFixed(3),pelvis:+_b2.mesh.pelvis.position.y.toFixed(3),knee:+_b2.mesh.legL.knee.rotation.x.toFixed(3)};
_b3=soldiers.find(s=>s.alive&&!s.onVehicle&&s!==player&&s!==_b&&s!==_b2);
_b3.crouch=false; _b3.prone=true;
for(let i=0;i<90;i++) _b3.updateMesh(0.0167,0);
_b3.die(null,false);
for(let i=0;i<50;i++) _b3.update(0.0167);
_prone={rot:+_b3.mesh.root.rotation.x.toFixed(3),pelvis:+_b3.mesh.pelvis.position.y.toFixed(3),knee:+_b3.mesh.legL.knee.rotation.x.toFixed(3)};
`);
const pre=G('_pre'), post=G('_post'), stand=G('_stand'), prone=G('_prone');
console.log('── 症状② 就地倒下终态 (0.84s 后) ──');
console.log('  蹲姿: 倒地前 '+JSON.stringify(pre)+'  →  死后 root.rotation.x='+(post.rot*DEG).toFixed(1)+'° (满倒=-90°)  pelvis='+post.pelvis+'  knee='+post.knee+'  hip='+post.hip);
console.log('  站姿: root.rotation.x='+(stand.rot*DEG).toFixed(1)+'°  pelvis='+stand.pelvis+'  knee='+stand.knee+'  (既有基准)');
console.log('  趴姿: root.rotation.x='+(prone.rot*DEG).toFixed(1)+'°  pelvis='+prone.pelvis+'  knee='+prone.knee+'  (A#10 0.18 小幅瘫倒档)');
console.log('── 尖顶圆柱若通不过 _tsCylCb 过滤 (症状①真值): tankSurfH@塔心2.1m 应≈'+top.toFixed(2)+' ──');
