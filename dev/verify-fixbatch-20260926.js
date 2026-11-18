// ─────────────────────────────────────────────
// dev/verify-fixbatch-20260926.js —— 2026-09-26 修复批验收
// 用法: node dev/verify-fixbatch-20260926.js [--neg]
//   --neg = 阴性对照: 把本批的修复点在**装载前**按文本还原成旧写法, 同一批判据必须报红
//          (证明判据真的在测这些修复, 而不是"改前改后都绿"的空断言)
//
// 覆盖 (与 07-nav / 16-aircraft / 13-combat / 15-vehicles / 15d / 15e / 17-emplacements / 06-engineering /
//       03-terrain / 23b / 14-bots / 10-viewmodel / 15f / 05c / 00-config 的对应注释逐条对应):
//   ① 源码防回退断言   ② 沙箱行为断言 (真装 39 个 js, 用游戏自己的接口取证)
//
// 口径: 沙箱桩 = dev/_bootstub.js + dev/_bootpatch.js (缺能力=桩不足, 不报成被测代码失败)
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const LC=require('./_loadcache.js'); // 2026-11-19 效率批: 读盘 memo (10 boot 原先每次重读; 编译缓存见 scrOf)
const root=path.resolve(__dirname,'..');
const OK=[],BAD=[];
function assert(name,cond,detail){ (cond?OK:BAD).push(name); console.log(`  ${cond?'✓':'✗'} ${name}${detail?'  '+detail:''}`); }
function section(t){ console.log('\n══ '+t+' ══'); }
const SRC=f=>LC.src(root,f); // 2026-11-19 效率批
const has=(src,needle)=>src.indexOf(needle)>=0;

const NEG=process.argv.includes('--neg');
// 阴性对照: 把每处修复按文本还原成旧写法 (只还原**能还原**的那些 —— 结构性改动多的只保留正向断言)
const PATCHES=[
 {f:'js/07-nav.js', from:'gen+=2;', to:'gen++;'},
 {f:'js/07-nav.js', from:'settled<settleCap', to:'popped<settleCap'},
 {f:'js/07-nav.js', from:'const heapPos=new Int32Array(NN*2)', to:'const heapPos=new Int32Array(0)'}, // 索引式堆失效(容量 0 → 全走 NaN 分支? 见下)
 {f:'js/16-aircraft.js', from:'const PLANE_PILOT_WAIT_MAX=10;', to:'const PLANE_PILOT_WAIT_MAX=1e9;'},
 {f:'js/13-combat.js', from:'const nv=navalRayQuery(origin,dir,wallD,shooter);', to:'const nv=null;'},
 {f:'js/13-combat.js', from:'if(block&&block.dist<d-0.5) dmg*=0.25;\n}\ns.damage(dmg,attacker,false);', to:'}\ns.damage(dmg,attacker,false);'},
 {f:'js/15-vehicles.js', from:'const feedName=(driver&&!spec)?(t(this.name)+\' · \'+t(\'乘员×3\')):t(this.name);', to:'const feedName=t(this.name)+\' · \'+t(\'乘员×3\');'}, // 2026-11-19 判据跟码: 2026-11-17 批1 战报名走词典+观战豁免, 锚点同步 (语义不变: 摘条件=空车/观战也吹乘员×3 的坏状态)
 {f:'js/06-engineering.js', from:'if(occBlocked(x,z)){ if(owner.isPlayer) showScorePop(t2(\'此处无法架设\')); return false; }', to:''},
 {f:'js/15d-naval.js', from:'if(n.kind===\'amph\') topY=(typeof VEH_HIT_TOP===\'number\')?VEH_HIT_TOP:2.6;', to:'if(false&&n.kind===\'amph\') topY=2.6;'},
];
const PATCH_MAP={};
if(NEG) for(const p of PATCHES){ const s=PATCH_MAP[p.f]!==undefined?PATCH_MAP[p.f]:SRC(p.f);
	if(s.indexOf(p.from)<0) throw new Error('阴性对照锚点未找到: '+p.f+' :: '+p.from.slice(0,40));
	PATCH_MAP[p.f]=s.replace(p.from,p.to); }
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f));
const SCR={}; // 2026-11-19 效率批: 按 f memo 编译 (srcOf(f) 每进程恒定 ⇒ 键 f 安全)

// ══════════════════════════════════════════════════════════════════════════
// ① 源码防回退断言
// ══════════════════════════════════════════════════════════════════════════
section('① 源码防回退 (修好的写法在 / 旧写法不在)');
{
const nav=SRC('js/07-nav.js');
assert('nav: 访问代按 gen+=2 走 (不再 gen++)', has(nav,'gen+=2;')&&!has(nav,'\ngen++;'));
assert('nav: 预算按落定数计 (settled<settleCap)', has(nav,'settled<settleCap'));
assert('nav: 索引式堆 heapPos 就位 (2*NN 容量)', has(nav,'const heapPos=new Int32Array(NN*2)')&&!has(nav,'new Int32Array(NN*4)'));
assert('nav: 堆位表每调用清零', has(nav,'heapPos.fill(-1)'));
assert('nav: 出生死袋闸已导出', has(nav,'spawnSpotOk, spawnSpot,')&&has(nav,'function spawnSpotOk'));

const emp=SRC('js/17-emplacements.js');
assert('17: spawnLandingClear 过 deadPocket 闸', has(emp,'NAV.spawnSpotOk(x,z)'));
assert('17: fallback 走 NAV.spawnSpot 搬迁', has(emp,'NAV.spawnSpot(fb[0],fb[1],24)'));

const cfg=SRC('js/00-config.js');
assert('config: sf_diff 用 null 判读法 (0 不再被 ||1 吃掉)', has(cfg,"const _d=localStorage.getItem('sf_diff')")&&!has(cfg,"localStorage.getItem('sf_diff')||'1')||1"));
// 锚已随 2026-11-14 缩图批更新+语义不变: 南进攻营 640→360 缩值 (−147.4,−67.5) 距南沟壁带净空 3.7m<14 → 北移 z=−57 (净空 14.2m, 同 2026-09-26 "避开沟壑带"规则)
assert('config: 南进攻营已搬到主塬 (缩图批 z:-57, 净空≥14m)', has(cfg,"{x:-147.4,z:-57,name:'南进攻营',team:0}"));

const air=SRC('js/16-aircraft.js');
// 2026-09-26D: 累加单位由「帧」改为「秒」——旧写法 `+=3` (注释里仍留着作对照) 是帧单位的硬编码,
// 60fps 下 4 帧就撞线; 且当时那行在 `respawnT<=0` 的闸**内** ⇒ 每 3s 才累加一次 (隐藏 ×3 倍率)。
// 现改为「战机死透期间每帧按 dt 累加」+ 到期把回退也清零 (10s 是硬上限)。判据去掉注释后查旧写法,
// 避免把注释里的历史写法误判成回退。
// ★2026-10-01 修: 去注释用 [^\n] 而非 .*$ —— 仓库脚本是 CRLF, `.` 跨不过 \r, $ 也不匹配 \r 之前的位置,
//   旧写法**整体失配** (注释原样留着) ⇒ "不得残留旧写法"这类阴性断言全部假红 (本条就是这么挂的)。
const airCode=air.split('\n').map(l=>l.replace(/\/\/[^\n]*/,'')).join('\n');
assert('16: 飞行员收回硬上限 PLANE_PILOT_WAIT_MAX (按秒累加)',
	has(air,'PLANE_PILOT_WAIT_MAX=10')&&has(air,'this.pilotWaitT+=dt;')&&
	has(air,'if(this.pilotWaitT>=PLANE_PILOT_WAIT_MAX) this.respawnT=Math.min(this.respawnT,0);')&&
	!has(airCode,'pilotWaitT+=3'));
assert('16: 生还飞行员走 enterVehicle (松炮位认领)', has(air,'pb.enterVehicle(this)'));

const cbt=SRC('js/13-combat.js');
assert('13: 艇体挡弹在步兵裁决之前 (navalRayQuery 收窄 wallD)', has(cbt,'navalRayQuery(origin,dir,wallD,shooter)'));
assert('13: 弹道终点不得越过艇体', has(cbt,'if(hitNaval&&navalD<endD) endD=navalD;'));
assert('13: splashDamage 掩体遮挡与 explodeAt 同式', has(cbt,'const block=raycastWorld(_exOrg.set(p.x,p.y+0.25,p.z),dir,d);')&&has(cbt,'if(block&&block.dist<d-0.5) dmg*=0.25;'));
assert('13: 海战命中分支已进裁决链', has(cbt,'} else if(hitNaval&&navalD<=Math.min(tankD,truckD,planeD)){')); // 7c 空对地平衡收口: 近距裁决面收 planeD (2026-09-30)

const veh=SRC('js/15-vehicles.js');
// ★2026-11-01 锚跟走: 命中柱构建 7c 批起抽成 vehHitCyl 单源, `y1:t.pos.y+VEH_HIT_TOP` 字面量变成
//   `o.y0=…/o.y1=t.pos.y+VEH_HIT_TOP` 赋值式 (坦克/两栖车同源语义不变) —— 锚随码走。
assert('15: VEH_HIT_TOP 具名常量 (坦克/两栖车同源)', has(veh,'const VEH_HIT_TOP=2.6;')&&has(veh,'t.pos.y+VEH_HIT_TOP'));
// ★2026-09-26H: 该判据由 `const feedName=driver?` 扩为 `const feedName=(driver&&!spec)?` —— 观战者座驾
//   与空车同规 (不吹"乘员×3", 因为 spec 分支不结算任何乘员)。判据仍然守"战报里的乘员数必须与结算口径一致"。
assert('15: 空车不再吹"乘员×3"', has(veh,'const feedName=')&&has(veh,'&&!spec)')&&!has(veh,"this.name+' · 乘员×3',team"));
assert('15: 铁丝网只置 alive=false (不再 splice)', has(veh,'w.alive=false;')&&!/^\s*wires\.splice\(wi,1\);/m.test(veh));

const nd=SRC('js/15d-naval.js');
assert('15d: 命中上限按族取 (两栖车=VEH_HIT_TOP / 艇=塔顶)', has(nd,'VEH_HIT_TOP')&&has(nd,'dims.turretY+n.dims.turretH'));
assert('15d: navalRayQuery 只读查询已抽出', has(nd,'function navalRayQuery'));

const ne=SRC('js/15e-navmodels.js');
assert('15e: 浮筒断面串按 z 方向归一 (sz<0 倒序)', has(ne,'if(sz<0) secs.reverse();'));
assert('15e: 螺旋桨凸盒逐面反向', has(ne,'V.push(c[f[0]],c[f[2]],c[f[1]], c[f[0]],c[f[3]],c[f[2]]);'));

const eng=SRC('js/06-engineering.js');
assert('06: deployMortar 有落点门 (occBlocked)', has(eng,"if(occBlocked(x,z)){ if(owner.isPlayer) showScorePop(t2('此处无法架设')); return false; }"));
assert('06: 回收不再把炮弹记到 slots[0]', !has(eng,'pl.slots.find(s=>s&&s.def.mortar)||pl.slots[0]'));
assert('06: isWire 跳过 !alive', has(eng,'if(!w.alive) continue;if(Math.hypot(w.x-x,w.z-z)<w.r)'));

const ter=SRC('js/03-terrain.js');
assert('03: buildOccupancy 跳过 dead 铁丝网', has(ter,'已被坦克碾平'));
assert('23b: 重开复位置回铁丝网 alive', has(SRC('js/23b-worldrestore.js'),'if(w&&!w.alive){ w.alive=true;'));
assert('14: Bot.spawn 复位 mortarPlaced', has(SRC('js/14-bots.js'),'this.mortarPlaced=false;   // 新的一命'));
assert('10: 哨兵态自愈 (手上没雷则回 idle)', has(SRC('js/10-viewmodel.js'),"if(!player.nadeHeld&&VM.stateDur>10)"));
assert('15f: 岸防炮开火无条件写 _src', has(SRC('js/15f-battery.js'),'if(shooter) shooter._src=b.name;'));
const lay=SRC('js/05c-layouts.js');
assert('05c: 岭上村按 id 分档 (own===1 死档已除)', has(lay,"}else if(f.id==='岭上村'){")&&!has(lay,'}else if(own===1){'));
// 新增中文提示必须在词典里 (verify-bugfix-20260925 的静态键闭环判据抓过本条: 06 的'此处无法架设'漏登记)
assert('i18n: 新增提示「此处无法架设」已入词典', has(SRC('js/00b-i18n.js'),"'此处无法架设'"));
}

// ══════════════════════════════════════════════════════════════════════════
// ② 沙箱行为断言
// ══════════════════════════════════════════════════════════════════════════
const HEAD=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js',
'js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js',
'js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js',
'js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/16-aircraft.js',
'js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js',
'js/22a-menuart.js','js/23-deploy.js','js/23b-worldrestore.js','js/24-main.js'];
const {sandbox,document,window}=require('./_bootstub.js');
require('./_bootpatch.js').patch(sandbox);
// 桩能力补齐 (缺能力=桩不足, 不许报成被测代码失败): THREE.Group.clear/removeAt 是 10-viewmodel.vmEquip 直接调的
for(const cls of ['Group','Object3D']){
	const C=sandbox.THREE&&sandbox.THREE[cls];
	if(C&&C.prototype&&!C.prototype.clear) C.prototype.clear=function(){ if(this.children) this.children.length=0; return this; };
}
function boot(campIdx,extraLocal,start){
	const ctx=vm.createContext(Object.assign({},sandbox));
	ctx.document=document; ctx.window=window; ctx.globalThis=ctx;
	ctx.location={search:'?seed=42',href:'http://localhost/index.html',hostname:'localhost',protocol:'http:'};
	ctx.localStorage={_s:Object.assign({sf_campaign:String(campIdx)},extraLocal||{}),getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
	ctx.console={log(){},warn(){},error(){}};
	const errs=[];
	for(const f of HEAD){ try{ (SCR[f]||(SCR[f]=new vm.Script(srcOf(f),{filename:f}))).runInContext(ctx); }catch(e){ errs.push(f+': '+String(e&&e.message||e)); } } // 2026-11-19 效率批: PATCH_MAP 文本模块载入期定死, 按文件名 memo 编译安全
	if(start!==false){
		try{ vm.runInContext('document.getElementById("startBtn").onclick();',ctx); }catch(e){ errs.push('startBtn: '+String(e&&e.message||e)); }
	}
	return {ctx,errs};
}
const N=(ctx,code,vars)=>{ if(vars) for(const k of Object.keys(vars)) ctx[k]=vars[k]; return vm.runInContext(code,ctx); };

section('②-a 沙箱装载 (塔拉瓦, 含全部海战载具)');
const B=boot(11);
assert(`39 文件零装载错误`, B.errs.length===0, B.errs.slice(0,3).join(' | '));

section('②-b 15e 绕向: 自定义几何符号体积必须为正 (阴性对照锚: 旧写法为负)');
{
const r=N(B.ctx,`(()=>{
const out=[];
for(const k of Object.keys(NAVAL_SPEC)){
let g; try{ g=(navBuildModel(NAVAL_SPEC[k])||{}).grp; }catch(e){ out.push({k,fatal:String(e&&e.message||e)}); continue; }
let parts=0,bad=0,worst='';
g.traverse(o=>{
const geo=o.geometry; if(!geo||!geo.attributes||!geo.attributes.position||geo.type) return;
const a=geo.attributes.position.array; if(!a||a.length<9||a.length%9) return;
parts++;
let vol=0;
for(let i=0;i<a.length;i+=9){
vol+=(a[i]*(a[i+4]*a[i+8]-a[i+5]*a[i+7]) - a[i+1]*(a[i+3]*a[i+8]-a[i+5]*a[i+6]) + a[i+2]*(a[i+3]*a[i+7]-a[i+4]*a[i+6]))/6;
}
if(vol<=0){ bad++; worst=(o.name||'?')+' vol='+vol.toFixed(4); }
});
out.push({k,parts,bad,worst});
}
return out; })()`);
let tot=0,totBad=0,msg=$=>$;
for(const x of r){ if(x.fatal){ totBad++; msg=x.k+' 构建失败'; continue; } tot+=x.parts; totBad+=x.bad; if(x.bad) msg=`${x.k}: ${x.worst}`; }
assert('全部海战模型自定义几何符号体积为正 (无内翻件)', totBad===0, totBad?msg:`${r.length} 型 / ${tot} 件自定义几何`);
}

section('②-c 15d 命中上限: 两栖车=坦克口径 / 艇=塔顶');
{
const r=N(B.ctx,`(()=>{
const out=[];
for(const k of Object.keys(NAVAL_SPEC)){
const S=NAVAL_SPEC[k];
const n={spec:S,kind:S.kind,yaw:0,pos:V3(0,0,0),dims:null};
try{ const M=navBuildModel(S); n.dims=M&&M.dims||null; }catch(e){}
const cap=navalCapsule(n);
out.push({k,kind:S.kind,top:+(cap.y1-cap.y0+ (S.kind==='amph'?0.05:0.15)).toFixed(3),
  old:+(S.hullH*1.05).toFixed(3), vehTop:(typeof VEH_HIT_TOP==='number'?VEH_HIT_TOP:null),
  turretTop:(n.dims&&n.dims.turretY!==undefined)?+(n.dims.turretY+n.dims.turretH).toFixed(3):null});
}
return out; })()`);
for(const x of r){
if(NEG&&x.k==='lvt'){ assert('阴性对照锚 (lvt): 两栖车命中上限仍=旧值 hullH*1.05', x.top<=x.old+0.001, `top=${x.top} old=${x.old}`); continue; }
if(x.kind==='amph') assert(`15d ${x.k}: 两栖车命中上限 = 坦克口径 ${x.vehTop}`, x.vehTop!==null&&x.top>=x.vehTop-0.001, `top=${x.top} (旧 ${x.old})`);
else assert(`15d ${x.k}: 艇命中上限 ≥ 塔顶 ${x.turretTop}`, x.turretTop!==null&&x.top>=x.turretTop-0.001, `top=${x.top} (旧 ${x.old}, 塔顶 ${x.turretTop})`);
}
}

section('②-d 07-nav 纯函数 + 无假失败 + 弹出==落定 (胡康河谷)');
{
const H=boot(7);
const r=N(H.ctx,`(()=>{
const D0=NAV.dbg;
const q=[[BASES[0].x,BASES[0].z,46,-6],[BASES[0].x,BASES[0].z,0,0],[BASES[1].x,BASES[1].z,0,0]]; // 2026-11-14 缩图批: 起点 (−285,0)→缩后基地 (−169.2,0) 读表; 终点 (46,−6) 属巨桥集群保持原坐标
let impure=0,falseNull=0,dupPop=0,maxPops=0,minPops=1e9,tot=0,n=0;
for(const qq of q){
const runs=[];
for(let k=0;k<4;k++){ const p=NAV.findPath(qq[0],qq[1],qq[2],qq[3]); runs.push(p?JSON.stringify(p):null);
 if(NAV.stats.lastNodes>maxPops) maxPops=NAV.stats.lastNodes; if(NAV.stats.lastNodes<minPops) minPops=NAV.stats.lastNodes;
 if(NAV.stats.lastNodes>NAV.stats.lastSettles+1) dupPop++;
 tot+=NAV.stats.lastNodes; n++;
}
for(let k=1;k<4;k++) if(runs[k]!==runs[0]) impure++;
if(runs[0]===null) falseNull++;
}
return {impure,falseNull,dupPop,maxPops,minPops,avg:Math.round(tot/Math.max(1,n)),hasDbg:!!D0};
})()`);
if(NEG){ assert('阴性对照锚 (nav): 旧写法下同入参 4 次必不同结果', r.impure>0||r.falseNull>0, `非纯 ${r.impure} 假失败 ${r.falseNull}`); }
else{
assert('nav: findPath 是纯函数 (3 查询 × 4 次同结果)', r.impure===0, `非纯 ${r.impure}`);
assert('nav: 无"同分量却 null"的假失败', r.falseNull===0, `假失败 ${r.falseNull}`);
assert('nav: 弹出数 == 落定数 (索引式堆无重复弹出)', r.dupPop===0, `超出的 ${r.dupPop} 次`);
assert('nav: 单次弹出数远低于 9 万硬上限', r.maxPops<30000, `平均 ${r.avg} 最大 ${r.maxPops} 最小 ${r.minPops}`);
}
}

section('②-e 出生死袋闸: 死袋点判 false / 主塬点判 true / 搬迁把点搬出去');
{
const r=N(B.ctx,`(()=>{
// 塔拉瓦图: 造一个"被道具围死"的位置直接判 —— 用封闭格 (occBlocked=true 的点)
const closed=[]; 
for(let x=-40;x<=40&&!closed.length;x+=5) for(let z=-40;z<=40;z+=5){ if(occBlocked(x,z)){ closed.push([x,z]); break; } }
const moved=NAV.spawnSpot(closed[0][0],closed[0][1],24);
const okAfter=NAV.spawnSpotOk(moved[0],moved[1]);
const d=Math.hypot(moved[0]-closed[0][0],moved[1]-closed[0][1]);
return {blockedAt:closed[0], ok:NAV.spawnSpotOk(closed[0][0],closed[0][1]), moved, okAfter, d:+d.toFixed(2)};
})()`);
assert('spawnSpotOk: 封锁格判 false', r.ok===false, JSON.stringify(r.blockedAt));
assert('spawnSpot: 把封锁格搬到"走得出去"的点', r.okAfter===true&&r.d>0, `搬到 (${r.moved[0].toFixed(1)},${r.moved[1].toFixed(1)}) 距 ${r.d}m`);
}

section('②-f 13-combat: 艇体挡弹 (艇后士兵不吃这一弹) + 阴性对照');
{
const C=boot(11);
const r=N(C.ctx,`(()=>{
// 造场景: 射手 (队0) → 艇 (队1) → 士兵 (队1) 三点一线, 打一枪。
// 修好的写法: 艇体在裁决前收窄弹道 ⇒ 士兵零掉血、艇掉血; 旧写法: 两个一起挨。
// 起点必须自选一片通视地面 (0,1.2,-40) 那种硬编码坐标可能落在碰撞体内部 (raycastWorld 返回负距离 ⇒ 整枪作废)。
const c=navalCraft[0];
let o=null;
for(let z=-160;z<=160&&!o;z+=6) for(let x=-60;x<=60;x+=6){
 if(occBlocked(x,z)) continue;
 const y=standHeight(x,z);
 let ok=true;
 for(let t=6;t<=44;t+=2){
  if(occBlocked(x,z+t)){ ok=false; break; }
  if(Math.abs(standHeight(x,z+t)-y)>1.2){ ok=false; break; }
 }
 if(ok) o={x,z,y:y+1.2};
}
if(!o) return {err:'找不到通视直线'};
c.alive=true; c.state='run'; c.playerDriven=false; c.crewBot=null; c.driverBot=null; c.flood=0;
c.team=1; c.hp=c.maxHp; c.yaw=0;
c.pos.set(o.x, standHeight(o.x,o.z+18), o.z+18);
const s=soldiers.find(x=>x&&!x.onVehicle)||soldiers[0];
s.alive=true; s.team=1; s.onVehicle=null; s.hp=100;
s.pos.set(o.x,0,o.z+36); s.pos.y=standHeight(o.x,o.z+36);
const shooter={team:0,isPlayer:false,alive:true,spectator:false,ffAll:false,name:'T',lastFiredT:0,
  pos:V3(o.x,o.y,o.z),curW:{def:{name:'x'}},damage(){},score:0,kills:0};
const hp0=c.hp, shp0=s.hp;
fireBullet(shooter, V3(o.x,o.y,o.z), V3(0,0,1), {dmg:60,headMul:2,snd:'rifle',tracer:0,vehDmg:20}, null);
return {boatDrop:+(hp0-c.hp).toFixed(2), soldierDrop:+(shp0-s.hp).toFixed(2),
  diag:(()=>{ const op=V3(o.x,o.y,o.z), d=V3(0,0,1);
    const wr=raycastWorld(op,d,400);
    const nq=(typeof navalRayQuery==='function')?navalRayQuery(op,d,400,shooter):null;
    const sr=raySoldiers(op,d,400,shooter);
    const cap=navalCapsule(c);
    return {origin:[o.x,o.z], wall:wr?+wr.dist.toFixed(2):null, boatQ:nq?+nq.t.toFixed(2):null,
            soldierT:sr?+sr.t.toFixed(2):null, cap:[+cap.y0.toFixed(2),+cap.y1.toFixed(2)], rayY:+o.y.toFixed(2)}; })()};
})()`);
if(NEG) assert('阴性对照锚 (combat): 旧写法下艇后士兵与艇一起挨弹', r.soldierDrop>0, `士兵掉血 ${r.soldierDrop} / 艇掉血 ${r.boatDrop} | 诊断 ${JSON.stringify(r.diag)}`);
else assert('艇体挡弹: 艇后士兵不吃这一弹 (艇自己掉血)', r.boatDrop>0&&r.soldierDrop===0, `士兵掉血 ${r.soldierDrop} / 艇掉血 ${r.boatDrop} | 诊断 ${JSON.stringify(r.diag)}`);
}

section('②-g 13-combat: splashDamage 掩体遮挡 (与 explodeAt 同式)');
{
const C=boot(0);
const r=N(C.ctx,`(()=>{
const s=soldiers.find(x=>x&&!x.onVehicle)||soldiers[0];
// 挑一面"够高够厚"的墙, 并且要求它至少有一侧的通视对照线本身是干净的 (否则"对照"也是隔墙, 判据没分辨力)
// BOXES 记录形态: {minX,minY,minZ,maxX,maxY,maxZ,gh} (03-terrain addBoxCollider)
let pick=null;
for(const b of BOXES){
if(!b||(b.maxY-b.minY)<1.4||(b.maxX-b.minX)<0.5) continue;
const cx=(b.minX+b.maxX)/2, cz=b.minZ+0.4, hw=(b.maxX-b.minX)/2, fy=b.minY;
for(const sgn of [1,-1]){
const blastX=cx+sgn*(hw+0.8), soldX=cx+sgn*(hw+3.0);
const dir=V3(soldX-blastX,0.45,0); const dd=dir.length(); dir.normalize();
const blk=raycastWorld(V3(blastX,fy+0.2,cz),dir,dd);
if(!blk){ pick={b,cx,cz,hw,fy,sgn}; break; }
}
if(pick) break;
}
if(!pick) return {err:'找不到"一侧通视"的墙'};
const {cx,cz,hw,fy,sgn}=pick;
const run=(blastX,soldX)=>{
s.alive=true; s.onVehicle=null; s.team=1; s.hp=100;
s.pos.set(soldX, fy, cz);
// dmgMax 取 30 (别打死): 击杀会走 Bot.die → ragdoll → CANNON (沙箱桩没有, 会把整段判据炸掉)
splashDamage(V3(blastX, fy+0.2, cz), null, -1, 9, 30, 0);
return +(100-s.hp).toFixed(1);
};
return { open:run(cx+sgn*(hw+0.8), cx+sgn*(hw+3.0)),      // 对照: 同侧, 通视
         blocked:run(cx-sgn*(hw+0.8), cx-sgn*(hw+3.0)),   // 隔墙: 爆点与士兵分居墙两侧
         wall:{x0:pick.b.minX,x1:pick.b.maxX,y0:pick.b.minY,y1:pick.b.maxY}, sgn };
})()`);
if(r.err) assert('splashDamage 掩体遮挡', false, r.err);
else assert('splashDamage: 隔墙伤害显著低于同侧开阔 (约 1/4)', r.blocked>0&&r.blocked<r.open*0.5,
	`隔墙 ${r.blocked} vs 同侧 ${r.open} (墙 x ${r.wall.x0.toFixed(1)}~${r.wall.x1.toFixed(1)}, y ${r.wall.y0.toFixed(1)}~${r.wall.y1.toFixed(1)}, 对照侧 sgn=${r.sgn})`);
}

section('②-h 16-aircraft: 生还飞行员必须能带机归队 (硬上限)');
{
const A=boot(11);
const r=N(A.ctx,`(()=>{
const pl=planes.find(p=>p.pilotBot);
if(!pl) return {err:'无战机/无 pilotBot'};
const pb=pl.pilotBot;
pl.alive=false; pl.hp=0; pl.respawnT=0.01; pl.crewBot=null; pl.playerDriven=false;
pb.alive=true; pb.onVehicle=null; pb.hp=100; pb.pos.set(pl.pos.x+40,standHeight(pl.pos.x+40,pl.pos.z+40),pl.pos.z+40);
let revived=-1;
for(let i=0;i<400;i++){                 // 40s 模拟 (dt=0.1): 硬上限 10s ⇒ 必须复活
try{ pl.update(0.1); }catch(e){ return {err:'update 抛错 '+e.message}; }
if(pl.alive&&revived<0) revived=i*0.1;
}
return {revived, crew:pbb(), alive:pl.alive};
function pbb(){ return pl.crewBot===pb; }
})()`);
if(r.err) assert('16-aircraft 飞行员归队', false, r.err);
else if(NEG) assert('阴性对照锚 (aircraft): 旧写法下生还飞行员让战机永不重生', r.revived<0, `revived=${r.revived}`);
else assert(`16-aircraft: 生还飞行员在 10s 硬上限内带机归队 (实测 ${r.revived}s)`, r.revived>=0&&r.revived<=11&&r.crew===true, `alive=${r.alive} crewBot=飞行员:${r.crew}`);
}

section("②-i 00-config: sf_diff='0' 必须读回 0");
{
const z=boot(0,{sf_diff:'0'},false);
const v=N(z.ctx,'SETTINGS.diff');
assert("难度 '0' 持久化往返 (读回 0, 不是被 ||1 吃成 1)", v===0, `SETTINGS.diff=${v}`);
}

section('②-j 06-engineering: 迫击炮落点门 + 回收不进错枪');
{
const E=boot(11);
const r=N(E.ctx,`(()=>{
const p=player;
p.alive=true; p.mortarPlaced=false; p.onVehicle=null; p.onMG=null; p.onAT=null; p.onAA=null; p.onMortar=null; p.mortUse=null;
// 封锁格 = 场景里某个 occBlocked 为真的点
let bad=null;
for(let x=-40;x<=40&&!bad;x+=4) for(let z=-40;z<=40;z+=4){ if(occBlocked(x,z)){ bad=[x,z]; break; } }
const nBefore=MORTARS.length;
const ok1=deployMortar(p,bad[0],bad[1],0);
const ok2=deployMortar(p, -60, -60, 0);
return {ok1, ok2, added:MORTARS.length-nBefore, blocked:bad, placed:p.mortarPlaced};
})()`);
assert('deployMortar: 封锁落点被拒 (返回 false)', r.ok1===false&&r.added<=1, `落点 ${JSON.stringify(r.blocked)}`);
assert('deployMortar: 开阔落点仍可架设', r.ok2===true&&r.added===1&&r.placed===true, `added=${r.added} mortarPlaced=${r.placed}`);
}

section('②-k 铁丝网: 碾平后条目留表但彻底失效 (isWire / 占位)');
{
const W=boot(11);
const r=N(W.ctx,`(()=>{
if(!wires.length) return {err:'本图无铁丝网'};
const w=wires[0];
const blocked0=!!NAV.blocked2D(w.x,w.z), hit0=!!isWire(w.x,w.z);
w.alive=false; if(w.grp) w.grp.visible=false;
NAV.refresh();
return {blocked0, hit0, blocked1:!!NAV.blocked2D(w.x,w.z), hit1:!!isWire(w.x,w.z), alive:w.alive, len:wires.length};
})()`);
if(r.err) assert('铁丝网 alive 语义', false, r.err);
else{
assert('铁丝网: 未碾时 isWire 命中 / 占位为真', r.hit0===true, `占位=${r.blocked0}`);
assert('铁丝网: 碾平后 isWire 不再命中', r.hit1===false, 'alive='+r.alive);
assert('铁丝网: 碾平后占位随之解除', r.blocked1===false, `占位 前=${r.blocked0} 后=${r.blocked1}`);
}
}

section('②-l 10-viewmodel: 手雷哨兵态自愈 (外部摘掉 nadeHeld 后不卡死)');
{
const V=boot(11);
const r=N(V.ctx,`(()=>{
if(typeof player==='undefined') return {err:'player 未定义'};
if(typeof updateViewModel!=='function') return {err:'updateViewModel 未定义'};
if(typeof performance==='undefined') performance={now:()=>0};
// 先把视模型装好 (vmEquip 才建 VM.ads 姿态表 —— 跳过它就等于不在游戏的真实调用环境里测)
const key=Object.keys(WPN_DEFS)[0];
vmEquip(key, 0);
player.curW={def:WPN_DEFS[key],mag:8,reserve:0};
player.ads=false; player.sprinting=false; player.crouch=false; player.prone=false; player.braced=false;
player.onGround=true; player.leanT=0; player.holdBreath=false; player.mouseDX=0; player.mouseDY=0;
if(!player.vel) player.vel=V3();
player.nadeHeld=false; VM.state='nade'; VM.stateT=0; VM.stateDur=999;   // 模拟"按住 G 时被上坦克摘掉 nadeHeld"
let st=null;
for(let i=0;i<30;i++){
try{ updateViewModel(0.05, player); }catch(e){ return {err:e.message, st:String(e&&e.stack||'').slice(0,160).split(String.fromCharCode(10)).slice(1,3).join(' | '), state:VM.state}; }
st=VM.state; if(VM.state==='idle') break;
}
return {state:VM.state, dur:VM.stateDur, frames:VM.stateT};
})()`);
if(r.err) assert('手雷哨兵态自愈', false, r.err+(r.st?' @ '+r.st:''));
else assert('持雷被外部打断后状态机回 idle (不再永久握雷)', r.state==='idle', `state=${r.state} stateDur=${r.dur}`);
}

section('②-m 莫斯科: 龙牙不得落进机枪堡足迹');
{
const M=boot(6);
const r=N(M.ctx,`(()=>{
// 两座堡的落位 (66.4,-25.3) 与 (66.4,32.1) —— 锚已随 2026-11-14 缩图批更新+语义不变 (旧 640 图: (118,∓45)/(118,57)):
// 统计足迹内属于"龙牙碰撞盒"(1.1×1.05×1.1 AABB) 的盒数
// BOXES 记录形态: {minX,minY,minZ,maxX,maxY,maxZ,gh} (03-terrain addBoxCollider)
const isTooth=b=>Math.abs((b.maxX-b.minX)-1.1)<0.02&&Math.abs((b.maxY-b.minY)-1.05)<0.02&&Math.abs((b.maxZ-b.minZ)-1.1)<0.02;
let hits=0, list=[], teeth=0;
for(const b of BOXES) if(isTooth(b)) teeth++;
for(const [bx,bz] of [[66.4,-25.3],[66.4,32.1]]){
for(const b of BOXES){
if(!isTooth(b)) continue;
const cx=(b.minX+b.maxX)/2, cz=(b.minZ+b.maxZ)/2;
if(Math.abs(cx-bx)<3.9&&Math.abs(cz-bz)<3.5){ hits++; list.push([String(cx.toFixed(1)),String(cz.toFixed(1))]); }
}
}
return {hits, teeth, list:hits?list.slice(0,4):[]};
})()`);
assert('莫斯科: 机枪堡足迹内无龙牙碰撞盒 (穿模已除)', r.hits===0, `全场龙牙 ${r.teeth} 颗`+(r.hits?`, 堡内 ${r.hits} 颗: ${JSON.stringify(r.list)}`:' / 两座堡各 7.6×6.8m 足迹'));
}

// ══════════════════════════════════════════════════════════════════════════
console.log(`\n${NEG?'【阴性对照】':'【正向】'} ✓ ${OK.length} / ✗ ${BAD.length}`);
const want=NEG?BAD.length>0:BAD.length===0;
if(NEG) console.log(want?'  阴性对照按预期报红 ⇒ 判据确实在测本批修复':'  ⚠ 阴性对照没报红: 判据没测到修复点');
process.exit(want?0:1);
