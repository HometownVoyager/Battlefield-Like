// ─────────────────────────────────────────────
// 08-effects.js —— 粒子/拖痕/弹壳/烟雾/天气/爆炸特效
// 源: Index.original.html 第 2638-2937 行
// ─────────────────────────────────────────────
'use strict';
function radialTex(inner,outer,stops){
const c=document.createElement('canvas'); c.width=64; c.height=64;
const g=c.getContext('2d');
const gr=g.createRadialGradient(32,32,inner,32,32,outer);
stops.forEach(s=>gr.addColorStop(s[0],s[1]));
g.fillStyle=gr; g.fillRect(0,0,64,64);
return new THREE.CanvasTexture(c);
}
// ★2026-11-19 火焰重做批: 专用火舌贴图 (替代 PT.flash 圆盘当火用)。三段径向渐变沿纵轴堆叠成
// 上窄下宽的泪滴轮廓 (火根最亮/最宽 → 火尖收细上扬), 白芯 —— 塑形归贴图、色带归材质 color
// (spawnFlame/updateParticles 逐帧染), 与 SVG 精修版 (02-scene puffFlame) 同构。
function flameTex(){
const c=document.createElement('canvas'); c.width=64; c.height=64;
const g=c.getContext('2d');
let gr=g.createRadialGradient(32,40,2,32,40,20);   // 火根
gr.addColorStop(0,'rgba(255,255,255,.95)');
gr.addColorStop(0.45,'rgba(255,250,226,.55)');
gr.addColorStop(1,'rgba(255,244,210,0)');
g.fillStyle=gr; g.fillRect(0,0,64,64);
gr=g.createRadialGradient(32,24,1.5,32,24,13);     // 火腹
gr.addColorStop(0,'rgba(255,255,244,.85)');
gr.addColorStop(0.5,'rgba(255,252,232,.45)');
gr.addColorStop(1,'rgba(255,248,218,0)');
g.fillStyle=gr; g.fillRect(0,0,64,64);
gr=g.createRadialGradient(32,11,1,32,11,7);        // 火尖
gr.addColorStop(0,'rgba(255,255,250,.75)');
gr.addColorStop(0.5,'rgba(255,253,240,.35)');
gr.addColorStop(1,'rgba(255,250,225,0)');
g.fillStyle=gr; g.fillRect(0,0,64,64);
return new THREE.CanvasTexture(c);
}
const PT = {
smoke: radialTex(2,30,[[0,'rgba(200,195,185,.85)'],[0.5,'rgba(160,155,145,.4)'],[1,'rgba(150,150,140,0)']]),
dark:  radialTex(2,30,[[0,'rgba(60,55,48,.9)'],[0.5,'rgba(70,64,55,.5)'],[1,'rgba(60,60,55,0)']]),
flash: radialTex(1,30,[[0,'rgba(255,250,220,1)'],[0.25,'rgba(255,190,90,.9)'],[1,'rgba(255,120,30,0)']]),
blood: radialTex(2,26,[[0,'rgba(140,20,12,.95)'],[0.6,'rgba(110,14,8,.5)'],[1,'rgba(90,10,6,0)']]),
dirt:  radialTex(2,28,[[0,'rgba(120,100,70,.95)'],[0.6,'rgba(100,84,58,.5)'],[1,'rgba(90,76,52,0)']]),
spark: radialTex(1,20,[[0,'rgba(255,240,180,1)'],[1,'rgba(255,160,40,0)']]),
drop:  radialTex(2,26,[[0,'rgba(232,246,252,.95)'],[0.5,'rgba(190,222,236,.5)'],[1,'rgba(170,205,225,0)']]),
flame: flameTex(),   // ★2026-11-19 火焰重做批: 舌形火苗贴图 (只 04b/16 火焰 spawnFlame 链消费, PT.flash 保留给枪口焰/爆炸/焦痕)
};
// SVG 精修: 烟/黑烟/尘团改 feTurbulence 位移扰动的蓬松轮廓 (02-scene 生成器, Canvas 径向渐变兜底)
svgApply(PT.smoke,'puffSmoke'); svgApply(PT.dark,'puffDark'); svgApply(PT.dirt,'puffDirt'); svgApply(PT.flame,'puffFlame');   // ★2026-11-19: 火舌 SVG 精修 (feTurbulence 泪滴)
const particles=[];
// ★2026-11-08 性能与画面批: 粒子上限档位化 (原硬编码 280) —— FXMAX_STEPS[fxMaxIdx] (标准280/精简140/增强560),
// applyFxQuality 由 boot 与 22-hud 循环钮调用; 调低时超出部分就地回收进池, 立即生效。
let PARTICLE_MAX=280;
function applyFxQuality(){
PARTICLE_MAX=FXMAX_STEPS[SETTINGS.fxMaxIdx]||280;
while(particles.length>PARTICLE_MAX) recycleP(particles.shift());
}
applyFxQuality();
const pPools=new Map();
function poolKey(tex,additive){ return tex.uuid+(additive?'A':'N'); }
function recycleP(p){
p.sp.visible=false;
pPools.get(p.key).push(p);
}
function spawnP(tex,x,y,z,vx,vy,vz,size,grow,life,opa=1,grav=0,additive=false,spin=0){
if(particles.length>=PARTICLE_MAX){ recycleP(particles.shift()); }
const key=poolKey(tex,additive);
let pool=pPools.get(key);
if(!pool){ pool=[]; pPools.set(key,pool); }
let p=pool.pop();
if(!p){
const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending}));
scene.add(sp);
p={sp,key};
}
p.sp.visible=true;
p.sp.material.opacity=opa;
p.sp.material.rotation=rand(0,TAU);
p.sp.position.set(x,y,z);
p.sp.scale.setScalar(size);
p.vx=vx; p.vy=vy; p.vz=vz; p.grow=grow; p.life=life; p.age=0; p.opa=opa; p.grav=grav; p.spin=spin;
p.ramp=0;   // ★2026-11-19: 火苗附加账每次 spawn 清零 (spawnFlame 随后重写; 池化复用不串样式)
particles.push(p);
return p;   // ★2026-11-19 火焰重做批: 返回池对象 (spawnFlame 写附加账); 既有调用不消费返回值, 零兼容风险
}
// ═══ 火苗粒子 (2026-11-19 火焰重做批, 用户裁定 方案2 贴图+活体/尺寸与现状相近) ═══
// 专用 PT.flame 舌形贴图 + 纵向拉伸(≈2:1) + 双轴异频摇摆 + 生命色带; updateParticles 分支消费。
// 老粒子 (无 ramp) 走原路径逐位不变; 粒子数/预算门 (04b fireFxOK)/上限档全不动 —— 只换长相不换预算。
const FLAME_RAMP=[[1,0.98,0.87],[1,0.79,0.40],[1,0.55,0.17],[0.78,0.26,0.07]];   // 白热→黄→橙→暗红 (age/life 线性采样)
function spawnFlame(x,y,z,vx,vy,vz,size,grow,life,opa,grav){
const p=spawnP(PT.flame,x,y,z,vx,vy,vz,size,grow,life,opa===undefined?0.85:opa,grav===undefined?-1:grav,true);
if(!p) return null;
p.sp.material.rotation=0;   // 舌形朝上, 不吃 spawnP 的随机旋转 (拉伸+摇摆自带方向性)
p.spin=0;
p.stretch=rand(1.7,2.2);    // 纵向拉伸倍率 (随机相位每粒不同, 免"同款火苗"复制感)
p.swayA=rand(0.45,0.95);    // 摇摆振幅 (横漂 m/s 级)
p.swF=rand(5,9);            // 摇摆频率 rad/s (≈0.8-1.4Hz, 与 updateSmokes 火舌 fk 同数量级)
p.swPh=rand(0,TAU);         // 双轴异频相位 (z 轴频率 ×0.83 / 相位 ×1.7 = 扭动)
p.ramp=1;
return p;
}
// 水花 (2026-09-18 塔拉瓦批): 子弹/炮弹/手雷入水与落水冲击 —— 白色水柱 + 飞溅水滴 (纯视觉)
// big=true: 炮弹/载具级入水 (更高更散); bubbles=true 追加水下气泡 (哑火的手雷/沉物)
// ★2026-11-15 入水批: 新增第 5 参 spd (入水速度 m/s, 缺省 0 = 旧调用全兼容) —— 特效规模随
//   "入水速度 × 入水物尺寸(scale)" 双参数变化: 速度抬水柱初速/粒数, 尺寸放大水柱与水雾直径;
//   高速或大物入水追加贴水面外扩的白沫冠层。音频侧把 (scale, spd) 透传给 AudioSys.splash。
function waterSplash(p,scale=1,big=false,bubbles=false,spd=0){
const spdC=clamp(spd,0,25);
const spdF=1+spdC*0.055;                            // 25m/s 顶格 ≈ ×2.4 初速
const n=(big?10:5)+Math.round(spdC*0.4)+(big?3:0);
for(let k=0;k<n;k++){
spawnP(PT.drop,p.x+rand(-0.5,0.5)*scale,p.y+rand(0,0.3),p.z+rand(-0.5,0.5)*scale,
rand(-2.2,2.2)*scale,rand(3.2,7.5)*scale*(big?1.3:1)*spdF,rand(-2.2,2.2)*scale,
rand(0.22,0.5)*scale,0.5,rand(0.5,0.95),0.9,9);
}
spawnP(PT.smoke,p.x,p.y+0.25*scale,p.z,0,1.2*scale*spdF,0,0.7*scale,2.4,rand(0.7,1.1),0.55,0.4);
if(big||spdC>4) for(let k=0;k<3;k++){               // 白沫冠: 贴水面外扩的扁平水雾
spawnP(PT.drop,p.x+rand(-0.6,0.6)*scale,p.y+0.06,p.z+rand(-0.6,0.6)*scale,
rand(-3.4,3.4)*scale,rand(0.4,1.1),rand(-3.4,3.4)*scale,
rand(0.5,0.9)*scale,1.6,rand(0.4,0.7),0.75,4);
}
if(bubbles) for(let k=0;k<7;k++){
spawnP(PT.drop,p.x+rand(-0.5,0.5),p.y+rand(-1.2,-0.2),p.z+rand(-0.5,0.5),
rand(-0.6,0.6),rand(0.8,2.0),rand(-0.6,0.6),rand(0.14,0.3),0.25,rand(0.6,1.2),0.7,-1.2);
}
if(typeof AudioSys!=='undefined'&&AudioSys.splash) AudioSys.splash(p.distanceTo(camera.position),big,clamp(scale,0.5,4),spdC);
}
function updateParticles(dt){
for(let i=particles.length-1;i>=0;i--){
const p=particles[i];
p.age+=dt;
if(p.age>=p.life){ recycleP(p); particles.splice(i,1); continue; }
p.vy-=p.grav*dt;
p.sp.position.x+=p.vx*dt; p.sp.position.y+=p.vy*dt; p.sp.position.z+=p.vz*dt;
const s=p.sp.scale.x+p.grow*dt;
// ★2026-11-19 火焰重做批: 火苗分支 (双轴摇摆/纵向拉伸/生命色带) —— 零分配: 相位读粒子自带账,
//   色带插值读 FLAME_RAMP 静态表, color.setRGB 复用材质既有 Color 对象; 老粒子 (无 ramp) 原路径。
if(p.ramp){
p.sp.position.x+=Math.sin(nowT*p.swF+p.swPh)*p.swayA*dt;
p.sp.position.z+=Math.cos(nowT*p.swF*0.83+p.swPh*1.7)*p.swayA*0.6*dt;
p.sp.scale.set(s,s*p.stretch);
const rf=(p.age/p.life)*(FLAME_RAMP.length-1), ri=Math.min(FLAME_RAMP.length-2,rf|0), ru=rf-ri;
const ra=FLAME_RAMP[ri], rb=FLAME_RAMP[ri+1];
p.sp.material.color.setRGB(ra[0]+(rb[0]-ra[0])*ru,ra[1]+(rb[1]-ra[1])*ru,ra[2]+(rb[2]-ra[2])*ru);
}else{
p.sp.scale.setScalar(s);
}
p.sp.material.rotation+=p.spin*dt;
p.sp.material.opacity=p.opa*(1-p.age/p.life);
}
}
const tracers=[], tracerPool=[];
// ★2026-11-14 批⑥: 曳光截面方→圆 (用户实报"打出的子弹的粒子总是方形"): BoxGeometry 侧影从正后方看
//   永远是 0.035 方块; 改 8 段圆柱 (几何一次 rotateX(HPI) 把圆柱 Y 轴烘到 Z 轴, 配 lookAt 的 +Z 弹道朝向
//   约定), 半径 0.0175 与旧盒半宽一致, 池化 Mesh 复用与 340m/s 步进逻辑不动。
const tracerGeo=new THREE.CylinderGeometry(0.0175,0.0175,1.6,8,1); tracerGeo.rotateX(HPI);
const tracerMat=new THREE.MeshBasicMaterial({color:0xffd890,transparent:true,opacity:0.9,blending:THREE.AdditiveBlending,depthWrite:false,fog:false});
// owner (可选, 2026-09-27M 时停修复批): 这发曳光的射手 —— 决定它在时停里冻住还是照飞。
// 回填它是**零分配**的 (只存引用), 判据单源在 22b 的 specTimeShotDt (owner.isPlayer)。
function spawnTracer(o,dir,dist,owner){
let m=tracerPool.pop();
if(!m){ m=new THREE.Mesh(tracerGeo,tracerMat); scene.add(m); }
m.visible=true;
m.position.copy(o);
m.lookAt(o.x+dir.x,o.y+dir.y,o.z+dir.z);
tracers.push({m,dir:dir.clone(),traveled:0,max:dist,owner:owner||null});
}
function updateTracers(dt,rdt){
const spd=340;
// 逐条按自己的帧长 (2026-09-27M): 时停下 AI 的曳光冻在半空 (战场的"弹道定格"就是这一条给的),
// 玩家自己打出的照飞并按 traveled>=max 回池 —— 旧版 340*0=0 永不回池 ⇒ 每条新弹 new 一个 Mesh
// (审计 P0-2 实测: 120 次开火 ⇒ tracers 0→120, 空闲池 0→0, 线性无上限)。
const SD=(typeof specTimeShotDt==='function')?specTimeShotDt:null;
for(let i=tracers.length-1;i>=0;i--){
const t=tracers[i];
const tdt=SD?SD(t.owner,rdt,dt):dt;
if(!(tdt>0)) continue;
const step=spd*tdt;
t.traveled+=step;
if(t.traveled>=t.max){ t.m.visible=false; tracerPool.push(t.m); tracers.splice(i,1); continue; }
t.m.position.addScaledVector(t.dir,step);
}
}
const casings=[];
const BLOOD_POOL_SIZE=36;
const bloodGeos=[];
const bloodMat=new THREE.MeshLambertMaterial({color:0x6a1810,transparent:true,opacity:0.82,depthWrite:false});
for(let i=0;i<BLOOD_POOL_SIZE;i++){
const bg=new THREE.PlaneGeometry(rand(0.16,0.36),rand(0.14,0.32));
bloodGeos.push({g:bg,m:null,age:0,alive:false});
}
const casingGeo=new THREE.CylinderGeometry(0.011,0.011,0.05,5);
const casingMat=new THREE.MeshBasicMaterial({color:0xc8a850});
function spawnCasing(pos,right,up){
if(casings.length>26){ const c=casings.shift(); scene.remove(c.m); }
const m=new THREE.Mesh(casingGeo,casingMat);
m.position.copy(pos);
m.rotation.set(rand(0,3),rand(0,3),rand(0,3));
scene.add(m);
casings.push({m, vx:right.x*rand(1,2.4)+up.x*rand(1.4,2.4), vy:rand(1.6,2.6), vz:right.z*rand(1,2.4)+up.z*rand(1.4,2.4), rx:rand(-12,12), rz:rand(-12,12), life:0, bounced:false});
}
// 弹壳只有玩家一个来源 (10-viewmodel / 20-player 三处调用点全是玩家视角武器), 所以整条链归玩家:
// 时停下照常抛壳/落地/回收 (走 rdt), 否则弹壳会冻在半空 (26 枚上限内不涨势, 但"打出的东西冻在枪口"
// 的观感与 P0-2 是同一件事)。非时停时 rdt≡dt ⇒ 零行为漂移; 缺第二实参的探针调用同样退化为 dt。
function updateCasings(dt,rdt){
const cdt=(typeof specTimePlayerDt==='function')?specTimePlayerDt(rdt,dt):dt;
if(!(cdt>0)) return;
for(let i=casings.length-1;i>=0;i--){
const c=casings[i];
c.life+=cdt;
if(c.life>4){ scene.remove(c.m); casings.splice(i,1); continue; }
c.vy-=9.8*cdt;
c.m.position.x+=c.vx*cdt; c.m.position.y+=c.vy*cdt; c.m.position.z+=c.vz*cdt;
c.m.rotation.x+=c.rx*cdt; c.m.rotation.z+=c.rz*cdt;
const gh=heightAt(c.m.position.x,c.m.position.z);
if(c.m.position.y<gh+0.02&&c.vy<0){
c.m.position.y=gh+0.02;
c.vy*=-0.3; c.vx*=0.5; c.vz*=0.5; c.rx*=0.4; c.rz*=0.4;
if(!c.bounced){ c.bounced=true; if(c.m.position.distanceTo(camera.position)<8) AudioSys.click(3200,0.08,0.02); }
}
}
}
// ===== 烟雾弹系统: 遮蔽视线(bot同样无法看穿) =====
// 燃烧弹云: 红黑烈焰烟雾, 同样遮蔽视线, 并对云内步兵持续灼烧
const SMOKES=[];
// 并发云上限 (2026-11-11 性能批): 每朵云 12~21 个独立 THREE.Sprite (各自 SpriteMaterial), Sprite 不合批
// ⇒ 每个可见粒子 1 个透明 draw call + 一次独立 uniform 上传, 且完全在 spawnP 的 PARTICLE_MAX 池外。
// 混战期烟雾弹+燃烧弹并存会叠出几十~上百个全尺寸 (scale 3-5m) 透明 draw call + overdraw。
// 超限挤掉最老的云 (与 DEBRIS 96 同"挤旧"口径; 清理与 updateSmokes 自然到期路径逐位同款)。
const SMOKES_MAX=5;
function spawnSmokeCloud(p,incin,thrower){
// 燃烧弹云 9s (2026-09-02 由 12s 缩短): 云散更快, 地面余火由 igniteArea 的 6s 寿命上限收尾
const cloud={x:p.x,y:p.y,z:p.z,t:0,dur:incin?9:16,r:5.5,sprites:[],incin:!!incin,team:thrower?thrower.team:-1,thrower:thrower||null,dmgT:0,seed:rand(0,9)};
const n=incin?14:12;
for(let i=0;i<n;i++){
const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:PT.smoke,transparent:true,opacity:0,depthWrite:false,color:incin?(i%3===0?0x8c2810:0xc8420f):0xc8c8c2}));
sp.position.set(p.x+rand(-2.4,2.4),p.y+rand(0.4,3),p.z+rand(-2.4,2.4));
sp.scale.setScalar(rand(3,5)*(incin?0.85:1));
sp.material.rotation=rand(0,TAU);
scene.add(sp);
cloud.sprites.push({sp,vx:rand(-0.16,0.16),vy:rand(0.05,0.16),vz:rand(-0.16,0.16),rs:rand(-0.15,0.15),g:rand(0.22,0.38)});
}
if(incin){
// 火舌: 云底 additive 火光贴片, 随机闪烁
for(let i=0;i<7;i++){
const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:PT.flame,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,color:0xff9a3c}));   // ★2026-11-19: 圆盘火光→舌形火苗 (白芯贴图+橙染)
sp.position.set(p.x+rand(-2,2),p.y+rand(0.15,0.9),p.z+rand(-2,2));
const w0=rand(1.2,1.8); sp.scale.set(w0,w0*1.6);   // ★2026-11-19: 火舌纵拉 (比例 1.6, updateSmokes 闪烁随动保比)
scene.add(sp);
cloud.sprites.push({sp,flame:true,fk:rand(6,14),ph:rand(0,TAU),vx:0,vy:0,vz:0,rs:0,g:-0.1});
}
crater(p.x,p.z,1.5,true);
AudioSys.explosion('drum',p.distanceTo(camera.position)*1.4,AudioSys.panOf(p)); // 燃烧弹/油料爆档 (★2026-11-15c: 亮 pop)
}
if(SMOKES.length>=SMOKES_MAX){
const old=SMOKES.shift();
for(let si=0;si<old.sprites.length;si++){ const osp=old.sprites[si].sp; scene.remove(osp); osp.material.dispose(); }
}
SMOKES.push(cloud);
if(!incin) AudioSys.metalSlide(0.22,0.5,300,140);
}
function updateSmokes(dt){
for(let i=SMOKES.length-1;i>=0;i--){
const c=SMOKES[i];
c.t+=dt;
const op=0.82*Math.min(clamp(c.t/1.2,0,1),clamp((c.dur-c.t)/3,0,1));
for(const s of c.sprites){
if(s.flame){
// 火舌闪烁: 后半段逐渐熄灭
const fade=clamp((c.dur-c.t)/4,0,1);
s.sp.material.opacity=(0.4+0.3*Math.sin(_fireT*s.fk+s.ph))*fade;   // ★2026-11-21: 相位钟 _fireT 火系战斗钟 (2026-11-05 时停批漏网, 原 nowT 墙钟 ⇒ 时停里照闪)
const w2=s.sp.scale.x+Math.sin(nowT*s.fk*0.7+s.ph)*dt*0.5; s.sp.scale.set(w2,w2*1.6);   // ★2026-11-19: 保纵横比 (spawn 处 1.6 拉伸)
continue;
}
s.sp.position.x+=s.vx*dt; s.sp.position.y+=s.vy*dt; s.sp.position.z+=s.vz*dt;
s.sp.scale.addScalar(s.g*dt);
s.sp.material.rotation+=s.rs*dt;
s.sp.material.opacity=op;
}
// 燃烧弹灼烧: 每0.5s对云内敌方步兵/轻灼坦克 (不误伤队友, 扔到自己头上照样烧)
if(c.incin&&c.t<c.dur-0.5){
c.dmgT-=dt;
if(c.dmgT<=0){
c.dmgT=0.5;
// 点燃地面植被: 云下的草丛/灌木/庄稼起火; 寿命上限 6s 随蔓延继承 (04b-fire FEXPIRE),
// 燃烧弹火系整体提前熄灭, 不再残留长火线 (残骸/树林等自然火不受影响)
if(typeof igniteArea==='function') igniteArea(c.x,c.z,4.8,c.thrower,6);
const wxIncinDmg=(typeof WX_CFG!=='undefined'&&WX_CFG.fireDmgMul!==undefined)?WX_CFG.fireDmgMul:1.0;
const victims=combatants.slice();
for(const s of victims){
// 2026-11-04b 免着火批: 观战者 (调试/自由观战) 不进燃烧弹云受害者表, 不冒火不抖屏
if(!(typeof creatureIgnitable==='function'?creatureIgnitable(s):(s.alive&&!s.spectator))||seatShielded(s)) continue;   // 2026-09-26E 审计 2: 含艇上乘员
if(s.team===c.team&&s!==c.thrower) continue;
const d=Math.hypot(s.pos.x-c.x,(s.pos.y+0.9)-(c.y+0.8),s.pos.z-c.z);
if(d<c.r+0.5){
s.damage(11*wxIncinDmg,c.thrower,false);
if(typeof igniteCreature==='function') igniteCreature(s,c.thrower);
if(s.isPlayer) addTrauma(0.2);
}
}
for(const t of tanks){
if(!t.alive||t.team===c.team) continue;
if(Math.hypot(t.pos.x-c.x,t.pos.z-c.z)<c.r+1.5) t.takeDmg(7*wxIncinDmg,c.thrower);
}
}
}
if(c.t>=c.dur){
for(const s of c.sprites){ scene.remove(s.sp); s.sp.material.dispose(); }
SMOKES.splice(i,1);
}
}
}
function smokeBlocksLOS(ax,ay,az,bx,by,bz){
for(const c of SMOKES){
if(c.t<0.8||c.t>c.dur-1.5) continue;
const dx=bx-ax,dy=by-ay,dz=bz-az;
const L2=dx*dx+dy*dy+dz*dz;
if(L2<1e-6) continue;
let t=((c.x-ax)*dx+(c.y+1.5-ay)*dy+(c.z-az)*dz)/L2;
t=clamp(t,0,1);
const px=ax+dx*t-c.x, py=ay+dy*t-(c.y+1.5), pz=az+dz*t-c.z;
if(px*px+py*py+pz*pz<c.r*c.r) return true;
}
return false;
}
// ===== 天气系统: 雨/雪/阴天/雷暴 =====
let precipObj=null, lightningT=rand(6,14), stormFlash=0;
// ── 雨雪顶面终结 (2026-10-06 用户实机反馈"有房顶的室内也漏雨雪") ──
// 粒子盒原本只认盒底(夹水面)一个终结面, 屋顶/桥面全穿透。现从 BOXES 筛"带可见网格的水平面板"
// (厚度≤1.5m + 最小边≥0.8m + 投影面积≥1.6㎡; addBoxCollider 纯碰撞体无网格不算, 沙袋墙类竖薄件被
// 最小边挡掉), 粒子头部进入其水平投影且低于其顶面 ⇒ 原地回收(x/z 重随机 + 回盒顶, 与落地/落水同款
// 视觉: 雨到顶即消失, 且不产生"卡在屋顶上方"的粒子单向迁移)。屋顶被炸塌=killBox 置 dead ⇒ 自动漏雨;
// 23b 世界还原复活同批盒对象 ⇒ 自动恢复遮挡。每 1s 重扫一次 BOXES, 不挂破坏/还原系统任何钩子。
// 已知边界: 大舰甲板走 15g 独立碰撞(不在 BOXES), 舰面仍穿 —— 与本批之前行为一致, 需要时另批接。
const RAIN_COVERS=[]; let rainCoverT=0;
const _wxCovers=[];   // 本帧短名单: 与相机粒子盒时空相交的顶面 (热路径复用数组)
let _coverAABB={minX:1e9,maxX:-1e9,minZ:1e9,maxZ:-1e9,maxY:-1e9};
// ★2026-11-04b 雨雪跟随批 (用户实报: 时停里雨滴随玩家前进; 二报: "还会随玩家的上升下降而上升下降"):
//   旧版每帧 `precipObj.position.set(camera.x, cam.y-8, camera.z)`, 而粒子坐标是**盒内局部坐标** ⇒
//   整盒雨丝的世界 x/y/z 逐帧跟着相机/巡飞弹/附身镜头平移, 时停 dt=0 冻住下落与回绕后只剩这份平移,
//   于是"雨跟着人走"最明显 (非时停只是被大量粒子运动盖住)。
//   修法 (单源 wxShiftPrecip): 容器仍贴相机 (保证视野里始终有雨、潜水夹水面、顶面遮蔽判据全不变),
//   但每帧把容器的位移量**反向补进所有粒子的局部坐标** ⇒ 世界坐标 = 局部 + 容器 逐位不变,
//   三轴都不再连续跟随; 越出盒体的粒子按既有落地/顶面回收同款周期回绕 (远离盒边的粒子零跳变)。
//   非时停 dt>0 时下落/漂移照常叠加在补偿之上, 雨丝头尾 (相差 0.7m) 必须整段搬否则会被拉成长竖线。
const WX_R=26;
let _wxLastX=null, _wxLastY=null, _wxLastZ=null;
function wxShiftPrecip(dx,dy,dz){
if(!precipObj||(!dx&&!dy&&!dz)) return;
const attr=precipObj.geometry&&precipObj.geometry.attributes&&precipObj.geometry.attributes.position;
if(!attr||!attr.array) return;
const arr=attr.array, span=2*WX_R;
const isRain=!!(precipObj.isLine||precipObj.isLineSegments||(typeof WX_CFG!=='undefined'&&WX_CFG.precip==='rain'));
const hy=isRain?26:24, step=isRain?6:3;
for(let k=0;k<arr.length;k+=step){
let x=arr[k]-dx, y=arr[k+1]-dy, z=arr[k+2]-dz;
// 周期回绕: 只有真正越出盒体的粒子才重入 (盒内粒子世界坐标逐位不动 = 时停里看起来完全冻住)
while(x>WX_R) x-=span; while(x<-WX_R) x+=span;
while(z>WX_R) z-=span; while(z<-WX_R) z+=span;
while(y>hy) y-=hy; while(y<0) y+=hy;
arr[k]=x; arr[k+1]=y; arr[k+2]=z;
if(isRain){ arr[k+3]=x; arr[k+4]=y-0.7; arr[k+5]=z; }   // 雨丝尾端整体随头端搬, 恒定 −0.7m
}
attr.needsUpdate=true;
}
function scanRainCovers(){
RAIN_COVERS.length=0;
_coverAABB.minX=1e9; _coverAABB.maxX=-1e9; _coverAABB.minZ=1e9; _coverAABB.maxZ=-1e9; _coverAABB.maxY=-1e9;
for(let i=0;i<BOXES.length;i++){ const b=BOXES[i];
if(b.dead||!b.mesh) continue;
const dy=b.maxY-b.minY, dx=b.maxX-b.minX, dz=b.maxZ-b.minZ;
if(dy>1.5||dx<0.8||dz<0.8||dx*dz<1.6) continue;
RAIN_COVERS.push(b);
if(b.minX<_coverAABB.minX) _coverAABB.minX=b.minX;
if(b.maxX>_coverAABB.maxX) _coverAABB.maxX=b.maxX;
if(b.minZ<_coverAABB.minZ) _coverAABB.minZ=b.minZ;
if(b.maxZ>_coverAABB.maxZ) _coverAABB.maxZ=b.maxZ;
if(b.maxY>_coverAABB.maxY) _coverAABB.maxY=b.maxY;
}
}
function initWeather(){
if(precipObj){
  try{
    if(precipObj.parent) precipObj.parent.remove(precipObj);
    else if(typeof scene!=='undefined'&&scene) scene.remove(precipObj);
    if(precipObj.geometry&&precipObj.geometry.dispose) precipObj.geometry.dispose();
    if(precipObj.material&&precipObj.material.dispose) precipObj.material.dispose();
  }catch(e){}
  precipObj=null;
}
// 粒子建池参数收编进 WX_CFG (天气设计 §5-3): 种类 precip / 粒数 precipN —— 雨盒 460/720 与雪池 620/370/900 全为既有校准值。
// 2026-11-04b: 重建粒子池 = 上一帧容器位姿归零 (新盒的局部坐标以原点为中心); 旧值残留会让首帧误补一个大位移
_wxLastX=null; _wxLastY=null; _wxLastZ=null;
if(WX_CFG.precip==='rain'){
// 降水密度档 (2026-11-08 性能与画面批): 用户 PRECIP_MUL_STEPS[precipIdx] (1/.5/.25) 乘既有校准粒数 (步进表保证只减不增)
const n=Math.round(WX_CFG.precipN*(PRECIP_MUL_STEPS[SETTINGS.precipIdx]||1));
const geo=new THREE.BufferGeometry();
const pos=new Float32Array(n*6);
for(let i=0;i<n;i++){
const x=rand(-24,24),y=rand(0,26),z=rand(-24,24);
pos[i*6]=x; pos[i*6+1]=y; pos[i*6+2]=z;
pos[i*6+3]=x; pos[i*6+4]=y-0.7; pos[i*6+5]=z;
}
geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
precipObj=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:0x9db4c8,transparent:true,opacity:0.38,fog:false}));
precipObj._isPrecip=true;
precipObj.frustumCulled=false;
scene.add(precipObj);
} else if(WX_CFG.precip==='snow'){
// 降水密度档 (2026-11-08 性能与画面批): 与雨分支同规
const n=Math.round(WX_CFG.precipN*(PRECIP_MUL_STEPS[SETTINGS.precipIdx]||1));
const geo=new THREE.BufferGeometry();
const pos=new Float32Array(n*3);
for(let i=0;i<n;i++){ pos[i*3]=rand(-26,26); pos[i*3+1]=rand(0,24); pos[i*3+2]=rand(-26,26); }
geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
precipObj=new THREE.Points(geo,new THREE.PointsMaterial({color:0xf2f5f8,size:0.16,transparent:true,opacity:0.9,fog:false,sizeAttenuation:true}));
precipObj._isPrecip=true;
precipObj.frustumCulled=false;
scene.add(precipObj);
}
window.__precipObj=precipObj;
if(typeof window.getActivePrecipObj!=='function') window.getActivePrecipObj=()=>precipObj;
// 天气×夜 (昼夜设计 §3.3 顺序钉死): initWeather 在夜档月光/半球系数**之上**再乘天气系数 ——
// ironbottom(overcast×夜) 就是按这条校准的样本。视觉系数收编进 WX_CFG (天气设计 §5-3);
// 晴/中雪档系数=1, 赋值与 02-scene 初值逐位相等 (乘 1 无舍入漂移), 统一赋值无回归 (R1)。
const _nSun=NIGHT_MODE?NIGHT_CFG.sunMul:1, _nHemi=NIGHT_MODE?NIGHT_CFG.hemiMul:1;
sun.intensity=THEME.sunI*_nSun*WX_CFG.sunMul;
hemi.intensity=THEME.hemi[2]*_nHemi*WX_CFG.hemiMul;
sun.castShadow = sunShadowAllowed();
}
function updateWeather(dt){
if(precipObj){
// ★2026-09-26E (审计 38): 雨盒旧版无条件挂在 cam.y−8 —— 潜水时雨丝出现在水下, 菜单冻结期还停在旧相机位置。
//   现在把盒底夹在水面之上 (粒子在盒内 y∈[0,24] 循环, 盒底=水面 ⇒ 雨到水面即消失)。
let pcy=camera.position.y-8;
if(typeof waterYAt==='function'){
const pwy=waterYAt(camera.position.x,camera.position.z);
if(pwy>-1e8&&pcy<pwy-0.5) pcy=pwy-0.5;
}
// ★2026-11-04b 雨雪跟随批: 容器照旧贴相机 (视野覆盖/潜水夹水面/顶面遮蔽判据全不变), 但把本帧容器
//   的三轴位移量反向补进粒子局部坐标 (wxShiftPrecip 单源) ⇒ 粒子的世界坐标逐位不随镜头平移,
//   时停 dt=0 时雨/雪真正冻在空中; 巡飞弹/附身/自由观战换镜头同理。首帧只记录位姿不补偿。
if(_wxLastX===null){ _wxLastX=camera.position.x; _wxLastY=pcy; _wxLastZ=camera.position.z; }
else{
const ddx=camera.position.x-_wxLastX, ddy=pcy-_wxLastY, ddz=camera.position.z-_wxLastZ;
if(ddx||ddy||ddz) wxShiftPrecip(ddx,ddy,ddz);
_wxLastX=camera.position.x; _wxLastY=pcy; _wxLastZ=camera.position.z;
}
precipObj.position.set(camera.position.x,pcy,camera.position.z);
// 顶面短名单 (每帧): 只留"顶面高于盒底"(粒子才可能落到它下面/上面) 且水平投影搭上粒子盒的顶面;
//   盒顶之上的高顶面要保留 —— 大桥/高架下方整片遮蔽本来就是"干的" (物理正确)。
rainCoverT-=dt;
if(rainCoverT<=0){ rainCoverT=1; scanRainCovers(); }
_wxCovers.length=0;
if(RAIN_COVERS.length){
const pwx=precipObj.position.x, pwy=precipObj.position.y, pwz=precipObj.position.z;
for(let k=0;k<RAIN_COVERS.length;k++){ const b=RAIN_COVERS[k];
if(b.dead) continue;                       // 塌顶当帧即漏 (不等 1s 重扫账)
if(b.maxY<=pwy) continue;
if(b.maxX<pwx-26||b.minX>pwx+26||b.maxZ<pwz-26||b.minZ>pwz+26) continue;
_wxCovers.push(b);
}
}
const pos=precipObj.geometry.attributes.position;
const arr=pos.array; // 2026-09-06 B6/P3-10: 直写数组替代逐顶点 getter/setter (粒子量大, 纯热路径)
if(WX_CFG.precip==='snow'){
for(let i=0;i<pos.count;i++){
const i3=i*3;
let y=arr[i3+1]-dt*WX_CFG.precipFall;   // 落速收编 WX_CFG (细雪/中雪 3.2 = 原校准值; 暴风雪 5.5)
let x=arr[i3]+Math.sin(nowT*1.4+i*0.7)*dt*0.9;   // 横向漂移各雪档同规 (吹雪漂移=二期候选, 天气设计 §8⑤)
if(y<0){ y+=24; x=rand(-26,26); arr[i3+2]=rand(-26,26); }
else if(_wxCovers.length){
const wx=x+precipObj.position.x, wz=arr[i3+2]+precipObj.position.z, wy=y+precipObj.position.y;
if(wy<_coverAABB.maxY&&wx>=_coverAABB.minX&&wx<=_coverAABB.maxX&&wz>=_coverAABB.minZ&&wz<=_coverAABB.maxZ){
for(let k=0;k<_wxCovers.length;k++){ const b=_wxCovers[k];
if(wy<b.maxY&&wx>=b.minX&&wx<=b.maxX&&wz>=b.minZ&&wz<=b.maxZ){
y+=24; x=rand(-26,26); arr[i3+2]=rand(-26,26); break;
}
}
}
}
arr[i3+1]=y; arr[i3]=x;
}
} else {
const sp=WX_CFG.precipFall;   // 雨落速收编 (小雨 27 / 暴雨 36 = 原校准值)
for(let i=0;i<pos.count;i+=2){
const i3=i*3;
let y=arr[i3+1]-dt*sp;
if(y<0){
y+=26;
const nx=rand(-24,24),nz=rand(-24,24);
arr[i3]=nx; arr[i3+2]=nz;
arr[i3+3]=nx; arr[i3+5]=nz;
}else if(_wxCovers.length){
const wx=arr[i3]+precipObj.position.x, wz=arr[i3+2]+precipObj.position.z, wy=y+precipObj.position.y;
if(wy<_coverAABB.maxY&&wx>=_coverAABB.minX&&wx<=_coverAABB.maxX&&wz>=_coverAABB.minZ&&wz<=_coverAABB.maxZ){
for(let k=0;k<_wxCovers.length;k++){ const b=_wxCovers[k];
if(wy<b.maxY&&wx>=b.minX&&wx<=b.maxX&&wz>=b.minZ&&wz<=b.maxZ){
y+=26;
const nx=rand(-24,24),nz=rand(-24,24);
arr[i3]=nx; arr[i3+2]=nz;
arr[i3+3]=nx; arr[i3+5]=nz;
break;
}
}
}
}
arr[i3+1]=y; arr[i3+4]=y-0.7;
}
}
pos.needsUpdate=true;
}
// 闪电链: 门=WX_CFG.lightning===true (天气设计 §5-4, R4 落点) —— 只给 storm, 暴风雪/雪族任何档恒不触发
// lightningT/stormFlash 链; 探针判据=verify-weather T5。
if(WX_CFG.lightning===true){
lightningT-=dt;
if(lightningT<=0){
lightningT=rand(7,17);
stormFlash=1;
// 闪电基准同样乘夜档月光系数 (否则雷暴夜一闪把"太阳"拉回 2.6×sunI, 夜档瞬间全亮); 天气系数随档 (storm=0.55)
const _nBase=THEME.sunI*(NIGHT_MODE?NIGHT_CFG.sunMul:1)*WX_CFG.sunMul;
sun.intensity=THEME.sunI*(NIGHT_MODE?NIGHT_CFG.sunMul:1)*2.6;
setTimeout(()=>{ sun.intensity=THEME.sunI*(NIGHT_MODE?NIGHT_CFG.sunMul:1)*1.6; },70);
setTimeout(()=>{ sun.intensity=_nBase; },160);
const dd=rand(90,320);
// ★2026-11-04b 时停音频批: 远雷是墙钟 setTimeout, 时停前排程的那一声会在冻结期间照响 ——
//   触发当刻再看一次时停/静默账 (与 01-audio 的 distantMG/bird 同款闸), 冻住的战场不许打雷。
setTimeout(()=>{ if(typeof specTimeFrozen==='function'&&specTimeFrozen()) return; if(typeof AudioSys!=='undefined'&&AudioSys.isSilenced&&AudioSys.isSilenced()) return; if(gamePaused||menuHold) return; AudioSys.explosion('thunder',dd*0.8); },dd*2.6); // 远雷档 (★2026-11-15c: 天穹闷响) ★2026-11-21: 补 gamePaused||menuHold 两道 (distantMG/bird 既有, 暂停/主菜单里不炸雷)
}
}
if(stormFlash>0){
stormFlash=Math.max(0,stormFlash-dt*3.2);
const ov=el('stormOv');
if(ov) ov.style.opacity=stormFlash*0.5;
}
}
initWeather();

// ══════════════════════════════════════════════════════════════════════════════
// 夜间照明装备 (2026-10-05 昼夜设计 N2, R4: 大灯 / 旗点照明弹 / 探照灯; 夜航灯在 16-aircraft 翼尖)
// 灯池预算红线 (设计 §5): 真 SpotLight ≤ NIGHT_GEAR.headRealN(2)*2 = 每台开灯载具左右灯口各 1 盏;
//   真 PointLight = 枪口(10-viewmodel) + 爆炸(flashLight) + 照明弹 1 盏 ≤ 3。
// 几何一致红线: 所有相位/落点只走 Math.random 系 (rand/randi), 不触碰 wr/wri 布局种子流。
// 白天零回归: 本段入口全部 NIGHT_MODE 门控 (nightGearTick 在 24-main 也已门控), 白天整段不运行。
// ══════════════════════════════════════════════════════════════════════════════
function _nightGlowSprite(colInner,colMid,size){
const c=document.createElement('canvas'); c.width=c.height=32;
const g=c.getContext('2d');
const gr=g.createRadialGradient(16,16,1,16,16,16);
gr.addColorStop(0,colInner); gr.addColorStop(0.4,colMid); gr.addColorStop(1,'rgba(0,0,0,0)');
g.fillStyle=gr; g.fillRect(0,0,32,32);
const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));
sp.scale.set(size,size,1);
return sp;
}
// ── 4.1 车辆大灯: 挂点/构建/开关 (Tank / Truck / NavalCraft 共用; 挂 veh.grp 随车体转动) ──
function vehHeadlightBuild(veh){
if(veh._hl) return veh._hl;
// 挂点按车型: 坦克走 tkSpec 单源 (车体前缘/顶板下), 小艇走 15e 附赠 dims (艏部甲板), 其余兜底盒
let hw=0.85, fz=2.3, ly=0.9;
if(typeof tkSpec==='function'&&veh.def&&veh.def.hullL){
const S=tkSpec(veh.def,veh.def.tk); hw=Math.max(0.5,S.halfW*0.5); fz=S.L/2+0.04; ly=Math.max(0.55,S.roof-0.5);
}else if(veh.dims&&veh.dims.L){
fz=veh.dims.L*0.5-0.15; hw=Math.max(0.5,(veh.dims.W||2)*0.3); ly=(veh.dims.deckY||0.9)+0.45;
}
const grp=new THREE.Group();
const gL=_nightGlowSprite('rgba(255,244,214,1)','rgba(255,226,168,0.6)',1.6); gL.position.set(-hw,ly,fz+0.06);
const gR=_nightGlowSprite('rgba(255,244,214,1)','rgba(255,226,168,0.6)',1.6); gR.position.set(hw,ly,fz+0.06);
// 双立体光锥 (additive): 左右车灯各自向前投射真实光束，紧凑战术档覆盖前方道路
const _headBaseL=(typeof NIGHT_GEAR!=='undefined'&&NIGHT_GEAR.headConeL)?NIGHT_GEAR.headConeL:26;
const coneGeo=new THREE.ConeGeometry(1.8,_headBaseL,14,1,true);
const coneMat=new THREE.MeshBasicMaterial({color:0xffecc4,transparent:true,opacity:0.12,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false});
const coneL=new THREE.Mesh(coneGeo,coneMat);
coneL.rotation.x=-HPI;                       // apex 朝 -z ⇒ 锥顶落在左车灯, 向前方展开
coneL.position.set(-hw,ly-0.2,fz+_headBaseL*0.5);
const coneR=new THREE.Mesh(coneGeo,coneMat);
coneR.rotation.x=-HPI;                       // 锥顶落在右车灯, 向前方展开
coneR.position.set(hw,ly-0.2,fz+_headBaseL*0.5);
grp.add(gL); grp.add(gR); grp.add(coneL); grp.add(coneR);
veh.grp.add(grp);
veh._hl={grp,glow:[gL,gR],cone:coneL,cones:[coneL,coneR],fz,baseL:_headBaseL};
return veh._hl;
}
function vehHeadlightSet(veh,on){
if(!NIGHT_GEAR.headOn) on=false;
if(on&&!veh._hl) vehHeadlightBuild(veh);
if(veh._hl) veh._hl.grp.visible=!!on;
veh.lightsOn=!!on;
}
function vehHeadlightToggle(veh){ const on=!veh.lightsOn; vehHeadlightSet(veh,on); return on; }
// 车毁/沉没即拆灯 (单源; Tank.die / Truck.die / NavalCraft.beginDestroy 都在残骸焦黑化 traverse 之前调用):
// 焦黑化是 `if(o.isMesh) o.material=wreckMat` 的整组换材质 —— 大灯假光锥是 grp 里的 Mesh, 会被一起换成
// 不透明焦黑材质 (观感=残骸上留一个黑色实心锥); 灯口辉光是 Sprite (isMesh=false) 不在换材质之列,
// 会在残骸上留两个发光点。必须在黑化前物理拆灯, lightsOn 一并复位; 重生后的载具按需 vehHeadlightBuild 重建
// (坦克/舰艇的 mat0 还原链见 15-vehicles.respawn / 15d-naval.respawn —— 拆掉的灯组从未进过 mat0 账, 两不相扰)。
function vehHeadlightKill(veh){
veh.lightsOn=false;
if(veh._hl){ if(veh._hl.grp.parent) veh._hl.grp.parent.remove(veh._hl.grp); veh._hl=null; }
}
// 车灯/手电光锥物理防穿墙动态截断 (算法单源: 根据前方遮挡距离实时收缩光锥与光程, 绝不穿透墙壁)
function truncateConeMesh(cone,baseL,occD,fz){
  if(!cone) return;
  if(occD<0.35){
    cone.visible=false;
  }else{
    cone.visible=true;
    const effL=Math.min(baseL,occD);
    const s=clamp(effL/baseL,0.05,1.0);
    cone.scale.set(s,s,s);
    cone.position.z=fz+effL*0.5;
  }
}
// 大灯真灯池 (SpotLight ≤ headRealN*2): 每帧把"离相机最近的开灯载具"按台换上 —— 每台 = 左右灯口
// 各 1 盏 SpotLight (2026-11-01 用户裁定"两盏大灯两道光", 旧版单灯居中只有一道光), 其余载具只留假光锥
const _hlPool=[];
function _hlPoolEnsure(){
  const headRange=(typeof NIGHT_GEAR!=='undefined'&&NIGHT_GEAR.headRange)?NIGHT_GEAR.headRange:52;
  while(_hlPool.length<NIGHT_GEAR.headRealN*2){
    const sl=new THREE.SpotLight(0xffe8ba,0,headRange,0.56,0.55,1.0);
    sl.castShadow=false; sl.visible=false;
    scene.add(sl); scene.add(sl.target);
    _hlPool.push(sl);
  }
}
function _hlWorld(veh,out){
  // 车艏灯世界位: pos + 艏向*fz, 高度 pos.y+ly (与 vehHeadlightBuild 同挂点口径)
  // 挂点参数按车缓存 (2026-11-01 性能批): 挂点是 def/dims 的纯派生量, 旧版每帧重跑 tkSpec
  // (每次调用 Object.assign 两对象 + tb 一对象) —— 夜图灯链每帧每车一次, 热路径零分配军规。
  let a=veh._hlA;
  if(a===undefined){
    a={fz:2.3,ly:0.9,hw:0.85};
    if(typeof tkSpec==='function'&&veh.def&&veh.def.hullL){ const S=tkSpec(veh.def,veh.def.tk); a.fz=S.L/2+0.04; a.ly=Math.max(0.55,S.roof-0.5); a.hw=Math.max(0.5,S.halfW*0.5); }
    else if(veh.dims&&veh.dims.L){ a.fz=veh.dims.L*0.5-0.15; a.ly=(veh.dims.deckY||0.9)+0.45; a.hw=Math.max(0.5,(veh.dims.W||2)*0.3); }
    veh._hlA=a;
  }
  const sn=Math.sin(veh.yaw), cs=Math.cos(veh.yaw);
  out.set(veh.pos.x+sn*a.fz, veh.pos.y+a.ly, veh.pos.z+cs*a.fz);
  return out;
}
// 灯口世界位 (左 side=-1 / 右 side=+1): 艏部中心线点沿**局部右向**偏 ±hw —— 局部 +x 的世界向 =
// (cos(yaw), 0, -sin(yaw)) (与 vehHeadlightBuild 里 glow 左 -hw/右 +hw 同一套挂点口径, 与 15 系模型约定一致)
function _hlLamp(veh,side,out){
  _hlWorld(veh,out);
  const a=veh._hlA, sn=Math.sin(veh.yaw), cs=Math.cos(veh.yaw);
  out.x+=cs*side*a.hw; out.z+=-sn*side*a.hw;
  return out;
}
const _hlP=V3(), _hlT=V3();
// ── 4.2 旗点周期照明弹 (双层立体照明: 高空强光 + 旗点低空环境漫射) ──
const FLARES=[]; let _flaresInit=false;
const _flareLightPool=[];
function _flareLightPoolEnsure(){
  if(!_flareLightPool.length){
    const r=(typeof NIGHT_GEAR!=='undefined'&&NIGHT_GEAR.flareR)?NIGHT_GEAR.flareR:26;
    // 0: 高空照明弹主光源 (覆盖地面, 衰减 1.15)
    const plHigh=new THREE.PointLight(0xfffae8,0,r*2.8,1.15);
    plHigh.castShadow=false; plHigh.visible=false;
    scene.add(plHigh);
    _flareLightPool.push(plHigh);
    // 1: 旗点低空/地面环境漫射光 (挂在旗杆中段离地 3.2m, 真实照亮墙壁、掩体与士兵)
    const plLow=new THREE.PointLight(0xffecd2,0,r*1.05,1.2);
    plLow.castShadow=false; plLow.visible=false;
    scene.add(plLow);
    _flareLightPool.push(plLow);
  }
}
// ── 4.5 火源动态光照池 (常驻 4 盏暖橙色 PointLight, 动态竞选最近火源, 辅以高频有机跳动 flicker) ──
const _fireLightPool=[];
function _ensureFireLightPool(){
  while(_fireLightPool.length<4){
    const pl=new THREE.PointLight(0xff7c24,0,16,1.25);
    pl.castShadow=false;
    pl.visible=false;
    scene.add(pl);
    _fireLightPool.push({
      light:pl,
      seed:Math.random()*100
    });
  }
}
let _flareDiscTex=null;
function _flareDiscTexture(){
  if(_flareDiscTex) return _flareDiscTex;
  const c=document.createElement('canvas'); c.width=c.height=128;
  const g=c.getContext('2d');
  const gr=g.createRadialGradient(64,64,0, 64,64,64);
  gr.addColorStop(0,'rgba(255,246,215,0.7)');
  gr.addColorStop(0.3,'rgba(255,246,215,0.45)');
  gr.addColorStop(0.65,'rgba(255,246,215,0.18)');
  gr.addColorStop(0.9,'rgba(255,246,215,0.04)');
  gr.addColorStop(1,'rgba(255,246,215,0)');
  g.fillStyle=gr;
  g.fillRect(0,0,128,128);
  _flareDiscTex=new THREE.CanvasTexture(c);
  return _flareDiscTex;
}
function _createTerrainFlareDiscGeo(cx,cz,radius,rings=8,segments=28){
  const vertexCount=1+rings*segments;
  const positions=new Float32Array(vertexCount*3);
  const uvs=new Float32Array(vertexCount*2);
  const indices=[];

  const cgy=heightAt(cx,cz);
  const cwy=(typeof waterYAt==='function')?waterYAt(cx,cz):-1e9;
  const ctop=(cwy>-1e8)?Math.max(cgy,cwy):cgy;
  positions[0]=0;
  positions[1]=ctop+0.08;
  positions[2]=0;
  uvs[0]=0.5;
  uvs[1]=0.5;

  for(let r=1;r<=rings;r++){
    const rad=radius*(r/rings);
    for(let s=0;s<segments;s++){
      const theta=(s/segments)*TAU;
      const lx=rad*Math.cos(theta);
      const lz=rad*Math.sin(theta);
      const wx=cx+lx;
      const wz=cz+lz;
      const gy=heightAt(wx,wz);
      const wy=(typeof waterYAt==='function')?waterYAt(wx,wz):-1e9;
      const topY=(wy>-1e8)?Math.max(gy,wy):gy;

      const idx=1+(r-1)*segments+s;
      positions[idx*3]=lx;
      positions[idx*3+1]=topY+0.08;
      positions[idx*3+2]=lz;

      uvs[idx*2]=0.5+0.5*(lx/radius);
      uvs[idx*2+1]=0.5+0.5*(lz/radius);
    }
  }

  for(let s=0;s<segments;s++){
    const next_s=(s+1)%segments;
    indices.push(0,1+next_s,1+s);
  }

  for(let r=1;r<rings;r++){
    const rStartCurr=1+(r-1)*segments;
    const rStartNext=1+r*segments;
    for(let s=0;s<segments;s++){
      const next_s=(s+1)%segments;
      const c1=rStartCurr+s;
      const c2=rStartCurr+next_s;
      const n1=rStartNext+s;
      const n2=rStartNext+next_s;
      indices.push(c1,n2,n1);
      indices.push(c1,c2,n2);
    }
  }

  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geo.setAttribute('uv',new THREE.BufferAttribute(uvs,2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
function nightFlaresInit(){
  _flaresInit=true;
  if(!(GAMEMODE==='conquest'||GAMEMODE==='assault')) return;   // 仅占旗图 (设计 §4.2)
  if(typeof FLAGS==='undefined'||!FLAGS.length) return;
  FLAGS.forEach((f,i)=>{
    FLARES.push({x:f.x,z:f.z,gy:heightAt(f.x,f.z),
      t0:-(i*7.31+Math.random()*NIGHT_GEAR.flarePeriod),      // Math.random 相位: 不进种子 (几何一致红线)
      y:46,lit:0,sp:null,disc:null});
  });
}
function _flareVisual(fl){
  if(!fl.sp){
    fl.sp=_nightGlowSprite('rgba(255,250,232,1)','rgba(255,238,196,0.55)',9);
    fl.sp.material.fog=false;
    scene.add(fl.sp);
    const dg=_createTerrainFlareDiscGeo(fl.x,fl.z,NIGHT_GEAR.flareR,8,28);
    fl.disc=new THREE.Mesh(dg,new THREE.MeshBasicMaterial({
      map:_flareDiscTexture(),
      color:0xffffff,
      transparent:true,
      opacity:0,
      blending:THREE.AdditiveBlending,
      depthWrite:false,
      depthTest:true,
      side:THREE.DoubleSide,
      fog:false
    }));
    fl.disc.position.set(fl.x,0,fl.z);
    scene.add(fl.disc);
  }
}
// 照明弹/探照灯补亮单源: 目标点被照亮的程度 → Bot 索敌 viewD 倍率 (≥1)。14-bots perceive 消费。
function nightLitMul(x,y,z){
  if(!NIGHT_MODE) return 1;
  let m=1;
  for(const fl of FLARES){
    if(fl.lit<=0.05) continue;
    const dx=x-fl.x, dz=z-fl.z;
    if(dx*dx+dz*dz<NIGHT_GEAR.flareR*NIGHT_GEAR.flareR) m=Math.max(m,NIGHT_GEAR.flareLitView);
  }
  return m;
}
// ── 4.3 探照灯: 05a/05a 的静态灯位登记在 SEARCHLIGHTS (00-config), 光柱锥在此惰性构建 ──
const _searchBeams=[];
function _searchVisual(sl){
  if(sl._beam) return;
  const root=new THREE.Group();
  root.position.set(sl.x,sl.y,sl.z);
  root.rotation.order='YXZ';
  const tilt=new THREE.Group();
  const h=NIGHT_GEAR.searchR;
  const cone=new THREE.Mesh(
    new THREE.ConeGeometry(5.2,h,16,1,true),
    new THREE.MeshBasicMaterial({color:0xfff6dc,transparent:true,opacity:0.13,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false}));
  cone.rotation.x=-HPI;            // apex 朝 -z ⇒ 锥顶落在灯位
  cone.position.z=h/2;
  tilt.add(cone);
  root.add(tilt);
  const glow=_nightGlowSprite('rgba(255,250,238,1)','rgba(255,240,200,0.5)',2.6);
  root.add(glow);
  scene.add(root);
  sl._beam={root,tilt,az0:sl.az0!==undefined?sl.az0:Math.random()*TAU,phase:sl.phase!==undefined?sl.phase:Math.random()*TAU};
  _searchBeams.push(sl);
}
const _sDir=V3();
function _searchDir(sl,out){
  const b=sl._beam;
  const az=b.az0+Math.sin(_ngT*0.22+b.phase)*1.05;   // 扫掠: ~14s 一个来回, ±60° (战斗钟 _ngT: 时停冻结, 2026-11-05)
  const el=0.45;
  out.set(Math.sin(az)*Math.cos(el),Math.sin(el),Math.cos(az)*Math.cos(el));
  return az;
}
// 照中玩家判定 (设计 §4.3): 光柱线段扫过玩家 ⇒ 记 _searchLitT, Bot 索敌对玩家 viewD ×searchView 且无视 FOV 门
function _searchHitTick(){
  if(!player||!player.alive||player.spectator) return;
  const px=player.pos.x, py=player.pos.y+1.0, pz=player.pos.z;
  for(const sl of _searchBeams){
    _searchDir(sl,_sDir);
    const ox=sl.x, oy=sl.y, oz=sl.z;
    const wx=px-ox, wy=py-oy, wz=pz-oz;
    const t=wx*_sDir.x+wy*_sDir.y+wz*_sDir.z;
    if(t<3||t>NIGHT_GEAR.searchR) continue;
    const cx=ox+_sDir.x*t-px, cy=oy+_sDir.y*t-py, cz=oz+_sDir.z*t-pz;
    if(cx*cx+cy*cy+cz*cz<NIGHT_GEAR.searchW*NIGHT_GEAR.searchW){ player._searchLitT=nowT; break; }
  }
}
// ── 4.4 步兵战术手电筒: 玩家动态视线聚光灯、环境广角溢光、武器溢光与第一人称立体丁达尔光锥 ──
let _playerFlashlight=null;
function _ensurePlayerFlashlight(){
  if(_playerFlashlight) return _playerFlashlight;
  const flR=(typeof NIGHT_GEAR!=='undefined'&&NIGHT_GEAR.flRange)?NIGHT_GEAR.flRange:35;
  const fl=new THREE.SpotLight(0xfff2d4,0,flR,0.72,0.52,0.75);
  fl.castShadow=false; fl.visible=false;
  scene.add(fl); scene.add(fl.target);
  _playerFlashlight=fl;
  return _playerFlashlight;
}
// 战术手电近景广角溢光 (PointLight 随身挂载, 照亮近距离地面与身侧环境)
let _playerFlSpill=null;
function _ensurePlayerFlashlightSpill(){
  if(_playerFlSpill) return _playerFlSpill;
  const sp=new THREE.PointLight(0xfff0cc,0,14,1.4);
  sp.castShadow=false; sp.visible=false;
  scene.add(sp);
  _playerFlSpill=sp;
  return _playerFlSpill;
}
// 第一人称武器模型侧向溢光 (在独立的 vmScene 中为持枪模型提供真实开灯光感)
let _playerVmFlashlight=null;
function _ensurePlayerVmFlashlight(){
  if(_playerVmFlashlight) return _playerVmFlashlight;
  if(typeof vmScene==='undefined'||!vmScene) return null;
  const vml=new THREE.PointLight(0xffebd0,0,2.2,1.5);
  vml.position.set(0.12,0.06,-0.18);
  vml.visible=false;
  vmScene.add(vml);
  _playerVmFlashlight=vml;
  return _playerVmFlashlight;
}
// 第一人称立体战术光锥 (丁达尔空气微粒光柱, 顶点在发射点, 遇障碍防穿墙, 暴雨水汽强散射)
let _playerFlCone=null;
function _ensurePlayerFlashlightCone(){
  if(_playerFlCone) return _playerFlCone;
  const baseL=(typeof NIGHT_GEAR!=='undefined'&&NIGHT_GEAR.flConeL)?NIGHT_GEAR.flConeL:22;
  // ConeGeometry 沿 Y 轴创建: radius=2.2, height=baseL
  const coneGeo=new THREE.ConeGeometry(2.2,baseL,20,1,true);
  // 把锥顶 apex 移到原点 (0,0,0), 底面移到 -Y 轴:
  coneGeo.translate(0,-baseL*0.5,0);
  // 绕 X 轴旋转 90 度让 -Y 轴精确对齐到 -Z 轴 (相机的正前方向):
  coneGeo.rotateX(Math.PI*0.5);
  const coneMat=new THREE.MeshBasicMaterial({
    color:0xfff4dc,
    transparent:true,
    opacity:0.055,
    blending:THREE.AdditiveBlending,
    depthWrite:false,
    side:THREE.DoubleSide,
    fog:false
  });
  const m=new THREE.Mesh(coneGeo,coneMat);
  m.visible=false;
  scene.add(m);
  _playerFlCone=m;
  return _playerFlCone;
}
// 历史接口空桩 (彻底移除地面平面光斑网格, 保持向后兼容安全)
function _ensureFlSpotMesh(){ return { visible:false, position:V3(), scale:V3(), material:{ opacity:0 } }; }
const _ensureFlSpotSprite=_ensureFlSpotMesh;
// ── 夜间链热路径收敛 (2026-10-24 性能排查批) ──
// ① 手电起点复用槽: 旧版 eye.clone().add(...).add(V3()) 每帧 3 个新向量 (热循环零分配军规);
// ② 大灯候选表/比较器模块级: 旧版每帧新建 cands 数组 + _camDistSq 闭包 + 比较器闭包 (夜/雨图常态运行);
// ③ 距离平方入表时算一次 (_hlD2), 排序与 75m 光锥截断门直接读缓存值, 不再在比较器里反复开方重算。
const _pfO=V3();
const _pfF=V3(), _pfR=V3();   // 手电 tick 的 forward/right 复用槽 (2026-11-01): camForward() 无 out 参返回 clone
const _hlCands=[];
const _hlCmp=(a,b)=>a._d2-b._d2;
function _hlD2(v){ const p=v.pos, cp=camera.position; const dx=p.x-cp.x, dy=p.y-cp.y, dz=p.z-cp.z; return dx*dx+dy*dy+dz*dz; }
function playerFlashlightTick(dt){
  const fl=_ensurePlayerFlashlight();
  const spill=_ensurePlayerFlashlightSpill();
  const vml=_ensurePlayerVmFlashlight();
  const cone=_ensurePlayerFlashlightCone();
  // ★2026-11-05 调试模式装备批 (用户实报"人身上没有手电筒和L键相关内容"): 旧版此处把 player.spectator
  //   一并排除 ⇒ 调试模式 (spectator=true 但 alive, 是正常作战单位) 永远无手电。判据改为 alive 单门 ——
  //   票尽真观战 (specView) alive=false 天然排除; 调试观战活着, 与普通士兵同装备 (L 键同链)。
  const on=!!(player&&player.alive&&!player.onVehicle&&!player.onNaval&&player.flashlight);
  if(on){
    const tp=(typeof thirdPersonOn==='function'&&thirdPersonOn());
    // ★2026-11-05 实机反馈批 (用户实报"巡飞弹背视角下, 光柱保持在第一人称的相对位置"): 正在操控巡飞弹
    //   且处于 F 背追档 (loiterView) 时, 手电整链 (真 SpotLight/近景溢光/丁达尔光柱) **锚到弹体本身** ——
    //   起点=弹体, 朝向=弹鼻。TV 弹头档相机就钉在弹体上, 维持相机锚 (第一人称观感不变)。旧版不分档
    //   全按相机锚 ⇒ 背追机位拉到弹体后上方, 光柱悬在相机前 (起点/朝向都不随弹体, 用户截图为证)。
    const lt=(player.loiter&&!player.loiter.dead)?player.loiter:null;
    const ltBack=!!(lt&&player.loiterView);
    let fwd,eye;
    if(ltBack){ fwd=_pfF.copy(loiterForward(lt)); eye=lt.pos; }   // loiterForward 返回共享槽 _loF: 立即拷入本 tick 槽, 不跨帧持有
    else{ fwd=camForward(_pfF); eye=camera.position; }
    const right=camRight(_pfR);
    const flR=(typeof NIGHT_GEAR!=='undefined'&&NIGHT_GEAR.flRange)?NIGHT_GEAR.flRange:35;
    const baseL=(typeof NIGHT_GEAR!=='undefined'&&NIGHT_GEAR.flConeL)?NIGHT_GEAR.flConeL:22;

    // 物理障碍检测 (raycastWorld)
    const hit=raycastWorld(eye,fwd,flR);
    const occD=hit?hit.dist:flR;

    // 手电光源起点与朝向 (从持枪右胸/武器导轨处投射) — 复用槽零分配 (2026-10-24)
    const o=_pfO.copy(eye);
    if(ltBack){ o.addScaledVector(fwd,0.4); }   // 弹鼻光学头罩前方起光 (光柱起点=弹体本身)
    else{ o.addScaledVector(fwd,0.25).addScaledVector(right,0.12); o.y-=0.1; }
    fl.position.copy(o);
    fl.target.position.copy(eye).addScaledVector(fwd,Math.max(1,occD));
    fl.target.updateMatrixWorld();

    // 关键修复: 仅当正前方撞到实体墙体/障碍物 (kind!=='ground') 时才动态截断光照, 地面是开阔受光面不掐断 distance
    if(hit&&hit.kind!=='ground'&&occD<flR){
      fl.distance=Math.max(2.5,Math.min(flR,occD+0.45));
    }else{
      fl.distance=flR;
    }

    // 曝光自适应补偿: 暴雨夜 (~0.34 曝光) 调柔至 ~47 (调降约40%, 柔和清晰杜绝近距惨白过曝)
    const expo=(typeof renderer!=='undefined'&&renderer.toneMappingExposure)?renderer.toneMappingExposure:1.0;
    const compIntensity=clamp(16/Math.max(0.20,expo),20,48);
    const isCloseWall=!!(hit&&hit.kind!=='ground'&&occD<1.4);
    fl.intensity=isCloseWall?clamp(occD*18,6,compIntensity):compIntensity;
    fl.angle=0.72;
    fl.penumbra=0.52;
    fl.decay=1.1;
    fl.visible=true;

    // 近景广角溢光更新 (跟随发射点前移 0.7m, 适度柔和微光照亮身边地面与掩体)
    if(spill){
      spill.position.copy(o).addScaledVector(fwd,0.7);
      spill.intensity=compIntensity*0.13;
      spill.visible=true;
    }

    // 第一人称武器模型侧向溢光联动 (微调至0.85, 真实柔和金属泛光)
    if(vml){
      vml.intensity=0.85;
      vml.visible=!tp&&!lt;   // 制导中整个 viewmodel 都是隐的 (VM.root.visible=false), vm 灯同步熄 (2026-11-05 批)
    }

    // 第一人称立体空气光柱: 第一人称下显示, 遇前方障碍平滑收缩防穿墙 (2026-10-10: 复用上面 hit 结果, 避免重复发射世界射线)
    if(!tp&&cone){
      const coneD=(hit&&hit.dist<baseL)?hit.dist:baseL;
      const effL=Math.max(0.3,Math.min(baseL,coneD));
      // 水汽米氏散射: 暴雨或雨雾天丁达尔光束调至0.075 (清澈自然不泛白刺眼), 晴天保持0.038柔和微光
      const isWetWx=(typeof WX_CFG!=='undefined')&&(WX_CFG.precip==='rain'||(WX_CFG.fogDim||1)<0.7);
      if(cone.material) cone.material.opacity=isWetWx?0.075:0.038;
      cone.position.copy(o);
      if(ltBack){
        cone.rotation.order='YXZ';
        cone.rotation.set(lt.pitch,lt.yaw,0);   // 光柱随弹体姿态 (锥体绕光轴旋转对称, roll 恒 0; 2026-11-05 批)
      }else{
        cone.quaternion.copy(camera.quaternion);
      }
      const s=clamp(effL/baseL,0.05,1.0);
      cone.scale.set(s,s,effL/baseL);
      cone.visible=true;
    }else if(cone){
      cone.visible=false;
    }
  }else{
    if(fl&&fl.visible){ fl.intensity=0; fl.visible=false; }
    if(spill&&spill.visible){ spill.intensity=0; spill.visible=false; }
    if(vml&&vml.visible){ vml.intensity=0; vml.visible=false; }
    if(cone&&cone.visible) cone.visible=false;
  }
}
// 手电四件套"还亮着"记忆位 (2026-11-16 时停关灯修复): 24-main 的 nightGearTick 唤醒门全是"开侧"条件
// (flashlight 开 / 暗环境 / 载具大灯开), 没有任何"灯还亮着"的记忆 —— 时停期间按 L 关灯的那一帧起
// 门塌 false ⇒ tick 整个被断粮, else 收灯分支永远执行不到 ⇒ 光锥/真光源/溢光停在最后一次 tick 的位姿
// ("就地停留不再跟随"), 时停结束后门依旧 false ⇒ 永久停留。此谓词读四件套真实可见态, 24-main 唤醒门
// 并上它之后, 关灯后至少还能跑到一帧 tick 把灯收掉 (时停里 dt=0 照收, 时停结束后同样收干净)。
// 注意不调 _ensure* (惰性建灯): 未点亮时四件套可能还没建, 直接读模块级引用, 不为查状态凭空造灯。
function nightGearLightsOn(){
  return !!((_playerFlashlight&&_playerFlashlight.visible)
    ||(_playerFlSpill&&_playerFlSpill.visible)
    ||(_playerFlCone&&_playerFlCone.visible));
}
// ── 每帧总入口 (24-main, 暗光或照明开启时运行) ──
// 夜战装备**战斗钟** (2026-11-05 时停照明弹批): 本段一切相位/扫掠只吃这里的世界帧长 —— 时停 dt=0 ⇒
// 照明弹缓降/飘移与探照灯扫掠整段冻结, 指挥减速 ×0.2 ⇒ 同步慢放。旧版直接读 nowT (24-main 的墙钟表盘,
// 时停管道实际并不冻结它 —— 24-main nowOff 记账为秒、nowT 表盘为毫秒, 差 1000 倍 ⇒ nowT 照走), 于是
// 战场全冻而旗点照明弹照常升空 (用户实报 2026-11-05)。_ngT 只在 nightGearTick 内推进, 不与 nowT 混用。
let _ngT=0;
function nightGearTick(dt){
_ngT+=dt;
playerFlashlightTick(dt);
const isDark=(typeof isDarkEnvironment==='function')?isDarkEnvironment():NIGHT_MODE;
// 大灯: AI 状态机 (行进开灯 / 交战关灯, 设计 §4.1) + 玩家车不代管 (L 键自管)
_hlCands.length=0;
const cands=_hlCands;   // 模块级复用表 (2026-10-24): 夜/雨图每帧跑, 不再逐帧新建数组
for(const t of tanks){
if(!t.alive) continue;
if(t.isAI&&!t.playerDriven){
const engaged=!!(t.tTarget&&t.tMemT>0);
const want=isDark&&!engaged;
if(!!t.lightsOn!==want) vehHeadlightSet(t,want);
}
if(t.lightsOn){ t._d2=_hlD2(t); cands.push(t); }
}
for(const tk of trucks){
if(!tk.alive||tk.sunk) continue;
if(isDark&&!tk.lightsOn) vehHeadlightSet(tk,true);   // 劫道车队夜行常亮 (目标可循, 也暴露)
if(tk.lightsOn){ tk._d2=_hlD2(tk); cands.push(tk); }
}
if(typeof navalCraft!=='undefined') for(const b of navalCraft){
if(!b.alive||b.state!=='run') { if(b.lightsOn) vehHeadlightSet(b,false); continue; }
if(isDark&&b.isAI&&!b.playerDriven&&!b.lightsOn) vehHeadlightSet(b,true);
if(b.lightsOn){ b._d2=_hlD2(b); cands.push(b); }
}
// 幽灵坦克 (15c 单例, 不在 tanks/trucks/navalCraft 任何一张表里): 调试模式唯一能开的"坦克"。
// ★2026-11-05 用户实报"坦克上的大灯没有实际效果"病根 —— 旧版大灯候选/真灯池竞选/假光锥防穿墙
// 三段全都扫不到它, 按 L 只亮假光锥, 真 SpotLight 永远轮不到 ⇒ 地面照不亮。收车 (SPECVEH=null)
// 自动退出; alive 门对齐其它载具; isAI=false 天然不吃上面 AI 状态机 (L 键自管口径不变)。
if(typeof SPECVEH!=='undefined'&&SPECVEH&&SPECVEH.alive&&SPECVEH.lightsOn){ SPECVEH._d2=_hlD2(SPECVEH); cands.push(SPECVEH); }
// 假光锥防穿墙与真灯池竞选: 离相机最近的开灯载具 (≤headRealN), 其余假光锥
_hlPoolEnsure();
if(cands.length>1) cands.sort(_hlCmp);
const headR=Math.max(40, (typeof NIGHT_GEAR!=='undefined'&&NIGHT_GEAR.headRange)?NIGHT_GEAR.headRange:36);
const headConeL=Math.max(28, (typeof NIGHT_GEAR!=='undefined'&&NIGHT_GEAR.headConeL)?NIGHT_GEAR.headConeL:26);
// 遍历所有开灯载具, 靠近相机的做车前防穿墙截断 (2026-10-10: 引入 0.12s 节流与前2辆限制, 消除多车并发 raycastWorld)
for(let ci=0;ci<cands.length;ci++){
  const v=cands[ci];
  if(!v._hl) continue;
  if(v._d2>75*75) continue;
  v._hlRayT = (v._hlRayT || 0) - dt;
  if(ci < 2 && v._hlRayT <= 0){
    v._hlRayT = 0.12;
    _hlWorld(v,_hlP);
    const sn=Math.sin(v.yaw), cs=Math.cos(v.yaw);
    _hlT.set(sn,0,cs);
    const hit=raycastWorld(_hlP,_hlT,headConeL);
    v._hlOccD = hit?hit.dist:headConeL;
  }
  const occD=(v._hlOccD!==undefined)?v._hlOccD:headConeL;
  if(v._hl.cones){
    for(let j=0;j<v._hl.cones.length;j++) truncateConeMesh(v._hl.cones[j],v._hl.baseL||headConeL,occD,v._hl.fz||2.3);
  }
}
const expo=(typeof renderer!=='undefined'&&renderer.toneMappingExposure)?renderer.toneMappingExposure:1.0;
// 坦克大灯自适应补光: 暗光暴雨下 (~0.34 曝光) 补偿至 ~15.5 (约原版 4.2 的 3.7 倍, 照亮道路但不刺眼, 遵从用户"提升小一点"裁定)
const headComp=clamp(5.2/Math.max(0.20,expo),6.5,16);
// 真灯滞回 (2026-10-24 性能排查批): headRealR(60m) 内上真灯、+15m 缓冲带外才下 —— 旧版硬门下载具贴着
// 竞选半径行驶时灯可见性每秒多次翻转, 每次翻转全场材质按新灯态重选 program (数百次 getProgram 查表)
// + GPU 每片元光环数变化, 是夜/雨图的周期性微卡顿源。滞回后翻转只发生在 15m 宽的缓冲带外缘一次。
const _rEng2=NIGHT_GEAR.headRealR*NIGHT_GEAR.headRealR;
const _rHold2=(NIGHT_GEAR.headRealR+15)*(NIGHT_GEAR.headRealR+15);
// 按台竞选 (rig i = cands[i] ⇔ 池位 i*2 左灯 + i*2+1 右灯): 滞回章仍盖在车上 (_hlReal), 上下灯
// 永远成对 —— 旧版单灯居中的"一道光"即此循环按单车 1 盏分配所致 (2026-11-01 用户裁定两灯两道光)。
for(let i=0;i<_hlPool.length;i+=2){
  const v=cands[i>>1];
  const slL=_hlPool[i], slR=_hlPool[i+1];
  let lit=false;
  if(v){
    if(v._hlReal===undefined) v._hlReal=false;
    if(!v._hlReal&&v._d2<_rEng2) v._hlReal=true;
    else if(v._hlReal&&v._d2>_rHold2) v._hlReal=false;
    if(v._hlReal){
      const sn=Math.sin(v.yaw), cs=Math.cos(v.yaw);
      const occD=(v._hlOccD!==undefined)?v._hlOccD:headConeL;
      const aim=Math.max(1,occD);
      // 单灯减亮 0.75×: 左右双灯近场叠照 ≈ 旧单灯 1.5× (总亮随用户"照明范围略小"上调, 但不冲爆曝光补偿标定)
      const inten=occD<0.6?Math.max(2.0,headComp*0.26):headComp*0.75;
      const dist=Math.min(headR,occD+0.45); // 动态截断真大灯光照, 杜绝透墙照亮背后房间
      for(let s2=0;s2<2;s2++){
        const sl=s2===0?slL:slR;
        _hlLamp(v,s2===0?-1:1,_hlP);
        sl.position.copy(_hlP);
        // 瞄点 = 灯口自身沿艏向前推 aim ⇒ 左右两道**平行**光束 (旧版单灯同式)
        sl.target.position.set(_hlP.x+sn*aim, v.pos.y+0.3, _hlP.z+cs*aim);
        sl.target.updateMatrixWorld();
        sl.distance=dist; sl.intensity=inten; sl.visible=true;
      }
      lit=true;
    }
  }
  if(!lit){
    slL.intensity=0; slL.visible=false;
    slR.intensity=0; slR.visible=false;
  }
}
// 照明弹 (双层立体照明: 高空主光强覆盖 + 旗点低空环境漫射)
// ★2026-11-05 isDark 门 (随 24-main 门放宽新增): 大灯 L 键现在能把本 tick 在**晴天白天**也拉起来
//   (调试模式幽灵坦克大灯), 照明弹/探照灯是暗光装备, 亮环境一律不建不跑 —— 否则晴天开一次车灯,
//   旗点上空就凭空升起照明弹。雨昼 (isDarkEnvironment 命中) 行为与旧版逐位一致。
let bestFlare=null,bestD=1e9;   // 亮环境不进循环 ⇒ 恒 null ⇒ 下方灯池走全灭分支 (isDark 门外仍要可见)
if(isDark){
if(!_flaresInit) nightFlaresInit();
for(const fl of FLARES){
const p=((_ngT-fl.t0)%NIGHT_GEAR.flarePeriod+NIGHT_GEAR.flarePeriod)%NIGHT_GEAR.flarePeriod;
if(p<NIGHT_GEAR.flareBurn){
if(!fl.sp) _flareVisual(fl);
fl.y=55-p*1.1;                                   // 缓降 55→46
const rise=Math.min(1,p/0.6), fall=Math.min(1,(NIGHT_GEAR.flareBurn-p)/0.8);
fl.lit=Math.min(rise,fall);
const drift=Math.sin(_ngT*0.35+fl.x)*1.2;        // 战斗钟: 时停里飘移同样冻结 (2026-11-05)
fl.sp.visible=true;
fl.sp.position.set(fl.x+drift,fl.y,fl.z);
fl.sp.material.opacity=0.85*fl.lit;
fl.sp.scale.set(9+2*(1-fl.lit),9+2*(1-fl.lit),1);
fl.disc.visible=true;
fl.disc.position.set(fl.x,0,fl.z);
fl.disc.material.opacity=0.22*fl.lit;
const d2=(fl.x-camera.position.x)**2+(fl.z-camera.position.z)**2;
if(d2<bestD){ bestD=d2; bestFlare=fl; }
}else if(fl.lit>0||fl.sp&&fl.sp.visible){
fl.lit=0; if(fl.sp) fl.sp.visible=false; if(fl.disc) fl.disc.visible=false;
}
}
}   // isDark (照明弹段)
_flareLightPoolEnsure();
const flHigh=_flareLightPool[0];
const flLow=_flareLightPool[1];
if(bestFlare&&bestFlare.lit>0.05){
  // 高空照明弹照度自适应补光 (2026-10-10 调优: 暴雨夜 ~10.5, 晴夜 ~4.2, 柔和照亮地面与建筑, 消除刺眼大灯过曝)
  const flareHighComp=clamp(4.2/Math.max(0.20,expo),3.8,11.0);
  flHigh.position.set(bestFlare.x,bestFlare.y-0.5,bestFlare.z);
  flHigh.intensity=flareHighComp*bestFlare.lit;
  flHigh.visible=true;

  // 旗点低空环境漫射光 (挂在旗点地面上方 3.2m, 柔和漫射旗点周围沙袋与工事, 消除近距离惨白反光)
  const gy=(bestFlare.gy!==undefined)?bestFlare.gy:(typeof heightAt==='function'?heightAt(bestFlare.x,bestFlare.z):0);
  const flareLowComp=clamp(1.2/Math.max(0.20,expo),1.0,3.2);
  flLow.position.set(bestFlare.x,gy+3.2,bestFlare.z);
  flLow.intensity=flareLowComp*bestFlare.lit;
  flLow.visible=true;
}else{
  if(flHigh&&flHigh.visible){ flHigh.intensity=0; flHigh.visible=false; }
  if(flLow&&flLow.visible){ flLow.intensity=0; flLow.visible=false; }
}
// 探照灯
for(const sl of SEARCHLIGHTS) _searchVisual(sl);
for(const sl of _searchBeams){
const az=_searchDir(sl,_sDir);
sl._beam.root.rotation.y=az;
sl._beam.tilt.rotation.x=-0.45;
}
_searchHitTick();
// 火源动态光照联动
updateFireLights(dt);
}

// ── 4.5 火源动态光照更新 (4 盏动态点光源 + 自然 flicker 闪烁跳动) ──
// 2026-10-24 性能排查批重写候选链:
//   ① 候选收集+排序 0.2s 一轮 —— 火源 (残骸/云团/火格) 位置全部静态, 每帧重收重排是纯浪费;
//   ② 灯位分配滞回 85m 进 / 110m 出 —— 旧版 85m 硬门下玩家贴边移动时灯可见性反复翻转,
//      每次翻转全场材质按新灯态重选 program (数百次 getProgram 查表), 是暗光图的周期性微卡顿源;
//   ③ 分配槽 _fireAssign 持久化, 每帧只做 flicker 抖动与位置贴随 —— 零分配零排序;
//   ④ 白天压制激活数 (2026-10-10 裁定) 与双入口去重守卫原样保留。
const _fireAssign=[null,null,null,null];
let _fireScanT=0;
let _fireT=0;   // flicker 相位钟 (2026-11-05 时停批: 旧读 nowT 墙钟 ⇒ 时停里火光照跳)
// 扫描账复用 (2026-11-01 性能批): 0.2s 一轮的候选表/比较器/占位查重提到模块级 —— 候选对象本就 5Hz 短命,
// 但每轮 new Set + 内联比较器闭包是纯账目垃圾, 复用后零分配 (占位查重走 _fireTaken 线性 ≤4 项)。
const _fireFresh=[];
const _fireCmp=(a,b)=>(a.distSq/(a.weight*a.weight))-(b.distSq/(b.weight*b.weight));
function _fireTaken(key){
  for(let i=0;i<_fireAssign.length;i++){ const c=_fireAssign[i]; if(c&&(c.src||c.ci)===key) return true; }
  return false;
}
function _fireCandAlive(c){
  if(c.kind==='smoke') return typeof SMOKES!=='undefined'&&SMOKES.indexOf(c.src)>=0&&c.src.incin&&c.src.t<c.src.dur-0.5;
  // ★2026-11-28 修 (用户实报"上一局油桶的火焰光残留"): 'fs' 候选必须仍**在 FIRE_SOURCES 活账里**才算活 ——
  //   旧判据只看 src.ttl>0, 而换局 clearMatchEffects 是 FIRE_SOURCES.length=0 整表清账, 旧火源**对象**的 ttl
  //   从此冻结不再递减 (没人 tick 它了) ⇒ 分配槽里的旧候选被判"永远活着", 灯池在新局重建后被旧候选占位,
  //   上一局的火光原位常亮 (smoke/cell 两档本就有成员资格检查, 唯 fs 漏配对)。indexOf 才是真活判据。
  if(c.kind==='fs') return typeof FIRE_SOURCES!=='undefined'&&FIRE_SOURCES.indexOf(c.src)>=0&&c.src.ttl>0;
  return typeof FIRE_ACTIVE!=='undefined'&&FIRE_ACTIVE.indexOf(c.ci)>=0;
}
// 活取候选当前位置 (候选只存 src 引用不烤死坐标 —— addFireSource 的 follow 源随舰航行,
// 每帧在 updateFires 里被重投影; 快照坐标会让灯钉死在旧海面上, 04b "船开走火浮空"同病)
const _fireP={x:0,y:0,z:0};
function _firePos(c){
  if(c.kind==='smoke'){ _fireP.x=c.src.x; _fireP.y=c.src.y+0.6; _fireP.z=c.src.z; }
  else if(c.kind==='fs'){ _fireP.x=c.src.x; _fireP.y=c.src.y+0.4; _fireP.z=c.src.z; }
  else{
    const cx=(c.ci%FN)*FRES-FOFF+FRES/2, cz=Math.floor(c.ci/FN)*FRES-FOFF+FRES/2;
    const gy=(typeof heightAt==='function')?heightAt(cx,cz):0;
    _fireP.x=cx; _fireP.y=gy+0.6; _fireP.z=cz;
  }
  return _fireP;
}
function updateFireLights(dt){
  // 防单帧内重复执行 (2026-10-10: 消除 08-effects 与 04b-fire 双入口一帧跑两次浪费)
  if(typeof nowT==='number'&&updateFireLights._lastT===nowT) return;
  updateFireLights._lastT = nowT;
  _fireT+=dt;   // 火光跳动战斗钟 (2026-11-05): 时停 dt=0 ⇒ 冻结; 两入口各帧经上方去重只累一次
  _ensureFireLightPool();
  if(!camera) return;
  const camP=camera.position;
  const isDark=(typeof isDarkEnvironment==='function')?isDarkEnvironment():NIGHT_MODE;
  const maxActiveLights=(isDark?2:1);   // 渲染优化 (2026-10-10): 强日光下火源点光被阳光淹没, 压制激活数
  // ── 0.2s 一轮的分配扫描: 验旧 (110m 滞回出槽) → 收新 (85m 入槽) → 按综合分数补空槽 ──
  _fireScanT-=dt;
  if(_fireScanT<=0){
    _fireScanT=0.2;
    const HOLD2=110*110, ENG2=85*85;
    for(let i=0;i<_fireAssign.length;i++){
      const c=_fireAssign[i];
      if(c){
        const p=_firePos(c);
        const dx=p.x-camP.x, dz=p.z-camP.z;
        if(!_fireCandAlive(c)||dx*dx+dz*dz>HOLD2) _fireAssign[i]=null;
      }
    }
    const fresh=_fireFresh; fresh.length=0;
    if(typeof SMOKES!=='undefined'){
      for(let i=0;i<SMOKES.length;i++){
        const sm=SMOKES[i];
        if(!sm.incin||sm.t>=sm.dur-0.5) continue;
        const dx=sm.x-camP.x, dz=sm.z-camP.z, d2=dx*dx+dz*dz;
        if(d2<ENG2) fresh.push({kind:'smoke',src:sm,distSq:d2,range:16,intensity:22,color:0xff7c24,weight:12});
      }
    }
    if(typeof FIRE_SOURCES!=='undefined'){
      for(let i=0;i<FIRE_SOURCES.length;i++){
        const fs=FIRE_SOURCES[i];
        if(fs.ttl<=0) continue;
        const dx=fs.x-camP.x, dz=fs.z-camP.z, d2=dx*dx+dz*dz;
        if(d2<ENG2) fresh.push({kind:'fs',src:fs,distSq:d2,range:15,intensity:18,color:0xff721a,weight:9});
      }
    }
    if(typeof FIRE_ACTIVE!=='undefined'&&FIRE_ACTIVE.length>0&&typeof FN!=='undefined'&&typeof FRES!=='undefined'&&typeof FOFF!=='undefined'){
      let nearestCi=-1, nearestD2=1e9;
      for(let i=0;i<FIRE_ACTIVE.length;i++){
        const ci=FIRE_ACTIVE[i];
        const cx=(ci%FN)*FRES-FOFF+FRES/2;
        const cz=Math.floor(ci/FN)*FRES-FOFF+FRES/2;
        const d2=(cx-camP.x)**2+(cz-camP.z)**2;
        if(d2<70*70&&d2<nearestD2){ nearestD2=d2; nearestCi=ci; }
      }
      if(nearestCi!==-1) fresh.push({kind:'cell',ci:nearestCi,distSq:nearestD2,range:14,intensity:15,color:0xff8828,weight:7});
    }
    if(fresh.length>1) fresh.sort(_fireCmp);
    // 已占槽的源不重复占位 (云团/火源按对象引用, 植被火按格号)
    for(let fi=0;fi<fresh.length;fi++){
      const c=fresh[fi];
      const key=c.src||c.ci;
      if(_fireTaken(key)) continue;
      let slot=-1;
      for(let i=0;i<maxActiveLights;i++) if(!_fireAssign[i]){ slot=i; break; }
      if(slot<0) break;
      _fireAssign[slot]=c;
    }
  }
  const expo=(typeof renderer!=='undefined'&&renderer.toneMappingExposure)?renderer.toneMappingExposure:1.0;
  const expoMul=clamp(1.1/Math.max(0.22,expo),1.0,3.0);
  for(let i=0;i<_fireLightPool.length;i++){
    const item=_fireLightPool[i];
    const cand=(i<maxActiveLights)?_fireAssign[i]:null;
    if(cand){
      // 自然火焰跳动 flicker: 双频正弦 + 随机微扰 (符合有机燃烧物理感)
      // ★2026-11-05 换战斗钟 _fireT (本函数双入口 08/04b 都收世界 dt, 各帧去重后只累一次): nowT 是
      //   墙钟表盘, 时停里火焰粒子全冻 (04b dt=0) 而光仍在跳 —— 与"冻的是战场"口径相悖, 同批一并收。
      const flick=0.82+0.18*Math.sin(_fireT*12.0+item.seed)+0.09*Math.sin(_fireT*24.5+item.seed*1.8)+(Math.random()-0.5)*0.06;
      const jx=Math.sin(_fireT*6.8+item.seed)*0.12;
      const jz=Math.cos(_fireT*7.7+item.seed)*0.12;
      const p=_firePos(cand);
      item.light.position.set(p.x+jx,p.y,p.z+jz);
      if(item.light.color){
        if(typeof item.light.color.setHex==='function') item.light.color.setHex(cand.color);
        else if(typeof item.light.color.set==='function') item.light.color.set(cand.color);
        else item.light.color=cand.color;
      }
      item.light.distance=cand.range;
      item.light.decay=1.25;
      const baseI=cand.intensity*(isDark?expoMul*0.75:0.85);
      item.light.intensity=baseI*flick;
      item.light.visible=true;
    }else{
      if(item.light.intensity>0||item.light.visible){
        item.light.intensity=0;
        item.light.visible=false;
      }
    }
  }
}

function impactFX(point,normal,kind){
const n=normal, p=point;
if(kind==='ground'||kind==='cyl'){
for(let i=0;i<4;i++) spawnP(PT.dirt,p.x,p.y+0.05,p.z, n.x*rand(0.5,1.5)+rand(-0.8,0.8), rand(0.8,2.2), n.z*rand(0.5,1.5)+rand(-0.8,0.8), rand(0.2,0.45),0.9,rand(0.4,0.7),0.9,3);
} else {
for(let i=0;i<3;i++) spawnP(PT.smoke,p.x+n.x*0.06,p.y+n.y*0.06,p.z+n.z*0.06, n.x*rand(0.4,1.2)+rand(-0.5,0.5), rand(0.3,1.2), n.z*rand(0.4,1.2)+rand(-0.5,0.5), rand(0.15,0.3),0.8,rand(0.3,0.55),0.8,1.5);
for(let i=0;i<3;i++) spawnP(PT.spark,p.x+n.x*0.05,p.y+n.y*0.05,p.z+n.z*0.05, n.x*rand(1,4)+rand(-2,2), rand(0.5,3), n.z*rand(1,4)+rand(-2,2), rand(0.05,0.12),-0.05,rand(0.15,0.3),1,6,true);
if(Math.random()<0.25) AudioSys.ricochet(p.distanceTo(camera.position));
}
}
function bloodFX(p){
for(let i=0;i<5;i++) spawnP(PT.blood,p.x,p.y,p.z, rand(-1.4,1.4), rand(-0.5,1.4), rand(-1.4,1.4), rand(0.14,0.3),0.5,rand(0.25,0.5),0.95,4);
bloodDecal(p.x,p.z);
}
function bloodDecal(x,z){
let best=null;
for(const b of bloodGeos) if(!b.alive&&(!best||b.age<best.age)) best=b;
if(!best) return;
if(!best.m){
best.m=new THREE.Mesh(best.g,bloodMat.clone()); // 36 池共享一片材质会让逐贴片 opacity 互相覆盖, 每贴片独立克隆 (2026-09-06 P3-4)
best.m.rotation.x=-HPI;
best.m.renderOrder=0;
}
// 贴花登记 (2026-09-27 深度分层): 血贴片抬到地面+0.02m (或水面), 与地形/水面的深度差在 100m 外只剩 1~2 LSB
// ⇒ 必须走 decal 档。放在 if(!best.m) **之外**是有意的: surfaceLane 对已带档材质是幂等 (depthVariant 按
// 材质+档缓存) —— 但这里材质是每贴片独占的克隆, 故只在创建那一帧登记一次, 避免每次复用都克隆一个新材质。
if(!best.m._surfLane){
if(typeof surfaceLane==='function'){ surfaceLane(best.m,'decal'); best.m._surfLane=1; }
else best.m.renderOrder=0;
}
best.m.visible=true;
// ★2026-09-26E (审计 39): 血贴片旧版按 heightAt 落位 ⇒ 深水里的血落在水底 (80% 不透明的水面之下几乎看不见)。
//   水下出血时把贴片抬到水面 (水面即"可见地面"); 岸上/浅水仍按地形 (浅水里贴在水面下一点点更自然)。
{
const bgy=heightAt(x,z), bwy=(typeof waterYAt==='function')?waterYAt(x,z):-1e9;
best.m.position.set(x,((bwy>-1e8&&bwy-bgy>0.6)?bwy:bgy)+0.02,z);
}
best.m.rotation.z=rand(0,TAU);
scene.add(best.m);
best.alive=true; best.age=0;
}
function updateBloodDecals(dt){
for(const b of bloodGeos){
if(!b.alive) continue;
b.age+=dt;
if(b.age>20){
b.alive=false;
b.m.visible=false;
}
const op=0.85*(1-clamp(b.age/18,0,1));
b.m.material.opacity=op;
}
}
function muzzleFXWorld(pos,dir){
spawnP(PT.flash,pos.x,pos.y,pos.z, dir.x*2,dir.y*2,dir.z*2, rand(0.3,0.5),1.2,0.06,1,0,true);
spawnP(PT.smoke,pos.x,pos.y,pos.z, dir.x*1.2+rand(-0.2,0.2),0.6,dir.z*1.2+rand(-0.2,0.2), 0.22,1.1,rand(0.5,0.9),0.4,0.3);
}
// 爆炸共用 PointLight: 夜档作用半径 ×flashRangeMul (昼夜设计 §3.3; 白天 26 逐位不变)
const flashLight=new THREE.PointLight(0xffb060,0,NIGHT_MODE?26*NIGHT_CFG.flashRangeMul:26);
scene.add(flashLight);
let flashTimer=0;
// ===== 残骸下沉系统: 被毁模型(载具/树木/草木/房屋)在地上停留一段时间后沉入地下, 全沉后移除 =====
// job 形态: {objs:[Object3D], inst:{im,idxs:[实例索引]}, depth:下沉深度, rest:停留秒数, sink:下沉秒数,
//           onRest:开始下沉回调, onHalf:半沉回调(撤碰撞), onDone:全沉回调, noRemove:终态不移除网格(由回调处理)}
// 停留期视觉原地不动; 下沉期匀速下移 depth; 半沉(40%)时撤碰撞; 全沉时移除网格/零缩放实例。
const SINK_JOBS=[];
// ═══ 2026-11-13 性能批 D: 沉入实例矩阵局部上传 (GPU 侧) ═══
// queueSink 的 inst 任务 (灌木/草丛/庄稼烧尽沉入) 沉入动画每帧写 instanceMatrix 后整批 needsUpdate ⇒
// 全量重传 (草批数千实例 × 64B)。改按"本帧脏段"标脏: BufferAttribute.updateRange {offset,count} (r152
// 语义; vendor lib/three.min.js 实证: 部分上传后 count 自动复位 -1 ⇒ 23b 世界还原的全量写回不残留旧区间,
// 正确性安全)。散置下标在登记时收外接区间, 同帧多任务按属性合并 (区间外数据本就正确, 多传无害)。
// 与 04b-fire 的 fireImDirty 同款但各自持有帧戳/独立函数名 —— 两文件顶层共享全局函数名空间, 重名会互相覆盖。
let _sinkFr=0;
function sinkImDirty(a,i0,n){
if(window.IM_FULL_UPLOAD){ a.needsUpdate=true; if(a.updateRange) a.updateRange.count=-1; return; }   // 回退旗 (D): 整批全量上传旧口径
a.needsUpdate=true;
if(a._upFr!==_sinkFr){ a._upFr=_sinkFr; a._upMin=i0; a._upMax=i0+n-1; }
else{ if(i0<a._upMin)a._upMin=i0; if(i0+n-1>a._upMax)a._upMax=i0+n-1; }
if(!a.updateRange) a.updateRange={offset:0,count:-1};
a.updateRange.offset=a._upMin*16;
a.updateRange.count=(a._upMax-a._upMin+1)*16;
}
let _sinkZeroM=null;
const sinkZeroM=()=>{ if(!_sinkZeroM) _sinkZeroM=new THREE.Matrix4().makeScale(0,0,0); return _sinkZeroM; };
function queueSink(job){
job.t=0; job.phase=0; job.half=false;
if(job.objs) job.y0s=job.objs.map(m=>m.position.y);
if(job.inst){
const arr=job.inst.im.instanceMatrix.array;
job.ys=job.inst.idxs.map(i=>arr[i*16+13]);
if(job.dx) job.xs=job.inst.idxs.map(i=>arr[i*16+12]);
let mn=job.inst.idxs[0], mx=mn;
for(let qi=0;qi<job.inst.idxs.length;qi++){ const i=job.inst.idxs[qi]; if(i<mn)mn=i; if(i>mx)mx=i; }
job._upMin=mn; job._upN=mx-mn+1;   // D: 本任务脏段外接区间 (同帧多任务在 sinkImDirty 里再并)
}
SINK_JOBS.push(job);
return job;
}
// 立即完成下沉任务 (载具重生等需要提前回收视觉时调用): 清理视觉并触发 onDone
function finishSinkJob(job){
const i=SINK_JOBS.indexOf(job);
if(i<0) return;
SINK_JOBS.splice(i,1);
endSinkJob(job);
}
function endSinkJob(job){
if(job.inst){
const im=job.inst.im;
for(const i of job.inst.idxs) im.setMatrixAt(i,sinkZeroM());
im.instanceMatrix.needsUpdate=true;
if(im.instanceMatrix.updateRange) im.instanceMatrix.updateRange.count=-1;   // D: 收尾走全量, 不吃同帧局部区间
}
if(job.objs){
for(const m of job.objs){ if(m.parent&&!job.noRemove) m.parent.remove(m); }
}
if(job.onDone) job.onDone();
}
function updateWreckSinks(dt){
_sinkFr++;   // D: 局部上传帧戳 (24-main 每帧恰调一次)
for(let i=SINK_JOBS.length-1;i>=0;i--){
const job=SINK_JOBS[i];
job.t+=dt;
if(job.phase===0){
if(job.t<job.rest) continue;
job.phase=1; job.t=0;
if(job.onRest) job.onRest();
}
const k=Math.min(1,job.t/job.sink);
if(!job.half&&k>=0.4){
job.half=true;
if(job.onHalf) job.onHalf();
}
if(job.objs){
for(let oi=0;oi<job.objs.length;oi++){
const m=job.objs[oi];
if(m.parent) m.position.y=job.y0s[oi]-job.depth*k;
}
}
if(job.onTick) job.onTick(dt,k);
if(job.inst){
const arr=job.inst.im.instanceMatrix.array;
for(let ii=0;ii<job.inst.idxs.length;ii++){
arr[job.inst.idxs[ii]*16+13]=job.ys[ii]-job.depth*k;
if(job.xs) arr[job.inst.idxs[ii]*16+12]=job.xs[ii]+job.dx*k;
}
sinkImDirty(job.inst.im.instanceMatrix,job._upMin,job._upN);   // D: 局部上传 (同帧多任务合并外接区间)
}
if(k>=1){
SINK_JOBS.splice(i,1);
endSinkJob(job);
}
}
}
function explosionFX(p,noCrater){   // noCrater (2026-11-14 用户令): 撞楼 die/残骸二次爆炸等"全程无坑"场合显式压掉
spawnP(PT.flash,p.x,p.y+0.6,p.z,0,1.5,0, 2.6,14,0.16,1,0,true);
spawnP(PT.flash,p.x,p.y+0.9,p.z,0,2,0, 1.6,10,0.22,1,0,true);
for(let i=0;i<10;i++) spawnP(PT.dark,p.x+rand(-1,1),p.y+rand(0.2,1.6),p.z+rand(-1,1), rand(-2,2),rand(1.5,4.5),rand(-2,2), rand(0.8,1.6),2.2,rand(1.2,2.4),0.85,0.8,false,rand(-1,1));
for(let i=0;i<12;i++) spawnP(PT.dirt,p.x,p.y+0.3,p.z, rand(-5,5),rand(3,9),rand(-5,5), rand(0.3,0.7),0.6,rand(0.6,1.2),0.95,9);
for(let i=0;i<8;i++) spawnP(PT.spark,p.x,p.y+0.5,p.z, rand(-8,8),rand(2,9),rand(-8,8), rand(0.1,0.2),-0.05,rand(0.2,0.5),1,10,true);
// 高画质: 余烬火星弧线 + 冲击波环 + 滞留浓烟
if(SETTINGS.quality>=1){
const n=SETTINGS.quality===2?14:7;
for(let i=0;i<n;i++) spawnP(PT.spark,p.x,p.y+0.7,p.z, rand(-7,7),rand(3,11),rand(-7,7), rand(0.07,0.15),-0.03,rand(0.6,1.3),1,8,true,rand(-8,8));
spawnP(PT.flash,p.x,p.y+0.4,p.z,0,0,0, 2.0,30,0.16,0.65,0,true);
if(SETTINGS.quality===2){
for(let i=0;i<4;i++) spawnP(PT.smoke,p.x+rand(-1.5,1.5),p.y+rand(1,3),p.z+rand(-1.5,1.5), rand(-0.4,0.4),rand(0.6,1.4),rand(-0.4,0.4), rand(1.4,2),2.4,rand(2.5,3.8),0.55,0.05);
}
}
flashLight.position.set(p.x,p.y+1.2,p.z);
flashLight.intensity=60; flashTimer=0.14;
// 弹坑高度门 (2026-11-14 用户令 "撞楼后黑色爆炸坑出现在正下方的地上, 十分诡异"): crater 恒打
// heightAt(x,z) = 爆点正下方的地面 ⇒ 半空/楼面的爆炸隔空在地上盖坑 (高炮空炸/撞楼/楼面中弹全中招)。
// 爆点高于支撑地面 2.2m 不再盖坑 (2.2 取值: 坠地机 die 门是 floor+2, 手雷/炮弹触地爆都在 1m 级 ——
// 全部照旧盖坑; 水面上 heightAt 是水底, 深水自然不盖, 浅水盖在水底不可见=旧同款); noCrater 再显式压一档。
if(!noCrater&&p.y-heightAt(p.x,p.z)<2.2) crater(p.x,p.z,rand(1.2,1.7),true,p.y);   // supY=爆点: 支撑面跟随 (2026-11-18 弹坑批, 桥面/楼板上的爆炸贴支撑地板顶画, 甜甜圈病根)
}
