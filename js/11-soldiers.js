// ─────────────────────────────────────────────
// 11-soldiers.js —— 士兵网格/世界枪械模型
// 源: Index.original.html 第 3879-4034 行
// ─────────────────────────────────────────────
'use strict';
const _fwd=V3(), _rgt=V3(), _upv=V3(0,1,0);
function camForward(){ camera.getWorldDirection(_fwd); return _fwd.clone(); }
function camRight(){ camera.getWorldDirection(_fwd); _rgt.crossVectors(_fwd,_upv).normalize(); return _rgt.clone(); }
const soldiers=[];
const combatants=[];
let gunEvents=[];
function angleLerpTo(cur,tgt,maxStep){
let d=tgt-cur;
while(d>Math.PI)d-=TAU; while(d<-Math.PI)d+=TAU;
return cur+clamp(d,-maxStep,maxStep);
}
function angDiff(a,b){ let d=b-a; while(d>Math.PI)d-=TAU; while(d<-Math.PI)d+=TAU; return d; }
const uniformMats=[0,1].map(t=>{
const F=TEAM_FACTION[t];
return {
coat:new THREE.MeshLambertMaterial({color:F.coat, map:TEX.cloth}), pants:new THREE.MeshLambertMaterial({color:F.pants, map:TEX.cloth}),
helm:new THREE.MeshLambertMaterial({color:F.helm, map:TEX.cloth}), skin:new THREE.MeshLambertMaterial({color:F.skin}),
};
});
function worldGunModel(kind,team,key){
const g=new THREE.Group();
const gm=vmMats.gun, wd=vmMats.wood;
const wg=key&&WPN_DEFS[key]?WPN_DEFS[key].wg:null;
if(kind==='smg'){
bx(gm,0.05,0.06,0.5,0,0,-0.1,g);
if(wg==='drum') { const d2=cyl(gm,0.075,0.075,0.05, 0,-0.1,-0.1,g,0); d2.rotation.x=HPI; }
else if(wg==='sidemag') bx(gm,0.16,0.028,0.05, -0.11,0.01,-0.12,g);
else if(wg==='c96a') bx(gm,0.026,0.1,0.05, 0,-0.08,-0.05,g);
else bx(gm,0.024,0.14,0.05,0,-0.09,-0.12,g);
} else if(kind==='mg'){
bx(gm,0.06,0.07,0.8,0,0,-0.15,g);
bx(wd,0.05,0.09,0.18,0,-0.04,0.28,g);
if(wg==='pan'){ const p2=cyl(gm,0.085,0.085,0.026, 0,0.09,-0.12,g,0); p2.rotation.x=HPI; }
else if(wg==='topmag') bx(gm,0.026,0.15,0.06, 0,0.13,-0.12,g);
else if(wg==='hopper') bx(gm,0.055,0.09,0.08, -0.06,0.06,-0.05,g);
cyl(gm,0.008,0.008,0.22, 0.035,-0.1,-0.42,g,0.3);
cyl(gm,0.008,0.008,0.22, -0.035,-0.1,-0.42,g,0.3);
} else if(kind==='atr'){
// 反坦克枪: 超长枪身
bx(gm,0.055,0.07,0.5, 0,0,0.08,g);
cyl(gm,0.017,0.017,0.85, 0,0.02,-0.6,g);
bx(gm,0.06,0.05,0.07, 0,0.02,-1.0,g);
bx(wd,0.045,0.08,0.18, 0,-0.04,0.32,g);
cyl(gm,0.008,0.008,0.26, 0.04,-0.1,-0.66,g,0.3);
cyl(gm,0.008,0.008,0.26, -0.04,-0.1,-0.66,g,0.3);
} else if(kind==='mortar'){
// 迫击炮: 背负式短管+座钣
const tube=cyl(gm,0.05,0.055,0.7, 0,0.08,-0.1,g);
tube.rotation.x=HPI-0.5;
bx(gm,0.24,0.03,0.28, 0,-0.1,0.1,g);
cyl(gm,0.01,0.01,0.34, 0.1,-0.02,-0.25,g,0.9);
cyl(gm,0.01,0.01,0.34, -0.1,-0.02,-0.25,g,0.9);
} else if(kind==='launcher'){
const tubeMat=new THREE.MeshLambertMaterial({color:team===0?0x4a5238:0x52524a});
const tube=cyl(tubeMat,0.075,0.075,1.5, 0,0.12,-0.15,g);
cyl(gm,0.085,0.078,0.09, 0,0.12,-0.86,g);
cyl(gm,0.085,0.078,0.08, 0,0.12,0.52,g);
bx(wd,0.04,0.08,0.06, 0,-0.02,0.02,g);
if(team===1) bx(vmMats.gunL,0.34,0.3,0.015, 0.02,0.1,-0.4,g);
} else {
bx(wd,0.05,0.07,0.75,0,0,-0.05,g);
cyl(gm,0.012,0.012,0.3,0,0.02,-0.55,g);
bx(wd,0.05,0.09,0.2,0,-0.05,0.32,g);
}
g.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
return g;
}
function gunKindOf(key){
let d=WPN_DEFS[key];
if(d.model){ key=d.model; d=WPN_DEFS[key]; }
if(d.rocket) return 'launcher';
if(d.mortar) return 'mortar';
if(d.atRifle) return 'atr';
if(d.pistol) return 'smg';
if(key==='bar'||key==='stg44'||d.wg==='pan'||d.wg==='topmag'||d.wg==='hopper') return 'mg';
if(d.type==='auto') return 'smg';
return 'rifle';
}
function buildSoldierMesh(team,name){
const U=uniformMats[team];
const root=new THREE.Group();
const pelvis=new THREE.Group(); pelvis.position.y=0.94; root.add(pelvis);
const torsoG=new THREE.Group(); pelvis.add(torsoG);
bx(U.coat,0.44,0.55,0.26, 0,0.28,0, torsoG);
const headG=new THREE.Group(); headG.position.set(0,0.62,0); torsoG.add(headG);
bx(U.skin,0.2,0.22,0.2, 0,0.1,0, headG);
// 阵营特色头盔/军帽
let helm;
const hs=TEAM_FACTION[team].helmet;
if(hs==='pot'){
helm=new THREE.Mesh(new THREE.SphereGeometry(0.15,10,8,0,TAU,0,HPI*1.2),U.helm);
helm.position.set(0,0.16,0);
headG.add(helm);
} else if(hs==='stahl'){
helm=new THREE.Mesh(new THREE.SphereGeometry(0.155,10,8,0,TAU,0,HPI*1.35),U.helm);
helm.position.set(0,0.15,0); helm.scale.z=1.15;
headG.add(helm);
// 国军M35: 正面青天白日徽
if(TEAM_FACTION[team].sym==='✷'){
bx(new THREE.MeshLambertMaterial({color:0x2050b0}),0.032,0.032,0.008, 0,0.17,0.148, headG);
bx(new THREE.MeshLambertMaterial({color:0xe8e8e8}),0.016,0.016,0.01, 0,0.17,0.15, headG);
}
} else if(hs==='ssh'){
helm=new THREE.Mesh(new THREE.SphereGeometry(0.152,10,8,0,TAU,0,HPI*1.28),U.helm);
helm.position.set(0,0.155,0); helm.scale.y=1.1;
headG.add(helm);
} else if(hs==='jp'){
helm=new THREE.Mesh(new THREE.SphereGeometry(0.142,10,8,0,TAU,0,HPI*1.22),U.helm);
helm.position.set(0,0.165,0);
headG.add(helm);
const brim=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.17,0.025,10),U.helm);
brim.position.set(0,0.1,0); headG.add(brim);
bx(new THREE.MeshLambertMaterial({color:0xd8b840}),0.02,0.024,0.008, 0,0.16,0.135, headG);
} else {
// 八路军帽: 布帽+短帽檐(朝前)+红星
const cap=bx(U.helm,0.21,0.09,0.21, 0,0.19,0, headG);
bx(U.helm,0.18,0.028,0.07, 0,0.155,0.12, headG);
bx(new THREE.MeshLambertMaterial({color:0xc03028}),0.024,0.024,0.008, 0,0.19,0.106, headG);
}
const mkArm=(side)=>{
const sh=new THREE.Group(); sh.position.set(side*0.28,0.5,0); torsoG.add(sh);
bx(U.coat,0.13,0.32,0.13,0,-0.16,0,sh);
const elm=new THREE.Group(); elm.position.y=-0.32; sh.add(elm);
bx(U.coat,0.115,0.28,0.115,0,-0.14,0,elm);
const hand=new THREE.Group(); hand.position.y=-0.3; elm.add(hand);
bx(U.skin,0.09,0.09,0.09,0,0,0,hand);
sh.userData.swing=0;
return {sh,elm,hand};
};
const armL=mkArm(-1), armR=mkArm(1);
const mkLeg=(side)=>{
const hip=new THREE.Group(); hip.position.set(side*0.12,0,0); pelvis.add(hip);
bx(U.pants,0.16,0.46,0.16,0,-0.23,0,hip);
const knee=new THREE.Group(); knee.position.y=-0.46; hip.add(knee);
bx(U.pants,0.14,0.48,0.14,0,-0.24,0,knee);
bx(new THREE.MeshLambertMaterial({color:0x2e2820}),0.15,0.1,0.24,0,-0.46,0.04,knee);
return {hip,knee};
};
const legL=mkLeg(-1), legR=mkLeg(1);
const gunG=new THREE.Group(); gunG.position.set(0.14,0.4,0.1); gunG.rotation.order='YXZ'; torsoG.add(gunG);
bx(team===0?U.pants:U.coat,0.3,0.34,0.14, 0,0.3,-0.18, torsoG);
bx(new THREE.MeshLambertMaterial({color:0x3a3428}),0.4,0.08,0.28, 0,0.02,0, torsoG);
root.traverse(o=>{ if(o.isMesh){ o.castShadow=true; } });
const c=document.createElement('canvas'); c.width=128; c.height=32;
const g2=c.getContext('2d');
g2.font='bold 20px sans-serif'; g2.textAlign='center';
g2.fillStyle=team===0?'#a8ccff':'#ffb3a6';
g2.strokeStyle='rgba(0,0,0,.8)'; g2.lineWidth=4;
g2.strokeText(name,64,22); g2.fillText(name,64,22);
const tag=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthTest:false}));
tag.scale.set(0.9,0.22,1); tag.position.y=2.05; tag.renderOrder=5;
root.add(tag);
scene.add(root);
return {root,pelvis,torsoG,headG,armL,armR,legL,legR,gunG,tag};
}
