// ─────────────────────────────────────────────
// 05a-buildings.js —— 建筑实例 (框架/选址见 05-world.js)
// 2026-08-24 由 05-world.js 切分: 原第 429-780 行
// ═══════════ 建筑类型 (全部基于 05-world.js 框架重写) ═══════════
// 欧式废墟平房: 残破度可控(预塌墙/缺坡屋顶), 墙可毁, 顶随塌
function ruinedHouse(x,z,w,d,ry,mat,brokenLevel=0.3){
const f=foundation(x,z,ry,w,d);
const ctx=bctx(x,z,ry,f.floor);
const H=3.1,t=0.34;
const wallGs=[];
let preDead=0;
const mk=(at,along,from,to,ops,noPre)=>{
const g=wallSeg(ctx,{along,at,from,to,h:H,t,mat,ops,destr:true,preDead:!noPre&&wallGs.length>0&&wRand()<brokenLevel*0.55});
if(g){ wallGs.push(g); if(g.dead) preDead++; }
return g;
};
// 前墙(+z): 门+窗; 后墙: 窗; 侧墙: 窗 (门侧永不预塌, 保证入口)
mk( d/2,'x',-w/2,w/2,[{c:0,w:1.4,ht:2.15,h:0,type:'door'},{c:w*0.28,w:1.3,b:1.0,h:1.5,type:'win'}],true);
mk(-d/2,'x',-w/2,w/2,[{c:0,w:1.3,b:1.0,h:1.5,type:'win'}]);
mk( w/2,'z',-d/2+t,d/2-t,[{c:0,w:1.3,b:1.0,h:1.5,type:'win'}]);
mk(-w/2,'z',-d/2+t,d/2-t,[]);
// 屋顶: 存活时双坡(一侧可能缺失); 脊沿长边
let hasRoof=false;
if(preDead<2&&wRand()>brokenLevel*0.6){
hasRoof=true;
pitchedRoof(ctx,{axis:w>=d?'x':'z',w,d,y0:H,rise:1.45,mat:MAT.roof,over:0.4,wallGs,preDead,
skip:(brokenLevel>0.5&&wRand()<0.55)?(wRand()<0.5?1:-1):undefined});
}
// 屋内残存家具 + 掩体点
let p=ctx.L(wr(-w*0.2,w*0.2),wr(-d*0.2,d*0.2));
solidBox(MAT.woodDark,1.1,0.8,0.7,p[0],heightAt(p[0],p[1])+0.4,p[1],wr(0,3));
addCoverAround(x,z,w,d,ry);
p=ctx.L(0,0); coverPoints.push({x:p[0],z:p[1]});
BUILD_REG.push({type:'ruinedHouse',x,z,ry,w,d,floor:f.floor,doors:ctx.doors.slice(),roofY:hasRoof?f.floor+H+1.20:null});
}
// 中式瓦房: 灰墙+双坡挑檐瓦顶 (墙体可摧毁, 顶随墙塌)
function cnHouse(x,z,ry,w=6,d=5){
const f=foundation(x,z,ry,w,d);
const ctx=bctx(x,z,ry,f.floor);
const H=2.7,t=0.32;
const wallGs=[];
let g;
g=wallSeg(ctx,{along:'x',at:d/2,from:-w/2,to:w/2,h:H,t,mat:MAT.plaster,destr:true,
ops:[{c:0,w:1.4,ht:2.1,h:0,type:'door'}]}); if(g)wallGs.push(g);
g=wallSeg(ctx,{along:'x',at:-d/2,from:-w/2,to:w/2,h:H,t,mat:MAT.plaster,destr:true,
ops:[{c:0,w:1.3,b:1.0,h:1.3,type:'win'}]}); if(g)wallGs.push(g);
g=wallSeg(ctx,{along:'z',at:w/2,from:-d/2+t,to:d/2-t,h:H,t,mat:MAT.plaster,destr:true,ops:[]}); if(g)wallGs.push(g);
g=wallSeg(ctx,{along:'z',at:-w/2,from:-d/2+t,to:d/2-t,h:H,t,mat:MAT.plaster,destr:true,
ops:[{c:0,w:1.1,b:1.0,h:1.2,type:'win'}]}); if(g)wallGs.push(g);
pitchedRoof(ctx,{axis:'x',w,d,y0:H,rise:1.35,mat:MAT.roof,over:0.6,wallGs});
let p=ctx.L(wr(-w*0.2,w*0.2),wr(-d*0.2,d*0.2));
solidBox(MAT.woodDark,1.1,0.7,0.6,p[0],heightAt(p[0],p[1])+0.35,p[1],wr(0,3));
addCoverAround(x,z,w,d,ry);
p=ctx.L(0,0); coverPoints.push({x:p[0],z:p[1]});
BUILD_REG.push({type:'cnHouse',x,z,ry,w,d,floor:f.floor,doors:ctx.doors.slice(),roofY:f.floor+H+1.12});
}
function buildChurch(x,z,ry){
const f=foundation(x,z,ry,10,16,{maxDh:1.6});
const ctx=bctx(x,z,ry,f.floor);
const H=5.5,t=0.5;
// 大殿: 前门+两侧高窗
wallSeg(ctx,{along:'x',at:8,from:-5,to:5,h:H,t,mat:MAT.stone,
ops:[{c:0,w:2.2,ht:3.2,h:0,type:'door'},{c:-3.2,w:1.3,b:1.2,h:2.2,type:'win'},{c:3.2,w:1.3,b:1.2,h:2.2,type:'win'}]});
wallSeg(ctx,{along:'x',at:-8,from:-5,to:5,h:H,t,mat:MAT.stone,
ops:[{c:-3,w:1.3,b:1.2,h:2.2,type:'win'},{c:0,w:1.3,b:1.2,h:2.2,type:'win'},{c:3,w:1.3,b:1.2,h:2.2,type:'win'}]});
wallSeg(ctx,{along:'z',at:5,from:-8+t,to:8-t,h:H,t,mat:MAT.stone,
ops:[{c:-4,w:1.3,b:1.2,h:2.2,type:'win'},{c:0,w:1.3,b:1.2,h:2.2,type:'win'},{c:4,w:1.3,b:1.2,h:2.2,type:'win'}]});
wallSeg(ctx,{along:'z',at:-5,from:-8+t,to:8-t,h:H,t,mat:MAT.stone,
ops:[{c:-4,w:1.3,b:1.2,h:2.2,type:'win'},{c:0,w:1.3,b:1.2,h:2.2,type:'win'},{c:4,w:1.3,b:1.2,h:2.2,type:'win'}]});
pitchedRoof(ctx,{axis:'z',w:10,d:16,y0:H,rise:2.3,mat:MAT.roof,over:0.55});
// 长椅
for(let i=0;i<3;i++){
const p=ctx.L(wr(-1,1),-2-i*2.2);
solidBox(MAT.woodDark,3,0.5,0.5,p[0],f.floor+0.25,p[1],ry+wr(-0.1,0.1));
}
// ── 钟塔 (局部 -z 端外接, 全部部件随 ry 旋转) ──
const tw=ctx.L(0,-10.6);
const tf=foundation(tw[0],tw[1],ry,5,5,{maxDh:1.6});
const tc=bctx(tw[0],tw[1],ry,tf.floor);
const tH=9.7,tt=0.45;
// 底层墙(0~7.05): 背面门, 侧窗; 钟室墙(7.2~9.7): 四面大窗
wallSeg(tc,{along:'x',at:2.5,from:-2.5,to:2.5,h:7.05,t:tt,mat:MAT.stone,ops:[]});
wallSeg(tc,{along:'x',at:-2.5,from:-2.5,to:2.5,h:7.05,t:tt,mat:MAT.stone,
ops:[{c:0,w:1.4,ht:2.1,h:0,type:'door'},{c:1.6,w:0.9,b:4.6,h:1.0,type:'win'}]});
wallSeg(tc,{along:'z',at:2.5,from:-2.5+tt,to:2.5-tt,h:7.05,t:tt,mat:MAT.stone,
ops:[{c:0,w:1.0,b:4.8,h:1.0,type:'win'}]});
wallSeg(tc,{along:'z',at:-2.5,from:-2.5+tt,to:2.5-tt,h:7.05,t:tt,mat:MAT.stone,
ops:[{c:0,w:1.0,b:4.8,h:1.0,type:'win'}]});
for(const at of [2.5,-2.5]){
wallSeg(tc,{along:'x',at,from:-2.5,to:2.5,y0:7.2,h:2.5,t:tt,mat:MAT.stone,ops:[{c:0,w:1.6,b:0.4,h:1.9,type:'win'}]});
wallSeg(tc,{along:'z',at,from:-2.5+tt,to:2.5-tt,y0:7.2,h:2.5,t:tt,mat:MAT.stone,ops:[{c:0,w:1.6,b:0.4,h:1.9,type:'win'}]});
}
// 塔内折跑楼梯: 一跑(+x侧, 至3.6m) → 转角平台 → 二跑(-x侧, 至钟室7.2m)
stairFlight(tc,{lx:1.35,lz:1.8,dir:'z-',width:1.1,base:tf.floor,topY:tf.floor+3.6,maxRise:0.45,tread:0.5,exit:[-0.65,-1.8]});
const lp=tc.L(-0.65,-1.8);
solidBox(MAT.woodDark,2.75,0.22,1.05,lp[0],tf.floor+3.49,lp[1],ry); // 转角平台(顶面3.6)
stairFlight(tc,{lx:-0.9,lz:-1.5,dir:'z+',width:1.1,base:tf.floor+3.6,topY:tf.floor+7.2,maxRise:0.45,tread:0.45,exit:[0.2,1.85]});
// 钟室地板(顶面7.2, 楼梯口沿-x侧开洞; 护栏不到顶, 留出登顶跨步位)
const bl=tc.L(0.94,0);
solidBox(MAT.woodDark,2.55,0.22,4.4,bl[0],tf.floor+7.09,bl[1],ry);
const rl=tc.L(-0.24,-0.425);
solidBox(MAT.woodDark,0.12,0.95,3.25,rl[0],tf.floor+7.2+0.475,rl[1],ry);
// 塔顶盖 + 尖顶
const cp=tc.L(0,0);
addSnowCap(solidBox(MAT.stone,5.4,0.4,5.4,cp[0],tf.floor+tH+0.2,cp[1],ry));
mesh(new THREE.ConeGeometry(2.2,2.8,4),MAT.woodDark,cp[0],tf.floor+tH+1.8,cp[1],ry+HPI);
addCoverAround(x,z,10,16,ry);
coverPoints.push({x:ctx.L(0,-4)[0],z:ctx.L(0,-4)[1]},{x:ctx.L(0,3)[0],z:ctx.L(0,3)[1]});
BUILD_REG.push({type:'church',x,z,ry,w:10,d:16,floor:f.floor,doors:ctx.doors.concat(tc.doors),roofY:f.floor+H+1.91,towerFloor:tf.floor,towerRoofY:tf.floor+tH+0.4});
}
// 谷仓: 大门(坦克/步兵可入) + 阁楼 + 干草垛 (墙高4.4: 阁楼站立面与屋顶碰撞带间留足净高)
function buildBarn(x,z,ry){
const f=foundation(x,z,ry,9,13);
const ctx=bctx(x,z,ry,f.floor);
const H=4.4,t=0.35;
// 前墙: 3.8m 大门; 后墙: 窗; 侧墙: 窗
wallSeg(ctx,{along:'x',at:6.5,from:-4.5,to:4.5,h:H,t,mat:MAT.wood,
ops:[{c:0,w:3.8,ht:3.15,h:0,type:'door'}]});
wallSeg(ctx,{along:'x',at:-6.5,from:-4.5,to:4.5,h:H,t,mat:MAT.wood,
ops:[{c:0,w:1.2,b:1.3,h:1.2,type:'win'}]});
for(const at of [4.5,-4.5]){
wallSeg(ctx,{along:'z',at,from:-6.5+t,to:6.5-t,h:H,t,mat:MAT.wood,
ops:[{c:-2.5,w:1.2,b:1.3,h:1.2,type:'win'},{c:2.5,w:1.2,b:1.3,h:1.2,type:'win'}]});
}
pitchedRoof(ctx,{axis:'z',w:9,d:13,y0:H,rise:1.9,mat:MAT.wood,over:0.5});
// 阁楼(后半全宽, 顶面2.2) + 横向楼梯(前区沿x向爬升) + 登顶平台齐平衔接
const lo=ctx.L(0,-4.475);
solidBox(MAT.woodDark,7.2,0.24,3.35,lo[0],f.floor+2.08,lo[1],ry);
stairFlight(ctx,{lx:-3.3,lz:-2.4,dir:'x+',width:1.15,base:f.floor,topY:f.floor+2.2,maxRise:0.4,tread:0.55,exit:[0.55,-2.15]});
const la=ctx.L(0.55,-2.15);
solidBox(MAT.woodDark,1.0,0.24,1.2,la[0],f.floor+2.08,la[1],ry); // 登顶平台(顶面2.2, 与阁楼齐平相接)
// 阁楼前缘护栏(楼梯登顶通道留豁口 x∈-0.05~1.25)
const r1=ctx.L(-1.84,-2.74);
solidBox(MAT.woodDark,3.58,0.9,0.12,r1[0],f.floor+2.2+0.45,r1[1],ry);
const r2=ctx.L(2.43,-2.74);
solidBox(MAT.woodDark,2.35,0.9,0.12,r2[0],f.floor+2.2+0.45,r2[1],ry);
// 干草垛(前半, 避开大门通道)
for(const [lx,lz] of [[-1.9,1.6],[1.9,3.0]]){
const hp=ctx.L(lx,lz), hh=heightAt(hp[0],hp[1]);
mesh(new THREE.CylinderGeometry(1.05,1.25,1.6,10),MAT.hay,hp[0],hh+0.8,hp[1]);
CYLS.push({x:hp[0],z:hp[1],r:1.15,y0:hh,y1:hh+1.6});
}
addCoverAround(x,z,9,13,ry);
coverPoints.push({x:ctx.L(0,1)[0],z:ctx.L(0,1)[1]},{x:ctx.L(-2,-4)[0],z:ctx.L(-2,-4)[1]});
BUILD_REG.push({type:'barn',x,z,ry,w:9,d:13,floor:f.floor,doors:ctx.doors.slice(),roofY:f.floor+H+1.58});
}
// 两层小楼: 楼梯与二层楼板齐平衔接 + 楼梯井护栏 + 二层四面窗 (有效火力位)
function twoStoryHouse(x,z,ry,mat){
const f=foundation(x,z,ry,8,9);
const ctx=bctx(x,z,ry,f.floor);
const t=0.35,H1=3.26; // 一层墙顶嵌入二层墙底(3.16), 消除层间缝隙
// 一层: 门+窗
wallSeg(ctx,{along:'x',at:4.5,from:-4,to:4,h:H1,t,mat,
ops:[{c:0,w:1.4,ht:2.2,h:0,type:'door'},{c:-2.6,w:1.4,b:1.1,h:1.5,type:'win'},{c:2.6,w:1.4,b:1.1,h:1.5,type:'win'}]});
wallSeg(ctx,{along:'x',at:-4.5,from:-4,to:4,h:H1,t,mat,
ops:[{c:-2.4,w:1.4,b:1.1,h:1.5,type:'win'},{c:2.4,w:1.4,b:1.1,h:1.5,type:'win'}]});
for(const at of [4,-4]){
wallSeg(ctx,{along:'z',at,from:-4.5+t,to:4.5-t,h:H1,t,mat,
ops:[{c:0,w:1.4,b:1.1,h:1.5,type:'win'}]});
}
// 楼梯(右墙侧, 自前向后): 顶面与二层楼板严格齐平(3.16)
const F1=f.floor+3.16;
stairFlight(ctx,{lx:2.95,lz:3.4,dir:'z-',width:1.35,base:f.floor,topY:F1,maxRise:0.42,tread:0.6});
// 二层楼板(留楼梯井: x2.15~3.8, z-1.5~3.9)
const slab=(x0,x1,z0,z1)=>{
const p=ctx.L((x0+x1)/2,(z0+z1)/2);
solidBox(MAT.woodDark,x1-x0,0.22,z1-z0,p[0],F1-0.11,p[1],ry);
};
slab(-3.8,2.15,-4.3,4.3);
slab(2.15,3.8,-4.3,-1.34); // 井北缘伸到梯末步下 0.06: 消除登顶口 0.1 断缝 (与 ruinBlock 同口径)
slab(2.15,3.8,3.9,4.3);
// 楼梯井护栏(西侧长边+南侧短边; 北侧是楼梯登顶口保持敞开, 东侧贴墙)
const rail=(lx,lz,len,alongX)=>{
const p=ctx.L(lx,lz);
solidBox(MAT.woodDark,alongX?len:0.12,0.95,alongX?0.12:len,p[0],F1+0.475,p[1],ry);
};
rail(2.09,1.2,5.4,false);
rail(2.98,3.96,1.72,true);
// 二层墙(四面窗, 修复原右墙大敞口)
const H2=2.6;
wallSeg(ctx,{along:'x',at:4.5,from:-4,to:4,y0:3.16,h:H2,t,mat,
ops:[{c:-2.4,w:1.4,b:0.95,h:1.4,type:'win'},{c:2.4,w:1.4,b:0.95,h:1.4,type:'win'}]});
wallSeg(ctx,{along:'x',at:-4.5,from:-4,to:4,y0:3.16,h:H2,t,mat,
ops:[{c:-2.4,w:1.4,b:0.95,h:1.4,type:'win'},{c:2.4,w:1.4,b:0.95,h:1.4,type:'win'}]});
for(const at of [4,-4]){
wallSeg(ctx,{along:'z',at,from:-4.5+t,to:4.5-t,y0:3.16,h:H2,t,mat,
ops:[{c:-1.8,w:1.4,b:0.95,h:1.4,type:'win'},{c:1.8,w:1.4,b:0.95,h:1.4,type:'win'}]});
}
// 平顶(实心挡弹) + 女儿墙
const rp=ctx.L(0,0);
addSnowCap(solidBox(mat,8.5,0.28,9.5,rp[0],F1+H2+0.14,rp[1],ry));
for(const [lx,lz,lw,ld] of [[0,4.62,8.5,0.24],[0,-4.62,8.5,0.24],[4.12,0,0.24,9.5],[-4.12,0,0.24,9.5]]){
const p=ctx.L(lx,lz);
solidBox(mat,lw,0.35,ld,p[0],F1+H2+0.28+0.175,p[1],ry);
}
// 一层屋内桌 + 掩体点
let p=ctx.L(-1.8,-1.5);
solidBox(MAT.woodDark,1.2,0.8,0.8,p[0],heightAt(p[0],p[1])+0.4,p[1],wr(0,3));
addCoverAround(x,z,8,9,ry);
coverPoints.push({x:ctx.L(-1.5,1)[0],z:ctx.L(-1.5,1)[1]});
BUILD_REG.push({type:'twoStory',x,z,ry,w:8,d:9,floor:f.floor,doors:ctx.doors.slice(),roofY:F1+H2+0.28});
}
// 瞭望塔: 楼梯顶端与平台齐平衔接(顶踏步贴平台边缘), 护栏留准确豁口, 顶棚有碰撞
function watchtower(x,z,ry=0){
const ctx=bctx(x,z,ry,0);
// 腿柱落地高度采样 → 平台面 = 最高柱地+4.6
let gMax=-1e9;
const legP=[];
for(const [lx,lz] of [[-1.5,-1.5],[1.5,-1.5],[-1.5,1.5],[1.5,1.5]]){
const p=ctx.L(lx,lz), gh=heightAt(p[0],p[1]);
legP.push([p[0],p[1],gh]);
if(gh>gMax)gMax=gh;
}
const deckTop=gMax+4.6;
for(const [px,pz,gh] of legP){
mesh(boxGeo(0.24,deckTop-gh+0.3,0.24),MAT.woodDark,px,(deckTop+gh)/2,pz);
CYLS.push({x:px,z:pz,r:0.17,y0:gh,y1:deckTop});
}
// 平台(实心) + 三面护栏(+z 侧楼梯口留豁口)
const dp=ctx.L(0,0);
solidBox(MAT.wood,3.6,0.24,3.6,dp[0],deckTop-0.12,dp[1],ry);
const rail=(lx,lz,lw,ld)=>{
const p=ctx.L(lx,lz);
solidBox(MAT.wood,lw,0.95,ld,p[0],deckTop+0.475,p[1],ry);
};
rail(0,-1.74,3.6,0.12); rail(-1.74,0,0.12,3.6); rail(1.74,0,0.12,3.6);
rail(-1.17,1.74,1.14,0.12); rail(1.17,1.74,1.14,0.12); // +z 侧护栏留 1.2m 宽豁口对准楼梯
// 顶棚柱 + 实心顶板(挡弹/挡视线)
for(const [lx,lz] of [[-1.6,-1.6],[1.6,-1.6],[-1.6,1.6],[1.6,1.6]]){
const p=ctx.L(lx,lz);
mesh(boxGeo(0.16,2.3,0.16),MAT.woodDark,p[0],deckTop+1.15,p[1]);
CYLS.push({x:p[0],z:p[1],r:0.1,y0:deckTop,y1:deckTop+2.3});
}
const rp=ctx.L(0,0);
addSnowCap(solidBox(MAT.woodDark,4.2,0.18,4.2,rp[0],deckTop+2.21,rp[1],ry));
// 直爬梯(陡踏步): 底端贴地, 顶踏步顶面=平台面且内缘贴平台边缘(齐平衔接)
const sb=ctx.L(0,2.2);
const base=heightAt(sb[0],sb[1]);
const rise=Math.max(3.8,deckTop-base);
const n=Math.ceil(rise/0.44), sr=rise/n, tr=0.46;
for(let i=0;i<n;i++){
const p=ctx.L(0,1.8+tr*(n-i-0.5));
solidBox(MAT.woodDark,1.1,0.2,tr,p[0],base+sr*(i+1)-0.1,p[1],ry);
}
const tp=ctx.L(0,1.3); // 平台护栏豁口内登顶落点
STAIRS.push({x:tp[0],z:tp[1],topY:deckTop,sr,width:1.1});
// 梯下支撑(视觉)
for(const sgn of [-0.5,0.5]){
const p=ctx.L(sgn,1.8+tr*n*0.5);
mesh(boxGeo(0.14,deckTop-base-1.5,0.14),MAT.woodDark,p[0],(deckTop+base)/2-0.5,p[1]);
}
coverPoints.push({x,z});
BUILD_REG.push({type:'watchtower',x,z,ry,w:4,d:7,floor:base,doors:[],roofY:deckTop+2.3});
}
// 帐篷: 双坡帆布小屋式——四面墙(正面门洞, 墙段框架自动登记通行区)+
// 实心帆布坡顶(挡弹/挡视线), 全部件有碰撞; 旧 A 型两块帆布板与墙互相穿模, 弃用
const tentMatA=new THREE.MeshLambertMaterial({color:0x5e6244,map:TEX.cloth}); // B8/P3-12
const tentMatB=new THREE.MeshLambertMaterial({color:0x565a3e,map:TEX.cloth});
function tent(x,z,ry){
const f=foundation(x,z,ry,3.2,4.4,{raise:0.02});
const ctx=bctx(x,z,ry,f.floor);
const H=2.35,t=0.2;
wallSeg(ctx,{along:'x',at:2.2,from:-1.6,to:1.6,h:H,t,mat:MAT.woodDark,
ops:[{c:0,w:1.4,ht:2.0,h:0,type:'door'}]});
wallSeg(ctx,{along:'x',at:-2.2,from:-1.6,to:1.6,h:H,t,mat:MAT.woodDark,ops:[]});
for(const at of [1.6,-1.6]){
wallSeg(ctx,{along:'z',at,from:-2.0,to:2.0,h:H,t,mat:MAT.woodDark,ops:[]}); // ±2.2→±2.0 (2026-09-06 P3-10: wallSeg 侧墙自动外伸 t, 原参数反向过咬合 0.1m)
}
pitchedRoof(ctx,{axis:'x',w:3.2,d:4.4,y0:H,rise:0.62,mat:tentMatA,gableMat:tentMatB,over:0.45,t:0.2});
// 内部地铺 + 箱
let p=ctx.L(wr(-0.6,0.6),wr(-1.2,-0.2));
mesh(boxGeo(1.8,0.18,2.4),MAT.hay,p[0],heightAt(p[0],p[1])+0.09,p[1],ry,false,true);
p=ctx.L(0.8,1.2);
solidBox(MAT.wood,0.9,0.7,0.9,p[0],heightAt(p[0],p[1])+0.35,p[1],wr(0,3));
p=ctx.L(0,-0.5); coverPoints.push({x:p[0],z:p[1]});
BUILD_REG.push({type:'tent',x,z,ry,w:3.2,d:4.4,floor:f.floor,doors:ctx.doors.slice(),roofY:f.floor+H+0.52});
}
// 雪地木屋 (可破坏, 双坡顶)
function logCabin(x,z,ry){
const f=foundation(x,z,ry,6,5);
const ctx=bctx(x,z,ry,f.floor);
const H=2.55,t=0.3;
const wallGs=[];
let g;
g=wallSeg(ctx,{along:'x',at:2.5,from:-3,to:3,h:H,t,mat:MAT.woodDark,destr:true,
ops:[{c:0,w:1.4,ht:2.1,h:0,type:'door'}]}); if(g)wallGs.push(g);
g=wallSeg(ctx,{along:'x',at:-2.5,from:-3,to:3,h:H,t,mat:MAT.woodDark,destr:true,
ops:[{c:0,w:1.2,b:1.0,h:1.1,type:'win'}]}); if(g)wallGs.push(g);
g=wallSeg(ctx,{along:'z',at:3,from:-2.5+t,to:2.5-t,h:H,t,mat:MAT.woodDark,destr:true,ops:[]}); if(g)wallGs.push(g);
g=wallSeg(ctx,{along:'z',at:-3,from:-2.5+t,to:2.5-t,h:H,t,mat:MAT.woodDark,destr:true,
ops:[{c:0,w:1.2,b:1.0,h:1.1,type:'win'}]}); if(g)wallGs.push(g);
pitchedRoof(ctx,{axis:'x',w:6,d:5,y0:H,rise:1.3,mat:MAT.roof,over:0.55,wallGs});
addCoverAround(x,z,6,5,ry);
let p=ctx.L(0,0); coverPoints.push({x:p[0],z:p[1]});
BUILD_REG.push({type:'logCabin',x,z,ry,w:6,d:5,floor:f.floor,doors:ctx.doors.slice(),roofY:f.floor+H+1.08});
}
// 混凝土碉堡: 正面/侧面真射击孔(站姿可向外射击), 背面入口人/Bot 均可通过
function bunker(x,z,face){
const f=foundation(x,z,face,3.8,3.4,{raise:0.1});
const ctx=bctx(x,z,face,f.floor);
const H=2.15,t=0.55;
// 前墙(+z=face 朝向): 射击孔 1.05~1.55m (眼高可击出, 弹道可穿)
wallSeg(ctx,{along:'x',at:1.7,from:-1.9,to:1.9,h:H,t,mat:MAT.stone,
ops:[{c:0,w:1.5,b:1.05,h:0.5,ht:H,type:'slit'}]});
// 侧墙: 窄射击孔
for(const at of [1.9,-1.9]){
wallSeg(ctx,{along:'z',at,from:-1.7+t,to:1.7-t,h:H,t,mat:MAT.stone,
ops:[{c:0,w:0.8,b:1.05,h:0.45,ht:H,type:'slit'}]});
}
// 背墙: 入口净宽1.4 净高2.05
wallSeg(ctx,{along:'x',at:-1.7,from:-1.9,to:1.9,h:H,t,mat:MAT.stone,
ops:[{c:0,w:1.4,ht:2.05,h:0,type:'door'}]});
// 顶盖(实心挡弹)
const rp=ctx.L(0,0);
addSnowCap(solidBox(MAT.stone,4.4,0.55,4.0,rp[0],f.floor+H+0.275,rp[1],face));
coverPoints.push({x:ctx.L(0,3.4)[0],z:ctx.L(0,3.4)[1]},{x,z});
BUILD_REG.push({type:'bunker',x,z,ry:face,w:4.4,d:4,floor:f.floor,doors:ctx.doors.slice(),roofY:f.floor+H+0.55});
}
// ═══════════ 城市组新建筑 (2026-09-05 城市组·斯大林格勒/柏林) ═══════════
// 多层公寓废墟壳: 2~3 层沿街公寓 —— 逐层楼板(楼梯井)+楼梯, 上层窗位可架枪俯射街道;
// 墙体逐面可毁(dBox), 残余承重墙≤2 → 坡顶整体坍塌(走 05-world 坍塌链); 顶层随机预塌一面(废墟感);
// 上层楼板>1.75m 不入占用格 —— Bot 循门/楼梯使用底层, 玩家可上楼架枪 (与谷仓阁楼/教堂钟塔同约定)
function ruinBlock(x,z,ry,fw=12,fd=9){
const nF=wr(0,1)<0.42?3:2;
const f=foundation(x,z,ry,fw,fd);
const ctx=bctx(x,z,ry,f.floor);
const t=0.42, FH=2.9, hw=fw/2, hd=fd/2;
const wallMat=wr(0,1)<0.55?MAT.brick:MAT.plaster;
const carry=[];
const faces={front:[],back:[],east:[],west:[]}; // 同面墙按层归堆 → 竖向承重链 (毁下层, 上层随塌)
const blockSlabs=[]; // 楼板+楼梯坍塌链: 随塌顶一并碎块化 (沙箱断言"无浮空楼板/楼梯"据此走)
let topDeadIdx=wr(0,1)<0.7?Math.floor(wr(0,3.999)):-1; // 顶层预塌面 (0前 1后 2东侧 3西侧) —— 走种子流(勿用 randi: 那是 Math.random)
let wi=0;
for(let fl=0;fl<nF;fl++){
const y0=fl*FH;
const isTop=fl===nF-1;
const pre=isTop&&topDeadIdx===0;
// 窗位: 前后墙均布 (w=洞宽 1.4 —— 缺 w 会使 wallSeg 跨度 NaN, 2026-09-05 沙箱抓出)
const nWin=Math.max(2,Math.round((fw-4)/2.6));
const winOps=[];
for(let i=0;i<nWin;i++){
winOps.push({c:-hw+2+(i+0.5)*((fw-4)/nWin)+wr(-0.3,0.3),w:1.4,b:1.05,h:1.5,type:'win'});
}
const frontOps=fl===0
?[{c:fw>10.5?-hw+2.6:0,w:1.5,ht:2.2,h:0,type:'door'}].concat(
winOps.filter(op=>Math.abs(op.c-(fw>10.5?-hw+2.6:0))>1.8)) // 只留与门洞不重叠的窗 (重叠会使 wallSeg 在门洞里发窗台块)
:winOps;
// 前后墙 from/to 必须取全宽 ±hw (侧墙由 wallSeg 自动外伸 t 咬住前后墙中线) ——
// 2026-09-05 用户实机反馈: 旧写 ±(hw-t) 在四角留下 t/2 宽竖向透缝。
// g.wFloor=fl: 楼层承重标记 —— 任一层被掏空(该层剩≤1面)即整楼坍塌 (修"振金楼")
let g=wallSeg(ctx,{along:'x',at:hd,from:-hw,to:hw,y0,h:FH,t,mat:wallMat,destr:true,preDead:pre,ops:frontOps});
if(g){ carry.push(g); g.wFloor=fl; faces.front.push(g); }
g=wallSeg(ctx,{along:'x',at:-hd,from:-hw,to:hw,y0,h:FH,t,mat:wallMat,destr:true,preDead:isTop&&topDeadIdx===1,ops:winOps.slice(0,Math.max(1,nWin-1))});
if(g){ carry.push(g); g.wFloor=fl; faces.back.push(g); }
// 侧墙: 首层随机一侧开门 (街区小巷可穿), 其余窗
const sideDoor=fl===0&&wr(0,1)<0.6;
g=wallSeg(ctx,{along:'z',at:hw,from:-hd+t,to:hd-t,y0,h:FH,t,mat:wallMat,destr:true,
preDead:isTop&&topDeadIdx===2,
ops:sideDoor?[{c:0,w:1.4,ht:2.1,h:0,type:'door'}]:[{c:0,w:1.2,b:1.05,h:1.5,type:'win'}]});
if(g){ carry.push(g); g.wFloor=fl; faces.east.push(g); }
g=wallSeg(ctx,{along:'z',at:-hw,from:-hd+t,to:hd-t,y0,h:FH,t,mat:wallMat,destr:true,
preDead:isTop&&topDeadIdx===3,
ops:[{c:0,w:1.2,b:1.05,h:1.5,type:'win'}]});
if(g){ carry.push(g); g.wFloor=fl; faces.west.push(g); }
wi+=4;
// 楼板 (非顶层): 留楼梯井, 井位沿侧墙随层数左右交替
// slabRefs: 楼板挂进屋顶坍塌链 —— 塌顶时一并碎块化 (2026-09-05 修"拆光后楼板浮空")
if(!isTop){
const F1=(fl+1)*FH;
const sx=(fl%2===0?1:-1)*(hw-2.05);
// 井北缘必须贴梯末步 (梯末伸入楼板 0.12 消除登口断缝) —— 旧固定 -hd+1.3 使梯顶到楼板间
// 露出 2~5m 天井大洞 (2026-09-12 用户实机: "民房楼梯和地板之间巨大缝隙"), 登顶即坠回一层
const run=Math.max(2,Math.ceil(FH/0.42))*0.58;
const hz0=hd-1.5-run+0.12, hz1=hd-0.5;
const slabRefs=[];
const slab=(x0,x1,z0,z1)=>{
if(x1-x0<0.3||z1-z0<0.3) return;
const p=ctx.L((x0+x1)/2,(z0+z1)/2);
const b0=BOXES.length;
const m=solidBox(MAT.woodDark,x1-x0,0.22,z1-z0,p[0],f.floor+F1-0.11,p[1],ry);
slabRefs.push({m,b:BOXES.slice(b0)});
};
slab(-hw+0.2,sx-0.8,-hd+0.2,hd-0.2);
slab(sx+0.8,hw-0.2,-hd+0.2,hd-0.2);
slab(sx-0.8,sx+0.8,-hd+0.2,hz0);
slab(sx-0.8,sx+0.8,hz1,hd-0.2);
// 楼梯: 贴侧墙自前向后 (顶面与上层楼板齐平) —— 踏步挂入 blockSlabs 坍塌链 (2026-09-05 修"楼梯浮空")
stairFlight(ctx,{lx:sx,lz:hd-1.5,dir:'z-',width:1.25,base:f.floor+y0,topY:f.floor+F1,maxRise:0.42,tread:0.58,exit:[sx,-hd+0.9],parts:slabRefs});
blockSlabs.push(...slabRefs);
// 楼梯井护栏 (上层的井缘, 沿井两条长边)
}
}
// 屋顶: 低坡双坡顶 (工业坡顶), 承重墙链 —— 打穿两面墙全楼塌顶(楼板随塌)
// 竖向承重链: 同面墙自下而上链接 —— 毁掉下层一面墙, 正上方楼层同面墙随塌 (2026-09-05 修"二楼墙浮空")
for(const k in faces){
const a=faces[k];
for(let i=0;i<a.length-1;i++){ if(a[i]&&a[i+1]) a[i].wallAbove=a[i+1]; }
}
pitchedRoof(ctx,{axis:'x',w:fw,d:fd,y0:nF*FH,rise:1.05,mat:MAT.roof,gableMat:wallMat,over:0.4,t:0.42,wallGs:carry,slabs:blockSlabs});
// 底层杂物: 瓦砾块 (纯视觉 solidBox, 不进 PROPS —— 建筑足迹内道具会破坏互斥断言)
if(wr(0,1)<0.7){ const p=ctx.L(wr(-2,2),wr(-1,1)); mesh(boxGeo(wr(1,1.8),wr(0.5,0.9),wr(1,1.8)),MAT.rubble,p[0],f.floor+0.3,p[1],wr(0,3)); }
addCoverAround(x,z,fw,fd,ry);
coverPoints.push({x:ctx.L(-2,hd+2.2)[0],z:ctx.L(-2,hd+2.2)[1]});
BUILD_REG.push({type:'block',x,z,ry,w:fw,d:fd,floor:f.floor,doors:ctx.doors.slice(),roofY:f.floor+nF*FH+1.0});
const _reg=BUILD_REG[BUILD_REG.length-1];
for(const e of blockSlabs) for(const b of e.b) b.building=_reg; // 沙箱: 楼板归属标记
}
// ═══════════ 柏林沿街联排公寓 Mietskaserne (2026-09-09 加密批次) ═══════════
// 用户实机反馈"柏林城内太过于空荡": 旧 cityBlockRows 每街块只沿最近街缘落一排独立房, 四条街有三条空场。
// 排楼 = 连续街墙: 一栋 22~32m 长排楼提供 ≈3 栋独立房的沿街立面, 造价只有其 1/3 (共享山墙/屋面/承重链)。
// 空间逻辑核算 (局部 x=沿街长轴, z=进深; 层高 FH=2.9):
//   2~3 层 (屋面 5.8/8.7); 前墙沿街: 门洞按 ~14m 间距 (每门 NAV_CLEARS 通行区) + 窗带 (窗距≈3.4m, 门旁 1.9m 内不发窗);
//   后墙对庭院: 1~2 门 + 窗带; 山墙两端各 1 窗; 每层楼板留楼梯井 (井位逐层左右交替) + 贴井侧墙直跑楼梯;
//   墙体逐面可毁 (dBox) + 竖向承重链 (wallAbove) + 楼层掏空判定 (wFloor) + 坡顶挂 slabs 煎饼链
//   —— 与 ruinBlock 同一套坍塌机制 (沙箱断言 四角竖缝/梯道净高/煎饼 兼容; verify-buildings TT/MIDY 已登记 terrace)
function terrace(x,z,ry,fw,fd){
const nF=wr(0,1)<0.5?2:3;
const f=foundation(x,z,ry,fw,fd);
const ctx=bctx(x,z,ry,f.floor);
const t=0.42, FH=2.9, hw=fw/2, hd=fd/2;
const wallMat=wr(0,1)<0.5?MAT.brick:MAT.plaster;
const carry=[];
const faces={front:[],back:[],east:[],west:[]};
const blockSlabs=[];
// 门位: 沿街按 ~14m 间距 (柏林公寓每个门洞 = 一个门牌号); 庭院面 1~2 门
const nDoor=Math.max(1,Math.round(fw/14));
const doors=[];
for(let i=0;i<nDoor;i++) doors.push(-hw+(i+1)*fw/(nDoor+1));
const bdoors=nDoor>1?[-fw*0.26,fw*0.26]:[0];
// 窗带: 沿长轴均布, 门旁 1.9m 内不发窗 (与门洞重叠会让 wallSeg 在门洞里发窗台块)
const winRow=(dc)=>{
const nWin=Math.max(2,Math.round((fw-4)/3.4));
const out=[];
for(let i=0;i<nWin;i++){
const c=-hw+2+(i+0.5)*((fw-4)/nWin)+wr(-0.35,0.35);
if(dc.some(d=>Math.abs(c-d)<1.9)) continue;
out.push({c,w:1.4,b:1.05,h:1.5,type:'win'});
}
return out;
};
for(let fl=0;fl<nF;fl++){
const y0=fl*FH;
const isTop=fl===nF-1;
const pre=isTop&&wr(0,1)<0.16; // 顶层偶发预塌一面 (废墟感) —— 走种子流
// 前墙 (沿街)
const fops=fl===0?doors.map(c=>({c,w:1.5,ht:2.2,h:0,type:'door'})).concat(winRow(doors)):winRow([]);
let g=wallSeg(ctx,{along:'x',at:hd,from:-hw,to:hw,y0,h:FH,t,mat:wallMat,destr:true,preDead:pre,ops:fops});
if(g){ carry.push(g); g.wFloor=fl; faces.front.push(g); }
// 后墙 (庭院)
const bops=fl===0?bdoors.map(c=>({c,w:1.5,ht:2.2,h:0,type:'door'})).concat(winRow(bdoors)):winRow([]);
g=wallSeg(ctx,{along:'x',at:-hd,from:-hw,to:hw,y0,h:FH,t,mat:wallMat,destr:true,ops:bops});
if(g){ carry.push(g); g.wFloor=fl; faces.back.push(g); }
// 山墙 (两端, 与邻排隔巷对望)
for(const [sgn,key] of [[1,'east'],[-1,'west']]){
g=wallSeg(ctx,{along:'z',at:sgn*hw,from:-hd+t,to:hd-t,y0,h:FH,t,mat:wallMat,destr:true,
ops:[{c:0,w:1.2,b:1.05,h:1.5,type:'win'}]});
if(g){ carry.push(g); g.wFloor=fl; faces[key].push(g); }
}
// 楼板 + 楼梯 (与 ruinBlock 同构: 井位逐层左右交替, 楼梯贴井侧墙自前向后)
if(!isTop){
const F1=(fl+1)*FH;
const sx=(fl%2===0?1:-1)*(hw-2.05);
// 井北缘必须贴梯末步 (梯末伸入楼板 0.12 消除登口断缝) —— 旧固定 -hd+1.3 使梯顶到楼板间
// 露出 2~5m 天井大洞 (2026-09-12 用户实机: "民房楼梯和地板之间巨大缝隙"), 登顶即坠回一层
const run=Math.max(2,Math.ceil(FH/0.42))*0.58;
const hz0=hd-1.5-run+0.12, hz1=hd-0.5;
const slabRefs=[];
const slab=(x0,x1,z0,z1)=>{
if(x1-x0<0.3||z1-z0<0.3) return;
const p=ctx.L((x0+x1)/2,(z0+z1)/2);
const b0=BOXES.length;
const m=solidBox(MAT.woodDark,x1-x0,0.22,z1-z0,p[0],f.floor+F1-0.11,p[1],ry);
slabRefs.push({m,b:BOXES.slice(b0)});
};
slab(-hw+0.2,sx-0.8,-hd+0.2,hd-0.2);
slab(sx+0.8,hw-0.2,-hd+0.2,hd-0.2);
slab(sx-0.8,sx+0.8,-hd+0.2,hz0);
slab(sx-0.8,sx+0.8,hz1,hd-0.2);
stairFlight(ctx,{lx:sx,lz:hd-1.5,dir:'z-',width:1.25,base:f.floor+y0,topY:f.floor+F1,maxRise:0.42,tread:0.58,exit:[sx,-hd+0.9],parts:slabRefs});
blockSlabs.push(...slabRefs);
}
}
// 竖向承重链 + 坡顶 (同 ruinBlock: 打穿同层两面墙/掏空一层 → 整楼坍塌, 楼板随塌)
for(const k in faces){
const a=faces[k];
for(let i=0;i<a.length-1;i++){ if(a[i]&&a[i+1]) a[i].wallAbove=a[i+1]; }
}
pitchedRoof(ctx,{axis:'x',w:fw,d:fd,y0:nF*FH,rise:1.05,mat:MAT.roof,gableMat:wallMat,over:0.4,t:0.42,wallGs:carry,slabs:blockSlabs});
if(wr(0,1)<0.7){ const p=ctx.L(wr(-fw*0.3,fw*0.3),wr(-1,1)); mesh(boxGeo(wr(1,1.8),wr(0.5,0.9),wr(1,1.8)),MAT.rubble,p[0],f.floor+0.3,p[1],wr(0,3)); }
addCoverAround(x,z,fw,fd,ry);
coverPoints.push({x:ctx.L(-fw*0.25,hd+2.2)[0],z:ctx.L(-fw*0.25,hd+2.2)[1]},
{x:ctx.L(fw*0.25,hd+2.2)[0],z:ctx.L(fw*0.25,hd+2.2)[1]});
BUILD_REG.push({type:'terrace',x,z,ry,w:fw,d:fd,floor:f.floor,doors:ctx.doors.slice(),roofY:f.floor+nF*FH+1.0});
const _reg=BUILD_REG[BUILD_REG.length-1];
for(const e of blockSlabs) for(const b of e.b) b.building=_reg; // 沙箱煎饼断言: 楼板归属标记
}
// ═══════════ 柏林街墙废墟 Kulisse (2026-09-09 加密批次主力件) ═══════════
// 沿街仅存立面残墙 (2~3 层, 部分楼层开窗) + 端部返墙 + 墙脚塌落瓦砾 —— 造价 ≈ 排楼的 1/4,
// 却给出同样的街墙立面密度 (排楼只留少量做"可进入建筑")。
// 可毁: 逐层墙组 + 竖向承重链 (毁下层 → 上层同面随塌); 无屋顶 → 无塌顶链 (炸开即街墙豁口)
// 登记 d=0.5 (只覆盖墙厚) —— 沙箱"四角支撑"断言按真实足迹判, 不虚报 d=2 的空角
function facadeRuin(x,z,ry,fw){
const nF=wr(0,1)<0.35?2:3; // 三层为主 (街墙天际线)
const FH=2.9, t=0.55, hw=fw/2;
const mat=wr(0,1)<0.5?MAT.brick:MAT.plaster;
const cs=Math.cos(ry), sn=Math.sin(ry);
let g0=1e9; // 基高: 墙面三点最低地面 (残墙略沉入地, 坡地不悬空)
for(const lx of [-hw,0,hw]){ const px=x+lx*cs, pz=z-lx*sn; const h=heightAt(px,pz); if(h<g0) g0=h; }
const ctx=bctx(x,z,ry,g0+0.05);
const chain=[];
for(let fl=0;fl<nF;fl++){
const ops=[];
const doorC=hw*0.32;
if(fl===0) ops.push({c:doorC,w:1.6,ht:2.2,h:0,type:'door'});
if(wr(0,1)<0.78){ // 该层开窗 (其余楼层整面实墙 = 山墙残段); 门旁 2.1m 内不发窗 (重叠会在门洞里发窗台块堵门)
const nWin=Math.max(2,Math.round((fw-3)/5.2));
for(let i=0;i<nWin;i++){
const c=-hw+1.6+(i+0.5)*((fw-3.2)/nWin)+wr(-0.3,0.3);
if(fl===0&&Math.abs(c-doorC)<2.1) continue;
ops.push({c,w:1.3,b:0.95,h:1.6,type:'win'});
}
}
const g=wallSeg(ctx,{along:'x',at:0,from:-hw,to:hw,y0:fl*FH,h:FH,t,mat,destr:true,ops});
if(g) chain.push(g);
}
for(let i=0;i<chain.length-1;i++) chain[i].wallAbove=chain[i+1];
// 端部返墙 (~3.5m 折返, 给街墙一点体量; 独立承重不挂链)
const rw=3.5;
wallSeg(ctx,{along:'z',at:hw-t/2,from:-t/2,to:rw,y0:0,h:nF*FH,t:0.5,mat,destr:true,
ops:wr(0,1)<0.6?[{c:rw*0.5,w:1.1,b:0.95,h:1.4,type:'win'}]:[]});
// 墙脚塌落瓦砾
for(let i=0;i<3;i++){
const p=ctx.L(wr(-hw*0.75,hw*0.75),wr(0.6,2.2));
mesh(boxGeo(wr(0.8,1.6),wr(0.4,0.8),wr(0.8,1.6)),MAT.rubble,p[0],g0+0.3,p[1],wr(0,3));
}
coverPoints.push({x:ctx.L(-fw*0.25,1.2)[0],z:ctx.L(-fw*0.25,1.2)[1]},
{x:ctx.L(fw*0.25,1.2)[0],z:ctx.L(fw*0.25,1.2)[1]});
BUILD_REG.push({type:'facade',x,z,ry,w:fw,d:0.5,floor:g0,doors:ctx.doors.slice(),roofY:g0+nF*FH});
}
// 电车残骸 (斯大林格勒电车街): 车厢壳体可进入 —— 端门+侧窗射击带+塌陷顶盖;
// 全组一个可毁结构 (打爆→碎块化), 端门登记通行区 (Bot 可入内当掩体)
function tramWreck(x,z,ry){
if(!propFree(x,z,5.6)||!freeSpot(x,z,5.4)) return; // freeSpot: 避开建筑足迹
propTake(x,z,5.6);
// 地板=足迹四角+中心最高地面+0.02 (foundation 同规) —— 坡地上任何角都不悬空
const cs2=Math.cos(ry), sn2=Math.sin(ry);
let ghMax=-1e9;
for(const [ox,oz] of [[-1.5,-5.4],[1.5,-5.4],[1.5,5.4],[-1.5,5.4],[0,0]]){
const p2=[x+ox*cs2+oz*sn2, z-ox*sn2+oz*cs2];
const gh2=heightAt(p2[0],p2[1]);
if(gh2>ghMax) ghMax=gh2;
}
const fit={y:ghMax+0.02};
const ctx=bctx(x,z,ry,fit.y);
const H=2.55;
dBegin();
// 车架地板 (略抬 0.25, 转向架塌落)
let p=ctx.L(0,0);
dBox(MAT.metalDark,2.35,0.25,10,p[0],fit.y+0.125,p[1],ry);
// 两侧墙: 下裙板(0~0.95) + 上眉(1.8~H), 中带 0.95~1.8 = 射击带 (弹道/视线可穿)
for(const at of [1.175,-1.175]){
let q=ctx.L(at,0);
dBox(MAT.metalDark,0.18,0.95,10,q[0],fit.y+0.25+0.475,q[1],ry);
q=ctx.L(at,0);
dBox(MAT.metalDark,0.18,H-1.8,10,q[0],fit.y+0.25+1.8+(H-1.8)/2,q[1],ry);
}
// 端墙 ×2: 门净宽 1.3 (侧柱外缘与侧墙外缘齐平, 无角缝) + 门楣
// 2026-09-05 用户实机反馈: 旧版"门洞"实为 2.0m 实心箱把门堵死 —— 车厢根本进不去
for(const ez of [5,-5]){
let q=ctx.L(0.9575,ez);
dBox(MAT.metalDark,0.615,2.1,0.16,q[0],fit.y+0.25+1.05,q[1],ry);
q=ctx.L(-0.9575,ez);
dBox(MAT.metalDark,0.615,2.1,0.16,q[0],fit.y+0.25+1.05,q[1],ry);
q=ctx.L(0,ez);
dBox(MAT.metalDark,2.53,0.45,0.16,q[0],fit.y+0.25+2.325,q[1],ry);
}
// 顶盖 (塌陷: 一端略低)
p=ctx.L(0,0);
const rf=dBox(MAT.metalDark,2.5,0.2,10.2,p[0],fit.y+0.25+H+0.1,p[1],ry);
rf.rotation.z=wr(-0.06,0.06);
const g=dEnd();
if(g) g.hp=520;
// 转向架轮组 (纯视觉, 烧黑)
for(const wz of [-3.2,3.2]){
const q=ctx.L(0,wz);
for(const wx of [-0.85,0.85]){
mesh(new THREE.CylinderGeometry(0.42,0.42,0.24,9),MAT.metalDark,q[0]+wx*Math.cos(ry),fit.y+0.42,q[1]-wx*Math.sin(ry),ry);
}
}
// 端门通行区 (Bot 进出车厢)
for(const ez of [5.9,-5.9]){
const q=ctx.L(0,ez);
NAV_CLEARS.push({x:q[0],z:q[1],r:1.5});
}
coverPoints.push({x:x+Math.cos(ry)*2.2,z:z-Math.sin(ry)*2.2},{x:x-Math.cos(ry)*2.2,z:z+Math.sin(ry)*2.2});
BUILD_REG.push({type:'tramWreck',x,z,ry,w:2.6,d:10.5,floor:fit.y,doors:[],roofY:fit.y+H+0.3});
}
// 地铁入口亭 (柏林): 下沉广场(03-terrain 地形下沉)中的 U 形亭 —— 石墙平顶半地下掩体,
// 后墙门洞入, 前面敞口朝街; 亭内长椅+瓦砾 = 巷战经典"地铁口"据点
function metroPavilion(x,z,ry){
const f=foundation(x,z,ry,7,5.4);
const ctx=bctx(x,z,ry,f.floor);
const t=0.45,H=2.6;
const wallMat=MAT.stone;
const wallGs=[];
// 后墙: 门洞; 侧墙 ×2 敞口前 (+z 不设墙)
let g=wallSeg(ctx,{along:'x',at:-2.7,from:-2.7,to:2.7,h:H,t,mat:wallMat,destr:true,
ops:[{c:0,w:1.5,ht:2.1,h:0,type:'door'}]}); if(g)wallGs.push(g);
for(const at of [2.7,-2.7]){
g=wallSeg(ctx,{along:'z',at,from:-2.7+t,to:2.7-t,h:H,t,mat:wallMat,destr:true,ops:[]});
if(g)wallGs.push(g);
}
// 平顶 (实心挡弹) —— 手造 roofRef 挂三面墙组: 残余承重墙≤2 (3 墙毁 1) 即整体坍塌
// (2026-09-06 P1-2: 旧注释"与墙同组可毁"但无任何挂链机制, 墙炸光后石顶悬空 —— 全项目唯一漏网)
const rp=ctx.L(0,0);
const rbi=BOXES.length;
const roofM=solidBox(MAT.stone,7.6,0.34,6.0,rp[0],f.floor+H+0.17,rp[1],ry);
addSnowCap(roofM);
const roofRef={m:[roofM],bands:BOXES.slice(rbi),slabs:[],dead:0,done:false,carry:wallGs.filter(w=>w&&!w.dead)};
for(const g2 of roofRef.carry) g2.roofRef=roofRef;
// 亭内长椅 + 瓦砾块 (纯视觉, 不进 PROPS —— 足迹内道具会破坏互斥断言)
let p=ctx.L(1.4,-1.6);
solidBox(MAT.woodDark,1.8,0.5,0.5,p[0],heightAt(p[0],p[1])+0.25,p[1],ry);
if(wr(0,1)<0.8){ p=ctx.L(-1.6,0.8); mesh(boxGeo(wr(0.9,1.5),wr(0.45,0.8),wr(0.9,1.5)),MAT.rubble,p[0],f.floor+0.28,p[1],wr(0,3)); }
coverPoints.push({x:ctx.L(0,0.6)[0],z:ctx.L(0,0.6)[1]},{x:ctx.L(0,-3.6)[0],z:ctx.L(0,-3.6)[1]});
BUILD_REG.push({type:'metro',x,z,ry,w:7,d:5.4,floor:f.floor,doors:ctx.doors.slice(),roofY:f.floor+H+0.34});
for(const b2 of roofRef.bands) b2.building=BUILD_REG[BUILD_REG.length-1]; // 沙箱煎饼断言: 平顶归属标记
}
// 补给库 (破袭模式目标, 可被炸毁) —— 箱堆/沙袋/旗杆整体随朝向摆放
// 足迹已在 buildWorld 布局前预留(B_FOOT), 此处不再重复登记
function buildDepot(x,z,ry){
const rotL=(lx,lz)=>[x+lx*Math.cos(ry)+lz*Math.sin(ry), z-lx*Math.sin(ry)+lz*Math.cos(ry)];
let p;
dBegin();
p=rotL(-1.6,0.8); dBox(MAT.woodDark,2.6,1.7,1.7, p[0],heightAt(p[0],p[1])+0.85,p[1], ry);
p=rotL(1.4,-0.9); dBox(MAT.woodDark,2.2,1.3,1.5, p[0],heightAt(p[0],p[1])+0.65,p[1], ry+0.4);
p=rotL(0.4,1.6); dBox(MAT.wood,1.6,1.1,1.2, p[0],heightAt(p[0],p[1])+0.55,p[1], ry+0.9);
p=rotL(-0.4,-1.6); dBox(MAT.metalDark,1.4,1.5,1.4, p[0],heightAt(p[0],p[1])+0.75,p[1], ry);
const g=dEnd();
if(g) g.hp=720;
for(let i=0;i<3;i++){ p=rotL(wr(-3,3),wr(-3,3)); barrel(p[0],p[1]); }
p=rotL(3.6,0); sandbagWall(p[0],p[1],4,ry+HPI);
p=rotL(-3.6,0); sandbagWall(p[0],p[1],4,ry+HPI);
p=rotL(0,2.5);
const pole=mesh(new THREE.CylinderGeometry(0.06,0.08,5,6),MAT.metal,p[0],heightAt(p[0],p[1])+2.5,p[1]);
const cp1=rotL(4,2), cp2=rotL(-4,-2);
coverPoints.push({x:cp1[0],z:cp1[1]},{x:cp2[0],z:cp2[1]});
return g;
}
// ═══════════ 红十月工厂区 (斯大林格勒地标, 2026-09-05 用户选定) ═══════════
// 主厂房(可进可毁+天车走台) + 钢水包(爆炸物引爆→火区) + 烟囱 + 配炉房 + 围墙 + 铁轨支线/平板车皮
// 空间逻辑核算 (局部坐标, x=厂房长轴 28m, z=短轴 20m, 墙高 6.8m):
//   天车走台顶面 4.6m 与高窗带 4.8~6.3m 视线对齐(站立眼高 6.2 可越护栏 5.55 射出);
//   走台梁底 4.38m > 钢水包顶 2.2m / 人员 1.8m; 楼梯 11 步×0.55 进深 6.05m 顶步与走台齐平;
//   厂房内立柱 z=±0.8、吊罐位于中线 (中央通道有 bump, 2026-09-06 P2-17 口径修正: 旧"中央 z±2.2 无柱走廊"与实现不符), 钢坯垛排 z=±5.5, 机器贴墙 z=±8.7, 楼梯贴东/西墙 x∈12.4~13.75;
//   围墙四向豁口对齐铁轨支线(x=17 纵贯)与行人口; 平板车皮停支线上 (坦克不可碾)
function redOctober(x,z,ry){
const cs=Math.cos(ry),sn=Math.sin(ry);
const L=(lx,lz)=>[x+lx*cs+lz*sn, z-lx*sn+lz*cs];
// ── 主厂房: 28×20, 砖墙 6.8m, 东/西向 步兵大门 3.0×3.2, 南北墙高窗带 4.8~6.3 ──
const fw=28, fd=20, HW=14, HD=10, WH=6.8, wt=0.5;
const fp=L(0,0);
const f=foundation(fp[0],fp[1],ry,fw,fd);
const ctx=bctx(fp[0],fp[1],ry,f.floor);
const carry=[];
// 走台/楼板坍塌链 (随塌顶一并碎块化 —— 2026-09-05 修"厂房拆光后钢走台浮空")
const catRefs=[];
const catBox=(mat,w,h,d,lx,y,lz)=>{
const p=L(lx,lz);
const b0=BOXES.length;
const m=solidBox(mat,w,h,d,p[0],y,p[1],ry);
catRefs.push({m,b:BOXES.slice(b0)});
return m;
};
let g;
for(const sgn of [1,-1]){
g=wallSeg(ctx,{along:'z',at:sgn*HW,from:-HD+wt,to:HD-wt,h:WH,t:wt,mat:MAT.brick,destr:true,
ops:[{c:0,w:3.0,ht:3.2,h:0,type:'door'},{c:-6.2,w:1.7,b:4.8,h:1.5,type:'win'},{c:6.2,w:1.7,b:4.8,h:1.5,type:'win'}]});
// 工业厂房加固 (2026-09-06 用户反馈"炸两下就塌"): 墙组抗爆 950 (默认230) —— 坦克榴弹直击×4/面, 手雷×5/面; 撞击碾塌不受影响
if(g){ g.hp=950; carry.push(g); }
}
for(const sgn of [1,-1]){
// 长墙 from/to 取全宽 ±HW (侧墙由 wallSeg 自动外伸 t) —— 旧 ±(HW-wt) 四角留 wt/2 竖缝
g=wallSeg(ctx,{along:'x',at:sgn*HD,from:-HW,to:HW,h:WH,t:wt,mat:MAT.brick,destr:true,
ops:[{c:-8.5,w:1.7,b:4.8,h:1.5,type:'win'},{c:-2.8,w:1.7,b:4.8,h:1.5,type:'win'},{c:2.8,w:1.7,b:4.8,h:1.5,type:'win'},{c:8.5,w:1.7,b:4.8,h:1.5,type:'win'}]});
if(g){ g.hp=950; carry.push(g); }
}
// 屋顶: 低坡双坡(脊沿长轴) + 砖山墙 —— 打穿两面承重墙即整体坍塌(走台随塌; 墙组抗爆 950, 见上)
pitchedRoof(ctx,{axis:'x',w:fw,d:fd,y0:WH,rise:2.1,mat:MAT.roof,gableMat:MAT.brick,over:0.5,t:wt,wallGs:carry,slabs:catRefs});
// ── 天车走台: 顶面 4.6m, 板宽 2.3 (z±1.15), 端部 L 形平台接楼梯; 护栏 0.95 高留楼梯豁口 ──
// (立柱无坍塌链: 厂房塌顶后钢柱留存 = 工业废墟常态; 走台/护栏全部随塌)
const deckY=4.6;
for(const sx of [-10.5,10.5]) for(const sz of [-0.8,0.8]){
const p=L(sx,sz);
mesh(new THREE.CylinderGeometry(0.15,0.18,deckY,8),MAT.metalDark,p[0],f.floor+deckY/2,p[1]);
CYLS.push({x:p[0],z:p[1],r:0.17,y0:f.floor,y1:f.floor+deckY});
}
catBox(MAT.metalDark,24.8,0.22,2.3,0,f.floor+deckY-0.11,0);
for(const sgn of [1,-1]){
// 端部 L 平台: x 12.4~13.75, z -1.15~3.0 (贴墙无缝隙), 顶面与走台齐平
catBox(MAT.metalDark,1.35,0.22,4.15,sgn*13.075,f.floor+deckY-0.11,0.925);
}
// 护栏: 南缘全 span, 北缘整段 (两端 L 平台区即楼梯豁口, 无需断开)
catBox(MAT.metalDark,27.5,0.95,0.1,0,f.floor+deckY+0.475,-1.15);
catBox(MAT.metalDark,24.8,0.95,0.1,0,f.floor+deckY+0.475,1.15);
// 楼梯 ×2: 贴东/西墙内侧 (宽 1.35, 进深 6.05), 顶步 4.6 与 L 平台齐平 —— 踏步挂 catRefs 坍塌链
for(const sgn of [1,-1]){
stairFlight(ctx,{lx:sgn*13.075,lz:9.0,dir:'z-',width:1.35,base:f.floor,topY:f.floor+deckY,maxRise:0.42,tread:0.55,exit:[sgn*13.075,2.6],parts:catRefs});
}
// 走台掩体点 (Bot 在厂内底层时可循此驻位)
{ const dp=L(0,0); coverPoints.push({x:dp[0],z:dp[1]}); }
// ── 厂内设备: 钢坯垛两排 (z=±5.5) + 机器贴墙 (z=±8.7) + 钢水包 (中廊 z=0) ──
for(const sz of [-5.5,5.5]) for(let i=0;i<4;i++){
const p=L(-9+i*4.5+wr(-0.3,0.3),sz+wr(-0.2,0.2));
ingotStack(p[0],p[1],ry);
}
for(const sz of [-8.7,8.7]) for(const sx of [-5,5]){
const p=L(sx,sz);
machineBlock(p[0],p[1],ry+wr(-0.1,0.1));
}
for(const sx of [-6.5,6.5]){
const p=L(sx,0);
factoryLadle(p[0],p[1]);
}
// ── 烟囱 (厂房东北角外, 高 15): 全图最高点, 炮兵参照物 (局部 (20,-24): 与专用线 x=17 净距同旧版 0.75) ──
const cp=L(20,-24);
const cg0=heightAt(cp[0],cp[1]);
mesh(new THREE.CylinderGeometry(1.15,1.5,15,10),MAT.brick,cp[0],cg0+7.5,cp[1]);
mesh(new THREE.CylinderGeometry(1.3,1.2,0.6,10),MAT.stone,cp[0],cg0+15.1,cp[1]);
CYLS.push({x:cp[0],z:cp[1],r:1.5,y0:cg0,y1:cg0+15});
// ── 配炉房 (厂房北侧, 9×7 废墟壳; 局部 (-10,-26): 让开西停车场坦克位净距 ≥4m) ──
const bp=L(-10,-26);
ruinedHouse(bp[0],bp[1],9,7,ry+wr(-0.08,0.08),MAT.brick,0.62);
// ── 铁轨支线 (x=17 纵贯厂区, 轨面贴地无碰撞) + 平板车皮 ×2 (坦克不可碾) ──
for(let zz=-30;zz<28;zz+=4){
const p=L(17,zz+2);
const g0=heightAt(p[0],p[1]);
mesh(boxGeo(0.12,0.1,4),MAT.metalDark,p[0]-0.75*Math.cos(ry),g0+0.05,p[1]+0.75*Math.sin(ry),ry,false,true);
mesh(boxGeo(0.12,0.1,4),MAT.metalDark,p[0]+0.75*Math.cos(ry),g0+0.05,p[1]-0.75*Math.sin(ry),ry,false,true);
mesh(boxGeo(0.5,0.14,3.4),MAT.woodDark,p[0],g0+0.02,p[1],ry,false,true);
}
for(const fz of [-18,-6]){
const p=L(17,fz);
const fit=groundFit(p[0],p[1],ry,1.6,3.9);
solidBox(MAT.metalDark,3.0,1.25,7.5,p[0],fit.y+0.85,p[1],ry); // 车皮 (无 crush: 坦克不可碾)
for(const wz of [-2.6,2.6]){
const q=L(17,fz+wz);
const wh=new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.4,2.6,9),MAT.metalDark);
wh.position.set(q[0],fit.y+0.4,q[1]);
wh.rotation.order='YXZ';
wh.rotation.y=ry; wh.rotation.z=HPI; // 轮轴沿厂房长轴垂直方向 (车皮纵轴)
wh.castShadow=true;
world.add(wh);
}
coverPoints.push({x:p[0]+cs*2.4,z:p[1]-sn*2.4},{x:p[0]-cs*2.4,z:p[1]+sn*2.4});
}
// ── 厂区围墙 (砖 h2.3, 沿四向, 全部经 L() 随 (x,z,ry) 落位 —— 2026-09-06 点位改版: 厂区北移至
//    yard{-19,-125,63,-55} (82×70, 局部 x±41/z±35), 围墙不再写死世界坐标);
//    豁口: 南墙 局部x[-38,-24] 车辆大门14m (world x[-16,-2] 正对 V2 纵街 = 厂内坦克出场通道)
//          + 局部x[15,19] 铁轨 (world x[37,41] 与专用线居中对位);
//    北墙 局部x[15,19] 铁轨; 东墙 局部z[22,26] 铁轨 (world z[-68,-64] 对编组站岔线 z=-66);
//    西墙 局部z[-4,2] 行人 ──
stoneWall(...L(-41,-35),...L(15,-35),2.3); stoneWall(...L(19,-35),...L(41,-35),2.3);
stoneWall(...L(-41,35),...L(-38,35),2.3); stoneWall(...L(-24,35),...L(15,35),2.3); stoneWall(...L(19,35),...L(41,35),2.3);
stoneWall(...L(41,-35),...L(41,22),2.3); stoneWall(...L(41,26),...L(41,35),2.3);
stoneWall(...L(-41,-35),...L(-41,-4),2.3); stoneWall(...L(-41,2),...L(-41,35),2.3);
// 车辆大门通行带: 门前 (局部 z 35→40 即 world z -55→-50) 强制清占用格, 保证 AI 坦克出厂走廊
for(const lz of [38,33]){
const p=L(-31,lz);
NAV_CLEARS.push({x:p[0],z:p[1],r:2.6});
}
// ── 防护夹墙 (2026-09-06 用户指定: 朝德军主基的西/南两面加一层无法破坏的墙, 护厂内重生坦克) ──
// 空间账 (局部坐标, 均相对 L()):
//   西外墙 x=-43.5 (砖墙外 2.5m), 长 81m (z -35..46) —— 只到停车场北端与西南角为止, 北/东两面不设;
//   南外墙 z=+46 (砖墙外 11m), 长 47.5m (x -43.5..4) —— 东端止于 x=4, 厂房东南面保持单墙;
//   两墙在南西角闭合, 与砖墙之间围出 11m 深前坪 (x -41..41) —— 重生坦克出内门南行 11m → 前坪
//   东转 ~22m → 出外门, 全程宽 45m/深 11m, 多车错车有余量 (用户要求: 墙长度有限防墙内堵车);
//   火线账: 外门 (局部 x -14..1) 与内门 (x -38..-24) 错位 24m → V2 街方向直射视线止于南外墙,
//   从外门向内看只能看到前坪东段与砖墙墙面, 看不到内门后的停车场 (几何上被错位挡死);
//   西外墙行人豁口 (局部 z 20..25) 与砖墙西内门 (z -4..2) 错位 24m → 夹巷 2.5m 只容步兵 Z 字通行。
// 材质: 实心 solidBox, 不入 dGroup (炮弹不可毁) 且不给 crush (坦克不可碾) —— "无法破坏"。
{
const wl=(pts)=>{ // 沿墙取多点采样最低地面 (墙略沉入地, 防斜坡悬空)
let g=1e9;
for(const [lx,lz] of pts){ const p=L(lx,lz); g=Math.min(g,heightAt(p[0],p[1])); }
return g;
};
// 西外墙两段 (行人豁口 局部 z 20..25): z -35..20 (长 55) / z 25..46 (长 21)
{
const g0=wl([[-43.5,-35],[-43.5,-7],[-43.5,20]]);
solidBox(MAT.stone,0.6,3.0,55,L(-43.5,-7.5)[0],g0+1.4,L(-43.5,-7.5)[1],0);
const g1=wl([[-43.5,25],[-43.5,35],[-43.5,46]]);
solidBox(MAT.stone,0.6,3.0,21,L(-43.5,35.5)[0],g1+1.4,L(-43.5,35.5)[1],0);
}
// 南外墙两段 (车辆外门 局部 x -14..1 = world 8..23): x -43.5..-14 (长 29.5) / x 1..4 (长 3)
{
const g2=wl([[-43.5,46],[-28,46],[-14,46]]);
solidBox(MAT.stone,29.5,3.0,0.6,L(-28.75,46)[0],g2+1.4,L(-28.75,46)[1],0);
const g3=wl([[1,46],[4,46]]);
solidBox(MAT.stone,3,3.0,0.6,L(2.5,46)[0],g3+1.4,L(2.5,46)[1],0);
}
// 出车走廊 NAV 通行带: 内门→前坪→东转→外门→南出口
for(const [lx,lz,r] of [[-8,40,3.2],[4,40.5,3.2],[-6,48,3.2],[-6,52,3.2]]){
const p=L(lx,lz);
NAV_CLEARS.push({x:p[0],z:p[1],r});
}
}
// 厂区角落杂物/弹坑
{ const p=L(8,14); if(freeSpot(p[0],p[1],1.5)) rubblePile(p[0],p[1],1.8); }
{ const p=L(-8,18); if(freeSpot(p[0],p[1],2)) crater(p[0],p[1],2.2); }
{ const p=L(19,10); factoryLadle(p[0],p[1]); } // 厂区东货场钢水包 (专用线 x=17 侧, 与平板车净距 16m)
// 厂区整体足迹 (世界坐标 AABB 随 ry) —— 此后ammo箱/火力点/杂物不再落入围墙内的建筑区与坦克停车场:
//   主厂房足迹 32×24 (含门厅散水) + 西停车场足迹 24×54 (苏军战损坦克出生双列×4 位, 防杂物落位)
B_FOOT.push(footRect(...L(0,0),ry,32,24,1.0));
B_FOOT.push(footRect(...L(-30,0),ry,24,54,1.0));
BUILD_REG.push({type:'factory',x:fp[0],z:fp[1],ry,w:fw,d:fd,floor:f.floor,doors:ctx.doors.slice(),roofY:f.floor+WH+2.0});
const _freg=BUILD_REG[BUILD_REG.length-1];
for(const e of catRefs) for(const b of e.b) b.building=_freg; // 沙箱: 走台归属标记
}
// 钢水包: 爆炸物引爆 (手雷/火箭筒/坦克炮/迫击炮, 子弹只出火花 —— 与可毁墙同规则)
// 摧毁 → 大爆炸 + 原地火区 6s (复用燃烧弹火格系统, Bot 自带火情规避会绕开)
// 2026-09-05 用户实机反馈"看不出是谁" → 重做可读外形: 支承框架+锈红锥台包体+包沿+包嘴+
// 炽亮钢水面/出钢流 (MeshBasic 自发光橙, 不受光照, 远处一眼可辨); 高 3.1m 越过钢坯垛可见
const ladlePot=new THREE.MeshLambertMaterial({color:0x7c4a30,map:TEX.grime});
const ladleGlow=new THREE.MeshBasicMaterial({color:0xff7a26});
function factoryLadle(x,z){
if(!propFree(x,z,1.6)) return;
propTake(x,z,1.6);
const g0=heightAt(x,z);
const ry=wr(0,TAU);
const dx2=Math.cos(ry), dz2=-Math.sin(ry);
dBegin();
// 支承框架: 4 腿 + 承台 + 锁圈
for(const [ox,oz] of [[-0.8,-0.8],[0.8,-0.8],[-0.8,0.8],[0.8,0.8]]){
dBox(MAT.metalDark,0.18,1.15,0.18,x+ox,g0+0.575,z+oz,ry);
}
dBox(MAT.metalDark,2.2,0.14,2.2,x,g0+1.22,z,ry);
// 包体 (下大上小两段锥台感) + 包沿环
dBox(ladlePot,1.8,1.05,1.8,x,g0+1.865,z,ry);
dBox(ladlePot,1.45,0.5,1.45,x,g0+2.64,z,ry);
dBox(MAT.metalDark,2.05,0.24,2.05,x,g0+3.01,z,ry);
// 包嘴 (斜伸) + 出钢流 (炽亮)
dBox(ladlePot,0.95,0.38,0.55,x+dx2*1.3,g0+2.55,z+dz2*1.3,ry);
dBox(ladleGlow,0.26,0.85,0.26,x+dx2*1.62,g0+1.9,z+dz2*1.62,ry);
// 钢水面 (包沿内炽亮橙 —— 远处可见)
dBox(ladleGlow,1.15,0.08,1.15,x,g0+3.06,z,ry);
const g=dEnd();
if(g){ g.hp=300; g.onDead=()=>{ explodeAt(V3(x,g0+1.4,z),null); igniteArea(x,z,3.4,null,6); }; }
coverPoints.push({x:x+1.8,z},{x:x-1.8,z});
}
// ═══════════ 柏林地标 ①: 国会大厦 (2026-09-09 用户定案) ═══════════
// 空间逻辑核算 (局部坐标: 主楼 x±17 / z±12, 南向柱廊外伸至 z≈15, 整体足迹 34×30):
//   两层 4.4+4.2 → 屋面 8.6, 女儿墙顶 9.7; 南向柱廊 8 柱 h8.6 (柱距 4m) + 檐部 8.6~9.7 与女儿墙同高;
//   穹顶鼓座 r6.5 h5.0 立于屋面 (8.6~13.6), 南向留 5.6m 洞口可入圆厅; 残穹壳视觉件顶 ≈19.1m (全图最高, 超红十月烟囱 15m);
//   东墙双跑梯: 一跑 0→4.4 (11 步×0.40, 进深 6.6) 井口 x[12.2,16.2]z[-4.9,-1.6]; 二跑 4.4→8.6 (10 步×0.42) 北段,
//   屋面开洞 x[12.2,16.2]z[1.9,5.2] —— 顶步顶面=屋面 8.6 严格齐平, 落点 (14.2,1.5) 支撑面=屋面板顶, 全程净高≥1.7;
//   窗: 前后墙 ±5/±10/±15 (w2.4), 侧墙 ±4/±9 (w2.2); 门: 南面主门 3.4×3.6 + 两侧门 1.8×2.6;
//   ★ 不可破坏 (2026-09-09 用户定案): 旧版挂坍塌链, 但穹顶鼓座之上的残穹壳是纯视觉件 (不在任何链里) ——
//     全楼塌光后残穹壳浮空。用户裁决"不管这个, 把国会大厦设为无法破坏": 墙/鼓座/屋面板全部改永久件
//     (destr:false + 无 dGroup), 建筑可进/可上屋顶, 但打不烂 —— 地标恒存, 浮空问题从根上不存在。
//     柱廊石柱、屋面板、楼板、楼梯均为永久件 (废墟残柱语义取消, 全楼永久)
function reichstag(x,z,ry){
const fw=34, fd=24, hw=fw/2, hd=fd/2;
const f=foundation(x,z,ry,fw,fd,{maxDh:1.8});
const ctx=bctx(x,z,ry,f.floor);
const t=0.6, FH=4.4, H2=4.2, RT=FH+H2, parH=1.1;
const wallMat=MAT.stone;
const mkWall=(at,along,from,to,y0,h,ops)=>{
wallSeg(ctx,{along,at,from,to,y0,h,t,mat:wallMat,destr:false,ops});
};
const winsF=b=>[-15,-10,-5,5,10,15].map(c=>({c,w:2.4,b,h:2.6,type:'win'}));
const winsS=b=>[-9,-4,4,9].map(c=>({c,w:2.2,b,h:2.6,type:'win'}));
// ── 一层 (0~4.4) ──
mkWall(hd,'x',-hw,hw,0,FH,[{c:0,w:3.4,ht:3.6,h:0,type:'door'}].concat(winsF(1.2)));
mkWall(-hd,'x',-hw,hw,0,FH,[{c:0,w:2.4,b:1.2,h:2.6,type:'win'}].concat(winsF(1.2)));
mkWall(hw,'z',-hd+t,hd-t,0,FH,[{c:0,w:1.8,ht:2.6,h:0,type:'door'}].concat(winsS(1.2)));
mkWall(-hw,'z',-hd+t,hd-t,0,FH,[{c:0,w:1.8,ht:2.6,h:0,type:'door'}].concat(winsS(1.2)));
// ── 二层 (4.4~8.6): 南面中央窗 (柱廊内侧) + 其余窗 ──
mkWall(hd,'x',-hw,hw,FH,H2,[{c:0,w:2.4,b:1.1,h:2.6,type:'win'}].concat(winsF(1.1)));
mkWall(-hd,'x',-hw,hw,FH,H2,[{c:0,w:2.4,b:1.1,h:2.6,type:'win'}].concat(winsF(1.1)));
mkWall(hw,'z',-hd+t,hd-t,FH,H2,winsS(1.1));
mkWall(-hw,'z',-hd+t,hd-t,FH,H2,winsS(1.1));
// ── 柱廊: 8 根石柱 (永久件) + 檐部 (挂 bands) ──
for(const lx of [-14,-10,-6,-2,2,6,10,14]){
const p=ctx.L(lx,hd+1.4);
const g0=heightAt(p[0],p[1]);
mesh(new THREE.CylinderGeometry(0.55,0.62,f.floor+RT-g0,12),MAT.stone,p[0],(g0+f.floor+RT)/2,p[1]);
CYLS.push({x:p[0],z:p[1],r:0.62,y0:g0,y1:f.floor+RT});
}
const slab=(w,h,d,lx,y,lz)=>{
const p=ctx.L(lx,lz);
return solidBox(wallMat,w,h,d,p[0],y,p[1],ry);
};
slab(32,1.1,3.0,0,f.floor+RT+0.55,hd+1.4); // 檐部顶面 9.7 = 女儿墙同高
// ── 屋面板 (留东侧楼梯井 x[12.2,16.2]z[1.9,4.9]) + 女儿墙 ──
const RTy=f.floor+RT-0.175;
slab(29.5,0.35,24.6,-2.55,RTy,0);
slab(5.1,0.35,14.2,14.75,RTy,-5.2);
slab(5.1,0.35,7.1,14.75,RTy,8.75);
for(const [w,d,lx,lz] of [[35.4,0.35,0,-12.3],[35.4,0.35,0,12.3],[0.35,25.0,-17.3,0],[0.35,25.0,17.3,0]]){
slab(w,parH,d,lx,f.floor+RT+parH/2,lz);
}
// ── 二层楼板 (留一跑楼梯井 x[12.2,16.2]z[-4.9,-1.6]) ──
const F2=f.floor+FH;
const f2slab=(x0,x1,z0,z1)=>{
const p=ctx.L((x0+x1)/2,(z0+z1)/2);
solidBox(MAT.woodDark,x1-x0,0.22,z1-z0,p[0],F2-0.11,p[1],ry);
};
f2slab(-16.9,12.2,-11.9,11.9);
f2slab(12.2,16.9,-11.9,-4.9);
f2slab(12.2,16.9,-1.6,11.9);
// ── 双跑楼梯 (东墙 x14.2 同轴): 一跑自南向北 0→4.4, 二跑自北向南 4.4→8.6 ──
stairFlight(ctx,{lx:14.2,lz:-8.2,dir:'z+',width:1.6,base:f.floor,topY:F2,maxRise:0.42,tread:0.6,exit:[14.2,-1.2]});
stairFlight(ctx,{lx:14.2,lz:8.2,dir:'z-',width:1.6,base:F2,topY:f.floor+RT,maxRise:0.42,tread:0.605,exit:[14.2,1.5]});
// ── 穹顶鼓座 (12 段, 南向留 5.6m 洞口; 永久件 —— 不可破坏) + 残穹壳视觉件 ──
for(let k=0;k<14;k++){
if(k===3||k===4) continue;
const a=k*TAU/14;
const px=Math.cos(a)*6.5, pz=Math.sin(a)*6.5;
const p=ctx.L(px,pz);
solidBox(wallMat,0.5,5.0,3.05,p[0],f.floor+RT+2.5,p[1],ry-a);
}
const dp=ctx.L(0,0);
mesh(new THREE.CylinderGeometry(6.9,6.9,0.4,16),MAT.stone,dp[0],f.floor+RT+5.2,dp[1]);
mesh(new THREE.CylinderGeometry(6.6,2.4,2.8,16),MAT.stone,dp[0],f.floor+RT+6.8,dp[1]);
mesh(new THREE.CylinderGeometry(2.4,2.4,0.9,12),MAT.stone,dp[0],f.floor+RT+8.6,dp[1]);
mesh(new THREE.ConeGeometry(2.4,1.5,12),MAT.roof,dp[0],f.floor+RT+9.8,dp[1]);
// ── 内部: 4 根承重石柱 (视觉+圆柱碰撞) + 一层瓦砾 ──
for(const [lx,lz] of [[-8,-6],[8,-6],[-8,6],[8,6]]){
const p=ctx.L(lx,lz);
const g0=heightAt(p[0],p[1]);
mesh(new THREE.CylinderGeometry(0.5,0.55,F2-g0,10),MAT.stone,p[0],(g0+F2)/2,p[1]);
CYLS.push({x:p[0],z:p[1],r:0.55,y0:g0,y1:F2});
}
if(wr(0,1)<0.75){ const p=ctx.L(wr(-6,6),wr(-6,6)); mesh(boxGeo(wr(1,2),wr(0.5,1.0),wr(1,2)),MAT.rubble,p[0],f.floor+0.35,p[1],wr(0,3)); }
// ── 收口 (不可破坏: 无坍塌链/无 roofRef; 屋面板/女儿墙/鼓座/楼板/楼梯全部永久件) ──
addCoverAround(x,z,fw,fd,ry);
coverPoints.push({x:ctx.L(0,hd+2.2)[0],z:ctx.L(0,hd+2.2)[1]});
BUILD_REG.push({type:'reichstag',x,z,ry,w:fw,d:fd,floor:f.floor,doors:ctx.doors.slice(),roofY:f.floor+RT,indestr:true});
}
// ═══════════ 柏林地标 ②: 防空塔 (2026-09-09 用户定案) ═══════════
// 空间逻辑核算 (14×14 混凝土塔, 局部 x/z±7):
//   两层 (层高 4.6): 一层 0~4.6 (南面门 1.6×2.6 + 三面射击孔), 二层 4.6~9.2 (四面射击孔), 屋顶平台 9.2 (女儿墙顶 10.4);
//   塔内双跑梯: 西侧 0→4.6 (11 步×0.42, 进深 6.05) 井口 x[-5.4,-3.6]z[-0.75,2.6]; 东侧 4.6→9.2 同规格北段,
//   屋面开洞 x[0.6,2.4]z[2.6,5.9] —— 顶步顶面=平台面 9.2 严格齐平, 落点 (1.5,6.2) 支撑面=顶板面, 头顶净高≥1.7;
//   屋顶平台中心偏南架 88 高炮 (FLAK_DECKS → 17-emplacements aaGun yDeck) —— 平台 9.2m = 半场制高点;
//   坍塌链同 ruinBlock: 8 面墙组 (2 层×4 面, wFloor 0/1 + wallAbove) + 手造 roofRef (顶板/女儿墙/楼板/楼梯挂牌)
const FLAK_DECKS=[]; // 塔顶平台登记 (17-emplacements 读取并架设可操作高炮)
function flakTower(x,z,ry){
const f=foundation(x,z,ry,14,14,{maxDh:1.6});
const ctx=bctx(x,z,ry,f.floor);
const t=0.7, FH=4.6, hw=7, hd=7, RT=FH*2, parH=1.2;
const wallMat=MAT.stone;
const carry=[], faces={front:[],back:[],east:[],west:[]}, chain=[];
const mkWall=(at,along,from,to,y0,h,ops,faceKey,fl)=>{
const g=wallSeg(ctx,{along,at,from,to,y0,h,t,mat:wallMat,destr:true,ops});
if(g){ carry.push(g); g.wFloor=fl; faces[faceKey].push(g); }
};
const slit={c:0,w:1.4,b:1.05,h:0.5,ht:FH};
// ── 一层 (0~4.6): 南面门 + 三面射击孔 ──
mkWall(hd,'x',-hw,hw,0,FH,[{c:0,w:1.6,ht:2.6,h:0,type:'door'},{c:-4,w:1.4,b:1.05,h:0.5,ht:FH},{c:4,w:1.4,b:1.05,h:0.5,ht:FH}],'front',0);
mkWall(-hd,'x',-hw,hw,0,FH,[slit],'back',0);
mkWall(hw,'z',-hd+t,hd-t,0,FH,[slit],'east',0);
mkWall(-hw,'z',-hd+t,hd-t,0,FH,[slit],'west',0);
// ── 二层 (4.6~9.2): 四面射击孔 ──
mkWall(hd,'x',-hw,hw,FH,FH,[{c:0,w:1.6,b:1.0,h:0.6,ht:FH},{c:-4,w:1.4,b:1.0,h:0.6,ht:FH},{c:4,w:1.4,b:1.0,h:0.6,ht:FH}],'front',1);
mkWall(-hd,'x',-hw,hw,FH,FH,[{c:0,w:1.6,b:1.0,h:0.6,ht:FH},{c:-4,w:1.4,b:1.0,h:0.6,ht:FH},{c:4,w:1.4,b:1.0,h:0.6,ht:FH}],'back',1);
mkWall(hw,'z',-hd+t,hd-t,FH,FH,[{c:0,w:1.6,b:1.0,h:0.6,ht:FH},{c:-4,w:1.4,b:1.0,h:0.6,ht:FH},{c:4,w:1.4,b:1.0,h:0.6,ht:FH}],'east',1);
mkWall(-hw,'z',-hd+t,hd-t,FH,FH,[{c:0,w:1.6,b:1.0,h:0.6,ht:FH},{c:-4,w:1.4,b:1.0,h:0.6,ht:FH},{c:4,w:1.4,b:1.0,h:0.6,ht:FH}],'west',1);
// ── 二层楼板 (留西侧楼梯井) + 屋顶平台 (留东侧楼梯井) ──
const F2=f.floor+FH;
const slab=(x0,x1,z0,z1,y,mat,thick)=>{
const p=ctx.L((x0+x1)/2,(z0+z1)/2);
const b0=BOXES.length;
const m=solidBox(mat,x1-x0,thick,z1-z0,p[0],y-thick/2,p[1],ry);
chain.push({m,b:BOXES.slice(b0)});
return m;
};
slab(-6.3,6.3,-6.3,-0.75,F2,MAT.woodDark,0.25);
slab(-6.3,-5.4,-0.75,6.3,F2,MAT.woodDark,0.25);
slab(-5.4,-3.6,2.6,6.3,F2,MAT.woodDark,0.25);
slab(-3.6,6.3,-0.75,6.3,F2,MAT.woodDark,0.25);
// ── 双跑楼梯 (西侧自南向北 0→4.6; 东侧自北向南 4.6→9.2) ──
stairFlight(ctx,{lx:-4.5,lz:5.6,dir:'z-',width:1.5,base:f.floor,topY:F2,maxRise:0.42,tread:0.55,exit:[-4.5,-1.1],parts:chain});
stairFlight(ctx,{lx:1.5,lz:-0.45,dir:'z+',width:1.5,base:F2,topY:f.floor+RT,maxRise:0.42,tread:0.55,exit:[1.5,6.2],parts:chain});
// ── 屋顶平台 (留东侧井 x[0.6,7.3]z[2.0,5.9]; 井南沿 2.0 = 梯道净高断言下界) + 女儿墙 ──
const roofM=[];
const rslab=(x0,x1,z0,z1,y,thick)=>{
const p=ctx.L((x0+x1)/2,(z0+z1)/2);
const m=solidBox(MAT.stone,x1-x0,thick,z1-z0,p[0],y-thick/2,p[1],ry);
roofM.push(m); return m;
};
const rbi=BOXES.length;
rslab(-7.3,0.6,-7.3,7.3,f.floor+RT,0.4);
rslab(0.6,7.3,-7.3,2.0,f.floor+RT,0.4);
rslab(0.6,7.3,5.9,7.3,f.floor+RT,0.4);
for(const [w,d,lx,lz] of [[14.6,0.35,0,-7.3],[14.6,0.35,0,7.3],[0.35,14.6,-7.3,0],[0.35,14.6,7.3,0]]){
rslab(lx-w/2,lx+w/2,lz-d/2,lz+d/2,f.floor+RT+parH,parH);
}
// ── 承重链收口 + 顶板带 ──
for(const k in faces){
const a=faces[k];
for(let i=0;i<a.length-1;i++){ if(a[i]&&a[i+1]) a[i].wallAbove=a[i+1]; }
}
const ref={m:roofM,bands:BOXES.slice(rbi),slabs:chain,dead:0,done:false,carry:carry.filter(w=>w&&!w.dead)};
for(const g2 of ref.carry) g2.roofRef=ref;
const gp=ctx.L(0,3.2); // 平台南半 (朝向主攻方向)
FLAK_DECKS.push({x:gp[0],z:gp[1],y:f.floor+RT});
addCoverAround(x,z,14,14,ry);
coverPoints.push({x:ctx.L(0,0)[0],z:ctx.L(0,0)[1]});
BUILD_REG.push({type:'flaktower',x,z,ry,w:14,d:14,floor:f.floor,doors:ctx.doors.slice(),roofY:f.floor+RT+parH});
const _kreg=BUILD_REG[BUILD_REG.length-1];
for(const e of chain) for(const b of (e.b||[])) b.building=_kreg;
}
// ═══════════ 柏林地铁网: 两站一区间 (2026-09-09 用户定案) ═══════════
// 空间逻辑核算 (轴对齐, 坐标只读 CAMPAIGN.city.metro.halls/tunnel —— 严禁另写一套):
//   站厅 26×18 (x -68..-42) 下沉 2.6m 开口见天 = 站厅庭院; 四周挡土墙 0.6 厚
//   (墙顶 = 四周 1.2m 外地面最高点 + 0.15 —— 地形起伏时不埋进地面; 墙脚埋过最低坑底);
//   区间隧道 6×84 (x -68..-62, z -70..14) 下沉 2.6m, 顶板=街面 (穿过主街 z-8..8) —— 坦克/步兵照常过街;
//   两站相距 ~100m; 每站: 实心踏步梯上地面 (顶面 = 梯口落点实地高度) + 售票厅顶板 (4 柱支承, 让开梯道净空);
//   净高: 坑底 -2.6 → 顶板底 -0.3 = 净高 2.3 > 人高 1.8; 踏步从坑底砌到踏面 (实心, 无悬空);
//   全站混凝土永久件 (不入 dGroup): 炮火下存续 = 地下掩体语义
function solidStair(ctx,o){ // 实心踏步楼梯 (下沉坑道用): 每级从 base 砌到踏面, 无悬空踏步
const [dx,dz]=o.dir==='z+'?[0,1]:o.dir==='z-'?[0,-1]:o.dir==='x+'?[1,0]:[-1,0];
const tr=o.tread||0.9;
let topY=o.topY;
let n=Math.max(2,Math.ceil((topY-o.base)/(o.maxRise||0.42)));
if(o.topFromGround){ // 梯口地面随地形 (坑口地形微起伏: 顶面取落点实地高度, 保证登顶支撑面=顶面)
for(let k=0;k<2;k++){
const ep=ctx.L(o.lx+dx*(n*tr+0.35),o.lz+dz*(n*tr+0.35));
topY=heightAt(ep[0],ep[1]);
n=Math.max(2,Math.ceil((topY-o.base)/(o.maxRise||0.42)));
}
}
const rise=topY-o.base, sr=rise/n;
for(let i=0;i<n;i++){
const p=ctx.L(o.lx+dx*((i+0.5)*tr),o.lz+dz*((i+0.5)*tr));
const top=o.base+sr*(i+1);
const bw=dx!==0?tr:o.width, bd=dx!==0?o.width:tr;
const b0=BOXES.length;
solidBox(o.mat||MAT.stone,bw,top-o.base,bd,p[0],(top+o.base)/2,p[1],ctx.ry);
for(let k=b0;k<BOXES.length;k++) BOXES[k].stair=1; // 踏步标记: 沙箱梯道净高断言排除自身
}
const ep=ctx.L(o.lx+dx*(n*tr+0.35),o.lz+dz*(n*tr+0.35));
const _fp=ctx.L(o.lx,o.lz), _tp=ctx.L(o.lx+dx*(n-0.5)*tr,o.lz+dz*(n-0.5)*tr);
STAIRS.push({x:ep[0],z:ep[1],topY,sr,width:o.width,n,fx:_fp[0],fz:_fp[1],tx:_tp[0],tz:_tp[1]});
return {n,sr,tr};
}
function metroHall(A,T,idx){
const cx=(A.x0+A.x1)/2, cz=(A.z0+A.z1)/2;
// 地面基准: 四周 1.2m 外采样取最大 (墙顶不埋进地形); 坑底: 中心+四角取最小 (墙脚埋过最低坑底)
let gMax=-1e9, fMin=1e9;
for(const [sx,sz] of [[A.x0-1.2,cz],[A.x1+1.2,cz],[cx,A.z0-1.2],[cx,A.z1+1.2],
[A.x0-1.2,A.z0-1.2],[A.x1+1.2,A.z1+1.2],[A.x0-1.2,A.z1+1.2],[A.x1+1.2,A.z0-1.2]]){
const g=heightAt(sx,sz); if(g>gMax) gMax=g;
}
for(const [sx,sz] of [[cx,cz],[A.x0+1,A.z0+1],[A.x1-1,A.z1-1],[A.x0+1,A.z1-1],[A.x1-1,A.z0+1]]){
const f=heightAt(sx,sz); if(f<fMin) fMin=f;
}
const gY=gMax+0.15, fY=heightAt(cx,cz);
const WT=0.6, wallBot=fMin-0.8, wallH=gY-wallBot, wallCY=(gY+wallBot)/2;
// ── 洞口: 隧道接入面 (由两矩形几何推出) + 梯道面 (config.stair) ──
const SW=3.4;
const gaps={N:[],S:[],E:[],W:[]};
if(T){
if(T.x0>=A.x0-0.01&&T.x1<=A.x1+0.01){ // 隧道 x 跨落在站厅内 → 南/北面接入 (贴边即可, 不必等宽)
if(Math.abs(T.z1-A.z0)<0.01) gaps.S.push([T.x0,T.x1]);
if(Math.abs(T.z0-A.z1)<0.01) gaps.N.push([T.x0,T.x1]);
}
if(T.z0>=A.z0-0.01&&T.z1<=A.z1+0.01){ // 隧道 z 跨落在站厅内 → 东/西面接入
if(Math.abs(T.x1-A.x0)<0.01) gaps.W.push([T.z0,T.z1]);
if(Math.abs(T.x0-A.x1)<0.01) gaps.E.push([T.z0,T.z1]);
}
}
const side=A.stair||'N';
const at=side==='N'||side==='S'?cx:cz;
gaps[side].push([at-SW/2,at+SW/2]);
// ── 挡土墙 (按洞口分段) ──
const emit=(along,wallAt,from,to)=>{
if(to-from<0.2) return;
if(along==='x') solidBox(MAT.stone,to-from,wallH,WT,(from+to)/2,wallCY,wallAt,0);
else solidBox(MAT.stone,WT,wallH,to-from,wallAt,wallCY,(from+to)/2,0);
};
const segs=(along,wallAt,from,to,gs)=>{
let a=from;
for(const g of gs.slice().sort((p,q)=>p[0]-q[0])){
if(g[0]-a>0.2) emit(along,wallAt,a,g[0]);
if(g[1]>a) a=g[1];
}
if(to-a>0.2) emit(along,wallAt,a,to);
};
segs('x',A.z1,A.x0,A.x1,gaps.N);
segs('x',A.z0,A.x0,A.x1,gaps.S);
segs('z',A.x0,A.z0,A.z1,gaps.W);
segs('z',A.x1,A.z0,A.z1,gaps.E);
// ── 实心踏步梯: 顶面 = 梯口落点实地高度 (墙外 0.35m), 步数由高度差定 (2 次迭代收敛) ──
const ex=side==='N'?[at,A.z1+0.35]:side==='S'?[at,A.z0-0.35]:side==='E'?[A.x1+0.35,at]:[A.x0-0.35,at];
const topY=heightAt(ex[0],ex[1]);
const dir=side==='N'?'z+':side==='S'?'z-':side==='E'?'x+':'x-';
let n=Math.max(2,Math.ceil((topY-fY)/0.42)), foot=[cx,cz], base=fY;
for(let k=0;k<3;k++){
// 梯整体向坑口外移 0.45: 顶步盖过坑缘 metroDep 渐变带 (0.4m 内下沉 ~2m 的窄沟),
// 旧顶步止于墙线, 出站跨 0.4m 沟先坠后卡 (2026-09-12 探针抓出)
const run=n*0.94;
foot=side==='N'?[at,A.z1-run+0.45]:side==='S'?[at,A.z0+run-0.45]:side==='E'?[A.x1-run+0.45,at]:[A.x0+run-0.45,at];
base=heightAt(foot[0],foot[1]);
const n2=Math.max(2,Math.ceil((topY-base)/0.42));
if(n2===n) break;
n=n2;
}
solidStair(bctx(foot[0],foot[1],0,base),{lx:0,lz:0,dir,width:SW,base,topY,maxRise:0.42,tread:0.94});
// ── 售票厅顶板 (config.roof 侧, 10×16.4, 4 柱支承; 顶面=墙顶同高) ──
const RS=A.roof;
if(RS){
const RW=10, RL=16.4;
let rx0,rx1,rz0,rz1;
if(RS==='E'){ rx1=A.x1-0.3; rx0=rx1-RW; rz0=cz-RL/2; rz1=cz+RL/2; }
else if(RS==='W'){ rx0=A.x0+0.3; rx1=rx0+RW; rz0=cz-RL/2; rz1=cz+RL/2; }
else if(RS==='N'){ rz1=A.z1-0.3; rz0=rz1-RL; rx0=cx-RW/2; rx1=cx+RW/2; }
else { rz0=A.z0+0.3; rz1=rz0+RL; rx0=cx-RW/2; rx1=cx+RW/2; }
solidBox(MAT.stone,rx1-rx0,0.45,rz1-rz0,(rx0+rx1)/2,gY-0.225,(rz0+rz1)/2,0);
for(const [px,pz] of [[rx0+1.6,rz0+1.6],[rx0+1.6,rz1-1.6],[rx1-1.6,rz0+1.6],[rx1-1.6,rz1-1.6]]){
const g0=heightAt(px,pz), h=gY-0.45-g0;
mesh(new THREE.CylinderGeometry(0.35,0.4,h,8),MAT.stone,px,g0+h/2,pz);
CYLS.push({x:px,z:pz,r:0.4,y0:g0,y1:gY-0.45});
}
}
// ── 站内长椅/瓦砾 + 入口亭 (复用 metroPavilion, 朝向梯道) ──
for(const [bx,bz] of [[cx-5,cz-5],[cx+4,cz+6]]){
mesh(boxGeo(1.8,0.5,0.5),MAT.woodDark,bx,heightAt(bx,bz)+0.25,bz,0);
}
if(wr(0,1)<0.85) mesh(boxGeo(wr(0.9,1.6),wr(0.4,0.8),wr(0.9,1.6)),MAT.rubble,cx+wr(-3,3),heightAt(cx+2,cz+2)+0.3,cz+wr(-4,4),wr(0,3));
const pav=side==='N'?[at,A.z1+5.5,Math.PI]:side==='S'?[at,A.z0-5.5,0]:side==='E'?[A.x1+8,at,-HPI]:[A.x0-8,at,HPI];
metroPavilion(pav[0],pav[1],pav[2]);
// ── 通行带: 梯口/梯道中段/梯脚/隧道口 (Bot 寻路进站) ──
NAV_CLEARS.push({x:ex[0],z:ex[1],r:2.6});
NAV_CLEARS.push({x:(foot[0]+ex[0])/2,z:(foot[1]+ex[1])/2,r:2.6});
NAV_CLEARS.push({x:foot[0],z:foot[1],r:2.4});
if(T&&gaps.S.length) NAV_CLEARS.push({x:(T.x0+T.x1)/2,z:A.z0+2.5,r:2.4});
if(T&&gaps.N.length) NAV_CLEARS.push({x:(T.x0+T.x1)/2,z:A.z1-2.5,r:2.4});
coverPoints.push({x:cx,z:cz});
BUILD_REG.push({type:'metroStation',x:cx,z:cz,ry:0,w:A.x1-A.x0,d:A.z1-A.z0,floor:fY,doors:[],roofY:gY,hall:idx});
}
function metroTunnel(T){
// 分段 (6m): 两侧挡土墙 + 顶板 同段同高 (顶面 = 该段两侧地面最高点 + 0.15, 跟随地形)
for(let z=T.z0;z<T.z1-0.01;z+=6){
const seg=Math.min(6,T.z1-z), zc=z+seg/2;
const gy=Math.max(heightAt(T.x0-1.6,zc),heightAt(T.x1+1.6,zc))+0.15;
const fy=Math.min(heightAt(T.x0+1,zc),heightAt(T.x1-1,zc));
const wb=fy-0.8;
for(const wx of [T.x0,T.x1]) solidBox(MAT.stone,0.6,gy-wb,seg+0.02,wx,(gy+wb)/2,zc,0);
solidBox(MAT.stone,T.x1-T.x0+2.0,0.45,seg+0.02,(T.x0+T.x1)/2,gy-0.225,zc,0);
}
}
function metroStation(){
const M=CITY&&CITY.metro; if(!M) return;
const HALLS=M.halls||[], T=M.tunnel||null;
if(!HALLS.length&&!T) return;
if(T) metroTunnel(T);
HALLS.forEach((A,i)=>metroHall(A,T,i));
// 隧道中段通行带 (Bot 穿行两端进站)
if(T){
const mx=(T.x0+T.x1)/2, mz=(T.z0+T.z1)/2;
NAV_CLEARS.push({x:mx,z:T.z0+3,r:2.4},{x:mx,z:T.z1-3,r:2.4},{x:mx,z:mz,r:2.4});
coverPoints.push({x:mx,z:mz});
}
}
// ═══════════ 地貌组新建筑 (2026-09-10: 淞沪/百团/莫斯科三图改造) ═══════════
// 石拱桥 (淞沪水网): 低矮石桥, 步兵/坦克可通行 —— 桥面高度由 heightAt 的 BRIDGES 抬升提供,
// 此处只建外观/护栏/桥台/NAV 通行带 (与 buildBridge 同约定, 但材质为石、无排架桩)
// 空间账: 桥面净宽 w≥6.8 (坦克宽 3.6+余量); 护栏高 1.0 不挡视线可作矮掩体;
// 桥台高自适应两岸, 台阶<0.45 可通行
function stoneBridge(B){
const dy=bridgeDeckY(B);
const cs=Math.cos(B.yaw), sn=Math.sin(B.yaw);
// ── 2026-09-12 实机修复: "桥横在水面"根因是无桥墩+桥面贴岸高+引桥无坡度 ──
// 新结构: ①跨中两组石墩落河床 ②桥身加厚(跨中 0.9 / 端部 0.55) ③两岸引桥带坡度 ④桥台加高
// 桥身主体 (石砌): 端部薄、跨中厚, 形成轻微起拱感
{
const nBody=Math.max(4,Math.round(B.len/2));
for(let i=0;i<nBody;i++){
const u=-B.len/2+(i+0.5)*(B.len/nBody);
const t=Math.abs(u)/(B.len/2); // 0=跨中 1=端部
const th=0.55+(1-t)*0.35; // 跨中 0.9 端部 0.55
const px=B.x+sn*u, pz=B.z+cs*u;
solidBox(MAT.stone,B.w,th,B.len/nBody+0.02,px,dy-th/2,pz,B.yaw);
}
}
// 桥面铺装: 木板条
{
const nPlank=Math.round(B.len/1.2);
for(let i=0;i<nPlank;i++){
const u=-B.len/2+(i+0.5)*(B.len/nPlank);
const px=B.x+sn*u, pz=B.z+cs*u;
mesh(boxGeo(B.w-0.2,0.06,B.len/nPlank-0.08),MAT.wood,px,dy+0.03,pz,B.yaw,false,true);
}
}
// 石栏杆: 两侧立柱+压顶条
for(const side of [-1,1]){
const v=side*(B.w/2-0.22);
for(let u=-B.len/2+1;u<=B.len/2-1;u+=2.8){
const px=B.x+sn*u+cs*v, pz=B.z+cs*u-sn*v;
solidBox(MAT.stone,0.28,1.0,0.28,px,dy+0.5,pz,B.yaw);
}
const rx=B.x+cs*v, rz=B.z-sn*v;
solidBox(MAT.stone,0.22,0.16,B.len-1.2,rx,dy+1.02,rz,B.yaw);
}
// ── 水中桥墩: 跨中 ±B.len/4 两组, 从河床落底到桥身底 ──
{
const bedY=heightAt(B.x,B.z,true); // noBridge 河床
for(const u of [-B.len/4, B.len/4]){
const px=B.x+sn*u, pz=B.z+cs*u;
const pierTop=dy-0.9; // 桥身底 (跨中厚度 0.9)
const pierH=pierTop-bedY+0.3; // 插入河床 0.3
if(pierH>0.4){
// 双柱+横系梁 (石砌排架)
for(const v of [-B.w*0.28, B.w*0.28]){
const cx=px+cs*v, cz=pz-sn*v;
solidBox(MAT.stone,0.7,pierH,0.7,cx,bedY-0.15+pierH/2,cz,B.yaw);
}
// 横系梁 (联系两柱)
solidBox(MAT.stone,B.w*0.7,0.45,0.8,px,bedY+pierH*0.45,pz,B.yaw);
}
}
}
// ── 桥台: 两端石砌, 从岸顶到桥面, 加高加宽 (视觉锚固) ──
for(const sgn of [-1,1]){
const ux=sgn*sn, uz=sgn*cs;
const abx=B.x+ux*(B.len/2+0.9), abz=B.z+uz*(B.len/2+0.9);
const gA=heightAt(abx-ux*2,abz-uz*2,true);
const hAb=Math.max(0.5, dy-gA+0.2); // 至少 0.5 高, 顶面略高于桥面做挡墙
solidBox(MAT.stone,B.w+0.8,hAb,1.8,abx,gA+hAb/2,abz,B.yaw);
// 桥台翼墙 (顺河向短墙, 锚固感)
for(const side of [-1,1]){
const wx=abx+side*cs*(B.w/2+0.3), wz=abz-side*sn*(B.w/2+0.3);
solidBox(MAT.stone,0.4,hAb*0.7,1.2,wx,gA+hAb*0.35,wz,B.yaw);
}
}
// ── 引桥坡道: 两岸各 5m 木板坡, 从岸顶升到桥面 ──
for(const sgn of [-1,1]){
const ux=sgn*sn, uz=sgn*cs;
const rampLen=5.0;
const endU=sgn*(B.len/2+rampLen/2+0.2);
const px=B.x+sn*endU, pz=B.z+cs*endU;
const gEnd=heightAt(px-ux*1.5,pz-uz*1.5,true);
const rise=dy-gEnd;
if(rise>0.15&&rise<2.5){
// 坡道基体 (斜放大盒, 用多段模拟坡度)
const nSeg=5;
for(let i=0;i<nSeg;i++){
const t=(i+0.5)/nSeg;
const u=sgn*(B.len/2+0.2)+sgn*t*rampLen;
const sx=B.x+sn*u, sz=B.z+cs*u;
const sy=gEnd+rise*t;
solidBox(MAT.stone,B.w*0.85,0.35,rampLen/nSeg+0.05,sx,sy-0.15,sz,B.yaw);
// 坡道木板面
mesh(boxGeo(B.w*0.8,0.05,rampLen/nSeg),MAT.wood,sx,sy+0.03,sz,B.yaw,false,true);
}
}
}
// 桥缘沙袋 (两侧交替)
const s1x=B.x+sn*(-B.len/2+5)+cs*(B.w/2-0.9), s1z=B.z+cs*(-B.len/2+5)-sn*(B.w/2-0.9);
const s2x=B.x+sn*(B.len/2-5)-cs*(B.w/2-0.9), s2z=B.z+cs*(B.len/2-5)+sn*(B.w/2-0.9);
if(freeSpot(s1x,s1z,2)) sandbagWall(s1x,s1z,2.4,B.yaw+HPI);
if(freeSpot(s2x,s2z,2)) sandbagWall(s2x,s2z,2.4,B.yaw+HPI);
// 中央通行带
for(let u=-B.len/2+1;u<=B.len/2-1;u+=2){
const px=B.x+sn*u, pz=B.z+cs*u;
NAV_CLEARS.push({x:px,z:pz,r:1.8});
}
coverPoints.push({x:B.x,z:B.z});
}
// ═══════════ 大龙河大桥 (胡康 2026-09-12 巨桥改版; 实机修复 v2 同日) ═══════════
// 巨型公路桥: 跨 76m / 桥面宽 14m / 深谷 d=14 + 门式塔楼×2 (可登顶, 塔顶高炮 FLAK_DECKS)
// 轴系约定: solidBox(w,h,d,…,ry=B.yaw) 的 w 沿桥横向(v)、d 沿桥纵向(u) —— 与 onBridge 轴系一致, 本函数所有长件均已按此校向
// ★ 河距口径 (实机修复 v2 教训): 大龙河线大体沿桥横向(v)走, 一点的河距≈其桥轴坐标 |u|,
//   不是 hypot(u,v) —— 布件前先按 |u| 核对深切带 (|u|<26) / 激流判定区 (|u|<20.8)
// 空间账 (纲领 §6.1):
//   桥面行车道净宽 14-2×0.6(护栏) ≈ 12.8 > 坦克 3.6 双向错车; 护栏顶 dy+1.0 (矮掩体, 不挡视线);
//   塔楼门架跨路: 腿在 v=±8.7 (行车道外), 跨路横梁底 dy+4.85 > 坦克高+跳跃余量;
//   塔顶步道 T=dy+7.6 (半场制高), 护栏 1.05, v+ 侧豁口开在楼梯同侧 (随 sgn);
//   登塔梯: 垫台在桥头引道外 (u=ut+sgn*13.8, 河距≈41 岸上), 单跑沿桥轴外侧面 (v=11.4, 全程 |u|≥30 岸上)
//   登至 u≈ut+sgn*3.4, 衔接台 (顶=T) 搭接步道角, STAIRS 登顶落点在步道上 (支撑=T 齐平);
//   塔位 u=±27 (深切带外), 水中墩 u=0,±6.5,±13.5, 斜坡墩 ±20.5, 引跨墩 ±33;
//   桥面高度=bridgeDeckY (两岸取 max), 端部落差>0.14 时补 ≤3 级石阶 (stairFlight, 顶步=桥面严格齐平);
//   (2026-09-12 实机反馈: 悬索桁架/吊杆"浮空无连接" —— 整体删除, 门塔+墩排已足够读出巨桥)
function grandBridge(B){
const dy=bridgeDeckY(B);
const sn=Math.sin(B.yaw), cs=Math.cos(B.yaw);
// 桥局部→世界 (u=沿桥轴向, v=垂直桥向)
const pt=(u,v)=>[B.x+u*sn+v*cs, B.z+u*cs-v*sn];
const gAt=(u,v)=>heightAt(pt(u,v)[0],pt(u,v)[1],true); // noBridge: 桥矩形内取真实地面/河床
// ── 桥面主体: 行车板 (结构) + 铺装层 (视觉) ──
solidBox(MAT.wood,B.w,0.6,B.len,B.x,dy-0.3,B.z,B.yaw);
mesh(boxGeo(B.w+0.9,0.1,B.len-0.9),MAT.woodDark,B.x,dy+0.02,B.z,B.yaw,false,true);
// ── 护栏: 立柱 + 双视觉横杆 + 通长碰撞顶杆 (顶 dy+1.0, 与 buildBridge 同口径) ──
for(const side of [-1,1]){
const v=side*(B.w/2-0.3);
for(let u=-B.len/2+0.9;u<=B.len/2-0.9;u+=2.4){
const p=pt(u,v);
solidBox(MAT.metalDark,0.16,1.06,0.16,p[0],dy+0.53,p[1],B.yaw);
}
for(const hy of [0.52,0.98]){
const p=pt(0,v);
mesh(boxGeo(0.1,0.1,B.len-1.6),MAT.metalDark,p[0],dy+hy,p[1],B.yaw);
}
const rp=pt(0,v);
solidBox(MAT.metalDark,0.13,0.13,B.len-1.6,rp[0],dy+0.94,rp[1],B.yaw);
}
// ── 桥墩排架: 双柱 (石砌) + 柱头垫石 + 柱间横撑; 墩位按河谷剖面分布 (水/滩/坡/岸) ──
for(const bu of [0,-6.5,6.5,-13.5,13.5,-20.5,20.5,-33,33]){
const vC=B.w*0.33;
for(const v of [-vC,vC]){
const p=pt(bu,v);
const bed=gAt(bu,v);
const top=dy-0.62, bot=bed-0.35;
if(top-bot<0.6) continue;
solidBox(MAT.stone,1.7,top-bot,1.7,p[0],(top+bot)/2,p[1],B.yaw);
solidBox(MAT.stone,2.1,0.35,2.1,p[0],top+0.17,p[1],B.yaw); // 柱头垫石
}
const bedM=Math.min(gAt(bu,-vC),gAt(bu,vC));
if(dy-0.62-bedM>2.2){
for(const hy of [0.45,0.8]){
const pm=pt(bu,0);
solidBox(MAT.stone,vC*2+1.4,0.4,0.6,pm[0],bedM+(dy-0.62-bedM)*hy,pm[1],B.yaw);
}
}
}
// ── 门式塔楼×2 (u=±27): 四腿门架 + 塔顶步道 (半场制高) + 登塔梯 + 塔顶高炮登记 ──
const T=dy+7.6; // 塔顶步道面
for(const sgn of [-1,1]){
const ut=sgn*27;
// 四腿 (钢格构, 顶=步道底 T-0.5 不穿步道) + 石砌柱脚
for(const lu of [-1.7,1.7]) for(const lv of [-8.7,8.7]){
const p=pt(ut+lu,lv);
const g0=gAt(ut+lu,lv);
solidBox(MAT.stone,2.4,0.9,2.4,p[0],g0+0.45,p[1],B.yaw);
solidBox(MAT.metalDark,1.5,(T-0.5)-(g0+0.9),1.5,p[0],((g0+0.9)+(T-0.5))/2,p[1],B.yaw);
}
// 腿间横撑 (轴向外侧面, 两道)
for(const lv of [-8.7,8.7]) for(const hy of [2.2,4.4]){
const p=pt(ut,lv);
solidBox(MAT.metalDark,0.45,0.45,3.9,p[0],dy+hy,p[1],B.yaw);
}
// 帽梁×2 (跨 v ±9.3, 顶=步道底) + 门架跨路横梁 (底 dy+4.85 坦克净空)
for(const lu of [-1.7,1.7]){
const p=pt(ut+lu,0);
solidBox(MAT.metalDark,18.6,1.1,1.1,p[0],dy+7.05,p[1],B.yaw);
}
{
const p=pt(ut,0);
solidBox(MAT.metalDark,14.6,0.95,0.95,p[0],dy+5.32,p[1],B.yaw);
}
// 塔顶步道 (20.2 横向 × 5.2 纵向, 顶面 T) + 护栏 (v+ 侧留 2m 进口对准梯道衔接台)
{
const p=pt(ut,0);
solidBox(MAT.woodDark,20.2,0.5,5.2,p[0],T-0.25,p[1],B.yaw);
}
const par=(u0,u1,v0,v1)=>{
const pm=pt((u0+u1)/2,(v0+v1)/2);
solidBox(MAT.metalDark,Math.abs(v1-v0),1.05,Math.abs(u1-u0),pm[0],T+0.525,pm[1],B.yaw);
};
par(ut-2.46,ut+2.46,-10.1,-9.82);           // v- 侧整长
// v+ 侧护栏: 进口开在楼梯同侧 (2026-09-12 实机修复: 旧版豁口固定在 ut+0.6..2.6,
// 西塔楼梯从外侧登顶 → 被护栏整段挡死无法上桥顶)
if(sgn>0) par(ut-2.46,ut+0.6,9.82,10.1);    // 东塔: 楼梯自 u>ut 侧登 → 豁口 ut+0.6..2.6
else      par(ut-0.6,ut+2.46,9.82,10.1);    // 西塔: 楼梯自 u<ut 侧登 → 豁口 ut-2.6..-0.6
par(ut-2.6,ut-2.32,-10.1,10.1);             // u- 端墙
par(ut+2.32,ut+2.6,-10.1,10.1);             // u+ 端墙
// 登塔梯 (2026-09-12 实机修复 v2): 全程落在岸上 —— 河距≈桥轴坐标 |u| (河线大体沿桥横向走,
// 旧版按 hypot(u,v) 估算把梯道线放进了深切带/激流判定区); 垫台在桥头引道外侧 (u=ut+sgn*13.8, 河距≈41),
// 单跑沿桥轴外侧面登至塔顶, 顶步 u≈ut+sgn*3.4 → 衔接台 (顶=T, 搭接步道角) → 步道进口
const su=ut+sgn*13.8, sv=11.4;
const padP=pt(su,sv), padG=gAt(su,sv);
solidBox(MAT.stone,2.4,0.32,2.4,padP[0],padG+0.14,padP[1],B.yaw);
const base=padG+0.3, rise=T-base;
const nst=Math.max(6,Math.ceil(rise/0.42));
const tread=10.4/nst;
const sctx=bctx(padP[0],padP[1],B.yaw,base);
// 局部系: +x=v+, +z=u+ (bctx ry=B.yaw); 两塔均自桥头侧向塔身登 (dir 朝桥心)
stairFlight(sctx,{lx:0,lz:0,dir:sgn>0?'z-':'z+',base,topY:T,width:1.5,
maxRise:0.42,tread,exit:[-2.0,-sgn*12.2],parts:null});
// 衔接台: 顶=T, 横向 v 10.0..12.8 (内缘搭步道角 0.1m), 纵向跨梯顶与步道进口
{
const lk=pt(ut+sgn*2.0,11.4);
solidBox(MAT.woodDark,2.8,0.5,3.6,lk[0],T-0.25,lk[1],B.yaw);
}
// 梯道通行带 + 塔顶掩体点 + 塔顶高炮登记
NAV_CLEARS.push({x:padP[0],z:padP[1],r:1.6});
for(let k=1;k<=4;k++){
const p2=pt(su-sgn*k*2.4,sv);
NAV_CLEARS.push({x:p2[0],z:p2[1],r:1.3});
}
NAV_CLEARS.push({x:pt(ut+sgn*2.0,11.4)[0],z:pt(ut+sgn*2.0,11.4)[1],r:1.6},{x:pt(ut,0)[0],z:pt(ut,0)[1],r:2.6});
coverPoints.push({x:pt(ut,4)[0],z:pt(ut,4)[1]},{x:pt(ut,-4)[0],z:pt(ut,-4)[1]},{x:padP[0],z:padP[1]});
FLAK_DECKS.push({x:pt(ut,0)[0],z:pt(ut,0)[1],y:T}); // 塔顶高炮 (17-emplacements yDeck)
}
// ── 桥台: 两端石砌挡墙 (补 deck 端面外露) + 落差石阶 (引道低于桥面 >0.14 才建, 顶步=桥面齐平) ──
for(const sgn of [-1,1]){
const eu=sgn*(B.len/2+0.9);
const ab=pt(eu,0);
const gAb=gAt(eu,0);
const hAb=dy-gAb;
if(hAb>0.2) solidBox(MAT.stone,B.w+1.6,hAb,1.8,ab[0],gAb+hAb/2,ab[1],B.yaw);
const su3=sgn*(B.len/2+2.4), gIn=gAt(su3,0);
if(dy-gIn>0.14){
const stp=pt(su3,0);
const stx=bctx(stp[0],stp[1],B.yaw,gIn);
stairFlight(stx,{lx:0,lz:0,dir:sgn<0?'z+':'z-',base:gIn,topY:dy,width:B.w-2,
maxRise:0.42,tread:0.62,exit:[0,-sgn*2.9],parts:null});
}
}
// ── 桥面掩体: 沙袋 4 组交错 (v=±2.9, 让出中央行车道) ──
for(const [bu,bv] of [[-21,-2.9],[-10,2.9],[10,-2.9],[21,2.9]]){
const p=pt(bu,bv);
sandbagWall(p[0],p[1],2.2,B.yaw+HPI);
}
// ── 通行带: 沿桥轴每 2m 强制清格 (护栏/沙袋/吊杆碰撞外溢不封唯一过河走廊) ──
for(let u=-B.len/2+2;u<=B.len/2-2;u+=2){
const p=pt(u,0);
NAV_CLEARS.push({x:p[0],z:p[1],r:1.7});
}
coverPoints.push({x:B.x,z:B.z});
}
// 铁路木桥 (莫斯科雪岭): 跨浅溪的木排架桥 —— 面向雪岭防线地标小件
function buildRailBridge(B){
const dy=bridgeDeckY(B);
const cs=Math.cos(B.yaw), sn=Math.sin(B.yaw);
// 桥面 (木板)
solidBox(MAT.wood,B.w,0.45,B.len,B.x,dy-0.225,B.z,B.yaw);
mesh(boxGeo(B.w+0.2,0.1,B.len-0.3),MAT.woodDark,B.x,dy+0.02,B.z,B.yaw,false,true);
// 护栏: 立柱+双横杆
for(const side of [-1,1]){
const v=side*(B.w/2-0.2);
for(let u=-B.len/2+0.8;u<=B.len/2-0.8;u+=2.2){
const px=B.x+sn*u+cs*v, pz=B.z+cs*u-sn*v;
solidBox(MAT.woodDark,0.14,1.0,0.14,px,dy+0.5,pz,B.yaw);
}
const rx=B.x+cs*v, rz=B.z-sn*v;
solidBox(MAT.woodDark,0.1,0.1,B.len-1.4,rx,dy+0.92,rz,B.yaw);
}
// 排架桩
for(const u of [-B.len/2+1.2,0,B.len/2-1.2]){
for(const v of [-B.w/2+0.6,B.w/2-0.6]){
const px=B.x+sn*u+cs*v, pz=B.z+cs*u-sn*v;
mesh(new THREE.CylinderGeometry(0.16,0.2,4.2,6),MAT.woodDark,px,dy-2.2,pz);
}
}
// 通行带
for(let u=-B.len/2+1;u<=B.len/2-1;u+=2){
NAV_CLEARS.push({x:B.x+sn*u,z:B.z+cs*u,r:1.4});
}
coverPoints.push({x:B.x,z:B.z});
}
// 窑洞 (百团黄土): 拱洞剖面贴沟崖 —— 前脸墙(拱门洞)+侧墙+土拱顶(不可毁)+内部隔墙
// 空间账: 拱门净宽 1.6 净高 2.1; 内室 4.2×4.0 层高 2.3; 土拱顶=永久件(不可毁, 与真实窑洞一致);
// 前脸墙可毁(dBox), 塌后洞口敞开可当掩体废墟; 侧墙永久
function caveDwelling(x,z,ry){
const f=foundation(x,z,ry,6.5,5.2,{raise:0.05});
const ctx=bctx(x,z,ry,f.floor);
const H=2.3, t=0.5, hw=3.25, hd=2.6;
// 前脸墙 (+z=朝向沟): 拱门洞 (门楣用两段矮墙+过梁拼, 避免实心箱堵门)
// 开洞: 中央 1.6 宽 通高到 2.1, 门楣 0.2 高
const gF=wallSeg(ctx,{along:'x',at:hd,from:-hw,to:hw,h:H+0.4,t,mat:MAT.earth||MAT.brick,destr:true,
ops:[{c:0,w:1.6,h:0,ht:2.1,type:'door'}]});
if(gF) gF.hp=380; // 土坯墙比砖墙脆
// 侧墙 (永久)
for(const at of [hw,-hw]){
wallSeg(ctx,{along:'z',at,from:-hd+t,to:hd-t,h:H,t,mat:MAT.earth||MAT.brick});
}
// 后墙 (永久, 封内室)
wallSeg(ctx,{along:'x',at:-hd,from:-hw,to:hw,h:H,t,mat:MAT.earth||MAT.brick});
// 土拱顶: 实心平顶略拱 (永久, 不可毁) —— 真实窑洞靠土体自承
solidBox(MAT.earth||MAT.brick,hw*2+0.4,0.55,hd*2+0.4,x,f.floor+H+0.275,z,ry);
// 内部炕/灶台 (纯视觉+矮掩体)
const p=ctx.L(-1.5,-0.8);
mesh(boxGeo(1.8,0.55,1.0),MAT.woodDark,p[0],f.floor+0.275,p[1],ry);
addBoxCollider(p[0],f.floor+0.275,p[1],1.8,0.55,1.0);
coverPoints.push({x:ctx.L(0,hd+2.2)[0],z:ctx.L(0,hd+2.2)[1]},{x,z});
NAV_CLEARS.push({x:ctx.L(0,hd+1.2)[0],z:ctx.L(0,hd+1.2)[1],r:1.8});
BUILD_REG.push({type:'caveDwelling',x,z,ry,w:hw*2,d:hd*2,floor:f.floor,doors:ctx.doors.slice(),roofY:f.floor+H+0.55});
}
// 龙牙 (莫斯科反坦克): 混凝土三角锥 —— 坦克不可碾 (无 crush), 硬掩体
// 空间账: 底 1.4×1.4 高 1.0; 交错布置防坦克直线冲过; 可作步兵矮掩体
function dragonTooth(x,z,ry){
if(!propFree(x,z,1.1)||!freeSpot(x,z,1.0)) return;
propTake(x,z,1.1);
const g0=heightAt(x,z);
const geo=new THREE.ConeGeometry(0.75,1.05,4);
const m=new THREE.Mesh(geo,MAT.concrete||MAT.stone);
m.position.set(x,g0+0.52,z);
m.rotation.y=ry+HPI/2; // 菱形朝向
m.castShadow=true;
world.add(m);
// 碰撞: 倾斜菱形用 AABB 近似 (1.1×1.05×1.1)
addBoxCollider(x,g0+0.5,z,1.1,1.05,1.1);
coverPoints.push({x,z});
}
// ═══════════ 淞沪水乡大件 (2026-09-12 环形旗点+水乡风貌改版) ═══════════
// 丝厂 (缫丝厂): 中央旗 E 侧旁地标 —— 两层砖木厂房, 可进可上屋顶, 全场制高
// 空间逻辑核算 (2026-09-12 实机截图修复 v2):
//   足迹 18×12m (局部 x±9 / z±6); 一层层高 3.6 (南门净宽 2.2 净高 2.8), 二层 3.4 → 屋面 7.0
//   内梯一跑: 贴西墙 x=-7.2, 南→北, 9步×0.30, 顶步=F2 严格齐平
//   内梯二跑: 贴东墙 x=+7.2, 北→南, 9步×0.378 (tread 0.283, run 2.55), 顶步=屋面 7.0 严格齐平, 整跑立于二层楼板上
//   二层楼板: 全覆盖只留西侧楼梯井一跑 (东井已填实 —— 修"二楼梯底下悬空")
//   屋面: 全覆盖留东侧楼梯井; 女儿墙四边; 烟囱东北角外高 14m
//   材质: 墙=brick / 楼板·梯·屋面=woodDark (统一木构) / 女儿墙·烟囱顶=stone
//   ★ 不可破坏 (地标恒存): 全部墙/楼板/屋面永久件 (destr:false)
function silkFactory(x,z,ry){
const fw=18, fd=12, hw=fw/2, hd=fd/2;
const f=foundation(x,z,ry,fw,fd,{maxDh:1.2,raise:0.08});
const ctx=bctx(x,z,ry,f.floor);
const t=0.45, FH=3.6, F2=f.floor+FH, FH2=3.4, RT=FH+FH2, parH=1.1;
const wallMat=MAT.brick||MAT.plaster;
const deckMat=MAT.woodDark; // 楼板/梯/屋面统一木构, 避免 stone 贴图大平面拉伸
const slabs=[];
// ── 一层 (0~3.6): 南面大门 2.2 + 工业高窗; 北面窗; 东西侧窗 ──
wallSeg(ctx,{along:'x',at:hd,from:-hw,to:hw,h:FH,t,mat:wallMat,destr:false,
ops:[{c:0,w:2.2,ht:2.8,h:0,type:'door'},{c:-5.5,w:2.0,b:1.2,h:1.6,type:'win'},{c:5.5,w:2.0,b:1.2,h:1.6,type:'win'}]});
wallSeg(ctx,{along:'x',at:-hd,from:-hw,to:hw,h:FH,t,mat:wallMat,destr:false,
ops:[{c:-4,w:1.8,b:1.2,h:1.6,type:'win'},{c:4,w:1.8,b:1.2,h:1.6,type:'win'}]});
wallSeg(ctx,{along:'z',at:hw,from:-hd+t,to:hd-t,h:FH,t,mat:wallMat,destr:false,
ops:[{c:2.5,w:1.6,b:1.2,h:1.6,type:'win'},{c:-2,w:1.6,b:1.2,h:1.6,type:'win'}]});
wallSeg(ctx,{along:'z',at:-hw,from:-hd+t,to:hd-t,h:FH,t,mat:wallMat,destr:false,
ops:[{c:0,w:1.8,b:1.2,h:1.6,type:'win'}]});
// ── 二层 (3.6~7.0): 四面工业窗 ──
wallSeg(ctx,{along:'x',at:hd,from:-hw,to:hw,h:FH2,t,mat:wallMat,destr:false,y0:FH,
ops:[{c:-5,w:1.8,b:0.9,h:1.6,type:'win'},{c:5,w:1.8,b:0.9,h:1.6,type:'win'}]});
wallSeg(ctx,{along:'x',at:-hd,from:-hw,to:hw,h:FH2,t,mat:wallMat,destr:false,y0:FH,
ops:[{c:-4,w:1.8,b:0.9,h:1.6,type:'win'},{c:4,w:1.8,b:0.9,h:1.6,type:'win'}]});
wallSeg(ctx,{along:'z',at:hw,from:-hd+t,to:hd-t,h:FH2,t,mat:wallMat,destr:false,y0:FH,
ops:[{c:-2,w:1.6,b:0.9,h:1.6,type:'win'},{c:2.5,w:1.6,b:0.9,h:1.6,type:'win'}]});
wallSeg(ctx,{along:'z',at:-hw,from:-hd+t,to:hd-t,h:FH2,t,mat:wallMat,destr:false,y0:FH,
ops:[{c:0,w:1.8,b:0.9,h:1.6,type:'win'}]});
// ── 内梯一跑: 贴西墙 x=-7.2, 南→北上二层 (9步×0.30, run 2.7) ──
// 2026-09-12 v4: stairFlight 锯齿踏步 (踩踏面/旧版一致, 踢面封闭); 此前 v3 的手搓斜梁已删
stairFlight(ctx,{lx:-7.2,lz:-4.8,dir:'z+',width:1.5,base:f.floor,topY:F2,maxRise:0.42,tread:0.30,exit:[-7.2,-1.0],mat:MAT.woodDark});
// ── 二层楼板: 全覆盖嵌入墙体 (墙体内面在 ±8.55/±5.55, 楼板画到 ±9/±6 确保无缝), 留西楼梯井 ──
const f2slab=(x0,x1,z0,z1)=>{
const p=ctx.L((x0+x1)/2,(z0+z1)/2);
slabs.push(solidBox(deckMat,x1-x0,0.22,z1-z0,p[0],F2-0.11,p[1],ry));
};
// 主楼板 (中部, 嵌入前后墙)
f2slab(-6.0,6.0,-6.0,6.0);
// 东侧整片 (嵌入东墙到 x=9) —— 不留东井: 二跑梯整体立于楼板上
// (2026-09-12 修"二楼梯底下悬空": 原东井 z0.7~5.0 恰罩住整跑梯段, 梯步在井口落空吊空;
//  屋面东井保留, 登顶净空不受影响)
f2slab(6.0,9.0,-6.0,6.0);
// 西侧 (西井北缘窄条 + 南侧含登顶落脚 —— 南板伸到梯末步下 0.06, 消除登顶口 0.66 天井断口) —— 嵌入西墙到 x=-9
f2slab(-9.0,-6.0,-6.0,-5.0);
f2slab(-9.0,-6.0,-2.16,6.0);
// 楼梯井护栏 (西井: 东缘+南缘; 北缘是登顶口)
{
const rail=(lx,lz,len,alongX)=>{
const p=ctx.L(lx,lz);
solidBox(deckMat,alongX?len:0.12,0.95,alongX?0.12:len,p[0],F2+0.475,p[1],ry);
};
rail(-5.94,-3.0,4.0,false);  // 东缘
rail(-7.2,-5.06,2.0,true);   // 南缘
}
// ── 内梯二跑: 贴东墙 x=+7.2, 北→南上屋顶 (9步×0.378, tread 0.283, run 2.55) ──
// 底部落于二层楼板 (下方东井已填实); 屋面东井照留, 登顶净空靠屋面开口
stairFlight(ctx,{lx:7.2,lz:4.6,dir:'z-',width:1.5,base:F2,topY:f.floor+RT,maxRise:0.42,tread:0.283,exit:[7.2,1.0],mat:MAT.woodDark});
// ── 屋面 (7.0): 全覆盖留东楼梯井 ──
const RTy=f.floor+RT-0.125;
{
// 主屋面 (西侧全覆盖)
const p=ctx.L(-1.0,0);
slabs.push(solidBox(deckMat,15.0,0.25,11.4,p[0],RTy,p[1],ry));
// 东井南侧补板 (含登顶落脚 —— 北缘伸到梯末步下 0.06, 消除登顶口 0.85 天井断口)
const p2=ctx.L(7.2,-1.955);
slabs.push(solidBox(deckMat,2.8,0.25,7.89,p2[0],RTy,p2[1],ry));
// 东井北侧窄条
const p3=ctx.L(7.2,5.35);
slabs.push(solidBox(deckMat,2.8,0.25,0.7,p3[0],RTy,p3[1],ry));
}
// 楼梯井护栏 (屋面东井: 西缘+北缘; 南缘是登顶口)
{
const rail=(lx,lz,len,alongX)=>{
const p=ctx.L(lx,lz);
slabs.push(solidBox(deckMat,alongX?len:0.12,0.95,alongX?0.12:len,p[0],f.floor+RT+0.475,p[1],ry));
};
rail(5.94,3.5,3.0,false);  // 西缘 (井南缘已北移贴梯末步, 护栏随缩)
rail(7.2,5.06,2.2,true);   // 北缘
}
// 女儿墙 (四边, 石砌)
for(const [w,d,lx,lz] of [[fw+0.4,0.28,0,hd+0.1],[fw+0.4,0.28,0,-hd-0.1],[0.28,fd+0.4,hw+0.1,0],[0.28,fd+0.4,-hw-0.1,0]]){
const p=ctx.L(lx,lz);
slabs.push(solidBox(MAT.stone,w,parH,d,p[0],f.floor+RT+parH/2,p[1],ry));
}
// ── 烟囱: 东北角外, 高 14m ──
{
const cp=ctx.L(hw-1.5,-hd-2.5);
const cg0=heightAt(cp[0],cp[1]);
mesh(new THREE.CylinderGeometry(0.85,1.2,14,10),wallMat,cp[0],cg0+7,cp[1]);
mesh(new THREE.CylinderGeometry(1.0,0.95,0.5,10),MAT.stone,cp[0],cg0+14.1,cp[1]);
CYLS.push({x:cp[0],z:cp[1],r:1.2,y0:cg0,y1:cg0+14});
}
// ── 天窗: 屋面中央低矮条带 (贴屋面, 不悬空) ──
for(let i=0;i<3;i++){
const p=ctx.L(-3+i*3.2,0);
mesh(boxGeo(1.8,0.15,5.0),MAT.wood,p[0],f.floor+RT+0.1,p[1],ry,false,true);
}
// ── 内部: 缫丝机长台 (矮掩体) + 绸布垛 ──
for(const lz of [-2.5,2.5]){
const p=ctx.L(1,lz);
solidBox(MAT.woodDark,6,0.7,0.9,p[0],f.floor+0.35,p[1],ry);
}
{
const p=ctx.L(-2,0);
solidBox(MAT.woodDark,1.6,1.1,1.4,p[0],f.floor+0.55,p[1],ry+0.2);
}
addCoverAround(x,z,fw,fd,ry);
coverPoints.push({x:ctx.L(0,hd+2.4)[0],z:ctx.L(0,hd+2.4)[1]},
{x:ctx.L(0,0)[0],z:ctx.L(0,0)[1]});
BUILD_REG.push({type:'silkFactory',x,z,ry,w:fw,d:fd,floor:f.floor,doors:ctx.doors.slice(),roofY:f.floor+RT,indestr:true});
}
// 水车: 江南标识性景观 —— 不可毁纯景观 + 木质矮掩体
// 空间账: 轮径 2.8m 轴高 2.0; A 字支架; 底部水槽贴地; 可作步兵半身掩体
function waterwheel(x,z,ry){
if(!propFree(x,z,2.2)||!freeSpot(x,z,1.8)) return;
propTake(x,z,2.2);
const g0=heightAt(x,z);
// A 字支架 (两斜撑, 与竖直夹角 ~15°)
for(const s of [-1,1]){
const px=x+Math.sin(ry)*s*0.9, pz=z+Math.cos(ry)*s*0.9;
const m=mesh(boxGeo(0.18,2.4,0.18),MAT.woodDark,px,g0+1.2,pz,ry);
m.rotation.order='YXZ'; m.rotation.z=s*0.25;
addBoxCollider(px,g0+1.2,pz,0.25,2.4,0.25);
}
// 轮轴 (横梁)
solidBox(MAT.woodDark,0.16,0.16,2.6,x,g0+2.0,z,ry+HPI);
// 轮体: 用扁圆柱近似大轮 (轴沿水平法向)
{
const wheel=new THREE.Mesh(new THREE.CylinderGeometry(1.4,1.4,0.22,14),MAT.wood);
wheel.position.set(x,g0+2.0,z);
wheel.rotation.order='YXZ';
wheel.rotation.y=ry; wheel.rotation.z=HPI; // 轮面垂直于地面、法向沿 ry
wheel.castShadow=true;
world.add(wheel);
// 轮缘
const rim=new THREE.Mesh(new THREE.TorusGeometry(1.4,0.09,6,16),MAT.woodDark);
rim.position.set(x,g0+2.0,z);
rim.rotation.order='YXZ';
rim.rotation.y=ry; rim.rotation.x=HPI/2;
rim.castShadow=true;
world.add(rim);
}
// 叶板 ×6 (沿轮缘)
for(let k=0;k<6;k++){
const a=k*TAU/6;
const lx=Math.cos(a)*1.25, lz=Math.sin(a)*1.25;
const px=x+lx*Math.cos(ry)+lz*Math.sin(ry), pz=z-lx*Math.sin(ry)+lz*Math.cos(ry);
mesh(boxGeo(0.32,0.18,0.1),MAT.wood,px,g0+2.0+a*0,pz,ry,false,true);
}
// 底部水槽 (贴地, 矮掩体, 顺轮切线)
{
const px=x+Math.sin(ry)*1.9, pz=z+Math.cos(ry)*1.9;
solidBox(MAT.woodDark,1.3,0.55,2.6,px,g0+0.28,pz,ry+HPI);
}
coverPoints.push({x:x+Math.sin(ry)*2.4,z:z+Math.cos(ry)*2.4},{x,z});
}
// 乌篷/木船: 系泊硬掩体 —— 坦克不可碾 (无 crush), 可藏 1~2 人
// 空间账: 长 5.2 宽 1.6 干舷 0.55; 船底贴浅水/泥滩; 乌篷拱高 1.1 挡视线不挡弹
function sampan(x,z,ry){
if(!propFree(x,z,2.8)||!freeSpot(x,z,2.0)) return;
propTake(x,z,2.8);
const g0=heightAt(x,z);
// 船体
solidBox(MAT.wood,4.4,0.55,1.55,x,g0+0.28,z,ry);
{
const sn=Math.sin(ry), cs=Math.cos(ry);
for(const s of [1,-1]){
const px=x+s*2.4*cs, pz=z-s*2.4*sn;
const m=mesh(boxGeo(1.2,0.4,1.0),MAT.wood,px,g0+0.22,pz,ry);
m.rotation.order='YXZ'; m.rotation.z=s*0.12;
}
}
// 乌篷: 沿船长轴的半圆拱棚 (Cylinder open-ended 半周, 轴向=船长)
{
const cover=new THREE.Mesh(
new THREE.CylinderGeometry(0.85,0.85,2.4,10,1,true,0,Math.PI),
MAT.woodDark);
cover.position.set(x,g0+0.55,z);
cover.rotation.order='YXZ';
cover.rotation.y=ry+HPI/2;   // 圆柱默认轴=Y, 转到水平沿船长
cover.rotation.z=0;
// 再绕船长转 90° 让开口朝下
cover.rotation.x=HPI;
cover.castShadow=true;
world.add(cover);
}
// 船内横板 (可站)
solidBox(MAT.woodDark,1.8,0.08,1.3,x,g0+0.55,z,ry);
addBoxCollider(x,g0+0.4,z,4.6,0.7,1.7);
coverPoints.push({x,z});
}
// 石桥加固补充 (2026-09-12): 桥头堡沙袋环 —— 在 stoneBridge 调用后由 layoutDelta 叠放;
// 此处提供通用桥头堡工事 (四角沙袋+中央开口, 不堵桥面通行)
function bridgeHeadWorks(B){
const cs=Math.cos(B.yaw), sn=Math.sin(B.yaw);
for(const sgn of [-1,1]){
const ux=sgn*sn, uz=sgn*cs;
const bx=B.x+ux*(B.len/2+2.8), bz=B.z+uz*(B.len/2+2.8);
// 两侧沙袋 (垂直桥轴)
for(const side of [-1,1]){
const sx=bx+side*cs*(B.w/2+0.6), sz=bz-side*sn*(B.w/2+0.6);
if(freeSpot(sx,sz,1.8)) sandbagWall(sx,sz,3.2,B.yaw);
}
// 桥台反侧短墙
const rx=bx-ux*1.2, rz=bz-uz*1.2;
if(freeSpot(rx,rz,1.5)) sandbagWall(rx,rz,2.4,B.yaw+HPI/2);
coverPoints.push({x:bx,z:bz});
}
}
