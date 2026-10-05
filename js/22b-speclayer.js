// ─────────────────────────────────────────────
// 22b-speclayer.js —— 观战专属: ① 世界信息层 ② 时停 (2026-09-26H 观战批 B6/B7; ② 于 2026-09-27I 收敛为"只留时停")
//
// 背景 (用户 2026-09-26 圈定的修复清单 #10/#11): 观战模式此前"看得到战场, 读不出战场" ——
//   世界里的 Bot 没有名字/队属/血量/交战对象 (只有实验模式 P 键的 AI 调试层, 且那是调参语义, 不是观战语义);
//   也没法叫停战场看清一次交火。本文件把这两件事做成**观战专属**的一层:
//
// ① SpecLayer (信息层, 键 J 开关, 默认开): 给每个单位挂一块头顶名牌 (名字 · 状态 · 血条/血量) ——
//    步兵 (soldiers) 与三类载具 (tanks/planes/navalCraft) 一律同规; 交战中还有一条**指向线**
//    从单位连到它当前的目标 (步兵 target / 坦克 tVehTgt / 舰艇 ai.tgt.obj) ⇒ "谁在打谁"一眼可见。
//    实现沿用 14-bots 的 BotDebug 那一套原语 (Sprite + CanvasTexture, 4Hz 错峰重绘), 不新造渲染路径;
//    队属用**颜色**表达 (友军青蓝 / 敌军暖红, 与 BotDebug 同色板), 不额外占屏幕宽度。
//
// ② SPEC_TIME (时停, 键 K 开/关): 世界推进 = 真实帧时间 × 0/1, 游戏时钟 nowT 同速 (24-main 把"未被消费的
//    时间"计进 nowOff, 复用既有暂停机制) ⇒ 时停下射速、引信、重生倒计时、旗点进度全部一致地停住,
//    不是"只有动画停"的假冻结。**唯一例外是观战者自己**: 本体 (updatePlayer/相机/信息层) 与他在开的
//    那台载具 (specTimeRideDt → specRide) 走真实帧时间 ⇒ 冻结的是战场, 不是观察者 (用户 2026-09-27 裁定)。
//    同一条裁定的下半句 (2026-09-27M 修复批): 他**打出的弹丸**也算观察者 —— 寿命/回收/命中判定走
//    specTimeShotDt → shooter.isPlayer (见其注释: 否则"能开火, 打出的东西冻在枪口"且对象无上限增长)。
//    时停**只在观战态生效** (specTimeActive: 观战者 + 活着 + 未结算 + 未暂停): 关闭观战/换局/回菜单一律解除。
//
// 单源纪律: 本文件只读他文件的公开字段 (pos/hp/name/team/state/target), 不写任何战斗状态 ——
//   唯一的写点是自己挂在单位上的 u._specTag / u._specLine (纯观感)。
// ‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧‧
'use strict';
// ═════════════════ 一、观战信息层 (B6) ═════════════════
const SPEC_LAYER_RANGE=110;   // 名牌距离上限 m (BotDebug 是 75 —— 观战要看更远的交火, 略放宽)
const SPEC_LINE_RANGE=85;     // 指向线距离上限 m
const SPEC_TAG_W=320, SPEC_TAG_H=64;
const SpecLayer={
on:true,        // 默认开: 用户要求的"世界内可读"是观战的基本盘, 不想看时按 J 关掉
count:0,        // 上一次 tick 里可见的名牌数 (供 HUD/探针读取, 只读视图)
};
// 观战信息层是否活跃: 只有"观战者本人活着且已落地"才画 (死亡镜头/部署界面/菜单期一律不画)
function specLayerActive(){
return !!(SpecLayer.on&&typeof player!=='undefined'&&player&&player.spectator&&player.alive&&player.deployed&&!matchOver);
}
function specLayerToggle(){
SpecLayer.on=!SpecLayer.on;
if(typeof showScorePop==='function') showScorePop(t2(SpecLayer.on?'观战信息层: 开':'观战信息层: 关'));
if(!SpecLayer.on) specLayerPurge();
return SpecLayer.on;
}
// 关闭时把所有已挂的名牌/指向线收起来 (不删对象: 下次开逐帧复位, 零分配)
function specLayerPurge(){
const list=specLayerUnits();
for(const u of list){
if(u._specTag) u._specTag.visible=false;
if(u._specLine) u._specLine.visible=false;
}
SpecLayer.count=0;
_specLive=false;   // 已收干净 ⇒ 下一次 tick 直接空转
}
// 信息层的对象清单 (步兵 + 三类载具; 幽灵坦克不在 tanks/planes/navalCraft 表里, 天然不入清单 ——
// 那是观战者自己的座驾, 不需要名牌)
function specLayerUnits(){
const out=[];
for(const s of soldiers) if(s&&s.mesh) out.push(s);
for(const v of tanks) if(v) out.push(v);
for(const v of planes) if(v) out.push(v);
if(typeof navalCraft!=='undefined'&&Array.isArray(navalCraft)) for(const v of navalCraft) if(v) out.push(v);
return out;
}
// 名牌宿主与高度: 步兵挂在 mesh.root 头顶 (与 BotDebug 同一挂点), 载具挂在车体网格上方
function specHostOf(u){
if(u.mesh&&u.mesh.root) return {host:u.mesh.root,y:2.45};
if(u.grp) return {host:u.grp,y:(u.kind==='plane')?1.9:((u.kind==='amph'||u.kind==='boat')?3.1:3.5)};
return null;
}
function specTagOf(u){
// 交互目标 (谁在打谁): 步兵 target / 坦克 tVehTgt / 舰艇 ai.tgt.obj —— 三处都是既有只读字段
function specTargetOf(x){
if(x.target&&x.target!==x&&x.target.pos) return x.target;
if(x.tVehTgt&&x.tVehTgt.pos) return x.tVehTgt;
if(x.ai&&x.ai.tgt&&x.ai.tgt.obj&&x.ai.tgt.obj.pos) return x.ai.tgt.obj;
return null;
}
u._specTargetOf=specTargetOf; // 供探针/调试直读 (只读视图, 不参与判定)
let t=u._specTag;
if(!t){
const h=specHostOf(u);
if(!h) return null;
const cv=document.createElement('canvas'); cv.width=SPEC_TAG_W; cv.height=SPEC_TAG_H;
t=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv),transparent:true,depthTest:false}));
t.scale.set(3.1,0.62,1); t.renderOrder=7; t.visible=false;
// ★ 不把 host 存进 userData (2026-09-28 D1 病根): 标签挂在 u.grp 里, userData.host 再指回 grp = 环 ——
//   three 的 Object3D.copy() 会对 userData 做 JSON.parse(JSON.stringify()) 环状结构直接抛
//   "Converting circular structure to JSON" ⇒ Plane.die() 的 grp.clone() 中断在"本体已死未隐"之间
//   = 观战态击落必现"死而不隐挂天" (host 全库无读者, 只写不读, 删之; 标签本来就挂在 host 下, 位置随宿主)。
t.userData.cv=cv; t.userData.y=h.y; t.userData.t=0;
try{ h.host.add(t); t.position.y=h.y; }catch(e){}
u._specTag=t;
}
return t;
}
function specLineOf(u){
let l=u._specLine;
if(!l){
const g=new THREE.BufferGeometry();
g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3));
l=new THREE.Line(g,new THREE.LineBasicMaterial({color:(u.team===player.team)?0x86c8ff:0xff8a72,transparent:true,opacity:0.55,depthTest:false}));
l.renderOrder=7; l.frustumCulled=false; l.visible=false;
scene.add(l);
u._specLine=l;
}
// 世界还原自愈 (D10, 2026-09-28): 指向线是"对局中挂进 scene 的常驻对象", 不在开局快照里 ——
// 换局还原的台账会把整段摘除 (parent=null) 而本引用还在, 之后 visible=true 写在脱挂节点上 = 指向线全灭。
// 与 playerAvatarReset 同族; 这里就地自愈 (脱挂即重新入场景), 不必动世界还原链。
if(!l.parent&&typeof scene!=='undefined') scene.add(l);
return l;
}
// 名牌绘制: 第一行 "名字 · 状态", 第二行 血条 + 数值 (车辆按 maxHp 归一)
const SPEC_KIND_TXT={tank:'装甲',plane:'战机',amph:'两栖车',boat:'舰艇'};
function specDrawTag(u,t){
const cv=t.userData.cv;
if(!cv||!cv.getContext) return;
const g=cv.getContext('2d');
if(!g) return;
if(g.clearRect) g.clearRect(0,0,SPEC_TAG_W,SPEC_TAG_H);
const friendly=(u.team===player.team);
const col=friendly?'#9fe8ff':'#ffb0a0';
let nm=u.name||SPEC_KIND_TXT[u.kind]||'';
if(!nm&&u.cls!==undefined&&typeof CLASSES!=='undefined'&&CLASSES[u.cls]) nm=CLASSES[u.cls].name;
nm=String(nm).slice(0,9);
const st=(typeof DBG_STATE!=='undefined'&&DBG_STATE[u.state])||'';
const head=st?nm+' · '+st:nm;
g.font='bold 22px sans-serif'; g.textAlign='left';
if(g.strokeText){ g.strokeStyle='rgba(0,0,0,.92)'; g.lineWidth=5; g.strokeText(head,8,26); }
g.fillStyle=col;
if(g.fillText) g.fillText(head,8,26);
const mx=(typeof u.maxHp==='number'&&u.maxHp>0)?u.maxHp:100;
const f=Math.max(0,Math.min(1,(u.hp||0)/mx));
g.fillStyle='rgba(0,0,0,.55)';
if(g.fillRect) g.fillRect(8,36,296,11);
g.fillStyle=f>0.6?'#7ee081':(f>0.3?'#ffd76b':'#ff7a63');
if(g.fillRect) g.fillRect(10,38,292*f,7);
g.font='bold 15px sans-serif'; g.textAlign='right';
g.fillStyle='#e8eee0';
if(g.fillText) g.fillText(Math.round(u.hp||0)+'/'+Math.round(mx),312,36);
if(t.material&&t.material.map) t.material.map.needsUpdate=true;
}
// 每帧: 名牌显隐 + 错峰重绘 (0.25s 一档, 按序号错开 —— 与 BotDebug 同规) + 指向线
// _specLive: 上一次 tick 是否真有可见内容 —— 非观战期只在"首次收干净"那一帧进循环, 之后彻底空转
let _specLive=false;
function updateSpecLayer(dt){
const on=specLayerActive();
if(!on&&!_specLive) return;   // 非观战且上一次已收干净 ⇒ 直接返回 (普通战斗每帧不进这层)
const list=specLayerUnits();
let vis=0,i=0;
for(const u of list){
i++;
const t=u._specTag;
const dist=Math.hypot(u.pos.x-camera.position.x,u.pos.z-camera.position.z);
const show=!!(on&&u.alive&&dist<SPEC_LAYER_RANGE);
if(!show){
if(t) t.visible=false;
if(u._specLine) u._specLine.visible=false;
continue;
}
const tg=specTagOf(u);
if(tg){
tg.visible=true; vis++;
tg.userData.t-=dt;
if(tg.userData.t<=0){ tg.userData.t=0.25+(i%5)*0.03; specDrawTag(u,tg); }
}
// 指向线: 有交战对象且双方都在邻域内才画 (线本身不解释"能不能打", 只解释"在打谁")
const tgt=u._specTargetOf?u._specTargetOf(u):null;
if(tgt&&dist<SPEC_LINE_RANGE){
const ln=specLineOf(u);
const pos=ln.geometry&&ln.geometry.attributes&&ln.geometry.attributes.position;
if(pos&&pos.setXYZ){
pos.setXYZ(0,u.pos.x,u.pos.y+2.2,u.pos.z);
pos.setXYZ(1,tgt.pos.x,tgt.pos.y+1.2,tgt.pos.z);
if(pos.needsUpdate!==undefined) pos.needsUpdate=true;
ln.visible=true;
}
}else if(u._specLine) u._specLine.visible=false;
}
SpecLayer.count=vis;
_specLive=vis>0;   // 收尾状态: 下一次非观战帧若已收干净就直接空转 (普通战斗零开销)
}
// ═════════════════ 二、观战时停 (B7; 2026-09-27I 收敛) ═════════════════
// 口径 (用户 2026-09-27 裁定): **只留时停** —— "时停之外的时间流速控制建议直接删了"。
//   旧版的 4 档慢放 (1/0.5/0.25/0.1) 与"单步 1 帧"整段删除: 档位升降/单步都得先记住"现在是第几档",
//   而观战真正要的是"把这一秒定住看清楚" —— 按一下 K, 只有一个状态差 (停/走), 读数最简。
//   时停 = 世界推进量 0 (24-main 把这一帧的真实时间计进 nowOff ⇒ nowT 同速冻结: 射速/引信/
//   重生倒计时/旗点进度一起停, 不是"只有动画停"的假冻结)。
//   时停的**唯一例外是观战者自己** (同一条裁定: "时停的时候玩家也不能动"是缺陷): 本体链与座驾
//   走真实帧时间 (specTimePlayerDt / specTimeRideDt), 其余一律静止 —— 冻的是战场, 不是观察者。
const SPEC_TIME={paused:false};
// 只在观战态生效 (观战者 + 活着 + 未结算 + 未暂停): 任何一条不成立 ⇒ 时停不生效 (观战关掉后不留后效)
function specTimeActive(){
return !!(typeof player!=='undefined'&&player&&player.spectator&&player.alive&&!matchOver&&!gamePaused);
}
function specTimeFrozen(){ return specTimeActive()&&SPEC_TIME.paused; }
function specTimeStatus(){ return specTimeFrozen()?'暂停':'运行'; }   // 只读视图 (HUD/探针)
function specTimeToggle(){
if(!specTimeActive()) return false;
SPEC_TIME.paused=!SPEC_TIME.paused;
if(typeof showScorePop==='function')
showScorePop(SPEC_TIME.paused?t2('观战时停: 开 (K 继续 · 你本人仍可走动/飞行; 打出的弹丸也照飞)'):t2('观战时停: 关'));
return SPEC_TIME.paused;
}
function specTimeReset(){ SPEC_TIME.paused=false; }
// 主循环消费点 (24-main): 返回**本帧世界推进量** —— 非观战/未时停原样返回 rdt (零行为漂移),
// 时停时返回 0 (世界冻结, nowT 同速)。
function specTimeConsume(rdt){
if(!specTimeFrozen()) return rdt;
return 0;
}
// 观战者**本体链** (24-main 的 updatePlayer/相机/信息层/视角武器) 用的帧长: 时停期间仍走真实时间。
function specTimePlayerDt(rdt,dt){ return specTimeFrozen()?rdt:dt; }
// 观战者**座驾** (15-vehicles/15c-specveh/15d-naval/16-aircraft) 的帧长: 只有"你在开的那一台"跟本体同速
// (含幽灵坦克), 其余载具照旧吃世界帧长 ⇒ 时停下静止。判据单源 = 13-combat 的 specRide (与
// "观战者座驾不被索敌/不被击毁"同一个谓词, 不另立一套"谁算观战者的车")。
function specTimeRideDt(v,rdt,dt){
if(!specTimeFrozen()) return dt;
return (typeof specRide==='function'&&specRide(v))?rdt:dt;
}
// 观战者**自己打出的弹丸** (炮弹/曳光/手雷/高炮弹/弹壳) 的帧长 (2026-09-27M 时停修复批, 审计 P0-2/P1-3):
// 寿命类对象 (life-=dt / traveled+=spd*dt / fuse-=dt) 在 dt=0 下**永不回收** —— 观战者弹药无限 + 幽灵坦克
// 主炮 CD 恒 0 ⇒ 开着时停按住扳机就是线性加对象 (每条曳光一个 Mesh、每发炮弹一次拖尾喷射), 且"能开火、
// 打出的东西冻在枪口"与"冻的是战场, 不是观察者"这条裁定自相矛盾。
// 归属判据单源 = **shooter.isPlayer** (全库射手字段: 玩家 true / Bot·乘员 false —— 与 fireBullet 里
// "非玩家吃难度伤害分档"用的是同一个字段, 不另立一套"谁算玩家"): 非时停 ⇒ 一律 dt (零行为漂移);
// 时停 ⇒ 只有玩家自己打出的并入观察者链 (rdt), 其余 (AI 的弹丸) 随战场一起冻住。
function specTimeShotDt(owner,rdt,dt){
if(!specTimeFrozen()) return dt;
if(typeof rdt!=='number') return dt;   // 调用方没给真实帧长 (部分沙箱/直调探针) ⇒ 退化为世界帧长 = 冻结
return (owner&&owner.isPlayer)?rdt:dt;
}
