// ─────────────────────────────────────────────
// dev/verify-naval.js —— 海战系统 10 条验收红线 · 沙箱套件 (2026-09-20N 批, owner: verifier)
//
// 用法: node dev/verify-naval.js                 # 未落盘的被测对象按「⊘ 跳过」计, exit=0
//       node dev/verify-naval.js --require-all   # 「跳过」也算失败 (交付前终验必须用这个)
//
// 为什么独立: 实现者/验证者分离。本文件**不采信任何实现者自报数字** —— 全部判据在本进程里现算,
//   每条结论都带原始数字。本文件**只读** js/ 下的文件, 一行都不写 (写入域: dev/)。
//
// 沙箱边界 (诚实声明): 本套件走 dev/_bootstub.js 的 THREE/DOM 桩, 能验「逻辑与数值」,
//   **验不了**真 DOM/CSS/WebGL/性能 —— 那部分在 dev/probe-naval.js (真浏览器 + CDP) 里。
//   红线 1(启动链) 12 图部分、8(玩家链)、10(性能) 的最终判据在浏览器侧。
//
// 三条判据坑 (本仓库踩过, 本文件强制回避):
//   ① 祖先盲计数: getComputedStyle(el).display 只看元素自身, 祖先 display:none 时后代仍自报 block
//      ⇒ 判「真的渲染了吗」必须用 getClientRects() 非零面积 (dev/effective-visible.js 同源口径)。
//   ② window.player 陷阱: 游戏里的 player 是顶层 const, **词法绑定不会成为 window 属性**
//      ⇒ 用 window.player 判状态恒 false, 会把正确行为报成 FAIL。本文件一律用**裸引用**(词法作用域)。
//   ③ 404 文本滤不掉 favicon: console 里不带 URL 的 404 不是真失败 ⇒ 必须用 Network 域失败清单实证。
//
// 闸门口径: 每条红线的「被测对象是否落盘」由 probe() 现算 (不是实现者声明), 未落盘 ⇒ 跳过;
//   落盘后仍失败 ⇒ exit 1。闸门条件写在每条 redline 的 gate 里, 可核对、可复现。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
// 共享桩 (dev/_bootstub.js): THREE/DOM/WebAudio 最小桩, 与 verify-tankai/probe-bots 同源
const {sandbox,document,window}=require('./_bootstub.js');
const REPORT=path.join(root,'dev/out/naval-report.txt');
const REQUIRE_ALL=process.argv.includes('--require-all');

// ——— 桩能力补丁: 与 dev/verify-tankai.js 同一份补丁 (缺了就 UnsupportedOperation 假失败) ———
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
	get currentTime(){ return 0; }
	get sampleRate(){ return 44100; }
}
// _bootstub 的 InstancedMesh 缺 instanceMatrix.array —— 08-effects 的植被下沉 (queueSink) 会读
// `inst.instanceMatrix.array[i*16+13]`, 桩里是 undefined ⇒ 炮弹打着植被时探针会假崩。
// 这里在**桩**上补齐 (真浏览器里真 THREE 本来就有该字段), 不改 js/ 也不改共享桩文件。
const _IM=sandbox.THREE.InstancedMesh;
if(_IM){
	sandbox.THREE.InstancedMesh=class extends _IM{
		constructor(g,m,n){ super(g,m,n); this.instanceMatrix={array:new Float32Array((n||0)*16)}; this.instanceColor=null; }
	};
}
sandbox.AudioContext=ACStub; sandbox.window.AudioContext=ACStub; sandbox.window.webkitAudioContext=ACStub;
delete sandbox.window.CANNON;   // 12-ragdolls 见到 window.CANNON 会走物理分支并半道崩 (与 verify-tankai 同口径)

// ——— 战役/脚本链 ———
const CAMP_ISLAND=11;   // CAMPAIGNS 顺序: 0 normandy … 8 steppe, 9 woodline, 10 canyon, **11 island(塔拉瓦)**
const NAV_FILES=['js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js'];   // 与 index.html 同序
const NAVY_ON_DISK=NAV_FILES.filter(f=>fs.existsSync(path.join(root,f)));
const BASE_HEAD=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15g-capmodels.js','js/15h-capital.js','js/15c-specveh.js'];
const BASE_TAIL=['js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/23-deploy.js','js/24-main.js'];
const FILES=BASE_HEAD.concat(NAV_FILES.filter(f=>fs.existsSync(path.join(root,f))),BASE_TAIL);

// ——— VM 内测试台 (PRELUDE): 只能引用页面**词法作用域**里的名字, 不许用 window.xxx ———
const PRELUDE=`globalThis.__N=(function(){
const TAU=Math.PI*2;
// 词法作用域的 typeof: 顶层 const 不在 globalThis 上, 必须靠直接 eval 取词法绑定
function ty(expr){ try{ return eval('typeof '+expr); }catch(e){ return 'ERR:'+String(e&&e.message||e).slice(0,60); } }
function num(v,d){ return (typeof v==='number'&&isFinite(v))?+v.toFixed(4):d; }
// 被测对象清单 (闸门现算, 不采信实现者声明)
function probe(){
	return {
		NavalCraft:ty('NavalCraft'), navalCraft:ty('navalCraft'), updateNaval:ty('updateNaval'),
		navalNear:ty('navalNear'), navalHitCyl:ty('navalHitCyl'), navalCount:ty('navalCount'),
		shellHitNaval:ty('shellHitNaval'), torpedoHitTest:ty('torpedoHitTest'), torpedoes:ty('torpedoes'),
		Battery:ty('Battery'), BATTERIES:ty('BATTERIES'), buildBatteries:ty('buildBatteries'),
		updateBatteries:ty('updateBatteries'), batteryNear:ty('batteryNear'),
		navBuildModel:ty('navBuildModel'), boatAI:ty('boatAI'), amphAI:ty('amphAI'), batteryAI:ty('batteryAI'),
		updatePlayerNaval:ty('updatePlayerNaval'), NAVAL_SPEC:ty('NAVAL_SPEC'), NAVAL_CFG:ty('NAVAL_CFG'),
		tankWreck:ty('tankWreck'), planeWreck:ty('planeWreck'), landingCraft:ty('landingCraft'),
		waterDepthAt:ty('waterDepthAt'), waterYAt:ty('waterYAt'), shoreDist:ty('shoreDist'),
	};
}
// 世界/编制现状 (红线 1/2)
// ★ 名字不能叫 world: 05-world 有顶层 const world=new THREE.Group(), 而本 PRELUDE 的函数声明会在
//   闭包内**遮蔽**它 —— 第一版就叫 world, 于是 wreckMeasure 里的 world.children 拿到的是本函数,
//   tankWreck 的 world.add 结果一个都数不到 (全 0 的假失败)。同理本闭包内所有名字避开游戏全局名。
//   (注意: 本 PRELUDE 是模板字符串, 注释里不能出现反引号)
function worldSnap(){
	const t={},p={};
	try{ for(const x of tanks) t[x.team]=(t[x.team]||0)+1; }catch(e){}
	try{ for(const x of planes) p[x.team]=(p[x.team]||0)+1; }catch(e){}
	let nv=[];
	try{ for(const c of navalCraft) nv.push({key:c.spec&&c.spec.key,team:c.team,kind:c.kind,alive:!!c.alive,state:c.state}); }catch(e){}
	return {campaign:CAMPAIGN.id, tanks:t, planes:p, planeN:(function(){try{return planes.length;}catch(e){return -1;}})(),
		naval:nv, navalN:nv.length, atguns:(function(){try{return ATGUNS.length;}catch(e){return -1;}})(),
		batteries:(function(){try{return BATTERIES.length;}catch(e){return -1;}})()};
}
// 单艇快照 (JSON 安全; 判 NaN 也在这里落证据)
function snap(i){
	const c=navalCraft[i]; if(!c) return null;
	const bx=c.pos?[num(c.pos.x,NaN),num(c.pos.y,NaN),num(c.pos.z,NaN)]:[NaN,NaN,NaN];
	const fin=v=>Number.isFinite(v);
	return {i,key:(c.spec&&c.spec.key)||'?',team:c.team,kind:c.kind,
		x:bx[0],y:bx[1],z:bx[2],posFinite:fin(bx[0])&&fin(bx[1])&&fin(bx[2]),
		yaw:num(c.yaw,NaN),vel:num(c.vel,NaN),hp:num(c.hp,NaN),flood:num(c.flood,NaN),
		state:c.state,alive:!!c.alive,driver:!!c.driverBot,playerDriven:!!c.playerDriven,
		roll:(c.grp&&c.grp.rotation)?num(c.grp.rotation.z,NaN):NaN,
		pitch:(c.grp&&c.grp.rotation)?num(c.grp.rotation.x,NaN):NaN,
		grpY:(c.grp&&c.grp.position)?num(c.grp.position.y,NaN):NaN};
}
function snapAll(){ const o=[]; try{ for(let i=0;i<navalCraft.length;i++) o.push(snap(i)); }catch(e){} return o; }
// 生成一台受控载具 (探针自建, 不走 23-deploy 的编制路径 —— 编制核对另测)
function spawn(key,team,x,z,yaw,ord){
	const c=new NavalCraft(key,team,ord===undefined?0:ord);
	if(c.pos&&c.pos.set) c.pos.set(x,0,z);
	if(c.pos&&typeof c.pos.y!=='number') c.pos.y=0;
	if(typeof yaw==='number') c.yaw=yaw;
	if(c.vel!==undefined) c.vel=0;
	if(c.grp&&c.grp.position&&c.pos) c.grp.position.set(c.pos.x,c.pos.y||0,c.pos.z);
	return navalCraft.length-1;
}
// 输入表: step() 每帧对指定艇调 drive(fwd,turn,dt) —— 玩家/Bot 之外的**纯受控输入**
const inputs={};
function setInput(i,fwd,turn){ inputs[i]={fwd,turn}; }
function clearInput(i){ delete inputs[i]; }
// 只推进载具/炮位/炮弹/鱼雷, 不跑步兵 AI (受控实验纪律, 与 verify-tankai 同口径)
// quiet=true: 跳过 updateBatteries (纯物理红线 3/4/5 不要被岸炮的炮弹污染; 红线 6 再打开)
let quiet=false;
function setQuiet(v){ quiet=!!v; }
function clearShells(){ try{ shells.length=0; }catch(e){} try{ if(typeof torpedoes!=='undefined') torpedoes.length=0; }catch(e){} }
function step(frames,collect,dtFixed){
	for(let f=0;f<frames;f++){
		const dt=dtFixed||1/60;
		nowT+=dt;
		for(const k in inputs){ const c=navalCraft[k]; if(c&&typeof c.drive==='function') c.drive(inputs[k].fwd,inputs[k].turn,dt); }
		if(typeof updateNaval==='function') updateNaval(dt);
		if(!quiet&&typeof updateBatteries==='function') updateBatteries(dt);
		updateShells(dt);
		if(collect) collect(f);
	}
}
// 环境查询 (全部走单源 03-terrain 接口, 严禁另写算术)
function depth(x,z){ return waterDepthAt(x,z); }
function waterY(x,z){ return waterYAt(x,z); }
function shore(x,z){ try{ return shoreDist(x,z); }catch(e){ return NaN; } }
// 确定性地找一处指定水深的水点 (礁盘/冲滩带/深水), 用于红线 3/4 的可复现布点
// shoreMax 可选: 只要离岸距离 ≤ 该值的点 (冲滩带判定用; 剖面单源算出的 PT 浮起阈值 = 17.15m)
function findDepth(dmin,dmax,shoreMax,extra){
	let best=null;
	for(let x=-260;x<=260;x+=4)for(let z=-260;z<=260;z+=4){
		const d=waterDepthAt(x,z);
		if(!(d>=dmin&&d<=dmax)) continue;
		const s0=shoreDist(x,z);
		if(shoreMax!==undefined&&shoreMax!==null&&!(s0<=shoreMax)) continue;
		let ok=true;
		if(extra){ for(const k in extra){ if(!extra[k](x,z,d)){ ok=false; break; } } }
		if(!ok) continue;
		// 取离岛最近的一处 (最靠近岸线的可复现点), 同分取 x 最小 → 完全确定
		const score=[+s0.toFixed(3),x];
		if(!best||score[0]<best.score[0]||(score[0]===best.score[0]&&score[1]<best.score[1])) best={x,z,d:+d.toFixed(3),shore:+s0.toFixed(2),score};
	}
	return best;
}
// 朝向岛心 (陆地) 的航向 —— 四面环海图里"向陆"的确定方向 (岛心在 (0,0))
function yawToCenter(x,z){ return Math.atan2(-x,-z); }
function muster(t){ try{ const m=CAMPAIGN.sea.muster[t]; return {x:m.x,z:m.z,face:m.face}; }catch(e){ return null; } }
// 给受控载具配一名车组 Bot (红线 5 的"乘员落水"必须有人可落; 走 14-bots 的 spawnInVehicle 单源)
// ★ 必须自己持有引用: 15d 的 crewOut() 会把 this.crewBot 置 null (15d:511) ⇒ 事后从 craft 上取不到人。
//   另外 15d:519 的 this.crew.alive=false 打的是**占位 crew 对象**, 不是车组 Bot —— 第一版断言读错对象,
//   把"占位对象被杀"误报成"乘员没活着落水" (与 naval-crew 的线索一致)。
const crewRefs={};
function crew(i,name){
	try{
		const c=navalCraft[i]; if(!c) return {err:'无该载具'};
		const b=new Bot(c.team,0,name||'探针车组');
		if(typeof b.spawnInVehicle==='function') b.spawnInVehicle(c);
		b.alive=true; b.hp=100; b.pos.set(c.pos.x,c.pos.y||0,c.pos.z);
		if(!c.driverBot) c.driverBot=b;
		crewRefs[i]=b;
		return {ok:true,bot:b.name,onVehicle:b.onVehicle===c,crewBot:c.crewBot===b};
	}catch(e){ return {err:String(e&&e.message||e)}; }
}
// 车组心跳: 让乘员 Bot 走它自己的 update (游泳/朝岸游) —— 第一版不跑 Bot.update, 乘员就停在残骸正上方,
// 被沉没爆炸的溅射打死 (hp 100→-160), 那是**夹具不跑 AI** 造成的假失败, 不是沉没链的问题。
function crewTick(i,dt){
	try{ const b=crewRefs[i]; if(b&&typeof b.update==='function'&&b.alive!==false) b.update(dt||1/60); }catch(e){}
}
function crewState(i){
	try{
		const c=navalCraft[i];
		const ref=crewRefs[i];
		const b=ref||(c&&(c.crewBot||c.driverBot));
		if(!b&&!c) return null;
		return {src:(ref?'探针强引用(crewRefs[i])':(c.crewBot?'craft.crewBot':'craft.driverBot')),
			alive:b?!!b.alive:null,onVehicle:b?(b.onVehicle?true:false):null,swim:b?!!b.swim:null,   // 14-bots 的字段是 b.swim (不是 b.swimming) —— naval-hull 指出, 我第一版读错名恒 false
			posFinite:b?(Number.isFinite(b.pos.x)&&Number.isFinite(b.pos.y)&&Number.isFinite(b.pos.z)):null,y:b?+b.pos.y.toFixed(2):null,
			// Lead 要求的"同时打印两者": 占位记录 vs 真乘员
			placeholder_crew_alive:(c.crew&&'alive' in c.crew)?!!c.crew.alive:'(无 crew 占位对象)',
			placeholder_has_pos:!!(c.crew&&c.crew.pos),
			craft_crewBot_exists:!!c.crewBot,
			strongRef_exists:!!ref,
			strongRef_alive:ref?!!ref.alive:null,strongRef_hp:ref?(ref.hp===undefined?null:+ref.hp.toFixed(1)):null};
	}catch(e){ return {err:String(e&&e.message||e)}; }
}
// 红线 6 副判据: atGun 陆战零漂移 —— ATGUNS 表的结构签名 (位置/hp/朝向/类型)
function atgunSig(){
	try{
		const rows=ATGUNS.map(g=>[g.x,g.z,g.team===undefined?-1:g.team,(g.hp===undefined?-1:+g.hp),(g.alive?1:0),(g.yaw===undefined?-1:+g.yaw)].map(v=>typeof v==='number'?+v.toFixed(3):v));
		const s=JSON.stringify(rows);
		let h=5381; for(let i=0;i<s.length;i++) h=((h*33)^s.charCodeAt(i))>>>0;
		return {n:ATGUNS.length,hash:h.toString(16),sample:rows.slice(0,3)};
	}catch(e){ return {err:String(e&&e.message||e)}; }
}
// 红线 9: 残骸观感的**可量化**签名 (网格数/材质分件数/颜色集合/包围盒近似)
function grpSig(grp){
	let meshes=0,mats=new Set(),cols=new Set(),tris=0,pts=[];
	if(!grp||!grp.traverse) return {meshes:0,mats:0,cols:0};
	grp.traverse(o=>{
		if(o&&o.material){ meshes++;
			const ms=Array.isArray(o.material)?o.material:[o.material];
			for(const m of ms){ mats.add(m); if(m&&m.color&&m.color.v!==undefined) cols.add(m.color.v); else if(m&&m.color&&m.color.getHexString) cols.add(m.color.getHexString()); }
		}
		if(o&&o.geometry&&o.geometry.parameters){ const p=o.geometry.parameters; tris+=(p.width||0)*(p.height||0)*(p.depth||1)>0?1:0; }
		if(o&&o.position) pts.push([o.position.x||0,o.position.y||0,o.position.z||0]);
	});
	// 近似包围盒 (只按子节点 position 的跨度 —— 桩几何没有真实顶点, 这里只作**相对**比较, 不作绝对尺寸断言)
	let bx=[1e9,-1e9],by=[1e9,-1e9],bz=[1e9,-1e9];
	for(const p of pts){ bx[0]=Math.min(bx[0],p[0]);bx[1]=Math.max(bx[1],p[0]);by[0]=Math.min(by[0],p[1]);by[1]=Math.max(by[1],p[1]);bz[0]=Math.min(bz[0],p[2]);bz[1]=Math.max(bz[1],p[2]); }
	return {meshes,mats:mats.size,cols:cols.size,
		span:[+(bx[1]-bx[0]).toFixed(2),+(by[1]-by[0]).toFixed(2),+(bz[1]-bz[0]).toFixed(2)]};
}
// 空地搜索 (残骸落位需要 propFree+freeSpot; 每件用**各自独立**空地, 否则第二件被 propTake 挡住直接 return undefined)
function findFree(r,used){
	for(let x=-240;x<=240;x+=8)for(let z=-240;z<=240;z+=8){
		try{
			if(!propFree(x,z,r)||!freeSpot(x,z,r)) continue;
			let bad=false; for(const u of used) if(Math.hypot(x-u.x,z-u.z)<9) bad=true;
			if(!bad) return {x,z};
		}catch(e){}
	}
	return null;
}
// 6 个坦克残骸变体 = FACTIONS 里 6 个不同车型定义 (第 4 参两种传法都收, 见 05b wkTankDef)
function wreckVariants(){
	try{
		const out=[];
		for(const k of Object.keys(FACTIONS)){
			const T=(FACTIONS[k]&&FACTIONS[k].tanks)||[];
			for(let i=0;i<T.length&&out.length<6;i++) out.push({label:k+'.tanks['+i+']',def:T[i]});
		}
		return out;
	}catch(e){ return []; }
}
// AI 调用计数器 (Lead 2026-09-20 要求): 证明夹具**真的调到了 boatAI/amphAI**, 而不是只推了物理。
// boatAI/amphAI 是 14-bots 的函数声明 (全局属性) ⇒ 可在 VM 内整体换名包装, 不改游戏文件。
const aiCalls={boat:0,amph:0,wrapped:null};
function wrapAI(){
	try{
		if(typeof boatAI==='function'&&!boatAI.__sfWrapped){ const _b=boatAI; const w=function(c,dt){ aiCalls.boat++; return _b(c,dt); }; w.__sfWrapped=1; boatAI=w; }
		if(typeof amphAI==='function'&&!amphAI.__sfWrapped){ const _a=amphAI; const w=function(c,dt){ aiCalls.amph++; return _a(c,dt); }; w.__sfWrapped=1; amphAI=w; }
		aiCalls.wrapped=(typeof boatAI==='function'&&!!boatAI.__sfWrapped)+'/'+(typeof amphAI==='function'&&!!amphAI.__sfWrapped);
	}catch(e){ aiCalls.wrapped='ERR:'+e.message; }
	return aiCalls;
}
// 红线 7: AI 进近试验 (艇/两栖车) —— 受控单台载具 + 真 AI 入口 (NavalCraft.update → boatAI/amphAI)
//   · 试验期间关岸炮 (红线 6 的被测对象): 4 门炮射程 420m 覆盖全图, 否则试验艇会被西南岬炮位打沉 ——
//     这也正是 naval-ai 自检里"远湾用例 31~60s 波动"的非确定性来源; 本函数把它隔离掉, 单独量 AI 导航能力。
//   · 采样: 每秒一行 (t, 离岸距离, state, vel); 报 tReach = 首次离岸 ≤45m (礁盘外缘) 的秒数。
function aiTrial(kind,from,seconds){
	const key=kind==='boat'?'pt':'lvt';
	setQuiet(true); clearShells(); wrapAI();
	// 隔离: 把场上其余海战载具的 AI 关掉 (否则 10 台载具一起跑 AI, 会占航道/滩头并干扰试验艇)
	let parked=0;
	try{ for(const c of navalCraft){ if(c){ c.aiDrive=false; if(typeof c.vel==='number') c.vel=0; parked++; } } }catch(e){}
	const ai0={boat:aiCalls.boat,amph:aiCalls.amph};
	const i=spawn(key,0,from.x,from.z,yawToCenter(from.x,from.z));
	const c=navalCraft[i];
	const cr=crew(i,'AI探针');
	c.aiDrive=true; if('playerDriven' in c) c.playerDriven=false;
	let fired=0; const om=c.fireMain;
	if(typeof om==='function') c.fireMain=function(){ fired++; return om.apply(this,arguments); };
	let minShore=1e9,tReach=null,groundFrames=0,nanFrames=0;
	const t0=nowT, total=Math.round(seconds*60), samples=[];
	let f=0;                       // ★ 必须在 try 外声明: catch 里要报"第几帧抛的" (写进 for 头会掉出作用域)
	try{
	for(f=0;f<total;f++){
		step(1);
		const s=snap(i); if(!s) break;
		const sh=shoreDist(s.x,s.z);
		if(!s.posFinite) nanFrames++;
		if(s.state==='ground') groundFrames++;
		if(sh<minShore) minShore=sh;
		if(tReach===null&&sh<=45) tReach=+(nowT-t0).toFixed(1);
		if(f%60===0) samples.push([+(nowT-t0).toFixed(0),+sh.toFixed(1),s.state,+s.vel.toFixed(1)]);
	}
	}catch(e){
		// 游戏代码在试验中抛错: 记下**第几帧**与原始信息, 让红线 7 能指名道姓地报, 而不是整条崩掉
		if(typeof om==='function') c.fireMain=om;
		return {key,start:[+from.x.toFixed(1),+from.z.toFixed(1)],__err:String(e&&e.message||e),errAtFrame:f,
			framesDone:f,total,aiCalls:{boat:aiCalls.boat-ai0.boat,amph:aiCalls.amph-ai0.amph},
			minShore:+minShore.toFixed(1),tReach,groundFrames,nanFrames,fired,samples};
	}
	const s=snap(i);
	if(typeof om==='function') c.fireMain=om;
	// AI 内部状态 (14-bots 的 _navState WeakMap): 用于诊断"为什么没上岸/没开火", 不改游戏代码
	let ai=null;
	try{
		const st=(typeof _navState!=='undefined'&&_navState&&_navState.get)?_navState.get(c):null;
		if(st) ai={route:(st.route||[]).map(p=>[+p.x.toFixed(1),+p.z.toFixed(1),+shoreDist(p.x,p.z).toFixed(1),+waterDepthAt(p.x,p.z).toFixed(2)]),routeI:st.routeI,mode:st.mode,lane:st.lane,laneT:st.laneT&&+st.laneT.toFixed(1),wp:st.wp,ang:st.ang&&+st.ang.toFixed(2),
			runT:st.runT&&+st.runT.toFixed(1),groundT:st.groundT&&+st.groundT.toFixed(1),fireT:st.fireT&&+st.fireT.toFixed(1),
			land:!!st.land,keys:Object.keys(st).length};
	}catch(e){ ai={err:String(e&&e.message||e)}; }
	return {key,start:[+from.x.toFixed(1),+from.z.toFixed(1)],crew:cr,minShore:+minShore.toFixed(1),tReach,
		groundFrames,nanFrames,fired,aiCalls:{boat:aiCalls.boat-ai0.boat,amph:aiCalls.amph-ai0.amph},finalShore:s?+shoreDist(s.x,s.z).toFixed(1):null,
		finalDepth:s?+waterDepthAt(s.x,s.z).toFixed(2):null,finalState:s?s.state:null,samples,ai};
}
// 远湾布点: 集结点关于岛心的对侧深水点 (供压力用例)
function farBay(team){
	try{
		const m=muster(team); if(!m) return null;
		const cand=[[-m.x,-m.z],[m.x,-m.z],[-m.x,m.z]];
		for(const p of cand){ const d=waterDepthAt(p[0],p[1]); if(d>=3.4) return {x:p[0],z:p[1],depth:+d.toFixed(2)}; }
		return findDepth(3.4,8,undefined);
	}catch(e){ return null; }
}
// 注意: tankWreck/planeWreck/landingCraft **不返回 group**, 而是 world.add(grp) (既有调用点口径不动)
//   ⇒ 必须从 world.children 里取"本次新增的那一个" (第一版直接拿返回值 ⇒ 全 0 的假失败)。
function lastWorldChild(before){ try{ const c=world.children; return (c&&c.length>before)?c[c.length-1]:null; }catch(e){ return null; } }
function wreckMeasure(){
	try{
		const used=[]; const out={tank:[],plane:null,lc:null,variants:wreckVariants().length};
		out.dbg={worldType:typeof world, worldChildren:(()=>{ try{ return world.children.length; }catch(e){ return 'ERR:'+e.message; } })(),
			propFreeFn:typeof propFree, freeSpotFn:typeof freeSpot, tankWreckArity:(typeof tankWreck==='function'?tankWreck.length:-1)};
		for(const v of wreckVariants()){
			const s=findFree(3.4,used); if(!s){ out.tank.push({label:v.label,err:'找不到空地'}); continue; }
			used.push(s);
			const before=(()=>{ try{ return world.children.length; }catch(e){ return -1; } })();
			let callErr=null;
			try{ tankWreck(s.x,s.z,0,v.def); }catch(e){ callErr=String(e&&e.message||e); }
			const after=(()=>{ try{ return world.children.length; }catch(e){ return -1; } })();
			const g=lastWorldChild(before);
			out.tank.push(Object.assign({label:v.label,spot:[s.x,s.z],added:after-before,callErr,wkRole:g&&g.wkRole||null},grpSig(g)));
		}
		const ps=findFree(4.5,used);
		if(ps){ used.push(ps); const b1=(world.children||[]).length; planeWreck(ps.x,ps.z,0); out.plane=Object.assign({spot:[ps.x,ps.z]},grpSig(lastWorldChild(b1))); }
		const ls=findFree(6.0,used);
		if(ls){ const b2=(world.children||[]).length; landingCraft(ls.x,ls.z,0); out.lc=Object.assign({spot:[ls.x,ls.z]},grpSig(lastWorldChild(b2))); }
		return out;
	}catch(e){ return {err:String(e&&e.message||e)}; }
}
// 红线 6/落位: 反舰炮位的**布局事实** (不采信 15f 自报; 全部现算)
//   · onLand = waterDepthAt<=0; shore = 离岸距离; seaDot = 炮口朝向 · 所属岸线向海法线 (seaCoastLines 的 ox/oz)
//   · dupCyl/dupReg = 该炮位在 CYLS/BUILD_REG 里的注册条数 (>1 ⇒ buildBatteries 被跑了两次 / 索引重复注册)
function batterySig(){
	try{
		const cs=(typeof seaCoastLines==='function')?seaCoastLines():[];
		const segN=(px,pz,ax,az,bx,bz)=>{ const abx=bx-ax,abz=bz-az; const L=abx*abx+abz*abz||1;
			const t=Math.max(0,Math.min(1,((px-ax)*abx+(pz-az)*abz)/L));
			const qx=ax+abx*t,qz=az+abz*t;
			return {d:Math.hypot(px-qx,pz-qz),nx:-abz/Math.sqrt(L),nz:abx/Math.sqrt(L)}; };
		const rows=BATTERIES.map(b=>{
			const d=waterDepthAt(b.x,b.z), s=shoreDist(b.x,b.z);
			// 岬角是两支岸线的交点 ⇒ 用**最近线段的外法线**(不是岸线的轴对齐法线) 判向海, 取各支中的最大值;
			// 同时报出所有候选 (避免拿"选错岸线"当 FAIL —— 本判据第一版就差点这样误报 NW 岬)
			const fx=Math.sin(b.face||0), fz=Math.cos(b.face||0);
			const cands=[];
			for(const c of cs){
				let best=null; const P=c.pts;
				for(let i=0;i<P.length-1;i++){ const q=segN(b.x,b.z,P[i][0],P[i][1],P[i+1][0],P[i+1][1]); if(!best||q.d<best.d) best=q; }
				if(!best||best.d>40) continue;
				// 线段外法线两个候选里, 取与岸线表向海方向 (ox,oz) 同向的那个
				let nx=best.nx,nz=best.nz;
				if(nx*c.ox+nz*c.oz<0){ nx=-nx; nz=-nz; }
				const dot=fx*nx+fz*nz;
				cands.push({key:c.key,d:+best.d.toFixed(1),dot:+dot.toFixed(3),deg:+(Math.acos(Math.max(-1,Math.min(1,dot)))*180/Math.PI).toFixed(1)});
			}
			cands.sort((a,b2)=>b2.dot-a.dot);
			const win=cands[0]||null;
			let dupCyl=0,dupReg=0;
			for(const c of CYLS) if(Math.hypot(c.x-b.x,c.z-b.z)<0.4) dupCyl++;
			for(const g of BUILD_REG) if(g.type==='battery'&&Math.hypot(g.x-b.x,g.z-b.z)<0.4) dupReg++;
			// ★ 几何硬判据 (Lead 2026-09-20 建议, 取代"点积比法线" —— 点积的参照系本身是盲区:
			//   SW/SE 是尖角沙嘴, 单支法线点积天然只有 0.05/0.41, 上一版据此误报过 NW=0.468):
			//   沿 face 前进 30m 必须**落海** (depth>0); 前进 80m 必须**通航深水** (depth≥3.4, 环岛通航环带下限)
			const p30={x:b.x+fx*30,z:b.z+fz*30}, p80={x:b.x+fx*80,z:b.z+fz*80};
			const d30=waterDepthAt(p30.x,p30.z), d80=waterDepthAt(p80.x,p80.z);
			return {key:b.key,x:+b.x.toFixed(2),z:+b.z.toFixed(2),face:+(b.face||0).toFixed(3),
				depth:+d.toFixed(3),shore:+s.toFixed(2),onLand:d<=0,
				d30:+d30.toFixed(3),d80:+d80.toFixed(3),p30:[+p30.x.toFixed(1),+p30.z.toFixed(1)],p80:[+p80.x.toFixed(1),+p80.z.toFixed(1)],
				seaDot:win?win.dot:null,seaDeg:win?win.deg:null,coastKey:win?win.key:null,cands,
				alive:!!b.alive,hp:b.hp===undefined?-1:b.hp,dupCyl,dupReg};
		});
		return {n:BATTERIES.length, rows};
	}catch(e){ return {err:String(e&&e.message||e)}; }
}
return {probe,worldSnap,snap,snapAll,spawn,setInput,clearInput,step,depth,waterY,shore,findDepth,yawToCenter,muster,crew,crewState,crewTick,atgunSig,batterySig,grpSig,wreckMeasure,wreckVariants,aiTrial,farBay,
	setQuiet,clearShells,ty,now:()=>nowT};
})();`;

// ── 沙箱启动 ──
let BOOT=null;
// ★ 布局确定性 (两道): 05-world 的 WORLD_SEED 只覆盖 wr()/wri(); 而 findClearSpot/rand() 走 **Math.random**
//   ⇒ 只钉 seed 不够, ATGUNS 位置仍每次不同 (本判据第一版据此误报过"海战文件让 atGun 漂移" —— 实为随机噪声)。
//   这里把沙箱的 Math.random 换成可复现 PRNG, 让"A/B 对照"真正可比。真浏览器侧不受影响 (本函数只在沙箱)。
const SEED=42;
function mulberry32(a){ return function(){ a|=0; a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }
function filesFor(withNaval){
	if(Array.isArray(withNaval)) return BASE_HEAD.concat(withNaval.filter(f=>fs.existsSync(path.join(root,f))),BASE_TAIL);
	return BASE_HEAD.concat(withNaval?NAV_FILES.filter(f=>fs.existsSync(path.join(root,f))):[],BASE_TAIL);
}
function boot(withNaval){
	const list=(withNaval===undefined)?FILES:filesFor(withNaval);
	const ctx=vm.createContext(Object.assign({},sandbox));
	ctx.document=document; ctx.window=window; ctx.globalThis=ctx;
	ctx.location={search:'?seed='+SEED,href:'http://localhost/index.html?seed='+SEED,hostname:'localhost',protocol:'http:'};
	ctx.Math=Object.assign(Object.create(Math),{random:mulberry32(SEED)});   // 可复现 PRNG (见上)
	ctx.localStorage={_s:{sf_campaign:String(CAMP_ISLAND)},getItem(k){ return this._s[k]??null; },setItem(k,v){ this._s[k]=String(v); },removeItem(k){ delete this._s[k]; }};
	ctx.console={log:(...a)=>{ const s=a.map(x=>String(x)).join(' '); if(!/^\[(地形|HUD|NAV|世界|海战)/.test(s)) console.log(...a); },warn:console.warn.bind(console),error:console.error.bind(console)};
	const loaded=[]; const loadErrors=[];
	for(const f of list){
		try{ vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f}); loaded.push(f); }
		catch(e){ loadErrors.push({file:f,err:String(e&&e.stack||e).split('\n').slice(0,3).join(' | ')}); }
	}
	// 单个文件语法错**不中断**整条链: 继续加载其余文件, 让本套件一次跑出"哪些红线还能验"。
	// 红线 1 会把 loadErrors 全部报出来 (启动链要求零错误), 其余红线的闸门按符号存在性现算。
	let start=null;
	try{
		start=vm.runInContext(`(()=>{ try{ const b=document.getElementById('startBtn'); if(b&&b.onclick){ b.onclick(); return 'ok'; } return 'no-button'; }catch(e){ return 'ERR '+String(e&&e.stack||e); } })()`,ctx);
		vm.runInContext(PRELUDE,ctx);
	}catch(e){ return {ctx,loaded,loadErrors,preludeErr:String(e&&e.stack||e).split('\n').slice(0,3).join(' | '),start}; }
	return {ctx,loaded,loadErrors,preludeErr:null,start};
}
function N(code){ return vm.runInContext(code,BOOT.ctx); }   // 裸 eval: 需要 __N.xxx 前缀 (见 PRELUDE)
// 游戏代码在探针里抛错时, 让"这一条红线 FAIL 并带上原始错误", 而不是把整份套件打断 (避免假阴: 一个异常吞掉后面 7 条)
function NT(code){ try{ return N(code); }catch(e){ return {__err:String(e&&e.message||e)}; } }

// ── 报告 ──
const OUT=[];
let nPass=0,nFail=0,nSkip=0;
const say=s=>{ OUT.push(s); console.log(s); };
function red(n,name,state,detail){ say('  '+(state==='pass'?'✓':state==='fail'?'✗':'⊘')+' 红线'+n+' '+name+(detail?'   '+detail:'')); }
function pass(n,name,d){ nPass++; red(n,name,'pass',d); }
function fail(n,name,d){ nFail++; red(n,name,'fail',d); }
function skip(n,name,d){ nSkip++; red(n,name,'skip',d); }

// 首次运行时把「零漂移基线」写进报告文件, 之后每次运行自动比对 (快照式回归)
const BASE_TAG='#NAVAL-SNAPSHOT ';
function readSnapshots(){
	const map={};
	try{ for(const l of fs.readFileSync(REPORT,'utf8').split(/\r?\n/)){ if(l.startsWith(BASE_TAG)){ const k=l.slice(BASE_TAG.length); const i=k.indexOf(' '); map[k.slice(0,i)]=k.slice(i+1); } } }catch(e){}
	return map;
}
const SNAP=readSnapshots();
const snapshotsOut=[];
function drift(key,cur){   // 返回 {first:bool, same:bool, old}
	snapshotsOut.push(BASE_TAG+key+' '+cur);
	if(!(key in SNAP)) return {first:true,same:true,old:null};
	return {first:false,same:SNAP[key]===cur,old:SNAP[key]};
}

BOOT=boot();
// ── --ab 诊断模式: 逐份隔离 15d/15e/15f 对 atGun 落位的影响 (红线 6c 的取证工具; 连跑两遍可判确定性) ──
if(process.argv.includes('--ab')){
	const V={none:[],only15d:['js/15d-naval.js'],only15e:['js/15e-navmodels.js'],only15f:['js/15f-battery.js'],all:NAV_FILES};
	for(const name of Object.keys(V)){
		BOOT=boot(V[name]);
		const s=(()=>{ try{ return N('__N.atgunSig()'); }catch(e){ return {err:String(e&&e.message||e)}; } })();
		console.log('  '+name.padEnd(8)+' ATGUNS n='+s.n+' hash='+s.hash+' sample0='+JSON.stringify(s.sample&&s.sample[0])
			+'  ATGUNS表长='+s.n+(s.err?'  ERR='+s.err:''));
	}
	console.log('  (同参数连跑两遍, hash 若相同 ⇒ 落位在 seed='+SEED+' 下确定; 不同 ⇒ 判据本身不可复现)');
	process.exit(0);
}
// ── --wreck 诊断模式: 直接打印残骸测量的原始 JSON (红线 9 的取证工具) ──
if(process.argv.includes('--wreck')){
	console.log(JSON.stringify(N('__N.wreckMeasure()'),null,1));
	process.exit(0);
}
// ── --ai 诊断模式: 单跑 AI 试验并打印原始 JSON (红线 7 的取证工具) ──
//   AI_KIND=amph|boat (缺省 amph) · AI_SECS=70 · AI_FROM=x,z 可覆盖起点 (对照"集结点 vs 进近点起测")
if(process.argv.includes('--ai')){
	const m=N('__N.muster(0)');
	const secs=+(process.env.AI_SECS||70);
	const kind=process.env.AI_KIND||'amph';
	const from=process.env.AI_FROM?(()=>{ const a=process.env.AI_FROM.split(',').map(Number); return {x:a[0],z:a[1]}; })():m;
	const r=N(`__N.aiTrial(${JSON.stringify(kind)},${JSON.stringify(from)},${secs})`);
	console.log('起点='+JSON.stringify(r.start)+'  终点离岸='+r.finalShore+'m 终水深='+r.finalDepth+' 终态='+r.finalState+' 开火='+r.fired+' 搁浅帧='+r.groundFrames+' NaN帧='+r.nanFrames+'  AI调用='+JSON.stringify(r.aiCalls));
	console.log('轨迹(t:离岸m:state:vel) 每 5s: '+r.samples.filter((_,i)=>i%5===0).map(s=>s[0]+':'+s[1]+':'+s[2]+':'+s[3]).join('  '));
	console.log('AI 内部: '+JSON.stringify(r.ai));
	process.exit(0);
}
say('== 海战系统验收 (dev/verify-naval.js) ==');
say('  战役: 塔拉瓦环礁 (index '+CAMP_ISLAND+')   脚本链 '+FILES.length+' 个文件 (成功加载 '+BOOT.loaded.length+')   海战文件落盘: '+(NAVY_ON_DISK.length?NAVY_ON_DISK.join(','):'（无）'));

const P=(()=>{ try{ return N('__N.probe()'); }catch(e){ return null; } })();
const W=(()=>{ try{ return N('__N.worldSnap()'); }catch(e){ return null; } })();

// ── 红线 1: 启动链 ──
{
	if(BOOT.loadErrors.length){
		const d=BOOT.loadErrors.slice(0,3).map(e=>e.file+' → '+e.err).join('  ||  ');
		// 海战文件还没落盘时的 LOAD 失败 = 预期中的过渡态 (人工标注); 文件已在盘上仍失败 = 真回归
		const allNavMissing=NAVY_ON_DISK.length===0;
		if(allNavMissing) skip(1,'启动链: 塔拉瓦 LOAD 不报错','（过渡态, 海战三文件未落盘; 但沙箱 LOAD 已报错: '+d+'）');
		else fail(1,'启动链: 塔拉瓦 LOAD 不报错',BOOT.loadErrors.length+' 个文件加载抛错: '+d);
	}else if(BOOT.preludeErr||!P){
		fail(1,'启动链: 塔拉瓦 LOAD 不报错','脚本链加载完但测试台/开局失败: '+(BOOT.preludeErr||'__N.probe() 不可用'));
	}else{
		const t=W.tanks,p=W.planes;
		const okStart=BOOT.start==='ok';
		const line='LOAD '+(okStart?'ok':'异常('+BOOT.start+')')+'  每队坦克='+(t[0]||0)+'/'+(t[1]||0)+'  全图飞机='+W.planeN+'  ATGUNS='+W.atguns+'  BATTERIES='+W.batteries;
		if(okStart) pass(1,'启动链: 塔拉瓦 LOAD 不报错',line+'   （其余 11 图零漂移由 verify-layouts 指纹表实证, 见 dev/_naval-baseline.txt; 真浏览器侧见 dev/probe-naval.js）');
		else fail(1,'启动链: 塔拉瓦 LOAD 不报错',line);
	}
}
// ── 红线 2: 编制 ──
{
	const g=W&&W.navalN>0&&P&&P.navalCraft==='object';
	if(!g) skip(2,'编制: 每队 2 坦克 + 2 两栖车 + 3 艇, 全图 1 机','（待 naval-hull/15d + naval-deploy/23-deploy 落盘）navalCraft='+(P?P.navalCraft:'?'));
	else{
		const cnt=(tm,k)=>W.naval.filter(c=>c.team===tm&&(!k||c.kind===k)).length;
		const line='坦克 '+(W.tanks[0]||0)+'/'+(W.tanks[1]||0)+'  两栖车 '+cnt(0,'amph')+'/'+cnt(1,'amph')+'  艇 '+cnt(0,'boat')+'/'+cnt(1,'boat')+'  飞机 '+W.planeN+'  海战实例合计 '+W.navalN;
		const ok=(W.tanks[0]===2&&W.tanks[1]===2&&cnt(0,'amph')===2&&cnt(1,'amph')===2&&cnt(0,'boat')===3&&cnt(1,'boat')===3&&W.planeN===1);
		ok?pass(2,'编制: 每队 2 坦克 + 2 两栖车 + 3 艇, 全图 1 机',line):fail(2,'编制: 每队 2 坦克 + 2 两栖车 + 3 艇, 全图 1 机',line);
	}
}
// ── 红线 3: 剖面分工 (PT 硬搁浅 / 两栖车转履带继续) ──
{
	const g=P&&P.NavalCraft!=='undefined'&&P.navalCraft==='object'&&P.updateNaval==='function';
	if(!g) skip(3,'剖面分工: d<17m 处 PT 速度归零, 两栖车转履带态继续前进','（待 15d-naval 落盘）');
	else{
		const r=NT(`(()=>{
			__N.setQuiet(true); __N.clearShells();   // 纯物理: 关岸炮/清在途弹, 免被污染
			// 布点口径 (Lead 离岸剖面实算, 单源 03-terrain): PT 吃水 0.95m ⇒ 浮起最小离岸距离 17.15m;
			// 两栖车 draft0 0.40 / wadeDepth 0.55 ⇒ 浮航切换 d≈9.9m。取冲滩带内 depth∈[0.15,0.50]
			// 且 shore≤17.15 的点: PT 必硬搁浅, 两栖车必在履带态 (depth<0.55)。
			const p=__N.findDepth(0.15,0.50,17.15);
			if(!p) return {err:'找不到冲滩带布点 (depth∈[0.15,0.50] 且 shore≤17.15)'};
			const i=__N.spawn('pt',0,p.x,p.z,0), j=__N.spawn('lvt',0,p.x+6,p.z+6,__N.yawToCenter(p.x,p.z));
			const a0=__N.snap(i),b0=__N.snap(j);
			__N.setInput(i,1,0); __N.setInput(j,1,0);
			__N.step(600);                       // 10s 满油门
			const a1=__N.snap(i),b1=__N.snap(j);
			__N.clearInput(i); __N.clearInput(j);
			const moved=Math.hypot(b1.x-b0.x,b1.z-b0.z);
			return {spot:p,pt:{state:a1.state,vel:a1.vel,moved:+Math.hypot(a1.x-a0.x,a1.z-a0.z).toFixed(3),finite:a1.posFinite},
				lvt:{state:b1.state,vel:b1.vel,moved:+moved.toFixed(3),finite:b1.posFinite}};
		})()`);
		if(r.__err||r.err) fail(3,'剖面分工',r.__err||r.err+'  (确定性布点失败=判据本身不可复现, 先修布点)');
		else{
			const ptOK=r.pt.state==='ground'&&r.pt.vel<0.05&&r.pt.moved<1.0, lvtOK=r.lvt.moved>2&&r.lvt.state!=='ground'&&r.lvt.state!=='sinking';
			const line='布点 depth='+r.spot.d+'m shore='+r.spot.shore+'m | PT state='+r.pt.state+' vel='+r.pt.vel+' 位移='+r.pt.moved+'m | LVT state='+r.lvt.state+' 位移='+r.lvt.moved+'m';
			(ptOK&&lvtOK&&r.pt.finite&&r.lvt.finite)?pass(3,'剖面分工: 冲滩带 PT 硬搁浅 / 两栖车转履带态继续前进',line)
				:fail(3,'剖面分工: 冲滩带 PT 硬搁浅 / 两栖车转履带态继续前进',line+'   判据: PT(ground且vel<0.05且位移<1m)='+ptOK+'  LVT(位移>2m且非ground)='+lvtOK);
		}
	}
}
// ── 红线 4: 四档物理 ──
{
	const g=P&&P.navalCraft==='object'&&P.navalCraft!=='undefined';
	if(!g) skip(4,'四档物理: 吃水随 flood 单调 / 横倾方向 / 浪涌同相 / 搁浅倒车脱困','（待 15d-naval 落盘）');
	else{
		const r=NT(`(()=>{
			__N.setQuiet(true); __N.clearShells();
			const p=__N.findDepth(3.4,7.0); if(!p) return {err:'找不到深水布点'};
			const a=__N.spawn('pt',0,p.x,p.z,0);
			// ① 吃水随 flood 单调: draft = draft0 + flood*0.5 ⇒ hullY 随 flood 单调下降
			const ys=[];
			for(const fl of [0,0.25,0.5,0.75,1.0]){ navalCraft[a].flood=fl; __N.step(1); __N.step(1); ys.push(+__N.snap(a).y.toFixed(4)); }
			navalCraft[a].flood=0;
			// ② 浪涌与浮标同相: 单源 = 00-config 的 seaWaveOffset(x,z,t) (05b BUOYS 与 15d 共读同一支)。
			//    两层判据: (a) navalWaveAt 与 seaWaveOffset 同参**逐位相同**;
			//              (b) 船体 y 的浪涌残差 [y-(waterY-draft)] 与波场**同相** (|Δφ|<0.5rad) 且振幅量级一致。
			//    第一版拿"假定公式"当基准且只采 2s ⇒ amp=0.092/Δφ=-2.3rad 的假信号 (短窗系统偏差), 已改: 静置 2s + 采 10s。
			__N.setInput(a,0,0); __N.step(120);
			let bitBad=0;
			for(let f=0;f<120;f++){ __N.step(1); const t=__N.now(); if(navalWaveAt(p.x,p.z,t)!==seaWaveOffset(p.x,p.z,t)) bitBad++; }
			const sm=[];
			for(let f=0;f<600;f++){
				__N.step(1); const t=__N.now(); const s=__N.snap(a);
				const resid=s.y-(waterYAt(s.x,s.z)-navalDraftOf(navalCraft[a]));
				sm.push([t,resid,seaWaveOffset(s.x,s.z,t)]);
			}
			const w=1.3;
			const fit=idx=>{ let re=0,im=0,mean=0; for(const q of sm) mean+=q[idx]; mean/=sm.length;
				for(const q of sm){ re+=(q[idx]-mean)*Math.cos(w*q[0]); im+=(q[idx]-mean)*Math.sin(w*q[0]); }
				return {amp:+(2*Math.hypot(re,im)/sm.length).toFixed(4), phi:Math.atan2(-im,re)}; };
			const fR=fit(1), fW=fit(2);
			let dphi=fR.phi-fW.phi; while(dphi>Math.PI) dphi-=2*Math.PI; while(dphi<-Math.PI) dphi+=2*Math.PI;
			const amp=fR.amp, ampField=fW.amp;
			// ③ 横倾方向与转向一致
			__N.setInput(a,1,1); __N.step(90); const rollR=__N.snap(a).roll;
			__N.setInput(a,1,-1); __N.step(90); const rollL=__N.snap(a).roll;
			__N.clearInput(a);
			// ④ 搁浅可倒车脱困: 冲滩带布点 → 满油门前进 3s 坐滩 → 倒车 8s, 看是否后退 (带速度/水深轨迹)
			const g=__N.findDepth(0.15,0.50,17.15);
			let back=null;
			if(g){
				const b=__N.spawn('pt',0,g.x,g.z,__N.yawToCenter(g.x,g.z));
				const d0=__N.depth(g.x,g.z);
				__N.setInput(b,1,0); __N.step(180); const g0=__N.snap(b);
				const d1=__N.depth(g0.x,g0.z);
				__N.setInput(b,-1,0);
				const vels=[];
				for(let f=0;f<480;f++){ __N.step(1); if(f%60===0) vels.push(__N.snap(b).vel); }
				const g1=__N.snap(b);
				__N.clearInput(b);
				back={state0:g0.state,state1:g1.state,vels,
					depthStart:+d0.toFixed(3),depthAfterFwd:+d1.toFixed(3),depthEnd:+__N.depth(g1.x,g1.z).toFixed(3),
					fwd:+Math.hypot(g0.x-g.x,g0.z-g.z).toFixed(3),dist:+Math.hypot(g1.x-g0.x,g1.z-g0.z).toFixed(3),finite:g1.posFinite};
			}
			return {draftYs:ys, bitBad, amp, ampField, dphi:+dphi.toFixed(3), rollRight:rollR, rollLeft:rollL, back};
		})()`);
		if(r.__err||r.err) fail(4,'四档物理',r.__err||r.err);
		else{
			const mono=r.draftYs && r.draftYs.every((v,i)=>i===0||v<=r.draftYs[i-1]+1e-6) && (r.draftYs[0]-r.draftYs[r.draftYs.length-1])>0.3;
			const rollOK=Number.isFinite(r.rollRight)&&Number.isFinite(r.rollLeft)&&r.rollRight*r.rollLeft<0&&Math.abs(r.rollRight)>0.005;
			const waveOK=r.bitBad===0&&Math.abs(r.dphi)<0.5&&r.ampField>0.12&&r.ampField<0.18
				&&r.amp>0.7*r.ampField&&r.amp<1.3*r.ampField;
			const backOK=r.back&&r.back.finite&&r.back.dist>0.5;
			const line='①吃水 y(flood 0→1)=['+r.draftYs.join(', ')+'] 单调降='+mono
				+' | ②浪涌: 单源逐位不同次数='+r.bitBad+'/120  残差 amp='+r.amp+'m vs 波场 amp='+r.ampField+'m  相位差='+r.dphi+'rad (期望 |Δ|<0.5)'
				+' | ③右转 roll='+r.rollRight+' 左转 roll='+r.rollLeft+' 反向='+rollOK
				+' | ④搁浅倒车 '+JSON.stringify(r.back)+' 脱困='+backOK;
			(mono&&rollOK&&waveOK&&backOK)?pass(4,'四档物理: 吃水/浪涌同相/横倾/搁浅倒车',line)
				:fail(4,'四档物理: 吃水/浪涌同相/横倾/搁浅倒车',line+'   判据: 吃水='+mono+' 横倾='+rollOK+' 浪涌='+waveOK+' 倒车='+backOK);
		}
	}
}
// ── 红线 5: 沉没链 ──
{
	const g=P&&P.NavalCraft!=='undefined'&&P.navalCraft==='object'&&P.updateNaval==='function';
	if(!g) skip(5,'沉没链: flood>1 → 倾斜 → 下沉 → 乘员落水 alive → 残骸入 wreck','（待 15d-naval 落盘）');
	else{
		const r=NT(`(()=>{
			__N.setQuiet(true); __N.clearShells();
			// ★ 隔离 (naval-hull 定案 + Lead 指派): 与 aiTrial 同款 —— 关掉场上其余载具的 AI, 清在途弹。
			//   否则开局 10 台 AI 船 + 红线3/4 留下的活载具会在 900 帧里互相开火, 流弹溅射打进判据:
			//   第一版实测乘员 hp 100 -> -160 (战斗死亡), 被误读成"沉没链杀乘员"。
			try{ for(const c of navalCraft){ if(c){ c.aiDrive=false; if(typeof c.vel==='number') c.vel=0; } } }catch(e){}
			const p=__N.findDepth(3.4,7.0); if(!p) return {err:'找不到深水布点'};
			const i=__N.spawn('pt',0,p.x,p.z,0);
			const cr=__N.crew(i,'落水探针');
			// 走**公开受击路径** takeDmg, 反复命中直到 flood>1 (PT floodK=0.0013 ⇒ 规格上一发 900 伤害应 +1.17;
			// 实测第一发只 +0.351 ⇒ 有 0.30× 的非反装甲减免, 故本判据按"打到 flood>1"为准, 减免系数另行报数)
			const hits=[]; const aliveTrace=[]; let dmgErr=null;
			for(let k=0;k<10&&navalCraft[i].alive&&navalCraft[i].flood<=1;k++){
				try{ navalCraft[i].takeDmg(900,null,false); }catch(e){ dmgErr=String(e&&e.message||e); break; }
				hits.push(+navalCraft[i].flood.toFixed(3));
				aliveTrace.push(__N.crewState(i)&&__N.crewState(i).strongRef_alive);   // 每发后: 强引用乘员还活着吗
			}
			const seen=[]; let ys=[]; let crewDiedAtFrame=null, crewHpTrace=[];
			for(let f=0;f<900;f++){
				__N.step(1); __N.crewTick(i,1/60); const s=__N.snap(i);
				if(!seen.length||seen[seen.length-1]!==s.state) seen.push(s.state);
				ys.push(s.y);
				const cs=__N.crewState(i);
				if(crewDiedAtFrame===null&&cs&&cs.strongRef_alive===false) crewDiedAtFrame=f;
				if(f%120===0) crewHpTrace.push([f,cs?cs.strongRef_alive:null,cs?cs.strongRef_hp:null,s.state]);
			}
			const s=__N.snap(i);
			return {dmgErr, hits, aliveTrace, crewAtSpawn:cr, flood:+s.flood.toFixed(3), states:seen, finalState:s.state, alive:s.alive,
				y0:+ys[0].toFixed(3), yEnd:+s.y.toFixed(3), finite:s.posFinite, sank:ys[ys.length-1]<ys[0], crewDiedAtFrame, crewHpTrace, crew:__N.crewState(i)};
		})()`);
		if(r.__err) fail(5,'沉没链',r.__err);
		else{
			const crewOK=r.crew&&r.crew.alive&&r.crew.posFinite&&(!r.crew.onVehicle);
			const ok=r.states.indexOf('sinking')>=0&&r.finalState==='wreck'&&r.sank&&r.finite&&!r.alive;
			const line='判据表达式: crewState(i) 优先读 __N.crewRefs[i] 强引用(见 PRELUDE crew/crewState)  受击 flood 逐发='+JSON.stringify(r.hits)+'  每发后强引用乘员存活='+JSON.stringify(r.aliveTrace)+' (规格 900×0.0013=1.17/发)  状态序列='+JSON.stringify(r.states)+'  终态='+r.finalState+'  alive='+r.alive
				+'  y '+r.y0+'→'+r.yEnd+'  下沉='+r.sank+'  pos 有限='+r.finite+'  乘员落水='+JSON.stringify(r.crew)+(r.dmgErr?'  takeDmg 抛错='+r.dmgErr:'');
			(ok&&crewOK)?pass(5,'沉没链: 受击 flood>1 → 倾斜 → 下沉 → 乘员落水 alive → 残骸 wreck',line)
				:fail(5,'沉没链: 受击 flood>1 → 倾斜 → 下沉 → 乘员落水 alive → 残骸 wreck',line+'   判据: 链条='+ok+' 乘员落水且 alive='+crewOK);
		}
	}
}
// ── 红线 6: 双向闭环 ──
{
	const gShip=BATTERY_GATE();
	if(!gShip) skip(6,'双向闭环: 炮位击沉载具 / 载具摧毁炮位 / atGun 零漂移','（待 15f-battery 落盘）');
	else{
		// ── 6c-1 落位事实 (Lead 2026-09-20 指派): 4 门炮位真的建成 / 在陆上 / 离岸≥8m / 朝向向海 / 索引不重复注册 ──
		const bs=N('__N.batterySig()');
		if(bs.__err||bs.err) fail(6,'双向闭环: 炮位落位事实',(bs.__err||bs.err));
		else{
			const bad=[];
			if(bs.n!==4) bad.push('BATTERIES.length='+bs.n+'≠4');
			for(const r of bs.rows){
				// shoreDist 符号约定 (03-terrain 单源): >0 = 向海离岸距离, <0 = 向陆(岸线内侧)距离。
				// 反舰炮位按设计**在陆上、沿岸线法线向陆偏移** ⇒ 期望 shoreDist ≤ -8 (向陆 ≥8m)
				if(!r.onLand) bad.push(r.key+' 不在陆上 (depth='+r.depth+')');
				if(!(r.shore<=-8)) bad.push(r.key+' 向陆距离='+r.shore+'m (期望 ≤-8m)');
				if(!(r.d30>0)) bad.push(r.key+' 沿 face 30m 未落海 (depth='+r.d30+' @'+JSON.stringify(r.p30)+')');
				if(!(r.d80>=3.4)) bad.push(r.key+' 沿 face 80m 非通航深水 (depth='+r.d80+' <3.4 @'+JSON.stringify(r.p80)+')');
				if(r.dupCyl!==1) bad.push(r.key+' CYLS 注册 '+r.dupCyl+' 次(应 1)');
				if(r.dupReg!==1) bad.push(r.key+' BUILD_REG 注册 '+r.dupReg+' 次(应 1)');
			}
			const line='BATTERIES='+bs.n+'  '+bs.rows.map(r=>r.key+' 向陆='+(-r.shore)+'m | 30m处水深='+r.d30+' | 80m处水深='+r.d80
				+' | (参考: 最近支='+r.coastKey+' 偏差='+r.seaDeg+'°) cyl×'+r.dupCyl+' reg×'+r.dupReg).join('  ‖  ');
			bad.length?fail(6,'双向闭环: 炮位落位事实 (4 门/陆上/向陆≥8m/30m落海/80m通航深水/索引不重复)',line+'   ✗ '+bad.join('; '))
				:pass(6,'双向闭环: 炮位落位事实 (4 门/陆上/向陆≥8m/30m落海/80m通航深水/索引不重复)',line);
		}
		// ── 6c-2 atGun 陆战零漂移 A/B: 同一代码状态下, 加载/不加载 15d/15e/15f 的 ATGUNS 签名必须一致 ──
		//    (为什么用 A/B 而不是历史快照: 本批 05b/14-bots/17-emplacements 等文件同时在改, 跨时间快照会把
		//     "别人改的"也算成"海战批的漂移"; A/B 只隔离三份新文件在**加载期**对 atGun 落位的影响)
		const sigA=N('__N.atgunSig()');
		const keep=BOOT;
		BOOT=boot(false);                       // 不加载 15d/15e/15f
		const sigB=(()=>{ try{ return N('__N.atgunSig()'); }catch(e){ return {err:String(e&&e.message||e)}; } })();
		BOOT=keep;
		const same=JSON.stringify(sigA)===JSON.stringify(sigB);
		const line='有海战文件 n='+sigA.n+' hash='+sigA.hash+' sample0='+JSON.stringify(sigA.sample&&sigA.sample[0])
			+'  |  无海战文件 n='+sigB.n+' hash='+sigB.hash+' sample0='+JSON.stringify(sigB.sample&&sigB.sample[0])+'  (种子 seed='+SEED+')';
		same?pass(6,'双向闭环: atGun 陆战零漂移 (A/B 同代码状态, 隔离 15d/15e/15f 加载期影响)',line)
			:fail(6,'双向闭环: atGun 陆战零漂移 (A/B)',line+'   ✗ 三份新文件在加载期改变了 atGun 落位');
		say('     · 6a/6b 端到端 (炮位击沉载具 / 艇炮摧毁炮位) 待 15f 的 E2E 导出落定后接上; 见 task-8 清单');
	}
}
// ── 红线 7: AI (艇 60s 内进近礁盘外 / 两栖车 Bot 上岸并开火) ──
{
	const g=P&&P.boatAI!=='undefined'&&P.amphAI!=='undefined'&&P.navalCraft==='object';
	if(!g) skip(7,'AI: 艇 60s 内进近礁盘外 / 两栖车 Bot 上岸并开火','（待 naval-ai/14-bots 落盘）boatAI='+(P?P.boatAI:'?')+' amphAI='+(P?P.amphAI:'?'));
	else{
		const m=N('__N.muster(0)');
		const near=NT(`__N.aiTrial('boat',${JSON.stringify(m)},60)`);
		// 远湾压力用例: 报**分布**, 不设阈值 (Lead 2026-09-20 裁定: 宁可不设阈值也不要假 PASS)
		const fb=N('__N.farBay(0)');
		const stress=[];
		if(fb) for(let k=0;k<3;k++) stress.push(NT(`__N.aiTrial('boat',${JSON.stringify(fb)},60)`));
		const amph=NT(`__N.aiTrial('amph',${JSON.stringify(m)},70)`);
		if(near.__err||amph.__err) fail(7,'AI: 艇进近 / 两栖车登陆','①就近湾='+(near.__err?('ERR@帧'+near.errAtFrame+'/'+near.total+' '+near.__err):'ok')+'  ‖ ③两栖车='+(amph.__err?('ERR@帧'+amph.errAtFrame+'/'+amph.total+' '+amph.__err):'ok')+'  ‖ ②远湾='+stress.map((r,k)=>r.__err?('#'+k+' ERR@'+r.errAtFrame+' '+r.__err):('#'+k+' ok')).join(' | '));
		else{
			const nearOK=near.tReach!==null&&near.tReach<=60&&near.nanFrames===0;
			const amphOK=amph.fired>=1&&amph.nanFrames===0&&(amph.finalShore<0||amph.finalDepth<0.55);
			const line='①就近湾(起点'+JSON.stringify(near.start)+'): tReach='+near.tReach+'s(判据≤60) minShore='+near.minShore+'m 搁浅帧='+near.groundFrames+' NaN帧='+near.nanFrames
				+' 每秒采样[t,离岸,state,vel]='+JSON.stringify(near.samples.slice(0,10))
				+'  ‖ ②远湾压力(3 次, 起点'+JSON.stringify(fb&&[fb.x,fb.z])+' 水深'+(fb&&fb.depth)+'m): '+stress.map(r=>r.__err?('ERR '+r.__err):('tReach='+r.tReach+'s/minShore='+r.minShore+'m/搁浅帧='+r.groundFrames)).join(' | ')
				+'  ‖ ③两栖车(70s): 上岸后主炮开火='+amph.fired+' 次 终态='+amph.finalState+' 终离岸='+amph.finalShore+'m 终水深='+amph.finalDepth+' 搁浅帧='+amph.groundFrames+' NaN帧='+amph.nanFrames;
			(!nearOK||!amphOK)?fail(7,'AI: 艇 60s 内进近礁盘外 / 两栖车 Bot 上岸并开火',line+'   判据: 就近湾='+nearOK+' 两栖车='+amphOK)
				:pass(7,'AI: 艇 60s 内进近礁盘外 / 两栖车 Bot 上岸并开火 (远湾压力用例只报分布, 不设阈值)',line);
		}
	}
}
// ── 红线 8: 玩家链 (真浏览器) ──
skip(8,'玩家链: 走近按 F 上艇 / 水上近距可上 / 驾驶开火下车全通','（真 DOM+输入链, 判据在 dev/probe-naval.js; 沙箱不设伪判据防假阳）');
// ── 红线 9: 残骸观感 ──
{
	// 落盘探测: 残骸重做会把签名改成 4 参 (wreck-art 实际命名 tkIn/plIn) —— 现读源码现算, 不采信声明。
	// 第一版正则写死了 `tk`/`pl` 形参名 ⇒ 实际落盘后仍判"未落盘"而一直跳过 (假阴), 已改为"4 个形参"泛匹配。
	let wreckRedone=false;
	try{
		const src=fs.readFileSync(path.join(root,'js/05b-props.js'),'utf8')+fs.readFileSync(path.join(root,'js/05a-buildings.js'),'utf8');
		const four=name=>new RegExp('function '+name+'\\([^)]*,[^)]*,[^)]*,[^)]*\\)').test(src);
		wreckRedone=four('tankWreck')&&four('planeWreck');
	}catch(e){}
	if(!wreckRedone) skip(9,'残骸观感: 三件模型网格/材质分件可量化 + 坦克残骸 6 车型可辨','（待 wreck-art 落盘: tankWreck/planeWreck 仍为 3 参）');
	else{
		const m=NT('__N.wreckMeasure()');
		if(m.__err||m.err) fail(9,'残骸观感: 三件模型可量化',m.__err||m.err);
		else{
			const rows=m.tank||[];
			const vec=r=>[r.meshes||0,r.mats||0,r.cols||0].concat(r.span||[0,0,0]);
			const uniq=new Set(rows.map(r=>JSON.stringify(vec(r)))).size;
			// 两两"签名间距": 归一化欧氏距离 (以各维最大值归一) —— 给出百分比间距而不是只有"是否相等"
			const maxd=[0,0,0,0,0,0];
			for(const r of rows){ const v=vec(r); for(let i=0;i<6;i++) maxd[i]=Math.max(maxd[i],Math.abs(v[i])); }
			let minD=1e9,minPair='';
			for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
				const a=vec(rows[i]),b=vec(rows[j]); let s=0;
				for(let k=0;k<6;k++){ const d=(a[k]-b[k])/(maxd[k]||1); s+=d*d; }
				const dist=Math.sqrt(s/6); if(dist<minD){ minD=dist; minPair=rows[i].label+'↔'+rows[j].label; }
			}
			const fmt1=r=>r?('网格='+r.meshes+' 材质分件='+r.mats+' 颜色='+r.cols+' 跨度='+JSON.stringify(r.span)):'(未测到)';
			const line='坦克残骸 6 变体: 签名去重='+uniq+'/'+rows.length+'  最小两两间距='+(100*minD).toFixed(1)+'% ('+minPair+')'
				+'  网格数=['+rows.map(r=>r.meshes).join(',')+']  材质分件=['+rows.map(r=>r.mats).join(',')+']  颜色=['+rows.map(r=>r.cols).join(',')+']'
				+'  | 飞机残骸: '+fmt1(m.plane)+'  | 登陆艇: '+fmt1(m.lc)
				+'  (口径: 桩档只量网格/材质/颜色/子节点跨度; 真 three 的 Box3 包围盒见 dev/_wreck-selfcheck.js REAL=1 档)';
			if(rows.length<6) fail(9,'残骸观感: 坦克残骸 6 车型可辨','只测到 '+rows.length+' 个变体: '+line);
			else if(uniq<6) fail(9,'残骸观感: 坦克残骸 6 车型可辨',line+'  （去重不足 ⇒ 有车型共用同一签名）');
			else pass(9,'残骸观感: 三件模型可量化 + 坦克残骸 6 车型两两可辨',line);
		}
	}
}
// ── 红线 10: 性能 (真浏览器) ──
skip(10,'性能: draw call 增幅 ≤ +35% / 帧率 ≥ 改造前 90%','（WebGL 实测, 判据在 dev/probe-naval.js）');

// ── 收尾 ──
say('');
say('合计: '+nPass+' 通过 / '+nFail+' 失败 / '+nSkip+' 跳过'+(REQUIRE_ALL?'   (--require-all: 跳过=失败)':''));
// 报告落盘 (含零漂移快照; 快照段只增不改, 供下次运行比对)
// 以 `#KEEP ` 开头的人工维护行 (FAIL→PASS 对照 / 证伪记录 / 性能基线等) 每次重写都会原样保留。
function readKeep(){
	try{ return fs.readFileSync(REPORT,'utf8').split(/\r?\n/).filter(l=>l.startsWith('#KEEP ')); }catch(e){ return []; }
}
try{
	fs.mkdirSync(path.dirname(REPORT),{recursive:true});
	const keep=readKeep();
	const head=['# 海战验收报告 (dev/verify-naval.js)  '+new Date().toISOString(),
		'# 复现: node dev/verify-naval.js'+(REQUIRE_ALL?' --require-all':''),
		'# 战役: 塔拉瓦环礁 (index '+CAMP_ISLAND+')  脚本链 '+FILES.length+' 文件  海战落盘: '+(NAVY_ON_DISK.join(',')||'（无）'),''];
	const tail=['','# ── 零漂移快照 (自动维护, 勿手改) ──'].concat(snapshotsOut);
	const keepSec=keep.length?['','# ── 人工维护段 (以 #KEEP 开头的行会被自动保留) ──'].concat(keep):[];
	fs.writeFileSync(REPORT,head.concat(OUT,keepSec,tail).join('\n')+'\n','utf8');
}catch(e){ console.error('报告落盘失败: '+e.message); }
process.exit((nFail||(REQUIRE_ALL&&nSkip))?1:0);

// 闸门: 反舰炮位体系是否落盘 (红线 6 的前置)
function BATTERY_GATE(){
	return !!(P&&P.BATTERY!=='undefined'&&P.buildBatteries==='function'&&P.updateBatteries==='function');
}
