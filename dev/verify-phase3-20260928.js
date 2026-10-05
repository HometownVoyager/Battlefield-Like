// ─────────────────────────────────────────────
// dev/verify-phase3-20260928.js —— 阶段三 P1 平衡首轮验收 (2026-09-28, 缺陷登记 P1/阶段三)
// 断言:
//   S1 源码/数据断言:
//     P1-a 兵种 8→5 (步枪/突击/狙击/反坦克/工程), 医护/迫击炮/冲锋枪手退场 ·
//     P1-b 各方兵种表 5 槽: 德军突击兵=STG44, 其余=阵营冲锋枪; bar/dp28/type96/zb26/type11/m1903 全部退场 ·
//     P1-c 距离衰减生态位表 (fallS/fallE/fallF): 冲锋枪 < STG44 < 半自动 < 栓动/狙击; 全现役武器带表 ·
//     P1-d 移速系数 wSpd: 手枪 1.0 最快, 火箭筒/反坦克枪 0.9 最慢 ·
//     P1-e 栓动换弹 ≤3.0 (原 3.1~3.8) ·
//     P1-f CLS_POOL/AT_POOL 只含 0..4 ·
//     P1-g 迫击炮高抛弧单源 mortarArcTof (emplMortarShell + 14-bots 吊射共用) ·
//     P1-h 火箭弹: AT_SHELL_PAD=0.45 判定 + 爆炸半径分档 (火箭12/反坦克炮9/其余7) ·
//     P1-i 医疗箱=工程兵建造第5件(cost2) + 工程兵键位 B/5/6 + 触屏 tMortar ·
//     P1-j 移速接线: 玩家 20-player 步行 ×wSpd / Bot 14-bots vel ×wSpd;
//   B 行为断言 (诺曼底全量沙箱):
//     B1 衰减生效: 栓动@120m 保持 ≥0.8×近距伤害, 冲锋枪@120m ≤0.5× (Bot 自动同步 — 同一 fireBullet 单源) ·
//     B2 迫击炮高抛: 40/80/120m 三档全部打到目标 90% 以内 (修前全部半路撞坡) 且 80m 弧顶 ≥3.5m (越 2.2m 树篱) ·
//     B3 火箭弹加大判定: 44m 平射真火箭命中坦克 (pad 生效, takeDmg 被调) ·
//     B4 Bot 兵种池: 5 兵种均有出现 ·
//     B5 工程兵 Bot: cls4 带卡宾枪 + 防守架炮分支存在; cls1 突击兵带 4 枚 AT雷 ·
//     B6 实验模式重映射: 非实验 cls3=bazooka 主武器。
//   追加 (2026-09-28 第二轮, 用户实报"被秒"+三提议):
//     B7 出生保护 0.5s: 独立沙箱 —— 落地盖章/敌伤被挡/环境伤不挡/开火即解除/到期恢复/玩家同口径 ·
//     B8 伤害对称化: 四方普通栓动 dmg=78 (精英×1.25<100), STG44 24/500rpm; 15m 实弹 100→22 ·
//     B9 爆头封顶 HEAD_CAP=95 (k 追补: 只封 Bot 射手): Bot 爆头满血必活 (100→5), 玩家爆头豁免
//        照杀 (近距实扣 187 / 280m 实扣 150, kar98=78×2.4), 狙击镜枪豁免 (一枪爆头=狙击手专属)。
// 用法: node dev/verify-phase3-20260928.js
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const {sandbox,document,window}=require('./_bootstub.js');
require('./_bootpatch.js').patch(sandbox);
const _O3=sandbox.THREE.Object3D;
if(_O3&&_O3.prototype&&!_O3.prototype.clear) _O3.prototype.clear=function(){ if(this.children) this.children.length=0; return this; };
sandbox.confirm=()=>true;
const handlers={};
sandbox.addEventListener=(t,f)=>{ (handlers[t]=handlers[t]||[]).push(f); };
sandbox.removeEventListener=()=>{};
const FILES=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/15g-capmodels.js','js/15h-capital.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/19b-gamepad.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/22a-menuart.js','js/22b-speclayer.js','js/23-deploy.js','js/23b-worldrestore.js','js/24-main.js'];
const Quat=class{ constructor(){this.x=0;this.y=0;this.z=0;this.w=1;} set(x,y,z,w){this.x=x;this.y=y;this.z=z;this.w=w;return this;} setFromEuler(){return this;} setFromAxisAngle(){return this;} copy(q){Object.assign(this,q);return this;} mult(){return this;} normalize(){return this;} };
const CV3=sandbox.THREE.Vector3;
const CANNON_STUB={Vec3:CV3,Quaternion:Quat,
World:class{ constructor(){ this.gravity=new CV3(); this.broadphase=null; this.solver={iterations:0}; this.bodies=[]; } addBody(b){ this.bodies.push(b); } removeBody(b){ const i=this.bodies.indexOf(b); if(i>=0) this.bodies.splice(i,1); } add(b){ this.addBody(b); } remove(b){ this.removeBody(b); } addConstraint(){} removeConstraint(){} step(){} },
Body:class{ constructor(o){ Object.assign(this,o||{}); this.shapes=[]; this.position=new CV3(); this.velocity=new CV3(); this.quaternion=new Quat(); } addShape(s){ this.shapes.push(s); } },
Box:class{}, Sphere:class{}, Material:class{}, ContactMaterial:class{}, NaiveBroadphase:class{}, PointToPointConstraint:class{}};
// boot 工厂 (2026-09-28 阶段三 P1 追加): B7 出生保护断言需要**不做豁免**的独立沙箱, 主沙箱 B 系照旧豁免
function makeCtx(){
const c=vm.createContext(Object.assign({},sandbox));
c.document=document; c.window=window; c.__evH=handlers; c.CANNON=CANNON_STUB;
c.localStorage={_s:{sf_campaign:'0',sf_exp:'0'},getItem(k){return (k in this._s)?this._s[k]:null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of FILES) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),c,{filename:f});
try{ vm.runInContext(`document.getElementById('startBtn').onclick();`,c); }catch(e){ console.log('  开局异常: '+e); }
return c;
}
const ctx=makeCtx();
// 出生保护豁免 (仅主沙箱): B 系探针直接打满血摆设不模拟时间 —— 兵在开局时已被盖章, 须逐兵清账
vm.runInContext(`SPAWN_PROT=0; for(const s of combatants) s.protUntil=0;`,ctx);
const R=x=>vm.runInContext(x,ctx);
const V3=(x,y,z)=>new CV3(x,y,z);
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const strip=s=>s.replace(/\/\/[^\n]*/g,'');
let PASS=0, FAILS=0;
const ok=(c,msg)=>{ if(c){ PASS++; console.log('  ✔ '+msg); } else { FAILS++; console.log('  ✘ '+msg); } };

console.log('══ 阶段三 P1 平衡首轮验收 (dev/verify-phase3-20260928.js) ══');

// ═════ S1 源码/数据断言 ═════
console.log('S1 源码/数据断言');
{
const names=R('CLASSES.map(c=>c.name)');
ok(JSON.stringify(names)===JSON.stringify(['步枪兵','突击兵','狙击手','反坦克兵','工程兵']),'P1-a 兵种 8→5: '+names.join('/'));
}
{
const KEYS=['us','ger','sov','jp','kmt','cpc'];
const SMG={us:'thompson',ger:'stg44',sov:'ppsh',jp:'type100',kmt:'mp18',cpc:'c96auto'};
let allOk=true, det=[];
for(const k of KEYS){
const f=R(`FACTIONS['${k}'].cls`);
const okN=f.length===5;
const okSmg=f[1][0]===SMG[k];
const okNoDead=!JSON.stringify(f).match(/"?(bar|dp28|type96|zb26|type11|m1903)"?/);
if(!(okN&&okSmg&&okNoDead)) allOk=false;
det.push(k+':'+f.length+'槽/'+f[1][0]);
}
ok(allOk,'P1-b 各方兵种表 5 槽 + 德军突击兵=stg44 + 自动武器退场   ['+det.join(' ')+']');
}
{
const defs=R('WPN_DEFS');
// 现役可携带 = 出现在任一方兵种表 + 观战连狙; 火箭弹走炮弹链不吃子弹衰减, 合并退场武器不可携带 —— 均不要求
const carried=new Set();
for(const fk of ['us','ger','sov','jp','kmt','cpc']) for(const slot of R(`FACTIONS['${fk}'].cls`)) carried.add(slot[0]);
carried.add('specsniper');
// 火箭筒(bazooka/schreck)与巡飞弹发射器走炮弹链 (fireRocket→updateShells), 不吃子弹衰减 — 豁免
for(const k of [...carried]) if(R('WPN_DEFS')[k].rocket) carried.delete(k);
const noFall=[...carried].filter(k=>R('WPN_DEFS')[k].fallS===undefined);
ok(noFall.length===0,'P1-c1 全部现役武器带距离衰减表 (缺: '+(noFall.join(',')||'无')+')');
const g=(k,f)=>defs[k][f];
ok(g('mp40','fallF')===0.3&&g('ppsh','fallF')===0.3&&g('stg44','fallF')===0.5&&g('garand','fallF')===0.6
&&g('kar98','fallF')===0.8&&g('springfield','fallF')===0.85&&g('m1911','fallF')===0.35,
'P1-c2 生态位地板: SMG0.3 < STG44 0.5 < 半自动0.6 < 栓动0.8 < 狙击0.85 (手枪0.35 近战弹)');
ok(g('kar98','fallS')===70&&g('garand','fallS')===45&&g('mp40','fallS')===22&&g('springfield','fallS')===90,
'P1-c3 衰减起点: 冲锋枪22m < 半自动45m < 栓动70m < 狙击90m');
}
{
const defs=R('WPN_DEFS');
const pistols=['m1911','p38','tt33','nambu','c96'].every(k=>defs[k].wSpd===1);
const heavy=['bazooka','schreck','ptrd','boys','type97at','loiter'].every(k=>defs[k].wSpd===0.9);
const smg=['thompson','mp40','ppsh','type100','mp18','c96auto'].every(k=>defs[k].wSpd===0.97);
ok(pistols&&heavy&&smg,'P1-d 移速系数: 手枪1.0 / 冲锋枪0.97 / 火箭筒与反坦克枪0.9');
}
{
const defs=R('WPN_DEFS');
const bolts=Object.keys(defs).filter(k=>defs[k].type==='bolt'&&defs[k].mag>1);
const bad=bolts.filter(k=>defs[k].reload>3.0);
ok(bad.length===0,'P1-e 栓动(弹匣>1)换弹全部 ≤3.0s (超: '+(bad.join(',')||'无')+')');
}
{
const pool=R('CLS_POOL'), atp=read('js/23-deploy.js').match(/AT_POOL=\[([^\]]+)\]/);
ok(pool.length===14&&pool.every(c=>c>=0&&c<=4),'P1-f1 CLS_POOL 14槽全在 0..4: ['+pool.join(',')+']');
ok(atp&&atp[1].split(',').every(c=>+c>=0&&+c<=4),'P1-f2 AT_POOL 只含 0..4');
}
{
const combat=read('js/13-combat.js'), bots=read('js/14-bots.js');
ok(strip(combat).includes('function mortarArcTof')&&strip(combat).includes('const tof=mortarArcTof(dH)')
&&strip(bots).includes('const tof=mortarArcTof(dist2)'),'P1-g 迫击炮高抛单源: mortarArcTof 被 炮座+Bot吊射 两处共用');
// ★2026-10-01 判据跟码 (口径未变, 只是表达式后来分了火箭/反坦克炮两档 —— 见 15-vehicles:1666 注释):
//   原针 `(s.kind==='at')?9:7` 已不成立; 现针 = "反坦克档内再分 火箭12 / 反坦克炮9", 非反坦克维持 7。
const veh=read('js/15-vehicles.js');
ok(strip(veh).includes('const AT_SHELL_PAD=0.45')&&strip(veh).includes("(s.kind==='at')?AT_SHELL_PAD:SHELL_R")
&&strip(veh).includes("(s.kind==='at')?(s.rocket?12:9):7"),'P1-h 火箭弹: 判定半径0.45 + 爆炸半径分档 (火箭12/反坦克炮9/其余7)');
}
{
const eng=read('js/06-engineering.js'), inp=read('js/19-input.js'), idx=read('index.html'), mn=read('js/24-main.js'), dep=read('js/23-deploy.js');
ok(strip(eng).includes("'sandbag','wire','hedge','mg','medkit'")&&strip(eng).includes('medkit:2'),'P1-i1 医疗箱=建造菜单第5件 (2点)');
ok(strip(inp).includes("if(e.code==='Digit5'&&player.cls===4)")&&strip(inp).includes("if(e.code==='KeyB')")&&strip(inp).includes("else if(player.cls===4&&!player.onVehicle&&!player.onMG&&!player.onAT&&!player.onAA&&!player.onMortar&&!player.loiter){\nif(!player.mortarPlaced){"),'P1-i2 工程兵键位: B=建造 / 5=选型 / 6=架设回收迫击炮');
ok(idx.includes("id=\"tMortar\"")&&strip(mn).includes("bindBtn('tMortar'")&&strip(mn).includes("show('tMortar'"),"P1-i3 触屏迫击炮键 tMortar 已接线");
ok(strip(dep).includes("if(p.cls===4) showScorePop('工程兵"),"P1-i4 部署提示重映射");
}
{
const pl=read('js/20-player.js'), bots=read('js/14-bots.js');
ok(strip(pl).includes('p.curW.def.wSpd')&&strip(bots).includes('this.def.wSpd'),'P1-j 移速系数接线: 玩家+Bot 同乘武器表 wSpd');
const i18n=read('js/00b-i18n.js');
ok(i18n.includes('工程兵 <b>B</b> 建造 · 靠近自己工事 <b>B</b> 读条拆除(退点) · <b>5</b> 切换工事(沙袋墙/铁丝网/拒马/MG42/医疗箱) · <b>6</b> 架设/回收迫击炮')
&&i18n.includes('步枪兵 / 突击兵 / 狙击手 / 反坦克兵 / 工程兵'),'P1-k 游戏说明/词典随兵种合并更新 (含读条拆除/出生保护)');
}

// ═════ B 行为断言 ═════
console.log('B 行为断言 (诺曼底沙箱)');
// B1 距离衰减: 同一 fake shooter 打同一 Bot 士兵, 近距 vs 120m — 栓动保持/冲锋枪跌地板
{
const sol=R('soldiers')[0];
if(sol){
const mk=team=>({team,isPlayer:false,pos:V3(0,0,0),lastFiredT:0,suppression:0,noticeThreat(){},alive:true});
const sx=70,sz=70;
const shoot=(defKey,dist)=>{
sol.pos.set(sx+dist,R('heightAt')(sx+dist,sz),sz); sol.hp=100; sol.alive=true; sol.onVehicle=null; sol.prone=false; sol.crouch=false;
const sh=mk(1-sol.team);
sh.pos.copy(sol.pos);
const o=V3(sx,R('heightAt')(sx,sz)+1.5,sz);
const dir=V3(sol.pos.x-o.x,(sol.pos.y+1.1)-o.y,sol.pos.z-o.z).normalize();
sol.pos.set(sx+dist,R('heightAt')(sx+dist,sz),sz);
R('fireBullet')(sh,o,dir,R('WPN_DEFS')[defKey],null);
return 100-sol.hp;
};
const near=shoot('kar98',30), far=shoot('kar98',120);
const nearS=shoot('mp40',30), farS=shoot('mp40',120);
ok(far/near>0.8,`B1a 栓动远距保持: kar98 30m=${near.toFixed(0)} → 120m=${far.toFixed(0)} (${(far/near).toFixed(2)}×)`);
ok(farS/nearS<0.5,`B1b 冲锋枪远距衰减: mp40 30m=${nearS.toFixed(0)} → 120m=${farS.toFixed(0)} (${(farS/nearS).toFixed(2)}×)`);
}else ok(false,'B1 无士兵可测');
}
// B2 迫击炮高抛: 田缘架炮打 40/80/120m — 全部到 90% 以内 + 80m 弧顶越 3.5m
{
const owner={team:0,isPlayer:false,alive:true,mortarPlaced:false,onMortar:false,mortUse:false,onVehicle:false,onMG:false,onAT:false,onAA:false,pos:V3(0,0,0),noticeThreat(){},suppression:0};
let mx=-6,mz=-46;
for(let t=0;t<60&&R('occBlocked')(mx,mz);t++) mx-=2;
const okD=R('deployMortar')(owner,mx,mz,Math.PI/2);
ok(okD,'B2-0 架炮成功 @('+mx+','+mz+')');
if(okD){
const mo=R('MORTARS')[R('MORTARS').length-1];
// 清场: 真实坦克/卡车的"炮弹近炸"(updateNades 2.6m 近爆)会污染落点测量 — 测试期移出, 完毕归还
const savedTanks=R('tanks').splice(0), savedTrucks=R('trucks').splice(0);
// 射向=正北 (向东 80m 线会穿过 (57,-44) 废屋二楼残墙, 属合法命中 — 会话取证记录);
// 向北 135m 内净空 (BOXES/CYLS 扫描实测), 110m 档替代 120m 以避开地图边界 (lim=MAP/2-4)
for(const dH of [40,80,110]){
R('emplMortarShell')(mo,owner,mx,mz-dH);
let steps=0,maxY=-99,short=null;
while(R('nades').length&&steps<2000){
const n=R('nades')[R('nades').length-1];
const ag=n.pos.y-R('heightAt')(n.pos.x,n.pos.z);   // 对地高度 (绝对y与相对值不得混比)
if(ag>maxY) maxY=ag;
			R('updateNades')(0.016,0.016); steps++;
			if(!R('nades').length){ short=Math.hypot(mx-n.pos.x,(mz-dH)-n.pos.z); ctx._dbgPos=n.pos.clone(); break; }
}
			if(short===null&&!R('nades').length) short=0;
			if(short>=dH*0.1){
				// 取证: 死亡点附近 0.6m 内的盒/柱分类
				const dp=ctx._dbgPos||null;
				let what='?';
				for(const b of R('BOXES')){
					const fl=(b.flora&&b.flora.kind)?b.flora.kind:'box';
					if(dp&&dp.x>b.minX-0.6&&dp.x<b.maxX+0.6&&dp.z>b.minZ-0.6&&dp.z<b.maxZ+0.6&&dp.y>b.minY-0.6&&dp.y<b.maxY+0.6){ what=fl+' x['+b.minX.toFixed(0)+','+b.maxX.toFixed(0)+'] z['+b.minZ.toFixed(0)+','+b.maxZ.toFixed(0)+'] y['+b.minY.toFixed(1)+','+b.maxY.toFixed(1)+']'; break; }
				}
				console.log('      [死亡点分类] '+what+' @'+(dp?dp.x.toFixed(1)+','+dp.y.toFixed(1)+','+dp.z.toFixed(1):'?'));
			}
			ok(short!==null&&short<dH*0.1,`B2 迫击炮 ${dH}m: 短路 ${short===null?'?':short.toFixed(1)}m (<10%)`);
if(dH===80){
ok(maxY>3.5,`B2b 80m 弧顶(对地) ${maxY.toFixed(1)}m > 3.5 (越 2.2m 树篱)`);
}
			while(R('nades').length){ const n=R('nades').pop(); if(n.m) R('scene').remove(n.m); }
		}
		R('MORTARS').splice(R('MORTARS').indexOf(mo),1);
		for(const t of savedTanks) R('tanks').push(t);
		for(const t of savedTrucks) R('trucks').push(t);
	}
}
// B3 火箭弹加大判定: 44m 平射命中假坦克 (pad 0.45)
{
const tank={pos:V3(100,R('heightAt')(100,70),70),alive:true,team:1,hits:0,takeDmg(){this.hits++;}};
R('tanks').push(tank);
const sh={team:0,isPlayer:false,lastFiredT:0};
const o=V3(56,R('heightAt')(56,70)+1.4,70);
R('fireRocket')(sh,o.clone(),V3(1,-0.004,0).normalize(),{atDmg:360},null);
let steps=0;
while(R('shells').length&&steps<400&&!tank.hits){ R('updateShells')(0.016,0.016); steps++; }
ok(tank.hits>0,`B3 火箭弹 44m 平射命中坦克 (判定半径0.45; ${steps} 帧)`);
R('tanks').splice(R('tanks').indexOf(tank),1);
while(R('shells').length) R('shells').pop();
}
// B4 Bot 兵种池
{
let seen=new Set();
for(let i=0;i<4000;i++) seen.add(R('CLS_POOL')[R('randi')(0,R('CLS_POOL').length-1)]);
ok(seen.size===5,'B4 Bot 兵种池 5 兵种均出现: ['+[...seen].sort().join(',')+']');
}
// B5 工程兵/突击兵 Bot 配置
{
const b1=new (R('Bot'))(0,1,'T1');
ok(b1.slots[0].key==='thompson'&&b1.atn===4,'B5a 突击兵 Bot: thompson + AT雷×4 (atn='+b1.atn+')');
const b4=new (R('Bot'))(0,4,'T4');
ok(b4.slots[0].key==='m1carb','B5b 工程兵 Bot: 卡宾枪自卫武器');
}
// B6 实验模式重映射 (非实验: cls3=火箭筒)
{
const ws=R('playerClassWeapons')(0,3);
ok(ws[0]==='bazooka'&&ws[1]==='m1911','B6 非实验 cls3 = 巴祖卡 + M1911');
}
// B7 出生保护 (独立沙箱 makeCtx, 保持默认 0.5s): 落地盖章 / 敌伤被挡 / 环境伤不挡 / 开火即解除 / 到期恢复 / 玩家同口径
{
const ctx2=makeCtx();
const r=vm.runInContext(`(()=>{try{
const b=combatants.filter(s=>s.alive&&s!==player)[0];
const stamped=b&&b.protUntil>nowT;
const enemy={team:b.team===0?1:0,isPlayer:false,pos:b.pos.clone()};
b.hp=100; b.damage(30,enemy,false);
const blockedEnemy=b.hp===100;
b.damage(5,null,false);
const envNotBlocked=b.hp===95;
fireBullet(b,V3(b.pos.x,b.pos.y+1.5,b.pos.z),V3(0.3,-0.05,0.9).normalize(),WPN_DEFS.kar98,null);
const clearedOnFire=!b.protUntil;
b.hp=100; b.protUntil=0; b.damage(30,enemy,false);
const expiredOk=b.hp===70;
selectedSpawn=-1; deployPlayer();
const pStamped=player.protUntil>nowT;
player.hp=100; player.damage(30,enemy,false);
const pBlocked=player.hp===100;
fireBullet(player,V3(player.pos.x,player.pos.y+1.5,player.pos.z),V3(0.3,-0.05,0.9).normalize(),WPN_DEFS.m1911,null);
const pCleared=!player.protUntil;
return {stamped,blockedEnemy,envNotBlocked,clearedOnFire,expiredOk,pStamped,pBlocked,pCleared};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`,ctx2);
if(typeof r==='string') ok(false,'B7 推演异常: '+r);
else{
ok(r.stamped,'B7a Bot 落地即盖章 (protUntil>nowT)');
ok(r.blockedEnemy,'B7b 0.5s 内敌伤被挡 (30 伤害实扣 0)');
ok(r.envNotBlocked,'B7c 环境伤 (attacker=null) 不挡 —— 保护不是免死金牌');
ok(r.clearedOnFire,'B7d 开火立即解除 (fireBullet 单源清账)');
ok(r.expiredOk,'B7e 到期后敌伤照常 (30 实扣 30)');
ok(r.pStamped&&r.pBlocked&&r.pCleared,'B7f 玩家同口径: deployPlayer 盖章 + 敌伤被挡 + 开火解除');
}
}
// B8 栓动 78 / STG44 降速: 表断言 + 15m 实弹 (满血身体打不死)
{
const d=R('WPN_DEFS');
ok(d.kar98.dmg===78&&d.mosin.dmg===78&&d.arisaka.dmg===78&&d.zhongzheng.dmg===78,'B8a 四方普通栓动 dmg=78 (kar98/莫辛/三八/中正式)');
ok(d.kar98.dmg*R('DIFF_TABLE')[2].dmgMul<100,'B8b 精英 ×1.25 后仍 <100 —— 身体永远秒不死满血 (对称: 玩家同样)');
ok(d.stg44.dmg===24&&d.stg44.rpm===500,'B8c STG44 降速降伤 (24/500rpm, 爆头 45.6 也吃 HEAD_CAP)');
const sol=R('soldiers')[0];
if(sol){
sol.pos.set(85,R('heightAt')(85,70),70); sol.hp=100; sol.alive=true; sol.onVehicle=null; sol.prone=false; sol.crouch=false;
const o=V3(70,R('heightAt')(70,70)+1.5,70);
const dir=V3(sol.pos.x-o.x,(sol.pos.y+1.1)-o.y,sol.pos.z-o.z).normalize();
R('fireBullet')({team:1-sol.team,isPlayer:false,pos:o},o,dir,R('WPN_DEFS').kar98,null);
ok(Math.round(sol.hp)===22,'B8d 15m 实弹: kar98 身体 78 伤害 (100→'+Math.round(sol.hp)+')');
const d2=R('WPN_DEFS');
ok(d2.springfield.headMul===2.5&&d2.kar98.headMul===2.4&&d2.garand.headMul===2.4&&d2.stg44.headMul===1.9&&d2.thompson.headMul===1.6&&d2.mp40.headMul===1.6&&d2.ppsh.headMul===1.6&&d2.m1911.headMul===1.7,'B8e 爆头倍率分档 (k): 镜狙击 2.5 > 步枪(栓动/半自动) 2.4 > 自动步枪/机枪 1.9 > 手枪 1.7 > 冲锋枪 1.6');
sol.alive=true; sol.hp=500;
const dirH=V3(sol.pos.x-o.x,(sol.pos.y+1.68)-o.y,sol.pos.z-o.z).normalize();
R('fireBullet')({team:1-sol.team,isPlayer:true,pos:o},o,dirH,R('WPN_DEFS').thompson,null);
ok(Math.round(sol.hp)===466,'B8f 玩家冲锋枪爆头实弹: thompson 21×1.6=33.6 (500→'+Math.round(sol.hp)+', 旧 1.8 会是 462)');
}else ok(false,'B8 无士兵可测');
}
// B8g/h 瞄准加成梳理 (k): 腰射散布失序修复 + 加成倍数 (hip/ads) 分档单调
{
const d3=R('WPN_DEFS'), rt=w=>w.spreadHip/w.spreadAds;
ok(d3.garand.spreadHip===3.0&&d3.g33.spreadHip===4.4&&d3.m38carb.spreadHip===4.6&&d3.type38c.spreadHip===4.4&&d3.laotao.spreadHip===5,'B8h 腰射散布梳理: 加兰德 2.2→3.0 (不再全场最佳), 骑枪族 5.2~5.8→4.4~5.0 (短管不再比全尺寸栓动差)');
ok(rt(d3.springfield)>rt(d3.kar98)&&rt(d3.kar98)>rt(d3.garand)&&rt(d3.garand)>rt(d3.stg44)&&rt(d3.stg44)>rt(d3.thompson),'B8g 瞄准加成倍数分档单调: 镜狙 250x > 栓动 56x > 半自动 21x > 自动步枪 6.8x > 冲锋枪 4x');
ok(d3.springfield.spreadHip>d3.m1911.spreadHip&&d3.m1911.spreadHip<d3.thompson.spreadHip&&d3.g33.spreadHip<d3.kar98.spreadHip,'B8h2 腰射层级: 手枪最准 > 冲锋枪, 镜枪比手枪差, 骑枪比全尺寸栓动顺手');
}
// B9 爆头封顶 (k 追补收窄: 只封 Bot 射手): Bot 爆头满血必活 95, 玩家爆头豁免照杀 (近 195/远 280m 156), 镜枪豁免
{
const r9=vm.runInContext(`(()=>{
const t=soldiers.filter(s=>s.alive)[0];
t.pos.set(85,heightAt(85,70),70); t.alive=true; t.hp=100; t.onVehicle=null; t.prone=false; t.crouch=false;
const o=V3(70,heightAt(70,70)+1.5,70);
const aim=y=>V3(t.pos.x-o.x,y-o.y,t.pos.z-o.z).normalize();
fireBullet({team:1-t.team,isPlayer:false,pos:o},o,aim(t.pos.y+1.68),WPN_DEFS.kar98,null);
const hpHead=Math.round(t.hp);
// 玩家射手豁免 (k 追补): 同一把 kar98 爆头实扣 195 (500→305); 若仍封顶只会扣 95 (500→405)
t.alive=true; t.hp=500;
fireBullet({team:1-t.team,isPlayer:true,pos:o},o,aim(t.pos.y+1.68),WPN_DEFS.kar98,null);
const hpByPlayer=t.alive?Math.round(t.hp):-1;
// 远距 (280m > fallE 260, 地板 0.8): 玩家爆头实扣 156 (500→344) —— "远距爆头秒人"恢复
t.alive=true; t.hp=500; t.pos.set(350,heightAt(350,70),70);
fireBullet({team:1-t.team,isPlayer:true,pos:o},o,V3(t.pos.x-o.x,(t.pos.y+1.68)-o.y,t.pos.z-o.z).normalize(),WPN_DEFS.kar98,null);
const hpFar=t.alive?Math.round(t.hp):-1;
// Bot 打玩家仍封顶: 满血玩家吃 Bot kar98 爆头 → 5 必活
const p=combatants.find(s=>s.isPlayer); let hpPlayer=-1;
if(p){ p.alive=true; p.hp=100; p.onVehicle=null; p.prone=false; p.crouch=false; p.spectator=false; p.pos.set(85,heightAt(85,70),70);
fireBullet({team:1-p.team,isPlayer:false,pos:o},o,V3(p.pos.x-o.x,(p.pos.y+1.68)-o.y,p.pos.z-o.z).normalize(),WPN_DEFS.kar98,null);
hpPlayer=Math.round(p.hp); p.alive=false; }
// 不死流断言: 500 血打镜枪头 —— 实扣 240 (>95) 即证明封顶豁免, 不触发 die/ragdoll (沙箱桩无 CANNON 实体)
t.alive=true; t.hp=500; t.pos.set(85,heightAt(85,70),70);
fireBullet({team:1-t.team,isPlayer:false,pos:o},o,aim(t.pos.y+1.68),WPN_DEFS.kar98zf,null);
return {hpHead,hpByPlayer,hpFar,hpPlayer,hpScoped:Math.round(t.hp)};
})()`,ctx);
if(typeof r9==='string') ok(false,'B9 推演异常: '+r9);
else{
ok(r9.hpHead===5,'B9a Bot 非镜爆头封顶 HEAD_CAP=95 (100→'+r9.hpHead+', 满血必活)');
ok(r9.hpByPlayer===313,'B9b 玩家射手豁免封顶: kar98 爆头实扣 187 (78×2.4, 500→'+r9.hpByPlayer+', 封顶口径会是 405)');
ok(r9.hpFar===350,'B9c 玩家远距爆头 (280m, 衰减地板 0.8) 实扣 150 (500→'+r9.hpFar+'): 远距爆头秒人');
ok(r9.hpPlayer===5,'B9d Bot 爆头打玩家仍封顶 (100→'+r9.hpPlayer+', 满血必活)');
ok(r9.hpScoped===260,'B9e 狙击镜枪不受封顶 (kar98zf 96×2.5=240, 500→'+r9.hpScoped+'): 一枪爆头=狙击手专属');
}
}
// S2 追加改动源码断言 (第二轮: 出生保护/爆头封顶/读条回收)
{
const cfg=read('js/00-config.js'), cb=read('js/13-combat.js'), eg=read('js/06-engineering.js'), dp=read('js/23-deploy.js'), bots=read('js/14-bots.js'), gm=read('js/18-game.js'), inp=read('js/19-input.js'), mn=read('js/24-main.js');
ok(/let SPAWN_PROT=0\.5/.test(cfg)&&/const HEAD_CAP=95/.test(cfg),'S2a 单源常量: SPAWN_PROT=0.5 + HEAD_CAP=95 (00-config)');
ok(strip(cb).includes('shooter.protUntil=0')&&strip(cb).includes('!shooter.isPlayer&&dmg>HEAD_CAP'),'S2b fireBullet: 开火清保护 + 爆头封顶接线 (k: 只认 Bot 射手)');
ok(strip(dp).includes('p.protUntil=nowT+SPAWN_PROT'),'S2c deployPlayer 落地盖章');
ok(strip(bots).includes('this.protUntil=nowT+SPAWN_PROT')&&strip(bots).includes('rand(-0.15,0.1)'),'S2d Bot: spawn() 盖章 + 瞄准偏置 rand(-0.15,0.1)');
ok(strip(gm).includes('this.protUntil&&nowT<this.protUntil&&attacker&&attacker.team!==this.team'),'S2e 玩家 damage: 出生保护只挡敌方来源 (车毁链/环境伤不拦)');
ok(/const BUILDS=\[\]/.test(eg)&&/DEMOLISH_T=1\.2/.test(eg),'S2f 读条回收: BUILDS 登记 + DEMOLISH_T=1.2 (06-engineering)');
ok(strip(inp).includes('nearOwnBuild(player)')&&strip(mn).includes('updateDemolish(player,dt)'),'S2g 键位/主循环接线: B 拆除路由 + updateDemolish tick');
const pl=read('js/20-player.js');
ok(strip(pl).includes('lerp(w.def.spreadHip,w.def.spreadAds,VM.adsBlend)')&&strip(pl).includes("(w.def.scoped?0.7:w.def.type==='bolt'?0.78:0.85)"),'S2h 瞄准加成 (k): 火箭筒散布 lerp (spreadHip 生效) + 瞄准后坐分档折扣 (20-player)');
ok(strip(pl).includes('(p.prone?0.5:p.crouch?0.8:1)')&&strip(pl).includes('(p.prone?0.68:p.crouch?0.85:1)'),'S2i 姿势加成维持原档 (k 用户裁定撤销微小化): 散布 蹲 0.8/趴 0.5 + 后坐 0.85/0.68 钉值防漂移');
}
// B10 读条回收: 建 → 读条 → 拆 (killBox 清 OCC) → 退点 → 原地可重建; 迫击炮读条回收同链
{
const r=vm.runInContext(`(()=>{
try{
let tx=null,tz=null;
for(let x=-40;x<=40&&tx===null;x+=3)for(let z=-40;z<=40;z+=3){ if(!occBlocked(x,z)&&propFree(x,z,3.2)){ tx=x; tz=z; break; } }
if(tx===null) return 'EXC:no free spot';
selectedSpawn=-1; deployPlayer();          // engBuildExec 有 alive 闸: 先落地
VM.state='idle';                           // vmEquip 会开"拔枪"动画态 —— 探针强制回 idle (读条状态闸需要)
NAV.budget=99;                             // 沙箱不跑主循环: 手动放开导航烘焙预算
player.pos.set(tx,heightAt(tx,tz+2),tz+2); // 读条有距离闸: 人站到工事旁
player.buildCount=5;
player.pendingBuild={type:'sandbag',cost:1,tx,tz,ry:0};
engBuildExec(player);
occTouch(tx-3.5,tz-3.5,tx+3.5,tz+3.5); updateNavDirty(1); // 占格烘焙 (真实游戏由 24-main 每帧做)
const built=BUILDS[BUILDS.length-1];
const builtOk=!!(built&&built.alive&&built.boxes.length>0&&built.owner===player);
const occAfter=occBlocked(tx,tz);
startDemolish(player,built);
updateDemolish(player,0.6);
const midOk=!!(player.demolish&&player.demolish.t>0&&built.alive);
updateDemolish(player,0.7);
const doneOk=!built.alive&&!player.demolish;
const clearedOcc=!occBlocked(tx,tz);
const refundOk=player.buildCount===5;
const boxesDead=built.boxes.every(bb=>bb.dead);
// 迫击炮读条回收 (同一条 updateDemolish 链, mortar 分支 → recoverMortar)
let mx=tx, mz=tz-8, okD=false;
for(let i=0;i<30&&!okD;i++){ mz-=2; okD=deployMortar(player,mx,mz,0); }
player.pos.set(mx,heightAt(mx,mz+2),mz+2);
startMortarRecover(player);
const chOk=!!(player.demolish&&player.demolish.mortar);
updateDemolish(player,1.3);
const recOk=!player.mortarPlaced&&!player.demolish;
return {builtOk,occAfter,midOk,doneOk,clearedOcc,refundOk,boxesDead,okD,chOk,recOk,
diag:{vm:(typeof VM!=='undefined')?VM.state:'undef',occ:(typeof OCC!=='undefined'&&!!OCC.data),alive:player.alive,built:!!built,demo:!!player.demolish}};
}catch(e){ return 'EXC:'+(e&&e.stack||e); }})()`,ctx);
if(typeof r==='string') ok(false,'B10 推演异常: '+r);
else{
ok(r.builtOk,'B10a 建造登记: BUILDS 捕获归属/成本/碰撞盒');
ok(r.occAfter,'B10b 沙袋落地确实占格 (occBlocked=true)');
ok(r.midOk,'B10c 读条中 (0.6s): 未完成可打断');
ok(r.doneOk&&r.boxesDead,'B10d 1.2s 读条完成拆除, 碰撞盒全灭');
ok(r.clearedOcc,'B10e killBox 清 OCC —— 原地可重建 (脏矩形口径)');
ok(r.refundOk,'B10f 退全款 (5→4→5 点)');
ok(r.okD&&r.chOk&&r.recOk,'B10g 迫击炮: 架设→读条回收→mortarPlaced 复位 (同一 updateDemolish 链)');
}
}
console.log('\n══ 结果: '+PASS+' 通过 / '+FAILS+' 失败 ══');
process.exit(FAILS?1:0);
