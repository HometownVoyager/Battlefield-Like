// ─────────────────────────────────────────────
// 02-scene.js —— 渲染器/场景/天空/光照/材质
// 源: Index.original.html 第 834-1095 行
// ─────────────────────────────────────────────
'use strict';
const renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
// 曝光: 昼 1.05 / 夜 NIGHT_CFG.exposure, 天气在其上再乘 expoMul (2026-10-05 口追⑨: 全画面统一压暗,
// storm 0.7 ⇒ 暴雨昼总亮度≈晴天 35%; ACES 保高光, 枪焰/闪电/探照灯不受累; 晴档 ×1 逐位)
renderer.toneMappingExposure = (NIGHT_MODE?NIGHT_CFG.exposure:1.05)*WX_CFG.expoMul;
renderer.autoClear = false;
renderer.domElement.className='game';
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(74, innerWidth/innerHeight, 0.08, 900);
const vmScene = new THREE.Scene();
const vmCamera = new THREE.PerspectiveCamera(56, innerWidth/innerHeight, 0.01, 10);
let SHADOW_RANGE=60;
function applyQuality(){
const q = SETTINGS.quality;
// 渲染缩放 (2026-11-08 性能与画面批): 画质档像素比上限之上再乘用户档 RENDER_SCALE_STEPS[renderScaleIdx] (1/.85/.7/.55)
renderer.setPixelRatio((q===0?Math.min(devicePixelRatio,1):(q===1?Math.min(devicePixelRatio,1.5):Math.min(devicePixelRatio,2)))*(RENDER_SCALE_STEPS[SETTINGS.renderScaleIdx]||1));
// 紧凑阴影视锥跟随玩家: 大幅减少每帧阴影绘制的物体数
SHADOW_RANGE=q===0?42:(q===1?60:80);
sun.shadow.camera.left=-SHADOW_RANGE; sun.shadow.camera.right=SHADOW_RANGE;
sun.shadow.camera.top=SHADOW_RANGE; sun.shadow.camera.bottom=-SHADOW_RANGE;
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.mapSize.setScalar(q===0?1024:(q===1?1536:2048));
if(sun.shadow.map){ sun.shadow.map.dispose(); sun.shadow.map=null; }
renderer.shadowMap.needsUpdate=true; // 换档重灌 shadow map 后立即补一帧 (配合下方 shadowRefreshTick 的半频节流)
// 高画质: 软阴影; 低画质硬阴影 (2026-11-11 性能批: 摘除画布 CSS 电影感滤镜 —— 旧版 q1/q2 在整张
// WebGL 画布上常挂 saturate/contrast/brightness, 浏览器每帧对全屏画布多一次滤镜合成 pass (隐式拷贝,
// 部分驱动上还阻断画布零拷贝直合成), 分辨率/dpr 越大越贵, 色彩收益 ≤6% ⇒ 恒定白缴的 GPU 税)。
renderer.shadowMap.type=q===2?THREE.PCFSoftShadowMap:THREE.PCFShadowMap;
renderer.domElement.style.filter='none';
// 2026-09-12 巨桥改版: 主题系数与图幅系数相乘 (旧版互斥三元 —— deepjungle 640 大图永远吃不到放宽)
// 2026-09-13 许特根改版: deepjungle 硬编码 0.72 抽成主题字段 THEME.fogMul (woods=0.42 能见度极低)
scene.fog.far = dryFogFar();
}
addEventListener('resize',()=>{
camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
vmCamera.aspect=camera.aspect; vmCamera.updateProjectionMatrix();
renderer.setSize(innerWidth,innerHeight);
});
// ── 干态雾距/雾起 单源 (★2026-09-26E 审计 40): applyQuality 与 22-hud 的水下雾基准重采共读这一支 ──
// (旧版这两个数字只写在 applyQuality 的表达式里, 潜水期改画质时没有第二处能重算 ⇒ 出水还原成旧档。)
function dryFogFar(){
const q=SETTINGS.quality;
// 天气槽 (天气设计 §5-2): 原 (rain||storm)?0.78:snow?0.85:1 收编为 WX_CFG.fogFarMul —— 值逐位相同, 乘序不变 (R1/R3)。
// 视距档 (2026-11-08 性能与画面批): 用户 VIEWDIST_STEPS[viewDistIdx] (1/.8/.6) 在全部既有系数之后相乘 ——
// 水下雾基准 (22-hud 进入时快照/重采) 与雾色自动继承本函数; AI 索敌距离不在此处, 不受影响。
return (q===0?240:(q===1?340:420))*WX_CFG.fogFarMul*(THEME.fogMul||1)*((CAMPAIGN.mapSize||320)>=640?1.35:1)*(NIGHT_MODE?NIGHT_CFG.fogFarMul:1)*(VIEWDIST_STEPS[SETTINGS.viewDistIdx]||1);
}
function dryFogNear(){
// 雾起 (天气设计 §4.1 渐变口径, 2026-10-05 口追): 白天 40m ×WX_CFG.fogNearMul —— 40m 内零雾在暴雨里
//   读作"近处清晰+远处一面墙"; near 提前让雾从近处开始线性爬坡 (小雨 20m / 暴雨·暴风雪 14m)。
//   晴/阴/中雪 ×1 = 原值 40m 逐位; 夜档 NIGHT_CFG.fogNearMul 在天气系数之上再乘 (R3 顺序)。
return 40*WX_CFG.fogNearMul*(NIGHT_MODE?NIGHT_CFG.fogNearMul:1);
}
// 夜档雾色: 各图雾色向夜蓝 0x101a28 mix (保留色相差异, 见 NIGHT_CFG.fogMix)。
// 水下雾 (22-hud) 是"进入时快照当前色 / 出水还原"口径 —— 夜色会随快照自动保住, 无需第二处接线。
const NIGHT_FOG_HEX=0x101a28;
function nightFogColor(hex){
const c=new THREE.Color(hex), n=new THREE.Color(NIGHT_FOG_HEX);
c.lerp(n,NIGHT_CFG.fogMix);
return c.getHex();
}
// 天气灰度 (2026-10-05 口追⑥⑧): 把天穹渐变色向"灰"混合 w∈[0,1], 目标灰亮度 = 基色亮度×lum ——
// 晴档 w=0 原字符串逐字节返回 (零回归); lum<1 即"去饱和并压暗" (暴雨 0.55 出暗天), 暴风雪 0.9 保白毛风。
function _skyGreyMix(s,w,lum){
if(!w)return s;
const n=parseInt(s.slice(1),16), r=n>>16&255, g=n>>8&255, b=n&255;
const t=Math.min(1,(0.299*r+0.587*g+0.114*b)/255*lum+0.02)*255;
const m=x=>Math.round(x+(t-x)*w);
return 'rgb('+m(r)+','+m(g)+','+m(b)+')';
}
// 雾色亮度乘子 (口追⑧): fogFar 压低后视野大半是雾色, 不压雾色=拿亮灰漆满世界。昼夜两档同乘;
// 水下雾 (22-hud) 进入时快照当前色/出水还原 → 自动继承, 无需第二处接线。
function _fogDimCol(hex,w){
if(w>=1)return hex;
const r=(hex>>16)&255, g=(hex>>8)&255, b=hex&255;
return ((Math.round(r*w)<<16)|(Math.round(g*w)<<8)|Math.round(b*w))>>>0;
}
const _fogBase=NIGHT_MODE?nightFogColor(THEME.fog):THEME.fog;
scene.fog = new THREE.Fog(_fogDimCol(_fogBase,WX_CFG.fogDim), dryFogNear(), dryFogFar());
let SKY=null;
{
const c=document.createElement('canvas'); c.width=16; c.height=256;
const g=c.getContext('2d');
const gr=g.createLinearGradient(0,0,0,256);
// 夜档天空: 统一用 nightsea 月夜色板做基线 (NIGHT_CFG.sky / THEME.skyNight 可覆盖);
// 白天档逐位用 THEME.sky 原值; 天气灰度在两族色板上统一混 (口追⑥, 晴档 w=0 逐位)。
const st=NIGHT_MODE?(NIGHT_CFG.sky||THEME.skyNight||THEMES.nightsea.sky):THEME.sky;
const _sw=WX_CFG.skyGrey, _sl=WX_CFG.skyLum;
gr.addColorStop(0,_skyGreyMix(st[0],_sw,_sl)); gr.addColorStop(0.42,_skyGreyMix(st[1],_sw,_sl));
gr.addColorStop(0.62,_skyGreyMix(st[2],_sw,_sl)); gr.addColorStop(0.75,_skyGreyMix(st[3],_sw,_sl)); gr.addColorStop(1,_skyGreyMix(st[4],_sw,_sl));
g.fillStyle=gr; g.fillRect(0,0,16,256);
const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace;
SKY=new THREE.Mesh(new THREE.SphereGeometry(760,24,16), new THREE.MeshBasicMaterial({map:tex,side:THREE.BackSide,fog:false}));
SKY.frustumCulled=false;
scene.add(SKY);
}
const hemi = new THREE.HemisphereLight(THEME.hemi[0], THEME.hemi[1], THEME.hemi[2]*(NIGHT_MODE?NIGHT_CFG.hemiMul:1)*WX_CFG.hemiMul);
scene.add(hemi);
// 夜档 sun=月光: 冷蓝低强度 (阴影视锥/方向不动, updateSunShadow 照旧); 白天档原色原强度
const sun = new THREE.DirectionalLight(NIGHT_MODE?NIGHT_CFG.moonCol:THEME.sun, THEME.sunI*(NIGHT_MODE?NIGHT_CFG.sunMul:1)*WX_CFG.sunMul);
sun.position.set(-90, 120, 40);
// 影随盘 (口追⑨): 硬影子只在日盘可见时投 (sunVis≥0.5 = 晴朗/细雪); 阴/雨/暴/中雪/暴风雪 = 漫射光无影;
// 夜间无硬影 (用户明确要求: 晴天和阴天夜晚无影子)。
// ★2026-11-08 性能与画面批: 裁决收编单源 sunShadowAllowed() —— 用户"阴影刷新=关"档压在天气/昼夜之上,
//   旧版三处内联重写 (本文件此处 / applySceneEnvironment / 08-effects initWeather) 换一处漏一处就会被换天气复活。
function sunShadowAllowed(){
if(SETTINGS.shadowFreq===3) return false;
return NIGHT_MODE?false:(WX_CFG.sunVis>=0.5);
}
sun.castShadow = sunShadowAllowed();
sun.shadow.camera.left=-60; sun.shadow.camera.right=60;
sun.shadow.camera.top=60; sun.shadow.camera.bottom=-60;
sun.shadow.camera.far=400; sun.shadow.bias=-0.0012; sun.shadow.normalBias=0.02;
scene.add(sun); scene.add(sun.target);
function updateSunShadow(){
// 阴影视锥跟随相机, 按纹素网格对齐减少闪烁
const texel=SHADOW_RANGE*2/sun.shadow.mapSize.x;
const cx=Math.round(camera.position.x/texel)*texel;
const cz=Math.round(camera.position.z/texel)*texel;
sun.target.position.set(cx,0,cz);
sun.position.set(cx-72,96,cz+32);
}
// ── 阴影刷新节流 (2026-10-24 性能排查批; 2026-11-08 性能与画面批档位化) ──
// 依据: 太阳方向恒定、视锥按纹素对齐跟随相机, 动态投射者 (士兵/载具/特效) 在 30Hz 刷新下于战术视距
// 不可感知; 而阴影 pass 是每帧的第二遍全量绘制 (柏林 1694 投射者 + 主 pass 9751 mesh), 半频直接削掉
// 一半的阴影 draw call。机制: autoUpdate=false + 按 mod-N 帧置 needsUpdate (r152 渲染一次后自动回落 false)。
// 夜间 sun.castShadow=false 时恒置 false ⇒ 阴影 pass 整体跳过; applyQuality 换档重灌 shadow map 后
// 就地补一次 needsUpdate, 保证换档当帧就有影子。
// 档位 SETTINGS.shadowFreq: -1 跟随画质档 (2026-11-11 性能批: **全档半频** —— 旧版高画质逐帧, 但阴影
// pass 是每帧的第二遍全量绘制且投射者名单近年只增不减 (士兵全身件/尸体 7-8 件/碎块 96 块 castShadow),
// 高画质用户恒吃半条主 pass; 阴影位置差 1 帧在战术视距不可感知) / 0 逐帧 (显式开) / 1 半频 /
// 2 四分之一频 / 3 关闭 (sunShadowAllowed 门已把 sun.castShadow 压 false, 此处再兜底停 autoUpdate)。
let _shadowParity=0;
function shadowRefreshTick(){
const f=SETTINGS.shadowFreq;
if(f===3){ renderer.shadowMap.autoUpdate=false; renderer.shadowMap.needsUpdate=false; return; }
if(f===0){ renderer.shadowMap.autoUpdate=true; return; }
_shadowParity=(_shadowParity+1)%((f===2)?4:2);
renderer.shadowMap.autoUpdate=false;
renderer.shadowMap.needsUpdate=(_shadowParity===0)&&sun.castShadow;
}
// 白天太阳光晕
const sc=document.createElement('canvas'); sc.width=128; sc.height=128;
const sg=sc.getContext('2d');
const sgr=sg.createRadialGradient(64,64,2,64,64,64);
sgr.addColorStop(0,'rgba(255,250,230,1)'); sgr.addColorStop(0.25,'rgba(255,240,200,.55)'); sgr.addColorStop(1,'rgba(255,240,200,0)');
sg.fillStyle=sgr; sg.fillRect(0,0,128,128);
const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(sc),fog:false,depthWrite:false}));
sp.position.set(-380,480,170); sp.scale.setScalar(220); scene.add(sp);
window.__sunSprite=sp;

// 夜间月亮与暗斑
const mc=document.createElement('canvas'); mc.width=128; mc.height=128;
const mg=mc.getContext('2d');
const mgr=mg.createRadialGradient(64,64,2,64,64,64);
mgr.addColorStop(0,'rgba(215,228,245,0.92)'); mgr.addColorStop(0.18,'rgba(195,212,240,.68)'); mgr.addColorStop(0.30,'rgba(160,185,225,.18)'); mgr.addColorStop(1,'rgba(160,185,225,0)');
mg.fillStyle=mgr; mg.fillRect(0,0,128,128);
const moon=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(mc),fog:false,depthWrite:false}));
moon.position.set(-380,480,170); moon.scale.setScalar(82); scene.add(moon);
window.__moonSprite=moon;

const msc=document.createElement('canvas'); msc.width=64; msc.height=64;
const msg=msc.getContext('2d');
for(let i=0;i<9;i++){
  const x=rand(14,50),y=rand(14,50),r=rand(3,9);
  const msgr=msg.createRadialGradient(x,y,1,x,y,r);
  msgr.addColorStop(0,'rgba(140,156,190,.30)'); msgr.addColorStop(1,'rgba(140,156,190,0)');
  msg.fillStyle=msgr; msg.fillRect(0,0,64,64);
}
const moonSpots=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(msc),fog:false,depthWrite:false,transparent:true}));
moonSpots.position.set(-380,480,169); moonSpots.scale.setScalar(82); scene.add(moonSpots);
window.__moonSpots=moonSpots;

// 星空
const STAR_N=260, sp2=[];
for(let i=0;i<STAR_N;i++){
  const a=rand(0,TAU), e=Math.acos(rand(0.08,0.95));
  sp2.push(Math.cos(a)*Math.sin(e)*740, Math.cos(e)*740, Math.sin(a)*Math.sin(e)*740);
}
const sgm=new THREE.BufferGeometry();
sgm.setAttribute('position',new THREE.Float32BufferAttribute(sp2,3));
const stars=new THREE.Points(sgm,new THREE.PointsMaterial({color:0xcfd8ee,size:2.2,sizeAttenuation:false,transparent:true,opacity:0.85,fog:false,depthWrite:false}));
stars.frustumCulled=false; scene.add(stars);
window.__starsMesh=stars;

function updateCelestialVisibility(){
  if(window.__sunSprite){
    window.__sunSprite.visible = !NIGHT_MODE && (WX_CFG.sunVis > 0);
    window.__sunSprite.material.opacity = WX_CFG.sunVis;
  }
  if(window.__moonSprite){
    window.__moonSprite.visible = NIGHT_MODE && (WX_CFG.moonVis > 0);
    window.__moonSprite.material.opacity = WX_CFG.moonVis;
  }
  if(window.__moonSpots){
    window.__moonSpots.visible = NIGHT_MODE && (WX_CFG.moonVis > 0);
    window.__moonSpots.material.opacity = WX_CFG.moonVis;
  }
  if(window.__starsMesh){
    window.__starsMesh.visible = NIGHT_MODE && (WX_CFG.starVis > 0);
    window.__starsMesh.material.opacity = 0.85 * WX_CFG.starVis;
  }
}
updateCelestialVisibility();

function applySceneEnvironment(){
  if(typeof renderer!=='undefined'&&renderer){
    renderer.toneMappingExposure = (NIGHT_MODE ? NIGHT_CFG.exposure : 1.05) * WX_CFG.expoMul;
  }
  if(typeof scene!=='undefined'&&scene&&scene.fog){
    try{
      const _fogBase = NIGHT_MODE ? nightFogColor(THEME.fog) : THEME.fog;
      const dimCol = _fogDimCol(_fogBase, WX_CFG.fogDim);
      if(scene.fog.color){
        if(typeof scene.fog.color.setHex==='function') scene.fog.color.setHex(dimCol);
        else if(typeof scene.fog.color.set==='function') scene.fog.color.set(dimCol);
        else scene.fog.color = dimCol;
      }
      scene.fog.near = dryFogNear();
      scene.fog.far = dryFogFar();
    }catch(e){}
  }
  if(typeof sun!=='undefined'&&sun){
    try{
      const _nSun = NIGHT_MODE ? NIGHT_CFG.sunMul : 1;
      const cVal = NIGHT_MODE ? NIGHT_CFG.moonCol : THEME.sun;
      if(sun.color){
        if(typeof sun.color.setHex==='function') sun.color.setHex(cVal);
        else if(typeof sun.color.set==='function') sun.color.set(cVal);
        else sun.color = cVal;
      }
      sun.intensity = THEME.sunI * _nSun * WX_CFG.sunMul;
      sun.castShadow = sunShadowAllowed();
    }catch(e){}
  }
  if(typeof hemi!=='undefined'&&hemi){
    try{
      const _nHemi = NIGHT_MODE ? NIGHT_CFG.hemiMul : 1;
      if(hemi.color){
        if(typeof hemi.color.setHex==='function') hemi.color.setHex(THEME.hemi[0]);
        else if(typeof hemi.color.set==='function') hemi.color.set(THEME.hemi[0]);
        else hemi.color = THEME.hemi[0];
      }
      if(hemi.groundColor){
        if(typeof hemi.groundColor.setHex==='function') hemi.groundColor.setHex(THEME.hemi[1]);
        else if(typeof hemi.groundColor.set==='function') hemi.groundColor.set(THEME.hemi[1]);
        else hemi.groundColor = THEME.hemi[1];
      }
      hemi.intensity = THEME.hemi[2] * _nHemi * WX_CFG.hemiMul;
    }catch(e){}
  }
  if(typeof SKY!=='undefined'&&SKY&&SKY.material&&SKY.material.map){
    try{
      const c = document.createElement('canvas'); c.width = 16; c.height = 256;
      const g = c.getContext('2d');
      const gr = g.createLinearGradient(0,0,0,256);
      const st = NIGHT_MODE ? (NIGHT_CFG.sky || THEME.skyNight || THEMES.nightsea.sky) : THEME.sky;
      const _sw = WX_CFG.skyGrey, _sl = WX_CFG.skyLum;
      gr.addColorStop(0, _skyGreyMix(st[0], _sw, _sl));
      gr.addColorStop(0.42, _skyGreyMix(st[1], _sw, _sl));
      gr.addColorStop(0.62, _skyGreyMix(st[2], _sw, _sl));
      gr.addColorStop(0.75, _skyGreyMix(st[3], _sw, _sl));
      gr.addColorStop(1, _skyGreyMix(st[4], _sw, _sl));
      g.fillStyle = gr; g.fillRect(0,0,16,256);
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      if(SKY.material.map.dispose) SKY.material.map.dispose();
      SKY.material.map = tex;
      SKY.material.needsUpdate = true;
    }catch(e){}
  }
  updateCelestialVisibility();
  if(typeof rebuildClouds==='function') rebuildClouds();
  if(typeof initWeather==='function') initWeather();
  if(typeof AudioSys!=='undefined'&&AudioSys.updateWeatherAmbient) AudioSys.updateWeatherAmbient();
}
const _cloudSprites = [];
function rebuildClouds(){
  while(_cloudSprites.length){
    const s=_cloudSprites.pop();
    if(s){
      if(s.parent) s.parent.remove(s);
      else if(typeof scene!=='undefined'&&scene) scene.remove(s);
      if(s.material){
        if(s.material.map&&s.material.map.dispose) s.material.map.dispose();
        if(s.material.dispose) s.material.dispose();
      }
    }
  }
  const _cn=WX_CFG.cloudN, _co=WX_CFG.cloudOpMul, _wide=_cn>9;
  const _puff=Math.round(255*Math.min(1,WX_CFG.skyLum)*(1-0.35*WX_CFG.skyGrey));
  const _px2=_puff+','+_puff+','+_puff;
  const c=document.createElement('canvas'); c.width=256; c.height=128;
  const g=c.getContext('2d');
  for(let i=0;i<46;i++){
    const x=rand(30,226),y=rand(40,90),r=rand(14,34);
    const gr=g.createRadialGradient(x,y,1,x,y,r);
    gr.addColorStop(0,'rgba('+_px2+',.22)'); gr.addColorStop(1,'rgba('+_px2+',0)');
    g.fillStyle=gr; g.fillRect(0,0,256,128);
  }
  const tex=new THREE.CanvasTexture(c);
  const _cOp=(NIGHT_MODE?NIGHT_CFG.cloudMul:1)*_co;
  for(let i=0;i<_cn;i++){
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,opacity:Math.min(1,rand(.5,.85)*_cOp),fog:false,depthWrite:false}));
    sp._isCloud=true;   // 云层标记 (2026-11-01 修复): 云是 applySceneEnvironment 每次整体重建的天气层,
    //                    与 _isPrecip 同理不进世界快照 —— 旧版云进了快照, 还原把旧云带回、
    //                    rebuildClouds 又加新云 (登记表里那代已成孤儿移不掉) ⇒ 每轮回菜单云量翻倍。
    sp.position.set(rand(_wide?-750:-600,_wide?750:600), rand(_wide?150:180,_wide?300:280), rand(_wide?-750:-600,_wide?750:600));
    sp.scale.set(rand(_wide?220:180,_wide?420:340),rand(_wide?70:60,_wide?120:110),1);
    scene.add(sp);
    _cloudSprites.push(sp);
  }
}
rebuildClouds();
vmScene.add(new THREE.HemisphereLight(0xcfd8e8, 0x5a5844, 0.9*(NIGHT_MODE?NIGHT_CFG.vmLightMul:1)));
{ const l=new THREE.DirectionalLight(0xffeed0,1.6*(NIGHT_MODE?NIGHT_CFG.vmLightMul:1)); l.position.set(-1,1.6,0.6); vmScene.add(l); }
function makeTex(w,h,fn,repX=1,repY=1){
const c=document.createElement('canvas'); c.width=w; c.height=h;
fn(c.getContext('2d'),w,h);
const t=new THREE.CanvasTexture(c);
t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(repX,repY);
t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4;
return t;
}
function speckle(g,w,h,n,c0,c1,smin,smax){
for(let i=0;i<n;i++){
g.fillStyle=Math.random()<.5?c0:c1;
g.globalAlpha=rand(.08,.4);
const s=rand(smin,smax);
g.fillRect(rand(0,w),rand(0,h),s,s);
}
g.globalAlpha=1;
}
const TEX = {};
// ── 逐块色抖单源 (2026-09-27 用户实报"部分建筑出现了严重的材质不一致") ─────────────────────────
// 旧版砖/石/木/瓦的逐块颜色写成 `rgb(randi(...),randi(...),randi(...))` —— 三通道**各抖各的**,
// 于是同一堵墙上相邻两块可以一个偏粉 (hue 13°)、一个偏青 (hue 156°): 实测 TEX.stone 的逐块色相跨度
// 13°~156° (143°), 实机就是"拼色马赛克"。现口径: 只抖**明度** (三通道乘同一系数 k), 再给一点同向的
// 暖冷偏移 w (ΔR=-ΔB, ±4) —— 砖石木瓦的天然色差本来就在这几档里, 不再出现跨色相跳变 (跨度 <10°)。
// k 区间 0.86~1.14 与旧版三通道各自的 0.8~1.2 覆盖同一亮度包线 ⇒ 材质亮度观感不变, 只收敛色相。
function shade(base,k,w){
w=w||0;
return `rgb(${clamp(Math.round(base[0]*k+w),0,255)},${clamp(Math.round(base[1]*k),0,255)},${clamp(Math.round(base[2]*k-w),0,255)})`;
}
// ── 平铺闭合检查用: 元素越出画布时在对边补等价副本 (见下面各生成器) ──
// 返回需要绘制的偏移组合: 只有"平移后仍与本格相交"的副本才画 (含 0,0 自身)
function wrapOffs(x,y,rx,ry,W,H){
const out=[[0,0]];
for(const dx of [-W,0,W]) for(const dy of [-H,0,H]){
if(!dx&&!dy) continue;
const nx=x+dx, ny=y+dy;
if(nx+rx>0&&nx-rx<W&&ny+ry>0&&ny-ry<H) out.push([dx,dy]);
}
return out;
}
TEX.grass = makeTex(256,256,(g,w,h)=>{
g.fillStyle='#6b7a48'; g.fillRect(0,0,w,h);
speckle(g,w,h,2600,'#7d8c52','#55643a',1,3);
speckle(g,w,h,500,'#8a9458','#4a5834',1,2);
for(let i=0;i<160;i++){ g.strokeStyle='rgba(120,138,80,.35)'; g.beginPath(); const x=rand(0,w),y=rand(0,h); g.moveTo(x,y); g.lineTo(x+rand(-3,3),y-rand(2,6)); g.stroke(); }
},40,40);
TEX.snowGround = makeTex(256,256,(g,w,h)=>{
g.fillStyle='#eef1f5'; g.fillRect(0,0,w,h);
speckle(g,w,h,1600,'#f8fafc','#dde3ea',1,3);
speckle(g,w,h,420,'#cfd6de','#e6ebf0',1,2);
for(let i=0;i<70;i++){ g.strokeStyle='rgba(200,208,216,.28)'; g.beginPath(); const x=rand(0,w),y=rand(0,h); g.moveTo(x,y); g.lineTo(x+rand(-6,6),y+rand(-4,4)); g.stroke(); }
},40,40);
// 塔拉瓦环礁地面底图 (2026-09-18): 中性偏白的珊瑚沙 —— 沙滩/礁盘/草甸/跑道全部由顶点色带乘法上色
TEX.sand = makeTex(256,256,(g,w,h)=>{
g.fillStyle='#d9cfb0'; g.fillRect(0,0,w,h);
speckle(g,w,h,2400,'#e6ddc2','#c8bd9c',1,3);
speckle(g,w,h,520,'#f2ecd6','#b8ac8a',1,2);
for(let i=0;i<90;i++){ g.fillStyle='rgba(255,252,240,.5)'; g.beginPath(); g.arc(rand(0,w),rand(0,h),rand(0.6,1.6),0,TAU); g.fill(); }
},40,40);
// 塔拉瓦环礁地面底图 (2026-09-18b 复调"太亮·绿色太少"): 中性偏灰的珊瑚土/椰林地被颗粒 ——
// 沙滩/礁盘/草甸/跑道全部由 03-terrain 顶点色带乘法上色, 底图只管颗粒与碎屑。
// 亮度定标 (2026-09-18b 实测口径): 贴图线性均值≈0.39 × 顶点色 × 光照(半球 0.78 + 日照 1.78×0.773)
// × ground 0xe9ecd8 → 沙滩顶点 1.12 落到显示亮度≈0.85 (亮而不爆), 草甸顶点 0.17/0.41/0.18 → 显示≈(0.37,0.52,0.28)。
// (旧版把白珊瑚沙贴图 (线性 0.69) 当地面 + 日照 2.1 → 沙滩显示亮度 >1 全爆白, 就是"太亮"的根)
TEX.island = makeTex(256,256,(g,w,h)=>{
g.fillStyle='#a9a693'; g.fillRect(0,0,w,h);
speckle(g,w,h,2600,'#b6b39d','#96937f',1,3);
speckle(g,w,h,700,'#8b8878','#c0bda6',1,3);
for(let i=0;i<220;i++){ g.fillStyle=Math.random()<0.5?'rgba(226,220,196,.5)':'rgba(150,144,120,.4)'; g.beginPath(); g.arc(rand(0,w),rand(0,h),rand(0.6,1.8),0,TAU); g.fill(); }
for(let i=0;i<80;i++){ g.strokeStyle='rgba(104,116,72,.22)'; g.beginPath(); const x=rand(0,w),y=rand(0,h); g.moveTo(x,y); g.lineTo(x+rand(-4,4),y-rand(3,7)); g.stroke(); }
},40,40);
// 碎波泡沫 (岸线浪花带): 透明底 + 白色泡沫团, 沿水线滚动
TEX.foam = makeTex(128,64,(g,w,h)=>{
g.clearRect(0,0,w,h);
for(let i=0;i<150;i++){
const x=rand(0,w), y=rand(0,h);
g.fillStyle='rgba(255,255,255,'+rand(0.25,0.9).toFixed(2)+')';
g.beginPath(); g.arc(x,y,rand(0.8,3.4),0,TAU); g.fill();
}
},6,1);
TEX.dirt = makeTex(256,256,(g,w,h)=>{
g.fillStyle='#7a6a4e'; g.fillRect(0,0,w,h);
speckle(g,w,h,2200,'#8a7a5a','#655640',1,4);
speckle(g,w,h,300,'#93835f','#54462f',2,5);
},8,8);
// 砖: 逐块只抖明度 (shade); 砖列相位与贴图同宽 (64×4=256) ⇒ 左右缘半砖是同一块 (列色表复用, 见下)
const BRICK_C=[136,84,63], STONE_C=[138,135,126], WOOD_C=[110,82,54], WOODD_C=[67,51,32], ROOF_C=[115,66,53];
TEX.brick = makeTex(256,256,(g,w,h)=>{
g.fillStyle='#6e5849'; g.fillRect(0,0,w,h);
// ★2026-09-28B 重做 (用户实报"材质不一致", 淞沪砖构大厂房实机截图): 单砖 32×16px (每贴 8×16 块 ⇒
//   1.8m/贴 下砖 0.225×0.1125m) —— 旧 64×32px 的大砖在大厂房立面上读作"玩具积木"; 砖缝与砖面的
//   反差也收小 (旧版米白缝+高光条, 受光面/背光面看着像两种材料)。逐块只抖明度 (贴图契约),
//   行内奇偶错缝, 越界半块取对边同列色 (平铺闭合, 不再"缝上换色")。
const bh=16,bw=32, cols=w/bw|0, rows=h/bh|0;
const colFill=[]; for(let r2=0;r2<rows;r2++){ colFill[r2]=[]; for(let c2=0;c2<cols;c2++) colFill[r2][c2]=shade(BRICK_C,rand(0.88,1.12),rand(-3,3)); }
for(let y=0;y<h;y+=bh){
const off=((y/bh)|0)%2? bw/2:0;
for(let x=(off?-bw/2:0);x<w;x+=bw){
const ci=((((x%w)+w)%w)/bw|0);
g.fillStyle=colFill[(y/bh)|0][ci];
g.fillRect(x+1,y+1,bw-2,bh-2);
g.fillStyle='rgba(255,232,205,0.10)'; g.fillRect(x+1,y+1,bw-2,1);
g.fillStyle='rgba(25,15,10,0.22)'; g.fillRect(x+1,y+bh-2,bw-2,1);
}
}
speckle(g,w,h,1200,'#5c4536','#8a6a50',1,2);
},2,1.4);
TEX.plaster = makeTex(256,256,(g,w,h)=>{
g.fillStyle='#b6ad97'; g.fillRect(0,0,w,h);
// ★2026-09-28 重做 (用户实报"材质问题仍十分严重", 附实机截图): 抹灰面**不再画离散图形**。
//   旧的 5 个棕色返潮椭圆 + 7 条波浪"裂纹"是每 1.8m 复现一次的**图形**, 平铺到墙上就是
//   "白色墙面钉着规则的棕色圆点 + 一排毛线" —— 截图里最刺眼的一条 (旧斑块直接以 alpha 0.55 叠加,
//   比噪声层强 3~8 倍)。现在只留细颗粒: 抹灰的真实质感来自水泥/砂粒的细密噪点, 不是斑块。
//   ★2026-09-28B: 颗粒对比度上调 (与 SVG 版 4 层 fBm 的可见度对齐, 首版远看minify成"白模")。
speckle(g,w,h,2400,'#bab29c','#9c9480',1,3);
speckle(g,w,h,700,'#c8c0aa','#948c76',1,6);
},2,1.5);
TEX.stone = makeTex(256,256,(g,w,h)=>{
g.fillStyle='#8d8a80'; g.fillRect(0,0,w,h);
// ★2026-11-01 修平铺闭合: 行高 32×8=256 / 列距 64×4=256 整周期 (旧列距 60 不整除 256 ⇒ 每贴右缘
//   一条 2px 背景缝把花岗岩切断), 砖体过缝时在另一侧补画**同色**副本 (与 brick 的越界取对边同规)。
for(let y=0;y<h;y+=32){
const off=((y/32)|0)%2?32:0;
for(let x=-64;x<w;x+=64){
g.fillStyle=shade(STONE_C,rand(0.86,1.14),rand(-4,4));
for(const dx of [0,-w,w]) if(x+off+dx+62>0&&x+off+dx<w) g.fillRect(x+off+dx+2,y+2,60,28);
}
}
speckle(g,w,h,900,'#6d6a60','#a5a296',1,3);
},2,1.5);
TEX.wood = makeTex(256,256,(g,w,h)=>{
g.fillStyle='#6e5638'; g.fillRect(0,0,w,h);
for(let x=0;x<w;x+=32){
g.fillStyle=shade(WOOD_C,rand(0.86,1.14),rand(-4,4));
g.fillRect(x+1,0,30,h);
g.strokeStyle='rgba(50,36,20,.5)';
for(let i=0;i<4;i++){ g.beginPath(); const yy=rand(0,h); g.moveTo(x,yy); g.bezierCurveTo(x+10,yy+rand(-6,6),x+20,yy+rand(-6,6),x+32,yy+rand(-8,8)); g.stroke(); }
}
speckle(g,w,h,350,'#54402a','#84684a',1,2);
},1.5,1.5);
TEX.woodDark = makeTex(128,128,(g,w,h)=>{
g.fillStyle='#4a3a24'; g.fillRect(0,0,w,h);
for(let i=0;i<26;i++){ const k=rand(0.86,1.14), ww=rand(-4,4);   // 逐条只抖明度 (旧版三通道各抖各的 → 条与条跨色相)
g.strokeStyle=`rgba(${clamp(Math.round(WOODD_C[0]*k+ww),0,255)},${clamp(Math.round(WOODD_C[1]*k),0,255)},${clamp(Math.round(WOODD_C[2]*k-ww),0,255)},.6)`;
g.beginPath(); g.moveTo(0,rand(0,h)); g.bezierCurveTo(w*.3,rand(0,h),w*.7,rand(0,h),w,rand(0,h)); g.stroke(); }
},1,1);
TEX.sandbag = makeTex(128,128,(g,w,h)=>{
g.fillStyle='#9a8a62'; g.fillRect(0,0,w,h);
// ★2026-11-01 修: 与 SVG 版同规 —— ① 行距 32×4 / 列距 42.7×3 整周期平铺闭合 (旧行 22/列 44 不整除
//   128 ⇒ 每贴边缘切袋), ② 逐袋只抖明度 shade() 单源 (旧式 rgb 三通道各抖各的 → 袋与袋跨色相)。
for(let ry=0;ry<4;ry++){
const off=(ry%2)?21.3:0;
for(let x=-21.3+off;x<w+21.3;x+=42.7){
g.fillStyle=shade([154,138,98],rand(0.9,1.12),0);
for(const dx of [0,-w,w]) if(x+dx+20>0&&x+dx-20<w){
g.beginPath(); g.ellipse(x+dx,ry*32+16,20,12.5,0,0,TAU); g.fill();
g.strokeStyle='rgba(80,70,45,.6)'; g.stroke();
}
}
}
},2,2);
TEX.metal = makeTex(128,128,(g,w,h)=>{
g.fillStyle='#5a5f56'; g.fillRect(0,0,w,h);
speckle(g,w,h,700,'#6a7062','#464b42',1,3);
speckle(g,w,h,120,'#7d6a4a','#3d3428',1,4);
},1,1);
TEX.bark = makeTex(128,128,(g,w,h)=>{
g.fillStyle='#5d4c36'; g.fillRect(0,0,w,h);
for(let x=0;x<w;x+=8){ g.fillStyle=`rgba(${randi(60,90)},${randi(48,70)},${randi(32,48)},.8)`; g.fillRect(x,0,rand(3,6),h); }
speckle(g,w,h,300,'#3f3222','#75604a',1,3);
},1,2);
TEX.leaves = makeTex(128,128,(g,w,h)=>{
g.clearRect(0,0,w,h);
for(let i=0;i<450;i++){
g.fillStyle=`rgba(${randi(60,95)},${randi(85,120)},${randi(40,60)},${rand(.5,1)})`;
const x=rand(0,w),y=rand(0,h);
const d=Math.hypot(x-64,y-64); if(d>60) continue;
g.beginPath(); g.ellipse(x,y,rand(3,7),rand(2,5),rand(0,3),0,TAU); g.fill();
}
});
TEX.roof = makeTex(256,256,(g,w,h)=>{
g.fillStyle='#6e4438'; g.fillRect(0,0,w,h);
for(let y=0;y<h;y+=32){                                // 32×8 = 256: 整周期 (旧 24×30 格子与 256 不成整除 → 平铺缝错位)
for(let x=0;x<w;x+=32){
g.fillStyle=shade(ROOF_C,rand(0.86,1.14),rand(-4,4));
g.fillRect(x+1,y+1,30,30);
}
}
speckle(g,w,h,500,'#4f2f26','#8a5a48',1,3);
},2,2);
TEX.hay = makeTex(128,128,(g,w,h)=>{
g.fillStyle='#b09a58'; g.fillRect(0,0,w,h);
for(let i=0;i<400;i++){ g.strokeStyle=`rgba(${randi(150,190)},${randi(130,160)},${randi(70,95)},.7)`; g.beginPath(); const x=rand(0,w),y=rand(0,h); g.moveTo(x,y); g.lineTo(x+rand(-9,9),y+rand(-3,3)); g.stroke(); }
},2,2);
TEX.hedge = makeTex(256,256,(g,w,h)=>{
g.fillStyle='#46552e'; g.fillRect(0,0,w,h);
// 修剪绿篱: 密集叶簇团块 (box 六面各映射整图, 1:1 平铺)
for(let i=0;i<760;i++){
const x=rand(0,w), y=rand(0,h), r=rand(3,9);
g.fillStyle=`rgb(${randi(58,80)},${randi(82,106)},${randi(36,52)})`;
g.globalAlpha=rand(.35,.85);
g.beginPath(); g.ellipse(x,y,r,r*rand(.55,.85),rand(0,3),0,TAU); g.fill();
}
// 叶隙暗斑: 拉开团块层次
for(let i=0;i<150;i++){
const x=rand(0,w), y=rand(0,h), r=rand(2,6);
g.fillStyle='rgba(28,36,18,.55)';
g.beginPath(); g.ellipse(x,y,r,r*rand(.5,.9),rand(0,3),0,TAU); g.fill();
}
// 细碎受光叶尖
for(let i=0;i<230;i++){
const x=rand(0,w), y=rand(0,h), r=rand(1,2.6);
g.fillStyle=`rgb(${randi(104,128)},${randi(118,140)},${randi(62,80)})`;
g.globalAlpha=rand(.25,.6);
g.beginPath(); g.ellipse(x,y,r,r*0.7,rand(0,3),0,TAU); g.fill();
}
g.globalAlpha=1;
// 垂直明暗: 顶部受光 / 底部近土压暗 (盒侧面更立体)
const gr=g.createLinearGradient(0,0,0,h);
gr.addColorStop(0,'rgba(255,255,214,.10)'); gr.addColorStop(.32,'rgba(255,255,214,0)');
gr.addColorStop(.72,'rgba(18,24,10,0)'); gr.addColorStop(1,'rgba(18,24,10,.30)');
g.fillStyle=gr; g.fillRect(0,0,w,h);
},1,1);
TEX.track=makeTex(64,64,(g,w,h)=>{
g.fillStyle='#2e2f2a'; g.fillRect(0,0,w,h);
for(let y=0;y<h;y+=8){
g.fillStyle='#3d3e36'; g.fillRect(2,y+1,w-4,5);
g.fillStyle='#23241f'; g.fillRect(6,y+2,w-12,2);
}
},1,4);
// ─────────────────────────────────────────────
// SVG 材质精修管线 —— 全部程序化贴图升级为 SVG 滤镜重绘版
// 原理: 上方 Canvas2D 手绘版保留为"即时兜底"(Node 沙箱/低端环境/加载间隙显示),
//       浏览器环境再异步用 SVG(feTurbulence 分形噪声/各向异性拉丝/位移扰动等滤镜)
//       重绘同一张 canvas —— 贴图对象与材质引用不变, 加载完成后无缝替换.
//       SVG 生成仅用 Math.random(rand/randi), 不触碰 wr/wri 布局种子流 → 布局指纹零漂移.
//       生成器全部登记在 SVGTEX (dev/verify-svgtex.js 逐条校验 XML 合法性/平铺周期).
// ─────────────────────────────────────────────
const SVG_OK=(typeof Image!=='undefined')&&!/(?:\?|&)nosvg/.test(location.search); // ?nosvg=1: 跳过 SVG 重绘, 恒用 Canvas 兜底版 (排障 A/B 开关)
function svgURI(w,h,body){
return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`);
}
function svgUpgrade(tex,w,h,body,name){
if(!SVG_OK) return tex;
try{
const img=new Image();
img.onload=()=>{
let c,g;
try{ c=tex.image; g=c.getContext('2d'); if(!g) return; }catch(e){ return; }
let snap=null;
try{ snap=g.getImageData(0,0,c.width,c.height); }catch(e){} // 重绘前快照兜底版 (data: 图不污染画布, 不会抛)
try{ g.globalAlpha=1; g.clearRect(0,0,c.width,c.height); g.drawImage(img,0,0,c.width,c.height); }
catch(e){ console.warn('[SVG] 贴图重绘绘制失败(保留兜底版): '+(name||'?'), e&&e.message); if(snap) g.putImageData(snap,0,0); return; }
// 内容校验: 个别浏览器 SVG 滤镜栅格化异常时会"绘制成功但全透明/全黑" → 采样判定后回滚, 避免整场挂图材质变黑
if(snap){
const d=g.getImageData(0,0,c.width,c.height).data;
let n=0,op=0,black=0;
for(let i=0;i<d.length;i+=148){
n++;
if(d[i+3]>10) op++;
if(d[i+3]>200&&d[i]+d[i+1]+d[i+2]<24) black++;
}
if(op===0||black/n>0.995){
g.putImageData(snap,0,0);
console.warn('[SVG] 重绘结果异常('+(op===0?'全透明':'全黑')+'), 已回滚兜底版: '+(name||'?'));
return;
}
}
tex.needsUpdate=true;
};
img.onerror=()=>{ console.warn('[SVG] 贴图重绘加载失败(停留在兜底版): '+(name||'?')); };
img.src=svgURI(w,h,body);
}catch(e){}
return tex;
}
const SVGTEX={};
function svgReg(name,w,h,make){ SVGTEX[name]={w,h,make}; return make; }
function svgApply(tex,name){ const e=SVGTEX[name]; if(e&&tex) svgUpgrade(tex,e.w,e.h,e.make(),name); return tex; }
// 常用片段: 分形噪声色斑 (把 feTurbulence 亮度映射为 alpha 的半透明色块层; 滤镜域=整格 + stitchTiles → 可无缝平铺)
function svgMottle(id,freq,oct,rgb,s,bias,op,seed){
return `<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${oct}" seed="${seed}" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 ${rgb[0]} 0 0 0 0 ${rgb[1]} 0 0 0 0 ${rgb[2]} ${s} ${s} ${s} 0 ${bias}"/></filter><rect width="100%" height="100%" filter="url(#${id})" opacity="${op}"/>`;
}
function svgGrain(id,freq,rgb,op,seed){ return svgMottle(id,freq,2,rgb,0.8,-0.62,op,seed); }
// 方向性条纹 (fx/fy 各向异性 → 顺纹拉丝: 木纹/金属刷痕/布纹)
function svgStreak(id,fx,fy,rgb,s,bias,op,seed){
return `<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${fx} ${fy}" numOctaves="3" seed="${seed}" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 ${rgb[0]} 0 0 0 0 ${rgb[1]} 0 0 0 0 ${rgb[2]} ${s} ${s} ${s} 0 ${bias}"/></filter><rect width="100%" height="100%" filter="url(#${id})" opacity="${op}"/>`;
}
function svgLeaf(x,y,r,fill,op){
return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${r.toFixed(1)}" ry="${(r*0.62).toFixed(1)}" transform="rotate(${rand(0,360).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="${fill}" opacity="${op.toFixed(2)}"/>`;
}
// 烟团/尘团: 径向渐变圆 + feTurbulence 位移扰动 → 蓬松不规则轮廓 (粒子精灵, 不平铺)
function svgPuff(inner,mid,opIn,opMid,r,seed){
return `<defs><radialGradient id="pfg"><stop offset="0" stop-color="rgb(${inner})" stop-opacity="${opIn}"/><stop offset="0.55" stop-color="rgb(${mid})" stop-opacity="${opMid}"/><stop offset="1" stop-color="rgb(${mid})" stop-opacity="0"/></radialGradient>`
+`<filter id="pff" x="-30%" y="-30%" width="160%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="0.11" numOctaves="3" seed="${seed}" result="tr"/><feDisplacementMap in="SourceGraphic" in2="tr" scale="8" xChannelSelector="R" yChannelSelector="G"/></filter></defs>`
+`<circle cx="32" cy="32" r="${r}" fill="url(#pfg)" filter="url(#pff)"/>`;
}
// ── 各贴图 SVG 生成器 (基色与旧 Canvas 版一致, 保证主题着色/雪地黄土换色行为不变) ──
svgReg('grass',256,256,()=>{
const b=[];
for(let i=0;i<130;i++){
const x=rand(0,256),y=rand(0,256),dx=rand(-5,5),dy=-rand(3,9);
b.push(`<path d="M${x.toFixed(1)} ${y.toFixed(1)} q${(dx*0.4).toFixed(1)} ${(dy*0.55).toFixed(1)} ${dx.toFixed(1)} ${dy.toFixed(1)}" stroke="rgb(${randi(100,132)},${randi(124,152)},${randi(66,88)})" stroke-width="${rand(0.7,1.6).toFixed(1)}" opacity="${rand(0.2,0.45).toFixed(2)}" fill="none"/>`);
}
for(let i=0;i<70;i++){
b.push(`<circle cx="${rand(0,256).toFixed(1)}" cy="${rand(0,256).toFixed(1)}" r="${rand(0.5,1.2).toFixed(1)}" fill="rgb(${randi(140,168)},${randi(152,176)},${randi(84,104)})" opacity="${rand(0.25,0.55).toFixed(2)}"/>`);
}
return `<rect width="256" height="256" fill="#6b7a48"/>`
+svgMottle('gg1','0.025',4,[0.28,0.34,0.16],0.9,-0.78,0.5,7)
+svgMottle('gg2','0.085',3,[0.52,0.58,0.33],0.85,-0.78,0.3,13)
+svgGrain('gg3','0.55',[0.18,0.23,0.1],0.2,21)
+b.join('');
});
svgReg('snowGround',256,256,()=>{
const b=[];
for(let i=0;i<24;i++){
const y=rand(0,256),x=rand(-30,200),l=rand(50,170);
b.push(`<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x+l).toFixed(1)}" y2="${(y+rand(-4,4)).toFixed(1)}" stroke="rgb(185,196,214)" stroke-width="${rand(0.6,1.6).toFixed(1)}" opacity="${rand(0.1,0.22).toFixed(2)}"/>`);
}
for(let i=0;i<90;i++){
b.push(`<rect x="${rand(0,255).toFixed(1)}" y="${rand(0,255).toFixed(1)}" width="1.2" height="1.2" fill="#ffffff" opacity="${rand(0.4,0.9).toFixed(2)}"/>`);
}
return `<rect width="256" height="256" fill="#eef1f5"/>`
+svgMottle('sn1','0.02',4,[0.72,0.77,0.86],0.8,-0.66,0.4,5)
+svgMottle('sn2','0.075',3,[0.86,0.9,0.95],0.8,-0.7,0.3,11)
+svgGrain('sn3','0.6',[0.55,0.6,0.7],0.12,17)
+b.join('');
});
// 塔拉瓦环礁: 珊瑚沙地面 (中性偏白, 供顶点色带乘法上色) —— 基色与 Canvas 兜底版一致
svgReg('sand',256,256,()=>{
const b=[];
for(let i=0;i<120;i++){
b.push(`<circle cx="${rand(0,256).toFixed(1)}" cy="${rand(0,256).toFixed(1)}" r="${rand(0.5,1.7).toFixed(1)}" fill="rgb(${randi(248,255)},${randi(246,252)},${randi(232,244)})" opacity="${rand(0.25,0.6).toFixed(2)}"/>`);
}
for(let i=0;i<70;i++){
b.push(`<ellipse cx="${rand(0,256).toFixed(1)}" cy="${rand(0,256).toFixed(1)}" rx="${rand(1.2,3.2).toFixed(1)}" ry="${rand(0.6,1.4).toFixed(1)}" fill="rgb(${randi(196,224)},${randi(186,214)},${randi(158,186)})" opacity="${rand(0.2,0.5).toFixed(2)}" transform="rotate(${rand(0,360).toFixed(0)} ${rand(0,256).toFixed(1)} ${rand(0,256).toFixed(1)})"/>`);
}
return `<rect width="256" height="256" fill="#d9cfb0"/>`
+svgMottle('sd1','0.03',4,[0.86,0.82,0.68],0.85,-0.7,0.4,41)
+svgMottle('sd2','0.11',3,[0.98,0.95,0.86],0.8,-0.72,0.28,43)
+svgGrain('sd3','0.6',[0.62,0.58,0.46],0.14,47)
+b.join('');
});
svgReg('island',256,256,()=>{
const b=[];
for(let i=0;i<150;i++) b.push(`<circle cx="${rand(0,256).toFixed(1)}" cy="${rand(0,256).toFixed(1)}" r="${rand(0.5,1.6).toFixed(1)}" fill="rgb(${randi(214,232)},${randi(208,226)},${randi(182,200)})" opacity="${rand(0.2,0.55).toFixed(2)}"/>`);
for(let i=0;i<90;i++) b.push(`<ellipse cx="${rand(0,256).toFixed(1)}" cy="${rand(0,256).toFixed(1)}" rx="${rand(1.1,3.0).toFixed(1)}" ry="${rand(0.6,1.4).toFixed(1)}" fill="rgb(${randi(122,150)},${randi(116,144)},${randi(92,116)})" opacity="${rand(0.2,0.45).toFixed(2)}" transform="rotate(${rand(0,360).toFixed(0)} ${rand(0,256).toFixed(1)} ${rand(0,256).toFixed(1)})"/>`);
for(let i=0;i<60;i++){ const x=rand(0,256), y=rand(0,256); b.push(`<path d="M${x.toFixed(1)} ${y.toFixed(1)}L${(x+rand(-4,4)).toFixed(1)} ${(y-rand(3,7)).toFixed(1)}" stroke="rgba(104,116,72,0.26)" stroke-width="0.9" fill="none"/>`); }
return `<rect width="256" height="256" fill="#a9a693"/>`
+svgMottle('il1','0.035',4,[0.74,0.72,0.62],0.8,-0.66,0.40,53)
+svgMottle('il2','0.12',3,[0.58,0.56,0.48],0.8,-0.6,0.24,57)
+svgGrain('il3','0.62',[0.52,0.48,0.36],0.14,59)
+b.join('');
});
// 碎波泡沫 (岸线浪花带, 透明底; 沿水线滚动 UV = 破浪观感)
svgReg('foam',128,64,()=>{
let b='';
for(let i=0;i<170;i++){
b+=`<circle cx="${rand(0,128).toFixed(1)}" cy="${rand(0,64).toFixed(1)}" r="${rand(0.8,3.4).toFixed(1)}" fill="rgb(255,255,255)" opacity="${rand(0.2,0.85).toFixed(2)}"/>`;
}
return b;
});
svgReg('dirt',256,256,()=>{
const b=[];
for(let i=0;i<38;i++){
const x=rand(0,256),y=rand(0,256),r=rand(1,3);
b.push(`<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${r.toFixed(1)}" ry="${(r*rand(0.6,0.9)).toFixed(1)}" fill="rgb(${randi(112,140)},${randi(104,130)},${randi(86,108)})" stroke="rgba(48,40,28,0.4)" stroke-width="0.6"/>`);
}
for(let i=0;i<24;i++){
b.push(`<ellipse cx="${rand(0,256).toFixed(1)}" cy="${rand(0,256).toFixed(1)}" rx="${rand(2,5).toFixed(1)}" ry="${rand(1.5,3.5).toFixed(1)}" fill="rgb(${randi(70,88)},${randi(58,74)},${randi(40,52)})" opacity="${rand(0.2,0.4).toFixed(2)}"/>`);
}
for(let i=0;i<7;i++){
let x=rand(0,256),y=rand(0,256),d=`M${x.toFixed(1)} ${y.toFixed(1)}`;
for(let k=0;k<5;k++){ x+=rand(-16,16); y+=rand(6,20); d+=` L${x.toFixed(1)} ${y.toFixed(1)}`; }
b.push(`<path d="${d}" stroke="rgba(45,38,26,0.32)" stroke-width="1" fill="none"/>`);
}
return `<rect width="256" height="256" fill="#7a6a4e"/>`
+svgMottle('dt1','0.035',4,[0.33,0.28,0.2],0.9,-0.74,0.45,3)
+svgMottle('dt2','0.1',3,[0.56,0.49,0.36],0.85,-0.76,0.3,9)
+svgGrain('dt3','0.6',[0.22,0.19,0.13],0.18,15)
+b.join('');
});
svgReg('brick',256,256,()=>{
const b=[];
// ★2026-09-28B (与上方 Canvas 版同口径): 单砖 32×16px (每贴 8×16 块 ⇒ 0.225×0.1125m @1.8m/贴),
//   逐块只抖明度 (旧版整列同色 ⇒ 墙面竖向色带), 行内奇偶错缝, 越界半块取对边同列色 (平铺闭合);
//   砖缝压暗 (#6e5849) + 高光/阴影条收细收淡 —— 旧版米白宽缝在受光面/背光面读作两种材料。
const bw=32,bh=16,cols=8,rows=16;
const colFill=[]; for(let ry2=0;ry2<rows;ry2++){ colFill[ry2]=[]; for(let c2=0;c2<cols;c2++) colFill[ry2][c2]=shade(BRICK_C,rand(0.88,1.12),rand(-3,3)); }
for(let ry=0;ry<rows;ry++){
const off=(ry%2)?bw/2:0;
for(let x=(off?-bw/2:0);x<256;x+=bw){
const fill=colFill[ry][((((x%256)+256)%256)/bw|0)];
b.push(`<rect x="${(x+1).toFixed(1)}" y="${(ry*bh+1).toFixed(1)}" width="${bw-2}" height="${bh-2}" rx="1" fill="${fill}"/>`
+`<line x1="${(x+1).toFixed(1)}" y1="${(ry*bh+1.5).toFixed(1)}" x2="${(x+bw-1).toFixed(1)}" y2="${(ry*bh+1.5).toFixed(1)}" stroke="rgba(255,232,205,0.10)" stroke-width="1"/>`
+`<line x1="${(x+1).toFixed(1)}" y1="${(ry*bh+bh-2).toFixed(1)}" x2="${(x+bw-1).toFixed(1)}" y2="${(ry*bh+bh-2).toFixed(1)}" stroke="rgba(25,15,10,0.22)" stroke-width="1"/>`);
}
}
return `<rect width="256" height="256" fill="#6e5849"/>`
+svgMottle('br1','0.012',3,[0.4,0.3,0.22],0.9,-0.75,0.18,7)
+b.join('')
+svgGrain('br2','0.55',[0.15,0.1,0.07],0.14,11);
});
svgReg('plaster',256,256,()=>{
// ★2026-09-28 重做 (用户实报"材质问题仍十分严重"): 抹灰面**不画任何离散图形** —— 旧版的棕色返潮斑
//   (径向渐变, alpha 0.16~0.3) 和波浪"裂纹"是每 1.8m 复现一次的图形, 平铺到墙上就是规则的圆点+毛线。
// ★2026-09-28B 二次校准 (用户实报"材质不一致", 诺曼底灰白楼实机截图): 首版把亮度压过头 ——
//   svgMottle 的 α = s·(R+G+B)+bias (三通道和, 均值 1.5), 首版参数合成明度调制只有 ~2%,
//   远看minify后整面墙平均成"没上材质的白模"。现在 4 层 fBm (大修斑/晒褪斑/细斑/微齿)
//   合成调制 ~5-8%, 无离散图形、stitchTiles 无缝、无单层 >0.5 (不会再出现"圆点")。
return `<rect width="256" height="256" fill="#b6ad97"/>`
+svgMottle('pl1','0.012',4,[0.50,0.47,0.40],0.9,-0.60,0.45,4)   // 大尺度修补斑 (−16% 暗云, 蜂窝状不做圆)
+svgMottle('pl2','0.05',3,[0.88,0.85,0.77],0.85,-0.55,0.30,8)   // 中尺度晒褪斑 (+9% 亮云)
+svgGrain('pl3','0.6',[0.42,0.38,0.30],0.12,12)                 // 细颗粒
+svgGrain('pl4','1.2',[0.30,0.27,0.22],0.08,21);                // 微齿 (近看不是纯平)
});
svgReg('stone',256,256,()=>{
const b=[];
for(let ry=0;ry<8;ry++){
let x=0;
while(x<256){
let w=Math.round(rand(40,84)/4)*4;
if(256-x-w<40) w=256-x;
b.push(`<g><rect x="${(x+2).toFixed(1)}" y="${(ry*32+2.5).toFixed(1)}" width="${w-3}" height="27.5" fill="rgba(30,30,26,0.45)"/>`
+`<rect x="${x}" y="${ry*32+1}" width="${w-3}" height="27.5" rx="2" fill="${shade(STONE_C,rand(0.86,1.14),rand(-4,4))}"/>`
+`<line x1="${x+2}" y1="${ry*32+2.2}" x2="${(x+w-5).toFixed(1)}" y2="${ry*32+2.2}" stroke="rgba(255,255,250,0.16)" stroke-width="1.3"/>`
+`<line x1="${x+2}" y1="${ry*32+28}" x2="${(x+w-5).toFixed(1)}" y2="${ry*32+28}" stroke="rgba(20,20,16,0.3)" stroke-width="1.3"/></g>`);
if(Math.random()<0.22){ // 苔痕: 只压在砌缝上、留在格内 (旧版 0.3 概率 + 三通道随机绿 ⇒ 补丁感)
b.push(`<ellipse cx="${(x+rand(6,w-8)).toFixed(1)}" cy="${(ry*32+28)}" rx="${rand(3,7).toFixed(1)}" ry="2" fill="${shade([80,98,50],rand(0.9,1.1),0)}" opacity="0.26"/>`);
}
x+=w;
}
}
return `<rect width="256" height="256" fill="#6f6c62"/>`
+b.join('')
+svgGrain('st1','0.55',[0.2,0.2,0.18],0.13,6);
});
svgReg('wood',256,256,()=>{
const b=[];
for(let p=0;p<8;p++){
const x=p*32;
b.push(`<rect x="${x}" y="0" width="32" height="256" fill="${shade(WOOD_C,rand(0.86,1.14),rand(-4,4))}"/>`);
for(let i=0;i<3;i++){
// 木纹: 形状逐字固定 (起点在局部原点), 位置/相位全走 transform —— 纵向越界时在对边补同一段
const gx=x+rand(4,28), y0=rand(-8,8);
const d=`M0 0 q${rand(-3,3).toFixed(1)} 64 ${rand(-4,4).toFixed(1)} 132 q${rand(-3,3).toFixed(1)} 64 ${rand(-4,4).toFixed(1)} 132`;
const sw=rand(0.8,1.6).toFixed(1);
for(const dy of [0,-256,256]) b.push(`<path d="${d}" transform="translate(${gx.toFixed(1)} ${(y0-4+dy).toFixed(1)})" stroke="rgba(52,38,22,0.4)" stroke-width="${sw}" fill="none"/>`);
}
b.push(`<line x1="${x+30.5}" y1="0" x2="${x+30.5}" y2="256" stroke="rgba(28,18,9,0.55)" stroke-width="2.2"/>`);
b.push(`<line x1="${x+1}" y1="0" x2="${x+1}" y2="256" stroke="rgba(210,178,128,0.12)" stroke-width="1"/>`);
}
for(let i=0;i<3;i++){
const x=rand(8,248),y=rand(10,246);
b.push(`<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${rand(2.5,4.5).toFixed(1)}" ry="${rand(4,7).toFixed(1)}" fill="rgba(46,32,18,0.65)"/><ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${rand(5,8).toFixed(1)}" ry="${rand(8,12).toFixed(1)}" fill="none" stroke="rgba(46,32,18,0.3)" stroke-width="1.2"/>`);
}
return b.join('')+svgStreak('wd1','0.55','0.014',[0.3,0.22,0.13],0.85,-0.75,0.16,9);
});
svgReg('woodDark',128,128,()=>{
const b=[];
for(let p=0;p<4;p++){
const x=p*32;
b.push(`<rect x="${x}" y="0" width="32" height="128" fill="${shade(WOODD_C,rand(0.86,1.14),rand(-4,4))}"/>`);
for(let i=0;i<2;i++){
// 与 TEX.wood 同规: 形状固定 + transform 定位, 纵向越界在对边补同一段 (128 高的小格同样要平铺闭合)
const gx=x+rand(4,28), y0=rand(-8,8);
const d=`M0 0 q${rand(-3,3).toFixed(1)} 34 ${rand(-3,3).toFixed(1)} 68 q${rand(-3,3).toFixed(1)} 30 ${rand(-3,3).toFixed(1)} 64`;
const sw=rand(0.8,1.4).toFixed(1);
for(const dy of [0,-128,128]) b.push(`<path d="${d}" transform="translate(${gx.toFixed(1)} ${(y0-4+dy).toFixed(1)})" stroke="rgba(24,16,8,0.5)" stroke-width="${sw}" fill="none"/>`);
}
b.push(`<line x1="${x+30.5}" y1="0" x2="${x+30.5}" y2="128" stroke="rgba(12,8,4,0.6)" stroke-width="2.4"/>`);
}
return b.join('')+svgStreak('wdk1','0.5','0.016',[0.1,0.07,0.04],0.85,-0.75,0.2,14);
});
svgReg('sandbag',128,128,()=>{
const b=[];
// 缝线用"形状固定 + transform 定位"写法 (与 wood 同规): 平铺闭合检查里同形副本才认得出
const DASH='M-14 -5 Q0 -11 14 -5';
for(let ry=0;ry<4;ry++){
const off=(ry%2)?21.3:0;
for(let x=-21.3+off;x<128+21.3;x+=42.7){
const cx=x, cy=ry*32+16;
b.push(`<ellipse cx="${cx.toFixed(1)}" cy="${(cy+3).toFixed(1)}" rx="19.5" ry="12.5" fill="rgba(50,42,26,0.35)"/>`);
b.push(`<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="20" ry="13" fill="url(#sbg)" stroke="rgba(72,62,40,0.55)" stroke-width="1"/>`);
b.push(`<path d="${DASH}" transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)})" stroke="rgba(96,84,56,0.5)" stroke-width="0.9" fill="none" stroke-dasharray="2.5 2"/>`);
}
}
return `<rect width="128" height="128" fill="#6e6349"/>`
+`<radialGradient id="sbg" cx="0.38" cy="0.3" r="0.85"><stop offset="0" stop-color="rgb(176,158,116)"/><stop offset="0.55" stop-color="rgb(152,136,98)"/><stop offset="1" stop-color="rgb(116,102,72)"/></radialGradient>`
+b.join('')
+svgGrain('sb1','0.5',[0.3,0.26,0.17],0.15,8);
});
svgReg('metal',128,128,()=>{
const b=[];
for(let i=0;i<22;i++){
b.push(`<circle cx="${rand(0,128).toFixed(1)}" cy="${rand(0,128).toFixed(1)}" r="${rand(0.6,1.8).toFixed(1)}" fill="rgb(${randi(108,138)},${randi(64,84)},${randi(34,46)})" opacity="${rand(0.2,0.5).toFixed(2)}"/>`);
}
for(let i=0;i<6;i++){
const x=rand(0,128),y=rand(0,128),a=rand(0,6.28),l=rand(8,26);
b.push(`<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x+Math.cos(a)*l).toFixed(1)}" y2="${(y+Math.sin(a)*l).toFixed(1)}" stroke="rgba(190,196,188,0.18)" stroke-width="0.7"/>`);
}
return `<rect width="128" height="128" fill="#5a5f56"/>`
+svgStreak('mt1','0.012','0.5',[0.14,0.16,0.14],0.85,-0.72,0.3,4)
+svgStreak('mt2','0.01','0.4',[0.72,0.75,0.7],0.8,-0.72,0.16,10)
+svgGrain('mt3','0.7',[0.1,0.11,0.1],0.1,16)
+b.join('');
});
svgReg('bark',128,128,()=>{
const b=[];
for(let i=0;i<15;i++){
const x=rand(2,126);
b.push(`<path d="M${x.toFixed(1)} -4 q${rand(-3,3).toFixed(1)} 34 ${rand(-3,3).toFixed(1)} 68 q${rand(-3,3).toFixed(1)} 30 ${rand(-3,3).toFixed(1)} 68" stroke="rgba(36,28,16,0.55)" stroke-width="${rand(2,4.5).toFixed(1)}" fill="none"/>`);
}
for(let i=0;i<12;i++){
const x=rand(2,126);
b.push(`<path d="M${x.toFixed(1)} -4 q${rand(-2,2).toFixed(1)} 34 ${rand(-2,2).toFixed(1)} 68 q${rand(-2,2).toFixed(1)} 30 ${rand(-2,2).toFixed(1)} 68" stroke="rgba(120,100,70,0.3)" stroke-width="1.2" fill="none"/>`);
}
for(let i=0;i<10;i++){
const x=rand(0,120),y=rand(0,128);
b.push(`<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x+rand(3,9)).toFixed(1)}" y2="${(y+rand(-2,2)).toFixed(1)}" stroke="rgba(30,22,12,0.4)" stroke-width="1"/>`);
}
return `<rect width="128" height="128" fill="#5d4c36"/>`
+svgStreak('bk1','0.4','0.015',[0.16,0.12,0.07],0.85,-0.75,0.28,12)
+b.join('');
});
svgReg('leaves',128,128,()=>{
const b=[];
for(let i=0;i<70;i++) b.push(svgLeaf(rand(0,128),rand(0,128),rand(2.5,6),`rgb(${randi(40,58)},${randi(58,76)},${randi(26,38)})`,rand(0.75,0.95)));
for(let i=0;i<150;i++) b.push(svgLeaf(rand(0,128),rand(0,128),rand(3,7),`rgb(${randi(58,92)},${randi(82,116)},${randi(38,58)})`,rand(0.8,1)));
for(let i=0;i<55;i++) b.push(svgLeaf(rand(0,128),rand(0,128),rand(2,4.5),`rgb(${randi(96,126)},${randi(116,142)},${randi(56,76)})`,rand(0.7,0.9)));
for(let i=0;i<6;i++){
const x=rand(0,128),y=rand(0,128);
b.push(`<path d="M${x.toFixed(1)} ${y.toFixed(1)} q${rand(-8,8).toFixed(1)} ${rand(-8,8).toFixed(1)} ${rand(-14,14).toFixed(1)} ${rand(-14,14).toFixed(1)}" stroke="rgb(72,58,38)" stroke-width="1.6" fill="none" opacity="0.85"/>`);
}
return b.join('');
});
svgReg('roof',256,256,()=>{
const b=[];
for(let ry=0;ry<8;ry++){
for(let cx=0;cx<8;cx++){
const x=cx*32,y=ry*32;
b.push(`<path d="M${x+1} ${y+31} L${x+1} ${y+7} Q${x+16} ${y+1} ${x+31} ${y+7} L${x+31} ${y+31} Z" fill="${shade(ROOF_C,rand(0.86,1.14),rand(-4,4))}"/>`);
b.push(`<path d="M${x+1} ${y+31} L${x+1} ${y+7} Q${x+16} ${y+1} ${x+31} ${y+7} L${x+31} ${y+31}" fill="none" stroke="rgba(255,220,190,0.14)" stroke-width="1.2"/>`);
b.push(`<line x1="${x+1}" y1="${y+31}" x2="${x+31}" y2="${y+31}" stroke="rgba(38,20,14,0.5)" stroke-width="2"/>`);
if(Math.random()<0.22){
b.push(`<ellipse cx="${(x+rand(6,26)).toFixed(1)}" cy="${y+28}" rx="${rand(2,5).toFixed(1)}" ry="1.8" fill="${shade([84,102,55],rand(0.9,1.1),0)}" opacity="0.3"/>`);
}
}
}
return `<rect width="256" height="256" fill="#57352c"/>`+b.join('')+svgGrain('rf1','0.5',[0.15,0.08,0.06],0.12,19);
});
svgReg('hay',128,128,()=>{
const b=[];
for(let i=0;i<150;i++){
const x=rand(-10,128),y=rand(0,128),a=rand(-0.6,0.6),l=rand(12,40);
b.push(`<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x+Math.cos(a)*l).toFixed(1)}" y2="${(y+Math.sin(a)*l).toFixed(1)}" stroke="rgb(${randi(150,192)},${randi(130,162)},${randi(70,96)})" stroke-width="${rand(0.7,1.5).toFixed(1)}" opacity="${rand(0.5,0.85).toFixed(2)}"/>`);
}
for(let i=0;i<30;i++){
const x=rand(-10,128),y=rand(0,128),a=rand(-0.5,0.5),l=rand(10,30);
b.push(`<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x+Math.cos(a)*l).toFixed(1)}" y2="${(y+Math.sin(a)*l).toFixed(1)}" stroke="rgb(${randi(96,118)},${randi(80,98)},${randi(42,56)})" stroke-width="1" opacity="0.45"/>`);
}
return `<rect width="128" height="128" fill="#b09a58"/>`+b.join('')+svgGrain('hy1','0.6',[0.5,0.42,0.2],0.1,22);
});
svgReg('hedge',256,256,()=>{
const b=[];
for(let i=0;i<170;i++) b.push(svgLeaf(rand(0,256),rand(0,256),rand(3,9),`rgb(${randi(30,44)},${randi(44,58)},${randi(18,28)})`,rand(0.5,0.8)));
for(let i=0;i<520;i++) b.push(svgLeaf(rand(0,256),rand(0,256),rand(3,9),`rgb(${randi(56,78)},${randi(80,104)},${randi(34,50)})`,rand(0.35,0.85)));
for(let i=0;i<230;i++) b.push(svgLeaf(rand(0,256),rand(0,256),rand(1,2.6),`rgb(${randi(102,126)},${randi(116,140)},${randi(60,78)})`,rand(0.25,0.6)));
return `<rect width="256" height="256" fill="#46552e"/>`+b.join('')
+svgGrain('hg1','0.3',[0.08,0.12,0.05],0.2,9)
+`<linearGradient id="hg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(255,255,214,0.1)"/><stop offset="0.32" stop-color="rgba(255,255,214,0)"/><stop offset="0.72" stop-color="rgba(18,24,10,0)"/><stop offset="1" stop-color="rgba(18,24,10,0.3)"/></linearGradient><rect width="256" height="256" fill="url(#hg2)"/>`;
});
svgReg('track',64,64,()=>{
const b=[];
for(let y=0;y<64;y+=8){
b.push(`<rect x="2" y="${y+1}" width="60" height="5" fill="#3f4038"/>`);
b.push(`<line x1="2" y1="${y+1.5}" x2="62" y2="${y+1.5}" stroke="rgba(210,212,200,0.14)" stroke-width="1"/>`);
b.push(`<rect x="8" y="${y+2.5}" width="48" height="2" fill="#1a1b16"/>`);
}
for(let i=0;i<14;i++){
b.push(`<circle cx="${rand(0,64).toFixed(1)}" cy="${rand(0,64).toFixed(1)}" r="${rand(0.5,1.4).toFixed(1)}" fill="rgb(${randi(84,104)},${randi(70,88)},${randi(46,58)})" opacity="${rand(0.2,0.45).toFixed(2)}"/>`);
}
return `<rect width="64" height="64" fill="#23241f"/>`+b.join('')+svgGrain('tk1','0.8',[0.06,0.06,0.05],0.12,25);
});
// ── 跨文件使用的生成器 (05c 庄稼草丛 / 17 医疗箱 / 08 烟尘粒子) ──
svgReg('grassTuft',64,64,()=>{
const b=[];
for(let i=0;i<30;i++){
const x=rand(8,56),dx=rand(-12,12),ty=rand(4,20);
b.push(`<path d="M${x.toFixed(1)} 64 Q${(x+dx*0.3).toFixed(1)} ${(64-(64-ty)*0.55).toFixed(1)} ${(x+dx).toFixed(1)} ${ty.toFixed(1)}" stroke="url(#gtg)" stroke-width="${rand(1.4,2.4).toFixed(1)}" fill="none" opacity="${rand(0.75,0.95).toFixed(2)}"/>`);
}
return `<linearGradient id="gtg" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="rgb(74,98,46)"/><stop offset="1" stop-color="rgb(122,150,82)"/></linearGradient>`+b.join('');
});
svgReg('wheat',128,128,()=>{
const b=[];
for(let i=0;i<26;i++){
const x=4+i*4.6+rand(0,2), hh=rand(88,118), top=128-hh;
b.push(`<line x1="${x.toFixed(1)}" y1="128" x2="${(x+rand(-3,3)).toFixed(1)}" y2="${(top+14).toFixed(1)}" stroke="rgb(${randi(150,175)},${randi(128,148)},${randi(58,78)})" stroke-width="${rand(1.2,1.8).toFixed(1)}" opacity="0.9"/>`);
for(let k=0;k<7;k++){
const ky=top+4+k*2.2, kx=x+rand(-1,1)+(k%2?2:-2)*rand(0.6,1);
b.push(`<ellipse cx="${kx.toFixed(1)}" cy="${ky.toFixed(1)}" rx="1.7" ry="2.6" fill="rgb(${randi(200,225)},${randi(168,195)},${randi(74,110)})" opacity="0.95"/>`);
}
for(let k=0;k<3;k++){
b.push(`<line x1="${x.toFixed(1)}" y1="${top.toFixed(1)}" x2="${(x+rand(-4,4)).toFixed(1)}" y2="${(top-rand(5,10)).toFixed(1)}" stroke="rgb(210,190,120)" stroke-width="0.7" opacity="0.6"/>`);
}
}
return b.join('');
});
svgReg('corn',128,128,()=>{
const b=[];
for(let i=0;i<16;i++){
const x=6+i*7.4+rand(0,3);
b.push(`<line x1="${x.toFixed(1)}" y1="128" x2="${(x+rand(-2,2)).toFixed(1)}" y2="6" stroke="rgb(${randi(70,105)},${randi(130,165)},${randi(50,75)})" stroke-width="2.6" opacity="0.95"/>`);
const n=randi(4,6);
for(let k=0;k<n;k++){
const y=rand(40,116), side=(k%2?1:-1), len=rand(16,26);
b.push(`<path d="M${x.toFixed(1)} ${y.toFixed(1)} Q${(x+side*len*0.5).toFixed(1)} ${(y-len*0.35).toFixed(1)} ${(x+side*len).toFixed(1)} ${(y-len*0.8).toFixed(1)} Q${(x+side*len*0.45).toFixed(1)} ${(y-len*0.15).toFixed(1)} ${x.toFixed(1)} ${(y+1).toFixed(1)} Z" fill="rgb(${randi(65,100)},${randi(120,155)},${randi(45,68)})" opacity="0.9"/>`);
}
for(let k=0;k<3;k++){
b.push(`<line x1="${x.toFixed(1)}" y1="7" x2="${(x+rand(-5,5)).toFixed(1)}" y2="${rand(0,5).toFixed(1)}" stroke="rgb(190,175,110)" stroke-width="0.8" opacity="0.7"/>`);
}
}
return b.join('');
});
svgReg('rice',128,128,()=>{
const b=[];
for(let i=0;i<12;i++){
const x=8+i*10+rand(0,5);
b.push(`<path d="M${x.toFixed(1)} 128 Q${(x+rand(-14,14)).toFixed(1)} 64 ${(x+rand(-18,18)).toFixed(1)} ${rand(10,26).toFixed(1)}" stroke="rgb(${randi(95,130)},${randi(150,180)},${randi(70,95)})" stroke-width="2" fill="none" opacity="0.9"/>`);
const tx=x+rand(-16,16), ty=rand(14,30), ra=rand(0,360).toFixed(0);
for(let k=0;k<6;k++){
b.push(`<ellipse cx="${(tx+rand(-7,7)).toFixed(1)}" cy="${(ty+rand(-6,6)).toFixed(1)}" rx="1.8" ry="1.2" fill="rgb(${randi(170,200)},${randi(185,210)},${randi(90,120)})" opacity="0.9" transform="rotate(${ra} ${tx.toFixed(1)} ${ty.toFixed(1)})"/>`);
}
}
return b.join('');
});
svgReg('medkit',64,64,()=>{
return `<rect width="64" height="64" fill="#d8d4c4"/>`
+`<rect width="64" height="6" fill="#b8b4a4"/><rect y="58" width="64" height="6" fill="#b8b4a4"/>`
+`<rect x="26" y="14" width="12" height="36" fill="#c03a2a"/><rect x="14" y="26" width="36" height="12" fill="#c03a2a"/>`
+`<rect x="26" y="14" width="3" height="36" fill="rgba(255,255,255,0.14)"/><rect x="14" y="26" width="36" height="3" fill="rgba(255,255,255,0.1)"/>`
+`<line x1="0.7" y1="6.4" x2="63.3" y2="6.4" stroke="rgba(255,255,255,0.2)" stroke-width="1"/><line x1="0.7" y1="57.6" x2="63.3" y2="57.6" stroke="rgba(40,36,28,0.25)" stroke-width="1"/>`
+svgGrain('mk1','0.6',[0.35,0.34,0.3],0.12,9);
});
svgReg('puffSmoke',64,64,()=>svgPuff('200,195,185','160,155,145',0.85,0.4,26,5));
svgReg('puffDark',64,64,()=>svgPuff('60,55,48','70,64,55',0.9,0.5,26,11));
svgReg('puffDirt',64,64,()=>svgPuff('120,100,70','100,84,58',0.95,0.5,26,17));
// ── 白底微噪共享贴图: 叠加到平色材质上 (color 乘法保持原色调, 均值≈1 不改亮度) ──
svgReg('grime',128,128,()=>{
return `<rect width="128" height="128" fill="#ffffff"/>`
+svgMottle('gr1','0.05',4,[0.7,0.68,0.6],0.85,-0.72,0.22,6)
+svgStreak('gr2','0.01','0.3',[0.55,0.52,0.45],0.85,-0.75,0.1,12)
+svgGrain('gr3','0.7',[0.4,0.38,0.34],0.08,18);
});
svgReg('cloth',128,128,()=>{
return `<rect width="128" height="128" fill="#ffffff"/>`
+svgStreak('cl1','0.5','0.012',[0.6,0.6,0.62],0.8,-0.72,0.09,3)
+svgStreak('cl2','0.012','0.5',[0.55,0.55,0.58],0.8,-0.72,0.07,9)
+svgGrain('cl3','0.75',[0.45,0.45,0.48],0.09,15);
});
svgReg('metalBrush',128,128,()=>{
return `<rect width="128" height="128" fill="#ffffff"/>`
+svgStreak('mb1','0.01','0.45',[0.55,0.57,0.6],0.85,-0.74,0.22,5)
+svgStreak('mb2','0.008','0.35',[0.8,0.82,0.85],0.8,-0.74,0.12,11)
+svgGrain('mb3','0.7',[0.3,0.32,0.35],0.08,17);
});
svgReg('grainLight',128,128,()=>{
return `<rect width="128" height="128" fill="#ffffff"/>`
+svgMottle('gl1','0.06',3,[0.62,0.6,0.55],0.85,-0.72,0.2,7)
+svgGrain('gl2','0.7',[0.4,0.4,0.38],0.1,13);
});
svgReg('water',128,128,()=>{
return `<rect width="128" height="128" fill="#ffffff"/>`
+svgMottle('wa1','0.012',3,[0.55,0.66,0.72],0.85,-0.7,0.16,21)
+svgMottle('wa2','0.04',2,[0.92,0.97,1.0],0.8,-0.66,0.12,22)
+svgStreak('wa3','0.006','0.2',[0.82,0.9,0.96],0.8,-0.72,0.1,23);
});
svgReg('ice',128,128,()=>{
let cracks='';
for(let i=0;i<9;i++){
const x0=rand(10,118),y0=rand(10,118),a=rand(0,Math.PI*2),l=rand(10,30);
const x1=Math.min(122,Math.max(6,x0+Math.cos(a)*l)), y1=Math.min(122,Math.max(6,y0+Math.sin(a)*l));
const mx=(x0+x1)/2+rand(-6,6), my=(y0+y1)/2+rand(-6,6);
cracks+=`<path d="M${x0.toFixed(1)} ${y0.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}" stroke="rgb(120,138,152)" stroke-width="0.8" fill="none" opacity="0.5"/>`;
}
return `<rect width="128" height="128" fill="#ffffff"/>`
+svgMottle('ic1','0.02',3,[0.72,0.78,0.85],0.85,-0.7,0.13,31)
+svgGrain('ic2','0.5',[0.5,0.55,0.62],0.08,32)
+cracks;
});
// 弹坑焦土: 白底相对明度贴图 (中心焦黑→外缘亮土), 与材质基色 0x4a4238 乘法叠加成焦土渐变; 飞溅斑点非平铺件
svgReg('crater',128,128,()=>{
let sp='';
for(let i=0;i<26;i++){
const a=rand(0,Math.PI*2), rr=rand(30,62);
const px=64+Math.cos(a)*rr, py=64+Math.sin(a)*rr, sz=rand(1.2,3.4);
sp+=`<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${sz.toFixed(1)}" fill="rgb(46,40,32)" opacity="${rand(0.25,0.6).toFixed(2)}"/>`;
}
return `<rect width="128" height="128" fill="rgb(150,142,124)"/>`
+`<defs><radialGradient id="crg"><stop offset="0" stop-color="rgb(40,36,30)"/><stop offset="0.5" stop-color="rgb(72,66,54)"/><stop offset="0.82" stop-color="rgb(104,96,80)"/><stop offset="1" stop-color="rgb(150,142,124)"/></radialGradient></defs><circle cx="64" cy="64" r="64" fill="url(#crg)"/>`
+sp;
});

// ── 对既有 TEX 库逐张发起 SVG 重绘 (Canvas 版继续作为即时兜底) ──
svgApply(TEX.grass,'grass'); svgApply(TEX.snowGround,'snowGround'); svgApply(TEX.dirt,'dirt');
svgApply(TEX.sand,'sand'); svgApply(TEX.island,'island'); svgApply(TEX.foam,'foam');
svgApply(TEX.brick,'brick'); svgApply(TEX.plaster,'plaster'); svgApply(TEX.stone,'stone');
svgApply(TEX.wood,'wood'); svgApply(TEX.woodDark,'woodDark'); svgApply(TEX.sandbag,'sandbag');
svgApply(TEX.metal,'metal'); svgApply(TEX.bark,'bark'); svgApply(TEX.leaves,'leaves');
svgApply(TEX.roof,'roof'); svgApply(TEX.hay,'hay'); svgApply(TEX.hedge,'hedge'); svgApply(TEX.track,'track');
TEX.grime=makeTex(128,128,(g,w,h)=>{ g.fillStyle='#fff'; g.fillRect(0,0,w,h); });
TEX.cloth=makeTex(128,128,(g,w,h)=>{ g.fillStyle='#fff'; g.fillRect(0,0,w,h); });
TEX.metalBrush=makeTex(128,128,(g,w,h)=>{ g.fillStyle='#fff'; g.fillRect(0,0,w,h); });
TEX.grainLight=makeTex(128,128,(g,w,h)=>{ g.fillStyle='#fff'; g.fillRect(0,0,w,h); });
TEX.water=makeTex(128,128,(g,w,h)=>{ g.fillStyle='#fff'; g.fillRect(0,0,w,h); });
TEX.ice=makeTex(128,128,(g,w,h)=>{ g.fillStyle='#fff'; g.fillRect(0,0,w,h); });
TEX.crater=makeTex(128,128,(g,w,h)=>{ g.fillStyle='#fff'; g.fillRect(0,0,w,h); });
svgApply(TEX.grime,'grime'); svgApply(TEX.cloth,'cloth'); svgApply(TEX.water,'water'); svgApply(TEX.ice,'ice'); svgApply(TEX.crater,'crater');
svgApply(TEX.metalBrush,'metalBrush'); svgApply(TEX.grainLight,'grainLight');
const MAT = {
grass: new THREE.MeshLambertMaterial({map:TEX.grass, vertexColors:true}),
brick: new THREE.MeshLambertMaterial({map:TEX.brick}),
plaster: new THREE.MeshLambertMaterial({map:TEX.plaster}),
stone: new THREE.MeshLambertMaterial({map:TEX.stone}),
wood: new THREE.MeshLambertMaterial({map:TEX.wood}),
woodDark: new THREE.MeshLambertMaterial({map:TEX.woodDark}),
sandbag: new THREE.MeshLambertMaterial({map:TEX.sandbag}),
metal: new THREE.MeshLambertMaterial({map:TEX.metal}),
	metalDark: new THREE.MeshLambertMaterial({color:0x3a3d38, map:TEX.metalBrush}),
bark: new THREE.MeshLambertMaterial({map:TEX.bark}),
leaves: new THREE.MeshLambertMaterial({map:TEX.leaves, transparent:true, alphaTest:0.5, side:THREE.DoubleSide}),
roof: new THREE.MeshLambertMaterial({map:TEX.roof}),
hay: new THREE.MeshLambertMaterial({map:TEX.hay}),
	rubble: new THREE.MeshLambertMaterial({color:0x8a8378, map:TEX.grainLight}),
};
// 战役环境主题着色: 地面/树叶/屋顶随战场变化 (雪地/废墟/江南/黄土)
MAT.grass.color.set(THEME.ground);
MAT.leaves.color.set(THEME.leaf);
MAT.roof.color.set(THEME.roof);
if(THEME.snow){ MAT.grass.map=TEX.snowGround; MAT.sandbag.color.set(0xd8dade); MAT.hay.color.set(0xcfd2d6); MAT.stone.color.set(0xc8ccd2); }
// 塔拉瓦环礁 (2026-09-18b pacific): 地面底图换**中性偏暗的珊瑚土/椰林地被** (TEX.island) ——
// 03-terrain 顶点色带 (白沙滩/湿沙/礁盘/草甸/密林/跑道) 在其上乘法, 色相完全由顶点色决定
if(CAMPAIGN.theme==='pacific'){ MAT.grass.map=TEX.island; MAT.stone.color.set(0xd8d2c0); MAT.plaster.color.set(0xd6d0bc); }
if(CAMPAIGN.theme==='loess'){ MAT.stone.color.set(0xd8c8a0); MAT.plaster.color.set(0xe0d0a8); }
// 贴图密度归一 (2026-09-20c): 把 00-config.UV_DENSITY 挂到材质上 —— 05-world.mesh() 建盒时读 mat.uvRef
// 归一化面 UV, 使整段墙/窗台/门楣/墙垛保持同一贴图密度 (修用户实机"窗户下面的部分和总体材质总是不同")。
for(const _uk in UV_DENSITY){ if(MAT[_uk]) MAT[_uk].uvRef=UV_DENSITY[_uk]; }
// 雪檐房顶覆盖: 雪地战役给屋顶叠加一层带出檐的积雪盖板 (作为屋顶子节点, 随屋顶坍塌一并消失)
MAT.snowCap=new THREE.MeshLambertMaterial({color:0xedf2f8});
function addSnowCap(rm){
if(!THEME.snow||!rm||!rm.geometry||!rm.geometry.parameters) return rm;
const gp=rm.geometry.parameters;
if(gp.width===undefined||gp.depth===undefined) return rm;
const cap=new THREE.Mesh(new THREE.BoxGeometry(gp.width+0.16,0.13,gp.depth+0.16),MAT.snowCap);
cap.position.y=(gp.height||0.2)/2+0.065;
cap.castShadow=false; cap.receiveShadow=true;
rm.add(cap);
return rm;
}

// ══════════════════════════════════════════════════════════════════════════════
// 海战批贴图扩展 (2026-09-20N, owner: naval-model) —— 6 张, **仅追加**, 上方既有条目一行未动。
// 消费方: 15e-navmodels.js (海战载具本体) + 05b-props/05a-buildings 的残骸三件 (tankWreck/planeWreck/
//   landingCraft)。键名与拼写已冻结: rust / paintPeel / scorch / waterline / barnacle / deckWood;
//   wreck-art 按这六个名字取用 —— 改名必须先通报 Lead 与他。
// 口径与既有 TEX 一致: **白底相对明度贴图** (材质 color 做乘法决定色相, 均值≈1 不改亮度) —— 因此
//   同一张 rust/barnacle 能挂到任何涂装的载具/残骸上而不串色。
//   例外是 waterline: 污带画在贴图**下缘** —— 盒面 UV 是 0..1, 会把污带落在每个面的底部 =
//   吃水线位置 (15e 的艇体干舷、wreck-art 的登陆艇舷侧三条水线污都靠这条)。
// 管线: makeTex (Canvas2D 即时兜底) → svgReg 登记 → svgApply (浏览器里 SVG 滤镜重绘, 加载期无缝替换);
//   Node 沙箱/低端环境停留在 Canvas 版, 布局与指纹零漂移 (与既有 22 张同一条路)。
// ══════════════════════════════════════════════════════════════════════════════

// ── rust 锈蚀: 橙褐锈斑 + 沿板缝垂挂的锈痕 (载具排气/管件/浮筒 + 残骸主锈) ──
TEX.rust=makeTex(128,128,(g,w,h)=>{
g.fillStyle='#fff'; g.fillRect(0,0,w,h);
speckle(g,w,h,110,'#a8663a','#7b4622',2,10);
speckle(g,w,h,70,'#d0964f','#8a5730',1,5);
g.fillStyle='rgba(111,74,42,.28)';
for(let i=0;i<7;i++) g.fillRect(rand(0,w),rand(0,h*0.5),rand(1,3),rand(h*0.25,h*0.6));
g.globalAlpha=1;
},1,1);
svgReg('rust',128,128,()=>{
let st='';
for(let i=0;i<7;i++)
st+=`<rect x="${rand(4,124).toFixed(1)}" y="${rand(2,64).toFixed(1)}" width="${rand(1,3).toFixed(1)}" height="${rand(30,84).toFixed(1)}" fill="rgb(110,72,40)" opacity="${rand(0.12,0.30).toFixed(2)}"/>`;
return `<rect width="128" height="128" fill="#ffffff"/>`
+svgMottle('ru1','0.045',4,[0.72,0.42,0.20],0.90,-0.55,0.55,41)
+svgMottle('ru2','0.16',2,[0.55,0.30,0.14],0.85,-0.60,0.32,42)
+svgGrain('ru3','0.6',[0.45,0.30,0.18],0.10,43)
+st;
});
svgApply(TEX.rust,'rust');

// ── paintPeel 剥落漆: 灰底漆斑 + 未伤的原涂装(白) + 板缘刮痕 (残骸"露出原涂装一角"的信息量来源) ──
TEX.paintPeel=makeTex(128,128,(g,w,h)=>{
g.fillStyle='#fff'; g.fillRect(0,0,w,h);
for(let i=0;i<34;i++){
const x=rand(0,w), y=rand(0,h), s=rand(4,15);
g.globalAlpha=rand(.30,.70); g.fillStyle=Math.random()<.5?'#9a958a':'#7d7a70';
g.beginPath(); g.ellipse(x,y,s,s*rand(.5,.9),rand(0,3),0,TAU); g.fill();
}
g.globalAlpha=1;
speckle(g,w,h,50,'#ffffff','#6e6a60',1,3);
},1,1);
svgReg('paintPeel',128,128,()=>{
let fl='';
for(let i=0;i<26;i++){
const cx=rand(12,116), cy=rand(12,116), r=rand(4,15), n=randi(5,7);
let pts='';
for(let k=0;k<n;k++){ const a=TAU*k/n+rand(-0.25,0.25), rr=r*rand(0.6,1.2);
pts+=`${(cx+Math.cos(a)*rr).toFixed(1)},${(cy+Math.sin(a)*rr).toFixed(1)} `; }
fl+=`<polygon points="${pts.trim()}" fill="rgb(150,146,138)" stroke="rgb(96,92,84)" stroke-width="0.7" opacity="${rand(0.35,0.70).toFixed(2)}"/>`;
}
return `<rect width="128" height="128" fill="#ffffff"/>`
+svgMottle('pp1','0.08',3,[0.60,0.58,0.54],0.85,-0.66,0.24,44)
+svgGrain('pp2','0.65',[0.42,0.40,0.38],0.08,45)
+fl;
});
svgApply(TEX.paintPeel,'paintPeel');

// ── scorch 烟熏焦黑: 软边烟斑 + 上飘烟痕 (载具排气口/炮口 + 残骸烧黑) ──
TEX.scorch=makeTex(128,128,(g,w,h)=>{
g.fillStyle='#fff'; g.fillRect(0,0,w,h);
for(let i=0;i<14;i++){
const x=rand(0,w), y=rand(0,h), r=rand(8,26);
const gr=g.createRadialGradient(x,y,1,x,y,r);
gr.addColorStop(0,'rgba(24,20,16,.85)'); gr.addColorStop(.55,'rgba(40,34,28,.45)'); gr.addColorStop(1,'rgba(60,52,44,0)');
g.fillStyle=gr; g.fillRect(x-r,y-r,r*2,r*2);
}
speckle(g,w,h,60,'#2a2620','#4a443c',1,4);
},1,1);
svgReg('scorch',128,128,()=>{
let bl='';
for(let i=0;i<12;i++)
bl+=`<circle cx="${rand(10,118).toFixed(1)}" cy="${rand(10,118).toFixed(1)}" r="${rand(9,28).toFixed(1)}" fill="url(#scG)" opacity="${rand(0.35,0.85).toFixed(2)}"/>`;
return `<rect width="128" height="128" fill="#ffffff"/>`
+`<defs><radialGradient id="scG"><stop offset="0" stop-color="rgb(20,17,14)"/><stop offset="0.55" stop-color="rgb(44,38,32)"/><stop offset="1" stop-color="rgb(70,62,54)" stop-opacity="0"/></radialGradient></defs>`
+svgMottle('sc1','0.09',3,[0.30,0.27,0.24],0.85,-0.50,0.42,46)
+bl;
});
svgApply(TEX.scorch,'scorch');

// ── waterline 水线污: 下缘一条(锈水带 + 硬水线 + 水下藻绿), 其余留白 —— 见文件头"例外"说明 ──
TEX.waterline=makeTex(128,128,(g,w,h)=>{
g.fillStyle='#fff'; g.fillRect(0,0,w,h);
g.fillStyle='#8a6a44'; g.fillRect(0,h*0.61,w,h*0.39);       // 锈水带
g.fillStyle='#5f5236'; g.fillRect(0,h*0.61,w,2);            // 水线硬边
g.fillStyle='#4e5a3c'; g.fillRect(0,h*0.86,w,h*0.14);       // 水下藻绿
speckle(g,w,h,80,'#6b5232','#3f4a30',2,7);
g.globalAlpha=.35; g.fillStyle='#7d9660'; g.fillRect(0,h*0.585,w,3); g.globalAlpha=1; // 浪花线 (水线之上浅污)
},1,1);
svgReg('waterline',128,128,()=>{
return `<rect width="128" height="128" fill="#ffffff"/>`
+svgMottle('wl1','0.05',3,[0.68,0.52,0.30],0.90,-0.70,0.20,47)
+`<rect x="0" y="78" width="128" height="50" fill="rgb(138,106,68)" opacity="0.55"/>`
+`<rect x="0" y="74" width="128" height="3" fill="rgb(60,52,36)" opacity="0.55"/>`
+`<rect x="0" y="106" width="128" height="22" fill="rgb(78,90,60)" opacity="0.60"/>`
+svgStreak('wl2','0.02','0.50',[0.45,0.40,0.30],0.80,-0.70,0.14,48)
+svgGrain('wl3','0.70',[0.40,0.38,0.30],0.08,49);
});
svgApply(TEX.waterline,'waterline');

// ── barnacle 藤壶藻绿: 藻绿底 + 成簇藤壶(白点带暗环) —— 水下艇底/吃水线下方 ──
TEX.barnacle=makeTex(128,128,(g,w,h)=>{
g.fillStyle='#fff'; g.fillRect(0,0,w,h);
g.globalAlpha=.55; g.fillStyle='#7d8c58'; g.fillRect(0,0,w,h); g.globalAlpha=1;
for(let i=0;i<70;i++){
const x=rand(0,w), y=rand(0,h), r=rand(1.2,3.6);
g.fillStyle='rgba(70,80,52,.5)'; g.beginPath(); g.arc(x,y,r*1.5,0,TAU); g.fill();
g.fillStyle='#e8e8dc'; g.beginPath(); g.arc(x,y,r,0,TAU); g.fill();
}
},1,1);
svgReg('barnacle',128,128,()=>{
let bn='';
for(let i=0;i<60;i++){
const x=rand(4,124).toFixed(1), y=rand(4,124).toFixed(1), r=rand(1.2,3.6).toFixed(1);
bn+=`<circle cx="${x}" cy="${y}" r="${(r*1.6).toFixed(1)}" fill="rgb(72,84,54)" opacity="0.45"/>`
 +`<circle cx="${x}" cy="${y}" r="${r}" fill="rgb(232,232,220)" opacity="0.90"/>`;
}
return `<rect width="128" height="128" fill="#ffffff"/>`
+svgMottle('bn1','0.06',4,[0.46,0.56,0.32],0.90,-0.45,0.58,50)
+svgGrain('bn2','0.55',[0.35,0.45,0.28],0.10,51)
+bn;
});
svgApply(TEX.barnacle,'barnacle');

// ── deckWood 艇甲板木纹: 板缝(沿艇长=贴图 x 分板) + 顺纹拉丝 —— 木壳艇/登陆艇甲板 ──
TEX.deckWood=makeTex(128,128,(g,w,h)=>{
g.fillStyle='#fff'; g.fillRect(0,0,w,h);
const n=6, pw=w/n;
for(let i=0;i<n;i++){
g.globalAlpha=rand(.05,.18); g.fillStyle=(i%2)?'#c9c2b2':'#8e8878'; g.fillRect(i*pw,0,pw,h);
g.globalAlpha=.55; g.fillStyle='#3e382e'; g.fillRect(i*pw,0,1.6,h);
}
g.globalAlpha=1;
for(let i=0;i<26;i++){ g.globalAlpha=rand(.06,.20); g.fillStyle='#6f6a5c'; g.fillRect(rand(0,w),0,rand(.6,1.6),h); }
g.globalAlpha=1;
},1,1);
svgReg('deckWood',128,128,()=>{
let pl='';
const n=6, pw=128/n;
for(let i=0;i<n;i++){
pl+=`<rect x="${(i*pw).toFixed(1)}" y="0" width="${pw.toFixed(1)}" height="128" fill="rgb(${randi(150,205)},${randi(146,198)},${randi(132,180)})" opacity="${rand(0.10,0.30).toFixed(2)}"/>`
 +`<rect x="${(i*pw).toFixed(1)}" y="0" width="1.6" height="128" fill="rgb(62,56,46)" opacity="0.55"/>`;
}
return `<rect width="128" height="128" fill="#ffffff"/>`
+svgStreak('dw1','0.45','0.012',[0.62,0.58,0.50],0.85,-0.60,0.26,52)
+svgStreak('dw2','0.30','0.008',[0.75,0.70,0.62],0.80,-0.62,0.16,53)
+pl;
});
svgApply(TEX.deckWood,'deckWood');

// ══════════════════════════════════════════════════════════════════════════════
// 模型翻新批贴图扩展 (2026-09-21B, owner: lead) —— 4 张, **仅追加**, 上方既有条目一行未动。
// 消费方:
//   · steelPlate —— 固定火力点 (17-emplacements 反坦克炮 / 05c 重机枪位) 的钢板件 + 舰船炮塔/艇体
//   · concrete   —— 固定火力点底座/胸墙/混凝土场地 (与 TEX.stone 分档: stone 是砌块, 本张是浇筑面)
//   · canvas     —— 帆布/罩布/伪装网兜布 (炮位罩布、弹药箱盖布)
//   · stencil    —— 舷号/队标/编号喷涂 (载具与炮位侧面的识别标记)
// 口径与既有 22 张一致: **白底相对明度贴图** (材质 color 做乘法决定色相, 均值≈1 不改亮度) ——
//   于是同一张 steelPlate/concrete 能挂到任何涂装上而不串色。
//   stencil 是**例外**: 标记要"比周围亮", 只能把底色压到 0.78 灰、标记留 1.0 白 ⇒ 平方后
//   标记=原涂装色、周围=原色×0.78, 读起来就是"刷上去的编号"(见下方注释)。
// 管线: 只走 makeTex (Canvas2D 即时生成) —— 与既有 6 张海战贴图同规格 (128×128)、同色彩空间,
//   不做 svgReg/svgApply 升级 (那需要为每张写一份 SVG 等价实现; Canvas 版在浏览器与沙箱里是同一份图,
//   反而消除了"两套实现漂移"的风险)。调参只改本段。
// ══════════════════════════════════════════════════════════════════════════════

// ── steelPlate 钢板: 两道横向板缝 + 铆钉列 + 焊接竖痕 (固定火力点/炮塔的钢板件主材质) ──
TEX.steelPlate=makeTex(128,128,(g,w,h)=>{
g.fillStyle='#fff'; g.fillRect(0,0,w,h);
speckle(g,w,h,240,'#d8dad6','#b9bcb6',1,3);                 // 轧制面微斑
const seams=[42,86];
for(const y of seams){
g.fillStyle='rgba(70,74,70,.55)'; g.fillRect(0,y,w,2);       // 板缝
g.fillStyle='rgba(255,255,255,.35)'; g.fillRect(0,y+2,w,1);   // 缝下受光棱
for(let x=6;x<w;x+=13){                                       // 铆钉列 (暗点 + 左上高光)
g.fillStyle='rgba(72,76,72,.75)'; g.beginPath(); g.arc(x,y-4,2.1,0,TAU); g.fill();
g.fillStyle='rgba(255,255,255,.55)'; g.beginPath(); g.arc(x-0.7,y-4.7,0.9,0,TAU); g.fill();
g.fillStyle='rgba(72,76,72,.75)'; g.beginPath(); g.arc(x+6.5,y+6,2.1,0,TAU); g.fill();
g.fillStyle='rgba(255,255,255,.5)'; g.beginPath(); g.arc(x+5.8,y+5.3,0.9,0,TAU); g.fill();
}
}
for(let i=0;i<5;i++){                                          // 焊接/划痕竖痕
const x=rand(0,w);
g.strokeStyle='rgba(96,100,96,.28)'; g.lineWidth=rand(0.7,1.6);
g.beginPath(); g.moveTo(x,rand(0,20)); g.lineTo(x+rand(-2,2),rand(60,128)); g.stroke();
}
},1,1);

// ── concrete 浇筑混凝土: 骨料颗粒 + 模板竖缝 + 细裂纹 (固定火力点底座/场地) ──
TEX.concrete=makeTex(128,128,(g,w,h)=>{
g.fillStyle='#fff'; g.fillRect(0,0,w,h);
speckle(g,w,h,520,'#e2e2df','#c3c3bf',1,3);                   // 水泥浆斑
for(let i=0;i<190;i++){                                        // 骨料 (亮暗各半, 小颗粒)
g.fillStyle=Math.random()<0.5?'rgba(255,255,255,.5)':'rgba(128,128,124,.35)';
const s=rand(1,2.4); g.beginPath(); g.arc(rand(0,w),rand(0,h),s,0,TAU); g.fill();
}
for(let x=0;x<w;x+=32){ g.fillStyle='rgba(122,124,120,.30)'; g.fillRect(x,0,1.4,h); }  // 模板竖缝
for(let i=0;i<6;i++){                                          // 细裂纹 (折线)
g.strokeStyle='rgba(96,96,92,.42)'; g.lineWidth=rand(0.6,1.1);
let x=rand(0,w), y=rand(0,h); g.beginPath(); g.moveTo(x,y);
for(let k=0;k<4;k++){ x+=rand(-9,9); y+=rand(6,16); g.lineTo(x,y); } g.stroke();
}
},1,1);

// ── 2026-09-25 补: MAT.earth / MAT.concrete (05a-buildings 引用了, 但 MAT 表里从来没有定义过这两个键) ──
// 现象: 窑洞前脸/侧墙写 `MAT.earth||MAT.brick`、龙牙三角锥写 `MAT.concrete||MAT.stone`, 两个键都 undefined
//   ⇒ 兜底悄悄生效: 黄土窑洞变成**砖墙**、混凝土龙牙变成**石料** (TEX.concrete 本来就在下面, 是给火力点底座建的)。
// 位置必须在 TEX.concrete 之后 —— 上方 MAT 字面量那一区里 TEX.concrete 还没创建, 写在那里 map 会是 undefined。
// uvRef 在此显式挂 (UV_DENSITY 的挂载循环在上方, 早于本块), 取同一个表: uvRef = 米/张贴图。
MAT.earth=new THREE.MeshLambertMaterial({map:TEX.dirt});
MAT.earth.uvRef=UV_DENSITY.earth;
MAT.concrete=new THREE.MeshLambertMaterial({map:TEX.concrete});
MAT.concrete.uvRef=UV_DENSITY.concrete;

// ── canvas 帆布: 平纹织物经纬 + 两处补丁缝线 (罩布/伪装网兜布) ──
TEX.canvas=makeTex(128,128,(g,w,h)=>{
g.fillStyle='#fff'; g.fillRect(0,0,w,h);
for(let y=0;y<h;y+=3){                                          // 纬线
g.fillStyle=(y/3|0)%2?'rgba(190,190,186,.55)':'rgba(255,255,255,.30)';
g.fillRect(0,y,w,1.5);
}
for(let x=0;x<w;x+=3){                                          // 经线
g.fillStyle=(x/3|0)%2?'rgba(178,178,174,.45)':'rgba(255,255,255,.22)';
g.fillRect(x,0,1.5,h);
}
speckle(g,w,h,120,'#a8a8a4','#e8e8e4',1,3);                     // 织物起毛
for(const p of [[26,30],[92,84]]){                              // 补丁 + 缝线
g.strokeStyle='rgba(120,120,116,.55)'; g.lineWidth=1;
g.strokeRect(p[0],p[1],rand(20,32),rand(16,26));
g.setLineDash([2,2]); g.strokeStyle='rgba(90,90,86,.5)';
g.beginPath(); g.moveTo(p[0]-0.5,p[1]-2.5); g.lineTo(p[0]+22,p[1]-2.5); g.stroke();
g.setLineDash([]);
}
},1,1);

// ── stencil 编号/队标喷涂: 底色 0.78 灰 + 白色数字/五角星 (平方后 = 原色底 + 满色标记) ──
TEX.stencil=makeTex(128,64,(g,w,h)=>{
g.fillStyle='#c7c7c7'; g.fillRect(0,0,w,h);                     // 底色压到 0.78 (见段头注释)
g.fillStyle='#ffffff'; g.font='bold 34px monospace'; g.textBaseline='middle';
g.fillText('7',14,34); g.fillText('A',44,34);                   // 舷号 "7A"
g.beginPath();                                                  // 五角星 (队标)
const cx=100, cy=32, R=15, r=6.2;
for(let i=0;i<10;i++){ const a=-HPI+i*Math.PI/5, rr=(i%2)?r:R;
const px=cx+Math.cos(a)*rr, py=cy+Math.sin(a)*rr; i?g.lineTo(px,py):g.moveTo(px,py); }
g.closePath(); g.fill();
speckle(g,w,h,60,'#b4b4b4','#e0e0e0',1,2);                      // 喷涂颗粒/掉色
},1,1);

// ── WebGL 资源递归释放器与共享材质白名单 (2026-10-07 显存治理) ──
const _SHARED_MATS = (typeof globalThis !== 'undefined' && globalThis._SHARED_MATS) || new WeakSet();
if (typeof globalThis !== 'undefined') globalThis._SHARED_MATS = _SHARED_MATS;

function registerSharedMaterials() {
  if (typeof MAT !== 'undefined') {
    for (const k in MAT) if (MAT[k] && MAT[k].isMaterial) _SHARED_MATS.add(MAT[k]);
  }
  if (typeof uniformMats !== 'undefined' && Array.isArray(uniformMats)) {
    for (const u of uniformMats) {
      if (!u) continue;
      for (const k in u) if (u[k] && u[k].isMaterial) _SHARED_MATS.add(u[k]);
    }
  }
  if (typeof vmMats !== 'undefined') {
    for (const k in vmMats) if (vmMats[k] && vmMats[k].isMaterial) _SHARED_MATS.add(vmMats[k]);
  }
}

function disposeActorHierarchy(obj) {
  if (!obj) return;
  registerSharedMaterials();
  obj.traverse(child => {
    // 1. 释放独占几何体 (共享几何体若有缓存需跳过，普通单位几何体均为独占 new)
    if (child.geometry && typeof child.geometry.dispose === 'function') {
      try { child.geometry.dispose(); } catch(e) {}
    }
    // 2. 释放独占材质与动态贴图
    if (child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of mats) {
        if (!m || typeof m !== 'object') continue;
        if (_SHARED_MATS.has(m)) continue; // ★ 白名单守卫：跳过共享军装与世界材质！
        // 头顶 CanvasTexture 或独占动态贴图必释放
        if (m.map && typeof m.map.dispose === 'function') {
          let isSharedTex = false;
          if (typeof TEX !== 'undefined') {
            for (const tk in TEX) {
              if (TEX[tk] === m.map) { isSharedTex = true; break; }
            }
          }
          if (!isSharedTex) {
            try { m.map.dispose(); } catch(e) {}
          }
        }
        if (typeof m.dispose === 'function') {
          try { m.dispose(); } catch(e) {}
        }
      }
    }
  });
}

if (typeof globalThis !== 'undefined') {
  globalThis.registerSharedMaterials = registerSharedMaterials;
  globalThis.disposeActorHierarchy = disposeActorHierarchy;
}
