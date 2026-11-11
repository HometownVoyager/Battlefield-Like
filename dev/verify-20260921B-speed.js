// ─────────────────────────────────────────────
// dev/verify-20260921B-speed.js —— task-3 独立验收 ⑧ 弹速统一 + life 读数 (判据随口径走)
//   ★ 2026-09-28 口径更新 (用户裁定「各种炮弹的弹速乘二」): 190 → **380** (枪弹是即时命中射线, 无弹速)。
//     2026-09-21B 的"射程包线守恒"随之作废: 本批就是"弹速×2 ⇒ 包线×2" (life 不动), ③ 改为核验**恰好 ×2**。
//
// 三层证据 (全部实跑, 不采信作者自报):
//   ① 单源: 运行时读 SHELL_SPD / SHELL_SPD_NAVAL / NAVAL_SPEC[*].main.spd (真启动沙箱, 岛图);
//   ② 6 处开火点**真开火**: 用真启动的沙箱逐个调真实开火入口 (坦克 fireCannon / 幽灵坦克
//      GhostTank.fireCannon / emplATFire / fireFlak / NavalCraft.fireMain / Battery.fire),
//      在 shells.push / flakShots.push 上装取证钩子, 读出**实际**出膛速度与 life;
//   ③ 解析核算射程包线 (速度×life) 与本批前 (口径 §8 记载的旧值) 逐条对照;
//      另扫全仓 js/*.js 是否残留旧海战弹速硬写字面量。
//
// 用法: node dev/verify-20260921B-speed.js
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
let checks=0,failures=0;
const chk=(c,m)=>{ checks++; console.log((c?'  ✓ ':'  ✗ ')+m); if(!c) failures++; };
const f3=v=>(Math.round(v*1000)/1000).toFixed(3);
const f2=v=>(Math.round(v*100)/100).toFixed(2);

// ══════════════ 真启动沙箱 (与 dev/_battery-selfcheck.js 同一装法) ══════════════
const {sandbox,document,window:winStub}=require('./_bootstub.js');
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
sandbox.AudioContext=ACStub; sandbox.window.AudioContext=ACStub; sandbox.window.webkitAudioContext=ACStub;
delete sandbox.window.CANNON;
class PlaneAttr{
	constructor(gx,gy,w,h){ this.count=gx*gy; this.itemSize=3; this.array=new Float32Array(gx*gy*3); this._gx=gx; this._gy=gy; this._w=w; this._h=h; }
	getX(i){ return ((i%this._gx)/this._gx-0.5)*this._w; }
	getZ(i){ return (Math.floor(i/this._gx)/this._gy-0.5)*this._h; }
	getY(i){ return this.array[i*3+1]; }
	setX(i,v){ this.array[i*3]=v; } setY(i,v){ this.array[i*3+1]=v; } setZ(i,v){ this.array[i*3+2]=v; }
}
class PlaneGeoFix extends sandbox.THREE.BufferGeometry{
	constructor(w=1,h=1,sg=1,sh=1){ super(w,h); const gx=Math.max(1,sg|0)+1, gy=Math.max(1,sh|0)+1;
		this.parameters={width:w,height:h,widthSegments:gx-1,heightSegments:gy-1};
		this.attributes.position=new PlaneAttr(gx,gy,w,h); }
}
sandbox.THREE.PlaneGeometry=PlaneGeoFix;
function scriptList(){
	const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
	const out=[]; const re=/<script src="(js\/[^"?]+)/g; let m;
	while((m=re.exec(html))) out.push(m[1]);
	return out;
}
const FILES=scriptList();
function mulberry32(a){ return function(){ a|=0; a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }
function boot(campIdx){
	const ctx=vm.createContext(Object.assign({},sandbox));
	ctx.document=document; ctx.window=winStub; ctx.globalThis=ctx;
	const M=Object.create(Math); M.random=mulberry32(42); ctx.Math=M;
	ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
	ctx.console={log(){},warn(){},error(){}};
	for(const f of FILES) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
	return ctx;
}
function campIdxOf(id){
	const ctx=vm.createContext(Object.assign({},sandbox));
	ctx.document=document; ctx.window=winStub; ctx.globalThis=ctx;
	ctx.localStorage={_s:{},getItem:()=>null,setItem(){},removeItem(){}};
	ctx.console={log(){},warn(){},error(){}};
	vm.runInContext(fs.readFileSync(path.join(root,'js/00-config.js'),'utf8'),ctx,{filename:'00-config.js'});
	return vm.runInContext(`CAMPAIGNS.findIndex(c=>c.id==='${id}')`,ctx);
}
const SRC15V=fs.readFileSync(path.join(root,'js/15-vehicles.js'),'utf8');
const HASH15V=crypto.createHash('sha256').update(SRC15V).digest('hex').toUpperCase().slice(0,16);
console.log('═══ ⑧ 弹速统一 380 (2026-09-28 ×2 裁定) + life 读数 · 独立验收 ═══');
console.log('   js/15-vehicles.js sha256:' + HASH15V + '… (SHELL_SPD 定义处) · 脚本表 ' + FILES.length + ' 个');

// ── ① 运行时单源 ──
const ISLAND=campIdxOf('island');
const ctx=boot(ISLAND);
const run=c=>vm.runInContext(c,ctx);
const CONSTS=JSON.parse(run(`JSON.stringify({SHELL_SPD,SHELL_SPD_NAVAL,
 naval:Object.fromEntries(Object.entries(NAVAL_SPEC).map(([k,v])=>[k,v.main?{spd:v.main.spd,dmg:v.main.dmg,name:v.main.name}:null])),
 batteryGun:batteryGunDef(),
 counts:{tanks:tanks.length,ghost:(typeof specVehGet==='function'?'有入口':'无'),naval:navalCraft.length,planes:planes.length,atguns:ATGUNS.length,batteries:BATTERIES.length}})`));
console.log('\n① 运行时单源读数 (真启动沙箱, 岛图):');
console.log('   SHELL_SPD=' + CONSTS.SHELL_SPD + '  SHELL_SPD_NAVAL=' + CONSTS.SHELL_SPD_NAVAL);
for(const [k,v] of Object.entries(CONSTS.naval)) console.log('   NAVAL_SPEC.' + k.padEnd(7) + ' main.spd=' + v.spd + '  dmg=' + v.dmg + '  ' + v.name);
console.log('   batteryGunDef() = ' + JSON.stringify(CONSTS.batteryGun));
console.log('   实例数: ' + JSON.stringify(CONSTS.counts));
chk(CONSTS.SHELL_SPD === 380, '①-1 SHELL_SPD = ' + CONSTS.SHELL_SPD + ' (期望 380 = 190×2)');
chk(CONSTS.SHELL_SPD_NAVAL === 380, '①-2 SHELL_SPD_NAVAL = ' + CONSTS.SHELL_SPD_NAVAL + ' (期望 380; 常量名保留)');
const badNaval=Object.entries(CONSTS.naval).filter(([k,v])=>v.spd!==380);
chk(badNaval.length === 0, '①-3 NAVAL_SPEC 全部 ' + Object.keys(CONSTS.naval).length + ' 型的 main.spd 都是 380' + (badNaval.length?('  ✘ ' + JSON.stringify(badNaval)):''));
chk(CONSTS.batteryGun.spd === 380, '①-4 岸炮 batteryGunDef().spd = 380 (走 SHELL_SPD_NAVAL 单源, 非兜底 115)');

// ── ② 6 处开火点真开火取证 ──
const CAPTURE=`(()=>{
 globalThis.__cap=[];
 const _sp=shells.push.bind(shells), _fp=flakShots.push.bind(flakShots);
 shells.push=function(s){ __cap.push({ch:'shells',spd:s.vel?(s.vel.length?s.vel.length():Math.hypot(s.vel.x,s.vel.y,s.vel.z)):null,life:s.life,kind:s.kind,pos:[s.pos.x,s.pos.y,s.pos.z]}); return _sp(s); };
 flakShots.push=function(s){ __cap.push({ch:'flakShots',spd:s.vel?(s.vel.length?s.vel.length():Math.hypot(s.vel.x,s.vel.y,s.vel.z)):null,life:s.life,kind:'flak',pos:[s.pos.x,s.pos.y,s.pos.z]}); return _fp(s); };
})()`;
run(CAPTURE);
const shoot=`(()=>{
 const R={};
 const D=(n)=>{ const v=V3(n*0.35,0.1,n*0.93); v.normalize(); return v; };   // 真游戏里 dir 恒已归一化 (aimDir/batteryFire 口径)
 const take=(n)=>{ const last=__cap.filter(c=>!c.used).pop(); if(!last) return null; last.used=true; return last; };
 // 1) 陆战坦克 (真 Tank 实例 + 真 fireCannon) —— 岛图开局 tanks 为空, 按 15-vehicles 构造口径现建一台
 try{
  const t=new Tank(0,0);
  t.pos.set(0,heightAt(0,0),0); t.cannonCd=0; t.isAI=false; t.crewBot={isBot:true,team:0,_src:'verify'};
  __cap.length=0;
  t.fireCannon(D(1)); R.tank=take('tank');
 }catch(e){ R.tank={err:String(e.message)}; }
 // 2) 幽灵坦克 (15c-specveh GhostTank)
 try{
  const g=specVehGet(); g.cannonCd=0; __cap.length=0;
  g.fireCannon(D(1)); R.ghost=take('ghost');
 }catch(e){ R.ghost={err:String(e.message)}; }
 // 3) 反坦克炮 (13-combat.emplATFire)
 try{
  const g=ATGUNS.find(x=>x.alive)||ATGUNS[0];
  __cap.length=0; emplATFire(g,{team:0,_src:'x',lastFiredT:0},D(1)); R.at=take('at');
 }catch(e){ R.at={err:String(e.message)}; }
 // 4) 高炮 (16-aircraft.fireFlak)
 try{
  __cap.length=0; fireFlak({x:0,y:20,z:0},{team:0,_src:'x',lastFiredT:0},D(1)); R.flak=take('flak');
 }catch(e){ R.flak={err:String(e.message)}; }
 // 5) 海战主炮 (15d NavalCraft.fireMain) —— 与 _battery-selfcheck 同装法现建一艘 PT
 try{
  if(typeof NavalCraft!=='function') throw new Error('NavalCraft 未落盘');
  const c=new NavalCraft('pt',0,0);
  c.pos.set(0,waterYAt(0,0),0); c.yaw=0; c.cannonCd=0;
  __cap.length=0;
  R.naval=(c.fireMain(D(1))===true)?take('naval'):{err:'fireMain 返回 false (state='+c.state+' alive='+c.alive+' cd='+c.cannonCd+')'};
 }catch(e){ R.naval={err:String(e.message)}; }
 // 6) 岸炮 (15f Battery.fire 静态入口)
 try{
  let ok=false;
  for(const b of BATTERIES){ if(!b.alive) continue; b.cd=0; __cap.length=0;
   const d=V3(Math.sin(b.face),0.12,Math.cos(b.face)).normalize();
   if(Battery.fire(b,d,b)===true){ R.battery=take('battery'); ok=true; break; } }
  if(!ok) R.battery={err:'4 门岸炮 fire 全被 raycast 闸门挡下或返回 false'};
 }catch(e){ R.battery={err:String(e.message)}; }
 return R;
})()`;
const SHOTS=run(shoot);
console.log('\n② 6 处开火点**真开火**取证 (真启动沙箱; 钩子在 shells.push / flakShots.push 上读数):');
console.log('   开火点            出膛速度    life    速度×life (射程包线)  弹种     出膛点');
const NAMES={tank:'陆战坦克 fireCannon',ghost:'幽灵坦克 GhostTank.fireCannon',at:'反坦克炮 emplATFire',flak:'高炮 fireFlak',naval:'海战主炮 NavalCraft.fireMain',battery:'岸炮 Battery.fire'};
const EXPECT={tank:3.6,ghost:3.6,at:2.4,flak:2.05,naval:3.4,battery:3.0};
const rows={};
for(const k of Object.keys(NAMES)){
	const s=SHOTS[k];
	if(!s||s.err){ console.log('   '+NAMES[k].padEnd(30)+'✘ ' + (s?s.err:'无捕获')); rows[k]=null; continue; }
	rows[k]=s;
	console.log('   '+NAMES[k].padEnd(30)+String(f3(s.spd)).padStart(8)+String(f3(s.life)).padStart(8)+
		String(f3(s.spd*s.life)).padStart(16)+'   '+String(s.kind).padEnd(7)+' ('+s.pos.map(v=>f2(v)).join(',')+')');
}
chk(Object.values(rows).every(Boolean), '②-0 6 处开火点全部真出膛并读到速度/life (' + Object.values(rows).filter(Boolean).length + '/6)');
for(const k of Object.keys(NAMES)){
	const s=rows[k];
	if(!s) { chk(false, '② '+NAMES[k]+' 未能取证'); continue; }
	chk(Math.abs(s.spd-380)<1e-6, '② ' + NAMES[k] + ': 出膛速度 = ' + f3(s.spd) + ' m/s (期望 380 = 190×2)');
	chk(Math.abs(s.life-EXPECT[k])<1e-9, '② ' + NAMES[k] + ': life = ' + f3(s.life) + ' (期望 ' + EXPECT[k] + ')');
}

// ── ③ 解析核算射程包线: 本批 (×2) vs 上一基线 (2026-09-21B 的 190 批) ──
console.log('\n③ 射程包线 (速度×life) 190 批基线 vs 本批 (×2):');
const OLD=[['陆战坦克',190,3.6],['幽灵坦克',190,3.6],['反坦克炮',190,2.4],['高炮',190,2.05],['海战主炮',190,3.4],['岸炮',190,3.0]];
const NEWKEY=['tank','ghost','at','flak','naval','battery'];
console.log('   开火点        基线弹速×life = 包线      本批弹速×life = 包线      倍率');
let envOK=true;
for(let i=0;i<OLD.length;i++){
	const s=rows[NEWKEY[i]];
	const [nm,ov,ol]=OLD[i];
	const oR=ov*ol, nR=s?s.spd*s.life:NaN, ratio=nR/oR;
	console.log('   '+nm.padEnd(12)+String(ov+'×'+ol+' = '+f2(oR)+'m').padEnd(22)+String(f2(s?s.spd:NaN)+'×'+f2(s?s.life:NaN)+' = '+f2(nR)+'m').padEnd(24)+
		'×'+f2(ratio)+'  '+(Math.abs(ratio-2)<=0.01?'✔ =2±1%':'✘'));
	if(!(Math.abs(ratio-2)<=0.01)) envOK=false;
}
chk(envOK, '③-1 6 条包线 (速度×life) 相对 190 批基线**恰好 ×2** (±1%; life 不动, 本批口径就是弹速与射程同步翻倍)');

// ── ④ 全仓扫旧海战弹速硬写字面量 (先剥注释: 本批代码里"原硬写 spd:110"这类说明文字不是代码) ──
function stripComments(src){
	const BS=String.fromCharCode(92), NL=String.fromCharCode(10), SQ=String.fromCharCode(39);
	let out='',i=0; const n=src.length; let q=null;
	while(i<n){
		const c=src[i],c2=src[i+1];
		if(q){ out+=c; if(c===BS){ out+=src[i+1]||''; i+=2; continue; } if(c===q) q=null; i++; continue; }
		if(c==='"'||c===SQ||c==='`'){ q=c; out+=c; i++; continue; }
		if(c==='/'&&c2==='/'){ while(i<n&&src[i]!==NL) i++; continue; }
		if(c==='/'&&c2==='*'){ i+=2; while(i<n&&!(src[i]==='*'&&src[i+1]==='/')){ if(src[i]===NL) out+=NL; i++; } i+=2; continue; }
		out+=c; i++;
	}
	return out;
}
console.log('\n④ 全仓 js/*.js 扫旧海战弹速硬写字面量 (注释已剥离):');
const files=fs.readdirSync(path.join(root,'js')).filter(f=>f.endsWith('.js'));
const BAD=[
	{re:/SHELL_SPD_NAVAL\s*=\s*115/,why:'SHELL_SPD_NAVAL=115 (旧值)'},
	{re:/SHELL_SPD\s*=\s*150/,why:'SHELL_SPD=150 (旧值)'},
	{re:/SHELL_SPD\s*=\s*190/,why:'SHELL_SPD=190 (190 批旧值, 2026-09-28 起 380)'},
	{re:/SHELL_SPD_NAVAL\s*=\s*190/,why:'SHELL_SPD_NAVAL=190 (190 批旧值, 2026-09-28 起 380)'},
	{re:/multiplyScalar\(85\)/,why:'fireRocket 旧弹速 85 (2026-09-28 起 170)'},
	{re:/dH\s*\/\s*42\b/,why:'迫击炮旧 tof 除数 42 (2026-09-28 起 84)'},
	{re:/dist2\s*\/\s*15\b/,why:'手持迫击炮旧 tof 除数 15 (2026-09-28 起 30)'},
	{re:/spd\s*:\s*110\b/,why:'spd:110 硬写海战弹速'},
	{re:/spd\s*:\s*115\b/,why:'spd:115 硬写海战弹速'},
	{re:/life\s*:\s*4\.5\b/,why:'life:4.5 (旧坦克包线)'},
	{re:/life\s*:\s*2\.6\b/,why:'life:2.6 (旧高炮包线)'},
	{re:/life\s*:\s*5\.5\b/,why:'life:5.5 (旧海战主炮包线)'},
	{re:/life\s*:\s*5\.0\b/,why:'life:5.0 (旧岸炮包线)'},
];
let badHits=[];
for(const f of files){
	const src=stripComments(fs.readFileSync(path.join(root,'js',f),'utf8')).split('\n');
	for(let i=0;i<src.length;i++) for(const b of BAD) if(b.re.test(src[i])) badHits.push(f+':'+(i+1)+' '+b.why+' → '+src[i].trim().slice(0,100));
}
for(const h of badHits) console.log('   ✘ '+h);
chk(badHits.length===0, '④-1 无一处旧弹速/旧包线字面量 (扫 '+files.length+' 个 js 文件, '+BAD.length+' 条模式, 注释已剥离)');
// 兜底字面量: 有 typeof 守卫的 fallback (不可达), 单列
const fb=[];
for(const f of files){
	const src=stripComments(fs.readFileSync(path.join(root,'js',f),'utf8')).split('\n');
	for(let i=0;i<src.length;i++) if(/\|\|\s*115\b/.test(src[i]) || /\?\s*SHELL_SPD_NAVAL\s*:\s*115/.test(src[i]))
		fb.push(f+':'+(i+1)+'  '+src[i].trim().slice(0,120));
}
console.log('\n   兜底字面量 (typeof 守卫下的不可达 fallback; 单列不判 FAIL, 但登记给 Lead):');
for(const s of fb) console.log('     · '+s);
console.log('     (共 '+fb.length+' 处; 真启动链里 00-config 先于 14-bots/15f 加载 ⇒ 常量恒有定义, 这些分支不可达)');
// 单源命中: 6 处开火点源码行
// ★ 2026-09-25 修 (判据自身脆弱性): 原表写死行号 —— 任何无关改动都会整体错位: 本批 15-vehicles 只是
//   多了三行注释, 这一格就顶到一行 spawnP 粒子行上, 判据于是报"未走单源常量"的**假失败**。
//   改成按内容定位 (每条给该开火点独有的签名子串), 行号只作展示。
console.log('\n④-2 6 处开火点源码行 (速度表达式 / life):');
const SRCLINES=[
 ['js/15-vehicles.js','shells.push({pos:origin.clone()'],              // 坦克主炮
 ['js/15c-specveh.js','shells.push({pos:origin.clone()'],         // 幽灵坦克
 ['js/13-combat.js','team:shooter.team,owner:shooter,life:2.4'],  // 反坦克炮
 ['js/16-aircraft.js','flakShots.push({pos:o.clone()'],           // 高炮
 ['js/15d-naval.js','multiplyScalar(M.spd)'],                     // 舰炮
 ['js/15f-battery.js','multiplyScalar(b.gun.spd)'],               // 岸防炮
 ['multiplyScalar(M.spd)'],                  // 大舰主炮 (P4 2026-09-30: 同样只认 SHELL_SPD_NAVAL 单源)
];
let bad2=[];
for(const [f,sig] of SRCLINES){
	const lines=fs.readFileSync(path.join(root,f),'utf8').split('\n');
	const idx=lines.findIndex(l=>l.indexOf(sig)>=0);
	if(idx<0){ console.log('   '+f+'  [找不到签名]  '+sig); bad2.push(f+' 找不到签名: '+sig); continue; }
	const ln=lines[idx].trim();
	const usesSingle=/SHELL_SPD|M\.spd|b\.gun\.spd/.test(ln);
	console.log('   '+f+':'+(idx+1)+'  '+(usesSingle?'[单源常量]':'[?]')+'  '+ln.slice(0,150));
	if(!usesSingle) bad2.push(f+':'+(idx+1)+' 未走单源常量');
}
chk(bad2.length===0, '④-2 6 处开火点的速度表达式全部走单源常量 (SHELL_SPD / spec.main.spd / b.gun.spd), 无本地硬写');

console.log('\n═══ ⑧ 合计: '+(checks-failures)+'/'+checks+' 项通过 ═══');
if(failures){ console.log('✘ 未通过 '+failures+' 项'); process.exitCode=1; } else console.log('✔ 全部通过');
