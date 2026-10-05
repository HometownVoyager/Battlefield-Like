// ─────────────────────────────────────────────
// 23b-worldrestore.js —— 世界还原: 开局快照 / 就地复原 (2026-09-17 世界还原批)
// 背景 (用户实报): 打完一局结算后回主界面, 航拍背景是"被摧残过的战场"—— 农田/树篱/可毁墙全没了、
//   场上还站着上一局的人; 同一张图就地开新一局同样是残破地图。根因 = 2026-09-16「就地重开」批次
//   只让对局实体退场 (retireMatchActors), 世界本身 (地形地物/建筑/植被/旗面) 是复用同一份 ——
//   上一局打出的坍塌/碾毁/烧毁/弹坑/焦土全部留在场上 (PLAN 该批次已如实记为"代价", 本批按实机反馈
//   把代价清掉: 世界也一并还原)。
// 做法: 脚本载入期 (世界已构建完毕、尚未开过任何一局) 对"战斗能改写的一切状态"拍一张快照;
//   还原时把快照写回, 并把本局新增的场景对象整段摘除 (工事/残骸/弹坑/布娃娃/粒子/在途弹)。
// 快照内容 (逐项对应破坏入口):
//   ① 场景台账: world/scene 的 children 列表 (本局新增的网格一律不在快照里 → 还原即摘除, 与
//      retireMatchActors 的"world 台账边界"同思路, 但覆盖 world+scene 两侧且不依赖边界值);
//   ② 静态碰撞: BOXES (killBox/killDynCollider 改写 dead 并把 AABB 推到 99999) 与 CYLS (killCyl 改写 dead/r/y1);
//   ③ 可毁结构: DESTRUCTIBLES 逐组 dead/hp + 屋顶坍塌链 (从各组 roofRef 反查) 的 done/dead;
//   ④ 植被: FLORA_HASH 逐株状态 (烧毁/倒伏/焦黑/碾碎/沉入标记) + 各株网格的完整变换
//      (position xyz + quaternion; 沉入动画推下 y, 枯树/椰树的倒伏还改写 x/z 与姿态) +
//      树木/灌木/草丛/庄稼实例批的 instanceMatrix/instanceColor (倒伏、焦黑、零缩放隐藏全在这里);
//   ⑤ 火焰网格: FUEL 燃料 + 受热/燃烧/寿命/点火者 (全部清零);
//   ⑥ 占位与登记表: PROPS / coverPoints / wires / MG42S / runtimeCraters / CROP_FIELDS (运行时只追加),
//      外加固定炮位/地图机枪被操作后残留的射角 (炮位本体是地图设施, 但 yaw/pitch 组会停在最后一帧);
//   ⑦ 旗面: 归属回中立 + 布料顶点回基线 + 旗高复位 (updateFlags 每帧改写旗布顶点与旗杆位置)。
// 不拍快照的两类:
//   · 占用网格 OCC 与寻路 NAV: 还原后调 NAV.refresh() 按还原后的 BOXES/CYLS/wires 全量重建
//     (buildOccupancy 本来就是全量重建, 顺带把火焰占用格与工程兵工事占用格一并抹掉);
//   · 纯运行期特效 (粒子/拖痕/弹壳/烟雾/布娃娃/碎块): 直接清表 + 交给场景台账摘除。
// 调用点 (22-hud / 24-main):
//   · 24-main 启动末尾 capturePristineWorld() —— 世界已就绪、主循环尚未开始;
//   · beginFreshMatch() 就地开新一局前 restorePristineWorld() —— 新一局拿到的是干净世界;
//   · returnToMenu() 仅在"战局已结束(matchOver)"时还原 —— 主菜单航拍看到的是干净地图;
//     战局未结束(menuHold, 可从主菜单继续)不还原: 那一刻的背景就是"冻结的战场"本身。
// 校验: node dev/verify-worldrestore.js
// ─────────────────────────────────────────────
'use strict';
// ── 快照存储 (capturePristineWorld 填入; 未拍快照 = ready:false, 还原退化为"仅撤实体"的旧路径) ──
const WSN={ready:false, worldKids:null, sceneKids:null,
boxN:0, box:[], cylN:0, cyl:[], dest:[], roof:[],
flora:[], floraSeen:null, inst:[], fuel:null,
props:[], coverN:0, wireN:0, mgN:0, craterN:0, cropN:0, flags:[]};
// 逐株植被的可变字段 (被燃烧/倒伏/碾毁/炸没/沉入改写的一切; 其余字段构建期定死)
const WSN_FLORA_FIELDS=['alive','dead','burnT','burnDur','dmg','fall','charred','sinkQ','igniter','fT','iT','cx','cy','cz','restCrown'];
const _wsnHas=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
// 炮位指向快照/写回 (yaw 组 rotation.y + pitch 组 rotation.x)
const _wsnAimSnap=arr=>arr.map(g=>[g&&g.yaw?g.yaw.rotation.y:0, g&&g.pitch?g.pitch.rotation.x:0]);
const _wsnAimRestore=(arr,snap)=>{
if(!snap) return;
for(let i=0;i<arr.length;i++){
const s=snap[i], g=arr[i];
if(!s||!g) continue;
if(g.yaw) g.yaw.rotation.y=s[0];
if(g.pitch) g.pitch.rotation.x=s[1];
}
};
// 就地截断到快照长度 (表只增不减: 工程兵工事/临时补给点/运行期弹坑都在尾部追加)
function _wsnTrim(arr,n){ if(arr&&arr.length>n) arr.length=n; }
// ═════ 拍快照 ═════
function capturePristineWorld(){
if(WSN.ready) return true;
try{
WSN.worldKids=world.children.slice();
WSN.sceneKids=scene.children.slice();
// ② 静态碰撞盒 (AABB + dead 一起存: killBox 把 AABB 推到 99999 当"已死"用)
WSN.boxN=BOXES.length;
WSN.box=BOXES.map(b=>[b.dead?1:0,b.minX,b.minY,b.minZ,b.maxX,b.maxY,b.maxZ]);
WSN.cylN=CYLS.length;
WSN.cyl=CYLS.map(c=>[c.dead?1:0,c.r,c.y0,c.y1]);
// ③ 可毁结构组 + 屋顶坍塌链 (反查: pitchedRoof 把 ref 挂在承重墙组的 roofRef 上)
WSN.dest=DESTRUCTIBLES.map(g=>[g.dead?1:0,g.hp]);
WSN.roof=[]; WSN.roofSeen=new Set();
for(const g of DESTRUCTIBLES){
const r=g&&g.roofRef;
if(!r||WSN.roofSeen.has(r)) continue;
WSN.roofSeen.add(r);
WSN.roof.push({r,done:r.done?1:0,dead:r.dead||0,dmg:r.dmg||0});   // dmg: 屋盖承伤进度 (B2, 2026-09-27N)
}
// ④ 植被逐株状态 (记录本体取自 FLORA_HASH, TREE_LIVE/BUSH_LIVE 只是同一批对象的另一份索引)
WSN.flora=[]; WSN.floraSeen=new Set();
const pushFlora=rec=>{
if(!rec||WSN.floraSeen.has(rec)) return;
WSN.floraSeen.add(rec);
const st={r:rec};
for(const k of WSN_FLORA_FIELDS) if(_wsnHas(rec,k)) st[k]=rec[k];
if(rec.meshes) st.my=rec.meshes.map(m=>(m&&m.position)?m.position.y:0); // vanishFlora 的沉入动画改写网格 y
// 2026-09-26: 除 y 外还要存**完整变换** —— 枯树/椰树被炸倒伏走 floraObjMatrices, 它写的是网格自身的
// position(x,y,z) 与 quaternion; 只还原 y 的话下一局这两类会"歪在原地/平移出去"。
// 存成扁平数表 (7 个数/件) 而不是 Vector3/Quaternion 副本: 沙箱桩无 clone, 且省一次对象分配。
if(rec.meshes) st.mt=rec.meshes.map(m=>{
if(!m||!m.position) return null;
const q=m.quaternion;
return [m.position.x,m.position.y,m.position.z,q?q.x:0,q?q.y:0,q?q.z:0,q?q.w:1];
});
WSN.flora.push(st);
};
if(typeof FLORA_HASH!=='undefined'&&FLORA_HASH&&FLORA_HASH.forEach) FLORA_HASH.forEach(arr=>{ if(arr) for(const rec of arr) pushFlora(rec); });
if(typeof TREE_LIVE!=='undefined') for(const rec of TREE_LIVE) pushFlora(rec);
if(typeof BUSH_LIVE!=='undefined') for(const rec of BUSH_LIVE) pushFlora(rec);
// ④b 实例批 (树木倒伏/焦黑/沉入, 灌木烧尽, 草丛/庄稼烧尽 —— 全部改写实例矩阵或实例色)
WSN.inst=[];
const snapIM=im=>{
if(!im||WSN.inst.some(e=>e.im===im)) return;
const e={im,count:im.count,m:null,c:null};
if(im.instanceMatrix&&im.instanceMatrix.array) e.m=Float32Array.from(im.instanceMatrix.array);
if(im.instanceColor&&im.instanceColor.array) e.c=Float32Array.from(im.instanceColor.array);
WSN.inst.push(e);
};
if(typeof TREE_IM!=='undefined'&&TREE_IM){ snapIM(TREE_IM.trunks); snapIM(TREE_IM.leaves); }
if(typeof BUSH_IM!=='undefined') snapIM(BUSH_IM);
// ④c 草丛/庄稼实例批的"按格索引表": 烧尽时 delete(格) 且实例零缩放 —— 只还原矩阵的话,
// 下一局同一格再烧就不会隐藏这批实例 (表里已经没有那一格了), 故连表内容一起存
WSN.burnInst=[];
if(typeof BURN_INST!=='undefined') for(const bi of BURN_INST){
snapIM(bi.im);
WSN.burnInst.push({bi,cells:bi.byCell?new Map(bi.byCell):null});
}
// ⑤ 火焰网格燃料 (燃烧耗燃料; FHEAT/FBURN/FEXPIRE/FATT/FFX 开局全零, 还原时整体清零即可)
if(typeof FUEL!=='undefined') WSN.fuel=Float32Array.from(FUEL);
// ⑥ 占位与登记表
WSN.props=PROPS.slice();
WSN.coverN=coverPoints.length;
WSN.wireN=wires.length;
WSN.mgN=(typeof MG42S!=='undefined')?MG42S.length:0;
WSN.craterN=(typeof runtimeCraters!=='undefined')?runtimeCraters.length:0;
WSN.cropN=CROP_FIELDS.length;
// ⑥b 固定炮位/地图机枪的指向 (炮位本体是地图设施, 但被操作过之后 yaw/pitch 组停在最后一帧的射角)
WSN.aimMG=_wsnAimSnap(typeof MG42S!=='undefined'?MG42S:[]);
WSN.aimAT=_wsnAimSnap(typeof ATGUNS!=='undefined'?ATGUNS:[]);
WSN.aimAA=_wsnAimSnap(typeof AAGUNS!=='undefined'?AAGUNS:[]);
// ⑦ 旗面 (归属改旗色; updateFlags 每帧改写旗布顶点与旗高)
WSN.flags=FLAGS.map(f=>({owner:f.owner,y:(f.flagMesh&&f.flagMesh.position)?f.flagMesh.position.y:0}));
WSN.ready=true;
console.log('[世界还原] 开局快照已拍: world '+WSN.worldKids.length+' 项 · scene '+WSN.sceneKids.length+' 项 · 碰撞盒 '+WSN.boxN
+' · 圆柱 '+WSN.cylN+' · 可毁结构 '+WSN.dest.length+' (屋顶链 '+WSN.roof.length+') · 植被 '+WSN.flora.length+' · 实例批 '+WSN.inst.length
+' · 占位 '+WSN.props.length);
return true;
}catch(e){
console.warn('[世界还原] 拍快照失败, 就地重开退化为"仅撤实体":',e&&e.message);
WSN.ready=false; return false;
}
}
// ═════ 场景台账还原: 不在快照里的一律摘除, 快照里的原序复位 ═════
// 直接改写 children 数组 (O(n)) 而非逐个 root.remove (O(n²), 上万个网格时肉眼可见卡顿);
// three 的 Object3D 只用 children/parent 两个字段表达层级, 就地改写与 add/remove 等价。
function _wsnRestoreGraph(root,snap){
if(!root||!snap) return;
const keep=new Set(snap);
for(let i=root.children.length-1;i>=0;i--){
const c=root.children[i];
if(keep.has(c)) continue;
root.children.splice(i,1);
if(c&&c.parent===root) c.parent=null;
}
root.children.length=0;
for(const o of snap){ if(!o) continue; o.parent=root; root.children.push(o); }
}
// ═════ 运行期特效清理 (在场景台账还原之前): 清表 + 撤物理体; 网格由台账还原整段摘除 ═════
// 池化对象 (粒子精灵/拖痕网格) 连池一起丢弃: 池里留着"已被摘出场景"的对象, 之后复用就是隐形特效;
// 丢弃后新的按需重建 (代价只是重新 new 几个精灵, 一次换局一次)。
function clearMatchEffects(){
try{ particles.length=0; }catch(e){}
try{ pPools.clear(); }catch(e){}
try{ tracers.length=0; tracerPool.length=0; }catch(e){}
try{ casings.length=0; }catch(e){}
try{ for(const b of bloodGeos){ b.alive=false; b.age=0; b.m=null; } }catch(e){} // 血贴片网格随台账摘除, 引用置空才会重建
try{ for(const c of SMOKES){ for(const s of c.sprites){ if(s.sp&&s.sp.material&&s.sp.material.dispose) s.sp.material.dispose(); } } SMOKES.length=0; }catch(e){}
try{ while(RAG.list.length) removeRagdoll(RAG.list[0]); }catch(e){}
try{ while(DEBRIS.list.length){ removeDebrisEntry(DEBRIS.list[0]); DEBRIS.list.shift(); } }catch(e){}
try{ SINK_JOBS.length=0; }catch(e){}   // 待沉入任务: 留着会把已还原的原始网格/实例再推下地
try{ for(const w of planeWrecks){ if(w.col){ if(typeof killDynCollider==='function') killDynCollider(w.col); w.col=null; } } planeWrecks.length=0; }catch(e){}
try{ nades.length=0; }catch(e){}
try{ shells.length=0; }catch(e){}
try{ flakShots.length=0; }catch(e){}
try{ TB_PENDING.length=0; TB_THREATS.length=0; tbT=6; }catch(e){}
try{ FALLING.length=0; BURNING_TREES.length=0; TREE_SINKS.length=0; }catch(e){}
try{ if(player.loiter) loiterDespawn(player.loiter); player.loiter=null; }catch(e){}
try{ FIRE_SOURCES.length=0; }catch(e){}
try{ MINES.length=0; }catch(e){}
try{ if(typeof BotDebug!=='undefined'&&BotDebug.on) BotDebug.on=false; }catch(e){}
try{ gunEvents.length=0; }catch(e){}
// 惰性创建且挂在模块变量上的常驻对象: 台账摘除后引用必须置空, 否则下次不再重建 (小队标记/玩家降落伞)
try{ if(SQUAD.marker){ scene.remove(SQUAD.marker); SQUAD.marker=null; } SQUAD.members.length=0; if(SQUAD.mode!=='follow') SQUAD.mode='follow'; }catch(e){}
// 玩家降落伞 (2026-09-21 A#8 收尾, 归 infantry): 旧写法只把模块变量置空、**不把模型从 scene 摘掉** ——
// 世界还原这条路径一旦走到, 场上就留一个孤儿伞模型 (与用户第 8 条"伞不会消失"同类根因, 只是触发路径更边缘)。
// 改调 20-player 的收伞单源 playerChuteClear() (摘 scene + 置 null); 23b 是世界还原链、可能在不加载
// 20-player 的子集沙箱里跑, 故"有则用、无则退回旧行为"(行为不倒退, 只是少了摘模型这一步)。
if(typeof playerChuteClear==='function') playerChuteClear();
else { try{ playerChuteMesh=null; }catch(e){} }
// 玩家第三人称本体 (D9, 2026-09-28): avatar 是对局中首次按 U 才 scene.add 的惰性常驻对象, 不在开局快照里
// ⇒ 上面的台账还原本就会把它摘出场景; 引用不置空的话下一局 playerAvatarEnsure 复用旧 root, 每帧
// visible=true 写在已脱离场景的节点上 = "第三人称隐身 (该中弹还是中弹)"。复位后下次 ensure 原地重建。
// 23b 是世界还原链、可能在不加载 20-player 的子集沙箱里跑, 故 typeof 守卫退化为旧行为 (与上一行同款)。
if(typeof playerAvatarReset==='function') playerAvatarReset();
}
// ═════ 就地还原 ═════
// 返回 true = 世界已回到开局状态; false = 未拍过快照, 只做了"上一局实体退场"(旧行为)
function restorePristineWorld(){
if(!WSN.ready){
if(typeof retireMatchActors==='function') retireMatchActors();
return false;
}
const _t0=(typeof performance!=='undefined'&&performance.now)?performance.now():Date.now();
try{
clearMatchEffects();
// 上一局实体退场 + 机制归位 (单位表/破袭补给库/车队/炮位解绑/小队/玩家挂载点) —— 与旧路径同一份实现
if(typeof retireMatchActors==='function') retireMatchActors();
// ① 场景台账: 本局新增的一切 (工事/残骸/弹坑/布娃娃/粒子/在途弹/工程车) 不在快照里 → 一并摘除
_wsnRestoreGraph(world,WSN.worldKids);
_wsnRestoreGraph(scene,WSN.sceneKids);
// ② 碰撞盒: 运行时新增的整段截掉 (索引稳定 —— BOXES 只在尾部 push, 从不 splice), 其余逐字段写回
_wsnTrim(BOXES,WSN.boxN);
for(let i=0;i<BOXES.length;i++){
const s=WSN.box[i]; if(!s) break;
const b=BOXES[i];
b.dead=!!s[0]; b.minX=s[1]; b.minY=s[2]; b.minZ=s[3]; b.maxX=s[4]; b.maxY=s[5]; b.maxZ=s[6];
}
// ③ 圆柱障碍 (树干/电线杆/草垛: 被推倒/烧毁后 dead 且 r=0, 会被 buildOccupancy 跳过)
_wsnTrim(CYLS,WSN.cylN);
for(let i=0;i<CYLS.length;i++){
const s=WSN.cyl[i]; if(!s) break;
const c=CYLS[i];
c.dead=!!s[0]; c.r=s[1]; c.y0=s[2]; c.y1=s[3];
}
// ④ 可毁结构组 (视觉网格已由台账还原; 这里只回写"被打没了"这件事)
for(let i=0;i<DESTRUCTIBLES.length;i++){
const s=WSN.dest[i]; if(!s) break;
const g=DESTRUCTIBLES[i];
g.dead=!!s[0]; g.hp=s[1];
}
for(const e of WSN.roof){ e.r.done=!!e.done; e.r.dead=e.dead; if(e.dmg!==undefined) e.r.dmg=e.dmg; }
// 受损材质档回退 (B3, 2026-09-27N): 血量已回满, 材质不能还挂着"破墙"档 (与 g.hp 同一份快照口径)
if(typeof structResetDamage==='function') structResetDamage();
// ⑤ 植被逐株状态 + 网格 y
for(const st of WSN.flora){
const r=st.r;
for(const k of WSN_FLORA_FIELDS){
if(_wsnHas(st,k)) r[k]=st[k];
else if(_wsnHas(r,k)) delete r[k]; // 快照里没有 = 构建期就没有这个字段 (如 charred), 一并删掉
}
if(st.my&&r.meshes) for(let i=0;i<r.meshes.length;i++){ const m=r.meshes[i]; if(m&&m.position&&st.my[i]!==undefined) m.position.y=st.my[i]; }
// 完整变换写回 (枯树/椰树倒伏); 无 mt 的旧快照仍走上面那行 y 兜底
if(st.mt&&r.meshes) for(let i=0;i<r.meshes.length;i++){
const m=r.meshes[i], t=st.mt[i];
if(!m||!t) continue;
if(m.position&&m.position.set) m.position.set(t[0],t[1],t[2]);
if(m.quaternion){ m.quaternion.x=t[3]; m.quaternion.y=t[4]; m.quaternion.z=t[5]; m.quaternion.w=t[6];
if(m.rotation&&m.rotation.setFromQuaternion) m.rotation.setFromQuaternion(m.quaternion); }
}
}
// ⑥ 实例批: 矩阵/实例色/数量整体写回 (倒伏姿态、焦黑树干、烧尽的零缩放隐藏全在这里)
for(const e of WSN.inst){
const im=e.im;
if(e.m&&im.instanceMatrix&&im.instanceMatrix.array){ im.instanceMatrix.array.set(e.m); im.instanceMatrix.needsUpdate=true; }
if(e.c&&im.instanceColor&&im.instanceColor.array){ im.instanceColor.array.set(e.c); im.instanceColor.needsUpdate=true; }
if(e.count!==undefined) im.count=e.count;
}
// ⑥b 草丛/庄稼的按格索引表写回 (烧尽时被 delete 的格要回来, 否则"下一局同一格再烧不隐藏实例")
for(const e of WSN.burnInst){
const bc=e.bi&&e.bi.byCell;
if(!bc||!e.cells) continue;
bc.clear();
for(const [k,v] of e.cells) bc.set(k,v);
}
// ⑦ 火焰: 燃料回快照, 其余格状态整体清零
if(WSN.fuel&&typeof FUEL!=='undefined') FUEL.set(WSN.fuel);
try{ FHEAT.fill(0); FBURN.fill(0); FEXPIRE.fill(0); FFX.fill(0); FATT.fill(null); }catch(e){}
try{ FIRE_ACTIVE.length=0; HEATED.length=0; }catch(e){}
try{ fireDmgT=0; fireFlameN=0; fireNavT=0; }catch(e){}
// ⑧ 占位与登记表
PROPS.length=0;
for(const p of WSN.props) PROPS.push(p);
_wsnTrim(coverPoints,WSN.coverN);
// 铁丝网 (2026-09-26 修): 条目不再被坦克 splice 掉 (只置 alive=false), 所以除了截断还要**置回存活** ——
// 旧版只有 _wsnTrim: 上一局被碾掉的铁丝网条目已经不在表里, 截断补不回来, 快照恢复把模型加回世界后
// 就成了"看得见、碾不烂、也不减速伤兵"的摆设; 现在置回 alive + 显回模型 (网格/占位随之在 NAV.refresh 里恢复)。
if(typeof wires!=='undefined'){
for(const w of wires){ if(w&&!w.alive){ w.alive=true; if(w.grp) w.grp.visible=true; } }
}
_wsnTrim(wires,WSN.wireN);
if(typeof MG42S!=='undefined'){ _wsnTrim(MG42S,WSN.mgN); for(const m of MG42S){ m.user=null; m.heat=0; m.fireT=0; m.cdLock=0; } _wsnAimRestore(MG42S,WSN.aimMG); }
if(typeof ATGUNS!=='undefined') _wsnAimRestore(ATGUNS,WSN.aimAT);
if(typeof AAGUNS!=='undefined') _wsnAimRestore(AAGUNS,WSN.aimAA);
if(typeof runtimeCraters!=='undefined') _wsnTrim(runtimeCraters,WSN.craterN);
_wsnTrim(CROP_FIELDS,WSN.cropN);
// ⑨ 旗面: 归属回快照 (开局=中立), 布料顶点回基线, 旗高回该归属的目标位
// (旗高不写快照读数而写"目标位": 旗高是每帧向目标阻尼的动画量, 菜单期待机期间一直在动 ——
//  写目标位才能得到一个稳定且与 updateFlags 同式的复位状态; 快照读数只作字段缺失时的兜底)
for(let i=0;i<FLAGS.length;i++){
const f=FLAGS[i], s=WSN.flags[i];
if(!s) continue;
f.owner=s.owner; f.cap=0; f.capTeam=-1; f.present=[0,0];
if(f.flagMesh&&f.flagMesh.position){
f.flagMesh.position.y=(f.owner!==-1)?(f.poleTop-f.cap*2):((f.gy!==undefined)?f.gy+3.2:s.y);
}
if(f.flagGeo&&f.flagBase){
const pos=f.flagGeo.attributes.position;
for(let k=0;k<pos.count;k++){ pos.setX(k,f.flagBase[k*3]); pos.setZ(k,f.flagBase[k*3+2]); }
pos.needsUpdate=true;
}
if(typeof drawFlagTex==='function') drawFlagTex(f);
}
// ⑨b 大舰复位 (2026-10-01b): 大舰自本批起属于"载入期世界" (快照里有它们的网格), 上一局的瘫痪/
//   进水/炮位废损/巡航偏移不在快照里 —— 统一走 15h capitalReset 单源 (respawnClear + 甲板旗点重绑)。
//   非海战图/只载部分脚本的沙箱按 typeof 守卫跳过。
if(typeof capitalReset==='function'&&typeof capitalShips!=='undefined'&&capitalShips.length){ try{ capitalReset(); }catch(e){} }
// ⑩ 残留光效/HUD (爆炸闪光灯/雷暴白屏)
try{ flashLight.intensity=0; }catch(e){}
try{ flashTimer=0; }catch(e){}
try{ stormFlash=0; const ov=document.getElementById('stormOv'); if(ov) ov.style.opacity=0; }catch(e){}
// ⑪ 占用网格 + 空间索引 + 寻路网格按还原后的碰撞体重建 (顺带抹掉火焰/工事留下的占用格)
try{ _navDirtyT=0; }catch(e){}
try{ NAV.refresh(); }catch(e){ console.warn('[世界还原] 导航重建失败:',e&&e.message); }
// 耗时诊断 (一次换局/回主菜单一次): 实机若感到卡顿, 这条日志是唯一读数
const _t1=(typeof performance!=='undefined'&&performance.now)?performance.now():Date.now();
console.log('[世界还原] 世界已复原: 台账 '+WSN.worldKids.length+' 项 · scene '+WSN.sceneKids.length+' 项 · 碰撞盒 '+WSN.boxN
+' · 植被 '+WSN.flora.length+' 株 · 实例批 '+WSN.inst.length+' · 耗时 '+Math.round(_t1-_t0)+'ms');
return true;
}catch(e){
console.warn('[世界还原] 还原过程出错 (已尽力恢复):',e&&e.message);
return false;
}
}
// 沙箱/调试用只读视图: 当前快照规模 (verify-worldrestore 断言"快照确实拍到了东西")
function worldSnapshotInfo(){
return {ready:WSN.ready,world:WSN.worldKids?WSN.worldKids.length:0,scene:WSN.sceneKids?WSN.sceneKids.length:0,
boxes:WSN.boxN,cyls:WSN.cylN,dest:WSN.dest.length,roofs:WSN.roof.length,flora:WSN.flora.length,
inst:WSN.inst.length,props:WSN.props.length,wires:WSN.wireN,mg:WSN.mgN,flags:WSN.flags.length};
}
