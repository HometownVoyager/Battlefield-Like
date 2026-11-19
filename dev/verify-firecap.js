// ─────────────────────────────────────────────
// dev/verify-firecap.js —— 火焰寿命上限/火情查询机制验证 (不进 Index.html)
// 载入 00-config + 04b-fire (VM 沙箱, 与 2026-09-02 火情规避/燃烧弹缩短同轮引入):
//  1) igniteArea(...,lifeCap) 点燃的格在 cap 秒强制熄灭 (无上限对照组仍自然烧尽 ~9.6s);
//  2) cap 随蔓延继承 (cap 格引燃的邻格同样提前熄火);
//  3) fireThreat(x,z,clear) 返回指向最近火心向量 / 净距足够时 null。
// 用法: node dev/verify-firecap.js
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'), path=require('path'), vm=require('vm');
const root=path.resolve(__dirname,'..');
function load(file,sb){
const code=fs.readFileSync(path.join(root,file),'utf8');
vm.runInContext(code,vm.createContext(sb),{filename:file});
}
const sb={console,Math,Date};
sb.localStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
sb.window=sb; sb.addEventListener=()=>{}; sb.document={createElement:()=>({getContext:()=>({fillRect(){},beginPath(){},ellipse(){},fill(){},createLinearGradient:()=>({addColorStop(){}})})}),body:{appendChild(){}}};
sb.MAP_SIZE=320;
sb.TAU=Math.PI*2; sb.HPI=Math.PI/2;
sb.clamp=(v,a,b)=>v<a?a:(v>b?b:v);
let _s=42; sb.wr=(a,b)=>a+(b-a)*((_s=(_s*16807)%2147483647)/2147483647);
sb.rand=(a,b)=>sb.wr(a,b); sb.randi=(a,b)=>Math.floor(sb.wr(a,b+1));
sb.heightAt=()=>0;
sb.SETTINGS={quality:2};
sb.camera={position:{x:0,y:30,z:0}};
sb.spawnP=()=>{}; sb.PT={smoke:1,dark:1,flash:1,dirt:1,spark:1,flame:2};
sb.spawnFlame=(x,y,z,vx,vy,vz,size,grow,life,opa,grav)=>{ sb.spawnP(sb.PT.flame,x,y,z,vx,vy,vz,size,grow,life,opa===undefined?0.85:opa,grav===undefined?-1:grav,true); return null; };   // ★2026-11-19 火焰重做批: 轻沙箱 spawnP 本就是 no-op 桩, spawnFlame 同哲学委托
sb.OCC={res:1,N:0,off:180,data:null};
sb.combatants=[]; sb.tanks=[];
load('js/00-config.js',sb);
load('js/04b-fire.js',sb);
const run=code=>vm.runInContext(code,vm.createContext(sb));
// ── 1) 寿命上限: 点燃带 cap=3 的格, 3.5s 后必须熄灭 ──
run(`
fuelAdd(0,0,1.15); fuelAdd(10,0,1.15);
igniteArea(0,0,1,'attacker',3);
igniteArea(10,0,1,'attacker'); // 对照组: 无上限
`);
const CI1=run('fCellI(0,0)'), CI2=run('fCellI(10,0)');
let dt=1/30, t=0, died=0, diedUncapped=0;
while(t<25){
run('updateFires(1/30);');
t+=dt;
if(!died && run(`FBURN[${CI1}]`)<=0){ died=t; }
if(!diedUncapped && run(`FBURN[${CI2}]`)<=0){ diedUncapped=t; }
if(died&&diedUncapped) break;
}
console.log(`capped(3s) 实际熄灭于 ${died?died.toFixed(2):'未'}s (期望≈3.0-3.3s)`);
console.log(`uncapped 对照熄灭于 ${diedUncapped?diedUncapped.toFixed(2):'未'}s (期望≈20.9s, 总体烧毁时间增加)`);
if(!(died>2.8&&died<3.6)) { console.log('✘ cap 未生效'); process.exit(1); }
if(!(diedUncapped>18)) { console.log('✘ 对照组异常'); process.exit(1); }
console.log('✔ 寿命上限生效, 无上限火不受影响');
// ── 2) 蔓延继承: cap 格引燃的邻格也带 cap ──
run(`
fuelAdd(100,0,1.15); fuelAdd(103,0,1.15); fuelAdd(106,0,1.15);
igniteArea(100,0,1,'a',4);
`);
t=0; let allOut=0;
while(t<20){ run('updateFires(1/30);'); t+=dt;
const n=run('FIRE_ACTIVE.length');
if(n===0&&t>4){ allOut=t; break; }
}
console.log(`三点链 (cap=4) 全部熄灭于 ${allOut?allOut.toFixed(2):'未'}s (期望 <8s, 无cap时>10s)`);
if(!(allOut>0&&allOut<8)){ console.log('✘ cap 未随蔓延继承'); process.exit(1); }
console.log('✔ 蔓延继承上限生效');
// ── 3) fireThreat: 方向与阈值 (注意火网格只覆盖 ±(MAP_SIZE/2+20), 点火点取 150) ──
run(`
fuelAdd(150,0,1.15);
igniteArea(150,0,1,'a');
`);
run('updateFires(0.016); updateFires(0.016);');
const th1=run('fireThreat(152.5,0,2.0)');   // 距格心 ~2.6 → 净距 ~0.6 <2.0 → 威胁
const th2=run('fireThreat(157,0,2.0)');     // 距格心 ~7 → 净距 ~5 >2.0 → 无
console.log(`fireThreat(152.5) = ${JSON.stringify(th1)}; fireThreat(157) = ${JSON.stringify(th2)}`);
if(!th1||Math.abs(th1.dx-(-1))>0.01||Math.abs(th1.dz-1.5)>0.01){ console.log('✘ fireThreat 方向/判定错误'); process.exit(1); }
if(th2!==null){ console.log('✘ fireThreat 远距应返回 null'); process.exit(1); }
console.log('✔ fireThreat 方向与阈值正确');
console.log('全部通过 ✔');
