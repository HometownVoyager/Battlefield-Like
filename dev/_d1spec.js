// ─────────────────────────────────────────────
// dev/_d1spec.js —— D1 观战态击落浮空复现探针 (2026-09-28 用户取证: 观战模式必现浮空)
// 与 verify-phase2 的差别: FILES 补入 19b-gamepad.js + 22b-speclayer.js (游戏真加载、探针从未载的两件),
// 搭真实观战态 (player.spectator/alive/deployed + SpecLayer.on + updateSpecLayer 跑起来, 名牌会挂进 grp),
// 用 24-main 同款帧长解析 (specTimeConsume/PlayerDt/RideDt) 推进迷你主循环, 再走击落链。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const stub=require('./_bootstub.js');
const root=path.resolve(__dirname,'..');
const FILES=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/15g-capmodels.js','js/15h-capital.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/19b-gamepad.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/22a-menuart.js','js/22b-speclayer.js','js/23-deploy.js','js/23b-worldrestore.js','js/24-main.js'];
const RS=`class StubRenderer{constructor(o){this.domElement=(o&&o.canvas)||document.createElement('canvas');this.domElement.style=this.domElement.style||{};this.shadowMap={enabled:false,type:0,autoUpdate:true};this.info={render:{calls:0,triangles:0},memory:{}};this.capabilities={isWebGL2:true,getMaxAnisotropy:()=>4,maxTextureSize:4096,maxTextures:16};this.xr={enabled:false,isPresenting:false,addEventListener(){},removeEventListener(){}};this.autoClear=true;}setSize(){}setPixelRatio(){}setViewport(){}setScissor(){}setScissorTest(){}render(){}clear(){}clearDepth(){}setClearColor(){}setClearAlpha(){}dispose(){}setAnimationLoop(){}compile(){return new Set();}getContext(){return null;}getRenderTarget(){return null;}setRenderTarget(){}readRenderTargetPixels(){}copyFramebufferToTexture(){}initTexture(){}resetState(){}getDrawingBufferSize(){return{x:1,y:1};}getSize(t){if(t)t.set(1280,720);return{width:1280,height:720};}getPixelRatio(){return 1;}}THREE.WebGLRenderer=StubRenderer;`;
function boot(campIdx){
for(const k in stub.byId) delete stub.byId[k];
const c=vm.createContext(Object.assign({},stub.sandbox));
c.document=stub.document; c.window=stub.window;
c.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
vm.runInContext(fs.readFileSync(path.join(root,'dev/vendor/three.min.js'),'utf8'),c,{filename:'three.min.js'});
vm.runInContext('THREE = globalThis.THREE;',c,{filename:'bind-three'});
vm.runInContext(RS,c,{filename:'stub-renderer'});
for(const f of FILES){ try{ vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),c,{filename:f}); }catch(e){ console.log('  [加载失败 '+f+'] '+e.message); } }
return c;
}
let failures=0;
const ok=m=>console.log('  ✓ '+m), bad=m=>{ console.log('  ✗ '+m); failures++; };
const ctx=boot(0);
const Q=s=>vm.runInContext(s,ctx);
Q(`
__miniFrame=(rdt)=>{
// 24-main 同款帧长解析 (22b 已载): 世界/本体/座驾三轨
const dt=(typeof specTimeConsume==='function')?specTimeConsume(rdt):rdt;
const pdt=(typeof specTimePlayerDt==='function')?specTimePlayerDt(rdt,dt):dt;
const vdt=(v)=>(typeof specTimeRideDt==='function')?specTimeRideDt(v,rdt,dt):dt;
for(const pl of planes) pl.update(vdt(pl));
updatePlaneWrecks(dt);
if(typeof updateSpecLayer==='function') updateSpecLayer(pdt);
return {dt,pdt};
};
__specSetup=()=>{
player.spectator=true; player.alive=true; player.deployed=true;
player.pos.set(0,80,0); player.onVehicle=null; player.onNaval=null;
if(typeof SpecLayer!=='undefined') SpecLayer.on=true;
const pl=new Plane(1,0);
pl.pos.set(30,80,0); pl.speed=44; pl.crewBot=null;
planes.length=0; planes.push(pl);
return pl;
};
__specKill=()=>{ planes[0].takeDmg(9999,player); };
__specState=()=>{
const pl=planes[0];
const r={specConsume:specTimeConsume(0.016),frozen:(typeof specTimeFrozen==='function')?specTimeFrozen():null,
layerOn:(typeof SpecLayer!=='undefined')?SpecLayer.on:null,tagInGrp:!!(pl&&pl._specTag),
dead:pl?pl.alive!==true:null,hidden:pl?pl.grp.visible===true?'仍可见':'已隐':'无',
wrecks:planeWrecks.length,floatNone:true};
if(r.wrecks){ const w=planeWrecks[r.wrecks-1]; r.wstate=w.state; r.wy=+w.pos.y.toFixed(1);
for(const w2 of planeWrecks) if(w2.m&&w2.m.parent) w2.m.parent.remove(w2.m); planeWrecks.length=0; }
for(const p of planes) if(p&&!p.alive&&p.grp&&p.grp.visible) r.floatNone=false;
return r;
};
`);
console.log('观战态 (无时停 · 无幽灵坦克 · 信息层开) 击落链:');
const a=Q(`(function(){
const pl=__specSetup();
__miniFrame(0.016); __miniFrame(0.016);            // 信息层先把标签挂进 grp
const pre={specConsume:specTimeConsume(0.016),frozen:specTimeFrozen(),tag:!!pl._specTag,alive:pl.alive};
try{ __specKill(); }catch(e){ return {fatal:'die链抛异常: '+e.message,stack:String(e.stack||'').split(String.fromCharCode(10)).slice(0,7).join(' | '),pre}; }
let frames=0;
for(let i=0;i<600;i++){ const f=__miniFrame(0.016); frames++; if(planeWrecks.length&&planeWrecks[planeWrecks.length-1].state!=='fall') break; }
const st=__specState();
st.pre=pre; st.frames=frames;
return st;
})()`);
console.log('  击落前: specTimeConsume='+a.pre.specConsume.toFixed(3)+' frozen='+a.pre.frozen+' 标签已挂grp='+a.pre.tag+' 机alive='+a.pre.alive);
if(a.fatal) bad('D1-观战: '+a.fatal);
else{
if(a.pre.specConsume>0&&!a.pre.frozen) ok('观战无时停: 世界帧长正常 (specTimeConsume=rdt, 未冻结)');
else bad('观战无时停却冻结! specTimeConsume='+a.pre.specConsume);
if(a.dead&&a.hidden==='已隐'&&a.wrecks>0) ok('击落后: 本体已隐 + 残骸已挂 (状态账正确)');
else bad('击落后状态异常: alive='+a.dead+' grp='+a.hidden+' wrecks='+a.wrecks);
if(a.floatNone===false) bad('D1-观战复现浮空: 存在 alive=false 且 grp 可见的飞机!');
else ok('无 "死而不隐" 状态');
console.log('  残骸末态: state='+a.wstate+' y='+a.wy+' (驱动 '+a.frames+' 帧)'+(a.tagInGrp?' · 标签曾挂入grp':''));
if(a.wstate&&a.wstate!=='fall') ok('残骸已脱离 fall (落地/沉没)');
else bad('残骸 600 帧后仍在 fall (未落地)');
}
// 残骸在观战态是否真的每帧推进: 直接对 updatePlaneWrecks 用 24-main 的世界帧长
const b=Q(`(function(){
const pl=new Plane(1,0); pl.pos.set(0,80,0); pl.speed=44; pl.crewBot=null;
planes.length=0; planes.push(pl);
pl.takeDmg(9999,player);
const w=planeWrecks[planeWrecks.length-1];
const y0=w.pos.y;
for(let i=0;i<100;i++){ const f=__miniFrame(0.016); if(f.dt<=0) return {stuck:'世界帧长为0'}; }
return {fell:w.pos.y<y0,dy:+(y0-w.pos.y).toFixed(1),state:w.state};
})()`);
if(b.stuck) bad('观战态世界帧长=0 (这正是浮空根因!): '+b.stuck);
else if(b.fell) ok('观战态迷你主循环: 残骸 100 帧下降 '+b.dy+'m (state='+b.state+')');
else bad('观战态迷你主循环: 残骸 100 帧不下坠 (dy='+b.dy+')');
console.log(failures?'\n✗ _d1spec: '+failures+' 项失败':'\n✓ _d1spec: 全部通过');
process.exit(failures?1:0);
