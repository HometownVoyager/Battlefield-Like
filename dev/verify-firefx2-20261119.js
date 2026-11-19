// ─────────────────────────────────────────────
// dev/verify-firefx2-20261119.js —— 火焰特效重做批探针 (2026-11-19, 不进 index.html)
// 轻沙箱: js/00-config.js + js/08-effects.js (svgApply/sun/hemi/scene/FXMAX_STEPS 探针桩),
// 不载 02-scene 全链 —— 载入清单纪律: 本探针只测 08-effects 自足行为 + 源码钉跨文件接线,
// 与 index.html 实载脚本数对账不适用 (轻沙箱, T7 用源码钉补跨文件事实)。
// 断言 (T1-T6 正 + NEG 三补丁逐补丁隔离 boot, --neg 跑阴性):
//   T1 贴图: PT.flame 存在 / 独立于 PT.flash / 64×64 画布 (Canvas 兜底 flameTex 三段径向渐变)。
//   T2 精修接线: svgApply('puffFlame') 已调 (探针桩记账) + 02-scene 源码钉 svgFlame/svgReg('puffFlame')。
//   T3 spawnFlame 附加账: ramp=1 / stretch∈[1.7,2.2] / swayA∈[0.45,0.95] / swF∈[5,9] /
//      rotation=0 / spin=0 / 贴图=PT.flame / 生命色带表 4 档白热→暗红。
//   T4 updateParticles 火苗分支: 纵拉比例逐位 / 双轴摇摆一帧位移=解析式 (v+sin/cos 项) /
//      色带白热端→暗红端 (RGB 通道带容差) / 透明度旧衰减式不变。
//   T5 老粒子+池化清账: spawnP 老路 ramp=0; merged 池复用火苗对象给普通粒子 (无 uuid 沙箱同款)
//      必回老路径: scale.y===scale.x + 材质色不被染 (p.ramp=0 清账行 = 防串样式闸)。
//   T6 SMOKES 火舌: incin 云 7 舌全 PT.flame + 纵拉 1.6 + updateSmokes 闪烁随动保比。
//   T7 站点换装源码钉: 04b spawnFlame×4 + 残留 spawnP(PT.flash)=2 (灼痕/tbDetonate 保留) +
//      16-aircraft spawnFlame×2 + 残留=2 (flak 保留) + 08-effects 结构钉 + 02-scene svgFlame 钉 +
//      预算门/限流原样 (fireFxOK 调用点数 / FIRE_FX_BUDGET_STEPS 字面 / fireFlameN<14 限流)。
//   NEG N1 摘 spawnP 清账行 → 池化复用串样式 (ramp 串账) 被抓;
//       N2 摘 updateParticles 火苗分支 → 火苗走老路 (无拉伸无色带) 被抓;
//       N3 SMOKES 火舌 map 回 PT.flash → 被抓。
// 用法: node dev/verify-firefx2-20261119.js [--neg]
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const {sandbox,document,window,byId}=require('./_bootstub.js');
const NEG=process.argv.includes('--neg');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const load=(ctx,file)=>vm.runInContext(read(file),ctx,{filename:file});
let PASS=0,FAILS=0;
function ok(cond,label){ if(cond){ PASS++; console.log('  ✔ '+label); } else { FAILS++; console.log('  ✘ '+label); } }
const VM=(ctx,e)=>vm.runInContext(e,ctx);
const cnt=(s,sub)=>s.split(sub).length-1;

// ── 探针桩 (00-config 之后 / 08-effects 之前): 02-scene 未载 ⇒ svgApply 等接线桩 ──
const PRELUDE=`
var __svgApplied=[];
var svgApply=function(tex,name){ __svgApplied.push(String(name)); return tex; };   // 记账桩 (02-scene 未载)
var scene={add(){},remove(){}};
var sun={intensity:1,castShadow:false};
var hemi={intensity:1};
function sunShadowAllowed(){ return true; }   // 02-scene 未载, 桩同语义 (initWeather 载入期消费)
var NIGHT_MODE=false;
var nowT=0;                      // updateParticles 摇摆相位钟 (探针逐帧手推)
var combatants=[], tanks=[];     // updateSmokes 灼烧段空表 (不进循环)
var camera={position:V3(0,6,0)};
function crater(){}
var AudioSys={explosion(){},metalSlide(){},splash(){},click(){},panOf(){return 0;}};
`;
function boot(patch08){
for(const k in byId) delete byId[k];
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document; ctx.window=window;
ctx.localStorage={_s:{},getItem(k){return (k in this._s)?this._s[k]:null;},setItem(){},removeItem(){}};
load(ctx,'js/00-config.js');
vm.runInContext(PRELUDE,ctx,{filename:'prelude'});
vm.runInContext(patch08?patch08(read('js/08-effects.js')):read('js/08-effects.js'),ctx,{filename:'js/08-effects.js'});
return ctx;
}
function negPatch(from,to,tag){
const s=read('js/08-effects.js');
const c=s.split(from).length-1;
if(c!==1){ console.error('✗ NEG '+tag+' 锚点非唯一 ('+c+'): '+from.slice(0,60)); process.exit(1); }
return s.replace(from,to);
}

if(!NEG){
// ═══════════ 正向 ═══════════
const ctx=boot();
const T=(e)=>VM(ctx,e);

console.log('── T1 PT.flame 贴图 (Canvas 兜底) ──');
{
const r=T(`({has:typeof PT.flame!=='undefined',isFlash:PT.flame===PT.flash,w:PT.flame.image.width,h:PT.flame.image.height,
hasFlash:typeof PT.flash!=='undefined'})`);
ok(r.has&&r.hasFlash,'T1 PT.flame 贴图已注册 (PT.flash 同在: 枪口焰/爆炸/灼痕保留)');
ok(!r.isFlash,'T1 PT.flame 独立于 PT.flash (不再是圆盘贴图复用)');
ok(r.w===64&&r.h===64,'T1 贴图 64×64 画布 (与既有 puff 系同规格)');
}

console.log('── T2 SVG 精修接线 ──');
{
const applied=T('__svgApplied');
ok(applied.indexOf('puffFlame')>=0,'T2 svgApply(PT.flame,\'puffFlame\') 载入期已调 (账: '+applied.join(',')+')');
ok(applied.indexOf('puffSmoke')>=0&&applied.indexOf('puffDark')>=0&&applied.indexOf('puffDirt')>=0,'T2 既有烟/黑烟/尘精修接线原样');
const src02=read('js/02-scene.js');
ok(cnt(src02,"svgReg('puffFlame'")===1,'T2 源码钉: 02-scene svgReg(\'puffFlame\') 注册');
ok(cnt(src02,'function svgFlame(')===1,'T2 源码钉: 02-scene svgFlame 生成器 (feTurbulence 泪滴)');
}

console.log('── T3 spawnFlame 附加账 ──');
{
const r=T(`(()=>{
const p=spawnFlame(0,0,0,0.2,1.5,0,0.5,1.0,1.0,0.85,-1);
if(!p) return {err:'spawnFlame 返回空'};
return {ramp:p.ramp,st:p.stretch,swA:p.swayA,swF:p.swF,rot:p.sp.material.rotation,spin:p.spin,
map:p.sp.material.map===PT.flame,add:p.sp.material.blending,n:particles.length};
})()`);
if(r.err){ ok(false,'T3 '+r.err); }
else{
ok(r.ramp===1,'T3 ramp=1 (火苗标记)');
ok(r.st>=1.7&&r.st<=2.2,'T3 纵向拉伸 stretch='+r.st.toFixed(2)+' ∈ [1.7,2.2] (≈2:1 口径)');
ok(r.swA>=0.45&&r.swA<=0.95,'T3 摇摆振幅 swayA='+r.swA.toFixed(2)+' ∈ [0.45,0.95]');
ok(r.swF>=5&&r.swF<=9,'T3 摇摆频率 swF='+r.swF.toFixed(2)+' ∈ [5,9] rad/s');
ok(r.rot===0&&r.spin===0,'T3 rotation=0/spin=0 (舌形朝上, 不吃随机旋转)');
ok(r.map,'T3 贴图=PT.flame');
ok(r.n===1,'T3 粒子入池 (旧 spawnP 链复用, 不另起炉灶)');
}
const rampLen=T('FLAME_RAMP.length');
const r0=T('FLAME_RAMP[0]'), r3=T('FLAME_RAMP[3]');
ok(rampLen===4&&r0[0]===1&&r0[1]>=0.9&&r0[2]>=0.8,'T3 色带起点=白热 ('+r0.join(',')+')');
ok(r3[0]<0.9&&r3[1]<0.4&&r3[2]<0.15,'T3 色带终点=暗红 ('+r3.join(',')+')');
}

console.log('── T4 updateParticles 火苗分支 (拉伸/摇摆/色带) ──');
{
const p=T(`(()=>{ nowT=0; updateParticles(0);   // 清池到稳态
const p=spawnFlame(0,0,0,0.2,0,0,0.5,1.0,1.0,0.85,-1);
__p=p; return p; })()`);
// 单帧解析式: 一帧 updateParticles(0.05) 后 x 增量 = vx*dt + sin(nowT*swF+swPh)*swayA*dt (vz=0 → z 纯摆动)
const d=T(`(()=>{ nowT=0.3;
const xa=__p.sp.position.x, za=__p.sp.position.z;
updateParticles(0.05);
return {dx:__p.sp.position.x-xa, dz:__p.sp.position.z-za, sx:__p.sp.scale.x, sy:__p.sp.scale.y, age:__p.age,
  hotHex:__p.sp.material.color.getHex()}; })()`);
const expDx=0.2*0.05+Math.sin(0.3*p.swF+p.swPh)*p.swayA*0.05;
const expDz=Math.cos(0.3*p.swF*0.83+p.swPh*1.7)*p.swayA*0.6*0.05;
ok(Math.abs(d.dx-expDx)<1e-9,'T4 x 位移一帧解析式逐位 (dx='+d.dx.toFixed(6)+' ≈ '+expDx.toFixed(6)+': 速度项+摇摆项)');
ok(Math.abs(d.dz-expDz)<1e-9,'T4 z 摆动解析式逐位 (dz='+d.dz.toFixed(6)+' ≈ '+expDz.toFixed(6)+': z 轴 ×0.83 频率/×1.7 相位)');
ok(Math.abs(d.sy/d.sx-p.stretch)<1e-9,'T4 纵拉比例 sy/sx===stretch ('+(d.sy/d.sx).toFixed(3)+' vs '+p.stretch.toFixed(3)+')');
ok(d.age>0.049&&d.age<0.051,'T4 age 照常推进 (旧账不动)');
const ch=h=>[(h>>16)&255,(h>>8)&255,h&255];
const e0=ch(d.hotHex);
ok(e0[0]===255&&e0[1]>=236&&e0[1]<=250&&e0[2]>=196&&e0[2]<=212,'T4 色带白热端 age≈0.05 → rgb('+e0.join(',')+') ≈ (255,243,204)');
// 色带: 16 帧后 age=0.85 (rf=2.55, 暗红端); 通道带 ±6 容差
T('(()=>{ for(let f=0;f<16;f++){ nowT+=0.05; updateParticles(0.05); } })()');
const c2=T('__p.sp.material.color.getHex()');
const e2=ch(c2);
ok(e2[0]>=218&&e2[0]<=236&&e2[1]>=94&&e2[1]<=112&&e2[2]>=24&&e2[2]<=40,'T4 色带暗红端 age≈0.85 → rgb('+e2.join(',')+') ≈ (224,100,29)');
ok(c2<d.hotHex,'T4 色带单调变暗 (hex '+d.hotHex+'→'+c2+')');
const op=T('__p.sp.material.opacity');
ok(op>0&&op<0.86,'T4 透明度旧衰减式不变 (opa×(1-age/life)='+op.toFixed(3)+')');
}

console.log('── T5 老粒子 + 池化清账 (ramp=0 防串样式闸) ──');
{
// T4 的火苗已烧尽回收 (merged 池: 沙箱 CanvasTexture 无 uuid ⇒ 所有 additive 粒子同池,
// 真浏览器按 uuid 分池 —— 本断言在两种口径下都必须成立)
const r=T(`(()=>{
const p=spawnP(PT.flash,0,0,0,0,0,0,0.4,1,0.3,1,0,true);
const col0=p.sp.material.color.getHex();
updateParticles(0.05);
return {ramp:p.ramp,col0,col1:p.sp.material.color.getHex(),sx:p.sp.scale.x,sy:p.sp.scale.y,rot:p.sp.material.rotation};
})()`);
ok(r.ramp===0,'T5 普通粒子 ramp=0 (spawnP 清账行: 火苗对象回收复用不串样式)');
ok(r.col0===0xffffff&&r.col1===0xffffff,'T5 材质色不被染 (色带只归火苗分支)');
ok(Math.abs(r.sy-r.sx)<1e-9,'T5 scale.setScalar 老路径 (无纵拉)');
ok(r.rot!==0,'T5 随机旋转老路径 (spin=0 时 rot 保持 spawnP 的 rand(0,TAU) 初值)');
}

console.log('── T6 SMOKES 燃烧弹云火舌 ──');
{
const r=T(`(()=>{
spawnSmokeCloud(V3(0,0,0),true,null);
const c=SMOKES[SMOKES.length-1];
const fl=c.sprites.filter(s=>s.flame);
return {n:fl.length,flameMap:fl.every(s=>s.sp.material.map===PT.flame),
ratio:fl.every(s=>Math.abs(s.sp.scale.y/s.sp.scale.x-1.6)<1e-9),nAll:c.sprites.length};
})()`);
ok(r.n===7&&r.nAll===21,'T6 火舌 7 片/全云 21 sprite (数量原样)');
ok(r.flameMap,'T6 火舌贴图全=PT.flame (旧 PT.flash 圆盘)');
ok(r.ratio,'T6 火舌纵拉 1.6 逐位');
const r2=T(`(()=>{
for(let f=0;f<3;f++){ nowT+=0.1; updateSmokes(0.1); }
const c=SMOKES[SMOKES.length-1];
const fl=c.sprites.filter(s=>s.flame);
return {ratio:fl.every(s=>Math.abs(s.sp.scale.y/s.sp.scale.x-1.6)<1e-9),
op:fl.every(s=>isFinite(s.sp.material.opacity)&&s.sp.material.opacity>=0&&s.sp.material.opacity<=1)};
})()`);
ok(r2.ratio,'T6 updateSmokes 闪烁随动保比 (旧 setScalar 拉回正方形 → 已改 set(w,w*1.6))');
ok(r2.op,'T6 火舌 opacity 有限且 ∈[0,1]');
}

console.log('── T7 站点换装源码钉 + 预算门原样 ──');
{
const s04b=read('js/04b-fire.js'), s16=read('js/16-aircraft.js'), s08=read('js/08-effects.js');
ok(cnt(s04b,'spawnFlame(')===4,'T7 04b 换装 ×4 (生物附着/树冠火/持续火源/格火)');
ok(cnt(s04b,'spawnP(PT.flash')===2,'T7 04b 残留 PT.flash=2 (灼痕 fireDamageTick + tbDetonate 爆点保留)');
ok(cnt(s16,'spawnFlame(')===2,'T7 16-aircraft 换装 ×2 (翼残骸火/机燃拖火)');
ok(cnt(s16,'spawnP(PT.flash')===2,'T7 16 残留 PT.flash=2 (flak 炮口焰保留)');
ok(cnt(s08,'function flameTex(')===1&&cnt(s08,'flame: flameTex(),')===1,'T7 08-effects: flameTex 定义+PT 表注册');
ok(cnt(s08,'function spawnFlame(')===1&&cnt(s08,'const FLAME_RAMP=')===1,'T7 08-effects: spawnFlame+FLAME_RAMP 单源');
ok(cnt(s08,'if(p.ramp){')===1&&cnt(s08,'p.ramp=0;')===1,'T7 08-effects: 火苗分支+清账行各一处');
ok(cnt(s04b,'fireFxOK()')>=8,'T7 预算门调用点原样 ('+cnt(s04b,'fireFxOK()')+' 处, 换装未脱门)');
ok(cnt(s04b,'FIRE_FX_BUDGET_STEPS=[26,14,44]')===1,'T7 预算档位字面原样');
ok(cnt(s04b,'fireFlameN<14')===1,'T7 格火限流 fireFlameN<14 原样');
ok(cnt(s04b,'PARTICLE_MAX')===1,'T7 04b 仅注释提及 PARTICLE_MAX (池帽单源仍在 08-effects)');
}
console.log('正向: '+PASS+' 过 / '+FAILS+' 败');
process.exit(FAILS?1:0);
}

// ═══════════ 阴性 (--neg): 三补丁逐补丁隔离 boot (frameperf3 同文件补丁互毒教训) ═══════════
console.log('── N1 摘 spawnP 清账行 (p.ramp=0) → 池化复用串样式被抓 ──');
{
const ctx=boot(s=>negPatch('p.ramp=0;   // ★2026-11-19: 火苗附加账每次 spawn 清零 (spawnFlame 随后重写; 池化复用不串样式)','/* N1 清账摘除 */','N1'));
const r=VM(ctx,`(()=>{
const p=spawnFlame(0,0,0,0.2,0,0,0.5,1.0,0.2,0.85,-1);
updateParticles(0.1); updateParticles(0.1); updateParticles(0.1);   // age=0.3≥life → 回收
const p2=spawnP(PT.flash,0,0,0,0,0,0,0.4,1,0.3,1,0,true);   // merged 池复用同一对象
let stretched=false;
updateParticles(0.05);
if(Math.abs(p2.sp.scale.y-p2.sp.scale.x)>1e-9) stretched=true;
return {contaminated:p2.ramp===1,stretched};
})()`);
ok(r.contaminated&&r.stretched,'N1 阴性成立: 清账缺失 ⇒ 复用对象 ramp 串账+纵拉串到普通粒子 (正向判据抓红)');
}

console.log('── N2 摘 updateParticles 火苗分支 → 老路径无拉伸无色带被抓 ──');
{
const ctx=boot(s=>negPatch('if(p.ramp){','if(false){','N2'));
const r=VM(ctx,`(()=>{
const p=spawnFlame(0,0,0,0.2,0,0,0.5,1.0,1.0,0.85,-1);
updateParticles(0.05);
return {sameScale:Math.abs(p.sp.scale.y-p.sp.scale.x)<1e-9,col:p.sp.material.color.getHex()};
})()`);
ok(r.sameScale&&r.col===0xffffff,'N2 阴性成立: 分支摘除 ⇒ 火苗无纵拉+色不染 (正向 T4 判据抓红)');
}

console.log('── N3 SMOKES 火舌 map 回 PT.flash → 被抓 ──');
{
const ctx=boot(s=>negPatch('map:PT.flame,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,color:0xff9a3c','map:PT.flash,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,color:0xff9a3c','N3'));
const r=VM(ctx,`(()=>{
spawnSmokeCloud(V3(0,0,0),true,null);
const c=SMOKES[SMOKES.length-1];
const fl=c.sprites.filter(s=>s.flame);
return {flashMap:fl.length>0&&fl.every(s=>s.sp.material.map===PT.flash)};
})()`);
ok(r.flashMap,'N3 阴性成立: 火舌回退圆盘贴图 (正向 T6 判据抓红)');
}

console.log('NEG: '+PASS+' 过 / '+FAILS+' 败 (阴性=坏状态成立才算过)');
process.exit(FAILS?1:0);
