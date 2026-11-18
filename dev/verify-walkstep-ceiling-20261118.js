// ─────────────────────────────────────────────────────────────
// dev/verify-walkstep-ceiling-20261118.js —— 2026-11-18 顶头穿墙通用修验收
//   病灶 (用户图示): 走/跳上"有判定的砖"时 standHeight 瞬间抬脚, 头探进上方楼板/屋顶,
//   collideMove 横推在 d≈0 走"最近边"分支把人整只横向弹射穿墙 (图1→图2)。
//   修法: ①碰撞横推"最近边"对头顶笼罩件不作为 (04-collision) ②standHeightSafe 抬脚前
//   过顶头净空: 顶头→自动蹲(沿用C键动画), 连蹲都放不下就不抬脚 (玩家/Bot/丧尸共用)。
// 用法: node dev/verify-walkstep-ceiling-20261118.js [--neg]
//   --neg = 阴性对照: 摘横推兜底 ⇒ 复现旧横推穿墙; 摘 standHeightSafe ⇒ 复现头探顶。
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

// ── 阴性对照 (单行锚) ──
const PATCHES=[
  // N1: 摘掉横推"最近边"的头顶笼罩件兜底 ⇒ 旧横推穿墙复现
  ['js/04-collision.js','if(_cmCeilingLike(b,pos)) return;   // ★2026-11-18: 头顶笼罩件不弹射 (竖直解嵌单源)',''],
  // N2: 玩家步行路径摘掉 standHeightSafe ⇒ 头探顶不再自动蹲/不抬脚
  ['js/20-player.js','const gh=playerSafeStand(p,standHeight(p.pos.x,p.pos.z,p.pos.y+0.6),_pFoot).y;   // ★2026-11-18 顶头安全落位 (走/跳上砖头探顶不再被横推弹出墙)','const gh=standHeight(p.pos.x,p.pos.z,p.pos.y+0.6);'],
];
const PATCH_MAP={};
if(NEG) for(const [f,from,to] of PATCHES){
  const s=PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f);
  if(s.indexOf(from)<0) throw new Error('阴性对照锚点未找到: '+f+' :: '+from.slice(0,70));
  PATCH_MAP[f]=s.split(from).join(to);
}
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f));

// ── ① 源码防回退 ──
section('① 源码防回退 (顶头横推兜底 + standHeightSafe + 三方接线)');
{
const s04=SRC('js/04-collision.js'), s20=SRC('js/20-player.js'), s14=SRC('js/14-bots.js');
assert('04-collision: 横推最近边头顶笼罩件兜底 + 顶头净空 + standHeightSafe 单源',
  s04.includes('if(_cmCeilingLike(b,pos)) return;')
  &&s04.includes('function headClearance(')
  &&s04.includes('function standHeightSafe(')
  &&s04.includes('function _cmCeilingLike('));
assert('20-player: 步行路径 + TV制导本体 两条都接 standHeightSafe + 自动蹲离场恢复',
  s20.includes('playerSafeStand(p,standHeight(p.pos.x,p.pos.z,p.pos.y+0.6),_pFoot)')
  &&s20.includes('playerSafeStand(p,standHeight(p.pos.x,p.pos.z,p.pos.y+0.6),_pFootTv)')
  &&s20.includes('p._autoCrouch=true')&&s20.includes('else if(p._autoCrouch){ p.crouch=false; p._autoCrouch=false; }'));
assert('19-input: 手动 C 夺回姿态控制 (清 _autoCrouch)',
  SRC('js/19-input.js').includes('player._autoCrouch=false;'));
assert('14-bots: Bot/僵尸共用 moveDir 接 botSafeStand',
  s14.includes('function botSafeStand(')
  &&s14.includes('botSafeStand(this,standHeight(this.pos.x,this.pos.z,this.pos.y+0.6),_bFoot)'));
}

// ── 沙箱装载 ──
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
const ctx=boot(0);
const G=s=>vm.runInContext(s,ctx,{timeout:300000});
let err=null;
try{ G("document.getElementById('startBtn').onclick();"); }catch(e){ err='start: '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); }
if(!err) try{ G("player.team=0; player.cls=0; player.spectator=false; player.alive=true; player.deployed=true; player.hp=100; for(let i=0;i<120;i++) updatePlayer(1/60);"); }catch(e){ err='playerInit: '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); }
assert('② 前置: 开局+玩家落地',!err&&G('player.onGround')===true,err||'');

// ── ③ 行为: 图中走/跳上砖 → 头顶板 → 相邻墙, 零横推穿墙 ──
section('③ 行为: 走/跳上有判定的砖, 头顶板不穿墙 (合成几何, 测后摘盒)');
{
// 选净空点: 以玩家出生位为中心向东蛇形, 找"测试高度站头无遮挡"的点。
G("globalThis._p0=player.pos.y; window.RGRID_OFF=true;"
  +"globalThis._winHit=(px,py,pz)=>{ let hit=false;"
  +"eachBoxNear(px-0.6,pz-0.6,px+0.6,pz+0.6,b=>{ if(!b.dead&&b.minY>py+1.0&&b.minY<py+2.4){"
    +"const cx=Math.max(b.minX,Math.min(px,b.maxX)), cz=Math.max(b.minZ,Math.min(pz,b.maxZ));"
    +"const dx=px-cx, dz=pz-cz; if(dx*dx+dz*dz<0.36) hit=true; } });"
  +"return hit; };"
  +"globalThis._jx=1e9; globalThis._jz=player.pos.z;"
  +"outerLoop: for(let dz=-15;dz<=15;dz+=3){ for(let k=0;k<=21;k++){"
    +"const cx=player.pos.x+((k%2===1)?((k+1)/2)*3:-(k/2)*3);"
    +"if(!_winHit(cx,_p0,_jz)){ _jx=cx; break outerLoop; } } }"
  +"if(_jx===1e9){ _jx=player.pos.x; }"
  +"globalThis._n0=BOXES.length;"
  // 砖: 脚底 +0.55 (跨步档内, standHeight 会瞬间抬脚上去), 砖顶 p0+0.55
  +"globalThis._brick={minX:_jx-0.6,maxX:_jx+0.6,minZ:_jz-0.6,maxZ:_jz+0.6,minY:_p0,maxY:_p0+0.55,dead:false};"
  // 顶棚: 底面 p0+1.85 ⇒ 站砖上脚 p0+0.55, 站头 p0+2.25 探入 0.40m; 蹲头 p0+1.80 余 0.05m (②档蹲姿放得下)
  +"globalThis._roof={minX:_jx-4,maxX:_jx+4,minZ:_jz-4,maxZ:_jz+4,minY:_p0+1.85,maxY:_p0+2.0,dead:false};"
  // 相邻薄墙: 砖东侧 0.9m 处, 旧横推会把人弹射穿过它
  +"globalThis._wall={minX:_jx+0.9,maxX:_jx+1.1,minZ:_jz-4,maxZ:_jz+4,minY:_p0,maxY:_p0+2.0,dead:false};"
  +"BOXES.push(_brick,_roof,_wall);"
  +"player.pos.set(_jx,_p0,_jz); player.vel.set(0,0,0); player.onGround=true; player.crouch=false; player.prone=false;");

// ③-1 standHeightSafe: 站砖上会顶头 → 自动蹲且脚位保留 (蹲姿净空够)
G("globalThis._safe=standHeightSafe(player.pos.x,player.pos.z,_p0+0.55,_p0);");
assert('③-1 站砖顶头 → 自动蹲且保留脚位 (蹲姿净空够)',
  G('_safe.crouch')===true&&Math.abs(G('_safe.y')-G('_p0+0.55'))<1e-6,
  `y=${G('_safe.y').toFixed(3)} crouch=${G('_safe.crouch')}`);

// ③-2 顶头横推兜底: 人脚在砖顶、头顶探入顶棚, d≈0 ⇒ collideMove 零横移 (旧版弹射穿墙)
G("player.pos.set(_jx,_p0+0.55,_jz); player.crouch=true;"
  +"globalThis._pb={x:_jx,y:_p0+0.55,z:_jz}; collideMove(_pb,0.42);");
assert('③-2 顶头笼罩件 d≈0: collideMove 零横推 (旧版整只弹射穿墙)',
  Math.abs(G('_pb.x-_jx'))<=1e-6&&Math.abs(G('_pb.z-_jz'))<=1e-6,
  `dx=${G('_pb.x-_jx').toFixed(3)} dz=${G('_pb.z-_jz').toFixed(3)}`);

// ③-3 负对照: 头顶无遮挡时, 同位置胸墙 (d>0 接近) 照常横推, 兜底不误放行
G("BOXES.splice(BOXES.indexOf(_roof),1);"   // 临时摘顶棚
  +"globalThis._pw={x:_jx+0.55,y:_p0+0.2,z:_jz}; collideMove(_pw,0.42);");
assert('③-3 负对照: 胸墙照常横推 (兜底只豁免顶头件)',
  G('_pw.x')<=G('_jx+0.9')-0.42+1e-6,
  `x=${G('_pw.x').toFixed(3)}`);
G("BOXES.push(_roof);");

// ③-4 端到端: 玩家站在砖 footprint 内、脚在地面 (模拟"走上砖那一帧 standHeight 瞬间抬脚"),
//   运行若干帧: 应稳定站到砖顶 (或蹲), 全程零横推, 不穿相邻薄墙。
G("player.pos.set(_jx,_p0,_jz); player.vel.set(0,0,0); player.onGround=true; player.crouch=false; player.prone=false;"
  +"globalThis._maxD=0; globalThis._anyCrouch=false; globalThis._maxY=-1e9;"
  +"keys.KeyD=false; keys.KeyW=false; keys.KeyA=false; keys.KeyS=false; keys.Space=false;"
  +"for(let i=0;i<120;i++){ updatePlayer(1/60);"
    +"_maxD=Math.max(_maxD,Math.abs(player.pos.x-_jx),Math.abs(player.pos.z-_jz));"
    +"if(player.pos.y>_maxY)_maxY=player.pos.y; if(player.crouch)_anyCrouch=true; }");
assert('③-4 端到端上砖: 零横推不穿相邻薄墙 (maxD ≤ 0.5m)',
  G('_maxD')<=0.5,
  `maxD=${G('_maxD').toFixed(3)}`);
assert('③-5 端到端上砖: 顶头触发过自动蹲',G('_anyCrouch')===true);

// ③-6 离开低矮处自动恢复站姿 (仅清自动蹲, 不碰手动 C)
G("BOXES.splice(BOXES.indexOf(_roof),1);"   // 摘顶棚 = 离开低矮处
  +"for(let i=0;i<5;i++) updatePlayer(1/60);");
assert('③-6 离开低矮处: 自动恢复站姿',G('player.crouch')===false&&G('player._autoCrouch')===false);
G("BOXES.push(_roof);");

// ③-7 卫生
G("BOXES.splice(BOXES.indexOf(_brick),1); BOXES.splice(BOXES.indexOf(_roof),1); BOXES.splice(BOXES.indexOf(_wall),1);"
  +"player.pos.set(_jx,_p0,_jz); player.vel.set(0,0,0); player.onGround=true; player.crouch=false; player._autoCrouch=false; window.RGRID_OFF=false;");
assert('③-7 探针卫生: 测试盒全摘',G('BOXES.length')===G('_n0'),`盒=${G('BOXES.length')}/${G('_n0')}`);
}

console.log('\n──────────────────────────────');
console.log(`  ${NEG?'NEG':'正向'} ${OK.length} 绿 / ${BAD.length} 红`);
if(BAD.length){ console.log('  红名: '+BAD.join(' · ')); process.exitCode=1; }
