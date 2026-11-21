// ─────────────────────────────────────────────
// dev/verify-20261117.js —— 四项批 (2026-11-17 用户实报):
//   ①模型重做: 坦克残骸简化 (44→≤26 件, 碰撞口径逐字不动) / 轿车加料 (6→13 件三厢轮廓) /
//     运输卡车加料 (11→21 件军卡轮廓, 碰撞零变化) —— 风格统一
//   ②弹道细化: 钢轨街垒 bulletPass (挡坦克挡人挡寻路照旧, 弹道穿过空隙) +
//     拒马逐梁判定 (cyl.hb 三梁线段, 空隙穿弹打梁才挡; 挡坦克圆柱口径不动)
//   ③断崖公路 1940: 出生点半山腰→崖顶 (rd≈33-37, h≥14.5) + OCC 崖顶走廊打通 +
//     enemyTankNear 劫道模式纳入卡车 (坦克优先, 无坦克取最近卡车) + convoy.hp 320→800
//   ④游戏内容设置: 点位周边补给箱数量 1/2 (sf_crates, 第二只确定性环扫零 wr 漂移)
// 用法: node dev/verify-20261117.js [--neg]
//   --neg: N1 摘 raycastWorld bulletPass 跳过 / N2 摘 rayCyl hb 分支 / N3 摘第二箱块 / N4 摘卡车索敌分支
// 场地: 断崖公路 (开阔山谷: 弹道测试零杂物干扰 + convoy 全链在位); 补给箱对照跑淞沪 (旗点图)。
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
// N1 摘 raycastWorld 弹道口 bulletPass 跳过 (栅格路径) → T-A3/A4 红街垒/拒马空隙重新吃弹
['js/04-collision.js','if(BOXES[bi].bulletPass) continue;',';'],
// N2 摘 rayCyl 拒马逐梁分支 → T-A4 红拒马空隙重新吃弹 (退回整圆柱)
['js/03-terrain.js','if(c.hb) return rayHedgeBeams(o,dir,c,maxD);   // 拒马: 弹道逐梁判定 (2026-11-17 批, 挡坦克挡人圆柱口径不动)',';'],
// N3 摘第二只补给箱块 → T-D 红 (sf_crates=2 无第二箱)
['js/05c-layouts.js','if(CRATE2){','if(false){'],
// N4 摘卡车索敌分支 → T-C6 红 enemyTankNear 永不返回卡车
['js/15-vehicles.js','if(!hit&&GAMEMODE===\'convoy\'&&typeof trucks!==\'undefined\'&&trucks.length){','if(false){'],
];
if(NEG) for(const [f,from,to] of NEG_PATCHES){
if(SRC[f]===undefined) SRC[f]=fs.readFileSync(path.join(root,f),'utf8');
if(SRC[f].indexOf(from)<0){ console.log('✗ NEG 锚缺失: '+f+' :: '+from); process.exit(1); }
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
ok(html.includes("__sfStyleVer='20261122a'"),'前置: 版本戳 20261122a 在位 (index.html 内联)');

// ── 场地: 断崖公路 ──
const IDX_C=(()=>{ const c0=boot(0); return vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="canyon")',c0); })();
const ctx=boot(IDX_C);
const G=s=>vm.runInContext(s,ctx);
G("document.getElementById('startBtn').onclick();");
G('if(!player.alive||!player.deployed) deployPlayer();');
ok(G('GAMEMODE==="convoy"&&trucks.length===5')===true,'场地: 断崖公路开局 (convoy + 5 辆运输车)');

// 找谷道旁平缓净地 (rd 8-18: 离开车道避开车队; 峡谷谷坡散布倒木/乱石 ⇒ 净空只要求 2.4m,
// 街垒需 1.7 / 拒马 1.35 各自达标才落件 —— 峡谷 props=523, 大净空圈在谷旁不存在)
G('_spot=null; _hzOff=null; outer: for(let x=-60;x<=60;x+=3){ for(let z=-20;z<=20;z+=2){ const rd=roadDist(x,z); if(rd<8||rd>18) continue; if(!propFree(x,z,2.4)||!freeSpot(x,z,2.4)) continue; if(Math.abs(heightAt(x,z)-heightAt(x+6,z))>1.2||Math.abs(heightAt(x,z)-heightAt(x,z+6))>1.2) continue; for(const off of [9,7,11,6,12]){ if(propFree(x+off,z,1.5)&&Math.abs(heightAt(x+off,z)-heightAt(x,z))<1.2){ _spot={x:x,z:z,g:heightAt(x,z)}; _hzOff=off; break outer; } } } }');
G('_spotTxt=_spot?(_spot.x.toFixed(0)+","+_spot.z.toFixed(0)+" hz+"+_hzOff):"?";');
ok(G('!!_spot')===true,'场地: 谷道旁平缓净点已找到 ('+G('_spotTxt')+')');

// ══ T-A 弹道细化 ══
console.log('T-A 弹道细化: 街垒 bulletPass / 拒马逐梁');
G('railBarricade(_spot.x,_spot.z,0); hedgehog(_spot.x+_hzOff,_spot.z); buildSpatialIndex();');
ok(G('BOXES.some(b=>b.bulletPass)')===true,'T-A1 ★街垒碰撞盒挂 bulletPass (整体盒不再吃弹道)');
G('_cyl0=null; for(const c of CYLS){ if(Math.hypot(c.x-_spot.x-9,c.z-_spot.z)<0.6){ _cyl0=c; break; } }');
ok(G('!!_cyl0&&_cyl0.hb&&_cyl0.hb.length===18&&_cyl0.r===0.85')===true,'T-A2 ★拒马圆柱带 hb 三梁线段 (r=0.85 挡坦克口径不动)');
// A3: 街垒正面射线穿盒区 → 弹道口无 box 命中 (bulletPass 放行; 过盒心后落地的 ground 命中合法;
// ★同 A4: 谷旁侧向陡升, 水平射线起点会埋坡 ⇒ 用陡降射线精确穿过街垒实体盒中心)
G('_rbHit=raycastWorld(V3(_spot.x,_spot.g+4.0,_spot.z-2.0),V3(0,2.05-4.0,2.0).normalize(),16);');
ok(G('!_rbHit||_rbHit.kind!=="box"')===true,'T-A3 ★街垒: 正面射线穿空隙 (无 box 命中; 旧版必吃 2.6×2.1 整盒)');
// A4: 拒马空隙穿弹 / 梁上命中 —— 过柱心横截面的陡降射线栅格 (横向 ±0.7 × 三档高度):
// ★谷旁地形侧向陡升 ⇒ 水平射线起点会埋进坡里 (ground march 当即报 ground), 故从上方 6m 陡降,
//   每条射线精确穿过 (cx+dx, cy, cz) 后落向地面。旧版整圆柱口径下这批射线 100% 命中 cyl
//   (全部落在 r0.85 柱体内), 细化后必有空隙 miss + 梁向 hit。
G('_hitN=0;_missN=0; { const cx=_spot.x+_hzOff, cz=_spot.z; for(let h2 of [0.35,0.75,1.2]){ const cy=_cyl0.y0+h2; for(let dx=-0.7;dx<=0.71;dx+=0.1){ const ox=cx+dx, oy=cy+6, oz=cz-2.5; const _d=V3(0,cy-oy,2.5).normalize(); const r2=raycastWorld(V3(ox,oy,oz),_d,16); if(r2&&r2.kind==="cyl") _hitN++; else _missN++; } } }');
ok(G('_missN>0')===true,'T-A4 ★拒马: 空隙射线穿弹 (旧版 r0.85 圆柱内全吃; 实得 miss='+G('_missN')+'/'+G('_missN+_hitN')+')');
ok(G('_hitN>0')===true,'T-A4b ★拒马: 梁向射线照挡 (实得 hit='+G('_hitN')+'/'+G('_missN+_hitN')+')');
// A4c: hb 几何自检 —— 单元级 rayCyl 竖直射线逐点直测: 三梁的中点+两端点共 9 个采样点,
// 每点从其 (x,z) 正下方 y=-3 竖直上打 —— 梁段过该点 ⇒ 距离 0 必中 (三梁交于柱心, 水平向退化, 竖直向无歧义)
G('_hm=0; { const hb=_cyl0.hb; for(let i2=0;i2<hb.length;i2+=6){ for(const f2 of [0,0.5,1]){ const px=hb[i2]+(hb[i2+3]-hb[i2])*f2, pz=hb[i2+2]+(hb[i2+5]-hb[i2+2])*f2; const r2=rayCyl(V3(px,-3,pz),V3(0,1,0),_cyl0,10); if(r2) _hm++; } } }');
ok(G('_hm===9')===true,'T-A4c ★hb 三梁几何: 中点+两端点竖直射线 9/9 命中 (实得 '+G('_hm')+'/9)');
// A5: 挡坦克/挡人口径不动 —— 拒马圆柱仍在 CYLS 且无 bulletPass 标记 (坦克 _tkCylCb/士兵 _cmCylCb 原样消费)
ok(G('_cyl0.bulletPass!==true')===true,'T-A5 拒马圆柱不带 bulletPass (挡坦克/挡人/寻路/飞机扫掠口径原样)');
// A6: 街垒挡坦克照旧 —— 实体盒仍在 BOXES (bulletPass 只在 raycastWorld 消费, _tkBoxCb/_cmBoxCb 不读它)
G('_rbBox=null; for(const b of BOXES){ if(b.maxY-b.minY>1.5&&Math.hypot((b.minX+b.maxX)/2-_spot.x,(b.minZ+b.maxZ)/2-_spot.z)<2.0) _rbBox=b; }');
ok(G('!!_rbBox&&_rbBox.bulletPass===true&&!_rbBox.crush')===true,'T-A6 ★街垒实体盒仍在且仅弹道放行 (无 crush 高盒, 挡坦克照旧)');
const s04=fs.readFileSync(path.join(root,'js/04-collision.js'),'utf8');
ok(s04.split('function _cmBoxCb')[1].split('function')[0].includes('bulletPass')===false,'T-A6b ★bulletPass 只在弹道口消费 (士兵推挤 _cmBoxCb 不读该标记)');
// A7: 士兵推挤 —— collideMove 对拒马圆柱仍横推 (★柱心 d2=0 是既有豁免口径, 从 0.5m 偏移起测)
G('_hx=_spot.x+_hzOff,_hz=_spot.z; _p=V3(_hx+0.5,0,_hz+0.5); _p.y=heightAt(_hx+0.5,_hz+0.5); collideMove(_p,0.4); _pd=Math.hypot(_p.x-_hx,_p.z-_hz);');
ok(G('_pd>1.2')===true,'T-A7 ★拒马挡人不动: 偏移 0.5m 士兵被横推到柱外 (推后距 '+G('_pd.toFixed(2)')+'m ≥0.85+0.4)');

// ══ T-B 模型重做 ══
console.log('T-B 模型重做: 残骸简化 / 轿车加料 / 卡车加料');
// 就地净位 (谷道另一段): tankWreck/carWreck 无返回值 ⇒ 用 world.children 长度差判落地并取新组
G('_b0=BOXES.length; _p0=PROPS.length; _c0=coverPoints.length; _wN=world.children.length; tankWreck(_spot.x-24,_spot.z,0); _tw=(world.children.length>_wN)?world.children[world.children.length-1]:null;');
ok(G('!!_tw&&_tw.wkRole==="tank"')===true,'T-B1 tankWreck 落地构建 (谷道净位)');
G('_meshN=0; _tags={}; if(_tw) _tw.traverse(o=>{ if(o.isMesh){ _meshN++; _tags[o.wkPart||"?"]=1; } });');
ok(G('_meshN>=10&&_meshN<=26')===true,'T-B2 ★残骸件数 44→简化档 (实得 '+G('_meshN')+' 件, 目标 10~26)');
ok(G('!!(_tags.hull&&(String(Object.keys(_tags)).indexOf("barrel")>=0)&&(_tags.turret||_tags.turretFront||_tags.barrelStump)&&(_tags.barrel1||_tags.barrel2||_tags.barrelStump))')===true,'T-B3 ★剪影核心保留: 车体+炮塔+炮管 (件标 '+G('Object.keys(_tags).join(",")')+')');
ok(G('BOXES.length===_b0+1&&PROPS.length===_p0+1&&coverPoints.length===_c0+2')===true,'T-B4 ★碰撞口径逐字不动 (实体盒+1/PROPS+1/coverPoints+2)');
{const s5b=fs.readFileSync(path.join(root,'js/05b-props.js'),'utf8');
const twFn=(s5b.split('function tankWreck')[1]||'').split('\nfunction ')[0];
const wrN=(twFn.match(/\bwr\(/g)||[]).length;
ok(wrN===1,'T-B5 ★取数红线: tankWreck 全局取数仍恰好 1 次 wr( (实得 '+wrN+')');}
G('_wN2=world.children.length; carWreck(_spot.x-30,_spot.z,0); _cw=(world.children.length>_wN2)?world.children[world.children.length-1]:null;');
G('_cwN=0; if(_cw) _cw.traverse(o=>{ if(o.isMesh) _cwN++; });');
ok(G('!!_cw&&_cwN>=10&&_cwN<=16')===true,'T-B6 ★轿车 6→13 件三厢轮廓 (实得 '+G('_cwN')+' 件)');
// 轿车碰撞盒尺寸逐位核对 (1.75×1.24×4.2, ry=0 不交换 + crush)
G('_cwB=null; for(const b of BOXES){ const cx=(b.minX+b.maxX)/2, cz=(b.minZ+b.maxZ)/2; if(Math.abs(cx-(_spot.x-30))<0.1&&Math.abs(cz-_spot.z)<0.1&&b.crush) _cwB=b; }');
ok(G('!!_cwB&&Math.abs((_cwB.maxX-_cwB.minX)-1.75)<0.01&&Math.abs((_cwB.maxZ-_cwB.minZ)-4.2)<0.01&&Math.abs((_cwB.maxY-_cwB.minY)-1.24)<0.01')===true,'T-B7 ★轿车碰撞盒逐位不动 (1.75×1.24×4.2 + crush)');
// 卡车
G('_tkN=0; trucks[0].grp.traverse(o=>{ if(o.isMesh) _tkN++; });');
ok(G('_tkN>=16&&_tkN<=26')===true,'T-B8 ★卡车 11→21 件军卡轮廓 (实得 '+G('_tkN')+' 件)');
ok(G('trucks[0].wheels.length===6&&trucks[0].wheels[0].geometry.parameters.radiusTop===0.45')===true,'T-B9 ★卡车车轮账不动 (6 轮 + radiusTop 0.45 滚动折算)');
ok(G('CAMPAIGN.convoy.hp===800&&trucks[0].maxHp===800')===true,'T-C1 ★卡车血量 320→800 (配置单源+构造回退双在位)');

// ══ T-C 断崖公路: 崖顶出生 / OCC 走廊 / 卡车索敌 ══
console.log('T-C 断崖公路 1940: 崖顶出生 + OCC 走廊 + Bot 打卡车');
G('_sp0=(CAMPAIGN.spawns||[]).filter(s=>s.team===0);');
ok(G('_sp0.length===6')===true,'T-C2 我军 6 伏击点在位');
G('_topN=0; for(const s of _sp0){ const rd=roadDist(s.x,s.z), h=heightAt(s.x,s.z); if(rd>28&&h>13) _topN++; }');
ok(G('_topN===6')===true,'T-C3 ★六点全在崖顶 (rd>28 且 h>13; 实得 '+G('_topN')+'/6)');
ok(G('_sp0.every(s=>String(s.name).indexOf("崖")>=0)')===true,'T-C4 部署点名同步改崖 (南崖/北崖伏击点)');
G('_occ0=0,_occMid=0; { const res=OCC.res, off=OCC.off, N=OCC.N, d=OCC.data; for(const s of _sp0){ const i0=Math.floor((s.x+off)/res), j0=Math.floor((s.z+off)/res); if(d[j0*N+i0]===0) _occ0++; let bx=0,bz=0,bd=1e9; for(const r of CAMPAIGN.roads){ const dx=r[2]-r[0],dz=r[3]-r[1],L2=dx*dx+dz*dz||1e-9; let t=((s.x-r[0])*dx+(s.z-r[1])*dz)/L2; t=clamp(t,0,1); const px=r[0]+dx*t,pz=r[1]+dz*t,dd=Math.hypot(s.x-px,s.z-pz); if(dd<bd){bd=dd;bx=px;bz=pz;} } for(const u of [0.4,0.7]){ const mx=s.x+(bx-s.x)*u, mz=s.z+(bz-s.z)*u; const i2=Math.floor((mx+off)/res), j2=Math.floor((mz+off)/res); if(d[j2*N+i2]===0) _occMid++; } } }');
ok(G('_occ0===6&&_occMid===12')===true,'T-C5 ★崖顶 OCC 走廊打通 (出生 6/6 格 + 走廊中段 12/12 格 = 0 占用)');
// 卡车索敌: 坦克优先 / 无坦克取最近卡车 / 护运方不索己方卡车
G('_sol={team:0,pos:V3(trucks[2].pos.x+4,trucks[2].pos.y,trucks[2].pos.z),isPlayer:false};');
G('_tkAlive=tanks.map(t=>t.alive); tanks.forEach(t=>t.alive=false); _trkHit=enemyTankNear(_sol,120); tanks.forEach((t,i2)=>t.alive=_tkAlive[i2]);');
ok(G('_trkHit&&_trkHit.kind==="truck"&&_trkHit===trucks[2]')===true,'T-C6 ★无坦克在程内: enemyTankNear 返回最近卡车 (索敌不打卡车主根因)');
G('_tk0=tanks.find(t=>t.alive); _sol2={team:0,pos:V3(_tk0.pos.x+3,_tk0.pos.y,_tk0.pos.z),isPlayer:false}; _tHit=enemyTankNear(_sol2,120);');
ok(G('_tHit&&_tHit.kind==="tank"')===true,'T-C6b 坦克优先级保留 (有坦克在程内仍打坦克)');
G('tanks.forEach(t=>t.alive=false); _own=enemyTankNear({team:1,pos:V3(trucks[0].pos.x+4,trucks[0].pos.y,trucks[0].pos.z),isPlayer:false},120); tanks.forEach(t=>t.alive=true);');
ok(G('_own===null')===true,'T-C6c 护运方不索己方卡车 (敌我过滤)');
// AT bot 源码锚: 火箭筒/反坦克枪分支消费 eTank (truck.kind 兼容 .pos 命中链)
ok(fs.readFileSync(path.join(root,'js/14-bots.js'),'utf8').includes('const eTank=enemyTankNear(this,120);')===true,'T-C7 源码锚: AT 兵种经 enemyTankNear 取目标 (命中/伤害管线既有, 无需新弹道)');

// ══ T-D 点位周边补给箱数量 (淞沪: 旗点图) ══
console.log('T-D 游戏内容设置: 点位周边补给箱数量 1/2');
const IDX_S=(()=>{ const c0=boot(0); return vm.runInContext('CAMPAIGNS.findIndex(c=>c.id==="songhu")',c0); })();
const ctxS1=boot(IDX_S);
const n1=vm.runInContext('AMMO_CRATES.length',ctxS1);
const ctxS2=boot(IDX_S,{sf_crates:'2'});
const n2=vm.runInContext('AMMO_CRATES.length',ctxS2);
ok(n2>n1,'T-D1 ★sf_crates=2 补给箱总量增加 ('+n1+' → '+n2+')');
vm.runInContext('_per={}; FLAGS.forEach(f=>{ _per[f.id]=AMMO_CRATES.filter(c=>Math.hypot(c.x-f.x,c.z-f.z)<=16).length; });',ctxS2);
ok(vm.runInContext('Object.keys(_per).every(k=>_per[k]>=2)',ctxS2)===true,'T-D2 ★每旗 ≥2 箱错开 (淞沪 '+vm.runInContext('FLAGS.length',ctxS2)+' 旗: '+JSON.stringify(vm.runInContext('_per',ctxS2))+')');
vm.runInContext('_minSep=99; FLAGS.forEach(f=>{ const cs2=AMMO_CRATES.filter(c=>Math.hypot(c.x-f.x,c.z-f.z)<=16); for(let i2=0;i2<cs2.length;i2++)for(let j2=i2+1;j2<cs2.length;j2++) _minSep=Math.min(_minSep,Math.hypot(cs2[i2].x-cs2[j2].x,cs2[i2].z-cs2[j2].z)); });',ctxS2);
ok(vm.runInContext('_minSep>=2.4',ctxS2)===true,'T-D3 ★两箱错开 (最近对距 '+vm.runInContext('_minSep.toFixed(2)',ctxS2)+'m ≥2.4)');
// 默认 1: 零漂移 —— 默认档箱数=旗+基地 (每旗恰 1, verify-layouts 不变量另闸)
ok(n1===vm.runInContext('FLAGS.length+BASES.length',ctxS1),'T-D4 ★默认 1 档零漂移 (箱数 = 旗数+基地数: '+n1+')');
// 设置 UI 接线锚
ok(html.includes('id="supplyCrateBtn"')===true,'T-D5 ★index.html 设置卡在位 (#supplyCrateBtn, 游戏内容设置面板)');
ok(fs.readFileSync(path.join(root,'js/22-hud.js'),'utf8').includes("localStorage.getItem('sf_crates')==='2'")===true,'T-D6 源码锚: 22-hud 循环钮读写 sf_crates');
ok(fs.readFileSync(path.join(root,'js/00b-i18n.js'),'utf8').includes("'点位周边补给箱数量':'SUPPLY CRATES PER POINT'")===true,'T-D7 i18n 键闭环 (标题 EN 在册)');

// ══ 汇总 ══
console.log('\n合计: '+PASS.length+' 通过 / '+FAILN+' 失败');
if(FAILN){ process.exit(1); }
console.log('verify-20261117 全部通过 ✔');
