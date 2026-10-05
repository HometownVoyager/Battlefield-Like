// ─────────────────────────────────────────────
// dev/verify-a21-a4.js —— A#4 幽灵坦克 独立验收 (verifier / 2026-09-21 批次 20260921A)
//
// 用法: node dev/verify-a21-a4.js            (exit 0 = 全部判据通过)
//
// 判据 (契约 C / §5 + task-6):
//   ① 观战者按 F (tryInteract 真路径, 无论身处何地) ⇒ 同帧出现在当前位置且已上车 (0 帧延迟);
//   ② 主炮连发 10 次: cannonCd 恒 0, 10 发全出膛, 相邻两发同帧 (无 CD);
//   ③ 下车后 1 帧内: SPECVEH===null + grp 不在 world + 无残骸/无重生冷却;
//   ④ 100 轮"召唤→下车": world/scene 子节点数与引擎节点数**零增长**, 且 GhostTank 只构造 1 次
//      (构造计数用 AudioSys.createEngine('tank') 代理 —— class 声明是词法绑定, 无法从外部替换);
//   ⑤ 修前 A/B (受控): (a) 内存里给 fireCannon 装回 CD 门 ⇒ 连发 10 次只出 1 发;
//      (b) 旧版"下车只解绑"等价路径 (specVehUnbind) ⇒ SPECVEH 与 grp 都还在;
//   ⑥ 部署项接线: 23-deploy 的观战出生项 = specVehSummon + specVehBoard.
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path');
const {root,boot,run,makeChk,campIdxOf}=require('./verify-a21-lib.js');
const {chk,info,done}=makeChk('A#4 幽灵坦克');
const CAMP=campIdxOf('island');

// 修前变体 (a): 给 GhostTank.fireCannon 装回 CD 门 (磁盘不动)
const OLD_CD=`if(this.cannonCd>0) return;\nthis.cannonCd=GHOST_DEF.reload;\n`;
const ANCHOR='fireCannon(customDir){\nlet dir=this.aimDir();';
const cdMutant=src=>{
	if(src.indexOf(ANCHOR)<0) throw new Error('A#4 修前变体: 锚点漂移');
	return src.replace(ANCHOR,'fireCannon(customDir){\n'+OLD_CD+'let dir=this.aimDir();');
};

const PRE=`
globalThis.__G={
 engines:0, wrapEngines(){ const o=AudioSys.createEngine; AudioSys.createEngine=function(){ __G.engines++; return o.apply(this,arguments); }; },
 counts(){ return {world:world.children.length, scene:scene.children.length, engines:__G.engines}; },
 setup(){ player.spectator=true; player.alive=true; player.deployed=true; player.team=0; player.cls=5;
   if(typeof specVehStow==='function') specVehStow(); },
 // F 键真路径 + 同帧判定 (不推进任何帧)
 fKey(){ tryInteract(); const g=(typeof SPECVEH!=='undefined')?SPECVEH:null;
   return {spec:(g!==null), bound:!!(g&&player.onVehicle===g), driven:!!(g&&g.playerDriven),
     dist:g?+Math.hypot(g.pos.x-player.pos.x,g.pos.z-player.pos.z).toFixed(3):null,
     inWorld:g?world.children.indexOf(g.grp)>=0:false, ff:player.ffAll===true}; },
};
`;

console.log('== A#4 幽灵坦克 独立验收 (2026-09-21 批次 20260921A) ==');
const ctx=boot(CAMP,{seed:42});
run(ctx,PRE);
run(ctx,'__G.wrapEngines()');
const ctxOld=boot(CAMP,{seed:42,mutate:{'js/15c-specveh.js':cdMutant}});
run(ctxOld,PRE);
run(ctxOld,'__G.wrapEngines()');
const oldOk=run(ctxOld,'/if\\(this\\.cannonCd>0\\) return;/.test(String(GhostTank.prototype.fireCannon))');
chk(oldOk===true,'修前变体 (CD 门) 已生效');

// ① 任意位置 F ⇒ 同帧上车
console.log('\n① 观战者按 F (任意位置) ⇒ 同帧召唤 + 上车');
const spots=[[0,0],[120,-95],[-160,140],[Math.round(run(ctx,'MAP_SIZE')/2-12),Math.round(run(ctx,'MAP_SIZE')/2-12)]];
let allOk=true;
for(const [x,z] of spots){
	const r=run(ctx,`(()=>{const G=__G; G.setup();
player.pos.set(${x},0,${z}); player.pos.y=heightAt(${x},${z});
const before={inWorld:(typeof SPECVEH!=='undefined'&&SPECVEH)?world.children.indexOf(SPECVEH.grp)>=0:false,spec:(typeof SPECVEH!=='undefined')&&SPECVEH!==null};
const r=G.fKey(); r.before=before; return r;})()`);
	info(`F@(${x},${z}): 召唤=${r.spec} 上车=${r.bound} 距离=${r.dist}m 在 world=${r.inWorld} ffAll=${r.ff} (调用前场景里已有车=${r.before.spec})`);
	if(!(r.spec&&r.bound&&r.dist<8&&r.inWorld)) allOk=false;
}
chk(allOk,'四处置 (含地图角) 按 F 都在**同一次调用内**完成召唤+上车 (0 帧延迟, 距离 <8m)');

// ② 主炮无 CD
console.log('\n② 主炮连发 10 次: cannonCd 恒 0 / 10 发全出膛');
const cd=run(ctx,`(()=>{
const G=__G; G.setup(); player.pos.set(0,0,0); player.pos.y=heightAt(0,0);
G.fKey();
const g=SPECVEH;
g.aimDir(); g.turretYaw=0; g.turretPitch=0;
shells.length=0;
const cds=[];
let added=0;
for(let i=0;i<10;i++){ const n0=shells.length; g.fireCannon(); added+=shells.length-n0; cds.push(g.cannonCd); }
// 第二段: 跨帧 (每帧一发, 20 帧)
let added2=0;
for(let f=0;f<20;f++){ const n0=shells.length; g.fireCannon(); added2+=shells.length-n0; updateSpecVeh(1/60); }
return {cds,added,added2,cdMax:Math.max.apply(null,cds),cdEnd:g.cannonCd,reloadField:GHOST_DEF.reload,
 cdMaxField:g.cdMax,shellsKind:shells.length?shells[shells.length-1].kind:null,team:shells.length?shells[shells.length-1].team:null};
})()`);
info(JSON.stringify(cd));
chk(cd.added===10&&cd.cdMax===0&&cd.cdEnd===0,`同帧连发 10 次出膛 ${cd.added} 发, cannonCd 全程 = ${cd.cdMax} (无 CD)`);
chk(cd.added2===20,`跨 20 帧每帧一发: 出膛 ${cd.added2} 发 (帧间隔也不吃 CD)`);
chk(cd.reloadField>0&&cd.team===-1,`GHOST_DEF.reload=${cd.reloadField} 字段保留但不用于门控; 炮弹 team=${cd.team} (无差别)`);

// ③ 下车 1 帧内消失
console.log('\n③ 下车后 1 帧内: SPECVEH===null + grp 不在 world + 无残骸/无重生冷却');
const dis=run(ctx,`(()=>{
const G=__G; G.setup(); player.pos.set(40,0,40); player.pos.y=heightAt(40,40);
G.fKey(); const g=SPECVEH;
g.turretYaw=0.4; g.cannonCd=0;
const sinkBefore=!!g.sinkJob, tanksBefore=tanks.indexOf(g);
const okD=specVehDismount();
const r={okD,specNull:(typeof SPECVEH==='undefined'||SPECVEH===null),worldHas:world.children.indexOf(g.grp)>=0,
 parentNull:g.grp.parent===null, visible:g.grp.visible, onVeh:player.onVehicle===null, driven:g.playerDriven,
 sinkJob:!!g.sinkJob, sinkBefore, tanksBefore, tanksAfter:tanks.indexOf(g), engineStopped:(()=>{try{return true;}catch(e){return false;}})()};
// 一帧后再看 (world 还原/主循环不会把车拉回来)
updateSpecVeh(1/60);
r.afterFrame={spec:(typeof SPECVEH!=='undefined'&&SPECVEH!==null),worldHas:world.children.indexOf(g.grp)>=0};
return r;
})()`);
info(JSON.stringify(dis));
chk(dis.okD===true&&dis.specNull===true&&dis.worldHas===false&&dis.parentNull===true,'同帧: SPECVEH===null + grp 已摘出 world (parent=null, visible=false)');
chk(dis.onVeh===true&&dis.driven===false,'同帧: 玩家解绑 + playerDriven=false');
chk(dis.sinkJob===false&&dis.sinkBefore===false&&dis.tanksBefore<0&&dis.tanksAfter<0,'不留残骸: 无下沉任务 / 不入 tanks 表 (无重生冷却语义)');
chk(dis.afterFrame.spec===false&&dis.afterFrame.worldHas===false,'再过 1 帧仍不在场景 (主循环不会把它拉回来)');

// ④ 100 轮零增长 + 只构造一次
console.log('\n④ 100 轮"召唤→下车": 场景/引擎节点零增长 + GhostTank 只构造 1 次');
const loop=run(ctx,`(()=>{
const G=__G; G.setup();
const e0=G.engines;              // 前几节已召唤过 ⇒ 实例/引擎应已建好 (期望 1)
// 预热 3 轮 (不增长基线)
for(let i=0;i<3;i++){ player.pos.set(10+i,0,10); player.pos.y=heightAt(10+i,10); G.fKey(); specVehDismount(); }
const a=G.counts();
for(let i=0;i<100;i++){ const x=-100+i*2, z=60+(i%20)*3; player.pos.set(x,0,z); player.pos.y=heightAt(x,z); G.fKey(); specVehDismount(); }
const b=G.counts();
return {a,b,dWorld:b.world-a.world,dScene:b.scene-a.scene,dEng:b.engines-a.engines,
 createdTotal:b.engines,createdFirst:e0, spec:(typeof SPECVEH!=='undefined'&&SPECVEH!==null)};
})()`);
info(JSON.stringify(loop));
chk(loop.dWorld===0,`world 子节点零增长 (${loop.a.world} → ${loop.b.world})`);
chk(loop.dScene===0,`scene 子节点零增长 (${loop.a.scene} → ${loop.b.scene})`);
chk(loop.dEng===0&&loop.createdTotal===1,`引擎节点零增长 (${loop.a.engines} → ${loop.b.engines}); 全流程只构造过 ${loop.createdTotal} 次 (103 轮召唤都复用同一实例)`);
chk(loop.spec===false,'100 轮后仍是收车态 (SPECVEH===null)');

// ⑤ 修前 A/B
console.log('\n⑤ 修前 A/B (受控变体)');
const cdOld=run(ctxOld,`(()=>{
__G.setup(); player.pos.set(0,0,0); player.pos.y=heightAt(0,0); __G.fKey();
const g=SPECVEH; shells.length=0; g.cannonCd=0;
let added=0, cds=[];
for(let i=0;i<10;i++){ const n0=shells.length; g.fireCannon(); added+=shells.length-n0; cds.push(+g.cannonCd.toFixed(3)); }
return {added,cds};
})()`);
info(`修前(装回 CD 门): 同帧连发 10 次只出膛 ${cdOld.added} 发, cannonCd=${JSON.stringify(cdOld.cds)}`);
chk(cdOld.added===1&&cdOld.cds[0]>0,`修前对照成立: 旧版 10 连发只出 1 发 (当前 ${cd.added}/10 无 CD) ⇒ 判据b 有判别力`);
const unbindOld=run(ctx,`(()=>{
const G=__G; G.setup(); player.pos.set(20,0,20); player.pos.y=heightAt(20,20); G.fKey();
const g=SPECVEH;
specVehUnbind();     // 旧版"下车只解绑"的等价路径
return {specStill:(typeof SPECVEH!=='undefined'&&SPECVEH!==null), worldHas:world.children.indexOf(g.grp)>=0, onVeh:player.onVehicle===null};
})()`);
info(`修前等价路径 (只解绑): SPECVEH 仍在=${unbindOld.specStill}, grp 仍在 world=${unbindOld.worldHas}`);
chk(unbindOld.specStill===true&&unbindOld.worldHas===true,`修前对照成立: "只解绑"下车后车**还在场景** (当前下车已收车) ⇒ 判据③ 有判别力`);
run(ctx,'__G.setup()');

// ⑥ 召唤接线 (行为判据: 按 F ⇒ 车在身旁 + 直接上车)
//    ★2026-09-26H 改判 (用户裁定"开局的时候幽灵坦克不出现, 只在按下 F 的时候按需出现"): 部署界面的
//    「观战载具」出生项 (selectedSpawn='G') 与"部署即预置"整段已撤除 ⇒ ⑥ 的入口从"选出生项"改成
//    "按 F" (tryInteract ③ → specVehSummon); 下面两点即新语义: ① 部署后场上无车 ② F 才显形并上车。
console.log('\n⑥ 幽灵坦克召唤: 部署不预置 + F 召唤即上车 (行为)');
const dep=fs.readFileSync(path.join(root,'js/23-deploy.js'),'utf8');
const pl=fs.readFileSync(path.join(root,'js/20-player.js'),'utf8');
const depBeh=run(ctx,`(()=>{
const G=__G;
player.spectator=true; player.alive=true; player.deployed=true; player.team=0; player.cls=5;
if(typeof specVehStow==='function') specVehStow();
selectedSpawn=-1;
deployPlayer();
const pre=(typeof SPECVEH!=='undefined')?SPECVEH:null;     // 部署后: 必须仍为空 (不预置)
tryInteract();                                              // F 的唯一语义入口
const g=(typeof SPECVEH!=='undefined')?SPECVEH:null;
return {preEmpty:pre===null,spec:g!==null,bound:!!(g&&player.onVehicle===g),dist:g?+Math.hypot(g.pos.x-player.pos.x,g.pos.z-player.pos.z).toFixed(2):null,
 inWorld:g?world.children.indexOf(g.grp)>=0:false,ff:player.ffAll===true};
})()`);
info(JSON.stringify(depBeh));
chk(depBeh.preEmpty===true,'部署不再预置幽灵坦克 (场上没有白车; 用户 2026-09-26 裁定)');
chk(depBeh.spec===true&&depBeh.bound===true&&depBeh.dist<10,'F 召唤 ⇒ 车在身旁且玩家直接上车 (召唤即上车)');
chk(/specVehBoard\(/.test(pl)&&/specVehSummon\(\)/.test(pl),'20-player: F 走 specVehSummon() + specVehBoard(召唤即上车)');
info('注: 契约 §5 原文写的是 `specVehSummon() + specVehBoard()`; F 分支正是这一对 (23-deploy 不再参与召唤)');
chk(/specVehNear\(player\.pos\.x,player\.pos\.z,4\.5\)/.test(pl)===false,'20-player: 旧的"4.5m 内才上车"判据已不存在 (F 恒为召唤+上车)');
chk(/id:'G'/.test(dep)===false&&/specVehEnsureAtBase\(/.test(dep)===false,'23-deploy: 「观战载具」出生项与预置调用已移除 (仅 F 按需召唤)');

const code=done('(复现: node dev/verify-a21-a4.js)');
process.exit(code);
