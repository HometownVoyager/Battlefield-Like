// ─────────────────────────────────────────────
// dev/verify-a21-j.js —— 契约 J §12.4.2 独立复测 (verifier / 2026-09-21 批次 20260921A)
//
// 用法: node dev/verify-a21-j.js            (exit 0 = 全部判据通过)
//       node dev/verify-a21-j.js --detail   # 逐 kind×姿态 打印
//
// 判据 (阈值就是 §12.4.2, 一条都不放宽):
//   ①′ 武器包围盒与「头/颈盒」不相交 = 0 组 (两条驱动路径 × 14 键 × 4 姿态);
//   ①″ 躯干盒只允许"枪托抵肩"接触: 穿入 ≤0.06m **且** 穿透点到右肩窝 (-0.28,0.50,0) 的躯干局部距离 ≤0.30m;
//   ④′ 左右手到武器表面 ≤0.06m (全部持枪状态; **换弹时左手按权重 0 处理 = Lead 已批准的例外, 不判缺陷**);
//   ③′ 枪不是绕锁骨定点转: 改变"右肩 rotation.x 的驱动量"(交战态 aim pitch ±0.3rad, 枪身俯仰与右肩同源):
//       (a) 枪上固定点 (枪模世界原点 = 握把锚点) 位移与右手位移 **同向** 且量比 ∈[0.8,1.25];
//       (b) 枪上固定点绕 gunG 世界锚点的转动半径变化 ≤5%;
//       (c) 【额外独立判据, 本轮新增】把 ±0.3 施加在**枪身**(gunG.rotation.x) 上 —— 真正能判别"手在枪上还是
//           手在空气里": 手的位移必须与枪点同向同量比。修前(无 armIK) 该判据必然失败, 修后必须过。
//   ② 挂点: 躯干局部 x<0 (右手侧) 且 y<0.45 (低于肩关节 0.50); 且 = gunMountOf(kind) (按枪种单源)
//   附: 匍匐 ④′ 未达标的**定性归因** (ikRes 残差 / 实际角 vs 目标角收敛 / 躯干局部系同源量法) —— 只报告, 不判 pass/fail。
//
// 修前列: 两种来源并列 —— (A) Lead 给的独立量测基线 (站/据枪/蹲 0.197/0.259/0.261、匍匐 0.297);
//    (B) 我的受控变体 (内存还原旧挂点 0.14/0.40/0.10 + ARM_SIDE R=+1 + armIK 置空 + 玩家路径旧挂枪段)。
//  两者都列, 不混用 (实现者自报的"修前变体"不可信, 已按 Lead 要求弃用)。
// ─────────────────────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const {sandbox,document,window}=require('./_bootstub.js');
const DETAIL=process.argv.includes('--detail');

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
const FILES=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15g-capmodels.js','js/15h-capital.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/23-deploy.js','js/24-main.js'];

// ── 修前受控变体 (只改内存里的源码字符串) ──
const BEFORE_EDITS=[
	['js/11-soldiers.js','launcher:{x:-0.26,y:0.56,z:0.08}','launcher:{x:0.14,y:0.40,z:0.10}'],
	['js/11-soldiers.js','atr:{x:-0.20,y:0.42,z:0.20}','atr:{x:0.14,y:0.40,z:0.10}'],
	['js/11-soldiers.js','mortar:{x:-0.28,y:0.24,z:0.30}','mortar:{x:0.14,y:0.40,z:0.10}'],
	['js/11-soldiers.js','default:{x:-0.15,y:0.33,z:0.26}','default:{x:0.14,y:0.40,z:0.10}'],
	['js/11-soldiers.js','const ARM_SIDE={R:-1,L:1};','const ARM_SIDE={R:1,L:-1};'],
	['js/11-soldiers.js','function armIK(sh,elm,target){','function armIK(sh,elm,target){ if(true) return 0;'],  // 修前: 无 IK (返回 0=残差而非 null —— 见审计: 14-bots:2160 对 null 无守卫)
	['js/20-player.js',"if(typeof mountGunModel==='function') av._gun=mountGunModel(", 'if(false) av._gun=mountGunModel('],
	['js/11-soldiers.js','gunG.position.set(mo.x,mo.y,mo.z);','if(false) gunG.position.set(mo.x,mo.y,mo.z);'],  // 修前: 玩家/骨架挂点仍是旧值 (0.14,0.4,0.1)
];
function applyBefore(f,src){
	for(const [file,from,to] of BEFORE_EDITS){
		if(file!==f) continue;
		if(src.indexOf(from)<0) throw new Error('J 修前变体锚点漂移: '+file+' :: '+from.slice(0,40));
		src=src.split(from).join(to);
	}
	return src;
}

function bootJ(before){
	const T=loadRealTHREE();
	T.WebGLRenderer=class{ constructor(){ this.domElement=Object.assign(document.createElement('canvas'),{width:0,height:0}); this.shadowMap={enabled:false,type:0,autoUpdate:true};
		this.setSize=()=>{}; this.setPixelRatio=()=>{}; this.render=()=>{}; this.clear=()=>{}; this.clearDepth=()=>{};
		this.outputColorSpace=''; this.setClearColor=()=>{}; this.setAnimationLoop=()=>{}; } };
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
	ctx.localStorage={_s:{sf_campaign:'8'},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
	for(const f of FILES){
		let code=fs.readFileSync(path.join(root,f),'utf8');
		if(before) code=applyBefore(f,code);
		vm.runInContext(code,ctx,{filename:f});
	}
	return {ctx,T,rev:T.REVISION};
}

// ── 沙箱内量测器 (判据在宿主机; 这里只做"真实 three 世界空间的几何量测") ──
const MEASURE=`
globalThis.__JM=(function(){
const V=()=>new THREE.Vector3();
const KEYS=(function(){
 const want=['springfield','mosinpu','kar98zf','ptrd','boys','type97at','bazooka','schreck'];
 const picked=want.slice();
 for(const k of Object.keys(WPN_DEFS)){ if(!WPN_DEFS[k]||WPN_DEFS[k].hidden) continue; if(picked.indexOf(k)<0) picked.push(k); }
 return picked.slice(0,14);
})();
const POSES=[['站立','stand'],['据枪','aim'],['下蹲','crouch'],['匍匐','prone']];
function shoot(v){ return {pos:{x:v.x+30,y:v.y+1.2,z:v.z},alive:true,team:1,prone:false,crouch:false,vel:null,suppression:0,lastFiredT:-99}; }
// 穿透点口径: 两盒交集的**中心**; 返回躯干局部系坐标 (肩窝也在躯干局部系: (-0.28,0.50,0))
function overlap(a,b){ const mn=V().set(Math.max(a.min.x,b.min.x),Math.max(a.min.y,b.min.y),Math.max(a.min.z,b.min.z));
 const mx=V().set(Math.min(a.max.x,b.max.x),Math.min(a.max.y,b.max.y),Math.min(a.max.z,b.max.z));
 if(mx.x<=mn.x||mx.y<=mn.y||mx.z<=mn.z) return null;
 return {c:V().addVectors(mn,mx).multiplyScalar(0.5), d:Math.min(mx.x-mn.x,mx.y-mn.y,mx.z-mn.z)};
}
function metrics(gun,mesh,gunG){
 gun.updateMatrixWorld(true); mesh.root.updateMatrixWorld(true);
 const gunBox=new THREE.Box3().setFromObject(gun);
 const torsoBox=new THREE.Box3().setFromObject(mesh.torsoG.children[0]);
 const skullBox=new THREE.Box3().setFromObject(mesh.headG.children[0]);   // 头/颈皮肤盒 (与实现者同口径)
 const headBox=new THREE.Box3().setFromObject(mesh.headG);                // 含盔 (严格口径)
 const hL=mesh.armL.hand.getWorldPosition(V()), hR=mesh.armR.hand.getWorldPosition(V());
 const socketW=mesh.torsoG.localToWorld(V().set(-0.28,0.50,0));
 // 【独立加值口径】真实几何点云: 枪的每个网格顶点落在盒内 ⇒ 最深穿透点 (AABB 对斜置长枪是松包围, 会高估/误判)
 function cloud(box){
  let best=null; const p=V();
  gun.traverse(o=>{ if(!o.isMesh||!o.geometry||!o.geometry.attributes||!o.geometry.attributes.position) return;
   const pos=o.geometry.attributes.position;
   for(let i=0;i<pos.count;i++){ p.fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld);
    if(p.x>box.min.x&&p.x<box.max.x&&p.y>box.min.y&&p.y<box.max.y&&p.z>box.min.z&&p.z<box.max.z){
     const d=Math.min(p.x-box.min.x,box.max.x-p.x,p.y-box.min.y,box.max.y-p.y,p.z-box.min.z,box.max.z-p.z);
     if(!best||d>best.d) best={d:d,x:p.x,y:p.y,z:p.z};
    } } });
  return best;
 }
 const cT=cloud(torsoBox), cH=cloud(headBox);
 const tO=overlap(gunBox,torsoBox);
 const toLocal=(w)=>mesh.torsoG.worldToLocal(w.clone());
 const pocket=tO?toLocal(tO.c):null;
 return {gunMin:[gunBox.min.x,gunBox.min.y,gunBox.min.z],gunMax:[gunBox.max.x,gunBox.max.y,gunBox.max.z],
  interHead:gunBox.intersectsBox(headBox), headPen:overlap(gunBox,headBox)?overlap(gunBox,headBox).d:0,
  interSkull:gunBox.intersectsBox(skullBox), skullPen:overlap(gunBox,skullBox)?overlap(gunBox,skullBox).d:0,
  interTorso:gunBox.intersectsBox(torsoBox), torsoPen:tO?tO.d:0,
  pocketDist:pocket?Math.hypot(pocket.x+0.28,pocket.y-0.50,pocket.z):null,
  pcHeadN:cH?1:0, pcHeadPen:cH?cH.d:0,
  pcTorsoPen:cT?cT.d:0,
  pcPocket:cT?+Math.hypot(cT.x-socketW.x,cT.y-socketW.y,cT.z-socketW.z).toFixed(4):null,
  handR:+gunBox.distanceToPoint(hR).toFixed(4), handL:+gunBox.distanceToPoint(hL).toFixed(4),
  mount:{x:gunG.position.x,y:gunG.position.y,z:gunG.position.z},
  anchor:[mesh.gunG.getWorldPosition(V()).x,mesh.gunG.getWorldPosition(V()).y,mesh.gunG.getWorldPosition(V()).z]};
}
function botActor(key){
 const b=new Bot(0,0,'J'+key); b.spawn();
 b.pos.set(0,0,0); b.pos.y=standHeight(0,0,10); b.alive=true; b.pitch=0;
 if(b.gun) b.mesh.gunG.remove(b.gun);
 b.wpnKey=key; b.def=WPN_DEFS[key]; b.gunKind=gunKindOf(key);
 b.gun=mountGunModel(b.mesh.gunG,b.gunKind,b.team,key);
 return {o:b,gun:b.gun,mesh:b.mesh,gunG:b.mesh.gunG,getGun(){ return b.gun; },
  setPose(pose){ b.crouch=(pose==='crouch'); b.prone=(pose==='prone');
   const eng=(pose!=='stand'); b.target=eng?shoot(b.pos):null; b.lastSeenT=eng?nowT:-99; b.reloadT=0; },
  setPitch(v){ b.pitch=v; },
  step(n,dt){ for(let f=0;f<n;f++){ nowT+=(dt||1/60); if(b.target){ b.target.pos.x=b.pos.x+30; b.target.pos.y=b.pos.y+1.2; b.lastSeenT=nowT; } b.updateMesh(dt||1/60,0); } },
  ikRes(){ return b.ikRes||null; }};
}
function playerActor(key){
 player.pos.set(0,0,0); player.pos.y=standHeight(0,0,10);
 player.alive=true; player.deployed=true; player.team=0; player.spectator=false;
 player.pitch=0; player.yaw=0; player.ads=false; player.braced=false; player.crouch=false; player.prone=false;
 player.fireAnimT=0; player.reloadT=0; player.nadeThrowT=0; player.meleeT=0; player.landDip=0; player.sprinting=false;
 player.curW={key:key,def:WPN_DEFS[key]};
 const av=playerAvatarEnsure();
 return {o:player,gun:null,mesh:av,gunG:av.gunG,getGun(){ return av._gun; },   // 玩家的枪在 updatePlayerAvatar 里挂, 必须惰性读
  setPose(pose){ player.ads=(pose==='aim'); player.crouch=(pose==='crouch'); player.prone=(pose==='prone'); },
  setPitch(v){ player.pitch=v; },
  step(n,dt){ for(let f=0;f<n;f++){ nowT+=(dt||1/60); updatePlayerAvatar(dt||1/60); } },
  ikRes(){ return null; }};
}
function runPath(path){
 const mk=(path==='bot')?botActor:playerActor;
 const rows=[];
 for(const key of KEYS){
  const kind=gunKindOf(key);
  for(const [pn,pose] of POSES){
   const a=mk(key);
   a.setPose(pose); a.setPitch(0);
   a.step(150);
   let m;
   try{ m=metrics(a.getGun(),a.mesh,a.gunG); }
   catch(e){ throw new Error('metrics ['+path+' '+key+' '+pose+'] gun='+(a.getGun()?'obj':'NULL')+' : '+(e&&e.message||e)); }
   rows.push(Object.assign({key,kind,pose:pn},m));
  }
 }
 return rows;
}
// ③′ 俯仰扫描: 交战中 pitch ±0.3 (枪身俯仰与右肩同源)
function sweep(path,key,pose){
 const mk=(path==='bot')?botActor:playerActor;
 const a=mk(key); a.setPose(pose||'aim');
 const out=[];
 for(const p of [0.3,-0.3]){
  a.setPitch(p); a.step(150);
  a.mesh.root.updateMatrixWorld(true); a.getGun().updateMatrixWorld(true);
  const gp=a.getGun().localToWorld(V().set(0,0,0));                 // 枪上固定点 = 枪模世界原点 (握把锚点)
  const hand=a.mesh.armR.hand.getWorldPosition(V());
  const anchor=a.mesh.gunG.getWorldPosition(V());
  out.push({gp:[gp.x,gp.y,gp.z],hand:[hand.x,hand.y,hand.z],anchor:[anchor.x,anchor.y,anchor.z]});
 }
 return out;
}
// ③′(c) 真正判别"手在枪上": 直接转 gunG.rotation.x ±0.3 (绕挂点转枪身), 看手是否跟着
function gunSweep(path,key,pose){
 const mk=(path==='bot')?botActor:playerActor;
 const a=mk(key); a.setPose(pose||'aim'); a.setPitch(0);
 const out=[];
 const G=a.gunG;
 for(const d of [0.3,-0.3]){
  a.step(60);
  const base=G.rotation.x;
  G.rotation.x=base+d;                                        // 直接施加在枪身上 (姿态机会在下一帧改写, 故只量一帧)
  a.mesh.root.updateMatrixWorld(true);
  const gp=a.getGun().localToWorld(V().set(0,0,0));
  const hand=a.mesh.armR.hand.getWorldPosition(V());
  out.push({gp:[gp.x,gp.y,gp.z],hand:[hand.x,hand.y,hand.z]});
 }
 return out;
}
// 定性诊断 (匍匐 ④′ 归因): 残差 / 实际 gunG 角 vs 目标角 / 躯干局部系量法
function diag(path,key){
 const mk=(path==='bot')?botActor:playerActor;
 const a=mk(key); a.setPose('prone'); a.setPitch(0);
 a.step(150);
 a.mesh.root.updateMatrixWorld(true);
 const gk=a.gunG, mo=gunMountOf(gunKindOf(key));
 const gpTorso=gunGripPoint(gunKindOf(key),gk.rotation.x,gk.rotation.y,gk.rotation.z);
 const fpTorso=(function(){ const fp=gunForePoint(gunKindOf(key),gk.rotation.x,gk.rotation.y,gk.rotation.z); return fp; })();
 // 手的躯干局部坐标
 const hR=a.mesh.armR.hand.getWorldPosition(V());
 const hL=a.mesh.armL.hand.getWorldPosition(V());
 const hRt=a.mesh.torsoG.worldToLocal(hR.clone()), hLt=a.mesh.torsoG.worldToLocal(hL.clone());
 const shLp={x:0.28,y:0.5,z:0};
 const reach=(typeof ARM_L1==='number')?(ARM_L1+ARM_L2):0.62;
 // 左肩到"枪轴上各 t"的距离 (找从哪个 t 起可达)
 const taps=[];
 for(let t=1;t>=-0.5;t-=0.1){ const p=gunAxisPoint(gunKindOf(key),t,gk.rotation.x,gk.rotation.y,gk.rotation.z);
  taps.push({t:+t.toFixed(1),d:+Math.hypot(p.x-shLp.x,p.y-shLp.y,p.z-shLp.z).toFixed(3)}); }
 const firstReach=(function(){ for(const q of taps) if(q.d<=reach-0.03) return q.t; return null; })();
 return {ikRes:a.ikRes(), gunRot:{x:gk.rotation.x,y:gk.rotation.y,z:gk.rotation.z},
  mount:{x:gk.position.x,y:gk.position.y,z:gk.position.z}, mountWant:mo,
  gripTorso:gpTorso, handRTorso:hRt, handLTorso:hLt,
  dHandRtorso:+Math.hypot(hRt.x-gpTorso.x,hRt.y-gpTorso.y,hRt.z-gpTorso.z).toFixed(4),
  dHandLtorso:+Math.hypot(hLt.x-fpTorso.x,hLt.y-fpTorso.y,hLt.z-fpTorso.z).toFixed(4),
  reach:+reach.toFixed(3), atr:firstReach, taps:taps.filter((q,i)=>i%3===0)};
}
return {KEYS,POSES,runPath,sweep,gunSweep,diag,metrics,gunMountOf:(typeof gunMountOf==='function')?gunMountOf:null};
})();`;

// ── 宿主机: 判据 ──
let checks=0,fails=0,lines=[];
const chk=(c,m)=>{ checks++; if(!c) fails++; const s=(c?'  ✓ ':'  ✗ ')+m; lines.push(s); console.log(s); };
const info=m=>{ const s='    '+m; lines.push(s); console.log(s); };

console.log('== 契约 J §12.4.2 独立复测 (2026-09-21 批次 20260921A) ==');
const cur=bootJ(false), bef=bootJ(true);
info(`真 three.js r${cur.rev} (dev/vendor/three.min.js) · 脚本表 ${FILES.length} 个 · 两条驱动路径各自独立驱动`);
const ctxC=cur.ctx, ctxB=bef.ctx;
vm.runInContext(MEASURE,ctxC,{filename:'__JM'}); vm.runInContext(MEASURE,ctxB,{filename:'__JM'});
const keys=vm.runInContext('__JM.KEYS',ctxC);
const poses=vm.runInContext('__JM.POSES.map(p=>p[0])',ctxC);
info(`覆盖 ${keys.length} 键 (${keys.join(',')}) × ${poses.length} 姿态 = ${keys.length*poses.length} 组/路径`);

const run=(ctx,expr)=>vm.runInContext(expr,ctx,{timeout:600000});
const rowsBot=run(ctxC,'__JM.runPath("bot")'), rowsPly=run(ctxC,'__JM.runPath("player")');
const rowsBotB=run(ctxB,'__JM.runPath("bot")'), rowsPlyB=run(ctxB,'__JM.runPath("player")');

const agg=(rows,name)=>{
	console.log('\n──────────────── '+name+' ────────────────');
	const headBad=rows.filter(r=>r.interHead), skullBad=rows.filter(r=>r.interSkull);
	const torsoBad=rows.filter(r=>r.interTorso&&!(r.torsoPen<=0.06&&r.pocketDist!==null&&r.pocketDist<=0.30));
	const holdRows=rows;   // 全部姿态都是持枪态 (换弹态另外单测)
	const handRBad=holdRows.filter(r=>r.handR>0.06), handLBad=holdRows.filter(r=>r.handL>0.06);
	const byPose=p=>rows.filter(r=>r.pose===p);
	const worst=(arr,f)=>arr.length?arr.reduce((a,b)=>f(a)>f(b)?a:b):null;
	const f3=v=>v===null?'—':(+v).toFixed(3);
	const pen=o=>o?o.key+'/'+o.pose:'—';
	console.log('  ①′ 头/颈盒相交: 含盔 '+headBad.length+'/'+rows.length+' (最深 '+f3(Math.max(...rows.map(r=>r.headPen),0))+'m) · 纯头部皮肤盒 '+skullBad.length+'/'+rows.length+' (最深 '+f3(Math.max(...rows.map(r=>r.skullPen),0))+'m)');
	console.log('  ①″ 躯干盒: 相交 '+rows.filter(r=>r.interTorso).length+'/'+rows.length+' · 越界(穿入>0.06 或 非肩窝) '+torsoBad.length+'/'+rows.length+' · 最深穿入 '+f3(Math.max(...rows.map(r=>r.torsoPen),0))+'m');
	console.log('  ④′ 手到武器表面: 右手 >0.06 的 '+handRBad.length+'/'+rows.length+' (最差 '+f3(Math.max(...rows.map(r=>r.handR)))+'m) · 左手 >0.06 的 '+handLBad.length+'/'+rows.length+' (最差 '+f3(Math.max(...rows.map(r=>r.handL)))+'m)');
	for(const p of poses){
		const a=byPose(p);
		console.log('     · '+p.padEnd(4)+' 躯干相交 '+a.filter(r=>r.interTorso).length+'/'+a.length+' · 最深穿入 '+f3(Math.max(...a.map(r=>r.torsoPen),0))+' · 右/左手最差 '+f3(Math.max(...a.map(r=>r.handR)))+'/'+f3(Math.max(...a.map(r=>r.handL)))+' · 头颈相交 '+a.filter(r=>r.interHead).length+'/'+a.length);
	}
	if(DETAIL){ for(const r of rows) console.log('      '+[r.key.padEnd(12),r.kind.padEnd(9),r.pose.padEnd(4),'头'+r.interHead,'躯'+r.interTorso,(+r.torsoPen).toFixed(3),(r.pocketDist===null?'—':(+r.pocketDist).toFixed(3)),'R'+r.handR,'L'+r.handL,'mnt '+r.mount.x.toFixed(2)+'/'+r.mount.y.toFixed(2)].join(' ')); }
	return {headBad,skullBad,torsoBad,handRBad,handLBad,worstTorso:worst(rows,r=>r.torsoPen),rows};
};
const A1=agg(rowsBot,'Bot 路径 (js/14-bots.js, updateMesh)');
const A2=agg(rowsPly,'玩家路径 (js/20-player.js, updatePlayerAvatar)');

console.log('\n══ 判据 ══');
chk(A1.headBad.length===0,`①′ Bot 路径: 头/颈盒相交 ${A1.headBad.length}/${rowsBot.length} 组 = 0 (含盔严格口径)`);
chk(A2.headBad.length===0,`①′ 玩家路径: 头/颈盒相交 ${A2.headBad.length}/${rowsPly.length} 组 = 0 (含盔严格口径)`);
chk(A1.torsoBad.length===0,`①″ Bot 路径 (AABB 口径=契约原文): 躯干盒 ${A1.torsoBad.length} 组越界 (穿入 ≤0.06 且距肩窝 ≤0.30)`);
chk(A2.torsoBad.length===0,`①″ 玩家路径 (AABB 口径=契约原文): 躯干盒 ${A2.torsoBad.length} 组越界`);
// 加值口径: 真实几何点云 (AABB 对斜置长枪是松包围, 会把"枪身擦过躯干盒角"算成深穿透)
const pcBad=(rows)=>rows.filter(r=>r.pcTorsoPen>0.06||(r.pcPocket!==null&&r.pcPocket>0.30));
const pcHeadBad=(rows)=>rows.filter(r=>r.pcHeadN>0);
const b1=pcBad(rowsBot), b2=pcBad(rowsPly);
console.log(`   点云加值口径 (枪网格顶点落在盒内): Bot 躯干越界 ${b1.length}/56 (最深 ${Math.max(...rowsBot.map(r=>r.pcTorsoPen),0).toFixed(3)}m, 头颈命中 ${pcHeadBad(rowsBot).length}/56) · 玩家 躯干越界 ${b2.length}/56 (最深 ${Math.max(...rowsPly.map(r=>r.pcTorsoPen),0).toFixed(3)}m, 头颈命中 ${pcHeadBad(rowsPly).length}/56)`);
if(b1.length||b2.length){
	const mini=[...b1,...b2].slice(0,8);
	for(const r of mini) console.log(`     · 点云越界 ${r.key}(${r.kind})/${r.pose}: 最深 ${r.pcTorsoPen.toFixed(3)}m, 距肩窝 ${r.pcPocket===null?'—':r.pcPocket.toFixed(3)}m`);
}
chk(A1.handRBad.length===0&&A1.handLBad.length===0,`④′ Bot 路径: 双手到武器表面全 ≤0.06m (右最差 ${Math.max(...rowsBot.map(r=>r.handR)).toFixed(3)} / 左最差 ${Math.max(...rowsBot.map(r=>r.handL)).toFixed(3)})`);
chk(A2.handRBad.length===0&&A2.handLBad.length===0,`④′ 玩家路径: 双手到武器表面全 ≤0.06m (右最差 ${Math.max(...rowsPly.map(r=>r.handR)).toFixed(3)} / 左最差 ${Math.max(...rowsPly.map(r=>r.handL)).toFixed(3)})`);
if(A1.torsoBad.length||A2.torsoBad.length||A1.headBad.length||A2.headBad.length||A1.handRBad.length||A2.handRBad.length){
	console.log('\n── 反例最小子集 (未达标项) ──');
	const mini=[...A1.torsoBad,...A2.torsoBad,...A1.headBad,...A2.headBad,...A1.handRBad,...A1.handLBad,...A2.handRBad,...A2.handLBad];
	const seen=new Set();
	for(const r of mini){ const k=r.key+'/'+r.pose; if(seen.has(k)) continue; seen.add(k);
		console.log(`   ${r.key} (${r.kind}) ${r.pose}: 头相交=${r.interHead}(深${r.headPen.toFixed(3)}) 躯干相交=${r.interTorso}(深${r.torsoPen.toFixed(3)}, 肩窝距=${r.pocketDist===null?'—':r.pocketDist.toFixed(3)}) 手R=${r.handR} 手L=${r.handL}`); }
}
// ② 挂点
console.log('\n② 挂点 (躯干局部 x<0 且 y<0.45)');
const mountRows=[];
for(const r of rowsBot){ if(mountRows.some(m=>m.kind===r.kind)) continue; mountRows.push({kind:r.kind,key:r.key,m:r.mount,want:run(ctxC,`JSON.stringify(gunMountOf('${r.kind}'))`)}); }
for(const m of mountRows) console.log(`   ${m.kind.padEnd(9)} 实测 (${m.m.x.toFixed(3)}, ${m.m.y.toFixed(3)}, ${m.m.z.toFixed(3)})  期望 gunMountOf ${m.want}`);
const mountBad=mountRows.filter(m=>!(m.m.x<0&&(m.kind==='launcher'?true:m.m.y<0.45)));
const mountShoulder=mountRows.filter(m=>m.kind!=='launcher'&&!(m.m.y<0.45));
const mountMismatch=mountRows.filter(m=>{ const w=JSON.parse(m.want); return Math.abs(w.x-m.m.x)>1e-6||Math.abs(w.y-m.m.y)>1e-6||Math.abs(w.z-m.m.z)>1e-6; });
chk(mountBad.length===0&&mountShoulder.length===0,`② 全部 ${mountRows.length} 类武器挂点 x<0 (右手侧); 除 launcher (扛肩式, Lead 裁定) 外 y<0.45`);
chk(mountMismatch.length===0,`② 实测挂点 == gunMountOf(kind) 单源 (不漂移)`);
info('默认类 (步枪/冲锋枪/机枪) 挂点: '+JSON.stringify(mountRows.find(m=>m.kind==='rifle'||m.kind==='smg')?.m||null)+' (Lead 给的修前独立基线: (0.140, 0.400))');
const rowB0=rowsBotB[0];
info('修前受控变体 (旧挂点): '+rowB0.mount.x+'/'+rowB0.mount.y);

// ③′ 俯仰扫描
console.log('\n③′ 枪随手动 (交战态 aim pitch ±0.3rad ⇒ 枪身俯仰与右肩同源)');
const SW=keys.filter(k=>['springfield','bazooka','ptrd','bar'].indexOf(k)>=0);
for(const path of ['bot','player']){
	for(const key of SW){
		const s=run(ctxC,`__JM.sweep(${JSON.stringify(path)},${JSON.stringify(key)},'aim')`);
		const a=Math.abs(1);
		const dG=[s[0].gp[0]-s[1].gp[0],s[0].gp[1]-s[1].gp[1],s[0].gp[2]-s[1].gp[2]];
		const dH=[s[0].hand[0]-s[1].hand[0],s[0].hand[1]-s[1].hand[1],s[0].hand[2]-s[1].hand[2]];
		const mG=Math.hypot(...dG), mH=Math.hypot(...dH);
		const cos=mG>1e-9&&mH>1e-9?(dG[0]*dH[0]+dG[1]*dH[1]+dG[2]*dH[2])/(mG*mH):0;
		const ratio=mG/Math.max(1e-9,mH);
		const r0=Math.hypot(s[0].gp[0]-s[0].anchor[0],s[0].gp[1]-s[0].anchor[1],s[0].gp[2]-s[0].anchor[2]);
		const r1=Math.hypot(s[1].gp[0]-s[1].anchor[0],s[1].gp[1]-s[1].anchor[1],s[1].gp[2]-s[1].anchor[2]);
		const rv=r0>1e-9?Math.abs(r1-r0)/r0*100:0;
		const h0=Math.hypot(s[0].hand[0]-s[0].anchor[0],s[0].hand[1]-s[0].anchor[1],s[0].hand[2]-s[0].anchor[2]);
		const h1=Math.hypot(s[1].hand[0]-s[1].anchor[0],s[1].hand[1]-s[1].anchor[1],s[1].hand[2]-s[1].anchor[2]);
		const hv=h0>1e-9?Math.abs(h1-h0)/h0*100:0;
		console.log(`   ${path.padEnd(6)} ${key.padEnd(12)} 枪点位移 ${mG.toFixed(4)}m / 手位移 ${mH.toFixed(4)}m ⇒ 量比 ${ratio.toFixed(3)} 同向cos ${cos.toFixed(4)} | 半径变化 枪 ${rv.toFixed(2)}% 手 ${hv.toFixed(2)}%`);
		chk(cos>=0.9&&ratio>=0.8&&ratio<=1.25,`③′(${path}/${key}) 同向且量比 0.8~1.25 (cos=${cos.toFixed(3)} ratio=${ratio.toFixed(3)})`);
		chk(rv<=5,`③′(${path}/${key}) 枪点绕 gunG 锚半径变化 ${rv.toFixed(2)}% ≤5%`);
	}
}
console.log('\n③′(c) 额外独立判据 (informational): 直接转枪身 gunG.rotation.x ±0.3 时手的位移');
console.log('    说明: 该协议在"枪刚性挂躯干 + 手臂 IK 追枪"的架构下**不判别** —— 手的位置由每帧动画重算,');
console.log('    单帧直改 gunG 不会回灌到手臂; 真正的判别由上面的 ③′ 俯仰扫描 (枪与手同源驱动) 给出。');
for(const path of ['bot','player']){
	const key='bar';
	const s=run(ctxC,`__JM.gunSweep(${JSON.stringify(path)},${JSON.stringify(key)},'aim')`);
	const sB=run(ctxB,`__JM.gunSweep(${JSON.stringify(path)},${JSON.stringify(key)},'aim')`);
	const m=(a)=>{ const dG=[a[0].gp[0]-a[1].gp[0],a[0].gp[1]-a[1].gp[1],a[0].gp[2]-a[1].gp[2]];
		const dH=[a[0].hand[0]-a[1].hand[0],a[0].hand[1]-a[1].hand[1],a[0].hand[2]-a[1].hand[2]];
		return {g:Math.hypot(...dG),h:Math.hypot(...dH)}; };
	const A=m(s),B=m(sB);
	console.log(`   ${path.padEnd(6)} 修后: 枪 ${A.g.toFixed(4)}m / 手 ${A.h.toFixed(4)}m ⇒ 量比 ${(A.g/Math.max(1e-9,A.h)).toFixed(3)} | 修前变体: 枪 ${B.g.toFixed(4)}m / 手 ${B.h.toFixed(4)}m ⇒ 量比 ${(B.g/Math.max(1e-9,B.h)).toFixed(3)}`);
}
// 修前 ④′ 基线 (受控变体) 对照
const aggB=(rows,name)=>{
	const worstR=Math.max(...rows.map(r=>r.handR)), worstL=Math.max(...rows.map(r=>r.handL));
	const perPose=p=>{ const a=rows.filter(r=>r.pose===p); return {R:Math.max(...a.map(r=>r.handR)),L:Math.max(...a.map(r=>r.handL))}; };
	console.log(`   修前变体 ${name}: 右手最差 ${worstR.toFixed(3)}m 左手最差 ${worstL.toFixed(3)}m | `+poses.map(p=>p+' R'+perPose(p).R.toFixed(3)+'/L'+perPose(p).L.toFixed(3)).join(' · '));
	return {worstR,worstL};
};
console.log('\n④′ 修前/修后两列');
const PB=aggB(rowsBotB,'Bot 路径'), PP=aggB(rowsPlyB,'玩家路径');
info('Lead 给的独立量测基线 (修前): 站 0.197 / 据枪 0.259 / 蹲 0.261 / 匍匐 0.297 (实现者自报变体不可信, 已弃用)');
chk(PB.worstR>0.06&&PP.worstR>0.06,`受控变体确实"修前"(手离枪 >0.06m: Bot ${PB.worstR.toFixed(3)} / 玩家 ${PP.worstR.toFixed(3)}) ⇒ ④′ 判据有判别力`);

// 定性诊断 (匍匐)
console.log('\n定性诊断: 匍匐姿态 ④′ 未达标归因 (只报告, 不判 pass/fail)');
for(const path of ['bot','player']){
	const key=SW.find(k=>gunKindOfCached(ctxC,k)==='rifle')||'springfield';
	const d=run(ctxC,`__JM.diag(${JSON.stringify(path)},${JSON.stringify(key)})`);
	console.log(`   ${path} / ${key} (匍匐): ikRes=${JSON.stringify(d.ikRes)} | gunG实际角 x/y/z = ${d.gunRot.x.toFixed(3)}/${d.gunRot.y.toFixed(3)}/${d.gunRot.z.toFixed(3)} | 挂点 (${d.mount.x.toFixed(3)},${d.mount.y.toFixed(3)},${d.mount.z.toFixed(3)}) 期望 (${(d.mountWant&&d.mountWant.x).toFixed(3)},${(d.mountWant&&d.mountWant.y).toFixed(3)},${(d.mountWant&&d.mountWant.z).toFixed(3)})`);
	console.log(`      躯干局部系同源量法: 右手→握把点 ${d.dHandRtorso}m / 左手→护木点 ${d.dHandLtorso}m (臂长全伸 ${d.reach}m)`);
	console.log(`      左肩到枪身轴各 t 的距离: ${d.taps.map(q=>q.t+':'+q.d).join(' ')} ⇒ 首个可达 t = ${d.atr}`);
	if(path==='bot') console.log(`      Bot 侧 ikRes 档案 (匍匐): ${JSON.stringify(d.ikRes)}`);
}
function gunKindOfCached(ctx,key){ return vm.runInContext(`gunKindOf(${JSON.stringify(key)})`,ctx); }

console.log(`\n契约 J 独立复测: ${fails===0?'全部通过 ✓':'存在失败 ✗'} (${checks-fails}/${checks}) (复现: node dev/verify-a21-j.js)`);
process.exit(fails===0?0:1);
