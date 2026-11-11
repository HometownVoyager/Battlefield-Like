// ─────────────────────────────────────────────────────────────
// dev/verify-willow-20261110.js —— 2026-11-10 柳树批验收 (淞沪垂柳修复+实例批化+交互接入)
//   ① 连接修复: 主枝根钉干顶 (旧版硬摆离轴 0.5m 半空), 冠片蓬进枝梢高度带 [3.0,4.0],
//     垂条顶锚进冠带 [3.3,3.9] 且水平钳进冠幅 —— 探针从记录部件数据 (wt/wb/wl) 复算全部几何关系
//   ② 实例批化: 干/枝/叶冠 3 张 InstancedMesh (WLOW_IM), 旧版每棵 23 个裸 mesh (~79棵≈1800 draw call)
//   ③ 交互接入: 旧版不入 TREE_LIVE/FLORA_HASH/燃料表 (烧不着/炸不倒/碾不倒的根因); 现按 tree() 同账
//     登记 (kind:'willow') —— 燃烧→倒伏→焦黑→沉入同一条链 / explosionFlora 掀倒 / floraCrushTank 撞倒
//   ④ 布局随机流不漂移: 每棵柳 135 次 wr 消耗顺序逐位保持, golden 柳位序列 (79 棵, 种子 42/424242)
//     钉死对账 (改前用临时包装脚本采集 79 个调用位, 采集脚本已用毕删除; 本探针钉"接受位=调用序保序子列")
// 口径: 与 verify-vehburn-20261109 同款 boot (真 three + index.html 全脚本链 + startBtn 开局),
//   战役钉淞沪 (songhu), 天气钉 clear (柳图默认 rain 会压火, 燃烧链须晴档)。
// 2026-11-11 实机回归补: 「柳全消失」病根 = flushWillows/_wlQ 用普通对象四元数喂 compose (vendor 读 ._x 私有字段→旋转全 NaN;
//   平移分量不受影响, 故 ②-9 平移钉漏检) → 增 ②-10 初始矩阵全量 NaN/零旋转扫描 + ②-11 旋转分量数学期望钉 + ④-6 交互态扫描。
// 用法: node dev/verify-willow-20261110.js [--neg]
//   --neg = 阴性对照 (9 补丁, 对认按红名): N1 柳登记降级乔木 kind / N2 主枝根脱锚 (回旧 2.2m 定高) /
//   N3 垂条顶脱锚 (冠带下移 1m) / N4 treeIgnitePass 不认柳 / N5 explosionFlora 不认柳 (退炸没) /
//   N6 floraCrushTank 不认柳 (退碾没) / N7 烧尽叶冠不隐藏 / N8 沉入不分派柳实例批 / N9 flushWillows 调用摘除
// ─────────────────────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const NEG=process.argv.includes('--neg');
const OK=[],BAD=[];
function assert(name,cond,detail){ (cond?OK:BAD).push(name); console.log(`  ${cond?'✓':'✗'} ${name}${detail?'  '+detail:''}`); }
function section(t){ console.log('\n══ '+t+' ══'); }
const SRC=f=>fs.readFileSync(path.join(root,f),'utf8');

const patchStyle=(el)=>{ if(el&&el.style&&typeof el.style.setProperty!=='function') el.style.setProperty=function(k,v){ this[k]=v; }; return el; };
const _stub=require('./_bootstub.js');
{
const document=_stub.document;
const g=document.getElementById.bind(document), c=document.createElement.bind(document), q=document.querySelector.bind(document);
document.getElementById=(id)=>patchStyle(g(id));
document.createElement=(t)=>patchStyle(c(t));
document.querySelector=(s)=>patchStyle(q(s));
}

// ── 阴性对照 (一律单行锚) ──
const PATCHES=[
 // N1 病灶还原: 柳登记降级为乔木 kind ⇒ kind:'willow' 计数归零 + 实例批分派/焦黑/沉入全走乔木空路径
 ['js/05b-props.js',"'willow',x,z,s:1","'tree',x,z,s:1"],
 // N2 病灶还原: 主枝根脱锚 —— 回旧版"离干轴定高 2.2m 半空硬摆" ⇒ 连接性断言红
 ['js/05b-props.js','oy:ty-g0-0.12+dy*0.58','oy:2.2'],
 // N3 病灶还原: 垂条顶脱锚 —— 顶从冠带 [3.3,3.9] 下移 1m 到 [2.3,2.9] ⇒ 垂条锚定断言红
 ['js/05b-props.js','oy:topY+0.5+off[1]','oy:topY-0.5+off[1]'],
 // N4 病灶还原: treeIgnitePass 不认柳 ⇒ 格子火/地面火链对柳失效
 ['js/04b-fire.js','if((rec.kind!==\'tree\'&&rec.kind!==\'willow\')||_tiSeen.has(rec)) return;','if(rec.kind!==\'tree\'||_tiSeen.has(rec)) return;'],
 // N5 病灶还原: explosionFlora 不认柳 ⇒ 柳落进灌木"炸没"分支 (vanishFlora) 而非掀倒
 ['js/04b-fire.js','if(rec.kind===\'tree\'||rec.kind===\'dead\'||rec.kind===\'palm\'||rec.kind===\'willow\'){','if(rec.kind===\'tree\'||rec.kind===\'dead\'||rec.kind===\'palm\'){'],
 // N6 病灶还原: floraCrushTank 不认柳 ⇒ 柳落进"碾没"分支而非撞倒
 ['js/04b-fire.js','if(rec.kind===\'tree\'||rec.kind===\'willow\'){','if(rec.kind===\'tree\'){'],
 // N7 病灶还原: 烧尽叶冠不隐藏 (19 叶实例不零缩放) ⇒ 焦黑断言红
 ['js/04b-fire.js','for(let k2=0;k2<19;k2++) lm2.setMatrixAt(tr.wi*19+k2,_fm);','; // NEG N7'],
 // N8 病灶还原: 沉入不分派柳实例批 (走乔木 TREE_IM 空路径, 柳实例悬停不沉) ⇒ 沉入断言红
 ['js/04b-fire.js','if(s.tr.kind===\'willow\') willowInstanceMatrices(s.tr,1.5,-3.6*k);','if(false) willowInstanceMatrices(s.tr,1.5,-3.6*k);'],
 // N9 病灶还原: buildWorld 末尾 flushWillows() 调用摘除 ⇒ 柳永不合批, WLOW_IM=null
 ['js/05c-layouts.js','flushWillows();','; // NEG N9'],
];
const PATCH_MAP={};
const ONLY=(process.argv.find(a=>a.startsWith('--only='))||'').slice(7)||null;
if(NEG) PATCHES.forEach(([f,from,to],pi)=>{
 if(ONLY&&('N'+(pi+1))!==ONLY) return;   // --only=Nx 单补丁亲验 (累积模式会互相掩盖)
 const s=PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f);
 if(s.indexOf(from)<0) throw new Error('阴性对照锚点未找到: '+f+' :: '+from.slice(0,70));
 PATCH_MAP[f]=s.split(from).join(to);
});
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f));

// ── ① 源码防回退 ─────────────────────────────────────────────
section('① 源码防回退 (修好的写法在 / 旧写法不在)');
{
const s05b=SRC('js/05b-props.js'), s04=SRC('js/04b-fire.js'), s05c=SRC('js/05c-layouts.js'), s23b=SRC('js/23b-worldrestore.js');
assert('05b: 柳建模批三件套 (WILL_BATCH/WLOW_IM/willowTree) + 登记 (fuelAdd/TREE_LIVE/floraHashAdd/CYLS foliage)',
 s05b.includes('const WILL_BATCH=[];')&&s05b.includes('let WLOW_IM=null;')&&s05b.includes('function willowTree(x,z){')
 &&s05b.includes('function flushWillows(){')
 &&s05b.includes("const rec={kind:'willow',x,z,s:1,g0,")
 &&s05b.includes('fuelAdd(x,z,1.0);')&&s05b.includes('TREE_LIVE.push(rec);')
 &&s05b.includes('floraHashAdd(rec);')&&s05b.includes('foliage:true}; // 垂柳主干'));
assert('05b: 主枝根钉干顶 (ty-g0-0.12 下嵌) + 垂条顶锚冠带 (topY+0.5) + 手算四元数三件套',
 s05b.includes('oy:ty-g0-0.12+dy*0.58')&&s05b.includes('oy:topY+0.5+off[1]')
 &&s05b.includes('function _wqAxis(')&&s05b.includes('function _wqMul(')&&s05b.includes('function _wqRotV('));
assert('05b: flushWillows 实例批 (3 张 InstancedMesh + frustumCulled=false + instColorInit 白初始化)',
 s05b.includes('new THREE.InstancedMesh(wlowTrunkGeo,MAT.bark,n)')
 &&s05b.includes('new THREE.InstancedMesh(wlowBranchGeo,MAT.bark,n*3)')
 &&s05b.includes('new THREE.InstancedMesh(wlowLeafGeo,MAT.leaves,n*19)')
 &&(s05b.match(/frustumCulled=false;/g)||[]).length>=3
 &&s05b.includes('instColorInit(trunks); instColorInit(branches);'));
assert('04b: treeIgnitePass 认柳 + 格烧尽排除柳 (柳走自己的树链不被 vanish)',
 s04.includes("if((rec.kind!=='tree'&&rec.kind!=='willow')||_tiSeen.has(rec)) return;")
 &&s04.includes("if(!rec.dead&&rec.alive!==false&&rec.kind!=='tree'&&rec.kind!=='willow') vanishFlora(rec,false,true);"));
assert('04b: explosionFlora 认柳 (掀倒非炸没) + floraCrushTank 认柳 (撞倒非碾没)',
 s04.includes("if(rec.kind==='tree'||rec.kind==='dead'||rec.kind==='palm'||rec.kind==='willow'){")
 &&s04.includes("const obj=rec.kind!=='tree'&&rec.kind!=='willow';")
 &&s04.includes("if(rec.kind==='tree'||rec.kind==='willow'){"));
assert('04b: willowInstanceMatrices 单源 + 三分派口 (倒伏/沉入) + 烧尽焦黑支路 (叶零缩放+干枝染炭)',
 s04.includes('function willowInstanceMatrices(tr,th,dy=0){')
 &&s04.includes("else if(tr.kind==='willow') willowInstanceMatrices(tr,th);")
 &&s04.includes("if(s.tr.kind==='willow') willowInstanceMatrices(s.tr,1.5,-3.6*k);")
 &&s04.includes('const lm2=WLOW_IM.leaves;')
 &&s04.includes('WLOW_IM.trunks.setColorAt(tr.wi,_charCol);')
 &&s04.includes('WLOW_IM.branches.setColorAt(tr.wi*3+2,_charCol);'));
assert('23b: WLOW_IM 三张实例批快照还原 (倒伏/焦黑/沉入态一并随世界快照走)',
 s23b.includes('snapIM(WLOW_IM.trunks); snapIM(WLOW_IM.branches); snapIM(WLOW_IM.leaves);'));
const iFB=s05c.indexOf('flushTreeBatch();'), iFW=s05c.indexOf('flushWillows();');
assert('05c: flushWillows 在 flushTreeBatch 之后、全部布局代码之后调用',iFB>=0&&iFW>iFB,`idx 批树=${iFB} 柳=${iFW}`);
}

// ── 沙箱装载 (真 three; 与 verify-vehburn-20261109 同款 boot) ──
function loadRealTHREE(){
	const m={exports:{}};
	const s={console,Math,JSON,Date,module:m,exports:m.exports,self:null,globalThis:null,
		window:{addEventListener(){},removeEventListener(){},devicePixelRatio:1},
		document:{createElementNS:()=>({style:{}}),createElement:()=>({style:{},getContext:()=>null})},
		navigator:{userAgent:'node'},requestAnimationFrame:()=>0,cancelAnimationFrame(){},performance:{now:()=>Date.now()},
		setTimeout:()=>0,clearTimeout(){},URL:{createObjectURL(){return ''},revokeObjectURL(){}},Blob:function(){},Image:function(){},
	};
	s.self=s; s.globalThis=s;
	vm.createContext(s);
	vm.runInContext(fs.readFileSync(path.join(root,'dev/vendor/three.min.js'),'utf8'),s,{filename:'dev/vendor/three.min.js'});
	return m.exports;
}
const html=SRC('index.html');
const FILES=[...html.matchAll(/src="(js\/[^"?]+)/g)].map(m=>m[1]);
function boot(campIdx){
	const T=loadRealTHREE();
	T.WebGLRenderer=class{ constructor(){ this.domElement=Object.assign(document.createElement('canvas'),{width:0,height:0}); this.shadowMap={enabled:false,type:0,autoUpdate:true};
		this.setSize=()=>{}; this.setPixelRatio=()=>{}; this.render=()=>{}; this.clear=()=>{}; this.clearDepth=()=>{};
		this.outputColorSpace=''; this.setClearColor=()=>{}; this.setAnimationLoop=()=>{}; } };
	const stub=_stub;
	const sandbox=stub.sandbox,document=stub.document,window=stub.window;
	sandbox.THREE=T; sandbox.window.THREE=T;
	const V3c=T.Vector3;
	if(!V3c.prototype.addScalar) V3c.prototype.addScalar=function(s){ this.x+=s; this.y+=s; this.z+=s; return this; };
	if(!V3c.prototype.divideScalar) V3c.prototype.divideScalar=function(s){ s=s||1; this.x/=s; this.y/=s; this.z/=s; return this; };
	T.Object3D.prototype.clear=function(){ this.children.length=0; return this; };
	const AP=()=>({value:0,setValueAtTime(){},setTargetAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}});
	class ACStub{
	createOscillator(){ return {frequency:AP(),detune:AP(),type:'',start(){},stop(){},connect(){},onended:null}; }
	createGain(){ return {gain:AP(),connect(){},disconnect(){}}; }
	createBuffer(){ return {getChannelData:()=>new Float32Array(16),duration:1,numberOfChannels:1}; }
	createBufferSource(){ return {buffer:null,loop:false,playbackRate:AP(),start(){},stop(){},connect(){},onended:null}; }
	createBiquadFilter(){ return {type:'',frequency:AP(),detune:AP(),Q:AP(),connect(){}}; }
	createDynamicsCompressor(){ return {threshold:AP(),ratio:AP(),attack:AP(),release:AP(),connect(){}}; }
	createStereoPanner(){ return {pan:AP(),connect(){}}; }
	resume(){ return Promise.resolve(); } get state(){ return 'running'; } get destination(){ return {}; }
	get currentTime(){ return 0; } get sampleRate(){ return 44100; }
	}
	sandbox.AudioContext=ACStub; sandbox.window.AudioContext=ACStub; sandbox.window.webkitAudioContext=ACStub;
	delete sandbox.window.CANNON;
	const byId={};
	const ctx=vm.createContext(Object.assign({},sandbox));
	ctx.document=Object.assign({},document,{getElementById:id=>{ if(!byId[id]){ byId[id]=document.createElement('div'); byId[id].id=id; } return byId[id]; }});
	const listeners={};
	const addL=(t,f)=>{ (listeners[t]=listeners[t]||[]).push(f); };
	ctx.addEventListener=addL; ctx.removeEventListener=()=>{};
	ctx.document.addEventListener=addL; ctx.document.removeEventListener=()=>{};
	ctx.window=Object.assign({},window,{addEventListener:addL,removeEventListener(){}});
	ctx.dispatchEvent=ev=>{ if(!ev.preventDefault) ev.preventDefault=()=>{}; if(!ev.stopPropagation) ev.stopPropagation=()=>{}; for(const f of (listeners[ev.type]||[]).slice()) f(ev); return true; };
	ctx.KeyboardEvent=class{ constructor(t,o){ o=o||{}; this.type=t; this.code=o.code; this.repeat=!!o.repeat; } };
	ctx.MouseEvent=class{ constructor(t,o){ o=o||{}; this.type=t; this.button=o.button; } };
	ctx.globalThis=ctx;
	ctx.setTimeout=(f)=>{ try{ f(); }catch(e){ console.log('  [异步桩] '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | ')); } return 0; };
	ctx.clearTimeout=()=>{};
	ctx.localStorage={_s:{sf_campaign:String(campIdx),sf_exp:'0',sf_pseed:'424242',sf_weather:'clear'},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
	for(const f of FILES){ vm.runInContext(srcOf(f),ctx,{filename:f}); }
	return ctx;
}
const IDX=vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="songhu")',boot(vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="normandy")',boot(0))));
const ctx=boot(IDX);
const G=s=>vm.runInContext(s,ctx,{timeout:300000});
let err=null;
try{ G("document.getElementById('startBtn').onclick();"); }catch(e){ err='start: '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); }
if(!err) try{ G("player.team=0; player.cls=0; player.spectator=false; player.alive=true; player.deployed=true;"); }catch(e){ err='playerInit: '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); }
assert('② 前置: 淞沪开局+玩家就位',!err&&G('typeof tanks==="object"&&tanks.length>0')===true,err||'');

// ── ② 登记: TREE_LIVE/FLORA_HASH/燃料/碰撞柱/实例批 ──────────
section('② 柳登记: TREE_LIVE + FLORA_HASH + 燃料格 + 碰撞柱 + WLOW_IM 实例批 (旧版全缺=纯摆设根因)');
G("globalThis.WLS=TREE_LIVE.filter(r=>r.kind==='willow');");
assert('②-1 淞沪柳登记 TREE_LIVE (79 调用, 布点碰撞合法拒绝后收 75; 下限 70 防 PROPS 随机波动翻拒)',
 G('WLS.length')>=70&&G('WLS.length')<=79,'n='+G('WLS.length'));
assert('②-2 每棵部件账齐 (wi 索引 + 3 主枝 + 19 冠条 [7 冠+12 条])',G('WLS.every(r=>r.wi>=0&&r.wb.length===3&&r.wl.length===19)')===true);
assert('②-3 FLORA_HASH 索引可查 (treeIgnitePass/explosionFlora/floraCrushTank 的入口)',G('WLS.every(r=>{let f=false; floraNear(r.x,r.z,0.5,rec=>{if(rec===r) f=true;}); return f;})')===true);
assert('②-4 燃料格已充 (柳下格可燃, 地面火能烧进柳)',G('WLS.every(r=>FUEL[fCellI(r.x,r.z)]>0.05)')===true);
assert('②-5 碰撞柱在场且 foliage 豁免 (空中撞楼口径, 三虫批①)',G('WLS.every(r=>r.cyl&&r.cyl.foliage===true&&r.cyl.r>0&&CYLS.includes(r.cyl))')===true);
assert('②-6 WLOW_IM 三张实例批到位且计数精确 (n / n*3 / n*19)',
 G('!!WLOW_IM&&WLOW_IM.trunks.count===WLS.length&&WLOW_IM.branches.count===WLS.length*3&&WLOW_IM.leaves.count===WLS.length*19')===true);
assert('②-7 实例批已并入 world + 建模批清空',
 G('!!WLOW_IM&&world.children.includes(WLOW_IM.trunks)&&world.children.includes(WLOW_IM.branches)&&world.children.includes(WLOW_IM.leaves)&&WILL_BATCH.length===0')===true);
assert('②-8 instanceColor 白初始化 (焦黑染色前置, 04b 同口径; instanceColor 存 linear, 白=1)',
 G('!!WLOW_IM&&WLOW_IM.trunks.instanceColor&&WLOW_IM.branches.instanceColor&&WLOW_IM.trunks.instanceColor.array[0]===1&&WLOW_IM.branches.instanceColor.array[0]===1')===true);
if(G('!!WLOW_IM&&WLS.length>0')){
const ta=G('WLOW_IM.trunks.instanceMatrix.array');
const r0=G('WLS[0]');
assert('②-9 实例矩阵真身: 干实例#0 中心 = (x, g0+1.4, z)',
 Math.abs(ta[12]-r0.x)<1e-6&&Math.abs(ta[13]-(r0.g0+1.4))<1e-6&&Math.abs(ta[14]-r0.z)<1e-6,
 `(${ta[12].toFixed(2)},${ta[13].toFixed(2)},${ta[14].toFixed(2)}) vs (${r0.x.toFixed(2)},${(r0.g0+1.4).toFixed(2)},${r0.z.toFixed(2)})`);G("globalThis._sc=(()=>{const f=(im)=>{const a=im.instanceMatrix.array;let bad=0,zr=0;for(let i=0;i<a.length;i+=16){for(let c=0;c<16;c++)if(!Number.isFinite(a[i+c]))bad++;if(Math.abs(a[i])+Math.abs(a[i+1])+Math.abs(a[i+2])<1e-9)zr++;}return{bad,zr};};return{t:f(WLOW_IM.trunks),b:f(WLOW_IM.branches),l:f(WLOW_IM.leaves)};})();");
assert('②-10 初始矩阵全有限 + 旋转列非零 (vendor compose 读 ._x 私有字段: 普通对象四元数=NaN=实机整批隐形而平移钉漏检, 2026-11-11 实机回归钉)',
 G('_sc.t.bad===0&&_sc.b.bad===0&&_sc.l.bad===0&&_sc.t.zr===0&&_sc.b.zr===0&&_sc.l.zr===0')===true,
 `NaN=${G('_sc.t.bad+_sc.b.bad+_sc.l.bad')} 零旋转列=${G('_sc.t.zr+_sc.b.zr+_sc.l.zr')}`);
{
const q0=G('WLS[0].wt');
const e00=(1-2*(q0.q[1]*q0.q[1]+q0.q[2]*q0.q[2]))*q0.sx, e05=(1-2*(q0.q[0]*q0.q[0]+q0.q[2]*q0.q[2]))*q0.sy, e10=(1-2*(q0.q[0]*q0.q[0]+q0.q[1]*q0.q[1]))*q0.sz;
assert('②-11 干实例#0 旋转分量=部件四元数数学期望 (compose 真吃到 q; 防静默恒等/分量丢失)',
 Math.abs(ta[0]-e00)<1e-6&&Math.abs(ta[5]-e05)<1e-6&&Math.abs(ta[10]-e10)<1e-6,
 `te[0]=${ta[0].toFixed(4)} vs 期望 ${e00.toFixed(4)}`);
}
}

// ── ③ 连接性: 从记录部件数据复算几何 (枝接干/冠裹枝/条挂冠) ──
section('③ 连接性 (旧病: 枝不接干/冠不裹枝/条不挂冠) —— 探针侧手算四元数复算');
{
G('JSON.stringify(WLS.map(r=>({x:r.x,z:r.z,g0:r.g0,wt:r.wt,wb:r.wb,wl:r.wl})))');
const data=JSON.parse(G('JSON.stringify(WLS.map(r=>({x:r.x,z:r.z,g0:r.g0,wt:r.wt,wb:r.wb,wl:r.wl})))'));
// 手算四元数旋转 v'=q·v·q* (与 05b _wqRotV 同式)
function qrot(q,vx,vy,vz){
	const x=q[0],y=q[1],z=q[2],w=q[3];
	const tx=2*(y*vz-z*vy), ty=2*(z*vx-x*vz), tz=2*(x*vy-y*vx);
	return [vx+w*tx+(y*tz-z*ty), vy+w*ty+(z*tx-x*tz), vz+w*tz+(x*ty-y*tx)];
}
let badBranch=0,badCrownH=0,badCrownY=0,badTopY=0,badTopH=0,badBot=0,badStrandCrown=0;
let maxBranchD=0,maxStrandH=0,maxCrownGap=0;
for(const r of data){
	// 干顶: 实例中心 (x,g0+1.4,z) + R(tilt)·(0,1.4,0), tilt 从 wt 四元数反解
	const tilt=2*Math.atan2(r.wt.q[2],r.wt.q[3]);
	const Tx=r.x-Math.sin(tilt)*1.4, Ty=r.g0+1.4+Math.cos(tilt)*1.4, Tz=r.z;
	for(const b of r.wb){
		const cx=r.x+b.ox, cy=r.g0+b.oy, cz=r.z+b.oz;             // 枝盒中心
		const h=qrot(b.q,0,0.7,0);                                 // 盒半高矢量 (枝向)
		const d=Math.hypot(cx-h[0]-Tx, cy-h[1]-Ty, cz-h[2]-Tz);    // 枝根到干顶距离
		if(d>0.35) badBranch++;
		if(d>maxBranchD) maxBranchD=d;
	}
	const crowns=r.wl.slice(0,7), strands=r.wl.slice(7);
	for(const c of crowns){
		if(Math.hypot(c.ox,c.oz)>1.0) badCrownH++;
		if(c.oy<2.95||c.oy>4.05) badCrownY++;
	}
	for(const s of strands){
		const L=s.sy;
		const up=qrot(s.q,0,L/2,0);
		const topX=s.ox+up[0], topY=s.oy+up[1], topZ=s.oz+up[2];   // 条顶 (相对 g0)
		const botY=s.oy-up[1];                                     // 条底
		if(topY<3.2||topY>4.0) badTopY++;
		const th=Math.hypot(topX,topZ);
		if(th>1.45) badTopH++;
		if(th>maxStrandH) maxStrandH=th;
		if(botY<0.25) badBot++;
		let best=1e9;
		for(const c of crowns){
			const d=Math.hypot(topX-c.ox, topY-c.oy, topZ-c.oz);
			if(d<best) best=d;
		}
		if(best>1.35) badStrandCrown++;
		if(best>maxCrownGap) maxCrownGap=best;
	}
}
assert('③-1 主枝根全部钉在干顶 (≤0.35m)',badBranch===0,`max=${maxBranchD.toFixed(3)}m`);
assert('③-2 冠片全部在冠幅内 (水平≤1.0, 高度 2.95~4.05)',badCrownH===0&&badCrownY===0);
assert('③-3 垂条顶锚进冠带 (y 3.2~4.0, 水平≤1.45)',badTopY===0&&badTopH===0,`maxH=${maxStrandH.toFixed(3)}m`);
assert('③-4 垂条下摆不落地 (底≥0.25m)',badBot===0);
assert('③-5 每根垂条顶 1.35m 内有冠片承接着 (条挂冠; golden 实测 max 1.26)',badStrandCrown===0,`maxGap=${maxCrownGap.toFixed(3)}m`);
}

// ── ④ 燃烧链: treeIgnite → 倒伏 → 焦黑 → 沉入 ────────────────
section('④ 燃烧链 (旧版完全没有): 点燃 → burnDur 烧倒 → 叶冠隐+干枝染炭 → 16~22s 后沉入');
G("globalThis.W1=WLS.find(r=>r.alive&&!r.fall&&r.burnT<0);");
if(G('!!W1')){
G("treeIgnite(W1,null);");
assert('④-1 treeIgnite 点燃 (burnT≥0, 入 BURNING_TREES, burnDur 6~8.5s 晴档)',
 G('W1.burnT>=0&&BURNING_TREES.includes(W1)&&W1.burnDur>3&&W1.burnDur<12')===true,`burnDur=${G('W1.burnDur')}`);
G("for(let i=0;i<400&&!(W1.charred&&!FALLING.includes(W1));i++){ try{ updateFallingTrees(0.1); updateBurningTrees(0.1); }catch(e){ break; } }");
assert('④-2 烧倒伏 (alive=false + fall 成立, 倒伏动画走 willowInstanceMatrices 分派)',
 G('W1.alive===false&&!!W1.fall')===true);
assert('④-3 烧尽焦黑 (charred=true + 19 叶实例零缩放 + 干/枝实例染炭色)',
 G('W1.charred===true')===true
 &&G("(function(){if(!WLOW_IM) return false; const a=WLOW_IM.leaves.instanceMatrix.array,o=W1.wi*19*16; for(let k=0;k<19;k++) for(let e=0;e<15;e++) if(a[o+k*16+e]!==0) return false; return true;})()")===true
 &&G('!!WLOW_IM&&WLOW_IM.trunks.instanceColor.array[W1.wi*3]<0.5&&WLOW_IM.branches.instanceColor.array[W1.wi*3]<0.5&&WLOW_IM.branches.instanceColor.array[W1.wi*3+2]<0.5')===true);
assert('④-4 残骸登记沉入 (sinkQ + TREE_SINKS 有账)',G('W1.sinkQ===true&&TREE_SINKS.some(s=>s.tr===W1)')===true);
G("globalThis._sy0=null,_sy1=null; for(let i=0;i<120;i++){ updateTreeSinks(0.5); const s=TREE_SINKS.find(q=>q.tr===W1); if(!s) break; if(s.t>=s.rest&&_sy0===null) _sy0=WLOW_IM.trunks.instanceMatrix.array[W1.wi*16+13]; if(s.t>=s.rest+1.8&&_sy1===null) _sy1=WLOW_IM.trunks.instanceMatrix.array[W1.wi*16+13]; } globalThis._dead1=W1.dead; globalThis._tzx=WLOW_IM?WLOW_IM.trunks.instanceMatrix.array[W1.wi*16]:null;");
assert('④-5 沉入全程 (干实例下沉增量 ≥1m + 全沉零缩放 + 记录标死出账)',
 G('_dead1===true&&!TREE_SINKS.some(s=>s.tr===W1)&&_sy0!==null&&_sy1!==null&&_sy0-_sy1>1.0&&_tzx===0')===true,
 `dy=${(G('_sy0')-G('_sy1')).toFixed(2)}m dead=${G('_dead1')} 零缩放=${G('_tzx')===0}`);
if(G('!!WLOW_IM&&!!W1')){
G("globalThis._sc2=(()=>{const f=(im)=>{const a=im.instanceMatrix.array;let bad=0;for(let i=0;i<a.length;i++)if(!Number.isFinite(a[i]))bad++;return bad;};return{t:f(WLOW_IM.trunks),b:f(WLOW_IM.branches),l:f(WLOW_IM.leaves)};})();");
assert('④-6 交互态矩阵全有限 (倒伏/焦黑/沉入全走 willowInstanceMatrices; 04b _wlQ 同病根回归钉)',
 G('_sc2.t===0&&_sc2.b===0&&_sc2.l===0')===true,`NaN=${G('_sc2.t+_sc2.b+_sc2.l')}`);
}
} else console.log('  [skip] W1 缺 (N1 阴性: 柳登记降级)');

// ── ⑤ 爆炸掀倒 ──────────────────────────────────────────────
section('⑤ 爆炸掀倒: explosionFlora 近距 → 向背离爆心倒 (旧版: 柳炸不倒)');
G("globalThis.W2=WLS.find(r=>r.alive&&!r.fall&&r.burnT<0&&r!==W1); globalThis._bp=W2?{x:W2.x+4,z:W2.z}:{x:0,z:0};");
if(G('!!W2')){
G("explosionFlora(_bp,8);");
assert('⑤-1 近距 (4m < 0.75R+0.9) 即刻掀倒 (fall 成立 + 未被炸没)',
 G('W2.alive===false&&!!W2.fall&&W2.dead===false')===true);
assert('⑤-2 倒向背离爆心 (dot(fall.dir, away)>0)',
 G('(!!W2.fall&&(W2.x-_bp.x)*W2.fall.dx+(W2.z-_bp.z)*W2.fall.dz>0)')===true);
assert('⑤-3 碰撞柱已杀 (killCyl)',G('!!W2.fall&&W2.cyl.r===0')===true);
G("for(let i=0;i<60&&!W2.sinkQ;i++){ try{ updateFallingTrees(0.1); }catch(e){ break; } }");
assert('⑤-4 倒完触地 → 残骸沉入账 (与乔木同一处停留/沉没口令)',
 G('W2.sinkQ===true&&TREE_SINKS.some(s=>s.tr===W2)')===true);
} else console.log('  [skip] W2 缺');

// ── ⑥ 坦克碾压 ──────────────────────────────────────────────
section('⑥ 坦克碾压: floraCrushTank 车体接触即撞倒 (旧版: 柳碾不倒)');
G("globalThis.W3=WLS.find(r=>r.alive&&!r.fall&&r.burnT<0&&r!==W1&&r!==W2&&Math.hypot(r.x-W2.x,r.z-W2.z)>12);");
if(G('!!W3')){
G("globalThis._tk={pos:{x:W3.x,y:0,z:W3.z-2},vel:3,yaw:0,playerDriven:false};");
G("floraCrushTank(_tk);");
assert('⑥-1 车体接触撞倒 (fall 成立 + 未被碾没)',G('W3.alive===false&&!!W3.fall&&W3.dead===false')===true);
assert('⑥-2 倒向车辆运动方向 (+z, yaw=0 前进)',G('!!W3.fall&&W3.fall.dz>0.7')===true);
assert('⑥-3 碰撞减速 (vel 3→×0.94)',G('_tk.vel<3&&_tk.vel>2.5')===true,G('String(_tk.vel)'));
G("for(let i=0;i<60&&!W3.sinkQ;i++){ try{ updateFallingTrees(0.1); }catch(e){ break; } }");
assert('⑥-4 残骸沉入账',G('W3.sinkQ===true')===true);
} else console.log('  [skip] W3 缺');

// ── ⑦ 地面火→燃料链: fuelAdd → igniteArea → updateFires → treeIgnitePass ──
section('⑦ 地面火链 (柳下格可燃的意义): 燃烧弹/沿岸火烧进柳下 → 0.4s 内树冠点燃');
G("globalThis.W4=WLS.find(r=>r.alive&&!r.fall&&r.burnT<0&&r!==W1&&r!==W2&&r!==W3&&Math.hypot(r.x-W1.x,r.z-W1.z)>12&&Math.hypot(r.x-W2.x,r.z-W2.z)>12&&Math.hypot(r.x-W3.x,r.z-W3.z)>12&&FUEL[fCellI(r.x,r.z)]>0.05&&FBURN[fCellI(r.x,r.z)]===0);");
if(G('!!W4')){
G("globalThis._c4=fCellI(W4.x,W4.z); globalThis._f4=FUEL[_c4]; igniteArea(W4.x,W4.z,2.2,null);");
assert('⑦-1 柳下格已充燃料且被点燃 (FUEL>0.05 + FIRE_ACTIVE)',G('_f4>0.05&&FBURN[_c4]>0&&FIRE_ACTIVE.includes(_c4)')===true,`fuel=${G('_f4')}`);
G("for(let i=0;i<6;i++) updateFires(0.15);");
assert('⑦-2 treeIgnitePass 认领 (0.4s 节拍内 burnT≥0)',G('W4.burnT>=0&&BURNING_TREES.includes(W4)')===true,`burnT=${G('W4.burnT')}`);
} else console.log('  [skip] W4 缺');

// ── ⑧ golden 流钉: 布局随机流不漂移 ─────────────────────────
section('⑧ golden 柳位序列 (改前采集, 种子 42/pseed 424242, 顺序对账)');
{
const GOLDEN=[[76,16],[-44,-52],[-163.7507249390992,-63.41811507553832],[-149.62980901585024,-61.210632510129855],[-152.26694297497824,-40.21172463110515],[-142.52528965913862,-59.4717232261214],[-145.05705018579494,-37.56625213384529],[-135.31608802071378,-59.14603210878507],[-137.85814463393035,-37.411180313663245],[-130.71803777721698,-36.83426597573673],[-121.31194746244375,-57.08051809927728],[-123.63024878938536,-34.8648952812095],[-116.59044788944112,-35.714902685064985],[-99.82140462471962,-55.01869291484648],[-102.56384773720208,-34.19693669589114],[-92.7113438344856,-54.569489125718974],[-85.84828308831476,-54.32008942932795],[-88.32793207246435,-31.263144273382515],[-81.987270625231,-52.33046662489673],[-67.7102461813026,-56.57536098932034],[-56.06247217389937,-34.82734916378402],[-31.246185528581314,-61.90460738450381],[-26.873037477159276,-40.77343863486745],[9.715709584078672,-65.11666964808929],[23.841122246551215,-61.83685905557614],[57.05468686548603,-29.102029191951026],[62.83411189639168,-26.770647703638787],[76.88100808221343,-45.666926309845685],[83.52424591708429,-41.14748624434117],[76.74866146403156,-20.788276322943958],[81.28758011219253,-19.93277717665419],[88.4020152425505,-22.873010747627447],[99.9012684974936,-44.100902839810196],[107.00713697217427,-47.03200729536583],[109.6412546931515,-25.331724116759375],[113.97676660861656,-47.062337958207664],[116.65584467210738,-24.481024290660862],[121.10583500561525,-49.25958885327178],[123.89679338407909,-27.420172995080478],[128.15731519007016,-47.48981059406523],[135.25719131086944,-49.74648337519049],[137.78464519674267,-27.449403514058954],[144.90940225900565,-29.561277574263087],[149.42934115920016,-50.01049264232091],[152.0024949789736,-29.8362160447899],[156.78154223688992,-52.128537774847835],[166.16811973056912,-30.174468587291415],[-109.06672887261035,45.91643101455604],[-79.37808550338514,50.99819163390444],[-70.61379238040799,62.1762125085733],[-69.4422714309167,63.74074506434889],[-29.295765362868284,57.86984664704917],[9.129763355137495,64.6404641681173],[18.732603665333823,65.56004033716454],[21.032740957454234,66.84704271463889],[31.68181499887353,62.695799302106536],[-99.05445572249256,-82.90128438085655],[-91.16853217003072,-72.13683211150592],[-79.11808186823535,-78.18024577318981],[-70.78694393321867,-66.92492737765018],[-58.83886162757514,-74.07859968899636],[-48.948060566593014,-72.07961224214318],[-51.78823257181707,-72.11922246139089],[-31.905913088697755,-80.40330460577034],[-12.163568717145155,-88.7380270840443],[1.195351256206106,-87.33717429060172],[29.08379008697348,-68.89775532745784],[38.94713502048729,-66.62132758519425],[41.47597017709566,-68.6210926416381],[68.69452106131216,-85.18102032897862],[-68.77809917179162,0.10592671664260367],[66.26034563091692,40.80604762624641],[78.36786245711616,32.45749473617481],[71.34859833220199,19.42572181430471],[83.97343315672286,11.309539591680824],[85.63043290560094,9.76487872879605],[85.26595631781505,0.288532298260778],[74.29372754773101,-27.714508913197996],[85.45205280956537,-54.388304608717775]];
const now=JSON.parse(G('JSON.stringify(WLS.map(r=>[r.x,r.z]))'));
// 拒绝采样 (propFree/freeSpot) 在消耗 wr 之前 early-return ⇒ 接受位必为调用序的保序子列。
// 钉子列而非等长逐位: PROPS/cover 有 Math.random 泄漏 (已知仓库缺陷), 拒哪几棵可跨轮波动,
// 但"每个接受位都逐位等于顺序里下一个 golden 调用位"对任何拒绝组合都成立 —— 这才是流不漂的判据。
let gi=0, mismatch=-1;
for(let i=0;i<now.length;i++){
 while(gi<GOLDEN.length&&(Math.abs(GOLDEN[gi][0]-now[i][0])>1e-9||Math.abs(GOLDEN[gi][1]-now[i][1])>1e-9)) gi++;
 if(gi>=GOLDEN.length){ mismatch=i; break; }
 gi++;
}
const rejected=GOLDEN.length-now.length;
assert('⑧-1 接受柳位 = golden 调用序的保序子列 (wr 流 135 次/棵 顺序未漂; 拒绝数 ≤9)',
 mismatch===-1&&gi===GOLDEN.length&&rejected>=0&&rejected<=9&&now.length>=70,
 mismatch>=0?`#${mismatch} [${now[mismatch]}] 不在 golden 序列中`:`接受 ${now.length} / 拒绝 ${rejected}`);
}

// ── ⑨ 汇总 ──
section('⑨ 汇总');
console.log(`  ${NEG?'NEG':'正向'} ${OK.length} 绿 / ${BAD.length} 红`);
if(BAD.length){ console.log('  红名: '+BAD.join(' · ')); process.exit(1); }
console.log('  verify-willow-20261110 全绿');
