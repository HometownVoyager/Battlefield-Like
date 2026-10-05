// ──────────────────────────────────────────────────────────────────────────────
// dev/verify-navalround5-20261002.js —— 海战实机反馈第五轮验收 (2026-10-02B)
//
// 用户报的 3 条 + 上批两个顺手发现, 逐条对应判据:
//   ① 弹药箱悬浮在船外 → T1/T2 甲板箱改舰体局部锚 (crateL/baseCrateL): 甲板矩形内 + box 净空 + 走道通行
//   ② F 键冲突 (跳海/补弹/登机…) → T4 甲板分支优先级栈行为验 (补弹>上炮>登机>跳海) + 提示层同账
//   ③ 顺手发现a 基地箱埋进舰体 → T2 baseCrateL 锚位 (旧 (±3,3) 做阴性对照)
//   ④ 顺手发现b 前主炮旗被 #2 塔炮管扫 → T3 低旗 poleH 判据 (旗面带降到炮管下缘之下; 旧 7m 杆做阴性)
//
// 沙箱边界: 走 dev/_bootstub.js 桩, 验逻辑与数值; 渲染/手感交用户实机 (既定工作方式)。
// ──────────────────────────────────────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const {sandbox,document,window}=require('./_bootstub.js');
const OUTDIR=path.join(root,'dev/out');
try{ fs.mkdirSync(OUTDIR,{recursive:true}); }catch(e){}

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
	const body=s.split('\n').map(l=>l.replace(/\/\/.*$/,'')).join('\n');
	judge(body.includes(needle),name,'锚: '+file+' 含「'+needle.slice(0,60)+'」'+(body.includes(needle)?'':' (未命中)'));
}
function srcCount(file,needle,expect,name){
	const s=fs.readFileSync(path.join(root,file),'utf8');
	const body=s.split('\n').map(l=>l.replace(/\/\/.*$/,'')).join('\n');
	const n=body.split(needle).length-1;
	judge(n===expect,name,'锚: '+file+' 「'+needle.slice(0,50)+'」出现 '+n+' 次 (期望 '+expect+')');
}

say('== 海战实机反馈第五轮 · 验收 (dev/verify-navalround5-20261002.js) ==');
say('');

// ── 源锚 ──
srcHas('js/00-config.js','function capShipLocalXY','锚 局部→世界换算单源 (00-config)');
srcHas('js/05c-layouts.js','if(f.crateL&&typeof capShipLocalXY','锚 甲板旗弹药箱走 crateL 局部锚 (05c)');
srcHas('js/05c-layouts.js','const capBaseCrate','锚 基地弹药箱走 baseCrateL 局部锚 (05c)');
srcHas('js/05c-layouts.js','const poleH=f.poleH||7','锚 低旗杆高单源 (05c, 缺省 7=旧几何)');
srcHas('js/15h-capital.js','f.poleH?f.poleH-0.75:6.25','锚 capitalFlagTick 旗面挂边随 poleH (15h)');
srcCount('js/20-player.js',"grabAction={kind:'ammo',crate:ac}",2,'锚 F 分派: 补弹语义甲板层+通用层各一处');
srcCount('js/20-player.js','capNearestParkedPlane()',3,'锚 F 分派: 登机语义 甲板分支+甲板提示+登舰段 各一处');
srcHas('js/20-player.js',"canJump?t2('<b>F</b> 跳海'):t2('走到舷缘再按 F 跳海')",'锚 提示层甲板段与分派同账');

// ══════ T1: 甲板弹药箱几何三查 (coral 实跑: 05c 真落位 → 舰局部判据) ══════
say('');
const B=boot(12);
if(B.loadErrors.length){
	judge(false,'启动链: coral 全脚本 LOAD 不报错',B.loadErrors.map(e=>e.file+' → '+e.err).join('  ||  ').slice(0,900));
}else{
	judge(true,'启动链: coral 全脚本 LOAD 不报错','共 '+FILES.length+' 个脚本 (与 index.html 实载一致)');
	const ctx=B.ctx;
	const t1=NT(ctx,`(()=>{
		// 判据 (15g 几何, 全在舰体局部坐标):
		//   A 在甲板矩形内: |lx| ≤ deckHW−railIn−0.55 (护栏夹持线内), |lz| ≤ deckHL−0.7
		//   B 甲板件 box 净空: 竖直门 (件底<甲板+1.2 且 件顶>甲板+0.05 = 拦人/拦箱的件) 距箱足迹 ≥0.2
		//   C 走道通行: 与中线大件 (甲板室/舰塔/炮座盒, 同 lz 带) 同侧间隙 ≥0.85 (人 diameter 0.84)
		const dl=CAPITAL_CFG.deckLift, railIn=CAPITAL_CFG.railIn;
		const bad=[]; let n=0;
		for(const c of AMMO_CRATES){
			if(c.ship===undefined||!c.mesh) continue;
			n++;
			const s=capitalShips[c.ship]; if(!s){ bad.push('ship?'+c.ship); continue; }
			const dx=c.x-s.homeX, dz=c.z-s.homeZ, cc=Math.cos(s.homeYaw), nn=Math.sin(s.homeYaw);
			const lx=dx*cc-dz*nn, lz=dx*nn+dz*cc;
			const S=s.spec, deckRel=S.deckY+dl;
			if(Math.abs(lx)>S.deckHW-railIn-0.55+1e-6) bad.push(S.key+' 箱('+lx.toFixed(1)+','+lz.toFixed(1)+') 舷外/压栏');
			if(Math.abs(lz)>S.deckHL-0.7) bad.push(S.key+' 箱('+lx.toFixed(1)+','+lz.toFixed(1)+') 越甲板端');
			for(const b of s.boxes){
				if(b.ly-b.hh>=deckRel+1.2||b.ly+b.hh<=deckRel+0.05) continue;   // 竖直门: 只拦"甲板件"
				const gx=Math.max(Math.abs(lx-b.lx)-b.hw-0.55,0), gz=Math.max(Math.abs(lz-b.lz)-b.hd-0.55,0);
				if(Math.hypot(gx,gz)<0.2){ bad.push(S.key+' 箱('+lx.toFixed(1)+','+lz.toFixed(1)+') 入'+b.name); break; }
			}
			for(const b of s.boxes){
				if(Math.abs(b.lx)>0.1) continue;                                // 中线大件才压走道
				if(b.ly-b.hh>=deckRel+1.2||b.ly+b.hh<=deckRel+0.05) continue;
				if(Math.abs(lz-b.lz)>b.hd+1.5) continue;
				const gap=Math.abs(lx)-0.55-b.hw;
				if(gap<0.85&&gap>-0.1){ bad.push(S.key+' 箱 lz'+lz.toFixed(0)+' 卡走道 (gap '+gap.toFixed(2)+' vs '+b.name+')'); break; }
			}
			const want=(SEA?SEA.level:0)-S.draft0+S.deckY+dl;
			if(Math.abs(c.y-want)>0.02) bad.push(S.key+' 箱底高 '+c.y.toFixed(2)+'≠甲板 '+want.toFixed(2));
		}
		return {n,bad:bad.slice(0,8)};
	})()`);
	judge(!t1.__err&&t1.n>=8&&t1.bad.length===0,'T1 coral 甲板弹药箱全部过"甲板内/box净空/走道通行/底高"四查 (n='+t1.n+')',
		t1.__err||t1.bad.join(' ; ')||'实跑落位 = capShipLocalXY 换算无误');

	// ══════ T2: 全战役离线复算 (换算往返 + baseCrateL + 旧锚阴性) ══════
	// 注意: capShipLocalXY 是 CAMPAIGN 单源 (只对当前战役的编制取位), 离线扫全部战役必须内联同一
	//   变换式; 它本身的接线正确性由 T1 (coral 实跑落位) 盖章。
	const t2=NT(ctx,`(()=>{
		const bad=[],trip=[]; let nAnchor=0,nBase=0,liveOK=0;
		for(const C of CAMPAIGNS){
			if(!C.capital||!C.capital.length) continue;
			for(let si=0;si<C.capital.length;si++){
				const cfg=C.capital[si];
				const toW=(anchor)=>{ const cc=Math.cos(cfg.yaw||0), nn=Math.sin(cfg.yaw||0);
					return {x:cfg.x+anchor[0]*cc+anchor[1]*nn, z:cfg.z-anchor[0]*nn+anchor[1]*cc}; };
				// 往返: 载入期正向 (capShipLocalXY 同式) → capDeckBind 同式 (运行期反向) 必须逐位回原锚
				const chk=(anchor,tag)=>{
					const w=toW(anchor);
					const cs=Math.cos(cfg.yaw||0), nn=Math.sin(cfg.yaw||0);
					const dx=w.x-cfg.x, dz=w.z-cfg.z;
					const bx=dx*cs-dz*nn, bz=dx*nn+dz*cs;
					if(Math.abs(bx-anchor[0])>1e-9||Math.abs(bz-anchor[1])>1e-9) trip.push(C.id+':'+tag+' 往返漂移 '+(bx-anchor[0]).toExponential(1)+','+(bz-anchor[1]).toExponential(1));
				};
				for(const f of (C.flags||[])) if(f.ship===si&&f.crateL){ chk(f.crateL,'旗箱'+f.id); nAnchor++; }
				if(cfg.base&&cfg.baseCrateL){ chk(cfg.baseCrateL,'基地箱'); nBase++; }
			}
		}
		// capShipLocalXY 本体 (CAMPAIGN 单源): 当前战役 (coral) 的锚必须换算到同一点
		{
			const f0=CAMPAIGN.flags.find(f=>f.crateL), cfg=CAMPAIGN.capital[f0.ship], w=capShipLocalXY(f0.ship,f0.crateL[0],f0.crateL[1]);
			const cs=Math.cos(cfg.yaw||0), nn=Math.sin(cfg.yaw||0);
			const dx=w.x-cfg.x, dz=w.z-cfg.z;
			if(Math.abs(dx*cs-dz*nn-f0.crateL[0])<1e-9&&Math.abs(dx*nn+dz*cs-f0.crateL[1])<1e-9) liveOK=1;
		}
		// 阴性1: 旧随机散最坏点 (旗 8.3+4) 必须被"甲板内"判红; 阴性2: 旧基地锚 (−3,3) 必须被"box净空"判红
		const S=CAPITAL_SPEC[CAMPAIGNS[12].capital[0].key], railIn=CAPITAL_CFG.railIn;
		const negA=Math.abs(12.3)>S.deckHW-railIn-0.55;
		const boxes=capBuildModel(S).boxes, deckRel=S.deckY+CAPITAL_CFG.deckLift;
		let negB=false;
		for(const b of boxes){
			if(b.ly-b.hh>=deckRel+1.2||b.ly+b.hh<=deckRel+0.05) continue;
			const gx=Math.max(Math.abs(-3-b.lx)-b.hw-0.55,0), gz=Math.max(Math.abs(3-b.lz)-b.hd-0.55,0);
			if(Math.hypot(gx,gz)<0.2){ negB=true; break; }
		}
		return {nAnchor,nBase,trip:trip.slice(0,4),bad:bad.slice(0,4),negA,negB,liveOK};
	})()`);
	judge(!t2.__err&&t2.nAnchor>=12&&t2.nBase>=4&&t2.trip.length===0&&t2.bad.length===0,
		'T2 全战役 '+(t2.nAnchor)+' 旗箱锚 + '+t2.nBase+' 基地箱锚: 局部→世界→局部往返零漂移',
		t2.__err||t2.trip.join(' ; ')||t2.bad.join(' ; ')||'(覆盖 yaw=0/±π/2 两类位姿; 铁底湾双舰编入)');
	judge(t2.liveOK===1,'T2 capShipLocalXY 本体接线正确 (CAMPAIGN 单源, T1 实跑互证)');
	judge(t2.negA&&t2.negB,'T2-阴 旧随机散最坏点(12.3,14)与旧基地锚(−3,3)都被判据判红 —— 判据有牙',
		'舷外判据: '+t2.negA+' / 埋舰体判据: '+t2.negB);

	// ══════ T3: 低旗扫掠判据 (全战役; #2 高炮塔炮轴在旗面带内 ⇒ 只有它约束) ══════
	const t3=NT(ctx,`(()=>{
		// 口径 (00-config 2026-10-02b 注释同源): 主炮管长 barL=ringR×3.30 (15g 单源), 管半径=barL×CP_BAR_R。
		//   塔炮轴高 axisRel=main.y[i]−deckY 落在旗面带 [clothBot−0.3, clothTop+0.3] 内 ⇒ 塔平射就扫旗面:
		//     全尺寸旗 (poleH≥6.5): 塔心距旗点 ≥ barL+2.7 (旗长 2.4 + 余量 0.3);
		//     低旗 (poleH<6.5): 旗面顶 ≤ axisRel−管半径−0.5 (旗面整体降到炮管下缘之下)。
		//   轴在旗面带之下的塔 (平射够不着): 距旗点 ≥5.0 (仅防身, 满仰角扫旗面 = 玩家手动极端, 已裁定接受)。
		const BAR_K=3.30, BAR_R=0.042;
		const bad=[],neg=[]; let n=0;
		for(const C of CAMPAIGNS){
			if(!C.capital||!C.capital.length) continue;
			for(let si=0;si<C.capital.length;si++){
				const cfg=C.capital[si], S=CAPITAL_SPEC[cfg.key]; if(!S) continue;
				const cs=Math.cos(cfg.yaw||0), sn=Math.sin(cfg.yaw||0);
				for(const f of (C.flags||[])){
					if(f.ship!==si) continue;
					n++;
					if(!S.main) continue;                     // cv 无主炮: 无扫掠约束, 计数即可
					const dx=f.x-cfg.x, dz=f.z-cfg.z;
					const lx=dx*cs-dz*sn, lz=dx*sn+dz*cs;
					const poleH=f.poleH||7, clothTop=poleH, clothBot=poleH-1.5;
					for(let i=0;i<S.main.n;i++){
						const axisRel=S.main.y[i]-S.deckY, barL=S.main.ringR*BAR_K, barR=barL*BAR_R;
						const dist=Math.hypot(lx,lz-S.main.ringZ[i]);
						if(dist>barL+2.7) continue;   // 水平不可达: 管长外 2.7m 以上, 任何方位/俯仰都够不着旗 (如 #1/#3 塔距前主炮旗 25/75m)
						if(axisRel>=clothBot-0.3&&axisRel<=clothTop+0.3){
							if(poleH<6.5){ if(clothTop>axisRel-barR-0.5) bad.push(C.id+':'+f.id+' 低旗顶 '+clothTop+' > 管 '+i+' 下缘 '+(axisRel-barR).toFixed(2)); }
							else if(dist<barL+2.7) bad.push(C.id+':'+f.id+' 旗距高炮塔 '+i+' 仅 '+dist.toFixed(1)+'m < '+(barL+2.7).toFixed(1));
						}else if(dist<5.0) bad.push(C.id+':'+f.id+' 旗贴炮塔 '+i+' ('+dist.toFixed(1)+'m)');
					}
					// 阴性: 同一旗点若用旧全尺寸杆 (7m) ⇒ 对 #2 塔必须判红
					if(f.poleH&&f.poleH<6.5){
						const axis2=S.main.y[1]-S.deckY, barL=S.main.ringR*BAR_K, barR=barL*BAR_R;
						const dist=Math.hypot(lx,lz-S.main.ringZ[1]);
						if(axis2>=7-1.5-0.3&&axis2<=7+0.3&&dist<barL+2.7) neg.push(C.id+':'+f.id+' 旧 7m 杆距 #2 塔 '+dist.toFixed(1)+'m 会被扫');
					}
				}
			}
		}
		return {n,bad:bad.slice(0,6),neg};
	})()`);
	judge(!t3.__err&&t3.n>=12&&t3.bad.length===0,'T3 全部战役 '+t3.n+' 面甲板旗过"炮管扫掠"判据 (低旗/全尺寸两档)',
		t3.__err||t3.bad.join(' ; ')||'#2 高炮塔 (炮轴 甲板+6.0/6.3) 对低旗只剩竖直净空约束');
	judge(t3.neg.length>=2,'T3-阴 前主炮旗旧 7m 杆被同一判据判红 —— 判据有牙',t3.neg.join(' ; '));

	// ══════ T4: F 分派甲板层行为 (实跑 tryInteract) ══════
	const t4=NT(ctx,`(()=>{
		const s=capitalShips[0];
		const cr=AMMO_CRATES.find(c=>c.ship===0); if(!cr) return {__err:'ship0 无甲板箱'};
		const reset=()=>{ player.alive=true; player.loiter=false; player.spectator=false; player.deployed=true;
			player.onVehicle=null; player.onNaval=null; player.onCapital=null; player.capitalGun=null; player.useCast=null;
			player.onMG=null; player.onAT=null; player.onAA=null; player.onMortar=null; player.onBattery=null;
			player.grabAction=null; player.resupplyCd=0; player.vel.set(0,0,0); };
		// ① 箱边 (2.6m 内) ⇒ 补弹 (旧版这里被跳海/上炮吃掉)
		reset(); player.pos.set(cr.x,s.pos.y+s.deck.y,cr.z+0.5);
		tryInteract();
		const grabbed=player.grabAction&&player.grabAction.kind==='ammo';
		const onDeckAfterGrab=!!capDeckOf(player.pos.x,player.pos.z);
		// ② 同点 resupplyCd>0 ⇒ 顺栈: 无炮位/无停机 ⇒ 跳海 (该点距护栏夹持线 ~0.7m < 2.2 ⇒ 必可跳)
		reset(); player.resupplyCd=9; player.pos.set(cr.x,s.pos.y+s.deck.y,cr.z+0.5);
		tryInteract();
		const jumped=!capDeckOf(player.pos.x,player.pos.z)&&!player.onVehicle&&!player.capitalGun;
		// ③ 炮位接管圈 (本舰 aa 座圈旁) ⇒ 上炮; 再按 F ⇒ 下炮
		reset();
		const aw=capToWorld(s,6.6,46,new THREE.Vector3());
		player.pos.set(aw.x,s.pos.y+s.deck.y,aw.z);
		tryInteract();
		const mounted=player.capitalGun&&player.capitalGun.ship===s;
		if(mounted){ tryInteract(); }
		const released=mounted&&!player.capitalGun;
		// ④ 提示层同账: 箱边提示"补充弹药", 舷缘提示"跳海"。读前先清 innerHTML (hide 分支不清文本) 并
		//   清 10Hz 节流签名 (updateInteractHint 按状态指纹节流, 指纹不含位置 ⇒ 沙箱里 nowT 不前进时
		//   第二次调用会被 0.1s 门短路 —— 游戏内每帧跑、时间前进, 无此问题; 探针是单发调用)。
		let hintCrate='',hintJump='';
		try{
			updateInteractHint._sig=null; updateInteractHint._t=-9;
			reset(); player.pos.set(cr.x,s.pos.y+s.deck.y,cr.z+0.5);
			document.getElementById('interact').innerHTML='';
			updateInteractHint();
			hintCrate=String(document.getElementById('interact').innerHTML||'');
			updateInteractHint._sig=null; updateInteractHint._t=-9;
			reset(); const ew=capToWorld(s,8.3,0,new THREE.Vector3());
			player.pos.set(ew.x,s.pos.y+s.deck.y,ew.z);
			document.getElementById('interact').innerHTML='';
			updateInteractHint();
			hintJump=String(document.getElementById('interact').innerHTML||'');
		}catch(e){ hintCrate='ERR '+e.message; }
		return {grabbed,onDeckAfterGrab,jumped,mounted,released,hintCrate,hintJump};
	})()`);
	judge(!t4.__err&&t4.grabbed&&t4.onDeckAfterGrab,'T4① 甲板上箱边按 F = 补充弹药 (人不离舰/不上炮)',
		t4.__err||'旧版甲板分支无条件 return ⇒ 补弹不可达, F 全被上炮/跳海吃掉');
	judge(!t4.__err&&t4.jumped,'T4② 补弹冷却中按 F = 顺栈到跳海 (舷缘判据放行)',t4.__err||'');
	judge(!t4.__err&&t4.mounted&&t4.released,'T4③ 炮位接管圈按 F = 上炮/再按 = 下炮 (补弹不抢炮位语义)',t4.__err||'');
	judge(!t4.__err&&t4.hintCrate.indexOf('补充弹药')>=0,'T4④a 提示层箱边 = "F 补充弹药" (与分派同账)',t4.hintCrate.slice(0,60));
	judge(!t4.__err&&t4.hintJump.indexOf('跳海')>=0,'T4④b 提示层舷缘 = "F 跳海"',t4.hintJump.slice(0,60));
}

// ══════ T5: ironbottom 烟囱 + 甲板箱计数 ══════
say('');
const B2=boot(13);
if(B2.loadErrors.length){
	judge(false,'烟囱: ironbottom 全脚本 LOAD 不报错',B2.loadErrors.map(e=>e.file+' → '+e.err).join('  ||  ').slice(0,600));
}else{
	const t5=NT(B2.ctx,`({
		camp:CAMPAIGN.id, ships:capitalShips.length, flags:FLAGS.length,
		deckCrates:AMMO_CRATES.filter(c=>c.ship!==undefined).length,
		baseShips:CAMPAIGN.capital.filter(c=>c.base).length,
		lowFlags:FLAGS.filter(f=>f.poleH&&f.poleH<7).length
	})`);
	judge(t5.camp==='ironbottom'&&t5.ships===2&&t5.flags===6&&t5.deckCrates===8,'烟囱: ironbottom 载入 (2 舰 6 旗 8 箱)',JSON.stringify(t5));
	judge(t5.lowFlags===2,'低旗 ×2 (铁底湾前主炮两军各一) 已生效',JSON.stringify(t5));
	const t5b=NT(B2.ctx,`(()=>{
		// 基地箱锚位实查: 两舰的 baseCrateL 锚处必须真有一只箱 (局部 ±0.05)
		let hit=0;
		for(let si=0;si<capitalShips.length;si++){
			const s=capitalShips[si], C=CAMPAIGN.capital[si]; if(!C.baseCrateL) continue;
			for(const c of AMMO_CRATES){
				if(c.ship!==si) continue;
				const dx=c.x-s.homeX, dz=c.z-s.homeZ, cc=Math.cos(s.homeYaw), nn=Math.sin(s.homeYaw);
				const lx=dx*cc-dz*nn, lz=dx*nn+dz*cc;
				if(Math.abs(lx-C.baseCrateL[0])<0.05&&Math.abs(lz-C.baseCrateL[1])<0.05){ hit++; break; }
			}
		}
		return {hit};
	})()`);
	judge(t5b.hit===2,'基地箱落位 = baseCrateL 锚 (两舰各一, 不再埋进甲板室)',t5b.hit+'/2');
}

say('');
say('────────────────────────────────────────');
say('结果: '+nPass+' 通过 / '+nFail+' 失败');
fs.writeFileSync(path.join(OUTDIR,'navalround5-report.txt'),OUT.join('\n'));
process.exit(nFail?1:0);
