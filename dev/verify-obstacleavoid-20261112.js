// ─────────────────────────────────────────────────────────────
// dev/verify-obstacleavoid-20261112.js —— 2026-11-12 实机反馈批 (士兵避车 + 三面板排版) 沙箱探针
// 用法: node dev/verify-obstacleavoid-20261112.js [--neg]
// 原理: 复用 dev/_bootstub.js 桩 (与 verify-botai-20261103 同款), 加载全部真实脚本 (与 index.html
//       同序, 动态解析), 真开局 (草原遭遇), 对 14-bots 的载具壳体障碍探针做行为断言。
// 背景 (实机: "士兵不会把载具等当作障碍物, 导致被卡住"):
//   _botMoveProbe 此前只查静态 OCC + 膝高射线; 载具是动态实体不在 OCC 里, 走位的 Bot 一头撞进
//   车壳, 只靠 vehiclePushSoldiers 侧向推挤硬顶 —— 观感就是贴着坦克又推又卡。
//   修 = 车壳 OBB(+0.5m) 也算障碍: 探针点落在壳内 = 此路不通, moveDir 的备选角扫描 (MOVE_DA)
//   自然沿车壳绕行; toVehicle 认领目标豁免 (要贴壳才够到上车判定 _surf<0.55); 脱困绕行点同样拒壳内。
// 断言:
//   T1 载入清单 (index.html 动态对账);
//   T2 源码防回退 (探针调用点/豁免门/绕行点门/OBB 单源在场);
//   T3 ★ 坦克壳体: 探针点进壳(+0.5) = 挡, 背向/远离 = 放行 (假坦克无碰撞体, 判据完全归探针);
//   T4 ★ 卡车壳体 + 轴配对: 横向 hx=1.05 / 纵向 hz=3.7 (与 vehiclePushSoldiers 15b:130 同参, 防轴反);
//   T4x ★ 横车 (yaw=HPI) 外接盒粗筛随 yaw 旋转 (世界轴界 wex/wez) —— 端到端探针实锤的侧腹放行 bug;
//   T5 ★ toVehicle 认领目标豁免: 朝目标车探 = 放行, 朝旁车探 = 仍挡;
//   T6 ★ 残骸也算障碍 (state='wreck' 后照挡 — 残骸只注册 DynCollider 是最常见的卡死实体);
//   T7 ★ 端到端绕行: 横在路中的坦克 (yaw=HPI 长面拦路), 步兵直奔 26m 外目标 —— 全程不进壳+0.45m
//       (旧版假坦克无碰撞体 = 直穿壳心, 该判据必红), 且最终越过坦克纵深;
//   T8 排版批源码在场 (setCard/helpCard/helpPts/hkRow + 版本戳统一)。
// ─────────────────────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const NEG=process.argv.includes('--neg');
const OK=[],BAD=[];
function assert(name,cond,detail){ (cond?OK:BAD).push(name); console.log(`  ${cond?'✓':'✗'} ${name}${detail?'  '+detail:''}`); }
function section(t){ console.log('\n══ '+t+' ══'); }
const SRC=f=>fs.readFileSync(path.join(root,f),'utf8');

// ── 阴性对照 (锚点 = 修后原文单行; 找不到就抛错, 防"锚点漂移后静默通过") ──
const PATCHES=[
 // A 探针的载具门退场 (回到旧"只查静态 OCC" ⇒ T3/T4/T5/T6/T7 红)
 ['js/14-bots.js',
  "if(!b.swim&&!b.onCapDeck&&_vehProbeBlocked(b,px,pz)) return false; // 游泳态放行 (与水障格同规); 甲板行人不躲甲板下的艇壳 (否则大舰甲板上寸步难行)",
  ";"],
 // B 脱困绕行点的壳内拒绝退场 ⇒ T2 源码判据红
 ['js/14-bots.js',
  "if(!occBlocked(dx,dz)&&!_vehProbeBlocked(this,dx,dz)&&NAV.lineClear(this.pos.x,this.pos.z,dx,dz)){ // 绕行点也不许落在车壳里 (2026-11-12 避车批)",
  "if(!occBlocked(dx,dz)&&NAV.lineClear(this.pos.x,this.pos.z,dx,dz)){"],
 // C 外接盒粗筛退回"局部界当世界界" (T7 实锤的横车侧腹放行 bug) ⇒ T4x-a 红
 ['js/14-bots.js',
  "const wex=Math.abs(mx*cs)+Math.abs(mz*sn), wez=Math.abs(mx*sn)+Math.abs(mz*cs);",
  "const wex=mx, wez=mz;"],
];
const PATCH_MAP={};
if(NEG) for(const [f,from,to] of PATCHES){
 const s=PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f);
 if(s.indexOf(from)<0) throw new Error('阴性对照锚点未找到: '+f+' :: '+from.slice(0,70));
 PATCH_MAP[f]=s.split(from).join(to);
}
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC(f));

const html=SRC('index.html');
const FILES=[...html.matchAll(/<script src="(js\/[^"?]+)\?v=[^"]*"/g)].map(m=>m[1]);

// ── 桩补丁 (与 verify-botai-20261103 同源) ──
const {sandbox,document,window,byId}=require('./_bootstub.js');
const V3c=sandbox.THREE.Vector3;
if(!V3c.prototype.addScalar) V3c.prototype.addScalar=function(s){ this.x+=s; this.y+=s; this.z+=s; return this; };
if(!V3c.prototype.divideScalar) V3c.prototype.divideScalar=function(s){ s=s||1; this.x/=s; this.y/=s; this.z/=s; return this; };
if(!V3c.prototype.clampScalar) V3c.prototype.clampScalar=function(a,b){ this.x=Math.min(b,Math.max(a,this.x)); this.y=Math.min(b,Math.max(a,this.y)); this.z=Math.min(b,Math.max(a,this.z)); return this; };
if(!V3c.prototype.project) V3c.prototype.project=function(){ this.x=0; this.y=0; this.z=1; return this; };
if(!V3c.prototype.cross) V3c.prototype.cross=function(v){ return this.crossVectors(this,v); };
if(!V3c.prototype.negate) V3c.prototype.negate=function(){ this.x=-this.x; this.y=-this.y; this.z=-this.z; return this; };
for(const k of ['MeshLambertMaterial','MeshBasicMaterial','MeshStandardMaterial','MeshPhongMaterial','PointsMaterial','SpriteMaterial']){
if(!sandbox.THREE[k]) sandbox.THREE[k]=function(){ return {clone(){return this;}}; };
}

const CAMP=8;   // 草原遭遇 (与 verify-botai 同图): 标准陆战, 坦克齐, 无海战编制

function boot(campIdx){
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document; ctx.window=window;
ctx.localStorage={_s:Object.assign({sf_campaign:String(campIdx)}),getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
ctx.console={log:(...a)=>{ const s=a.map(x=>String(x)).join(' '); if(!/^\[(地形|HUD|NAV|世界|音频)/.test(s)) console.log(...a); }, warn:console.warn.bind(console), error:console.error.bind(console)};
for(const f of FILES){ vm.runInContext(srcOf(f),ctx,{filename:f}); }
return ctx;
}
let CTX=null;
function run(code){ return vm.runInContext(code,CTX,{timeout:600000}); }
function bootCtx(){
CTX=boot(CAMP);
vm.runInContext(PRELUDE,CTX,{filename:'prelude'});
return run(`(()=>{ try{ const b=document.getElementById('startBtn'); if(b&&b.onclick){ b.onclick(); return 'ok'; } return 'no-button'; }catch(e){ return 'ERR '+String(e&&e.stack||e).slice(0,400); } })()`);
}

// ── 沙箱内工具 (★ 顶层 var: 桩的 globalThis 指向共享 sandbox, 写 globalThis.x 不进本 context) ──
const PRELUDE=`var __AI=(function(){
function mkBot(team,x,z,name){
const b=new Bot(team,0,name||'靶'); b.alive=true; b.pos.set(x,heightAt(x,z),z); b.vel.set(0,0,0);
b.onVehicle=null; b.spectator=false; b.hp=100; b.reactT=-1; b.decisionT=999; b.perceptT=0.16;
return b;
}
// 假坦克: 不 buildMesh 不进编制 (与 verify-botai mkTank 同款), 本批只读它的 pos/yaw/def.hullL/halfW
function mkTank(team,x,z,yaw,hullL,halfW){
const t={kind:'tank',alive:true,team,x:0,y:0,z:0,pos:V3(x,heightAt(x,z),z),yaw:yaw||0,
hp:100,maxHp:100,def:{hullL:hullL||6.9,name:'靶车'},halfW:halfW||1.3,
crewBot:null,playerDriven:false,claimBot:null,noEnterT:0,claimT:0,state:'idle'};
tanks.push(t);
return t;
}
// 假卡车: 15b 推挤口径 hx=1.05 / hz=3.7 (探针 _vehObsDims 对 trucks 用同一字面量)
function mkTruck(team,x,z,yaw){
const t={kind:'truck',alive:true,team,x:0,y:0,z:0,pos:V3(x,heightAt(x,z),z),yaw:yaw||0,
hp:100,maxHp:100,def:{hullL:6.5,name:'靶卡车'},halfW:1.05,
crewBot:null,playerDriven:false,claimBot:null,noEnterT:0,claimT:0,state:'idle'};
trucks.push(t);
return t;
}
// 找一块净空平地: A=(ax,az), B 在其正南 len 米处 (与 verify-botai openSpot 同款);
// 额外要求: ①A 周围 8 向 1.1m + 4 向 2.6m 都静态净空 (探针点/背向点都会踩到);
// ②全程 (A/B/中点) 高差 ≤0.8m —— 探针/推挤的 yMax=1.9 高门会在洼地里豁免车壳 (首跑实锤:
//   中点是 2m 深凹地 ⇒ 车被 y 门豁免 ⇒ 步兵穿壳), 场地必须整体平
function openSpot(len){
const lim=MAP_SIZE/2-16;
for(let i=0;i<8000;i++){
const ax=(Math.random()*2-1)*lim, az=(Math.random()*2-1)*lim;
const bx=ax, bz=az-len;
if(Math.abs(bz)>lim) continue;
const ha=heightAt(ax,az), hb=heightAt(bx,bz);
if(Math.abs(ha-hb)>0.8) continue;
const hm=heightAt(ax,az-len/2);
if(Math.abs(hm-ha)>0.8) continue;
if(occBlocked(ax,az)||occBlocked(bx,bz)||occBlocked(ax,az-len/2)) continue;
let ring=true;
for(let d=0;d<8;d++){ const a=d*Math.PI/4; if(occBlocked(ax+Math.sin(a)*1.1,az+Math.cos(a)*1.1)){ ring=false; break; } }
if(!ring) continue;
for(let d=0;d<4;d++){ const a=d*Math.PI/2; if(occBlocked(ax+Math.sin(a)*2.6,az+Math.cos(a)*2.6)){ ring=false; break; } }
if(!ring) continue;
return {ax,az,bx,bz,ha,hb};
}
return null;
}
// 在 (x0,z0) 附近找一块静态净空点 (侧向布车用): 从目标点起小步散扫, 全部 occBlocked 才放弃
function clearNear(x0,z0){
for(let r=0;r<6;r++){
for(let i=0;i<40;i++){
const a=Math.random()*Math.PI*2, d=r*0.4;
const x=x0+Math.sin(a)*d, z=z0+Math.cos(a)*d;
if(Math.abs(x)<MAP_SIZE/2-16&&Math.abs(z)<MAP_SIZE/2-16&&!occBlocked(x,z)) return {x,z};
}
}
return null;
}
function clearAll(){
for(const s of soldiers) s.alive=false; soldiers.length=0; combatants.length=0;
tanks.length=0; trucks.length=0;
try{ for(const p of planes) p.alive=false; planes.length=0; }catch(e){}
SMOKES.length=0; FLARES.length=0;
}
return {mkBot,mkTank,mkTruck,openSpot,clearNear,clearAll};
})();`;

// ═════════════════════════════════════════════════════════════
console.log('== 2026-11-12 士兵避车+排版批 沙箱探针 =='+(NEG?'  [--neg 阴性对照]':''));

section('T0/T1 载入清单 (index.html 动态对账)');
{
const onDisk=fs.readdirSync(path.join(root,'js')).sort();
assert('T1 实载脚本 >=40 个 (动态解析)', FILES.length>=40, String(FILES.length)+' 个');
assert('T1 js/ 目录无漏载 ('+onDisk.length+' 个文件)', onDisk.every(f=>FILES.indexOf('js/'+f)>=0));
}

section('T2 源码防回退 (14-bots 载具壳体探针 + 排版类在场)');
{
const s14=srcOf('js/14-bots.js');
assert('T2-a _botMoveProbe 内有载具门 + swim/onCapDeck 放行门',
 s14.includes('if(!b.swim&&!b.onCapDeck&&_vehProbeBlocked(b,px,pz)) return false;'));
assert('T2-b 脱困绕行点也过载具门',
 s14.includes('!occBlocked(dx,dz)&&!_vehProbeBlocked(this,dx,dz)&&NAV.lineClear'));
assert('T2-c OBB 单源在场 (_vehObsTest/_vehObsDims/_vehObsM=0.5, 尺寸与推挤同参注释)',
 s14.includes('function _vehObsTest(')&&s14.includes('function _vehObsDims(')&&s14.includes('_vehObsM=0.5')
 &&s14.includes('_vhObs.hx=Math.max(2.05,v.halfW||2.05)')&&s14.includes('_vhObs.hx=1.05; _vhObs.hz=3.7;'));
assert('T2-d 认领目标豁免 + yMax 高门在场',
 s14.includes("if(b.state==='toVehicle'&&b.targetVeh===v) return false;")&&s14.includes('if(b.pos.y>v.pos.y+1.9) return false;'));
assert('T2-i 外接盒粗筛随 yaw 旋转 (世界轴界 wex/wez, 横车不换位)',
 s14.includes('const wex=Math.abs(mx*cs)+Math.abs(mz*sn), wez=Math.abs(mx*sn)+Math.abs(mz*cs);'));
const ih=html;
assert('T2-e 设置卡片行类在场 (setCard/setHead/setTitle/setCtrls/setDesc)',
 ['class="setCard"','class="setHead"','class="setTitle"','class="setCtrls"','class="setDesc"'].every(c=>ih.includes(c)));
assert('T2-f 说明键位表类在场 (helpCard/helpKeys/hkRow/hkKey/hkDesc/helpPts)',
 ['class="helpCard"','class="helpKeys"','class="hkRow"','class="hkKey"','class="hkDesc"','class="helpPts"'].every(c=>ih.includes(c)));
assert('T2-g 旧排版退场: 子面板内不再有居中说明行 (class="center" style="opacity" 绝迹)',
 !ih.includes('<div class="center" style="opacity'));
const css=SRC('css/style.css');
assert('T2-h style.css 有 setCard/helpCard 键位表样式',
 css.includes('.setCard {')&&css.includes('.helpCard {')&&css.includes('.hkRow {')&&css.includes('.helpPts li::before'));
}

section('T3 坦克壳体 OBB: 探针点进壳(+0.5)=挡 / 背向·远离=放行');
{
const st=bootCtx();
assert('T3 真开局链 startBtn.onclick 无异常',st==='ok',st==='ok'?'':' '+st);
const r=run(`(()=>{try{
const out={};
__AI.clearAll();
const sp=__AI.openSpot(26); if(!sp) return {err:'openSpot null'};
const A=__AI.mkBot(0,sp.ax,sp.az,'甲');
// 坦克在 A 正南 4.2m, yaw=0 (长轴沿 Z): 纵向探针廊 = hullL/2+0.45+0.5 = 4.4m —— 车距必须 >4.4+1.1,
// 否则"背向探"的点 (车距-1.1m) 仍落在纵向廊内 (首跑 3.0m 摆位抓出: 背向点 4.1m < 4.4m 误挡)
const T=__AI.mkTank(0,sp.ax,sp.az-4.2,0,6.9,1.3);
// 朝坦克探 (探针点落在壳+0.5 内) = 挡
out.blockedToward=!_botMoveProbe(A,Math.atan2(T.pos.x-A.pos.x,T.pos.z-A.pos.z));
// 背向坦克探 = 放行
out.freeAway=_botMoveProbe(A,Math.atan2(A.pos.x-T.pos.x,A.pos.z-T.pos.z));
// 坦克挪远 (12m) = 放行 (探针点 10.9m 离车心, > 外接)
T.pos.z=sp.az-12;
out.freeFar=_botMoveProbe(A,Math.atan2(T.pos.x-A.pos.x,T.pos.z-A.pos.z));
out.err=null;
return out;
}catch(e){ return {err:String(e&&e.stack||e).slice(0,300)}; }})()`);
if(r.err){ assert('T3 坦克壳体探针行为',false,r.err); }
else{
assert('T3-a 朝坦克探 = 挡 (探针点在壳+0.5 内)',r.blockedToward===true);
assert('T3-b 背向坦克探 = 放行',r.freeAway===true);
assert('T3-c 坦克挪远 12m = 放行',r.freeFar===true);
}
}

section('T4 卡车壳体 + 轴配对 (hx=1.05 横 / hz=3.7 纵, 防轴反)');
{
const r=run(`(()=>{try{
const out={};
__AI.clearAll();
const sp=__AI.openSpot(20); if(!sp) return {err:'openSpot null'};
const A=__AI.mkBot(0,sp.ax,sp.az,'甲');
// 卡车 yaw=0: 长轴 hz=3.7 沿 Z, 短轴 hx=1.05 沿 X —— 与 15b-trucks 推挤字面量同参
const K=__AI.mkTruck(0,sp.ax,sp.az-2.2,0);
out.blockFront=!_botMoveProbe(A,Math.atan2(K.pos.x-A.pos.x,K.pos.z-A.pos.z)); // 探针点 1.1m, 落纵廊内
// 纵向挪远到 6.5m: 探针点 5.4m > hz+0.5=4.2 ⇒ 放行 (clearNear 散扫可能回退, 显式校验距离)
const q1=__AI.clearNear(sp.ax,sp.az-6.5);
if(!q1||Math.abs(q1.z-sp.az)<5.5) return {err:'clearNear(南远) 距离不足'};
K.pos.set(q1.x,heightAt(q1.x,q1.z),q1.z);
out.freeFrontFar=_botMoveProbe(A,Math.atan2(K.pos.x-A.pos.x,K.pos.z-A.pos.z));
// 侧向: 卡车挪到 A 正西 2.2m (横向 lx=dx 走短轴 1.05)
const q2=__AI.clearNear(sp.ax-2.2,sp.az);
if(!q2) return {err:'clearNear(西) null'};
K.pos.set(q2.x,heightAt(q2.x,q2.z),q2.z);
out.blockSide=!_botMoveProbe(A,Math.atan2(K.pos.x-A.pos.x,K.pos.z-A.pos.z));
// 侧向挪远到 3.4m: 探针点 2.3m > hx+0.5=1.55 ⇒ 放行 (若轴配对反了, 这里会用 hz=3.7 误判成挡)
const q3=__AI.clearNear(sp.ax-3.4,sp.az);
if(!q3||Math.abs(q3.x-sp.ax)<2.6) return {err:'clearNear(西远) 距离不足'};
K.pos.set(q3.x,heightAt(q3.x,q3.z),q3.z);
out.freeSideFar=_botMoveProbe(A,Math.atan2(K.pos.x-A.pos.x,K.pos.z-A.pos.z));
out.err=null;
return out;
}catch(e){ return {err:String(e&&e.stack||e).slice(0,300)}; }})()`);
if(r.err){ assert('T4 卡车壳体/轴配对',false,r.err); }
else{
assert('T4-a 纵向正面 2.2m 探 = 挡 (探针点在纵廊 3.7+0.5 内)',r.blockFront===true);
assert('T4-b 纵向挪远 4.5m = 放行',r.freeFrontFar===true);
assert('T4-c 侧向 2.2m 探 = 挡 (探针点 < 1.05+0.5)',r.blockSide===true);
assert('T4-d 侧向挪远 3.4m = 放行 (轴配对正向: 侧向不误用 hz)',r.freeSideFar===true);
}
}

section('T4x 横车 (yaw=HPI) 外接盒粗筛不换位 (T7 端到端实锤的侧腹放行 bug)');
{
const r=run(`(()=>{try{
const out={};
__AI.clearAll();
const sp=__AI.openSpot(20); if(!sp) return {err:'openSpot null'};
const A=__AI.mkBot(0,sp.ax,sp.az,'甲');
// 坦克横置 (yaw=HPI ⇒ 长轴沿 X): 世界 dx 走纵向廊 (hz+0.5=4.4), 世界 dz 走横向廊 (hx+0.5=2.55)。
// 判别点: 探针点世界 |dx|=2.8 ∈ (2.55,4.4) 且 |dz|=0 —— 在 OBB 内, 但旧版拿局部 mx=2.55 当
// 世界 x 界会把它误判"界外"=放行 (端到端探针里就是 ±0.55/±1.1/±1.65 全被误放行, 侧腹撞壳)。
const T=__AI.mkTank(0,sp.ax+3.9,sp.az,Math.PI/2,6.9,1.3);
out.blockSideLong=!_botMoveProbe(A,Math.PI/2);            // 朝东探: 探针点 dx=1.1-3.9=-2.8, 纵向廊内
// 挪远到 6.0m: 探针点 |dx|=4.9 > 4.4 出纵廊 ⇒ 放行 (若粗筛反着错, 这里会误挡)
T.pos.x=sp.ax+6.0;
out.freeSideLongFar=_botMoveProbe(A,Math.PI/2);
out.err=null;
return out;
}catch(e){ return {err:String(e&&e.stack||e).slice(0,300)}; }})()`);
if(r.err){ assert('T4x 横车外接盒粗筛',false,r.err); }
else{
assert('T4x-a 横车正东 3.9m 朝车探 = 挡 (探针点在纵廊 4.4 内、横廊外 —— 旧界不旋转必误放行)',r.blockSideLong===true);
assert('T4x-b 横车挪远 6.0m = 放行 (探针点出纵廊)',r.freeSideLongFar===true);
}
}

section('T5 toVehicle 认领目标豁免 (贴壳上车不被自己的探针挡住)');
{
const r=run(`(()=>{try{
const out={};
__AI.clearAll();
const sp=__AI.openSpot(20); if(!sp) return {err:'openSpot null'};
const A=__AI.mkBot(0,sp.ax,sp.az,'甲');
const T1=__AI.mkTank(0,sp.ax,sp.az-3.0,0,6.9,1.3);
const angT=Math.atan2(T1.pos.x-A.pos.x,T1.pos.z-A.pos.z);
out.blockNoClaim=!_botMoveProbe(A,angT);                 // 未认领: 挡
A.state='toVehicle'; A.targetVeh=T1;
out.freeClaimed=_botMoveProbe(A,angT);                   // 认领目标: 放行
const T2=__AI.mkTank(0,sp.ax+2.2,sp.az,0,6.9,1.3);       // 旁车 (东侧)
const q=__AI.clearNear(sp.ax+2.2,sp.az);
if(!q) return {err:'clearNear(东) null'};
T2.pos.set(q.x,heightAt(q.x,q.z),q.z);
const angO=Math.atan2(T2.pos.x-A.pos.x,T2.pos.z-A.pos.z);
out.blockOther=!_botMoveProbe(A,angO);                   // toVehicle 态下旁车仍挡
A.state='idle'; A.targetVeh=null;
out.err=null;
return out;
}catch(e){ return {err:String(e&&e.stack||e).slice(0,300)}; }})()`);
if(r.err){ assert('T5 认领豁免',false,r.err); }
else{
assert('T5-a 未认领: 朝坦克探 = 挡',r.blockNoClaim===true);
assert('T5-b state=toVehicle + 认领目标: 探 = 放行 (贴壳上车通路)',r.freeClaimed===true);
assert('T5-c toVehicle 态下朝旁车探 = 仍挡',r.blockOther===true);
}
}

section('T6 残骸也算障碍 (state=wreck 照挡)');
{
const r=run(`(()=>{try{
const out={};
__AI.clearAll();
const sp=__AI.openSpot(20); if(!sp) return {err:'openSpot null'};
const A=__AI.mkBot(0,sp.ax,sp.az,'甲');
const T=__AI.mkTank(0,sp.ax,sp.az-3.0,0,6.9,1.3);
const angT=Math.atan2(T.pos.x-A.pos.x,T.pos.z-A.pos.z);
out.blockAlive=!_botMoveProbe(A,angT);
T.state='wreck';                                          // 残骸: 不再推人, 只剩 DynCollider —— 探针仍要挡
out.blockWreck=!_botMoveProbe(A,angT);
out.err=null;
return out;
}catch(e){ return {err:String(e&&e.stack||e).slice(0,300)}; }})()`);
if(r.err){ assert('T6 残骸',false,r.err); }
else{
assert('T6-a 活车 = 挡',r.blockAlive===true);
assert('T6-b state=wreck 残骸 = 仍挡 (残骸是街口卡死最常出实体)',r.blockWreck===true);
}
}

section('T7 端到端绕行: 横在路中的坦克, 步兵直奔 26m 外目标');
{
const r=run(`(()=>{try{
const out={};
__AI.clearAll();
const LEN=26;
const sp=__AI.openSpot(LEN); if(!sp) return {err:'openSpot null'};
const A=__AI.mkBot(0,sp.ax,sp.az,'甲');
// 坦克横在路中 (路径中点), yaw=HPI ⇒ 长轴沿 X, 长面 (hz=3.9) 正对来兵 —— 抱怨场景本体
const midz=sp.az-LEN/2;
const T=__AI.mkTank(0,sp.ax,midz,Math.PI/2,6.9,1.3);
const cs=Math.cos(T.yaw), sn=Math.sin(T.yaw);
const HX=Math.max(2.05,1.3), HZ=6.9/2+0.45;
function surfDist(px,pz){ // 点到车壳 OBB 表面的有符号距离 (正=外)
const dx=px-T.pos.x, dz=pz-T.pos.z;
const lx=dx*cs-dz*sn, lz=dx*sn+dz*cs;
return Math.max(Math.abs(lx)-HX,Math.abs(lz)-HZ);
}
A.path=null; A.setPathTo(sp.bx,sp.bz);
let minSurf=1e9, entered=false;
const DT=1/60;
const bx=sp.bx, bz=sp.bz, ha=heightAt(bx,bz);
for(let k=0;k<1500;k++){
const my=A.followPath(DT);
if(my!==null) A.moveDir(my,4.2,DT);
const d=Math.hypot(A.pos.x-bx,A.pos.z-bz);
const sd=surfDist(A.pos.x,A.pos.z);
if(sd<minSurf) minSurf=sd;
if(sd<-0.45){ entered=true; break; }                      // 深入车壳 45cm+ 才算"穿壳" (绕拐角时探针点先出界, 中心可浅擦 ~0.2m —— 实测值; 旧写法直穿壳心 ≈-3.5 仍必红)
if(d<7) break;
}
out.minSurf=minSurf;
out.entered=entered;
out.past=(A.pos.z < T.pos.z-3.6);                          // 越过坦克 (yaw=HPI 时车壳 Z 向半深 = hx=2.05, 取 3.6 留绕行余量)
out.reached=Math.hypot(A.pos.x-bx,A.pos.z-bz)<9;
out.err=null;
return out;
}catch(e){ return {err:String(e&&e.stack||e).slice(0,300)}; }})()`);
if(r.err){ assert('T7 端到端绕行',false,r.err); }
else{
assert('T7-a 全程不穿壳 (深入>45cm 才算; 旧写法假坦克直穿壳心 minSurf≈-3.5 必红)',r.entered===false,'minSurf='+r.minSurf.toFixed(3)+'m');
assert('T7-b 最终越过坦克纵深 (真绕过去了, 不是原地卡死)',r.past===true);
assert('T7-c 到达目标邻域 (<9m)',r.reached===true);
}
}

section('T8 阴性对照自检 (--neg 必须出现红, 判据非空转)');
if(NEG){
assert('T8 --neg 下出现红 (本批核心判据被还原后确实翻红)',BAD.length>0,'红条目: '+BAD.length+' 条');
}else{
assert('T8 正向模式无失败',BAD.length===0,BAD.join(' · '));
}

console.log('');
console.log('== 结果: '+OK.length+' 过 / '+BAD.length+' 败 '+(NEG?'(阴性对照, 预期有红)':'')+'==');
if(!NEG&&BAD.length) process.exit(1);
if(NEG&&BAD.length===0) { console.log('✗ 阴性对照全绿 = 判据空转, 必须修复'); process.exit(1); }
process.exit(0);
