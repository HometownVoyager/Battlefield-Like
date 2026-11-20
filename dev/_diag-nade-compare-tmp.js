// ─────────────────────────────────────────────────────────────
// dev/_diag-nade-compare-tmp.js —— 投弹(FP 'nade')双版本逐帧对比沙箱 (临时诊断, 不入 run-all)
//
// 用法: node dev/_diag-nade-compare-tmp.js
//
// 问题: 军刀两批 (a958bd1/36f430b + 工作树三轮六修) 落地后, 用户报 "第一人称扔手雷动作太夸张,
//   持刀/持枪都夸张但不一样"。静态 diff 查不出 nade 分支曲线差异 → 本工具**运行时逐帧对比**:
//     基线 = 5990785 (军刀批之前最后绿基线 2026-11-19b), 全 45 文件链用 `git show` 时代文件
//            (已由 shell 预导出到 dev/_diag-nade-base-tmp/js/, 本脚本直接读);
//     当前 = 工作树现状 (含最新三轮六修)。
//   两版本各建一个沙箱 boot (verify-melee-20261120 同款桩: _bootstub/_bootpatch + 忠实 CANNON 桩
//   + index.html 全脚本链 + 淞沪开局 + startBtn/deployPlayer), 驱动 FP 进投弹全流程:
//     ① 进 'nade' 举雷哨兵段 0.55s (33帧, stateDur=999 哨兵)
//     ② 松键 (19-input keyup 同套账: nadeHeld=false + stateDur=0.55) → 出手弧 33~40帧
//     ③ nt>=1 回 idle 再走 5 帧收尾
//   每帧 (1/60 步长) 记录: 双臂 position/rotation/visible (= positionHands+override 混合后的最终值,
//   handROverride 语义等价), 枪/雷件 visible+position, VM.root/sway 位姿, VM.state/t/dur,
//   releaseNade 实际出手帧。
//
// ★确定性纪律: updateViewModel 用 performance.now() 做呼吸相位 (:469 brT) —— 两版本独立 boot 的
//   墙钟不同会造成假差异。本沙箱把 ctx.performance.now 换成**受驱动的确定时钟** (每帧 +16.6667ms,
//   两版本走同一序列), 呼吸项逐位可比。
//
// 拉伸判定口径: buildArms (09-weapons) 臂组枢轴=手腕, 皮肤(手)段中心 local (0,0,-0.09) (10-viewmodel
//   VM_PALM_L 同源), 袖管盒 0.07×0.07×0.30 center local (0,0,+0.10) ⇒ 袖管远端(肩侧断口) local
//   z=+0.25。臂是**刚体组平移**, 不可能真拉伸; "手臂拉长/要扔出去"的观感 = 手位远离肩锚后袖管够不到
//   身体。量化: vmCamera 在原点 (=眼位), 把 掌心/袖管端 经 root·sway·arm 三级 XYZ 欧拉链变换到相机
//   空间, 与肩代理点 R(0.20,-0.36,0.06) / L(-0.20,-0.36,0.06) (眼右/左下后方, 人肩解剖常识值) 比:
//     eyeToPalm      = |掌心 - 眼|          (臂+肩可达上限 ≈ 0.76m: 肩到眼 0.42 + 建模臂 0.34)
//     palmToShoulder = |掌心 - 肩代理|      (真臂全伸 ≈ 0.55~0.60m; 建模臂全长 0.34m)
//     sleeveGap      = |袖管端 - 肩代理|    (0 = 袖管正好接到肩; >0 = 断臂观感)
// ─────────────────────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const stub=require('./_bootstub.js');
require('./_bootpatch.js').patch(stub.sandbox);
// Group.clear / style.setProperty 桩补齐 (verify-melee 同款)
{const P=Object.getPrototypeOf(stub.THREE.Group.prototype); if(!P.clear) P.clear=function(){ this.children.length=0; };}
const _ensureStyle=e=>{ if(e&&e.style&&!e.style.setProperty) e.style.setProperty=(k,v)=>{ e.style[k]=v; }; return e; };
{const doc=stub.document,og=doc.getElementById.bind(doc),oc=doc.createElement.bind(doc);
doc.getElementById=id=>_ensureStyle(og(id));
doc.createElement=t=>_ensureStyle(oc(t));}
// CANNON 忠实桩 (verify-melee 同源)
const CANNON=(()=>{
const V3=stub.THREE.Vector3;
class Quat{constructor(){this.x=0;this.y=0;this.z=0;this.w=1;}set(){return this;}setFromEuler(){return this;}copy(){return this;}}
return {
Vec3:V3,Quaternion:Quat,
World:class{constructor(){this.gravity=new V3();this.broadphase=null;this.solver={iterations:0};this.bodies=[];}addBody(b){this.bodies.push(b);}removeBody(b){const i=this.bodies.indexOf(b);if(i>=0)this.bodies.splice(i,1);}add(b){this.addBody(b);}remove(b){this.removeBody(b);}addConstraint(){}removeConstraint(){}step(){}},
Body:class{constructor(o){Object.assign(this,o||{});this.shapes=[];this.position=new V3();this.velocity=new V3();this.angularVelocity=new V3();this.quaternion=new Quat();this.angularDamping=0;this.linearDamping=0;}addShape(s){this.shapes.push(s);}},
Box:class{},Sphere:class{},Material:class{},ContactMaterial:class{},NaiveBroadphase:class{},PointToPointConstraint:class{},
};})();

const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const FILES=[...html.matchAll(/src="(js\/[^"?]+)/g)].map(m=>m[1]);
const BASE_COMMIT='5990785';
const baseSrc=f=>fs.readFileSync(path.join(root,'dev','_diag-nade-base-tmp',f),'utf8');
const curSrc=f=>fs.readFileSync(path.join(root,f),'utf8');

function boot(srcOf,campIdx,label){
for(const k in stub.byId)delete stub.byId[k];
const ctx=vm.createContext(Object.assign({},stub.sandbox));
ctx.document=stub.document; ctx.window=stub.window; ctx.CANNON=CANNON;
ctx.localStorage={_s:{sf_campaign:String(campIdx),sf_pseed:'424242'},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
ctx.__perfNow=0;
ctx.performance={now:()=>ctx.__perfNow};   // 确定时钟 (呼吸相位逐位可比)
for(const f of FILES) vm.runInContext(srcOf(f),ctx,{filename:f});
const G=s=>vm.runInContext(s,ctx);
let err=null;
try{ G("document.getElementById('startBtn').onclick();"); }catch(e){ err='start: '+String(e&&e.stack||e); }
if(!err){ try{ G('if(!player.alive||!player.deployed) deployPlayer();'); }catch(e){ err='deploy: '+String(e&&e.stack||e); } }
if(!err) try{ G('for(const s of soldiers) s.protUntil=0; player.protUntil=0;'); }catch(e){}
if(err||G('player.alive')!==true){ console.log('✗ '+label+' 开局/部署失败 '+(err||'player.alive=false')); process.exit(1); }
// 每帧快照函数 (最终混合位姿 = handROverride 应用后的 VM.arms.R/L)
G(`function __snap(){
var R=VM.arms.R, L=VM.arms.L, g=VM.gunParts&&VM.gunParts.gun, nm=VM.nadeM, sw=VM.sway, rt=VM.root;
return {st:VM.state,t:VM.stateT,dur:VM.stateDur,rn:globalThis.__rnFired||0,
rpx:R.position.x,rpy:R.position.y,rpz:R.position.z,rrx:R.rotation.x,rry:R.rotation.y,rrz:R.rotation.z,rv:R.visible?1:0,
lpx:L.position.x,lpy:L.position.y,lpz:L.position.z,lrx:L.rotation.x,lry:L.rotation.y,lrz:L.rotation.z,lv:L.visible?1:0,
gv:g?(g.visible?1:0):-1,gpx:g?g.position.x:0,gpy:g?g.position.y:0,gpz:g?g.position.z:0,
grx:g?g.rotation.x:0,gry:g?g.rotation.y:0,grz:g?g.rotation.z:0,
nv:nm?(nm.visible?1:0):-1,npx:nm?nm.position.x:0,npy:nm?nm.position.y:0,npz:nm?nm.position.z:0,
opx:rt.position.x,opy:rt.position.y,opz:rt.position.z,orx:rt.rotation.x,ory:rt.rotation.y,orz:rt.rotation.z,
swx:sw.position.x,swy:sw.position.y,srx:sw.rotation.x,sry:sw.rotation.y,srz:sw.rotation.z,
iv:VM.inner.visible?1:0};
}`);
return {ctx,G};
}

// 步进一帧: 确定时钟 +16.6667ms 再 updateViewModel (呼吸相位确定)
function stepFrame(ctx,G){
ctx.__perfNow+=1000/60;
G('updateViewModel(1/60,player)');
}

// 投弹全流程驱动: 返回 {hold:[帧...], arc:[帧...], after:[帧...], meta}
function driveNade(G,step,snap,label){
const meta={};
meta.vmKey=G('VM.key');
meta.slot=G('player.curSlot');
// 出手实弹记账 (不改游戏代码: 实例级包装, 只计数)
G('globalThis.__rnFired=0; var __rn0=player.releaseNade; player.releaseNade=function(){ globalThis.__rnFired++; __rn0.apply(player,arguments); };');
// 进 'nade' 举雷哨兵段 (19-input KeyG 按下同套账, T9 同源)
G(`player.nadeCount=2;
VM.state='nade'; VM.stateT=0; VM.stateDur=999;
player.nadeHeld=true; player.nadeFuse=NADE_FUSE_T; player.nadeIsAT=false; player.nadeIsSmoke=false; player.nadeIsIncin=false; vmSndFlags={};`);
const hold=[];
for(let i=0;i<33;i++){ step(); hold.push(snap()); }
meta.holdEndState=hold[hold.length-1].st;
// 松键 (19-input keyup KeyG 同套账): 0.55s 出手弧
G('player.nadeHeld=false; VM.stateT=0; VM.stateDur=0.55;');
const arc=[]; let idleAt=-1;
for(let i=0;i<40;i++){ step(); const s=snap(); arc.push(s); if(s.st==='idle'&&idleAt<0) idleAt=i; }
meta.idleAt=idleAt; meta.rnFired=G('globalThis.__rnFired');
const after=[];
for(let i=0;i<5;i++){ step(); after.push(snap()); }
meta.endState=after[after.length-1].st;
meta.endLv=G('VM.arms.L.visible');
meta.endGv=G('VM.gunParts.gun.visible');
return {hold,arc,after,meta};
}

// ── 相机空间几何 (XYZ 欧拉, 与 10-viewmodel vmRotXyzV 同式: R=Rx·Ry·Rz) ──
function rotXYZ(x,y,z,rx,ry,rz){
const cz=Math.cos(rz),sz=Math.sin(rz),cy=Math.cos(ry),sy=Math.sin(ry),cx=Math.cos(rx),sx=Math.sin(rx);
const ax=x*cz-y*sz, ay=x*sz+y*cz, az=z;
const bx=ax*cy+az*sy, bz=-ax*sy+az*cy;
return [bx, ay*cx-bz*sx, ay*sx+bz*cx];
}
const vlen=v=>Math.hypot(v[0],v[1],v[2]);
const vsub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
// local → 相机空间: root ⊃ sway ⊃ inner(恒等) ⊃ arm
function toCam(s,lx,ly,lz,side){
const arm={rpx:s.rpx,rpy:s.rpy,rpz:s.rpz,rrx:s.rrx,rry:s.rry,rrz:s.rrz};
const a=rotXYZ(lx,ly,lz,arm.rrx,arm.rry,arm.rrz);
const b=rotXYZ(arm.rpx+a[0],arm.rpy+a[1],arm.rpz+a[2], s.srx,s.sry,s.srz);
const c=rotXYZ(s.swx+b[0],s.swy+b[1],b[2], s.orx,s.ory,s.orz);
return [s.opx+c[0], s.opy+c[1], s.opz+c[2]];
}
const SH_R=[0.20,-0.36,0.06], SH_L=[-0.20,-0.36,0.06];   // 肩代理 (眼右/左下后方)
const MODELED_ARM=0.34;                                  // 建模臂长: 掌心(-0.09)→袖管远端(+0.25)
function stretchOf(s){
const out={};
for(const sd of ['R','L']){
const palm=toCam(s,0,0,-0.09,sd), wrist=toCam(s,0,0,0,sd), sleeve=toCam(s,0,0,0.25,sd);
const SH=sd==='R'?SH_R:SH_L;
out['eyeToPalm'+sd]=vlen(palm);
out['palmToSh'+sd]=vlen(vsub(palm,SH));
out['wristToSh'+sd]=vlen(vsub(wrist,SH));
out['sleeveGap'+sd]=vlen(vsub(sleeve,SH));
}
return out;
}

// ── 逐字段对比 ──
const FIELDS=['st','t','dur','rn','rpx','rpy','rpz','rrx','rry','rrz','rv','lpx','lpy','lpz','lrx','lry','lrz','lv',
'gv','gpx','gpy','gpz','grx','gry','grz','nv','npx','npy','npz','opx','opy','opz','orx','ory','orz',
'swx','swy','srx','sry','srz','iv'];
function diffPhase(name,A,B){
let worst=[];
for(const f of FIELDS){
let mx=0,mi=-1;
for(let i=0;i<Math.min(A.length,B.length);i++){
const d=Math.abs((+A[i][f]||0)-(+B[i][f]||0));
if(d>mx){ mx=d; mi=i; }
}
if(mx>0) worst.push({field:f,max:mx,frame:mi,a:A[mi][f],b:B[mi][f]});
}
if(!worst.length){ console.log('  ['+name+'] 42 字段 × '+Math.min(A.length,B.length)+' 帧: 全部逐位一致 (max|Δ|=0)'); }
else for(const w of worst) console.log('  ['+name+'] ✗ '+w.field+' 帧'+w.frame+' |Δ|='+w.max.toExponential(3)+'  base='+w.a+' cur='+w.b);
return worst.length;
}

// ═══════════════════ 跑 ═══════════════════
console.log('载入清单: '+FILES.length+' 文件; 基线 commit='+BASE_COMMIT+' (dev/_diag-nade-base-tmp/)');
const CAMPI=3;   // 淞沪 (verify-melee 同源)

console.log('\n══ A. 基线 5990785 · 步枪态投弹 ══');
const baseBoot=boot(baseSrc,CAMPI,'基线');
console.log('  boot OK: VM.key='+baseBoot.G('VM.key')+' slot='+baseBoot.G('player.curSlot')+' wkey='+(baseBoot.G('player.curW&&player.curW.key')));
const base=driveNade(baseBoot.G,()=>stepFrame(baseBoot.ctx,baseBoot.G),()=>baseBoot.G('__snap()'),'基线步枪');
console.log('  holdEnd='+base.meta.holdEndState+' idleAt帧='+(base.meta.idleAt<0?'未回':base.meta.idleAt)+' releaseNade='+(base.meta.rnFired>0?'已出手(帧'+base.arc.findIndex(s=>s.rn>0)+')':'未出手')+' endLv='+base.meta.endLv);

console.log('\n══ B. 当前工作树 · 步枪态投弹 ══');
const curBoot=boot(curSrc,CAMPI,'当前');
console.log('  boot OK: VM.key='+curBoot.G('VM.key')+' slot='+curBoot.G('player.curSlot')+' wkey='+(curBoot.G('player.curW&&player.curW.key')));
const cur=driveNade(curBoot.G,()=>stepFrame(curBoot.ctx,curBoot.G),()=>curBoot.G('__snap()'),'当前步枪');
console.log('  holdEnd='+cur.meta.holdEndState+' idleAt帧='+(cur.meta.idleAt<0?'未回':cur.meta.idleAt)+' releaseNade='+(cur.meta.rnFired>0?'已出手(帧'+cur.arc.findIndex(s=>s.rn>0)+')':'未出手')+' endLv='+cur.meta.endLv);

console.log('\n══ C. 当前工作树 · 军刀态投弹 (基线无军刀, 只做当前内两武器差异量化) ══');
const curBoot2=boot(curSrc,CAMPI,'当前军刀');
curBoot2.G('for(let i=0;i<45;i++) updateViewModel(1/60,player);');   // 先走完部署拔枪
curBoot2.G('switchSlot(2,true);');
for(let i=0;i<10;i++){ stepFrame(curBoot2.ctx,curBoot2.G); if(curBoot2.G('VM.state')==='idle') break; }
console.log('  boot OK: VM.key='+curBoot2.G('VM.key')+' slot='+curBoot2.G('player.curSlot')+' state='+curBoot2.G('VM.state')+' 左臂可见='+curBoot2.G('VM.arms.L.visible'));
const curS=driveNade(curBoot2.G,()=>stepFrame(curBoot2.ctx,curBoot2.G),()=>curBoot2.G('__snap()'),'当前军刀');
console.log('  holdEnd='+curS.meta.holdEndState+' idleAt帧='+(curS.meta.idleAt<0?'未回':curS.meta.idleAt)+' releaseNade='+(curS.meta.rnFired>0?'已出手':'未出手')+' endLv='+curS.meta.endLv+' (持刀应=false=藏回)');

// ── 定罪对比 (B vs A = 用户质疑的步枪态是否变了) ──
console.log('\n──── 逐字段差异表: 当前 vs 基线 (步枪态投弹) ────');
let n1=diffPhase('举雷哨兵段 hold',base.hold,cur.hold);
let n2=diffPhase('出手弧 arc',base.arc,cur.arc);
let n3=diffPhase('回idle后 after',base.after,cur.after);
console.log(n1+n2+n3===0?'  ⇒ 步枪态投弹两版本逐位一致 (代码等价实锤)':'  ⇒ 存在分歧字段 (见上)');

// ── 当前内: 军刀 vs 步枪 (用户"持刀持枪都夸张但不一样"的量化) ──
console.log('\n──── 逐字段差异表: 当前·军刀 vs 当前·步枪 (投弹) ────');
let n4=diffPhase('hold',cur.hold,curS.hold);
let n5=diffPhase('arc',cur.arc,curS.arc);
if(n4+n5===0) console.log('  ⇒ 持刀/持枪投弹逐位一致 (左臂显隐除外已含在 lv 字段)');

// ── 拉伸判定 ──
console.log('\n──── 拉伸判定 (臂组=刚体: 量化"手位离肩超过臂长"的断臂观感) ────');
console.log('  建模臂长(掌心→袖管远端)='+MODELED_ARM.toFixed(2)+'m; 真臂全伸≈0.55m(掌到肩); 眼到肩≈0.42m ⇒ 眼到掌解剖上限≈0.76m');
console.log('  肩代理: R(0.20,-0.36,0.06) L(-0.20,-0.36,0.06) (相机空间, vmCamera=眼位原点)');
function stretchReport(label,run,phase,phaseName,phaseDur){
let mx={};
for(const key of ['eyeToPalmR','palmToShR','sleeveGapR','eyeToPalmL','palmToShL','sleeveGapL']){
let v=-1,mi=-1,rrx=0;
for(let i=0;i<run[phase].length;i++){
const st=stretchOf(run[phase][i]);
if(st[key]>v){ v=st[key]; mi=i; rrx=run[phase][i].rrx; }
}
mx[key]={v,mi,rrx};
}
const T=phaseDur||run[phase][0].dur||0.55;
console.log('  '+label+' · '+phaseName+':');
for(const k in mx){
const m=mx[k];
const kph=(m.mi>=0)?((run[phase][m.mi].t/Math.max(T,0.001))).toFixed(2):'-';
console.log('    '+k+' max='+m.v.toFixed(3)+'m @帧'+m.mi+' (k≈'+kph+', rot.x='+m.rrx.toFixed(2)+')');
}
}
for(const [lbl,run] of [['基线·步枪',base],['当前·步枪',cur],['当前·军刀',curS]]){
stretchReport(lbl,run,'hold','举雷哨兵段(t=0~0.55s)',0.55);
stretchReport(lbl,run,'arc','出手弧(t=0~0.55s)',0.55);
}
// 出手弧 rot.x 摆幅 (腕翻幅度) 与手位极值
console.log('\n──── 出手弧右臂姿态极值 (腕翻/手位半径, 两版本同表对照) ────');
function arcExtremes(lbl,run){
const A=run.arc;
let rrxMax=-9,rrxMin=9,rrxAt=[0,0],pzMax=0,pzMaxAt=0,pyMax=-9,eyeMax=0,eyeAt=0,cross=-1;
for(let i=0;i<A.length;i++){
if(A[i].rrx>rrxMax){rrxMax=A[i].rrx;rrxAt[0]=i;}
if(A[i].rrx<rrxMin){rrxMin=A[i].rrx;rrxAt[1]=i;}
if(A[i].rpz<pzMax){pzMax=A[i].rpz;pzMaxAt=i;}   // z 越负手越远
if(A[i].rpy>pyMax)pyMax=A[i].rpy;
const st=stretchOf(A[i]);
if(st.eyeToPalmR>eyeMax){eyeMax=st.eyeToPalmR;eyeAt=i;}
if(cross<0&&st.eyeToPalmR>0.76) cross=i;
}
console.log('  '+lbl+': rot.x '+rrxMin.toFixed(3)+'(帧'+rrxAt[1]+') → '+rrxMax.toFixed(3)+'(帧'+rrxAt[0]+') 摆幅='+(rrxMax-rrxMin).toFixed(3)+'rad ('+((rrxMax-rrxMin)*180/Math.PI).toFixed(0)+'°)'+
' | 手位最远 root-local z='+pzMax.toFixed(3)+'(帧'+pzMaxAt+') y峰值='+pyMax.toFixed(3)+
' | 眼到掌 max='+eyeMax.toFixed(3)+'m(帧'+eyeAt+') 首超0.76m解剖上限@帧'+(cross<0?'无':cross));
}
arcExtremes('基线·步枪',base);
arcExtremes('当前·步枪',cur);
arcExtremes('当前·军刀',curS);

// 关键帧位姿抽样 (对照人工读弧)
console.log('\n──── 出手弧抽样 (帧=弧内序号, 60fps; root-local 手位 + 相机空间掌心) ────');
function sampleArc(lbl,run){
const A=run.arc;
const pick=[0,5,10,16,20,24,28,33,38];
console.log('  '+lbl);
for(const i of pick){ if(i>=A.length) continue; const s=A[i]; const p=stretchOf(s);
console.log('    帧'+i+' k='+(s.t/Math.max(s.dur,0.001)).toFixed(2)+' '+s.st+
' 手R('+s.rpx.toFixed(3)+','+s.rpy.toFixed(3)+','+s.rpz.toFixed(3)+') rot.x='+s.rrx.toFixed(2)+
' 雷v='+s.nv+' 雷('+s.npx.toFixed(2)+','+s.npy.toFixed(2)+','+s.npz.toFixed(2)+')'+
' 掌心R距肩='+p.palmToShR.toFixed(3)+' 袖端R距肩='+p.sleeveGapR.toFixed(3)+' lv='+s.lv);
}
}
sampleArc('基线·步枪',base);
sampleArc('当前·步枪',cur);
sampleArc('当前·军刀',curS);

console.log('\n完成 (临时诊断工具, 不入 run-all 清单)');
