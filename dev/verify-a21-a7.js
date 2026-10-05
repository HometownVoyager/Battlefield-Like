// ─────────────────────────────────────────────
// dev/verify-a21-a7.js —— A#7 坦克三人车组 独立验收 (verifier / 2026-09-21 批次 20260921A)
//
// 用法: node dev/verify-a21-a7.js            (exit 0 = 全部判据通过)
// 场景: steppe (7 坦克/队 = 14 辆) 真实开局 (startBtn.onclick), 全部走生产代码路径。
//
// 判据 (契约 §4 v3 + task-6):
//   ① 编制不膨胀: soldiers.length == 两队 BOTS_PER_TEAM 编制之和 + 每载具 1 名车组;
//      2 个"乘员名额"不进 soldiers/combatants (轻量记录) ⇒ 记分板不新增行;
//   ② 有车组的车 crewRoster().length === 3; 14 辆合计 42; crewSlotsAlive 合计 28 = 14×2;
//   ③ AI 车被击毁: 击杀者 kills +3 / tickets −3 / 3 死 (crewBot 1 + 2 名额);
//   ④ 玩家车内被击毁: 玩家死 + 2 名额 = 3 死 / tickets −3 / 击杀者 kills +3 (不是 +6);
//   ⑤ 空车被击毁: tickets 按 TICKET_COST 扣 / 0 杀 0 死 (名额不结算);
//   ⑥ 一次车毁 killfeed 行数 ≤2 (坦克 1 行 + 玩家在内时玩家死亡 1 行);
//   ⑦ 单算法入口: 全仓 tankPerceive/driveAI/turretAI 的调用点清点 (车组路径唯一);
//   ⑧ 玩家上车边界 (实现者没测): tryInteract() 真上坦克 ⇒ 原 crewBot 下车归建 (onVehicle 清空)
//      + crewRoster().length === 3 + 名额不因玩家上车而丢失。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path');
const {root,boot,run,makeChk,campIdxOf}=require('./verify-a21-lib.js');
const CAMP=campIdxOf('steppe');
const {chk,info,done}=makeChk('A#7 三人车组');

console.log('== A#7 坦克三人车组 独立验收 (2026-09-21 批次 20260921A) ==');
const ctx=boot(CAMP,{seed:42,start:true,diff:1});
info('开局结果: '+ctx.__start);
chk(ctx.__start==='ok','startMatch 正常开局');

// ═════ ① 编制不膨胀 ═════
console.log('\n① 编制不膨胀 (车组只多 1 名真人/车; 2 名额是轻量记录)');
const pop=run(ctx,`(()=>{
const crewBots=tanks.map(t=>t.crewBot).filter(Boolean);
return {soldiers:soldiers.length,combatants:combatants.length,tanks:tanks.length,planes:planes.length,
 naval:(typeof navalCraft!=='undefined'&&navalCraft)?navalCraft.length:0,
 bpt:BOTS_PER_TEAM, botMul:CAMPAIGN.botMul||[1,1],
 perTeam:soldiers.reduce((a,s)=>(a[s.team]=(a[s.team]||0)+1,a),{}),
 crewBotN:crewBots.length, withBot:tanks.filter(t=>t.crewBot).length, withPlayer:tanks.filter(t=>t.playerDriven).length,
 slotsInSoldiers:tanks.reduce((a,t)=>a+t.crewSlots.filter(s=>soldiers.indexOf(s)>=0).length,0),
 slotsInCombatants:tanks.reduce((a,t)=>a+t.crewSlots.filter(s=>combatants.indexOf(s)>=0).length,0),
 playerInCombatants:combatants.indexOf(player)>=0,
 crewMatesField:tanks.filter(t=>t.crewMates!==undefined).length,
 slotN:tanks.reduce((a,t)=>a+t.crewSlots.length,0),
 roster:tanks.reduce((a,t)=>a+t.crewRoster().length,0), slotsAlive:tanks.reduce((a,t)=>a+t.crewSlotsAlive(),0),
 crewN:CREW_N};
})()`);
info(JSON.stringify(pop));
const bN=[0,1].map(t=>Math.max(2,Math.round(pop.bpt*pop.botMul[t]))-((t===0)?1:0));
const infraBots=bN[0]+bN[1], crewNeed=pop.tanks+pop.planes+pop.naval;
info(`期望: 步兵 Bot ${bN[0]}+${bN[1]}=${infraBots} + 每载具 1 名车组 (${pop.tanks} 坦克 + ${pop.planes} 机 + ${pop.naval} 艇 = ${crewNeed}) = ${infraBots+crewNeed} 名士兵`);
chk(pop.soldiers===infraBots+crewNeed,`soldiers.length = ${pop.soldiers} == 编制 ${infraBots} + 载具车组 ${crewNeed} (不多不少)`);
chk(pop.combatants===pop.soldiers+(pop.playerInCombatants?1:0),`combatants.length = ${pop.combatants} == soldiers ${pop.soldiers} + 玩家本人 ${pop.playerInCombatants?1:0} (名额未注册)`);
chk(pop.withBot===pop.tanks&&pop.crewBotN===pop.tanks,`每辆坦克恰好 1 名 AI 车组 (${pop.crewBotN}/${pop.tanks})`);
chk(pop.slotN===pop.tanks*2&&pop.slotsInSoldiers===0&&pop.slotsInCombatants===0,`名额定长 2/车 且不进 soldiers/combatants (${pop.slotN} 个名额, 越界 ${pop.slotsInSoldiers}/${pop.slotsInCombatants})`);
chk(pop.crewMatesField===0,'v2 的 crewMates 真 Bot 编制已回退 (字段不再存在)');
// 反事实: 若按 v2 每车真配 3 人, 会多出多少
info(`反事实: 若每车真配 3 名 Bot ⇒ soldiers 会变成 ${pop.soldiers+pop.tanks*2} (+${pop.tanks*2}, +${((pop.tanks*2)/pop.soldiers*100).toFixed(0)}%) —— v3 名额记录避免了这次膨胀`);

// ═════ ② roster ═════
console.log('\n② crewRoster().length === 3 (有车组时)');
chk(pop.roster===pop.tanks*3,`14 辆合计 roster ${pop.roster} == 14×3=${pop.tanks*3}`);
chk(pop.slotsAlive===pop.tanks*2,`名额在编合计 ${pop.slotsAlive} == 14×2=${pop.tanks*2}`);
const emptyRoster=run(ctx,`(()=>{const t=tanks.find(t=>t.crewBot); const cb=t.crewBot; t.crewBot=null; const r=t.crewRoster().length; t.crewBot=cb; return r;})()`);
chk(emptyRoster===0,`空车 crewRoster() 返回 [] (实测 length=${emptyRoster})`);

// ═════ ③ AI 车车毁 ═════
console.log('\n③ AI 车被击毁: 击杀者 +3 杀 / 该队 −3 票 / 3 死');
const r3=run(ctx,`(()=>{
const t=tanks.find(x=>x.team===1&&x.crewBot&&x.alive);
const atk=soldiers.find(s=>s.team===0&&s.alive&&!s.onVehicle&&s!==player);
const cb=t.crewBot;
const b={kills:atk.kills||0,score:atk.score||0,tickets:tickets[1],cbDeaths:cb.deaths,cbAlive:cb.alive,
 slotDeaths:t.crewSlots.map(s=>s.deaths),slotAlive:t.crewSlots.map(s=>s.alive),tankAlive:t.alive};
let kf=0; const orig=addKillfeed; addKillfeed=function(){kf++; return orig.apply(this,arguments);};
t.takeDmg(99999,atk,true);
addKillfeed=orig;
return {dKills:(atk.kills||0)-b.kills,dTickets:b.tickets-tickets[1],dCbDeaths:cb.deaths-b.cbDeaths,cbAlive:cb.alive,
 dSlotDeaths:t.crewSlots.map((s,i)=>s.deaths-b.slotDeaths[i]),slotAlive:t.crewSlots.map(s=>s.alive),
 deathsTotal:(cb.deaths-b.cbDeaths)+t.crewSlots.reduce((a,s,i)=>a+(s.deaths-b.slotDeaths[i]),0),
 tankAlive:t.alive,kf,slotAliveBefore:b.slotAlive,cbOnVeh:cb.onVehicle};
})()`);
info(JSON.stringify(r3));
chk(r3.dKills===3,`击杀者 kills +${r3.dKills} == 3 (不是 6)`);
chk(r3.dTickets===3,`该队 tickets −${r3.dTickets} == 3 (不是 6)`);
chk(r3.dCbDeaths===1&&r3.cbAlive===false&&r3.cbOnVeh===null,`crewBot 死 1 次 + 已离车 (deaths +${r3.dCbDeaths})`);
chk(r3.dSlotDeaths[0]===1&&r3.dSlotDeaths[1]===1&&r3.slotAlive[0]===false&&r3.slotAlive[1]===false,`2 名额各 1 死且 alive=false`);
chk(r3.deathsTotal===3,`合计 3 死 (实测 ${r3.deathsTotal})`);
chk(r3.kf===1,`killfeed 行数 = ${r3.kf} ≤ 2 (AI 车应为 1)`);
chk(r3.tankAlive===false,'坦克 alive=false');

// ═════ ④ 玩家车内车毁 ═════
console.log('\n④ 玩家车内被击毁: 玩家死 + 2 名额 = 3 死 / −3 票 / 击杀者 +3 杀');
const r4=run(ctx,`(()=>{
// 玩家上车走真实交互入口 tryInteract (与 F 键同一条路径)
const t=tanks.find(x=>x.team===player.team&&x.alive&&x.crewBot);
player.pos.set(t.pos.x,t.pos.y,t.pos.z); player.alive=true; player.deployed=true; player.spectator=false;
player.hp=100; player.onVehicle=null; player.onBattery=null;
t.playerDriven=false;
const cbBefore=!!t.crewBot;
tryInteract();
const boarded=(player.onVehicle===t&&t.playerDriven===true);
const roster=t.crewRoster().length, slotsAlive=t.crewSlotsAlive();
const cbAfterCb=t.crewBot, cbLeft=cbAfterCb?cbAfterCb.onVehicle===null:true;   // 原 crewBot 应下车归建
const atk=soldiers.find(s=>s.team!==player.team&&s.alive&&!s.onVehicle);
const b={kills:atk.kills||0,tickets:tickets[player.team],deaths:player.deaths,slotDeaths:t.crewSlots.map(s=>s.deaths)};
let kf=0; const orig=addKillfeed; addKillfeed=function(){kf++; return orig.apply(this,arguments);};
t.takeDmg(99999,atk,true);
addKillfeed=orig;
return {boarded,cbBefore,roster,slotsAlive,cbLeft,dKills:(atk.kills||0)-b.kills,dTickets:b.tickets-tickets[player.team],
 dPlayerDeaths:player.deaths-b.deaths,playerAlive:player.alive,dSlotDeaths:t.crewSlots.map((s,i)=>s.deaths-b.slotDeaths[i]),
 deathsTotal:(player.deaths-b.deaths)+t.crewSlots.reduce((a,s,i)=>a+(s.deaths-b.slotDeaths[i]),0),kf,
 onVeh:player.onVehicle===null,driven:t.playerDriven};
})()`);
info(JSON.stringify(r4));
chk(r4.boarded===true&&r4.roster===3&&r4.slotsAlive===2,`玩家上车 (tryInteract 真路径) ⇒ 车内 3 人 (roster=${r4.roster}, 名额 ${r4.slotsAlive})`);
chk(r4.cbLeft===true,'原 crewBot 下车归建 (onVehicle 清空, 不在车内占第 4 个位置)');
chk(r4.dPlayerDeaths===1&&r4.playerAlive===false,'玩家走自己的死亡链: 1 死');
chk(r4.dSlotDeaths[0]===1&&r4.dSlotDeaths[1]===1,`2 名额各 1 死 (${r4.dSlotDeaths.join('/')})`);
chk(r4.deathsTotal===3&&r4.dTickets===3,`合计 3 死 ${r4.deathsTotal} / −${r4.dTickets} 票`);
chk(r4.dKills===3,`击杀者 kills +${r4.dKills} == 3`);
chk(r4.kf<=2,`killfeed 行数 = ${r4.kf} ≤ 2 (坦克 1 行 + 玩家死亡 1 行)`);
chk(r4.onVeh===true&&r4.driven===false,'车毁后玩家解绑 + 车交还 (playerDriven=false)');

// ═════ ⑤ 空车 ═════
console.log('\n⑤ 空车被击毁: 装备票 (TICKET_COST) / 0 杀 0 死');
const r5=run(ctx,`(()=>{
const t=tanks.find(x=>x.alive);
t.crewBot=null; t.playerDriven=false; t.crewSlots.forEach(s=>{s.alive=true;});
const atk=soldiers.find(s=>s.team!==t.team&&s.alive&&!s.onVehicle);
const b={kills:atk.kills||0,tickets:tickets[t.team],slotDeaths:t.crewSlots.map(s=>s.deaths)};
let kf=0; const orig=addKillfeed; addKillfeed=function(){kf++; return orig.apply(this,arguments);};
t.takeDmg(99999,atk,true);
addKillfeed=orig;
return {heavy:!!t.def.heavy,expect:t.def.heavy?TICKET_COST.tankHeavy:TICKET_COST.tankLight,
 dTickets:b.tickets-tickets[t.team],dKills:(atk.kills||0)-b.kills,dSlotDeaths:t.crewSlots.map((s,i)=>s.deaths-b.slotDeaths[i]),
 slotsAlive:t.crewSlots.map(s=>s.alive),kf};
})()`);
info(JSON.stringify(r5));
chk(r5.dTickets===r5.expect,`空车 −${r5.dTickets} 票 == TICKET_COST ${r5.expect} (${r5.heavy?'heavy':'light'})`);
chk(r5.dKills===0,`空车 0 杀 (击杀者 +${r5.dKills})`);
chk(r5.dSlotDeaths[0]===0&&r5.dSlotDeaths[1]===0&&r5.slotsAlive[0]===true,`空车 0 死 (名额未结算, 仍 alive)  —— 0 杀 0 死口径`);

// ═════ ⑦ 单算法入口 (静态清点) ═════
console.log('\n⑦ 单算法入口: 全仓 tankPerceive/driveAI/turretAI 调用点');
const files=fs.readdirSync(path.join(root,'js')).filter(f=>f.endsWith('.js'));
const callSites=[];
for(const f of files){
	const src=fs.readFileSync(path.join(root,'js',f),'utf8');
	src.split('\n').forEach((line,i)=>{
		const code=line.replace(/^\s*\/\/[^\n]*/,'').replace(/\/\/[^\n]*/,'');   // [^\n] 而非 .*$: CRLF 下 . 跨不过 \r, 旧写法整体失配 (注释没被去掉)
		if(/\.(tankPerceive|driveAI|turretAI)\s*\(/.test(code)) callSites.push(`${f}:${i+1}: ${line.trim().slice(0,110)}`);
	});
}
info('调用点:'); for(const c of callSites) info('  · '+c);
const crewPath=callSites.filter(c=>/^15-vehicles\.js:/.test(c));
// ★ 2026-09-25 修 (判据自身脆弱性): 原来是 /15-vehicles\.js:535/ —— 写死行号, 15-vehicles 一加注释就假失败
//   (本批加了三行注释 ⇒ 命中 0 处)。判据本意是"车组 AI 在 15-vehicles 里只有唯一入口", 与行号无关 ⇒ 按文件过滤。
chk(crewPath.length===1,`车组 AI 唯一入口: Tank.update 的 \`this.tankPerceive(dt); this.driveAI(dt); this.turretAI(dt);\` (15-vehicles.js, 行号不锁死) 命中 ${crewPath.length} 处`);
chk(callSites.length<=2,`全仓调用点 ≤2 (除车组入口外只允许 14-bots 的岸轰火控复用; 实测 ${callSites.length})`);

// ═════ ⑧ 名额在重生后复位 ═════
console.log('\n⑧ 补充边界: respawn() 把 2 名额复位 alive=true 且 deaths 累计');
const r8=run(ctx,`(()=>{
const t=tanks.find(x=>x.crewSlots.some(s=>!s.alive));
if(!t) return {skip:true};
const d0=t.crewSlots.map(s=>s.deaths);
t.respawn();
return {deathsBefore:d0,deathsAfter:t.crewSlots.map(s=>s.deaths),alive:t.crewSlots.map(s=>s.alive),
 roster:t.crewRoster().length,slotsAlive:t.crewSlotsAlive()};
})()`);
info(JSON.stringify(r8));
if(r8.skip) chk(false,'找不到已结算名额的车 (前置失败)');
else{
	chk(r8.alive[0]===true&&r8.alive[1]===true,'重生后 2 名额 alive=true');
	chk(r8.deathsAfter[0]===r8.deathsBefore[0]&&r8.deathsAfter[1]===r8.deathsBefore[1],'deaths 累计保留 (同一个人再上车)');
}

const code=done('(复现: node dev/verify-a21-a7.js)');
process.exit(code);
