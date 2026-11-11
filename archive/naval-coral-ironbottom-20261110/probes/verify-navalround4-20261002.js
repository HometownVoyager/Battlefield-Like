// ──────────────────────────────────────────────────────────────────────────────
// dev/verify-navalround4-20261002.js —— 海战实机反馈第四轮验收 (2026-10-02)
//
// 用户报的 5 条, 逐条对应判据:
//   ① 阵营栏一方显示灰色 → T1 旗点图标 DOM id 唯一化 (旧 fi<旗名> 两军同名撞车 ⇒ 后一军图标永不更新)
//   ② 旁观模式甲板以上没有碰撞 → T2a 观战者进乘员表 + T2b capLocalSolve 对他生效
//   ③ 在船上移动非常慢 → T2c 观战者被平台搬运 (旧版甲板=跑步机: 舰走人不跟)
//   ④ 旗帜卡在甲板以上的结构里 → T3 甲板旗点"杆+旗面"双判据 (旧坐标做阴性对照证明判据有牙)
//   ⑤ 友方之间撞船+穿模 → T4a 艇↔艇推挤去 0.5m 绝对限幅 (对开不再对穿) + T4b Bot 让路预折
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
V3c.prototype.divideScalar=function(s){ s=s||1; this.x/=s; this.y/=s; this.z/=s; return this; };
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
function mulberry32(a){ return function(){ a|=0; a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }

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
	let start=null;
	try{ start=vm.runInContext(`(()=>{ try{ const b=document.getElementById('startBtn'); if(b&&b.onclick){ b.onclick(); return 'ok'; } return 'no-button'; }catch(e){ return 'ERR '+String(e&&e.stack||e); } })()`,ctx); }
	catch(e){ return {ctx,loadErrors,startErr:String(e&&e.stack||e)}; }
	return {ctx,loadErrors,startErr:null,start};
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
	judge(body.includes(needle),name,'锚: '+file+' 含「'+needle.slice(0,60)+'」'+(body.includes(needle)?'':' (未命中)'));
}
function srcNot(file,needle,name){
	const s=fs.readFileSync(path.join(root,file),'utf8');
	const body=s.split('\n').map(l=>l.replace(/\/\/.*$/,'')).join('\n');
	judge(!body.includes(needle),name,'锚: '+file+' 已无「'+needle.slice(0,60)+'」'+(!body.includes(needle)?'':' (仍在!)'));
}

say('== 海战实机反馈第四轮 · 验收 (dev/verify-navalround4-20261002.js) ==');
say('');

// ── 源锚: 五修各一条 (旧写法必须已绝迹 = 阴性对照的锚点同步更新) ──
srcHas('js/23-deploy.js','fi${i}','T1 图标 id 按索引 (23-deploy applyFlagOwnership)');
srcNot('js/23-deploy.js','`<span id="fi${f.id}">`','T1 旧"fi+旗名"建法已绝迹');
srcHas('js/22-hud.js',"el('fi'+i)",'T1 updateHUD 按索引取图标');
srcNot('js/22-hud.js',"el('fi'+f.id)",'T1 旧"el(fi+旗名)"读法已绝迹');
srcNot('js/15h-capital.js','a.isPlayer&&a.spectator','T2 观战者不再被排除在乘员搬运外');
srcHas('js/14-bots.js','navVesselAhead','T4b Bot 让路预折已接线 (navSteer)');
srcNot('js/15d-naval.js','(3+spd)*dt*2.2,0.5','T4a 艇↔艇推挤 0.5m 绝对限幅已删除');

// ══════ T1: 图标 id 唯一 (coral 实跑 applyFlagOwnership 后查 DOM) ══════
say('');
const B=boot(12);
if(B.loadErrors.length){
	judge(false,'启动链: coral 全脚本 LOAD 不报错',B.loadErrors.map(e=>e.file+' → '+e.err).join('  ||  ').slice(0,900));
}else{
	judge(true,'启动链: coral 全脚本 LOAD 不报错','共 '+FILES.length+' 个脚本 (与 index.html 实载一致)');
	const ctx=B.ctx;
	const t1=NT(ctx,`(()=>{
		// _bootstub 的 innerHTML 是**原样字符串** (不解析成 children) ⇒ 直接正则提取 id 清单
		const html=document.getElementById('flagIcons').innerHTML;
		const ids=[...html.matchAll(/id="(fi[^"]+)"/g)].map(m=>m[1]);
		const uniq=new Set(ids);
		const mapOk=FLAGS.every((f,i)=>ids.indexOf('fi'+i)>=0);
		return {n:FLAGS.length,spans:ids.length,uniq:uniq.size,mapOk,sample:ids.slice(0,6)};
	})()`);
	judge(t1.mapOk&&t1.uniq===t1.n&&t1.spans===t1.n,'T1 旗点图标 id 逐旗唯一且 updateHUD 可寻址',
		'FLAGS='+t1.n+' spans='+t1.spans+' 唯一id='+t1.uniq+' 样例: '+t1.sample.join(','));
	// 阴性对照: 旧方案 (fi+旗名) 在海战图必撞车 —— 证明"唯一 id"这条判据不是空转
	const t1n=NT(ctx,`(()=>{
		const oldIds=FLAGS.map(f=>'fi'+f.id);
		return {total:oldIds.length,uniq:new Set(oldIds).size};
	})()`);
	judge(t1n.uniq<t1n.total,'T1-阴 旧 id 方案在 coral 必撞车 ('+t1n.uniq+'/'+t1n.total+') —— 判据非空转',
		'旧方案 6 面旗只有 '+t1n.uniq+' 个唯一 id, 后一军图标从未被更新 (灰色的根)');

	// ══════ T2: 观战者 = 甲板上的人 (搬运 + 局部绕行) ══════
	const t2=NT(ctx,`(()=>{
		const s=capitalShips.find(x=>x.spec.cls==='bb'); if(!s) return {__err:'no bb'};
		player.spectator=true; player.alive=true; player.onVehicle=null; player.onNaval=null; player.capCrew=null;
		// a) 搬运: 站在甲板中央 (局部 0,+8), 舰前移 5m ⇒ 人跟着走
		const w1=capToWorld(s,0,8,new THREE.Vector3());
		player.pos.set(w1.x,s.pos.y+s.deck.y,w1.z); player.vel.set(0,0,0);
		capRideCollect(s);
		const inRiders=s._riders.some(r=>r.a===player);
		const before=player.pos.clone();
		s.pos.x+=5;
		capRideApply(s);
		const carried=Math.hypot(player.pos.x-before.x,player.pos.z-before.z);
		s.pos.x-=5; player.pos.set(w1.x,s.pos.y+s.deck.y,w1.z);
		// b) 局部绕行: 观战者放进舰桥塔足迹中央 (局部 0,+10) ⇒ 必须被推出塔命中盒外
		const box=s.boxes.find(b=>b.name==='cpSup');
		const w2=capToWorld(s,0,10,new THREE.Vector3());
		player.pos.set(w2.x,s.pos.y+s.deck.y,w2.z);
		capLocalSolve(player,s);
		const loc=capToLocal(s,player.pos.x,player.pos.z,new THREE.Vector3());
		// 判据 = 解算后不再与**任何**该拦人的盒子重叠 (同一套竖直门: 件顶在脚下/件底在头顶的都跳过)
		const yl=player.pos.y-s.pos.y;
		const stuck=s.boxes.some(b=>{
			if(yl>=b.ly+b.hh||yl+1.75<b.ly-b.hh) return false;
			// 分离复查带 1e-6 容差 (推挤贴合规约: 另一条代码路径算投影, 浮点余量会造出 1e-15 级假重叠)
			return Math.abs(loc.x-b.lx)<b.hw+0.42-1e-6&&Math.abs(loc.z-b.lz)<b.hd+0.42-1e-6;
		});
		const out=!stuck;
		// 阴性: 甲板上的空旷点 (8.3,14) 不得被推 (判据不许"永远在推")
		const w3=capToWorld(s,8.3,14,new THREE.Vector3());
		player.pos.set(w3.x,s.pos.y+s.deck.y,w3.z);
		const p3=player.pos.clone();
		capLocalSolve(player,s);
		const untouched=Math.hypot(player.pos.x-p3.x,player.pos.z-p3.z)<1e-6;
		return {inRiders,carried:+carried.toFixed(3),out,boxhw:+box.hw.toFixed(2),locx:+loc.x.toFixed(2),untouched};
	})()`);
	judge(!t2.__err&&t2.inRiders&&t2.carried>4.5,'T2a/c 观战者进乘员表且被平台搬运 (5m 舰移 ⇒ 人位移 '+t2.carried+'m)',
		t2.__err||'旧版: 观战者不入表 ⇒ 舰走人不跟 (甲板跑步机 = "船上移动非常慢")');
	judge(!t2.__err&&t2.out,'T2b 观战者在舰桥塔足迹内会被 capLocalSolve 推出 (lx='+t2.locx+' > 塔半宽 '+t2.boxhw+'+0.4)',
		t2.__err||'"旁观模式甲板以上全都没碰撞"的正面判据');
	judge(t2.untouched,'T2-阴 甲板空旷点 (8.3,14) 不被推 —— 绕行判据非空转');

	// ══════ T3: 甲板旗点 "杆+旗面" 双判据 (对全部海战图离线扫) ══════
	// 判据口径 (与 00-config 2026-10-02 注释同源):
	//   杆: 旗点局部点必须距**所有**顶面高过甲板面+1 的盒子足迹 ≥0.5m (杆身/杆基不入结构);
	//   旗面: 顶面够到旗面带 (甲板面+5.4 以上) 的盒子 (塔/舰岛/炮塔), 旗点距其足迹须 > hw×0.9+2.3
	//        (0.9 = 粗包盒比旗面带处真实墙面 (层1/舰岛) 的外扩补偿; 2.3 = 旗面长 2.4 − 挂边余量)。
	const t3=NT(ctx,`(()=>{
		const bad=[]; let n=0;
		const oldCk=[];   // 阴性: 旧坐标必须被判红
		for(const C of CAMPAIGNS){
			if(!C.capital||!C.capital.length) continue;
			for(let si=0;si<C.capital.length;si++){
				const cc=C.capital[si], S=CAPITAL_SPEC[cc.key];
				if(!S) continue;
				const boxes=capBuildModel(S).boxes;
				const deckY=S.deckY;
				const cs=Math.cos(cc.yaw), sn=Math.sin(cc.yaw);
				const toL=(wx,wz)=>{ const dx=wx-cc.x,dz=wz-cc.z; return {x:dx*cs-dz*sn,z:dx*sn+dz*cs}; };
				const chk=(lx,lz)=>{
					for(const b of boxes){
						if(b.ly+b.hh<=deckY+1.0) continue;                 // 顶面不过甲板面+1 ⇒ 与杆无关
						const dx=Math.max(Math.abs(lx-b.lx)-b.hw,0), dz=Math.max(Math.abs(lz-b.lz)-b.hd,0);
						if(Math.hypot(dx,dz)<0.5) return '杆入'+b.name;
						if(b.ly+b.hh>=deckY+5.4){
							const cx=Math.max(Math.abs(lx-b.lx)-b.hw*0.9,0), cz=Math.max(Math.abs(lz-b.lz)-b.hd*0.9,0);
							if(Math.hypot(cx,cz)<2.3) return '旗面扫'+b.name;
						}
					}
					return null;
				};
				for(const f of (C.flags||[])){
					if(f.ship!==si) continue;
					n++;
					const l=toL(f.x,f.z), hit=chk(l.x,l.z);
					if(hit) bad.push(C.id+':'+f.id+' 局部('+l.x.toFixed(1)+','+l.z.toFixed(1)+') '+hit);
				}
				// 阴性组: 本舰的旧旗位 (历史实机报障的两处) 必须被同一判据判红
				if(C.id==='coral'&&si<2){ const h=chk(0,10); if(h) oldCk.push(C.id+' 旧舰桥旗 (0,+10): '+h); }
				if(C.id==='ironbottom'&&si<1){ const h=chk(7.2,2); if(h) oldCk.push(C.id+' 旧舰桥旗 (7.2,+2): '+h); }
			}
		}
		return {n,bad:bad.slice(0,6),oldCk};
	})()`);
	judge(t3.n>=10&&t3.bad.length===0,'T3 全部战役甲板旗点过"杆+旗面"双判据 (n='+t3.n+')',t3.bad.join(' ; ')||'全部干净');
	judge(t3.oldCk.length>=2,'T3-阴 旧旗位坐标被同一判据判红 —— 判据有牙',t3.oldCk.join(' ; '));

	// ══════ T4a: 艇↔艇对开不再对穿 (物理全量解算) ══════
	const t4=NT(ctx,`(()=>{
		const a=navalCraft.find(x=>x.kind==='boat'&&x.alive), b=navalCraft.find(x=>x.kind==='boat'&&x.alive&&x!==a);
		if(!a||!b) return {__err:'need 2 boats, got '+(a?1:0)};
		a.state='run'; b.state='run'; a.alive=true; b.alive=true;
		// 对开: a 在南头朝北 (+z), b 在北头朝南, PT 全速 29m/s; 位移由本探针手动积分 (只验推挤, 不跑 drive)
		a.pos.set(0,0,-4); b.pos.set(0,0,4); a.yaw=0; b.yaw=Math.PI;
		a.vel=29; b.vel=29;
		const ax=b.pos.z-a.pos.z;                     // 初始有符号间距 +8m
		for(let i=0;i<60;i++){
			a.pos.z+=29/60; b.pos.z-=29/60;            // 每帧闭合 0.97m (旧限幅 0.5m 追不上)
			navalPushCraft(a,1/60); navalPushCraft(b,1/60);
		}
		const sep=b.pos.z-a.pos.z;
		return {ax:+ax.toFixed(1),sep:+sep.toFixed(1),crossed:(sep*ax)<0};
	})()`);
	judge(!t4.__err&&!t4.crossed,'T4a 两艇 29+29m/s 对开 60 帧不换位 (有符号间距 '+t4.ax+'m → '+t4.sep+'m)',
		t4.__err||'旧 0.5m 绝对限幅: 每帧穿透增量 0.97m > 限幅, 几帧内互换位置 = 对穿');

	// ══════ T4b: Bot 让路预折 (navSteer 层, 桩 drive 捕获) ══════
	const t4b=NT(ctx,`(()=>{
		// 先把 T4a 残留的艇全部停到远海 (否则它们正好横在桩艇正前方, 污染净空/镜像两组判据)
		navalCraft.forEach((x,i)=>{ if(x&&x.alive){ x.pos.set(300+i*40,0,3000+i*40); } });
		const obs=navalCraft.find(x=>x.kind==='boat'&&x.alive);
		if(!obs) return {__err:'no obstacle boat'};
		obs.pos.set(30,0,0); obs.yaw=0; obs.state='run'; obs.alive=true; obs.spec=obs.spec||{hullL:20.5,hullW:5};
		const mk=(x,z,yaw)=>{ const cap={f:2,t:2,pos:new THREE.Vector3(x,0,z),yaw,spec:{hullL:20.5,hullW:5},drive:(f,t,dt)=>{cap.f=f;cap.t=t;}}; return cap; };
		// 本艇 yaw=0 ⇒ forward=(sin,cos)=(0,1)=+z。正前 30m 有船: 必须减速 + 转舵
		obs.pos.set(0,0,30);
		const c1=mk(0,0,0);
		navSteer(c1,0,1,1/60);
		// 净空: 前方 30m 无船 (障碍挪去正后) — 不触发让路
		obs.pos.set(0,0,-30);
		const c2=mk(0,0,0);
		navSteer(c2,0,1,1/60);
		// 镜像: 障碍移到右前/左前, 转舵必须反向 (lx=dx·cos−dz·sin, yaw=0 ⇒ lx=dx, 右舷=+x)
		// 放 ±8m: 必须落在避让走廊内 (|lx| < 双方半宽和+pad ≈ 10.3m), 否则判不出"瞄着它"
		obs.pos.set(8,0,26);                  // 右前 (lx>0)
		const c3=mk(0,0,0); navSteer(c3,0,1,1/60);
		obs.pos.set(-8,0,26);                 // 左前 (lx<0)
		const c4=mk(0,0,0); navSteer(c4,0,1,1/60);
		return {
			slow:+c1.f.toFixed(2), turn:+c1.t.toFixed(2),
			clearF:+c2.f.toFixed(2),
			rTurn:+c3.t.toFixed(2), lTurn:+c4.t.toFixed(2),
			mirror:(c3.t>0&&c4.t<0)||(c3.t<0&&c4.t>0)
		};
	})()`);
	judge(!t4b.__err&&t4b.slow<1&&t4b.turn!==0,'T4b 正前有船 ⇒ 减速('+t4b.slow+'×)+让路舵('+t4b.turn+')',
		t4b.__err||'"撞船"半边: Bot 不再对着前船开');
	judge(Math.abs(t4b.clearF-1)<1e-6,'T4b-阴 净空航道油门保持 1.0 —— 让路判据非空转 (实测 '+t4b.clearF+')');
	judge(t4b.mirror,'T4b 镜像对称: 右前障碍转舵 '+t4b.rTurn+' / 左前障碍转舵 '+t4b.lTurn+' 反向 (对开自动错船)');
}

// ══════ T5: ironbottom 全脚本烟囱 (第二张海战图也须零报错载入) ══════
say('');
const B2=boot(13);
if(B2.loadErrors.length){
	judge(false,'烟囱: ironbottom 全脚本 LOAD 不报错',B2.loadErrors.map(e=>e.file+' → '+e.err).join('  ||  ').slice(0,600));
}else{
	const t5=NT(B2.ctx,`({camp:CAMPAIGN.id,ships:capitalShips.length,flags:FLAGS.length})`);
	judge(t5.camp==='ironbottom'&&t5.ships===2&&t5.flags===6,'烟囱: ironbottom 载入 (2 舰 6 旗)',JSON.stringify(t5));
}

say('');
say('────────────────────────────────────────');
say('结果: '+nPass+' 通过 / '+nFail+' 失败');
fs.writeFileSync(path.join(OUTDIR,'navalround4-report.txt'),OUT.join('\n'));
process.exit(nFail?1:0);
