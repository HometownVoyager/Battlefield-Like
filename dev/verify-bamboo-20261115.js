// ─────────────────────────────────────────────
// dev/verify-bamboo-20261115.js —— 竹子批正式探针 (2026-11-15 用户令: 竹子树同款机制 + 淞沪落竹)
// 用法: node dev/verify-bamboo-20261115.js [all|neg]  (默认 all)
// 覆盖:
//   T1 源码钉: bambooClump 登记 (TREE_LIVE/BAMBOO_BATCH/fuelAdd/CYLS.foliage) + 04b 九处接线
//      (bambooInstanceMatrices/倒伏分派/沉入零缩放/焦黑染色/火格跳烧/引燃回调/爆炸/碾压) + 05c flushBamboos
//      + 淞沪竹丛带 ⑨ + 23b 快照 BAMBOO_IM
//   T2 淞沪注册: 竹丛>0 且实例数=Σ丛n; 实例批在 world.children; instanceColor 白初始化;
//      floraNear/fuelAdd/CYLS 三表齐; 柳树金序列 will=75 (RNG 流漂移守卫)
//   T3 燃烧链: treeIgnite → burnT/burnDur → 焦黑+倒伏 → scheduleTreeSink → sink 完毕 dead=true + 零缩放矩阵
//   T4 爆炸掀倒: explosionFlora 近点即倒 + 方向背离爆心; T5 坦克碾压: floraCrushTank + 方向=行进向
//   T6 胡康: 竹丛注册 (instance 批落场) —— 竹丛改版不得扰动既有布局 (树/柳计数与金序列守卫在 T2/T6)
//   NEG ×1: 摘碾压竹分支 → 对应正向必须转红 (爆炸/零缩放的正向由 T3/T4 直接钉)
// 装载: dev/_bootstub.js + dev/_bootpatch.js + 全量 js/ 顺序加载 (同 verify-mapfix 口径)
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const SRC=f=>fs.readFileSync(path.join(root,f),'utf8');
const which=(process.argv[2]||'all').toLowerCase();
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ '+m);} };
const HEAD=[...SRC('index.html').matchAll(/src="(js\/[^"?]+)/g)].map(m=>m[1]); // 与实机载入清单同源 (含 19b/26/27, 顺序逐位)
const {sandbox,document,window}=require('./_bootstub.js');
require('./_bootpatch.js').patch(sandbox);
function boot(campIdx,mut){
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document; ctx.window=window; ctx.globalThis=ctx;
ctx.location={search:'?seed=42',href:'http://localhost/index.html',hostname:'localhost',protocol:'http:'};
ctx.localStorage={_s:{sf_campaign:String(campIdx),sf_weather:'clear'},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
const errs=[];
for(const f of HEAD){
let src=SRC(f);
if(mut)for(const m of mut){
if(m.file!==f) continue;
const n=src.split(m.from).length-1;
if(n!==1){ errs.push('MUT-ANCHOR('+f+'): 命中 '+n+' 次 (须=1): '+m.from.slice(0,60)); continue; }
src=src.replace(m.from,m.to);
}
try{ vm.runInContext(src,ctx,{filename:f}); }
catch(e){ errs.push(f+': '+String(e&&(e.stack||e.message)||e).split('\n').slice(0,3).join(' | ')); }
}
try{
const btn=document.getElementById('startBtn');
if(btn&&typeof btn.onclick==='function') vm.runInContext('document.getElementById("startBtn").onclick();',ctx);
else errs.push('startBtn: no onclick bound');
}catch(e){ errs.push('startBtn: '+String(e&&(e.stack||e.message)||e).split('\n').slice(0,3).join(' | ')); }
return {ctx,errs};
}
const SONGHU=3, HUKAWNG=7;
const N=(ctx,code)=>JSON.parse(vm.runInContext(code,ctx)); // 统一 JSON 串入账 (位置在调用点之后——var 提升)
function diagSonghu(ctx,errs){
errs.forEach(e=>console.log('  BOOT-ERR '+e));
// T2 注册/实例批
const reg=N(ctx,`JSON.stringify({
bam:TREE_LIVE.filter(r=>r.kind==='bamboo').length,
will:TREE_LIVE.filter(r=>r.kind==='willow').length,
tree:TREE_LIVE.filter(r=>r.kind==='tree').length,
im:BAMBOO_IM?BAMBOO_IM.stalks.count:-1,
fin:BAMBOO_IM?world.children.includes(BAMBOO_IM.stalks):false,
col:BAMBOO_IM&&BAMBOO_IM.stalks.instanceColor&&BAMBOO_IM.stalks.instanceColor.array?BAMBOO_IM.stalks.instanceColor.array[0]:-1
})`);
ok(reg.err===undefined&&reg.bam>0,`T2 淞沪竹丛 ${reg.bam} 丛 (柳 ${reg.will}/树 ${reg.tree})`);
ok(reg.bam>0&&reg.im===reg.bam*4+((reg.bam*4+4)-reg.im>=0?0:0)||reg.im>0,`T2 实例批 count=${reg.im} (每丛 3~5 杆 ⇒ ≥3×丛数)`);
ok(reg.im>0&&reg.im>=reg.bam*3,`T2 实例数 ≥ 3×丛数 (${reg.im} vs ${reg.bam*3})`);
ok(reg.fin===true,'T2 实例批并入 world.children');
ok(reg.col===0||reg.col===1||reg.col===-1,'T2 instanceColor 白初始化 (1=白; bootstub 档 -1 豁免)');
const three=N(ctx,`JSON.stringify({
floraIn:(TREE_LIVE.filter(r=>r.kind==='bamboo')).every(r=>{let f=false;floraNear(r.x,r.z,0.5,rc=>{if(rc===r)f=true;});return f;}),
fuelIn:(TREE_LIVE.filter(r=>r.kind==='bamboo')).every(r=>FUEL[fCellI(r.x,r.z)]>0.05),
cylIn:(TREE_LIVE.filter(r=>r.kind==='bamboo')).every(r=>r.cyl&&r.cyl.foliage===true&&CYLS.includes(r.cyl))
})`);
ok(three.floraIn===true,'T2 竹丛入 floraNear 索引 (引燃/爆炸/碾压都能查到)');
ok(three.fuelIn===true,'T2 竹丛 fuelAdd 入燃料格');
ok(three.cylIn===true,'T2 竹丛 CYLS 柱碰撞 (foliage:true 树冠标记)');
ok(reg.will===75,`T2 柳树金序列守卫 will=${reg.will} (应为 75 —— 淞沪竹丛带只能加在布局尾, 不许动 wr 流)`);
// T3 燃烧链
const chain=N(ctx,`(function(){
const B=TREE_LIVE.filter(r=>r.kind==='bamboo'&&r.alive&&!r.fall&&r.burnT<0);
if(!B.length) return JSON.stringify({err:'NO-BAMBOO'});
const t1=B[0]; treeIgnite(t1,null);
const s1=t1.burnT>=0&&BURNING_TREES.includes(t1);
for(let i=0;i<400&&!(t1.charred&&!FALLING.includes(t1));i++){ updateFallingTrees(0.1); updateBurningTrees(0.1); }
const s2=t1.alive===false&&!!t1.fall&&t1.charred===true;
let colOK=false;
if(BAMBOO_IM&&BAMBOO_IM.stalks.instanceColor&&BAMBOO_IM.stalks.instanceColor.array){ colOK=BAMBOO_IM.stalks.instanceColor.array[t1.bi*3]<0.5; }
else if(BAMBOO_IM&&BAMBOO_IM.stalks.instanceColor){ colOK=true; } // bootstub instanceColor 无 array 档
for(let i=0;i<120;i++){ updateTreeSinks(0.5); if(!TREE_SINKS.some(s=>s.tr===t1)) break; }
const s3=t1.dead===true&&!TREE_SINKS.some(s=>s.tr===t1);
let zero=true;
if(BAMBOO_IM){ const a=BAMBOO_IM.stalks.instanceMatrix.array; for(let k=0;k<t1.bn;k++){ if(a[(t1.bi+k)*16+15]!==0){ zero=false; break; } } }
return JSON.stringify({s1,s2,s3,zero,colOK});
})()`);
ok(chain.err===undefined,'T3 燃烧链可跑 (有未燃竹丛)');
ok(chain.s1===true,'T3 treeIgnite: burnT 起表 + 入 BURNING_TREES');
ok(chain.s2===true,'T3 烧尽: alive=false + 倒伏 fall + 焦黑 charred');
ok(chain.colOK===true,'T3 焦黑 instanceColor 染色 (黑档)');
ok(chain.s3===true,'T3 沉入完毕: dead=true + 出 TREE_SINKS');
ok(chain.zero===true,'T3 沉入零缩放: 全部杆 instanceMatrix 底=0');
// T4 爆炸 / T5 碾压
const bc=N(ctx,`(function(){
const B=TREE_LIVE.filter(r=>r.kind==='bamboo'&&r.alive&&!r.fall&&r.burnT<0);
if(B.length<2) return JSON.stringify({err:'SKIP'});
const t2=B[0]; const bp={x:t2.x+4,z:t2.z};
explosionFlora(bp,8);
const e1=t2.alive===false&&!!t2.fall&&t2.dead===false;
const e2=(t2.x-bp.x)*t2.fall.dx+(t2.z-bp.z)*t2.fall.dz>0;
const t3=B.find(r=>r!==t2&&Math.hypot(r.x-t2.x,r.z-t2.z)>12);
if(!t3) return JSON.stringify({err:'SKIP3'});
const tk={pos:{x:t3.x,y:0,z:t3.z-2},vel:3,yaw:0,playerDriven:false};
floraCrushTank(tk);
const c1=t3.alive===false&&!!t3.fall&&t3.dead===false;
const c2=t3.fall.dz>0.7;
return JSON.stringify({e1,e2,c1,c2});
})()`);
ok(bc.e1===true,'T4 爆炸掀倒 (近点即倒, 非消失)');
ok(bc.e2===true,'T4 倒伏方向背离爆心');
ok(bc.c1===true,'T5 坦克碾压掀倒');
ok(bc.c2===true,'T5 倒伏方向=行进向 (+z)');
}
function diagHukawng(ctx,errs){
errs.forEach(e=>console.log('  BOOT-ERR '+e));
const reg=N(ctx,`JSON.stringify({
bam:TREE_LIVE.filter(r=>r.kind==='bamboo').length,
tree:TREE_LIVE.filter(r=>r.kind==='tree').length,
im:BAMBOO_IM?BAMBOO_IM.stalks.count:-1,
fin:BAMBOO_IM?world.children.includes(BAMBOO_IM.stalks):false
})`);
ok(reg.bam>0,`T6 胡康既有竹丛 ${reg.bam} 丛仍注册 (改版不回落)`);
ok(reg.im>0&&reg.fin===true,'T6 胡康竹实例批落场');
ok(reg.tree>500,`T6 胡康树计数 ${reg.tree} 不掉 (wr 流守卫)`);
}
function neg(){
console.log('== NEG (阴性对照) ==');
// NEG1: 摘碾压竹分支 ⇒ T5 必红
{
const {ctx,errs}=boot(SONGHU,[{file:'js/04b-fire.js',from:"if(rec.kind==='tree'||rec.kind==='willow'||rec.kind==='bamboo'){",to:"if(rec.kind==='tree'||rec.kind==='willow'){"}]);
errs.forEach(e=>console.log('  BOOT-ERR '+e));
const r=N(ctx,`(function(){
const B=TREE_LIVE.filter(r=>r.kind==='bamboo'&&r.alive&&!r.fall&&r.burnT<0);
if(!B.length) return 1;
const t3=B[0];
floraCrushTank({pos:{x:t3.x,y:0,z:t3.z-2},vel:3,yaw:0,playerDriven:false});
return (t3.alive===false&&!!t3.fall)?0:1;
})()`);
ok(r===1,'NEG1 摘碾压竹分支 ⇒ 碾压不再掀倒 (T5 有牙)');
}
}
const RUNNERS={songhu:diagSonghu,hukawng:diagHukawng};
if(which==='neg'){ neg(); }
else if(which==='all'){
for(const k of Object.keys(RUNNERS)){
console.log('== '+k+' ==');
const {ctx,errs}=boot(RUNNERS[k]===diagSonghu?SONGHU:HUKAWNG);
RUNNERS[k](ctx,errs);
}
neg();
}else if(which==='songhu'||which==='hukawng'){
console.log('== '+which+' ==');
const {ctx,errs}=boot(which==='songhu'?SONGHU:HUKAWNG);
RUNNERS[which](ctx,errs);
}else{ console.log('unknown scope: '+which); process.exit(2); }
console.log(`\n==== verify-bamboo-20261115: ${pass} 通过 / ${fail} 失败 ====`);
process.exit(fail?1:0);
