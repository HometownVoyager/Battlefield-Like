// dev/_xfcheck.js —— 手工累乘的世界变换 vs three 的 matrixWorld (逐对象比对)
// 用法: node --stack-size=4000 dev/_xfcheck.js [campaignId]
//
// 为什么需要: 05-world.resolveCoplanarConflicts 的候选收集**不读 o.matrixWorld**, 自己沿子树累乘
//   (B = R_parent·S_parent + 原点 P; 理由: 建图期矩阵未被渲染器更新过, 且沙箱的 three 桩没有 matrixWorld)。
//   若这条累乘与 three 的口径有一丝偏差 (欧拉序 / 旋转与四元数不同步 / 缩放与旋转次序 / 负缩放),
//   消解器看到的面平面就是**错的** —— 表现为"三角形级扫描说是共面, 消解器看不见"。
// 本工具: 真 three 下同时算两套基, 报告最大偏差与最差的对象路径。
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const stub=require('./_bootstub.js');
const root=path.resolve(__dirname,'..');
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
const PAGE=`
(function(){
const rot3=r=>{ const a=Math.cos(r.x||0),b=Math.sin(r.x||0),c=Math.cos(r.y||0),d=Math.sin(r.y||0),e=Math.cos(r.z||0),f=Math.sin(r.z||0);
const ord=r.order||'XYZ';
if(ord==='XYZ') return [[c*e,-c*f,d],[a*f+b*e*d,a*e-b*f*d,-b*c],[b*f-a*e*d,b*e+a*f*d,a*c]];
const X=[[1,0,0],[0,a,-b],[0,b,a]], Y=[[c,0,d],[0,1,0],[-d,0,c]], Z=[[e,-f,0],[f,e,0],[0,0,1]];
const g=k=>k==='X'?X:(k==='Y'?Y:Z);
const o1=g(ord[0]), o2=g(ord[1]), o3=g(ord[2]);
const mul=(P,Q)=>{ const M=[[0,0,0],[0,0,0],[0,0,0]];
for(let i=0;i<3;i++)for(let j=0;j<3;j++) M[i][j]=P[i][0]*Q[0][j]+P[i][1]*Q[1][j]+P[i][2]*Q[2][j]; return M; };
return mul(mul(o1,o2),o3); };
const I3=[[1,0,0],[0,1,0],[0,0,1]];
scene.updateMatrixWorld(true);
const bad=[], seen=new Set(); let n=0, worst=0;
const orderBad={};
(function walk(o,B,P,path){
if(!o||seen.has(o)) return; seen.add(o);
const t=o.position||{x:0,y:0,z:0}, s=o.scale||{x:1,y:1,z:1}, r=o.rotation||{x:0,y:0,z:0};
const wx=B[0][0]*t.x+B[0][1]*t.y+B[0][2]*t.z+P[0];
const wy=B[1][0]*t.x+B[1][1]*t.y+B[1][2]*t.z+P[1];
const wz=B[2][0]*t.x+B[2][1]*t.y+B[2][2]*t.z+P[2];
const Rl=(!r.x&&!r.y&&!r.z)?I3:rot3(r);
const M=[[0,0,0],[0,0,0],[0,0,0]];
for(let i=0;i<3;i++)for(let j=0;j<3;j++) M[i][j]=(B[i][0]*Rl[0][j]+B[i][1]*Rl[1][j]+B[i][2]*Rl[2][j])*(j===0?s.x:(j===1?s.y:s.z));
if(o.isMesh&&o.geometry&&o.geometry.parameters&&o.geometry.parameters.depth!==undefined){
n++;
const e=o.matrixWorld.elements;
const tW=[e[12],e[13],e[14]];
const dP=Math.hypot(wx-tW[0],wy-tW[1],wz-tW[2]);
const MW=[[e[0],e[4],e[8]],[e[1],e[5],e[9]],[e[2],e[6],e[10]]];
let dM=0;
for(let i=0;i<3;i++)for(let j=0;j<3;j++) dM=Math.max(dM,Math.abs(M[i][j]-MW[i][j]));
const rotOrder=(o.rotation&&o.rotation.order)||'XYZ';
if(rotOrder!=='XYZ') orderBad[rotOrder]=(orderBad[rotOrder]||0)+1;
if(dP>0.001||dM>0.001){
if(dP>worst) worst=dP;
if(bad.length<14) bad.push({path:(path+'/'+(o.name||o.type)).slice(-90), dPos:+dP.toFixed(4), dM:+dM.toFixed(4), order:rotOrder,
quatVsEuler:(()=>{ const q=o.quaternion, e2=o.rotation; return [+q.x.toFixed(4),+q.y.toFixed(4),+q.z.toFixed(4),+q.w.toFixed(4)].join(','); })(),
pos:[+t.x.toFixed(2),+t.y.toFixed(2),+t.z.toFixed(2)], scale:[s.x,s.y,s.z]});
}
}
for(const c of o.children||[]) walk(c,M,[wx,wy,wz],(path+'/'+(o.name||o.type)).slice(-90));
})(scene,I3,[0,0,0],'');
return {campaign:CAMPAIGN.id, checked:n, worstPos:+worst.toFixed(4), bad, orderBad};
})()
`;
const want=process.argv.slice(2);
const list=vm.runInContext('CAMPAIGNS.map((c,i)=>[i,c.id])',boot(0));
for(const [idx,id] of list){
	if(want.length&&!want.includes(id)) continue;
	const ctx=boot(idx);
	let r;
	try{ r=vm.runInContext(PAGE,ctx,{filename:'xf'}); }catch(e){ console.log(id.padEnd(10)+' 异常: '+(e&&e.stack?e.stack.split('\n').slice(0,3).join(' | '):e)); continue; }
	console.log(`\n=== ${id}  比对 ${r.checked} 件盒/柱 · 最大位置偏差 ${r.worstPos}m · 旋转序异常 ${JSON.stringify(r.orderBad)} · 超差件 ${r.bad.length}`);
	for(const b of r.bad) console.log('   ↳ dPos '+b.dPos+' dM '+b.dM+' 序 '+b.order+' 局部pos '+JSON.stringify(b.pos)+' scale '+JSON.stringify(b.scale)+' quat '+b.quatVsEuler+'  '+b.path);
}
