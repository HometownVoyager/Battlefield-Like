// ─────────────────────────────────────────────
// dev/_firepoint-selfcheck.js —— 固定火力点翻新批自检 (task-1 · 《口径确认-模型翻新与浅水弹速-20260921B》§3)
// 用法: node dev/_firepoint-selfcheck.js          # 全量断言, 任一失败 exit 1
//       node dev/_firepoint-selfcheck.js DUMP=1   # 另打逐件 AABB 与逐件最深嵌合
//
// 为什么用**真 three.js r152** (dev/vendor/three.min.js, 与 index.html 的 CDN 同版 REVISION=152):
//   本轮要证的全是**世界空间**量 —— 件数/材质分件、逐件体积嵌合(浮件)、连通性、炮口与开火点对齐、
//   360° 回转时炮管/防盾是否穿自家后方沙袋墙。自造几何桩只能按参数近似 AABB, 证不了"体积重叠"与矩阵链。
//
// 测的是**源码本身** (不是副本):
//   · 17-emplacements.js 整文件在沙箱里加载 (FLAGS/BASES/FLAK_DECKS/COASTAL_PITS 给空桩 ⇒ 落位循环一行不跑),
//     然后直接调 atGun() —— 走的就是线上那条建炮路径;
//   · 05c-layouts.js 只按标记切两段: ① FACTION_MG 表 ② "固定火力点模型单源"标记→EOF (助手 + mg42)。
//     该文件 :2419 的 buildWorld() 会真建全图, 沙箱不载它; 切出来的是同一份源码文本, 不是手抄副本。
//   沙箱 heightAt=0 (平地) ⇒ groundFit={y:0,pitch:0,roll:0} ⇒ 世界系 = 模型局部系 + grp 平移,
//   于是"炮口沿 face 距炮位中心"可直接与 emplATFire 的 2.7 / emplMGFire 的 1.35 对账。
//
// 判据 (与 15e 炮艇自检同规, 见 archive/dev-probes-cleanup-20261118/_naval-model-selfcheck.js (2026-11-19 效率批归档) 文件头):
//   ① 浮件 = 与**任何**其他件都无正体积相交, 且 AABB 最近距离 >0.02m ⇒ 命中即 FAIL;
//   ② 接合深度 = 两件 AABB 三轴重叠长度的最小值; 非薄片件(自身最薄处 ≥JOINT)必须 ≥JOINT=0.06m,
//      薄片件(<0.06) 豁免深度但**仍须正体积相交** (口径"薄板件另说");
//   ③ 连通性 = 相交图必须只有一个连通分量 (无浮件 ≠ 连通, 两簇各自自洽也会漏过);
//   ④ 开火点: atGun 最前端件沿 face ∈[2.4,2.9]m 且 |Δy|≤0.25m; mg42 枪管中线 y∈[0.06,0.18] 且枪口 ∈[1.25,1.45]m;
//   ⑤ 射界: atGun yaw 转 24 个角, 回转件(防盾/摇架/炮管总成)与自家后方沙袋墙零相交;
//   ⑥ 阴性对照: 把一件抬高 0.2m, 浮件扫描必须抓到它 (证明判据不是恒真)。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const DUMP=!!process.env.DUMP;
const JOINT=0.06;                       // 非薄片件最小嵌合 (m) —— 口径 §3/§6
const OK=[],BAD=[];
function assert(name,cond,detail){ (cond?OK:BAD).push(name); console.log(`  ${cond?'✓':'✗'} ${name}${detail?'  '+detail:''}`); }
const f2=v=>(Math.round(v*100)/100).toFixed(2), f3=v=>(Math.round(v*1000)/1000).toFixed(3);

// ══════════════ 真 three.js r152 (与 archive/dev-probes-cleanup-20261118/_naval-model-selfcheck.js (2026-11-19 效率批归档) 同一支装法) ══════════════
function loadRealTHREE(){
	const s={console,Math,JSON,Date,String,Number,Object,Array,Set,Map,Error,TypeError,isNaN,parseFloat,parseInt,
		self:null,globalThis:null,
		window:{addEventListener(){},removeEventListener(){},devicePixelRatio:1},
		document:{createElementNS:()=>({style:{}}),createElement:()=>({style:{},getContext:()=>null})},
		navigator:{userAgent:'node'},requestAnimationFrame:()=>0,cancelAnimationFrame(){},
		performance:{now:()=>Date.now()},setTimeout:()=>0,clearTimeout(){},
		URL:{createObjectURL(){return ''},revokeObjectURL(){}},Blob:function(){},Image:function(){}};
	s.self=s; s.globalThis=s;
	const c=vm.createContext(s);
	vm.runInContext(fs.readFileSync(path.join(root,'dev/vendor/three.min.js'),'utf8'),c,{filename:'dev/vendor/three.min.js'});
	const T=vm.runInContext('THREE',c);
	if(!T||!T.REVISION) throw new Error('three.min.js 未挂上 THREE');
	return T;
}
const THREE=loadRealTHREE();

// ══════════════ 沙箱: 最小桩 (只给 atGun/mg42 真正用到的那些) ══════════════
// 记桩: 记录 propFree/propPushOut/propTake/sandbagWall 的实参 —— 契约"落位/占位/掩护墙"改成行为断言
const CALLS=[];
function makeSandbox(){
	const s={
		console,Math,JSON,Date,Array,Object,Set,Map,isNaN,parseInt,parseFloat,String,Number,Boolean,Error,TypeError,THREE,
		scene:new THREE.Group(), world:new THREE.Group(),
		CYLS:[],PROPS:[],FLAGS:[],BASES:[],AAGUNS:[],
		GAMEMODE:'conquest',CAMPAIGN:{id:'normandy',f:['us','ger'],spawns:[]},
		FLAK_DECKS:[],COASTAL_PITS:[],NAV:{refresh(){}},
		HPI:Math.PI/2,TAU:Math.PI*2,nowT:0,soldiers:[],B_FOOT:[],
		showScorePop(){},standHeight:()=>0,occBlocked:()=>false,freeSpot:()=>true,onBridge:()=>false,
		AudioSys:{click(){},cannon(){}},rand:(a,b)=>a+(b-a)*0.5,svgApply:()=>{},
		heightAt:()=>0,                                   // 平地: 世界系 = 局部系 + grp 平移
		groundFit:()=>({y:0,max:0,pitch:0,roll:0}),
		propFree:(x,z,r)=>{ CALLS.push(['propFree',r]); return !s.__busy; },
		propPushOut:(x,z,r)=>{ CALLS.push(['propPushOut',r]); return [x+0.5,z-0.5]; },
		propTake:(x,z,r)=>{ CALLS.push(['propTake',r]); },
		sandbagWall:(x,z,len,ry,h,reg)=>{ CALLS.push(['sandbagWall',x,z,len,ry,h,reg]);   // 与 05b:35 同构: 段长+0.16, 厚 0.75, 底贴地
			const n=Math.max(1,Math.round(len/2.6)),seg=len/n;
			for(let i=0;i<n;i++){
				const c=-len/2+seg*(i+0.5);
				const m=new THREE.Mesh(new THREE.BoxGeometry(seg+0.16,h,0.75),s.MAT.sandbag);
				m.position.set(x+Math.cos(ry)*c,h/2,z-Math.sin(ry)*c); m.rotation.y=ry; s.world.add(m);
			}
		},
		document:{createElement:t=>t==='canvas'
			?{width:0,height:0,getContext:()=>({fillStyle:'',strokeStyle:'',lineWidth:1,font:'',textAlign:'',textBaseline:'',
				beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},stroke(){},fillRect(){},clearRect(){},fillText(){},
				arc(){},save(){},restore(){},translate(){},rotate(){},scale(){},setLineDash(){},strokeRect(){}})}
			:({})},   // 仅 17 的医疗箱贴图用 (canvas 2D 桩)
		V3:(x,y,z)=>new THREE.Vector3(x||0,y||0,z||0),
	};
	s.__busy=false;
	s.globalThis=s;
	// 贴图桩: 只做 map 占位 (白底相对明度口径不影响几何量测)
	s.TEX={}; for(const k of['metal','metalBrush','wood','woodDark','sandbag','steelPlate','stencil','canvas','concrete','grime','leaves'])
		s.TEX[k]={__stub:true};
	const mk=o=>new THREE.MeshLambertMaterial(o);
	s.MAT={metal:mk({map:s.TEX.metal}),metalDark:mk({color:0x3a3d38,map:s.TEX.metalBrush}),wood:mk({map:s.TEX.wood}),
		woodDark:mk({map:s.TEX.woodDark}),sandbag:mk({map:s.TEX.sandbag})};
	s.MAT.metal.uvRef=1.2; s.MAT.metalDark.uvRef=1.2; s.MAT.wood.uvRef=2.0; s.MAT.woodDark.uvRef=2.0;
	s.vmMats={gun:mk({}),gunL:mk({})};                 // aaGun 还在用 (本轮不动)
	s.boxGeo=(w,h,d)=>new THREE.BoxGeometry(w,h,d);    // 真实现有几何缓存, 沙箱不需要
	s.uvGeo=g=>g;                                      // UV 归一只改贴图密度, 不影响 AABB 量测
	const cache={};                                     // 与 05b:418 wkMat 同语义 (role|tint|uvRef 缓存)
	s.wkMat=(role,tint,tex,uvRef)=>{ const k=role+'|'+tint+'|'+uvRef; if(cache[k]) return cache[k];
		const m=new THREE.MeshLambertMaterial({color:tint,map:tex||s.TEX.grime}); m.uvRef=uvRef; cache[k]=m; return m; };
	return s;
}
const SB=makeSandbox();
const ctx=vm.createContext(SB);
const ev=code=>vm.runInContext(code,ctx,{filename:'<eval>'});

// ── 05c 两段切出 (标记缺失即报错退出, 绝不静默用旧文本) ──
const src05c=fs.readFileSync(path.join(root,'js/05c-layouts.js'),'utf8');
const M_MG='const MG42S=[];', M_END='// 活树/倒树记录', M_FP='// 固定火力点模型单源';
const iA=src05c.indexOf(M_MG), iA2=src05c.indexOf(M_END), iB=src05c.indexOf(M_FP);
if(iA<0||iA2<0||iB<0||!(iA<iA2&&iA2<iB)){
	console.log('✗ 05c-layouts.js 标记定位失败: MG42S='+iA+' 段末='+iA2+' 火力点单源段='+iB);
	process.exit(1);
}
vm.runInContext(src05c.slice(iA,iA2),ctx,{filename:'js/05c-layouts.js#FACTION_MG'});
vm.runInContext(src05c.slice(iB),ctx,{filename:'js/05c-layouts.js#firepoint-source..EOF'});
// 17-emplacements.js: 整文件 (落位循环因 FLAGS=[] 一行不跑)
vm.runInContext(fs.readFileSync(path.join(root,'js/17-emplacements.js'),'utf8'),ctx,{filename:'js/17-emplacements.js'});

// ══════════════ 量测工具 (真矩阵链 / 真 Box3) ══════════════
function meshes(grp){
	grp.updateMatrixWorld(true);
	const out=[];
	grp.traverse(o=>{ if(o.isMesh&&o.geometry) out.push({o,name:o.name||'',box:new THREE.Box3().setFromObject(o)}); });
	return out;
}
const byName=(ms,n)=>ms.find(m=>m.name===n);
const sz=b=>b.getSize(new THREE.Vector3());
function unionBox(list){ const b=new THREE.Box3(); b.makeEmpty(); for(const m of list) b.union(m.box); return b; }
const ovl=(a,b)=>{ const am=a.min,ax=a.max,bm=b.min,bx=b.max;
	return [Math.min(ax.x,bx.x)-Math.max(am.x,bm.x),Math.min(ax.y,bx.y)-Math.max(am.y,bm.y),Math.min(ax.z,bx.z)-Math.max(am.z,bm.z)]; };
const EPS=1e-9;
const hits=o=>o[0]>EPS&&o[1]>EPS&&o[2]>EPS;
const gapDist=o=>Math.hypot(Math.min(0,o[0]),Math.min(0,o[1]),Math.min(0,o[2]));
const jointDepth=o=>hits(o)?Math.min(o[0],o[1],o[2]):0;
const corners=b=>{ const out=[]; for(const x of[b.min.x,b.max.x])for(const y of[b.min.y,b.max.y])for(const z of[b.min.z,b.max.z]) out.push({x,y,z}); return out; };
// 件的**自身几何 AABB 角点** → 世界坐标 (不先取世界 AABB! 世界 AABB 的角点会把 x/z 最大值合成一个点,
// 沿 face 投影时虚增 ~0.10m —— 2026-09-21 自检自己抓到的第一版量测错, 见下方"炮口"断言)。
function meshCorners(m){
	const g=m.o.geometry;
	if(!g.boundingBox) g.computeBoundingBox();
	const bb=g.boundingBox,out=[];
	for(const x of[bb.min.x,bb.max.x])for(const y of[bb.min.y,bb.max.y])for(const z of[bb.min.z,bb.max.z])
		out.push(new THREE.Vector3(x,y,z).applyMatrix4(m.o.matrixWorld));
	return out;
}
const maxAlong=(ms,ox,oz,sn,cs)=>{ let d=-1e9; for(const m of ms) for(const p of meshCorners(m)) d=Math.max(d,(p.x-ox)*sn+(p.z-oz)*cs); return d; };
// 浮件扫描 + 连通性 (主判据与阴性对照共用同一支)
function floatScan(ms){
	const floating=[],weak=[],thin=[]; let minDepth=null,minPart='';
	for(let i=0;i<ms.length;i++){
		const a=ms[i],s=sz(a.box),th=Math.min(s.x,s.y,s.z),nm=a.name||('#'+i);
		let best=0,bj=-1,any=false;
		for(let j=0;j<ms.length;j++){
			if(i===j) continue;
			const o=ovl(a.box,ms[j].box);
			if(hits(o)){ any=true; const d=jointDepth(o); if(d>best){ best=d; bj=j; } }
		}
		const where=`[x ${f2(a.box.min.x)}~${f2(a.box.max.x)}, y ${f2(a.box.min.y)}~${f2(a.box.max.y)}, z ${f2(a.box.min.z)}~${f2(a.box.max.z)}]`;
		if(!any){
			let dmin=1e9,dj=-1;
			for(let j=0;j<ms.length;j++){ if(i===j) continue; const d=gapDist(ovl(a.box,ms[j].box)); if(d<dmin){ dmin=d; dj=j; } }
			const near=ms[dj]?ms[dj].name||('#'+dj):'-';
			if(dmin>0.02) floating.push(`${nm} 无任何正体积相交, 最近件 ${near} 距离 ${f3(dmin)}m ${where}`);
			else weak.push(`${nm} 面贴合/微间隙 0 体积: 最近件 ${near} 距离 ${f3(dmin)}m ${where}`);
		}else if(best<JOINT){
			const det=`最深嵌合 ${f3(best)}m (对 ${ms[bj].name||('#'+bj)}, 自身最薄 ${f3(th)}m) ${where}`;
			(th<JOINT?thin:weak).push(`${nm} ${det}`);
		}
		if(any&&th>=JOINT&&(minDepth===null||best<minDepth)){ minDepth=best; minPart=nm; }
	}
	return {floating,weak,thin,minDepth,minPart};
}
function components(ms){
	const n=ms.length,adj=Array.from({length:n},()=>[]);
	for(let i=0;i<n;i++)for(let j=i+1;j<n;j++) if(hits(ovl(ms[i].box,ms[j].box))){ adj[i].push(j); adj[j].push(i); }
	const seen=new Array(n).fill(false),comps=[];
	for(let s=0;s<n;s++){
		if(seen[s]) continue;
		const q=[s]; seen[s]=true; const c=[];
		while(q.length){ const u=q.pop(); c.push(u); for(const v of adj[u]) if(!seen[v]){ seen[v]=true; q.push(v); } }
		comps.push(c);
	}
	return comps;
}
function dumpParts(title,ms){
	if(!DUMP) return;
	console.log(`  · ${title} 逐件 AABB:`);
	for(const m of ms) console.log(`      ${(m.name||'-').padEnd(14)} x ${f2(m.box.min.x)}~${f2(m.box.max.x)}  y ${f2(m.box.min.y)}~${f2(m.box.max.y)}  z ${f2(m.box.min.z)}~${f2(m.box.max.z)}`);
}

// ══════════════ 构建入口 ══════════════
function buildAtGun(x,z,face,fac,busy){
	CALLS.length=0;
	ev(`world.clear(); CYLS.length=0; ATGUNS.length=0; AAGUNS.length=0; CAMPAIGN.f=${JSON.stringify(fac)};`);
	ev(`__busy=${busy?'true':'false'};`);
	ev(`atGun(${x},${z},${face});`);
	return {g:ev('ATGUNS[0]'),calls:CALLS.slice(),wall:ev('world.children.filter(o=>o.material&&o.material===MAT.sandbag)')};
}
function buildMG(x,z,face,fac,team,busy){
	CALLS.length=0;
	ev(`world.clear(); MG42S.length=0; CAMPAIGN.f=${JSON.stringify(fac)};`);
	ev(`__busy=${busy?'true':'false'};`);
	ev(`mg42(${x},${z},${face},${team});`);
	return {g:ev('MG42S[0]'),calls:CALLS.slice(),wall:ev('world.children.filter(o=>o.material&&o.material===MAT.sandbag)')};
}
const callRad=(calls,fn)=>{ const c=calls.filter(c=>c[0]===fn); return c.length?c[c.length-1][1]:null; };

console.log('═══ 固定火力点自检 (口径 20260921B §3 · task-1) ═══');
console.log('   真 three.js r152 (dev/vendor/three.min.js)');
console.log('   脚本链: js/17-emplacements.js [整文件] + js/05c-layouts.js [FACTION_MG 段 + 固定火力点单源段..EOF]');
console.log(`   判据: 浮件 0 / 非薄片件嵌合 ≥${JOINT}m / 相交图 1 个连通分量 / 炮口对开火点 / 24 向射界\n`);

// ══════════════════════════════════════════════════════════════════════════════
// A. atGun (反坦克炮) —— 件数 / 材质 / 浮件 / 连通 / 落地 / 炮口 / 站位 / 射界
// ══════════════════════════════════════════════════════════════════════════════
console.log('── A. atGun 反坦克炮 (位 5,7 面 0.9rad, 美军涂装档) ──');
const AGX=5,AGZ=7,AGF=0.9;
const AG=buildAtGun(AGX,AGZ,AGF,['us','ger'],false);
const agM=meshes(AG.g.grp), agF=floatScan(agM), agC=components(agM), agMats=new Set(agM.map(m=>m.o.material));
const agGround=-AG.g.grp.position.y;   // 局部地面高 (平地; gfit.y=0, 炮位高 0.85) —— 注意与世界 y=0 差一个 grp 平移
console.log(`   网格 ${agM.length} 件 · 材质分件 ${agMats.size} · 件名 ${agM.map(m=>m.name).join(' ')}`);
assert('atGun 网格数 ≥16 (口径硬判据)', agM.length>=16, `实测 ${agM.length} 件`);
assert('atGun 网格数 ≤22 (口径 §3 目标上限)', agM.length<=22, `实测 ${agM.length} 件`);
assert('atGun 材质分件 ≥5 (既有 MAT + 本批新贴图, 非平色)', agMats.size>=5,
	`实测 ${agMats.size}: ${[...agMats].map(m=>'#'+(m.color?m.color.getHexString():'?')+(m.map?'+贴图':'')).join(' ')}`);
assert('atGun 浮件扫描 0 命中 (每件与至少一件正体积相交)', agF.floating.length===0,
	agF.floating.length?agF.floating.join('; '):`${agM.length} 件全部有正体积相交`);
assert('atGun 相交图 1 个连通分量 (任一网格可达任一网格)', agC.length===1,
	`实测 ${agC.length} 个分量, 大小 ${agC.map(c=>c.length).join('/')}`);
assert(`atGun 非薄片件最深嵌合 ≥${JOINT}m`, agF.weak.length===0,
	agF.weak.length?agF.weak.join('; '):`最小 ${f3(agF.minDepth===null?0:agF.minDepth)}m (${agF.minPart}); 薄片豁免 ${agF.thin.length} 件`);
if(agF.thin.length) console.log(`    薄片豁免 (件厚 <${JOINT}m 的几何必然, 仍要求正相交): ${agF.thin.length} 件`);
// 承力链落地: 双轮轮底 = 地面 (沙箱地形高 0 ⇒ 世界地面 y=0)
const wR=byName(agM,'atWheelR'), wL=byName(agM,'atWheelL');
assert('atGun 双轮贴地 (轮底 = 世界地面 ±0.02m, 不悬空)',
	Math.abs(wR.box.min.y)<=0.02&&Math.abs(wL.box.min.y)<=0.02,
	`轮底世界 y ${f3(wR.box.min.y)}/${f3(wL.box.min.y)} (地面 0, 局部 ${f3(agGround)}, 炮位高 ${f3(AG.g.grp.position.y)})`);
// 承力关系抽查: 关键接合件对
const AGPAIR=[['atTrailR','atAxle','大架-轮轴'],['atAxle','atWheelR','轮轴-轮'],['atSaddle','atAxle','上架-轮轴'],
	['atCradle','atSaddle','摇架-上架'],['atBarrel','atCradle','炮管-摇架'],['atBreech','atBarrel','炮闩-炮管'],
	['atBrake','atBarrel','制退器-炮管'],['atRecoilR','atCradle','复进筒-摇架'],['atShieldLo','atSaddle','防盾-上架'],
	['atShieldUpL','atShieldLo','上板-下板'],['atSpadeR','atTrailR','驻锄-大架'],['atSeat','atTrailL','炮手座-大架'],
	['atAmmoCrate','atTrailR','弹箱-大架'],['atElevWheel','atAxle','俯仰手轮-轮轴'],['atSight','atBreech','瞄准镜-炮闩']];
const agPairBad=[];
for(const [a,b,label] of AGPAIR){
	const A=byName(agM,a),B=byName(agM,b);
	const d=A&&B?jointDepth(ovl(A.box,B.box)):0;
	if(d<Math.min(JOINT,Math.min(sz(A.box).x,sz(A.box).y,sz(A.box).z),Math.min(sz(B.box).x,sz(B.box).y,sz(B.box).z))) agPairBad.push(`${label}(${a}-${b}) 嵌合 ${f3(d)}`);
}
assert('atGun 承力链关键接合全部 ≥0.06m (薄片件取自身厚度为限)', agPairBad.length===0, agPairBad.length?agPairBad.join('; '):`${AGPAIR.length} 对接合逐对量测通过`);
// 炮口 ↔ emplATFire 出膛点 (13-combat:170 = 炮位 + dir*2.7, 朝向水平)
// 投影用**件自身几何 AABB 的角点**(meshCorners), 不是世界 AABB 的角点 —— 后者虚增 ~0.10m
const agMuz=maxAlong([byName(agM,'atBarrel'),byName(agM,'atBrake')],AG.g.x,AG.g.z,Math.sin(AGF),Math.cos(AGF));
const agBrakeC=byName(agM,'atBrake').box.getCenter(new THREE.Vector3());
assert('atGun 炮口(炮管+制退器)前缘沿 face 距炮位中心 ∈[2.4,2.9]m (契约 2.7)', agMuz>=2.4&&agMuz<=2.9, `实测 ${f3(agMuz)}m, 与 2.7 差 ${f3(agMuz-2.7)}m`);
assert('atGun 炮口高度 = 落位点 g.y ±0.25m (ATGUNS.y = g0+0.85)', Math.abs(agBrakeC.y-AG.g.y)<=0.25,
	`炮口 y ${f3(agBrakeC.y)} · g.y ${f3(AG.g.y)} · Δ ${f3(agBrakeC.y-AG.g.y)}`);
// 站位: AT_CREW_DIST=0.9 在局部 (0,-,-0.9) —— 躯干核心 (半宽 0.26, 高 0~1.8) 必须无件
{
	const z0=agGround, crew=new THREE.Box3(new THREE.Vector3(-0.26,z0,-0.9-0.35),new THREE.Vector3(0.26,z0+1.8,-0.9+0.35));
	const hit=agM.filter(m=>hits(ovl(m.box,crew)));
	assert('atGun 炮手站位 (AT_CREW_DIST=0.9, 躯干 ±0.26m) 无任何件穿过', hit.length===0,
		hit.length?('穿件: '+hit.map(m=>m.name).join(',')):'座板内缘 -0.33 / 大架 0.355 / 驻锄 0.29 均在站位之外');
}
// 射界: 24 个 yaw, 回转件 (防盾/摇架/炮管总成) 不穿自家后方沙袋墙
{
	const wallBoxes=AG.wall.map(o=>new THREE.Box3().setFromObject(o));
	let minGap=1e9,bad=[];
	for(let k=0;k<24;k++){
		const ang=k*Math.PI/12;
		AG.g.yaw.rotation.y=ang;
		const rot=meshes(AG.g.yaw);
		for(const m of rot) for(const wb of wallBoxes){
			const o=ovl(m.box,wb);
			if(hits(o)) bad.push(`yaw ${(ang*180/Math.PI).toFixed(0)}°: ${m.name} ∩ 沙袋墙`);
			else minGap=Math.min(minGap,gapDist(o));
		}
	}
	AG.g.yaw.rotation.y=0; meshes(AG.g.grp);
	console.log(`   沙袋墙 ${AG.wall.length} 段 (MAT.sandbag, 高 0.5m) · 回转件与墙最小净空 ${f3(minGap)}m`);
	assert('atGun 回转 360° (24 向) 炮管/防盾不穿自家后方沙袋墙', bad.length===0,
		bad.length?bad.slice(0,4).join('; '):`24 向全部零相交, AABB 最小净空 ${f3(minGap)}m (墙高 0.5 < 炮管 0.85)`);
}
// 落位/占位/掩护墙 行为契约 (沙箱记桩)
{
	const sb=AG.calls.filter(c=>c[0]==='sandbagWall')[0];
	const okWall=sb&&Math.abs(sb[1]-(AGX-Math.sin(AGF)*1.6))<1e-9&&Math.abs(sb[2]-(AGZ-Math.cos(AGF)*1.6))<1e-9
		&&sb[3]===3.5&&sb[4]===AGF&&sb[5]===0.5&&sb[6]===false;
	assert('atGun 后方沙袋墙落位/朝向/长度/高度不变 (x-sin·1.6, z-cos·1.6, 3.5, face, 0.5, false)', !!okWall,
		sb?`实测 (${f3(sb[1])}, ${f3(sb[2])}, ${sb[3]}, ry ${f3(sb[4])}, h ${sb[5]}, reg ${sb[6]})`:'未调用');
	assert('atGun 占位半径 propFree/propTake = 2.7 不变', callRad(AG.calls,'propFree')===2.7&&callRad(AG.calls,'propTake')===2.7,
		`propFree ${callRad(AG.calls,'propFree')} / propTake ${callRad(AG.calls,'propTake')}`);
	const bus=buildAtGun(AGX,AGZ,AGF,['us','ger'],true);
	assert('atGun 落点被占时 propPushOut 仍走 2.7 (外推后照建)', callRad(bus.calls,'propPushOut')===2.7&&!!bus.g,
		`propPushOut ${callRad(bus.calls,'propPushOut')} · 外推后炮位 (${f3(bus.g.x)}, ${f3(bus.g.z)})`);
	assert('atGun ATGUNS 条目字段与顺序一字不变',
		ev('Object.keys(ATGUNS[0]).join(",")')==='x,z,y,face,grp,yaw,pitch,user,cd,cdLock,kind',
		ev('Object.keys(ATGUNS[0]).join(",")'));
	assert('atGun ATGUNS.y = g0+0.85 且碰撞圆柱 {r:0.6,y0:g0,y1:g0+1.2} 不变',
		Math.abs(AG.g.y-0.85)<1e-9&&ev('CYLS[0].r')===0.6&&ev('CYLS[0].y0')===0&&Math.abs(ev('CYLS[0].y1')-1.2)<1e-9,
		`y=${f3(AG.g.y)} cyl r=${ev('CYLS[0].r')} y0=${ev('CYLS[0].y0')} y1=${ev('CYLS[0].y1')}`);
}
dumpParts('atGun',agM);

// ══════════════════════════════════════════════════════════════════════════════
// B. mg42 (重机枪位) —— 件数 / 材质 / 浮件 / 连通 / 三脚架 / 底座落地 / 枪口 / 三档外观
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n── B. mg42 重机枪位 (位 5,7 面 0.9rad, 阵营 us/air 档) ──');
const MGX=5,MGZ=7,MGF=0.9;
const MG=buildMG(MGX,MGZ,MGF,['us','ger'],0,false);
const mgM=meshes(MG.g.grp), mgF=floatScan(mgM), mgC=components(mgM), mgMats=new Set(mgM.map(m=>m.o.material));
const mgGround=-MG.g.grp.position.y;    // 平地: 局部地面高 = -grp.position.y (枪位高 1.0)
console.log(`   网格 ${mgM.length} 件 · 材质分件 ${mgMats.size} · 件名 ${mgM.map(m=>m.name).join(' ')}`);
assert('mg42 网格数 ≥12 (口径硬判据)', mgM.length>=12, `实测 ${mgM.length} 件`);
assert('mg42 网格数 ≤18 (口径 §3 目标上限)', mgM.length<=18, `实测 ${mgM.length} 件`);
assert('mg42 材质分件 ≥4 (既有 MAT + 本批新贴图)', mgMats.size>=4, `实测 ${mgMats.size}`);
assert('mg42 浮件扫描 0 命中 (每件与至少一件正体积相交)', mgF.floating.length===0,
	mgF.floating.length?mgF.floating.join('; '):`${mgM.length} 件全部有正体积相交`);
assert('mg42 相交图 1 个连通分量', mgC.length===1, `实测 ${mgC.length} 个分量, 大小 ${mgC.map(c=>c.length).join('/')}`);
assert(`mg42 非薄片件最深嵌合 ≥${JOINT}m`, mgF.weak.length===0,
	mgF.weak.length?mgF.weak.join('; '):`最小 ${f3(mgF.minDepth===null?0:mgF.minDepth)}m (${mgF.minPart}); 薄片豁免 ${mgF.thin.length} 件`);
// 三脚架: 三条腿 + 中央架头 (旧版是一根单柱)
{
	const legs=['mgLegF','mgLegL','mgLegR'].map(n=>byName(mgM,n)), head=byName(mgM,'mgTripodHead'), base=byName(mgM,'mgBase');
	const legOk=legs.every(Boolean)&&!!head&&!!base;
	assert('mg42 三脚架 = 三条腿 + 中央架头 + 混凝土底座 (不是一根柱子)', legOk,
		legOk?`腿 ${legs.map(l=>l.name).join('/')} + 架头 + 底座`:'缺件');
	if(legOk){
		const bad=legs.filter(l=>!hits(ovl(l.box,head.box))).map(l=>l.name);
		const off=legs.filter(l=>!hits(ovl(l.box,base.box))).map(l=>l.name);
		assert('mg42 三条腿每条都与架头正体积相交 (腿顶接架头)', bad.length===0, bad.length?bad.join(','):'3/3');
		assert('mg42 三条腿腿脚都落在底座里 (不悬空)', off.length===0, off.length?off.join(','):'3/3');
	assert('mg42 混凝土底座底面贴地 (世界地面 ±0.02m)', Math.abs(base.box.min.y)<=0.02,
		`底座底世界 y ${f3(base.box.min.y)} (地面 0, 局部 ${f3(mgGround)})`);
	}
}
// 枪口 ↔ emplMGFire (13-combat:140-146: eye = 枪位+(0,0.12,0), 枪口 = eye + dir*1.35)
{
	const br=byName(mgM,'mgBarrel'), brC=br.box.getCenter(new THREE.Vector3());
	const axisY=brC.y-MG.g.grp.position.y;
	const muz=maxAlong([br],MG.g.x,MG.g.z,Math.sin(MGF),Math.cos(MGF));
	assert('mg42 枪管中线 y (组件原点) ∈[0.06,0.18] (契约 EMPL_MG_EYE=0.12)', axisY>=0.06&&axisY<=0.18,
		`实测 ${f3(axisY)} (Δ ${f3(axisY-0.12)})`);
	assert('mg42 枪口沿 face 距组件原点 ∈[1.25,1.45]m (契约 EMPL_MG_MUZ=1.35)', muz>=1.25&&muz<=1.45,
		`实测 ${f3(muz)}m (Δ ${f3(muz-1.35)})`);
}
// 落位/占位/掩护墙 行为契约
{
	const sb=MG.calls.filter(c=>c[0]==='sandbagWall')[0];
	const okWall=sb&&Math.abs(sb[1]-(MGX+Math.sin(MGF)*1.1))<1e-9&&Math.abs(sb[2]-(MGZ+Math.cos(MGF)*1.1))<1e-9
		&&sb[3]===3&&sb[4]===MGF&&sb[5]===0.5&&sb[6]===false;
	assert('mg42 前沙袋墙落位/朝向/长度/高度不变 (x+sin·1.1, z+cos·1.1, 3, face, 0.5, false)', !!okWall,
		sb?`实测 (${f3(sb[1])}, ${f3(sb[2])}, ${sb[3]}, ry ${f3(sb[4])}, h ${sb[5]}, reg ${sb[6]})`:'未调用');
	assert('mg42 占位半径 propFree/propTake = 2.3 不变', callRad(MG.calls,'propFree')===2.3&&callRad(MG.calls,'propTake')===2.3,
		`propFree ${callRad(MG.calls,'propFree')} / propTake ${callRad(MG.calls,'propTake')}`);
	const bus=buildMG(MGX,MGZ,MGF,['us','ger'],0,true);
	assert('mg42 落点被占时 propPushOut 仍走 2.3 (外推后照建)', callRad(bus.calls,'propPushOut')===2.3&&!!bus.g,
		`propPushOut ${callRad(bus.calls,'propPushOut')} · 外推后枪位 (${f3(bus.g.x)}, ${f3(bus.g.z)})`);
	assert('mg42 MG42S 条目字段与顺序一字不变',
		ev('Object.keys(MG42S[0]).join(",")')==='x,z,y,face,grp,yaw,pitch,user,heat,fireT,cdLock,muzzle,def,team',
		ev('Object.keys(MG42S[0]).join(",")'));
	assert('mg42 MG42S.y = g0+1.0 且 def 仍取自 FACTION_MG', Math.abs(MG.g.y-1.0)<1e-9&&!!MG.g.def&&MG.g.def.style==='air',
		`y=${f3(MG.g.y)} def=${MG.g.def&&MG.g.def.name} style=${MG.g.def&&MG.g.def.style}`);
}
// def.style 三档 (+德式短筒) 真的做出不同外观
{
	const cases=[['us','air',0],['ger','mg42',0],['sov','water',0],['jp','92',0]];
	const sig=[];
	for(const [fac,style,team] of cases){
		CALLS.length=0;
		const R=buildMG(MGX,MGZ,MGF,[fac,'ger'],team,false);
		const ms=meshes(R.g.grp), st=byName(ms,'mgJacket')||byName(ms,'mgHopper');
		sig.push({fac,style,n:ms.length,w:st?sz(st.box).x:0});
	}
	const w=sig.map(s=>s.w.toFixed(3));
	assert('mg42 def.style 四档外观保留且互不相同 (water 水冷套 / air 风冷套 / 92 左弹板 / 德式短筒)',
		sig.every(s=>s.n===mgM.length)&&new Set(w).size===4,
		sig.map(s=>`${s.fac}/${s.style} 套径 ${s.w}m`).join(' · '));
}
dumpParts('mg42',mgM);

// ══════════════════════════════════════════════════════════════════════════════
// C. 阴性对照: 判据必须能抓到"被抬高的浮件" (否则上面的绿是恒真)
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n── C. 阴性对照 (判据有效性) ──');
{
	const back=[];
	for(const [label,root,part,dy] of [['atGun','ag','atSight',0.2],['mg42','mg','mgMuzzleRing',0.2]]){
		const ms=label==='atGun'?meshes(AG.g.grp):meshes(MG.g.grp);
		const p=byName(ms,part);
		if(!p){ assert(`阴性对照 ${label}: 找到 ${part}`, false, '未找到件'); continue; }
		const y0=p.o.position.y;
		p.o.position.y=y0+dy;
		const f2s=floatScan(meshes(label==='atGun'?AG.g.grp:MG.g.grp));
		const caught=f2s.floating.some(s=>s.startsWith(part));
		p.o.position.y=y0;
		back.push(f2s.floating.length);
		assert(`阴性对照 ${label}: 把 ${part} 位移 ${dy>0?'+':''}${dy}m ⇒ 浮件扫描命中它`, caught,
			caught?`命中: ${f2s.floating.find(s=>s.startsWith(part)).slice(0,110)}`:'未命中 ⇒ 判据无效');
		// 复位后必须回到 0 命中 (证明"绿"来自模型本身, 不是扫描恒假)
		const reset=floatScan(meshes(label==='atGun'?AG.g.grp:MG.g.grp));
		assert(`阴性对照 ${label}: 复位后浮件回到 0 命中`, reset.floating.length===0, `实测 ${reset.floating.length}`);
	}
}

// ══════════════════════════════════════════════════════════════════════════════
// D. 对外契约: 源码逐条文本断言 (一行不改 = 逐字比对, 不靠人眼)
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n── D. 对外契约文本 (逐条一字不差) ──');
{
	const F17=fs.readFileSync(path.join(root,'js/17-emplacements.js'),'utf8');
	const F05=src05c, F13=fs.readFileSync(path.join(root,'js/13-combat.js'),'utf8'), F00=fs.readFileSync(path.join(root,'js/00-config.js'),'utf8');
	const LIST=[
		[F17,'grp.position.set(x,gfit.y+0.85,z)','atGun 落位 y = gfit.y+0.85'],
		[F17,"grp.rotation.order='YXZ'",'atGun 旋转序 YXZ'],
		[F17,'grp.rotation.set(gfit.pitch,face,gfit.roll)','atGun 旋转 = (pitch,face,roll)'],
		[F17,'const po=propFree(x,z,2.7)?[x,z]:propPushOut(x,z,2.7)','atGun 整机占位圈 2.7'],
		[F17,'sandbagWall(x-Math.sin(face)*1.6,z-Math.cos(face)*1.6,3.5,face,0.5,false)','atGun 后方沙袋墙落位'],
		[F17,'propTake(x,z,2.7)','atGun propTake 2.7'],
		[F17,'CYLS.push({x,z,r:0.6,y0:g0,y1:g0+1.2})','atGun 碰撞圆柱'],
		[F17,"ATGUNS.push({x,z,y:g0+0.85,face,grp,yaw,pitch,user:null,cd:0,cdLock:0,kind:'at'})",'ATGUNS 条目字段与顺序'],
		[F05,'const po=propFree(x,z,2.3)?[x,z]:propPushOut(x,z,2.3)','mg42 整机占位圈 2.3'],
		[F05,'sandbagWall(x+Math.sin(face)*1.1, z+Math.cos(face)*1.1, 3, face, 0.5, false)','mg42 前沙袋墙落位'],
		[F05,'grp.position.set(x,fit.y+1.0,z)','mg42 落位 y = fit.y+1.0'],
		[F05,'grp.rotation.set(fit.pitch,face,fit.roll)','mg42 旋转 = (pitch,face,roll)'],
		[F05,'propTake(x,z,2.3)','mg42 propTake 2.3'],
		[F05,'MG42S.push({x,z,y:g0+1.0,face,grp,yaw,pitch,user:null,heat:0,fireT:0,cdLock:0,muzzle:V3(),def,team})','MG42S 条目字段与顺序'],
		[F05,"def.style==='water'","def.style water 档保留"],
		[F05,"def.style==='air'","def.style air 档保留"],
		[F05,"def.style==='92'","def.style 92 档保留"],
		[F13,'const EMPL_MG_EYE=0.12, EMPL_MG_MUZ=1.35;','emplMGFire 常量 0.12/1.35'],
		[F13,'const eye=V3(mg.x,mg.y+EMPL_MG_EYE,mg.z);','emplMGFire eye 公式'],
		[F13,'const o=V3(g.x,g.y,g.z).addScaledVector(dir,2.7);','emplATFire 炮口前移 2.7'],
		[F00,'const AT_CREW_DIST=0.9;','AT_CREW_DIST 0.9'],
	];
	const miss=LIST.filter(([src,txt])=>src.indexOf(txt)<0).map(([,txt,nm])=>nm);
	assert(`对外契约 ${LIST.length} 条逐字命中`, miss.length===0, miss.length?('缺失: '+miss.join('; ')):'全部命中 (含 13-combat/00-config 既有行未被改动)');
}

// ══════════════════════════════════════════════════════════════════════════════
console.log(`\n═══ 结果: ${OK.length} 通过 / ${BAD.length} 失败 ═══`);
if(BAD.length){ console.log('失败项:'); for(const b of BAD) console.log('  ✗ '+b); process.exit(1); }
console.log('全绿。');
