// ─────────────────────────────────────────────
// 22-hud.js —— HUD/小地图/罗盘/主菜单
// 源: Index.original.html 第 7986-8323 行
// ─────────────────────────────────────────────
'use strict';
const mmC=el('minimap').getContext('2d');
function drawMinimap(){
const S=190, half=S/2, range=90*Math.max(1,Math.sqrt((CAMPAIGN.mapSize||320)/320));
mmC.clearRect(0,0,S,S);
mmC.save();
mmC.beginPath(); mmC.arc(half,half,half-2,0,TAU); mmC.clip();
mmC.fillStyle='rgba(24,32,18,.9)'; mmC.fillRect(0,0,S,S);
const cx=player.alive?player.pos.x:0, cz=player.alive?player.pos.z:0;
const rot=player.alive?player.yaw:0;
const toMap=(x,z)=>{
let dx=x-cx, dz=z-cz;
const c=Math.cos(rot), s=Math.sin(rot);
const rx=dx*c-dz*s, rz=dx*s+dz*c;
return [half+rx/range*half, half+rz/range*half];
};
mmC.strokeStyle='rgba(150,130,90,.4)'; mmC.lineWidth=5;
if(CAMPAIGN.sineRoad){
mmC.beginPath();
for(let x=-155;x<=155;x+=10){
const [px,py]=toMap(x,3*Math.sin(x*0.02));
x===-155?mmC.moveTo(px,py):mmC.lineTo(px,py);
}
mmC.stroke();
}
for(const r of CAMPAIGN.roads){
mmC.beginPath();
const [ax,ay]=toMap(r[0],r[1]), [bx2,by2]=toMap(r[2],r[3]);
mmC.moveTo(ax,ay); mmC.lineTo(bx2,by2);
mmC.stroke();
}
// 城市街道 (语义分区): 旋转坐标系下映射 4 角画多边形 —— 小地图读出街廊网格
if(CAMPAIGN.city){
mmC.fillStyle='rgba(175,175,165,.4)';
for(const s of CAMPAIGN.city.streets){
mmC.beginPath();
const cs2=[[s.x0,s.z0],[s.x1,s.z0],[s.x1,s.z1],[s.x0,s.z1]];
for(let i=0;i<4;i++){ const [px,py]=toMap(cs2[i][0],cs2[i][1]); i===0?mmC.moveTo(px,py):mmC.lineTo(px,py); }
mmC.closePath(); mmC.fill();
}
}
// 庄稼田块 (软遮蔽区): 旋转坐标系下须映射4角画多边形
if(CROP_FIELDS.length){
mmC.fillStyle='rgba(160,185,95,.35)';
for(const cf of CROP_FIELDS){
mmC.beginPath();
const [a0,b0]=toMap(cf.x0,cf.z0),[a1,b1]=toMap(cf.x1,cf.z0),[a2,b2]=toMap(cf.x1,cf.z1),[a3,b3]=toMap(cf.x0,cf.z1);
mmC.moveTo(a0,b0); mmC.lineTo(a1,b1); mmC.lineTo(a2,b2); mmC.lineTo(a3,b3);
mmC.closePath(); mmC.fill();
}
}
// 河道与大桥: 标出激流屏障和唯一通道
if(RIVER){
mmC.strokeStyle='rgba(70,110,150,.8)'; mmC.lineWidth=7;
mmC.beginPath();
RIVER.pts.forEach((pt,i)=>{
const [px,py]=toMap(pt[0],pt[1]);
i===0?mmC.moveTo(px,py):mmC.lineTo(px,py);
});
mmC.stroke();
}
if(BRIDGE){
const bx=Math.sin(BRIDGE.yaw)*(BRIDGE.len/2), bz=Math.cos(BRIDGE.yaw)*(BRIDGE.len/2);
const [ax,ay]=toMap(BRIDGE.x-bx,BRIDGE.z-bz), [bx2,by2]=toMap(BRIDGE.x+bx,BRIDGE.z+bz);
mmC.strokeStyle='#d8c890'; mmC.lineWidth=5;
mmC.beginPath(); mmC.moveTo(ax,ay); mmC.lineTo(bx2,by2); mmC.stroke();
}
for(const f of FLAGS){
const [px,py]=toMap(f.x,f.z);
mmC.beginPath(); mmC.arc(px,py,10,0,TAU);
mmC.fillStyle=f.owner===0?'rgba(90,140,220,.75)':f.owner===1?'rgba(220,110,90,.75)':'rgba(160,160,150,.6)';
mmC.fill();
if(f.capTeam!==-1&&f.cap>0.03){
mmC.beginPath(); mmC.arc(px,py,12,-HPI,-HPI+f.cap*TAU);
mmC.strokeStyle='#fff'; mmC.lineWidth=2; mmC.stroke();
}
mmC.fillStyle='#fff'; mmC.font=f.id.length>1?'bold 8px sans-serif':'bold 11px sans-serif'; mmC.textAlign='center';
mmC.fillText(f.id,px,py+(f.id.length>1?3:4));
}
for(const s of soldiers){
if(!s.alive||s.onVehicle) continue;
const [px,py]=toMap(s.pos.x,s.pos.z);
if(px<0||py<0||px>S||py>S) continue;
if(s.team===player.team){
mmC.fillStyle='#7dd87d';
mmC.beginPath(); mmC.arc(px,py,2.5,0,TAU); mmC.fill();
} else if(nowT-s.lastFiredT<2.5){
mmC.fillStyle='#ff5040';
mmC.beginPath(); mmC.arc(px,py,3,0,TAU); mmC.fill();
}
}
// 前出点 (遭遇/劫道无旗点战役): 阵营锚点菱形
for(const sp of (CAMPAIGN.spawns||[])){
const [px,py]=toMap(sp.x,sp.z);
if(px<-8||py<-8||px>S+8||py>S+8) continue;
mmC.save(); mmC.translate(px,py); mmC.rotate(HPI/4);
mmC.fillStyle=sp.team===0?'rgba(90,140,220,.8)':'rgba(220,110,90,.8)';
mmC.fillRect(-3.5,-3.5,7,7);
mmC.strokeStyle='#fff'; mmC.lineWidth=1; mmC.strokeRect(-3.5,-3.5,7,7);
mmC.restore();
}
for(const n of nades){
const [px,py]=toMap(n.pos.x,n.pos.z);
mmC.fillStyle='#ffd050'; mmC.fillRect(px-1.5,py-1.5,3,3);
}
// 小队进攻标记
if(SQUAD.mode==='move'&&SQUAD.members.length){
const [px,py]=toMap(SQUAD.pos.x,SQUAD.pos.z);
mmC.fillStyle='#ffd75a';
mmC.beginPath(); mmC.moveTo(px,py+5); mmC.lineTo(px-4,py-3); mmC.lineTo(px+4,py-3); mmC.closePath(); mmC.fill();
}
for(const t of tanks){
if(!t.alive) continue;
const [px,py]=toMap(t.pos.x,t.pos.z);
if(px<-8||py<-8||px>S+8||py>S+8) continue;
mmC.fillStyle=t.team===0?'#6da5e8':'#e87a68';
mmC.fillRect(px-4,py-4,8,8);
mmC.strokeStyle='#fff'; mmC.lineWidth=1; mmC.strokeRect(px-4,py-4,8,8);
}
// 劫道车队: 黄色方块 (护运目标)
for(const t of trucks){
if(!t.alive) continue;
const [px,py]=toMap(t.pos.x,t.pos.z);
if(px<-8||py<-8||px>S+8||py>S+8) continue;
mmC.fillStyle='#ffd050';
mmC.fillRect(px-3.5,py-3.5,7,7);
mmC.strokeStyle='#554a20'; mmC.lineWidth=1; mmC.strokeRect(px-3.5,py-3.5,7,7);
}
// 断崖公路: 劫道方临时补给点 (限时存活期) 绿色小点
if(SUPPLY_POINTS.length){
for(const sp of SUPPLY_POINTS){
const [px,py]=toMap(sp.x,sp.z);
if(px<-8||py<-8||px>S+8||py>S+8) continue;
mmC.fillStyle='#52c878';
mmC.beginPath(); mmC.arc(px,py,3,0,TAU); mmC.fill();
}
}
for(const pl of planes){
if(!pl.alive) continue;
const [px,py]=toMap(pl.pos.x,pl.pos.z);
if(px<-8||py<-8||px>S+8||py>S+8) continue;
mmC.save();
mmC.translate(px,py);
mmC.rotate(-(pl.yaw)+(player.alive?player.yaw:0)+Math.PI);
mmC.fillStyle=pl.team===0?'#9dc5f8':'#f8a898';
mmC.beginPath(); mmC.moveTo(0,-5); mmC.lineTo(4,4); mmC.lineTo(0,2); mmC.lineTo(-4,4); mmC.closePath(); mmC.fill();
mmC.restore();
}
if(player.alive){
mmC.save();
mmC.translate(half,half);
mmC.fillStyle='#fff';
mmC.beginPath(); mmC.moveTo(0,-6); mmC.lineTo(4,5); mmC.lineTo(-4,5); mmC.closePath(); mmC.fill();
mmC.restore();
}
mmC.restore();
mmC.strokeStyle='rgba(210,200,160,.4)'; mmC.lineWidth=1.5;
mmC.beginPath(); mmC.arc(half,half,half-2,0,TAU); mmC.stroke();
}
const cpC=el('compass').getContext('2d');
function drawCompass(){
const W=460,H=26;
cpC.clearRect(0,0,W,H);
cpC.fillStyle='rgba(0,0,0,.35)'; cpC.fillRect(0,0,W,H);
const yaw=player.alive?player.yaw:0;
cpC.font='12px sans-serif'; cpC.textAlign='center';
const marks=[[0,'北'],[HPI,'西'],[Math.PI,'南'],[-HPI,'东'],[Math.PI/4,'西北'],[-Math.PI/4,'东北'],[Math.PI*0.75,'西南'],[-Math.PI*0.75,'东南']];
for(const [a,label] of marks){
let rel=angDiff(yaw,a);
if(Math.abs(rel)>1.2) continue;
const x=W/2-rel/1.2*(W/2);
cpC.fillStyle='rgba(255,255,255,.75)';
cpC.fillText(label,x,17);
}
for(const f of FLAGS){
const a=Math.atan2(player.pos.x-f.x,player.pos.z-f.z);
let rel=angDiff(yaw,a);
if(Math.abs(rel)>1.2) continue;
const x=W/2-rel/1.2*(W/2);
cpC.fillStyle=f.owner===0?'#8fc1ff':f.owner===1?'#ff9c8a':'#ccc';
cpC.font='bold 13px sans-serif';
cpC.fillText(f.id,x,13);
cpC.fillRect(x-1,18,2,5);
cpC.font='12px sans-serif';
}
cpC.fillStyle='#ffd77a'; cpC.fillRect(W/2-1,2,2,6);
}
let hudSlowT=0;
function updateHUD(dt){
const w=player.curW;
if(player.onVehicle&&player.onVehicle.kind==='plane'){
const t=player.onVehicle;
el('wname').textContent=t.name;
el('wmode').textContent='机体 '+Math.max(0,Math.round(t.hp/t.maxHp*100))+'%';
el('magN').textContent=Math.round(t.speed*3.6)+'km/h';
el('magN').style.color='#eee';
el('resN').textContent='高度 '+Math.round(t.pos.y)+'m';
el('nadeN').textContent='A/D 压坡转向 · 鼠标拉杆 · 炸弹 ×'+t.bombs+' [右键/B]';
} else if(player.onVehicle){
const t=player.onVehicle;
el('wname').textContent=t.name;
el('wmode').textContent='装甲 '+Math.max(0,Math.round(t.hp/t.maxHp*100))+'%';
el('magN').textContent=t.cannonCd<=0?'就绪':t.cannonCd.toFixed(1);
el('magN').style.color=t.cannonCd<=0?'#9fd89f':'#e0c080';
el('resN').textContent='';
el('nadeN').textContent='主炮[左键] · 机枪[右键] · 视角[F]';
} else if(player.onAT){
el('wname').textContent='57mm 反坦克炮';
el('wmode').textContent='穿甲弹';
el('magN').textContent=player.onAT.cd<=0?'就绪':player.onAT.cd.toFixed(1);
el('magN').style.color=player.onAT.cd<=0?'#9fd89f':'#e0c080';
el('resN').textContent=''; el('nadeN').textContent='';
} else if(player.onAA){
el('wname').textContent='防空炮';
el('wmode').textContent='高爆弹';
el('magN').textContent='∞';
el('magN').style.color='#eee';
el('resN').textContent=''; el('nadeN').textContent='';
	} else if(player.loiter){
	el('wname').textContent='巡飞弹 · TV制导';
	el('wmode').textContent='导弹视角';
	el('magN').textContent=Math.ceil(player.loiter.life)+'s';
	el('magN').style.color=player.loiter.life<4?'#ff7060':'#9fe89f';
	el('resN').textContent=Math.round(player.loiter.spd)+' m/s';
	el('nadeN').textContent='鼠标 制导 · 左键 自爆 · 右键 加速 · F 切换视角';
	} else if(w){
	el('wname').textContent=player.onMG?'MG42 通用机枪':w.def.name;
	el('wmode').textContent=player.onMG?'全自动':w.def.mode;
	el('magN').textContent=player.onMG?'∞':w.mag;
	el('resN').textContent=player.onMG?'':'/ '+w.reserve;
	el('magN').style.color=(!player.onMG&&w.mag<=Math.max(2,w.def.mag*0.25))?'#ff7060':'#eee';
	el('nadeN').textContent='手雷 ×'+player.nadeCount+' · 绷带[H] ×'+player.bandages+(player.cls===2?' · AT雷[3] ×'+player.atNades:'')+(CLASSES[player.cls].smoke?' · 烟雾[4] ×'+player.smokeCount:'')+(player.incinCount>0?' · 燃烧[6] ×'+player.incinCount:'')+(player.cls===4?' · 医疗箱[B]':'');
	}
// 载具血量条 (2026-09-01 用户新增: 驾驶坦克/飞机时按压感显示机体血量)
if(player.onVehicle&&(player.onVehicle.kind==='tank'||player.onVehicle.kind==='plane')){
const v=player.onVehicle;
const vhp=v.hp/v.maxHp;
el('vehHpWrap').style.display='block';
el('vehHpName').textContent=v.name;
el('vehHpBar').style.width=(Math.max(0,vhp)*100)+'%';
el('vehHpBar').style.background=vhp>0.5?'#9fd89f':(vhp>0.25?'#e0c080':'#e07060');
el('vehHpNum').textContent=Math.max(0,Math.ceil(v.hp))+' / '+v.maxHp;
}else el('vehHpWrap').style.display='none';
el('hpNum').textContent=Math.ceil(player.hp);
el('hpBar').style.width=player.hp+'%';
el('hpBar').style.background=player.hp>50?'#cfe0c0':(player.hp>25?'#e0c080':'#e07060');
el('stamBar').style.width=(player.stamina*100)+'%';
// 低频HUD(10Hz): 小地图/罗盘/票数/旗帜状态, 减少每帧DOM与Canvas开销
hudSlowT-=dt;
if(hudSlowT<=0){
hudSlowT=0.1;
{
	// 兵力一律实票: 攻防/破袭防守方=进攻方×1.75, 劫道双方标准相等票, 征服/遭遇双实票 (2026-09-02 去∞);
	// 顶部栏显示 剩余兵力(在场人数) (2026-09-04 用户指定: 票数为主, 括号内=该队场上存活人数含玩家/乘员)
	const t0s=Math.ceil(tickets[0]);
	const t1s=Math.ceil(tickets[1]);
	const f0=fieldCount(0), f1=fieldCount(1);
	let modeLine='';
	if(GAMEMODE==='assault') modeLine=`<div style="font-size:11px;color:#ffd77a">攻防战 · 攻方占超一半且守方仅余1点→守方兵力流失 · 任意一方占满全部旗点→敌方兵力归零 · 全旗+歼灭残兵两条件齐备才判胜</div>`;
	else if(GAMEMODE==='demolition') modeLine=`<div style="font-size:11px;color:#ffd77a">破袭战 · 剩余补给库: ${DEPOTS.filter(d=>!d.destroyed).length}/${DEPOTS.length}</div>`;
	else if(GAMEMODE==='conquest') modeLine=`<div style="font-size:11px;color:#ffd77a">${CAMPAIGN.bridge?'拉锯战 · 激流不可徒涉 · 大桥是唯一通道':'征服战 · 一方占超一半且对方仅余1点→对方兵力流失 · 占满全部旗点→敌方兵力归零 · 全旗+歼灭残兵两条件齐备才判胜'}</div>`;
	else if(GAMEMODE==='clash') modeLine=`<div style="font-size:11px;color:#ffd77a">遭遇战 · 无旗点 · 兵力打空后需清场残敌方胜</div>`;
	else if(GAMEMODE==='convoy'){ const cs=(typeof CONVOY_STATE!=='undefined'&&CONVOY_STATE)?` · 剩余 ${CONVOY_STATE.left} 辆 · 已突围 ${CONVOY_STATE.esc}`:''; modeLine=`<div style="font-size:11px;color:#ffd77a">劫道战 · 毁车过半→劫道方胜, 突围过半→护运方胜 · 劫道方补给 ${Math.round(((CAMPAIGN.convoy&&CAMPAIGN.convoy.supplyLife)||600)/60)} 分钟后失效 · 护运方贴车补${cs}</div>`; }
	let wipeLine='';
	for(const z of [0,1]){
	if(tickets[z]<=0){
	const gl=flagsLostOf(1-z);
	wipeLine+=`<div style="font-size:11px;color:#ff9c8a">⚠ ${TEAM_NAME[z]} 兵力归零 · ${TEAM_NAME[1-z]} 需${gl>0?`占满全部旗点(余 ${gl} 点)+`:''}消灭其场上残兵(剩 ${fieldCount(z)} 人)方可获胜${wipeT[z]!==null?`<b style="color:#ffe08a"> · ⏳ 最后一人清场倒计时 ${Math.ceil(wipeT[z])} 秒</b>`:''}</div>`;
	}
	}
	const tn=' style="font-style:normal;font-size:12px;opacity:.75"';
	el('tickets').innerHTML=`<span class="tl">${TEAM_NAME[0]} ${t0s}<span${tn}>(${f0}人)</span></span> &nbsp;·&nbsp; <span class="tr">${t1s} ${TEAM_NAME[1]}<span${tn}>(${f1}人)</span></span>`+modeLine+wipeLine+
	(player.spectator?`<div style="font-size:11px;color:#9fe8ff">观战中 · 免伤 · 不被索敌 · 双击空格悬停/H气动飞行</div>`:'');
}
const mm=Math.floor(Math.max(0,matchTime)/60), ss2=Math.floor(Math.max(0,matchTime)%60);
el('timeTxt').textContent=`${mm}:${ss2<10?'0':''}${ss2}`;
FLAGS.forEach((f,i)=>{
const fi=el('fi'+f.id);
fi.className=(f.owner===0?'f0':f.owner===1?'f1':'')+(f.capTeam!==-1&&f.cap>0.03?' fc':'');
});
drawMinimap();
drawCompass();
// 小队HUD
const sqEl=el('squadHUD');
if(SQUAD.members.length&&player.deployed){
const alive=SQUAD.members.filter(s=>s.alive).length;
sqEl.style.display='block';
sqEl.innerHTML=`◆ 小队 <b>${alive}/${SQUAD.members.length}</b> · ${SQUAD.mode==='move'?'<b>进攻标记点</b>':'跟随中'}<br><span style="opacity:.65">[T] 标点进攻 · [Y] 跟随我</span>`;
} else sqEl.style.display='none';
}
let inFlag=null;
if(player.alive) for(const f of FLAGS){ if(Math.hypot(player.pos.x-f.x,player.pos.z-f.z)<f.r) inFlag=f; }
const cp2=el('capPanel');
if(inFlag&&(inFlag.capTeam!==-1&&inFlag.cap>0.02||inFlag.owner!==player.team)){
cp2.style.display='block';
el('capLetter').textContent=inFlag.id;
el('capBarFill').style.width=(inFlag.cap*100)+'%';
// 争夺状态: 双方同时在圈内 → 进度冻结并黄条提示, 不再表现为"进度条不动"
const contested=inFlag.present&&inFlag.present[0]>0&&inFlag.present[1]>0;
el('capBarFill').style.background=contested?'#e8d06a':(inFlag.capTeam===0?'#8fc1ff':'#ff9c8a');
let capTxt;
if(contested&&inFlag.cap>0.02) capTxt='⚠ 争夺中 · 圈内仍有敌军';
else capTxt=inFlag.capTeam===player.team?'正在占领…':(inFlag.capTeam===-1?(inFlag.owner===player.team?'我方控制':'站在旗点范围内占领'):'敌军正在占领!');
el('capTxt').textContent=capTxt;
} else cp2.style.display='none';
dmgFlash=Math.max(0,dmgFlash-dt*2);
el('dmgOv').style.opacity=dmgFlash;
el('lowOv').style.opacity=player.alive&&player.hp<35?(1-player.hp/35)*0.85:0;
	el('supOv').style.opacity=player.suppressV*0.7;
	const tvEl=el('tvOv');
	if(tvEl&&tvEl.style.display!==(player.loiter?'block':'none')) tvEl.style.display=player.loiter?'block':'none';
nadeWarnT-=dt;
el('nadeWarn').style.display=nadeWarnT>0?'block':'none';
if(!player.onAA) el('leadPip').style.display='none';
if(!(player.onVehicle&&player.onVehicle.kind==='tank')){ el('tankPip').style.display='none'; el('mgPip').style.display='none'; }
// 架枪状态指示
const bi=el('braceInd');
if(player.alive&&player.braced){ bi.style.display='block'; bi.className='on'; bi.textContent='▙ 已架枪'; }
else if(player.alive&&player.canBrace&&!player.prone&&!player.onVehicle){ bi.style.display='block'; bi.className=''; bi.textContent='[X] 架枪'; }
else bi.style.display='none';
	const ch=el('crosshair');
	if(player.alive&&player.loiter){
	ch.style.display='block';
	ch.style.setProperty('--gap','7px');
	} else if(player.alive&&!player.ads&&!player.onVehicle){
ch.style.display='block';
const gap=8+player.bloom*26+(Math.hypot(player.vel.x,player.vel.z)>1?6:0);
ch.style.setProperty('--gap',gap+'px');
} else if(player.alive&&player.ads&&WPN_DEFS[VM.key]?.atRifle&&!player.onVehicle){
// 反坦克枪侧偏机瞄: 保留小型准星充当侧置机械瞄具
ch.style.display='block';
ch.style.setProperty('--gap','5px');
} else if(player.alive&&player.ads&&!WPN_DEFS[VM.key]?.scoped){
ch.style.display='none';
} else ch.style.display='none';
}
let respawnCd=0, selectedSpawn=0;
function initMenuUI(){
// 主菜单导航
	const showPanel=(id)=>{
	el('mHome').classList.toggle('hidden',id!=='mHome');
	['mPlay','mSet','mHelp'].forEach(pid=>el(pid).classList.toggle('hidden',pid!==id));
	};
	document.querySelectorAll('.navBtn').forEach(b=>{
	b.onclick=()=>{ AudioSys.resume&&AudioSys.resume(); showPanel(b.dataset.p); };
	});
	document.querySelectorAll('.backBtn').forEach(b=>{ b.onclick=()=>showPanel('mHome'); });
	el('helpBtn').onclick=()=>{ AudioSys.resume&&AudioSys.resume(); showPanel('mHelp'); };
	// 实验模式开关 (操作说明旁): 巡飞弹兵替换反坦克兵
	{
	const eb=el('expBtn');
	if(eb){
	eb.textContent='⚙ 实验模式: '+(EXPERIMENT?'开':'关');
	eb.classList.toggle('sel',EXPERIMENT);
	eb.onclick=()=>{
	AudioSys.resume&&AudioSys.resume();
	localStorage.setItem('sf_exp',EXPERIMENT?'0':'1');
	location.reload();
	};
	}
	}
// 触控按键大小
{
const stored=parseInt(localStorage.getItem('sf_tsize')||'100');
el('tsizeRange').value=stored;
el('tsizeVal').textContent=stored+'%';
el('tsizeRange').oninput=e=>{
localStorage.setItem('sf_tsize',e.target.value);
el('tsizeVal').textContent=e.target.value+'%';
applyTouchScale();
};
}
// 战役选择 (并入开局面板): 占旗点战役收进文件夹, 破袭/遭遇/劫道直排;
// 点击战役卡片 = 保存选择后重载页面并自动开局 (与"进入战场"合并为一步)
const campRow=el('campRow');
const makeCampBtn=(c,i)=>{
const b=document.createElement('button');
b.className='optBtn'+(i===CAMPAIGN_IDX?' sel':'');
b.innerHTML=`<b>${c.title}</b><br><span style="font-size:10px;opacity:.8;color:#c0d8e0">${c.modeName}</span><br><span style="font-size:11px;opacity:.7">${c.sub}</span>`;
b.style.minWidth='150px';
b.onclick=()=>{
localStorage.setItem('sf_campaign',String(i));
localStorage.setItem('sf_openplay','1');
location.reload();
};
return b;
};
const isFlagMode=m=>m==='assault'||m==='conquest';
const flagCamps=CAMPAIGNS.map((c,i)=>({c,i})).filter(x=>isFlagMode(x.c.mode));
const otherCamps=CAMPAIGNS.map((c,i)=>({c,i})).filter(x=>!isFlagMode(x.c.mode));
// 外层行: 文件夹按钮 + 直排战役
const outerRow=document.createElement('div');
outerRow.style.width='100%';
outerRow.style.display='flex'; outerRow.style.flexWrap='wrap';
outerRow.style.justifyContent='center'; outerRow.style.gap='8px';
const folderBtn=document.createElement('button');
folderBtn.className='optBtn'+(flagCamps.some(x=>x.i===CAMPAIGN_IDX)?' sel':'');
folderBtn.innerHTML=`<b>📁 占旗点战役 (${flagCamps.length})</b><br><span style="font-size:10px;opacity:.8;color:#c0d8e0">攻防 · 征服 · 拉锯</span>`;
folderBtn.style.minWidth='150px';
folderBtn.onclick=()=>{
const open=folderRow.style.display==='flex';
folderRow.style.display=open?'none':'flex';
folderBtn.classList.toggle('sel',!open);
};
outerRow.appendChild(folderBtn);
for(const x of otherCamps) outerRow.appendChild(makeCampBtn(x.c,x.i));
campRow.appendChild(outerRow);
// 文件夹内行: 占旗点战役 + 返回
const folderRow=document.createElement('div');
folderRow.style.width='100%';
folderRow.style.display='none';
folderRow.style.flexWrap='wrap';
folderRow.style.justifyContent='center';
folderRow.style.gap='8px';
const backBtn=document.createElement('button');
backBtn.className='optBtn';
backBtn.textContent='‹ 返回';
backBtn.style.minWidth='110px';
backBtn.onclick=()=>{ folderRow.style.display='none'; folderBtn.classList.remove('sel'); };
folderRow.appendChild(backBtn);
for(const x of flagCamps) folderRow.appendChild(makeCampBtn(x.c,x.i));
campRow.appendChild(folderRow);
if(flagCamps.some(x=>x.i===CAMPAIGN_IDX)) folderBtn.firstChild.textContent=`📁 占旗点战役 (${flagCamps.length}) · 当前${CAMPAIGN.mode==='assault'?'攻防':(CAMPAIGN.mode==='conquest'?(CAMPAIGN.bridge?'拉锯':'征服'):'')}`;
el('menuSub').textContent=`—— ${CAMPAIGN.title} · ${CAMPAIGN.sub} ——`;
el('teamUS').innerHTML=`${TEAM_FACTION[0].sym} ${TEAM_FACTION[0].short} · ${TEAM_FACTION[0].name}`;
el('teamGER').innerHTML=`${TEAM_FACTION[1].sym} ${TEAM_FACTION[1].short} · ${TEAM_FACTION[1].name}`;
document.querySelector('.t0h').textContent=TEAM_NAME[0];
document.querySelector('.t1h').textContent=TEAM_NAME[1];
// 在场人数: 标准/加强/史诗 —— 决定每队 Bot 数量 (存档 sf_size)
document.querySelectorAll('.sizeBtn').forEach(b=>{
b.classList.toggle('sel',+b.dataset.s===SIZE_IDX);
b.onclick=()=>{
SIZE_IDX=+b.dataset.s;
localStorage.setItem('sf_size',b.dataset.s);
document.querySelectorAll('.sizeBtn').forEach(x=>x.classList.toggle('sel',x===b));
};
});
// 人力池倍率 (存档 sf_hmul): 只缩放兵力票池, 不改变在场人数
document.querySelectorAll('.hmulBtn').forEach(b=>{
b.classList.toggle('sel',+b.dataset.h===HMUL);
b.onclick=()=>{
localStorage.setItem('sf_hmul',b.dataset.h);
document.querySelectorAll('.hmulBtn').forEach(x=>x.classList.toggle('sel',x===b));
};
});
// 操控模式切换 (自动检测/强制触屏/强制键鼠)
{
const ov=localStorage.getItem('sf_mobile');
const lbl=ov==='1'?'操控: 触屏':(ov==='0'?'操控: 键鼠':'操控: 自动'+(MOBILE?'(触屏)':'(键鼠)'));
el('ctrlModeBtn').textContent=lbl;
el('ctrlModeBtn').onclick=()=>{
const cur=localStorage.getItem('sf_mobile');
const next=cur===null||cur===''?'1':(cur==='1'?'0':'');
if(next==='') localStorage.removeItem('sf_mobile'); else localStorage.setItem('sf_mobile',next);
location.reload();
};
}
el('teamUS').classList.toggle('sel',SETTINGS.team===0);
el('teamGER').classList.toggle('sel',SETTINGS.team===1);
el('teamUS').onclick=()=>{ SETTINGS.team=0; localStorage.setItem('sf_team','0'); el('teamUS').classList.add('sel'); el('teamGER').classList.remove('sel'); };
el('teamGER').onclick=()=>{ SETTINGS.team=1; localStorage.setItem('sf_team','1'); el('teamGER').classList.add('sel'); el('teamUS').classList.remove('sel'); };
document.querySelectorAll('.diffBtn').forEach(b=>{
b.classList.toggle('sel',+b.dataset.d===SETTINGS.diff);
b.onclick=()=>{
SETTINGS.diff=+b.dataset.d;
localStorage.setItem('sf_diff',b.dataset.d);
document.querySelectorAll('.diffBtn').forEach(x=>x.classList.toggle('sel',x===b));
};
});
document.querySelectorAll('.qualBtn').forEach(b=>b.onclick=()=>{
SETTINGS.quality=+b.dataset.q;
document.querySelectorAll('.qualBtn').forEach(x=>x.classList.toggle('sel',x===b));
applyQuality();
});
el('sensRange').oninput=e=>{ SETTINGS.sens=e.target.value/100; el('sensVal').textContent=SETTINGS.sens.toFixed(1); };
el('volRange').oninput=e=>{ SETTINGS.vol=e.target.value/100; el('volVal').textContent=e.target.value; AudioSys.setVol(SETTINGS.vol); };
// 开始一局: 在场人数按规模档, 人力池只缩放兵力票
function startGame(){
const mul=Math.min(2,Math.max(0.5,parseFloat(localStorage.getItem('sf_hmul')||'2')||2));
AudioSys.init();
player.team=SETTINGS.team;
BOTS_PER_TEAM=SIZE_OPTS[SIZE_IDX].bots;
	const tk=Math.round(START_TICKETS*mul/2);
	tickets[0]=tk; tickets[1]=tk;
	wipeAnnounced[0]=false; wipeAnnounced[1]=false; // 清场播报复位 (2026-09-04)
	wipeT[0]=null; wipeT[1]=null; // 最后一人清场倒计时复位 (2026-09-04)
	startMatch();
el('menu').classList.add('hidden');
showDeploy(true);
}
el('startBtn').onclick=()=>{
AudioSys.resume&&AudioSys.resume();
startGame();
};
el('againBtn').onclick=()=>location.reload();
	const grid=el('classGrid');
	CLASSES.forEach((c,i)=>{
	const d=document.createElement('div');
	d.className='classCard'+(i===0?' sel':'');
	const cname=(EXPERIMENT&&i===5)?'巡飞弹兵':c.name;
	d.innerHTML=`<div class="cname">${cname}</div><div class="cwpn" id="cw${i}"></div><div class="cwpn">手雷 ×${c.nades}</div>`;
d.onclick=()=>{
// 观战模式开关: 实验模式下巡飞弹兵"已选中"时再点一次 → 开/关观战 (2026-09-01 用户指定)
if(EXPERIMENT&&i===5&&player.cls===5){
player.spectator=!player.spectator;
d.classList.toggle('spec',player.spectator);
d.style.outline=player.spectator?'2px solid #ffd76b':'';
const cn=d.querySelector('.cname');
if(cn) cn.textContent='巡飞弹兵'+(player.spectator?' · 观战中':'');
showScorePop(player.spectator
?(player.alive&&player.deployed?'观战将随下次部署生效':'观战模式已开启: 免伤·不被索敌·弹药无限')
:'观战模式已关闭');
AudioSys.click(1200,0.3,0.05);
}
player.cls=i;
document.querySelectorAll('.classCard').forEach(x=>x.classList.toggle('sel',x===d));
};
grid.appendChild(d);
});
el('deployBtn').onclick=()=>{
if(respawnCd>0||matchOver||tickets[player.team]<=0) return; // 己方兵力归零后不可再部署 (2026-09-04)
deployPlayer();
};
el('resumeBtn').onclick=()=>{
document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden'));
lockPointer();
};
renderer.domElement.addEventListener('click',()=>{
if(player.alive&&player.deployed&&!pointerLocked&&!matchOver) lockPointer();
});
// 选战役后重载回到本面板 (战役选择与开始游戏同屏); 清理旧版"自动开局"残留标记
localStorage.removeItem('sf_autostart');
if(localStorage.getItem('sf_openplay')==='1'){
localStorage.removeItem('sf_openplay');
showPanel('mPlay');
}
}
