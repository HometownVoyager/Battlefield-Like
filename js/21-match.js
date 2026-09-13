// ─────────────────────────────────────────────
// 21-match.js —— 旗点占领/胜负/击杀播报
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
// 双方同时归零时以场上残余为准 (先被清空者负, 同帧清空=平局); 清场期间超时照常结算 (票多者胜)。
// 最后一人兜底: 归零方场上仅剩最后 1 人 且 对方已占满全部旗点(无旗模式忽略, 2026-09-05 加门槛) 时
// 启动 30 秒清场倒计时, 到时限仍存活 → 直接判对方胜 (防躲藏拖到超时)。
// 无头模拟实测: 沙箱/纯Bot局里敌机常驻高空, 若把飞行员计入清场会导致只能靠超时兜底
// (2026-09-04 经用户裁定口径, 如需"击落敌机才清场"可翻转)。
const wipeAnnounced=[false,false];
const WIPE_GRACE=30;     // 最后一人清场倒计时秒数
const wipeT=[null,null]; // 各队倒计时剩余秒数, null=未进入 (仅归零方且场上仅剩1人时启动)
function resetMatchState(){ // 对局态复位唯一入口 (2026-09-06 B7b/P2-14: 替代 22-hud startGame 的跨文件直写)
wipeAnnounced[0]=false; wipeAnnounced[1]=false;
wipeT[0]=null; wipeT[1]=null;
killStreakN=0; killStreakT=-99; player.streakBuff=null; // 连杀计数/增益随新对局复位 (2026-09-11)
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
function requestEnd(forceWinner){
if(matchOver||matchEndPending!==null) return;
const winner=forceWinner!==undefined?forceWinner:(tickets[0]===tickets[1]?-1:(tickets[0]>tickets[1]?0:1));
matchEndPending=winner; matchEndT=MATCH_END_DELAY;
addKillMsg(`胜负已定 · ${winner===-1?'平局':(winner===player.team?'胜利在望':'败局在即')} · ${MATCH_END_DELAY} 秒后结算`,winner);
}
function updateFlags(dt){
let owned=[0,0];
for(const f of FLAGS){
// 占领规则: 任意旗点双方均可随时直接占领, 不再有顺序限制 (攻防模式防守方也可反夺)
let c0=0,c1=0;
for(const c of combatants){
if(!c.alive||c.onVehicle||(c.isPlayer&&c.spectator)) continue; // 观战者不计入占旗/阻占
// 高度容差10m: 圈内二楼/塔上/坡下的单位也计入区域
if(Math.hypot(c.pos.x-f.x,c.pos.z-f.z)<f.r&&Math.abs(c.pos.y-f.gy)<10){
if(c.team===0)c0++; else c1++;
}
}
for(const t of tanks){
if(!t.alive) continue;
if(Math.hypot(t.pos.x-f.x,t.pos.z-f.z)<f.r){
if(t.team===0)c0++; else c1++;
}
}
f.present=[c0,c1];
let attacker=-1;
if(c0>0&&c1===0) attacker=0;
else if(c1>0&&c0===0) attacker=1;
if(attacker>=0&&attacker!==f.owner){
const n=attacker===0?c0:c1;
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
addKillMsg(`${TEAM_NAME[attacker]} 占领了 ${f.id} 点`,attacker);
for(const c of combatants){
if(c.alive&&c.team===attacker&&Math.hypot(c.pos.x-f.x,c.pos.z-f.z)<f.r){
c.score=(c.score||0)+SCORE_TABLE.flag;
if(c.isPlayer) showKillPop('占领 '+f.id+' 点',SCORE_TABLE.flag);
}
}
	// 占满全部旗点 → 敌方兵力立即归零进入清场 (2026-09-04 用户指定: 攻防/征服任一方占满都生效 —
	// 修复淞沪会战防守方(国军)占满全旗毫无反应的旧缺陷, 旧版只认进攻方)
	if(GAMEMODE==='assault'||GAMEMODE==='conquest'){
	if(FLAGS.every(ff=>ff.owner===attacker)){
	if(tickets[1-attacker]>0){
	tickets[1-attacker]=0;
	wipeAnnounced[1-attacker]=true;
	addKillMsg(`⚠ ${TEAM_NAME[attacker]} 占领了全部旗点 · ${TEAM_NAME[1-attacker]} 兵力归零 · 消灭其场上残兵方可获胜`,attacker);
	}
	}else if(GAMEMODE==='assault'&&attacker===ATK){
	// 占旗返还: +40实测让攻方票数越打越多(太行山330→998), 2026-09-01 用户指定降为+10
	tickets[ATK]=Math.min(tickets[ATK]+SCORE_TABLE.flagReturn,TICKET_CAP);
	}
	}
}
}
} else if(c0>0&&c1>0&&f.capTeam!==-1){
// 双方同时在圈内: 争夺中, 进度冻结等待分出胜负 (HUD会提示"争夺中")
} else if(f.owner>=0&&f.capTeam!==-1&&f.capTeam!==f.owner&&((f.owner===0&&c0>0)||(f.owner===1&&c1>0))){
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
	// 清场判定: 兵力归零方封重生, 对方须 占满全旗(攻防/征服)+歼灭场上全部残兵 才判胜 (2026-09-05: 坦克不再计入);
	// 双方同时归零时以场上残余为准 (先被清空者负, 同帧清空=平局); 清场期间超时照常结算
	const z0=tickets[0]<=0, z1=tickets[1]<=0;
	if(z0&&!wipeAnnounced[0]){ wipeAnnounced[0]=true; addKillMsg(`⚠ ${TEAM_NAME[0]} 兵力耗尽 · ${TEAM_NAME[1]} ${flagsLostOf(1)>0?'须占领全部旗点(余 '+flagsLostOf(1)+' 点)+':''}消灭其场上残兵方可获胜`,1); }
	if(z1&&!wipeAnnounced[1]){ wipeAnnounced[1]=true; addKillMsg(`⚠ ${TEAM_NAME[1]} 兵力耗尽 · ${TEAM_NAME[0]} ${flagsLostOf(0)>0?'须占领全部旗点(余 '+flagsLostOf(0)+' 点)+':''}消灭其场上残兵方可获胜`,0); }
	if(z0&&z1){
	if(fieldCount(0)===0&&fieldCount(1)===0){ requestEnd(-1); return; }
	}else if(z0){
	if(fieldCount(0)===0&&flagsLostOf(1)===0){ requestEnd(1); return; }
	}else if(z1){
	if(fieldCount(1)===0&&flagsLostOf(0)===0){ requestEnd(0); return; }
	}
	// 最后一人清场倒计时 (2026-09-04 用户指定; 2026-09-05 加触发门槛: 须对方已占满全部旗点[无旗模式忽略]才启动,
	// 旗权未占满时对方须先完成占旗; 倒计时期间旗权被翻回 → 倒计时复位, 重新占满后从 30s 重来)
	for(let zt=0;zt<2;zt++){
	if(tickets[zt]<=0&&fieldCount(zt)===1&&flagsLostOf(1-zt)===0){
	if(wipeT[zt]===null){
	wipeT[zt]=WIPE_GRACE;
	addKillMsg(`⚠ ${TEAM_NAME[zt]} 场上仅剩最后 1 人 · ${WIPE_GRACE} 秒清场倒计时 · 到时限未被歼灭则直接判负`,1-zt);
	}
	wipeT[zt]-=dt;
	if(wipeT[zt]<=0){ addKillMsg(`⏳ 清场倒计时结束 · ${TEAM_NAME[zt]} 最后一人仍存活 · ${TEAM_NAME[1-zt]} 获胜`,1-zt); requestEnd(1-zt); return; }
	}else wipeT[zt]=null;
	}
	// 破袭模式: 检测补给库摧毁
	if(GAMEMODE==='demolition'){
	let left=0;
	for(const d of DEPOTS){
	if(!d.destroyed&&d.g&&d.g.dead){
	d.destroyed=true;
	addKillMsg('补给库 '+d.id+' 被摧毁!',ATK);
	tickets[ATK]=Math.min(tickets[ATK]+SCORE_TABLE.depot,TICKET_CAP);
	}
	if(!d.destroyed) left++;
	}
	if(left===0){ requestEnd(ATK); return; }
	}
	// 旗权压制 2026-09-02 用户指定: 需同时满足 ①一方占领超过一半旗点 ②另一方点位少于2个 才掉人数;
	// 否则开局就近拆分(诺曼底2-3/淞沪1-3)一触即压, 开场就掉人数
	if(GAMEMODE==='conquest'){
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
	if(matchTime<=0){
	if(GAMEMODE==='convoy'&&CONVOY_STATE&&!CONVOY_STATE.over){
	CONVOY_STATE.over=true;
	requestEnd(CONVOY_STATE.destroyed>=CONVOY_STATE.esc?ATK:DEF);
	}else requestEnd();
	}
	}
}
function endMatch(forceWinner){
matchOver=true;
// 对局结束: 环境+引擎声静音, 主循环冻结全部战斗/移动活动
if(AudioSys.setAmbientMute) AudioSys.setAmbientMute(true);
const winner=forceWinner!==undefined?forceWinner:(tickets[0]===tickets[1]?-1:(tickets[0]>tickets[1]?0:1));
document.exitPointerLock&&document.exitPointerLock();
setTimeout(()=>{
document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden'));
const end=document.getElementById('end');
end.classList.remove('hidden');
const title=document.getElementById('endTitle');
if(winner===player.team){ title.textContent='胜  利'; title.className='win'; }
else if(winner===-1){ title.textContent='平  局'; title.className='win'; }
else { title.textContent='战  败'; title.className='lose'; }
document.getElementById('endStats').innerHTML=
`${TEAM_NAME[0]} 剩余兵力 <b>${Math.ceil(tickets[0])}</b>（在场 ${fieldCount(0)} 人） · ${TEAM_NAME[1]} 剩余兵力 <b>${Math.ceil(tickets[1])}</b>（在场 ${fieldCount(1)} 人）<br>`+
`你的战绩：<b>${player.kills}</b> 击杀 / <b>${player.deaths}</b> 阵亡 · 得分 <b>${player.score}</b>`;
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
const an=attacker.isPlayer?'<span class="me">你</span>':`<span class="kf${attacker.team}">${attacker.name}</span>`;
const vn=victim.isPlayer?'<span class="me">你</span>':`<span class="kf${victim.team}">${victim.name}</span>`;
const src=killSrcLabel(attacker);
div.innerHTML=`${an} ${isHead?'☠':'✕'} ${vn}${src?` <span class="kfSrc">[${src}]</span>`:''}`;
kf.prepend(div);
while(kf.children.length>6) kf.lastChild.remove();
setTimeout(()=>{ div.style.opacity=0; setTimeout(()=>div.remove(),1000); },5200);
}
function addKillMsg(txt,team){
const m=el('msgC');
m.textContent=txt;
m.style.color=team===player.team?'#ffe08a':'#ff8a7a';
m.style.opacity=1;
clearTimeout(m._t);
m._t=setTimeout(()=>m.style.opacity=0,2400);
}
// 己方载具(坦克/战机)战损重生: 顶部战况栏文字播报 (2026-09-01 用户指定; addKillMsg 按阵营自动配色)
function announceVehRespawn(v){
addKillMsg(`我方 ${v.name} 已重生`,v.team);
}
let scorePopT=null;
function showScorePop(txt){
const s=el('scorePop');
s.textContent=txt; s.style.opacity=1;
clearTimeout(scorePopT);
scorePopT=setTimeout(()=>s.style.opacity=0,1400);
}
// —— 玩家击杀播报: 右下角得分列表 (每次击杀/摧毁独立成行) + 中下连杀横幅 + 连杀奖励 ——
const MK_NAMES={2:'双杀',3:'三连杀',4:'四连杀',5:'五连杀',6:'六连杀',7:'七连杀',8:'八连杀',9:'九连杀'};
const KILL_STREAK_WIN=5; // 连杀窗口: 距上次击杀超过该秒数则重新计数
let killStreakN=0, killStreakT=-99;
// 连杀奖励 (2026-09-11): 档位表在 00-config STREAK_REWARDS —— 命中 3/6/9 杀时发放/升级增益
// (player.streakBuff, 效果接线: 移速 20-player / 换弹 19-input / 减伤 18-game), 得分按当前档位 mul 结算。
function streakTierOf(n){ // 当前连杀数命中的最高档 (未达 3 杀返回 null)
let hit=null;
for(const t of STREAK_REWARDS) if(n>=t.at) hit=t;
return hit;
}
function grantStreakBuff(tier,lv){
player.streakBuff={name:tier.name, lv, mul:tier.mul, speedMul:tier.speedMul, reloadMul:tier.reloadMul, dmgCut:tier.dmgCut, until:nowT+tier.dur};
showScorePop(`连杀奖励 · ${tier.name} (得分×${tier.mul}, ${tier.dur}s)`);
AudioSys.click(660,0.22,0.05);
setTimeout(()=>AudioSys.click(990,0.3,0.06),120);
}
function showKillPop(label,score,mul){
const box=el('killPops');
const d=document.createElement('div');
d.className='kp';
d.innerHTML=`<span class="kpLabel">${label}</span>${mul&&mul>1?`<span class="kpMul">×${mul}</span>`:''}<span class="kpScore">+${score}</span>`;
box.appendChild(d);
while(box.children.length>5) box.firstChild.remove();
setTimeout(()=>{ d.classList.add('out'); setTimeout(()=>d.remove(),500); },2600);
}
// 连杀结算唯一入口 (击杀/摧毁载具共用): 刷新计数 → 弹得分角标(按档位倍率) → 连杀横幅 → 命中 3/6/9 发放奖励。
// 返回实得分数 (含连杀倍率), 调用方据此外加 player.score —— 记分单源不破坏 (verify-wipe T14)。
function registerKillScore(label,base,countStreak){
if(countStreak===false||matchOver){ showKillPop(label,base); return base; }
if(nowT-killStreakT>KILL_STREAK_WIN) killStreakN=0;
killStreakN++; killStreakT=nowT;
const tier=streakTierOf(killStreakN);
const got=Math.round(base*(tier?tier.mul:1));
showKillPop(label,got,tier?tier.mul:1);
if(killStreakN>=2){
const b=el('mkBanner');
b.textContent=(MK_NAMES[killStreakN]||killStreakN+' 连杀')+'!';
b.classList.toggle('hot',killStreakN>=4);
b.classList.remove('show');
void b.offsetWidth; // 强制重排以重播弹出动画 (同一爆炸连杀时逐杀刷新数字)
b.classList.add('show');
AudioSys.click(600+Math.min(killStreakN,8)*110,0.3,0.05);
}
const tierHit=STREAK_REWARDS.find(t=>t.at===killStreakN); // 恰好踩中 3/6/9 档才发放 (同一条命每档一次)
if(tierHit) grantStreakBuff(tierHit,STREAK_REWARDS.indexOf(tierHit));
return got;
}
function resetKillStreak(){ killStreakN=0; player.streakBuff=null; }
function onPlayerKill(victim,isHead){
const got=registerKillScore(isHead?'爆头击杀':'击杀',isHead?SCORE_TABLE.head:SCORE_TABLE.kill);
player.score+=got;
player.lifeKills=(player.lifeKills||0)+1;
const hm=el('hitmark');
hm.classList.add('kill');
hm.style.opacity=1;
setTimeout(()=>hm.style.opacity=0,320);
AudioSys.hitmarkSnd(true);
}
function onPlayerHit(sol,isHead){
const hm=el('hitmark');
hm.classList.remove('kill');
hm.style.opacity=1;
clearTimeout(hm._t);
hm._t=setTimeout(()=>hm.style.opacity=0,140);
AudioSys.hitmarkSnd(false);
}
function addDirHit(worldAng){
const rel=worldAng-player.yaw+Math.PI;
const d=document.createElement('div');
d.className='dirHit';
d.style.transform=`rotate(${-rel}rad)`;
el('dirHits').appendChild(d);
setTimeout(()=>d.remove(),900);
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
