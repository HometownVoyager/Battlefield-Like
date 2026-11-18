// ─────────────────────────────────────────────────────────────
// dev/verify-tvosd-headbonk-20261110.js —— 2026-11-10 两项批验收
//   ① 巡飞弹 TV 遮罩"加点料": FPV OSD (REC/时间码/信号条/四角标/中央分划/离地/速度/离机/
//     存续条/开镜标/低量红脉冲) —— index.html 子元素 + CSS + 22-hud 逐帧驱动 + lifeMax 记账 + i18n
//   ② 跳跃头顶钳制: 上升段头探进上方盒/柱底面就地停住 (headCeilClamp 单源) +
//     collideMove 纵带门头部擦碰容差 (HEAD_GRAZE) —— 楼板下跳跃不再被横推挤出穿墙
// 用法: node dev/verify-tvosd-headbonk-20261110.js [--neg]
//   --neg = 阴性对照 (4 补丁, 对认按红名): N1 步行分支钳制接线摘除 → ②-1 红 /
//   N2 HEAD_GRAZE 摘除 (横推门还原) → ②-3 红 / N3 22-hud OSD 驱动块摘除 → ③ 全红 /
//   N4 tvOv 子元素还原空 div → ① 结构断言红。负对照断言 (墙照推/桌沿不误钳) 各模式下恒绿。
// 口径: 与 verify-vehburn-20261109 同款 boot (真 three + index.html 全脚本链 + startBtn 开局)。
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

// ── 阴性对照 (一律单行锚) ──
const PATCHES=[
 // N1 病灶还原: 步行分支头顶钳制接线摘除 (头探进楼板纵带, 横推接管 ⇒ 穿模穿墙复现)
 ['js/20-player.js','if(p.vel.y>0&&headCeilClamp(p.pos,p.vel.y*dt,_pHeadH)) p.vel.y=0;','// NEG N1'],
 // N2 病灶还原: 横推盒门眼线 (1.5) 还原为头顶线 (1.7) —— 擦碰天花板那帧横推仍接管 (★2026-11-14 跟码)
 ['js/04-collision.js','if(pos.y+1.5<b.minY||pos.y+0.25>b.maxY) return;','if(pos.y+1.7<b.minY||pos.y+0.25>b.maxY) return; // NEG N2'],
 // N3 病灶还原: OSD 驱动块摘除 (遮罩退回光秃扫描线)。单行锚 (22-hud CRLF, 多行锚必失配)
 ['js/22-hud.js',"if(player.loiter&&!player.loiter.dead){","if(false&&player.loiter&&!player.loiter.dead){ // NEG N3"],
 // N4 病灶还原: tvOv 子元素整块摘除
 ['index.html','<div id="tvOv"><i class="tvC tvTL"></i>','<div id="tvOv">X<i class="tvC tvTL"></i>'],
];
const PATCH_MAP={};
if(NEG) for(const [f,from,to] of PATCHES){
 const s=PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f);
 if(s.indexOf(from)<0) throw new Error('阴性对照锚点未找到: '+f+' :: '+from.slice(0,70));
 PATCH_MAP[f]=s.split(from).join(to);
}
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f));

// ── ① 源码防回退 ─────────────────────────────────────────────
section('① 源码防回退 (修好的写法在 / 旧写法不在)');
{
const s04=SRC('js/04-collision.js'), s20=SRC('js/20-player.js'), s22=SRC('js/22-hud.js'),
      s13=SRC('js/13-combat.js'), s18=SRC('js/00b-i18n.js'), ih=srcOf('index.html'), css=SRC('css/style.css');
assert('04-collision: headCeilClamp 单源 + 穿越窗判据 + 双回调 + 零分配槽',
 /function headCeilClamp\(pos,rise(?:,stanceH)?\)/.test(s04)
 &&s04.includes('if(b.minY<s.prevHead||b.minY>s.head) return;')
 &&s04.includes('if(c.y0<s.prevHead||c.y0>s.head) return;')
 &&s04.includes('const _hcS={pos:null,r:0.42,prevHead:0,head:0,hit:0};')
 &&/pos\.y=_hcS\.hit-(?:1\.7|hh);/.test(s04));
assert('04-collision: 横推双门眼线以上不作为 (盒+柱, 2026-11-14 批③改窗)',
 s04.includes('const HEAD_GRAZE=0.06;')
 &&/if\(pos\.y\+(?:hh-0\.2|1\.5)<b\.minY\|\|pos\.y\+0\.25>b\.maxY\) return;/.test(s04)
 &&/if\(pos\.y\+(?:hh-0\.2|1\.5)<c\.y0\|\|pos\.y\+0\.2>c\.y1\) return;/.test(s04)
 &&s04.includes('_hcS.prevHead=pos.y+1.5;'));
assert('20-player: 两条步兵积分路径都接线 (步行 + TV制导本体)',
 (s20.match(/if\(p\.vel\.y>0&&headCeilClamp\(p\.pos,p\.vel\.y\*dt(?:,_pHead(?:H|Tv))?\)\) p\.vel\.y=0;/g)||[]).length===2);
assert('index.html: tvOv OSD 子元素齐 (四角标/顶栏REC+时钟+LINK/分划/开镜标/底栏双读数/存续条)',
 ih.includes('<div id="tvOv"><i class="tvC tvTL"></i><i class="tvC tvTR"></i><i class="tvC tvBL"></i><i class="tvC tvBR"></i>')
 &&ih.includes('<span id="tvRec"></span><span id="tvTag">TV制导 · TV GUIDANCE</span><span id="tvClock"></span>')
 &&ih.includes('▂▄▆█</span> LINK</div>')
 &&ih.includes('<div id="tvReticle"><i class="tvRk t"></i><i class="tvRk b"></i><i class="tvRk l"></i><i class="tvRk r"></i><i class="tvRc"></i></div>')
 &&ih.includes('<div id="tvZoom" class="tvOsd">ZOOM ×2.8</div>')
 &&ih.includes('<div id="tvBotL" class="tvOsd"></div><div id="tvBotR" class="tvOsd"></div>')
 &&ih.includes('<div id="tvLifeWrap"><div id="tvLifeFill"></div></div></div>'));
assert('css: OSD 四角标/低量红脉冲/REC闪烁/分划/存续条规则齐',
 css.includes('#tvOv.low { animation:tvLowPulse .9s steps(2,end) infinite; }')
 &&css.includes('@keyframes tvLowPulse')
 &&css.includes('@keyframes tvRecBlink')
 &&css.includes('.tvTL { left:7%; top:9%; border-right:none; border-bottom:none; }')
 &&css.includes('#tvReticle .tvRk.t { left:-1px; bottom:84px;')
 &&css.includes('#tvLifeWrap { position:absolute; left:50%; bottom:30px;')
 &&css.includes('#tvOv .tvOsd { position:absolute;')
 &&css.includes('#tvTopL { left:calc(7% + 46px); top:9%; }'));
assert('22-hud: OSD 逐帧驱动 (底栏读数/时间码/开镜标/存续条/low+boost+zoom 类/FPV沉浸门) + 退场清账',
 s22.includes("function _ltImmHud(hide){")
 &&s22.includes("const boost=(keys.Space&&!player._ltSpace);")
 &&s22.includes("const zoom=!!(mouse2Down&&!player._ltRClick);")
 &&s22.includes("hudText('tvBotL',t2('离地')+' '+agl+'m · '+t2('速度')+' '+Math.round(d.spd)+'m/s'+(boost?' ▸▸ '+t2('加速'):''));")
 &&s22.includes("hudText('tvBotR',t2('离机')+' '+Math.round(d.pos.distanceTo(player.pos))+'m');")
 &&s22.includes("hudShow('tvZoom',zoom);")
 &&s22.includes("hudText('tvZoom','ZOOM ×'+((typeof camera!=='undefined'&&camera&&camera.fov>1)?Math.round(85/camera.fov*10)/10:1));")
 &&s22.includes("hudClass('tvOv',(d.life<4?'low':'')+(boost?' boost':'')+(zoom?' zoom':''));")
 &&s22.includes("_ltImmHud(true);")
 &&s22.includes("_ltImmHud(false);")
 &&s22.includes("hudStyle('tvLifeFill','width',Math.max(0,Math.min(100,Math.round(d.life/(d.lifeMax||24)*100)))+'%');")
 &&s22.includes("hudClass('tvOv','');")
 &&s22.includes("hudClass('tvOv','');"));
assert('13-combat: lifeMax 出膛记账 (存续条上限单源, HUD 缺省兜底 24)',
 s13.includes('life:24, lifeMax:24, t:0, spd:13')&&s22.includes('d.lifeMax||24'));
assert('00b-i18n: OSD 三字码词条 (离地/速度/离机)',
 s18.includes("'离地':'ALT','速度':'SPD','离机':'DST'"));
}

// ── 沙箱装载 (真 three; 与 verify-vehburn 同款 boot) ──────────
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
let IDX=-1;
{ const c0=boot(0); IDX=vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="normandy")',c0); }
const ctx=boot(IDX);
const G=s=>vm.runInContext(s,ctx,{timeout:300000});
let err=null;
try{ G("document.getElementById('startBtn').onclick();"); }catch(e){ err='start: '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); }
if(!err) try{ G("player.team=0; player.cls=0; player.spectator=false; player.alive=true; player.deployed=true; player.hp=100;"); }catch(e){ err='playerInit: '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); }
assert('② 前置: 开局+玩家就位 (实验模式 sf_exp=1, 巡飞弹可用)',!err&&G('typeof tanks==="object"&&tanks.length>0')===true,err||'');

// ── ② 行为: 跳跃头顶钳制 ─────────────────────────────────────
section('② 行为: 楼板下跳跃就地停住 + 擦碰不横推');
{
// 测试天花板盒: 直接 push 进 BOXES, RGRID_OFF 关网格走全扫 (探针卫生: 测后还原并摘盒)。
// ★盒必须以玩家出生位为中心 (旧写以世界原点为中心 ⇒ 没罩住玩家 = 全链假绿)。
// 底面压到 pos.y0+2.0 (自由跳高仅 ~0.814m, 头顶起跳即 1.7 ⇒ 跳 0.3m 必撞底面; 3.0m 档会假绿=根本撞不到)
G("globalThis._jx=player.pos.x; globalThis._jz=player.pos.z; globalThis._p0=player.pos.y; globalThis._n0=BOXES.length;"
 +"globalThis._ceiling={minX:_jx-2,maxX:_jx+2,minZ:_jz-2,maxZ:_jz+2,minY:_p0+2.0,maxY:_p0+2.4,dead:false};"
 +"BOXES.push(_ceiling); window.RGRID_OFF=true; globalThis._maxY=-1e9; globalThis._maxDx=0;");
// 按住空格连跳 3s: 头 (pos.y+1.7) 永不探入底面 (player.pos.y0+2.0) ⇒ 钳位上限 = pos.y0+0.3
G("keys.Space=true; for(let i=0;i<180;i++){ updatePlayer(1/60); if(player.pos.y>_maxY)_maxY=player.pos.y; _maxDx=Math.max(_maxDx,Math.abs(player.pos.x-_jx),Math.abs(player.pos.z-_jz)); } keys.Space=false;");
assert('②-1 楼板下连跳: 头顶钳位 (max pos.y ≤ 底面-1.7+1e-4, 永不探入楼板; 自由跳高 0.814>0.3 必撞)',G('_maxY')<=G('_p0+2.0-1.7+1e-4')&&G('_maxY')>G('_p0+0.2'),`maxY=${G('_maxY').toFixed(3)} 上限=${G('_p0+0.3').toFixed(3)}`);
assert('②-2 全程无横向挤出 (|dx|,|dz| ≤ 0.05m —— 旧版此处被楼板横推甩出)',G('_maxDx')<=0.05,`maxDx=${G('_maxDx').toFixed(3)}`);
G("for(let i=0;i<90;i++) updatePlayer(1/60); globalThis._ex=player.pos.x; globalThis._ez=player.pos.z;");
assert('②-3 松键落回原地 (不再被甩到楼板边上)',Math.abs(G('_ex-_jx'))<=0.05&&Math.abs(G('_ez-_jz'))<=0.05,`dx=${G('_ex-_jx').toFixed(3)} dz=${G('_ez-_jz').toFixed(3)}`);
// 擦碰单元: 站在楼板正下方 (pos.y+1.7 恰==底面) 直调 collideMove —— 容差门跳过, 位置零位移
G("globalThis._tp={x:_jx,y:_p0+0.3,z:_jz}; collideMove(_tp,0.42);");
assert('②-4 擦碰容差: 头恰触底面时 collideMove 零横推 (对照起点, 出生点不在原点)',Math.abs(G('_tp.x-_jx'))<=1e-9&&Math.abs(G('_tp.z-_jz'))<=1e-9,`dx=${G('_tp.x-_jx')} dz=${G('_tp.z-_jz')}`);
// 墙负对照: 落地墙照推 (容差只豁免"底面在头顶档"的天花板, 不豁免落地墙)。推挤目标位 = 墙面(_jx+0.3) - 半径0.42
G("globalThis._wall={minX:_jx+0.3,maxX:_jx+3,minZ:_jz-3,maxZ:_jz+3,minY:_p0-1,maxY:_p0+2.5,dead:false}; BOXES.push(_wall);"
 +"globalThis._wp={x:_jx,y:_p0,z:_jz}; collideMove(_wp,0.42);");
assert('②-6 负对照: 落地墙照常横推 (推离至半径 0.42 外)',G('_wp.x')<=G('_jx')+0.3-0.42+1e-6,`x=${G('_wp.x').toFixed(3)}`);
// TV制导本体分支同口径: 跳跃出膛仍在上升 ⇒ 钳位同在
G("player.pos.set(_jx,_p0,_jz); player.vel.set(0,0,0); player.onGround=false; player.vel.y=4.6;"
 +"player.loiter={pos:player.pos.clone(),spd:13,life:24,lifeMax:24,dead:false,mesh:{visible:true},yaw:0,pitch:0,t:0,grace:1,trail:0,owner:player,team:player.team};"
 +"globalThis._lMax=-1e9; for(let i=0;i<60;i++){ updatePlayer(1/60); if(player.pos.y>_lMax)_lMax=player.pos.y; }");
assert('②-7 TV制导中本体上升同钳 (max ≤ 底面-1.7)',G('_lMax')<=G('_p0+2.0-1.7+1e-4')&&G('_lMax')>G('_p0+0.2'),`lMax=${G('_lMax').toFixed(3)}`);
G("player.loiter=null; player.pos.set(_jx,_p0,_jz); player.vel.set(0,0,0); player.onGround=true;");
// 摘天花板后再测桌沿负对照 (否则 0.8m 跳高先撞 2.0m 底面被钳 ⇒ 跳高只剩 0.3, 对照失真)
G("BOXES.splice(BOXES.indexOf(_ceiling),1);"
 +"globalThis._table={minX:_jx+1.2,maxX:_jx+2.2,minZ:_jz-2,maxZ:_jz+2,minY:_p0+0.75,maxY:_p0+0.95,dead:false}; BOXES.push(_table);"
 +"player.vel.set(0,0,0); player.onGround=true; keys.Space=true;"
 +"globalThis._tMax=-1e9; for(let i=0;i<60;i++){ updatePlayer(1/60); if(player.pos.y>_tMax)_tMax=player.pos.y; } keys.Space=false;");
assert('②-5 负对照: 桌沿旁跳跃不误钳 (跳高≈自由抛体 0.814±0.1)',Math.abs(G('_tMax-_p0-0.814'))<=0.1,`跳高=${(G('_tMax-_p0')).toFixed(3)}`);
// 卫生: 逐个 indexOf 摘测试盒 (勿用 BOXES.length=idx 截断) + 还原网格
G("BOXES.splice(BOXES.indexOf(_table),1); BOXES.splice(BOXES.indexOf(_wall),1); window.RGRID_OFF=false;");
assert('②-8 探针卫生: 测试盒全摘 (BOXES.length 还原)',G('BOXES.length')===G('_n0'),`len=${G('BOXES.length')} 原=${G('_n0')}`);
}

// ── ③ 行为: TV 遮罩 OSD ──────────────────────────────────────
section('③ 行为: OSD 逐帧驱动 (读数/时间码/存续条/low 脉冲/开镜标/退场清账)');
{
G("player.loiter={pos:new THREE.Vector3(player.pos.x,player.pos.y+12,player.pos.z),spd:38,life:24,lifeMax:24,dead:false,mesh:{visible:true},yaw:0,pitch:0,t:0,grace:1,trail:0,owner:player,team:player.team};"
 +"player._ltRClick=false; for(let i=0;i<8;i++) updateHUD(1/60);");
const bl=G("document.getElementById('tvBotL').textContent")||'';
assert('③-1 底栏读数: 离地/速度字样 + 数值 (AGL 随地形, 勿钉死具体米数)',/离地|ALT/.test(bl)&&/速度|SPD/.test(bl)&&/\d+m/.test(bl)&&/38m\/s/.test(bl),bl);
const br=G("document.getElementById('tvBotR').textContent")||'';
assert('③-2 右栏离机读数',/离机|DST/.test(br)&&/\d+m/.test(br),br);
const ck=G("document.getElementById('tvClock').textContent")||'';
assert('③-3 时间码 T+mm:ss.d',/^T\+\d{2}:\d{2}\.\d$/.test(ck),ck);
assert('③-4 存续条满格 (life=lifeMax ⇒ width 100%)',G("document.getElementById('tvLifeFill').style.width")==='100%',G("document.getElementById('tvLifeFill').style.width"));
assert('③-5 满存续无 low 脉冲 (tvOv 类名空)',(G("document.getElementById('tvOv').className")||'')==='',G("document.getElementById('tvOv').className"));
assert('③-6 未开镜: ZOOM 标隐藏',G("document.getElementById('tvZoom').style.display")==='none',G("document.getElementById('tvZoom').style.display"));
G("mouse2Down=true; for(let i=0;i<8;i++) updateHUD(1/60);");
assert('③-7 开镜中: ZOOM 标显示 (与 updateCamera 同判据)',G("document.getElementById('tvZoom').style.display")==='block');
G("mouse2Down=false; player.loiter.life=3.2; for(let i=0;i<8;i++) updateHUD(1/60);");
assert('③-8 存续<4s: low 脉冲类 + 填充条转红 (与 magN 同阈值)',G("document.getElementById('tvOv').className")==='low'&&/255,\s*90,\s*70/.test(G("document.getElementById('tvLifeFill').style.background")||G("document.getElementById('tvLifeFill').style.backgroundColor")||''));
G("player.loiter.life=12; player.loiter.lifeMax=24; for(let i=0;i<8;i++) updateHUD(1/60);");
assert('③-9 存续条半格 (life/lifeMax=50%)',G("document.getElementById('tvLifeFill').style.width")==='50%',G("document.getElementById('tvLifeFill').style.width"));
G("player.loiter=null; for(let i=0;i<8;i++) updateHUD(1/60);");
assert('③-10 退场清账: low 类摘除 + ZOOM 标收走',G("document.getElementById('tvOv').className")===''&&G("document.getElementById('tvZoom').style.display")==='none');
}

// ── 汇总 ─────────────────────────────────────────────────────
console.log('\n──────────────────────────────');
console.log(`  ${NEG?'NEG':'正向'} ${OK.length} 绿 / ${BAD.length} 红`);
if(BAD.length){ console.log('  红名: '+BAD.join(' · ')); process.exitCode=1; }
