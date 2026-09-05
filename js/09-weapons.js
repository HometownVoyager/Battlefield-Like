// ─────────────────────────────────────────────
// 09-weapons.js —— 武器定义/枪械模型/兵种
// 源: Index.original.html 第 2938-3468 行
// 2026-08-24 切分: WPN_DEFS/CLASSES/CLS_POOL 数据表 → 09a-defs.js (原第6-65行)
// ─────────────────────────────────────────────
'use strict';
const vmMats = {
wood: new THREE.MeshLambertMaterial({map:TEX.wood}),
woodD: new THREE.MeshLambertMaterial({map:TEX.woodDark}),
gun: new THREE.MeshLambertMaterial({color:0x2e3030, map:TEX.metalBrush}),
gunL: new THREE.MeshLambertMaterial({color:0x44484a, map:TEX.metalBrush}),
brass: new THREE.MeshLambertMaterial({color:0xb89440}),
sleeve0: new THREE.MeshLambertMaterial({color:0x4d5240}),
sleeve1: new THREE.MeshLambertMaterial({color:0x4a4d52}),
skin: new THREE.MeshLambertMaterial({color:0xc09878}),
nade: new THREE.MeshLambertMaterial({color:0x3a4232}),
};
vmMats.sleeve0.color.set(TEAM_FACTION[0].sleeve);
vmMats.sleeve1.color.set(TEAM_FACTION[1].sleeve);
function bx(mat,w,h,d,x,y,z,g){
const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
m.position.set(x,y,z); if(g) g.add(m); return m;
}
function cyl(mat,r1,r2,h,x,y,z,g,rx=HPI){
const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,10),mat);
m.position.set(x,y,z); m.rotation.x=rx; if(g) g.add(m); return m;
}
function buildGunModel(key){
const G=new THREE.Group();
const parts={gun:G, muzzle:V3(0,0.032,-0.62)};
const wd=vmMats.wood, gm=vmMats.gun, gl=vmMats.gunL;
if(WPN_DEFS[key]&&WPN_DEFS[key].model) key=WPN_DEFS[key].model;
if(key==='garand'){
bx(wd,0.052,0.075,0.62, 0,-0.012,-0.09,G);
bx(wd,0.05,0.1,0.24, 0,-0.06,0.2,G).rotation.x=-0.22;
cyl(gm,0.012,0.012,0.62, 0,0.032,-0.36,G);
bx(gm,0.05,0.045,0.3, 0,0.03,-0.05,G);
bx(gm,0.012,0.03,0.012, 0,0.057,-0.635,G);
bx(gm,0.032,0.01,0.02, 0,0.045,0.03,G);
bx(gm,0.007,0.026,0.02, -0.0125,0.062,0.03,G);
bx(gm,0.007,0.026,0.02, 0.0125,0.062,0.03,G);
parts.bolt=bx(gl,0.022,0.02,0.09, 0.03,0.04,-0.02,G);
parts.clip=bx(vmMats.brass,0.022,0.05,0.06, 0,0.05,-0.04);
parts.clip.visible=false; G.add(parts.clip);
parts.muzzle.set(0,0.032,-0.66);
} else if(key==='thompson'){
bx(gm,0.05,0.06,0.34, 0,0.01,-0.1,G);
cyl(gm,0.013,0.013,0.42, 0,0.028,-0.34,G);
cyl(gl,0.02,0.02,0.09, 0,0.028,-0.52,G);
bx(wd,0.045,0.09,0.2, 0,-0.055,0.17,G).rotation.x=-0.2;
bx(wd,0.04,0.08,0.06, 0,-0.052,0.02,G);
bx(wd,0.04,0.07,0.09, 0,-0.015,-0.33,G);
parts.mag=bx(gm,0.025,0.16,0.06, 0,-0.095,-0.14,G);
bx(gm,0.012,0.026,0.012, 0,0.058,-0.53,G);
bx(gm,0.03,0.008,0.02, 0,0.042,0.0,G);
bx(gm,0.006,0.026,0.02, -0.012,0.056,0.0,G);
bx(gm,0.006,0.026,0.02, 0.012,0.056,0.0,G);
parts.bolt=bx(gl,0.018,0.018,0.05, 0.032,0.035,-0.06,G);
parts.muzzle.set(0,0.028,-0.58);
} else if(key==='bar'){
bx(wd,0.055,0.075,0.3, 0,-0.01,0.06,G);
bx(gm,0.055,0.06,0.34, 0,0.012,-0.2,G);
cyl(gm,0.014,0.014,0.54, 0,0.03,-0.48,G);
bx(wd,0.05,0.1,0.22, 0,-0.055,0.24,G).rotation.x=-0.2;
parts.mag=bx(gm,0.028,0.14,0.07, 0,-0.085,-0.16,G);
bx(gm,0.013,0.032,0.013, 0,0.058,-0.72,G);
bx(gm,0.032,0.008,0.02, 0,0.046,-0.02,G);
bx(gm,0.007,0.028,0.02, -0.013,0.061,-0.02,G);
bx(gm,0.007,0.028,0.02, 0.013,0.061,-0.02,G);
cyl(gl,0.008,0.008,0.24, 0.012,-0.05,-0.66,G,0.3);
cyl(gl,0.008,0.008,0.24, -0.012,-0.05,-0.66,G,0.3);
parts.bolt=bx(gl,0.02,0.02,0.06, 0.036,0.03,-0.12,G);
parts.muzzle.set(0,0.03,-0.76);
} else if(key==='springfield'||key==='kar98'||key==='kar98zf'||key==='m1903'){
bx(wd,0.05,0.07,0.7, 0,-0.01,-0.12,G);
bx(wd,0.05,0.1,0.26, 0,-0.055,0.24,G).rotation.x=-0.2;
cyl(gm,0.011,0.011,0.6, 0,0.03,-0.46,G);
bx(gm,0.045,0.04,0.22, 0,0.03,0.0,G);
bx(gm,0.012,0.03,0.012, 0,0.054,-0.745,G);
if(key==='kar98'||key==='m1903'){
const vl=bx(gm,0.013,0.017,0.026, -0.011,0.054,-0.1,G); vl.rotation.z=0.45;
const vr=bx(gm,0.013,0.017,0.026, 0.011,0.054,-0.1,G); vr.rotation.z=-0.45;
bx(gm,0.03,0.007,0.026, 0,0.043,-0.1,G);
} else {
cyl(gl,0.021,0.021,0.14, 0,0.085,-0.02,G);
cyl(gl,0.026,0.021,0.03, 0,0.085,-0.1,G);
cyl(gl,0.026,0.021,0.03, 0,0.085,0.06,G);
bx(gm,0.012,0.03,0.03, 0,0.062,-0.02,G);
}
const boltG=new THREE.Group(); boltG.position.set(0.024,0.034,0.05); G.add(boltG);
cyl(gl,0.012,0.012,0.1, 0,0,0,boltG);
const handle=new THREE.Group(); boltG.add(handle);
cyl(gl,0.007,0.007,0.05, 0.025,-0.01,0.02,handle,0);
handle.children[0].rotation.z=1.2;
const knob=new THREE.Mesh(new THREE.SphereGeometry(0.013,8,6),gl);
knob.position.set(0.048,-0.02,0.02); handle.add(knob);
parts.bolt=boltG; parts.boltHandle=handle;
parts.clip=bx(vmMats.brass,0.02,0.055,0.05, 0,0.05,0.0);
parts.clip.visible=false; G.add(parts.clip);
parts.muzzle.set(0,0.03,-0.77);
} else if(key==='mp40'){
bx(gm,0.045,0.055,0.3, 0,0.01,-0.08,G);
cyl(gm,0.012,0.012,0.34, 0,0.024,-0.3,G);
bx(gm,0.04,0.05,0.1, 0,-0.03,0.06,G);
bx(vmMats.woodD,0.035,0.07,0.05, 0,-0.07,0.09,G);
parts.mag=bx(gm,0.022,0.17,0.055, 0,-0.1,-0.14,G);
cyl(gl,0.006,0.006,0.26, 0.02,-0.045,0.19,G);
cyl(gl,0.006,0.006,0.26, -0.02,-0.045,0.19,G);
bx(gl,0.04,0.014,0.04, 0,-0.052,0.3,G);
bx(gm,0.011,0.024,0.011, 0,0.046,-0.46,G);
bx(gm,0.028,0.007,0.02, 0,0.038,-0.02,G);
bx(gm,0.006,0.022,0.02, -0.011,0.05,-0.02,G);
bx(gm,0.006,0.022,0.02, 0.011,0.05,-0.02,G);
parts.bolt=bx(gl,0.016,0.016,0.05, -0.026,0.028,-0.1,G);
parts.muzzle.set(0,0.024,-0.5);
} else if(key==='stg44'){
bx(gm,0.05,0.065,0.43, 0,0.005,-0.085,G);
cyl(gm,0.013,0.013,0.36, 0,0.028,-0.37,G);
bx(wd,0.045,0.085,0.2, 0,-0.045,0.22,G).rotation.x=-0.12;
bx(vmMats.woodD,0.038,0.075,0.055, 0,-0.06,0.05,G);
parts.mag=bx(gm,0.026,0.19,0.065, 0,-0.11,-0.15,G);
parts.mag.rotation.x=0.25;
bx(gm,0.012,0.032,0.012, 0,0.055,-0.53,G);
bx(gm,0.03,0.008,0.02, 0,0.043,-0.06,G);
bx(gm,0.006,0.026,0.02, -0.012,0.057,-0.06,G);
bx(gm,0.006,0.026,0.02, 0.012,0.057,-0.06,G);
parts.bolt=bx(gl,0.018,0.018,0.05, 0.028,0.02,-0.16,G);
parts.muzzle.set(0,0.028,-0.56);
} else if(key==='mosin'||key==='mosinpu'){
// 莫辛纳甘: 细长枪身+直拉栓+通条
bx(wd,0.046,0.065,0.76, 0,-0.012,-0.14,G);
bx(wd,0.048,0.095,0.24, 0,-0.055,0.26,G).rotation.x=-0.18;
cyl(gm,0.01,0.01,0.66, 0,0.028,-0.5,G);
cyl(gl,0.005,0.005,0.5, 0,-0.018,-0.5,G);
bx(gm,0.05,0.02,0.05, 0,0.005,-0.5,G);
bx(gm,0.05,0.02,0.05, 0,0.005,-0.24,G);
bx(gm,0.011,0.03,0.011, 0,0.05,-0.815,G);
bx(gm,0.026,0.02,0.05, 0,0.025,-0.05,G).rotation.x=-0.2;
const boltG=new THREE.Group(); boltG.position.set(0.022,0.03,0.06); G.add(boltG);
cyl(gl,0.011,0.011,0.1, 0,0,0,boltG);
const handle=new THREE.Group(); boltG.add(handle);
cyl(gl,0.007,0.007,0.045, 0.026,0,0.02,handle,0);
handle.children[0].rotation.z=HPI;
const knob=new THREE.Mesh(new THREE.SphereGeometry(0.012,8,6),gl);
knob.position.set(0.05,0,0.02); handle.add(knob);
parts.bolt=boltG; parts.boltHandle=handle;
parts.clip=bx(vmMats.brass,0.02,0.055,0.05, 0,0.045,0.02);
parts.clip.visible=false; G.add(parts.clip);
if(key==='mosinpu'){
cyl(gl,0.019,0.019,0.12, 0,0.088,0.0,G);
cyl(gl,0.024,0.019,0.026, 0,0.088,-0.07,G);
cyl(gl,0.024,0.019,0.026, 0,0.088,0.05,G);
bx(gm,0.01,0.06,0.026, 0,0.045,0.0,G);
}
parts.muzzle.set(0,0.028,-0.84);
} else if(key==='arisaka'||key==='type97s'){
// 三八式: 防尘盖+长护木+翼形准星
bx(wd,0.046,0.066,0.78, 0,-0.01,-0.13,G);
bx(wd,0.046,0.06,0.38, 0,0.028,-0.28,G);
bx(wd,0.048,0.095,0.24, 0,-0.055,0.26,G).rotation.x=-0.18;
cyl(gm,0.01,0.01,0.56, 0,0.028,-0.57,G);
bx(gl,0.034,0.03,0.13, 0,0.036,0.03,G);
bx(gm,0.011,0.028,0.011, 0,0.05,-0.845,G);
bx(gm,0.007,0.02,0.011, -0.016,0.046,-0.845,G).rotation.z=0.5;
bx(gm,0.007,0.02,0.011, 0.016,0.046,-0.845,G).rotation.z=-0.5;
bx(gm,0.024,0.018,0.05, 0,0.048,-0.12,G).rotation.x=-0.15;
const boltG=new THREE.Group(); boltG.position.set(0.02,0.032,0.06); G.add(boltG);
cyl(gl,0.01,0.01,0.09, 0,0,0,boltG);
const handle=new THREE.Group(); boltG.add(handle);
const hh=cyl(gl,0.006,0.006,0.042, 0.024,-0.008,0.01,handle,0);
hh.rotation.z=1.1;
const knob=new THREE.Mesh(new THREE.SphereGeometry(0.011,8,6),gl);
knob.position.set(0.043,-0.017,0.01); handle.add(knob);
parts.bolt=boltG; parts.boltHandle=handle;
parts.clip=bx(vmMats.brass,0.02,0.05,0.05, 0,0.05,0.03);
parts.clip.visible=false; G.add(parts.clip);
if(key==='type97s'){
cyl(gl,0.018,0.018,0.13, -0.035,0.075,0.02,G);
cyl(gl,0.023,0.018,0.026, -0.035,0.075,-0.05,G);
bx(gm,0.02,0.02,0.03, -0.02,0.05,0.02,G);
}
parts.muzzle.set(0,0.028,-0.86);
} else if(key==='zhongzheng'||key==='zhongzhengs'){
// 中正式: 短骑枪+铁箍+表尺
bx(wd,0.05,0.068,0.64, 0,-0.012,-0.08,G);
bx(wd,0.05,0.098,0.24, 0,-0.056,0.24,G).rotation.x=-0.2;
cyl(gm,0.011,0.011,0.5, 0,0.03,-0.43,G);
bx(gm,0.054,0.024,0.04, 0,0,-0.36,G);
bx(gm,0.046,0.034,0.24, 0,0.028,-0.02,G);
bx(gm,0.012,0.03,0.012, 0,0.054,-0.665,G);
bx(gm,0.032,0.008,0.03, 0,0.045,-0.1,G);
bx(gm,0.007,0.026,0.03, -0.013,0.058,-0.1,G);
bx(gm,0.007,0.026,0.03, 0.013,0.058,-0.1,G);
const boltG=new THREE.Group(); boltG.position.set(0.024,0.032,0.05); G.add(boltG);
cyl(gl,0.012,0.012,0.1, 0,0,0,boltG);
const handle=new THREE.Group(); boltG.add(handle);
const hh=cyl(gl,0.007,0.007,0.05, 0.025,-0.01,0.02,handle,0);
hh.rotation.z=1.2;
const knob=new THREE.Mesh(new THREE.SphereGeometry(0.013,8,6),gl);
knob.position.set(0.048,-0.02,0.02); handle.add(knob);
parts.bolt=boltG; parts.boltHandle=handle;
parts.clip=bx(vmMats.brass,0.02,0.055,0.05, 0,0.05,0.0);
parts.clip.visible=false; G.add(parts.clip);
if(key==='zhongzhengs'){
cyl(gl,0.02,0.02,0.13, 0,0.086,-0.01,G);
cyl(gl,0.025,0.02,0.028, 0,0.086,-0.085,G);
cyl(gl,0.025,0.02,0.028, 0,0.086,0.06,G);
bx(gm,0.011,0.028,0.028, 0,0.058,-0.01,G);
}
parts.muzzle.set(0,0.03,-0.71);
} else if(key==='hanyang'){
// 汉阳造"老套筒": 枪管外套筒
bx(vmMats.woodD,0.05,0.066,0.68, 0,-0.014,-0.1,G);
bx(vmMats.woodD,0.05,0.096,0.24, 0,-0.058,0.24,G).rotation.x=-0.2;
cyl(gm,0.017,0.017,0.4, 0,0.03,-0.52,G);
cyl(gm,0.01,0.01,0.1, 0,0.03,-0.76,G);
bx(gm,0.044,0.034,0.24, 0,0.026,-0.04,G);
bx(gm,0.011,0.028,0.011, 0,0.052,-0.795,G);
bx(gm,0.03,0.008,0.028, 0,0.046,-0.14,G);
bx(gm,0.006,0.024,0.028, -0.012,0.058,-0.14,G);
bx(gm,0.006,0.024,0.028, 0.012,0.058,-0.14,G);
const boltG=new THREE.Group(); boltG.position.set(0.022,0.03,0.06); G.add(boltG);
cyl(gl,0.011,0.011,0.1, 0,0,0,boltG);
const handle=new THREE.Group(); boltG.add(handle);
const hh=cyl(gl,0.007,0.007,0.05, 0.024,0,0.02,handle,0);
hh.rotation.z=HPI;
const knob=new THREE.Mesh(new THREE.SphereGeometry(0.012,8,6),gl);
knob.position.set(0.047,0,0.02); handle.add(knob);
parts.bolt=boltG; parts.boltHandle=handle;
parts.clip=bx(vmMats.brass,0.02,0.05,0.05, 0,0.05,0.02);
parts.clip.visible=false; G.add(parts.clip);
parts.muzzle.set(0,0.03,-0.81);
} else if(key==='ppsh'){
// 波波沙: 散热孔护筒+71发弹鼓
bx(wd,0.05,0.075,0.3, 0,-0.02,0.14,G);
bx(gm,0.046,0.06,0.26, 0,0.015,-0.08,G);
cyl(gm,0.02,0.02,0.34, 0,0.028,-0.32,G);
for(let i=0;i<4;i++) cyl(gl,0.021,0.021,0.02, 0,0.028,-0.2-i*0.08,G);
bx(gm,0.024,0.02,0.06, 0,0.02,-0.485,G).rotation.x=0.5;
parts.mag=cyl(gm,0.062,0.062,0.045, 0,-0.075,-0.1,G,0);
parts.mag.rotation.x=HPI;
bx(gm,0.012,0.026,0.012, 0,0.059,-0.44,G);
bx(gm,0.028,0.008,0.02, 0,0.05,-0.02,G);
bx(gm,0.006,0.024,0.02, -0.011,0.06,-0.02,G);
bx(gm,0.006,0.024,0.02, 0.011,0.06,-0.02,G);
parts.bolt=bx(gl,0.016,0.016,0.05, 0.028,0.03,-0.05,G);
parts.muzzle.set(0,0.028,-0.5);
} else if(key==='type100'){
// 一〇〇式: 弯弹匣+护筒
bx(wd,0.046,0.07,0.34, 0,-0.018,0.12,G);
bx(gm,0.042,0.055,0.3, 0,0.012,-0.12,G);
cyl(gm,0.018,0.018,0.4, 0,0.026,-0.31,G);
for(let i=0;i<3;i++) cyl(gl,0.019,0.019,0.018, 0,0.026,-0.26-i*0.09,G);
parts.mag=bx(gm,0.022,0.15,0.05, 0,-0.09,-0.16,G);
parts.mag.rotation.x=0.35;
parts.mag.rotation.z=0.08;
bx(gm,0.011,0.024,0.011, 0,0.052,-0.49,G);
bx(gm,0.026,0.007,0.02, 0,0.04,-0.04,G);
parts.bolt=bx(gl,0.015,0.015,0.05, -0.024,0.025,-0.1,G);
parts.muzzle.set(0,0.026,-0.52);
} else if(key==='mp18'){
// 花机关: 左置横插弹匣+散热筒
bx(wd,0.05,0.078,0.36, 0,-0.02,0.14,G);
cyl(gm,0.02,0.02,0.44, 0,0.028,-0.26,G);
for(let i=0;i<5;i++) cyl(gl,0.021,0.021,0.016, 0,0.028,-0.1-i*0.08,G);
bx(gm,0.044,0.055,0.16, 0,0.005,0.0,G);
parts.mag=bx(gm,0.13,0.026,0.05, -0.09,0.022,-0.06,G);
cyl(gm,0.013,0.013,0.04, -0.03,0.022,-0.06,G,0);
bx(gm,0.011,0.024,0.011, 0,0.054,-0.46,G);
bx(gm,0.026,0.007,0.02, 0,0.034,0.04,G);
parts.muzzle.set(0,0.028,-0.5);
} else if(key==='dp28'){
// DP-28: 顶置弹盘+两脚架
bx(wd,0.045,0.07,0.24, 0,-0.015,0.22,G);
bx(gm,0.05,0.06,0.3, 0,0.01,-0.02,G);
cyl(gm,0.014,0.014,0.56, 0,0.024,-0.34,G);
cyl(gm,0.02,0.016,0.1, 0,0.024,-0.58,G);
parts.mag=cyl(gm,0.075,0.075,0.022, 0,0.075,-0.04,G,0);
parts.mag.rotation.x=HPI;
cyl(gm,0.01,0.01,0.16, 0,0.005,-0.3,G);
cyl(gl,0.007,0.007,0.22, 0.012,-0.06,-0.56,G,0.35);
cyl(gl,0.007,0.007,0.22, -0.012,-0.06,-0.56,G,0.35);
bx(gm,0.011,0.026,0.011, 0,0.048,-0.6,G);
bx(gm,0.026,0.007,0.02, 0,0.036,0.06,G);
bx(vmMats.woodD,0.036,0.07,0.05, 0,-0.065,0.1,G);
parts.muzzle.set(0,0.024,-0.64);
} else if(key==='type96'||key==='zb26'){
// 九六式/捷克式: 顶置弹匣+提把+两脚架
const jw=key==='type96';
bx(wd,0.045,0.07,0.26, 0,-0.015,0.22,G);
bx(gm,0.05,0.062,0.34, 0,0.008,-0.04,G);
cyl(gm,0.015,0.015,0.52, 0,0.026,-0.36,G);
for(let i=0;i<4;i++) cyl(gl,0.017,0.017,0.014, 0,0.026,-0.3-i*0.06,G);
parts.mag=bx(gm,0.024,0.16,0.055, 0,0.12,-0.1,G);
parts.mag.rotation.x=jw?-0.25:-0.1;
const hd=bx(gm,0.014,0.02,0.1, jw?0.012:-0.012,0.044,0.06,G);
cyl(gl,0.007,0.007,0.2, 0.012,-0.055,-0.5,G,0.35);
cyl(gl,0.007,0.007,0.2, -0.012,-0.055,-0.5,G,0.35);
bx(gm,0.012,0.024,0.012, 0.012,0.045,-0.6,G);
bx(gm,0.024,0.007,0.02, 0.02,0.035,0.02,G);
bx(vmMats.woodD,0.036,0.07,0.05, 0,-0.06,0.12,G);
parts.bolt=bx(gl,0.016,0.016,0.05, 0.026,0.02,-0.1,G);
parts.muzzle.set(0,0.026,-0.63);
} else if(key==='type11'){
// 歪把子: 左侧漏斗供弹+弯枪托
const st=bx(wd,0.042,0.062,0.3, 0.03,-0.02,0.2,G);
st.rotation.y=-0.12;
bx(gm,0.046,0.055,0.3, 0,0.008,-0.06,G);
cyl(gm,0.013,0.013,0.46, 0,0.024,-0.33,G);
for(let i=0;i<3;i++) cyl(gl,0.015,0.015,0.014, 0,0.024,-0.28-i*0.07,G);
parts.mag=bx(gm,0.05,0.085,0.07, -0.042,0.055,0.0,G);
cyl(gl,0.007,0.007,0.2, 0.011,-0.055,-0.46,G,0.35);
cyl(gl,0.007,0.007,0.2, -0.011,-0.055,-0.46,G,0.35);
bx(gm,0.011,0.024,0.011, 0,0.046,-0.54,G);
bx(gm,0.024,0.007,0.018, 0,0.034,0.0,G);
parts.muzzle.set(0,0.024,-0.58);
} else if(key==='ptrd'||key==='boys'||key==='type97at'){
// 反坦克枪: 超长枪管+大型枪口制退器
const jp2=key==='type97at';
bx(gm,0.05,0.07,0.36, 0,0,0.1,G);
cyl(gm,0.016,0.016,1.0, 0,0.03,-0.52,G);
if(key==='ptrd'){
bx(gm,0.07,0.05,0.07, 0,0.03,-1.03,G);
bx(gm,0.02,0.06,0.05, 0,0.03,-1.06,G);
} else if(key==='boys'){
cyl(gm,0.036,0.036,0.07, 0,0.03,-1.03,G);
for(let i=0;i<3;i++) bx(gl,0.078,0.01,0.012, 0,0.03,-1.01-i*0.02,G);
} else {
cyl(gm,0.03,0.05,0.1, 0,0.03,-1.02,G);
}
if(!key.startsWith('ptrd')){
parts.mag=bx(gm,0.026,0.13,0.06, 0,0.105,-0.08,G);
parts.mag.rotation.x=-0.12;
}
bx(wd,0.04,0.085,0.2, 0,-0.05,0.24,G).rotation.x=-0.15;
bx(vmMats.woodD,0.034,0.07,0.05, 0,-0.06,0.08,G);
cyl(gl,0.008,0.008,0.3, 0.013,-0.08,-0.72,G,0.3);
cyl(gl,0.008,0.008,0.3, -0.013,-0.08,-0.72,G,0.3);
bx(gm,0.012,0.03,0.012, jp2?0.02:0,0.058,-0.9,G);
bx(gm,0.028,0.008,0.024, jp2?0.02:0,0.037,-0.1,G);
bx(gm,0.006,0.024,0.024, (jp2?0.02:0)-0.012,0.05,-0.1,G);
bx(gm,0.006,0.024,0.024, (jp2?0.02:0)+0.012,0.05,-0.1,G);
if(key!=='type97at'){
const boltG=new THREE.Group(); boltG.position.set(0.026,0.045,0.02); G.add(boltG);
cyl(gl,0.013,0.013,0.11, 0,0,0,boltG);
const handle=new THREE.Group(); boltG.add(handle);
const hh=cyl(gl,0.008,0.008,0.055, 0.028,-0.01,0.02,handle,0);
hh.rotation.z=1.2;
const knob=new THREE.Mesh(new THREE.SphereGeometry(0.014,8,6),gl);
knob.position.set(0.054,-0.022,0.02); handle.add(knob);
parts.bolt=boltG; parts.boltHandle=handle;
} else {
parts.bolt=bx(gl,0.02,0.02,0.06, 0.036,0.035,-0.06,G);
}
parts.muzzle.set(0,0.03,-1.08);
} else if(key==='c96'||key==='c96auto'){
// 驳壳枪: 前置弹匣+扫帚柄握把
const au=key==='c96auto';
bx(gm,0.032,0.055,0.16, 0,0.02,-0.02,G);
cyl(gm,0.012,0.012,0.14, 0,0.045,-0.16,G);
bx(gm,0.03,0.04,0.06, 0,0.048,0.03,G);
parts.mag=bx(gm,0.026,au?0.11:0.06,0.05, 0,-0.035-(au?0.025:0),-0.055,G);
cyl(vmMats.woodD,0.017,0.021,0.075, 0,-0.015,0.055,G,0.25);
bx(gm,0.008,0.016,0.008, 0,0.063,-0.21,G);
bx(gm,0.005,0.012,0.01, -0.008,0.073,0.05,G);
bx(gm,0.005,0.012,0.01, 0.008,0.073,0.05,G);
bx(gl,0.012,0.026,0.02, 0,0.052,0.065,G).rotation.x=0.4;
if(au) bx(vmMats.woodD,0.03,0.06,0.16, 0,-0.02,0.12,G).rotation.x=-0.3;
parts.slide=bx(gl,0.028,0.024,0.1, 0,0.058,-0.03,G);
parts.muzzle.set(0,0.045,-0.24);
} else if(key==='nambu'){
// 南部十四年式: 细长枪管+斜握把
bx(gm,0.028,0.045,0.15, 0,0.02,-0.01,G);
cyl(gm,0.01,0.01,0.12, 0,0.038,-0.14,G);
cyl(gl,0.016,0.016,0.05, 0,0.028,0.055,G,0);
bx(gm,0.026,0.085,0.05, 0,-0.045,0.05,G).rotation.x=-0.4;
parts.mag=bx(gm,0.02,0.06,0.032, 0,-0.032,0.04,G);
parts.mag.rotation.x=-0.4;
bx(gm,0.007,0.016,0.007, 0,0.054,-0.185,G);
bx(gm,0.005,0.012,0.01, 0,0.056,0.03,G);
parts.slide=bx(gl,0.03,0.026,0.09, 0,0.042,0.01,G);
parts.muzzle.set(0,0.038,-0.21);
} else if(key==='mortar'){
// 轻型迫击炮: 斜置发射管+两脚架+座钣
const tube=cyl(gm,0.045,0.05,0.62, 0,0.02,-0.18,G);
tube.rotation.x=0.62-HPI;
cyl(gl,0.052,0.048,0.05, 0,0.24,-0.4,G).rotation.x=0.62-HPI;
bx(gm,0.16,0.02,0.2, 0,-0.16,-0.02,G);
cyl(gl,0.008,0.008,0.3, 0.035,0.01,-0.3,G,-0.55);
cyl(gl,0.008,0.008,0.3, -0.035,0.01,-0.3,G,-0.55);
bx(gm,0.05,0.014,0.02, 0,0.05,-0.12,G);
bx(gl,0.014,0.05,0.014, -0.045,0.27,-0.4,G);
parts.muzzle.set(0,0.3,-0.45);
} else if(key==='bazooka'||key==='schreck'){
// 反坦克火箭筒: 完整肩扛式发射管模型, 机瞄位于管身左上角
const isBz=key==='bazooka';
const tubeMat=new THREE.MeshLambertMaterial({color:isBz?0x4a5238:0x52524a});
const tubeR=isBz?0.046:0.056;
cyl(tubeMat,tubeR,tubeR,1.35, 0,0.06,-0.22,G);
cyl(gm,tubeR+0.008,tubeR+0.004,0.07, 0,0.06,-0.86,G);
cyl(gm,tubeR+0.008,tubeR+0.004,0.07, 0,0.06,0.4,G);
if(isBz){
cyl(gm,tubeR+0.014,tubeR+0.002,0.05, 0,0.06,-0.885,G);
} else {
cyl(gm,tubeR+0.024,tubeR+0.004,0.09, 0,0.06,-0.89,G);
const shield=bx(gl,0.26,0.2,0.012, 0.06,0.01,-0.4,G);
shield.rotation.y=0.06;
}
// 左上角机瞄: 前准星(带护框) + 后觇孔, 瞄准线 x=-0.052 y=0.148
const sx=-0.052;
bx(gm,0.02,0.034,0.01, sx,0.093,-0.6,G);
bx(gm,0.005,0.028,0.005, sx,0.122,-0.6,G);
bx(gm,0.004,0.04,0.005, sx-0.02,0.125,-0.605,G);
bx(gm,0.004,0.04,0.005, sx+0.02,0.125,-0.605,G);
bx(gm,0.044,0.004,0.005, sx,0.137,-0.605,G);
bx(gm,0.02,0.045,0.012, sx,0.098,0.08,G);
bx(gm,0.004,0.034,0.006, sx-0.017,0.136,0.08,G);
bx(gm,0.004,0.034,0.006, sx+0.017,0.136,0.08,G);
bx(gm,0.038,0.004,0.006, sx,0.154,0.08,G);
bx(gm,0.038,0.004,0.006, sx,0.128,0.08,G);
// 握把与护木
bx(wd,0.036,0.09,0.05, 0,-0.035,0.1,G).rotation.x=-0.18;
bx(wd,0.036,0.08,0.05, 0,-0.03,-0.18,G).rotation.x=-0.1;
bx(gm,0.028,0.04,0.1, 0,0.005,0.1,G);
bx(gm,0.01,0.03,0.014, 0,-0.015,0.16,G);
const rkt=cyl(vmMats.gunL,0.03,0.014,0.16, 0,0.06,-0.92,G);
parts.rocketTip=rkt;
// 装填用火箭弹道具
const rr=new THREE.Group();
const rktMat=new THREE.MeshLambertMaterial({color:0x55603e});
cyl(rktMat,0.026,0.026,0.2, 0,0,0.02,rr);
cyl(vmMats.gunL,0.026,0.003,0.09, 0,0,-0.12,rr);
bx(gm,0.003,0.055,0.05, 0,0,0.13,rr);
bx(gm,0.055,0.003,0.05, 0,0,0.13,rr);
rr.visible=false;
G.add(rr);
parts.reloadRocket=rr;
parts.muzzle.set(0,0.06,-0.95);
} else {
bx(gm,0.032,0.05,0.19, 0,0.02,-0.02,G);
parts.slide=bx(gl,0.034,0.032,0.2, 0,0.045,-0.02,G);
bx(gm,0.03,0.09,0.05, 0,-0.04,0.05,G).rotation.x=-0.25;
parts.mag=bx(gm,0.024,0.07,0.036, 0,-0.055,0.048,G);
parts.mag.rotation.x=-0.25;
bx(gm,0.008,0.018,0.008, 0,0.068,-0.115,G);
bx(gm,0.005,0.013,0.01, -0.009,0.064,0.07,G);
bx(gm,0.005,0.013,0.01, 0.009,0.064,0.07,G);
cyl(gm,0.006,0.01,0.03, 0,-0.005,-0.065,G,0.5);
parts.muzzle.set(0,0.045,-0.14);
}
G.traverse(o=>{ if(o.isMesh){ o.castShadow=false; o.receiveShadow=false; } });
return parts;
}
function buildArms(team){
const sleeve=team===0?vmMats.sleeve0:vmMats.sleeve1;
const mk=()=>{
const g=new THREE.Group();
bx(sleeve,0.07,0.07,0.3, 0,0,0.1,g);
bx(vmMats.skin,0.055,0.05,0.1, 0,0,-0.09,g);
return g;
};
return { L:mk(), R:mk() };
}
function buildNadeModel(team){
const g=new THREE.Group();
if(TEAM_FACTION[team].nade==='egg'){
const b=new THREE.Mesh(new THREE.SphereGeometry(0.032,10,8),vmMats.nade);
b.scale.y=1.25; g.add(b);
bx(vmMats.gunL,0.012,0.03,0.012, 0.012,0.04,0,g);
} else {
cyl(vmMats.nade,0.02,0.02,0.07, 0,0.01,0,g,0);
cyl(vmMats.woodD,0.011,0.011,0.11, 0,-0.07,0,g,0);
}
return g;
}
function buildKnife(){
const g=new THREE.Group();
bx(vmMats.woodD,0.02,0.025,0.09, 0,0,0.045,g);
const blade=bx(new THREE.MeshLambertMaterial({color:0x9aa2a8}),0.006,0.028,0.15, 0,0.004,-0.075,g);
return g;
}
