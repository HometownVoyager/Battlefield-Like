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
const PT = {
smoke: radialTex(2,30,[[0,'rgba(200,195,185,.85)'],[0.5,'rgba(160,155,145,.4)'],[1,'rgba(150,150,140,0)']]),
dark:  radialTex(2,30,[[0,'rgba(60,55,48,.9)'],[0.5,'rgba(70,64,55,.5)'],[1,'rgba(60,60,55,0)']]),
flash: radialTex(1,30,[[0,'rgba(255,250,220,1)'],[0.25,'rgba(255,190,90,.9)'],[1,'rgba(255,120,30,0)']]),
blood: radialTex(2,26,[[0,'rgba(140,20,12,.95)'],[0.6,'rgba(110,14,8,.5)'],[1,'rgba(90,10,6,0)']]),
dirt:  radialTex(2,28,[[0,'rgba(120,100,70,.95)'],[0.6,'rgba(100,84,58,.5)'],[1,'rgba(90,76,52,0)']]),
spark: radialTex(1,20,[[0,'rgba(255,240,180,1)'],[1,'rgba(255,160,40,0)']]),
drop:  radialTex(2,26,[[0,'rgba(232,246,252,.95)'],[0.5,'rgba(190,222,236,.5)'],[1,'rgba(170,205,225,0)']]),
};
// SVG 精修: 烟/黑烟/尘团改 feTurbulence 位移扰动的蓬松轮廓 (02-scene 生成器, Canvas 径向渐变兜底)
svgApply(PT.smoke,'puffSmoke'); svgApply(PT.dark,'puffDark'); svgApply(PT.dirt,'puffDirt');
const particles=[];
const PARTICLE_MAX=280;
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
particles.push(p);
}
// 水花 (2026-09-18 塔拉瓦批): 子弹/炮弹/手雷入水与落水冲击 —— 白色水柱 + 飞溅水滴 (纯视觉)
// big=true: 炮弹/载具级入水 (更高更散); bubbles=true 追加水下气泡 (哑火的手雷/沉物)
function waterSplash(p,scale=1,big=false,bubbles=false){
const n=big?10:5;
for(let k=0;k<n;k++){
spawnP(PT.drop,p.x+rand(-0.5,0.5)*scale,p.y+rand(0,0.3),p.z+rand(-0.5,0.5)*scale,
rand(-2.2,2.2)*scale,rand(3.2,7.5)*scale*(big?1.3:1),rand(-2.2,2.2)*scale,
rand(0.22,0.5)*scale,0.5,rand(0.5,0.95),0.9,9);
}
spawnP(PT.smoke,p.x,p.y+0.25*scale,p.z,0,1.2*scale,0,0.7*scale,2.4,rand(0.7,1.1),0.55,0.4);
if(bubbles) for(let k=0;k<7;k++){
spawnP(PT.drop,p.x+rand(-0.5,0.5),p.y+rand(-1.2,-0.2),p.z+rand(-0.5,0.5),
rand(-0.6,0.6),rand(0.8,2.0),rand(-0.6,0.6),rand(0.14,0.3),0.25,rand(0.6,1.2),0.7,-1.2);
}
if(typeof AudioSys!=='undefined'&&AudioSys.splash) AudioSys.splash(p.distanceTo(camera.position),big);
}
function updateParticles(dt){
for(let i=particles.length-1;i>=0;i--){
const p=particles[i];
p.age+=dt;
if(p.age>=p.life){ recycleP(p); particles.splice(i,1); continue; }
p.vy-=p.grav*dt;
p.sp.position.x+=p.vx*dt; p.sp.position.y+=p.vy*dt; p.sp.position.z+=p.vz*dt;
const s=p.sp.scale.x+p.grow*dt;
p.sp.scale.setScalar(s);
p.sp.material.rotation+=p.spin*dt;
p.sp.material.opacity=p.opa*(1-p.age/p.life);
}
}
const tracers=[], tracerPool=[];
const tracerGeo=new THREE.BoxGeometry(0.035,0.035,1.6);
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
const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:PT.flash,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,color:0xff9a3c}));
sp.position.set(p.x+rand(-2,2),p.y+rand(0.15,0.9),p.z+rand(-2,2));
sp.scale.setScalar(rand(1.2,2.2));
scene.add(sp);
cloud.sprites.push({sp,flame:true,fk:rand(6,14),ph:rand(0,TAU),vx:0,vy:0,vz:0,rs:0,g:-0.1});
}
crater(p.x,p.z,1.5,true);
AudioSys.explosion(p.distanceTo(camera.position)*1.4);
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
s.sp.material.opacity=(0.4+0.3*Math.sin(nowT*s.fk+s.ph))*fade;
s.sp.scale.setScalar(s.sp.scale.x+Math.sin(nowT*s.fk*0.7+s.ph)*dt*0.5);
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
for(const s of combatants){
if(!s.alive||seatShielded(s)) continue;   // 2026-09-26E 审计 2: 含艇上乘员
if(s.team===c.team&&s!==c.thrower) continue;
const d=Math.hypot(s.pos.x-c.x,(s.pos.y+0.9)-(c.y+0.8),s.pos.z-c.z);
if(d<c.r+0.5){
s.damage(11,c.thrower,false);
if(s.isPlayer) addTrauma(0.2);
}
}
for(const t of tanks){
if(!t.alive||t.team===c.team) continue;
if(Math.hypot(t.pos.x-c.x,t.pos.z-c.z)<c.r+1.5) t.takeDmg(7,c.thrower);
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
function scanRainCovers(){
RAIN_COVERS.length=0;
for(let i=0;i<BOXES.length;i++){ const b=BOXES[i];
if(b.dead||!b.mesh) continue;
const dy=b.maxY-b.minY, dx=b.maxX-b.minX, dz=b.maxZ-b.minZ;
if(dy>1.5||dx<0.8||dz<0.8||dx*dz<1.6) continue;
RAIN_COVERS.push(b);
}
}
function initWeather(){
// 粒子建池参数收编进 WX_CFG (天气设计 §5-3): 种类 precip / 粒数 precipN —— 雨盒 460/720 与雪池 620/370/900 全为既有校准值。
if(WX_CFG.precip==='rain'){
const n=WX_CFG.precipN;
const geo=new THREE.BufferGeometry();
const pos=new Float32Array(n*6);
for(let i=0;i<n;i++){
const x=rand(-24,24),y=rand(0,26),z=rand(-24,24);
pos[i*6]=x; pos[i*6+1]=y; pos[i*6+2]=z;
pos[i*6+3]=x; pos[i*6+4]=y-0.7; pos[i*6+5]=z;
}
geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
precipObj=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:0x9db4c8,transparent:true,opacity:0.38,fog:false}));
precipObj.frustumCulled=false;
scene.add(precipObj);
} else if(WX_CFG.precip==='snow'){
const n=WX_CFG.precipN;
const geo=new THREE.BufferGeometry();
const pos=new Float32Array(n*3);
for(let i=0;i<n;i++){ pos[i*3]=rand(-26,26); pos[i*3+1]=rand(0,24); pos[i*3+2]=rand(-26,26); }
geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
precipObj=new THREE.Points(geo,new THREE.PointsMaterial({color:0xf2f5f8,size:0.16,transparent:true,opacity:0.9,fog:false,sizeAttenuation:true}));
precipObj.frustumCulled=false;
scene.add(precipObj);
}
// 天气×夜 (昼夜设计 §3.3 顺序钉死): initWeather 在夜档月光/半球系数**之上**再乘天气系数 ——
// ironbottom(overcast×夜) 就是按这条校准的样本。视觉系数收编进 WX_CFG (天气设计 §5-3);
// 晴/中雪档系数=1, 赋值与 02-scene 初值逐位相等 (乘 1 无舍入漂移), 统一赋值无回归 (R1)。
const _nSun=NIGHT_MODE?NIGHT_CFG.sunMul:1, _nHemi=NIGHT_MODE?NIGHT_CFG.hemiMul:1;
sun.intensity=THEME.sunI*_nSun*WX_CFG.sunMul;
hemi.intensity=THEME.hemi[2]*_nHemi*WX_CFG.hemiMul;
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
// ★顶面终结: 世界坐标落进某水平顶面投影且低于其顶面 ⇒ 原地回收 (室内不漏雨雪)
const wx=x+precipObj.position.x, wz=arr[i3+2]+precipObj.position.z, wy=y+precipObj.position.y;
for(let k=0;k<_wxCovers.length;k++){ const b=_wxCovers[k];
if(wy<b.maxY&&wx>=b.minX&&wx<=b.maxX&&wz>=b.minZ&&wz<=b.maxZ){
y+=24; x=rand(-26,26); arr[i3+2]=rand(-26,26); break;
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
// ★顶面终结 (判头部端点): 雨丝落到屋顶/桥面即回收, 双端随尾部统一重写
const wx=arr[i3]+precipObj.position.x, wz=arr[i3+2]+precipObj.position.z, wy=y+precipObj.position.y;
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
setTimeout(()=>AudioSys.explosion(dd*0.8),dd*2.6);
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
// 灯池预算红线 (设计 §5): 真 SpotLight ≤ NIGHT_GEAR.headRealN(2); 真 PointLight = 枪口(10-viewmodel)
//   + 爆炸(flashLight) + 照明弹 1 盏 ≤ 3。
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
const gL=_nightGlowSprite('rgba(255,244,214,1)','rgba(255,226,168,0.5)',1.0); gL.position.set(-hw,ly,fz+0.06);
const gR=_nightGlowSprite('rgba(255,244,214,1)','rgba(255,226,168,0.5)',1.0); gR.position.set(hw,ly,fz+0.06);
// 假光锥 (additive): 真灯池名额外的车辆靠它读出"开灯" —— 锥顶在灯位, 向前展开
const cone=new THREE.Mesh(
new THREE.ConeGeometry(2.7,17,14,1,true),
new THREE.MeshBasicMaterial({color:0xffe2a8,transparent:true,opacity:0.10,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false}));
cone.rotation.x=-HPI;                       // apex 朝 -z ⇒ 锥顶落在灯位, 底口向艏向展开
cone.position.set(0,ly-0.35,fz+17/2-0.25);
grp.add(gL); grp.add(gR); grp.add(cone);
veh.grp.add(grp);
veh._hl={grp,glow:[gL,gR],cone};
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
// 大灯真灯池 (SpotLight ≤2): 每帧把"离相机最近的开灯载具"换上来, 其余只留假光锥
const _hlPool=[];
function _hlPoolEnsure(){
while(_hlPool.length<NIGHT_GEAR.headRealN){
const sl=new THREE.SpotLight(0xffe6b8,0,60,0.44,0.5,1.1);
sl.castShadow=false; sl.visible=false;
scene.add(sl); scene.add(sl.target);
_hlPool.push(sl);
}
}
function _hlWorld(veh,out){
// 车艏灯世界位: pos + 艏向*fz, 高度 pos.y+ly (与 vehHeadlightBuild 同挂点口径)
let fz=2.3, ly=0.9;
if(typeof tkSpec==='function'&&veh.def&&veh.def.hullL){ const S=tkSpec(veh.def,veh.def.tk); fz=S.L/2+0.04; ly=Math.max(0.55,S.roof-0.5); }
else if(veh.dims&&veh.dims.L){ fz=veh.dims.L*0.5-0.15; ly=(veh.dims.deckY||0.9)+0.45; }
const sn=Math.sin(veh.yaw), cs=Math.cos(veh.yaw);
out.set(veh.pos.x+sn*fz, veh.pos.y+ly, veh.pos.z+cs*fz);
return out;
}
const _hlP=V3(), _hlT=V3();
// ── 4.2 旗点周期照明弹 ──
const FLARES=[]; let _flaresInit=false;
const _flareLightPool=[];
function nightFlaresInit(){
_flaresInit=true;
if(!(GAMEMODE==='conquest'||GAMEMODE==='assault')) return;   // 仅占旗图 (设计 §4.2)
if(typeof FLAGS==='undefined'||!FLAGS.length) return;
FLAGS.forEach((f,i)=>{
if(f.ship!==undefined&&f.ship!==null&&f.ship!==false) return; // 舰上甲板旗不做 (纯海图旗点全在舰上)
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
const dg=new THREE.CircleGeometry(NIGHT_GEAR.flareR,26);
fl.disc=new THREE.Mesh(dg,new THREE.MeshBasicMaterial({color:0xfff0cc,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));
fl.disc.rotation.x=-HPI;
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
const az=b.az0+Math.sin(nowT*0.22+b.phase)*1.05;   // 扫掠: ~14s 一个来回, ±60°
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
// ── 每帧总入口 (24-main, NIGHT_MODE 门控) ──
function nightGearTick(dt){
if(!NIGHT_MODE) return;
// 大灯: AI 状态机 (行进开灯 / 交战关灯, 设计 §4.1) + 玩家车不代管 (L 键自管)
const cands=[];
for(const t of tanks){
if(!t.alive) continue;
if(t.isAI&&!t.playerDriven){
const engaged=!!(t.tTarget&&t.tMemT>0);
const want=!engaged;
if(!!t.lightsOn!==want) vehHeadlightSet(t,want);
}
if(t.lightsOn) cands.push(t);
}
for(const tk of trucks){
if(!tk.alive||tk.sunk) continue;
if(!tk.lightsOn) vehHeadlightSet(tk,true);   // 劫道车队夜行常亮 (目标可循, 也暴露)
if(tk.lightsOn) cands.push(tk);
}
if(typeof navalCraft!=='undefined') for(const b of navalCraft){
if(!b.alive||b.state!=='run') { if(b.lightsOn) vehHeadlightSet(b,false); continue; }
if(b.isAI&&!b.playerDriven&&!b.lightsOn) vehHeadlightSet(b,true);
if(b.lightsOn) cands.push(b);
}
// 真灯池竞选: 离相机最近的开灯载具 (≤headRealN), 其余假光锥
_hlPoolEnsure();
cands.sort((a,b)=>a.pos.distanceToSquared(camera.position)-b.pos.distanceToSquared(camera.position));
for(let i=0;i<_hlPool.length;i++){
const sl=_hlPool[i];
const v=cands[i];
if(v&&v.pos.distanceTo(camera.position)<NIGHT_GEAR.headRealR){
_hlWorld(v,_hlP);
sl.position.copy(_hlP);
const sn=Math.sin(v.yaw), cs=Math.cos(v.yaw);
sl.target.position.set(_hlP.x+sn*26, v.pos.y-0.4, _hlP.z+cs*26);
sl.target.updateMatrixWorld();
sl.intensity=2.6; sl.visible=true;
}else{ sl.intensity=0; sl.visible=false; }
}
// 照明弹
if(!_flaresInit) nightFlaresInit();
let bestFlare=null,bestD=1e9;
for(const fl of FLARES){
const p=((nowT-fl.t0)%NIGHT_GEAR.flarePeriod+NIGHT_GEAR.flarePeriod)%NIGHT_GEAR.flarePeriod;
if(p<NIGHT_GEAR.flareBurn){
if(!fl.sp) _flareVisual(fl);
fl.y=55-p*1.1;                                   // 缓降 55→46
const rise=Math.min(1,p/0.6), fall=Math.min(1,(NIGHT_GEAR.flareBurn-p)/0.8);
fl.lit=Math.min(rise,fall);
const drift=Math.sin(nowT*0.35+fl.x)*1.2;
fl.sp.visible=true;
fl.sp.position.set(fl.x+drift,fl.y,fl.z);
fl.sp.material.opacity=0.85*fl.lit;
fl.sp.scale.set(9+2*(1-fl.lit),9+2*(1-fl.lit),1);
fl.disc.visible=true;
fl.disc.position.set(fl.x,fl.gy+0.07,fl.z);
fl.disc.material.opacity=0.11*fl.lit;
const d2=(fl.x-camera.position.x)**2+(fl.z-camera.position.z)**2;
if(d2<bestD){ bestD=d2; bestFlare=fl; }
}else if(fl.lit>0||fl.sp&&fl.sp.visible){
fl.lit=0; if(fl.sp) fl.sp.visible=false; if(fl.disc) fl.disc.visible=false;
}
}
if(!_flareLightPool.length){
const pl=new THREE.PointLight(0xfff2d0,0,NIGHT_GEAR.flareR*2.6,1.4);
pl.visible=false; scene.add(pl);
_flareLightPool.push(pl);
}
const flL=_flareLightPool[0];
if(bestFlare&&bestFlare.lit>0.05){
flL.position.set(bestFlare.x,bestFlare.y-0.5,bestFlare.z);
flL.intensity=1.7*bestFlare.lit;
flL.visible=true;
}else{ flL.intensity=0; flL.visible=false; }
// 探照灯
for(const sl of SEARCHLIGHTS) _searchVisual(sl);
for(const sl of _searchBeams){
const az=_searchDir(sl,_sDir);
sl._beam.root.rotation.y=az;
sl._beam.tilt.rotation.x=-0.45;
}
_searchHitTick();
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
let _sinkZeroM=null;
const sinkZeroM=()=>{ if(!_sinkZeroM) _sinkZeroM=new THREE.Matrix4().makeScale(0,0,0); return _sinkZeroM; };
function queueSink(job){
job.t=0; job.phase=0; job.half=false;
if(job.objs) job.y0s=job.objs.map(m=>m.position.y);
if(job.inst){
const arr=job.inst.im.instanceMatrix.array;
job.ys=job.inst.idxs.map(i=>arr[i*16+13]);
if(job.dx) job.xs=job.inst.idxs.map(i=>arr[i*16+12]);
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
}
if(job.objs){
for(const m of job.objs){ if(m.parent&&!job.noRemove) m.parent.remove(m); }
}
if(job.onDone) job.onDone();
}
function updateWreckSinks(dt){
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
job.inst.im.instanceMatrix.needsUpdate=true;
}
if(k>=1){
SINK_JOBS.splice(i,1);
endSinkJob(job);
}
}
}
function explosionFX(p){
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
crater(p.x,p.z,rand(1.2,1.7),true);
}
