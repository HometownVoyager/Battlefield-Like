// ─────────────────────────────────────────────
// dev/_vmreload-view.js —— 第一人称换弹姿态出图 (分析产物, 不进 Index.html)
// 用法: node dev/_vmreload-view.js <武器key> <相位k 0~1> [front|right|left|iso] [回合数]
//       PHASES=0.2,0.4,0.6 node dev/_vmreload-view.js kar98 - front   # 一口气多相位
// 动机 (2026-10-05): 用户报"换弹从上方塞弹夹/狙击枪右侧塞且穿模"。改 10-viewmodel reload 分支前先出图取证,
//   改后逐相位复查穿模 —— 与 render-model.js 同一条沙箱+光栅链, 只是采集对象换成 VM.inner。
// 口径: vmEquip 后强置 VM.state='reload'、stateT=k*stateDur, 同一 stateT 重复步 updateViewModel 收敛阻尼
//   (adsBlend/sway 等对固定相位收敛到同一不动点); 视图 front = 玩家视角 (从 +z 看 -z, 枪指 -z)。
// 输出: dev/_vmr-<key>-<k>-<view>.png
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),zlib=require('zlib');
const stub=require('./_bootstub.js');
const root=path.resolve(__dirname,'..');
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
const ctx=boot(parseInt(process.env.CAMP||'2',10));
if(process.env.VMPORT) vm.runInContext('vmPortDbg=1;',ctx);
const Q=s=>vm.runInContext(s,ctx);
Q(`
function __poseVM(key,k,frames){
frames=frames||36;
const d=WPN_DEFS[key];
player.curW={key:key,def:d,mag:d.mag,reserve:d.reserve};
player.ads=false; player.sprinting=false; player.crouch=false; player.prone=false;
player.onGround=true; player.braced=false; player.leanT=0; player.landDip=0;
player.vel={x:0,y:0,z:0}; player.mouseDX=0; player.mouseDY=0; player.holdBreath=false;
player.nadeHeld=false; player.bandaging=0; player.pendingBuild=null;
player.hp=50; player.bandages=player.maxBandages||4; player.nadeHeld=false;
vmEquip(key,0);
const defR=VM.arms.R.position.clone(), defL=VM.arms.L.position.clone(); // positionHands 默认握位 (vmEquip 末尾)
// ★2026-10-12 左臂取证扩展: STATE=<reload|grab|bandage|build|nade|bolt|melee> 逐一出图 ——
//   与真机同源: 只置"该动作需要的玩家字段", 其余交给 updateViewModel 自己的分支。
const ST='${process.env.STATE||'reload'}';
if(ST==='reload'){ VM.stateDur=(d.reload||2.5); }
else if(ST==='grab'){ VM.stateDur=0.85; player.grabAction={kind:'ammo',crate:{x:0,z:0}}; }
else if(ST==='bandage'){ VM.stateDur=2.6; player.bandaging=VM.stateDur*(1-k); }
else if(ST==='build'){ VM.stateDur=BUILD_TIME.sandbag||2.2; player.pendingBuild={type:'sandbag',cost:1,tx:1,tz:1,ry:0}; }
else if(ST==='nade'){ VM.stateDur=999; player.nadeHeld=true; }
else if(ST==='bolt'){ VM.stateDur=1.0; }
else if(ST==='melee'){ VM.stateDur=0.5; }
VM.state=ST; VM.stateT=k*VM.stateDur;
if(ST==='bandage') player.bandaging=VM.stateDur*(1-k);   // 每帧重置 (下面循环里也重置, 免得被分支改掉)
for(let i=0;i<frames;i++){ VM.stateT=k*VM.stateDur; if(ST==='bandage') player.bandaging=VM.stateDur*(1-k); updateViewModel(1/60,player); }
// LEGACY=1 (2026-10-12 阴性对照): 把左臂覆盖位姿**复原成 2026-10-05 那版字面量**, 与修后同相位出图对照 ——
//   旧字面量 = 腕位 + rotY 0 (包扎为 +1.2), 正是"左臂像长在右肩上"的取证来源。
if(${process.env.LEGACY?1:0}){
const key2=(ST==='reload'&&d.rocket)?'rocketreload':ST;
const LG={grab:{p:[-0.04,-0.08,-0.22],r:[0.4,0,0]},rocketreload:{p:[-0.04,-0.09,-0.24],r:[0.42,0,0]},
bandage:{p:[-0.125,-0.038,-0.05],r:[0.12,1.2,0.08]}}[key2];
if(LG){ VM.arms.L.position.set(LG.p[0],LG.p[1],LG.p[2]); VM.arms.L.rotation.set(LG.r[0],LG.r[1],LG.r[2]); console.log('[legacy] 复原旧左臂字面量 '+key2); }
}
VM.inner.updateMatrixWorld(true);
VM.root.updateMatrixWorld(true); // fps 透视视图需要 root 的腰际位 (px,py,pz) 烘进 matrixWorld
// VMTAG=1 调试上色 (2026-10-05): 材质是共享的 (sleeve0/skin 两臂同料), 逐网格 clone 后染色 ——
// 右手红 / 左手绿 / 弹夹亮黄 / 弹匣橙 / 枪身不动, 用来一眼读出"手到底在不在夹上"。
if(${process.env.VMTAG?1:0}){
const tag=(root,c)=>{ if(!root) return; root.traverse(o=>{ if(o.isMesh){ o.material=o.material.clone(); o.material.color.setHex(c); } }); };
tag(VM.arms.R,0xff2222); tag(VM.arms.L,0x22ff22);
tag(VM.gunParts.clip,0xffff00); tag(VM.gunParts.mag,0xff8800);
}
const tris=[]; const V=new THREE.Vector3();
const walk=o=>{ if(!o||o===VM.inner&&!true) return; };
VM.inner.traverse(o=>{
if(!o.isMesh) return;
let p=o; while(p&&p!==VM.inner){ if(p.visible===false) return; p=p.parent; }
if(o.visible===false) return;
const ge=o.geometry, pos=ge.attributes.position, nrmA=ge.attributes.normal;
const mats=Array.isArray(o.material)?o.material:[o.material];
const col=(mats[0]&&mats[0].color)?mats[0].color.getHex():0x888888;
const idx=ge.index?ge.index.array:null; const cnt=idx?idx.length:pos.count;
const P=[],N=[];
for(let t=0;t<cnt;t++){
const i=idx?idx[t]:t;
V.set(pos.getX(i),pos.getY(i),pos.getZ(i)).applyMatrix4(o.matrixWorld); P.push([V.x,V.y,V.z]);
V.set(nrmA.getX(i),nrmA.getY(i),nrmA.getZ(i)).applyMatrix3(new THREE.Matrix3().getNormalMatrix(o.matrixWorld)).normalize(); N.push([V.x,V.y,V.z]);
}
for(let t=0;t<P.length;t+=3) tris.push({P:[P[t],P[t+1],P[t+2]],N:[N[t],N[t+1],N[t+2]],col:col,emi:0});
});
const f=(v)=>v?('('+[v.x,v.y,v.z].map(x=>+x.toFixed(3)).join(',')+')'):'-';
// ★2026-10-12 左臂取证 (用户实报"左臂像长在右肩上"): 逐帧打印"袖口端 (臂组 local +z 0.25 = 肩端)"与
//   掌心 (local -0.09) 在**相机空间** (= vmScene 世界坐标, 相机在原点朝 -z) 的落点 —— 出图是给人看的,
//   这两行是给探针断言的: 合法左臂 = 肩端 x 明显**小于**掌心 x, 且肩端在画面左半 (x<0)。
const armEnd=(a,z)=>{ const v=new THREE.Vector3(0,0,z); a.localToWorld(v); return v; };
console.log('[armL] sleeve='+f(armEnd(VM.arms.L,0.25))+' palm='+f(armEnd(VM.arms.L,-0.09))+' rotY='+(+VM.arms.L.rotation.y.toFixed(3))
+' | [armR] sleeve='+f(armEnd(VM.arms.R,0.25))+' palm='+f(armEnd(VM.arms.R,-0.09))+' rotY='+(+VM.arms.R.rotation.y.toFixed(3))
+' | state='+VM.state+' k='+k+' bandaging='+(+player.bandaging.toFixed(2))+' bandageVis='+(VM.bandageM?Number(VM.bandageM.visible):'-')
+' wrapVis='+((VM.arms.L.userData&&VM.arms.L.userData.wrap)?Number(VM.arms.L.userData.wrap.visible):'-')
+' gunVis='+Number(VM.gunParts.gun.visible));
console.log('[pose] clip='+(VM.gunParts.clip?('v'+Number(VM.gunParts.clip.visible)+' p'+f(VM.gunParts.clip.position)+' r'+f(VM.gunParts.clip.rotation)):'none')
+' mag='+(VM.gunParts.mag?('v'+Number(VM.gunParts.mag.visible)+' p'+f(VM.gunParts.mag.position)):'none')
+' handR='+f(VM.arms.R.position)+' handL='+f(VM.arms.L.position)
+' roll(z)='+(+VM.root.rotation.z.toFixed(3))
+' root='+f(VM.root.position)+' rootR='+f(VM.root.rotation)
+' clipW='+(VM.gunParts.clip?f(VM.gunParts.clip.getWorldPosition(new THREE.Vector3())):'-'));
// ── 数值穿模自检: 弹夹/弹匣/手部皮肤盒 的**表面采样点** (内层空间) 变换到枪身每个零件局部, 测落入包围盒。
//    采样点 = 几何顶点 (盒件即 8 角; 圆柱按真实表面取顶点 —— 旧版取外接盒 8 角, 圆柱件会报幻角:
//    DP-28 弹盘静止时就比机匣高 2.4cm, 却因外接盒角点"沉"进机匣而误报 2.1cm)。
//    豁免 (设计内融合): 桥夹/漏夹压入态、弹匣入榫态、默认握持手 (贴握把)。
function cornersOf(o){
const g=o.geometry; const pos=g.attributes.position;
o.updateMatrixWorld(true);
if(pos&&pos.count){                                  // 表面顶点 (盒件 24 个顶点 = 8 个位置; 圆柱 = 真实柱面)
const step=Math.max(1,Math.ceil(pos.count/64));
const out=[]; const v=new THREE.Vector3();
for(let i=0;i<pos.count;i+=step) out.push(v.set(pos.getX(i),pos.getY(i),pos.getZ(i)).applyMatrix4(o.matrixWorld).clone());
return out;
}
g.computeBoundingBox(); const bb=g.boundingBox;
const cs=[]; for(let i=0;i<8;i++) cs.push(new THREE.Vector3(i&1?bb.max.x:bb.min.x, i&2?bb.max.y:bb.min.y, i&4?bb.max.z:bb.min.z));
return cs.map(c=>c.applyMatrix4(o.matrixWorld));   // → VM.inner 空间
}
function penetDepth(corners, mesh){
mesh.geometry.computeBoundingBox(); const bb=mesh.geometry.boundingBox;
const inv=new THREE.Matrix4().copy(mesh.matrixWorld).invert();
let worst=0;
for(const c of corners){ const p=c.clone().applyMatrix4(inv);
const dx=Math.max(bb.min.x-p.x, p.x-bb.max.x, 0), dy=Math.max(bb.min.y-p.y, p.y-bb.max.y, 0), dz=Math.max(bb.min.z-p.z, p.z-bb.max.z, 0);
const outside=Math.max(dx,dy,dz); if(outside===0){ const depth=Math.min(p.x-bb.min.x, bb.max.x-p.x, p.y-bb.min.y, bb.max.y-p.y, p.z-bb.min.z, bb.max.z-p.z); if(depth>worst) worst=depth; } }
return worst;
}
if(k>0.2&&k<0.95&&!d.vmLegacy){ // vmLegacy=用户裁定原样回调的旧版动画, 其既有接触(左手辅位贴机匣~1.8cm/入榫末段)不设门槛
const G=VM.gunParts.gun, probes=[];
// 压入窗 (五裁定): 桥夹落位 = 底面沉受弹口面下 5mm (设计内融合), 压到底再沉 8mm; 漏夹另有一截
//   "枪栓复进把夹推到位" (0.66-0.80) 整夹没入机匣盖 —— 都算设计内, 窗外 (携取/对正/提出) 照查。
const seatByDesign=(d.enbloc&&k>=0.54&&k<=0.80)||(d.type==='bolt'&&k>=0.54&&k<=0.70);
if(VM.gunParts.clip&&VM.gunParts.clip.visible&&!seatByDesign) probes.push(['clip',cornersOf(VM.gunParts.clip),0.005]);
if(VM.gunParts.mag&&VM.gunParts.mag.visible&&k<0.66) probes.push(['mag',cornersOf(VM.gunParts.mag),0.004]);
[VM.arms.R,VM.arms.L].forEach((arm,i)=>{ // 只查被 override 的手 (默认握持手贴握把是设计内融合)
const def=i?defL:defR;
if(Math.abs(arm.position.x-def.x)<0.01&&Math.abs(arm.position.y-def.y)<0.01&&Math.abs(arm.position.z-def.z)<0.01) return;
// 收手段: 掌位在 0.88-0.97 融回默认握位, 末段本就贴着默认位 (而默认握位自身贴枪托 = 设计内融合) ⇒
// 离默认位 9cm 以内不再判 (否则报的是"默认握位本身的接触")。
if(Math.hypot(arm.position.x-def.x,arm.position.y-def.y,arm.position.z-def.z)<0.09) return;
arm.traverse(o=>{ if(o.isMesh&&o.geometry&&o.geometry.parameters&&o.geometry.parameters.width===0.055) probes.push([i?'handL':'handR',cornersOf(o),0.02]); }); // 手 2cm: 压弹时虎口搭机匣/手背贴枪身 = 持枪贴合 (四裁定)
});
const bad=[];
G.traverse(o=>{ if(!o.isMesh) return; if(o===VM.gunParts.clip||o===VM.gunParts.reloadRocket) return;
for(const [nm,cs,tol] of probes){ if(nm.startsWith('hand')&&o===VM.gunParts.mag) continue; // 手抓弹匣/漏斗 = 设计动作
const dd=penetDepth(cs,o); if(dd>tol) bad.push(nm+'×'+f(o.position)+' d='+dd.toFixed(3));
if(dd>tol&&${process.env.VMPENDBG?1:0}){
const inv=new THREE.Matrix4().copy(o.matrixWorld).invert();
console.log('  [dbg] 目标件 '+f(o.position)+' geom='+JSON.stringify(o.geometry.parameters)+' 角点在目标局部: '+cs.map(c=>{const q=c.clone().applyMatrix4(inv);return '('+[q.x,q.y,q.z].map(v=>+v.toFixed(3)).join(',')+')';}).join(' '));
} } });
if(bad.length) console.log('[穿模] '+key+' k='+k+': '+bad.join(' | '));
}
return tris;
}`);
const [key,kArg,viewArg,framesArg]=process.argv.slice(2);
const phases=kArg==='-'?(process.env.PHASES||'0.15,0.3,0.45,0.55,0.65,0.8').split(',').map(Number):[parseFloat(kArg)];
const views=(viewArg&&viewArg!=='-')?viewArg.split(','):['front'];
const FR=parseInt(framesArg||'36',10);
const len=a=>Math.hypot(a[0],a[1],a[2]);
const nrm=a=>{const d=len(a)||1;return [a[0]/d,a[1]/d,a[2]/d];};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const VIEWS={
front:{eye:[0,0,1],up:[0,1,0]},     // 玩家视角: 枪指 -z (正交)
fps:{eye:[0,0,1],up:[0,1,0],persp:0.45}, // 真实玩家透视: 眼距 ≈ |HIP.pos| 0.45, 近似游戏内观感
game:{eye:[0,0,1],up:[0,1,0],game:1},    // **实机取景**: vmCamera (FOV 56, 原点, 16:9) 定框 + 近裁 0.06
right:{eye:[1,0,0],up:[0,1,0]},     // 从枪右侧看
left:{eye:[-1,0,0],up:[0,1,0]},
top:{eye:[0,1,0],up:[0,0,-1]},
iso:{eye:[0.6,0.42,0.85],up:[0,1,0]},
};
const GAME_T=Math.tan(56/2*Math.PI/180), GAME_A=16/9;
function raster(tris,VIEW,out){
const VW=VIEWS[VIEW];
let E=nrm(VW.eye);
let R=nrm(cross(nrm(VW.up),E));
let U2=nrm(cross(E,R));
const pts=tris.flatMap(t=>t.P);
let mnz=1e9,mxz=-1e9,mny=1e9,mxy=-1e9;
const proj=p=>{ const a=dot(p,R), b=dot(p,U2);
if(VW.game){ const d=-p[2]; if(d<0.06) return null; return [p[0]/(d*GAME_T*GAME_A), p[1]/(d*GAME_T)]; } // ndc
if(VW.persp){ const w=VW.persp-dot(p,E); return [a/w*VW.persp, b/w*VW.persp]; } // 透视: 除以沿视线深距
return [a,b]; };
for(const p of pts){ const q=proj(p); if(!q) continue; const [a,b]=q; mnz=Math.min(mnz,a); mxz=Math.max(mxz,a); mny=Math.min(mny,b); mxy=Math.max(mxy,b); }
let W=900, PAD=30, scale, H;
if(VW.game){                 // 实机取景: 定框 ndc[-1,1] → 900×506 (16:9), 不自动缩放
W=900; PAD=0; scale=W/2; H=Math.round(W*9/16);
mnz=-1; mny=-1;
} else {
scale=(W-2*PAD)/Math.max(mxz-mnz,1e-6);
H=Math.round((mxy-mny)*scale+2*PAD);
}
const px=new Float32Array(W*H).fill(-1e9);
const img=new Uint8Array(W*H*3);
for(let i=0;i<W*H;i++){ img[i*3]=24; img[i*3+1]=26; img[i*3+2]=30; }
const L=nrm([E[0]*0.5+R[0]*0.6+U2[0]*0.7,E[1]*0.5+R[1]*0.6+U2[1]*0.7,E[2]*0.5+R[2]*0.6+U2[2]*0.7]);
const shade=t=>{
const nv=nrm([0,1,2].map(i=>t.N[0][i]+t.N[1][i]+t.N[2][i]));
let r=(t.col>>16&255)/255, g=(t.col>>8&255)/255, b=(t.col&255)/255;
const dif=Math.max(0,dot(nv,L))*0.6+0.5;
return [Math.min(1,r*dif)*255|0,Math.min(1,g*dif)*255|0,Math.min(1,b*dif)*255|0];
};
const toScr=(a,b)=>VW.game? [(a+1)*W/2, (1-b)*H/2] : [(a-mnz)*scale+PAD, H-PAD-(b-mny)*scale];
for(const t of tris){
const ps=t.P.map(proj);
if(ps.some(q=>!q)) continue;            // 实机取景: 顶点过近裁面 ⇒ 整片丢弃 (近似; 相机后的部件本就在画外)
const s=ps.map(q=>toScr(q[0],q[1]));
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
// 深度插值 (2026-10-05 修): 透视取景下 z 在屏幕上**非线性**, 线性插值会让"被大三角面盖住的近处小件"
//   反被画出来 (实证: 藏进枪托腹内的漏夹在 game 档透出来, 同帧正交档却正确遮住) —— 透视档改插 1/z
//   (标准透视校正), 正交档保持线性 (正交下深度本就是屏幕线性量)。
const z=(VW.game||VW.persp)?1/(w0/d[0]+w1/d[1]+w2/d[2]):w0*d[0]+w1*d[1]+w2*d[2];
const o=y*W+x;
if(z<=px[o]) continue;
px[o]=z;
const c=shade(t);
img[o*3]=c[0]; img[o*3+1]=c[1]; img[o*3+2]=c[2];
}
}
function crc32(buf){ let c,table=[]; for(let n=0;n<256;n++){ c=n; for(let k=0;k<8;k++) c=c&1?0xEDB88320^(c>>>1):c>>>1; table[n]=c>>>0; }
let crc=0xFFFFFFFF; for(const b of buf) crc=table[(crc^b)&255]^(crc>>>8); return (crc^0xFFFFFFFF)>>>0; }
function chunk(type,data){ const len2=Buffer.alloc(4); len2.writeUInt32BE(data.length); const t=Buffer.from(type,'ascii');
const body=Buffer.concat([t,data]); const crc=Buffer.alloc(4); crc.writeUInt32BE(crc32(body)); return Buffer.concat([len2,body,crc]); }
const ihdr=Buffer.alloc(13); ihdr.writeUInt32BE(W,0); ihdr.writeUInt32BE(H,4); ihdr[8]=8; ihdr[9]=2;
const raw=Buffer.alloc((W*3+1)*H);
for(let y=0;y<H;y++){ raw[y*(W*3+1)]=0; Buffer.from(img.buffer,y*W*3,W*3).copy(raw,y*(W*3+1)+1); }
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
fs.writeFileSync(out,png);
return `${W}x${H}`;
}
for(const wkey of key.split(',')){
for(const k of phases){
const tris=Q(`__poseVM('${wkey}',${k},${FR})`);
for(const vw of views){
const out=path.join(root,'dev',`_vmr-${wkey}-${String(k).replace('.','_')}-${vw}${process.env.VMTAG?'-tag':''}${process.env.STATE?'-'+process.env.STATE:''}${process.env.LEGACY?'-legacy':''}.png`);
const info=raster(tris,vw,out);
console.log(`写出 ${out}  ${info}  三角 ${tris.length}`);
}
}
}
