# Three.js 渲染管线与 WebGL 性能深度审计报告 (Rendering & WebGL Architecture Audit)

> **文档管理规则**: **未完成的文档需要放在主目录，完成了的文档需要放到finished-docs文件夹**。本文档为已定稿的专项技术审计成果，存放于 `finished-docs/audit-reports/` 供性能优化与架构重构参考。

**审计模块**: Three.js 渲染管线、WebGL 资源生命周期、Draw Call 批处理、几何体与材质管理、场景层级、地形与水体 LOD、植被与建筑实例化、粒子系统与 GC 内存抖动  
**审计文件**: 
- `js/02-scene.js` (渲染器 / 场景 / 光照 / 阴影 / 材质与贴图)
- `js/03-terrain.js` (地形网格 / 顶点色 / 建筑地基平台 / 水体语义)
- `js/05-world.js` (世界构建框架 / 几何体缓存 / 深度分层与共面消解 / 破坏系统)
- `js/05a-buildings.js` (建筑生成器 / 结构装配)
- `js/05b-props.js` (道具 / 植被与残骸 / 树木实例批 / 弹坑)
- `js/08-effects.js` (粒子池 / 曳光弹 / 弹壳 / 烟雾 / 天气降水 / 照明与残骸下沉)
- `js/10-viewmodel.js` (第一人称武器视角模型 / 换枪与换弹)
- `js/11-soldiers.js` (士兵装配 / 骨架与模型 / 视角向量工具)
- `js/12-ragdolls.js` (布娃娃与建筑物理碎块)
- `js/15-vehicles.js` & `js/16-aircraft.js` (坦克 / 战机几何与材质)
- `js/22-hud.js` & `js/23b-worldrestore.js` (实体退场与对局重置)
- `js/24-main.js` (主循环 RAF / 渲染通道 / 深度分层更新)

---

## 一、 审计概览与关键指标评估

《Battlefield Like》是一款基于原生 JavaScript 与 Three.js (r152) 构建的二战多兵种大战场射击游戏，支持大地图（320m~800m）、多载具（坦克/战机/舰艇）、可破坏建筑、复杂植被、天气系统与布娃娃物理。

在对游戏渲染管线进行逐行代码审查后，发现其在**WebGL GPU 资源释放机制**、**Draw Call 批处理与实例化**、**地形/几何 LOD 系统**、以及**热循环 GC 内存分配**方面存在若干深层次的性能与架构缺陷：

| 评估维度 | 当前现状 | 性能与稳定性影响 | 严重等级 |
| :--- | :--- | :--- | :--- |
| **WebGL 内存泄漏** | 对局重置、武器切换、破坏碎石时大量 Mesh 仅从场景移除，未调用 `geometry.dispose()`、`material.dispose()`、`texture.dispose()` | 长时间运行或就地开局数次后 VRAM 持续暴涨，最终导致 WebGL 上下文崩溃 (OOM) | **Critical** |
| **Draw Call 数量** | 建筑物所有墙面/窗台/阶梯、全图道具、棕榈树等均为独立 `THREE.Mesh`；阴影通道无细节裁剪 | 城市与植被密集地图单帧 Draw Call 达到 **3,000 ~ 6,000+**，极度受制于 CPU-GPU 驱动瓶颈 | **Critical** |
| **地形与水体 LOD** | 地形与海面均为单一巨大 `PlaneGeometry` (最大 18.5 万面)，无分块四叉树，无视锥体剔除 | 相机无论朝向何处，全场地表与海面三角面全量送入渲染管线，无距离网格简化 | **High** |
| **热循环 GC 内存抖动** | `camForward()`/`camRight()` 每次调用 `.clone()`；`updateViewModel`、`updateCamera`、Bot 索敌每帧大量 `new THREE.Vector3()` | 每秒产生数百至数千临时 Vector3，触发 V8 频繁 Minor GC，导致帧率毛刺与微卡顿 | **High** |
| **阴影通道过度绘制** | 太阳阴影远裁剪达 400m，所有微小构件（窗台/把手/头盔徽章/弹壳/碎屑）均开启 `castShadow` | 阴影通道 Draw Call 与主相机通道几乎 1:1，产生海量重复绘制 | **High** |
| **天气粒子 CPU 消耗** | 雨雪粒子每帧在 CPU 端逐顶点循环计算 AABB 遮挡、修改 Float32Array 并标记 `needsUpdate=true` | 每帧强制向 GPU 重新上传数千顶点的 VBO，占用宝贵的总线带宽与 CPU 周期 | **Medium** |
| **WebGL 上下文丢失处理** | 缺少 `webglcontextlost` 与 `webglcontextrestored` 事件监听与资源恢复机制 | 设备休眠、GPU 驱动重置或后台切换时游戏直接假死黑屏 | **Medium** |

---

## 二、 内存泄漏与 WebGL 生命周期缺陷 (Memory & Lifecycle)

### 1. 【Critical】对局就地重开时单位与残骸资源未处置 (`dispose()`)
- **相关文件与位置**:
  - `js/22-hud.js:1183-1190` (`retireMatchActors`)
  - `js/22-hud.js:1998-2007` (海战 `retireMatchActors` 包装)
  - `js/23b-worldrestore.js:157-175` (`clearMatchEffects`)
  - `js/23b-worldrestore.js:142-153` (`_wsnRestoreGraph`)
  - `js/20-player.js:1368-1372` (`playerAvatarReset`)
- **问题描述**:
  在就地重新开始对局 (`retireMatchActors`) 或从主菜单重新进入时，系统通过 `s.mesh.root.parent.remove(s.mesh.root)`、`world.remove(mesh)` 以及 `_wsnRestoreGraph` 将上一局的士兵、坦克、飞机、舰艇、工事残骸移出场景图。
  **然而在 Three.js 中，单纯从父节点 `remove()` 或解绑引用绝不会释放 GPU 显存！** 
  - 每个士兵 (`buildSoldierMesh`) 创建了 1 个独立的 `THREE.SphereGeometry`（头盔）、5~7 个独立的 `THREE.MeshLambertMaterial`、以及一个独立的 `THREE.CanvasTexture`（头顶文字贴图 `tag`）。
  - 每辆坦克 (`15-vehicles.js`)、每架飞机 (`16-aircraft.js`) 创建了十数个 `BoxGeometry`、`CylinderGeometry`、`BufferGeometry` 以及材质。
  - `clearMatchEffects()` 仅将 `particles.length=0`、`pPools.clear()`、`tracers.length=0`，丢弃了集合引用，但此前已被实例化进入场景的粒子精灵和材质全未调用 `.dispose()`。
- **后果**:
  玩家在一场会话中连续打 3~5 局后，GPU 显存中滞留上万个无用顶点缓冲区 (VBO) 和数千张画布贴图，最终导致移动端或集成显卡浏览器崩溃（WebGL Context Lost）。
- **优化建议**:
  实现递归资源销毁函数 `disposeHierarchy(obj)`，在实体退场、池清空及场景图摘除时遍历释放几何体、材质与贴图：
  ```javascript
  function disposeHierarchy(obj, disposeMaterials = true) {
    if (!obj) return;
    obj.traverse(child => {
      if (child.geometry && typeof child.geometry.dispose === 'function') {
        child.geometry.dispose();
      }
      if (disposeMaterials && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        for (const m of mats) {
          if (m.map && typeof m.map.dispose === 'function') m.map.dispose();
          if (typeof m.dispose === 'function') m.dispose();
        }
      }
    });
  }
  ```

---

### 2. 【Critical】第一人称武器切换时的几何体与材质泄漏
- **相关文件与位置**:
  - `js/10-viewmodel.js:40-65` (`vmEquip`)
  - `js/09-weapons.js:20-27` (`bx`, `cyl`)
  - `js/09-weapons.js:28-65` (`buildGunModel`)
  - `js/09-weapons.js:463-472` (`buildArms`)
  - `js/09-weapons.js:497-502` (`buildNadeMesh`)
- **问题描述**:
  当玩家按 1/2 键切枪时，执行 `vmEquip(key, team)`：
  ```javascript
  VM.inner.clear(); // 仅从 inner 节点移除子对象！
  VM.gunParts = buildGunModel(key);
  VM.arms = buildArms(team);
  for(const k of NADE_KINDS){ const m=buildNadeMesh(k,team); ... }
  ```
  在 `buildGunModel`、`buildArms` 以及 `buildNadeMesh` 中，所有的零件均通过 `bx()` 和 `cyl()` 构造：
  ```javascript
  function bx(mat,w,h,d,x,y,z,g){
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); // 每次全新创建 BoxGeometry
    ...
  }
  ```
  每次切换武器，就会创建 25~40 个全新的 `BoxGeometry` 和 `CylinderGeometry`，而上一把武器的所有网格仅仅从 `VM.inner` 中被 `clear()` 移除，其几何体从未被 `.dispose()`。
- **后果**:
  射击游戏中玩家切枪极其频繁，单局切枪 50 次即可在显存中遗留数千个孤立的武器几何体，造成显存泄露和 WebGL 缓冲区膨胀。
- **优化建议**:
  1. 武器模型应按武器键值 `key` 进行预建或单例缓存（`_gunModelCache[key]`），切枪时仅切换 `visible` 或移入/移出 `VM.inner`，避免重复 `new`。
  2. 若动态重建，必须在 `VM.inner.clear()` 之前，对被清空节点内的网格几何体逐一调用 `.dispose()`。

---

### 3. 【High】动态破坏生成的碎石堆几何体无限缓存无上限泄漏
- **相关文件与位置**:
  - `js/05-world.js:20-25` (`boxGeo`)
  - `js/05-world.js:50-61` (`uvGeo`)
  - `js/05-world.js:976-985` (`rubblePileFX`)
- **问题描述**:
  当建筑构件被炸毁坍塌时，调用 `rubblePileFX(cx, cz, gy)` 生成散落碎石堆：
  ```javascript
  for(let k=0;k<4;k++){
    piles.push(mesh(
      boxGeo(wr(0.4,0.9), wr(0.25,0.55), wr(0.4,0.9)),
      wr(0,1)<0.5?MAT.rubble:MAT.brick, ...
    ));
  }
  ```
  注意 `boxGeo(w, h, d)` 将几何体以 `w.toFixed(2)+'x'+h.toFixed(2)+'x'+d.toFixed(2)` 为键缓存在全局 `_geoCache` 中；而 `mesh()` 内部的 `uvGeo()` 又克隆了一份放进 `_uvCache`。
  由于 `wr(...)` 返回的是连续随机浮点数，每一块碎石的尺寸键几乎都是全新的！
  在整局激烈战斗中，数百面墙壁倒塌生成成千上万块碎石，全部作为唯一的键塞入 `_geoCache` 和 `_uvCache`，**且这两个 Map 永不清理、永不淘汰、永不 dispose**。
- **后果**:
  随着战斗推进，`_geoCache` 和 `_uvCache` 几何体缓存无限膨胀，占用上百兆 GPU 缓冲区且无法随残骸下沉消除。
- **优化建议**:
  碎石块尺寸不应使用连续随机数，而应离散化为固定的 3~4 种预制尺寸档位（如小/中/大 3 种固定尺寸：`boxGeo(0.5,0.3,0.5)`、`boxGeo(0.7,0.4,0.7)`、`boxGeo(0.9,0.5,0.9)`），全图复用这 3 组几何体。

---

### 4. 【Medium】缺少 WebGL Context Lost 容错机制
- **相关文件与位置**:
  - `js/02-scene.js:6-17`
  - `js/24-main.js:7-10`
- **问题描述**:
  `renderer.domElement` 没有注册 `webglcontextlost` 和 `webglcontextrestored` 事件。在移动设备锁屏、切后台、多标签切换或显卡驱动重置时，浏览器会触发 WebGL 上下文丢失。游戏 RAF 循环持续调用 `renderer.render()` 将导致致命报错死循环。
- **优化建议**:
  监听上下文丢失事件，暂停 RAF 循环并在恢复时重建管线状态：
  ```javascript
  renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    console.warn('[WebGL] 上下文丢失，暂停渲染循环');
  }, false);
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    console.info('[WebGL] 上下文恢复，重置渲染状态');
    applyQuality();
  }, false);
  ```

---

## 三、 Draw Call 爆炸与批处理/实例化架构 (Draw Calls & Batching)

### 1. 【Critical】全图建筑物与结构完全无合并、无实例化 (100% 独立 Mesh)
- **相关文件与位置**:
  - `js/05-world.js:26-31` (`mesh`)
  - `js/05-world.js:783-835` (`solidBox`)
  - `js/05-world.js:1392-1431` (`wallSeg`)
  - `js/05a-buildings.js` (全部 2500+ 行)
- **问题描述**:
  - `05-world.js` 中的 `solidBox` 和 `mesh` 函数将每个盒体作为一个独立的 `THREE.Mesh` 直接挂载至 `world` 组（`world.add(m)`）。
  - `wallSeg` 生成带门窗的墙体时，会将其切割成多段微小包围盒（窗下墙、窗上楣、窗间垛等），单面带窗墙体即可产生 15~20 个独立网格。
  - 一栋大型建筑（如国会大厦 `reichstag`、红十月厂区 `redOctober`、火车站、高炮塔）由 **300 ~ 600 个独立 Mesh** 拼装而成。
  - 全图建筑完全没有使用几何体合并（`BufferGeometryUtils.mergeGeometries`）或任何分块网格合并机制。
  - 在城市地图（柏林、斯大林格勒），场景中仅仅静态世界构件的 `THREE.Mesh` 数量就高达 **7,000 ~ 8,700 个**。
- **后果**:
  当玩家站在街区远眺时，视锥体范围内有 2,000 ~ 3,500 个独立网格被送入渲染。加上阴影通道（方向光阴影范围涵盖全图局部），**每一帧仅建筑构件就要产生 3,000 ~ 5,000 个 Draw Call**，严重超出移动端与轻薄本 WebGL 的承载能力（通常建议控制在 500 ~ 1,000 以内），导致强烈的 CPU 提交瓶颈。
- **优化建议**:
  1. **建筑按建筑实体/房间进行静态几何合并**:
     对不可破坏的建筑部件（或按坍塌单元分组的可破坏构件），在世界生成结束阶段（`buildWorld` 末尾），按材质分类将同材质的部件合并为一个或数个复合 `BufferGeometry`。
  2. **门框、窗框、栏杆等大量重复构件改用 `InstancedMesh`**。

---

### 2. 【High】塔拉瓦环礁 386 株椰子树未实例化，单图额外增加 5,400+ 个独立 Mesh
- **相关文件与位置**:
  - `js/05b-props.js:118-146` (`TREE_BATCH` / `flushTreeBatch`)
  - `js/05b-props.js:844-882` (`palmTree`)
- **问题描述**:
  - 在太行山、雪峰山等山地图中，树木已被成功重构为 `InstancedMesh`（`trunks` 树干批与 `leaves` 叶片批，共仅 2 个 Draw Call，见 `05b-props.js:143-144`）。
  - **然而，塔拉瓦海岛图独有的椰子树 (`palmTree`) 却完全被遗漏在实例化管线之外！**
  - 每株 `palmTree` 均通过原生 `THREE.Group` 组装：
    - 1 根树干 Mesh (`CylinderGeometry`)
    - 8 ~ 10 片椰子树叶 Mesh (`boxGeo(0.46, len, 0.09)`)
    - 3 ~ 5 个椰子 Mesh (`SphereGeometry`)
    - 且对这组子 Mesh 全部执行：`grp.traverse(o=>{ o.castShadow=true; o.receiveShadow=true; })`
  - 塔拉瓦地图共种植 **386 株椰子树**：
    `386 × (1 + 9 + 4) = 5,404 个独立 Mesh！`
- **后果**:
  塔拉瓦海岛本是开阔水面地图，但仅椰子树一项就凭空增加了 **5,400 多个独立 Mesh 和 Draw Call**，完全抵消了开阔视野的性能优势。
- **优化建议**:
  将椰树参照松杉树的做法建立 `PALM_BATCH`：
  - 树干合批为 1 个 `InstancedMesh(CylinderGeometry, MAT.bark, N)`
  - 树叶合批为 1 个 `InstancedMesh(boxGeo, MAT.leaves, N*9)`
  - 椰子合批为 1 个 `InstancedMesh(SphereGeometry, MAT_PALM_NUT, N*4)`
  将 5,404 个 Draw Call 瞬间削减至 **3 个 Draw Call**！

---

### 3. 【Medium】道具类物件（反坦克龙牙、捷克刺猬、木箱、沙袋墙）完全未实例化
- **相关文件与位置**:
  - `js/05b-props.js:45-65` (`sandbagWall`)
  - `js/05b-props.js:66-76` (`hedgehog`)
  - `js/05a-buildings.js:1568-1590` (`dragonTooth`)
  - `js/05b-props.js:233-240` (`crate`)
- **问题描述**:
  防御工事如防坦克龙牙（混凝土角锥）、捷克刺猬（3 根钢梁）、沙袋墙（每 2.6m 一截）、以及散落弹药箱，在阵地战役中大量铺设（每图通常数百件），全部由 `solidBox` 或 `mesh` 独立生成，无任何实例化。
- **优化建议**:
  将静态无破坏或同批破坏的障碍物按类型收纳为 `InstancedMesh`。

---

## 四、 地形与水体网格架构、LOD 与视锥体剔除 (Terrain & Water)

### 1. 【High】单一巨幅地形网格无 LOD、无分块，全场地表永不被视锥体剔除
- **相关文件与位置**:
  - `js/03-terrain.js:1078-1291` (地形几何构建与上色)
  - `js/03-terrain.js:1296-1320` (`refreshTerrainMesh`)
- **问题描述**:
  - 地形网格是一个单一的巨大 `THREE.PlaneGeometry`：
    ```javascript
    const seg = Math.max(64, Math.round((MAP_SIZE+40)/2.76));
    const geo = new THREE.PlaneGeometry(MAP_SIZE+40, MAP_SIZE+40, seg, seg);
    ```
    对于 800m 地图（雪峰山），`seg ≈ 304`，整个网格包含 `305 × 305 = 93,025` 个顶点，**184,832 个三角面**。
  - 地形网格作为一个单一的大 Mesh（包围盒覆盖 `[-420, +420]`），其包围球半径大于 500m。因此，**相机的视锥体剔除 (Frustum Culling) 对地形网格永远为真（永不被剔除）**。
  - 不管玩家是在室内低头看地面，还是面朝悬崖，GPU 每帧都必须对整张地图 18.5 万个地形三角形做顶点变换和着色计算。
  - 缺乏基于相机距离的网格细分/粗化（LOD）：300 米外的远山与玩家脚下的泥土顶点密度完全一致（~2.76m）。
- **后果**:
  顶点吞吐量长期处于高负荷，限制了低端移动 GPU 的渲染帧率；同时，当 `refreshTerrainMesh()` 刷新地基平台高度时，必须在 CPU 遍历全部 93,025 个顶点并执行计算开销极大的 `GROUND_GEO.computeVertexNormals()`。
- **优化建议**:
  1. **地表空间网格切块 (Chunking)**:
     将地图按 4×4 或 8×8 切分为 16 ~ 64 个独立的地形子块。各子块拥有独立的包围盒，Three.js 能够天然对其进行视锥体剔除（背面和视野外的地块 Draw Call 立即为 0）。
  2. **引入简易两档 LOD 或 CDLOD**:
     外围远景子块网格细分密度减半（5.5m/格），近景子块保持高密度（2.7m/格）。

---

### 2. 【High】海面网格重复构建双倍面数，全海图三角面超 36 万
- **相关文件与位置**:
  - `js/05c-layouts.js:2062-2109` (`buildSeaMesh`)
- **问题描述**:
  海战图与海岛图中，海面同样使用完全相同的全分辨率 `PlaneGeometry` 构建：
  ```javascript
  const seg = Math.max(64, Math.round((MAP_SIZE+40)/2.76));
  const geo = new THREE.PlaneGeometry(MAP_SIZE+40, MAP_SIZE+40, seg, seg);
  ```
  尽管在 CPU 剔除了全陆地三角形，但在深海图（Open Sea / Ironbottom Sound），海面几乎完整保留，产生另外 **180,000+ 个三角形**。
  此时地形（海床）与海面叠加，水体与海床的三角面总数超过 **36 万面**。并且海面开启了 `side: THREE.DoubleSide` 与 `transparent: true`，带来了极高的片段着色器 Overdraw（覆写率）。
- **优化建议**:
  海面网格可采用远疏近密的放射状网格或同心环网格，远离中心的可玩区域无需维持 2.76 米的高网格密度。

---

## 五、 热循环 GC 内存抖动分析 (GC Churn in Hot Loops)

在 WebGL/Three.js 高性能渲染中，**避免每帧创建临时 JavaScript 对象是维持 60 FPS 稳定帧率的第一铁律**。垃圾回收器（Garbage Collector）在回收瞬时对象时会导致主线程出现不可预测的掉帧与偶发卡顿。

### 1. 【High】`camForward()` 与 `camRight()` 每次调用均分配新 Vector3 实例
- **相关文件与位置**:
  - `js/11-soldiers.js:7-8`:
    ```javascript
    function camForward(){ camera.getWorldDirection(_fwd); return _fwd.clone(); }
    function camRight(){ camera.getWorldDirection(_fwd); _rgt.crossVectors(_fwd,_upv).normalize(); return _rgt.clone(); }
    ```
- **问题描述**:
  `camForward()` 和 `camRight()` 是整个工程最基础的数学工具函数，全库有 **33+ 处高频调用点**。每次调用，它们都对预分配的 `_fwd`/`_rgt` 显式执行了 `.clone()`，生成一个全新的 `THREE.Vector3` 对象。
  例如在 `20-player.js:1010` 射击抛壳逻辑中：
  ```javascript
  const cp = oS.clone().add(camForward().multiplyScalar(0.35)).add(camRight().multiplyScalar(0.14)).add(V3(0,-0.05,0));
  ```
  这一行代码在瞬间连续实例化了 5 个 `THREE.Vector3` 对象！
- **后果**:
  玩家在疾跑、机枪连发或视角转动时，每秒触发成百上千次 `camForward()`，引发严重的内存垃圾分配。
- **优化建议**:
  改为传入目标向量进行写入（出参模式），或者针对只读计算提供无克隆版本：
  ```javascript
  function getCamForward(out) {
    camera.getWorldDirection(out);
    return out;
  }
  ```

---

### 2. 【High】第一人称武器骨骼姿态更新中的海量 `V3()` 构造
- **相关文件与位置**:
  - `js/10-viewmodel.js:339, 361, 368, 397-402, 545, 584, 602, 631, 650, 669`
- **问题描述**:
  在 `updateViewModel(dt, player)` 每帧更新中，左右手 IK 与动画覆写大量书写了字面量 `pos: V3(...), rot: V3(...)`：
  ```javascript
  handROverride = {
    pos: V3(0.1+reach*0.1, -0.06-reach*0.14, -0.1-reach*0.28+back*0.2),
    rot: V3(0.3+reach*0.8, 0, 0)
  };
  ```
  `V3()` 即 `new THREE.Vector3()`。在换弹或射击动画播放期间，每一帧有 6~12 个 `V3()` 和对象字面量被创建后立即丢弃。
- **优化建议**:
  将手部目标姿态预分配为模块级静态变量 `_handPosR`、`_handRotR`、`_handPosL`、`_handRotL`，每帧仅使用 `.set(x, y, z)` 修改分量，完全杜绝堆内存分配。

---

### 3. 【Medium】Bot 索敌与感知高频分配 Vector3
- **相关文件与位置**:
  - `js/14-bots.js:413` (`eyePos`)
  - `js/14-bots.js:765, 853, 1052, 1121, 1610, 1879, 2204`
- **问题描述**:
  `eyePos()` 定义为：
  ```javascript
  eyePos(){ return V3(this.pos.x, this.pos.y+(this.prone?0.5:this.crouch?1.15:1.62), this.pos.z); }
  ```
  场上通常有 30 ~ 60 名 Bot。Bot 在每一轮感知、瞄准、掩体寻找中多次调用 `this.eyePos()` 和射线投射 `raycastWorld(V3(...), V3(...))`，每秒产生数千个废弃的 Vector3 对象。
- **优化建议**:
  将 `eyePos(out)` 改为传入复用向量参数，如 `bot.getEyePos(_tmpVec)`。

---

### 4. 【Low】主循环中的数组过滤分配
- **相关文件与位置**:
  - `js/24-main.js:71`:
    ```javascript
    gunEvents = gunEvents.filter(e => nowT - e.t < 0.6);
    ```
- **问题描述**:
  主循环每帧执行 `.filter()`，不论是否有开火事件，每一帧都在分配新的 Array 实例。
- **优化建议**:
  改用双指针就地原地压缩数组，或倒序 `splice`，避免每帧新开数组。

---

## 六、 粒子系统、天气缓冲与贴花池管理 (Particles & Effects)

### 1. 【High】天气粒子系统 CPU 计算沉重且强制每帧上传 VBO
- **相关文件与位置**:
  - `js/08-effects.js:261-283` (`initWeather`)
  - `js/08-effects.js:291-361` (`updateWeather`)
- **问题描述**:
  - 雨天创建了 720 条线段（`LineSegments`，4,320 个顶点），雪天创建了 900 个点（`Points`）。
  - 在 `updateWeather(dt)` 中：
    - CPU 遍历整个网格的所有顶点位置（`arr[i3]`, `arr[i3+1]`, `arr[i3+2]`）。
    - 并在内层循环中对所有屋顶/遮蔽物 `_wxCovers` 执行 AABB 碰撞检测（`for(let k=0; k<_wxCovers.length; k++)`）。
    - 计算完成后执行：`pos.needsUpdate = true;`。
  - **这意味着每帧都在主线程进行千次几何判定，且每帧强制通过 WebGL 将整个顶点属性缓冲区全量回传给显卡！**
- **优化建议**:
  1. 减少屋顶碰撞检测频率或简化为粗糙空间哈希；
  2. 理想方案是将雨雪掉落迁移至 GPU 顶点着色器（通过 Uniform 传递时间 `uTime`，在 Vertex Shader 中做求模循环下落），完全免除 CPU 逐顶点更新与 VBO 上传。

---

### 2. 【Medium】粒子与烟雾精灵材质未共享实例化
- **相关文件与位置**:
  - `js/08-effects.js:38-43` (`spawnP`)
  - `js/08-effects.js:156-171` (`spawnSmokeCloud`)
- **问题描述**:
  - 在粒子池 `spawnP` 中，若池内暂无可用对象，每次新产生粒子精灵时都会 `new THREE.SpriteMaterial(...)`。
  - 在发烟弹 `spawnSmokeCloud` 中，一颗发烟弹产生 14 个烟雾精灵 + 7 个火舌精灵，全部独立 `new THREE.SpriteMaterial(...)`。
  - 实际上，所有同类型烟雾（如白烟、黑烟）完全可以共享同一份 `THREE.SpriteMaterial` 实例（通过 `Sprite.color` 和 `scale` 调整差异），无需为每个精灵单独创建材质并占用独立的 WebGL 材质状态切换。
- **优化建议**:
  预先初始化全局单例的烟雾/火舌 `SpriteMaterial`，所有烟雾粒子实例复用此全局材质。

---

### 3. 【Medium】血迹与弹坑贴花管理缺陷
- **相关文件与位置**:
  - `js/08-effects.js:114-117, 641-667` (`bloodDecal`)
  - `js/05b-props.js:213-228` (`crater`)
- **问题描述**:
  - `bloodDecal` 预分配了 36 个 `PlaneGeometry`，并在首次使用时克隆了 36 份 `bloodMat`。在 `bloodDecal()` 函数中，每次贴花被重新激活时均调用 `scene.add(best.m)`，即使该网格早已在场景中，造成不必要的场景图结构操作。
  - `crater(runtime=true)` 在运行时生成弹坑网格并加入 `runtimeCraters`，超出 36 个时执行 `world.remove(old)`，但并未释放该网格的几何体与材质变体。

---

## 七、 阴影贴图、光照与视锥体裁剪 (Shadows, Lights & Culling)

### 1. 【High】阴影通道视锥过深与阴影投射物未精细分级
- **相关文件与位置**:
  - `js/02-scene.js:108-112`
  - `js/02-scene.js:27-31` (`applyQuality`)
  - `js/05-world.js:26-30` (`mesh`)
  - `js/11-soldiers.js:359` (`buildSoldierMesh`)
- **问题描述**:
  - 太阳阴影相机设置：
    `sun.shadow.camera.far = 400;`  
    `SHADOW_RANGE = 42 ~ 80;`
    阴影正交相机深度高达 400 米，覆盖体积巨大。
  - **默认全量投射阴影**:
    在 `mesh()` 中默认参数为 `cast = true`。这导致建筑物上的窗台细板、门楣、楼梯台阶、屋檐细条、地面瓦砾堆、防坦克锥、甚至士兵头盔徽章，全部开启了 `castShadow = true`。
- **后果**:
  在 Three.js 阴影渲染通道中，深度相机必须遍历这数千个细小网格并逐一绘制深度图。微小细节构件在 1536/2048 分辨率的阴影贴图上投影仅占几个像素甚至不到一个像素，对视觉贡献微乎其微，却导致阴影通道产生海量 Draw Call，造成双倍绘制负荷。
- **优化建议**:
  1. 对细小构件（尺寸小于 0.5m 的小构件如窗台、台阶、装饰物、枪械零件、碎石堆）强制指定 `cast = false`，仅保留大体量的主墙体、屋顶、车体、树干投射阴影。
  2. 根据实际阴影需要将 `sun.shadow.camera.far` 从 400m 缩减至合适范围（如 160m~200m），降低深度方向上的包围盒冗余。

---

### 2. 【Medium】大批量实例化网格被强制禁用视锥体剔除
- **相关文件与位置**:
  - `js/05b-props.js:145-146` (`trunks.frustumCulled = false`, `leaves.frustumCulled = false`)
  - `js/04b-fire.js:150` (`BUSH_IM.frustumCulled = false`)
  - `js/05c-layouts.js:2575` (`inst.frustumCulled = false`)
  - `js/05c-layouts.js:2669` (`im.frustumCulled = false`)
- **问题描述**:
  为了防止 Three.js 默认包围球计算失真导致批次偶发消失，代码中将所有树木、灌木、草丛、庄稼的 `InstancedMesh.frustumCulled` 全部设置为 `false`。
  这意味着，即使玩家面朝大海或背对森林，GPU 每帧仍必须处理全图 3,000 棵树木、上千簇草丛和灌木的全部实例矩阵变换，增加了 GPU 顶点着色器负荷。
- **优化建议**:
  通过遍历所有实例的平移位置计算出真实的完整包围盒/包围球（`im.computeBoundingBox()` 与 `im.computeBoundingSphere()`），然后重新启用 `im.frustumCulled = true`。

---

## 八、 审计缺陷汇总与优化路线图 (Summary & Recommendations)

下表总结了本报告发现的核心问题，按优先级从高到低排列：

| 编号 | 问题分类 | 缺陷文件与行号 | 缺陷简述 | 严重度 | 修复收益与方案 |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **R-01** | 显存泄漏 | `js/22-hud.js:1183`<br>`js/23b-worldrestore.js:142` | 对局退场/世界还原只摘节点，未对士兵/载具/网格调用 `.dispose()` | **Critical** | 增加递归 `disposeHierarchy()`，彻底解决多局后 WebGL OOM 崩溃 |
| **R-02** | 显存泄漏 | `js/10-viewmodel.js:42`<br>`js/09-weapons.js:21,25` | 换枪 `vmEquip` 每次重新 new 几何体，旧武器被丢弃但 GPU 缓冲永久残留 | **Critical** | 武器模型改单例缓存池，或在 clear 前递归 dispose 几何与材质 |
| **R-03** | Draw Call 灾难 | `js/05-world.js:26`<br>`js/05a-buildings.js:943+` | 建筑物全由数百个独立 Mesh 拼成，城市地图 Draw Call 高达 4,000~6,000 | **Critical** | 按建筑实体与材质执行 `mergeGeometries` 静态合并，Draw Call 可减少 70%~85% |
| **R-04** | Draw Call 灾难 | `js/05b-props.js:845-882` | 塔拉瓦 386 株椰树未做实例化，单图额外产生 5,400+ 个独立网格 | **High** | 仿照普通树木重构为椰树 `InstancedMesh`，将 5400 绘制调用降为 3 次 |
| **R-05** | 地形架构 | `js/03-terrain.js:1082`<br>`js/05c-layouts.js:2065` | 地形与海面为单体 18.5 万面巨幅网格，无法视锥剔除且无网格 LOD | **High** | 将地表/海面拆分为 4×4 或 8×8 空间子块，启用分块视锥剔除与远景两级网格简化 |
| **R-06** | 内存泄漏 | `js/05-world.js:20,50,976` | 建筑坍塌碎石用连续随机数尺寸塞入 `_geoCache` 与 `_uvCache`，永不清理 | **High** | 碎石尺寸离散为 3 种固定规格复用几何，杜绝无边界缓存膨胀 |
| **R-07** | GC 内存抖动 | `js/11-soldiers.js:7,8`<br>`js/10-viewmodel.js:339+`<br>`js/20-player.js:1010` | `camForward()`/`camRight()` 每次 clone，武器 IK 每帧海量 `new THREE.Vector3` | **High** | 改用出参复用与模块级静态 Vector3，消除主渲染循环中的每秒万级微内存分配 |
| **R-08** | 阴影通道过载 | `js/02-scene.js:111`<br>`js/05-world.js:26` | 阴影远裁剪达 400m，窗台/台阶/瓦砾等海量微小构件均开启 `castShadow` | **High** | 细微构件强制 `castShadow = false`，阴影远裁面收窄至 180m，阴影绘制调用减半 |
| **R-09** | CPU 瓶颈 | `js/08-effects.js:315-360` | 雨雪粒子每帧在 CPU 逐顶点判定屋顶碰撞并强制上传完整 VBO | **Medium** | 降低遮挡检测频率，远期迁移至 GPU 顶点着色器模拟循环 |
| **R-10** | 容错缺失 | `js/02-scene.js:6-17` | 缺少 WebGL 上下文丢失与恢复事件监听，设备锁屏/切后台易发生游戏假死 | **Medium** | 补充 `webglcontextlost` 与 `webglcontextrestored` 监听与渲染循环安全暂停 |
