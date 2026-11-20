// ─────────────────────────────────────────────
// dev/verify-conecollide-20261115.js —— 锥体碰撞批 × 教堂侧楼修形 (2026-11-15)
// 用法: node dev/verify-conecollide-20261115.js [--neg]
// 判据:
//   T1 国会大厦穹顶碰撞: 7 档分层近似圆柱 (noNav:1) —— 漏斗段带面半径 (6.9/3.1/4.5/5.9) +
//      顶针三档 (2.4/1.5/0.6), 全部 noNav (高空饰件, 地面那格要走人)。
//   T2 OCC 烘焙豁免行为测试: 悬空 noNav 圆柱 (y0=gh+8) 不得把地面那格标记为阻挡;
//      去掉标记后同一点必须被标记 (对照组) —— 证 noNav 门真的在烘焙循环里生效。
//   T3 教堂尖顶: 45° 转位 (ry+HPI*1.5, 锥面平边对墙) + 加大 (r4.2 平边半宽 2.97 > 墙 2.72,
//      对角 4.2 > 檐口半对角 3.82 = 全覆盖) + 三档碰撞 (3.5/2.2/0.8) — 斯大林格勒 (有教堂旗) 行为可见。
//   T4 钟塔接缝: 底层墙 h 7.05→7.2 (4 面) —— 旧版 7.05~7.2 一圈 15cm 内凹沟缝横贯塔身; 源码不再有 h:7.05。
//   T5 水塔锥顶两档碰撞 (1.7@7.8~8.5 / 0.6@8.5~9.2) — 斯大林格勒 (有水塔旗) 行为可见。
//   T6 源码防回退锚 (烘焙 skip 行 / 尖顶锥体行 / 分层表 / 穹顶 7 行 / 水塔 2 行)。
//   --neg: N1 烘焙豁免拆 (T2a) / N2 穹顶漏斗底档拆 (T1b) / N3 尖顶转位拆 (T6c)。
// 沙箱要点承 verify-airfix-20261114 (boot/SRC/PATCH_MAP/真开局+deployPlayer)。
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

// ── NEG 阴性对照: 三补丁累积注入 (正常跑不启用) ──
const NEG=process.argv.includes('--neg');
const SRC={},PATCH_MAP={};
const NEG_PATCHES=[
// N1 烘焙豁免拆 (noNav 门摘除): T2a 悬空 noNav 圆柱把地面那格标红
['js/03-terrain.js','if(c.r<0.28||c.noNav) continue;','if(c.r<0.28) continue;'],
// N2 穹顶漏斗底档拆: T1b r6.9 档缺失
['js/05a-buildings.js','CYLS.push({x:dp[0],z:dp[1],r:6.9,y0:dy0+5.0,y1:dy0+5.4,noNav:1});',';'],
// N3 尖顶转位拆 (45° 回退): T6c 锚红
['js/05a-buildings.js','cp[1],ry+HPI*1.5);','cp[1],ry+HPI);'],
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
let IDXB=2,IDXS=1; { const c0=boot(0); IDXB=vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="berlin")',c0); IDXS=vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="stalingrad")',c0); }
const ctx=boot(IDXB);
const G=s=>vm.runInContext(s,ctx);
let err0=null;
try{ G("document.getElementById('startBtn').onclick();"); }catch(e){ err0=String(e&&e.stack||e); }
if(!err0){ try{ G('if(!player.alive||!player.deployed) deployPlayer();'); }catch(e){ err0='deployPlayer: '+String(e&&e.stack||e); } }
if(err0||!G('player.alive')){ console.log('  ✘ 开局/部署失败 '+(err0||'player.alive=false')); process.exit(1); }
ok(html.includes("__sfStyleVer='20261120c'"),'前置: 版本戳 20261120c 在位 (index.html 内联)');

// ══ T1 国会大厦穹顶 7 档碰撞 (柏林) ══
console.log('T1 国会穹顶: 漏斗段带面半径 + 顶针三档, 全 noNav');
G('_nn=CYLS.filter(c=>c.noNav);');
ok(G('_nn.length')>=7,'T1a ★noNav 圆柱总数 ≥7 (柏林: 穹顶 7 档'+(G('_nn.length')>=7?'':' 实得 '+G('_nn.length'))+')');
ok(G('_nn.some(c=>Math.abs(c.r-6.9)<0.01)&&_nn.some(c=>Math.abs(c.r-3.1)<0.01)')===true,'T1b ★漏斗底档 r6.9 (y 跨 0.4) 与收腰 r3.1 在册');
ok(G('_nn.some(c=>Math.abs(c.r-4.5)<0.01)&&_nn.some(c=>Math.abs(c.r-5.9)<0.01)')===true,'T1c 漏斗展开档 r4.5 / r5.9 在册');
ok(G('_nn.some(c=>Math.abs(c.r-0.6)<0.01&&Math.abs((c.y1-c.y0)-0.8)<0.02)')===true,'T1d 顶针尖档 r0.6 (跨 0.8) 在册 —— 穹顶最高点有碰撞');

// ══ T2 OCC 烘焙豁免行为测试 ══
console.log('T2 OCC 烘焙: noNav 悬空柱不占地面格 / 对照组去标记占格');
G("_spot=null; _nFree=0; { const R=MAP_SIZE/2-50; outer: for(let z=-R;z<=R;z+=5)for(let x=-R;x<=R;x+=5){ const gh=heightAt(x,z); if(gh<0||gh>60) continue; if(occBlocked(x,z)) continue; _nFree++; let flat=true; for(let dx=-2;dx<=2;dx+=2)for(let dz=-2;dz<=2;dz+=2){ if(Math.abs(heightAt(x+dx,z+dz)-gh)>1.5) flat=false; } if(!flat) continue; _spot={x:x,z:z,gh:gh}; break outer; } }");
ok(G('!!_spot')===true,'T2-prep 干净空地已找到 (非阻挡格 '+G('_nFree')+' 个)');
G("_test=CYLS.push({x:_spot.x,z:_spot.z,r:1.5,y0:_spot.gh+8,y1:_spot.gh+9,noNav:1})-1; NAV.refresh(true); _occ1=occBlocked(_spot.x,_spot.z); delete CYLS[_test].noNav; NAV.refresh(true); _occ2=occBlocked(_spot.x,_spot.z);");
ok(G('_occ1')===false,'T2a ★悬空 noNav 圆柱 (y0=gh+8) 不把地面那格标阻挡 (bake skip 生效)');
ok(G('_occ2')===true,'T2b 对照: 同一柱去掉 noNav → 地面格被标阻挡 (说明 T2a 不是天然绿)');
G("CYLS.splice(_test,1); NAV.refresh(true);");

// ══ T3/T5 教堂尖顶 + 水塔锥顶 (斯大林格勒: 教堂旗+水塔旗双地标) ══
const ctxS=boot(IDXS);
const GS=s=>vm.runInContext(s,ctxS);
let errS=null;
try{ GS("document.getElementById('startBtn').onclick();"); }catch(e){ errS=String(e&&e.stack||e); }
if(!errS){ try{ GS('if(!player.alive||!player.deployed) deployPlayer();'); }catch(e){ errS='deployPlayer: '+String(e&&e.stack||e); } }
if(errS||!GS('player.alive')){ console.log('  ✘ 斯大林格勒开局失败 '+errS); process.exit(1); }
console.log('T3/T5 斯大林格勒: 尖顶三档 + 水塔锥顶两档');
GS('_nn=CYLS.filter(c=>c.noNav);');
ok(GS('_nn.some(c=>Math.abs(c.r-3.5)<0.01)&&_nn.some(c=>Math.abs(c.r-2.2)<0.01)&&_nn.some(c=>Math.abs(c.r-0.8)<0.01)')===true,'T3 ★教堂尖顶三档碰撞 (3.5/2.2/0.8) 在册 —— 尖顶=可挡可站不穿');
ok(GS('_nn.some(c=>Math.abs(c.r-1.7)<0.01)&&_nn.some(c=>Math.abs(c.r-0.6)<0.01)')===true,'T5 水塔锥顶两档碰撞 (1.7/0.6) 在册');

// ══ T4/T6 源码防回退锚 ══
console.log('T4/T6 源码锚');
const src05a=srcOf('js/05a-buildings.js'),src05c=srcOf('js/05c-layouts.js'),src03=srcOf('js/03-terrain.js');
ok((src05a.match(/h:7\.2,/g)||[]).length>=4,'T4a 钟塔底层墙 4 面全部 h:7.2 (接缝 7.05~7.2 沟缝消除)');
ok(!/h:7\.05[,)]/.test(src05a),'T4b 源码不再有 h:7.05 (旧写法绝迹)');
ok(src05a.includes('mesh(new THREE.ConeGeometry(4.2,3.4,4),MAT.woodDark,cp[0],tf.floor+tH+2.1,cp[1],ry+HPI*1.5);')===true,'T6a ★尖顶锥体 r4.2/45° 转位锚 verbatim');
ok(src05a.includes('for(const [cr,c0,c1] of [[3.5,0.4,1.5],[2.2,1.5,2.5],[0.8,2.5,3.8]])')===true,'T6b 尖顶分层碰撞表锚 verbatim');
ok(src05a.includes('CYLS.push({x:dp[0],z:dp[1],r:6.9,y0:dy0+5.0,y1:dy0+5.4,noNav:1});')===true,'T6c ★穹顶漏斗底档锚 verbatim');
ok((src05a.match(/dy0\+.*noNav:1/g)||[]).length>=7,'T6d 穹顶 7 档 noNav 圆柱全部在册');
ok(src05c.includes('CYLS.push({x,z,r:1.7,y0:g0+7.8,y1:g0+8.5,noNav:1});')===true,'T6e 水塔锥顶两档锚 verbatim');
ok(src03.includes('if(c.r<0.28||c.noNav) continue;')===true,'T6f ★烘焙 skip 行锚 verbatim (03-terrain)');

console.log('');
console.log('verify-conecollide-20261115: PASS='+PASS.length+' FAIL='+FAILN+(NEG?' (--neg)':''));
if(FAILN>0) process.exit(1);
