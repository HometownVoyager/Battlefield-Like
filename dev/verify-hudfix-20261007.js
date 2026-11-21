// ─────────────────────────────────────────────
// dev/verify-hudfix-20261007.js —— 2026-10-07c 批回归探针
// 背景 (实机三报): ①任意模式进随机地图整场无战斗 HUD —— 24-main 尾部残留的旧 inMenu 复核块在
//   迷你大厅直达开局 (sf_mzstart → initMenuUI 内 startGame 摘 inMenu) 之后又把 inMenu 盖回去
//   (部署页在 #ui 外照常可见能开打, #ui 里的整套战斗 HUD 被 body.inMenu #ui 压住一整局);
//   ②丧尸 solo 结算页无条件渲染两军兵力条 ("德军 330票·0在场" 无中生有) 且副标题照搬"征服·程序化战场";
//   ③新增 F1 战斗 HUD 开关 (body.hudHide)。
// 判据:
//   T1 复核块唯一 (__sfHudRepaired 恰 2 处=1块) 且先于 initMenuUI(); loop() 后无残留补挂 ——
//      阴性对照: 把旧双块文本手术植回源串, 判据必须翻红 (证明非空转);
//   T2 丧尸 solo 结算页 (行为级, 全链 boot): endSub=丧尸模式·单队生存 (无"征服"),
//      endTickets=我方行+☣丧尸行, 数字=zStats 已消灭+场上存活, 且不出现第二队伍名;
//   T3 非丧尸图结算页 (行为级): 两军兵力条照旧 (同时充当 T2 的 A/B 阴性对照);
//   T4 zStats 单源: Zombie.die 累计 / zombieMatchStart 复位;
//   T5 F1 开关源码锚: 19-input 处理块 / style.css 规则 / index.html 帮助行 (旧文案缺席=编辑落位) / i18n 词条;
//   T6 版本戳 20261122a 全量唯一 (随批升戳, 钉与 index.html/__sfStyleVer 一致)。
// 载入清单: 运行时解析 index.html (verify-zombie 同源教训: 清单与实载不一致 = 盲区假绿)。
// 用法: node dev/verify-hudfix-20261007.js
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
function boot(campIdx,zsub){
for(const k in stub.byId)delete stub.byId[k];
const ctx=vm.createContext(Object.assign({},stub.sandbox));
ctx.document=stub.document; ctx.window=stub.window; ctx.CANNON=CANNON;
ctx.setTimeout=(f)=>{ try{ f(); }catch(e){ console.log('  [异步桩] '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | ')); } return 0; };
ctx.clearTimeout=()=>{};
ctx.localStorage={_s:{sf_campaign:String(campIdx),sf_pseed:'424242',...(zsub?{sf_zsub:zsub}:{})},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of FILES) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
return ctx;
}
let pass=0,fail=0;const fails=[];
function ok(cond,label){ if(cond){pass++;console.log('  ✔ '+label);} else {fail++;fails.push(label);console.log('  ✘ '+label);} }
const src=p=>fs.readFileSync(path.join(root,p),'utf8');
function bootStart(campIdx,zsub,label){
const ctx=boot(campIdx,zsub);
const G=s=>vm.runInContext(s,ctx);
let err=null;
try{ G("document.getElementById('startBtn').onclick();"); }catch(e){ err='start: '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); }
if(!err){ try{ G('if(!player.alive||!player.deployed) deployPlayer();'); }catch(e){ err='deploy: '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); } }
ok(!err&&G('player.alive')===true,label+' 开局+部署');
if(err) console.log('     '+err);
return {ctx,G};
}
// procgen 序号
const PGIDX=(()=>{ const c0=boot(0,null); return vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="procgen")',c0); })();
// ── T1 复核块唯一且先于 initMenuUI (源码锚 + 阴性对照) ──
function t1checks(text){
const r=[];
const n=(text.match(/__sfHudRepaired/g)||[]).length;
r.push(['复核块唯一: __sfHudRepaired 恰 3 处 (=1 块: 赋值+警告行2次读; 旧双块=6 处), 实际 '+n,n===3]);
const iRep=text.indexOf('__sfHudRepaired');
const iInit=text.lastIndexOf('initMenuUI();');
r.push(['复核块在 initMenuUI() 之前 (2026-10-07b 时序红线)',iRep>=0&&iInit>=0&&iRep<iInit]);
const iBooted=text.indexOf('window.__sfBooted=true');
const tail=iBooted>=0?text.slice(iBooted):'';
r.push(['loop()/__sfBooted 之后无残留 inMenu 补挂块 (旧双块已删)',iBooted>=0&&tail.indexOf("classList.add('inMenu')")<0]);
return r;
}
console.log('── T1 24-main inMenu 复核块 (无UI根因) ──');
{
const m24=src('js/24-main.js');
const rs=t1checks(m24);
for(const [l,c] of rs) ok(c,'T1 '+l);
// 阴性对照: 把旧尾部复核块文本植回 → 三条判据必须翻红 (证明判据有分辨力, 不是恒绿)
const oldBlock=
"\n{\nconst uis=document.querySelectorAll('#ui');\n"+
"if(!document.body.classList.contains('inMenu')&&!player.deployed&&!matchOver){\n"+
"document.body.classList.add('inMenu');\nwindow.__sfHudRepaired=true;\n}\n"+
"if(uis.length!==1||window.__sfHudRepaired){\nconsole.warn('[HUD] 菜单期隐藏自检');\n}\n}\n";
const patched=m24.replace('window.__sfBooted=true;','window.__sfBooted=true;'+oldBlock);
const prs=t1checks(patched);
// 位置判据用的是首个出现位 —— 植回后真块仍在前面, 该条按设计仍绿; 计数(6≠3)与尾部残留两条必须翻红
ok(!prs[0][1]&&!prs[2][1]&&prs[1][1],'T1 阴性对照: 植回旧双块后 计数+尾部两条翻红、位置条按设计仍绿');
}
// ── T2 丧尸 solo 结算页 (行为级) ──
console.log('── T2 丧尸 solo 结算页 (endSub / endTickets) ──');
{
const {G}=bootStart(PGIDX,'solo','T2');
ok(G('ZOMBIE_MODE')==='solo','T2 前置 ZOMBIE_MODE=solo');
G('spawnZombie(30,30,"walker"); spawnZombie(34,30,"runner");');
G('zStats.killed=5;');   // 直接置账 (die 累计另有 T4 行为级)
let err=null;
try{ G('endMatch(player.team);'); }catch(e){ err='endMatch: '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); }
ok(!err,'T2 endMatch 执行无抛'+(err?' — '+err:''));
const sub=G('document.getElementById("endSub").textContent');
ok(typeof sub==='string'&&sub.indexOf('丧尸模式 · 单队生存')>=0,'T2 endSub 显示"丧尸模式 · 单队生存"');
ok(sub.indexOf('征服')<0,'T2 endSub 不再出现"征服" (procgen modeName 未漏进来)');
const tk=G('document.getElementById("endTickets").innerHTML');
const tn1=String(G('TEAM_NAME[1]'));
ok(tk.indexOf('☣')>=0&&tk.indexOf('丧尸')>=0,'T2 endTickets 有 ☣丧尸行');
ok(tk.indexOf('已消灭 5 · 场上 2')>=0,'T2 丧尸行数字=zStats已消灭5/场上存活2 (实得: '+tk.match(/已消灭[^<]*/)+' )');
ok(tk.indexOf(tn1)<0,'T2 endTickets 不出现第二队伍名"'+tn1+'" (旧版两军条无中生有)');
ok(tk.indexOf(String(G('TEAM_NAME[0]')))>=0,'T2 我方行 (TEAM_NAME[0]) 照旧显示');
ok(G('matchOver')===true,'T2 matchOver 置位');
}
// ── T3 非丧尸图结算页照旧 (兼作 T2 的 A/B 阴性对照) ──
console.log('── T3 非丧尸图结算页 (两军兵力条回归红线) ──');
{
const {G}=bootStart(0,null,'T3');
ok(G('ZOMBIE_MODE')==='' ,'T3 前置 ZOMBIE_MODE 空 (normandy)');
let err=null;
try{ G('endMatch(player.team);'); }catch(e){ err='endMatch: '+String(e&&e.stack||e).split('\n').slice(0,2).join(' | '); }
ok(!err,'T3 endMatch 执行无抛'+(err?' — '+err:''));
const tk=G('document.getElementById("endTickets").innerHTML');
ok((tk.match(/class="tRow"/g)||[]).length===2,'T3 两军兵力条 2 行照旧');
ok(tk.indexOf(String(G('TEAM_NAME[1]')))>=0,'T3 第二队伍名照旧显示 (T2 判据的分辨力对照)');
}
// ── T4 zStats 单源 (行为级) ──
console.log('── T4 zStats 计数 (die 累计 / 开局复位) ──');
{
const {G}=bootStart(PGIDX,'solo','T4');
ok(G('zStats&&zStats.killed===0'),'T4 开局 zStats.killed=0');
G('var _z=spawnZombie(40,40,"walker"); ZOMBIES.forEach(z=>{z._riseT=0;}); _z.damage(99999,{zombie:false,isPlayer:false,team:0,kills:0,score:0},false);');
ok(G('zStats.killed')===1,'T4 Zombie.die 累计 +1');   // ★2026-11-01 判据跟走: spawnZombie 自带 _riseT=1.2 起身免伤窗 (10-28a 三维门批的防同帧瞬杀设计), 探针原地击杀须先清窗 (与 verify-zombie 同款 _riseT 清窗跟走)
G('zombieMatchStart();');
ok(G('zStats.killed')===0,'T4 zombieMatchStart 复位归零');
ok(G('ZOMBIES.filter(z=>z.alive).length')>=0,'T4 场上存活数通道 (endTickets 同源) 可用');
}
// ── T5 F1 HUD 开关 (源码锚) ──
console.log('── T5 F1 战斗HUD开关 (源码锚) ──');
{
const inp=src('js/19-input.js');
ok(inp.indexOf("e.code==='F1'&&player.deployed")>=0,'T5 19-input F1 键锚 (仅已部署响应)');
ok(inp.indexOf("classList.toggle('hudHide')")>=0,'T5 开关走 body.hudHide');
ok(inp.indexOf('hudHideTip')>=0&&inp.indexOf('e.preventDefault()')>=0,'T5 提示条挂 body + 抑制浏览器帮助页');
const css=src('css/style.css');
ok(/body\.hudHide #ui, body\.hudHide #touchUI\s*\{\s*display:none !important;\s*\}/.test(css),'T5 style.css hudHide 整体隐藏规则');
const i18n=src('js/00b-i18n.js');
for(const k of ["'HUD 已隐藏 · 按 F1 恢复'","'HUD 已恢复'","'丧尸模式 · 单队生存'","'丧尸模式 · 双队对抗'","'已消灭 {0} · 场上 {1}'","'丧尸':'Zombies'"])
 ok(i18n.indexOf(k)>=0,'T5 i18n 词条 '+k);
ok(html.indexOf('<span class="hkKey" data-i18n>F1</span><span class="hkDesc" data-i18n-html>显示/隐藏战斗HUD</span>')>=0,'T5 index.html 帮助键位行含 F1 (2026-11-12 说明键位表化判据跟码)');
ok(html.indexOf('<b>Tab</b> 战场记分板</div>')<0,'T5 旧版帮助行 (无F1) 已不在 (编辑落位阴性对照)');
}
// ── T6 版本戳 ──
console.log('── T6 版本戳唯一 ──');
{
const stamps=[...html.matchAll(/v=(\d{8}[a-z]?)/g)].map(m=>m[1]);
ok(new Set(stamps).size===1&&stamps[0]==='20261122a','T6 全部引用同一版本戳 '+stamps[0]+' (共 '+stamps.length+' 处)');
}
console.log('\n合计: '+pass+' 通过 / '+fail+' 失败');
if(fails.length){ console.log('失败项:'); fails.forEach(f=>console.log('  ✗ '+f)); process.exitCode=1; }
else console.log('verify-hudfix-20261007 全部通过 ✔');
