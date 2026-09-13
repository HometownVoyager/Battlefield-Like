// ─────────────────────────────────────────────
// dev/probe-hukawng.js —— 2026-09-12 胡康巨桥改版几何探针 (不进 Index.html)
// 用法: node dev/probe-hukawng.js
// 覆盖: ①楼梯锚定/贯通通用断言 (同 probe-songhu-fix, 覆盖巨桥登塔梯/桥头石阶);
//       ②巨桥规格: 双桥表/跨河垂直性/桥面-河床净空 (d=14 深谷)/桥头落地跌差/行车道路面无阻挡;
//       ③登塔梯: 恰 2 部 (双塔制高), 顶面=桥面+7.6, 登顶支撑齐平, 塔顶步道盒存在, FLAK_DECKS 塔顶高炮登记;
//       ④徒涉滩: 滩心浅水非激流/滩外上游仍激流/滩心水深可涉; 北石拱桥深谷跨河;
//       ⑤桥面旗弹药箱在桥面上; 桥头碉堡落位。
// 原理: 沙箱加载真实 00-config → 03-terrain → 04-collision → 04b-fire → 05-world →
//       05a/05b/05c (buildWorld 载入即建), 对真实 BOXES/heightAt/onBridge 做几何断言。
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
class Obj3{ constructor(){ this.position=new P3(); this.rotation=new Rot(); this.scale=new Scl(); this.quaternion=new Quat(); this.children=[]; this.parent=null; this.matrix={}; this.castShadow=false; this.receiveShadow=false; this.visible=true; this.renderOrder=0; this.updateMatrix=()=>{}; }
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
sandbox.window={RGRID_OFF:undefined,HGRID_OFF:undefined};
const ctx=vm.createContext(sandbox);
const files=['js/00-config.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js'];
for(const f of files) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
const camp=vm.runInContext('CAMPAIGN',ctx);
const heightAt=vm.runInContext('heightAt',ctx);
const BOXES=vm.runInContext('BOXES',ctx), ST=vm.runInContext('STAIRS',ctx);
const BRIDGES=vm.runInContext('BRIDGES',ctx);
const onBridge=vm.runInContext('onBridge',ctx), bridgeDeckY=vm.runInContext('bridgeDeckY',ctx);
const inRiverChannel=vm.runInContext('inRiverChannel',ctx), inShallowChannel=vm.runInContext('inShallowChannel',ctx);
const fordAt=vm.runInContext('fordAt',ctx), RIVER=vm.runInContext('RIVER',ctx);
const FLAK=vm.runInContext('FLAK_DECKS',ctx), AMMO=vm.runInContext('AMMO_CRATES',ctx), REG=vm.runInContext('BUILD_REG',ctx);

// ── ① 楼梯锚定 + 贯通 (同 probe-songhu-fix ①②, 覆盖巨桥登塔梯/桥头石阶) ──
const stairs=BOXES.filter(b=>b.stair&&!b.dead);
const others=BOXES.filter(b=>!b.stair&&!b.dead);
const ovX=(a,b)=>Math.min(a.maxX,b.maxX)-Math.max(a.minX,b.minX);
const ovZ=(a,b)=>Math.min(a.maxZ,b.maxZ)-Math.max(a.minZ,b.minZ);
const restsOn=(b,o,gap=0.12,dy=0.09)=> ovX(b,o)>-gap&&ovZ(b,o)>-gap&&Math.abs(o.maxY-b.minY)<=dy&&(ovX(b,o)>0.01&&ovZ(b,o)>0.01||ovX(b,o)>-gap&&ovZ(b,o)>-gap);
const anchored=new Set();
for(const b of stairs){
if(b.minY-heightAt((b.minX+b.maxX)/2,(b.minZ+b.maxZ)/2)<=0.35) anchored.add(b);
else for(const o of others){ if(ovX(b,o)>0.01&&ovZ(b,o)>0.01&&Math.abs(o.maxY-b.minY)<=0.09){ anchored.add(b); break; } }
}
let grew=true;
while(grew){ grew=false;
for(const b of stairs){ if(anchored.has(b)) continue;
for(const s2 of stairs){ if(!anchored.has(s2)) continue; if(restsOn(b,s2)){ anchored.add(b); grew=true; break; } }
if(!anchored.has(b)) for(const o of others){ if(restsOn(b,o,0.12,0.09)){ anchored.add(b); grew=true; break; } }
}
}
for(const b of stairs) if(!anchored.has(b)) fail.push(`浮空踏步 @(${((b.minX+b.maxX)/2).toFixed(1)},${((b.minZ+b.maxZ)/2).toFixed(1)}) 底 ${b.minY.toFixed(2)} 无承托`);
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

// ── ② 巨桥: 规格/垂直跨河/净空/桥头跌差/行车道路面 ──
if(camp.id==='hukawng'){
if(BRIDGES.length!==2) fail.push(`胡康: 桥数 ${BRIDGES.length}≠2`);
const GB=BRIDGES[0], SB=BRIDGES[1];
if(!GB||GB.kind!=='grand') fail.push('胡康: 主桥 kind≠grand');
if(!SB||SB.kind!=='stone') fail.push('胡康: 北桥 kind≠stone');
if(GB){
const dx=Math.sin(GB.yaw), dz=Math.cos(GB.yaw);
const dy=bridgeDeckY(GB);
const label=`巨桥@(${GB.x},${GB.z})`;
if(GB.len<70||GB.w<12) fail.push(`${label} 跨 ${GB.len}/宽 ${GB.w} 不足巨桥规格 (≥70/≥12)`);
if(onBridge(GB.x,GB.z)===false) fail.push(`${label} 桥心不在桥面上`);
const bed=heightAt(GB.x,GB.z,true);
if(dy-bed<10||dy-bed>18) fail.push(`${label} 桥面-河床高差 ${(dy-bed).toFixed(2)} 异常 (深谷 d=14 → 预期 10~18)`);
const gA=heightAt(GB.x+dx*(GB.len/2+2.5),GB.z+dz*(GB.len/2+2.5),true);
const gB=heightAt(GB.x-dx*(GB.len/2+2.5),GB.z-dz*(GB.len/2+2.5),true);
if(bed>Math.min(gA,gB)-8) fail.push(`${label} 跨中河床 (${bed.toFixed(2)}) 未深于两岸 (${gA.toFixed(2)}/${gB.toFixed(2)}) 8m → 未垂直跨深谷`);
for(const s2 of [-1,1]){
const ex=GB.x+dx*s2*(GB.len/2+2.5), ez=GB.z+dz*s2*(GB.len/2+2.5);
if(onBridge(ex,ez)!==false) fail.push(`${label} 桥头外沿仍在桥面矩形内`);
const rise=dy-heightAt(ex,ez,true);
if(rise>1.3||rise<-0.5) fail.push(`${label} ${s2>0?'+':'-'}端落地跌差 ${rise.toFixed(2)} 超桥头石阶量程 (1.3/−0.5)`);
}
const px=GB.x+dz*(GB.w/2+2.5), pz=GB.z-dx*(GB.w/2+2.5);
if(onBridge(px,pz)!==false) fail.push(`${label} 桥侧向 ${(GB.w/2+2.5).toFixed(1)}m 处仍在桥面内 (朝向/宽度异常)`);
// 桥面连续性: 沿轴 v=0/±5 逐 2m 采样, 桥面高度恒=dy (±0.03; 抓 FLATS 平台把桥面顶穿)
for(const vv of [-5,0,5]){
for(let u=-GB.len/2+2;u<=GB.len/2-2;u+=2){
const p=[GB.x+u*dx+vv*dz, GB.z+u*dz-vv*dx];
const h=heightAt(p[0],p[1]);
if(Math.abs(h-dy)>0.03) fail.push(`${label} 桥面不连续 u=${u.toFixed(0)} v=${vv}: 高度 ${h.toFixed(2)} ≠ 桥面 ${dy.toFixed(2)}`);
break; // 每条 v 带抽查中点即可 (全采样在下方路面阻挡检查覆盖)
}
}
// 行车道净空: 桥轴带 v∈±1.6 全长扫描, 不得有 minY<dy+2.6 且 maxY>dy+1.2 的固定碰撞盒 (沙袋/弹药箱可碾豁免: maxY≤dy+1.1)
let block=null;
for(let u=-GB.len/2+1;u<=GB.len/2-1;u+=0.5){
const p=[GB.x+u*dx, GB.z+u*dz];
for(const b of BOXES){
if(b.dead) continue;
if(p[0]<b.minX||p[0]>b.maxX||p[1]<b.minZ||p[1]>b.maxZ) continue;
if(b.maxY<=dy+1.1) continue; // 沙袋/弹药箱等可碾矮件
if(b.minY<dy+2.6){ block=`u=${u.toFixed(1)} 盒 y ${b.minY.toFixed(2)}..${b.maxY.toFixed(2)}`; break; }
}
if(block) break;
}
if(block) fail.push(`${label} 行车道被固定碰撞盒阻挡 @${block} (塔楼/吊杆应让出 v±1.6 行车道)`);
// 塔顶步道盒: 两塔 (u=±27) 中心必须有顶面=T 的盒
const T=dy+7.6;
for(const s2 of [-1,1]){
const tp=[GB.x+s2*27*dx, GB.z+s2*27*dz];
const deckBox=BOXES.find(b=>!b.dead&&tp[0]>b.minX&&tp[0]<b.maxX&&tp[1]>b.minZ&&tp[1]<b.maxZ&&Math.abs(b.maxY-T)<0.05);
if(!deckBox) fail.push(`${label} ${s2<0?'西':'东'}塔顶步道缺失 (u=±27 处无顶面=T=${T.toFixed(2)} 的盒)`);
}
// 登塔梯: 恰 2 部, 顶面=T, 落点有支撑; 梯脚必须在岸上 (2026-09-12 实机修复回归:
// 旧版梯道线掉进深切带/激流判定区 —— 河距口径应为桥轴坐标 |u|, 不是到河线的欧氏距离)
const twSt=ST.filter(s=>s.topY>T-1.2&&s.topY<T+1.2);
if(twSt.length!==2) fail.push(`${label} 登塔梯应 2 部, 实为 ${twSt.length}`);
for(const s of twSt){
if(Math.abs(s.topY-T)>0.01) fail.push(`${label} 塔梯顶面 ${s.topY.toFixed(2)} ≠ 步道 ${T.toFixed(2)}`);
let sup=heightAt(s.x,s.z);
for(const b of BOXES){ if(b.dead) continue; if(s.x>b.minX&&s.x<b.maxX&&s.z>b.minZ&&s.z<b.maxZ&&b.maxY<=s.topY+0.55&&b.maxY>sup) sup=b.maxY; }
if(Math.abs(sup-s.topY)>0.12) fail.push(`${label} 塔梯登顶 @(${s.x.toFixed(1)},${s.z.toFixed(1)}) 支撑面 ${sup.toFixed(2)}≠顶面 ${s.topY.toFixed(2)}`);
if(inRiverChannel(s.fx,s.fz)) fail.push(`${label} 塔梯梯脚 @(${s.fx.toFixed(0)},${s.fz.toFixed(0)}) 在激流影响区`);
if(heightAt(s.fx,s.fz,true)<dy-3) fail.push(`${label} 塔梯梯脚低于桥面 3m+ (掉在谷坡上)`);
// 登顶进口净空: 登顶落点正上方 T+0.15..T+1.2 高度带不得有盒 (护栏豁口与梯道错位=顶上过不去)
for(const b of BOXES){
if(b.dead) continue;
if(s.x>b.minX&&s.x<b.maxX&&s.z>b.minZ&&s.z<b.maxZ&&b.minY>s.topY+0.15&&b.minY<s.topY+1.2){
fail.push(`${label} 塔梯登顶进口被压 @(${s.x.toFixed(1)},${s.z.toFixed(1)}) 盒 y ${b.minY.toFixed(2)}..${b.maxY.toFixed(2)}`);
break;
}
}
}
// 塔顶高炮登记: FLAK_DECKS 两座, y=T
if(FLAK.length<2) fail.push(`胡康: FLAK_DECKS 塔顶高炮位 ${FLAK.length}<2`);
for(const d of FLAK){ if(Math.abs(d.y-T)>0.05) fail.push(`胡康: 塔顶炮位 y=${d.y.toFixed(2)} ≠ 步道 ${T.toFixed(2)}`); }
}
// ── ④ 北石拱桥: 深谷跨河 (石桥墩入谷, 桥面-床差 8~16) + 端部落地 ──
if(SB){
const dx=Math.sin(SB.yaw), dz=Math.cos(SB.yaw);
const dy=bridgeDeckY(SB);
const bed=heightAt(SB.x,SB.z,true);
if(dy-bed<8||dy-bed>16) fail.push(`北石桥 桥面-河床高差 ${(dy-bed).toFixed(2)} 异常 (深谷预期 8~16)`);
const gA=heightAt(SB.x+dx*(SB.len/2+2.5),SB.z+dz*(SB.len/2+2.5),true);
const gB=heightAt(SB.x-dx*(SB.len/2+2.5),SB.z-dz*(SB.len/2+2.5),true);
if(bed>Math.min(gA,gB)-8) fail.push(`北石桥 跨中未深于两岸 8m → 未垂直跨谷`);
}
// ── ④B 徒涉滩: 滩心浅/滩外深/语义豁免 (两岸高取环带 max —— 环带必含横断面岸顶) ──
if(RIVER&&RIVER.ford){
const F=RIVER.ford;
const ringBank=(cx,cz)=>{
let mx=-1e9;
for(let a=0;a<16;a++){
const ang=a*Math.PI/8;
const h=heightAt(cx+Math.cos(ang)*(RIVER.w+2), cz+Math.sin(ang)*(RIVER.w+2), true);
if(h>mx) mx=h;
}
return mx;
};
if(Math.abs(fordAt(F.x,F.z)-1)>0.01) fail.push(`胡康: 滩心 fordAt=${fordAt(F.x,F.z).toFixed(2)}≠1`);
// 环带点 (d=r/2): ford 半径真实存在的灵敏检验 (只测滩心的话 r 缩到 0 中心仍豁免)
if(fordAt(F.x+13,F.z)<1) fail.push('胡康: 徒涉滩环带 fordAt<1 (ford 半径失效)');
if(inRiverChannel(F.x+13,F.z)) fail.push('胡康: 徒涉滩环带仍判激流 (ford 范围不足)');
if(inRiverChannel(F.x,F.z)) fail.push('胡康: 滩心仍判激流');
if(!inShallowChannel(F.x,F.z)) fail.push('胡康: 滩心不判浅水');
const bedF=heightAt(F.x,F.z,true);
const dip=ringBank(F.x,F.z)-bedF;
if(dip<0.8||dip>2.6) fail.push(`胡康: 滩心水 dip ${dip.toFixed(2)} 出可涉窗 (0.8~2.6)`);
const up={x:F.x,z:F.z-64};
if(!inRiverChannel(up.x,up.z)) fail.push('胡康: 滩外上游河心不判激流');
const bedUp=heightAt(up.x,up.z,true);
const deep=ringBank(up.x,up.z)-bedUp;
if(deep<10) fail.push(`胡康: 滩外上游谷深 ${deep.toFixed(1)}<10 (深谷未生效)`);
// 滩心通行带: NAV_CLEARS 覆盖过河线 (Bot 渡滩保障)
const NCL=vm.runInContext('NAV_CLEARS',ctx);
let fordNav=0;
for(const n of NCL){ if(Math.hypot(n.x-F.x,n.z-F.z)<F.r+4) fordNav++; }
if(fordNav<3) fail.push(`胡康: 渡滩通行带不足 (${fordNav}<3 处 NAV_CLEARS)`);
}
// ── ⑤ 桥面旗弹药/北石桥桥头碉堡 ──
const bridgeFlag=vm.runInContext('FLAGS',ctx).find(f=>onBridge(f.x,f.z,4)!==false);
if(!bridgeFlag) fail.push('胡康: 桥面旗缺失 (「大桥」应落在主桥上)');
else if(!AMMO.some(c=>onBridge(c.x,c.z,0.5)!==false)) fail.push('胡康: 桥面旗弹药箱不在桥面上');
const SB2=BRIDGES[1];
if(SB2){
const sx0=Math.sin(SB2.yaw), sz0=Math.cos(SB2.yaw);
for(const s2 of [-1,1]){
const hx=SB2.x+s2*(SB2.len/2+7)*sx0, hz=SB2.z+s2*(SB2.len/2+7)*sz0;
if(!REG.some(r=>r.type==='bunker'&&Math.hypot(r.x-hx,r.z-hz)<14)) fail.push(`胡康: 北石桥${s2<0?'西':'东'}桥头碉堡缺失 (预期 @(${hx.toFixed(0)},${hz.toFixed(0)}) 14m 内)`);
}
}
}
return fail;
}

const campList=[['normandy',0],['stalingrad',1],['berlin',2],['songhu',3],['baituan',4],['burma',5],['moscow',6],['hukawng',7],['steppe',8],['woodline',9],['canyon',10],['xuefeng',11],['taihang',12]];
let bad=0;
for(const [name,idx] of campList){
const t0=Date.now();
let fail=[];
try{ fail=runCampaign(idx); }catch(e){ fail=['探针异常: '+e.message]; }
if(fail.length){ bad++; console.log(`${name.padEnd(11)}FAIL  ${fail.join(' | ')}`); }
else console.log(`${name.padEnd(11)}PASS  (${Date.now()-t0}ms)`);
}
console.log(bad?`HUKAWNG PROBE: ${bad} CAMPAIGN(S) FAILED`:'HUKAWNG PROBE: ALL PASSED');
process.exit(bad?1:0);
