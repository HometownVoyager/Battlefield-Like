// ─────────────────────────────────────────────
// dev/_naval-model-selfcheck.js —— 15e-navmodels.js 炮艇重做批自检 (WS1 · 2026-09-21)
// 用法: node dev/_naval-model-selfcheck.js            # 全量断言, 有失败则 exit 1
//       node dev/_naval-model-selfcheck.js SIL=1      # 另打俯视剪影 (炮塔扫掠圈 vs 甲板件)
//       node dev/_naval-model-selfcheck.js DUMP=1     # 另打逐件 AABB / 接合深度明细
//
// 为什么用**真 three.js r152** (dev/vendor/three.min.js, 与 index.html 的 CDN 同版 REVISION=152):
//   本轮要证的量全是**世界空间**的 —— 包围盒 / 相接体积重叠 / 浮件 / 炮塔扫掠净空 / 炮口锚点位置。
//   自造几何桩 (旧 dev/_navmodel-selfcheck.js 的缺省档) 只能按参数近似 AABB, 证不了"体积重叠"与
//   "getWorldPosition 随 turretG 转动"。真 three 在 Node 里不需要 WebGL (几何/矩阵/Box3 全是纯数学)。
//
// 量测口径 (与 15e 文件头"尺寸口径"一一对应, 也是给 verifier 的对照口径):
//   ① 长/宽 = 整车包围盒 (Box3.setFromObject 逐件并集) vs spec.hullL/hullW (±15% 红线)
//   ② 浮件 = 该件与**任何**其他件都无正体积相交, 且 AABB 最近距离 > 0.02m  ⇒ 命中即 FAIL
//      接合深度 = 两件 AABB 在三轴上的重叠长度的**最小值** (细件受自身厚度上限, 见豁免表)
//   ③ 炮塔扫掠: 24 个 yaw, 炮塔总成在 turretG 局部系的 AABB 绕环座轴旋转 → 与每个静态件 AABB 判交
//      (用旋转后 AABB 是**保守**近似: 只会多报不会漏报; 实测最小净空远大于该误差)
//      豁免集 = turretG 全部后代 (回转件自身) + 'nmTurretRing' (回转副的**静态半环**, 与塔体设计互嵌)
//   ④ 观瞄: nodes.sight 世界 y == deckY + spec.sightH (±1e-6), 且镜座压进顶盖 ≥0.08 (spec 与几何自洽)
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const DUMP=!!process.env.DUMP, SIL=!!process.env.SIL;
const OK=[],BAD=[];
function assert(name,cond,detail){ (cond?OK:BAD).push(name); console.log(`  ${cond?'✓':'✗'} ${name}${detail?'  '+detail:''}`); }
const f2=v=>(Math.round(v*100)/100).toFixed(2), f3=v=>(Math.round(v*1000)/1000).toFixed(3);
const rel=(a,b)=>Math.abs(a-b)/Math.max(1e-9,Math.abs(b));
const pct=(a,b)=>((a-b)/b*100>=0?'+':'')+((a-b)/b*100).toFixed(1)+'%';

// ══════════════ 真 three.js r152 ══════════════
function loadRealTHREE(){
	const s={console,Math,JSON,Date,String,Number,Object,Array,Set,Map,Error,TypeError,isNaN,parseFloat,parseInt,
		self:null,globalThis:null,
		window:{addEventListener(){},removeEventListener(){},devicePixelRatio:1},
		document:{createElementNS:()=>({style:{}}),createElement:()=>({style:{},getContext:()=>null})},
		navigator:{userAgent:'node'},requestAnimationFrame:()=>0,cancelAnimationFrame(){},
		performance:{now:()=>Date.now()},setTimeout:()=>0,clearTimeout(){},
		URL:{createObjectURL(){return ''},revokeObjectURL(){}},Blob:function(){},Image:function(){}};
	s.self=s; s.globalThis=s;
	const ctx=vm.createContext(s);
	vm.runInContext(fs.readFileSync(path.join(root,'dev/vendor/three.min.js'),'utf8'),ctx,{filename:'dev/vendor/three.min.js'});
	const T=vm.runInContext('THREE',ctx);
	if(!T||!T.REVISION) throw new Error('three.min.js 未挂上 THREE');
	return T;
}
const THREE=loadRealTHREE();

// ══════════════ 沙箱: 00-config + 15e (TEX 只给哑对象 —— 15e 若调纹理方法会当场抛错) ══════════════
const texStub=()=>({__stub:true});
const sandbox={
	console,Math,JSON,Date,Array,Object,Set,Map,isNaN,parseInt,parseFloat,String,Number,Boolean,Error,THREE,
	TEX:{leaves:texStub(),grime:texStub(),metalBrush:texStub(),rust:texStub(),barnacle:texStub(),waterline:texStub(),deckWood:texStub(),wood:texStub(),
		steelPlate:texStub(),concrete:texStub(),canvas:texStub(),stencil:texStub()},   // 2026-09-21B 的 4 张新贴图 (02-scene 已落地)
	TEAM_COL:[0x8fc1ff,0xff9c8a],
	localStorage:{_s:{},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}},
	navigator:{maxTouchPoints:0,userAgent:'node'},
	document:{createElement:()=>({style:{},getContext:()=>null,width:0,height:0}),querySelector:()=>null,body:{appendChild(){},style:{}}},
	window:{addEventListener(){},innerWidth:1280,innerHeight:720},
	performance:{now:()=>Date.now()},requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},
	setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},
};
sandbox.globalThis=sandbox;
const ctx=vm.createContext(sandbox);
const load=f=>vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
load('js/00-config.js');
load('js/15e-navmodels.js');
const API=vm.runInContext('({NAVAL_SPEC,navBuildModel})',ctx);
// 板厚/关节常量从 15e 沙箱**现读** (单源: 谁改 15e 的系数, 自检口径自动跟随, 不会两套数字)
const NM=vm.runInContext('({PLATE:NM_PLATE,JOINT:NM_JOINT,DECK_EMBED:NM_DECK_EMBED,TUR_RING:NM_TUR_RING,SHEER_STEP:NM_SHEER_STEP,YARD_H:NM_YARD_H,SIGHT_R:NM_SIGHT_R,RAILW_B:NM_RAILW_B,RAILH_B:NM_RAILH_B,TUR_CLEAR:NM_TUR_CLEAR,TUR_CLEAR_A:NM_TUR_CLEAR_A,PROP_CLEAR:NM_PROP_CLEAR})',ctx);
const NM_PLATE=NM.PLATE, NM_JOINT=NM.JOINT;
// 2026-09-21B 三条红线从 15e 现读 (单源: 谁改 15e 的系数, 自检口径自动跟随, 不会两套数字)
const NM_TUR_CLEAR=NM.TUR_CLEAR, NM_TUR_CLEAR_A=NM.TUR_CLEAR_A, NM_PROP_CLEAR=NM.PROP_CLEAR;

// ══════════════ 量测工具 (真矩阵链 / 真 Box3) ══════════════
function meshes(grp){
	grp.updateMatrixWorld(true);
	const out=[];
	grp.traverse(o=>{ if(o.isMesh&&o.geometry){ out.push({o,name:o.name||'',box:new THREE.Box3().setFromObject(o)}); } });
	return out;
}
const mn=b=>[b.min.x,b.min.y,b.min.z], mx=b=>[b.max.x,b.max.y,b.max.z];
function union(list){ const b=new THREE.Box3(); b.makeEmpty(); for(const m of list) b.union(m.box); return b; }
function ovl(a,b){ // 三轴重叠长度 (负值 = 该轴分离距离)
	const am=mn(a),ax=mx(a),bm=mn(b),bx=mx(b);
	return [Math.min(ax[0],bx[0])-Math.max(am[0],bm[0]),Math.min(ax[1],bx[1])-Math.max(am[1],bm[1]),Math.min(ax[2],bx[2])-Math.max(am[2],bm[2])];
}
const EPS=1e-9;
const hits=(o)=>o[0]>EPS&&o[1]>EPS&&o[2]>EPS;                  // 正体积相交
const gapDist=(o)=>Math.sqrt(o.reduce((s,v)=>s+(v<0?v*v:0),0));  // 分离时的 AABB 最近距离
const jointDepth=(o)=>hits(o)?Math.min.apply(null,o):0;         // 接合深度 = 三轴重叠最小值
// 薄片豁免表 (接合深度 < NM_JOINT(0.08) 的**几何必然**: 件本身比 0.08 还薄; 仍必须"有正体积相交")
const THIN_EXEMPT={};   // 名字 → 理由 (按件名登记, 逐个在报告里列出)

console.log('═══ 15e-navmodels.js 自检 (炮艇重做批 · WS1) ═══');
console.log(`   真 three.js r152 (dev/vendor/three.min.js)   脚本链: js/00-config.js + js/15e-navmodels.js`);
console.log('   口径: 长/宽/高 = 整车包围盒 vs hullL/hullW/hullH; 浮件 = 无任何正体积相交且最近距离>0.02m\n');

// ══════════════ 逐型构建与量测 ══════════════
const KEYS=['lvt','kami','pt','gyorai'];
const rows={}, allMats={};
for(const k of KEYS){
	const D=API.NAVAL_SPEC[k];
	let R=null,err=null;
	try{ R=API.navBuildModel(D); }catch(e){ err=String(e&&e.stack||e).split('\n').slice(0,3).join(' | '); }
	assert(`${k}: navBuildModel 建得出来`, !!R&&!err, err?('抛错: '+err):'');
	if(!R){ rows[k]={D,err}; continue; }
	const ms=meshes(R.grp), bb=union(ms);
	const mats=new Set(); for(const m of ms) if(m.o.material) mats.add(m.o.material);
	rows[k]={D,R,ms,bb,mats};
	allMats[k]=mats;
}
console.log('');
console.log('型      spec L×W×H          实测 L×W×H            偏差 L/W/H           网格 材质 轮  炮塔');
for(const k of KEYS){
	const r=rows[k]; if(!r.ms) continue;
	const D=r.D,b=r.bb,g=new THREE.Vector3(); b.getSize(g);
	console.log(`${k.padEnd(7)}${(f2(D.hullL)+'×'+f2(D.hullW)+'×'+f2(D.hullH)).padEnd(21)}`
		+`${(f2(g.z)+'×'+f2(g.x)+'×'+f2(g.y)).padEnd(21)}`
		+`${(pct(g.z,D.hullL)+' /'+pct(g.x,D.hullW)+' /'+pct(g.y,D.hullH)).padEnd(21)}`
		+`${String(r.ms.length).padEnd(5)}${String(r.mats.size).padEnd(5)}${String(r.R.wheels.length).padEnd(4)}`
		+`${r.R.turretG?'有(turretG'+r.R.turretG.position.toArray().map(v=>f3(v)).join(',')+')':'-'}`);
}
console.log('');

// ══════════════ 验收 1: 包围盒 ±15% ══════════════
//  艇: 整车包围盒 H 直接对 hullH (含炮塔, 见文件头口径①); 两栖车: H 基准件 = 车体盒 nmHullBox
//  (两栖车整车高 = 车体 + 高于车体的炮塔, 这是 15e 长期口径 —— 此处按车体盒回归, 保证没被我改坏)
for(const k of KEYS){
	const r=rows[k]; if(!r.ms) continue;
	const D=r.D,g=new THREE.Vector3(); r.bb.getSize(g);
	const dL=rel(g.z,D.hullL),dW=rel(g.x,D.hullW);
	if(D.kind==='boat'){
		assert(`${k}: 包围盒 L/W/H 对 spec 偏差 ≤15%`, dL<=0.15&&dW<=0.15&&rel(g.y,D.hullH)<=0.15,
			`实测 ${f2(g.z)}/${f2(g.x)}/${f2(g.y)} m  偏差 ${pct(g.z,D.hullL)}/${pct(g.x,D.hullW)}/${pct(g.y,D.hullH)}  (红线 15%)  注: 艇整车高含炮塔`);
	}else{
		// 2026-09-22 起车体是**一张断面放样曲面**, 为做下水线分色拆成两片 (上体 nmHullBox + 下体 nmHullLower)。
		//   量测口径不变 (车体高 vs hullH), 但基准件 = 两片的并集 —— 只量上体会把折角以下那截漏掉。
		const hullP=[];
		r.R.grp.traverse(o=>{ if(o.isMesh&&(o.name==='nmHullBox'||o.name==='nmHullLower')) hullP.push(o); });
		const hb=new THREE.Box3(); hb.makeEmpty();
		for(const o of hullP){ r.R.grp.updateMatrixWorld(true); hb.union(new THREE.Box3().setFromObject(o)); }
		const hg=new THREE.Vector3(); if(hullP.length) hb.getSize(hg);
		assert(`${k}: 车体盒(车体 上体∪下体)高 对 hullH 偏差 ≤15% (回归: 两栖车口径未动)`, !!hb&&rel(hg.y,D.hullH)<=0.15,
			hullP.length?`车体高 (nmHullBox∪nmHullLower) ${f2(hg.y)}m 偏差 ${pct(hg.y,D.hullH)}; 整车高(含炮塔) ${f2(g.y)}m ${pct(g.y,D.hullH)} (既有口径, 不受本批影响)`:'未找到 nmHullBox/nmHullLower');
	}
}

// ══════════════ 验收 2: 浮件扫描 + 接合深度 ══════════════
// 判据函数化 (主判据与阴性对照共用同一支): 逐件找"与任何其他件都无正体积相交"的件, 再判最近距离
//   浮件 = 无正体积相交 且 AABB 最近距离 > 0.02m; 弱接合 = 有相交但最深嵌合 < NM_JOINT
//   薄片件 (自身最薄处 < NM_JOINT, 如旗面 0.03 / 桨叶 0.06) 深度受件厚上限 ⇒ 单列豁免, 仍要求正体积相交
function floatScan(ms){
	const weak=[],floating=[],thin=[];
	let minDepth=null,minDepthPart='';
	for(let i=0;i<ms.length;i++){
		const a=ms[i]; const sz=new THREE.Vector3(); a.box.getSize(sz);
		const th=Math.min(sz.x,sz.y,sz.z), short=a.name||('#'+i);
		// 件名 (无名的用 AABB 摘要标出 —— 定位"哪一件浮空"必须靠坐标, 不能只给序号)
		const nm=short+`[x ${f2(a.box.min.x)}~${f2(a.box.max.x)}, y ${f2(a.box.min.y)}~${f2(a.box.max.y)}, z ${f2(a.box.min.z)}~${f2(a.box.max.z)}]`;
		let best=0,bestJ=-1,anyHit=false;
		for(let j=0;j<ms.length;j++){
			if(i===j) continue;
			const o=ovl(a.box,ms[j].box);
			if(hits(o)){ anyHit=true; const d=jointDepth(o); if(d>best){ best=d; bestJ=j; } }
		}
		if(!anyHit){
			let dmin=1e9,dj=-1;
			for(let j=0;j<ms.length;j++){ if(i===j) continue; const d=gapDist(ovl(a.box,ms[j].box)); if(d<dmin){ dmin=d; dj=j; } }
			const near=ms[dj];
			const where=`最近件=${(near&&near.name)||('#'+dj)}[x ${f2(near.box.min.x)}~${f2(near.box.max.x)}, y ${f2(near.box.min.y)}~${f2(near.box.max.y)}, z ${f2(near.box.min.z)}~${f2(near.box.max.z)}]`;
			// 浮件 = 无重叠 **且** 最近距离 >0.02m (Lead 冻结判据); ≤0.02m 是"面贴合/0.5mm 级对接"
			// —— 违反"相接必须体积重叠 ≥0.08"的硬规约, 但不算浮件, 单列 weak 报出来
			if(dmin>0.02) floating.push(`${nm} ${where} 距离=${f3(dmin)}m`);
			else weak.push(`${nm} 面贴合/微间隙: 无体积重叠, ${where} 距离=${f3(dmin)}m`);
		}else if(best<NM_JOINT){
			const det=`最深嵌合=${f3(best)}m (对 ${ms[bestJ].name||('#'+bestJ)}, 件厚 ${f3(th)}m)`;
			(th<NM_JOINT?thin:weak).push(`${nm} ${det}`);
		}
		// 非薄片件的"最少嵌合"是整车连接强度的下限指标 (Lead 要求逐型报出)
		if(anyHit&&th>=NM_JOINT&&(minDepth===null||best<minDepth)){ minDepth=best; minDepthPart=short; }
	}
	return {floating,weak,thin,minDepth,minDepthPart};
}
for(const k of KEYS){
	const r=rows[k]; if(!r.ms) continue;
	const fs=floatScan(r.ms); r.fs=fs;
	for(const s of fs.thin) THIN_EXEMPT[`${k}:${s.split('[')[0].trim()}`]=s;
	// 2026-09-21 Lead 裁决⑤: 两栖车与炮艇**同一口径** (原版 lvt/kami 各有 3 件浮件: 双桨 + 舵)
	assert(`${k}: 浮件扫描 0 命中`, fs.floating.length===0, fs.floating.length?fs.floating.join('; '):`${r.ms.length} 件全部有正体积相交`);
	assert(`${k}: 非薄片件接合深度全部 ≥${NM_JOINT}m`, fs.weak.length===0, fs.weak.length?fs.weak.join('; '):'ok');
	console.log(`  · ${k}: 浮件 ${fs.floating.length} · 弱接合 ${fs.weak.length} · 薄片豁免 ${fs.thin.length} · **非薄片件最小嵌合 ${f3(fs.minDepth===null?0:fs.minDepth)}m** (${fs.minDepthPart})`);
}
function D_IS_BOAT(D){ return D.kind==='boat'; }
console.log('  薄片豁免登记 (件厚 < 0.08m 的几何必然, 仍要求正体积相交):');
{ const ks=Object.keys(THIN_EXEMPT);
	if(!ks.length) console.log('    (无)');
	for(const k of ks) console.log(`    · ${k}  ${THIN_EXEMPT[k]}`); }
console.log('');

// ══════════════ 验收 3: 网格/材质/muzzles/炮塔键 ══════════════
for(const k of['pt','gyorai']){
	const r=rows[k]; if(!r.ms) continue;
	const R=r.R,D=r.D;
	assert(`${k}: 网格数 ≤44`, r.ms.length<=44, `实测 ${r.ms.length}`);
	const mm=Object.keys(R.muzzles).map(x=>x+(Array.isArray(R.muzzles[x])?'×'+R.muzzles[x].length:'')).join(' ');
	assert(`${k}: muzzles 键齐全 (main 必有/torpedo 数 == spec.torpedo)`,
		!!R.muzzles.main&&(!D.torpedo||(R.muzzles.torpedo||[]).length===D.torpedo)&&(D.secondary?!!R.muzzles.secondary:true),
		`muzzles={${mm}}  spec.torpedo=${D.torpedo}`);
	assert(`${k}: turretG / mainG / barrelPivot 非空且 mainG===turretG`,
		!!R.turretG&&!!R.mainG&&!!R.barrelPivot&&R.mainG===R.turretG&&R.barrelPivot===R.pitchG,
		`turretG=${!!R.turretG} mainG=${!!R.mainG} barrelPivot===pitchG=${R.barrelPivot===R.pitchG}`);
	const th=R.turretHit;
	assert(`${k}: turretHit 数值合法 (r>0 且 0<y0<y1)`,
		!!th&&th.r>0&&th.y0>0&&th.y1>th.y0,
		th?`r=${f3(th.r)} y0=${f3(th.y0)} y1=${f3(th.y1)} (高 ${f3(th.y1-th.y0)}m, 相对 grp 原点)`:'缺失');
	assert(`${k}: dims 增 turretY/turretH/sightY 且与 turretG 一致`,
		R.dims&&Number.isFinite(R.dims.turretY)&&Number.isFinite(R.dims.turretH)&&Number.isFinite(R.dims.sightY)
		&&Math.abs(R.dims.turretY-R.turretG.position.y)<1e-9&&Math.abs(R.dims.turretH-D.tur.h)<1e-9,
		R.dims?`turretY=${f3(R.dims.turretY)} turretH=${f3(R.dims.turretH)} sightY=${f3(R.dims.sightY)} deckY=${f3(R.dims.deckY)}`:'缺失');
	assert(`${k}: 艇 wheels == []`, R.wheels.length===0, String(R.wheels.length));
	// 炮口位置口径: 世界系 = 环座心 + pitchG 局部 z (max(l/2−板厚, 0.92·塔半径)) + 管长 + 0.06
	const pz=R.pitchG.position.z, expZ=R.turretG.position.z+pz+D.barrelL+NM_PLATE*0.6;
	const mz=R.muzzles.main; let anc=null;
	for(let p=mz;p;p=p.parent) if(p===R.pitchG) anc=p;
	assert(`${k}: muzzles.main 挂在 pitchG (barrelPivot) 下`, !!anc&&mz===R.muzzles.main, anc?'ok':'不在 pitchG 链上');
	const sp=new THREE.Vector3(); mz.getWorldPosition(sp);
	const expY=R.dims.turretY+R.pitchG.position.y+0.02;
	assert(`${k}: 炮口在炮管口 (z=环座+pitchG局部+管长+0.06, y=俯仰轴+0.02)`,
		Math.abs(sp.z-expZ)<1e-6&&Math.abs(sp.y-expY)<1e-6,
		`世界炮口 (${f3(sp.x)}, ${f3(sp.y)}, ${f3(sp.z)})  期望 z=${f3(expZ)} y=${f3(expY)}  Δz=${f3(sp.z-expZ)} Δy=${f3(sp.y-expY)}`);
}
// 材质: 每台新建 (含同型二次构建)
{
	const all=Object.keys(allMats).map(k=>({k,s:allMats[k]}));
	const again=API.navBuildModel(API.NAVAL_SPEC.pt);
	const am=new Set(); meshes(again.grp).forEach(m=>{ if(m.o.material) am.add(m.o.material); });
	all.push({k:'pt(二次构建)',s:am});
	const shares=[];
	for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++)
		for(const m of all[i].s) if(all[j].s.has(m)) shares.push(all[i].k+'/'+all[j].k);
	assert('跨载具零材质实例共享 (含同型二次构建)', shares.length===0, shares.length?shares.join(','):`${all.length} 套材质全不相交`);
	for(const k of KEYS) if(rows[k].ms) console.log(`  · ${k} 材质分件=${rows[k].mats.size} (材质全部 new, 无共享)`);
}

// ══════════════ 验收 4: 炮塔 360° 回转不穿透甲板件 ══════════════
// 判据: 炮塔"外接盒" = ① 塔体圆柱 (顶盖/尾舱/观瞄都绕环座轴转 ⇒ 它们的回转体就是圆柱, 与 yaw 无关)
//        ∪ ② 炮管总成 (炮耳以上的水平管件 —— 每 yaw 一个**精确 OBB**: SAT 15 轴)
//   为什么不整塔取一个旋转 AABB: 圆柱塔的四个"空角"会扫到舰桥顶棱 (实测假命中 14~33 次),
//   而真几何净空 0.11~0.45m。回转体/OBB 判据既**不漏**(圆柱与盒子都包住实件)也不假报。
function dpt(px,pz,b){
	const qx=Math.max(b.min.x,Math.min(px,b.max.x)), qz=Math.max(b.min.z,Math.min(pz,b.max.z));
	let dmax=0;
	for(const x of[b.min.x,b.max.x])for(const z of[b.min.z,b.max.z]) dmax=Math.max(dmax,Math.hypot(px-x,pz-z));
	return {dmin:Math.hypot(px-qx,pz-qz),dmax};
}
const sep2=(g1,g2)=>(g1>0&&g2>0)?Math.hypot(g1,g2):Math.max(g1,g2);
function obbVsAabb(o,b){   // o={cx,cz,ang,hx,hy,hz,y0,y1} 绕 y 旋转的盒; 返回 {hit,sep}
	const c=Math.cos(o.ang), s=Math.sin(o.ang);
	const A=[[c,0,-s],[0,1,0],[s,0,c]], hA=[o.hx,o.hy,o.hz];
	const bc=[(b.min.x+b.max.x)/2,(b.min.y+b.max.y)/2,(b.min.z+b.max.z)/2];
	const hB=[(b.max.x-b.min.x)/2,(b.max.y-b.min.y)/2,(b.max.z-b.min.z)/2];
	const d=[o.cx-bc[0],(o.y0+o.y1)/2-bc[1],o.cz-bc[2]];
	const B=[[1,0,0],[0,1,0],[0,0,1]];
	const dot=(u,v)=>u[0]*v[0]+u[1]*v[1]+u[2]*v[2];
	const cross=(u,v)=>[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
	const cand=A.concat(B);
	for(const a of A)for(const bb of B){ const x=cross(a,bb); if(Math.hypot(x[0],x[1],x[2])>1e-9) cand.push(x); }
	let minOv=1e9,maxSep=0;
	for(const L of cand){
		const ln=Math.hypot(L[0],L[1],L[2]), u=[L[0]/ln,L[1]/ln,L[2]/ln];
		const rA=hA[0]*Math.abs(dot(u,A[0]))+hA[1]*Math.abs(dot(u,A[1]))+hA[2]*Math.abs(dot(u,A[2]));
		const rB=hB[0]*Math.abs(dot(u,B[0]))+hB[1]*Math.abs(dot(u,B[1]))+hB[2]*Math.abs(dot(u,B[2]));
		const ov=rA+rB-Math.abs(dot(u,d));
		minOv=Math.min(minOv,ov);
		if(ov<0) maxSep=Math.max(maxSep,-ov);       // 分离轴上的间隙; 取最大 = 最"松"的分离方向
	}
	// 命中 = 15 轴全部重叠; 分离时 sep = 最佳分离轴的间隙 (两个不相交凸盒的距离**下界**)
	return minOv>0?{hit:true,sep:-minOv}:{hit:false,sep:maxSep};
}
const YAW_N=24;
// 扫掠扫描 (函数化: 主判据与阴性对照共用同一支判据, 避免"两套算法")
// ★ 2026-09-21B 扩面 (verifier 独立验收抓到 LVT 主炮穿艏唇板, 而本判据当时只跑 pt/gyorai ⇒ 补四个坑):
//   ① **四型全跑** —— 缺陷恰好落在没跑的那一型上, 这是本轮最该修的判据漏洞;
//   ② 回转轴取 turretG 的**真实**位置 (cx,cz): 旧版按 (0,ringZ) 建圆柱, LVT 塔偏 −0.4225 ⇒ 半径虚大 + 假近报;
//   ③ "塔体半径"取**顶点实测**(绕轴最大水平距), 不再用 AABB 角 —— 圆塔的角把半径放大 √2 倍 (会假报);
//   ④ 座圈接合槽豁免: 与 nmTurretRing **正体积相交**的静态件 (被座圈咬住的甲板/车体顶面) 不参与"塔体净空"判据
//      —— 塔底与甲板之间那道槽就是座圈本体 (与两者各嵌合 0.10, 自检另有互嵌断言), 属设计接合链而非"塔扫到甲板";
//      豁免名单逐条打印, 别的静态件一个都不放过。**炮管判据不做任何豁免** (缺陷就在那里)。
function sweepScan(R,ms){
	const tg=R.turretG;
	const cx=tg.position.x, cz=tg.position.z, tY0=tg.position.y;
	const inTurret=new Set(), inBarrel=new Set();
	tg.traverse(o=>{ if(o.isMesh) inTurret.add(o); });
	R.pitchG.traverse(o=>{ if(o.isMesh) inBarrel.add(o); });
	const turretMs=ms.filter(m=>inTurret.has(m.o));
	// 回转副的**静态半环**: 艇 = nmTurretRing / 两栖车 = nmAmphRing (verifier 的 RING 表同口径)
	const isRing=m=>m.name==='nmTurretRing'||m.name==='nmAmphRing';
	const ringMs=ms.filter(isRing);
	const statics=ms.filter(m=>!inTurret.has(m.o)&&!isRing(m));
	// ④ 座圈咬合槽 (仅豁免"塔体净空"判据)
	const seat=[],seatSet=new Set();
	if(ringMs.length) for(const m of statics) if(hits(ovl(m.box,ringMs[0].box))){ seatSet.add(m.o); seat.push(m.name||'件'); }
	const bodyStatics=statics.filter(m=>!seatSet.has(m.o));
	// ③ 回转件 (非炮管链) 的"绕轴顶点圆柱": 回转扫掠 ⊆ 这些圆柱 (顶点实测, 比 AABB 角紧)
	//    顶点一律换到 **grp 系** (meshes() 已 updateMatrixWorld, grp 自身恒等) 再量 —— 与静态件盒同一坐标系
	const bodyCyls=[];
	for(const m of turretMs){
		if(inBarrel.has(m.o)&&m.name!=='nmMantlet') continue;      // 炮管/机枪/制退器 → 走 ②精确 OBB; 炮盾矮胖 → 走圆柱
		const g=m.o.geometry; if(!g||!g.attributes||!g.attributes.position) continue;
		const vv=new THREE.Vector3();
		const pos=g.attributes.position; let rmax=0,y0=1e9,y1=-1e9;
		for(let i=0;i<pos.count;i++){
			vv.fromBufferAttribute(pos,i).applyMatrix4(m.o.matrixWorld);
			const rr=Math.hypot(vv.x-cx,vv.z-cz);
			if(rr>rmax) rmax=rr;
			if(vv.y<y0) y0=vv.y; if(vv.y>y1) y1=vv.y;
		}
		bodyCyls.push({name:m.name||'件',r:rmax,y0,y1});
	}
	// 塔体 (绕轴自对称) 与 yaw 无关 ⇒ 只算一次
	let bodyHits=0,bodyHitsList=[],bodyMin=1e9,bodyMinName='';
	for(const c of bodyCyls) for(const m of bodyStatics){
		const q=dpt(cx,cz,m.box);
		const gr=q.dmin-c.r, gy=Math.max(m.box.min.y-c.y1,c.y0-m.box.max.y);
		if(gr<=0&&gy<=0){ bodyHits++; if(bodyHitsList.length<4) bodyHitsList.push(`塔体圆柱 r=${f3(c.r)} (${c.name}) ∩ ${m.name||'件'}`); }
		else { const sp=sep2(gr,gy); if(sp>0&&sp<bodyMin){ bodyMin=sp; bodyMinName=`${m.name||'件'} ↔ ${c.name} 圆柱`; } }
	}
	// ② 炮管总成 (pitchG 链去掉炮盾): 每 yaw 一个精确 OBB (SAT 15 轴), 对所有静态件 (含座圈咬合槽件 —— 不豁免)
	const bb=new THREE.Box3(); bb.makeEmpty();
	for(const m of turretMs) if(inBarrel.has(m.o)&&m.name!=='nmMantlet') bb.union(m.box);
	const bc={x:(bb.min.x+bb.max.x)/2, z:(bb.min.z+bb.max.z)/2};
	const bh=[(bb.max.x-bb.min.x)/2,(bb.max.y-bb.min.y)/2,(bb.max.z-bb.min.z)/2];
	let gunHits=0,gunHitsList=[],gunMin=1e9,gunMinName='',gunMinYaw=-1;
	for(let s=0;s<YAW_N;s++){
		const ang=s/YAW_N*Math.PI*2, cs=Math.cos(ang), sn=Math.sin(ang);
		const qx=cx+(bc.x-cx)*cs+(bc.z-cz)*sn, qz=cz-(bc.x-cx)*sn+(bc.z-cz)*cs;   // OBB 中心绕**塔轴**转
		for(const m of statics){
			const o=obbVsAabb({cx:qx,cz:qz,ang,hx:bh[0],hy:bh[1],hz:bh[2],y0:bb.min.y,y1:bb.max.y},m.box);
			if(o.hit){ gunHits++; if(gunHitsList.length<4) gunHitsList.push(`yaw=${(ang*180/Math.PI).toFixed(0)}° 炮管∩${m.name||'件'}`); }
			else if(o.sep>0&&o.sep<gunMin){ gunMin=o.sep; gunMinName=m.name||'件'; gunMinYaw=(ang*180/Math.PI).toFixed(0); }
		}
	}
	let embed=0,embedName='';
	for(const m of turretMs){ const d=jointDepth(ovl(ringMs[0].box,m.box)); if(d>embed){ embed=d; embedName=m.name||'塔体'; } }
	const turretMinY=Math.min.apply(null,turretMs.map(m=>m.box.min.y));
	const R_body=Math.max.apply(null,bodyCyls.map(c=>c.r));
	const yb0=Math.min.apply(null,bodyCyls.map(c=>c.y0)), yb1=Math.max.apply(null,bodyCyls.map(c=>c.y1));
	const hitsN=gunHits+bodyHits, hitsList=gunHitsList.concat(bodyHitsList);
	const minClear=Math.min(gunMin,bodyMin);
	return {hitsN,hitsList,minClear,minClearName:gunMin<=bodyMin?gunMinName:bodyMinName,minClearKind:gunMin<=bodyMin?'炮管盒':'塔体圆柱',
		gunMin,gunMinName,gunMinYaw,gunHits,bodyMin,bodyMinName,bodyHits,seat,bodyCyls,R_body,yb0,yb1,bh,
		nStatic:statics.length,nTurret:turretMs.length,nRing:ringMs.length,
		embed,embedName,turretMinY,tY0,ringTop:ringMs[0].box.max.y};
}
// 红线: 艇 NM_TUR_CLEAR(0.10) / 两栖车 NM_TUR_CLEAR_A(0.05) —— 都从 15e 现读 (单源)
for(const k of KEYS){
	const r=rows[k]; if(!r.ms) continue;
	if(!r.R.turretG||!r.R.pitchG){ assert(`${k}: 炮塔/炮管组存在 (扫掠判据前置)`, false, 'turretG 或 pitchG 缺失'); continue; }
	const lim=(r.D.kind==='boat')?NM_TUR_CLEAR:NM_TUR_CLEAR_A;
	const S=sweepScan(r.R,r.ms); r.sweep=S;
	assert(`${k}: 炮塔 360° (${YAW_N} yaw) 与静态件零相交`, S.hitsN===0,
		S.hitsN?`命中 ${S.hitsN}: ${S.hitsList.join('; ')}`
		:`0 命中 —— 炮管盒 ${f3(S.gunMin)}m / 塔体圆柱 ${f3(S.bodyMin)}m; 静态扫描集 ${S.nStatic} 件; 回转圆柱 ${S.bodyCyls.length} 件 R_max=${f3(S.R_body)} y=[${f3(S.yb0)},${f3(S.yb1)}] + 炮管盒半尺寸 [${f3(S.bh[0])},${f3(S.bh[1])},${f3(S.bh[2])}]; 豁免: 回转件 ${S.nTurret} 件 + 回转环座 ${S.nRing} 件${S.seat.length?` + 座圈咬合槽 ${S.seat.length} 件 (${S.seat.join(',')})`:''}`);
	// ① 炮管 (含同轴机枪) 扫掠 —— 本批 verifier 抓到的缺陷判据, 现在**四型都跑** (旧版只跑艇 ⇒ LVT 漏网)
	assert(`${k}: 炮管扫掠 360° 最小实体净空 ≥${lim}m (红线; 对最近静态件)`,
		S.gunHits===0&&S.gunMin>=lim,
		`最小净空 ${f3(S.gunMin)}m (对 ${S.gunMinName||'—'}, yaw=${S.gunMinYaw}°; 红线 ${lim}m ≤ 实测)  半尺寸 [${f3(S.bh[0])},${f3(S.bh[1])},${f3(S.bh[2])}]`);
	// ③ 塔体/回转件圆柱净空 (与 yaw 无关): 口径同红线, 但座圈咬合槽内那几件按设计接合链豁免 (名单见上一行)
	assert(`${k}: 塔体等回转件 360° 最小净空 ≥${lim}m (红线; 座圈咬合槽豁免 ${S.seat.length} 件)`,
		S.bodyHits===0&&S.bodyMin>=lim,
		`最小净空 ${f3(S.bodyMin)}m (对 ${S.bodyMinName||'—'}; 红线 ${lim}m)`);
	// 环座与塔体的**设计互嵌**必须报出来 (豁免的唯一理由): 取与环座嵌合最深的那个回转件 (= 塔体)
	// 容差 1e-6: three 的几何包围盒建在 **Float32** 顶点上 (0.252 存成 0.25199999…), 不是模型误差
	assert(`${k}: 豁免理由可量化 —— 环座与塔体互嵌 ≥${NM_JOINT}m, 且塔底高于艏甲板面`,
		S.embed>=NM_JOINT&&S.turretMinY>S.tY0-1e-6,
		`环座(nmTurretRing 顶 y=${f3(S.ringTop)}) ∩ ${S.embedName} 嵌合 ${f3(S.embed)}m (判据 ≥${NM_JOINT}: ${S.embed>=NM_JOINT}); 回转件最低面 y=${f3(S.turretMinY)} vs 塔底 ${f3(S.tY0)} 差 ${(S.turretMinY-S.tY0).toExponential(2)} (Float32 顶点容差, 判据: ${S.turretMinY>S.tY0-1e-6})`);
}

// ══════════════ 验收 5 (2026-09-21B 新增): 桨叶净空 / 桨轴传动 / 整车连通性 ══════════════
// 用户点名"螺旋桨和后边的板子重合" ⇒ 本轮把"桨看得见"写成可复跑的判据。判据函数化 (bladeScan / compScan),
//   **主判据与阴性对照共用同一支**, 不写第二套阈值; 阈值从 15e 现读 (NM_TUR_CLEAR / NM_PROP_CLEAR)。
//   · 两栖车: 桨叶 (nmPropBlade, NM_PROP_T 薄片) 与**任何**其他件 AABB 净空 ≥0.10m,
//             例外只有桨轴 nmPropShaft —— 桨叶必须与它**正体积相交** (不许为凑净空把桨拆成浮件);
//   · 艇    : 桨叶 ↔ 艉板 nmTransom / 舵 nmRudder 净空 ≥0.25m, 且桨轴沿 z 穿进艉板 ≥0.10m (传动可见但不重合);
//   · 连通性: 以"正体积相交"为边做并查集, 每台载具必须**单连通分量**。逐件浮件扫描查不出
//             "整块总成没接上车体"(旧版 lvt 整个炮塔只靠炮管蹭艏唇板 0.154m², 就在这个盲区里)。
// shift: 只给阴性对照用 —— 把桨叶沿 z 平移 shift (正 = 往艏即往板件方向), 判据必须当场跌破红线。
function bladeScan(ms,mode,shift){
	const blades=ms.filter(m=>m.name==='nmPropBlade');
	const shafts=ms.filter(m=>m.name==='nmPropShaft');
	const tgts=(mode==='amph')?ms.filter(m=>m.name!=='nmPropBlade'&&m.name!=='nmPropShaft')
		:ms.filter(m=>m.name==='nmTransom'||m.name==='nmRudder');
	let minClear=null,minName='',pairs=0,shaftHit=0,intoBoard=null;
	const off=new THREE.Vector3(0,0,shift||0);
	for(const b of blades){
		const bb=b.box.clone(); if(shift) bb.translate(off);
		for(const t of tgts){
			if(t===b) continue;
			pairs++;
			const o=ovl(bb,t.box);
			const g=hits(o)?-1:gapDist(o);                  // 相交 ⇒ 记 −1 (净空判据直接失败)
			if(minClear===null||g<minClear){ minClear=g; minName=t.name||'件'; }
		}
		for(const s of shafts) if(hits(ovl(bb,s.box))) shaftHit++;
	}
	if(mode==='boat'){
		const tp=ms.filter(m=>m.name==='nmTransom')[0];
		if(tp) for(const s of shafts){
			const z=Math.min(s.box.max.z,tp.box.max.z)-Math.max(s.box.min.z,tp.box.min.z);
			if(intoBoard===null||z>intoBoard) intoBoard=z;
		}
	}
	return {n:blades.length,nShaft:shafts.length,pairs,minClear,minName,shaftHit,intoBoard};
}
function compScan(ms){   // 并查集: 边 = 两件正体积相交
	const n=ms.length,par=ms.map((_,i)=>i);
	const find=i=>{ while(par[i]!==i){ par[i]=par[par[i]]; i=par[i]; } return i; };
	const uni=(a,b)=>{ a=find(a); b=find(b); if(a!==b) par[a]=b; };
	for(let i=0;i<n;i++)for(let j=i+1;j<n;j++) if(hits(ovl(ms[i].box,ms[j].box))) uni(i,j);
	const g={}; for(let i=0;i<n;i++){ const r=find(i); (g[r]=g[r]||[]).push(i); }
	return {count:Object.keys(g).length,groups:Object.values(g).sort((a,b)=>b.length-a.length)};
}
for(const k of KEYS){
	const r=rows[k]; if(!r.ms) continue;
	const mode=(r.D.kind==='boat')?'boat':'amph', lim=(mode==='boat')?NM_PROP_CLEAR:(NM_TUR_CLEAR);
	const B=bladeScan(r.ms,mode,0); r.blade=B;
	assert(`${k}: 桨叶 ${B.n} 支 × 目标 ${B.pairs} 对 AABB 净空 ≥${lim}m (${mode==='boat'?'艉板+舵':'任何板件(桨轴除外)'})`,
		B.n>0&&B.minClear!==null&&B.minClear>=lim,
		`最小净空 ${f3(B.minClear)}m (对 ${B.minName})  红线 ${lim}m`);
	assert(`${k}: 桨叶与桨轴正体积相交 (桨不是浮件)`, B.n>0&&B.shaftHit>=B.n,
		`桨叶 ${B.n} 支 / 桨轴 ${B.nShaft} 根 ⇒ 相交 ${B.shaftHit} 对`);
	if(mode==='boat')
		assert(`${k}: 桨轴穿进艉板 ≥0.10m (传动关系可见)`, B.intoBoard!==null&&B.intoBoard>=0.10,
			`z 向穿入 ${f3(B.intoBoard)}m (艉板厚 ${f3(NM_PLATE*2.2)}m)`);
	const C=compScan(r.ms); r.comp=C;
	assert(`${k}: 整车连通性 —— "从任一网格可达任一网格" (正体积相交单连通)`, C.count===1,
		C.count===1?`${r.ms.length} 件构成 1 个连通块`
		:`${C.count} 个连通块: `+C.groups.map(g=>'['+g.length+'] '+g.map(i=>r.ms[i].name||('#'+i)).join(',')).join('  |  '));
}
console.log('');

// ══════════════ 观瞄链 (WS2 依赖): nodes.sight / spec.sightH / 镜座压进顶盖 ══════════════
for(const k of['pt','gyorai']){
	const r=rows[k]; if(!r.ms) continue;
	const R=r.R,D=r.D, sn=R.nodes.sight;
	const sp=new THREE.Vector3(); if(sn) sn.getWorldPosition(sp);
	// deckY 直接读 navBuildModel 的 dims (不再在本文件里复写甲板比例 —— 单源纪律: 15e 改比例这里自动跟随)
	const want=R.dims.deckY+D.sightH;
	assert(`${k}: nodes.sight 世界 y == deckY + spec.sightH`, !!sn&&Math.abs(sp.y-want)<1e-6,
		sn?`sight.y=${f3(sp.y)} 期望 deckY(${f3(R.dims.deckY)})+sightH(${f3(D.sightH)})=${f3(want)}  镜心 x=${f3(sp.x)} z=${f3(sp.z)}`:'nodes.sight 缺失');
	const sm=r.ms.filter(m=>m.name==='nmSight')[0];
	const inTurret=[]; R.turretG.traverse(o=>{ if(o.isMesh&&o!==(sm&&sm.o)) inTurret.push(o); });
	const cand=r.ms.filter(m=>inTurret.indexOf(m.o)>=0);
	let roof=null; for(const m of cand) if(!roof||m.box.max.y>roof.box.max.y) roof=m;
	const emb=roof&&sm?Math.min(roof.box.max.y,sm.box.max.y)-Math.max(roof.box.min.y,sm.box.min.y):0;
	assert(`${k}: 观瞄镜座压进顶盖 ≥${NM_JOINT}m (spec.sightH 与塔高几何自洽)`, emb>=NM_JOINT,
		`镜座底/顶=${f3(sm?sm.box.min.y:0)}/${f3(sm?sm.box.max.y:0)}  顶盖顶面=${f3(roof?roof.box.max.y:0)}  嵌合 ${f3(emb)}m  (塔顶 = turretY+turretH = ${f3(R.dims.turretY+R.dims.turretH)})`);
}

// ══════════════ Lead 裁决④: 九三式也做大塔 (PT 的 0.85~0.90 档) + 两型仍可辨 ══════════════
{
	const A=API.NAVAL_SPEC, pt=A.pt.tur, gy=A.gyorai.tur;
	const rw=gy.w/pt.w, rl=gy.l/pt.l, rh=gy.h/pt.h;
	assert('Lead④: 九三式塔 = PT 塔的 0.85~0.90 档 (w/l/h 三项都在带内)',
		rw>=0.85&&rw<=0.90&&rl>=0.85&&rl<=0.90&&rh>=0.85&&rh<=0.90,
		`w ${f3(rw)} / l ${f3(rl)} / h ${f3(rh)} (PT ${pt.w}×${pt.l}×${pt.h} / 九三式 ${gy.w}×${gy.l}×${gy.h})`);
	assert('Lead④: 两型塔都是封闭回转大塔 (shape=bigRound 且 turretG 非空)',
		pt.shape==='bigRound'&&gy.shape==='bigRound'&&!!rows.pt.R.turretG&&!!rows.gyorai.R.turretG,
		`pt.shape=${pt.shape} gyorai.shape=${gy.shape}`);
	// 两型可辨 (本仓既有审美红线"6 车型两两可辨"的同口径): 整车签名 + 塔体积两两互异
	const sig=k=>{ const r=rows[k],R=r.R,g=new THREE.Vector3(); r.bb.getSize(g);
		return [f2(g.z),f2(g.x),f2(g.y),r.ms.length,r.mats.size,R.wheels.length,
			Object.keys(R.muzzles).sort().join('+'),(R.muzzles.torpedo||[]).length,
			!!R.nodes.pontoon.length,!!R.nodes.propeller].join('|'); };
	const vol=t=>t.w*t.l*t.h;
	const pv=vol(pt), gv=vol(gy), ratio=gv/pv;
	const dup=[]; for(let i=0;i<KEYS.length;i++)for(let j=i+1;j<KEYS.length;j++)
		if(sig(KEYS[i])===sig(KEYS[j])) dup.push(KEYS[i]+'/'+KEYS[j]);
	assert('Lead④: 4 型两两形状签名互异 (两栖车 + 两艇可辨) 且 pt/gyorai 塔体积比 ≠1',
		dup.length===0&&Math.abs(ratio-1)>0.15,
		`签名重复=${dup.length?dup.join(','):'0 对'}; pt 塔体积=${f3(pv)}m³ 九三式=${f3(gv)}m³ 比=${f3(ratio)}; 签名 ${KEYS.map(k=>k+':'+sig(k)).join('  ‖  ')}`);
	// 留档档可用性: smallRound 本轮无实装型, 但档本身必须还能建塔 (防"档名写错 → 静默回落到 bigRound")
	const sr=API.navBuildModel(Object.assign({},A.gyorai,{tur:Object.assign({},A.gyorai.tur,{shape:'smallRound'})}));
	assert('留档档 smallRound 仍可建塔 (无实装型但档没坏)', !!sr.turretG&&!!sr.pitchG&&!!sr.turretHit&&sr.turretHit.r>0,
		`turretG=${!!sr.turretG} turretHit.r=${sr.turretHit?f3(sr.turretHit.r):'—'} (只验"能建", 不验净空)`);
}

// ══════════════ 鱼雷管契约 (15d fireTorpedo 的索引语义) ══════════════
for(const k of['pt','gyorai']){
	const r=rows[k]; if(!r.ms) continue;
	const R=r.R,D=r.D, arr=R.muzzles.torpedo||[];
	const det=[];
	let ok=true;
	for(let i=0;i<arr.length;i++){
		const mz=arr[i], sp=new THREE.Vector3(); mz.getWorldPosition(sp);
		const tg=R.tubeG[i]; const tz=tg?tg.position.x:NaN;
		const mouth=sp.z-(tg?tg.position.z:0);            // 管口相对管心 (沿 z)
		det.push(`[${i}] x=${f3(tz)} 口Δz=${f3(mouth)}`);
		if(i>0&&arr.length>=4&&i%2===1){ /* 同组左右: 右侧 x 应更大 */ if(!(tz>R.tubeG[i-1].position.x)) ok=false; }
		if(i%2===0&&tz>0) ok=false;                       // 每组左舷 = 负 x (15d: sgn<0 → idx 偶)
	}
	const sp0=new THREE.Vector3(); if(arr[0]) arr[0].getWorldPosition(sp0);
	const dir0=arr[0]?Math.sign(sp0.z-R.tubeG[0].position.z):0;
	assert(`${k}: muzzles.torpedo 每管一锚点 + 左右/前后组序符合 15d 索引契约`,
		arr.length===D.torpedo&&ok&&dir0===1,
		`${arr.length}/${D.torpedo} 管  锚点位置 ${det.join(' ')}  首组出管朝向=${dir0>0?'+z(前)':'-z(后)'}`);
	// 管身与舷缘栏板 (托架) 的体积重叠 —— "贴合艇体"的量化
	const ra=r.ms.filter(m=>Math.abs(m.box.min.x)>0.1&&m.box.max.y>R.dims.deckY&&m.box.min.y<R.dims.deckY+0.2&&(m.box.max.z-m.box.min.z)>2);
	const tubes=[]; for(const tg of R.tubeG) tg.traverse(o=>{ if(o.isMesh) tubes.push(o); });
	let bestT=0;
	for(const tm of r.ms) if(tubes.indexOf(tm.o)>=0) for(const rm of ra) bestT=Math.max(bestT,jointDepth(ovl(tm.box,rm.box)));
	assert(`${k}: 鱼雷管与舷缘栏板体积重叠 ≥${NM_JOINT}m (贴合艇体)`, bestT>=NM_JOINT, `最深嵌合 ${f3(bestT)}m (栏板候选 ${ra.length} 件)`);
}

// ══════════════ 阴性对照: 判据必须能抓到故障 (抓不到 ⇒ 上面那些"0 命中"没有意义) ══════════════
{
	const pt=API.NAVAL_SPEC.pt;
	// ① 观瞄镜抬高 0.30m ⇒ 镜座脱离顶盖 0.19m ⇒ 浮件扫描必须命中该件
	const b1=API.navBuildModel(Object.assign({},pt,{sightH:pt.sightH+0.30}));
	const f1=floatScan(meshes(b1.grp));
	assert('阴性对照①: spec.sightH 抬高 0.30m (镜座脱顶) ⇒ 浮件扫描抓到', f1.floating.some(s=>/nmSight/.test(s)),
		f1.floating.length?('命中 '+f1.floating.length+' 件: '+f1.floating.join('; ')):'0 命中 ⇒ 浮件判据失效!');
	// ② 环座前移到舰桥处 (ringZ=0) ⇒ 360° 扫掠必须报出与舰桥/桅桁相撞
	const b2=API.navBuildModel(Object.assign({},pt,{tur:Object.assign({},pt.tur,{ringZ:0})}));
	const s2=sweepScan(b2,meshes(b2.grp));
	assert('阴性对照②: 环座移到舰桥处 ⇒ 扫掠判据抓到穿模', s2.hitsN>=1,
		s2.hitsN?('命中 '+s2.hitsN+' 次: '+s2.hitsList.join('; ')):'0 命中 ⇒ 扫掠判据失效!');
	// ③ 浮件判据本身: 面贴合 (间隙 0) 不算浮件 / 悬空 5cm 必须算
	const B=(x0,x1)=>new THREE.Box3(new THREE.Vector3(x0,0,0),new THREE.Vector3(x1,1,1));
	const ft=floatScan([{name:'面贴合A',box:B(0,1)},{name:'面贴合B',box:B(1,2)}]);
	const fg=floatScan([{name:'悬空A',box:B(0,1)},{name:'悬空B',box:B(1.05,2)}]);
	assert('阴性对照③a: 面贴合 (间隙 0) 不算浮件、但计入弱接合', ft.floating.length===0&&ft.weak.length===2,
		`浮件=${ft.floating.length} 弱接合=${ft.weak.length}`);
	assert('阴性对照③b: 悬空 5cm ⇒ 浮件扫描 2 件全抓', fg.floating.length===2, `浮件=${fg.floating.length} (${fg.floating.join('; ')})`);
	// ④ 2026-09-21B 新判据的故障注入: 把桨叶沿 z 往板件方向挪 0.05m (用户病灶的几何本质: 桨叶切进艉架/舵)
	//    ⇒ 两栖车的 0.13m 净空跌到 0.08 (<0.10)、艇的 0.28m 跌到 0.23 (<0.25), 两个判据都必须当场抓到。
	//    设计余量就是按"0.05m 注入必须可抓"定的 (见 15e NM_PROP_CLEAR_A / NM_PROP_SET 注释)。
	const NEG_SHIFT=0.05;
	for(const k of['lvt','pt']){
		const r=rows[k]; if(!r.ms) continue;
		const mode=(r.D.kind==='boat')?'boat':'amph', lim=(mode==='boat')?NM_PROP_CLEAR:NM_TUR_CLEAR;
		const B0=r.blade, B1=bladeScan(r.ms,mode,NEG_SHIFT);
		assert(`阴性对照④ (${k}): 桨叶内移 ${NEG_SHIFT}m ⇒ 净空判据跌破 ${lim}m`,
			B0&&B1.minClear<lim,
			`${f3(B0?B0.minClear:NaN)}m → ${f3(B1.minClear)}m (对 ${B1.minName}; 红线 ${lim}m, 判据 ${B1.minClear<lim?'已抓到':'漏报!'})`);
	}
	// ⑤ 2026-09-21B verifier 缺陷的**原样注回**: 把 LVT 艏端唇板按本批前的位置抬回去 (顶缘 2.395→2.561,
	//    即 +0.166 = 旧顶缘−新顶缘) ⇒ 炮管扫掠判据必须当场报出相交/跌破红线。
	//    为什么不用 0.05: 修后净空 0.199m (LVT 炮管↔艏端甲板), 红线是 0.10 (艇线) / 0.05 (Lead 对两栖车的要求)
	//    —— 0.05 的位移仍在设计余量之内, 抓不到才是对的; 判据的敏感性由"缺陷原样注回"证明 (更强的阴性对照)。
	//    ★2026-09-22 换靶: 旧靶 nmBowLip (艏端上翘唇板) 已随"散架"病灶一起并入车体断面 (件不存在了)。
	//      新靶 = 同一缺陷在新几何上的等价形态 —— 把车体**艏部两站甲板抬高** 0.30·boxH (旧版就是"艏部结构
	//      高过炮管扫掠线"), 判据必须当场抓到; 复位后必须回到合格。注入点走 NM_AMPH 表 (与建模同一份数据)。
	for(const k of['lvt']){
		const r=rows[k]; if(!r.ms) continue;
		const tab=vm.runInContext('NM_AMPH',ctx), orig=[tab.lvt.st[0][7],tab.lvt.st[1][7]];
		const roofA=Math.max.apply(null,r.ms.filter(m=>m.name==='nmHullBox').map(m=>m.box.max.y));
		try{
			tab.lvt.st[0][7]=orig[0]+0.30; tab.lvt.st[1][7]=orig[1]+0.30;   // 艏部甲板抬高 (注入缺陷)
			const b2=API.navBuildModel(API.NAVAL_SPEC.lvt);
			const ms2=meshes(b2.grp), S2=sweepScan(b2,ms2);
			tab.lvt.st[0][7]=orig[0]; tab.lvt.st[1][7]=orig[1];             // 复位
			const b3=API.navBuildModel(API.NAVAL_SPEC.lvt);
			const ms3=meshes(b3.grp), S3=sweepScan(b3,ms3);
			const roofB=Math.max.apply(null,ms2.filter(m=>m.name==='nmHullBox').map(m=>m.box.max.y));
			const lim=NM_TUR_CLEAR_A;
			assert(`阴性对照⑤ (${k}): 艏部甲板按旧版形态抬高 0.30m ⇒ 炮管扫掠判据抓到`,
				(S2.gunHits>0||S2.gunMin<lim)&&S3.gunHits===0&&S3.gunMin>=lim,
				`艏甲板顶 ${f3(roofA)} → ${f3(roofB)}; 炮管净空 ${f3(S3.gunMin)}m → ${f3(S2.gunMin)}m, 命中 ${S3.gunHits}→${S2.gunHits} (红线 ${lim}m, ${(S2.gunHits>0||S2.gunMin<lim)?'已抓到':'漏报!'}); 复位后复测 ${f3(S3.gunMin)}m/命中 ${S3.gunHits}`);
		}finally{ tab.lvt.st[0][7]=orig[0]; tab.lvt.st[1][7]=orig[1]; }
	}
}

// ══════════════ 硬护栏源码扫描 ══════════════
{
	const raw=fs.readFileSync(path.join(root,'js/15e-navmodels.js'),'utf8');
	const src=raw.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
	assert('15e 源码不调用任何纹理方法', !/\.(clone|repeat|offset|dispose|needsUpdate)\s*\(/.exec(src), (/(\.(clone|repeat|offset|dispose|needsUpdate)\s*\()/.exec(src)||[''])[0]||'无');
	assert('15e 无 Loader/图片/http 外部资源', !/(Loader|\.png|\.jpg|\.jpeg|\.gltf|\.obj|https?:\/\/)/.test(src));
	assert('15e 无光源/相机', !/(new THREE\.[A-Za-z]*Light|new THREE\.[A-Za-z]*Camera)/.test(src));
	assert('15e 不做整体缩放 (无 grp.scale / setScalar)', !/(grp\.scale|\.scale\.set|setScalar)\s*\(/.test(src)&&!/(grp\.scale\s*=)/.test(src));
	assert('15e 所有 TEX 取值都走 [..] 兜底 (无 TEX.x 直取)', !/TEX\.[A-Za-z]+\s*[;,)]/.test(src.replace(/TEX\[[^\]]+\]/g,'')));
}

// ══════════════ 剪影 (SIL=1): 侧视 (舷弧/炮塔/舰桥占比) + 俯视 (炮塔扫掠圈 vs 甲板件) ══════════════
if(SIL){
	for(const k of['pt','gyorai']){
		const r=rows[k]; if(!r.ms) continue;
		const R=r.R, inTurret=new Set();
		R.turretG.traverse(o=>{ if(o.isMesh) inTurret.add(o); });
		const HZ=48,HY=15, WZ=48,WX=17;                 // 格数 (侧视 z×y / 俯视 z×x)
		const draw=(title,hAxis,vAxis,NW,NH)=>{
			const lo={x:r.bb.min.x,y:r.bb.min.y,z:r.bb.min.z}, hi={x:r.bb.max.x,y:r.bb.max.y,z:r.bb.max.z};
			const sp={x:hi.x-lo.x,y:hi.y-lo.y,z:hi.z-lo.z};
			const grid=[]; for(let j=0;j<NH;j++) grid.push(new Array(NW).fill(' '));
			const put=(h,v,ch)=>{ const i=Math.round((h-lo[hAxis])/sp[hAxis]*(NW-1)), j=Math.round((v-lo[vAxis])/sp[vAxis]*(NH-1));
				if(i>=0&&i<NW&&j>=0&&j<NH) grid[NH-1-j][i]=ch; };
			for(const m of r.ms){
				const turret=inTurret.has(m.o), ring=m.name==='nmTurretRing';
				const ch=turret?'T':ring?'O':'.';
				for(const h of[m.box.min[hAxis],m.box.max[hAxis]])for(const v of[m.box.min[vAxis],m.box.max[vAxis]]) put(h,v,ch);
				for(let h=m.box.min[hAxis];h<=m.box.max[hAxis];h+=sp[hAxis]/(NW-1)){ put(h,m.box.min[vAxis],ch); put(h,m.box.max[vAxis],ch); }
				for(let v=m.box.min[vAxis];v<=m.box.max[vAxis];v+=sp[vAxis]/(NH-1)){ put(m.box.min[hAxis],v,ch); put(m.box.max[hAxis],v,ch); }
			}
			console.log(`  ${title}  横轴 ${hAxis} (左=艉 → 右=艏), 纵轴 ${vAxis} (上=大)  格 ${(sp[hAxis]/(NW-1)).toFixed(2)}×${(sp[vAxis]/(NH-1)).toFixed(2)}m   . 静态件  T 回转件  O 回转环座`);
			for(const row of grid) console.log('   |'+row.join('')+'|');
		};
		console.log(`\n════ ${k}  实测包围盒 L×W×H = ${f2(r.bb.max.z-r.bb.min.z)}×${f2(r.bb.max.x-r.bb.min.x)}×${f2(r.bb.max.y-r.bb.min.y)} m   炮塔扫描最小净空 ${f3(r.sweep.minClear)}m ════`);
		draw('侧视', 'z','y', HZ,HY);
		draw('俯视', 'z','x', WZ,WX);
	}
}
// ══════════════ 逐件明细 (DUMP=1) ══════════════
if(DUMP){
	for(const k of['pt','gyorai']){
		const r=rows[k]; if(!r.ms) continue;
		console.log(`\n── ${k} 逐件 AABB (grp 局部) ──`);
		r.ms.slice().sort((a,b)=>a.box.min.y-b.box.min.y).forEach((m,i)=>{
			let best=0,bj='';
			for(const o of r.ms){ if(o===m) continue; const d=jointDepth(ovl(m.box,o.box)); if(d>best){ best=d; bj=o.name||'件'; } }
			console.log(`  ${String(i).padStart(2)} ${(m.name||'(未命名)').padEnd(14)} `
				+`x[${f2(m.box.min.x)},${f2(m.box.max.x)}] y[${f2(m.box.min.y)},${f2(m.box.max.y)}] z[${f2(m.box.min.z)},${f2(m.box.max.z)}]`
				+`  最深嵌合=${f3(best)}m(${bj})`);
		});
	}
}
console.log(`\n${BAD.length?'✗ '+BAD.length+' 项失败':'✓ 全部通过'}  (通过 ${OK.length} 项)`);
if(BAD.length) console.log(BAD.map(b=>'  - '+b).join('\n'));
process.exit(BAD.length?1:0);
