// ─────────────────────────────────────────────
// dev/verify-strongpoint.js —— WS3「中障壁不可摧毁工事 + 中立可占领强点」验收沙箱 (不进 Index.html)
// 用法: node dev/verify-strongpoint.js
//
// 覆盖 task-3 的四条验收:
//   ① 13 图布局指纹 —— **控制副本对照** (见下"方法论"),
//   ② 新工事的登记/避让/可进可登 (BUILD_REG / DESTRUCTIBLES / STAIRS / NAV_CLEARS / roofY 台账),
//   ③ 稳定占点仿真 (真实 updateSpots 逐帧推进: 美军单方 / 日军单方 / 双方僵持 / 夺回),
//   ④ 泼伤害后工事本体仍在 (同半径内可毁件全灭 = 阴性对照) + 其它 12 图强点门限行为不变。
//   (验收 ② `node dev/verify-boot.js` 13/13 由该脚本单独跑, 本脚本不重复 33 脚本 × 13 图的加载。)
//
// 【方法论: 为什么用控制副本而不是"改动前的固定基线"】
//   本轮是多人并发写同一仓 (watchtower 补 foundation / 地形与水材质 / 载具建模)。若拿"我动手之前"
//   录下的固定指纹做基线, 队友的改动会被算进我的验收。控制副本 = 把当前工作区整棵 js/ 复制到临时目录,
//   只删掉 00-config 里这一条 island spawns 条目 —— 05c 的 E2 段随即整段跳过 (SP=null),
//   于是两棵树的差异**只有我这一个改动**。逐图 sha1(layoutFp) 必须: 其余 12 图逐位相同, 只有 island 变。
//
// 【harness 复用】两个沙箱脚本 (verify-layouts / verify-boot) 都是"前段建环境 + 末段跑断言"的结构,
//   这里按末段标记截断取前段, 在同一 vm context 里复用它们的 runCampaign/layoutFp 与 boot() ——
//   不复制第二份地形/THREE 桩 (复制就是两套代码做同一件事, 本仓纲领 §2 明令禁止)。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'), path=require('path'), vm=require('vm'), crypto=require('crypto'), os=require('os');
const root=path.resolve(__dirname,'..');
let pass=0, fail=0;
const ok=(c,msg)=>{ if(c){ pass++; console.log('  ✓ '+msg); } else { fail++; console.log('  ✗ '+msg); } };
const sha1=s=>crypto.createHash('sha1').update(s).digest('hex');
const f2=(v,n=2)=>Number(v).toFixed(n);
// 点→矩形 / 线段→矩形 最小距离 (与 05-world placeAt 的避让口径一致: 轴对齐矩形)
const rectOf=(x,z,ry,w,d)=>{ const cs=Math.abs(Math.cos(ry)),sn=Math.abs(Math.sin(ry)); const ex=(w*cs+d*sn)/2, ez=(w*sn+d*cs)/2; return {x0:x-ex,x1:x+ex,z0:z-ez,z1:z+ez}; };
const pRect=(px,pz,R)=>Math.hypot(Math.max(R.x0-px,0,px-R.x1),Math.max(R.z0-pz,0,pz-R.z1));
const segRect=(ax,az,bx,bz,R)=>{ let m=1e9; const n=Math.max(2,Math.ceil(Math.hypot(bx-ax,bz-az)/0.25)); for(let i=0;i<=n;i++){ const t=i/n, d=pRect(ax+(bx-ax)*t,az+(bz-az)*t,R); if(d<m) m=d; } return m; };

// ── harness 装载 ──
function loadHarness(file, marker, dir){
const src=fs.readFileSync(path.join(dir||root,file),'utf8');
const cut=src.indexOf(marker);
if(cut<0) throw new Error(`${file} 结构变了: 找不到分隔标记 ${JSON.stringify(marker)} —— harness 复用失效`);
const sb={require, __dirname:path.join(dir||root,path.dirname(file)), process, console, Buffer};
const c=vm.createContext(sb);
vm.runInContext(src.slice(0,cut), c, {filename:file.replace(/^.*\//,'harness-')});
return c;
}
const g=(ctx,name)=>vm.runInContext(name,ctx);

console.log('══ WS3 中障壁不可摧毁工事 + 中立可占领强点 · 验收 ══\n');

// ══════════════════════════════════════════════════════════════════════════════════════════
// ① 13 图布局指纹: 控制副本 (删掉 island spawns 条目 = 我改之前) vs 当前树
// ══════════════════════════════════════════════════════════════════════════════════════════
console.log('① 布局指纹 (控制副本 vs 当前树, sha1(layoutFp), 种子 42)');
const SPAWN_LINE="spawns:[{x:16,z:19,name:'中障壁碉堡',team:-1,r:12}],";
let ctlDir=null, ctlHarness=null, liveHarness=null;
try{
ctlDir=fs.mkdtempSync(path.join(os.tmpdir(),'ws3-ctl-'));
fs.cpSync(path.join(root,'js'), path.join(ctlDir,'js'), {recursive:true});
fs.mkdirSync(path.join(ctlDir,'dev'), {recursive:true});
fs.copyFileSync(path.join(root,'dev/verify-layouts.js'), path.join(ctlDir,'dev/verify-layouts.js'));
fs.copyFileSync(path.join(root,'dev/verify-boot.js'), path.join(ctlDir,'dev/verify-boot.js'));
const cfgP=path.join(ctlDir,'js/00-config.js');
let cfg=fs.readFileSync(cfgP,'utf8');
if(cfg.indexOf(SPAWN_LINE)<0) throw new Error('控制副本注入失败: 00-config 里找不到 island spawns 条目');
fs.writeFileSync(cfgP, cfg.replace(SPAWN_LINE+'\\n','').replace(SPAWN_LINE,''));
ctlHarness=loadHarness('dev/verify-layouts.js','// ── 测试主体 ──',ctlDir);
liveHarness=loadHarness('dev/verify-layouts.js','// ── 测试主体 ──');
const nC=vm.runInContext('CAMPAIGNS.length',ctlHarness.runCampaign(0,42).ctx);
const rows=[];
for(let i=0;i<nC;i++){
const rc=ctlHarness.runCampaign(i,42), rl=liveHarness.runCampaign(i,42);
const dc=sha1(ctlHarness.layoutFp(rc.ctx)), dl=sha1(liveHarness.layoutFp(rl.ctx));
const cnt=(r)=>{ const gg=(x)=>vm.runInContext(x,r.ctx).length; return {boxes:gg('BOXES'),cyls:gg('CYLS'),nav:gg('NAV_CLEARS'),foot:gg('B_FOOT'),props:gg('PROPS'),stairs:gg('STAIRS'),regs:gg('BUILD_REG')}; };
rows.push({i,id:rl.CAMP.id,mode:rl.CAMP.mode,dc,dl,cc:cnt(rc),cl:cnt(rl)});
}
console.log('  #  map         mode        控制副本(无 spawns 条目)                          当前树');
for(const r of rows) console.log(`  ${String(r.i).padStart(2)} ${r.id.padEnd(11)} ${String(r.mode).padEnd(11)} ${r.dc}  ${r.dl}${r.dc===r.dl?'  (逐位相同)':'  ← 变了'}`);
console.log('\n  逐图计数 (boxes/cyls/nav/foot/props/stairs/regs):');
for(const r of rows){
const a=r.cc,b=r.cl;
const same=['boxes','cyls','nav','foot','props','stairs','regs'].every(k=>a[k]===b[k]);
console.log(`  ${r.id.padEnd(11)} 控制 ${a.boxes}/${a.cyls}/${a.nav}/${a.foot}/${a.props}/${a.stairs}/${a.regs}   当前 ${b.boxes}/${b.cyls}/${b.nav}/${b.foot}/${b.props}/${b.stairs}/${b.regs}${same?'':'  ← 计数值变了'}`);
}
const island=rows.find(r=>r.id==='island');
const others=rows.filter(r=>r.id!=='island');
ok(others.every(r=>r.dc===r.dl), `其余 ${others.length} 图布局指纹逐位不变 (sha1(layoutFp) 相同)`);
ok(island&&island.dc!==island.dl, `island 指纹按预期改变 (新工事入图): ${island.dc.slice(0,12)}… → ${island.dl.slice(0,12)}…`);
const io=island.cl, ic=island.cc;
console.log(`\n  island 计数增量: boxes ${ic.boxes}→${io.boxes} (+${io.boxes-ic.boxes})  cyls ${ic.cyls}→${io.cyls} (+${io.cyls-ic.cyls})  nav ${ic.nav}→${io.nav} (+${io.nav-ic.nav})  foot ${ic.foot}→${io.foot} (+${io.foot-ic.foot})  props ${ic.props}→${io.props} (+${io.props-ic.props})  stairs ${ic.stairs}→${io.stairs} (+${io.stairs-ic.stairs})  regs ${ic.regs}→${io.regs} (+${io.regs-ic.regs})`);
ok(io.regs===ic.regs+1, `regs 计数 +1 (新工事登记, ${ic.regs}→${io.regs})`);

// ── ①b 结算门限等价性 (静态枚举 13 图: 新旧判据的唯一分歧点必须是 island) ──
console.log('\n①b 强点结算门限等价性 (旧: GAMEMODE===\'clash\'; 新: 遭遇战 || spawns 里有 team:-1 中立强点)');
const gateRows=[];
for(let i=0;i<nC;i++){
const C=liveHarness.runCampaign(i,42).CAMP;
const sp=C.spawns||[];
const oldOn=(C.mode==='clash')&&sp.length>0;
const newOn=sp.length>0&&(C.mode==='clash'||sp.some(s=>s.team===-1));
gateRows.push({id:C.id,mode:C.mode,n:sp.length,teams:sp.map(s=>s.team).join(','),oldOn,newOn});
}
for(const r of gateRows) console.log(`  ${r.id.padEnd(11)} mode=${String(r.mode).padEnd(11)} spawns=${r.n} teams=[${r.teams}]  旧结算=${r.oldOn?1:0} 新结算=${r.newOn?1:0}${r.oldOn!==r.newOn?'   ← 分歧':'  '}`);
const diff=gateRows.filter(r=>r.oldOn!==r.newOn).map(r=>r.id);
ok(diff.length===1&&diff[0]==='island', `新旧门限唯一分歧 = ${JSON.stringify(diff)} (期望 ["island"]) —— 其余 12 图 SPOTS 结算行为逐字不变`);
}catch(e){ fail++; console.log('  ✗ ① 布局指纹对照失败: '+(e&&e.stack||e)); }

// ══════════════════════════════════════════════════════════════════════════════════════════
// ② 岛屿布局事实: 工事登记 / 避让距离 / 可进可登 / 台账
// ══════════════════════════════════════════════════════════════════════════════════════════
console.log('\n② 中障壁工事: 落位 / 避让 / 可进可登 / 登记');
try{
const r=liveHarness.runCampaign(12,42), c=r.ctx;
const reg=g(c,'BUILD_REG').filter(b=>b.type==='strongpoint');
ok(reg.length===1, `BUILD_REG 里正好 1 座 strongpoint (实得 ${reg.length})`);
const R=reg[0];
ok(R&&R.indestr===true, 'BUILD_REG 条目 indestr=true (不可摧毁口径)');
console.log(`  工事: (${R.x},${R.z}) ry=${R.ry} w×d=${R.w}×${R.d} floor=${f2(R.floor)} ringY=${f2(R.ringY)} deckY=${f2(R.deckY)} roofY=${f2(R.roofY)} 门数=${R.doors.length} 台账 bands=${R.ref.bands.length} slabs=${R.ref.slabs.length}`);
const FLAGS=g(c,'FLAGS'), flag=FLAGS.find(f=>f.id==='中障壁');
const FR=rectOf(R.x,R.z,R.ry,R.w,R.d);
const dFlag=Math.hypot(R.x-flag.x,R.z-flag.z);
console.log(`\n  ── 避让距离 (工事中心→ / 占地矩形→, m) ──`);
console.log(`  中障壁旗 (${flag.x},${flag.z}) r${flag.r}: 中心 ${f2(dFlag)} / 矩形 ${f2(pRect(flag.x,flag.z,FR))}`);
const WALLS=[['石障壁南西 -76,40→-14,46',-76,40,-14,46],['石障壁南东 14,46→76,40',14,46,76,40],
['石障壁北西 -56,4→-10,8',-56,4,-10,8],['石障壁北东 10,8→56,4',10,8,56,4]];
const TRENCH=[['战壕西翼 -68,38→-16,44',-68,38,-16,44],['战壕东翼 16,44→68,38',16,44,68,38]];
const ROADS=[[0,120,-4,70],[-4,70,0,20],[0,20,0,-30],[0,-30,-8,-72]];
const BUNKERS=[['椰木掩体 -34,42',-34,42],['椰木掩体 36,42',36,42],['椰木掩体 -16,34',-16,34],['椰木掩体 18,34',18,34]];
const dists={};
for(const [nm,ax,az,bx,bz] of WALLS){ const d=segRect(ax,az,bx,bz,FR); dists[nm]=d; console.log(`  ${nm.padEnd(26)}: 中心 ${f2(Math.hypot(R.x-(ax+bx)/2,R.z-(az+bz)/2))} / 矩形 ${f2(d)}`); }
for(const [nm,ax,az,bx,bz] of TRENCH){ const d=segRect(ax,az,bx,bz,FR); dists[nm]=d; console.log(`  ${nm.padEnd(26)}: 中心 ${f2(Math.hypot(R.x-(ax+bx)/2,R.z-(az+bz)/2))} / 矩形 ${f2(d)}`); }
let dRoad=1e9; for(const s of ROADS){ const d=segRect(s[0],s[1],s[2],s[3],FR); if(d<dRoad) dRoad=d; }
dists['公路(南北向 x≈0)']=dRoad;
console.log(`  ${'公路 (x≈0 南北向)'.padEnd(26)}: 中心 ${f2(Math.abs(R.x-0))} / 矩形 ${f2(dRoad)}   ← NAV_CLEARS 门区没堵公路的判据`);
for(const [nm,bx,bz] of BUNKERS){ const d=pRect(bx,bz,FR); dists[nm]=d; console.log(`  ${nm.padEnd(26)}: 中心 ${f2(Math.hypot(R.x-bx,R.z-bz))} / 矩形 ${f2(d)}`); }
ok(dists['公路(南北向 x≈0)']>=5, `工事矩形离公路中心线 ≥5m (实得 ${f2(dRoad)}m) —— 门区 NAV_CLEARS 不堵公路口`);
ok(WALLS.every(w=>dists[w[0]]>=3), '工事矩形离 4 道石障壁线 ≥3m');
ok(TRENCH.every(t=>dists[t[0]]>=3), '工事矩形离 2 条战壕折线 ≥3m');
ok(BUNKERS.every(b=>dists[b[0]]>=3), '工事矩形离 4 座椰木掩体 ≥3m');
ok(dFlag<flag.r+12, `强点圈 (r=12) 与旗圈 (r=${flag.r}) 重叠: 圈心距 ${f2(dFlag)} < ${flag.r}+12`);
// 门 / 通行区 / 楼梯
const nav=g(c,'NAV_CLEARS').filter(n=>Math.hypot(n.x-R.x,n.z-R.z)<12);
console.log(`\n  门区 NAV_CLEARS (12m 内): ${nav.length} 个 —— ${nav.map(n=>`(${f2(n.x,1)},${f2(n.z,1)}) r${f2(n.r,2)}`).join(' ')}`);
ok(R.doors.length>=2&&nav.length>=2, `两个门 (北/东) 都登记了通行区 (doors=${R.doors.length}, nav=${nav.length})`);
const stairs=g(c,'STAIRS').filter(s=>Math.hypot(s.x-R.x,s.z-R.z)<10);
console.log(`  梯道 STAIRS: ${stairs.map(s=>`(${f2(s.x,1)},${f2(s.z,1)}) topY=${f2(s.topY)} 步高${f2(s.sr,3)}×${s.n}级`).join('  ')}`);
ok(stairs.length===2, `两跑梯都登记 (实得 ${stairs.length})`);
ok(stairs.some(s=>Math.abs(s.topY-(R.floor+4.4))<1e-6), `跑一顶面 = 一层顶 g0+4.4 (${f2(R.floor+4.4)}) ⇒ 环廊可登`);
ok(stairs.some(s=>Math.abs(s.topY-(R.floor+7.8))<1e-6), `跑二顶面 = 屋顶观测台 g0+7.8 (${f2(R.floor+7.8)}) ⇒ 可登顶`);
// 屋顶碰撞 (verify-buildings ④ 同一口径) + 台账
const boxes=g(c,'BOXES');
const hasRoof=boxes.some(b=>!b.dead&&b.maxY>R.roofY-0.45&&b.maxY<R.roofY+0.45);
ok(hasRoof, `roofY=${f2(R.roofY)} 处存在碰撞盒 (无浮空板口径: |maxY-roofY|≤0.45)`);
ok(R.ref.bands.length>0&&R.ref.slabs.length>0, `结构台账非空 (bands=${R.ref.bands.length} roofs=${R.ref.m.length} slabs=${R.ref.slabs.length})`);
const owned=boxes.filter(b=>b.building&&b.building.type==='strongpoint');
console.log(`  工事碰撞盒 ${owned.length} 个 (全挂 b.building=strongpoint), 覆盖 X[${f2(Math.min(...owned.map(b=>b.minX)))}..${f2(Math.max(...owned.map(b=>b.maxX)))}] Z[${f2(Math.min(...owned.map(b=>b.minZ)))}..${f2(Math.max(...owned.map(b=>b.maxZ)))}] Y[${f2(Math.min(...owned.map(b=>b.minY)))}..${f2(Math.max(...owned.map(b=>b.maxY)))}]`);
ok(owned.length>60, `工事本体碰撞盒成规模 (>60, 实得 ${owned.length}) —— 是一座工事而不是一个掩体`);
// DESTRUCTIBLES 避让 (验收 ③)
const dstr=g(c,'DESTRUCTIBLES');
const near=dstr.filter(gr=>Math.hypot(gr.cx-R.x,gr.cz-R.z)<12);
ok(near.length===0, `DESTRUCTIBLES 里没有结构组落在工事 12m 内 (实得 ${near.length})`);
let dDstr=1e9; for(const gr of dstr){ const d=Math.hypot(gr.cx-R.x,gr.cz-R.z); if(d<dDstr) dDstr=d; }
console.log(`  最近可毁结构组 @${f2(dDstr)}m (>12 ⇒ 工事不可毁且不被溅射连带)`);
// 掩体点
const cps=g(c,'coverPoints').filter(p=>Math.hypot(p.x-R.x,p.z-R.z)<9);
console.log(`  工事掩体点 coverPoints: ${cps.length} 个 (近 9m) —— ${cps.map(p=>`(${f2(p.x,1)},${f2(p.z,1)})`).join(' ')}`);
ok(cps.length>=6, `掩体点 ≥6 (addCoverAround 4 + 室内/环廊 2, 实得 ${cps.length})`);
// "能用"实证: 门洞可通行 + 室内可站 + 环廊/屋顶观测台可站 (在碰撞盒上判, 不看视觉)
{
const alive=boxes.filter(b=>!b.dead);
const L=(lx,lz)=>[R.x+lx*Math.cos(R.ry)+lz*Math.sin(R.ry), R.z-lx*Math.sin(R.ry)+lz*Math.cos(R.ry)];  // 与 05-world bctx.L 同式
const eye=1.9;
const blocked=(px,pz,y0,y1)=>alive.some(b=>px>b.minX&&px<b.maxX&&pz>b.minZ&&pz<b.maxZ&&b.maxY>y0&&b.minY<y1);
for(const d of R.doors){
const ox=d.x+d.dx*1.2, oz=d.z+d.dz*1.2;
const free=!blocked(d.x,d.z,R.floor+0.15,R.floor+eye)&&!blocked(ox,oz,R.floor+0.15,R.floor+eye);
console.log(`  门 @(${f2(d.x,1)},${f2(d.z,1)}) 净宽 ${f2(d.w)} 朝 (${f2(d.dx,2)},${f2(d.dz,2)}) 门外 1.2m @(${f2(ox,1)},${f2(oz,1)}) 门槛内外净空=${free}`);
ok(free, `门洞可通行 (门槛 + 门外 1.2m 在 floor+0.15..+1.9 高度带内无碰撞盒)`);
}
const topAt=(px,pz)=>{ let t=-1e9; for(const b of alive){ if(px>b.minX&&px<b.maxX&&pz>b.minZ&&pz<b.maxZ&&b.maxY>t) t=b.maxY; } return t; };
const ctr=L(0,0), ring=L(0,4.0), deck=L(0,0);
console.log(`  站面: 室内 (${f2(ctr[0],1)},${f2(ctr[1],1)}) 最高碰撞面 ${f2(topAt(ctr[0],ctr[1]))}  环廊 (${f2(ring[0],1)},${f2(ring[1],1)}) ${f2(topAt(ring[0],ring[1]))}  屋顶观测台 ${f2(topAt(deck[0],deck[1]))}`);
ok(!blocked(ctr[0],ctr[1],R.floor+0.15,R.floor+eye), `室内可站 (中心 ${f2(ctr[0],1)},${f2(ctr[1],1)} 在 floor+0.15..+1.9 高度带内无碰撞盒)`);
ok(Math.abs(topAt(ctr[0],ctr[1])-R.deckY)<1e-6, `室内中心正上方是屋顶板 (top=${f2(R.deckY)}, 上下两层实心)`);
ok(Math.abs(topAt(ring[0],ring[1])-R.ringY)<1e-6, `环廊可站: 一层顶板顶面 ${f2(topAt(ring[0],ring[1]))} = ringY ${f2(R.ringY)}`);
ok(Math.abs(topAt(deck[0],deck[1])-R.deckY)<1e-6, `屋顶观测台可站: 顶面 ${f2(topAt(deck[0],deck[1]))} = deckY ${f2(R.deckY)} (比一层楼面高 ${f2(R.deckY-R.floor)}m)`);
}
// 地形净空: 工事必须落在净位上
const props=g(c,'PROPS');
let dProp=1e9,pr=null; for(const p of props){ const d=pRect(p.x,p.z,FR)-p.r; if(d<dProp){ dProp=d; pr=p; } }
console.log(`  最近道具净距 ${f2(dProp)}m (道具 @${f2(pr.x,1)},${f2(pr.z,1)} r${f2(pr.r)})`);
ok(dProp>=1.0, `落位对道具净距 ≥1m (实得 ${f2(dProp)}m) —— 未压石障壁段/弹坑/植被`);
console.log(`  地形: floor=${f2(R.floor)} heightAt(中心)=${f2(g(c,'heightAt')(R.x,R.z))} shoreDist=${f2(g(c,'shoreDist')(R.x,R.z))}`);
}catch(e){ fail++; console.log('  ✗ ② 失败: '+(e&&e.stack||e)); }

// ══════════════════════════════════════════════════════════════════════════════════════════
// ③+④ 运行时: 真实 updateSpots 占点仿真 / 泼伤害 / 其它图门限行为不变
// ══════════════════════════════════════════════════════════════════════════════════════════
console.log('\n③ 稳定占点仿真 (真实 startMatch + updateSpots 逐帧推进, dt=1/60)');
let bootHarness=null;
try{
bootHarness=loadHarness('dev/verify-boot.js','\nconst idx=process.argv[2]');
const boot=(i)=>{
const ctx=bootHarness.boot(i);
const hook=vm.runInContext(`(()=>{ const btn=document.getElementById('startBtn'); if(!btn||!btn.onclick) return {ok:false,err:'no startBtn onclick'}; btn.onclick(); return {ok:true,camp:CAMPAIGN.id,mode:CAMPAIGN.mode}; })()`,ctx);
if(!hook.ok) throw new Error('startGame 失败: '+hook.err);
return ctx;
};
// 在强点圈内摆单位 (offsets 保证都在 r=12 内), 然后逐帧推进真实 updateSpots
const sim=(ctx,teams,frames)=>{
const off=[[0,0],[3,0],[-3,0],[0,3],[0,-3],[3,3],[-3,-3]];
const push=teams.map((t,k)=>`combatants.push({alive:true,onVehicle:false,isPlayer:false,spectator:false,team:${t},pos:{x:S.x+${off[k][0]},y:S.gy,z:S.z+${off[k][1]}}});`).join('\n');
vm.runInContext(`(()=>{ combatants.length=0; const S=SPOTS[0];\n${push}\nreturn combatants.length; })()`,ctx);
const own0=vm.runInContext('SPOTS[0].own',ctx);
let flip=-1, trace=[];
for(let i=0;i<frames;i++){
vm.runInContext('updateSpots(1/60);',ctx);
const st=vm.runInContext('({own:SPOTS[0].own,cap:SPOTS[0].cap,capTeam:SPOTS[0].capTeam,present:SPOTS[0].present.slice()})',ctx);
if(i%120===0) trace.push(`t=${(i/60).toFixed(0)}s own=${st.own} cap=${st.cap.toFixed(2)}`);
if(flip<0&&st.own!==own0) flip=i/60;   // 翻转 = 相对本回合起点 (own0 可能是 -1 或已被占的 0/1)
}
return {flip,trace:trace.concat([`t=${(frames/60).toFixed(0)}s own=${vm.runInContext('SPOTS[0].own',ctx)}`])};
};
const ctxI=boot(12);
const spots=g(ctxI,'SPOTS');
ok(spots.length===1&&spots[0].own===-1, `island SPOTS 长度 1 且开局 own=-1 (实得 ${spots.length} 个, own=${spots[0]&&spots[0].own})`);
ok(Math.abs(spots[0].r-12)<1e-9&&spots[0].name==='中障壁碉堡', `强点 r=${spots[0].r} name=${spots[0].name}`);
const tanksIn=g(ctxI,'tanks').filter(t=>t.alive&&Math.hypot(t.pos.x-spots[0].x,t.pos.z-spots[0].z)<spots[0].r);
ok(tanksIn.length===0, `开局无坦克落在强点圈内 (实得 ${tanksIn.length}) —— 仿真单位数是唯一变量`);
// ③-a 美军单方
const a=sim(ctxI,[0],1800);
console.log(`  美军单方 30s: 翻转时刻 t=${a.flip<0?'未翻转':f2(a.flip)+'s'}  ${a.trace.join('  ')}`);
ok(a.flip>3&&a.flip<12, `美军单方: own 从 -1 翻到 0, 用时 ${f2(a.flip)}s (理论 (0.07+0.035)×1.35=0.14175/s ⇒ 7.05s)`);
ok(g(ctxI,'SPOTS')[0].own===0, '翻转后 own===0 (该点成为美军出生权)');
// ③-b 夺回: 日军单方 (先复位)
vm.runInContext(`(()=>{ SPOTS[0].own=-1; SPOTS[0].cap=0; SPOTS[0].capTeam=-1; combatants.length=0; })()`,ctxI);
const b=sim(ctxI,[1],1800);
console.log(`  日军单方 30s: 翻转时刻 t=${b.flip<0?'未翻转':f2(b.flip)+'s'}  ${b.trace.join('  ')}`);
ok(b.flip>3&&b.flip<12&&g(ctxI,'SPOTS')[0].own===1, `日军单方: own 翻到 1 (${f2(b.flip)}s)`);
// ③-c 双方在场 = 僵持
vm.runInContext(`(()=>{ SPOTS[0].own=-1; SPOTS[0].cap=0; SPOTS[0].capTeam=-1; combatants.length=0; })()`,ctxI);
const cse=sim(ctxI,[0,1],1800);
const stC=vm.runInContext('({own:SPOTS[0].own,cap:SPOTS[0].cap,present:SPOTS[0].present.slice()})',ctxI);
console.log(`  双方各 1 人 30s: own=${stC.own} cap=${f2(stC.cap)} present=[${stC.present}]  ${cse.trace.join('  ')}`);
ok(stC.own===-1&&stC.cap===0, '双方僵持: own 仍 -1, 进度恒 0 (与旗点同款)');
// ③-d 夺回已占点 (own=0 时日军单方, 速率回落 ×1)
vm.runInContext(`(()=>{ SPOTS[0].own=0; SPOTS[0].cap=0; SPOTS[0].capTeam=-1; combatants.length=0; })()`,ctxI);
const d=sim(ctxI,[1],2400);
console.log(`  已占点夺回 (own=0→日军): 翻转时刻 t=${d.flip<0?'未翻转':f2(d.flip)+'s'}  ${d.trace.join('  ')}`);
ok(d.flip>7&&d.flip<16&&g(ctxI,'SPOTS')[0].own===1, `非中立点占领速率回落 (×1 ⇒ 9.52s): 实得 ${f2(d.flip)}s`);
// ④ 泼伤害: 同半径可毁件全灭 + 工事本体存活
console.log('\n④ 泼伤害 (damageStructures 半径 25m / 量 1e6) —— 阴性对照 + 工事本体存活');
// 沙箱桩补丁 (不改任何游戏逻辑, 只补 verify-boot 的桩缺口; 两条都在"表现层", 与结构销毁判定无关):
//   ① InstancedMesh 桩不初始化 instanceMatrix, 而 damageStructures → explosionFlora → vanishFlora →
//      queueSink(08-effects:366) 要读它 ⇒ 补 queueSink 为空实现 (植被碎块的 TTL 沉入调度, 不参与本验收);
//   ② AudioContext 桩的 AudioParam 只有 setValueAtTime, 没有 exponentialRampToValueAt, 而
//      destroyStructure → AudioSys.explosion(01-audio:151) 要用它 ⇒ 补 AudioSys.explosion 为空实现。
vm.runInContext('if(typeof queueSink==="function") queueSink=function(){}; if(typeof AudioSys!=="undefined") AudioSys.explosion=function(){};',ctxI);
const R=g(ctxI,'BUILD_REG').find(b=>b.type==='strongpoint');
const before=g(ctxI,'DESTRUCTIBLES').filter(gr=>!gr.dead&&Math.hypot(gr.cx-R.x,gr.cz-R.z)<28).length;
vm.runInContext(`damageStructures({x:${R.x},y:${R.floor},z:${R.z}},25,1e6)`,ctxI);
const after=g(ctxI,'DESTRUCTIBLES').filter(gr=>!gr.dead&&Math.hypot(gr.cx-R.x,gr.cz-R.z)<28).length;
const own=g(ctxI,'BOXES').filter(b=>b.building&&b.building.type==='strongpoint');
const dead=own.filter(b=>b.dead).length, meshGone=own.filter(b=>!(b.mesh&&b.mesh.parent)).length;
const regStill=g(ctxI,'BUILD_REG').filter(b=>b.type==='strongpoint'&&b.indestr).length;
console.log(`  28m 内可毁结构组: ${before} → ${after}   工事本体碰撞盒 ${own.length} 个: dead=${dead} 视觉网格脱离世界=${meshGone}   BUILD_REG indestr 条目=${regStill}`);
ok(before>=2&&after===0, `阴性对照成立: 溅射半径内的可毁结构组全灭 (${before}→${after}) —— 说明这一炮真的打到东西了`);
ok(own.length>60&&dead===0&&meshGone===0, `工事本体完好: ${own.length} 个碰撞盒全活, 视觉网格仍在 world 下`);
ok(regStill===1, 'BUILD_REG 的 indestr 条目仍在');
// ④b 带 spawns 的三张图: SPOTS 运行态快照, 控制副本 vs 当前树 —— Lead 追加要求的硬判据
// (比"帧数不变"更直接: 长度 + 每项 own/cap/capTeam/capturable 全字段逐位一致)
console.log('\n④b 三张带 spawns 图的 SPOTS 快照对照 (控制副本 = 我改之前 / 当前树; startMatch 后 + 同 seed 占点 30s 后)');
const ctlHarnessB=ctlDir?loadHarness('dev/verify-boot.js','\nconst idx=process.argv[2]',ctlDir):null;
const snap=(ctx)=>JSON.stringify(g(ctx,'SPOTS').map(s=>({name:s.name,own:s.own,cap:+s.cap.toFixed(6),capTeam:s.capTeam,capturable:!!s.capturable})));
const run30=(B,idx)=>{
const ctx=B.boot(idx);
vm.runInContext(`(()=>{ const btn=document.getElementById('startBtn'); if(btn&&btn.onclick) btn.onclick(); })()`,ctx);
const t0=snap(ctx);
// 中立点优先 (steppe「车站」), 否则第 0 个点 (baituan/canyon 的己方固定出生点); 用 team 0 单方占 30s
vm.runInContext(`(()=>{ combatants.length=0; const k=(()=>{ const j=SPOTS.findIndex(s=>s.own===-1); return j<0?0:j; })();
const S=SPOTS[k]; combatants.push({alive:true,onVehicle:false,isPlayer:false,spectator:false,team:0,pos:{x:S.x,y:S.gy,z:S.z}});
for(let i=0;i<1800;i++) updateSpots(1/60); })()`,ctx);
return {t0,t1:snap(ctx),own:g(ctx,'SPOTS').map(s=>s.own)};
};
for(const [idx,label] of [[4,'baituan (demolition)'],[10,'canyon (convoy)'],[8,'steppe (clash)']]){
const live=run30(bootHarness,idx), ctl=ctlHarnessB?run30(ctlHarnessB,idx):null;
if(ctl){
console.log(`  ${label}`);
console.log(`    控制副本 开局: ${ctl.t0}`);
console.log(`    当前树   开局: ${live.t0}`);
console.log(`    控制副本 30s后: ${ctl.t1}`);
console.log(`    当前树   30s后: ${live.t1}`);
ok(ctl.t0===live.t0&&ctl.t1===live.t1, `${label}: SPOTS 快照逐位一致 (长度+own/cap/capTeam/capturable)`);
}
if(idx===8) ok(live.own.includes(0), 'steppe (遭遇战) 中立「车站」仍能翻转 (own→0) —— clash 行为不变');
else ok(live.own.every((o,k)=>o===JSON.parse(live.t0)[k].own)&&JSON.parse(live.t1).every(s=>s.cap===0), `${label}: 固定出生点归属不动、进度恒 0 —— 门限没放宽到它头上`);
}
// ⑤ SPOTS 的三个消费方 (小地图/大地图/部署界面) + 出生权语义 —— 只读验证, 不改 22-hud/23-deploy
console.log('\n⑤ SPOTS 消费方只读验证 (小地图 drawMinimap / 大地图 drawBigMap / 部署界面 buildSpawnList+drawDeployMap)');
const drawAll=(ctx)=>vm.runInContext(`(()=>{ const r={}; const f=(k,fn)=>{ try{ fn(); r[k]='ok'; }catch(e){ r[k]=String(e&&e.message||e); } };
f('minimap',()=>drawMinimap()); f('bigmap',()=>drawBigMap()); f('deployList',()=>{ player.team=0; buildSpawnList(); }); f('deployMap',()=>drawDeployMap()); return r; })()`,ctxI);
const spawnNames=(ctx,team)=>vm.runInContext(`(()=>{ player.team=${team}; const list=el('spawnList'); const n0=list.children.length; buildSpawnList();
return list.children.slice(n0).map(b=>b.textContent); })()`,ctx);
vm.runInContext('SPOTS[0].own=-1; combatants.length=0;',ctxI);
const d0=drawAll(ctxI);
ok(Object.values(d0).every(v=>v==='ok'), `中立态三条绘制路径全无异常: ${JSON.stringify(d0)}`);
const n0u=spawnNames(ctxI,0), n0j=spawnNames(ctxI,1);
console.log(`  未占领部署选项: 美军 ${n0u.length} 项 (含碉堡=${n0u.some(s=>s.includes('中障壁碉堡'))}) / 日军 ${n0j.length} 项 (含碉堡=${n0j.some(s=>s.includes('中障壁碉堡'))})`);
ok(g(ctxI,'spawnPtsOf(0)').length===0&&g(ctxI,'spawnPtsOf(1)').length===0, '未占领 (own=-1) 时双方 spawnPtsOf 都不含它 —— 不会变成出生点/推进目标/出发区');
ok(!n0u.some(s=>s.includes('中障壁碉堡'))&&!n0j.some(s=>s.includes('中障壁碉堡')), '未占领时部署界面不提供该点 (own=-1 被 buildSpawnList 的 own===player.team 挡掉)');
vm.runInContext('SPOTS[0].own=0;',ctxI);
const d1=drawAll(ctxI);
ok(Object.values(d1).every(v=>v==='ok'), `占领后重绘无异常: ${JSON.stringify(d1)}`);
const n1u=spawnNames(ctxI,0);
console.log(`  美军占领后部署选项: ${n1u.length} 项 —— ${n1u.join(' | ')}`);
ok(g(ctxI,'spawnPtsOf(0)').length===1&&n1u.some(s=>s.includes('中障壁碉堡')), '被占领后成为占领方出生权 (强点既有语义, 与 steppe「车站」同款; 有意设计, 见 00-config 注释)');
}catch(e){ fail++; console.log('  ✗ ③/④/⑤ 失败: '+(e&&e.stack||e)); }

console.log(`\n══ 结果: ${pass} 项通过 / ${fail} 项失败 ══`);
process.exit(fail?1:0);
