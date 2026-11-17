// ─────────────────────────────────────────────
// dev/verify-20261117b.js —— 十三项批 (2026-11-17 用户实报):
//   T1 读条终局收口 (endMatch/returnToMenu cancelReadBar+藏条)
//   T2 大地图补飞行中弹点 (#ffd050 与小地图同款)
//   T3 手雷楼层=地面 (盒顶面 armed 即引爆) + 投射物不穿墙 (子步隧穿防护/弹跳位置弹出)
//   T4 烟雾/燃烧弹烹饪引信 (NADE_COOK_FUSE 真引信, at 保持撞炸)
//   T5 坦克残骸排斥步兵 (wreckBs 在位时 vehiclePushSoldiers 纯推出)
//   T6 枯树碾压并入倒伏 (floraTopple 替换 vanishFlora)
//   T7 非盒几何兜底回滚 (2026-11-18 用户裁定: 桶/墩炸后消失=既有口径, spawnWallDebris 恢复批前)
//   T8 基地三帐篷 两间相对开门+第三间朝两间中间 (门在局部 +z 面, ry=atan2(dx,dz); 行为断言 BUILD_REG ry)
//   T9 指挥官 ESC 按是否已部署决定锁章 (cmdDeployConfirm(esc) + CMD.deployTouched)
//   T10 坦克本身一律占 3 票 (TICKET_COST.tank, 有人车也收)
//   T11 i18n: 标题/兵种卡/killfeed 人名转写/词典补键
//   T12 暂停面板卡片化 + 键帽表 + 详细提示开关进暂停
// 用法: node dev/verify-20261117b.js [--neg]
//   --neg: N1 摘终局读条收口 / N2 摘盒面引爆分档 / N3 摘烹饪引信 / N4 摘残骸排斥
// ★沙箱注: _bootstub 的 sandbox.globalThis=sandbox 遮蔽真 globalThis ⇒ 注入一律裸名赋值。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const stub=require('./_bootstub.js');
require('./_bootpatch.js').patch(stub.sandbox);
{const P=Object.getPrototypeOf(stub.THREE.Group.prototype); if(!P.clear) P.clear=function(){ this.children.length=0; };}
const _ensureStyle=e=>{ if(e&&e.style&&!e.style.setProperty) e.style.setProperty=(k,v)=>{ e.style[k]=v; }; return e; };
{const doc=stub.document,og=doc.getElementById.bind(doc),oc=doc.createElement.bind(doc);
doc.getElementById=id=>_ensureStyle(og(id));
doc.createElement=t=>_ensureStyle(oc(t));}
const CANNON=(()=>{
const V3=stub.THREE.Vector3;
class Quat{constructor(){this.x=0;this.y=0;this.z=0;this.w=1;}set(){return this;}setFromEuler(){return this;}copy(){return this;}}
return {
Vec3:V3,Quaternion:Quat,
World:class{constructor(){this.gravity=new V3();this.broadphase=null;this.solver={iterations:0};this.bodies=[];}addBody(b){this.bodies.push(b);}removeBody(b){const i=this.bodies.indexOf(b);if(i>=0)this.bodies.splice(i,1);}add(b){this.addBody(b);}remove(b){this.removeBody(b);}addConstraint(){}removeConstraint(){}step(){}},
Body:class{constructor(o){Object.assign(this,o||{});this.shapes=[];this.position=new V3();this.velocity=new V3();this.angularVelocity=new V3();this.quaternion=new Quat();this.angularDamping=0;this.linearDamping=0;}addShape(s){this.shapes.push(s);}},
Box:class{},Sphere:class{},Material:class{},ContactMaterial:class{},NaiveBroadphase:class{},PointToPointConstraint:class{},
};})();

const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const FILES=[...html.matchAll(/src="(js\/[^"?]+)/g)].map(m=>m[1]);

// ── NEG 阴性对照: 四补丁 (正常跑不启用) ──
const NEG=process.argv.includes('--neg');
const SRC={},PATCH_MAP={};
const NEG_PATCHES=[
// N1 摘 endMatch 终局读条收口 → T1 红 (读条账不清/条不藏)
['js/21-match.js','if(player.readBarActive&&player.readBarActive()) player.cancelReadBar(null,true);',';'],
// N2 摘盒面命中分档 → T3 红 (楼板不引爆/迫击炮弹穿盒不炸)
['js/13-combat.js','if(armed&&(!C.st.armOnFuse||topHit)){ C.blow=true; return; }',';'],
// N3 摘烹饪引信 → T4 红 (烟雾弹回到 99 哨兵)
['js/19-input.js','player.nadeFuse=NADE_COOK_FUSE.smoke;','player.nadeFuse=99;'],
// N4 摘残骸排斥 → T5 红 (残骸不再推挤步兵)
['js/15-vehicles.js','if(this.wreckBs){\n\tconst _o=_vpsOpts; _o.dt=dt; _o.crusher=null;','if(false){\n\tconst _o=_vpsOpts; _o.dt=dt; _o.crusher=null;'],
];
if(NEG) for(const [f,from,to] of NEG_PATCHES){
if(SRC[f]===undefined) SRC[f]=fs.readFileSync(path.join(root,f),'utf8');
if(SRC[f].indexOf(from)<0){ console.log('✗ NEG 锚缺失: '+f+' :: '+from.slice(0,60)); process.exit(1); }
PATCH_MAP[f]=(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:SRC[f]).split(from).join(to);
}
const srcOf=f=>(PATCH_MAP[f]!==undefined?PATCH_MAP[f]:fs.readFileSync(path.join(root,f),'utf8'));

function boot(campIdx,extraLs){
for(const k in stub.byId)delete stub.byId[k];
const ctx=vm.createContext(Object.assign({},stub.sandbox));
ctx.document=stub.document; ctx.window=stub.window; ctx.CANNON=CANNON;
ctx.localStorage={_s:Object.assign({sf_campaign:String(campIdx)},extraLs||{}),getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of FILES) vm.runInContext(srcOf(f),ctx,{filename:f});
return ctx;
}
const PASS=[];let FAILN=0;
function ok(cond,label){
if(cond){ PASS.push(label); console.log('  ✔ '+label); }
else { FAILN++; console.log('  ✘ '+label); }
}
ok(html.includes("__sfStyleVer='20261118c'"),'前置: 版本戳 20261118c 在位 (index.html 内联)');

// ── 场地: 断崖公路 (开阔, 杂物少; 世界构建/部署链全通) ──
const IDX_C=(()=>{ const c0=boot(0); return vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="canyon")',c0); })();
const ctx=boot(IDX_C);
const G=s=>vm.runInContext(s,ctx);
G("document.getElementById('startBtn').onclick();");
G('if(!player.alive||!player.deployed) deployPlayer();');
ok(G('!!player&&player.deployed')===true,'场地: 断崖公路开局部署完成');

// 净空点扫描 (离 props/结构 ≥3m, 缓坡) —— 投射物/盒面测试场地
G('_spot=null; outer: for(let x=-60;x<=60;x+=3){ for(let z=-20;z<=20;z+=2){ const rd=(typeof roadDist==="function")?roadDist(x,z):99; if(rd<6) continue; if(!propFree(x,z,3)||!freeSpot(x,z,3)) continue; if(Math.abs(heightAt(x,z)-heightAt(x+5,z))>1.0||Math.abs(heightAt(x,z)-heightAt(x,z+5))>1.0) continue; _spot={x:x,z:z,g:heightAt(x,z)}; break outer; } }');
ok(G('!!_spot')===true,'场地: 净空测试点已找到 ('+G('_spot?_spot.x.toFixed(0)+","+_spot.z.toFixed(0):"?"')+')');

// ══ T3 手雷楼层=地面 + 不穿墙 ══
console.log('T3 楼层引爆 / 隧穿防护 / 弹跳修位');
// T3a: 武装 frag 落在悬空楼板盒顶面 → 引爆 (爆点在楼板高度, 不再沉到地形)
G('addBoxCollider(_spot.x, _spot.g+2.0, _spot.z, 2.4, 0.22, 2.4);');   // 楼板: 顶面 = g+2.11
G('_fs={pos:V3(_spot.x+0.1,_spot.g+2.61,_spot.z+0.1),vel:V3(0,-3,0),fuse:0.1,armOnFuse:true,team:0,thrower:null}; _fev="none"; for(let i=0;i<40;i++){ _fev=nadeStep(_fs,1/60); if(_fev!=="none"&&_fev!=="bounced") break; }');
ok(G('_fev==="blow"&&_fs.pos.y>_spot.g+1.9')===true,'T3a ★武装手雷落楼板顶面即爆 (ev='+G('_fev')+', 爆高 '+G('_fs.pos.y.toFixed(2)')+' vs 地形 '+G('_spot.g.toFixed(2)')+')');
// T3b: 迫击炮弹高速水平撞薄墙 —— 单步位移 0.667m > 扩边厚度 0.42m ⇒ 旧写隧穿, 子步必炸
G('addBoxCollider(_spot.x+1.0, _spot.g+1.0, _spot.z, 0.3, 2.0, 2.0);');   // 薄墙: x∈[0.85,1.15] (局部)
G('_ms={pos:V3(_spot.x+1.25,_spot.g+1.0,_spot.z),vel:V3(-40,0,0),mortar:true,fuse:5,team:0,thrower:null}; _mev=nadeStep(_ms,1/60);');
ok(G('_mev==="blow"')===true,'T3b ★迫击炮弹 40m/s 撞 0.3m 薄墙不隧穿 (单帧位移 0.667m, 子步内点采样命中, ev='+G('_mev')+')');
// T3c: 武装 frag 侧撞墙 —— 弹跳不炸 + 位置弹出墙外 (旧写只翻速度 = 嵌墙滞留)
G('_ws={pos:V3(_spot.x+1.3,_spot.g+1.0,_spot.z),vel:V3(-8,0,0),fuse:0.1,armOnFuse:true,team:0,thrower:null}; _wev=nadeStep(_ws,1/60);');
ok(G('_wev!=="blow"&&_ws.pos.x>_spot.x+1.15')===true,'T3c ★手雷撞墙弹跳不炸且被弹出面外 (ev='+G('_wev')+', x='+G('_ws.pos.x.toFixed(2)')+' > 墙面 '+G('(_spot.x+1.15).toFixed(2)')+')');
// T3d: 未武装 frag 落楼板 —— 弹跳不炸 (引信没烧完, 与旧口径一致)
G('_ns={pos:V3(_spot.x+0.1,_spot.g+2.61,_spot.z+0.1),vel:V3(0,-3,0),fuse:3.0,armOnFuse:true,team:0,thrower:null}; _nev=nadeStep(_ns,1/60);');
ok(G('_nev==="bounced"||_nev==="none"')===true,'T3d 未武装手雷落楼板照旧弹跳不炸 (ev='+G('_nev')+')');

// ══ T4 烹饪引信 ══
console.log('T4 烟雾/燃烧弹烹饪引信');
ok(G('typeof NADE_COOK_FUSE==="object"&&NADE_COOK_FUSE.smoke===1.8&&NADE_COOK_FUSE.incin===1.6')===true,'T4a ★NADE_COOK_FUSE 单源在位 (smoke 1.8 / incin 1.6)');
const s19=srcOf('js/19-input.js');
ok(s19.includes('player.nadeFuse=NADE_COOK_FUSE.smoke;')&&s19.includes('player.nadeFuse=NADE_COOK_FUSE.incin;'),'T4b ★举烟雾/燃烧 = 真引信起烧 (旧 99 哨兵只留 AT)');
const s18=srcOf('js/18-game.js');
ok((s18.match(/throwNade\(this,o,v,Math\.max\(0,this\.nadeFuse\)/g)||[]).length===2,'T4c ★releaseNade 烟雾/燃烧出手带烹饪余值 (两处; at 保持 1.6 撞炸)');
ok(srcOf('js/13-combat.js').includes('(u.nadeFuse!==undefined&&u.nadeFuse<90)?u.nadeFuse:'),'T4d ★dropHeldNade 掉雷继承烹饪余值');

// ══ T5 残骸排斥 ══
console.log('T5 坦克残骸排斥步兵');
const s15=srcOf('js/15-vehicles.js');
ok(s15.includes('if(this.wreckBs){\n\tconst _o=_vpsOpts; _o.dt=dt; _o.crusher=null; _o.moving=false;'),'T5a ★残骸沉没前 vehiclePushSoldiers 纯推出 (moving=false 无碾压分支)');
ok(s15.indexOf('if(this.wreckBs){\n\tconst _o=_vpsOpts')<s15.indexOf('this.respawnT<=0&&!matchOver&&tickets[this.team]>0) this.respawn();'),'T5b ★排斥在 !alive 早退分支内 (与 wreckBs 碰撞账同生死)');

// ══ T6 枯树碾压并入倒伏 ══
console.log('T6 枯树碾压倒伏');
ok(G('typeof floraTopple==="function"&&typeof floraCrushTank==="function"')===true,'前置: floraTopple/floraCrushTank 在位');
const sfb=srcOf('js/04b-fire.js');
{const deadBr=(sfb.split("}else if(rec.kind==='dead'){")[1]||'').split('}else if(d<2.0){')[0];
ok(deadBr.includes('floraTopple(rec,sn*mv+rand(-0.2,0.2),cs*mv+rand(-0.2,0.2))')&&!deadBr.includes('vanishFlora(rec,false)'),'T6a ★枯树碾压走 floraTopple 倒伏 (vanishFlora 退场, 不再"原地消失沉入")');
ok(deadBr.includes('if(rec.alive===false) continue;'),'T6b ★已倒伏不二次登记守卫保留 (防双沉入任务跳变)');}

// ══ T7 非盒几何兜底回滚 (2026-11-18 用户裁定: 桶/墩类炸后消失=既有口径, 兜底属负提升) ══
console.log('T7 spawnWallDebris 非盒兜底回滚');
const srd=srcOf('js/12-ragdolls.js');
ok(!srd.includes('THREE.Box3().setFromObject')&&srd.includes('参数缺失/桩环境直接跳过'),'T7a ★非盒几何兜底已回滚 (spawnWallDebris 恢复批前口径: 参数缺失直接跳过)');
ok(G('typeof spawnWallDebris==="function"')===true,'前置: spawnWallDebris 在位');
const sbp=srcOf('js/05b-props.js');
ok(sbp.includes("wkMat('drum',0x8f3d28,TEX.rust,1.2)")&&sbp.includes('TorusGeometry(0.425,0.022,6,14)')&&sbp.includes('mesh:grp,explosive:true'),'T7b ★油桶材质重做: 锈红桶皮+两道滚箍+顶盖桶口 (用户: 平灰圆柱读成水泥桩)');
{const cN=boot(0);
const GN=s=>vm.runInContext(s,cN);
GN("document.getElementById('startBtn').onclick();");
const dr=GN('CYLS.filter(c=>c.explosive&&c.mesh).map(c=>({kids:c.mesh.children?c.mesh.children.length:0,h:+(c.y1-c.y0).toFixed(3),r:c.r}))');
ok(dr.length>0&&dr.every(d=>d.kids>=4&&d.h===1.1&&d.r===0.45),'T7c ★桶=Group 桶体+滚箍×2+桶口 ('+dr.length+' 只, kids='+dr.map(d=>d.kids).join('/')+') 且 CYLS 账逐位不动 (r0.45/h1.1)');
}

// ══ T8 基地三帐篷: 两间相对开门 + 第三间朝两间中间 (2026-11-18 用户实机截图裁定) ══
console.log('T8 基地三帐篷 相对开门+第三朝中间');
const s5c=srcOf('js/05c-layouts.js');
ok(s5c.includes('const _fd=(tx,tz,px,pz)=>Math.atan2(px-tx,pz-tz);')&&s5c.includes('_fd(b.x+sgn*2,b.z+6,b.x,b.z-6)'),'T8a ★帐篷 ry=atan2(dx,dz) 朝目标 (门在局部 +z 面; 一修的 +x 面约定 atan2(-dz,dx) 退场)');
ok(!s5c.includes('const _tf=(tx,tz)=>Math.atan2(-(b.z-tz),b.x-tx);'),'T8b ★一修"共同朝营区中心"写法退场');
{const IDX_M=(()=>{ const c0=boot(0); return vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="moscow")',c0); })();
const c3=boot(IDX_M);
const G3=s=>vm.runInContext(s,c3);
G3("document.getElementById('startBtn').onclick();");
const tents=G3('(function(){const b=CAMPAIGN.bases[0];return BUILD_REG.filter(e=>e.type==="tent"&&Math.hypot(e.x-b.x,e.z-b.z)<10).map(e=>({x:+(e.x-b.x).toFixed(2),z:+(e.z-b.z).toFixed(2),ry:e.ry})).sort((p,q)=>q.z-p.z);})()');
ok(tents.length===3,'T8c 前置: 莫斯科基地三帐篷在账 ('+tents.length+')');
if(tents.length===3){
const A=tents[0],C=tents[1],D=tents[2];   // z 降序: A=T1(z+6) / C=T3(z0) / D=T2(z-6)
const fd=(tx,tz,px,pz)=>Math.atan2(px-tx,pz-tz);
const midx=(A.x+D.x)/2, midz=(A.z+D.z)/2;
const near=(u,v)=>Math.abs(u-v)<0.02||Math.abs(Math.abs(u-v)-Math.PI*2)<0.02;
ok(near(A.ry,fd(A.x,A.z,D.x,D.z))&&near(D.ry,fd(D.x,D.z,A.x,A.z)),'T8d ★两间相对开门 (互朝对方: ry[T1]=' +A.ry.toFixed(2)+' ry[T2]='+D.ry.toFixed(2)+')');
ok(near(C.ry,fd(C.x,C.z,midx,midz)),'T8e ★第三间朝两间中间 (mid=('+midx.toFixed(1)+','+midz.toFixed(1)+'), ry[T3]='+C.ry.toFixed(2)+')');
}}

// ══ T9 指挥官 ESC 盖章分流 ══
console.log('T9 指挥官 ESC 按是否已部署锁章');
ok(srcOf('js/19-input.js').includes('cmdDeployConfirm(true)'),'T9a ★ESC 传 esc=true (显式确认按钮不带参=无条件盖章)');
G('CMD.mapOn=true; CMD.mapDeploy=true; CMD.lockedDir=null; CMD.deployTouched=false; player.cls=5; player.alive=true;');
G('cmdDeployConfirm(true);');
ok(G('CMD.lockedDir===null')===true,'T9b ★没布过势的 ESC 不锁兵种 (lockedDir 仍 null)');
G('CMD.mapOn=true; CMD.mapDeploy=true; CMD.lockedDir=null; CMD.deployTouched=true;');
G('cmdDeployConfirm(true);');
ok(G('CMD.lockedDir==="in"')===true,'T9c ★布势期下过令/调过配比后 ESC = 提交盖章 (lockedDir="in")');
G('CMD.mapOn=true; CMD.mapDeploy=true; CMD.lockedDir=null; CMD.deployTouched=false;');
G('cmdDeployConfirm();');
ok(G('CMD.lockedDir==="in"')===true,'T9d ★✚确认开战按钮 (不带参) 照旧无条件盖章');
G('CMD.mapOn=true; CMD.mapDeploy=true; CMD.lockedDir=null; CMD.deployTouched=true; cmdDeployConfirm(true);');
G('player.deployed=false; if(typeof cmdDeployUndo==="function") cmdDeployUndo();');   // 撤销门: 只对未落地选兵阶段生效
ok(G('CMD.lockedDir===null&&CMD.deployTouched===false')===true,'T9e ★撤销布势连带作废 deployTouched (章/账双清)');
G('CMD.mapOn=false; CMD.mapDeploy=false;');

// ══ T10 坦克占票 ══
console.log('T10 坦克本身 3 票');
ok(G('TICKET_COST.tank===3&&TICKET_COST.plane===3&&TICKET_COST.tankLight===undefined')===true,'T10a ★TICKET_COST={tank:3,plane:3} (轻/重档位退场)');
ok(srcOf('js/15-vehicles.js').includes('if(!spec) tickets[this.team]=Math.max(0,tickets[this.team]-TICKET_COST.tank);'),'T10b ★车毁一律收车体票 (有人车/空车同规; 观战座驾豁免)');
ok(!srcOf('js/15-vehicles.js').includes('TANK_COST.tankLight')&&!srcOf('js/15-vehicles.js').includes('TICKET_COST.tankHeavy'),'T10c ★旧轻/重装备票消费点退场');

// ══ T11 i18n ══
console.log('T11 i18n 标题/兵种卡/killfeed');
ok(html.includes('<div class="gameLogo" data-i18n>钢 铁 前 线</div>')===true,'T11a ★主标题挂 data-i18n (EN=STEEL FRONT)');
ok(srcOf('js/00b-i18n.js').includes("document.title=t('钢铁前线 · 战役合集')"),'T11b ★<title> 随语言 (document.title 写点)');
ok(srcOf('js/00b-i18n.js').includes("'施泰纳':'Steiner'")&&srcOf('js/00b-i18n.js').includes("'田中':'Tanaka'"),'T11c ★Bot 人名拉丁转写入词典 (EN 击杀播报主体)');
ok(srcOf('js/21-match.js').includes('${t(attacker.name)}')&&srcOf('js/21-match.js').includes('${t(victim.name)}'),'T11d ★killfeed 双名走 t()');
ok(srcOf('js/22-hud.js').includes("t2('巡飞弹兵')+(player.spectator?t2(' · 调试中')")&&srcOf('js/23-deploy.js').includes("t2('巡飞弹兵')+(player.spectator?t2(' · 调试中')"),'T11e ★巡飞弹兵·观战中/调试中 走翻译 (两处裸拼收编)');
ok(srcOf('js/15b-trucks.js').includes("t('运输车突围! 已突围 {0} 辆'")===true,'T11f ★15b 动态模板串收进词典键');

// ══ T12 暂停面板 ══
console.log('T12 暂停面板卡片化+键帽表');
{const setSeg=html.split('id="pauseSettingPanel"')[1]||'';
ok((setSeg.match(/class="setCard"/g)||[]).length>=4&&setSeg.includes('pauseCtlHintsBtn'),'T12a ★战斗设置 = setCard 卡片 ≥4 (新增详细操作提示开关)');
ok(setSeg.includes('id="pauseSensRange" min="20" max="200"')===true,'T12b ★灵敏度量纲与主菜单对齐 (20-200, 旧 10-400)');
const helpSeg=html.split('id="pauseHelpPanel"')[1]||'';
ok((helpSeg.match(/class="hkRow"/g)||[]).length>=18&&helpSeg.includes('data-i18n-html>战场大地图'),'T12c ★键位说明 = hkRow 键帽表 ≥18 行 (旧 6 行纯文本退场)');
ok(srcOf('js/22-hud.js').includes("el('pauseCtlHintsBtn')")&&srcOf('js/22-hud.js').includes("localStorage.setItem('sf_ctlhints'"),"T12d ★详细提示开关进暂停接线 (与主菜单同账 sf_ctlhints)");}

// ══ T1 读条终局收口 (独立 ctx: endMatch 置 matchOver 会冻结场地) ══
console.log('T1 读条终局收口');
{
const c2=boot(IDX_C);
const G2=s=>vm.runInContext(s,c2);
G2("document.getElementById('startBtn').onclick();");
G2('player.bandaging=2.5; player.nadeHeld=false;');
G2('if(!player.readBarActive()) throw new Error("pre: readBarActive 应为真");');
G2('endMatch();');
ok(G2('player.readBarActive()===false&&player.bandaging===0')===true,'T1a ★endMatch 收读条账 (包扎清零, readBarActive 假)');
ok(G2('(!window._demolishBar||window._demolishBar.wrap.style.display==="none")')===true,'T1b ★读条条显式隐藏 (沙箱条未建=无从残留; 冻结后 updateHUD 不再写显隐)');
ok(srcOf('js/22-hud.js').includes('读条随"离开战局"收口')===true,'T1c ★returnToMenu 同规收口 (离开侧补齐)');
}

// ══ T2 大地图弹点 ══
console.log('T2 大地图飞行中弹点');
ok(srcOf('js/22-hud.js').split("c.fillStyle='#ffd050'; c.fillRect(px-1.5,py-1.5,3,3);").length===2,'T2a ★drawBigMap 补 #ffd050 弹点 (与小地图 378-381 同款, 全库恰两处)');
ok(srcOf('js/22-hud.js').includes('大地图原本漏了这一块')===true,'T2b ★批注在位');

console.log('\nverify-20261117b: PASS='+PASS.length+' FAIL='+FAILN+(NEG?' (--neg)':''));
process.exit(FAILN?1:0);
