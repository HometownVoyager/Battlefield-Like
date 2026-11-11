// ─────────────────────────────────────────────
// dev/verify-navspots-20260926.js —— 出生点/旗点/基地点"可站立性"体检 (2026-09-26, 只读)
// 用法: node dev/verify-navspots-20260926.js [战役序号...]
// 逐点报: 该点自身是否站得住 (occBlocked) / 最近可站立点多远 / 所在 NAV 分量与其队伍主基地是否同一分量
//   · 判罪口径:
//     ✗ 孤岛  = 该点分量 != 本队主基地分量 且 分量 < 400 格 (400 格 = 100×100m, 小于这个的"口袋"必是意外)
//     ✗ 远外推= 自身站不住, 且最近可站立点 > 6m (出生即卡在碰撞体里 / 目标点落在建筑体内部)
//     ~ 近旁  = 自身站不住但 6m 内有落脚点 (旗杆/木箱这类小碰撞体所致, fix()/落点微调即可, 只报不判)
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const SRC=f=>fs.readFileSync(path.join(root,f),'utf8');
const HEAD=['js/00-config.js','js/00b-i18n.js','js/00c-procgen.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js',
'js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js',
'js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js',
'js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/16-aircraft.js',
'js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js',
'js/22a-menuart.js','js/23-deploy.js','js/23b-worldrestore.js','js/25-zombies.js','js/24-main.js'];
const {sandbox,document,window}=require('./_bootstub.js');
require('./_bootpatch.js').patch(sandbox);
// 07-nav 内部表 (open/comp/csize) 不在导出表里 → 文本补一个只读 dbg 导出 (对源码语义零改动)
const NAVSRC=SRC('js/07-nav.js').replace('return { findPath, blocked2D:','return { dbg:{open,N,SP,OFF,idx,toW,comp,csize}, findPath, blocked2D:');
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
	try{ vm.runInContext('document.getElementById("startBtn").onclick();',ctx); }catch(e){ errs.push('startBtn: '+String(e&&e.message||e)); }
	return {ctx,errs};
}
const DUMP=process.argv.includes('--dump');
const N=(ctx,code)=>vm.runInContext(code,ctx);
const nCamp=N(boot(0).ctx,'CAMPAIGNS.length');
const camps=process.argv.slice(2).filter(a=>/^\d+$/.test(a)).map(Number);

let bad=0, soft=0, ok=0, bootErr=[];
if(!camps.length) for(let ci=0;ci<nCamp;ci++) camps.push(ci);
for(const ci of camps){
	const {ctx,errs}=boot(ci);
	if(errs.length) bootErr=bootErr.concat(errs.map(e=>`[图${ci}] `+e));
	const r=N(ctx,`(()=>{
const b0=(typeof BASES!=='undefined'&&BASES)?BASES[0]:null, b1=(typeof BASES!=='undefined'&&BASES)?BASES[1]:null;
if(!b0||!b1) return null;
const D=NAV.dbg;
const toG=(x,z)=>[clamp(Math.round((x+D.OFF)/D.SP),0,D.N-1), clamp(Math.round((z+D.OFF)/D.SP),0,D.N-1)];
const compAt=(x,z)=>{ const g=toG(x,z); const c=D.comp[D.idx(g[0],g[1])]; return {c,sz:c>=0?D.csize[c]:0}; };
// 最近可站立点 (环扫到 40m; 用 freeSpot 同口径的 occBlocked 判)
const nearestFree=(x,z,R)=>{ if(!occBlocked(x,z)) return 0;
 for(let r=1;r<=R;r++){ for(let a=0;a<16;a++){ const th=a/16*Math.PI*2;
  if(!occBlocked(x+Math.cos(th)*r*1.0, z+Math.sin(th)*r*1.0)) return r; } }
 return -1; };
// 主分量 = 全图最大分量
let main=0, mainSz=0, openTot=0;
const seen={};
for(let k=0;k<D.comp.length;k++){ const c=D.comp[k]; if(c<0) continue; const s=D.csize[c]; openTot++;
 if(!seen[c]){ seen[c]=1; if(s>mainSz){ mainSz=s; main=c; } } }
const pts=[];
const push=(kind,team,name,x,z)=>{ const cp=compAt(x,z), bc=team===0?compAt(b0.x,b0.z):compAt(b1.x,b1.z);
 pts.push({kind,team,name,x,z,blocked:!!occBlocked(x,z),nf:nearestFree(x,z,40),comp:cp.c,sz:cp.sz,baseComp:bc.c,baseSz:bc.sz}); };
push('基地','0','基地0',b0.x,b0.z); push('基地','1','基地1',b1.x,b1.z);
for(const sp of (CAMPAIGN.spawns||[])) push('强点',String(sp.team),sp.name||'',sp.x,sp.z);
const fls=(typeof FLAGS!=='undefined'&&FLAGS)?FLAGS:[];
for(const fl of fls) push('旗点','-',fl.name||'',fl.x,fl.z);
// 实际出生落点体检 (端到端判据): 开局后每个步兵 (除车组) 的落点是否"走得出去" ——
// 这才是本条真正的验收口径 (配置坐标只是输入; 出生筛选 NAV.spawnSpotOk 才是出口)。
const live=[];
for(const s of soldiers){
 if(!s||s.onVehicle) continue;                     // 车组随车, 不占出生落点
 const cp=compAt(s.pos.x,s.pos.z);
 const bad=(cp.c<0)||(cp.sz>0&&cp.sz<400);
 if(bad) live.push({name:s.name||'',team:s.team,x:Math.round(s.pos.x),z:Math.round(s.pos.z),comp:cp.c,sz:cp.sz,squad:!!s.inSquad,pilot:!!s.pilotOf,cls:s.cls});
}
let liveN=0; for(const s of soldiers) if(s&&!s.onVehicle) liveN++;
return {pts,main,mainSz,openTot,N:D.N,live,liveN};
})()`);
	if(!r){ console.log(`  图${ci}: 无 BASES —— 跳过`); continue; }
	const title=N(ctx,'CAMPAIGNS['+ci+'].title');
	if(DUMP) for(const p of r.pts) console.log(`DUMP\t${title}\t${p.kind}\t${p.name}\t${p.x}\t${p.z}\tcomp=${p.comp}\tsz=${p.sz}\tbaseComp=${p.baseComp}\tblocked=${p.blocked?1:0}`);
	let nBad=0, nSoft=0;
	const lines=[];
	for(const p of r.pts){
		// 判罪口径 (2026-09-26 收紧): 出生类点位 (基地/强点) **跨分量**即判罪 —— 落在那里的兵走不出去,
		// 与分量大小无关 (旧版 sz<400 的门槛把百团南进攻营那种 848 格"沟壑封死的川地"漏掉了)。
		// 旗点只按"站不住且 6m 内无落脚点"判罪 (旗杆自带的碰撞体属正常, 见 ~ 档)。
		const spawnLike=(p.kind==='基地'||p.kind==='强点');
		const crossComp=(p.comp>=0&&p.baseComp>=0&&p.comp!==p.baseComp);
		const farPush=(p.blocked && (p.nf<0||p.nf>6));
		if((spawnLike&&crossComp)||farPush){ nBad++; bad++;
			lines.push(`   ✗ [${title}] ${p.kind}${p.name?'「'+p.name+'」':''}(${p.x},${p.z})${p.blocked?` 站不住, 最近落脚 ${p.nf<0?'>40':p.nf+'m'}`:''}${crossComp?` 跨分量: 所在 ${p.comp}/${p.sz}格 ≠ 本队基地分量 ${p.baseComp}/${p.baseSz}格`:''}`);
		}else if(p.blocked){ nSoft++; soft++;
			lines.push(`   ~ [${title}] ${p.kind}${p.name?'「'+p.name+'」':''}(${p.x},${p.z}) 站不住, 最近落脚 ${p.nf<0?'>40':p.nf+'m'} (小碰撞体, 6m 内有落脚点)`);
		}else if(crossComp){ nSoft++; soft++;
			lines.push(`   ~ [${title}] ${p.kind}${p.name?'「'+p.name+'」':''}(${p.x},${p.z}) 跨分量但不在出生位 (${p.comp}/${p.sz}格 ≠ 基地 ${p.baseComp}/${p.baseSz}格)`);
		}else ok++;
	}
	for(const l of lines) console.log(l);
	console.log(`  · 图${ci} ${title}: 点 ${r.pts.length} 判罪 ${nBad} 近旁微调 ${nSoft} 主分量 ${r.main}/${r.mainSz}格 开放格 ${r.openTot}`);
	// 实际出生落点 (端到端)
	let liveBad=0;
	for(const s of r.live){ liveBad++; bad++;
		console.log(`   ✗ [${title}] 实际出生落点卡死袋: ${s.name}(队${s.team} 兵种${s.cls}${s.squad?' 小队':''}${s.pilot?' 飞行员':''}) (${s.x},${s.z}) 分量 ${s.comp}/${s.sz}格`);
	}
	console.log(`  · 图${ci} 实际步兵落点 ${r.liveN} 人, 卡在死袋里的 ${liveBad} 人`);
	if(!r.live.length) ok+=r.liveN;
}
console.log(`\n合计: ✓ 正常 ${ok} / ~ 近旁微调 ${soft} / ✗ 判罪 ${bad}${bootErr.length?' / 装载错误 '+bootErr.length:''}`);
if(bootErr.length) console.log('装载错误: '+bootErr.slice(0,3).join(' | '));
