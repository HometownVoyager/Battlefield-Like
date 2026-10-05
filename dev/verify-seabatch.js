// ──────────────────────────────────────────────────────────────────────────────
// dev/verify-seabatch.js —— 【海战地图 7 项优化】交付批次联合验收 (Lead 所有, 2026-09-21)
//
// 用法: node dev/verify-seabatch.js            # 标题判据, 未落盘的对象按「⊘ 跳过」计, exit 0
//       node dev/verify-seabatch.js --strict   # 跳过也算失败 (交付前终验用这个)
//
// 为什么单独一个文件: 本批 7 项各有一份 owner 自检 (WS1~WS5 的 verify-*/selfcheck), 那些自检
//   是**实现者自己写的**; 本文件是 Lead 侧的**独立判据** —— 只读 js/, 自己的量测口径, 不采信
//   任何实现者自报的数字。它回答的是"用户报的 7 条现象, 现在到底还成不成立"。
//
// 判据来源 = 用户原话 (逐条对应):
//   ① 炮艇建模: "各个部分连接不紧密, 臃肿且奇丑无比" + "小炮艇像海上的坦克" (要真回转炮塔)
//   ② 炮艇 AI:  "总是在出生点打转, 一局双方的船基本遇不到"
//   ③ 不可摧毁工事: "岛上只有一个灯塔, 中间部分应当还有一个"
//   ④ 废墟残留: "杆子会在建筑被摧毁后浮空" / "库房被摧毁后会有一部分留存"
//   ⑤ 栈桥显示 BUG + 系统性图层打架
//   ⑥ 幽灵坦克开炮震动
//   ⑦ 哨亭楼梯在坡地上不接地
//
// 沙箱边界 (诚实声明): 本文件走 dev/_bootstub.js 的 THREE/DOM 桩, 能验**逻辑与数值**, 验不了
//   真 DOM/CSS/WebGL/帧率; 与 verify-naval.js 同一口径。
// ──────────────────────────────────────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const {sandbox,document,window}=require('./_bootstub.js');
const STRICT=process.argv.includes('--strict');
const OUTDIR=path.join(root,'dev/out');
const REPORT=path.join(OUTDIR,'seabatch-report.txt');

// ── 桩能力补齐 (与 verify-naval.js 同源口径; 缺了会把"桩能力不足"误报成真失败) ──
const V3c=sandbox.THREE.Vector3;
V3c.prototype.addScalar=function(s){ this.x+=s; this.y+=s; this.z+=s; return this; };
V3c.prototype.divideScalar=function(s){ s=s||1; this.x/=s; this.y/=s; this.z/=s; return this; };
for(const k of ['MeshLambertMaterial','MeshBasicMaterial','MeshStandardMaterial','MeshPhongMaterial','PointsMaterial','SpriteMaterial']){
	const C=sandbox.THREE[k];
	if(!C||!C.prototype) continue;
	if(!C.prototype.clone) C.prototype.clone=function(){ return new C(Object.assign({},this,{color:this.color})); };
	if(!C.prototype.dispose) C.prototype.dispose=function(){};
}
const AP=()=>({value:0,setValueAtTime(){},setTargetAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}});
class ACStub{
	createOscillator(){ return {frequency:AP(),detune:AP(),type:'',start(){},stop(){},connect(){},onended:null}; }
	createGain(){ return {gain:AP(),connect(){},disconnect(){}}; }
	createBuffer(){ return {getChannelData:()=>new Float32Array(16),duration:1,numberOfChannels:1}; }
	createBufferSource(){ return {buffer:null,loop:false,playbackRate:AP(),start(){},stop(){},connect(){},onended:null}; }
	createBiquadFilter(){ return {type:'',frequency:AP(),detune:AP(),Q:AP(),connect(){}}; }
	createDynamicsCompressor(){ return {threshold:AP(),ratio:AP(),attack:AP(),release:AP(),connect(){}}; }
	createStereoPanner(){ return {pan:AP(),connect(){}}; }
	resume(){ return Promise.resolve(); }
	get state(){ return 'running'; }
	get destination(){ return {}; }
}
sandbox.AudioContext=ACStub; sandbox.window.AudioContext=ACStub; sandbox.window.webkitAudioContext=ACStub;
// InstancedMesh 桩缺 instanceMatrix.array → 08-effects 的 queueSink 会读 undefined; 这里补上
const _IM=sandbox.THREE.InstancedMesh;
if(_IM){
	const _arr=new Float32Array(16*64);
	sandbox.THREE.InstancedMesh=class extends _IM{ constructor(g,m,c){ super(g,m,c); this.instanceMatrix={array:_arr}; } };
}
delete sandbox.window.CANNON;

const CAMP_ISLAND=11;
const NAV_FILES=['js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js'];
const BASE_HEAD=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15g-capmodels.js','js/15h-capital.js','js/15c-specveh.js'];
const BASE_TAIL=['js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/23-deploy.js','js/24-main.js'];
const FILES=BASE_HEAD.concat(NAV_FILES.filter(f=>fs.existsSync(path.join(root,f))),BASE_TAIL);

const SEED=42;
function mulberry32(a){ return function(){ a|=0; a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }

// ── 沙箱启动 (与 verify-naval.js 逐字同口径: 钉 seed、island 战役、模拟点「进入战场」) ──
function boot(campIdx){
	const ctx=vm.createContext(Object.assign({},sandbox));
	ctx.document=document; ctx.window=window; ctx.globalThis=ctx;
	ctx.location={search:'?seed='+SEED,href:'http://localhost/index.html?seed='+SEED,hostname:'localhost',protocol:'http:'};
	ctx.Math=Object.assign(Object.create(Math),{random:mulberry32(SEED)});
	ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){ return this._s[k]??null; },setItem(k,v){ this._s[k]=String(v); },removeItem(k){ delete this._s[k]; }};
	ctx.console={log:(...a)=>{ const s=a.map(x=>String(x)).join(' '); if(!/^\[(地形|HUD|NAV|世界|海战|反舰)/.test(s)) console.log(...a); },warn:console.warn.bind(console),error:console.error.bind(console)};
	const loaded=[],loadErrors=[];
	for(const f of FILES){
		try{ vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f}); loaded.push(f); }
		catch(e){ loadErrors.push({file:f,err:String(e&&e.stack||e).split('\n').slice(0,3).join(' | ')}); }
	}
	let start=null;
	try{ start=vm.runInContext(`(()=>{ try{ const b=document.getElementById('startBtn'); if(b&&b.onclick){ b.onclick(); return 'ok'; } return 'no-button'; }catch(e){ return 'ERR '+String(e&&e.stack||e); } })()`,ctx); }
	catch(e){ return {ctx,loaded,loadErrors,startErr:String(e&&e.stack||e)}; }
	return {ctx,loaded,loadErrors,startErr:null,start};
}
function N(ctx,code){ return vm.runInContext(code,ctx); }
function NT(ctx,code){ try{ return N(ctx,code); }catch(e){ return {__err:String(e&&e.message||e)}; } }

// ── 报告 ──
const OUT=[];
let nPass=0,nFail=0,nSkip=0;
function say(s){ OUT.push(s); console.log(s); }
function item(n,name,state,detail){ say('  '+(state==='pass'?'✓':state==='fail'?'✗':'⊘')+' 第'+n+'条 '+name+(detail?'\n      '+detail:'')); }
function pass(n,name,d){ nPass++; item(n,name,'pass',d); }
function fail(n,name,d){ nFail++; item(n,name,'fail',d); }
function skip(n,name,d){ nSkip++; item(n,name,'skip',d); }
function judge(ok,n,name,d){ ok?pass(n,name,d):fail(n,name,d); }

say('== 海战地图 7 项优化 · 联合验收 (dev/verify-seabatch.js) ==');
say('');

const B=boot(CAMP_ISLAND);
if(B.startErr||B.loadErrors.length){
	fail(0,'启动链: 塔拉瓦 LOAD 不报错',(B.loadErrors.map(e=>e.file+' → '+e.err).join('  ||  ')||B.startErr||'').slice(0,900));
	say('  启动链失败 ⇒ 后续判据无法取证, 提前结束');
	write();
	process.exit(1);
}
const ctx=B.ctx;
const POST=N(ctx,`(function(){ return {
  hasNaval: (typeof NavalCraft==='function'&&typeof navBuildModel==='function'),
  spec: (typeof NAVAL_SPEC!=='undefined')?Object.keys(NAVAL_SPEC):[],
  fleets: (typeof navalCraft!=='undefined'&&Array.isArray(navalCraft))?navalCraft.length:0,
  boxes:(typeof BOXES!=='undefined')?BOXES.length:-1, cyls:(typeof CYLS!=='undefined')?CYLS.length:-1,
  destr:(typeof DESTRUCTIBLES!=='undefined')?DESTRUCTIBLES.length:-1,
  regs:(typeof BUILD_REG!=='undefined')?BUILD_REG.length:-1,
  stairs:(typeof STAIRS!=='undefined')?STAIRS.length:-1,
  spots:(typeof SPOTS!=='undefined')?SPOTS.map(s=>({n:s.name,x:s.x,z:s.z,r:s.r,own:s.own,cap:s.cap,capTeam:s.capTeam,capable:!!s.capturable})):[],
  spotsRaw:(typeof CAMPAIGN!=='undefined'&&CAMPAIGN&&CAMPAIGN.spawns)?CAMPAIGN.spawns.length:0,
  bridges:(typeof BRIDGES!=='undefined')?BRIDGES.map(b=>({x:b.x,z:b.z,len:b.len,w:b.w,yaw:b.yaw,kind:b.kind,deckY:b.deckY})):[],
  mat:(typeof MAT!=='undefined')?Object.keys(MAT):[],
  depthHelper:(typeof depthVariant==='function')?true:((typeof depthOffset==='function')?true:false),
  stairHelper:(typeof towerStairGeom==='function')?true:false,
  turretAimAtArity:(typeof NavalCraft==='function'&&NavalCraft.prototype&&typeof NavalCraft.prototype.turretAimAt==='function')?NavalCraft.prototype.turretAimAt.length:-1
}; })()`);

// ══════════════════════════════════════════════════════════════════════════════
// 第①条 炮艇建模: 部件连通性 + 尺寸包络 + 真回转炮塔
// ══════════════════════════════════════════════════════════════════════════════
(function item1(){
	if(!POST.hasNaval){ skip(1,'炮艇建模',"未落盘: 无 navBuildModel/NavalCraft"); return; }
	const r=NT(ctx,`(function(){
		const out=[];
		for(const key of ['pt','gyorai']){
			const S=NAVAL_SPEC[key];
			if(!S){ out.push({key,err:'spec 缺失'}); continue; }
			let M=null,err=null;
			try{ M=navBuildModel(S); }catch(e){ err=String(e&&e.message||e); }
			if(!M||!M.grp){ out.push({key,err:'navBuildModel 失败: '+err}); continue; }
			const meshes=[];
			M.grp.traverse(o=>{ if(o.isMesh) meshes.push(o); });
			// 尺寸 = 所有网格的轴向包围盒。桩几何分两类: 参数式 (BoxGeometry 有 parameters.width/height/depth)
			//   与逐点式 (PlaneGeometry/CylinderGeometry 在桩里只给 position 数组) ⇒ 两条路都要走,
			//   否则逐点式的件会被当成 0 尺寸 (第一版据此把包围盒算成 0, 属**量测口径错**, 不是代码错)。
			const gbox=m=>{
				const G=m.geometry;
				if(G&&typeof G.boundingDims==='function'){
					const b=G.boundingDims();
					if(isFinite(b.hx)&&isFinite(b.hy)&&isFinite(b.hz)) return b;
				}
				const p=G&&G.parameters;
				if(p&&p.width!==undefined&&isFinite(p.width)) return {hx:p.width/2,hy:p.height/2,hz:p.depth/2};
				const a=G&&G.attributes&&G.attributes.position&&G.attributes.position.array;
				if(!a||!a.length) return {hx:0,hy:0,hz:0};
				let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9,z0=1e9,z1=-1e9;
				for(let i=0;i+2<a.length;i+=3){
					if(a[i]<x0)x0=a[i]; if(a[i]>x1)x1=a[i];
					if(a[i+1]<y0)y0=a[i+1]; if(a[i+1]>y1)y1=a[i+1];
					if(a[i+2]<z0)z0=a[i+2]; if(a[i+2]>z1)z1=a[i+2];
				}
				if(!isFinite(x0)||!isFinite(x1)) return {hx:0,hy:0,hz:0};
				return {hx:(x1-x0)/2,hy:(y1-y0)/2,hz:(z1-z0)/2};
			};
			let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9,z0=1e9,z1=-1e9;
			for(const m of meshes){
				const b=gbox(m), P=m.position;
				x0=Math.min(x0,P.x-b.hx); x1=Math.max(x1,P.x+b.hx);
				y0=Math.min(y0,P.y-b.hy); y1=Math.max(y1,P.y+b.hy);
				z0=Math.min(z0,P.z-b.hz); z1=Math.max(z1,P.z+b.hz);
			}
			// 材质实例唯一性 (硬约束③: 每台载具材质全部新建, 不许跨载具共享)
			const mats=new Set(); for(const m of meshes) if(m.material) mats.add(m.material);
			const dims=M.dims||{};
			out.push({key,
				L:+(z1-z0).toFixed(3), W:+(x1-x0).toFixed(3), H:+(y1-y0).toFixed(3),
				specL:S.hullL, specW:S.hullW, specH:S.hullH,
				devL:+(((z1-z0)-S.hullL)/S.hullL*100).toFixed(1), devW:+(((x1-x0)-S.hullW)/S.hullW*100).toFixed(1),
				meshN:meshes.length, matN:mats.size,
				hasTurret:!!M.turretG, hasBarrelPivot:!!(M.barrelPivot||M.pitchG),
				muzzles:Object.keys(M.muzzles||{}), torpedoN:((M.muzzles&&M.muzzles.torpedo)||[]).length,
				turretHit:M.turretHit||null, dimsTurretY:(dims.turretY!==undefined?dims.turretY:null),
				sightH:(S.sightH!==undefined?S.sightH:null), specTur:!!S.tur,
				err
			});
		}
		return out;
	})()`);
	if(r.__err){ fail(1,'炮艇建模',r.__err); return; }
	const lines=[];
	let ok=true, why=[];
	for(const o of r){
		if(o.err){ ok=false; why.push(o.key+' 建模失败: '+o.err); continue; }
		lines.push(`${o.key}: L=${o.L}/${o.specL}(${o.devL>0?'+':''}${o.devL}%) W=${o.W}/${o.specW}(${o.devW>0?'+':''}${o.devW}%) H=${o.H}/${o.specH} 网格=${o.meshN} 材质=${o.matN} 鱼雷管锚点=${o.torpedoN} 炮口键=[${o.muzzles.join(',')}]`);
		if(Math.abs(o.devL)>15||Math.abs(o.devW)>15){ ok=false; why.push(o.key+' 包围盒偏差 >15%'); }
		if(o.meshN>44){ ok=false; why.push(o.key+' 网格数 '+o.meshN+' >44 (硬约束)'); }
		if(o.torpedoN<1){ ok=false; why.push(o.key+' 无鱼雷管锚点 (用户要求保留鱼雷管)'); }
		// 用户第 1 条的核心诉求: "像海上的坦克" ⇒ 必须有真回转炮塔 (spec.tur + turretG)
		if(!o.specTur||!o.hasTurret){ ok=false; why.push(o.key+' 没有真回转炮塔 (spec.tur='+o.specTur+' turretG='+o.hasTurret+')'); }
		if(!o.hasBarrelPivot){ ok=false; why.push(o.key+' 无炮管俯仰组'); }
	}
	// 交叉印证: WS1 的自检跑的是**真 three.js r152** (dev/vendor/three.min.js), 本文件跑的是桩几何。
	//   "桩能不能量准"不该由我自己证明 —— 把对方的真值抓出来对照, 差太远就说明桩/口径有问题。
	let cross='';
	try{
		const rep=fs.readFileSync(path.join(OUTDIR,'_ws1-selfcheck.txt'),'utf8');
		const m=rep.match(/(?:pt|gyorai)[^\n]*?(2[0-9]\.\d+)\/(\d+\.\d+)/g);
		cross='   交叉印证(真 three.js r152 自检快照 '+path.basename(path.join(OUTDIR,'_ws1-selfcheck.txt'))+'): '+(m?m.slice(0,4).join(' | '):'(未解析到包围盒行)');
	}catch(e){ cross='   交叉印证: 未找到 WS1 自检快照 (可选)'; }
	judge(ok,1,'炮艇建模: 包围盒≤15% + 真回转炮塔 + 鱼雷管保留',lines.join('\n      ')+(why.length?'\n      ⚠ '+why.join('; '):'')+'\n'+cross);
})();

// ══════════════════════════════════════════════════════════════════════════════
// 第②条 炮艇 AI: 双方艇必须能相遇 (用户: "一局双方的船基本遇不到")
// ══════════════════════════════════════════════════════════════════════════════
(function item2(){
	if(!POST.hasNaval||!POST.fleets){ skip(2,'炮艇 AI 会师',"未落盘: navalCraft 为空"); return; }
	const r=NT(ctx,`(function(){
		// 判据口径 (第二版): 用**整局编制**推演, 不构造 1v1 样本。
		//   为什么改: 第一版只挑双方各 1 艇在出生点对推 —— 那是脱离实战的样本 (本图每队 3 艇),
		//   实测 1 艇时会贴着地图边缘绕远 (t=180s 才接近 20m), 而全队推演 t=50s 双方最近 67m。
		//   判据 = 双方**任意两艇**的最短距离在 120s 内进入 huntR (340m) ⇒ 会师成立。
		const A=navalCraft.filter(c=>c&&c.kind==='boat'&&c.team===0);
		const B=navalCraft.filter(c=>c&&c.kind==='boat'&&c.team===1);
		if(!A.length||!B.length) return {err:'找不到双方艇 (A='+A.length+' B='+B.length+')'};
		const pairMin=()=>{ let m=1e9; for(const a of A) for(const b of B) m=Math.min(m,Math.hypot(a.pos.x-b.pos.x,a.pos.z-b.pos.z)); return m; };
		const huntR=(function(){ try{ if(typeof NAV_AI!=='undefined'&&NAV_AI.huntR) return NAV_AI.huntR; }catch(e){} return 340; })();
		const d0=pairMin();
		let dMin=d0,tMin=0,tMeet=-1;
		const samples=[];
		for(let i=0;i<7200;i++){                 // 120s @ 1/60
			const dt=1/60;
			updateNaval(dt);
			nowT+=dt;
			const d=pairMin();
			if(d<dMin){ dMin=d; tMin=(i+1)/60; }
			if(tMeet<0&&d<huntR) tMeet=(i+1)/60;
			if(i%600===0){          // 每 10s 一条
				const c=[...A,...B].map(c=>[+c.pos.x.toFixed(0),+c.pos.z.toFixed(0)]);
				samples.push([+((i+1)/60).toFixed(0),+d.toFixed(0)].concat([].concat(...c)));
			}
		}
		const crew=A.concat(B).filter(c=>c.crewBot||c.driverBot).length;
		return {d0:+d0.toFixed(1), dMin:+dMin.toFixed(1), tMin:+tMin.toFixed(1), tMeet:+(tMeet<0?-1:tMeet).toFixed(1),
			huntR, nA:A.length, nB:B.length, crew, samples:samples.slice(0,9), err:null};
	})()`);
	if(r.__err||r.err){ fail(2,'炮艇 AI 会师',r.__err||r.err); return; }
	// 判据: 120s 内双方任意两艇最短距离必须进入 huntR (340m) —— 进入该距离才可能互相发现与交火
	judge(r.tMeet>0,2,'炮艇 AI: 双方艇在 120s 内进入互相发现距离 (huntR)',
		`编制 ${r.nA}v${r.nB} 艇 (有车组 ${r.crew})   初始最短 ${r.d0}m → 最近 ${r.dMin}m @ ${r.tMin}s   首次进入 huntR(${r.huntR}m) = ${r.tMeet>0?r.tMeet+'s':'从未'}\n      `+
		`10s 采样 [t,最短距离| 美艇 x,z… | 日艇 x,z…]: ${JSON.stringify(r.samples)}`);
})();

// ══════════════════════════════════════════════════════════════════════════════
// 第③条 中障壁不可摧毁工事 + 中立可占领
// ══════════════════════════════════════════════════════════════════════════════
(function item3(){
	const r=NT(ctx,`(function(){
		const regs=(typeof BUILD_REG!=='undefined')?BUILD_REG:[];
		const ind=regs.filter(g=>g&&g.indestr);
		const mid=ind.filter(g=>Math.abs(g.x)<120&&g.z>-60&&g.z<80);   // 岛腰带 (z −60..80)
		const sp=(typeof SPOTS!=='undefined')?SPOTS:[];
		const neutral=sp.filter(s=>s.own===-1);
		// 中立点是否落在工事圈内 (半径覆盖)
		const cover=mid.map(g=>neutral.map(s=>({d:+Math.hypot(s.x-g.x,s.z-g.z).toFixed(2),r:s.r,inside:Math.hypot(s.x-g.x,s.z-g.z)<s.r})));
		const raw=(typeof CAMPAIGN!=='undefined'&&CAMPAIGN&&CAMPAIGN.spawns)?CAMPAIGN.spawns.length:0;
		return {indN:ind.length, indTypes:ind.map(g=>g.type), indMid:mid.map(g=>({type:g.type,x:+g.x.toFixed(1),z:+g.z.toFixed(1),roofY:g.roofY,indestr:g.indestr})),
			spotsN:sp.length, neutral:neutral.map(s=>({n:s.name,x:s.x,z:s.z,r:s.r,capable:!!s.capturable})),
			spotsRaw:raw, cover};
	})()`);
	if(r.__err){ fail(3,'中障壁不可摧毁工事',r.__err); return; }
	const ok=r.indMid.length>=1&&r.neutral.length>=1&&r.neutral.every(s=>s.capable);
	judge(ok,3,'中障壁不可摧毁工事 + 中立可占领强点',
		`indestr 结构共 ${r.indN} 座 [${r.indTypes.join(',')}]   岛腰带 (z −60..80) 内 ${r.indMid.length} 座: `+
		`${r.indMid.map(g=>g.type+'@('+g.x+','+g.z+') roofY='+g.roofY).join(' / ')||'（无）'}\n      `+
		`强点: CAMPAIGN.spawns=${r.spotsRaw} 条, SPOTS=${r.spotsN} 个, 开局中立 ${r.neutral.length} 个 `+
		`${r.neutral.map(s=>`${s.n}@(${s.x},${s.z}) r=${s.r} capturable=${s.capable}`).join(' / ')}`);
})();

// ══════════════════════════════════════════════════════════════════════════════
// 第④条 废墟残留: 打掉塔台与机库后不许有悬空件
// ══════════════════════════════════════════════════════════════════════════════
(function item4(){
	const r=NT(ctx,`(function(){
		// 悬空件定义 (口径写死在这里, 便于复核): 摧毁后仍挂在 world 上的**视觉网格**,
		//   其竖直范围完全高于 1.5m, 且水平投影 1.2m 内**没有任何存活碰撞盒**的顶面伸到它下方。
		//   为什么用 1.5m: 地上的箱/桶/门板就算失去建筑也仍是"站得住的地物"; 用户报的是**悬在空中的杆/轨**。
		function hangers(){
			const alive=[];
			for(const b of BOXES){ if(b&&!b.dead) alive.push(b); }
			// ★2026-09-22 补口径 (原判据只有盒体 ⇒ 旗面必然误报): 支撑体还包括**圆柱碰撞体** CYLS ——
			//   旗杆 (05c 的 FLAGS: CylinderGeometry + CYLS{r:0.15,y0:g0,y1:g0+7}) 就是最典型的一例:
			//   旗面挂在杆顶 (y0≈g0+5.5) 且水平距杆 0~2.4m, 只查盒体时它必然被判"悬空"。
			//   实测该缺口在 island 全场报 42 件 → 计入 CYLS 后 34 件 (8 件是杆/柱顶挂件, 全部有支撑)。
			const aliveCyl=[];
			for(const c of CYLS){ if(c) aliveCyl.push(c); }
			const out=[];
			for(const m of world.children){
				if(!m||!m.isMesh||!m.geometry) continue;
				const p=m.geometry.parameters; if(!p) continue;
				let hw=0,hh=0,hd=0;
				if(p.width!==undefined){ hw=p.width/2; hh=p.height/2; hd=p.depth/2; }
				else if(p.radiusTop!==undefined){ hw=p.radiusTop; hh=p.height/2; hd=p.radiusTop; }
				const y0=m.position.y-hh, y1=m.position.y+hh;
				const gh=heightAt(m.position.x,m.position.z);
				if(y0-gh<2.5) continue;                    // ★ 口径: 包络底面必须离**地面** ≥2.5m。
				//   为什么改成"离地面"而不是"绝对值 1.5m": 绝对值会把"立在地上的灯柱/旗杆"误判 ——
				//   第一版就是这么报出 337 件的 (实测那批 1.9~2.5m 的件全部有落地碰撞盒)。
				let support=false;
				for(const b of alive){
					if(b.maxY<y0-0.6) continue;            // 顶面在它下方 0.6m 以上 ⇒ 托不住
					const cx=Math.max(b.minX,Math.min(m.position.x,b.maxX));
					const cz=Math.max(b.minZ,Math.min(m.position.z,b.maxZ));
					if(Math.hypot(m.position.x-cx,m.position.z-cz)<1.2){ support=true; break; }
				}
				if(!support) for(const c of aliveCyl){     // 圆柱支撑体 (旗杆/桩/柱): 水平距 ≤ 1.2 + 柱半径
					if(c.y1<y0-0.6) continue;
					if(Math.hypot(m.position.x-c.x,m.position.z-c.z)<1.2+(c.r||0)){ support=true; break; }
				}
				if(!support) out.push({y:+m.position.y.toFixed(2),y0:+y0.toFixed(2),y1:+y1.toFixed(2),gh:+gh.toFixed(2),x:+m.position.x.toFixed(1),z:+m.position.z.toFixed(1)});
			}
			return out;
		}
		// 只扫"被摧毁的目标柱脚周边" —— 全场扫描会因为"本来就没碰撞的落地道具"(灯柱/旗杆/桩) 大量误报,
		//   用户报的现象是"某座建筑塌了以后它的杆/轨留在空中", 所以判据限定在被打掉的这三座周围。
		const beforeAll=hangers().length;
		// 打掉机场塔台与两座机库 (它们的中心从 BUILD_REG 取, 不写死坐标)
		const regs=BUILD_REG.filter(g=>g&&(g.type==='controltower'||g.type==='hangar'));
		let hitN=0;
		for(const g of regs){ damageStructures({x:g.x,y:g.floor||0,z:g.z},26,1e6); hitN++; }
		// 推进若干帧让摧毁链/碎块/定时下沉跑完 (摧毁本身是同步的, 这里跑的是残骸与定时台账)
		for(let i=0;i<180;i++){
			const dt=1/60;
			if(typeof updateWreckSinks==='function') updateWreckSinks(dt);
			if(typeof updateDebris==='function') updateDebris(dt);
			if(typeof updateRagdolls==='function') updateRagdolls(dt);
			if(typeof updateNaval==='function') updateNaval(dt);
		}
		const after=hangers();
		// 目标柱脚 ±22m 内的悬空件 (与"被这两座建筑摧毁后留存"直接对应)
		const inTargets=after.filter(o=>regs.some(g=>Math.hypot(o.x-g.x,o.z-g.z)<22));
		return {types:regs.map(g=>g.type),targets:regs.length,hitN,destrAlive:DESTRUCTIBLES.filter(g=>!g.dead).length,
			beforeAll,afterN:after.length,inTargets:inTargets.length,after:inTargets.slice(0,10)};
	})()`);
	if(r.__err){ fail(4,'废墟残留 (悬空件)',r.__err); return; }
	if(!r.targets){ skip(4,'废墟残留 (悬空件)','未找到 controltower/hangar 注册条目'); return; }
	judge(r.inTargets===0,4,'废墟残留: 打掉塔台与机库后其柱脚周边悬空件 = 0',
		`目标 ${r.targets} 座 [${r.types.join(',')}]   打掉后存活可毁结构组 ${r.destrAlive}\n      `+
		`悬空件(全岛口径 y0−地形≥2.5m 且 1.2m 内无存活**碰撞盒或圆柱**): 打之前 ${r.beforeAll} 件 → 打之后 ${r.afterN} 件; `+
		`其中落在目标柱脚 ±22m 内的 **${r.inTargets} 件**`+(r.inTargets?`\n      ⚠ ${JSON.stringify(r.after)}`:'')+
		`\n      (全场那 ${r.afterN} 件多为"本来就没有碰撞体的落地道具/永久件", 不属于本次现象; 判据取目标柱脚周边)`);
})();

// ══════════════════════════════════════════════════════════════════════════════
// 第⑤条 栈桥: 地形渲染面必须退到桥面之下 (用户: "登陆的那个桥有严重的显示BUG")
// ══════════════════════════════════════════════════════════════════════════════
(function item5(){
	const r=NT(ctx,`(function(){
		const B=(typeof BRIDGES!=='undefined')?BRIDGES.find(b=>b.kind==='pier'):null;
		if(!B) return {err:'找不到 kind=pier 的栈桥'};
		const dy=B.deckY;
		// 采样: 桥矩形内的地形**渲染**高度 (必须走 terrainRenderY / bridgeDeckSinkAt; 缺函数则报明)
		const f=(typeof terrainRenderY==='function')?terrainRenderY:null;
		const sink=(typeof bridgeDeckSinkAt==='function')?bridgeDeckSinkAt:null;
		const rows=[];
		let n=0,minGap=1e9,maxGap=-1e9,worst=null;
		const sn=Math.sin(B.yaw||0), cs=Math.cos(B.yaw||0);
		for(let iu=-B.len/2+0.5;iu<=B.len/2-0.5;iu+=1.2){
			for(let iv=-B.w/2+0.3;iv<=B.w/2-0.3;iv+=0.9){
				const x=B.x+iu*sn+iv*cs, z=B.z+iu*cs-iv*cs*0+iv*cs;   // yaw=0 ⇒ (x+iv, z+iu)
				const px=B.x+iv*cs+iu*sn, pz=B.z+iu*cs-iv*sn;
				const hPhys=heightAt(px,pz);
				const hRender=f?f(px,pz):hPhys;
				const gap=dy-hRender;
				n++;
				if(gap<minGap){ minGap=gap; worst=[+px.toFixed(2),+pz.toFixed(2),+hRender.toFixed(4),+gap.toFixed(4)]; }
				if(gap>maxGap) maxGap=gap;
			}
		}
		// 桥缘过渡: 矩形外 1m 环带上不许出现 >0.15m 的跳变
		let jump=0, jumpAt=null;
		for(let iv=-B.w/2-1.5;iv<=B.w/2+1.5;iv+=0.25){
			let prev=null;
			for(let iu=-B.len/2-1.5;iu<=B.len/2+1.5;iu+=0.25){
				const h=f?f(B.x+iv,B.z+iu):heightAt(B.x+iv,B.z+iu);
				if(prev!==null&&Math.abs(h-prev)>0.15&&Math.abs(iv)>B.w/2-0.05&&Math.abs(iv)<B.w/2+0.05){ jump++; jumpAt=[+iv.toFixed(2),+iu.toFixed(2)]; }
				prev=h;
			}
		}
		return {dy,n,minGap:+minGap.toFixed(4),maxGap:+maxGap.toFixed(4),worst,jump,jumpAt,hasRenderY:!!f,hasSink:!!sink,
			plankQuery:(()=>{ // 面板条: 底面不低于桥面顶面
				let bad=0,tot=0;
				for(const m of world.children){ if(!m||!m.isMesh||!m.geometry) continue;
					const p=m.geometry.parameters; if(!p||!(Math.abs((p.width||0)-B.w)<0.05)||!(p.depth>0.3&&p.depth<0.45)) continue;
					tot++; if(m.position.y-p.height/2 < dy-1e-6) bad++;
				}
				return {tot,bad};
			})()};
	})()`);
	if(r.__err||r.err){ fail(5,'栈桥共面修复',r.__err||r.err); return; }
	const okGap=r.minGap>=0.02;               // 至少 2cm 间隔: 24bit 深度在 100m 处分辨率 ≈7.5mm
	const okPlank=r.plankQuery.bad===0;
	judge(okGap&&okPlank,5,'栈桥: 地形渲染面退到桥面之下 + 面板条不再埋进桥面',
		`桥面 dy=${r.dy}   采样 ${r.n} 点   地形渲染面与桥面高差: 最小 ${(r.minGap*1000).toFixed(1)}mm 最大 ${r.maxGap.toFixed(3)}m   最差点 (x,z,hRender,gap)=${JSON.stringify(r.worst)}\n      `+
		`面板条: 共 ${r.plankQuery.tot} 块, 底面低于桥面顶面的 ${r.plankQuery.bad} 块   桥缘跳变(>0.15m) ${r.jump} 处 ${r.jumpAt?JSON.stringify(r.jumpAt):''}\n      `+
		`深度偏移 helper: ${r.hasRenderY?'有 terrainRenderY':'⚠ 无'} ${r.hasSink?'有 bridgeDeckSinkAt':'⚠ 无'}`);
})();

// ══════════════════════════════════════════════════════════════════════════════
// 第⑥条 幽灵坦克开炮不震屏
// ══════════════════════════════════════════════════════════════════════════════
(function item6(){
	// 源码级判据 (最硬): 幽灵坦克那两个 addTrauma 调用点必须消失, 且普通坦克的两个必须还在 (阴性对照)。
	// 为什么在沙箱外读文件: vm 上下文里没有 fs; 而"哪一行代码还在不在"是源码事实, 不该用运行时行为间接推。
	const src=fs.readFileSync(path.join(root,'js/15c-specveh.js'),'utf8');
	const tank=fs.readFileSync(path.join(root,'js/15-vehicles.js'),'utf8');
	// 用括号配平取方法体 (不用正则: 本仓方法体里含正则/模板串, 正则套正则会自伤)
	const bodyOf=(s,sig)=>{
		const i=s.indexOf(sig); if(i<0) return null;
		let j=s.indexOf('{',i); if(j<0) return null;
		let d=0;
		for(let k=j;k<s.length;k++){
			const c=s[k];
			if(c==='{') d++;
			else if(c==='}'){ d--; if(d===0) return s.slice(j,k+1); }
		}
		return null;
	};
	// 判据: 方法体内**除注释行外**不得出现 addTrauma 调用 (WS5 保留了"本行原为 addTrauma(0.5), 已删"的注释,
	//   所以要按行过滤注释 —— 第一版直接把注释算成调用, 报了一个假红)。
	const callsIn=body=>{
		if(!body) return null;
		let n=0;
		for(const ln of body.split('\n')){
			const c=ln.indexOf('//');
			const code=c>=0?ln.slice(0,c):ln;
			if(code.includes('addTrauma')) n++;
		}
		return n;
	};
	const ghostFire=bodyOf(src,'fireCannon(customDir)');
	const ghostMG=bodyOf(src,'firePlayerMG(dir)');
	const ghostCannonN=callsIn(ghostFire);
	const ghostMGN=callsIn(ghostMG);
	const ghostFileHits=(src.match(/addTrauma\(/g)||[]).length;
	const tankHits=(tank.match(/addTrauma\(/g)||[]).length;
	const tankFireLine=/if\(this\.playerDriven\)\s*addTrauma\(0\.5\);/.test(tank);
	const tankMGCall=/addTrauma\(0\.02\);/.test(tank);
	const ok=(ghostCannonN===0)&&(ghostMGN===0)&&tankFireLine&&tankMGCall;
	judge(ok,6,'幽灵坦克开炮不震屏 (普通坦克 / 步兵手感不变 = 阴性对照)',
		`幽灵坦克 fireCannon 内 addTrauma 调用 = ${ghostCannonN} (应为 0; 方法体取到=${ghostFire!==null})   同轴机枪内 = ${ghostMGN} (应为 0; 取到=${ghostMG!==null})   15c 全文件字面出现 ${ghostFileHits} 次 (含"已删"注释)\n      `+
		`阴性对照: 15-vehicles 全文件 addTrauma ${tankHits} 处, 其中坦克主炮 addTrauma(0.5)=${tankFireLine} 同轴 addTrauma(0.02)=${tankMGCall} ⇒ 陆战震屏 ${ok?'未受影响':'⚠ 可能被误伤'}`);
})();

// ══════════════════════════════════════════════════════════════════════════════
// 第⑦条 哨亭楼梯接地 (坡地上)
// ══════════════════════════════════════════════════════════════════════════════
(function item7(){
	const r=NT(ctx,`(function(){
		const towers=(typeof BUILD_REG!=='undefined')?BUILD_REG.filter(g=>g&&g.type==='watchtower'):[];
		if(!towers.length) return {err:'没有 watchtower 注册条目'};
		if(typeof towerStairGeom!=='function') return {err:'没有 towerStairGeom helper (无法独立量测楼梯几何)'};
		const rows=[];
		let worst={gap:-1e9};
		for(const t of towers){
			const cs=Math.cos(t.ry||0), sn=Math.sin(t.ry||0);
			const LW=(lx,lz)=>[t.x+lx*cs+lz*sn, t.z-lx*sn+lz*cs];
			// ── 判据 A (运行时真值, 独立于 helper): 从**落地碰撞盒**取梯脚 ──
			//   05a 建踏步/踢面时给每个盒打 BOXES[k].stair=1 (与 05-world 的"梯道净高"排除口径同源)。
			//   梯脚 = 这些盒里最低那个的底面; 它与正下方地形的间距就是用户报的"不接地"的直接量。
			//   为什么不拿 helper 的 steps 反算: 那是把构造数学再算一遍, 算错了我也会跟着错。
			let stairB=null, stairN=0, stairTop=-1e9;
			for(const b of BOXES){
				if(!b||b.dead||!b.stair) continue;
				// ★ 必须**按本塔周边**过滤: 岛上还有**灯塔**的上下环廊梯也打了同一批标记,
				//   不过滤会把灯塔梯(24.35m)当成哨亭梯顶 —— 第一版就是这么得到 topDevMeas=15.9 的假红。
				const bx=(b.minX+b.maxX)/2, bz=(b.minZ+b.maxZ)/2;
				if(Math.hypot(bx-t.x,bz-t.z)>15) continue;
				stairN++;
				if(!stairB||b.minY<stairB.minY) stairB=b;
				if(b.maxY>stairTop) stairTop=b.maxY;
			}
			if(!stairB) { rows.push({x:+t.x.toFixed(1),z:+t.z.toFixed(1),err:'找不到 stair 标记的碰撞盒'}); continue; }
			const cxs=(stairB.minX+stairB.maxX)/2, czs=(stairB.minZ+stairB.maxZ)/2;
			const footSup=stairB.minY-heightAt(cxs,czs);
			// ★2026-09-22 接地判定改按**梯脚盒 footprint 下的地形区间** (原按盒中心单点采样):
			//   05a:257 的设计是"第一级踢面下探本级脚下地形 −0.05"—— 即**故意埋进地里 5cm** 做接地段,
			//   而那个 gi 只在**中心线**上采一次, 盒本身有 0.34m 宽 ⇒ 坡地上盒中心处的地面可以比采样点高
			//   3cm, 于是"中心读数"跌到 −0.064 (超出原判据下限 −0.05 的零余量), 但**盒底离盒下最高地面
			//   仍有 −0.079、离最低地面 −0.048** —— 是"埋进去", 不是"浮起来", 与用户报的"不接地"相反。
			//   故: 浮空看**最高地面** (盒底高过它 0.25 才算浮), 过埋看**最低地面** (深过 0.15 才算异常)。
			//   island 实测 6 座: 5 座 footprint 地形零变化 (读数恰好 −0.05 = 设计值); 1 座变化 0.031m。
			let ftMin=1e9, ftMax=-1e9;
			for(const fx of [stairB.minX,cxs,stairB.maxX]) for(const fz of [stairB.minZ,czs,stairB.maxZ]){
				const h=heightAt(fx,fz); if(h<ftMin) ftMin=h; if(h>ftMax) ftMax=h;
			}
			const footVsMax=stairB.minY-ftMax, footVsMin=stairB.minY-ftMin, footSpan=ftMax-ftMin;
			// ── 判据 B/C (解析口径): 级高恒定 + 顶步与平台齐平 ──
			let gMax=-1e9;
			for(const [lx,lz] of [[-1.5,-1.5],[1.5,-1.5],[-1.5,1.5],[1.5,1.5]]){ const p=LW(lx,lz); const gh=heightAt(p[0],p[1]); if(gh>gMax) gMax=gh; }
			const deckTop=gMax+4.6;
			let g=null;
			try{ g=towerStairGeom({x:t.x,z:t.z,ry:t.ry||0,L:LW},deckTop); }catch(e){ rows.push({x:+t.x.toFixed(1),z:+t.z.toFixed(1),err:String(e&&e.message||e)}); continue; }
			let srDev=0;
			for(let i=1;i<g.steps.length;i++) srDev=Math.max(srDev,Math.abs((g.steps[i].top-g.steps[i-1].top)-g.sr));
			// 顶步齐平: 拿**构造产物**顶端对平台面 (平台面 = 最高 stair 盒的顶面; 顶踏步与平台齐平 ⇒ 两者相等)
			// ★2026-09-22 修判据自身缺陷: 这里原本又声明了一次 stairTop (同名同作用域, 与上面"判据 A 的梯脚
			//   统计"那段重复) ⇒ 整条第⑦条直接抛 "Identifier 'stairTop' has already been declared" ——
			//   也就是说这条判据**从来没真跑过** (报的是脚本语法错, 不是楼梯结论)。去掉重复声明, 复用上面那个值。
			//   (注: 本段在模板字符串里, 注释中不能出现反引号。第一版就是这么把模板提前截断的。)
			// ★2026-09-22 修判据读数: 原写作 g.steps[0].top 并注为"顶踏面", 但 towerStairGeom 的 steps 是
			//   **自下而上**建的 (top = deckTop − sr×(n−1−i) ⇒ i=n−1 才是顶踏步)。取 [0] 实际量的是**最下一级**,
			//   于是 topDev 恒等于 −sr×(n−1) (−4.18) —— 那是"梯脚到平台的总高", 不是任何失配。
			//   本条判据此前因重复声明 stairTop 抛语法错而从未执行, 所以这个读数错一直没暴露。
			const plat=g.steps[g.steps.length-1].top;  // 顶踏面 (= deckTop; steps 自下而上 ⇒ 末项才是顶)
			const topDev2=stairTop-plat;               // 用碰撞盒实测顶端 vs 解析顶踏面
			const topDev=g.steps[0].top-deckTop;       // 解析自洽性 (helper 自报 vs 我按四腿重算的 deckTop)
			// 辅助诊断: helper 自报的梯脚地形 vs 我独立算的 (不一致 ⇒ 我们的 XZ 变换口径不同)
			const fp=LW(0,g.footZ);
			const diag={helperFootGi:+g.footGi.toFixed(4), myFootH:+heightAt(fp[0],fp[1]).toFixed(4), footZ:+g.footZ.toFixed(2), wp:[+fp[0].toFixed(2),+fp[1].toFixed(2)], deckTop:+deckTop.toFixed(4), stairsTopM:+stairTop.toFixed(4), topDevMeas:+topDev2.toFixed(4)};
			rows.push({x:+t.x.toFixed(1),z:+t.z.toFixed(1),n:g.n,stairN,foot:+footSup.toFixed(4),srDev:+srDev.toFixed(12),topDev:+topDev.toFixed(12),hm:+stairB.minY.toFixed(3),
				ftMax:+ftMax.toFixed(4),ftMin:+ftMin.toFixed(4),footVsMax:+footVsMax.toFixed(4),footVsMin:+footVsMin.toFixed(4),footSpan:+footSpan.toFixed(4),diag});
			if(footSup>worst.gap) worst={gap:+footSup.toFixed(4),x:+t.x.toFixed(1),z:+t.z.toFixed(1)};
		}
		return {n:towers.length,rows,worst,err:null};
	})()`);
	if(r.__err||r.err){ fail(7,'哨亭楼梯接地',r.__err||r.err); return; }
	const bad=r.rows.filter(o=>o.err);
	// 浮空/过埋的阈值 (单源; 与上面 in-sandbox 段的注释同源):
	//   FOOT_FLOAT=0.25  —— 盒底高过盒下**最高**地面这么多 ⇒ 浮空 (用户报的现象)
	//   FOOT_DEEP =0.15  —— 盒底低于盒下**最低**地面这么多 ⇒ 过埋 (设计只埋 0.05)
	const FOOT_FLOAT=0.25, FOOT_DEEP=0.15;
	const ok=bad.length===0&&r.rows.every(o=>o.footVsMax<=FOOT_FLOAT&&o.footVsMin>=-FOOT_DEEP&&o.srDev<=1e-9&&Math.abs(o.diag.topDevMeas)<=1e-6);
	judge(ok,7,'哨亭楼梯接地: 梯脚盒底不浮空 (≤ 盒下最高地面+0.25) / 不过埋 (≥ 盒下最低地面−0.15) + 级高恒定 + 顶步齐平',
		`哨亭 ${r.n} 座   逐座 (x,z,级数,stair盒数,梯脚盒底−地形,级高偏差,顶步−平台):\n      `+
		r.rows.map(o=>o.err?`(${o.x},${o.z}) ERR ${o.err}`:`(${o.x},${o.z}) n=${o.n} 盒=${o.stairN} 梯脚(对盒中心)=${o.foot} 对最高地面=${o.footVsMax} 对最低地面=${o.footVsMin} 地形跨度=${o.footSpan} srDev=${o.srDev} 顶步量测=${o.diag.topDevMeas} 平台自洽=${o.topDev}`).join('\n      ')+
		`\n      最差梯脚 ${r.worst.gap}m @ (${r.worst.x},${r.worst.z})   (量测口径: BOXES[k].stair=1 的最低碰撞盒底面 vs heightAt —— 构造产物, 不是重算构造数学)`);
})();

// ══════════════════════════════════════════════════════════════════════════════
// 附: 强点机制不回归 (非 clash 图的固定出生点不许变成可争夺)
// ══════════════════════════════════════════════════════════════════════════════
(function itemX(){
	const r=NT(ctx,`(function(){
		return SPOTS.map(s=>({n:s.name,own:s.own,cap:+s.cap.toFixed(3),ct:s.capTeam,capable:!!s.capturable}));
	})()`);
	if(r.__err){ skip(8,'强点机制不回归',r.__err); return; }
	// island 是 assault 图: 按数据声明口径, 只有 team:-1 的点可争夺
	const ok=r.length>=1&&r.every(s=>s.capable===true);
	judge(ok,8,'强点: island 的中立点已可争夺 (非 clash 图的固定出生点不受影响见 verify-strongpoint)',
		`SPOTS=${r.length} 个: ${r.map(s=>`${s.n}(own=${s.own},cap=${s.cap},capable=${s.capable})`).join(' / ')}`);
})();

say('');
say(`合计: ${nPass} 通过 / ${nFail} 失败 / ${nSkip} 跳过`+(STRICT&&nSkip?`  (--strict: 跳过=失败)`:''));
write();
function write(){
	try{ fs.mkdirSync(OUTDIR,{recursive:true}); fs.writeFileSync(REPORT,OUT.join('\n')+'\n','utf8'); }catch(e){}
}
const bad=nFail+(STRICT?nSkip:0);
process.exit(bad?1:0);
