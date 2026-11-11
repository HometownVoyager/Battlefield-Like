// ─────────────────────────────────────────────
// dev/probe-animfix-20261012.js —— 2026-10-12 左臂朝向 + 读条取消/互斥批的**真浏览器**验收
//
// 与 dev/verify-animfix-20261012.js 的分工:
//   沙箱探针 = 判据主力 (真 three + 真 updatePlayer 推帧, 含 --neg 阴性对照);
//   本探针   = 只验"沙箱里证不了的那几件": ① 真渲染器里的左臂两端坐标 (沙箱是 hand-built matrixWorld)
//              ② 屏上的读条与 ✕ 按钮真的画出来了 (布局事实, 取 getClientRects)
//              ③ 真 Input.dispatchMouseEvent 点 ✕ / 真 keydown X 键 → 状态真的被取消
//              ④ 真主循环 (rAF) 跑着的时候, 别的行动抢走身体 ⇒ 模型不留滞
//
// 用法: node dev/probe-animfix-20261012.js [url]   (需先起静态服 .serve.js: http://localhost:8000)
// ─────────────────────────────────────────────
'use strict';
const {openPage,sleep}=require('./cdp');
const URL=process.argv[2]||'http://localhost:8000/index.html';

// 页内公共片段: 量左臂两端 (袖管肩端 = 局部 z=+0.25 / 掌心 = 局部 z=-VM_PALM_L)
// ★ "掌心逐位不变"比的是**臂组父坐标系**里的掌心 (pl): 根姿态里有一项呼吸摆动
//   (oy+=sin(performance.now()*1.4)*0.0022) 是挂钟时间的函数 ⇒ 量世界系会把"两次调用之间
//   差的那几毫秒呼吸相位"读成"手滑走了 ~1.5mm"。父坐标系把 root/sway/recoil 的时变项一起约掉。
const HELP=`
window.__arm=()=>{ VM.inner.updateMatrixWorld(true);
 const az=z=>VM.arms.L.localToWorld(new THREE.Vector3(0,0,z));
 const sl=az(0.25), pa=az(-VM_PALM_L);
 const par=VM.arms.L.parent; par.updateMatrixWorld(true);
 const pp=par.worldToLocal(pa.clone());
 const azR=z=>VM.arms.R.localToWorld(new THREE.Vector3(0,0,z));
 const slR=azR(0.25), paR=azR(-VM_PALM_L);
 const ppR=par.worldToLocal(paR.clone());
 return {sl:[sl.x,sl.y,sl.z], pa:[pa.x,pa.y,pa.z], pl:[pp.x,pp.y,pp.z], ry:VM.arms.L.rotation.y,
         slR:[slR.x,slR.y,slR.z], paR:[paR.x,paR.y,paR.z], plR:[ppR.x,ppR.y,ppR.z], ryR:VM.arms.R.rotation.y}; };
window.__pose=(key,st,k,mode)=>{ const d=WPN_DEFS[key];
 player.curW={key:key,def:d,mag:d.mag,reserve:d.reserve};
 player.ads=false; player.sprinting=false; player.crouch=false; player.prone=false;
 player.onGround=true; player.braced=false; player.leanT=0; player.landDip=0;
 player.vel.set(0,0,0); player.holdBreath=false; player.nadeHeld=false;
 player.bandaging=0; player.pendingBuild=null; player.grabAction=null;
 vmEquip(key,0);
 const dur=st==='reload'?(d.reload||2.5):(st==='grab'?0.85:BANDAGE_T);
 VM.state=st; VM.stateDur=dur; VM.stateT=k*dur;
 if(st==='grab') player.grabAction={kind:'ammo',crate:{x:0,z:0}};
 if(mode==='snapoff'){ window.__snapSaved=vmHandLSnap; vmHandLSnap=p=>p; }   // 页内阴性对照: 关掉袖管归位
 for(let i=0;i<20;i++){ VM.stateT=k*dur; if(st==='bandage') player.bandaging=dur*(1-k); updateViewModel(1/60,player); }
 if(mode==='legacy'){   // 页内阴性对照: 按回 2026-10-05 那版旧字面量 (腕位 + 旧姿态角)
  const LG={grab:[[-0.04,-0.08,-0.22],[0.4,0,0]],rocketreload:[[-0.04,-0.09,-0.24],[0.42,0,0]],
            bandage:[[-0.08,-0.035,-0.05],[0.12,1.2,0.08]]}[st==='reload'&&d.rocket?'rocketreload':st];
  if(LG){ VM.arms.L.position.set(LG[0][0],LG[0][1],LG[0][2]); VM.arms.L.rotation.set(LG[1][0],LG[1][1],LG[1][2]); }
 }
 const r=window.__arm();
 if(window.__snapSaved){ vmHandLSnap=window.__snapSaved; window.__snapSaved=null; }
 return r; };
window.__bandage=(k)=>{ player.alive=true; player.spectator=false; player.hp=50; player.bandages=4;
 player.bandaging=BANDAGE_T*(1-k); player.lastDmgT=nowT;
 VM.state='bandage'; VM.stateT=BANDAGE_T*k; VM.stateDur=BANDAGE_T;
 return {hp:player.hp,bandages:player.bandages}; };
window.__readState=()=>{ const db=window._demolishBar;
 const btn=document.getElementById('castCancelBtn');
 const vis=e=>{ if(!e) return false; const rs=e.getClientRects(); for(const r of rs) if(r.width>0&&r.height>0) return true; return false; };
 return {active:player.readBarActive(), bandaging:+player.bandaging.toFixed(3), state:VM.state,
  hp:player.hp, bandages:player.bandages, alive:player.alive,
  bmVis:!!(VM.bandageM&&VM.bandageM.visible), wrapVis:!!(VM.arms.L.userData.wrap&&VM.arms.L.userData.wrap.visible),
  barDisplay:db?getComputedStyle(db.wrap).display:'MISSING', barRendered:db?vis(db.wrap):false,
  btnRendered:vis(btn), btnText:btn?btn.textContent:'MISSING'}; };
`;

let fails=0,total=0;
function ok(label,cond,detail){ total++; if(!cond) fails++;
 console.log((cond?'  [PASS] ':'  [FAIL] ')+label+(detail?'\n         '+detail:'')); }

(async()=>{
const pg=await openPage(null,{width:1600,height:1000});
try{
console.log('== 2026-10-12 左臂朝向 + 读条取消 (真浏览器) ==');
await pg.goto(URL);
await pg.waitFor('!!window.__sfBooted',45000);
await sleep(1200);
await pg.eval('startGame()'); await sleep(2600);
await pg.eval('deployPlayer()'); await sleep(2600);
await pg.eval(HELP);
await pg.eval(`player.protUntil=1e9; player.spectator=false; player.alive=true;`);  // 免被 Bot 打死打乱取证
const body=await pg.eval('document.body.className');
console.log('  [环境] body="'+body+'"  已部署='+await pg.eval('!!player.deployed'));

// ── ① 真渲染器里的左臂两端 (修后 vs 页内旧字面量) ──
console.log('\n── ① 左臂两端 (真渲染器坐标) ──');
for(const c of [['取弹药 (grab)','kar98','grab',0.5],['火箭筒换弹 (bazooka reload)','bazooka','reload',0.55],['包扎 (bandage)','kar98','bandage',0.4]]){
 const F=await pg.eval(`(()=>{return window.__pose(${JSON.stringify(c[1])},${JSON.stringify(c[2])},${c[3]},'fixed');})()`);
 if(c[0].includes('包扎')) await pg.screenshot('dev/out/animfix-20261012-bandage-after.png');
 else if(c[0].includes('grab')) await pg.screenshot('dev/out/animfix-20261012-grab-after.png');
 else await pg.screenshot('dev/out/animfix-20261012-bazooka-after.png');
 const L=await pg.eval(`(()=>{return window.__pose(${JSON.stringify(c[1])},${JSON.stringify(c[2])},${c[3]},'legacy');})()`);
 if(c[0].includes('包扎')) await pg.screenshot('dev/out/animfix-20261012-bandage-before.png');
 else if(c[0].includes('grab')) await pg.screenshot('dev/out/animfix-20261012-grab-before.png');
 else await pg.screenshot('dev/out/animfix-20261012-bazooka-before.png');
 const dp=Math.max(...[0,1,2].map(i=>Math.abs(F.pl[i]-L.pl[i])));
 const dpw=Math.max(...[0,1,2].map(i=>Math.abs(F.pa[i]-L.pa[i])));
 ok(c[0]+': 袖管肩端在掌心左侧且出到画面左半 (旧写法在右半)',
  F.sl[0]<F.pa[0]&&F.sl[0]<0&&L.sl[0]>0,
  `修后 肩端x=${F.sl[0].toFixed(3)} < 掌心x=${F.pa[0].toFixed(3)} rotY=${F.ry.toFixed(3)}  |  旧 肩端x=${L.sl[0].toFixed(3)} rotY=${L.ry.toFixed(3)}`);
 ok(c[0]+': 掌心落点逐位不变 (手不滑走)',
  dp<1e-9&&dpw<0.005,
  `父坐标系偏差 ${dp.toExponential(2)}m (腕位反解误差) / 世界系偏差 ${dpw.toExponential(2)}m (含呼吸摆动 ~2mm 相位差)`);
  if(c[0].includes("包扎")){
   ok("包扎 (bandage): 右臂袖管肩端在画面右半 (x>0, 不再扎根左肩)",
    F.slR[0]>0, `肩端 x=${F.slR[0].toFixed(3)}`);
   ok("包扎 (bandage): 右臂 rotY 落在正角带 [+0.60, +0.90]",
    F.ryR>=0.60&&F.ryR<=0.90, `rotY=${F.ryR.toFixed(3)}`);
  }
}
// ①b 左下置弹匣的**物理**换匣 (BAR/百式): 位姿由 vmHoldPose 解算, 逐相位都要在画面左半
for(const [label,w] of [['勃朗宁 BAR 物理换匣','bar'],['百式 物理换匣','type100']]){
 let worst=-9,worstK=0,dMax=0,tr=[];
 for(const k of [0.15,0.3,0.5,0.7,0.9]){
  const F=await pg.eval(`(()=>{return window.__pose(${JSON.stringify(w)},'reload',${k},'fixed');})()`);
  const U=await pg.eval(`(()=>{return window.__pose(${JSON.stringify(w)},'reload',${k},'snapoff');})()`);
  dMax=Math.max(dMax,Math.max(...[0,1,2].map(i=>Math.abs(F.pl[i]-U.pl[i]))));
  if(F.sl[0]>worst){ worst=F.sl[0]; worstK=k; }
  tr.push(`k=${k}:修后${F.sl[0].toFixed(3)}/关归位${U.sl[0].toFixed(3)}`);
  if(k===0.3){ await pg.screenshot(`dev/out/animfix-20261012-${w}-fix.png`); }
 }
 const U0=await pg.eval(`(()=>{return window.__pose(${JSON.stringify(w)},'reload',0.3,'snapoff');})()`);
 await pg.screenshot(`dev/out/animfix-20261012-${w}-snapoff.png`);
 ok(label+': 逐相位 (0.15/0.3/0.5/0.7/0.9) 袖管都在画面左半',worst<0,
  `最差相位 k=${worstK} 肩端x=${worst.toFixed(3)}  ${tr.join('  ')}`);
 ok(label+': 关掉归位后袖管确实在画面右半 (页内阴性对照) + 掌心逐位不变',
  U0.sl[0]>0&&dMax<1e-9,`关归位 肩端x=${U0.sl[0].toFixed(3)} (>0=旧观感) / 掌心偏差 ${dMax.toExponential(2)}m`);
}

// ── ② 屏上读条 + ✕ 按钮的布局事实 ──
console.log('\n── ② 读条与 ✕ 按钮 (布局事实) ──');
await pg.eval('window.__bandage(0.4)'); await sleep(400);
const s1=await pg.eval('window.__readState()');
await pg.screenshot('dev/out/animfix-20261012-castbar.png');
ok('包扎读条中: 进度条可见 + ✕ 按钮可见 + 按钮文案是 ✕',
 s1.barRendered&&s1.btnRendered&&s1.btnText==='✕',
 `bar=${s1.barDisplay} rendered=${s1.barRendered} btn=${s1.btnRendered} 文案=${JSON.stringify(s1.btnText)}`);
const barLabel=await pg.eval("(()=>{const d=window._demolishBar; return d.lb.textContent;})()");
ok('读条标签按剩余秒走 BANDAGE_T 单源 (不是写死 2.6 的野数)',
 /包扎中: [0-9.]+s/.test(barLabel),`标签=${JSON.stringify(barLabel)}`);

// ── ③ 点 ✕ 取消 ──
console.log('\n── ③ 点 ✕ 取消 ──');
await pg.click('#castCancelBtn'); await sleep(400);
const s2=await pg.eval('window.__readState()');
ok('点 ✕ 后: 读条归零 + VM 回 idle + 绷带卷收起 + 缠臂环收起 + 读条条隐藏',
 s2.bandaging===0&&s2.state==='idle'&&s2.bmVis===false&&s2.wrapVis===false&&s2.barRendered===false,
 `bandaging=${s2.bandaging} state=${s2.state} 卷=${s2.bmVis} 环=${s2.wrapVis} bar=${s2.barDisplay}`);
ok('点 ✕ 取消**不白送治疗** (hp 未涨 / 绷带未扣)',
 s2.hp===s1.hp&&s2.bandages===s1.bandages,`hp ${s1.hp}→${s2.hp}  绷带 ${s1.bandages}→${s2.bandages}`);

// ── ④ 真 keydown X 键取消 ──
console.log('\n── ④ X 键取消 (真 keydown) ──');
await pg.eval('window.__bandage(0.3)'); await sleep(350);
const s3=await pg.eval('window.__readState()');
await pg.key('KeyX','x'); await sleep(400);
const s4=await pg.eval('window.__readState()');
ok('X 键: 读条中确实在跑 (取证前提)',s3.active===true&&s3.bandaging>0,`bandaging=${s3.bandaging}`);
ok('X 键取消: 归零 + idle + 模型收起 + 条隐藏',
 s4.bandaging===0&&s4.state==='idle'&&s4.bmVis===false&&s4.wrapVis===false&&s4.barRendered===false,
 `bandaging=${s4.bandaging} state=${s4.state} 卷=${s4.bmVis} 环=${s4.wrapVis}`);

// ── ⑤ 真主循环下的"被别的行动抢走" ⇒ 不留模型 ──
console.log('\n── ⑤ 取弹药抢走读条 (真主循环 rAF) ──');
await pg.eval('window.__bandage(0.4)'); await sleep(350);
const s5=await pg.eval('window.__readState()');
const hpBefore=await pg.eval('player.hp');
// 与 20-player 的弹药箱分支逐字同款: 抢 VM.state, 不碰 bandaging
await pg.eval(`player.grabAction={kind:'ammo',crate:{x:0,z:0}}; VM.state='grab'; VM.stateT=0; VM.stateDur=0.85; vmSndFlags={};`);
await sleep(700);   // 让真主循环推几十帧
const s6=await pg.eval('window.__readState()');
const hpAfter=await pg.eval('player.hp');
await pg.screenshot('dev/out/animfix-20261012-stolen.png');
ok('抢走前读条确实在跑 + 卷与环都在手上 (取证前提)',
 s5.active===true&&s5.bmVis===true&&s5.wrapVis===true,`bandaging=${s5.bandaging} 卷=${s5.bmVis} 环=${s5.wrapVis}`);
ok('被抢走 ⇒ 读条按"被打断"收账 (归零), 模型无滞留 (卷/环全收)',
 s6.bandaging===0&&s6.bmVis===false&&s6.wrapVis===false&&s6.state==='grab',
 `bandaging=${s6.bandaging} 卷=${s6.bmVis} 环=${s6.wrapVis} state=${s6.state}`);
ok('被打断不回血 (真主循环 0.7s 里 hp 没涨)',hpAfter<=hpBefore,`hp ${hpBefore}→${hpAfter}`);

console.log('\n== 小结: '+(total-fails)+'/'+total+' 通过 ==');
process.exitCode=fails?1:0;
}catch(e){
console.error('[探针异常] '+e.message);
(pg.pageErrors||[]).slice(0,8).forEach(x=>console.error('   '+x));
process.exitCode=2;
}finally{ await pg.close(); }
})();
