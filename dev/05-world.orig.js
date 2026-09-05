// ─────────────────────────────────────────────
// 05-world.js —— 世界构建/建筑/旗点/MG42
// 源: Index.original.html 第 1452-2340 行
// ─────────────────────────────────────────────
'use strict';
const world = new THREE.Group(); scene.add(world);
const NAV_CLEARS=[];
function mesh(geo,mat,x,y,z,ry=0,cast=true,recv=true){
const m=new THREE.Mesh(geo,mat);
m.position.set(x,y,z); m.rotation.y=ry;
m.castShadow=cast; m.receiveShadow=recv;
world.add(m); return m;
}
function solidBox(mat,w,h,d,x,y,z,ry=0){
const m=mesh(new THREE.BoxGeometry(w,h,d),mat,x,y,z,ry);
const sn=Math.sin(ry), cs=Math.cos(ry);
if(Math.abs(sn)<0.02||Math.abs(cs)<0.02){
const swap=Math.abs(sn)>0.5;
addBoxCollider(x,y,z, swap?d:w, h, swap?w:d);
} else {
const long=Math.max(w,d), short=Math.min(w,d);
const s=clamp(short,0.55,2.2);
const steps=Math.max(1,Math.round(long/s));
const dirX=w>=d?cs:sn, dirZ=w>=d?-sn:cs;
for(let i=0;i<steps;i++){
const t=steps===1?0:-long/2+s/2+i*(long-s)/(steps-1);
addBoxCollider(x+dirX*t,y,z+dirZ*t,s,h,s);
}
}
return m;
}
const coverPoints=[];
function addCoverAround(x,z,w,d,ry=0){
const cs=Math.cos(ry),sn=Math.sin(ry);
const off=[[0,d/2+0.9],[0,-d/2-0.9],[w/2+0.9,0],[-w/2-0.9,0]];
for(const o of off){
coverPoints.push({x:x+o[0]*cs+o[1]*sn, z:z-o[0]*sn+o[1]*cs});
}
}
const DESTRUCTIBLES=[];
let _dG=null;
function dBegin(){ _dG={meshes:[],bi:[],hp:230,cx:0,cz:0,n:0,dead:false}; }
function dBox(mat,w,h,d,x,y,z,ry){
const before=BOXES.length;
const m=solidBox(mat,w,h,d,x,y,z,ry);
for(let i=before;i<BOXES.length;i++) _dG.bi.push(i);
_dG.meshes.push(m);
_dG.cx+=x; _dG.cz+=z; _dG.n++;
return m;
}
function dEnd(pre){
const g=_dG; _dG=null;
if(!g||!g.n) return null;
g.cx/=g.n; g.cz/=g.n;
DESTRUCTIBLES.push(g);
for(const bi2 of g.bi){ if(BOXES[bi2]) BOXES[bi2].dGroup=g; }
if(pre) destroyStructure(g,true);
return g;
}
function destroyStructure(g,silent){
if(g.dead) return; g.dead=true;
for(const m of g.meshes){
// 墙体拆成物理碎块坍塌 (cannon可用时)
if(!silent) spawnWallDebris(m,g.cx,g.cz);
world.remove(m);
}
for(const i of g.bi){
const b=BOXES[i]; b.dead=true;
if(OCC.data){
const i0=clamp(Math.floor((b.minX-0.7+OCC.off)/OCC.res),0,OCC.N-1),i1=clamp(Math.ceil((b.maxX+0.7+OCC.off)/OCC.res),0,OCC.N-1);
const j0=clamp(Math.floor((b.minZ-0.7+OCC.off)/OCC.res),0,OCC.N-1),j1=clamp(Math.ceil((b.maxZ+0.7+OCC.off)/OCC.res),0,OCC.N-1);
for(let j=j0;j<=j1;j++)for(let i2=i0;i2<=i1;i2++) OCC.data[j*OCC.N+i2]=0;
}
b.minX=99999; b.minY=99999; b.minZ=99999; b.maxX=99999.1; b.maxY=99999.1; b.maxZ=99999.1;
}
const gy=heightAt(g.cx,g.cz);
for(let k=0;k<4;k++){
mesh(new THREE.BoxGeometry(rand(0.4,0.9),rand(0.25,0.55),rand(0.4,0.9)),Math.random()<0.5?MAT.rubble:MAT.brick,g.cx+rand(-1.8,1.8),gy+rand(0.1,0.35),g.cz+rand(-1.8,1.8),rand(0,3));
}
if(!silent){
// 崩塌灰尘: 底部滚出的浓尘 + 升腾烟柱 + 飞溅碎屑
for(let k=0;k<10;k++){
const a=rand(0,TAU), rr=rand(0.5,2.2);
spawnP(PT.dirt,g.cx+Math.sin(a)*rr,gy+rand(0.1,0.5),g.cz+Math.cos(a)*rr,Math.sin(a)*rand(1.5,3.5),rand(0.3,1.2),Math.cos(a)*rand(1.5,3.5),rand(0.7,1.2),2.2,rand(1.2,2),0.85,0.6);
}
for(let k=0;k<8;k++) spawnP(PT.smoke,g.cx+rand(-2,2),gy+rand(0.5,2.8),g.cz+rand(-2,2),rand(-0.6,0.6),rand(0.8,2),rand(-0.6,0.6),rand(1,1.6),2.8,rand(1.8,2.8),0.7,0.1);
for(let k=0;k<8;k++) spawnP(PT.dirt,g.cx+rand(-1.5,1.5),gy+rand(1,2.8),g.cz+rand(-1.5,1.5),rand(-4,4),rand(2,6),rand(-4,4),rand(0.3,0.55),0.5,rand(0.6,1),0.9,7);
AudioSys.explosion(Math.hypot(g.cx-camera.position.x,g.cz-camera.position.z)*0.7);
if(player.alive&&Math.hypot(g.cx-player.pos.x,g.cz-player.pos.z)<25) addTrauma(0.4);
}
// 承重墙被毁 → 屋顶随之坍塌
if(g.roofRef&&!g.roofRef.done){
g.roofRef.dead++;
if(g.roofRef.dead>=2){
g.roofRef.done=true;
const rms=Array.isArray(g.roofRef.m)?g.roofRef.m:[g.roofRef.m];
for(const rm of rms){
if(!silent&&rm.parent){
spawnWallDebris(rm,g.cx,g.cz);
for(let k=0;k<3;k++) spawnP(PT.dirt,rm.position.x+rand(-1.5,1.5),rm.position.y,rm.position.z+rand(-1.5,1.5),rand(-2,2),rand(0,2),rand(-2,2),rand(0.5,0.8),1.5,rand(0.8,1.2),0.85,3);
}
world.remove(rm);
}
}
}
}
function damageStructures(p,radius,amt){
for(const g of DESTRUCTIBLES){
if(g.dead) continue;
const d=Math.hypot(g.cx-p.x,g.cz-p.z);
if(d<radius+3){
g.hp-=amt*(1-d/(radius+3)*0.6);
if(g.hp<=0) destroyStructure(g);
}
}
}
function ruinedHouse(x,z,w,d,ry,mat,brokenLevel=0.3){
const g0=heightAt(x,z);
mesh(new THREE.BoxGeometry(w+0.5,1.6,d+0.5),MAT.stone,x,g0-0.7,z,ry,false,true);
const wallH=3.2, t=0.34;
const cs=Math.cos(ry),sn=Math.sin(ry);
const sides=[
{dx:0,dz:d/2,w:w,rot:0,door:true},{dx:0,dz:-d/2,w:w,rot:0},
{dx:-w/2,dz:0,w:d,rot:HPI},{dx:w/2,dz:0,w:d,rot:HPI},
];
const wallGs=[];
sides.forEach((s,idx)=>{
const wx=x+s.dx*cs+s.dz*sn, wz=z-s.dx*sn+s.dz*cs;
const wrot=ry+s.rot;
dBegin();
if(s.door){
const doorW=1.2, seg=(s.w-doorW)/2;
NAV_CLEARS.push({x:wx,z:wz,r:1.0});
dBox(mat,seg,wallH,t, wx+Math.cos(wrot)*(-(doorW+seg)/2), g0+wallH/2, wz-Math.sin(wrot)*(-(doorW+seg)/2), wrot);
dBox(mat,seg,1.1,t, wx+Math.cos(wrot)*((doorW+seg)/2), g0+0.55, wz-Math.sin(wrot)*((doorW+seg)/2), wrot);
dBox(mat,seg,0.9,t, wx+Math.cos(wrot)*((doorW+seg)/2), g0+wallH-0.45, wz-Math.sin(wrot)*((doorW+seg)/2), wrot);
dBox(mat,doorW,wallH-2.2,t, wx, g0+wallH-(wallH-2.2)/2, wz, wrot);
} else {
const winW=1.3, seg=(s.w-winW)/2;
dBox(mat,seg,wallH,t, wx+Math.cos(wrot)*(-(winW+seg)/2), g0+wallH/2, wz-Math.sin(wrot)*(-(winW+seg)/2), wrot);
dBox(mat,seg,wallH,t, wx+Math.cos(wrot)*((winW+seg)/2), g0+wallH/2, wz-Math.sin(wrot)*((winW+seg)/2), wrot);
dBox(mat,winW,1.1,t, wx, g0+0.55, wz, wrot);
dBox(mat,winW,0.9,t, wx, g0+wallH-0.45, wz, wrot);
}
wallGs.push(dEnd(idx>0&&Math.random()<brokenLevel*0.55));
});
const preDead=wallGs.filter(g=>g&&g.dead).length;
if(preDead<2&&Math.random()>brokenLevel*0.6){
const roof=mesh(new THREE.BoxGeometry(w*0.55,0.16,d+0.6),MAT.roof, x-w*0.22*cs, g0+wallH+0.5, z+w*0.22*sn, ry);
roof.rotation.z=0.42;
addSnowCap(roof);
const roofRef={m:roof,dead:preDead,done:false};
for(const g of wallGs) if(g&&!g.dead) g.roofRef=roofRef;
}
const cx2=x+rand(-w*0.2,w*0.2), cz2=z+rand(-d*0.2,d*0.2);
solidBox(MAT.woodDark,1.1,0.8,0.7,cx2,g0+0.4,cz2,rand(0,3));
addCoverAround(x,z,w,d,ry);
}
// 中式瓦房: 灰墙+双坡挑檐瓦顶 (墙体可摧毁, 顶随墙塌)
function cnHouse(x,z,ry,w=6,d=5){
const g0=heightAt(x,z);
mesh(new THREE.BoxGeometry(w+0.6,1.2,d+0.6),MAT.stone,x,g0-0.5,z,ry,false,true);
const H=2.6,t=0.32;
const cs=Math.cos(ry),sn=Math.sin(ry);
const L=(lx,lz)=>[x+lx*cs+lz*sn, z-lx*sn+lz*cs];
const wallGs=[];
let p;
dBegin();
const dw=1.1, seg=(w-dw)/2;
p=L(0,d/2); NAV_CLEARS.push({x:p[0],z:p[1],r:1.0});
p=L(-(dw+seg)/2,d/2); dBox(MAT.plaster,seg,H,t,p[0],g0+H/2,p[1],ry);
p=L((dw+seg)/2,d/2); dBox(MAT.plaster,seg,H,t,p[0],g0+H/2,p[1],ry);
p=L(0,d/2); dBox(MAT.plaster,dw,H-1.9,t,p[0],g0+H-(H-1.9)/2,p[1],ry);
wallGs.push(dEnd());
dBegin(); p=L(0,-d/2); dBox(MAT.plaster,w,H,t,p[0],g0+H/2,p[1],ry); wallGs.push(dEnd());
dBegin(); p=L(-w/2,0); dBox(MAT.plaster,t,H,d,p[0],g0+H/2,p[1],ry); wallGs.push(dEnd());
dBegin(); p=L(w/2,0); dBox(MAT.plaster,t,H,d,p[0],g0+H/2,p[1],ry); wallGs.push(dEnd());
// 双坡瓦顶(挑檐): 倾斜必须绕屋顶自身横轴 —— Euler 需用 YXZ 序,
// 否则默认 XYZ 序下 rotation.x 是绕世界X轴的倾角, 朝向≈90°的房子屋顶会横滚90°装反
p=L(0,d*0.27);
const r1=mesh(new THREE.BoxGeometry(w+1.3,0.13,d*0.66),MAT.roof,p[0],g0+H+0.4,p[1],ry);
r1.rotation.order='YXZ'; r1.rotation.x=0.4;
addSnowCap(r1);
p=L(0,-d*0.27);
const r2=mesh(new THREE.BoxGeometry(w+1.3,0.13,d*0.66),MAT.roof,p[0],g0+H+0.4,p[1],ry);
r2.rotation.order='YXZ'; r2.rotation.x=-0.4;
addSnowCap(r2);
p=L(0,0);
const ridge=mesh(new THREE.BoxGeometry(w+1.4,0.14,0.3),MAT.roof,p[0],g0+H+0.72,p[1],ry);
addSnowCap(ridge);
const roofRef={m:[r1,r2,ridge],dead:0,done:false};
for(const g of wallGs) if(g) g.roofRef=roofRef;
// 内饰
p=L(rand(-w*0.2,w*0.2),rand(-d*0.2,d*0.2));
solidBox(MAT.woodDark,1.1,0.7,0.6,p[0],g0+0.35,p[1],rand(0,3));
addCoverAround(x,z,w,d,ry);
}
// 工厂废墟: 砖墙骨架+高烟囱+机器残骸
function factoryRuin(x,z,ry){
ruinedHouse(x,z,10,13,ry,MAT.brick,0.55);
const cs=Math.cos(ry),sn=Math.sin(ry);
const cx2=x+6.8*cs+5*sn, cz2=z-6.8*sn+5*cs;
const g0=heightAt(cx2,cz2);
mesh(new THREE.CylinderGeometry(0.65,0.95,11,10),MAT.brick,cx2,g0+5.5,cz2);
mesh(new THREE.CylinderGeometry(0.72,0.7,0.5,10),MAT.stone,cx2,g0+10.6,cz2);
CYLS.push({x:cx2,z:cz2,r:1.0,y0:g0,y1:g0+11});
solidBox(MAT.metalDark,2.4,1.5,1.3, x+2*cs-2*sn, heightAt(x,z)+0.75, z-2*sn-2*cs, ry);
solidBox(MAT.metalDark,1.6,1.1,1.2, x-2.5*cs+3*sn, heightAt(x,z)+0.55, z+2.5*sn+3*cs, ry+0.4);
rubblePile(x-3*cs,z+3*sn,1.8);
coverPoints.push({x:cx2+2,z:cz2},{x:x,z:z});
}
// 战壕装饰: 沿沟沿沙包胸墙 + 弹药箱 + 掩体点
function decorateTrenches(){
for(const t of TRENCHES){
const len=Math.hypot(t.x2-t.x1,t.z2-t.z1);
if(len<1) continue;
const dx=(t.x2-t.x1)/len, dz=(t.z2-t.z1)/len;
const px=-dz, pz=dx;
const ry=Math.atan2(-dz,dx);
const n=Math.max(1,Math.floor(len/6));
for(let i=0;i<=n;i++){
const tt=i/n;
const cx=t.x1+(t.x2-t.x1)*tt, cz=t.z1+(t.z2-t.z1)*tt;
coverPoints.push({x:cx,z:cz});
if(i<n&&i%2===0) sandbagWall(cx+px*3.0+dx*3,cz+pz*3.0+dz*3,4,ry);
if(i<n&&i%3===1) sandbagWall(cx-px*3.0+dx*3,cz-pz*3.0+dz*3,4,ry);
}
crate(t.x1-dx*2+px*1.2,t.z1-dz*2+pz*1.2,1.1,ry);
barrel(t.x2+dx*2-px*1.2,t.z2+dz*2-pz*1.2);
}
}
function buildChurch(x,z,ry){const g0=heightAt(x,z);
// 教堂背面的门廊/钟塔偏移须随朝向旋转 (局部 -Z 为教堂正前方)
const rotL=(lx,lz)=>[x+lx*Math.cos(ry)+lz*Math.sin(ry), z-lx*Math.sin(ry)+lz*Math.cos(ry)];
mesh(new THREE.BoxGeometry(10.5,1.8,16.5),MAT.stone,x,g0-0.8,z,ry,false,true);
const bp=rotL(0,-16/2-3);
mesh(new THREE.BoxGeometry(4.5,1.8,5),MAT.stone,bp[0],g0-0.8,bp[1],ry,false,true);
const w=10,d=16,H=6;
solidBox(MAT.stone,0.5,H,d, x-w/2, g0+H/2, z, ry);
solidBox(MAT.stone,0.5,H,d, x+w/2, g0+H/2, z, ry);
solidBox(MAT.stone,w,H,0.5, x, g0+H/2, z-d/2, ry);
const dw=2.2, seg=(w-dw)/2;
NAV_CLEARS.push({x:x,z:z+d/2,r:1.6});
solidBox(MAT.stone,seg,H,0.5, x-(dw+seg)/2, g0+H/2, z+d/2, ry);
solidBox(MAT.stone,seg,H,0.5, x+(dw+seg)/2, g0+H/2, z+d/2, ry);
solidBox(MAT.stone,dw,H-3,0.5, x, g0+H-(H-3)/2, z+d/2, ry);
const roof=mesh(new THREE.BoxGeometry(w*0.6,0.2,d*0.55),MAT.roof,x-w*0.2,g0+H+0.7,z-d*0.2,ry);
roof.rotation.z=0.5;
addSnowCap(roof);
const tx=bp[0], tz=bp[1];
const th=10;
solidBox(MAT.stone,4,th,0.5,tx,g0+th/2,tz-2,0);
solidBox(MAT.stone,4,th,0.5,tx,g0+th/2,tz+2,0);
solidBox(MAT.stone,0.5,th,3.5,tx-2,g0+th/2,tz,0);
solidBox(MAT.stone,0.5,6,3.5,tx+2,g0+7,tz,0);
NAV_CLEARS.push({x:tx+2,z:tz,r:1.2});
solidBox(MAT.stone,4,0.4,2.6,tx,g0+th-2.5,tz-0.95,0);
solidBox(MAT.stone,1.7,0.4,1.9,tx+1.15,g0+th-2.5,tz+1.3,0);
solidBox(MAT.stone,4,0.9,0.3,tx,g0+th-1.6,tz-2.1,0);
solidBox(MAT.stone,4,0.9,0.3,tx,g0+th-1.6,tz+2.1,0);
solidBox(MAT.stone,0.3,0.9,4.5,tx-2.1,g0+th-1.6,tz,0);
solidBox(MAT.stone,0.3,0.9,4.5,tx+2.1,g0+th-1.6,tz,0);
for(let i=0;i<8;i++){
solidBox(MAT.woodDark,1.0,0.24,0.55, tx+1.2, g0+0.38+i*0.5, tz+1.4-i*0.4, 0);
}
solidBox(MAT.woodDark,2.3,0.24,0.9, tx+0.4, g0+4.13, tz-1.5, 0);
for(let i=0;i<7;i++){
solidBox(MAT.woodDark,1.0,0.24,0.55, tx-1.2, g0+4.63+i*0.5, tz-1.4+i*0.4, 0);
}
const spire=mesh(new THREE.ConeGeometry(2.6,3,4),MAT.woodDark,tx,g0+th+0.6,tz,Math.PI/4);
for(let i=0;i<4;i++){
const pp=rotL(rand(-1.5,1.5),-d/2+3+i*2.6);
solidBox(MAT.woodDark,3,0.5,0.5, pp[0], g0+0.25, pp[1], ry+rand(-0.2,0.2));
}
addCoverAround(x,z,w,d,ry);
coverPoints.push({x:tx,z:tz});
}
function buildBarn(x,z,ry){
const g0=heightAt(x,z);
mesh(new THREE.BoxGeometry(9.5,1.6,13.5),MAT.stone,x,g0-0.7,z,ry,false,true);
const w=9,d=13,H=4.2;
const cs=Math.cos(ry),sn=Math.sin(ry);
const L=(lx,lz)=>[x+lx*cs+lz*sn, z-lx*sn+lz*cs];
let p;
p=L(-w/2,0); solidBox(MAT.wood,0.35,H,d, p[0],g0+H/2,p[1], ry);
p=L(w/2,0);  solidBox(MAT.wood,0.35,H,d, p[0],g0+H/2,p[1], ry);
p=L(0,-d/2); solidBox(MAT.wood,w,H,0.35, p[0],g0+H/2,p[1], ry);
const seg=w*0.28;
p=L(-(w-seg)/2,d/2); solidBox(MAT.wood,seg,H,0.35, p[0],g0+H/2,p[1], ry);
p=L((w-seg)/2,d/2);  solidBox(MAT.wood,seg,H,0.35, p[0],g0+H/2,p[1], ry);
p=L(0,d/2); solidBox(MAT.wood,w-seg*2,1.0,0.35, p[0],g0+H-0.5,p[1], ry);
p=L(0,d/2); NAV_CLEARS.push({x:p[0],z:p[1],r:1.8});
for(let i=0;i<3;i++){
const hp=L(rand(-2.5,2.5),rand(-4.2,0.5));
const hx=hp[0], hz=hp[1];
mesh(new THREE.CylinderGeometry(1.1,1.3,1.6,10),MAT.hay,hx,g0+0.8,hz);
CYLS.push({x:hx,z:hz,r:1.2,y0:g0,y1:g0+1.6});
}
p=L(0,-d/2+2.2); solidBox(MAT.woodDark,w-0.8,0.25,4, p[0],g0+2.6,p[1], ry);
for(let i=0;i<5;i++){
p=L(w/2-1.4,-d/2+4.5+i*0.5);
solidBox(MAT.woodDark,1.2,0.2,0.9, p[0],g0+0.5+i*0.55,p[1], ry);
}
const r1=mesh(new THREE.BoxGeometry(w*0.62,0.15,d+0.5),MAT.wood,...(()=>{const q=L(-w*0.23,0);return [q[0],g0+H+0.85,q[1]];})(),ry); r1.rotation.z=0.5; addSnowCap(r1);
const r2=mesh(new THREE.BoxGeometry(w*0.62,0.15,d+0.5),MAT.wood,...(()=>{const q=L(w*0.23,0);return [q[0],g0+H+0.85,q[1]];})(),ry); r2.rotation.z=-0.5; addSnowCap(r2);
addCoverAround(x,z,w,d,ry);
}
function sandbagWall(x,z,len,ry,h=1.0){
const g0=heightAt(x,z);
const m=solidBox(MAT.sandbag,len,h,0.75,x,g0+h/2,z,ry);
coverPoints.push({x:x-Math.sin(ry)*1.4, z:z-Math.cos(ry)*1.4});
coverPoints.push({x:x+Math.sin(ry)*1.4, z:z+Math.cos(ry)*1.4});
return m;
}
function hedgehog(x,z){
const g0=heightAt(x,z);
for(let i=0;i<3;i++){
const b=mesh(new THREE.BoxGeometry(0.22,2.4,0.22),MAT.metalDark,x,g0+0.75,z);
b.rotation.set(rand(-0.5,0.5)+ (i*1.1), 0, 0.7+i*0.5);
}
CYLS.push({x,z,r:0.85,y0:g0,y1:g0+1.5});
coverPoints.push({x:x+rand(-1,1),z:z+rand(-1,1)});
}
// 铁丝网 (工程兵建造): 无硬碰撞, 进入者减速+刮伤
const wireMat=new THREE.MeshLambertMaterial({color:0x3c3a34});
function barbedWire(x,z,ry=0,len=3.6,builder=null){
const g0=heightAt(x,z);
const grp=new THREE.Group();
grp.position.set(x,g0,z);
grp.rotation.y=ry;
world.add(grp);
for(const t of [-len/2,0,len/2]){
const st=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.045,1.15,5),MAT.woodDark);
st.position.set(t,0.55,0);
st.rotation.z=rand(-0.14,0.14); st.rotation.x=rand(-0.1,0.1);
st.castShadow=true;
grp.add(st);
}
for(const hy of [0.3,0.62,0.95]){
const wr=new THREE.Mesh(new THREE.CylinderGeometry(0.014,0.014,len,4),wireMat);
wr.rotation.z=HPI;
wr.position.y=hy;
grp.add(wr);
}
for(let i=0;i<4;i++){
const dg=new THREE.Mesh(new THREE.CylinderGeometry(0.011,0.011,0.95,3),wireMat);
dg.position.set(rand(-len/2+0.4,len/2-0.4),0.6,rand(-0.2,0.2));
dg.rotation.z=HPI+rand(-0.8,0.8);
dg.rotation.y=rand(-0.4,0.4);
grp.add(dg);
}
const w={x,z,r:Math.max(1.5,len*0.5),grp,builder,alive:true};
wires.push(w);
return w;
}
const treeTrunkGeo=new THREE.CylinderGeometry(0.22,0.34,4.4,7);
const treeLeafGeo=new THREE.PlaneGeometry(5,5);
function tree(x,z,s=1){
const g0=heightAt(x,z);
const tr=mesh(treeTrunkGeo,MAT.bark,x,g0+2.2*s,z); tr.scale.setScalar(s);
for(let i=0;i<3;i++){
const lf=mesh(treeLeafGeo,MAT.leaves,x,g0+(3.4+i*0.6)*s,z,rand(0,Math.PI),false,false);
lf.rotation.x=rand(-0.25,0.25);
lf.scale.setScalar(s*rand(0.8,1.15));
}
CYLS.push({x,z,r:0.35*s,y0:g0,y1:g0+4*s});
}
function deadTree(x,z){
const g0=heightAt(x,z);
const t=mesh(new THREE.CylinderGeometry(0.14,0.3,3.6,6),MAT.woodDark,x,g0+1.8,z);
t.rotation.z=rand(-0.15,0.15);
const b1=mesh(new THREE.CylinderGeometry(0.05,0.1,1.6,5),MAT.woodDark,x+0.5,g0+3,z); b1.rotation.z=-0.9;
CYLS.push({x,z,r:0.3,y0:g0,y1:g0+3.4});
}
const craterGeo=new THREE.CircleGeometry(1,20);
const craterMat=new THREE.MeshLambertMaterial({color:0x4a4238,transparent:true,opacity:0.85,depthWrite:false});
const runtimeCraters=[];
function crater(x,z,r,runtime=false){
const m=mesh(craterGeo,craterMat,x,heightAt(x,z)+0.03,z,0,false,true);
m.rotation.x=-HPI; m.scale.setScalar(r);
m.renderOrder=1;
if(runtime){
runtimeCraters.push(m);
if(runtimeCraters.length>36){ const old=runtimeCraters.shift(); world.remove(old); }
return;
}
const rim=mesh(new THREE.TorusGeometry(r*0.8,r*0.14,6,14),new THREE.MeshLambertMaterial({color:0x5d5344}),x,heightAt(x,z)+0.05,z);
rim.rotation.x=-HPI;
}
function crate(x,z,s=1,ry=0){
const g0=heightAt(x,z);
solidBox(MAT.wood,s,s,s,x,g0+s/2,z,ry);
coverPoints.push({x:x+rand(-1.3,1.3),z:z+rand(-1.3,1.3)});
}
function barrel(x,z){
const g0=heightAt(x,z);
mesh(new THREE.CylinderGeometry(0.42,0.42,1.1,10),MAT.metal,x,g0+0.55,z);
CYLS.push({x,z,r:0.45,y0:g0,y1:g0+1.1});
}
function wreckTruck(x,z,ry){
const g0=heightAt(x,z);
solidBox(MAT.metalDark,2.2,1.5,5.4,x,g0+0.95,z,ry);
const cab=mesh(new THREE.BoxGeometry(2.1,1.1,1.6),MAT.metalDark,x+Math.sin(ry)*1.6,g0+2.0,z+Math.cos(ry)*1.6,ry);
cab.rotation.z=0.12;
for(const s of [-1,1]){
const w1=mesh(new THREE.CylinderGeometry(0.55,0.55,0.35,10),MAT.metalDark, x+Math.cos(ry)*s*1.15+Math.sin(ry)*1.4, g0+0.55, z-Math.sin(ry)*s*1.15+Math.cos(ry)*1.4, ry);
w1.rotation.z=HPI;
}
addCoverAround(x,z,2.4,5.6,ry);
}
function stoneWall(x1,z1,x2,z2,h=1.15){
const dx=x2-x1,dz=z2-z1;
const len=Math.hypot(dx,dz), ry=Math.atan2(dx,dz)+HPI;
const steps=Math.ceil(len/6);
for(let i=0;i<steps;i++){
const t0=(i+0.5)/steps;
const x=x1+dx*t0, z=z1+dz*t0;
const g0=heightAt(x,z);
solidBox(MAT.stone,Math.min(6.2,len/steps+0.3),h,0.55,x,g0+h/2,z,ry);
}
coverPoints.push({x:(x1+x2)/2+dz/len*1.4,z:(z1+z2)/2-dx/len*1.4});
coverPoints.push({x:(x1+x2)/2-dz/len*1.4,z:(z1+z2)/2+dx/len*1.4});
}
function hedgerow(x1,z1,x2,z2){
const dx=x2-x1,dz=z2-z1;
const len=Math.hypot(dx,dz), ry=Math.atan2(dx,dz)+HPI;
const steps=Math.ceil(len/4);
for(let i=0;i<steps;i++){
const t0=(i+0.5)/steps;
const x=x1+dx*t0+rand(-0.4,0.4), z=z1+dz*t0+rand(-0.4,0.4);
const g0=heightAt(x,z);
const h=rand(2.2,3.0);
const m=mesh(new THREE.BoxGeometry(4.4,h,2.2),new THREE.MeshLambertMaterial({map:TEX.leaves,transparent:true,alphaTest:0.4}),x,g0+h/2,z,ry);
addBoxCollider(x,g0+h/2,z, Math.abs(Math.sin(ry))>0.5?2.2:4.4, h, Math.abs(Math.sin(ry))>0.5?4.4:2.2);
}
}
function rubblePile(x,z,r){
const g0=heightAt(x,z);
for(let i=0;i<6;i++){
const bx=x+rand(-r,r)*0.7, bz=z+rand(-r,r)*0.7;
const s=rand(0.5,1.4);
const m=mesh(new THREE.BoxGeometry(s,s*0.7,s),Math.random()<0.5?MAT.rubble:MAT.brick,bx,g0+s*0.3,bz,rand(0,3));
m.rotation.x=rand(-0.3,0.3);
}
const mound=mesh(new THREE.SphereGeometry(r*0.8,10,6),MAT.rubble,x,g0-r*0.35,z);
CYLS.push({x,z,r:r*0.65,y0:g0,y1:g0+r*0.5});
coverPoints.push({x:x+r,z}); coverPoints.push({x:x-r,z});
}
function tent(x,z,ry){
const g0=heightAt(x,z);
const m1=mesh(new THREE.BoxGeometry(3.4,0.12,4.4),new THREE.MeshLambertMaterial({color:0x5e6244}),x-0.85,g0+1.1,z,ry); m1.rotation.z=0.72;
const m2=mesh(new THREE.BoxGeometry(3.4,0.12,4.4),new THREE.MeshLambertMaterial({color:0x565a3e}),x+0.85,g0+1.1,z,ry); m2.rotation.z=-0.72;
addBoxCollider(x,g0+0.9,z,1.5,1.8,4);
}
function twoStoryHouse(x,z,ry,mat){
const g0=heightAt(x,z);
mesh(new THREE.BoxGeometry(8.5,1.6,9.5),MAT.stone,x,g0-0.7,z,ry,false,true);
const w=8,d=9,fh=2.9;
const cs=Math.cos(ry),sn=Math.sin(ry);
const L=(lx,lz)=>[x+lx*cs+lz*sn, z-lx*sn+lz*cs];
let p;
// 一层墙(门+窗)
const dw=1.3, seg=(w-dw)/2;
p=L(0,d/2); NAV_CLEARS.push({x:p[0],z:p[1],r:1.4});
p=L(-(dw+seg)/2,d/2); solidBox(mat,seg,fh,0.35,p[0],g0+fh/2,p[1],ry);
p=L((dw+seg)/2,d/2); solidBox(mat,seg,fh,0.35,p[0],g0+fh/2,p[1],ry);
p=L(0,d/2); solidBox(mat,dw,0.7,0.35,p[0],g0+fh-0.35,p[1],ry);
p=L(0,-d/2); solidBox(mat,w,fh,0.35,p[0],g0+fh/2,p[1],ry);
p=L(-w/2,0); solidBox(mat,0.35,fh,d,p[0],g0+fh/2,p[1],ry);
p=L(w/2,0); solidBox(mat,0.35,fh,d,p[0],g0+fh/2,p[1],ry);
// 二层地板(留楼梯口)
p=L(-0.9,0); solidBox(MAT.woodDark,w-1.8-1.6,0.22,d,p[0],g0+fh,p[1],ry);
p=L(w/2-0.85,-d/2+2.6); solidBox(MAT.woodDark,1.7,0.22,d-5.2,p[0],g0+fh,p[1],ry);
// 楼梯(0.48步高)
for(let i=0;i<6;i++){
p=L(w/2-0.85,d/2-0.8-i*0.62);
solidBox(MAT.woodDark,1.5,0.22,0.7,p[0],g0+0.42+i*0.48,p[1],ry);
}
// 二层墙(窗)
const wh=2.6;
for(const side of [d/2,-d/2]){
const winW=1.4, seg2=(w-winW*2)/3;
for(const wx of [-(winW+seg2),0,winW+seg2]){
p=L(wx,side);
solidBox(mat,wx===0?winW:seg2+0.4,0.9,0.35,p[0],g0+fh+0.45,p[1],ry);
solidBox(mat,wx===0?winW:seg2+0.4,0.7,0.35,p[0],g0+fh+wh-0.35,p[1],ry);
}
p=L(-(winW/2+seg2/2)*1.05,side); solidBox(mat,seg2,wh,0.35,p[0],g0+fh+wh/2,p[1],ry);
p=L((winW/2+seg2/2)*1.05,side); solidBox(mat,seg2,wh,0.35,p[0],g0+fh+wh/2,p[1],ry);
}
p=L(-w/2,0); solidBox(mat,0.35,wh,d,p[0],g0+fh+wh/2,p[1],ry);
p=L(w/2,1.8); solidBox(mat,0.35,wh,d-3.6,p[0],g0+fh+wh/2,p[1],ry);
p=L(w/2,-d/2+0.7); solidBox(mat,0.35,wh,1.4,p[0],g0+fh+wh/2,p[1],ry);
// 顶
p=L(0,0); addSnowCap(solidBox(mat,w+0.4,0.25,d+0.4,p[0],g0+fh+wh+0.1,p[1],ry));
addCoverAround(x,z,w,d,ry);
coverPoints.push({x,z});
}
function watchtower(x,z){
const g0=heightAt(x,z);
const h=5.2;
for(const [lx,lz] of [[-1.3,-1.3],[1.3,-1.3],[-1.3,1.3],[1.3,1.3]]){
const leg=mesh(new THREE.BoxGeometry(0.22,h,0.22),MAT.woodDark,x+lx,g0+h/2,z+lz);
leg.rotation.y=0.1;
CYLS.push({x:x+lx,z:z+lz,r:0.18,y0:g0,y1:g0+h});
}
solidBox(MAT.wood,1.4,0.25,3.4,x-1.2,g0+h,z,0);
solidBox(MAT.wood,1.4,0.25,3.4,x+1.2,g0+h,z,0);
solidBox(MAT.wood,1.0,0.25,1.4,x,g0+h,z-1.0,0);
solidBox(MAT.wood,3.6,0.8,0.18,x,g0+h+0.55,z-1.7,0);
solidBox(MAT.wood,1.2,0.8,0.18,x-1.2,g0+h+0.55,z+1.8,0);
solidBox(MAT.wood,1.2,0.8,0.18,x+1.2,g0+h+0.55,z+1.8,0);
solidBox(MAT.wood,0.18,0.8,3.6,x-1.75,g0+h+0.55,z,0);
solidBox(MAT.wood,0.18,0.8,3.6,x+1.75,g0+h+0.55,z,0);
const roof=mesh(new THREE.BoxGeometry(4,0.12,4),MAT.woodDark,x,g0+h+2.2,z);
roof.rotation.z=0.06;
addSnowCap(roof);
for(let i=0;i<10;i++){
solidBox(MAT.woodDark,1.0,0.2,0.6, x, g0+0.4+i*0.5, z+4.4-i*0.35, 0);
}
coverPoints.push({x,z});
}
// ===== 各战役独立布局 =====
// 倒木 (丛林)
function fallenLog(x,z,ry){
const g0=heightAt(x,z);
const lg=mesh(new THREE.CylinderGeometry(0.28,0.34,4.5,7),MAT.bark,x,g0+0.32,z);
lg.rotation.z=HPI; lg.rotation.y=ry;
addBoxCollider(x,g0+0.3,z,Math.abs(Math.cos(ry))*4+0.6,0.6,Math.abs(Math.sin(ry))*4+0.6);
coverPoints.push({x:x+Math.sin(ry+HPI)*1.2,z:z+Math.cos(ry+HPI)*1.2});
}
// 木屋 (雪地)
function logCabin(x,z,ry){
const g0=heightAt(x,z);
mesh(new THREE.BoxGeometry(6.4,1.0,5.4),MAT.stone,x,g0-0.4,z,ry,false,true);
const w=6,d=5,H=2.5,t=0.3;
const cs=Math.cos(ry),sn=Math.sin(ry);
const L=(lx,lz)=>[x+lx*cs+lz*sn, z-lx*sn+lz*cs];
const wallGs=[];
let p;
dBegin();
const dw=1.1, seg=(w-dw)/2;
p=L(0,d/2); NAV_CLEARS.push({x:p[0],z:p[1],r:1.0});
p=L(-(dw+seg)/2,d/2); dBox(MAT.woodDark,seg,H,t,p[0],g0+H/2,p[1],ry);
p=L((dw+seg)/2,d/2); dBox(MAT.woodDark,seg,H,t,p[0],g0+H/2,p[1],ry);
p=L(0,d/2); dBox(MAT.woodDark,dw,H-1.8,t,p[0],g0+H-(H-1.8)/2,p[1],ry);
wallGs.push(dEnd());
dBegin(); p=L(0,-d/2); dBox(MAT.woodDark,w,H,t,p[0],g0+H/2,p[1],ry); wallGs.push(dEnd());
dBegin(); p=L(-w/2,0); dBox(MAT.woodDark,t,H,d,p[0],g0+H/2,p[1],ry); wallGs.push(dEnd());
dBegin(); p=L(w/2,0); dBox(MAT.woodDark,t,H,d,p[0],g0+H/2,p[1],ry); wallGs.push(dEnd());
p=L(0,d*0.26);
const r1=mesh(new THREE.BoxGeometry(w+1.1,0.14,d*0.64),MAT.roof,p[0],g0+H+0.36,p[1],ry); r1.rotation.order='YXZ'; r1.rotation.x=0.38; addSnowCap(r1);
p=L(0,-d*0.26);
const r2=mesh(new THREE.BoxGeometry(w+1.1,0.14,d*0.64),MAT.roof,p[0],g0+H+0.36,p[1],ry); r2.rotation.order='YXZ'; r2.rotation.x=-0.38; addSnowCap(r2);
const roofRef={m:[r1,r2],dead:0,done:false};
for(const g of wallGs) if(g) g.roofRef=roofRef;
addCoverAround(x,z,w,d,ry);
}
// 混凝土碉堡 (射击孔朝向 face)
function bunker(x,z,face){
const g0=heightAt(x,z);
const sn=Math.sin(face),cs=Math.cos(face);
addSnowCap(solidBox(MAT.stone,3.6,0.5,3.2, x,g0+2.05,z, face));
solidBox(MAT.stone,3.6,1.9,0.5, x-sn*1.5,g0+0.95,z-cs*1.5, face);
solidBox(MAT.stone,0.5,1.9,3.0, x+cs*1.6-sn*0.1,g0+0.95,z-sn*1.6-cs*0.1, face);
solidBox(MAT.stone,0.5,1.9,3.0, x-cs*1.6-sn*0.1,g0+0.95,z+sn*1.6-cs*0.1, face);
solidBox(MAT.stone,1.2,0.8,0.5, x-cs*1.2+sn*1.4,g0+0.4,z+sn*1.2+cs*1.4, face);
solidBox(MAT.stone,1.2,0.8,0.5, x+cs*1.2+sn*1.4,g0+0.4,z-sn*1.2+cs*1.4, face);
solidBox(MAT.stone,3.6,0.35,0.5, x+sn*1.4,g0+1.65,z+cs*1.4, face);
coverPoints.push({x:x-sn*2.6,z:z-cs*2.6},{x,z});
}
// 补给库 (破袭模式目标, 可被炸毁) —— 箱堆/沙袋/旗杆整体随朝向摆放
function buildDepot(x,z,ry){
const g0=heightAt(x,z);
const rotL=(lx,lz)=>[x+lx*Math.cos(ry)+lz*Math.sin(ry), z-lx*Math.sin(ry)+lz*Math.cos(ry)];
let p;
dBegin();
p=rotL(-1.6,0.8); dBox(MAT.woodDark,2.6,1.7,1.7, p[0],g0+0.85,p[1], ry);
p=rotL(1.4,-0.9); dBox(MAT.woodDark,2.2,1.3,1.5, p[0],g0+0.65,p[1], ry+0.4);
p=rotL(0.4,1.6); dBox(MAT.wood,1.6,1.1,1.2, p[0],g0+0.55,p[1], ry+0.9);
p=rotL(-0.4,-1.6); dBox(MAT.metalDark,1.4,1.5,1.4, p[0],g0+0.75,p[1], ry);
const g=dEnd();
if(g) g.hp=720;
for(let i=0;i<3;i++){ p=rotL(rand(-3,3),rand(-3,3)); barrel(p[0],p[1]); }
p=rotL(3.6,0); sandbagWall(p[0],p[1],4,ry+HPI);
p=rotL(-3.6,0); sandbagWall(p[0],p[1],4,ry+HPI);
p=rotL(0,2.5);
const pole=mesh(new THREE.CylinderGeometry(0.06,0.08,5,6),MAT.metal,p[0],g0+2.5,p[1]);
const cp1=rotL(4,2), cp2=rotL(-4,-2);
coverPoints.push({x:cp1[0],z:cp1[1]},{x:cp2[0],z:cp2[1]});
return g;
}
// -- 诺曼底: 乡村田园 --
function layoutRural(){
buildChurch(3,-2,0);
ruinedHouse(-11,12, 7,8, 0, MAT.plaster, 0.5);
ruinedHouse(16,14, 8,7, HPI, MAT.brick, 0.7);
ruinedHouse(14,-18, 6,8, 0, MAT.plaster, 0.6);
{ const g0=heightAt(3,18); mesh(new THREE.CylinderGeometry(1.1,1.2,0.9,10),MAT.stone,3,g0+0.45,18); CYLS.push({x:3,z:18,r:1.2,y0:g0,y1:g0+0.9}); }
crate(7,22,1.2,0.4); barrel(0,21);
crater(-5,6,2.4); crater(21,4,1.9);
wreckTruck(-19,10,0.5);
twoStoryHouse(-21,-10,0.15,MAT.brick);
buildBarn(-72,26,0.2);
ruinedHouse(-62,12, 7,7, 0.2, MAT.plaster, 0.4);
stoneWall(-84,34,-58,38); stoneWall(-84,10,-84,34);
crate(-66,32,1.2,0.7); barrel(-60,16);
watchtower(-78,8);
twoStoryHouse(-54,34,0.5,MAT.plaster);
for(let i=0;i<3;i++){ const hx=-52+i*4,hz=30+rand(-2,2),g0=heightAt(hx,hz);
const m=mesh(new THREE.CylinderGeometry(1.1,1.1,1.6,12),MAT.hay,hx,g0+1.1,hz); m.rotation.z=HPI;
CYLS.push({x:hx,z:hz,r:1.15,y0:g0,y1:g0+2.2}); coverPoints.push({x:hx,z:hz-2}); }
buildBarn(-30,-72,-0.3);
ruinedHouse(-14,-60, 7,7, 0.3, MAT.plaster, 0.5);
hedgerow(-46,-56,-26,-48);
crater(-22,-68,2.0);
wreckTruck(-14,-74,0.8);
hedgehog(-38,-66);
twoStoryHouse(24,72,0.2,MAT.brick);
ruinedHouse(38,62, 7,8, -0.2, MAT.plaster, 0.7);
ruinedHouse(20,58, 6,6, HPI, MAT.brick, 0.6);
stoneWall(12,78,34,82);
watchtower(46,74);
hedgehog(24,52);
ruinedHouse(72,-20, 8,9, 0, MAT.brick, 0.9);
ruinedHouse(62,-32, 7,7, HPI, MAT.brick, 0.85);
ruinedHouse(82,-32, 6,7, 0, MAT.plaster, 0.9);
ruinedHouse(76,-8, 7,6, HPI, MAT.plaster, 0.75);
rubblePile(68,-26,2.2); rubblePile(78,-22,1.8);
crater(74,-28,2.6); crater(64,-18,2.2);
wreckTruck(66,-38,1.2);
hedgehog(60,-14); hedgehog(84,-26);
watchtower(84,-8);
twoStoryHouse(58,-44,-0.3,MAT.brick);
stoneWall(-40,-14,-24,-20); stoneWall(30,16,46,10);
hedgerow(-46,-34,-16,-40); hedgerow(20,34,52,28);
hedgerow(-30,44,10,46);
hedgehog(-44,4); hedgehog(44,2);
crater(-38,-6,2.4); crater(32,6,2.2); crater(-28,26,2.0);
wreckTruck(-45,-24,-0.4); wreckTruck(36,32,2.2);
deadTree(-20,-24); deadTree(26,-10); deadTree(-6,34);
}
// -- 巷战城市 (斯大林格勒/柏林) --
function layoutCity(){
const heavy=THEME.ruinAdd>0.4;
CAMPAIGN.flags.forEach((f,i)=>{
ruinedHouse(f.x-9,f.z+7, 7,8, rand(-0.2,0.3), MAT.brick, heavy?0.85:0.6);
ruinedHouse(f.x+9,f.z-8, 8,7, HPI+rand(-0.3,0.1), MAT.brick, heavy?0.9:0.7);
ruinedHouse(f.x+11,f.z+9, 6,7, rand(0,0.3), MAT.plaster, 0.78);
if(i%2===1) factoryRuin(f.x-12,f.z-10,rand(-0.3,0.3));
else twoStoryHouse(f.x-12,f.z-10,rand(-0.2,0.3),MAT.brick);
rubblePile(f.x+rand(-5,5),f.z+rand(-5,5),rand(1.8,2.6));
crater(f.x+rand(-9,9),f.z+rand(-9,9),rand(1.8,2.6));
sandbagWall(f.x+rand(-7,7),f.z+rand(-7,7),4,rand(0,3));
hedgehog(f.x+rand(-11,11),f.z+rand(-11,11));
wreckTruck(f.x+rand(-13,13),f.z+rand(-13,13),rand(0,3));
});
for(let i=0;i<CAMPAIGN.flags.length-1;i++){
const a=CAMPAIGN.flags[i], b=CAMPAIGN.flags[i+1];
const mx=(a.x+b.x)/2+rand(-6,6), mz=(a.z+b.z)/2+rand(-6,6);
ruinedHouse(mx,mz, 7,7, rand(0,3), Math.random()<0.5?MAT.brick:MAT.plaster, 0.85);
rubblePile(mx+rand(-6,6),mz+rand(-6,6),2.0);
hedgehog(mx+rand(-8,8),mz+rand(-8,8));
}
stoneWall(-40,40,-16,44); stoneWall(20,-42,44,-38);
}
// -- 江南水乡 (淞沪) --
function layoutDelta(){
CAMPAIGN.flags.forEach((f,i)=>{
cnHouse(f.x-7,f.z+6,rand(-0.2,0.3),7,6);
cnHouse(f.x+7,f.z-6,HPI+rand(-0.2,0.2),6,5);
cnHouse(f.x+8,f.z+8,rand(0,0.4),6,5);
if(i%2===0) cnHouse(f.x-9,f.z-8,rand(0,0.4),6,5);
stoneWall(f.x-12,f.z+12,f.x+2,f.z+14);
sandbagWall(f.x+rand(-6,6),f.z+rand(-6,6),4,rand(0,3));
crate(f.x+rand(-5,5),f.z+rand(-5,5),1.2,rand(0,3));
barrel(f.x+rand(-6,6),f.z+rand(-6,6));
crater(f.x+rand(-9,9),f.z+rand(-9,9),2.0);
});
wreckTruck(50,4,0.6); wreckTruck(-30,-8,2.4);
hedgehog(52,-10); hedgehog(12,10); hedgehog(-28,-4);
deadTree(40,10); deadTree(-2,-32); deadTree(-44,20);
}
// -- 黄土沟壑 (百团) --
function layoutLoess(){
CAMPAIGN.flags.forEach((f,i)=>{
cnHouse(f.x-7,f.z+5,rand(-0.3,0.3),6,5);
cnHouse(f.x+7,f.z-5,HPI+rand(-0.2,0.2),6,5);
if(i===1) cnHouse(f.x+9,f.z+7,0.2,6,5);
stoneWall(f.x-11,f.z-9,f.x+3,f.z-12);
stoneWall(f.x+5,f.z+9,f.x+13,f.z+7);
crate(f.x+rand(-5,5),f.z+rand(-5,5),1.1,rand(0,3));
barrel(f.x+rand(-5,5),f.z+rand(-5,5));
});
watchtower(-30,8); watchtower(36,6);
wreckTruck(-8,-6,1.2);
crater(-24,12,2.2); crater(30,18,2.0); crater(4,-24,2.2);
hedgehog(-14,20); hedgehog(24,-14);
}
// -- 丛林前哨 (滇缅) --
function layoutJungle(){
CAMPAIGN.flags.forEach((f,i)=>{
watchtower(f.x+6,f.z+5);
tent(f.x-5,f.z+4,rand(0,3)); tent(f.x-7,f.z-4,rand(0,3));
sandbagWall(f.x+7,f.z-4,4,rand(0,3)); sandbagWall(f.x-2,f.z+9,4,rand(0,3)); sandbagWall(f.x-9,f.z,4,HPI);
crate(f.x+rand(-3,3),f.z+rand(-3,3),1.2,rand(0,3));
barrel(f.x+3,f.z+3); barrel(f.x+4.2,f.z+2.2);
if(i%2===0) cnHouse(f.x+10,f.z+10,rand(0,0.5),6,5);
});
for(let i=0;i<8;i++) fallenLog(rand(-110,110),rand(-110,110),rand(0,Math.PI));
wreckTruck(-34,6,0.8); wreckTruck(40,-12,2.0);
crater(-12,14,2.0); crater(18,26,1.8);
}
// -- 原始密林 (胡康河谷) : 比滇缅更密, 竹丛+蕨类+巨树封闭 --
// 大龙河大桥 (胡康河谷): 木排架桥 —— 桥面高度由 heightAt 的 BRIDGE 矩形提供, 此处只建外观与护栏碰撞
// bridgePt(u,v): 桥局部坐标转世界 (u=沿桥轴向(sin,cos), v=垂直桥向(cos,-sin))
function bridgePt(u,v){
const B=BRIDGE;
return [B.x+u*Math.sin(B.yaw)+v*Math.cos(B.yaw), B.z+u*Math.cos(B.yaw)-v*Math.sin(B.yaw)];
}
function buildBridge(B){
const dy=bridgeDeckY();
// 桥面 (厚板; 长度放 d 轴随 yaw 走向, 含碰撞体供子弹/弹片命中; 顶面低于站立面0.5不进占用格)
solidBox(MAT.wood,B.w,0.5,B.len,B.x,dy-0.25,B.z,B.yaw);
// 桥面铺板层 (视觉)
const deck2=mesh(new THREE.BoxGeometry(B.w+0.7,0.1,B.len-0.6),MAT.woodDark,B.x,dy+0.02,B.z,B.yaw,false,true);
addSnowCap(deck2);
// 护栏立柱 + 双横杆 (碰撞体挡人坠河, 立柱位于桥缘不占中央通道)
for(const side of [-1,1]){
const v=side*(B.w/2-0.18);
for(let u=-B.len/2+0.9;u<=B.len/2-0.9;u+=2.4){
const p=bridgePt(u,v);
solidBox(MAT.woodDark,0.16,1.06,0.16,p[0],dy+0.53,p[1],B.yaw);
}
for(const hy of [0.5,0.98]){
const p=bridgePt(0,v);
mesh(new THREE.BoxGeometry(0.09,0.09,B.len-1.6),MAT.woodDark,p[0],dy+hy,p[1],B.yaw);
}
}
// 桥下木排架桩 (深入激流, 纯视觉)
for(const u of [-B.len/2+1.4,-6.5,6.5,B.len/2-1.4]){
for(const v of [-B.w/2+0.8,B.w/2-0.8]){
const p=bridgePt(u,v);
mesh(new THREE.CylinderGeometry(0.18,0.22,5.2,7),MAT.bark,p[0],dy-2.8,p[1]);
}
}
// 桥缘沙袋 (顺桥向, 两侧交替; 占用格的外溢由下方 NAV_CLEARS 通行带兜底)
const s1=bridgePt(-7,2.9), s2=bridgePt(7,-2.9);
sandbagWall(s1[0],s1[1],2.2,B.yaw+HPI);
sandbagWall(s2[0],s2[1],2.2,B.yaw+HPI);
// 中央通行带: 沿桥轴强制清空占用格, 确保护栏/沙袋/弹药箱的碰撞体外溢
// 不会封死 Bot/坦克的唯一过河走廊 (物理碰撞仍在, 只是寻路格保证连通)
for(let u=-B.len/2+1;u<=B.len/2-1;u+=2){
const p=bridgePt(u,0);
NAV_CLEARS.push({x:p[0],z:p[1],r:1.6});
}
}
function bambooClump(x,z){
const g0=heightAt(x,z);
const n=randi(3,5);
for(let i=0;i<n;i++){
const ox=rand(-0.5,0.5), oz=rand(-0.5,0.5);
const h=rand(4.5,7);
const c=mesh(new THREE.CylinderGeometry(0.03,0.045,h,5),new THREE.MeshLambertMaterial({color:0x7a9448}),x+ox,g0+h/2,z+oz);
c.rotation.z=rand(-0.08,0.08);
const lf=mesh(treeLeafGeo,MAT.leaves,x+ox,g0+h-rand(0.2,0.8),z+oz,rand(0,Math.PI),false,false);
lf.scale.setScalar(rand(0.55,0.8));
}
CYLS.push({x,z,r:0.55,y0:g0,y1:g0+5.5});
}
function fernClump(x,z){
const g0=heightAt(x,z);
for(let i=0;i<4;i++){
const lf=mesh(treeLeafGeo,MAT.leaves,x+rand(-0.7,0.7),g0+rand(0.25,0.7),z+rand(-0.7,0.7),rand(0,Math.PI),false,false);
lf.rotation.x=rand(-0.5,-0.15);
lf.scale.setScalar(rand(0.3,0.5));
}
}
function layoutDeepJungle(){
// 两岸旗点营地 (大桥旗点在桥上, 由 buildBridge 单独布置)
CAMPAIGN.flags.forEach((f,i)=>{
if(onBridge(f.x,f.z,4)) return;
watchtower(f.x+6,f.z+5);
tent(f.x-5,f.z+4,rand(0,3)); tent(f.x-7,f.z-4,rand(0,3));
sandbagWall(f.x+7,f.z-4,4,rand(0,3)); sandbagWall(f.x-2,f.z+9,4,rand(0,3)); sandbagWall(f.x-9,f.z,4,HPI);
crate(f.x+rand(-3,3),f.z+rand(-3,3),1.2,rand(0,3));
barrel(f.x+3,f.z+3);
if(i%2===0) cnHouse(f.x+10,f.z+10,rand(0,0.5),6,5);
});
// 河岸哨塔与渡口残骸: 控制大桥的两侧河曲视野
watchtower(-16,-18); watchtower(14,22);
wreckTruck(-38,-2,0.35); wreckTruck(42,8,2.6); wreckTruck(9,-13,1.4);
crater(-22,-10,2.2); crater(26,10,2.0); crater(-9,14,1.8); crater(12,-16,2.2);
// 密林植被散布: 道路/旗点平整区/河道深谷让开, 其余区域竹丛+蕨类封闭
const spotOK=(x,z,flatK)=>{
if(roadDist(x,z)<6) return false;
if(inRiverChannel(x,z)) return false;
if(onBridge(x,z,3)) return false;
for(const f of FLATS){ if(Math.hypot(x-f.x,z-f.z)<f.r*flatK) return false; }
return Math.abs(x)<150&&Math.abs(z)<150;
};
let placed=0, tries=0;
while(placed<52&&tries<400){ tries++;
const x=rand(-150,150), z=rand(-150,150);
if(!spotOK(x,z,0.62)) continue;
bambooClump(x,z); placed++;
}
for(let i=0;i<90;i++){
const x=rand(-150,150), z=rand(-150,150);
if(!spotOK(x,z,0.5)) continue;
fernClump(x,z);
}
for(let i=0;i<18;i++){
const x=rand(-120,120), z=rand(-120,120);
if(!spotOK(x,z,0.55)) continue;
fallenLog(x,z,rand(0,Math.PI));
}
}
// -- 雪岭松林 (莫斯科) --
function layoutAlpine(){
CAMPAIGN.flags.forEach((f,i)=>{
logCabin(f.x-7,f.z+5,rand(-0.3,0.3));
logCabin(f.x+7,f.z-6,HPI+rand(-0.2,0.2));
if(i%2===0) logCabin(f.x+9,f.z+8,rand(0,0.4));
bunker(f.x-9,f.z-8,Math.atan2(CAMPAIGN.bases[ATK].x-f.x,CAMPAIGN.bases[ATK].z-f.z));
sandbagWall(f.x+rand(-6,6),f.z+rand(-6,6),4,rand(0,3));
crate(f.x+rand(-5,5),f.z+rand(-5,5),1.2,rand(0,3));
barrel(f.x+rand(-6,6),f.z+rand(-6,6));
});
hedgehog(-40,8); hedgehog(-2,-14); hedgehog(44,10); hedgehog(8,30);
wreckTruck(-20,18,0.4); wreckTruck(34,-20,1.8);
deadTree(-10,8); deadTree(28,14); deadTree(-36,-18);
crater(-16,-6,2.2); crater(38,4,2.0);
}
const TREES=[], fTrees=[];
function buildWorld(){
switch(CAMPAIGN.layout){
case 'city': layoutCity(); break;
case 'delta': layoutDelta(); break;
case 'loess': layoutLoess(); break;
case 'jungle': layoutJungle(); break;
case 'deepjungle': layoutDeepJungle(); break;
	case 'alpine': layoutAlpine(); break;
	default: layoutRural(); break;
}
// 大龙河大桥 (胡康河谷)
if(BRIDGE) buildBridge(BRIDGE);
// 破袭模式: 在旗点位置建立补给库目标
if(GAMEMODE==='demolition'){
for(const f of CAMPAIGN.flags){
const g=buildDepot(f.x,f.z,rand(0,3));
if(g) DEPOTS.push({id:f.id,x:f.x,z:f.z,g,destroyed:false});
}
}
// 基地营区 (通用)
CAMPAIGN.bases.forEach((b,t)=>{
const sgn=b.x<0?1:-1;
tent(b.x+sgn*2,6,0.3); tent(b.x,-6,-0.2); tent(b.x-sgn*4,0,0);
sandbagWall(b.x+sgn*10,6,5,HPI); sandbagWall(b.x+sgn*10,-6,5,HPI); sandbagWall(b.x+sgn*8,0,5,HPI);
crate(b.x+sgn*4,10,1.3,0); barrel(b.x+sgn*5,-9);
});
decorateTrenches();
// 河流水面/冰面: 水位分段按当地河岸高度取值 (略低于较低的岸边),
// 旧实现整条河共用折线上的最低河床高度, 地势较高的河段水面会沉到河床之下变成"地下暗河"
if(RIVER){
const wmat=RIVER.ice
?new THREE.MeshLambertMaterial({color:0xcfe2ee})
:new THREE.MeshLambertMaterial({color:0x3e5a6a,transparent:true,opacity:0.72});
const P=RIVER.pts;
for(let i=0;i<P.length-1;i++){
const ax=P[i][0],az=P[i][1],bx2=P[i+1][0],bz2=P[i+1][1];
const dx=bx2-ax,dz=bz2-az;
const len=Math.hypot(dx,dz)||1;
const nx=-dz/len, nz=dx/len; // 垂直于河道的单位向量
const ang=Math.atan2(-(bz2-az),bx2-ax);
const nCh=Math.max(1,Math.round(len/12));
for(let k=0;k<nCh;k++){
const tc=(k+0.5)/nCh;
const cx=ax+dx*tc, cz=az+dz*tc;
// 岸高: 在河道下切范围之外的两侧采样; 河床: 河道中心线 (忽略桥面抬升)
const off=RIVER.w+1.5;
const bank=Math.min(heightAt(cx+nx*off,cz+nz*off),heightAt(cx-nx*off,cz-nz*off));
const bed=heightAt(cx,cz,true);
let wy;
if(RIVER.ice){
wy=bed+0.12; // 冰面贴着河床, 徒涉者看起来走在冰上
}else{
wy=bank-(RIVER.d>2?1.6:0.4); // 深谷激流: 水面低于岸1.6m; 普通河流贴岸
}
wy=clamp(wy,bed+0.1,bank-0.15);
const wm=mesh(new THREE.BoxGeometry(len/nCh+1.0,0.08,RIVER.w*1.9),wmat,cx,wy,cz,ang,false,true);
}
}
}
// 树木/枯树散布
	const treeSpots=[];
	for(let i=0;i<THEME.treeN;i++){
	const x=rand(-152,152), z=rand(-152,152);
	if(roadDist(x,z)<7) continue;
	if(inRiverChannel(x,z)) continue;
	let near=false;
for(const f of FLATS){ if(Math.hypot(x-f.x,z-f.z)<f.r*((CAMPAIGN.layout==='jungle'||CAMPAIGN.layout==='deepjungle')?0.5:0.85)) near=true; }
if(near) continue;
treeSpots.push([x,z]);
}
treeSpots.forEach(([x,z])=>{ if(Math.random()<THEME.dead) deadTree(x,z); else{ tree(x,z,rand(0.8,1.5)*(CAMPAIGN.layout==='jungle'?1.25:(CAMPAIGN.layout==='deepjungle'?1.4:1))); TREES.push({x,z}); } });
// 废墟主题: 额外瓦砾堆与弹坑
for(let i=0;i<THEME.rubbleN;i++){
const x=rand(-130,130), z=rand(-130,130);
if(roadDist(x,z)<6) continue;
if(Math.random()<0.6) rubblePile(x,z,rand(1.4,2.6)); else crater(x,z,rand(1.6,2.6));
}
const grassCount=Math.round((SETTINGS.quality===0?480:(SETTINGS.quality===1?1050:1850))*THEME.grassMul);
const gGeo=new THREE.PlaneGeometry(0.9,0.55);
gGeo.translate(0,0.27,0);
const gMat=new THREE.MeshLambertMaterial({map:makeTex(64,64,(g,w,h)=>{
g.clearRect(0,0,w,h);
for(let i=0;i<30;i++){
g.strokeStyle=`rgba(${randi(90,130)},${randi(115,150)},${randi(55,80)},.9)`;
g.lineWidth=2;
g.beginPath(); const x=rand(4,60); g.moveTo(x,h); g.quadraticCurveTo(x+rand(-6,6),h*0.5,x+rand(-10,10),rand(4,20)); g.stroke();
}
}),transparent:true,alphaTest:0.35,side:THREE.DoubleSide});
const inst=new THREE.InstancedMesh(gGeo,gMat,Math.max(grassCount,1));
gMat.color.set(THEME.grassC);
const dummy=new THREE.Object3D();
	for(let i=0;i<grassCount;i++){
	let x=rand(-150,150),z=rand(-150,150);
	if(roadDist(x,z)<4){ x+=8; }
	if(inRiverChannel(x,z)) continue;
	dummy.position.set(x,heightAt(x,z),z);
dummy.rotation.y=rand(0,Math.PI);
dummy.scale.setScalar(rand(0.7,1.4));
dummy.updateMatrix();
inst.setMatrixAt(i,dummy.matrix);
}
inst.receiveShadow=true;
scene.add(inst);
if(CAMPAIGN.sineRoad){
for(let x=-124;x<=124;x+=28){
const z=3*Math.sin(x*0.02)+6.5;
const g0=heightAt(x,z);
mesh(new THREE.CylinderGeometry(0.12,0.16,6.5,6),MAT.woodDark,x,g0+3.25,z);
mesh(new THREE.BoxGeometry(0.1,0.12,1.8),MAT.woodDark,x,g0+5.8,z);
CYLS.push({x,z,r:0.2,y0:g0,y1:g0+6.5});
}
}
}
buildWorld();
const FLAGS=CAMPAIGN.flags.map(f=>({id:f.id,x:f.x,z:f.z,r:f.r,owner:-1,cap:0,capTeam:-1}));
const BASES=CAMPAIGN.bases.map(b=>({x:b.x,z:b.z}));
FLAGS.forEach(f=>{
const g0=heightAt(f.x,f.z);
const pole=mesh(new THREE.CylinderGeometry(0.07,0.09,7,8),MAT.metal,f.x,g0+3.5,f.z);
CYLS.push({x:f.x,z:f.z,r:0.15,y0:g0,y1:g0+7});
const flagC=document.createElement('canvas'); flagC.width=64; flagC.height=40;
f.flagCtx=flagC.getContext('2d');
f.flagTex=new THREE.CanvasTexture(flagC);
const fm=new THREE.Mesh(new THREE.PlaneGeometry(2.4,1.5), new THREE.MeshLambertMaterial({map:f.flagTex,side:THREE.DoubleSide}));
fm.position.set(f.x+1.25,g0+6,f.z);
world.add(fm);
f.flagMesh=fm; f.poleTop=g0+6.6; f.gy=g0;
drawFlagTex(f);
});
function drawFlagTex(f){
const g=f.flagCtx;
if(f.owner===0){ g.textAlign='start'; g.fillStyle=TEAM_FACTION[0].flagBg; g.fillRect(0,0,64,40); g.fillStyle='#fff'; g.font='bold 26px sans-serif'; g.fillText(TEAM_FACTION[0].sym,20,31); }
else if(f.owner===1){ g.textAlign='start'; g.fillStyle=TEAM_FACTION[1].flagBg; g.fillRect(0,0,64,40); g.fillStyle='#eee'; g.font='bold 26px sans-serif'; g.fillText(TEAM_FACTION[1].sym,20,31); }
else {
g.fillStyle='#c9c9bb'; g.fillRect(0,0,64,40); g.fillStyle='#555';
// 多字点位名 (如"大桥") 自动缩字号并居中
g.textAlign='center';
if(f.id.length>2){ g.font='bold 12px sans-serif'; g.fillText(f.id,32,26); }
else if(f.id.length===2){ g.font='bold 15px sans-serif'; g.fillText(f.id,32,26); }
else { g.font='bold 22px sans-serif'; g.fillText(f.id,32,29); }
}
f.flagTex.needsUpdate=true;
}
const AMMO_CRATES=[];
function ammoCrate(x,z){
const g0=heightAt(x,z);
const m=solidBox(MAT.woodDark,1.1,0.7,0.8,x,g0+0.35,z,rand(0,3));
const lid=mesh(new THREE.BoxGeometry(1.15,0.08,0.85),MAT.wood,x,g0+0.74,z,m.rotation.y);
AMMO_CRATES.push({x,z,y:g0});
}
// 弹药箱: 每个旗点与基地附近 (通用); 大桥旗点固定放在桥面上, 避免落进河谷
FLAGS.forEach(f=>{
if(BRIDGE&&onBridge(f.x,f.z,4)){ const p=bridgePt(-5,2.2); ammoCrate(p[0],p[1]); }
else ammoCrate(f.x+rand(-5,5),f.z+rand(-5,5));
});
ammoCrate(BASES[0].x+(BASES[0].x<0?3:-3),3); ammoCrate(BASES[1].x+(BASES[1].x<0?3:-3),-3);
const MG42S=[];
// 各阵营架设重机枪 (对应历史型号/射速/威力)
const FACTION_MG={
us: { name:'M1919A4 勃朗宁重机枪', rpm:520, dmg:29, heatPS:0.011, style:'air' },
ger:{ name:'MG42 通用机枪',        rpm:1100,dmg:25, heatPS:0.014, style:'mg42' },
sov:{ name:'马克沁 M1910 重机枪',  rpm:560, dmg:29, heatPS:0.006, style:'water' },
kmt:{ name:'二四式重机枪',         rpm:480, dmg:30, heatPS:0.006, style:'water' },
cpc:{ name:'二四式重机枪(缴获)',   rpm:460, dmg:30, heatPS:0.006, style:'water' },
jp: { name:'九二式重机枪',         rpm:440, dmg:32, heatPS:0.009, style:'92' },
};
function mgDefOfTeam(team){ return FACTION_MG[CAMPAIGN.f[team]]||FACTION_MG.ger; }
function mg42(x,z,face,team){
if(team===undefined||team===null) team=x<0?0:1;
const def=mgDefOfTeam(team);
const g0=heightAt(x,z);
// 掩护矮墙: 横向挡在机枪正前方 (沙袋墙沿垂直于射向的方向延展)
// 降到0.5m高: 低于枪管(1m), 俯射不再被自家沙袋挡弹, 仍可为枪手挡低弹道
sandbagWall(x+Math.sin(face)*1.1, z+Math.cos(face)*1.1, 3, face, 0.5);
const grp=new THREE.Group();
grp.position.set(x,g0+1.0,z);
grp.rotation.y=face;
const yaw=new THREE.Group(); grp.add(yaw);
const pitch=new THREE.Group(); yaw.add(pitch);
const barrel=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.06,1.3,8),MAT.metalDark);
barrel.rotation.x=HPI; barrel.position.z=0.65; pitch.add(barrel);
if(def.style==='water'){
// 水冷套筒 (马克沁/二四式)
const jacket=new THREE.Mesh(new THREE.CylinderGeometry(0.085,0.085,0.62,10),MAT.metal);
jacket.rotation.x=HPI; jacket.position.z=0.72; pitch.add(jacket);
} else if(def.style==='air'){
// 风冷散热套筒 (M1919)
const jacket=new THREE.Mesh(new THREE.CylinderGeometry(0.062,0.062,0.7,8),MAT.metalDark);
jacket.rotation.x=HPI; jacket.position.z=0.6; pitch.add(jacket);
} else if(def.style==='92'){
// 九二式: 左侧供弹保弹板匣
const hopper=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.1,0.22),MAT.metalDark);
hopper.position.set(-0.2,0.02,0.05); pitch.add(hopper);
}
const body=new THREE.Mesh(new THREE.BoxGeometry(0.14,0.2,0.75),MAT.metalDark);
body.position.z=0.0; pitch.add(body);
const shield=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.55,0.05),MAT.metal);
shield.position.set(0,0.05,0.35); pitch.add(shield);
const tripod1=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,1.0,6),MAT.metalDark);
tripod1.position.set(0,-0.5,0); grp.add(tripod1);
grp.traverse(o=>{ o.castShadow=true; });
world.add(grp);
MG42S.push({x,z,y:g0+1.0,face,grp,yaw,pitch,user:null,heat:0,muzzle:V3(),def,team});
}
