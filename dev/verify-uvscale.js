// ─────────────────────────────────────────────
// dev/verify-uvscale.js —— 建筑贴图密度归一 沙箱 (不进 Index.html)
// 用法: node dev/verify-uvscale.js
// 背景 (2026-09-20 用户实机二报): "窗户下面的部分和总体材质总是不同" —— BoxGeometry 六面 UV 恒为
//   0..1 "铺满整面", 贴图密度随构件尺寸漂移: 同一面砖墙上 3.8m 整段墙板的砖≈0.31m, 1.4m 窗台段
//   (窗下那截)的砖只有 0.11m, 0.9m 墙垛细到 0.07m —— 一眼看出"窗下不是同一堵墙"。
// 修法: 00-config.UV_DENSITY (一张贴图覆盖的世界边长 S, 米) + 05-world.uvGeo/scaleBoxUV
//   (面 UV 跨度 = 世界尺寸/S, 按 (尺寸,S) 克隆缓存, 不动 boxGeo 的共享基准几何)。
// 本沙箱分两段, 两段都跑**真实模块**:
//   A 段 载入真实 02-scene.js: UV_DENSITY 与 MAT 的挂载一一对应 (表在 00-config, 不复制数值);
//   B 段 载入真实 05-world/05a/05b/05c 建世界: 逐构件量"一张贴图覆盖的世界尺寸"是否恒等于 S ——
//       ① 六个面全部恒等 (与构件尺寸/朝向无关);
//       ② 整段墙板 vs 窗台/墙垛 两组构件的贴图密度完全一致 (用户看得见的那件事);
//       ③ 阴性对照: 同一批构件按旧口径 (面 UV 0..1) 算出的密度跨度 ≥2× —— 证明断言不是空跑;
//       ④ 未登记材质的构件 UV 保持 0..1 (树皮/树叶/自建材质不受影响);
//       ⑤ uvGeo 不得就地改写 boxGeo 的共享几何 (同尺寸不同材质必须各拿各的 UV)。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const {sandbox,document,window}=require('./_bootstub.js');
const {runCampaign}=require('./_structbase.js');
let failures=0,checks=0;
const fail=m=>{ failures++; console.error('  ✗ '+m); };
const chk=(c,m)=>{ checks++; if(c) console.log('  ✓ '+m); else fail(m); };
const f2=v=>v.toFixed(2);

// ══════════ A 段: 真实 02-scene 的材质挂载 ══════════
console.log('\n── A 段: 00-config.UV_DENSITY → 02-scene.MAT ──');
const actx=(()=>{
	const ctx=vm.createContext(Object.assign({},sandbox));
	ctx.document=document; ctx.window=window; ctx.globalThis=ctx;
	for(const f of ['js/00-config.js','js/02-scene.js']) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
	return ctx;
})();
const UV=vm.runInContext('UV_DENSITY',actx), MAT=vm.runInContext('MAT',actx);
const uvKeys=Object.keys(UV);
chk(uvKeys.length>=10,`UV_DENSITY 登记 ${uvKeys.length} 种建材贴图`);
let missTable=[],missMat=[];
for(const k of uvKeys){
	if(!MAT[k]) missMat.push(k);
	else if(MAT[k].uvRef!==UV[k]) missTable.push(k);
}
chk(missMat.length===0,`表内每个键都在真实 MAT 里${missMat.length?` (缺 ${missMat.join(',')})`:''}`);
chk(missTable.length===0,`真实 MAT 的 uvRef 与表逐值相等${missTable.length?` (不符 ${missTable.join(',')})`:''}`);
// 该挂却没挂的: 有平铺贴图的建材材质, 白名单除外 (地形顶点色/有机拉伸/无贴图)
const EXEMPT={grass:'地形顶点色带底图',bark:'树干有机拉伸',leaves:'树叶有机拉伸',snowCap:'无贴图'};
const unreg=Object.keys(MAT).filter(k=>MAT[k]&&MAT[k].map&&MAT[k].uvRef===undefined&&!EXEMPT[k]);
chk(unreg.length===0,`有贴图的建材材质全部登记${unreg.length?` (漏 ${unreg.join(',')})`:''}`);
let badS=uvKeys.filter(k=>!(UV[k]>0.5&&UV[k]<8));
chk(badS.length===0,`S 取值落在 (0.5,8) 米${badS.length?` (越界 ${badS.join(',')})`:''}`);
chk(vm.runInContext('MAT.snowCap.uvRef===undefined',actx),'无贴图的雪盖材质不参与归一 (无 map 无 uvRef)');
// 绿篱贴图明确"六面各映射整图", 材质不在 MAT 表里 ⇒ 不受归一化影响
chk(!('hedge' in MAT),'绿篱 (TEX.hedge, 自建 hedgeMat) 不在 MAT 表内 ⇒ 保持"六面整图"原设计');

// ══════════ B 段: 真实世界构件的 UV 密度 ══════════
// BoxGeometry 面序 px,nx,py,ny,pz,nz; 每面 4 顶点; 面内世界尺寸 (U,V)
const faceExt=(w,h,d)=>[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];
function audit(campIdx,seedN){
	const {ctx,CAMP}=runCampaign(campIdx,seedN);
	const G=n=>vm.runInContext(n,ctx);
	const world=G('world');
	const recs=[];   // {mat,S,w,h,d,uvSpanU,uvSpanV,faceIdx}
	const plain=[];  // 未登记材质的构件 (对照)
	const nonBox=[]; // 圆柱/锥等非盒构件 (归一只管盒面, 见文件头口径)
	const mname=new Map();
	{ const M=G('MAT'); for(const k in M) if(M[k]&&typeof M[k]==='object') mname.set(M[k],k); }
	(function walk(o){
		if(o.geometry&&o.geometry.parameters&&o.position&&o.geometry.attributes&&o.geometry.attributes.uv){
			const p=o.geometry.parameters, m=o.material||{};
			if(p.width!==undefined&&p.height!==undefined&&p.depth!==undefined&&isFinite(o.position.x)){
				const S=m.uvRef, a=o.geometry.attributes.uv.array;
				const isBox=o.geometry.type==='BoxGeometry';
				const E=faceExt(p.width,p.height,p.depth);
				for(let f=0;f<6;f++){
					let u0=1e9,u1=-1e9,v0=1e9,v1=-1e9;
					for(let k=0;k<4;k++){ const i=f*8+k*2; u0=Math.min(u0,a[i]); u1=Math.max(u1,a[i]); v0=Math.min(v0,a[i+1]); v1=Math.max(v1,a[i+1]); }
					const rec={S,mat:mname.get(m)||'?',w:p.width,h:p.height,d:p.depth,f,su:u1-u0,sv:v1-v0,eu:E[f][0],ev:E[f][1]};
					if(!isBox) nonBox.push(rec);
					else if(S) recs.push(rec);
					else plain.push(rec);
				}
			}
		}
		if(o.children) for(const c of o.children) walk(c);
	})(world);
	return {CAMP,recs,plain,nonBox};
}
for(const ci of [11,0]){
	const {CAMP,recs,plain,nonBox}=audit(ci,42);
	console.log(`\n── B 段: 战役#${ci} ${CAMP.id} —— 登记材质构件 ${recs.length/6} 件 (${recs.length} 面) ──`);
	if(!recs.length){ fail('无登记材质构件 (断言空跑)'); continue; }
	// ① 面 UV 跨度 × S 必须等于该面的世界尺寸 ⇒ 一张贴图覆盖的世界尺寸恒为 S
	let worst=0, worstRec=null;
	for(const r of recs){
		const dU=Math.abs(r.su*r.S-r.eu), dV=Math.abs(r.sv*r.S-r.ev);
		const dd=Math.max(dU,dV);
		if(dd>worst){ worst=dd; worstRec=r; }
	}
	chk(worst<1e-3,`① 全部 ${recs.length} 个面: UV 跨度×S = 世界尺寸 (最大偏差 ${worst.toExponential(1)}m)`+
		(worstRec&&worst>=1e-3?` @${f2(worstRec.w)}x${f2(worstRec.h)}x${f2(worstRec.d)} 面${worstRec.f}`:''));
	// ② 每材质的"一张贴图覆盖的世界尺寸"必须唯一 (密度与构件尺寸无关)
	const byMat=new Map();
	for(const r of recs){
		const k=String(r.S);
		let a=byMat.get(k); if(!a){ a={n:0,u:[1e9,-1e9],v:[1e9,-1e9]}; byMat.set(k,a); }
		a.n++; const iu=r.eu/r.su, iv=r.ev/r.sv;
		a.u[0]=Math.min(a.u[0],iu); a.u[1]=Math.max(a.u[1],iu);
		a.v[0]=Math.min(a.v[0],iv); a.v[1]=Math.max(a.v[1],iv);
	}
	let spreadMax=0, spreadS=0;
	for(const [S,a] of byMat){
		const sp=Math.max(a.u[1]/a.u[0],a.v[1]/a.v[0]);
		if(sp>spreadMax){ spreadMax=sp; spreadS=S; }
	}
	chk(spreadMax<1.001,`② 每种材质的贴图密度唯一 (最大跨度 ${spreadMax.toFixed(4)}× @S=${spreadS}, 共 ${byMat.size} 种)`);
	// ③ 阴性对照: 同一批构件按旧口径 (面 UV 0..1) 的密度跨度
	const oldByMat=new Map();
	for(const r of recs){
		const k=String(r.S);
		let a=oldByMat.get(k); if(!a){ a={u:[1e9,-1e9]}; oldByMat.set(k,a); }
		a.u[0]=Math.min(a.u[0],r.eu); a.u[1]=Math.max(a.u[1],r.eu);
	}
	let oldMax=0, oldS=0;
	for(const [S,a] of oldByMat){ const sp=a.u[1]/a.u[0]; if(sp>oldMax){ oldMax=sp; oldS=S; } }
	chk(oldMax>=2,`③ 阴性对照: 旧口径 (面 UV 0..1) 下同材质密度跨度 ${oldMax.toFixed(2)}× @S=${oldS} ⇒ ② 的断言非空跑`);
	// ④ 未登记材质: UV 仍是 0..1 (树皮/树叶/自建材质不受影响)
	let plainBad=0;
	for(const r of plain){ if(Math.abs(r.su-1)>1e-6||Math.abs(r.sv-1)>1e-6) plainBad++; }
	chk(plainBad===0,`④ 未登记材质的 ${plain.length} 个面 UV 保持 0..1 (越界 ${plainBad})`);
	// ④b 口径边界: 归一只作用于盒面 —— 圆柱/锥(树干·管·柱)的环绕 UV 保持原样
	let nonBoxBad=0;
	for(const r of nonBox){ if(Math.abs(r.su-1)>1e-6||Math.abs(r.sv-1)>1e-6) nonBoxBad++; }
	chk(nonBoxBad===0,`④b 非盒构件 (柱/锥 ${nonBox.length} 面) 环绕 UV 不动 (越界 ${nonBoxBad})`);
}
// ②b 用户看得见的那件事: 同一材质的"整段墙板"与"窗台/墙垛"砖块世界尺寸必须一致
{
	const per=new Map();  // 构件 → {mat,S,long,h,newU,oldU} (两战役合并取样: 砖墙在诺曼底, 石墙在环礁)
	for(const ci of [11,0]){
		const {recs}=audit(ci,42);
		for(const r of recs){
			const id=r.mat+'|'+r.w+'|'+r.h+'|'+r.d;
			let p=per.get(id); if(!p){ p={mat:r.mat,S:r.S,long:Math.max(r.w,r.d),h:r.h,newU:1e9,oldU:1e9}; per.set(id,p); }
			p.newU=Math.min(p.newU,r.eu/r.su);          // 归一后: 恒 = S
			p.oldU=Math.min(p.oldU,Math.max(r.w,r.d));  // 旧口径: 竖直大面的水平跨度
		}
	}
	const g=new Map();    // 材质 → {big:[], small:[]}
	for(const [,p] of per){
		let e=g.get(p.mat); if(!e){ e={big:[],small:[]}; g.set(p.mat,e); }
		if(p.long>=3.0&&p.h>=1.5) e.big.push(p);
		else if(p.long<=1.6&&p.h<=1.6) e.small.push(p);
	}
	let both=[], bad=[], worstMat='', worst=0;
	for(const [mat,e] of g){
		if(e.big.length<3||e.small.length<3) continue;
		both.push(mat+'('+e.big.length+'/'+e.small.length+')');
		const bU=Math.min(...e.big.map(p=>p.newU)), sU=Math.min(...e.small.map(p=>p.newU));
		if(Math.abs(bU-sU)>1e-6) bad.push(`${mat} ${f2(bU)}≠${f2(sU)}`);
		const bO=Math.max(...e.big.map(p=>p.oldU)), sO=Math.min(...e.small.map(p=>p.oldU));
		if(bO/sO>worst){ worst=bO/sO; worstMat=mat; }
	}
	chk(both.length>=3&&bad.length===0,`②b 有大小两类构件的材质 ${both.length} 种, 贴图密度全部相同${bad.length?` (不符 ${bad.join(',')})`:''}  [${both.join(' ')}]`);
	chk(worst>=2,`②b 阴性对照: 旧口径下 ${worstMat} 的整段墙板/窗台砖块尺寸差 ${worst.toFixed(2)}× (归一后 1.00×)`);
}
// ⑤ uvGeo 不就地改写共享几何
{
	const {ctx}=runCampaign(11,42);
	const r=vm.runInContext(`(()=>{
		const g=boxGeo(2.00,1.00,0.50);
		const before=Array.prototype.slice.call(g.attributes.uv.array);
		const a=uvGeo(g,MAT.brick), b=uvGeo(g,MAT.stone);
		const same=a===b, touched=Array.prototype.slice.call(g.attributes.uv.array).some((v,i)=>Math.abs(v-before[i])>1e-9);
		return {same,touched,base:g.attributes.uv.array[2], aU:a.attributes.uv.array[2], bU:b.attributes.uv.array[2]};
	})()`,ctx);
	chk(!r.touched,'⑤ uvGeo 不改写 boxGeo 的共享基准几何');
	chk(!r.same,'⑤ 同尺寸不同材质各拿各的 UV 几何 (brick≠stone)');
	chk(Math.abs(r.base-1)<1e-9,`⑤ 基准几何 UV 保持 0..1 (实测 ${r.base})`);
	chk(Math.abs(r.aU-0.5/1.8)<1e-6&&Math.abs(r.bU-0.5/2.0)<1e-6,
		`⑤ 面 UV 跨度 = 世界尺寸/S (brick ${f2(r.aU)} 期望 ${f2(0.5/1.8)} / stone ${f2(r.bU)} 期望 ${f2(0.5/2.0)})`);
}
console.log(`\n${failures?'✗':'✓'} verify-uvscale: ${checks-failures}/${checks} 通过${failures?` (失败 ${failures})`:''}`);
process.exit(failures?1:0);
