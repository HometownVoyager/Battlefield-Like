// dev/_steppe-pocket-probe.js —— 强点/出生点"死袋"根因诊断 (临时探针, 只读)
//   背景 (2026-09-26 审计 P0-3): 草原库尔斯克 7 个强点里, 约一半的 boot 会出现某个强点被布景/工事
//   封成 2~8 格的孤岛 (主分量 1.6 万格), 出生点可站立性判据 (verify-navspots-20260926) 判罪。
//   本探针复刻 07-nav 的 NAV 网格 (5m 格 / 格心开放 / 格心连线 0.9m 采样) 与 8 邻域分量,
//   把每个强点的分量大小与其阵营基地比一次; 出现小分量就把该点周围的 OCC 1m 图 + 碰撞盒清单打出来。
//   用法: node dev/_steppe-pocket-probe.js [战役序号=8] [boot 次数=3]
'use strict';
const fs=require('fs'),path=require('path');
const probeSrc=fs.readFileSync(path.join(__dirname,'probe-spawn.js'),'utf8');
const cut=probeSrc.indexOf('const REPORT_FN=');
const head=probeSrc.slice(0,cut);
const VM_BODY=`
const SP=5, N=Math.floor(MAP_SIZE/SP)+1, OFF=MAP_SIZE/2, NN=N*N;
const toW=(i,j)=>[i*SP-OFF, j*SP-OFF];
const toG=(x,z)=>[clamp(Math.round((x+OFF)/SP),0,N-1), clamp(Math.round((z+OFF)/SP),0,N-1)];
const open=new Uint8Array(NN), comp=new Int32Array(NN).fill(-1), csize=[];
// 与 07-nav 同口径 (2026-09-26 P0-3 补强): 格开放 = 格心空 或 四象限 >=3 空; 边 = 中线或 ±1.5 并行线任一通
const NAV_EDGE_PAD=1.5, NAV_OPEN_Q=1.25;
const lineOK=(x1,z1,x2,z2)=>{
const d=Math.hypot(x2-x1,z2-z1), steps=Math.max(1,Math.ceil(d/0.9));
for(let s=0;s<=steps;s++){ const t=s/steps; if(occBlocked(x1+(x2-x1)*t,z1+(z2-z1)*t)) return false; }
return true;
};
const edgeOK=(x1,z1,x2,z2)=>{
if(lineOK(x1,z1,x2,z2)) return true;
const dx=x2-x1, dz=z2-z1, len=Math.hypot(dx,dz)||1;
const px=-dz/len*NAV_EDGE_PAD, pz=dx/len*NAV_EDGE_PAD;
if(lineOK(x1+px,z1+pz,x2+px,z2+pz)) return true;
if(lineOK(x1-px,z1-pz,x2-px,z2-pz)) return true;
return false;
};
const E=(i,j,di,dj)=>{ if(i+di<0||i+di>=N||j+dj<0||j+dj>=N) return false; const a=toW(i,j), b=toW(i+di,j+dj); return edgeOK(a[0],a[1],b[0],b[1]); };
const EOK=[];
for(let j=0;j<N;j++)for(let i=0;i<N;i++){
const k=j*N+i, a=toW(i,j);
if(!occBlocked(a[0],a[1])){ open[k]=1; } else {
let q=0;
if(!occBlocked(a[0]+NAV_OPEN_Q,a[1]+NAV_OPEN_Q)) q++;
if(!occBlocked(a[0]+NAV_OPEN_Q,a[1]-NAV_OPEN_Q)) q++;
if(!occBlocked(a[0]-NAV_OPEN_Q,a[1]+NAV_OPEN_Q)) q++;
if(!occBlocked(a[0]-NAV_OPEN_Q,a[1]-NAV_OPEN_Q)) q++;
open[k]=q>=3?1:0;
}
}
for(let j=0;j<N;j++)for(let i=0;i<N;i++){
const k=j*N+i; const a=toW(i,j); const row=[];
for(const [di,dj] of [[1,0],[0,1],[1,1],[1,-1]]) row.push(open[k]&&(i+di>=0&&i+di<N&&j+dj>=0&&j+dj<N)&&open[(j+dj)*N+(i+di)]?edgeOK(a[0],a[1],toW(i+di,j+dj)[0],toW(i+di,j+dj)[1]):false);
EOK.push(row);
};
let cid=0;
const stk=[];
for(let k=0;k<NN;k++){
if(!open[k]||comp[k]>=0) continue;
comp[k]=cid; stk.length=0; stk.push(k); let n=0;
while(stk.length){
const c=stk.pop(); n++;
const i=c%N, j=(c-i)/N;
const near=[[1,0],[0,1],[-1,0],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
for(const [di,dj] of near){
if(i+di<0||i+di>=N||j+dj<0||j+dj>=N) continue;
const k2=(j+dj)*N+(i+di); if(!open[k2]||comp[k2]>=0) continue;
if(!E(i,j,di,dj)) continue;
comp[k2]=cid; stk.push(k2);
}
}
csize[cid]=n; cid++;
}
const compOf=(x,z)=>{ const g=toG(x,z); return comp[g[1]*N+g[0]]; };
const sizeOf=(g)=>g<0?0:csize[g];
const rows=[];
for(const b of BASES) rows.push('BASE ('+b.x+','+b.z+') 分量='+compOf(b.x,b.z)+' 格数='+sizeOf(compOf(b.x,b.z)));
for(const f of FLAGS) rows.push('FLAG '+f.id+' ('+f.x+','+f.z+') 分量='+compOf(f.x,f.z)+' 格数='+sizeOf(compOf(f.x,f.z)));
for(const sp of (CAMPAIGN.spawns||[])){
const g=compOf(sp.x,sp.z), sz=sizeOf(g);
const baseG=compOf(basePos(sp.team===1?1:0).x,basePos(sp.team===1?1:0).z);
const bad=(g<0)||(g!==baseG&&sz<400);
rows.push((bad?'  ✗':'  ·')+' 强点 '+sp.name+' ('+sp.x+','+sp.z+') team='+sp.team+' 分量='+g+' 格数='+sz+' 基地分量='+baseG+(bad?'  ⟵ 死袋/孤立':''));
if(!bad) continue;
// ── 死袋: 先逐边给"哪条边被谁挡住" (决定性证据), 再给 OCC 图 ──
{
const [gi,gj]=toG(sp.x,sp.z);
const a=toW(gi,gj);
const who=(x,z)=>{
const hits=[];
// 判据与 buildOccupancy 逐条同源: BOX 外扩 0.6 且 maxY>=gh+0.5 且 minY<=gh+1.75; CYL r>=0.28 外扩 0.6; wires r*0.85
for(const b of BOXES){
if(b.dead) continue;
if(x<b.minX-0.6||x>b.maxX+0.6||z<b.minZ-0.6||z>b.maxZ+0.6) continue;
if(b.maxY<b.gh+0.5||b.minY>b.gh+1.75) continue;
hits.push('BOX ('+((b.minX+b.maxX)/2).toFixed(1)+','+((b.minZ+b.maxZ)/2).toFixed(1)+') 尺寸'+((b.maxX-b.minX).toFixed(2))+'×'+(b.maxY-b.minY).toFixed(2)+'×'+((b.maxZ-b.minZ).toFixed(2))+' 顶'+b.maxY.toFixed(2)+' 地'+b.gh.toFixed(2));
}
for(const c of CYLS){ if(c.r<0.28) continue; if(Math.hypot(x-c.x,z-c.z)<=c.r+0.6) hits.push('CYL ('+c.x.toFixed(1)+','+c.z.toFixed(1)+') r='+c.r.toFixed(2)+' y='+c.y0.toFixed(1)+'~'+c.y1.toFixed(1)); }
for(const w of wires){ if(!w.alive) continue; const rr=Math.max(0.6,w.r*0.85); if(Math.hypot(x-w.x,z-w.z)<=rr) hits.push('WIRE ('+w.x.toFixed(1)+','+w.z.toFixed(1)+') r='+w.r.toFixed(2)); }
return hits.join(' + ')||'(无碰撞盒/圆柱/铁丝网 — 应为静态地貌层 OCC 直接写入)';
};
rows.push('  死袋格中心 ('+a[0]+','+a[1]+')  OCC='+occBlocked(a[0],a[1])+'  分量格数='+sz);
for(const [di,dj] of [[1,0],[0,1],[-1,0],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
const i2=gi+di, j2=gj+dj;
if(i2<0||j2<0||i2>=N||j2>=N){ rows.push('   边 ('+di+','+dj+'): 出图'); continue; }
if(!open[j2*N+i2]){ rows.push('   边 ('+di+','+dj+'): 邻格封闭 (中心 '+toW(i2,j2).join(',')+') ⇒ 该格方向不可通行'); continue; }
const b=toW(i2,j2);
const d=Math.hypot(b[0]-a[0],b[1]-a[1]), steps=Math.max(1,Math.ceil(d/0.9));
let blockedAt=null;
{
const dx=b[0]-a[0], dz=b[1]-a[1], ln=Math.hypot(dx,dz)||1;
const tryLine=(ox,oz)=>{ const d2=Math.hypot(b[0]-a[0],b[1]-a[1]), steps2=Math.max(1,Math.ceil(d2/0.9)); for(let s=0;s<=steps2;s++){ const t=s/steps2; const x=a[0]+dx*t+ox, z=a[1]+dz*t+oz; if(occBlocked(x,z)) return [x,z]; } return null; };
const p1=tryLine(0,0);
if(p1){ const px=-dz/ln*1.5, pz=dx/ln*1.5; const p2=tryLine(px,pz)||tryLine(-px,-pz); if(p2) blockedAt=p2; }
}
rows.push('   边 ('+di+','+dj+'): '+(blockedAt?('✗ 被挡在 ('+blockedAt[0].toFixed(2)+','+blockedAt[1].toFixed(2)+') ← '+who(blockedAt[0],blockedAt[1])):'✓ 通'));
}
}
rows.push('  OCC 1m 窗口 (x:'+(sp.x-26)+'..'+(sp.x+26)+', z:'+(sp.z-26)+'..'+(sp.z+26)+'), 行=z 从 '+(sp.z-26)+' 起, # = 阻挡, = = 水障, . = 空, P = 强点, C = 死袋格中心');
for(let dz=-26;dz<=26;dz++){
let line='   ';
for(let dx=-26;dx<=26;dx++){
const x=sp.x+dx, z=sp.z+dz;
const i=Math.round((x+OCC.off)/OCC.res), j=Math.round((z+OCC.off)/OCC.res);
let c='.';
if(Math.abs(dx)<0.5&&Math.abs(dz)<0.5) c='P';
else if(i<0||j<0||i>=OCC.N||j>=OCC.N) c=' ';
else { const v=OCC.data[j*OCC.N+i]; c=(v===0)?'.':(v===2?'=':'#'); }
line+=c;
}
rows.push(line);
}
// ── 邻近碰撞盒 (按水平面积排序, 前 26 个) ──
const near=[];
for(const b of BOXES){
const cx=(b.minX+b.maxX)/2, cz=(b.minZ+b.maxZ)/2;
const d=Math.hypot(cx-sp.x,cz-sp.z);
if(d<24&&b.maxY>heightAt(cx,cz)-0.5) near.push({d,cx,cz,w:b.maxX-b.minX,h:b.maxY-b.minY,dp:b.maxZ-b.minZ,top:b.maxY,gh:b.gh});
}
near.sort((a,b)=>b.w*b.dp-a.w*a.dp);
rows.push('  邻近碰撞盒 (24m 内, 按面积降序, 前 26):');
for(const b of near.slice(0,26)) rows.push('    d='+b.d.toFixed(1)+'m 中心('+b.cx.toFixed(1)+','+b.cz.toFixed(1)+') 尺寸 '+b.w.toFixed(2)+'×'+b.dp.toFixed(2)+'×h'+b.h.toFixed(2)+' 顶='+b.top.toFixed(2)+' 地='+(b.gh!==undefined?b.gh.toFixed(2):'-'));
const nearC=[];
for(const c of CYLS){ const d=Math.hypot(c.x-sp.x,c.z-sp.z); if(d<24) nearC.push({d,...c}); }
nearC.sort((a,b)=>a.d-b.d);
rows.push('  PROPS 5m 内 (半径指纹): '+PROPS.filter(p=>Math.hypot(p.x-sp.x,p.z-sp.z)<5).map(p=>'('+p.x.toFixed(2)+','+p.z.toFixed(2)+') r='+p.r.toFixed(3)).join(' | '));
rows.push('  邻近圆柱 (24m 内, 前 20): '+nearC.slice(0,20).map(c=>'d='+c.d.toFixed(1)+' r='+c.r.toFixed(2)+' y='+c.y0.toFixed(1)+'~'+c.y1.toFixed(1)).join(' | '));
rows.push('  该点所在 5m 格的 8 邻域:');
{ const [gi,gj]=toG(sp.x,sp.z);
for(let dj=-4;dj<=4;dj++){ let line='   ';
  for(let di=-4;di<=4;di++){
  const i=gi+di, j=gj+dj;
  if(i<0||j<0||i>=N||j>=N){ line+='  .. '; continue; }
  const k=j*N+i;
  line+=(open[k]?(' '+String(comp[k]%100).padStart(2,' ')+' '):' ### ');
  }
  rows.push(line);
}
}
}
return rows;
`;
const tail=`
const ci=parseInt(process.argv[2]||'8');
const nb=parseInt(process.argv[3]||'3');
for(let run=0;run<nb;run++){
let ctx;
try{ ctx=boot(ci,42); }catch(e){ console.log('run'+run+' BOOT-ERR '+e.message); continue; }
const out=vm.runInContext(\`(()=>{ ${VM_BODY} })()\`,ctx);
console.log('=== run '+run+' ===');
for(const r of out) console.log(r);
}
`;
const tmp=path.join(__dirname,'_steppe-pocket-probe-tmp.js');
fs.writeFileSync(tmp,'// AUTO-GEN\n'+head+tail);
const {execFileSync}=require('child_process');
try{ console.log(execFileSync(process.execPath,[tmp,...process.argv.slice(2)],{encoding:'utf8',stdio:['ignore','pipe','pipe']})); }
catch(e){ console.log('ERR',e.stdout,e.stderr); }
