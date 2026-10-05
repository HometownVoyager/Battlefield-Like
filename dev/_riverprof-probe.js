// dev/_riverprof-probe.js —— 河道物理剖面 / 浅滩走廊 结构判据 (临时探针, 只读)
//   回答两件事 (供审计第 26 条定口径):
//   ① 沿河心线逐点: 河床 bed / 参考岸高 bank / 水面 wy / 水深 dep / waterStateAt 分档
//      —— 判"声明为浅河的图 (RIVER.d 未定义) 物理上是否真的可涉渡 (dep ≤ SWIM_DEPTH)"
//   ② 若把"水深 > SWIM_DEPTH"的格记为水障 (OCC v=2), 两岸是否仍连通 (4m 网格 BFS)
//      —— 判"NAV 改按真实水深记水障"会不会把地图切成两半
//   用法: node dev/_riverprof-probe.js [战役序号...]   (缺省 0 3 5 6 7 11 = 全 11 图)
'use strict';
const fs=require('fs'),path=require('path');
const probeSrc=fs.readFileSync(path.join(__dirname,'probe-spawn.js'),'utf8');
const cut=probeSrc.indexOf('const REPORT_FN=');
const head=probeSrc.slice(0,cut);
const tail=`
const idxs=(process.argv.slice(2).length?process.argv.slice(2):['0','1','2','3','4','5','6','7','8','9','10']).map(Number);
for(const ci of idxs){
const ctx=boot(ci,42);
const out=vm.runInContext(\`(()=>{
const rows=[];
const line=(s)=>rows.push(s);
line('=== cam='+CAMPAIGN.id+' RIVER='+(RIVER?JSON.stringify({w:RIVER.w,d:RIVER.d,ice:!!RIVER.ice,ford:!!RIVER.ford}):'null')+' DELTA_CHANS='+DELTA_CHANS.length+' ===');
if(!RIVER&&!DELTA_CHANS.length){ line('  (无河)'); return rows; }
// 逐条水带 (主河 + 淞沪支流汊港) 同一套量法
const strips=[];
if(RIVER) strips.push({tag:'主河',P:RIVER.pts,w:RIVER.w,ice:!!RIVER.ice,d:RIVER.d});
for(const ch of DELTA_CHANS) strips.push({tag:'汊港',P:ch,w:DELTA.w||3.4,ice:false,d:DELTA.d||1.35});
for(const ST of strips){
const P=ST.P, hw=ST.w*0.95;
if(ST.tag==='汊港') line('  -- 汊港 w='+ST.w+' d='+ST.d+' 点数='+P.length+' --');
// ① 沿河心线剖面 (折线每段取 5 点, 每点同时给"横断面最深处")
let n=0, swimN=0, deepMax=-9, wadeN=0, dryN=0, sumDep=0, holeN=0;
for(let i=0;i<P.length-1;i++){
const ax=P[i][0],az=P[i][1],bx=P[i+1][0],bz=P[i+1][1];
const L=Math.hypot(bx-ax,bz-az), nx=-(bz-az)/L, nz=(bx-ax)/L;
for(let k=0;k<=4;k++){
const t=k/4, x=ax+(bx-ax)*t, z=az+(bz-az)*t;
const bed=heightAt(x,z,true);
const wy=waterYAt(x,z);
const dep=wy<=-1e8?-999:wy-bed;
const st=waterStateAt(x,wy>1e8?bed:wy-0.1,z).state;   // 脚在水面下 0.1m 处的分档
n++; sumDep+=Math.max(dep,0);
if(wy<=-1e8) holeN++;
if(dep>SWIM_DEPTH) swimN++; else if(dep>WADE_DEPTH) wadeN++; else if(dep>=0) dryN++;
if(dep>deepMax) deepMax=dep;
if(k===0||k===4) line('  ('+x.toFixed(0)+','+z.toFixed(0)+') bed='+bed.toFixed(2)+' wy='+(wy<=-1e8?'-':wy.toFixed(2))+' dep='+(dep<=-999?'-':dep.toFixed(2))+' st='+st);
}
}
line('  [心线剖面] 采样='+n+' **无水面(-1e9)='+holeN+'** 游泳档(>'+SWIM_DEPTH+')='+swimN+'('+(100*swimN/n).toFixed(0)+'%) 涉水档='+wadeN+' 浅/干='+dryN+' 最深='+deepMax.toFixed(2)+' 均深='+(sumDep/n).toFixed(2));
// ② 横断面: 沿河每隔 ~24m 切一刀, 量中心最深与"浅于 SWIM_DEPTH 的带"
let cutN=0, cutAllDeep=0, cutWid=[];
for(let i=0;i<P.length-1;i++){
const ax=P[i][0],az=P[i][1],bx=P[i+1][0],bz=P[i+1][1];
const L=Math.hypot(bx-ax,bz-az), nx=-(bz-az)/L, nz=(bx-ax)/L;
const nCut=Math.max(1,Math.round(L/24));
for(let c=0;c<nCut;c++){
const t=(c+0.5)/nCut, x=ax+(bx-ax)*t, z=az+(bz-az)*t;
let shallowW=0;
for(let o=-hw;o<=hw;o+=2){ const dep=waterDepthAt(x+nx*o,z+nz*o); if(!(dep>SWIM_DEPTH)) shallowW+=2; }
cutN++; if(shallowW<2) cutAllDeep++; cutWid.push(shallowW);
}
}
cutWid.sort((a,b)=>a-b);
line('  [横断面] 刀数='+cutN+' 整刀全深(无浅带)='+cutAllDeep+' 浅带宽度 中位='+cutWid[Math.floor(cutN/2)].toFixed(0)+'m 最小='+cutWid[0].toFixed(0)+'m 最大='+cutWid[cutN-1].toFixed(0)+'m');
}   // ← strips 循环结束
// ③ 若"水深>SWIM_DEPTH"记为水障, 两岸连通性 (4m 网格, 只判河带附近 ±60m)
const R=4, SPAN=64;
const N2=Math.floor(SPAN*2/R)+1;
const deep=new Uint8Array(N2*N2);
for(let j=0;j<N2;j++)for(let i=0;i<N2;i++){
const x=i*R-SPAN, z=j*R-SPAN;
deep[j*N2+i]=(waterDepthAt(x,z)>SWIM_DEPTH)?1:0;
}
// 连通: 从中心竖列上下两侧出发, 判"只走非水障格"能否跨过河带 (BFS 全图, 判南北两个河外锚点)
const vis=new Uint8Array(N2*N2);
const q=[];
for(let i=0;i<N2;i++){ const k=0*N2+i; if(!deep[k]){vis[k]=1;q.push(k);} }
while(q.length){
const k=q.pop(), i=k%N2, j=(k-i)/N2;
for(const d of [[1,0],[-1,0],[0,1],[0,-1]]){
const i2=i+d[0], j2=j+d[1];
if(i2<0||j2<0||i2>=N2||j2>=N2) continue;
const k2=j2*N2+i2; if(vis[k2]||deep[k2]) continue; vis[k2]=1; q.push(k2);
}
}
let reach=0, tot=0;
for(let k=0;k<N2*N2;k++){ if(!deep[k]){ tot++; if(vis[k]) reach++; } }
line('  [水障连通] 非水障格='+tot+' 与北缘连通='+reach+(reach===tot?' (整片连通)':' (**有 '+((tot-reach))+' 格被水障隔断**)'));
return rows;
})()\`,ctx);
for(const r of out) console.log(r);
}
`;
const tmp=path.join(__dirname,'_riverprof-probe-tmp.js');
fs.writeFileSync(tmp,'// AUTO-GEN\n'+head+tail);
const {execFileSync}=require('child_process');
try{ console.log(execFileSync(process.execPath,[tmp,...process.argv.slice(2)],{encoding:'utf8',stdio:['ignore','pipe','pipe']})); }
catch(e){ console.log('ERR',e.stdout,e.stderr); }
