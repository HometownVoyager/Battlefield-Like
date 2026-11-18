// ─────────────────────────────────────────────
// dev/verify-phase2-20260928.js —— 阶段二批判据 (2026-09-28): D3 重立案清算 + D9 新缺陷
//
// 覆盖:
//   D3a 永久件提亮取消 (用户裁定): 全库材质 0 件带 permTier · perm 盒标记保留且幂等
//   D3b 圆柱/圆锥 UV 归一: 烟囱/草垛类按弧长/斜长/端盖直径归一 (正例: 世界里的丝厂烟囱+谷仓草垛;
//        直调: uvGeo(CylinderGeometry, brick) 逐项) · 阴性: 未登记材质 (bark) 不被触碰
//   D9  第三人称本体隐身 (世界还原摘除惰性常驻对象): 复现病根现场 (无 reset ⇒ root 脱离场景) →
//        修复路径 (playerAvatarReset ⇒ 还原后 ensure 原地重建回场景)
//   D10 观战指向线跨局全灭 (D9 同族): 世界还原摘线 → specLineOf 自愈重挂 scene
//   D1  观战态击落浮空 (K1~K7): 直伤/溅射/触地/玩家座机 × 副作用投毒×3 × 时停两态口径 ×
//        观战信息层名牌现场 (userData 环已除 + die 先隐本体)
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const LC=require('./_loadcache.js'); // 2026-11-19 效率批: 读盘+编译缓存 (3 boot; THREE 每需新 ctx 内新执行——只省读盘+解析, 类构建必须逐 ctx)
const stub=require('./_bootstub.js');
const root=path.resolve(__dirname,'..');
const FILES=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/22a-menuart.js','js/23-deploy.js','js/23b-worldrestore.js','js/24-main.js'];
// 观战态判据专用 (D1): 补载游戏真加载、普通探针从未载的两件 (19b 手柄 / 22b 观战层) —— 观战浮空病根正藏于 22b
const FILES_SPEC=FILES.concat(['js/19b-gamepad.js','js/22b-speclayer.js']);
const RS=`class StubRenderer{constructor(o){this.domElement=(o&&o.canvas)||document.createElement('canvas');this.domElement.style=this.domElement.style||{};this.shadowMap={enabled:false,type:0,autoUpdate:true};this.info={render:{calls:0,triangles:0},memory:{}};this.capabilities={isWebGL2:true,getMaxAnisotropy:()=>4,maxTextureSize:4096,maxTextures:16};this.xr={enabled:false,isPresenting:false,addEventListener(){},removeEventListener(){}};this.autoClear=true;}setSize(){}setPixelRatio(){}setViewport(){}setScissor(){}setScissorTest(){}render(){}clear(){}clearDepth(){}setClearColor(){}setClearAlpha(){}dispose(){}setAnimationLoop(){}compile(){return new Set();}getContext(){return null;}getRenderTarget(){return null;}setRenderTarget(){}readRenderTargetPixels(){}copyFramebufferToTexture(){}initTexture(){}resetState(){}getDrawingBufferSize(){return{x:1,y:1};}getSize(t){if(t)t.set(1280,720);return{width:1280,height:720};}getPixelRatio(){return 1;}}THREE.WebGLRenderer=StubRenderer;`;
function boot(campIdx,files){
for(const k in stub.byId) delete stub.byId[k];
const c=vm.createContext(Object.assign({},stub.sandbox));
c.document=stub.document; c.window=stub.window;
c.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
LC.script(root,'dev/vendor/three.min.js').runInContext(c); // 效率批: 633KB 只解析一次
vm.runInContext('THREE = globalThis.THREE;',c,{filename:'bind-three'});
vm.runInContext(RS,c,{filename:'stub-renderer'});
for(const f of (files||FILES)) LC.script(root,f).runInContext(c);
return c;
}
let failures=0;
const ok=m=>console.log('  ✓ '+m), bad=m=>{ console.log('  ✗ '+m); failures++; };
// 圆柱/圆锥 UV 归一断言: 按 groups 分类 (侧面=0/顶盖=1/底盖=2) —— 侧面 u≈theta*rMax/S、v≈斜长/S、
// 端盖最大 uv 半径≈r/S。heightSegments=1 时侧面顶点也在 ±h/2 平面上, 按 y 分类会全误判, 必须走 groups。
const CYLCHK=`
function __cylCheck(g,S){
const p=g.parameters, uv=g.attributes.uv, pos=g.attributes.position;
const rT=(p.radiusTop!==undefined)?p.radiusTop:(p.radius||0);
const rB=(p.radiusBottom!==undefined)?p.radiusBottom:(p.radius||0);
const h=p.height, theta=(p.thetaLength!==undefined)?p.thetaLength:Math.PI*2;
const rMax=Math.max(rT,rB), slant=Math.sqrt(h*h+(rT-rB)*(rT-rB));
const cls=new Uint8Array(pos.count);
if(g.groups&&g.groups.length){ for(const gr of g.groups){ const mi=gr.materialIndex||0; for(let i=gr.start;i<gr.start+gr.count;i++){ const vi=g.index?g.index.getX(i):i; if(vi<cls.length) cls[vi]=mi===1?1:mi===2?2:0; } } }
else{ for(let i=0;i<pos.count;i++){ const py=pos.getY(i); cls[i]=(rT>1e-6&&py>h/2-1e-4)?1:(rB>1e-6&&py<-h/2+1e-4)?2:0; } }
let uMin=1e9,uMax=-1e9,vMin=1e9,vMax=-1e9,capMax=0,nTorso=0,nCap=0;
for(let i=0;i<pos.count;i++){
if(cls[i]===0){
const u=uv.getX(i),v=uv.getY(i);
if(u<uMin)uMin=u; if(u>uMax)uMax=u; if(v<vMin)vMin=v; if(v>vMax)vMax=v; nTorso++;
}else{
const d=Math.hypot(uv.getX(i)-0.5,uv.getY(i)-0.5); if(d>capMax) capMax=d; nCap++;
}
}
const expU=theta*rMax/S, expV=slant/S, expCap=rMax/S;   // 端盖最远点 uv 半径 = 0.5×(2r/S)
return {nTorso,nCap,uSpan:+(uMax-uMin).toFixed(3),vSpan:+(vMax-vMin).toFixed(3),capMax:+capMax.toFixed(3),
expU:+expU.toFixed(3),expV:+expV.toFixed(3),expCap:+expCap.toFixed(3),
uOk:Math.abs(uMax-uMin-expU)<=expU*0.1+1e-3, vOk:Math.abs(vMax-vMin-expV)<=expV*0.1+1e-3,
capOk:Math.abs(capMax-expCap)<=expCap*0.15+1e-3};
}`;
// ── D3 ──
console.log('D3 重立案清算 (贴图不一致)');
for(const camp of [0,3]){
const ctx=boot(camp);
const Q=s=>vm.runInContext(s,ctx);
const title=Q('CAMPAIGN.title||CAMPAIGN.id');
console.log(`战役 #${camp} (${title})`);
// D3a 提亮取消
const a=Q(`(()=>{
let permTier=0, permBoxes=0, sampled=0;
world.traverse(o=>{ if(o.isMesh&&o.material){ const ms=Array.isArray(o.material)?o.material:[o.material];
for(const m of ms) if(m&&m.permTier!==undefined) permTier++; } });
for(const b of BOXES) if(b.perm) permBoxes++;
return {permTier,permBoxes};
})()`);
if(a.permTier===0) ok(`D3a[${camp}] 全库材质 0 件带 permTier (提亮已取消)`);
else bad(`D3a[${camp}] 仍有 ${a.permTier} 件材质带 permTier (提亮未清干净)`);
if(a.permBoxes>0) ok(`D3a[${camp}] perm 盒标记保留 (${a.permBoxes} 件, T10/roofghost 口径不受影响)`);
else bad(`D3a[${camp}] perm 盒标记丢失 (${a.permBoxes} 件)`);
const n1=Q('markPermPieces()'), n2=Q('markPermPieces()');
if(n1===n2) ok(`D3a[${camp}] markPermPieces 幂等 (${n1}=${n2})`);
else bad(`D3a[${camp}] markPermPieces 不幂等 (${n1}→${n2})`);
// D3b 圆柱归一: 世界里的真实件 (淞沪=丝厂砖烟囱; 诺曼底=谷仓草垛 hay)
const want=camp===3?'brick':'hay';
const near=camp===3?'silkFactory':'barn';
Q(CYLCHK);
const b=Q(`(function(){
const TNAME=new Map(); for(const k in TEX) if(TEX[k]&&typeof TEX[k]==='object') TNAME.set(TEX[k],k);
const reg=BUILD_REG.find(r=>r.type===${JSON.stringify(near)}); if(!reg) return null;
const S=(MAT[${camp===3?"'brick'":"'hay'"}]||{}).uvRef;
let best=null;
world.traverse(o=>{
if(!o.isMesh||o.isInstancedMesh) return;
const g=o.geometry,m=o.material;
if(!g||(g.type!=='CylinderGeometry'&&g.type!=='ConeGeometry')||!m||!m.map) return;
if(TNAME.get(m.map)!==${JSON.stringify(want)}) return;
const wp=o.getWorldPosition(new THREE.Vector3());
if(Math.hypot(wp.x-reg.x,wp.z-reg.z)>Math.max(reg.w,reg.d)) return;
if(!best||g.parameters.height>(best.g.parameters.height||0)) best={g,S:(m.uvRef!==undefined?m.uvRef:S)};
});
return best?__cylCheck(best.g,best.S):null;
})()`);
if(b===null) console.log(`  ⊘ D3b[${camp}] 本图 ${near} 旁无 ${want} 圆柱, 跳过`);
else if(b.uOk&&b.vOk&&b.capOk) ok(`D3b[${camp}] ${want} 圆柱已归一 (u ${b.uSpan}≈${b.expU} · v ${b.vSpan}≈${b.expV} · 盖 ${b.capMax}≈${b.expCap})`);
else bad(`D3b[${camp}] ${want} 圆柱未归一: u ${b.uSpan}/${b.expU} v ${b.vSpan}/${b.expV} 盖 ${b.capMax}/${b.expCap}`);
// D3b 直调: uvGeo(CylinderGeometry, MAT.brick) 正例 + uvGeo(·, MAT.bark) 阴性 (未登记 ⇒ 原样)
const direct=Q(`(function(){
const g0=new THREE.CylinderGeometry(0.85,1.2,14,10);
const g=uvGeo(g0,MAT.brick);
if(g===g0) return {fail:'uvGeo 未处理圆柱 (原几何返回)'};
return __cylCheck(g,MAT.brick.uvRef);
})()`);
if(direct.fail) bad(`D3b[${camp}] 直调: ${direct.fail}`);
else if(direct.uOk&&direct.vOk&&direct.capOk) ok(`D3b[${camp}] 直调 uvGeo(Cyl 0.85/1.2×14, brick): u ${direct.uSpan}≈${direct.expU} · v ${direct.vSpan}≈${direct.expV} · 盖 ${direct.capMax}≈${direct.expCap}`);
else bad(`D3b[${camp}] 直调未归一: u ${direct.uSpan}/${direct.expU} v ${direct.vSpan}/${direct.expV} 盖 ${direct.capMax}/${direct.expCap}`);
const negc=Q(`(function(){
if(!MAT.bark) return {skip:true};
const g0=new THREE.CylinderGeometry(0.28,0.4,4.2,7);
const g=uvGeo(g0,MAT.bark);
if(g!==g0) return {fail:'未登记材质的圆柱几何被克隆/改写了 (应原样返回)'};
const uv=g.attributes.uv; let mx=0;
for(let i=0;i<uv.count;i++) mx=Math.max(mx,uv.getX(i));
return {skip:false,mx:+mx.toFixed(3),ok:Math.abs(mx-1)<1e-6};
})()`);
if(negc.skip) console.log(`  ⊘ D3b[${camp}] 无 MAT.bark, 阴性跳过`);
else if(negc.fail) bad(`D3b[${camp}] 阴性: ${negc.fail}`);
else if(negc.ok) ok(`D3b[${camp}] 阴性: 未登记材质 (bark) 圆柱原样返回 (u max ${negc.mx}=1)`);
else bad(`D3b[${camp}] 阴性异常: bark 圆柱 u max ${negc.mx}≠1`);
}
// ── D9 ──
console.log('D9 第三人称本体隐身 (世界还原 × 惰性常驻对象)');
{
const ctx=boot(0);
const Q=s=>vm.runInContext(s,ctx);
Q('playerAvatarEnsure()');
const inScene=Q('!!(playerAvatar&&playerAvatar.root.parent===scene)');
if(inScene) ok('D9a 本体 ensure 后在场景里 (parent===scene)');
else bad('D9a 本体 ensure 后不在场景里');
// 病根现场 (阴性): 摘除 reset ⇒ 世界还原把本体整段摘出场景, 引用却还在
Q('window.__savePAR=playerAvatarReset; playerAvatarReset=undefined;');
Q('restorePristineWorld()');
const bug=Q('!!(playerAvatar&&playerAvatar.root.parent===null)');
if(bug) ok('D9b 阴性对照: 无 reset 时还原后 root.parent===null (隐身病根现场复现)');
else bad('D9b 阴性对照未复现病根 (root 未被摘出?)');
Q('playerAvatarReset=window.__savePAR;');   // 还原单源函数, 走真实修复路径
// 修复路径: reset → ensure 重建 → 还原 → 引用被清 → ensure 再建, 恒在场景
const fixed=Q(`(function(){
playerAvatarReset();
const av1=playerAvatarEnsure();
const step1=!!(av1&&av1.root.parent===scene);
restorePristineWorld();
const wiped=(playerAvatar===null);
const av2=playerAvatarEnsure();
const step2=!!(av2&&av2.root&&av2.root.parent===scene);
return {step1,wiped,step2};
})()`);
if(fixed.step1) ok('D9c-1 reset 后 ensure 重建回场景');
else bad('D9c-1 reset 后 ensure 未回场景');
if(fixed.wiped) ok('D9c-2 世界还原后 playerAvatar 引用已被清空 (下次 ensure 必重建)');
else bad('D9c-2 世界还原后 playerAvatar 引用残留 (隐身会复发)');
if(fixed.step2) ok('D9c-3 还原后 ensure 原地重建且在场景里 (按 U 必显示)');
else bad('D9c-3 还原后 ensure 重建件不在场景里');
}
// ── D1 ──
console.log('D1 重立案清算 (被当空击毁的飞机浮空固定)');
{
// 观战态判据必须载入 22b 观战层 (名牌 Sprite 会挂进 plane.grp —— 观战浮空病根所在), 故用 FILES_SPEC
const ctx=boot(0,FILES_SPEC);
const Q=s=>vm.runInContext(s,ctx);
// 击毁现场断言: 死体必隐 + 残骸必进 fall 态; 驱动残骸运动学直到落地; 全场无 "alive=false 且 grp 可见"
const CORE=`
__d1AssertKill=(pl)=>{
const r={deadHidden:!!(pl&&!pl.alive&&!pl.grp.visible),wreck:planeWrecks.length>0};
if(r.wreck){ const w=planeWrecks[planeWrecks.length-1]; r.fall=w.state==='fall';
for(let i=0;i<600&&w.state==='fall';i++) updatePlaneWrecks(0.05);
r.landed=w.state!=='fall';
r.floatNone=true;
}else r.fall=false,r.landed=false,r.floatNone=true;
for(const p of planes) if(p&&!p.alive&&p.grp&&p.grp.visible) r.floatNone=false;
return r;
};
__d1Spawn=(driven)=>{
const pl=new Plane(0,0);
pl.pos.set(0,80,0); pl.speed=44;
if(driven){ pl.playerDriven=true; player.onVehicle=pl; }
return pl;
};
__d1Cleanup=(keepWreck)=>{
for(const p of planes){ if(p&&p.grp&&p.grp.parent) p.grp.parent.remove(p.grp); }
planes.length=0;
if(!keepWreck){ for(const w of planeWrecks){ if(w.m&&w.m.parent) w.m.parent.remove(w.m); } planeWrecks.length=0; }
player.onVehicle=null; player.alive=true; player.deployed=true;
};
__d1WreckFreeze=()=>{   // 时停口径: dt=0 残骸逐位冻结, 解除后照常落地
const pl=new Plane(1,0);
pl.pos.set(0,80,0); pl.speed=44;
pl.takeDmg(9999,player);
const w=planeWrecks[planeWrecks.length-1];
const y0=w.pos.y;
for(let i=0;i<40;i++) updatePlaneWrecks(0);
const frozen=Math.abs(w.pos.y-y0)<1e-9;
for(let i=0;i<600&&w.state==='fall';i++) updatePlaneWrecks(0.05);
const landed=w.state!=='fall';
pl.grp.parent&&pl.grp.parent.remove(pl.grp); planes.length=0;
for(const w2 of planeWrecks){ if(w2.m&&w2.m.parent) w2.m.parent.remove(w2.m); } planeWrecks.length=0;
return {frozen,landed};
};
`;
Q(CORE);
// K1 直伤 (航炮/防空炮/巡飞弹直击同入口 takeDmg)
{
const pl=Q('__d1Spawn(false)');
Q('planes[0].takeDmg(9999,player)');
const r=Q('__d1AssertKill(planes[0])');
r.deadHidden&&r.wreck&&r.fall&&r.landed&&r.floatNone
? ok('D1-K1 直伤击落: 本体隐+残骸 fall+落地, 无浮空')
: bad(`D1-K1 异常: ${JSON.stringify(r)}`);
Q('__d1Cleanup()');
}
// K2 溅射 (爆炸近旁: splashDamage 的 ff 圈)
{
const pl=Q('__d1Spawn(false)');
Q(`splashDamage(planes[0].pos,player,-1,12,400,300,true)`)   // ff=true: 与巡飞弹战斗部同口径;
const r=Q('__d1AssertKill(planes[0])');
r.deadHidden&&r.wreck&&r.fall&&r.landed&&r.floatNone
? ok('D1-K2 溅射击落: 本体隐+残骸 fall+落地, 无浮空')
: bad(`D1-K2 异常: ${JSON.stringify(r)}`);
Q('__d1Cleanup()');
}
// K3 触地坠毁 (update 的 pos.y<gh+2 分支)
{
const pl=Q('__d1Spawn(false)');
Q('planes[0].pos.y=heightAt(planes[0].pos.x,planes[0].pos.z)+1; planes[0].update(0.05)');
const r=Q('__d1AssertKill(planes[0])');
r.deadHidden&&r.wreck&&r.fall&&r.landed&&r.floatNone
? ok('D1-K3 触地坠毁: 本体隐+残骸 fall+落地, 无浮空')
: bad(`D1-K3 异常: ${JSON.stringify(r)}`);
Q('__d1Cleanup()');
}
// K4 玩家座机被击落 (playerDriven: die 的 player.damage 链)
{
const pl=Q('__d1Spawn(true)');
Q('planes[0].takeDmg(9999,null)');
const r=Q('__d1AssertKill(planes[0])');
r.deadHidden&&r.wreck&&r.fall&&r.landed&&r.floatNone
? ok('D1-K4 玩家座机击落: 本体隐+残骸 fall+落地, 无浮空')
: bad(`D1-K4 异常: ${JSON.stringify(r)}`);
Q('__d1Cleanup()');
}
// K5 副作用链逐点投毒 (die 记分/战报/特效/玩家死亡链任一抛异常, 单位状态也必须已退场)
for(const poison of ['registerKillScore','addKillfeed','explosionFX']){
const pl=Q('__d1Spawn(false)');
Q(`__d1Save=${poison}; ${poison}=()=>{throw new Error('注入');}; planes[0].takeDmg(9999,player)`);
const r=Q(`(function(){ try{ ${poison}=__d1Save; }catch(e){} return __d1AssertKill(planes[0]); })()`);
r.deadHidden&&r.wreck&&r.fall&&r.landed&&r.floatNone
? ok(`D1-K5 ${poison} 抛异常: 单位仍原子退场, 无浮空`)
: bad(`D1-K5 ${poison} 抛异常出现浮空/未退场: ${JSON.stringify(r)}`);
Q('__d1Cleanup()');
}
// 时停两态: dt=0 残骸冻结是既定口径 (不得误伤); 解除后必须照常落地 —— "浮空固定永不消失"才算缺陷
const tf=Q('__d1WreckFreeze()');
if(tf.frozen&&tf.landed) ok('D1-K6 时停口径: 冻结期残骸逐位冻结, 解除后落地 (两态行为均正确)');
else bad(`D1-K6 时停口径异常: ${JSON.stringify(tf)}`);
// D1-K7 观战态 (用户实机"观战模式必现浮空"的正主): 信息层名牌 Sprite 挂进 plane.grp, 其 userData 曾有
// host 环 → die() 的 grp.clone() 内 three Object3D.copy 的 JSON 往返抛 "circular structure" →
// die() 中断在"本体已死未隐"之间 = 挂天。修复: 22b 去掉 userData.host (根因) + die() 先隐本体/交接块
// try 包裹 (结构保证)。本节复刻该现场 (spectator 态 + 信息层开 + 名牌已挂) 断言击落链完整。
{
const spec=Q(`(function(){
player.spectator=true; player.alive=true; player.deployed=true;
player.pos.set(0,80,0); player.onVehicle=null;
if(typeof SpecLayer!=='undefined') SpecLayer.on=true;
__d1Cleanup();
const pl=new Plane(1,0); pl.pos.set(30,80,0); pl.speed=44; pl.crewBot=null;
planes.length=0; planes.push(pl);
// 迷你主循环 (24-main 同款帧长解析) 推两帧: 让信息层把名牌挂进 grp
const frame=(rdt)=>{
const dt=(typeof specTimeConsume==='function')?specTimeConsume(rdt):rdt;
const pdt=(typeof specTimePlayerDt==='function')?specTimePlayerDt(rdt,dt):dt;
const vdt=(v)=>(typeof specTimeRideDt==='function')?specTimeRideDt(v,rdt,dt):dt;
for(const pp of planes) pp.update(vdt(pp));
updatePlaneWrecks(dt);
if(typeof updateSpecLayer==='function') updateSpecLayer(pdt);
};
frame(0.016); frame(0.016);
const tagIn=!!pl._specTag;
try{ pl.takeDmg(9999,player); }catch(e){ return {tagIn,throw:e.message}; }
for(let i=0;i<600&&planeWrecks.length&&planeWrecks[planeWrecks.length-1].state==='fall';i++){
dt2=(typeof specTimeConsume==='function')?specTimeConsume(0.05):0.05;
updatePlaneWrecks(dt2);
}
const r={tagIn,throw:null,hidden:pl.grp.visible===false,wreck:planeWrecks.length>0,
landed:planeWrecks.length?planeWrecks[planeWrecks.length-1].state!=='fall':false};
for(const w2 of planeWrecks){ if(w2.m&&w2.m.parent) w2.m.parent.remove(w2.m); } planeWrecks.length=0;
return r;
})()`);
if(spec.throw) bad(`D1-K7 观战击落链抛异常 (${spec.throw}) —— 名牌已挂=${spec.tagIn}`);
else if(spec.tagIn&&spec.hidden&&spec.wreck&&spec.landed) ok('D1-K7 观战态击落 (信息层名牌已挂 grp): 本体隐+残骸 fall+落地, 无浮空 (userData 环已除+die 先隐)');
else bad(`D1-K7 观战态异常: ${JSON.stringify(spec)}`);
// D10 观战指向线跨局全灭 (D9 同族: specLineOf 是 scene.add 的惰性对象, 被世界还原摘出场景
// 而 u._specLine 引用残留 ⇒ 下一局观战全线画不出)。修复 = specLineOf 取线时自愈重挂。
{
const d10=Q(`(function(){
__d1Cleanup();
const u={pos:new THREE.Vector3(0,0,0),team:player.team,alive:true};
const l=specLineOf(u);
const ok0=!!(l&&l.parent===scene);
restorePristineWorld();
const detached=!!(l&&l.parent===null);
const l2=specLineOf(u);
const healed=!!(l2&&l2===l&&l2.parent===scene);
return {ok0,detached,healed};
})()`);
if(d10.ok0) ok('D10a 指向线首次取用在场景里');
else bad(`D10a 指向线首次取用不在场景: ${JSON.stringify(d10)}`);
if(d10.detached) ok('D10b 阴性对照: 世界还原把指向线摘出场景 (跨局全灭病根现场)');
else bad('D10b 阴性对照未复现 (线未被摘出?)');
if(d10.healed) ok('D10c 自愈: 还原后再取用同一线已重挂 scene (跨局观战指向线不灭)');
else bad(`D10c 自愈失败: ${JSON.stringify(d10)}`);
}
}
}
console.log(failures?`\n✗ verify-phase2: ${failures} 项失败`:'\n✓ verify-phase2: 全部通过');
process.exit(failures?1:0);
