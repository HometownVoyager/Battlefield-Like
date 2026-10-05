// ─────────────────────────────────────────────
// dev/_d3recon.js —— D3 度量对账: 逐面(i0) vs 逐三角(最长边) 两种密度量法逐盒对比
// 用法: node --stack-size=4000 dev/_d3probe-recon.js [战役idx=0] [贴图名=stone] [样本数=12]
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const stub=require('./_bootstub.js');
const root=path.resolve(__dirname,'..');
const CAMP=parseInt(process.argv[2]||'0',10), TN=process.argv[3]||'stone', NS=parseInt(process.argv[4]||'12',10);
const FILES=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/15g-capmodels.js','js/15h-capital.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/22a-menuart.js','js/23-deploy.js','js/23b-worldrestore.js','js/24-main.js'];
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
const ctx=boot(CAMP);
const Q=s=>vm.runInContext(s,ctx);
Q(`
__recon=(tn)=>{
const TNAME=new Map();
for(const k in TEX) if(TEX[k]&&typeof TEX[k]==='object') TNAME.set(TEX[k],k);
const out=[];
world.traverse(o=>{
if(!o.isMesh||o.isInstancedMesh) return;
const g=o.geometry,m=o.material;
if(!g||(g.type!=='BoxGeometry'&&g.type!=='CylinderGeometry'&&g.type!=='ConeGeometry')) return;
if(g.type!=='BoxGeometry'&&TN.startsWith('cyl:')){ /* 圆柱模式: TN=cyl:<贴图名> */ }
else if(g.type!=='BoxGeometry') return;
const mats=Array.isArray(m)?m:[m];
let mmOK=null;
for(const mm of mats){
if(!mm||!mm.map||TNAME.get(mm.map)!==tn){ mmOK=null; break; }
mmOK=mm;
}
if(!mmOK) return;
const mm=mmOK;
const p=g.parameters,uv=g.attributes.uv;
if(!uv||!p||p.width===undefined) return;
o.updateWorldMatrix(true,false);
const wp=o.getWorldPosition(new THREE.Vector3());
const F=[[p.depth,p.height],[p.depth,p.height],[p.width,p.depth],[p.width,p.depth],[p.width,p.height],[p.width,p.height]];
const faces=[];
for(let f=0;f<6;f++){
const i0=f*4;
const du=Math.abs(uv.getX(i0+1)-uv.getX(i0)), dv=Math.abs(uv.getY(i0+2)-uv.getY(i0));
faces.push({f,dw:+F[f][0].toFixed(2),dh:+F[f][1].toFixed(2),du:+du.toFixed(3),dv:+dv.toFixed(3),
dU:+(du>0?F[f][0]/du:0).toFixed(2),dV:+(dv>0?F[f][1]/dv:0).toFixed(2)});
}
out.push({pos:[+wp.x.toFixed(1),+wp.y.toFixed(1),+wp.z.toFixed(1)],w:p.width,h:p.height,d:p.depth,
uvRef:mm.uvRef!==undefined?mm.uvRef:null,rep:mm.map.repeat?mm.map.repeat.x+'x'+mm.map.repeat.y:'-',faces,
uvAttr:!!g.attributes.uv,verts:g.attributes.position.count});
});
return out;
};`);
const list=Q(`__recon(${JSON.stringify(TN)})`);
console.log(`${TN} 盒子数: ${list.length}`);
for(const o of list.slice(0,NS)){
console.log(`\n@(${o.pos})  ${o.w}×${o.h}×${o.d}  uvRef=${o.uvRef} rep=${o.rep} verts=${o.verts}`);
for(const f of o.faces) console.log(`   面${f.f} ${f.dw}×${f.dh}m  uv跨度 ${f.du}×${f.dv}  密度 U${f.dU}/V${f.dV} m/贴`);
}
