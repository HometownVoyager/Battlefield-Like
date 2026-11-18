// ─────────────────────────────────────────────
// dev/verify-tankai.js —— I1 坦克车组 AI 交战层 沙箱探针 (不进 index.html)
// 用法: node dev/verify-tankai.js
// 背景 (2026-09-20 I1 用户口径): "完整坦克AI逻辑但不同难度下应当有不同削弱" + "不能太超雄";
//   现状根因 = 坦克车组没有"敌车感知→交战决策→战术机动"层, 且散布/塔速对所有难度同档。
// 本沙箱加载**真实全链脚本** (00-config → 24-main, 与 probe-bots.js 同表), 停在受控实验里:
//   清掉世界自带的单位 (地形/建筑/OCC/NAV 全部保留), 换成自建的坦克/车组, 只推进 tanks.update + updateShells。
// 四条硬断言 (全部实跑, 失败即 exit 1):
//   ① 200m 直线对置: 双方都在 N 秒内锁上对方并转塔到位 (炮塔指向对方 ±0.12rad)
//   ② 难度分档: 新兵档"首次开火延迟"显著大于精英档 (>1.5× 且 >0.5s)
//   ③ 不穿模: 两车挤到 <4m 时中心距不低于阈值 (2.6m), 且不被推进 OCC 占用格/悬空
//   ④ 互不误伤: 友方坦克/友方步兵压在弹道上时一炮不发, 让开弹道后立刻开火 (A/B 对照)
// 另附两条旁证 (不是本次下发断言, 但支撑"玩家驾驶行为不变"):
//   ⑤ 玩家车 (isAI=false) 走 fireCannon 不吃 AI 散布; ⑥ 玩家车不被 vehiclePushTanks 推动
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const LC=require('./_loadcache.js'); // 2026-11-19 效率批
const root=path.resolve(__dirname,'..');
// 共享桩 (dev/_bootstub.js): THREE/DOM/WebAudio 最小桩, 与 verify-padground/uvscale 同源
const {sandbox,document,window}=require('./_bootstub.js');
// _bootstub 的 Vector3 桩缺这两个方法 (08-effects/15-vehicles 里被调用); 缺了是"桩能力不足"的假失败, 先补齐
const V3c=sandbox.THREE.Vector3;
V3c.prototype.addScalar=function(s){ this.x+=s; this.y+=s; this.z+=s; return this; };
V3c.prototype.divideScalar=function(s){ s=s||1; this.x/=s; this.y/=s; this.z/=s; return this; };
// _bootstub 的材质桩缺 clone()/dispose() (probe-bots 的桩有): 08-effects 的血液/弹着贴花会 `bloodMat.clone()`,
// 缺了会在"炮弹/子弹命中步兵"那一帧随机 TypeError（曾因此让探针偶发假崩）——按同源口径补上, 不动共享桩文件。
for(const k of ['MeshLambertMaterial','MeshBasicMaterial','MeshStandardMaterial','MeshPhongMaterial','PointsMaterial','SpriteMaterial']){
	const C=sandbox.THREE[k];
	if(!C||!C.prototype) continue;
	if(!C.prototype.clone) C.prototype.clone=function(){ return new C(Object.assign({},this,{color:this.color})); };
	if(!C.prototype.dispose) C.prototype.dispose=function(){};
}
// _bootstub 的 WebAudio 桩只够"建得起图": 缺 AudioParam 的斜坡/取消方法与 oscillator.detune,
// 而 01-audio 的引擎声/炮声/环境声全量在用 (坦克 engine.update 一跑就 TypeError)。
// 本探针按 probe-bots.js 同源口径补一套完整 AC 桩 —— 只在本进程里替换沙箱的 AudioContext, 不动共享桩文件。
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
sandbox.AudioContext=ACStub;
sandbox.window.AudioContext=ACStub;
sandbox.window.webkitAudioContext=ACStub;
// _bootstub 的 window.CANNON 桩只有 World.add, 缺 gravity/broadphase/solver —— 12-ragdolls.ragInit 看到
// window.CANNON 存在就会往下走并半途 TypeError (声明的"加载失败则回退旧倒地动画"分支反而进不去)。
// 本探针不测布娃娃, 按 probe-bots 同源口径摘掉 window.CANNON, 让 ragInit 走它自己的"物理未就绪"早退分支。
delete sandbox.window.CANNON;

// 与 probe-bots.js 同一张加载表 (顺序不可变; 15c-specveh/22a/23b 由 typeof 守卫, 探针不载)
const FILES=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/23-deploy.js','js/24-main.js'];
const CAMP_STEPPE=8; // 草原遭遇 (mapSize=640): 唯一能放下 200m 通视直线的开阔战役

const PRELUDE=`globalThis.__T=(function(){
const DTS=[1/60,1/30,1/20];
// 只推进坦克与炮弹: 探针是受控实验, 不跑旗点/小队/步兵 AI (那会把实验对象打乱)
function step(frames,collect,pre){
for(let f=0;f<frames;f++){
const dt=DTS[f%3];
nowT+=dt;
gunEvents=gunEvents.filter(e=>nowT-e.t<0.6);
if(pre) pre(dt,f);
for(const t of tanks) t.update(dt);
updateShells(dt);
if(collect) collect(dt,f);
}
}
// 清场: 世界已按战役正常建好 (地形/建筑/OCC/NAV 全在), 只把"活动单位"换成实验用单位
function clear(){
for(const t of tanks) t.alive=false;
for(const s of soldiers) s.alive=false;
tanks.length=0; soldiers.length=0; combatants.length=0;
try{ for(const p of planes) p.alive=false; planes.length=0; }catch(e){}
try{ for(const k of trucks) k.alive=false; trucks.length=0; }catch(e){}
shells.length=0; gunEvents=[];
try{ SMOKES.length=0; }catch(e){}
try{ matchOver=false; }catch(e){}
}
	// 车道搜索: 长 L 直线, 两端 OCC 空 + 双向通视 (与 tankPerceive 同一套口径: 眼高 1.9 → 目标 +1.3) + 沿线可行驶
	// 2026-11-14 缩图批 640→360: 图幅缩小后布景密度相对升高, 旧 10m 中线单线采样会漏掉车道中段的占用格/树
	//   (实测: ③ 推挤车被推入住用格 / ④ 敌车落树后不可见) —— 改中线+±1.3m 平行线逐 5m 采样 (车体宽 2.6m 口径);
	//   车道长度判据经实测在 360 图仍可放下 200m (车道 (-170,40)→(30,40)), 长度语义不变。
	function lane(L){
		let best=null;
		for(let x=-280;x<=280;x+=10)for(let z=-280;z<=280;z+=10)for(let k=0;k<8;k++){
			const a=k/8*TAU, dx=Math.sin(a), dz=Math.cos(a);
			const ax=x-dx*L/2, az=z-dz*L/2, bx=x+dx*L/2, bz=z+dz*L/2;
			const lim=MAP_SIZE/2-6;
			if(Math.max(Math.abs(ax),Math.abs(az),Math.abs(bx),Math.abs(bz))>lim) continue;
			if(occBlocked(ax,az)||occBlocked(bx,bz)) continue;
			const ha=heightAt(ax,az), hb=heightAt(bx,bz);
			if(Math.abs(ha-hb)>9) continue;
			// 沿线可行驶: 中线 + ±2.2m 平行线逐 5m 采样 (2026-11-14 缩图批, 旧: 中线逐 10m —— 360 图布景密度相对升高,
			//   旧采样漏掉车道中段占用格/大半径道具贴边 (实测 ③ 推挤车蹭进调车场平板车占用盘 / ④ 敌车落树后不可见))
			let ok=true, prev=ha;
			for(const off of [0,-2.2,2.2]){
				const ox=-dz*off, oz=dx*off;
				let pv=heightAt(ax+ox,az+oz);
				if(occBlocked(ax+ox,az+oz)){ ok=false; break; }
				for(let s=5;s<=L;s+=5){
					const px=ax+dx*s+ox, pz=az+dz*s+oz, h=heightAt(px,pz);
					if(occBlocked(px,pz)||Math.abs(h-pv)>5.5){ ok=false; break; }
					pv=h;
				}
				if(!ok) break;
			}
			if(!ok) continue;
let clr=true;
for(const e of [[ax,az,ha+1.9,bx,bz,hb+1.3],[bx,bz,hb+1.9,ax,az,ha+1.3]]){
let vx=e[3]-e[0], vy=e[4]-e[1], vz=e[5]-e[2];
const d=Math.hypot(vx,vy,vz)||1; vx/=d; vy/=d; vz/=d;
const hit=raycastWorld(V3(e[0],e[1],e[2]),V3(vx,vy,vz),d);
if(hit&&hit.dist<d-1.2){ clr=false; break; }
}
if(!clr) continue;
let mn=1e9,mx=-1e9;
for(let s=0;s<=L;s+=10){ const h=heightAt(ax+dx*s,az+dz*s); if(h<mn)mn=h; if(h>mx)mx=h; }
const score=(mx-mn)+Math.abs(ha-hb)*0.5;
if(!best||score<best.score) best={ax,az,bx,bz,a,score,relief:+(mx-mn).toFixed(2)};
}
return best;
}
// 实验用坦克: 自选位置/朝向, 无乘员不跑 AI (车组另行 crew 挂上)
function mk(team,variant,x,z,yaw,hp){
const t=new Tank(team,variant);
t.pos.set(x,0,z); t.pos.y=heightAt(x,z); t.yaw=yaw;
t.turretYaw=0; t.turretPitch=0; t.vel=0; t.objective=null;
if(hp){ t.hp=hp; t.maxHp=hp; }
return t;
}
function crew(t,name){ const b=new Bot(t.team,0,name); b.spawnInVehicle(t); b.pos.set(t.pos.x,t.pos.y,t.pos.z); return b; }
function bearing(ax,az,bx,bz){ return Math.atan2(bx-ax,bz-az); }
function foot(team,name,x,z){
const b=new Bot(team,0,name);
b.alive=true; b.hp=100; b.onVehicle=null; b.pos.set(x,0,z); b.pos.y=standHeight(x,z,10);
return b;
}
return {step,clear,lane,mk,crew,bearing,foot};
})();`;

let checks=0, failures=0;
const chk=(c,m)=>{ checks++; console.log((c?'  ✓ ':'  ✗ ')+m); if(!c) failures++; };

function boot(diff){
	const ctx=vm.createContext(Object.assign({},sandbox));
	ctx.document=document; ctx.window=window; ctx.globalThis=ctx;
	ctx.localStorage={_s:{sf_campaign:String(CAMP_STEPPE)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
	// 开局加载期世界会往 stdout 打进度 (如 "[地形] 建筑地基平台: 重刷 N 个顶点") —— 探针只需要自己的断言输出,
	// 过滤掉这类加载期噪音, 让"真实 stdout"一眼可读 (warn/error 原样保留)
	ctx.console={log:(...a)=>{ const s=a.map(x=>String(x)).join(' '); if(!/^\[(地形|HUD|NAV|世界)/.test(s)) console.log(...a); }, warn:console.warn.bind(console), error:console.error.bind(console)};
	for(const f of FILES) LC.script(root,f).runInContext(ctx); // 2026-11-19 效率批: 读盘+编译缓存 (6 boot 原先每次重读重编)
	// 难度的显式落定: 00-config 读 localStorage 时 `parseInt('0')||1` 会把新兵(0)吃成老兵(1), 故直接写 SETTINGS.diff
	vm.runInContext('SETTINGS.diff='+diff,ctx);
	const st=vm.runInContext(`(()=>{ try{ const b=document.getElementById('startBtn'); if(b&&b.onclick){ b.onclick(); return 'ok'; } return 'no-button'; }catch(e){ return 'ERR '+String(e&&e.stack||e); } })()`,ctx);
	vm.runInContext(PRELUDE,ctx);
	ctx.__T.clear();
	return {ctx,start:st,diff:vm.runInContext('SETTINGS.diff',ctx),tune:vm.runInContext('JSON.stringify(tankAITune())',ctx)};
}

// ── 受控对决: 两辆敌对坦克沿通视车道对置 L 米, 记录"锁上对方"(tVehTgt) 与"首次开火"时刻 ──
function duel(b,diff,L,seconds,turretOff,hp,note){
	if(b.diff!==diff){ vm.runInContext('SETTINGS.diff='+diff,b.ctx); b.diff=diff; }
	const r=vm.runInContext(`(()=>{
const T=__T; T.clear();
const ln=T.lane(${L});
if(!ln) return {ok:false,err:'未找到 ${L}m 通视车道'};
const bay=T.bearing(ln.ax,ln.az,ln.bx,ln.bz);
// 诊断 (2026-09-20 I5 联动): 车道本身是否被植被软遮蔽 —— 灌木若恰好落在测试走廊上, 会让"锁定/开火"变慢;
// 那种情况应把测试点挪到无灌木净地, 而不是改断言
const fol=(typeof foliageBlocksLOS==='function')
 ? foliageBlocksLOS(ln.ax,heightAt(ln.ax,ln.az)+1.9,ln.az,ln.bx,heightAt(ln.bx,ln.bz)+1.3,ln.bz) : null;
const A=T.mk(0,0,ln.ax,ln.az,bay,${hp});
const B=T.mk(1,0,ln.bx,ln.bz,bay+Math.PI,${hp});
A.turretYaw=${turretOff}; B.turretYaw=${-turretOff};
A.objective={x:ln.bx,z:ln.bz}; B.objective={x:ln.ax,z:ln.az};
const ca=T.crew(A,'探针甲'), cb=T.crew(B,'探针乙');
const t0=nowT;
let detA=null,detB=null,fireA=null,fireB=null,manA=false,manB=false,latchA=false,latchB=false,covA=false,covB=false;
let shotsA=0,shotsB=0,lastA=-1,lastB=-1;
const endDist=()=>Math.hypot(B.pos.x-A.pos.x,B.pos.z-A.pos.z);
T.step(${seconds}*60,()=>{
const bA=T.bearing(A.pos.x,A.pos.z,B.pos.x,B.pos.z);
const bB=T.bearing(B.pos.x,B.pos.z,A.pos.x,A.pos.z);
if(A.tVehTgt===B) latchA=true;   // 锁存: 只要**曾经**把对方选成敌车目标就算 (12s 内可能已有一方被击毁, 末帧状态不作数)
if(B.tVehTgt===A) latchB=true;
if(A.tVehTgt===B&&Math.abs(angDiff(A.yaw+A.turretYaw,bA))<0.12&&detA===null) detA=nowT-t0;
if(B.tVehTgt===A&&Math.abs(angDiff(B.yaw+B.turretYaw,bB))<0.12&&detB===null) detB=nowT-t0;
for(const ev of gunEvents){
if(ev.shooter===ca){ if(fireA===null) fireA=ev.t-t0; if(ev.t>lastA){ shotsA++; lastA=ev.t; } }
if(ev.shooter===cb){ if(fireB===null) fireB=ev.t-t0; if(ev.t>lastB){ shotsB++; lastB=ev.t; } }
}
if(A.aiOrder!==null||A.aiHaltT>0) manA=true;   // 有战术点/停车观察 = 交战层真的在动
if(B.aiOrder!==null||B.aiHaltT>0) manB=true;
if(A.aiCover) covA=true;                       // 选到过 hull-down 起伏掩体射击位 (抢掩体分支真的能落地)
if(B.aiCover) covB=true;
});
const bA2=T.bearing(A.pos.x,A.pos.z,B.pos.x,B.pos.z), bB2=T.bearing(B.pos.x,B.pos.z,A.pos.x,A.pos.z);
return {ok:true, lane:{ax:+ln.ax.toFixed(1),az:+ln.az.toFixed(1),bx:+ln.bx.toFixed(1),bz:+ln.bz.toFixed(1),relief:ln.relief,fol},
detA,detB,fireA,fireB,tgtA:A.tVehTgt===B,tgtB:B.tVehTgt===A,latchA,latchB,covA,covB,shotsA,shotsB,dmgToB:Math.round(B.maxHp-B.hp),dmgToA:Math.round(A.maxHp-A.hp),
alA:+Math.abs(angDiff(A.yaw+A.turretYaw,bA2)).toFixed(3),alB:+Math.abs(angDiff(B.yaw+B.turretYaw,bB2)).toFixed(3),
d:+endDist().toFixed(1),hpA:Math.round(A.hp),hpB:Math.round(B.hp),manA,manB};
})()`,b.ctx);
	r.note=note;
	return r;
}

console.log('== I1 坦克车组 AI 交战层 验证 (2026-09-20) ==');

// ── 断言 ①: 200m 直线对置, N 秒内双方进入交战 ──
console.log('\n[①] 敌车感知 → 进入交战 (200m 直线对置, 老兵档, 车组在车)');
const b0=boot(1);
console.log('    难度档: '+(b0.tune||'').replace(/"/g,'')+' | 开局='+b0.start);
const A1=duel(b0,1,200,12,0,0,'200m');
if(!A1.ok) chk(false,'场景建立失败: '+A1.err);
else{
	console.log(`    车道 A(${A1.lane.ax},${A1.lane.az}) → B(${A1.lane.bx},${A1.lane.bz}) 起伏${A1.lane.relief}m 车道被植被遮蔽=${A1.lane.fol===null?'无 foliageBlocksLOS':A1.lane.fol}`);
	console.log(`    甲: 锁定@${A1.detA===null?'未':A1.detA.toFixed(2)+'s'} 首次开火@${A1.fireA===null?'未':A1.fireA.toFixed(2)+'s'} 末塔偏${A1.alA}rad`);
	console.log(`    乙: 锁定@${A1.detB===null?'未':A1.detB.toFixed(2)+'s'} 首次开火@${A1.fireB===null?'未':A1.fireB.toFixed(2)+'s'} 末塔偏${A1.alB}rad`);
	console.log(`    末距${A1.d}m 血${A1.hpA}/${A1.hpB} 交战层动作(甲/乙)=${A1.manA}/${A1.manB} 抢起伏掩体(甲/乙)=${A1.covA}/${A1.covB}`);
	chk(A1.detA!==null&&A1.detB!==null,`双方均在 12s 内锁定对方 (${A1.detA===null?'甲未':A1.detA.toFixed(2)+'s'} / ${A1.detB===null?'乙未':A1.detB.toFixed(2)+'s'})`);
	chk(A1.detA!==null&&A1.detA<=10&&A1.detB!==null&&A1.detB<=10,'锁定时刻 ≤10s');
	chk(A1.latchA&&A1.latchB,'双方都曾把对方选为敌车目标 tVehTgt (感知层真的选了敌车; 末帧不看, 12s 内可能已有一方被击毁)');
}

// ── 断言 ②: 新兵 vs 精英 首次开火延迟 ──
console.log('\n[②] 难度分档削弱: 首次开火延迟 (120m 对置, 初始塔偏 ±1.2rad, 双方血量拉高避免中途弃车)');
const bR=boot(0), bV=boot(2);
console.log('    新兵档: '+vm.runInContext('JSON.stringify(tankAITune())',bR.ctx).replace(/"/g,''));
console.log('    精英档: '+vm.runInContext('JSON.stringify(tankAITune())',bV.ctx).replace(/"/g,''));
const R=duel(bR,0,120,10,1.2,9000,'新兵'), V=duel(bV,2,120,10,1.2,9000,'精英');
if(!R.ok||!V.ok) chk(false,'场景建立失败: '+(R.err||V.err));
else{
	const dR=Math.min(R.fireA===null?99:R.fireA,R.fireB===null?99:R.fireB);
	const dV=Math.min(V.fireA===null?99:V.fireA,V.fireB===null?99:V.fireB);
	console.log(`    新兵: 甲开火@${R.fireA===null?'未':R.fireA.toFixed(2)+'s'} 乙@${R.fireB===null?'未':R.fireB.toFixed(2)+'s'} → 首次延迟 ${dR.toFixed(2)}s`);
	console.log(`    精英: 甲开火@${V.fireA===null?'未':V.fireA.toFixed(2)+'s'} 乙@${V.fireB===null?'未':V.fireB.toFixed(2)+'s'} → 首次延迟 ${dV.toFixed(2)}s`);
	console.log(`    新兵 10s 内共开炮 ${R.shotsA+R.shotsB} 发 / 折算命中 ${((R.dmgToA+R.dmgToB)/520).toFixed(1)} 发 (伤害折算含溅射, 仅供参考)`);
	console.log(`    精英 10s 内共开炮 ${V.shotsA+V.shotsB} 发 / 折算命中 ${((V.dmgToA+V.dmgToB)/520).toFixed(1)} 发 (伤害折算含溅射, 仅供参考)`);
	chk(R.fireA!==null&&R.fireB!==null,'新兵档双方都开了火 (延迟可测)');
	chk(V.fireA!==null&&V.fireB!==null,'精英档双方都开了火 (延迟可测)');
	chk(dR>dV*1.5&&dR-dV>0.5,`新兵延迟 ${dR.toFixed(2)}s > 精英 ${dV.toFixed(2)}s ×1.5 且差 >0.5s (实测 ${(dR/dV).toFixed(2)}×, 差 ${(dR-dV).toFixed(2)}s)`);
}

// ── ②b 命中削弱直接量化: 同一姿态连打 240 发, 量弹向与 aimDir 的角偏差 (散布) ──
console.log('    散布实测 (同姿态 240 发, 弹向与 aimDir 角偏差, rad):');
const spreadOf=(bd,lbl)=>{
	const s=vm.runInContext(`(()=>{
const T=__T; T.clear();
const ln=T.lane(120);
const bay=T.bearing(ln.ax,ln.az,ln.bx,ln.bz);
const A=T.mk(0,0,ln.ax,ln.az,bay);
const errs=[];
for(let i=0;i<240;i++){
A.cannonCd=0; shells.length=0;
const d0=A.aimDir();
A.fireCannon();
const sv=shells[0].vel.clone().normalize();
errs.push(Math.acos(Math.max(-1,Math.min(1,sv.dot(d0)))));
}
const mean=errs.reduce((a,b)=>a+b,0)/errs.length;
const sd=Math.sqrt(errs.reduce((a,b)=>a+(b-mean)**2,0)/errs.length);
return {mean,sd,max:Math.max.apply(null,errs)};
})()`,bd.ctx);
	console.log(`      ${lbl}: 平均 ${s.mean.toFixed(5)} / 标准差 ${s.sd.toFixed(5)} / 最大 ${s.max.toFixed(5)}`);
	return s;
};
const sR=spreadOf(bR,'新兵'), sV0=spreadOf(b0,'老兵'), sE=spreadOf(bV,'精英');
chk(sR.sd>sV0.sd&&sV0.sd>sE.sd,`三档散布严格递减 (${sR.sd.toFixed(5)} > ${sV0.sd.toFixed(5)} > ${sE.sd.toFixed(5)})`);
chk(sR.sd>1.8*sE.sd,`新兵散布 ≥1.8× 精英 (实测 ${(sR.sd/sE.sd).toFixed(2)}×; 代码口径 0.0234→0.0056, 理论 4.2×)`);
chk(sE.sd>0,`精英仍有散布 (标准差 ${sE.sd.toFixed(5)} > 0: 不修成"零误差狙击手")`);

// ── 断言 ③: 车体不穿模 (正面挤压 + 侧面切撞) ──
console.log('\n[③] 坦克↔坦克车体分离 (无乘员手驱, 每帧喂 vel=7 硬挤)');
const bP=boot(1);
const P=vm.runInContext(`(()=>{
const T=__T; T.clear();
const ln=T.lane(160);
if(!ln) return {ok:false,err:'未找到车道'};
const bay=T.bearing(ln.ax,ln.az,ln.bx,ln.bz);
const dx=Math.sin(bay), dz=Math.cos(bay);
// 场景 A: 正面对撞 (26m 起手, 头对头挤 12s)
const A1=T.mk(0,0,ln.ax,ln.az,bay), B1=T.mk(1,0,ln.ax+dx*26,ln.az+dz*26,bay+Math.PI);
let minA=1e9,penA=0;
T.step(12*60,(dt,f)=>{
const d=Math.hypot(B1.pos.x-A1.pos.x,B1.pos.z-A1.pos.z);
if(d<minA) minA=d;
},(dt)=>{ A1.vel=7; B1.vel=7; });
// 场景 B: 侧撞 (B2 静置, A2 从 2.0m 侧偏处横穿, 若无分离则中心距会过 2.0m)
const A2=T.mk(0,0,ln.ax,ln.az,bay), B2=T.mk(1,0,ln.ax+dx*30-dz*2.0,ln.az+dz*30+dx*2.0,bay);
let minB=1e9;
T.step(12*60,()=>{
const d=Math.hypot(B2.pos.x-A2.pos.x,B2.pos.z-A2.pos.z);
if(d<minB) minB=d;
},(dt)=>{ A2.vel=7; B2.vel=7; if(Math.hypot(B2.pos.x-A2.pos.x,B2.pos.z-A2.pos.z)>0) B2.vel=0; });
// 场景 C: 极端重叠 (车心仅 1.5m, 远超任何真实接近过程) → 强制分离到位置下限
const C1=T.mk(0,0,ln.ax,ln.az,bay), C2=T.mk(1,0,ln.ax-dz*1.5,ln.az+dx*1.5,bay+Math.PI);
T.step(6*60);
const dC=Math.hypot(C2.pos.x-C1.pos.x,C2.pos.z-C1.pos.z);
const ground=(t)=>Math.abs(t.pos.y-heightAt(t.pos.x,t.pos.z));
return {ok:true,minA:+minA.toFixed(2),minB:+minB.toFixed(2),dC:+dC.toFixed(2),
bodies:[A1,B1,A2,B2,C1,C2].map((t,i)=>({i,occ:occBlocked(t.pos.x,t.pos.z),dy:+ground(t).toFixed(2),
  x:+t.pos.x.toFixed(1),z:+t.pos.z.toFixed(1)}))};
})()`,bP.ctx);
if(!P.ok) chk(false,'场景建立失败: '+P.err);
else{
	console.log(`    正面对撞: 全程最小中心距 ${P.minA}m (两车车长 ${vm.runInContext('TEAM_FACTION[0].tanks[0].hullL',bP.ctx)}m, 零穿透理论值 6.6m)`);
	console.log(`    侧向切撞: 全程最小中心距 ${P.minB}m (零穿透理论值 2.9m, 车体宽 2.6m)`);
	console.log(`    极端重叠分离: 起始车心 1.5m → 6s 后 ${P.dC}m (位置下限 2×TANK_PUSH_R = 2.9m)`);
	console.log('    收尾姿态: '+JSON.stringify(P.bodies));
	chk(P.minA>=2.6,`正面对撞最小中心距 ${P.minA}m ≥ 2.6m (不互相穿插)`);
	chk(P.minB>=2.6,`侧向切撞最小中心距 ${P.minB}m ≥ 2.6m (不互相穿插)`);
	chk(P.dC>=2.85,`位置下限: 极端重叠也分离回 ${P.dC}m ≥ 2.85m (车体宽 2.6m 之内不重叠)`);
	chk(P.bodies.every(b=>!b.occ&&b.dy<1.5),'被推挤后的车没有被推进占用格/悬空 (occ=0, 离地<1.5m)');
}

// ── 断言 ④: 互不误伤 (友方坦克 / 友方步兵 压在弹道上) ──
console.log('\n[④] 友军弹道预检 (AI 坦克 90m 外有敌车; 友军车/友军步兵 压线 vs 让开, A/B 对照)');
const bF=boot(1);
const F=vm.runInContext(`(()=>{
const T=__T; T.clear();
const ln=T.lane(200);
if(!ln) return {ok:false,err:'未找到车道'};
const bay=T.bearing(ln.ax,ln.az,ln.bx,ln.bz);
const dx=Math.sin(bay), dz=Math.cos(bay);
const A=T.mk(0,0,ln.ax,ln.az,bay,6000);       // 主角: 有车组 → AI 全开
A.objective={x:ln.bx,z:ln.bz};
const E=T.mk(1,0,ln.ax+dx*90,ln.az+dz*90,bay+Math.PI,200000); // 敌车: 无车组(不还手)、血厚(打不死)
const FT=T.mk(0,0,ln.ax+dx*40,ln.az+dz*40,bay);              // 友方坦克
const FS=T.foot(0,'友军步兵甲',ln.ax+dx*25,ln.az+dz*25);      // 友方步兵 (下车)
T.crew(A,'探针甲');
let shots=0;
const orig=A.fireCannon.bind(A);
A.fireCannon=function(d){ shots++; return orig(d); };
const put=(t,along,perp)=>{
t.pos.x=ln.ax+dx*along-dz*perp; t.pos.z=ln.az+dz*along+dx*perp;
t.pos.y=heightAt(t.pos.x,t.pos.z); return t;
};
const phase=(label,ftP,fsP,secs)=>{ put(FT,40,ftP); put(FS,25,fsP); FS.pos.y=standHeight(FS.pos.x,FS.pos.z,10);
const s0=shots; T.step(secs*60,null,(dt)=>{ A.aiHaltT=5; A.vel=0; }); // 钉住主角: 只考"弹道预检", 不让它跑去别处
return {label,shots:shots-s0,lineClear:tankFireLineClear(A,A.muzzle,A.aimDir(),90)}; };
const r1=phase('友方坦克压线(侧偏0m)+步兵让开(8m)',0,8,7);
const r2=phase('友方坦克让开(14m)+步兵让开(8m)',14,8,7);
const r3=phase('友方坦克让开(14m)+步兵压线(0m)',14,0,7);
const r4=phase('友方坦克让开(14m)+步兵让开(8m)',14,8,7);
// 旁证: 预检函数的几何判定 (离轴 6m 不算挡线 / 压线算挡线)
const geo=[];
for(const perp of [0,2.5,6,12]){
const t2=T.mk(0,0,ln.ax+dx*30-dz*perp,ln.az+dz*30+dx*perp,bay);
const o={x:ln.ax,y:heightAt(ln.ax,ln.az)+1.93,z:ln.az};
const dir={x:dx,y:0,z:dz};
geo.push({perp,blocked:!tankFireLineClear(A,o,dir,90)});
t2.alive=false; tanks.splice(tanks.indexOf(t2),1);
}
return {ok:true,r1,r2,r3,r4,geo,alive:FS.alive,fsHp:FS.hp,ftHp:FT.hp,ftMax:FT.maxHp,ehp:E.hp,tgt:A.tVehTgt===E};
})()`,bF.ctx);
if(!F.ok) chk(false,'场景建立失败: '+F.err);
else{
	for(const r of [F.r1,F.r2,F.r3,F.r4]) console.log(`    ${r.label}: 本段开炮 ${r.shots} 发`);
	console.log('    预检几何 (友方坦克离轴距离 → 是否判为挡线): '+JSON.stringify(F.geo));
	console.log(`    友方步兵存活=${F.alive} 血=${F.fsHp} | 友方坦克血=${F.ftHp}/${F.ftMax} | 敌车血=${Math.round(F.ehp)} (22 发都落它身上) | 甲锁定敌车=${F.tgt}`);
	chk(F.r1.shots===0,'友方坦克压在弹道上 → 7s 内一炮不发');
	chk(F.r2.shots>0,`友方坦克让开弹道 → 立刻开火 (${F.r2.shots} 发)`);
	chk(F.r3.shots===0,'友方步兵压在弹道上 → 7s 内一炮不发');
	chk(F.r4.shots>0,`友方步兵让开弹道 → 立刻开火 (${F.r4.shots} 发)`);
	chk(F.geo.find(g=>g.perp===0).blocked&&F.geo.find(g=>g.perp===2.5).blocked&&!F.geo.find(g=>g.perp===6).blocked,
		'预检几何: 离轴 0/2.5m 判挡线, 6m 判不挡 (3.4m 走廊口径)');
	chk(F.alive&&F.fsHp===100&&F.ftHp===F.ftMax,'友军步兵/友军坦克全程满血 (炮口确实被按住, 22 发都打在敌车方向)');
}

// ── 旁证 ⑤⑥: 玩家驾驶路径不被改动 ──
console.log('\n[⑤⑥] 玩家路径旁证 (isAI=false 不吃 AI 散布 / 玩家车不被 AI 推)');
const bL=boot(1);
const PL=vm.runInContext(`(()=>{
const T=__T; T.clear();
const ln=T.lane(200);
if(!ln) return {ok:false,err:'未找到车道'};
const bay=T.bearing(ln.ax,ln.az,ln.bx,ln.bz);
const P=T.mk(0,0,ln.ax,ln.az,bay);
P.playerDriven=true; P.isAI=false;
T.step(1);                       // 跑一帧: update 会写好 muzzle (炮口世界坐标)
const d0=P.aimDir();
P.cannonCd=0; P.fireCannon();     // 玩家路径: 20a-seats 就是 t.fireCannon() (无 customDir)
const sh=shells[shells.length-1];
const dot=sh.vel.clone().normalize().dot(d0);
const Q=T.mk(1,0,P.pos.x+Math.sin(bay)*2.0,P.pos.z+Math.cos(bay)*2.0,bay+Math.PI);
const p0={x:P.pos.x,z:P.pos.z}, q0={x:Q.pos.x,z:Q.pos.z};
vehiclePushTanks(P,1/60);
const movedP=Math.hypot(P.pos.x-p0.x,P.pos.z-p0.z);
vehiclePushTanks(Q,1/60);
const movedQ=Math.hypot(Q.pos.x-q0.x,Q.pos.z-q0.z);
return {ok:true,dot,movedP:+movedP.toFixed(3),movedQ:+movedQ.toFixed(3)};
})()`,bL.ctx);
if(!PL.ok) chk(false,'场景建立失败: '+PL.err);
else{
	console.log(`    玩家主炮弹向与 aimDir 点积 = ${PL.dot.toFixed(7)} (AI 散布 0.011rad 会掉到 ≈0.99994)`);
	console.log(`    推挤后位移: 玩家车 ${PL.movedP}m / AI 车 ${PL.movedQ}m`);
	chk(PL.dot>0.999999,'玩家路径不吃 AI 散布 (点积≈1)');
	chk(PL.movedP===0&&PL.movedQ>0,'玩家车不被 AI 推动, AI 车自己让开');
}

console.log(`\n${failures===0?'I1 坦克 AI 探针全过 ✓':`I1 坦克 AI 探针存在失败 ✗ (${failures}/${checks})`}`);
process.exit(failures===0?0:1);
