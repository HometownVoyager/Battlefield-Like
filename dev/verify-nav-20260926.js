// ─────────────────────────────────────────────
// dev/verify-nav-20260926.js —— 07-nav A* 修复验收 (2026-09-26 批)
// 用法: node dev/verify-nav-20260926.js [--neg] [战役序号...]
//   --neg = 阴性对照: 装载前把 js/07-nav.js 的文本还原成旧写法 (gen++ / 预算按"弹出次数"计),
//           同一批判据必须报红 —— 证明判据真的在测那两条修复, 不是"修复前后都绿"的空断言。
//
// 判据 (逐战役 + 汇总):
//   ① 纯函数    : 同一 (起点,终点) 连跑 4 次, 结果必须完全一致 (路径逐点相同; null↔路径 也算不一致)
//   ② 无假失败  : 起终点同连通分量 (即没被分量表剪枝) 的查询不许返回 null
//   ③ 路标可核验: 端点干净的查询, 输出路径相邻两路标必须段段过 NAV.lineClear
//                 (端点被 fix() 外推的查询单列 —— 那段桥接本就无从核验, 不计入判据)
//   ④ 代价      : 成功返回的查询不得撞 SEARCH_NODES 硬上限 (撞顶=被截断)
//
// 口径: 沙箱桩 = dev/_bootstub.js + dev/_bootpatch.js (缺能力=桩不足, 不报成被测代码失败);
//       07-nav 的 comp/csize/open 等内部表不在模块导出里, 本探针用**文本补一个 dbg 导出**读它们
//       (对源码语义零改动; 正式文件里不留 dbg)。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const OK=[],BAD=[];
function assert(name,cond,detail){ (cond?OK:BAD).push(name); console.log(`  ${cond?'✓':'✗'} ${name}${detail?'  '+detail:''}`); }
function section(t){ console.log('\n══ '+t+' ══'); }
const SRC=f=>fs.readFileSync(path.join(root,f),'utf8');

const NEG=process.argv.includes('--neg');
const capArg=(()=>{ const a=process.argv.find(s=>s.indexOf('--cap=')===0); return a?parseInt(a.slice(6)):0; })();
const campArg=process.argv.slice(2).filter(a=>/^\d+$/.test(a)).map(Number);

// ── 07-nav 源码文本补丁: ①补 dbg 导出 ②(--neg) 还原旧写法 ③(--cap=N) 抬硬上限做成本量测 ──
function navSource(){
	let s=SRC('js/07-nav.js');
	const anchor='return { findPath, blocked2D:';
	if(s.indexOf(anchor)<0) throw new Error('07-nav 导出锚点未找到 (导出表被改过?)');
	s=s.replace(anchor,'return { dbg:{open,eH,eV,eD1,eD2,N,SP,OFF,idx,toW,comp,csize}, findPath, blocked2D:');
	if(capArg){
		if(s.indexOf('const SEARCH_NODES=90000;')<0) throw new Error('--cap 锚点未找到');
		s=s.replace('const SEARCH_NODES=90000;','const SEARCH_NODES='+capArg+';');
	}
	if(NEG){
		let n=0;
		if(s.indexOf('gen+=2;')<0) throw new Error('阴性对照锚点 gen+=2 未找到');
		s=s.replace('gen+=2;','gen++'); n++;
		if(s.indexOf('settled<settleCap')<0) throw new Error('阴性对照锚点 settled<settleCap 未找到');
		s=s.replace('settled<settleCap','popped<settleCap'); n++;
		if(n!==2) throw new Error('阴性对照改写数不对: '+n);
	}
	return s;
}
const NAVSRC=navSource();
const HEAD=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js',
'js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js',
'js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js',
'js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/15g-capmodels.js','js/15h-capital.js','js/16-aircraft.js',
'js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js',
'js/22a-menuart.js','js/23-deploy.js','js/23b-worldrestore.js','js/24-main.js'];
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
		try{ vm.runInContext(f==='js/07-nav.js'?NAVSRC:SRC(f),ctx,{filename:f}); }
		catch(e){ errs.push(f+': '+String(e&&e.message||e)); }
	}
	// 开局 (世界布景/NAV.refresh 在这一步完成); 桩里没这个按钮也不许把探针搞死
	try{
		const btn=document.getElementById('startBtn');
		if(btn&&typeof btn.onclick==='function') vm.runInContext('document.getElementById("startBtn").onclick();',ctx);
	}catch(e){ errs.push('startBtn: '+String(e&&e.message||e)); }
	return {ctx,errs};
}
const N=(ctx,code,vars)=>{ if(vars) for(const k of Object.keys(vars)) ctx[k]=vars[k]; return vm.runInContext(code,ctx); };

// ── 逐战役判据 ──
const campTotal=N(boot(0).ctx,'CAMPAIGNS.length');
const camps=campArg.length?campArg:Array.from({length:campTotal},(_,i)=>i);

let gMismatch=0, gFalseNull=0, gSegFail=0, gSegBridge=0, gClipped=0, gQueries=0, gPaths=0, gPairs=0, gCleanPaths=0;
let gCleanSegs=0, gCleanSegFail=0, gPops=0, gMaxPops=0, gOk=0, gNull=0, gPruned=0, gDupPop=0, gStrictFail=0;
const gMinOffs=[];
const problems=[], islandProbs=[];
let bootErrs=[];

for(const ci of camps){
	const {ctx,errs}=boot(ci);
	if(errs.length) bootErrs=bootErrs.concat(errs.map(e=>`[图${ci}] `+e));
	const title=N(ctx,'CAMPAIGNS['+ci+'].title');
	const q=N(ctx,`(()=>{
const b0=BASES[0], b1=BASES[1];
if(!b0||!b1) return null;
const out=[{x:b0.x,z:b0.z,tx:b1.x,tz:b1.z,tag:'基地0→基地1'},{x:b0.x,z:b0.z,tx:0,tz:0,tag:'基地0→图心'},
{x:b1.x,z:b1.z,tx:0,tz:0,tag:'基地1→图心'}];
for(const sp of (CAMPAIGN.spawns||[])) out.push({x:sp.x,z:sp.z,tx:b0.x,tz:b0.z,tag:'强点'+sp.name+'→基地0'});
const fls=(typeof FLAGS!=='undefined'&&FLAGS)?FLAGS:[];
for(const fl of fls) out.push({x:fl.x,z:fl.z,tx:b1.x,tz:b1.z,tag:'旗点'+(fl.name||'')+'→基地1'});
return out; })()`);
	if(!q){ console.log(`  · 图${ci} 无 BASES (world 未建?) —— 跳过`); continue; }
	const res=N(ctx,`(()=>{
const D=NAV.dbg;
const toG=(x,z)=>[clamp(Math.round((x+D.OFF)/D.SP),0,D.N-1), clamp(Math.round((z+D.OFF)/D.SP),0,D.N-1)];
const openN=(ii,jj)=>{ if(ii<0||jj<0||ii>=D.N||jj>=D.N||!D.open[D.idx(ii,jj)]) return -1;
 let nb=0; if(ii>0&&D.open[D.idx(ii-1,jj)])nb++; if(ii<D.N-1&&D.open[D.idx(ii+1,jj)])nb++;
 if(jj>0&&D.open[D.idx(ii,jj-1)])nb++; if(jj<D.N-1&&D.open[D.idx(ii,jj+1)])nb++; return nb; };
const cellOf=(x,z)=>{ const g=toG(x,z); return {i:g[0],j:g[1],open:!!D.open[D.idx(g[0],g[1])],nb:openN(g[0],g[1])}; };
const rows=[];
for(const q of QUERIES){
 const c0=cellOf(q.x,q.z), c1=cellOf(q.tx,q.tz);
 const cs=D.comp[D.idx(c0.i,c0.j)], ct=D.comp[D.idx(c1.i,c1.j)];
 const sameComp=(cs>=0&&ct>=0&&cs===ct);
 const crossComp=(cs>=0&&ct>=0&&cs!==ct);
 const runs=[], pops=[], stl=[];
 for(let k=0;k<4;k++){ const p=NAV.findPath(q.x,q.z,q.tx,q.tz); pops.push(NAV.stats.lastNodes); stl.push(NAV.stats.lastSettles); runs.push(p?p.map(a=>[Math.round(a[0]*1e4)/1e4,Math.round(a[1]*1e4)/1e4]):null); }
 let same=true; for(let k=1;k<4;k++) if(JSON.stringify(runs[k])!==JSON.stringify(runs[0])) same=false;
 const p=runs[0];
 // 路标核验: 只对"端点干净 + 非同行同格早退"的路径判罪; 其余段只计桥接 (起点/终点被 fix() 外推, 无从核验)
 // 判据口径 = NAV.edgeOK (中线全通 或 ±NAV_EDGE_PAD 平行线全通) —— 与 A* 扩展/分量 BFS 同一条;
 // 严格中线 (lineClear) 单列只报不判: 5m 格上的 1~2m 点状道具会挡住格心连线而旁边就有走廊,
 // 那正是本批放宽判据要放过的情形 (量测: dev/_navleg-diag.js)。
 const early=(p&&p.length===1);
 const clean=(!early&&c0.open&&c0.nb>=3&&c1.open&&c1.nb>=3);
 let segs=0, segFail=0, bridge=0, strictFail=0, minOff=-1;
 if(p&&p.length>1){
  let ax=q.x, az=q.z;
  for(let k=0;k<p.length;k++){
   const ok=NAV.edgeOK(ax,az,p[k][0],p[k][1]);
   segs++;
   if(!ok){ if(clean) segFail++; else bridge++; }
   if(ok&&!NAV.lineClear(ax,az,p[k][0],p[k][1])){
    strictFail++;
    if(clean){ // 顺带记下"最小可通侧移": 走廊贴着多远 (≤1.5 是 edgeOK 放行的界)
     const dx=p[k][0]-ax, dz=p[k][1]-az, d=Math.hypot(dx,dz)||1, px=-dz/d, pz=dx/d, steps=Math.max(1,Math.ceil(d/0.9));
     const offOK=off=>{ for(let s=0;s<=steps;s++){ const t=s/steps; if(NAV.blocked2D(ax+dx*t+px*off, az+dz*t+pz*off)) return false; } return true; };
     for(let off=0.25;off<=1.5001;off+=0.25){ if(offOK(off)||offOK(-off)){ if(minOff<0||off<minOff) minOff=off; break; } }
    }
   }
   ax=p[k][0]; az=p[k][1];
  }
 }
 rows.push({tag:q.tag,same,clean,early,path:p?p.length:0,null:!p,sameComp,crossComp,pops:Math.max.apply(null,pops),settles:Math.max.apply(null,stl),
  c0b:!c0.open,c1b:!c1.open,cs,ct,sz0:cs>=0?D.csize[cs]:-1,sz1:ct>=0?D.csize[ct]:-1,segFail,segs,bridge,strictFail,minOff});
}
return {rows, pops:NAV.stats.nodes, calls:NAV.stats.calls, ok:NAV.stats.ok, fail:NAV.stats.fail, pruned:NAV.stats.pruned, maxNodes:NAV.stats.maxNodes, lastNodes:NAV.stats.lastNodes};
})()`,{QUERIES:q});
	// 逐战役小结
	let mism=0, fn=0, sf=0, br=0, clipped=0, endpointBad=0, cross=0, dupPop=0;
	for(const r of res.rows){
		gQueries++;
		if(!r.same){ mism++; problems.push(`[${title}] 非纯函数 ${r.tag}`); }
		if(r.null&&r.sameComp){ fn++; problems.push(`[${title}] 同分量却 null ${r.tag} (分量 ${r.sz0}/${r.sz1} 格; 弹出 ${r.pops} 落定 ${r.settles})`); }
		if(r.segFail>0){ sf+=r.segFail; problems.push(`[${title}] 路标段穿墙 ${r.tag} (${r.segFail}/${r.segs} 段)`); }
		br+=r.bridge;
		if(r.clean&&!r.null){ gCleanPaths++; gCleanSegs+=r.segs; gCleanSegFail+=r.segFail; }
		if(!r.null){ gPaths++; if(r.segs) gPairs+=r.segs; } else gNull++;
		if(r.c0b||r.c1b) endpointBad++;
		if(r.crossComp) cross++;
		if(r.crossComp||r.c0b||r.c1b) islandProbs.push(`[${title}] ${r.tag}: 起点格${r.c0b?'封锁':'开放(分量'+r.cs+'/'+r.sz0+'格)'} → 终点格${r.c1b?'封锁':'开放(分量'+r.ct+'/'+r.sz1+'格)'}${r.crossComp?' 跨分量':''}`);
		if(r.pops>r.settles+1){ dupPop++; gDupPop++; problems.push(`[${title}] 重复弹出 ${r.tag}: 弹出 ${r.pops} > 落定 ${r.settles}+1`); }
	}
	gMismatch+=mism; gFalseNull+=fn; gSegFail+=sf; gSegBridge+=br;
	gStrictFail+=(res.rows.reduce((a,r)=>a+r.strictFail,0)||0);
	if(res.rows.length&&res.rows.some(r=>r.minOff>0)) gMinOffs.push(...res.rows.filter(r=>r.minOff>0).map(r=>r.minOff));
	gPops+=res.pops; if(res.maxNodes>gMaxPops) gMaxPops=res.maxNodes;
	gOk+=res.ok; gPruned+=res.pruned;
	if(res.maxNodes>=90000) clipped=1;
	gClipped+=clipped;
	console.log(`  · 图${ci} ${title}: 查询 ${res.rows.length} 非纯 ${mism} 同分量null ${fn} 路标失败段 ${sf} 桥接段 ${br} 严格中线不过段 ${res.rows.reduce((a,r)=>a+r.strictFail,0)} 端点异常 ${endpointBad} 跨分量 ${cross} 平均弹出 ${Math.round(res.pops/Math.max(1,res.calls))} 最大 ${res.maxNodes}`);
}

section('① 沙箱装载');
assert(`全链 ${HEAD.length} 文件 × ${camps.length} 战役零错误`, bootErrs.length===0, bootErrs.slice(0,3).join(' | '));
section('② 纯函数 (同入参 4 次同结果)');
assert(`findPath 是纯函数 (${gQueries} 个查询 × 4 次)`, gMismatch===0, gMismatch?`${gMismatch} 处不一致; 例: ${problems.find(p=>p.includes('非纯'))}`:'');
section('③ 无假失败 (分量表说可达就不许 null)');
assert(`同分量查询无一返回 null`, gFalseNull===0, gFalseNull?`${gFalseNull} 处:`:'');
for(const p of problems.filter(s=>s.includes('同分量却 null')).slice(0,20)) console.log('   · '+p);
section('④ 路标可核验 (端点干净路径段段过 NAV.edgeOK —— 判据与 A* 扩展同源)');
assert(`干净端点路径零穿墙段`, gCleanSegFail===0,
	`干净路径 ${gCleanPaths} 条 / 段 ${gCleanSegs}, 走廊不过 ${gCleanSegFail}` +
	(gCleanSegFail?`; 例: ${problems.find(p=>p.includes('路标段穿墙'))}`:'') + ` (端点外推桥接段 ${gSegBridge} 段, 不计入判据)`);
console.log(`  附: 严格中线 (lineClear) 不过但走廊可通的段 ${gStrictFail} 段` +
	(gStrictFail?` (最小可通侧移 ${gMinOffs.length?Math.min.apply(null,gMinOffs)+'~'+Math.max.apply(null,gMinOffs):'?'}m, ≤NAV_EDGE_PAD=1.5 即判据放行的界; 逐段量测见 dev/_navleg-diag.js)`:''));
section('⑤ 代价 (未被硬上限截断 / 无重复弹出)');
assert(`无查询撞 SEARCH_NODES 硬上限`, gClipped===0, `成功 ${gOk} / null ${gNull} / 分量剪枝 ${gPruned}; 平均弹出 ${Math.round(gPops/Math.max(1,gQueries*4))} 最大 ${gMaxPops}`);
assert('无重复弹出 (索引式堆: 弹出数 == 落定数, 最多差 1)', gDupPop===0,
	gDupPop?`${gDupPop} 个查询弹出>落定; 例: ${problems.find(p=>p.includes('重复弹出'))}`:'索引式堆每格每方向仅一项, 堆内不存在陈旧副本');

section('⑥ 端点体检 (出生点/旗点自身落格与连通性, 只报不判)');
console.log(`  端点落封锁格或跨分量的查询: ${islandProbs.length} 条`);
for(const s of islandProbs.slice(0,40)) console.log('   · '+s);
if(islandProbs.length>40) console.log(`   · …(其余 ${islandProbs.length-40} 条省略)`);

// ── ⑦ 判据的合成对照: 拿真几何 (addBoxCollider + NAV.refresh) 量"放宽到什么程度" ──
// 本批把"边界可通"放宽成「中线 或 ±NAV_EDGE_PAD 平行线」, 那么判据必须能同时做到:
//   ① 1m 厚 × 14m 长的墙横在带上 → 中线与两条平行线**全被挡** ⇒ edgeOK 必须为假 (挡住墙才算合格)
//   ② 一件点状道具 → 中线不过, 但两侧 1.5m 处是空走廊 ⇒ edgeOK 为真 (这是放宽的目的)
// 顺带量出翻转尺寸: OCC 是 1m 格 + 0.6m 外扩, **被占格按"与足迹相交"标记** ⇒ 有效拦宽 ≈ 足迹+1 格,
// 所以"点状"到底多小才算点状, 只能实测 (下面逐档列出), 不当成想当然。
section('⑦ 判据的合成对照 (真几何: 墙必须被拒 / 点状道具逐档量出可绕行上限)');
{
	const z=boot(0);   // 诺曼底: 图心一带是开阔农田, 便于找净空带
	const r=N(z.ctx,`(()=>{
const clearLine=(x1,z1,x2,z2,off)=>{ const dx=x2-x1,dz=z2-z1,d=Math.hypot(dx,dz)||1,px=-dz/d*off,pz=dx/d*off,steps=Math.max(1,Math.ceil(d/0.9));
 for(let s=0;s<=steps;s++){ const t=s/steps; if(NAV.blocked2D(x1+dx*t+px,z1+dz*t+pz)) return false; } return true; };
const lanes=[]; const M=MAP_SIZE/2-40;
for(let zz=-M;zz<=M&&lanes.length<6;zz+=8){
 for(let xx=-M;xx<=M-30&&lanes.length<6;xx+=8){
  const h0=standHeight(xx,zz), h1=standHeight(xx+24,zz);
  if(Math.abs(h0-h1)>1.0) continue;                 // 只取近乎水平的带子 (盒底不会半埋/悬空)
  let ok=true;
  for(let o=-2.25;o<=2.2501;o+=0.75){ if(!clearLine(xx,zz,xx+24,zz,o)){ ok=false; break; } }
  if(!ok) continue;
  if(lanes.some(L=>Math.hypot(L.x-xx,L.z-zz)<40)) continue;
  lanes.push({x:xx,z:zz,h:(h0+h1)/2});
 }
}
if(lanes.length<6) return {err:'未找到六条互相隔离的净空带 (找到 '+lanes.length+')'};
const out=[];
// 0 号带: 1m 厚 × 14m 长 的墙 (垂直于测试带) —— 必须被拒
const W=lanes[0];
addBoxCollider(W.x+12, W.h+1.1, W.z, 1.0, 2.2, 14);
out.push({kind:'墙 1.0m 厚 × 14m 长', sz:1.0, x:W.x, z:W.z});
// 1~5 号带: 逐档点状道具 (0.2 ~ 1.0m 立方)
const sizes=[0.2,0.4,0.6,0.8,1.0];
for(let i=0;i<sizes.length;i++){
 const L=lanes[i+1];
 addBoxCollider(L.x+12, L.h+1.1, L.z, sizes[i], 2.2, sizes[i]);
 out.push({kind:'点状道具 '+sizes[i].toFixed(1)+'m 立方', sz:sizes[i], x:L.x, z:L.z});
}
NAV.refresh();
for(const o of out){
 o.line=!!NAV.lineClear(o.x,o.z,o.x+24,o.z);
 o.edge=!!NAV.edgeOK(o.x,o.z,o.x+24,o.z);
 // 最小可通侧移 (走廊贴在多远处)
 o.minOff=-1;
 for(let off=0.25;off<=2.0001;off+=0.25){
  const dx=24, dz=0, d=24, px=0, pz=1, steps=Math.max(1,Math.ceil(d/0.9));
  const ok=of=>{ for(let s=0;s<=steps;s++){ const t=s/steps; if(NAV.blocked2D(o.x+dx*t+px*of, o.z+dz*t+pz*of)) return false; } return true; };
  if(ok(off)||ok(-off)){ o.minOff=off; break; }
 }
}
return out;
})()`);
	if(r.err) assert('合成对照 (净空带定位)', false, r.err);
	else{
		const wall=r.find(o=>o.sz===1.0&&o.kind.indexOf('墙')===0);
		assert('合成对照: 1m 厚 × 14m 长 的墙被 edgeOK 拒 (判据不放墙)',
			wall&&wall.edge===false, `中线可通=${wall.line} 走廊可通=${wall.edge} 最小可通侧移=${wall.minOff} (墙位 ${wall.x+12},${wall.z})`);
		const dot=r.filter(o=>o.kind.indexOf('点状')===0);
		const pass=dot.filter(o=>o.line===false&&o.edge===true);
		const flip=dot.find(o=>o.edge===false);
		assert('合成对照: 点状道具存在"中线不过 / 走廊过"的档 (放宽的目的就在这一类)',
			pass.length>0, pass.length?`合格档: ${pass.map(o=>o.sz.toFixed(1)+'m(侧移 '+o.minOff+')').join(' / ')}`:'全部档位都被判死 (放宽没起作用)');
		console.log(`  量出的翻转: ` + dot.map(o=>`${o.sz.toFixed(1)}m 中线${o.line?'通':'阻'}/走廊${o.edge?'通':'阻'}/侧移${o.minOff<0?'>2':o.minOff}`).join(' · ') +
			(flip?` ⇒ 有效拦宽超过 ±1.5m 之后判死 (第 ${flip.sz.toFixed(1)}m 档)`:''));
	}
}

console.log(`\n${NEG?'【阴性对照】':'【正向】'} ✓ ${OK.length} / ✗ ${BAD.length}`);
const want = NEG ? BAD.length>0 : BAD.length===0;
if(NEG) console.log(want?'  阴性对照按预期报红 → 判据确实在测这两条修复':'  ⚠ 阴性对照没报红: 判据没测到修复点, 需要重写判据');
process.exit(want?0:1);
