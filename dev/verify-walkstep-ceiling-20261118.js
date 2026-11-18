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
  // N1: 摘掉横推"最近边"的初始重叠兜底 ⇒ 旧横推穿墙复现 (11-18b 泛化后函数名/锚变化)
  ['js/04-collision.js','if(_cmEmbeddedBody(b,pos,hh)) return;',''],
  // N2: 玩家步行路径摘掉 standHeightSafe ⇒ 头探顶不再自动蹲/不抬脚
  ['js/20-player.js','const gh=playerSafeStand(p,standHeight(p.pos.x,p.pos.z,p.pos.y+0.6),_pFoot).y;','const gh=standHeight(p.pos.x,p.pos.z,p.pos.y+0.6);'],
  // N3: 起跳恢复"强制站起" ⇒ 蹲跳穿顶复现 (11-18b 修掉的旧行为)
  ['js/20-player.js','p.onGround=false; p.stamina-=0.08; p.stamUseT=nowT; p.prone=false; p.braced=false; }',
   'p.onGround=false; p.stamina-=0.08; p.stamUseT=nowT; p.crouch=false; p.prone=false; p.braced=false; }'],
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
assert('04-collision: 横推 d≈0 初始重叠泛化兜底 + 顶头净空 + 蹲跳净空预检 + standHeightSafe 单源',
  s04.includes('if(_cmEmbeddedBody(b,pos,hh)) return;')
  &&s04.includes('function headClearance(')
  &&s04.includes('function standHeightSafe(')
  &&s04.includes('function _cmEmbeddedBody(')
  &&s04.includes('function headJumpBlocked(')
  &&s04.includes('function headCeilClamp(pos,rise,stanceH)')
  &&s04.includes('function collideMove(pos, radius, headH)'));
assert('20-player: 两条 safeStand 路径解嵌在横推前 + 随姿态头顶钳制 + 蹲跳净空门 + 自动蹲离场恢复',
  s20.indexOf('playerSafeStand(p,standHeight(p.pos.x,p.pos.z,p.pos.y+0.6),_pFoot)')>=0
  &&s20.indexOf('playerSafeStand(p,standHeight(p.pos.x,p.pos.z,p.pos.y+0.6),_pFootTv)')>=0
  &&/const gh=playerSafeStand\(p,standHeight\(p\.pos\.x,p\.pos\.z,p\.pos\.y\+0\.6\),_pFoot\)\.y;[\s\S]{0,200}?collideMove\(p\.pos,0\.42,_pHeadH\);/.test(s20)
  &&s20.includes('headJumpBlocked(p.pos,_jumpHH,4.6*4.6/(2*13))')
  &&s20.includes('headCeilClamp(p.pos,p.vel.y*dt,_pHeadH)')
  &&s20.includes('p._autoCrouch=true')&&s20.includes('p._autoProne=true')
  &&s20.includes('function playerHeadH(p)'));
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
// ── ④ 2026-11-18b 追加: 屋顶带内部 / 蹲跳 / 净空禁跳 ──
section('④ 屋顶带内部 d≈0 零横推 + 蹲跳保持蹲姿 + 净空不足禁跳');
{
// ③ 收尾把 RGRID_OFF 复回 false; 新摆的合成盒未注册进空间索引 ⇒ 本段重开全量路径。
G("window.RGRID_OFF=true;");
// 复用 ③ 的净空点 _jx/_jz/_p0。摆一个"屋顶阶梯带"型盒: 底面低于肩 (p0+0.45 < p0+0.6),
// 顶面 p0+2.2 —— 11-18 首版 _cmCeilingLike 要求底面>肩, 故不会豁免; b 版 _cmEmbeddedBody 会豁免。
G("globalThis._roofBand={minX:_jx-3,maxX:_jx+3,minZ:_jz-3,maxZ:_jz+3,minY:_p0+0.45,maxY:_p0+2.2,dead:false};"
  +"globalThis._nearWall={minX:_jx+0.8,maxX:_jx+1.0,minZ:_jz-3,maxZ:_jz+3,minY:_p0,maxY:_p0+2.2,dead:false};"
  +"BOXES.push(_roofBand,_nearWall);"
  +"globalThis._pb2={x:_jx,y:_p0+0.5,z:_jz}; collideMove(_pb2,0.42);");
assert('④-1 屋顶带内部 (底面低于肩) d≈0: 零横推 (旧版整只弹射穿墙)',
  Math.abs(G('_pb2.x-_jx'))<=1e-6&&Math.abs(G('_pb2.z-_jz'))<=1e-6,
  `dx=${G('_pb2.x-_jx').toFixed(3)} dz=${G('_pb2.z-_jz').toFixed(3)}`);

// ④-2 蹲跳净空够: 顶棚底面 p0+2.8 ⇒ 蹲姿头顶 p0+1.75 + 跳高 0.81 = p0+2.56 < 2.8, 放得下;
//   站姿头顶 p0+2.2 + 0.81 = p0+3.01 > 2.8 顶头。验证: 蹲姿按空格起跳成功且全程保持 crouch。
G("BOXES.splice(BOXES.indexOf(_roofBand),1); BOXES.splice(BOXES.indexOf(_nearWall),1);"
  +"globalThis._hiRoof={minX:_jx-3,maxX:_jx+3,minZ:_jz-3,maxZ:_jz+3,minY:_p0+2.8,maxY:_p0+3.0,dead:false};"
  +"BOXES.push(_hiRoof);"
  +"player.pos.set(_jx,_p0,_jz); player.vel.set(0,0,0); player.onGround=true; player.crouch=true; player.prone=false; player._autoCrouch=true;"
  +"keys.Space=true; player._ltSpace=false; updatePlayer(1/60); keys.Space=false;"
  +"globalThis._jumped=player.vel.y>0; globalThis._stillCrouch=player.crouch;");
assert('④-2 蹲姿跳跃: 净空够时起跳成功且保持蹲姿 (不再强制站起)',
  G('_jumped')===true&&G('_stillCrouch')===true,
  `vy=${G('player.vel.y').toFixed(2)} crouch=${G('_stillCrouch')}`);

// ④-3 蹲姿净空不足禁跳: 蹲头顶 p0+1.25, 顶棚底 p0+1.8 ⇒ 蹲跳最高 p0+2.06 顶头 ⇒ headJumpBlocked=true
//   (站姿档仍走 headGrazeBlocked + headCeilClamp 穿越窗, 既有护栏顶起跳行为不变 —— 见 railclip 回归)
G("player.pos.set(_jx,_p0,_jz); player.vel.set(0,0,0); player.onGround=true; player.crouch=true; player._autoCrouch=false;"
  +"BOXES.splice(BOXES.indexOf(_hiRoof),1);"
  +"globalThis._lowRoof={minX:_jx-3,maxX:_jx+3,minZ:_jz-3,maxZ:_jz+3,minY:_p0+1.8,maxY:_p0+2.0,dead:false};"
  +"BOXES.push(_lowRoof);"
  +"keys.Space=true; player._ltSpace=false; updatePlayer(1/60); keys.Space=false;"
  +"globalThis._blockedVy=player.vel.y;");
assert('④-3 蹲姿净空不足: 起跳预检拦截 (vel.y ≤ 0)',
  G('_blockedVy')<=0.0001,
  `vy=${G('_blockedVy').toFixed(3)}`);

// ④-4 卫生
G("BOXES.splice(BOXES.indexOf(_lowRoof),1); window.RGRID_OFF=false;"
  +"player.pos.set(_jx,_p0,_jz); player.vel.set(0,0,0); player.onGround=true; player.crouch=false; player._autoCrouch=false;");
assert('④-4 探针卫生',G('BOXES.length')===G('_n0'),`盒=${G('BOXES.length')}/${G('_n0')}`);
}

// ── ⑤ 11-18c: 蹲/趴碰撞体真变矮 + 高地砖低顶下能移动 ──
section('⑤ 姿态真碰撞体: 蹲/趴变矮 + 高砖低顶可移动 + 自动趴');
{
G("window.RGRID_OFF=true;");
// ⑤-1 蹲姿头顶 1.25: 盒底在 pos.y+1.3 (站姿 1.7 会挡, 蹲姿 1.25 不该挡) ⇒ 蹲姿 collideMove 不横推
G("globalThis._beam={minX:_jx-3,maxX:_jx+3,minZ:_jz-0.2,maxZ:_jz+0.2,minY:_p0+1.3,maxY:_p0+1.5,dead:false};"
  +"BOXES.push(_beam);"
  +"globalThis._pStand={x:_jx,y:_p0,z:_jz+0.35};const sz=_pStand.z;collideMove(_pStand,0.42,1.7);globalThis._pushStand=Math.abs(_pStand.z-sz);"
  +"globalThis._pCrouch={x:_jx,y:_p0,z:_jz+0.35};const cz0=_pCrouch.z;collideMove(_pCrouch,0.42,1.25);globalThis._pushCrouch=Math.abs(_pCrouch.z-cz0);");
assert('⑤-1 蹲姿碰撞体变矮: 齐胸低梁站姿挡、蹲姿放行',
  G('_pushStand')>0.1&&G('_pushCrouch')<=1e-6,
  `stand=${G('_pushStand').toFixed(3)} crouch=${G('_pushCrouch').toFixed(3)}`);

// ⑤-2 趴姿头顶 0.6: 盒底在 pos.y+0.9 (蹲姿 1.25 会挡, 趴姿 0.6 不该挡)
G("BOXES.splice(BOXES.indexOf(_beam),1);"
  +"globalThis._beam2={minX:_jx-3,maxX:_jx+3,minZ:_jz-0.2,maxZ:_jz+0.2,minY:_p0+0.9,maxY:_p0+1.1,dead:false};"
  +"BOXES.push(_beam2);"
  +"globalThis._pCr2={x:_jx,y:_p0,z:_jz+0.35};const c2z=_pCr2.z;collideMove(_pCr2,0.42,1.25);globalThis._pushCr2=Math.abs(_pCr2.z-c2z);"
  +"globalThis._pProne={x:_jx,y:_p0,z:_jz+0.35};const p2z=_pProne.z;collideMove(_pProne,0.42,0.6);globalThis._pushProne=Math.abs(_pProne.z-p2z);");
assert('⑤-2 趴姿碰撞体变矮: 低梁蹲姿挡、趴姿放行',
  G('_pushCr2')>0.1&&G('_pushProne')<=1e-6,
  `crouch=${G('_pushCr2').toFixed(3)} prone=${G('_pushProne').toFixed(3)}`);

// ⑤-3 站/蹲/趴都放不下的高砖 ⇒ standHeightSafe 返回 prone? 否: 连趴都放不下 ⇒ 不抬脚 (y=oldY)
G("BOXES.splice(BOXES.indexOf(_beam2),1);"
  +"globalThis._tight={minX:_jx-3,maxX:_jx+3,minZ:_jz-3,maxZ:_jz+3,minY:_p0+0.4,maxY:_p0+1.0,dead:false};"
  +"BOXES.push(_tight);"
  +"globalThis._tightSafe=standHeightSafe(_jx,_jz,_p0+0.5,_p0);");
assert('⑤-3 连趴都放不下: 不抬脚 (留在 oldY)',
  Math.abs(G('_tightSafe.y')-G('_p0'))<1e-6,
  `y=${G('_tightSafe.y').toFixed(3)}`);

G("BOXES.splice(BOXES.indexOf(_tight),1); window.RGRID_OFF=false;"
  +"player.pos.set(_jx,_p0,_jz); player.vel.set(0,0,0); player.onGround=true; player.crouch=false; player.prone=false; player._autoCrouch=false; player._autoProne=false;");
assert('⑤-4 姿态探针卫生',G('BOXES.length')===G('_n0'),`盒=${G('BOXES.length')}/${G('_n0')}`);
}

console.log(`  ${NEG?'NEG':'正向'} ${OK.length} 绿 / ${BAD.length} 红`);
if(BAD.length){ console.log('  红名: '+BAD.join(' · ')); process.exitCode=1; }
