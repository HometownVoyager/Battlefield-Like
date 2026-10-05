// ─────────────────────────────────────────────
// 23-deploy.js —— 部署界面/开局
// 源: Index.original.html 第 8324-8530 行
// ─────────────────────────────────────────────
'use strict';
// 兵种卡武器行文本 (2026-09-17 观战扩展批: 由 showDeploy 内联抽成单源) —— 供部署界面渲染与
// "在兵种卡上开/关观战"时即时刷新共用: 武器列表一律走 playerClassWeapons (实验模式换巡飞弹兵 +
// 观战模式副武器换连狙两条规则都在这条单源里生效, 卡片显示与实际配枪永远一致)。
function classCardWeaponText(i){
const ws=playerClassWeapons(player.team,i);
let d2=ws.map(k=>t(WPN_DEFS[k].name)).join(' · ');
if(i===1){ const g=clsGear(i,player.team); d2+=' · '+t('AT雷[3]×{0}',g.atn)+' · '+t('燃烧弹[6]×{0}',(CLASSES[i].incin||0)); } // 2026-09-28 兵种8→5: 突击兵=原cls2 配置随合并迁到 cls1
if(i===0) d2+=' · '+t('AT雷[3]×{0}',clsGear(i,player.team).atn); // 2026-10-05: 步枪兵新增 AT雷×2 (键位同突击兵的 3)
if(i===3) d2+=EXPERIMENT?' · '+t('燃烧弹[6]×2'):' · '+t('AT雷×{0}',(TEAM_FACTION[player.team].atn5||3));
return d2;
}
function showDeploy(isDead){
document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden'));
el('deploy').classList.remove('hidden');
el('blackOv').style.opacity=0;
CLASSES.forEach((c,i)=>{
el('cw'+i).textContent=classCardWeaponText(i);
});
el('deathInfo').innerHTML=(()=>{
if(!isDead) return '';
const lifeT=Math.max(0,nowT-(player.lifeStartT||nowT));
const mm2=Math.floor(lifeT/60), ss3=Math.floor(lifeT%60);
const lk=player.lifeKills||0, ls=(player.score||0)-(player.lifeScoreStart||0);
return (player.killerName?t('你被 {0} 击杀了',`<b>${player.killerName}</b>${player.killerSrc?` <span style="font-size:12px;color:#cfd8c2">[${t(player.killerSrc)}]</span>`:''}`)+'<br>':'')+
`<span style="font-size:13px;color:#cdd8c8">${t('本次存活 {0} · 击杀 {1} · 获得 +{2} 分',mm2+':'+(ss3<10?'0':'')+ss3,lk,ls)} &nbsp;|&nbsp; ${t('本局总计 {0} 杀 / {1} 死 / {2} 分',player.kills,player.deaths,player.score)}</span>`;
})();
el('resumeBtn').style.display=(player.alive&&player.deployed)?'inline-block':'none';
// 返回主界面入口 (2026-09-16 本批): 战局已结束时不显示 —— 那条路径归结算页的「返 回 主 界 面」;
// 在"战局进行中"才显示: 开局选兵种时是唯一出口, 战斗中按 Esc 查看部署界面时同样可用
el('deployMenuBtn').style.display=matchOver?'none':'inline-block';
el('deployBtn').style.display=player.alive&&player.deployed?'none':'inline-block';
// 己方兵力归零 → 本局不可再部署 (清场阶段: 你阵亡后只能观看清场结算, 2026-09-04)
el('deployBtn').disabled=tickets[player.team]<=0;
if(tickets[player.team]<=0){
el('deathInfo').innerHTML+='<br><span style="font-size:13px;color:#ff9c8a">'+t('⚠ 己方兵力已耗尽 · 本局无法再部署 · 等待清场结算')+'</span>';
}
buildSpawnList();
drawDeployMap();
// 部署界面期隐藏战斗 HUD (2026-09-20 第6条修复): 本函数是"部署界面显示"的唯一入口 (全库只有这里摘 #deploy 的 hidden),
// 所以 inDeploy 的挂载点也收在这里 —— 判据与写 DOM 都走 22-hud 的 syncDeployHud 单源 (完整根因见那里的注释)。
// (typeof 守卫: 部分沙箱/探针只加载子集脚本, 缺 22-hud 时不该让部署界面报错)
if(typeof syncDeployHud==='function') syncDeployHud();
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
// 部署界面"载具出生项"的统一车表 (2026-09-20N 海战批): buildSpawnList 与 deployPlayer 必须读**同一份顺序**,
// 否则 selectedSpawn 的 'V<序号>' 在两处会指向不同载具 (旧版两行各自手写 [...tanks,...planes], 靠人工保持一致;
// 本批加了第三种载具, 再手写一次就是同步风险) —— 收成一个函数, 顺序定义只有一处。
function deployVehList(team){
const nav=(typeof navalCraft!=='undefined'&&Array.isArray(navalCraft))?navalCraft:[];
return [...tanks,...planes,...nav].filter(v=>v&&v.team===team);
}
function buildSpawnList(){
const list=el('spawnList');
list.innerHTML='';
const opts=[];
// ★2026-10-03 (海战图主基地跟随): 部署交付 (deployPlayer) 用 basePos 单源 —— 纯海图它是**基地舰当前
//   位置**; 本列表旧版写 BASES 静态海点, 按钮坐标与实际落点相差整段航程 (选"主基地"= 落到舰上另一头)。
if(BASES.length){
const bp=basePos(player.team);
opts.push({name:t('主基地'),x:bp.x,z:bp.z,id:-1});
}
// 瘫舰甲板旗不是出生点 (2026-10-01b 用户裁定"瘫舰=无阵营陆地, 无法作为重生点"): capFlagActive 单源
FLAGS.forEach((f,i)=>{ if(f.owner===player.team&&(typeof capFlagActive!=='function'||capFlagActive(f))) opts.push({name:t('{0} 点',f.id),x:f.x,z:f.z,id:i}); });
// 无旗点战役 (遭遇/劫道): 部署选项=本方当前持有的强点 (草原库尔斯克改版: 占领获得出生权, 随战线进退)
(CAMPAIGN.spawns||[]).forEach((sp,si)=>{
const own=(typeof SPOTS!=='undefined'&&SPOTS[si])?SPOTS[si].own:sp.team;
if(own===player.team) opts.push({name:sp.name,x:sp.x,z:sp.z,id:'P'+si});
});
// 劫道模式: 护运方可选随车队出生 (位置在部署瞬间解算: 车队开到哪跟到哪)
if(GAMEMODE==='convoy'&&CAMPAIGN.convoy&&player.team===CAMPAIGN.convoy.escortTeam){
const pt=convoyDeployPt();
opts.push({name:t('随车队'),x:pt.x,z:pt.z,id:'CV'});
}
// 载具出生选项 (重生倒计时按 tankRespawnMul 换算: 苏军厂房在手时实际回场更快)
// 海战载具同表纳入 (2026-09-20N 海战批): 用户要"能开两栖车和炮/鱼雷艇", 而艇停在海上集结点 (离岸数十米) ——
// 只留"游过去按 F"一条路的话, 玩家实际上够不到艇。所以本表把艇/两栖车列为出生项: 选它 = 直接在
// 集结点进驾驶位 (与走近按 F 共用同一份座位初始化 navalBoard, 不是第二条上船路径)。
// ★2026-09-26H 观战闸门 (用户圈定修复 #2/A2) → ★2026-09-27I **扩到全类** (用户追补: "观战模式仍能选几个
//   海战相关载具"): 观战者的明写口径是"常规载具/阵位/补给一概不用 (自由观察专用)", 而本表的每一项都是
//   **真载具** (deployVehList = tanks + planes + navalCraft) —— 选它 = 把 AI 的装备从战局里拿走
//   (坦克少一台 / 艇的 AI 车组被顶掉)。旧版只挡 tank/plane, 给舰艇留了口 (依据 2026-09-22 的"上艇唯一
//   路径"裁定); 本轮起 **坦克/战机/舰艇/两栖车一律置灰并注明"观战不可征用"**。想开艇仍可按 F 现场上艇 ——
//   那是"走近了动手"的干预权, 与"从部署界面凭空领一台"是两回事 (用户要挡的是后者)。
const vehs=deployVehList(player.team);
vehs.forEach((v,i)=>{
const id='V'+i;
const busy=v.playerDriven;
const specBlocked=!!player.spectator;
const ready=v.alive&&!busy&&!specBlocked;
const remain=v.alive?0:Math.ceil((typeof v.respawnT==='number'?v.respawnT:0)/(v.kind==='tank'?tankRespawnMul(v.team):1));
const ic=(v.kind==='plane')?'✈ ':((v.kind==='amph'||v.kind==='boat')?'⚓ ':'▣ ');
opts.push({name:ic+t(v.name)+(specBlocked?t(' (观战不可征用)'):(ready?'':(busy?t(' (占用)'):t(' (重生 {0}s)',remain)))),id,veh:v,disabled:!ready});
});
// 观战专属载具「幽灵坦克」**不进出生列表** (2026-09-26H 用户裁定): "开局的时候幽灵坦克不出现, 只在按下 F
// 的时候按需出现" —— 旧版这里预置车 + 给「观战载具」出生项 (选了就直接上车), 于是场上总停着一台无敌白车。
// 现在唯一入口是 20-player tryInteract ③ / 提示行里的 "F 召唤幽灵坦克", 也就是 specVehSummon。
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
// 缩放随地图尺寸: 标准 320 图=±170 (与原 170 一致), 大地图 640/800=±410
const MH=MAP_SIZE/2+10;
const toM=(x,z)=>[S/2+x/MH*S/2, S/2+z/MH*S/2];
c.strokeStyle='rgba(150,130,90,.5)'; c.lineWidth=4;
// 环礁海域 + 珊瑚跑道 (语义分区, 2026-09-18 塔拉瓦批): 先铺海面分带, 陆上要素随后覆盖
if(SEA){ drawSeaBands(toM,c,MH); drawRunway(toM,c); }
if(CAMPAIGN.sineRoad){
c.beginPath();
for(let x=-(MAP_SIZE/2-5);x<=MAP_SIZE/2-5;x+=10){ const [px,py]=toM(x,sineRoadZ(x)); x===-(MAP_SIZE/2-5)?c.moveTo(px,py):c.lineTo(px,py); } // 2026-09-06 B7a/P2-11/12
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
// 河道与大桥 (主河 + 淞沪支流 + 多桥)
if(RIVER){
c.strokeStyle='rgba(70,110,150,.85)'; c.lineWidth=9;
c.beginPath();
RIVER.pts.forEach((pt,i)=>{
const [px,py]=toM(pt[0],pt[1]);
i===0?c.moveTo(px,py):c.lineTo(px,py);
});
c.stroke();
// 徒涉滩 (胡康 ford, 2026-09-12 巨桥改版): 虚线圈=可涉渡口
if(RIVER.ford){
const F=RIVER.ford, [fx,fy]=toM(F.x,F.z);
c.strokeStyle='rgba(205,230,240,.95)'; c.lineWidth=2.5;
c.setLineDash([6,4]);
c.beginPath(); c.arc(fx,fy,F.r/MH*(S/2)*0.8,0,TAU); c.stroke();
c.setLineDash([]);
}
}
if(typeof DELTA_CHANS!=='undefined'&&DELTA_CHANS.length){
c.strokeStyle='rgba(70,110,150,.55)'; c.lineWidth=5;
for(const ch of DELTA_CHANS){
c.beginPath();
ch.forEach((pt,i)=>{
const [px,py]=toM(pt[0],pt[1]);
i===0?c.moveTo(px,py):c.lineTo(px,py);
});
c.stroke();
}
}
// 鱼塘/藕塘 + 丝厂地标 (淞沪)
if(typeof DELTA!=='undefined'&&DELTA&&DELTA.ponds){
for(const pd of DELTA.ponds){
const [px,py]=toM(pd.x,pd.z);
c.beginPath(); c.arc(px,py,pd.r*0.7,0,TAU);
c.fillStyle=pd.t==='lotus'?'rgba(70,120,60,.5)':'rgba(70,110,150,.5)';
c.fill();
}
}
if(typeof DELTA!=='undefined'&&DELTA&&DELTA.landmark){
const L=DELTA.landmark;
const [px,py]=toM(L.x,L.z);
c.fillStyle='rgba(160,100,70,.9)';
c.fillRect(px-7,py-7,14,14);
c.fillStyle='#fff'; c.font='bold 10px sans-serif'; c.textAlign='center';
c.fillText('丝厂',px,py+3);
}
if(typeof BRIDGES!=='undefined'&&BRIDGES.length){
c.strokeStyle='#d8c890'; c.lineWidth=7;
for(const B of BRIDGES){
const bx=Math.sin(B.yaw)*(B.len/2), bz=Math.cos(B.yaw)*(B.len/2);
const [ax,ay]=toM(B.x-bx,B.z-bz), [bx2,by2]=toM(B.x+bx,B.z+bz);
c.beginPath(); c.moveTo(ax,ay); c.lineTo(bx2,by2); c.stroke();
}
}
// 百团沟壑 (语义分区, 2026-09-12 补画): 沟壑赭色带 + 坡道堑口浅色通道线 —— 部署图读出三路与分层
if(typeof LOESS!=='undefined'&&LOESS&&LOESS.gullies){
c.strokeStyle='rgba(158,108,58,.85)'; c.lineWidth=9;
for(const g of LOESS.gullies){
c.beginPath();
g.forEach((pt,i)=>{
const [px,py]=toM(pt[0],pt[1]);
i===0?c.moveTo(px,py):c.lineTo(px,py);
});
c.stroke();
}
if(LOESS.ramps){
c.strokeStyle='rgba(230,212,160,.95)'; c.lineWidth=3.5;
for(const r of LOESS.ramps){
const [ax,ay]=toM(r.x0,r.z0), [bx2,by2]=toM(r.x1,r.z1);
c.beginPath(); c.moveTo(ax,ay); c.lineTo(bx2,by2); c.stroke();
}
}
}
// 雾林守线语义 (2026-09-13 许特根改版): 北谷灰蓝带 + 堑口浅色通道 + 西墙深灰双线 (缺口留白)
if(typeof WOOD!=='undefined'&&WOOD&&WOOD.ravine){
c.strokeStyle='rgba(96,108,104,.9)'; c.lineWidth=9;
c.beginPath();
WOOD.ravine.pts.forEach((pt,i)=>{
const [px,py]=toM(pt[0],pt[1]);
i===0?c.moveTo(px,py):c.lineTo(px,py);
});
c.stroke();
c.strokeStyle='rgba(224,216,180,.95)'; c.lineWidth=3.5;
for(const r of WOOD.ravine.ramps){
const [ax,ay]=toM(r.x0,r.z0), [bx2,by2]=toM(r.x1,r.z1);
c.beginPath(); c.moveTo(ax,ay); c.lineTo(bx2,by2); c.stroke();
}
}
if(typeof WOOD!=='undefined'&&WOOD&&WOOD.belt){
const B=WOOD.belt;
c.strokeStyle='rgba(70,72,66,.92)'; c.lineWidth=5;
for(const bx of [B.x0,B.x1]){
c.beginPath();
let [px,py]=toM(bx,-B.spanZ);
c.moveTo(px,py);
[px,py]=toM(bx,-B.gapZ); c.lineTo(px,py);
[px,py]=toM(bx,B.gapZ); c.moveTo(px,py);
[px,py]=toM(bx,B.spanZ); c.lineTo(px,py);
c.stroke();
}
}
// ★2026-10-03 (海战图部署图): 大舰轮廓 (随艏向的矩形, 瘫舰转灰) —— 旧版部署图上没有舰,
// 而甲板旗圈画在随舰移动的 f.x/f.z 上, 玩家对着空海面看旗。画在旗圈之下, 语义分区一目了然。
if(typeof capitalShips!=='undefined'&&capitalShips.length){
for(const s of capitalShips){
const chl=s.spec.hullL*0.5, chw=s.spec.hullW*0.5;
const cc=Math.cos(s.yaw), nn=Math.sin(s.yaw);
c.beginPath();
[[chw,chl],[-chw,chl],[-chw,-chl],[chw,-chl]].forEach((p2,i)=>{
const [qx,qy]=toM(s.pos.x+p2[0]*cc+p2[1]*nn, s.pos.z-p2[0]*nn+p2[1]*cc);
i===0?c.moveTo(qx,qy):c.lineTo(qx,qy);
});
c.closePath();
c.fillStyle=s.state==='crippled'?'rgba(120,120,118,.4)':(s.team===0?'rgba(74,112,176,.5)':'rgba(176,90,74,.5)');
c.fill();
}
}
if(BASES.length) [0,1].forEach(t=>{
// ★2026-10-03 (与主基地按钮同族): 海战图基地方块跟随基地舰当前位置, 不再钉在静态海点
const bp2=(typeof basePos==='function')?basePos(t):BASES[t];
const [px,py]=toM(bp2.x,bp2.z);
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
// 瘫舰甲板旗 (2026-10-01b): 灰色 + 斜杠 (读作"不可占领/不可出生"的中立陆地)
const dead=(typeof capFlagActive==='function')&&!capFlagActive(f);
c.beginPath(); c.arc(px,py,13,0,TAU);
c.fillStyle=dead?'rgba(120,120,118,.55)':(f.owner===0?'rgba(90,140,220,.85)':f.owner===1?'rgba(220,110,90,.85)':'rgba(150,150,140,.7)');
c.fill();
if(dead){ c.strokeStyle='rgba(40,40,40,.85)'; c.lineWidth=2; c.beginPath(); c.moveTo(px-8,py-8); c.lineTo(px+8,py+8); c.stroke(); }
c.fillStyle='#fff'; c.font=f.id.length>1?'bold 9px sans-serif':'bold 13px sans-serif'; c.textAlign='center';
c.fillText(f.id,px,py+(f.id.length>1?3:4));
}
// 无旗点战役: 强点菱形 (颜色=当前归属, 中立=灰; 被争夺时描边闪烁)
for(const [si,sp] of (CAMPAIGN.spawns||[]).entries()){
const own=(typeof SPOTS!=='undefined'&&SPOTS[si])?SPOTS[si].own:sp.team;
const contested=typeof SPOTS!=='undefined'&&SPOTS[si]&&SPOTS[si].capTeam!==-1;
const [px,py]=toM(sp.x,sp.z);
c.save(); c.translate(px,py); c.rotate(HPI/4);
c.fillStyle=own===0?'#4a70b0':own===1?'#b05a4a':'#9a968a';
c.fillRect(-6,-6,12,12);
if(contested){ c.lineWidth=2; c.strokeStyle='#ffd77a'; c.strokeRect(-7,-7,14,14); }
c.restore();
}
for(const s of soldiers){
if(!s.alive||s.onVehicle) continue;
const [px,py]=toM(s.pos.x,s.pos.z);
c.fillStyle=s.team===0?'#7da8e8':'#e8907d';
c.beginPath(); c.arc(px,py,2,0,TAU); c.fill();
}
// 海战载具 (2026-09-20N 海战批): 部署图用与陆上坦克不同的艏向三角符号 —— 画法与
// 小地图/大地图**同一份** (22-hud 追加段的 sfNavalMapSymbols, 北向图 rot=0, 与该文件 drawBigMap 的
// 投影同式); 复用既有 toM, 不在这里另写投影。typeof 守卫: 只加载部分脚本的沙箱不该因此报错。
if(typeof sfNavalMapSymbols==='function') sfNavalMapSymbols(toM,c,S,0);
}
function deployPlayer(){
const p=player;
if(tickets[p.team]<=0){ addKillMsg('兵力已耗尽 · 本方无法再部署',p.team); return; } // 清场阶段禁止部署 (2026-09-04)
	// 观战意图结算 (2026-09-26H 观战批, 审计 #3/A3): 战斗中在兵种卡上点开的观战开关**记在意图里**
	// (player.specWant), 到这一刻才真的落到 player.spectator —— 旧版二次点击当场生效, 一个正在交战的活人
	// 可以在不阵亡的情况下瞬间变成"免伤+无限弹+可打双方"。放函数最前: 下面的配枪 (playerClassWeapons)、
	// 副武器换装 (applySpectatorLoadout)、重生提示全都读 player.spectator。
	if(typeof p.specWant==='boolean'){
	p.spectator=p.specWant;
	p.specWant=null;
	}
	// ★观战局盖章 (判据 2026-09-27 收窄, 用户实报"选了一下观战再取消也被判观战不予计量"): 本局是否**真的
	//   顶着观战态落进战场** —— 只有这一刻记 specUsed, 结算才据此判"不计入历史记录" (21-match recCommit)。
	//   收在部署这一处是单源: 三条进入观战态的路径 (战斗中开开关走 specWant 待生效 / 选兵阶段开开关当场生效 /
	//   上一局遗留想开) 最终都要经过部署才可能产生战绩, 所以"部署时状态"就是唯一的判据来源。
	//   放在 specWant 结算**之后**、与观战无关的其它部署逻辑之前 —— 那一帧 p.spectator 已是最终值。
	if(p.spectator) p.specUsed=true;
	// 观战者不得征用**任何**真载具 (2026-09-26H A#2 的**结构性**保证, 2026-09-27I 扩到全类, 与 buildSpawnList
	// 的置灰同源): buildSpawnList 里 `if(!opts.some(o=>!o.disabled&&o.id===selectedSpawn)) selectedSpawn=-1`
	// 已经会在置灰那一刻清掉选中项, 但那条依赖"列表重建过"这一时序; 万一 selectedSpawn 还留着 'V<n>'
	// (先选艇 → 再开观战 → 交付确认 → 阵亡 → 部署), 这里再挡一道, 不让观战者从部署界面坐进 AI 的载具。
	if(p.spectator&&typeof selectedSpawn==='string'&&selectedSpawn[0]==='V') selectedSpawn=-1;
	// 观战专属载具「幽灵坦克」(2026-09-17 观战扩展批): 再部署先把上一趟的车**收掉** ——
	// 否则"人在车上 → 重新部署到别处"会把车永久锁在 playerDriven=true (再也上不去)。
	// 2026-09-26H: 旧版只解绑 (车停在原地), 而本轮起"开场/部署都不再预置白车"(用户裁定: 只在按 F 时按需出现),
	// 于是这里改走 specVehStow —— 解绑 + 摘出 world + 停引擎 + 进实例池, 场上不留车, 下次 F 是全新就位。
	if(typeof specVehStow==='function') specVehStow();
	else if(typeof specVehUnbind==='function') specVehUnbind();
// 载具出生
let vehSpawn=null;
if(typeof selectedSpawn==='string'&&selectedSpawn[0]==='V'){
const vehs=deployVehList(p.team);
const v=vehs[+selectedSpawn.slice(1)];
if(v&&v.alive&&!v.playerDriven) vehSpawn=v;
}
	let sx,sz;
	const sBase=basePos(p.team);
	const isBaseSpot=()=>Math.hypot(sx-sBase.x,sz-sBase.z)<1;
	if(vehSpawn){ sx=vehSpawn.pos.x; sz=vehSpawn.pos.z; }
	else if(typeof selectedSpawn==='string'&&selectedSpawn[0]==='P'){
	const sp=(CAMPAIGN.spawns||[])[+selectedSpawn.slice(1)];
	const own=(typeof SPOTS!=='undefined'&&SPOTS[+selectedSpawn.slice(1)])?SPOTS[+selectedSpawn.slice(1)].own:sp.team;
	if(sp&&own===p.team){ sx=sp.x; sz=sp.z; }
	else { sx=sBase.x; sz=sBase.z; }
	}
	else if(selectedSpawn==='CV'){ const pt=convoyDeployPt(); sx=pt.x; sz=pt.z; }
	else if(selectedSpawn===-1||typeof selectedSpawn==='string'){ sx=sBase.x; sz=sBase.z; }
	else {
	const f=FLAGS[selectedSpawn];
	if(f.owner!==p.team){ sx=sBase.x; sz=sBase.z; }
	else { sx=f.x; sz=f.z; }
	}
// 玩家落点 (2026-09-19): 走与 Bot 同一套落点选择 —— 落点也避开建筑足迹/地铁下沉区,
// 并尽量离同队最近邻远一点 (不再叠进出生点人堆里)。玩家选了点位语义仍然保留 (优先落点在所选点位圈内)。
const lp=(typeof pickSpawnPoint==='function'&&typeof pickSpawnFor==='function')
? pickSpawnPoint(p.team,{x:sx,z:sz,base:isBaseSpot(),r:12})
: null;
const fp2=lp?[lp.x,lp.z]:findFreeSpawn(sx,sz);
// 全海图 (P4): 出生参考点在大舰甲板上 ⇒ 落点夹进甲板矩形 (否则环采样会把一半落点甩到舷外海面)
// ★2026-10-03 (P0 级补参): 旧版漏传第 5 参 team —— 参考点不在甲板上 (全队大舰瘫痪后 basePos 回退
//   静态 BASES 海点 / 部署到已瘫舰场景) 时, 无 team 就没有"夹进本队旗舰甲板"的兜底 ⇒ 玩家直接
//   出生在水面上 standHeight 给出的**海床**上, 每次部署都是水下出生 → 溺水 ×3 的死亡循环。
//   (Bot 路径 14-bots.spawn 一直传着 team, 玩家路径漏了 —— 同一函数两条调用链只差这一个实参。)
if(typeof capSnapToDeck==='function'){ const sn=capSnapToDeck(fp2[0],fp2[1],sx,sz,p.team); if(sn){ fp2[0]=sn.x; fp2[1]=sn.z; } }
p.pos.set(fp2[0],0,fp2[1]);
p.pos.y=(typeof capSpawnGroundY==='function')?capSpawnGroundY(p.pos.x,p.pos.z,10):standHeight(p.pos.x,p.pos.z,10);  // P4: 全海图甲板出生 (无大舰时逐位等价)
// 观战专属载具 (2026-09-26H 用户裁定): 部署时**不做任何预置** —— 旧版在这里 (以及 buildSpawnList 里)
// 把幽灵坦克召到落点/主基地旁, 于是"观战者的白车"一开局就停在场地上。现在车只在按 F 时按需显形
// (20-player tryInteract ③ → specVehSummon: 就位在脚下并直接上车), 这里一行也不做。
p.vel.set(0,0,0);
p.hp=100; p.alive=true; p.deployed=true; p.crouch=false; p.prone=false; p.chute=false;
p.protUntil=nowT+SPAWN_PROT; // 出生保护 (2026-09-28 阶段三 P1): 落地 0.5s 免伤 (与 Bot spawn() 同一口径), 开火即解除
p.demolish=null; // 上一局的拆除读条不跨命 (updateDemolish 的 alive 闸之外再加一道部署复位)
// A#8 契约 §7: 所有 player.chute=false 的写入点必须**同帧**收伞 —— 旧写法只在下一帧的 else 分支里摘,
// 于是部署那一帧伞还挂在头顶 (typeof 守卫: 只加载部分脚本的沙箱没有 20-player, 不该因此报错)。
if(typeof playerChuteClear==='function') playerChuteClear();
p.stamina=1; p.suppressV=0; p.bloom=0;
// 潜水态字段随部署复位 (★2026-09-26E 审计 31): diveD/oxy/_drownAcc/headDepth 此前**全库唯一**复位点
// 是 15d-naval 的弃船 (crewOut) —— 潜水溺死后这条命带着 diveD(最多 4m) 进下一局: 一入水就被拽到
// 水面下 (4+1.32)m、泳速长期吃 ×0.85、呼吸条显示空条。与 stamina/hp 同段清, 口径即"新命=新身体"。
p.diveD=0; p.oxy=1; p._drownAcc=0; p.headDepth=-1;
p.yaw=Math.atan2(-sx,-sz); p.pitch=0;
const wkeys=playerClassWeapons(p.team,p.cls);
const gear=clsGear(p.cls,p.team);
p.slots=wkeys.map(k=>({key:k,def:WPN_DEFS[k],mag:WPN_DEFS[k].mag,reserve:WPN_DEFS[k].reserve}));
p.curSlot=0; p.curW=p.slots[0];
p.nadeCount=gear.nades;
p.atNades=gear.atn;
p.maxBandages=CLASSES[p.cls].bandages||4; // 2026-09-06 B7a/P2-13: 绷带上限进兵种表, 文案/数值同源
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
// 海战舰船座位随部署复位 (2026-09-20N 海战批): 在艇上阵亡/直接改部署点时, 座位必须交还 ——
// 否则 player.onNaval 停在上一台艇上, 下一帧 updatePlayerNaval 会把刚落地的人重新钉回那条艇。
if(p.onNaval){ if(typeof navalSeatRelease==='function') navalSeatRelease(false); else p.onNaval=null; }
// A#9 岸防炮座位随部署复位 (与上面 onNaval 同型): 在炮位上阵亡/直接改部署点时, 炮位占用必须交还 ——
// 否则 player.onBattery 停在上一门炮上, 复活后 updatePlayerBattery 会把刚落地的玩家重新钉回炮位。
if(p.onBattery){ if(typeof batteryDismountPlayer==='function') batteryDismountPlayer(); else p.onBattery=null; }
// ★2026-10-03: 大舰座位/炮位账随部署复位 (与上面 onNaval/onBattery 同族) —— 上一命在甲板炮位上
// 阵亡后, capitalGun/onCapital 若不清, capGunTick 会把新命当作"仍在操炮"继续开火 (幽灵炮位);
// onCapital 残留还会让 capPlayerTick 拿旧舰的甲板高做落水判据。
p.onCapital=null; p.capitalGun=null;
p.onVehicle=null; p.onMG=null; p.onAT=null; p.onAA=null; p.tankView=false; p.braced=false;
document.getElementById('heatWrap').style.display='none';
vmEquip(p.curW.key,p.team);
VM.root.visible=true;
if(p.cls===4) showScorePop('工程兵 · 按 5 选工事 · B 建造(靠近自己工事 B 读条拆除退点) · 6 架设/读条回收迫击炮');
else if(isLoiterClass()) showScorePop('巡飞弹兵 · 左键发射后进入TV制导 · 按 6 扔燃烧弹');
if(vehSpawn){
// 海战载具 (kind 'amph'|'boat'): 座位初始化走 navalBoard 单源 (与"走到艇边按 F"同一份代码),
// 车组交还/玩家态/武器槽暂存都在那里 —— 这里不再按坦克那套写一遍 (那是第二条上船路径, 正是要避免的)。
const isNaval=(vehSpawn.kind==='amph'||vehSpawn.kind==='boat');
if(vehSpawn.crewBot&&!isNaval){
const cb=vehSpawn.crewBot;
if(vehSpawn.kind==='plane'){
vehSpawn.crewBot=null;
cb.onVehicle=null;
// A#8 契约 §7: 用 chuteBegin 统一开伞 (同帧置 chuting/chute/onGround 三态, 与玩家 p.chute 口径一致);
// 旧版只写 cb.chuting=true, 缺 chute/onGround 会让 chuteAirborne() 判不出"伞降中"。
// ★2026-10-03 (纯海图): 被顶掉的 AI 飞行员旧版一律跳伞 —— 舰载机的停放/巡航点都在海上,
// 伞兵落水后 seaSwimDrain 7.7s 耗尽 → 溺亡, 玩家每征用一次飞机就白沉一个兵 + 一票。
// 有大舰就把他放到本队舰甲板上 (capSnapToDeck 的 team 兜底会挑最近本队舰); 无大舰保持跳伞。
let decked=false;
if(typeof capitalShips!=='undefined'&&capitalShips.length&&typeof capSnapToDeck==='function'){
const sn3=capSnapToDeck(vehSpawn.pos.x,vehSpawn.pos.z,vehSpawn.pos.x,vehSpawn.pos.z,vehSpawn.team);
if(sn3){
decked=true;
cb.pos.set(sn3.x,(typeof capSpawnGroundY==='function')?capSpawnGroundY(sn3.x,sn3.z,10):10,sn3.z);
cb.mesh.root.visible=true; cb.path=null; cb.state='idle'; cb.target=null;
if(typeof cb.pickObjective==='function') cb.pickObjective();
}
}
if(!decked){
if(typeof cb.chuteBegin==='function') cb.chuteBegin(vehSpawn.pos.x,Math.max(vehSpawn.pos.y-2,heightAt(vehSpawn.pos.x,vehSpawn.pos.z)+3),vehSpawn.pos.z);
else { cb.chuting=true; cb.pos.set(vehSpawn.pos.x,Math.max(vehSpawn.pos.y-2,heightAt(vehSpawn.pos.x,vehSpawn.pos.z)+3),vehSpawn.pos.z); cb.mesh.root.visible=true; cb.path=null; cb.state='idle'; cb.target=null; }
}
} else cb.dismountVehicle(false);
}
if(isNaval){
if(typeof navalBoard==='function') navalBoard(vehSpawn,true);
} else {
vehSpawn.playerDriven=true;
if(vehSpawn.kind==='tank'){ vehSpawn.isAI=false; vehSpawn.vel=0; p.yaw=vehSpawn.yaw+vehSpawn.turretYaw+Math.PI; }
else { p.yaw=vehSpawn.yaw+Math.PI; p.pitch=vehSpawn.pitch; }
p.onVehicle=vehSpawn;
p.pos.copy(vehSpawn.pos);
VM.root.visible=false;
document.getElementById('heatWrap').style.display='block';
}
}
document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden'));
el('blackOv').style.opacity=0;
if(p.spectator){ p.flying=false; p.flyAero=false; p._aeroSpd=0; }
lockPointer();
if(p.spectator) showScorePop('观战中 · 双击空格=悬停飞行 · H=气动飞行 · F=召唤幽灵坦克 · K=时停 · J=信息层');
// 落地 = 部署界面收起 (上面那句把全部 .screen 收进 hidden) → 立刻摘掉 inDeploy, 战斗 HUD 随之上场 (2026-09-20 第6条)
if(typeof syncDeployHud==='function') syncDeployHud();
}
// ===== 观战换装 (2026-09-17 观战扩展批, 用户裁定"即时生效 + 下次部署也生效") =====
// 开/关观战立刻把 2 号槽换成 / 换回该兵种的原副武器 —— 只动副武器槽, 主武器与其余装备原样,
// 当前正握着副武器时同步换模型 (vmEquip); 正在载具/阵位/控弹时不打断手里的东西, 只改槽位数据。
function applySpectatorLoadout(){
if(!player.slots||player.slots.length<2) return false;
const base=(TEAM_FACTION[player.team].cls[player.cls]||[])[1];
const want=player.spectator?'specsniper':base;
if(!want||!WPN_DEFS[want]) return false;
if(player.slots[1]&&player.slots[1].key===want) return false;
player.slots[1]={key:want,def:WPN_DEFS[want],mag:WPN_DEFS[want].mag,reserve:WPN_DEFS[want].reserve};
if(player.curSlot===1&&!player.onVehicle&&!player.onMG&&!player.onAT&&!player.onAA&&!player.onMortar&&!player.loiter){
player.curW=player.slots[1];
vmEquip(want,player.team);
}
showScorePop(t2('副武器: {0}',t2(WPN_DEFS[want].name)));
return true;
}
// ── 旗帜/强点初始归属 (2026-09-20 顺序修正) ──
// 原实现在 startMatch 内联, 且位置在开局批量生成**之后** —— FLAGS 初始 owner=-1 (05c-layouts 2276),
// 于是开局那批人算候选出生点位时一个旗都不归自己: 没有 CAMPAIGN.spawns 的地图候选点位数=1,
// 全队必然 100% 落在主基地 (实测诺曼底 10/10、胡康 13/13 —— 用户实报"开局全都在主基地及周边")。
// 现抽成函数并在批量生成前调用; 逻辑与赋值原样搬移 (幂等, 语义不变)。
function applyFlagOwnership(){
	// 旗帜初始归属 (征服: 优先读旗点显式 own 字段[斯大林格勒 14 点草图开局态势]; 无 own 时按就近归属;
	// 攻防/破袭: 防守方全部据守)
	// ★2026-10-02 实机"阵营栏一方显示灰色": 图标 DOM id 旧版用旗点名 (fi旗舰舰桥/fi前主炮…),
	//   而海战图两军的旗点**同名** (各有一组 前主炮/舰桥/后主炮) ⇒ id 重复, 后一军的图标
	//   el('fi'+id) 永远查到前一军那个, 自己的从未被 updateHUD 更新, 停留在建出来时的无 class
	//   态 (= CSS 的灰底灰字) —— "一方显示灰色而非该有的蓝/红"。id 改按 FLAGS 索引, 与
	//   22-hud updateHUD 的 el('fi'+i) 同一序 (forEach 双参), 陆战图 A..E 也逐位兼容。
	el('flagIcons').innerHTML=FLAGS.map((f,i)=>`<span id="fi${i}">${f.id}</span>`).join('');
	if(GAMEMODE==='conquest'){
	if(FLAGS.some(f=>f.own!==undefined)){
	// 显式归属 (2026-09-06 斯大林格勒改版): 两翼 home 点开局各归其主, 中央拉锯带中立 —— 草图开局态势
	FLAGS.forEach(f=>{ if(f.own!==undefined){ f.owner=f.own; drawFlagTex(f); } });
	}else if(FLAGS.length){
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
	// 归属判据单源 (2026-09-26): 00-config attackerFlagPicks —— 05c defWorks 摆工事时读**同一支**
	// (攻方开局旗圈里不落守方工事), 两处永不脱钩; 这里的采样语义与旧写法逐位一致 (同一排序/同一批)。
	for(const f of attackerFlagPicks(FLAGS)){ f.owner=ATK; drawFlagTex(f); }
	}
	// 防守方兵力=进攻方×1.25 (2026-09-05 用户指定下调: 防守优势改由"防御工事模板"承担阵地强度,
	// 人数只保留小幅倾斜; 原为 ×1.75, 阵地+人海双优势过重)
	tickets[DEF]=Math.round(tickets[ATK]*1.25);
// 攻防限时: 默认 18 分钟; 战役条目 matchMin 覆盖 (柏林大地图 22 分钟)
// ★2026-10-04 (海战审计 F4): 征服分支旧版写死 16*60 —— coral matchMin:20 是死配置。与攻防/遭遇
//   同一口径: 战役条目覆盖, 缺省 16 (既有陆战征服图无 matchMin 的逐位不变)。
matchTime=GAMEMODE==='assault'?((CAMPAIGN.matchMin||18)*60):((CAMPAIGN.matchMin||16)*60);
	} else if(GAMEMODE==='clash'){
	// 遭遇战: 无旗点, 兵力打空者败; 限时默认 15 分钟, 战役条目 matchMin 覆盖 (草原库尔斯克 640 大图 22 分钟)
	matchTime=(CAMPAIGN.matchMin||15)*60;
	} else if(GAMEMODE==='convoy'){
	// 劫道: 双方兵力均为标准相等有限票 (胜负仍看车队), 16分钟限时
	matchTime=16*60;
	supplyClockStart(); // 劫道方临时补给点寿命计时从开局起算 (owner 接口)
	}
}

// ═════ 海战载具开局编制 (2026-09-20N 海战批, owner: naval-crew) ═════
// 数据源 (单源纪律): CAMPAIGN.island.navalN=[两栖车, 艇] per team (00-config) + CAMPAIGN.sea.muster
//   ([team0 南湾外海, team1 北湾外海]); 本函数不写死任何坐标、不另写水深/岸线算术。
// 重生点位口径 (定稿 §6.2): pos = muster[team] + 队内序号横向错位 22m, 朝向 = muster.face (面向本方海湾)。
//   横向 = 艏向的垂直方向 —— 本仓库 yaw→方向约定 forward=(sin,cos) (见 15-vehicles Tank.aimDir) ⇒ lat=(cos,-sin)。
// 为什么这里显式再落一次位: 15d-naval 的 respawn(initial) 走同一公式 (两处一致、互为佐证); 而万一 15d 的
//   构造器不自落位, 载具会停在 (0,0) —— 那是岛中央, 开局即搁浅。显式落位让"开局编制位置"同源可控。
function navalMusterSpot(team,ord){
const mu=(SEA&&SEA.muster&&SEA.muster[team])||null;
if(!mu) return null;
const face=mu.face||0;
const lat=[Math.cos(face),-Math.sin(face)];              // 艏向垂直 (横向铺开轴)
// 队内序号错位间距: 读 15d 的单源 NAVAL_SPAWN_GAP (★2026-09-26E 审计 11 —— 旧版这里写死 22, 而 15d 的
// navalSpawnPoint 自带另一套"全队居中"公式 (永不执行) ⇒ 两处注释都自称单源、实际两套算术)。
const gap=(typeof NAVAL_SPAWN_GAP==='number')?NAVAL_SPAWN_GAP:22;
const off=ord*gap;
const x=mu.x+lat[0]*off, z=mu.z+lat[1]*off;
// ★2026-09-26E (审计 10): 落位高度 = 水面 − **吃水** —— 旧版只写水面高 ⇒ 10 台舰艇开局全部浮高
// 0.4~0.95m, 再由 15d 的 _attitude 阻尼 (k=9) 在 0.3~0.5s 内"沉"下去 (玩家选"⚓ PT 艇"出生能直接看到
// 这个下沉弹跳)。吃水单源 = 15d 的 navalDraftOf (typeof 守卫: 未加载时退化为 0, 即旧行为)。
const y=(typeof waterYAt==='function')?waterYAt(x,z):0;  // 落位水面高 (03-terrain 单源, 严禁另写); 吃水由调用方按艇扣除 (见 spawnNavalOrbat)
return {x,y,z,face};
}
// 每队: navalN[0] 台两栖车 (美 lvt / 日 kami) + navalN[1] 艘艇 (美 pt / 日 gyorai), 车组由调用方循环配。
// 队内序号 ord = 两栖车 0..n0-1, 艇接着排 —— 与 Tank 的 ord 同义 (供 15d 的重生/落位错位口径共用)。
function spawnNavalOrbat(){
const nN=CAMPAIGN.navalN||NAVAL_ORBAT_DEF;    // [两栖车, 艇] per team
const n0=Math.max(0,nN[0]|0);
const keys=[['lvt','kami'],['pt','gyorai']];  // 索引 0 = 两栖车 (kind 'amph'), 1 = 艇 (kind 'boat')
for(let t=0;t<2;t++) for(let k=0;k<2;k++){
const n=Math.max(0,nN[k]|0);
for(let i=0;i<n;i++){
const ord=(k===0?0:n0)+i;
const c=new NavalCraft(keys[k][t],t,ord);
const sp=navalMusterSpot(t,ord);
if(sp){
// ★2026-09-26E (审计 10): 落位高度 = 水面 − **吃水** (15d navalDraftOf 单源) —— 旧版写水面高,
// 10 台舰艇开局全部浮高 0.4~0.95m 再由 _attitude 阻尼 (k=9) 在 0.3~0.5s 内沉下去
// (玩家选"⚓ PT 艇"出生能直接看到这个下沉弹跳)。与 15d respawn 的物理基准 pos.y=wy-draft 逐式对齐。
const dy=(typeof navalDraftOf==='function')?navalDraftOf(c):0;
const py=sp.y-dy;
c.yaw=sp.face;
if(c.pos&&c.pos.set) c.pos.set(sp.x,py,sp.z);
if(c.baseY!==undefined) c.baseY=py;
if(c.grp){ c.grp.position.set(sp.x,py,sp.z); c.grp.rotation.y=sp.face; }
}
}
}
}
// 海战载具车组补配单源 (★2026-09-26E 审计 1): 开局编制与运行期补配共用这一支。
// 判据与坦克的 pickIdleDeployVehicle 同规 (活着/同队/无乘员/非玩家驾驶/未沉没/血量≥40%),
// 外加海战特有的 state 门 (sinking/wreck 不配人 —— 15d 的 drive 门 (driverBot||crewBot) 会让
// 残骸继续"有人", 且救不回来)。返回补配台数 (供探针断言)。
// 补配 Bot 的取名 (startMatch 的 nextName 是它的**局部闭包**, 提到模块级就看不见了 ⇒ 这里自取一份;
// 名字纯观感、不参与任何判据, 用一个模块级计数器错开, 与开局那批不重名)。
let _crewNameI=[0,0];
function crewBotName(team){
let nm=["车组"];
try{ if(typeof TEAM_FACTION!=="undefined"&&TEAM_FACTION[team]&&TEAM_FACTION[team].names) nm=[...TEAM_FACTION[team].names]; }catch(e){}
return nm[(_crewNameI[team]++)%nm.length];
}
function navalCrewFill(){
if(typeof navalCraft==='undefined'||!Array.isArray(navalCraft)) return 0;
let n=0;
for(const c of navalCraft){
if(!c||!c.alive) continue;
if(c.crewBot||c.driverBot||c.playerDriven) continue;   // 已有车组 / 玩家已在驾驶 → 不重复配人
if(c.state==='sinking'||c.state==='wreck') continue;
if(c.hp<(c.maxHp||c.hp||1)*0.4) continue;
const b=new Bot(c.team,CLS_POOL[randi(0,CLS_POOL.length-1)],crewBotName(c.team));
b.spawnInVehicle(c);
n++;
}
return n;
}
function startMatch(){
// 场景台账边界 (2026-09-16 本批): 此刻 world 里全是从 CAMPAIGN 生成的布局对象, 之后新增的都属于"本局"
// (工程兵工事/迫击炮/医疗箱/残骸…)。就地换局时 retireMatchActors 按这条边界整段摘除, 不必逐个系统去记。
// 只在第一次开局时记录: 换局时沿用首次的边界值, 才能把"上一局新增的一切"连同本局新增一起清掉。
if(typeof window.__sfMatchWorldStart!=='number') window.__sfMatchWorldStart=world.children.length;
const names0=[...TEAM_FACTION[0].names].sort(()=>Math.random()-0.5);
const names1=[...TEAM_FACTION[1].names].sort(()=>Math.random()-0.5);
const nameIdx=[0,0];
const nextName=t=>(t===0?names0:names1)[nameIdx[t]++%(t===0?names0:names1).length];
	// 开局批量生成的位置修正 (2026-09-20): 归属必须先算, 否则候选出生点位只剩主基地 1 个。
	applyFlagOwnership();
		// 大舰编制 (P4 2026-09-30; ★2026-10-01b 改"载入期已生成, 此处只复位"): 全海图的"陆地"只有舰甲板 ——
		//   大舰现在在 24-main 启动段 (capturePristineWorld 快照之前) 就已生成, 主菜单航拍能看到编队巡航。
		//   开局时若已在场 ⇒ capitalEnsureOrbat 走 capitalReset 复位+重绑甲板旗; 不在场 (探针/旧路径) ⇒ 照旧生成。
		//   Bot 出生 (14-bots spawn) 与舰载机停放 (capParkPlanes) 都要按队找到本队大舰并把落点吸附上去,
		//   晚一步就是"兵落海 / 飞机还在天上"的静默降级 (capSnapToDeck 与 capParkPlanes 都按空表早退)。
		//   非海战图 capSpawnList 为空 ⇒ 一个对象都不建, 既有 13 张图零变化。
		if(typeof capitalEnsureOrbat==='function') capitalEnsureOrbat();
		else if(typeof capitalSpawnOrbat==='function') capitalSpawnOrbat();   // 只载部分脚本的沙箱兜底
	for(let t=0;t<2;t++){
	const bMul=CAMPAIGN.botMul||[1,1];
	const bN=[Math.max(2,Math.round(BOTS_PER_TEAM*bMul[0])),Math.max(2,Math.round(BOTS_PER_TEAM*bMul[1]))];
	const n=bN[t]-(t===player.team?1:0);
	// 劫道方(ATK)反坦克火力翻倍: 兵种池偏向反坦克兵 (2026-09-28 兵种 8→5 重映射: 反坦克=3, 工程=4)
	const AT_POOL=[0,0,1,1,2,3,3,3,3,3,4,4,4,4];
	const pool=(GAMEMODE==='convoy'&&t===ATK)?AT_POOL:CLS_POOL;
	for(let i=0;i<n;i++){
	const cls=pool[randi(0,pool.length-1)];
	const bot=new Bot(t,cls,nextName(t));
	bot.spawn();
	}
	}
// 组建玩家小队: 挑3名本方步兵
// 2026-09-19 修正: 排除坦克乘员 —— 旧版按数组顺序取人, 而 soldiers 里最前面几个正是
// startMatch 为坦克/战机配的车组 (spawnInVehicle 在步兵之后创建), 于是小队名额被车组占掉:
// 3 名队员一直"随车"不在玩家身边, 小队指令形同虚设。
// 2026-09-21 A#7: 三人车组的司机 (crewBot, onVehicle 非空) 同样排除 —— 车组不进小队。
// (契约 §4 v3: 后 2 人是 Tank.crewSlots 轻量名额, 不在 soldiers 里, 无需在此排除)
for(const s of soldiers){
if(SQUAD.members.length>=3) break;
if(s.team===player.team&&!s.onVehicle&&!s.pilotOf&&!s.inSquad&&!s.capCrew){   // capCrew: 大舰炮手不进小队 (2026-10-01c)
s.inSquad=true;
SQUAD.members.push(s);
s.mesh.tag.material.color.set(0x86ffa6);
// 开局站位: 以玩家为圆心均匀铺开 (旧版直接贴玩家落点, 3 个人叠在 1m 内)
const ang=(SQUAD.members.length-1)/3*TAU+rand(-0.3,0.3);
const rr=rand(6,9);
const wx=player.pos.x+Math.cos(ang)*rr, wz=player.pos.z+Math.sin(ang)*rr;
if(!occBlocked(wx,wz)&&(typeof freeSpot!=='function'||freeSpot(wx,wz,0.6))){
// 死袋闸 (2026-09-26 补): 小队这 3 人走的是**独立落点** (不经 pickSpawnPoint), 旧版只查站得住 ——
// 实测他们会落进 1 格死袋/封锁格 (诺曼底/塔拉瓦各抓到), 而那是最显眼的三个"站在玩家身边的木头人"。
// 与出生筛选同源: NAV.spawnSpot 把落点就近搬到"走得出去"的位置 (最多 12m, 小队仍在玩家视野内)。
let sx=wx, sz=wz;
if(typeof NAV!=='undefined'&&NAV.spawnSpot){ const sp=NAV.spawnSpot(wx,wz,12); sx=sp[0]; sz=sp[1]; }
s.pos.set(sx,0,sz); s.pos.y=(typeof capSpawnGroundY==='function')?capSpawnGroundY(sx,sz,12):standHeight(sx,sz,12);  // P4: 甲板上铺开小队
}
s.pickObjective();
}
}
	// 坦克数量: 按战役配置 (默认每队2辆; 遭遇战翻倍; 劫道护运方有坦克/劫道方无)
	const tN=CAMPAIGN.tankN||[2,2];
	for(let t=0;t<2;t++) for(let v=0;v<tN[t];v++) new Tank(t,v%2);
	// 飞机数量 (2026-09-20N 海战批): 删掉旧硬编码的 4 架 (new Plane(0,0);new Plane(0,1);new Plane(1,0);
	//   new Plane(1,1);), 改读战役数据表 CAMPAIGN.airN —— 塔拉瓦 airN=1 (用户裁定"飞机也缩减"
	//   ⇒ 全图 1 架, 全归主攻方美军 team0)。
	//   **未给 airN 的其余 12 张图退回改造前的旧编制 (每队 2 架)** —— 这一条不能省: "其余 12 张图零行为
	//   变化"是验收红线 1, 顺手把 12 图的飞机从 4 架砍成 1 架就是实打实的行为漂移 (与下面海战守卫同理)。
	const airT=CAMPAIGN.airN;
	// P4 (2026-09-30): airN 允许写成数组 = **双方**各多少架 (全海图两边都从自家航母起飞, 没有"只有攻方有
	//   飞机"的不对称可言)。标量仍旧口径 [airT,0] = 只有攻方有飞机 —— 既有 13 张图逐字不变。
	const airPerTeam=Array.isArray(airT)?[airT[0]|0,airT[1]|0]:((airT===undefined)?[2,2]:[airT,0]);
	for(let t=0;t<2;t++) for(let v=0;v<airPerTeam[t];v++) new Plane(t,v%2);
	// 舰载机开局停放到本队航母飞行甲板 (P4 2026-09-30 用户裁定① 简化起降): 此刻大舰已在上面生成好。
	//   无航母的战役: 本函数首行返回 0, 飞机保持"基地上空 40m"的既有出生口径 (既有 13 图零变化)。
	if(typeof capParkPlanes==='function') capParkPlanes();
	// 海战载具编制 (2026-09-20N 海战批, 用户裁定"每队 2 坦克 + 2 两栖车 + 3 艇"): 只在有海面且战役显式
	//   给了 navalN 的图生成 (塔拉瓦); 其余 12 图 SEA=null ⇒ 零海战载具、零新增世界对象。
	//   typeof 守卫: 15d-naval 未加载的脚本链 (dev/verify-boot 的 12 图 LOAD 断言、部分探针) 不许因它报错。
	if(SEA&&CAMPAIGN.navalN&&typeof NavalCraft==='function') spawnNavalOrbat();
	// 大舰编制 (2026-09-30 阶段五 P4): 由战役的 CAMPAIGN.capital 声明 (声明序 = 索引, 甲板旗点用 ship:<索引>
	//   回指)。与大舰同批生成的还有甲板旗点绑定 (capitalFlagBind: 把旗位换算成舰体局部坐标, 之后由
	//   updateCapital → capitalFlagTick 每帧跟随)。非全海图战役 capSpawnList() 为空 ⇒ 一个对象都不建。
	// 劫道模式: 沿公路生成护运车队 (纯AI, 不可驾驶)
	if(GAMEMODE==='convoy'&&CAMPAIGN.convoy) spawnConvoy(CAMPAIGN.convoy);
// 每车 1 名真实 AI 车组 (契约 §4 **v3 修订**: 三人的"人"不从士兵池里出)。
// v3 口径: 每车 = 1 名真实 Bot 驾驶员 (crewBot, 唯一跑 AI 的) + 2 个"乘员名额"(Tank.crewSlots 轻量记录,
// 由 tank-core 建/结算, 不算独立士兵) —— 所以这里**只创建 1 名 Bot**。
// 为什么: 各图 tankN=2~8 而 BOTS_PER_TEAM=11, 若每车配 3 名真 Bot, 诺曼底一队 11→21 人、斯大林格勒 14→30 人,
// 是用户未要求的平衡破坏。**全队 soldiers.length 必须与改造前一致** (本条的验收红线之一)。
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
// 海战载具车组 (2026-09-20N 海战批): 每台艇/两栖车配 1 名 Bot —— 与坦克同款 spawnInVehicle(载具)。
// **不实现任何载人/卸兵/跳板放人机制** (用户裁定"不要有运兵船, 只有战斗船。两栖车也一样"):
// 一台载具永远只有 1 名车组, 没有乘员舱位、没有待卸步兵队列、没有抢滩放人脚本。
// ★2026-09-26E (审计 1): 从 startMatch 里抽成**可重入**的单源 navalCrewFill() —— 旧版只写死在这里,
//   是全库唯一一次配车组 ⇒ 艇的车组一旦被玩家接管 (20a 上艇即遣散车组) 或随艇沉没落水, 该艇永久
//   变成"漂在集结点、不动、不开火的空壳", 被击沉还照扣 4~5 票 (每台空艇每 ~60s 白送票)。
//   现在 15d 的 respawn() 与 14-bots 的部署扫描都调它 (与坦克的"车上认领 + 部署认领"两条路同规)。
navalCrewFill();
// 本页已开过局的标记 (2026-09-16 本批): 对局实体只增不减, 就地重开前必须先让上一局整体退场 ——
// beginFreshMatch (22-hud) 据此判断"世界还干净, 直接开局"还是"已经开过一局, 要先 retireMatchActors 退场"
window.__sfMatchSpawned=true;
}
