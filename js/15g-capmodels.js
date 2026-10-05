// ─────────────────────────────────────────────
// 15g-capmodels.js —— 大舰剪影建模工厂 (2026-09-30 阶段五 P4 批)
// 源: 与 15e-navmodels 同一条"纯程序化几何 + Canvas 贴图"路线, 但**另起一档** ——
//   15e 的 4 型是 15~20m 的小艇 (上限 44 网格/台, 硬约束②) 且带回转炮塔;
//   大舰是 150~170m 的浮岛平台, 件数天然高一档 (见 §八 网格预算), 且有**可行走甲板**与
//   港口级武器组 (多主炮塔 + 副炮 + 防空)。混进 15e 会让那 44 的护栏失真, 故独立成文件。
//
// ══════════════════════════════════════════════════════════════════════
// 一、冻结契约 (§11.2 同档纪律: 任何人不得单方面改动 —— 已有 4 个消费方)
// ══════════════════════════════════════════════════════════════════════
//   capBuildModel(spec) → {
//     grp,                                   THREE.Group
//     turrets:[{yawG,pitchG,barrels:[Mesh],lz,y,ringR,tag}],
//     secMounts:[{yawG,pitchG,barrels,lx,lz,y}],
//     aaMounts:[{yawG,pitchG,barrels,lx,lz,y}],
//     cats:[{grp,x,lz,z0,z1}]                cv 弹射器 (简化起降的起飞位; bb = [])
//     arrest:{z0,z1,hw}                      cv 拦阻区 (触舰钩停判定矩形, 局部坐标; bb = null)
//     nodes:{ funnels:[Object3D], masts:[], props:[], smokeAnchors:[Object3D] }
//     boxes:[{lx,ly,lz,hw,hh,hd,tag,name}]   局部 AABB: 碰撞绕行 + 射线遮挡 + 命中分区 (单源)
//     hull:{r,y0,y1}                         舰体命中胶囊半径 (中心线沿 z 轴全长)
//     deck:{y,hw,hl}                         可行走甲板矩形 (局部)
//     dims:{L,W,H,draft0,deckY}
//   }
//   · grp 原点 = **龙骨** (局部 y=0 即船底), +z = 舰艏, +x = 右舷, y 向上 —— 与 15e/naval 同一约定;
//     水线在局部 y = draft0, 主甲板面在 y = deckY (两者都是 spec 字段, 建模器不另立数)。
//   · 坐标换算单源: 局部→世界 (x' = x·cos + z·sin, z' = −x·sin + z·cos, 见 15h capToWorld),
//     世界里 yaw 的"前向" = (sin yaw, cos yaw), 与 16-aircraft Plane.velVec 同规。
//   · boxes 的 tag 只能取 'hull'|'deck'|'sup'|'tur'|'fun' —— 15h 的装甲倍率表 (spec.armor) 按 tag 取值。
//   · 所有件以 **spec 尺寸实建**, 不做任何整体缩放 (与 15e 硬约束⑥同规)。
// ══════════════════════════════════════════════════════════════════════
// 二、硬约束 (与 15e §二逐条同档)
// ══════════════════════════════════════════════════════════════════════
//   ① 纯程序化几何 + Canvas 贴图; 不 import Loader / 不读图 / 不发 http;
//   ② 不放灯光、不放相机; grp 只进 world (15h 负责);
//   ③ **每艘舰的材质全新一套** (绝不跨舰共享可变材质实例 —— 瘫舰要换残骸材质, 共享会串);
//   ④ 网格预算: 单舰 ≤ 150 网格 (实测见 §八; 同屏大舰 ≤ 4 艘 ⇒ ≤ 600 网格, 与小艇同量级);
//   ⑤ 无 grp.scale; 炮管/桅杆等"可动件"必须挂在 yawG/pitchG 之下 (15h 只转这两级);
//   ⑥ 甲板面 (deck.y) 只在本文件算一次, 15h 的可行走判定与 05c 的旗杆高度都读它 —— 不许另写。
// ══════════════════════════════════════════════════════════════════════

// ── 尺度系数 (无量纲比例; 与 15e 的 NM_* 同族, 只放比例不放尺寸) ──
const CP_HULL=0.70;      // 最宽处位于龙骨以上该比例处 (= 水线附近)
const CP_DECKW=0.86;     // 甲板边缘半宽 / 最大半宽 (舷侧内倾)
const CP_FREE=0.075;     // 主甲板板厚 / 船高
const CP_BARB=0.20;      // 炮座 (barbette) 高 / 船高
const CP_SUPERW=0.44;    // 上层建筑半宽 / 甲板半宽
const CP_SUPERT=0.10;    // 上层建筑壁厚 (m 级常数, 不是比例 —— 视觉件)
const CP_BAR_R=0.042;    // 主炮管半径 = barrelLen × 该值 (史实 406mm 管在 150m 舰上只有 1px;
                         //   刻意加粗到 ~1.7m 直径 —— 舰炮的可辨识度全在管, 细管在交战距离等于没画)
const CP_SEC_R=0.045;    // 副炮管半径系数
const CP_AA_R=0.032;     // 防空管半径系数
const CP_RAIL=0.06;      // 护栏立柱粗细
const CP_DECKLIFT=CAPITAL_CFG.deckLift;  // 甲板铺面相对放样顶缘的抬升 (米) —— **单源在 00-config**:
                         //   载入期 capDeckWorldY (旗杆/弹药箱的甲板基高) 也读它, 两处差 6cm 就是
                         //   "旗杆插在甲板里/箱子悬空"那类对不上。
const CP_SPONSON=0.98;   // 航母舷侧支撑裙板: 裙板在甲板缘之下的收窄比 (甲板缘 × 该值 = 裙板顶宽)

function cpTex(name,alt){ return (typeof TEX!=='undefined'&&TEX[name])||(typeof TEX!=='undefined'&&TEX[alt||'grime'])||null; }

// ── 材质: **每舰全新一套** (硬约束③) ──
function cpMats(S){
const two=S.colT!==S.col;
return {
 hull:new THREE.MeshLambertMaterial({color:S.col,  map:cpTex('steelPlate','grime')}),
 tone:new THREE.MeshLambertMaterial({color:two?S.colT:S.col, map:cpTex('steelPlate','grime')}),
 deck:new THREE.MeshLambertMaterial({color:S.deckCol, map:cpTex('deckWood','grime')}),
 dark:new THREE.MeshLambertMaterial({color:0x2c2f31, map:cpTex('metalBrush')}),
 gun:new THREE.MeshLambertMaterial({color:0x3d434a, map:cpTex('metalBrush')}),   // 炮管: 比件暗一档但比背景亮 (纯黑管在深色海天里读成空洞)
 rust:new THREE.MeshLambertMaterial({color:S.colT, map:cpTex('rust')}),
 side:new THREE.MeshLambertMaterial({color:S.col,  map:cpTex('waterline')}),   // 舷侧水线带 (贴图下缘=污带)
 mark:new THREE.MeshLambertMaterial({color:S.col,  map:cpTex('stencil','grime')}),
 team:new THREE.MeshLambertMaterial({color:cpTeamCol(S)}),
 };
}
function cpTeamCol(S){
try{ if(typeof TEAM_COL!=='undefined'&&TEAM_COL&&TEAM_COL[S.team]!==undefined) return TEAM_COL[S.team]; }catch(e){}
return S.colT;
}

// ── 几何小工具 (与 15e nmBox/nmCyl/nmTube 同形; 私有前缀 cp 避免跨文件重名) ──
function cpBox(p,w,h,d,mat,x,y,z){ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); m.position.set(x,y,z); p.add(m); return m; }
function cpCyl(p,rt,rb,h,seg,mat,x,y,z){ const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg),mat); m.position.set(x,y,z); p.add(m); return m; }
// 管件: 圆柱绕 x 转 90° ⇒ 轴沿 +z (舰艏向)
function cpTube(p,r0,r1,len,seg,mat,x,y,z){ const m=cpCyl(p,r0,r1,len,seg,mat,x,y,z); m.rotation.x=Math.PI/2; return m; }
// 船体断面放样 (复用 15e 的 nmLoft —— 同一支曲面工厂, 同一条绕向契约; 缺 15e 时本文件自带的退化路径见 §七)
function cpLoft(parent,secs,mat,name){
if(typeof nmLoft==='function') return nmLoft(parent,secs,mat,name);
const m=cpBox(parent,1,1,1,mat,0,0,0); m.name=name||'cpLoftStub'; return m;
}

// ══════════════════════════════════════════════════════════════════════
// 三、舰体放样 (bb 与 cv 共用; 差别只在 deckY 与上层)
// ══════════════════════════════════════════════════════════════════════
// 站位表 [t(0=艏 1=艉), w(×最大半宽), k(龙骨 y ×船高), d(甲板 y ×船高)]
//   艏部三站收成尖艏并抬龙骨 (艏斜), 舯部等宽, 艉部收一档后平尾 (战列舰方艉/航母方艉同形)。
//   ★ 断面串必须**沿 −z 递减**排列 (nmLoft 的四边形环绕据此定外法线), 故 t=0 在最前。
const CP_BB_ST=[
 [0.000,0.055,0.62,0.92],[0.045,0.240,0.30,0.99],[0.105,0.520,0.10,1.00],
 [0.185,0.760,0.02,1.00],[0.300,0.930,0.00,1.00],[0.500,1.000,0.00,1.00],
 [0.700,1.000,0.00,1.00],[0.855,0.965,0.02,1.00],[0.945,0.860,0.10,1.00],
 [1.000,0.720,0.26,0.98]];
// 航母: 舯部更长、艏部水下球艏更饱满 (宽体 + 大飞行甲板)
const CP_CV_ST=[
 [0.000,0.070,0.60,0.90],[0.050,0.300,0.24,0.98],[0.120,0.620,0.06,1.00],
 [0.220,0.870,0.00,1.00],[0.360,0.980,0.00,1.00],[0.560,1.000,0.00,1.00],
 [0.760,1.000,0.00,1.00],[0.880,0.980,0.00,1.00],[0.955,0.900,0.05,1.00],
 [1.000,0.780,0.20,0.99]];
// 断面环 (逆时针, 自 +z 看): 艏底中 → 右舷上行 → 右甲板缘 → 左甲板缘 → 左舷下行 → 艉底中
//   顶部**不封** (甲板另铺, 见 cpDeckPlate) ⇒ 环只有 11 点。
function cpSection(w,k,d){
return [
 [0, k],
 [w*0.45, k+(d-k)*0.28],
 [w*0.85, k+(d-k)*0.50],
 [w*1.00, k+(d-k)*CP_HULL],
 [w*0.99, d-(d-k)*0.20],
 [w*CP_DECKW, d],
 [-w*CP_DECKW, d],
 [-w*0.99, d-(d-k)*0.20],
 [-w*1.00, k+(d-k)*CP_HULL],
 [-w*0.85, k+(d-k)*0.50],
 [-w*0.45, k+(d-k)*0.28]];
}
function cpHullSecs(S){
const st=(S.cls==='cv')?CP_CV_ST:CP_BB_ST;
const hw=S.hullW*0.5, out=[];
for(const s of st){
const t=s[0], w=hw*s[1], k=S.hullH*s[2], d=S.hullH*s[3];
out.push([S.hullL*(0.5-t), cpSection(w,k,d)]);
}
return out;
}
// ══════════════════════════════════════════════════════════════════════════
// 三b、舰体表面查询 (2026-10-01 实机修)
// ══════════════════════════════════════════════════════════════════════════
// 实机报"船体左右两边存在意义不明的浮空长方体" —— 根因: 舷侧涂装件 (水线带 / 舷号 / 舷门) 按
//   **最大半宽**写死一个 x (hullW*0.5), 而舰体在艏艉收窄 ⇒ 那几件在中前部悬在舷外 1~2m。
//   修法: 一律按站位表插值求出"该 z 处的舷侧表面", 逐件贴面。**单一出处** = 本段的三个函数,
//   铺面/护栏/涂装件/15h 的可行走半宽全部读它们 (不再有第二套半宽算式)。
function cpHullAt(S,z){
const st=(S.cls==='cv')?CP_CV_ST:CP_BB_ST;
const hw=S.hullW*0.5;
const t=clamp(0.5-z/S.hullL,0,1);
let i=1; while(i<st.length-1&&st[i][0]<t) i++;
const a=st[i-1], b=st[i];
const k=(b[0]>a[0])?clamp((t-a[0])/(b[0]-a[0]),0,1):0;
return { w:hw*(a[1]+(b[1]-a[1])*k), ky:S.hullH*(a[2]+(b[2]-a[2])*k), dy:S.hullH*(a[3]+(b[3]-a[3])*k) };
}
// 舷侧表面 x (局部 z 与局部 y 处, sr=+1 右舷 / −1 左舷): 断面右舷折线逐段线性插值 ⇒ 与放样曲面同面
function cpSideX(S,z,y,sr){
const h=cpHullAt(S,z), w=h.w, k=h.ky, d=h.dy;
const P=[[0,k],[w*0.45,k+(d-k)*0.28],[w*0.85,k+(d-k)*0.50],[w,k+(d-k)*CP_HULL],
         [w*0.99,d-(d-k)*0.20],[w*CP_DECKW,d]];
const yy=clamp(y,k,d);
let x=P[0][0];
for(let i=1;i<P.length;i++){
const y0=P[i-1][1], y1=P[i][1];
if(yy<=y1||i===P.length-1){
const f=(y1-y0>1e-6)?clamp((yy-y0)/(y1-y0),0,1):(yy>y0?1:0);
x=P[i-1][0]+(P[i][0]-P[i-1][0])*f; break;
}
}
return sr*x;
}
// 舷顶半宽 (放样顶缘 = 甲板可铺面的上限): 断面末点 (w×CP_DECKW, d) ⇒ 甲板边缘不得超过它
function cpHullTopHW(S,z){ return cpHullAt(S,z).w*CP_DECKW; }
// 甲板边缘半宽 (局部 z) —— **可行走甲板的单源**:
//   bb: 随舰体收窄 (艏艉甲板跟着舷缘收, 与铺面几何同一张表 ⇒ 铺到哪儿走到哪儿)
//   cv: 全通飞行甲板 = 真矩形 (史实就是外伸的整块甲板, 舷侧由 cpDeckSkirt 的支撑裙板接住)
function cpDeckHW(S,z){
if(S.cls==='cv') return S.deckHW;
return Math.min(S.deckHW, cpHullTopHW(S,z));
}
// ── 三角汤几何构造器 (flat shading) ──
// 为什么手写 BufferGeometry 而不是拼 N 个盒: 甲板铺面/护栏/裙板都是"沿折线的带", 拼盒要几十件
//   (硬约束④ 单舰 ≤150 网格), 而一条带只需要 1 件。★ 法线与 UV 必须自己写: 沙箱的
//   computeVertexNormals 是桩, 离线渲染器 (dev/render-model.js) 直接读 normal 属性 ——
//   不写就是一团黑块 (与 2026-09-28 裙板"数值全绿但整片不可见"同一类坑)。
function cpBuilder(){
const pos=[], nrm=[], uv=[];
const tri=(a,b,c,ua,ub,uc)=>{
const ex=b[0]-a[0], ey=b[1]-a[1], ez=b[2]-a[2];
const fx=c[0]-a[0], fy=c[1]-a[1], fz=c[2]-a[2];
let nx=ey*fz-ez*fy, ny=ez*fx-ex*fz, nz=ex*fy-ey*fx;
const l=Math.hypot(nx,ny,nz)||1; nx/=l; ny/=l; nz/=l;
const put=(p,u)=>{ pos.push(p[0],p[1],p[2]); nrm.push(nx,ny,nz); uv.push(u?u[0]:0,u?u[1]:0); };
put(a,ua); put(b,ub); put(c,uc);
};
const quad=(a,b,c,d,uvq)=>{
tri(a,b,c,uvq&&uvq[0],uvq&&uvq[1],uvq&&uvq[2]);
tri(a,c,d,uvq&&uvq[0],uvq&&uvq[2],uvq&&uvq[3]);
};
const build=(parent,mat,name)=>{
const g=new THREE.BufferGeometry();
g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(pos),3));
g.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(nrm),3));
g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(uv),2));
const m=new THREE.Mesh(g,mat); m.name=name; parent.add(m); return m;
};
// 四点面 + 法线朝向提示: 绕向与 hint 同侧就原样, 反向就反转 —— 沿折线走的墙板/裙板只写一次坐标
const quadN=(a,b2,c,d,hint)=>{
const ex=b2[0]-a[0], ey=b2[1]-a[1], ez=b2[2]-a[2];
const fx=c[0]-a[0], fy=c[1]-a[1], fz=c[2]-a[2];
const cx=ey*fz-ez*fy, cy=ez*fx-ex*fz, cz=ex*fy-ey*fx;
if(cx*hint[0]+cy*hint[1]+cz*hint[2]>=0) quad(a,b2,c,d); else quad(a,d,c,b2);
};
return { tri, quad, quadN, build, n:()=>pos.length/9 };
}

// 甲板铺面 (bb): 沿站位表收窄的**实体薄板** (顶面 + 两舷缘竖面 + 艏艉端面, 1 个网格)。
//   ★2026-10-01 实机修: 旧版是一整块 17.2×144 的矩形盒 —— 舰体在艏艉收窄到 1~7m, 那块矩形甲板
//   于是从艏尖一直"飘"到艉端 (实机:"意义不明的浮空长方体"的第一号), 且可行走矩形也照它算 ⇒
//   人会走到没有任何甲板的海面上再掉下去。现铺面与可行走半宽 (cpDeckHW) 读**同一张站位表**:
//   铺到哪儿才算站在甲板上。cv 不铺主甲板 —— 全通飞行甲板由 cpFlightDeck + cpDeckSkirt 负责。
function cpDeckPlate(R,S,M){
if(S.cls==='cv') return null;
const d=S.deckY+CP_DECKLIFT, th=Math.max(0.12,S.hullH*CP_FREE);
const zs=CP_BB_ST.map(s=>S.hullL*(0.5-s[0]));
const hwv=zs.map(z=>cpDeckHW(S,z));
const V=zs.map((z,i)=>[[hwv[i],d,z],[-hwv[i],d,z],[hwv[i],d-th,z],[-hwv[i],d-th,z]]);
const b=cpBuilder();
for(let i=0;i<zs.length-1;i++){
const A=V[i], B=V[i+1], z0=zs[i], z1=zs[i+1];
const v0=z0/6, v1=z1/6;
b.quad(A[0],B[0],B[1],A[1],[[1,v0],[1,v1],[0,v1],[0,v0]]);          // 顶面 (法线 +y)
b.quad(A[0],A[2],B[2],B[0],[[v0,0],[v0,1],[v1,1],[v1,0]]);          // 右舷缘竖面 (+x)
b.quad(A[1],B[1],B[3],A[3],[[v0,0],[v1,0],[v1,1],[v0,1]]);          // 左舷缘竖面 (−x)
}
b.quad(V[0][0],V[0][1],V[0][3],V[0][2],[[0,0],[1,0],[1,1],[0,1]]);  // 艏端面 (+z)
const e=V.length-1;
b.quad(V[e][0],V[e][2],V[e][3],V[e][1],[[0,0],[0,1],[1,1],[1,0]]);// 艉端面 (−z)
const m=b.build(R.grp,M.deck,'cpDeck');
m.receiveShadow=true;
const lane=cpBox(R.grp, 0.22, 0.03, S.deckHL*1.60, M.mark, 0, d+0.02, 0);
lane.name='cpDeckLine';
return m;
}
// 舷侧涂装 (水线带 / 舷号 / 舷门): **逐件贴面** —— 每件的 x 由 cpSideX 在它自己的 z 上求得。
//   2026-10-01 实机修: 旧版三件都写死 x = ±hullW*0.5, 舰体一收窄就悬在舷外 1~2m (浮空长方体二号)。
function cpDecals(R,S,M){
const b=cpBuilder();
const out=0.035;                                  // 贴面外偏 (躲共面; 远小于 4LSB 深度分层阈值)
// ① 水线带: 沿舷侧 10 段贴面竖片
{
const yb=S.draft0, hb=S.hullH*0.16, N=10, L=S.hullL*0.60, z0=-S.hullL*0.04-L*0.5;
for(const sx of [1,-1]){
for(let i=0;i<N;i++){
const za=z0+i*(L/N), zb=za+L/N;
const ya=yb-hb*0.5, yb2=yb+hb*0.5;
const A=[cpSideX(S,za,ya,sx)+sx*out,ya,za], B=[cpSideX(S,za,yb2,sx)+sx*out,yb2,za];
const C=[cpSideX(S,zb,yb2,sx)+sx*out,yb2,zb], D=[cpSideX(S,zb,ya,sx)+sx*out,ya,zb];
const u=[[i/N,0],[i/N,1],[(i+1)/N,1],[(i+1)/N,0]];
if(sx>0) b.quad(A,B,C,D,u); else b.quad(A,D,C,B,[u[0],u[3],u[2],u[1]]);
}
}
}
// ② 舷号 (艏部舷侧): 一小片贴面竖片
{
const z=S.hullL*0.30, y=S.hullH*0.78, h=S.hullH*0.16, w=S.hullL*0.055;
for(const sx of [1,-1]){
const A=[cpSideX(S,z-w*0.5,y-h*0.5,sx)+sx*out,y-h*0.5,z-w*0.5];
const B=[cpSideX(S,z-w*0.5,y+h*0.5,sx)+sx*out,y+h*0.5,z-w*0.5];
const C=[cpSideX(S,z+w*0.5,y+h*0.5,sx)+sx*out,y+h*0.5,z+w*0.5];
const D=[cpSideX(S,z+w*0.5,y-h*0.5,sx)+sx*out,y-h*0.5,z+w*0.5];
if(sx>0) b.quad(A,B,C,D); else b.quad(A,D,C,B);
}
}
// ③ 舷门 / 机库门: 深色内凹板 (贴面, 且**略微内陷** 0.10 读作门洞)
{
const cv=(S.cls==='cv');
const y=S.deckY-(cv?3.0:1.1), w=S.hullL*(cv?0.10:0.045), h=S.hullH*(cv?0.30:0.13);
const list=cv?[-0.30,-0.02,0.26]:[-0.14,0.12];
for(const sx of [1,-1]) for(const t of list){
const z=S.hullL*t;
const A=[cpSideX(S,z-w*0.5,y-h*0.5,sx)+sx*(out-0.10),y-h*0.5,z-w*0.5];
const B=[cpSideX(S,z-w*0.5,y+h*0.5,sx)+sx*(out-0.10),y+h*0.5,z-w*0.5];
const C=[cpSideX(S,z+w*0.5,y+h*0.5,sx)+sx*(out-0.10),y+h*0.5,z+w*0.5];
const D=[cpSideX(S,z+w*0.5,y-h*0.5,sx)+sx*(out-0.10),y-h*0.5,z+w*0.5];
if(sx>0) b.quad(A,B,C,D); else b.quad(A,D,C,B);
}
}
b.build(R.grp,M.side,'cpSideDecals');
return out;
}
// 护栏 (舷墙 + 顶栏): 沿**甲板真实边缘**的折线, 四周闭合 (1 个网格)。
//   2026-10-01 实机修: 旧版横索按 deckHL*1.9 定长、四角各差 ~1m (实机:"连接不紧密"), 而且是纯视觉件
//   (实机:"没有实际的阻挡作用")。现在 ① 折线首尾落在甲板端角上、艏艉横栏封口 ⇒ 闭合;
//   ② 它的碰撞语义由 15h 的 capPushBody 甲板层分支给出 (乘员被夹在甲板缘内 CAPITAL_CFG.railIn 处,
//   与 railY 的墙高同源) —— 想下舰走 F (capExitNow) / Bot 走脚本化跨域过渡。
function cpRail(R,S,M){
const y0=S.deckY+CP_DECKLIFT, h=CAPITAL_CFG.railY, t=0.10;
const N=16, zs=[];
for(let i=0;i<=N;i++) zs.push(-S.deckHL+i*(S.deckHL*2/N));
const b=cpBuilder();
// 一段墙板: 从 (x0,z0) 到 (x1,z1), yA→yB, 舷外法线 hint=(sx,0,0)。外面+内面+顶面
const seg=(x0,z0,x1,z1,yA,yB,sx)=>{
const o=sx*t*0.5;
b.quadN([x0+o,yA,z0],[x0+o,yB,z0],[x1+o,yB,z1],[x1+o,yA,z1],[sx,0,0]);   // 舷外面
b.quadN([x0-o,yA,z0],[x0-o,yB,z0],[x1-o,yB,z1],[x1-o,yA,z1],[-sx,0,0]);   // 舷内面
b.quadN([x0+o,yB,z0],[x0-o,yB,z0],[x1-o,yB,z1],[x1+o,yB,z1],[0,1,0]);     // 顶面
};
for(const sx of [1,-1]) for(let k=0;k<N;k++){
seg(sx*cpDeckHW(S,zs[k]),zs[k],sx*cpDeckHW(S,zs[k+1]),zs[k+1],y0,y0+h*0.62,sx);
seg(sx*cpDeckHW(S,zs[k]),zs[k],sx*cpDeckHW(S,zs[k+1]),zs[k+1],y0+h*0.92,y0+h,sx);
}
// 艏/艉横栏 (封角): 同一支墙板, 舷外法线换成 ±z
for(const sz of [1,-1]){
const z=sz*S.deckHL, w=cpDeckHW(S,z), o=sz*t*0.5;
const segT=(yA,yB)=>{
b.quadN([-w,yA,z+o],[w,yA,z+o],[w,yB,z+o],[-w,yB,z+o],[0,0,sz]);
b.quadN([-w,yA,z-o],[w,yA,z-o],[w,yB,z-o],[-w,yB,z-o],[0,0,-sz]);
b.quadN([-w,yB,z+o],[-w,yB,z-o],[w,yB,z-o],[w,yB,z+o],[0,1,0]);
};
segT(y0,y0+h*0.62);
segT(y0+h*0.92,y0+h);
}
b.build(R.grp,M.dark,'cpRail');
}
// 航母舷侧支撑裙板 (2026-10-01 实机修: "航母的甲板和下面的船体连接不紧密")。
//   根因: 飞行甲板 (deckY 17.6, 半宽 14) 比舰体放样顶缘 (hullH 15.5, 半宽 ~9.5) 高 2.1m、宽 4.5m ⇒
//   甲板整块悬在舰体上方, 中间既无墙也无支撑 —— 实机就是一块浮着的大平板。
//   修法: 从甲板缘 (±deckHW, 甲板底) 斜拉一片板到舷顶缘 (±cpHullTopHW, hullH), 沿站位逐段收窄:
//   读作机库舷侧 + 外张支撑 (史实航母飞行甲板的外伸段正是靠舷侧/支柱承接的)。
function cpDeckSkirt(R,S,M){
const zs=[], N=16;
for(let i=0;i<=N;i++) zs.push(-S.deckHL+i*(S.deckHL*2/N));
const yTop=S.deckY+CP_DECKLIFT-0.16, yBot=Math.min(S.hullH,S.deckY);
const b=cpBuilder();
for(const sx of [1,-1]) for(let k=0;k<N;k++){
const z0=zs[k], z1=zs[k+1];
const T0=[sx*S.deckHW,yTop,z0], T1=[sx*S.deckHW,yTop,z1];
const B0=[sx*cpHullTopHW(S,z0),yBot,z0], B1=[sx*cpHullTopHW(S,z1),yBot,z1];
b.quadN(T0,T1,B1,B0,[sx,0,0]);           // 舷外面 (甲板外伸段的可见面: 朝舷外偏下)
// 内面内缩 0.10: 与外面共面会在离线渲染里拉出零厚度条纹 (z 相同的两面互相盖)
b.quadN([T0[0]-sx*0.10,T0[1],T0[2]],[B0[0]-sx*0.10,B0[1],B0[2]],[B1[0]-sx*0.10,B1[1],B1[2]],[T1[0]-sx*0.10,T1[1],T1[2]],[-sx,0,0]);
}
b.build(R.grp,M.hull,'cpDeckSkirt');
}

// ══════════════════════════════════════════════════════════════════════
// 四、主炮塔 (bb) —— 炮座 + 塔体 + 炮管; yawG 转塔 / pitchG 抬炮 (15h 只转这两级)
// ══════════════════════════════════════════════════════════════════════
function cpBuildTurret(R,S,M,ringZ,gunY,ringR,idx){
const parent=R.grp;
const yawG=new THREE.Group(); yawG.position.set(0,0,ringZ); parent.add(yawG); yawG.name='cpTurretYaw'+idx;
// 座圈: 固定于舰体 (不随 yaw 转) —— 直接挂舰体, 使"塔转座不转"读得出来
//   ★2026-10-01 实机修: 旧版 ringH = 0.20×船高 (2.5m) 且半径**比塔体还大** ⇒ 甲板上先立一个大鼓,
//   塔体坐在鼓上 (实机读作"立在圆桶上的小盒"); 缩到 0.95 后又与塔体侧面共面 (渲染出 z-fighting 的
//   "圆饼")。真实战列舰的炮座只有甲板开口处一圈唇口, 而塔体本身已经坐进甲板 (底面在甲板下 0.4m) ⇒
//   这一圈没有可见信息量, 直接删件: 塔体从甲板里长出来就是对的读法, 还省 3 个网格。
//   (座圈的"塔转座不转"读法由 boxes 的 tur 盒 + 甲板平面截断表达, 不再另立件。)
// 塔体: 前脸略窄、顶面平的装甲盒 (战列舰炮塔是"方盒子"不是半球)
const tH=Math.max(3.2,S.hullH*0.27), tW=ringR*1.86, tL=ringR*2.05;
const bod=cpBox(yawG, tW, tH, tL, M.tone, 0, gunY-tH*0.5, 0); bod.name='cpTurretBody'+idx;
cpBox(yawG, tW*0.86, 0.28, tL*0.9, M.hull, 0, gunY+0.14, 0).name='cpTurretRoof'+idx;
// 舰桥/测距仪: 后塔背后的小方塔 (bb 三塔里只有超射塔带)
cpBox(yawG, tW*0.34, 1.5, 1.1, M.hull, 0, gunY+0.75, -tL*0.34).name='cpTurretRangef'+idx;
// 炮管: pitchG 之下 (挂点在塔内, 抬炮绕该点)
const pitchG=new THREE.Group(); pitchG.position.set(0,gunY,0); yawG.add(pitchG); pitchG.name='cpTurretPitch'+idx;
const barrels=[];
const barL=S.main.ringR*3.30, barR=barL*CP_BAR_R;
for(let i=0;i<S.main.guns;i++){
const sx=(i-(S.main.guns-1)/2)*S.main.gunSx;
const b=cpTube(pitchG, barR*0.86, barR, barL, 8, M.gun, sx, 0, barL*0.5);
b.name='cpBarrel'+idx+'_'+i;
// 炮口消焰器环 (战列舰主炮无制退器, 但管口有加固环)
cpCyl(pitchG, barR*1.42, barR*1.42, barR*1.1, 8, M.gun, sx, 0, barL-0.05).rotation.x=Math.PI/2;
barrels.push(b);
}
R.turrets.push({ yawG, pitchG, barrels, lz:ringZ, y:gunY, ringR, tag:'tur' });
return {yawG,pitchG,barrels};
}
// ══════════════════════════════════════════════════════════════════════
// 五、副炮 / 防空 (bb 与 cv 共用): 单管/双联/三联/四联小炮座 —— yawG 转座 / pitchG 抬管
//   ★2026-10-01d 实机"航母上的小炮建模简陋": 联装数改由 **spec 单源** (sec.barrels / aa.barrels,
//   缺省 2) —— 航母四联博福斯/三联 25mm 不再与战列舰双联共用一个模; 炮座补座圈平台与弹箱,
//   盾板随联装数加宽 (四联的盾盖得住四根管)。
// ══════════════════════════════════════════════════════════════════════
function cpBuildMount(parent,S,M,md,kind,idx){
const yawG=new THREE.Group(); yawG.position.set(md.lx, md.y, md.lz); parent.add(yawG); yawG.name='cp'+kind+'Yaw'+idx;
const spec=(kind==='sec')?S.sec:S.aa;
const nBar=clamp((spec&&spec.barrels)||2,1,4);
const base=kind==='aa'?0.34:0.62;
cpCyl(yawG, 0.62, 0.70, base, 10, M.tone, 0, -base*0.5, 0).name='cp'+kind+'Base'+idx;
// 座圈平台 + 弹箱 (2026-10-01d): 光杆炮座在甲板/甲板室顶上读作"插了根棍"; 一圈平台 + 一只
//   备弹箱让它读作"有人操炮的火力点" (网格代价 +2/座, aa 8 座 ×2 舰型 ≤32, 仍在预算内)。
//   座圈顶在炮座底之上 7cm (cv 炮座沉入甲板 6cm ⇒ 再往下就埋没了)
cpCyl(yawG, 1.02, 1.02, 0.07, 12, M.dark, 0, -base+0.035, 0).name='cp'+kind+'Ring'+idx;
cpBox(yawG, 0.42, 0.30, 0.56, M.dark, (nBar>1?-0.86:0.72), -base+0.15, 0.18).name='cp'+kind+'Ammo'+idx;
const pitchG=new THREE.Group(); pitchG.position.set(0, 0.06, 0); yawG.add(pitchG); pitchG.name='cp'+kind+'Pitch'+idx;
// 炮盾 (防波盾): 朝前的一张薄板 —— 读作"有人操作的炮位"; 宽度随联装数
const shW=0.30+nBar*0.30, shH=kind==='aa'?0.44:0.66;
const sh=cpBox(pitchG, shW, shH, 0.07, M.tone, 0, kind==='aa'?0.16:0.24, -0.26);
sh.name='cp'+kind+'Shield'+idx;
const len=kind==='aa'?1.30:2.10;
// 管位: 1=中线 / 2=对称对 / 3=三联等距 / 4=四联双排紧贴 (史实四联博福斯是 2×2, 侧视读作两对)
const sxv=nBar===1?[0]:nBar===2?[-0.11,0.11]:nBar===3?[-0.22,0,0.22]:[-0.21,-0.07,0.07,0.21];
const barrels=[];
for(let i=0;i<nBar;i++){
const b=cpTube(pitchG, 0.055, 0.062, len, 6, M.gun, sxv[i], 0.06, len*0.5-0.12);
b.name='cp'+kind+'Barrel'+idx+'_'+i;
barrels.push(b);
}
return { yawG, pitchG, barrels, lx:md.lx, lz:md.lz, y:md.y };
}
// ══════════════════════════════════════════════════════════════════════
// 六、上层建筑
// ══════════════════════════════════════════════════════════════════════
// 战列舰舰桥: tower = 阶梯方塔 (美式) / pagoda = 塔式舰桥 (日式, 层间略有外挑)
function cpBuildSuperBB(R,S,M){
const hw=S.hullW*0.5*CP_SUPERW, h=S.hullH*0.82;
const st=(S.style==='pagoda');
// ① 中部甲板室 (P4 建模修正): 舰桥塔**不是**直接长在主甲板上 —— 真实战列舰主甲板中部有一座低矮的
//   甲板室 (副炮/防空/烟囱都坐在它顶上)。旧版没有它, 于是配置表里的副炮/防空高度全是"悬在半空"的数:
//   甲板上只看得见一排飘着的炮座。甲板室半宽 5.8 < 主甲板半宽 8.6 ⇒ 两侧各留 ~2.8m 走道 (可通行)。
const DH_H=S.hullH*0.19, DH_HW=5.8, DH_Z0=-S.hullL*0.265, DH_Z1=S.hullL*0.158;
{
const dh=cpBox(R.grp, DH_HW*2, DH_H, DH_Z1-DH_Z0, M.hull, 0, S.deckY+DH_H*0.5, (DH_Z0+DH_Z1)*0.5);
dh.name='cpDeckhouse';
cpBox(R.grp, DH_HW*2+0.08, DH_H*0.20, DH_Z1-DH_Z0+0.08, M.dark, 0, S.deckY+DH_H*0.82, (DH_Z0+DH_Z1)*0.5).name='cpDHWin';
R.boxes.push({lx:0, ly:S.deckY+DH_H*0.5, lz:(DH_Z0+DH_Z1)*0.5, hw:DH_HW, hh:DH_H*0.5, hd:(DH_Z1-DH_Z0)*0.5, tag:'sup', name:'cpDeckhouse'});
}
const y0=S.deckY+DH_H;
let y=y0, w=hw*1.30, l=S.hullL*0.30;
// 五层递收 (每层 [宽度比, 高度比]; 轮廓按"塔式舰桥"的经典剖面 —— 下两层是宽甲板室, 上面三层才收成塔,
//   旧版每层等比收窄画成了"婚礼蛋糕"; pagoda 档第 1 层外挑 = 日式舰桥的外张平台)。
//   ★高度比之和 = 1.00 ⇒ 塔顶恰好落在 y0+h (上层建筑总高 h, 与命中的 sup 盒逐位一致)。
const LAY=[ [1.00,0.17], [0.86,0.22], [0.66,0.23], [0.48,0.21], [0.34,0.17] ];
for(let i=0;i<LAY.length;i++){
const lw=w*LAY[i][0], lh=h*LAY[i][1];
const bulge=(st&&i===1)?1.14:1.0;
cpBox(R.grp, lw*bulge*2, lh, l*lw/w, M[i%2? 'tone':'hull'], 0, y+lh*0.5, S.hullL*0.02 - i*0.6).name='cpSup'+i;
// 舷窗带: 每层一圈深色窄条 (读作舰桥层)
cpBox(R.grp, lw*bulge*2+0.06, lh*0.16, l*lw/w+0.06, M.dark, 0, y+lh*0.66, S.hullL*0.02 - i*0.6).name='cpSupWin'+i;
// 舰桥翼台: 第 2/3 层的两舷外伸平台 (战列舰最辨识的一件 —— "舰桥两侧伸出去的耳台")
if(i===1||i===2){
const wh=(l*lw/w)*0.42, ww=lw*0.26;
for(const sx of [1,-1]) cpBox(R.grp, ww, 0.18, wh, M.tone, sx*(lw+ww*0.5), y+lh*0.86, S.hullL*0.02 - i*0.6 - wh*0.4).name='cpSupWing'+i;
}
y+=lh;
}
// 主桅 (三脚式简化为两段 + 横桁) + 雷达天线
cpCyl(R.grp, 0.10, 0.16, h*0.9, 6, M.dark, 0, y+h*0.45, S.hullL*0.02-2.4).name='cpMast';
cpBox(R.grp, 3.2, 0.14, 0.14, M.dark, 0, y+h*0.72, S.hullL*0.02-2.4).name='cpYard';
cpCyl(R.grp, 0.5, 0.5, 0.18, 10, M.dark, 0, y+h*0.90, S.hullL*0.02-2.4).name='cpRadar';
R.boxes.push({lx:0, ly:y0+h*0.5, lz:S.hullL*0.02, hw:hw*1.34, hh:h*0.5, hd:S.hullL*0.15, tag:'sup', name:'cpSup'});
return { top:y+h*0.9, hw:hw*1.34, hd:S.hullL*0.15, cz:S.hullL*0.02 };
}
// 航母舰岛: 右舷长条 (舰桥 + 烟道 + 桅); 飞行甲板的净空由"岛在甲板矩形之外"构造性保证 ——
//   island 中心 lx = deckHW + island 半宽 ⇒ 不侵入可行走矩形 (15h 的甲板矩形判定因此不必挖洞)
function cpBuildSuperCV(R,S,M){
const y0=S.deckY, hw=3.0, h=9.4, cz=-S.hullL*0.06, lz=S.hullL*0.11;
// 岛心 x = 甲板半宽 − 岛半宽 + 0.4 ⇒ 岛**骑在右舷甲板缘上**: 内侧侵入甲板 ~4.6m (真实航母就是这样,
//   岛占掉舷侧一条, 剩下的甲板才作起降), 外侧只探出甲板缘一点点。
//   旧版写 ex = deckHW + hw ⇒ 岛整条悬在甲板之外的半空 (实机是一块浮着的方盒子)。
//   岛在甲板上的占位靠 R.boxes 的 'sup' 盒表达 (15h capLocalSolve 会把行人绕开), 不是"甲板挖洞"。
const ex=S.deckHW-hw+0.4;
cpBox(R.grp, hw*2, h, lz, M.hull, ex, y0+h*0.5, cz).name='cpIsland';
cpBox(R.grp, hw*2+0.10, h*0.20, lz+0.10, M.dark, ex, y0+h*0.70, cz).name='cpIslandWin';   // 舰桥窗带
cpBox(R.grp, hw*1.5, h*0.34, lz*0.62, M.tone, ex, y0+h*0.95, cz-lz*0.16).name='cpIslandTop';// 飞行管制室
// 烟道: 岛后段 (日式向下弯, 美式直立 —— 用一段斜置方管区分)
const fz=cz+lz*0.30;
cpBox(R.grp, hw*0.9, h*0.72, lz*0.22, M.dark, ex, y0+h*1.05, fz + (S.style==='jp'?0.9:0)).name='cpFunnel';
cpCyl(R.grp, 0.09, 0.13, h*0.75, 6, M.dark, ex, y0+h*1.70, cz-lz*0.34).name='cpCVMast';
cpBox(R.grp, 2.6, 0.13, 0.13, M.dark, ex, y0+h*1.94, cz-lz*0.34).name='cpCVYard';
R.boxes.push({lx:ex, ly:y0+h*0.5, lz:cz, hw, hh:h*0.5, hd:lz*0.5, tag:'sup', name:'cpIsland'});
return { top:y0+h*1.94, hw, hd:lz*0.5, cz, ex };
}
// 航母飞行甲板: 铺面带 (甲板木) + 中线跑道 + 弹射器槽 + 拦阻索 + 升降机
function cpFlightDeck(R,S,M){
const d=S.deckY+CP_DECKLIFT, hw=S.deckHW, hl=S.deckHL;
cpBox(R.grp, hw*2, 0.16, hl*2, M.deck, 0, d-0.08, 0).name='cpFlightDeck';
cpBox(R.grp, 0.30, 0.03, hl*1.92, M.mark, 0, d+0.02, 0).name='cpFlightLine';
for(const sx of [1,-1]) cpBox(R.grp, 0.16, 0.03, hl*1.92, M.mark, sx*hw*0.62, d+0.02, 0).name='cpFlightEdge';
// 弹射器: 两条 (艏部左右各一; 简化起降的起飞位 —— 15h 按 cats[0] 弹射)
R.cats=[];
for(const sx of [1,-1]){
const grp=new THREE.Group(); grp.position.set(sx*hw*0.42, d+0.03, 0); R.grp.add(grp); grp.name='cpCat'+((sx>0)?'S':'P');
cpBox(grp, 1.5, 0.06, hl*0.62, M.dark, 0, 0, hl*0.20).name='cpCatTrack';
R.cats.push({ grp, x:sx*hw*0.42, z0:-hl*0.11, z1:hl*0.51 });
}
// 拦阻索: 4 道横索 (触舰钩停区 —— 15h 的 arrest 矩形)
for(let i=0;i<4;i++){
cpBox(R.grp, hw*1.72, 0.05, 0.10, M.dark, 0, d+0.02, -hl*(0.30+i*0.13)).name='cpArrest'+i;
}
// 升降机: 甲板上的矩形边框 (视觉; 不做真升降)
for(const sz of [1,-1]) cpBox(R.grp, hw*0.62, 0.05, hw*0.62, M.tone, -hw*0.30, d+0.02, sz*hl*0.48).name='cpElev';
}

// ══════════════════════════════════════════════════════════════════════
// 七、入口
// ══════════════════════════════════════════════════════════════════════
function capBuildModel(spec){
const S=spec, M=cpMats(S);
const R={ grp:new THREE.Group(), turrets:[], secMounts:[], aaMounts:[],
          cats:[], arrest:null, boxes:[], hull:null, deck:null,
          nodes:{ funnels:[], masts:[], props:[], smokeAnchors:[] }, M, S };
const g=R.grp;
// ① 舰体 (一张连续曲面, 放样) + 舷侧涂装 (水线带/舷号/舷门 —— 逐件贴面)
cpLoft(g,cpHullSecs(S),M.hull,'cpHullUpper');
cpDecals(R,S,M);
// ② 甲板铺面 (bb 收窄实体板 / cv 全通飞行甲板 + 支撑裙板) + 护栏
cpDeckPlate(R,S,M);
// ③ 上层建筑 + 主炮 + 副炮 + 防空
let sup=null;
if(S.cls==='cv'){ cpFlightDeck(R,S,M); cpDeckSkirt(R,S,M); sup=cpBuildSuperCV(R,S,M); }
else sup=cpBuildSuperBB(R,S,M);
if(S.main){
for(let i=0;i<S.main.n;i++){
cpBuildTurret(R,S,M,S.main.ringZ[i],S.main.y[i],S.main.ringR,i);
// 超射塔炮座 (2026-10-01d 实机"大炮塔仍然有浮空的"收官): 炮轴高 y 表对**超射位**塔比主甲板高出一整层
//   (bb 主甲板 12.66, #2 塔底 = y18.6 − 塔高3.4 ≈ 15.2), 而甲板室只到 z≤24 ⇒ z=36 的塔下方没有任何
//   结构, 整座塔悬空 2.5m (高度审计查不出 —— 高度本身"对", 缺的是支撑)。现按"塔底埋进支撑 0.45"
//   (与主甲板上的塔埋深 0.46 同一读法) 补一座圆柱炮座: 自甲板面到塔底+0.45; 塔底已在甲板里的塔
//   (前后两塔) 高度为负 ⇒ 自动跳过, 不加件。
{
const tH=Math.max(3.2,S.hullH*0.27);
const top=S.main.y[i]-tH+0.45, hgt=top-(S.deckY+CP_DECKLIFT);
if(hgt>0.3){
const br=S.main.ringR*0.95;
cpCyl(g, br, br*1.06, hgt, 14, M.tone, 0, S.deckY+CP_DECKLIFT+hgt*0.5, S.main.ringZ[i]).name='cpBarbette'+i;
// 炮座也要挡人/吃伤害 (15h capLocalSolve 与命中盒都读 boxes): 记为 'sup' 装甲区
R.boxes.push({lx:0, ly:S.deckY+CP_DECKLIFT+hgt*0.5, lz:S.main.ringZ[i], hw:br, hh:hgt*0.5, hd:br, tag:'sup', name:'cpBarbette'+i});
}
}
// 命中/绕行盒要**盖住炮座圈** (14 边形座圈半径 = ringR×1.10 ⇒ 半宽取 1.10×ringR, 否则撞座圈边缘)
// part/pi (2026-10-01b 分炮塔血量链): 命中盒直接带**部件身份** —— 15h 的 takeDmg 按它把伤记进
//   该炮位自己的血量 (CAPITAL_SPEC.main.turHp), 不再靠解析 name 字符串 (那是隐式契约, 漂移即静默错账)。
//   ★2026-10-01d: 盒的下沿改到**塔底** (炮轴高−塔高) —— 旧版固定 gunY−2.55, 超射塔塔体下半截
//   不在盒内, 弹从那段塔身穿过去。
{
const tH2=Math.max(3.2,S.hullH*0.27);
const tBase=S.main.y[i]-tH2;
R.boxes.push({lx:0, ly:(tBase+S.main.y[i]+0.15)*0.5, lz:S.main.ringZ[i], hw:S.main.ringR*1.10, hh:(S.main.y[i]+0.15-tBase)*0.5, hd:S.main.ringR*1.10, tag:'tur', name:'cpTurret'+i, part:'main', pi:i});
}
}
}
if(S.sec) for(let i=0;i<S.sec.mounts.length;i++){
const md=S.sec.mounts[i];
R.secMounts.push(cpBuildMount(g,S,M,md,'sec',i));
R.boxes.push({lx:md.lx, ly:md.y+0.2, lz:md.lz, hw:0.7, hh:0.5, hd:0.7, tag:'tur', name:'cpSec'+i, part:'sec', pi:i});
}
if(S.aa) for(let i=0;i<S.aa.mounts.length;i++){
const md=S.aa.mounts[i];
R.aaMounts.push(cpBuildMount(g,S,M,md,'aa',i));
R.boxes.push({lx:md.lx, ly:md.y+0.15, lz:md.lz, hw:0.5, hh:0.4, hd:0.5, tag:'tur', name:'cpAa'+i, part:'aa', pi:i});
}
// ④ 烟囱 (bb 两座: 上层建筑之后的独立烟囱) + 烟源锚点
if(S.cls==='bb'){
for(let i=0;i<2;i++){
const fz=S.hullL*0.02-S.hullL*(0.10+i*0.10);
const fh=S.hullH*0.62, fr=S.hullW*0.085;
cpCyl(g, fr*0.86, fr, fh, 10, M.tone, 0, S.deckY+fh*0.5, fz).name='cpFunnelBB'+i;
cpCyl(g, fr*0.98, fr*1.02, fh*0.14, 10, M.dark, 0, S.deckY+fh*0.93, fz).name='cpFunnelCap'+i;
R.boxes.push({lx:0, ly:S.deckY+fh*0.5, lz:fz, hw:fr, hh:fh*0.5, hd:fr, tag:'fun', name:'cpFunnel'+i});
const an=new THREE.Object3D(); an.position.set(0,S.deckY+fh+0.4,fz); g.add(an); R.nodes.smokeAnchors.push(an);
}
}
if(S.cls==='cv'){
const an=new THREE.Object3D(); an.position.set(sup.ex,sup.top-1.2,sup.cz+sup.hd*0.30); g.add(an); R.nodes.smokeAnchors.push(an);
}
// ⑤ 舷侧护栏 (最后加 —— 护栏立柱在甲板缘, 不挡任何炮界)
cpRail(R,S,M);
// ⑥ 舰体命中胶囊 (中心线沿 z; 半径取半宽 —— 与 15d 的 navalCapsule 同口径, 只是大得多)
R.hull={ r:S.hullW*0.5, y0:0, y1:S.hullH*0.94, ax:0, az:-S.hullL*0.44, bx:0, bz:S.hullL*0.44 };
// ⑦ 甲板矩形 (可行走面单源) —— cv = 全通飞行甲板, bb = 主甲板
R.deck={ y:S.deckY+CP_DECKLIFT, hw:S.deckHW, hl:S.deckHL };
// ⑧ 航母拦阻区 (触舰钩停判定; 局部矩形, 15h 只读)
if(S.cls==='cv') R.arrest={ z0:-S.deckHL*0.72, z1:-S.deckHL*0.20, hw:S.deckHW*0.86 };
R.dims={ L:S.hullL, W:S.hullW, H:S.hullH, draft0:S.draft0, deckY:S.deckY, supTop:(sup?sup.top:S.hullH) };
g.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
return R;
}
