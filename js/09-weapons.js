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
nade: new THREE.MeshLambertMaterial({color:0x3a4232,map:TEX.metalBrush}), // B8/P3-12 手雷
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
// ═════ 通讯仪 (对讲机) 建模 + 配色 —— 单源 ═════
// 用户 2026-10-27 第 1 条: 旧通讯仪是"机身盒 + 斜天线 + 垂挂话筒"的随手件, 与参考图 (对讲机参考.jpg)
// 差得远; 更要命的是第一人称与第三人称**各画各的** (11-soldiers 的 worldGunModel 连 radio 分支都没有,
// 于是第三人称手里握的是一把步枪)。本块把**几何**与**配色**都收成一份, 两个调用点只传"组 + 阵营":
//   radioPalette(team)        → 颜色口径 (机身主色由阵营 coat 派生 ⇒ 用户要的"整体配色对齐阵营颜色")
//   buildRadioBody(G,team)    → 往 G 里塞整机件, 返回剪影锚点
// 尺寸口径 = 参考图剪影的实测比例 (device0: 总高 379 / 总宽 162 / 上段窄块 45×100 / 天线根 24 /
// 下段机身 157×277), 按整机总高 RADIO_H=0.30m 折算成米 —— 与仓内其它枪械模型同为真实尺度
// (加兰德机匣 0.62m), 第一人称贴脸看与第三人称两米外看都不需要额外缩放, 也就不存在"两套尺度"。
const RADIO_H=0.30;
const RADIO_BODY_W=RADIO_H*157/379, RADIO_BODY_H=RADIO_H*277/379, RADIO_BODY_D=0.052;
const RADIO_TOP_W=RADIO_H*45/379, RADIO_TOP_H=RADIO_H*100/379;
const RADIO_ANT_W=RADIO_H*24/379;
// 原点 = 握点 (手在机身下三分之一), 机身底面 y=-RADIO_GRIP_Y。与其它枪械一致: 原点在握把附近,
// 于是第一人称的 HIP 位姿、第三人称的 gunG 挂点都能直接复用, 不需要为工具件另立一套挂载数学。
const RADIO_GRIP_Y=0.075;
const _radioPalCache={};
// 两个 24 位色按 t 线性混合 (只算整数, 沙箱桩里也能跑; 不走 THREE.Color 以免桩的 Color 语义差异)
function _radioMixHex(a,b,t){
const ar=(a>>16)&255, ag=(a>>8)&255, ab=a&255;
const br=(b>>16)&255, bg=(b>>8)&255, bb=b&255;
return (Math.round(ar+(br-ar)*t)<<16)|(Math.round(ag+(bg-ag)*t)<<8)|Math.round(ab+(bb-ab)*t);
}
// 阵营解析: 允许传 team 下标 (0/1, 第三人称 Bot 与玩家只有这个; 丧尸档 2 按 TEAM_FACTION 实际长度)
// 或阵营键 ('us'/'ger'/…, 供探针跨六阵营对账配色)。两种入参走**同一个**派生函数, 不构成第二份配色口径。
// ★ 严格解析 (2026-10-27 Lead 复核 4a): 旧写法 `TEAM_FACTION[team|0]` 把 **undefined/null/NaN 都当成 0**
//   —— 于是"某条路径漏传 team"会静默变成**阵营 0 的颜色** (敌人拿自己人的配色, 画面完全看不出来)。
//   现在只认"确实能在 TEAM_FACTION 里取到项"的下标, 其余一律 null ⇒ 落到下面的中性兜底档。
function radioFactionOf(team){
if(typeof team==='string') return (typeof FACTIONS!=='undefined'&&FACTIONS&&FACTIONS[team])?FACTIONS[team]:null;
if(typeof team!=='number'||!isFinite(team)) return null;
const i=team|0;
if(i!==team||i<0) return null;
if(typeof TEAM_FACTION!=='undefined'&&TEAM_FACTION&&TEAM_FACTION.length) return TEAM_FACTION[i]||null;
return null;
}
// 配色单源。机身主色 = 阵营 coat 压暗去饱和 (参考图实测 #202020~#505050 的深灰档), 保留色相 ⇒
// 远看是"深灰军械", 近看能分出敌我; 旋钮/PTT 用 vmMats.brass (任务要求), 天线深色, 指示灯用阵营亮色
// (频道格) + 绿色电源灯 (参考图的绿色 LED)。四个/六个阵营的 body 必然互不相同 (coat 本来就不同, 且
// 压暗是线性映射, 不会把两个不同色压成同色)。
// 中性兜底 coat: 取**无色相**的纯灰 (0x3a3a3a), 与六个阵营的 coat (全带黄/绿/蓝色相) 都不同 ⇒
// "漏传 team"在画面上是"一台灰色通讯仪", 可辨认; 而不是静默伪装成某个阵营。
const RADIO_COAT_FALLBACK=0x3a3a3a;
function radioPalette(team){
const F=radioFactionOf(team);
const coat=(F&&typeof F.coat==='number')?F.coat:RADIO_COAT_FALLBACK;
// 缓存键按**解析后的 coat** 取, 不按入参: 旧写法 `(team|0)` 让 undefined 与 team0 共用同一个缓存槽
// ⇒ 第一条路径先建好缓存后, 后面所有漏传 team 的调用都会拿到阵营 0 的配色 (同一个坑的第二层)。
const key='c:'+coat;
if(_radioPalCache[key]) return _radioPalCache[key];
const body=_radioMixHex(coat,0x2b2b2b,0.46);      // 机身主色 (深灰, 带阵营色相)
const bodyL=_radioMixHex(coat,0x585858,0.58);     // 上段窄块 / 面板外框 (比机身亮一档, 出层次)
const bodyD=_radioMixHex(coat,0x141414,0.66);     // 背夹 / PTT / 格栅底 (最暗档)
const accent=_radioMixHex(coat,0xffffff,0.46);    // 阵营亮色: 频道信号格 + 侧面识别条
const M=(c,map)=>new THREE.MeshLambertMaterial(map?{color:c,map:map}:{color:c});
const pal={
body:M(body,TEX.metalBrush), bodyL:M(bodyL,TEX.metalBrush), bodyD:M(bodyD,TEX.metalBrush),
accent:M(accent), knob:vmMats.brass, ant:M(0x1c1c1c), screen:M(0x11150f),
ledOn:M(0x38e04a), grille:M(_radioMixHex(coat,0x0e0e0e,0.62)),
bodyHex:body, accentHex:accent,   // 供探针直接对账"四阵营主色互不相同", 不必逐材质摸颜色
};
_radioPalCache[key]=pal;
return pal;
}
// 整机建模 (第一人称与第三人称同一份)。坐标系: +Y 上 / -Z 前 (= 与枪械模型同约定, mountGunModel 的
// rotation.y=PI 才会把正面转到角色胸前), 原点 = 握点。显示面板放在 +Z 面: 第一人称里 +Z 朝向镜头,
// 第三人称经 rotation.y=PI 后 +Z 朝向角色背后 = 同样朝向观察者 —— 两种视角都看得到屏, 不必分两套朝向。
function buildRadioBody(G,team){
const P=radioPalette(team);
const by=-RADIO_GRIP_Y;                            // 机身底面 y
const bh=RADIO_BODY_H, bw=RADIO_BODY_W, bd=RADIO_BODY_D;
const topY=by+bh;
// ── 下段机身 (占总高 73%) ──
bx(P.body,bw,bh,bd, 0,by+bh*0.5,0, G);
bx(P.bodyD,bw*0.97,0.012,bd*1.02, 0,by+0.006,0, G);            // 底盖 (比机身略大, 落地/手握不打滑的一圈棱)
bx(P.bodyL,bw*0.72,bh*0.30,0.004, 0,by+bh*0.64,bd*0.5+0.002, G);  // 面板外框 (浅色, 参考图中部的显示/频率区)
bx(P.screen,bw*0.58,bh*0.20,0.003, 0,by+bh*0.66,bd*0.5+0.004, G); // 频率显示屏 (深色内嵌)
// 信号格: 三根阵营亮色细条, 读作"频道/信号强度"; 也顺带保证任何阵营的屏幕都不是纯黑一块
for(let i=0;i<3;i++) bx(P.accent,0.008,0.004+i*0.004,0.002, -bw*0.20+i*0.012,by+bh*0.62,bd*0.5+0.0055, G);
// 扬声器格栅 (面板下方 4 条横向栅缝)
for(let i=0;i<4;i++) bx(P.grille,bw*0.46,0.0045,0.003, 0,by+bh*0.42-i*0.011,bd*0.5+0.003, G);
// 绿色电源指示灯 (参考图的绿色 LED): 面板右上角, 凸出 1.5mm ⇒ 侧看也有高光
bx(P.ledOn,0.008,0.008,0.005, bw*0.30,by+bh*0.74,bd*0.5+0.004, G);
// 侧面 PTT 按键 (参考图: 机身侧面), 右侧外凸 —— 拇指一按就是通话键, 是"对讲机"最硬的识别特征
bx(P.knob,0.010,bh*0.16,0.026, bw*0.5+0.004,by+bh*0.40,0.004, G);
bx(P.bodyD,0.006,bh*0.20,0.030, bw*0.5+0.001,by+bh*0.40,0.004, G);   // PTT 底座 (与机身咬合, 不留缝)
// 背面携行夹 (第三人称从背后看时唯一的细节, 否则背面是一块纯色平板)
bx(P.bodyD,bw*0.34,bh*0.52,0.006, 0,by+bh*0.52,-bd*0.5-0.004, G);
bx(P.bodyD,bw*0.30,0.010,0.010, 0,by+bh*0.78,-bd*0.5-0.008, G);      // 夹口上唇
// ── 上段 (占总高 26%): 居中窄立块, 由机身顶面收窄成"天线根" ──
// 参考图量到的上段是 45 宽 × 100 高、顶部再收到 24 宽 —— 这一整段就是**粗天线根部**: 剪影里它不是
// 一个方盒而是一根上细下粗的杆, 所以按"宽 45 的座 + 收成 24 的杆"两件建, 不用盒体 (盒体会读成"第二个机身")。
bx(P.bodyD,RADIO_TOP_W,0.014,bd*0.62, 0,topY+0.005,0, G);            // 天线座 (与机身顶面咬合)
const antLow=cyl(P.ant,RADIO_ANT_W*0.5,RADIO_TOP_W*0.5,RADIO_TOP_H*0.62, 0,topY+0.012+RADIO_TOP_H*0.31,0, G,0);
const antTop=cyl(P.ant,RADIO_ANT_W*0.5,RADIO_ANT_W*0.5,RADIO_TOP_H*0.38, 0,topY+0.012+RADIO_TOP_H*0.62+RADIO_TOP_H*0.19,0, G,0);
antLow.rotation.z=0.012; antTop.rotation.z=0.012;                     // 微斜: 纯直立会像一根铅笔
// 天线根上的**金属旋钮** (参考图: 顶部两枚黄铜旋钮, 一频道一音量) —— 这是对讲机除 PTT 外最好认的件
cyl(P.knob,0.0095,0.0095,0.011, -0.016,topY+RADIO_TOP_H*0.30,0, G,0);
cyl(P.knob,0.0075,0.0075,0.009,  0.017,topY+RADIO_TOP_H*0.30,0, G,0);
// 天线顶端的胶套收头 (细一档, 让剪影在天线末端收口而不是被裁平)
cyl(P.bodyD,RADIO_ANT_W*0.42,RADIO_ANT_W*0.50,0.012, 0,topY+0.012+RADIO_TOP_H,0, G,0);
const topYAll=topY+0.012+RADIO_TOP_H+0.006;
return {topY:topYAll, bodyTopY:topY, wMax:bw, bodyHex:P.bodyHex, accentHex:P.accentHex};
}
function buildGunModel(key,team){
const G=new THREE.Group();
const parts={gun:G, muzzle:V3(0,0.032,-0.62)};
const wd=vmMats.wood, gm=vmMats.gun, gl=vmMats.gunL;
const srcKey=key;   // 未换模前的键 (漏夹受弹口只开给加兰德: M1 卡宾枪借本款模型但换弹是旧版, 不收夹)
if(WPN_DEFS[key]&&WPN_DEFS[key].model) key=WPN_DEFS[key].model;
if(key==='garand'){
bx(wd,0.052,0.075,0.62, 0,-0.012,-0.09,G);
bx(wd,0.05,0.1,0.24, 0,-0.06,0.2,G).rotation.x=-0.22;
// 枪管尾端退到 z=-0.09: 受弹口开出来之后管尾会露在口内, 不能再伸进漏夹下落道 (z -0.07~-0.01)。
cyl(gm,0.012,0.012,0.58, 0,0.032,-0.38,G);
// 机匣 (2026-10-05 六裁定): 加兰德开**真受弹口** —— 左右壁 + 前壁围出 2.5cm 宽仓口 (漏夹 2.2cm, 单侧 1.5mm 净空), 口沿 0.0525,
//   仓底即枪身木面 0.0255 (深 2.7cm)。改前是一块实心板, 漏夹怎么落位都在"穿"机匣顶 ⇒ 实机判
//   "从步枪枪机正上方硬塞入"。
if(srcKey==='garand'){
bx(gm,0.0125,0.045,0.3, -0.01875,0.03,-0.05,G);
bx(gm,0.0125,0.045,0.3,  0.01875,0.03,-0.05,G);
bx(gm,0.05,0.045,0.02, 0,0.03,-0.19,G);
} else bx(gm,0.05,0.045,0.3, 0,0.03,-0.05,G);
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
parts.muzzle.set(0,0.06,-1.02); // 火箭筒/巡飞弹(loiter 复用 bazooka 模型)炮口前移出管口 0.02 (P3-10: audit-gunmodels 枪口前置0.050)
} else if(key==='radio'){
// 通讯仪 (2026-10-27 重做, 用户参考图 对讲机参考.jpg): 整机几何与配色走**单源** buildRadioBody() ——
// 第一人称 (这里) 与第三人称 (11-soldiers worldGunModel 的 kind==='radio') 建的是同一份件、同一份色,
// 不再像旧版那样两处各写一套 (旧版三人称根本没有 radio 分支, 直接落成步枪, 见 11-soldiers gunKindOf)。
// 纯工具态无火力 (20-player playerFireTick 的 tool 门), 右键开指挥地图 (19-input 分流)。
// 返回值: {top} = 天线根的三维落点, 供调用方决定"这个握姿下天线是否戳出画面"。
const rb=buildRadioBody(G,team);
parts.muzzle.set(0,0.05,0);   // 无枪口: 保持 origin 附近, 枪口特效对工具件本就不该出现 (tool 门已挡开火)
parts.radioTop=rb.topY;       // 天线尖高度 (探针据此断言"两段式剪影"; 与 buildRadioBody 返回字段同名)
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
// ── 手雷模型单源 (2026-09-30 批) ──
// 手上 (10-viewmodel VM.nadeMs) 与出手后 (13-combat throwNade) **共用同一份建模** ——
//   手里握的与扔出去的必须是同一件东西。旧版手上只有"阵营档"一种模型 (buildNadeModel 只分 egg/stick),
//   于是选烟雾弹/燃烧弹/反坦克雷出手前手里都是普通手雷的样子 (用户 2026-09-30 报)。
// 尺寸 = 真实口径 (m), 原点 = 握点 (木柄雷在柄根/其余在弹体中心); 出手件另乘 NADE_WORLD_SCALE
//   放大一档 (远距离辨识; 旧世界件本就是手上件的近 2 倍, 现在只留 1.5 倍且两处同模)。
const NADE_WORLD_SCALE=1.5;
const nadeMats={
smoke:new THREE.MeshLambertMaterial({color:0x8f948c,map:TEX.metalBrush}),   // 发烟罐罐身 (马口铁灰)
smokeCap:new THREE.MeshLambertMaterial({color:0x5c6058,map:TEX.metalBrush}),
smokeBand:new THREE.MeshLambertMaterial({color:0xb8b0a0}),                 // 罐身标签带 (与罐身异色, 一眼分档)
incin:new THREE.MeshLambertMaterial({color:0x9a3a26,map:TEX.metalBrush}),  // 燃烧弹罐身 (锈红)
incinCap:new THREE.MeshLambertMaterial({color:0x3c3a34,map:TEX.metalBrush}),
charge:new THREE.MeshLambertMaterial({color:0x4a4e44,map:TEX.metalBrush}), // 反坦克装药
strap:new THREE.MeshLambertMaterial({color:0x33352e}),                     // 捆带/卡箍
lever:new THREE.MeshLambertMaterial({color:0x8d9078}),                     // 保险握片 (涂漆铁片)
body0:new THREE.MeshLambertMaterial({color:0x3a4232,map:TEX.metalBrush}),  // 卵形雷体 (美/日, 沿用 vmMats.nade 口径)
body1:new THREE.MeshLambertMaterial({color:0x4a4436,map:TEX.metalBrush}),  // 木柄雷战斗部 (德/国军)
body2:new THREE.MeshLambertMaterial({color:0x55523c,map:TEX.metalBrush}),  // 苏式木柄雷战斗部
wood:new THREE.MeshLambertMaterial({color:0x8a6a44,map:TEX.woodDark}),     // 木柄 (贴图之外再压一层木色: 出图取证与游戏里一致)
gunL:vmMats.gunL,                                                          // 引信头/顶盖/底盖/铁夹 (与枪件同料)
};
const NADE_KINDS=['frag','smoke','incin','at'];
function nadeFamilyOf(team){ const f=TEAM_FACTION[team]||TEAM_FACTION[0]; return f.nade||'egg'; }
function buildNadeMesh(kind,team){
const g=new THREE.Group();
if(kind==='smoke') buildSmokeCan(g);
else if(kind==='incin') buildIncinCan(g);
else if(kind==='at') buildATCharge(g);
else buildFragNade(g,nadeFamilyOf(team));
// 手上件不投影 (VM 场景的光照/阴影链与主场景不同源); 出手件由 throwNade 自己打开 castShadow
g.traverse(o=>{ if(o.isMesh){ o.castShadow=false; o.receiveShadow=false; } });
return g;
}
// 引信组 (引信头 + 保险握片 + 拉环): 四件投掷物共用, 只按弹径缩放/移位 —— 省得四条建模各写一遍拉环。
// 握片是**外挂斜条**: 上端贴引信头 (细, 半径 r*0.40) 下端压在弹体/罐顶的肩上 (粗, r) —— 实机就是这种
// "从引信头搭到体肩"的姿势。写成竖直条会整根埋进弹体里看不见 (2026-09-30 出图抓到)。
function nadeFuzetop(g,r,y){
cyl(nadeMats.gunL,r*0.36,r*0.40,0.030, 0,y,0,g,0);
const lv=bx(nadeMats.lever,r*0.22,r*1.05,r*0.22, r*0.70,y-0.012,0,g);
lv.rotation.z=Math.atan2(0.55,0.85);
const rg=new THREE.Mesh(new THREE.TorusGeometry(0.0095,0.0022,4,10),nadeMats.gunL);
rg.position.set(r*0.86,y+0.012,0); rg.rotation.y=HPI; g.add(rg);
return rg;
}
// 普通手雷: 三档阵营剪影 (卵形 Mk2 菠萝 / 德式木柄 StG24 / 苏式木柄+破片套)
function buildFragNade(g,fam){
if(fam==='egg'){
// 卵形雷 (美 M67/Mk2 · 日 九七式): 低分段球 = 刻槽棱面, 顶上引信头 + 握片 + 拉环
const b=new THREE.Mesh(new THREE.SphereGeometry(0.031,10,7),nadeMats.body0);
b.scale.set(1,1.24,1); g.add(b);
nadeFuzetop(g,0.031,0.046);
} else if(fam==='stickS'){
// 苏式木柄雷 (РГД 族): 细长战斗部 + 外挂破片套 (多一圈棱) + 短柄 + 柄底拉绳珠
cyl(nadeMats.body2,0.026,0.026,0.070, 0,0.035,0,g,0);         // 战斗部 (底面 0 = 木柄顶端, 咬合不悬空)
cyl(nadeMats.strap,0.033,0.033,0.040, 0,0.032,0,g,0);         // 破片套
cyl(nadeMats.gunL,0.027,0.026,0.010, 0,0.075,0,g,0);          // 顶盖
nadeFuzetop(g,0.026,0.088);
cyl(nadeMats.wood,0.0115,0.0105,0.125, 0,-0.0625,0,g,0);      // 木柄
cyl(nadeMats.gunL,0.0125,0.0125,0.010, 0,-0.128,0,g,0);       // 柄底盖
const bead=new THREE.Mesh(new THREE.SphereGeometry(0.008,8,6),new THREE.MeshLambertMaterial({color:0xd8cfb8}));
bead.position.set(0,-0.139,0); g.add(bead);                   // 拉绳瓷珠
} else {
// 德式木柄雷 (StG24 · 国军同型): 等径筒形战斗部 + 铁夹 + 长木柄 + 柄底拉绳
cyl(nadeMats.body1,0.033,0.033,0.070, 0,0.035,0,g,0);         // 战斗部 (底面 0 = 木柄顶端)
cyl(nadeMats.gunL,0.0345,0.033,0.012, 0,0.075,0,g,0);         // 顶盖
bx(nadeMats.gunL,0.007,0.024,0.020, 0.034,0.036,0,g);         // 腰带铁夹
nadeFuzetop(g,0.033,0.088);
cyl(nadeMats.wood,0.0115,0.0105,0.135, 0,-0.0675,0,g,0);      // 木柄
cyl(nadeMats.gunL,0.0125,0.0125,0.010, 0,-0.138,0,g,0);       // 柄底盖
const bead=new THREE.Mesh(new THREE.SphereGeometry(0.008,8,6),new THREE.MeshLambertMaterial({color:0xd8cfb8}));
bead.position.set(0,-0.149,0); g.add(bead);
}
}
// 烟雾弹: 细长马口铁罐 + 上下压盖 + 标签带 (与燃烧弹的矮胖罐形成剪影差)
function buildSmokeCan(g){
cyl(nadeMats.smoke,0.0265,0.0265,0.115, 0,0,0,g,0);
cyl(nadeMats.smokeCap,0.029,0.0265,0.014, 0,0.0645,0,g,0);
cyl(nadeMats.smokeCap,0.0265,0.029,0.014, 0,-0.0645,0,g,0);
cyl(nadeMats.smokeBand,0.0272,0.0272,0.026, 0,-0.016,0,g,0);
nadeFuzetop(g,0.0265,0.082);
}
// 燃烧弹: 矮胖罐 + 点火头/喷嘴 (铝热剂罐, 与烟雾罐同高不同形)
function buildIncinCan(g){
cyl(nadeMats.incin,0.031,0.031,0.082, 0,0,0,g,0);
cyl(nadeMats.incinCap,0.033,0.031,0.012, 0,0.047,0,g,0);
cyl(nadeMats.incinCap,0.031,0.033,0.012, 0,-0.047,0,g,0);
cyl(nadeMats.strap,0.0318,0.0318,0.018, 0,-0.022,0,g,0);
nadeFuzetop(g,0.031,0.064);
cyl(vmMats.brass,0.005,0.009,0.020, 0,0.088,0,g,0);           // 点火喷嘴 (从拉环中间穿出)
}
// 反坦克雷: 圆柱装药 + 顶部锥形聚能罩 + 两道捆带 + 底板 (体量明显大于三件手雷)
function buildATCharge(g){
cyl(nadeMats.charge,0.046,0.050,0.140, 0,0,0,g,0);
cyl(nadeMats.charge,0.018,0.046,0.055, 0,0.0975,0,g,0);       // 聚能罩
cyl(nadeMats.strap,0.0505,0.0505,0.012, 0,0.042,0,g,0);
cyl(nadeMats.strap,0.0505,0.0505,0.012, 0,-0.042,0,g,0);
cyl(nadeMats.gunL,0.052,0.048,0.012, 0,-0.076,0,g,0);          // 底板
nadeFuzetop(g,0.020,0.132);
}
function buildKnife(){
const g=new THREE.Group();
bx(vmMats.woodD,0.02,0.025,0.09, 0,0,0.045,g);
const blade=bx(new THREE.MeshLambertMaterial({color:0x9aa2a8}),0.006,0.028,0.15, 0,0.004,-0.075,g);
return g;
}
