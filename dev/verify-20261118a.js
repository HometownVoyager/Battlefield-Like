// ─────────────────────────────────────────────
// dev/verify-20261118a.js —— 油桶殉爆批 (2026-11-18 用户令):
//   T1 油桶子弹记账 (fireBullet 单弹道口 wr.cyl 引用: 步枪/机枪 24/发 ~5 发殉爆, 反坦克枪 70/发 2 发;
//      非爆炸圆柱=树干不记账)
//   T2 爆炸记账 (damageStructures ③ 直调 barrelBlast → barrelDamage ×blastMul: 现有爆炸源圈内一击
//      殉爆与旧口径一致; 小爆 chip 不再"圈内即爆"; 邻桶连锁半径不变)
//   T3 火烧三路记账 (04b updateFires 受热账 0.4s tick: 持续火源圈 / 燃烧草格 fCellI+igniteCell /
//      燃烧弹云 SMOKES.incin —— 旧口径火烧对桶毫无反应)
//   T4 殉爆留下火焰 (barrelBlast 补 addFireSource 余火池 r2.3/ttl14/dps16 + attacker 归属 +
//      余火烤毙 2.5m 邻桶 = 级联火)
//   T5 投射物弹性削减 (用户令"有限减少一些手雷等投射物的弹性": 落地 0.38→0.24/切向 0.68→0.60,
//      盒顶 0.4→0.26·切向 0.7→0.62, 盒侧 0.5→0.34; 触发判据/弹跳音效/预瞄弧共用积分器全链不动)
//   T6 版本戳 20261118a (index.html 全量唯一 + __sfStyleVer + _game_files 45 行 + 旧 20261117b 清零)
// 用法: node dev/verify-20261118a.js [--neg]
//   --neg = 阴性对照: 单行锚还原旧写法, 行为/源码判据必须报红 (5 补丁, 单跑逐个应用, 对认按红名):
//     N1 摘 fireBullet 子弹记账 → T1 红 (子弹打桶永远不掉血)
//     N2 ③ 回旧直调 barrelBlast → T2 chip 红 (amt=10 的小爆也当场引爆 = 旧"圈内即爆")
//     N3 摘受热账记账行 → T3 红 (火烤桶毫无反应)
//     N4 落地反弹还原 0.38 → T5 红 (源码钉+行为钉)
//     N5 摘殉爆留火池 → T1/T4 红 (殉爆后无火焰)
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
['js/05-world.js','if(typeof addFireSource===\'function\') addFireSource(c.x,c.z,p.y+0.3,BARREL.poolR,BARREL.poolTtl,BARREL.poolDps,attacker||null);',';'],
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
ok(html.includes("__sfStyleVer='20261118a'"),'前置: 版本戳 20261118a 在位 (index.html 内联)');

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
const B=placeBarrel(a.x,a.z);
ok(!!B,'T1 前置: 测试桶落位');
if(B){
const x=B.x.toFixed(2), z=B.z.toFixed(2);
const y1=Number(G('CYLS[CYLS.length-1].y1')).toFixed(2);
// 弹道口引用: 竖直向下射线命中桶, wr.cyl 必须携带桶账 (2026-11-18 新增结果槽字段)
const wr=G('(function(){const r=raycastWorld(V3('+x+','+y1+'+4,'+z+'),V3(0,-1,0),8);return r?{kind:r.kind,isCyl:r.cyl===CYLS[CYLS.length-1]}:null;})()');
ok(wr&&wr.kind==='cyl'&&wr.isCyl,'T1a ★raycastWorld 结果槽带 cyl 引用 (kind=cyl, wr.cyl===桶账)');
// 步枪档: 24/发 ×5 殉爆 (hp 懒建 100)
const def=JSON.stringify({dmg:30,headMul:2,fallS:40,fallE:220,fallF:0.45,tracer:3,sid:'rifle'});
const before=G('FIRE_SOURCES.length');
for(let i=0;i<4;i++) G('fireBullet(player,V3('+x+','+y1+'+4,'+z+'),V3(0,-1,0),'+def+',null)');
const hp4=Number(G('CYLS[CYLS.length-1].hp'));
ok(Math.abs(hp4-4)<0.01,'T1b ★步枪弹 24/发记账 (4 发后 hp=4, 实测 '+hp4+')');
G('fireBullet(player,V3('+x+','+y1+'+4,'+z+'),V3(0,-1,0),'+def+',null)');
ok(G(barrelDead),'T1c ★第 5 发殉爆 (killCyl 摘账)');
ok(G('FIRE_SOURCES.length')===before+1,'T1d ★殉爆留下火焰 (FIRE_SOURCES +1)');
const pool=G('FIRE_SOURCES[FIRE_SOURCES.length-1]');
ok(pool&&Math.abs(pool.r-2.3)<0.01&&Math.abs(pool.ttl-14)<0.01&&Math.abs(pool.dps-16)<0.01,'T1e ★余火池口径 r2.3/ttl14/dps16 (实测 r='+pool.r+' ttl='+pool.ttl+' dps='+pool.dps+')');
ok(pool&&Math.abs(pool.x-B.x)<0.1&&Math.abs(pool.z-B.z)<0.1,'T1f ★余火池在桶位');
ok(G('FIRE_SOURCES[FIRE_SOURCES.length-1].attacker===player'),'T1g ★火池归属=击爆者 (attacker 透传, 上下文内单式比较)');
G(popLast1);
// 反坦克枪档: 70/发 ×2
const B2=placeBarrel(a.x+18,a.z);
if(B2){
const x2=B2.x.toFixed(2), z2=B2.z.toFixed(2);
const y12=Number(G('CYLS[CYLS.length-1].y1')).toFixed(2);
const atdef=JSON.stringify({dmg:80,atRifle:true,vehDmg:40,headMul:2,tracer:3,sid:'atRifle'});
G('fireBullet(player,V3('+x2+','+y12+'+4,'+z2+'),V3(0,-1,0),'+atdef+',null)');
const hp1=Number(G('CYLS[CYLS.length-1].hp'));
G('fireBullet(player,V3('+x2+','+y12+'+4,'+z2+'),V3(0,-1,0),'+atdef+',null)');
ok(Math.abs(hp1-30)<0.01&&G(barrelDead),'T1h ★反坦克枪 70/发 ×2 殉爆 (1 发后 hp=30, 实测 '+hp1+')');
G(popLast1);
}else ok(false,'T1h 前置: 反坦克枪桶落位失败');
// 非爆炸圆柱 (树干): wr.cyl 照样携带, 但不记账 (explosive 门, hp 从未建档)
const tr=G('(function(){for(const c of CYLS){if(!c.explosive&&!c.dead&&c.r>0.15&&c.r<0.6&&c.y1-c.y0>1.5){const r=raycastWorld(V3(c.x,c.y1+2,c.z),V3(0,-1,0),4);if(r&&r.kind==="cyl"&&r.cyl===c)return {x:c.x,z:c.z};}}return null;})()');
if(tr){
const tx=tr.x.toFixed(2), tz=tr.z.toFixed(2);
const ty1=Number(G('(function(){for(const c of CYLS){if(!c.explosive&&!c.dead&&Math.hypot(c.x-'+tx+',c.z-'+tz+')<0.5)return c.y1+2;}return 10;})()')).toFixed(2);
G('fireBullet(player,V3('+tx+','+ty1+','+tz+'),V3(0,-1,0),{dmg:30,headMul:2,tracer:3},null)');
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
const B5=placeBarrel(a.x,a.z), B6=placeBarrel(a.x+2.5,a.z);
ok(!!B5&&!!B6,'T4 前置: 双桶落位');
if(B5&&B6){
G('barrelDamage(CYLS[CYLS.length-2],500,player)');   // 直接殉爆 B5 (hp 懒建 100-500<0)
ok(G(barrelDeadN(2))&&G('FIRE_SOURCES[FIRE_SOURCES.length-1].attacker===player'),'T4a ★barrelDamage 直殉+火池归属 player (上下文内单式比较)');
let popped=-1;
for(let i=0;i<HEAT_TICKS;i++){ G('updateFires(0.4)'); if(G(barrelDeadN(1))){ popped=i+1; break; } }
ok(popped>0,'T4b ★★余火烤毙 2.5m 邻桶 (殉爆后留下火焰继续烧, 第 '+popped+' tick)');
G(popLast2);
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

// ══ T6 版本戳 ══
console.log('T6 版本戳');
{
const gf=fs.readFileSync(path.join(root,'dev/_game_files.txt'),'utf8');
const stamps=[...html.matchAll(/20261118a/g)].length;
ok(stamps>=48&&html.includes("window.__sfStyleVer='20261118a';")
&&gf.split(/\r?\n/).filter(l=>l.includes('?v=20261118a')).length===45
&&!html.includes('20261117b')&&!gf.includes('20261117b'),'T6 ★版本戳 20261118a: index.html '+stamps+' 处 + __sfStyleVer + _game_files 45 行 + 旧 20261117b 清零 (跟码: 2026-11-10 海战移除批判据)');
}

console.log('verify-20261118a: PASS='+PASS.length+' FAIL='+FAILN+(NEG?' (--neg)':''));
process.exit(FAILN>0?1:0);
