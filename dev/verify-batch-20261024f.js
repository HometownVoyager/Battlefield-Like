// ─────────────────────────────────────────────
// dev/verify-batch-20261024f.js —— 2026-10-24f 批验收: ①敌方载具信标改倒三角(友方保持正三角) ②观战模式四弹种全配
//                                    ③观战模式手雷预瞄(弹道点串+落点圈) ④烧毁植被黑炭化后再消失
// 用法: node --stack-size=4000 dev/verify-batch-20261024f.js
// 口径: 与 verify-batch-20261024e 同源 boot (真 three + 桩渲染器 + 全脚本链, 00c-procgen 在列 —— 探针载入盲区教训);
//   ①信标形状 = 源字符串断言 (桩 canvas 2d 不回放路径, 三角形顶点即 canvas 指令本身) + buildMesh 产物契约不回归;
//   ②弹种 = specGear 行为断言 + rearmPlayerClass 观战/非观战双分支落装 + 各接线点源断言;
//   ③预瞄 = updateNadeArc 行为断言 (spectator=true 下持雷 → nadeArc 面板/落点圈/提示亮出, 松手收干净);
//   ④黑炭 = 建模期 instanceColor 白初始化行为断言 + vanishFlora(rec,false,true) 染色 + 无 charred 不染色负对照。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const stub=require('./_bootstub.js');
const root=path.resolve(__dirname,'..');
let pass=0,fail=0; const bads=[];
const ok=(cond,msg)=>{ if(cond){pass++; console.log('  ✓ '+msg);} else {fail++; bads.push(msg); console.log('  ✗ '+msg);} };

const FILES=['js/00-config.js','js/00b-i18n.js','js/00c-procgen.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/22a-menuart.js','js/23-deploy.js','js/23b-worldrestore.js','js/24-main.js'];
function boot(campIdx,pseed){
for(const k in stub.byId) delete stub.byId[k];
const ctx=vm.createContext(Object.assign({},stub.sandbox));
ctx.document=stub.document; ctx.window=stub.window;
ctx.localStorage={_s:{sf_campaign:String(campIdx),sf_pseed:String(pseed||'')},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
vm.runInContext(fs.readFileSync(path.join(root,'dev/vendor/three.min.js'),'utf8'),ctx,{filename:'three.min.js'});
vm.runInContext('THREE = globalThis.THREE;',ctx,{filename:'bind-three'});
vm.runInContext(`
class StubRenderer{
constructor(o){ this.domElement=(o&&o.canvas)||document.createElement('canvas'); this.domElement.style=this.domElement.style||{};
this.shadowMap={enabled:false,type:0,autoUpdate:true}; this.info={render:{calls:0,triangles:0},memory:{}};
this.capabilities={isWebGL2:true,getMaxAnisotropy:()=>4,maxTextureSize:4096,maxTextures:16};
this.xr={enabled:false,isPresenting:false,addEventListener(){},removeEventListener(){}}; this.autoClear=true; }
setSize(){} setPixelRatio(){} setViewport(){} setScissor(){} setScissorTest(){} render(){} clear(){} clearDepth(){}
setClearColor(){} setClearAlpha(){} dispose(){} setAnimationLoop(){} compile(){return new Set();}
getContext(){return null;} getRenderTarget(){return null;} setRenderTarget(){} readRenderTargetPixels(){}
copyFramebufferToTexture(){} initTexture(){} resetState(){} getDrawingBufferSize(){return {x:1,y:1};}
getSize(t){ if(t) t.set(1280,720); return {width:1280,height:720}; } getPixelRatio(){return 1;}
}
THREE.WebGLRenderer=StubRenderer;`,ctx,{filename:'stub-renderer'});
for(const f of FILES) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
return ctx;
}
const Q=(ctx,s)=>vm.runInContext(s,ctx);
const SRC=f=>fs.readFileSync(path.join(root,f),'utf8');

// ── ① 信标形状: **只有敌方**倒三角, 友方原正三角 (canvas 顶点序: 顶边在上 y=5, 尖朝下 y=59) ──
console.log('── ① 敌方载具信标改倒三角 / 友方保持正三角 (2026-10-24 用户指定) ──');
{
const ac=SRC('js/16-aircraft.js'), tk=SRC('js/15-vehicles.js');
const INV=/moveTo\(32,59\);\s*bg7?\.lineTo\(59,5\);\s*bg7?\.lineTo\(5,5\)/;
const UP=/moveTo\(32,5\);\s*bg7?\.lineTo\(59,57\);\s*bg7?\.lineTo\(5,57\)/;
ok(INV.test(ac)&&UP.test(ac),'16-aircraft: 敌(倒三角)/友(正三角) 两分支都在');
ok(INV.test(tk)&&UP.test(tk),'15-vehicles: 同款两分支');
ok(/beaconInverted\(this\.team\)/.test(ac)&&/beaconInverted\(this\.team\)/.test(tk),
  '两处 canvas 都走单源判据 beaconInverted(this.team) (相对 player.team, 不分家各写一份)');
// 行为断言: 判据随玩家队伍翻转 (0 队视角: 1 队=倒; 1 队视角: 0 队=倒)
const ctx=boot(0);
const bv=Q(ctx,`
(function(){
player.team=0; const a0=beaconInverted(0), a1=beaconInverted(1);
player.team=1; const b0=beaconInverted(0), b1=beaconInverted(1);
player.team=0;
return JSON.stringify({a0,a1,b0,b1});
})()`);
const o0=JSON.parse(bv);
ok(o0.a0===false&&o0.a1===true,'玩家=0队: 友方(0队)不倒, 敌方(1队)倒');
ok(o0.b0===true&&o0.b1===false,'玩家=1队: 视角翻转 (0队变敌方=倒, 1队变友方=不倒)');
// 产物契约不回归: 信标 sprite 仍在、位高/尺寸同旧 (与 verify-vehmodels/verify-batch-20261024e 同口径)
const r=Q(ctx,`
(function(){
const D=(FACTIONS.us).tanks[0];
const T={def:D,variant:0,team:0,name:D.name,wheels:[],pos:V3(),halfW:0};
T.buildMesh=Tank.prototype.buildMesh; T.buildMesh.call(T);
return JSON.stringify({has:!!(T.beacon&&T.beacon.isSprite),y:T.beacon?T.beacon.position.y:null,s:T.beacon?T.beacon.scale.x:null});
})()`);
const o=JSON.parse(r);
ok(o.has&&Math.abs(o.y-3.8)<1e-6&&Math.abs(o.s-2.4)<1e-6,'坦克信标产物契约零回归 (Sprite @y3.8, 尺寸2.4)  实测 '+o.y+'/'+o.s);
}

// ── ② 观战模式四弹种全配 ──
console.log('── ② 观战模式手雷四弹种全配 (G/3/4/6) ──');
{
const ctx=boot(0);
const g=Q(ctx,`JSON.stringify(specGear())`);
const o=JSON.parse(g);
ok(o.nades===4&&o.smoke===4&&o.incin===4&&o.atn===4,'specGear() 四弹种各 4  实测 '+g);
// 非观战 (Bot/兵种表) 零回归: 狙击手无 incin/atn、步枪兵无 incin —— 旧口径原样
const cg=Q(ctx,`JSON.stringify({sn:clsGear(2,0),ri:clsGear(0,0)})`);
const c=JSON.parse(cg);
ok(c.sn.incin===0&&c.sn.atn===0&&c.ri.incin===0&&c.ri.atn===2,'clsGear 兵种表零回归 (狙击手 incin/atn=0, 步枪兵 incin=0/atn=2)');
// 落装双分支: 观战 rearm → 四弹种全 4; 非观战 rearm → 兵种表原值
const rr=Q(ctx,`
(function(){
player.spectator=true; rearmPlayerClass(2);
const spec={n:player.nadeCount,s:player.smokeCount,i:player.incinCount,a:player.atNades};
player.spectator=false; rearmPlayerClass(2);
const reg={n:player.nadeCount,s:player.smokeCount,i:player.incinCount,a:player.atNades};
return JSON.stringify({spec,reg});
})()`);
const r2=JSON.parse(rr);
ok(r2.spec.n===4&&r2.spec.s===4&&r2.spec.i===4&&r2.spec.a===4,'观战 rearmPlayerClass: 四弹种全 4 (狙击手观战也有 AT雷/燃烧弹)  实测 '+JSON.stringify(r2.spec));
ok(r2.reg.n===2&&r2.reg.s===2&&r2.reg.i===0&&r2.reg.a===0,'非观战 rearmPlayerClass 零回归 (狙击手 2/2/0/0)  实测 '+JSON.stringify(r2.reg));
// 接线点源断言: 三个玩家侧入口 + Digit4 观战让位 + 兵种卡显示
const p20=SRC('js/20-player.js'), p23=SRC('js/23-deploy.js'), p19=SRC('js/19-input.js');
ok(/const g2=specGear\(\)/.test(p20),'20-player 观战补给回满走 specGear (0.5s 循环)');
ok(/p\.spectator\?specGear\(\):clsGear\(p\.cls,p\.team\)/.test(p20)&&/p\.spectator\?specGear\(\):clsGear\(p\.cls,p\.team\)/.test(p23),
  'rearmPlayerClass + 23-deploy 落装: 观战分支走 specGear');
ok(/player\.cls===3&&!player\.spectator&&!player\.loiter/.test(p19),'Digit4: 反坦克兵切火箭筒排观战 (观战按4=烟雾弹, 不再被 findIndex(-1) 吞键; ★2026-10-25 反馈轮①改写=读条中 4=打断读条再切, 观战让位语义不变)');
ok(/if\(player\.spectator\) return d2\+' · '\+t\('手雷\[G\]×\{0\}'/.test(p23),'兵种卡武器行: 观战显示四弹种全配 (与落装一致)');
}

// ── ③ 观战模式手雷预瞄 (行为断言: spectator 持雷 → 预演亮出) ──
console.log('── ③ 观战手雷预瞄: 弹道点串/落点圈/距离提示 (旧版被 !player.spectator 挡死) ──');
{
const ctx=boot(0);
const r=Q(ctx,`
(function(){
// 相机对准玩家前方地面, 让落点投影有效 (桩里 updateCamera 不跑, 手动摆位)
player.alive=true; player.deployed=true; player.spectator=true; player.yaw=0; player.pitch=0;
player.pos.set(0,heightAt(0,0),0);
camera.position.set(0,player.pos.y+1.62,0);
camera.lookAt(0,player.pos.y+0.5,-14);
camera.updateMatrixWorld(); camera.updateProjectionMatrix();
matchOver=false; gamePaused=false;
player.nadeIsAT=false; player.nadeIsSmoke=true; player.nadeIsIncin=false;
player.nadeHeld=true; player.nadeFuse=99;
VM.state='nade'; VM.stateDur=999;
updateNadeArc();
const box=el('nadeArc'), tip=el('nadeChargeTip');
const on={box:box.style.display,blast:el('naBlast').style.display,spot:el('naSpot').style.display,
 tip:tip.style.display,tipTxt:(tip.textContent||''),dots:box.children.length};
// 松手对账: nadeHeld=false → 面板收干净 (观战态同样要收)
player.nadeHeld=false; VM.state='idle';
updateNadeArc();
const off={box:box.style.display,tip:tip.style.display};
return JSON.stringify({on,off});
})()`);
const o=JSON.parse(r);
ok(o.on.box==='block','观战持雷: #nadeArc 面板亮出  实测 '+o.on.box);
ok(o.on.blast==='block','落点杀伤圈 #naBlast 亮出 (贴地椭圆)  实测 '+o.on.blast);
ok(o.on.spot==='block','精确弹着点 #naSpot 亮出  实测 '+o.on.spot);
ok(o.on.dots>0,'弹道点串已生成 ('+o.on.dots+' 点, 含触地弹跳虚化档)');
ok(o.on.tip==='block'&&/预计投掷/.test(o.on.tipTxt),'距离提示 #nadeChargeTip 亮出: '+String(o.on.tipTxt).slice(0,40));
ok(o.off.box==='none'&&o.off.tip==='none','松手/收雷: 面板与提示收干净 (显隐对账在观战态同样生效)  实测 '+o.off.box+'/'+o.off.tip);
ok(!/!player\.spectator&&typeof VM/.test(SRC('js/22-hud.js')),'updateNadeArc 显示条件: !player.spectator 已移除');
}

// ── ④ 烧毁植被黑炭化后再消失 ──
console.log('── ④ 被烧毁的植物 → 黑炭色 → 沉入消失 (修 instanceColor 空守卫恒假) ──');
{
const ctx=boot(0);
const r=Q(ctx,`
(function(){
const out={hasBushIm:!!BUSH_IM};
// a) 建模期白初始化: 灌木批 + 草丛/庄稼批 (烧毁染色的前置)
if(BUSH_IM){
out.bushColorInit=!!BUSH_IM.instanceColor;
if(BUSH_IM.instanceColor){ const a=BUSH_IM.instanceColor.array;
out.bushWhite=a[0]===1&&a[1]===1&&a[2]===1&&a[3]===1&&a[4]===1&&a[5]===1; }
}
const bi=BURN_INST[0];
out.burnInit=!!(bi&&bi.im&&bi.im.instanceColor);
if(bi&&bi.im&&bi.im.instanceColor){ const a=bi.im.instanceColor.array;
out.burnWhite=a[0]===1&&a[1]===1&&a[2]===1; }
// b) 烧毁 (charred=true): 灌木实例染焦黑 0x241d16
const rec=(BUSH_LIVE||[]).find(b=>b&&b.alive&&!b.dead&&b.kind==='bush');
if(rec){
vanishFlora(rec,false,true);
const a=BUSH_IM.instanceColor.array, i3=rec.li0*3;
// 期望值用上下文内 THREE.Color 换算 (vendor three 开 ColorManagement: setColorAt 存的是 linear 空间值, 非 sRGB hex 分量)
const cc=new THREE.Color(0x241d16);
out.burntChar=rec.dead&&Math.abs(a[i3]-cc.r)<1e-4&&Math.abs(a[i3+1]-cc.g)<1e-4&&Math.abs(a[i3+2]-cc.b)<1e-4;
}
// c) 负对照: 非 charred (碾压/炸没口径) 不染黑
const rec2=(BUSH_LIVE||[]).find(b=>b&&b.alive&&!b.dead&&b.kind==='bush');
if(rec2){
vanishFlora(rec2,false);
const a=BUSH_IM.instanceColor.array, i3=rec2.li0*3;
out.crushNotChar=rec2.dead&&a[i3]===1&&a[i3+1]===1&&a[i3+2]===1;
}
// d) mesh 类植被 (蕨丛/树篱/枯树等): charred=true 换焦黑材质
let mrec=null;
FLORA_HASH.forEach(arr=>{ if(mrec) return; for(const x of arr){ if(x&&!x.dead&&x.alive!==false&&x.meshes&&x.meshes.length&&x.meshes.some(m=>m&&m.parent)){ mrec=x; break; } } });
if(mrec){
vanishFlora(mrec,false,true);
// 2026-10-24f: _charredFloraMat 已从 window 挂载收编为 04b 模块级单例 (无 window 的裸 Node 沙箱防崩), vm 上下文里直接可读
out.meshChar=mrec.dead&&mrec.meshes.every(m=>!m.parent||m.material===_charredFloraMat);
out.meshMatName=_charredFloraMat?('color:#'+_charredFloraMat.color.getHex().toString(16)):null;
}
out.sinkQueued=true;
return JSON.stringify(out);
})()`);
const o=JSON.parse(r);
ok(o.hasBushIm,'本图有灌木实例批 (非城市战役)');
ok(o.bushColorInit&&o.bushWhite,'灌木批 BUSH_IM 建模期 instanceColor 已初始化且全白 (观感零变化)');
ok(o.burnInit&&o.burnWhite,'草丛/庄稼批 (BURN_INST[0]) 同样建模期白初始化');
ok(o.burntChar,'烧毁 vanishFlora(rec,false,true): 实例染焦黑 0x241d16 + rec.dead');
ok(o.crushNotChar,'负对照: 无 charred (碾压/炸没) 不染黑 —— 黑炭语义只归火烧');
ok(o.meshChar,'mesh 类植被烧毁: 整组换 _charredFloraMat ('+(o.meshMatName||'')+')');
ok(/vanishFlora\(rec,false,true\)/.test(SRC('js/04b-fire.js')),'烧尽调用点显式传 charred=true');
ok(/function vanishFlora\(rec,blasted,charred\)/.test(SRC('js/04b-fire.js')),'vanishFlora 签名: charred 独立参数 (不再挂在 !blasted 上)');
ok(/function instColorInit\(im\)/.test(SRC('js/04b-fire.js'))&&/instColorInit\(trunks\)/.test(SRC('js/05b-props.js')),'instColorInit 单源: 草丛/庄稼/灌木/树干四处建模期初始化');
}

console.log('\n════════ '+(fail===0?'全部通过':'失败 '+fail+' 条')+' ════════  pass='+pass+' fail='+fail);
if(bads.length) bads.forEach(b=>console.log('  ✗ '+b));
process.exit(fail?1:0);
