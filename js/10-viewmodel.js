// ─────────────────────────────────────────────
// 10-viewmodel.js —— 第一人称武器动画
// 源: Index.original.html 第 3469-3878 行
// ─────────────────────────────────────────────
'use strict';
const VM = {
root:new THREE.Group(), sway:new THREE.Group(), inner:new THREE.Group(),
	gunParts:null, arms:null, nadeM:null, nadeMs:null, nadeKind:null, knifeM:null, bandageM:null, grabitemM:null, reloadRocket:null,
key:null, state:'idle', stateT:0, stateDur:0,
recoilP:0, recoilV:0, kickZ:0, kickV:0,
swayX:0, swayY:0, bobT:0, lastStepSide:1,
adsBlend:0, sprintBlend:0, crouchO:0,
muzzleFlash:null, muzzleLight:null,
};
vmScene.add(VM.root); VM.root.add(VM.sway); VM.sway.add(VM.inner);
{
const mat=new THREE.SpriteMaterial({map:PT.flash,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false});
VM.muzzleFlash=new THREE.Sprite(mat); VM.muzzleFlash.scale.setScalar(0.16);
VM.inner.add(VM.muzzleFlash);
// 第一人称枪口灯: 夜档作用半径 ×flashRangeMul (昼夜设计 §3.3; 白天 3 逐位不变)
VM.muzzleLight=new THREE.PointLight(0xffc070,0,NIGHT_MODE?3*NIGHT_CFG.flashRangeMul:3);
VM.inner.add(VM.muzzleLight);
}
const HIP={ pos:V3(0.17,-0.185,-0.38), rot:V3(0.02,0.03,0) };
const HIP_PISTOL={ pos:V3(0.15,-0.16,-0.32), rot:V3(0.02,0.02,0) };
const HIP_ROCKET={ pos:V3(0.15,-0.14,-0.56), rot:V3(0.02,0.04,0) };
// 通讯仪 (2026-10-27): 工具件不是枪 —— 枪的 HIP 位姿把"枪身轴"指向正前方, 而对讲机是**立着**拿的。
// 位置压到右下并略远 (0.46m): 整机 0.30m 高 (真实尺度, 见 09-weapons RADIO_H), 贴到步枪那个
// 0.38m 会让机身糊住半个屏幕; 后倾 0.06 + 外旋 0.14 让面板朝向镜头 ⇒ 一眼认出"这是对讲机",
// 天线指向画面中心偏上而不是戳出画面。
const HIP_RADIO={ pos:V3(0.19,-0.30,-0.46), rot:V3(0.06,0.14,0.10) };
function adsPoseFor(key){
const d=WPN_DEFS[key];
// 通讯仪 (2026-10-27): 工具件没有"开镜", 但右键是开指挥地图 (19-input 分流) ⇒ 正常路径到不了 ADS。
// 这里仍给一档"举到胸前细看"的位姿, 兜住触屏/手柄/外部直接置 ads 的路径: 位置比 HIP 抬高一截、
// 机面正对镜头 (rot.y 回 0), 不会像枪那样出现"半张脸埋在枪身里"的怪画面。
if(d.radio) return { pos:V3(0.10,-0.20,-0.40), rot:V3(0.10,0,0.06) };
if(d.rocket) return { pos:V3(0.052,-0.148,-0.3), rot:V3(0,0,0) };
if(d.atRifle) return { pos:V3(0.05,-0.105,-0.28), rot:V3(0,0.05,0) }; // 反坦克枪: 顶部弹匣挡视线, 侧偏机瞄(同火箭筒)
if(d.scoped) return { pos:V3(0,-0.085,-0.22), rot:V3(0,0,0) };
if(d.pistol) return { pos:V3(0,-0.077,-0.24), rot:V3(0,0,0) };
if(key==='mp40') return { pos:V3(0,-0.062,-0.26), rot:V3(0,0,0) };
if(key==='stg44') return { pos:V3(0,-0.076,-0.26), rot:V3(0,0,0) };
if(key==='thompson') return { pos:V3(0,-0.071,-0.26), rot:V3(0,0,0) };
if(key==='bar') return { pos:V3(0,-0.078,-0.26), rot:V3(0,0,0) };
if(key==='kar98'||key==='m1903') return { pos:V3(0,-0.075,-0.3), rot:V3(0,0,0) };
return { pos:V3(0,-0.077,-0.3), rot:V3(0,0,0) };
}
function vmEquip(key,team){
VM.key=key;
if(VM.inner&&VM.inner.children.length){
const keep=new Set([VM.muzzleFlash,VM.muzzleLight,VM.bandageM,VM.grabitemM,VM.hammerM].filter(Boolean));
for(let i=0;i<VM.inner.children.length;i++){
const child=VM.inner.children[i];
if(keep.has(child)) continue;
child.traverse(node=>{
if(node.geometry&&typeof node.geometry.dispose==='function'){
try{ node.geometry.dispose(); }catch(e){}
}
});
}
VM.inner.clear();
}
VM.inner.add(VM.muzzleFlash); VM.inner.add(VM.muzzleLight);
// team 透传 (2026-10-27 通讯仪重做): 阵营配色要按阵营取 (radioPalette 由 FACTIONS[...].coat 派生),
// 而本函数是全库 buildGunModel 的**唯一**调用点 (vmEquip(key,team) 手上就有 team)。其它枪械不使用该参数,
// 传进去是零副作用 —— 但通讯仪的机身主色必须与第三人称同源, 所以这条透传不能省。
VM.gunParts=buildGunModel(key,team);
VM.inner.add(VM.gunParts.gun);
VM.arms=buildArms(team);
VM.inner.add(VM.arms.L); VM.inner.add(VM.arms.R);
// 四弹种手上模型 (2026-09-30 批): 一件一件建好挂在 inner 上, 持雷时按弹种显隐 (vmNadeShow) ——
// 旧版只建阵营档那一件 ⇒ 举烟雾弹/燃烧弹/反坦克雷出手前手里都是普通手雷 (用户报)。
VM.nadeMs={};
for(const k of NADE_KINDS){ const m=buildNadeMesh(k,team); m.visible=false; VM.inner.add(m); VM.nadeMs[k]=m; }
VM.nadeKind=null; VM.nadeM=null;
VM.knifeM=buildKnife(); VM.knifeM.visible=false; VM.inner.add(VM.knifeM);
if(!VM.bandageM) VM.bandageM=buildBandage();
VM.bandageM.visible=false; VM.inner.add(VM.bandageM);
if(!VM.grabitemM) VM.grabitemM=buildGrabItem();
VM.grabitemM.visible=false; VM.inner.add(VM.grabitemM);
if(!VM.hammerM) VM.hammerM=buildHammer();
VM.hammerM.visible=false; VM.inner.add(VM.hammerM);
if(VM.gunParts.reloadRocket) VM.reloadRocket=VM.gunParts.reloadRocket; else VM.reloadRocket=null;
VM.ads=adsPoseFor(key);
VM.state='draw'; VM.stateT=0; VM.stateDur=0.45;
positionHands(key);
AudioSys.metalSlide(0.18,0.1,700,1400);
}
function buildBandage(){
const g=new THREE.Group();
const mat=new THREE.MeshLambertMaterial({color:0xece4d0,map:TEX.cloth}); // B8/P3-12 绷带卷布面
// 绷带卷: 短粗圆柱(轴向z) + 垂下的布条
const roll=new THREE.Mesh(new THREE.CylinderGeometry(0.026,0.026,0.05,12),mat);
roll.rotation.z=HPI; g.add(roll);
const core=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,0.054,8),new THREE.MeshLambertMaterial({color:0xcfc4a8}));
core.rotation.z=HPI; g.add(core);
const tail=bx(mat,0.004,0.07,0.028, 0,-0.055,0.012,g);
tail.rotation.x=0.25;
return g;
}
function buildGrabItem(){
const g=new THREE.Group();
const b=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.06,0.04),new THREE.MeshLambertMaterial({color:0x8a7a5a}));
g.add(b);
bx(vmMats.wood,0.06,0.015,0.03, 0,0.035,0,g);
return g;
}
function buildHammer(){
const g=new THREE.Group();
bx(vmMats.wood,0.022,0.24,0.022, 0,-0.05,0, g);
bx(vmMats.gun,0.045,0.05,0.1, 0,0.075,0, g);
bx(vmMats.gunL,0.024,0.024,0.026, 0,0.075,0.062, g);
return g;
}
// 持枪手位 (2026-10-05 用户实报"左胳膊太靠右, 像右肩上长了两个胳膊"重摆):
//   臂组枢轴在手腕、袖管向 +z (镜头方向) 延伸 0.25m —— rotY≈0 时左袖断口会悬停在画面中偏右,
//   与右臂并排 = "双臂同肩"。左臂修法 = **手不动、袖摆左下**: rotY 拉到 -0.6~-1.0 让袖管斜向
//   画面左下角 (断口出画或贴左缘), 而手心落点用 pivot 反算补偿 (皮肤段在 -z, Ry 负角会把手甩向
//   +x, pivot.x 同量左移抵消), 支撑手仍贴在护木/握把原位。
// 默认握位单源 (2026-10-05 五裁定): 换弹收尾要把手**精确**放回默认握位 (否则松 override 那一帧手弹跳),
//   因此默认握位不能再只存在于 positionHands 的字面量里 —— 这里出数据, positionHands 只做应用。
//   side: 0=右手 1=左手。
// C (2026-11-13): 默认握位缓存 —— positionHands 每帧两次调用, 旧版每次新建 {pos:V3,rot:V3}。
// 返回值全库只读 (position.copy/.set 与 vmPalmOf 读字段, 无写入者), 按 key+side 缓存单例 ⇒ 常态每帧 -6 个分配。
const _vmHandCache={};
function vmHandDefault(key,side){
const ck=key+(side?'|L':'|R');
let c=_vmHandCache[ck];
if(c) return c;
c=vmHandDefaultBuild(key,side);
_vmHandCache[ck]=c;
return c;
}
function vmHandDefaultBuild(key,side){
const d=WPN_DEFS[key]||{};
if(d.rocket) return side? {pos:V3(-0.089,-0.099,-0.16),rot:V3(0.5,-0.95,0)} : {pos:V3(0.01,-0.09,0.16),rot:V3(0.35,0,0)};
if(d.pistol) return side? {pos:V3(-0.103,-0.09,0.082),rot:V3(0.5,-0.6,0)} : {pos:V3(0.015,-0.06,0.13),rot:V3(0.25,0,0)};
// 通讯仪 (2026-10-27): 握位必须贴着**机身**, 不能沿用枪的默认握位 —— 枪的右手位在 z=+0.2 (枪托),
// 而通讯仪机身只有 5cm 厚 (z ±0.026), 照抄会让两只手悬在机子后面 20cm 的空气里。
// 右手握机身下部 (握点 = 建模原点), 左手托在机底偏左 (托举姿态), 左臂 rotY 保持 -0.95 基准带内
// (袖管朝画面左下, 见 vmHandLSnap 的基准 VM_LARM_Y)。
if(d.radio) return side? {pos:V3(-0.055,-0.105,0.02),rot:V3(0.45,-0.95,0)} : {pos:V3(0.012,-0.075,0.015),rot:V3(0.28,0,0)};
return side? {pos:V3(-0.08,-0.075,-0.24),rot:V3(0.5,-1.0,0)} : {pos:V3(0.02,-0.07,0.2),rot:V3(0.32,0,0)};
}
function positionHands(key){
const L=vmHandDefault(key,1), R=vmHandDefault(key,0);
VM.arms.L.position.copy(L.pos); VM.arms.L.rotation.set(L.rot.x,L.rot.y,L.rot.z);
VM.arms.R.position.copy(R.pos); VM.arms.R.rotation.set(R.rot.x,R.rot.y,R.rot.z);
}
function ss(t,a,b){ const x=clamp((t-a)/(b-a),0,1); return x*x*(3-2*x); }
// 当前持的是哪一种 (2026-09-30 批): 四弹种单源 —— 与 22-hud 预演取弹种、18-game releaseNade 分流同一判序
// (at → smoke → incin → frag)。手上模型/预演弹道/出手实弹三者据此对齐, 不许各判一套。
function vmNadeKind(){
if(player.nadeIsAT) return 'at';
if(player.nadeIsSmoke) return 'smoke';
if(player.nadeIsIncin) return 'incin';
return 'frag';
}
function vmNadeShow(kind){
if(!VM.nadeMs) return null;
for(const k in VM.nadeMs) VM.nadeMs[k].visible=false;
const m=VM.nadeMs[kind]||VM.nadeMs.frag;
VM.nadeKind=kind; VM.nadeM=m;
if(m) m.visible=true;
return m;
}
function pulse(t,a,b,c){ return t<b? ss(t,a,b) : 1-ss(t,b,c); }
// 关键帧插值 (2026-10-05 四裁定): 换弹的夹/手路径改锚点表驱动 —— [k,x,y,z,rz] 五元组, 段内
// smoothstep, 终点后保持末锚。多层嵌套 lerp (首版) 已证明写不干净, 废。
// C (2026-11-13): 结果写 _vmKf 槽 —— 同帧至多一个换弹分支在跑, c 在当帧被匣位 set 与 vmHandGun 消费完。
function kfPose(kf,k){
if(k<=kf[0][0]){ const a=kf[0]; _vmKf.x=a[1]; _vmKf.y=a[2]; _vmKf.z=a[3]; _vmKf.rz=a[4]; return _vmKf; }
for(let i=0;i<kf.length-1;i++){ const a=kf[i],b=kf[i+1];
if(k<=b[0]){ const t=ss(k,a[0],b[0]);
_vmKf.x=lerp(a[1],b[1],t); _vmKf.y=lerp(a[2],b[2],t); _vmKf.z=lerp(a[3],b[3],t); _vmKf.rz=lerp(a[4],b[4],t); return _vmKf; } }
const a=kf[kf.length-1]; _vmKf.x=a[1]; _vmKf.y=a[2]; _vmKf.z=a[3]; _vmKf.rz=a[4]; return _vmKf;
}
// 换弹手部姿态 (2026-10-05 五裁定): 掌位 (cam = 道具位 + 抓握偏移) → 中途位 (mid) → 默认握位的两段收束,
//   腕位一律由掌位反解 —— **换弹里手的位置不再手调**。两段收束是必须的: 受弹口 (机匣正上方) 与默认握位
//   (枪托握把) 之间直线回程会犁过枪托跟实拍 (旧版实测 2.1cm 穿模)。
//   b0=出手段 (默认握位→抓握位), b1/b2=收手段 (→mid→默认)。
function vmHoldPose(camx,camy,camz,mid,rAx,rAy,rAz,rotM,b0,b1,b2,key,side){
const def=vmHandDefault(key,side), dp=vmPalmOf(def.pos,def.rot);
const px=lerp(lerp(camx,mid.x,b1),dp.x,b2), py=lerp(lerp(camy,mid.y,b1),dp.y,b2), pz=lerp(lerp(camz,mid.z,b1),dp.z,b2);
const rx=lerp(lerp(rAx,rotM.x,b1),def.rot.x,b2), ry=lerp(lerp(rAy,rotM.y,b1),def.rot.y,b2), rz=lerp(lerp(rAz,rotM.z,b1),def.rot.z,b2);
const qx=lerp(dp.x,px,b0), qy=lerp(dp.y,py,b0), qz=lerp(dp.z,pz,b0);
const sx=lerp(def.rot.x,rx,b0), sy=lerp(def.rot.y,ry,b0), sz=lerp(def.rot.z,rz,b0);
_ovR.pos.copy(vmWristFor(qx,qy,qz,sx,sy,sz));
_ovR.rot.set(sx,sy,sz);
return _ovR;
}
let vmSndFlags={};
function vmResetSndFlags(){ vmSndFlags={}; } // owner 接口 (2026-09-06 B7b/P2-14: 06-engineering 跨文件写改经此)
function vmPlayOnce(id,fn){ if(!vmSndFlags[id]){ vmSndFlags[id]=true; fn(); } }
// ── 换弹: 道具搬运的几何单源 (2026-10-05 五裁定 "空间逻辑"重做) ──────────────────────
// 上一版把"网格相交计数 = 0"当验收目标, 结果三条空间逻辑全错, 实机判"桥夹/漏夹把弹往顶上一怼、
// 手不捏夹、然后弹夹消失" (与最老版无差别):
//   ① 手不捏夹: 夹的路径与手的 override 位各自手调, 掌 (臂组局部 (0,0,-0.09) 的皮肤段) 落点与夹差
//      2-4cm —— 出图实证"拳悬在夹旁 20cm"。**本版不许再手调腕位**: 只给"掌位 = 道具位 + 抓握偏移",
//      腕位由 vmWristFor 反解 (掌心点里程 VM_PALM_L 与 buildArms 同源)。
//   ② 压入被机匣吞掉: 落位取 p0.y-0.026, 而夹半高 0.0275 ⇒ 夹顶只剩 1.5mm 在机匣盖外 —— 视觉上
//      "夹一沉进枪就没了"。**本版落位从模型量**: vmPortPlan 找"道具足迹正下方最高实体面" = 受弹口面,
//      夹坐上去 = 底面沉口面下 5mm 即止 (设计内融合), 整夹仍可见。
//   ③ 镜狙挡道: 镜管/镜座压在受弹口正上方 (kar98zf 管底 0.064 vs 口面 0.050), 全高夹插不进 ⇒ 旧版
//      让它横着从镜管右侧塞进来。**本版改为"落位后退到挡道件之后"** (史实上桥夹正是压在后桥上),
//      挡道件 (管/座/表尺) 的 z 末沿 + 夹半深 = 落位 z。
// 另附一条: 道具的**显/隐只发生在携行位** (腰侧弹袋 = 画面外), 枪身上不许凭空出现/消失 (旧版顶置弹匣
// 在枪上方 18cm 处原地隐、下置弹匣在枪内隐) —— 换匣的"旧匣拿走/新匣拿来"由这条撑起。
const VM_PALM_L=0.09;                 // 掌心点里程 (buildArms 皮肤段中心 local (0,0,-0.09)); 改手模必同步
const VM_BAG=[V3(0.205,-0.150,0.20), V3(-0.235,-0.135,0.16)]; // 携行位 [右手侧, 左手侧] (画面外, 弹袋向)
// ── 2026-11-13 性能批 C: updateViewModel 逐帧分配槽位化 ──
// 动作分支 (换弹/举雷/包扎/近战/锤击/取件) 与 positionHands 每帧新建 override {pos:V3,rot:V3}×2 与
// 关键帧/掌位/腕位对象 —— 全部当帧即时消费 (position.copy / .set 只读字段), 换模块级槽位零分配。
// 跨帧持有者 (g.mag.userData.p0/r0 造型位、VM.ads) 仍走 clone/新建, 不换槽。槽位入参快照纪律:
// 槽写入前先把入参读完 (set/copy 的实参求值先于写回), 同帧多槽共存按消费序分离 (_ovL/_ovR 不互踩)。
const _ovL={pos:V3(0,0,0),rot:V3(0,0,0)};   // 左手 override 槽 (vmHandLFix/vmHandLSnap 左手路径写)
const _ovR={pos:V3(0,0,0),rot:V3(0,0,0)};   // 右手 override 槽 (vmHoldPose/各动作分支写)
const _vmRot={x:0,y:0,z:0};                 // vmRotXyzV 结果槽 (返回即读)
const _vmPalm={x:0,y:0,z:0};                // vmPalmOf 结果槽 (vmHoldPose 的 dp / 包扎 rPalm)
const _vmWr=V3(0,0,0);                      // vmWristFor 结果槽 (返回即读)
const _vmKf={x:0,y:0,z:0,rz:0};             // kfPose 关键帧槽 (当帧消费: 匣位 set + vmHandGun 跟随)
function vmRotXyzV(x,y,z,rx,ry,rz){   // three 默认 XYZ 欧拉序: R = Rx·Ry·Rz
const cx=Math.cos(rx),sx=Math.sin(rx),cy=Math.cos(ry),sy=Math.sin(ry),cz=Math.cos(rz),sz=Math.sin(rz);
const ax=x*cz-y*sz, ay=x*sz+y*cz, az=z;
const bx=ax*cy+az*sy, bz=-ax*sy+az*cy;
_vmRot.x=bx; _vmRot.y=ay*cx-bz*sx; _vmRot.z=ay*sx+bz*cx;
return _vmRot;
}
function vmWristFor(px,py,pz,rx,ry,rz){  // 腕位 = 掌位 - R·(0,0,-VM_PALM_L)  (掌位 → 腕位反解)
const o=vmRotXyzV(0,0,-VM_PALM_L,rx,ry,rz);
return _vmWr.set(px-o.x,py-o.y,pz-o.z);
}
function vmPalmOf(pos,rot){              // 腕位 → 掌位 (默认握位的掌点, 供收尾融回)
const o=vmRotXyzV(0,0,-VM_PALM_L,rot.x,rot.y,rot.z);
_vmPalm.x=pos.x+o.x; _vmPalm.y=pos.y+o.y; _vmPalm.z=pos.z+o.z;
return _vmPalm;
}
// ── 左臂位姿单源 (2026-10-12 用户实报"很多动作左臂仍太靠右, 看起来像长在右肩上") ───────────────
// 病根: buildArms (09-weapons) 的臂组**枢轴在手腕**, 袖管沿手局部 +z (镜头方向) 后延 0.25m。
//   动作分支里的 handLOverride 字面量当年是"腕位 + rotY=0"手调的 ⇒ 袖管正对镜头后方缩成画面中部
//   一团, 而 VM.root 的根姿态 (HIP.pos.x=0.17) 把整个 inner 推到画面右侧 ⇒ 读作"左臂长在右肩上"。
//   2026-10-05 已在**默认握位**上修过 (vmHandDefault 左手 rotY=-1.0), 但各动作分支的覆盖位姿漏改:
//   grab(取弹药)/火箭筒换弹/旧版换匣/建锤/举雷/包扎 六处仍是 rotY=0, 其中包扎还是 **+1.2** (反的)。
// 口径: 左臂 rotY 恒取**负值** (袖管朝画面左下 = 肩端出画或贴左缘), 而**掌心落点逐位不变**。
//   为什么必须"吃掌位反解腕位"而不是直接把 rot.y 改成负角: 臂组枢轴在手腕, Ry 负角会把掌心沿 x 甩出
//   0.09·sin(0.95)≈7cm (手从道具上滑走) —— 反过来由"旧字面量的实际掌位"反解新腕位, 才是"手不动、袖管动"。
const VM_LARM_Y=-0.95;   // 左臂袖管朝向基准 (负 = 画面左下); 单源 = 下面 vmHandLSnap
// ★2026-10-12 袖管归位单源 (两个入口, 同一份数学): 把**已解算好的**左臂位姿的 rotY 拉回基准带,
//   掌心落点逐位不变 (只把袖管转到画面左下, 手不从道具上滑走)。
//   为什么要连 vmHoldPose 解算出来的位姿也过这一道: 左下置弹匣的**物理**换匣 (BAR / 百式 / …) 走
//   `side=1` 的左手持匣路径, 它的 rotY 来自"枪系抓握角 × 收束插值" —— 中途段实测只有 -0.09~-0.24
//   ⇒ 袖管 (肩端) 落在 x=+0.13~+0.17 (画面**右**半), 与用户实报①同款; 而端点段本来就是默认握位
//   (rotY=-1.0, 在带内) ⇒ 归位对端点是恒等映射, 只修中途段。
function vmHandLSnap(pose){
const r=pose.rot;
if(r.y<=-0.6&&r.y>=-1.05) return pose;                // 已在带内: 原样返回 (默认握位/端点零漂移)
const palm=vmPalmOf(pose.pos,r);                      // C: vmPalmOf 只读字段, rot 直传免 V3 (槽 _vmPalm)
const nr=_ovL.rot; nr.set(r.x,VM_LARM_Y,r.z||0);      // C: 归位角写 _ovL.rot (pose 可能即 _ovL, 实参已先读完)
_ovL.pos.copy(vmWristFor(palm.x,palm.y,palm.z,nr.x,nr.y,nr.z));
return _ovL;
}
function vmHandLFix(px,py,pz,rx,ry,rz){       // 旧版字面量 (腕位 + 旧姿态角) → 修正位姿 (C: 标量入参+槽)
_ovL.pos.set(px,py,pz); _ovL.rot.set(rx,ry||0,rz||0);
return vmHandLSnap(_ovL);                     // 非法带 (含 0/正角) 由单源拉回基准 (带内原样返回 _ovL)
}
// ── 动作态终结单源 (2026-10-12 用户实报"读条被打断后模型滞留") ───────────────────────────────
// 病根: 外部 (20-player 的 F 交互/19-input 的按键) 直接改 VM.state 就把当前动作**丢掉**了, 而手上件与
//   手臂显隐的收尾只写在各自状态分支的"正常走完/自己判定被打断"路径里 ⇒ 被抢走的状态永远不执行收尾:
//     包扎 → 绷带卷 (VM.bandageM) 与左臂白色缠臂环 (arms.L.userData.wrap) 永久留在手上;
//     刺刀 → 左臂整条 VM.arms.L.visible=false 永久不还 (nade/build/grab 有各自计时器能自愈, 不在本列)。
// 口径: **任何要抢 VM.state 的入口, 抢之前先调 vmAbortAction()** (幂等, 无害)。它按"当前处于哪个动作态"
//   做收尾并退回 idle; 若只剩残留件 (状态早已被抢走) 也照样把残留件收掉。
function vmBandageHide(){                 // 包扎残留 (手上卷 + 缠臂环), 与状态机无关, 幂等
if(VM.bandageM) VM.bandageM.visible=false;
const w=(VM.arms&&VM.arms.L)?VM.arms.L.userData.wrap:null;
if(w) w.visible=false;
}
// 换弹收尾还原单源 (★2026-10-25 换弹可取消批): 换弹分支会把弹匣/弹夹沿关键帧搬走、枪栓抽开、
//   火箭弹举在半路 —— 自然走完 (nt>=1) 与被取消/被抢走 (vmAbortAction) 必须走**同一份**还原,
//   否则取消后枪上永远缺一只弹匣 (与包扎"绷带卷滞留"同族病)。栓/滑轨静止位走更新循环捕获的 z0
//   (三把手枪 slide 静止位各不同, 不能写死; 捕获口径见 updateViewModel 预捕获段注释)。
function vmReloadRestore(){
const g=VM.gunParts; if(!g) return;
if(g.mag&&g.mag.userData.p0){ g.mag.position.copy(g.mag.userData.p0); if(g.mag.userData.r0) g.mag.rotation.copy(g.mag.userData.r0); g.mag.visible=true; }
if(g.clip&&g.clip.userData.p0){ g.clip.position.copy(g.clip.userData.p0); if(g.clip.userData.r0) g.clip.rotation.copy(g.clip.userData.r0); g.clip.visible=false; }
if(VM.reloadRocket) VM.reloadRocket.visible=false;
if(g.bolt&&g.bolt.userData.z0!==undefined) g.bolt.position.z=g.bolt.userData.z0;
if(g.boltHandle) g.boltHandle.rotation.z=0;
if(g.slide) g.slide.position.z=g.slide.userData.z0??-0.02;
}
function vmAbortAction(){
let hit=false;
if(VM.bandageM&&VM.bandageM.visible){ vmBandageHide(); hit=true; }
const st=VM.state;
// steal = 本轮要抢下状态机的态 (收尾后统一回 idle)。举雷只收**哨兵持雷段** (stateDur>10);
//   出手弧 (松手后 0.55s, nadeHeld 已 false) 里的雷已经/即将脱手, 不属于可中止段, 不在此列。
let steal=false;
if(st==='bandage'){ vmBandageHide(); steal=true; }
else if(st==='melee'){ if(VM.knifeM) VM.knifeM.visible=false; if(VM.arms) VM.arms.L.visible=true; steal=true; }
else if(st==='nade'&&VM.stateDur>10){ if(VM.nadeM) VM.nadeM.visible=false; steal=true; }   // 收雷回枪 (与状态机哨兵自愈同一份收尾)
else if(st==='reload'){ vmReloadRestore(); steal=true; }
if(steal){
if(VM.gunParts&&VM.gunParts.gun) VM.gunParts.gun.visible=true;
VM.state='idle'; VM.stateT=0; VM.stateDur=0; vmSndFlags={};
hit=true;
}
return hit;
}
// ★2026-10-05 六裁定 (抓握偏移): 实机"弹夹穿模卡在右手腕上"的病根 = 掌位偏移量照抄了"手贴住道具"的
//   直觉 (夹 + (0.008,-0.022,-0.038)) —— 拳盒半深 0.05 已越过夹半深 0.03, 夹后半截被拳吞掉、前半截被
//   一袖之隔的袖管顶出 ⇒ 夹像"卡在手腕上"。抓握偏移改成**拳在道具下后方** (拳面贴道具背面 4mm),
//   整只道具露在拳前上方。抓握在根姿态定型后统一解算 (拳姿态随枪的俯仰/滚转)。
let vmHandGun=null;                       // 本帧待解算的抓握 {c, off, grip, mid, midRot, b0, b1, b2, side}
// 受弹口面 + 落位 (从模型量; 返回 {portY, seatZ, hx, hy, hz})
//   portY = 道具 x/z 足迹正下方最高实体面 (机匣盖/机匣/枪身, 各枪不同: mosin 枪身 0.0205 ~ garand 0.0525);
//   seatZ = 若"口面之上"有挡道件 (狙击镜管/镜座/表尺) 与道具的 z 足迹相交 ⇒ 落位后退到它之后, 否则用 p0.z。
function vmPortPlan(g,prop){
if(prop.userData.portPlan) return prop.userData.portPlan;   // 与枪姿态无关 ⇒ 每件只量一次 (vmEquip 重建即失效)
const p0=prop.userData.p0, gp=prop.geometry.parameters||{};
const hx=(gp.width!==undefined?gp.width:(gp.radiusTop||0.04))/2||0.01;
const hy=(gp.height!==undefined?gp.height:0.05)/2;
const hz=(gp.depth!==undefined?gp.depth:(gp.radiusTop||0.04))/2||0.01;
const M=new THREE.Matrix4(), V=new THREE.Vector3(), B=new THREE.Box3();
const xs=hx+0.008;                                 // x 净空带宽 = 半宽 + 8mm (道具实际路径会左右偏一点;
const hits=[];
g.gun.traverse(n=>{
if(!n.isMesh||n===prop||n===g.clip||n===g.mag||n===g.reloadRocket) return;
const chain=[];
for(let a=n;a&&a!==g.gun;a=a.parent){ if(a===g.boltHandle||a===g.reloadRocket) return; chain.push(a); } // 拉机柄/装填道具让开; **枪栓本体要算** (mosin 桥夹就压在栓体上, mosin 枪身顶 0.0205 而栓顶 0.041)
const b=n.geometry.boundingBox||(n.geometry.computeBoundingBox(),n.geometry.boundingBox);
if(!b) return;
M.identity();                                      // G 局部 ← 零件: 走**局部矩阵链** (matrixWorld 供渲染期更新,
for(let i=chain.length-1;i>=0;i--){ chain[i].updateMatrix(); M.multiply(chain[i].matrix); } // 换弹里拿到的是上一帧的) —— 这样零件自带旋转 (横置镜管 rot.x=HPI) 也量得准
B.makeEmpty();
for(let i=0;i<8;i++){ V.set(i&1?b.max.x:b.min.x, i&2?b.max.y:b.min.y, i&4?b.max.z:b.min.z).applyMatrix4(M); B.expandByPoint(V); }
if(B.max.x<=p0.x-xs||B.min.x>=p0.x+xs) return;                  // x 带外 ⇒ 不管 (侧置镜/表尺不约束落位)
if(B.min.z>=p0.z+0.22||B.max.z<=p0.z-0.22) return;              // z 离落位太远 ⇒ 不管
hits.push({x0:B.min.x, x1:B.max.x, y0:B.min.y, y1:B.max.y, z0:B.min.z, z1:B.max.z});
});
// 承托面 = 顶面不高于"造型静止位 +2cm"的最高实体面 (在道具足迹正下方); 高于它的算**挡道件**
//   (狙击镜管/镜座压在口上方, 顶置弹仓的枪上还有提把/表尺), 不能把镜管顶当成"口面"
//   (kar98zf 会算成 0.106 而非机匣盖 0.050)。落位被挡道件向后挤开之后, 承托面按**落位处**重取
//   (mosinpu 桥夹退到镜座之后就压在抽回的枪栓上: 栓顶 0.041 ≫ 枪身顶 0.0205)。
const cap=p0.y+0.02;
const hitsX=[]; for(const h of hits) if(!(h.x1<=p0.x-xs||h.x0>=p0.x+xs)) hitsX.push(h);
const supportAt=z=>{ let t=-1e9;
for(const h of hitsX){ if(h.z1<=z-hz||h.z0>=z+hz) continue; if(h.y1<=cap&&h.y1>t) t=h.y1; }
return t; };
let portY=supportAt(p0.z);
if(portY<-1e8) portY=p0.y;                  // 兜底 (模型没量到承托面: 用造型静止位)
let seatZ=p0.z, bz=-1e9;                    // 挡道件: 落位必须退到**所有**压在口上方的件之后
for(const h of hitsX){
if(h.y0<portY+0.004) continue;            // 没高出受弹口面 ⇒ 不是挡道件
if(h.z1>bz) bz=h.z1;
}
if(bz>-1e8) seatZ=Math.max(p0.z, bz+hz+0.002);
if(seatZ!==p0.z){ const p2=supportAt(seatZ); if(p2>portY) portY=p2; }
// 腹面 (2026-10-05 用户四裁定·镜狙"从枪身下方往上塞"): 道具足迹下**最低底面** = 枪身腹 (枪托底/机匣底),
//   供自下而上的塞入用 —— 只取 min y0 (侧旁的枪栓/挂环底面高, 不会把腹面抬高); 顶面仍走 portY。
const bellyAt=z=>{ let b=1e9; for(const h of hitsX){ if(h.z1<=z-hz||h.z0>=z+hz) continue; if(h.y0<b) b=h.y0; } return b; };
let bellyY=bellyAt(p0.z); if(bellyY>1e8) bellyY=p0.y-0.055;   // 兜底: 量不到胎就用造型静止位下 5.5cm
return prop.userData.portPlan={portY:portY, seatZ:seatZ, hx:hx, hy:hy, hz:hz, bellyY:bellyY};
}
// 弹匣/弹盘/漏斗 换匣搬运 (2026-10-05 五裁定): s=+1 下置弹仓 (下拉抽匣/下方上推), s=-1 顶置 (上提/下压)。
//   时间轴: 抽/提出 (0.08-0.30) → 带到携行位 (0.30-0.44, 画面外, 到此隐) → 新匣自携行位返场 (0.50 同点显)
//   → 送到匣口外 (0.62) → 推入入榫 (0.74 回到模型静止位)。返回当前匣位供持匣手跟随。
function vmMagCarry(g,k,s,side){
const mg=g.mag, p0=mg.userData.p0, r0=mg.userData.r0;
const gp=mg.geometry.parameters||{}, hy=(gp.height!==undefined?gp.height:0.12)/2;
const hz=(gp.depth!==undefined?gp.depth:(gp.radiusTop||0.03))/2;
const out=Math.max(hy,hz)*0.55+0.035;               // 出榫行程: 匣底脱出手能绕过的量 (扁平大件按半径算)
const hs=side?-1:1;                                 // 手侧 (右手 +x / 左手 -x): 抽出/推入时向手侧让开
const dir=-s;                                       // 出榫方向 (+1 上 / -1 下)
const bag=VM_BAG[side];
const KF=[
[0.08, p0.x, p0.y, p0.z, 0],
[0.30, p0.x+hs*0.05, p0.y+dir*out, p0.z+0.02, -dir*0.18],
[0.38, p0.x+hs*0.07, p0.y+dir*(out+0.03), p0.z+0.03, -dir*0.35], // 先沿出榫方向离枪 (上/下 + 向手侧)…
[0.46, bag.x, bag.y+dir*0.03, bag.z, -dir*0.5],                  // …再转携行位 (袋), 到此隐
[0.52, bag.x, bag.y+dir*0.03, bag.z, -dir*0.4],                  // 新匣自携行位同点返场
[0.56, p0.x+hs*0.075, p0.y+dir*(out+0.065), p0.z+0.05, -dir*0.3],// 先举到匣口斜上方 (免得直线回程犁过枪托)
[0.62, p0.x+hs*0.025, p0.y+dir*(out+0.02), p0.z+0.015, -dir*0.15],
[0.74, p0.x, p0.y, p0.z, 0],
];
const c=kfPose(KF,k);
const vis=(k>0.06&&k<0.46)||k>0.52;
mg.visible=vis;
mg.position.set(c.x,c.y,c.z);
mg.rotation.set(r0.x,r0.y,r0.z+c.rz);
return c;
}
function updateViewModel(dt,player){
const d=WPN_DEFS[VM.key]||{};
const w=player.curW;
VM.stateT+=dt;
const t=VM.stateT, T=VM.stateDur, nt=T>0?clamp(t/T,0,1):1;
const adsTgt=(player.ads&&(VM.state==='idle'||VM.state==='fire'||VM.state==='bolt'))?1:0;
VM.adsBlend=dampF(VM.adsBlend,adsTgt,14,dt);
const sprTgt=(player.sprinting&&VM.state==='idle')?1:0;
VM.sprintBlend=dampF(VM.sprintBlend,sprTgt,8,dt);
const hip=d.rocket?HIP_ROCKET:(d.pistol?HIP_PISTOL:(d.radio?HIP_RADIO:HIP));
const px=lerp(hip.pos.x,VM.ads.pos.x,VM.adsBlend);
const py=lerp(hip.pos.y,VM.ads.pos.y,VM.adsBlend);
const pz=lerp(hip.pos.z,VM.ads.pos.z,VM.adsBlend);
let rx=lerp(hip.rot.x,VM.ads.rot.x,VM.adsBlend);
let ry=lerp(hip.rot.y,VM.ads.rot.y,VM.adsBlend);
let rz=0;
rx+=VM.sprintBlend*(d.rocket?0.85:0.5); ry+=VM.sprintBlend*(d.rocket?0.15:0.55); rz-=VM.sprintBlend*(d.rocket?0.05:0.25);
let ox=VM.sprintBlend*(d.rocket?-0.02:-0.04), oy=VM.sprintBlend*(d.rocket?-0.1:-0.05), oz=VM.sprintBlend*(d.rocket?0.06:0.06);
// 蹲/趴/腾空/架设 姿态混合
VM.crouchBlend=dampF(VM.crouchBlend||0,player.crouch?1:0,8,dt);
VM.proneBlend=dampF(VM.proneBlend||0,player.prone?1:0,6,dt);
VM.airBlend=dampF(VM.airBlend||0,player.onGround?0:1,9,dt);
VM.braceBlend=dampF(VM.braceBlend||0,player.braced?1:0,10,dt);
const adsC=1-VM.adsBlend, cb=VM.crouchBlend*adsC, pb=VM.proneBlend, ab=VM.airBlend;
oy-=cb*0.014+pb*0.03*adsC; oz+=cb*0.018+pb*0.03*adsC; rz+=cb*0.05+pb*0.1*adsC; ox-=pb*0.015*adsC;
oy+=ab*0.018; rx-=ab*0.09; rz-=ab*0.04; oz+=ab*0.012;
// 架枪: 枪身沉降贴住支点, 略微外压
const bb=VM.braceBlend;
oz-=bb*0.03; oy-=bb*0.014; rz+=bb*0.028; rx+=bb*0.01; ox+=bb*0.006;
rz+=player.leanT*0.07*(1-VM.adsBlend*0.5); ox+=player.leanT*0.012;
const speed2d=Math.hypot(player.vel.x,player.vel.z);
const moving=speed2d>0.5&&player.onGround;
const bobRate=player.sprinting?11:(player.prone?3:player.crouch?5:7.4);
if(moving) VM.bobT+=dt*bobRate*clamp(speed2d/4.2,0.4,1.6);
const bobA=(moving?1:0)*(player.sprinting?1.7:1)*(1-VM.adsBlend*0.82);
ox+=Math.sin(VM.bobT)*0.011*bobA;
oy+=(-Math.abs(Math.cos(VM.bobT))*0.012+Math.sin(VM.bobT*2)*0.003)*bobA;
rz+=Math.sin(VM.bobT)*0.012*bobA;
const brT=performance.now()*0.001;
const breathMul=((player.holdBreath&&player.ads)?0.12:1)*(1-VM.braceBlend*0.75)*(1-VM.proneBlend*0.5);
oy+=Math.sin(brT*1.4)*0.0022*(1-VM.adsBlend*0.5)*breathMul;
rx+=Math.sin(brT*1.4+0.5)*0.0018*breathMul;
VM.swayX=dampF(VM.swayX,clamp(player.mouseDX,-40,40),10,dt);
VM.swayY=dampF(VM.swayY,clamp(player.mouseDY,-40,40),10,dt);
const swAmt=0.0011*(1-VM.adsBlend*0.75)*(1-bb);
// 常态: 枪随视角拖拽; 架枪: 以前端支点为轴摆动(枪口定住, 枪托随视角甩动)
VM.sway.position.x=-VM.swayX*swAmt+VM.swayX*0.00042*bb;
VM.sway.position.y=VM.swayY*swAmt*0.8;
VM.sway.rotation.y=-VM.swayX*0.0012*bb;
VM.sway.rotation.z=-VM.swayX*0.0006*(1-VM.adsBlend*0.6)*(1-bb*0.8);
VM.sway.rotation.x=VM.swayY*0.0007*(1-VM.adsBlend*0.6)*(1-bb*0.5);
oy-=player.landDip*0.05; rx+=player.landDip*0.12;
VM.recoilV+=(-VM.recoilP*260-VM.recoilV*18)*dt;
VM.recoilP+=VM.recoilV*dt;
VM.kickV+=(-VM.kickZ*220-VM.kickV*16)*dt;
VM.kickZ+=VM.kickV*dt;
rx+=VM.recoilP; oz+=VM.kickZ;
const g=VM.gunParts;
let handLOverride=null, handROverride=null;
// ★2026-10-25 换弹可取消批: 栓 z0 改为**无条件下捕获** (旧版只捕无拉机柄的枪 —— 带拉机柄的栓动枪
//   z0 永远空着, 取消还原时无从归位); slide 三把手枪静止位各不同 (-0.03/0.01/-0.02), 同样捕 z0。
//   捕获发生在 vmEquip 后第一帧 (draw 态, 部件都在静止位) ⇒ 值恒为真静止位, 之后各分支的位移在其后执行不受影响。
if(g.bolt) g.bolt.position.z=g.bolt.userData.z0??(g.bolt.userData.z0=g.bolt.position.z);
if(g.slide) g.slide.userData.z0??(g.slide.userData.z0=g.slide.position.z);
if(g.mag){ g.mag.userData.p0??(g.mag.userData.p0=g.mag.position.clone()); g.mag.userData.r0??(g.mag.userData.r0=g.mag.rotation.clone()); }
if(g.clip){ g.clip.userData.p0??(g.clip.userData.p0=g.clip.position.clone()); g.clip.userData.r0??(g.clip.userData.r0=g.clip.rotation.clone()); }
if(VM.state==='draw'){
const k=1-ss(nt,0,1);
oy-=k*0.25; rx+=k*0.9; rz+=k*0.3;
if(nt>=1) VM.state='idle';
}
else if(VM.state==='melee'){
const k=pulse(nt,0,0.35,1);
VM.knifeM.visible=true; g.gun.visible=false;
VM.arms.L.visible=false;
VM.knifeM.position.set(0.1-k*0.22,-0.12+k*0.06,-0.25-k*0.28);
VM.knifeM.rotation.set(-k*1.1,0.3-k*0.5,k*0.4);
handROverride=_ovR, handROverride.pos.set(0.1-k*0.2,-0.16+k*0.05,-0.1-k*0.2), handROverride.rot.set(0.4-k*1.0,0,0);
if(nt>0.3) vmPlayOnce('meleeHit',()=>player.doMeleeHit());
if(nt>=1){ VM.state='idle'; VM.knifeM.visible=false; g.gun.visible=true; VM.arms.L.visible=true; vmSndFlags={}; }
}
else if(VM.state==='nade'){
// 弹种 → 手上模型 (2026-09-30 批): 进 'nade' 态与持雷期间弹种变了就换件。VM.nadeM 恒指向**当前展示**的
// 那一件 —— 外部 (20-player 自爆清枪 / 本文件哨兵自愈) 只写 VM.nadeM.visible=false, 语义不变。
const nk=vmNadeKind();
if(VM.nadeKind!==nk) vmNadeShow(nk);
const shown=VM.nadeM;
shown.visible=true; g.gun.visible=false;
// 哨兵态自愈 (★2026-09-26 修): "按住 G 持雷"是 stateDur=999 的哨兵态, 只由"松开 G" (19-input 置 0.55)
// 推进。而**外部**摘掉 nadeHeld 的路径不少 (上坦克 20-player:197 / 上艇 / 上炮位 / 上迫击炮都会
// player.nadeHeld=false), 它们一个都不复位 VM ⇒ 状态机卡死在 'nade' 上: nt=t/999 永不达 1,
// 于是手中一直握着雷、枪一直收不回来、也开不了火, 直到 999 秒后凭空"扔"出去 (同型事故在
// 19-input 的岸防炮门卫注释里已有先例: "下炮那一帧状态机复活 ⇒ 立刻扔出一颗活雷")。
// 这里补一条兜底: 哨兵态下发现手里已经没有雷 ⇒ 直接回 idle, **不触发投掷** (没松键就不是投掷)。
if(!player.nadeHeld&&VM.stateDur>10){ VM.state='idle'; shown.visible=false; g.gun.visible=true; vmSndFlags={}; }
else if(player.nadeHeld){
const k=ss(Math.min(t,0.3),0,0.3);
shown.position.set(0.14,-0.12+k*0.04,-0.3+k*0.05);
shown.rotation.set(0,0,0);
handROverride=_ovR, handROverride.pos.set(0.13,-0.15,-0.22), handROverride.rot.set(0.5,0,0);
handLOverride=vmHandLFix(-0.1,-0.2,-0.2,0.3,0,0);
} else {
const k=nt;
const back=pulse(k,0,0.3,0.55), fwd=ss(k,0.35,0.6);
shown.position.set(0.14+back*0.1,-0.08+back*0.16-fwd*0.1,-0.3+back*0.25-fwd*0.55);
shown.visible=k<0.55;
handROverride=_ovR, handROverride.pos.set(0.13+back*0.08,-0.12+back*0.14-fwd*0.18,-0.18+back*0.2-fwd*0.35), handROverride.rot.set(0.5+back*1.2-fwd*2.2,0,0);
if(k>0.5&&!VM.mirrorHost) vmPlayOnce('nadeThrow',()=>player.releaseNade());   // ★2026-11-03: 镜像态不出真雷 (真附身举雷镜像只走哨兵段, 本行是兜底保险)
if(nt>=1){ VM.state='idle'; g.gun.visible=true; shown.visible=false; vmSndFlags={}; }
}
}
  else if(VM.state==='reload'){
    const k=nt;
    const dip=pulse(k,0,0.15,0.92);
    if(!d.rocket){ rx+=dip*0.32; ry+=dip*0.18; oy-=dip*0.05; rz+=dip*0.1; }
    if(d.rocket){
      // 火箭筒装填: 筒身前倾抬起露出尾部开口 -> 右手取弹对准尾口 -> 沿轴线推入 -> 拍筒
      const tip=pulse(k,0.04,0.22,0.8);
      rx+=tip*0.5; ry-=tip*0.06; rz+=tip*0.06; oz-=tip*0.14; oy-=tip*0.02;
      const rr=g.reloadRocket;
      const fetch=ss(k,0.16,0.42);
      const insert=ss(k,0.46,0.68);
      if(rr){
        rr.visible=k>0.14&&k<0.72;
        rr.position.set(
          lerp(0.2,0,fetch),
          lerp(-0.24,0.058,fetch),
          lerp(0.78,0.64,fetch)-insert*0.4
        );
        rr.rotation.set(lerp(0.55,0,fetch),0,lerp(-0.3,0,fetch));
      }
      if(k>0.16) vmPlayOnce('rrk1',()=>AudioSys.metalSlide(0.14,0.12,400,900));
      if(k>0.46) vmPlayOnce('rrk2',()=>AudioSys.metalSlide(0.18,0.16,600,1200));
      if(k>0.66) vmPlayOnce('rrk3',()=>AudioSys.click(1100,0.3,0.05));
      if(k>0.78) vmPlayOnce('rrk4',()=>AudioSys.metalSlide(0.2,0.08,1400,700));
      handLOverride=vmHandLFix(-0.04,-0.09,-0.24,0.42,0,0);
      if(k<0.74&&rr){
        handROverride=_ovR, handROverride.pos.set(rr.position.x+0.015,rr.position.y-0.05,rr.position.z+0.13), handROverride.rot.set(-0.5+fetch*0.15-insert*0.25,0,0);
      } else {
        const pat=Math.max(0,Math.sin((k-0.74)*24))*ss(k,0.74,0.78)*(1-ss(k,0.88,0.96));
        handROverride=_ovR, handROverride.pos.set(0.05,-0.04-pat*0.05,-0.1), handROverride.rot.set(-0.2-pat*0.5,0,0);
      }
    } else if(d.enbloc){
// ── M1 加兰德漏夹 (2026-10-05 六裁定 = 拳位改下后方 + 真受弹口) ──────────────────
// 实机第二批判 "弹夹穿模卡在右手腕上 + 从步枪枪机正上方硬塞入", 两条都是空间逻辑:
//   ① 拳位: 旧偏移 (夹+(0.008,-0.022,-0.038)) 把拳**套在夹外**: 拳盒 (半深 0.05) 越过夹 (半深 0.03)
//      ⇒ 夹后半在拳里、前半顶着袖管 ⇒ "卡在手腕上"。本版拳在夹**下后方**, 拳面贴夹背 4mm。
//   ② 机匣顶是实心板 ⇒ 夹怎么落位都是"穿"机匣顶。本版机匣开**真受弹口** (见 09-weapons garand 支),
//      夹是**沉进口里**的: 压入段夹底进口 3cm, 拳底压到口沿即止 (拳不进枪, 夹不入拳)。
// 史实链: 取夹 → 举到口上 → 压进仓 3cm → 手撤离 ("加兰德拇指") → 枪栓复进把夹推到底。
const openK=ss(k,0.05,0.18), closeK=ss(k,0.66,0.78);
if(g.bolt) g.bolt.position.z=(g.bolt.userData.z0??-0.02)+(openK-closeK)*0.08;
if(k>0.08) vmPlayOnce('r2',()=>AudioSys.metalSlide(0.25,0.09,1000,1800));
if(k>0.58) vmPlayOnce('r3',()=>AudioSys.click(1500,0.3,0.04));
if(k>0.72) vmPlayOnce('r4',()=>AudioSys.metalSlide(0.3,0.07,1400,900));
const roll=pulse(k,0.05,0.2,0.74);
rz+=roll*0.20; ry+=roll*0.03;   // 枪往镜头一侧滚: 把受弹口面转向观察者 (旧版滚反了, 口面背对镜头)
if(g.clip){
const pl=vmPortPlan(g,g.clip);
const hy=pl.hy, hz=pl.hz, rim=pl.portY, sz=pl.seatZ;
const pressY=rim+hy-0.030;    // 压入: 夹底沉进口内 3cm (拳底正好压到口沿)
const homeY=rim-hy-0.028;     // 枪栓复进推到底: 夹顶没到仓底之下 (整夹进枪 ⇒ 就地隐形)
const KF=[
[0.10, 0.205,-0.150, 0.200,-0.85],             // 携行位 (袋): 夹在手里, 自画面右下入画
[0.30, 0.095, rim+0.100, sz+0.055,-0.42],      // 举到枪右前上方 (清过机匣/表尺)
[0.44, 0.014, rim+hy+0.034, sz+0.030,-0.14],   // 收到受弹口斜上方对正 (夹底离口沿 3.4cm)
[0.50, 0.000, rim+hy+0.014, sz+0.006,-0.06],   // 落到口沿正上方 (x 先收回中: 夹比仓口只窄 6mm)
[0.60, 0.000, pressY, sz,-0.03],               // **压入**: 夹底沉进口内 3cm
[0.66, 0.000, pressY-0.004, sz,-0.03],         // 最后按一下 (卖力)
[0.84, 0.000, homeY, sz, 0],                   // 枪栓复进把夹推到底 (整夹进枪)
];
const c=kfPose(KF,k);
g.clip.visible=k>0.12&&k<0.84;
g.clip.position.set(c.x,c.y,c.z); g.clip.rotation.set(0,0,c.rz);
const pr=ss(k,0.50,0.62);
oy-=pr*0.012; rx+=pr*0.018;
// 抓握 (枪系): 拳在夹的**下后方** —— 拳面贴夹背 4mm 设计内融合, 夹整只露在拳前上方; 拳底到口沿即止。
vmHandGun={c:c, off:[0.010,-0.016,hz+0.046], grip:[0.30,0.30,0],
mid:{x:0.155,y:-0.045,z:0.075}, midRot:{x:-0.10,y:0.25,z:0},
b0:1, b1:ss(k,0.58,0.72), b2:ss(k,0.78,0.92), side:0};
}
    } else if(d.type==='bolt'){
// ── 栓动桥夹 (2026-10-05 五裁定 = 空间逻辑重做) ─────────────────────────────────
// 史实链: 手自弹袋取夹 → 举到受弹口**上方** → 夹压进仓 (弹入匣) → 空夹捏在手里撤走 → 关栓。
// 改前病: 落位 p0.y-0.026 (夹顶只剩 1.5mm 在机匣盖外, 一压就"消失") + 腕位手调 (手不捏夹) +
// 夹悬在口上滑过不进仓 (上一版为刷"0 穿模"而设)。本版落位/落位 z 由 vmPortPlan 从模型量
// (镜狙自动退到镜管之后 = 机匣后桥, 史实上桥夹正是压在那里), 空夹"提起→撇向右下→携行位才隐"。
const openK=ss(k,0.05,0.2), closeK=ss(k,0.7,0.84);
if(g.boltHandle) g.boltHandle.rotation.z=(openK-closeK)*-1.1;
if(g.bolt) g.bolt.position.z=(g.bolt.userData.z0??0.05)+(openK-closeK)*0.09;
if(k>0.08) vmPlayOnce('r1',()=>AudioSys.metalSlide(0.22,0.1,800,1500));
if(k>0.58) vmPlayOnce('r2',()=>AudioSys.click(1300,0.28,0.04));
if(k>0.72) vmPlayOnce('r3',()=>AudioSys.metalSlide(0.25,0.09,1500,800));
const scoped=!!d.scoped;
// 滚转 + 俯仰 (俯仰才是"看得见机匣盖口面"的来源, 滚转只是转屏面)。镜狙 2026-10-05 四裁定后改走
//   "从枪身下方往上塞" (见下), 不再需要把受弹口摆向镜头 —— 滚转收成轻微侧倾 (不得再大幅翻滚),
//   顺手把枪身腹面侧给镜头; 非镜枪仍自上压入, 滚转维持原量。
const roll=pulse(k,0.06,0.2,0.86);
rz-=roll*(scoped?0.32:0.3); ry+=roll*0.05; rx+=roll*0.03; ox-=roll*(scoped?0.008:0.006);
if(g.clip){
const pl=vmPortPlan(g,g.clip);
if(scoped){
// ── 镜狙: 从枪身下方往上塞 (2026-10-05 用户四裁定) ─────────────────────────────────
// 镜管横压在受弹口正上方 (kar98zf 管底 0.064 vs 口面 0.050), 桥夹自上压不进 —— 史实狙击型也多为
//   单发装填; 用户裁定: 不走上面, 改"自枪身下方往上塞": 夹自画面右下 (弹袋) 沿枪身右下缘上升 →
//   收到弹仓口正下方 → 贴着腹面**上顶**: 夹顶先进枪身、依枪体自遮挡逐步没入 (不是瞬移消失), 整只
//   没入即隐形; 拳**在夹正下方**顶夹底上推, 到腹面即停 (指节不进枪身)。此路彻底绕开镜管与
//   "从正上方硬塞"的观感。腹面/没入深度从模型量 (vmPortPlan.bellyY)。
const hy=pl.hy, belly=pl.bellyY, ez=g.clip.userData.p0.z-0.12;   // 受弹位置 = 机匣稍前的**弹仓口**
// (夹的造型静止位在机匣后桥; 后桥正下方离镜头太近、它在画面里的投影正好落在画面下缘之下 —— 出图
//  实证整段动作在画外。前移 12cm 到弹仓位置: 既合弹匣该待的地方, 又因离镜头更远而抬进画面。)
const touchY=belly-hy;             // 上顶起点: 夹顶贴到枪身腹面 (弹仓口)
const inY=belly+0.030;             // 上顶终点: 夹底沉到腹面内侧 2.5mm ⇒ 整只被枪体遮住
const KF=[
[0.12, 0.205,-0.150, 0.200,-0.55],              // 携行位 (画面右下·弹袋)
[0.32, 0.120,-0.135, 0.060,-0.30],              // 沿枪身右下缘上升到腹下外侧
[0.46, 0.030, touchY-0.032, ez+0.014,-0.10],    // 收到弹仓口正下方 (夹顶离腹面 3.2cm)
[0.54, 0.002, touchY, ez,-0.03],                // 贴到枪身腹面 (弹仓口)
[0.58, 0.001, touchY+0.006, ez,-0.03],          // 顶紧 (卖力一下: 夹顶已进仓口)
[0.70, 0.000, inY, ez, 0],                      // **上顶进枪身** (整只没入)
];
const c=kfPose(KF,k);
g.clip.visible=k>0.14&&k<0.70;
g.clip.position.set(c.x,c.y,c.z); g.clip.rotation.set(0,0,c.rz);
// 抬枪 (2026-10-05 出图实证): 枪身腹面在画面下缘之下, 不抬枪则"手+夹自画面下方上来"整段在画外
//   (只有夹顶一条黄边擦到下缘)。换弹期把枪整体抬起 (同包扎态"整体抬高到视野中部"的手法), 收尾
//   自己落回 —— 根姿态抬升把枪/双臂一起带走, 左握把手不会脱手; 夹的枪系坐标不受影响。
const lift=ss(k,0.14,0.34)-ss(k,0.72,0.90);
oy+=lift*0.070;
const pr=ss(k,0.54,0.70);
oy-=pr*0.012; rx+=pr*0.018;     // 上顶到位那一下的抵肩反馈
if(k>0.66) vmPlayOnce('r2b',()=>AudioSys.click(1500,0.3,0.04));
// 抓握: 拳在夹**正下方** (掌面朝上贴夹底 4mm) —— 夹升过腹面后拳停在腹面下 (指节不进枪身)。
vmHandGun={c:{x:c.x, y:Math.min(c.y, belly+hy), z:c.z}, off:[0.012,-(hy+0.030),pl.hz*0.45], grip:[0.18,0.28,0],
mid:{x:0.135,y:-0.075,z:0.060}, midRot:{x:0.10,y:0.30,z:0},
b0:1, b1:ss(k,0.70,0.83), b2:ss(k,0.83,0.96), side:0};
} else {
const seatY=pl.portY+pl.hy-0.005, hoverY=pl.portY+pl.hy+0.032, sz=pl.seatZ;
const KF=[
[0.10, 0.205,-0.150, 0.20,-0.9],                // 携行位 (袋): 夹已在手中
[0.30, 0.105, pl.portY+0.105, sz+0.055,-0.42],  // 举到枪右前上方 (高出受弹口, 清过机匣)
[0.44, 0.014, hoverY, sz+0.012,-0.16],          // 移到受弹口正上方
[0.57,-0.006, seatY, sz,-0.08],                 // **压入口**: 底面沉进口面 5mm (略偏左: 让开枪栓本体)
[0.67,-0.006, seatY-0.008, sz,-0.08],           // 压到底 (再沉 8mm)
[0.78, 0.055, pl.portY+pl.hy+0.045, sz+0.015,-0.34], // 空夹提起 (仍捏在手里)
[0.90, 0.205,-0.150, 0.20,-0.85],               // 撇向右下, 到携行位出画 ⇒ 隐形
];
const c=kfPose(KF,k);
g.clip.visible=k>0.12&&k<0.90;
g.clip.position.set(c.x,c.y,c.z); g.clip.rotation.set(0,0,c.rz);
const pr=ss(k,0.52,0.62);
oy-=pr*0.012; rx+=pr*0.018;
// 抓握 (枪系, 2026-10-05 六裁定同加兰德): 拳在夹的下后方, 拳面贴夹背 4mm —— 夹整只露在拳前上方;
// 0.78 起撤手 (提起→托颈上方→握把, 两段)。抓握偏移见 vmHandGun 单源 (拳在夹下后方)。
vmHandGun={c:c, off:[0.010,-0.016,pl.hz+0.046], grip:[0.30,0.30,0],
mid:{x:0.145,y:-0.030,z:0.085}, midRot:{x:-0.10,y:0.25,z:0},
b0:1, b1:ss(k,0.78,0.88), b2:ss(k,0.88,0.97), side:0};
}
    } else if(g.mag){
// 无桥夹的顶置弹仓 (博斯/PTRD 反坦克枪等): 上提出匣 → 新匣自上方压入 (走 vmMagCarry 搬运单源)
const c=vmMagCarry(g,k,-1,0);
const gp0=g.mag.geometry.parameters||{}, mhz=(gp0.depth!==undefined?gp0.depth:(gp0.radiusTop||0.03))/2;
vmHandGun={c:c, off:[0.026,-0.010,mhz+0.046], grip:[0.30,0.30,0],
mid:{x:0.06,y:0.12,z:0.13}, midRot:{x:-0.24,y:0.34,z:0},
b0:ss(k,0.03,0.14), b1:ss(k,0.76,0.88), b2:ss(k,0.88,0.97), side:0};
if(k>0.62) vmPlayOnce('r3',()=>AudioSys.click(1400,0.3,0.05));
}
} else {
// 弹匣类 (2026-10-05 用户二次裁定分流):
//   手枪/冲锋枪/卡宾 (d.vmLegacy) = **完全回调旧版**快速换匣: 下拉 0.18 → 短隐 → 自下方推入,
//   左手固定辅位。首版"携匣大回环"(出匣 0.42/入榫 0.5, 弹匣甩出一根枪长) 实机判浮夸, 整体撤销;
//   驳壳枪桥夹压弹动画连带回撤 (弹夹排道具件一并删)。
//   机枪/反坦克枪 (topmag/pan/hopper/atr) 与 BAR 等下置弹仓保留重做后的物理路径 (顶置上抛上压 /
//   下置下拉下推, 走 vmMagCarry 单源): 旧版"顶置弹匣沉进机匣再从枪身里升回来"是用户立项要修的
//   反物理, 不随本轮回调。
const mp0=g.mag?g.mag.userData.p0:null;
if(d.vmLegacy){
const p0=mp0;
const out=pulse(k,0.08,0.3,0.34), inn=ss(k,0.42,0.66);
if(g.mag&&p0){
g.mag.position.set(p0.x, p0.y-out*0.18-(1-inn)*(k>0.36?0.18:0), p0.z+out*0.03);
g.mag.visible=!(k>0.34&&k<0.4);
}
if(k>0.06&&k<0.7) handLOverride=vmHandLFix(-0.01,-0.1-out*0.15-(1-inn)*(k>0.36?0.15:0),-0.13,0.5,0,0);
else if(k>=0.7&&k<0.97) handLOverride=vmHandLFix(0.02,-0.02,-0.05,0.3,0,0);
} else if(g.mag&&mp0){
// 机枪/反坦克枪/弹盘/漏斗/BAR (非 vmLegacy): 走 vmMagCarry 搬运单源 —— 提/抽出榫 → 带到携行位
// (画面外, 到此隐) → 新匣自携行位返场 → 送到匣口外 → 推入入榫。旧版把"显/隐"做在枪身上
// (顶置匣在枪上方 18cm 处原地隐、下置匣在枪体内隐) ⇒ 观感"弹匣飞出去凭空没了"。
const top=(d.wg==='topmag'||d.wg==='pan'||d.wg==='hopper'||d.wg==='atr');
const s=top?-1:1, side=top?0:1;   // 顶置 = 右手上提 / 下置 = 左手下拉 (与旧批同一手序, 免得又换观感)
const c=vmMagCarry(g,k,s,side);
const gp=g.mag.geometry.parameters||{}, mhz=(gp.depth!==undefined?gp.depth:(gp.radiusTop||0.03))/2;
vmHandGun={c:c, off:[side? -0.026:0.026, -0.010, mhz+0.046], grip:[0.30, side?-0.30:0.30, 0],
mid:(top? {x:0.150,y:-0.020,z:0.080} : {x:-0.14,y:-0.10,z:-0.22}),
midRot:(top? {x:-0.24,y:0.34,z:0} : {x:0.50,y:-0.72,z:0}),
b0:ss(k,0.03,0.16), b1:ss(k,0.76,0.88), b2:ss(k,0.88,0.97), side:side};
}
if(k>0.1) vmPlayOnce('r1',()=>AudioSys.click(900,0.22,0.04));
if(k>0.3) vmPlayOnce('r2',()=>AudioSys.metalSlide(0.15,0.08,600,300));
if(k>0.62) vmPlayOnce('r3',()=>AudioSys.click(1400,0.3,0.05));
if(k>0.74){
const ch=pulse(k,0.74,0.84,0.96);
if(g.bolt) g.bolt.position.z=(g.bolt.userData.z0??0)+ch*0.07;
if(g.slide) g.slide.position.z=-0.02+ch*0.055;
vmPlayOnce('r4',()=>AudioSys.metalSlide(0.3,0.1,1200,700));
}
}
	// 收尾还原 (2026-10-05 → ★2026-10-25 收进 vmReloadRestore 单源): 弹匣/弹夹在换弹里被搬走, 归位前先
	//   物归原位 —— 与"被取消/被抢走" (vmAbortAction) 同一份还原, 加塞新动作才不会把枪留在缺匣状态。
	if(nt>=1){
	vmReloadRestore();
	VM.state='idle'; vmSndFlags={}; player.barArmKey=null; VM.mirrorHost=false; player.finishReload();   // ★2026-10-30: 换弹自然走完清打断确认账; ★2026-11-03: 镜像标记随走完清账
	}
}
else if(VM.state==='bolt'){
const k=nt;
rx+=pulse(k,0,0.3,1)*0.14; ry+=pulse(k,0,0.3,1)*0.1;
oy-=pulse(k,0,0.3,1)*0.02;
if(g.boltHandle) g.boltHandle.rotation.z=pulse(k,0.02,0.2,0.85)*-1.1;
if(g.bolt) g.bolt.position.z=(g.bolt.userData.z0??0.05)+pulse(k,0.18,0.4,0.72)*0.09;
handROverride=_ovR, handROverride.pos.set(0.05,-0.01+pulse(k,0.02,0.25,0.9)*0.05,0.08), handROverride.rot.set(-0.3,0,0);
if(k>0.05) vmPlayOnce('b1',()=>AudioSys.click(1100,0.2,0.03));
if(k>0.3) vmPlayOnce('b2',()=>{
AudioSys.metalSlide(0.22,0.08,900,1600);
const cp=camera.position.clone().add(camForward().multiplyScalar(0.4)).add(camRight().multiplyScalar(0.15));
spawnCasing(cp,camRight(),V3(0,1,0));
});
if(k>0.65) vmPlayOnce('b3',()=>AudioSys.metalSlide(0.22,0.08,1600,900));
if(k>0.88) vmPlayOnce('b4',()=>AudioSys.click(1300,0.22,0.03));
      if(nt>=1){ VM.state='idle'; vmSndFlags={}; }
    }
    else if(VM.state==='bandage'){
      VM.bandageM.visible=true; g.gun.visible=false;
      VM.reloadRocket&&(VM.reloadRocket.visible=false);
      const bk=nt;
      // 整体抬高到视野中部, 避免包扎动作太低几乎看不见
      oy+=0.03; rx+=0.05;
      // 左前臂横抬在胸前, 右手持绷带卷绕臂缠绕
      // ★2026-10-12 阶段一修左臂朝向: vmHandLFix 把左袖管甩向画面左下 (肩端 x=-0.267, 掌心逐位反解);
      //   整体位姿微调中置 (x: -0.125 → -0.08), 让双手互动处于准星中下方黄金分割区。
      const armL=vmHandLFix(-0.08,-0.035,-0.05,0.12,1.2,0.08);
      const armPos=armL.pos, armRotY=armL.rot.y;
      handLOverride=armL;
      // 前臂轴向与缠绕平面
      const ax=-Math.sin(armRotY), az=-Math.cos(armRotY);
      const raise=ss(bk,0,0.1);
      // 绷带缠在前臂皮肤段上: 白色包扎环随进度变宽
      let wrap=VM.arms.L.userData.wrap;
      if(!wrap){
        wrap=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.1,10),new THREE.MeshLambertMaterial({color:0xece4d0,map:TEX.cloth}));
        wrap.rotation.x=HPI; wrap.position.set(0,0,-0.06);
        VM.arms.L.add(wrap); VM.arms.L.userData.wrap=wrap;
      }
      const prog=ss(bk,0.12,0.88);
      wrap.visible=bk>0.14;
      wrap.scale.set(1,0.22+prog*0.78,1);
      // 绷带卷绕手臂做圆周运动(3圈), 同时沿臂向手腕推进
      const phi=prog*TAU*3;
      const along=0.03+prog*0.05;
      const cx=armPos.x+ax*along, cy=armPos.y+0.005, cz=armPos.z+az*along;
      const ux=-az, uz=ax;
      const R=0.055;
      VM.bandageM.position.set(
        cx+(Math.sin(phi)*ux)*R,
        cy+Math.cos(phi)*R*raise,
        cz+(Math.sin(phi)*uz)*R
      );
      VM.bandageM.rotation.order='YXZ';
      VM.bandageM.rotation.set(phi,armRotY+HPI,0);
      // ★2026-10-12 阶段二 (用户实报"包扎右臂太靠左"): 旧版写死 rotY=-0.2 (反向偏左), 袖管沿 +z
      //   后延导致肩端落点在 x=-0.082 (甚至比手腕更偏左), 右臂立在视野中左侧。
      //   修法 = 右臂袖管指向右下 (rotY 动态保持在 +0.66~+0.82 正角带, 袖管向画面右下延伸, 肩端
      //   世界 x=+0.16~+0.28m 稳居右下角); 掌心严格贴合绷带卷反解腕位 (vmWristFor), 保证手不滑脱。
      const rRot=_ovR.rot; rRot.set(0.28+Math.cos(phi)*0.20, 0.74+Math.sin(phi)*0.08, -0.06);
      const rPalm=_vmPalm; rPalm.x=VM.bandageM.position.x+0.016; rPalm.y=VM.bandageM.position.y-0.015; rPalm.z=VM.bandageM.position.z+0.010;
      handROverride=_ovR; _ovR.pos.copy(vmWristFor(rPalm.x,rPalm.y,rPalm.z,rRot.x,rRot.y,rRot.z));
      if(bk>0.12) vmPlayOnce('bd1',()=>AudioSys.metalSlide(0.07,0.14,320,520));
      if(bk>0.4) vmPlayOnce('bd2',()=>AudioSys.metalSlide(0.06,0.13,300,480));
      if(bk>0.66) vmPlayOnce('bd3',()=>AudioSys.metalSlide(0.06,0.13,340,500));
      if(bk>0.9) vmPlayOnce('bd4',()=>AudioSys.click(900,0.2,0.04));
      // 被打断(受击/外部中止)提前收起 —— 走残留收尾单源 (与 vmAbortAction 同一份, 不再各写一行)
      // ★2026-11-03: 镜像态 (VM.mirrorHost, 真附身包扎镜像) 不吃玩家 bandaging 账 —— 镜像的完成/打断
      //   全由 20-player svHostActionMirror 按宿主 bandageT 驱动, 这里只管动画。
      const interrupted=!VM.mirrorHost&&player.bandaging<=0&&bk<0.9;
      if(nt>=1||interrupted){
        VM.state='idle'; g.gun.visible=true;
        vmBandageHide(); vmSndFlags={}; VM.mirrorHost=false;
      }
    }
    else if(VM.state==='grab'){
      VM.grabitemM.visible=true; g.gun.visible=false;
      VM.reloadRocket&&(VM.reloadRocket.visible=false);
      const gk=nt;
      const reach=pulse(gk,0,0.3,0.55), back=ss(gk,0.35,0.6);
      VM.grabitemM.position.set(0.02,-0.02-reach*0.15+back*0.05,-0.14-reach*0.25+back*0.15);
      VM.grabitemM.rotation.set(0,gk*1.6,0);
      handROverride=_ovR, handROverride.pos.set(0.1+reach*0.1,-0.06-reach*0.14,-0.1-reach*0.28+back*0.2), handROverride.rot.set(0.3+reach*0.8,0,0);
      // 左手扶箱沿 (补给箱取弹药/从运输车补给/取绷带同一条 grab 分支): 掌位与旧字面量逐位相同, 只把袖管摆到左下
      handLOverride=vmHandLFix(-0.04,-0.08,-0.22,0.4,0,0);
      if(gk>0.45) vmPlayOnce('grab',()=>player.doGrabResolve());
      if(nt>=1){ VM.state='idle'; g.gun.visible=true; VM.grabitemM.visible=false; vmSndFlags={}; }
    }
    else if(VM.state==='build'){
      // 工程锤击建造: 右手抡锤反复敲击, 结束后工事落成
      if(!VM.hammerM){ VM.hammerM=buildHammer(); VM.inner.add(VM.hammerM); }
      VM.hammerM.visible=true; g.gun.visible=false;
      VM.reloadRocket&&(VM.reloadRocket.visible=false);
      const cyc=(VM.stateT*2.6)%1;
      const swing=cyc<0.45? ss(cyc,0.05,0.45) : 1-ss(cyc,0.45,0.72);
      // ★2026-09-28 阶段三 P1 (用户实报"锤击时上臂绕手腕大幅甩动"): buildArms 臂组的枢轴在**手腕**
      // (袖子段向 +z 后方延伸 0.25m), 旧 rot.x 到 -1.15 rad = 整条上臂绕拳头抡 —— 视觉即"转轴长在手上"。
      // 修法 = 肩点补偿: 手臂只摆 ±0.6 rad, 位置按绕肩端 (local +0.25z) 旋转的几何逐帧补回 ⇒ 袖子端
      // 定住、手腕走弧线, 真正的大幅抡击交给独立挂载的锤子本体 (rotation.x 加深到 -1.6 rad)。
      const th=-0.2-swing*0.6;
      VM.hammerM.position.set(0.09,-0.16+swing*0.2,-0.22);
      VM.hammerM.rotation.set(-0.35-swing*1.25,0.3,0.15);
      handROverride=_ovR, handROverride.pos.set(0.09,-0.17+0.25*(Math.sin(th)-Math.sin(-0.2)),-0.14-0.25*(Math.cos(th)-Math.cos(-0.2))), handROverride.rot.set(th,0.15,0);
      handLOverride=vmHandLFix(-0.06,-0.13,-0.2,0.35,0,0);
      rx+=0.12; oy-=0.02;
      const ki=Math.floor(VM.stateT*2.6);
      if(cyc>0.72) vmPlayOnce('bk'+ki,()=>{
        AudioSys.click(rand(420,560),0.4,0.07);
        AudioSys.metalSlide(0.08,0.05,900,400);
        const pb=player.pendingBuild;
        if(pb){
          const gy2=heightAt(pb.tx,pb.tz);
          for(let i2=0;i2<2;i2++) spawnP(PT.dirt,pb.tx+rand(-0.9,0.9),gy2+rand(0.15,0.5),pb.tz+rand(-0.9,0.9),rand(-0.5,0.5),rand(0.5,1.2),rand(-0.5,0.5),rand(0.2,0.35),0.6,rand(0.4,0.7),0.8,2);
        }
      });
      // 被打断或中途取消
      if(!player.pendingBuild&&nt<1){
        VM.state='idle'; g.gun.visible=true; VM.hammerM.visible=false; vmSndFlags={};
      } else if(nt>=1){
        VM.state='idle'; g.gun.visible=true; VM.hammerM.visible=false; vmSndFlags={};
        engBuildExec(player);
      }
    }
    // 架枪锚定: 支点(护木前端)固定在世界中, 枪身始终指向准星方向, 转动视角时枪绕支点平移摆动;
    // 机瞄时偏移消退, 照门准星自然对齐屏幕中心。
    // ★ 2026-09-26 B1 修: oz 的符号与原意相反。视模系里**前方 = -z** (HIP.pos 的 z=-0.38、枪口在负 z),
    //   支点在"沿架设方向前 0.45m" ⇒ 视线转过 rel 后它在视模系的坐标为 (横向 -0.45·sin(rel), 前向 -0.45·cos(rel));
    //   枪原点与支点相距恒为 0.45 (枪长不变) ⇒ 枪原点 = 支点 + 0.45·(朝观察者一侧)  ⇒  oz = +0.45·(1-cos(rel)),
    //   即"转向越大, 枪越朝观察者退回"。旧写法 (cos(rel)-1)·0.45 是它的相反数: 一转头枪往前窜 (最大 0.28m),
    //   与注释"绕支点摆动"方向相反 —— 架枪时左右扫视会看到枪身向外滑出去再滑回来。
    if(VM.braceBlend>0.01&&player.braceYaw!==undefined){
      const pin=VM.braceBlend*(1-VM.adsBlend);
      const rel=clamp(angDiff(player.braceYaw,player.yaw),-0.8,0.8);
      ox+=-Math.sin(rel)*0.45*pin;
      oz+=(1-Math.cos(rel))*0.45*pin;
    }
    VM.root.position.set(px+ox,py+oy,pz+oz);
VM.root.rotation.set(rx,ry,rz);
// 抓握解算 (2026-10-05 六裁定): 到根姿态定型之后才解算 —— 拳姿态 = 根姿态 + 枪系抓握偏角 (随枪的
//   俯仰/滚转一起走)。掌位 = 道具位 + 枪系抓握偏移, **同空间直取** (道具与手都是 inner 的子件: 枪组
//   在 inner 里没有自身变换, 枪局部 = 手部覆盖的同一坐标系, 别再叠根位移)。
if(vmHandGun){
const hg=vmHandGun; vmHandGun=null;
const hp=vmHoldPose(hg.c.x+hg.off[0], hg.c.y+hg.off[1], hg.c.z+hg.off[2],
hg.mid, rx+hg.grip[0], ry+hg.grip[1], rz+hg.grip[2], hg.midRot, hg.b0,hg.b1,hg.b2, VM.key, hg.side);
if(hg.side) handLOverride=vmHandLSnap(hp); else handROverride=hp;   // 左手持匣也过袖管归位 (BAR/百式实测同款)
}
positionHands(VM.key);
if(handLOverride){ VM.arms.L.position.copy(handLOverride.pos); VM.arms.L.rotation.set(handLOverride.rot.x,handLOverride.rot.y,handLOverride.rot.z); }
if(handROverride){ VM.arms.R.position.copy(handROverride.pos); VM.arms.R.rotation.set(handROverride.rot.x,handROverride.rot.y,handROverride.rot.z); }
VM.muzzleFlash.material.opacity*=Math.pow(0.0001,dt);
VM.muzzleLight.intensity*=Math.pow(0.0001,dt);
if(VM.gunParts.rocketTip&&player.curW) VM.gunParts.rocketTip.visible=player.curW.mag>0;
const scopedHide=d.scoped&&VM.adsBlend>0.85;
VM.inner.visible=!scopedHide;
document.getElementById('scopeOv').style.display=scopedHide?'block':'none';
const tgtFov=lerp(74, d.adsFov||60, VM.adsBlend)+(player.sprinting?4*VM.sprintBlend:0);
camera.fov=dampF(camera.fov,tgtFov,16,dt);
camera.updateProjectionMatrix();
}
function vmFireKick(){
const d=WPN_DEFS[VM.key];
VM.recoilV+=d.recoil*(2.2+rand(-0.3,0.3));
VM.kickV+=d.kick*22;
VM.muzzleFlash.position.copy(VM.gunParts.muzzle);
VM.muzzleFlash.material.opacity=1;
VM.muzzleFlash.material.rotation=rand(0,TAU);
VM.muzzleFlash.scale.setScalar(rand(0.12,0.2)*(d.snd==='sniper'?1.5:1));
VM.muzzleLight.position.copy(VM.gunParts.muzzle);
VM.muzzleLight.intensity=2.2;
}
