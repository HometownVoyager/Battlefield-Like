// dev/_vegwater-probe.js —— "植被落水"结构判据 (临时探针, 只读)
//   复刻 05c 树木/草丛落位门的**排除条件**(roadDist/inRiverChannel/SEA/city/freeSpot/fieldAt/FLATS),
//   在整图上按 2m 网格统计: 有多少个"真水面"格能通过这道门 —— 个数>0 即"树可以长在水里"。
//   注意: 只判"门是否放行", 不重放随机流 (沙箱无种子 RNG), 故给出的是**结构结论**而非具体实例。
// 用法: node dev/_vegwater-probe.js [战役序号...]   (缺省 0 3 5 6 7 11)
'use strict';
const fs=require('fs'),path=require('path');
const probeSrc=fs.readFileSync(path.join(__dirname,'probe-spawn.js'),'utf8');
const cut=probeSrc.indexOf('const REPORT_FN=');
const head=probeSrc.slice(0,cut);
const tail=`
const idxs=(process.argv.slice(2).length?process.argv.slice(2):['0','3','5','6','7','11']).map(Number);
for(const ci of idxs){
const ctx=boot(ci,42);
const out=vm.runInContext(\`(()=>{
const rows=[];
const TR=MAP_SIZE/2-8;
let water=0, pass=0, ex=[];
for(let x=-TR;x<=TR;x+=2)for(let z=-TR;z<=TR;z+=2){
const wy=waterYAt(x,z);
if(wy<=-1e8) continue;
const dep=wy-heightAt(x,z,true);
if(!(dep>0.05)) continue;         // 只查真水面 (含 3cm 级浅水)
water++;
// ↓ 复刻 05c 树木落位门 (与树干/草丛同一组排除)
if(roadDist(x,z)<7) continue;
if(inRiverChannel(x,z)) continue;
if(SEA&&shoreDist(x,z)>-16) continue;
if(SEA&&rectDist(x,z,SEA.runway.x0-6,SEA.runway.z0-6,SEA.runway.x1+6,SEA.runway.z1+6)<=0) continue;
if(CITY&&cityUrban(x,z)) continue;
if(!freeSpot(x,z,1.3)) continue;
if(RURAL_FIELDS.length&&fieldAt(x,z)) continue;
let near=false;
for(const f of FLATS){ if(Math.hypot(x-f.x,z-f.z)<f.r*((CAMPAIGN.layout==='jungle'||CAMPAIGN.layout==='deepjungle')?0.5:0.85)) near=true; }
if(near) continue;
pass++;
if(ex.length<3) ex.push('('+x+','+z+')水深'+dep.toFixed(2)+'m');
}
rows.push('cam='+CAMPAIGN.id+' 水面采样格='+water+' 其中**能通过树门**='+pass+(ex.length?(' 例:'+ex.join(' ')):''));
return rows;
})()\`,ctx);
for(const r of out) console.log(r);
}
`;
const tmp=path.join(__dirname,'_vegwater-probe-tmp.js');
fs.writeFileSync(tmp,'// AUTO-GEN\n'+head+tail);
const {execFileSync}=require('child_process');
try{ console.log(execFileSync(process.execPath,[tmp,...process.argv.slice(2)],{encoding:'utf8',stdio:['ignore','pipe','pipe']})); }
catch(e){ console.log('ERR',e.stdout,e.stderr); }
