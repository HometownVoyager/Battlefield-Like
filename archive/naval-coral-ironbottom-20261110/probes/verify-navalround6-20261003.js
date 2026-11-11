// ──────────────────────────────────────────────────────────────────────────────
// dev/verify-navalround6-20261003.js —— 纯海战图子系统修复批验收 (2026-10-03)
//
// 本批 = 全海战图缺陷审计 (两图死锁级 4 条 + 确认级 7 条 + 低危批) 的落地验证:
//   P0-1 登舰死锁 → T2/T3/T9/T12: 艇摆渡 (boatAI 'ferry' 相位) + capBotTick 艇上/游泳爬舷 + 玩家跳帮
//   P0-3 水下出生 → T11: capSnapToDeck 的 team 兜底实参 (部署路径漏参)
//   P0-4 甲板半速 → T4: capRideApply 不再清玩家 vel (dampF persistent 积分被归零 = 47%/23% 步速)
//   P1-1 飞机簇   → T7/T8: respawn 清 capArrest + 在航 CV 弹射重生 + 瘫舰不收拦阻/冻结即解
//   P1-2 游泳劫持 → T10: opensea 落水 Bot 朝舰游 (不再朝图缘), 贴帮爬舷闭环
//   P1-6 残位陷阱 → T5: capitalReset 回开局位姿 + 旗点局部锚不重推导
//   P1-7 隐形武器 → T6: capSeatRelease 还原 VM
//   (另: boatAI opensea 离岸纪律恒触发 → T9 动态覆盖; 部署图/主基地/飞行员落甲板 → 源锚)
//
// 沙箱边界: 走 dev/_bootstub.js 桩, 验逻辑与数值; 渲染/手感交用户实机 (既定工作方式)。
// ──────────────────────────────────────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const {sandbox,document,window}=require('./_bootstub.js');
const OUTDIR=path.join(root,'dev/out');
try{ fs.mkdirSync(OUTDIR,{recursive:true}); }catch(e){}

const V3c=sandbox.THREE.Vector3;
V3c.prototype.addScalar=function(s){ this.x+=s; this.y+=s; this.z+=s; return this; };
V3c.prototype.divideScalar=function(s){ s=s||1; this.x/=s; this.y+=s*0; this.z+=s; return this; };
for(const k of ['MeshLambertMaterial','MeshBasicMaterial','MeshStandardMaterial','MeshPhongMaterial','PointsMaterial','SpriteMaterial']){
	const C=sandbox.THREE[k];
	if(!C||!C.prototype) continue;
	if(!C.prototype.clone) C.prototype.clone=function(){ return new C(Object.assign({},this,{color:this.color})); };
	if(!C.prototype.dispose) C.prototype.dispose=function(){};
}
const AP=()=>({value:0,setValueAtTime(){},setTargetAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}});
class ACStub{
	createOscillator(){ return {frequency:AP(),detune:AP(),type:'',start(){},stop(){},connect(){},onended:null}; }
	createGain(){ return {gain:AP(),connect(){},disconnect(){}}; }
	createBuffer(){ return {getChannelData:()=>new Float32Array(16),duration:1,numberOfChannels:1}; }
	createBufferSource(){ return {buffer:null,loop:false,playbackRate:AP(),start(){},stop(){},connect(){},onended:null}; }
	createBiquadFilter(){ return {type:'',frequency:AP(),detune:AP(),Q:AP(),connect(){}}; }
	createDynamicsCompressor(){ return {threshold:AP(),ratio:AP(),attack:AP(),release:AP(),connect(){}}; }
	createStereoPanner(){ return {pan:AP(),connect(){}}; }
	resume(){ return Promise.resolve(); }
	get state(){ return 'running'; }
	get destination(){ return {}; }
}
sandbox.AudioContext=ACStub; sandbox.window.AudioContext=ACStub; sandbox.window.webkitAudioContext=ACStub;
const _IM=sandbox.THREE.InstancedMesh;
if(_IM){
	const _arr=new Float32Array(16*64);
	sandbox.THREE.InstancedMesh=class extends _IM{ constructor(g,m,c){ super(g,m,c); this.instanceMatrix={array:_arr}; } };
}
delete sandbox.window.CANNON;

// ── FILES: 与 index.html 实载清单逐条一致 (探针载入盲区教训) ──
const FILES=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/15g-capmodels.js','js/15h-capital.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/19b-gamepad.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/22a-menuart.js','js/22b-speclayer.js','js/23-deploy.js','js/23b-worldrestore.js','js/24-main.js'];

const SEED=7;
function mulberry32(a){ return function(){ a|=0; a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a); t=(t^(t>>>14))>>>0; return t/4294967296; }; }

function boot(campId){
	const ctx=vm.createContext(Object.assign({},sandbox));
	ctx.document=document; ctx.window=window; ctx.globalThis=ctx;
	ctx.location={search:'?seed='+SEED,href:'http://localhost/index.html?seed='+SEED,hostname:'localhost',protocol:'http:'};
	ctx.Math=Object.assign(Object.create(Math),{random:mulberry32(SEED)});
	ctx.localStorage={_s:{sf_campaign:String(campId)},getItem(k){ return this._s[k]??null; },setItem(k,v){ this._s[k]=String(v); },removeItem(k){ delete this._s[k]; }};
	ctx.console={log:(...a)=>{ const s=a.map(x=>String(x)).join(' '); if(!/^\[(地形|HUD|NAV|世界|海战|反舰|破坏)/.test(s)) console.log(...a); },warn:console.warn.bind(console),error:console.error.bind(console)};
	const loadErrors=[];
	for(const f of FILES){
		try{ vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f}); }
		catch(e){ loadErrors.push({file:f,err:String(e&&e.stack||e).split('\n').slice(0,3).join(' | ')}); }
	}
	try{ vm.runInContext(`(()=>{ const b=document.getElementById('startBtn'); if(b&&b.onclick) b.onclick(); })()`,ctx); }
	catch(e){ return {ctx,loadErrors,startErr:String(e&&e.stack||e)}; }
	return {ctx,loadErrors,startErr:null};
}
function N(ctx,code){ return vm.runInContext(code,ctx); }
function NT(ctx,code){ try{ return N(ctx,code); }catch(e){ return {__err:String(e&&e.message||e)}; } }

// ── 报告 ──
const OUT=[];
let nPass=0,nFail=0;
function say(s){ OUT.push(s); console.log(s); }
function judge(ok,name,d){ if(ok){ nPass++; say('  ✓ '+name+(d?'\n      '+d:'')); } else { nFail++; say('  ✗ '+name+(d?'\n      '+d:'')); } }
function srcHas(file,needle,name){
	const s=fs.readFileSync(path.join(root,file),'utf8');
	const body=s.split('\n').map(l=>l.replace(/\/\/.*$/,'')).join('\n');
	judge(body.includes(needle),name,'锚: '+file+' 含「'+needle.slice(0,60)+'」');
}
function srcCount(file,needle,expect,name){
	const s=fs.readFileSync(path.join(root,file),'utf8');
	const body=s.split('\n').map(l=>l.replace(/\/\/.*$/,'')).join('\n');
	const n=body.split(needle).length-1;
	judge(n===expect,name,'锚: '+file+' 「'+needle.slice(0,50)+'」出现 '+n+' 次 (期望 '+expect+')');
}

say('== 纯海战图子系统修复批 · 验收 (dev/verify-navalround6-20261003.js) ==');
say('');

// ── 源锚 ──
srcCount('js/15h-capital.js','a.vel.x=0; a.vel.z=0;',0,'锚 P0-4: capRideApply 不再清玩家速度 (清零行绝迹)');
srcHas('js/15h-capital.js','function capBotClimbAboard','锚 P0-1: Bot 爬舷单点入口 (步行/游泳/摆渡共用)');
srcHas('js/15h-capital.js','function capNearestSurfPt','锚 P0-1: 舰体表面最近点单源 (摆渡停泊位/游泳目标)');
srcHas('js/15h-capital.js','v.ferryCdT=nowT+CAPITAL_CFG.ferryCd','锚 P0-1: 摆渡下客盖章冷却 (15h capBotTick)');
srcHas('js/15h-capital.js',"if(cv.state!=='run'){ pl.capArrest=null; pl.capParkT=0; return false; }",'锚 P1-1: 瘫舰上的拦阻就地解开 (capArrestTick)');
srcHas('js/15h-capital.js',"if(s.state!=='run') continue;                        // ★2026-10-03: 瘫舰不接收拦阻",'锚 P1-1: 瘫舰不接收拦阻 (capPlaneDeckHit)');
srcHas('js/15h-capital.js','cfg?cfg.x:this.homeX','锚 P1-6: respawnClear 缺省回开局位姿');
srcHas('js/15h-capital.js','if(f._clx===undefined)','锚 P1-6: 旗点局部锚一次绑定 (不随复位重推导)');
srcHas('js/15h-capital.js','if(typeof VM!==\'undefined\'&&VM.root) VM.root.visible=true;','锚 P1-7: capSeatRelease 还原武器模型');
srcHas('js/14-bots.js',"if(CAMPAIGN.terr!=='opensea'){",'锚 P2: boatAI 离岸纪律 opensea 跳过');
srcHas('js/14-bots.js','function navFerryTarget','锚 P0-1: 摆渡选靶单源 (14-bots)');
srcHas('js/14-bots.js',"c.drive(d2>30?1:0.32",'锚 P0-1: 摆渡直驭贴舷 (近距收油)');
srcHas('js/14-bots.js','if(tS) swT=(typeof capNearestSurfPt===\'function\')?capNearestSurfPt(this,tS,0)','锚 P1-2: opensea 游泳朝舰游');
srcHas('js/14-bots.js','const sn=capSnapToDeck(this.defendPt.x,this.defendPt.z,f.x,f.z)','锚 P1-4: 甲板驻点夹取');
srcHas('js/14-bots.js','typeof capBasePos===\'function\')?capBasePos(this.team):null','锚 P1-3: 无目标 fallback 朝本队基地舰 (opensea)');
srcCount('js/20-player.js','if(bs&&typeof capBoard===\'function\'&&capBoard(bs)) return;',1,'锚 P0-1: 跳帮 F 分派 (艇座位分支, capBoard 单源)');
srcHas('js/20-player.js','<b>F</b> 跳帮登舰','锚 P0-1: 提示层跳帮文案 (与分派同源判据 bs)');
srcCount('js/20-player.js','capDeckShipAt(player.pos.x,player.pos.z,player.pos.y)',2,'锚 P1-5: 甲板判据带高度门 (tryInteract + 提示层)');
srcHas('js/23-deploy.js','capSnapToDeck(fp2[0],fp2[1],sx,sz,p.team)','锚 P0-3: 部署吸附补 team 实参');
srcHas('js/23-deploy.js','p.onCapital=null; p.capitalGun=null;','锚 P1-7: 部署复位清大舰座位/炮位账');
srcHas('js/23-deploy.js','const bp=basePos(player.team);','锚 P2: 部署列表主基地走 basePos 单源');
srcHas('js/23-deploy.js',"let decked=false;",'锚 P2: 被顶掉飞行员海图落甲板 (不跳伞入海)');
srcCount('js/16-aircraft.js','this.capArrest=null; this.capParkT=0;',2,'锚 P1-1: 拦阻账 die/respawn 双清');
srcHas('js/16-aircraft.js','if(cv&&cv.state===\'run\') capLaunchPlane(this,true);','锚 P1-1: 重生锚改在航 CV 弹射');
srcHas('js/00-config.js','ferryCd:75','锚 P0-1: 摆渡节拍常量 (CAPITAL_CFG)');
srcHas('js/16-aircraft.js','const gh=(typeof planeFloorY===\'function\')?planeFloorY(w.pos.x,w.pos.z)','锚 P2: 坠机残骸按水面地板 (不再沉海床)');

// ══════ 动态 (coral 实跑) ══════
say('');
// 战役索引现查 (不写死序号): 单独 contextify 一个只载 00-config 的沙箱读 CAMPAIGNS
function campIndex(id){
	const ctx=vm.createContext(Object.assign({},sandbox));
	ctx.globalThis=ctx; ctx.window=window; ctx.document=document;
	ctx.localStorage={_s:{},getItem(){ return null; },setItem(){},removeItem(){}};
	ctx.console=console;
	try{ vm.runInContext(fs.readFileSync(path.join(root,'js/00-config.js'),'utf8'),ctx,{filename:'js/00-config.js'});
		 return vm.runInContext(`CAMPAIGNS.findIndex(c=>c.id==='${id}')`,ctx); }
	catch(e){ return -1; }
}
const CI_CORAL=campIndex('coral'), CI_IRON=campIndex('ironbottom');
judge(CI_CORAL>=0&&CI_IRON>=0,'战役索引现查 (coral/ironbottom)','coral='+CI_CORAL+' ironbottom='+CI_IRON);

const Bc=boot(CI_CORAL);
if(Bc.loadErrors.length){
	judge(false,'启动链: coral 全脚本 LOAD 不报错',Bc.loadErrors.map(e=>e.file+' → '+e.err).join('  ||  ').slice(0,900));
}else{
	judge(true,'启动链: coral 全脚本 LOAD 不报错','共 '+FILES.length+' 个脚本 (与 index.html 实载一致)');
	const ctx=Bc.ctx;
	NT(ctx,'startMatch&&startMatch();');   // 进战场 (Bot/艇/飞机全编制)

	// ── T1 死锁几何: 同相位全等环 ⇒ 舰距恒在 boardR 外 (摆渡是必要条件, 不是优化) ──
	const t1=NT(ctx,`(()=>{
		const bbs=capitalShips.filter(s=>s.cls==='bb');
		const d0=capRectDist(bbs[0],bbs[1].pos.x,bbs[1].pos.z);
		return {n:capitalShips.length,bbGap:Math.round(d0),boardR:CAPITAL_CFG.boardR};
	})()`);
	judge(t1&&t1.n===4&&t1.bbGap>t1.boardR,'T1 编队几何: BB-BB 舰距恒在 boardR 外 (摆渡的必要性)','舰距 '+t1.bbGap+'m > boardR '+t1.boardR+'m (同相位全等环 = 刚体平移)');

	// ── T2 摆渡下客: 艇贴舷 + ferryTgt ⇒ capBotTick 把车组送上敌舰甲板 ──
	const t2=NT(ctx,`(()=>{
		const foe=capitalShips.find(s=>s.team===1&&s.cls==='bb');
		const boat=navalCraft.find(c=>c.kind==='boat'&&c.team===0&&c.alive);
		if(!boat) return {__err:'无 team0 艇'};
		const bot=boat.crewBot;
		if(!bot) return {__err:'艇无车组'};
		// 艇贴到敌舰舷侧: 舰体局部 (hullW/2+3.5, 0) → 世界 (直接构位, 不用 capNearestSurfPt ——
		// 它对扩矩形内的点返回原点, 探针构造位要用真"舷外 3.5m")
		const cc=Math.cos(foe.yaw), nn=Math.sin(foe.yaw);
		const off=foe.spec.hullW*0.5+3.5;
		boat.pos.x=foe.pos.x+off*cc; boat.pos.z=foe.pos.z-off*nn;
		bot.pos.copy(boat.pos);                                // 车组 pos 随艇 (主循环里士兵 update 先行, 此处同账)
		const rd=capRectDist(foe,bot.pos.x,bot.pos.z);
		boat.ferryTgt=foe;
		capBotTick(bot);
		return {rd:Math.round(rd*10)/10, boardR:CAPITAL_CFG.boardR, boarded:bot.onCapDeck===foe, onVehicle:!!bot.onVehicle,
			deckY:Math.round((bot.pos.y-(foe.pos.y+foe.deck.y))*10)/10, crewCleared:!boat.crewBot,
			cd:boat.ferryCdT>0, obj:bot.objective?('ship'+bot.objective.ship):null};
	})()`);
	judge(t2&&!t2.__err&&t2.boarded&&t2.rd<=t2.boardR,'T2 摆渡下客: boardR 圈内车组上敌舰甲板',
		'贴舷 '+t2.rd+'m → boarded='+t2.boarded+' 座位交还='+t2.crewCleared+' 落点高差='+t2.deckY+'m 冷却='+t2.cd+' 领任务='+t2.obj);

	// ── T3 游泳爬舷: 落水者贴帮 (≤boardR) 爬回甲板 (旧版 swim 早退 = 必死) ──
	const t3=NT(ctx,`(()=>{
		const ship=capitalShips.find(s=>s.team===0&&s.cls==='bb');
		const bot=new Bot(0,0,'落水兵');
		bot.spawn();
		// 造一个"贴帮落水"状态: 舰体局部 (hullW/2+1.5, 0) 的舷外水面, swim=true, 目标=本舰甲板旗
		const cc=Math.cos(ship.yaw), nn=Math.sin(ship.yaw);
		const off=ship.spec.hullW*0.5+1.5;
		const wx=ship.pos.x+off*cc, wz=ship.pos.z-off*nn;
		bot.pos.set(wx,(typeof waterYAt==='function')?waterYAt(wx,wz):0,wz);
		bot.swim=true; bot.alive=true; bot.chuting=false; bot.onVehicle=null; bot.exitSlide=null;
		const fl=FLAGS.find(f=>f.ship===capitalShips.indexOf(ship));
		bot.objective=fl;
		capBotTick(bot);
		return {boarded:bot.onCapDeck===ship, swimCleared:bot.swim===false,
			deckDy:Math.round((bot.pos.y-(ship.pos.y+ship.deck.y))*10)/10};
	})()`);
	judge(t3&&!t3.__err&&t3.boarded&&t3.swimCleared,'T3 游泳爬舷: 贴帮落水者爬回甲板 (swim 门放行)',
		'boarded='+t3.boarded+' swim 清位='+t3.swimCleared+' 甲板高差='+t3.deckDy+'m');

	// ── T4 P0-4: 平台搬运不碰玩家 vel (甲板步速恢复) ──
	const t4=NT(ctx,`(()=>{
		const ship=capitalShips.find(s=>s.team===0&&s.cls==='bb');
		player.onCapital=null; player.capitalGun=null;
		player.pos.set(ship.pos.x,ship.pos.y+ship.deck.y,ship.pos.z);
		player.vel.set(5,0,2);
		capRideCollect(ship);
		capRideApply(ship);
		return {vx:player.vel.x, vz:player.vel.z, carried:player.onCapital!==null};
	})()`);
	judge(t4&&!t4.__err&&t4.vx===5&&t4.vz===2,'T4 P0-4: capRideApply 保持玩家自速 (不再每帧清零)','vel=('+(t4&&t4.vx)+','+(t4&&t4.vz)+') 期望 (5,2)');

	// ── T5 P1-6: capitalReset 回开局位姿 + 旗点锚不漂 ──
	const t5=NT(ctx,`(()=>{
		const ship=capitalShips[0];
		const anchors=FLAGS.filter(f=>f.ship===capitalShips.indexOf(ship)).map(f=>[f._clx,f._clz]);
		ship.pos.x+=120; ship.pos.z+=60;                       // 模拟巡航偏移
		capitalReset();
		const back=FLAGS.filter(f=>f.ship===capitalShips.indexOf(ship)).map(f=>[f._clx,f._clz]);
		capitalFlagTick(0.016);                                // 主循环下一帧旗点跟随 (f.x/f.z 由局部锚重投影)
		const nOwn=FLAGS.filter(f=>f.ship===capitalShips.indexOf(ship)).length;
		const onDeck=FLAGS.filter(f=>f.ship===capitalShips.indexOf(ship)&&capDeckOf(f.x,f.z)===ship).length;
		return {dx:Math.round(ship.pos.x-ship.homeX), dz:Math.round(ship.pos.z-ship.homeZ),
			anchorSame:JSON.stringify(anchors)===JSON.stringify(back), flagsOnDeck:onDeck, nOwn,
			state:ship.state};
	})()`);
	judge(t5&&!t5.__err&&t5.dx===0&&t5.dz===0&&t5.anchorSame&&t5.flagsOnDeck===t5.nOwn,'T5 P1-6: capitalReset 复位后逐位等于开局',
		'位差=('+t5.dx+','+t5.dz+') 锚不漂='+t5.anchorSame+' 旗在甲板上='+t5.flagsOnDeck+'/'+t5.nOwn+' state='+t5.state);

	// ── T6 P1-7: capSeatRelease 还原 VM ──
	const t6=NT(ctx,`(()=>{
		VM.root.visible=false;
		player.onCapital=capitalShips[0];
		player.capitalGun={ship:capitalShips[0],type:'sec',idx:0};
		capSeatRelease();
		return {vm:VM.root.visible, gun:player.capitalGun===null, seat:player.onCapital===null};
	})()`);
	judge(t6&&!t6.__err&&t6.vm&&t6.gun&&t6.seat,'T6 P1-7: 座位释放还原武器模型+清炮位账','VM.visible='+t6.vm);

	// ── T7 P1-1: 重生清拦阻账 + 在航 CV 弹射重生 ──
	const t7=NT(ctx,`(()=>{
		const cv=capitalShips.find(s=>s.cls==='cv'&&s.team===0);
		const pl=planes.find(p=>p.team===0);
		if(!cv||!pl) return {__err:'缺 cv/pl'};
		pl.capArrest=cv; pl.capParkT=99;                       // 模拟"停放中被毁后重生"的脏账
		pl.respawn();
		const onCat=Math.hypot(pl.pos.x-cv.pos.x,pl.pos.z-cv.pos.z)<cv.spec.hullL;
		return {cleared:pl.capArrest===null, speed:Math.round(pl.speed), onCv:Math.abs(pl.pos.y-(cv.pos.y+cv.deck.y+1.2))<3, nearCv:onCat};
	})()`);
	judge(t7&&!t7.__err&&t7.cleared&&t7.speed>20&&t7.onCv&&t7.nearCv,'T7 P1-1: 重生=清拦阻账+在航 CV 弹射起飞',
		'账清='+t7.cleared+' 出膛速度='+t7.speed+'m/s 弹射器高度='+t7.onCv+' 舰上='+t7.nearCv);

	// ── T8 P1-1: 瘫舰不收拦阻 + 冻结即解 (对称性) ──
	const t8=NT(ctx,`(()=>{
		const cv=capitalShips.find(s=>s.cls==='cv'&&s.team===0);
		const pl=planes.find(p=>p.team===0&&!p.playerDriven);
		if(!cv||!pl) return {__err:'缺 cv/pl'};
		const st0=cv.state; cv.state='crippled';               // 只翻状态位 (不跑 cripple 全链, 免得紧急弹射先清账)
		pl.capArrest=cv; pl.capParkT=0; pl.alive=true;
		const frozen=capArrestTick(pl,1/60);
		const released=pl.capArrest===null;
		// 拦阻接收门: 瘫舰上空慢速飞机不可再钩停
		pl.capArrest=null; pl.pos.set(cv.pos.x,cv.pos.y+cv.deck.y+0.5,cv.pos.z); pl.speed=10;
		const refused=!capTryArrest(pl);
		cv.state=st0;
		return {frozen, released, refused};
	})()`);
	judge(t8&&!t8.__err&&t8.released&&t8.refused,'T8 P1-1: 瘫舰=不接收拦阻 + 已冻结的当场解开','解冻='+t8.released+' 拒收='+t8.refused);

	// ── T9/T12 摆渡全链: boatAI 选靶 → 贴舷 → 下客 (动态推演) ──
	// 构造注意: 两军艇集结点相距恰 ~340m = huntR ⇒ 开局互相可见, hunt 相位优先于摆渡 (行为正确)。
	// 选靶测试要把艇挪离敌艇视野 (贴自家 BB), 全链测试要挑"仍有车组"的艇 (T2 已把第一条的车组送上了敌舰)。
	const t9=NT(ctx,`(()=>{
		const own=capitalShips.find(s=>s.team===0&&s.cls==='bb');
		const boat=navalCraft.find(c=>c.kind==='boat'&&c.team===0&&c.alive&&c.crewBot&&!c.playerDriven);
		if(!boat) return {__err:'无可用 AI 艇'};
		boat.pos.x=own.pos.x+40; boat.pos.z=own.pos.z+40;      // 离敌艇 >huntR (贴自家 BB 旁)
		boat.ferryCdT=0; boat.ferryTgt=null;
		boatAI(boat,1/60);
		return {tgt:boat.ferryTgt?('team'+boat.ferryTgt.team):null, mode:navAIS(boat).mode};
	})()`);
	judge(t9&&!t9.__err&&t9.tgt==='team1','T9 摆渡选靶: boatAI 在 opensea 选中敌舰 (离岸纪律不再锁相位)','ferryTgt='+t9.tgt+' mode='+t9.mode);

	const t12=NT(ctx,`(()=>{
		// 全链: 艇开到敌舰舷侧, 车组上甲板 —— 上限 40s 游戏时间 (dt=1/30)。
		// ★2026-10-03 起点定在敌舰 150m: 实测 (30s 追踪) 全链真跑 —— 选靶→贴舷 (355m 收到 15m) ——
		//   但贴脸段 (<100m) 吃敌舰副炮 ~60HP/s, 从集结区出发必在 boardR(9m) 前 1~2s 被击沉
		//   (HP 620→11)。摆渡机制已由 T2 圈内下客单验, 本测验证".stamp→驱动→贴舷→下客"链路本身,
		//   故把起点挪进可交付距离, 不让"被击沉"这种交战结果淹没机制断言。
		const boat=navalCraft.find(c=>c.kind==='boat'&&c.team===0&&c.alive&&c.crewBot&&!c.playerDriven);
		if(!boat) return {__err:'无带车组的艇'};
		const bot=boat.crewBot; if(!bot) return {__err:'艇无车组'};
		const tgt0=navFerryTarget(boat);
		if(!tgt0) return {__err:'无摆渡目标'};
		boat.pos.x=tgt0.pos.x+60; boat.pos.z=tgt0.pos.z+20;    // 60m 外斜角, 需真转向+贴舷才进圈
		for(const o of navalCraft){                            // 干涉隔离 (机制测, 非交战测): 敌艇 hunt 相位
			if(o!==boat&&o.alive){ o.pos.x=0; o.pos.z=-760; }  //   会抢占摆渡艇 ~20s, 把它拖进副炮致命区击沉
		}                                                      //   —— 其余艇挪出 huntR/战区, 让链路独立验证
		boat.ferryCdT=0; boat.ferryTgt=null;
		let ok=false, frames=0;
		for(let i=0;i<40*30;i++){
			nowT+=1/30;                                        // ★实机主循环逐帧推进 nowT (24-main) —— 不推则
			                                                   // boatAI/capBotTick 的帧戳幂等把决策冻在首帧
			if(bot.alive&&bot.onVehicle) bot.update(1/30);     // 车组随艇同步 (主循环里士兵 update 在 updateNaval 之前)
			updateNaval(1/30,1/30);
			updateCapital(1/30,1/30);
			frames++;
			if(bot.onCapDeck&&bot.onCapDeck.team===1){ ok=true; break; }
			if(!boat.alive||!bot.alive) break;
		}
		const rd=capRectDist(bot.onCapDeck||capitalShips[2],bot.pos.x,bot.pos.z);
		return {ok, frames:Math.round(frames/30), rd:Math.round(rd*10)/10, d0:Math.round(Math.hypot(bot.pos.x-capitalShips[2].pos.x,bot.pos.z-capitalShips[2].pos.z))};
	})()`);
	judge(t12&&!t12.__err&&t12.ok,'T12 摆渡全链推演: 艇载车组 40s 内登敌舰甲板',
		t12.__err?('ERR '+t12.__err):('耗时 '+t12.frames+'s (ok='+t12.ok+') 贴舷 '+t12.rd+'m'));

	// ── T10 游泳航向: opensea 落水者朝本队舰游 (不朝图缘) ──
	const t10=NT(ctx,`(()=>{
		const ship=capitalShips.find(s=>s.team===0&&s.cls==='bb');
		const bot=new Bot(0,0,'泳者');
		bot.spawn();
		bot.pos.set(ship.pos.x+70,0,ship.pos.z+30);            // 舷外 60m+ 海面
		// 泳者正确浮位 = 水面下 FLOAT_PAD (脚在水面之上会被 waterStateAt 判 dry, 与实机口径一致)
		bot.pos.y=((typeof waterYAt==='function')?waterYAt(bot.pos.x,bot.pos.z):0)-((typeof FLOAT_PAD!=='undefined')?FLOAT_PAD:0.95)-0.3;
		bot.swim=true; bot.alive=true; bot.onVehicle=null; bot.chuting=false; bot.exitSlide=null;
		bot.objective=null; bot.state='advance'; bot.path=null; bot.decisionT=9;   // 推进态: 无路可走 → fallback 朝本队基地舰
		// 判据对齐劫持的真实瞄准点 (★2026-10-03 修判据): 劫持朝 capNearestSurfPt 的壳面点游,
		//   不是舰心 —— 长舰斜泊时"舰心方向"与"壳面点方向"可差 50°+ (T12 先跑 40s 模拟挪了舰,
		//   壳面点夹角掉到 0.47 而 T10 假红)。这里按劫持同一选靶 (最近本队舰) + 同一目标点算 dot。
		let tS=null,bd=1e9;
		for(const s of capitalShips){
			if(s.team!==0) continue;
			const sd=capRectDist(s,bot.pos.x,bot.pos.z);
			if(sd<bd){ bd=sd; tS=s; }
		}
		const tg=(typeof capNearestSurfPt==='function')?capNearestSurfPt(bot,tS,0):{x:tS.pos.x,z:tS.pos.z};
		bot.update(1/60);
		const fx=Math.sin(bot.yaw), fz=Math.cos(bot.yaw);
		const tx=tg.x-bot.pos.x, tz=tg.z-bot.pos.z, tl=Math.hypot(tx,tz)||1;
		const dot=(fx*tx+fz*tz)/tl;
		return {dot:Math.round(dot*100)/100, swim:bot.swim, tgtShip:tS.cls};
	})()`);
	judge(t10&&!t10.__err&&t10.dot>0.7&&t10.swim,'T10 P1-2: opensea 落水 Bot 朝本队舰游 (劫持航向修复)','艏向·壳面点 cos='+t10.dot+' 舰='+t10.tgtShip+' (>0.7 判朝舰)');

	// ── T11 P0-3: capSnapToDeck 的 team 兜底 (部署漏参回归) ──
	const t11=NT(ctx,`(()=>{
		const ship=capitalShips.find(s=>s.team===0&&s.cls==='bb');
		const sea={x:ship.pos.x+180,z:ship.pos.z+120};         // 舷外海点 (basePos 全瘫回退的那类点)
		const withTeam=capSnapToDeck(sea.x,sea.z,sea.x,sea.z,0);
		const noTeam=capSnapToDeck(sea.x,sea.z,sea.x,sea.z);
		return {withTeam:withTeam?(withTeam.ship===ship||withTeam.ship.team===0):false,
			noTeamNull:noTeam===null,
			wtIn:withTeam?Math.abs(withTeam.x-withTeam.ship.pos.x)<withTeam.ship.spec.hullW:false};
	})()`);
	judge(t11&&!t11.__err&&t11.withTeam&&t11.noTeamNull,'T11 P0-3: 海点参考+team ⇒ 兜底夹进本队舰甲板 (无 team 返回 null)','带 team 命中本队舰='+t11.withTeam+' 无 team=null='+t11.noTeamNull);

	// ── T14 BUG-A: 火源随舰 (船开走火/烟不再浮空) ──
	const t14=NT(ctx,`(()=>{
		const s=capitalShips.find(x=>x.team===0&&x.cls==='bb');
		if(typeof removeFireSource==='function'&&s.fireSrc){ removeFireSource(s.fireSrc); s.fireSrc=null; }
		s._ignite();                                          // 机制测: 满血强点 (真实点火在 hp<fireHp)
		const fs=s.fireSrc;
		if(!fs||!fs.follow) return {__err:'无火源或无 follow 锚'};
		const an=fs.follow.an;
		const p0=capAnchorWorld(s,an);
		const d0=Math.hypot(fs.x-p0.x,fs.y-p0.y,fs.z-p0.z);
		s.pos.x+=50; s.pos.z-=30; s.yaw+=0.4;                 // 舰挪 50m+转 0.4rad (模拟开走)
		if(typeof updateFires==='function') updateFires(0.1); // 推一帧火系统: follow 重投影
		const p1=capAnchorWorld(s,an);
		const d1=Math.hypot(fs.x-p1.x,fs.y-p1.y,fs.z-p1.z);
		return {d0:Math.round(d0*100)/100,d1:Math.round(d1*100)/100};
	})()`);
	judge(t14&&!t14.__err&&t14.d0<0.5&&t14.d1<0.5,'T14 BUG-A: 火源随舰重投影 (舰挪 50m 火心仍贴烟囱锚)','挪前偏差='+t14.d0+'m 挪后偏差='+t14.d1+'m (火/烟不再浮空, 灼烧圈跟着船走)');

	// ── T15 BUG-B: 手雷不穿桥楼 (武装弹触盒即炸 / 未武装弹弹回盒外) ──
	const t15=NT(ctx,`(()=>{
		const s=capitalShips.find(x=>x.team===0&&x.cls==='bb');
		if(!s.boxes||!s.boxes.length) return {__err:'舰无超结构盒 (15g boxes 空)'};
		let b=s.boxes[0];
		for(const q of s.boxes) if(q.hw*q.hh*q.hd>b.hw*b.hh*b.hd) b=q;   // 取最大盒
		const o={x:0,z:0}; capToWorld(s,b.lx,b.lz,o);
		const cw={x:o.x,y:s.pos.y+b.ly,z:o.z};
		const dx=cw.x-s.pos.x, dz=cw.z-s.pos.z, dl=Math.hypot(dx,dz)||1, ux=dx/dl, uz=dz/dl;
		// ① 武装弹 (反坦克炸药, 出手即武装): 盒外 1.5m 平射进盒 ⇒ 'blow' (旧版从桥楼正中穿过去落海哑火)
		const st1={pos:V3(cw.x-ux*1.5,cw.y,cw.z-uz*1.5),vel:V3(ux*8,0,uz*8),fuse:9,armOnFuse:false,at:true,team:0,spin:null,bounces:0};
		let r1='none';
		for(let i=0;i<240;i++){ const ev=nadeStep(st1,1/30); if(ev!=='none'&&ev!=='bounced'){ r1=String(ev); break; } }
		// ② 未武装手雷: 盒顶上方 1m 自由落体 ⇒ 顶面弹回, 任何一步都不许进盒 (margin 内算外)
		const st2={pos:V3(cw.x,cw.y+b.hh+1.0,cw.z),vel:V3(0,-3,0),fuse:3.4,armOnFuse:true,kind:'frag',team:0,spin:null,bounces:0};
		let inside=false;
		for(let i=0;i<120;i++){
			nadeStep(st2,1/60);
			if(capSuperSolidAt(st2.pos.x,st2.pos.y,st2.pos.z)){ inside=true; break; }
		}
		return {r1, blowY:Math.round(st1.pos.y*10)/10, boxY:Math.round(cw.y*10)/10, inside};
	})()`);
	judge(t15&&!t15.__err&&t15.r1==='blow'&&!t15.inside,'T15 BUG-B: 手雷/实体不穿桥楼 (武装触炸+未武装弹回)','武装弹='+t15.r1+' (旧版=fizzle 穿盒落海) 未武装穿盒='+t15.inside);

	// ── T16 BUG-C: 伞降触水面即收伞转游泳 (不下海床) ──
	const t16=NT(ctx,`(()=>{
		const s=capitalShips.find(x=>x.team===0);
		const wx=s.pos.x+260, wz=s.pos.z+140;                 // 舷外远海点
		const wy=waterYAt(wx,wz), bed=heightAt(wx,wz), dep=waterDepthAt(wx,wz);
		if(!(wy>-1e8)||dep<=1.2) return {__err:'试验点非深水 (dep='+String(dep)+')'};
		const bot=new Bot(0,0,'伞兵'); bot.spawn();
		bot.chuteBegin(wx,wy+26,wz);
		let cleared=null, frames=0;
		for(let i=0;i<40*40;i++){
			bot.update(1/40); frames++;
			if(!bot.chute&&!bot.chuting){ cleared={y:bot.pos.y,f:frames}; break; }
		}
		if(!cleared) return {__err:'40s 未收伞 (沉底旧症)'};
		bot.update(1/40);                                     // 落水次帧: 水态块接管 → swim
		return {aboveBed:Math.round((cleared.y-bed)*10)/10, depth:Math.round(dep*10)/10,
			frames, swim:!!bot.swim, wy:Math.round(wy*10)/10};
	})()`);
	judge(t16&&!t16.__err&&t16.aboveBed>4&&t16.swim,'T16 BUG-C: 伞降触水面即收伞转游泳 (不再沉到海床才解除)','收伞帧='+t16.frames+' 离海床='+t16.aboveBed+'m (水深'+t16.depth+') 泳态='+t16.swim);
}

// ══════ ironbottom 快查: 无 CV 战役的飞机重生保持旧口径 (逐位零变化) ══════
say('');
const Bi=boot(CI_IRON);
if(Bi.loadErrors.length===0){
	const t13=NT(Bi.ctx,`(()=>{
		startMatch&&startMatch();
		const pl=planes.find(p=>p.team===0);
		const cv=(typeof capCarrierOfTeam==='function')?capCarrierOfTeam(0):null;
		pl.capArrest=null;
		const bp=basePos(0);
		pl.respawn();
		return {cvNull:cv===null, noCvSpawn:Math.hypot(pl.pos.x-bp.x,pl.pos.z-bp.z)<30, alive:pl.alive};
	})()`);
	judge(t13&&!t13.__err&&t13.cvNull&&t13.noCvSpawn,'T13 铁底湾: 无 CV ⇒ 重生保持 basePos 上空旧口径','cvNull='+t13.cvNull+' 出生贴基地='+t13.noCvSpawn);
}else{
	judge(false,'启动链: ironbottom LOAD 不报错',Bi.loadErrors.map(e=>e.file+' → '+e.err).join(' || ').slice(0,600));
}

say('');
say('══ 结果: '+nPass+' 通过 / '+nFail+' 失败 ══');
try{ fs.writeFileSync(path.join(OUTDIR,'navalround6-20261003.txt'),OUT.join('\n')); }catch(e){}
process.exit(nFail?1:0);
