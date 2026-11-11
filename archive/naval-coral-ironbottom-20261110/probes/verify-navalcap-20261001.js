// ──────────────────────────────────────────────────────────────────────────────
// dev/verify-navalcap-20261001.js —— 海战系统性大修批验收 (2026-10-01b)
//
// 用户报的 8 条系统性 BUG + 3 条期望, 逐条对应判据:
//   ① 旗帜/旗周物件漂移、出生在海上 → S2 甲板旗绑定与跟随 (含阴性对照: 不 tick 就不动)
//   ② 补给箱失效                     → S3 甲板弹药箱"网格与判据坐标同账"
//   ③ 甲板以上没有碰撞               → S4 甲板承载/护栏/局部绕行 (rigid 搬运 + rail 夹持)
//   ④ 船体移动上面的人不正常         → S4b capCarryDelta 刚体位移 + capRide 链
//   ⑤ 物件浮空 (天线/炮塔/护栏)      → S5 舰模锚定审计 (副炮/防空/主炮塔底面 ≤ 甲板面+ε)
//   ⑥ 船之间互相穿过                 → S6 capPushCap 分离 (含阴性对照)
//   ⑦ 两栖坦克/飞机太少/小船太多     → S7 编制表 (coral navalN [0,2] / airN [4,4])
//   ⑧ 起始界面不显示舰船             → S1 载入期生成 + 菜单巡航接线 (24-main 源锚)
//   期望A 分炮塔独立血量+可操控      → S8 血量路由/报废守卫/接管链 (含阴性对照)
//   期望B 瘫舰=灰色中立陆地          → S9 中立化/不可占/不可重生/基地回退/胜负判定豁免
//   期望C 航弹/鱼雷影响力            → S10 鱼雷→大舰接线 + 航弹甲板触发圈 + 飞机对舰目标
//
// 沙箱边界: 走 dev/_bootstub.js 桩, 验逻辑与数值; 渲染/手感交用户实机 (既定工作方式)。
// ──────────────────────────────────────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const {sandbox,document,window}=require('./_bootstub.js');
const OUTDIR=path.join(root,'dev/out');
try{ fs.mkdirSync(OUTDIR,{recursive:true}); }catch(e){}

// ── 桩能力补齐 (与 verify-seabatch 同源口径) ──
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
const _IM=sandbox.THREE.InstancedMesh;
if(_IM){
	const _arr=new Float32Array(16*64);
	sandbox.THREE.InstancedMesh=class extends _IM{ constructor(g,m,c){ super(g,m,c); this.instanceMatrix={array:_arr}; } };
}
delete sandbox.window.CANNON;

// ── FILES: 与 index.html 实载清单逐条一致 (探针载入盲区教训) ──
const FILES=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/15g-capmodels.js','js/15h-capital.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/19b-gamepad.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/22a-menuart.js','js/22b-speclayer.js','js/23-deploy.js','js/23b-worldrestore.js','js/24-main.js'];

const SEED=7;
function mulberry32(a){ return function(){ a|=0; a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }

function boot(campId){
	const ctx=vm.createContext(Object.assign({},sandbox));
	ctx.document=document; ctx.window=window; ctx.globalThis=ctx;
	ctx.location={search:'?seed='+SEED,href:'http://localhost/index.html?seed='+SEED,hostname:'localhost',protocol:'http:'};
	ctx.Math=Object.assign(Object.create(Math),{random:mulberry32(SEED)});
	ctx.localStorage={_s:{sf_campaign:String(campId)},getItem(k){ return this._s[k]??null; },setItem(k,v){ this._s[k]=String(v); },removeItem(k){ delete this._s[k]; }};
	ctx.console={log:(...a)=>{ const s=a.map(x=>String(x)).join(' '); if(!/^\[(地形|HUD|NAV|世界|海战|反舰|破坏)/.test(s)) console.log(...a); },warn:console.warn.bind(console),error:console.error.bind(console)};
	const loadErrors=[];
	for(const f of FILES){
		try{ vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f}); }
		catch(e){ loadErrors.push({file:f,err:String(e&&e.stack||e).split('\n').slice(0,3).join(' | ')}); }
	}
	// 进入战场 (startMatch) — 载入期大舰已在场, 这里验"复用不重建"
	let start=null;
	try{ start=vm.runInContext(`(()=>{ try{ const b=document.getElementById('startBtn'); if(b&&b.onclick){ b.onclick(); return 'ok'; } return 'no-button'; }catch(e){ return 'ERR '+String(e&&e.stack||e); } })()`,ctx); }
	catch(e){ return {ctx,loadErrors,startErr:String(e&&e.stack||e)}; }
	return {ctx,loadErrors,startErr:null,start};
}
function N(ctx,code){ return vm.runInContext(code,ctx); }
function NT(ctx,code){ try{ return N(ctx,code); }catch(e){ return {__err:String(e&&e.message||e)}; } }

// ── 报告 ──
const OUT=[];
let nPass=0,nFail=0;
function say(s){ OUT.push(s); console.log(s); }
function judge(ok,name,d){ if(ok){ nPass++; say('  ✓ '+name+(d?'\n      '+d:'')); } else { nFail++; say('  ✗ '+name+(d?'\n      '+d:'')); } }
function srcHas(file,needle,name){
	const s=fs.readFileSync(path.join(root,file),'utf8');
	// 判据卫生: 剥 // 行注释后再查 (断言不许被自己的注释绊倒)
	const body=s.split('\n').map(l=>l.replace(/\/\/.*$/,'')).join('\n');
	judge(body.includes(needle),name,'锚: '+file+' 含「'+needle.slice(0,60)+'」'+(body.includes(needle)?'':' (未命中)'));
}
srcHas('js/24-main.js','updateCapital(dt,dt)','S1 菜单巡航接线: 24-main 菜单分支调用 updateCapital');
srcHas('js/24-main.js','capitalSpawnOrbat()','S1 载入期生成: 24-main boot 段调用 capitalSpawnOrbat (capturePristineWorld 之前)');
srcHas('js/16-aircraft.js','capitalShips','S10c 飞机对舰目标: patrol 评分含 capitalShips');
srcHas('js/16-aircraft.js','tgt.spec.deckY+1.2','S10c 大舰俯冲瞄准点抬到甲板面 (2026-10-04 B14 判据随修复升级: 旧 deckY*0.6 在水线下)');
srcHas('js/13-combat.js','hitVehY','S10b 航弹甲板触发圈: nadeStep 的 hitVehY 回写');

say('== 海战系统性大修批 · 验收 (dev/verify-navalcap-20261001.js) — 战役=珊瑚海 coral ==');
say('');

const B=boot(12);   // coral (CAMPAIGNS[12], 9bbcae5 下架两图后 11 陆图 + P4 两张全海图)
if(B.loadErrors.length){
	judge(false,'启动链: coral 全脚本 LOAD 不报错',B.loadErrors.map(e=>e.file+' → '+e.err).join('  ||  ').slice(0,900));
	say('  启动链失败 ⇒ 提前结束');
	fs.writeFileSync(path.join(OUTDIR,'navalcap-report.txt'),OUT.join('\n'));
	process.exit(1);
}
judge(true,'启动链: coral 全脚本 LOAD 不报错','共 '+FILES.length+' 个脚本 (与 index.html 实载一致)');
const ctx=B.ctx;

const ID=N(ctx,`(()=>{ return {
	camp: CAMPAIGN.id,
	ships: (typeof capitalShips!=='undefined')?capitalShips.length:-1,
	flags: FLAGS.length,
	deckFlags: FLAGS.filter(f=>f.ship!==undefined).length,
	crates: (typeof AMMO_CRATES!=='undefined')?AMMO_CRATES.filter(c=>c.ship!==undefined).length:-1,
	nCap: (typeof capitalSpawnOrbat==='function')?1:0,
	capspec: (typeof CAPITAL_SPEC!=='undefined')?Object.keys(CAPITAL_SPEC):[]
}; })()`);
judge(ID.camp==='coral','boot 战役 = coral','实际: '+ID.camp);

// ═══ S1 载入期生成 + startMatch 复用不重建 ═══
judge(ID.ships===4,'S1a 载入期生成: 菜单期 capitalShips.length=4 (起始界面有船)','实际: '+ID.ships);
judge(ID.deckFlags===6,'S1b 甲板旗点 6 个 (每舰旗位带 ship 索引)','实际: '+ID.deckFlags);
{
	const r=NT(ctx,`(()=>{ return {ships:capitalShips.length, start:${JSON.stringify(B.start)}}; })()`);
	judge(r.ships===4,'S1c startMatch 后仍 4 艘 (capitalEnsureOrbat 复位复用, 不重建)','实际: '+r.ships+' · startBtn='+B.start);
}

// ═══ S2 旗点绑定/跟随 (①旗帜漂移) ═══
{
	const r=NT(ctx,`(function(){
		capitalFlagTick(1/60); const errs=[];   // ★2026-10-04 探针卫生: 沙箱无 RAF, startMatch 复位后旗坐标残位 (与 S2b 同惯例: 测前同帧 tick)
		for(const s of capitalShips){
			for(const f of s.deckFlags){
				// 绑定: 局部坐标必须落在该舰甲板矩形内 (不悬舷外 = "出生在海上"的否定)
				if(!capDeckIn(s,f._clx,f._clz)){ errs.push(s.name+' 旗 '+f.id+' 局部 ('+f._clx.toFixed(1)+','+f._clz.toFixed(1)+') 在甲板矩形外'); continue; }
				// 跟随: 旗世界坐标 = capToWorld(局部) 逐位一致
				const w=capToWorld(s,f._clx,f._clz,{x:0,z:0});
				if(Math.hypot(w.x-f.x,w.z-f.z)>0.02) errs.push(s.name+' 旗 '+f.id+' 跟随偏差 '+Math.hypot(w.x-f.x,w.z-f.z).toFixed(3));
				// 旗杆基高 = 甲板面 (不在海床/不在水里)
				const gy=s.pos.y+s.deck.y;
				if(Math.abs(f.gy-gy)>0.05) errs.push(s.name+' 旗 '+f.id+' 基高偏差 '+(f.gy-gy).toFixed(3));
			}
		}
		return {errs,n:capitalShips.reduce((a,s)=>a+s.deckFlags.length,0)};
	})()`);
	judge(!r.__err&&r.errs.length===0&&r.n===6,'S2a 旗点局部坐标全在甲板内 + 跟随/基高逐位一致','检查 '+r.n+' 面旗; '+(r.__err||r.errs.join('; ')||'全部一致'));
	// 阴性对照: 手工挪舰 → 不跑 capitalFlagTick 旗不动 (证明"跟随"是 tick 干的, 判据非空转); tick 后严格跟随
	const r2=NT(ctx,`(function(){
		const s=capitalShips[0], f=s.deckFlags[0]; if(!f) return {__err:'no deckFlag'};
		const fx0=f.x, fz0=f.z;
		s.pos.x+=25; s.pos.z+=-13; s.yaw+=0.2;                 // 手工挪舰 (绕过 updateCapital)
		const unmoved=(Math.hypot(f.x-fx0,f.z-fz0)<1e-6);      // 未 tick ⇒ 旗留在原地 (阴性)
		capitalFlagTick(1/60);
		const w=capToWorld(s,f._clx,f._clz,{x:0,z:0});
		const followed=(Math.hypot(w.x-f.x,w.z-f.z)<0.02);
		capitalReset();                                         // 复位回家 (后面判据用干净状态)
		capitalFlagBind();
		capitalFlagTick(1/60);                                  // 补给箱/旗坐标与复位后的舰同帧同账
		return {unmoved,followed};
	})()`);
	judge(!r2.__err&&r2.unmoved===true&&r2.followed===true,'S2b 阴性对照+跟随: 不 tick 旗不动 / tick 后严格跟舰',(r2.__err||('unmoved='+r2.unmoved+' followed='+r2.followed)));
}

// ═══ S3 补给箱坐标同账 (②船上补给箱失效) ═══
{
	const r=NT(ctx,`(function(){
		if(!capDeckProps.length) return {__err:'capDeckProps 空 (capDeckBind 未接)'};
		const errs=[];
		for(const c of capDeckProps){
			const s=capitalShips[c.ship];
			// 网格与判据坐标同账 (修前: 只搬 mesh, c.x/c.z 停在 t=0)
			if(Math.hypot(c.x-c.mesh.position.x,c.z-c.mesh.position.z)>0.02) errs.push('箱子判据坐标≠网格坐标 ('+(c.x-c.mesh.position.x).toFixed(2)+')');
			// 局部坐标回世界一致
			const w=capToWorld(s,c.lx,c.lz,{x:0,z:0});
			if(Math.hypot(w.x-c.x,w.z-c.z)>0.02) errs.push('箱子未随舰 ('+s.name+')');
			// 箱底 = 甲板面 (不悬空/不埋)
			if(Math.abs(c.y-(s.pos.y+s.deck.y))>0.05) errs.push('箱底高度≠甲板面');
		}
		return {errs,n:capDeckProps.length};
	})()`);
	judge(!r.__err&&r.errs.length===0&&r.n>0,'S3 甲板弹药箱: 判据坐标=网格坐标=舰体局部回算, 底面=甲板面',r.__err||(r.errs.join('; ')||('检查 '+r.n+' 箱')));
}

// ═══ S4/S4b 甲板承载/护栏/平台搬运 (③碰撞 ④移动陆地) ═══
{
	const r=NT(ctx,`(function(){
		const s=capitalShips[0];
		const d=s.deck; const lx=3, lz=10;
		const w=capToWorld(s,lx,lz,{x:0,z:0});
		const sh=capDeckShipAt(w.x,w.z,s.pos.y+d.y);
		if(!sh) return {__err:'capDeckShipAt 没认甲板内点'};
		// standHeight 挂钩: 甲板内点给甲板面
		const h=capDeckY(w.x,w.z,s.pos.y+d.y-0.2);
		if(Math.abs(h-(s.pos.y+d.y))>0.02) return {__err:'capDeckY 偏差 '+(h-(s.pos.y+d.y))};
	// 护栏: 把点推到甲板缘外 0.8m (在 capPushBody 的 -1.2 甲板层门内) → 应回夹到 railIn 内
	const outPt=capToWorld(s,d.hw+0.8,lz,{x:0,z:0});
	const pos=V3(outPt.x, s.pos.y+d.y, outPt.z);
	capPushBody(pos,0.35);
	capToLocal(s,pos.x,pos.z,_capL);
	const inside=Math.abs(_capL.x)<=capDeckHW(s,_capL.z)-CAPITAL_CFG.railIn+0.01;
	// 刚体搬运: capCarryDelta 把"上一帧位姿下的世界点"投回当前位姿 —— 与"同局部点在当前位姿的世界点"一致
	const lx2=3, lz2=10;
	s._px=s.pos.x-1.2; s._pz=s.pos.z; s._pyaw=s.yaw-0.05;   // 伪上一帧位姿 (向左 1.2m + 转过一点)
	const cp0=Math.cos(s._pyaw), sn0=Math.sin(s._pyaw);
	const pPrev={x:s._px+lx2*cp0+lz2*sn0, z:s._pz-lx2*sn0+lz2*cp0};   // 局部点在上一帧位姿下的世界坐标
	const carry=capCarryDelta(s,pPrev.x,pPrev.z,{x:0,z:0});
	const expect=capToWorld(s,lx2,lz2,{x:0,z:0});             // 同一局部点在当前位姿 = 搬运结果
	const carryOk=Math.hypot(carry.x-expect.x,carry.z-expect.z)<0.02;
	s._px=s.pos.x; s._pz=s.pos.z; s._pyaw=s.yaw;              // 还原
	return {inside,carryOk};
	})()`);
	judge(!r.__err&&r.inside===true&&r.carryOk===true,'S4 甲板站立+护栏夹持+capCarryDelta 刚体搬运',r.__err||('railInside='+r.inside+' carryOk='+r.carryOk));
	// ④b: capRide 链 — 挪舰后 updateCapital 一帧把甲板上的兵搬走
	const r2=NT(ctx,`(function(){
		const s=capitalShips[0];
		const w=capToWorld(s,2,4,{x:0,z:0});
		const fake={alive:true,pos:V3(w.x,s.pos.y+s.deck.y,w.z),isPlayer:false,onVehicle:null,vel:V3(),mesh:null};
		combatants.push(fake);
		const x0=fake.pos.x, z0=fake.pos.z;
		s.pos.x+=6; s.pos.z+=-2;                                 // 挪舰 (乘员收集用移动前位姿)
		updateCapital(1/60,1/60);
		combatants.splice(combatants.indexOf(fake),1);
		const moved=Math.hypot(fake.pos.x-x0,fake.pos.z-z0);
		// 搬运后应仍在甲板矩形内 (跟着船走了, 而不是留在原地掉海)
		capToLocal(s,fake.pos.x,fake.pos.z,_capL);
		const onDeck=capDeckIn(s,_capL.x,_capL.z);
		return {moved,onDeck};
	})()`);
	judge(!r2.__err&&r2.moved>3&&r2.onDeck===true,'S4b 乘员搬运: 挪舰一帧后甲板上的兵跟着走且仍在甲板内',(r2.__err||('moved='+r2.moved.toFixed(2)+' onDeck='+r2.onDeck)));
}

// ═══ S5 舰模锚定审计 (⑤天线/炮塔/护栏浮空) ═══
{
	const r=NT(ctx,`(function(){
		const errs=[];
		for(const s of capitalShips){
			const S=s.spec, deckTop=S.deckY+CAPITAL_CFG.deckLift;
	// 主炮塔: 塔体底面必须 ≤ 承托面 (1 号塔 = 叠置塔, 坐在下塔顶上; 0/2 号塔坐进甲板) —— 悬空即浮空
	s.turrets.forEach((t,i)=>{
		const bot=S.main.y[i]-Math.max(3.2,S.hullH*0.27);
		let support=deckTop;
		if(i>0&&S.main.y[i]>S.main.y[i-1]+1) support=S.main.y[i-1]+0.42;   // 叠置塔: 支承面 = 下塔顶 (roof 0.28+0.14)
		if(bot>support+0.02) errs.push(S.name+' 主塔'+i+' 底面 '+bot.toFixed(2)+' 悬在承托面 '+support.toFixed(2)+' 之上');
	});
	// 副炮/防空: 座圈底不得**悬**在甲板室顶/甲板面之上 (下沉几 cm 是"坐进结构里", 允许)
	const dh=(S.cls==='bb')?(S.deckY+S.hullH*0.19):S.deckY;
	for(const [arr,mounts] of [[s.R.secMounts,S.sec.mounts],[s.R.aaMounts,S.aa.mounts]]){
		mounts.forEach((md,i)=>{
			if(md.y>dh+0.02 && md.y>S.deckY+0.02)
				errs.push(S.name+' '+(arr===s.R.secMounts?'副炮':'防空')+i+' 高度 '+md.y+' 悬在甲板室顶 '+dh.toFixed(2)+' 之上');
		});
	}
			// 甲板铺面最小宽度: 艏艉收窄后仍与可行走半宽同表 (cpDeckHW 与铺面同表由 15g 保证, 这里验两者互差)
			for(const lz of [-S.deckHL,-S.deckHL*0.8,0,S.deckHL*0.8,S.deckHL]){
				const hwWalk=capDeckHW(s,lz);
				if(hwWalk>S.deckHW+0.01) errs.push(S.name+' capDeckHW('+lz.toFixed(0)+')='+hwWalk.toFixed(2)+' 超过甲板半宽');
			}
		}
		return {errs};
	})()`);
	judge(!r.__err&&r.errs.length===0,'S5 舰模锚定: 主炮塔/副炮/防空坐实甲板层, 无悬空件',r.__err||(r.errs.join('; ')||'4 舰全过'));
}

// ═══ S6 大舰互撞 (⑥船互相穿过) ═══
{
	const r=NT(ctx,`(function(){
		const a=capitalShips[0], b=capitalShips[1];
		const keep={ax:a.pos.x,az:a.pos.z,bx:b.pos.x,bz:b.pos.z};
		// 阴性对照: 摆好重叠但**不调** capPushCap → 仍重叠 (证明分离是它干的)
		b.pos.x=a.pos.x+8; b.pos.z=a.pos.z;                       // 舷侧重叠 (hullW 21 ⇒ 深度穿透 ~13m)
		capToLocal(a,b.pos.x,b.pos.z,_capL);
		const hw=a.spec.hullW*0.5+b.spec.hullW*0.5;
		const stillOverlapped=Math.abs(_capL.x)<hw;
		capPushCap();
		capToLocal(a,b.pos.x,b.pos.z,_capL);
		const ax=Math.abs(_capL.x)-hw, hl=a.spec.hullL*0.5+b.spec.hullL*0.5;
		const az=Math.abs(_capL.z)-hl;
		const separated=(ax>=0||az>=0);
		// 对半分: a 也挪了
		const aMoved=Math.abs(a.pos.x-keep.ax)+Math.abs(a.pos.z-keep.az)>0.001;
		a.pos.x=keep.ax; a.pos.z=keep.az; b.pos.x=keep.bx; b.pos.z=keep.bz;   // 还原
		return {stillOverlapped,separated,aMoved};
	})()`);
	judge(!r.__err&&r.stillOverlapped===true&&r.separated===true&&r.aMoved===true,'S6 capPushCap: 重叠检出/推开后分离/两舰各让一半',(r.__err||('overlap='+r.stillOverlapped+' sep='+r.separated+' aMoved='+r.aMoved)));
}

// ═══ S7 编制 (⑦两栖坦克/飞机太少/小船太多) ═══
{
	const r=NT(ctx,`(()=>{ return {
		navalN: CAMPAIGN.navalN, airN: CAMPAIGN.airN,
		amph: navalCraft.filter(c=>c.kind==='amph').length,
		boats: navalCraft.filter(c=>c.kind==='boat').length,
		planes: planes.length
	}; })()`);
	judge(r.navalN[0]===0,'S7a 纯海战无两栖车 (navalN[0]=0)','实际 navalN='+JSON.stringify(r.navalN));
	judge(r.navalN[1]<=2,'S7b 小艇编制 ≤2/队 (用户: 小船太多)','实际 navalN[1]='+r.navalN[1]);
	judge(r.airN[0]>=4&&r.airN[1]>=4,'S7c 舰载机 ≥4/队 (用户: 飞机太少)','实际 airN='+JSON.stringify(r.airN));
	judge(r.amph===0,'S7d 场上两栖车 = 0','实际: '+r.amph);
}

// ═══ S8 分炮塔血量 + 接管 (期望A) ═══
{
	const r=NT(ctx,`(function(){
		const s=capitalShips[0];                                   // bb_us
		const hp0=s.turHp[0], hull0=s.hp;
		// 阴性对照: 无 part 的命中不改炮塔血量 (只进舰体) — 证明路由按 part 走
		s.takeDmg(100,null,{tag:'hull'});
		const noRoute=(s.turHp[0]===hp0);
		s.hp=hull0;                                                // 还原
	// 正向: part 命中 → 炮塔掉血 (带 tur 装甲倍率 0.22) + 溢出伤进舰体 (turSpill=0.35)
	s.takeDmg(1000,null,{tag:'tur',part:'main',pi:0});
	const zone=s.spec.armor.tur;
	const routed=(s.turHp[0]===hp0-1000*zone);
	const spilled=Math.abs((hull0-s.hp)-1000*zone*CAPITAL_CFG.turSpill)<1;
	// 打空 → 报废: 开火守卫 + 冷却置满
	s.takeDmg(30000,null,{tag:'tur',part:'main',pi:0});
	const dead=(s.turHp[0]<=0);
	const noFire=s.fireMainSalvo(0,V3(s.pos.x+300,s.pos.y+20,s.pos.z+300))===false;
	const cdPinned=s.mainCd[0]>1e8;
	// 废塔后续命中按 hull 装甲区全额结算 (废塔不再是装甲: 倍率从 tur 0.22 换成 hull 0.40)
	const hull1=s.hp;
	s.takeDmg(500,null,{tag:'tur',part:'main',pi:0});
	const fullThrough=Math.abs((hull1-s.hp)-500*s.spec.armor.hull)<1;
		// 副炮报废守卫
		s.secHp[0]=0; s._partDead('sec',0,null);
		const secNoFire=s.fireSecondary(s.R.secMounts[0],V3(1,0,0),0)===false;
		// 复原 (后面判据用干净舰)
		capitalReset();
		return {noRoute,routed,spilled,dead,noFire,cdPinned,fullThrough,secNoFire,hp0};
	})()`);
	const ok=!r.__err&&r.noRoute===true&&r.routed===true&&r.spilled===true&&r.dead===true&&r.noFire===true&&r.cdPinned===true&&r.fullThrough===true&&r.secNoFire===true;
	judge(ok,'S8 炮塔血量: part 路由/溢出伤/报废守卫/废塔透传/副炮同律',(r.__err||JSON.stringify(r)));
	// 接管链: 靠近→capGunNear→mount→tick 瞄准→报废弹开
	const r2=NT(ctx,`(function(){
		const s=capitalShips[0];
		const md=s.R.secMounts[0];
		const w=s.mountLocalWorld(md,V3());
		player.pos.set(w.x+0.8,s.pos.y+md.y,w.z);                  // 站到副炮旁
		player.onCapital=s; player.alive=true; player.spectator=false;
		const g=capGunNear();
		if(!g||g.type!=='sec'||g.idx!==0) return {__err:'capGunNear 未识别副炮0: '+JSON.stringify(g)};
		const okM=capGunMount(g);
		if(!okM||!player.capitalGun) return {__err:'capGunMount 失败'};
		const pinned=Math.hypot(player.pos.x-w.x,player.pos.z-w.z)<1.6;
		// AI 不碰接管中的炮位: 转一个 fake 目标, step 后 aim 不被 AI 改写 (乘员没有 playerDriven)
		const y0=s.secAimY[0];
		player.yaw=s.yaw+1.1; player.pitch=0.1;                    // 玩家视角给一个明确方向
		mouseDown=false;
		capGunTick(1/60);
		const aimMoved=Math.abs(s.secAimY[0]-y0)>0.0001;           // 座圈朝视角转 = 接管在驱动
		// 报废弹开
		s.secHp[0]=0; s._partDead('sec',0,null);
		const ejected=(player.capitalGun===null);
		capitalReset();
		player.capitalGun=null;
		return {pinned,aimMoved,ejected};
	})()`);
	judge(!r2.__err&&r2.pinned===true&&r2.aimMoved===true&&r2.ejected===true,'S8b 接管链: F 上炮/站位钉炮位/视角驱动座圈/炮废就地弹人',(r2.__err||JSON.stringify(r2)));
}

// ═══ S9 瘫舰=灰色中立陆地 (期望B) ═══
{
	const r=NT(ctx,`(function(){
		const s=capitalShips[0];                                   // bb_us = 本队基地舰
		const f0=s.deckFlags[0];
		const beforeOwner=f0.owner;
		s.cripple(null);
		const st=(s.state==='crippled');
		const neutral=(f0.owner===-1&&f0.cap===0&&f0.capTeam===-1);
		const inactive=(capFlagActive(f0)===false);
		// 占领结算: 圈里放一名步兵, updateFlags 不得改 owner
		const w=capToWorld(s,f0._clx,f0._clz,{x:0,z:0});
		const fake={alive:true,team:1,pos:V3(w.x,s.pos.y+s.deck.y,w.z),onVehicle:null,isPlayer:false,spectator:false};
		combatants.push(fake);
		f0.cap=0.9; f0.capTeam=1;                                  // 强行给进度, 结算必须压回
		updateFlags(1/60);
		combatants.splice(combatants.indexOf(fake),1);
		const noCap=(f0.owner===-1&&f0.cap===0&&f0.capTeam===-1);
		// 胜负判定豁免: flagsLostOf 不把瘫旗算 lost
		const lost=FLAGS.filter(f=>!capFlagActive(f)).length;
		const lostOk=(flagsLostOf(0)<=6-lost&&flagsLostOf(1)<=6-lost);
		// 基地回退: 本队 (0) 基地舰瘫 ⇒ capBasePos 回退到还在 run 的 cv_us
		const bp=capBasePos(0);
		const fbOk=bp&&capitalShips.some(x=>x.cls==='cv'&&x.team===0&&x.state==='run'&&Math.hypot(bp.x-x.pos.x,bp.z-x.pos.z)<1);
		// 期望B 反面: 巡航舰的旗照常有效
		const s2=capitalShips[2];                                  // bb_jp (run)
		const active2=(s2.state==='run')&&capFlagActive(s2.deckFlags[0])===true;
		capitalReset();
		return {st,neutral,inactive,noCap,lost,lostOk,fbOk,active2,beforeOwner};
	})()`);
	const ok=!r.__err&&r.st&&r.neutral&&r.inactive&&r.noCap&&r.lostOk&&r.fbOk&&r.active2;
	judge(ok,'S9 瘫舰中立: 旗转灰/不可占/胜负豁免/基地回退/巡航舰不受累',(r.__err||JSON.stringify(r)));
}

// ═══ S10 鱼雷/航弹/飞机对舰 (期望C) ═══
{
	// 鱼雷: capitalTorpedoHit 直调 + updateTorpedoes 在途接线
	const r=NT(ctx,`(function(){
		const foe=capitalShips.find(x=>x.team===1);                // bb_jp
		const cap=capitalCapsule(foe);
		const hp0=foe.hp;
		const p=V3((cap.ax+cap.bx)/2, waterYAt(foe.pos.x,foe.pos.z)-2, (cap.az+cap.bz)/2);   // 舰体正中水线下
		const hit=capitalTorpedoHit(p,0,1800,null);
		const direct=(hit===foe&&foe.hp<hp0);
		// 在途接线: 一发真雷推进到命中 (vel 指向敌舰, 深度合规)
		foe.hp=foe.maxHp;
		const from=V3(foe.pos.x+60,0,foe.pos.z);
		torpedoes.push({pos:from,vel:V3(-30,0,0),team:0,dmg:1500,owner:null,life:9,trail:9,sndT:9});
		let consumed=false;
		for(let k=0;k<40;k++){ updateTorpedoes(1/60); if(torpedoes.length===0){ consumed=true; break; } }
		const wired=(consumed&&foe.hp<foe.maxHp);
		capitalReset();
		return {direct,wired};
	})()`);
	judge(!r.__err&&r.direct===true&&r.wired===true,'S10a 鱼雷→大舰: 直调命中 + 在途管线接线 (修"雷穿舰")',(r.__err||JSON.stringify(r)));
	// 飞机: 撞水线 + 对舰评分
	const r2=NT(ctx,`(()=>{
		const floor=planeFloorY(0,0);                              // opensea: 应 ≈ 水面 0, 不是海床 -26
		const hasFloor=(typeof planeFloorY==='function');
		return {hasFloor,floor};
	})()`);
	judge(r2.hasFloor&&r2.floor>-1&&r2.floor<1,'S10c 飞机地板=水面 (旧版海床-26 ⇒ 没有撞水线)','planeFloorY(0,0)='+r2.floor.toFixed(2));
	// 航弹甲板触发: nadeStep 难以独立调用 (整链状态), 用源码锚 + 结构判据
	srcHas('js/13-combat.js','capDeckOf(nx,nz)','S10b 航弹甲板触发: capDeckOf 接触判据在 nadeStep');
}

// ═══ S11 编制表数值锚 (防回归) ═══
{
	const r=NT(ctx,`(()=>{
		const S=CAPITAL_SPEC.bb_us, C=CAPITAL_SPEC.cv_us;
		return {
			mainTur: S.main.turHp, secTur: S.sec.turHp, aaTur: S.aa.turHp,
			cvSec: C.sec.turHp, spill: CAPITAL_CFG.turSpill, gunR: CAPITAL_CFG.gunR,
			slew: CAPITAL_CFG.gunSlew.main>0&&CAPITAL_CFG.gunSlew.aa>CAPITAL_CFG.gunSlew.main
		};
	})()`);
	judge(r.mainTur===2400&&r.secTur===320&&r.aaTur===200&&r.cvSec===320,'S11a CAPITAL_SPEC.turHp 全表落位',JSON.stringify(r));
	judge(r.spill===0.35&&r.gunR===3.4&&r.slew===true,'S11b CAPITAL_CFG 结算常量 (turSpill/gunR/gunSlew 档)',JSON.stringify(r));
}

// ═══ S12 炮位支撑足迹审计 (2026-10-01c 修"炮塔仍浮空") ═══
// S5 查的是"高度"; 本块查"高度 **且** 支撑足迹" —— 旧表 lz 25/27/−42 三处高度"对" (甲板室顶 15.0)
//   但 xz 越出甲板室端面 (z ∈ [−hullL·0.265, +hullL·0.158] = [−40.3, +24.0]) ⇒ 悬在主甲板上空 2.4m。
{
	const r=NT(ctx,`(function(){
		const errs=[];
		for(const key of ['bb_us','bb_jp','cv_us','cv_jp']){
			const S=CAPITAL_SPEC[key];
			const dhZ0=-S.hullL*0.265, dhZ1=S.hullL*0.158, dhHW=5.8;
			const dhTop=(S.cls==='bb')?(S.deckY+S.hullH*0.19):S.deckY;
			const mounts=[['副炮',S.sec.mounts],['防空',S.aa.mounts]];
			for(const [kind,arr] of mounts) arr.forEach((md,i)=>{
				const inDH=(S.cls==='bb')&&(Math.abs(md.lx)<=dhHW&&md.lz>=dhZ0&&md.lz<=dhZ1);
				const onDeck=(Math.abs(md.lx)<=S.deckHW-0.4&&Math.abs(md.lz)<=S.deckHL-0.4);
				if(!inDH&&!onDeck){ errs.push(key+' '+kind+i+' ('+md.lx+','+md.lz+') 不在任何支撑足迹内'); return; }
				const support=inDH?dhTop:S.deckY;
				if(md.y>support+0.05) errs.push(key+' '+kind+i+' y='+md.y+' 悬在支撑面 '+support.toFixed(2)+' 之上 (足迹外浮空)');
			});
			// 主炮塔底面坐实 (与 S5 同式, 双保险; 叠置塔的支撑面 = 下塔顶)
			if(S.main) S.main.y.forEach((gy,i)=>{
				const bot=gy-Math.max(3.2,S.hullH*0.27);
				let support=S.deckY+CAPITAL_CFG.deckLift;
				if(i>0&&S.main.y[i]>S.main.y[i-1]+1) support=S.main.y[i-1]+0.42;
				if(bot>support+0.02) errs.push(key+' 主塔'+i+' 底面 '+bot.toFixed(2)+' 悬在支撑面 '+support.toFixed(2)+' 之上');
			});
		}
		return errs;
	})()`);
	judge(!r.__err&&r.length===0,'S12 炮位支撑足迹: 全 4 舰型副炮/防空/主炮塔都坐在真实结构上',r.__err||r.join('; ')||'旧表 lz 25/27/−42 的浮空坐标已收回甲板室足迹');
}

// ═══ S13 甲板炮手 (2026-10-01c"炮塔内部也没有 Bot") ═══
{
	const r=NT(ctx,`(function(){
		capitalReset();
		const s=capitalShips.find(x=>x.spec.cls==='bb');
		const crewAll=capitalShips.reduce((a,x)=>a+(x.crewBots?x.crewBots.length:0),0);
		const b=s.crewBots[0];
		const inSoldiers=(typeof soldiers!=='undefined')&&soldiers.includes(b);
		const parented=b.mesh.root.parent===s.grp;
		// 世界坐标随舰: 挪舰 30m 后 capCrewTick 一帧, crew 世界位跟进
		const x0=b.pos.x; s.pos.x+=30; capCrewTick(s,1/60);
		const follows=Math.abs(b.pos.x-(x0+30))<0.6;
		s.pos.x-=30; capCrewTick(s,1/60);
		// 炮位报废 ⇒ 该炮位炮手阵亡
		const g=s.crewBots.find(x=>x.capCrew.type==='sec'&&x.capCrew.idx===0);
		s._partDead('sec',0,null);
		const crewDied=(g&&!g.alive);
		// 复位 ⇒ 炮手换新 (全活)
		capitalReset();
		const s2=capitalShips.find(x=>x.spec.cls==='bb');
		const g2=s2.crewBots.find(x=>x.capCrew.type==='sec'&&x.capCrew.idx===0);
		const respawned=(g2&&g2.alive);
		return {perShip:s.crewBots.length,crewAll,inSoldiers,parented,follows,crewDied,respawned,exp:s.spec.main.n+s.spec.sec.n+Math.ceil(s.spec.aa.n/3)};
	})()`);
	judge(!r.__err&&r.perShip===r.exp,'S13a 炮手编制 = 主炮塔数+副炮座数+⌈防空/3⌉',(r.__err||('bb: '+r.perShip+'/'+r.exp+' · 全场 '+r.crewAll)));
	judge(!r.__err&&r.inSoldiers&&r.parented&&r.follows,'S13b 炮手在 soldiers 表 (可被命中) + 网格挂舰体 + 世界坐标随舰',r.__err||JSON.stringify({inSoldiers:r.inSoldiers,parented:r.parented,follows:r.follows}));
	judge(!r.__err&&r.crewDied&&r.respawned,'S13c 炮位报废 ⇒ 炮手阵亡; 复位 ⇒ 炮手换新',r.__err||JSON.stringify({crewDied:r.crewDied,respawned:r.respawned}));
}

// ═══ S14 接管链位置化 (2026-10-01c 修"炮塔无法被玩家接管") ═══
// 旧口径: F 分支挂在 player.onCapital 座位字段上 —— 部署直落甲板的玩家该字段为空 ⇒ F 无效。
{
	const r=NT(ctx,`(function(){
		capitalReset();
		const s=capitalShips.find(x=>x.spec.cls==='bb');
		const md=s.spec.sec.mounts[0];
		// 舷侧走道: 甲板半宽 9.0, 甲板室半宽 5.8 ⇒ 站 x=±7.0 处距炮座 (4.8, lz) ≈ 2.2m < gunR 3.4
		const c=Math.cos(s.yaw),n=Math.sin(s.yaw);
		const lx=7.0,lz=md.lz;
		const w={x:s.pos.x+lx*c+lz*n, z:s.pos.z-lx*n+lz*c, y:s.pos.y+s.deck.y};
		player.alive=true; player.spectator=false; player.onCapital=null; player.capitalGun=null;
		player.onVehicle=null; player.onNaval=null; player.hp=100;
		player.pos.set(w.x,w.y,w.z);
		const near=capGunNear();                                   // onCapital 为空也必须能选到 (位置判据)
		const got=(near&&near.ship===s&&near.type==='sec'&&near.idx===0);
		let mounted=false;
		if(near) mounted=capGunMount(near);
		const seated=mounted&&player.capitalGun&&player.capitalGun.ship===s&&player.capitalGun.type==='sec';
		// 接管中该炮位炮手隐身 (capCrewTick 一帧 —— 实机由 updateCapital 每帧驱动)
		capCrewTick(s,1/60);
		const crew=s.crewBots.find(x=>x.capCrew.type==='sec'&&x.capCrew.idx===0);
		const crewHidden=crew?(crew.mesh.root.visible===false):null;
		capGunRelease();
		capCrewTick(s,1/60);
		const crewBack=crew?crew.mesh.root.visible===true:null;
		const gunCleared=player.capitalGun===null;
		return {got,seated,crewHidden,crewBack,gunCleared};
	})()`);
	judge(!r.__err&&r.got&&r.seated,'S14a onCapital=null (部署直落) 也能按 F 上炮: capGunNear 位置判据 + capGunMount 落座',r.__err||JSON.stringify(r));
	judge(!r.__err&&r.crewHidden===true&&r.crewBack===true&&r.gunCleared,'S14b 接管中炮手让位隐身, 下炮恢复 + 座位账清',r.__err||JSON.stringify({h:r.crewHidden,b:r.crewBack,g:r.gunCleared}));
	// 阴性对照 (源锚): F 分支的触发器确实是位置判据
	srcHas('js/20-player.js','capDeckOf(player.pos.x,player.pos.z)','S14c tryInteract 大舰分支触发器 = 脚下舰 (capDeckOf)');
}

// ═══ S15 大海致命化 · 玩家链 (2026-10-01c 用户设想) ═══
{
	srcHas('js/20-player.js',"CAMPAIGN.terr==='opensea'",'S15a 游泳体力消耗/下沉只在纯海战图生效 (terr 门)');
	srcHas('js/20-player.js','seaSwimDrain','S15b 游泳体力单源消耗 (CAPITAL_CFG.seaSwimDrain)');
	srcHas('js/20-player.js','seaSinkRate','S15c 体力耗尽强制下沉 (diveD 增量)');
	srcHas('js/20-player.js','seaDrownMul','S15d 溺水挣扎憋气倍率 (OXY 链加速)');
	// 数值锚: 满条 1/0.13 ≈ 7.7s 耗尽; 溺水 OXY 22/3 ≈ 7.3s
	const r=NT(ctx,`(()=>({drain:CAPITAL_CFG.seaSwimDrain,sink:CAPITAL_CFG.seaSinkRate,mul:CAPITAL_CFG.seaDrownMul}))()`);
	judge(!r.__err&&r.drain>0.10&&r.drain<0.2&&r.sink>0.5&&r.mul>=2,'S15e 海泳参数档 (drain≈0.13/s · sink>0.5 · drownMul≥2)',r.__err||JSON.stringify(r));
}

// ═══ S16 大海致命化 · Bot 落水溺伤 + pickObjective 远舰过滤 ═══
{
	const r=NT(ctx,`(function(){
		capitalReset();
		// ① Bot 落水: 宽限 seaBotGrace 后掉血 (100 血 → ~5.5s 耗尽)
		const b=new Bot(0,0,'落水员');
		b.spawn(); b.alive=true; b.hp=100; b.onVehicle=null; b.chuting=false;
		const sea=capitalShips[0];
		b.pos.set(sea.pos.x+120,0.2,sea.pos.z); b.swim=true;    // 开阔海面 (远离甲板矩形)
		let dropped=false;
		for(let k=0;k<600;k++){ b.update(1/60); if(!b.alive||b.hp<99){ dropped=true; break; } }
		// ② pickObjective: 甲板上的 Bot 不选跳帮距离外的他舰旗
		const me=capitalShips.find(x=>x.team===0);
		const far=capitalShips.find(x=>x.team===1);
		const c=new Bot(0,0,'守岛员');
		c.spawn(); c.alive=true;
		const cw=capToWorld(me,0,0,{x:0,z:0});
		c.pos.set(cw.x,me.pos.y+me.deck.y+0.1,cw.z);
		c.onCapDeck=me; c.pickObjective();
		let objShip=null;
		if(c.objective&&c.objective.ship!==undefined&&capitalShips[c.objective.ship]) objShip=capitalShips[c.objective.ship];
		const farDist=capRectDist(far,c.pos.x,c.pos.z);
		const noFarPick=(farDist>CAPITAL_CFG.boardR)?(objShip!==far):(true);
		const i1=combatants.indexOf(b); if(i1>=0) combatants.splice(i1,1);
		const i2=soldiers.indexOf(b); if(i2>=0) soldiers.splice(i2,1);
		const i3=combatants.indexOf(c); if(i3>=0) combatants.splice(i3,1);
		const i4=soldiers.indexOf(c); if(i4>=0) soldiers.splice(i4,1);
		return {dropped,noFarPick,farDist:Math.round(farDist)};
	})()`);
	judge(!r.__err&&r.dropped===true,'S16a Bot 落水速死: 宽限 seaBotGrace 后溺伤启动 (海里扎堆的游泳团自净)',r.__err||JSON.stringify(r));
	judge(!r.__err&&r.noFarPick===true,'S16b 跨舰远旗不选 (boardR 外): Bot 不再集体下水追巡航的舰',r.__err||('farDist='+r.farDist));
	srcHas('js/14-bots.js',"CAMPAIGN.terr==='opensea'",'S16c Bot 溺伤的纯海战图门 (terr)');
}

// ═══ S17 手雷/巡飞弹对舰实体 (2026-10-01c"命中大船会穿过去") ═══
{
	const r=NT(ctx,`(function(){
		capitalReset();
		const foe=capitalShips.find(x=>x.team===1);
		const own=capitalShips.find(x=>x.team===0);
		// ① 点查询: 舷侧 (甲板矩形外、舰体矩形内) 命中; 甲板上空飞过不拦; 己方舰同样拦
		//   ★2026-10-01d 口径: 实体带顶 = 甲板面+0.25 (旧 +2.6 把甲板上空当实体 ⇒ 巡飞弹贴甲板掠过自爆,
		//   用户复报"离甲板比较近却没有接触的时候会被引爆") —— 近甲空域 (deckTop+1.5) 必须为 null。
		const c=Math.cos(foe.yaw),n=Math.sin(foe.yaw);
		const slx=foe.spec.hullW*0.5-0.8;                          // 舷侧内 0.8m (deck 半宽 9 < hull 半宽 10.5)
		const sx=foe.pos.x+slx*c, sz=foe.pos.z-slx*n;
		const hitSide=capitalSolidAt(sx,foe.pos.y+6,sz);           // 舷侧中部
		const deckTop=foe.pos.y+foe.spec.deckY+CAPITAL_CFG.deckLift;
		const over=capitalSolidAt(sx,deckTop+5,sz);                // 甲板上空 5m ⇒ 飞
		const nearAir=capitalSolidAt(sx,deckTop+1.5,sz);           // 近甲空域 1.5m ⇒ 飞 (2026-10-01d 新口径)
		const deckTouch=capitalSolidAt(sx,deckTop+0.1,sz);         // 甲板面 ±0.25 ⇒ 实体 (落弹接触)
		const ownHit=capitalSolidAt(own.pos.x,own.pos.y+own.spec.deckY+CAPITAL_CFG.deckLift+0.1,own.pos.z);  // 己方甲板 ⇒ 实体
		const okSolid=(hitSide&&hitSide.ship===foe&&!over&&!nearAir&&deckTouch&&ownHit&&ownHit.ship===own);
		// ② 射线: 巡飞弹从舷外 40m 平射舰舷 ⇒ 命中; 垂直向上 ⇒ 不命中
		const fx=sx+40*c, fz=sz+40*n;
		const ray=capitalRayHit(V3(fx,foe.pos.y+6,fz),V3(-c,0,-n),80,-1,0);
		const rayMiss=capitalRayHit(V3(fx,foe.pos.y+6,fz),V3(0,1,0),50,-1,0);
		const okRay=(ray&&ray.ship===foe&&!rayMiss);
		return {okSolid,okRay};
	})()`);
	judge(!r.__err&&r.okSolid,'S17a capitalSolidAt: 舷侧拦/甲板上空不拦/己舰也拦 (舰体=不分敌我的实体)',r.__err||JSON.stringify(r));
	judge(!r.__err&&r.okRay,'S17b capitalRayHit(team=-1): 巡飞弹射线命中舰体, 背向不误报',r.__err||JSON.stringify(r));
	srcHas('js/13-combat.js','capitalSolidAt(nx,ny,nz)','S17c nadeStep 全弹种对舰实体接线');
	srcHas('js/13-combat.js','capitalRayHit(d.pos,dir,hitD,-1,0)','S17d 巡飞弹对舰射线接线 (不分敌我)');
}

// ═══ S18 跳帮放行 (2026-10-01c"围栏像能量力场") ═══
{
	const r=NT(ctx,`(function(){
		capitalReset();
		const a=capitalShips[0];
		const b=capitalShips.find(x=>x!==a&&x.spec.cls==='bb');   // 同档 bb (cv 甲板高差 4.4m, 被高度门挡是正确行为)
		// 贴帮: b 并靠 a 右舷 (a-local +x 方向), 舰体矩形刚好贴合 (+0.1 余量)
		const c=Math.cos(a.yaw),nn=Math.sin(a.yaw);
		const gap=a.spec.hullW*0.5+b.spec.hullW*0.5+0.1;
		const orig={x:b.pos.x,z:b.pos.z,y:b.pos.y,yaw:b.yaw};   // 原位存档: 复位不留残位 (capitalReset 不还原 pos.x/z/yaw)
		const bx=a.pos.x+gap*c, bz=a.pos.z-gap*nn;
		const by=b.pos.y; b.pos.x=bx; b.pos.z=bz;
		// 玩家站在 a 甲板右缘 (夹持会往里推): local x = capDeckHW−0.2
		const lxE=capDeckHW(a,0)-0.2;
		const px=a.pos.x+lxE*c, pz=a.pos.z-lxE*nn;
		const pos=V3(px,a.pos.y+a.deck.y,pz);
		const preX=pos.x, preZ=pos.z;
		capPushBody(pos,0.42);
		const pushGap=Math.hypot(pos.x-preX,pos.z-preZ);
		// 阴性对照: b 挪远后同样站位必须被夹回 (护栏正常工作)
		b.pos.x+=400;
		const pos2=V3(px,a.pos.y+a.deck.y,pz);
		const preX2=pos2.x;
		capPushBody(pos2,0.42);
		const pushFar=Math.hypot(pos2.x-preX2,pos2.z-preZ);
		b.pos.x=orig.x; b.pos.z=orig.z; b.pos.y=orig.y; b.yaw=orig.yaw;   // 还原到**开局位** (不是贴帮位)
		return {pushGap:Math.round(pushGap*100)/100,pushFar:Math.round(pushFar*100)/100,boardOk:(pushFar>0.3&&pushGap<pushFar*0.5)};
	})()`);
	judge(!r.__err&&r.boardOk,'S18 跳帮放行: 贴帮时舷缘夹持让位 (可跳过去), 无邻舰时照常夹回 (阴性)',r.__err||('贴帮推移 '+r.pushGap+'m vs 无邻舰推移 '+r.pushFar+'m'));
}

// ═════════════════════════════════════════════════════════════════════════
// S19~S26: 2026-10-01d 第三轮实机反馈 (七条) 的判据
// ═════════════════════════════════════════════════════════════════════════

// ═══ S19 舰-舰/艇-舰 SAT 碰撞: T-bone 斜插必须被检出 (2026-10-01d"撞船穿模仍十分严重") ═══
{
	const r=NT(ctx,`(function(){
		capitalReset();
		const a=capitalShips[0];
		const b=capitalShips.find(x=>x!==a&&x.spec.cls==='bb');
		const keep={ax:a.pos.x,az:a.pos.z,bx:b.pos.x,bz:b.pos.z,byaw:b.yaw};
		// T-bone: b 艏向 +x (yaw=−π/2), 中心在 a 舷外 70m, 舰艏插进 a 舷侧 ~5m —— 旧版只测 b 的**中心**
		// 对 a 外接矩形 (中心在外面) ⇒ 判不出重叠, 整条船对穿。
		b.yaw=-Math.PI/2;
		b.pos.x=a.pos.x-70; b.pos.z=a.pos.z;
		capPushCap();
		const moved=Math.hypot(b.pos.x-keep.bx,b.pos.z-keep.bz)+Math.hypot(a.pos.x-keep.ax,a.pos.z-keep.az);
		// 推开后两舰四角必须分离 (SAT 复查)
		const corners=(s)=>{ const hw=s.spec.hullW*0.5,hl=s.spec.hullL*0.5,co=Math.cos(s.yaw),nn=Math.sin(s.yaw);
		return [[s.pos.x+hw*co+hl*nn,s.pos.z-hw*nn+hl*co],[s.pos.x-hw*co+hl*nn,s.pos.z+hw*nn+hl*co],
		[s.pos.x+hw*co-hl*nn,s.pos.z-hw*nn-hl*co],[s.pos.x-hw*co-hl*nn,s.pos.z+hw*nn-hl*co]]; };
		const pa=corners(a), pb=corners(b);
		let stillOverlap=true;
		for(const s of [a,b]){ const co=Math.cos(s.yaw),nn=Math.sin(s.yaw);
		for(const ax of [[co,-nn],[nn,co]]){
		let a0=1e9,a1=-1e9,c0=1e9,c1=-1e9;
		for(let k=0;k<8;k+=2){
		const da=pa[k/2][0]*ax[0]+pa[k/2][1]*ax[1]; if(da<a0)a0=da; if(da>a1)a1=da;
		const db=pb[k/2][0]*ax[0]+pb[k/2][1]*ax[1]; if(db<c0)c0=db; if(db>c1)c1=db;
		}
		if(Math.max(a0,c0)>=Math.min(a1,c1)) stillOverlap=false;
		}}
		a.pos.x=keep.ax; a.pos.z=keep.az; b.pos.x=keep.bx; b.pos.z=keep.bz; b.yaw=keep.byaw;   // 原艏向也还 (复位不留残态)
		return {moved:Math.round(moved*100)/100,separated:!stillOverlap};
	})()`);
	judge(!r.__err&&r.moved>0&&r.separated===true,'S19 capPushCap SAT: T-bone 舰艏斜插被检出并推开 (旧版中心测试=穿模)',r.__err||('位移 '+r.moved+'m, 推开后分离='+r.separated));
}

// ═══ S20 capPushBody 双门: 邻舰不再扫人下海 (被挤下水/行进受阻的共同根因) ═══
{
	const r=NT(ctx,`(function(){
		capitalReset();
		const a=capitalShips[0];                       // bb_us (deck 12.66, 甲板半宽 9.0)
		const b=capitalShips.find(x=>x!==a&&x.spec.cls==='cv');
		const b2=capitalShips.find(x=>x!==a&&x.spec.cls==='bb');
		const keep={bx:b.pos.x,bz:b.pos.z,byaw:b.yaw,b2x:b2.pos.x,b2z:b2.pos.z,b2yaw:b2.yaw};
		b.yaw=a.yaw; b2.yaw=a.yaw;                     // 摆正: 矩形重叠可解析计算
		const c=Math.cos(a.yaw),n=Math.sin(a.yaw);
		const atLocal=(lx)=>{ const w={x:0,z:0}; capToWorld(a,lx,0,w); return w; };
		const py=a.pos.y+a.deck.y;
		// ① cv 顶着 a 的甲板停过来: 水线层**上限门** ⇒ 甲板上的人不动 (旧版被 cv 的 hull 矩形横扫出舷)
		//    测试点取护栏内缩带之内 (lx=8.0 < 9.0−0.54): 本舰自己也不该推它
		const w1=atLocal(8.0);
		b.pos.x=a.pos.x+(a.spec.hullW*0.5)*c*0.5; b.pos.z=a.pos.z-(a.spec.hullW*0.5)*n*0.5;
		const pos1=V3(w1.x,py,w1.z); const p1x=pos1.x,p1z=pos1.z;
		capPushBody(pos1,0.42);
		const cvSweep=Math.hypot(pos1.x-p1x,pos1.z-p1z)<0.01;
		// ② 同档 bb 贴帮 (b2 中心在 a 局部 x=15.7, 两片甲板矩形在 [6.4,9] 重叠):
		//    点在重叠带内 (lx=6.6) 且在 b2 护栏内缩带之外 ⇒ 旧版 b2 把它往 b2 甲板里夹 (对挤), 新版只有脚下这片执法
		const w2=atLocal(6.6);
		b.pos.x=keep.bx; b.pos.z=keep.bz; b.yaw=keep.byaw;
		b2.pos.x=a.pos.x+(a.spec.hullW*0.5+b2.spec.hullW*0.5-6)*c;
		b2.pos.z=a.pos.z-(a.spec.hullW*0.5+b2.spec.hullW*0.5-6)*n;
		const pos2=V3(w2.x,py,w2.z); const p2x=pos2.x,p2z=pos2.z;
		capPushBody(pos2,0.42);
		const noCrossPinch=Math.hypot(pos2.x-p2x,pos2.z-p2z)<0.01;
		// ③ 阴性对照: 邻舰挪远 (前提做成显式前提, 不吃前面块的残位), 超出护栏内缩带 (lx=8.8 ∈ (8.46, 9.0))
		//    必须被本舰夹回 (护栏还在工作)
		const w3=atLocal(8.8);
		b.pos.x+=500; b2.pos.x+=500;
		const pos3=V3(w3.x,py,w3.z); const p3x=pos3.x,p3z=pos3.z;
		capPushBody(pos3,0.42);
		const railWorks=Math.hypot(pos3.x-p3x,pos3.z-p3z)>0.2;
		b.pos.x=keep.bx; b2.pos.x=keep.b2x; b2.pos.z=keep.b2z; b2.yaw=keep.b2yaw;   // 还原到开局位 (后面块位还用得着)
		return {cvSweep,noCrossPinch,railWorks};
	})()`);
	judge(!r.__err&&r.cvSweep===true&&r.noCrossPinch===true&&r.railWorks===true,'S20 capPushBody 双门: 邻舰不再扫人/对挤下海, 护栏照常 (阴性)',r.__err||JSON.stringify(r));
}

// ═══ S21 超射塔炮座: 主炮塔逐塔有支撑 (2026-10-01d"大炮塔仍然有浮空的") ═══
{
	const r=NT(ctx,`(()=>{
		const errs=[]; let nBar=0;
		for(const key of ['bb_us','bb_jp']){
		const S=CAPITAL_SPEC[key];
		const R=capBuildModel(S);
		const tH=Math.max(3.2,S.hullH*0.27);
		for(let i=0;i<S.main.n;i++){
		const base=S.main.y[i]-tH;                       // 塔底
		const deckTop=S.deckY+CAPITAL_CFG.deckLift;
		if(base<=deckTop+0.05) continue;                 // 塔底已在甲板里 (前后两塔) ⇒ 无需炮座
		nBar++;
		const bar=R.boxes.find(b=>b.name==='cpBarbette'+i);
		if(!bar){ errs.push(key+'#'+i+' 缺炮座'); continue; }
		const top=bar.ly+bar.hh;
		if(Math.abs(top-base)>0.5) errs.push(key+'#'+i+' 炮座顶 '+top.toFixed(2)+' != 塔底 '+base.toFixed(2));
		}
		}
		return {errs,nBar};
	})()`);
	judge(!r.__err&&r.errs.length===0&&r.nBar>=2,'S21 超射塔炮座: 悬空塔底 (z=36) 由 cpBarbette 承托, 塔底埋深 ≤0.5m',r.__err||(r.errs.join('; ')||('补炮座 '+r.nBar+' 座 (bb_us/bb_jp 各 1)')));
}

// ═══ S22 cv 舰炮全链: 副炮打小艇 / 防空瞄准跟踪+开火圈分档 (2026-10-01d"小炮无法转向和开火") ═══
{
	const r=NT(ctx,`(function(){
		capitalReset();
		const cv=capitalShips.find(x=>x.cls==='cv'&&x.team===0);
		if(!cv) return {__err:'no cv'};
		// 敌方真飞机暂时下线: 索敌目标只有探针的假飞机 (否则"最近敌机"不可控)
		const foes=planes.filter(p=>p&&p.alive&&p.team===1);
		const savedFoe=foes.map(p=>p.alive);
		foes.forEach(p=>{ p.alive=false; });
		let secFired=0, aaFired=0;
		const _fs=cv.fireSecondary.bind(cv), _fa=cv.fireAA.bind(cv);
		cv.fireSecondary=(...a)=>{ secFired++; return _fs(...a); };
		cv.fireAA=(...a)=>{ aaFired++; return _fa(...a); };
		// 假想敌小艇: 副炮 secR=480 内
		const craft={kind:'boat',team:1,alive:true,state:'run',pos:V3(cv.pos.x+180,0,cv.pos.z),vel:V3(3,0,0),velX:3,velZ:0,
		spec:{hullW:6,hullL:20},hp:100,maxHp:100,takeDmg(){},damage(){}};
		const _naval=navalCraft.length; navalCraft.push(craft);
		// 假想敌飞机: 开火圈 aaR=170 内 (舷侧 90°: 舷角闸门后仍有本舷炮位参战)
		const pl={kind:'plane',team:1,alive:true,pos:V3(cv.pos.x+120,cv.pos.y+60,cv.pos.z),vel:V3(-30,0,0)};
		const _pl=planes.length; planes.push(pl);
		for(let k=0;k<240;k++) cv.aiTick(1/60);        // 副炮 0.9rad/s 转到舷侧目标要 ~1.8s, 取 4s 足量
		const fired=(secFired>0&&aaFired>0);
		// 远圈瞄准: 飞机拉到对舷 300m (开火圈外/瞄准圈内, 偏出艏艉窄角线 40m ⇒ 舷侧明确):
		//   塔照转 (2026-10-01d 新口径), 不出弹
		aaFired=0;
		const aimAll=cv.aaAimY.slice();
		pl.pos.x=cv.pos.x-300; pl.pos.z=cv.pos.z+40;
		for(let k=0;k<60;k++) cv.aiTick(1/60);
		const farTracked=cv.aaAimY.some((v,i)=>Math.abs(v-aimAll[i])>0.01);
		const farNoFire=(aaFired===0);
		navalCraft.splice(_naval,1); planes.splice(_pl,1);
		foes.forEach((p,i)=>{ p.alive=savedFoe[i]; });
		cv.fireSecondary=_fs; cv.fireAA=_fa;
		return {fired,farTracked,farNoFire,secFired,aaFired};
	})()`);
	judge(!r.__err&&r.fired===true,'S22a cv 舰炮全链: 副炮打小艇出弹 + 防空开火圈内敌机出弹',r.__err||JSON.stringify(r));
	judge(!r.__err&&r.farTracked===true&&r.farNoFire===true,'S22b 防空瞄准圈(aaAimR 420)≠开火圈(aaR 170): 远圈转塔不出弹',r.__err||JSON.stringify(r));
}

// ═══ S23 炮手随炮转向: 网格转角 = 炮位相对瞄准角 (2026-10-01d"Bot 操作炮动作不自然") ═══
{
	const r=NT(ctx,`(function(){
		capitalReset();
		const s=capitalShips[0];
		const crewSec=s.crewBots.find(b=>b.capCrew&&b.capCrew.type==='sec');
		const crewMain=s.crewBots.find(b=>b.capCrew&&b.capCrew.type==='main');
		if(!crewSec||!crewMain) return {__err:'crew 缺员'};
		s.secAimY[crewSec.capCrew.idx]=0.7;
		s.turYaw[crewMain.capCrew.idx]=-0.4;
		capCrewTick(s,1/60);
		const secRot=crewSec.mesh.root.rotation.y, mainRot=crewMain.mesh.root.rotation.y;
		return {secOk:Math.abs(secRot-0.7)<1e-6, mainOk:Math.abs(mainRot-(-0.4))<1e-6};
	})()`);
	judge(!r.__err&&r.secOk===true&&r.mainOk===true,'S23 炮手随炮转向: 局部转角=secAimY/turYaw (同一数据源)',r.__err||JSON.stringify(r));
}

// ═══ S24 残血钉零: hp∈(0,1) ⇒ 击杀 (2026-10-01d"0血赖着不死") ═══
{
	const r=NT(ctx,`(function(){
		const b=combatants.find(c=>!c.isPlayer&&c.alive&&!c.capCrew&&!c.onVehicle);
		if(!b) return {__err:'no bot'};
		const t0=tickets[b.team];
		b.hp=100;
		b.damage(99.5,null,false);                    // 残 0.5 (旧版: 活着, 名牌显示 0/100)
		const dead=!b.alive;
		const ticketOk=(tickets[b.team]===Math.max(0,t0-1));   // die() 照常扣票
		return {dead,ticketOk,hp:b.hp};
	})()`);
	judge(!r.__err&&r.dead===true&&r.ticketOk===true,'S24 残血钉零: 99.5 伤后 hp=0.5 → 击杀 + 票务照常',r.__err||JSON.stringify(r));
}

// ═══ S25 停机抬量: 停放/拦阻/停驻三处机腹不再埋进甲板 (2026-10-01d"起飞前嵌在甲板上") ═══
{
	const r=NT(ctx,`(function(){
		capitalReset();
		const errs=[];
		for(const p of planes){
		if(!p||!p.alive||!p.capArrest) continue;
		const cv=p.capArrest;
		const lift=plParkLift(p);
		if(lift<=0.3){ errs.push('lift 过小 '+lift.toFixed(2)); continue; }
		const expect=cv.pos.y+cv.deck.y+lift;
		if(Math.abs(p.pos.y-expect)>1e-6) errs.push('pos.y 偏差 '+(p.pos.y-expect).toFixed(3));
		}
		// 拦阻链: 低速进场落甲板后高度 = top+lift
		const cv=capitalShips.find(x=>x.cls==='cv');
		const pl=planes.find(x=>x&&x.alive);
		pl.capArrest=null;
		pl.pos.set(cv.pos.x,cv.pos.y+cv.deck.y+0.6,cv.pos.z);
		pl.speed=12; pl.pitch=0; pl.roll=0; pl.yaw=cv.yaw;
		const okArrest=capTryArrest(pl);
		const yOk=okArrest&&Math.abs(pl.pos.y-(cv.pos.y+cv.deck.y+plParkLift(pl)))<1e-6;
		capitalReset();
		return {errs,okArrest,yOk};
	})()`);
	judge(!r.__err&&r.errs.length===0&&r.okArrest===true&&r.yOk===true,'S25 停机抬量 plParkLift: 停放+拦阻两链高度=甲板面+机腹余量',r.__err||JSON.stringify(r));
}

// ═══ S26 建模: 联装数单源 + 命中盒下沿到塔底 (2026-10-01d"小炮建模简陋") ═══
{
	const r=NT(ctx,`(()=>{
		const cv=CAPITAL_SPEC.cv_us, bb=CAPITAL_SPEC.bb_us;
		const Rcv=capBuildModel(cv);
		const Rbb=capBuildModel(bb);
		const quad=(Rcv.aaMounts[0].barrels.length===4);
		const tripleJp=(capBuildModel(CAPITAL_SPEC.cv_jp).aaMounts[0].barrels.length===3);
		const singleSec=(Rbb.secMounts[0].barrels.length===1);
		// 主炮命中盒: 下沿 = 塔底 (bb_us #2 超射塔: 15.198, 旧口径 gunY-2.55=16.05 盖不住)
		const S=bb, tH=Math.max(3.2,S.hullH*0.27);
		const box2=Rbb.boxes.find(b=>b.name==='cpTurret2');
		const botOk=box2&&Math.abs((box2.ly-box2.hh)-(S.main.y[2]-tH))<1e-6;
		return {quad,tripleJp,singleSec,botOk:!!botOk};
	})()`);
	judge(!r.__err&&r.quad===true&&r.tripleJp===true&&r.singleSec===true&&r.botOk===true,'S26 建模: 四联/三联/单管按 spec.barrels 出模, 主炮盒下沿=塔底',r.__err||JSON.stringify(r));
}

say('');
say('== 合计: '+nPass+' 通过 / '+nFail+' 失败 ==');
fs.writeFileSync(path.join(OUTDIR,'navalcap-report.txt'),OUT.join('\n'));
process.exit(nFail?1:0);
