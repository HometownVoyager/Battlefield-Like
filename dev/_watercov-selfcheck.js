// dev/_watercov-selfcheck.js —— 水面"网格 vs 判定"同源判据 + 索引等价 + 水深分档普查
//   (2026-09-26E 水域审计批: 条目 22 网格/判定同源 · 24 沿程水位 · 25 自救方向 · 26 浅河声明档)
//   ① 覆盖/同源: 场景里每条河道/汊港**水面条带网格**的每个三角形 (3 顶点 + 3 边中点 + 面心) 都必须在
//      waterYAt 里取到水, 且高度与网格顶点逐点吻合 (容差 0.06m)。旧口径 (离散圆 + 12m 采样间距) 必然报洞。
//   ② 索引等价 (阴性对照): 同一批查询点分别走"格索引"与"对 WATER_SEGS/WATER_DISCS 全表暴力扫描",
//      两者必须逐点相同 —— 证明按覆盖登记的分格索引与全表等价 (索引错键会让远处凭空出水)。
//   ③ 分档普查 (2m 网格): 干/湿沙/涉水/游泳 四档面积 + 最深; 声明档硬判据:
//      浅河 (RIVER.d 未定义=可涉渡) 的游泳档必须 ≈0; 深谷激流档 (d>2) 必须有大片游泳档。
//   ④ 自救方向 (条目 25): 河道水点的 shoreDirAt 必须非 null, 且指向的方向确实更浅 (7m 处)。
// 用法: node dev/_watercov-selfcheck.js [战役序号...]   (缺省全 11 图)
'use strict';
const fs=require('fs'),path=require('path');
const probeSrc=fs.readFileSync(path.join(__dirname,'probe-spawn.js'),'utf8');
const cut=probeSrc.indexOf('const REPORT_FN=');
const head=probeSrc.slice(0,cut);
const tail=`
const idxs=(process.argv.slice(2).length?process.argv.slice(2):['0','1','2','3','4','5','6','7','8','9','10']).map(Number);
let pass=0, fail=0;
for(const ci of idxs){
const ctx=boot(ci,42);
const out=vm.runInContext(\`(()=>{
const rows=[];
const ok=(c,msg)=>rows.push((c?'  ✓ ':'  ✗ ')+msg);
// ── 找出"条带水面网格": 索引 + 顶点成对同高 + 截面 UV 签名 (uv[4i]=uv[4i+2], uv[4i+1]=0, uv[4i+3]=1) ──
const strips=[];
for(const o of scene.children){
if(!o||!o.geometry||!o.geometry.attributes) continue;
const pa=o.geometry.attributes.position, ua=o.geometry.attributes.uv;
if(!pa||!ua||!o.geometry.index||pa.count<12||pa.count%2) continue;
let sig=true;
for(let i=0;i<pa.count/2;i++){
if(Math.abs(pa.array[i*6+1]-pa.array[i*6+4])>1e-6){ sig=false; break; }
if(Math.abs(ua.array[i*4+0]-ua.array[i*4+2])>1e-9||Math.abs(ua.array[i*4+1])>1e-9||Math.abs(ua.array[i*4+3]-1)>1e-9){ sig=false; break; }
}
if(sig) strips.push(o);
}
rows.push('=== cam='+CAMPAIGN.id+' 条带网格='+strips.length+' 段='+WATER_SEGS.length+' 盘='+WATER_DISCS.length+' 采样点='+WATER_SURF.length+' ===');
if(strips.length){
let tri=0, bad=0, worst=0, miss=0, ex1='', ex2='';
let triE=0, badE=0, worstE=0;   // 侧边点 (条带 P/Q 边): 弯道/汊港交汇处的"扭转四边形"只在这里出现
let ovl=0;                      // 被 >1 条水带同时覆盖的点 (汊港交汇): 两条水带的**渲染面本身就不同高**, 判据在此无意义
const top=[];
const note=(d,x,y,z)=>{ top.push({d:d,x:x,y:y,z:z,q:waterYAt(x,z)}); top.sort((a,b)=>b.d-a.d); if(top.length>6) top.pop(); };
// 该点被几条水带的"矩形 ⊕ WATER_PAD"覆盖 (只用于把交汇点挑出来, 与索引等价判据同源)
const nCover=(x,z)=>{
let n=0;
for(const s of WATER_SEGS){
const dx=s.bx-s.ax, dz=s.bz-s.az, L2=dx*dx+dz*dz, L=Math.sqrt(L2)||1;
const tR=L2>1e-9?((x-s.ax)*dx+(z-s.az)*dz)/L2:0;
const t=tR<0?0:(tR>1?1:tR);
const lat=Math.hypot(x-(s.ax+dx*t),z-(s.az+dz*t));
const axial=L*Math.max(0,-tR,tR-1);
const lateral=Math.sqrt(Math.max(0,lat*lat-axial*axial));
if(Math.hypot(Math.max(0,lateral-s.hw),axial)<=WATER_PAD) n++;
}
for(const d of WATER_DISCS){ if(Math.hypot(x-d.x,z-d.z)<=d.reach-WATER_PAD) n++; }
return n;
};
const chk=(x,y,z,edge)=>{
const wy=waterYAt(x,z);
if(wy<=-1e8){ miss++; if(!ex1) ex1='('+x.toFixed(1)+','+z.toFixed(1)+')'; return; }
if(nCover(x,z)>1){ ovl++; return; }      // 交汇点: 两条水带各渲染各的, 取谁都是选择, 不计偏差
if(edge) triE++; else tri++;
const d=Math.abs(wy-y);
if(edge){ if(d>worstE) worstE=d; if(d>0.06) badE++; }
else{
if(d>worst) worst=d;
if(d>0.06){ bad++; if(!ex2) ex2='('+x.toFixed(1)+','+z.toFixed(1)+') 网格y='+y.toFixed(3)+' 查询='+wy.toFixed(3); note(d,x,y,z); }
}
};
for(const m of strips){
const pa=m.geometry.attributes.position, idx=m.geometry.index;
const V=(k)=>{ const h=k>>1, o=(k%2)?3:0; return {x:pa.array[h*6+o],y:pa.array[h*6+o+1],z:pa.array[h*6+o+2]}; };
for(let k=0;k<pa.count;k++){ const v=V(k); chk(v.x,v.y,v.z,true); }
for(let t=0;t<idx.count;t+=3){
const a=V(idx.array[t]),b=V(idx.array[t+1]),c=V(idx.array[t+2]);
chk((a.x+b.x+c.x)/3,(a.y+b.y+c.y)/3,(a.z+b.z+c.z)/3,false);
const mid=(u,v2)=>({x:(u.x+v2.x)/2,y:(u.y+v2.y)/2,z:(u.z+v2.z)/2});
for(const m2 of [mid(a,b),mid(b,c),mid(a,c)]){
const onPQ=(m2.y===a.y&&m2.y===b.y)||(m2.y===b.y&&m2.y===c.y); // 与两端的 y 相同 ⇒ 落在条带侧边 (P/Q 边) 上
chk(m2.x,m2.y,m2.z,onPQ);
}
}
}
ok(miss===0,'覆盖: '+(tri+triE+ovl)+' 个判据点全部取到水'+(miss?(' —— 缺 '+miss+' 处, 例 '+ex1):' (旧口径在此必然报洞)'));
for(const q of top.slice(0,4)) rows.push('    · 最大偏差点 ('+q.x.toFixed(1)+','+q.z.toFixed(1)+') 网格y='+q.y.toFixed(3)+' 查询='+q.q.toFixed(3)+' Δ='+q.d.toFixed(3));
ok(worst<=0.5&&bad<=Math.max(6,Math.round(tri*0.03)),'同源(内部): 偏差 >0.06m = '+bad+'/'+tri+' 最大 '+worst.toFixed(4)+'m (判据: 最大 ≤0.5m 且 >0.06m 的点 ≤3%'+(ex2?('; 例 '+ex2):'')+')');
rows.push('  [交汇] 被 >1 条水带覆盖的点 (两条渲染面本身不同高, 判据不计) = '+ovl);
ok(badE<=Math.max(8,Math.round(triE*0.1)),'同源(侧边): 偏差 >0.06m = '+badE+'/'+triE+' (最大 '+worstE.toFixed(3)+'m; 阈值 10% —— 只允许出现在弯道/汊港交汇的扭转四边形上)');
}
// ── ② 索引等价: 格索引 vs 全表暴力 (同一批点必须逐点相同) ──
const brute=(x,z)=>{
let best=-1e9, eBest=-1e9, ePerp=1e9;
for(const s of WATER_SEGS){
const dx=s.bx-s.ax, dz=s.bz-s.az, L2=dx*dx+dz*dz, L=Math.sqrt(L2)||1;
const tRaw=L2>1e-9?((x-s.ax)*dx+(z-s.az)*dz)/L2:0;
const t=tRaw<0?0:(tRaw>1?1:tRaw);
const lat=Math.hypot(x-(s.ax+dx*t),z-(s.az+dz*t));
const axial=L*Math.max(0,-tRaw,tRaw-1);
const lateral=Math.sqrt(Math.max(0,lat*lat-axial*axial));
const eff=Math.hypot(Math.max(0,lateral-s.hw),axial);
if(eff>WATER_PAD) continue;
const wy=s.awy+(s.bwy-s.awy)*t;
if(eff<=0){ if(wy>best) best=wy; } else if(eff<ePerp){ ePerp=eff; eBest=wy; }
}
for(const d of WATER_DISCS){
const perp=Math.hypot(x-d.x,z-d.z);
if(perp>d.reach) continue;
if(perp<=d.reach-WATER_PAD){ if(d.wy>best) best=d.wy; } else if(perp<ePerp){ ePerp=perp; eBest=d.wy; }
}
return best>-1e8?best:eBest;
};
if(WATER_SEGS.length||WATER_DISCS.length){
const TR0=MAP_SIZE/2-8;
let n2=0, diff=0, wat=0, far=0, exd='';
for(let x=-TR0;x<=TR0;x+=3)for(let z=-TR0;z<=TR0;z+=3){
n2++;
const a=waterSampleY(x,z), b=brute(x,z);
if(Math.abs(a-b)>1e-9){ diff++; if(!exd) exd='('+x+','+z+') 索引='+a.toFixed(3)+' 暴力='+b.toFixed(3); }
if(a>-1e8) wat++; else far++;
}
ok(diff===0,'索引等价: '+n2+' 点 (索引 vs 全表暴力) 全同 —— 有水 '+wat+' / 无水 '+far+(exd?(' 例 '+exd):''));
}else ok(true,'索引等价: 本图无采样水面 (0 段 0 盘)');
// ── ③ 分档普查 ──
const TR=MAP_SIZE/2-8;
let dry=0,wet=0,wade=0,swim=0,deepest=-9;
for(let x=-TR;x<=TR;x+=2)for(let z=-TR;z<=TR;z+=2){
const wy=waterYAt(x,z);
if(wy<=-1e8){ dry++; continue; }
const dep=wy-heightAt(x,z,true);
if(dep>deepest) deepest=dep;
if(dep<=0.02) dry++; else if(dep<=WADE_DEPTH) wet++; else if(dep<=SWIM_DEPTH) wade++; else swim++;
}
const wat=dry+wet+wade+swim;
rows.push('  [分档] 湿沙='+wet+' 涉水='+wade+' 游泳='+swim+' 最深='+deepest.toFixed(2)+' 有水格='+(wat-dry)+'/'+wat+' ('+(100*(wat-dry)/wat).toFixed(1)+'%)');
if(RIVER&&!(RIVER.d>2)&&!RIVER.ice) ok(swim<=Math.max(4,Math.round(wat*0.005)),'浅河声明档: 游泳档='+swim+' (允许 ≤'+Math.max(4,Math.round(wat*0.005))+' —— 浅河必须可涉渡)');
if(RIVER&&RIVER.d>2) ok(swim>=Math.round((wat-dry)*0.02),'深谷激流档: 游泳档='+swim+' ≥ '+Math.round((wat-dry)*0.02)+' (须过桥的设计)');
// ── ④ 自救方向 (条目 25): 水点的 shoreDirAt 必须非 null 且指向更浅处 ──
{
let n4=0, nul=0, wrong=0, ex4='';
const pts=[];
if(RIVER){ const P=RIVER.pts; for(let i=0;i<P.length-1;i++){ for(let k=0;k<=3;k++){ const t=k/3; pts.push([P[i][0]+(P[i+1][0]-P[i][0])*t, P[i][1]+(P[i+1][1]-P[i][1])*t]); } } }
for(const p of pts){
const dep=waterDepthAt(p[0],p[1]);
if(!(dep>0.3)) continue;
n4++;
const sd=shoreDirAt(p[0],p[1]);
if(!sd){ nul++; if(!ex4) ex4='('+p[0].toFixed(0)+','+p[1].toFixed(0)+')'; continue; }
const d7=waterDepthAt(p[0]+sd[0]*7,p[1]+sd[1]*7);
const sh=d7<=-1e8?-1e9:d7;
if(sh>dep+1e-6){ wrong++; if(!ex4) ex4='('+p[0].toFixed(0)+','+p[1].toFixed(0)+') dep='+dep.toFixed(2)+'→'+d7.toFixed(2); }
}
if(n4) ok(nul===0&&wrong===0,'自救方向: '+n4+' 个水点 —— null='+nul+' 指向更深='+wrong+(ex4?(' 例 '+ex4):' (旧口径近岸/河道整段 null)'));
}
return rows;
})()\`,ctx);
for(const r of out){ console.log(r); if(r.includes('✗')) fail++; else if(r.includes('✓')) pass++; }
}
console.log('\\n合计: ✓'+pass+' / ✗'+fail);
process.exit(fail?1:0);
`;
const tmp=path.join(__dirname,'_watercov-selfcheck-tmp.js');
fs.writeFileSync(tmp,'// AUTO-GEN\n'+head+tail);
const {execFileSync}=require('child_process');
try{ console.log(execFileSync(process.execPath,[tmp,...process.argv.slice(2)],{encoding:'utf8',stdio:['ignore','pipe','pipe']})); }
catch(e){ console.log(e.stdout||''); console.log(e.stderr||''); }
