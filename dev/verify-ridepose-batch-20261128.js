// ─────────────────────────────────────────────
// dev/verify-ridepose-batch-20261128.js —— 2026-11-28 七项批 (骑姿×票账×碾桶×巡飞×加固布娃娃×F2截图×降落伞):
//   ① 载具骑姿: 乘员蹲姿硬置 (11-soldiers hardPoseCrouch 单源, 玩家 avatar 与 Bot mesh 共用) + 六入口接线
//      (F上坦克/部署上车/登机/navalBoard/Bot enterVehicle/spawnInVehicle) + 下车还原 + 死在座记账
//      (_ridingSeat→die() _diedSeated → playerAvatarDeath 蹲姿起手快照 / 布娃娃 RAG_POSE 读 crouch=true)
//      + 坦克车毁死亡落点弹出车旁 1.5m (对齐 crewBot 口径) + 乘员枪收起/揭示还原。
//   ② 击杀账重做 (用户裁定): 坦克/飞机车体 = 3票3杀300分 (有人/空车同价); 乘员只算驾驶员 1 人 (旧
//      crewSlots/settleCrewSlotDeath 名额记账整体删除); 战报 "乘员×3"→"乘员×1"; 有人车整损 4票4杀
//      (车体3+驾驶员1), killfeed 2 行 (驾驶员行+车体行, 与飞机同构); Bot 击毁者也拿基础分。
//   ③ F2 截图: 19-input F2 分支 (deployed 门+screenshotReq) → 24-main 渲染对后消费 (canvas 合成 3D画面
//      +小地图 → toBlob → a.download 浏览器下载; 不加 preserveDrawingBuffer, 同任务内读回)。
//   ④ 油桶碾压: 坦克碾上 explosive 桶接触即爆 (无车速门, 判定前置到 _tkCylCb 两道几何早退之前 —— 桶高
//      1.1≤TANK_STEP=1.3 会被"可跨越"早退吃掉); barrelCrushBlast (05-world 单源, 复用 barrelBlast 主体,
//      attacker=null 自碾无击杀者账) 对碾压坦克 takeDmg(400,ap=true) 破甲; 工兵 B 菜单放油桶
//      (BUILD_MENU+BUILD_COST.barrel=1, engBuildExec 复用 05b-props barrel() 生成器 + RGRID 圆柱直插)。
//   ⑤+⑤.5 巡飞弹: fireLoiter 发射视角播种 player.loiterView=player.thirdPerson?1:0 (★极性: 本仓
//      loiterView=1=背追第三人称 / 0=TV, 20-player third=lz?0:p.loiterView 同源; 第三人称发射进背追,
//      第一人称发射照旧 TV, U 键飞行中切换保留) + 加速期存续 1.5× 消耗 (LOITER_BOOST_DRAIN 单源)。
//   ⑥ 布娃娃(加固) 档 (三版, 用户裁定两轮: ①加固=限制关节内部/限相对转动, 不限制整体位移; ②二版满轴距
//      全锁"过头" → 轴距收短为**软限位**): sf_deathfx 三档 ('1'就地倒下/'2'布娃娃(加固)/缺省布娃娃);
//      RAG_STIFF_CFG 单源=副锚轴距 {spine,neck,arm,leg} (真 cannon 调参台 dev/_tune-ragdoll.js 实测: d 是
//      唯一旋钮, 弯折带 20~60°; maxForce 无关); 每关节第二条 P2P 副锚 = 主锚沿部件自身 Y 轴同减 d (父子
//      同减同一局部向量 ⇒ 零初错继承), 两锚连线=肢体轴; 整体阻尼/初始冲量/maxForce 全部不动;
//      22-hud syncDf 三态循环; RAG_POSE/ST 表与 solver 不动。
//   ⑦ 降落伞: 绳顶钉伞面 (φ=1.0 球冠方程解点, 取代 rimY-0.1 悬空 0.1m) + 下端收敛点锚背包
//      (Bot root 局部 (0,1.24+3.3×0.78,-0.18); 玩家 playerChuteFollow 单源挂 scene 手算背向 + 摇摆
//      RX·RZ 解析反解补偿, 锚点摆动中恒钉背包不荡)。
// 用法: node dev/verify-ridepose-batch-20261128.js [--neg]
// 判据:
//   T0 源码锚 (七任务全量) + T1-T11 行为断言 (真开局沙箱)。
//   --neg (九补丁, 红名↔补丁): N1 骑姿硬置拆(两调用点)→T0a/T1c / N2 玩家上车蹲姿拆→T0b(+T4e/T4f 连带) /
//      N3 死在座记账拆→T0d/T4c / N4 落点弹出拆→T0e/T4b / N5 车体杀拆→T0f/T2c/T3a/T3b / N6 碾压伤拆→T5b/T5d /
//      N7 播种拆→T7b / N8 加固副锚拆→T9c/T9g / N9 伞锚拆→T0-⑦4。
// 沙箱要点承 verify-specpose-hudresidue-20261122 (受控时钟 __step 直驱 loop()/listeners 捕获/CANNON 桩)
// 与 verify-tankai (spawnInVehicle 直调)、verify-ragdoll2 (RAG.list 直读, 桩上 spawnRagdoll 可完整成账)。
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
Box:class{},Sphere:class{},Material:class{},ContactMaterial:class{},NaiveBroadphase:class{},
// ★批⑥二版 T9g: 桩存 pivotA/pivotB (与真 cannon PointToPointConstraint 同名字段) ⇒ 副锚几何可行为断言
PointToPointConstraint:class{constructor(a,pa,b,pb){this.bodyA=a;this.pivotA=pa;this.bodyB=b;this.pivotB=pb;}},
};})();

const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const FILES=[...html.matchAll(/src="(js\/[^"?]+)/g)].map(m=>m[1]);
console.log('载入清单: 解析 index.html 得 '+FILES.length+' 个脚本');

// ── NEG 阴性对照: 九补丁 (正常跑不启用) ──
const NEG=process.argv.includes('--neg');
const SRC={},PATCH_MAP={};
const NEG_PATCHES=[
// N1 骑姿硬置拆 (14-bots enterVehicle/spawnInVehicle 两调用点): 车组不再蹲姿硬置 ⇒ T1c 红 (pelvis 0.94 站姿) + T0a 红
// (★单行锚: 14-bots 是 CRLF, 带换行的 from 永远匹配不上 — 见 tiltfall 批 CRLF NEG 锚坑)
['js/14-bots.js','hardPoseCrouch(this.mesh);',''],
// N2 玩家上车蹲姿拆 (20-player F 上坦克): 蹲姿旗/座位旗不置 ⇒ T3a 红 (crouch=false) + T0b 红
['js/20-player.js','player._crouchSaved=player.crouch; player.crouch=true; player._ridingSeat=true;','player._crouchSaved=false; player.crouch=false;'],
// N3 死在座记账拆 (18-game die): _diedSeated 恒 false ⇒ T4c 红 (蹲姿重断言不生效) + T0d 红
['js/18-game.js','this._diedSeated=!!this._ridingSeat;','this._diedSeated=false;'],
// N4 死亡落点弹出拆 (15-vehicles Tank.die 玩家死亡分支): 尸体埋在车体里 ⇒ T4b 红 (落点=车心) + T0e 红
['js/15-vehicles.js','player.pos.set(this.pos.x+Math.sin(this.yaw)*1.5,this.pos.y,this.pos.z+Math.cos(this.yaw)*1.5);',''],
// N5 车体杀拆 (15-vehicles credit 块): 车体不再 +3 杀 ⇒ T2g 红 (Δkills=1 只剩驾驶员) + T0f 红
['js/15-vehicles.js','attacker.kills=(attacker.kills||0)+TICKET_COST.tank;',''],
// N6 碾压伤拆 (05-world barrelCrushBlast): 桶照爆但坦克不掉血 ⇒ T5b 红
['js/05-world.js','if(ok&&veh&&typeof veh.takeDmg===\'function\') veh.takeDmg(BARREL.crushVehDmg,null,true);',''],
// N7 发射视角播种拆 (13-combat fireLoiter): 回恒 TV ⇒ T7b 红 (thirdPerson 发射仍 loiterView=0)
['js/13-combat.js','player.loiterView=player.thirdPerson?1:0;','player.loiterView=0;'],
// N8 加固副锚拆 (12-ragdolls secP): 副锚不再入账 ⇒ T9c 红 (cons=6) + T9g 红 (副锚 pivot 缺失)
['js/12-ragdolls.js','const secP=(A,a1,B,b1,d)=>cons.push(P2P(A,[a1[0],a1[1]-d,a1[2]],B,[b1[0],b1[1]-d,b1[2]]));','const secP=(A,a1,B,b1,d)=>0;'],
// N9 伞锚拆 (14-bots 伞降分支): 收敛点回贴地两脚间 ⇒ T0m 红
['js/14-bots.js','this.chuteMesh.position.set(0,1.24+3.3*0.78,-0.18);','this.chuteMesh.position.set(0,2.5,0);'],
];
if(NEG) for(const [f,from,to] of NEG_PATCHES){
if(SRC[f]===undefined) SRC[f]=fs.readFileSync(path.join(root,f),'utf8');
if(SRC[f].indexOf(from)<0){ console.log('✗ NEG 锚缺失: '+f+' :: '+JSON.stringify(from.slice(0,60))); process.exit(1); }
PATCH_MAP[f]=(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC[f]).split(from).join(to);
}
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:fs.readFileSync(path.join(root,f),'utf8'));

function boot(campIdx){
for(const k in stub.byId)delete stub.byId[k];
const ctx=vm.createContext(Object.assign({},stub.sandbox));
const listeners={};
const addL=(t,f)=>{ (listeners[t]=listeners[t]||[]).push(f); };
ctx.addEventListener=addL;
ctx.document=Object.assign({},stub.document,{addEventListener:addL,removeEventListener(){}});
ctx.window=Object.assign({},stub.window,{addEventListener:addL,removeEventListener(){}});
ctx.dispatchEvent=ev=>{ if(!ev.preventDefault) ev.preventDefault=()=>{}; if(!ev.stopPropagation) ev.stopPropagation=()=>{}; for(const f of (listeners[ev.type]||[]).slice()) f(ev); return true; };
ctx.KeyboardEvent=class{ constructor(t,o){ o=o||{}; this.type=t; this.code=o.code; this.repeat=!!o.repeat; } };
ctx.MouseEvent=class{ constructor(t,o){ o=o||{}; this.type=t; this.button=o.button; } };
ctx.CANNON=CANNON;
ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
ctx.__T=1000;
ctx.performance={now:()=>ctx.__T};
for(const f of FILES) vm.runInContext(srcOf(f),ctx,{filename:f});
vm.runInContext('var __step=(n)=>{ for(let i=0;i<n;i++){ __T+=16.7; loop(); } };',ctx);
return ctx;
}
const PASS=[];let FAILN=0;
function ok(cond,label){
if(cond){ PASS.push(label); console.log('  ✔ '+label); }
else { FAILN++; console.log((NEG?'  ● [期望红] ':'  ✘ ')+label); }
}
let IDXS=1; { const c0=boot(0); IDXS=vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="stalingrad")',c0); }
const ctx=boot(IDXS);
const G=s=>vm.runInContext(s,ctx);
let err0=null;
try{ G("document.getElementById('startBtn').onclick();"); }catch(e){ err0=String(e&&e.stack||e); }
if(!err0){ try{ G('if(!player.alive||!player.deployed) deployPlayer();'); }catch(e){ err0='deployPlayer: '+String(e&&e.stack||e); } }
if(err0||!G('player.alive')){ console.log('  ✘ 开局/部署失败 '+(err0||'player.alive=false')); process.exit(1); }
ok(html.includes("__sfStyleVer='20261128e'"),'前置: 版本戳 20261128e 在位 (index.html 内联)');

// ══ T0 源码锚 (七任务全量) ══
console.log('T0 源码锚');
const s11=srcOf('js/11-soldiers.js'),s14=srcOf('js/14-bots.js'),s15=srcOf('js/15-vehicles.js'),s16=srcOf('js/16-aircraft.js'),
s18=srcOf('js/18-game.js'),s19=srcOf('js/19-input.js'),s20=srcOf('js/20-player.js'),s20a=srcOf('js/20a-seats.js'),
s23=srcOf('js/23-deploy.js'),s05=srcOf('js/05-world.js'),s06=srcOf('js/06-engineering.js'),s13=srcOf('js/13-combat.js'),
s12=srcOf('js/12-ragdolls.js'),s22=srcOf('js/22-hud.js'),s00=srcOf('js/00-config.js'),i18=srcOf('js/00b-i18n.js'),
s24=srcOf('js/24-main.js');
// ① 骑姿
ok(s11.includes('function hardPoseCrouch(av){')&&s11.includes('av.pelvis.position.y=0.60;')&&s11.includes('const L=legIKPose(0.60,0.13,0.16,false), pp=0.14;'),'T0-① hardPoseCrouch 单源 (11-soldiers: 蹲姿静止档逐字 + legIKPose 反解)');
ok(s14.includes('this._crouchSaved=this.crouch; this.crouch=true; this.prone=false; this.bandageT=0;')&&s14.includes('hardPoseCrouch(this.mesh);')&&s14.includes('if(this.gun) this.gun.visible=false;'),'T0a ★enterVehicle 骑乘蹲姿硬置+枪收起 (14-bots)');
ok(s14.includes('this.hp=100; this.alive=true; this.crouch=true; this.prone=false; this._crouchSaved=false;'),'T0a2 spawnInVehicle 蹲姿旗直置 (14-bots)');
ok(s14.includes('this.crouch=this._crouchSaved||false; this._crouchSaved=false;')&&s14.includes('if(this.gun) this.gun.visible=true;'),'T0a3 dismountVehicle 还原骑乘前档+枪归位 (14-bots)');
ok(s20.includes('player._crouchSaved=player.crouch; player.crouch=true; player._ridingSeat=true;'),'T0b ★玩家 F 上坦克蹲姿旗+座位旗 (20-player)');
ok(s20.includes('player.crouch=player._crouchSaved||false; player._crouchSaved=false; player._ridingSeat=false;'),'T0b2 玩家下车/离机还原 (20-player F 块)');
ok(s20a.includes('p._crouchSaved=p.crouch; p.crouch=true; p._ridingSeat=true;')&&s20a.includes('p.crouch=p._crouchSaved||false; p._crouchSaved=false; p._ridingSeat=false;'),'T0b3 navalBoard 上艇蹲姿/navalSeatRelease 下艇还原 (20a-seats)');
ok(s23.includes('p._crouchSaved=p.crouch; p.crouch=true; p._ridingSeat=true;'),'T0b4 部署上车/登机蹲姿旗 (23-deploy)');
ok(s18.includes('this._diedSeated=!!this._ridingSeat;')&&s18.includes('this._ridingSeat=false;')&&s18.includes('if(this._diedSeated) this.crouch=true;'),'T0d ★die() 死在座记账+座位清账后蹲姿重断言 (18-game)');
ok(s20.includes("if(p._diedSeated&&typeof hardPoseCrouch==='function') hardPoseCrouch(av);"),'T0c playerAvatarDeath 死在座首帧蹲姿起手快照 (20-player)');
ok(s15.includes('player.pos.set(this.pos.x+Math.sin(this.yaw)*1.5,this.pos.y,this.pos.z+Math.cos(this.yaw)*1.5);')&&s15.includes('if(cb.gun) cb.gun.visible=true;'),'T0e ★Tank.die 玩家死亡落点弹出车旁 1.5m + 揭示枪还原 (15-vehicles)');
// ② 票账
ok(s00.includes('tank:300,plane:300,')&&s00.includes('const CREW_N=1;'),'T0f2 SCORE_TABLE.plane=300 + CREW_N=1 (00-config)');
ok(s15.includes('return drv?[drv]:[];')&&s15.includes('attacker.kills=(attacker.kills||0)+TICKET_COST.tank;')&&s15.includes('else attacker.score=(attacker.score||0)+SCORE_TABLE.tank;'),'T0f ★crewRoster=驾驶员1人 + 车体3杀 + Bot 击毁者基础分 (15-vehicles)');
ok(!s15.includes('this.crewSlots=[')&&!s15.includes('function settleCrewSlotDeath'),'T0f3 旧名额记账绝迹 (负向: crewSlots 数组/settleCrewSlotDeath 函数)');
ok(s16.includes('attacker.kills=(attacker.kills||0)+TICKET_COST.plane;'),'T0f4 Plane.die 机体杀=3 (16-aircraft)');
ok(i18.includes("'乘员×1':'crew ×1'")&&!i18.includes("'乘员×3':'crew ×3'"),'T0f5 词典 乘员×1 (旧 乘员×3 词条绝迹)');
// ③ F2
ok(s19.includes('let screenshotReq=false;')&&s19.includes("e.code==='F2'")&&s19.includes('screenshotReq=true;'),'T0-③ F2 分支+screenshotReq 全局 (19-input)');
ok(s24.includes('let _shotCv=null;')&&s24.includes('toBlob')&&s24.includes("'battlefield-"),'T0-③2 截图消费块 (24-main: 离屏canvas+toBlob 下载)');
ok((html.match(/截图：画面\+小地图存入下载/g)||[]).length===2,'T0-③3 键位表 F2 行×2 (index.html 两张表)');
ok(i18.includes("'截图：画面+小地图存入下载':'Screenshot: view + minimap saved to downloads'"),'T0-③4 截图说明词条 (00b-i18n)');
// ④ 碾桶
ok(s05.includes('function barrelCrushBlast(x,z,veh){')&&s05.includes('veh.takeDmg(BARREL.crushVehDmg,null,true);'),'T0-④ barrelCrushBlast 单源+破甲伤 (05-world)');
ok(s00.includes('crushVehDmg:400};'),'T0-④2 BARREL.crushVehDmg=400 (00-config)');
ok(s15.includes('if(c&&!c.dead&&c.explosive){')&&s15.includes('barrelCrushBlast(c.x,c.z,T);'),'T0-④3 _tkCylCb 接触即爆前置 (15-vehicles, 早退之前)');
ok(s06.includes("const BUILD_MENU=['sandbag','wire','hedge','mg','medkit','barrel'];")&&s06.includes('barrel:1,tower:3,ammoc:2};')&&s06.includes("else if(tk.type==='barrel'){")&&s06.includes('if(built) rgridAddLastCyl();')&&s06.includes('function rgridAddLastCyl(){'),'T0-④4 工兵油桶件 (06-engineering: 菜单/造价/执行/RGRID 直插 — ★20261128d 直插抽 rgridAddLastCyl 单源, 拒马共用)');
ok(s05.includes('function barrelBlast(c,attacker){')&&s05.includes('killCyl(c);'),'T0-④5 barrelBlast 主体回归钉 (复用不复刻)');
// ⑤ 巡飞
ok(s13.includes('player.loiterView=player.thirdPerson?1:0;'),'T0-⑤ 发射视角播种 thirdPerson?1:0 (13-combat; ★极性 1=背追)');
ok(s13.includes('d.life-=ldt*(boost?LOITER_BOOST_DRAIN:1);')&&s00.includes('const LOITER_BOOST_DRAIN=1.5;'),'T0-⑤2 加速 1.5× 耗条 (13-combat + LOITER_BOOST_DRAIN 单源)');
ok(s22.includes("t(fall?'就地倒下':(stiff?'布娃娃(加固)':'布娃娃'))")||s22.includes("布娃娃(加固)"),'T0-⑥ syncDf 三态循环 (22-hud)');
ok(s12.includes('const RAG_STIFF_CFG={spine:0.10, neck:0.08, arm:0.09, leg:0.12};')&&s12.includes("const stiff=(typeof deathRagStiff==='function')&&deathRagStiff();")&&s12.includes('const secP=(A,a1,B,b1,d)=>cons.push(P2P(A,[a1[0],a1[1]-d,a1[2]],B,[b1[0],b1[1]-d,b1[2]]));')&&!s12.includes('impMul')&&!s12.includes('avMul')&&!s12.includes('RAG_STIFF_CFG.maxForce')&&!s12.includes('RAG_STIFF_CFG.angDamp')&&!s12.includes('if(stiff){ body.angularDamping'),'T0-⑥2 ★RAG_STIFF_CFG 单源(副锚轴距=软限位旋钮)+stiff 判读+secP 副锚 push; 整体收紧绝迹 (负向: impMul/avMul/maxForce/angDamp — 2026-11-28 三版用户裁定: 软限位 20~60°, 不限整体位移)');
ok(s12.includes('cons=[P2P(torso,[0,-0.26,0],pelvis,[0,0.13,0]),P2P(head,[0,-0.13,0],torso,[0,0.27,0]),P2P(armL,[0,0.24,0],torso,[-ST.armX,0.2,0]),P2P(armR,[0,0.24,0],torso,[ST.armX,0.2,0]),P2P(legL,[0,0.47,0],pelvis,[-ST.legX,0,0]),P2P(legR,[0,0.47,0],pelvis,[ST.legX,0,0])];'),'T0-⑥3 主锚六条 verbatim 回归钉 (ragdoll2 既有锚, 加固只追加不动主锚)');
ok(s00.includes('function deathRagStiff(){')&&s00.includes("localStorage.getItem('sf_deathfx')==='2'"),'T0-⑥4 deathRagStiff 三档判读 (00-config)');
ok(html.includes('布娃娃(加固)＝仍是布娃娃'),'T0-⑥5 设置卡三档说明 (index.html)');
// ⑦ 降落伞
ok(s20.includes('const attP=1.0, attR=2.3*Math.sin(attP), attY=2.3*Math.cos(attP)*0.75;')&&s20.includes('chuteLine(g,V3(Math.sin(a)*attR,attY,Math.cos(a)*attR),V3(0,-3.3,0),lm);'),'T0-⑦ 绳顶钉伞面 (20-player mkChute 球冠方程解点)');
ok(!s20.includes('chuteLine(g,V3(Math.sin(a)*rim,rimY-0.1'),'T0-⑦2 旧悬空绳顶绝迹 (负向: 旧 chuteLine rimY-0.1 行)');
ok(s20.includes('function playerChuteFollow(nowT){')&&(s20.match(/playerChuteFollow\(nowT\);/g)||[]).length===2&&!s20.includes('playerChuteMesh.position.set(p.pos.x,p.pos.y+3.8,p.pos.z);'),'T0-⑦3 playerChuteFollow 单源双调用点 (旧 position.set 绝迹)');
ok(s14.includes('this.chuteMesh.position.set(0,1.24+3.3*0.78,-0.18);'),'T0-⑦4 Bot 伞收敛点钉背包 (14-bots root 局部)');

// ══ T1 Bot 上车骑乘蹲姿 ══
console.log('T1 Bot 骑乘蹲姿 (enterVehicle 硬置)');
G(`
// 开局每车都配了 crewBot ⇒ 无闲置车可拿 (23-deploy 编制契约) —— 探针自建 Tank (verify-tankai 同款)
var __t1t=new Tank(player.team,0);
var __t1b=null; for(const s of soldiers){ if(s.alive&&!s.onVehicle&&!s.onNaval&&!s.zombie){ __t1b=s; break; } }
var __t1ok=!!(__t1t&&__t1b);
if(__t1ok){ __t1b.spawnInVehicle(__t1t); }
`);
ok(G('__t1ok')===true,'T1-prep 拿到闲置坦克+自由 Bot (真开局编制)');
ok(G('__t1b.crouch')===true,'T1a spawnInVehicle 蹲姿旗直置');
ok(Math.abs(G('__t1b.mesh.pelvis.position.y')-0.60)<0.01,'T1c ★乘员蹲姿硬置 (pelvis y=0.60, 改前=0.94 站姿)');
ok(G('__t1b.mesh.root.visible')===false,'T1d 乘员期本体隐藏 (既有口径)');
ok(G('__t1b.gun')===null||G('__t1b.gun.visible')===false,'T1e 乘员枪收起');

// ══ T2 有人坦克车毁账 (②+①死在座 Bot 侧) ══
console.log('T2 有人坦克车毁: 车体3+驾驶员1 票/杀/分, 战报2行, 阵亡落点弹出1.5m');
G(`
var __t2t=__t1t, __t2b=__t1b;
// 车爆会步兵溅射 ⇒ 先把无关兵员搬到远角 (否则溅射连带击杀污染 Δ杀/Δ战报断言)
var __t2atk=null;
for(const s of soldiers){ if(s.team!==__t2t.team&&!s.zombie&&!s.onVehicle&&!s.onNaval&&s.alive){ if(!__t2atk) __t2atk=s; else s.pos.set(__t2t.pos.x+400,__t2t.pos.y,__t2t.pos.z+400); } }
for(const s of soldiers){ if(s.team===__t2t.team&&s!==__t2b&&s.alive) s.pos.set(__t2t.pos.x+400,__t2t.pos.y,__t2t.pos.z-400); }
__t2t.pos.set(0,heightAt(0,0),0); __t2b.pos.copy(__t2t.pos); __t2atk.pos.set(__t2t.pos.x+30,heightAt(__t2t.pos.x+30,__t2t.pos.z),__t2t.pos.z);
var __t2={tk0:tickets[__t2t.team],k0:(__t2atk.kills||0),s0:(__t2atk.score||0),
kf0:document.getElementById('killfeed').children.length,ok:!!__t2atk};
if(__t2.ok){ localStorage.setItem('sf_deathfx','1'); __t2t.die(__t2atk); }
`);
ok(G('__t2.ok')===true,'T2-prep 敌方击杀者就位');
ok(G('__t2t.alive')===false&&G('__t2b.alive')===false,'T2a 车毁+驾驶员阵亡');
G('__t2.tk1=tickets[__t2t.team];');
ok(G('__t2.tk0')-G('__t2.tk1')===4,'T2b ★Δ票 = -4 (车体3+驾驶员1; 旧口径有人车-6/名额制)');
G(`
var __t2m={k:-9,s:-9,kf:-9,dx:0,dz:0,cr:false,feed:''};
if(__t2.ok){
__t2m={k:( __t2atk.kills||0)-__t2.k0, s:(__t2atk.score||0)-__t2.s0, kf:document.getElementById('killfeed').children.length-__t2.kf0,
dx:__t2b.pos.x-__t2t.pos.x, dz:__t2b.pos.z-__t2t.pos.z, cr:__t2b.crouch, feed:''};
const kf=document.getElementById('killfeed'); for(const c of kf.children) __t2m.feed+=c.innerHTML;   // 桩元素 textContent 不解析 innerHTML ⇒ 读 innerHTML
}
`);
ok(G('__t2m.k')===4,'T2c ★Δ杀 = +4 (车体3+驾驶员1; 旧口径车体不记杀)');
ok(G('__t2m.s')===400,'T2d Bot 击毁者得分 = 300 (车体) + 100 (驾驶员) — Bot 也拿基础分 (旧版只 isPlayer 分支)');
ok(G('__t2m.kf')===2,'T2e ★战报 2 行 (驾驶员独立行 + 车体行, 与飞机同构; 旧口径驾驶员行被 _noFeed 压掉)');
ok((G('__t2m.feed').indexOf('乘员×1')>=0||G('__t2m.feed').indexOf('crew ×1')>=0)&&G('__t2m.feed').indexOf('乘员×3')<0&&G('__t2m.feed').indexOf('crew ×3')<0,'T2f 战报乘员数=×1 (zh 乘员×1 / en crew ×1 双形制; 旧 ×3 词条绝迹)');
ok(Math.abs(Math.hypot(G('__t2m.dx'),G('__t2m.dz'))-1.5)<0.25,'T2g 阵亡落点弹出车旁 1.5m (沿车体轴线, crewBot 同口径)');
ok(G('__t2m.cr')===true,'T2h 死在座 crouch 旗保持 true (布娃娃 RAG_POSE 蹲档/倒地展腿起手)');

// ══ T3 空坦克车毁账 (②) ══
console.log('T3 空坦克车毁: 3票3杀, 战报1行无乘员数');
G(`
var __t3t=new Tank(player.team,0);
var __t3atk=null; for(const s of soldiers){ if(s.alive&&s.team!==__t3t.team&&!s.zombie&&!s.onVehicle&&!s.onNaval){ __t3atk=s; break; } }
var __t3={tk0:tickets[__t3t.team],k0:(__t3atk.kills||0),kf0:document.getElementById('killfeed').children.length,ok:!!(__t3t&&__t3atk)};
if(__t3.ok){ __t3t.pos.set(60,heightAt(60,60),60); for(const s of soldiers){ if(s!==__t3atk&&s.alive) s.pos.set(__t3t.pos.x-400,__t3t.pos.y,__t3t.pos.z+400); } __t3atk.pos.set(__t3t.pos.x+30,heightAt(__t3t.pos.x+30,__t3t.pos.z),__t3t.pos.z); __t3t.die(__t3atk); }
var __t3m={k:-9,kf:-9,feed:'',tkd:0};
if(__t3.ok){
__t3m={k:( __t3atk.kills||0)-__t3.k0, kf:document.getElementById('killfeed').children.length-__t3.kf0, feed:'', tkd:tickets[__t3t.team]-__t3.tk0};
// 只取本批新增行 (prepend ⇒ 新行在 children 头部; killfeed 保留 6 行, T2 的旧行仍在场 = 负向断言会误伤)
const kf3=document.getElementById('killfeed'); for(let i=0;i<__t3m.kf&&i<kf3.children.length;i++) __t3m.feed+=kf3.children[i].innerHTML;
}
{ const kf=document.getElementById('killfeed'); for(const c of kf.children) __t3m.feed+=c.textContent; }
`);
ok(G('__t3.ok')===true,'T3-prep 空坦克+击杀者就位');
ok(G('__t3m.tkd')===-3,'T3a ★空车 Δ票 = -3 (车体装备票, 有人/空车同价口径)');
ok(G('__t3m.k')===3,'T3b 空车 Δ杀 = +3 (车体杀=车体票, 旧口径空车 0 杀)');
ok(G('__t3m.kf')===1,'T3c 空车战报 1 行 (无乘员数; 2026-09-26 口径保持)');
ok(G('__t3m.feed').indexOf('乘员×1')<0&&G('__t3m.feed').indexOf('crew ×1')<0,'T3d 空车战报不吹乘员数 (负向, 双形制)');

// ══ T4 玩家死在坦克 (①死亡呈现: 落点弹出+蹲姿起手快照) ══
console.log('T4 玩家死在座: 就地倒下档从骑乘蹲姿倒地');
G(`
var __t4t=new Tank(player.team,0);
var __t4atk=null; for(const s of soldiers){ if(s.alive&&s.team!==player.team&&!s.zombie&&!s.onVehicle&&!s.onNaval){ __t4atk=s; break; } }
var __t4={ok:!!(__t4t&&__t4atk)};
if(__t4.ok){
// 直写上车 (与 F 派发同一座位字段落点; F 链含准星锁定/读条门, 沙箱直写等价且稳)
player._crouchSaved=false; player.crouch=true; player._ridingSeat=true; player.onVehicle=__t4t;
player.protUntil=0;   // 清出生保护 (落地 0.5s 敌方来源免伤, 2026-09-28 批) —— 否则 damage(999) 被吞, 死亡链不走
__t4t.playerDriven=true; __t4t.isAI=false;
__t4t.pos.set(-60,heightAt(-60,-60),-60); player.pos.copy(__t4t.pos);
for(const s of soldiers){ if(s!==__t4atk&&s.alive) s.pos.set(__t4t.pos.x+400,__t4t.pos.y,__t4t.pos.z+400); }
__t4atk.pos.set(__t4t.pos.x+30,heightAt(__t4t.pos.x+30,__t4t.pos.z),__t4t.pos.z);
localStorage.setItem('sf_deathfx','1');   // 就地倒下档 (playerAvatarDeath 蹲姿快照链)
}
`);
ok(G('__t4.ok')===true,'T4-prep 玩家上坦克 (蹲姿旗+座位旗)');
G('if(__t4.ok) __t4t.die(__t4atk);');
ok(G('player.alive')===false,'T4a 车毁玩家走死亡链 (AUTO_EXIT 缺省关)');
ok(G('player._diedSeated')===true,'T4c ★die() 死在座记账 (_ridingSeat 旗, Tank.die 已先清 onVehicle 字段也不漏)');
ok(G('player.crouch')===true,'T4d 座位清账后蹲姿重断言 (navalSeatRelease 还原链不吃掉蹲姿)');
G(`
var __t4m={dx:0,dz:0};
if(__t4.ok){ __t4m={dx:player.pos.x-__t4t.pos.x, dz:player.pos.z-__t4t.pos.z}; }
__step(4);
var __av=(typeof playerAvatar!=='undefined'&&playerAvatar)?playerAvatar:null;
var __t4m2={py:(__av&&player._dfPose)?player._dfPose.py:-9, pel:(__av&&__av.pelvis)?__av.pelvis.position.y:-9};
`);
ok(Math.abs(Math.hypot(G('__t4m.dx'),G('__t4m.dz'))-1.5)<0.25,'T4b ★死亡落点弹出车旁 1.5m (相机/尸体不再埋在车体里)');
ok(Math.abs(G('__t4m2.py')-0.60)<0.02,'T4e ★_dfPose 快照 py≈0.60 (骑乘蹲姿起手; 改前=0.94 立正倒下)');
ok(G('__t4m2.pel')>0.21&&G('__t4m2.pel')<=0.61,'T4f 倒地插值进行中 (骨盆 0.60→0.22, f3efdc7 k² 曲线)');
ok(G('playerAvatar')===null||G('playerAvatar.root.visible')===true,'T4g 死亡环绕段本体可见 (2026-11-22 喂帧行回归钉)');

// ══ T5 坦克碾油桶 (④a) ══
console.log('T5 碾压殉爆: 接触即爆+破甲400+自碾无击杀者账');
G(`
var __t5t=new Tank(1,0);   // 敌方车 (与玩家队分开, 溅射不碰玩家; 自碾 attacker=null 无杀账)
var __t5={ok:!!__t5t};
if(__t5.ok){
__t5t.pos.set(90,heightAt(90,90),90);
for(const s of soldiers){ if(s.alive) s.pos.set(__t5t.pos.x+400,__t5t.pos.y,__t5t.pos.z+400); }
// 选点改"搜空位" (2026-11-28: 随机图布局不可复现, 固定坐标 propFree 闸偶发被占 ⇒ 假红; barrel()
// propFree 失败静默早退不入 CYLS, 以 CYLS 增量判落成, 失败位不留 propTake 不污染后续候选)
var __t5cy0=CYLS.length, __t5gx=0, __t5gz=0;
outerA: for(var __r5a=0.9;__r5a<=9;__r5a+=1.5){ for(var __a5a=0;__a5a<8;__a5a++){
var __ax=__t5t.pos.x+__r5a*Math.cos(__a5a*Math.PI/4), __az=__t5t.pos.z+__r5a*Math.sin(__a5a*Math.PI/4);
var __l=CYLS.length; barrel(__ax,__az);   // 05b-props 真生成器 (propFree 闸+CYLS.push explosive)
if(CYLS.length>__l){ __t5gx=__ax; __t5gz=__az; break outerA; } } }
var __t5c=CYLS[CYLS.length-1];
__t5.barrelOk=!!(__t5c&&__t5c.explosive&&__t5gx!==0);
__t5.hp0=__t5t.hp;
if(__t5.barrelOk) barrelCrushBlast(__t5gx,__t5gz,__t5t);
__t5.dead=__t5c.dead===true; __t5.hp1=__t5t.hp;
}
`);
ok(G('__t5.ok')===true&&G('__t5.barrelOk')===true,'T5-prep 生成真油桶 (05b-props barrel(), CYLS explosive)');
ok(G('__t5.dead')===true,'T5a 桶被引爆 (killCyl 置旗, barrelBlast 主体)');
const __t5d=G('__t5.hp0')-G('__t5.hp1');
ok(__t5d>=400&&__t5d<=465,'T5b ★碾压坦克 Δhp ≥400 破甲直伤 (ap=true 绕 TANK_ARMOR) + 溅射载具圈 ≤60 余量 (splashDamage dmgVeh=60, 3.4m 圈含碾压车, 既有口径)');
// 集成: 坦克 update 的 _tkCylCb 前置分支 (桶高 1.1 早退之前)
G(`
var __t5i={ok:false};
if(__t5.ok&&__t5t.alive){
// 全新落点 (旧桶 propTake 占位圈会让贴邻生成静默 no-op, CYLS[last] 取到旧死桶 = 假阳)。
// 桶走**工兵路径**落成 (engBuildExec: barrel()+RGRID 圆柱直插) —— 坦克扫掠的 eachCylNear 读 RGRID,
// 裸 barrel() 不入倒排表 = 扫掠看不见 (这正是 T6c 断言的坑, 这里顺带验证"工兵桶碾得爆"用户故事)。
// 选点同 T5-prep"搜空位" (随机图布局不可复现; engBuildExec 失败不扣建造点, 重试无代价)。
__t5t.pos.set(160,heightAt(160,160),160);
player.alive=true; player.hp=100; player.deployed=true; player.buildCount=5;
player.pos.set(30,standHeight(30,30,10),30);
var __t5cy0=CYLS.length, __t5bx=0, __t5bz=0;
outer5: for(var __r5=1;__r5<=14;__r5+=1.5){ for(var __a5=0;__a5<12;__a5++){
var __ax=160+__r5*Math.cos(__a5*Math.PI/6), __az=160+__r5*Math.sin(__a5*Math.PI/6);
player.pendingBuild={type:'barrel',tx:__ax,tz:__az,ry:0,cost:BUILD_COST.barrel,zp:0};
engBuildExec(player);
if(CYLS.length>__t5cy0){ __t5bx=__ax; __t5bz=__az; break outer5; } } }
var __t5c2=CYLS[CYLS.length-1];
var __t5barrelOK=!!(__t5c2&&__t5c2.explosive&&!__t5c2.dead&&__t5bx!==0);
var __t5hp2=__t5t.hp;
for(var __t5k=0;__t5k<80&&!__t5c2.dead;__t5k++){ __t5t.vel=8; __t5t.yaw=Math.atan2(__t5bx-__t5t.pos.x,__t5bz-__t5t.pos.z); __t5t.update(0.05); }   // 直驶桶位 (vel 直写: Tank.update 不读 keys, 玩家驱动档的 vel 在 20a-seats updatePlayerTank)
__t5i={ok:__t5barrelOK&&__t5c2.dead===true, dhp:__t5hp2-__t5t.hp, steps:__t5k, tx:__t5t.pos.x, alive:__t5t.alive};
}
`);
ok(G('__t5i.ok')===true,'T5c ★集成: 工兵桶+坦克开过桶位 → _tkCylCb 接触即爆 (判定在 TANK_STEP 可跨越早退之前)');
{const __t5dd=G('__t5i.dhp'); ok(__t5dd>=400&&__t5dd<=465,'T5d 集成 Δhp≥400 (碾爆破甲直伤 + 溅射载具圈 ≤60 余量; 上限同 T5b)');}

// ══ T6 工兵放油桶 (④b) ══
console.log('T6 工兵 B 菜单放油桶: CYLS+1 + RGRID 直插 + 建造点扣减');
G(`
var __t6={ok:false};
player.alive=true; player.hp=100; player.deployed=true;   // T4 已走死亡链 ⇒ 复位 (engBuildExec 有 pl.alive 门)
player.onVehicle=null; player.onNaval=null; player.specViewHost=null;
player.pos.set(30,heightAt(30,30)+0.5,30); player.pos.y=standHeight(30,30,10);   // 离开 T4 车残骸占位 (occBlocked 会挡 engBuildExec)
player.buildCount=(player.buildCount===undefined?5:player.buildCount);
if(player.buildCount<1) player.buildCount=5;
var __t6bc0=player.buildCount;
var __t6cx=0, __t6cz=0;
var __t6cy0=CYLS.length;
// 选点"搜空位" (随机图布局不可复现, 固定坐标 occ/prop 闸偶发被占 ⇒ 假红; engBuildExec 失败不扣建造点, 重试无代价)
outer6: for(var __r6r=2.5;__r6r<=20;__r6r+=2){ for(var __a6=0;__a6<12;__a6++){
var __ax=player.pos.x+__r6r*Math.cos(__a6*Math.PI/6), __az=player.pos.z+__r6r*Math.sin(__a6*Math.PI/6);
player.pendingBuild={type:'barrel',tx:__ax,tz:__az,ry:0,cost:BUILD_COST.barrel,zp:0};
engBuildExec(player);
if(CYLS.length>__t6cy0){ __t6cx=__ax; __t6cz=__az; break outer6; } } }
var __t6c=CYLS[CYLS.length-1];
__t6={ok:CYLS.length>__t6cy0, exp:!!(__t6c&&__t6c.explosive), bc:__t6bc0-(player.buildCount||0), inR:false};


// RGRID 直插断言: 圆柱下标出现在其覆盖格
var __t6inR=false;
if(RGRID.cylCells){
const N2=RGRID.N, idx=CYLS.length-1, c2=CYLS[idx];
const i0=Math.max(0,Math.min(N2-1,Math.floor((c2.x-c2.r+RGRID.off)/RGRID.cell))), i1=Math.max(0,Math.min(N2-1,Math.floor((c2.x+c2.r+RGRID.off)/RGRID.cell)));
const j0=Math.max(0,Math.min(N2-1,Math.floor((c2.z-c2.r+RGRID.off)/RGRID.cell))), j1=Math.max(0,Math.min(N2-1,Math.floor((c2.z+c2.r+RGRID.off)/RGRID.cell)));
outer: for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){ const arr=RGRID.cylCells[j*N2+i]; for(const v of arr) if(v===idx){ __t6inR=true; break outer; } }
}
__t6.inR=__t6inR;
`);
ok(G('__t6.ok')===true&&G('__t6.exp')===true,'T6a 油桶落成 (CYLS+1, explosive 标记)');
ok(G('__t6.bc')===1,'T6b 建造点扣 1 (BUILD_COST.barrel=1)');
ok(G('__t6.inR')===true,'T6c ★RGRID 倒排表直插 (运行期生成圆柱不插则弹道/碾爆三链不可见)');

// ══ T7 巡飞弹发射视角播种 (⑤) ══
console.log('T7 发射视角播种: 第三人称→背追(1), 第一人称→TV(0)');
G(`
var __t7={};
var __ltFire=(tp)=>{
if(player.loiter&&!player.loiter.dead) loiterDespawn(player.loiter);
player.loiter=null; player._ltClick=false; player._ltRClick=false; player._ltSpace=false; keys.Space=false;
player.loiterView=tp?9:0;   // 9=哨兵值: 播种必须整字覆写
player.flying=false; player.flyAero=false; player._aeroSpd=0;
player.spectator=false; player.alive=true; player.onVehicle=null; player.onNaval=null; player.chute=false;
player.thirdPerson=tp; player.ads=false; player.yaw=0; player.pitch=0;
player.pos.set(player.pos.x,heightAt(player.pos.x,player.pos.z)+1.7,player.pos.z);
fireLoiter(player,new THREE.Vector3(player.pos.x,player.pos.y,player.pos.z-2),new THREE.Vector3(0,0,-1));
return player.loiterView;
};
__t7.tv=__ltFire(false);
__t7.chase=__ltFire(true);
if(player.loiter&&!player.loiter.dead) loiterDespawn(player.loiter);
player.loiter=null; player.thirdPerson=false; player.loiterView=0;
`);
ok(G('__t7.tv')===0,'T7a 第一人称发射 → loiterView=0 (TV 制导, 既有口径)');
ok(G('__t7.chase')===1,'T7b ★第三人称发射 → loiterView=1 (背追视角; 本仓极性 1=背追, 改前恒 0=TV)');

// ══ T8 加速 1.5× 耗条 (⑤.5) ══
console.log('T8 加速存续消耗: boost 期 Δlife = 巡航 ×1.5');
G(`
var __ltDrain=(boost)=>{
if(player.loiter&&!player.loiter.dead) loiterDespawn(player.loiter);
player.loiter=null; player._ltClick=false; player._ltRClick=false; player._ltSpace=!boost; keys.Space=!!boost;
player.flying=false; player.flyAero=false; player._aeroSpd=0; player.spectator=false; player.alive=true;
player.thirdPerson=false; player.loiterView=0; player.ads=false; player.yaw=0; player.pitch=0;
fireLoiter(player,new THREE.Vector3(player.pos.x,player.pos.y,player.pos.z-2),new THREE.Vector3(0,0,-1));
// 既有契约: fireLoiter 出膛吞空格 (_ltSpace=!!keys.Space ⇒ 发射帧按住空格不算加速) —— 探针模拟"发射后第二帧才按住":
player._ltSpace=false; keys.Space=!!boost;
var d=player.loiter; var l0=d.life;
updateLoiters(1/30,1/30);
var dl=l0-d.life;
if(player.loiter&&!player.loiter.dead) loiterDespawn(player.loiter);
player.loiter=null; keys.Space=false; player._ltSpace=false;
return dl;
};
var __t8={cruise:__ltDrain(false), boost:__ltDrain(true)};
`);
ok(G('__t8.cruise')>0.02&&G('__t8.cruise')<0.05,'T8a 巡航 Δlife ≈ 1/30 (基线)');
ok(Math.abs(G('__t8.boost')/G('__t8.cruise')-1.5)<0.05,'T8b ★boost Δlife = 巡航×1.5 (LOITER_BOOST_DRAIN 单源)');

// ══ T9 布娃娃(加固) 档 (⑥) ══
console.log('T9 加固档: 桩上 spawnRagdoll 完整成账, 副锚锁关节相对转动 (整体阻尼/冲量不动)');
G(`
window.CANNON=CANNON;   // 桩: die→spawnRagdoll 门 (ragdoll2 同款)
var __ragKill=(stiffMode)=>{
localStorage.setItem('sf_deathfx',stiffMode?'2':'0');
var E=null; for(const s of soldiers){ if(s.alive&&s.team!==player.team&&!s.zombie&&!s.onVehicle&&!s.onNaval){ E=s; break; } }
if(!E) return null;
var n0=RAG.list.length;
E.crouch=stiffMode;   // 蹲姿死 (顺带钉 RAG_POSE 读 crouch 的既有链)
E.protUntil=0;        // 清出生保护 (与 T4 player.protUntil=0 同理, 18-game/Bot.damage 敌方来源免伤门)
E.damage(500,player,false);
if(RAG.list.length<=n0) return null;
return RAG.list[RAG.list.length-1];
};
`);
G('var __r6=__ragKill(false); var __r6n=(__r6?__r6.cons.length:-1); var __r6d=(__r6&&__r6.parts[0]&&__r6.parts[0].body)?__r6.parts[0].body.angularDamping:-9;');
ok(G('__r6')!==null,'T9-prep 普通档布娃娃成账 (桩 CANNON, ragdoll2 同源口径)');
ok(G('__r6n')===6,'T9a 普通档 cons=6 (主锚六条, 无副锚)');
ok(Math.abs(G('__r6d')-0.4)<0.01,'T9b 普通档 angularDamping=0.4 (既有值不变)');
G('var __r7=__ragKill(true); var __r7n=(__r7?__r7.cons.length:-1); var __r7d=(__r7&&__r7.parts[0]&&__r7.parts[0].body)?__r7.parts[0].body.angularDamping:-9; var __r7vmax=-9,__r7wmax=-9; if(__r7){ for(const p of __r7.parts){ __r7vmax=Math.max(__r7vmax,p.body.velocity.y); __r7wmax=Math.max(__r7wmax,Math.abs(p.body.angularVelocity.x),Math.abs(p.body.angularVelocity.y),Math.abs(p.body.angularVelocity.z)); } }');
ok(G('__r7')!==null,'T9-prep2 加固档布娃娃成账');
ok(G('__r7n')===12,'T9c ★加固档 cons=12 (6 主锚 + 6 副锚, 同一 ST 站位表反推零初错)');
ok(Math.abs(G('__r7d')-0.4)<0.01,'T9d ★加固档 angularDamping=0.4 与普通档同值 (二版裁定: 整体运动不收紧, 旧 0.85 绝迹)');
ok(G('__r7vmax')>1.45,'T9e ★初始冲量不压收 (7 部件 max vy>1.45; 旧 ×0.4 档 vy≤1.4 不可能过)');
ok(G('__r7wmax')>2.5,'T9f ★角速度不压收 (max|ω|分量>2.5; 旧 ×0.4 档 ≤2.0 不可能过)');
G('var __r7sec=[[0,-0.36,0,0,0.03,0],[0,-0.21,0,0,0.19,0],[0,0.15,0,-0.31,0.11,0],[0,0.15,0,0.31,0.11,0],[0,0.35,0,-0.12,-0.12,0],[0,0.35,0,0.12,-0.12,0]]; var __r7g=__r7sec.every((e,i)=>{ const c=__r7.cons[6+i]; return !!c&&!!c.pivotA&&!!c.pivotB&&Math.abs(c.pivotA.x-e[0])<1e-6&&Math.abs(c.pivotA.y-e[1])<1e-6&&Math.abs(c.pivotA.z-e[2])<1e-6&&Math.abs(c.pivotB.x-e[3])<1e-6&&Math.abs(c.pivotB.y-e[4])<1e-6&&Math.abs(c.pivotB.z-e[5])<1e-6; });');
ok(G('__r7g')===true,'T9g ★副锚六条 = 主锚沿部件 Y 轴同减 d=软限位轴距 (桩 pivotA/pivotB 行为值; 父子同减同一局部向量 ⇒ 零初错继承)');
G("localStorage.setItem('sf_deathfx','0');");

// ══ T10 F2 截图旗 (③) ══
console.log('T10 F2 截图: 派发→置旗→主循环消费复位');
G('pointerLocked=true;');
ctx.dispatchEvent(new ctx.KeyboardEvent('keydown',{code:'F2'}));
ok(G('typeof screenshotReq!=="undefined"')===true,'T10-prep screenshotReq 全局在位 (19-input)');
ok(G('screenshotReq')===true,'T10a F2 派发置旗 (deployed 门)');
G('__step(1);');
ok(G('screenshotReq')===false,'T10b 主循环渲染对后消费复位 (24-main; 桩 canvas 无 toBlob 走 catch 不炸帧)');

// ══ T11 降落伞锚背包 (⑦) ══
console.log('T11 伞收敛点=背包 (摇摆解析补偿)');
G(`
var __chuteCheck=(yaw)=>{
if(!playerChuteMesh){ playerChuteMesh=new THREE.Group(); scene.add(playerChuteMesh); }
player.pos.set(10,50,10); player.yaw=yaw;
playerChuteFollow(__T);
var swx=Math.sin(__T*0.7)*0.12, swz=Math.cos(__T*0.6)*0.08;   // 实现同式 (playerChuteFollow 内部由 nowT 现算)
// 收敛点世界位 = position + Rz(swz)·Rx(swx)·(0,-3.3,0) (与 playerChuteFollow 写点同一旋转序反解):
// Rx(swx) 后 (0,-3.3,0)→(0,-3.3csx, 3.3ssx)? 逐轴: 先 Rx: y'=-3.3csx, z'=3.3ssx; 再 Rz: x''= -3.3csx·(-swz)=3.3csx·swz? —
// 直接按实现同式反解: bottom=(pos.x+0.18sin yaw, pos.y+1.24, pos.z+0.18cos yaw) 恒成立 ⇔ 锚钉背包。
var p=playerChuteMesh.position, csx=Math.cos(swx),csz=Math.cos(swz),ssx=Math.sin(swx),ssz=Math.sin(swz);
var bx=p.x+3.3*ssz, by=p.y-3.3*csz*csx, bz=p.z-3.3*csz*ssx;
var ex=10+Math.sin(yaw)*0.18, ey=50+1.24, ez=10+Math.cos(yaw)*0.18;
return {err:Math.hypot(bx-ex,by-ey,bz-ez)};
};
var __t11={a:__chuteCheck(0,0,0), b:__chuteCheck(1.1,0.12,-0.08)};
`);
ok(G('__t11.a.err')<1e-6&&G('__t11.b.err')<1e-6,'T11a ★收敛点恒钉背包 (静止/摇摆两态; 改前=脚底中轴裆部)');

console.log('\n通过 '+PASS.length+' 项, 失败 '+FAILN+' 项'+(NEG?' (NEG 定向红判定见上行 ● 标)':''));
process.exit(NEG?0:(FAILN?1:0));
