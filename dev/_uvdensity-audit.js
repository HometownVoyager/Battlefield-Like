// ─────────────────────────────────────────────
// dev/_uvdensity-audit.js —— 贴图密度一致性审计 (纯 Node, 真 three + 桩渲染器 + 全脚本链)
// 用法: node --stack-size=4000 dev/_uvdensity-audit.js [战役索引=2] [TOP=14]
//
// 为什么量这个: 用户二报过"窗下材质不一致"(2026-09-20c), 判据是 **同一材质的贴图密度漂移**
//   —— BoxGeometry 六面 UV 恒 0..1 ⇒ 密度 = 面世界尺寸 ÷ 贴图覆盖, 随构件尺寸漂移。
//   当时的修法 = 05-world.uvGeo 按 mat.uvRef (UV_DENSITY, 米/张贴图) 归一面 UV。
//   本次用户三报"部分建筑严重的材质不一致", 先量当前世界还有多少**未归一**的面 (密度 = 面尺寸)。
// 口径: 只量 BoxGeometry (归一只对它生效)。非盒几何 (圆柱/环/自定义) 单列一行供参考。
//   density_u = 面宽(m) / u 跨度(贴) —— 即"这张贴图在 u 方向铺了多少米"。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const stub=require('./_bootstub.js');
const root=path.resolve(__dirname,'..');
const CAMP=parseInt(process.argv[2]||'2',10), TOP=parseInt(process.argv[3]||'14',10);
const FILES=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/22a-menuart.js','js/23-deploy.js','js/23b-worldrestore.js','js/24-main.js'];
const RENDERER_STUB=`
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
THREE.WebGLRenderer=StubRenderer;
`;
function boot(campIdx){
for(const k in stub.byId) delete stub.byId[k];
const ctx=vm.createContext(Object.assign({},stub.sandbox));
ctx.document=stub.document; ctx.window=stub.window;
ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
vm.runInContext(fs.readFileSync(path.join(root,'dev/vendor/three.min.js'),'utf8'),ctx,{filename:'three.min.js'});
vm.runInContext('THREE = globalThis.THREE;',ctx,{filename:'bind-three'});
vm.runInContext(RENDERER_STUB,ctx,{filename:'stub-renderer'});
for(const f of FILES) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
return ctx;
}
const SCAN=`
function __scanRoot(root0){
const TNAME=new Map();
for(const k in TEX) if(TEX[k]&&typeof TEX[k]==='object') TNAME.set(TEX[k],'TEX.'+k);
const MNAME=new Map();
for(const k in MAT) MNAME.set(MAT[k],'MAT.'+k);
const matTag=m=>{
if(MNAME.has(m)) return MNAME.get(m);
const t=TNAME.get(m.map); const uv=(m.uvRef!==undefined?m.uvRef:null);
if(t) return t+(uv!==null?'(uvRef='+uv+')':'(未登记)');
return (m.map?'<匿名贴图>':'<无贴图>')+(uv!==null?'(uvRef='+uv+')':'(未登记)');
};
const per=new Map();            // 贴图/材质标签 -> 密度统计
const g=root0=>{
root0.traverse(o=>{
if(!o.isMesh) return;
const geo=o.geometry, m=o.material; if(!geo||!m) return;
if(!m.map) return;
const name=matTag(m);
let e=per.get(name); if(!e){ e={dens:[],out:[],noRef:0,n:0,boxes:0,others:0,uvRef:(m.uvRef!==undefined?m.uvRef:null)}; per.set(name,e); }
e.n++;
o.updateWorldMatrix(true,false);
const wp=o.getWorldPosition(new THREE.Vector3());
if(geo.type!=='BoxGeometry'){ e.others++; return; }
const p=geo.parameters||{}, uv=geo.attributes&&geo.attributes.uv;
if(!uv||p.width===undefined){ e.others++; return; }
e.boxes++;
const F=[[p.depth,p.height],[p.depth,p.height],[p.width,p.depth],[p.width,p.depth],[p.width,p.height],[p.width,p.height]];
for(let f=0;f<6;f++){
const i0=f*4;
const du=Math.abs(uv.getX(i0+1)-uv.getX(i0)), dv=Math.abs(uv.getY(i0+2)-uv.getY(i0));
const fw=F[f][0], fh=F[f][1];
if(!(du>0)||!(dv>0)) continue;
const densU=fw/du, densV=fh/dv;
const dens=(densU+densV)/2;
e.dens.push(dens);
if(m.uvRef===undefined){ e.noRef++; e.out.push({d:+dens.toFixed(2),x:+wp.x.toFixed(0),y:+wp.y.toFixed(1),z:+wp.z.toFixed(0),w:+fw.toFixed(2),h:+fh.toFixed(2)}); }
}
});
};
g(world);
for(const [name,e] of per){
if(!e.dens.length) continue;
e.dens.sort((a,b)=>a-b);
e.min=e.dens[0]; e.max=e.dens[e.dens.length-1]; e.med=e.dens[Math.floor(e.dens.length/2)];
}
return per;
}
`;
const ctx=boot(CAMP);
const Q=s=>vm.runInContext(s,ctx);
vm.runInContext(SCAN,ctx,{filename:'uvscan'});
const per=Q('__scanRoot(world)');
console.log(`战役 #${CAMP} (${Q('CAMPAIGN.title||CAMPAIGN.id')}) — 带贴图材质 ${per.size} 种`);
console.log('材质           uvRef   盒面数   密度中位  最小    最大   跨度   未登记uvRef的盒面');
const rows=[...per.entries()].filter(([,e])=>e.dens.length).sort((a,b)=>(b[1].max/Math.max(0.001,b[1].min))-(a[1].max/Math.max(0.001,a[1].min)));
for(const [name,e] of rows){
const span=e.max/Math.max(0.001,e.min);
if(e.noRef===0&&span<1.35) continue;      // 一致的略过
console.log(`${name.padEnd(14)} ${String(e.uvRef===null?'-':e.uvRef).padStart(5)} ${String(e.boxes).padStart(7)} ${e.med.toFixed(2).padStart(9)} ${e.min.toFixed(2).padStart(7)} ${e.max.toFixed(2).padStart(7)} ${span.toFixed(1).padStart(6)}×  ${e.noRef}`);
}
// 未登记 uvRef 的材质: 逐材质列最极端的几件
for(const [name,e] of rows){
if(!e.out.length) continue;
e.out.sort((a,b)=>b.d-a.d);
console.log(`\n── ${name} (未登记 uvRef, 密度=面尺寸; 共 ${e.noRef} 面) 最大 ${TOP} 件:`);
for(const o of e.out.slice(0,TOP)) console.log(`    ${o.d}m/贴  面 ${o.w}×${o.h}m  世界 (${o.x},${o.y},${o.z})`);
}
