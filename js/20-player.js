// ─────────────────────────────────────────────
// 20-player.js —— 降落伞/交互/玩家控制/相机
// 源: Index.original.html 第 7077-7817 行
// 2026-08-24 切分: 座驾/工事操作 → 20a-seats.js (原第388-609行)
// ─────────────────────────────────────────────
'use strict';
// ===== 降落伞模型 (玩家跳伞 / Bot 空降) =====
let playerChuteMesh=null;
function chuteLine(g,from,to,mat){
const d=V3(to.x-from.x,to.y-from.y,to.z-from.z);
const len=d.length();
if(len<0.01) return;
const m=new THREE.Mesh(new THREE.CylinderGeometry(0.013,0.013,len,3),mat);
m.position.set(from.x+d.x*0.5,from.y+d.y*0.5,from.z+d.z*0.5);
m.quaternion.setFromUnitVectors(V3(0,1,0),d.normalize());
g.add(m);
}
function mkChute(scale=1){
const g=new THREE.Group();
const mat=new THREE.MeshLambertMaterial({color:0x9aa08c,side:THREE.DoubleSide,map:TEX.cloth}); // B8/P3-12 降落伞帆布
const canopy=new THREE.Mesh(new THREE.SphereGeometry(2.3,12,7,0,TAU,0,1.05),mat);
canopy.scale.set(1,0.75,1);
canopy.castShadow=true;
g.add(canopy);
const lm=new THREE.MeshBasicMaterial({color:0x33352c});
const rim=2.3*Math.sin(1.05), rimY=2.3*Math.cos(1.05)*0.75;
for(const a of [0.4,1.97,3.54,5.11]){
chuteLine(g,V3(Math.sin(a)*rim,rimY-0.1,Math.cos(a)*rim),V3(0,-3.3,0),lm);
}
g.scale.setScalar(scale);
return g;
}
function mkChuteForBot(){ return mkChute(0.78); }
// (2026-09-21 A#8 契约E) 收伞单源: 从场景摘掉伞模型并置空。**所有** player.chute=false 的写入点必须在同帧调用它 ——
// 旧写法只在下一帧的 `else if(playerChuteMesh)` 里摘模型, 于是"落地那一帧"伞还挂在头顶 (用户上报的残伞根因)。
// typeof 无依赖: 只碰本文件的两个变量 (playerChuteMesh / scene), 不读任何别人作用域的东西。
function playerChuteClear(){
if(playerChuteMesh){ scene.remove(playerChuteMesh); playerChuteMesh=null; }
}
// 体能回体单源 (2026-10-06 体能批): "距上次耗体 1s 后按 0.16/s 恢复" 的唯一实现 ——
// 主步行链 (updatePlayer 体积分支) 与**早退分支** (巡飞弹 TV 制导 / 载具 / 固定火力点 / 海战 / 大舰炮位) 共用。
// 旧版早退分支在体能结算之前就 return, 体能整个冻结 (不耗也不回), 用户实报"操控巡飞弹/固定火力点时不回体"。
// 座位态 ads 已在 mount* 强制 false ⇒ holdBreath 不可能激活, 座位上天然只会走恢复; 观战仍是恒满原则 (2026-09-02 用户指定)。
function stamRegenTick(pp,dt,nowT){
if(nowT-(pp.stamUseT||0)>1) pp.stamina=Math.min(1,pp.stamina+dt*0.16);
}
// 固定火力点使用前摇 (2026-09-02 用户指定): 按F后需原地操作 EM_CAST_DUR 秒才上机, 移动/再按F/受伤取消
function mountMG(mg){
player.onMG=mg; mg.user=player;
player.pos.x=mg.x-Math.sin(mg.face)*0.85;
player.pos.z=mg.z-Math.cos(mg.face)*0.85;
player.yaw=mg.face+Math.PI; player.pitch=0; player.ads=false;
VM.root.visible=false;
document.getElementById('heatWrap').style.display='block';
}
function mountAT(g){
player.onAT=g; g.user=player;
player.pos.x=g.x-Math.sin(g.face)*AT_CREW_DIST; // 站位单源常量 (00-config)
player.pos.z=g.z-Math.cos(g.face)*AT_CREW_DIST;
player.yaw=g.face+Math.PI; player.pitch=0; player.ads=false;
VM.root.visible=false;
document.getElementById('heatWrap').style.display='block';
}
function mountAA(g){
player.onAA=g; g.user=player;
player.pos.x=g.x; player.pos.z=g.z-0.9;
player.pitch=0.5; player.ads=false;
VM.root.visible=false;
document.getElementById('heatWrap').style.display='block';
}
function mountMortar(m){
player.onMortar=m; m.user=player;
VM.root.visible=false;
document.getElementById('heatWrap').style.display='block';
showScorePop('迫击炮瞄准中');
}
// 观战者从被毁座驾上**安全脱离** (2026-09-26H 观战批, 用户实报"会带着观战模式的玩家一起死") ——
// 车毁链 (15-vehicles Tank.die / 16-aircraft Plane.die) 在"驾驶员是观战者"时调本函数, 取代 player.damage(999)。
// 口径: 车照毁 (观战者的干预照常改变战局), 但**战局反噬观战者本人一律无效** —— 0 死 / 0 票 / 0 杀,
// 人落到车旁平地继续观战 (落点探测与幽灵坦克下车同一套: occBlocked 试 5 个方位)。
// 座位字段一次清干净 (与 die() 的座位复位同规): onVehicle/onNaval 互斥、ffAll/tankView/navalGun/飞行态。
// 注: 常规情况下走不到这里 —— Tank/Plane/NavalCraft.takeDmg 已按 specRide 免伤; 本函数是"被脚本强制摧毁/
// 未来新增载具忘了接免伤"时的兜底 (自洽性由探针 T5 的"强制 die"用例取证)。
// typeof 守卫: 部分沙箱只加载子集脚本, 缺谁都不该把车毁链带崩。
function specRideEject(v){
const p=player;
if(typeof navalSeatRelease==='function'&&p.onNaval) navalSeatRelease(false);
p.onNaval=null;
if(p.onVehicle===v) p.onVehicle=null;
p.ffAll=false; p.tankView=false; p.navalGun=false;
p.flying=false; p.flyAero=false; p._aeroSpd=0;
p.crouch=false; p.prone=false;
p.vel.set(0,0,0);
if(v&&v.pos){
let px=v.pos.x+3.4, pz=v.pos.z;
for(const off of [[3.4,0],[-3.4,0],[0,4.4],[0,-4.4],[4.4,4.4]]){
const tx=v.pos.x+off[0], tz=v.pos.z+off[1];
if(!occBlocked(tx,tz)){ px=tx; pz=tz; break; }
}
p.pos.set(px,0,pz);
p.pos.y=standHeight(px,pz,(v.pos.y||0)+2);
}
p.onGround=true;
VM.root.visible=true;
{ const hw=document.getElementById('heatWrap'); if(hw) hw.style.display='none'; }
if(typeof showScorePop==='function') showScorePop('座驾被毁 · 观战者安全脱离');
return true;
}

// 准星锁定交互目标 (2026-10-06 交互批, 用户裁定"有效距离内准星对准 F 交互物时, F 暂时锁定到它"):
// 解决"补给箱和迫击炮/机枪摆在一起, 按下去的却不是想要的那个"的挑选问题。单源函数 ——
// tryInteract (执行) 与 updateInteractHint (提示) 共用本结果, 提示与执行结构上不可能再脱节。
// 判据三重: ① 在该类交互物的**执行半径**内 (数值与执行段同款) ② 可用性判据与执行段同款
// (存活/占用/冷却/敌我/资源门) ③ 屏幕中心射线夹角最小者, 且到目标的视线不被墙体遮挡
// (raycastWorld, 容差 0.8m —— 目标自身的碰撞盒前缘不算遮挡)。角度阈值随目标半尺寸/距离放宽:
// lim = atan2(half, dist)+3.2°, 即"准星大体落在目标身上"就算对准。
// 返回 {kind,obj} 或 null。座位/甲板/跳帮/前摇层 (tryInteract ①~⑥) **不参与锁定** —— 那些层是
// "自身状态操作" (下炮/下车/取消), 没有挑选歧义; 观战层同理 (幽灵坦克召唤无对象可选)。
function xcInteractLock(){
const p=player;
if(!p.alive||p.loiter) return null;
if(p.onVehicle||p.onNaval||p.onMG||p.onAT||p.onAA||p.onMortar||p.onBattery||p.capitalGun||p.useCast||p.spectator) return null;
const eye=camera.position, fwd=camForward();
if(!fwd||fwd.lengthSq()<0.1) return null;
const cand=[];
const push=(kind,obj,x,y,z,half)=>{
const dx=x-eye.x, dy=y-eye.y, dz=z-eye.z;
const d=Math.sqrt(dx*dx+dy*dy+dz*dz);
if(d<0.4) return;                                        // 贴脸退化
const dot=(dx*fwd.x+dy*fwd.y+dz*fwd.z)/d;
if(dot<0.5) return;                                      // >60° 之外早退 (不可能是"对准")
const ang=Math.acos(Math.min(1,dot));
if(ang<=Math.atan2(half,d)+0.055) cand.push({kind,obj,ang,d,x,y,z});
};
// ── 各类候选: 判据与 tryInteract 执行段逐款同源 ──
for(const m of MORTARS){ if(m.alive&&empReady(m)&&Math.hypot(m.x-p.pos.x,m.z-p.pos.z)<2.8) push('mortar',m,m.x,heightAt(m.x,m.z)+0.55,m.z,0.85); }
for(const tk of tanks){ if(tk.alive&&tk.team===p.team&&Math.hypot(tk.pos.x-p.pos.x,tk.pos.z-p.pos.z)<4.5) push('tank',tk,tk.pos.x,tk.pos.y+0.9,tk.pos.z,1.6); }
{
const nc=(typeof navalNearestBoardable==='function')?navalNearestBoardable():null;
if(nc) push('naval',nc,nc.pos.x,nc.pos.y+0.9,nc.pos.z,1.8);
}
{
const cs=(typeof capNearestBoardable==='function')?capNearestBoardable():null;
if(cs) push('capital',cs,cs.pos.x,cs.pos.y+2,cs.pos.z,3.5);
}
{
const pp=(typeof capNearestParkedPlane==='function')?capNearestParkedPlane():null;
if(pp) push('plane',pp,pp.pos.x,pp.pos.y+1,pp.pos.z,2.2);
}
for(const mg of MG42S){ if(empReady(mg)&&empInReach(mg,p.pos.x,p.pos.y,p.pos.z,2.6)) push('mg',mg,mg.x,heightAt(mg.x,mg.z)+0.6,mg.z,0.9); }
for(const g of ATGUNS){ if(empReady(g)&&empInReach(g,p.pos.x,p.pos.y,p.pos.z,3)) push('at',g,g.x,heightAt(g.x,g.z)+0.9,g.z,1.3); }
for(const g of AAGUNS){ if(empReady(g)&&empInReach(g,p.pos.x,p.pos.y,p.pos.z,3)) push('aa',g,g.x,heightAt(g.x,g.z)+1.1,g.z,1.4); }
{
const b=(typeof batteryNear==='function')?batteryNear(p.pos.x,p.pos.z,3):null;
if(b) push('battery',b,b.x,heightAt(b.x,b.z)+1.0,b.z,1.5);
}
if(p.resupplyCd<=0){
for(const ac of AMMO_CRATES){ if(Math.hypot(ac.x-p.pos.x,ac.z-p.pos.z)<2.6) push('ammo',ac,ac.x,ac.y+0.35,ac.z,0.75); }
if(GAMEMODE==='convoy'&&CAMPAIGN.convoy.escortTeam===p.team){
for(const tr of trucks){ if(tr.alive&&!tr.escaped&&Math.hypot(tr.pos.x-p.pos.x,tr.pos.z-p.pos.z)<3.6&&Math.abs(tr.pos.y-p.pos.y)<3) push('truck',tr,tr.pos.x,tr.pos.y+1,tr.pos.z,2); }
}
if(p.team===0){
for(const sp of SUPPLY_POINTS){ if(Math.hypot(sp.x-p.pos.x,sp.z-p.pos.z)<2.8) push('supply',sp,sp.x,heightAt(sp.x,sp.z)+0.5,sp.z,0.8); }
}
}
if(p.bandResupCd<=0&&p.bandages<p.maxBandages){
for(const c of MED_CRATES){ if(c.team===p.team&&c.uses>0&&Math.hypot(c.x-p.pos.x,c.z-p.pos.z)<2.6) push('medcrate',c,c.x,heightAt(c.x,c.z)+0.4,c.z,0.6); }
}
if(!cand.length) return null;
cand.sort((a,b)=>a.ang-b.ang);
const c0=cand[0];                                        // 只对"最对准者"做遮挡射线 (性能+语义一致)
const dir=V3(c0.x-eye.x,c0.y-eye.y,c0.z-eye.z);
const dist=dir.length(); dir.normalize();
const hit=raycastWorld(eye,dir,Math.max(0.1,dist-0.8));
if(hit&&hit.dist<dist-0.8) return null;                  // 中间隔墙/大石 ⇒ 不锁定 (执行段也够不着)
return {kind:c0.kind,obj:c0.obj};
}
// ★2026-09-22 重做 (用户实报"观战模式下 F 的鱼雷/下车与召唤幽灵坦克严重冲突"): 本函数改成
//   **语义优先级栈** —— 一个 F 键, 同一时刻只有一条语义生效, 按玩家**当前所处状态**从高到低判:
//     ① 幽灵坦克上   → F = 下车 (收车)
//     ② 海战舰艇上   → F = 深水: 鱼雷 / 可涉水·搁浅: 下船 (与普通玩家同一条 20a 判据)
//     ③ 其它 (步行/游泳) → F = 召唤并进入幽灵坦克 (观战专属)
//   【旧版为什么冲突】观战分支原本**排在最前**并直接 return ⇒ 观战者一旦上了艇, F 就永远被
//   "召唤幽灵坦克"吃掉, 鱼雷与下船在真输入链上完全不可达; 更糟的是 specVehBoard 不清 player.onNaval,
//   于是 player 同时挂着"艇的驾驶位"与"幽灵坦克驾驶员", updatePlayer 每帧仍走 updatePlayerNaval,
//   人被钉在艇上却开着白车 —— 状态机劈叉。现在两个座位字段**互斥**(各自上座/下车路径都清对方),
//   优先级栈只在"确实没在任何座位里"时才轮到召唤 ⇒ 结构上不可能再撞。
//   【观战者不走路登艇】(用户 2026-09-22 裁定②): 本函数对观战者**只在 ①② 两态放行**, 其余情况一律
//   走召唤 —— 即"观战步行到艇边按 F 不会上艇", 想开艇请从部署界面选舰艇出生项 (那条路不经过本函数)。
function tryInteract(){
if(!player.alive||player.loiter) return;
const isGhostSeat=player.onVehicle&&player.onVehicle.kind==='ghost';
// ① 幽灵坦克上: F = 下车 (立刻收车; 见 15c-specveh specVehDismount/specVehStow)
if(isGhostSeat){
if(typeof specVehDismount==='function') specVehDismount();
AudioSys.metalSlide(0.2,0.1,500,800);
return;
}
// ② 海战舰船座位 (2026-09-20N 海战批): 在艇上时 F 的语义 = 鱼雷 / 下船 ——
//   靠岸/搁浅等"可步行下船"态 (navalCanFootExit) ⇒ F=下船 (用户裁定③"从舷侧或艏跳板步行下船");
//   其余 (浮在深水) ⇒ F=鱼雷 (定稿 §11.6)。两义的提示文案随状态切换, 见 updateInteractHint。
//   自洽: 鱼雷撞滩哑火, 能下船的浅水本来也发不出鱼雷 ⇒ 两义不互相抢。
//   ★观战者同样走这条 (用户裁定①"状态优先级栈"): 曾在艇上就按艇上的语义, 不再被召唤抢键。
	if(player.onNaval){
	const c=player.onNaval;
	// ★2026-10-03 跳帮登舰 (夺点死锁破解): 艇贴到任何大舰舷侧 (boardR 内, capNearestBoardable 单点,
	//   不分敌我 —— 并靠本舰是回家补给, 并靠敌舰是登舰夺旗) ⇒ F = 登舰。排在两义之前: 并靠时的
	//   明确意图是上舰, 不该被"下船/鱼雷"抢走; 座位互斥/水态复位/VM 收起全在 capBoard 单源里
	//   (与游泳登舰是同一条路径, 不另写第二条)。
	const bs=(typeof capNearestBoardable==='function')?capNearestBoardable():null;
	if(bs&&typeof capBoard==='function'&&capBoard(bs)) return;
	// 2026-09-26E 审计 12: 用 navalCanExitNow 单源 (无鱼雷载具在深水也走"下船=下水游泳", 不再弹无鱼雷发射管)
	if(navalCanExitNow(c)) navalStartExit(c,false);
	else navalFireTorpedo(c);
	return;
	}
	// ②b 大舰甲板 (2026-09-30 阶段五 P4, 15h-capital): 站在甲板上时 F = **走到最近的舷缘跳海**
	//   (甲板是海上陆地, 没有"下船"概念 —— 离开的方式就是走下舷缘落水; 靠近舷缘才放行, 与小艇的
	//   navalCanExitNow "走到船壳边"同一支手感)。
		//   ★2026-10-01b 分炮塔接管 (用户裁定"各个分炮塔可以上去操控"): F 优先级在甲板层内 =
		//   ① 已在炮位上 ⇒ 下炮 (capGunRelease) ② 炮位接管半径内 (CAPITAL_CFG.gunR, 单源 15h capGunNear)
		//   ⇒ 上炮 (capGunMount) ③ 都不是 ⇒ 舷缘跳海。报废炮位 capGunNear 不返回 (打坏了就不能用)。
		//   ★2026-10-01c 修"炮塔无法被玩家接管": 分支触发器旧版是座位字段 player.onCapital —— 只有
		//   走 F 登舰 (capBoard) 才置位, **部署直接落在甲板上的玩家它是空的** ⇒ F 什么都不做 (而提示层
		//   capGunNear 是按位置的, 还会显示"F 操作副炮" —— 提示与判据脱节, 审计 20 的同款病)。
		//   现在按**脚下是哪艘舰** (capDeckOf 单源, 与乘员搬运/旗点同一支判据) 触发, onCapital 只是
		//   capGunMount 内部的座位账 (上炮时自会置位); 跳海/提示同源传舰。
		// ★2026-10-03 高度门: 判"脚下这片甲板"改用带 curY 的 capDeckShipAt —— capDeckOf 不判高度,
		//   而"水线以下不挡"的贴舰底泳者同样落在甲板矩形里 ⇒ 水下的人被甲板层截胡 ("走到舷缘再按 F
		//   跳海"发给潜水员)。onCapital 座位账优先 (上舰时盖的章, 高度必然对)。
		const dShip=player.onCapital||((typeof capDeckShipAt==='function')?capDeckShipAt(player.pos.x,player.pos.z,player.pos.y):((typeof capDeckOf==='function')?capDeckOf(player.pos.x,player.pos.z):null));
		if(dShip){
		if(player.capitalGun){ if(typeof capGunRelease==='function') capGunRelease(); return; }
		// ★2026-10-02b 实机"F 键冲突 (跳海 vs 补充弹药)": 甲板分支旧版无条件 return ⇒ 通用段的弹药箱
		//   补弹 (本文件 ~:330) 在甲板上**永远不可达** —— 站在箱边按 F, 要么被 capGunNear 吃掉去上炮,
		//   要么弹"跳海"提示。补弹按同参 (2.6m / resupplyCd 门) 插进甲板层优先级栈。
		if(player.resupplyCd<=0){
		for(const ac of AMMO_CRATES){
		if(Math.hypot(ac.x-player.pos.x,ac.z-player.pos.z)<2.6){
		player.grabAction={kind:'ammo',crate:ac};
		VM.state='grab'; VM.stateT=0; VM.stateDur=0.85; vmSndFlags={};
		document.getElementById('interact').style.display='none';
		return;
		}
		}
		}
		const g=(typeof capGunNear==='function')?capGunNear():null;
		if(g&&typeof capGunMount==='function'&&capGunMount(g)) return;
		// ★2026-10-02b 冲突同族第二处: 停放的舰载机 (capNearestParkedPlane, 7m) 也排在甲板分支之后 ⇒
		//   航母甲板上走到停机旁按 F 同样是跳海。登机入栈: 上炮 > 登机 > 跳海 (炮位是明确意图, 停机次之)。
		{
		const pp=(typeof capNearestParkedPlane==='function')?capNearestParkedPlane():null;
		if(pp&&typeof capBoardPlane==='function'&&capBoardPlane(pp)) return;
		}
		if(typeof capCanExitNow==='function'&&capCanExitNow(dShip)) capExitNow(dShip);
		else if(typeof showScorePop==='function') showScorePop(t('走到舷缘再按 F 跳海'),0);
		return;
		}
// ③ 观战模式 (2026-09-17 观战扩展批): 常规载具/阵位/补给一概不用 (自由观察专用), 只保留
// **观战专属载具「幽灵坦克」的召唤上车** —— (2026-09-21 A#4 契约C 用户裁定④): F = 在当前位置召唤并直接上车
// (不再要求"4.5m 内有车才进", 也不再有"召唤但人还在车外"的中间态)。
if(player.spectator){
// typeof 守卫: 部分沙箱/探针不加载 15c-specveh, 少了这个可选模块不该让 F 交互报错
if(typeof specVehNear!=='function') return;
// 召唤函数的真实形态 (先读 15c-specveh 再接线): `specVehSummon()` 返回 GhostTank 实例, 内部已经
// 代为 specVehBoard (现状如此) —— 因此按 `!gt.playerDriven` 判"还没上车"再补一次 board, 两种形态都成立:
//   ① summon 内含 board ⇒ playerDriven 已为 true, 跳过 (重复 board 会被其自身 `g.playerDriven` 门挡成 false)
//   ② summon 只就位不上车 ⇒ 这里补 board, 落到"召唤即上车"的同一条口径
// 兜底取全局 SPECVEH: 万一召唤函数被改成不返回值 (只做摆位), 仍能从全局单例拿到车。
const g=(typeof specVehSummon==='function')?specVehSummon():null;
const gt=g||((typeof SPECVEH!=='undefined')?SPECVEH:null);
if(gt&&typeof specVehBoard==='function'&&!gt.playerDriven) specVehBoard(gt);
AudioSys.metalSlide(0.35,0.18,360,900); showScorePop('幽灵坦克已就位 · 观战专属载具');
return;
}
if(player.onVehicle){
const t=player.onVehicle;
if(t.kind==='plane'){
// 跳伞
t.playerDriven=false;
player.onVehicle=null;
player.pos.set(t.pos.x,t.pos.y-2.5,t.pos.z);
player.vel.set(t.fwdDir().x*6,0,t.fwdDir().z*6);
player.chute=true;
player.onGround=false;
if(!playerChuteMesh){ playerChuteMesh=mkChute(); scene.add(playerChuteMesh); }
VM.root.visible=true;
document.getElementById('heatWrap').style.display='none';
showScorePop('跳伞!');
return;
}
t.playerDriven=false; t.isAI=true; t.vel=0;
player.onVehicle=null;
for(const off of [[3.2,0],[-3.2,0],[0,4],[0,-4],[4,4]]){
const px=t.pos.x+off[0], pz=t.pos.z+off[1];
if(!occBlocked(px,pz)){ player.pos.set(px,0,pz); break; }
player.pos.set(t.pos.x+3.2,0,t.pos.z);
}
player.pos.y=standHeight(player.pos.x,player.pos.z,t.pos.y+2);
player.vel.set(0,0,0);
VM.root.visible=true;
document.getElementById('heatWrap').style.display='none';
return;
}
if(player.onMG){
releaseEmpl(player.onMG,true); player.onMG=null; // 下炮: 触发上炮冷却
VM.root.visible=true;
document.getElementById('heatWrap').style.display='none';
return;
}
if(player.onAT){ releaseEmpl(player.onAT,true); player.onAT=null; VM.root.visible=true; document.getElementById('heatWrap').style.display='none'; return; }
if(player.onAA){ releaseEmpl(player.onAA,true); player.onAA=null; VM.root.visible=true; document.getElementById('heatWrap').style.display='none'; return; }
// 迫击炮: 上炮/下炮 (架设后所有人可用, 回收=迫击炮手按B)
if(player.onMortar){
const m3=player.onMortar;
releaseEmpl(m3,true); player.onMortar=null; VM.root.visible=true;
document.getElementById('heatWrap').style.display='none';
return;
}
// 岸防炮 (2026-09-21 A#9 契约D, 玩家交互侧): 已上炮 ⇒ F=下炮 (占位/相机态/VM 全在 batteryDismountPlayer 里, 与 atGun 同规)。
// updatePlayerBattery / batteryMountPlayer / batteryDismountPlayer 由 sea-hud 写在 20a-seats / 15f-battery,
// 一律 typeof 守卫: 只加载部分脚本的沙箱不该因为缺这个模块让 F 报错。
if(player.onBattery){
if(typeof batteryDismountPlayer==='function') batteryDismountPlayer();
else player.onBattery=null; // 兜底: 模块缺失也不能把玩家永久钉在炮位上
VM.root.visible=true;
document.getElementById('heatWrap').style.display='none';
return;
}
// 使用前摇进行中再按F: 取消上机 (释放占位, 不触发上炮冷却)
if(player.useCast){
const ug=player.useCast.g;
if(ug&&ug.user===player) ug.user=null;
player.useCast=null;
showScorePop('使用已取消');
return;
}
// 准星锁定 (2026-10-06 交互批): 地面栈开算前先问一次"准星对准了谁" —— 有锁定时, 锁定类直接用
// 锁定对象、其余类全部让位 (xc 派生判据在 xcInteractLock 内与执行段同款); 无锁定时逐位走旧栈。
const xc=xcInteractLock();
{
const m2=xc?(xc.kind==='mortar'?xc.obj:null):MORTARS.find(m=>m.alive&&empReady(m)&&Math.hypot(m.x-player.pos.x,m.z-player.pos.z)<2.8);
if(m2){
m2.user=player; // 前摇占位: 一门炮同一时刻只允许一个操作者(玩家/Bot同规)
player.useCast={kind:'mortar',g:m2,t:0,dur:EM_CAST_DUR};
AudioSys.click(700,0.25,0.05);
showScorePop('操作迫击炮…保持不动 (移动取消)');
return;
}
}
if(!xc||xc.kind==='tank') for(const t of tanks){
if(xc&&xc.obj!==t) continue;
if(!t.alive||t.team!==player.team) continue;
if(Math.hypot(t.pos.x-player.pos.x,t.pos.z-player.pos.z)<4.5){
if(t.crewBot){ t.crewBot.dismountVehicle(false); showScorePop('你接管了坦克'); }
t.playerDriven=true; t.isAI=false; t.vel=0;
player.onVehicle=t;
player.ads=false; player.nadeHeld=false;
player.yaw=t.yaw+t.turretYaw+Math.PI; player.pitch=0;
VM.root.visible=false;
document.getElementById('heatWrap').style.display='block';
return;
}
}
// 海战载具 (2026-09-20N 海战批): 走到艇边按 F 上艇 —— 陆上 4.5m / 水上游泳贴近 2.5m (用户裁定①,
// 半径单源在 20a-seats navalBoardRadius)。车组交还与座位初始化全在 navalBoard 里 (与部署界面选艇同一条路径)。
{
if(!xc||xc.kind==='naval'){
const nc=(typeof navalNearestBoardable==='function')?navalNearestBoardable():null;
if(nc&&(!xc||xc.obj===nc)&&navalBoard(nc)) return;
}
}
// 大舰登舰 (2026-09-30 阶段五 P4, 15h-capital): 游泳/涉水贴近舷侧按 F 上甲板 —— 半径 CAPITAL_CFG.boardR
// (大舰吃水 6m, 只能从水面侧靠)。排在艇之后: 艇更近就先上艇 (艇是"摆渡到舰边"的自然工具)。
{
if(!xc||xc.kind==='capital'){
const cs=(typeof capNearestBoardable==='function')?capNearestBoardable():null;
if(cs&&(!xc||xc.obj===cs)&&typeof capBoard==='function'&&capBoard(cs)) return;
}
}
// 航母甲板上的舰载机 (P4 2026-09-30): 走到停放中的飞机旁按 F 登机 —— 上机后 Space = 一键弹射起飞。
// 排在登舰之后: 站在舰上时优先"上舰", 飞机只是舰上的家具之一 (要先登舰才够得着)。
{
if(!xc||xc.kind==='plane'){
const pp=(typeof capNearestParkedPlane==='function')?capNearestParkedPlane():null;
if(pp&&(!xc||xc.obj===pp)&&typeof capBoardPlane==='function'&&capBoardPlane(pp)) return;
}
}
if(!xc||xc.kind==='mg') for(const mg of MG42S){
if(xc&&xc.obj!==mg) continue;
if(!empReady(mg)) continue;
if(empInReach(mg,player.pos.x,player.pos.y,player.pos.z,2.6)){
mg.user=player;
player.useCast={kind:'mg',g:mg,t:0,dur:EM_CAST_DUR};
AudioSys.click(700,0.25,0.05);
showScorePop('操作机枪…保持不动 (移动取消)');
return;
}
}
if(!xc||xc.kind==='at') for(const g of ATGUNS){
if(xc&&xc.obj!==g) continue;
if(!empReady(g)) continue;
if(empInReach(g,player.pos.x,player.pos.y,player.pos.z,3)){
g.user=player;
player.useCast={kind:'at',g,t:0,dur:EM_CAST_DUR};
AudioSys.click(700,0.25,0.05);
showScorePop('操作反坦克炮…保持不动 (移动取消)');
return;
}
}
if(!xc||xc.kind==='aa') for(const g of AAGUNS){
if(xc&&xc.obj!==g) continue;
if(!empReady(g)) continue;
if(empInReach(g,player.pos.x,player.pos.y,player.pos.z,3)){
g.user=player;
player.useCast={kind:'aa',g,t:0,dur:EM_CAST_DUR};
AudioSys.click(700,0.25,0.05);
showScorePop('操作防空炮…保持不动 (移动取消)');
return;
}
}
// 岸防炮上炮 (2026-09-21 A#9 契约D): 与上艇/上炮同一处交互链, 半径 3m (与反坦克炮/防空炮同档)。
// 只用契约冻结的三个函数名 (batteryNear/batteryMountPlayer): 15f-battery 由 sea-hud 拥有, 函数缺失时静默跳过。
{
if(!xc||xc.kind==='battery'){
const b=(typeof batteryNear==='function')?batteryNear(player.pos.x,player.pos.z,3):null;
if(b&&(!xc||xc.obj===b)&&typeof batteryMountPlayer==='function'&&batteryMountPlayer(b)) return;
}
}
if(player.resupplyCd<=0){
if(!xc||xc.kind==='ammo') for(const ac of AMMO_CRATES){
if(xc&&xc.obj!==ac) continue;
if(Math.hypot(ac.x-player.pos.x,ac.z-player.pos.z)<2.6){
player.grabAction={kind:'ammo',crate:ac};
VM.state='grab'; VM.stateT=0; VM.stateDur=0.85; vmSndFlags={};
document.getElementById('interact').style.display='none';
return;
}
}
// 劫道模式: 护运玩家唯一的补给=存活运输车 (贴车 3.6m 内全补给)
if((!xc||xc.kind==='truck')&&GAMEMODE==='convoy'&&CAMPAIGN.convoy.escortTeam===player.team){
for(const t of trucks){
if(xc&&xc.obj!==t) continue;
if(!t.alive||t.escaped) continue;
if(Math.hypot(t.pos.x-player.pos.x,t.pos.z-player.pos.z)<3.6&&Math.abs(t.pos.y-player.pos.y)<3){
player.grabAction={kind:'truck',crate:t};
VM.state='grab'; VM.stateT=0; VM.stateDur=0.85; vmSndFlags={};
document.getElementById('interact').style.display='none';
return;
}
}
}
// 劫道方临时补给点 (限时失效): team0 玩家专用
if((!xc||xc.kind==='supply')&&player.team===0){
for(const sp of SUPPLY_POINTS){
if(xc&&xc.obj!==sp) continue;
if(Math.hypot(sp.x-player.pos.x,sp.z-player.pos.z)<2.8){
player.grabAction={kind:'supply',crate:sp};
VM.state='grab'; VM.stateT=0; VM.stateDur=0.85; vmSndFlags={};
document.getElementById('interact').style.display='none';
return;
}
}
}
}
if(player.bandResupCd<=0&&player.bandages<player.maxBandages){
if(!xc||xc.kind==='medcrate') for(const c of MED_CRATES){
if(xc&&xc.obj!==c) continue;
if(c.team!==player.team||c.uses<=0) continue;
if(Math.hypot(c.x-player.pos.x,c.z-player.pos.z)<2.6){
player.grabAction={kind:'medcrate',crate:c};
VM.state='grab'; VM.stateT=0; VM.stateDur=0.85; vmSndFlags={};
document.getElementById('interact').style.display='none';
return;
}
}
}
}
let camTrauma=0, dmgFlash=0;
function addDmgFlash(x){ dmgFlash=Math.min(1,dmgFlash+x); } // owner 接口 (2026-09-06 B7b/P2-14: 15-vehicles 跨文件写改经此)
function addTrauma(x){ camTrauma=Math.min(1.2,camTrauma+x); }
// 严寒 HUD (#coldTip): 文案变化才写 DOM (状态键比较), 离开露天/进屋即隐藏
function coldHudShow(line){
const elm=document.getElementById('coldTip');
if(!elm) return;
if(elm._line!==line){ elm._line=line; elm.innerHTML=line; elm.style.display='block'; }
}
function coldHudHide(){
const elm=document.getElementById('coldTip');
if(elm&&elm._line){ elm._line=null; elm.style.display='none'; }
}
// 观战飞行双模式 (2026-09-01 用户指定, 两者是不同东西):
//  创造悬停(flyAero=false): MC创造式 —— 无重力可悬停, WASD水平 + 空格升/Shift降, 松键缓停
//  气动飞行(flyAero=true):  复用巡飞弹飞行动作 —— 始终沿视线方向前飞不可停, 右键加速(13→40m/s), 俯冲触地落地
function specFlightMove(p,dt){
if(p.flyAero){
const cp=Math.cos(p.pitch), sp=Math.sin(p.pitch);
const dirx=-Math.sin(p.yaw)*cp, diry=sp, dirz=-Math.cos(p.yaw)*cp;
const spd=dampF(p._aeroSpd||13,(mouse2Down?40:13),2.2,dt); // 速度数值与巡飞弹同一组
p._aeroSpd=spd;
p.vel.set(dirx*spd,diry*spd,dirz*spd);
p.pos.x+=p.vel.x*dt; p.pos.y+=p.vel.y*dt; p.pos.z+=p.vel.z*dt;
collideMove(p.pos,0.42);
const gh=standHeight(p.pos.x,p.pos.z,p.pos.y+0.6);
if(p.pos.y<gh){
p.pos.y=gh;
if(p.vel.y<-0.5){ specLand(p); return; } // 俯冲触地: 切回行走
}
}else{
const sy=Math.sin(p.yaw), cy=Math.cos(p.yaw);
const fwd=(keys.KeyW?1:0)-(keys.KeyS?1:0), str=(keys.KeyD?1:0)-(keys.KeyA?1:0);
let tx=-sy*fwd+cy*str, ty=0, tz=-cy*fwd-sy*str;
if(keys.Space) ty+=1;
if(keys.ShiftLeft) ty-=1;
const tl=Math.hypot(tx,ty,tz);
if(tl>0.01){ tx/=tl; ty/=tl; tz/=tl; }
p.vel.x=dampF(p.vel.x,tx*13,3,dt);
p.vel.y=dampF(p.vel.y,ty*11,3,dt);
p.vel.z=dampF(p.vel.z,tz*13,3,dt);
p.pos.x+=p.vel.x*dt; p.pos.y+=p.vel.y*dt; p.pos.z+=p.vel.z*dt;
collideMove(p.pos,0.42);
const gh=standHeight(p.pos.x,p.pos.z,p.pos.y+0.6);
if((p._flyT||0)>0.3&&p.pos.y<=gh+0.05){ specLand(p); return; } // 悬停降落: 落地即切回行走
}
if(p.pos.y>135){ p.pos.y=135; p.vel.y=Math.min(0,p.vel.y); } // 升限: 防止飞出战场
p._flyT=(p._flyT||0)+dt;
}
function specLand(p){
p.pos.y=standHeight(p.pos.x,p.pos.z,p.pos.y+0.6);
p.vel.set(0,0,0);
p.flying=false; p.flyAero=false; p._aeroSpd=0; p.onGround=true;
AudioSys.footstep(true,0);
showScorePop('落地 · 行走状态');
}
// 摔落伤害: 落地瞬间按竖直冲击速度线性结算 (2026-09-02 用户指定); 河道/水面缓冲免伤, 观战免伤由 damage() 兜底
function fallDamage(p){
// 2026-09-18: 落入深水 (>1.2m) 免摔伤 —— 河道/海面/支流一视同仁 (与旧"河道水面免伤"同口径扩展)
if(p.vel.y>=-FALL_SAFE_V||inRiverChannel(p.pos.x,p.pos.z)||waterDepthAt(p.pos.x,p.pos.z)>1.2) return;
const dmg=(-p.vel.y-FALL_SAFE_V)*FALL_DMG_MUL;
p.damage(dmg,null,false);
showScorePop('⚠ 摔落 -'+Math.round(dmg));
}
function updatePlayer(dt,wdt){
// wdt = **世界**帧长 (可选第二实参, 缺省 = dt; 由 24-main 传 dt): 本函数收的第一实参是**本体链**帧长 pdt
// (时停下 = 真实时间), 而海战音频 (发动机/破水/履带/搁浅/进水) 属**战场** —— 只有观察者正在开的那条艇
// 才该跟本体同速。旧版直接把 pdt 喂给 navalAudioTick ⇒ 时停下整片海面静止而所有艇的周期声照发
// (2026-09-27 审计 P1-5)。逐艇解析在 01-audio 内 (specTimeRideDt 单源 + 世界冻结即静音)。
if(typeof wdt!=='number') wdt=dt;
// 海战 HUD tick (2026-09-20N 海战批, 实现在 22-hud 追加段): 座驾面板收尾 + 反舰炮台摧毁播报 —— 每帧一次,
// 放在生死早退**之前**: 阵亡期间己方艇打掉炮台同样要播报。typeof 守卫: 只加载部分脚本的沙箱不该因此报错。
if(typeof navalHudTick==='function') navalHudTick(dt);
// 海战音效每帧 tick (2026-09-20N 海战批, 实现在 01-audio 追加段): 艇发动机音色塑形/进水·沉没/搁浅擦礁/
// 鱼雷压缩空气 —— 每帧一次, 与 24-main 的 updateNaval 同频。放在本文件 (task-5 写入域) 而不是 15d-naval:
// 本段只读 15d 的公开字段, **队友文件零改动**; 静默闸门在 AudioSys 的 api 包装里已挡, 这里只做 typeof 守卫。
// 2026-09-27M: 两参 = (世界帧长, 本体链帧长) —— 逐艇该用哪个由 01-audio 按 specRide 判定。
if(typeof AudioSys!=='undefined'&&AudioSys.navalAudioTick) AudioSys.navalAudioTick(wdt,dt);
if(!player.alive){ return; }
const p=player;
p.meleeCd-=dt; p.resupplyCd-=dt;
if(p.streakBuff&&nowT>=p.streakBuff.until) p.streakBuff=null; // 连杀增益到期 (2026-09-11)
p.bandResupCd=Math.max(0,(p.bandResupCd||0)-dt);
p.suppressV=Math.max(0,p.suppressV-dt*0.8);
// 固定火力点使用前摇: 移动打断, 计时满上机 (目标被夺则提示)
if(p.useCast){
const uc=p.useCast;
if(keys.KeyW||keys.KeyA||keys.KeyS||keys.KeyD||keys.Space||p.flying){
if(uc.g&&uc.g.user===p) uc.g.user=null;
p.useCast=null;
showScorePop('移动打断');
}else{
uc.t+=dt;
if(uc.t>=uc.dur){
const g2=uc.g;
p.useCast=null;
if(uc.kind==='mg'&&g2.user===p) mountMG(g2);
else if(uc.kind==='at'&&g2.user===p) mountAT(g2);
else if(uc.kind==='aa'&&g2.user===p) mountAA(g2);
else if(uc.kind==='mortar'&&g2.alive&&g2.user===p) mountMortar(g2);
else{ if(g2&&g2.user===p) g2.user=null; showScorePop('目标已被占用'); }
}
}
}
// 呼吸回血(削弱): 仅能自然恢复到70, 满血需绷带
if(nowT-p.lastDmgT>6&&p.hp<70) p.hp=Math.min(70,p.hp+4*dt);
// 绷带包扎
if(p.bandaging>0){
p.bandaging-=dt;
if(p.bandaging<=0){
p.bandages--;
p.hp=Math.min(100,p.hp+BANDAGE_HEAL);
showScorePop('包扎完成 +45');
AudioSys.click(1200,0.3,0.06);
}
}
// TV制导中: 视角切至巡飞弹, 左键提前引爆; 本体物理照常模拟 (跳跃中发射也会正常落地)
if(p.loiter){
if(mouseDown&&!p._ltClick){ p._ltClick=true; if(p.loiter) loiterDetonate(p.loiter,p.loiter.pos.clone()); }
if(!mouseDown) p._ltClick=false;
if(!mouse2Down) p._ltRClick=false;
// 观战飞行中引导巡飞弹: 本体保持飞行机动 (视角同时舵控TV弹), 无重力
if(p.spectator&&p.flying){ p.stamina=1; specFlightMove(p,dt); updateInteractHint(); return; }
p.vel.x=dampF(p.vel.x,0,8,dt);
p.vel.z=dampF(p.vel.z,0,8,dt);
p.vel.y-=13*dt;
if(p.chute&&p.vel.y<-3.2) p.vel.y=-3.2;
p.pos.x+=p.vel.x*dt; p.pos.y+=p.vel.y*dt; p.pos.z+=p.vel.z*dt;
collideMove(p.pos,0.42);
const gh=standHeight(p.pos.x,p.pos.z,p.pos.y+0.6);
// 海图水面地板 (★2026-10-03, 与步行块同批): TV制导坠落触深水水面即收伞入水, 不再沉到海床
if(!p.swim&&typeof waterYAt==='function'){
const wy=waterYAt(p.pos.x,p.pos.z);
if(wy>-1e8&&p.pos.y<=wy&&wy>gh+0.6&&waterDepthAt(p.pos.x,p.pos.z)>1.2){
if(p.chute){ p.chute=false; playerChuteClear(); }
p.pos.y=wy-FLOAT_PAD-0.3; p.vel.y=0; p.onGround=false;
}
}
if(p.pos.y<=gh){
if(!p.onGround&&p.vel.y<-4){ p.landDip=Math.min(1,-p.vel.y*0.1); AudioSys.footstep(true,0); }
if(!p.onGround) fallDamage(p);
p.pos.y=gh; p.vel.y=0; p.onGround=true;
// (2026-09-21 A#8 契约E) loiter(TV制导)分支落地: 与步行分支同一处判定, 同样当帧收伞
if(p.chute){ p.chute=false; playerChuteClear(); }
} else if(p.pos.y>gh+0.05) p.onGround=false;
p.landDip=Math.max(0,p.landDip-dt*3);
if(p.chute){
if(!playerChuteMesh){ playerChuteMesh=mkChute(); scene.add(playerChuteMesh); }
playerChuteMesh.position.set(p.pos.x,p.pos.y+3.8,p.pos.z);
playerChuteMesh.rotation.set(Math.sin(nowT*0.7)*0.12,0,Math.cos(nowT*0.6)*0.08);
} else if(playerChuteMesh){ scene.remove(playerChuteMesh); playerChuteMesh=null; }
stamRegenTick(p,dt,nowT); // TV 制导中本体照常回体 (2026-10-06 体能批: 旧版此分支体能冻结)
updateInteractHint();
return;
}
p.recoilPitch*=Math.pow(0.0001,dt*0.7);
p.recoilYaw*=Math.pow(0.0001,dt*0.7);
p.recoilPitch=clamp(p.recoilPitch,-0.2,0.2);
// 架枪检测: 胸前有齐腰遮挡且头顶上方无遮挡 (架枪时沿架设方向检测, 避免转头就脱离)
p.canBrace=false;
if(p.onGround&&!p.prone&&!p.onVehicle&&!p.onMG&&!p.onAT&&!p.onAA&&!p.onBattery&&Math.hypot(p.vel.x,p.vel.z)<0.8){
const bd=p.braced?V3(-Math.sin(p.braceYaw),0,-Math.cos(p.braceYaw)):camForward(); bd.y=0;
if(bd.lengthSq()>0.1){
bd.normalize();
const chestY=p.pos.y+(p.crouch?0.72:1.05);
const hit=raycastWorld(V3(p.pos.x,chestY,p.pos.z),bd,1.15);
if(hit&&hit.kind!=='ground'){
const over=raycastWorld(V3(p.pos.x,chestY+0.55,p.pos.z),bd,1.3);
if(!over) p.canBrace=true;
}
}
}
if(p.braced&&(!p.canBrace||!p.onGround||p.prone)) p.braced=false;
// 架枪状态: 以支点为轴, 视角限制在架设方向左右一定范围内
if(p.braced){
const rel=clamp(angDiff(p.braceYaw,p.yaw),-0.72,0.72);
p.yaw=p.braceYaw+rel;
p.pitch=clamp(p.pitch,-0.5,0.42);
}
if(p.onVehicle){ if(p.onVehicle.kind==='plane') updatePlayerPlane(dt); else updatePlayerTank(dt); stamRegenTick(p,dt,nowT); return; }
if(p.onAT){ updatePlayerAT(dt); stamRegenTick(p,dt,nowT); return; }
if(p.onAA){ updatePlayerAA(dt); stamRegenTick(p,dt,nowT); return; }
if(p.onMG){ updatePlayerMG(dt); stamRegenTick(p,dt,nowT); return; }
// 岸防炮座位 (2026-09-21 A#9 契约D): 与载具/固定火力同为**唯一分派点**上的一支 —— updatePlayerBattery 由
// sea-hud 写在 20a-seats; typeof 守卫 (模块缺失时静默跳过, 不报错)。
if(p.onBattery){ if(typeof updatePlayerBattery==='function') updatePlayerBattery(dt); stamRegenTick(p,dt,nowT); return; }
if(p.onMortar){ updatePlayerMortar(dt); stamRegenTick(p,dt,nowT); return; }
// 海战舰船 (2026-09-20N 海战批): 座位在主循环里的**唯一分派点**, 与载具/固定火力同位 (实现在 20a-seats)。
// 座位字段是 p.onNaval 而不是 p.onVehicle (定稿 §11.6) —— 见 20a-seats 文件头的三条理由。
if(p.onNaval){ updatePlayerNaval(dt); stamRegenTick(p,dt,nowT); return; }
// 大舰炮位接管 (2026-10-01b, 15h-capital): 座位分派点上的又一支 —— 炮位上**不动/不开步兵枪**,
// 视角仍由 19-input 采集, 座圈回转/开火在 updateCapital → capGunTick 消费 (与 AI 同一数据流)。
// 站位由 capGunTick 钉在炮位锚点 (舰在动, 锚点跟着动), 这里只做炮位侧的常规收账与提示。
if(p.capitalGun){
if(p.nadeHeld) p.nadeHeld=false;                       // 上炮前举着的雷就地收回 (与上固定炮位同规)
if(p.ads) p.ads=false;
stamRegenTick(p,dt,nowT);
if(typeof updateInteractHint==='function') updateInteractHint();
return;
}
// 观战模式: 弹药/物资每0.5s回满 (无限补给) + 创造飞行分支 —— 2026-09-01 用户指定
if(p.spectator){
if(!p._specSupT||nowT-p._specSupT>0.5){
p._specSupT=nowT;
for(const s of p.slots){ s.mag=s.def.mag; s.reserve=s.def.reserve; }
const g2=clsGear(p.cls,p.team);
p.nadeCount=g2.nades; p.atNades=g2.atn; p.smokeCount=g2.smoke; p.incinCount=g2.incin;
p.bandages=p.maxBandages;
}
// 观战飞行 (悬停/气动): 飞行机动 + **左键照常开火** (2026-09-17 观战扩展批, 用户补充指定);
// 引导巡飞弹时左键仍是"手动引爆"(上面那段, 优先级更高), 故此处只在未控弹时接管
if(p.flying){ p.stamina=1; specFlightMove(p,dt); playerFireTick(dt,true); updateInteractHint(); return; }
}
const fwd=(keys.KeyW?1:0)-(keys.KeyS?1:0);
const str=(keys.KeyD?1:0)-(keys.KeyA?1:0);
if(p.pendingBuild&&VM.state==='build'&&(fwd!==0||str!==0||keys.Space)){ cancelBuild(p); showScorePop('建造已取消'); }
// ── 水体状态 (2026-09-18 塔拉瓦批, 全库通用; 与 Bot 同规则 —— 纲领第 2 条) ──
// 涉水 (0.5~1.35m): 减速但可开火(精度下降); 游泳 (>1.35m): 浮于水面, 不可冲刺/卧倒/开火, Shift=下潜
const WS=waterStateAt(p.pos.x,p.pos.y,p.pos.z);
// ★2026-09-26H 观战批 (B8): 观战者**照常入水游泳** —— 旧版把 spectator 排除在 swimming 之外, 于是观战者
//   掉进海里不漂浮、直接沉底在"行走态"里 (屏幕挂着水下滤镜、只能沿着海床挪回岸上); 用户裁定"观战者在水里
//   按漂浮处理"。这里只摘掉 `!p.spectator` 这一项, 浮力/泳速/下潜全套走既有单源 (观战者免伤 ⇒ 不会淹死,
//   且 22-hud 的憋气条对观战者不显示, 见那里 p.spectator!==true 的门)。
const swimming=WS.state==='swim'&&!p.onVehicle&&!p.chute&&!p.flying&&!p.onMG&&!p.onAT&&!p.onAA&&!p.onMortar&&!p.onBattery;
const wading=WS.state==='wade';
// 湿沙档 (2026-09-26E 审计 33): ≤WADE_DEPTH 的浅水 —— 00-config 自 2026-09-18 就声明"×0.9",
// 但旧版只映射 wade/swim ⇒ 0.9 档从未生效 (过膝以下的水里全速跑)。现在按声明档消费。
const wetting=WS.state==='wet';
p.swim=swimming; p.wading=wading&&!swimming; p.waterWy=WS.wy;
if(swimming){ p.crouch=false; p.prone=false; p.braced=false; p.ads=false; }
// ★2026-09-26E (审计 29): 涉水音效整类缺失 —— 旧版本文件全文**无一处 AudioSys.splash**,
//   涉水态照常播干地脚步、深水坠落也仍是 footstep(true) ⇒ "入水/游泳/上浮全部无声, 涉水时听到的是干地脚步"
//   (错误的音比没有音更像 BUG)。这里按**水态跃迁**播一次入水扑通 (08-effects 的 waterSplash 单源,
//   它内含 AudioSys.splash 与粒子; 缺模块时退回直接调音频)。
{
const wPrev=p._wStatePrev||'dry';
const wNow=swimming?'swim':(wading?'wade':(wetting?'wet':'dry'));
if(wNow!==wPrev){
p._wStatePrev=wNow;
const wetNow=(wNow!=='dry'), wetPrev=(wPrev!=='dry');
if(wetNow&&!wetPrev){                       // 干→湿: 入水扑通 (规模随入水速度)
const sc=clamp(0.5+Math.abs(p.vel.y)*0.12,0.5,1.6);
if(typeof waterSplash==='function') waterSplash(V3(p.pos.x,WS.wy,p.pos.z),sc,Math.abs(p.vel.y)>5,false);
else if(typeof AudioSys!=='undefined'&&AudioSys.splash) AudioSys.splash(0,Math.abs(p.vel.y)>5);
}else if(!wetNow&&wetPrev){                 // 湿→干: 上岸滴水 (轻一声)
if(typeof AudioSys!=='undefined'&&AudioSys.splash) AudioSys.splash(0.6,false);
}
}
}
const wantSprint=!swimming&&keys.ShiftLeft&&fwd>0&&!p.ads&&p.stamina>0.05&&!p.crouch&&p.bandaging<=0;
if(wantSprint&&p.prone) p.prone=false;
if(wantSprint) p.braced=false;
p.sprinting=wantSprint;
p.holdBreath=!swimming&&keys.ShiftLeft&&p.ads;
let leanTgt=0;
if(!p.sprinting&&!p.prone&&p.onGround&&!p.braced){ leanTgt=(keys.KeyQ?-1:0)+(keys.KeyE?1:0); }
p.leanT=dampF(p.leanT,leanTgt,10,dt);
if(p.spectator) p.stamina=1; // 观战: 无限体力 —— 冲刺/屏息/跳跃均不消耗 (2026-09-02 用户指定)
else if(p.sprinting){ p.stamina=Math.max(0,p.stamina-dt*0.22/STAM_SPRINT_MUL); p.stamUseT=nowT; }
// 屏息耗速 0.3→0.12/s (2026-10-06 体能批, 用户裁定"只降耗"): 旧值 0.3 是冲刺的 3.4 倍 —— 按住 Shift
//   冲刺时一旦开镜(右键)会自动激活屏息, 满条 3.3s 耗光, 用户实报"跑步开枪体能异常加快"。0.12 ≈ 冲刺 1.36 倍,
//   保留"屏息是有限资源"的设计但不再惩罚性的贵; 激活逻辑 (Shift+开镜) 维持原样不动。
else if(p.holdBreath){ p.stamina=Math.max(0,p.stamina-dt*0.12); p.stamUseT=nowT; }
// 大海致命化 (2026-10-01c 用户设想"上浮会迅速耗尽体力条"): 纯海战图 (terr:'opensea') 游泳**只耗不回**,
//   满条 ~7.7s 耗尽 —— 比冲刺 (0.088/s) 更费力气; 耗尽后由下面游泳分支强制下沉接溺水链。陆战图游泳零变化。
else if(swimming&&CAMPAIGN.terr==='opensea'){ p.stamina=Math.max(0,p.stamina-dt*CAPITAL_CFG.seaSwimDrain); p.stamUseT=nowT; }
else stamRegenTick(p,dt,nowT); // 回体单源 (1s 冷却窗 + 0.16/s), 与座位/巡飞弹早退分支共用
const seaExhausted=swimming&&CAMPAIGN.terr==='opensea'&&p.stamina<=0.001;
if(p.holdBreath&&p.stamina<=0.02) p.holdBreath=false;
let speed=p.prone?1.15:p.crouch?2.2:(p.sprinting?6.4:4.3);
// 持枪移速系数 (2026-09-28 阶段三 P1, 用户裁定"不同武器移速不同, 手枪最快"): 武器表 wSpd 单源
// (09a-defs: 手枪 1.0 > 冲锋枪 0.97 > 卡宾/栓动 0.95~0.96 > STG44/自动 0.94 > 狙击 0.93 > 火箭筒/反坦克枪 0.9)。
// 游泳/涉水等水态系数在下面叠加; 载具/座位态不走这段地面移速。Bot 同款乘区见 14-bots vel 应用点。
speed*=(p.curW&&p.curW.def&&p.curW.def.wSpd)||1;
if(swimming) speed=((p.diveD||0)>0.2?SWIM_SPD*0.85:SWIM_SPD)*(seaExhausted?0.55:1); // 游泳/潜泳 (潜行更慢; 体力耗尽的泳者更慢, 2026-10-01c)
else if(wading) speed*=WADE_SPD;                              // 涉水 (0.5~1.35m): ×0.55
else if(wetting) speed*=WET_SPD;                              // 湿沙/踝深 (≤0.5m): ×0.9 (2026-09-26E 审计 33)
if(!swimming){
if(p.ads) speed*=0.55;
if(p.bandaging>0) speed*=0.45;
if(VM.state==='reload') speed*=0.8;
if(nowT-(p.wireT||-9)<0.3) speed*=0.42;
if(p.streakBuff) speed*=p.streakBuff.speedMul; // 连杀增益: 步兵移速提升 (载具不受益, 2026-09-11)
}
// 深谷激流: 徒涉大龙河严重减速 + 被冲向下游 + 持续受创 (桥面不受影响)。
// ★2026-09-26E (审计 27): 游泳态**不吃这 0.38 的减速** —— 旧版游泳也吃 ⇒ 泳速 2.0×0.38=0.76 <
//   冲移 1.5 m/s ⇒ 落水后逆流游不动 = "落水必死、无自救手段"。现在激流的代价落在持续伤害上
//   (RAPIDS_DMG 8/s, 12.5s 致死 ⇒ 想横渡照样死), 而游速 2.0 > 冲移 1.5 ⇒ 掉进河里能游回岸。
if(inRiverChannel(p.pos.x,p.pos.z)&&!swimming) speed*=0.38;
// (旧版此处还有 `else if(inShallowChannel) speed*=0.55` 的浅水减速 —— 2026-09-26E 起由水态三档
//  统一承担 (wade ×0.55 / wet ×0.9), 不再叠加: 旧版在冰河/湿沙上叠出 ×0.55×0.9 的双罚,
//  且站在河心线附近的**干岸**上也吃 ×0.55 —— 那是 2026-09-18 水态机之前的口径残留)
const sy=Math.sin(p.yaw), cy=Math.cos(p.yaw);
let mx=(-sy*fwd + cy*str), mz=(-cy*fwd - sy*str);
const ml=Math.hypot(mx,mz);
if(ml>0.01){ mx/=ml; mz/=ml; }
if(p.braced&&(fwd!==0||str!==0)){ p.braced=false; AudioSys.metalSlide(0.16,0.07,500,900); }
if(p.braced){ mx=0; mz=0; }
const accel=p.onGround?38:6;
p.vel.x=dampF(p.vel.x,mx*speed,accel*dt>1?12:accel,dt);
p.vel.z=dampF(p.vel.z,mz*speed,accel*dt>1?12:accel,dt);
if(swimming){
// ── 游泳/潜水 (2026-09-18): 无重力 —— 浮力把脚托到"水面下 1.32m"(头露出水面, 眼高≈水面上 0.3m);
// Shift 下潜 (至多 DIVE_MAX, 且不得穿海床), 空格主动上浮, 松键自动缓慢上浮; 不可跳跃
// ── 大海致命化 (2026-10-01c): 体力耗尽的泳者**强制下沉** (没力气浮了), 且浮不上来/潜不下去 ——
//   头一没入水面就走既有憋气链, 且挣扎态憋气消耗 ×seaDrownMul (见下) ⇒ 海里 ~15s 内带走一个人。
const bed=heightAt(p.pos.x,p.pos.z,true);
if(seaExhausted){
p.diveD=Math.min(DIVE_MAX,(p.diveD||0)+CAPITAL_CFG.seaSinkRate*dt);
if(!p._seaSank){ p._seaSank=true; showScorePop('⚠ 体力耗尽! 正在下沉…'); }
}
else if(keys.ShiftLeft) p.diveD=Math.min((p.diveD||0)+DIVE_DOWN*dt,DIVE_MAX);
else if(keys.Space) p.diveD=Math.max(0,(p.diveD||0)-DIVE_UP*1.5*dt);
else p.diveD=Math.max(0,(p.diveD||0)-DIVE_UP*dt);
// ★2026-09-26E (审计 37): 玩家浮力并入波场 —— 旧版只有浮标与艇模型吃 waveAmp (海面网格是平面、
//   玩家浮力按 SEA.level) ⇒ 同屏"船在颠、人不动"。现在人与船同波 (海面网格仍是有意静止的静态几何,
//   波是 ±0.15m 的视觉偏移; 船本来就浮在它上面, 人跟着船一起颠才是自洽的)。
const wv=(typeof navalWaveAt==='function')?navalWaveAt(p.pos.x,p.pos.z):0;
const targetY=Math.max(WS.wy-FLOAT_PAD-p.diveD+wv, bed+0.12);
p.vel.y=0;
p.pos.y=dampF(p.pos.y,targetY,7,dt);
p.onGround=false;
}else{
if(keys.Space&&p.onGround&&p.stamina>0.1){ p.vel.y=4.6; p.onGround=false; p.stamina-=0.08; p.stamUseT=nowT; p.crouch=false; p.prone=false; p.braced=false; }
p.vel.y-=13*dt;
}
if(p.chute){
if(p.vel.y<-3.2) p.vel.y=-3.2;
// (2026-09-21 A#8 契约E) 落地收伞: 这一处管"已经在伞降态却已经落地"的兜底 (正常落地在下面的接地块里收,
// 那一帧才是真正的"落地当帧")。两处都是 置 false + 同帧摘模型, 旧写法要等下一帧的 `else if` 才摘。
if(p.onGround){ p.chute=false; playerChuteClear(); }
// 降落伞模型: 头上打开圆顶+系绳
if(!playerChuteMesh){ playerChuteMesh=mkChute(); scene.add(playerChuteMesh); }
playerChuteMesh.position.set(p.pos.x,p.pos.y+3.8,p.pos.z);
playerChuteMesh.rotation.set(Math.sin(nowT*0.7)*0.12,0,Math.cos(nowT*0.6)*0.08);
} else if(playerChuteMesh){ scene.remove(playerChuteMesh); playerChuteMesh=null; }
// 坡度物理 (2026-09-12): 地面态水平位移过闸 (上坡>40°减速/>65°封, 下坡不设限; 腾空/伞降/游泳不适用)
if(p.onGround&&!p.onVehicle&&!swimming){
const mv=slopeGateMove(p.pos,p.vel.x*dt,p.vel.z*dt);
p.pos.x+=mv[0]; p.pos.z+=mv[1];
}else{ p.pos.x+=p.vel.x*dt; p.pos.z+=p.vel.z*dt; }
p.pos.y+=p.vel.y*dt;
collideMove(p.pos,0.42);
const gh=standHeight(p.pos.x,p.pos.z,p.pos.y+0.6);
// 海图水面地板 (★2026-10-03 修"跳伞下到海底才解除伞"): 深水上空触水面=落地即入水 —— 收伞转游泳,
//   不再一路沉到海床才触发接地 (海图 standHeight=海床, 伞兵要坠 40m+)。水面承接免摔伤; 入水扑通
//   由水态跃迁单源播 (wPrev dry→swim)。wy>gh+0.6 门挡掉旱地/浅涉水; p.swim 门挡掉主动下潜。
if(!p.swim&&typeof waterYAt==='function'){
const wy=waterYAt(p.pos.x,p.pos.z);
if(wy>-1e8&&p.pos.y<=wy&&wy>gh+0.6&&waterDepthAt(p.pos.x,p.pos.z)>1.2){
if(p.chute){ p.chute=false; playerChuteClear(); }
p.pos.y=wy-FLOAT_PAD-0.3; p.vel.y=0; p.onGround=false;
}
}
if(swimming){
p.pos.y=Math.max(p.pos.y,gh+0.02); // 游泳不穿海床/不落进实体
}else{
if(p.pos.y<=gh){
if(!p.onGround&&p.vel.y<-4){ p.landDip=Math.min(1,-p.vel.y*0.1); AudioSys.footstep(true,0); }
if(!p.onGround) fallDamage(p);
p.pos.y=gh; p.vel.y=0; p.onGround=true;
// (2026-09-21 A#8 契约E) **落地当帧收伞**: 接地判定就在这一帧, 所以 chute=false 与摘模型必须在这里做 ——
// 不能只靠上面伞降块里"下一帧才看到 onGround"的兜底 (那正是"落地那一帧还挂着伞"的根因)。
// 摘完模型后, 下面那个 `if(p.chute)…else if(playerChuteMesh)` 自然成为空操作, 不会重复挂伞。
if(p.chute){ p.chute=false; playerChuteClear(); }
} else if(p.pos.y>gh+0.05) p.onGround=false;
}
p.landDip=Math.max(0,p.landDip-dt*3);
// ── 憋气/溺水 (2026-09-18, 与 Bot 同规则): 头部没入水面起消耗, OXY_MAX 秒耗尽 → 每秒 OXY_DMG 掉血 (可溺死);
//    出水 OXY_REFILL 秒回满 (浮在水面游泳不消耗 —— 头在水面上) ──
{
const hd=headDepthAt(p.pos.x,p.pos.y,p.pos.z);
p.headDepth=hd;
if(hd>0){
// 溺水挣扎 (2026-10-01c 大海致命化): 体力耗尽的泳者头入水后憋气消耗 ×seaDrownMul (换气急促),
//   OXY_MAX 22s 的从容憋气在"正在淹死"的人身上只有 ~7s —— 否则体力链杀不死人 (下沉 1m 只要 1s)。
const oxMul=(seaExhausted&&CAMPAIGN.terr==='opensea')?CAPITAL_CFG.seaDrownMul:1;
p.oxy=(p.oxy===undefined?1:p.oxy)-dt*oxMul/OXY_MAX;
if(p.oxy<=0){
p.oxy=0;
p._drownAcc=(p._drownAcc||0)+OXY_DMG*dt;
if(p._drownAcc>=1){ const dd=Math.floor(p._drownAcc); p._drownAcc-=dd; p.damage(dd,null,false); }
}
}else{
p.oxy=Math.min(1,(p.oxy===undefined?1:p.oxy)+dt/OXY_REFILL);
p._drownAcc=0;
}
}
// 激流: 持续受创并被冲向下游 (桥面不受影响)
if(inRiverChannel(p.pos.x,p.pos.z)){
p.damage(RAPIDS_DMG*dt,null,false);
const rd=riverDirAt(p.pos.x,p.pos.z);
if(rd){ p.pos.x+=rd[0]*1.5*dt; p.pos.z+=rd[1]*1.5*dt; }
if(nowT-(p._rapidsHintT||-9)>2.5){ p._rapidsHintT=nowT; showScorePop('⚠ 雨季激流! 快离开河道或上桥'); }
}
const sp2=Math.hypot(p.vel.x,p.vel.z);
p.stepT=(p.stepT||0)-dt*sp2*(p.sprinting?1.25:1);
// ★2026-09-26E (审计 29): 水里不走"干地脚步" —— 涉水/湿沙态改播水体噪声 (无水体噪声模块时压掉脚步,
// 宁可安静也不放错音; 深水坠落的那声 footstep(true) 也一并改判)。
if(p.stepT<=0&&sp2>0.8&&p.onGround){
p.stepT=1.55;
const inW=(p.swim||p.wading||p._wStatePrev==='wet'||p._wStatePrev==='wade'||p._wStatePrev==='swim');
if(inW){ if(typeof AudioSys!=='undefined'&&AudioSys.splash) AudioSys.splash(0.35,false); }
else AudioSys.footstep(p.sprinting,0);
}
// 开火 (地面: 冲刺/包扎中/游泳不可开火) —— 与观战飞行共用 playerFireTick 单源
playerFireTick(dt,!p.sprinting&&p.bandaging<=0&&!p.swim);
// 举雷瞄准期引信照走 (2026-09-30 批2 用户裁定"保留计时"): 到点**不炸** —— 引信到点只是"武装完成",
// 此后触地/撞敌才炸 (13-combat nadeStep 单源判据)。旧版这里到点就在自己脚下 explodeAt = 用户报的
// "仍会自雷": 按住 G/3/4/6 举雷瞄准是**必须**的瞄准动作, 举满 3.8s 必炸自己且无处可躲。
// 现在举多久都不会炸手 —— 只是手里那颗雷越来越"即时" (出手后第一次碰到什么就炸什么)。
if(p.nadeHeld) p.nadeFuse=Math.max(0,p.nadeFuse-dt);
// ── 严寒失温 (2026-09-05 城市组·斯大林格勒, 严厉版): 露天静止 COLD_OFF 秒起每秒 COLD_DMG (可冻死);
//    移动/进建筑(头顶有遮蔽)/载具/固定火力位/跳伞/巡飞弹制导 即中断 —— Bot 同判定 (一视同仁) ──
if(CAMPAIGN.cold&&!p.spectator){
const coldMoved=Math.hypot(p.vel.x,p.vel.z)>0.6;
const coldBusy=p.onVehicle||p.onMG||p.onAT||p.onAA||p.onMortar||p.onBattery||p.chute||p.flying||p.loiter||p.useCast;
if(coldMoved||coldBusy||coldSheltered(p.pos.x,p.pos.y,p.pos.z)){
coldHudHide();
p._coldT=0; p._coldAcc=0;
}else{
p._coldT=(p._coldT||0)+dt;
if(p._coldT>COLD_OFF-8) coldHudShow(`❄ 严寒 · 露天静止 ${Math.min(COLD_OFF,Math.ceil(p._coldT))}/${COLD_OFF}s — 移动或进入建筑`);
if(p._coldT>COLD_OFF){
p._coldAcc=(p._coldAcc||0)+COLD_DMG*dt;
if(p._coldAcc>=1){ const d=Math.floor(p._coldAcc); p._coldAcc-=d; p.damage(d,null,false); }
coldHudShow('❄ <b>失温中</b> -'+COLD_DMG+'/秒 · 快移动或进屋!');
}
}
}
updateInteractHint();
}
// ===== 玩家开火单源 (2026-09-17 观战扩展批) =====
// 射速冷却 / 弹匣与备用弹 / 半自动-全自动扳机 / 空仓自动换弹 —— 抽成一份, 供**地面**与
// **观战飞行(悬停·气动)** 两条 updatePlayer 分支共用 (用户补充指定: 飞行状态下按左键也要能开火)。
// canFire = 调用方的前置闸门: 地面排除"冲刺中/包扎中", 飞行态无此限制 (观战飞行本就不冲刺)。
function playerFireTick(dt,canFire){
const w=player.curW;
// 观战连狙的无差别火力标记 (2026-09-20 观战连狙批, 用户口径"只有观战连狙可打双方"):
// 每帧按"观战身份 + 当前武器 key"同步一次 —— 换枪/下车/关观战都会在同帧内落回 false,
// 因此不存在"打过一枪之后 ffSpecSniper 残留、换回步枪还能打友军"的窗口。
// 写进 curW.key 而不是 def 上的字段: 观战连狙只是副武器槽的一把普通武器, 判据必须跟"手上这把枪"走。
player.ffSpecSniper=!!(player.spectator&&w&&w.key==='specsniper');
player.fireT-=dt;
player.bloom=Math.max(0,player.bloom-dt*4);
if(mouseDown&&w&&VM.state==='idle'&&player.fireT<=0&&!matchOver&&canFire){
if(w.mag>0){
if(w.def.type==='auto'||!player.fireHeld) playerShoot(w);
} else if(!player.fireHeld){ AudioSys.click(2600,0.2,0.03); tryReload(); }
player.fireHeld=true;
}
if(!mouseDown) player.fireHeld=false;
}
function playerShoot(w){
const p=player;
// 开火瞬间把无差别火力标记落到"这一枪的武器"上 (2026-09-20 观战连狙批): playerFireTick 每帧已同步,
// 这里再按实际开火的 w 落定一次 —— 开火路径不只有 updatePlayer (观战飞行分支/沙箱探针也会直接调 playerShoot)。
p.ffSpecSniper=!!(p.spectator&&w&&w.key==='specsniper');
w.mag--;
// 巡飞弹不挂普通射速CD(rpm10→6秒): 装填动画+实际飞行就是间隔,
// 否则换弹完毕后还要干等到火控计时结束才能再射
p.fireT=w.def.loiter?0:60/w.def.rpm;
// (2026-09-21 A#2 契约G) 第三人称开火后坐计时: 纯观感量, 与上面这行 fireT(射速冷却) **完全独立** ——
// 姿势机 (updatePlayerAvatar) 只读它做"右肩后坐 + 枪口上跳", 不改射速/散布/命中判定中的任何一项。
p.fireAnimT=FIRE_ANIM_T;
// 起点/方向 (2026-09-20 第三人称批): 第三人称下 **弹道起点 = 角色眼位** (不是相机位置), 方向 = "眼位→准星命中点"
// —— 见 playerFireOrigin/playerAimDir 的注释。其余情况两者原样等价于旧的 camera.position/camForward(), 行为不变。
const oS=playerFireOrigin();
// ★ 必须 let: 瞄准吸附 (2026-09-27) 会把 dir 换成"掰过的新方向" —— 见下面两处 aimAssistDir 调用点
let dir=playerAimDir();
if(w.def.mortar){
// 迫击炮: 高抛曲射
vmFireKick(); addTrauma(0.3);
AudioSys.mortarThunk(0);
const v=dir.clone().multiplyScalar(27);
v.y=Math.max(v.y+9,13);
v.addScaledVector(p.vel,0.3);
const m=new THREE.Mesh(nadeGeoAT,vmMats.gun);
m.castShadow=true; m.position.copy(oS); scene.add(m);
nades.push({m,pos:oS.clone().addScaledVector(dir,0.7),vel:v,fuse:9,thrower:p,team:p.team,spin:V3(4,0,1),bounces:0,mortar:true,src:'迫击炮'}); // src: 弹体自带标签 (本分支与火箭筒同样提前 return 走不到 _src 行, 2026-09-29)
spawnP(PT.dark,oS.x+dir.x,oS.y+dir.y,oS.z+dir.z,dir.x,1.5,dir.z,0.6,2,0.7,0.6,0.3);
return;
}
if(w.def.loiter){
// 巡飞弹: 发射后进入TV制导视角, 装填延迟到引爆之后
vmFireKick(); addTrauma(0.45);
spawnP(PT.flash,oS.x+dir.x,oS.y+dir.y,oS.z+dir.z, dir.x*2,dir.y*2,dir.z*2, 0.7,7,0.1,1,0,true);
spawnP(PT.dark,oS.x+dir.x,oS.y+dir.y,oS.z+dir.z, dir.x*2,1.5,dir.z*2, 0.9,2.4,0.9,0.7,0.5);
fireLoiter(p,oS.clone().addScaledVector(dir,0.9),dir);
return;
}
if(w.def.rocket){
// 火箭筒也吃腰射/瞄准 lerp (2026-09-28k): 表里登记的 spreadHip 此前从未生效 —— 腰射火箭=瞄准火箭白嫖精度
const sp=lerp(w.def.spreadHip,w.def.spreadAds,VM.adsBlend)*(Math.PI/180)*0.5;
const rv=camRight(), uv=rv.clone().cross(dir).negate();
dir.addScaledVector(rv,rand(-sp,sp)).addScaledVector(uv,rand(-sp,sp)).normalize();
// 瞄准吸附 (2026-09-27): 火箭筒是直瞄武器 ⇒ 与枪弹同档; 挂在**散布之后** —— 掰的就是这一发的最终方向。
// 队友不做吸附对象 (ff 只为"无差别火力"那两条链放开; 火箭筒不在其列)。
if(typeof aimAssistDir==='function') dir=aimAssistDir(oS,dir,VM.adsBlend>0.5?'ads':'hip',{team:p.team,ff:false});
vmFireKick(); addTrauma(0.4);
fireRocket(p,oS.clone(),dir,w.def,V3());
return;
}
const adsB=VM.adsBlend;
let spread=lerp(w.def.spreadHip,w.def.spreadAds,adsB)*(Math.PI/180)*0.5;
// 姿势精度加成维持原档 (2026-09-28k 用户裁定撤销微小化): 蹲 ×0.8 / 趴 ×0.5 —— 姿势另有受击框收益
// (raySoldiers 趴 0.6m 高 / 蹲 1.25m 高圆柱) 与 Bot 瞄准点下移 (0.32/0.9), 叠加后体感明显。
spread*=(1+p.bloom*1.4)*(p.prone?0.5:p.crouch?0.8:1)*(p.onGround?1:2.2)*(Math.hypot(p.vel.x,p.vel.z)>1?1.4:1);
if(p.wading) spread*=1.35; // 涉水据枪: 精度下降 (2026-09-18; 游泳态不可开火, 见 playerFireTick 闸门)
if(p.holdBreath) spread*=0.4;
if(p.braced) spread*=0.35;
const rv=camRight(), uv=rv.clone().cross(dir).negate();
dir.addScaledVector(rv,rand(-spread,spread)).addScaledVector(uv,rand(-spread,spread)).normalize();
p.bloom=Math.min(1,p.bloom+0.16);
// 瞄准后坐折扣分档 (2026-09-28k 用户裁定"瞄准加成分武器区分"): 镜狙 0.7 / 非镜栓动 0.78 / 其余 0.85
const rec=w.def.recoil*0.011*(p.prone?0.68:p.crouch?0.85:1)*(adsB>0.5?(w.def.scoped?0.7:w.def.type==='bolt'?0.78:0.85):1)*(p.braced?0.45:1);
p.recoilPitch+=rec;
p.recoilYaw+=rand(-1,1)*w.def.recSide*0.006;
p.pitch+=rec*0.55;
p.yaw+=rand(-1,1)*w.def.recSide*0.003;
vmFireKick();
addTrauma(w.def.kick*0.9);
AudioSys.gunshot(w.def.snd,0,0);
const o=oS; // 弹道起点: 第三人称=角色眼位, 第一人称=camera.position (同 playerFireOrigin)
p._src=w.def.name||''; // 击杀来源: 当前武器名
// 瞄准吸附 (2026-09-27, 用户要求): 枪弹的最后一道工序 —— 散布/后坐都已结算完, 这里只把"差一点点打中"
// 的那一枪轻轻掰回目标 (开镜档收容角略大); 关档/无候选时原样返回, 零行为漂移。
// 无差别火力 (观战连狙) 才放开同队过滤: 与 coFfFire 同一口径, 不给普通武器"帮打队友"的吸附。
if(typeof aimAssistDir==='function') dir=aimAssistDir(o,dir,adsB>0.5?'ads':'hip',{team:p.team,ff:!!p.ffSpecSniper});
fireBullet(p,o,dir,w.def,null);
if(!w.def.enbloc||w.mag>0){
const cp=oS.clone().add(camForward().multiplyScalar(0.35)).add(camRight().multiplyScalar(0.14)).add(V3(0,-0.05,0));
if(w.def.type!=='bolt') spawnCasing(cp,camRight(),V3(0,1,0));
}
if(w.def.enbloc&&w.mag===0){
setTimeout(()=>AudioSys.ping(),80);
const clipP=oS.clone().add(camForward().multiplyScalar(0.4));
spawnCasing(clipP,camRight(),V3(0,1.5,0));
}
if(w.def.type==='bolt'&&w.mag>0){
VM.state='bolt'; VM.stateT=0; VM.stateDur=w.def.boltT||1.0;
vmSndFlags={};
}
if(w.mag===0&&w.def.type!=='bolt'){ setTimeout(tryReload,350); }
else if(w.mag===0){ setTimeout(tryReload,1000); }
}
function updateInteractHint(){
// 2026-09-06 B6/P2-25: 10Hz 节流 (状态签名瞬变时旁路立即刷新 —— 上下载具/阵位/阵亡/观战切换不受节流影响)
// ★2026-09-22 补 onNaval (bit 2048) 与 onVehicle.kind==='ghost' (bit 4096):
//   提示行本函数是**按指纹变化**触发的, 而上艇只改 p.onNaval、上/下幽灵坦克只改 p.onVehicle 的 kind ——
//   两者原先都不在指纹里 ⇒ 观战者"步行 → 上艇"这一下提示**不会刷新**, 屏幕上还停着"F 召唤并进入幽灵坦克"
//   (用户报的"F 冲突"在 UI 上的直接来源)。幽灵坦克单独占一位: kind 切换 (tank↔ghost) 时 onVehicle 位恒为 1,
//   只看 onVehicle 那一位同样不刷新。
const sig=(player.onVehicle?1:0)|(player.onMG?2:0)|(player.onMortar?4:0)|(player.onAT?8:0)|(player.onAA?16:0)|(player.spectator?32:0)|(player.alive?64:0)|(player.useCast?128:0)|(player.thirdPerson?256:0)|(player.onBattery?512:0)|(player.navalGun?1024:0)|(player.onNaval?2048:0)|((player.onVehicle&&player.onVehicle.kind==='ghost')?4096:0)|(player.capitalGun?8192:0)|((typeof capGunNear==='function'&&capGunNear())?16384:0);
if(sig===updateInteractHint._sig&&nowT-updateInteractHint._t<0.1) return;
updateInteractHint._sig=sig; updateInteractHint._t=nowT;
// 兵种技能常驻小提示 (右下角)
const tip=document.getElementById('clsTip');
	let tt='';
	// 兵种技能常驻小提示 (右下角) —— 海战驾驶位不显示兵种提示 (p.onNaval): 那时 B/G/V 等步兵动作
	// 已被 19-input 的座位闸门挡掉, 提示里再写"按 B 放医疗箱"就是错误引导; U 视角提示在下面单独一行照常显示。
	if(player.alive&&player.deployed&&!player.onVehicle&&!player.onNaval&&!player.onMG&&!player.onAT&&!player.onAA&&!player.onBattery){
	if(player.loiter) tt=player.spectator
	?t2('<b>左键</b> 自爆 · <b>右键</b> 加速 · <b>鼠标</b> 制导 · <b>F</b> 切换视角 · <b>T</b> 弃弹传送')
	:t2('<b>左键</b> 自爆 · <b>右键</b> 加速 · <b>鼠标</b> 制导 · <b>F</b> 切换视角');
	else if(player.spectator) tt=t2('观战中 · <b>双击空格</b> 悬停飞行 · <b>H</b> 气动飞行(右键加速) · <b>左键</b> 开火 · 副武器=观战连狙 · 免伤·不被索敌 · <b>F</b> 召唤幽灵坦克');
	else if(player.onMortar) tt=t2('<b>左键</b> 发射 · <b>鼠标</b> 调弹道 · <b>F</b> 离开');
	else if(player.cls===4){
	const bt2=BUILD_MENU[player.buildSel||0];
	const bn2=bt2==='mg'?mgDefOfTeam(player.team).name:BUILD_NAMES[bt2];
	tt=player.mortarPlaced
	?t2('<b>5</b> 工事: {0} ({1}点) · <b>B</b> 建造 · <b>6</b> 回收迫击炮 · <b>F</b> 上炮 · 剩 {2} 点',t2(bn2),BUILD_COST[bt2],(player.buildCount||0))
	:t2('<b>5</b> 工事: {0} ({1}点) · <b>B</b> 建造 · <b>6</b> 架设迫击炮 · 剩 {2} 点',t2(bn2),BUILD_COST[bt2],(player.buildCount||0));
	}
	else if(isLoiterClass()) tt=t2('<b>左键</b> 发射巡飞弹(TV制导) · <b>6</b> 燃烧弹');
}
// 第三人称开关提示 (2026-09-20 第三人称批): 步战/观战飞行都可用 U 切 —— 载具/巡飞弹/跳伞各有自己的追尾视角, 不提示。
// 单列一行而不是拼进上面每条兵种/观战提示串: 那些串是**整串进词典**的 (中文原文即键), 拼接会逼着词典再补十几条。
if(player.alive&&player.deployed&&!player.onVehicle&&!player.onMG&&!player.onAT&&!player.onAA&&!player.onMortar&&!player.onBattery&&!player.loiter&&!player.chute){
const u=player.thirdPerson?t2('<b>U</b> 第三人称: 开'):t2('<b>U</b> 第三人称: 关');
tt=tt?tt+'<br>'+u:u;
}
// 观战工具行 (2026-09-26H 观战批; 2026-09-27I 收敛为"只留时停"): 时停 K + 信息层 J —— 与 U 行同规单独一行。
// 不管在不在座驾里都显示 (观战者站在艇上/白车里同样要看这两个键)。
if(player.alive&&player.deployed&&player.spectator){
const s2=t2('<b>K</b> 时停(冻结战场 · 你本人仍可走动/飞行) · <b>J</b> 观战信息层');
tt=tt?tt+'<br>'+s2:s2;
}
if(tip._last!==tt){ tip._last=tt; tip.innerHTML=tt; tip.style.display=tt?'block':'none'; }
const elm=document.getElementById('interact');
// ★2026-09-22: 提示行必须与 tryInteract 的**优先级栈逐级同序** —— 旧版观战分支同样排在最前, 于是
//   观战者在艇上时看到的是"F 召唤并进入幽灵坦克", 而 F 实际被艇的座位吃掉/或反过来 (用户报的"冲突"
//   在 UI 上同样可见)。现在三条语义各自先判自己的状态, 只有都不成立才轮到观战召唤。
if(player.onVehicle&&player.onVehicle.kind==='ghost'){
elm.style.display='block';
elm.innerHTML=t2('<b>F</b> 下车 · <b>W/S</b>驾驶 <b>A/D</b>转向 <b>鼠标</b>炮塔 <b>左键</b>主炮 <b>右键</b>机枪 <b>C</b>车长镜 · 观战专属');
return;
}
if(player.useCast){ // 固定火力点使用前摇进度
elm.style.display='block';
elm.innerHTML=t2('使用中… {0}s (移动中止)',Math.max(0,(player.useCast.dur-player.useCast.t)).toFixed(1));
return;
}
// 海战舰船驾驶位 (2026-09-20N 海战批): F 的两义按"可步行下船"与否切换 —— 与 tryInteract 的判据同源。
// 浮在深水时用定稿给出的操作行 '[左键] 主炮 · [右键] 机炮 · [F] 鱼雷' (键已存在); 两栖车无鱼雷管时用
// '[左键] 主炮 · [右键] 机炮'。可下船时改提示下船 (键 'F' 仍是同一个, 语义随状态)。
// 2026-09-21: 补 C 三态提示 (追尾/炮手镜/艏向第一人称) —— 与 19-input 的 navalCycleView、22-hud 的操作行同源。
	if(player.onNaval){
	const c=player.onNaval;
	const view=t2(player.navalGun?'<b>C</b> 炮手镜 (稳像)':(player.thirdPerson?'<b>C</b> 视角: 追尾':'<b>C</b> 视角: 艏向'));
	elm.style.display='block';
	// ★2026-10-03: 贴帮优先提示跳帮 (与 tryInteract 的插队顺序同序 —— 提示与判据同源)
	const bs=(typeof capNearestBoardable==='function')?capNearestBoardable():null;
	elm.innerHTML=bs
	?t2('<b>F</b> 跳帮登舰 · <b>W/S</b>驾驶 <b>A/D</b>转向 <b>左键</b>主炮 <b>右键</b>机炮')+' · '+view
	:navalCanFootExit(c)
	?t2('<b>F</b> 下船 · <b>W/S</b>驾驶 <b>A/D</b>转向 <b>左键</b>主炮 <b>右键</b>机炮')+' · '+view
	:t2((c.spec&&c.spec.torpedo>0)?'[左键] 主炮 · [右键] 机炮 · [F] 鱼雷':'[左键] 主炮 · [右键] 机炮')+' · '+view;
	return;
	}
// 观战 (2026-09-17 观战扩展批): 常规载具/阵位/补给一概不提示 (幽灵坦克与舰艇座位已在上面各自判过)
if(player.spectator){
if(typeof specVehNear==='function'){
elm.style.display='block';
elm.innerHTML=t2('<b>F</b> 召唤并进入幽灵坦克 (观战专属载具)');
return;
}
elm.style.display='none'; return;
}
if(player.onVehicle&&player.onVehicle.kind==='plane'){ elm.style.display='block'; elm.innerHTML=t2('<b>F</b> 跳伞 · <b>W/S</b>油门 <b>A/D</b>压坡转向 <b>鼠标</b>拉杆 <b>左键</b>机枪 <b>右键/B</b>炸弹'); return; }
if(player.onVehicle){ elm.style.display='block'; elm.innerHTML=t2('<b>F</b> 离开坦克 · <b>WASD</b>驾驶 <b>左键</b>主炮 <b>右键</b>机枪 <b>C</b>炮手镜'); return; }
if(player.onMG){ elm.style.display='block'; elm.innerHTML=t2('<b>F</b> 离开机枪'); return; }
	// 大舰炮位 (2026-10-01b 分炮塔接管): 已在炮位上=离开; 否则接管半径内有活炮位=操作 (与 tryInteract 同序)。
	// 排在 onMG 之后 / MORTARS 之前 —— 大舰甲板上没有机枪/迫击炮, 次序不与陆上提示竞争。
	if(player.capitalGun){ elm.style.display='block'; elm.innerHTML=t2('<b>F</b> 离开炮位 · <b>左键</b> 开火 · <b>鼠标</b> 瞄准'); return; }
	// ★2026-10-02b 甲板层提示整段与 tryInteract 的甲板分支同序 (补弹 > 上炮 > 登机 > 跳海) —— 旧版这里
	//   只有一条 capGunNear: 箱边会漏出下面的通用"补充弹药"提示而按 F 却是跳海; 艇靠帮时更会漏出
	//   "F 进入 PT 艇" (F 实际是跳海) —— 审计 20 "提示与判据脱节"的甲板版。跳海不可用时提示怎么走到舷缘。
	{
	// ★2026-10-03 高度门 (与 tryInteract 甲板分支同源): capDeckOf 不判高度, 贴舰底泳者会被甲板提示截胡
	const dShip=(player.onCapital||((typeof capDeckShipAt==='function')?capDeckShipAt(player.pos.x,player.pos.z,player.pos.y):((typeof capDeckOf==='function')?capDeckOf(player.pos.x,player.pos.z):null)));
	if(dShip){
	if(player.resupplyCd<=0){
	for(const ac of AMMO_CRATES){
	if(Math.hypot(ac.x-player.pos.x,ac.z-player.pos.z)<2.6){
	elm.style.display='block'; elm.innerHTML=t2('<b>F</b> 补充弹药'); return;
	}
	}
	}
	const cg=(typeof capGunNear==='function')?capGunNear():null;
	if(cg){ elm.style.display='block'; elm.innerHTML=t2('<b>F</b> 操作 {0}',t2(cg.name)); return; }
	{
	const pp=(typeof capNearestParkedPlane==='function')?capNearestParkedPlane():null;
	if(pp){ elm.style.display='block'; elm.innerHTML=t2('<b>F</b> 登机 · <b>Space</b> 弹射起飞'); return; }
	}
	const canJump=(typeof capCanExitNow==='function')?capCanExitNow(dShip):false;
	elm.style.display='block';
	elm.innerHTML=canJump?t2('<b>F</b> 跳海'):t2('走到舷缘再按 F 跳海');
	return;
	}
	}
if(player.onMortar){ elm.style.display='block'; elm.innerHTML=t2('<b>F</b> 离开迫击炮 · <b>左键</b> 发射 · <b>鼠标</b> 调整弹道'); return; }
if(player.onAT){ elm.style.display='block'; elm.innerHTML=t2('<b>F</b> 离开反坦克炮'); return; }
if(player.onAA){ elm.style.display='block'; elm.innerHTML=t2('<b>F</b> 离开防空炮'); return; }
// 岸防炮 (2026-09-21 A#9 契约D): 已上炮=离开; 否则 3m 内有可操作炮位 = 操作 (与 tryInteract 的判据同源)
if(player.onBattery){ elm.style.display='block'; elm.innerHTML=t2('<b>F</b> 离开岸防炮'); return; }
// ★2026-09-26E (审计 20): 迫击炮提示的**次序**与 tryInteract 对齐 —— 旧版提示把它排在 tanks/naval 之后,
// 而 tryInteract 的 mortar-near 在它们**之前** ⇒ 站在"已架设迫击炮 + 本方坦克/舰艇"之间时, 提示写
// "F 进入 PT 艇"、按下却是"操作迫击炮" (触发条件窄, 但属"三处逐级同序"里的真实错序)。
// 这里把它提到 tanks 之前 (与 tryInteract 同一位置), 其余次序一律不动。
// 准星锁定 (2026-10-06 交互批): 与 tryInteract 同一单源 xcInteractLock —— 锁定时只显示锁定物,
// 无锁定时逐位走旧栈; 顺带把机枪/迫击炮等判据补齐到执行段同款 (empReady)。
const xc=xcInteractLock();
if(!xc||xc.kind==='mortar') for(const m of MORTARS){
if(xc&&xc.obj!==m) continue;
if(!m.alive||!empReady(m)) continue; // ★empReady 单源补齐 (旧版漏 cdLock: 重建冷却期提示"可用"按 F 却无响应)
if(Math.hypot(m.x-player.pos.x,m.z-player.pos.z)<2.8){
elm.style.display='block';
elm.innerHTML=(m.owner===player)?t2('<b>F</b> 使用迫击炮 · <b>B</b> 回收'):t2('<b>F</b> 使用迫击炮');
return;
}
}
for(const t of tanks){
if(xc&&xc.kind!=='tank') break;
if(xc&&xc.obj!==t) continue;
if(t.alive&&t.team===player.team&&Math.hypot(t.pos.x-player.pos.x,t.pos.z-player.pos.z)<4.5){
elm.style.display='block'; elm.innerHTML=t2('<b>F</b> {0} {1}',t2(t.crewBot?'接管':'进入'),t2(t.name)); return;
}
}
// 海战载具 (2026-09-20N 海战批): 走到艇边按 F 上艇 (陆上 4.5m / 水上游泳贴近 2.5m, 用户裁定①)
{
if(!xc||xc.kind==='naval'){
const nc=(typeof navalNearestBoardable==='function')?navalNearestBoardable():null;
if(nc&&(!xc||xc.obj===nc)){ elm.style.display='block'; elm.innerHTML=t2('<b>F</b> {0} {1}',t2((nc.crewBot||nc.driverBot)?'接管':'进入'),t2(nc.name)); return; }
}
}
if(!xc||xc.kind==='mg') for(const mg of MG42S){
if(xc&&xc.obj!==mg) continue;
if(!empReady(mg)||!empInReach(mg,player.pos.x,player.pos.y,player.pos.z,2.6)) continue; // ★empReady 补齐 (同上)
elm.style.display='block'; elm.innerHTML=t2('<b>F</b> 使用 {0}',t2((mg.def&&mg.def.name)||'重机枪')); return;
}
if(!xc||xc.kind==='at') for(const g of ATGUNS){
if(xc&&xc.obj!==g) continue;
if(!empReady(g)||!empInReach(g,player.pos.x,player.pos.y,player.pos.z,3)) continue; // ★empReady 补齐
elm.style.display='block'; elm.innerHTML=t2('<b>F</b> 使用反坦克炮'); return;
}
if(!xc||xc.kind==='aa') for(const g of AAGUNS){
if(xc&&xc.obj!==g) continue;
if(!empReady(g)||!empInReach(g,player.pos.x,player.pos.y,player.pos.z,3)) continue; // ★empReady 补齐
elm.style.display='block'; elm.innerHTML=t2('<b>F</b> 使用防空炮'); return;
}
// 岸防炮上炮提示 (2026-09-21 A#9 契约D): 半径/存活/占用判定全在 batteryNear 里 (单源), 这里只出文案
{
if(!xc||xc.kind==='battery'){
const b=(typeof batteryNear==='function')?batteryNear(player.pos.x,player.pos.z,3):null;
if(b&&(!xc||xc.obj===b)){ elm.style.display='block'; elm.innerHTML=t2('<b>F</b> 操作岸防炮'); return; }
}
}
if(player.resupplyCd<=0){
if(!xc||xc.kind==='ammo') for(const ac of AMMO_CRATES){
if(xc&&xc.obj!==ac) continue;
if(Math.hypot(ac.x-player.pos.x,ac.z-player.pos.z)<2.6){
elm.style.display='block'; elm.innerHTML=t2('<b>F</b> 补充弹药'); return;
}
}
// 劫道模式: 护运玩家只能贴车补给
if((!xc||xc.kind==='truck')&&GAMEMODE==='convoy'&&CAMPAIGN.convoy.escortTeam===player.team){
for(const t of trucks){
if(xc&&xc.obj!==t) continue;
if(!t.alive||t.escaped) continue;
if(Math.hypot(t.pos.x-player.pos.x,t.pos.z-player.pos.z)<3.6){
elm.style.display='block'; elm.innerHTML=t2('<b>F</b> 从运输车补充补给'); return;
}
}
}
if((!xc||xc.kind==='supply')&&player.team===0){
for(const sp of SUPPLY_POINTS){
if(xc&&xc.obj!==sp) continue;
if(Math.hypot(sp.x-player.pos.x,sp.z-player.pos.z)<2.8){
elm.style.display='block'; elm.innerHTML=t2('<b>F</b> 从临时补给点补充补给'); return;
}
}
}
}
if(player.bandResupCd<=0&&player.bandages<player.maxBandages){
if(!xc||xc.kind==='medcrate') for(const c of MED_CRATES){
if(xc&&xc.obj!==c) continue;
if(c.team!==player.team||c.uses<=0) continue;
if(Math.hypot(c.x-player.pos.x,c.z-player.pos.z)<2.6){
elm.style.display='block'; elm.innerHTML=t2('<b>F</b> 拿取绷带'); return;
}
}
}
elm.style.display='none';
}
let camBobT=0;
// 无 UI 航拍环绕几何单源 (2026-09-17 用户插话): 开局前的主菜单背景与"打完一局返回主界面"时的背景是同一圈环绕。
// 相位=弧度 (nowT*0.05 ≈ 125s 一圈), 高度/半径/注视点只在这里写一次。**必须留在模块级** —— 它是 24-main
// 冻结分支跨文件调用的入口 (塞进 updateCamera 里会变成函数内局部, 菜单期根本调不到)。
function aerialCamPose(phase){
camera.position.set(Math.sin(phase)*80,42,Math.cos(phase)*80);
camera.lookAt(0,2,0);
}
// 菜单期航拍动态 (2026-09-17 用户插话: "正常胜利后的开始界面是静态的结束前的视角, 应当改成正常的无UI航拍地图视角"):
// 返回主界面后主循环被 menuHold 整体冻结 (24-main), 冻结分支只渲染不更新相机 —— 画面于是停在"结束前那一帧"。
// 故菜单期由 24-main 的冻结分支显式调用本函数, 并用**真实帧时间**推进相位: 冻结期 nowT 不前进 (主循环把它累进 nowOff),
// 直接复用 nowT 只会得到一张静止的图 (等于没修)。
let menuCamPhase=0;
function updateMenuCamera(dt){
menuCamPhase+=Math.min(dt,0.1)*0.05;
aerialCamPose(menuCamPhase);
// 视场回到相机初始档: 上一局可能停在机瞄/炮镜的窄视场 (02-scene 建相机时 74), 否则航拍会被拉成望远镜
camera.fov=74; camera.updateProjectionMatrix();
if(typeof SKY!=='undefined'&&SKY) SKY.position.copy(camera.position); // 天空盒跟随相机 (与主循环同一约定, 否则远裁剪面切黑)
const so=document.getElementById('scopeOv'); if(so) so.style.display='none'; // 开镜状态留在菜单里会盖一层镜片遮罩
if(playerAvatar) playerAvatar.root.visible=false; // 主菜单航拍不出现玩家本体 (第三人称开着回主菜单时)
}
// ═════════ 步行第三人称 (2026-09-20 第三人称批, 键位 U) ═════════
// 用户口径: 增加第三人称切换功能 (含步行; 观战飞行/载具已有追尾视角, 语义与按键统一由本开关 + 各自原有键承担)。
// 设计要点 (为什么这么做):
//   ① 只作用"步战相机分支" —— 载具(追尾/C 车长镜)、巡飞弹(F 切换)、跳伞的追尾视角各有自己的键与语义,
//      本开关不去动它们 (thirdPersonOn 与这些状态互斥), 否则会出现两套视角打架。
//   ② 开镜(ADS)期间强制第一人称: 镜片遮罩/机瞄对齐是第一人称语义, 不做"第三人称机瞄"。
//   ③ 弹道仍从**角色眼位**出发, 不从相机位置 —— 见 playerFireOrigin/playerAimDir, 这是最容易埋 bug 的地方。
//   ④ 相机防穿墙 + 地面下限 + 视场过渡, 与跳伞/载具追尾同一套做法 (raycastWorld / dampF)。
const TP_DIST=3.6;   // 相机后拉基准距离 (米)
const TP_MIN=1.25;   // 防穿墙后的最近距离下限 (再近就贴脸)
const TP_LIFT=0.42;  // 相对视线轴的抬高 (米): 否则角色后脑勺正好压在准星中心
const TP_SIDE=0.5;   // 向右肩偏移 (米): 越肩视角, 角色让开屏幕中心
const TP_GROUND=0.35;// 相机离地高度下限 (米): 下坡/趴下/贴地时不钻地形
const TP_FOV=70;     // 第三人称视场 (第一人称档 74; 过渡见 thirdPersonFovTick)
const TP_AIM_FAR=120;// 准星前方无遮挡时的弹道归零距离 (米)
// 步行第三人称是否生效 (互斥清单即"不生效"清单: 载具/巡飞弹/跳伞/固定火力/游泳/开镜/海战舰船)
// 海战载具单列 (2026-09-20N): 艇上也有第三人称 (追尾), 但那是 updateCamera 的海战分支自己按
// p.thirdPerson 二选一, 不走本函数 —— 本函数的语义是"步行第三人称", 故把 onNaval 也列进互斥清单。
function thirdPersonOn(){
const p=player;
// ★2026-10-04 (海战审计 V3): 补大舰两个座位 —— onCapital (甲板步行态要第三人称没问题, 但**炮位接管**
//   capitalGun 是固定锚点的操炮态, 步行第三人称追尾机会钻进炮塔/舰岛; 旧版互斥清单漏了它)。
return !!(p.thirdPerson&&p.alive&&!p.onVehicle&&!p.onNaval&&!p.onCapital&&!p.capitalGun&&!p.loiter&&!p.chute&&!p.ads
&&!p.onMG&&!p.onAT&&!p.onAA&&!p.onMortar&&!p.onBattery&&!p.swim);
}
// 角色"眼位"单源: 第三人称相机锚点与**开火弹道起点**共用同一处坐标 (p.eyeH 与第一人称相机同一阻尼值)
function playerEyePos(){ return V3(player.pos.x,player.pos.y+(player.eyeH||1.62),player.pos.z); }
// 开火起点: 第三人称 = 眼位; 其余情况 (第一人称/载具/观战飞行/跳伞) 保持原样 = 相机位置, 不改既有手感
function playerFireOrigin(){ return thirdPersonOn()?playerEyePos():camera.position.clone(); }
// 第三人称准星归零 (2026-09-20): 相机中心射线上"第一个实体"的距离 —— 世界几何/士兵/载具,
// 与 fireBullet 的命中管线同一批评判体; 找不到就按 TP_AIM_FAR 归零。
// 为什么必须把士兵也算进来: 只按世界几何求归零点的话, 站在开阔地瞄准 20m 外的敌人时归零点在墙/120m 外,
// 从眼位出去的弹道与准星在 20m 处会差 1m 以上 (第三人称视差), 表现就是"准星对着人却打不中"。
function tpAimPoint(camF){
const o=camera.position;
let bestD=TP_AIM_FAR;
const wr=raycastWorld(o,camF,bestD);
if(wr) bestD=wr.dist;
const ss=raySoldiers(o,camF,bestD,player,0,true); // noTeamFilter: 准星指到谁就是谁 (敌我过滤是伤害的事)
if(ss) bestD=ss.t;
for(const t of tanks){ if(!t.alive) continue; const r=rayCyl(o,camF,vehHitCyl(t),bestD); if(r) bestD=r.t; }
for(const t of trucks){ if(!t.alive) continue; const r=rayCyl(o,camF,truckHitCyl(t),bestD); if(r) bestD=r.t; }
return o.clone().addScaledVector(camF,bestD);
}
// 开火方向: 第三人称下相机被抬高 + 右肩偏移, 相机中心射线与"从眼位直接沿视线"出去的直线不再重合 ——
// 若仍用 camForward(), 子弹落点会与准星所指差一个固定视差 (越近越明显)。做法与主流第三人称射击同解:
// 先求出**准星下的那个点** (tpAimPoint), 再让弹道从眼位指向该点 ⇒ 弹道经过准星命中点, 准星与落点一致;
// 起点仍是角色眼位 ⇒ 不会从后脑勺/身后开枪。第一人称与其它状态原样返回 camForward() (零行为变化)。
// 退化保护: 准星命中点若比眼位还近 (贴着墙低头看), 沿相机射线外推到"眼位再往前 1.2m", 避免弹道朝后打。
function playerAimDir(){
const camF=camForward();
if(!thirdPersonOn()) return camF;
const ep=playerEyePos();
const aimPt=tpAimPoint(camF);
const dCamEye=camera.position.distanceTo(ep);
if(camera.position.distanceTo(aimPt)<dCamEye+1.2)
aimPt.copy(camera.position).addScaledVector(camF,dCamEye+1.2);
const d=aimPt.sub(ep);
if(d.lengthSq()<1e-6) return camF;
return d.normalize();
}
// ── 投掷出手点/方向单源 (2026-09-30 批2): 18-game releaseNade 与 22-hud updateNadeArc 共用 ──
// 用户本批报"预瞄抛物线仍沿视线直往正前方, 一人称看就是一条线段; 三人称与一人称显示完全一致"。根因是
//   **出手点 = camera.position** (旧版 18-game/22-hud 各写一遍): 起点落在相机轴线上 ⇒ 整条弹道都在
//   "相机轴线所在的竖直平面"内 ⇒ 投影到屏幕**必然是一条线** (数学必然, 与弧线高低无关); 三人称相机后拉
//   后起点仍在轴线上 ⇒ 两视角形状一模一样。
// 修法: 出手点 = **右手** (眼位往右/往下偏) —— 与 fireBullet 的 playerFireOrigin/playerAimDir 同纪律:
//   (i) 起点偏出相机轴线 ⇒ 一人称有视差, 看得见"从右下角划出去"的弧; (ii) 起点挂在**身体**上而非相机上
//   ⇒ 三人称看到的是"从人手里飞出去"的同一条弹道, 与一人称形状不同而落点相同 (预演即实弹)。
// 方向 = 从出手点指向**准星命中点** (tpAimPoint 单源, 含士兵/载具/世界几何) ⇒ 视差在远处收敛, 越远越贴准星。
const NADE_HAND_R=0.24, NADE_HAND_D=0.30;   // 右手相对眼位: 右偏 0.24m / 下压 0.30m
function playerThrowOrigin(){
const ep=playerEyePos(), y=player.yaw;
return V3(ep.x+Math.cos(y)*NADE_HAND_R, ep.y-NADE_HAND_D, ep.z-Math.sin(y)*NADE_HAND_R);
}
function playerThrowDir(o){
const camF=camForward();
const aim=tpAimPoint(camF);
if(o.distanceTo(aim)<1.2) return camF;      // 退化保护 (贴脸低头看脚): 直接沿视线, 免得朝后打
const d=aim.clone().sub(o);
return d.lengthSq()<1e-6?camF:d.normalize();
}
// 第三人称视场过渡: updateViewModel 每帧按第一人称档 (74 / 开镜档) 写 camera.fov, 而 updateCamera 在它**之前**跑 ——
// 所以第三人称视场只能在 VM 之后补一次, 否则两边互相拉扯 (24-main 主循环在 updateViewModel 后调用本函数)。
function thirdPersonFovTick(dt){
if(!thirdPersonOn()) return;
camera.fov=dampF(camera.fov,TP_FOV,8,dt);
camera.updateProjectionMatrix();
}
// ===== 第三人称·玩家本体模型 (2026-09-20) =====
// 第一人称只渲染视角武器模型 (vmScene 覆盖层), 场上并没有玩家自己的模型 —— 相机后拉会看见"空身+空枪"。
// 这里用 11-soldiers 的 buildSoldierMesh 给玩家建一份本体 (与 Bot 同一套几何/材质, 不新增资源),
// 只在第三人称期间显示; 手上按当前武器挂世界枪模 (worldGunModel, 与 Bot 同源), 换枪重建。
let playerAvatar=null;
function playerAvatarEnsure(){
if(playerAvatar&&playerAvatar._team!==player.team){ // 换阵营 (跨局) → 制服色不匹配, 重建
if(playerAvatar.root.parent) playerAvatar.root.parent.remove(playerAvatar.root);
playerAvatar=null;
}
if(playerAvatar||typeof buildSoldierMesh!=='function') return playerAvatar;
const av=buildSoldierMesh(player.team,'');
if(av.tag) av.tag.visible=false; // 头顶名牌是给敌方 Bot 用的, 玩家本体不需要
av.root.visible=false;
av._team=player.team;
playerAvatar=av;
return av;
}
function playerAvatarHide(){ if(playerAvatar) playerAvatar.root.visible=false; }
// 本体引用复位 (D9, 2026-09-28): avatar 是"对局中首次按 U 才 scene.add"的惰性常驻对象, 不在世界还原的
// 开局快照里 —— restorePristineWorld 的场景台账还原会把它整段摘出 scene (parent=null), 而本引用还在,
// 下一局 playerAvatarEnsure 拿旧 root 每帧写 visible=true = "第三人称隐身"。世界还原链经此复位
// (23b clearMatchEffects), 下次 ensure 原地重建。与 clearMatchEffects 里小队标记/降落伞同一处置模式。
function playerAvatarReset(){
if(playerAvatar&&playerAvatar.root.parent) playerAvatar.root.parent.remove(playerAvatar.root);
playerAvatar=null;
_avNadeSet=null;                          // 手上的雷模随本体一起作废 (2026-09-30 批2)
}
// ── 举雷待发 (2026-09-30 批2 单源判据) ──
// 语义: "雷在手里、还没出手" —— 按住持雷 (nadeHeld) 或刚松手但出手帧未到 (VM 仍在 'nade' 且投掷弧未开始)。
// 反例: 出手弧进行中 (nadeThrowT>0) 由弧自己接管姿态; 上载具/上炮位把 nadeHeld 摘掉后由 10-viewmodel
//   的哨兵自愈把 VM.state 复位 ⇒ 本判据自动转假, 不需要第二处清账。
function playerNadeReady(p){
if(!p||(p.nadeThrowT||0)>0) return false;
if(p.nadeHeld) return true;
return !!(typeof VM!=='undefined'&&VM&&VM.state==='nade');
}
// ── 举雷期手上的雷模 (2026-09-30 批2) ──
// 与 09-weapons buildNadeMesh **同一个单源**: 一人称手上 (VM.nadeMs) / 出手后 (13-combat) / 三人称手上
// 三处同模。旧版三人称举着雷却握着一把步枪 (用户截图) —— 枪藏了, 手上却什么也没有。
// 四件一次建好挂 armR.hand, 按弹种显隐 (与 VM.nadeMs 同法); 尺度取 NADE_WORLD_SCALE ⇒ 出手那一瞬
// 手上件与飞出件同大小, 不跳变。
let _avNadeSet=null;
function avNadeSync(av,p,nadeK,nadeHold){
if(!_avNadeSet||_avNadeSet.av!==av){
const set={av,ms:{}};
if(typeof buildNadeMesh==='function'&&typeof NADE_KINDS!=='undefined'&&av.armR&&av.armR.hand){
for(const k of NADE_KINDS){
const m=buildNadeMesh(k,p.team);
m.scale.setScalar(NADE_WORLD_SCALE);
// 握点 = 雷的建模原点 ⇒ 落在拳心; **朝向取单位阵**: 手局部 +y 就是"沿小臂向肩膀"的方向,
// 举雷待发时小臂折起 (elR≈-1.35) ⇒ 手的 +y 朝斜上后方 = 引信头朝上, 与一人称 VM 手上件同朝向
// (VM 里也是 rotation 0), 不会出现"三视引信朝下"的第三套口径。position 沿手 -y 挪 2cm =
// 把弹体从拳心推向掌心外 —— 否则卵形雷整个埋进 9cm 的拳头方块里, 只露一截引信。
m.rotation.set(0,0,0); m.position.set(0,-0.02,0);
m.visible=false;
av.armR.hand.add(m); set.ms[k]=m;
}
}
_avNadeSet=set;
}
const ms=_avNadeSet.ms;
// 出手帧: 10-viewmodel 在 k>0.5 调 releaseNade ⇒ 那之后手上就没雷了 (弧的前半段还在手里)
const show=nadeHold||nadeK>0.5;
const kind=(typeof vmNadeKind==='function')?vmNadeKind():'frag';
for(const k in ms){ const v=show&&k===kind; if(ms[k].visible!==v) ms[k].visible=v; }
}
function avNadeHide(){
if(!_avNadeSet) return;
for(const k in _avNadeSet.ms) _avNadeSet.ms[k].visible=false;
}
// ═════ 第三人称·玩家本体动作机 (2026-09-21 A#2 契约G) ═════
// 用户原话: "切换第三人称发现角色只有移动动作, 其他全部动作是真的一概没有"。
// 口径单源 = 14-bots.js `updateMesh()` 的 Bot 姿态机: 玩家与 Bot 共用 11-soldiers 的 buildSoldierMesh,
// 关节名/轴向/零点完全一致, 因此这里**逐项照抄 Bot 的目标角**, 只把"AI 状态字段"换成"玩家状态字段" ——
// 玩家与 Bot 同规则 (纲领第 2 条), 不再有"玩家那边另写一套简化动作"的分叉 (旧注释明确写着"不复刻 Bot 姿态机")。
//
//   动作        触发状态 (只读)                    改哪个关节 / 位移                                          Bot 同源
//   ────────────────────────────────────────────────────────────────────────────────────────────────────────────
//   开火后坐    p.fireAnimT>0 (新)                 armR.sh.rotation.x += 0.34·k (右肩后坐)                    armR.swing
//                                                  gunG.rotation.x -= 0.26·k (枪口上跳) + torsoG 微后
//   换弹        p.reloadT>0 (新, =VM 剩余时间)      armL.sh.x/z + armL.elm (左手离护木下沉到弹匣)              rl 分支
//                                                  gunG.rotation.x += 0.20 / z += 0.12 (枪身下压)
//   开镜 ADS    p.ads                               armR/armL 收拢到眼位 (shR -0.62-ap·0.9, shLz 0.72)        engaged 分支
//                                                  torsoG.rotation.x += 0.12 (上身微前)
//   蹲          p.crouch && !p.prone                pelvis.position.y→0.6 / rotation.x→0.14                    crouch 档
//                                                  腿: hipL -1.05 / hipR -0.5 / kneeL 1.3 / kneeR 0.95
//   趴          p.prone                             pelvis→0.22 / 1.5, 双肘撑地 (shR -1.42, elR -1.15,         prone 分支
//                                                  shRz -0.2; shL -1.3, elL -1.25, shLz 0.42), 腿伸直拖后
//   手雷投掷    p.nadeThrowT>0 (新)                 armR.sh.rotation.x: +0.52 (后摆) → -1.20 (前甩)            —— 玩家侧新增
//                                                  armL 收拢 + 枪身随左臂让开 (q=0..1 一个完整弧)
//   刺刀        p.meleeT>0 (新)                     gunG.position.z += 0.42·thrust (枪前刺)                     —— 玩家侧新增
//                                                  armR 伸直 + torsoG.rotation.x + 0.3·thrust + 本体突进 0.18m
//   受击中弹    p.flinchT>0 (新)                    torsoG.rotation.z = sin(flinchT·40)·0.07                    flinchT 逐字同式
//   死亡倒地    !p.alive                            有布娃娃 ⇒ 隐藏本体, 尸体交给 12-ragdolls;                 死/布娃娃交接
//                                                  无布娃娃 ⇒ 本体侧倒 (root.z 0.42 + pelvis 0.22/1.54)
//   跳跃/落地   !p.onGround / p.landDip>0           腾空: hip -0.72/-0.45, 膝 1.35/1.05 (收腿)                  —— 玩家侧新增
//                                                  落地: 屈膝缓冲 + 重心下沉 0.26·landDip
//   包扎        p.bandaging>0                       armL.sh/elm 离枪按向身体 (shL -0.30, elL -1.95)            —— 玩家侧新增
//   架枪        p.braced                            gunG.position.y += 0.12 (枪抬到胸口遮挡位)                  —— 玩家侧新增
//                                                  双臂收拢压枪 (shR -0.62/elR -1.35, shL -1.18/elL -0.42)
// 纪律: 本函数**只读**状态字段 + **只写**关节 (root/pelvis/torsoG/headG/四肢/gunG), 不写任何战斗字段 ——
// 伤害/射速/散布/移速/命中判定一行未动。新计时字段的维护全在 playerAnimTick / 18-game 的状态入口。
function playerAnimTick(p,dt){
// 换弹时长单源 = VM 的剩余时间 (VM.stateDur = 武器 def.reload × 连杀增益), 这里不复制任何数值:
p.reloadT=(typeof VM!=='undefined'&&VM&&VM.state==='reload')?Math.max(0,(VM.stateDur||0)-(VM.stateT||0)):0;
if(p.fireAnimT>0) p.fireAnimT=Math.max(0,p.fireAnimT-dt);
if(p.flinchT>0) p.flinchT=Math.max(0,p.flinchT-dt);
if(p.nadeThrowT>0) p.nadeThrowT=Math.max(0,p.nadeThrowT-dt);
if(p.meleeT>0) p.meleeT=Math.max(0,p.meleeT-dt);
// 起手边沿: 19-input 只写 VM.state ('nade'/'melee'), 这里在**进入该状态的第一帧**把动作计时置满 ——
// 出手/命中瞬间 (18-game 的 releaseNade / doMeleeHit) 会再置一次, 于是"起手蓄力→出手"是两段可断言的弧。
const nadeWind=(typeof VM!=='undefined'&&VM&&VM.state==='nade');
if(nadeWind&&!p._nadeArmed){ p._nadeArmed=true; p.nadeThrowT=NADE_ANIM_T; }
if(!nadeWind) p._nadeArmed=false;
const melWind=(typeof VM!=='undefined'&&VM&&VM.state==='melee');
if(melWind&&!p._meleeArmed){ p._meleeArmed=true; p.meleeT=Math.max(p.meleeT||0,MELEE_ANIM_T); }
if(!melWind) p._meleeArmed=false;
}
// 死亡倒地 (契约G): 两套尸体不同屏, 也绝不留一个"站着死的第三人称本体"。
//   ① p.deathRag 存在 (player.die 里 spawnRagdoll 成功) ⇒ 隐藏本体, 尸体完全交给 12-ragdolls;
//   ② 物理未就绪 (沙箱无 CANNON / ragInit 失败, spawnRagdoll 返回 false) ⇒ 本体自己倒 (侧倒 + 趴地姿态)。
function playerAvatarDeath(av,p,dt){
if(p.deathRag){ av.root.visible=false; return av; }
av.root.visible=true;
av.root.position.set(p.pos.x,p.pos.y,p.pos.z);
av.root.rotation.set(0,p.yaw+Math.PI,0.42);   // 侧倒 0.42rad: 与站立姿态在 root 层就分得开
av.pelvis.position.y=dampF(av.pelvis.position.y,0.22,8,dt);
av.pelvis.rotation.x=dampF(av.pelvis.rotation.x,1.54,8,dt);
av.pelvis.rotation.y=dampF(av.pelvis.rotation.y,0,6,dt);
av.torsoG.rotation.x=dampF(av.torsoG.rotation.x,0.06,6,dt);
av.torsoG.rotation.z*=Math.pow(0.02,dt);       // 抽搐残留清零
av.headG.rotation.x=dampF(av.headG.rotation.x,-0.3,5,dt);
av.headG.rotation.y=dampF(av.headG.rotation.y,0,5,dt);
// 四肢瘫软: 双臂摊在身侧, 双腿伸直 (与站立/匍匐的动作值都不同, 探针可断言)
av.armR.sh.rotation.x=dampF(av.armR.sh.rotation.x,-1.35,6,dt); av.armR.sh.rotation.z=dampF(av.armR.sh.rotation.z,-0.55,6,dt); av.armR.elm.rotation.x=dampF(av.armR.elm.rotation.x,-0.35,6,dt);
av.armL.sh.rotation.x=dampF(av.armL.sh.rotation.x,-1.25,6,dt); av.armL.sh.rotation.z=dampF(av.armL.sh.rotation.z,0.6,6,dt); av.armL.elm.rotation.x=dampF(av.armL.elm.rotation.x,-0.4,6,dt);
av.legL.hip.rotation.x=dampF(av.legL.hip.rotation.x,0.05,6,dt); av.legL.knee.rotation.x=dampF(av.legL.knee.rotation.x,0.1,6,dt);
av.legR.hip.rotation.x=dampF(av.legR.hip.rotation.x,0.05,6,dt); av.legR.knee.rotation.x=dampF(av.legR.knee.rotation.x,0.1,6,dt);
if(av._gun) av._gun.visible=false;             // 尸体不握枪
avNadeHide();                                  // 尸体也不握雷 (2026-09-30 批2: 举雷期被打死, 手上雷模要收)
av.gunG.rotation.x=dampF(av.gunG.rotation.x,0.2,5,dt);
return av;
}
function updatePlayerAvatar(dt){
const av=playerAvatarEnsure();
if(!av) return null;
const p=player;
// 长时间没进第三人称 (U 关掉 / 在载具或固定火力位上 / 菜单冻结) ⇒ 旧的动作计时早已过期, 先清零再进姿态机:
// 否则重新打开第三人称的那一帧会看到"十几秒前的开火后坐 / 受击抽搐"残留。用 nowT 判"这一帧是否连续":
// 主循环每帧推进 nowT, 连续第三人称时差值≈dt; 沙箱探针不推进 nowT, 差值恒 0 ⇒ 不会误清探针驱动的计时。
if(av._poseT!==undefined&&nowT-av._poseT>0.5){ p.fireAnimT=0; p.flinchT=0; p.nadeThrowT=0; p.meleeT=0; p.reloadT=0; }
av._poseT=nowT;
playerAnimTick(p,dt);
if(!p.alive) return playerAvatarDeath(av,p,dt);   // 死亡倒地: 布娃娃优先, 无布娃娃则本体倒地
av.root.visible=true;
av.root.position.set(p.pos.x,p.pos.y,p.pos.z);
// 模型正面朝 +Z, 而玩家视线朝 -Z (p.yaw=0 时前方是 (0,0,-1)) ⇒ 转半圈对齐 (与载具 p.yaw=yaw+PI 同一约定)
av.root.rotation.set(0,p.yaw+Math.PI,0);
const prone=!!p.prone, crouch=!!p.crouch&&!prone;
// "交战"= 开镜/开火后坐/架枪 (Bot 的 engaged 还含 mgUse/empUse —— 玩家在固定火力点上第三人称本就不生效, 见 thirdPersonOn)
const engaged=!!p.ads||(p.fireAnimT||0)>0||!!p.braced;
const sprint=!!p.sprinting&&!prone&&!engaged;
const dip=clamp(p.landDip||0,0,1);                 // 落地缓冲量 (0..1, 由落地冲击写, 3/s 衰减)
let pelY=prone?0.22:crouch?0.6:0.94;               // 骨盆高度: 与 Bot 同档
if(dip>0.001) pelY-=0.26*dip;                      // 落地屈膝: 重心下沉 (加在目标值上, 不污染阻尼状态 ⇒ 无残留)
av.pelvis.position.y=dampF(av.pelvis.position.y,pelY,10,dt);
const torsoX=prone?1.5:crouch?0.14:(sprint?0.3:0.05); // 骨盆俯角: 与 Bot 同档
av.pelvis.rotation.x=dampF(av.pelvis.rotation.x,torsoX,8,dt);
const pp=av.pelvis.rotation.x;
// 侧身站姿 (枪手姿态): 趴 0.08 / 冲刺 0 / 交战 0.5 / 警戒 0.3 —— Bot 同档
const blade=prone?0.08:sprint?0:(engaged?0.5:0.3);
av.pelvis.rotation.y=dampF(av.pelvis.rotation.y,-blade,7,dt);
av.headG.rotation.y=-av.pelvis.rotation.y*0.85;
// 步伐摆动: 与 Bot 同式 (t+=dt*(3+速度*1.9); 摆幅: 匍匐 clamp(sp/1.2,0,1)*0.35, 其余 clamp(sp/4,0,1.3)*0.62)
const sp=Math.hypot(p.vel.x,p.vel.z);
av._animT=(av._animT||0)+dt*(3+sp*1.9);
const S=Math.sin(av._animT);
const sw=prone?clamp(sp/1.2,0,1)*0.35:clamp(sp/4,0,1.3)*0.62;
// ── 腿部: **单一 if/else 链** (同一帧只能有一个写者) ──
// 顺序 = 优先级: 腾空收腿 > 落地缓冲 > 匍匐拖腿 > 下蹲 > 站立摆步。
// 为什么必须合成一条链: 两段独立的 if 会在同一帧对同一关节写两次, 阻尼的平衡点落在两个目标之间
// (实测: 跳跃时 hip 只到 -0.38 而不是 -0.72 —— 这就是"两套目标互相拉扯"的量化表现)。
const air=!p.onGround&&!p.swim&&!p.chute;
if(air){
// 跳跃/下落 (契约G): 收腿抱膝, 落地前一直是这个姿态
av.legL.hip.rotation.x=dampF(av.legL.hip.rotation.x,-0.72,9,dt);
av.legR.hip.rotation.x=dampF(av.legR.hip.rotation.x,-0.45,9,dt);
av.legL.knee.rotation.x=dampF(av.legL.knee.rotation.x,1.35,9,dt);
av.legR.knee.rotation.x=dampF(av.legR.knee.rotation.x,1.05,9,dt);
}else if(dip>0.001){
// 落地缓冲 (契约G): 屈膝 + 屈髋, 深度随 landDip (0..1) 线性
av.legL.hip.rotation.x=dampF(av.legL.hip.rotation.x,-0.65*dip,12,dt);
av.legR.hip.rotation.x=dampF(av.legR.hip.rotation.x,-0.34*dip,12,dt);
av.legL.knee.rotation.x=dampF(av.legL.knee.rotation.x,1.45*dip,12,dt);
av.legR.knee.rotation.x=dampF(av.legR.knee.rotation.x,1.05*dip,12,dt);
}else if(prone){
// ★ 2026-09-26 A2: 与 Bot **同式**的脚落地面反解 (旧版是 -0.04/0.08 那套写死角, 实测鞋底悬空 +0.05/+0.07m,
// 爬行时一腿抬到 +0.19m; Bot 侧早在 A#10 审计② 就改成反解了, 玩家这条路径当时漏跟 → 两套数值长期漂移)。
// 高度基准取**当前**骨盆高 (仍在 dampF 过渡中), 脚关节目标 ~0.11m, 爬行时前后交替 ±0.16m, kneeUp=true。
const hpNow=av.pelvis.position.y;
const cr=clamp(sp/1.2,0,1)*0.35;
const LL=legIKPose(hpNow,0.11+Math.max(0,S)*0.13*cr,-0.92+S*0.16*cr,true);
const RR=legIKPose(hpNow,0.11+Math.max(0,-S)*0.13*cr,-0.92-S*0.16*cr,true);
av.legL.hip.rotation.x=dampF(av.legL.hip.rotation.x,LL.hip-pp,10,dt);
av.legR.hip.rotation.x=dampF(av.legR.hip.rotation.x,RR.hip-pp,10,dt);
av.legL.knee.rotation.x=dampF(av.legL.knee.rotation.x,LL.knee,10,dt);
av.legR.knee.rotation.x=dampF(av.legR.knee.rotation.x,RR.knee,10,dt);
}else{
// ★ 2026-09-26 A2/A3: 站/蹲**共用一条** —— 站立摆步角与蹲姿反解按骨盆实际高度插值 (Bot 侧同式, 单源 legIKPose)。
// 旧版玩家这条路是写死的 -1.05/1.3 与 -0.5/0.95 (Bot 侧早已按"鞋底各穿地 0.17/0.29m"废弃的那套数值),
// 实测玩家蹲姿鞋底 -0.21/-0.35m 入地 —— 而蹲姿与站姿的差别只是插值权, 分两个分支写就是第二个写者。
//   站直 (hp=0.94) ⇒ 权 0 ⇒ 逐位等于原站立值; 蹲到位 (hp=0.60) ⇒ 权 1 ⇒ 等于蹲姿反解 (与 Bot 逐位一致)。
const hpNow=av.pelvis.position.y;
const kw=clamp((0.94-hpNow)/(0.94-0.60),0,1);
const wL=clamp(sp/4,0,1.3)*0.62;                                       // = sw (站/蹲同式)
const cL=legIKPose(hpNow,0.13+Math.max(0,S)*0.12*wL,0.16+S*0.20*wL,false);
const cR=legIKPose(hpNow,0.13+Math.max(0,-S)*0.12*wL,0.16-S*0.20*wL,false);
const jHipL=S*sw-torsoX*0.6, jHipR=-S*sw-torsoX*0.6;
const jKneeL=Math.max(0,-S)*sw*1.5+0.06, jKneeR=Math.max(0,S)*sw*1.5+0.06;
av.legL.hip.rotation.x=dampF(av.legL.hip.rotation.x,lerp(jHipL,cL.hip-pp,kw),10,dt);
av.legR.hip.rotation.x=dampF(av.legR.hip.rotation.x,lerp(jHipR,cR.hip-pp,kw),10,dt);
av.legL.knee.rotation.x=dampF(av.legL.knee.rotation.x,lerp(jKneeL,cL.knee,kw),10,dt);
av.legR.knee.rotation.x=dampF(av.legR.knee.rotation.x,lerp(jKneeR,cR.knee,kw),10,dt);
}
// ── 手臂基准 (Bot 四分支 + 开镜收拢): shX=肩前后摆, el=肘弯, shZ=肩外展, shY=肩水平转 ──
let shR,elR,shL,elL,shRy=0,shLy=0,shRz=0,shLz=0;
if(prone){
// 匍匐: 双肘撑地, 小臂抬起托枪在面前, 手不插地, 爬行时交替前伸 (Bot 逐字)
shR=-1.42+S*sw*0.32; elR=-1.15; shRz=-0.2;
shL=-1.3-S*sw*0.32; elL=-1.25; shLz=0.42;
}else if(engaged){
const ap=clamp(p.pitch,-0.7,0.7);
if(p.ads){ shR=-0.62-ap*0.9; elR=-1.75; shRz=-0.34; shL=-1.30-ap*0.9; elL=-0.30; shLz=0.72; }  // 开镜: 枪抬到眼位 + 左臂收拢
else { shR=-0.55-ap*0.85; elR=-1.6; shRz=-0.28; shL=-1.35-ap*0.85; elL=-0.14; shLz=0.55; }       // 据枪 (Bot 的 engaged 目标角逐字)
}else if(sprint){
// 疾跑: 枪侧向横端在胸前, 双手保持握枪 (Bot 逐字)
shR=-0.62+S*0.07; elR=-1.05; shRy=0.3; shRz=-0.12;
shL=-0.78-S*0.07; elL=-1.05; shLy=0.55; shLz=0.35;
}else{
// 低持枪警戒: 枪口斜向下, 双手仍在枪上 (Bot 逐字)
shR=-0.42; elR=-1.3; shRz=-0.24;
shL=-1.08; elL=-0.28; shLz=0.5;
}
if(air){ shR+=0.18; shL+=0.22; }                                   // 腾空: 双臂略抬 (与收腿同族的空中姿态)
shRy+=-av.pelvis.rotation.y*0.85; shLy+=-av.pelvis.rotation.y*0.85; // 侧身补偿: 躯干扭转后手臂仍指向枪身 (Bot 同式)
// 架枪 (契约G): 枪搭在掩体高度 ⇒ 双臂收拢压枪, 枪身抬到胸口遮挡位 (位置量见下面 gunG)
const fireK=clamp((p.fireAnimT||0)/FIRE_ANIM_T,0,1);
if(p.braced){ shR=-0.62; elR=-1.35; shRz=-0.3; shL=-1.18; elL=-0.42; shLz=0.6; }
// 换弹 (契约G, 与 Bot 的 rl 分支同规: 冲刺/匍匐时不换手): 左手离开护木 → 沉到弹匣
const reloading=(p.reloadT||0)>0;
if(reloading&&!sprint&&!prone){ shL=-0.52+Math.sin(nowT*7)*0.16; elL=-1.52; shLz=0.16; }
// 手雷 (契约G + 2026-09-30 批2 举雷待发): 两段
//   ① 举雷期 (playerNadeReady) = **蓄力位姿常驻** —— 与下面投掷弧的起点是同一姿态, 松手无缝接上。
//      旧版只有那 0.45s 的一次性弧: 计时一衰减完就回基准持枪姿态, 用户报"准备动作只保持很短,
//      然后马上切换成持枪动作"的根因 (按住举雷是**持续态**, 不能用衰减计时驱动)。
//   ② 出手弧 (nadeK>0) = 起手后摆 (+0.52) → 前甩出手 (-1.20) (数值一字未改)。
const nadeK=clamp((p.nadeThrowT||0)/NADE_ANIM_T,0,1);
const nadeHold=playerNadeReady(p);
const nadeQ=nadeK>0?1-nadeK:0, nadeArc=nadeK>0?Math.cos(nadeQ*Math.PI):0;
if(nadeK>0){
shR=0.86*nadeArc-0.34; elR=-0.9-0.45*Math.max(0,nadeArc); shRz=-0.1;
shL=-1.02-0.42*Math.max(0,-nadeArc); elL=-0.55; shLz=0.3; shLy=0.25;
} else if(nadeHold){
shR=0.52; elR=-1.35; shRz=-0.1;
shL=-1.02; elL=-0.55; shLz=0.3; shLy=0.25;
}
// 刺刀 (契约G): 枪前刺 + 上身突进, thrust 中段最大 (前刺量见下面 gunG/root)
const meleeK=clamp((p.meleeT||0)/MELEE_ANIM_T,0,1);
const thrust=meleeK>0?Math.sin((1-meleeK)*Math.PI):0;
if(thrust>0){
shR=-0.42-thrust*1.05; elR=-1.3+thrust*0.9; shRz=-0.2;
shL=-1.08-thrust*0.6; elL=-0.28; shLz=0.45;
}
// 包扎 (契约G): 左手离枪按向身体 (VM 同态手上已是绷带模型, 见下面 world 枪模隐藏)
const bandK=(p.bandaging||0)>0?1:0;
if(bandK>0){ shL=-0.30-0.10*Math.sin(nowT*6); elL=-1.95; shLz=0.95; }
// 开火后坐 (契约G): 右肩后坐 + 枪口上跳, 随 fireAnimT 线性衰减
// ★ 2026-09-26 B3: 原注释写"最后叠加 ⇒ 与任何基准姿态都不冲突", 但它当时确实在**姿态机之后、armIK 之前** ——
// 契约 J 引入 IK 之后 handK=1 会把这一项 lerp 回 IK 值 (实测被抹掉), 后坐的肩部动作整段不可见。
// 现在把这一项真的放到 IK 混合**之后** (见下面 IF 块之后), 语义与注释一致。
// (2026-09-21 A#2 契约J §12.2) 肩链 rotation.y / rotation.z 的目标值乘**上半身镜像符号** UPPER_MIRROR(-1):
// 镜像平面 x=0 下 Rx(θ)→Rx(θ) 不变、Ry(θ)→Ry(-θ)、Rz(θ)→Rz(-θ), 所以只翻 y/z、数值本身不重调。
// pelvis.rotation.y (blade) 不取反 —— 现有 -blade 就是"左肩在前"=右手持枪的标准侧身, 取反会变成左手持枪。
// 先乘再混合: armIK 的输出是**躯干空间的绝对角**, 两边必须已在同一坐标系才能 lerp。
const MIR=(typeof UPPER_MIRROR!=='undefined')?UPPER_MIRROR:((typeof setUpperMirror==='function')?setUpperMirror():-1);
shRy*=MIR; shLy*=MIR; shRz*=MIR; shLz*=MIR;
// ── 枪身 gunG 目标角 (与 Bot 同式): 侧身补偿 / 冲刺横端 / 匍匐反向补偿躯干俯角 / 交战看俯仰 ──
const gunPitch=engaged?-clamp(p.pitch,-0.7,0.7):(sprint?0.3:0.25);
// ★ 2026-09-26 A1: 趴姿的枪身角与 Bot **逐字一致** (gunPitch-pp) —— 玩家这边原来多一个 "+0.1", 那是
// 俯角的**同向**附加 (gunX 为正 = 枪口朝下), 在贴地的趴姿里等于把枪口往地里压 0.09m (实测枪底 -0.015m)。
// 而 −pp 本来就已经把骨盆前倾补偿干净了 (A#10 审计① 的口径), 不需要再有第二项。
let gunX=prone?gunPitch-pp:gunPitch;
let gunY=-av.pelvis.rotation.y+(sprint?0.95:0);
let gunZ=sprint?0.16:0;
let gunOffY=0, gunOffZ=0;
if(thrust>0){ gunOffZ=thrust*0.42; gunX-=thrust*0.16; }        // 刺刀: 枪前刺
if(p.braced) gunOffY=0.12;                                     // 架枪: 枪抬到胸口遮挡位
if(reloading&&!sprint&&!prone){ gunX+=0.20; gunZ+=0.12; }       // 换弹: 枪身下压
if(nadeK>0) gunZ+=0.35*Math.max(0,nadeArc);                     // 手雷: 起手时枪随左臂让开
else if(nadeHold) gunZ+=0.35;                                   // 举雷期: 枪同样让开 (隐身中; 回枪时从让开位滑回, 不瞬移)
gunX-=fireK*0.26;                                               // 开火: 枪口上跳 (rotation.x 负 = 枪口抬)
// ── 契约J §12.4.3 (用户追加反馈·最高优先): 双手持枪 ⇒ armIK 把双手**反解到枪上** ──
// 用户投诉"武器只是插在锁骨上、不像被手握着" ⇒ 手在枪上不再靠姿态值凑, 而是几何构造性保证。
// 顺序(Lead 冻结): 先算 gunG 目标角 → 用该角取抓握点(抓握点随 gunG.rotation 移动, 不传就偏) → armIK → 混合后一起写回。
// 混合: final=lerp(姿态机基准, IK, handK); handK: 持枪 1 / 刺刀 0.35 / 手雷·包扎 0 (与 bots 同一口径)。
// ★2026-09-30 批2: nadeHold (举雷待发) 也是 0 —— 否则手雷计时一衰减完, handK 回到 1, IK 把双手**抓回枪上**,
//   表现就是"举着雷的人突然又握住了枪"(与姿势机同一条根因的第二处)。
const handK=(nadeK>0||nadeHold||bandK>0)?0:(thrust>0?0.35:1);
// ★ 2026-09-26 B2: 换弹时**左臂单独取 0** —— Bot 侧有 handKL (14-bots), 玩家侧漏了这一步, 于是上面
// 摆好的"左手沉到弹匣"被 IK 的 handK=1 逐帧抹掉 (换弹时左臂全程贴回护木 = 换弹动作看不见)。
// 语义与 Bot 一致: 换弹的语义就是左手离枪去弹匣; 右臂仍为 1 (枪始终在右手)。
const handKL=(reloading&&!sprint&&!prone)?0:handK;
if(handK>0.001&&av._gun&&typeof armIK==='function'&&typeof gunGripPoint==='function'){
const gk=av._gunKind||'rifle';
// 右手 → 握把点; 握把点略超臂长时 (实测步枪在俯仰一端 0.641m > 全伸 0.62m) 同样**沿枪身轴回退**
// (t<0 = 向枪托端回退, 仍在枪身上) —— 不把挂点挪近 (挪近会把枪身压回躯干), 也不让手脱枪。
const reachR=(typeof ARM_L1!=='undefined')?(ARM_L1+ARM_L2-0.03):0.59;
let tR=0, gp=gunGripPoint(gk,gunX,gunY,gunZ,pp);
if(typeof gunAxisPoint==='function'){
const sr=av.armR.sh.position;
for(let i=0;i<6&&tR>-0.6;i++){
if(Math.hypot(gp.x-sr.x,gp.y-sr.y,gp.z-sr.z)<=reachR) break;
tR-=0.15; gp=gunAxisPoint(gk,tR,gunX,gunY,gunZ,pp);
}
}
const rR=armIK(av.armR.sh,av.armR.elm,gp);                      // 右手 → 握把 (扳机手)
if(rR!==null){
shR=lerp(shR,av.armR.sh.rotation.x,handK); shRy=lerp(shRy,av.armR.sh.rotation.y,handK);
shRz=lerp(shRz,av.armR.sh.rotation.z,handK); elR=lerp(elR,av.armR.elm.rotation.x,handK);
}
// 左臂 → 护木点; 冻结挂点下护木点会超臂长(实测 ≈0.85m > 全伸 0.62m), 故沿**枪身轴**回退到可达点
// (gunAxisPoint: t=1 护木 / t=0 握把) —— 手仍然落在枪身上, 而不是脱手悬空。残差由 armIK 如实返回。
if(handKL>0.001&&typeof gunForePoint==='function'&&typeof gunAxisPoint==='function'){
const reach=(typeof ARM_L1!=='undefined')?(ARM_L1+ARM_L2-0.03):0.59;
const sl=av.armL.sh.position;
let t=1, fp=gunForePoint(gk,gunX,gunY,gunZ,pp);
for(let i=0;i<8&&t>0;i++){
if(Math.hypot(fp.x-sl.x,fp.y-sl.y,fp.z-sl.z)<=reach) break;
t=Math.max(0,t-0.12); fp=gunAxisPoint(gk,t,gunX,gunY,gunZ,pp);
}
const rL=armIK(av.armL.sh,av.armL.elm,fp);                      // 左手 → 护木/可达的枪身站位
if(rL!==null){
shL=lerp(shL,av.armL.sh.rotation.x,handKL); shLy=lerp(shLy,av.armL.sh.rotation.y,handKL);
shLz=lerp(shLz,av.armL.sh.rotation.z,handKL); elL=lerp(elL,av.armL.elm.rotation.x,handKL);
}
}
}
// ★ 2026-09-26 B3: 开火后坐 (契约G 原式: 右肩后坐 0.62 / 肩外展 0.06 / 肘 0.22, 数值不改) ——
// 必须叠在 IK 混合**之后**, 否则被 handK=1 的 lerp 抹平 (这就是"开火时枪口上跳可见、身体后坐看不见"的原因)。
shR+=fireK*0.62; shRz+=fireK*0.06; elR-=fireK*0.22;
// 关节写回 (阻尼率与 Bot 同档: x/肘 11, y 8, z 9; 上面已乘过 MIR 并混过 IK, 这里不再乘)
av.armR.sh.rotation.x=dampF(av.armR.sh.rotation.x,shR,11,dt);
av.armR.elm.rotation.x=dampF(av.armR.elm.rotation.x,elR,11,dt);
av.armL.sh.rotation.x=dampF(av.armL.sh.rotation.x,shL,11,dt);
av.armL.elm.rotation.x=dampF(av.armL.elm.rotation.x,elL,11,dt);
av.armL.sh.rotation.y=dampF(av.armL.sh.rotation.y,shLy,8,dt);
av.armR.sh.rotation.y=dampF(av.armR.sh.rotation.y,shRy,8,dt);
av.armL.sh.rotation.z=dampF(av.armL.sh.rotation.z,shLz,9,dt);
av.armR.sh.rotation.z=dampF(av.armR.sh.rotation.z,shRz,9,dt);
// 挂点基准 (2026-09-21 A#2 契约J): 单源 = 11-soldiers 的 **GUN_MOUNT_BY_KIND** (gunMountOf(kind)) ——
// 别再缓存"当前 gunG.position"当基准 (挂点本批从 (0.14,0.4,0.1) 改到按枪种取, 缓存旧值会把抬枪/前刺量加错高度);
// 扛肩式火箭筒的挂点与步枪不同, 所以这里必须按 av._gunKind 取。
// typeof 兜底: 子集沙箱没有这些常量时退回"首次读到的 gunG.position"(旧行为)。
// ★ 2026-09-26 A1: **传 pp** —— 挂点随躯干俯角给 (趴姿另取一组, 见 11-soldiers.gunMountOf):
//   站立挂点语义是"局部 y=沿身体向上 / z=胸前向外", 躯干前倾 1.5rad 后 z 变成"竖直向下" ⇒ 趴姿下
//   枪与双手整段扎进地面。这里与腿部反解、手臂 IK 目标用的是同一个 pp, 三处必须同源。
const gb=(typeof gunMountOf==='function')?gunMountOf(av._gunKind||'rifle',pp)
:((typeof GUN_MOUNT!=='undefined')?GUN_MOUNT:(av._gunGBase||(av._gunGBase={x:av.gunG.position.x,y:av.gunG.position.y,z:av.gunG.position.z})));
av.gunG.rotation.y=dampF(av.gunG.rotation.y,gunY,9,dt);
av.gunG.rotation.z=dampF(av.gunG.rotation.z,gunZ,8,dt);
av.gunG.rotation.x=dampF(av.gunG.rotation.x,gunX,11,dt);
av.gunG.position.x=dampF(av.gunG.position.x,gb.x,10,dt);
av.gunG.position.y=dampF(av.gunG.position.y,gb.y+gunOffY,10,dt);
av.gunG.position.z=dampF(av.gunG.position.z,gb.z+gunOffZ,10,dt);
// ── 头/上身 (Bot 同式): 交战看俯仰, 匍匐反向补偿躯干, 平时随俯角微低 ──
const headTgt=(engaged?-clamp(p.pitch,-0.6,0.6)*0.7:0)+(prone?-0.08-pp:-torsoX*0.5);
av.headG.rotation.x=dampF(av.headG.rotation.x,headTgt,9,dt);
const torsoLean=(prone?0:clamp(p.pitch,-0.6,0.6)*0.35)+(p.ads?0.12:0)+(p.braced?0.1:0)+thrust*0.3-fireK*0.06;
av.torsoG.rotation.x=dampF(av.torsoG.rotation.x,torsoLean,6,dt);
// 受击中弹: 与 Bot **逐字同式** (sin(flinchT*40)*0.07, 计时结束后 pow(0.001,dt) 归零 ⇒ 无残留)
if((p.flinchT||0)>0) av.torsoG.rotation.z=Math.sin(p.flinchT*40)*0.07;
else av.torsoG.rotation.z*=Math.pow(0.001,dt);
// 刺刀突进: 本体沿视线前刺 0.18m (root.position 每帧由 p.pos 重写 ⇒ 动作结束无残留)
if(thrust>0){ av.root.position.x+=-Math.sin(p.yaw)*thrust*0.18; av.root.position.z+=-Math.cos(p.yaw)*thrust*0.18; }
// 手雷/包扎: VM 同态已把手上模型换成手雷/绷带 (10-viewmodel), 世界枪模同步隐藏, 不做"双手投弹而枪还握在手上"
// (2026-09-30 批2 加 nadeHold: 举雷期也收枪; 只按 nadeK 判会漏掉整个举雷段 —— 用户截图里"举着雷握步枪")
if(av._gun) av._gun.visible=!(nadeK>0||nadeHold||bandK>0);
avNadeSync(av,p,nadeK,nadeHold);   // 举雷期右手握真雷 (buildNadeMesh 单源), 出手瞬间脱手
const key=p.curW?p.curW.key:null;
if(av._gunKey!==key){
if(av._gun) av.gunG.remove(av._gun);
av._gunKey=key; av._gun=null;
// (2026-09-21 A#2 契约J) 挂枪改走 **单源 mountGunModel** (11-soldiers): 旧写法只有 rotation.y=PI、没有局部位移,
// 玩家的枪比 Bot 后退 0.2~0.3m 退回胸腔/锁骨 —— 这正是"武器插在左锁骨上"的第二条根因 (两条挂载路径漂移的实证)。
// typeof 守卫 + 旧行为兜底: 只加载部分脚本的子集沙箱 (含"修前"对照沙箱) 仍能跑。
if(key){
if(typeof mountGunModel==='function') av._gun=mountGunModel(av.gunG,typeof gunKindOf==='function'?gunKindOf(key):'rifle',p.team,key);
else if(typeof worldGunModel==='function'){ av._gun=worldGunModel(typeof gunKindOf==='function'?gunKindOf(key):'rifle',p.team,key); av._gun.rotation.y=Math.PI; av.gunG.add(av._gun); }
}
// 本帧枪的种类: armIK 取抓握点要用 (与挂上的这把枪同一 kind, 见上面 mountGunModel 的第一参)
av._gunKind=key?(typeof gunKindOf==='function'?gunKindOf(key):'rifle'):null;
}
return av;
}
// 步行第三人称相机 (只被 updateCamera 的步战分支调用; p.eyeH 的阻尼由调用方那行统一推进, 这里不重复阻尼)
function thirdPersonCamera(dt){
const p=player;
camTrauma=Math.max(0,camTrauma-dt*2.2);
const sh=camTrauma*camTrauma*0.05;
const ep=playerEyePos();
const fwd=V3(-Math.sin(p.yaw)*Math.cos(p.pitch),Math.sin(p.pitch),-Math.cos(p.yaw)*Math.cos(p.pitch));
const right=V3(Math.cos(p.yaw),0,-Math.sin(p.yaw)); // 与 camRight 同向 (fwd×up)
const back=fwd.clone().negate().addScaledVector(right,TP_SIDE); back.y+=TP_LIFT; back.normalize();
let d=TP_DIST;
const hit=raycastWorld(ep,back,d);      // 防穿墙: 从眼位沿后拉方向测, 撞到就收距
if(hit) d=Math.max(TP_MIN,hit.dist-0.4);
const cp=ep.clone().addScaledVector(back,d);
// 地面下限 (2026-10-04 V3 同批): 纯海图上 heightAt 是海床 (水面下 20m+) —— 下限取 max(地形, 水面),
// 相机才不会沉到水下滤镜里 (与 capGunAimDist 的取地面口径同式)。
const gh3=heightAt(cp.x,cp.z);
const wy3=(typeof waterYAt==='function')?waterYAt(cp.x,cp.z):-1e9;
const gmin=Math.max(gh3,(wy3>-1e8)?wy3:-1e9)+TP_GROUND;
if(cp.y<gmin) cp.y=gmin;
camera.position.copy(cp);
camera.rotation.set(0,0,0);
camera.rotation.order='YXZ';
camera.rotation.y=p.yaw+sh*0.5+p.recoilYaw;   // 方向与第一人称同源 ⇒ 准星指向不变
camera.rotation.x=p.pitch+sh*0.5+p.recoilPitch;
camera.rotation.z=sh*0.3;
camera.updateProjectionMatrix();
updatePlayerAvatar(dt);
}
// 炮手镜视场 (2026-09-21): 与坦克车长镜同档 (20-player 坦克分支 fov=30), 倍率感 ≈ 74/30 ≈ 2.5×
const NAVAL_SCOPE_FOV=30;
// 炮手观瞄点 (世界坐标) —— 炮手镜机位单源。降级链 (WS1 naval-model 契约 + 兜底, 缺字段永不 undefined):
//   ① nodes.sight: 15e 挂在 turretG 下的观瞄镜心 Object3D —— 世界坐标即机位, 随炮塔回转 (最准)
//   ② dims.sightY: 15e 规格快照给的镜心 y (= 15e 的 deckY + spec.sightH)
//   ③ spec.sightH + dims.deckY: 直接按 WS1 字段算 (spec.sightH 相对**主甲板 deckY**)
//   ④ spec.sightH + 推算甲板: 无 dims 时按 bot+0.62·hullH 近似主甲板 (15e 艇档 dkM 档位值, 仅兜底;
//      2026-09-21B 起 pt dkM=0.62 / 九三式 dkM=0.60 —— 走 dims.deckY 的主路径不受影响, 兜底档只给缺 dims 的沙箱)
//   ⑤ dims.turretY + dims.turretH: 无 sightH 时按塔底 + 塔高推 (镜心 ≈ 塔顶下 38%)
//   ⑥ hullH 推算: 15e/spec 都没有 (旧 spec tur=null) 时的最后兜底 —— 甲板上方 0.3·hullH
// ★ 别把 deckY 写成 hullY+hullH/2: 那是"艇体几何中心", 而 15e 的主甲板在 bot+dkM·hullH (pt 0.62/九三式 0.60;
//   pt 实测甲板 1.66 vs 中心 2.65, 差 0.99m) —— 差这 1m 会让镜心浮在桅杆上 (自检 ⑨ 打印两档的 y 值对照)。
//   水平位置取炮塔环沿**艇艏向**的偏移 (ringZ): 观瞄窗是转塔件, 但机位取环心, 差别只有几十厘米,
//   而按艏向取位可以让"艇转向时镜头不绕圈"(镜头绕圈会晕)。返回 {x,y,z,src}, src 供自检打印读到哪一档。
function navalSightWorld(c){
const S=(c&&c.spec)||{}, D=(c&&c.dims)||null, ND=(c&&c.nodes)||null;
if(ND&&ND.sight&&typeof ND.sight.getWorldPosition==='function'&&c.grp&&typeof c.grp.updateMatrixWorld==='function'){
try{ c.grp.updateMatrixWorld(true); const w=ND.sight.getWorldPosition(V3()); if(w&&isFinite(w.x)){ w.src='nodes.sight'; return w; } }catch(e){}
}
const hullH=(S.hullH||2), hullY=(S.hullY||0);
const deckY=(D&&typeof D.deckY==='number')?D.deckY:(hullY-hullH*0.5+hullH*0.62);   // 主甲板面 (非艇体中心)
const ringZ=(S.tur&&typeof S.tur.ringZ==='number')?S.tur.ringZ:((D&&typeof D.turretZ==='number')?D.turretZ:0);
let h=null,src='';
if(D&&typeof D.sightY==='number'&&isFinite(D.sightY)){ h=D.sightY-deckY; src='dims.sightY'; }
else if(typeof S.sightH==='number'&&S.sightH>0){ h=S.sightH; src=(D&&typeof D.deckY==='number')?'spec.sightH+dims.deckY':'spec.sightH+推算甲板'; }
else if(D&&typeof D.turretY==='number'&&isFinite(D.turretY)){
const th=(typeof D.turretH==='number'&&D.turretH>0)?D.turretH:((S.tur&&S.tur.h)||hullH*0.35);
h=(D.turretY-deckY)+th*0.62; src='dims.turretY+turretH';
}else{ h=((S.tur&&S.tur.h)||0)+hullH*0.30; src='hullH 兜底'; }
if(!(h>0.05)) h=0.6;                                  // 退化保护: 镜心必须在甲板之上
const sn=Math.sin(c.yaw||0), cs=Math.cos(c.yaw||0);
const out=V3(c.pos.x+sn*ringZ, (c.pos.y||0)+deckY+h, c.pos.z+cs*ringZ);
out.src=src;
return out;
}
function updateCamera(dt){
const p=player;
// 玩家本体 (第三人称) 每帧先藏起来, 只有下面的第三人称分支会重新显示 ——
// 这样跳伞/载具/巡飞弹/死亡镜头/航拍等**所有提前 return 的分支**都不会留下一个停在原地的本体模型。
playerAvatarHide();
		// 巡飞弹TV制导视角: 默认弹头第一视角(隐藏弹体, F 切换第三人称追尾可看到弹体)
		if(p.loiter&&p.alive){
		const d=p.loiter;
		const f=loiterForward(d);
		camera.rotation.order='YXZ';
		if(p.loiterView){
		d.mesh.visible=true;
		const back=f.clone().negate(); back.y+=0.34; back.normalize();
		let cd=6.8;
		const hit=raycastWorld(d.pos,back,cd);
		if(hit) cd=Math.max(1.6,hit.dist-0.4);
		camera.position.copy(d.pos).addScaledVector(back,cd);
		camera.lookAt(d.pos.x+f.x*12,d.pos.y+f.y*12,d.pos.z+f.z*12);
		camera.fov=dampF(camera.fov,70,8,dt);
		} else {
		d.mesh.visible=false; // 真弹头视角: 弹体不可见, 摄像机就在光学头罩处
		camera.position.copy(d.pos).addScaledVector(f,0.5).add(V3(0,0.05,0));
		camera.rotation.set(d.pitch,d.yaw,Math.sin(nowT*2.2)*0.05+Math.sin(nowT*31)*0.006);
		camera.fov=dampF(camera.fov,85,8,dt);
		}
		camera.updateProjectionMatrix();
		return;
		}
if(p.chute){
// 跳伞第三人称: 镜头后拉并微微下视, 能看到降落伞和周围环境
const trg=V3(p.pos.x,p.pos.y+0.8,p.pos.z);
const behind=V3(-Math.sin(p.yaw)*Math.cos(p.pitch),Math.sin(p.pitch)+0.3,-Math.cos(p.yaw)*Math.cos(p.pitch));
const hit=raycastWorld(trg,behind.clone().negate().normalize(),7.5);
const dd=hit?Math.max(2.8,hit.dist-0.5):6.5;
camera.position.set(trg.x+behind.x*dd, trg.y+behind.y*dd, trg.z+behind.z*dd);
camera.lookAt(trg.x,trg.y,trg.z);
camera.fov=dampF(camera.fov,68,8,dt);
camera.updateProjectionMatrix();
return;
}
if(!p.alive){
// 死亡镜头: 环绕注视布娃娃尸体约2秒
if(p.deathCamT>0){
p.deathCamT-=dt;
p.deathCamYaw+=dt*0.5;
const ragOk=p.deathRag&&RAG.list.indexOf(p.deathRag)>=0;
const tb=ragOk?p.deathRag.parts[0].body.position:p.deathPos;
if(tb){
const dirB=V3(Math.sin(p.deathCamYaw),0.5,Math.cos(p.deathCamYaw)).normalize();
const hit=raycastWorld(V3(tb.x,tb.y+0.5,tb.z),dirB,6.2);
const dd=hit?Math.max(1.4,hit.dist-0.4):5.6;
camera.position.set(tb.x+dirB.x*dd, tb.y+0.5+dirB.y*dd, tb.z+dirB.z*dd);
// 死亡镜头地面下限 (2026-10-04 海战审计 V3): 旧版 heightAt+0.35 —— 纯海图上 heightAt 是海床
// (水面下 20m+), 死在海面/甲板上 = 相机沉到深水下滤镜镜头。下限取 max(地形, 水面)。
const ghD=heightAt(camera.position.x,camera.position.z);
const wyD=(typeof waterYAt==='function')?waterYAt(camera.position.x,camera.position.z):-1e9;
const gmin=Math.max(ghD,(wyD>-1e8)?wyD:-1e9)+0.35;
if(camera.position.y<gmin) camera.position.y=gmin;
camera.lookAt(tb.x,tb.y+0.3,tb.z);
camera.fov=dampF(camera.fov,60,5,dt);
camera.updateProjectionMatrix();
return;
}
}
// 未落地/阵亡镜头结束后: 无 UI 航拍环绕 (开局前的主菜单背景即此, 与菜单期 updateMenuCamera 同一几何单源)
aerialCamPose(nowT*0.05);
return;
}
// ── 海战载具相机 (2026-09-20N 海战批; 2026-09-21 C 键三态 + 炮手镜) ──
// 三种视角由 C 键三态循环 (19-input 的 navalCycleView 单源):
//   ① p.thirdPerson=true  (上艇时默认) = 追尾第三人称 (艇体更长 ⇒ 比坦克拉得更远)
//   ② p.navalGun=true     = 炮手镜 (新): 机位在炮塔观瞄点, 视线沿**炮塔实际指向** (稳像), fov 30, 开 #scopeOv
//   ③ 其余               = 艏向第一人称 (与炮口/准星同向, 打主炮更直观)
// ★ 相机系与艇体系差 π (2026-09-21 修): 相机前向 = (-sin(p.yaw),-cos(p.yaw)); p.yaw 现在由 20a 写成 c.yaw+π+look,
//   与坦克/飞机/机枪位/岸炮位同一约定。旧代码把 p.yaw 直接写成 c.yaw ⇒ 第三人称相机被摆在艏前 12.8m 朝艉看、
//   第一人称朝艉 (探针实测: 相机前向·艏向 = −1.00)。
// 下艇跨出阶段 (p.navalExit) 不进本分支 —— 那一刻玩家已经是步行态, 走下面的步行相机。
if(p.onNaval&&!p.navalExit){
const c=p.onNaval;
camTrauma=Math.max(0,camTrauma-dt*2.2);
const sh=camTrauma*camTrauma*0.04;
camera.rotation.order='YXZ';
const spec=c.spec||{};
const so=document.getElementById('scopeOv');
if(p.navalGun){
// 炮手镜 (用户第 2 问裁定"要"): 机位 = 炮塔观瞄点 (WS1 的 nodes.sight / dims.sightY / spec.sightH 降级链);
// 视线 = 炮塔**实际**指向 (c.yaw+turretYaw / turretPitch) —— 炮塔还在转时镜里看得见, 这就是"稳像"的手感来源。
// 隐藏炮管防穿模由 15d 的 _syncModel 统一做 (player.navalGun, 与 15-vehicles:499 坦克车长镜同口径)。
const sp=navalSightWorld(c);
camera.position.copy(sp);
camera.rotation.set(c.turretPitch||0,(c.yaw||0)+(c.turretYaw||0)+Math.PI,0);
camera.fov=dampF(camera.fov,NAVAL_SCOPE_FOV,12,dt);
camera.updateProjectionMatrix();
if(so) so.style.display='block';
return;
}
if(p.thirdPerson){
const anchor=V3(c.pos.x,c.pos.y+3.2,c.pos.z);
camera.rotation.set(p.pitch+Math.sin(nowT*53)*sh, p.yaw+Math.sin(nowT*67)*sh, Math.sin(nowT*41)*sh*0.3);
const fwdV=V3(-Math.sin(p.yaw)*Math.cos(p.pitch),Math.sin(p.pitch),-Math.cos(p.yaw)*Math.cos(p.pitch));
const back=fwdV.clone().negate(); back.y+=0.34; back.normalize();
let camD=(c.kind==='boat')?13.5:10.5;      // 艇 (pt 24.4m) 比两栖车 (lvt 7.95m) 拉得更远
const hit=raycastWorld(anchor,back,camD);
if(hit) camD=Math.max(3.0,hit.dist-0.6);
camera.position.copy(anchor).addScaledVector(back,camD);
camera.fov=dampF(camera.fov,68,10,dt);
}else{
// 第一人称: 相机在艇艏甲板上方 (甲板高 = 船体中心高 hullY + 半高 hullH/2), 视线 = p.yaw/p.pitch
// 位置沿**相机前向**偏出 (p.yaw 是相机系: 前向 = (-sin,-cos)) ⇒ 相机在艏侧, 不是艉侧
const deck=(spec.hullY||1.2)+(spec.hullH||1.8)*0.5+0.85;
const bl=(spec.hullL||8)*0.18;
camera.position.set(c.pos.x-Math.sin(p.yaw)*bl, c.pos.y+deck, c.pos.z-Math.cos(p.yaw)*bl);
camera.rotation.set(p.pitch, p.yaw, 0);
camera.fov=dampF(camera.fov,74,10,dt);
}
camera.updateProjectionMatrix();
if(so) so.style.display='none';
return;
}
if(p.onVehicle){
const t=p.onVehicle;
camTrauma=Math.max(0,camTrauma-dt*2.2);
const sh=camTrauma*camTrauma*0.04;
if(t.kind==='plane'){
// 飞机追尾视角
const fd=t.fwdDir();
const anchor=V3(t.pos.x,t.pos.y,t.pos.z);
const back=fd.clone().negate(); back.y+=0.34; back.normalize();
camera.position.copy(anchor).addScaledVector(back,13).add(V3(Math.sin(nowT*53)*sh,Math.sin(nowT*67)*sh,0));
camera.lookAt(anchor.x+fd.x*22,anchor.y+fd.y*22,anchor.z+fd.z*22);
camera.fov=dampF(camera.fov,72+t.speed*0.2,6,dt);
camera.updateProjectionMatrix();
return;
}
if(p.tankView){
// 舱内(车长)视角: 隐藏炮管防止穿模
t.pitchG.visible=false;
const a=t.yaw+t.turretYaw;
camera.rotation.order='YXZ';
camera.rotation.set(p.pitch+Math.sin(nowT*53)*sh*0.5, p.yaw+Math.sin(nowT*67)*sh*0.5, 0);
camera.position.set(t.pos.x+Math.sin(a)*1.8, t.pos.y+1.95, t.pos.z+Math.cos(a)*1.8);
camera.fov=dampF(camera.fov,30,10,dt);
camera.updateProjectionMatrix();
document.getElementById('scopeOv').style.display='block';
return;
}
document.getElementById('scopeOv').style.display='none';
if(t.pitchG) t.pitchG.visible=true;
const anchor=V3(t.pos.x,t.pos.y+2.6,t.pos.z);
camera.rotation.order='YXZ';
camera.rotation.set(p.pitch+Math.sin(nowT*53)*sh, p.yaw+Math.sin(nowT*67)*sh, 0);
const fwdV=V3(-Math.sin(p.yaw)*Math.cos(p.pitch), Math.sin(p.pitch), -Math.cos(p.yaw)*Math.cos(p.pitch));
const back=fwdV.clone().negate(); back.y+=0.35; back.normalize();
let camD=10.5;
const hit=raycastWorld(anchor,back,camD);
if(hit) camD=Math.max(2.5,hit.dist-0.5);
camera.position.copy(anchor).addScaledVector(back,camD);
camera.fov=dampF(camera.fov,68,10,dt);
camera.updateProjectionMatrix();
return;
}
const eyeTgt=p.swim?1.5:(p.prone?0.48:p.crouch?1.12:1.62);
p.eyeH=dampF(p.eyeH,eyeTgt,12,dt);
// ── 步行第三人称 (2026-09-20 第三人称批, 键位 U): 相机后拉/越肩 + 防穿墙 + 地面下限, 弹道仍从角色眼位出发 ──
if(thirdPersonOn()){ thirdPersonCamera(dt); return; }
let ex=p.pos.x, ey=p.pos.y+p.eyeH, ez=p.pos.z;
const sp2=Math.hypot(p.vel.x,p.vel.z);
if(sp2>0.5&&p.onGround) camBobT+=dt*(p.sprinting?11:7.4)*clamp(sp2/4.2,0.4,1.5);
const bobA=clamp(sp2/4.2,0,1)*(p.ads?0.3:1)*((p.onMG||p.onBattery)?0:1); // 炮位上不抖视角 (与 onMG 同规; 岸防炮 A#9)
ey+=Math.sin(camBobT*2)*0.021*bobA;
ex+=Math.cos(camBobT)*0.011*bobA*Math.cos(p.yaw);
ez+=Math.cos(camBobT)*0.011*bobA*-Math.sin(p.yaw);
ey-=p.landDip*0.16;
camera.position.set(ex,ey,ez);
camTrauma=Math.max(0,camTrauma-dt*2.2);
const sh=camTrauma*camTrauma*0.05;
const shX=(Math.sin(nowT*67)+Math.sin(nowT*41))*sh;
const shY=(Math.sin(nowT*53)+Math.sin(nowT*31))*sh;
const rollBob=Math.sin(camBobT)*0.006*bobA;
camera.rotation.set(0,0,0);
camera.rotation.order='YXZ';
camera.rotation.y=p.yaw+shY*0.5+p.recoilYaw;
camera.rotation.x=p.pitch+shX*0.5+p.recoilPitch;
camera.rotation.z=rollBob+shX*0.3-p.leanT*0.2;
// 侧身探头(防穿墙)
if(Math.abs(p.leanT)>0.02){
const rx2=Math.cos(p.yaw), rz2=-Math.sin(p.yaw);
const sgn=Math.sign(p.leanT);
let off=Math.abs(p.leanT)*0.45;
const lr=raycastWorld(V3(camera.position.x,camera.position.y,camera.position.z),V3(rx2*sgn,0,rz2*sgn),off+0.25);
if(lr) off=Math.max(0,lr.dist-0.25);
camera.position.x+=rx2*off*sgn;
camera.position.z+=rz2*off*sgn;
camera.position.y-=Math.abs(p.leanT)*0.05;
}
}
