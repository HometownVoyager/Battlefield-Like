// dev/_nadebbox.js —— 手雷模型尺寸自查 (2026-09-30 批一次性取证: 四弹种 × 六阵营的包围盒/三角数)
// 用法: node dev/_nadebbox.js        (改模型后先看这张表, 再跑 dev/render-model.js nade:<种> 出图)
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const stub=require('./_bootstub.js');
const FILES=[...fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/src="(js\/[^"?]+)/g)].map(m=>m[1]);
function boot(){
for(const k in stub.byId) delete stub.byId[k];
const ctx=vm.createContext(Object.assign({},stub.sandbox));
ctx.document=stub.document; ctx.window=stub.window;
ctx.localStorage={_s:{sf_campaign:'0'},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
vm.runInContext(fs.readFileSync(path.join(root,'dev/vendor/three.min.js'),'utf8'),ctx,{filename:'three.min.js'});
vm.runInContext('THREE = globalThis.THREE;',ctx,{filename:'bind-three'});
const RENDERER_STUB=`class StubRenderer{constructor(o){this.domElement=(o&&o.canvas)||document.createElement('canvas');this.shadowMap={enabled:false,type:0,autoUpdate:true};this.info={render:{calls:0,triangles:0},memory:{}};this.capabilities={isWebGL2:true,getMaxAnisotropy:()=>4,maxTextureSize:4096,maxTextures:16};this.xr={enabled:false,isPresenting:false,addEventListener(){},removeEventListener(){}};this.autoClear=true;}setSize(){}setPixelRatio(){}setViewport(){}setScissor(){}setScissorTest(){}render(){}clear(){}clearDepth(){}setClearColor(){}setClearAlpha(){}dispose(){}setAnimationLoop(){}compile(){return new Set();}getContext(){return null;}getRenderTarget(){return null;}setRenderTarget(){}readRenderTargetPixels(){}copyFramebufferToTexture(){}initTexture(){}resetState(){}getDrawingBufferSize(){return {x:1,y:1};}getSize(t){if(t)t.set(1280,720);return {width:1280,height:720};}getPixelRatio(){return 1;}}THREE.WebGLRenderer=StubRenderer;`;
vm.runInContext(RENDERER_STUB,ctx,{filename:'stub-renderer'});
for(const f of FILES) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
return ctx;
}
const ctx=boot();
const SRC=[
'(()=>{ const out=[];',
'for(const k of NADE_KINDS) for(let team=0;team<6;team++){',
'const g=buildNadeMesh(k,team); g.updateMatrixWorld(true);',
'let x0=1e9,y0=1e9,z0=1e9,x1=-1e9,y1=-1e9,z1=-1e9,n=0,tri=0;',
'g.traverse(o=>{ if(!o.isMesh) return; n++;',
'const p=o.geometry.attributes.position; tri+=o.geometry.index?o.geometry.index.count/3:p.count/3;',
'for(let i=0;i<p.count;i++){ const v=new THREE.Vector3(p.getX(i),p.getY(i),p.getZ(i)).applyMatrix4(o.matrixWorld);',
'x0=Math.min(x0,v.x);x1=Math.max(x1,v.x);y0=Math.min(y0,v.y);y1=Math.max(y1,v.y);z0=Math.min(z0,v.z);z1=Math.max(z1,v.z);} });',
'const fam=nadeFamilyOf(team);',
"out.push(k.padEnd(6)+' team'+team+'('+fam+')'+(fam.length<6?'   ':'')+' 网格'+n+' 三角'+tri+'  宽'+(x1-x0).toFixed(3)+' 高'+(y1-y0).toFixed(3)+' 厚'+(z1-z0).toFixed(3)+'  y['+y0.toFixed(3)+','+y1.toFixed(3)+']');",
'}',
'return out.join(String.fromCharCode(10)); })()'].join('\n');
console.log(vm.runInContext(SRC,ctx));
