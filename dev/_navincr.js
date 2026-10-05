// ─────────────────────────────────────────────
// dev/_navincr.js —— 增量重烘焙 等价性 + 提速 判据 (只读探针, 2026-09-26 性能批)
// 做法: 每次做一处**局部改动** (塌一堵墙 / 烧一格火 / 碾一段铁丝网 / 造一件工事) 后
//   ① 走自适应 refresh() (应为增量)  → 快照 open/四张边表/分量划分
//   ② 走 refresh(true) (强制全量)     → 再快照
//   两份快照必须逐格一致: open 逐格相同; 四张边表逐格相同; 分量**划分**相同 (编号可能不同 ⇒ 用
//   "同分量格集合的最小下标"做规范化后再比, 这才是划分的规范形)。
// 另计: 每次改动的 refreshMs (增量) 与全量 refreshMs 的对比。
// 用法: node dev/_navincr.js [campIdx=7]
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const SRC=f=>fs.readFileSync(path.join(root,f),'utf8');
const campIdx=process.argv[2]!==undefined?parseInt(process.argv[2]):7;

// 与 verify-nav 同一手法: 文本补 dbg 导出读内部表 (对源码语义零改动)
let navSrc=SRC('js/07-nav.js');
const anchor='return { findPath, blocked2D:';
if(navSrc.indexOf(anchor)<0){ console.error('07-nav 导出锚点未找到'); process.exit(1); }
navSrc=navSrc.replace(anchor,'return { dbg:{open,eH,eV,eD1,eD2,N,SP,OFF,idx,comp,csize}, findPath, blocked2D:');
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
		try{ vm.runInContext(f==='js/07-nav.js'?navSrc:SRC(f),ctx,{filename:f}); }
		catch(e){ errs.push(f+': '+String(e&&e.message||e)); }
	}
	try{
		const btn=document.getElementById('startBtn');
		if(btn&&typeof btn.onclick==='function') vm.runInContext('document.getElementById("startBtn").onclick();',ctx);
	}catch(e){ errs.push('startBtn: '+String(e&&e.message||e)); }
	return {ctx,errs};
}
const {ctx,errs}=boot(campIdx);
if(errs.length) console.log('装载告警: '+errs.slice(0,3).join(' | '));
const N=(code,vars)=>{ if(vars) for(const k of Object.keys(vars)) ctx[k]=vars[k]; return vm.runInContext(code,ctx); };

// 规范化分量划分: 同分量格 → 该分量最小格下标 (编号无关的规范形)
const CANON=`(()=>{
const D=NAV.dbg, NN=D.N*D.N;
const min=new Int32Array(NN).fill(0x7fffffff);
for(let k=0;k<NN;k++){ const g=D.comp[k]; if(g<0) continue; if(k<min[g]) min[g]=k; }
const out=new Int32Array(NN);
for(let k=0;k<NN;k++){ const g=D.comp[k]; out[k]=g<0?-1:min[g]; }
return out;
})()`;
const SNAP=`(()=>{const D=NAV.dbg,NN=D.N*D.N;
// 表不变量: ①comp≥0 ⟺ 开放格 ②每个分量的 csize 必须等于该分量实际格数
let onBlocked=0, idMax=-1;
for(let k=0;k<NN;k++){ if(!D.open[k]&&D.comp[k]>=0) onBlocked++; if(D.comp[k]>idMax) idMax=D.comp[k]; }
const cnt=new Int32Array(idMax+1);
for(let k=0;k<NN;k++){ const g=D.comp[k]; if(g>=0) cnt[g]++; }
let sizeErr=0, sizeFirst=null;
for(let g=0;g<=idMax;g++){ if(!cnt[g]) continue; const cs=D.csize[g]; if(cs!==undefined&&cs!==cnt[g]){ sizeErr++; if(!sizeFirst) sizeFirst='c'+g+': csize='+cs+' 实际='+cnt[g]; } }
return {open:Array.prototype.slice.call(D.open),eH:Array.prototype.slice.call(D.eH),eV:Array.prototype.slice.call(D.eV),
 eD1:Array.prototype.slice.call(D.eD1),eD2:Array.prototype.slice.call(D.eD2),canon:Array.prototype.slice.call(${CANON}),
 onBlocked, sizeErr, sizeFirst};})()`;

function cmp(a,b){
	const diff={open:0,eH:0,eV:0,eD1:0,eD2:0,canon:0};
	let first=null;
	for(const key of ['open','eH','eV','eD1','eD2','canon']){
		const A=a[key], B=b[key];
		for(let k=0;k<A.length;k++) if(A[k]!==B[k]){ diff[key]++; if(!first) first=key+'@'+k+' ('+A[k]+' vs '+B[k]+')'; }
	}
	return {diff,first};
}

function scenario(name,setup){
	const s=N(setup);
	const t1=N('(()=>{const t=Date.now(); NAV.refresh(); return {ms:Date.now()-t, msNav:NAV.stats.refreshMs, part:NAV.stats.partBakes, full:NAV.stats.fullBakes, skip:NAV.stats.skipBakes, dirty:NAV.stats.lastDirty};})()');
	const inc=N(SNAP);
	const t2=N('(()=>{const t=Date.now(); NAV.refresh(true); return Date.now()-t;})()');
	const full=N(SNAP);
const {diff,first}=cmp(inc,full);
const bad=diff.open+diff.eH+diff.eV+diff.eD1+diff.eD2+diff.canon;
// 表不变量 (两种路径都必须满足): 封锁格不得带分量号; csize 必须等于分量实际格数
const inv=(inc.onBlocked+full.onBlocked)+(inc.sizeErr+full.sizeErr);
console.log(`${bad||inv?'✗':'✓'} ${name.padEnd(26)} 改动=${JSON.stringify(s)} 增量 ${String(t1.msNav).padStart(4)}ms (总 ${String(t1.ms).padStart(4)}ms, 脏格 ${t1.dirty}, part=${t1.part} full=${t1.full} skip=${t1.skip})  全量 ${String(t2).padStart(4)}ms  提速 ${(t2/Math.max(1,t1.ms)).toFixed(1)}×  ${bad?'【不一致】'+JSON.stringify(diff)+' '+first:''}${inv?' 【不变量】封锁格带号 '+inc.onBlocked+'/'+full.onBlocked+' csize 错 '+inc.sizeErr+'/'+full.sizeErr+' '+[inc.sizeFirst,full.sizeFirst].join(' | '):''}`);
return bad+inv;
}
console.log('== 增量 vs 全量 等价性 (图 ' + N('CAMPAIGN.id') + ') ==');
let bad=0;
bad+=scenario('基线 (无改动)', `'noop'`);

// ① 塌一堵墙: 挑一个占地较大的非 dead 盒, killBox (与 05-world 拆楼同一支)
bad+=scenario('塌一堵墙 (killBox)', `(()=>{
let bi=-1,best=0;
for(let i=0;i<BOXES.length;i++){ const b=BOXES[i]; if(b.dead) continue; const a=(b.maxX-b.minX)*(b.maxZ-b.minZ)*(b.maxY-b.minY); if(a>best){best=a;bi=i;} }
const b=BOXES[bi];
if(typeof killBox==='function') killBox(b); else { b.dead=true; b.minX=99999;b.minY=99999;b.minZ=99999;b.maxX=99999.1;b.maxY=99999.1;b.maxZ=99999.1; }
return 'box#'+bi+' 体积'+best.toFixed(1);})()`);

// ② 拆一栋楼的中等盒 (随机挑 3 个)
bad+=scenario('连拆 3 个碰撞盒', `(()=>{
let n=0;
for(let i=0;i<BOXES.length&&n<3;i++){ const b=BOXES[i]; if(b.dead) continue; if((b.maxX-b.minX)<1.5||(b.maxZ-b.minZ)<1.5) continue;
 if(typeof killBox==='function') killBox(b); else { b.dead=true; b.minX=99999;b.minY=99999;b.minZ=99999;b.maxX=99999.1;b.maxY=99999.1;b.maxZ=99999.1; } n++; }
return n+' 个';})()`);

// ③ 烧一格火 (04b-fire 的正式入口: 需要 FUEL>0.05 的格)
bad+=scenario('点一格火 (igniteCell)', `(()=>{
let ci=-1;
for(let k=0;k<FUEL.length;k++) if(FUEL[k]>0.3){ ci=k; break; }
if(ci<0) return '无可燃格';
igniteCell(ci,null);
return 'ci='+ci+' active='+FIRE_ACTIVE.length;})()`);

// ④ 碾一段铁丝网 (15-vehicles 口径: alive=false)
bad+=scenario('碾平铁丝网', `(()=>{
for(const w of wires){ if(w.alive){ w.alive=false; return 'wire ('+w.x.toFixed(0)+','+w.z.toFixed(0)+')'; } }
return '无铁丝网';})()`);

// ⑤ 工程兵造一件工事 (registerDynCollider: 动态新增碰撞盒)
bad+=scenario('造工事 (DynCollider)', `(()=>{
const sp=(CAMPAIGN.spawns&&CAMPAIGN.spawns[0])||{x:0,z:0};
registerDynCollider(sp.x+3,heightAt(sp.x+3,sp.z)+0.5,sp.z,4,1,0.6);
registerDynCollider(sp.x+8,heightAt(sp.x+8,sp.z)+0.5,sp.z+2,4,1,0.6);
return 'spawn0 旁 2 件';})()`);

// ⑥ 拆掉刚造的 (killDynCollider)
bad+=scenario('拆工事 (killDynCollider)', `(()=>{
let n=0;
for(const b of BOXES){ if(b.dead) continue; if(b.minX>b.maxX) continue; if((b.maxX-b.minX)<4.5&&(b.maxX-b.minX)>3.5&&(b.maxY-b.minY)<1.2&&(b.maxZ-b.minZ)<0.8){ killDynCollider(b); n++; } }
return n+' 件';})()`);

// ⑦ 散落多处同时改动 (脏矩形很大 → 应退回全量, 但结果必须仍一致)
bad+=scenario('散落 12 处同时拆', `(()=>{
let n=0;
for(let i=0;i<BOXES.length&&n<12;i+=Math.max(1,Math.floor(BOXES.length/24))){ const b=BOXES[i]; if(b.dead) continue;
 b.dead=true; b.minX=99999;b.minY=99999;b.minZ=99999;b.maxX=99999.1;b.maxY=99999.1;b.maxZ=99999.1; n++; }
return n+' 处';})()`);

console.log(`\n${bad?'✗ 存在不一致':'✓ 增量与全量逐格一致 (含分量划分)'}  (不一致项 ${bad})`);
process.exit(bad?1:0);
