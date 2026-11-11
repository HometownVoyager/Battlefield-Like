// ─────────────────────────────────────────────
// dev/verify-procgen.js —— 随机战场 (procgen) 沙箱探针 · 数据阶段 (2026-10-24 规模三档+骨架抽签+农田掩体批重写)
// 用法: node dev/verify-procgen.js   (纯数据层: 只载 00-config + 00c-procgen, 零 THREE)
// 本批设计变更 (2026-10-24 用户四项裁定):
//   ① 规模三档: 小300/中380/大480 (sf_pgsize/URL ?pgsize=; mapSize/botMul/tankN 随档)
//   ② 骨架抽签: farm/town → mono(单核+卫星村)/dual(双村对峙)/linear(线性走廊); water 固定
//   ③ 农田批: farm 大粮仓(8~14@380)/town 贴边碎田(2~6)/water 水田 —— 绿黄双保底 (首 corn·次 wheat·水乡首 rice)
//   ④ 田缘掩体: 每田 2~3 边墙计划 (f.walls, 避路≥4.5/避基地≥26) + 田内草垛 (f.hay 0~3) + 野地孤树 (PGDATA.singles)
// 通用不变式 (每群系 × 种子): 旗两两 ≥52 / 贴路 ≤3 / 距基地 ≥44 / 场内; 基地对轴 (按尺寸分档);
//   高度场 (HALF*2/5+1)² 幅值; 主村广场压平; 地块净空; 田墙计划合法; 种子不回写; 同种子同规模全同。
// farm 基线: 2026-10-24 农田批**重钉** (dev/_pgfarm-baseline.json; 旧 2026-10-07b 逐位承诺由本批设计变更废止)。
// 布局阶段(建筑落位/NAV 连通)由 dev/verify-boot.js <procgen序号> 全量启动覆盖。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
let pass=0,fail=0;const fails=[];
function ck(name,cond,extra){ if(cond){pass++;} else {fail++;fails.push(name+(extra?(' :: '+extra):'')); console.log('  ✗ '+name+(extra?(' :: '+extra):''));} }

function makeCtx(seed,campIdx,size){
 const store={sf_campaign:String(campIdx)};
 if(seed!==null&&seed!==undefined) store.sf_pseed=String(seed);
 if(size) store.sf_pgsize=String(size);
 const ctx=vm.createContext({
  console:{log(){},warn(){},error(){}},
  location:{search:''},
  localStorage:{_s:store,getItem(k){return (k in this._s)?this._s[k]:null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}},
  window:{},navigator:{maxTouchPoints:0},matchMedia:()=>({matches:false}),
  document:{createElement:()=>({getContext:()=>null,style:{},setAttribute(){}}),addEventListener(){},body:{classList:{add(){},remove(){}}}},
  Math,JSON,Object,Array,Number,String,Boolean,Date,parseInt,parseFloat,isFinite,isNaN,
 });
 for(const f of ['js/00-config.js','js/00c-procgen.js']){
  vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
 }
 return ctx;
}
// 探针侧几何助手 (与 00c 同口径复写: 跨河/贴路/岸别判据必须与生成端一致)
const segDist=(px,pz,ax,az,bx,bz)=>{ const abx=bx-ax,abz=bz-az,L2=abx*abx+abz*abz||1e-9;
  const t=Math.max(0,Math.min(1,((px-ax)*abx+(pz-az)*abz)/L2)); return Math.hypot(px-(ax+abx*t),pz-(az+abz*t)); };
const roadDist=(R,x,z)=>{ let m=1e9; for(const r of R){ const d=segDist(x,z,r[0],r[1],r[2],r[3]); if(d<m)m=d; } return m; };
const riverDist=(RD,x,z)=>{ let m=1e9; for(let i=0;i<RD.pts.length-1;i++){
  const d=segDist(x,z,RD.pts[i][0],RD.pts[i][1],RD.pts[i+1][0],RD.pts[i+1][1]); if(d<m)m=d; } return m; };
const segX=(p1,p2,p3,p4)=>{ const d1x=p2[0]-p1[0],d1z=p2[1]-p1[1],d2x=p4[0]-p3[0],d2z=p4[1]-p3[1];
  const den=d1x*d2z-d1z*d2x; if(Math.abs(den)<1e-9) return null;
  const t=((p3[0]-p1[0])*d2z-(p3[1]-p1[1])*d2x)/den,u=((p3[0]-p1[0])*d1z-(p3[1]-p1[1])*d1x)/den;
  if(t<0||t>1||u<0||u>1) return null;
  return [p1[0]+d1x*t,p1[1]+d1z*t]; };
const inBridgeRect=(BS,X)=>{ for(const b of BS){ const px=Math.sin(b.yaw),pz=Math.cos(b.yaw);
  if(Math.abs((X[0]-b.x)*px+(X[1]-b.z)*pz)<=b.len/2+1.5&&Math.abs((X[0]-b.x)*(-pz)+(X[1]-b.z)*px)<=b.w/2+2) return true; } return false; };
const crossRiver=(R,RD,BS)=>{ let n=0;
 for(const r of R) for(let j=0;j<RD.pts.length-1;j++){
  const X=segX([r[0],r[1]],[r[2],r[3]],RD.pts[j],RD.pts[j+1]);
  if(X&&!inBridgeRect(BS,X)) n++; }
 return n; };
const bankOf=(RD,x,z)=>{ let bd=1e9,sg=0;
 for(let i=0;i<RD.pts.length-1;i++){
  const ax=RD.pts[i][0],az=RD.pts[i][1],abx=RD.pts[i+1][0]-ax,abz=RD.pts[i+1][1]-az,L2=abx*abx+abz*abz||1e-9;
  const t=Math.max(0,Math.min(1,((x-ax)*abx+(z-az)*abz)/L2));
  const px=ax+abx*t,pz=az+abz*t,dd=Math.hypot(x-px,z-pz);
  if(dd<bd){ bd=dd; sg=Math.sign((z-pz)*abx-(x-px)*abz)||0; } }
 return sg; };
const hSmp=(H,N,GS,GO,px,pz)=>{ const gx=Math.max(0,Math.min(N,(px-GO)/GS)),gz=Math.max(0,Math.min(N,(pz-GO)/GS));
 const i0=Math.min(N-1,Math.floor(gx)),j0=Math.min(N-1,Math.floor(gz)),fx=gx-i0,fz=gz-j0;
 const h00=H[j0*(N+1)+i0],h10=H[j0*(N+1)+i0+1],h01=H[(j0+1)*(N+1)+i0],h11=H[(j0+1)*(N+1)+i0+1];
 return (h00*(1-fx)+h10*fx)*(1-fz)+(h01*(1-fx)+h11*fx)*fz; };
// 尺寸档表 (与 00c HALF 系同口径): 场内门/基地距下限 (water=河湾内拉设计内, 阈值另设)
const SZTAB={300:{in:138,rc:144,baseN:205,baseW:170},380:{in:178,rc:184,baseN:260,baseW:230},480:{in:228,rc:234,baseN:316,baseW:300}};
const FARM_GRAIN=['wheat','corn','pasture','till'];

// 先探 procgen 序号 (数组末位)
{
 const c=makeCtx(777,0);
 const n=vm.runInContext('CAMPAIGNS.length',c);
 var PGIDX=n-1;
 ck('procgen 是末位战役且 id 正确', vm.runInContext('CAMPAIGNS[CAMPAIGNS.length-1].id',c)==='procgen');
}

// ── 群系种子池: 既有 7 种子 + 连号补齐每群系 ≥4 ─────────────────────────────────
const baseSeeds=[12345,777,90210,424242,555555,1,999999];
const byBiome={farm:[],town:[],water:[]};
for(const s of baseSeeds){ const b=vm.runInContext('PG.biome',makeCtx(s,PGIDX)); byBiome[b].push(s); }
for(let s=100001;(byBiome.farm.length<4||byBiome.town.length<4||byBiome.water.length<4)&&s<101200;s++){
 const b=vm.runInContext('PG.biome',makeCtx(s,PGIDX));
 if(byBiome[b].length<4) byBiome[b].push(s);
}

// ── A. 通用 + 群系专属断言 (380 主档 × 三群系) ──────────────────────────────────
for(const bm of ['farm','town','water']){
 for(const sd of byBiome[bm]){
  const ctx=makeCtx(sd,PGIDX);
  const g=expr=>vm.runInContext(expr,ctx);
  console.log('── [seed '+sd+'] '+bm+' ──');
  const FLAGS=g('CAMPAIGN.flags'), BASES=g('CAMPAIGN.bases'), ROADS=g('CAMPAIGN.roads'),
        FIELDS=g('CAMPAIGN.fields'), POLYS=g('PGDATA.polys'), LOTS=g('PGDATA.lots'),
        WOODS=g('PGDATA.woods'), SETT=g('PGDATA.settles'), SK=g('PGDATA.skeleton'),
        CORE=g('PGDATA.core'), H=g('PGDATA.hgrid'), GN=g('PGDATA.gN');
  const T=SZTAB[380];
  ck('['+sd+'] 数据阶段已执行', g('CAMPAIGN.layout==="procgen"&&!!PGDATA&&PG.biome==="'+bm+'"'));
  ck('['+sd+'] 主题/阵营配对', (g('PG.theme')==='china')
   ? g('CAMPAIGN.f[0]==="jp"&&CAMPAIGN.f[1]==="cpc"') : g('CAMPAIGN.f[0]==="us"&&CAMPAIGN.f[1]==="ger"'), g('PG.theme'));
  ck('['+sd+'] 规模链: PG.size=mapSize=380', g('PG.size')===380&&g('CAMPAIGN.mapSize')===380&&g('CAMPAIGN.procgen.size')===380);
  {  // 骨架/聚落结构: water 固定单核; farm/town 抽签三选一, 聚落数随骨架
   const nSet=SETT.length;
   const okSk=(bm==='water')?(SK==='water'&&nSet===1)
    :((SK==='mono'&&nSet>=1)||(SK==='dual'&&nSet===2)||(SK==='linear'&&nSet===3));
   ck('['+sd+'] 骨架 '+SK+' 与聚落数 '+nSet+' 相容', okSk);
   ck('['+sd+'] 主村=SETT[0]=core 且广场旗在主村心', SETT[0].main===true&&SETT[0].x===CORE.x&&SETT[0].z===CORE.z
    &&FLAGS[0].id==='广场'&&FLAGS[0].x===CORE.x);
  }
  {  // 旗数档: farm 3~6 / town 3~6 / water 4~5 (380 中档: farm·town 3~5)
   const n=FLAGS.length;
   const ok=(bm==='farm')?(n>=3&&n<=5):((bm==='town')?(n>=3&&n<=5):(n>=4&&n<=5));
   ck('['+sd+'] 旗数 ('+(bm==='water'?'4~5':'3~5')+')', ok, n+' '+JSON.stringify(FLAGS.map(f=>f.id)));
  }
  ck('['+sd+'] 旗点两两间距 ≥52m', (()=>{ for(let i=0;i<FLAGS.length;i++)for(let j=i+1;j<FLAGS.length;j++)
   if(Math.hypot(FLAGS[i].x-FLAGS[j].x,FLAGS[i].z-FLAGS[j].z)<52) return false; return true; })());
  ck('['+sd+'] 旗点在场内 (±'+T.in+')', FLAGS.every(f=>Math.abs(f.x)<=T.in&&Math.abs(f.z)<=T.in));
  ck('['+sd+'] 基地对轴对峙 (非水 ≥'+T.baseN+' / 水 ≥'+T.baseW+') 且在场内', (()=>{ const d=Math.hypot(BASES[0].x-BASES[1].x,BASES[0].z-BASES[1].z);
   const lim=(bm==='water')?T.baseW:T.baseN;
   return d>=lim&&BASES.every(b=>Math.abs(b.x)<=T.rc&&Math.abs(b.z)<=T.rc); })(),
   Math.round(Math.hypot(BASES[0].x-BASES[1].x,BASES[0].z-BASES[1].z)));
  ck('['+sd+'] 旗点距基地 ≥44m', FLAGS.every(f=>BASES.every(b=>Math.hypot(f.x-b.x,f.z-b.z)>=44)));
  ck('['+sd+'] 旗点贴路 (≤3m)', FLAGS.every(f=>roadDist(ROADS,f.x,f.z)<=3.01));
  ck('['+sd+'] 路网 ≥14 段且三类折线齐', ROADS.length>=14&&POLYS.some(p=>p.cls==='main')
   &&POLYS.some(p=>p.cls==='trunk0')&&POLYS.some(p=>p.cls==='trunk1'), ROADS.length);
  ck('['+sd+'] 干道自基地出发 (±3m) 且终端接街网 (≤10m)', (()=>{
   const t0=POLYS.find(p=>p.cls==='trunk0'), t1=POLYS.find(p=>p.cls==='trunk1');
   if(!t0||!t1) return false;
   if(Math.hypot(t0.pts[0][0]-BASES[0].x,t0.pts[0][1]-BASES[0].z)>3) return false;
   if(Math.hypot(t1.pts[0][0]-BASES[1].x,t1.pts[0][1]-BASES[1].z)>3) return false;
   const mains=POLYS.filter(p=>p.cls==='main').flatMap(p=>p.pts);
   const near=(p)=>mains.some(q=>Math.hypot(q[0]-p.pts[p.pts.length-1][0],q[1]-p.pts[p.pts.length-1][1])<=10);
   return near(t0)&&near(t1);
  })());
  ck('['+sd+'] 高度场网格 '+(GN+1)+'×'+(GN+1)+' 且 |h|<30m', H.length===(GN+1)*(GN+1)&&GN===76&&H.every(v=>Math.abs(v)<30));
  ck('['+sd+'] 主村广场压平 (±8m 高差 ≤1.2m)', (()=>{
   const hs=[[-8,-8],[8,-8],[-8,8],[8,8]].map(o=>hSmp(H,GN,5,-190,CORE.x+o[0],CORE.z+o[1]));
   return Math.max.apply(null,hs)-Math.min.apply(null,hs)<=1.2; })());
  ck('['+sd+'] 地块 ≥12 且净空 (主村19/副村14/旗圈/场内)', (()=>{
   if(LOTS.length<12) return false;
   for(const l of LOTS){
    if(Math.abs(l.x)>T.in||Math.abs(l.z)>T.in) return false;
    for(const s of SETT){ if(Math.hypot(l.x-s.x,l.z-s.z)<(s.main?19:14)) return false; }
    for(const f of FLAGS) if(Math.hypot(l.x-f.x,l.z-f.z)<f.r) return false;
   }
   return true; })(), LOTS.length);
  ck('['+sd+'] 林地 ('+(bm==='farm'?'3~4':(bm==='town'?'0~2':'1~2'))+') 且不压旗/基地/村', (()=>{
   const n=WOODS.length;
   const okN=(bm==='farm')?(n>=3&&n<=4):((bm==='town')?(n>=0&&n<=2):(n>=1&&n<=2));
   return okN&&WOODS.every(w=>FLAGS.every(f=>Math.hypot(w.x-f.x,w.z-f.z)>=24)
    &&BASES.every(b=>Math.hypot(w.x-b.x,w.z-b.z)>=34)&&SETT.every(s=>Math.hypot(w.x-s.x,w.z-s.z)>=26)); })(), WOODS.length);
  // ── 农田批断言 (2026-10-24): 量做群系区分 + 绿黄双保底 + 田墙/草垛计划 ──
  if(bm==='farm'){
   ck('['+sd+'] 农田 8~14 块且 grain 色带', FIELDS.length>=8&&FIELDS.length<=14&&FIELDS.every(f=>FARM_GRAIN.indexOf(f.t)>=0), FIELDS.length);
   // ── 战区田带 (2026-10-24e): 模板抽签 + belt 全高杆 + zn 标签与几何一致 + 高草丛规划 ──
   const TPL=g('PGDATA.fieldTpl');
   ck('['+sd+'] 田带模板 ∈ 四型', ['center','flank','mixed','cross'].indexOf(TPL)>=0, TPL);
   const BELT=FIELDS.filter(f=>f.belt);
   ck('['+sd+'] 主田带 ≥1 块且全部高杆 (corn/wheat)', BELT.length>=1&&BELT.every(f=>f.t==='corn'||f.t==='wheat'), BELT.length+' '+TPL);
   ck('['+sd+'] 主田带全部落战斗区 (zn∈c/m)', BELT.every(f=>f.zn==='c'||f.zn==='m'));
   {  // zn 标签=几何单源: 按基地轴重算横向带, 与 00c latOf/C_B/M_B 同口径
    const SZz=g('PGDATA.size'), Kz=Math.max(0.8,(SZz/2)/190), Cz=34*Kz, Mz=78*Kz;
    const ux=BASES[1].x-BASES[0].x, uz=BASES[1].z-BASES[0].z, ul=Math.hypot(ux,uz)||1;
    const mx=(BASES[0].x+BASES[1].x)/2, mz=(BASES[0].z+BASES[1].z)/2;
    ck('['+sd+'] zn 战区标签与几何一致 (中路≤'+Math.round(Cz)+' / 中侧≤'+Math.round(Mz)+')', FIELDS.every(f=>{
     const L=Math.abs(((f.x0+f.x1)/2-mx)*(-uz/ul)+((f.z0+f.z1)/2-mz)*(ux/ul));
     return f.zn===((L<=Cz)?'c':(L<=Mz)?'m':'w'); }));
   }
   const GR=g('PGDATA.grass');
   ck('['+sd+'] 高草丛 2~6 丛 (无田空带植被因素)', GR.length>=2&&GR.length<=6, GR.length);
   ck('['+sd+'] 草丛避田 ≥8 / 避路 ≥5 / 避旗 r+2 / 在场内', (()=>{
    for(const gp of GR){
     if(Math.abs(gp.x)>g('PGDATA.size')/2-6||Math.abs(gp.z)>g('PGDATA.size')/2-6) return false;
     if(roadDist(ROADS,gp.x,gp.z)<5) return false;
     for(const f of FLAGS) if(Math.hypot(gp.x-f.x,gp.z-f.z)<f.r+2) return false;
     for(const f of FIELDS){ const px=Math.max(f.x0,Math.min(gp.x,f.x1)), pz=Math.max(f.z0,Math.min(gp.z,f.z1));
      if(Math.hypot(px-gp.x,pz-gp.z)<8) return false; }
    }
    return true; })(), GR.length+' 丛');
  }else if(bm==='water'){
   ck('['+sd+'] 水田 ≥2 块且 rice/till', FIELDS.length>=2&&FIELDS.every(f=>['rice','till'].indexOf(f.t)>=0), FIELDS.length);
   ck('['+sd+'] 水稻绿保底 (≥1 块 rice)', FIELDS.some(f=>f.t==='rice'));
   ck('['+sd+'] 水田角点不落河 (距主河 ≥w+5)', FIELDS.every(f=>[[f.x0,f.z0],[f.x1,f.z0],[f.x0,f.z1],[f.x1,f.z1]]
    .every(c=>riverDist(g('CAMPAIGN.river'),c[0],c[1])>=g('CAMPAIGN.river').w+5)), FIELDS.length);
  }else{
   ck('['+sd+'] 城郊碎田 2~6 块 (零农田 BUG 修复) 且全种植株型', FIELDS.length>=2&&FIELDS.length<=6
    &&FIELDS.every(f=>f.t==='wheat'||f.t==='corn'), FIELDS.length);
  }
  if(bm!=='water'){
   ck('['+sd+'] 绿黄双保底 (绿:corn/pasture 且 黄:wheat)', FIELDS.some(f=>f.t==='corn'||f.t==='pasture')&&FIELDS.some(f=>f.t==='wheat'),
    JSON.stringify(FIELDS.map(f=>f.t)));
  }
  ck('['+sd+'] 田缘墙计划: 每田 2~3 边且避路≥4/避基地≥26', (()=>{
   for(const f of FIELDS){
    if(!f.walls||f.walls.length<2||f.walls.length>3) return false;
    const E=[[f.x0,f.z0,f.x1,f.z0],[f.x0,f.z1,f.x1,f.z1],[f.x0,f.z0,f.x0,f.z1],[f.x1,f.z0,f.x1,f.z1]];
    for(const wi of f.walls){ const e=E[wi]; if(!e) return false;
     for(const tt of [0.2,0.5,0.8]){
      const px=e[0]+(e[2]-e[0])*tt, pz=e[1]+(e[3]-e[1])*tt;
      if(roadDist(ROADS,px,pz)<4) return false;
      for(const b of BASES) if(Math.hypot(px-b.x,pz-b.z)<26) return false;
     }
    }
   }
   return true; })());
  ck('['+sd+'] 草垛计划: 0~3 个且在田内避路≥6', (()=>{
   for(const f of FIELDS){
    if(!f.hay||f.hay.length>3) return false;
    for(const h of f.hay){
     if(h.x<f.x0||h.x>f.x1||h.z<f.z0||h.z>f.z1) return false;
     if(roadDist(ROADS,h.x,h.z)<6) return false;
    }
   }
   return true; })());
  ck('['+sd+'] 野地孤树在场内·不进田·避路≥9·避旗≥20', (()=>{
   const SGL=g('PGDATA.singles');
   if(!Array.isArray(SGL)||SGL.length<4) return false;
   return SGL.every(p=>{
    if(Math.abs(p.x)>T.in||Math.abs(p.z)>T.in) return false;
    if(roadDist(ROADS,p.x,p.z)<9) return false;
    for(const f of FIELDS) if(p.x>f.x0-3&&p.x<f.x1+3&&p.z>f.z0-3&&p.z<f.z1+3) return false;
    for(const fl of FLAGS) if(Math.hypot(p.x-fl.x,p.z-fl.z)<20) return false;
    return true; }); })(), (g('PGDATA.singles')||[]).length);
  // ── 群系专属结构 ──
  if(bm==='town'){
   const nSub=POLYS.filter(p=>p.cls==='sub').length, rail=g('PGDATA.rail.length');
   ck('['+sd+'] 次街 ×2 (cls=sub, 主村)', nSub>=2, nSub);
   ck('['+sd+'] 铁路货线 ≥16 顶点', rail>=16, rail);
   ck('['+sd+'] 地块 ≥16 (镇集密度档)', LOTS.length>=16, LOTS.length);
   if(SK==='mono'){ const ids=FLAGS.map(f=>f.id);
    ck('['+sd+'] 东街/西街 ≥1 且站前在 (mono)', ids.indexOf('站前')>=0&&ids.some(x=>x==='东街'||x==='西街'), JSON.stringify(ids)); }
  }
  if(bm==='water'){
   const RD=g('CAMPAIGN.river'), BS=g('CAMPAIGN.bridges'), DL=g('CAMPAIGN.delta');
   ck('['+sd+'] 石桥 2~3 座 (kind=stone)', BS.length>=2&&BS.length<=3&&BS.every(b=>b.kind==='stone'), BS.length);
   ck('['+sd+'] 跨河路段**全部**落桥矩形内 (零违规)', crossRiver(ROADS,RD,BS)===0, crossRiver(ROADS,RD,BS));
   ck('['+sd+'] 主河端点出图缘 (端点钉半径 ≥'+Math.round(170*380/380-0)+')', (()=>{
    const P=RD.pts; return Math.hypot(P[0][0],P[0][1])>=170&&Math.hypot(P[P.length-1][0],P[P.length-1][1])>=170; })());
   ck('['+sd+'] 两岸皆有旗 (核心岸 + 对岸)', (()=>{
    const cb=bankOf(RD,CORE.x,CORE.z), sb=FLAGS.map(f=>bankOf(RD,f.x,f.z));
    return sb.indexOf(cb)>=0&&sb.indexOf(-cb)>=0; })(), JSON.stringify(FLAGS.map(f=>bankOf(RD,f.x,f.z))));
   ck('['+sd+'] 汊港 0~2 条且出图缘', (()=>{
    const ch=DL.channels; if(ch.length>2) return false;
    return ch.every(c=>Math.max(Math.abs(c[c.length-1][0]),Math.abs(c[c.length-1][1]))>=150); })(), DL.channels.length);
   ck('['+sd+'] 鱼塘 1~4 口且不压旗/路/村', (()=>{
    const pd=DL.ponds; if(pd.length<1||pd.length>4) return false;
    return pd.every(p=>FLAGS.every(f=>Math.hypot(p.x-f.x,p.z-f.z)>=22)&&roadDist(ROADS,p.x,p.z)>=11
     &&SETT.every(s=>Math.hypot(p.x-s.x,p.z-s.z)>=s.r+13)); })(), DL.ponds.length);
   ck('['+sd+'] 地块不落水 (中心距主河 ≥w+0.4)', LOTS.every(l=>riverDist(RD,l.x,l.z)>=RD.w+0.4));
  }
  ck('['+sd+'] 种子不回写 (sf_pseed 未被改写)', (()=>{ const c2=makeCtx(null,PGIDX); const v=vm.runInContext('localStorage.getItem("sf_pseed")',c2); return v===null||v===''; })());
 }
}

// ── B. 规模三档扫描 (300/480 × 三群系种子): 尺寸链/场内/网格/基地距/旗数 ────────
for(const sz of [300,480]){
 const T=SZTAB[sz], GN=Math.round(sz/5);                   // 00c: GN=Math.round(HALF*2/5)=sz/5
 for(const bm of ['farm','town','water']){
  for(const sd of byBiome[bm]){
   const ctx=makeCtx(sd,PGIDX,sz);
   const g=expr=>vm.runInContext(expr,ctx);
   const FLAGS=g('CAMPAIGN.flags'), BASES=g('CAMPAIGN.bases'), FIELDS=g('CAMPAIGN.fields'),
         LOTS=g('PGDATA.lots'), H=g('PGDATA.hgrid');
   ck('[sz'+sz+'/'+sd+'] 规模链 mapSize='+sz, g('PG.size')===sz&&g('CAMPAIGN.mapSize')===sz&&g('CAMPAIGN.procgen.size')===sz);
   ck('[sz'+sz+'/'+sd+'] 场内 (旗/地块/田 ≤±'+T.in+')', FLAGS.every(f=>Math.abs(f.x)<=T.in&&Math.abs(f.z)<=T.in)
    &&LOTS.every(l=>Math.abs(l.x)<=T.in&&Math.abs(l.z)<=T.in)
    &&FIELDS.every(f=>f.x0>=-T.rc&&f.x1<=T.rc&&f.z0>=-T.rc&&f.z1<=T.rc));
   ck('[sz'+sz+'/'+sd+'] 旗两两 ≥52·贴路·距基地 ≥44', (()=>{
    for(let i=0;i<FLAGS.length;i++)for(let j=i+1;j<FLAGS.length;j++)
     if(Math.hypot(FLAGS[i].x-FLAGS[j].x,FLAGS[i].z-FLAGS[j].z)<52) return false;
    if(!FLAGS.every(f=>roadDist(g('CAMPAIGN.roads'),f.x,f.z)<=3.01)) return false;
    return FLAGS.every(f=>BASES.every(b=>Math.hypot(f.x-b.x,f.z-b.z)>=44)); })());
   ck('[sz'+sz+'/'+sd+'] 基地对轴 ('+(bm==='water'?T.baseW:T.baseN)+'+)', (()=>{ const d=Math.hypot(BASES[0].x-BASES[1].x,BASES[0].z-BASES[1].z);
    return d>=((bm==='water')?T.baseW:T.baseN); })(), Math.round(Math.hypot(BASES[0].x-BASES[1].x,BASES[0].z-BASES[1].z)));
   ck('[sz'+sz+'/'+sd+'] 高度场 '+(GN+1)+'² 幅值 <30', H.length===(GN+1)*(GN+1)&&H.every(v=>Math.abs(v)<30));
   ck('[sz'+sz+'/'+sd+'] 农田 ≥2·双保底', FIELDS.length>=2
    &&((bm==='water')?FIELDS.some(f=>f.t==='rice'):(FIELDS.some(f=>f.t==='corn'||f.t==='pasture')&&FIELDS.some(f=>f.t==='wheat'))));
   ck('[sz'+sz+'/'+sd+'] 旗数 3~7', FLAGS.length>=3&&FLAGS.length<=7, FLAGS.length);
  }
 }
}

// 同种子同规模全同 (三群系全部样本种子各两次运行逐位一致)
ck('同种子同规模全同 (三群系两次运行逐位一致)', (()=>{
 for(const bm of ['farm','town','water']) for(const sd of byBiome[bm]){
  const a=makeCtx(sd,PGIDX), b=makeCtx(sd,PGIDX);
  const ga=vm.runInContext('JSON.stringify({F:CAMPAIGN.flags,B:CAMPAIGN.bases,R:CAMPAIGN.roads,Fd:CAMPAIGN.fields,L:PGDATA.lots,P:PGDATA.polys,S:PGDATA.settles,W:PGDATA.woods,SG:PGDATA.singles,r:CAMPAIGN.river,b:CAMPAIGN.bridges,d:CAMPAIGN.delta})',a);
  const gb=vm.runInContext('JSON.stringify({F:CAMPAIGN.flags,B:CAMPAIGN.bases,R:CAMPAIGN.roads,Fd:CAMPAIGN.fields,L:PGDATA.lots,P:PGDATA.polys,S:PGDATA.settles,W:PGDATA.woods,SG:PGDATA.singles,r:CAMPAIGN.river,b:CAMPAIGN.bridges,d:CAMPAIGN.delta})',b);
  if(ga!==gb) return false;
 }
 return true;
})());
// 同种子跨规模必不同图 (尺寸是布局输入之一; 相同=规模没接线)
ck('同种子跨规模出不同图 (380 vs 480)', (()=>{
 for(const bm of ['farm','town','water']){
  const sd=byBiome[bm][0];
  const a=makeCtx(sd,PGIDX,380), b=makeCtx(sd,PGIDX,480);
  const ga=vm.runInContext('JSON.stringify({F:CAMPAIGN.flags,Fd:CAMPAIGN.fields,L:PGDATA.lots})',a);
  const gb=vm.runInContext('JSON.stringify({F:CAMPAIGN.flags,Fd:CAMPAIGN.fields,L:PGDATA.lots})',b);
  if(ga===gb) return false;
 }
 return true;
})());

// ===== farm 群系基线逐位 (2026-10-24 农田批重钉; dev/_pgfarm-baseline.json) =====
{
 const bp=path.join(root,'dev','_pgfarm-baseline.json');
 if(!fs.existsSync(bp)){ ck('farm 基线文件存在',false,'dev/_pgfarm-baseline.json 缺失'); }
 else{
  const base=JSON.parse(fs.readFileSync(bp,'utf8'));
  const FP='JSON.stringify({theme:PG.theme,flags:CAMPAIGN.flags,bases:CAMPAIGN.bases,roads:CAMPAIGN.roads,fields:CAMPAIGN.fields,lots:PGDATA.lots,polys:PGDATA.polys,settleS:PGDATA.settles,woods:PGDATA.woods,singles:PGDATA.singles,hgrid:PGDATA.hgrid,seed:PGDATA.seed,skeleton:PGDATA.skeleton,size:PGDATA.size,fieldTpl:PGDATA.fieldTpl,grass:PGDATA.grass})';
  let n=0,same=0;const drift=[];
  for(const [sd,rec] of Object.entries(base.seeds)){
   if(rec.biome!=='farm') continue;
   n++;
   const c=makeCtx(parseInt(sd,10),PGIDX,(rec.size||380));
   if(vm.runInContext(FP,c)===rec.fp) same++; else drift.push(sd);
  }
  ck('farm 基线逐位零漂移 ('+n+' 种子@380)', same===n, 'drift: '+drift.join(','));
 }
}

// ===== 统计段: 240 种子@380 —— 骨架分布/地标缺席/旗数达标/跨河零违规/群系差异 =====
{
 const stat={farm:{n:0,flags:{},sk:{},lm:0,mill:0,millN:0,fac:0,walls:0,fields:0,hay:0,single:0,
   tpl:{},belt2:0,corn1:0,cm2:0,cmN:0},
  town:{n:0,flags:{},sk:{},fields:0},
  water:{n:0,flags:{},sk:{},cross:0,bridge:{},ford:0,pond:0,chan:0,rice:0}};
 for(let s=100001;s<100241;s++){
  const c=makeCtx(s,PGIDX), gg=e=>vm.runInContext(e,c);
  const bm=gg('PG.biome'); const S=stat[bm]; if(!S) continue; S.n++;
  const F=gg('CAMPAIGN.flags.length');
  S.flags[F]=(S.flags[F]||0)+1;
  const sk=gg('PGDATA.skeleton'); S.sk[sk]=(S.sk[sk]||0)+1;
  if(bm==='farm'){
   if(gg('PGDATA.lots.some(l=>l.kind==="church"||l.kind==="tower")')) S.lm++;
   // 风车=欧式专属地标 (extraGreen=mill, 55%+重试; 中式副村是碉楼) —— 分母只数欧式种子, 否则混池上限≈50%×70%
   if(gg('PG.theme')!=="china"){ S.millN++;
    if(gg('PGDATA.lots.some(l=>l.kind==="mill")')) S.mill++;
   }
   if(gg('PGDATA.factoryPlaced()')) S.fac++;
   // 战区田带指标 (2026-10-24e): 模板分布 / belt≥2·青纱帐·c+m≥2 达标率 / 战区田占比
   const tp=gg('PGDATA.fieldTpl'); S.tpl[tp]=(S.tpl[tp]||0)+1;
   const Fj=gg('JSON.stringify(CAMPAIGN.fields.map(f=>({t:f.t,zn:f.zn,belt:f.belt?1:0})))'), Ff=JSON.parse(Fj);
   const belt=Ff.filter(f=>f.belt), cm=Ff.filter(f=>f.zn==='c'||f.zn==='m');
   if(belt.length>=2) S.belt2++;
   if(belt.some(f=>f.t==='corn')) S.corn1++;
   if(cm.length>=2) S.cm2++;
   S.cmN+=cm.length;
   S.fields+=gg('CAMPAIGN.fields.length');
   S.walls+=gg('CAMPAIGN.fields.reduce((a,f)=>a+(f.walls||[]).length,0)');
   S.hay+=gg('CAMPAIGN.fields.reduce((a,f)=>a+(f.hay||[]).length,0)');
   S.single+=gg('PGDATA.singles.length');
  }else if(bm==='town'){
   S.fields+=gg('CAMPAIGN.fields.length');
  }else{
   const RD=gg('CAMPAIGN.river'), BS=gg('CAMPAIGN.bridges'), R=gg('CAMPAIGN.roads');
   S.cross+=crossRiver(R,RD,BS);
   S.bridge[BS.length]=(S.bridge[BS.length]||0)+1;
   if(RD.ford) S.ford++;
   S.pond+=gg('CAMPAIGN.delta.ponds.length');
   S.chan+=gg('CAMPAIGN.delta.channels.length');
   S.rice+=gg('CAMPAIGN.fields.filter(f=>f.t==="rice").length');
  }
 }
 const N=stat.farm.n+stat.town.n+stat.water.n;
 ck('统计段: 三群系分布均衡 (各 ≥20%)', stat.farm.n>=N*0.2&&stat.town.n>=N*0.2&&stat.water.n>=N*0.2,
  'farm='+stat.farm.n+' town='+stat.town.n+' water='+stat.water.n);
 // 骨架抽签: farm/town 内三骨架各 ≥15% (多样性裁定)
 ck('统计段: farm 骨架三型各 ≥15%', ['mono','dual','linear'].every(k=>(stat.farm.sk[k]||0)>=stat.farm.n*0.15), JSON.stringify(stat.farm.sk));
 ck('统计段: town 骨架三型各 ≥15%', ['mono','dual','linear'].every(k=>(stat.town.sk[k]||0)>=stat.town.n*0.15), JSON.stringify(stat.town.sk));
 // 地标随机缺席 (2026-10-24 裁定): 教堂/碉楼在场 60~90% · 风车 (green farm) 35~75% · 厂 (farm) 50~80%
 ck('统计段: farm 主村地标在场 60~90%', stat.farm.lm>=stat.farm.n*0.6&&stat.farm.lm<=stat.farm.n*0.9, stat.farm.lm+'/'+stat.farm.n);
 ck('统计段: farm 风车在场(欧式池) 45~85%', stat.farm.mill>=stat.farm.millN*0.45&&stat.farm.mill<=stat.farm.millN*0.85, stat.farm.mill+'/'+stat.farm.millN);
 ck('统计段: farm 厂在场 35~75% (55%/段滚点−落位损失)', stat.farm.fac>=stat.farm.n*0.35&&stat.farm.fac<=stat.farm.n*0.75, stat.farm.fac+'/'+stat.farm.n);
 ck('统计段: farm 旗数恒 ≥3 且 ≥4 达标率 ≥80%', (()=>{
  const tot=stat.farm.n, ge3=tot-(stat.farm.flags[1]||0)-(stat.farm.flags[2]||0);
  let ge4=0; for(const k in stat.farm.flags) if(parseInt(k,10)>=4) ge4+=stat.farm.flags[k];
  return ge3===tot&&ge4>=tot*0.8; })(), JSON.stringify(stat.farm.flags));
 ck('统计段: farm 田均 ≥9 且墙/田 ≥2.2·草垛/田 ≥1.2·孤树均 ≥10',
  (stat.farm.fields/stat.farm.n)>=9&&(stat.farm.walls/stat.farm.fields)>=2.2
  &&(stat.farm.hay/stat.farm.fields)>=1.2&&(stat.farm.single/stat.farm.n)>=10,
  '田均'+(stat.farm.fields/stat.farm.n).toFixed(1)+' 墙/田'+(stat.farm.walls/stat.farm.fields).toFixed(2)
  +' 垛/田'+(stat.farm.hay/stat.farm.fields).toFixed(2)+' 树均'+(stat.farm.single/stat.farm.n).toFixed(1));
 // 战区田带 (2026-10-24e): 模板四型各 ≥12% / belt≥2 ≥94% / 青纱帐 ≥97% / c+m≥2 ≥95% / 战区田占比 ≥25%
 ck('统计段: farm 田带四型各 ≥12%', ['center','flank','mixed','cross'].every(k=>(stat.farm.tpl[k]||0)>=stat.farm.n*0.12), JSON.stringify(stat.farm.tpl));
 ck('统计段: farm 主田带 ≥2 块 ≥94% (含救援兜底)', stat.farm.belt2>=stat.farm.n*0.94, stat.farm.belt2+'/'+stat.farm.n);
 ck('统计段: farm 青纱帐在场 (belt 含 corn) ≥97%', stat.farm.corn1>=stat.farm.n*0.97, stat.farm.corn1+'/'+stat.farm.n);
 ck('统计段: farm 战区田 (c+m) ≥2 块 ≥95%', stat.farm.cm2>=stat.farm.n*0.95, stat.farm.cm2+'/'+stat.farm.n);
 ck('统计段: farm 战区田占比 ≥25% (成为战局因素)', (stat.farm.cmN/stat.farm.fields)>=0.25,
  ((stat.farm.cmN/stat.farm.fields)*100).toFixed(0)+'%');
 ck('统计段: town 田均 ≥2.5 (零农田修复)', (stat.town.fields/stat.town.n)>=2.5, (stat.town.fields/stat.town.n).toFixed(2));
 ck('统计段: town 旗数恒 ≥3 且 ≥4 率 ≥80%', (()=>{
  const tot=stat.town.n, ge3=tot-(stat.town.flags[1]||0)-(stat.town.flags[2]||0);
  let ge4=0; for(const k in stat.town.flags) if(parseInt(k,10)>=4) ge4+=stat.town.flags[k];
  return ge3===tot&&ge4>=tot*0.8; })(), JSON.stringify(stat.town.flags));
 ck('统计段: water 旗数 4~5 恒真', (stat.water.flags[4]||0)+(stat.water.flags[5]||0)===stat.water.n, JSON.stringify(stat.water.flags));
 ck('统计段: water 跨河零违规 (240 图)', stat.water.cross===0, stat.water.cross);
 ck('统计段: water 稻丛绿保底均 ≥1', (stat.water.rice/stat.water.n)>=1, (stat.water.rice/stat.water.n).toFixed(2));
}

console.log('\n══ verify-procgen: '+pass+' 通过 / '+fail+' 失败 ══');
if(fail){ console.log('失败项:'); for(const f of fails) console.log(' - '+f); process.exit(1); }
