// dev/_spawnflat-probe.js —— 出生平台"削深"普查 (临时探针, 只读)
//   问一件事: 03-terrain 的 spawns 平台按 addFlat 缺省口径 (h=rawHeight*0.55) 落地时, 每个出生点被
//   削掉多深 (削深 = rawHeight - 平台高 = 0.45*rawHeight)。削深 >2m 的点 = 山坡上被挖出的坑。
//   用法: node dev/_spawnflat-probe.js [战役序号...]   (缺省全部 12 图)
'use strict';
const fs=require('fs'),path=require('path');
const probeSrc=fs.readFileSync(path.join(__dirname,'probe-spawn.js'),'utf8');
const cut=probeSrc.indexOf('const REPORT_FN=');
const head=probeSrc.slice(0,cut);
const tail=`
const idxs=(process.argv.slice(2).length?process.argv.slice(2):['0','1','2','3','4','5','6','7','8','9','10','11']).map(Number);
for(const ci of idxs){
let ctx;
try{ ctx=boot(ci,42); }catch(e){ console.log('cam'+ci+' BOOT-ERR '+e.message); continue; }
const out=vm.runInContext(\`(()=>{
const rows=[];
const sps=(CAMPAIGN.spawns||[]);
let worst=0, n=0;
for(const s of sps){
const raw=rawHeight(s.x,s.z), plat=raw*0.55;
const d=raw-plat;
if(d>worst) worst=d;
if(d>2) n++;
rows.push('  '+(s.name||'?')+' ('+s.x+','+s.z+') team='+s.team+' raw='+raw.toFixed(2)+' 平台='+plat.toFixed(2)+' 削深='+d.toFixed(2)+'m heightAt='+heightAt(s.x,s.z).toFixed(2));
}
const flags=(CAMPAIGN.flags||[]).map(f=>f.x+','+f.z);
rows.unshift('cam='+CAMPAIGN.id+' terr='+CAMPAIGN.terr+' spawns='+sps.length+' 削深>2m 的点='+n+' 最深='+worst.toFixed(2)+'m');
return rows;
})()\`,ctx);
for(const r of out) console.log(r);
}
`;
const tmp=path.join(__dirname,'_spawnflat-probe-tmp.js');
fs.writeFileSync(tmp,'// AUTO-GEN\n'+head+tail);
const {execFileSync}=require('child_process');
try{ console.log(execFileSync(process.execPath,[tmp,...process.argv.slice(2)],{encoding:'utf8',stdio:['ignore','pipe','pipe']})); }
catch(e){ console.log('ERR',e.stdout,e.stderr); }
