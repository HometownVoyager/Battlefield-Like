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
function spawnTracer(o,dir,dist){
let m=tracerPool.pop();
if(!m){ m=new THREE.Mesh(tracerGeo,tracerMat); scene.add(m); }
m.visible=true;
m.position.copy(o);
m.lookAt(o.x+dir.x,o.y+dir.y,o.z+dir.z);
tracers.push({m,dir:dir.clone(),traveled:0,max:dist});
}
function updateTracers(dt){
const spd=340;
for(let i=tracers.length-1;i>=0;i--){
const t=tracers[i];
const step=spd*dt;
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
function updateCasings(dt){
for(let i=casings.length-1;i>=0;i--){
const c=casings[i];
c.life+=dt;
if(c.life>4){ scene.remove(c.m); casings.splice(i,1); continue; }
c.vy-=9.8*dt;
c.m.position.x+=c.vx*dt; c.m.position.y+=c.vy*dt; c.m.position.z+=c.vz*dt;
c.m.rotation.x+=c.rx*dt; c.m.rotation.z+=c.rz*dt;
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
if(!s.alive||s.onVehicle) continue;
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
function initWeather(){
if(WEATHER==='rain'||WEATHER==='storm'){
const n=WEATHER==='storm'?720:460;
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
} else if(WEATHER==='snow'){
const n=620;
const geo=new THREE.BufferGeometry();
const pos=new Float32Array(n*3);
for(let i=0;i<n;i++){ pos[i*3]=rand(-26,26); pos[i*3+1]=rand(0,24); pos[i*3+2]=rand(-26,26); }
geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
precipObj=new THREE.Points(geo,new THREE.PointsMaterial({color:0xf2f5f8,size:0.16,transparent:true,opacity:0.9,fog:false,sizeAttenuation:true}));
precipObj.frustumCulled=false;
scene.add(precipObj);
}
if(WEATHER==='overcast'||WEATHER==='storm'){ sun.intensity=THEME.sunI*0.55; hemi.intensity=THEME.hemi[2]*1.15; }
else if(WEATHER==='rain') sun.intensity=THEME.sunI*0.7;
}
function updateWeather(dt){
if(precipObj){
precipObj.position.set(camera.position.x,camera.position.y-8,camera.position.z);
const pos=precipObj.geometry.attributes.position;
const arr=pos.array; // 2026-09-06 B6/P3-10: 直写数组替代逐顶点 getter/setter (粒子量大, 纯热路径)
if(WEATHER==='snow'){
for(let i=0;i<pos.count;i++){
const i3=i*3;
let y=arr[i3+1]-dt*3.2;
let x=arr[i3]+Math.sin(nowT*1.4+i*0.7)*dt*0.9;
if(y<0){ y+=24; x=rand(-26,26); arr[i3+2]=rand(-26,26); }
arr[i3+1]=y; arr[i3]=x;
}
} else {
const sp=WEATHER==='storm'?36:27;
for(let i=0;i<pos.count;i+=2){
const i3=i*3;
let y=arr[i3+1]-dt*sp;
if(y<0){
y+=26;
const nx=rand(-24,24),nz=rand(-24,24);
arr[i3]=nx; arr[i3+2]=nz;
arr[i3+3]=nx; arr[i3+5]=nz;
}
arr[i3+1]=y; arr[i3+4]=y-0.7;
}
}
pos.needsUpdate=true;
}
// 雷暴闪电
if(WEATHER==='storm'){
lightningT-=dt;
if(lightningT<=0){
lightningT=rand(7,17);
stormFlash=1;
const base=THEME.sunI*0.55;
sun.intensity=THEME.sunI*2.6;
setTimeout(()=>{ sun.intensity=THEME.sunI*1.6; },70);
setTimeout(()=>{ sun.intensity=base; },160);
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
best.m.visible=true;
best.m.position.set(x,heightAt(x,z)+0.02,z);
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
const flashLight=new THREE.PointLight(0xffb060,0,26);
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
