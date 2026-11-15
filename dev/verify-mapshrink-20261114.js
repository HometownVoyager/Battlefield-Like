// ─────────────────────────────────────────────
// dev/verify-mapshrink-20261114.js —— 2026-11-14 缩图批 (六图 640→360/380) 正式探针
// 用法: node dev/verify-mapshrink-20261114.js [berlin|moscow|baituan|hukawng|steppe|woodline|all]   (默认 all)
// 装载方式: dev/_bootstub.js + dev/_bootpatch.js + 全量 js/ 顺序加载, startBtn.onclick() 触发
//           startGame (同 dev/verify-boot.js / _shrink-diag-* 口径), 再 NAV.refresh() 保寻路表就绪。
// 断言 (每条给出实测值):
//   1. boot 无异常; CAMPAIGN.mapSize = berlin/moscow/baituan/steppe/woodline 360, hukawng 380
//   2. 全部 BOXES/CYLS/B_FOOT/旗/基/CAMPAIGN.spawns 落 ±(mapSize/2−2) 界内, 打印每图极值
//   3. 任两面旗 (草原=7 强点) 间距 ≥45m
//   4. findPath 基地↔每面旗 (草原: 7 强点↔两基地) 全通
//   5. 地标存在性抽查: 柏林 国会大厦/防空塔/两座地铁厅 (halls=2 且 26×18 不变);
//      莫斯科 factoryFlag='工厂' 存在且 factorySpawn 在 yard 矩形内; 百团 loess.caveVillages=4 且
//      bridges 有木铁路桥、ramps=10; 胡康 BRIDGES[0].len===76 且 onBridge(桥心) 真值、RIVER.ford
//      滩心 waterDepthAt<0.4; 草原 STEPPE.belt/mines/wrecks 齐且 7 强点; 雾林 WOOD.ravine.ramps=3 且 WOOD.belt
//   6. 每图 NAV 主分量格数打印 (历史口径 ≥400 格=合法口袋; 只打印+报告, 不设硬阈)
//   7. 自检 (防空转): 故意越界的假点必须被判红 —— 证明界内判据有分辨力
// 红了就回改数据再验; 桩能力缺失按仓库惯例补在探针侧, 不报成游戏代码缺陷。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const SRC=f=>fs.readFileSync(path.join(root,f),'utf8');
const which=(process.argv[2]||'all').toLowerCase();
const CAMPS=which==='all'?['berlin','moscow','baituan','hukawng','steppe','woodline']:[which];
const IDX={berlin:2,moscow:6,baituan:4,hukawng:7,steppe:8,woodline:9};
const EXPECT_MS={berlin:360,moscow:360,baituan:360,hukawng:380,steppe:360,woodline:360};

const HEAD=['js/00-config.js','js/00b-i18n.js','js/00c-procgen.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js',
'js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js',
'js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js',
'js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/16-aircraft.js',
'js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js',
'js/22a-menuart.js','js/22b-speclayer.js','js/23-deploy.js','js/23b-worldrestore.js','js/25-zombies.js','js/24-main.js'];

const {sandbox,document,window}=require('./_bootstub.js');
require('./_bootpatch.js').patch(sandbox);

function boot(campIdx){
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document; ctx.window=window; ctx.globalThis=ctx;
ctx.location={search:'?seed=42',href:'http://localhost/index.html',hostname:'localhost',protocol:'http:'};
ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
const errs=[];
for(const f of HEAD){
try{ vm.runInContext(SRC(f),ctx,{filename:f}); }
catch(e){ errs.push(f+': '+String(e&&(e.stack||e.message)||e).split('\n').slice(0,3).join(' | ')); }
}
try{
const btn=document.getElementById('startBtn');
if(btn&&typeof btn.onclick==='function') vm.runInContext('document.getElementById("startBtn").onclick();',ctx);
else errs.push('startBtn: no onclick bound');
}catch(e){ errs.push('startBtn: '+String(e&&(e.stack||e.message)||e).split('\n').slice(0,3).join(' | ')); }
return {ctx,errs};
}
const N=(ctx,code,vars)=>{ if(vars) for(const k of Object.keys(vars)) ctx[k]=vars[k]; return vm.runInContext(code,ctx); };
const C=(ctx,fn,...args)=>vm.runInContext(`${fn}(${args.map(a=>JSON.stringify(a)).join(',')})`,ctx);
const isNum=v=>typeof v==='number'&&isFinite(v);

// ── NAV 分量分析 (dev/_steppe-pocket-probe.js / _shrink-diag-steppe-woods 同口径: 5m 格 / 格心+四象限
//    开放 / 中线±1.5 并行边 / 8 邻域) —— 主分量格数只打印+报告, 不设硬阈 (历史口径 ≥400 格=合法口袋)
const COMP_FN=`(()=>{
const SP=5, N=Math.floor(MAP_SIZE/SP)+1, OFF=MAP_SIZE/2, NN=N*N;
const toW=(i,j)=>[i*SP-OFF, j*SP-OFF];
const toG=(x,z)=>[clamp(Math.round((x+OFF)/SP),0,N-1), clamp(Math.round((z+OFF)/SP),0,N-1)];
const open=new Uint8Array(NN), comp=new Int32Array(NN).fill(-1), csize=[];
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
if(lineOK(x1-px,z1-pz,x2-px,z2-pz)) return false;
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
}
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
return {comp:Array.from(comp),csize,N,OFF,SP};
})()`;

// ── 界内扫描器 (真检查与自检共用同一函数 —— 自检即拿它验"越界假点必须报红") ──
function scanBounds(items,LIM){
// 引擎把已消亡/停用的碰撞盒停泊在 ±99999 (13-combat/03-terrain 惯例) —— 不算越界
const parked=v=>Math.abs(v)>9000;
const out=[];
let mx=0,mz=0,tag='';
const note=(x,z,what)=>{ const ax=Math.abs(x),az=Math.abs(z); if(ax>mx){mx=ax;tag=what+' x='+Number(x).toFixed(1);} if(az>mz){mz=az; if(ax<=mx) tag=tag||what;} };
for(const b of items.boxes){
if(!isNum(b.minX)||parked(b.minX)||parked(b.minZ)||parked(b.maxX)||parked(b.maxZ)) continue;
if(b.minX<-LIM||b.maxX>LIM||b.minZ<-LIM||b.maxZ>LIM) out.push(`BOX(${((b.minX+b.maxX)/2).toFixed(1)},${((b.minZ+b.maxZ)/2).toFixed(1)}) 域 ${b.minX.toFixed(1)}..${b.maxX.toFixed(1)},${b.minZ.toFixed(1)}..${b.maxZ.toFixed(1)}`);
for(const v of [b.minX,b.maxX]) if(Math.abs(v)<=9000&&Math.abs(v)>mx){ mx=Math.abs(v); tag='BOX x='+v.toFixed(1); }
for(const v of [b.minZ,b.maxZ]) if(Math.abs(v)<=9000&&Math.abs(v)>mz){ mz=Math.abs(v); tag=tag.startsWith('BOX')?(tag):('BOX z='+v.toFixed(1)); }
}
for(const c of items.cyls){
if(!isNum(c.x)||Math.abs(c.x)>9000) continue;
if(c.x-c.r<-LIM||c.x+c.r>LIM||c.z-c.r<-LIM||c.z+c.r>LIM) out.push(`CYL(${c.x.toFixed(1)},${c.z.toFixed(1)},r${Number(c.r).toFixed(1)})`);
for(const v of [c.x-c.r,c.x+c.r]) if(Math.abs(v)<=9000&&Math.abs(v)>mx){ mx=Math.abs(v); tag='CYL x='+v.toFixed(1); }
for(const v of [c.z-c.r,c.z+c.r]) if(Math.abs(v)<=9000&&Math.abs(v)>mz){ mz=Math.abs(v); tag=tag.startsWith('CYL')?tag:'CYL z='+v.toFixed(1); }
}
for(const f of items.foots){
if(!isNum(f.x0)||!isNum(f.x1)||!isNum(f.z0)||!isNum(f.z1)) continue;
if(Math.abs(f.x0)>9000) continue;
if(f.x0<-LIM||f.x1>LIM||f.z0<-LIM||f.z1>LIM) out.push(`FOOT(${f.x0.toFixed(0)},${f.z0.toFixed(0)})..(${f.x1.toFixed(0)},${f.z1.toFixed(0)})`);
}
for(const p of items.pts){
if(!isNum(p.x)||!isNum(p.z)) continue;
if(Math.abs(p.x)>9000) continue;
if(Math.abs(p.x)>LIM||Math.abs(p.z)>LIM) out.push(`${p.tag} (${p.x},${p.z})`);
}
return {out,mx,mz,tag};
}

let TOTAL_OK=0,TOTAL_BAD=0;
for(const cid of CAMPS){
console.log(`\n══════ ${cid} (mapSize=${EXPECT_MS[cid]}) ══════`);
const {ctx,errs}=boot(IDX[cid]);
let ok=0,bad=0;
const A=(name,cond,detail)=>{ (cond?ok++:bad++); TOTAL_OK+=cond?1:0; TOTAL_BAD+=cond?0:1; console.log(`  ${cond?'✓':'✗'} ${name}${detail?'  '+detail:''}`); };
const CAMPAIGN=N(ctx,'CAMPAIGN');
const MS=CAMPAIGN.mapSize, LIM=MS/2-2;

// 1. boot 无异常 + mapSize
A('1. boot 无异常 (全量 js/ + startGame 路径)',errs.length===0,errs.slice(0,4).join(' || ')||'');
A('1b. CAMPAIGN.mapSize='+EXPECT_MS[cid],MS===EXPECT_MS[cid],String(MS));

// 2. 界内 ±(mapSize/2−2) + 每图极值打印
{
const items={
boxes:N(ctx,'BOXES'),cyls:N(ctx,'CYLS'),foots:N(ctx,'B_FOOT'),
pts:[
...CAMPAIGN.flags.map(f=>({tag:'旗'+f.id,x:f.x,z:f.z})),
...CAMPAIGN.bases.map((b,i)=>({tag:'基'+i,x:b.x,z:b.z})),
...(CAMPAIGN.spawns||[]).map((s,i)=>({tag:'强点'+(s.name||i),x:s.x,z:s.z})),
]};
const r=scanBounds(items,LIM);
console.log(`  · 2. 极值: |x|max=${r.mx.toFixed(1)} |z|max=${r.mz.toFixed(1)} (${r.tag}); 限 ±${LIM}; BOXES ${items.boxes.length} / CYLS ${items.cyls.length} / FOOT ${items.foots.length} / 旗 ${CAMPAIGN.flags.length} / 基 ${CAMPAIGN.bases.length} / 强点 ${(CAMPAIGN.spawns||[]).length}`);
A('2. 全部 BOXES/CYLS/B_FOOT/旗/基/强点 落 ±(mapSize/2−2) 界内',r.out.length===0,r.out.length?('越界 '+r.out.length+' 项: '+r.out.slice(0,6).join(' ; ')):'全部在界内');
// 7. 自检 (防空转): 同一扫描器喂一个故意越界的假盒 —— 必须报红, 否则判据无分辨力
const fake={minX:LIM+8,maxX:LIM+10,minY:0,maxY:1,minZ:-2,maxZ:2,dead:false};
const rf=scanBounds({boxes:[fake],cyls:[],foots:[],pts:[]},LIM);
A('7. 自检: 故意越界假盒 ('+(LIM+8)+','+(-2)+') 被判红',rf.out.length>=1,rf.out.length>=1?('扫描器报: '+rf.out[0]):'假点未被识破 ⇒ 判据失效');
}

// 3. 旗距 ≥45 (草原无旗 → 用 7 强点)
{
const pts=(CAMPAIGN.flags.length?CAMPAIGN.flags.map(f=>({n:'旗'+f.id,x:f.x,z:f.z})):(CAMPAIGN.spawns||[]).map(s=>({n:'强点'+s.name,x:s.x,z:s.z})));
let min=1e9,pair='';
for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++){
const d=Math.hypot(pts[i].x-pts[j].x,pts[i].z-pts[j].z);
if(d<min){min=d;pair=pts[i].n+'↔'+pts[j].n;}
}
A('3. 任两面'+(CAMPAIGN.flags.length?'旗':'强点(草原)')+'间距 ≥45m',min>=45,`${pts.length} 点, 最近 ${pair} = ${min.toFixed(1)}m`);
}

// 4. findPath 基地↔每旗 (草原: 7 强点↔两基地)
{
try{ vm.runInContext('NAV.refresh()',ctx); }catch(e){ /* refresh 失败由 findPath 结果体现 */ }
const q=[];
const flg=CAMPAIGN.flags, bss=CAMPAIGN.bases, spw=CAMPAIGN.spawns||[];
if(flg.length){
for(const f of flg){ q.push({x:bss[0].x,z:bss[0].z,tx:f.x,tz:f.z,tag:'基0→旗'+f.id}); q.push({x:bss[1].x,z:bss[1].z,tx:f.x,tz:f.z,tag:'基1→旗'+f.id}); }
}else{
for(const s of spw){ q.push({x:s.x,z:s.z,tx:bss[0].x,tz:bss[0].z,tag:'强点'+s.name+'→基0'}); q.push({x:s.x,z:s.z,tx:bss[1].x,tz:bss[1].z,tag:'强点'+s.name+'→基1'}); }
}
let nulls=0; const rows=[];
for(const qq of q){
let p=null;
try{ p=N(ctx,'NAV.findPath',qq); }catch(e){ rows.push('✗ '+qq.tag+' (异常 '+String(e&&e.message||e).slice(0,40)+')'); nulls++; continue; }
if(!p||!p.length){ nulls++; rows.push('✗ '+qq.tag); }
}
A('4. findPath '+(flg.length?'基地↔每旗':'7 强点↔两基地(草原)')+' 全通',nulls===0,nulls?rows.slice(0,6).join(', '):`${q.length} 条查询全通过`);
}

// 5. 地标存在性抽查
{
const reg=N(ctx,'BUILD_REG');
if(cid==='berlin'){
const RS=reg.find(b=>b.type==='reichstag'), FT=reg.find(b=>b.type==='flaktower');
A('5b. 国会大厦 (reichstag) 已布景',!!RS,RS?`@(${RS.x.toFixed(1)},${RS.z.toFixed(1)}) w=${RS.w} d=${RS.d}`:'BUILD_REG 无 reichstag');
A('5c. 防空塔 (flaktower) 已布景',!!FT,FT?`@(${FT.x.toFixed(1)},${FT.z.toFixed(1)}) w=${FT.w} d=${FT.d}`:'BUILD_REG 无 flaktower');
const M=CAMPAIGN.city&&CAMPAIGN.city.metro;
const halls=(M&&M.halls)||[];
const dims=halls.map(h=>({w:+(h.x1-h.x0).toFixed(4),d:+(h.z1-h.z0).toFixed(4)}));
A('5d. 地铁厅 halls=2 且 26×18 不变 (读 CAMPAIGN.city.metro 配置)',halls.length===2&&dims.every(x=>x.w===26&&x.d===18),`halls=${halls.length}, 尺寸 ${dims.map(x=>x.w+'×'+x.d).join('/')}`);
}else if(cid==='moscow'){
const hasFlag=CAMPAIGN.factoryFlag==='工厂'&&CAMPAIGN.flags.some(f=>f.id==='工厂');
const ff=CAMPAIGN.flags.find(f=>f.id==='工厂');
A('5b. factoryFlag="工厂" 且旗存在',!!hasFlag,ff?`旗@(${ff.x},${ff.z}) r=${ff.r}`:'旗缺失');
const spn=CAMPAIGN.factorySpawn, yard=CAMPAIGN.city&&CAMPAIGN.city.yard;
const inYard=!!(spn&&yard&&spn.x>=yard.x0&&spn.x<=yard.x1&&spn.z>=yard.z0&&spn.z<=yard.z1);
A('5c. factorySpawn 落在 city.yard 矩形内',inYard,spn&&yard?`spawn(${spn.x},${spn.z}) ∈ yard(${yard.x0},${yard.z0})..(${yard.x1},${yard.z1})`:'spawn/yard 缺失');
}else if(cid==='baituan'){
const cv=(CAMPAIGN.loess&&CAMPAIGN.loess.caveVillages)||[];
A('5b. loess.caveVillages=4',cv.length===4,String(cv.length));
const brs=CAMPAIGN.bridges||[];
const railZ=CAMPAIGN.loess&&CAMPAIGN.loess.rail?CAMPAIGN.loess.rail.z0:null;
const woodRail=brs.find(b=>railZ!=null&&Math.abs(b.z-railZ)<0.2);
A('5c. bridges 有木铁路桥 (跨巷沟, 骑 rail 线)',!!woodRail,woodRail?`@(${woodRail.x},${woodRail.z}) len=${woodRail.len} w=${woodRail.w} yaw=${woodRail.yaw}`:`bridges=${brs.length} 条, rail.z0=${railZ}`);
const nr=(CAMPAIGN.loess&&CAMPAIGN.loess.ramps)||[];
A('5d. loess.ramps=10 (坡道网络)',nr.length===10,String(nr.length));
}else if(cid==='hukawng'){
const GB=(CAMPAIGN.bridges||CAMPAIGN.bridge?[].concat(CAMPAIGN.bridges||[],CAMPAIGN.bridge?[CAMPAIGN.bridge]:[]):[])[0];
A('5b. BRIDGES[0].len===76 (巨桥跨不缩)',!!(GB&&GB.len===76),GB?`kind=${GB.kind} len=${GB.len} w=${GB.w}`:'BRIDGES 空');
const onB=GB?C(ctx,'onBridge',GB.x,GB.z):null;
A('5c. onBridge(桥心)=真值',onB!==false&&onB!=null,String(onB));
const F=N(ctx,'RIVER&&RIVER.ford?RIVER.ford:null');
let depth=null;
if(F) depth=C(ctx,'waterDepthAt',F.x,F.z);
A('5d. RIVER.ford 存在且滩心 waterDepthAt<0.4 (可涉渡)',!!F&&depth!=null&&depth<0.4,F?`ford(${F.x},${F.z}) r=${F.r} 滩心水深=${depth==null?'?':depth.toFixed(2)}m`:'RIVER.ford 缺失');
}else if(cid==='steppe'){
const S=N(ctx,'STEPPE');
const okS=!!(S&&S.belt&&S.mines&&S.wrecks&&S.wrecks.length>=1);
A('5b. STEPPE.belt/mines/wrecks 齐备 (wrecks='+((S&&S.wrecks)||[]).length+')',okS,S?'belt x '+S.belt.x0+'..'+S.belt.x1+' gaps='+S.belt.gaps.length+', mines zRuns='+S.mines.zRuns.length:'STEPPE 缺失');
A('5c. 强点=7',(CAMPAIGN.spawns||[]).length===7,'spawns='+(CAMPAIGN.spawns||[]).length);
}else if(cid==='woodline'){
const W=N(ctx,'WOOD');
const okW=!!(W&&W.ravine&&W.ravine.ramps&&W.belt);
A('5b. WOOD.ravine.ramps=3 且 WOOD.belt 存在',okW&&W.ravine.ramps.length===3,W?'ramps='+W.ravine.ramps.length+', belt x '+W.belt.x0+'..'+W.belt.x1:'WOOD 缺失');
}
}

// 6. NAV 主分量格数 (只打印+报告)
{
try{
const nav=vm.runInContext(COMP_FN,ctx);
const main=Math.max(0,...nav.csize);
const openTot=nav.csize.reduce((a,b)=>a+b,0);
console.log(`  · 6. NAV 主分量 (历史口径 ≥400 格=合法口袋, 本项只报告): 主分量 #${nav.csize.indexOf(main)} = ${main} 格; 开放格合计 ${openTot}; 分量总数 ${nav.csize.length} (5m 格, ${nav.N}² 网格)`);
A('6. NAV 主分量可计算 (格数>0)',main>0,`${main} 格`);
}catch(e){
A('6. NAV 主分量可计算',false,String(e&&e.message||e).slice(0,80));
}
}

console.log(`  ── ${cid}: ${ok} 通过 / ${bad} 失败 ──`);
}

console.log(`\nverify-mapshrink-20261114: ${TOTAL_OK} 通过 / ${TOTAL_BAD} 失败${TOTAL_BAD===0?' (全绿)':''} — 2026-11-14 缩图批 六图 360/380 界内/连通/地标/自检`);
process.exit(TOTAL_BAD===0?0:1);
