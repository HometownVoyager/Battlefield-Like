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
// procgen 图: 00c-procgen 置 PG_WR_SEED=种子 ⇒ 布局级确定性复现 (同种子同图, 设计定稿 §2.1)
const WORLD_SEED=(()=>{ try{ const m=location.search.match(/(?:\?|&)seed=(\d+)/); return m?((parseInt(m[1])||1)>>>0):0; }catch(e){ return 0; } })();
let _wstate=WORLD_SEED||(typeof PG_WR_SEED!=='undefined'?PG_WR_SEED:0);
function wRand(){ _wstate=(_wstate+0x6D2B79F5)|0; let t=Math.imul(_wstate^(_wstate>>>15),1|_wstate); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }
const wr=(a,b)=>(WORLD_SEED||(typeof PG_WR_SEED!=='undefined'&&PG_WR_SEED))?a+wRand()*(b-a):rand(a,b);
const wri=(a,b)=>Math.floor(wr(a,b+1));
// ===== 建筑框架: 几何缓存 (同尺寸盒子复用几何体, 削减上千重复 BoxGeometry) =====
const _geoCache=new Map();
function boxGeo(w,h,d){
const k=w.toFixed(2)+'x'+h.toFixed(2)+'x'+d.toFixed(2);
let g=_geoCache.get(k);
if(!g){ g=new THREE.BoxGeometry(w,h,d); _geoCache.set(k,g); }
return g;
}
function mesh(geo,mat,x,y,z,ry=0,cast=false,recv=true){
const m=new THREE.Mesh(uvGeo(geo,mat),mat);
m.position.set(x,y,z); m.rotation.y=ry;
m.castShadow=cast; m.receiveShadow=recv;
world.add(m); return m;
}
// ===== 贴图密度归一 (2026-09-20c, 修用户实机二报"窗户下面的部分和总体材质总是不同") =====
// BoxGeometry 六面 UV 恒为 0..1 "铺满整面" ⇒ 贴图密度随构件尺寸漂移: 同一面砖墙里 3.8m 整段墙板的砖≈0.31m,
// 1.4m 窗台段(窗下那截)的砖只有 0.11m, 0.9m 墙垛细到 0.07m —— 视觉上"窗下和墙不是一种材料"。
// 归一口径: 面 UV 跨度 = 该面的世界尺寸 / mat.uvRef (米/张贴图, 见 00-config.UV_DENSITY) ⇒ 密度与尺寸/朝向无关。
// 面序与面内轴 (THREE.BoxGeometry 固定): px,nx=(d,h) py,ny=(w,d) pz,nz=(w,h); 每面 4 顶点 UV 0..1。
// 只对登记了 uvRef 的材质生效; 几何体按 (尺寸, S) 克隆缓存 (boxGeo 的几何是跨材质共享的, 不能就地改)。
function scaleBoxUV(g,w,h,d,S){
const uv=g.attributes&&g.attributes.uv, a=uv&&uv.array;
if(!a) return g;
const E=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];
for(let f=0;f<6;f++){
const su=E[f][0]/S, sv=E[f][1]/S;
for(let k=0;k<4;k++){ const i=f*8+k*2; a[i]*=su; a[i+1]*=sv; }
}
uv.needsUpdate=true;
return g;
}
const _uvCache=new Map();
function uvGeo(geo,mat){
const S=mat&&mat.uvRef, p=geo&&geo.parameters;
if(!S||!p) return geo;
if(geo.type==='BoxGeometry'&&p.width!==undefined&&p.height!==undefined&&p.depth!==undefined){
const key=p.width.toFixed(2)+'x'+p.height.toFixed(2)+'x'+p.depth.toFixed(2)+'@'+S;
const hit=_uvCache.get(key); if(hit) return hit;
const g=geo.clone?geo.clone():null;
if(!g||!g.attributes||!g.attributes.uv){ _uvCache.set(key,geo); return geo; }
scaleBoxUV(g,p.width,p.height,p.depth,S);
_uvCache.set(key,g);
return g;
}
// 圆柱/圆锥 (2026-09-28 D3): 旧口径只认 BoxGeometry ⇒ 侧面/端盖 UV 恒 0..1, 贴图随构件尺寸自由拉伸
// (淞沪丝厂 14m 砖烟囱 = 竖向 14m/贴 的巨砖、谷仓草垛 同病 —— 与同材质盒件读作两种材料)。
// 归一口径与盒一致: 侧面 u 按**展开弧长** (thetaLength×rMax/S), v 按**表面斜长** (sqrt(h²+(rT-rB)²)/S,
// 圆柱退化为 h/S); 端盖以 (0.5,0.5) 为心按**直径** (2r/S) 缩放。盖/侧按 groups 分类
// (three 固定: 侧面=0 / 顶盖=1 / 底盖=2; heightSegments=1 时侧面顶点也在 ±h/2 平面上, 按 y 分类会全误判)。
// 只对登记 uvRef 的材质生效 (树干 bark 等未登记件不受影响); 几何按 (参数, S) 克隆缓存, 不就地改共享几何。
if((geo.type==='CylinderGeometry'||geo.type==='ConeGeometry')&&p.height!==undefined){
const rT=(p.radiusTop!==undefined)?p.radiusTop:(p.radius||0);
const rB=(p.radiusBottom!==undefined)?p.radiusBottom:(p.radius||0);
const h=p.height;
const theta=(p.thetaLength!==undefined)?p.thetaLength:Math.PI*2;
// ★ 2026-11-01 修: 缓存键必须含**全部形状参数** —— 旧键只含 r/h/θ, 同尺寸不同 radialSegments/
//   heightSegments/openEnded/thetaStart 的两根圆柱会共享同一克隆 (第二根被第一根的几何顶替 =
//   分段数/开口/起始角全错)。Box 键无此病 (w/h/d 即全部参数)。
const key=geo.type+':'+rT.toFixed(3)+'/'+rB.toFixed(3)+'x'+h.toFixed(2)+'t'+theta.toFixed(3)
+'s'+(p.radialSegments!==undefined?p.radialSegments:32)+'h'+(p.heightSegments!==undefined?p.heightSegments:1)
+'o'+(p.openEnded?1:0)+'a'+((p.thetaStart||0).toFixed(3))+'@'+S;
const hit=_uvCache.get(key); if(hit) return hit;
const g=geo.clone?geo.clone():null;
// ★ 失败路径必须回**原几何**: 桩/无 position 属性的克隆直接返回 geo —— 旧写法把"缺 position 的盒形克隆"
//   缓存并顶替原几何, 沙箱桩的 Cylinder clone (Geo 桩) 会把 type 翻成 BoxGeometry (探针非盒判据静默清空)。
if(!g||!g.attributes||!g.attributes.uv||!g.attributes.position){ return geo; }
const uv=g.attributes.uv, pos=g.attributes.position;
const rMax=Math.max(rT,rB);
const su=(theta*rMax)/S, sv=Math.sqrt(h*h+(rT-rB)*(rT-rB))/S;
const cls=new Uint8Array(pos.count);   // 0=侧面 1=顶盖 2=底盖
if(g.groups&&g.groups.length){ for(const gr of g.groups){ const mi=gr.materialIndex||0; for(let i=gr.start;i<gr.start+gr.count;i++){ const vi=g.index?g.index.getX(i):i; if(vi<cls.length) cls[vi]=mi===1?1:mi===2?2:0; } } }
else{ for(let i=0;i<pos.count;i++){ const py=pos.getY(i); cls[i]=(rT>1e-6&&py>h/2-1e-4)?1:(rB>1e-6&&py<-h/2+1e-4)?2:0; } }
for(let i=0;i<pos.count;i++){
if(cls[i]===0){ uv.setXY(i,uv.getX(i)*su,uv.getY(i)*sv); }
else{
const k=2*(cls[i]===1?rT:rB)/S;
uv.setXY(i,(uv.getX(i)-0.5)*k+0.5,(uv.getY(i)-0.5)*k+0.5);
}
}
uv.needsUpdate=true;
_uvCache.set(key,g);
return g;
}
return geo;
}
// ══════════════════════════════════════════════════════════════════════════════
// 深度分层管线 (2026-09-27 重写; 原四档表 DEPTH_TIERS 保留为别名)
// ──────────────────────────────────────────────────────────────────────────────
// 症状 (用户实机): "两个面重合的时候图层会打架, 显示的材质一闪一闪的"。
// 机制 (数值, 与本库相机参数同源): near=0.08 / far=900 (02-scene:17, 深度跨度 1:11250) ⇒ 24bit 深度缓冲的
//   一格 (1 LSB) 的世界尺寸 ≈ z²/(near·2²⁴): 50m≈1.9mm / 100m≈7.5mm / 200m≈3.0cm / 300m≈6.7cm。
//   两块**共面**(或间距小于该距离上 1 LSB)的面在深度缓冲里是同一个读数 ⇒ 谁赢只取决于**绘制顺序**;
//   而 three 的不透明件排序第一键是"到相机的距离"(每帧变) ⇒ 相机一动, 胜者翻转 = 材质闪。
//   实测规模 (dev/_zfight-fullscan, 修前): 全 11 图共 8000+ 对, 最重的莫斯科 2236 对 / 柏林 1661 对 ——
//   世界构建器普遍存在"两块盒面位相同一平面"的建模交叠, 靠逐处改几何永远追不上。
// 本文件是三条机制的唯一源:
//   ① 分层阶梯 SURF_LANES: 有明确叠放语义的**覆盖层**各占一格, 用 polygonOffset.units 表达
//      (units = 深度 LSB 数, 是与距离/倾角无关的**恒定**深度余量; factor 另行补偿斜视面的深度斜率);
//   ② 构建期共面冲突消解 resolveCoplanarConflicts(): 扫出"两面重合 / 薄埋"的**件对**, 按视觉权重贪心着色,
//      给落败件加一档"**向屏内**"偏移 (+2 LSB/档, ≤6 档)。同一对件的胜负就此被写死在构建期,
//      与相机位置无关 ⇒ 用户看到的不再是闪烁, 而是"始终由同一件压在上面"(稳定的那一件)。
//   ③ renderOrder 同表下发 (surfaceLane): 半透明覆盖层之间"谁后画"也走同一张表
//      (不写深度的层之间 polygonOffset 分不出先后, 只能靠排序)。
// 为什么偏移量取 4 的倍数 (而不是旧表的 1): 两个独立三角化的面即使几何共面, 固定点深度插值的建立与取整
//   也会差 1~2 LSB (噪声地板) —— 旧表的 -1/-2/-3 恰好等于 1 个 LSB 一档, 正落在这条地板上, 故实机仍闪。
//   新表最小档 4 LSB = 噪声地板的 2~4 倍。上限纪律: 拉近量必须小于该覆盖层下方结构的**真实厚度**在该距离
//   上的 LSB (桥面盒厚 0.32m 在 200m 处 = 10.6 LSB > 4) ⇒ 覆盖层不会穿过它所在的那块结构。
// 分档 (单源: **全库 polygonOffset 数字只写在这一张表里**; 使用点一律 surfaceLane/depthVariant/depthOffset):
//   base        0/0   —— 结构本体 (桥面盒/楼板/墙体/地面/桥台). 参考面: 不加偏移。
//   pavement   -1/-4  —— 铺装层/贴片压在结构盒顶面上 (桥面板条/木板铺装/桥缘镶边), 几何上只高 0~7cm。
//   decal      -1/-6  —— 地面贴花 (弹坑焦土/血渍): 图贴在地形面上, 几何抬高 0.02~0.05m。
//                        单列一档的理由: 地形网格局部起伏 ±2cm, 贴花与地形面在 100m 外只差 1~3 LSB ⇒
//                        旧版完全没登记的贴花是"远景一闪一闪"的主要来源之一。
//   patchWater -2/-8  —— 贴地水面/冰面 (河道条带/支流/鱼塘藕塘/海面/结冰河面): 必须稳定盖住水下地形与桥墩,
//                        但不该盖住岸上地形 (那由几何保证: 水面被 clamp 在 bank-0.08 以下)。
//   surf       -3/-12 —— 碎浪泡沫带: 压在 patchWater 之上再让一档 (泡沫必须稳定盖住水面与湿沙交界)。
// 与几何埋入的分工 (务必分清, 两者不互相替代):
//   · 大面积**半透明**贴片 (海面 `SEA.level-0.03` + depthWrite:false) 靠"退出深度竞争"解决 —— 它本就不写
//     深度, 3cm 几何埋入只负责让水线不在陆地上"切一刀"; 本表只帮它赢下与不透明几何的**深度测试**;
//   · **同一层**透明件之间不要用本 helper 排序 —— 都不写深度, 偏移分不出先后, 那要靠 renderOrder (见 surfaceLane);
//   · 偏移量上限纪律: 负偏移把该面**朝相机方向**推; 若它有一段本意要埋在别的不透明件之下 (如碎波带埋进
//     沙滩 5.4cm), 偏移量必须显著小于埋深, 否则远端会把埋入段"顶出地面"。
// 退路: URL 带 ?nosurf=1 时关闭共面消解 (②), 用于实机 A/B 对照与异常排查; ①③ 是常量表, 不受开关影响。
const SURF_LANES={
base:{factor:0,units:0,order:0},
pavement:{factor:-1,units:-4,order:1},
decal:{factor:-1,units:-6,order:2},
patchWater:{factor:-2,units:-8,order:3},
surf:{factor:-3,units:-12,order:4},
};
const DEPTH_TIERS=SURF_LANES;   // 兼容别名 (03-terrain / 05c 注释与 dev/verify-zfight 断言按此名读取)
// 共面冲突消解参数 (见 resolveCoplanarConflicts): 档距/档数上限/共面容差/面内交叠下限
// minArea: 面内交叠下限. 2026-09-27K 由 0.04 收到 0.015 —— 独立三角形扫描 (dev/_zfight-tri) 实测
//   世界层剩下的"同档共面"绝大多数是 0.012~0.04m² 的**细缝** (两块砖的侧面在同平面、两块沙袋并排),
//   0.04 的门槛把它们整类漏掉 (柏林 422 对/莫斯科同量级). 细缝在近处就是几像素~几十像素的闪线.
// maxLevel: 2026-09-27L 由 6 提到 8 —— 收进斜置件后约束图变密, hukawng 一堵墙的接头处有 7 个互斥邻居,
//   6 档不够 ⇒ 贪心着色的上限截断把**两个相邻件一起压到顶档** (同档 = 无胜负, dev/verify-surf 抓到 1 对).
//   档距 2 单位 × 8 档 = 单件最大向屏内 16 单位, 与覆盖层阶梯 (全负 = 向相机拉) 仍正交, 不会越过任何覆盖层.
// tolEps: tol 上的松弛. 平面坐标由消解器与验证器**两条独立实现**各算一遍, 恰好落在 tol 上的设计间隙
//   (实测反坦克炮的驻锄↔弹药箱正好 2cm) 会因浮点末位差被判到两侧; 消解器取略宽的一侧 ⇒ 验证器认定的
//   "严格共面对"必定被消解 (dev/verify-surfmodel T3/T9 就是被这一对打挂的).
// step: 2026-09-27M 由 2 提到 **4**. 根因 (本轮用户第二次追报"仍大量存在"的量化落点): 档距就是"相邻两件
//   在深度缓冲里差几个 LSB". 而两块**独立三角化**的面即使数学上完全共面, 光栅化后的插值深度本身就带
//   1~2 LSB 的噪声 (dev/_zfight-tri 的实测口径) —— 档距 2 只比噪声大 0~1 LSB ⇒ 相邻档之间**仍在抢像素**,
//   表现为"消解器说已分开、实机还是闪". 4 LSB = 噪声上限的 2 倍, 是本库能给出的最小安全档距.
//   代价: 单件最大向屏内推 4×8=32 单位 (旧 16); 覆盖层阶梯全负、与之正交, 不会被越过.
const SURF_CONFLICT={step:4,maxLevel:8,tol:0.02,minArea:0.015,tolEps:1e-6,
flushTol:0.04};   // flushTol: 贴地判据容差 (m) —— 顶面与地形差 ≤ 该值即算"与地形共面", 见 resolveCoplanarConflicts ③
const SURF_OFF=(()=>{ try{ return /(?:\?|&)nosurf(=|&|$)/.test(location.search); }catch(e){ return false; } })();
const _depthMats=new Map();   // base材质 → tier → 克隆材质 (同一材质同一档全库只克隆一次)
// 档位解析: 具名档 (SURF_LANES) 或冲突档 'c<k>' (k 带符号: 正 = 向屏内推 4k 单位; 负 = 向相机拉, 只给
// **贴地件**用 —— 它压在**地形面**上, 与覆盖层阶梯同向, 见 ③ 贴地件处置).
function surfLaneOf(tier){
if(SURF_LANES[tier]) return SURF_LANES[tier];
const m=/^c(-?[0-9]+)$/.exec(tier||'');
if(!m) return null;
const k=+m[1];
if(!k) return null;
const kk=k>0?Math.min(k,SURF_CONFLICT.maxLevel):Math.max(k,-SURF_CONFLICT.flushMax);
return {factor:0,units:kk*SURF_CONFLICT.step,order:0};
}
// 取"某档的材质变体": base 档直接返回原材质 (不克隆); 其余档克隆一次并缓存。
// ★ 绝不就地改共享材质: MAT.wood/woodDark 等是全库共用的, 就地改 polygonOffset 会把整个世界的木头/水都推偏。
function depthVariant(mat,tier){
const T=surfLaneOf(tier);
if(!T||!mat) return mat;
if(T.factor===0&&T.units===0) return mat;
let byTier=_depthMats.get(mat);
if(!byTier){ byTier=new Map(); _depthMats.set(mat,byTier); }
const hit=byTier.get(tier);
if(hit) return hit;
// dev 沙箱的材质桩没有 clone(): 原型浅拷贝兜底, 让沙箱也能验到"档位真的落到了 mesh 材质上"
const m=(typeof mat.clone==='function')?mat.clone():Object.assign(Object.create(Object.getPrototypeOf(mat)),mat);
if(!m) return mat;
m.polygonOffset=true; m.polygonOffsetFactor=T.factor; m.polygonOffsetUnits=T.units;
if(mat.uvRef!==undefined) m.uvRef=mat.uvRef;   // clone() 不复制自定义字段: 贴图密度登记 (00-config.UV_DENSITY) 必须随克隆带走
byTier.set(tier,m);
return m;
}
// 给**已建好的件**补偏移。mesh → 换用该档的材质变体 (不动原材质); 材质 → 就地写字段 (仅限本函数内局部 new 出来的材质)。
function depthOffset(target,tier){
if(!target) return target;
const T=surfLaneOf(tier);
if(!T) return target;
if(target.geometry||target.isMesh){ if(target.material) target.material=depthVariant(target.material,tier); return target; }
if(T.factor===0&&T.units===0) return target;
target.polygonOffset=true; target.polygonOffsetFactor=T.factor; target.polygonOffsetUnits=T.units;
return target;
}
// 覆盖层登记单源: 一次同时落定 ①深度偏移 (材质变体) ②绘制序 (renderOrder)。
// 所有"压在别的面上"的件 (铺装/贴花/水面/泡沫) 都走这一行 —— 两件事分头写就是日后错位的根。
function surfaceLane(target,lane){
const L=surfLaneOf(lane);
if(!L||!target) return target;
depthOffset(target,lane);
if(target.geometry||target.isMesh){ if(L.order) target.renderOrder=L.order; }
return target;
}
// ── ② 构建期共面冲突消解 ─────────────────────────────────────────────────────────
// 判据 (与 dev/verify-surf 的独立扫描同源, 只是这里处理的是**全库**而不限贴片):
//   候选 = world 子树里**任意朝向**且**写深度**的盒/柱, 外包 0.15~200m;
//   两面共面 (|Δ平面| < tol) 且面内交叠 ≥ minArea 时:  同向面 (顶↔顶/底↔底/侧↔侧) = 直接竞争;
//   反向面只有"薄埋" (沿法线的区间交叠量 ∈ (0, tol)) 才争 —— 厚埋稳定, 贴面 (交叠≤0, 单面材质) 背面剔除天然不争。
//   (★2026-09-27L: 判据由"件的世界 AABB 六个轴对齐面"改成"件的**六个真实面**", 且不再排除斜置件 ——
//    旧口径漏掉整类"斜置件真面重合", 是用户实机追报"图层贴图打架仍大量存在"的主因, 归因见 dev/_zfight-why。)
// 分配: 按投影面积降序贪心着色 (大面先拿低档 = 大面优先胜出), 落败件写 'c<k>' 档 (units=+2k, 向屏内推)。
// 为什么是"向屏内推"而不是"向相机拉": 覆盖层阶梯的 units 全是负数 (向相机拉), 若消解器也往负方向走,
//   一档冲突就可能把某件推过铺装/水面档 ⇒ 覆盖关系被消解器改写。只加正偏移 ⇒ 与阶梯**正交**, 互不干扰。
// 成本: 全库一次 (全部构建者跑完之后, 见 24-main), 最重的柏林 7966 件 / 47796 面 / 5551 约束对 ⇒ 见 SURF_STATS。
// ★ 可重复调用 (幂等): 第二次调用时把"已落档件"作为**预着色节点**重新读入 (units>0 且 factor=0 ⇒ 档号 = units/step),
//   只给新出现的未落档件分配档位 —— 因为已落档件仍参与配对与着色约束, 新件绝不会拿到与邻居相同的档。
//   (为什么不能简单"跳过已落档件": 那样新件看不见它们 ⇒ 会分到同档 ⇒ 又变成一对无胜负的共面件。
//    实测 island 反舰炮台: 一版把胸墙 3 段拆在两次调用里, 第三段就落在与第二段同档 —— dev/verify-surf 抓到。)
//   代价: 第二次调用要重扫已落档件 (莫斯科 +2822 件), 故**正常路径只调一次** (24-main 末尾)。
const SURF_STATS={off:SURF_OFF,cand:0,faces:0,pairs:0,linked:0,malformed:0,pre:0,newly:0,byLevel:null,maxLevel:0,clones:0,ms:0,
flush:0,flushMax:0,minLevel:0,calls:0,tCand:0,tLinked:0,tLeveled:0,tMs:0};
function resolveCoplanarConflicts(){
const t0=(typeof performance!=='undefined'&&performance.now)?performance.now():Date.now();
SURF_STATS.cand=0; SURF_STATS.faces=0; SURF_STATS.pairs=0; SURF_STATS.linked=0;
SURF_STATS.malformed=0; SURF_STATS.pre=0; SURF_STATS.newly=0; SURF_STATS.byLevel={}; SURF_STATS.maxLevel=0;
SURF_STATS.flush=0; SURF_STATS.flushMax=0; SURF_STATS.minLevel=0;
if(SURF_OFF){ SURF_STATS.ms=0; return SURF_STATS; }
const cfg=SURF_CONFLICT;
// ── 候选收集 (盒/柱, 写深度, 未登记覆盖层档; 已落消解档的件以预着色身份入表) ──
// ★ 2026-09-27L: 口径由"轴对齐件 + 件的世界 AABB 六个轴对齐面"改成"**任意朝向件的六个真实面**"。
//   归因 (dev/_zfight-why, 逐对问"现版为什么没看见"): 旧口径把 rotation.x/z≠0 的件整类排除 (并沿子树
//   传染), 又用 AABB 面顶替真实面 —— 于是"斜置屋顶板/瓦砾堆/斜墙真面重合"这一大类压根不是候选。
//   实测残留会闪对里柏林 160/166、诺曼底 75/132 对全出自这两条 (最大一对着重 1.39m²: 两块贴图屋顶板)。
//   真实面模型: 三根世界轴 (含俯仰/侧倾/缩放) × 局部半尺寸 ⇒ 6 个面 (面心 + 单位法线 + 面内矩形),
//   与朝向无关地正确; 轴对齐件退化成旧模型 (逐面等价, 见 dev/verify-surf 的同单位残留断言)。
// ★ 世界变换**自己累乘**, 不读 o.matrixWorld: ① 建图期矩阵还没被渲染器更新过 (identity), ② 沙箱的 three 桩
//   没有 matrixWorld (全库 dev 工具都在手工累乘, 保持同一条路径 ⇒ 沙箱读数与实机同源)。
// 累乘量取 B = R_parent·S_parent (行主序 3×3, 含缩放) + 原点 P: 局部轴 j 的世界向量 = B·(R_local 列 j)·s_local[j],
//   与 three 的 matrixWorld 一致 (无剪切时逐值相同); 欧拉序按 three 的 rotation.order。
// ★ 欧拉序必须**读 o.rotation.order**, 不能只按默认 'XYZ' 算: 实测 island 5383 件盒里 2669 件是 'YXZ'
//   (炮塔/斜置件), 按 XYZ 算出来的面平面整体偏 (dev/_xfcheck: 位置最大偏 2.1m / 基最大差 0.016) ⇒
//   消解器"看不见"真实共面 —— 三角形级扫描说共面 0.17m², 消解器却说没有, 就是这么来的。
const _rot3=(r)=>{
const a=Math.cos(r.x||0), b=Math.sin(r.x||0), c=Math.cos(r.y||0), d=Math.sin(r.y||0), e=Math.cos(r.z||0), f=Math.sin(r.z||0);
const ord=r.order||'XYZ';
if(ord==='XYZ') return [[c*e, -c*f, d],[a*f+b*e*d, a*e-b*f*d, -b*c],[b*f-a*e*d, b*e+a*f*d, a*c]];
const X=[[1,0,0],[0,a,-b],[0,b,a]], Y=[[c,0,d],[0,1,0],[-d,0,c]], Z=[[e,-f,0],[f,e,0],[0,0,1]];
const g=k=>k==='X'?X:(k==='Y'?Y:Z);
const o1=g(ord[0]), o2=g(ord[1]), o3=g(ord[2]);
const mul=(P,Q)=>{ const M=[[0,0,0],[0,0,0],[0,0,0]];
for(let i=0;i<3;i++)for(let j=0;j<3;j++) M[i][j]=P[i][0]*Q[0][j]+P[i][1]*Q[1][j]+P[i][2]*Q[2][j];
return M; };
return mul(mul(o1,o2),o3);
};
const _I3=[[1,0,0],[0,1,0],[0,0,1]];
const C=[]; const seen=new Set();
// ── 单位子树 (反坦克炮/高炮/机枪座/迫击炮/岸炮/舰艇/载具/飞机/士兵) **也在本消解器辖区内**: 它们同样在
//   world 下, 同样会与世界件共面 (炮座压沙袋/车轮压路面). 与运行期模型消解器的分工靠**预着色纪律**:
//   本消解器先分档, 模型消解器复跑时把 units>0 的件读回去当**预着色节点** (见 resolveModelSurfaces),
//   只给未落档件分配 —— 两套就不会各改一次同一件 (2026-09-27L: 曾用"世界级整棵跳过单位子树"来避让,
//   但那会丢掉"单位件 ↔ 世界件"这一类的消解, 改用纪律后两边都保住).
// ── ③ 贴地件判据: 件的**朝上面** (法线·Y ≥ 0.9) 上是否存在与 heightAt 之差 ≤ flushTol 的采样点 ──
// 为什么单列这一类: 地形是**一整张 680m 的网格** ⇒ 超 200m 上限, 从来不是候选件 ⇒ "件 ↔ 地形"这一大类
//   消解器结构性看不见 (件之间解得再好, 它照样与草地/沙面抢像素)。实机表现 (用户图一): 砖纹/石材从草地里
//   透出一条条, 顺着地形三角面的边成带状 —— 那是件顶面与地形面**楔形相交**、交线附近 |Δ|<1 LSB 的区段。
// 只认**朝上面**: 立在地面上的件 (箱/墙/沙袋) 是**底面**贴地 —— 底面朝下、背面剔除, 与地形没有颜色之争
//   (它的先后只影响阴影贴图里的接触阴影, 那是另一件事, 见 ⑤ 余项)。真会"从地里透出来"的是**顶面**贴地
//   的那一类: 埋到顶的地基裙墙/石墙段/铺装边 —— 顶面朝上、与地形面共面 ⇒ 两者抢同一片像素。
//   ★2026-09-27M 实测 (island): 若连底面贴地也算, 全图 1383 件入负档梯 (立在地面上的件全在内) ⇒
//     档梯被相邻件链式挤爆 (上限截断 323 件停在 −3) = 同档成对, 反而比不改更差。只认朝上面后是 100 件量级。
// 判据 = 面内 3×3 采样里 ≥2 点与地形同高 (|Δ| ≤ flushTol). 只要**蹭到**就算 —— 因为楔形相交时正是
//   那条交线在抢像素, 采样 3×3 是为了不漏掉只穿过面一角的交线 (斜置件/陡坡上的墙顶)。
// 处置 (见下 ③b): 该件在档梯上**从 1 档起步** —— 也就是"与地形共面时判地形赢". 这是本库既有的口径:
//   正档 = 向屏内推 = 让地形(背景)赢; 贴地件只要保证 ≥1 档, 那条交线带就稳定归地形, 不再两边翻。
//   (反方向"让件赢"试过一版: 贴地件全入负档梯 ⇒ 相邻件链式挤爆档梯上限, island 实测 553 件入档/
//    298 件停在 −3 = 同档成对, 比不改更差 —— 贴地件的**互相冲突**只有 8 档的正梯装得下.)
// 代价: 每件 ≤1 个朝上面 × 9 点 heightAt (HGRID 快路后每次几百 ns 量级), 实测见 SURF_STATS.ms。
function flushOf(c){
if(typeof heightAt!=='function') return false;
const TOL=cfg.flushTol;
for(let a=0;a<3;a++){
if(c.ax[a][1]<0.9) continue;                               // 只测朝上面 (底面贴地不算, 见上)
const o1=(a+1)%3, o2=(a+2)%3, h1=c.h[o1], h2=c.h[o2];
if(4*h1*h2<cfg.minArea) continue;                          // 面太小: 交叠面积进不了 minArea
const H=c.h[a];
const fx=c.ctr[0]+c.ax[a][0]*H, fy=c.ctr[1]+c.ax[a][1]*H, fz=c.ctr[2]+c.ax[a][2]*H;
let hit=0;
for(let iu=-1;iu<=1;iu++) for(let iv=-1;iv<=1;iv++){
const px=fx+c.ax[o1][0]*h1*iu+c.ax[o2][0]*h2*iv;
const pz=fz+c.ax[o1][2]*h1*iu+c.ax[o2][2]*h2*iv;
if(Math.abs(fy-heightAt(px,pz))<=TOL&&++hit>=2) return true;
}
}
return false;
}
(function walk(o,B,P){
if(!o||seen.has(o)) return; seen.add(o);
const t=o.position||{x:0,y:0,z:0}, sc=o.scale||{x:1,y:1,z:1}, rt=o.rotation||{x:0,y:0,z:0};
const wx=B[0][0]*t.x+B[0][1]*t.y+B[0][2]*t.z+P[0];
const wy=B[1][0]*t.x+B[1][1]*t.y+B[1][2]*t.z+P[1];
const wz=B[2][0]*t.x+B[2][1]*t.y+B[2][2]*t.z+P[2];
const g=o.geometry, mat=o.material;
// 具名覆盖层档 (pavement/decal/patchWater/surf: factor≠0) 是"压在结构上的贴面", 不参与结构件之间的着色
// (它的先后由阶梯决定); 消解档 (factor=0, units≠0) 是上一次调用的结果 ⇒ 读回来当预着色节点 (见头注释)。
// ★2026-09-27M: units<0 的档也是消解档 —— 那是**贴地件** (c-1/c-2…, 见 ③), 必须同样读回来当预着色节点,
//   否则第二次调用 (05c 的世界级构建者补跑) 会把它当未落档件重排, 负档被覆盖成正档 ⇒ 贴地件又钻回地里。
const po=(mat&&mat.polygonOffset===true);
const preLvl=(po&&mat.polygonOffsetFactor===0&&mat.polygonOffsetUnits)?Math.round(mat.polygonOffsetUnits/cfg.step):0;
// 本节点的世界轴 (列 j = 局部 j 轴的世界向量, 长度已含缩放): 无旋转无缩放时就是父基 B 本身 (不复制)
const noR=(!rt.x&&!rt.y&&!rt.z), noS=(sc.x===1&&sc.y===1&&sc.z===1);
let B2=B;
if(!noR||!noS){
const Rl=noR?_I3:_rot3(rt);
const M=[[0,0,0],[0,0,0],[0,0,0]];
for(let i=0;i<3;i++)for(let j=0;j<3;j++) M[i][j]=(B[i][0]*Rl[0][j]+B[i][1]*Rl[1][j]+B[i][2]*Rl[2][j])*(j===0?sc.x:(j===1?sc.y:sc.z));
B2=M;
}
if(g&&mat&&o.visible!==false&&o.count===undefined&&(!po||preLvl!==0)){
const pr=g.parameters||{};
let dims=null;
if(pr.width!==undefined&&pr.height!==undefined&&pr.depth!==undefined) dims=[pr.width,pr.height,pr.depth];
else if(pr.radiusTop!==undefined&&pr.height!==undefined) dims=[Math.max(pr.radiusTop,pr.radiusBottom)*2,pr.height,Math.max(pr.radiusTop,pr.radiusBottom)*2];
if(dims){
const ext=Math.max(dims[0],dims[2]);
// 超大件 (地面/海面网格) 是"接收面"不是"竞争件"; 过小件 (装饰钉) 交叠面积进不了 minArea
if(ext<=200&&ext>=0.15){
if(!isFinite(wx)||!isFinite(wy)||!isFinite(wz)){ SURF_STATS.malformed++; }
else{
	SURF_STATS.cand++;
	if(preLvl) SURF_STATS.pre++;
	const ax=[[B2[0][0],B2[1][0],B2[2][0]],[B2[0][1],B2[1][1],B2[2][1]],[B2[0][2],B2[1][2],B2[2][2]]];
	const h=[0,0,0];
	for(let i=0;i<3;i++){
	const L=Math.hypot(ax[i][0],ax[i][1],ax[i][2])||1;
	ax[i][0]/=L; ax[i][1]/=L; ax[i][2]/=L;
	h[i]=dims[i]/2*L;
	}
	const rec={o,mat,dims,ctr:[wx,wy,wz],ax,h,
	write:!(mat.transparent===true&&mat.depthWrite===false),
	dbl:mat.side===THREE.DoubleSide,
	pre:preLvl,
	area0:dims[0]*dims[2]};
	// ③ 贴地件检测 (只对未落档件做一次; 已落档件沿用旧档, 见头注释"可重复调用"): 件有近水平面压在**地形面**上
	if(!preLvl&&rec.write&&flushOf(rec)){ rec.flush=true; SURF_STATS.flush++; }
	C.push(rec);
}
}
}
}
for(const c of o.children||[]) walk(c,B2,[wx,wy,wz]);
})(world,_I3,[0,0,0]);
// ── 面桶: 每件 6 个**真实面** (局部轴 a × 方向 s) ⇒ 世界平面 (单位法线 n, 平面坐标 p) + 面内矩形 (u,v) ──
// 桶键 = (法线三轴量化 × 平面坐标量化) 的**整数**打包 —— 建场热路径, 最重的莫斯科 5 万个面, 字符串键会
//   白造十几万临时串 + 十几次 split。
// 法线量化 1/96 ≈ 0.6°: 共面的两个面法线常常只差 0.1°~1° (各段各自算 ry / 斜置件), 会落进**相邻**桶 ⇒
//   配对阶段必须常查 ±1 法线邻桶 (见下), 不能只查同桶。
// ★2026-09-27M QN 96 → 48 (法线桶宽 0.6° → 1.19°): 配对窗口是 dn≥0.99985 = 夹角 ≤1° —— 桶宽 0.6° 时
//   一个 1° 内的对子可以落在**相隔 2 个桶**里, 而配对阶段只查 ±1 法线邻桶 ⇒ 整类漏检. 实测 (dev/_zfight-why
//   全图): berlin 2 对 / normandy 3 对 / steppe 2 对 / moscow 1 对残留都带"桶距(法线)2 · 夹角 0.7°~0.98°"。
//   桶宽 ≥ 配对窗口 (1.19° > 1°) ⇒ 窗口内的对子必然落在 ±1 桶内, 邻桶搜索的充分性才有保证 (与 2026-09-27L
//   加邻桶搜索是同一条论证, 只是当时把桶宽定得比窗口还小).
//   代价: 法线桶少 8 倍 ⇒ 同桶件数变多, 但 q (平面 1cm 桶) 仍把不同面的件分开, 实测耗时见 SURF_STATS.ms。
const QN=48, QD=0.01, DQ0=100000, DSKIP=200000;
const keyOf=(ix,iy,iz,q)=>(((ix*200+iy)*200+iz)*DSKIP)+(q+DQ0);
// 平面基底: 由**规范化**法线 (主轴取正) 唯一确定 ⇒ 同向面与反向面共用同一 (u,v), 矩形才可比。
// (反向面若各按自己的法线取基, 两套基底差一个翻转, 矩形交叠判据就废了 —— 2026-09-27L 新增反向族时踩到)
function planeBasis(nx,ny,nz){
const an=Math.abs(nx), am=Math.abs(ny), ao=Math.abs(nz);
const k=(an>=am&&an>=ao)?0:(am>=ao?1:2);
if((k===0?nx:(k===1?ny:nz))<0){ nx=-nx; ny=-ny; nz=-nz; }
const ux2=Math.abs(nx)<0.9?1:0, uy2=Math.abs(nx)<0.9?0:1;
let vx=-nz*uy2, vy=nz*ux2, vz=nx*uy2-ny*ux2;
const vl=Math.hypot(vx,vy,vz)||1; vx/=vl; vy/=vl; vz/=vl;
return [[ny*vz-nz*vy, nz*vx-nx*vz, nx*vy-ny*vx],[vx,vy,vz]];
}
const buckets=new Map();
for(let ci=0;ci<C.length;ci++){
if(!C[ci].write) continue;               // 不写深度的件不参与竞争 (其深度测试由覆盖层档负责)
const c=C[ci];
for(let a=0;a<3;a++)for(const s of [-1,1]){
const N=c.ax[a], H=c.h[a];
const nx=N[0]*s, ny=N[1]*s, nz=N[2]*s;
const fx=c.ctr[0]+nx*H, fy=c.ctr[1]+ny*H, fz=c.ctr[2]+nz*H;   // 面心 = 中心 + 法线 × 半厚
const p=nx*fx+ny*fy+nz*fz;
const b=planeBasis(nx,ny,nz);
const o1=(a+1)%3, o2=(a+2)%3, e1=c.ax[o1], e2=c.ax[o2], h1=c.h[o1], h2=c.h[o2];
let u0=1e9,u1=-1e9,v0=1e9,v1=-1e9;
for(const su of [-1,1]) for(const sv of [-1,1]){
const px=fx+e1[0]*h1*su+e2[0]*h2*sv, py=fy+e1[1]*h1*su+e2[1]*h2*sv, pz=fz+e1[2]*h1*su+e2[2]*h2*sv;
const du=px*b[0][0]+py*b[0][1]+pz*b[0][2], dv=px*b[1][0]+py*b[1][1]+pz*b[1][2];
if(du<u0)u0=du; if(du>u1)u1=du; if(dv<v0)v0=dv; if(dv>v1)v1=dv;
}
const ix=Math.round(nx*QN), iy=Math.round(ny*QN), iz=Math.round(nz*QN);
const q=Math.round(p/QD);
const key=keyOf(ix,iy,iz,q);
let bk=buckets.get(key);
if(!bk){
// 反向族只从"主轴朝正"的一侧发起: 对跖桶的主轴方向必相反 ⇒ 每对反向面只测一次
const an=Math.abs(nx), am=Math.abs(ny), ao=Math.abs(nz);
const kd=(an>=am&&an>=ao)?0:(am>=ao?1:2);
const dv=kd===0?nx:(kd===1?ny:nz);
bk={ix,iy,iz,q,n:[nx,ny,nz],init:dv>0,arr:[]};
buckets.set(key,bk);
}
bk.arr.push([ci,u0,u1,v0,v1,s,a,p,nx,ny,nz]);
SURF_STATS.faces++;
}
}
// ── 配对 (同向族 + 反向族) ──
// 同向面 (顶↔顶/底↔底/侧↔侧): 法线同号 ⇒ 同桶族, 平面坐标差 ≤2 个 1cm 桶 (d=0..3 覆盖 tol=0.02);
// 反向面 (一件的 +面 贴另一件的 -面): 对跖桶族 (法线取反 ⇒ 平面坐标也反号, 差用**和**), d=-q±3。
const adj=C.map(()=>null);
const linkedKeys=new Set();
// 单对判定: 共面 + 面内交叠 ≥ minArea + (同向面 或 反向薄埋) ⇒ 记一条约束边
const linkPair=(A,B)=>{
if(A[0]===B[0]) return;                                  // 同一件自身两个面不算竞争 (同网格同材质)
SURF_STATS.pairs++;
const dn=A[8]*B[8]+A[9]*B[9]+A[10]*B[10];
const opp=(dn<=-0.99985);
if(!opp&&dn<0.99985) return;                             // 既不平行也不同向 ⇒ 不共面
// ★ 反向面的平面坐标反号 ⇒ 几何重合判据是 |pA + pB|, 不是 |pA - pB| (2026-09-27L)
const dOff=opp?Math.abs(A[7]+B[7]):Math.abs(A[7]-B[7]);
if(dOff>cfg.tol+cfg.tolEps) return;
const u0=Math.max(A[1],B[1]), u1=Math.min(A[2],B[2]);
const v0=Math.max(A[3],B[3]), v1=Math.min(A[4],B[4]);
if(u1<=u0||v1<=v0) return;
if((u1-u0)*(v1-v0)<cfg.minArea) return;
if(opp){
// 反向面 (一类件的 +面 对另一类件的 -面): 只有**薄埋**会争 —— 判据看两件沿该面法线的**区间交叠量** ov:
//   ov ∈ (0, tol): 贴合处那条交线落在深度噪声带内, 交线两侧纹理轮流胜出 (实机=接缝处闪);
//   ov ≤ 0      : 贴面或留缝 —— 法线相反, 单面材质背面剔除, 天然不争;
//   ov ≥ tol    : 深埋 —— 两面以一定夹角交叉, 深度差沿交线快速拉开, 稳定。
// (★2026-09-27 修: 首版按"min(两件厚度) − 平面距"算嵌入深, 把"薄件插进厚板 1cm"这类最常见情形误判成
//  深埋而豁免 —— dev/verify-surf 的独立扫描抓出 6~10 对/图残留。区间交叠量与厚度无关, 才是对的量。
//  2026-09-27L: 区间改由**支撑函数**给出 (Σ|n·轴|·半尺寸), 轴对齐件上与原 AABB 区间逐值相同。)
const ca=C[A[0]], cb=C[B[0]], n=A;
const sup=c=>{ let s2=0; for(let i=0;i<3;i++){ const x=c.ax[i]; s2+=Math.abs(n[8]*x[0]+n[9]*x[1]+n[10]*x[2])*c.h[i]; } return s2; };
const mA=n[8]*ca.ctr[0]+n[9]*ca.ctr[1]+n[10]*ca.ctr[2];
const mB=n[8]*cb.ctr[0]+n[9]*cb.ctr[1]+n[10]*cb.ctr[2];
const ilo=Math.max(mA-sup(ca), mB-sup(cb)), ihi=Math.min(mA+sup(ca), mB+sup(cb));
const ov=ihi-ilo;
if(ov>=cfg.tol+cfg.tolEps) return;
if(ov<=1e-9&&!(ca.dbl||cb.dbl)) return;   // 贴面 + 单面材质 = 背面剔除, 天然不争
}
const i=A[0], j=B[0];
const lk=i<j?i+'_'+j:j+'_'+i;
if(linkedKeys.has(lk)) return; linkedKeys.add(lk);
SURF_STATS.linked++;
if(!adj[i]) adj[i]=[]; if(!adj[j]) adj[j]=[]; adj[i].push(j); adj[j].push(i);
};
const pairAll=(a1,a2)=>{ for(let ia=0;ia<a1.length;ia++){ const A=a1[ia]; for(let ib=0;ib<a2.length;ib++) linkPair(A,a2[ib]); } };
for(const [,bk] of buckets){
const {ix,iy,iz,q,init,arr}=bk;
// 同向族: 本桶内自配对 (ia<ib ⇒ 不自比) + 同法线桶的 q+1..q+3
for(let ia=0;ia<arr.length;ia++){ const A=arr[ia]; for(let ib=ia+1;ib<arr.length;ib++) linkPair(A,arr[ib]); }
for(let d=1;d<4;d++){ const bk2=buckets.get(keyOf(ix,iy,iz,q+d)); if(bk2) pairAll(arr,bk2.arr); }
// ★ 法线邻桶**必须常查** (2026-09-27L): 共面的两件法线往往不是**完全相同**, 而是差 0.1°~1°
//   (墙段逐段摆放/斜置件各自算出来的 ry 不同), 量化 1/96 后落进相邻桶 ⇒ 只查同桶就整类漏掉。
//   归因实测 (dev/_zfight-why 的"桶距"栏): 残留对全是"桶距(法线)1~2 · 夹角 0.08°~0.98°"。
//   去重: 法线桶不同时用 (Δ法线, Δ平面) 的**字典序**取一侧 (Δ≠0 时 Δ平面 双向查 ±3); 同桶时只往上查 d=1..3。
for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){
if(!dx&&!dy&&!dz) continue;
if(dx<0||(dx===0&&(dy<0||(dy===0&&dz<0)))) continue;      // 字典序负的一侧由对方发起
for(let d=-3;d<=3;d++){ const bk2=buckets.get(keyOf(ix+dx,iy+dy,iz+dz,q+d)); if(bk2) pairAll(arr,bk2.arr); }
}
if(!init) continue;
// 反向族 (对跖桶): 平面坐标反号 ⇒ 查 -q 附近 (±1 法线邻桶同前, 每对只从"主轴朝正"的一侧发起)
for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){
for(let dd=-3;dd<=3;dd++){ const bk2=buckets.get(keyOf(-ix+dx,-iy+dy,-iz+dz,-q+dd)); if(bk2) pairAll(arr,bk2.arr); }
}
}
// ── 贪心着色 (按投影面积降序: 大面拿低档; 已落档件保持原档不动) ──
// 预着色节点 (上一次调用落的档) 必须**先写进 lvl** 再着色, 否则新件看不见它们的档位 (头注释那条 island 反例)。
// ★2026-09-27M **贴地件从 1 档起步** (③b): 档梯仍是同一条正梯 (0,1,2…, 单位 = +4k, 向屏内推),
//   只有"起点"不同 —— 与地形共面的件**至少退一档**, 于是那条与地形的交线带稳定归地形 (背景赢),
//   不再两边翻. 贴地件的**互相冲突**照样由这条 8 档梯解决 (实测最深 3 档), 不会像负档梯那样被挤爆.
// ★贴地件必须**入表**哪怕它一个约束对都没有: 它的对手是地形 (非候选件), 本来就不在约束图里 ——
//   旧口径"只给有约束的件分档"会让孤立的贴地件停在 0 档 = 与地形同深 = 抢像素 (用户图一那条石带
//   正是孤立贴地件: 它与别的件不共面, 所以从来没人给它分过档)。
const order=[];
for(let i=0;i<C.length;i++) if((adj[i]&&adj[i].length)||C[i].flush) order.push(i);
order.sort((x,y)=>(C[y].area0-C[x].area0)||(x-y));
const lvl=new Array(C.length).fill(0);
for(let i=0;i<C.length;i++) if(C[i].pre) lvl[i]=C[i].pre;
let maxL=0,minL=0;
for(const i of order){
if(C[i].pre) continue;               // 预着色: 不重新分配
const used=new Set();
if(adj[i]) for(const j of adj[i]) used.add(lvl[j]);   // 孤立贴地件没有约束边 (adj[i] 为空)
let k=C[i].flush?1:0;                // ③b 贴地件从 1 档起 (0 档 = 与地形同深 = 抢像素)
while(used.has(k)) k++;
if(k>cfg.maxLevel) k=cfg.maxLevel;   // 理论上不会触发 (实测上限 5 档); 触发即"这一对没被分开", 记账供验证
lvl[i]=k; if(k>maxL) maxL=k; if(k<minL) minL=k;
}
// 预着色件的档位也算进"本次用到的档位范围" (复跑时的读数口径)
for(let i=0;i<C.length;i++){ if(C[i].pre>maxL) maxL=C[i].pre; if(C[i].pre<minL) minL=C[i].pre; }
// ── 落档: 只给 level≠0 的**新**件换材质变体 ──
const hist={}; let newly=0;
for(const i of order){
const k=lvl[i];
if(!k||C[i].pre) continue;
hist[k]=(hist[k]||0)+1; newly++;
C[i].o.material=depthVariant(C[i].o.material,'c'+k);
}
// 预着色件的历史档位也计入分布 (便于实机读数看出总量), 但**不计入 newly** —— 它们上一次已经落过档
for(let i=0;i<C.length;i++) if(C[i].pre) hist[C[i].pre]=(hist[C[i].pre]||0)+1;
SURF_STATS.newly=newly;
SURF_STATS.byLevel=hist; SURF_STATS.maxLevel=maxL; SURF_STATS.minLevel=minL; SURF_STATS.clones=_depthMats.size;
SURF_STATS.ms=Math.round(((typeof performance!=='undefined'&&performance.now)?performance.now():Date.now())-t0);
// 累计量 (本函数可被调用多次: 正常路径 1 次 @24-main; 复跑用于验证幂等)
SURF_STATS.calls++; SURF_STATS.tCand+=SURF_STATS.cand; SURF_STATS.tLinked+=SURF_STATS.linked;
SURF_STATS.tLeveled+=newly; SURF_STATS.tMs+=SURF_STATS.ms;
// 实机读数 (一次建场一~两行): 共面件数/约束对数/各档件数/耗时 —— 用户排障与回归对照都看这一行
if(typeof console!=='undefined'&&console.log) console.log('[深度分层] 共面消解: 候选 '+SURF_STATS.cand+' 件 · 面 '+SURF_STATS.faces
+' · 约束对 '+SURF_STATS.linked+' · 贴地 '+SURF_STATS.flush+' 件 · 本档 '+JSON.stringify(hist)+' · 累计落档 '+SURF_STATS.tLeveled+' 件 / 累计 '+SURF_STATS.tMs+'ms'
+' (档距 '+cfg.step+' 单位 × 上限 '+cfg.maxLevel+' 档; 贴地件从 1 档起) · 材质变体 '+SURF_STATS.clones);
return SURF_STATS;
}
// ──────────────────────────────────────────────────────────────────────────────
// 模型内共面消解 (2026-09-27K) —— 运行期新建模型的"生成即消解"
//
// 为什么必须另有一条 (用户实机 2026-09-27 追报"图层贴图打架仍大量存在"的根因):
//   世界级 resolveCoplanarConflicts 只在建图末对 `world` 跑一次, 而**载具/飞机/士兵/舰艇的模型是开局
//   或重生时才建出来的** (士兵/坦克/飞机/卡车/两栖车…每个单位一个 Group)。这些盒式模型里两个面板
//   正好同平面是常态 (实测: M4 谢尔曼"车体顶面 ↔ 侧凸顶面"重叠 3.9m²、P-47"机翼 ↔ 机身"0.72m²、
//   士兵身上若干) —— 两面共面 + 都写深度 ⇒ 整片 z-fighting ("图层贴图打架")。玩家盯着载具/人物看的
//   时间最长, 所以这类残留的**可见度远超**世界件那几百对细缝。
// 口径 (与 ② 同机制, 但判据换成真三角形 + 模型局部坐标):
//   · 取根下每个可见 mesh 的**真顶点** (与几何类型/朝向无关: box/cyl/plane/自定义几何都成立), 按支撑
//     平面分组成"面记录"; 平面距 < 2cm 且面内交叠 ≥ 1.2dm² 的两件 ⇒ 一对冲突 (同向才争; 反向只在
//     双面材质下争, 与 ② 同规);
//   · 只在**模型内部**配对 (跨模型的位置由运行期决定, 静态判据无意义) —— 用 root 的相对变换, 因此
//     结果与"单位此刻站在哪里/朝向如何"无关 ⇒ 同一型号每次实例化结果一致 (可直接沿用同一套材质变体);
//   · 着色: 按面记录面积降序贪心 (大面拿低档), 落败 mesh 换 'c<k>' 档材质变体 (units=+2k, 向屏内推);
//   · mesh 粒度: 偏移是**每材质**的 ⇒ 着色单元是 mesh 不是单个面 (与 ② 同). 同一 mesh 的六个面共用一个档.
// 调用: 24-main 每帧调 resolveRuntimeSurfaces() —— 只处理"没见过"的单位/新挂进 world·scene 的子树,
//   每帧最多 SURF_RT_BUDGET 个根; 已处理的根记进 WeakSet。世界还原后单位重建 ⇒ 新对象 ⇒ 自动重做.
// ★ 与世界级消解器的分工 (2026-09-27L): 单位子树**两边都在辖区内** (世界级管"单位件↔世界件", 本支管"模型内件对"),
//   靠**预着色纪律**避让 —— 本支把 units>0 的件读回当预着色节点, 只给未落档件分档 (见下方 preOf)。
//   一个根**只处理一次** (WeakSet 拦重复), 世界还原后单位重建 ⇒ 新对象 ⇒ 自动重做.
const SURF_RT_BUDGET=2;             // 每帧最多消解几个根 (把建场/重生的检测成本摊到多帧)
// 模型专用的面内交叠下限: 世界件是"远看的大面"(0.04m² 够用), 模型是**近看的小件** ——
//   0.014m² 的细缝在 3m 处也有几十像素 (实测士兵身上每具 2 对这样的小缝), 必须收
const SURF_RT_MINAREA=0.004;
// 视角武器专用下限: 枪/筒是**贴脸看**的 (20~50cm), 同一面积在屏幕上的占比是单位的 ~100 倍 ⇒
//   0.004m² 会把"木托↔机匣贴合面"(最大 33cm²) 整类放过, 而那正是玩家最容易注意到的残留.
const SURF_RT_VMMINAREA=0.0004;
const SURF_RT={roots:0,hits:0,meshes:0,pairs:0,leveled:0,ms:0,last:''};
const _rtKnown=new WeakSet();
let _rtVmGun=null;                  // 视角武器: 上一次消解过的 gunParts 身份 (换枪 ⇒ 重建 ⇒ 重做)
let _rtW=-1,_rtS=-1;                // world/scene 的"已处理边界" (两张表只增不减; -1 = 尚未取基线)
let _rtBase=false;                  // 基线只取一次: 建图期的件已由世界级消解器处理过, 不再重复
// 取根下所有可见 mesh 的"面记录" (平面分组 + 2D 三角形), 全部在 root 的局部坐标里
function _modelPlanes(root){
const inv=new THREE.Matrix4(), rel=new THREE.Matrix4();
root.updateMatrixWorld(true);
inv.copy(root.matrixWorld).invert();
const TOL=SURF_CONFLICT.tol;
const recs=[]; let mi=-1;
root.traverse(o=>{
if(o.visible===false||o.count!==undefined||!o.isMesh) return;
const g=o.geometry, mat=o.material;
if(!g||!mat||!g.attributes||!g.attributes.position) return;
if(mat.transparent===true&&mat.depthWrite===false) return;              // 不写深度 ⇒ 无深度之争
if(mat.polygonOffset===true&&mat.polygonOffsetUnits<0) return;          // 覆盖层档 (阶梯) 不参与
const pos=g.attributes.position, ix=g.index;
const nTri=Math.floor((ix?ix.count:pos.count)/3);
if(nTri<1||nTri>4000) return;
mi++;
rel.multiplyMatrices(inv,o.matrixWorld);
const e=rel.elements;
const V=new Float64Array(pos.count*3);
for(let i=0;i<pos.count;i++){
const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
V[i*3]=e[0]*x+e[4]*y+e[8]*z+e[12]; V[i*3+1]=e[1]*x+e[5]*y+e[9]*z+e[13]; V[i*3+2]=e[2]*x+e[6]*y+e[10]*z+e[14];
}
const groups=new Map();
for(let t=0;t<nTri;t++){
const a=(ix?ix.getX(t*3):t*3)*3, b=(ix?ix.getX(t*3+1):t*3+1)*3, c=(ix?ix.getX(t*3+2):t*3+2)*3;
const ax=V[a],ay=V[a+1],az=V[a+2], bx=V[b],by=V[b+1],bz=V[b+2], cx=V[c],cy=V[c+1],cz=V[c+2];
const ux=bx-ax,uy=by-ay,uz=bz-az, vx=cx-ax,vy=cy-ay,vz=cz-az;
let nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx;
const L=Math.hypot(nx,ny,nz); if(L<1e-9) continue;
nx/=L; ny/=L; nz/=L;
const d=nx*ax+ny*ay+nz*az;
// ★ 键里必须带 mesh 号: 否则两个 mesh 的"同一平面"会被并进同一条记录, 归属第一个 mesh ⇒ 那一对漏检
//   (实测: 士兵身上每具 2 对细缝就是这么漏的 —— 1cm 平面距落进同一个 1cm 桶)
const key=mi+'|'+Math.round(nx*256)+'|'+Math.round(ny*256)+'|'+Math.round(nz*256)+'|'+Math.round(d/0.01);
let gr=groups.get(key);
if(!gr){
const ux2=Math.abs(nx)<0.9?1:0, uy2=Math.abs(nx)<0.9?0:1;
let vx2=ny*0-nz*uy2, vy2=nz*ux2-nx*0, vz2=nx*uy2-ny*ux2;
const vl=Math.hypot(vx2,vy2,vz2)||1; vx2/=vl; vy2/=vl; vz2/=vl;
const wx2=ny*vz2-nz*vy2, wy2=nz*vx2-nx*vz2, wz2=nx*vy2-ny*vx2;
gr={n:[nx,ny,nz],d,tris:[],u:[wx2,wy2,wz2],v:[vx2,vy2,vz2],w:0,bb:[[1e9,-1e9],[1e9,-1e9],[1e9,-1e9]]};
groups.set(key,gr);
}
const p2=(px,py,pz)=>[px*gr.u[0]+py*gr.u[1]+pz*gr.u[2], px*gr.v[0]+py*gr.v[1]+pz*gr.v[2]];
let A=p2(ax,ay,az), B=p2(bx,by,bz), C=p2(cx,cy,cz);
if((B[0]-A[0])*(C[1]-A[1])-(B[1]-A[1])*(C[0]-A[0])<0){ const tm=B; B=C; C=tm; }
gr.tris.push([A,B,C]);
gr.w+=Math.abs((B[0]-A[0])*(C[1]-A[1])-(B[1]-A[1])*(C[0]-A[0]))/2;
for(const q of [[ax,ay,az],[bx,by,bz],[cx,cy,cz]]) for(let k=0;k<3;k++){ if(q[k]<gr.bb[k][0]) gr.bb[k][0]=q[k]; if(q[k]>gr.bb[k][1]) gr.bb[k][1]=q[k]; }
}
for(const [,gr] of groups) recs.push({mesh:o,mi,n:gr.n,d:gr.d,u:gr.u,tris:gr.tris,w:gr.w,bb:gr.bb,mat,ds:mat.side===2});
});
return {recs,meshes:mi+1};
}
// 2D 裁剪面积 (ta 被 tb 的三条边裁) —— 与 ② 同一支
function _clipArea2(ta,tb){
let poly=ta;
for(let e=0;e<3;e++){
const P=tb[e], Q=tb[(e+1)%3], ex=Q[0]-P[0], ey=Q[1]-P[1], out=[];
for(let i=0;i<poly.length;i++){
const A=poly[i], B=poly[(i+1)%poly.length];
const da=ex*(A[1]-P[1])-ey*(A[0]-P[0]), db=ex*(B[1]-P[1])-ey*(B[0]-P[0]);
if(da>=-1e-9) out.push(A);
if((da>1e-9&&db<-1e-9)||(da<-1e-9&&db>1e-9)){ const t=da/(da-db); out.push([A[0]+(B[0]-A[0])*t, A[1]+(B[1]-A[1])*t]); }
}
poly=out; if(poly.length<3) return 0;
}
let s2=0;
for(let i=1;i+1<poly.length;i++) s2+=Math.abs((poly[i][0]-poly[0][0])*(poly[i+1][1]-poly[0][1])-(poly[i+1][0]-poly[0][0])*(poly[i][1]-poly[0][1]));
return s2/2;
}
// 模型内共面消解 (返回 null = 无可解; 否则返回统计)
function resolveModelSurfaces(root,label,minArea){
if(!root) return null;                              // ★ 不按 root.visible 早退: 部署期/未激活的单位根常常是隐藏的,
//   而"隐藏"只是渲染态 —— 它的部件照样会在被显示的那一刻共面打架。逐 mesh 的可见性在 _modelPlanes 里判。
const t0=(typeof performance!=='undefined'&&performance.now)?performance.now():Date.now();
const {recs,meshes}=_modelPlanes(root);
if(meshes<2||!recs.length) return null;
const TOL=SURF_CONFLICT.tol, MINA=(minArea||SURF_RT_MINAREA);
// ── 配对 (网格内部件数少: 直接双循环 + 廉价预筛) ──
const P=recs.length;
const mAdj=new Map();               // mesh → Set(mesh)
let pairs=0,pairArea=0;
for(let i=0;i<P;i++){
const A=recs[i];
for(let j=i+1;j<P;j++){
const B=recs[j];
if(A.mesh===B.mesh) continue;                       // 同一 mesh 的面之间不争 (同一个偏移, 改了也没用)
const dn=A.n[0]*B.n[0]+A.n[1]*B.n[1]+A.n[2]*B.n[2];
if(dn>=0.99985){} else if(dn<=-0.99985){ if(!(A.ds||B.ds)) continue; } else continue;
if(Math.abs(A.d-B.d)>TOL+SURF_CONFLICT.tolEps) continue;   // 与 ② 同规: tol 上留 1e-6 松弛 (边界值两条实现各判一侧)
let out=false;
for(let k=0;k<3;k++){ if(A.bb[k][1]<B.bb[k][0]-TOL||B.bb[k][1]<A.bb[k][0]-TOL){ out=true; break; } }
if(out) continue;
let area=0;
outer: for(const ta of A.tris) for(const tb of B.tris){ const ar=_clipArea2(ta,tb); if(ar>=MINA){ area=ar; break outer; } }
if(area<MINA) continue;
pairs++; pairArea+=area;
let sa=mAdj.get(A.mesh); if(!sa){ sa=new Set(); mAdj.set(A.mesh,sa); }
let sb=mAdj.get(B.mesh); if(!sb){ sb=new Set(); mAdj.set(B.mesh,sb); }
sa.add(B.mesh); sb.add(A.mesh);
}
}
if(!pairs) return null;
SURF_RT.hits++;
// ── 贪心着色 (按 mesh 的"最大面面积"降序; 大面拿低档) ──
const best=new Map();
for(const r of recs){ const c=best.get(r.mesh); if(c===undefined||r.w>c) best.set(r.mesh,r.w); }
const order=[...mAdj.keys()].sort((x,y)=>(best.get(y)||0)-(best.get(x)||0));
const lvl=new Map();
let maxL=0,leveled=0;
// ★ 已落档件 (units>0 且 factor=0) 读回当**预着色节点**: 单位子树也在世界级消解器辖区里 (见 ② 候选收集),
//   它先给这些件分过档。模型级复跑时若无视旧档、按面积重排, 会出现"该退到 0 档的那件退不回去"
//   (k=0 只是"不改材质", 不会把 c1 变体撤掉) ⇒ 相邻两件一起停在 c1 = 无胜负
//   (实测反坦克炮 驻锄↔弹药箱, dev/verify-surfmodel T3 抓到)。纪律与世界级一致: 预着色件不重排, 只当约束。
//   ★2026-09-27M: 档号按符号原样读回 (世界级新增的"贴地件从 1 档起"会落到这里) —— 别用 `u>0` 过滤,
//     否则世界级刚落的档会被本支当成"未落档"重排, 两套各改一次同一件.
const preOf=m=>{ const mt=m.material;
if(!mt||mt.polygonOffset!==true||mt.polygonOffsetFactor!==0) return 0;
const u=mt.polygonOffsetUnits||0;
return u?Math.round(u/SURF_CONFLICT.step):0; };
for(const m of order){
const pre=preOf(m);
if(pre!==0){ lvl.set(m,pre); if(pre>maxL) maxL=pre; continue; }
const used=new Set();
for(const nb of mAdj.get(m)) if(lvl.has(nb)) used.add(lvl.get(nb));
let k=0; while(used.has(k)) k++;
if(k>SURF_CONFLICT.maxLevel) k=SURF_CONFLICT.maxLevel;
lvl.set(m,k); if(k>maxL) maxL=k;
if(k>0){ m.material=depthVariant(m.material,'c'+k); leveled++; }
}
// ── ★2026-09-27M 预着色件之间的"同档对"补刀 ──
// 病根: 两侧都已被**世界级**预着色、且档位相同时, 本支的纪律 (预着色件不重排) 与世界的判据盲区
//   (圆柱按盒近似 / 斜置真面) 撞在一起 —— 这一对谁都不管, 就停在同档打架. 实测反坦克炮
//   atBreech↔atBarrel 0.014m² (dev/_zfight-why island 归因"几何可见=否", 即两套都声称看不见).
// 处置: 让步给**面更小**的那一侧, 把它抬一档 (向屏内推). 只往正方向抬 ⇒ 不越过任何覆盖层,
//   也不与世界级的既有分配冲突 (世界级复跑时按 preLvl 读回, 只当约束).
let bumped=0;
{
const done=new Set();
for(const [m,nbs] of mAdj){
for(const nb of nbs){
if(m===nb) continue;
const key=(m.id<nb.id)?(m.id+':'+nb.id):(nb.id+':'+m.id);   // 同一对从两侧各进一次 ⇒ 键必须与方向无关
if(done.has(key)) continue; done.add(key);
const a=lvl.get(m)||0, b=lvl.get(nb)||0;
if(a!==b||a<=0) continue;                      // 档位不同 = 已分开; 0 档 = 本支刚刚才分过, 不重复处理
const loser=(best.get(m)||0)<=(best.get(nb)||0)?m:nb;
const k=Math.min(a+1,SURF_CONFLICT.maxLevel);
if(k===a) continue;
lvl.set(loser,k); if(k>maxL) maxL=k;
loser.material=depthVariant(loser.material,'c'+k); leveled++; bumped++;
}
}
if(bumped) SURF_RT.bumped=(SURF_RT.bumped||0)+bumped;
}
SURF_RT.meshes+=meshes; SURF_RT.pairs+=pairs; SURF_RT.leveled+=leveled;
const ms=Math.round(((typeof performance!=='undefined'&&performance.now)?performance.now():Date.now())-t0);
SURF_RT.ms+=ms;
SURF_RT.last=label+' 件 '+meshes+' 对 '+pairs+' 落档 '+leveled+' 顶档 '+maxL+'/'+SURF_CONFLICT.maxLevel+' '+ms+'ms';
if(typeof console!=='undefined'&&console.log&&SURF_RT.leveled<=64) console.log('[深度分层] 模型共面消解: '+(label||'(模型)')+' · 件 '+meshes+' · 约束对 '+pairs
+' (交叠 '+pairArea.toFixed(2)+'m²) · 落档 '+leveled+(bumped?' · 预着色同档补刀 '+bumped:'')+' · 顶档 '+maxL+'/'+SURF_CONFLICT.maxLevel+' · '+ms+'ms');
return {meshes,pairs,leveled,maxL,ms,area:pairArea};
}
// 每帧入口: 只处理没见过的单位模型 / 新挂进 world·scene 的子树 (每帧至多 SURF_RT_BUDGET 个根)
function resolveRuntimeSurfaces(){
let budget=SURF_RT_BUDGET;
// 建图基线: 第一次调用时把"此刻已存在的 world/scene 子件"整段划掉 (它们已由世界级消解器处理)
if(!_rtBase){ _rtBase=true; if(typeof world!=='undefined'&&world.children) _rtW=world.children.length;
if(typeof scene!=='undefined'&&scene.children) _rtS=scene.children.length; }
// ★ 视角武器 (vmScene): 独立场景、独立深度范围 (vmCamera near=0.01/far=10 ⇒ 30cm 处 1 LSB ≈ 0.5µm),
//   世界级/单位级都扫不到它, 而玩家**一直看着它**。只有真·同平面 (<1µm) 才会争, 实测每把枪 2 对
//   (最大 33cm²: 木托↔机匣这类贴合面) —— 是玩家最容易注意到的残留。VM.inner 每次 vmEquip 重建 ⇒
//   以 gunParts 的身份变化触发重做 (VM.root 本身是常驻对象, 不能用 WeakSet 判"见过")。
if(typeof VM!=='undefined'&&VM&&VM.root&&VM.gunParts&&_rtVmGun!==VM.gunParts){
_rtVmGun=VM.gunParts;
try{ resolveModelSurfaces(VM.root,'视角武器',SURF_RT_VMMINAREA); }catch(e){}
}
// 单位模型按"离相机由近到远"排 (先修玩家正看着的), 再取前 budget 个没处理过的
const cand=[];
const push=(root,label)=>{ if(root&&!_rtKnown.has(root)) cand.push([root,label]); };
if(typeof soldiers!=='undefined') for(const s of soldiers) if(s&&s.mesh&&s.mesh.root) push(s.mesh.root,'士兵');
if(typeof tanks!=='undefined') for(const v of tanks) if(v&&v.grp) push(v.grp,'坦克');
if(typeof planes!=='undefined') for(const v of planes) if(v&&v.grp) push(v.grp,'飞机');
if(typeof trucks!=='undefined') for(const v of trucks) if(v&&v.grp) push(v.grp,'卡车');
// ★2026-09-27M 修 (用户实机"船顶部一直图层打架"): 数组名是 15d 的 `navalCraft`, 这里写的是不存在的
//   `NAVALS` —— typeof 守卫恒为 false ⇒ **舰艇从来没进过运行期消解队列**, 模型级共面消解对艇一次都没跑过。
//   代价 (dev/_zfight-naval 实测 pt/gyorai): 甲板段顶面与干舷段顶面**完全共面** 12.7m² (两块板的顶面同高,
//   甲板比干舷宽 0.8% ⇒ 面积几乎全叠), 木纹与钢板贴图互相穿插 = 用户截图里"船顶一条条的花纹"。
if(typeof navalCraft!=='undefined') for(const v of navalCraft) if(v&&(v.grp||v.root)) push(v.grp||v.root,'舰艇');
if(typeof ATGUNS!=='undefined') for(const v of ATGUNS) if(v&&(v.grp||(v.mesh&&v.mesh.root))) push(v.grp||v.mesh.root,'反坦克炮');
if(typeof AAGUNS!=='undefined') for(const v of AAGUNS) if(v&&(v.grp||(v.mesh&&v.mesh.root))) push(v.grp||v.mesh.root,'高炮');
if(typeof BATTERIES!=='undefined') for(const v of BATTERIES) if(v&&(v.grp||v.root)) push(v.grp||v.root,'岸炮');
if(typeof MG42S!=='undefined') for(const v of MG42S) if(v&&(v.grp||v.root)) push(v.grp||v.root,'机枪座');
if(typeof MORTARS!=='undefined') for(const v of MORTARS) if(v&&(v.grp||v.root)) push(v.grp||v.root,'迫击炮');
if(cand.length&&budget>0&&typeof camera!=='undefined'&&camera&&camera.position){
const cx=camera.position.x, cz=camera.position.z;
for(const c of cand){ const p=c[0].position||{x:0,z:0}; c[2]=(p.x-cx)*(p.x-cx)+(p.z-cz)*(p.z-cz); }
cand.sort((a,b)=>a[2]-b[2]);
}
for(const c of cand){ if(budget<=0) break; _rtKnown.add(c[0]); budget--; SURF_RT.roots++; try{ resolveModelSurfaces(c[0],c[1]); }catch(e){} }
// 运行期新挂进 world/scene 的子树 (工程兵工事/道具/残骸/补给库…; 两张表只增不减 ⇒ 记边界即可)
if(budget>0&&typeof world!=='undefined'&&world.children&&world.children.length>_rtW){
const end=world.children.length;
for(let i=_rtW;i<end&&budget>0;i++){ const c=world.children[i]; if(!c||_rtKnown.has(c)) continue; _rtKnown.add(c); budget--; SURF_RT.roots++; try{ resolveModelSurfaces(c,'world件'); }catch(e){} }
_rtW=end;                       // 边界推到末尾: 未处理的(预算用尽)整段跳过 —— 单 mesh 子树本就无可解
}
if(budget>0&&typeof scene!=='undefined'&&scene.children&&scene.children.length>_rtS){
const end=scene.children.length;
for(let i=_rtS;i<end&&budget>0;i++){ const c=scene.children[i]; if(!c||_rtKnown.has(c)) continue; _rtKnown.add(c); budget--; SURF_RT.roots++; try{ resolveModelSurfaces(c,'scene件'); }catch(e){} }
_rtS=end;
}
}// 实心盒子: 视觉+碰撞同源。正交朝向=精确 AABB; 斜置分两种近似:
//  - 薄条(墙/护栏/楼梯): 沿长轴小块链, 块径≈短边(≥0.34);
//  - 大截面(楼板/平台/屋盖): 2D 小块阵贴片(边长1.7, 间距1.5, 全覆盖可站立),
//    修掉旧实现"旋转地板只有一条1.6m碰撞条"导致的一走就掉。
// chain 参数=强制用 1D 链(屋顶碰撞带等粗链), 链块尺寸取该值。
// ★ 2026-09-20 修斜置链走向 (用户实机"模型与判定不一样: 掉下楼/穿墙"的真因):
//   长轴世界方向必须与网格本地轴一致 —— local+X=(cs,-sn) / local+Z=(sn,cs)。
//   旧写法 `w>=d?cs:-sn` 在 d>w 时给出 (-sn,cs), 那是 local+Z 关于 X 轴的**镜像**:
//   斜置的"长边沿本地 Z"的墙/楼板, 碰撞小块链整体铺在与墙体垂直的方向上(±long/2),
//   墙体本身几乎无碰撞(穿墙), 站立面也没了(掉下楼), 还在墙两侧空中留下幻影碰撞盒。
//   dir 只在此处展开: 正交朝向(±90°/0°)走上面精确 AABB 分支, 不受影响。
// ===== 建筑构件网格合并 (Mesh Merging) =====
let _bldBatchDepth = 0;
let _bldBatch = null;

function bldBatchBegin(){
if(_bldBatchDepth === 0){
_bldBatch = new Map();
}
_bldBatchDepth++;
}

function mergeBoxItems(items, mat){
let anyCast = false;
for(const it of items){ if(it.cast) anyCast = true; }

const testGeo = uvGeo(boxGeo(items[0].w, items[0].h, items[0].d), mat);
if(testGeo && testGeo.attributes && testGeo.attributes.position && testGeo.attributes.position.array){
const N = items.length;
const positions = new Float32Array(N * 24 * 3);
const normals = new Float32Array(N * 24 * 3);
const uvs = new Float32Array(N * 24 * 2);
const indices = new (N * 24 > 65535 ? Uint32Array : Uint16Array)(N * 36);

let vOff = 0, iOff = 0;
for(const it of items){
const g = uvGeo(boxGeo(it.w, it.h, it.d), mat);
const pos = g.attributes.position;
const norm = g.attributes.normal || { getX:()=>0, getY:()=>1, getZ:()=>0 };
const uv = g.attributes.uv || { getX:()=>0, getY:()=>0 };
const idx = (g.index && g.index.array) ? g.index.array : null;
const cs = Math.cos(it.ry), sn = Math.sin(it.ry);
for(let k = 0; k < 24; k++){
const lx = pos.getX(k), ly = pos.getY(k), lz = pos.getZ(k);
positions[(vOff + k) * 3] = it.x + lx * cs + lz * sn;
positions[(vOff + k) * 3 + 1] = it.y + ly;
positions[(vOff + k) * 3 + 2] = it.z - lx * sn + lz * cs;
const nx = norm.getX(k), ny = norm.getY(k), nz = norm.getZ(k);
normals[(vOff + k) * 3] = nx * cs + nz * sn;
normals[(vOff + k) * 3 + 1] = ny;
normals[(vOff + k) * 3 + 2] = -nx * sn + nz * cs;
uvs[(vOff + k) * 2] = uv.getX(k);
uvs[(vOff + k) * 2 + 1] = uv.getY(k);
}
if(idx){
for(let j = 0; j < 36; j++){
indices[iOff + j] = vOff + idx[j];
}
} else {
const boxIdx = [0,2,1,2,3,1, 4,6,5,6,7,5, 8,10,9,10,11,9, 12,14,13,14,15,13, 16,18,17,18,19,17, 20,22,21,22,23,21];
for(let j = 0; j < 36; j++){
indices[iOff + j] = vOff + boxIdx[j];
}
}
vOff += 24;
iOff += 36;
}
const merged = new THREE.BufferGeometry();
merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
merged.setIndex(new THREE.BufferAttribute(indices, 1));
if(merged.computeVertexNormals) merged.computeVertexNormals();
if(merged.computeBoundingSphere) merged.computeBoundingSphere();
const mm = new THREE.Mesh(merged, mat);
mm.castShadow = anyCast;
mm.receiveShadow = true;
return mm;
} else {
const merged = new THREE.BufferGeometry();
const mm = new THREE.Mesh(merged, mat);
mm.castShadow = anyCast;
mm.receiveShadow = true;
return mm;
}
}

function bldBatchEnd(){
if(_bldBatchDepth <= 0) return;
_bldBatchDepth--;
if(_bldBatchDepth === 0){
const batch = _bldBatch;
_bldBatch = null;
if(!batch) return;
for(const [mat, items] of batch){
if(!items.length) continue;
if(items.length === 1){
const item = items[0];
world.add(item.mesh);
item.mesh.castShadow = item.cast;
item.mesh.receiveShadow = true;
continue;
}
const mergedMesh = mergeBoxItems(items, mat);
world.add(mergedMesh);
for(const item of items){
item.mesh.mergedMesh = mergedMesh;
item.mesh.parent = mergedMesh;
}
}
}
}

function solidBox(mat,w,h,d,x,y,z,ry=0,chain,crush,cast){
const doCast = cast !== undefined ? !!cast : (h >= 1.8 && Math.max(w,d) >= 1.8);
const bbList = [];
const sn=Math.sin(ry), cs=Math.cos(ry);
if(Math.abs(sn)<0.02||Math.abs(cs)<0.02){
const swap=Math.abs(sn)>0.5;
const bb=addBoxCollider(x,y,z, swap?d:w, h, swap?w:d); if(crush) bb.crush=true;
bbList.push(bb);
} else {
const long=Math.max(w,d), short=Math.min(w,d);
const s=chain||clamp(short*((long/short)<1.4?1.15:1.0),0.34,1.6);
const dirX=w>=d?cs:sn, dirZ=w>=d?-sn:cs;
const perpX=w>=d?-sn:-cs, perpZ=w>=d?-cs:sn;
const big=!chain&&short*1.15>1.55;
let nLong,nShort;
if(big){
const s2=clamp(short*0.9,0.34,1.6);
const sp=0.62;
const ins=s2/2;
const rl=Math.max(0.02,long-s2), rs=Math.max(0.02,short-s2);
nLong=Math.max(2,Math.ceil(rl/(s2*sp))+1);
nShort=Math.max(2,Math.ceil(rs/(s2*sp))+1);
for(let i=0;i<nLong;i++)for(let j=0;j<nShort;j++){
const t=-(long/2-ins)+i*rl/(nLong-1);
const u=-(short/2-ins)+j*rs/(nShort-1);
const bb=addBoxCollider(x+dirX*t+perpX*u, y, z+dirZ*t+perpZ*u, s2, h, s2); if(crush) bb.crush=true;
bbList.push(bb);
}
const sC=s2*0.6, dC=0.354*sC;
for(const sx of [-1,1])for(const sz of [-1,1]){
const t=sx*(long/2-dC), u=sz*(short/2-dC);
const bb=addBoxCollider(x+dirX*t+perpX*u, y, z+dirZ*t+perpZ*u, sC, h, sC); if(crush) bb.crush=true;
bbList.push(bb);
}
}else{
nLong=Math.max(1,Math.ceil(long/(s*0.92)));
nShort=1;
for(let i=0;i<nLong;i++){
const t=nLong===1?0:-long/2+s/2+i*(long-s)/(nLong-1);
const bb=addBoxCollider(x+dirX*t, y, z+dirZ*t, s, h, s); if(crush) bb.crush=true;
bbList.push(bb);
}
}
}

if(_bldBatch && !_dG && !crush && !chain){
let arr = _bldBatch.get(mat);
if(!arr){ arr = []; _bldBatch.set(mat, arr); }
const m = new THREE.Mesh(uvGeo(boxGeo(w,h,d),mat), mat);
m.position.set(x, y, z); m.rotation.y = ry;
m.castShadow = doCast; m.receiveShadow = true;
arr.push({w, h, d, x, y, z, ry, cast: doCast, bbList, mesh: m});
for(const bb of bbList) bb.mesh = m;
return m;
} else {
const m = mesh(boxGeo(w,h,d), mat, x, y, z, ry, doCast);
for(const bb of bbList) bb.mesh = m;
return m;
}
}
// ===== 地物贴坡: 采样物体局部轴向的地面高差 → 贴合俯仰/侧倾角 + 落地高度 =====
// 约定与载具悬挂一致 (YXZ 序): 局部 X=物体长轴, +X 端抬高=正 roll; 局部 Z=短轴(正面), +Z 端抬高=负 pitch
const _UP=new THREE.Vector3(0,1,0), _FWD=new THREE.Vector3(0,0,1), _N=new THREE.Vector3();
function groundFit(x,z,ry,spanX,spanZ){
const cs=Math.cos(ry), sn=Math.sin(ry);
const hx0=heightAt(x-cs*spanX,z+sn*spanX), hx1=heightAt(x+cs*spanX,z-sn*spanX);
const hz0=heightAt(x-sn*spanZ,z-cs*spanZ), hz1=heightAt(x+sn*spanZ,z+cs*spanZ);
// max: 四点最高 (轨上车皮/半埋件用 —— 取均值会让长件的一端埋进轨面, verify-buildings ⑧ 抓过)
return {y:(hx0+hx1+hz0+hz1)/4, max:Math.max(hx0,hx1,hz0,hz1), pitch:-Math.atan2(hz1-hz0,2*spanZ), roll:Math.atan2(hx1-hx0,2*spanX)};
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
structBounds(g);                       // 成员盒并集 (命中判据的廉价早退; 与 g 同生命周期, 只算一次)
if(pre) destroyStructure(g,true);
return g;
}
// 单个碰撞箱移除 (墙组销毁/屋顶坍塌的碰撞带共用)
// ★2026-09-20: **连同共享同一视觉网格的兄弟碰撞格一起击杀** —— 斜置件是一条视觉网格配多块碰撞格
//   (薄条链/大截面贴片), 旧版只杀被命中的那一格: 视觉没了、其余格子还留在原地 ⇒ 隐形墙/隐形地板。
function killBox(b){
if(!b||b.dead) return;
const mesh=b.mesh;
b.dead=true;
if(mesh){
if(mesh.parent) world.remove(mesh);
for(let i=0;i<BOXES.length;i++){ const o=BOXES[i]; if(o!==b&&!o.dead&&o.mesh===mesh) killOne(o); }
}
killOne(b);
}
function killOne(b){
b.dead=true;
if(OCC.data){
const i0=clamp(Math.floor((b.minX-0.7+OCC.off)/OCC.res),0,OCC.N-1),i1=clamp(Math.ceil((b.maxX+0.7+OCC.off)/OCC.res),0,OCC.N-1);
const j0=clamp(Math.floor((b.minZ-0.7+OCC.off)/OCC.res),0,OCC.N-1),j1=clamp(Math.ceil((b.maxZ+0.7+OCC.off)/OCC.res),0,OCC.N-1);
for(let j=j0;j<=j1;j++)for(let i2=i0;i2<=i1;i2++) OCC.data[j*OCC.N+i2]=0;
occTouch(b.minX-0.7,b.minZ-0.7,b.maxX+0.7,b.maxZ+0.7); // 增量重烘焙脏矩形 (03-terrain; 缺它=导航留下陈旧格)
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
function collapseRoof(ref,silent,attacker){
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
AudioSys.explosion('collapse',Math.hypot(cx-camera.position.x,cz-camera.position.z)*0.85,AudioSys.panOf({x:cx,z:cz})); // 屋盖坍塌档 (★2026-11-15c: 闷隆+散落)
for(const rm of seen) world.remove(rm);
}
// 碰撞带连同其阶梯网格一并击杀 (不再 keepMesh —— 残留空中 = 屋顶浮空 bug 根源)
// ★ 2026-09-27N (A4): 击杀碰撞**之前**先按落体覆盖矩形结算一次"被砸" (此刻碰撞盒 AABB 还完好)。
//   旧版整片屋盖砸下来是纯视觉事件 —— 站在楼里看天花板塌下来不会死。静默分支 (构建期预塌/重建)
//   不伤人: 那时场上还没有人。
if(!silent){
const rb={minX:1e9,minY:1e9,minZ:1e9,maxX:-1e9,maxY:-1e9,maxZ:-1e9};
for(const b of bands.concat(slabBs)){ if(!b||b.dead) continue;
if(b.minX<rb.minX)rb.minX=b.minX; if(b.maxX>rb.maxX)rb.maxX=b.maxX;
if(b.minY<rb.minY)rb.minY=b.minY; if(b.maxY>rb.maxY)rb.maxY=b.maxY;
if(b.minZ<rb.minZ)rb.minZ=b.minZ; if(b.maxZ>rb.maxZ)rb.maxZ=b.maxZ;
}
if(rb.minX<=rb.maxX) collapseCrush(rb,Math.max(rb.maxY,heightAt((rb.minX+rb.maxX)/2,(rb.minZ+rb.maxZ)/2)),heightAt((rb.minX+rb.maxX)/2,(rb.minZ+rb.maxZ)/2),attacker);
}
for(const b of bands) killBox(b);
for(const b of slabBs) killBox(b);
// 平台上的固定火力点随平台一起消失 (2026-09-19 用户实机"塔楼倒塌后顶部的防空炮会浮空":
// 防空炮挂在塔顶平台的坍塌链上 —— 平台没了, 炮不能留在半空还能被操作)
if(typeof killDeckGuns==='function') killDeckGuns(ref);
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
function destroyStructure(g,silent,attacker,at){
if(g.dead) return; g.dead=true;
// ── 破坏得分 (2026-09-26 破坏得分批): 运行期摧毁一组可破坏物 → 给击毁者加分 ──
// 放在最前: 后面无论走哪条视觉/坍塌分支, 记账都已经落定; 链式坍塌 (wallAbove/roofRef) 由本函数
// **递归时各自记账** ⇒ 一组一次、不重复 (g.dead 门在上一行)。世界构建期预塌 (silent) 不计分。
// attacker 由 damageStructures 透传; 直调本函数的路径 (炮位自毁链) 自带 attacker。
// structBatchBegin/End (21-match): 本函数 = "一次摧毁事件"的边界 —— 链式/屋顶坍塌都在其内部递归,
// 合成一条得分角标; 外层 damageStructures 另开一层批 ⇒ 一次爆炸整体仍是**一条**合并角标
// (计数器归零时才 flush)。函数体除上面那句 g.dead 早退外没有第二个出口 ⇒ begin/end 必定配对。
if(typeof structBatchBegin==='function') structBatchBegin();
if(!silent&&typeof awardStructScore==='function') awardStructScore(g,attacker);
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
// ★ 2026-09-27N (C4): 表现中心 = **被击中的那一块** (at, 由 damageStructures/撞塌 传入), 不再一律用组心。
//   旧版代价: 10.6m 长墙远端塌了, 站在墙脚的人既听不到也震不到 (离组心 >25m), 尘还从墙中段冒出来;
//   空心组 (环形围墙) 的组心甚至可能落在几十米外的空地上 —— 尘从空地升起。
const fx=at||null;
const hx=fx?fx.x:g.cx, hz=fx?fx.z:g.cz;
const gy=heightAt(hx,hz);
for(const m of ms) spawnWallDebris(m,hx,hz);
for(const m of ms) world.remove(m);
rubblePileFX(hx,hz,gy); // 常驻碎石堆 → 停留 RUBBLE_TTL 秒后沉入消失
// 崩塌灰尘: 底部滚出的浓尘 + 升腾烟柱 + 飞溅碎屑
for(let k=0;k<10;k++){
const a=rand(0,TAU), rr=rand(0.5,2.2);
spawnP(PT.dirt,hx+Math.sin(a)*rr,gy+rand(0.1,0.5),hz+Math.cos(a)*rr,Math.sin(a)*rand(1.5,3.5),rand(0.3,1.2),Math.cos(a)*rand(1.5,3.5),rand(0.7,1.2),2.2,rand(1.2,2),0.85,0.6);
}
for(let k=0;k<8;k++) spawnP(PT.smoke,hx+rand(-2,2),gy+rand(0.5,2.8),hz+rand(-2,2),rand(-0.6,0.6),rand(0.8,2),rand(-0.6,0.6),rand(1,1.6),2.8,rand(1.8,2.8),0.7,0.1);
for(let k=0;k<8;k++) spawnP(PT.dirt,hx+rand(-1.5,1.5),gy+rand(1,2.8),hz+rand(-1.5,1.5),rand(-4,4),rand(2,6),rand(-4,4),rand(0.3,0.55),0.5,rand(0.6,1),0.9,7);
// 高层墙塌 (at 来自楼上那一块): 在**缺口高度**补一层尘 —— 全按地面高撒尘时, 楼上塌墙看着像地面塌
if(fx&&fx.y-gy>2.4) for(let k=0;k<6;k++) spawnP(PT.dirt,hx+rand(-1.2,1.2),fx.y+rand(-0.8,0.8),hz+rand(-1.2,1.2),rand(-1,1),rand(0.5,2),rand(-1,1),rand(0.6,1),2,rand(0.8,1.4),0.85,0.5);
AudioSys.explosion('collapse',Math.hypot(hx-camera.position.x,hz-camera.position.z)*0.7,AudioSys.panOf({x:hx,z:hz})); // 高墙坍塌档 (★2026-11-15c)
if(player.alive&&Math.hypot(hx-player.pos.x,hz-player.pos.z)<25) addTrauma(0.4);
// ★ 2026-09-27N (A4): 坍塌碾压 —— 旧版坍塌是纯视觉事件 (站在楼里看天花板塌下来不会死)。
//   口径: 落体覆盖矩形 = 本组成员盒并集, 顶面 = 最高一块的顶; 参数见 00-config.STRUCT_CRUSH。
const bb=structBounds(g);
collapseCrush(bb,bb.maxY,gy,attacker);
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
	if(trig) collapseRoof(g.roofRef,silent,attacker);
	}
// 竖向承重链 (2026-09-05 用户实机反馈"二楼墙浮空"): 某层一面墙垮塌 → 正上方楼层的同面墙
// 失去支承随之垮塌 (递归到顶; 上层墙走完整 destroyStructure = 自带碎块化/扬尘/掏空判定)
if(g.wallAbove&&!g.wallAbove.dead) destroyStructure(g.wallAbove,silent,attacker,at);
// 墙塌后 Bot 寻路刷新 (markNavDirty 定义在 07-nav, 世界构建期不可直接调)
if(typeof markNavDirty==='function') markNavDirty();
if(typeof structBatchEnd==='function') structBatchEnd();   // 本事件的边界收尾 (与函数顶部那次 begin 配对)
}
// ═════ 破坏机制批 (2026-09-27N): 命中判据 / 掩体·油桶 / 坍塌碾压 / 血量归一 / 材质档 ═════
// ── ① 命中判据单源: 爆点到"最近成员碰撞盒"的**三维**距离 (落在盒内 = 0), 竖直方向另给一层门限 ──
// 旧版只有一行 `Math.hypot(g.cx-p.x, g.cz-p.z)`: 组心 + 只看 x/z ⇒ 三件事同源 ——
//   长墙远端"打不着" · 楼顶与楼底同判 (60m 高空与贴脸同伤害) · 隔山隔楼无遮挡。
// 返回共享槽 (热路径每帧多次调用, 不分配对象); 字段名与 BOXES 一致 ⇒ 组包围盒也能直接喂进来。
const _sd={d:0,dy:0};
function boxDist3(p,b){
let dx=0,dy=0,dz=0;
if(p.x<b.minX) dx=b.minX-p.x; else if(p.x>b.maxX) dx=p.x-b.maxX;
if(p.y<b.minY) dy=b.minY-p.y; else if(p.y>b.maxY) dy=p.y-b.maxY;
if(p.z<b.minZ) dz=b.minZ-p.z; else if(p.z>b.maxZ) dz=p.z-b.maxZ;
_sd.d=Math.sqrt(dx*dx+dy*dy+dz*dz); _sd.dy=dy;
return _sd;
}
// 组包围盒 (成员盒并集): 只服务"这一炮够不着"的廉价早退 —— 条目死后被 killOne 写成 99999, 并集只会变大
// ⇒ 判据永远保守 (宁可多扫一个组, 不可漏一个)。构建期在 dEnd 算一次, 缺省惰性补算。
function structBounds(g){
if(g.bb) return g.bb;
let x0=1e9,y0=1e9,z0=1e9,x1=-1e9,y1=-1e9,z1=-1e9;
for(const bi of g.bi||[]){ const b=BOXES[bi]; if(!b||b.dead) continue;
if(b.minX<x0)x0=b.minX; if(b.maxX>x1)x1=b.maxX;
if(b.minY<y0)y0=b.minY; if(b.maxY>y1)y1=b.maxY;
if(b.minZ<z0)z0=b.minZ; if(b.maxZ>z1)z1=b.maxZ; }
if(x0>x1){ x0=y0=z0=0; x1=y1=z1=0; }
g.bb={minX:x0,minY:y0,minZ:z0,maxX:x1,maxY:y1,maxZ:z1};
return g.bb;
}
// ── ② 材质变体池 (受损档 / 永久件档): 与共面消解同一纪律 —— **绝不就地改共享材质** ──
// MAT.wood/brick/plaster 是全库共用的, 就地改颜色会把全世界那一种墙一起改掉; 按 (材质 × 档) 池化克隆。
const _dmgMats=new Map(), _permMats=new Map();
function _matShade(mat,key,val,mul,store){
if(!mat) return mat;
let by=store.get(mat);
if(!by){ by=new Map(); store.set(mat,by); }
const hit=by.get(val); if(hit) return hit;
const m=(typeof mat.clone==='function')?mat.clone():Object.assign(Object.create(Object.getPrototypeOf(mat)),mat); // 沙箱桩兜底
if(!m) return mat;
if(mat.uvRef!==undefined) m.uvRef=mat.uvRef;   // clone() 不复制自定义字段: 贴图密度登记必须随克隆带走 (丢它=永久件/受损件整张贴图拉伸铺满小面, 实机"各部位像两种材料")
const c=m.color;
if(c&&typeof c.clone==='function'&&typeof c.multiplyScalar==='function') m.color=c.clone().multiplyScalar(mul);
m[key]=val;   // 机械痕迹 (沙箱/实机同源, 验证器读它): clone() 不复制自定义字段, 这里显式写
by.set(val,m);
return m;
}
// 受损中间态 (B3): 0=完好 (原材质) / 1=<66% 血 / 2=<33% 血 —— 越破越暗
function structMatDamage(mat,tier){ return tier>0?_matShade(mat,'dmgTier',tier,tier===1?0.86:0.72,_dmgMats):mat; }
// 永久件档 (B5) —— 2026-09-28 用户裁定**取消提亮** (D3 第七报定案): 逐盒提亮在带门窗分段墙上只有
// ≥1.6m 的子盒够格, 同一面墙 +6%/0% 拼块, 实机读作"各个部位明暗区别很大"——与"整面统一可读"的设计
// 意图相反。保留单源函数壳 (markPermPieces / pitchedRoof 永久屋盖仍调用) 与 perm 盒标记
// (verify-destruct T10 / verify-roofghost 判据读它); "打不烂"的可读性交给弹着反馈本身。
// 若未来要恢复视觉档, 只在这一处改 —— 勿在调用点就地改共享材质 (MAT.* 全库共用)。
function structMatPerm(mat){ return mat; }
function structSetDamageTier(g,frac){
const tier=frac>0.66?0:(frac>0.33?1:2);
if(tier===(g.dmgTier||0)) return;
g.dmgTier=tier;
const ms=g.meshes||[];
if(!g._mat0) g._mat0=ms.map(m=>m?m.material:null);   // 首次受伤时记下原材质 (世界还原/重开一局要能回退)
for(let i=0;i<ms.length;i++){
const m=ms[i]; if(!m) continue;
m.material=tier>0?structMatDamage(m.material,tier):(g._mat0[i]||m.material);
}
}
// 世界还原 (23b): 血量回到满值 ⇒ 受损档必须同时回退 (否则新一局开局满血却挂着破墙材质)
function structResetDamage(){
for(const g of DESTRUCTIBLES){
if(!g.dmgTier) continue;
g.dmgTier=0;
const ms=g.meshes||[], m0=g._mat0;
if(!m0) continue;
for(let i=0;i<ms.length;i++){ const m=ms[i]; if(m&&m0[i]) m.material=m0[i]; }
}
}
// ── ③ 屋顶/楼板承伤登记 (B2): 碰撞带打 roof 标记 + 按投影面积给血条 ──
// 旧版"直接轰屋顶零效果": 坡顶碰撞带/平顶板不在任何可毁组里, 只有"残余承重墙≤2"这条间接触发路径。
// ref.hp 只由**屋顶承重件**承担伤害 (楼板仍在 slabs 里, 只为煎饼式坍塌), 命中口径与组同规: 一场爆炸按
// "最近那一片"记一次 ⇒ 一发炮弹不会因为同时盖住 6 条带而记 6 次。
function roofRefFinalize(ref){
if(!ref) return ref;
const pieces=(ref.bands&&ref.bands.length)?ref.bands:(()=>{ const a=[]; for(const e of (ref.slabs||[])) for(const b of (e&&e.b)||[]) a.push(b); return a; })();
let x0=1e9,z0=1e9,x1=-1e9,z1=-1e9,n=0;
for(const b of pieces){ if(!b||b.dead) continue;
b.roof=ref; n++;                        // 爆炸扫掠按这个标记给 ref 记账 (见 structSweepNear)
if(b.minX<x0)x0=b.minX; if(b.maxX>x1)x1=b.maxX;
if(b.minZ<z0)z0=b.minZ; if(b.maxZ>z1)z1=b.maxZ;
}
if(!n||x0>x1) return ref;                // 没有可打到的承重件 (纯视觉顶): 不给血条
const area=Math.max(1,(x1-x0)*(z1-z0));
ref.area=area;
ref.hp=clamp(STRUCT_ROOF.base+STRUCT_ROOF.perSqrtArea*Math.sqrt(area),STRUCT_ROOF.min,STRUCT_ROOF.max);
if(ref.dmg===undefined) ref.dmg=0;
return ref;
}
function roofDamage(ref,amt,attacker){
if(!ref||ref.done||!ref.hp||!(amt>0)) return;
ref.dmg=(ref.dmg||0)+amt;
if(ref.dmg>=ref.hp) collapseRoof(ref,false,attacker);
}
// ── ④ 爆炸的"非组"目标扫掠 (A3 掩体 + B2 屋顶) ──
// 旧版 damageStructures 只遍历 DESTRUCTIBLES ⇒ 沙袋/石墙/木箱/树篱/倒木对爆炸**零作用** (木箱比灌木硬)。
function structSweepNear(p,R,amt,attacker){
const roofs=new Map();
eachBoxNear(p.x-R,p.z-R,p.x+R,p.z+R,b=>{
if(b.dead) return;
if(b.crush){
const s=boxDist3(p,b);
if(s.d<R&&s.dy<=STRUCT_HIT.vGate) crushCoverBox(b);   // 与坦克碾压同一支表现 (碎屑; 树篱走 vanishFlora)
return;
}
if(b.roof&&!b.roof.done){
const s=boxDist3(p,b);
if(s.d>=R||s.dy>STRUCT_HIT.vGate) return;
const prev=roofs.get(b.roof);
if(prev===undefined||s.d<prev) roofs.set(b.roof,s.d);
}
});
roofs.forEach((d,r)=>roofDamage(r,amt*(1-d/R*STRUCT_HIT.falloff),attacker));
}
// ── ⑤ 油桶引爆 (A3): 先摘账 (killCyl + 移除网格) 再结算 —— 同一只桶只会引爆一次, 链式引爆有界 ──
// 旧版油桶只进 CYLS (挡子弹) 且无 crush/无移除路径 ⇒ 永远炸不掉、碾不掉 (全库 killCyl 只有植被/炮位在用)。
let _barrelDepth=0;
function barrelBlast(c,attacker){
if(!c||c.dead||!c.explosive) return false;
const p=V3(c.x,(c.y0+c.y1)/2,c.z);
killCyl(c);
// 网格只摘不置空: 世界还原按 world.children 快照把网格放回来, 下一局同一只桶还能再被引爆一次
if(c.mesh&&c.mesh.parent) world.remove(c.mesh);
if(typeof explosionFXSmall==='function') explosionFXSmall(p); else if(typeof explosionFX==='function') explosionFX(p);
if(typeof AudioSys!=='undefined'&&AudioSys.explosion&&camera) AudioSys.explosion('drum',p.distanceTo(camera.position)*0.8,AudioSys.panOf(p)); // 燃料桶档 (★2026-11-15c: 亮 pop)
for(let k=0;k<6;k++) spawnP(PT.spark,p.x,p.y,p.z,rand(-3,3),rand(1.5,4.5),rand(-3,3),0.13,-0.02,rand(0.2,0.45),1,6,true);
for(let k=0;k<5;k++) spawnP(PT.dark,p.x+rand(-0.6,0.6),p.y+rand(0.2,1.2),p.z+rand(-0.6,0.6),rand(-1.4,1.4),rand(1,2.6),rand(-1.4,1.4),rand(0.7,1.2),2,rand(1,1.6),0.75,0.3);
// 溅射不认人 (燃料爆炸, 对双方一视同仁) + 点燃周边植被; 已归零的桶自身不再参与
if(typeof splashDamage==='function') splashDamage(p,attacker,-1,3.4,95,60);
if(typeof igniteArea==='function') igniteArea(c.x,c.z,2.2,attacker,6);
// 连锁: 震塌近处结构 (半径/伤害取桶级小爆); 深度上限防"油桶阵互相递归" —— 每只桶只会引爆一次
if(_barrelDepth<3){ _barrelDepth++; try{ damageStructures(p,2.8,90,attacker); } finally{ _barrelDepth--; } }
return true;
}
// ── ⑥ 坍塌碾压 (A4): 落体覆盖范围内的步兵/载具吃一次"被砸" (旧版坍塌是纯视觉事件: 站在楼里不会死) ──
// 判据: 水平落在覆盖矩形 (外扩 pad) 内 + 高度在 [地面−vBand, 顶面+0.5] 之间。伤害随落体高度加码。
function collapseCrush(bb,yTop,gy,attacker){
if(!bb||!(yTop>gy-1)) return;
const h=yTop-gy;
const dmgInf=clamp(STRUCT_CRUSH.infBase+STRUCT_CRUSH.infPerM*h,STRUCT_CRUSH.infBase,STRUCT_CRUSH.infMax);
const pad=STRUCT_CRUSH.pad;
if(typeof combatants!=='undefined') for(const s of combatants){
if(!s||!s.alive) continue;
if(typeof seatShielded==='function'&&seatShielded(s)) continue;   // 车内乘员由载具受伤承担 (与 splashDamage 同口径)
const px=s.pos.x, pz=s.pos.z, py=s.pos.y;
if(px<bb.minX-pad||px>bb.maxX+pad||pz<bb.minZ-pad||pz>bb.maxZ+pad) continue;
if(py>yTop+0.5||py<gy-STRUCT_CRUSH.vBand) continue;
s.damage(dmgInf,attacker,false);
if(s.isPlayer&&typeof addTrauma==='function') addTrauma(0.5);
}
const dv=dmgInf*STRUCT_CRUSH.vehMul;
for(const arr of (typeof tanks!=='undefined'?[tanks,(typeof trucks!=='undefined'?trucks:null)]:[null])){
if(!arr) continue;
for(const t of arr){
if(!t||!t.alive||!t.pos) continue;
const px=t.pos.x, pz=t.pos.z;
if(px<bb.minX-pad||px>bb.maxX+pad||pz<bb.minZ-pad||pz>bb.maxZ+pad) continue;
if(t.pos.y>yTop+1.5||t.pos.y<gy-STRUCT_CRUSH.vBand) continue;
t.takeDmg(dv,attacker);
}
}
}
// ── ⑦ 单组伤害入口: 爆炸/撞塌/油桶/坍塌链共用同一套账 (hp0 → 扣血 → 受损档 → 归零销毁) ──
// 为什么要有它: 旧版撞塌 (15-vehicles) 绕开 hp 直调 destroyStructure ⇒ 同一个结果两种报酬, 且不计分 (B4)。
function damageStructureBy(g,amt,attacker,at){
if(!g||g.dead||!(amt>0)) return 0;
if(typeof structBatchBegin==='function') structBatchBegin();
if(g.hp0===undefined||g.hp>g.hp0) g.hp0=g.hp;
g.hp-=amt;
if(g.hp<=0) destroyStructure(g,false,attacker,at);
else structSetDamageTier(g,g.hp0>0?g.hp/g.hp0:1);
if(typeof structBatchEnd==='function') structBatchEnd();
return amt;
}
// ── ⑧ 血量按组规模归一 (B1): 单点后处理, 构建期末尾跑一次 (24-main) ──
// 旧版"每组一个数字": 实测每盒分摊血量 2.6 (202 盒长墙) ~ 230 (单盒垛) = 88 倍 ⇒ 数值上"短墙更结实"。
// 曲线见 00-config.STRUCT_HP; noScale 留给"对局目标血量由运行期重写的组"(反舰炮位胸墙: revive 会写回 maxHp)。
function structHPScale(n){
return clamp(STRUCT_HP.base+STRUCT_HP.span*Math.sqrt(Math.max(1,n)/STRUCT_HP.ref),STRUCT_HP.min,STRUCT_HP.max);
}
function scaleStructHP(){
let n=0;
for(const g of DESTRUCTIBLES){
if(!g) continue;
if(g.hpNom===undefined) g.hpNom=g.hp;
// noScale = 血量由**对局规则**而非"这组有多厚实"决定 (破袭补给库 720 / 反舰炮位胸墙 BATTERY_HP):
//   这两处的 hp 会被运行期复位链写回 (22-hud / 15f.revive), 缩放它会造成"开局值与复位值不一致"。
if(g.noScale){ g.hpFull=g.hpNom; g.hp=g.hpNom; continue; }
g.hpFull=Math.max(1,Math.round(g.hpNom*structHPScale(g.n||1)));
g.hp=g.hpFull;
if(g.hp0===undefined) g.hp0=g.hpFull;    // 评分权重 (STRUCT_SCORE) 从此在建图期定死, 不再依赖"首次受伤"时机
n++;
}
return n;
}
// 血量复位单源 (破袭补给库每局开头由 HUD 复位): 回"缩放后的名义血量", 不是写死的 720
function structResetHP(g){
if(!g) return;
if(g.hpFull>0) g.hp=g.hpFull;
else if(g.hpNom!==undefined) g.hp=g.hpNom;
g.dmgTier=0;
}
// ── ⑨ 永久件视觉档 (B5): "高 ≥1.6m 且顶面高出地面 ≥1.5m、不在可毁组、不可碾、不是植被"的碰撞盒 ──
// 实测占比最高到 18% (诺曼底 1252 件) —— 同样是砖墙贴图, 这面塌那面不塌, 玩家只能靠试。这里的口径:
// 能被打掉的件保持原材质, 打不掉的件统一换"永久件"档 (轻微提亮到混凝土感) ⇒ 一眼可读。
function markPermPieces(){
let n=0;
for(const b of BOXES){
if(b.dead||!b.mesh||!b.mesh.material) continue;
if(b.dGroup||b.crush||b.flora||b.roof) continue;
if(b.perm) continue; // 已是永久件档 (如 2026-09-28 起 pitchedRoof 永久屋盖整片预标): 跳过, 防"提亮的提亮"二次漂白
if(b.maxY-b.minY<1.6||b.maxY-b.gh<1.5) continue;
b.mesh.material=structMatPerm(b.mesh.material);
b.perm=1; n++;
}
return n;
}
// attacker (可选, 2026-09-26 破坏得分批): **只用于"谁拆的算谁的分"** —— 不传/传 null 时结构与破坏行为
//   与旧版逐字一致 (无主爆炸不给任何人加分)。全库 9 个调用点各自把手上已有的 owner/thrower 传进来。
function damageStructures(p,radius,amt,attacker){
// 所有爆炸的统一入口: 同步作用于植被 (近距离树被掀倒/灌木炸没, 见 04b-fire)
if(typeof explosionFlora==='function') explosionFlora(p,radius);
if(typeof structBatchBegin==='function') structBatchBegin(); // 一次爆炸打出的多组摧毁合并成一条得分角标 (21-match)
const R=radius+STRUCT_HIT.pad, VG=STRUCT_HIT.vGate;
// ① 可毁结构组: 判据 = 到**最近成员碰撞盒**的三维距离 (盒内 0), 一场爆炸每组只结算一次 (最近那一块)
//    —— 旧版按组心平面距: 长墙远端打不掉血 (柏林/莫斯科实测 9~10% 的成员盒"正中落点零伤害"),
//      而爆点在 +60m 高空与贴脸同伤害 (只改 y 的 A/B 实测 45/45 逐位相同)。
for(const g of DESTRUCTIBLES){
if(g.dead) continue;
const bb=g.bb||structBounds(g);
if(boxDist3(p,bb).d>=R) continue;          // 到组包围盒都够不着 ⇒ 组内任何盒更够不着 (并集性质)
let best=-1, bd=1e9;
for(const bi of g.bi){
const b=BOXES[bi]; if(!b||b.dead) continue;
const s=boxDist3(p,b);
if(s.dy>VG) continue;                      // 竖直差超过一层楼: 不同楼层, 不参与 (挡"打屋顶拆一楼")
if(s.d<bd){ bd=s.d; best=bi; }
}
if(best<0||bd>=R) continue;
const hb=BOXES[best];
// 命中件 = 最近那一块 (C4): 尘源/屏震/碎石堆都按它算, 不再一律用组心
damageStructureBy(g,amt*(1-bd/R*STRUCT_HIT.falloff),attacker,
{x:(hb.minX+hb.maxX)/2,y:(hb.minY+hb.maxY)/2,z:(hb.minZ+hb.maxZ)/2});
}
// ② 掩体/屋顶 (A3+B2): 同一发爆炸里按各自口径结算 (掩体逐个、屋顶每个 ref 一次)
structSweepNear(p,R,amt,attacker);
// ③ 油桶 (A3): 圈内桶逐个引爆 (引爆自身会再走一遍本函数的近场结算 —— 有界, 见 barrelBlast)
eachCylNear(p.x-R,p.z-R,p.x+R,p.z+R,c=>{
if(!c||c.dead||!c.explosive) return;
const dy=p.y<c.y0?c.y0-p.y:(p.y>c.y1?p.y-c.y1:0);
const dx=c.x-p.x, dz=c.z-p.z;
if(Math.sqrt(dx*dx+dy*dy+dz*dz)<R) barrelBlast(c,attacker);
});
if(typeof structBatchEnd==='function') structBatchEnd();
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
// 采样: 足迹四周外扩 0.3 环带 + 4×4 室内网格 (2026-09-20: 旧版 9 点会漏掉象限内的局部坑/包,
// 使"室内是不是坑"的判据与楼面高度都失准 —— 建筑地基平台的门限与高低差就靠这份采样)
for(const [lx,lz] of [[-w/2-m,-d/2-m],[w/2+m,-d/2-m],[w/2+m,d/2+m],[-w/2+m,d/2+m],[0,0],[w/2+m,0],[-w/2+m,0],[0,d/2+m],[0,-d/2-m],
[-w/2,-d/2],[-w/2,0],[-w/2,d/2],[0,-d/2],[0,d/2],[w/2,-d/2],[w/2,0],[w/2,d/2],
[-w/4,-d/4],[w/4,-d/4],[w/4,d/4],[-w/4,d/4]]){
const p=L(lx,lz), h=heightAt(p[0],p[1]);
if(h<hMin)hMin=h; if(h>hMax)hMax=h;
}
const floor=hMax+(opt.raise!==undefined?opt.raise:0.06);
// ★ 建筑地基平台 (2026-09-20 用户实机"斜坡上的建筑没有地板: 进门就是大凹坑、楼梯台阶失效"的真因):
//   旧口径楼面=hMax+0.06 而**室内地面=原地形** ⇒ 坡地建筑室内天然是个深达 (hMax-hMin) 的坑:
//   从门槛(楼面高)踏进去直接掉进坑里爬不出来, 楼梯梯脚也在坑底(台阶失效), 门台阶还常常超过 3 级封顶。
//   修法: 足迹高低差超过门限时登记一块"硬平台"(03-terrain PADS) —— 内圈 r0 覆盖整个足迹(含四角)+
//   门侧缓冲, 地面恒等于楼面; r0..r1 平滑回落地形。建筑就此"坐落"在水平地基上:
//   室内地面=楼面(无坑) · 门槛零落差(门台阶自动不再生成) · 楼梯梯脚落地 · Bot 照常走进去(地形非碰撞体)。
//   地形网格顶点在世界布局后由 refreshTerrainMesh() 重刷(05c buildWorld 末尾)。
//   门限 0.5m: 更浅的起伏 (<0.5m) 玩家一步就迈过去了(地形不是碰撞体, standHeight 允许 0.55 级差),
//   不值得为它改地形 —— 削平会牵动紧邻的道具/铁路/战壕, 得不偿失 (2026-09-20 沙箱: 红十月厂区
//   铁路平板车就落在邻建地基裙坡上)。0.5m 以上才是用户看到的"大凹坑"。
if(typeof addPad==='function'&&!opt.noPad&&(hMax-hMin)>0.5){
// 定向矩形地基: 半宽/半深 = 足迹半宽 + 台缘 (小屋 0.9m; 大件按尺寸放大 —— 厂房/机库这类"场地型"建筑
// 自带一整片平整场院, 也让厂区铁路支线/货场落在台面上而不是裙坡上)
const m2=Math.max(0.9,0.18*Math.max(w,d));
const ramp=opt.padRamp!==undefined?opt.padRamp:clamp((hMax-hMin)*3,3,10);
addPad(x,z,ry,(opt.padHW!==undefined?opt.padHW:w/2+m2),(opt.padHD!==undefined?opt.padHD:d/2+m2),ramp,floor);
}
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
const wallLen=(o.axis==='x'?o.w:o.d);   // 碰撞带沿脊长取**墙体足迹长**(不含出檐): 檐口是装饰, 不该在墙外形成隐形碰撞
const span=(o.axis==='x'?o.d:o.w)/2+over;
const pitch=Math.atan2(o.rise,span);
const slope=Math.hypot(span,o.rise)+0.12;
const slabs=[], bands=[];
const signs=o.skip!==undefined?[o.skip]:[1,-1];
for(const sgn of signs){
const off=sgn*span/2;
const p=ctx.L(o.axis==='x'?0:off, o.axis==='x'?off:0);
const rm=mesh(boxGeo(o.axis==='x'?ridgeLen:slope, 0.14, o.axis==='x'?slope:ridgeLen), o.mat, p[0], ctx.g0+o.y0+o.rise/2, p[1], ctx.ry, true, true);
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
	// 不传 chain: 轴对齐=单块精确 AABB; 斜置=自动 2D 贴片铺满带宽 —— 旧 chain=1.6 强制单排链,
	// 斜置宽坡面(带宽>1.7)两侧无碰撞, 上坡面走到带缘直接坠穿 (2026-09-12 用户实机: 厂房外坡面无碰撞)
	// 2026-09-20: 带长取 wallLen (不含出檐) —— 檐口在墙外 0.45~0.6m, 撞在塔楼/相邻墙的净空里
	// (实机样本: 教堂大殿坡顶的檐口碰撞带伸进钟塔 0.45m, 二跑楼梯倒数第二步"头顶被挡" 6cm),
	// 而檐口本身是装饰: 玩家在墙外抬头不该撞到看不见的盒子。
	const bandLen=wallLen+0.16;
	const bm=solidBox(o.mat, o.axis==='x'?bandLen:q1-q0+0.08, top-bot, o.axis==='x'?q1-q0+0.08:bandLen, bp[0], ctx.g0+(top+bot)/2, bp[1], ctx.ry);
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
// 屋盖承伤登记 (B2): 碰撞带打 roof 标记 + 按投影面积给血条 —— 直接轰屋顶从此**有效果** (旧版零效果,
// 只能靠"残余承重墙≤2"间接触发; 而平面判据又让"打屋顶"变成"打一楼", 两头都不像在打屋顶)。
// ★ 2026-09-28 用户裁定「不可破坏建筑的房顶也改为不可破坏」: 承伤链只在**有可毁承重墙** (传入 wallGs)
//   的房子上登记 —— 教堂/谷仓/帐篷这类墙体本身是永久件 (wallSeg 默认 destr:false) 的房子, 旧版屋顶却
//   单独拿了血量, 轰几炮就"墙打不烂、顶先塌了", 与"墙恒存"自相矛盾。永久屋盖的碰撞带/坡板原样保留
//   (挡弹/可登踏/ snowCap 不动), 只摘掉血条与 roof 标记 (structSweepNear 不再记账), 并按 B5 永久件档
//   提亮 (与 markPermPieces 同一支材质池, 逐 (材质×档) 克隆; 先标 perm, 那边见到 b.perm 会跳过不二次漂白)。
if(o.wallGs){
roofRefFinalize(ref);
// 支撑墙(含预塌)≤2 面: 建成即塌顶, 不留悬空房顶 (可毁房一般 4 墙, 预塌 1 面后仍 3 面)
if(ref.carry.length<=2) collapseRoof(ref,true);
}else{
for(const m of ref.m) if(m&&m.material) m.material=structMatPerm(m.material);
for(const b of ref.bands){
if(!b||b.dead) continue;
b.perm=1;
if(b.mesh&&b.mesh.material) b.mesh.material=structMatPerm(b.mesh.material);
}
}
return ref;
}
// ===== 建筑框架: 直跑楼梯 =====
// 从 (lx,lz) 沿局部 dir 上行: 步高=ceil((topY-base)/maxRise) 反推, 顶面与 topY 严格齐平(±0)
// dir: 'z+'|'z-'|'x+'|'x-'; o.exit=[lx,lz] 登顶落点(默认直线越过顶踏步), 记入 STAIRS 供验证
const STAIRS=[]; // 楼梯登顶落点登记: 供布局断言 (verify-buildings/verify-layouts) 读取
function stairFlight(ctx,o){
const rise=o.topY-o.base;
const n=Math.max(2,Math.ceil(rise/(o.maxRise||0.42)));
const sr=rise/n;
const tr=o.tread||Math.max(0.5,sr*1.45);
const [dx,dz]= o.dir==='z+'?[0,1]:o.dir==='z-'?[0,-1]:o.dir==='x+'?[1,0]:[-1,0];
const mat=o.mat||MAT.woodDark;
// ── 2026-09-12 v4: 旧观感薄踏步 + 踢面封闭 (v2"实心柱式"废弃: 每步整根砌到 base, 高梯段成实心巨块) ──
// 每步=整步高锯齿盒 (顶面=步面与旧版一致, 底面=前一步顶面, 侧看封闭零缝), 梯段上方净空不受影响;
// 梯脚贴地封堵: foundation 楼面=hMax+raise 而室内地面=原地形, 坡地上楼面比梯脚地表高 0.3~1.4m
// (淞沪丝厂梯脚悬空 ~0.6 即此根因) —— 贴地梯 (base 距梯脚地表≤1.6) 前两级与空隙≤0.7 的步级
// 落到地表封底 (平地视觉基本不变), 其余保持开敞锯齿 (旧版观感, 梯下可作正常净空)
const _foot=ctx.L(o.lx+dx*tr*0.5, o.lz+dz*tr*0.5);
const _toGround=(o.base-heightAt(_foot[0],_foot[1]))<=1.6;
for(let i=0;i<n;i++){
const p=ctx.L(o.lx+dx*((i+0.5)*tr), o.lz+dz*((i+0.5)*tr));
const top=o.base+sr*(i+1);
const sawBot=Math.max(o.base, top-sr); // 步底=前一步顶面; 首步=base
const gh=heightAt(p[0],p[1]);
const bot=(_toGround&&(i<2||sawBot-gh<=0.7))?Math.min(sawBot,gh+0.03):sawBot; // 贴地封底; 高处悬开敞
const bw=dx!==0?tr:o.width, bd=dx!==0?o.width:tr;
const b0=BOXES.length;
const m=solidBox(mat,bw,top-bot,bd,p[0],(top+bot)/2,p[1],ctx.ry);
for(let k=b0;k<BOXES.length;k++) BOXES[k].stair=1;
if(o.parts) o.parts.push({m,b:BOXES.slice(b0)});
}
const ep=ctx.L.apply(ctx, o.exit||[o.lx+dx*(n*tr+0.35), o.lz+dz*(n*tr+0.35)]);
const _fp=ctx.L(o.lx,o.lz), _tp=ctx.L(o.lx+dx*(n-0.5)*tr,o.lz+dz*(n-0.5)*tr);
STAIRS.push({x:ep[0],z:ep[1],topY:o.topY,sr,width:o.width,n,fx:_fp[0],fz:_fp[1],tx:_tp[0],tz:_tp[1]});
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
if(metroBlocked(x,z,w,d)) return true;
if(RIVER&&inRiverChannel(x,z)) return true;
	if(BRIDGE&&onBridge(x,z,6)) return true;
	// 2026-09-19 四面环海: 建筑/瞭望塔一律不得落水或贴水线 (离岸 ≥6m 干陆) ——
	// 环海图的陆地边界不再由图缘限定, 选址必须自己挡住海侧 (非环海战役 SEA=null, 零行为变化)
	if(SEA&&shoreDist(x,z)>-6) return true;
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
// o.noWater=true: 拒绝落进通用水体 (主河/汊港/鱼塘/海面) —— 算法图滨河地块用 (手摆图不传, 零指纹漂移)
// o.strict=true: 8 次重试全败返回 null 而非兜底强放 (2026-09-09 柏林加密批次 ——
//   兜底强放会绕过 B_FOOT 互斥, 把 37m 长街墙压在已有公寓上; 老调用方行为不变)
function placeAt(x,z,ry,w,d,o={}){
for(let t=0;t<8;t++){
const px=x+(t?wr(-2.5,2.5):0), pz=z+(t?wr(-2.5,2.5):0);
const ox=o.ox||0, oz=o.oz||0;
const rxx=px+ox*Math.cos(ry)+oz*Math.sin(ry), rzz=pz-ox*Math.sin(ry)+oz*Math.cos(ry);
if(terrainDelta(px,pz,ry,w,d)>(o.maxDh!==undefined?o.maxDh:1.4)) continue;
if(metroBlocked(rxx,rzz,w,d)) continue; // 地铁站厅/隧道上方禁建 (2026-09-09)
if(SEA&&shoreDist(rxx,rzz)>-6) continue; // 2026-09-19 环海图: 手摆建筑同样不得落水/贴水线
if(o.noWater&&typeof inWaterBody==='function'&&inWaterBody(rxx,rzz)) continue; // 2026-10-07e 算法图水体门
const rect=footRect(rxx,rzz,ry,w,d,1.0);
if(!propFreeRect(rect)) continue; // 同 placeBuild: 手摆建筑也让开道具
if(B_FOOT.some(f=>rectsOverlap(rect,f))) continue;
B_FOOT.push(rect); return {x:px,z:pz,ry};
}
if(o.strict) return null;
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
// 兜底 (2026-09-18b): 强放前先看会不会压已有足迹 —— 旧版"压了也放"会把瞭望塔塞进建筑内部
// (三面环海改版后椰林营区的塔撞进仓库足迹, verify-buildings 抓到)。不重叠时与旧版**逐位一致**
// (其他战役零指纹漂移的前提); 只有确实重叠时才沿环向外找净位 (确定性朝向, 不再消耗随机数)。
const ry=wr(0,TAU);
const rForce=footRect(x+2.8*Math.sin(ry),z+2.8*Math.cos(ry),ry,4.2,9.6,0.8);
if(!B_FOOT.some(f=>rectsOverlap(rForce,f))){ watchtower(x,z,ry); B_FOOT.push(rForce); return false; }
for(let a=0;a<24;a++){
const ang=(a%12)*TAU/12, rr0=4+Math.floor(a/12)*5;
const px=x+Math.sin(ang)*rr0, pz=z+Math.cos(ang)*rr0;
if(spotBlockedBuild(px,pz,0,4,8)) continue;
if(terrainDelta(px,pz,0,4,7.5)>0.9) continue;
const rect0=footRect(px,pz+2.8,0,4.2,9.6,0.8);
if(!propFreeRect(rect0)) continue;
if(B_FOOT.some(f=>rectsOverlap(rect0,f))) continue;
B_FOOT.push(rect0); watchtower(px,pz,0); return true;
}
watchtower(x,z,ry); B_FOOT.push(rForce);
return false;
}
// 道具落点检查: 避开建筑足迹 + 地铁下沉区 (2026-09-09 柏林: 站厅/隧道上方禁止落位 ——
// 该处 heightAt 取到坑底, 道具/树/草会沉入地下; 隧道顶板=街面只走人/车, 不摆物件)
function freeSpot(x,z,r){
if(B_FOOT.some(f=>x>f.x0-r&&x<f.x1+r&&z>f.z0-r&&z<f.z1+r)) return false;
if(typeof METRO_RECTS!=='undefined'){
for(const s of METRO_RECTS){
if(x>s.x0-r&&x<s.x1+r&&z>s.z0-r&&z<s.z1+r) return false;
}
}
return true;
}
// 地铁下沉区禁建 (2026-09-09): 站厅/隧道上方落建筑会悬空/埋进坑底 —— freeSpot 只挡道具/植被,
// 建筑走 placeAt/placeBuild 的另一条校验链, 此处补同一份矩形表
function metroBlocked(x,z,w,d){
if(typeof METRO_RECTS==='undefined') return false;
for(const s of METRO_RECTS){
if(x>s.x0-w/2&&x<s.x1+w/2&&z>s.z0-d/2&&z<s.z1+d/2) return true;
}
return false;
}
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
