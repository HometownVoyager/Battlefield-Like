// ─────────────────────────────────────────────
// dev/probe-naval.js —— 海战系统 · 真浏览器端到端探针 (2026-09-20N 批, owner: verifier)
//
// 用法: node dev/probe-naval.js [url]              # 缺省自动找/起本仓静态服务器
//       node dev/probe-naval.js --sweep            # 全 12 图真浏览器启动链扫描 (红线 1 的另一半)
//       node dev/probe-naval.js --require-all      # 跳过也算失败 (交付前终验)
//
// 为什么必须有它: 沙箱套件 (dev/verify-naval.js) 走 THREE/DOM 桩, **验不了**真 DOM / 真输入链 /
//   WebGL 性能 / 真实脚本加载顺序。本文件用 dev/cdp.js 开真 Edge + CDP, 真加载 index.html。
//
// 三条判据坑 (本文件强制回避, 2026-09-20 本仓库踩过):
//   ① 祖先盲计数: 判"真的渲染了吗"用 getClientRects() 非零面积, 不看自身 computedStyle.display。
//   ② window.player 陷阱: 游戏里 player 是**顶层 const**, 不成为 window 属性 —— 本文件一律用
//      CDP eval 在页面作用域里**裸引用** `player` (Runtime.evaluate 能看见全局词法绑定),
//      绝不用 `window.player` / `!!window.player` (那会恒 false, 把正确行为报成 FAIL)。
//   ③ 404 文本滤不掉 favicon: console 里那条不带 URL 的 `404` 不是真失败 —— 本文件用
//      **Network 域**的 status>=400 + loadingFailed 清单实证, 再按 benign 白名单 (favicon/manifest) 过滤。
//
// 判据口径: 每条红线先由页面内 probe() 现算被测对象是否存在 (闸门), 不存在 ⇒ ⊘ 跳过 (exit 0);
//   存在 ⇒ 断言, 失败 ⇒ exit 1。**启动链断裂时不硬凑数字**: 只报断点证据, 其余红线记「被阻断」。
// ─────────────────────────────────────────────
'use strict';
const http=require('http');
const fs=require('fs');
const path=require('path');
const {openPage,sleep}=require('./cdp');

const ROOT=path.resolve(__dirname,'..');
const REQUIRE_ALL=process.argv.includes('--require-all');
const SWEEP=process.argv.includes('--sweep');
const ARG_URL=process.argv.slice(2).find(a=>/^https?:\/\//.test(a))||null;
const PORT_DEFAULT=8000;
const BENIGN=/favicon|manifest\.json/i;   // 浏览器自发请求; 本仓库无 favicon.ico (dev/_find404.js 已实证)
const ISLAND=11;                           // CAMPAIGNS 顺序: … 10 canyon, **11 island(塔拉瓦)**

// ── 静态服务器: 先用现成的 :8000, 不可达则本进程内起一个临时端口 (探针自包含, 不依赖别人先起服务) ──
function ping(url){
	return new Promise(res=>{
		const req=http.get(url,r=>{ r.resume(); res(r.statusCode===200); });
		req.on('error',()=>res(false));
		req.setTimeout(2500,()=>{ req.destroy(); res(false); });
	});
}
function serveStatic(){
	return new Promise(res=>{
		const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2','.map':'application/json'};
		const srv=http.createServer((q,s)=>{
			let p=decodeURIComponent((q.url||'/').split('?')[0]);
			if(p==='/') p='/index.html';
			const f=path.join(ROOT,p);
			if(!f.startsWith(ROOT)){ s.writeHead(403); return s.end('403'); }
			fs.readFile(f,(e,d)=>{
				if(e){ s.writeHead(404,{'Content-Type':'text/plain'}); return s.end('404'); }
				s.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store'});
				s.end(d);
			});
		});
		srv.listen(0,'127.0.0.1',()=>res({srv,url:'http://127.0.0.1:'+srv.address().port+'/index.html'}));
	});
}
async function ensureUrl(){
	if(ARG_URL) return {url:ARG_URL,own:null};
	const def='http://127.0.0.1:'+PORT_DEFAULT+'/index.html';
	if(await ping(def)) return {url:def,own:null};
	const own=await serveStatic();
	console.log('  (未发现 :'+PORT_DEFAULT+' 服务 ⇒ 本探针自起临时静态服务器 '+own.url+')');
	return {url:own.url,own:own.srv};
}

// ── 页面内取证脚本 (裸引用 player / renderer / navalCraft —— 坑②) ──
const BOOT_PROBE=`(()=>{ const ty=e=>{try{return typeof eval(e);}catch(err){return 'ERR';}};
 return {camp:(typeof CAMPAIGN!=='undefined'&&CAMPAIGN.id)||'?', booted:!!window.__sfBooted,
  href:location.href.slice(0,60), ls:ty('localStorage'),
  flagIds:(typeof FLAGS!=='undefined')?FLAGS.map(f=>f.id).join('|'):null,
  missing:(typeof FLAGS!=='undefined')?FLAGS.map(f=>'fi'+f.id).filter(id=>!document.getElementById(id)).join('|'):null}; })()`;

const PROBE=`(()=>{
const ty=e=>{ try{ return eval('typeof '+e); }catch(err){ return 'ERR'; } };
const cnt=(arr,f)=>{ try{ let n=0; for(const x of arr) if(f(x)) n++; return n; }catch(e){ return -1; } };
return {
 campaign:(typeof CAMPAIGN!=='undefined'&&CAMPAIGN.id)||'?',
 booted:!!window.__sfBooted,
 // 海战被测对象闸门 (词法作用域, 不用 window.*)
 NavalCraft:ty('NavalCraft'), navalCraft:ty('navalCraft'), updateNaval:ty('updateNaval'),
 BATTERIES:ty('BATTERIES'), updatePlayerNaval:ty('updatePlayerNaval'), playerNaval:ty('player.onNaval'),
 // 编制实数
 tankN0:cnt(tanks,t=>t.team===0), tankN1:cnt(tanks,t=>t.team===1), planeN:cnt(planes,()=>true),
 navalAll:cnt(navalCraft||[],()=>true),
 amph0:cnt(navalCraft||[],c=>c.team===0&&c.kind==='amph'), amph1:cnt(navalCraft||[],c=>c.team===1&&c.kind==='amph'),
 boat0:cnt(navalCraft||[],c=>c.team===0&&c.kind==='boat'), boat1:cnt(navalCraft||[],c=>c.team===1&&c.kind==='boat'),
 navalKeys:(navalCraft||[]).map(c=>c.spec&&c.spec.key).join(','),
 // 玩家态 (裸引用 player; 坑②)
 deployed:!!player.deployed, alive:!!player.alive, onNaval:(player&&player.onNaval)?true:false,
 // 渲染统计 (红线 10 的原始数字)
 calls:(typeof renderer!=='undefined'&&renderer.info)?renderer.info.render.calls:-1,
 tris:(typeof renderer!=='undefined'&&renderer.info)?renderer.info.render.triangles:-1,
 progs:(typeof renderer!=='undefined'&&renderer.info&&renderer.info.programs)?renderer.info.programs.length:-1,
 geos:(typeof renderer!=='undefined'&&renderer.info&&renderer.info.memory)?renderer.info.memory.geometries:-1,
 texs:(typeof renderer!=='undefined'&&renderer.info&&renderer.info.memory)?renderer.info.memory.textures:-1,
 // 祖先感知的"真的渲染了吗" (坑①): 用布局事实, 不用自身 computedStyle
 hudRendered:(()=>{ const e=document.getElementById('ui'); if(!e) return false; for(const r of e.getClientRects()) if(r.width>0&&r.height>0) return true; return false; })(),
 body:document.body.className};
})()`;

// 帧率采样 (headless + SwiftShader 下的 fps 只能当**同环境相对**参考, 不作绝对断言 —— 结论里已标注)
const FPS=`(async()=>{ let n=0; const t0=performance.now();
 await new Promise(res=>{ const tick=()=>{ n++; if(performance.now()-t0>3000) res(); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
 const dt=(performance.now()-t0)/1000; return {fps:+(n/dt).toFixed(1),sec:+dt.toFixed(2),frames:n}; })()`;

// 红线 10 的**战斗态**性能分解 (2026-09-20 修订):
//   第一版直接读玩家视角的 renderer.info ⇒ 得 11 calls / 150 tris, 且隐藏 10 台载具后**一点不变** ——
//   原因是海战载具全在远海集结点、不在玩家视锥里 (视锥剔除把它抹平了), 这种数字对"+35%"毫无判别力。
//   现在改成**确定性全景取景**: 把相机临时摆到岛心上方 520m 俯视, 手动 render 一帧, 读 calls/tris;
//   再隐藏全部海战载具 render 一帧 ⇒ 得到"非海战基线"。相机/可见性随后原样恢复并补渲染一帧。
const PERF=`(async()=>{
 const frames=n=>new Promise(res=>{ let k=0; const tick=()=>{ k++; if(k>=n) res(); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
 const read=()=>({calls:renderer.info.render.calls,tris:renderer.info.render.triangles,progs:(renderer.info.programs?renderer.info.programs.length:-1)});
 const med=a=>{ const s=a.slice().sort((x,y)=>x-y); return s[Math.floor(s.length/2)]; };
 const shoot=()=>{ renderer.render(scene,camera); return read(); };
 const pv=[]; for(let i=0;i<3;i++){ await frames(2); pv.push(read()); }          // 玩家视角 (仅参考)
 const cp=camera.position.clone(), cq=camera.quaternion.clone();
 camera.position.set(0,520,0); camera.lookAt(0,0,0); camera.updateMatrixWorld(true);
 const full=[]; for(let i=0;i<3;i++) full.push(shoot());
 const hid=[]; for(const c of (typeof navalCraft!=='undefined'?navalCraft:[])){ if(c&&c.grp){ hid.push([c,c.grp.visible]); c.grp.visible=false; } }
 const noNav=[]; for(let i=0;i<3;i++) noNav.push(shoot());
 for(const h of hid) h[0].grp.visible=h[1];
 camera.position.copy(cp); camera.quaternion.copy(cq); camera.updateMatrixWorld(true); shoot();
 return {playerView:{calls:med(pv.map(s=>s.calls)),tris:med(pv.map(s=>s.tris))},
   full:{calls:med(full.map(s=>s.calls)),tris:med(full.map(s=>s.tris)),raw:full.map(s=>s.calls)},
   noNaval:{calls:med(noNav.map(s=>s.calls)),tris:med(noNav.map(s=>s.tris)),raw:noNav.map(s=>s.calls)},
   hidN:hid.length, progs:full[0].progs,
   audio:((typeof AudioSys!=='undefined'&&AudioSys&&typeof AudioSys.audioDebug==='function')?AudioSys.audioDebug():null),   // 音频在管引擎数 (task-9 海战音效的性能变量)
   playerPos:(player&&player.pos)?[+player.pos.x.toFixed(2),+player.pos.y.toFixed(2),+player.pos.z.toFixed(2)]:null,
   deployed:!!player.deployed};
})()`;

// 选图并冷启动 (startGame 读当前选中战役; 冷启动才验得到 LOAD 链)
async function loadCampaign(pg,url,idx){
	if(idx!==null) await pg.eval("localStorage.setItem('sf_campaign',"+JSON.stringify(String(idx))+")");
	await pg.goto(url);
	const before=pg.pageErrors.length;
	let booted=false; const t0=Date.now();
	try{ await pg.waitFor('!!window.__sfBooted',18000); booted=true; }catch(e){}
	const ms=Date.now()-t0;
	const diag=await pg.eval(BOOT_PROBE);
	const errs=pg.pageErrors.slice(before);
	return {booted,ms,diag,errs};
}

// ── 启动链扫描 (--sweep): 逐图冷启动, 报 booted / 耗时 / 缺失的旗元素 / 首条异常 ──
async function sweep(pg,url){
	await pg.goto(url); await pg.waitFor('!!window.__sfBooted',45000);
	const ids=await pg.eval('CAMPAIGNS.map(c=>c.id)');
	console.log('== 全图真浏览器启动链扫描 ('+ids.length+' 张) ==');
	console.log('  #  战役         booted  LOAD耗时  FLAGS                       缺 fi 元素  异常数  首条异常');
	const rows=[];
	for(let i=0;i<ids.length;i++){
		const r=await loadCampaign(pg,url,i);
		const first=(r.errs[0]||'').replace(/\s+/g,' ').slice(0,90);
		rows.push({i,...r});
		console.log('  '+String(i).padStart(2)+' '+String(ids[i]).padEnd(12)+' '+(r.booted?'  ✓  ':'  ✗  ')+'  '+String(r.ms).padStart(6)+'ms  '
			+String(r.diag.flagIds||'(无)').slice(0,28).padEnd(28)+' '+String(r.diag.missing||'').slice(0,10).padEnd(10)+'  '+String(r.errs.length).padStart(4)+'   '+first);
	}
	const bad=rows.filter(r=>!r.booted);
	console.log('  小结: '+rows.filter(r=>r.booted).length+'/'+rows.length+' 张图真浏览器启动链跑完; 未跑完: '+(bad.map(r=>ids[r.i]+'(idx'+r.i+')').join(', ')||'(无)'));
	if(bad.length){
		console.log('  未跑完图的共同特征 (旗元素缺失 ⇔ 22-hud.js 的 el(\'fi\'+f.id) 取到 null):');
		for(const r of bad) console.log('    idx'+r.i+' '+ids[r.i]+'  缺: '+(r.diag.missing||'(无缺失?)')+'  首条异常: '+(r.errs[0]||'').replace(/\s+/g,' ').slice(0,140));
	}
	return rows.length-bad.length;
}

// ── 报告 ──
let nPass=0,nFail=0,nSkip=0;
function mark(state,n,name,detail){ console.log('  '+(state==='pass'?'✓':state==='fail'?'✗':'⊘')+' 红线'+n+' '+name+(detail?'   '+detail:'')); }
const pass=(n,name,d)=>{ nPass++; mark('pass',n,name,d); };
const fail=(n,name,d)=>{ nFail++; mark('fail',n,name,d); };
const skip=(n,name,d)=>{ nSkip++; mark('skip',n,name,d); };

(async()=>{
let own=null,pg=null;
try{
	const {url,own:srv}=await ensureUrl(); own=srv;
	console.log('== 海战系统 · 真浏览器端到端探针 (dev/probe-naval.js) ==');
	console.log('  URL: '+url);
	pg=await openPage(null,{width:1600,height:1000});
	// 坑③: 用 Network 域实证失败请求 (console 里的 '404' 文本滤不掉 favicon, 不作判据)
	const netBad=[];
	await pg.send('Network.enable');
	pg.on('Network.responseReceived',p=>{ const r=p.response||{}; if(r.status>=400) netBad.push(r.status+' ['+(p.type||'?')+'] '+r.url); });

	if(SWEEP){
		const okN=await sweep(pg,url);
		console.log('\n合计: '+okN+' 张图启动链跑完 (--sweep 模式: 0 失败判据, 只出证据表)');
		process.exitCode=0;
		return;
	}

	// 冷启动塔拉瓦 (先默认图确认脚本链可用, 再切 island 冷启动)
	await pg.goto(url); await pg.waitFor('!!window.__sfBooted',45000); await sleep(800);
	const isl=await loadCampaign(pg,url,ISLAND);
	console.log('  战役='+isl.diag.camp+'  booted='+isl.booted+' ('+isl.ms+'ms)  FLAGS='+(isl.diag.flagIds||'(无)'));
	// ── 红线 1: 启动链 (真浏览器) ──
	{
		const errs=isl.errs.filter(e=>!/favicon/i.test(e));
		const realBad=netBad.filter(u=>!BENIGN.test(u));
		if(!isl.booted){
			const hudNull=errs.filter(e=>/Cannot set properties of null/.test(e)).length;
			const line='!!window.__sfBooted 在 '+isl.ms+'ms 内未置位  |  页面异常='+errs.length+' 条 (其中 "设置 null 属性" = '+hudNull+' 条)'
				+'  |  FLAGS='+(isl.diag.flagIds||'(无)')+'  缺失旗元素=['+(isl.diag.missing||'')+']'
				+'  |  Network>=400(去favicon)='+realBad.length;
			fail(1,'启动链: 塔拉瓦 LOAD 不报错',line);
			console.log('       首条异常: '+(errs[0]||'(无)').replace(/\s+/g,' ').slice(0,220));
			console.log('       ⇒ 启动链未跑完, 红线 2/4/8/10 记「被阻断」(不硬凑数字); 证据脚本 22-hud.js / 23-deploy.js 旗图标契约');
			skip(2,'编制: 每队 2 坦克 + 2 两栖车 + 3 艇, 全图 1 机','（被红线1 阻断: 未进战斗态）');
			skip(4,'四档物理(真环境): 浪涌与浮标同相','（被红线1 阻断）');
			skip(8,'玩家链: 走到艇边按 F 上艇 / 驾驶 / 下车','（被红线1 阻断）');
			skip(10,'性能: draw call 增幅 ≤ +35% / 帧率','（被红线1 阻断: 无有效战斗帧）');
		}else{
			(errs.length===0&&realBad.length===0)?pass(1,'启动链: 塔拉瓦真浏览器 LOAD 无异常 / 无失败请求','未捕获异常=0  Network>=400(去 favicon)=0  LOAD '+isl.ms+'ms')
				:fail(1,'启动链: 塔拉瓦真浏览器 LOAD 无异常 / 无失败请求','未捕获异常='+errs.length+'  '+errs.slice(0,2).map(x=>x.replace(/\s+/g,' ').slice(0,110)).join(' | ')+'  Network>=400(去 favicon)='+realBad.length+'  '+realBad.slice(0,2).join(' | '));
			if(netBad.length&&!realBad.length) console.log('     · 已被 benign 白名单滤掉的自发请求: '+netBad.join(', '));

			// 进战斗态 (部署落地)
			await pg.eval('startGame()'); await sleep(2600);
			await pg.eval('deployPlayer()'); await sleep(2600);
			const s=await pg.eval(PROBE);
			const perf=await pg.eval(FPS);
			// 性能分解**先采**: 红线 8 会自建一台受控载具 (为了消除"艇在动"的漂移), 不能污染这一帧的场景账
			const P=await pg.eval(PERF);
			await pg.screenshot('dev/out/naval-island.png');

			// ── 红线 2: 编制 ──
			const g2=s.navalCraft==='object';
			const line2='坦克 '+s.tankN0+'/'+s.tankN1+'  两栖车 '+s.amph0+'/'+s.amph1+'  艇 '+s.boat0+'/'+s.boat1+'  飞机 '+s.planeN+'  海战实例 '+s.navalAll+'  型别=['+s.navalKeys+']';
			if(!g2) skip(2,'编制: 每队 2 坦克 + 2 两栖车 + 3 艇, 全图 1 机','（navalCraft 未定义, 待 15d + 23-deploy 落盘）'+line2);
			else{
				const ok=(s.tankN0===2&&s.tankN1===2&&s.amph0===2&&s.amph1===2&&s.boat0===3&&s.boat1===3&&s.planeN===1);
				ok?pass(2,'编制: 每队 2 坦克 + 2 两栖车 + 3 艇, 全图 1 机',line2):fail(2,'编制: 每队 2 坦克 + 2 两栖车 + 3 艇, 全图 1 机',line2);
			}
			// ── 红线 8: 玩家链 (真输入链; F 上艇) ──
			// 判据口径 (定稿 §11.6 + task-5): 上艇 = 水平距 <4.5m 且存活非敌方; **水上**(waterDepthAt>SWIM_DEPTH)
			//   额外要求水平距 <2.5m。第一版探针两个错都在探针侧: ①水上用了 3.0m (>2.5 被正确拒绝) ②玩家被放在
			//   海床上 (y=-5.9) 没等游泳态浮到水面 ⇒ 量的是"站在海底的人能不能上船"。现在: 反向 3.0m 必拒 + 正向 2.2m 必成,
			//   每次传送后等 90 帧并记录 player.swim / y / 水面高, 证明测的是"游泳的人"。
			const g8=s.navalCraft==='object'&&s.playerNaval!=='undefined';
			if(!g8) skip(8,'玩家链: 走到艇边按 F 上艇 / 驾驶 / 下车','（闸门未开: navalCraft='+s.navalCraft+' player.onNaval='+s.playerNaval+'）');
			else{
				// ★ 判据口径修正 (2026-09-20, 第三版): `navalNear` 的 r 是**到艇体侧面**的距离:
				//     d = 中心距 - spec.hullW*0.5 (15d:965) ⇒ 中心距 3.0m 对 LVT(半宽1.625) 只有 1.375m,
				//     在 2.5m 半径内 ⇒ **上艇是正确行为**, 我上一版"3.0m 必拒"是判据错 (假阳)。
				//   现按艇体距离构造四个方向: 水上 2.5m 分支 (正 1.4m / 负 3.0m) + 陆上 4.5m 分支 (正 3.4m / 负 5.0m)。
				const mk=async(where)=>{   // where: 'water' | 'land'  —— 自建静止载具 (无车组) + 记录 hullW
					return pg.eval(`(()=>{ try{
						const frames=n=>new Promise(r=>{ let k=0; const t=()=>{ k++; if(k>=n) r(); else requestAnimationFrame(t); }; requestAnimationFrame(t); });
						let px,pz;
						if('${where}'==='water'){ const m=CAMPAIGN.sea.muster[0]; px=m.x+8; pz=m.z; }
						else{ // 冲滩带浅水点 (水深 0.05~0.50m): 玩家处水深 < SWIM_DEPTH ⇒ 走陆上 4.5m 分支
							let s=null;
							for(let x=-240;x<=240&&!s;x+=4) for(let z=-240;z<=240;z+=4){ const d=waterDepthAt(x,z); if(d>0.05&&d<0.5){ s={x,z,d}; break; } }
							if(!s) return {err:'找不到冲滩带浅水点'};
							px=s.x; pz=s.z;
						}
						const c=new NavalCraft('lvt',0,9);
						c.pos.set(px,waterYAt(px,pz)-(c.spec?c.spec.draft0:0.4),pz);
						if(c.grp&&c.grp.position) c.grp.position.copy(c.pos);
						if(typeof c.vel==='number') c.vel=0;
						c.driverBot=null;
						window.__sfNavalTestC=c;
						return {where:'${where}',x:+c.pos.x.toFixed(2),z:+c.pos.z.toFixed(2),hullHalf:c.spec?+(c.spec.hullW*0.5).toFixed(3):null,
							depth:+waterDepthAt(px,pz).toFixed(2)};
					}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
				};
				// 一次尝试: 把玩家放到"艇体距离 = hullD"处, 等游泳态稳定, 按真 F 键, 读 onNaval
				const attempt=async(hullD)=>{
					const r=await pg.eval(`(async()=>{
						const c=window.__sfNavalTestC;
						const frames=n=>new Promise(r2=>{ let k=0; const t=()=>{ k++; if(k>=n) r2(); else requestAnimationFrame(t); }; requestAnimationFrame(t); });
						if(player.onNaval&&typeof navalSeatRelease==='function') navalSeatRelease();   // 每个子用例前先离座
						c.flood=0; c.state=(waterDepthAt(c.pos.x,c.pos.z)<0.55?'ground':'run'); c.alive=true; if(c.maxHp) c.hp=c.maxHp;
						const off=${hullD}+(c.spec?c.spec.hullW*0.5:0);                 // 中心距 = 艇体距 + 半宽
						player.pos.set(c.pos.x+off,waterYAt(c.pos.x+off,c.pos.z)-0.6,c.pos.z);
						await frames(90);
						if(player.onNaval&&typeof navalSeatRelease==='function') navalSeatRelease();
						c.flood=0; c.state=(waterDepthAt(c.pos.x,c.pos.z)<0.55?'ground':'run'); c.alive=true; if(c.maxHp) c.hp=c.maxHp;
						player.pos.set(c.pos.x+off,player.pos.y,c.pos.z);
						await frames(2);
						return {hullD:+(Math.hypot(player.pos.x-c.pos.x,player.pos.z-c.pos.z)-(c.spec?c.spec.hullW*0.5:0)).toFixed(2),
							centerD:+Math.hypot(player.pos.x-c.pos.x,player.pos.z-c.pos.z).toFixed(2),
							depth:+waterDepthAt(player.pos.x,player.pos.z).toFixed(2),swim:!!player.swim,
							y:+player.pos.y.toFixed(2),waterY:+waterYAt(player.pos.x,player.pos.z).toFixed(2),state:c.state};
					})()`);
					await pg.key('KeyF','f'); await sleep(800);
					const got=await pg.eval('(player&&player.onNaval)?true:false');
					// 若真键位没上艇, 立刻**直调 tryInteract()** 做定位 (座位逻辑 vs 输入闸门), 并把玩家态一起报出来
					let direct=null;
					if(!got) direct=await pg.eval(`(()=>{ const b=(player&&player.onNaval)?true:false; let err=null;
						try{ if(typeof tryInteract==='function') tryInteract(); }catch(e){ err=String(e&&e.message||e); }
						return {before:b,after:(player&&player.onNaval)?true:false,err,
							alive:!!player.alive,deployed:!!player.deployed,swim:!!player.swim,wading:!!player.wading,
							onVehicle:!!player.onVehicle,onGround:!!player.onGround,navalExit:!!player.navalExit,
							y:+player.pos.y.toFixed(2),depth:+waterDepthAt(player.pos.x,player.pos.z).toFixed(2),
							boardR:(typeof navalBoardRadius==='function')?+navalBoardRadius().toFixed(2):null,
							nearest:(typeof navalNearestBoardable==='function')?(!!navalNearestBoardable()):null}; })()`);
					return Object.assign(r,{onNaval:got,direct});
				};
				await pg.eval('(()=>{ window.__sfBatSaved=(typeof BATTERIES!=="undefined")?BATTERIES.map(b=>!!b.alive):[]; if(typeof BATTERIES!=="undefined") BATTERIES.forEach(b=>{b.alive=false;}); return true; })()');
				const W1=await mk('water'); const wNeg=await attempt(3.0); const wPos=await attempt(1.4);
				const L1=await mk('land');  const lNeg=await attempt(5.0); const lPos=await attempt(3.4);
				await pg.eval('(()=>{ if(typeof BATTERIES!=="undefined"&&window.__sfBatSaved) BATTERIES.forEach((b,i)=>{b.alive=!!window.__sfBatSaved[i];}); return true; })()');
				const f=(t,r,expect)=>`${t}: 艇体距=${r.hullD}m(中心${r.centerD}) 水深=${r.depth} swim=${r.swim} 艇态=${r.state} → onNaval=${r.onNaval}(期望${expect})`;
				const okW=(wNeg.onNaval===false&&wPos.onNaval===true), okL=(lNeg.onNaval===false&&lPos.onNaval===true);
				const line='水上场@('+W1.x+','+W1.z+') 水深'+W1.depth+'m 半宽'+W1.hullHalf+'  '+f('①水上负向2.5m',wNeg,'false')+'  '+f('②水上正向2.5m',wPos,'true')
					+'  ‖  陆上场@('+L1.x+','+L1.z+') 水深'+L1.depth+'m  '+f('③陆上负向4.5m',lNeg,'false')+'  '+f('④陆上正向4.5m',lPos,'true');
				(okW&&okL)?pass(8,'玩家链: 水上 2.5m / 陆上 4.5m 两分支的正反四向',line)
					:fail(8,'玩家链: 水上 2.5m / 陆上 4.5m 两分支的正反四向',line+'   判据: 水上正反='+okW+'  陆上正反='+okL);
			}
			// ── 红线 10: 性能 (战斗态; draw call 断言 / fps 仅同环境参考) ──
			{
				const share=P.noNaval.calls>0?(P.full.calls-P.noNaval.calls)/P.noNaval.calls:NaN;
				const trisShare=P.noNaval.tris>0?(P.full.tris-P.noNaval.tris)/P.noNaval.tris:NaN;
				const line='【全景取景 (岛心上方 520m 俯视, 手动 render)】draw calls: 含海战='+P.full.calls+' 去海战='+P.noNaval.calls+' (隐藏 '+P.hidN+' 台) ⇒ 海战增量='+(100*share).toFixed(1)+'%'
					+'  triangles: '+P.full.tris+' vs '+P.noNaval.tris+' ⇒ '+(100*trisShare).toFixed(1)+'%'
					+'  programs='+P.progs
					+'  |  玩家视角(仅参考, 视锥剔除主导) calls='+P.playerView.calls+' tris='+P.playerView.tris
					+'  玩家位='+JSON.stringify(P.playerPos)+' deployed='+P.deployed
					+'  |  headless 帧率='+perf.fps+'fps ('+perf.frames+' f / '+perf.sec+'s; SwiftShader 软渲染 ⇒ 只作同环境相对参考, 不作绝对判据)'
					+'  |  音频节点: '+(P.audio?('在管引擎='+P.audio.engines+' silenced='+P.audio.silenced+' gate='+P.audio.gate+' (task-9 海战音效会给 4 型载具加持续引擎声, 14 台是新增变量)'):'(audioDebug 不可用)')
					+'  |  原始 calls 序列 含='+JSON.stringify(P.full.raw)+' 去='+JSON.stringify(P.noNaval.raw);
				const base=process.env.NAVAL_BASE_CALLS?+process.env.NAVAL_BASE_CALLS:null;
				const okShare=Number.isFinite(share)&&share<=0.35;
				if(base!==null){
					const ratio=P.full.calls/base; const okR=ratio<=1.35;
					(okR?pass:fail)(10,'性能: draw call 增幅 ≤ +35% (外部基线)','baseline='+base+' 现='+P.full.calls+' 比值='+ratio.toFixed(3)+(okR?' ≤1.35':' >1.35')+'   | '+line);
				}else if(!okShare){
					fail(10,'性能: 海战 draw call 增量 ≤ +35% (全景开/关分解)',line+'   ✗ 增量 '+(100*share).toFixed(1)+'% > 35%');
				}else{
					pass(10,'性能: 海战 draw call 增量 ≤ +35% (全景开/关分解)',line+'   ✓ (口径: 本批同时把坦克 6→2/飞机 4→1, 真实"改造前"基线更高 ⇒ 本比值是保守上界)');
				}
			}
		}
	}
	console.log('');
	console.log('合计: '+nPass+' 通过 / '+nFail+' 失败 / '+nSkip+' 跳过'+(REQUIRE_ALL?'   (--require-all: 跳过=失败)':''));
	process.exitCode=(nFail||(REQUIRE_ALL&&nSkip))?1:0;
}catch(e){
	console.error('[探针异常] '+e.message);
	if(pg&&pg.pageErrors) pg.pageErrors.slice(0,8).forEach(x=>console.error('   '+x));
	console.error('  复现: node dev/probe-naval.js'+(ARG_URL?' '+ARG_URL:''));
	process.exitCode=2;
}finally{
	try{ if(pg) await pg.close(); }catch(e){}
	try{ if(own) own.close(); }catch(e){}
}
})();
