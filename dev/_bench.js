// ─────────────────────────────────────────────
// dev/_bench.js —— 全循环帧基准 (复用 probe-bots 桩; 2026-09-06 重写为可用版, 不进全量集)
// 对比 window.RGRID_OFF (true=旧全量碰撞扫描 / false=RGRID 邻近候选) 两档的 600 帧全模拟耗时。
// 用法: node dev/_bench.js [campIdx] [frames]
// ─────────────────────────────────────────────
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const src=fs.readFileSync(path.join(root,'dev/probe-bots.js'),'utf8');
const cut=src.indexOf('// ── 全战役乱斗推演 ──');
if(cut<0){ console.error('probe-bots harness cut not found'); process.exit(1); }
eval(src.slice(0,cut)+'\n;globalThis.__probe={boot,STEP_FN};');
const boot=globalThis.__probe.boot;

const campIdx=process.argv[2]!==undefined?parseInt(process.argv[2]):0;
const FRAMES=process.argv[3]!==undefined?parseInt(process.argv[3]):600;
function bench(equivOff){
const ctx=boot(campIdx);
vm.runInContext(`var BENCH_FRAMES=${FRAMES}; window.RGRID_OFF=${equivOff?'true':'false'};`,ctx);
vm.runInContext(`document.getElementById('startBtn').onclick();`,ctx);
ctx.__step=vm.runInContext(globalThis.__probe.STEP_FN,ctx);
return vm.runInContext(`(()=>{
const DTS=[1/60,1/30,1/20];
const t0=Date.now();
for(let f=0;f<BENCH_FRAMES;f++){
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
}
return {ms:Date.now()-t0, alive:soldiers.filter(s=>s.alive).length, boxes:BOXES.length, cyls:CYLS.length};
})()`,ctx);
}
// 预热 (JIT) 后各跑两轮取较好值
const warm=bench(true);
const old1=bench(true), old2=bench(true);
const new1=bench(false), new2=bench(false);
const oldMs=Math.min(old1.ms,old2.ms), newMs=Math.min(new1.ms,new2.ms);
console.log(`== bench: 战役#${campIdx} ${FRAMES} 帧 (boxes=${warm.boxes} cyls=${warm.cyls}) ==`);
console.log(`旧全量扫描: ${old1.ms}ms / ${old2.ms}ms → 取 ${oldMs}ms (${(oldMs/FRAMES).toFixed(2)}ms/帧)`);
console.log(`RGRID 邻近 : ${new1.ms}ms / ${new2.ms}ms → 取 ${newMs}ms (${(newMs/FRAMES).toFixed(2)}ms/帧)`);
console.log(`加速比 ${(oldMs/newMs).toFixed(2)}× (帧耗时 ${(100*(1-newMs/oldMs)).toFixed(1)}%↓)`);
