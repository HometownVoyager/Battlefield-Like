// ─────────────────────────────────────────────────────────────
// dev/verify-crushhead-20261103.js —— 2026-11-03 碾压/头盔批验收
//   ① 坦克碾压伤害改档 (用户裁定): 通用 99 (满血步兵碾而不死留 1 血) / 日系 chiha 形
//     (九七式中战车·一式中战车·九七式(缴获)·一式(缴获)) 80; 分档键 = def.tk.shape (非 wc 车重)。
//   ② 碾而不死宽限: vehiclePushSoldiers 幸存者发 s._crushCd=TANK_CRUSH_CD(1.2s 墙钟) ——
//     窗内不再吃碾压伤害但照常被侧向限幅推挤清出车壳 (与友军挤开同一支), 防止"连续碾每帧结算"
//     把 99/80 打成事实秒杀 (那会让改数值体感为零)。卡车 300 / 两栖 320 本批不动 (范围护栏)。
//   ③ 头盔穿模修复 (用户实测: 方头四上角总从盔里探出来): 头盒半宽 0.1 → 上角离轴 0.1414, 旧盔
//     在头顶高度的**多面体化**截面半径 0.122~0.137 必穿。四盔统一放大球冠 (pot .15→.162 / stahl
//     .155→.165 / ssh .152→.167 / jp .142→.165) 并微调冠高, 头盒/爆头命中球 (13-combat r=0.26) 不动。
//     判据 = 用真 built mesh 的 geometry.parameters 重算"弦多面体盔面沿角射线"的最小压角裕量 ≥2.5mm。
//     顺带修: 日军星徽/国军青天白日徽旧 z 本就埋在盔面内侧从未露出 → 挪到新盔面上 (前缘出面 / 后缘埋入)。
//
// 用法: node dev/verify-crushhead-20261103.js [--neg]
//   --neg = 阴性对照: 装载前按单行锚把本批改动还原成旧写法, 行为/几何判据必须报红 (7 处补丁)。
// 口径: 与 verify-parity-20261103 同款 boot (真 three + index.html 全脚本链 + startBtn 开局);
//   开局战役 = island (us vs jp: pot 盔 + chiha 坦克 + 谢尔曼同场), 其余阵营经 TEAM_FACTION[0] 换挂实测。
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
 ['js/15-vehicles.js','&&!(s._crushCd>0)',''],                                                        // 宽限门退场
 ['js/15-vehicles.js','s._crushCd=TANK_CRUSH_CD;',''],                                               // 发账退场
 ['js/15-vehicles.js','_o.crushDmg=this.crushDmg;','_o.crushDmg=320;'],                              // 回 320 一击必杀
 ['js/11-soldiers.js','SphereGeometry(0.162,10,8,0,TAU,0,HPI*1.2)','SphereGeometry(0.15,10,8,0,TAU,0,HPI*1.2)'],   // pot 回旧
 ['js/11-soldiers.js','SphereGeometry(0.165,10,8,0,TAU,0,HPI*1.35)','SphereGeometry(0.155,10,8,0,TAU,0,HPI*1.35)'], // stahl 回旧
 ['js/11-soldiers.js','SphereGeometry(0.167,10,8,0,TAU,0,HPI*1.28)','SphereGeometry(0.152,10,8,0,TAU,0,HPI*1.28)'], // ssh 回旧
 ['js/11-soldiers.js','SphereGeometry(0.165,10,8,0,TAU,0,HPI*1.22)','SphereGeometry(0.142,10,8,0,TAU,0,HPI*1.22)'], // jp 回旧
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
const s00=srcOf('js/00-config.js'), s15=srcOf('js/15-vehicles.js'), s11=srcOf('js/11-soldiers.js');
assert('00 碾压常量单源 (通用 99 / chiha 80 / 宽限 1.2s)',
 s00.includes('const TANK_CRUSH_DMG=99;')
 &&s00.includes('const TANK_CRUSH_DMG_CHIHA=80;')
 &&s00.includes('const TANK_CRUSH_CD=1.2;'));
assert('15 Tank 构造器分档 (键=tk.shape===chiha, 非 wc 车重)',
 s15.includes("this.crushDmg=(this.def.tk&&this.def.tk.shape==='chiha')?TANK_CRUSH_DMG_CHIHA:TANK_CRUSH_DMG;"));
assert('15 坦克调用点读实例账 (旧 _o.crushDmg=320 已摘)',
 s15.includes('_o.crushDmg=this.crushDmg;')&&!s15.includes('_o.crushDmg=320;'));
assert('15 幸存宽限三件: 墙钟衰减 + 门 + 发账',
 s15.includes('if(s._crushCd>0) s._crushCd-=o.dt;')
 &&s15.includes('o.moving&&frontal&&s.team!==veh.team&&!(s._crushCd>0)')
 &&s15.includes('s._crushCd=TANK_CRUSH_CD;'));
assert('15 范围护栏: 卡车 300 / 两栖 320 本批不动 (碾压分档只管坦克)',
 SRC('js/15b-trucks.js').includes('_o.crushDmg=300;')
 &&SRC('js/15d-naval.js').includes('_o.crushDmg=320;'));
assert('11 四盔球冠放大 (pot .162 / stahl .165 / ssh .167 / jp .165) + 冠高跟调',
 s11.includes('new THREE.SphereGeometry(0.162,10,8,0,TAU,0,HPI*1.2)')
 &&s11.includes('new THREE.SphereGeometry(0.165,10,8,0,TAU,0,HPI*1.35)')
 &&s11.includes('new THREE.SphereGeometry(0.167,10,8,0,TAU,0,HPI*1.28)')
 &&s11.includes('new THREE.SphereGeometry(0.165,10,8,0,TAU,0,HPI*1.22)')
 &&s11.includes('helm.position.set(0,0.154,0)')&&s11.includes('helm.position.set(0,0.145,0)')
 &&s11.includes('helm.position.set(0,0.153,0)')&&s11.includes('helm.position.set(0,0.146,0)'));
assert('11 头盒不动 (0.2×0.22×0.2) + 爆头命中球不动 (r=0.26 与头盒解耦)',
 s11.includes('bx(U.skin,0.2,0.22,0.2, 0,0.1,0, headG);')
 &&SRC('js/13-combat.js').includes('const hr=0.26+ex;'));
assert('11 两徽章出盔面 (日军星 0.1535 / 国军蓝 0.1755+白 0.1775; 旧 z 本就埋在盔内从未露出)',
 s11.includes('0,0.16,0.1535')&&s11.includes('0,0.17,0.1755')&&s11.includes('0,0.17,0.1775'));
}

// ── 沙箱装载 (真 three; 与 verify-parity 同款 boot + 全 index.html 脚本链) ─────
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
function bootStart(campIdx,zsub,label){
const {ctx}=boot(campIdx,zsub);
const G=s=>vm.runInContext(s,ctx,{timeout:300000});
let err=null;
try{ G("document.getElementById('startBtn').onclick();"); }catch(e){ err='start: '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); }
if(!err){ try{ G('if(!player.alive||!player.deployed) deployPlayer();'); }catch(e){ err='deploy: '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); } }
if(!err) try{ G('for(const s of soldiers) s.protUntil=0; player.protUntil=0;'); }catch(e){}
assert(label,!err&&G('player.alive')===true,err||'');
return {ctx,G};
}

// ── ② 坦克碾压分档 + 幸存宽限/挤开 (island 真开局: us vs jp) ──
let ISL=-1;
{ const c0=boot(0); ISL=vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="island")',c0.ctx); }
section('② 碾压分档 + 幸存宽限/挤开 (island 真开局, 阵营换挂实测)');
const B=bootStart(ISL,null,'②A 开局+部署 (island)');
{
const r=B.G(`(()=>{
const out={}; const made=[]; out.left0=tanks.length;
const mkT=(team,variant)=>{ const t=new Tank(team,variant); made.push(t); return t; };
// 本局双阵营: 0=us (谢尔曼/潘兴) 1=jp (九七/一式 chiha)
out.jp0=mkT(1,0).crushDmg; out.jp1=mkT(1,1).crushDmg;
out.us0=mkT(0,0).crushDmg; out.us1=mkT(0,1).crushDmg;
// 换挂其余阵营 (TEAM_FACTION[0] 指换, 用后还原): 分档键实测
const _sv=TEAM_FACTION[0];
TEAM_FACTION[0]=FACTIONS.ger; out.ger1=mkT(0,1).crushDmg;   // 黑豹 → 99
TEAM_FACTION[0]=FACTIONS.kmt; out.kmt0=mkT(0,0).crushDmg;   // 维克斯6吨 (light!) → 99 (键是 shape 不是 wc)
TEAM_FACTION[0]=FACTIONS.cpc; out.cpc0=mkT(0,0).crushDmg; out.cpc1=mkT(0,1).crushDmg; // 缴获两版 → 80
TEAM_FACTION[0]=FACTIONS.sov; out.sov1=mkT(0,1).crushDmg;   // KV-1 → 99
TEAM_FACTION[0]=_sv;
// 清场: 测试坦克全撤 (编制表/场景还原)
for(const t of made){ t.alive=false; const i=tanks.indexOf(t); if(i>=0) tanks.splice(i,1); if(t.grp&&t.grp.parent) t.grp.parent.remove(t.grp); }
out.left=tanks.length;
return out; })()`);
assert('② 日系 chiha 形 = 80 (九七式中战车/一式中战车)',
 r.jp0===80&&r.jp1===80,JSON.stringify([r.jp0,r.jp1]));
assert('② 通用坦克 = 99 (谢尔曼/潘兴/黑豹/KV-1)',
 r.us0===99&&r.us1===99&&r.ger1===99&&r.sov1===99,JSON.stringify([r.us0,r.us1,r.ger1,r.sov1]));
assert('② 缴获两版 = 80; 维克斯(light) = 99 (分档键=shape 实证)',
 r.cpc0===80&&r.cpc1===80&&r.kmt0===99,JSON.stringify([r.cpc0,r.cpc1,r.kmt0]));
assert('② 测试坦克清场还原 (tanks.length 回原值)',r.left===r.left0,`left0=${r.left0} left=${r.left}`);

// vehiclePushSoldiers 单元: 假车 + 假兵 (combatants 临时清场用后还原)
const u=B.G(`(()=>{
const out={};
const _cb=combatants.splice(0,combatants.length);
try{
const veh={pos:new THREE.Vector3(0,heightAt(0,0),0),yaw:0,vel:8,team:1,name:'碾车'};
const crusher={name:'碾车车组',isPlayer:false};
const o={dt:1/60,crusher,moving:true,yMax:1.9,frontalBand:1.5,symmetricFrontal:false,crushDmg:99,pushVel:8,checkSpectator:false};
const mkS=(x,z,team)=>({alive:true,team,pos:new THREE.Vector3(x,heightAt(x,z),z),hp:100,isPlayer:false,
 onVehicle:false,spectator:false,clingVeh:false,
 damage(amt,src){ this.hp-=amt; this.lastSrc=src; if(this.hp<=0) this.alive=false; }});   // 模拟真 damage 契约: 血尽置亡
// 车前带内正中 (hz=3.0, band lz∈[1.5,3.0]; lx=0 最难侧挤)
const s=mkS(0,2.85,0); combatants.push(s);
vehiclePushSoldiers(veh,2.05,3.0,o);
out.c1={hp:s.hp,alive:s.alive,cd:s._crushCd};
for(let i=0;i<30;i++){ s.pos.set(0,s.pos.y,2.85); vehiclePushSoldiers(veh,2.05,3.0,o); } // 0.5s < 1.2s
out.c2={hp:s.hp,cd:s._crushCd};
for(let i=0;i<10;i++) vehiclePushSoldiers(veh,2.05,3.0,o); // 不重置: 应被逐帧侧推挤出壳
out.c3={hp:s.hp,x:s.pos.x,cd:s._crushCd};
s._crushCd=0; s.pos.set(0,s.pos.y,2.85);
const hpB=s.hp;
vehiclePushSoldiers(veh,2.05,3.0,o);
out.c4={hp:s.hp,hpB,alive:s.alive};
const f=mkS(0,2.85,1); combatants.push(f);   // 友军
vehiclePushSoldiers(veh,2.05,3.0,o);
out.c5={hp:f.hp,x:f.pos.x};
}finally{ combatants.splice(0,combatants.length); for(const c of _cb) combatants.push(c); }
return out; })()`);
assert('② 碾一下: 99 → 1 血存活 + 发宽限账',
 u.c1.hp===1&&u.c1.alive===true&&u.c1.cd>0,JSON.stringify(u.c1));
assert('② 宽限窗内 30 次贴带零二次结算 (旧写法此处已是尸体)',
 u.c2.hp===1&&u.c2.cd>0,JSON.stringify(u.c2));
assert('② 宽限内被侧向挤出到壳外 (与友军挤开同款限幅推挤, 不穿车体)',
 u.c3.hp===1&&Math.abs(u.c3.x)>=2.42,JSON.stringify(u.c3));
assert('② 宽限走完恢复结算: 仍贴车前 → 1 血必死 (宽限≠免死金牌)',
 u.c4.hp===u.c4.hpB-99&&u.c4.alive===false,JSON.stringify(u.c4));
assert('② 友军只挤开不掉血 (回归护栏)',u.c5.hp===100,JSON.stringify(u.c5));
}

// ── ③ 头盔穿模: 真 built mesh 参数重算多面体盔面压角裕量 (≥2.5mm) + 徽章出面/埋入 ──
section('③ 头盔几何 (island 同局, TEAM_FACTION[0] 换盔型实测 ×5)');
{
const r=B.G(`(()=>{
const out={};
const _helm=TEAM_FACTION[0].helmet, _sym=TEAM_FACTION[0].sym;
const seg=10, step=2*Math.PI/seg, mid=step/2;
const CORNER=Math.SQRT1_2*0.2, HEAD_TOP=0.21;
// 弦多面体盔面沿"头盒上角射线"的最小裕量 (mm): 缩放空间里角点像的方位角求弦因子, 反解真空间边界距
function minMargin(d){
 const rimY=d.y0+d.r*Math.cos(d.thL)*d.sy;
 let worst=Infinity;
 for(let i=0;i<=48;i++){
  const y=HEAD_TOP-(HEAD_TOP-rimY)*i/48;
  const ct=(y-d.y0)/(d.r*d.sy);
  if(ct<-1||ct>1) continue;
  const st=Math.sqrt(1-ct*ct);
  const a=d.r*st, b=d.r*st*d.sz;
  const az=Math.atan2(1/b,1/a);
  const rel=((az%step)+step)%step;
  const fac=Math.cos(mid)/Math.cos(rel-mid);
  const tB=Math.SQRT2*fac/Math.hypot(1/a,1/b);
  worst=Math.min(worst,(tB-CORNER)*1000);
 }
 return worst;
}
// 徽章高度处的盔面 z (前向 az=90° 落在 72°/108° 顶点弦正中 → fac=cos(18°))
function surfZ(d,y){
 const ct=(y-d.y0)/(d.r*d.sy);
 const st=Math.sqrt(Math.max(0,1-ct*ct));
 return d.r*st*d.sz*Math.cos(mid)/Math.cos(0);
}
for(const hk of ['pot','stahl','ssh','jp','cap']){
 TEAM_FACTION[0].helmet=hk; TEAM_FACTION[0].sym=(hk==='stahl')?'✷':'★';
 const m=buildSoldierMesh(0,'几何');
 const spheres=[],badges=[];
 m.headG.traverse(o=>{
  if(o.isMesh&&o.geometry){
   if(o.geometry.type==='SphereGeometry') spheres.push(o);
   const c=o.material&&o.material.color&&o.material.color.getHex();
   if(o.geometry.type==='BoxGeometry'&&(c===0x2050b0||c===0xe8e8e8||c===0xd8b840))
    badges.push({c,z:o.position.z,y:o.position.y,depth:o.geometry.parameters.depth});
  }});
 const it={n:spheres.length};
 if(spheres.length===1){
  const p=spheres[0].geometry.parameters;
  const d={r:p.radius,thL:p.thetaLength,y0:spheres[0].position.y,sy:spheres[0].scale.y||1,sz:spheres[0].scale.z||1};
  it.d=d; it.margin=minMargin(d);
  it.badges=badges.map(b=>{ const sz=surfZ(d,b.y);
   return {c:b.c,front:(b.z+b.depth/2)-sz,back:sz-(b.z-b.depth/2)}; });
 }
 out[hk]=it;
}
TEAM_FACTION[0].helmet=_helm; TEAM_FACTION[0].sym=_sym;
return out; })()`);
assert('③ pot 盔压角裕量 ≥2.5mm (旧 .15 为 -5.3mm 必穿)',
 r.pot.n===1&&r.pot.margin>=2.5,`margin=${r.pot.margin&&r.pot.margin.toFixed(2)}mm r=${r.pot.d&&r.pot.d.r}`);
assert('③ stahl 盔压角裕量 ≥2.5mm (旧 .155 盔沿 -3.9mm 必穿)',
 r.stahl.n===1&&r.stahl.margin>=2.5,`margin=${r.stahl.margin&&r.stahl.margin.toFixed(2)}mm r=${r.stahl.d&&r.stahl.d.r}`);
assert('③ ssh 盔压角裕量 ≥2.5mm (旧 .152 盔沿 -9.0mm 必穿)',
 r.ssh.n===1&&r.ssh.margin>=2.5,`margin=${r.ssh.margin&&r.ssh.margin.toFixed(2)}mm r=${r.ssh.d&&r.ssh.d.r}`);
assert('③ jp 盔压角裕量 ≥2.5mm (旧 .142 头顶 -19.4mm 必穿)',
 r.jp.n===1&&r.jp.margin>=2.5,`margin=${r.jp.margin&&r.jp.margin.toFixed(2)}mm r=${r.jp.d&&r.jp.d.r}`);
assert('③ 八路布帽 = 盒无球冠 (本就盖过 0.1414 上角, 不在修复面)',
 r.cap.n===0);
assert('③ 日军星徽出盔面 (~1mm) 且后缘埋入固定 (旧 z=0.135 埋在盔内从未露出)',
 r.jp.badges.length===1&&r.jp.badges[0].c===0xd8b840
 &&r.jp.badges[0].front>=0.0005&&r.jp.badges[0].back>=0.0005,JSON.stringify(r.jp.badges));
assert('③ 国军青天白日徽蓝/白两层出盔面且埋入固定 (旧 0.148/0.15 埋在盔内从未露出)',
 r.stahl.badges.length===2
 &&r.stahl.badges.every(b=>b.front>=0.0005&&b.back>=0.0005),JSON.stringify(r.stahl.badges));
}

// ── ④ 版本戳 ──
section('④ 版本戳');
{
const idx=SRC('index.html'), gf=SRC('dev/_game_files.txt');
const stamps=[...idx.matchAll(/20261117a/g)].length;
assert('版本戳 20261117a: index.html 全量唯一 + __sfStyleVer + _game_files 全行 (2026-11-10 海战移除批判据跟码)',
 stamps>=48&&idx.includes("window.__sfStyleVer='20261117a';")
 &&gf.split(/\r?\n/).filter(l=>l.includes('?v=20261117a')).length===45
 &&!idx.includes('20261103b')&&!gf.includes('20261103b'));
}

console.log('\n' + (BAD.length? `✗ ${BAD.length} 红 / ${OK.length} 绿` : `✓ 全绿 (${OK.length})`));
if(BAD.length){ process.exitCode=1; if(NEG) console.log('(阴性对照: 有红=判据具备分辨力)'); }
else if(NEG){ console.log('✗ 阴性对照全绿 = 判据空转!'); process.exitCode=1; }
