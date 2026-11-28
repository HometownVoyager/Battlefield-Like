// ─────────────────────────────────────────────
// dev/verify-corpsepos-cover-20261125.js —— 2026-11-25 实机两症状批:
//   ① 死亡动画"就地倒下"时地图中心出现姿态诡异的尸体 (车毁 Bot 的 mesh.root 一直在原点)
//   ② 爆炸伤害经过墙等障碍时没有缩减 (载具/舰艇圈穿墙满伤)
// 用法: node dev/verify-corpsepos-cover-20261125.js [--neg]
// 判据:
//   T0 源码锚: 14-bots 尸体 x/z 同步行 / 13-combat explosionCoverMul 单源 + 五处接线 / 15d-naval 舰艇接线
//   T1 车毁乘员尸体落点: 取一辆有 crewBot 的坦克, 把车开到远离原点处, 车毁 → 乘员 die →
//      mesh.root.position.x/z 必须贴近死亡点 (误差 <0.5m), 而非留在原点 (改前恒 0)
//   T2 爆炸遮挡 (步兵): 借 verify-fixbatch ②-g 同款墙, 开阔 vs 隔墙伤害比 ≈0.25
//   T3 爆炸遮挡 (坦克): 墙两侧各摆一辆坦克, 同参数 splashDamage, 隔墙伤害显著低于开阔
//   --neg (两补丁): N1 拆尸体 x/z 同步行 → T1 红; N2 拆 explosionCoverMul 返回值 → T2/T3 红
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

// ── NEG 阴性对照: 两补丁 ──
const NEG=process.argv.includes('--neg');
const SRC={},PATCH_MAP={};
const NEG_PATCHES=[
// N1 尸体 x/z 同步行拆: 回到旧 "position.y=..." 单行写法 ⇒ T1 红
['js/14-bots.js','this.mesh.root.position.set(this.pos.x,this.pos.y+pEff*Math.cos(th)*(1-Math.cos(th))*1.05,this.pos.z);','this.mesh.root.position.y=this.pos.y+pEff*Math.cos(th)*(1-Math.cos(th))*1.05;'],
// N2 遮挡单源返回值拆: 全目标无衰减 ⇒ T2/T3 红
['js/13-combat.js','return (block&&block.dist<dist-0.5)?0.25:1;','return 1;'],
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
ok(html.includes("__sfStyleVer='20261128b'"),'前置: 版本戳 20261128b 在位 (index.html 内联)');

// ══ T0 源码锚 ══
console.log('T0 源码锚');
const src14=srcOf('js/14-bots.js'),src13=srcOf('js/13-combat.js'),src15d=srcOf('js/15d-naval.js');
ok(src14.includes('this.mesh.root.position.set(this.pos.x,this.pos.y+pEff*Math.cos(th)*(1-Math.cos(th))*1.05,this.pos.z);')===true,'T0a ★尸体落点 x/z 同步行 verbatim (14-bots 倒地段)');
ok(src13.includes('function explosionCoverMul(p,tx,ty,tz,d){')===true,'T0b ★explosionCoverMul 遮挡单源函数在位 (13-combat)');
ok(src13.includes('return (block&&block.dist<dist-0.5)?0.25:1;')===true,'T0c ★遮挡 ×0.25 判定行 verbatim');
ok((src13.match(/explosionCoverMul\(p,/g)||[]).length>=5,'T0d ★步兵/坦克/卡车/飞机五圈均接遮挡单源 (13-combat 5 处调用) + naval 1 处另锚');
ok(src15d.includes("const cover=(typeof explosionCoverMul==='function')?explosionCoverMul(p,n.pos.x,n.pos.y+1,n.pos.z,d):1;")===true,'T0e ★舰艇溅射接线 verbatim (15d-naval)');

// ══ T1 车毁乘员尸体落点 ══
console.log('T1 车毁乘员尸体落点 (改前恒在地图中心 0,0)');
G('__t1={};');
G(`(()=>{
const t=tanks.find(x=>x&&x.alive)||tanks[0];
if(!t){ __t1.err='无坦克'; return; }
// 找一辆有 crewBot 的坦克 (开局部署的车组)
let v=t, cb=t.crewBot;
if(!cb){ for(const q of tanks){ if(q.crewBot){ v=q; cb=q.crewBot; break; } } }
if(!cb){ __t1.err='无 crewBot'; return; }
// 把车搬到远离原点的位置, 让车毁落点显著非零
const px=90, pz=-75, gy=heightAt(px,pz);
v.pos.set(px,gy,pz); cb.pos.copy(v.pos); cb.mesh.root.position.set(0,0,0);
v.hp=0; __t1.callErr=null;
try{ v.die(null); for(let i=0;i<5;i++) cb.update(0.0167); }catch(e){ __t1.callErr=String(e&&e.stack||e).split('\\n')[0]; }
__t1.deadPos={x:+cb.pos.x.toFixed(1),z:+cb.pos.z.toFixed(1)};
__t1.meshPos={x:+cb.mesh.root.position.x.toFixed(1),z:+cb.mesh.root.position.z.toFixed(1)};
})()`);
if(G('!!__t1.err')||G('!!__t1.callErr')){ ok(false,'T1-prep 车毁失败 '+(G('__t1.err')||G('__t1.callErr'))); }
else{
const dx=G('Math.abs(__t1.meshPos.x-__t1.deadPos.x)'), dz=G('Math.abs(__t1.meshPos.z-__t1.deadPos.z)');
ok(dx<0.5&&dz<0.5,`T1 ★尸体落在死亡点附近: mesh(${G('__t1.meshPos.x')},${G('__t1.meshPos.z')}) vs 死亡点(${G('__t1.deadPos.x')},${G('__t1.deadPos.z')}) 偏差<0.5m (改前 mesh 恒 0,0)`);
}

// ══ T2/T3 爆炸遮挡 ══
console.log('T2/T3 爆炸遮挡: 步兵 + 坦克 (开阔 vs 隔墙)');
G('__cover={};');
G(`(()=>{
// 挑一面够高够厚的墙, 且一侧通视
let pick=null;
for(const b of BOXES){
 if(!b||(b.maxY-b.minY)<1.4||(b.maxX-b.minX)<0.5) continue;
 const cx=(b.minX+b.maxX)/2, cz=(b.minZ+b.maxZ)/2, hw=(b.maxX-b.minX)/2, fy=b.minY;
 for(const sgn of [1,-1]){
  const blastX=cx+sgn*(hw+0.8), soldX=cx+sgn*(hw+3.0);
  const dir=V3(soldX-blastX,0.45,0), dd=dir.length(); dir.normalize();
  const blk=raycastWorld(V3(blastX,fy+0.2,cz),dir,dd);
  if(!blk){ pick={cx,cz,hw,fy,sgn}; break; }
 }
 if(pick) break;
}
if(!pick){ __cover.err='找不到通视墙'; return; }
const {cx,cz,hw,fy,sgn}=pick;
const s=soldiers.find(x=>x&&!x.onVehicle)||soldiers[0];
const runSol=(blastX,soldX)=>{
 s.alive=true; s.onVehicle=null; s.team=1; s.hp=100;
 s.pos.set(soldX,fy,cz);
 splashDamage(V3(blastX,fy+0.2,cz),null,-1,9,30,0);
 return +(100-s.hp).toFixed(1);
};
__cover.solOpen=runSol(cx+sgn*(hw+0.8),cx+sgn*(hw+3.0));
__cover.solBlock=runSol(cx-sgn*(hw+0.8),cx-sgn*(hw+3.0));
// 坦克: 同款墙, 用 splashDamage 的 tank 圈
const t=tanks.find(x=>x&&x.alive)||tanks[0];
const runTank=(blastX,tankX)=>{
 t.alive=true; t.team=1; t.hp=t.maxHp; t.pos.set(tankX,fy+1,cz);
 splashDamage(V3(blastX,fy+0.2,cz),null,-1,9,0,300,true,'shell');
 return +(t.maxHp-t.hp).toFixed(1);
};
__cover.tankOpen=runTank(cx+sgn*(hw+0.8),cx+sgn*(hw+3.0));
__cover.tankBlock=runTank(cx-sgn*(hw+0.8),cx-sgn*(hw+3.0));
})()`);
if(G('!!__cover.err')){ ok(false,'T2-prep 失败 '+G('__cover.err')); }
else{
const so=G('__cover.solOpen'), sb=G('__cover.solBlock'), to=G('__cover.tankOpen'), tb=G('__cover.tankBlock');
ok(so>0&&sb>0&&sb<so*0.5,`T2 ★步兵隔墙伤害显著低于开阔: ${sb} vs ${so} (比 ${(sb/so).toFixed(2)})`);
ok(to>0&&tb>0&&tb<to*0.5,`T3 ★坦克隔墙伤害显著低于开阔: ${tb} vs ${to} (比 ${(tb/to).toFixed(2)}) (改前穿墙满伤)`);
}

console.log('');
console.log('verify-corpsepos-cover-20261125: PASS='+PASS.length+' FAIL='+FAILN+(NEG?' (--neg)':''));
if(NEG){
console.log('[阴性对照] 期望红 '+FAILN+' 项 (N1→T1, N2→T2/T3)');
process.exitCode=1;
}else if(FAILN>0) process.exit(1);
