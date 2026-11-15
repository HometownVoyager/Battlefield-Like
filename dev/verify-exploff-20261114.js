// ─────────────────────────────────────────────────────────────
// dev/verify-exploff-20261114.js —— 2026-11-14 批 "手雷对友方造成伤害" 设置 (sf_explo_ff, 默认开) + 友方手雷告警
//   病灶/需求 (用户令): ①游戏内容设置加"手雷对友方造成伤害", 默认开=现行为 (普通手雷伤双方 noFF,
//   坦克炮弹等溅射本就同队免伤); 关闭后手雷/坦克炮弹/火箭/航弹/迫击炮/AT炸药/巡飞弹等**有归属**的爆炸
//   一律不伤友军步兵与载具 (玩家与 Bot 同规); 无主爆炸 (地雷/油桶/钢水包, attacker=null) 无队可认保持无差别。
//   ②友方手雷固定没有告警 (updateNades 只认 n.team!==player.team) ⇒ 开关开启时友方 (非自己扔的)
//   手雷/AT炸药/燃烧弹 7m 内也告警; 迫击炮弹/航弹除外 (真实队号溅射本就同队免伤, 告警会误报)。
//   修点全在伤害总口: 13-combat explodeAt(:726 门)/splashDamage(team 归一化, 级联覆盖舰艇透传)/
//   loiterDetonate(直击段 _ltFF 门) + updateNades(告警过滤) + 00-config EXPLO_FF + 设置卡/handler/i18n。
// 用法: node dev/verify-exploff-20261114.js [--neg]
//   --neg = 阴性对照 (6 补丁, 全部单行/单串锚):
//     N1 explodeAt 门摘 (!noFF||!EXPLO_FF→!noFF) → ②T1 ★/③T2 红
//     N2 splashDamage team 归一化行摘 → ③T3 红
//     N3 loiter _ltFF 门拆 (恒 true) → ③T4 红
//     N4 告警条件回旧 (友雷不告警) → ④T6a 红
//     N5 00-config 默认翻转 (!=='0'→==='1') → ②T0 默认开 红 + T1 红
//     N6 22-hud onclick 翻转行拆 → ⑤T7 红
// 口径: 与 verify-ffneutral-20261109 同款 (淞沪 CAMPI=3, deployPlayer, 真雷链 throwNade→nadeExplode→explodeAt)。
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

// ── 阴性对照 (全部单行/单串锚) ──
const PATCHES=[
 ['js/13-combat.js','(!noFF||!EXPLO_FF)&&attacker','!noFF&&attacker'],
 ['js/13-combat.js','if(!EXPLO_FF&&attacker&&attacker.team>-1&&(team===-1||team===undefined)) team=attacker.team;',''],
 ['js/13-combat.js','const _ltFF=t2=>EXPLO_FF||!d.owner||t2.team!==d.owner.team;','const _ltFF=t2=>true;'],
 ['js/13-combat.js','||(EXPLO_FF&&n.team===player.team&&n.thrower&&n.thrower!==player&&!(n.mortar||n.bomb))',''],
 ['js/00-config.js',"let EXPLO_FF=localStorage.getItem('sf_explo_ff')!=='0';","let EXPLO_FF=localStorage.getItem('sf_explo_ff')==='1';"],
 ['js/22-hud.js','EXPLO_FF=!EXPLO_FF;','/*NEG N6*/;'],
];
const PATCH_MAP={};
if(NEG) for(const [f,from,to] of PATCHES){
 const s=PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f);
 if(s.indexOf(from)<0) throw new Error('阴性对照锚点未找到: '+f+' :: '+from.slice(0,70));
 PATCH_MAP[f]=s.split(from).join(to);
}
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f));

// ── ① 源码防回退 ─────────────────────────────────────────────
section('① 源码防回退 (三伤害口+告警+设置链全接线)');
{
const s00=SRC('js/00-config.js'), s13=SRC('js/13-combat.js'), s22=SRC('js/22-hud.js'), shtml=SRC('index.html'), si18n=SRC('js/00b-i18n.js');
assert('①-1 00-config: EXPLO_FF 单源 (sf_explo_ff, 默认开)',s00.includes("let EXPLO_FF=localStorage.getItem('sf_explo_ff')!=='0';"));
assert('①-2 13-combat explodeAt: noFF 受开关压制 (关=手雷同队归零)',s13.includes('(!noFF||!EXPLO_FF)&&attacker&&s.team===attacker.team'));
assert('①-3 13-combat splashDamage: team=-1 归一化到 attacker 队 (级联覆盖坦克炮弹/火箭/AT炸药/航弹/迫击炮观战/舰艇透传)',
 s13.includes('if(!EXPLO_FF&&attacker&&attacker.team>-1&&(team===-1||team===undefined)) team=attacker.team;'));
assert('①-4 13-combat loiterDetonate: 直击段 _ltFF 同队门',s13.includes('const _ltFF=t2=>EXPLO_FF||!d.owner||t2.team!==d.owner.team;'));
assert('①-5 13-combat updateNades: 友方手雷告警 (非自己扔+非迫击炮/航弹)',s13.includes('EXPLO_FF&&n.team===player.team&&n.thrower&&n.thrower!==player&&!(n.mortar||n.bomb)'));
assert('①-6 设置卡: index.html 按钮+标题 / 22-hud handler+落盘 / i18n 词条',
 shtml.includes('id="exploFfBtn"')&&shtml.includes('手雷对友方造成伤害')
 &&s22.includes("el('exploFfBtn')")&&s22.includes("localStorage.setItem('sf_explo_ff'")
 &&si18n.includes("'手雷对友方造成伤害':'FRIENDLY EXPLOSION DAMAGE'"));
}

// ── 沙箱装载 (与 verify-restart-20261114 同款 boot) ──────────
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
	ctx.localStorage={_s:{sf_campaign:String(campIdx),sf_exp:'1',sf_pseed:'424242'},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
	for(const f of FILES){ vm.runInContext(srcOf(f),ctx,{filename:f}); }
	return ctx;
}
const CAMPI=3; // 淞沪 (ffneutral/deathdrop 同源, 陆战开阔)
const ctx=boot(CAMPI);
const G=s=>vm.runInContext(s,ctx,{timeout:300000});
G("globalThis.confirm=function(){return true;};");

// 开局+部署+公用夹具 (与 ffneutral 同源)
let err0=null;
try{ G("document.getElementById('startBtn').onclick(); document.getElementById('hubLaunchBtn').onclick();"); }catch(e){ err0=String(e&&e.stack||e); }
if(!err0){ try{ G('if(!player.alive||!player.deployed) deployPlayer();'); }catch(e){ err0='deployPlayer: '+String(e&&e.stack||e); } }
if(err0||!G('player.alive')){ console.log('  ✘ 开局/部署失败 '+(err0||'player.alive=false')); process.exit(1); }
G('for(const s of soldiers) s.protUntil=0; player.protUntil=0;');
assert('前置: 战场已开局并部署 (soldiers='+G('soldiers.length')+', player.alive='+G('player.alive')+')',G('soldiers.length')>0);

G(`
function _isLand(x,z){ return heightAt(x,z)>waterYAt(x,z)+0.4; }
function _findClear(o,dist,a0){
for(var da=0.2;da<Math.PI*2;da+=0.25){
var a=a0+da, dx=Math.sin(a),dz=Math.cos(a);
var end={x:o.x+dx*dist,z:o.z+dz*dist};
if(!_isLand(end.x,end.z)) continue;
if(raycastWorld(V3(o.x,o.y+1.5,o.z),V3(dx,0,dz),dist)) continue;
return end;
}
return null;
}
function _placeClear(u,dist){ var e=_findClear(u.pos,dist,0.3); if(!e) return false; u.pos.set(e.x,heightAt(e.x,e.z),e.z); return true; }
function _heal(u){ u.alive=true; u.hp=100; u.onVehicle=null; u.spectator=false; u.prone=false; u.crouch=false; u.protUntil=0; }
function _pickFriendExcl(excl){
for(var i=0;i<soldiers.length;i++){ var s=soldiers[i]; if(s.alive&&!s.isPlayer&&s.team===player.team&&!s.onVehicle&&!s.spectator&&!s.capCrew&&s!==excl) return s; }
return null;
}
function _pickFriend(){ return _pickFriendExcl(null); }
function _pickEnemy(){
for(var i=0;i<soldiers.length;i++){ var s=soldiers[i]; if(s.alive&&!s.isPlayer&&s.team!==player.team&&!s.onVehicle&&!s.spectator&&!s.capCrew) return s; }
return null;
}
function _placeNear(u,ax,az,dist,a0){
for(var k=0;k<24;k++){
var a=a0+k*0.26, dx=Math.sin(a), dz=Math.cos(a);
var x=ax+dx*dist, z=az+dz*dist;
if(!_isLand(x,z)) continue;
u.pos.set(x,heightAt(x,z),z); return true;
}
return false;
}
function _stepToRemoval(nd,cap){ var s=0; while(nades.indexOf(nd)>=0&&s<cap){ updateNades(0.05,0.05); s++; } return s; }
function _throwFrag(fuse){ player._src='手雷'; throwNade(player,V3(player.pos.x,player.pos.y+1.4,player.pos.z),V3(0.1,-0.5,0.1),fuse); return nades[nades.length-1]; }
function _reviveP(){ player.alive=true; player.hp=100; player.protUntil=0; player.nadeHeld=false; player.nadeFuse=0; player.spectator=false; player.specViewHost=null; player.onNaval=null; player.capitalGun=null; player.ffAll=false; player.ffSpecSniper=false; player.loiter=null; if(typeof VM!=='undefined'&&VM) VM.state='idle'; }
function _mkNade(team,thrower,dx){
nades.length=0; nadeWarnT=0;
var nd={pos:V3(player.pos.x+(dx||2),player.pos.y+0.3,player.pos.z),vel:V3(0,0,0),fuse:99,kind:'frag',team:team,thrower:thrower,smokeN:false,incinN:false,at:false,bomb:false,mortar:false,bounces:0,spin:{x:0,y:0},m:new THREE.Object3D()};
nades.push(nd); return nd;
}
`);

// ══ ② 默认开 = 现行为 (手雷伤友军) ══
console.log('② 默认开: EXPLO_FF=true (无存档) + frag 真雷链伤友军 (N5 靶)');
assert('②-T0 默认开 (localStorage 无 sf_explo_ff ⇒ EXPLO_FF=true)',G('EXPLO_FF')===true,'EXPLO_FF='+G('EXPLO_FF'));
const t1=G(`(function(){
try{
_reviveP(); if(!_placeClear(player,6)) return {err:'无开阔陆地落位'};
var F=_pickFriend(); if(!F) return {err:'缺友军步兵'};
_heal(F); nades.length=0;
if(!_placeNear(F,player.pos.x,player.pos.z,3,0.5)) return {err:'友军落位失败'};
var hpF=F.hp;
var nd=_throwFrag(0);
if(!nd||nd.kind!=='frag') return {err:'弹种不对 '+(nd&&nd.kind)};
var steps=_stepToRemoval(nd,200);
return {removed:nades.indexOf(nd)<0,steps:steps,hpF:F.hp,hpF0:hpF};
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t1.err){ assert('②-T1 异常 '+t1.err,false); }
else{
assert('②-T1 手雷真实引爆离账',t1.removed,'步数 '+t1.steps);
assert('②-T1 ★默认开=友军掉血 (100 → '+Number(t1.hpF).toFixed(1)+') (N1/N5 靶)',t1.hpF<t1.hpF0,t1.hpF0+'→'+Number(t1.hpF).toFixed(1));
}

// ══ ③ 关闭 = 有归属爆炸全护友军 ══
console.log('③ 关闭 (EXPLO_FF=false): frag 友军免伤/敌军照伤 + splashDamage 归一化 + 巡飞直击 + 无主爆炸不受影响');
G('EXPLO_FF=false;');
const t2=G(`(function(){
try{
_reviveP(); if(!_placeClear(player,6)) return {err:'无开阔陆地落位'};
var F=_pickFriend(), E=_pickEnemy(); if(!F||!E) return {err:'缺友军/敌军步兵'};
_heal(F); _heal(E); nades.length=0;
if(!_placeNear(F,player.pos.x,player.pos.z,3,0.5)) return {err:'友军落位失败'};
if(!_placeNear(E,player.pos.x,player.pos.z,4.5,2.6)) return {err:'敌军落位失败'};
var hpF=F.hp, hpE=E.hp;
var nd=_throwFrag(0);
if(!nd||nd.kind!=='frag') return {err:'弹种不对'};
_stepToRemoval(nd,200);
return {removed:nades.indexOf(nd)<0,hpF:F.hp,hpF0:hpF,hpE:E.hp,hpE0:hpE};
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t2.err){ assert('③-T2 异常 '+t2.err,false); }
else{
assert('③-T2 ★关=frag 友军零伤 (100 → '+Number(t2.hpF).toFixed(1)+') (N1 靶)',t2.removed&&t2.hpF===t2.hpF0,t2.hpF0+'→'+Number(t2.hpF).toFixed(1));
assert('③-T2 敌军照常掉血 ('+t2.hpE0+' → '+Number(t2.hpE).toFixed(1)+')',t2.hpE<t2.hpE0);
}
const t3=G(`(function(){
try{
var O=_pickFriend(), F=_pickFriendExcl(O), E=_pickEnemy(); if(!O||!F||!E) return {err:'缺兵'};
_heal(O); _heal(F); _heal(E);
var ax=player.pos.x, az=player.pos.z;
if(!_placeNear(F,ax,az,3,0.5)) return {err:'F落位失败'};
if(!_placeNear(E,ax,az,3.5,2.6)) return {err:'E落位失败'};
O.pos.set(player.pos.x+50,heightAt(player.pos.x+50,player.pos.z),player.pos.z);   // attacker 独立于受害者并拉出爆圈 (s!==attacker 自伤例外不许污染友伤判据)
var hpF=F.hp, hpE=E.hp;
splashDamage(V3(ax,heightAt(ax,az)+0.5,az), O, -1, 6, 100, 150, true);   // 模拟 team=-1 有归属弹 (坦克炮弹/AT炸药同口径), attacker=友军步兵
var r1={hpF:F.hp,hpF0:hpF,hpE:E.hp,hpE0:hpE};
_heal(F); _heal(E);
splashDamage(V3(ax,heightAt(ax,az)+0.5,az), null, -1, 6, 100, 150, true); // 无主爆炸 (attacker=null): 不受开关, 仍无差别
var r2={hpF:F.hp,hpF0:hpF};
return {r1:r1,r2:r2};
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t3.err){ assert('③-T3 异常 '+t3.err,false); }
else{
assert('③-T3 ★关=有归属无差别溅射收敛为队属口径 (友军免伤 '+t3.r1.hpF0+'→'+Number(t3.r1.hpF).toFixed(1)+' / 敌军掉血 '+t3.r1.hpE0+'→'+Number(t3.r1.hpE).toFixed(1)+') (N2 靶)',
 t3.r1.hpF===t3.r1.hpF0&&t3.r1.hpE<t3.r1.hpE0);
assert('③-T3 无主爆炸不受开关影响 (attacker=null 仍伤友军 '+t3.r2.hpF0+'→'+Number(t3.r2.hpF).toFixed(1)+')',t3.r2.hpF<t3.r2.hpF0);
}
const t4=G(`(function(){
try{
var O=_pickFriend(), F=_pickFriendExcl(O); if(!O||!F) return {err:'缺两名友军步兵'};
_heal(O); _heal(F);
if(!_placeNear(F,player.pos.x,player.pos.z,2.5,0.9)) return {err:'F落位失败'};
O.pos.set(player.pos.x+40,heightAt(player.pos.x+40,player.pos.z),player.pos.z);   // owner 拉出爆圈
var hpF=F.hp;
var d={dead:false,mesh:new THREE.Object3D(),owner:O};
player.loiter=null;
loiterDetonate(d,V3(F.pos.x,F.pos.y+1,F.pos.z),null,F,null);
return {hpF:F.hp,hpF0:hpF,alive:F.alive};
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t4.err){ assert('③-T4 异常 '+t4.err,false); }
else{
assert('③-T4 ★关=巡飞弹直击段同队免伤 (直击400+溅射 全部对友军收敛) (N3 靶)',t4.hpF===t4.hpF0,t4.hpF0+'→'+Number(t4.hpF).toFixed(1));
}
G('EXPLO_FF=true;');   // 恢复默认, 后段设置测试从"开"起步

// ══ ④ 友方手雷告警 (开关开启才有) ══
console.log('④ 友方手雷告警: 开=友雷(非自己)7m内告警 / 关=停用 / 自己的雷不告警 / 敌雷不受开关影响 (N4 靶)');
const t6a=G(`(function(){
try{
var F=_pickFriend(); if(!F) return {err:'缺友军步兵'};
_reviveP();
_mkNade(player.team,F,2);                       // 友军 Bot 扔的 frag 在玩家 2m 处
updateNades(0.05,0.05);
return {warn:nadeWarnT>0,d:nadeMinDist};
}catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t6a.err){ assert('④-T6a 异常 '+t6a.err,false); }
else assert('④-T6a ★开=友方手雷告警 (nadeWarnT>0, 距离 '+t6a.d+') (N4 靶)',t6a.warn===true,'nadeWarnT='+G('nadeWarnT'));
const t6b=G(`(function(){
try{ EXPLO_FF=false; _mkNade(player.team,_pickFriend(),2); updateNades(0.05,0.05); var w=nadeWarnT>0; EXPLO_FF=true; nades.length=0; nadeWarnT=0; return {warn:w}; }catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t6b.err){ assert('④-T6b 异常 '+t6b.err,false); }
else assert('④-T6b ★关=友方手雷告警停用 (关=友雷不再伤人, 无需告警)',t6b.warn===false,'');
const t6c=G(`(function(){
try{ _mkNade(player.team,player,2); updateNades(0.05,0.05); var w=nadeWarnT>0; nades.length=0; nadeWarnT=0; return {warn:w}; }catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t6c.err){ assert('④-T6c 异常 '+t6c.err,false); }
else assert('④-T6c 自己扔的雷不告警 (thrower===player 排除, 厨雷链不入表也不会自扰)',t6c.warn===false,'');
const t6d=G(`(function(){
try{ var E=_pickEnemy(); if(!E) return {err:'缺敌军步兵'}; EXPLO_FF=false; _mkNade(E.team,E,2); updateNades(0.05,0.05); var w=nadeWarnT>0; EXPLO_FF=true; nades.length=0; nadeWarnT=0; return {warn:w}; }catch(e){ return {err:String(e&&e.stack||e)}; }
})()`);
if(t6d.err){ assert('④-T6d 异常 '+t6d.err,false); }
else assert('④-T6d 敌方手雷告警不受开关影响 (关=敌雷照炸照告警)',t6d.warn===true,'');

// ══ ⑤ 设置按钮: 翻转+落盘+即时生效 ══
console.log('⑤ 设置按钮 exploFfBtn: 点击翻转 + localStorage 落盘 + 按钮文案跟随 (N6 靶)');
const btn0=G("document.getElementById('exploFfBtn').textContent");
assert('⑤-T7a 初始文案=开 (initMenuUI syncX 已接)',String(btn0).indexOf('开')>=0,String(btn0));
try{ G("document.getElementById('exploFfBtn').onclick();"); }catch(e){ err0=String(e&&e.stack||e); }
const after1={ff:G('EXPLO_FF'),ls:ctx.localStorage.getItem('sf_explo_ff'),tx:G("document.getElementById('exploFfBtn').textContent")};
assert('⑤-T7b ★点击翻转 开→关 + sf_explo_ff=0 落盘 (N6 靶)',!err0&&after1.ff===false&&after1.ls==='0'&&String(after1.tx).indexOf('关')>=0,
 err0||JSON.stringify(after1));
try{ G("document.getElementById('exploFfBtn').onclick();"); }catch(e){ err0=String(e&&e.stack||e); }
const after2={ff:G('EXPLO_FF'),ls:ctx.localStorage.getItem('sf_explo_ff')};
assert('⑤-T7c 再点还原 开 + sf_explo_ff=1',!err0&&after2.ff===true&&after2.ls==='1',JSON.stringify(after2));

// ── 汇总 ─────────────────────────────────────────────────────
console.log('\n──────────────────────────────');
console.log(`  ${NEG?'NEG':'正向'} ${OK.length} 绿 / ${BAD.length} 红`);
if(BAD.length){ console.log('  红名: '+BAD.join(' · ')); process.exitCode=1; }
