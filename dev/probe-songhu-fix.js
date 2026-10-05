// ─────────────────────────────────────────────
// dev/probe-songhu-fix.js —— 2026-09-12 三项实机修复回归探针 (不进 Index.html)
// 用法: node dev/probe-songhu-fix.js
// 覆盖: ①stairFlight v4 锯齿踏步 (踏步恢复薄步, 不再是实心柱);
//       ②楼梯锚定通用断言: 任意战役中每级踏步必须落地/落在楼板/咬合在下一步上 (抓"梯下悬空");
//       ③淞沪石拱桥×2 垂直跨河 (修"桥反了90度"顺河躺), 桥面-河床/两岸高差可通行;
//       ④丝厂 (纺织厂) 二跑梯立于二层楼板上 (原东井罩住整跑梯段致悬空)。
// 原理: 沙箱加载真实 00-config → 03-terrain → 04-collision → 04b-fire → 05-world →
//       05a/05b/05c (buildWorld 载入即建), 对真实 BOXES/heightAt 做几何断言。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'), path=require('path'), vm=require('vm');
const root=path.resolve(__dirname,'..');
const seed=42;

function makeThreeStub(){
class P3{ constructor(x=0,y=0,z=0){ this.x=x;this.y=y;this.z=z; } set(x,y,z){this.x=x;this.y=y;this.z=z;return this;} setScalar(s){this.x=s;this.y=s;this.z=s;return this;} normalize(){const l=Math.hypot(this.x,this.y,this.z)||1;this.x/=l;this.y/=l;this.z/=l;return this;} }
class Rot{ constructor(){ this.x=0;this.y=0;this.z=0;this.order='XYZ'; } set(x,y,z){this.x=x;this.y=y;this.z=z;return this;} }
class Quat{ constructor(){ this.x=0;this.y=0;this.z=0;this.w=1; } setFromUnitVectors(){ return this; } identity(){ return this; } setFromEuler(){ return this; } }
class Scl{ constructor(){ this.x=1;this.y=1;this.z=1; } set(x,y,z){this.x=x;this.y=y;this.z=z;return this;} setScalar(s){this.x=s;this.y=s;this.z=s;return this;} }
class Obj3{ constructor(){ this.position=new P3(); this.rotation=new Rot(); this.scale=new Scl(); this.quaternion=new Quat(); this.children=[]; this.parent=null; this.matrix={}; this.castShadow=false; this.receiveShadow=false; this.visible=true; this.renderOrder=0; this.userData={}; this.updateMatrix=()=>{}; }
add(m){ this.children.push(m); m.parent=this; } remove(m){ const i=this.children.indexOf(m); if(i>=0){ this.children.splice(i,1); m.parent=null; } }
traverse(fn){ fn(this); for(const c of this.children) if(c.traverse) c.traverse(fn); } }
class Geo{ constructor(...a){ this.parameters={width:a[0]||1,height:a[1]||1,depth:a[2]||1}; this.attributes={}; } translate(){return this;} rotateX(){return this;} rotateY(){return this;} setAttribute(n,a){ this.attributes[n]=a; return this; } computeVertexNormals(){return this;} }
class PlaneGeo extends Geo{ constructor(w=1,h=1,sg=1,sh=1){ super(w,h); const gx=(sg||1)+1, gy=(sh||1)+1; this.attributes={position:{count:gx*gy,array:new Float32Array(gx*gy*3),getX:i=>((i%gx)/gx-0.5)*w,getZ:i=>(Math.floor(i/gx)/gy-0.5)*h,getY:()=>0,setY(){},setX(){},setZ(){}}}; } }
return {
Group:class extends Obj3{}, Mesh:class extends Obj3{ constructor(g,m){ super(); this.geometry=g||new Geo(); this.material=m||{}; } },
InstancedMesh:class extends Obj3{ constructor(g,m,n){ super(); this.geometry=g; this.material=m; this.count=n; } setMatrixAt(){} },
Object3D:Obj3, Vector3:P3, Quaternion:Quat, CanvasTexture:class{ constructor(c){ this.image=c; } },
Euler:class{ set(){ return this; } },
Matrix4:class{ compose(){ return this; } },
BoxGeometry:Geo, CylinderGeometry:Geo, PlaneGeometry:PlaneGeo, SphereGeometry:Geo, ConeGeometry:Geo, TorusGeometry:Geo, CircleGeometry:Geo,
MeshLambertMaterial:class{ constructor(o){ Object.assign(this,o||{}); if(!this.color) this.color={set(){}}; } },
MeshBasicMaterial:class{ constructor(o){ Object.assign(this,o||{}); if(!this.color) this.color={set(){}}; } },
BufferGeometry:class{ constructor(){ this.attributes={}; } setAttribute(n,a){ this.attributes[n]=a; return this; } setIndex(){return this;} setFromPoints(){return this;} computeVertexNormals(){return this;} },
BufferAttribute:class{ constructor(a,n){ this.array=a; this.itemSize=n; } },
Float32BufferAttribute:class{},
};
}

function runCampaign(campIdx){
const fail=[];
const THREE=makeThreeStub();
const sandbox={
console,Math,JSON,location:{search:'?seed='+seed},
localStorage:{_s:{sf_campaign:String(campIdx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=v;}},
navigator:{},
document:{createElement:(t)=>t==='canvas'?({width:0,height:0,getContext:()=>({fillStyle:'',strokeStyle:'',lineWidth:1,font:'',textAlign:'',beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},stroke(){},fillRect(){},clearRect(){},fillText(){},arc(){},save(){},restore(){},translate(){},rotate(){},scale(){},closePath(){}})}):({})},
};
sandbox.globalThis=sandbox;
sandbox.THREE=THREE;
sandbox.scene=new THREE.Group();
sandbox.MAT={stone:{},wood:{},woodDark:{},roof:{},plaster:{},brick:{},sandbag:{},hay:{},metal:{},metalDark:{},bark:{},leaves:{},rubble:{},grass:{},earth:{},concrete:{}};
sandbox.TEX={leaves:{}};
sandbox.svgApply=(tex)=>tex;
sandbox.addSnowCap=()=>{};
sandbox.makeTex=()=>({});
sandbox.wires=[];
sandbox.camera={position:{x:0,y:0,z:0}};
sandbox.player={alive:true,pos:{x:0,z:0}};
sandbox.AudioSys={explosion(){}}; sandbox.addTrauma=()=>{}; sandbox.spawnP=()=>{}; sandbox.PT={};
sandbox.spawnWallDebris=()=>{};
sandbox.TAU=Math.PI*2; sandbox.HPI=Math.PI/2;
sandbox.V3=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
sandbox.window={RGRID_OFF:undefined,HGRID_OFF:undefined}; // 03-terrain/04-collision 的调试旁路开关读取
const ctx=vm.createContext(sandbox);
// 真实脚本链: 03-terrain 本体提供 heightAt/BOXES/CYLS/TRENCHES/OCC/HGRID/桥面抬升
const files=['js/00-config.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js'];
for(const f of files) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
const camp=vm.runInContext('CAMPAIGN',ctx);
const heightAt=vm.runInContext('heightAt',ctx);
const BOXES=vm.runInContext('BOXES',ctx), ST=vm.runInContext('STAIRS',ctx), REG=vm.runInContext('BUILD_REG',ctx);
const BRIDGES=vm.runInContext('BRIDGES',ctx);
const onBridge=vm.runInContext('onBridge',ctx), bridgeDeckY=vm.runInContext('bridgeDeckY',ctx);
const segD=(px,pz,ax,az,bx,bz)=>{const abx=bx-ax,abz=bz-az;const t=Math.max(0,Math.min(1,((px-ax)*abx+(pz-az)*abz)/(abx*abx+abz*abz||1)));return Math.hypot(px-(ax+abx*t),pz-(az+abz*t));};

// ── ① stairFlight v4: 踏步厚度仅报告 (贴地封底后梯脚 legitimately 加厚, 锚定断言兜底) ──
let stairN=0, maxH=0;
for(const b of BOXES){ if(!b.stair) continue; stairN++; const h=b.maxY-b.minY; if(h>maxH) maxH=h; }
console.log(`  踏步盒 ${stairN} 个, 最厚 ${maxH.toFixed(2)}m`);

// ── ② 楼梯锚定: 每级踏步必须 ①落地( minY-地面≤0.35 ) 或 ②踩在非梯盒上 或
//     ③经"咬合链"(相邻/重叠盒, 顶面≈本步底面) 连回 ①② —— 锯齿踏步靠链回落地首步 ──
const stairs=BOXES.filter(b=>b.stair&&!b.dead);
const others=BOXES.filter(b=>!b.stair&&!b.dead);
const overlapXZ=(a,b)=>Math.min(a.maxX,b.maxX)-Math.max(a.minX,b.minX);
const overlapZ=(a,b)=>Math.min(a.maxZ,b.maxZ)-Math.max(a.minZ,b.minZ);
const restsOn=(b,o,gap=0.12,dy=0.09)=> overlapXZ(b,o)>-gap&&overlapZ(b,o)>-gap&&Math.abs(o.maxY-b.minY)<=dy&&(overlapXZ(b,o)>0.01&&overlapZ(b,o)>0.01||overlapXZ(b,o)>-gap&&overlapZ(b,o)>-gap);
const anchored=new Set();
for(const b of stairs){
if(b.minY-heightAt((b.minX+b.maxX)/2,(b.minZ+b.maxZ)/2)<=0.35) anchored.add(b);
else for(const o of others){ if(overlapXZ(b,o)>0.01&&overlapZ(b,o)>0.01&&Math.abs(o.maxY-b.minY)<=0.09){ anchored.add(b); break; } }
}
let grew=true;
while(grew){ grew=false;
for(const b of stairs){ if(anchored.has(b)) continue;
for(const s2 of stairs){ if(!anchored.has(s2)) continue; if(restsOn(b,s2)){ anchored.add(b); grew=true; break; } }
if(!anchored.has(b)) for(const o of others){ if(restsOn(b,o,0.12,0.09)){ anchored.add(b); grew=true; break; } }
}
}
for(const b of stairs) if(!anchored.has(b)) fail.push(`浮空踏步 @(${((b.minX+b.maxX)/2).toFixed(1)},${((b.minZ+b.maxZ)/2).toFixed(1)}) 底 ${b.minY.toFixed(2)} 无承托`);

// ── ②B 楼梯贯通: 每条登记梯段两段验证 ——
//    爬坡段: 沿梯轴 (梯脚→顶踏步) 逐 0.25m 采样, 塌落 >0.3m = 梯道断口, 且须升至 topY±0.35;
//    登顶段: 顶踏步中心→登顶出口逐 0.3m 采样, 每点脚下须有 ≥topY−0.6 的实体 (抓"梯顶到楼板天井")
{
const stairTopAt=(px,pz,curY)=>{
let h=heightAt(px,pz);
for(const b of BOXES){ if(b.dead) continue;
if(px>b.minX-0.05&&px<b.maxX+0.05&&pz>b.minZ-0.05&&pz<b.maxZ+0.05){
if(b.maxY<=curY+0.55&&b.maxY>h) h=b.maxY;
}
}
return h;
};
for(const s of ST){
if(s.fx===undefined) continue;
const dx=s.tx-s.fx, dz=s.tz-s.fz;
const len=Math.hypot(dx,dz)||1;
const ux=dx/len, uz=dz/len;
// curY 从梯段 base 起步 (上层梯脚悬于地表之上; base=topY−n·sr), 地表更高时取地表
let curY=Math.max(heightAt(s.fx,s.fz), s.topY-s.n*s.sr), reached=false, bad=null;
for(let t2=0.2;t2<=len+0.45;t2+=0.25){
const h=stairTopAt(s.fx+ux*t2,s.fz+uz*t2,curY);
if(h<curY-0.3){ bad=`爬坡 ${t2.toFixed(1)}m 处塌落至 ${h.toFixed(2)} (原 ${curY.toFixed(2)})`; break; }
curY=h;
if(curY>=s.topY-0.35){ reached=true; break; }
}
if(!bad&&!reached) bad=`爬坡 ${len.toFixed(1)}m 未见顶步 (止于 ${curY.toFixed(2)} / 梯顶 ${s.topY.toFixed(2)})`;
if(!bad){
const lx2=s.x-s.tx, lz2=s.z-s.tz;
const llen=Math.hypot(lx2,lz2)||1;
for(let t2=0;t2<=llen;t2+=0.3){
const px=s.tx+lx2/llen*t2, pz=s.tz+lz2/llen*t2;
if(stairTopAt(px,pz,s.topY+0.55)<s.topY-0.6){ bad=`登顶段 ${t2.toFixed(1)}m 处脚下无实体 (天井断口)`; break; }
}
}
if(bad) fail.push(`梯段断口 @(${s.fx.toFixed(1)},${s.fz.toFixed(1)})→(${s.x.toFixed(1)},${s.z.toFixed(1)}): ${bad}`);
}
}

// ── ②C 斜置坡面碰撞覆盖: 造 ry=0.7 的 10×13 坡顶, 两坡×3带×带内缘点扫描必须有碰撞带 ──
//    (旧 pitchedRoof chain=1.6 强制单排链, 斜置宽坡带缘两侧无碰撞, 上坡即坠穿)
{
vm.runInContext(`(function(){
pitchedRoof(bctx(500,500,0.7,0),{axis:'x',w:10,d:13,y0:3,rise:1.9,mat:MAT.wood,over:0.5});
})()`,ctx);
const c2=vm.runInContext('bctx(500,500,0.7,0)',ctx);
const span=13/2+0.5, rise=1.9, y0=3, band=span/3;
let miss=0, tot=0;
for(const sgn of [1,-1]) for(let k=0;k<3;k++){
const uc=(k+0.5)*band; // 带中心 (坡向)
// 采样带核心+0.15 内缩缘: 带缘最外 0.13 的格子相位针脚 (≤0.2 宽, 与全游戏旋转楼板同水平) 不追究
for(const u of [uc-band/2+0.15, uc, uc+band/2-0.15]){
for(let a=-5;a<=5;a+=1.0){
tot++;
const p=c2.L(a,sgn*u);
const planeY=y0+rise*(1-u/span);
let hit=false;
for(const b of BOXES){
// 0.15 容差 ≈ 玩家半径+standHeight 盒扩边 (针孔级豁口可容忍, 带状裸带不可)
if(p[0]>b.minX-0.15&&p[0]<b.maxX+0.15&&p[1]>b.minZ-0.15&&p[1]<b.maxZ+0.15){
if(b.maxY>planeY-1.2&&b.maxY<planeY+0.7){ hit=true; break; }
}
}
if(!hit) miss++;
}
}
}
if(miss>0) fail.push(`斜置坡面 ${miss}/${tot} 采样点无碰撞带 (pitchedRoof 贴片未铺满)`);
}

// ── ③ 淞沪石拱桥: 垂直跨河 (桥身不得顺河躺) + 桥面/河床/两岸高差可通行 ──
if(camp.id==='songhu'){
if(BRIDGES.length!==2) fail.push(`石拱桥应为 2 座, 实为 ${BRIDGES.length}`);
for(const B of BRIDGES){
const dx=Math.sin(B.yaw), dz=Math.cos(B.yaw);
const dy=bridgeDeckY(B);
const bed=heightAt(B.x,B.z,true);
const label=`桥@(${B.x},${B.z})`;
if(onBridge(B.x,B.z)===false) fail.push(`${label} 桥心不在桥面上`);
if(dy-bed<1.2||dy-bed>4.6) fail.push(`${label} 桥面-河床高差 ${ (dy-bed).toFixed(2) } 异常 (下切2.8±, 圩田处可叠至4.1; 过小=桥躺河床)`);
// 跨河: 跨中无桥地面须明显低于两岸桥头 (顺河躺的桥跨中取不到下切)
const gA=heightAt(B.x+dx*(B.len/2+2.5),B.z+dz*(B.len/2+2.5),true);
const gB=heightAt(B.x-dx*(B.len/2+2.5),B.z-dz*(B.len/2+2.5),true);
if(bed>Math.min(gA,gB)-1.0) fail.push(`${label} 跨中地面 (${bed.toFixed(2)}) 未低于两岸 (${gA.toFixed(2)}/${gB.toFixed(2)}) → 未垂直跨河`);
// 桥身沿轴线不得延伸出桥头还压着河道 (顺河躺的桥两端仍在水上)
for(const s2 of [-1,1]){
const ex=B.x+dx*s2*(B.len/2+2.5), ez=B.z+dz*s2*(B.len/2+2.5);
if(onBridge(ex,ez)!==false) fail.push(`${label} 桥头外沿仍在桥面矩形内 (桥矩形异常)`);
const gEnd=heightAt(ex,ez,true);
const rise=dy-gEnd;
if(rise>2.5||rise<-0.5) fail.push(`${label} ${s2>0?'+':'-'}端落地跌差 ${rise.toFixed(2)} 超引桥坡道量程 (±2.5/−0.5)`);
}
// 桥身法向 (即河流向) 离开桥宽即不在桥上 —— 垂直性直检
const px=B.x+dz*(B.w/2+2.5), pz=B.z-dx*(B.w/2+2.5);
if(onBridge(px,pz)!==false) fail.push(`${label} 桥侧向 ${ (B.w/2+2.5).toFixed(1) }m 处仍在桥面内 (朝向/宽度异常)`);
}
}

// ── ④ 丝厂: 二跑梯 (topY≈屋面) 首步必须踩在二层楼板 (maxY≈F2 的非梯盒) 上 ──
if(camp.id==='songhu'){
const sf=REG.find(r=>r.type==='silkFactory');
if(!sf) fail.push('丝厂未注册 (BUILD_REG 无 silkFactory)');
else{
const near=ST.filter(s=>Math.hypot(s.x-sf.x,s.z-sf.z)<22);
if(near.length!==2) fail.push(`丝厂梯段应登记 2 跑, 实为 ${near.length}`);
const up=near.find(s=>Math.abs(s.topY-(sf.roofY||0))<0.6); // 二跑: 登屋顶
if(!up) fail.push('丝厂未找到登屋顶梯段 (STAIRS topY≈roofY)');
else{
// 首步盒: 梯段线上距梯脚 (fx,fz) 最近且最矮的踏步
let foot=null;
for(const b of BOXES){ if(!b.stair) continue;
const bx=(b.minX+b.maxX)/2, bz=(b.minZ+b.maxZ)/2;
if(Math.hypot(bx-up.fx,bz-up.fz)<1.6&&(!foot||b.maxY<foot.maxY)) foot=b;
}
if(!foot) fail.push('丝厂二跑梯未找到首步踏步盒');
else{
let slab=null;
for(const o of BOXES){ if(o.stair||o.dead) continue;
if(overlapXZ(foot,o)>0.01&&overlapZ(foot,o)>0.01&&Math.abs(o.maxY-foot.minY)<=0.09){ slab=o; break; } }
if(!slab) fail.push(`丝厂二跑梯首步仍悬空 (底 ${foot.minY.toFixed(2)} @(${up.fx.toFixed(1)},${up.fz.toFixed(1)}), 下方无二层楼板)`);
}
}
}
}
return fail;
}

const campList=[['normandy',0],['stalingrad',1],['berlin',2],['songhu',3],['baituan',4],['burma',5],['moscow',6],['hukawng',7],['steppe',8],['woodline',9],['canyon',10]];
let bad=0;
for(const [name,idx] of campList){
const t0=Date.now();
let fail=[];
try{ fail=runCampaign(idx); }catch(e){ fail=['探针异常: '+e.message]; }
if(fail.length){ bad++; console.log(`${name.padEnd(11)}FAIL  ${fail.join(' | ')}`); }
else console.log(`${name.padEnd(11)}PASS  (${Date.now()-t0}ms)`);
}
console.log(bad?`SONGHU-FIX PROBE: ${bad} CAMPAIGN(S) FAILED`:'SONGHU-FIX PROBE: ALL PASSED');
process.exit(bad?1:0);
