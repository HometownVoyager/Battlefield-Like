// ─────────────────────────────────────────────
// 21-match.js —— 旗点占领/胜负/击杀播报/结算/历史战绩记录
// 源: Index.original.html 第 7818-7985 行
// ─────────────────────────────────────────────
'use strict';
// 终局前奏: 胜负判定触发后, 战场再打 MATCH_END_DELAY 秒才冻结进结算 (玩家能看完最后一击)
// 哨兵用 null 而非 -1: 平局等终局也要带 winner=-1 结算 (旧版 requestEnd(-1) 会死锁不结算)
let matchEndPending=null, matchEndT=0;
const MATCH_END_DELAY=1.5;
// ── 清场阶段 (2026-09-04 用户指定, 当日加码两项) ──
// 规则: 某方兵力票归零 → 该方(含玩家/Bot/坦克/飞机)封重生; 攻防/征服 任意一方占满全部旗点 → 敌方兵力立即归零。
// 胜利需同时满足两条件 (2026-09-05 用户指定: 坦克不再计入胜利条件, 敌方坦克存活与否不影响清场):
// ①攻防/征服须本队占满全部旗点 (无旗模式忽略) ②敌方场上残兵被全歼
// (地面步兵+坦克乘员+玩家; 在机飞行员不计——否则清场永远差一架打不下的敌机, 跳伞/落地后计入);
// 双方同归零 (2026-10-06 用户实机反馈+裁定): 旗权条件豁免 (双方都封重生, 占满全旗已无人能完成=死局),
//   以场上残余为准 —— 先被清空者负, 同帧清空=平局; 清场期间超时照常结算 (票多者胜)。
// 最后一人兜底: 归零方场上仅剩最后 1 人 且 对方已占满全部旗点(无旗模式忽略, 2026-09-05 加门槛; 双方同归零时豁免) 时
// 启动 30 秒清场倒计时, 到时限仍存活 → 直接判对方胜 (防躲藏拖到超时);
//   1v1 对齐 (2026-10-06 用户裁定): 双方都只剩最后 1 人时, 后启动者把双方倒计时都重置为 30s
//   (先剩1人的一方不再"先跑完先输"), 双双存活到点=平局, 单侧到点仍判对方胜。
// 无头模拟实测: 沙箱/纯Bot局里敌机常驻高空, 若把飞行员计入清场会导致只能靠超时兜底
// (2026-09-04 经用户裁定口径, 如需"击落敌机才清场"可翻转)。
const wipeAnnounced=[false,false];
const zBleedAnnounced=[false,false]; // 丧尸模式: 各队票数自然流失播报状态 (2026-10-11)
const WIPE_GRACE=30;     // 最后一人清场倒计时秒数
const wipeT=[null,null]; // 各队倒计时剩余秒数, null=未进入 (仅归零方且场上仅剩1人时启动)
function resetMatchState(){ // 对局态复位唯一入口 (2026-09-06 B7b/P2-14: 替代 22-hud startGame 的跨文件直写)
wipeAnnounced[0]=false; wipeAnnounced[1]=false;
zBleedAnnounced[0]=false; zBleedAnnounced[1]=false;
wipeT[0]=null; wipeT[1]=null;
// 终局前奏哨兵复位 (2026-09-17 P0 修 — 用户实机"一局结束后按原配置开新游戏会等 1.5S 直接进入结算"):
// 上局的 matchEndPending 若不清, 就地重开的新一局第一帧就命中 updateFlags 的"胜负已定倒计时"分支 ——
// 上局在 1.5s 前奏里被"返回主界面→新游戏"打断时 matchEndT 还剩多少, 新局就在多久之后直接弹结算。
matchEndPending=null; matchEndT=0;
// 限时复位 (同日 P0 修, 同族缺陷): startMatch 只给 assault/demolition/clash/convoy 赋 matchTime, **conquest 分支不赋** ——
// 征服图就地重开会沿用上一局的剩余时间 (上局超时打完则新局开局即超时 → 1.5s 后结算)。这里按战役口径兜底,
// startMatch 里各模式分支随后照旧覆盖 (assault 18 分 / clash·conquest 战役 matchMin 或 15 分 / 劫道 16 分)。
matchTime=(CAMPAIGN.matchMin||15)*60;
killStreakN=0; killStreakT=-99; killStreakMax=0; killStreakRefills=0; player.streakBuff=null; // 连杀计数/增益/最大连杀/续杯数随新对局复位 (2026-09-11/13/16)
initSpots(); // 强点运行态复位 (2026-09-13 草原库尔斯克改版): 归属回开局表, 占领进度清零
}
// ═════ 强点 (2026-09-13 草原库尔斯克改版): 无旗遭遇战的可争夺出生点 ═════
// spawns 升级为强点: 占领获得该点出生权 (部署/重生/推进目标全线跟着战线走, 不涉兵力票);
// 占领规则与旗同款: 圈内只有一方单位时计时, 双方在场=僵持, 计满归属翻转; team=-1=中立开局。
// ★ 2026-09-21 WS3 岛礁工事批: 把"哪些点参与占领结算"从**看 mode**改成**看数据声明** ——
//   旧口径 `GAMEMODE!=='clash'` 会让攻防图 (island, mode:'assault') 上 team:-1 的中立强点永不结算,
//   "中立可占领"在岛上名存实亡 (进度条永远停在 0)。
//   ⚠ 不能简单改成"SPOTS 非空就结算": 全库 12 张战役里只有 3 张图带 spawns ——
//     baituan (demolition, 3 条 team:0 前出进攻营) 与 canyon (convoy, 7 条 team:0/1 伏击点/集结地)
//     不是遭遇战, 它们的点是**己方固定出生点**(own 初值就是 0/1, 不是 -1); 放宽后它们会突然"开局就有归属、
//     还可被敌方抢", spawnPtsOf (部署/重生/推进目标) 跟着战线走 ⇒ 实打实的跨图平衡副作用。
//   最终口径 = 每个点在 initSpots 时打 `capturable` 标记 (数据声明):
//     clash 图 → 全部点照旧可争夺 (逐字不变);
//     非 clash 图 → 只有**显式中立开局点** (team:-1) 可争夺;
//     非 clash 且没有 team:-1 的图 (baituan/canyon) → 全部点不可争夺 ⇒ 整段 return, 运行态与旧版逐字一致。
//   等价性由 dev/verify-strongpoint.js 证明: ① 静态枚举 12 图新旧判据的唯一分歧 = island;
//   ② steppe/baituan/canyon 三图跑**控制副本对照**的 SPOTS 快照 (长度+每项 own/cap/capTeam) 逐位一致。
function initSpots(){
SPOTS.length=0;
for(const s of (CAMPAIGN.spawns||[])){
SPOTS.push({x:s.x,z:s.z,name:s.name,r:s.r||11,own:(s.team===0||s.team===1)?s.team:-1,cap:0,capTeam:-1,gy:heightAt(s.x,s.z),present:[0,0],
capturable:(GAMEMODE==='clash')||s.team===-1});
}
}
function updateSpots(dt){
if(!SPOTS.length) return;
// 一个可争夺点都没有 ⇒ 与旧版 `GAMEMODE!=='clash'` 同款整段跳过 (baituan/canyon: 连 present 都不刷)
let any=false; for(const s of SPOTS) if(s.capturable){ any=true; break; }
if(!any) return;
for(const s of SPOTS){
if(!s.capturable) continue;   // 己方固定出生点: 不参与占领 (永不结算, 与改动前一致)
let c0=0,c1=0;
for(const c of combatants){
if(!c.alive||c.onVehicle||(c.isPlayer&&c.spectator)) continue; // 观战者不计入
if(c.zombie) continue;                                         // 丧尸不计强点占领 (2026-10-06 丧尸模式)
if(Math.hypot(c.pos.x-s.x,c.pos.z-s.z)<s.r&&Math.abs(c.pos.y-s.gy)<10){
if(c.team===0)c0++; else c1++;
}
}
for(const t of tanks){
if(!t.alive) continue;
if(Math.hypot(t.pos.x-s.x,t.pos.z-s.z)<s.r){
if(t.team===0)c0++; else c1++;
}
}
s.present=[c0,c1];
let attacker=-1;
if(c0>0&&c1===0) attacker=0;
else if(c1>0&&c0===0) attacker=1;
if(attacker<0||attacker===s.own){
// 无人占领/僵持/已是己方: 进度回落
if(s.cap>0){ s.cap-=dt*0.25; if(s.cap<=0){ s.cap=0; s.capTeam=-1; } }
continue;
}
const n=attacker===0?c0:c1;
const rate=(0.07+0.035*Math.min(n,3))*(s.own===-1?1.35:1); // 中立点占领更快 (同旗口径)
if(s.capTeam!==attacker){
s.cap-=rate*dt*1.6;
if(s.cap<=0){ s.cap=0; s.capTeam=attacker; }
}else{
s.cap+=rate*dt;
if(s.cap>=1){
s.cap=0;
const prev=s.own;
s.own=attacker; s.capTeam=-1;
addKillMsg(t('{0} 占领了强点「{1}」',t(TEAM_NAME[attacker]),s.name),attacker);
if(prev!==-1&&prev!==attacker) addKillMsg(t('⚠ 强点「{0}」失守',s.name),prev);
}
}
}
}
function flagsLostOf(team){ // 攻防/征服: 胜方须占满全部旗点; 无旗模式忽略该条件
if(GAMEMODE==='assault'||GAMEMODE==='conquest') return FLAGS.filter(f=>f.owner!==team).length;
return 0;
}
function fieldCount(team){ // 在场人数: 存活地面士兵(含坦克乘员/跳伞/未登机飞行员) + 存活玩家 (观战者不计)
let n=0;
for(const s of soldiers) if(s.alive&&s.team===team&&!(s.onVehicle&&s.pilotOf)) n++;
if(player.alive&&player.team===team&&!player.spectator) n++;
return n;
}
function isTeamEliminated(team){
	if(typeof matchRunning!=='undefined'&&!matchRunning) return false;
	if(typeof fieldCount==='function'&&fieldCount(team)>0) return false;
	if(tickets[team]<=0) return true;
	return false;
}
if(typeof window!=='undefined') window.isTeamEliminated=isTeamEliminated;
function requestEnd(forceWinner){
if((typeof matchRunning!=='undefined'&&!matchRunning)||matchOver||matchEndPending!==null) return;
const winner=forceWinner!==undefined?forceWinner:(tickets[0]===tickets[1]?-1:(tickets[0]>tickets[1]?0:1));
matchEndPending=winner; matchEndT=MATCH_END_DELAY;
// ★2026-11-01 终局横幅中性化 (用户裁定): 观战态 (调试模式/自由观战共用 spectator) 在最后 1.5s 里
//   "胜利在望/败局在即"是错的 —— 观战者不属于任何一方; 改出中性"胜方 X"。普通存活玩家保持原样。
addKillMsg(t('胜负已定 · {0} · {1} 秒后结算',winner===-1?t('平局'):(player.spectator?t('胜方')+' '+t(TEAM_FACTION[winner].short):(winner===player.team?t('胜利在望'):t('败局在即'))),MATCH_END_DELAY),winner);
}
function updateFlags(dt){
if(typeof matchRunning!=='undefined'&&!matchRunning) return;
let owned=[0,0,0];
for(const f of FLAGS){
// 占领规则: 任意旗点双方均可随时直接占领, 不再有顺序限制 (攻防模式防守方也可反夺)
// (2026-11-10: 瘫舰旗点 fActive 门随大舰子系统下架摘除 —— 大舰不在了, 旗点恒可占)
// 丧尸机制: 丧尸会在无意中占领无人值守的旗点 (c0===0&&c1===0&&c2>0), 人类在场则阻占/交火
let c0=0,c1=0,c2=0;
for(const c of combatants){
if(!c.alive||c.onVehicle||(c.isPlayer&&c.spectator)) continue; // 观战者不计入占旗/阻占
// 高度容差: 见 00-config 的 FLAG_DY_TOL (2026-09-26E 审计 30: 旧值 10m 让桥下泳者能占桥面旗)
if(Math.hypot(c.pos.x-f.x,c.pos.z-f.z)<f.r&&Math.abs(c.pos.y-f.gy)<FLAG_DY_TOL){
if(c.zombie) c2++;
else if(c.team===0) c0++;
else if(c.team===1) c1++;
}
}
for(const t of tanks){
if(!t.alive) continue;
if(Math.hypot(t.pos.x-f.x,t.pos.z-f.z)<f.r){
if(t.team===0)c0++; else if(t.team===1) c1++;
}
}
f.present=[c0,c1,c2];
let attacker=-1;
if(c0>0&&c1===0&&c2===0) attacker=0;
else if(c1>0&&c0===0&&c2===0) attacker=1;
else if(c0===0&&c1===0&&c2>0) attacker=2; // 无人值守旗点: 丧尸无意占领
if(attacker>=0&&attacker!==f.owner){
const n=attacker===0?c0:(attacker===1?c1:c2);
const rate=(0.07+0.035*Math.min(n,3))*(f.owner===-1?1.35:1);
if(f.capTeam!==attacker){
f.cap-=rate*dt*1.6;
if(f.cap<=0){ f.cap=0; f.capTeam=attacker; }
} else {
f.cap+=rate*dt;
if(f.cap>=1){
f.cap=0;
f.owner=attacker; f.capTeam=-1;
drawFlagTex(f);
const teamStr=attacker===2?t('丧尸'):t(TEAM_NAME[attacker]||'阵营');
addKillMsg(t('{0} 占领了 {1} 点',teamStr,f.id),attacker);
for(const c of combatants){
if(c.alive&&c.team===attacker&&Math.hypot(c.pos.x-f.x,c.pos.z-f.z)<f.r){
c.score=(c.score||0)+SCORE_TABLE.flag;
if(c.isPlayer){ showKillPop(t('占领 {0} 点',f.id),SCORE_TABLE.flag); player.caps=(player.caps||0)+1; if(ZOMBIE_MODE) pzGain(ZCFG.zp.flag); } // caps: 结算占领数 (2026-09-13); ZP: 丧尸模式占旗给点 (2026-10-06 裁定④)
}
}
	// 占满全部旗点 → 敌方兵力立即归零进入清场 (2026-09-04 用户指定: 攻防/征服任一方占满都生效 —
	// 修复淞沪会战防守方(国军)占满全旗毫无反应的旧缺陷, 旧版只认进攻方)
	// 丧尸模式: 占满全旗不触发兵力归零 (胜负只认 撑过时限/全灭出局, 2026-10-06 设计 §3.5)
	if(!ZOMBIE_MODE&&(GAMEMODE==='assault'||GAMEMODE==='conquest')){
		if(FLAGS.every(ff=>ff.owner===attacker)){   // (2026-11-10: 瘫舰旗点豁免项随大舰子系统下架摘除)
	if(tickets[1-attacker]>0){
	tickets[1-attacker]=0;
	wipeAnnounced[1-attacker]=true;
	addKillMsg(t('⚠ {0} 占领了全部旗点 · {1} 兵力归零 · 消灭其场上残兵方可获胜',t(TEAM_NAME[attacker]),t(TEAM_NAME[1-attacker])),attacker);
	}
	}else if(GAMEMODE==='assault'&&attacker===ATK){
	// 占旗返还: +40实测让攻方票数越打越多(实测330→998), 2026-09-01 用户指定降为+10
	tickets[ATK]=Math.min(tickets[ATK]+SCORE_TABLE.flagReturn,TICKET_CAP);
	}
	}
}
}
} else if(((c0>0&&c1>0)||(c0>0&&c2>0)||(c1>0&&c2>0))&&f.capTeam!==-1){
// 圈内存在多方势力: 争夺中, 进度冻结等待分出胜负 (HUD会提示"争夺中")
} else if(f.owner>=0&&f.capTeam!==-1&&f.capTeam!==f.owner&&((f.owner===0&&c0>0)||(f.owner===1&&c1>0)||(f.owner===2&&c2>0))){
// 守方回到圈内且圈内无敌军: 快速回落敌方占领进度 (攻防模式防守方同样生效)
f.cap-=dt*0.5;
if(f.cap<=0){ f.cap=0; f.capTeam=-1; }
} else {
f.cap-=dt*0.06;
if(f.cap<=0){ f.cap=0; f.capTeam=-1; }
}
if(f.owner>=0) owned[f.owner]++;
f.flagMesh.position.y=dampF(f.flagMesh.position.y,f.owner!==-1?f.poleTop-f.cap*2:f.gy+3.2+f.cap*2.4,4,dt);
// 布料波: 挂边铰接于杆缘(微幅风向偏转) + 沿幅面两轴正弦涟漪 —— 越靠旗尾摆幅越大, 挂边恒贴旗杆
f.flagMesh.rotation.y=Math.sin(nowT*1.3+f.x)*0.12;
{
const fp=f.flagGeo.attributes.position, fb=f.flagBase;
for(let i=0;i<fp.count;i++){
const bx=fb[i*3], by=fb[i*3+1], w=bx/2.4; // w: 0=挂边 1=旗尾
fp.setZ(i,(Math.sin(nowT*4.2+bx*2.6+f.x*0.7)+Math.sin(nowT*7.3+by*4.1+f.z*0.5)*0.45)*0.13*w);
fp.setX(i,bx+Math.sin(nowT*2.2+f.z)*0.07*w*w);
}
fp.needsUpdate=true;
}
}
if(!matchOver){
	// 终局前奏: 胜负已定但尚未冻结 —— 剩余判定全部旁路, 倒计时结束后 endMatch
	if(matchEndPending!==null){
	matchEndT-=dt;
	if(matchEndT<=0) endMatch(matchEndPending);
	return;
	}
	// ── 丧尸模式胜负专门流 (2026-10-06 §3.5 & 2026-10-11 用户裁定重构) ──
	// 规则单源: 失败判定恒为“无票数 (tickets <= 0) + 无在场人员 (fieldCount === 0)”;
	// 若一方在场人员全部被丧尸感染/阵亡却仍有票数，则赋予票数自然流失状态 (2票/秒)，期间仍可消耗票数正常重生；
	// 单队模式: 我方淘汰即败, 撑过时限胜利由 25-zombies 导演判定;
	// 双队对抗: 某队淘汰出局则剩余存活队立即获胜, 双方同帧淘汰则平局。
	if(typeof ZOMBIE_MODE!=='undefined'&&ZOMBIE_MODE){
		const bleedRate=(typeof ZCFG!=='undefined'&&ZCFG.ticketBleedRate)||2.0;
		for(let tt=0;tt<2;tt++){
			if(ZOMBIE_MODE==='solo'&&tt!==player.team) continue;
			const fc=fieldCount(tt);
			if(fc===0&&tickets[tt]>0){
				tickets[tt]=Math.max(0,tickets[tt]-bleedRate*dt);
				if(!zBleedAnnounced[tt]){
					zBleedAnnounced[tt]=true;
					if(ZOMBIE_MODE==='solo'){
						addKillMsg(t('⚠ 全员覆灭 · 兵力票持续流失中 · 尽快部署！'),player.team);
					}else{
						addKillMsg(t('⚠ {0} 全员覆灭 · 兵力票持续流失中 · 尽快重整旗鼓！',t(TEAM_NAME[tt])),tt);
					}
				}
			}else if(fc>0){
				zBleedAnnounced[tt]=false;
			}
		}

		if(ZOMBIE_MODE==='solo'){
			if(isTeamEliminated(player.team)){
				requestEnd(1-player.team);
				return;
			}
		}else if(ZOMBIE_MODE==='teams'){
			const elim0=isTeamEliminated(0), elim1=isTeamEliminated(1);
			if(elim0&&elim1){ requestEnd(-1); return; }
			if(elim0){ requestEnd(1); return; }
			if(elim1){ requestEnd(0); return; }
		}
		return;
	}
	// 清场判定: 兵力归零方封重生, 对方须 占满全旗(攻防/征服)+歼灭场上全部残兵 才判胜 (2026-09-05: 坦克不再计入);
	// 双方同归零时旗权条件豁免 (2026-10-06 用户实机反馈"双方0剩余无法结束战局": 两边都封重生了,
	// 没人有票力去完成占满全旗, 再要求它=死局), 以场上残余为准: 先被清空者负, 同帧清空=平局
	const z0=tickets[0]<=0, z1=tickets[1]<=0;
	if(z0&&!wipeAnnounced[0]){
		wipeAnnounced[0]=true;
		if(typeof ZOMBIE_MODE!=='undefined'&&ZOMBIE_MODE){
			if(ZOMBIE_MODE==='solo') addKillMsg(t('⚠ 兵力耗尽 · 全灭即出局'),1);
			else addKillMsg(t('⚠ {0} 兵力耗尽 · 消灭其场上残兵方可获胜',t(TEAM_NAME[0])),1);
		}else{
			addKillMsg(t('⚠ {0} 兵力耗尽 · {1} {2}消灭其场上残兵方可获胜',t(TEAM_NAME[0]),t(TEAM_NAME[1]),(z1?0:flagsLostOf(1))>0?t('须占领全部旗点(余 {0} 点)+ ',flagsLostOf(1)):''),1);
		}
	}
	if(z1&&!wipeAnnounced[1]){
		wipeAnnounced[1]=true;
		if(typeof ZOMBIE_MODE!=='undefined'&&ZOMBIE_MODE){
			addKillMsg(t('⚠ {0} 兵力耗尽 · 消灭其场上残兵方可获胜',t(TEAM_NAME[1])),0);
		}else{
			addKillMsg(t('⚠ {0} 兵力耗尽 · {1} {2}消灭其场上残兵方可获胜',t(TEAM_NAME[1]),t(TEAM_NAME[0]),(z0?0:flagsLostOf(0))>0?t('须占领全部旗点(余 {0} 点)+ ',flagsLostOf(0)):''),0);
		}
	}
	if(z0&&z1){
	const f0=fieldCount(0), f1=fieldCount(1);
	if(f0===0&&f1===0){ requestEnd(-1); return; }
	if(typeof ZOMBIE_MODE!=='undefined'&&ZOMBIE_MODE==='teams'){
		// 丧尸双队对抗: 单方全灭不立即宣告胜利, 存活队仍需撑过10分钟由 25-zombies 判定
	}else{
		if(f0===0){ requestEnd(1); return; }
		if(f1===0){ requestEnd(0); return; }
	}
	}else if(z0){
	if(typeof ZOMBIE_MODE!=='undefined'&&ZOMBIE_MODE==='teams'){
		// 丧尸双队对抗: 队0出局, 队1仍需抵抗尸潮撑过10分钟由 25-zombies 判定
	}else if(ZOMBIE_MODE){ if(fieldCount(0)===0){ requestEnd(1); return; } }   // 丧尸模式: 票尽且全灭=出局 (无旗权门槛, 2026-10-06 §3.5)
	else if(fieldCount(0)===0&&flagsLostOf(1)===0){ requestEnd(1); return; }
	}else if(z1){
	if(typeof ZOMBIE_MODE!=='undefined'&&ZOMBIE_MODE==='teams'){
		// 丧尸双队对抗: 队1出局, 队0仍需抵抗尸潮撑过10分钟由 25-zombies 判定
	}else if(ZOMBIE_MODE){ if(fieldCount(1)===0){ requestEnd(0); return; } }
	else if(fieldCount(1)===0&&flagsLostOf(0)===0){ requestEnd(0); return; }
	}
	// 最后一人清场倒计时 (2026-09-04 用户指定; 2026-09-05 加触发门槛: 须对方已占满全部旗点[无旗模式忽略]才启动,
	// 旗权未占满时对方须先完成占旗; 倒计时期间旗权被翻回 → 倒计时复位, 重新占满后从 30s 重来)
	// 2026-10-06 同归零豁免+对齐 (用户裁定): 双方都归零时旗权门槛豁免 (同上, 已无意义);
	//   双方同处最后1人 (1v1) 时后启动者把双方计时都重置为 30s —— 先剩1人的一方不再"先跑完先输",
	//   对齐后双方同帧到点 ⇒ 平局 (单侧到点仍判对方胜, 旧口径不变)。
	//   启动/对齐与扣减拆成两段: 对齐若发生在扣减之后, 会被本帧扣减弄出 1 帧错位 (先到点方被误判负)。
	for(let zt=0;zt<2;zt++){
	if(tickets[zt]<=0&&fieldCount(zt)===1&&((z0&&z1)||flagsLostOf(1-zt)===0)){
	if(wipeT[zt]===null){
	wipeT[zt]=WIPE_GRACE;
	if(wipeT[1-zt]!==null){
	wipeT[1-zt]=WIPE_GRACE;
	addKillMsg(t('⚖ 双方均仅剩最后 1 人 · 倒计时对齐为 {0} 秒 · 双双存活到时限即平局',WIPE_GRACE));
	}
	addKillMsg(t('⚠ {0} 场上仅剩最后 1 人 · {1} 秒清场倒计时 · 到时限未被歼灭则直接判负',t(TEAM_NAME[zt]),WIPE_GRACE),1-zt);
	}
	}else wipeT[zt]=null;
	}
	for(let zt=0;zt<2;zt++){ if(wipeT[zt]!==null) wipeT[zt]-=dt; }
	// 到点判定移出累计循环 (2026-10-06): 双方同帧到点=平局 —— 对齐后本就同帧, 此处兜住一切巧合同帧
	for(let zt=0;zt<2;zt++){
	if(wipeT[zt]!==null&&wipeT[zt]<=0){
	if(wipeT[1-zt]!==null&&wipeT[1-zt]<=0){ addKillMsg(t('⏳ 双方清场倒计时同时到点 · 双方最后一人均存活 · 平局')); requestEnd(-1); }
	else{ addKillMsg(t('⏳ 清场倒计时结束 · {0} 最后一人仍存活 · {1} 获胜',t(TEAM_NAME[zt]),t(TEAM_NAME[1-zt])),1-zt); requestEnd(1-zt); }
	return;
	}
	}
	// 破袭模式: 检测补给库摧毁
	if(GAMEMODE==='demolition'){
	let left=0;
	for(const d of DEPOTS){
	if(!d.destroyed&&d.g&&d.g.dead){
	d.destroyed=true;
	addKillMsg(t('补给库 {0} 被摧毁!',d.id),ATK);
	tickets[ATK]=Math.min(tickets[ATK]+SCORE_TABLE.depot,TICKET_CAP);
	}
	if(!d.destroyed) left++;
	}
	if(left===0){ requestEnd(ATK); return; }
	}
	// 旗权压制 2026-09-02 用户指定: 需同时满足 ①一方占领超过一半旗点 ②另一方点位少于2个 才掉人数;
	// 否则开局就近拆分(诺曼底2-3/淞沪1-3)一触即压, 开场就掉人数
	if(GAMEMODE==='conquest'&&!ZOMBIE_MODE){
	const n=FLAGS.length;
	const lead=owned[0]>owned[1]?0:(owned[1]>owned[0]?1:-1);
	if(lead>=0&&owned[lead]*2>n&&owned[1-lead]<2){
	tickets[1-lead]=Math.max(0,tickets[1-lead]-dt*(owned[lead]-owned[1-lead])*0.12);
	}
	}
	if(GAMEMODE==='assault'){
	// 攻防: 仅攻方占超一半且守方仅余1点才压制 (守方开局持多不等于反向压制进攻方, 否则淞沪1-3开局即掉人)
	const n2=FLAGS.length;
	if(owned[ATK]*2>n2&&owned[DEF]<2){
	tickets[DEF]=Math.max(0,tickets[DEF]-dt*(owned[ATK]-owned[DEF])*0.12);
	}
	}
	if(GAMEMODE==='convoy'){
	// 劫道: ≥escapeN 辆突围→护运方胜; 车队全部消失(毁+逃=总数)→已毁居多判劫道方胜;
	// 超时则按已毁/突围多数判胜
	const cs=CONVOY_STATE;
	const escN=(CAMPAIGN.convoy&&CAMPAIGN.convoy.escapeN)||3;
	if(cs&&!cs.over){
	if(cs.esc>=escN){ cs.over=true; requestEnd(DEF); return; }
	if(cs.destroyed+cs.esc>=cs.total){ cs.over=true; requestEnd(cs.destroyed>cs.esc?ATK:DEF); return; }
	}
	}
	matchTime-=dt;
	if(matchTime<=0&&!ZOMBIE_MODE){   // 丧尸模式无时限结算 (单队=撑过时限由 25-zombies 导演判, 多队=打到出局)
	if(GAMEMODE==='convoy'&&CONVOY_STATE&&!CONVOY_STATE.over){
	CONVOY_STATE.over=true;
	requestEnd(CONVOY_STATE.destroyed>=CONVOY_STATE.esc?ATK:DEF);
	}else requestEnd();
	}
	}
}
// ── 结算 SVG 图标 (2026-09-13 结算改版): 胜=金桂冠星徽 / 负=碎裂盾徽 / 平=等号盾徽 ──
const END_SVG_WIN=`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="endWg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset="1" stop-color="#c8963c"/></linearGradient></defs><g fill="none" stroke="url(#endWg)" stroke-width="2.6" stroke-linecap="round"><path d="M14 46 C10 34 14 20 26 13"/><path d="M50 46 C54 34 50 20 38 13"/><path d="M15 41 q-6 -1 -8 -6"/><path d="M13 33 q-6 -2 -7 -8"/><path d="M14 25 q-5 -3 -5 -9"/><path d="M18 18 q-4 -4 -3 -10"/><path d="M49 41 q6 -1 8 -6"/><path d="M51 33 q6 -2 7 -8"/><path d="M50 25 q5 -3 5 -9"/><path d="M46 18 q4 -4 3 -10"/></g><path d="M32 17 L34.7 24.28 L42.46 24.6 L36.37 29.42 L38.47 36.9 L32 32.6 L25.53 36.9 L27.63 29.42 L21.54 24.6 L29.3 24.28 Z" fill="url(#endWg)"/></svg>`;
const END_SVG_LOSE=`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="endLg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d87a6a"/><stop offset="1" stop-color="#8a3428"/></linearGradient></defs><path d="M32 8 L52 15 V32 C52 45 43 54 32 58 C21 54 12 45 12 32 V15 Z" fill="none" stroke="url(#endLg)" stroke-width="3.4" stroke-linejoin="round"/><path d="M32 11 L27 23 L34 29 L28 41 L33 54" fill="none" stroke="#38110b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const END_SVG_DRAW=`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><path d="M32 8 L52 15 V32 C52 45 43 54 32 58 C21 54 12 45 12 32 V15 Z" fill="none" stroke="#9fb6c9" stroke-width="3.2" stroke-linejoin="round"/><path d="M22 27 H42 M22 37 H42" stroke="#9fb6c9" stroke-width="3.2" stroke-linecap="round"/></svg>`;
// 观战结算图标 (★2026-10-30 中性观战结算, 用户裁定④): 钢灰"观战之眼" —— 非胜负配色, 与 END_SVG_DRAW 同族中性灰
const END_SVG_SPEC=`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="endSg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b8c4ce"/><stop offset="1" stop-color="#6b7a88"/></linearGradient></defs><path d="M8 32 C18 18 46 18 56 32 C46 46 18 46 8 32 Z" fill="none" stroke="url(#endSg)" stroke-width="3" stroke-linejoin="round"/><circle cx="32" cy="32" r="7.5" fill="none" stroke="url(#endSg)" stroke-width="3"/><circle cx="32" cy="32" r="2.6" fill="url(#endSg)"/></svg>`;
// ═════ 历史战绩记录 (2026-09-16 记录批): 结算全项判纪录 + 主菜单「战绩数据」数据源 ═════
// 口径 (用户 2026-09-16 指示):
//   ①结算页每一项战绩 (得分/击杀/阵亡/K·D/最大连杀/爆头/占领) 都判「新纪录」—— 越低越好的项 (阵亡数)
//     按更小值判, 最佳文案随之翻转成"本图最少 N" (方向与格式登记在 00-config REC_STATS, 加项只改那张表);
//   ②首战即立纪录: 该项此前没有记录时, 本局值直接成为纪录 (同样打新纪录徽章);
//   ③观战模式照常计分 (结算页数值与平时一模一样), 但**本局不进历史记录** —— 结算页与数据面板都写明。
// 判据 = 结算瞬间仍在观战 (player.spectator) **或** 本局在观战态下部署过 (player.specUsed 粘性标记)。
// ★2026-09-27 收窄 (用户实报"选了一下观战模式再取消的情况判定为观战模式不予计量"): specUsed 的语义由
// "本局开过观战"改为"本局**顶着观战态部署过**" (盖章点唯一: 23-deploy deployPlayer)。于是在兵种卡上点开
// 又取消、或只在菜单里试一下开关, 都不再让整局白打; 而"开观战刷完再关掉"仍被拦在历史之外 (粘性不还原) ——
// 那才是这条判据原本要挡的 (观战免伤·不被索敌·弹药无限, 用它刷出来的成绩不作数)。
// 存档 sf_rec_<战役id> = JSON {v,plays,score,+REC_STATS 各项}; 缺项一律用 undefined 判定"无记录"
// (0 是合法记录值 —— 一枪未发就阵亡的 0 杀照样是纪录)。
function recLoad(id){ // 读本图记录 (旧键 sf_best_<id> 只读兼容); 存档损坏视为无记录, 不让它把结算页拖崩
let rec=null;
try{
const raw=localStorage.getItem(REC_KEY_PRE+id);
if(raw){ const o=JSON.parse(raw); if(o&&typeof o==='object'&&!Array.isArray(o)) rec=o; }
}catch(e){ rec=null; }
if(!rec){
const legacy=parseInt(localStorage.getItem(REC_LEGACY_PRE+id)||'',10);
if(Number.isFinite(legacy)&&legacy>0) rec={score:legacy,plays:1}; // 旧存档只有最高分: 它至少打满过 1 局, 其余项留空
}
return rec;
}
function recKnown(rec){ // 规范化: 只认表里登记的键, 值必须是有限数 (脏存档/旧版本多余字段一律丢弃)
const out={v:REC_VER,plays:0};
if(rec){
out.plays=Math.max(0,Math.floor(Number(rec.plays)||0));
if(Number.isFinite(rec.score)&&rec.score>=0) out.score=Math.round(rec.score);
for(const st of REC_STATS){ const v=rec[st.key]; if(typeof v==='number'&&Number.isFinite(v)) out[st.key]=v; } // null/字符串一律不算记录
}
return out;
}
function recMatchValues(){ // 本局战绩取值 (单源: 结算页卡片与记录写入共用同一份)
const kills=player.kills||0, deaths=player.deaths||0;
return {score:Math.max(0,Math.round(player.score||0)), kills, deaths,
 kd:deaths>0?kills/deaths:kills, // 无阵亡时记为该局击杀数 (与旧结算页显示 "12" 的口径一致, 且可直接比大小)
 streak:killStreakMax||0, heads:player.headKills||0, caps:player.caps||0,
 demol:player.demol||0}; // 摧毁数: 拆掉的地图可破坏物组数 (2026-09-26 破坏得分批)
}
function recBetter(st,v,best){ return best===undefined?true:(st.lower?v<best:v>best); } // 首战即纪录
function recCommit(){ // 结算唯一入口: 判定 → (非观战才) 落盘 → 返回结算页所需的一切
const vals=recMatchValues();
const id=CAMPAIGN.id;
// ★2026-11-01 计入口径 (用户裁定): 自由观战视模式 (specView, 只看不动 ⇒ 不干涉战局) **计入历史**;
//   旧调试观战 (能召幽灵坦克/开火/时停 = 能干涉战局) 维持不计入。两者共享 spectator=true,
//   差异只在 specView 标记; specUsed 仍只由调试观战部署盖单源 (23-deploy deployPlayer)。
const counted=!(player.spectator&&player.specView)&&!player.specUsed;
const prev=recKnown(recLoad(id));
const best={}, isNew={};
isNew.score=prev.score===undefined?true:vals.score>prev.score;
best.score=isNew.score?vals.score:prev.score;
for(const st of REC_STATS){
const b=prev[st.key], n=recBetter(st,vals[st.key],b);
isNew[st.key]=n; best[st.key]=n?vals[st.key]:b;
}
let plays=prev.plays;
if(counted){
plays=prev.plays+1;
const rec=Object.assign({v:REC_VER,plays},best);
try{ localStorage.setItem(REC_KEY_PRE+id,JSON.stringify(rec)); }catch(e){}
}else{
// 观战局: 历史原样不动 —— 结算页显示的是"存档里的最佳"(不是本局值), 且一律不打新纪录徽章
for(const k in best) best[k]=prev[k];
for(const k in isNew) isNew[k]=false;
}
return {id,counted,vals,best,isNew,plays};
}
function recBestText(st,v){ // 本图最佳文案 (st=null → 得分卡, 恒越高越好); v=undefined → 还没有记录
if(v===undefined) return t('本图暂无记录');
return st?t(st.lower?'本图最少 {0}':'本图最高 {0}',st.fmt(v)):t('本图最高 {0}',v);
}
function recStatCardsHTML(R){ // 结算页六张战绩卡: 本局值 + 本图最佳 + 新纪录徽章 (得分卡另有专属大卡)
return REC_STATS.map(st=>{
const isNew=!!R.isNew[st.key];
return `<div class="statCard${isNew?' rec':''}"><div class="v">${st.fmt(R.vals[st.key])}</div>`
 +`<div class="k">${t(st.label)}</div>`
 +`<div class="b">${recBestText(st,R.best[st.key])}</div>`
 +(isNew?`<div class="rec">${t('新纪录!')}</div>`:'')+`</div>`;
}).join('');
}
function recPanelHTML(){ // 主菜单「战绩数据」面板内容: 各图历史最佳一表 (22-hud 每次打开面板重算)
const cell=(st,v)=>Number.isFinite(v)?`<div class="recV">${st?st.fmt(v):String(v)}</div>`:'<div class="recV none">—</div>';
let html='<div class="recRow head"><div class="recMap">'+t('地图')+'</div>'
 +'<div class="recV">'+t('得分')+'</div>'
 +REC_STATS.map(st=>`<div class="recV">${t(st.label)}${st.lower?' ↓':''}</div>`).join('')+'</div>';
for(const c of CAMPAIGNS){
const rec=recKnown(recLoad(c.id));
const played=rec.plays>0;
html+=`<div class="recRow${played?'':' empty'}"><div class="recMap">`
 +`<span class="rmT">${t2(c.title)}</span>`
 +`<span class="rmS">${t2(c.modeName)} · ${played?t2('已战 {0} 局',rec.plays):t2('未 征 战')}</span></div>`
 +cell(null,rec.score)+REC_STATS.map(st=>cell(st,rec[st.key])).join('')+'</div>';
}
return html;
}
// ── 终身累计统计 (2026-11-11 数据批): sf_stats = 历局总计 (击毁载具/击杀/死亡/胜利/失败/占领旗点)。
//    结算 funnel 唯一: endMatch 在 recCommit 之后调 statsAccumulate(winner) —— winner 判定与结算页同源;
//    观战局 (counted 判据与 recCommit 同一行口径) 不累计, 免得观战免伤刷数。击毁载具账来自
//    坦克/卡车/战机/舰艇 die 链四处钩 (15-vehicles/15b-trucks/16-aircraft/15d-naval)。 ──
function statsLoad(){
try{ const r=JSON.parse(localStorage.getItem('sf_stats')||'{}'); return (r&&typeof r==='object'&&!Array.isArray(r))?r:{}; }catch(e){ return {}; }
}
let LIFE_STATS=statsLoad();
function statsSave(){ try{ localStorage.setItem('sf_stats',JSON.stringify(LIFE_STATS)); }catch(e){} }
function statsAccumulate(winner){ // winner: endMatch 判定的胜方队伍号 (平局=-1); 观战局自判不累计
const counted=!(player.spectator&&player.specView)&&!player.specUsed;
if(!counted) return LIFE_STATS;
LIFE_STATS.kills=(LIFE_STATS.kills||0)+(player.kills||0);
LIFE_STATS.deaths=(LIFE_STATS.deaths||0)+(player.deaths||0);
LIFE_STATS.caps=(LIFE_STATS.caps||0)+(player.caps||0);
LIFE_STATS.veh=(LIFE_STATS.veh||0)+(player.vehKills||0);
if(winner===player.team) LIFE_STATS.wins=(LIFE_STATS.wins||0)+1;
else if(winner!==-1) LIFE_STATS.losses=(LIFE_STATS.losses||0)+1;
statsSave();
return LIFE_STATS;
}
function recLifeHTML(){ // 数据统计面板「终身累计」六格 (22-hud renderRecordsPanel 每次打开重算)
const L=LIFE_STATS||{};
const item=(k,label)=>`<div class="lifeCell"><div class="lifeV">${Math.floor(Number(L[k])||0)}</div><div class="lifeK">${t(label)}</div></div>`;
return '<div class="lifeGrid">'
+item('veh','总共击毁载具')+item('kills','总共击杀')+item('deaths','总共死亡')
+item('wins','总共胜利')+item('losses','总共失败')+item('caps','总共占领旗点')
+'</div>';
}
function clearGameData(){ // 清除游戏数据 (2026-11-11 数据批): 战绩记录/最高分/成就/统计全清, 设置类 (语言/画质/灵敏度...) 保留
const kill=[];
try{
for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i);
if(k&&(k.indexOf('sf_rec_')===0||k.indexOf('sf_best_')===0||k==='sf_ach'||k==='sf_stats')) kill.push(k); }
}catch(e){}
for(let i=0;i<kill.length;i++){ try{ localStorage.removeItem(kill[i]); }catch(e){} }
LIFE_STATS=statsLoad();
if(typeof ACH!=='undefined'&&ACH&&ACH.resetAll) ACH.resetAll(); // 成就内存账+弹框闩同步清 (重达成可再弹)
return kill.length;
}
function endMatch(forceWinner){
matchOver=true;
if(typeof killcamEnd==='function') killcamEnd(); // killcam 随结算一次收账 (2026-11-12 死亡视角批: 结算屏覆盖前先还原画布滤镜)
// 观战时停随战局结束收尾 (2026-09-27M 时停修复批, 审计 P1-4): specTimeFrozen 本身就要求 !matchOver ⇒
// 结算起时停已自动失效; 这里显式复位的是**状态残留** (SPEC_TIME.paused), 免得"结算 → 返回主界面 →
// 下一局"这条链上把上一局的暂停态带进新局 (换局路径另有 resetPlayerForNewMatch 的复位, 两处同源)。
if(typeof specTimeReset==='function') specTimeReset();
// 指挥地图随结算强制关 (2026-10-26 指挥官批, D20): 减速态同帧自愈 (cmdFrameTick 的 matchOver 门)。
if(typeof cmdMapForceClose==='function') cmdMapForceClose();
// 终局前奏哨兵就地消费 (2026-09-17 P0 修, 与 resetMatchState 同一族): 结算已落地, 哨兵留着就是"下一次开新局
// 第一帧再判一次胜负"; 这里清掉让哨兵的生命周期严格等于"一次终局前奏"。
matchEndPending=null; matchEndT=0;
matchRunning=false; // 战局存续期结束: 菜单不再是「返回战斗」而是「进入战场」—— 这一局没有可回去的地方了 (2026-09-16 本批)
// 结算页是"另一条路径"进入本函数 (返回主界面后按 Esc 继续): 暂停态必须就地复位, 否则暂停面板会叠在结算页上、
// 且 Esc 继续会被 gamePaused 吃掉 (2026-09-16 本批)
if(gamePaused){ gamePaused=false; if(AudioSys.setAmbientMute) AudioSys.setAmbientMute(false); }
const pov=document.getElementById('pauseOv'); if(pov) pov.classList.add('hidden');
menuHold=false; // 结算页接管冻结权: 主循环改由 matchOver 冻结 (人员已在主菜单时同理, 结算页直接盖上主菜单)
// 对局结束: 一切声音立即停下并进入静默期 (2026-09-17 音效停止批) —— 旧版只 setAmbientMute(true) (仅压环境/
// 引擎增益), 结算页上仍会响: 已排程的尾音、定时器里排队的远雷/环境枪声都照旧; 而 returnToMenu 里那句
// setAmbientMute(false) 又把引擎增益还原成上一帧的音量, 于是主菜单里一直响着"结算时的战场音"(用户实报)。
// stopAll = 闭合总闸 + 环境归零 + 停引擎 + 挂起全部发声入口; 回战局/开新局由 restoreAll 解除。
if(AudioSys.stopAll) AudioSys.stopAll();
else if(AudioSys.setAmbientMute) AudioSys.setAmbientMute(true);
const winner=forceWinner!==undefined?forceWinner:(tickets[0]===tickets[1]?-1:(tickets[0]>tickets[1]?0:1));
// 历史战绩落盘在"冻结那一刻"立即完成 (2026-09-16 记录批): 结算画面还要等 0.9s 才画出来,
// 那段时间关页/返回/直接开新局都不该把这一局的记录丢掉 —— 故 recCommit 提到 setTimeout 之外, 画面只消费它的结果。
const REC=recCommit();
if(typeof statsAccumulate==='function') statsAccumulate(winner); // 终身累计 (2026-11-11 数据批): winner 与结算页同源; 观战局 counted 门在函数内自判 (与 recCommit 同口径)
document.exitPointerLock&&document.exitPointerLock();
(typeof addMatchTimeout==='function'?addMatchTimeout:setTimeout)(()=>{
document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden'));
const end=document.getElementById('end');
end.classList.remove('hidden');
document.body.classList.add('inMenu'); // 结算画面同菜单: 隐藏战斗 HUD
if(typeof syncDeployHud==='function') syncDeployHud(); // 结算也收起了 .screen(含部署界面) ⇒ 摘掉 inDeploy (2026-09-20 第6条)
// 结算改版 (2026-09-13) + 全项记录 (2026-09-16 记录批): SVG 胜负图标 + 本局得分卡 + 六张战绩卡,
// 每一项都带本图历史最佳与「新纪录」徽章; 观战局照常显示本局数据, 但历史不动并明写"不计入历史记录"
// ★2026-10-30 中性观战结算 (用户裁定④): 观战局 (判据与 recCommit 同源 = !REC.counted) 不再出胜利/战败 ——
//   图标换"观战之眼" (END_SVG_SPEC, 钢灰配色), 标题「对 局 结 束」 (沿用 draw 的中性配色),
//   副标题末段的己方阵营位换成「胜方 · X」 (平局=「平局」); 得分卡/战绩卡/兵力条/不计入历史说明全保留。
const win=winner===player.team, draw=winner===-1, _specMatch=!REC.counted;
document.getElementById('endIcon').innerHTML=_specMatch?END_SVG_SPEC:(draw?END_SVG_DRAW:(win?END_SVG_WIN:END_SVG_LOSE));
const title=document.getElementById('endTitle');
if(_specMatch){ title.textContent=t('对 局 结 束'); title.className='draw'; }
else{
title.textContent=draw?t('平  局'):(win?t('胜  利'):t('战  败'));
title.className=draw?'draw':(win?'win':'lose');
}
// 副标题模式名 (2026-10-07c): procgen 的 modeName 是"征服·程序化战场", 丧尸局照搬会写出
// "胜利 · 征服·程序化战场"这种错位字样 —— 丧尸局改显玩法名 (单队生存/双队对抗)。
const _facTail=_specMatch?(draw?t('平局'):t('胜方')+' '+t(TEAM_FACTION[winner].short)):t(TEAM_FACTION[player.team].short);
document.getElementById('endSub').textContent=`${t(CAMPAIGN.title)} · ${t(ZOMBIE_MODE?t('丧尸模式 · '+(ZOMBIE_MODE==='solo'?'单队生存':'双队对抗')):CAMPAIGN.modeName)} · ${_facTail}`;
document.getElementById('endScore').textContent=REC.vals.score;
document.getElementById('endBest').textContent=recBestText(null,REC.best.score);
document.getElementById('endNewRec').classList.toggle('hidden',!REC.isNew.score);
document.getElementById('endSpecNote').classList.toggle('hidden',REC.counted); // 观战: 明确写出不计入历史
if(typeof syncEndSeedLine==='function') syncEndSeedLine();
document.getElementById('endGrid').innerHTML=recStatCardsHTML(REC);
const mx=Math.max(1,tickets[0],tickets[1]);
const bar=z=>`<div class="tRow"><div class="tName t${z}">${t(TEAM_NAME[z])}</div>`+
`<div class="tBarWrap"><div class="tBar t${z}" style="width:${Math.max(0,Math.min(100,tickets[z]/mx*100))}%"></div></div>`+
`<div class="tInfo">${Math.ceil(tickets[z])} ${t('票')} · ${fieldCount(z)} ${t('在场')}</div></div>`;
// 单队生存 (2026-10-07c 修"结算页严重不合理"): 局里根本没有第二支队伍 —— 旧版无条件渲染两军兵力条,
// 结算页出现"德军 330票·0在场"这种无中生有的对面 (丧尸是 ZTEAM=2 假想队, 零票务, tickets[1] 只是
// startGame 预填的死数)。第二行改显丧尸战果: 条=清剿进度 (已消灭/全场累计), 文本=已消灭+场上剩余。
if(ZOMBIE_MODE==='solo'&&typeof ZOMBIES!=='undefined'){
 const zAlive=ZOMBIES.filter(z=>z.alive).length;
 const zKilled=(typeof zStats!=='undefined'&&zStats)?zStats.killed:0;
 const zAll=Math.max(1,zAlive+zKilled);
 // bar(player.team) (2026-10-28 修复, 指导 §4.7): 旧 bar(0) 在玩家选 1 队开局时, 结算页兵力条
 // 照样渲染未参战的 0 队 —— 改读玩家真实阵营。
 document.getElementById('endTickets').innerHTML=bar(player.team)+
  `<div class="tRow"><div class="tName" style="color:#a8d890">☣ ${t('丧尸')}</div>`+
  `<div class="tBarWrap"><div class="tBar" style="background:#7cb464;width:${Math.round(zKilled/zAll*100)}%"></div></div>`+
  `<div class="tInfo">${t('已消灭 {0} · 场上 {1}',zKilled,zAlive)}</div></div>`;
}else{
 document.getElementById('endTickets').innerHTML=bar(0)+bar(1);
}
},900);
}
const el=id=>document.getElementById(id);
// 击杀来源标签 (2026-09-04 用户指定): 优先取开火方最后一次开火时挂载的 _src (载具/固定火力点/投掷物),
// 否则按身份反推: 载具乘员→载具名, 步兵/玩家→当前武器名
function killSrcLabel(attacker){
if(!attacker) return '';
if(attacker._src) return attacker._src;
const k=attacker.kind;
if(k==='tank'||k==='plane'||k==='truck'||attacker.isCrew) return attacker.name||'';
if(attacker.curW&&attacker.curW.def&&attacker.curW.def.name) return attacker.curW.def.name;
if(attacker.def&&attacker.def.name) return attacker.def.name;
return '';
}
function addKillfeed(attacker,victim,isHead){
const kf=el('killfeed');
const div=document.createElement('div');
const an=attacker.isPlayer?`<span class="me">${t('你')}</span>`:`<span class="kf${attacker.team}">${attacker.name}</span>`;
const vn=victim.isPlayer?`<span class="me">${t('你')}</span>`:`<span class="kf${victim.team}">${victim.name}</span>`;
const src=t(killSrcLabel(attacker));
div.innerHTML=`${an} ${isHead?'☠':'✕'} ${vn}${src?` <span class="kfSrc">[${src}]</span>`:''}`;
kf.prepend(div);
while(kf.children.length>6) kf.lastChild.remove();
setTimeout(()=>{ div.style.opacity=0; setTimeout(()=>div.remove(),1000); },5200);
}
function addKillMsg(txt,team){
const m=el('msgC');
m.textContent=t(txt);
m.style.color=team===player.team?'#ffe08a':'#ff8a7a';
m.style.opacity=1;
clearTimeout(m._t);
m._t=setTimeout(()=>m.style.opacity=0,2400);
}
// 己方载具(坦克/战机)战损重生: 顶部战况栏文字播报 (2026-09-01 用户指定; addKillMsg 按阵营自动配色)
function announceVehRespawn(v){
addKillMsg(t('我方 {0} 已重生',t(v.name)),v.team);
}
let scorePopT=null;
function showScorePop(txt){
const s=el('scorePop');
s.textContent=t(txt); s.style.opacity=1;
clearTimeout(scorePopT);
scorePopT=setTimeout(()=>s.style.opacity=0,1400);
}
// —— 玩家击杀播报: 右下角得分列表 (每次击杀/摧毁独立成行) + 中下连杀横幅 + 连杀奖励 ——
const MK_NAMES={2:'双杀',3:'三连杀',4:'四连杀',5:'五连杀',6:'六连杀',7:'七连杀',8:'八连杀',9:'九连杀'};
const KILL_STREAK_WIN=5; // 连杀窗口: 距上次击杀超过该秒数则重新计数 (续杯判定共用这一个窗口, 2026-09-16)
let killStreakN=0, killStreakT=-99, killStreakMax=0, killStreakRefills=0;
// 连杀奖励 (2026-09-11): 档位表在 00-config STREAK_REWARDS —— 命中 3/6/9 杀时发放/升级增益
// (player.streakBuff, 效果接线: 移速 20-player / 换弹 19-input / 减伤 18-game), 得分按当前档位 mul 结算。
// 续杯 (2026-09-16 用户定案): 窗口内每多一次击杀即把当前档时长"续满", 次数不限 (详见 refillStreakBuff)。
function streakTierOf(n){ // 当前连杀数命中的最高档 (未达 3 杀返回 null)
let hit=null;
for(const t of STREAK_REWARDS) if(n>=t.at) hit=t;
return hit;
}
function grantStreakBuff(tier,lv){
player.streakBuff={name:tier.name, lv, mul:tier.mul, speedMul:tier.speedMul, reloadMul:tier.reloadMul, dmgCut:tier.dmgCut, dur:tier.dur, until:nowT+tier.dur};
showScorePop(t('连杀奖励 · {0} (得分×{1}, {2}s)',t(tier.name),tier.mul,tier.dur));
AudioSys.click(660,0.22,0.05);
setTimeout(()=>AudioSys.click(990,0.3,0.06),120);
}
// 续杯 (2026-09-16 用户定案): 连杀窗口内的击杀把当前档增益"续满"—— 3杀档回满 5s / 6杀档 6s / 9杀档 7s,
// 次数不限 (连杀不断就一直续); 踩档那一杀走 grantStreakBuff (升级优先, 不重复续)。
// 停火超窗口=断链 → 不再续, 增益自然到期; 阵亡 resetKillStreak 照旧清零。
// buff.dur = 该档满值 (grant 时记入, 单一来源), refillT 供 22-hud 触发一次 0.45s 角标脉冲 (显示层唯一消费点)。
function refillStreakBuff(){
const b=player.streakBuff; if(!b) return;
b.until=nowT+b.dur;
b.refillT=nowT;
killStreakRefills++;
AudioSys.click(880,0.14,0.04); // 续杯音: 单声短促, 与升档双音 (660/990) 区分开
}
function showKillPop(label,score,mul){
const box=el('killPops');
const d=document.createElement('div');
d.className='kp';
d.innerHTML=`<span class="kpLabel">${t(label)}</span>${mul&&mul>1?`<span class="kpMul">×${mul}</span>`:''}<span class="kpScore">+${score}</span>`;
box.appendChild(d);
while(box.children.length>5) box.firstChild.remove();
setTimeout(()=>{ d.classList.add('out'); setTimeout(()=>d.remove(),500); },2600);
}
// ═════ 地图可破坏物得分 (2026-09-26 破坏得分批) ═════
// 单源: 00-config STRUCT_SCORE (分档/上限/初始血量阈值) + REC_STATS 的 demol 项 (结算卡与历史记录)。
// 本段只做三件事: ①按组算分并落到**击毁者**账上 (玩家与 Bot 同口径, 与击杀记分一致);
//   ②把**同一批**爆炸打出的多组摧毁合并成一条右下角得分角标 —— 一炮拆掉 6 面墙是
//     "摧毁结构 ×6 +120", 而不是 6 条 "+20" (killPops 列表本身只保留 5 行, 逐组弹会把同一次爆炸挤爆);
//   ③给玩家记 demol 计数 (结算战绩卡/历史记录)。
// ★ 刻意**不走 registerKillScore**: 拆墙不算击杀 —— 不喂 3/6/9 连杀档位, 也不吃连杀倍率,
//   否则"开坦克轰村子"就成了刷连杀/刷分的捷径 (这条边界写在 00-config STRUCT_SCORE 那段)。
//   批的边界由 05-world 划: damageStructures 进出各调一次 structBatchBegin/End (一次爆炸 = 一批);
//   不落在任何批里的单发摧毁 (炮位自毁链等直调 destroyStructure 的路径) 就地出角标。
let _structOpen=0, _structAcc=null;
function structBatchBegin(){ _structOpen++; }
function structBatchEnd(){ if(_structOpen>0) _structOpen--; if(_structOpen===0) flushStructPop(); }
function structScoreOf(g){
if(typeof STRUCT_SCORE==='undefined'||!g) return 0;
// 权重 = 初始血量 (05-world 在首次受损时缓存 g.hp0); 未登记的组 (直调路径/炮位胸墙) 按轻档
const hp=(g.hp0>0)?g.hp0:Math.max(0,g.hp||0);
const s=(typeof g.score==='number')?g.score:(hp>=STRUCT_SCORE.bigHp?STRUCT_SCORE.big:STRUCT_SCORE.light);
return clamp(Math.round(s),0,STRUCT_SCORE.cap);
}
function flushStructPop(){
const a=_structAcc; _structAcc=null;
if(!a||a.n<=0||a.pts<=0) return;
// 标签先经 t() 定型, showKillPop 内层那次 t() 对已译串是原样返回 (词典里没有英文键)
const label=a.big?(a.n>1?t('摧毁大型结构 ×{0}',a.n):t('摧毁大型结构'))
                :(a.n>1?t('摧毁结构 ×{0}',a.n):t('摧毁结构'));
showKillPop(label,a.pts);
}
// 05-world.destroyStructure 的唯一回调 (非 silent 才调): 一组可破坏物被摧毁
function awardStructScore(g,attacker){
if(!attacker) return 0;            // 无主爆炸 (雷链/场景物二次爆炸) 不给任何人加分
const pts=structScoreOf(g);
if(pts<=0) return 0;
attacker.score=(attacker.score||0)+pts;
// 角标与 demol 计数只属于玩家: Bot 拆楼记 Bot 的账, 但不在玩家屏幕上弹一条得分行
// (与击杀记分同口径: 15b/15c/16-aircraft 都是 `attacker.isPlayer ? registerKillScore : 直接加分`)
if(attacker.isPlayer){
player.demol=(player.demol||0)+1; // 破坏数 (结算战绩 demol)
const big=pts>=STRUCT_SCORE.big;
if(_structAcc){ _structAcc.n++; _structAcc.pts+=pts; if(big) _structAcc.big=true; }
else _structAcc={n:1,pts,big};
if(_structOpen===0) flushStructPop(); // 不在爆炸批里: 立即出角标 (批内的由 structBatchEnd 统一出)
}
return pts;
}
// 连杀结算唯一入口 (击杀/摧毁载具共用): 刷新计数 → 弹得分角标(按档位倍率) → 连杀横幅 → 命中 3/6/9 发放/升级奖励,
// 窗口内未踩档的击杀则续杯。返回实得分数 (含连杀倍率), 调用方据此外加 player.score —— 记分单源不破坏 (verify-wipe T14)。
function registerKillScore(label,base,countStreak){
if(countStreak===false||matchOver){ showKillPop(label,base); return base; }
const chained=killStreakN>0&&nowT-killStreakT<=KILL_STREAK_WIN; // 续杯判定: 本杀是否接在 5 秒窗口内 (必须在重置前取值)
if(nowT-killStreakT>KILL_STREAK_WIN) killStreakN=0;
killStreakN++; killStreakT=nowT;
if(killStreakN>killStreakMax) killStreakMax=killStreakN; // 结算最大连杀 (2026-09-13)
const tier=streakTierOf(killStreakN);
const got=Math.round(base*(tier?tier.mul:1));
showKillPop(label,got,tier?tier.mul:1);
if(killStreakN>=2){
const b=el('mkBanner');
b.textContent=t(MK_NAMES[killStreakN]||t('{0} 连杀',killStreakN))+'!';
b.classList.toggle('hot',killStreakN>=4);
b.classList.remove('show');
void b.offsetWidth; // 强制重排以重播弹出动画 (同一爆炸连杀时逐杀刷新数字)
b.classList.add('show');
AudioSys.click(600+Math.min(killStreakN,8)*110,0.3,0.05);
}
const tierHit=STREAK_REWARDS.find(t=>t.at===killStreakN); // 恰好踩中 3/6/9 档才发放/升级 (同一条命每档一次)
if(tierHit) grantStreakBuff(tierHit,STREAK_REWARDS.indexOf(tierHit));
else if(chained) refillStreakBuff(); // 续杯: 窗口内未踩档的击杀 (含 9 杀之后的 10/11…杀) 把当前档续满
return got;
}
function resetKillStreak(){ killStreakN=0; player.streakBuff=null; killStreakRefills=0; } // 阵亡: 连杀计数/增益/续杯数一起清
function onPlayerKill(victim,isHead){
const got=registerKillScore(isHead?'爆头击杀':'击杀',isHead?SCORE_TABLE.head:SCORE_TABLE.kill);
player.score+=got;
if(ZOMBIE_MODE&&victim&&victim.zombie) pzGain(victim.kind==='brute'?ZCFG.zp.bruteKill:(victim.kind==='boomer'?ZCFG.zp.boomerKill:ZCFG.zp.kill)); // ZP: 击杀丧尸给点 (2026-10-06 裁定④; boomer 2026-10-07d)
if(isHead) player.headKills=(player.headKills||0)+1; // 爆头数: 结算卡 (2026-09-13)
player.lifeKills=(player.lifeKills||0)+1;
hmShow(_hitCls,true);
// 车毁连带的多杀 (驾驶员 Bot die + 2 个名额 settleCrewSlotDeath) 会三连进这里: 0.25s 内的红档音
// 合并为一响 (标记仍逐杀刷新), 否则击杀音三重叠置成噪音 (2026-09-28 D7 顺带)。
const now=nowT;
if(now-_lastKillSndT>=0.25){ _lastKillSndT=now; AudioSys.hitmarkSnd(true); }
}
let _lastKillSndT=-9;
// 附身击杀反馈 (2026-11-01 真附身批): 宿主 Bot 的击杀只出屏中红档+音 —— **不记分/不进连杀/爆头账**
// (onPlayerKill 是玩家记分唯一入口; 附身是只读借眼, 玩家本人的战绩一分不沾)。
function onHostKill(){
hmShow(_hitCls,true);
if(nowT-_lastKillSndT>=0.25){ _lastKillSndT=nowT; AudioSys.hitmarkSnd(true); }
}
// ═══ 三档命中/击杀标识 (2026-09-30 批, 用户定案"同X加外框") ═══
// _hitCls = 待结算弹种档: 'mg'(枪械/机炮·无框) / 'shell'(炮弹·火箭·高炮·鱼雷·琥珀括号) / 'explo'(手雷·航弹·爆炸·黄锯齿环)。
// 各伤害结算点在 damage/takeDmg **之前**盖章 (markHitCls); 击杀红档经 die()→onPlayerKill 读到它 ⇒ 击杀标识与命中标识同档。
let _hitCls='mg';
function markHitCls(c){ _hitCls=(c==='shell'||c==='explo')?c:'mg'; }
// 标记单源 hmShow: 写档位类 + kill 类 + 显隐计时 (红 320ms / 白 140ms, 槽仍是 hm._t —— D7 的"红白共槽"不变)。
// 40ms 红档守卫: 刚出红档的**同一结算拍**内白档不降级 —— 一发炮弹"直击致死→溅射伤到旁人"、一颗航弹
//   "溅射→叠爆"都是同帧同步连发两档, 旧口径白档会把红档盖回 (D7 病根的溅射版); 窗口取 0.04s (~2帧) 只盖
//   同拍, 跨发不挡: 机枪 900rpm 弹间隔 67ms > 40ms, 击杀后下一发命中别人的白档照常出。
function hmShow(cls,kill){
const hm=el('hitmark');
if(!kill&&nowT-(hm._killT||-9)<0.04) return;
markHitCls(cls);
hm.classList.remove('shell','explo','kill');
if(_hitCls!=='mg') hm.classList.add(_hitCls);
if(kill){ hm.classList.add('kill'); hm._killT=nowT; }
hm.style.opacity=1;
clearTimeout(hm._t);
hm._t=setTimeout(()=>hm.style.opacity=0,kill?320:140);
}
// 载具命中反馈 (2026-09-28 D7): 打坦克/卡车此前只有 20% 抽奖出声、无视觉标记 (13-combat 旧口),
// 收敛为确定性 —— 白档标记与打步兵同一视觉语言, 音效 0.12s 节流 (机枪泼水不连成一片, 也不漏"打了没反馈")。
// 2026-09-30: 接受可选弹种档 cls (缺省读 _hitCls); 击杀档不在这里: die 链 → onPlayerKill/onPlayerWreck (红档)。
let _lastVehHitSndT=-9;
function onPlayerHitVeh(cls){
hmShow(cls,false);
if(nowT-_lastVehHitSndT>=0.12){ _lastVehHitSndT=nowT; AudioSys.hitmarkSnd(false); }
}
function onPlayerHit(sol,isHead,cls){
hmShow(cls,false);
AudioSys.hitmarkSnd(false);
}
// 溅射/炮弹/高炮/鱼雷等"一发可能伤多个"的聚合白档: 音效 0.09s 节流 (一次爆炸只响一声, 标记照常点亮)。
// 调用方负责只对"伤到敌对目标且目标还活着"调用 (致命一击走 die 链红档, 不在这里补白)。
let _lastAnyHitSndT=-9;
function onPlayerHitAny(cls){
hmShow(cls,false);
if(nowT-_lastAnyHitSndT>=0.09){ _lastAnyHitSndT=nowT; AudioSys.hitmarkSnd(false); }
}
// 载具/舰艇/卡车/战机/岸炮被玩家**击毁**的红档 (2026-09-30 批): 旧口径红档只从乘员 Bot.die 间接出现,
// 空车击毁只有右下角得分角标、屏中没有任何击杀反馈。这里只出标记+音 (记分/播报仍由各 die() 自己的单源管,
// 不走 onPlayerKill —— 那会把"击杀 100"与"摧毁坦克 300"双计)。
function onPlayerWreck(){
hmShow(_hitCls,true);
const now=nowT;
if(now-_lastKillSndT>=0.25){ _lastKillSndT=now; AudioSys.hitmarkSnd(true); }
}
function addDirHit(worldAng){
const rel=worldAng-player.yaw+Math.PI;
// 屏缘窄弧 (2026-09-28 D8 三稿 = 用户裁定: 战地式窄弧 + 中距≈150px): 弧带的半径/等宽/45° 角向遮罩
// 全部由 CSS 画 (天生规整), 这里只写 rotate 指向来向 —— 一稿径向外推/二稿楔标均已废。
// 渐隐: 1.0s 后开始 0.45s CSS 过渡淡出, 1.5s 移除; 同侧 (±0.6rad) 多源合并到既有弧上 (刷新角度+计时)。
const d=document.createElement('div');
d.className='dirHit';
const put=ed=>{ d.style.transform=`rotate(${-ed}rad)`; };
put(rel);
d._wAng=worldAng; // 定格世界方位 (2026-09-29 用户裁定): 之后每帧只随玩家朝向重算 (updateDirHits), 不追踪攻击者走位
el('dirHits').appendChild(d);
d._fade=setTimeout(()=>{ d.style.opacity=0; },1000);
d._rm=setTimeout(()=>d.remove(),1500);
// 同侧合并: 找既有同向弧 (差 <0.6rad), 把它的角度刷成最新、计时器全部续期, 然后丢掉本次新建的
const others=[...el('dirHits').children].filter(x=>x!==d);
for(const o of others){
const m=/rotate\((-?[\d.]+)rad\)/.exec(o.style.transform||'');
const oa=m?-parseFloat(m[1]):null;
if(oa!==null&&Math.abs(angDiff(rel,oa))<0.6){
o._wAng=d._wAng;
o.style.transform=d.style.transform;
o.style.opacity=0.9;
clearTimeout(o._fade); clearTimeout(o._rm);
o._fade=setTimeout(()=>{ o.style.opacity=0; },1000);
o._rm=setTimeout(()=>o.remove(),1500);
d.remove();
return;
}
}
}
// 方向弧逐帧重算 (2026-09-29 用户裁定): 生成时已定格攻击者的世界方位 (_wAng), 这里每帧只按玩家
// **当前朝向**重算屏上角度 —— 玩家转头时既有弧跟着滑动, 始终指向真实世界方位 (旧版入帧算一次写死,
// 转多少都不动, 用户实报)。攻击者后来的走位不追踪 (定格口径); 弧常驻 ≤1.5s, 逐帧重写 transform 开销可忽略。
// 调用点在 22-hud.updateHUD 逐帧段 (typeof 守卫同 21-match 惯例)。
function updateDirHits(){
const box=el('dirHits');
const kids=box.children, py=player.yaw;
for(let i=0;i<kids.length;i++){
const d=kids[i];
if(d._wAng===undefined) continue;
const rot=-(d._wAng-py+Math.PI);
if(d._lRot===rot) continue;   // 去重写 (2026-11-01 性能批): 朝向未变时逐帧 transform 写全是白开
d._lRot=rot;
d.style.transform=`rotate(${rot}rad)`;
}
}
// 座驾受击的方向指示 (2026-09-28 D8): 玩家在载具/艇上时本体 player.damage 不经过 (伤的是载具),
// 由 Tank/Plane/NavalCraft 三处 takeDmg 的 playerDriven 分支调本函数, 把来向转报给同一套屏缘弧。
// 双保险判据: 座驾自己报 playerDriven + player 确实还在它上面 (车毁那一拍 onVehicle 已清, 不误报)。
function addVehDmgDir(vessel,attacker){
if(!attacker||!attacker.pos||!vessel||!vessel.playerDriven) return;
if(player.onVehicle!==vessel&&player.onNaval!==vessel) return;
addDirHit(Math.atan2(attacker.pos.x-player.pos.x,attacker.pos.z-player.pos.z));
}
function updateScoreboard(){
const mk=(team,tb)=>{
const rows=[];
const list=combatants.filter(c=>c.team===team);
list.sort((a,b)=>(b.score||0)-(a.score||0));
for(const c of list){
rows.push(`<tr class="${c.isPlayer?'meRow':''}"><td>${c.isPlayer?'★ 你':c.name}</td><td>${c.kills||0}</td><td>${c.deaths||0}</td><td>${c.score||0}</td></tr>`);
}
el(tb).innerHTML=rows.join('');
};
mk(0,'sbL'); mk(1,'sbR');
}
