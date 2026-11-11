// ─────────────────────────────────────────────────────────────
// dev/verify-specweapon-20261104.js —— 附身武器镜像 + 第三人称手枪差异化 + 火箭筒换弹批 (2026-11-04) 验收
//   ① 附身武器镜像单源 (用户实报"附身看到宿主手持火箭筒却连续打出枪械子弹"):
//      svHostCurSlot (heldWpnKey 台账 → 宿主手里那把; 无台账退 slots[0] 兼容旧假宿主) +
//      svHostWeaponMirror (specViewPossess/specViewTick 两分支同源: curW 钉定 + VM 换枪, 门=idle/draw) +
//      svHostActionMirror 副武器分支 (pReloadT 镜像/打断同帧收, 主武器分支逐字不动) +
//      22-hud 弹药面板同源 + 13-combat fireRocket 出膛反馈钩 (旧版只挂枪械弹)。
//   ② 第三人称手枪差异化 (用户实报"突击兵切副武器外观无变化, 建模照搬冲锋枪"):
//      gunKindOf pistol 独立档 (旧版 return 'smg') + worldGunModel 三枪族造型 (colt/broom/nambu,
//      p38·tt33 同 colt 族) + GUN_MOUNT_BY_KIND/PRONE.pistol 独立挂点 (a21-j 全量复测定位: 站姿
//      零接触/匍匐双臂前伸, ④′ 双手 L=R=0) + CARRIED_FWD.pistol=0.06 + 无 GUN_HOLD_BY_KIND.pistol
//      表项 = 双手持枪走默认机械 + armIK (用户裁定)。
//   ③ 火箭筒换弹 2/3: bazooka 3.6→2.4 / schreck 3.8→2.5 (WPN_DEFS.reload 单源; Bot 侧 fireT=3.6
//      再射击间隔是另一本账, 不随动)。garand 2.4 / thompson 2.5 金丝雀 = 防批量替换误伤。
//
// 用法: node dev/verify-specweapon-20261104.js [--neg]
//   --neg = 阴性对照: 装载前把本批核心改动按文本还原成旧写法, 同一批判据必须报红。
// ─────────────────────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const NEG=process.argv.includes('--neg');
const OK=[],BAD=[];
function assert(name,cond,detail){ (cond?OK:BAD).push(name); console.log(`  ${cond?'✓':'✗'} ${name}${detail?'  '+detail:''}`); }
function section(t){ console.log('\n══ '+t+' ══'); }
const SRC=f=>fs.readFileSync(path.join(root,f),'utf8');

// ── 阴性对照 (锚点用修后原文; 找不到就抛错; 单行锚, 源文件 CRLF 不跨行) ──
const PATCHES=[
 // ① 附身武器镜像退场 = "看着拿火箭筒却打手枪弹"病根复现
 ['js/20-player.js',
  "const w=svHostCurSlot(b);   // 宿主当前武器 (2026-11-04): 不再钉死主武器槽 (附身瞬间宿主已持副武器同样跟装)",
  "const w=(b.slots&&b.slots[0])?b.slots[0]:null;"],
 ['js/20-player.js',
  "svHostWeaponMirror(h);   // 宿主当前武器单源 (2026-11-04): curW 钉定 + VM 换枪 (含副武器), specViewPossess 同源",
  "player.curW=(h.slots&&h.slots[0])?h.slots[0]:player.curW;"],
 ['js/20-player.js',
  "if(h.heldWpnKey&&h.heldWpnKey!==h.wpnKey){",
  "if(false){"],
 ['js/20-player.js',
  "const _side=!!(h.slots&&h.slots[1]&&typeof svHostCurSlot==='function'&&svHostCurSlot(h)===h.slots[1]);",
  "const _side=false;"],
 ['js/13-combat.js',
  "if(typeof player!=='undefined'&&player&&player.specViewHost&&player.specViewHost===shooter&&typeof svHostFireFx==='function') svHostFireFx(def);   // 真附身 (2026-11-04): 与 fireBullet 同款出膛反馈钩 —— 宿主打火箭视角同样有后坐/枪口焰 (旧版只挂枪械弹)",
  ""],
 ['js/22-hud.js',
  "const w=(typeof svHostCurSlot==='function')?svHostCurSlot(h):((h.slots&&h.slots[0])?h.slots[0]:null);   // 宿主当前武器 (2026-11-04): 跟随 heldWpnKey, 不再钉死主武器",
  "const w=(h.slots&&h.slots[0])?h.slots[0]:null;"],
 // ② 手枪差异化退场 = kind 回 SMG / 三族坍缩 / 挂点回旧 / 前推回旧
 ['js/11-soldiers.js',
  "if(d.pistol) return 'pistol';",
  "if(d.pistol) return 'smg';"],
 ['js/11-soldiers.js',
  "const pfam=(key==='c96')?'broom':(key==='nambu'?'nambu':'colt');",
  "const pfam='colt';"],
 ['js/11-soldiers.js',
  "pistol:{x:-0.17,y:0.42,z:0.33},",
  "pistol:{x:-0.13,y:0.34,z:0.24},"],
 ['js/11-soldiers.js',
  "pistol:{x:-0.24,dy:0.12,dz:0.62},",
  "pistol:{x:-0.20,dy:0.12,dz:0.38},"],
 ['js/11-soldiers.js',
  "radio:0.14,pistol:0.06};",
  "radio:0.14};"],
 // ③ 换弹 2/3 退场 (全串锚: reload:2.4/2.5 在 garand/thompson/c96auto/type11 行也有, 必须带 mag:1, reserve:16 前缀)
 ['js/09a-defs.js',
  "mag:1, reserve:16, reload:2.4,",
  "mag:1, reserve:16, reload:3.6,"],
 ['js/09a-defs.js',
  "mag:1, reserve:16, reload:2.5,",
  "mag:1, reserve:16, reload:3.8,"],
];
const PATCH_MAP={};
if(NEG) for(const [f,from,to] of PATCHES){
 const s=PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f);
 if(s.indexOf(from)<0) throw new Error('阴性对照锚点未找到: '+f+' :: '+from.slice(0,70));
 PATCH_MAP[f]=s.split(from).join(to);
}
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f));

// ── ① 源码防回退: 附身武器镜像单源 ────────────────────────────
section('① 附身武器镜像单源 (源码锚)');
{
const s20=srcOf('js/20-player.js');
assert('20 svHostCurSlot: heldWpnKey 台账 → slots[1], 无台账退 slots[0] (旧假宿主兼容)',
 s20.includes('function svHostCurSlot(h){')
 &&s20.includes('if(h.heldWpnKey&&h.heldWpnKey!==h.wpnKey){')
 &&s20.includes('if(s1&&s1.key===h.heldWpnKey) return s1;')
 &&s20.includes('return h.slots[0]||null;'));
assert('20 svHostWeaponMirror: curW 钉定 + VM 换枪门 (idle/draw 才接新枪, 镜像动作中不抢)',
 s20.includes('function svHostWeaponMirror(h){')
 &&s20.includes('const w=svHostCurSlot(h);')
 &&s20.includes('if(w) player.curW=w;')
 &&s20.includes("if(w&&typeof vmEquip==='function'&&VM.key!==w.key&&(VM.state==='idle'||VM.state==='draw')){"));
assert('20 specViewPossess 同源: 不再钉死主武器槽 (附身瞬间宿主已持副武器同样跟装)',
 s20.includes('const w=svHostCurSlot(b);   // 宿主当前武器 (2026-11-04): 不再钉死主武器槽 (附身瞬间宿主已持副武器同样跟装)'));
assert('20 specViewTick 两分支 ×2 同源调用 (调试附身 + 视模式附身)',
 (s20.match(/svHostWeaponMirror\(h\);   \/\/ 宿主当前武器单源 \(2026-11-04\)/g)||[]).length===2);
assert('20 svHostActionMirror 副武器分支: pReloadT 镜像 + 打断 vmAbortAction 同帧收 (主武器分支逐字不动)',
 s20.includes("const _side=!!(h.slots&&h.slots[1]&&typeof svHostCurSlot==='function'&&svHostCurSlot(h)===h.slots[1]);")
 &&s20.includes('if(h.pReloadT>0){')
 &&s20.includes("VM.state='reload'; VM.stateT=0; VM.stateDur=Math.max(0.3,h.pReloadT); vmSndFlags={}; VM.mirrorHost=true;")
 &&s20.includes("}else if(VM.state==='reload'&&VM.mirrorHost&&h.slots[1].mag<h.slots[1].def.mag){"));
assert('22 弹药面板同源 (跟随 heldWpnKey, 不再钉死主武器)',
 srcOf('js/22-hud.js').includes("const w=(typeof svHostCurSlot==='function')?svHostCurSlot(h):((h.slots&&h.slots[0])?h.slots[0]:null);"));
assert('13 fireRocket 出膛反馈钩: 宿主打火箭视角同样有后坐/枪口焰 (旧版只挂枪械弹)',
 (srcOf('js/13-combat.js').match(/svHostFireFx\(def\)/g)||[]).length===2
 &&srcOf('js/13-combat.js').includes('svHostFireFx(def);   // 真附身 (2026-11-04)'));
}

// ── ② 源码防回退: 第三人称手枪差异化 ──────────────────────────
section('② 第三人称手枪差异化 (源码锚)');
{
const s11=srcOf('js/11-soldiers.js');
assert('11 gunKindOf pistol 独立档 (旧版 return \'smg\' = 照搬冲锋枪模型/挂点/姿态的病根)',
 s11.includes("if(d.pistol) return 'pistol';")&&!s11.includes("if(d.pistol) return 'smg';"));
assert('11 三枪族造型分档 (colt/broom/nambu, p38·tt33 同 colt 族; 用户裁定颗粒度)',
 s11.includes("const pfam=(key==='c96')?'broom':(key==='nambu'?'nambu':'colt');")
 &&s11.includes("if(pfam==='broom'){")
 &&s11.includes("} else if(pfam==='nambu'){"));
assert('11 站姿挂点独立档 (a21-j 全量复测定位: 四姿态×双路径 ①″ 零接触 / ④′ 双手 L=R=0)',
 s11.includes('pistol:{x:-0.17,y:0.42,z:0.33},'));
assert('11 匍匐挂点独立档 (双臂前伸: 收胸前时枪角把护木站位旋到纯横向, 超弯肘横向包络 ⇒ 左手脱枪 0.19m)',
 s11.includes('pistol:{x:-0.24,dy:0.12,dz:0.62},'));
assert('11 前推量独立档 (枪短, 沿用步枪 0.30 会把手枪推出手外)',
 s11.includes('radio:0.14,pistol:0.06};'));
assert('11 无 GUN_HOLD_BY_KIND.pistol 表项 = 双手持枪走默认机械 + armIK (用户裁定, 通信仪单手表不受影响)',
 s11.includes('shR:-1.02, elR:-1.62')&&!/pistol:\{shR:/.test(s11));
}

// ── ③ 源码防回退: 火箭筒换弹 2/3 ─────────────────────────────
section('③ 火箭筒换弹 2/3 (源码锚)');
{
const s9=srcOf('js/09a-defs.js');
assert('9 bazooka reload 3.6→2.4 / schreck 3.8→2.5 (全串锚, 带 mag:1, reserve:16 前缀防串行)',
 s9.includes('mag:1, reserve:16, reload:2.4,')&&s9.includes('mag:1, reserve:16, reload:2.5,')
 &&!s9.includes('mag:1, reserve:16, reload:3.6,')&&!s9.includes('mag:1, reserve:16, reload:3.8,'));
assert('9 换弹单源注释在案 (Bot 侧 fireT=3.6 再射击间隔是另一本账, 不随动)',
 s9.includes('fireT=3.6'));
assert('19 tryReload 读 def.reload 单源 (玩家侧换弹时长跟批自动生效)',
 srcOf('js/19-input.js').includes('VM.stateDur=w.def.reload*(player.streakBuff?player.streakBuff.reloadMul:1)'));
}

// ── 沙箱装载 (真 three; 与 verify-specview-20261101 同款) ─────
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
const FILES=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/23-deploy.js','js/24-main.js'];
function boot(campIdx){
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
	ctx.window=window; ctx.globalThis=ctx;
	ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
	for(const f of FILES){ let code=srcOf(f); vm.runInContext(code,ctx,{filename:f}); }
	return {ctx,T};
}

{
const {ctx}=boot(8);
const run=e=>vm.runInContext(e,ctx,{timeout:600000});

// ── ④ 附身武器镜像 (行为, 假宿主) ──
section('④ 附身武器镜像 (行为)');
const t1=run(`(()=>{ const out={};
const p=player;
p.alive=true; p.isPlayer=true; p.spectator=true; p.specView=false; p.specViewHost=null; p._svSaved=null;
p.pos.set(100,50,100); p.yaw=0.3; p.pitch=-0.2;
p.slots=[{key:'kar98',def:WPN_DEFS.kar98,mag:5,reserve:50}]; p.curW=p.slots[0]; vmEquip('kar98',0);
p.prone=false; p.crouch=false; p.thirdPerson=false;
// 宿主 = 反坦克兵已切副武器自卫 (heldWpnKey 台账): 主槽火箭筒 (弹尽) + 副槽手枪
const fake={alive:true,onVehicle:null,onNaval:null,capCrew:false,name:'假AT宿主',team:0,
 pos:new THREE.Vector3(10,2,30),prone:false,crouch:false,yaw:1.2,pitch:0.3,
 mesh:{root:new THREE.Group()},
 wpnKey:'bazooka',heldWpnKey:'m1911',
 slots:[{key:'bazooka',def:WPN_DEFS.bazooka,mag:0,reserve:4},{key:'m1911',def:WPN_DEFS.m1911,mag:5,reserve:40}],
 suppression:0.2,reloadT:0,pReloadT:0,bandages:2,hp:77};
dbgSpecPossess(fake);
out.vmKeyAtPossess=VM.key;                                    // ★附身瞬间即换装宿主当前武器 (specViewPossess 单源; 副武器在手 → 手枪)
specViewTick(0.016);
out.curW=(player.curW===fake.slots[1]);                       // ★首帧 tick 钉 curW (旧版钉死 slots[0]; 钉定逐帧走 svHostWeaponMirror)
out.curWKey=player.curW.key; out.curWMag=player.curW.mag;
out.vmKey=VM.key;                                             // 视角武器 = 宿主手里那把
out.vmIdle=(VM.state==='idle');
out.mainUntouched=(fake.slots[0].mag===0);                    // 只读借眼: 宿主账零写入
// 副武器换弹镜像 (pReloadT): VM 进 reload, 时长=宿主剩余
fake.pReloadT=1.8; specViewTick(0.016);
out.rlState=VM.state; out.rlDur=VM.stateDur; out.rlMirror=VM.mirrorHost;
// 宿主换弹被打断 (pReloadT 归零而弹匣未满) ⇒ 镜像同帧收
fake.pReloadT=0; specViewTick(0.016);
out.abortState=(VM.state!=='reload'); out.abortMirror=(VM.mirrorHost===false);
// 出膛反馈对火箭筒 def 可用 (fireRocket 钩同款; 13-combat 接线由源码锚判定)
VM.state='idle'; VM.stateT=0; VM.stateDur=0; VM.recoilV=0; VM.kickV=0;
svHostFireFx(WPN_DEFS.bazooka);
out.rocketKick=(VM.recoilV>0&&VM.kickV>0);
dbgSpecDetach();
out.detCurW=(player.curW===p.slots[0]); out.detVm=(VM.key==='kar98'); out.detHost=(player.specViewHost===null);
// 兼容守卫: 无 heldWpnKey 的旧结构宿主 (specview 批假宿主形态) 行为不变
const old={alive:true,onVehicle:null,onNaval:null,capCrew:false,name:'旧宿主',team:0,
 pos:new THREE.Vector3(10,2,30),prone:false,crouch:false,yaw:0,pitch:0,
 mesh:{root:new THREE.Group()},slots:[{key:'thompson',def:WPN_DEFS.thompson,mag:3,reserve:90}],
 suppression:0,reloadT:0,bandages:1,hp:80};
dbgSpecPossess(old); specViewTick(0.016);
out.oldCurW=(player.curW===old.slots[0]); out.oldVm=(VM.key==='thompson');
dbgSpecDetach();
return out; })()`);
assert('④ 附身瞬间 VM 即换宿主当前武器 (副武器在手 → 手枪, 旧版永远主武器)',t1.vmKeyAtPossess==='m1911',
 `vm@possess=${t1.vmKeyAtPossess}`);
assert('④ 首帧 tick 钉 curW 到宿主手里那把 (弹药面板跟宿主, 旧版钉死主槽)',t1.curW===true&&t1.curWKey==='m1911'&&t1.curWMag===5,
 `curW=${t1.curWKey} mag=${t1.curWMag}`);
assert('④ 视角武器 VM 跟装宿主手里那把 (★"看着火箭筒打手枪弹"病根)',t1.vmKey==='m1911'&&t1.vmIdle===true,
 `vm=${t1.vmKey}`);
assert('④ 只读借眼: 宿主弹药账零写入',t1.mainUntouched===true);
assert('④ 副武器换弹镜像: pReloadT → VM reload 时长=宿主剩余',t1.rlState==='reload'&&Math.abs(t1.rlDur-1.8)<1e-9&&t1.rlMirror===true,
 `state=${t1.rlState} dur=${t1.rlDur}`);
assert('④ 宿主副武器换弹被打断 ⇒ 镜像同帧收 (vmAbortAction + mirrorHost 归位)',t1.abortState===true&&t1.abortMirror===true);
assert('④ svHostFireFx 对火箭筒 def 同款出膛反馈 (后坐+枪口焰)',t1.rocketKick===true);
assert('④ 脱离还原 (curW/VM/宿主账)',t1.detCurW===true&&t1.detVm===true&&t1.detHost===true);
assert('④ 兼容守卫: 无 heldWpnKey 旧结构宿主行为不变 (slots[0] + VM 跟装)',t1.oldCurW===true&&t1.oldVm===true);

// ── ⑤ 第三人称手枪差异化 (行为) ──
section('⑤ 手枪差异化 (行为)');
const t2=run(`(()=>{ const out={};
// 指纹: 逐网格 (位置+几何参数) 序列化 —— 同族同指纹 / 异族必不同
function fp(g){ const a=[]; g.updateMatrixWorld(true);
 g.traverse(o=>{ if(!o.isMesh) return; const q=o.geometry.parameters||{};
  a.push([o.position.x,o.position.y,o.position.z,q.width||q.radiusTop||0,q.height||0,q.depth||0].map(v=>+Number(v).toFixed(4)).join(',')); });
 return a.join('|'); }
function zlen(g){ const b=new THREE.Box3().setFromObject(g); return +(b.max.z-b.min.z).toFixed(3); }
// 5 键 kind 判定 (旧版 5 键全部 return 'smg')
out.kinds=['m1911','p38','tt33','c96','nambu'].map(k=>gunKindOf(k)).every(k=>k==='pistol');
out.noSmg=['m1911','p38','tt33','c96','nambu'].every(k=>gunKindOf(k)!=='smg');
// 三族指纹: 同族一致 (p38/tt33=m1911) + 三族两两互异 + 手枪尺度 (非步枪/非冲锋枪)
const gC=worldGunModel('pistol',0,'m1911'), gP38=worldGunModel('pistol',0,'p38'), gTT=worldGunModel('pistol',0,'tt33');
const gB=worldGunModel('pistol',0,'c96'), gN=worldGunModel('pistol',0,'nambu');
out.famColt=(fp(gP38)===fp(gC)&&fp(gTT)===fp(gC));
out.distinct=(fp(gC)!==fp(gB)&&fp(gC)!==fp(gN)&&fp(gB)!==fp(gN));
out.pistolScale=[gC,gB,gN].every(g=>zlen(g)>0.18&&zlen(g)<0.45);
out.partsColt=(function(){ let n=0; gC.traverse(o=>{ if(o.isMesh) n++; }); return n; })();
// 站位/挂点 (a21-j 定位值) + 护木/握把站位现算
const st=gunGeomStations('pistol');
out.stGrip=(st.grip.z===0);
out.stFore=Math.abs(st.fore.z-(st.zMin+(st.zMax-st.zMin)*0.40))<1e-9;
out.stColt=Math.abs(st.zMax-0.0675)<1e-9;                     // 站位按 colt 族临时模型现算 (key=null)
out.mnt=(function(){ const m=gunMountOf('pistol'); return m.x===-0.17&&m.y===0.42&&m.z===0.33; })();
out.mntProne=(function(){ const m=gunMountOf('pistol',1.5);
 return m.x===-0.24&&Math.abs(m.y-0.6266)<0.01&&Math.abs(m.z+0.0759)<0.01; })();
out.carry=(gunCarryOffset('pistol').z===0.06);
out.holdDefault=(gunHoldOf('pistol')===null&&gunHoldOf('radio')!==null);   // 双手持枪=默认机械, 通信仪单手表不受影响
// Bot 端到端: switchVisualGun 真换模 (枪种/台账/枪盒尺度/换回原枪恢复 —— spawn 兵种随机, 记 initKey)
const b=new Bot(0,0,'SW'); b.spawn();
b.pos.set(0,0,0); b.pos.y=standHeight(0,0,10); b.alive=true;
const initKey=b.wpnKey;
const fpRifle=fp(b.gun); const lenRifle=zlen(b.gun);
b.switchVisualGun('m1911');
out.botKind=(b.gunKind==='pistol'&&b.heldWpnKey==='m1911');
out.botPistolLen=(zlen(b.gun)<0.45);
out.botChanged=(fp(b.gun)!==fpRifle);
const fpM1911=fp(b.gun);
b.switchVisualGun('c96');
out.botBroom=(fp(b.gun)!==fpM1911);
b.switchVisualGun('nambu');
out.botNambu2=(fp(b.gun)!==fpM1911);                          // 与 m1911 不同 (c96 已比对)
b.switchVisualGun(initKey);
out.botBack=(fp(b.gun)===fpRifle&&zlen(b.gun)===lenRifle);   // ★spawn 兵种随机: initKey 可能是短枪 (thompson 自有模型 0.5m), 对初值逐位复原而非钉长度
out.lenRifle=lenRifle;
return out; })()`);
assert('⑤ 5 键 gunKindOf 全部 pistol 独立档 (不再 smg)',t2.kinds===true&&t2.noSmg===true);
assert('⑤ 三族造型: p38/tt33 同 colt 族 + colt/broom/nambu 两两互异',t2.famColt===true&&t2.distinct===true,
 `colt零件=${t2.partsColt}`);
assert('⑤ 手枪尺度 (枪盒 z 长 0.18~0.45m, 非步枪 0.9+ 非冲锋枪照搬)',t2.pistolScale===true);
assert('⑤ 站位现算: 握把 z=0 / 护木 z=zMin+0.4·跨度 / colt 族标定 (zMax=0.0675)',
 t2.stGrip===true&&t2.stFore===true&&t2.stColt===true);
assert('⑤ 站姿挂点 {-0.17,0.42,0.33} (a21-j 定位值)',t2.mnt===true);
assert('⑤ 匍匐挂点满混合 {-0.24, +0.627, -0.076} (双臂前伸档)',t2.mntProne===true);
assert('⑤ 前推量 0.06 / 双手持枪默认 (无持握表项, 通信仪表不受影响)',t2.carry===true&&t2.holdDefault===true);
assert('⑤ Bot switchVisualGun 端到端: 换 m1911 ⇒ kind/台账/短枪模全跟 (与步枪模不同)',
 t2.botKind===true&&t2.botPistolLen===true&&t2.botChanged===true,`步枪盒=${t2.lenRifle}`);
assert('⑤ Bot 换 c96 (broom 族) / nambu 族 ⇒ 模型逐指纹不同',t2.botBroom===true&&t2.botNambu2===true);
assert('⑤ Bot 换回原兵种枪 ⇒ 枪模逐位复原 (长度对初值, 兵种随机可滚到短枪)',t2.botBack===true);

// ── ⑥ 第三人称玩家路径端到端 (用户实报场景: 突击兵切副武器) + 换弹值 ──
section('⑥ 玩家第三人称端到端 + 换弹值 (行为)');
const t3=run(`(()=>{ const out={};
function fp(g){ const a=[]; g.updateMatrixWorld(true);
 g.traverse(o=>{ if(!o.isMesh) return; const q=o.geometry.parameters||{};
  a.push([o.position.x,o.position.y,o.position.z,q.width||q.radiusTop||0,q.height||0,q.depth||0].map(v=>+Number(v).toFixed(4)).join(',')); });
 return a.join('|'); }
function zlen(g){ const b=new THREE.Box3().setFromObject(g); return +(b.max.z-b.min.z).toFixed(3); }
player.pos.set(0,0,0); player.pos.y=standHeight(0,0,10);
player.alive=true; player.deployed=true; player.team=0; player.spectator=false; player.specView=false; player.specViewHost=null;
player.pitch=0; player.yaw=0; player.ads=false; player.braced=false; player.crouch=false; player.prone=false;
player.fireAnimT=0; player.reloadT=0; player.nadeThrowT=0; player.meleeT=0; player.landDip=0; player.sprinting=false;
const av=playerAvatarEnsure();
player.curW={key:'thompson',def:WPN_DEFS.thompson};
for(let f=0;f<3;f++) updatePlayerAvatar(1/60);
const fpSmg=fp(av._gun), lenSmg=zlen(av._gun);
out.dbg1={gunKey:av._gunKey,hasGun:!!av._gun,len:lenSmg};
player.curW={key:'m1911',def:WPN_DEFS.m1911};
for(let f=0;f<3;f++) updatePlayerAvatar(1/60);
const fpP=fp(av._gun), lenP=zlen(av._gun);
out.dbg2={gunKey:av._gunKey,hasGun:!!av._gun,len:lenP,fpSame:fpP===fpSmg};
out.pistolMounted=(!!av._gun&&fpP!==fpSmg&&lenP<0.35&&lenSmg>0.35);   // ★切副武器 ⇒ 第三人称模型真变 (汤普森自有模型盒 0.5m, 手枪 0.25m; 旧版照搬冲锋枪模=指纹相同)
player.curW={key:'c96',def:WPN_DEFS.c96};
for(let f=0;f<3;f++) updatePlayerAvatar(1/60);
out.broomMounted=(fp(av._gun)!==fpP&&fp(av._gun)!==fpSmg);
// 换弹值 (WPN_DEFS 单源) + 金丝雀 (防批量替换误伤同值枪)
out.rl=[WPN_DEFS.bazooka.reload,WPN_DEFS.schreck.reload];
out.canary=[WPN_DEFS.garand.reload,WPN_DEFS.thompson.reload];
return out; })()`);
assert('⑥ 玩家第三人称: thompson→m1911 切副武器 ⇒ 挂枪模型真变 (短枪模, 非冲锋枪照搬)',
 t3.pistolMounted===true,`smg盒=${t3.lenSmg} 手枪盒=${t3.lenP} dbg=${JSON.stringify(t3.dbg1)}|${JSON.stringify(t3.dbg2)}`);assert('⑥ m1911→c96 再切 ⇒ broom 族模型又变 (三族互异走玩家挂枪路径)',t3.broomMounted===true);
assert('⑥ 火箭筒换弹 2.4/2.5 + 金丝雀 garand 2.4 / thompson 2.5 未被误伤',
 t3.rl[0]===2.4&&t3.rl[1]===2.5&&t3.canary[0]===2.4&&t3.canary[1]===2.5,JSON.stringify(t3.rl)+' / '+JSON.stringify(t3.canary));

console.log('\n' + (BAD.length? `✗ ${BAD.length} 红 / ${OK.length} 绿` : `✓ 全绿 (${OK.length})`));
if(BAD.length){ process.exitCode=1; if(NEG) console.log('(阴性对照: 有红=判据具备分辨力)'); }
else if(NEG){ console.log('✗ 阴性对照全绿 = 判据空转!'); process.exitCode=1; }
}
