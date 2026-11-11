// ─────────────────────────────────────────────
// dev/verify-uvref-20260928.js —— 材质克隆 uvRef 保真判据 (2026-09-28D 用户实报
//   "不可破坏建筑各部分材质一致性差劲, 像挨了涂鸦" 的回归闸)
//
// 病根: 永久件档 (_matShade/structMatPerm) 与受损档 (structMatDamage) 用 three 原生
//   Material.clone() 建变体 —— clone 不复制自定义字段, 旧代码只回写 dmgTier/permTier
//   不回写 uvRef ⇒ 克隆件丢贴图密度登记 ⇒ 05-world.uvGeo 跳过归一 ⇒ BoxGeometry 六面
//   UV 0..1 原样拉伸铺满各自小面: 每段墙/檐带/山墙砖石比例各不相同 (谷仓坡顶 1.2m 宽
//   "木板"斑马条带 / 砖楼檐带大砖 / 石裙墙巨块)。修法: _matShade 克隆后回写 uvRef
//   (与 depthVariant 05-world.js 同一纪律)。
//
// 判据 (真 three + 桩渲染器 + 全脚本链, 诺曼底与淞沪两图):
//   ① 全库带 brick/plaster/stone/wood/woodDark/roof 贴图的网格材质, uvRef 一件不许丢;
//   ② 阴性对照: 构造一个丢 uvRef 的克隆喂给探针, 判据必须报红 (证明判据不是恒绿);
//   ③ 抽查已知的纯视觉永久件 (谷仓坡板/山墙): 其材质必须是带 uvRef 的变体或原材质。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const stub=require('./_bootstub.js');
const root=path.resolve(__dirname,'..');
const FILES=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/22a-menuart.js','js/23-deploy.js','js/23b-worldrestore.js','js/24-main.js'];
const RS=`class StubRenderer{constructor(o){this.domElement=(o&&o.canvas)||document.createElement('canvas');this.domElement.style=this.domElement.style||{};this.shadowMap={enabled:false,type:0,autoUpdate:true};this.info={render:{calls:0,triangles:0},memory:{}};this.capabilities={isWebGL2:true,getMaxAnisotropy:()=>4,maxTextureSize:4096,maxTextures:16};this.xr={enabled:false,isPresenting:false,addEventListener(){},removeEventListener(){}};this.autoClear=true;}setSize(){}setPixelRatio(){}setViewport(){}setScissor(){}setScissorTest(){}render(){}clear(){}clearDepth(){}setClearColor(){}setClearAlpha(){}dispose(){}setAnimationLoop(){}compile(){return new Set();}getContext(){return null;}getRenderTarget(){return null;}setRenderTarget(){}readRenderTargetPixels(){}copyFramebufferToTexture(){}initTexture(){}resetState(){}getDrawingBufferSize(){return{x:1,y:1};}getSize(t){if(t)t.set(1280,720);return{width:1280,height:720};}getPixelRatio(){return 1;}}THREE.WebGLRenderer=StubRenderer;`;
function boot(campIdx){
for(const k in stub.byId) delete stub.byId[k];
const c=vm.createContext(Object.assign({},stub.sandbox));
c.document=stub.document; c.window=stub.window;
c.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
vm.runInContext(fs.readFileSync(path.join(root,'dev/vendor/three.min.js'),'utf8'),c,{filename:'three.min.js'});
vm.runInContext('THREE = globalThis.THREE;',c,{filename:'bind-three'});
vm.runInContext(RS,c,{filename:'stub-renderer'});
for(const f of FILES) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),c,{filename:f});
return c;
}
const SCAN=`
function __scanMissing(){
const TNAME=new Map();
for(const k in TEX) if(TEX[k]&&typeof TEX[k]==='object') TNAME.set(TEX[k],k);
const WALL=['brick','plaster','stone','wood','woodDark','roof'];
const bad=[];
world.updateMatrixWorld(true);
world.traverse(o=>{
if(!o.isMesh||o.isInstancedMesh) return;
const g=o.geometry,m=o.material; if(!g||!m||!m.map) return;
const tn=TNAME.get(m.map); if(!WALL.includes(tn)) return;
if(!g.parameters||g.parameters.width===undefined) return;   // 非盒几何不归一 (圆柱等), 不在本判据内
if(m.uvRef===undefined) bad.push(tn+' '+(g.parameters.width.toFixed(1)+'x'+g.parameters.height.toFixed(1)+'x'+g.parameters.depth.toFixed(1)));
});
return bad;
}
`;
let failures=0;
const ok=m=>console.log('  ✓ '+m), bad=m=>{ console.log('  ✗ '+m); failures++; };
for(const camp of [0,3]){
const ctx=boot(camp);
const Q=s=>vm.runInContext(s,ctx);
Q(SCAN);
const title=Q('CAMPAIGN.title||CAMPAIGN.id');
console.log(`战役 #${camp} (${title})`);
const missing=Q('__scanMissing()');
if(missing.length===0) ok('① 六种建筑材质全部带 uvRef (0 件丢失)');
else bad(`① ${missing.length} 件建筑材质丢 uvRef: ${missing.slice(0,6).join(' / ')}${missing.length>6?' …':''}`);
// ③ 抽查谷仓坡板 (solidBox 永久件, 2026-09-28 实机斑马条带的正主)
const barnOk=Q(`(function(){
const b=BUILD_REG.find(r=>r.type==='barn'); if(!b) return null;
let hit=0,badm=0;
world.traverse(o=>{
if(!o.isMesh||o.isInstancedMesh) return;
const m=o.material,g=o.geometry; if(!m||!m.map||!g||!g.parameters) return;
const wp=o.getWorldPosition(new THREE.Vector3());
if(Math.hypot(wp.x-b.x,wp.z-b.z)>Math.max(b.w,b.d)*0.75) return;
if(m.map===TEX.wood&&(m===MAT.wood||m.uvRef!==undefined)) hit++; else if(m.map===TEX.wood) badm++;
});
return {hit,badm};
})()`);
if(barnOk===null) console.log('  ⊘ ③ 本图无谷仓, 跳过抽查');
else if(barnOk.badm===0&&barnOk.hit>0) ok(`③ 谷仓木构件 ${barnOk.hit} 件材质全部带 uvRef`);
else bad(`③ 谷仓木构件 ${barnOk.badm} 件丢 uvRef (仅 ${barnOk.hit} 件正常)`);
// ② 阴性对照: 丢 uvRef 的克隆必须被同一判据抓到
const neg=(()=>{
const c2=boot(camp); const Q2=s=>vm.runInContext(s,c2); Q2(SCAN);
Q2(`(function(){ // 把一面砖墙的材质换成"丢了 uvRef 的克隆"(复刻旧 bug)
const T=new Map(); for(const k in TEX) if(TEX[k]&&typeof TEX[k]==='object') T.set(TEX[k],k);
world.traverse(o=>{ if(o.isMesh&&o.material&&o.material.map&&T.get(o.material.map)==='brick'&&o.geometry.parameters){ o.material=o.material.clone(); o.material.uvRef=undefined; } });
})()`);
return Q2('__scanMissing()').length;
})();
if(neg>0) ok(`② 阴性对照: 人为丢 uvRef 的克隆被抓到 ${neg} 件 (判据有效)`);
else bad('② 阴性对照未报红 —— 判据失效');
}
console.log(failures?`\n✗ verify-uvref: ${failures} 项失败`:'\n✓ verify-uvref: 全部通过');
process.exit(failures?1:0);
