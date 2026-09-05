// ─────────────────────────────────────────────
// 05-world.js —— 世界构建框架: 布局随机/几何缓存/碰撞同源/可破坏结构组/
//               地基/墙段/屋顶/楼梯/选址登记/道具占位互斥
// 源: Index.original.html 第 1452-1760 行
// 2026-08-24 切分: 建筑实例→05a-buildings, 道具植被→05b-props, 布局/组装→05c-layouts
// ─────────────────────────────────────────────
'use strict';
const world = new THREE.Group(); scene.add(world);
const NAV_CLEARS=[];
// ===== 建筑框架: 布局随机 =====
// URL 带 ?seed=N 时世界布局用确定性随机(便于复现验证同一布局), 否则维持 Math.random
const WORLD_SEED=(()=>{ try{ const m=location.search.match(/(?:\?|&)seed=(\d+)/); return m?((parseInt(m[1])||1)>>>0):0; }catch(e){ return 0; } })();
let _wstate=WORLD_SEED||0;
function wRand(){ _wstate=(_wstate+0x6D2B79F5)|0; let t=Math.imul(_wstate^(_wstate>>>15),1|_wstate); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }
const wr=(a,b)=>WORLD_SEED?a+wRand()*(b-a):rand(a,b);
const wri=(a,b)=>Math.floor(wr(a,b+1));
// ===== 建筑框架: 几何缓存 (同尺寸盒子复用几何体, 削减上千重复 BoxGeometry) =====
const _geoCache=new Map();
function boxGeo(w,h,d){
const k=w.toFixed(2)+'x'+h.toFixed(2)+'x'+d.toFixed(2);
let g=_geoCache.get(k);
if(!g){ g=new THREE.BoxGeometry(w,h,d); _geoCache.set(k,g); }
return g;
}
function mesh(geo,mat,x,y,z,ry=0,cast=true,recv=true){
const m=new THREE.Mesh(geo,mat);
m.position.set(x,y,z); m.rotation.y=ry;
m.castShadow=cast; m.receiveShadow=recv;
world.add(m); return m;
}
// 实心盒子: 视觉+碰撞同源。正交朝向=精确 AABB; 斜置分两种近似:
//  - 薄条(墙/护栏/楼梯): 沿长轴小块链, 块径≈短边(≥0.34);
//  - 大截面(楼板/平台/屋盖): 2D 小块阵贴片(边长1.7, 间距1.5, 全覆盖可站立),
//    修掉旧实现"旋转地板只有一条1.6m碰撞条"导致的一走就掉。
// chain 参数=强制用 1D 链(屋顶碰撞带等粗链), 链块尺寸取该值。
function solidBox(mat,w,h,d,x,y,z,ry=0,chain,crush){
const m=mesh(boxGeo(w,h,d),mat,x,y,z,ry);
// 碰撞盒回挂视觉网格: killBox 时连同网格一起移除 (屋顶碰撞带/山墙与此同源)
const sn=Math.sin(ry), cs=Math.cos(ry);
if(Math.abs(sn)<0.02||Math.abs(cs)<0.02){
const swap=Math.abs(sn)>0.5;
const bb=addBoxCollider(x,y,z, swap?d:w, h, swap?w:d); bb.mesh=m; if(crush) bb.crush=true;
} else {
const long=Math.max(w,d), short=Math.min(w,d);
const s=chain||clamp(short*1.15,0.34,1.6);
const dirX=w>=d?cs:-sn, dirZ=w>=d?-sn:cs;
const perpX=w>=d?-sn:-cs, perpZ=w>=d?-cs:sn;
const nLong=Math.max(1,Math.ceil(long/(s*0.92)));
const nShort=(!chain&&short*1.15>1.55)?Math.max(1,Math.ceil(short/(s*0.92))):1;
for(let i=0;i<nLong;i++)for(let j=0;j<nShort;j++){
const t=nLong===1?0:-long/2+s/2+i*(long-s)/(nLong-1);
const u=nShort===1?0:-short/2+s/2+j*(short-s)/(nShort-1);
const bb=addBoxCollider(x+dirX*t+perpX*u, y, z+dirZ*t+perpZ*u, s, h, s); bb.mesh=m; if(crush) bb.crush=true;
}
}
return m;
}
// ===== 地物贴坡: 采样物体局部轴向的地面高差 → 贴合俯仰/侧倾角 + 落地高度 =====
// 约定与载具悬挂一致 (YXZ 序): 局部 X=物体长轴, +X 端抬高=正 roll; 局部 Z=短轴(正面), +Z 端抬高=负 pitch
const _UP=new THREE.Vector3(0,1,0), _FWD=new THREE.Vector3(0,0,1), _N=new THREE.Vector3();
function groundFit(x,z,ry,spanX,spanZ){
const cs=Math.cos(ry), sn=Math.sin(ry);
const hx0=heightAt(x-cs*spanX,z+sn*spanX), hx1=heightAt(x+cs*spanX,z-sn*spanX);
const hz0=heightAt(x-sn*spanZ,z-cs*spanZ), hz1=heightAt(x+sn*spanZ,z+cs*spanZ);
return {y:(hx0+hx1+hz0+hz1)/4, pitch:-Math.atan2(hz1-hz0,2*spanZ), roll:Math.atan2(hx1-hx0,2*spanX)};
}
// 地形法线 (供圆柱/圆盘类径向对称物体贴坡用)
function terrNormal(x,z){
const e=0.6;
return _N.set(-(heightAt(x+e,z)-heightAt(x-e,z))/(2*e),1,-(heightAt(x,z+e)-heightAt(x,z-e))/(2*e)).normalize();
}
// 把贴坡姿态写入 mesh (rotation.y 保持原值可外部读取)
function applyFit(m,ry,fit){
m.rotation.order='YXZ';
m.rotation.set(fit.pitch,ry,fit.roll);
return m;
}
const coverPoints=[];
function addCoverAround(x,z,w,d,ry=0){
const cs=Math.cos(ry),sn=Math.sin(ry);
const off=[[0,d/2+0.9],[0,-d/2-0.9],[w/2+0.9,0],[-w/2-0.9,0]];
for(const o of off){
coverPoints.push({x:x+o[0]*cs+o[1]*sn, z:z-o[0]*sn+o[1]*cs});
}
}
// ===== 可破坏结构组 (沿用原有 DESTRUCTIBLES 机制) =====
const DESTRUCTIBLES=[];
let _dG=null;
function dBegin(){ _dG={meshes:[],bi:[],hp:230,cx:0,cz:0,n:0,dead:false}; }
function dBox(mat,w,h,d,x,y,z,ry){
const before=BOXES.length;
const m=solidBox(mat,w,h,d,x,y,z,ry);
for(let i=before;i<BOXES.length;i++) _dG.bi.push(i);
_dG.meshes.push(m);
_dG.cx+=x; _dG.cz+=z; _dG.n++;
return m;
}
function dEnd(pre){
const g=_dG; _dG=null;
if(!g||!g.n) return null;
g.cx/=g.n; g.cz/=g.n;
DESTRUCTIBLES.push(g);
for(const bi2 of g.bi){ if(BOXES[bi2]) BOXES[bi2].dGroup=g; }
if(pre) destroyStructure(g,true);
return g;
}
// 单个碰撞箱移除 (墙组销毁/屋顶坍塌的碰撞带共用)
// keepMesh 视觉残留模式: 2026-09-01 倒塌重构后结构系统不再使用(网格即刻移除), 字段保留兼容
function killBox(b){
if(b.dead) return; b.dead=true;
if(b.mesh&&b.mesh.parent&&!b.keepMesh) world.remove(b.mesh);
if(OCC.data){
const i0=clamp(Math.floor((b.minX-0.7+OCC.off)/OCC.res),0,OCC.N-1),i1=clamp(Math.ceil((b.maxX+0.7+OCC.off)/OCC.res),0,OCC.N-1);
const j0=clamp(Math.floor((b.minZ-0.7+OCC.off)/OCC.res),0,OCC.N-1),j1=clamp(Math.ceil((b.maxZ+0.7+OCC.off)/OCC.res),0,OCC.N-1);
for(let j=j0;j<=j1;j++)for(let i2=i0;i2<=i1;i2++) OCC.data[j*OCC.N+i2]=0;
}
	b.minX=99999; b.minY=99999; b.minZ=99999; b.maxX=99999.1; b.maxY=99999.1; b.maxZ=99999.1;
}
// 2026-09-02 坦克越野碾压: 碾毁单个掩体碰撞箱 (视觉网格随 killBox 移除; 树篱等植被记 rec 走 vanishFlora 即时清理), 扬尘碎屑
function crushCoverBox(b){
if(!b||b.dead) return;
const cx=(b.minX+b.maxX)/2, cz=(b.minZ+b.maxZ)/2, gy=(b.minY+b.maxY)/2;
if(b.flora&&typeof vanishFlora==='function'){
vanishFlora(b.flora,true);
}else{
killBox(b);
for(let k=0;k<5;k++) spawnP(PT.dirt,cx+rand(-0.6,0.6),gy+rand(0,0.4),cz+rand(-0.6,0.6),rand(-2,2),rand(0.8,2.4),rand(-2,2),rand(0.25,0.5),0.7,rand(0.5,0.9),0.9,4);
}
if(typeof markNavDirty==='function') markNavDirty();
}
// 屋顶整体坍塌: 视觉坡板/山墙/碰撞带阶梯网格一并移除(可毁建筑与建成即塌共用)
// 2026-09-01 重构: 运行期坍塌(!silent)不再"停留→沉入地下"—— 全部部件即刻物理碎块化塌落 + 扬尘 + 闷响。
// 旧版三 bug 根源: ①阶梯带网格 keepMesh 残留空中且下沉任务不含带网格=永不清理(屋顶浮空)
// ②碎块化被推迟到 9~13s 停留期结束才播(延迟倒塌/倒塌动画不播放) ③沉入地下视觉怪异
// 2026-09-05 用户实机反馈: 整楼拆光后二楼/三楼楼板浮空 —— 根因=层间楼板( solidBox )不挂任何坍塌链。
// 修法: pitchedRoof 新收 o.slabs=[{m,b:[BOXES]}], 塌顶时楼板/走台一并碎块化+碰撞击杀 (整楼煎饼式坍塌)
function collapseRoof(ref,silent){
if(ref.done) return; ref.done=true;
const rms=Array.isArray(ref.m)?ref.m:[ref.m];
const bands=ref.bands||[];
const slabBs=[];
if(silent){
for(const rm of rms) if(rm&&rm.parent) world.remove(rm);
for(const e of (ref.slabs||[])){ if(e.m&&e.m.parent) world.remove(e.m); for(const b of (e.b||[])) killBox(b); }
}else{
// 即刻碎块化: 坡板+山墙(rms) 与 碰撞带阶梯网格(band.mesh, 链式多盒共享一网格) 去重后一并抛出,
// 碎块从屋顶高度物理塌落 (整片屋盖当场碎裂)
const kept=rms.filter(rm=>rm&&rm.parent);
const seen=new Set(kept);
for(const b of bands){ if(b&&b.mesh&&b.mesh.parent&&!seen.has(b.mesh)) seen.add(b.mesh); }
for(const e of (ref.slabs||[])){ if(e.m&&e.m.parent&&!seen.has(e.m)) seen.add(e.m); for(const b of (e.b||[])) slabBs.push(b); }
let cx=0,cz=0;
for(const m of kept){ cx+=m.position.x; cz+=m.position.z; }
if(kept.length){ cx/=kept.length; cz/=kept.length; }
for(const m of seen) spawnWallDebris(m,cx,cz);
// 坍塌扬尘 (以各坡板自身位置为尘源)
for(const rm of kept){
for(let k=0;k<3;k++) spawnP(PT.dirt,rm.position.x+rand(-1.5,1.5),rm.position.y,rm.position.z+rand(-1.5,1.5),rand(-2,2),rand(0,2),rand(-2,2),rand(0.5,0.8),1.5,rand(0.8,1.2),0.85,3);
}
AudioSys.explosion(Math.hypot(cx-camera.position.x,cz-camera.position.z)*0.85);
for(const rm of seen) world.remove(rm);
}
// 碰撞带连同其阶梯网格一并击杀 (不再 keepMesh —— 残留空中 = 屋顶浮空 bug 根源)
for(const b of bands) killBox(b);
for(const b of slabBs) killBox(b);
}
// 2026-09-02 倒塌后的碎石堆: 战场停留 RUBBLE_TTL 秒后沉入地下消失 (queueSink 由 08-effects 提供;
// 仅运行期倒塌调用 —— 世界构建期 silent 分支保持与地图同生共死的"历史废墟", 不受影响)
const RUBBLE_TTL=25, RUBBLE_SINK=3.5;
function rubblePileFX(cx,cz,gy){
const piles=[];
for(let k=0;k<4;k++){
piles.push(mesh(boxGeo(wr(0.4,0.9),wr(0.25,0.55),wr(0.4,0.9)),wr(0,1)<0.5?MAT.rubble:MAT.brick,cx+wr(-1.8,1.8),gy+wr(0.1,0.35),cz+wr(-1.8,1.8),wr(0,3)));
}
if(typeof queueSink==='function'){
queueSink({objs:piles,depth:3.4,rest:RUBBLE_TTL,sink:RUBBLE_SINK});
}
return piles;
}
function destroyStructure(g,silent){
if(g.dead) return; g.dead=true;
// 结构自定义死亡行为 (2026-09-05 城市组: 钢水包→爆炸+火区); 世界构建期预塌(silent)不触发
if(!silent&&g.onDead){ try{ g.onDead(g); }catch(e){} }
if(silent){
for(const m of g.meshes) if(m&&m.parent) world.remove(m);
// 预塌废墟的常驻碎石堆 (与世界一同生成, 不参与下沉)
const gy0=heightAt(g.cx,g.cz);
for(let k=0;k<4;k++){
mesh(boxGeo(wr(0.4,0.9),wr(0.25,0.55),wr(0.4,0.9)),wr(0,1)<0.5?MAT.rubble:MAT.brick,g.cx+wr(-1.8,1.8),gy0+wr(0.1,0.35),g.cz+wr(-1.8,1.8),wr(0,3));
}
}else{
// 2026-09-01 重构: 墙体摧毁即刻碎块化倒塌 —— 物理碎块当场飞溅 + 原地碎石堆
// (2026-09-02 起停留 RUBBLE_TTL 秒后沉入消失),
// 不再"碰撞死/视觉站立 9~13s → 整墙沉入地下"(延迟倒塌、沉入地下、动画缺席三 bug 的根源)
const ms=g.meshes.filter(m=>m&&m.parent);
const gy=heightAt(g.cx,g.cz);
for(const m of ms) spawnWallDebris(m,g.cx,g.cz);
for(const m of ms) world.remove(m);
rubblePileFX(g.cx,g.cz,gy); // 常驻碎石堆 → 停留 RUBBLE_TTL 秒后沉入消失
// 崩塌灰尘: 底部滚出的浓尘 + 升腾烟柱 + 飞溅碎屑
for(let k=0;k<10;k++){
const a=rand(0,TAU), rr=rand(0.5,2.2);
spawnP(PT.dirt,g.cx+Math.sin(a)*rr,gy+rand(0.1,0.5),g.cz+Math.cos(a)*rr,Math.sin(a)*rand(1.5,3.5),rand(0.3,1.2),Math.cos(a)*rand(1.5,3.5),rand(0.7,1.2),2.2,rand(1.2,2),0.85,0.6);
}
for(let k=0;k<8;k++) spawnP(PT.smoke,g.cx+rand(-2,2),gy+rand(0.5,2.8),g.cz+rand(-2,2),rand(-0.6,0.6),rand(0.8,2),rand(-0.6,0.6),rand(1,1.6),2.8,rand(1.8,2.8),0.7,0.1);
for(let k=0;k<8;k++) spawnP(PT.dirt,g.cx+rand(-1.5,1.5),gy+rand(1,2.8),g.cz+rand(-1.5,1.5),rand(-4,4),rand(2,6),rand(-4,4),rand(0.3,0.55),0.5,rand(0.6,1),0.9,7);
AudioSys.explosion(Math.hypot(g.cx-camera.position.x,g.cz-camera.position.z)*0.7);
if(player.alive&&Math.hypot(g.cx-player.pos.x,g.cz-player.pos.z)<25) addTrauma(0.4);
}
// 碰撞即刻死亡(碎墙即刻可通行); 视觉网格已在上方移除, 不再 keepMesh 残留
for(const i of g.bi) killBox(BOXES[i]);
	// 承重墙被毁 → 残余支撑墙≤2 或 任一楼层被掏空(该层剩≤1面) → 屋顶+楼板整体坍塌
	// (2026-09-05 用户实机反馈"振金": 多层楼 8~12 组墙只按总数≤2 判 = 轰掉整面可见墙楼不塌 ——
	//  墙组挂 wFloor 楼层标记(带标记的组才参与掏空判定), 老房屋无标记走原 ≤2 规则行为不变)
	if(g.roofRef&&!g.roofRef.done){
	g.roofRef.dead++;
	let alive=0;
	const floors=new Map();
	for(const wg of g.roofRef.carry||[]){
	if(wg.dead) continue;
	alive++;
	if(wg.wFloor!==undefined) floors.set(wg.wFloor,(floors.get(wg.wFloor)||0)+1);
	}
	let trig=alive<=2;
	if(!trig) for(const n of floors.values()){ if(n<=1){ trig=true; break; } }
	if(trig) collapseRoof(g.roofRef,silent);
	}
// 竖向承重链 (2026-09-05 用户实机反馈"二楼墙浮空"): 某层一面墙垮塌 → 正上方楼层的同面墙
// 失去支承随之垮塌 (递归到顶; 上层墙走完整 destroyStructure = 自带碎块化/扬尘/掏空判定)
if(g.wallAbove&&!g.wallAbove.dead) destroyStructure(g.wallAbove,silent);
// 墙塌后 Bot 寻路刷新 (markNavDirty 定义在 07-nav, 世界构建期不可直接调)
if(typeof markNavDirty==='function') markNavDirty();
}
function damageStructures(p,radius,amt){
// 所有爆炸的统一入口: 同步作用于植被 (近距离树被掀倒/灌木炸没, 见 04b-fire)
if(typeof explosionFlora==='function') explosionFlora(p,radius);
for(const g of DESTRUCTIBLES){
if(g.dead) continue;
const d=Math.hypot(g.cx-p.x,g.cz-p.z);
if(d<radius+3){
g.hp-=amt*(1-d/(radius+3)*0.6);
if(g.hp<=0) destroyStructure(g);
}
}
}
// ===== 建筑框架: 局部坐标上下文 =====
// 局部 +z = 建筑正面(门); L(lx,lz) 局部→世界; g0=楼面高度(地基算出)
function bctx(x,z,ry,g0){
const cs=Math.cos(ry),sn=Math.sin(ry);
return {x,z,ry,g0,cs,sn,doors:[],L:(lx,lz)=>[x+lx*cs+lz*sn, z-lx*sn+lz*cs]};
}
// ===== 建筑框架: 地基 =====
// 多点采样足迹地形 → 楼面=最高点+raise(消灭墙底悬空/穿模);
// 沿墙线分段生成贴地裙墙(每段随当地地形, 顶面≤当地地面+0.46 → 不进 Bot 占用格, 可步上);
// 墙底缝隙用纯视觉填充条补齐; 室内地面=原地形(Bot 可入内的关键)
function foundation(x,z,ry,w,d,opt={}){
const cs=Math.cos(ry),sn=Math.sin(ry);
const L=(lx,lz)=>[x+lx*cs+lz*sn, z-lx*sn+lz*cs];
const m=opt.margin||0.3;
let hMin=1e9,hMax=-1e9;
for(const [lx,lz] of [[-w/2-m,-d/2-m],[w/2+m,-d/2-m],[w/2+m,d/2+m],[-w/2+m,d/2+m],[0,0],[w/2+m,0],[-w/2+m,0],[0,d/2+m],[0,-d/2-m]]){
const p=L(lx,lz), h=heightAt(p[0],p[1]);
if(h<hMin)hMin=h; if(h>hMax)hMax=h;
}
const floor=hMax+(opt.raise!==undefined?opt.raise:0.06);
// 视觉: 低石台(室内露出泥地) + 坡地墙底填充条
mesh(boxGeo(w+0.6,hMin+0.12-(hMin-0.35),d+0.6),MAT.stone,x,(hMin+0.12+hMin-0.35)/2,z,ry,false,true);
if(floor-hMin>0.18){
for(const [ex,ez,lw,ld] of [[0,d/2,w+0.1,0.3],[0,-d/2,w+0.1,0.3],[w/2,0,0.3,d+0.1],[-w/2,0,0.3,d+0.1]]){
const p=L(ex,ez);
mesh(boxGeo(lw,floor-(hMin-0.25),ld),MAT.stone,p[0],(floor+hMin-0.25)/2,p[1],ry,false,true);
}
}
// 裙墙: 四边分段实心(含碰撞), 每段独立贴地
const t=0.55;
const edge=(along,at,from,to)=>{
const n=Math.max(1,Math.round((to-from)/3));
for(let i=0;i<n;i++){
const c=from+(to-from)*(i+0.5)/n, len=(to-from)/n+0.18;
const p=along==='x'?L(c,at):L(at,c);
const gh=heightAt(p[0],p[1]);
const top=Math.min(floor,gh+0.46), bot=gh-0.5;
if(top-bot<0.2) continue;
if(along==='x') solidBox(MAT.stone,len,top-bot,t,p[0],(top+bot)/2,p[1],ry);
else solidBox(MAT.stone,t,top-bot,len,p[0],(top+bot)/2,p[1],ry);
}
};
edge('x', d/2, -w/2, w/2); edge('x', -d/2, -w/2, w/2);
edge('z', w/2, -d/2, d/2); edge('z', -w/2, -d/2, d/2);
return {floor,hMin,hMax};
}
// ===== 建筑框架: 墙段生成器 =====
// 沿局部X/Z一面墙, 按开洞表切分, 视觉与碰撞同源。
// o:{along:'x'|'z', at, from, to, h, t, mat, y0=0, ops, destr, preDead}
// 开洞 op: {c:沿墙位置, w:洞宽, b:窗台高(0=落地), h:洞高, ht:楣顶高(默认墙顶), type:'door'|'win'|'slit'}
// 门自动: NAV_CLEARS 通行区(半径=门宽/2+0.75, 有台阶时1.55, 上限2.2) + 门外缓冲台阶(步高≤0.42)
function wallSeg(ctx,o){
const y0=o.y0||0, t=o.t, mat=o.mat;
// 侧墙(along:'z')两端各向前后墙中线延伸一个墙厚: 角部被主墙盒体包住,
// 消除四面墙交界处内侧的竖向透缝(旧参数 -d/2+t~d/2-t 在主墙内侧面留下 t/2 宽缝)
const from0=o.along==='z'?o.from-t:o.from, to0=o.along==='z'?o.to+t:o.to;
const ops=(o.ops||[]).slice().sort((a,b)=>a.c-b.c);
const spans=[];
let cur=from0;
for(const op of ops){
const c0=op.c-op.w/2, c1=op.c+op.w/2;
const b=y0+(op.b||0);
// 开洞上方混凝土/木构件: 门从楣底(ht)到墙顶, 窗从 b+h 到墙顶
const upFrom=y0+(op.ht!==undefined?op.ht:(op.b||0)+(op.h||0));
if(c0>cur+0.06) spans.push([cur,c0,y0,y0+o.h]);
if(b>y0+0.06) spans.push([c0,c1,y0,b]);
if(upFrom>y0+0.06&&upFrom<y0+o.h-0.06) spans.push([c0,c1,upFrom,y0+o.h]);
cur=c1;
}
if(to0>cur+0.06) spans.push([cur,to0,y0,y0+o.h]);
const emit=o.destr?dBox:solidBox;
if(o.destr) dBegin();
for(const s of spans){
const len=s[1]-s[0], c=(s[0]+s[1])/2, hh=s[3]-s[2];
if(len<0.05||hh<0.05) continue;
const p=o.along==='x'?ctx.L(c,o.at):ctx.L(o.at,c);
emit(mat, o.along==='x'?len:t, hh, o.along==='x'?t:len, p[0], ctx.g0+(s[2]+s[3])/2, p[1], ctx.ry);
}
const g=o.destr?dEnd(o.preDead):null;
for(const op of ops){
if(op.type!=='door') continue;
const lx=o.along==='x'?op.c:o.at, lz=o.along==='x'?o.at:op.c;
const dx=o.along==='x'?0:(o.at>=0?1:-1), dz=o.along==='x'?(o.at>=0?1:-1):0;
const nSteps=doorSteps(ctx,lx,lz,dx,dz,op.w,t);
const p=ctx.L(lx,lz);
NAV_CLEARS.push({x:p[0],z:p[1],r:Math.min(2.2,Math.max(op.w/2+0.75,nSteps?1.55:0))});
// 门法线存世界方向(验证/出生点/机枪位复用)
ctx.doors.push({x:p[0],z:p[1],w:op.w,dx:dx*ctx.cs+dz*ctx.sn,dz:-dx*ctx.sn+dz*ctx.cs,g0:ctx.g0});
}
return g;
}
// 门外缓冲台阶: 楼面高于门外地面>0.42 时生成, 步高≤0.42, 最多3级
function doorSteps(ctx,lx,lz,dx,dz,w,t){
const out=ctx.L(lx+dx*1.1,lz+dz*1.1);
const gh=heightAt(out[0],out[1]);
const rise=ctx.g0-gh;
if(rise<=0.42) return 0;
const n=Math.min(3,Math.ceil(rise/0.42));
const tr=0.44;
for(let i=0;i<n;i++){
const top=gh+rise*(i+1)/n;
const dist=t/2+tr/2+(n-1-i)*tr;
const p=ctx.L(lx+dx*dist,lz+dz*dist);
if(dx!==0) solidBox(MAT.stone,0.55,0.36,w+0.6,p[0],top-0.18,p[1],ctx.ry);
else solidBox(MAT.stone,w+0.6,0.36,0.55,p[0],top-0.18,p[1],ctx.ry);
}
return n;
}
// ===== 建筑框架: 双坡屋顶 =====
// 坡板用 YXZ 序(倾斜绕屋顶自身横轴, 朝向旋转后不会侧滚装反);
// 碰撞用每坡2条阶梯带(粗链近似) → 挡子弹/视线/炸弹, 陡坡不可攀;
// 返回 roofRef{m:视觉, bands:碰撞带, carry:承重墙} 挂到承重墙组, 残余承重墙≤2 面 → 整体坍塌
// o:{axis:'x'|'z'(屋脊方向), w,d, y0(墙顶高), rise, mat, over, wallGs, preDead, skip(缺一侧坡±1), t(山墙厚), gableMat}
function pitchedRoof(ctx,o){
const over=o.over!==undefined?o.over:0.45;
const ridgeLen=(o.axis==='x'?o.w:o.d)+over*2;
const span=(o.axis==='x'?o.d:o.w)/2+over;
const pitch=Math.atan2(o.rise,span);
const slope=Math.hypot(span,o.rise)+0.12;
const slabs=[], bands=[];
const signs=o.skip!==undefined?[o.skip]:[1,-1];
for(const sgn of signs){
const off=sgn*span/2;
const p=ctx.L(o.axis==='x'?0:off, o.axis==='x'?off:0);
const rm=mesh(boxGeo(o.axis==='x'?ridgeLen:slope, 0.14, o.axis==='x'?slope:ridgeLen), o.mat, p[0], ctx.g0+o.y0+o.rise/2, p[1], ctx.ry);
rm.rotation.order='YXZ';
if(o.axis==='x') rm.rotation.x=sgn*pitch; else rm.rotation.z=-sgn*pitch;
addSnowCap(rm); slabs.push(rm);
	// 碰撞带: 每坡3条, 顶面取带中心处的坡面高度(与视觉坡板基本齐平, 不外穿)
	// 相邻带高差=rise/3: 矮屋顶(≤1.45)可踏级登上, 高屋顶不可攀
	for(let k=0;k<3;k++){
	const q0=k*span/3, q1=(k+1)*span/3;
	const cc=sgn*(q0+q1)/2;
	const top=o.y0+o.rise*(1-(q0+q1)/2/span), bot=o.y0-0.35;
	const bp=ctx.L(o.axis==='x'?0:cc, o.axis==='x'?cc:0);
	const bi0=BOXES.length;
	const bm=solidBox(o.mat, o.axis==='x'?ridgeLen:q1-q0+0.08, top-bot, o.axis==='x'?q1-q0+0.08:ridgeLen, bp[0], ctx.g0+(top+bot)/2, bp[1], ctx.ry, 1.6);
	// 带内记录碰撞盒而非网格: killBox 以盒为单位(连同视觉移除), 存 mesh 会漏杀碰撞, 塌顶后留下隐形斜坡
	for(let bi=bi0;bi<BOXES.length;bi++) bands.push(BOXES[bi]);
	}
}
const rp=ctx.L(0,0);
const ridge=mesh(boxGeo(o.axis==='x'?ridgeLen+0.12:0.32, 0.16, o.axis==='x'?0.32:ridgeLen+0.12), o.mat, rp[0], ctx.g0+o.y0+o.rise+0.06, rp[1], ctx.ry);
addSnowCap(ridge); slabs.push(ridge);
// 承重墙记录进 roofRef.carry: 残余(未毁)支撑墙≤2 即塌顶
// o.slabs=[{m,b:[BOXES]}]: 楼板/走台等水平构件 —— 随塌顶一并坍塌 (2026-09-05 楼板浮空修复)
const ref={m:slabs, bands, slabs:o.slabs||[], dead:o.preDead||0, done:false, carry:(o.wallGs||[]).filter(w=>w&&!w.dead)};
// 山墙: 三层收分填三角(含碰撞), 各层宽度取其顶端的屋面宽度(±3%余量),
// 不会穿出坡面也不会在坡面下留出大缺口 (旧实现按墙宽线收分, 上层常戳穿屋顶)
// 山墙网格/碰撞并入 ref: 屋顶坍塌时随坡板一起移除(并生成碎块)
if(o.gable!==false){
const gT=o.t||0.42;
for(const e of [1,-1]){
const ex=o.axis==='x'?e*o.w/2:0, ez=o.axis==='x'?0:e*o.d/2;
for(let k=0;k<3;k++){
const wallW=(o.axis==='x'?o.d:o.w);
const len=Math.min(wallW, 2*span*(1-(k+1)/3)*0.97);
if(len<0.34) continue;
const p=ctx.L(ex,ez);
const bi0=BOXES.length;
const gm=solidBox(o.gableMat||o.mat, o.axis==='x'?gT:len, o.rise/3, o.axis==='x'?len:gT, p[0], ctx.g0+o.y0+(k+0.5)*o.rise/3, p[1], ctx.ry);
slabs.push(gm);
for(let bi=bi0;bi<BOXES.length;bi++) ref.bands.push(BOXES[bi]);
}
}
}
if(o.wallGs) for(const g of ref.carry) g.roofRef=ref;
// 支撑墙(含预塌)≤2 面: 建成即塌顶, 不留悬空房顶 (可毁房一般 4 墙, 预塌 1 面后仍 3 面)
if(o.wallGs&&ref.carry.length<=2) collapseRoof(ref,true);
return ref;
}
// ===== 建筑框架: 直跑楼梯 =====
// 从 (lx,lz) 沿局部 dir 上行: 步高=ceil((topY-base)/maxRise) 反推, 顶面与 topY 严格齐平(±0)
// dir: 'z+'|'z-'|'x+'|'x-'; o.exit=[lx,lz] 登顶落点(默认直线越过顶踏步), 记入 STAIRS 供验证
const STAIRS=[];
function stairFlight(ctx,o){
const rise=o.topY-o.base;
const n=Math.max(2,Math.ceil(rise/(o.maxRise||0.42)));
const sr=rise/n;
const tr=o.tread||Math.max(0.5,sr*1.45);
const [dx,dz]= o.dir==='z+'?[0,1]:o.dir==='z-'?[0,-1]:o.dir==='x+'?[1,0]:[-1,0];
for(let i=0;i<n;i++){
const p=ctx.L(o.lx+dx*((i+0.5)*tr), o.lz+dz*((i+0.5)*tr));
const top=o.base+sr*(i+1);
const bw=dx!==0?tr:o.width, bd=dx!==0?o.width:tr;
const b0=BOXES.length;
const m=solidBox(o.mat||MAT.woodDark,bw,0.24,bd,p[0],top-0.12,p[1],ctx.ry);
if(o.parts) o.parts.push({m,b:BOXES.slice(b0)}); // 坍塌链收集 (2026-09-05 修"楼梯浮空": 踏步随楼坍塌)
}
const ep=ctx.L.apply(ctx, o.exit||[o.lx+dx*(n*tr+0.35), o.lz+dz*(n*tr+0.35)]);
STAIRS.push({x:ep[0],z:ep[1],topY:o.topY,sr,width:o.width});
return {n,sr,tr,run:n*tr,parts:o.parts||null};
}
// ===== 建筑框架: 选址/足迹登记 (防建筑互穿/压旗杆/上道路) =====
const B_FOOT=[];   // 已占足迹矩形(AABB)
const BUILD_REG=[]; // 建筑登记表(验证/调试用)
function footRect(x,z,ry,w,d,m=1.1){
const cs=Math.abs(Math.cos(ry)),sn=Math.abs(Math.sin(ry));
const ex=(w*cs+d*sn)/2+m, ez=(w*sn+d*cs)/2+m;
return {x0:x-ex,x1:x+ex,z0:z-ez,z1:z+ez};
}
function rectsOverlap(a,b){ return a.x0<b.x1&&a.x1>b.x0&&a.z0<b.z1&&a.z1>b.z0; }
function terrainDelta(x,z,ry,w,d){
const cs=Math.cos(ry),sn=Math.sin(ry);
let mn=1e9,mx=-1e9;
for(const [kx,kz] of [[-1,-1],[1,-1],[1,1],[-1,1],[0,0]]){
const p=[x+(kx*w/2)*cs+(kz*d/2)*sn, z-(kx*w/2)*sn+(kz*d/2)*cs];
const h=heightAt(p[0],p[1]);
if(h<mn)mn=h; if(h>mx)mx=h;
}
return mx-mn;
}
function spotBlockedBuild(x,z,ry,w,d){
for(const f of CAMPAIGN.flags){ if(Math.hypot(x-f.x,z-f.z)<w*0.5+2.5) return true; }
if(roadDist(x,z)<5) return true;
if(RIVER&&inRiverChannel(x,z)) return true;
	if(BRIDGE&&onBridge(x,z,6)) return true;
	const MB=MAP_SIZE/2-14; // 随地图尺寸: 320 图=146 (与旧值一致), 800 图村庄可正常落址
	if(Math.abs(x)>MB||Math.abs(z)>MB) return true;
	return false;
}
// 随机摆建筑: 锚点附近环形带(ring0~radius, 默认4)取点, 校验地形高差/足迹重叠, 失败重试, 全败返回null(放弃该栋)
function placeBuild(ax,az,radius,w,d,o={}){
const ring0=o.ring0!==undefined?o.ring0:4;
for(let t=0;t<26;t++){
const a=wr(0,TAU), rr2=ring0+wr(0,Math.max(1,radius-ring0));
const px=ax+Math.sin(a)*rr2, pz=az+Math.cos(a)*rr2;
const ry=o.ry!==undefined?o.ry+wr(-0.12,0.12):wr(0,TAU);
if(spotBlockedBuild(px,pz,ry,w,d)) continue;
if(terrainDelta(px,pz,ry,w,d)>(o.maxDh!==undefined?o.maxDh:0.85)) continue;
const rect=footRect(px,pz,ry,w,d,o.margin!==undefined?o.margin:1.1);
if(!propFreeRect(rect)) continue; // 避让已放置道具(沙袋/箱子/弹坑/石墙段等), 否则房屋压住前一轮的道具
if(B_FOOT.some(f=>rectsOverlap(rect,f))) continue;
B_FOOT.push(rect);
return {x:px,z:pz,ry};
}
return null;
}
// 手写坐标摆建筑: 原地校验(高差宽限), 失败小偏移重试, 兜底原样登记
// o:{ox,oz: 足迹中心局部偏移(如教堂含背面钟塔), maxDh}
function placeAt(x,z,ry,w,d,o={}){
for(let t=0;t<8;t++){
const px=x+(t?wr(-2.5,2.5):0), pz=z+(t?wr(-2.5,2.5):0);
const ox=o.ox||0, oz=o.oz||0;
const rxx=px+ox*Math.cos(ry)+oz*Math.sin(ry), rzz=pz-ox*Math.sin(ry)+oz*Math.cos(ry);
if(terrainDelta(px,pz,ry,w,d)>(o.maxDh!==undefined?o.maxDh:1.4)) continue;
const rect=footRect(rxx,rzz,ry,w,d,1.0);
if(!propFreeRect(rect)) continue; // 同 placeBuild: 手摆建筑也让开道具
if(B_FOOT.some(f=>rectsOverlap(rect,f))) continue;
B_FOOT.push(rect); return {x:px,z:pz,ry};
}
const rect=footRect(x,z,ry,w,d,1.0); B_FOOT.push(rect); return {x,z,ry};
}
// 瞭望塔选址(足迹=塔身+局部+z 向外伸的楼梯)
function placeTower(x,z){
for(let t=0;t<8;t++){
const px=x+(t?wr(-3,3):0), pz=z+(t?wr(-3,3):0);
const ry=wr(0,TAU);
if(spotBlockedBuild(px,pz,ry,4,8)) continue;
if(terrainDelta(px,pz,ry,4,7.5)>0.9) continue;
const rect=footRect(px+2.8*Math.sin(ry),pz+2.8*Math.cos(ry),ry,4.2,9.6,0.8);
if(!propFreeRect(rect)) continue; // 同 placeBuild
if(B_FOOT.some(f=>rectsOverlap(rect,f))) continue;
B_FOOT.push(rect);
watchtower(px,pz,ry);
return true;
}
const ry=wr(0,TAU);
watchtower(x,z,ry);
B_FOOT.push(footRect(x+2.8*Math.sin(ry),z+2.8*Math.cos(ry),ry,4.2,9.6,0.8));
return false;
}
// 道具落点检查: 避开建筑足迹
function freeSpot(x,z,r){ return !B_FOOT.some(f=>x>f.x0-r&&x<f.x1+r&&z>f.z0-r&&z<f.z1+r); }
// 建筑足迹矩形 vs 已放置道具: 任一道具圆与矩形(含道具半径外扩)相交 → 拒绝
// (粗粒距 check 覆盖不到旋转矩形的最远角, 石墙段/弹坑会漏进房内)
function propFreeRect(rect){
return !PROPS.some(p=>p.x>rect.x0-p.r&&p.x<rect.x1+p.r&&p.z>rect.z0-p.r&&p.z<rect.z1+p.r);
}
// ===== 道具/植被占位互斥: 放置前查重并登记, 消灭树木/箱子/沙袋/弹坑等互相重合 =====
const PROPS=[];
function propFree(x,z,r){
for(const p of PROPS){ if(Math.hypot(x-p.x,z-p.z)<r+p.r) return false; }
return true;
}
// 返回登记条目 (医疗箱耗尽归还占位 = PROPS.splice), 后续放置不再叠压
function propTake(x,z,r){ const e={x,z,r}; PROPS.push(e); return e; }
// 落点被占时贴边外推找净位 (8 个方向小步+大步), 仍无净位返回 null → 放弃放置而非穿模
function propPushOut(x,z,r){
if(propFree(x,z,r)) return [x,z];
for(const [ox,oz] of [[1,0],[-1,0],[0,1],[0,-1],[1.3,0.9],[-1.3,0.9],[0.9,-1.3],[-0.9,-1.3],[2.2,1.4],[-2.2,1.4],[1.4,-2.2],[-1.4,-2.2]]){
if(propFree(x+ox,z+oz,r)) return [x+ox,z+oz];
}
return null;
}
