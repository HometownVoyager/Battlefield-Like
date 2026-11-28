// ─────────────────────────────────────────────
// dev/verify-20261118a.js —— 油桶殉爆批 (2026-11-18 用户令):
//   T1 油桶子弹记账 (fireBullet 单弹道口 wr.cyl 引用: 步枪/机枪 24/发 ~5 发殉爆, 反坦克枪 70/发 2 发;
//      非爆炸圆柱=树干不记账)
//   T2 爆炸记账 (damageStructures ③ 直调 barrelBlast → barrelDamage ×blastMul: 现有爆炸源圈内一击
//      殉爆与旧口径一致; 小爆 chip 不再"圈内即爆"; 邻桶连锁半径不变)
//   T3 火烧三路记账 (04b updateFires 受热账 0.4s tick: 持续火源圈 / 燃烧草格 fCellI+igniteCell /
//      燃烧弹云 SMOKES.incin —— 旧口径火烧对桶毫无反应)
//   T4 殉爆留下火焰 (barrelBlast 补 addFireSource 余火池 r2.3/ttl360/dps16 + attacker 归属 +
//      余火烤毙 2.5m 邻桶 = 级联火)
//   T5 投射物弹性削减 (用户令"有限减少一些手雷等投射物的弹性": 落地 0.38→0.24/切向 0.68→0.60,
//      盒顶 0.4→0.26·切向 0.7→0.62, 盒侧 0.5→0.34; 触发判据/弹跳音效/预瞄弧共用积分器全链不动)
//   T6 版本戳 20261128e (index.html 全量唯一 + __sfStyleVer + _game_files 45 行 + 旧 20261117b 清零)
//   T7 弹坑生命周期 (用户裁定"开局遗迹坑也限时消失, 寿命≤人造坑几倍": CRATER fresh150/scar450=3×/fade45;
//      CRATER_LIFE 双账并行 — runtimeCraters 三处既有消费点零改动; 24-main updateCraters(dt) 驱动, dt<=0 时停冻结;
//      23b cratersResetLife 快照回场清零; 账条靠 m.parent 探活自愈, 36 上限/性能清账挤掉不尸留)
//   T8 弹坑支撑面跟随 (用户实报全局性"地板略高于地面⇒甜甜圈坑"+处方"地板视作地面": 逐顶点盒顶支撑 craterBoxTop
//      + 铺装层感知 craterFloorTop 骑面层顶+0.02 / 裸结构盒顶+0.05 对照; 台阶门弃坑防尖刺)
//   T9 油桶残骸 (用户令"殉爆后就地留残骸, 模型要读得出油桶残骸": barrelWreck 压瘪焦黑桶身+翻口沿+滚箍残片×2
//      +焦土贴花 supY=桶底; 纯视觉不入 CYLS/BOXES, 不进快照=世界还原摘除)
//   T10 火池二令 (用户令"油桶爆炸的火持续6分钟且不受天气等影响": poolTtl 14→360 + noWx 整链 — 灼烧伤害/
//      燃烧时长/植被格暴雨浇灭·受潮减速·蔓延压火全豁免视同晴档, 蔓延继承; 树冠火保持全局天气博弈)
// 用法: node dev/verify-20261118a.js [--neg]
//   --neg = 阴性对照: 单行锚还原旧写法, 行为/源码判据必须报红 (5 补丁, 单跑逐个应用, 对认按红名):
//     N1 摘 fireBullet 子弹记账 → T1 红 (子弹打桶永远不掉血)
//     N2 ③ 回旧直调 barrelBlast → T2 chip 红 (amt=10 的小爆也当场引爆 = 旧"圈内即爆")
//     N3 摘受热账记账行 → T3 红 (火烤桶毫无反应)
//     N4 落地反弹还原 0.38 → T5 红 (源码钉+行为钉)
//     N5 摘殉爆留火池 → T1/T4 红 (殉爆后无火焰)
//     N6 deaden updateCraters → T7 红 (弹坑永不老/永不消失)
//     N7 摘逐顶点支撑面骑升 → T8 红 (坑沉回地形弦面 = 桥面甜甜圈复发)
//     N8 摘残骸接线 → T9 红 (殉爆后无残骸/无焦土)
//     N9 火池寿命回 14s → T10/T1e 红 (6 分钟令失效)
//     N10 摘 addFireSource noWx 落账 → T10 红 (灼烧/植被链重新吃天气)
// ★沙箱注: _bootstub 的 sandbox.globalThis=sandbox 遮蔽真 globalThis ⇒ 注入一律裸名赋值;
//   跨 vm 取对象 === 不可靠 ⇒ 归属/引用比较一律写成上下文内单表达式;
//   运行期 barrel() 新增的 CYLS 不进 RGRID ⇒ 测弹道/爆炸记账前必须 buildSpatialIndex() (2026-11-17 批教训)。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const stub=require('./_bootstub.js');
require('./_bootpatch.js').patch(stub.sandbox);
{const P=Object.getPrototypeOf(stub.THREE.Group.prototype); if(!P.clear) P.clear=function(){ this.children.length=0; };}
const _ensureStyle=e=>{ if(e&&e.style&&!e.style.setProperty) e.style.setProperty=(k,v)=>{ e.style[k]=v; }; return e; };
{const doc=stub.document,og=doc.getElementById.bind(doc),oc=doc.createElement.bind(doc);
doc.getElementById=id=>_ensureStyle(og(id));
doc.createElement=t=>_ensureStyle(oc(t));}
const CANNON=(()=>{
const V3=stub.THREE.Vector3;
class Quat{constructor(){this.x=0;this.y=0;this.z=0;this.w=1;}set(){return this;}setFromEuler(){return this;}copy(){return this;}}
return {
Vec3:V3,Quaternion:Quat,
World:class{constructor(){this.gravity=new V3();this.broadphase=null;this.solver={iterations:0};this.bodies=[];}addBody(b){this.bodies.push(b);}removeBody(b){const i=this.bodies.indexOf(b);if(i>=0)this.bodies.splice(i,1);}add(b){this.addBody(b);}remove(b){this.removeBody(b);}addConstraint(){}removeConstraint(){}step(){}},
Body:class{constructor(o){Object.assign(this,o||{});this.shapes=[];this.position=new V3();this.velocity=new V3();this.angularVelocity=new V3();this.quaternion=new Quat();this.angularDamping=0;this.linearDamping=0;}addShape(s){this.shapes.push(s);}},
Box:class{},Sphere:class{},Material:class{},ContactMaterial:class{},NaiveBroadphase:class{},PointToPointConstraint:class{},
};})();

const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const FILES=[...html.matchAll(/src="(js\/[^"?]+)/g)].map(m=>m[1]);

// ── NEG 阴性对照: 五补丁 (正常跑不启用) ──
const NEG=process.argv.includes('--neg');
const SRC={},PATCH_MAP={};
const NEG_PATCHES=[
// N1 摘 fireBullet 子弹记账 → T1 红
['js/13-combat.js','if(wr.kind===\'cyl\'&&wr.cyl&&wr.cyl.explosive&&typeof barrelDamage===\'function\') barrelDamage(wr.cyl,def.atRifle?BARREL.atRifleHit:BARREL.bulletHit,shooter);',';'],
// N2 ③ 回旧直调 barrelBlast → T2 chip 红 (小爆即爆=旧口径)
['js/05-world.js','if(Math.sqrt(dx*dx+dy*dy+dz*dz)<R) barrelDamage(c,amt*BARREL.blastMul,attacker);','if(Math.sqrt(dx*dx+dy*dy+dz*dz)<R) barrelBlast(c,attacker);'],
// N3 摘受热账记账行 → T3 红
['js/04b-fire.js','if(dps>0) barrelDamage(c,dps*0.4,null);',';'],
// N4 落地反弹还原 → T5 红
['js/13-combat.js','st.vel.y*=-0.24;','st.vel.y*=-0.38;'],
// N5 摘殉爆留火池 → T1/T4 红
['js/05-world.js','if(typeof addFireSource===\'function\') addFireSource(c.x,c.z,p.y+0.3,BARREL.poolR,BARREL.poolTtl,BARREL.poolDps,attacker||null,null,true);',';'],
// N6 deaden updateCraters → T7 红 (弹坑永不老/永不消失)
['js/05b-props.js','function updateCraters(dt){','function updateCraters(dt){return;'],
// N7 摘逐顶点支撑面骑升 → T8 红 (坑沉回地形弦面)
['js/05b-props.js','if(bt>ySup){ ySup=bt; vr=ride; }',';'],
// N8 摘残骸接线 → T9 红 (殉爆后无残骸/无焦土)
['js/05-world.js','if(typeof barrelWreck===\'function\') barrelWreck(c.x,c.z,c.y0);',';'],
// N9 火池寿命回 14s → T10/T1e 红 (6 分钟令失效)
['js/00-config.js','poolTtl:360','poolTtl:14'],
// N10 摘 addFireSource noWx 落账 → T10 红 (灼烧/植被链重新吃天气)
['js/04b-fire.js','follow:follow||null,noWx:noWx?1:0};','follow:follow||null};'],
];
if(NEG) for(const [f,from,to] of NEG_PATCHES){
if(SRC[f]===undefined) SRC[f]=fs.readFileSync(path.join(root,f),'utf8');
if(SRC[f].indexOf(from)<0){ console.log('✗ NEG 锚缺失: '+f+' :: '+from.slice(0,60)); process.exit(1); }
PATCH_MAP[f]=(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC[f]).split(from).join(to);
}
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:fs.readFileSync(path.join(root,f),'utf8'));

function boot(campIdx,extraLs){
for(const k in stub.byId)delete stub.byId[k];
const ctx=vm.createContext(Object.assign({},stub.sandbox));
ctx.document=stub.document; ctx.window=stub.window; ctx.CANNON=CANNON;
ctx.localStorage={_s:Object.assign({sf_campaign:String(campIdx)},extraLs||{}),getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of FILES) vm.runInContext(srcOf(f),ctx,{filename:f});
return ctx;
}
const PASS=[];let FAILN=0;
function ok(cond,label){
if(cond){ PASS.push(label); console.log('  ✔ '+label); }
else { FAILN++; console.log('  ✘ '+label); }
}
ok(html.includes("__sfStyleVer='20261128e'"),'前置: 版本戳 20261128e 在位 (index.html 内联)');

// ── 场地: 断崖公路 (开阔平地; 世界构建/部署链全通) ──
const IDX_C=(()=>{ const c0=boot(0); return vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="canyon")',c0); })();
const ctx=boot(IDX_C);
const G=s=>vm.runInContext(s,ctx);
let err0=null;
try{ G("document.getElementById('startBtn').onclick();"); }catch(e){ err0=String(e&&e.stack||e); }
if(!err0){ try{ G('if(!player.alive||!player.deployed) deployPlayer();'); }catch(e){ err0='deployPlayer: '+String(e&&e.stack||e); } }
if(err0||!G('player.alive')){ console.log('  ✘ 开局/部署失败 '+(err0||'player.alive=false')); process.exit(1); }
G('for(const s of soldiers) s.protUntil=0; player.protUntil=0;');

const HEAT_TICKS=19;   // 100 / (14×0.4) = 17.9 ⇒ ≤19 tick 必殉
const barrelDead='(CYLS[CYLS.length-1].dead===true||CYLS[CYLS.length-1].r===0)';
const barrelDeadN=n=>'(CYLS[CYLS.length-'+n+'].dead===true||CYLS[CYLS.length-'+n+'].r===0)';
const popLast2='(function(){const n=FIRE_SOURCES.length;FIRE_SOURCES.splice(Math.max(0,n-2),2);})()';
const popLast1='(function(){const n=FIRE_SOURCES.length;FIRE_SOURCES.splice(Math.max(0,n-1),1);})()';

// ── 摆桶帮手: 从锚点螺旋外扫找 propFree 空位, barrel() 落桶 (RGRID 重建) ──
function placeBarrel(ax,az){
const r0=G('CYLS.length');
for(let ring=0;ring<24;ring++){
const steps=Math.max(1,ring*4);
for(let k=0;k<steps;k++){
const ang=k*(Math.PI*2/steps)+(ring*0.7);
const d=3+ring*2.2;
const x=ax+Math.cos(ang)*d, z=az+Math.sin(ang)*d;
G('barrel('+x.toFixed(2)+','+z.toFixed(2)+')');
if(G('CYLS.length')>r0){
G('buildSpatialIndex()');
return {x:x,z:z};
}
}
}
return null;
}
// 走廊净空落桶 (T1 专用): placeBarrel 后从 +3m 水平瞄桶, 若射线命中别的圆柱 (布局树干/桶=起点在圆柱内
//   t 为负或 wr.cyl 非本桶) ⇒ killCyl 摘账+撤网格换下一候选 (2026-11-18 run-all 偶发 1/0/0 根因)
function placeBarrelClear(ax,az){
for(let ring=0;ring<24;ring++){
const steps=Math.max(1,ring*4);
for(let k=0;k<steps;k++){
const ang=k*(Math.PI*2/steps)+(ring*0.7);
const d=3+ring*2.2;
const x=ax+Math.cos(ang)*d, z=az+Math.sin(ang)*d;
const r0=G('CYLS.length');
G('barrel('+x.toFixed(2)+','+z.toFixed(2)+')');
if(G('CYLS.length')>r0){
G('buildSpatialIndex()');
const ym=Number(G('(CYLS[CYLS.length-1].y0+CYLS[CYLS.length-1].y1)/2')).toFixed(2);
const wr=G('(function(){const r=raycastWorld(V3('+(x+3).toFixed(2)+','+ym+','+z.toFixed(2)+'),V3(-1,0,0),8);return r?{ok:r.cyl===CYLS[CYLS.length-1]}:{ok:false};})()');
if(wr&&wr.ok) return {x:x,z:z};
G('(function(){const c=CYLS[CYLS.length-1];killCyl(c);if(c.mesh&&c.mesh.parent)world.remove(c.mesh);})()');
}
}
}
return null;
}
// 净空锚点: 离士兵 ≥14m (防溅射误伤/灼烧串账) + ±2m 高差 <0.5 (净空平地)
function clearAnchor(){
const px=G('player.pos.x'), pz=G('player.pos.z');
for(let ring=0;ring<40;ring++){
const d=25+ring*4, ang=ring*1.7;
const x=px+Math.cos(ang)*d, z=pz+Math.sin(ang)*d;
const nearSol=G('(function(){const x='+x.toFixed(1)+',z='+z.toFixed(1)+';for(const s of soldiers){if(s.alive&&Math.hypot(s.pos.x-x,s.pos.z-z)<14)return false;}return true;})()');
if(!nearSol) continue;
const flat=G('Math.abs(heightAt('+(x+2).toFixed(1)+','+z.toFixed(1)+')-heightAt('+(x-2).toFixed(1)+','+z.toFixed(1)+'))<0.5');
if(flat) return {x:x,z:z};
}
return {x:px+30,z:pz};
}

// ══ T1 油桶子弹记账 ══
console.log('T1 油桶子弹记账 (fireBullet wr.cyl 单弹道口)');
{
const a=clearAnchor();
const B=placeBarrelClear(a.x,a.z);
ok(!!B,'T1 前置: 测试桶落位 (走廊净空)');
if(B){
const x=B.x.toFixed(2), z=B.z.toFixed(2);
const ymid=Number(G('(CYLS[CYLS.length-1].y0+CYLS[CYLS.length-1].y1)/2')).toFixed(2);
// 弹道口引用: 水平射线命中桶侧, wr.cyl 必须携带桶账 (2026-11-18 新增结果槽字段)
// ★射线几何: rayCyl 是无穷水平圆柱判定 (a=dir.x²+dir.z²<1e-9 即竖直射线恒 null = 既有口径),
//   竖直下射永远打不中桶 ⇒ 测试一律水平侧射 (与真实平射弹道同族)
const wr=G('(function(){const r=raycastWorld(V3('+(B.x+3).toFixed(2)+','+ymid+','+z+'),V3(-1,0,0),8);return r?{kind:r.kind,isCyl:r.cyl===CYLS[CYLS.length-1],dist:+r.dist.toFixed(2)}:null;})()');
ok(wr&&wr.kind==='cyl'&&wr.isCyl,'T1a ★raycastWorld 结果槽带 cyl 引用 (kind=cyl, wr.cyl===桶账, t='+((wr&&wr.dist)||'-')+')');
// 步枪档: 24/发 ×5 殉爆 (hp 懒建 100)
const def=JSON.stringify({dmg:30,headMul:2,fallS:40,fallE:220,fallF:0.45,tracer:3,sid:'rifle'});
const before=G('FIRE_SOURCES.length');
for(let i=0;i<4;i++) G('fireBullet(player,V3('+(B.x+3).toFixed(2)+','+ymid+','+z+'),V3(-1,0,0),'+def+',null)');
const hp4=Number(G('CYLS[CYLS.length-1].hp'));
ok(Math.abs(hp4-4)<0.01,'T1b ★步枪弹 24/发记账 (4 发后 hp=4, 实测 '+hp4+')');
G('fireBullet(player,V3('+(B.x+3).toFixed(2)+','+ymid+','+z+'),V3(-1,0,0),'+def+',null)');
ok(G(barrelDead),'T1c ★第 5 发殉爆 (killCyl 摘账)');
ok(G('FIRE_SOURCES.length')===before+1,'T1d ★殉爆留下火焰 (FIRE_SOURCES +1)');
const pool=G('FIRE_SOURCES[FIRE_SOURCES.length-1]');
ok(pool&&Math.abs(pool.r-2.3)<0.01&&Math.abs(pool.ttl-360)<0.01&&Math.abs(pool.dps-16)<0.01,pool?('T1e ★余火池口径 r2.3/ttl360/dps16 (实测 r='+pool.r+' ttl='+pool.ttl+' dps='+pool.dps+')'):'T1e ★余火池口径 r2.3/ttl360/dps16 (无火池)');
ok(pool&&Math.abs(pool.x-B.x)<0.1&&Math.abs(pool.z-B.z)<0.1,'T1f ★余火池在桶位');
ok(G('(function(){const s=FIRE_SOURCES[FIRE_SOURCES.length-1];return !!s&&s.attacker===player;})()'),'T1g ★火池归属=击爆者 (attacker 透传, 空安全上下文内单式比较)');
G(popLast1);
// 反坦克枪档: 70/发 ×2
const B2=placeBarrelClear(a.x+18,a.z);
if(B2){
const x2=B2.x.toFixed(2), z2=B2.z.toFixed(2);
const ymid2=Number(G('(CYLS[CYLS.length-1].y0+CYLS[CYLS.length-1].y1)/2')).toFixed(2);
const atdef=JSON.stringify({dmg:80,atRifle:true,vehDmg:40,headMul:2,tracer:3,sid:'atRifle'});
G('fireBullet(player,V3('+(B2.x+3).toFixed(2)+','+ymid2+','+z2+'),V3(-1,0,0),'+atdef+',null)');
const hp1=Number(G('CYLS[CYLS.length-1].hp'));
G('fireBullet(player,V3('+(B2.x+3).toFixed(2)+','+ymid2+','+z2+'),V3(-1,0,0),'+atdef+',null)');
ok(Math.abs(hp1-30)<0.01&&G(barrelDead),'T1h ★反坦克枪 70/发 ×2 殉爆 (1 发后 hp=30, 实测 '+hp1+')');
G(popLast1);
}else ok(false,'T1h 前置: 反坦克枪桶落位失败');
// 非爆炸圆柱 (树干): wr.cyl 照样携带, 但不记账 (explosive 门, hp 从未建档)
const tr=G('(function(){for(const c of CYLS){if(!c.explosive&&!c.dead&&c.r>0.15&&c.r<0.6&&c.y1-c.y0>1.5){const ym=(c.y0+c.y1)/2;const r=raycastWorld(V3(c.x+2.5,ym,c.z),V3(-1,0,0),4);if(r&&r.kind==="cyl"&&r.cyl===c)return {x:c.x,z:c.z};}}return null;})()');
if(tr){
const tx=tr.x.toFixed(2), tz=tr.z.toFixed(2);
const tym=Number(G('(function(){for(const c of CYLS){if(!c.explosive&&!c.dead&&Math.hypot(c.x-'+tx+',c.z-'+tz+')<0.5)return (c.y0+c.y1)/2;}return 0;})()')).toFixed(2);
G('fireBullet(player,V3('+(tr.x+2.5).toFixed(2)+','+tym+','+tz+'),V3(-1,0,0),{dmg:30,headMul:2,tracer:3},null)');
const noAcc=G('(function(){for(const c of CYLS){if(!c.explosive&&!c.dead&&Math.hypot(c.x-'+tx+',c.z-'+tz+')<0.5)return c.hp===undefined;}return false;})()');
ok(noAcc,'T1i ★树干圆柱不记账 (explosive 门, hp 从未建档)');
}else ok(true,'T1i 树干样本缺 (canyon 无合格圆柱) — 跳过');
}
}

// ══ T2 爆炸记账 ══
console.log('T2 爆炸记账 (damageStructures ③ ×blastMul)');
{
const a=clearAnchor();
const B=placeBarrel(a.x,a.z);
ok(!!B,'T2 前置: chip 测试桶落位');
if(B){
const x=B.x.toFixed(2), z=B.z.toFixed(2);
// chip: 小爆 amt=10 ×3=30 <100 ⇒ 桶活 (旧"圈内即爆"口径当场引爆 = NEG N2 行为判据)
G('damageStructures(V3('+x+',CYLS[CYLS.length-1].y0+0.55,'+z+'),4.5,10,null)');
const alive=G('!'+barrelDead);
const hp=Number(G('CYLS[CYLS.length-1].hp'));
ok(alive&&Math.abs(hp-70)<0.01,'T2a ★小爆 chip: amt10 ×3=30 <hp100 ⇒ 桶活 hp=70 (实测 '+hp+')');
// 手雷档 amt=45 ×3=135 ⇒ 一击殉爆 (与旧"圈内即爆"一致)
G('damageStructures(V3('+x+',CYLS[CYLS.length-1].y0+0.55,'+z+'),4.5,45,null)');
ok(G(barrelDead),'T2b ★手雷档 45×3=135 一击殉爆 (旧口径圈内即爆逐位一致)');
G(popLast1);
}
// 连锁: 两桶 2.5m 相邻, 爆 A ⇒ B 同帧殉爆 (连锁半径不变)
const B3=placeBarrel(a.x,a.z+24), B4=placeBarrel(a.x+2.5,a.z+24);
ok(!!B3&&!!B4,'T2c 前置: 连锁双桶落位');
if(B3&&B4){
const before=G('FIRE_SOURCES.length');
G('damageStructures(V3('+B3.x.toFixed(2)+',(CYLS[CYLS.length-2].y0+0.55),'+B3.z.toFixed(2)+'),4.5,45,null)');
ok(G(barrelDeadN(2))&&G(barrelDeadN(1))&&G('FIRE_SOURCES.length')>=before+2,'T2c ★邻桶连锁 2.5m (双殉爆+双火池, 半径不变)');
G(popLast2);
}
// 源码钉: ③ 走 barrelDamage×blastMul (旧直调绝迹)
const w5=fs.readFileSync(path.join(root,'js/05-world.js'),'utf8');
ok(w5.includes('barrelDamage(c,amt*BARREL.blastMul,attacker)')&&!w5.includes('if(Math.sqrt(dx*dx+dy*dy+dz*dz)<R) barrelBlast(c,attacker);'),'T2d ★③ 记账单源钉 (旧圈内直调绝迹)');
}

// ══ T3 火烧三路 ══
console.log('T3 火烧三路 (04b updateFires 受热账)');
{
const a=clearAnchor();
// 路1: 持续火源圈 (残骸火/车火/余火池同族)
const B=placeBarrel(a.x,a.z);
ok(!!B,'T3 前置: 火源圈测试桶落位');
if(B){
const x=B.x.toFixed(2), z=B.z.toFixed(2);
const before=G('FIRE_SOURCES.length');
G('addFireSource('+(B.x+1.2).toFixed(2)+','+z+',heightAt('+x+','+z+')+0.6,1.5,60,0,null)');
let popped=-1;
for(let i=0;i<HEAT_TICKS;i++){ G('updateFires(0.4)'); if(G(barrelDead)){ popped=i+1; break; } }
ok(popped>0&&popped<=HEAT_TICKS&&G('FIRE_SOURCES.length')>=before+2,'T3a ★火源圈烤毙 (~7.2s, 第 '+popped+' tick, 测试源+余火池双账)');
G(popLast2);
}
// 路2: 燃烧草格 (fuelAdd + igniteCell 桶底格, fCellI 单源取格)
const B2=placeBarrel(a.x,a.z+26);
ok(!!B2,'T3b 前置: 燃烧格测试桶落位');
if(B2){
const x=B2.x.toFixed(2), z=B2.z.toFixed(2);
G('fuelAdd('+x+','+z+',1.0); igniteCell(fCellI('+x+','+z+'),null,0)');
let popped=-1;
for(let i=0;i<HEAT_TICKS+4;i++){ G('updateFires(0.4)'); if(G(barrelDead)){ popped=i+1; break; } }
ok(popped>0,'T3b ★燃烧草格烤毙 (cellFireDps 12, 第 '+popped+' tick)');
// 灭测试火 (桶底 5×5 格清账 + 烧尽格出 FIRE_ACTIVE + 摘余火池)
G('(function(){const ci0=fCellI('+x+','+z+');const cxi=ci0%FN,czi=(ci0/FN)|0;for(let dj=-2;dj<=2;dj++)for(let di=-2;di<=2;di++){const ni=cxi+di,nj=czi+dj;if(ni<0||nj<0||ni>=FN||nj>=FN)continue;const ci=nj*FN+ni;FBURN[ci]=0;FUEL[ci]=0;FHEAT[ci]=0;FEXPIRE[ci]=0;}for(let i=FIRE_ACTIVE.length-1;i>=0;i--)if(FBURN[FIRE_ACTIVE[i]]<=0){FIRE_ACTIVE[i]=FIRE_ACTIVE[FIRE_ACTIVE.length-1];FIRE_ACTIVE.pop();}})()');
G(popLast1);
}
// 路3: 燃烧弹云 (SMOKES.incin, 云不落 FUEL 格裸地也能烤)
const B3=placeBarrel(a.x,a.z+26);
ok(!!B3,'T3c 前置: 燃烧云测试桶落位');
if(B3){
const x=B3.x.toFixed(2), z=B3.z.toFixed(2);
G('SMOKES.push({x:'+x+',y:heightAt('+x+','+z+')+1,z:'+z+',t:0,dur:9,r:5.5,incin:true,sprites:[],dmgT:0,team:-1,thrower:null,seed:0})');
let popped=-1;
for(let i=0;i<HEAT_TICKS;i++){ G('updateFires(0.4)'); if(G(barrelDead)){ popped=i+1; break; } }
ok(popped>0&&popped<=HEAT_TICKS,'T3c ★燃烧弹云烤毙 (~7.5s < 云寿 9s, 第 '+popped+' tick)');
G('SMOKES.pop()');
G(popLast1);
}
// 源码钉: 受热账三路在位 + 无火早退门
const s4b=fs.readFileSync(path.join(root,'js/04b-fire.js'),'utf8');
ok(s4b.includes('dps+=BARREL.fireDps')&&s4b.includes('dps+=BARREL.cellFireDps')&&s4b.includes('barrelDamage(c,dps*0.4,null)')&&s4b.includes('FIRE_SOURCES.length>0||FIRE_ACTIVE.length>0||_smIn>0'),'T3d ★受热账三路源码钉 (火源圈/燃烧格/燃烧弹云 + 无火早退门)');
}

// ══ T4 余火烤毙邻桶 (级联火) ══
console.log('T4 殉爆余火池烤毙邻桶');
{
const a=clearAnchor();
const B5=placeBarrel(a.x,a.z);
ok(!!B5,'T4 前置: 主桶落位');
if(B5){
// 邻桶精确落位 2.5m (placeBarrel 螺旋起点 d=3 会落出火池受热圈 r2.3+0.6 ⇒ 逐点精确试)
let B6=null;
for(const [ox,oz] of [[2.5,0],[0,2.5],[-2.5,0],[0,-2.5],[1.77,1.77]]){
const r0=G('CYLS.length');
G('barrel('+(B5.x+ox).toFixed(2)+','+(B5.z+oz).toFixed(2)+')');
if(G('CYLS.length')>r0){ B6={x:B5.x+ox,z:B5.z+oz}; G('buildSpatialIndex()'); break; }
}
ok(!!B6,'T4 前置: 邻桶精确落位 2.5m');
if(B6){
G('barrelDamage(CYLS[CYLS.length-2],500,player)');   // 直接殉爆 B5 (hp 懒建 100-500<0)
ok(G(barrelDeadN(2))&&G('(function(){const s=FIRE_SOURCES[FIRE_SOURCES.length-1];return !!s&&s.attacker===player;})()'),'T4a ★barrelDamage 直殉+火池归属 player (空安全上下文内单式比较)');
let popped=-1;
for(let i=0;i<HEAT_TICKS;i++){ G('updateFires(0.4)'); if(G(barrelDeadN(1))){ popped=i+1; break; } }
ok(popped>0,'T4b ★★余火烤毙 2.5m 邻桶 (殉爆后留下火焰继续烧, 第 '+popped+' tick)');
G(popLast2);
}
}
}

// ══ T5 投射物弹性削减 ══
console.log('T5 投射物弹性削减 (落地/盒面反弹系数)');
{
const combat=fs.readFileSync(path.join(root,'js/13-combat.js'),'utf8');
ok(combat.includes('st.vel.y*=-0.24;')&&combat.includes('st.vel.x*=0.60; st.vel.z*=0.60;'),'T5a ★落地反弹 0.24/切向 0.60 (旧 0.38/0.68 绝迹)');
ok(!combat.includes('st.vel.y*=-0.38')&&!combat.includes('st.vel.x*=0.68;'),'T5b ★旧落地系数绝迹');
ok(combat.includes('C.st.vel.y*=-0.26; C.st.vel.x*=0.62; C.st.vel.z*=0.62;'),'T5c ★盒顶反弹 0.26/切向 0.62 (旧 0.4/0.7 绝迹)');
ok(combat.includes('C.st.vel.x*=-0.34;')&&combat.includes('C.st.vel.z*=-0.34;'),'T5d ★盒侧反弹 0.34 (旧 0.5 绝迹)');
ok(combat.includes('★2026-11-18 弹性削减批'),'T5e 批注在位');
// 行为钉: 未武装弹贴地首步触地 vy=-1 ⇒ +0.279 (×0.24), 切向 5 ⇒ 3.0 (×0.60); 单子步 (spd≈5.1 <0.24/步界)
const a=clearAnchor();
const bx=a.x.toFixed(2), bz=a.z.toFixed(2);
const res=G('(function(){const gh=heightAt('+bx+','+bz+');const st={pos:new THREE.Vector3('+bx+',gh+0.06,'+bz+'),vel:new THREE.Vector3(5,-1,0),fuse:9,armOnFuse:true,spin:new THREE.Vector3(1,0,0)};for(let i=0;i<8;i++){const ev=nadeStep(st,1/60);if(ev==="bounced")return {vy:st.vel.y,vx:st.vel.x,i:i+1};if(ev==="blow"||ev==="fizzle")return {bad:ev};}return null;})()');
ok(res&&!res.bad&&res.vy>0.24&&res.vy<0.32&&Math.abs(res.vx-3.0)<0.05,'T5f ★落地首跳实测 vy +0.279 (0.24×-1.163) / vx 3.0 (0.60×5) (实测 vy='+res.vy.toFixed(3)+' vx='+res.vx.toFixed(3)+', 第 '+res.i+' 步; 旧 0.38 档=+0.442 出窗)');
ok(combat.split('nadeStep(').length>=3,'T5g nadeStep 单源在位 (真弹+预演共用 ⇒ 削减自动同步预览, nade-trigger F1n 同款)');
}

// ══ T7 弹坑生命周期 ══
console.log('T7 弹坑生命周期 (CRATER 账: 战斗坑 150s 淡出 / 布局遗迹坑 450s / 还原清零)');
{
const cfg=fs.readFileSync(path.join(root,'js/00-config.js'),'utf8');
const p5b=fs.readFileSync(path.join(root,'js/05b-props.js'),'utf8');
const s24=fs.readFileSync(path.join(root,'js/24-main.js'),'utf8');
const s23b=fs.readFileSync(path.join(root,'js/23b-worldrestore.js'),'utf8');
ok(cfg.includes('const CRATER={freshTtl:150, scarTtl:450, fadeWin:45};'),'T7a ★CRATER 口径钉 (00-config: fresh 150 / scar 450=3× / fadeWin 45)');
ok(p5b.includes('const CRATER_LIFE=[]')&&p5b.includes('function updateCraters(dt)')&&p5b.includes('function cratersResetLife()'),'T7b ★生命周期账三件套 (05b CRATER_LIFE/updateCraters/cratersResetLife)');
ok(s24.includes('updateCraters(dt);'),'T7c ★24-main 每帧驱动 (updateFires 后)');
ok(s23b.includes('cratersResetLife()'),'T7d ★23b 世界还原钩 (快照回场=重新计时)');
// 清台 (T1-T4 殉爆焦土 + 开局布局遗迹坑): 摘网格 + 双账清零
G('(function(){for(let i=CRATER_LIFE.length-1;i>=0;i--){const m=CRATER_LIFE[i].m;if(m.parent)world.remove(m);}CRATER_LIFE.length=0;runtimeCraters.length=0;})()');
const a7=clearAnchor();
const ax7=a7.x.toFixed(2), az7=a7.z.toFixed(2);
// 战斗坑: 建坑→账目→dt=0 冻结→中年不淡→尾窗淡出→退场
G('crater('+ax7+','+az7+',1.5,true)');
ok(G('(CRATER_LIFE.length===1&&CRATER_LIFE[0].ttl===150&&runtimeCraters.length===1)'),'T7e ★战斗坑入账 (ttl=150, runtimeCraters 同步)');
G('updateCraters(0)');
ok(G('CRATER_LIFE[0].age===0'),'T7f ★dt<=0 冻结 (时停不老, 与火焰/投射物同口径)');
G('updateCraters(100)');
ok(G('(Math.abs(CRATER_LIFE[0].age-100)<0.01&&CRATER_LIFE[0].m.material.opacity===0.85)'),'T7g ★中年不淡出 (100s, opacity 仍 0.85)');
G('updateCraters(40)');
ok(G('Math.abs(CRATER_LIFE[0].m.material.opacity-0.85*10/45)<0.01'),'T7h ★尾窗淡出 (140s, 剩 10s<fadeWin 45 ⇒ 0.85×10/45)');
G('updateCraters(10.1)');
ok(G('(CRATER_LIFE.length===0&&runtimeCraters.length===0)'),'T7i ★150s 到点退场 (世界摘除+双账同步)');
// 布局遗迹坑 (静态): ttl=450=3×fresh, 不入 runtimeCraters, 300s 仍在场, 449s 淡出中, 450.1s 消失
const sp7=G('(function(){const px=player.pos.x,pz=player.pos.z;for(let ring=0;ring<30;ring++){const steps=Math.max(1,ring*4);for(let k=0;k<steps;k++){const ang=k*(Math.PI*2/steps)+(ring*0.7);const d=3+ring*2.2;const x=px+Math.cos(ang)*d,z=pz+Math.sin(ang)*d;if(propFree(x,z,2.0))return {x:+x.toFixed(2),z:+z.toFixed(2)};}}return null;})()');
ok(!!sp7,'T7j 前置: 遗迹坑净空落点 (propFree 螺旋)');
if(sp7){
G('crater('+sp7.x+','+sp7.z+',2.0)');
ok(G('(CRATER_LIFE.length===1&&CRATER_LIFE[0].ttl===450&&runtimeCraters.length===0)'),'T7k ★★布局遗迹坑限时 (ttl=450=3×fresh, 不入 runtimeCraters; 用户裁定: 开局坑会消失但寿命≤人造坑几倍)');
G('updateCraters(300)');
ok(G('(!!CRATER_LIFE[0].m.parent&&CRATER_LIFE[0].m.material.opacity===0.85)'),'T7l ★遗迹坑 300s 仍在场 (旧痕自然存续)');
G('updateCraters(149)');
ok(G('CRATER_LIFE[0].m.material.opacity<0.85'),'T7m ★遗迹坑 449s 尾窗淡出中');
G('updateCraters(1.1)');
ok(G('CRATER_LIFE.length===0'),'T7n ★遗迹坑 450s 自然消失 (=3×150, 不超人造坑几倍)');
}
// 还原钩: 战斗坑老化后 cratersResetLife → 年龄归零 + 不透明度回底 + 网格在场
G('crater('+ax7+','+az7+',1.5,true)');
G('updateCraters(140)');
G('cratersResetLife()');
ok(G('(Math.abs(CRATER_LIFE[0].age)<0.01&&CRATER_LIFE[0].m.material.opacity===0.85&&!!CRATER_LIFE[0].m.parent)'),'T7o ★世界还原钩: 回场坑寿命清零 (23b 快照=全新战场重新计时)');
G('(function(){for(let i=CRATER_LIFE.length-1;i>=0;i--){const m=CRATER_LIFE[i].m;if(m.parent)world.remove(m);}CRATER_LIFE.length=0;runtimeCraters.length=0;})()');
}

// ══ T8 弹坑支撑面跟随 ══
console.log('T8 弹坑支撑面跟随 (铺装层骑面顶+0.02 / 裸结构盒顶+0.05 对照; 地板视作地面)');
{
// T8 专用锚点: 士兵≥14m + ±2m 高差<0.5 + **2.6m 内无其他碰撞盒** (沙袋/拒马等矮盒顶会把坑盘个别顶点
//   拉去骑它们的顶 ⇒ 支撑面不唯一, T8b 偶发红; 2.6 > 坑盘 R2 上限 2.006)。A/B 双场景角度错开。
function t8Anchor(base,minD,ang0){
const px=G('player.pos.x'), pz=G('player.pos.z');
for(let ring=0;ring<60;ring++){
const d=minD+ring*4, ang=ang0+ring*1.9;
const x=px+Math.cos(ang)*d, z=pz+Math.sin(ang)*d;
if(base&&Math.hypot(x-base.x,z-base.z)<12) continue;
const nearSol=G('(function(){const x='+x.toFixed(1)+',z='+z.toFixed(1)+';for(const s of soldiers){if(s.alive&&Math.hypot(s.pos.x-x,s.pos.z-z)<14)return false;}return true;})()');
if(!nearSol) continue;
const flat=G('Math.abs(heightAt('+(x+2).toFixed(1)+','+z.toFixed(1)+')-heightAt('+(x-2).toFixed(1)+','+z.toFixed(1)+'))<0.5');
if(!flat) continue;
const boxFree=G('(function(){const x='+x.toFixed(1)+',z='+z.toFixed(1)+';for(const b of BOXES){if(b.dead)continue;if(x>b.minX-2.6&&x<b.maxX+2.6&&z>b.minZ-2.6&&z<b.maxZ+2.6)return false;}return true;})()');
if(!boxFree) continue;
return {x:x,z:z};
}
return null;
}
G('_tb=[]; tmpBox=(x,y,z,w,h,d)=>{const b=addBoxCollider(x,y,z,w,h,d); _tb.push(b); return b;};');
G('_tr=[]; clearTmp=()=>{while(_tb.length){const b=_tb.pop();if(b&&!b.dead)killBox(b);}while(_tr.length){const m=_tr.pop();if(m.parent)world.remove(m);}};');
// 场景 A: 结构盒+铺装层 (grandBridge 双层同构: 盒顶 gh+0.6, 铺装 render-only 顶 gh+0.67) ⇒ 坑骑面层顶+0.02
const A=t8Anchor(null,25,1.7);
ok(!!A,'T8 前置: 场景 A 净空锚点 (盒净空)');
if(A){
const cx=A.x.toFixed(2), cz=A.z.toFixed(2);
const ghA=Number(G('heightAt('+cx+','+cz+')')).toFixed(2);
G('tmpBox('+cx+','+(Number(ghA)+0.3).toFixed(2)+','+cz+',5,0.6,5)');
G('_tr.push(mesh(boxGeo(4.4,0.1,4.4),MAT.woodDark,'+cx+','+(Number(ghA)+0.62).toFixed(2)+','+cz+',0,false,true));   // render-only 铺装层 (grandBridge 同构)');
G('explosionFX(V3('+cx+','+(Number(ghA)+0.8).toFixed(2)+','+cz+'))');
const deck=G('(function(){const e=CRATER_LIFE[CRATER_LIFE.length-1];if(!e)return null;const a=e.m.geometry.attributes.position.array;let mn=1e9,mx=-1e9;for(let i=1;i<a.length;i+=3){if(a[i]<mn)mn=a[i];if(a[i]>mx)mx=a[i];}return {c:a[1],mn:mn,mx:mx};})()');

ok(!!deck,'T8 前置: 铺装层场景出坑');
if(deck){
ok(Math.abs(deck.c-(Number(ghA)+0.69))<0.02,'T8a ★★铺装层上坑心=面层顶+0.02 (盒顶 '+(Number(ghA)+0.6).toFixed(2)+'+0.09='+(Number(ghA)+0.69).toFixed(2)+', 实测 '+deck.c.toFixed(3)+'; 旧写法=沉进面层只露唇缘=厚甜甜圈)');
ok(deck.mn>Number(ghA)+0.62&&deck.mx<Number(ghA)+1.35,'T8b ★全顶点支撑窗 (≥盒顶+0.02 宽容差, ≤+唇缘 0.13r+容差; 混合桩个别顶点 ±0.07 抖动实测两例, 窗宽取"不沉底"即可; N7 沉底 ghA+0.05 仍远出窗; 实测 ['+deck.mn.toFixed(3)+','+deck.mx.toFixed(3)+'])');
}else ok(false,'T8a/b 前置失败');
}
G('clearTmp()');
// 场景 B: 裸结构盒 (无铺装层) ⇒ 与地形同规 +0.05 (=盒顶即渲染面)
const B=t8Anchor(A,25,2.3);
ok(!!B,'T8 前置: 场景 B 净空锚点');
if(B){
const cx2=B.x.toFixed(2), cz2=B.z.toFixed(2);
const ghB=Number(G('heightAt('+cx2+','+cz2+')')).toFixed(2);
G('tmpBox('+cx2+','+(Number(ghB)+0.3).toFixed(2)+','+cz2+',5,0.6,5)');
G('explosionFX(V3('+cx2+','+(Number(ghB)+0.8).toFixed(2)+','+cz2+'))');
const bare=G('(function(){const e=CRATER_LIFE[CRATER_LIFE.length-1];if(!e)return null;const a=e.m.geometry.attributes.position.array;return {c:a[1]};})()');
ok(!!bare&&Math.abs(bare.c-(Number(ghB)+0.65))<0.02,'T8c ★裸结构盒对照: 坑心=盒顶+0.05 ('+(Number(ghB)+0.65).toFixed(2)+', 实测 '+(bare?bare.c.toFixed(3):'-')+'; 盒顶即渲染面, 与地形同规)');
}
G('clearTmp()');
}

// ══ T9 油桶残骸 ══
console.log('T9 油桶残骸 (barrelWreck: 压瘪焦黑桶身+翻口沿+滚箍残片+焦土贴花; 纯视觉)');
{
const w5=fs.readFileSync(path.join(root,'js/05-world.js'),'utf8');
const p5b=fs.readFileSync(path.join(root,'js/05b-props.js'),'utf8');
ok(w5.includes('barrelWreck(c.x,c.z,c.y0)'),'T9a ★barrelBlast 残骸接线 (05-world 殉爆后留残骸)');
ok(p5b.includes('function barrelWreck(x,z,gy){')&&p5b.includes('crater(x,z,1.15,true,gy)'),'T9b ★barrelWreck 构造 + 焦土 supY=桶底 (05b)');
// 清残骸台 (T1-T4 爆过的桶已留残骸) + 焦土坑清台
G('(function(){for(let i=world.children.length-1;i>=0;i--){const o=world.children[i];if(o.isGroup&&o.children.some(function(c){return c.geometry===_BARREL_G.body&&c.scale.y<0.5;}))world.remove(o);}})()');
G('(function(){for(let i=CRATER_LIFE.length-1;i>=0;i--){const m=CRATER_LIFE[i].m;if(m.parent)world.remove(m);}CRATER_LIFE.length=0;runtimeCraters.length=0;})()');
const a9=clearAnchor();
const B9=placeBarrel(a9.x,a9.z);
ok(!!B9,'T9 前置: 残骸测试桶落位');
if(B9){
const bx0=G('BOXES.length');
G('barrelDamage(CYLS[CYLS.length-1],500,player)');
ok(G(barrelDead),'T9c 前置: 桶殉爆 (barrelDamage 直殉)');
const wc=G('(function(){let n=0;for(const o of world.children){if(o.isGroup&&o.children.some(function(c){return c.geometry===_BARREL_G.body&&c.scale.y<0.5;}))n++;}return n;})()');
ok(wc===1,'T9d ★★殉爆后就地留下残骸 (world 内压瘪桶身群 =1, 实测 '+wc+')');
const parts=G('(function(){for(const o of world.children){if(o.isGroup&&o.children.some(function(c){return c.geometry===_BARREL_G.body&&c.scale.y<0.5;}))return {n:o.children.length,rib:o.children.filter(function(c){return c.geometry===_BARREL_G.rib;}).length,body:o.children.some(function(c){return c.geometry===_BARREL_G.body;})};}return null;})()');
ok(parts&&parts.n===4&&parts.rib===3&&parts.body,'T9e ★残骸构成读得出"油桶残骸" (4 件: 压瘪桶身+翻口沿+滚箍残片×2 [rib 几何 3 道], 实测 '+(parts?JSON.stringify(parts):'-')+')');
ok(G('(CRATER_LIFE.length>=1&&CRATER_LIFE[0].ttl===150)'),'T9f ★残骸焦土贴花入账 (runtime 坑 150s 淡出随残骸落场)');
const bx1=G('BOXES.length');
ok(bx1===bx0,'T9h ★纯视觉钉: 残骸不入碰撞账 (BOXES '+bx0+'→'+bx1+')');
G(popLast1);
}
}

// ══ T10 火池二令 ══
console.log('T10 火池 6 分钟+天气豁免 (noWx: 灼烧/燃烧时长/植被链全豁免视同晴档)');
{
const cfg=fs.readFileSync(path.join(root,'js/00-config.js'),'utf8');
const w5=fs.readFileSync(path.join(root,'js/05-world.js'),'utf8');
const s4b=fs.readFileSync(path.join(root,'js/04b-fire.js'),'utf8');
ok(cfg.includes('poolR:2.3, poolTtl:360, poolDps:16,')&&cfg.includes('crushVehDmg:400};'),'T10a ★poolTtl=360 (6 分钟, 2026-11-18 用户二令; ★2026-11-28 碾压批判据跟走: BARREL 尾随 crushVehDmg, 锚拆两段)');
ok(w5.includes('BARREL.poolDps,attacker||null,null,true);'),'T10b ★火池 noWx 标记接线 (05-world → addFireSource)');
ok(s4b.includes('fireDmg=fs.dps*0.4*(fs.noWx?1:dmgMul);')&&s4b.includes('FUEL[ci]-=dt*0.055*(FNOWX[ci]?1:bRate);')&&s4b.includes('if(sExt>0&&!FNOWX[ci]&&Math.random()<dt*sExt){')&&s4b.includes('igniteCell(nj2,FATT[ci],FEXPIRE[ci],FNOWX[ci]);')&&s4b.includes('const dmg=3.2*(s.burnNoWx?1:dmgMul);'),'T10c ★04b 豁免链源码钉 (灼烧伤害/受潮减速/暴雨浇灭门/蔓延继承/燃烧态伤害)');
// 行为钉: 拨暴雨档 → 灼烧伤害/植被消耗逐位=晴档
G('Object.assign(WX_CFG,{fireMul:0.35,fireDmgMul:0.45,burnDur:0.8,burnRateMul:0.45,stormExtinguish:0.16});');
const a10=clearAnchor();
const B10=placeBarrel(a10.x,a10.z);
ok(!!B10,'T10 前置: 天气档测试桶落位');
if(B10){
const x10=B10.x.toFixed(2), z10=B10.z.toFixed(2);
G('barrelDamage(CYLS[CYLS.length-1],500,player)');
ok(G('(function(){const s=FIRE_SOURCES[FIRE_SOURCES.length-1];return !!s&&s.noWx===1&&s.ttl===360;})()'),'T10d ★★火池落账 noWx=1 + ttl=360 (上下文内单式读)');
// 植被链: 池边 fuelAdd → 火池点燃 → 格入账带 FNOWX=1; 受潮减速不生效 (消耗 0.055/s 逐位晴档)
G('fuelAdd('+(B10.x+1.3).toFixed(2)+','+z10+',1.0)');
const ci10=G('fCellI('+(B10.x+1.3).toFixed(2)+','+z10+')');
G('updateFires(0.8)');
ok(G('('+ci10+'>=0&&FBURN['+ci10+']>0&&FNOWX['+ci10+']===1)'),'T10e ★火池点燃植被格落豁免标志 (FBURN>0, FNOWX=1)');
const f0=Number(G('FUEL['+ci10+']'));
G('updateFires(1.0)');
const f1=Number(G('FUEL['+ci10+']'));
ok(Math.abs((f0-f1)-0.055)<0.002,'T10f ★★暴雨档燃料消耗=晴档 0.055/s (实测 '+(f0-f1).toFixed(4)+', 受潮档 0.0248 出窗)');
// 灼烧: 玩家站池内一 tick = 16×0.4=6.4 逐位晴档 (不吃 fireDmgMul 0.45); 燃烧时长=晴档 3.5 (不吃 0.8)
const px10=Number(G('player.pos.x')).toFixed(2), pz10=Number(G('player.pos.z')).toFixed(2), py10=Number(G('player.pos.y')).toFixed(2);
const hp0=Number(G('player.hp'));
G('player.pos.x='+x10+'; player.pos.z='+z10+'; player.pos.y=heightAt('+x10+','+z10+');');   // y 随传送落池底地面 (clearAnchor 可落崖顶/谷底, 灼烧圈 y 带 3.5 门)
G('(function(){const ci0=fCellI(player.pos.x,player.pos.z);const cxi=ci0%FN,czi=(ci0/FN)|0;for(let dj=-2;dj<=2;dj++)for(let di=-2;di<=2;di++){const ni=cxi+di,nj=czi+dj;if(ni<0||nj<0||ni>=FN||nj>=FN)continue;const ci=nj*FN+ni;FBURN[ci]=0;FUEL[ci]=0;FHEAT[ci]=0;FEXPIRE[ci]=0;FNOWX[ci]=0;}for(let i=FIRE_ACTIVE.length-1;i>=0;i--)if(FBURN[FIRE_ACTIVE[i]]<=0){FIRE_ACTIVE[i]=FIRE_ACTIVE[FIRE_ACTIVE.length-1];FIRE_ACTIVE.pop();}})()');   // 清首圈燃烧格: 站位点在殉爆 igniteArea(2.2) 圈内, 不清则走格分支 5.2 而非火池分支 6.4
G('fireDamageTick()');
ok(Math.abs((hp0-Number(G('player.hp')))-6.4)<0.01,'T10g ★★暴雨档火池灼烧=晴档 6.4/0.4s (16×0.4 不吃 ×0.45; 实测掉血 '+(hp0-Number(G('player.hp'))).toFixed(2)+')');
ok(G('player.burnNoWx===true&&Math.abs(player.burnTimer-3.5)<0.01'),'T10h ★燃烧态时长=晴档 3.5s (不吃 burnDur 0.8) + 豁免态随源落账');
// 清场: 玩家还原 + 燃烧态清 + 池摘 + 5×5 格清
G('player.pos.x='+px10+'; player.pos.z='+pz10+'; player.pos.y='+py10+';');
G('player.burnTimer=0; player.burnTickT=0; player.burnAttacker=null; player.burnNoWx=false;');
G(popLast1);
G('(function(){const ci0='+ci10+';const cxi=ci0%FN,czi=(ci0/FN)|0;for(let dj=-2;dj<=2;dj++)for(let di=-2;di<=2;di++){const ni=cxi+di,nj=czi+dj;if(ni<0||nj<0||ni>=FN||nj>=FN)continue;const ci=nj*FN+ni;FBURN[ci]=0;FUEL[ci]=0;FHEAT[ci]=0;FEXPIRE[ci]=0;FNOWX[ci]=0;}for(let i=FIRE_ACTIVE.length-1;i>=0;i--)if(FBURN[FIRE_ACTIVE[i]]<=0){FIRE_ACTIVE[i]=FIRE_ACTIVE[FIRE_ACTIVE.length-1];FIRE_ACTIVE.pop();}})()');
}
G('Object.assign(WX_CFG,{fireMul:1,fireDmgMul:1,burnDur:3.5,burnRateMul:1,stormExtinguish:0});   // 天气回晴档 (乘区污染防线)');
}

// ══ T6 版本戳 ══
console.log('T6 版本戳');
{
const gf=fs.readFileSync(path.join(root,'dev/_game_files.txt'),'utf8');
const stamps=[...html.matchAll(/20261128e/g)].length;
ok(stamps>=48&&html.includes("window.__sfStyleVer='20261128e';")
&&gf.split(/\r?\n/).filter(l=>l.includes('?v=20261128e')).length===45
&&!html.includes('20261117b')&&!gf.includes('20261117b'),'T6 ★版本戳 20261128e: index.html '+stamps+' 处 + __sfStyleVer + _game_files 45 行 + 旧 20261117b 清零 (跟码: 2026-11-10 海战移除批判据)');
}

console.log('verify-20261118a: PASS='+PASS.length+' FAIL='+FAILN+(NEG?' (--neg)':''));
process.exit(FAILN>0?1:0);
