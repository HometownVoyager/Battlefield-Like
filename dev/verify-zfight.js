// ─────────────────────────────────────────────
// dev/verify-zfight.js —— WS4「栈桥显示 BUG + 系统性图层打架」沙箱 (不进 Index.html)
// 用法: node dev/verify-zfight.js
// 背景 (2026-09-21 海战图 7 项优化 · 第 5 项):
//   ① heightAt 在桥矩形内把地形抬到 deckY (03-terrain:678-681), 桥面结构盒**顶面也正好是 deckY**
//      ⇒ 两块独立三角化的不透明面位相同一 Y 共面 = z-fighting 麻点 (用户"严重的显示BUG/图层打架");
//   ② 栈桥面板条 (05a pierTrestle) 旧写法底面 2.445 比桥面顶面 2.45 低 5mm 且两侧各外伸 0.12m;
//   ③ 全库 polygonOffset 出现 0 次, 相机 near=.08/far=900 ⇒ 24bit 深度分辨率 ≈ z²/(near·2²⁴)
//      (50m≈1.9mm / 100m≈7.5mm / 200m≈3.0cm) — 5mm 级埋入在 100m 外必闪。
// 本沙箱加载**真实脚本** (index.html 同序), 断言:
//   ① 栈桥共面: 桥矩形内 ≥200 点 (按**真实地形网格**插值, 不是读函数) 地形渲染面与桥面顶面高差 ≥0.035m
//      (设计下限 0.04 = 03-terrain BRIDGE_SINK_EDGE), 并给出"改动前"的同源回放对照;
//   ② 面板条: 27 块, 底面 ≥ 桥面顶面, 宽 = B.w (无 0.12m 外伸), 材质走 pavement 档, 共享材质零污染,
//      裸 polygonOffset 数字只出现在 05-world 的 DEPTH_TIERS 单源表;
//   ③ 栈桥可站立: 真 `updatePlayer` 推帧沿桥中线走一趟, y 轨迹不跌落/不掉桥 (打印轨迹);
//   ④ 全库扫描: 枚举全场景水平面片/结构盒, 断言本批写入域内无一对满足判据 (口径/豁免全文见 §4 头注释);
//      含 3 组对照: 共面贴片必须被抓 / 良性贴面必须不报 / 面板条回退旧几何必须被抓;
//   ⑤ (Lead 追加) 13 图每座桥: 桥缘内外 1m 环带采样, 断言下埋量剖面无 >0.15m 跳变、矩形外恒为 0;
//   ⑥ 水面档位 (河道/池塘 depthWrite / 浪花带抬高与 surf 档) + 桥下量化事实。
// 口径纪律: 本文件只读游戏对象, 不改任何 js/ 文件; 临时改动 (注入对照组/回退复现) 一律在同一段内复原。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const stub=require('./_bootstub.js');
const root=path.resolve(__dirname,'..');
const HPI=Math.PI/2;
let failures=0,checks=0;
const chk=(c,m)=>{ checks++; if(c) console.log('  ✓ '+m); else { failures++; console.error('  ✗ '+m); } };
const info=m=>console.log('    · '+m);

// ── 桩忠实化 (只在本 verify 进程内, 不动 dev/_bootstub.js) ─────────────────────────────
// 理由: 共用桩的几何既不记录 parameters (读不到 BoxGeometry 尺寸/CircleGeometry 半径),
// PlaneGeometry.setY 还是空操作 (读不到 03-terrain 真正写进网格的地形高度)。
// 这里换成"记录参数/记录 Y"的子类, 与真 three.js 同形 —— 否则 §1 只能验函数, 验不到**渲染网格本身**。
const THREE=stub.THREE;
class BoxG extends THREE.BoxGeometry{ constructor(w,h,d){ super(w,h,d); this.parameters={width:w,height:h,depth:d}; } }
class CircG extends THREE.CircleGeometry{ constructor(r,s){ super(r,s); this.parameters={radius:r,segments:s}; } }
class CylG extends THREE.CylinderGeometry{ constructor(rt,rb,h,s){ super(rt,rb,h,s); this.parameters={radiusTop:rt,radiusBottom:rb,height:h,radialSegments:s}; } }
class PlaneG extends THREE.PlaneGeometry{
constructor(w,h,sg,sh){
super(w,h,sg,sh);
const p=this.attributes.position, y=new Float32Array(p.count);
p.__y=y; p.setY=(i,v)=>{ y[i]=v; }; p.getY=(i)=>y[i];
this.parameters={width:w,height:h,widthSegments:sg,heightSegments:sh};
}
}
THREE.BoxGeometry=BoxG; THREE.CircleGeometry=CircG; THREE.CylinderGeometry=CylG; THREE.PlaneGeometry=PlaneG;

// 与 index.html 完全同序 (含 15c/15e/15d/15f/22a/23b —— verify-boot 的旧清单缺这几支)
const FILES=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/22a-menuart.js','js/23-deploy.js','js/23b-worldrestore.js','js/24-main.js'];
// §5 只需地形/配置: 轻量装载 (13 图各一次, 不整图建场)
const LITE=['js/00-config.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js'];
function boot(campIdx,files){
for(const k in stub.byId) delete stub.byId[k];
const ctx=vm.createContext(Object.assign({},stub.sandbox));
ctx.document=stub.document; ctx.window=stub.window;
ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of (files||FILES)) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
return ctx;
}
// 注意: 桩的 `globalThis` 指向**模板 sandbox 对象**而不是本 context 的全局 ⇒ 注入脚本里一律用 `var x=` 而不是
// `globalThis.x=` (后者会写到共享模板上, 本 context 里 `x` 仍是 undefined, 曾把 §4 对照段打成 ReferenceError)。
const G=(ctx,code)=>vm.runInContext(code,ctx);
const campIdx=id=>{ const c=boot(0,LITE); const i=G(c,`CAMPAIGNS.findIndex(x=>x.id==='${id}')`); if(i<0) throw new Error('no campaign '+id); return i; };
const ISLAND=campIdx('island');
const ctxMain=boot(ISLAND);
const MAP_SIZE=G(ctxMain,'MAP_SIZE');
const B=G(ctxMain,'BRIDGES[0]');
const deckTop=G(ctxMain,'bridgeDeckY(BRIDGES[0])');
console.log(`\n═══ dev/verify-zfight (WS4: 栈桥共面 + polygonOffset 全库规约) ═══`);
info(`战役 #${ISLAND} ${G(ctxMain,'CAMPAIGN.id')} mapSize=${MAP_SIZE} 桥=${JSON.stringify(B)} deckTop=${deckTop}`);

// ── 地形网格读写工具 (§1/§5 共用) ─────────────────────────────────────────────────────
const GG=G(ctxMain,'GROUND_GEO'), GP=GG.attributes.position;
const GX=GG.parameters.widthSegments+1;
const cellIndex=(ix,iz)=>iz*GX+ix;
const terrainY=i=>GP.getY(i);
function bridgeLocal(Bb,x,z){
const lx=x-Bb.x, lz=z-Bb.z, sn=Math.sin(Bb.yaw), cs=Math.cos(Bb.yaw);
// 与 onBridge 轴系逐字一致: ax 沿桥轴 (对应 len), pv 垂直桥向 (对应 w)
const ax=lx*sn+lz*cs, pv=lx*cs-lz*sn;
return {ax,pv,dA:Bb.len/2-Math.abs(ax),dV:Bb.w/2-Math.abs(pv)};
}
// 单元格内双线性插值: 只在**四角全在桥矩形内**的格上使用 —— 四角下埋量都 ≥ 设计下限 ⇒ 任何凸组合都 ≥ 下限,
// 故双线性与 GPU 真正光栅化的两个三角面在此给出同一结论 (采样面 = 渲染面)。
function cellSample(ix,iz,u,v){
const a=cellIndex(ix,iz), b=a+1, c=a+GX, d=c+1;
return (1-u)*(1-v)*terrainY(a)+u*(1-v)*terrainY(b)+(1-u)*v*terrainY(c)+u*v*terrainY(d);
}
function interiorCells(R){
const out=[];
const x0=GP.getX(0), z0=GP.getZ(0), dx=GP.getX(1)-x0, dz=GP.getZ(GX)-z0;
const ixA=Math.floor((R.x-R.w/2-x0)/dx)-1, ixB=Math.ceil((R.x+R.w/2-x0)/dx)+1;
const izA=Math.floor((R.z-R.len/2-z0)/dz)-1, izB=Math.ceil((R.z+R.len/2-z0)/dz)+1;
for(let iz=izA;iz<=izB;iz++)for(let ix=ixA;ix<=ixB;ix++){
if(ix<0||iz<0||ix+1>=GX||iz+1>=GX) continue;
const ids=[cellIndex(ix,iz),cellIndex(ix,iz)+1,cellIndex(ix,iz)+GX,cellIndex(ix,iz)+GX+1];
const ok=ids.every(i=>{ const l=bridgeLocal(R,GP.getX(i),GP.getZ(i)); return l.dA>0&&l.dV>0; });
if(ok) out.push({ix,iz,ids});
}
return out;
}
function sampleBridgeRect(R,n){
const cells=interiorCells(R), pts=[];
for(const c of cells){
for(let a=1;a<=n;a++)for(let b=1;b<=n;b++){
const u=a/(n+1), v=b/(n+1);
const x=GP.getX(c.ids[0])*(1-u)+GP.getX(c.ids[1])*u;
const z=GP.getZ(c.ids[0])*(1-v)+GP.getZ(c.ids[2])*v;
pts.push({x,z,y:cellSample(c.ix,c.iz,u,v)});
}
}
return pts;
}
function rectVerts(R){
const out=[];
for(let i=0;i<GP.count;i++){
const l=bridgeLocal(R,GP.getX(i),GP.getZ(i));
if(l.dA>0&&l.dV>0) out.push({i,x:GP.getX(i),z:GP.getZ(i),y:terrainY(i)});
}
return out;
}

// ══════════════════════════════════════════════════════════════════════════════════
// §1 栈桥共面
// ══════════════════════════════════════════════════════════════════════════════════
console.log(`\n── ① 栈桥共面采样 (桥 ${B.len}×${B.w}m, deckTop ${deckTop}, 地图 ${MAP_SIZE}) ──`);
const vAfter=rectVerts(B);
const pAfter=sampleBridgeRect(B,10);
const dAfter=pAfter.map(p=>deckTop-p.y);
const minAfter=Math.min(...dAfter);
info(`改动后: 矩形内网格顶点 ${vAfter.length} 个 (实测下埋量 ${Math.min(...vAfter.map(v=>deckTop-v.y)).toFixed(4)}~${Math.max(...vAfter.map(v=>deckTop-v.y)).toFixed(4)}m)`);
info(`改动后: 完整内格插值采样 ${pAfter.length} 点, 地形面 vs 桥面顶面高差 min=${minAfter.toFixed(4)}m / mean=${(dAfter.reduce((a,b)=>a+b,0)/dAfter.length).toFixed(4)}m`);
chk(pAfter.length>=200,`① 桥矩形内插值采样 ${pAfter.length} 点 ≥ 200`);
chk(minAfter>=0.035,`① 地形渲染面处处低于桥面顶面 ≥0.035m (实测 min ${minAfter.toFixed(4)}m; 设计下限 0.04)`);
chk(vAfter.every(v=>deckTop-v.y>0),`① 矩形内 ${vAfter.length} 个网格顶点无一高于桥面顶面`);
{ // 改动前同源回放: 顶点 Y 写回 heightAt (改动前那条代码路径的逐字复现)
const snap=Float32Array.from(GP.__y), heightAt=G(ctxMain,'heightAt');
for(let i=0;i<GP.count;i++){
const l=bridgeLocal(B,GP.getX(i),GP.getZ(i));
if(l.dA>-3&&l.dV>-3) GP.__y[i]=heightAt(GP.getX(i),GP.getZ(i));
}
const pb=sampleBridgeRect(B,10);
const minBefore=Math.min(...pb.map(p=>deckTop-p.y));
info(`改动前 (同源回放): 同 ${pb.length} 点高差 min=${minBefore.toFixed(4)}m ⇒ ${minBefore<0.02?'与桥面顶面共面 ⇒ 这就是用户报的"图层打架"根因':'异常'}`);
chk(minBefore<0.02,`① 判据有效性: 回放改动前地形 ⇒ 抓到共面 (min ${minBefore.toFixed(4)}m < 0.02)`);
chk(minAfter-minBefore>0.03,`① 改动前后高差增量 ${(minAfter-minBefore).toFixed(4)}m > 0.03`);
GP.__y.set(snap);
}

// ══════════════════════════════════════════════════════════════════════════════════
// §2 面板条
// ══════════════════════════════════════════════════════════════════════════════════
console.log(`\n── ② 栈桥面板条 (05a pierTrestle) ──`);
const world=G(ctxMain,'world');
const strips=[];
world.traverse(o=>{
const p=o.geometry&&o.geometry.parameters;
if(p&&Math.abs(p.height-0.07)<1e-9&&Math.abs(p.depth-0.36)<1e-9&&Math.abs(o.position.x-B.x)<0.6&&Math.abs(o.position.z-B.z)<B.len/2) strips.push(o);
});
const legacyN=strips.filter(o=>Math.abs(o.geometry.parameters.width-(B.w+0.24))<1e-6).length;
const newN=strips.filter(o=>Math.abs(o.geometry.parameters.width-B.w)<1e-6).length;
chk(strips.length===27,`② 面板条 ${strips.length} 块 (u=-22.1..+22.4 步 1.7 ⇒ 27 块)`);
chk(newN===27&&legacyN===0,`② 宽度全部 = B.w ${B.w}m (无 0.12m 外伸): 新 ${newN} / 旧 ${legacyN}`);
const minBot=Math.min(...strips.map(o=>o.position.y-0.035)), maxTop=Math.max(...strips.map(o=>o.position.y+0.035));
chk(minBot>=deckTop-1e-9,`② 底面最低 ${minBot.toFixed(4)}m ≥ 桥面顶面 ${deckTop} (改动前 2.445 = 低 5mm)`);
info(`   面板条顶面 ${maxTop.toFixed(4)}m; 走行面仍是 heightAt=${deckTop}, 条厚 0.07 为视觉铺装`);
const pvSet=new Set(strips.map(o=>o.material));
chk(pvSet.size===1,`② 27 块共用 1 个材质实例 (depthVariant 按 base+tier 缓存)`);
const pv=[...pvSet][0];
{ // 档位数值一律**从单源表读** (2026-09-27 重写: 四档表 → SURF_LANES 五档 + 共面消解, 数字不再是 -1/-2/-3)
const P=G(ctxMain,'SURF_LANES.pavement');
chk(pv.polygonOffset===true&&pv.polygonOffsetFactor===P.factor&&pv.polygonOffsetUnits===P.units,
`② 面板条走 pavement 档 (polygonOffset ${pv.polygonOffsetFactor}/${pv.polygonOffsetUnits} = 表值 ${P.factor}/${P.units})`);
}
chk(G(ctxMain,'MAT.woodDark.polygonOffset')===undefined,`② 共享材质 MAT.woodDark 未被就地修改 (polygonOffset=${G(ctxMain,'MAT.woodDark.polygonOffset')})`);
{ // 材质变体池上界 (2026-09-27 起含共面消解档 'c1'..'c6': 池 = 参与分档的材质数, 不是件数)
const sz=G(ctxMain,'_depthMats.size'), st=G(ctxMain,'SURF_STATS');
chk(sz<=96,`② 深度偏移材质缓存 ${sz} 条 ≤ 96 (覆盖层档 1 条 + 消解档 ${st.tLeveled} 件分摊到 ${sz-1} 个材质)`);
}
{ const T=G(ctxMain,'DEPTH_TIERS');
info(`   SURF_LANES 单源: ${Object.keys(T).map(k=>`${k}(${T[k].factor}/${T[k].units})`).join('  ')}`); }
{
const hits=[];
for(const f of fs.readdirSync(path.join(root,'js'))){
if(!f.endsWith('.js')) continue;
fs.readFileSync(path.join(root,'js',f),'utf8').split('\n').forEach((ln,i)=>{ if(/polygonOffset\s*[:=]/.test(ln)) hits.push(f+':'+(i+1)); });
}
const out=hits.filter(h=>!/^05-world\.js:/.test(h));
chk(out.length===0,`② 全库 polygonOffset 数字只出现在 DEPTH_TIERS 单源表 (表内 ${hits.length-out.length} 行, 表外 ${out.length} 处${out.length?': '+out.join(','):''})`);
}

// ══════════════════════════════════════════════════════════════════════════════════
// §3 栈桥可站立 (真推帧)
// ══════════════════════════════════════════════════════════════════════════════════
console.log(`\n── ③ 栈桥可站立 (真 updatePlayer 推帧) ──`);
{
G(ctxMain,`(()=>{ const p=player;
p.alive=true; p.deployed=true; p.spectator=false; p.flying=false; p.loiter=null; p.hp=100;
p.crouch=false; p.prone=false; p.ads=false; p.braced=false; p.bandaging=0;
p.vel.set(0,0,0); p.onGround=false; p.chute=false; p.stamina=1; p.suppressV=0; p.bloom=0;
p.fireT=0; p.landDip=0; p.lastDmgT=-99; p.nadeHeld=false; p.onVehicle=null; p.onMG=null;
p.onAT=null; p.onAA=null; p.onMortar=null; p.pendingBuild=null; p.sprinting=false; p.leanT=0;
if(!p.slots.length) p.slots=[{key:'springfield',def:WPN_DEFS['springfield'],mag:5,reserve:50}];
p.curSlot=0; p.curW=p.slots[0];
p.pos.set(${B.x},${deckTop},${B.z-B.len/2+1.5});
p.yaw=Math.PI;                       // fwd=(-sin,-cos)=(0,+1) ⇒ 朝海 (+z) 沿桥轴
keys.KeyW=true; keys.ShiftLeft=false; keys.Space=false; mouseDown=false; mouse2Down=false;
})()`);
const r=G(ctxMain,`(()=>{
const tr=[]; let n=0;
for(let f=0;f<900;f++){
nowT+=1/60; updatePlayer(1/60); n++;
const x=player.pos.x,y=player.pos.y,z=player.pos.z;
if(f%20===0||z>${B.z+B.len/2-6}) tr.push({f,x,y,z,og:player.onGround,sw:!!player.swim});
if(z>=${B.z+B.len/2-4.5}) break;
}
keys.KeyW=false;
return {n,tr};
})()`);
const tr=r.tr;
info(`走行 ${r.n} 帧 (${(r.n/60).toFixed(1)}s): z ${tr[0].z.toFixed(1)}→${tr[tr.length-1].z.toFixed(1)}; y 轨迹(每 20 帧): ${tr.filter((t,i)=>i%3===0).map(t=>t.y.toFixed(3)).join(', ')}`);
const onDeck=tr.filter(t=>t.z>B.z-B.len/2+1&&t.z<B.z+B.len/2-4.4);
const minY=Math.min(...onDeck.map(t=>t.y)), maxY=Math.max(...onDeck.map(t=>t.y));
const offLine=Math.max(...tr.map(t=>Math.abs(t.x-B.x)));
const sunk=tr.filter(t=>t.y<deckTop-0.05).length;
chk(r.n>0&&tr[tr.length-1].z>B.z+B.len/2-5,`③ 沿桥中线走完全程 (${r.n} 帧, z 位移 ${(tr[tr.length-1].z-tr[0].z).toFixed(1)}m)`);
chk(minY>deckTop-0.05&&maxY<deckTop+0.6,`③ 桥面段 y ∈ [${minY.toFixed(3)}, ${maxY.toFixed(3)}] 全程贴合桥面 ${deckTop} (未跌落/未穿模)`);
chk(offLine<0.6,`③ 横向最大偏移 ${offLine.toFixed(3)}m < 0.6 (未从桥侧掉下)`);
chk(sunk===0&&tr.every(t=>t.og),`③ 无失重帧: y<桥面-0.05 的帧 ${sunk}, onGround 全真=${tr.every(t=>t.og)}`);
chk(G(ctxMain,`heightAt(${B.x},${B.z})`)===deckTop,`③ heightAt 物理值未改动 (仍 ${G(ctxMain,`heightAt(${B.x},${B.z})`)} ⇒ 可站立性零回归)`);
}

// ══════════════════════════════════════════════════════════════════════════════════
// §4 全库共面扫描
// ── 候选集: 全场景 mesh (含 world 子树), 取 BoxGeometry / 水平圆盘 / 圆柱。
// ── 判据 Z-FIGHT(A,B) (需水平投影交叠 ≥ 0.25m²):
//    (a) 同向面:  A顶-B顶 或 A底-B底 |Δy| < 0.02 ⇒ 命中 (两面在同一视线方向上竞争);
//    (b) 反向面:  上件底面**低于**下件顶面 0 < Δpen < 0.02 (5mm~2cm 级埋入) ⇒ 命中
//                 (交界线在深度精度内抖动 + 侧壁穿出; 栈桥面板条改动前正是 5mm 这一档);
//    (c) 反向面 Δpen ≥ 0 (贴面/悬空) ⇒ **良性豁免**: 法线相反, 背面剔除, 只有材质 DoubleSide 且 Δpen==0
//        才是真共面竞争 (本库栈桥/铺装/墙体材质全是 FrontSide, 逐件已核);
//    (d) 反向面 Δpen ≤ -0.02 (深埋 ≥2cm) ⇒ 豁免 (交界稳定不抖)。
// ── 范围豁免 (逐条给理由): ① 实例批 (树/草, 无逐件几何, o.count 存在); ② 倾斜件 (rx/rz≠0, 无水平面);
//    ③ 超大件 (外包 >200m: 地面/海面网格 —— 由 §1/§6 专测); ④ 透明且 depthWrite:false 的贴片:
//    不写深度 ⇒ 与写深度件之间不存在"写深度竞争", 它们与**不透明**几何的风险是深度**测试**,
//    由 §6 的几何间距/档位审计负责 (浪花带 surf 档就是这个); ⑤ 无尺寸信息的几何; ⑥ NaN 位置畸形件
//    (NaN 参与比较恒为 false, 既不能判命中也不能判干净 ⇒ 隔离统计, 见文末越域发现)。
// ── 判据适用域 (与任务口径逐字对齐: "所有 transparent:true 的贴片/水面" + "所有铺装层压在结构盒上的件"):
//    一对里至少有一件是**贴片/铺装层** —— 定义: 水平盒/圆盘, 厚 ≤0.20m, 投影面积 ≥0.5m², 短边 ≥0.30m
//    (排除细杆/护栏条: 0.09×0.09 的横杆虽"薄"但不是铺装层), 或材质 transparent:true 且写深度。
//    域外的**结构件互相压** (石墙↔石墙顶面同高、屋面↔屋面…) 不属本批口径, 单独统计并列出材质分组:
//    它们是本库既有的建模交叠, 且同材质时外观完全一致 (看不到闪点), 修它们要动 13 图的建筑函数, 不属本任务。
// ── 已知良性实例 (逐条核过): 各桥"铺装层底面 == 桥面盒顶面"(Δpen=0 贴面) —— 与 stoneBridge 05a:1197 同口径。
// ══════════════════════════════════════════════════════════════════════════════════
console.log(`\n── ④ 全库共面扫描 ──`);
const malformed=[];
function collect(){
const scene=G(ctxMain,'scene'), out=[], seen=new Set();
(function walk(o,x,y,z,ry,tilt){
if(!o||seen.has(o)) return; seen.add(o);
const p=o.position, r=o.rotation||{x:0,y:0,z:0};
const lx=p?p.x:0, ly=p?p.y:0, lz=p?p.z:0;
const cs=Math.cos(ry), sn=Math.sin(ry);
const wx=x+lx*cs+lz*sn, wy=y+ly, wz=z-lx*sn+lz*cs, wry=ry+(r.y||0);
const t2=tilt||Math.abs(r.x||0)>1e-6||Math.abs(r.z||0)>1e-6;
const g=o.geometry;
if(g&&o.material&&o.visible!==false&&o.count===undefined){
const pr=g.parameters||{};
let kind=null,foot=null,top=wy,bot=wy;
const isDisc=pr.radius!==undefined&&Math.abs(Math.abs(r.x||0)-HPI)<0.02;
if(pr.width!==undefined&&pr.height!==undefined&&pr.depth!==undefined&&!t2){
kind='box'; top=wy+pr.height/2; bot=wy-pr.height/2;
foot={type:'rect',cx:wx,cz:wz,hw:pr.width/2,hd:pr.depth/2,ry:wry};
}else if(isDisc){
kind='disc'; foot={type:'circle',cx:wx,cz:wz,r:pr.radius};
}else if(pr.radiusTop!==undefined&&pr.height!==undefined&&!t2){
kind='cyl'; top=wy+pr.height/2; bot=wy-pr.height/2;
foot={type:'circle',cx:wx,cz:wz,r:Math.max(pr.radiusTop,pr.radiusBottom)};
}
if(kind&&foot){
const ext=foot.type==='rect'?Math.max(foot.hw,foot.hd)*Math.SQRT2:foot.r;
if(ext*2<=200&&ext*2>=0.15) out.push({o,kind,foot,top,bot,mat:o.material,wx,wy,wz,
write:!(o.material.transparent===true&&o.material.depthWrite===false),dbl:o.material.side===THREE.DoubleSide});
}
}
for(const c of o.children||[]) walk(c,wx,wy,wz,wry,t2);
})(scene,0,0,0,0,false);
return out;
}
function inFoot(f,x,z){
if(f.type==='circle'){ const dx=x-f.cx,dz=z-f.cz; return dx*dx+dz*dz<=f.r*f.r; }
const dx=x-f.cx, dz=z-f.cz, cs=Math.cos(f.ry), sn=Math.sin(f.ry);
return Math.abs(dx*cs-dz*sn)<=f.hw&&Math.abs(dx*sn+dz*cs)<=f.hd;
}
function footAABB(f){
if(f.type==='circle') return {x0:f.cx-f.r,x1:f.cx+f.r,z0:f.cz-f.r,z1:f.cz+f.r};
const cs=Math.abs(Math.cos(f.ry)), sn=Math.abs(Math.sin(f.ry));
const ex=f.hw*cs+f.hd*sn, ez=f.hw*sn+f.hd*cs;
return {x0:f.cx-ex,x1:f.cx+ex,z0:f.cz-ez,z1:f.cz+ez};
}
function overlapArea(A,Bb){
const a=footAABB(A.foot), b=footAABB(Bb.foot);
const x0=Math.max(a.x0,b.x0), x1=Math.min(a.x1,b.x1), z0=Math.max(a.z0,b.z0), z1=Math.min(a.z1,b.z1);
if(x1<=x0||z1<=z0) return 0;
const N=24; let c=0;
for(let i=0;i<N;i++)for(let j=0;j<N;j++){
const x=x0+(i+0.5)*(x1-x0)/N, z=z0+(j+0.5)*(z1-z0)/N;
if(inFoot(A.foot,x,z)&&inFoot(Bb.foot,x,z)) c++;
}
return c*(x1-x0)*(z1-z0)/(N*N);
}
function scan(){
malformed.length=0;
const C=collect();
const buckets=new Map();
const put=(y,e)=>{ const k=Math.round(y/0.01); if(!buckets.has(k)) buckets.set(k,[]); buckets.get(k).push(e); };
C.forEach((c,i)=>{ c.id=i; if(!isFinite(c.wx)||!isFinite(c.wz)||!isFinite(c.top)||!isFinite(c.bot)){ malformed.push(c); return; } put(c.top,{c,face:'top'}); put(c.bot,{c,face:'bot'}); });
const hits=[], seenPair=new Set();
for(const [k,A] of buckets)for(const k2 of [k,k+1,k+2]){
const Bb=buckets.get(k2); if(!Bb) continue;
for(const a of A)for(const b of Bb){
if(a===b||!a.c.write||!b.c.write) continue;
const yU=a.face==='top'?a.c.top:a.c.bot, yV=b.face==='top'?b.c.top:b.c.bot;
if(Math.abs(yU-yV)>=0.02) continue;
// 规范化配对键 (面上也排序, 避免 a/b 顺序不同重复计入)
const e1=[a.c.id,a.face], e2=[b.c.id,b.face];
const s=[e1,e2].sort((x,y)=>x[0]-y[0]||(x[1]<y[1]?-1:1));
const pk=s[0][0]+s[0][1]+s[1][0]+s[1][1];
if(seenPair.has(pk)) continue; seenPair.add(pk);
if(a.face===b.face){
const area=overlapArea(a.c,b.c); if(!(area>=0.25)) continue;
hits.push({cls:`同向面 Δ=${(yU-yV).toFixed(4)}`,area,A:a.c,B:b.c});
}else{
const upper=a.face==='bot'?a.c:b.c, lower=a.face==='bot'?b.c:a.c;
const pen=lower.top-upper.bot;
if(pen<=1e-9||pen>=0.02){
if(Math.abs(pen)<=1e-9&&(upper.dbl||lower.dbl)){ const area=overlapArea(a.c,b.c); if(area>=0.25) hits.push({cls:'DoubleSide 共面贴面 Δ=0',area,A:upper,B:lower}); }
continue;
}
const area=overlapArea(a.c,b.c); if(!(area>=0.25)) continue;
hits.push({cls:`底面埋入 ${pen.toFixed(4)}m`,area,A:upper,B:lower});
}
}
}
return {C,hits,malformed:malformed.slice()};
}
const nameOf=c=>{
const d=c.foot.type==='circle'?`r${c.foot.r.toFixed(2)}`:`${(c.foot.hw*2).toFixed(2)}×${(c.foot.hd*2).toFixed(2)}`;
return `${c.kind}[${d}×h${(c.top-c.bot).toFixed(2)}]@(${c.wx.toFixed(1)},${c.wy.toFixed(2)},${c.wz.toFixed(1)}) 顶${c.top.toFixed(4)}/底${c.bot.toFixed(4)}`;
};
const matName=m=>{ if(!m) return '?'; const M=G(ctxMain,'MAT'); for(const k in M) if(M[k]===m) return 'MAT.'+k;
if(m.polygonOffset===true) return (m.polygonOffsetUnits<0)?'(覆盖层档材质)':'(共面消解档材质)';
return m.map?'(本地贴图材质)':'(本地平色材质)'; };
const fpArea=c=>c.foot.type==='circle'?Math.PI*c.foot.r*c.foot.r:4*c.foot.hw*c.foot.hd;
const fpMin=c=>c.foot.type==='circle'?2*c.foot.r:2*Math.min(c.foot.hw,c.foot.hd);
const isPlate=c=>(c.top-c.bot)<=0.20&&fpArea(c)>=0.5&&fpMin(c)>=0.30;
const inScope=h=>isPlate(h.A)||isPlate(h.B)||h.A.mat.transparent===true||h.B.mat.transparent===true;
const unitsOf=m=>(m&&m.polygonOffset===true)?(m.polygonOffsetUnits||0):0;
// ★2026-09-27 (深度分层重写): 判据从"共面 = 命中"改成"共面 **且有效深度单位相同** = 命中"。
//   原判据在旧口径下等价 (那时全库只有四档, 覆盖层之外一律 units=0 ⇒ 共面即无胜者);
//   现在构建期消解器会给冲突件分配 'c1'..'c6' 档 (units=+2..+12), 共面件的胜负被写死 ⇒ 不再算命中。
//   于是"命中"只剩一种含义: **同一深度单位的两个共面件 = 相机一动就翻转**。
const unresolved=h=>unitsOf(h.A.mat)===unitsOf(h.B.mat);
const inMyDomain=h=>{
const nearPier=c=>c.foot.type==='rect'
?Math.abs(c.foot.cx-B.x)<B.w/2+2+Math.max(c.foot.hw,c.foot.hd)&&Math.abs(c.foot.cz-B.z)<B.len/2+2+Math.max(c.foot.hw,c.foot.hd)
:Math.hypot(c.foot.cx-B.x,c.foot.cz-B.z)<B.len/2+2;
// 本批写入域 = 栈桥矩形外扩 2m / 覆盖层档材质 (units<0 的具名档); 消解档 (units>0) 归 verify-surf 专测
return nearPier(h.A)||nearPier(h.B)||unitsOf(h.A.mat)<0||unitsOf(h.B.mat)<0;
};
const base=scan();
info(`候选件 ${base.C.length} (全场景: 盒/水平圆盘/圆柱, 外包 ≤200m); 写深度 ${base.C.filter(c=>c.write).length}, depthWrite:false 豁免 ${base.C.filter(c=>!c.write).length}`);
info(`命中 ${base.hits.length} 对 (判据: 同向面 |Δ|<0.02 或 底面埋入 <0.02, 投影交叠 ≥0.25m²)`);
{
const resolved=base.hits.filter(h=>!unresolved(h)).length;
info(`  其中: 双方深度单位不同 (胜负已由构建期写死) ${resolved} 对 · 同单位残留 (会随相机闪) ${base.hits.length-resolved} 对`);
}
{ // 域外结构件互压: 分类统计 —— 2026-09-27 起它们**也已分档**, 只报告材质分组
const out=base.hits.filter(h=>!inScope(h));
const byKind=new Map();
out.forEach(h=>{ const k=`${matName(h.A.mat)} ↔ ${matName(h.B.mat)} (${h.cls.split(' ')[0]})`; byKind.set(k,(byKind.get(k)||0)+1); });
info(`  其中: 判据适用域内 ${base.hits.filter(inScope).length} 对 / 域外结构件互压 ${out.length} 对`);
[...byKind.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8).forEach(([k,n])=>info(`   域外 ${n} 对: ${k}`));
}
{
const inScopeHits=base.hits.filter(inScope);
const bad=inScopeHits.filter(unresolved);
const myHits=bad.filter(inMyDomain), outHits=bad.filter(h=>!inMyDomain(h));
info(`命中分类 (仅同单位残留): 本批写入域 ${myHits.length} 对 / 越域 (贴片·铺装层类) ${outHits.length} 对`);
for(const h of bad.slice(0,12)) info(`  ✗ units=${unitsOf(h.A.mat)} ${h.cls} · 交叠 ${h.area.toFixed(2)}m² · ${nameOf(h.A)} ↔ ${nameOf(h.B)} · ${matName(h.A.mat)} / ${matName(h.B.mat)}`);
chk(myHits.length===0,`④ 本批写入域内 (栈桥矩形 / 覆盖层档材质) 同单位共面 ${myHits.length} 对 = 0`);
chk(outHits.length===0,`④ 全库贴片/铺装类越域同单位共面 ${outHits.length} 对 = 0 (2026-09-27 起由构建期消解器兜底)`);
}
{ // 栈桥桥面盒 ↔ 面板条: 真实几何上的良性贴面 (Δpen=0), 必须被判据豁免
const deck=base.C.find(c=>c.kind==='box'&&Math.abs(c.foot.hw*2-6)<0.01&&Math.abs(c.top-deckTop)<1e-6&&Math.abs(c.foot.hd*2-B.len)<0.01);
chk(!!deck,`④ 定位到栈桥桥面盒 (6×0.32×46 顶面 ${deckTop})`);
if(deck){
const st=base.C.find(c=>c.kind==='box'&&Math.abs(c.foot.hw*2-6)<0.01&&Math.abs(c.top-(deckTop+0.07))<1e-6&&Math.abs(c.foot.hd*2-0.36)<0.01);
chk(!!st,`④ 定位到面板条 (底面 ${deckTop}+0.000 == 桥面盒顶面 ⇒ 贴面)`);
if(st) info(`   贴面对 (桥面盒顶 ↔ 面板条底): Δpen=${(deck.top-st.bot).toFixed(6)}m ⇒ 按 c) 良性豁免 (FrontSide)`);
}
}
{ // NaN 位置畸形件: 修前实测 2 件 (05c:1721-1723 元组缺 ry), 修后必须 0; 并附阴性对照证明判据能抓到
info(`NaN 位置畸形件 (05c:1721-1723 元组缺 ry ⇒ ry=undefined ⇒ Math.sin/cos=NaN): 修前实测 2 件 box[3.76×1.00×0.75] MAT.sandbag`);
info(`   口径: 全场景盒/圆盘/圆柱候选里 wx/wz/top/bot 任一非有限者 (NaN 参与比较恒 false ⇒ 既不报命中也不报干净, 必须隔离)`);
chk(scan().malformed.length===0,`④ 当前世界 NaN 位置畸形件 0 件 (修前 2 件: 椰林营区 2 面沙袋墙不渲染 + 碰撞盒失效 + 幻影掩体)`);
{ // 正向对照: 修后这两处必须有**位置有限**的沙袋墙实体 (05c:1721-1723 的 (-144,-26)/(-120,-30))
const spots=[[-144,-26],[-120,-30]];
const cnt=spots.map(([x,z])=>{ let n=0; world.traverse(o=>{ if(o.material===G(ctxMain,'MAT.sandbag')&&isFinite(o.position.x)&&isFinite(o.position.z)&&Math.abs(o.position.x-x)<3&&Math.abs(o.position.z-z)<3) n++; }); return n; });
info(`   修后落位实测: ${spots.map((s,i)=>`(${s[0]},${s[1]}) ${cnt[i]} 件`).join(' / ')} (island layoutFp ${'308279'}→${'308319'} 字符: 同 2 件碰撞盒的坐标从 6×"NaN" 变成 6 个实数, 结构计数零变化)`);
chk(cnt.every(n=>n>=1),`④ 阳性对照: 2 面沙袋墙真实落位且位置有限 (${cnt.join('/')} 件)`);
}
{ // 阴性对照 D: 用修前的调用形态 (ry=undefined) 现造一件 ⇒ 判据必须抓到, 清理后回到 0
const b0=G(ctxMain,'BOXES.length'), c0=G(ctxMain,'coverPoints.length');
const m=G(ctxMain,`sandbagWall(-110,12,3.6,undefined,1.0,false)`);
const bad=[m.position.x,m.position.y,m.position.z].filter(v=>!isFinite(v)).length;
const caught=scan().malformed.length;
info(`   对照D (现造 sandbagWall(-110,12,3.6,undefined,1.0,false)): 位置 NaN 分量 ${bad}/3, 扫描器抓到畸形件 ${caught} 个`);
chk(bad>0&&caught>=1,`④ 对照D: 修前调用形态 (ry=undefined) 被判据抓到 (NaN 分量 ${bad} 个, 畸形件 ${caught} 个)`);
world.remove(m); G(ctxMain,`BOXES.length=${b0}; coverPoints.length=${c0};`);
chk(scan().malformed.length===0,`④ 对照D 清理后畸形件回到 0 个 (沙箱状态已复原: BOXES/coverPoints 截回原长)`);
}
}
{ // 阴性对照 A: 两块**贴片**(厚 0.12 ≤0.20 ⇒ 在判据适用域内) 同位同高 ⇒ 顶面同高、底面同高, 完全重叠
G(ctxMain,`var __zfA=mesh(boxGeo(3,0.12,3),MAT.wood,-140,1.2,120,0,false,false); var __zfB=mesh(boxGeo(3,0.12,3),MAT.stone,-140,1.2,120,0,false,false);`);
const A=G(ctxMain,'__zfA'), Bb=G(ctxMain,'__zfB');
const neg=scan();
const mine=neg.hits.filter(h=>h.A.o===A||h.B.o===A||h.A.o===Bb||h.B.o===Bb);
info(`阴性对照A (两块 3×3×0.12 贴片同位: 顶面同为 1.26 / 底面同为 1.14): 命中 ${mine.length} 对 —— ${mine.map(h=>h.cls+'/'+h.area.toFixed(2)+'m²').join('; ')}`);
chk(mine.length>=2,`④ 对照A: 故意共面的贴片被抓到 ${mine.length} 对 (同向面判据有效)`);
world.remove(A); world.remove(Bb); G(ctxMain,'__zfA=null; __zfB=null;');
chk(scan().hits.filter(inMyDomain).length===0,`④ 对照A 移除后本批写入域命中回到 0`);
}
{ // 阴性对照 B: 良性叠放 (A 顶面 == B 底面) 必须不报
G(ctxMain,`var __zfC=mesh(boxGeo(3,0.12,3),MAT.wood,-120,1.0,120,0,false,false); var __zfD=mesh(boxGeo(3,0.12,3),MAT.stone,-120,1.12,120,0,false,false);`);
const C=G(ctxMain,'__zfC'), D=G(ctxMain,'__zfD');
const neg=scan();
const mine2=neg.hits.filter(h=>h.A.o===C||h.B.o===C||h.A.o===D||h.B.o===D);
info(`阴性对照B (A 顶面 1.06 == B 底面 1.06 的贴面叠放, 两块都在适用域内): 该两件相关命中 ${mine2.length} 对 (应 0)`);
chk(mine2.length===0,`④ 对照B: 良性贴面叠放未被误报 (判据不误杀)`);
world.remove(C); world.remove(D); G(ctxMain,'__zfC=null; __zfD=null;');
}
{ // 阴性对照 C: 面板条回退成 05a 改动前的几何 (宽 B.w+0.24, 中心 dy+0.03) ⇒ 必须被抓到
const oldGeo=G(ctxMain,`boxGeo(${B.w+0.24},0.07,0.36)`);
const bak=strips.map(o=>({g:o.geometry,y:o.position.y}));
strips.forEach(o=>{ o.geometry=oldGeo; o.position.y=deckTop+0.03; });
const neg=scan();
const n=neg.hits.filter(inMyDomain);
info(`对照C (回放改动前: 宽 ${(B.w+0.24).toFixed(2)} / 中心 ${(deckTop+0.03).toFixed(3)} ⇒ 底面 ${(deckTop-0.005).toFixed(3)}): 本批写入域命中 ${n.length} 对`);
for(const h of n.slice(0,3)) info(`  ✗ ${h.cls} · 交叠 ${h.area.toFixed(2)}m² · ${nameOf(h.A)} ↔ ${nameOf(h.B)}`);
chk(n.length>=27,`④ 对照C: 回放改动前的 27 块面板条 ⇒ 抓到 ${n.length} 对 (5mm 埋入这一档确实会闪)`);
bak.forEach((b,i)=>{ strips[i].geometry=b.g; strips[i].position.y=b.y; });
chk(scan().hits.filter(inMyDomain).length===0,`④ 对照C 复原后本批写入域命中回到 0`);
}

// ══════════════════════════════════════════════════════════════════════════════════
// §5 (Lead 追加) 13 图每座桥: 桥缘内外 1m 环带采样, 下埋量剖面无跳变 >0.15m
// 采样: 四条边 × 3 站位 × 沿外法线 -1.0→+1.0m (步 0.1m); S = heightAt − terrainRenderY = 下埋量。
// 断言: (i) 矩形内**抬升生效处** S ≥ 0.035 (地形面确在桥面之下);
//       (ii) S 上界 ≤ 0.105 (改动不越界, 下埋上限 = BRIDGE_SINK_MID 0.10);
//       (iii) 相邻 0.1m 采样的 S 跳变 ≤ 0.15m (下埋是连续渐变; 理论最大步进 = 边缘档 0.04);
//       (iv) 桥矩形外 S ≡ 0;
//       (v) S==0 的矩形内采样点必须**全部**能用"该点天然地形已高于桥面 (heightAt = 天然值 > deckY)"解释
//           —— 那是本库既有的"地形穿桥面"现象 (heightAt 只抬不降), 与下埋无关, 逐点计数报告。
// 说明: 桥缘外侧的"天然地形陡降"(沙脊→礁盘/河床) 与下埋无关, 改动前后逐字相同 —— 本断言测的是
//       **下埋量剖面**的连续性, 不是天然地形的连续性 (那由 heightAt 决定, 本批一行未动)。
// ══════════════════════════════════════════════════════════════════════════════════
console.log(`\n── ⑤ 13 图全桥桥缘过渡 ──`);
{
const camps=G(ctxMain,'CAMPAIGNS').map((c,i)=>({i,id:c.id,n:(c.bridges||(c.bridge?[c.bridge]:[])).length}));
let nb=0,worstStep=0,minInside=9,outOfRect=0,overMax=0,noSink=0,aboveDeck=0;
const rows=[];
const diag=[];
for(const c of camps){
if(!c.n) continue;
const cc=boot(c.i,LITE);
const bridges=G(cc,'BRIDGES'), h=G(cc,'heightAt'), y=G(cc,'terrainRenderY'), deckY=G(cc,'bridgeDeckY');
for(let bi=0;bi<bridges.length;bi++){
const bb=bridges[bi]; nb++;
const D=deckY(bb);
const sn=Math.sin(bb.yaw), cs=Math.cos(bb.yaw);
// 桥局部→世界: (u 沿桥轴, v 垂直桥向) → [x+u*sn+v*cs, z+u*cs-v*sn]; 外法线: v± = ±(cs,-sn), u± = ±(sn,cs)
const edges=[{tag:'v-',nx:-cs,nz:sn,axis:'u'},{tag:'v+',nx:cs,nz:-sn,axis:'u'},{tag:'u-',nx:-sn,nz:-cs,axis:'v'},{tag:'u+',nx:sn,nz:cs,axis:'v'}];
let worst=0,minIn=9,noS=0,above=0;
for(const e of edges){
for(const fr of [0.25,0.5,0.75]){
// 站位: 长边 (v±) 沿桥轴 u 取 3 个位置, 端边 (u±) 沿横向 v 取 3 个位置
const u0=e.axis==='u'?(fr-0.5)*bb.len:(e.tag==='u+'?bb.len/2:-bb.len/2);
const v0=e.axis==='u'?(e.tag==='v+'?bb.w/2:-bb.w/2):(fr-0.5)*bb.w;
let prev=null;
for(let t=-1.0;t<=1.0+1e-9;t+=0.1){
const x=bb.x+u0*sn+v0*cs+e.nx*t, z=bb.z+u0*cs-v0*sn+e.nz*t;
// "在矩形内"一律以**游戏自身判据** (bridgeLocal 与 onBridge 轴系逐字同源) 为准, 不靠 t 的符号
const loc=bridgeLocal(bb,x,z);
const inside=loc.dA>0&&loc.dV>0;
const S=h(x,z)-y(x,z), hh=h(x,z);
if(inside){
if(S>1e-9) minIn=Math.min(minIn,S);
else { noS++; if(hh>D+1e-3) above++; }
if(S>0.105) overMax++;
} else if(S>1e-9){ outOfRect++; if(diag.length<6) diag.push(`${c.id}#${bi+1} ${e.tag} fr=${fr} t=${t.toFixed(2)} → (${x.toFixed(1)},${z.toFixed(1)}) dA=${loc.dA.toFixed(2)} dV=${loc.dV.toFixed(2)} S=${S.toFixed(4)}`); }
if(prev!==null) worst=Math.max(worst,Math.abs(S-prev));
prev=S;
}
}
}
worstStep=Math.max(worstStep,worst); minInside=Math.min(minInside,minIn);
noSink+=noS; aboveDeck+=above;
rows.push(`${(c.id+'        ').slice(0,9)}(#${c.i}) 桥${bi+1} ${bb.kind||'generic'}: 内缘下埋 ${minIn===9?'(无抬升生效点)':minIn.toFixed(4)+'m'}, 剖面最大步进 ${worst.toFixed(4)}m${noS?`, 无下埋采样 ${noS} 点(天然地形高于桥面 ${above} 点)`:''}`);
}
}
rows.forEach(r=>info(r));
if(diag.length) diag.forEach(d=>info(`  越界样本(异常): ${d}`));
info(`合计 ${nb} 座桥 / 扫描 ${G(ctxMain,'CAMPAIGNS.length')} 图 (island pier / hukawng grand / songhu stone×2 …)`);
chk(nb>=3,`⑤ 覆盖 ${nb} 座桥`);
chk(minInside>=0.035&&minInside<9,`⑤ 每座桥"抬升生效处"下埋量 ≥0.035m (最小 ${minInside.toFixed(4)}m)`);
chk(worstStep<=0.1501,`⑤ 桥缘内外 1m 环带下埋量剖面最大步进 ${worstStep.toFixed(4)}m ≤ 0.15 (理论值 = 边缘档 0.04)`);
chk(outOfRect===0,`⑤ 桥矩形外下埋量恒为 0 (越界 ${outOfRect} 点)`);
chk(overMax===0,`⑤ 矩形内下埋量上界 ≤0.105m (越界 ${overMax} 点 ⇒ 未越界改动地形)`);
chk(noSink===aboveDeck,`⑤ 矩形内无下埋采样 ${noSink} 点全部由"天然地形高于桥面"解释 (其中高于桥面 ${aboveDeck} 点) ⇒ 下埋无遗漏`);
}

// ══════════════════════════════════════════════════════════════════════════════════
// §6 水面档位审计 + 桥下量化事实
// ══════════════════════════════════════════════════════════════════════════════════
console.log(`\n── ⑥ 水面档位 + 桥下量化事实 ──`);
{
const foam=G(ctxMain,'SEA_FOAM'), sea=G(ctxMain,'SEA_MESH');
const fm=foam.material;
chk(fm.transparent===true&&fm.depthWrite===false,`⑥ 浪花带 transparent=true / depthWrite=false`);
{ const S=G(ctxMain,'SURF_LANES.surf');
chk(fm.polygonOffset===true&&fm.polygonOffsetFactor===S.factor&&fm.polygonOffsetUnits===S.units,
`⑥ 浪花带走 surf 档 (polygonOffset ${fm.polygonOffsetFactor}/${fm.polygonOffsetUnits} = 表值 ${S.factor}/${S.units})`);
chk(SEA_FOAM_RENDER_ORDER(),`⑥ 浪花带 renderOrder 与档位表同源 (surfaceLane 一次下发)`); }
function SEA_FOAM_RENDER_ORDER(){ return foam.renderOrder===G(ctxMain,'SURF_LANES.surf.order'); }
const fp=foam.geometry.attributes.position.array; let fy0=9,fy1=-9;
for(let i=1;i<fp.length;i+=3){ fy0=Math.min(fy0,fp[i]); fy1=Math.max(fy1,fp[i]); }
chk(Math.abs(fy0-0.09)<1e-9&&Math.abs(fy1-0.09)<1e-9,`⑥ 浪花带顶面 ${fy0.toFixed(3)}m (改动前 0.05) ⇒ 与海面 ${(G(ctxMain,'SEA.level')-0.03).toFixed(2)} 间距 0.12m (改动前 0.08)`);
chk(sea.material.depthWrite===false,`⑥ 海面 depthWrite=false 未回归 (本就正确, 只做守门)`);
{ // 河道/支流/池塘: 真建淞沪图, 逐件查材质 (songhu 有 RIVER + delta.channels + delta.ponds)
const cs=boot(campIdx('songhu'));
const wat=[];
G(cs,'scene').traverse(o=>{
const m=o.material;
if(m&&m.transparent===true&&m.map&&(Math.abs((m.opacity||1)-0.72)<1e-6||Math.abs((m.opacity||1)-0.78)<1e-6))
wat.push({op:m.opacity,dw:m.depthWrite});
});
const byOp={}; wat.forEach(w=>{ byOp[w.op]=(byOp[w.op]||0)+1; });
info(`   淞沪图半透明水面件: ${JSON.stringify(byOp)} (0.72=河道/支流/鱼塘, 0.78=藕塘)`);
chk(wat.length>0,`⑥ 淞沪图枚举到 ${wat.length} 件半透明水面`);
chk(wat.every(w=>w.dw===false),`⑥ 全部 ${wat.length} 件水面 depthWrite=false (河道/支流/池塘改动前为 undefined=写深度)`);
}
{ // 桥下量化事实 (Lead 拿去问用户的数字)
const midZ=B.z+B.len/2-4;
const bedMid=G(ctxMain,`heightAt(${B.x},${midZ},true)`);
const shoreZ=G(ctxMain,`(()=>{ for(let z=${B.z-B.len/2};z<=${B.z+B.len/2};z+=0.05){ if(heightAt(${B.x},z,true)<SEA.level) return +z.toFixed(2);} return null; })()`);
const terrTop=deckTop-0.04, pileTop=deckTop-0.44, beamTop=deckTop-0.22;
info(`桥下量化事实 (供 Lead 拿数字问用户, 本轮不做外观改造):`);
info(`  · 桥矩形内地形渲染面顶 = ${terrTop.toFixed(3)}~${(deckTop-0.10).toFixed(3)}m (deckTop ${deckTop} − 下埋 0.04~0.10); 海平面 ${G(ctxMain,'SEA.level')} ⇒ 礁盘上一道高出水面 ~${terrTop.toFixed(2)}m 的**实心沙脊**`);
info(`  · 天然海床 (noBridge): 水线处 z≈${shoreZ}, 桥中外侧 z=${midZ} 处 ${bedMid.toFixed(3)}m ⇒ 沙脊底面以下 ${(-bedMid).toFixed(2)}m 是水/海床; 海面网格按 heightAt 剔三角 ⇒ **桥下海面是空的**(填充它的是这道沙脊)`);
info(`  · 桩排被埋深度: 桩顶 ${pileTop.toFixed(3)}m / 纵梁顶 ${beamTop.toFixed(3)}m / 地形面顶 ${terrTop.toFixed(3)}m ⇒ 桩排顶被埋 ${(terrTop-pileTop).toFixed(2)}m 起, 交叉撑 (y≈-0.3~1.7) 全部在地形面之下`);
chk(bedMid<G(ctxMain,'SEA.level'),`⑥ 自检: 桥中外侧天然海床 ${bedMid.toFixed(2)}m 低于海平面 ⇒ "桥下有水"的前提成立`);
}
}

console.log(`\n${failures?'✗':'✓'} dev/verify-zfight: ${checks-failures}/${checks} 通过${failures?` (失败 ${failures})`:''}`);
process.exit(failures?1:0);
