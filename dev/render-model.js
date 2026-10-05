// ─────────────────────────────────────────────
// dev/render-model.js —— 离线软件光栅器: 把**真 three 建的载具模型**投影成 PNG (自查外观用, 不进 Index.html)
// 用法: node dev/render-model.js [us|ger|sov|jp|kmt|cpc] [变体 0/1] [side|front|rear|iso|top]
//       node dev/render-model.js ghost 0 side        # 观战幽灵坦克 (GhostTank)
// 为什么有这个 (2026-09-28 立): 重做坦克行走机构时, 数值判据 (包围盒/三角数/UV/材质分段) 全绿而**裙板整片
//   不可见** —— 根因是手写盒几何把 6 个面写成了"两个 −X 面"、+X 面 (侧视图正对那面) 根本没生成。
//   数值全对, 只有"看一张图"暴露。之后凡改「模型外观」都先跑它出一张图, 再跑探针。
// 口径: 与游戏同源 —— 沙箱载入 00-config..24-main 全链, 调 Tank.prototype.buildMesh / new GhostTank();
//   逐三角取真 position/normal/uv + material.color (纹理按结构近似: 履带 = TEX.track 的"每 8px 一条"),
//   正交投影 + z 缓冲 + Lambert 着色, 手写 PNG 编码 (zlib, 无外部依赖)。
// 输出: dev/_model-<fid><vi>-<view>.png (下划线前缀 = 分析产物, 可随时删)
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),zlib=require('zlib');
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
// ── 采集: 世界三角 (位置/法线/UV/材质色/是否履带贴图) ──
const COLLECT=`
function __collect(fid,vi){
const D=FACTIONS[fid].tanks[vi];
const T={ def:D, variant:vi, team:0, name:D.name, wheels:[], pos:V3() };
T.buildMesh=Tank.prototype.buildMesh; T.buildMesh.call(T);
T.grp.updateMatrixWorld(true);
const tex=T.trackTex; tex.updateMatrix(); const me=tex.matrix.elements;
const tris=[];
T.grp.traverse(o=>{
if(!o.isMesh) return;
const g=o.geometry, p=g.attributes.position, n=g.attributes.normal, uvA=g.attributes.uv;
const mats=Array.isArray(o.material)?o.material:[o.material];
const segOf=[]; for(const gr of (g.groups||[])) for(let i=gr.start;i<gr.start+gr.count;i++) segOf[g.index.getX(i)]=gr.materialIndex;
const V=new THREE.Vector3();
const idx=g.index?g.index.array:null; const cnt=idx?idx.length:p.count;
for(let t=0;t<cnt;t+=3){
const ids=idx?[idx[t],idx[t+1],idx[t+2]]:[t,t+1,t+2];
const mi=idx&&segOf[ids[0]]!==undefined?segOf[ids[0]]:0;
const m=mats[mi]||mats[0];
const col=(m&&m.color)?m.color.getHex():0x888888;
const isTrk=!!(m&&m.map===tex);
const P=[],N=[],U=[];
for(const i of ids){
V.set(p.getX(i),p.getY(i),p.getZ(i)).applyMatrix4(o.matrixWorld); P.push([V.x,V.y,V.z]);
V.set(n.getX(i),n.getY(i),n.getZ(i)).applyMatrix3(new THREE.Matrix3().getNormalMatrix(o.matrixWorld)).normalize(); N.push([V.x,V.y,V.z]);
const u=uvA?uvA.getX(i):0, v=uvA?uvA.getY(i):0;
U.push([me[0]*u+me[3]*v+me[6], me[1]*u+me[4]*v+me[7]]);
}
tris.push({P,N,U,col,isTrk,emi:(m&&m.emissive)?m.emissive.getHex():0,nm:o.name});
}
});
return tris;
}
`;

function __collectGhost(){
const g=new GhostTank();
g.grp.updateMatrixWorld(true);
const tris=[];
T_CLONE_LOOP: {
const V=new THREE.Vector3();
g.grp.traverse(o=>{
if(!o.isMesh) return;
const ge=o.geometry, p=ge.attributes.position, n=ge.attributes.normal, uvA=ge.attributes.uv;
const mats=Array.isArray(o.material)?o.material:[o.material];
const segOf=[]; for(const gr of (ge.groups||[])) for(let i=gr.start;i<gr.start+gr.count;i++) segOf[ge.index.getX(i)]=gr.materialIndex;
const idx=ge.index?ge.index.array:null; const cnt=idx?idx.length:p.count;
for(let t=0;t<cnt;t+=3){
const ids=idx?[idx[t],idx[t+1],idx[t+2]]:[t,t+1,t+2];
const mi=idx&&segOf[ids[0]]!==undefined?segOf[ids[0]]:0;
const m=mats[mi]||mats[0];
const col=(m&&m.color)?m.color.getHex():0x888888;
const P=[],N=[],U=[];
for(const i of ids){
V.set(p.getX(i),p.getY(i),p.getZ(i)).applyMatrix4(o.matrixWorld); P.push([V.x,V.y,V.z]);
V.set(n.getX(i),n.getY(i),n.getZ(i)).applyMatrix3(new THREE.Matrix3().getNormalMatrix(o.matrixWorld)).normalize(); N.push([V.x,V.y,V.z]);
U.push([uvA?uvA.getX(i):0, uvA?uvA.getY(i):0]);
}
tris.push({P,N,U,col,isTrk:false,emi:(m&&m.emissive)?m.emissive.getHex():0,nm:o.name});
}
});
}
return tris;
}
// 战役号可用 CAMP=<idx> 覆盖 (手雷阵营剪影要看苏联/日本档: 各战役的 f 对不一样, 见 00-config CAMPAIGNS)
const ctx=boot(parseInt(process.env.CAMP||'2',10));
const Q=s=>vm.runInContext(s,ctx);
Q(COLLECT);
Q('var __ONLYHAND='+(process.env.ONLYHAND?'true':'false')+'; var __AVDIAG='+(process.env.DIAG?'true':'false')+';');
vm.runInContext(__collectGhost.toString(),ctx,{filename:'collect-ghost'});
// ── 大舰四件 (2026-09-30 阶段五 P4): 与坦克同一条采集/光栅链 ──
// 用法: node dev/render-capital.js cap:bb_us side|front|iso|top
// 口径: 直接调 15g 的 capBuildModel (与游戏同源), grp 处于**世界原点 + yaw=0** ⇒ 出图即"舰艏朝 +z"的侧视基准。
vm.runInContext(`
function __collectCap(key){
const S=CAPITAL_SPEC[key];
if(!S) return 'no-spec:'+key;
const R=capBuildModel(S);
R.grp.updateMatrixWorld(true);
const tris=[]; const V=new THREE.Vector3();
R.grp.traverse(o=>{
if(!o.isMesh) return;
const ge=o.geometry, p=ge.attributes.position, n=ge.attributes.normal, uvA=ge.attributes.uv;
const mats=Array.isArray(o.material)?o.material:[o.material];
const segOf=[]; for(const gr of (ge.groups||[])) for(let i=gr.start;i<gr.start+gr.count;i++) segOf[ge.index?ge.index.getX(i):i]=gr.materialIndex;
const idx=ge.index?ge.index.array:null; const cnt=idx?idx.length:p.count;
for(let t=0;t<cnt;t+=3){
const ids=idx?[idx[t],idx[t+1],idx[t+2]]:[t,t+1,t+2];
const mi=idx&&segOf[ids[0]]!==undefined?segOf[ids[0]]:0;
const m=mats[mi]||mats[0];
const col=(m&&m.color&&m.color.getHex)?m.color.getHex():0x888888;
const P=[],N=[],U=[];
for(const i of ids){
V.set(p.getX(i),p.getY(i),p.getZ(i)).applyMatrix4(o.matrixWorld); P.push([V.x,V.y,V.z]);
V.set(n.getX(i),n.getY(i),n.getZ(i)).applyMatrix3(new THREE.Matrix3().getNormalMatrix(o.matrixWorld)).normalize(); N.push([V.x,V.y,V.z]);
U.push([uvA?uvA.getX(i):0, uvA?uvA.getY(i):0]);
}
tris.push({P,N,U,col,isTrk:false,emi:0,nm:o.name});
}
});
console.log('[cap] '+key+' 三角='+tris.length+' 件数='+(()=>{let n=0;R.grp.traverse(o=>{if(o.isMesh)n++;});return n;})()
+' deck.y='+R.deck.y.toFixed(2)+' boxes='+R.boxes.length+' turrets='+R.turrets.length
+' sec='+R.secMounts.length+' aa='+R.aaMounts.length+' cats='+R.cats.length+' arrest='+(R.arrest?'yes':'no'));
return tris;
}
`,ctx,{filename:'collect-cap'});
// ── 手雷四件 (2026-09-30 批): 与坦克同一条采集/光栅链 —— "手上件/出手件到底长什么样"先出图再跑探针 ──
// 用法: node dev/render-model.js nade:frag 0 side   (第二参 = 阵营序号: 0 美 1 德 2 苏 …)
vm.runInContext(`
function __collectNade(kind,team){
const g=buildNadeMesh(kind,team);
g.updateMatrixWorld(true);
const tris=[]; const V=new THREE.Vector3();
g.traverse(o=>{
if(!o.isMesh) return;
const ge=o.geometry, p=ge.attributes.position, n=ge.attributes.normal, uvA=ge.attributes.uv;
const mats=Array.isArray(o.material)?o.material:[o.material];
const segOf=[]; for(const gr of (ge.groups||[])) for(let i=gr.start;i<gr.start+gr.count;i++) segOf[ge.index.getX(i)]=gr.materialIndex;
const idx=ge.index?ge.index.array:null; const cnt=idx?idx.length:p.count;
for(let t=0;t<cnt;t+=3){
const ids=idx?[idx[t],idx[t+1],idx[t+2]]:[t,t+1,t+2];
const mi=idx&&segOf[ids[0]]!==undefined?segOf[ids[0]]:0;
const m=mats[mi]||mats[0];
const col=(m&&m.color)?m.color.getHex():0x888888;
const P=[],N=[],U=[];
for(const i of ids){
V.set(p.getX(i),p.getY(i),p.getZ(i)).applyMatrix4(o.matrixWorld); P.push([V.x,V.y,V.z]);
V.set(n.getX(i),n.getY(i),n.getZ(i)).applyMatrix3(new THREE.Matrix3().getNormalMatrix(o.matrixWorld)).normalize(); N.push([V.x,V.y,V.z]);
U.push([uvA?uvA.getX(i):0, uvA?uvA.getY(i):0]);
}
tris.push({P,N,U,col,isTrk:false,emi:0,nm:o.name});
}
});
return tris;
}`,ctx,{filename:'collect-nade'});
// ── 玩家本体 + 举雷待发姿态 (2026-09-30 批2): "三人称举雷时手上到底握着什么"先出图再跑探针 ──
// 用法: node dev/render-model.js av 0 front|iso    (第二参 = 阵营序号; NADEKIND=frag|smoke|incin|at)
// 与真机同源: buildSoldierMesh (11-soldiers) + updatePlayerAvatar (20-player) 推 90 帧阻尼姿态,
//   手上雷模 = avNadeSync 挂的那一份 (buildNadeMesh 单源)。VM.state='nade' + nadeHeld=true = 举雷待发态。
vm.runInContext(`
function __collectAv(team,kind){
player.team=team;
player.alive=true; player.deployed=true; player.hp=100;   // 沙箱默认未部署 ⇒ 不置这两条会走 playerAvatarDeath 的倒地姿态
player.nadeHeld=true; player.nadeIsAT=(kind==='at'); player.nadeIsSmoke=(kind==='smoke'); player.nadeIsIncin=(kind==='incin');
if(typeof VM!=='undefined'&&VM){ VM.state='nade'; VM.stateT=0; VM.stateDur=999; }
if(typeof playerAvatarEnsure!=='function'||typeof updatePlayerAvatar!=='function') return [];
const av=playerAvatarEnsure();
if(!av||!av.root) return [];
for(let i=0;i<90;i++) updatePlayerAvatar(1/60);   // 90 帧阻尼: 姿态机/手模都要收敛
av.root.updateMatrixWorld(true);
if(typeof __AVDIAG!=='undefined'&&__AVDIAG){
const m=(typeof _avNadeSet!=='undefined'&&_avNadeSet&&_avNadeSet.ms)?_avNadeSet.ms[Object.keys(_avNadeSet.ms)[0]]:null;
const hv=new THREE.Vector3(), hv2=new THREE.Vector3();
if(av.armR&&av.armR.hand){ av.armR.hand.getWorldPosition(hv); }
if(av.armR&&av.armR.hand&&m){ m.getWorldPosition(hv2); }
console.log('[avdiag] hand='+JSON.stringify(hv.toArray().map(x=>+x.toFixed(3)))
+' nade='+JSON.stringify(hv2.toArray().map(x=>+x.toFixed(3)))
+' nadeVisible='+(m?m.visible:'none')+' nadeParentVisible='+(m&&m.parent?m.parent.visible:'-')
+' rootRot='+JSON.stringify(av.root.rotation.toArray().slice(0,3).map(x=>+x.toFixed(3)))
+' shR='+(+av.armR.sh.rotation.x.toFixed(3))+' elR='+(+av.armR.elm.rotation.x.toFixed(3))
+' shL='+(+av.armL.sh.rotation.x.toFixed(3))+' elL='+(+av.armL.elm.rotation.x.toFixed(3))
+' gunVisible='+(av._gun?av._gun.visible:'no-gun')+' pelvisY='+(+av.pelvis.position.y.toFixed(3)));
}
const tris=[]; const V=new THREE.Vector3();
// ONLYHAND=1: 只收右手拳头 + 手上雷模 (拳内就是那颗雷, 看朝向/大小够用; 免去整身遮挡)
const _root=__ONLYHAND?av.armR.hand:av.root;
_root.traverse(o=>{
if(!o.isMesh) return;
let p=o; while(p&&p!==_root){ if(p.visible===false) return; p=p.parent; }
if(o.visible===false) return;
const ge=o.geometry, pos=ge.attributes.position, nrmA=ge.attributes.normal, uvA=ge.attributes.uv;
const mats=Array.isArray(o.material)?o.material:[o.material];
const segOf=[]; for(const gr of (ge.groups||[])) for(let i=gr.start;i<gr.start+gr.count;i++) segOf[ge.index.getX(i)]=gr.materialIndex;
const idx=ge.index?ge.index.array:null; const cnt=idx?idx.length:pos.count;
for(let t=0;t<cnt;t+=3){
const ids=idx?[idx[t],idx[t+1],idx[t+2]]:[t,t+1,t+2];
const mi=idx&&segOf[ids[0]]!==undefined?segOf[ids[0]]:0;
const m=mats[mi]||mats[0];
const col=(m&&m.color)?m.color.getHex():0x888888;
const P=[],N=[],U=[];
for(const i of ids){
V.set(pos.getX(i),pos.getY(i),pos.getZ(i)).applyMatrix4(o.matrixWorld); P.push([V.x,V.y,V.z]);
V.set(nrmA.getX(i),nrmA.getY(i),nrmA.getZ(i)).applyMatrix3(new THREE.Matrix3().getNormalMatrix(o.matrixWorld)).normalize(); N.push([V.x,V.y,V.z]);
U.push([uvA?uvA.getX(i):0, uvA?uvA.getY(i):0]);
}
tris.push({P,N,U,col,isTrk:false,emi:0,nm:o.name});
}
});
return tris;
}`,ctx,{filename:'collect-av'});
const [fid,vi,view]=process.argv.slice(2);
const F=fid||'us', V=parseInt(vi||'0',10), VIEW=view||'side';
const tris=(F&&F.startsWith('cap:'))?Q(`__collectCap('${F.slice(4)}')`):(F==='av')?Q(`__collectAv(${V},'${process.env.NADEKIND||'frag'}')`):(F.startsWith('nade:')?Q(`__collectNade('${F.slice(5)}',${V})`):((F==='ghost')?Q('__collectGhost()'):Q(`__collect('${F}',${V})`)));
// CROP=x,y,z,r (世界坐标, 可选): 只渲染该球内的三角 —— 看"手里那颗雷"这种局部件时不用整身出图
let TRIS=tris;
if(process.env.CROP){
const [cx,cy,cz,cr]=process.env.CROP.split(',').map(Number);
TRIS=tris.filter(t=>t.P.every(q=>Math.hypot(q[0]-cx,q[1]-cy,q[2]-cz)<cr));
}
if(process.env.CROP){let b=[1e9,1e9,1e9,-1e9,-1e9,-1e9];for(const t of TRIS)for(const q of t.P)for(let i=0;i<3;i++){b[i]=Math.min(b[i],q[i]);b[3+i]=Math.max(b[3+i],q[i]);}console.log('[crop] kept bbox '+b.map(x=>x.toFixed(2)).join(' '));}
// ── 合成履带贴图的样子 (真 canvas 在沙箱里没有像素; 按 02-scene 的 TEX.track 结构: 64px 贴, 沿 V 每 8px 一条) ──
function trackTex(u,v){ const f=(v%1+1)%1; const k=(u%1+1)%1; const bar=(f*8)%1<0.55; return bar?(0.30+0.10*k):(0.14+0.05*k); }
// ── 视图基 ──
const VIEWS={
side:{fwd:[0,0,1],up:[0,1,0],eye:[1,0,0]},          // 从 +X 看: 屏右 = +z (车头朝右)
front:{fwd:[1,0,0],up:[0,1,0],eye:[0,0,1]},         // 从 +Z 看车头
rear:{fwd:[-1,0,0],up:[0,1,0],eye:[0,0,-1]},
iso:{fwd:null,up:[0,1,0],eye:[0.72,0.36,0.62]},     // 3/4 视
top:{fwd:[0,0,1],up:[0,0,-1],eye:[0,1,0]},
};
const VW=VIEWS[VIEW]||VIEWS.side;
const len=(a)=>Math.hypot(a[0],a[1],a[2]);
const nrm=(a)=>{const d=len(a)||1;return [a[0]/d,a[1]/d,a[2]/d];};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
let E=nrm(VW.eye);
let R=cross(nrm(VW.up),E); R=nrm(R);                  // 屏右
let U2=cross(E,R); U2=nrm(U2);                        // 屏上
// ── 投影 ──
const pts=TRIS.flatMap(t=>t.P);
let mnz=1e9,mxz=-1e9,mny=1e9,mxy=-1e9;
const proj=p=>[dot(p,R),dot(p,U2)];
for(const p of pts){ const [a,b]=proj(p); mnz=Math.min(mnz,a); mxz=Math.max(mxz,a); mny=Math.min(mny,b); mxy=Math.max(mxy,b); }
const W=1100, PAD=24;
const scale=(W-2*PAD)/Math.max(mxz-mnz,1e-6);
const H=Math.round((mxy-mny)*scale+2*PAD);
const px=new Float32Array(W*H).fill(-1e9);
const img=new Uint8Array(W*H*3);
for(let i=0;i<W*H;i++){ img[i*3]=24; img[i*3+1]=26; img[i*3+2]=30; }
const L=nrm([E[0]*0.55+R[0]*0.55+U2[0]*0.75,E[1]*0.55+R[1]*0.55+U2[1]*0.75,E[2]*0.55+R[2]*0.55+U2[2]*0.75]);
const shade=(t,uv)=>{
const nv=nrm([0,1,2].map(i=>t.N[0][i]+t.N[1][i]+t.N[2][i]));
let col=t.col, emi=t.emi||0;
let r=(col>>16&255)/255, g=(col>>8&255)/255, b=(col&255)/255;
if(t.isTrk){ const c=trackTex(0.5*0+uv[0],uv[1]); r=g=b=c; }
const dif=Math.max(0,dot(nv,L))*0.62+0.52;
r=Math.min(1,r*dif+emi); g=Math.min(1,g*dif+emi); b=Math.min(1,b*dif+emi);
return [r*255|0,g*255|0,b*255|0];
};
for(const t of tris){
const s=t.P.map(p=>{ const [a,b]=proj(p); return [(a-mnz)*scale+PAD, H-PAD-(b-mny)*scale]; });
const d=t.P.map(p=>dot(p,E));
const area=(s[1][0]-s[0][0])*(s[2][1]-s[0][1])-(s[2][0]-s[0][0])*(s[1][1]-s[0][1]);
if(Math.abs(area)<1e-9) continue;
const minx=Math.max(0,Math.floor(Math.min(s[0][0],s[1][0],s[2][0]))), maxx=Math.min(W-1,Math.ceil(Math.max(s[0][0],s[1][0],s[2][0])));
const miny=Math.max(0,Math.floor(Math.min(s[0][1],s[1][1],s[2][1]))), maxy=Math.min(H-1,Math.ceil(Math.max(s[0][1],s[1][1],s[2][1])));
for(let y=miny;y<=maxy;y++) for(let x=minx;x<=maxx;x++){
const w0=((s[1][0]-x)*(s[2][1]-y)-(s[2][0]-x)*(s[1][1]-y))/area;
const w1=((s[2][0]-x)*(s[0][1]-y)-(s[0][0]-x)*(s[2][1]-y))/area;
const w2=1-w0-w1;
if(w0<0||w1<0||w2<0) continue;
const z=w0*d[0]+w1*d[1]+w2*d[2];
const o=y*W+x;
if(z<=px[o]) continue;
px[o]=z;
const uv=[w0*t.U[0][0]+w1*t.U[1][0]+w2*t.U[2][0], w0*t.U[0][1]+w1*t.U[1][1]+w2*t.U[2][1]];
const c=shade(t,uv);
img[o*3]=c[0]; img[o*3+1]=c[1]; img[o*3+2]=c[2];
}
}
// ── PNG 输出 ──
function crc32(buf){ let c,table=[]; for(let n=0;n<256;n++){ c=n; for(let k=0;k<8;k++) c=c&1?0xEDB88320^(c>>>1):c>>>1; table[n]=c>>>0; }
let crc=0xFFFFFFFF; for(const b of buf) crc=table[(crc^b)&255]^(crc>>>8); return (crc^0xFFFFFFFF)>>>0; }
function chunk(type,data){ const len=Buffer.alloc(4); len.writeUInt32BE(data.length); const t=Buffer.from(type,'ascii');
const body=Buffer.concat([t,data]); const crc=Buffer.alloc(4); crc.writeUInt32BE(crc32(body)); return Buffer.concat([len,body,crc]); }
const ihdr=Buffer.alloc(13); ihdr.writeUInt32BE(W,0); ihdr.writeUInt32BE(H,4); ihdr[8]=8; ihdr[9]=2;
const raw=Buffer.alloc((W*3+1)*H);
for(let y=0;y<H;y++){ raw[y*(W*3+1)]=0; Buffer.from(img.buffer,y*W*3,W*3).copy(raw,y*(W*3+1)+1); }
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
const out=path.join(root,'dev',`_model-${F.replace(/[:]/g,'-')}${V}-${VIEW}.png`);
fs.writeFileSync(out,png);
console.log('写出 '+out+`  ${W}x${H}  三角 ${tris.length} 取 ${TRIS.length}`);
