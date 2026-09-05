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
slab(2.15,3.8,-4.3,-1.5);
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
const hz0=-hd+1.3, hz1=hd-0.5;
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
if(g)carry.push(g);
}
for(const sgn of [1,-1]){
// 长墙 from/to 取全宽 ±HW (侧墙由 wallSeg 自动外伸 t) —— 旧 ±(HW-wt) 四角留 wt/2 竖缝
g=wallSeg(ctx,{along:'x',at:sgn*HD,from:-HW,to:HW,h:WH,t:wt,mat:MAT.brick,destr:true,
ops:[{c:-8.5,w:1.7,b:4.8,h:1.5,type:'win'},{c:-2.8,w:1.7,b:4.8,h:1.5,type:'win'},{c:2.8,w:1.7,b:4.8,h:1.5,type:'win'},{c:8.5,w:1.7,b:4.8,h:1.5,type:'win'}]});
if(g)carry.push(g);
}
// 屋顶: 低坡双坡(脊沿长轴) + 砖山墙 —— 打穿两面承重墙即整体坍塌(走台随塌)
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
// ── 烟囱 (厂房东南角外, 高 15): 全图最高点, 炮兵参照物 ──
const cp=L(20,-24); // (2026-09-06 P1-3: 原 17.5 双轨均穿入基座, 东移后与东轨 107.75 净距 2.25>1.5、与东围墙 112 净距 0.5)
const cg0=heightAt(cp[0],cp[1]);
mesh(new THREE.CylinderGeometry(1.15,1.5,15,10),MAT.brick,cp[0],cg0+7.5,cp[1]);
mesh(new THREE.CylinderGeometry(1.3,1.2,0.6,10),MAT.stone,cp[0],cg0+15.1,cp[1]);
CYLS.push({x:cp[0],z:cp[1],r:1.5,y0:cg0,y1:cg0+15});
// ── 配炉房 (厂房西北, 9×7 废墟壳) ──
const bp=L(-14.5,-22);
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
// ── 厂区围墙 (砖 h2.3, 沿四向, 豁口: 西 z-39±3 行人/北 x107±2 铁轨/南 x107±2 铁轨/东 z-26±2 行人 —— 2026-09-06 P1-3 对位: 豁口 [105,109] 使双轨 106.25/107.75 居中) ──
const wy=[[70,-70],[112,-70],[112,-8],[70,-8]];
stoneWall(70,-70,105,-70,2.3); stoneWall(109,-70,112,-70,2.3);
stoneWall(112,-70,112,-28,2.3); stoneWall(112,-24,112,-8,2.3);
stoneWall(70,-8,105,-8,2.3); stoneWall(109,-8,112,-8,2.3);
stoneWall(70,-36,70,-8,2.3); stoneWall(70,-70,70,-42,2.3);
// 厂区角落杂物/弹坑
{ const p=L(8,14); if(freeSpot(p[0],p[1],1.5)) rubblePile(p[0],p[1],1.8); }
{ const p=L(-8,18); if(freeSpot(p[0],p[1],2)) crater(p[0],p[1],2.2); }
{ const p=L(19,10); factoryLadle(p[0],p[1]); } // 厂区南货场钢水包 (2026-09-06 P1-3: 原 17 正压轨心 107; 19.5 会蹭东墙段占位半径 propFree 失败, 收到 19)
// 厂区整体足迹 (世界坐标 AABB 随 ry) —— 此后ammo箱/火力点/杂物不再落入围墙内
B_FOOT.push(footRect(...L(1,-1),ry,44,64,1.0));
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
