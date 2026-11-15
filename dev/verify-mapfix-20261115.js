// ─────────────────────────────────────────────
// dev/verify-mapfix-20261115.js —— 2026-11-15 多图修批正式探针
// 用法: node dev/verify-mapfix-20261115.js [all|berlin|hukawng|steppe|moscow|baituan|neg]  (默认 all)
// 覆盖 (用户实机问题单 2026-11-15):
//   柏林地铁 5.1: a) 隧道带桥式抬升 (坦克过顶板) b) 厅底板+坑底压平 c) 顶/墙/洞口封严 (胸墙) d) 侧墙护环 pad
//   莫斯科 2.1/2.2: 残墙迁位不压教堂不进房 / 工厂旗西移 (旗距苏基 186→132m)
//   百团 1.1/1.2: 中路前哨拉开 / R10 堑口南移 (距桥 ≥20m)
//   胡康 3.1/3.2/3.3: 激流水态门 (干岸不误伤) / 河道过可玩边界 / 水位抬升 (0.55→0.44)
//   草原 4.1: 四腿水塔腿位收进罐底投影
// 阴性对照 (neg): 4 组源码变异 —— 摘 street 抬升 / 摘坑底压平 / 摘残墙足迹 / 摘水态门, 对应正向断言必须转红
// 装载: dev/_bootstub.js + dev/_bootpatch.js + 全量 js/ 顺序加载 + startBtn.onclick() (同 verify-mapshrink 口径)
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const SRC=f=>fs.readFileSync(path.join(root,f),'utf8');
const which=(process.argv[2]||'all').toLowerCase();
const IDX={berlin:2,moscow:6,baituan:4,hukawng:7,steppe:8};
const HEAD=['js/00-config.js','js/00b-i18n.js','js/00c-procgen.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js',
'js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js',
'js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js',
'js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/16-aircraft.js',
'js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js',
'js/22a-menuart.js','js/22b-speclayer.js','js/23-deploy.js','js/23b-worldrestore.js','js/25-zombies.js','js/24-main.js'];

const {sandbox,document,window}=require('./_bootstub.js');
require('./_bootpatch.js').patch(sandbox);

// mut: [{file, from, to}] —— 阴性对照的源码变异 (boot 前逐文件替换, 命中数必须=1)
function boot(campIdx,mut){
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document; ctx.window=window; ctx.globalThis=ctx;
ctx.location={search:'?seed=42',href:'http://localhost/index.html',hostname:'localhost',protocol:'http:'};
ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
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
const N=(ctx,code,vars)=>{ if(vars) for(const k of Object.keys(vars)) ctx[k]=vars[k]; return vm.runInContext(code,ctx); };
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ '+m);} };

// ═══════════ 柏林: 地铁五项 ═══════════
function diagBerlin(ctx,errs){
errs.forEach(e=>console.log('  BOOT-ERR '+e));
const T=N(ctx,'(CITY&&CITY.metro&&CITY.metro.tunnel)||null');
if(!T){ ok(false,'metro.tunnel 存在 (CITY)'); return; }
const tunX=(T.x0+T.x1)/2;
// B1 桥面=街面
const rows=N(ctx,`(()=>{const T=CITY.metro.tunnel,tunX=(T.x0+T.x1)/2;
const gNat=z=>Math.max(heightAt(T.x0-1.2,z),heightAt(T.x1+1.2,z),heightAt(T.x0-1.2,z-3),heightAt(T.x1+1.2,z+3));
return [T.z0+3,(T.z0+T.z1)/2,T.z1-3].map(z=>({z,tIn:heightAt(tunX,z),tOut:gNat(z)}));})()`);
let b1=true;
for(const r of rows){ const d=r.tIn-r.tOut; if(!(d>-1.4&&d<0.6)) b1=false; }
ok(b1,'B1 隧道带=街面桥 (带内 vs 邻侧差 ∈(-1.4,0.6); 旧版 −2.6 明坑)');
// B2 横穿连续性 (坦克碾过无竖坎; 带两端站坑竖坎=有意, 不扫)
const cont=N(ctx,`(()=>{const T=CITY.metro.tunnel,tunX=(T.x0+T.x1)/2;let mx=0;
const scan=(x0,z0,x1,z1)=>{const L=Math.hypot(x1-x0,z1-z0);let prev=null;
for(let s2=0;s2<=L+0.001;s2+=0.5){const t=Math.min(1,s2/L),h=heightAt(x0+(x1-x0)*t,z0+(z1-z0)*t);
if(prev!==null)mx=Math.max(mx,Math.abs(h-prev));prev=h;}};
for(let z=T.z0+1;z<=T.z1-1;z+=2)scan(tunX-8,z,tunX+8,z);
return mx;})()`);
ok(cont<=0.35,`B2 横穿连续性 max|Δh|/0.5m=${cont.toFixed(3)} ≤0.35`);
// B3 顶板贴本地街面 (z=0 碟心 + 中段)
const roof=N(ctx,`(()=>{const T=CITY.metro.tunnel,boxes=BOXES,tunX=(T.x0+T.x1)/2;const out=[];
for(const z of [0,(T.z0+T.z1)/2]){const tIn=heightAt(tunX,z);
let top=null;for(const b of boxes){if(b.dead)continue;if(tunX>b.minX&&tunX<b.maxX&&z>b.minZ&&z<b.maxZ&&(top===null||b.maxY>top))top=b.maxY;}
out.push({z,tIn,top});}return out;})()`);
let b3=true;
for(const r of roof){ if(r.top===null||!(r.top>r.tIn-1.0&&r.top<r.tIn+0.05)) b3=false; }
ok(b3,'B3 顶板贴带内街面 (top ∈ [街面−1.0, 街面+0.05], z=0 碟心含碟剖面)');
// B4 洞内底板 + 净高
const fl=N(ctx,`(()=>{const T=CITY.metro.tunnel,boxes=BOXES,tunX=(T.x0+T.x1)/2;const out=[];
for(const z of [T.z0+3,(T.z0+T.z1)/2,T.z1-3]){const terr=heightAt(tunX,z);
let roofB=null,floor=null;
for(const b of boxes){if(b.dead)continue;if(!(tunX>b.minX&&tunX<b.maxX&&z>b.minZ&&z<b.maxZ))continue;
if(roofB===null||b.maxY>roofB)roofB=b.maxY;
if(b.maxY<terr-1.5&&(floor===null||b.maxY>floor))floor=b.maxY;}
out.push({z,roofB,floor});}return out;})()`);
let b4=true;
for(const r of fl){ if(r.floor===null||r.roofB===null||r.roofB-r.floor<1.7) b4=false; }
ok(b4,'B4 洞内底板存在且净高 ≥1.7 (步兵通道保留)');
// B5 洞口通道无阻挡 (jam 带锚洞内底板) + 胸墙在位
const mouth=N(ctx,`(()=>{const T=CITY.metro.tunnel,boxes=BOXES,tunX=(T.x0+T.x1)/2;const out=[];
for(const wz of [T.z0,T.z1]){const gy=heightAt(tunX,wz);
let floor=null,parapet=null;
for(const b of boxes){if(b.dead)continue;if(!(tunX>b.minX&&tunX<b.maxX&&wz>b.minZ&&wz<b.maxZ))continue;
if(b.maxY<gy-1.5&&b.maxY>gy-4&&(!floor||b.maxY>floor))floor=b.maxY;
if(b.maxY>gy+0.3&&b.maxY<gy+1.2&&(!parapet||b.maxY>parapet))parapet=b.maxY;}
const fTop=floor!==null?floor:gy-2.6;
let jam=false;
for(const b of boxes){if(b.dead)continue;if(!(tunX>b.minX&&tunX<b.maxX&&wz>b.minZ&&wz<b.maxZ))continue;
if(b.minY<fTop+1.6&&b.maxY>fTop+0.2){jam=true;break;}}
out.push({wz,jam,parapet});}return out;})()`);
for(const m of mouth){
ok(!m.jam,`B5 洞口 z=${m.wz.toFixed(1)} 通道无阻挡 (jam 带=底板顶+0.2..+1.6)`);
ok(m.parapet!==null,`B5 洞口 z=${m.wz.toFixed(1)} 胸墙在位 (街面+0.3..+1.2 拦载具, Bot OCC 自动绕行)`);
}
// B6 厅坑压平 + 底板平贴
const halls=N(ctx,'CITY.metro.halls');
const flats=N(ctx,`(()=>{const HS=CITY.metro.halls;return HS.map(A=>{const cx=(A.x0+A.x1)/2,cz=(A.z0+A.z1)/2;
let mn=1e9,mx=-1e9;for(const [sx,sz] of [[cx,cz],[A.x0+1,A.z0+1],[A.x1-1,A.z1-1],[A.x0+1,A.z1-1],[A.x1-1,A.z0+1]]){const h=heightAt(sx,sz);if(h<mn)mn=h;if(h>mx)mx=h;}
let slab=null;for(const b of BOXES){if(b.dead)continue;if(cx>b.minX&&cx<b.maxX&&cz>b.minZ&&cz<b.maxZ&&b.maxY<mx+0.5&&(!slab||b.maxY>slab))slab=b.maxY;}
return {mn,mx,slab};});})()`);
halls.forEach((A,i)=>{
const f=flats[i];
ok(f.mx-f.mn<0.01,`B6 厅${i+1} 坑底压平 (高差 ${(f.mx-f.mn).toFixed(4)}<0.01)`);
ok(f.slab!==null&&Math.abs(f.slab-(f.mx+0.06))<0.1,`B6 厅${i+1} 底板平贴坑底 (顶=坑底+0.06)`);
});
// B7 护环 pad
const padN=N(ctx,`(()=>{const HS=CITY.metro.halls,D=3;let n=0;
for(const p of PADS){for(const A of HS){
const px=Math.max(A.x0-D,Math.min(p.x,A.x1+D)),pz=Math.max(A.z0-D,Math.min(p.z,A.z1+D));
if(Math.abs(p.x-px)<0.01&&Math.abs(p.z-pz)<0.01&&Math.min(p.hw,p.hd)<=D/2+0.01){n++;break;}}}
return n;})()`);
ok(padN>=8,`B7 护环 pad 登记 ${padN}≥8 (厅矩形外 3m 环带, 杀侧墙沟)`);
// B8 顶板 OCC 豁免
const b8=N(ctx,`(()=>{const T=CITY.metro.tunnel,boxes=BOXES,tunX=(T.x0+T.x1)/2;
const z=(T.z0+T.z1)/2,gh=heightAt(tunX,z);
for(const b of boxes){if(b.dead)continue;if(tunX>b.minX&&tunX<b.maxX&&z>b.minZ&&z<b.maxZ&&b.maxY>gh-1.0&&b.maxY<gh+0.05)return b.maxY<gh+0.5;}
return false;})()`);
ok(b8,'B8 顶板 maxY<gh+0.5 ⇒ OCC 豁免 (不挡寻路/不推车)');
}

// ═══════════ 胡康: 水面三项 ═══════════
function diagHukawng(ctx,errs){
errs.forEach(e=>console.log('  BOOT-ERR '+e));
const dry=N(ctx,'inRiverWater(15.4,21.65)');
const wet=N(ctx,'inRiverWater(0.46,20)');
const dep=N(ctx,'waterDepthAt(0.46,20)');
ok(dry===false,'H1 干岸点 (15.4,21.65) inRiverWater=false (水态门, 旧平面判据误伤)');
ok(wet===true&&dep>6.5,`H1 水中点 (0.46,20) inRiverWater=true 且水深 ${dep.toFixed(2)}>6.5 (3.3 水位抬升 0.44 系数)`);
const e1=N(ctx,'(()=>{const h=heightAt(-22.8,-195),w=waterYAt(-22.8,-195);return w-h;})()');
const e2=N(ctx,'(()=>{const h=heightAt(5.3,195),w=waterYAt(5.3,195);return w-h;})()');
ok(e1>0.3&&e2>0.3,`H2 河道过可玩边界 (±195 处水深 ${e1.toFixed(2)}/${e2.toFixed(2)}; 条带覆盖到 ±206 > 可玩 ±190)`);
const ford=N(ctx,'waterDepthAt(-2,102.1)');
ok(ford<0.4,`H3 ford 滩心干坡 (水深 ${ford.toFixed(2)}<0.4)`);
}

// ═══════════ 草原: 水塔腿 ═══════════
function diagSteppe(ctx,errs){
errs.forEach(e=>console.log('  BOOT-ERR '+e));
const towers=N(ctx,`(()=>{const out=[];for(const t of CYLS){if(Math.abs(t.r-2.2)<0.01&&(t.y1-t.y0)>2.9&&(t.y1-t.y0)<3.1){
const legs=[];for(const c of CYLS){if(Math.abs(c.r-0.3)<0.01&&Math.hypot(c.x-t.x,c.z-t.z)<3.2)legs.push(Math.hypot(c.x-t.x,c.z-t.z));}
if(legs.length>=4)out.push({x:t.x,z:t.z,legs});}}return out;})()`);
ok(towers.length>=1,`S1 四腿水塔找到 ${towers.length} 座`);
for(const t of towers){
const mx=Math.max(...t.legs);
ok(mx<=2.25,`S1 腿位收进罐底投影 (max 对角 ${mx.toFixed(3)}≤2.25, 罐 r=2.2; 旧 2.40 浮空)`);
}
}

// ═══════════ 莫斯科: 残墙/工厂/棚屋 ═══════════
function diagMoscow(ctx,errs){
errs.forEach(e=>console.log('  BOOT-ERR '+e));
const wall=N(ctx,`(()=>{const wall={x0:-131,z0:20,x1:-112,z1:21};
let church=null,houseHit=false;
for(const r of BUILD_REG){if(r.type==='church'){church={x0:r.x-r.w/2-0.5,x1:r.x+r.w/2+0.5,z0:r.z-r.d/2-0.5,z1:r.z+r.d/2+0.5};}}
const ov=(a,b)=>Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0)>0&&Math.min(a.z1,b.z1)-Math.max(a.z0,b.z0)>0;
const churchOver=!!(church&&ov(wall,church));
for(const f of B_FOOT){
if((f.x1-f.x0)>12||(f.z1-f.z0)>12)continue; // 房屋级足迹 (教堂大院/广场清空包络不算)
if(ov(wall,f)){houseHit=true;break;}
}
// 教堂旗净空: 无 BUILD_REG 足迹覆盖旗点
let flagHit=false;
for(const f of (CAMPAIGN.flags||[])){ if(f.id!=='教堂') continue;
for(const r of BUILD_REG){ const cs=Math.abs(Math.cos(r.ry)),sn=Math.abs(Math.sin(r.ry));
const ex=(r.w*cs+r.d*sn)/2+0.6, ez=(r.w*sn+r.d*cs)/2+0.6;
if(f.x>r.x-ex&&f.x<r.x+ex&&f.z>r.z-ez&&f.z<r.z+ez) flagHit=true; } }
return {churchOver,houseHit,flagHit};})()`);
ok(!wall.churchOver&&!wall.houseHit,'M1 残墙不压教堂实体足迹且无房屋级足迹重叠 (2.1 墙卡房修复)');
ok(!wall.flagHit,'M1b 教堂旗点无建筑覆盖 (棚屋街内禁落门)');
const fl=N(ctx,`(()=>{return (CAMPAIGN.factoryFlag==='工厂')?CAMPAIGN.flags.find(f=>f.id==='工厂')||null:null;})()`);
if(fl){
const d=N(ctx,'Math.hypot(_f.x-(-163.1),_f.z-(-80))',{_f:fl});
ok(Math.abs(fl.x-(-43))<0.5&&d<150,`M2 工厂旗西移 (@${fl.x.toFixed(0)},${fl.z.toFixed(0)}, 距苏基 ${d.toFixed(0)}m; 旧 186m)`);
}else ok(false,'M2 工厂旗存在');
}

// ═══════════ 百团: R10/营距 ═══════════
function diagBaituan(ctx,errs){
errs.forEach(e=>console.log('  BOOT-ERR '+e));
const r10=N(ctx,`(()=>{let r=null;const rl=(CAMPAIGN.loess&&CAMPAIGN.loess.ramps)||[];for(const q of rl){if(Math.abs(q.x0-(-72.9))<0.01)r=q;}return r;})()`);
if(r10){
const cx=(r10.x0+r10.x1)/2,cz=(r10.z0+r10.z1)/2;
const bd=N(ctx,`(()=>{const cx=_c.cx,cz=_c.cz;let m=1e9;const bl=(CAMPAIGN.loess&&CAMPAIGN.loess.bridges)||CAMPAIGN.bridges||[];
for(const B of bl){const bx=(B.x!==undefined?B.x:(B.x0+B.x1)/2),bz=(B.z!==undefined?B.z:(B.z0+B.z1)/2);const d=Math.hypot(cx-bx,cz-bz);if(d<m)m=d;}
return m;})()`,{_c:{cx,cz}});
ok(bd>=20,`T1 R10 堑口距最近桥 ${bd.toFixed(1)}m ≥20 (1.2 桥旁平地修复; 旧 14.5m)`);
}else ok(false,'T1 R10 ramps 条目存在');
const ds=N(ctx,`(()=>{const B=CAMPAIGN.bases;let mid=null;
for(const s of (CAMPAIGN.spawns||[])){if(Math.abs(s.x-(-130.5))<0.01&&Math.abs(s.z-50)<0.01)mid=s;}
if(!mid) return {d1:0,d2:0};
return {d1:Math.hypot(mid.x-B[0].x,mid.z-B[0].z),d2:Math.hypot(mid.x-B[1].x,mid.z-B[1].z)};})()`);
ok(Math.min(ds.d1,ds.d2)>=55,`T2 中路前哨距两基 ${ds.d1.toFixed(0)}/${ds.d2.toFixed(0)}m 均 ≥55 (1.1 拉距)`);
}

// ═══════════ 阴性对照 (源码变异 → 对应正向必须转红) ═══════════
function neg(){
console.log('== NEG (阴性对照) ==');
// NEG1: 摘 street 抬升 (tunnel 带回到 −2.6 明坑) ⇒ B1 必红
{
const {ctx,errs}=boot(IDX.berlin,[{file:'js/03-terrain.js',from:'if(mr) h=mr.street?metroLiftY(mr,x,z):metroFlatY(mr);',to:'if(mr) h=metroFlatY(mr);'}]);
errs.forEach(e=>console.log('  BOOT-ERR '+e));
const d=N(ctx,`(()=>{const T=CITY.metro.tunnel,tunX=(T.x0+T.x1)/2,z=(T.z0+T.z1)/2;
const gNat=Math.max(heightAt(T.x0-1.2,z),heightAt(T.x1+1.2,z));
return heightAt(tunX,z)-gNat;})()`);
ok(d<-1.4,'NEG1 摘 street 抬升 ⇒ 隧道带回深坑 (Δ='+(isFinite(d)?d.toFixed(2):d)+' <−1.4, B1 有牙)');
}
// NEG2: 摘坑底压平 (厅矩形压平分支短路) ⇒ B6 必红
{
const {ctx,errs}=boot(IDX.berlin,[{file:'js/03-terrain.js',from:'if(mr) h=mr.street?metroLiftY(mr,x,z):metroFlatY(mr);',to:'if(mr&&!mr.street&&false) h=metroLiftY(mr,x,z);'}]);
errs.forEach(e=>console.log('  BOOT-ERR '+e));
const sp=N(ctx,`(()=>{const A=CITY.metro.halls[0],cx=(A.x0+A.x1)/2,cz=(A.z0+A.z1)/2;
let mn=1e9,mx=-1e9;for(const [sx,sz] of [[cx,cz],[A.x0+1,A.z0+1],[A.x1-1,A.z1-1],[A.x0+1,A.z1-1],[A.x1-1,A.z0+1]]){const h=heightAt(sx,sz);if(h<mn)mn=h;if(h>mx)mx=h;}
return mx-mn;})()`);
ok(sp>0.01,'NEG2 摘坑底压平 ⇒ 厅内高差 '+(isFinite(sp)?sp.toFixed(2):sp)+' >0.01 (B6 有牙)');
}
// NEG3: 摘残墙足迹登记 ⇒ M1 (房屋骑墙) 必红
{
const {ctx,errs}=boot(IDX.moscow,[{file:'js/05b-props.js',from:'B_FOOT.push(Object.assign(footRect(x,z,ry,Math.min(4.2,len/steps+0.16),0.55,0.4),{sw:1}));',to:';'}]);
errs.forEach(e=>console.log('  BOOT-ERR '+e));
const hit=N(ctx,`(()=>{const p=placeAt(-121,20.5,0,8,9,{maxDh:1.2});return !!p;})()`);

ok(hit===true,'NEG3 摘残墙足迹 ⇒ 墙线 placeAt 成功 (足迹登记的建筑避让作用确证, M1 有牙)');
}
// NEG4: 摘水态门 (回纯平面判据) ⇒ H1 干岸必红
{
const {ctx,errs}=boot(IDX.hukawng,[{file:'js/03-terrain.js',from:'return inRiverChannel(x,z)&&waterDepthAt(x,z)>0.2;',to:'return inRiverChannel(x,z);'}]);
errs.forEach(e=>console.log('  BOOT-ERR '+e));
const dry=N(ctx,'inRiverWater(15.4,21.65)');
ok(dry===true,'NEG4 摘水态门 ⇒ 干岸点被误判水中 (H1 有牙)');
}
}

// ═══════════ 驱动 ═══════════
const RUNNERS={berlin:diagBerlin,hukawng:diagHukawng,steppe:diagSteppe,moscow:diagMoscow,baituan:diagBaituan};
if(which==='neg'){ neg(); }
else if(which==='all'){
for(const k of Object.keys(RUNNERS)){
console.log('== '+k+' ==');
const {ctx,errs}=boot(IDX[k]);
RUNNERS[k](ctx,errs);
}
neg();
}else if(RUNNERS[which]){
console.log('== '+which+' ==');
const {ctx,errs}=boot(IDX[which]);
RUNNERS[which](ctx,errs);
}else{ console.log('unknown scope: '+which); process.exit(2); }
console.log(`\n==== verify-mapfix-20261115: ${pass} 通过 / ${fail} 失败 ====`);
process.exit(fail?1:0);
