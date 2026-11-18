// ─────────────────────────────────────────────────────────────
// dev/verify-parity-20261103.js —— 2026-11-03 三问批验收
//   ① Bot 接入打断网 (受创>25 打断 换弹/举雷/包扎/上炮前摇/补给贴箱) + 弹药账对齐
//     (开火扣槽位账 / 换弹真扣备弹 / 弹尽寻补给·搜刮保底) + 真附身呈现层全量镜像
//     (视模式换弹动画/读条/开火后坐/举雷/包扎; finishReload 镜像让位; 包扎镜像不吃玩家账)
//   ② 固定火力点命中体 parity (玩家迫击炮位蹲姿 = Bot 同规; MG/AT/AA 站姿同规)
//     —— 减伤结论: 全库无 gunner 减伤乘区, "打不动"=炮体圆柱挡弹+压制, 玩家/同规 (交付文档留档)
//   ③ 丧尸追击双 bug: 脱见宽限 0s (nowT-(zTgt?0:_zSeenT) 恒真) → 真 6s;
//     同目标重锁定门 (zTgt!==best 前置) 摘除 + 视线保持刷新 aggroT
//
// 用法: node dev/verify-parity-20261103.js [--neg]
//   --neg = 阴性对照: 装载前把本批核心改动按单行锚还原成旧写法, 行为判据必须报红 (15 处补丁)。
// 口径: 与 verify-nadecancel-20261025 同款 boot (真 three + index.html 全脚本链 + startBtn 开局);
//   nowT 是墙钟秒 ⇒ 丧尸宽限判据 (_zSeenT 相对 nowT 取样) 在同步 tick 驱动下天然确定。
// ─────────────────────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const NEG=process.argv.includes('--neg');
const OK=[],BAD=[];
function assert(name,cond,detail){ (cond?OK:BAD).push(name); console.log(`  ${cond?'✓':'✗'} ${name}${detail?'  '+detail:''}`); }
function section(t){ console.log('\n══ '+t+' ══'); }
const SRC=f=>fs.readFileSync(path.join(root,f),'utf8');

// ── 阴性对照 (单行锚; CRLF 文件一律单行, 不带 \n) ──
const PATCHES=[
 ['js/14-bots.js',"if(amt>READBAR_DMG_GATE){","if(false){"],                                          // 打断门退场
 ['js/14-bots.js',"const _take=Math.min(_need,_s0.reserve);","const _take=_need;"],                    // 备弹无限化退场
 ['js/14-bots.js',"if(this.slots&&this.slots[0]) this.slots[0].mag=this.mag;   // 弹药账对齐 (2026-11-03): 槽位账随开火同步 (附身面板实时读数)",""], // 槽位同步退场
 ['js/14-bots.js',"else this.drySeekSupply();","else ;"],                                              // 弹尽寻补给退场
 ['js/14-bots.js',"if(this.state==='toSupply') return;   // 弹尽补给承诺期 (2026-11-03): decide 不抢状态, 放弃条件在执行段与 damage 门里",""],
 ['js/25-zombies.js',"if(this.brain!=='chase') this.brain='chase';","if(this.zTgt!==best&&this.brain!=='chase') this.brain='chase';"], // 同目标重锁门复活
 ['js/25-zombies.js',"  } else if(this.brain==='chase'&&nowT-this._zSeenT>6){","  } else if(this.brain==='chase'&&nowT-(this.zTgt?0:this._zSeenT)>6){"], // 0s 宽限复活
 ['js/25-zombies.js',"if(this.zTgt===best) this.aggroT=nowT+ZCFG.aggroHold;   // 视线保持=刷新仇恨窗 (否则 aggroT 到期先在 zTgt 分支掉, 靠 0.22s 后的重锁续命)",""],
 ['js/20-player.js',"function svHostActionMirror(h){","function svHostActionMirror(h){ return;"],      // 镜像整层退场
 ['js/24-main.js',"if((player.alive||player.specViewHost)&&player.curW","if(player.alive&&player.curW"],
 ['js/13-combat.js',"player&&player.specViewHost&&player.specViewHost===shooter","player&&!player.specView&&player.specViewHost&&player.specViewHost===shooter"], // 开火反馈退回"仅调试附身"
 ['js/18-game.js',"if(this.specViewHost) return;   // ★2026-11-03 真附身: 换弹镜像是宿主账 (Bot 换弹完成时已自账写满), 玩家侧结算让位防跨账写",""],
 ['js/10-viewmodel.js',"const interrupted=!VM.mirrorHost&&player.bandaging<=0&&bk<0.9;","const interrupted=player.bandaging<=0&&bk<0.9;"], // 包扎镜像旁路退场
 ['js/20a-seats.js',"p.crouch=true; p.prone=false;   // 命中体 parity (2026-11-03): Bot 迫击炮手蹲姿小命中体 (14-bots), 玩家旧版站着 = 挨打面更大, 同规补齐 (mountMortar 已盖, 此处逐帧兜底)",""],
 ['js/20-player.js',"player.crouch=true; player.prone=false;   // 命中体 parity (2026-11-03): Bot 迫击炮手蹲姿小命中体 (14-bots), 玩家旧版站着 = 比 Bot 更大的挨打面, 同规补齐",""],
];
const PATCH_MAP={};
if(NEG) for(const [f,from,to] of PATCHES){
 const s=PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f);
 if(s.indexOf(from)<0) throw new Error('阴性对照锚点未找到: '+f+' :: '+from.slice(0,70));
 PATCH_MAP[f]=s.split(from).join(to);
}
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f));

// ── ① 源码防回退 ──────────────────────────────────────────────
section('① 源码防回退 (修好的写法在 / 旧写法不在)');
{
const s14=srcOf('js/14-bots.js');
assert('14 Bot.damage 打断门 (>25: 换弹/举雷前摇/包扎/上炮前摇/补给贴箱, 取消不结算)',
 s14.includes('if(amt>READBAR_DMG_GATE){')
 &&s14.includes("if((this.state==='nade'||this.state==='atnade')&&this.nadeAnimT>0){ if(this.hp<=0) dropHeldNade(this); this.nadeAnimT=0; this.state='combat'; }")   // 2026-11-03 死亡掉雷批在行内插入致命掉雷, 锚跟码
 &&s14.includes('if(this.supplyT>0) this.supplyT=0;')
 &&s14.includes('if(this.emCast){ if(this.emCast.g&&this.emCast.g.user===this) this.emCast.g.user=null; this.emCast=null; }'));
assert('14 换弹真扣备弹 (主武器+手枪双账, 槽位三账同步写)',
 s14.includes('const _take=Math.min(_need,_s0.reserve);')&&s14.includes('const _take=Math.min(_need,_s1.reserve);')
 &&s14.includes('_s0.mag=this.mag; _s0.reserve=Math.max(0,_s0.reserve-_take);')
 &&s14.includes('_s1.mag=this.pMag; _s1.reserve=Math.max(0,_s1.reserve-_take);'));
assert('14 开火槽位账同步 (aimShot 主/副 + AT 枪 + 迫击炮 + 舰船反坦克枪 ≥4 处)',
 (s14.match(/this\.slots\[0\]\.mag=this\.mag/g)||[]).length>=3
 &&s14.includes('if(this.slots&&this.slots[1]) this.slots[1].mag=this.pMag;')
 &&s14.includes('if(b.slots&&b.slots[0]) b.slots[0].mag=b.mag;'));
assert('14 换弹起手全部过 canReload 门 (备弹尽不再起永久 reloadT 循环)',
 (s14.match(/canReload\(\)/g)||[]).length>=6
 &&s14.includes('canReload(){'));
assert('14 弹尽寻补给 (drySeekSupply: 箱≤45m / 舰箱跳过 / 搜刮保底 10s) + toSupply 执行段 + decide 承诺门',
 s14.includes('drySeekSupply(){')&&s14.includes("if(ac.ship) continue;")
 &&s14.includes("else if(this.state==='toSupply'){")
 &&s14.includes('for(const s of this.slots){ s.reserve=s.def.reserve+s.def.mag; }')
 &&s14.includes("if(this.state==='toSupply') return;"));
assert('14 搜刮保底计时 (update 内 dt 驱动, 仍双尽才补)',
 s14.includes('if(this._dryScavT<=0&&this.slots&&this.slots[0]&&this.slots[0].reserve<=0&&this.mag<=0) this.slots[0].reserve=Math.ceil(this.def.mag);'));

const s25=srcOf('js/25-zombies.js');
assert('25 丧尸: 同目标重见也回 chase (旧 zTgt!==best 前置已摘)',
 s25.includes("if(this.brain!=='chase') this.brain='chase';")
 &&!s25.includes("if(this.zTgt!==best&&this.brain!=='chase') this.brain='chase';"));
assert('25 丧尸: 脱见宽限真 6s (旧 (zTgt?0:_zSeenT) 恒真写法已摘)',
 s25.includes("} else if(this.brain==='chase'&&nowT-this._zSeenT>6){")
 &&!s25.includes('nowT-(this.zTgt?0:this._zSeenT)'));
assert('25 丧尸: 视线保持刷新 aggroT (重锁目标即续仇恨窗)',
 s25.includes('if(this.zTgt===best) this.aggroT=nowT+ZCFG.aggroHold;'));

const s20=srcOf('js/20-player.js');
assert('20 specViewPossess 两模式统一换装 (视模式不再收枪, 旧 if(!player.specView) 门已摘)',
 s20.includes('if(typeof VM!==\'undefined\') VM.mirrorHost=false;         // 镜像标记跨目标清账 (换附身对象时旧镜像不得延续)')
 &&s20.includes('★2026-11-03 两模式统一'));
assert('20 svHostActionMirror 单源在场 + 两分支接线 (调试/视模式)',
 s20.includes('function svHostActionMirror(h){')
 &&(s20.match(/svHostActionMirror\(h\);/g)||[]).length>=2);
assert('20 两条 detach 链收镜像账 (nadeHeld+mirrorHost)',
 (s20.match(/player\.nadeHeld=false; if\(typeof VM!=='undefined'\) VM\.mirrorHost=false;/g)||[]).length>=2);
assert('20 附身候选排除丧尸 (Zombie extends Bot 同在 soldiers)',
 s20.includes('if(!b.alive||b.zombie||b.onVehicle||b.onNaval) continue;')   // (2026-11-10 跟码: capCrew 项随大舰子系统下架摘除)
 &&s20.includes('const list=soldiers.filter(b=>b.alive&&!b.zombie&&!b.onVehicle&&!b.onNaval);'));
assert('20 玩家炮位命中体 parity: MG/AT/AA 站姿 + 迫击炮蹲姿 + 下炮还原',
 (s20.match(/player\.crouch=false; player\.prone=false;   \/\/ 命中体 parity/g)||[]).length===3
 &&s20.includes('player.crouch=true; player.prone=false;   // 命中体 parity (2026-11-03): Bot 迫击炮手蹲姿小命中体')
 &&s20.includes('releaseEmpl(m3,true); player.onMortar=null; player.crouch=false; VM.root.visible=true;'));

assert('24 updateViewModel 门放宽到真附身 (specViewHost)',
 srcOf('js/24-main.js').includes('if((player.alive||player.specViewHost)&&player.curW'));
assert('13 出膛反馈钩子放开到视模式附身 (旧 !player.specView 门已摘)',
 srcOf('js/13-combat.js').includes('player&&player.specViewHost&&player.specViewHost===shooter')
 &&!srcOf('js/13-combat.js').includes('!player.specView&&player.specViewHost'));
assert('18 finishReload 镜像让位 (specViewHost 时直接 return)',
 srcOf('js/18-game.js').includes('if(this.specViewHost) return;'));
const s10=srcOf('js/10-viewmodel.js');
assert('10 镜像让位三件: 包扎打断旁路 / 走完清 mirrorHost / 出真雷兜底门',
 s10.includes('const interrupted=!VM.mirrorHost&&player.bandaging<=0&&bk<0.9;')
 &&s10.includes('VM.state=\'idle\'; vmSndFlags={}; player.barArmKey=null; VM.mirrorHost=false; player.finishReload();')
 &&s10.includes('if(k>0.5&&!VM.mirrorHost) vmPlayOnce(\'nadeThrow\',()=>player.releaseNade());'));
const s22=srcOf('js/22-hud.js');
assert('22 读条门放宽到真附身 + 宿主镜像两条 (举雷/包扎) + ✕ 附身守卫',
 s22.includes('const rb=((player.alive||player.specViewHost)&&!hudBlocked)')
 &&s22.includes("{lab:t2('宿主 · 举雷 …'),k:1}")
 &&s22.includes("{lab:t2('宿主 · 包扎 …')")
 &&s22.includes('if(player.specViewHost) return; player.cancelReadBar(\'已取消\');'));
assert('22 附身投掷物行带宿主雷账 (旧"只显绷带"口径已扩)',
 s22.includes("_hv.nades>0?' · '+t2('手雷 ×{0}',_hv.nades):''"));
assert('20a 玩家迫击炮位逐帧蹲姿兜底 (updatePlayerMortar)',
 srcOf('js/20a-seats.js').includes('p.crouch=true; p.prone=false;   // 命中体 parity (2026-11-03)'));

// 版本戳 (随批升 20261118e: index.html 全量 + __sfStyleVer + _game_files 全行)
const idx=SRC('index.html'), gf=SRC('dev/_game_files.txt');
const stamps=[...idx.matchAll(/20261118e/g)].length;
assert('版本戳 20261118e: index.html 全量唯一 + __sfStyleVer + _game_files 全行 (2026-11-10 海战移除批判据跟码)',
 stamps>=44&&idx.includes("window.__sfStyleVer='20261118e';")
 &&gf.split(/\r?\n/).filter(l=>l.includes('?v=20261118e')).length===45
 &&!idx.includes('20261102b')&&!gf.includes('20261102b'));
}

// ── 沙箱装载 (真 three; 与 verify-nadecancel 同款 boot + 全 index.html 脚本链) ─────
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
function boot(campIdx,zsub){
	const T=loadRealTHREE();
	T.WebGLRenderer=class{ constructor(){ this.domElement=Object.assign(document.createElement('canvas'),{width:0,height:0}); this.shadowMap={enabled:false,type:0,autoUpdate:true};
		this.setSize=()=>{}; this.setPixelRatio=()=>{}; this.render=()=>{}; this.clear=()=>{}; this.clearDepth=()=>{};
		this.outputColorSpace=''; this.setClearColor=()=>{}; this.setAnimationLoop=()=>{}; } };
	const stub=require('./_bootstub.js');
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
	createBufferSource(){ return {buffer:null,loop:false,playbackRate:AP(),start(){},stop(){},connect(){}}; }
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
	ctx.window=window; ctx.globalThis=ctx;
	ctx.setTimeout=(f)=>{ try{ f(); }catch(e){ console.log('  [异步桩] '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | ')); } return 0; };
	ctx.clearTimeout=()=>{};
	ctx.localStorage={_s:{sf_campaign:String(campIdx),sf_pseed:'424242',...(zsub?{sf_zsub:zsub}:{})},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
	for(const f of FILES){ let code=srcOf(f); vm.runInContext(code,ctx,{filename:f}); }
	return {ctx,T};
}
let IDX=-1, IPG=-1;
{ const c0=boot(0); IDX=vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="normandy")',c0.ctx);
IPG=vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="procgen")',c0.ctx); }

function bootStart(campIdx,zsub,label){
const {ctx}=boot(campIdx,zsub);
const G=s=>vm.runInContext(s,ctx,{timeout:300000});
let err=null;
try{ G("document.getElementById('startBtn').onclick();"); }catch(e){ err='start: '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); }
if(!err){ try{ G('if(!player.alive||!player.deployed) deployPlayer();'); }catch(e){ err='deploy: '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); } }
if(!err) try{ G('for(const s of soldiers) s.protUntil=0; player.protUntil=0;'); }catch(e){}
// 探针豁免: 非玩家 Bot 平移 +800m (感知圈外), 不改 alive/fieldCount
if(!err) try{ G('for(const s of soldiers){ if(!s.isPlayer&&!s.zombie){ s.pos.x+=800; s.pos.z+=800; s.pos.y=heightAt(s.pos.x,s.pos.z); if(s.path) s.path.length=0; } }'); }catch(e){}
assert(label+' 开局+部署',!err&&G('player.alive')===true,err||'');
return {ctx,G};
}

// ── ② Bot 弹药账对齐 + 打断网 + 弹尽补给 (真沙箱) ──
section('② Bot 弹药账/打断网/弹尽补给 (normandy 真开局)');
const A=bootStart(IDX,null,'②A 开局+部署 (normandy)');
{
const r=A.G(`(()=>{
const out={};
var b=new Bot(0,0,'弹账'); b.spawn(); b.protUntil=0; b.target=null;
const atk={team:1,pos:new THREE.Vector3(b.pos.x+3,0,b.pos.z+3)};
// 开火槽位账同步: aimShot 主武器
b.mag=3; b.slots[0].mag=3; b.aimShot(new THREE.Vector3(b.pos.x+6,b.pos.y+1.2,b.pos.z+2));
out.a1=(b.mag===2&&b.slots[0].mag===2);
// 手枪分支
if(b.slots[1]){ b.pMag=5; b.slots[1].mag=5; b.aimShot(new THREE.Vector3(b.pos.x+6,b.pos.y+1.2,b.pos.z+2),b.slots[1].def);
out.a2=(b.pMag===4&&b.slots[1].mag===4); } else out.a2='n/a';
// 换弹真扣备弹 (备弹充足 → 回满; 槽位三账同步)
b.mag=1; b.slots[0].mag=1; b.slots[0].reserve=200; b.reloadT=0.05;
for(let i=0;i<30;i++) b.update(1/60);
const need=b.def.mag-1;
out.a3=(b.mag===b.def.mag&&b.slots[0].mag===b.mag&&b.slots[0].reserve===200-need);
// 打断网: >25 打断 换弹/包扎/举雷前摇/上炮前摇, ≤25 不断 (每发前回血 — 打断门判的是 amt, 不叠死亡)
b.hp=100; b.reloadT=2; b.damage(26,atk,false); out.b1=(b.reloadT===0);
b.hp=100; b.reloadT=2; b.damage(25,atk,false); out.b2=(b.reloadT===2); b.damage(6,atk,false); out.b3=(b.reloadT===2);
b.hp=100; b.bandageT=2.2; b.bandages=2; b.damage(26,atk,false); out.b4=(b.bandageT===0&&b.bandages===2);
b.hp=100; b.state='nade'; b.nadeAnimT=0.5; b.nades=2; b.damage(26,atk,false);
out.b5=(b.state==='combat'&&b.nadeAnimT===0&&b.nades===2);
b.hp=100; b.emCast={kind:'mg',g:{user:b},t:0,dur:0.9}; b.damage(26,atk,false);
out.b6=(b.emCast===null);
// canReload 门: 备弹尽不再起 reloadT (无永久循环)
b.mag=0; b.slots[0].reserve=0; b.reloadT=0; b.update(1/60);
out.c1=(b.reloadT<=0);
// 弹尽寻补给: 不变量 = 要么有 supplyGo(箱) 要么搜刮保底
b.supplyGo=null; b._dryScavT=0; b.drySeekSupply();
out.c2=!!(b.supplyGo||b._dryScavT>0);
out.c3={go:!!b.supplyGo,scav:b._dryScavT};
return out; })()`);
assert('②-1 开火扣槽位账 (主武器 mag/slots[0].mag 同步)',r.a1===true,JSON.stringify(r.a1));
assert('②-2 开火扣槽位账 (手枪 pMag/slots[1].mag 同步)',r.a2===true,String(r.a2));
assert('②-3 换弹真扣备弹 (mag 回满 / 槽位 mag 同步 / reserve 扣 need)',r.a3===true,JSON.stringify(r.a3));
assert('②-4 damage>26 打断换弹 (reloadT 清零)',r.b1===true);
assert('②-5 damage=25 与刮伤 6 不断 (门槛判据)',r.b2===true&&r.b3===true);
assert('②-6 damage>25 打断包扎 (bandageT 清零·绷带不结算)',r.b4===true);
assert('②-7 damage>25 打断举雷前摇 (回 combat·雷不消耗)',r.b5===true,JSON.stringify(r.b5));
assert('②-8 damage>25 打断上炮前摇 (emCast 清·炮位 user 交还)',r.b6===true);
assert('②-9 备弹尽不再起 reloadT (canReload 门, 无永久换弹循环)',r.c1===true);
assert('②-10 弹尽必有出路 (supplyGo 或 搜刮保底)',r.c2===true,JSON.stringify(r.c3));
}

// ── ②B 补给两条支路 (贴箱补给 / 搜刮保底) ──
section('②B 补给两支路');
{
const r=A.G(`(()=>{
const out={};
var b=new Bot(0,0,'补给'); b.spawn(); b.protUntil=0; b.target=null;
// 支路一: 搜刮保底 (把 _dryScavT 顶到 0.05, update 驱动到期 → reserve=一个弹匣 → 自然 reload 回满)
b.mag=0; b.slots[0].reserve=0; b.supplyGo=null; b._dryScavT=0.05;
for(let i=0;i<600&&!b.reloadT;i++) b.update(1/60);
for(let i=0;i<600&&b.reloadT>0;i++) b.update(1/60);
out.s1={mag:b.mag,res:b.slots[0].reserve,full:b.mag===b.def.mag&&b.slots[0].reserve===0};
// 支路二: 贴箱补给 (有箱时: drySeekSupply → toSupply → 贴箱 1.2s → reserve 顶到 上限+一匣 → 自然 reload)
const cr=(typeof AMMO_CRATES!=='undefined')?AMMO_CRATES.filter(c=>!c.ship):[];
if(cr.length){
b.mag=0; b.slots[0].reserve=0; b.supplyGo=null; b._dryScavT=0; b.reloadT=0;
// 探针卫生 (2026-11-04 偶发红归因): 支路一 1200 拍里 Bot 会随机去扛机枪/迫击炮位 (mgUse 等置位),
//   drySeekSupply 开头的 if(this.mgUse||this.mortUse||this.empUse||this.batUse||this.emCast) return
//   早退 ⇒ 支路二 noGo —— 支路二测的是补给认箱, 扛炮旗必须与本行同批清账 (交还 g.user 防悬挂)。
if(b.emCast&&b.emCast.g&&b.emCast.g.user===b) b.emCast.g.user=null;
if(b.mgUse&&b.mgUse.g&&b.mgUse.g.user===b) b.mgUse.g.user=null;
if(b.mortUse&&b.mortUse.g&&b.mortUse.g.user===b) b.mortUse.g.user=null;
if(b.empUse&&b.empUse.g&&b.empUse.g.user===b) b.empUse.g.user=null;
if(b.batUse&&b.batUse.g&&b.batUse.g.user===b) b.batUse.g.user=null;
b.mgUse=null; b.mortUse=null; b.empUse=null; b.batUse=null; b.emCast=null;
b.pos.set(cr[0].x+30,heightAt(cr[0].x+30,cr[0].z),cr[0].z); b.path=null;
b.drySeekSupply();
out.s2go=!!b.supplyGo;
if(b.supplyGo){
b.pos.set(cr[0].x+0.8,heightAt(cr[0].x+0.8,cr[0].z+0.5),cr[0].z+0.5); b.path=null;
for(let i=0;i<300&&b.state==='toSupply';i++) b.update(1/60);
out.s2={state:b.state,res:b.slots[0].reserve,ok:b.slots[0].reserve===b.slots[0].def.reserve+b.slots[0].def.mag};
for(let i=0;i<600&&b.reloadT>0;i++) b.update(1/60);
out.s2full=(b.mag===b.def.mag&&b.slots[0].reserve===b.slots[0].def.reserve);
}else out.s2={state:'noGo',res:b.slots[0].reserve,ok:false};
}else{ out.s2go='no-crates'; out.s2={ok:'skip'}; out.s2full='skip'; }
return out; })()`);
assert('②-11 搜刮保底: 10s 到期补一个弹匣备弹并自然换弹回满 (reserve 归零)',r.s1.full===true,JSON.stringify(r.s1));
if(r.s2go==='no-crates'){ console.log('  ⊘ ②-12/13 跳过 (本图无岸上弹药箱 — 不变量已由 ②-10 覆盖)'); }
else{
assert('②-12 贴箱补给: drySeekSupply 认箱 + 补满 备用上限+一匣 (与玩家 grab 同账)',r.s2go===true&&r.s2.ok===true,JSON.stringify(r.s2));
assert('②-13 补给后自然换弹回满 (reserve 回到上限)',r.s2full===true,JSON.stringify({mag:0,full:r.s2full}));
}
}

// ── ③ 玩家固定火力点命中体 parity ──
section('③ 玩家炮位命中体 parity (蹲/站与 Bot 同规)');
{
const r=A.G(`(()=>{
const out={};
player.crouch=false; player.prone=false; player.onMortar=null;
mountMortar({user:null,face:0,x:0,z:0,tube:{rotation:{x:0.6}},grp:{rotation:{y:0}},cd:1});
out.m1=(player.crouch===true&&player.prone===false&&player.onMortar!==null);
// updatePlayerMortar 逐帧兜底 (mount 后被人置 false 也会拉回)
player.onMortar={user:player,face:0,x:0,z:0,cd:0.5,tube:{rotation:{x:0.6}},grp:{rotation:{y:0}}};
player.crouch=false; updatePlayerMortar(0.016);
out.m2=(player.crouch===true);
player.onMortar=null; player.crouch=true;
mountMG({user:null,face:0,x:0,z:0});
out.m3=(player.crouch===false&&player.onMG!==null); player.onMG=null;
player.crouch=true; mountAT({user:null,face:0,x:0,z:0});
out.m4=(player.crouch===false&&player.onAT!==null); player.onAT=null;
player.crouch=true; mountAA({user:null,face:0,x:0,z:0});
out.m5=(player.crouch===false&&player.onAA!==null); player.onAA=null;
player.crouch=false; player.prone=false;
return out; })()`);
assert('③-1 mountMortar 玩家蹲姿 (与 Bot 迫击炮手同规小命中体)',r.m1===true);
assert('③-2 updatePlayerMortar 逐帧蹲姿兜底',r.m2===true);
assert('③-3 mountMG/AT/AA 站姿 (清附身上炮前的蹲姿, 与 Bot 同规)',r.m3===true&&r.m4===true&&r.m5===true,JSON.stringify([r.m3,r.m4,r.m5]));
}

// ── ④ 丧尸: 同目标重锁定 / 6s 宽限 / aggroT 刷新 (丧尸局: uniformMats[2]/TEAM_FACTION[2] 按需挂档) ──
section('④ 丧尸追击双 bug (procgen·solo 真开局, nowT=墙钟 ⇒ 宽限判据确定)');
{
const Z=bootStart(IPG,'solo','④Z 开局+部署 (procgen solo)');
// 先扫一个 5m 通视净空点 (occBlocked+raycastWorld+crop 三重门, 与感知同口径)
Z.G(`var __spot=null;(function(){for(let k=0;k<120;k++){const x=BASES[0].x+((k%10)-5)*7,z=BASES[0].z+Math.floor(k/10)*7-35;
if(occBlocked(x,z)||occBlocked(x+5,z+0.3))continue;
const o=new THREE.Vector3(x,heightAt(x,z)+1.5,z),tv=new THREE.Vector3(x+5,heightAt(x+5,z+0.3)+1.4,z+0.3);
const d=5.2,dir=new THREE.Vector3((tv.x-o.x)/d,(tv.y-o.y)/d,(tv.z-o.z)/d);
if(raycastWorld(o,dir,d-0.3))continue;
if(CROP_FIELDS.length&&cropBlocksLOS(o.x,o.y,o.z,tv.x,tv.y,tv.z))continue;
__spot={x,z};return;}})();`);
const hasSpot=Z.G('!!__spot');
if(!hasSpot){ console.log('  ⊘ ④ 跳过 (基地 35m 带内扫不到通视净空点)'); }
else{
const r=Z.G(`(()=>{
const out={};
player.spectator=true;   // 探针豁免: 玩家退出丧尸感知候选 (部署位就在测试带旁, 否则宽限判据会被"看见玩家"续命)
// (a) 同目标重锁定: brain 被丢成 shamble、zTgt 仍是可见目标 → 重见即回 chase + aggroT 刷新
var tb=new Bot(0,0,'靶标'); tb.spawn(); tb.protUntil=0; tb.pos.set(__spot.x+5,heightAt(__spot.x+5,__spot.z+0.3),__spot.z+0.3);
var z1=new Zombie(__spot.x,__spot.z,'walker'); z1.pos.set(__spot.x,heightAt(__spot.x,__spot.z),__spot.z);
z1.brain='shamble'; z1.zTgt=tb; z1.aggroT=nowT-1; z1.zPerT=0;
for(let i=0;i<25;i++) z1.update(1/60);
out.a={brain:z1.brain,aggroFresh:z1.aggroT>nowT+1};
// (b) 宽限: 远处 (>visR, <46m 保持 zTgt) 目标 — 3s 宽限内不掉, 7s 后掉
//     (第二块净空点: 与 (a) 组相距 70m+ — 否则 z2 会看见 a 组的 tb, 仇恨被"别人"续上)
var __s2=null;(function(){for(let k=0;k<120;k++){const x=__spot.x+70+((k%10)-5)*7,z=__spot.z-70+Math.floor(k/10)*7;
if(occBlocked(x,z))continue;__s2={x,z};return;}})();
if(!__s2) __s2={x:__spot.x+70,z:__spot.z-70};
var fb=new Bot(0,0,'远靶'); fb.spawn(); fb.protUntil=0; fb.pos.set(__s2.x+35,heightAt(__s2.x+35,__s2.z),__s2.z);   // 35m: >walker视距28 (不可见) 且 <46 (zTgt 保持圈)
var z2=new Zombie(__s2.x,__s2.z,'walker'); z2.pos.set(__s2.x,heightAt(__s2.x,__s2.z),__s2.z);
z2.brain='chase'; z2.zTgt=fb; z2.aggroT=nowT+999; z2.zPerT=0;
z2._zSeenT=nowT-3; for(let i=0;i<30;i++) z2.update(1/60);
out.b1=z2.brain;
z2._zSeenT=nowT-7; z2.brain='chase'; for(let i=0;i<30;i++) z2.update(1/60);
out.b2=z2.brain;
out.visR=ZCFG.sight;
return out; })()`);
assert('④-1 同目标重见回 chase (旧 zTgt!==best 门下永远游荡, 炮位 gunner 被丢即永久忽视)',
 r.a.brain==='chase',JSON.stringify(r.a));
assert('④-2 重锁即刷新 aggroT (视线保持=仇恨续窗)',r.a.aggroFresh===true);
assert('④-3 脱见 3s (<6s 宽限) 不掉 chase',r.b1==='chase',`brain=${r.b1} visR=${r.visR}`);
assert('④-4 脱见 7s (>6s 宽限) 掉回 shamble (宽限不是无限)',r.b2==='shamble',`brain=${r.b2}`);
}
}

// ── ⑤ 真附身呈现层: 动作镜像 / finishReload 让位 / 开火反馈 / 包扎旁路 ──
section('⑤ 真附身镜像 (svHostActionMirror / finishReload / 出膛反馈)');
{
const r=A.G(`(()=>{
const out={};
const host=new Bot(0,0,'宿主'); host.spawn(); host.setClass(0); host.protUntil=0; host.target=null;   // 固定步枪兵 (随机兵种可能抽到 rocket def.mag=1, 令"mag=2 未满"前置失真)
player.specView=true; player.alive=false; player.spectator=true; player.specViewHost=host;
VM.state='idle'; VM.stateT=0; VM.stateDur=0;
// (a) 换弹镜像触发
host.reloadT=1.5; host.slots[0].mag=2; svHostActionMirror(host);
out.a={state:VM.state,mirror:!!VM.mirrorHost,dur:VM.stateDur};
// (b) 宿主换弹被打断 (reloadT 归零而弹匣未满) → 镜像同帧收
host.reloadT=0; svHostActionMirror(host);
out.b={state:VM.state,mirror:!!VM.mirrorHost};
// (c) 举雷前摇镜像 + 离岗收
VM.state='idle'; host.state='nade'; host.nadeAnimT=0.6; svHostActionMirror(host);
out.c={state:VM.state,dur:VM.stateDur,held:player.nadeHeld};
host.state='combat'; host.nadeAnimT=0; svHostActionMirror(host);
out.d={state:VM.state,held:player.nadeHeld};
// (e) finishReload 镜像让位: 附身中不结算玩家账 (宿主槽位账由 Bot 自账管)
host.slots[0].mag=2; host.slots[0].reserve=90; player.curW=host.slots[0];
player.finishReload(); out.e1=host.slots[0].mag;
player.specViewHost=null; player.finishReload(); out.e2=host.slots[0].mag;
out.e2exp=2+Math.min(host.slots[0].def.mag-2,host.slots[0].reserve+host.slots[0].def.mag-host.slots[0].mag);
// (f) 出膛反馈对视模式附身生效 (旧 !player.specView 门下永远无反馈)
player.specViewHost=host;
vmEquip(host.slots[0].key,0); VM.state='idle';
const i0=VM.muzzleLight.intensity, r0=VM.recoilV;
fireBullet(host,new THREE.Vector3(host.pos.x,host.pos.y+1.6,host.pos.z),new THREE.Vector3(0.2,0,1).normalize(),host.def,null);
out.f={i1:VM.muzzleLight.intensity,kick:VM.recoilV>r0};
// (g) 包扎镜像旁路: VM bandage 态在附身中不被玩家 bandaging=0 掐断
vmEquip('kar98',0); VM.state='idle';
host.bandageT=2.2; svHostActionMirror(host); player.specViewHost=host;
for(let i=0;i<3;i++) updateViewModel(1/60,player);
out.g={state:VM.state,bandaging:player.bandaging};
// 还原 (后续无测试依赖附身态)
player.specViewHost=null; player.specView=false; player.alive=true; player.spectator=false;
VM.mirrorHost=false; if(typeof vmAbortAction==='function') vmAbortAction();
player.curW=player.slots[0];
return out; })()`);
assert('⑤-1 宿主换弹 → VM 换弹镜像 (state=reload·mirrorHost 置位·时长=reloadT)',
 r.a.state==='reload'&&r.a.mirror===true&&Math.abs(r.a.dur-1.5)<0.01,JSON.stringify(r.a));
assert('⑤-2 宿主换弹被打断 → 镜像同帧收 (回 idle·账清)',r.b.state==='idle'&&r.b.mirror===false,JSON.stringify(r.b));
assert('⑤-3 宿主举雷前摇 → VM 持雷哨兵镜像 (stateDur=999·nadeHeld 承接)',
 r.c.state==='nade'&&r.c.dur===999&&r.c.held===true,JSON.stringify(r.c));
assert('⑤-4 宿主掷出/被打断 → 哨兵收 (nadeHeld 还·不重放出真雷)',r.d.state!=='nade'&&r.d.held===false,JSON.stringify(r.d));
assert('⑤-5 finishReload 镜像让位: 附身中不动宿主槽位账, 脱离后恢复结算',
 r.e1===2&&r.e2===r.e2exp,`mag ${r.e1}→${r.e2} (期望 ${r.e2exp})`);
assert('⑤-6 出膛反馈在视模式附身生效 (枪口灯 2.2 + VM 后坐)',r.f.i1===2.2&&r.f.kick===true,JSON.stringify(r.f));
assert('⑤-7 包扎镜像不被玩家 bandaging=0 掐断 (VM bandage 态稳定走完)',
 r.g.state==='bandage'&&r.g.bandaging===0,JSON.stringify(r.g));
}

console.log('\n' + (BAD.length? `✗ ${BAD.length} 红 / ${OK.length} 绿` : `✓ 全绿 (${OK.length})`));
if(BAD.length){ process.exitCode=1; if(NEG) console.log('(阴性对照: 有红=判据具备分辨力)'); }
else if(NEG){ console.log('✗ 阴性对照全绿 = 判据空转!'); process.exitCode=1; }
