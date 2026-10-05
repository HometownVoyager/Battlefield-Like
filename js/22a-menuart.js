// ─────────────────────────────────────────────
// 22a-menuart.js —— 主菜单左上角装饰画面 (2026-09-13)
// 两张独立卡片, 竖排于屏幕左上角, 纯图形不带文字:
//   ① 战役沙盘: 按当前 CAMPAIGN 语义表 (terr/city/river/bridge/delta/loess/wood/steppe/
//      fields/roads/trench/flags/bases) 数据驱动生成的"战术等高线沙盘" —— 选不同战役卡片,
//      沙盘随 sf_campaign 存档一起变 (刷新后即"当前选择"的实时反映);
//   ② 阵营盾徽: 本战役双方 (TEAM_FACTION[0/1]) 的纹章盾 —— 盾形+军旗底色+徽记
//      (★/✠/☭/☀/✷/✭)+头盔剪影 (pot/stahl/ssh/jp/cap)+ 己方列队色带; 玩家所选一方高亮。
// 约定: 全部为静态 SVG 字符串 (无 DOM 依赖), 经 .innerHTML 挂到 #menuArt 的两个容器;
//       几何数据一律读 00-config 单源, 严禁在此另写一张地图的坐标。
// 校验: node dev/verify-menuart.js (11 战役 × 6 阵营: XML 良构/id 引用/size 漂移/空产出)
// ─────────────────────────────────────────────
'use strict';

// 沙盘画幅 (viewBox 内部坐标系, 正方形)
const MA_VIEW=260;

// ── XML 文本转义 (备用: 现输出全部是数值与固定色, 无外部文本节点; 日后若往沙盘写地名/编号, 文本务必过这里) ──
function _maEsc(s){
return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
const _maN=v=>Math.round(v*100)/100; // 数值压缩: 免去 0.30000000000000004 之类长尾

// ── 世界坐标 → 沙盘坐标 (等比, 图幅两侧留 PAD 边距) ──
function _maProj(){
const pad=MA_VIEW*0.055, span=MA_VIEW-pad*2;
const half=MAP_SIZE/2+10;               // 与 23-deploy drawDeployMap 同口径
const k=span/(half*2);
return {
pad, k,
p:(x,z)=>[_maN(pad+(x+half)*k), _maN(pad+(z+half)*k)],
len:v=>_maN(v*k),
rect:(x0,z0,x1,z1)=>{
const a=pad+(x0+half)*k, b=pad+(z0+half)*k;
return {x:_maN(a), y:_maN(b), w:_maN((x1-x0)*k), h:_maN((z1-z0)*k)};
}
};
}
// 折线 → path d (提供可选闭合)
function _maPath(pts,proj,close){
let d='';
for(let i=0;i<pts.length;i++){
const [px,py]=proj.p(pts[i][0],pts[i][1]);
d+=(i?'L':'M')+px+' '+py;
}
return close?d+'Z':d;
}

// ── 主题色板: 地表/高地/洼地/植被/线画 (与 00-config THEMES 同语义, 只取沙盘用得上的几色) ──
const MA_TINT={
green:      {lo:'#3f5230',hi:'#7f9257',veg:'#41602f',line:'#2c3a22'},
winter:     {lo:'#8e99a6',hi:'#dfe6ee',veg:'#5d6a5a',line:'#68727e'},
ruin:       {lo:'#6b6259',hi:'#b3a692',veg:'#5c5a48',line:'#4a443c'},
china:      {lo:'#8e9a76',hi:'#dfd8b4',veg:'#5d7a45',line:'#5f5a45'},
loess:      {lo:'#b08b52',hi:'#e8d6a4',veg:'#8b8b52',line:'#7a5f36'},
jungle:     {lo:'#33512c',hi:'#86ac5c',veg:'#2c5527',line:'#22391e'},
deepjungle: {lo:'#223c2c',hi:'#5f8a52',veg:'#1e3a25',line:'#16281a'},
alpine:     {lo:'#93a1b0',hi:'#e6ebf1',veg:'#4a6350',line:'#6b7684'},
steppe:     {lo:'#b9a55e',hi:'#efe1a6',veg:'#8f8f47',line:'#7d6c36'},
woods:      {lo:'#37412f',hi:'#6d7a5f',veg:'#26331f',line:'#1d2618'},
mountain:   {lo:'#8d7f62',hi:'#dccfae',veg:'#5f6a45',line:'#5f5340'},
// pacific (P4 2026-09-30): 塔拉瓦与两张全海图的主题色 —— 旧版缺这一键 ⇒ 菜单航拍缩略图
//   一律回落到 green, 太平洋图在菜单里是一块草绿。
pacific:    {lo:'#2f5f78',hi:'#7fb7c4',veg:'#3f6b3a',line:'#22485c'},
// nightsea (2026-10-04 海战审计 V1): 铁底湾月夜 —— 旧版同样缺这一键回落 green, 夜战图读作草绿
nightsea:   {lo:'#131c26',hi:'#3d4a5c',veg:'#14231e',line:'#0d141c'},
};
// 夜档沙盘压暗 (昼夜设计 §3.3, 2026-10-05): 每色 RGB ×0.42 再向夜蓝 #101a28 混 18% ——
//   sf_daynight=night 时菜单沙盘预览夜战观感; 白天档原样返回 (零回归)。
function _maDim(hex){
const n=parseInt(hex.slice(1),16);
const r=Math.min(255,Math.round(((n>>16)&255)*0.42*0.82+16*0.18));
const g=Math.min(255,Math.round(((n>>8)&255)*0.42*0.82+26*0.18));
const b=Math.min(255,Math.round((n&255)*0.42*0.82+40*0.18));
return '#'+((r<<16)|(g<<8)|b).toString(16).padStart(6,'0');
}
const maTint=()=>{
const t0=MA_TINT[CAMPAIGN.theme]||MA_TINT.green;
if(!NIGHT_MODE) return t0;
return {lo:_maDim(t0.lo),hi:_maDim(t0.hi),veg:_maDim(t0.veg),line:_maDim(t0.line)};
};

// ── 沙盘底: 地表色 + 分形起伏晕渲 + 等高线 (纯滤镜, 不带任何随机) ──
// 说明: 起伏=feTurbulence 作高度场经 feDiffuseLighting 斜射(az315/el58)出立体感, 与 SourceGraphic 相乘压回地表色;
//       等高线=另一层 feTurbulence 经 feComponentTransfer 离散色阶切成色带, 再用 feFlood+feComposite 染成线色。
//       滤镜 id 一律带战役前缀 (同页沙盘+两枚盾徽共存, id 冲突会让后画的吃掉先画的; verify-menuart 兜底)。
function _maTerrainBody(id){
return `<rect width="${MA_VIEW}" height="${MA_VIEW}" fill="url(#${id}bg)"/>`
+`<rect width="${MA_VIEW}" height="${MA_VIEW}" filter="url(#${id}relief)" opacity=".85"/>`
+`<rect width="${MA_VIEW}" height="${MA_VIEW}" filter="url(#${id}contour)" opacity=".5"/>`;
}
function _maTerrainDefs(id,t){
return `<defs>`
+`<linearGradient id="${id}bg" x1="0" y1="0" x2="0.7" y2="1">`
+`<stop offset="0" stop-color="${t.hi}"/><stop offset=".55" stop-color="${t.lo}"/><stop offset="1" stop-color="${t.line}"/>`
+`</linearGradient>`
+`<filter id="${id}relief" x="0" y="0" width="${MA_VIEW}" height="${MA_VIEW}" color-interpolation-filters="sRGB">`
+`<feTurbulence type="fractalNoise" baseFrequency="0.011 0.013" numOctaves="5" seed="7" result="n"/>`
+`<feDiffuseLighting in="n" surfaceScale="2.6" diffuseConstant="1" lighting-color="#fff" result="l">`
+`<feDistantLight azimuth="315" elevation="58"/></feDiffuseLighting>`
+`<feComposite in="l" in2="SourceGraphic" operator="arithmetic" k1="1" k2="0" k3="0" k4="0"/>`
+`</filter>`
+`<filter id="${id}contour" x="0" y="0" width="${MA_VIEW}" height="${MA_VIEW}" color-interpolation-filters="sRGB">`
+`<feTurbulence type="fractalNoise" baseFrequency="0.014 0.017" numOctaves="4" seed="19" result="c"/>`
+`<feComponentTransfer in="c" result="step">`
+`<feFuncR type="discrete" tableValues="0 0 0 0 0 0 0 0 1 1"/>`
+`<feFuncG type="discrete" tableValues="0 0 0 0 0 0 0 0 1 1"/>`
+`<feFuncB type="discrete" tableValues="0 0 0 0 0 0 0 0 1 1"/>`
+`<feFuncA type="discrete" tableValues="0 0 0 0 0 0 0 0 0.5 0.5"/>`
+`</feComponentTransfer>`
+`<feFlood flood-color="${t.line}" flood-opacity=".55" result="ink"/>`
+`<feComposite in="ink" in2="step" operator="in"/>`
+`</filter>`
+`</defs>`;
}

// ── 语义件绘制 (全部读 CAMPAIGN 单源) ──
// 正弦路纵线: 游戏内用 03-terrain sineRoadZ; 本文件可能先于它加载 → 按 00-config SINE_ROAD 单源同式自算
function _maSineZ(x){
if(typeof sineRoadZ==='function') return sineRoadZ(x);
return SINE_ROAD.amp*Math.sin(x*SINE_ROAD.freq);
}
// 道路: 土色实线 + 浅色内芯 = 沙盘上的"路网"
function _maRoads(proj){
if(!CAMPAIGN.roads||!CAMPAIGN.roads.length) return '';
let d='';
if(CAMPAIGN.sineRoad){
const half=MAP_SIZE/2-5, pts=[];
for(let x=-half;x<=half;x+=10) pts.push([x,_maSineZ(x)]);
d+=_maPath(pts,proj);
}
for(const r of CAMPAIGN.roads) d+='M'+proj.p(r[0],r[1]).join(' ')+'L'+proj.p(r[2],r[3]).join(' ');
return `<path d="${d}" fill="none" stroke="#3a3226" stroke-opacity=".55" stroke-width="3.1" stroke-linecap="round"/>`
+`<path d="${d}" fill="none" stroke="#e0d3ac" stroke-opacity=".8" stroke-width="1.5" stroke-linecap="round"/>`;
}
// 战壕: 短划虚线 (每段独立, 不连成一片); 岸线相对写法 {rel:[…]} 走 00-config trenchLine 单源展开
function _maTrench(proj){
if(!CAMPAIGN.trench||!CAMPAIGN.trench.length) return '';
let d='';
for(const t of CAMPAIGN.trench){
const L2=(typeof trenchLine==='function')?trenchLine(t):(t&&t.length>=4?t:null);
if(!L2) continue;
d+='M'+proj.p(L2[0],L2[1]).join(' ')+'L'+proj.p(L2[2],L2[3]).join(' ');
}
if(!d) return '';
return `<path d="${d}" fill="none" stroke="#2a2620" stroke-opacity=".75" stroke-width="2.2" stroke-dasharray="3.4 2.4"/>`;
}
// 城市街网: 街道面 + 街块凸起 (沙盘上的"城区块团")
function _maCity(proj){
if(!CAMPAIGN.city) return '';
let s='';
for(const k of CAMPAIGN.city.streets){
const r=proj.rect(k.x0,k.z0,k.x1,k.z1);
s+=`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="#cfc7b2" fill-opacity=".42"/>`;
}
if(CAMPAIGN.city.blocks){
s+=`<g fill="#4c463c" fill-opacity=".5">`;
for(const k of CAMPAIGN.city.blocks){
const r=proj.rect(k.x0,k.z0,k.x1,k.z1);
s+=`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"/>`;
}
s+='</g>';
}
if(CAMPAIGN.city.yard){ // 厂区: 更深的块 + 一侧亮缘 (产能地标)
const r=proj.rect(CAMPAIGN.city.yard.x0,CAMPAIGN.city.yard.z0,CAMPAIGN.city.yard.x1,CAMPAIGN.city.yard.z1);
s+=`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="#332f28" fill-opacity=".62" stroke="#8a7a52" stroke-opacity=".5" stroke-width="1"/>`;
}
if(CAMPAIGN.city.metro){ // 地铁: 两站 + 区间虚线 (柏林)
const m=CAMPAIGN.city.metro;
s+=`<g fill="none" stroke="#e8dcc0" stroke-opacity=".55" stroke-width="1.4" stroke-dasharray="3 3">`;
for(const h of m.halls){
const r=proj.rect(h.x0,h.z0,h.x1,h.z1);
s+=`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="#1d1a15" fill-opacity=".7"/>`;
}
if(m.tunnel){
const r=proj.rect(m.tunnel.x0,m.tunnel.z0,m.tunnel.x1,m.tunnel.z1);
s+=`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"/>`;
}
s+='</g>';
}
return s;
}
// 田块: 软遮蔽色块 (wheat/corn/rice → 三种土色; pasture/till 更淡)
function _maFields(proj){
const F=(typeof CROP_FIELDS!=='undefined'&&CROP_FIELDS.length)?CROP_FIELDS:(CAMPAIGN.fields||[]);
if(!F.length) return '';
const COL={wheat:'#d8c070',corn:'#b9b061',rice:'#9fc08a',pasture:'#9aa864',till:'#a89066'};
let s='<g fill-opacity=".5">';
for(const f of F){
const r=proj.rect(f.x0,f.z0,f.x1,f.z1);
s+=`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${COL[f.t]||'#c0b070'}"/>`;
}
return s+'</g>';
}
// 环礁海域 (2026-09-18 塔拉瓦批 / 09-18b 三面 / ★09-19 四面环海): 深海/礁缘/礁盘三段色带 + 干沙滩 + 岸线白线 +
// 珊瑚跑道 + 登陆航道虚线。四条海岸线 (南/北/西/东) 的坐标单源 = 00-config SEA (seaCoastLines/seaBandRing)。
// (沙盘读法: 一眼看出"四面是海、中央是孤岛、内陆有跑道") —— 与 22-hud drawSeaBands/23-deploy 同一份语义表
function _maSea(proj){
const S=(typeof SEA!=='undefined'&&SEA)?SEA:CAMPAIGN.sea;
if(!S||!S.shore) return '';
const halfw=MAP_SIZE/2+10;   // 与 _maProj 的 half 同口径 (深海底板外框用)
const coasts=(typeof seaCoastLines==='function')?seaCoastLines():[{key:'south',pts:S.shore.map(p=>[p[0],p[1]]),ox:0,oz:1}];
const line=(co)=>{
const pts=co.pts;
let d='';
for(let i=0;i<pts.length;i++) d+=(i?'L':'M')+proj.p(pts[i][0],pts[i][1]).join(' ')+' ';
return `<path d="${d}"/>`;
};
const band=(d0,d1,fill,op)=>{
let s='';
for(const co of coasts){
const pts=seaBandRing(co,d0,d1);
let d='';
for(let i=0;i<pts.length;i++) d+=(i?'L':'M')+proj.p(pts[i][0],pts[i][1]).join(' ')+' ';
s+=`<path d="${d}Z" fill="${fill}" fill-opacity="${op}"/>`;
}
return s;
};
let s='<g>';
// ★2026-09-20 修"四角地域没有地图": 旧法按四支岸线法向铺色带, 折线端点之外(图幅四角)无人覆盖 ⇒
//   整幅先铺深海底板 (沙盘外框矩形 ⊕ 岛屿闭合环, fill-rule=evenodd), 环内留给地表色, 再叠色带。
if(typeof seaCoastRing==='function'){
const ring=seaCoastRing();
if(ring&&ring.length>2){
const a=proj.p(-halfw,-halfw), b=proj.p(halfw,-halfw), cq=proj.p(halfw,halfw), dq=proj.p(-halfw,halfw);
let d=`M${a.join(' ')}L${b.join(' ')}L${cq.join(' ')}L${dq.join(' ')}Z `;
for(let i=0;i<ring.length;i++) d+=(i?'L':'M')+proj.p(ring[i][0],ring[i][1]).join(' ')+' ';
s+=`<path d="${d}Z" fill="#123a5e" fill-rule="evenodd"/>`;
}
}
s+=band(36,43,'#2f6f74',1);     // 礁缘陡坎
s+=band(0,36,'#3f9fae',1);      // 礁盘平台 (涉水带)
s+=band(-14,0,'#ded0a4',0.72);  // 干沙滩
s+='<g fill="none" stroke="#eef8ff" stroke-opacity=".85" stroke-width="1.4">';
for(const co of coasts) s+=line(co);
s+='</g>';
if(S.runway){
const r=proj.rect(S.runway.x0,S.runway.z0,S.runway.x1,S.runway.z1);
s+=`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="#e6e2cc" fill-opacity=".8" stroke="#ffffff" stroke-opacity=".45" stroke-width="0.8"/>`;
}
if(S.channels){
s+=`<g stroke="#d6ea78" stroke-opacity=".85" stroke-width="1.8" stroke-dasharray="4 3">`;
for(const ch of S.channels){
const z0=(typeof shoreZAt==='function')?shoreZAt(ch.x):ch.z||190;
s+=`<path d="M${proj.p(ch.x,z0+3).join(' ')}L${proj.p(ch.x,z0+46).join(' ')}"/>`;
}
// 四湾进近航道 (sea.lanes): 四面环海的"可上陆湾口"标记 (朝图心 28%)
if(S.lanes) for(const L2 of S.lanes) s+=`<path d="M${proj.p(L2.x,L2.z).join(' ')}L${proj.p(L2.x*0.72,L2.z*0.72).join(' ')}"/>`;
s+='</g>';
}
return s+'</g>';
}
// 主河 + 桥 + 徒涉滩
function _maRiver(proj){
let s='';
if(typeof RIVER!=='undefined'&&RIVER){
const w=Math.max(3.4,proj.len(Math.min(26,RIVER.w||8)));
s+=`<path d="${_maPath(RIVER.pts,proj)}" fill="none" stroke="#1d2a33" stroke-opacity=".9" stroke-width="${_maN(w+2.2)}" stroke-linejoin="round" stroke-linecap="round"/>`;
s+=`<path d="${_maPath(RIVER.pts,proj)}" fill="none" stroke="#5f93b8" stroke-opacity=".95" stroke-width="${_maN(w)}" stroke-linejoin="round" stroke-linecap="round"/>`;
if(RIVER.ice) s+=`<path d="${_maPath(RIVER.pts,proj)}" fill="none" stroke="#dfeaf2" stroke-opacity=".55" stroke-width="${_maN(w*0.5)}" stroke-dasharray="5 4" stroke-linecap="round"/>`;
if(RIVER.ford){ // 徒涉滩: 虚线圈 (旋转不变圆)
const [fx,fy]=proj.p(RIVER.ford.x,RIVER.ford.z);
s+=`<circle cx="${fx}" cy="${fy}" r="${proj.len(RIVER.ford.r*0.72)}" fill="#cfe6f2" fill-opacity=".18" stroke="#e6f2fa" stroke-opacity=".75" stroke-width="1.3" stroke-dasharray="4 3"/>`;
}
}
if(typeof DELTA_CHANS!=='undefined'&&DELTA_CHANS.length){ // 淞沪支流织网
let d='';
for(const ch of DELTA_CHANS) d+=_maPath(ch,proj);
s+=`<path d="${d}" fill="none" stroke="#2b3d47" stroke-opacity=".7" stroke-width="3.2" stroke-linecap="round"/>`;
s+=`<path d="${d}" fill="none" stroke="#6f9dba" stroke-opacity=".8" stroke-width="1.7" stroke-linecap="round"/>`;
}
if(typeof BRIDGES!=='undefined'&&BRIDGES.length){ // 桥: 垂直于河身的亮色短杠
s+=`<g stroke="#e8dcb4" stroke-opacity=".95" stroke-linecap="round">`;
for(const B of BRIDGES){
const dx=Math.sin(B.yaw)*(B.len/2), dz=Math.cos(B.yaw)*(B.len/2);
const a=proj.p(B.x-dx,B.z-dz), b=proj.p(B.x+dx,B.z+dz);
s+=`<path d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}" stroke-width="${_maN(Math.max(2.4,proj.len(B.w||6)))}"/>`;
}
s+='</g>';
}
return s;
}
// 百团沟壑: 赭色深沟 + 坡道浅色通道 + 塬面高台
function _maLoess(proj){
const L=(typeof LOESS!=='undefined'&&LOESS)?LOESS:CAMPAIGN.loess;
if(!L||!L.gullies) return '';
let s=`<g fill="none" stroke-linecap="round" stroke-linejoin="round">`;
for(const g of L.gullies){
s+=`<path d="${_maPath(g,proj)}" stroke="#3d2a17" stroke-opacity=".8" stroke-width="${_maN(proj.len(L.w*2))}"/>`;
s+=`<path d="${_maPath(g,proj)}" stroke="#7d4f24" stroke-opacity=".9" stroke-width="${_maN(proj.len(L.w*1.3))}"/>`;
}
if(L.ramps){
s+=`<g stroke="#f0e0b4" stroke-opacity=".9" stroke-width="2">`;
for(const r of L.ramps) s+=`<path d="M${proj.p(r.x0,r.z0).join(' ')}L${proj.p(r.x1,r.z1).join(' ')}"/>`;
s+='</g>';
}
s+='</g>';
if(L.terraces){ // 塬面: 亮色台块 (高台)
s+=`<g fill="#efdcae" fill-opacity=".22" stroke="#f2e4bc" stroke-opacity=".3" stroke-width="1">`;
for(const t of L.terraces){
const r=proj.rect(t.x0,t.z0,t.x1,t.z1);
s+=`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"/>`;
}
s+='</g>';
}
if(L.maos){ // 黄土峁: 圆丘
s+=`<g fill="#e6cf9c" fill-opacity=".35" stroke="#f0dfb4" stroke-opacity=".4" stroke-width="1">`;
for(const m of L.maos) s+=`<circle cx="${proj.p(m.x,m.z)[0]}" cy="${proj.p(m.x,m.z)[1]}" r="${proj.len(m.r*0.8)}"/>`;
s+='</g>';
}
return s;
}
// 雾林: 北谷 + 西墙龙牙带 + 岭上村台地 + 灌丛带
function _maWood(proj){
const W=(typeof WOOD!=='undefined')?WOOD:null;
if(!W) return '';
let s='';
if(W.ravine){
const w=proj.len(W.ravine.w*1.6);
s+=`<path d="${_maPath(W.ravine.pts,proj)}" fill="none" stroke="#242c26" stroke-opacity=".85" stroke-width="${_maN(w+2)}" stroke-linejoin="round"/>`;
s+=`<path d="${_maPath(W.ravine.pts,proj)}" fill="none" stroke="#4d5a50" stroke-opacity=".95" stroke-width="${_maN(w)}" stroke-linejoin="round"/>`;
s+=`<g stroke="#ece2c0" stroke-opacity=".9" stroke-width="2" stroke-linecap="round">`;
for(const r of W.ravine.ramps) s+=`<path d="M${proj.p(r.x0,r.z0).join(' ')}L${proj.p(r.x1,r.z1).join(' ')}"/>`;
s+='</g>';
}
if(W.belt){ // 西墙: 双排龙牙 (缺口处断开 = 唯一装甲走廊)
const a=proj.rect(W.belt.x0,-W.belt.spanZ,W.belt.x0+3,-W.belt.gapZ);
const b=proj.rect(W.belt.x0,W.belt.gapZ,W.belt.x0+3,W.belt.spanZ);
const c=proj.rect(W.belt.x1-3,-W.belt.spanZ,W.belt.x1,-W.belt.gapZ);
const d=proj.rect(W.belt.x1-3,W.belt.gapZ,W.belt.x1,W.belt.spanZ);
s+=`<g fill="#20241f" fill-opacity=".9">`;
for(const r of [a,b,c,d]) s+=`<rect x="${r.x}" y="${r.y}" width="${Math.max(1.6,r.w)}" height="${r.h}"/>`;
s+='</g>';
}
if(W.under){ // 灌丛软遮蔽带
s+=`<g fill="#2f4a2a" fill-opacity=".45">`;
for(const u of W.under){
const r=proj.rect(u.x0,u.z0,u.x1,u.z1);
s+=`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"/>`;
}
s+='</g>';
}
return s;
}
// 草原: 铁路轴 + 防线带 (龙牙/雷区/缺口) + 车站/风车/农庄地标
function _maSteppe(proj){
const S=(typeof STEPPE!=='undefined')?STEPPE:null;
if(!S) return '';
let s='';
if(S.mines){ // 雷区带: 点阵
const a=proj.rect(S.mines.x0,-MAP_SIZE/2,S.mines.x1,MAP_SIZE/2);
s+=`<rect x="${a.x}" y="${a.y}" width="${Math.max(2,a.w)}" height="${a.h}" fill="#8a2f22" fill-opacity=".28"/>`;
s+=`<g fill="#e8c0a0" fill-opacity=".8">`;
for(const zr of S.mines.zRuns){
for(let i=0;i<7;i++){
const z=zr[0]+(zr[1]-zr[0])*(i+0.5)/7;
const [px,py]=proj.p((S.mines.x0+S.mines.x1)/2,z);
s+=`<circle cx="${px}" cy="${py}" r="1.5"/>`;
}
}
s+='</g>';
}
if(S.belt){ // 龙牙双排 (缺口断开)
s+=`<g fill="#1e211c" fill-opacity=".92">`;
for(const x of [S.belt.x0,S.belt.x1]){
const segs=[];
let cur=-S.belt.spanZ;
for(const g of S.belt.gaps.slice().sort((p,q)=>p[0]-q[0])){ if(g[0]>cur) segs.push([cur,g[0]]); cur=g[1]; }
if(cur<S.belt.spanZ) segs.push([cur,S.belt.spanZ]);
for(const sg of segs){
const r=proj.rect(x-1.5,sg[0],x+1.5,sg[1]);
s+=`<rect x="${r.x}" y="${r.y}" width="${Math.max(1.6,r.w)}" height="${r.h}"/>`;
}
}
s+='</g>';
}
if(S.rail){ // 铁路: 深色双线 + 枕木
const [rx]=proj.p(S.rail.x,0);
s+=`<path d="M${rx} ${proj.p(0,-MAP_SIZE/2)[1]}L${rx} ${proj.p(0,MAP_SIZE/2)[1]}" stroke="#20211c" stroke-opacity=".9" stroke-width="4.4"/>`;
s+=`<path d="M${rx} ${proj.p(0,-MAP_SIZE/2)[1]}L${rx} ${proj.p(0,MAP_SIZE/2)[1]}" stroke="#cdbf94" stroke-opacity=".85" stroke-width="1.2" stroke-dasharray="2.5 3.5"/>`;
}
s+=`<g>`; // 地标: 车站/风车/农庄 (方点)
for(const m of [[S.station,'#dfe6ea'],[S.mill,'#e8d8b0'],[S.village,'#d8c48c']]){
if(!m[0]) continue;
const [px,py]=proj.p(m[0].x,m[0].z);
s+=`<rect x="${_maN(px-2.6)}" y="${_maN(py-2.6)}" width="5.2" height="5.2" fill="${m[1]}" fill-opacity=".9" stroke="#2a2620" stroke-opacity=".6" stroke-width=".8"/>`;
}
s+='</g>';
return s;
}
// 断崖公路: 谷底公路已由 roads 画出, 这里补两侧山肩 (等高线加密带)
function _maCanyon(proj){
let s=`<g fill="none" stroke="#4a4030" stroke-opacity=".35" stroke-width="1">`;
for(let i=-3;i<=3;i++){
if(i===0) continue;
const z=i*19;
s+=`<path d="M${proj.p(-MAP_SIZE/2,z)[0]} ${proj.p(-MAP_SIZE/2,z)[1]}Q${proj.p(0,z*1.5)[0]} ${proj.p(0,z*1.5)[1]} ${proj.p(MAP_SIZE/2,z)[0]} ${proj.p(MAP_SIZE/2,z)[1]}"/>`;
s+=`<path d="M${proj.p(-MAP_SIZE/2,-z)[0]} ${proj.p(-MAP_SIZE/2,-z)[1]}Q${proj.p(0,-z*1.5)[0]} ${proj.p(0,-z*1.5)[1]} ${proj.p(MAP_SIZE/2,-z)[0]} ${proj.p(MAP_SIZE/2,-z)[1]}"/>`;
}
return s+'</g>';
}
// 植被 (非城市图): 树点簇 —— 用战役 id 的稳定散列做种子, 同一图每次刷新完全一致
function _maVeg(proj,t){
let s='';
const seed=_maHash(CAMPAIGN.id);
const n=CAMPAIGN.mapSize>=640?46:34;
s+=`<g fill="${t.veg}" fill-opacity=".55">`;
for(let i=0;i<n;i++){
const rx=_maRand(seed+i*3.1), rz=_maRand(seed+i*7.7+1.3);
const x=(rx-0.5)*MAP_SIZE*0.96, z=(rz-0.5)*MAP_SIZE*0.96;
const [px,py]=proj.p(x,z);
const r=1.5+_maRand(seed+i*5.3)*2.1;
s+=`<circle cx="${px}" cy="${py}" r="${_maN(r)}"/>`;
}
return s+'</g>';
}
const _maHash=s=>{ let h=2166136261; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=h*16777619>>>0; } return h%100000; };
const _maRand=n=>{ const v=Math.sin(n*12.9898)*43758.5453; return v-Math.floor(v); };

// 旗点 / 强点 / 基地: 归属色三角与方座 (沙盘上的"争夺标记")
function _maMarkers(proj){
let s='';
const OWN=['#7fb0f0','#f08a72'];
// 旗点 (有旗战役): 归属色小三角 + 圈
if(CAMPAIGN.flags&&CAMPAIGN.flags.length){
for(const f of CAMPAIGN.flags){
const [px,py]=proj.p(f.x,f.z);
const own=(f.own===0||f.own===1)?OWN[f.own]:'#d8d2b8';
s+=`<circle cx="${px}" cy="${py}" r="${_maN(proj.len(f.r*0.55))}" fill="none" stroke="${own}" stroke-opacity=".55" stroke-width="1"/>`;
s+=`<path d="M${px} ${_maN(py-5.4)}L${_maN(px+4.4)} ${_maN(py+3)}L${_maN(px-4.4)} ${_maN(py+3)}Z" fill="${own}" fill-opacity=".95" stroke="#1c1a16" stroke-opacity=".7" stroke-width=".8"/>`;
}
}
// 强点 (草原无旗: spawns 即强点, team=-1 中立)
if((!CAMPAIGN.flags||!CAMPAIGN.flags.length)&&CAMPAIGN.spawns&&CAMPAIGN.spawns.length){
for(const sp of CAMPAIGN.spawns){
const [px,py]=proj.p(sp.x,sp.z);
const own=(sp.team===0||sp.team===1)?OWN[sp.team]:'#d8d2b8';
const r=_maN(proj.len((sp.r||11)*0.5));
s+=`<path d="M${px} ${_maN(py-r)}L${_maN(px+r)} ${py}L${px} ${_maN(py+r)}L${_maN(px-r)} ${py}Z" fill="${own}" fill-opacity=".9" stroke="#1c1a16" stroke-opacity=".7" stroke-width=".8"/>`;
}
}
// 基地: 双方方座 (断崖公路无基地=不画)
if(CAMPAIGN.bases&&CAMPAIGN.bases.length){
for(let ti=0;ti<2;ti++){
const b=CAMPAIGN.bases[ti]; if(!b) continue;
const [px,py]=proj.p(b.x,b.z);
s+=`<rect x="${_maN(px-4)}" y="${_maN(py-4)}" width="8" height="8" fill="${OWN[ti]}" fill-opacity=".92" stroke="#14120f" stroke-opacity=".8" stroke-width="1"/>`;
}
}
return s;
}

// ── 沙盘外框: 双线画框 + 四角角标 + 网格 + 指北针 (战术沙盘气质, 不含任何文字) ──
function _maFrame(id){
const P=MA_VIEW, m=MA_VIEW*0.055, tick=14;
let s=`<g fill="none" stroke="#d8c894" stroke-opacity=".85">`;
s+=`<rect x="1.6" y="1.6" width="${_maN(P-3.2)}" height="${_maN(P-3.2)}" stroke-width="2" rx="1.5"/>`;
s+=`<rect x="5.4" y="5.4" width="${_maN(P-10.8)}" height="${_maN(P-10.8)}" stroke-width=".8" stroke-opacity=".55"/>`;
s+='</g>';
s+=`<g stroke="#f0e2b0" stroke-opacity=".95" stroke-width="2.4" stroke-linecap="round">`;
s+=`<path d="M${m} ${m+tick}V${m}H${m+tick}"/><path d="M${_maN(P-m-tick)} ${m}H${_maN(P-m)}V${m+tick}"/>`;
s+=`<path d="M${m} ${_maN(P-m-tick)}V${_maN(P-m)}H${m+tick}"/><path d="M${_maN(P-m-tick)} ${_maN(P-m)}H${_maN(P-m)}V${_maN(P-m-tick)}"/>`;
s+='</g>';
// 内场网格 (沙盘量距格)
let grid='';
for(let i=1;i<6;i++){
const v=_maN(m+(P-m*2)*i/6);
grid+=`M${v} ${m}V${_maN(P-m)}M${m} ${v}H${_maN(P-m)}`;
}
s+=`<path d="${grid}" stroke="#e8dcb0" stroke-opacity=".13" stroke-width=".7" fill="none"/>`;
// 指北针 (右下角: 箭头 + 静止刻度环, 无文字)
const cx=_maN(P-m-13), cy=_maN(P-m-13);
s+=`<g transform="translate(${cx} ${cy})">`;
s+=`<circle r="9" fill="#12100c" fill-opacity=".55" stroke="#d8c894" stroke-opacity=".6" stroke-width=".8"/>`;
s+=`<path d="M0 -7.2L2.8 2.6L0 1.1L-2.8 2.6Z" fill="#f0e2b0" fill-opacity=".95"/>`;
s+='</g>';
return s;
}

// ── 战役沙盘主函数 ──
function menuMapSVG(){
const id='mm'+CAMPAIGN.id.replace(/[^a-zA-Z0-9]/g,'');
const t=maTint();
const proj=_maProj();
const city=!!CAMPAIGN.city;
const veg=(CAMPAIGN.theme==='steppe'||CAMPAIGN.theme==='loess')?0.5:(city?0.3:1);
return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MA_VIEW} ${MA_VIEW}" width="${MA_VIEW}" height="${MA_VIEW}" role="img">`
+_maTerrainDefs(id,t)
+`<g clip-path="url(#${id}clip)"><defs><clipPath id="${id}clip"><rect x="5" y="5" width="${MA_VIEW-10}" height="${MA_VIEW-10}" rx="1.5"/></clipPath></defs>`
+_maTerrainBody(id,t)
+_maSea(proj)
+_maVeg(proj,t)
+_maFields(proj).replace('<g ','<g opacity="'+veg+'" ')
+_maLoess(proj)
+_maWood(proj)
+_maSteppe(proj)
+_maCity(proj)
+_maCanyon(proj)
+_maRiver(proj)
+_maRoads(proj)
+_maTrench(proj)
+_maMarkers(proj)
+`<rect x="5" y="5" width="${MA_VIEW-10}" height="${MA_VIEW-10}" fill="url(#${id}vig)"/></g>`
+`<defs><radialGradient id="${id}vig" cx=".5" cy=".45" r=".72"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient></defs>`
+_maFrame(id)
+'</svg>';
}

// ── 阵营盾徽 ──
// 头盔剪影 (5 型, 与 00-config FACTIONS[*].helmet 同名) + 军旗徽记字形
function _maHelmet(kind){
// 统一画在 0..40 × 0..30 的局部坐标里 (盾内居中)
switch(kind){
case 'stahl': // 德式钢盔: 深盔沿 + 外扩护耳
return `<path d="M4 24C4 11 12 4 20 4C28 4 36 11 36 24L31 24C30 17 26 12 20 12C14 12 10 17 9 24Z"/>`
+`<path d="M2 24H38L35 28C30 30 10 30 5 28Z"/>`;
case 'ssh': // 苏式: 圆顶 + 前檐
return `<path d="M5 22C5 10 12 5 20 5C28 5 35 10 35 22Z"/>`
+`<path d="M5 22H35L33 26H7Z"/>`;
case 'jp': // 日式: 星徽 + 后帘
return `<path d="M6 21C6 10 13 6 20 6C27 6 34 10 34 21Z"/>`
+`<path d="M4 21H36L34 25C28 28 12 28 6 25Z"/>`
+`<path d="M20 9L21.6 13.2L26 13.4L22.5 16L23.6 20.2L20 17.8L16.4 20.2L17.5 16L14 13.4L18.4 13.2Z"/>`;
case 'cap': // 布帽/软帽: 低顶 + 帽墙
return `<path d="M6 20C6 12 12 8 20 8C28 8 34 12 34 20Z"/>`
+`<path d="M4 20H36L34 24H6Z"/>`;
default: // 'pot' 美式: 浅锅盔 + 下颌带
return `<path d="M8 18C8 9 13 5 20 5C27 5 32 9 32 18Z"/>`
+`<path d="M5 18H35L33 22C28 24 12 24 7 22Z"/>`
+`<path d="M11 22L9 29M29 22L31 29" stroke-width="1.6" stroke-linejoin="round"/>`;
}
}
// 徽记字形路径 (★/✠/☭/☀/✷/✭) —— 手绘路径而非 <text>, 免字体依赖
function _maEmblem(sym){
switch(sym){
case '✠': // 铁十字 (德军)
return `<path d="M20 2L24 10L32 6L28 14L36 18L28 22L32 30L24 26L20 34L16 26L8 30L12 22L4 18L12 14L8 6L16 10Z"/>`;
case '☭': // 锤镰 (苏军) —— 简化剪影: 镰刃 + 锤
return `<path d="M6 26C12 20 24 14 34 12L33 8C22 10 11 16 4 23Z"/>`
+`<path d="M12 27L27 12L29 14L14 29Z"/>`
+`<path d="M24 14L29 9L32 12L27 17Z"/>`
+`<circle cx="30" cy="10" r="3.4"/>`;
case '☀': // 旭日 (日军)
{ let s=''; for(let i=0;i<8;i++) s+=`<rect x="19" y="0" width="2" height="7" transform="rotate(${i*45} 20 20)"/>`; return s+`<circle cx="20" cy="20" r="7.5"/>`; }
case '✷': // 十二芒星 (国军)
{ let s=''; for(let i=0;i<12;i++) s+=`<rect x="19.4" y="1" width="1.2" height="9" transform="rotate(${i*30} 20 20)"/>`; return s+`<circle cx="20" cy="20" r="8"/>`; }
case '✭': // 五角实星 (八路军)
return `<path d="M20 3L24.6 15.6L38 16.2L27.4 24.4L31.2 37.4L20 29.8L8.8 37.4L12.6 24.4L2 16.2L15.4 15.6Z"/>`;
default: // ★ 五角星 (美军)
return `<path d="M20 3L24.8 14.4L37 15.2L27.6 23.2L30.6 35L20 28.4L9.4 35L12.4 23.2L3 15.2L15.2 14.4Z"/>`;
}
}
// 单枚盾徽: 盾形 + 旗色场 + 斜分带 + 徽记 + 头盔 + 底部列队色带
function menuFactionSVG(team){
const F=TEAM_FACTION[team];
const id='mf'+team;
const bg=F.flagBg||'#3a5f9e';
// 阵营服饰色 (与 3D 士兵同源): 用作盾面斜带与色条
const hex=n=>'#'+('000000'+(n>>>0).toString(16)).slice(-6);
const cloth=hex(F.coat!==undefined?F.coat:0x555a60);
const trim=hex(F.sleeve!==undefined?F.sleeve:0x4a4d52);
return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 116" width="96" height="116" role="img">`
+`<defs>`
+`<linearGradient id="${id}sh" x1="0" y1="0" x2=".35" y2="1">`
+`<stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="#11100c"/></linearGradient>`
+`<linearGradient id="${id}gl" x1="0" y1="0" x2="0" y2="1">`
+`<stop offset="0" stop-color="#fff8dc" stop-opacity=".38"/><stop offset=".55" stop-color="#fff8dc" stop-opacity="0"/></linearGradient>`
+`<clipPath id="${id}cp"><path d="M48 3L92 16V62C92 86 72 103 48 113C24 103 4 86 4 62V16Z"/></clipPath>`
+`</defs>`
// 盾体
+`<path d="M48 3L92 16V62C92 86 72 103 48 113C24 103 4 86 4 62V16Z" fill="url(#${id}sh)" stroke="#0d0c09" stroke-width="2.6"/>`
+`<g clip-path="url(#${id}cp)">`
+`<path d="M-6 46L102 12V30L-6 64Z" fill="${cloth}" fill-opacity=".55"/>`
+`<path d="M-6 62L102 28V36L-6 70Z" fill="${trim}" fill-opacity=".5"/>`
+`<rect x="0" y="0" width="96" height="116" fill="url(#${id}gl)"/>`
+`<g fill="#fdf3d0" fill-opacity=".2" transform="translate(48 44) scale(1.05) translate(-20 -20)">${_maEmblem(F.sym)}</g>`
+`<g fill="#f6ecd0" fill-opacity=".32" stroke="none" transform="translate(48 74) scale(.56) translate(-20 -16)">${_maHelmet(F.helmet)}</g>`
+`<rect x="0" y="102" width="96" height="6" fill="${cloth}" fill-opacity=".9"/>`
+`<rect x="0" y="108" width="96" height="3" fill="${trim}" fill-opacity=".9"/>`
+`</g>`
// 徽记主形 (亮色压顶, 与背景层形成"浮雕")
+`<g transform="translate(48 40) scale(.68) translate(-20 -20)" fill="#f7ecc6" stroke="#241f14" stroke-width="1.1" stroke-linejoin="round">${_maEmblem(F.sym)}</g>`
+`<path d="M48 3L92 16V62C92 86 72 103 48 113C24 103 4 86 4 62V16Z" fill="none" stroke="#e8d9a8" stroke-opacity=".5" stroke-width="1"/>`
+`</svg>`;
}

// ── 挂载: 两张卡片 + 阵容盾徽 (由 22-hud initMenuUI 在开局/切换战役后调用) ──
function renderMenuArt(){
if(typeof document==='undefined') return;
const mapBox=document.getElementById('menuArtMap');
const facBox=document.getElementById('menuArtFac');
if(!mapBox||!facBox) return;
mapBox.innerHTML=menuMapSVG();
let html='';
for(let t=0;t<2;t++){
const on=(SETTINGS.team===t);
html+=`<div class="facCard${on?' on':''}${on?'':' dim'}" data-t="${t}">${menuFactionSVG(t)}</div>`;
}
facBox.innerHTML=html;
// 点盾徽 = 选阵营 (与开局面板 teamBtn 同义, 存档 sf_team 一致; 只绑本层, 防重复绑定)
facBox.querySelectorAll('.facCard').forEach(d=>{
d.onclick=()=>{
const t=+d.dataset.t;
SETTINGS.team=t;
try{ localStorage.setItem('sf_team',String(t)); }catch(e){}
const us=document.getElementById('teamUS'), ger=document.getElementById('teamGER');
if(us&&ger){ us.classList.toggle('sel',t===0); ger.classList.toggle('sel',t===1); }
renderMenuArt();
};
});
}
// 只在"开始游戏/主菜单"面板显示 (设置与说明面板保持左侧干净): 22-hud showPanel 调用
function syncMenuArt(panelId){
const box=document.getElementById('menuArt');
if(!box) return;
box.classList.toggle('hidden',!(panelId==='mHome'||panelId==='mPlay'));
}
