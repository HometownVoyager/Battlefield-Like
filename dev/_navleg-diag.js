// ─────────────────────────────────────────────
// dev/_navleg-diag.js —— 一次性诊断 (2026-09-26D): 输出路径里"不过 lineClear 的路标段"到底是什么
// 用法: node dev/_navleg-diag.js [战役序号...]
// 目的: verify-nav-20260926 判据④ 在本批 NAV 判据放宽后报红 (雾林守线 8 段)。
//       本脚本对每个失败段量四件事, 用来区分「墙体横穿(真缺陷)」与「小道具擦角(可绕行)」:
//         ① 中线被挡的样本数与"最大连续受阻长度"(m) —— 墙是长的, 道具是短的
//         ② 受阻点的 OCC 值 (1=阻挡 / 2=深水)
//         ③ 逐档平移 (0.25m 步进, 到 2.0m) 找"最小可通侧移" —— 小值 = 旁边就是走廊
//         ④ 受阻点周围 1m 格阵, 看阻挡体的形状 (点状 / 片状 / 线状)
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const SRC=f=>fs.readFileSync(path.join(root,f),'utf8');
const campArg=process.argv.slice(2).filter(a=>/^\d+$/.test(a)).map(Number);

const NAVSRC=(()=>{
	let s=SRC('js/07-nav.js');
	const anchor='return { findPath, blocked2D:';
	if(s.indexOf(anchor)<0) throw new Error('07-nav 导出锚点未找到');
	return s.replace(anchor,'return { dbg:{open,eH,eV,eD1,eD2,N,SP,OFF,idx,toW,comp,csize}, findPath, blocked2D:');
})();
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
	try{
		const btn=document.getElementById('startBtn');
		if(btn&&typeof btn.onclick==='function') vm.runInContext('document.getElementById("startBtn").onclick();',ctx);
	}catch(e){ errs.push('startBtn: '+String(e&&e.message||e)); }
	return {ctx,errs};
}
const N=(ctx,code,vars)=>{ if(vars) for(const k of Object.keys(vars)) ctx[k]=vars[k]; return vm.runInContext(code,ctx); };

const campTotal=N(boot(0).ctx,'CAMPAIGNS.length');
const camps=campArg.length?campArg:Array.from({length:campTotal},(_,i)=>i);

for(const ci of camps){
	const {ctx,errs}=boot(ci);
	if(errs.length){ console.log(`[图${ci}] 装载错误: `+errs.slice(0,3).join(' | ')); continue; }
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
	if(!q) continue;
	const res=N(ctx,`(()=>{
const D=NAV.dbg;
const occV=(x,z)=>occBlocked(x,z)?1:0;
const lineInfo=(x1,z1,x2,z2)=>{                 // 中线逐 0.9m 采样: 返回受阻样本位置
 const d=Math.hypot(x2-x1,z2-z1), steps=Math.max(1,Math.ceil(d/0.9)), hits=[];
 for(let s=1;s<steps;s++){ const t=s/steps, x=x1+(x2-x1)*t, z=z1+(z2-z1)*t; if(occBlocked(x,z)) hits.push({t,x,z}); }
 return {d,steps,hits};
};
const shiftOK=(x1,z1,x2,z2,off)=>{                // 沿垂直方向平移 off 后中线是否全通
 const dx=x2-x1,dz=z2-z1,len=Math.hypot(dx,dz)||1, px=-dz/len*off, pz=dx/len*off;
 const d=Math.hypot(dx,dz), steps=Math.max(1,Math.ceil(d/0.9));
 for(let s=0;s<=steps;s++){ const t=s/steps; if(occBlocked(x1+(x2-x1)*t+px, z1+(z2-z1)*t+pz)) return false; }
 return true;
};
const shape=(cx,cz)=>{                            // 以受阻点为中心, 3m 半径的 1m 格阵
 let out=[];
 for(let dz=-3;dz<=3;dz++){ let row=''; for(let dx=-3;dx<=3;dx++){ row+= occBlocked(cx+dx,cz+dz)?'#':'.'; } out.push(row); }
 return out;
};
const rows=[];
for(const qq of QUERIES){
 const c0=D.idx(...(()=>{const g=[clamp(Math.round((qq.x+D.OFF)/D.SP),0,D.N-1),clamp(Math.round((qq.z+D.OFF)/D.SP),0,D.N-1)];return g;})());
 const c1=D.idx(...(()=>{const g=[clamp(Math.round((qq.tx+D.OFF)/D.SP),0,D.N-1),clamp(Math.round((qq.tz+D.OFF)/D.SP),0,D.N-1)];return g;})());
 const openN=(ci0,cj0)=>{ if(ci0<0||cj0<0||ci0>=D.N||cj0>=D.N||!D.open[D.idx(ci0,cj0)]) return -1;
  let nb=0; if(ci0>0&&D.open[D.idx(ci0-1,cj0)])nb++; if(ci0<D.N-1&&D.open[D.idx(ci0+1,cj0)])nb++;
  if(cj0>0&&D.open[D.idx(ci0,cj0-1)])nb++; if(cj0<D.N-1&&D.open[D.idx(ci0,cj0+1)])nb++; return nb; };
 const G=(x,z)=>[clamp(Math.round((x+D.OFF)/D.SP),0,D.N-1),clamp(Math.round((z+D.OFF)/D.SP),0,D.N-1)];
 const g0=G(qq.x,qq.z), g1=G(qq.tx,qq.tz);
 const clean=(D.open[c0]&&openN(g0[0],g0[1])>=3&&D.open[c1]&&openN(g1[0],g1[1])>=3);
 const p=NAV.findPath(qq.x,qq.z,qq.tx,qq.tz);
 if(!p||p.length<=1) continue;
 let ax=qq.x, az=qq.z;
 for(let k=0;k<p.length;k++){
  const bx=p[k][0], bz=p[k][1];
  if(!NAV.lineClear(ax,az,bx,bz)){
   const li=lineInfo(ax,az,bx,bz);
   // 最大连续受阻长度 (按样本间隔估算)
   let run=0, best=0; for(const h of li.hits){ if(h.__prev!==undefined){} }
   let prev=null, span=0;
   for(const h of li.hits){ if(prev!==null && (h.t-prev.t)<=1.5/li.steps+1e-9) span+=(h.t-prev.t)*li.d; else span=0; prev=h; if(span>run) run=span; }
   run=run+0.9;   // 首样本自身的 0.9m
   const h0=li.hits[0]||{x:(ax+bx)/2,z:(az+bz)/2};
   let minOff=-1;
   for(let off=0.25;off<=2.001;off+=0.25){ if(shiftOK(ax,az,bx,bz,off)||shiftOK(ax,az,bx,bz,-off)){ minOff=off; break; } }
   rows.push({tag:qq.tag, k, clean, from:[r4(ax),r4(az)], to:[r4(bx),r4(bz)], d:r2(li.d), hits:li.hits.length, steps:li.steps,
     runLen:r2(run), minOff:minOff, shift15:(shiftOK(ax,az,bx,bz,1.5)||shiftOK(ax,az,bx,bz,-1.5)), hit0:[r2(h0.x),r2(h0.z)], shape:shape(h0.x,h0.z)});
  }
  ax=bx; az=bz;
 }
}
return rows;
function r2(v){ return Math.round(v*100)/100; }
function r4(v){ return Math.round(v*1e4)/1e4; }
})()`,{QUERIES:q});
	if(!res.length) continue;
	console.log(`\n════ 图${ci} ${title}: ${res.length} 个不过 lineClear 的段 ════`);
	for(const r of res){
		console.log(`  · ${r.tag} 段${r.k} ${r.clean?'[端点干净]':'[端点外推]'} ${JSON.stringify(r.from)}→${JSON.stringify(r.to)} 长${r.d}m`);
		console.log(`      中线受阻样本 ${r.hits}/${r.steps} · 最大连续受阻 ≈${r.runLen}m · 最小可通侧移 ${r.minOff<0?'>2.0':r.minOff}m · ±1.5m 平行线可通=${r.shift15}`);
		console.log(`      首个受阻点 ${JSON.stringify(r.hit0)} 邻域 1m 格阵 (每行 dz=-3..3, 每列 dx=-3..3):`);
		for(const row of r.shape) console.log('        '+row);
	}
}
