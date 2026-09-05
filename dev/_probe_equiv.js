// ─────────────────────────────────────────────
// dev/_probe_equiv.js —— B5/P0-2 RGRID 推广等价性探针 (临时, 不进全量集)
// 原理: 正常开局后驱动 60s 无头模拟, 每 0.5s 对全部士兵/坦克的"当前真实位置"做逐调用纯函数等价比对:
//   同一输入状态 (pos/radius/curY 副本, 中间不步进世界) 分别走
//   window.RGRID_OFF=true (旧全量扫描) 与 =false (RGRID 邻近候选) 的
//   collideMove / standHeight / tankRideH / tankSurfH, 断言输出差 <1cm (纯读函数要求逐位相等)。
// 覆盖: 静态盒+动态碰撞体 (残骸) + 圆柱; 附带跑完后 world 一致性 (BOXES/CYLS 长度不变)。
// 用法: node dev/_probe_equiv.js [campIdx]
// ─────────────────────────────────────────────
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const src=fs.readFileSync(path.join(root,'dev/probe-bots.js'),'utf8');
const cut=src.indexOf('// ── 全战役乱斗推演 ──');
if(cut<0){ console.error('probe-bots harness cut not found'); process.exit(1); }
eval(src.slice(0,cut)+'\n;globalThis.__probe={boot,STEP_FN};'); // 同一 eval 程序内 const 可见
const boot=globalThis.__probe.boot;

const campIdx=process.argv[2]!==undefined?parseInt(process.argv[2]):1;
const SIM_SECONDS=45;
const ctx=boot(campIdx);
vm.runInContext(`var SIM_SECONDS=${SIM_SECONDS};`,ctx);
vm.runInContext(`document.getElementById('startBtn').onclick();`,ctx);
ctx.__step=vm.runInContext(globalThis.__probe.STEP_FN,ctx);
const result=vm.runInContext(`(()=>{
const DTS=[1/60,1/30,1/20];
let samples=0, maxPushDiff=0, pushBad=0, shDiff=0, shBad=0, rideDiff=0, rideBad=0, surfDiff=0, surfBad=0;
const COMPARE=()=>{
for(const s of soldiers){
if(!s.alive) continue;
// --- collideMove: 副本上分别跑旧/新 (中间无步进, 世界状态一致) ---
const p1={x:s.pos.x,y:s.pos.y,z:s.pos.z};
const p2={x:s.pos.x,y:s.pos.y,z:s.pos.z};
window.RGRID_OFF=true;  try{ collideMove(p1,0.42); }catch(e){}
window.RGRID_OFF=false; try{ collideMove(p2,0.42); }catch(e){}
window.RGRID_OFF=false;
const d=Math.hypot(p1.x-p2.x,p1.z-p2.z);
if(d>maxPushDiff) maxPushDiff=d;
if(d>=0.01) pushBad++;
samples++;
// --- standHeight: 纯读, 要求逐位相等 ---
window.RGRID_OFF=true;  const h1=standHeight(s.pos.x,s.pos.z,s.pos.y+1);
window.RGRID_OFF=false; const h2=standHeight(s.pos.x,s.pos.z,s.pos.y+1);
if(Math.abs(h1-h2)>0.001) shBad++;
shDiff=Math.max(shDiff,Math.abs(h1-h2));
}
for(const t of tanks){
if(!t.alive) continue;
// tankRideH / tankSurfH: 纯读
window.RGRID_OFF=true;  const r1=tankRideH(t.pos.x,t.pos.z,t.pos.y);
window.RGRID_OFF=false; const r2=tankRideH(t.pos.x,t.pos.z,t.pos.y);
window.RGRID_OFF=true;  const u1=tankSurfH(t.pos.x,t.pos.z);
window.RGRID_OFF=false; const u2=tankSurfH(t.pos.x,t.pos.z);
if(Math.abs(r1-r2)>0.001) rideBad++;
rideDiff=Math.max(rideDiff,Math.abs(r1-r2));
if(Math.abs(u1-u2)>0.001) surfBad++;
surfDiff=Math.max(surfDiff,Math.abs(u1-u2));
}
};
for(let f=0;f<SIM_SECONDS*60;f++){
const dt=DTS[f%3];
nowT+=dt;
gunEvents=gunEvents.filter(e=>nowT-e.t<0.6);
NAV.budget=2;
updateNavDirty(dt);
updateSmokes(dt);
for(const s of soldiers){
s.tickAcc+=dt; s.tickSkip--;
if(!s.alive||s.onVehicle||s.tickSkip<=0){
const useDt=Math.min(s.tickAcc,0.15);
s.update(useDt);
s.tickAcc=0;
const d2p=s.pos.distanceTo(camera.position);
s.tickSkip=d2p>110?3:d2p>60?2:1;
}
}
for(const t of tanks) t.update(dt);
updateShells(dt);
updateFlak(dt);
updateNades(dt);
updateFlags(dt);
if(f%30===0) COMPARE();
}
return {samples,maxPushDiff,pushBad,shDiff,shBad,rideDiff,rideBad,surfDiff,surfBad,
boxes:BOXES.length,cyls:CYLS.length,alive:soldiers.filter(s=>s.alive).length,tanks:tanks.filter(t=>t.alive).length};
})()`,ctx);
console.log(`== B5/B6 等价性探针: 战役#${campIdx} ${SIM_SECONDS}s 模拟内逐调用比对 ==`);
console.log(`collideMove 采样=${result.samples} 最大推出差=${(result.maxPushDiff*100).toFixed(3)}cm 超差(≥1cm)=${result.pushBad}`);
console.log(`standHeight   最大差=${(result.shDiff*1000).toFixed(3)}mm 超差=${result.shBad}`);
console.log(`tankRideH     最大差=${(result.rideDiff*1000).toFixed(3)}mm 超差=${result.rideBad}`);
console.log(`tankSurfH     最大差=${(result.surfDiff*1000).toFixed(3)}mm 超差=${result.surfBad}`);
console.log(`世界: BOXES=${result.boxes} CYLS=${result.cyls} 存活=${result.alive}人/${result.tanks}车`);
// ── T6.1 heightAt 修正带清空场: 10 万随机点 (含特征带偏置) 双路径逐位比对 ──
const hres=vm.runInContext(`(()=>{
let maxD=0, bad=0;
const SPAN=(CAMPAIGN.mapSize||320);
for(let i=0;i<100000;i++){
// 70% 全图均匀 + 30% 特征带偏置 (FLATS/河道附近)
let x,z;
if(i%10<7){ x=(Math.random()-0.5)*SPAN; z=(Math.random()-0.5)*SPAN; }
else{
const f=FLATS[Math.floor(Math.random()*FLATS.length)];
x=f.x+(Math.random()-0.5)*f.r*3; z=f.z+(Math.random()-0.5)*f.r*3;
if(RIVER&&i%3===0){ const p=RIVER.pts[Math.floor(Math.random()*(RIVER.pts.length-1))]; x=p[0]+(Math.random()-0.5)*RIVER.w*3; z=p[1]+(Math.random()-0.5)*RIVER.w*3; }
}
window.HGRID_OFF=true;  const a=heightAt(x,z);
window.HGRID_OFF=false; const b=heightAt(x,z);
const d=Math.abs(a-b);
if(d>maxD) maxD=d;
if(d>=0.001) bad++;
}
return {maxD,bad};
})()`,ctx);
console.log(`heightAt 10万点: 最大差=${(hres.maxD*1000).toFixed(4)}mm 超差(≥1mm)=${hres.bad}`);
const pass=result.pushBad===0&&result.shBad===0&&result.rideBad===0&&result.surfBad===0&&hres.bad===0;
console.log(pass?'等价性通过 ✓':'等价性失败 ✗');
process.exit(pass?0:1);
