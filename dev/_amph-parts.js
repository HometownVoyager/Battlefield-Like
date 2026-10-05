// ─────────────────────────────────────────────
// dev/_amph-parts.js —— 两栖车逐件 AABB + 关键净空 (2026-09-22 重做批的取证工具)
// 用法: node dev/_amph-parts.js lvt kami
// 输出: 逐件 AABB (grp 局部, 米) / 整车包围盒 / 桨·舵·浮筒·艉架的关键间距
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const KEYS=process.argv.slice(2).filter(a=>!/=/.test(a));
const THREE=(()=>{
	const s={console,Math,JSON,Date,String,Number,Object,Array,Set,Map,Error,TypeError,isNaN,parseFloat,parseInt,
		self:null,globalThis:null,window:{addEventListener(){},devicePixelRatio:1},
		document:{createElementNS:()=>({style:{}}),createElement:()=>({style:{},getContext:()=>null})},
		navigator:{userAgent:'node'},requestAnimationFrame:()=>0,performance:{now:()=>Date.now()},
		setTimeout:()=>0,clearTimeout(){},URL:{createObjectURL(){return''},revokeObjectURL(){}},Blob:function(){},Image:function(){}};
	s.self=s;s.globalThis=s;
	const ctx=vm.createContext(s);
	vm.runInContext(fs.readFileSync(path.join(root,'dev/vendor/three.min.js'),'utf8'),ctx,{filename:'three'});
	return vm.runInContext('THREE',ctx);
})();
const texStub=()=>({__stub:true});
const sandbox={console,Math,JSON,Date,Array,Object,Set,Map,isNaN,parseInt,parseFloat,String,Number,Boolean,Error,THREE,
	TEX:{leaves:texStub(),grime:texStub(),metalBrush:texStub(),rust:texStub(),barnacle:texStub(),waterline:texStub(),deckWood:texStub(),wood:texStub(),steelPlate:texStub(),concrete:texStub(),canvas:texStub(),stencil:texStub()},
	TEAM_COL:[0x8fc1ff,0xff9c8a],
	localStorage:{_s:{},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}},
	navigator:{maxTouchPoints:0,userAgent:'node'},
	document:{createElement:()=>({style:{},getContext:()=>null,width:0,height:0}),querySelector:()=>null,body:{appendChild(){},style:{}}},
	window:{addEventListener(){},innerWidth:1280,innerHeight:720},
	performance:{now:()=>Date.now()},requestAnimationFrame:()=>0,cancelAnimationFrame(){},setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){}};
sandbox.globalThis=sandbox;
const ctx=vm.createContext(sandbox);
const load=f=>vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
load('js/00-config.js'); load('js/15e-navmodels.js');
const API=vm.runInContext('({NAVAL_SPEC,navBuildModel})',ctx);
const f2=v=>(Math.round(v*100)/100).toFixed(2), f3=v=>(Math.round(v*1000)/1000).toFixed(3);
function parts(grp){
	grp.updateMatrixWorld(true);
	const out=[];
	grp.traverse(o=>{ if(o.isMesh&&o.geometry) out.push({name:o.name||'',box:new THREE.Box3().setFromObject(o),
		parent:(o.parent&&o.parent.name)||''}); });
	return out;
}
const mn=b=>[b.min.x,b.min.y,b.min.z], mx=b=>[b.max.x,b.max.y,b.max.z];
function ovl(a,b){ const A=mn(a),B=mx(a),C=mn(b),D=mx(b);
	return [Math.min(B[0],D[0])-Math.max(A[0],C[0]),Math.min(B[1],D[1])-Math.max(A[1],C[1]),Math.min(B[2],D[2])-Math.max(A[2],C[2])]; }
const hits=o=>o[0]>1e-9&&o[1]>1e-9&&o[2]>1e-9;
const gap=o=>Math.sqrt(o.reduce((s,v)=>s+(v<0?v*v:0),0));
for(const k of KEYS){
	const D=API.NAVAL_SPEC[k]; const R=API.navBuildModel(D);
	const P=parts(R.grp);
	const bb=new THREE.Box3(); bb.makeEmpty(); for(const p of P) bb.union(p.box);
	const sz=new THREE.Vector3(); bb.getSize(sz);
	console.log(`\n══ ${k} (${D.name}) ══ 件 ${P.length}`);
	console.log(`   整车包围盒  L=${f2(sz.z)} W=${f2(sz.x)} H=${f2(sz.y)}   z:[${f2(bb.min.z)}, ${f2(bb.max.z)}] y:[${f2(bb.min.y)}, ${f2(bb.max.y)}]   (spec L${D.hullL} W${D.hullW} H${D.hullH})`);
	console.log(`   偏差 L ${((sz.z-D.hullL)/D.hullL*100).toFixed(1)}%  W ${((sz.x-D.hullW)/D.hullW*100).toFixed(1)}%`);
	if(D.console) {}
	P.forEach((p,i)=>{
		const b=p.box;
		console.log(`   ${String(i).padStart(2)} ${(p.name||'(未命名)').padEnd(14)} x[${f2(b.min.x)},${f2(b.max.x)}] y[${f2(b.min.y)},${f2(b.max.y)}] z[${f2(b.min.z)},${f2(b.max.z)}]`);
	});
	// 关键净空
	const bl=P.filter(p=>p.name==='nmPropBlade'), rd=P.filter(p=>p.name==='nmRudder');
	const sh=P.filter(p=>p.name==='nmPropShaft'), st=P.filter(p=>p.name==='nmShaftStrut');
	const po=P.filter(p=>p.name==='nmPontoon');
	// 逐件取"最好的一对"再汇总 —— agg='min' = 净空 (越小越危险) / agg='max' = 相交性 (1 = 相交)
	//   取全局最小会把左右舷对侧件算进来 (左桨↔右轴必然分离) ⇒ 假报 0, 所以必须逐件聚合。
	const rep=(t,a,b,f,agg)=>{ if(!a.length||!b.length) return;
		agg=agg||'min';
		const per=[];
		for(const x of a){ let best=null,bn='';
			for(const y of b){ const g=f(x,y);
				if(best===null||(agg==='min'?g<best:g>best)){ best=g; bn=y.name||'?'; } }
			per.push(`${(x.name||'?')}→${bn} ${f3(best)}`); }
		console.log(`   · ${t}: ${per.join('  |  ')}`); };
	const clear=(x,y)=>{ const o=ovl(x.box,y.box); return hits(o)?-1:gap(o); };
	rep('桨叶 ↔ 艉架',bl,st,clear);
	rep('桨叶 ↔ 浮筒',bl,po,clear);
	rep('桨叶 ↔ 舵  ',bl,rd,clear);
	rep('桨叶 ↔ 桨轴(须相交)',bl,sh,(x,y)=>hits(ovl(x.box,y.box))?1:0,'max');
	rep('舵 ↔ 桨轴(须相交)',rd,sh,(x,y)=>hits(ovl(x.box,y.box))?1:0,'max');
	rep('浮筒 ↔ 车体  ',po,P.filter(p=>p.name==='nmHullBox'),clear);
}
console.log('');
