// ─────────────────────────────────────────────
// 00-config.js —— 全局配置/工具函数
// 源: Index.original.html 第 343-500 行
// ─────────────────────────────────────────────
'use strict';
const V3 = (x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
const lerp=(a,b,t)=>a+(b-a)*t;
const rand=(a,b)=>a+Math.random()*(b-a);
const randi=(a,b)=>Math.floor(rand(a,b+1));
const TAU=Math.PI*2, HPI=Math.PI/2;
const dampF=(cur,tgt,k,dt)=>lerp(tgt,cur,Math.exp(-k*dt));
const SETTINGS = { team:0, diff:1, quality:1, sens:1.0, vol:0.8 };
// 阵营/难度持久化: 选战役自动开局后仍沿用上次选择 (hmul 见下行)
SETTINGS.team=clamp(parseInt(localStorage.getItem('sf_team')||'0')||0,0,1);
SETTINGS.diff=clamp(parseInt(localStorage.getItem('sf_diff')||'1')||1,0,2);
const DIFF_TABLE = [
{ react:0.85, spreadMul:1.7, dmgMul:0.7, visMul:0.8, name:'新兵' },
{ react:0.5,  spreadMul:1.0, dmgMul:1.0, visMul:1.0, name:'老兵' },
{ react:0.28, spreadMul:0.6, dmgMul:1.25, visMul:1.25, name:'精英' },
];
// ===================== 战役 / 阵营 / 环境主题 =====================
// 每个战役: 独立地形结构(terr) + 独立布局(layout) + 专属玩法(mode) + 旗点/基地/道路/战壕
const CAMPAIGNS=[
{ id:'normandy', title:'诺曼底 1944', sub:'乡野田园 · 树篱丛生', f:['us','ger'], theme:'green',
terr:'rolling', layout:'rural', mode:'assault', atk:0, modeName:'攻防·盟军进攻',
flags:[{id:'A',x:-70,z:22,r:13},{id:'B',x:-26,z:-66,r:13},{id:'C',x:3,z:8,r:14},{id:'D',x:30,z:68,r:13},{id:'E',x:74,z:-29,r:13}],
bases:[{x:-142,z:0},{x:142,z:0}], sineRoad:true,
roads:[[-70,22,-52,8],[74,-29,52,-8]],
trench:[[-52,4,-30,-8],[36,2,58,14]],
tankN:[5,5], // 2026-09-02 载具数按战区统一: 西欧=5
// 博卡日农田: 田块表 (色带/庄稼软遮蔽/断续树篱共用) —— 主路与村庄留中央走廊, 南北两畦田
fields:[
{x0:-104,z0:-94,x1:-58,z1:-46,t:'wheat'},{x0:-4,z0:-66,x1:44,z1:-26,t:'wheat'},
{x0:-102,z0:46,x1:-50,z1:96,t:'wheat'},{x0:52,z0:48,x1:108,z1:92,t:'wheat'},
{x0:-64,z0:-112,x1:-10,z1:-84,t:'corn'},{x0:48,z0:-72,x1:104,z1:-40,t:'corn'},
{x0:-40,z0:34,x1:2,z1:92,t:'corn'},{x0:6,z0:92,x1:50,z1:116,t:'corn'},
{x0:-54,z0:-46,x1:-14,z1:-18,t:'pasture'},{x0:64,z0:-108,x1:108,z1:-80,t:'pasture'},
{x0:-42,z0:14,x1:-16,z1:32,t:'pasture'},{x0:54,z0:16,x1:82,z1:44,t:'till'} ] },
{ id:'stalingrad', title:'斯大林格勒 1942', sub:'严冬巷战 · 废墟工厂', f:['sov','ger'], theme:'winter',
terr:'urban', layout:'stalingrad', mode:'conquest', atk:0, modeName:'征服·五点争夺', cold:true,
flags:[{id:'A',x:-62,z:20,r:13},{id:'B',x:-20,z:-26,r:13},{id:'C',x:4,z:12,r:14},{id:'D',x:42,z:-18,r:13},{id:'E',x:72,z:26,r:13}],
bases:[{x:-142,z:0},{x:142,z:0}], sineRoad:false,
roads:[[-142,0,-62,20],[-62,20,-20,-26],[-20,-26,4,12],[4,12,42,-18],[42,-18,72,26],[72,26,142,0]],
trench:[[-42,-34,-20,-44],[24,32,46,24]],
tankN:[7,7],
// 城市语义分区表 (2026-09-05 城市改造): 街道矩形(色带/小地图/建筑避让) + 街块(沿街成排落屋) + 电车道
// 街道=矩形带, 建筑只在街块内落位且距街缘≥3m → 街廊保底可通行 (Bot/坦克/玩家通用)
city:{
// 东西主街(电车街) + 三条南北街道 + 车站广场, 均避开旗心(flat 圈内自然留白)
streets:[
{x0:-124,z0:8,x1:124,z1:22},
{x0:-44,z0:-108,x1:-28,z1:108},
{x0:18,z0:-108,x1:34,z1:108},
{x0:52,z0:-108,x1:68,z1:108} ],
// 街块: 沿街成排落屋区 (块内距街缘≥2.5m 才允许放建筑); 东北角留给红十月工厂区(不设街块)
blocks:[
{x0:-100,z0:-30,x1:-48,z1:2},{x0:-100,z0:26,x1:-48,z1:64},
{x0:-26,z0:-52,x1:14,z1:-6},
{x0:36,z0:-52,x1:50,z1:0},{x0:36,z0:26,x1:50,z1:62},
{x0:70,z0:26,x1:110,z1:64},
{x0:-124,z0:26,x1:-104,z1:60} ],
avenue:{axis:'x',z:15}, // 电车轨道线 (主街 z≈15)
// 红十月工厂区: D 旗东北 (围墙厂区 70..112,-70..-8, 布局函数 layoutStalingrad 内 redOctober(90,-38))
landmark:'redOctober',
// 厂区地面矩形 (略大于围墙): 建成区判定用 —— 厂区压土色+不长草 (03-terrain cityUrban / 05c 植被让位)
yard:{x0:68,z0:-72,x1:114,z1:-6} } },
{ id:'berlin', title:'柏林 1945', sub:'帝国末日 · 逐街攻坚', f:['sov','ger'], theme:'ruin',
terr:'urban', layout:'berlin', mode:'assault', atk:0, modeName:'攻防·苏军进攻',
flags:[{id:'A',x:-74,z:10,r:13},{id:'B',x:-26,z:-16,r:13},{id:'C',x:22,z:18,r:14},{id:'D',x:74,z:-8,r:13}],
bases:[{x:-142,z:0},{x:142,z:0}], sineRoad:false,
roads:[[-142,0,-74,10],[-74,10,-26,-16],[-26,-16,22,18],[22,18,74,-8],[74,-8,142,0]],
trench:[[-48,26,-28,36],[46,-26,66,-32]],
tankN:[7,7],
// 城市语义分区表 (2026-09-05): 同斯大林格勒结构; 柏林更荒芜, 主街横贯 + 三条纵街
city:{
streets:[
{x0:-124,z0:-4,x1:124,z1:8},
{x0:-60,z0:-110,x1:-44,z1:110},
{x0:-8,z0:-110,x1:8,z1:110},
{x0:36,z0:-110,x1:52,z1:110} ],
blocks:[
{x0:-96,z0:12,x1:-62,z1:56},{x0:-96,z0:-42,x1:-62,z1:-10},
{x0:-40,z0:-52,x1:-12,z1:-12},
{x0:10,z0:-46,x1:34,z1:-2},{x0:10,z0:14,x1:34,z1:56},
{x0:54,z0:-44,x1:104,z1:-12},{x0:54,z0:12,x1:104,z1:56} ],
metro:{x:-52,z:2,r:5.5,d:0.9}, // 地铁下沉广场 (V1×主街十字路口, B旗地铁广场; 深度0.9保证坡面可走)
defSide:1 } }, // 防守方=德军(东侧): 街垒/机枪/铁丝网防御工事模板生效侧; 2026-09-02 载具数按战区统一: 东欧=7
{ id:'songhu', title:'淞沪会战 1937', sub:'水乡血战 · 节节抵抗', f:['kmt','jp'], theme:'china',
terr:'delta', layout:'delta', mode:'assault', atk:1, modeName:'攻防·日军进攻',
flags:[{id:'A',x:72,z:-18,r:13},{id:'B',x:30,z:24,r:13},{id:'C',x:-12,z:-20,r:14},{id:'D',x:-60,z:12,r:13}],
bases:[{x:-142,z:0},{x:142,z:0}], sineRoad:false,
roads:[[142,0,72,-18],[72,-18,30,24],[30,24,-12,-20],[-12,-20,-60,12],[-60,12,-142,0]],
trench:[[52,-4,34,10],[10,4,-6,-10],[-34,2,-48,10],[-24,-32,-4,-38]],
tankN:[3,3] },
{ id:'baituan', title:'百团大战 1940', sub:'黄土沟壑 · 破袭铁路', f:['cpc','jp'], theme:'loess',
terr:'loess', layout:'loess', mode:'demolition', atk:0, modeName:'破袭·摧毁补给',
flags:[{id:'A',x:-50,z:-20,r:13},{id:'B',x:10,z:30,r:13},{id:'C',x:58,z:-24,r:13}],
bases:[{x:-142,z:0},{x:142,z:0}], sineRoad:false,
roads:[[-142,0,-50,-20],[-50,-20,10,30],[10,30,58,-24],[58,-24,142,0]],
trench:[[-64,-8,-44,-2],[-6,18,14,12],[40,-12,56,-4],[24,-40,44,-46]],
tankN:[3,3] },
{ id:'burma', title:'滇缅公路 1944', sub:'密林穿插 · 雨林争夺', f:['kmt','jp'], theme:'jungle',
terr:'jungle', layout:'jungle', mode:'conquest', atk:0, modeName:'征服·丛林四点',
flags:[{id:'A',x:-64,z:-28,r:14},{id:'B',x:-10,z:38,r:14},{id:'C',x:20,z:-42,r:14},{id:'D',x:66,z:24,r:14}],
bases:[{x:-142,z:0},{x:142,z:0}], sineRoad:false,
roads:[[-142,0,-64,-28],[-64,-28,20,-42],[20,-42,66,24],[66,24,142,0],[-64,-28,-10,38],[-10,38,66,24]],
trench:[[-32,-36,-12,-44]],
tankN:[3,3] },
{ id:'moscow', title:'莫斯科郊外 1941', sub:'雪岭松林 · 寒冬防线', f:['sov','ger'], theme:'alpine',
terr:'alpine', layout:'alpine', mode:'assault', atk:1, modeName:'攻防·德军进攻',
flags:[{id:'A',x:66,z:-18,r:13},{id:'B',x:22,z:26,r:13},{id:'C',x:-24,z:-26,r:14},{id:'D',x:-70,z:14,r:13}],
bases:[{x:-142,z:0},{x:142,z:0}], sineRoad:false,
roads:[[142,0,66,-18],[66,-18,22,26],[22,26,-24,-26],[-24,-26,-70,14],[-70,14,-142,0]],
trench:[[48,-8,32,6],[6,14,-10,2],[-42,-8,-56,4]],
tankN:[7,7] }, // 2026-09-02 载具数按战区统一: 东欧=7
{ id:'hukawng', title:'胡康河谷 1943', sub:'大龙河大桥 · 密林拉锯', f:['kmt','jp'], theme:'deepjungle',
terr:'deepjungle', layout:'deepjungle', mode:'conquest', atk:0, modeName:'拉锯·大桥五点',
flags:[{id:'西岸',x:-64,z:-14,r:13},{id:'桥西',x:-30,z:6,r:12},{id:'大桥',x:0,z:0,r:15},{id:'桥东',x:30,z:-6,r:12},{id:'东岸',x:66,z:16,r:13}],
bases:[{x:-142,z:0},{x:142,z:0}], sineRoad:false,
roads:[[-142,0,-64,-14],[-64,-14,-30,6],[-30,6,0,0],[0,0,30,-6],[30,-6,66,16],[66,16,142,0]],
trench:[[-48,-30,-36,14],[22,-22,34,20]],
tankN:[3,3],
// 大龙河: 深谷激流纵贯南北, 大桥是唯一通道 (yaw 为桥轴向, 垂直于河道)
bridge:{x:0,z:0,len:26,w:7,yaw:1.713} },
// 无旗点战役 (虚构背景): 遭遇战 flags=[] (纯击杀/载具摧毁扣票), 劫道 flags=[] (胜负看车队)
{ id:'steppe', title:'草原遭遇 1943', sub:'无垠波地 · 装甲不期而遇', f:['sov','ger'], theme:'steppe',
terr:'steppe', layout:'steppe', mode:'clash', atk:0, modeName:'遭遇战·无目标绞肉',
flags:[], // 无旗点: 死亡/载具摧毁直接扣兵力, 打空者败
bases:[{x:-138,z:-96},{x:138,z:96}], sineRoad:false,
roads:[[-138,-96,-84,-58],[-84,-58,-36,-25],[-36,-25,36,25],[36,25,84,58],[84,58,138,96]],
trench:[[-50,-30,-16,10],[16,-12,50,32]],
spawns:[{x:-84,z:-58,name:'西南前哨',team:0},{x:-36,z:-25,name:'一线散兵坑',team:0},{x:36,z:25,name:'一线散兵坑',team:1},{x:84,z:58,name:'东北前哨',team:1}],
tankN:[7,7], botMul:[1,1] }, // 2026-09-02 载具数按战区统一: 东欧=7
{ id:'woodline', title:'雾林守线 1944', sub:'落叶雾林 · 节节设防', f:['us','ger'], theme:'woods',
terr:'woods', layout:'woods', mode:'assault', atk:1, modeName:'攻防·德军进攻',
flags:[{id:'A',x:-64,z:-16,r:13},{id:'B',x:-22,z:24,r:13},{id:'C',x:14,z:-14,r:14},{id:'D',x:52,z:20,r:13},{id:'E',x:82,z:-10,r:13}],
bases:[{x:-142,z:0},{x:142,z:0}], sineRoad:false,
roads:[[-142,0,-64,-16],[-64,-16,-22,24],[-22,24,14,-14],[14,-14,52,20],[52,20,82,-10],[82,-10,142,0]],
trench:[[-54,-28,-36,-12],[2,-30,20,-24],[38,6,54,0]],
tankN:[5,5] }, // 2026-09-02 载具数按战区统一: 西欧=5
{ id:'canyon', title:'断崖公路 1940', sub:'伏击山谷 · 劫道与反劫道', f:['cpc','jp'], theme:'mountain',
terr:'mountain', layout:'canyon', mode:'convoy', atk:0, modeName:'劫道·车队全毁或突围',
flags:[], // 无旗点: 车队全毁→劫道方胜, ≥escapeN 辆突围→护运方胜
bases:[], // 无基地: 谷道两端不设营区 —— 劫道方靠临时补给点(supplyLife), 护运方靠运输车补给
roads:[[142,0,120,0],[120,0,96,6],[96,6,72,0],[72,0,48,-4],[48,-4,24,2],[24,2,0,0],[0,0,-24,-2],[-24,-2,-48,2],[-48,2,-72,0],[-72,0,-96,-5],[-96,-5,-120,0],[-120,0,-142,0]],
trench:[[-56,18,-40,14],[28,20,52,16],[-24,-14,-12,-16],[10,22,26,18],[-88,-18,-72,-20],[-108,14,-96,10]],
// 劫道方伏击点: 两侧山坡中高处 (rd≈20-24, 相对谷道高 3.5~7m) 南北交错, 居高临下打谷道;
// 护运方仅一个"谷口集结地"兜底(无车存活时随车队出生回退点)
spawns:[{x:66,z:20,name:'南坡伏击点 A',team:0},{x:30,z:-20,name:'北坡伏击点 A',team:0},{x:-24,z:22,name:'南坡伏击点 B',team:0},{x:-52,z:-22,name:'北坡伏击点 B',team:0},{x:-88,z:18,name:'南坡伏击点 C',team:0},{x:100,z:-18,name:'北坡伏击点 C',team:0},{x:128,z:0,name:'谷口集结地',team:1}],
tankN:[0,2], botMul:[1.35,0.75],
// 劫道车队: trucks=数量, hp=单车血量, spd=行驶速度m/s, gap=列车间距m, escapeN=突围N辆判护运胜, escortTeam=护运方
// supplyLife=劫道方临时补给点存活秒数 (耗尽后全部失效), 补给=弹药+绷带+投掷物全满
convoy:{trucks:5,hp:320,spd:1.8,gap:20,escapeN:3,escortTeam:1,supplyLife:600} },
{ id:'xuefeng', title:'雪峰山会战 1945', sub:'湘西峻岭 · 山线喋血', f:['kmt','jp'], theme:'xuefeng',
terr:'xuefeng', layout:'xuefeng', mode:'conquest', atk:0, modeName:'征服·山线六点', mapSize:800,
// 超大地图 (800×800): 主山脊线由西向东, 三峰两垭口 —— 山线六点沿脊线/盘山公路排布
flags:[{id:'江口镇',x:-300,z:160,r:16},{id:'青山坳',x:-247,z:58,r:13},{id:'枯石垭',x:-142,z:-7,r:14},
{id:'雪峰山',x:5,z:-24,r:15},{id:'双峰口',x:131,z:-23,r:14},{id:'东栗坡',x:300,z:-125,r:14}],
bases:[{x:-360,z:255},{x:360,z:-245}], sineRoad:false,
// 盘山公路: 西营→江口镇→青山坳→枯石垭→绕主峰北腰→双峰口→东麓→东营 (主峰雪峰山仅步道可达)
roads:[[-360,255,-330,200],[-330,200,-300,160],[-300,160,-247,58],[-247,58,-142,-7],
[-142,-7,-40,52],[-40,52,40,64],[40,64,105,15],[105,15,131,-23],
[131,-23,200,-52],[200,-52,258,-98],[258,-98,300,-125],[300,-125,330,-180],[330,-180,360,-245]],
trench:[[-318,132,-282,178],[-262,70,-232,46],[-160,-25,-124,6],
[-14,-42,22,-8],[-12,-8,20,-40],[108,-42,152,-4],[278,-142,322,-108]],
// 湘西梯田: 山麓稻丛田块 (软遮蔽, 高 1.6m) —— 西南两片 + 东麓一片, 靠近旗 A/F
fields:[
{x0:-388,z0:132,x1:-322,z1:222,t:'rice'},{x0:-316,z0:128,x1:-244,z1:206,t:'rice'},
{x0:-236,z0:168,x1:-160,z1:246,t:'rice'},{x0:268,z0:-158,x1:338,z1:-84,t:'rice'} ],
tankN:[3,3], botMul:[1,1] }, // 2026-09-02 载具数按战区统一: 东亚=3
{ id:'taihang', title:'太行山 1943', sub:'三山对峙 · 八方围攻', f:['cpc','jp'], theme:'taihang',
terr:'taihang', layout:'taihang', mode:'assault', atk:0, modeName:'围攻·八路全线进攻', mapSize:800,
// 800 超大地图: 山群三峰 (西峰72m/主峰118m/东峰78m) 盘踞东北半, 平原环绕西南北东
// 围攻格局: 进攻方六个前出点 (南/西南/西/北/东北/东进攻营) 同时多方向发起, 每座山至少 2 条上山路线:
//   主峰: 南线(A→B→C) 北线(F→C) 东线(H→东垭→C) 西线(I→C) —— 4 线
//   西峰: 西线(D→E) 东南线(I→E) —— 2 线 ; 东峰: 东线(G→H) 西线(H→东垭) —— 2 线
flags:[{id:'A',x:45,z:95,r:13},{id:'B',x:70,z:25,r:13},{id:'C',x:30,z:-60,r:16},
{id:'D',x:-240,z:40,r:13},{id:'E',x:-135,z:15,r:13},{id:'F',x:95,z:-225,r:13},
{id:'G',x:330,z:-125,r:13},{id:'H',x:200,z:-120,r:13},{id:'I',x:-45,z:-28,r:13}],
// 日军山内中枢基地 (守方基地): 主峰北坡凹地(约72m) —— 处于全部日军旗点包围网的中央
// (几何中心≈(38,-42)正落在主峰冲积锥上, 无可立足点; 取最近的可立地: 主峰北面背坡盆地 30,-140,
//  距主峰要塞80m/北口103m/东峰169m/西垭132m, 弹药/重生/坦克补给点深藏山体内部)
bases:[{x:-360,z:265},{x:30,z:-140}], sineRoad:false,
// 进攻方前出点 (部署/重生/Bot出生 多路并发): 环绕山群平原一侧各营
spawns:[
{x:45,z:150,name:'南谷进攻营',team:0},{x:-250,z:190,name:'西南进攻营',team:0},
{x:-300,z:60,name:'西口进攻营',team:0},{x:95,z:-290,name:'北口进攻营',team:0},
{x:350,z:-20,name:'东北进攻营',team:0},{x:370,z:-140,name:'东口进攻营',team:0}],
// 道路为各方向攻山路线 (沿每条上山通道); 南/西/北/东 四线 + 两垭口联络线
roads:[[-360,265,-160,190],[-160,190,-45,150],[-45,150,45,95],
[45,95,85,75],[85,75,115,30],[115,30,95,25],[95,25,70,25],[70,25,90,-5],[90,-5,95,-45],[95,-45,75,-75],[75,-75,45,-60],[45,-60,30,-60],
[-360,265,-300,150],[-300,150,-240,40],[-240,40,-200,30],[-200,30,-170,22],[-170,22,-135,15],
[95,-290,95,-225],[95,-225,105,-175],[105,-175,120,-130],[120,-130,130,-90],[130,-90,110,-55],[110,-55,80,-35],[80,-35,30,-60],
[370,-140,330,-125],[330,-125,290,-115],[290,-115,255,-115],[255,-115,215,-120],
[200,-120,155,-100],[155,-100,115,-90],[115,-90,80,-75],[80,-75,50,-70],[50,-70,30,-60],
[30,-140,52,-122],[52,-122,30,-95],[30,-95,30,-60],
[30,-140,68,-170],[68,-170,92,-205],[92,-205,95,-225],
[30,-140,16,-125],[16,-125,5,-120],[5,-120,-20,-95],[-20,-95,-45,-60],[-45,-60,-45,-28],
[-45,-28,-90,-15],[-90,-15,-135,15],
[-45,-28,10,5],[10,5,70,25]],
// 日军防御线: 南线山坡 / 垭口两缘 / 北线背后 / 西线坡上 / 东线坡上 / 主峰顶环 / 东峰坡
trench:[[62,26,18,20],[-16,-38,-38,-52],
[126,-104,104,-118],[100,-70,122,-56],
[-196,26,-172,18],[-104,-6,-88,10],
[288,-92,262,-100],[228,-136,208,-150],
[12,-84,10,-66],[44,-92,54,-84],[54,-66,44,-46],
[194,-96,180,-108],[168,-136,184,-148]],
// 平原田块 (软遮蔽): 南谷西 / 西南营 / 西口 / 北口外 / 东口外 各一片 (谷口田块避开山脚高面)
fields:[
{x0:-60,z0:110,x1:10,z1:180,t:'wheat'},
{x0:-180,z0:150,x1:-100,z1:216,t:'corn'},
{x0:-320,z0:10,x1:-250,z1:70,t:'wheat'},
{x0:-292,z0:70,x1:-222,z1:130,t:'corn'},
{x0:10,z0:-280,x1:80,z1:-235,t:'corn'},
{x0:120,z0:-320,x1:190,z1:-250,t:'wheat'} ],
tankN:[3,3], botMul:[1.15,1] }, // 2026-09-02 载具数按战区统一: 东亚=3
];
let CAMPAIGN_IDX=clamp(parseInt(localStorage.getItem('sf_campaign')||'0')||0,0,CAMPAIGNS.length-1);
const CAMPAIGN=CAMPAIGNS[CAMPAIGN_IDX];
// 玩法归属战役: 征服 / 攻防(atk=进攻方) / 破袭(摧毁补给库)
let GAMEMODE=CAMPAIGN.mode;
const ATK=CAMPAIGN.atk||0, DEF=1-ATK;
const DEPOTS=[];
// 战役天气: 雨/雪/阴天/雷暴
const WEATHER={normandy:'overcast',stalingrad:'snow',berlin:'overcast',songhu:'rain',baituan:'clear',burma:'storm',moscow:'snow',hukawng:'rain',steppe:'clear',woodline:'overcast',canyon:'overcast',xuefeng:'overcast'}[CAMPAIGN.id]||'clear';
// 河流 (进入地形生成); d=下切深度, d>2 视为深谷激流(占用格阻挡寻路+徒涉伤害)
const RIVER={
moscow:{pts:[[-165,-70],[-60,-34],[20,-48],[90,-92],[165,-120]],w:9,ice:true},
burma:{pts:[[-165,62],[-70,32],[-8,62],[60,12],[120,42],[165,22]],w:8,ice:false},
songhu:{pts:[[-165,-52],[-80,-42],[0,-58],[80,-32],[165,-42]],w:7,ice:false},
hukawng:{pts:[[-48,-165],[-26,-95],[-4,-25],[6,45],[24,115],[44,165]],w:10,ice:false,d:5},
}[CAMPAIGN.id]||null;
// 大桥 (胡康河谷): 桥面接入 heightAt, 河道占用格在桥区豁免
const BRIDGE=CAMPAIGN.bridge||null;
// 在场人数规模 (与人力池分离): 标准/加强/史诗 —— 决定每队 Bot 数量
const SIZE_OPTS=[{n:'标准',bots:11},{n:'加强',bots:16},{n:'史诗',bots:22},{n:'超编',bots:30}];
let SIZE_IDX=clamp(parseInt(localStorage.getItem('sf_size')||'0')||0,0,3);
// 人力池倍率: 只缩放兵力票池 (×0.5≈83, ×1≈165, ×2≈330=原"标准"330)
const HMUL=Math.min(2,Math.max(0.5,parseFloat(localStorage.getItem('sf_hmul')||'2')||2));
// 移动端检测 (可在菜单强制覆盖)
const MOBILE=(()=>{
const ov=localStorage.getItem('sf_mobile');
if(ov==='1') return true;
if(ov==='0') return false;
try{ return navigator.maxTouchPoints>0&&matchMedia('(pointer:coarse)').matches; }catch(e){ return 'ontouchstart' in window; }
})();
// 实验模式: 非史实兵器 (巡飞弹兵替换反坦克兵), 由主菜单按钮开关
const EXPERIMENT=localStorage.getItem('sf_exp')==='1';
const THEMES={
green:{ sky:['#5e7ca0','#93aec0','#c3cdc2','#d8d3b8','#c9c3a4'], fog:0xb8c4bc, hemi:[0xcfd8e8,0x5a5844,0.75], sun:0xffeed0, sunI:2.0,
ground:0xffffff, grassC:0xffffff, leaf:0xffffff, roof:0xffffff, dead:0.08, ruinAdd:0, rubbleN:0, snow:false, birds:true, treeN:95, grassMul:1 },
winter:{ sky:['#6b7684','#939aa4','#b8bcc2','#c8cacc','#bfc2c4'], fog:0xbcc2c8, hemi:[0xcdd4de,0x777d84,0.8], sun:0xe8ecf2, sunI:1.5,
ground:0xdfe4ea, grassC:0xc8ccd2, leaf:0x5a5148, roof:0xb8bcc2, dead:0.7, ruinAdd:0.35, rubbleN:14, snow:true, birds:false, treeN:55, grassMul:0.3 },
ruin:{ sky:['#5f5a55','#8a7f74','#a89a88','#b3a48e','#a3947e'], fog:0xa89c8c, hemi:[0xc2b8a8,0x5f584c,0.7], sun:0xffd9a8, sunI:1.7,
ground:0xb8b0a2, grassC:0x9a9482, leaf:0x6a6a52, roof:0x8f8578, dead:0.5, ruinAdd:0.5, rubbleN:20, snow:false, birds:false, treeN:45, grassMul:0.45 },
china:{ sky:['#7d93a8','#a8b8bc','#cfc8b2','#ddd2ac','#cfc29e'], fog:0xc6bfa6, hemi:[0xd8d8c8,0x5f5c48,0.75], sun:0xffe8c0, sunI:1.85,
ground:0xf2ecd8, grassC:0xd8e0b8, leaf:0xd0ffb0, roof:0x6a7076, dead:0.15, ruinAdd:0.2, rubbleN:8, snow:false, birds:true, treeN:80, grassMul:0.9 },
loess:{ sky:['#8a97a4','#b5b3a4','#d8cba4','#e0d0a0','#d4c294'], fog:0xd2c49e, hemi:[0xe0d8c0,0x6f6448,0.75], sun:0xffe2b0, sunI:1.9,
ground:0xf0dfb2, grassC:0xe8d8a0, leaf:0xc8d890, roof:0x9a9078, dead:0.3, ruinAdd:0.1, rubbleN:5, snow:false, birds:true, treeN:60, grassMul:0.55 },
jungle:{ sky:['#5f7d8c','#8fae9c','#b8c8a0','#c8cf9a','#b8c288'], fog:0xaebf96, hemi:[0xc8d8c0,0x40523c,0.8], sun:0xfff2c8, sunI:1.7,
ground:0xa8c078, grassC:0x8fb860, leaf:0x69a83c, roof:0x8a8468, dead:0.05, ruinAdd:0, rubbleN:0, snow:false, birds:true, treeN:185, grassMul:1.7 },
deepjungle:{ sky:['#3d5a52','#5f8570','#86a37c','#93aa76','#7f9a68'], fog:0x7d9a72, hemi:[0x9dbb90,0x2c3d28,0.85], sun:0xf4eec0, sunI:1.45,
ground:0x8aa860, grassC:0x6f9c48, leaf:0x4e8c2e, roof:0x6f6a50, dead:0.02, ruinAdd:0, rubbleN:0, snow:false, birds:true, treeN:330, grassMul:2.0 },
alpine:{ sky:['#5a6a80','#8b98a8','#c2c8ce','#d8dade','#ccd0d4'], fog:0xc6ccd4, hemi:[0xd0d8e4,0x6a7078,0.82], sun:0xeef2f8, sunI:1.55,
ground:0xe6eaf0, grassC:0xc8d0d8, leaf:0x3d5a44, roof:0xd8dce2, dead:0.25, ruinAdd:0.1, rubbleN:4, snow:true, birds:false, treeN:150, grassMul:0.35 },
steppe:{ sky:['#85a0b2','#aac0c4','#d4cdaa','#e0d49e','#d2c690'], fog:0xc6c09a, hemi:[0xdcdcc4,0x605a40,0.8], sun:0xffeec8, sunI:1.9,
ground:0xf2e8bc, grassC:0xdcc890, leaf:0x9aa860, roof:0x9a8a6a, dead:0.25, ruinAdd:0, rubbleN:3, snow:false, birds:true, treeN:48, grassMul:0.8 },
woods:{ sky:['#68767e','#93a2a4','#b6beb2','#c2c8b2','#b2b8a0'], fog:0xaab4a2, hemi:[0xc8d2c4,0x4a5640,0.76], sun:0xf0e4c4, sunI:1.55,
ground:0xb4ac8c, grassC:0xa4b484, leaf:0x59714a, roof:0x8a8268, dead:0.18, ruinAdd:0, rubbleN:0, snow:false, birds:true, treeN:250, grassMul:1.1 },
mountain:{ sky:['#86a0b4','#aabec6','#d2c8a4','#ded2a6','#d0c49c'], fog:0xccc2a2, hemi:[0xdcd4c0,0x5f5848,0.78], sun:0xffe6b8, sunI:1.85,
ground:0xc9b890, grassC:0xb8b084, leaf:0x6a7a50, roof:0x8a8270, dead:0.22, ruinAdd:0, rubbleN:4, snow:false, birds:true, treeN:500, treeQ:1, grassMul:0.7 },
xuefeng:{ sky:['#6e8aa0','#94aab0','#bcc8ac','#c9d0b2','#b8c2a2'], fog:0xaebc9e, hemi:[0xd0d8c4,0x4a5540,0.78], sun:0xffeec8, sunI:1.7,
ground:0xffffff, grassC:0xd2e0b0, leaf:0x3f6a35, roof:0x7a7264, dead:0.25, ruinAdd:0, rubbleN:5, snow:false, birds:true, treeN:3000, treeQ:1, grassMul:1.2 },
taihang:{ sky:['#7d95a8','#a8b8bc','#d6cfae','#e0d6a8','#d2c69e'], fog:0xc8c2a4, hemi:[0xd8d8c4,0x5c5a44,0.78], sun:0xffe8bc, sunI:1.85,
ground:0xf2ecd8, grassC:0xdce0b2, leaf:0x5f7a46, roof:0x8a7a5e, dead:0.15, ruinAdd:0, rubbleN:5, snow:false, birds:true, treeN:1800, treeQ:1, grassMul:1.0 },
};
const THEME=THEMES[CAMPAIGN.theme];
const FACTIONS={
us:{ name:'美国陆军', short:'盟军', sym:'★', flagBg:'#3a5f9e',
coat:0x57604a, pants:0x8a7f5e, helm:0x4a5240, skin:0xc09878, sleeve:0x4d5240, helmet:'pot', nade:'egg',
names:['米勒','雷本','杰克逊','霍瓦特','梅利什','厄本','韦德','卡帕佐','德尔安科','麦克','唐尼','史密斯','布鲁尔','泰勒'],
cls:[['garand','m1911'],['thompson','m1911'],['bar','m1911'],['springfield','m1911'],['m1903','m1911'],['bazooka','m1911'],['m1carb','m1911'],['m1carb','m1911']],
tanks:[{name:'M4 谢尔曼',hp:1200,spd:8.3,rev:4.4,turn:0.9,reload:1.3,tRate:2.4,dmg:520,col:0x586e40,colT:0x404e30,heavy:false,barrelL:3.3,hullL:5.8},
{name:'M26 潘兴',hp:1900,spd:6.5,rev:3.6,turn:0.7,reload:1.65,tRate:1.9,dmg:660,col:0x50663c,colT:0x3c5030,heavy:true,barrelL:4.1,hullL:6.4}],
planes:[{name:'P-51 野马',hp:100,spd:[32,64],rof:0.075,mgDmg:17,bombs:1,col:0x74806a,size:1},
{name:'P-47 雷电',hp:160,spd:[28,54],rof:0.09,mgDmg:21,bombs:3,col:0x687a62,size:1.18}] },
ger:{ name:'德意志国防军', short:'德军', sym:'✠', flagBg:'#8a2020',
coat:0x555a60, pants:0x46484e, helm:0x3e4246, skin:0xc8a080, sleeve:0x4a4d52, helmet:'stahl', nade:'stick',
names:['施泰纳','穆勒','克格勒','汉森','冯·克劳克','贝克','施密特','里希特','沃尔夫','凯撒','布劳恩','菲舍尔','霍夫曼','克鲁格'],
cls:[['kar98','p38'],['mp40','p38'],['stg44','p38'],['kar98zf','p38'],['kar98','p38'],['schreck','p38'],['g33','p38'],['g33','p38']],
tanks:[{name:'四号坦克',hp:1200,spd:8.1,rev:4.4,turn:0.9,reload:1.3,tRate:2.4,dmg:520,col:0x545a50,colT:0x3e4238,heavy:false,barrelL:3.5,hullL:5.8},
{name:'黑豹',hp:1900,spd:7.0,rev:3.6,turn:0.75,reload:1.6,tRate:2.0,dmg:660,col:0x5c5a48,colT:0x464438,heavy:true,barrelL:4.3,hullL:6.6}],
planes:[{name:'BF-109',hp:100,spd:[32,64],rof:0.075,mgDmg:17,bombs:1,col:0x70747a,size:1},
{name:'FW-190',hp:160,spd:[28,54],rof:0.09,mgDmg:21,bombs:3,col:0x62666a,size:1.18}] },
sov:{ name:'苏联红军', short:'苏军', sym:'☭', flagBg:'#b03030',
coat:0x6b6a4f, pants:0x5c5a42, helm:0x515c3e, skin:0xc8a080, sleeve:0x62614a, helmet:'ssh', nade:'stickS',
names:['伊万诺夫','彼得罗夫','瓦西里','安德烈','谢尔盖','德米特里','尼古拉','阿列克谢','米哈伊尔','尤里','奥列格','弗拉基米尔','康斯坦丁','格里高利'],
cls:[['mosin','tt33'],['ppsh','tt33'],['dp28','tt33'],['mosinpu','tt33'],['mosin','tt33'],['ptrd','tt33'],['m38carb','tt33'],['m38carb','tt33']],
tanks:[{name:'T-34/76',hp:1300,spd:8.8,rev:4.7,turn:0.95,reload:1.25,tRate:2.5,dmg:520,col:0x4f5c40,colT:0x3c4832,heavy:false,barrelL:3.4,hullL:5.9},
{name:'KV-1 重型',hp:2100,spd:5.7,rev:3.3,turn:0.65,reload:1.7,tRate:1.8,dmg:650,col:0x53604a,colT:0x404c3a,heavy:true,barrelL:3.9,hullL:6.5}],
planes:[{name:'La-5',hp:100,spd:[32,64],rof:0.075,mgDmg:17,bombs:1,col:0x5f7062,size:1},
{name:'IL-2 强击机',hp:180,spd:[26,50],rof:0.095,mgDmg:22,bombs:3,col:0x556052,size:1.2}] },
jp:{ name:'日本帝国陆军', short:'日军', sym:'☀', flagBg:'#8a2020',
coat:0x7a6f4a, pants:0x6e6444, helm:0x60593a, skin:0xc8a078, sleeve:0x6f6543, helmet:'jp', nade:'egg',
names:['田中','佐藤','铃木','高桥','渡边','伊藤','山本','中村','小林','加藤','吉田','山田','佐佐木','松本'],
cls:[['arisaka','nambu'],['type100','nambu'],['type96','nambu'],['type97s','nambu'],['arisaka','nambu'],['type97at','nambu'],['type38c','nambu'],['type38c','nambu']],
tanks:[{name:'九七式中战车',hp:950,spd:8.6,rev:4.4,turn:0.95,reload:1.2,tRate:2.5,dmg:400,col:0x6f6a4c,colT:0x585340,heavy:false,barrelL:2.9,hullL:5.4},
{name:'一式中战车',hp:1250,spd:8.1,rev:4.2,turn:0.85,reload:1.35,tRate:2.2,dmg:470,col:0x6a6548,colT:0x53503c,heavy:true,barrelL:3.3,hullL:5.7}],
planes:[{name:'零式舰战',hp:90,spd:[33,66],rof:0.07,mgDmg:16,bombs:1,col:0x8a9284,size:0.96},
{name:'一式战 隼',hp:150,spd:[29,56],rof:0.085,mgDmg:20,bombs:3,col:0x77806e,size:1.12}] },
kmt:{ name:'国民革命军', short:'国军', sym:'✷', flagBg:'#2050b0',
coat:0x5a6a72, pants:0x52606a, helm:0x46525a, skin:0xc8a078, sleeve:0x53626b, helmet:'stahl', nade:'stick',
names:['王大山','李长贵','张铁柱','刘志','陈国栋','杨得胜','赵铁牛','黄浦生','周卫国','吴天亮','徐虎','孙立','马汉山','胡铁军'],
cls:[['zhongzheng','c96'],['mp18','c96'],['zb26','c96'],['zhongzhengs','c96'],['hanyang','c96'],['boys','c96'],['laotao','c96'],['laotao','c96']],
tanks:[{name:'维克斯6吨',hp:800,spd:7.8,rev:4.2,turn:0.95,reload:1.15,tRate:2.5,dmg:330,col:0x5c6858,colT:0x475244,heavy:false,barrelL:2.7,hullL:5.2},
{name:'T-26(援华)',hp:1000,spd:8.3,rev:4.4,turn:0.9,reload:1.25,tRate:2.4,dmg:400,col:0x556050,colT:0x424c3e,heavy:true,barrelL:3.0,hullL:5.4}],
planes:[{name:'霍克III',hp:95,spd:[30,58],rof:0.08,mgDmg:16,bombs:1,col:0x6f7a68,size:0.98},
{name:'伊-16(援华)',hp:140,spd:[28,54],rof:0.085,mgDmg:19,bombs:2,col:0x5f6a58,size:1.05}] },
cpc:{ name:'八路军', short:'八路', sym:'✭', flagBg:'#b03030',
coat:0x777d72, pants:0x6d736a, helm:0x777d72, skin:0xc8a078, sleeve:0x6f756a, helmet:'cap', nade:'stick', atn5:4,
names:['李云龙','赵刚','王铁蛋','孙德胜','张大彪','魏和尚','段鹏','沈泉','邢志国','陈铁柱','石头','柱子','二娃','铁蛋'],
cls:[['hanyang','c96'],['c96auto','c96'],['type11','c96'],['zhongzhengs','c96'],['hanyang','c96'],['hanyang','c96'],['laotao','c96'],['laotao','c96']],
tanks:[{name:'九七式(缴获)',hp:950,spd:8.6,rev:4.4,turn:0.95,reload:1.2,tRate:2.5,dmg:400,col:0x6d7268,colT:0x565b52,heavy:false,barrelL:2.9,hullL:5.4},
{name:'一式(缴获)',hp:1250,spd:8.1,rev:4.2,turn:0.85,reload:1.35,tRate:2.2,dmg:470,col:0x687062,colT:0x51584c,heavy:true,barrelL:3.3,hullL:5.7}],
planes:[{name:'隼(缴获)',hp:150,spd:[29,56],rof:0.085,mgDmg:20,bombs:2,col:0x6f7a6a,size:1.12},
{name:'九九式(缴获)',hp:140,spd:[27,52],rof:0.09,mgDmg:19,bombs:3,col:0x667062,size:1.15}] },
};
const TEAM_FACTION=[FACTIONS[CAMPAIGN.f[0]],FACTIONS[CAMPAIGN.f[1]]];
const TEAM_NAME=[TEAM_FACTION[0].short,TEAM_FACTION[1].short];
const TEAM_COL=[0x8fc1ff,0xff9c8a];
// 超大地图战役(如雪峰山 800×800)在战役条目里指定 mapSize; 其余沿用标准 320
const MAP_SIZE=CAMPAIGN.mapSize||320;
let BOTS_PER_TEAM=11;
const START_TICKETS=330;
// ===== 体力/摔落 (2026-09-02 用户指定) =====
const STAM_SPRINT_MUL=2.5; // 冲刺体力倍率: 冲刺耗速降为 1/2.5 (0.22→0.088/s, 满条冲刺约4.5s→11.3s), 屏息/跳跃消耗不变; 观战模式体力恒满
const FALL_SAFE_V=9;       // 摔落安全冲击速度 m/s (≈3.1m 内自由落体无伤; 普通跳跃≈4.6 / 跳伞·跳机限速3.2 均无伤)
const FALL_DMG_MUL=10;     // 超出安全速度每 1 m/s 扣血 (标准档: 5米-24 / 8米-54 / 10米-71 / 约13米致死); 落入河道水面免伤
// ===== 严寒失温 (2026-09-05 城市组·斯大林格勒 用户指定"严厉版") =====
// 战役条目 cold:true 启用 (目前仅斯大林格勒): 露天+非载具+非工事位 持续静止 COLD_OFF 秒 → 每秒掉 COLD_DMG 血 (可冻死);
// 移动(>0.6m/s)/进入建筑/载具/操作固定火力点 即中断冻结计时; 玩家与 Bot 同判定 (一视同仁)
const COLD_OFF=25;  // 露天静止阈值秒数
const COLD_DMG=2;   // 起冻后每秒扣血 (严厉版: 可冻死, 反蹲坑)
// ===== 无旗点战役 (遭遇战/劫道) 辅助 =====
// 阵营前出点: 部署出生/Bot出生/坦克推进 的候选 (无旗点模式的核心战场锚点)
function spawnPtsOf(team){ return (CAMPAIGN.spawns||[]).filter(s=>s.team===team); }
// 基地坐标 (无基地战役如断崖公路: 回退本阵营主力前出点, 护运方=谷口集结地)
function basePos(team){
const b=BASES[team];
if(b) return b;
const sp=spawnPtsOf(team);
if(sp.length) return sp[0];
return {x:0,z:0};
}
// ===== 实验模式/燃烧弹 兵种装备辅助 =====
// 玩家选择某兵种时的武器槽: 实验模式下 5号位(反坦克兵)替换为巡飞弹兵
function playerClassWeapons(team,cls){
if(EXPERIMENT&&cls===5) return ['loiter',TEAM_FACTION[team].cls[5][1]];
return TEAM_FACTION[team].cls[cls];
}
// 玩家某兵种的投掷物配置 (Bot 不受实验模式影响, 仍用史实配置)
// 投掷物/AT雷按 2026-08-30 约定为史实携带量 ×2
function clsGear(cls,team){
const c=CLASSES[cls];
const g={ nades:c.nades||0, smoke:c.smoke||0, incin:c.incin||0,
atn:cls===2?4:(cls===5?(TEAM_FACTION[team].atn5||3)*2:0) };
if(EXPERIMENT&&cls===5){ g.atn=0; g.smoke=0; g.incin=4; }
return g;
}
function isLoiterClass(){ return EXPERIMENT&&player.cls===5; }
// ===== 固定火力点 占用/上炮冷却 统一规则 (2026-09-02 用户指定) =====
// 一门炮同时只允许一个"操作者"(含前摇期间的等待者); 下炮后 EMP_REARM_T 秒内任何人不可再上,
// 防止 Bot "下炮秒上同炮" 的连续上炮观感; 前摇占位者取消时释放但不触发上炮冷却
const EMP_REARM_T=6;
function releaseEmpl(g,rearm){ if(!g) return; g.user=null; if(rearm&&g.cdLock!==undefined) g.cdLock=nowT+EMP_REARM_T; }
function empReady(g){ return !!g&&!g.user&&nowT>=(g.cdLock||0); }
