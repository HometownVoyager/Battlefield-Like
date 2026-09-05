// ─────────────────────────────────────────────
// 23-deploy.js —— 部署界面/开局
// 源: Index.original.html 第 8324-8530 行
// ─────────────────────────────────────────────
'use strict';
function showDeploy(isDead){
document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden'));
el('deploy').classList.remove('hidden');
el('blackOv').style.opacity=0;
CLASSES.forEach((c,i)=>{
const ws=(EXPERIMENT&&i===5)?playerClassWeapons(player.team,i):TEAM_FACTION[player.team].cls[i];
let d2=ws.map(k=>WPN_DEFS[k].name).join(' · ');
if(i===2) d2+=' · AT雷×2 · 燃烧弹[6]×1';
if(i===4) d2+=' · 医疗箱[B] · 绷带×6';
if(i===5) d2+=EXPERIMENT?' · 燃烧弹[6]×2':' · AT雷×'+(TEAM_FACTION[player.team].atn5||3);
el('cw'+i).textContent=d2;
});
el('deathInfo').innerHTML=(()=>{ 
if(!isDead) return '';
const lifeT=Math.max(0,nowT-(player.lifeStartT||nowT));
const mm2=Math.floor(lifeT/60), ss3=Math.floor(lifeT%60);
const lk=player.lifeKills||0, ls=(player.score||0)-(player.lifeScoreStart||0);
return (player.killerName?`你被 <b>${player.killerName}</b>${player.killerSrc?` <span style="font-size:12px;color:#cfd8c2">[${player.killerSrc}]</span>`:''} 击杀了<br>`:'')+
`<span style="font-size:13px;color:#cdd8c8">本次存活 ${mm2}:${ss3<10?'0':''}${ss3} · 击杀 <b>${lk}</b> · 获得 <b>+${ls}</b> 分 &nbsp;|&nbsp; 本局总计 ${player.kills} 杀 / ${player.deaths} 死 / ${player.score} 分</span>`;
})();
el('resumeBtn').style.display=(player.alive&&player.deployed)?'inline-block':'none';
el('deployBtn').style.display=player.alive&&player.deployed?'none':'inline-block';
// 己方兵力归零 → 本局不可再部署 (清场阶段: 你阵亡后只能观看清场结算, 2026-09-04)
el('deployBtn').disabled=tickets[player.team]<=0;
if(tickets[player.team]<=0){
el('deathInfo').innerHTML+='<br><span style="font-size:13px;color:#ff9c8a">⚠ 己方兵力已耗尽 · 本局无法再部署 · 等待清场结算</span>';
}
buildSpawnList();
drawDeployMap();
}
// 随车队出生点: 取最靠后的存活车, 沿行进方向的反方向(车尾后方) 9m 解算
function convoyDeployPt(){
let best=null,bu=-1e9;
for(const t of trucks){
if(!t.alive||t.escaped) continue;
const u=t.pos.x; // 车队自东向西: x 越大越靠后
if(u>bu){ bu=u; best=t; }
}
if(best) return {x:best.pos.x-Math.sin(best.yaw)*9,z:best.pos.z-Math.cos(best.yaw)*9};
const escT=CAMPAIGN.convoy&&CAMPAIGN.convoy.escortTeam!==undefined?CAMPAIGN.convoy.escortTeam:1;
const sp=spawnPtsOf(escT);
if(sp.length) return {x:sp[0].x,z:sp[0].z};
return {x:128,z:0};
}
function buildSpawnList(){
const list=el('spawnList');
list.innerHTML='';
const opts=[];
if(BASES.length) opts.push({name:'主基地',x:BASES[player.team].x,z:BASES[player.team].z,id:-1});
FLAGS.forEach((f,i)=>{ if(f.owner===player.team) opts.push({name:f.id+' 点',x:f.x,z:f.z,id:i}); });
// 无旗点战役 (遭遇/劫道): 阵营前出点作为部署选项
(CAMPAIGN.spawns||[]).forEach((sp,si)=>{ if(sp.team===player.team) opts.push({name:sp.name,x:sp.x,z:sp.z,id:'P'+si}); });
// 劫道模式: 护运方可选随车队出生 (位置在部署瞬间解算: 车队开到哪跟到哪)
if(GAMEMODE==='convoy'&&CAMPAIGN.convoy&&player.team===CAMPAIGN.convoy.escortTeam){
const pt=convoyDeployPt();
opts.push({name:'随车队',x:pt.x,z:pt.z,id:'CV'});
}
// 载具出生选项
const vehs=[...tanks,...planes].filter(v=>v.team===player.team);
vehs.forEach((v,i)=>{
const id='V'+i;
const busy=v.playerDriven;
const ready=v.alive&&!busy;
opts.push({name:(v.kind==='plane'?'✈ ':'▣ ')+v.name+(ready?'':(busy?' (占用)':' (重生 '+Math.ceil(v.respawnT)+'s)')),id,veh:v,disabled:!ready});
});
if(!opts.some(o=>!o.disabled&&(o.id===selectedSpawn))) selectedSpawn=-1;
opts.forEach(o=>{
const b=document.createElement('button');
b.className='spawnBtn'+(o.id===selectedSpawn?' sel':'');
b.textContent='◈ '+o.name;
if(o.disabled){ b.disabled=true; b.style.opacity=0.45; }
else b.onclick=()=>{ selectedSpawn=o.id; document.querySelectorAll('.spawnBtn').forEach(x=>x.classList.remove('sel')); b.classList.add('sel'); };
list.appendChild(b);
});
}
// 部署界面载具冷却实时刷新: 打开期间每 0.5s 重建出生列表(保留滚动位置与选中项),
// 载具重生倒计时实时走秒, 冷却走完的按钮即刻亮起可选 (2026-09-01 用户指定)
function refreshDeployList(){
const list=el('spawnList');
if(!list) return;
const st=list.scrollTop;
buildSpawnList();
list.scrollTop=st;
}
function drawDeployMap(){
const c=el('deployMap').getContext('2d');
const S=300;
c.fillStyle='#141a10'; c.fillRect(0,0,S,S);
// 缩放随地图尺寸: 标准 320 图=±170 (与原 170 一致), 超大地图(雪峰山 800)=±410
const MH=MAP_SIZE/2+10;
const toM=(x,z)=>[S/2+x/MH*S/2, S/2+z/MH*S/2];
c.strokeStyle='rgba(150,130,90,.5)'; c.lineWidth=4;
if(CAMPAIGN.sineRoad){
c.beginPath();
for(let x=-155;x<=155;x+=10){ const [px,py]=toM(x,3*Math.sin(x*0.02)); x===-155?c.moveTo(px,py):c.lineTo(px,py); }
c.stroke();
}
for(const r of CAMPAIGN.roads){
c.beginPath();
const [ax,ay]=toM(r[0],r[1]), [bx2,by2]=toM(r[2],r[3]);
c.moveTo(ax,ay); c.lineTo(bx2,by2);
c.stroke();
}
// 城市街道 (语义分区): 轴对齐矩形直接填充 —— 部署图读出街廊网格
if(CAMPAIGN.city){
c.fillStyle='rgba(175,175,165,.38)';
for(const s of CAMPAIGN.city.streets){
const [ax,ay]=toM(s.x0,s.z0), [bx2,by2]=toM(s.x1,s.z1);
c.fillRect(ax,ay,bx2-ax,by2-ay);
}
}
// 庄稼田块 (软遮蔽区)
if(CROP_FIELDS.length){
c.fillStyle='rgba(160,185,95,.4)';
for(const cf of CROP_FIELDS){
c.beginPath();
const [a0,b0]=toM(cf.x0,cf.z0),[a1,b1]=toM(cf.x1,cf.z0),[a2,b2]=toM(cf.x1,cf.z1),[a3,b3]=toM(cf.x0,cf.z1);
c.moveTo(a0,b0); c.lineTo(a1,b1); c.lineTo(a2,b2); c.lineTo(a3,b3);
c.closePath(); c.fill();
}
}
// 河道与大桥
if(RIVER){
c.strokeStyle='rgba(70,110,150,.85)'; c.lineWidth=9;
c.beginPath();
RIVER.pts.forEach((pt,i)=>{
const [px,py]=toM(pt[0],pt[1]);
i===0?c.moveTo(px,py):c.lineTo(px,py);
});
c.stroke();
}
if(BRIDGE){
const bx=Math.sin(BRIDGE.yaw)*(BRIDGE.len/2), bz=Math.cos(BRIDGE.yaw)*(BRIDGE.len/2);
const [ax,ay]=toM(BRIDGE.x-bx,BRIDGE.z-bz), [bx2,by2]=toM(BRIDGE.x+bx,BRIDGE.z+bz);
c.strokeStyle='#d8c890'; c.lineWidth=7;
c.beginPath(); c.moveTo(ax,ay); c.lineTo(bx2,by2); c.stroke();
}
if(BASES.length) [0,1].forEach(t=>{
const [px,py]=toM(BASES[t].x,BASES[t].z);
c.fillStyle=t===0?'#4a70b0':'#b05a4a';
c.fillRect(px-8,py-8,16,16);
c.fillStyle='#fff'; c.font='10px sans-serif'; c.textAlign='center';
c.fillText(TEAM_NAME[t][0],px,py+3);
});
// 断崖公路: 劫道方临时补给点 (存活期间) 绿色方块
if(SUPPLY_POINTS.length){
for(const sp of SUPPLY_POINTS){
const [px,py]=toM(sp.x,sp.z);
c.fillStyle='#48b06a';
c.fillRect(px-4,py-4,8,8);
}
}
for(const f of FLAGS){
const [px,py]=toM(f.x,f.z);
c.beginPath(); c.arc(px,py,13,0,TAU);
c.fillStyle=f.owner===0?'rgba(90,140,220,.85)':f.owner===1?'rgba(220,110,90,.85)':'rgba(150,150,140,.7)';
c.fill();
c.fillStyle='#fff'; c.font=f.id.length>1?'bold 9px sans-serif':'bold 13px sans-serif'; c.textAlign='center';
c.fillText(f.id,px,py+(f.id.length>1?3:4));
}
// 无旗点战役: 阵营前出点菱形
for(const sp of (CAMPAIGN.spawns||[])){
const [px,py]=toM(sp.x,sp.z);
c.save(); c.translate(px,py); c.rotate(HPI/4);
c.fillStyle=sp.team===0?'#4a70b0':'#b05a4a';
c.fillRect(-6,-6,12,12);
c.restore();
}
for(const s of soldiers){
if(!s.alive||s.onVehicle) continue;
const [px,py]=toM(s.pos.x,s.pos.z);
c.fillStyle=s.team===0?'#7da8e8':'#e8907d';
c.beginPath(); c.arc(px,py,2,0,TAU); c.fill();
}
}
function deployPlayer(){
const p=player;
if(tickets[p.team]<=0){ addKillMsg('兵力已耗尽 · 本方无法再部署',p.team); return; } // 清场阶段禁止部署 (2026-09-04)
// 载具出生
let vehSpawn=null;
if(typeof selectedSpawn==='string'&&selectedSpawn[0]==='V'){
const vehs=[...tanks,...planes].filter(v=>v.team===p.team);
const v=vehs[+selectedSpawn.slice(1)];
if(v&&v.alive&&!v.playerDriven) vehSpawn=v;
}
	let sx,sz;
	const sBase=basePos(p.team);
	if(vehSpawn){ sx=vehSpawn.pos.x; sz=vehSpawn.pos.z; }
	else if(typeof selectedSpawn==='string'&&selectedSpawn[0]==='P'){
	const sp=(CAMPAIGN.spawns||[])[+selectedSpawn.slice(1)];
	if(sp&&sp.team===p.team){ sx=sp.x; sz=sp.z; }
	else { sx=sBase.x; sz=sBase.z; }
	}
	else if(selectedSpawn==='CV'){ const pt=convoyDeployPt(); sx=pt.x; sz=pt.z; }
	else if(selectedSpawn===-1||typeof selectedSpawn==='string'){ sx=sBase.x; sz=sBase.z; }
	else {
	const f=FLAGS[selectedSpawn];
	if(f.owner!==p.team){ sx=sBase.x; sz=sBase.z; }
	else { sx=f.x; sz=f.z; }
	}
const fp2=findFreeSpawn(sx,sz);
p.pos.set(fp2[0],0,fp2[1]);
p.pos.y=standHeight(p.pos.x,p.pos.z,10);
p.vel.set(0,0,0);
p.hp=100; p.alive=true; p.deployed=true; p.crouch=false; p.prone=false; p.chute=false;
p.stamina=1; p.suppressV=0; p.bloom=0;
p.yaw=Math.atan2(-sx,-sz); p.pitch=0;
const wkeys=playerClassWeapons(p.team,p.cls);
const gear=clsGear(p.cls,p.team);
p.slots=wkeys.map(k=>({key:k,def:WPN_DEFS[k],mag:WPN_DEFS[k].mag,reserve:WPN_DEFS[k].reserve}));
p.curSlot=0; p.curW=p.slots[0];
p.nadeCount=gear.nades;
p.atNades=gear.atn;
p.maxBandages=p.cls===4?12:4;
p.bandages=p.maxBandages;
p.smokeCount=gear.smoke;
p.incinCount=gear.incin;
p.bandaging=0;
p.useCast=null;
p.grabAction=null;
p.deathRag=null; p.deathCamT=0;
p.lifeStartT=nowT; p.lifeKills=0; p.lifeScoreStart=p.score||0;
p.onMortar=null; p.mortarPlaced=false; p.buildCount=6; p.buildSel=0; p.pendingBuild=null;
	p.nadeIsAT=false; p.nadeHeld=false; p.nadeIsSmoke=false; p.nadeIsIncin=false;
	if(p.loiter){ loiterDetonate(p.loiter,p.loiter.pos.clone()); }
p.onVehicle=null; p.onMG=null; p.onAT=null; p.onAA=null; p.tankView=false; p.braced=false;
document.getElementById('heatWrap').style.display='none';
vmEquip(p.curW.key,p.team);
VM.root.visible=true;
if(p.cls===4) showScorePop('医护兵 · 按 B 放置医疗箱 / H 包扎');
else if(p.cls===6) showScorePop('迫击炮兵 · 按 B 架设迫击炮, F 上炮开火');
else if(p.cls===7) showScorePop('工程兵 · 按 5 选择工事, 按 B 锤击建造');
else if(isLoiterClass()) showScorePop('巡飞弹兵 · 左键发射后进入TV制导 · 按 6 扔燃烧弹');
if(vehSpawn){
if(vehSpawn.crewBot){
const cb=vehSpawn.crewBot;
if(vehSpawn.kind==='plane'){
vehSpawn.crewBot=null;
cb.onVehicle=null;
cb.chuting=true;
cb.pos.set(vehSpawn.pos.x,Math.max(vehSpawn.pos.y-2,heightAt(vehSpawn.pos.x,vehSpawn.pos.z)+3),vehSpawn.pos.z);
cb.mesh.root.visible=true;
cb.path=null; cb.state='idle'; cb.target=null;
} else cb.dismountVehicle(false);
}
vehSpawn.playerDriven=true;
if(vehSpawn.kind==='tank'){ vehSpawn.isAI=false; vehSpawn.vel=0; p.yaw=vehSpawn.yaw+vehSpawn.turretYaw+Math.PI; }
else { p.yaw=vehSpawn.yaw+Math.PI; p.pitch=vehSpawn.pitch; }
p.onVehicle=vehSpawn;
p.pos.copy(vehSpawn.pos);
VM.root.visible=false;
document.getElementById('heatWrap').style.display='block';
}
document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden'));
el('blackOv').style.opacity=0;
if(p.spectator){ p.flying=false; p.flyAero=false; p._aeroSpd=0; }
lockPointer();
if(p.spectator) showScorePop('观战中 · 双击空格=悬停飞行 · H=气动飞行 · TV弹左键引爆 · 触地消失');
}
function startMatch(){
const names0=[...TEAM_FACTION[0].names].sort(()=>Math.random()-0.5);
const names1=[...TEAM_FACTION[1].names].sort(()=>Math.random()-0.5);
const nameIdx=[0,0];
const nextName=t=>(t===0?names0:names1)[nameIdx[t]++%(t===0?names0:names1).length];
	for(let t=0;t<2;t++){
	const bMul=CAMPAIGN.botMul||[1,1];
	const bN=[Math.max(2,Math.round(BOTS_PER_TEAM*bMul[0])),Math.max(2,Math.round(BOTS_PER_TEAM*bMul[1]))];
	const n=bN[t]-(t===player.team?1:0);
	// 劫道方(ATK)反坦克火力翻倍: 兵种池偏向5号反坦克兵
	const AT_POOL=[0,1,1,2,2,3,4,4,5,5,5,5,6,7];
	const pool=(GAMEMODE==='convoy'&&t===ATK)?AT_POOL:CLS_POOL;
	for(let i=0;i<n;i++){
	const cls=pool[randi(0,pool.length-1)];
	const bot=new Bot(t,cls,nextName(t));
	bot.spawn();
	}
	}
	// 旗帜初始归属 (征服: 靠近各自基地的旗点归属该方; 攻防/破袭: 防守方全部据守)
	el('flagIcons').innerHTML=FLAGS.map(f=>`<span id="fi${f.id}">${f.id}</span>`).join('');
	if(GAMEMODE==='conquest'){
	if(FLAGS.length){
	const sorted=[...FLAGS].sort((a,b)=>Math.hypot(a.x-BASES[0].x,a.z-BASES[0].z)-Math.hypot(b.x-BASES[0].x,b.z-BASES[0].z));
	sorted[0].owner=0;
	sorted[sorted.length-1].owner=1;
	if(sorted.length>=5){ sorted[1].owner=0; sorted[sorted.length-2].owner=1; }
	FLAGS.forEach(f=>drawFlagTex(f));
	}
	} else if(GAMEMODE==='assault'||GAMEMODE==='demolition'){
	// 攻防: 开局就近拆分 (2026-09-01 用户指定) —— 进攻方持有距其基地最近的旗点(≥5旗给2个, 其余1个), 剩余归防守方;
	// 攻方旗数过半后守方按差值持续掉票 (见 21-match 压制), 全占仍即胜
	// 破袭: 仍防守方(DEF)据守全部旗点 (胜负看补给库, 旗点仅作部署/争夺锚点)
	FLAGS.forEach(f=>{ f.owner=DEF; f.cap=0; f.capTeam=-1; drawFlagTex(f); });
	if(GAMEMODE==='assault'&&FLAGS.length){
	const atkB=BASES[ATK]||basePos(ATK);
	const sorted=[...FLAGS].sort((a,b)=>Math.hypot(a.x-atkB.x,a.z-atkB.z)-Math.hypot(b.x-atkB.x,b.z-atkB.z));
	const nATK=FLAGS.length>=5?2:1;
	for(let i=0;i<nATK&&i<sorted.length-1;i++){ sorted[i].owner=ATK; drawFlagTex(sorted[i]); }
	}
	// 防守方兵力=进攻方×1.25 (2026-09-05 用户指定下调: 防守优势改由"防御工事模板"承担阵地强度,
	// 人数只保留小幅倾斜; 原为 ×1.75, 阵地+人海双优势过重)
	tickets[DEF]=Math.round(tickets[ATK]*1.25);
	// 太行山围攻 (9 旗多线上山) 延长至 22 分钟
	matchTime=GAMEMODE==='assault'?(CAMPAIGN.id==='taihang'?22*60:18*60):16*60;
	} else if(GAMEMODE==='clash'){
	// 遭遇战: 无旗点, 兵力打空者败, 15分钟限时
	matchTime=15*60;
	} else if(GAMEMODE==='convoy'){
	// 劫道: 双方兵力均为标准相等有限票 (胜负仍看车队), 16分钟限时
	matchTime=16*60;
	SUPPLY_START=nowT; // 劫道方临时补给点寿命计时从开局起算
	}
// 组建玩家小队: 挑3名本方步兵
for(const s of soldiers){
if(SQUAD.members.length>=3) break;
if(s.team===player.team&&!s.onVehicle&&!s.pilotOf){
s.inSquad=true;
SQUAD.members.push(s);
s.mesh.tag.material.color.set(0x86ffa6);
}
}
	// 坦克数量: 按战役配置 (默认每队2辆; 遭遇战翻倍; 劫道护运方有坦克/劫道方无)
	const tN=CAMPAIGN.tankN||[2,2];
	for(let t=0;t<2;t++) for(let v=0;v<tN[t];v++) new Tank(t,v%2);
	new Plane(0,0); new Plane(0,1); new Plane(1,0); new Plane(1,1);
	// 劫道模式: 沿公路生成护运车队 (纯AI, 不可驾驶)
	if(GAMEMODE==='convoy'&&CAMPAIGN.convoy) spawnConvoy(CAMPAIGN.convoy);
// 每辆载具塞入一名真正的AI乘员(算一个人, 可下车/跳伞)
for(const t of tanks){
const b=new Bot(t.team,CLS_POOL[randi(0,CLS_POOL.length-1)],nextName(t.team));
b.spawnInVehicle(t);
}
for(const pl of planes){
const b=new Bot(pl.team,CLS_POOL[randi(0,CLS_POOL.length-1)],nextName(pl.team));
b.pilotOf=pl;
pl.pilotBot=b;
b.spawnInVehicle(pl);
}
}
