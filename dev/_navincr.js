// ─────────────────────────────────────────────
// dev/_navincr.js —— NAV 增量重烘焙 ≡ 全量重烘焙 等价性探针 (2026-11-21 P1-8 修复批恢复重写)
// 来历: 原版随 2026-09-26 性能批落地 (11 图 × 8 场景 = 88 组), 2026-11-01 工作区清理被删后一直缺位;
//       2026-11-21 审计 P1-8: bakeRegion ① 的格开放重算丢了 bakeGrid 的"四象限放宽"判据
//       (增量把"格心有杂物但格内有走廊"的格降级封锁 → 死袋局部复发, 下次全量又恢复, 随事件振荡),
//       修法 = 抽公共函数 bakeCellOpen 供两处共用。本探针恢复在册, 看护该等价性契约 (nav-occ-contract 第 5 条)。
// 用法: node dev/_navincr.js [--neg]
//   --neg = 阴性对照: 装载前把 bakeRegion ① 的格开放重算还原成旧写法 (只查格心), 同一批判据必须报红。
// 判据 (每个场景: 改动占用 → 增量烘焙 → 快照 → 全量烘焙 → 逐格比对):
//   ① open 全图逐格相等 (四象限判据两处同一份实现)
//   ② 四张边表 eH/eV/eD1/eD2 全图逐格相等
//   ③ 分量划分规范化后逐格相等 (编号不参与语义, 只比划分) + 增量侧不变量 comp≥0 ⟺ 开放格 + csize==分量实际格数
//   ④ 增量路径真实性: refresh 消费登记簇走 bakeRegion (fullBakes 不增, partBakes 增加) —— 不许静默退全量
// 场景: S1 走廊格 (格心被占·四象限≥3空, 判据的判别案例; 生产链 registerDynCollider→NAV.refresh→bakeRegion) /
//       S2 完全堵格 / S3 拆除还原 (killDynCollider 直写清格) / S4 合成 OCC 直写·象限阈值逐档 (q=4/3/2/1,
//       直调 bakeRegion vs bakeGrid, 同一 OCC.data 两侧比对) / S5 双远簇一次 refresh (簇级增量) /
//       S6 图缘格 (脏矩形越界钳制 + 整列直扫) / S7 端到端 refresh(true) 强制全量重建对照。
//       (场景里的"单圆柱"以 0.2m 点状 BOX 等价实现: OCC 是 1m 格点阵, 圆柱与同足迹盒烙出的占用格一致,
//        而圆柱没有直写登记链 —— 生产直写四路只对 BOX, 圆柱占用只在 buildOccupancy 重建时烙入。)
// 口径: 沙箱桩 = dev/_bootstub.js + dev/_bootpatch.js; 07-nav 内部表 (open/comp/bakeRegion/fullBakeGrid)
//       不在模块导出里, 按本仓惯例 (dev/verify-nav-20260926) 文本补一个 dbg 导出读它们
//       (对源码语义零改动; 正式文件里不留 dbg)。
// ─────────────────────────────────────────────
'use strict';
const path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const OK=[],BAD=[];
function assert(name,cond,detail){ (cond?OK:BAD).push(name); console.log(`  ${cond?'✓':'✗'} ${name}${detail?'  '+detail:''}`); }
function section(t){ console.log('\n══ '+t+' ══'); }
const LC=require('./_loadcache.js'); // 读盘 memo + vm.Script 编译缓存
const SRC=f=>LC.src(root,f);

const NEG=process.argv.includes('--neg');

// ── 07-nav 源码文本补丁: ①补 dbg 导出 ②(--neg) 还原 bakeRegion ① 旧写法 (只查格心, P1-8 旧病) ──
function navSource(){
let s=SRC('js/07-nav.js');
const anchor='return { findPath, blocked2D:';
if(s.indexOf(anchor)<0) throw new Error('07-nav 导出锚点未找到 (导出表被改过?)');
s=s.replace(anchor,'return { dbg:{open,eH,eV,eD1,eD2,N,SP,OFF,idx,comp,csize,fullBake:fullBakeGrid,bakeRegion,baked:()=>baked}, findPath, blocked2D:');
if(NEG){
const old='open[idx(i,j)]=bakeCellOpen(i,j);\n\t// ①b';
if(s.indexOf(old)<0) throw new Error('阴性对照锚点 bakeRegion① 未找到');
s=s.replace(old,'open[idx(i,j)]=occBlocked(i*SP-OFF,j*SP-OFF)?0:1;\n\t// ①b');
}
return s;
}
const NAVSRC=navSource();
let _navScr=null; const navScript=()=>_navScr||(_navScr=new vm.Script(NAVSRC,{filename:'js/07-nav.js'}));
const HEAD=['js/00-config.js','js/00b-i18n.js','js/00c-procgen.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js',
'js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js',
'js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js',
'js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/16-aircraft.js',
'js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js',
'js/22a-menuart.js','js/23-deploy.js','js/23b-worldrestore.js','js/25-zombies.js','js/24-main.js'];
const {sandbox,document,window}=require('./_bootstub.js');
require('./_bootpatch.js').patch(sandbox);
function boot(campIdx){
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document; ctx.window=window; ctx.globalThis=ctx;
ctx.location={search:'?seed=42',href:'http://localhost/index.html',hostname:'localhost',protocol:'http:'};
ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
ctx.console={log(){},warn(){},error(){}};
const errs=[];
for(const f of HEAD){
try{ (f==='js/07-nav.js'?navScript():LC.script(root,f)).runInContext(ctx); }
catch(e){ errs.push(f+': '+String(e&&e.message||e)); }
}
try{
const btn=document.getElementById('startBtn');
if(btn&&typeof btn.onclick==='function') vm.runInContext('document.getElementById("startBtn").onclick();',ctx);
}catch(e){ errs.push('startBtn: '+String(e&&e.message||e)); }
return {ctx,errs};
}
const E=(ctx,code,vars)=>{ if(vars) for(const k of Object.keys(vars)) ctx[k]=vars[k]; return vm.runInContext(code,ctx); };

// ── ctx 内安装场景助手 (一次性) ──
function installHelpers(ctx){
E(ctx,`globalThis.__occAt=function(u,v){ const Nn=OCC.N; return (u<0||v<0||u>=Nn||v>=Nn)?1:OCC.data[v*Nn+u]; };
globalThis.__H={
snap(){ const D=NAV.dbg; return {open:D.open.slice(),eH:D.eH.slice(),eV:D.eV.slice(),eD1:D.eD1.slice(),eD2:D.eD2.slice(),comp:D.comp.slice(),csize:D.csize.slice(),N:D.N,OFF:D.OFF,SP:D.SP}; },
full(){ NAV.dbg.fullBake(); },
region(i0,j0,i1,j1){ NAV.dbg.bakeRegion(i0,j0,i1,j1); },
refresh(){ NAV.refresh(); },
refreshFull(){ NAV.refresh(true); },
stats(){ const s=NAV.stats; return {fb:s.fullBakes,pb:s.partBakes,sb:s.skipBakes}; },
addDyn(x,z,w,d){ return registerDynCollider(x,heightAt(x,z)+1,z,w,2,d); },
killDyn(b){ killDynCollider(b); },
// 直写 OCC 单格 + occTouch 登记簇 —— 与 03-terrain 直写四路同一契约 (写 OCC.data + occTouch);
// touch 界取 [u0*res-off, u1*res-off] 使 floor/ceil 恰好盖住 [u0..u1] (occBlocked 用 round 取格)。
poke(u,v,val){ const Nn=OCC.N, off=OCC.off, res=OCC.res;
occTouch(u*res-off,v*res-off,u*res-off,v*res-off);
if(u>=0&&v>=0&&u<Nn&&v<Nn) OCC.data[v*Nn+u]=val; },
// 全图逐格比对 (增量快照 A vs 全量快照 B): open/四边表/分量划分规范化/不变量
cmp(A,B){
const NN=A.N*A.N, det=[];
let d=-1;
for(let k=0;k<NN;k++) if(A.open[k]!==B.open[k]){ d=k; break; }
if(d>=0) det.push('open@('+(d%A.N)+','+((d/A.N)|0)+')');
const en=['eH','eV','eD1','eD2'];
for(let t=0;t<4;t++){ const a=A[en[t]], b=B[en[t]]; d=-1;
for(let k=0;k<NN;k++) if(a[k]!==b[k]){ d=k; break; }
if(d>=0) det.push(en[t]+'@('+(d%A.N)+','+((d/A.N)|0)+')'); }
// 分量: 编号不参与语义, 按首现顺序规范化后逐格比划分
const canon=function(C){ const m={}; const out=new Int32Array(C.length); let nx=0;
for(let k=0;k<C.length;k++){ const g=C[k]; if(g<0){ out[k]=-1; continue; }
let c=m[g]; if(c===undefined){ c=nx++; m[g]=c; } out[k]=c; } return out; };
const ca=canon(A.comp), cb=canon(B.comp);
d=-1;
for(let k=0;k<NN;k++) if(ca[k]!==cb[k]){ d=k; break; }
if(d>=0) det.push('partition@('+(d%A.N)+','+((d/A.N)|0)+')');
// 增量侧不变量: comp≥0 ⟺ 开放格; csize==该分量实际格数
const cnt={};
for(let k=0;k<NN;k++){ const g=A.comp[k];
if((g>=0)!==(A.open[k]===1)){ det.push('invariant@('+(k%A.N)+','+((k/A.N)|0)+')'); break; }
if(g>=0) cnt[g]=(cnt[g]||0)+1; }
for(const g in cnt) if(A.csize[g]!==cnt[g]){ det.push('csize['+g+']='+A.csize[g]+'!='+cnt[g]); break; }
return {eq:det.length===0, det:det.slice(0,3).join(' ')};
},
// 事件回合 (生产链: 直写/killDyn → NAV.refresh 增量 → 增量快照 → 全量烘焙 → 比对)
eventRound(cell,mode){
const st0=__H.stats();
if(mode==='small') __H._last=__H.addDyn(cell.x+0.9,cell.z-0.9,0.2,0.2);
else if(mode==='wall') __H._last=__H.addDyn(cell.x,cell.z,5,5);
else if(mode==='kill') __H.killDyn(__H._last);
__H.refresh();
const st1=__H.stats();
const A=__H.snap(); __H.full(); const B=__H.snap();
const r=__H.cmp(A,B);
const q=__H.diagFree(cell);
return {eq:r.eq,det:r.det,q:q,cb:__occAt(cell.cu,cell.cv)>0,
open:NAV.dbg.open[NAV.dbg.idx(cell.i,cell.j)],pb:st1.pb-st0.pb,fb:st1.fb-st0.fb};
},
// 双远簇事件回合: 两格各自登记簇, 一次 refresh 消费 (簇级增量)
eventRound2(ca,cb,mode){
const st0=__H.stats();
if(mode==='small2'){ __H._lastA=__H.addDyn(ca.x+0.9,ca.z-0.9,0.2,0.2); __H._lastB=__H.addDyn(cb.x+0.9,cb.z-0.9,0.2,0.2); }
else if(mode==='kill2'){ __H.killDyn(__H._lastA); __H.killDyn(__H._lastB); }
__H.refresh();
const st1=__H.stats();
const A=__H.snap(); __H.full(); const B=__H.snap();
const r=__H.cmp(A,B);
const oa=NAV.dbg.open[NAV.dbg.idx(ca.i,ca.j)], ob=NAV.dbg.open[NAV.dbg.idx(cb.i,cb.j)];
return {eq:r.eq,det:r.det,q:Math.min(__H.diagFree(ca),__H.diagFree(cb)),
open:Math.min(oa,ob),cb:__occAt(ca.cu,ca.cv)>0&&__occAt(cb.cu,cb.cv)>0,
pb:st1.pb-st0.pb,fb:st1.fb-st0.fb};
},
// 端到端对照: 增量态快照 → refresh(true) 强制全量 (buildOccupancy 重建 + 全量烘焙) → 比对
endToEnd(){ const A=__H.snap(); __H.refreshFull(); const B=__H.snap(); return __H.cmp(A,B); },
// 合成 OCC 直写回合: cells=[[u,v,val],...] 逐格直写, rect=[i0,j0,i1,j1] 直调 bakeRegion (可空) → 全量 → 比对
pokeRound(cells,rect,cell){
for(let k=0;k<cells.length;k++) __H.poke(cells[k][0],cells[k][1],cells[k][2]);
if(rect) __H.region(rect[0],rect[1],rect[2],rect[3]);
const A=__H.snap(); __H.full(); const B=__H.snap();
const r=__H.cmp(A,B);
return {eq:r.eq,det:r.det,q:cell?__H.diagFree(cell):4,cell:cell,
open:cell?NAV.dbg.open[NAV.dbg.idx(cell.i,cell.j)]:1};
},
diagFree(cell){ const ds=[[-1,-1],[1,-1],[-1,1],[1,1]]; let n=0;
for(let t=0;t<4;t++) if(!__occAt(cell.cu+ds[t][0],cell.cv+ds[t][1])) n++;
return n; },
// 收集干净试验格: 自图心螺旋外扩; 13×13 OCC 邻域全空 + 离强制打通源 (NAV_CLEARS/旗/基地/集结/道路) 留距
// (留距原因: 这些圆在 buildOccupancy 重建时会把占用格清掉, 盒子放进去会破坏 S7 的重建一致性)
findCleanList(maxKeep,gap,margin){
const D=NAV.dbg, off=OCC.off, Nn=OCC.N;
const cls=(typeof NAV_CLEARS!=='undefined')?NAV_CLEARS:[];
const fl=(CAMPAIGN.flags||[]), bs=(CAMPAIGN.bases||[]), sp=(CAMPAIGN.spawns||[]), rd=(CAMPAIGN.roads||[]);
const far=function(x,z,r){
for(let t=0;t<cls.length;t++){ const c=cls[t]; if(Math.hypot(x-c.x,z-c.z)<c.r+r) return false; }
for(let t=0;t<fl.length;t++) if(Math.hypot(x-fl[t].x,z-fl[t].z)<fl[t].r+8+r) return false;
for(let t=0;t<bs.length;t++) if(Math.hypot(x-bs[t].x,z-bs[t].z)<26+r) return false;
for(let t=0;t<sp.length;t++) if(Math.hypot(x-sp[t].x,z-sp[t].z)<12+r) return false;
for(let t=0;t<rd.length;t++){ const r2=rd[t], dx=r2[2]-r2[0], dz=r2[3]-r2[1], L2=dx*dx+dz*dz||1e-9;
let u=((x-r2[0])*dx+(z-r2[1])*dz)/L2; u=u<0?0:(u>1?1:u);
if(Math.hypot(x-(r2[0]+dx*u),z-(r2[1]+dz*u))<9+r) return false; }
return true; };
const occFree=function(u0,v0,u1,v1){
for(let v=v0;v<=v1;v++)for(let u=u0;u<=u1;u++){
if(u<0||v<0||u>=Nn||v>=Nn) return false;
if(OCC.data[v*Nn+u]) return false; }
return true; };
const out=[];
const ci=(D.N/2)|0, cj=(D.N/2)|0;
for(let rr=0;rr<D.N&&out.length<maxKeep;rr++){
for(let djj=-rr;djj<=rr&&out.length<maxKeep;djj++)
for(let dii=-rr;dii<=rr&&out.length<maxKeep;dii++){
if(Math.max(Math.abs(dii),Math.abs(djj))!==rr) continue;
const i=ci+dii, j=cj+djj;
if(i<margin||j<margin||i>=D.N-margin||j>=D.N-margin) continue;
const x=i*D.SP-D.OFF, z=j*D.SP-D.OFF;
if(!far(x,z,6)) continue;
const cu=Math.round(x+off), cv=Math.round(z+off);
if(!occFree(cu-6,cv-6,cu+6,cv+6)) continue;
let near=false;
for(let t=0;t<out.length;t++) if(Math.abs(out[t].i-i)+Math.abs(out[t].j-j)<gap){ near=true; break; }
if(near) continue;
out.push({i:i,j:j,x:x,z:z,cu:cu,cv:cv});
}
}
return out;
},
// 图缘试验格: NAV 格 i∈{1,2,3,N-4,N-3,N-2}, 中心格当前为非硬占用 (0 空 / 2 水障均可 —— 海图边缘带
// 常是深水, 拨 1 前记原值 val0, 清账还原 val0 而不是 0); 先挑"四象限≥3空"的判别格, 退而求其次
findEdge(){
const D=NAV.dbg, off=OCC.off;
const cols=[1,2,3,D.N-4,D.N-3,D.N-2];
let fb=null;
for(let t=0;t<cols.length;t++){ const i=cols[t];
for(let j=0;j<D.N;j++){
const cu=Math.round(i*D.SP-D.OFF+off), cv=Math.round(j*D.SP-D.OFF+off);
const v0=__occAt(cu,cv);
if(v0===1) continue;
const c={i:i,j:j,cu:cu,cv:cv,x:i*D.SP-D.OFF,z:j*D.SP-D.OFF,val0:v0};
if(__H.diagFree(c)>=3) return c;
if(!fb) fb=c;
} }
return fb;
}
};`);
}

// ── 逐战役判据 ──
const probe0=boot(0); // 图0 只读尺寸用; 下方 ci=0 场景复用它
const campTotal=E(probe0.ctx,'CAMPAIGNS.length');
const sizes=E(probe0.ctx,'CAMPAIGNS.map(function(c){return c.mapSize||320;})');
const big=sizes.indexOf(Math.max.apply(null,sizes)); // 最大图 (覆盖另一档 N 值)
const camps=[...new Set([0,big])];
let bootErrs=[];

for(const ci of camps){
const {ctx,errs}=(ci===0?probe0:boot(ci));
if(errs.length) bootErrs=bootErrs.concat(errs.map(e=>`[图${ci}] `+e));
installHelpers(ctx);
const H=E(ctx,'globalThis.__H');
const title=E(ctx,'CAMPAIGNS['+ci+'].title')+' (MAP_SIZE '+sizes[ci]+')';
const label='图'+ci;
section(label+' '+title);
assert(label+' 沙箱装载零错误 ('+HEAD.length+' 文件)', errs.length===0, errs.slice(0,3).join(' | '));
assert(label+' NAV 烘焙就绪 (boot 后 baked=true)', E(ctx,'NAV.dbg.baked()')===true);

// 干净试验格 (确定性: 自图心螺旋外扩)
const L=H.findCleanList(24,12,7);
assert(label+' 干净试验格定位 (≥6 格)', L&&L.length>=6, L?('找到 '+L.length+' 格'):'无');

if(L&&L.length>=6){
// ── S1 走廊格: 0.2m 点状道具贴 NAV 格心象限角 ⇒ 格心格被占、四象限 3 空 (判据的判别案例) ──
{
const r=H.eventRound(L[0],'small');
assert(label+' S1 走廊格: 增量≡全量 (open/四边表/分量划分逐格)', r.eq, r.det);
assert(label+' S1 走廊格: 判别语义 (格心被占/象限'+r.q+'空⇒open=1) + 增量路径真实',
r.cb&&r.q>=3&&r.open===1&&r.fb===0&&r.pb>0,
`ΔpartBakes=${r.pb} ΔfullBakes=${r.fb}`+(NEG?' (旧写法应把此格判死 ⇒ 本条应红)':''));
}
// ── S2 完全堵格: 5×5 工事盖满整格 ⇒ 格心+四象限全占 ⇒ open=0 ──
{
const r=H.eventRound(L[1],'wall');
assert(label+' S2 完全堵格: 增量≡全量', r.eq, r.det);
assert(label+' S2 完全堵格: 判别语义 (象限'+r.q+'空⇒open=0) + 增量路径真实',
r.cb&&r.q===0&&r.open===0&&r.fb===0&&r.pb>0, `ΔpartBakes=${r.pb} ΔfullBakes=${r.fb}`);
}
// ── S3 拆除还原: killDynCollider 直写清格 ⇒ open 回 1 ──
{
const r=H.eventRound(L[1],'kill');
assert(label+' S3 拆除还原: 增量≡全量', r.eq, r.det);
assert(label+' S3 拆除还原: 判别语义 (清格后 open=1) + 增量路径真实',
!r.cb&&r.open===1&&r.fb===0&&r.pb>0, `ΔpartBakes=${r.pb} ΔfullBakes=${r.fb}`);
}
// ── S5 双远簇: 两处远距改动一次 refresh ⇒ 各自走 bakeRegion (簇级增量) ──
{
let pi=3,pj=4,pd=-1;
for(let a=3;a<L.length;a++)for(let b=a+1;b<L.length;b++){
const dd=Math.hypot(L[a].x-L[b].x,L[a].z-L[b].z);
if(dd>pd){ pd=dd; pi=a; pj=b; }
}
const pa=L[pi], pb2=L[pj];
const r=H.eventRound2(pa,pb2,'small2');
assert(label+' S5 双远簇落件: 增量≡全量', r.eq, r.det);
assert(label+' S5 双远簇落件: 两簇各自增量 (ΔpartBakes=2, 不并簇不退全量) + 语义 (open=1)',
r.eq&&r.cb&&r.q>=3&&r.open===1&&r.pb===2&&r.fb===0,
`间距 ${Math.round(pd)}m ΔpartBakes=${r.pb} ΔfullBakes=${r.fb}`);
const r2=H.eventRound2(pa,pb2,'kill2');
assert(label+' S5 双远簇拆除: 增量≡全量', r2.eq, r2.det);
assert(label+' S5 双远簇拆除: 两簇各自增量 + 清格后 open=1',
r2.open===1&&r2.pb===2&&r2.fb===0, `ΔpartBakes=${r2.pb} ΔfullBakes=${r2.fb}`);
}
// ── S7 端到端: 增量态 vs refresh(true) 强制全量 (buildOccupancy 重建 + bakeGrid) ──
{
const r=H.endToEnd();
assert(label+' S7 端到端: 增量态≡refresh(true) 强制全量 (直写契约与重建一致性收尾)', r.eq, r.det);
}
// ── S4 合成 OCC 直写·象限阈值逐档: 直调 bakeRegion vs 全量 bakeGrid (同一 OCC.data) ──
// 逐档拨象限格: q=4→3→2→1, open 期望 1/1/0/0 —— 阈值 q≥3 两处必须逐位一致 (P1-8 的判别核心)
{
const c=L[2];
const rect=[c.i-1,c.j-1,c.i+1,c.j+1];
const steps=[[[c.cu,c.cv,1],1],[[c.cu+1,c.cv+1,1],1],[[c.cu-1,c.cv+1,1],0],[[c.cu-1,c.cv-1,1],0]];
const names=['q=4 (仅格心)','q=3 (1象限被占)','q=2 (2象限被占)','q=1 (3象限被占)'];
for(let s=0;s<steps.length;s++){
const r=H.pokeRound([steps[s][0]],rect,c);
assert(label+' S4 象限阈值 '+names[s]+': bakeRegion≡bakeGrid + open='+steps[s][1],
r.eq&&r.open===steps[s][1], r.det);
}
const rc=H.pokeRound([[c.cu,c.cv,0],[c.cu+1,c.cv+1,0],[c.cu-1,c.cv+1,0],[c.cu-1,c.cv-1,0]],rect,c);
assert(label+' S4 清账还原: 直写清格后 open=1', rc.eq&&rc.open===1, rc.det);
}
// ── S6 图缘格: 脏矩形贴图缘 (bakeRegion 外扩钳到 [0,N-1]) + 整列直扫 ──
{
const e=H.findEdge();
assert(label+' S6 图缘试验格定位', !!e, e?('NAV 格 ('+e.i+','+e.j+')'):'边缘带全占 (环境几何)');
if(e){
const navN=E(ctx,'NAV.dbg.N');
const openBefore=E(ctx,'NAV.dbg.open[NAV.dbg.idx('+e.i+','+e.j+')]');
const rect=[e.i-1,e.j-1,e.i+1,e.j+1];
const r=H.pokeRound([[e.cu,e.cv,1]],rect,e);
assert(label+' S6 图缘格: 增量≡全量 + 象限判据 (q='+r.q+'⇒open='+(r.q>=3?1:0)+')',
r.eq&&r.open===((r.q>=3)?1:0), r.det);
const sx0=(e.i<navN/2)?0:(navN-4), sx1=(e.i<navN/2)?3:(navN-1);
const rs=H.pokeRound([],[sx0,0,sx1,navN-1],e);
assert(label+' S6 图缘整列直扫 (bakeRegion 大范围钳边): 增量≡全量', rs.eq, rs.det);
const rcl=H.pokeRound([[e.cu,e.cv,e.val0]],rect,e);
assert(label+' S6 图缘格清账还原 (水格还原 2)', rcl.eq&&rcl.open===openBefore, rcl.det);
}
}
}
}

section('汇总');
console.log(`\n${NEG?'【阴性对照】':'【正向】'} ✓ ${OK.length} / ✗ ${BAD.length}`);
const want = NEG ? BAD.length>0 : BAD.length===0;
if(NEG) console.log(want?'  阴性对照按预期报红 → 判据确实在测 bakeRegion① 的四象限判据':'  ⚠ 阴性对照没报红: 判据没测到修复点, 需要重写判据');
if(bootErrs.length) console.log('  装载错误: '+bootErrs.slice(0,3).join(' | '));
process.exit(want?0:1);
