# Cannon.js 物理引擎、载具模拟、弹道与碰撞检测深度审计报告 (Physics, Vehicles & Combat Ballistics Audit)

> **文档管理规则**: **未完成的文档需要放在主目录，完成了的文档需要放到finished-docs文件夹**。本文档为已定稿的专项技术审计成果，存放于 `finished-docs/audit-reports/` 供性能优化与架构重构参考。

**审计模块**:
- Cannon.js 刚体物理循环与布娃娃/碎块系统 (`js/12-ragdolls.js`)
- 空间索引、光线投射与环境几何碰撞 (`js/04-collision.js`, `js/03-terrain.js`, `js/04b-fire.js`)
- 武器弹道、击中判定、爆炸溅射与投掷物 (`js/13-combat.js`, `js/16-aircraft.js`, `js/15f-battery.js`, `js/17-emplacements.js`)
- 陆战载具物理、碰撞分离与悬挂模拟 (`js/15-vehicles.js`, `js/15b-trucks.js`, `js/15c-specveh.js`)
- 海战流体动力学、大舰多舱室物理与移动甲板 (`js/15d-naval.js`, `js/15h-capital.js`)
- 空战气动学、重力下沉与低空防撞 (`js/16-aircraft.js`)
- 内存生命周期、GC 垃圾分配与数学鲁棒性 (`js/12-ragdolls.js`, `js/15-vehicles.js`, `js/23b-worldrestore.js`, `js/24-main.js`)

---

## 一、 审计概览与关键指标评估

《Battlefield Like》采用了混合物理架构：
1. **Cannon.js 刚体引擎**: 专门负责步兵死亡后的布娃娃（Ragdolls，包含 8 刚体 + 7 约束）以及建筑倒塌破碎后的物理碎块（Debris，包含最多 96 个刚体）；
2. **定制空间索引与光线投射器 (RGRID & DDA)**: 负责全图静态建筑/箱体 (`BOXES`)、圆柱障碍 (`CYLS`) 与连续高度场地形 (`heightAt`) 的高效射线步进；
3. **混合载具与水体流体模拟**: 包含了坦克履带与负重轮悬挂系统、小艇/两栖车浪涌浮态与搁浅摩擦力、150米级大舰移动甲板刚性位移搬运、以及战机的伪升力与能量机动航模气动模拟；
4. **弹道动力学**: 覆盖了即时命中（Hitscan 轻武器）、离散积分慢速火箭/迫击炮弹/高爆航弹、巡飞弹 TV 制导、高射炮弹片与鱼雷。

经过系统性深度代码审查，我们在物理计算管线中发现了若干直接制约游戏高帧率稳定运行的**严重瓶颈**，包括 **Cannon.js 死亡螺旋**、**无碰撞过滤引起的 O(N²) 狭相碰撞对爆炸**、**高速弹丸隧穿**、**投掷物 WebGL/场景图内存泄漏**、**全场弹道无空间分区导致的 O(N×M) 线性遍历**以及**物理热循环狂暴的 GC 垃圾分配**：

| 评估维度 | 当前现状 | 性能与稳定性影响 | 严重等级 |
| :--- | :--- | :--- | :--- |
| **Cannon.js 积分步长** | 固定步长 `1/60s`，上限步数限制为 2 (`maxSubSteps=2`)，无时停守卫 | 低帧率 (FPS<30) 下时间累加器持续落后产生物理慢动作与延迟累积；时停帧冗余积分 | **Critical** |
| **物理宽相碰撞爆炸** | 使用 `NaiveBroadphase`，布娃娃与建筑碎块混入同一世界，总计高达 160 刚体且无碰撞过滤分组 | 单步最高达 12,720 次两两检测，单帧两子步产生 25,440 次无意义狭相计算 | **Critical** |
| **高速弹丸隧穿 Bug** | 460m/s 高炮弹单帧位移超 15m 仅做离散点测；主炮弹重力项与射线扫掠方向在更新后分离 | 极速弹丸直接穿透士兵与薄掩体；俯冲近地开火发生弹道与射线方向脱节 | **Critical** |
| **投掷物与网格内存泄漏** | 手雷与航弹爆炸/落水后仅从 Scene 移除，不释放几何体与材质；世界重置仅清空数组 | 长时间交火导致数以千计的网格体滞留 GPU 显存，重开对局时在途弹丸永久悬挂场景图 | **Critical** |
| **无索引弹道求交** | 子弹击发线性遍历全部坦克、卡车、战机、舰艇，并遍历 40 名士兵检测头球+柱体 | 40 人全自动开火时产生数万次求交测试；弹道尾部再次遍历全场士兵检测压制音效 | **High** |
| **高频爆炸射线穿透阻挡** | 每次爆炸对半径内所有步兵各发一条全图 DDA 射线检测掩体遮挡 | 大范围航弹/高爆弹爆炸瞬间产生 10~20 次全图射线步进与地形二分搜索，产生严重掉帧尖峰 | **High** |
| **物理热循环 GC 内存抖动** | `vehHitCyl` / `truckHitCyl` 每次调用返回全新字面量；`rayCyl` 每次命中分配新对象 | 每秒产生数万个临时对象，V8 引擎频繁触发 Minor GC 导致微卡顿与帧率毛刺 | **High** |
| **载具悬挂冗余网格遍历** | 每台坦克每帧执行 2 passes × 3 点推挤，加 4 个姿态角与 10~14 个负重轮的高度采样 | 单台坦克每帧触发 20+ 次 2D 网格遍历，平地行驶也全额跑满网格检测 | **High** |
| **大舰甲板推挤开销** | 每个士兵在 `collideMove` 中调用 `capPushBody`，内部执行即时闭包与临时数组分配 | 40 名士兵每帧 40 次闭包分配与多舰局部空间换算，增加 CPU 常驻开销 | **Medium** |
| **流体微分与角速度发散** | 舰艇航向角周期跨越 `[-PI, PI]` 时未做 `angDiff` 折叠，产生巨大虚拟角速度；dt 极小时未做除零隔离 | 舰艇转弯跨越 180 度边界时侧倾弹簧产生异常受力瞬移；极端低 dt 下存在 NaN 隐患 | **Medium** |

---

## 二、 Cannon.js 刚体引擎与碰撞检测缺陷 (Cannon.js Loop & Collisions)

### 1. 【Critical】Cannon.js 步进配置不当与时间累加器“死亡螺旋” (Spiral of Death)
- **相关文件与位置**:
  - `js/12-ragdolls.js:273` (`updateRagdolls`)
  - `js/24-main.js:141` (`updateRagdolls(dt)`)
- **代码片段**:
  ```javascript
  // js/12-ragdolls.js
  function updateRagdolls(dt){
    if(!RAG.world) return;
    if(!RAG.list.length&&!DEBRIS.list.length) return;
    RAG.world.step(1/60,Math.min(dt,0.05),2);
    // ...
  ```
- **问题分析**:
  1. **慢动作滞后 (Slow Motion Lag)**: Cannon.js 的 `world.step(fixedTimeStep, timeSinceLastCalled, maxSubSteps)` 采用基于累加器的固定步长积分。当帧率下降至 20~30 FPS 时（例如大规模交火、多爆炸发生时），`dt` 经常达到 `0.033s ~ 0.05s`。而 `fixedTimeStep` 为 `1/60s ≈ 0.01667s`。此时 `0.05 / 0.01667 ≈ 3` 个子步。然而，代码将 `maxSubSteps` 强制限制为 `2`！这意味着 Cannon.js 在该帧最多只模拟 `2 * (1/60) = 0.0333s` 的时间。剩下的 `0.0167s` 会堆积在 Cannon.js 内部的 `accumulator` 中。若低帧率持续，未结算的物理时间将不断堆积，物理表现为布娃娃倒地过程异常变慢，与整体游戏时钟严重脱节。
  2. **时停帧冗余积分**: 在观战模式下开启时停功能时，`dt = 0`。此时 `Math.min(0, 0.05) = 0`。尽管 Cannon.js 不会执行子步，但紧接着在 275 行仍然执行了 `r.t -= dt`、`ragDeckCarry` 以及 307 行 `updateDebris(dt)`，没有在一开始做 `if(dt <= 0) return;` 阻断。
- **优化建议**:
  ```javascript
  function updateRagdolls(dt){
    if(!RAG.world || dt <= 0) return;
    if(!RAG.list.length && !DEBRIS.list.length) return;
    // 根据当前最大 dt (0.05s) 设置合理的 maxSubSteps 为 3 或 4，防止时间丢失
    RAG.world.step(1/60, Math.min(dt, 0.05), 4);
    // ...
  ```

---

### 2. 【Critical】NaiveBroadphase 宽相与无碰撞分组导致的 O(N²) 碰撞对计算爆炸
- **相关文件与位置**:
  - `js/12-ragdolls.js:12-16` (`ragInit`)
  - `js/12-ragdolls.js:52-56` (`mkPart`)
  - `js/12-ragdolls.js:79-84` (头盔)
  - `js/12-ragdolls.js:146-151` (`spawnDebris`)
- **代码片段**:
  ```javascript
  // js/12-ragdolls.js:12-16
  RAG.world = new CANNON.World();
  RAG.world.gravity.set(0, -11, 0);
  RAG.world.broadphase = new CANNON.NaiveBroadphase();
  RAG.world.solver.iterations = 5;
  ```
- **问题分析**:
  1. **O(N²) 宽相复杂度**: 代码显式采用了 `CANNON.NaiveBroadphase`，该宽相器对物理世界中的全部刚体进行两两配对检测，时间复杂度为 $O(N^2)$。
  2. **刚体数量规模**:
     - 游戏中布娃娃最多保留 8 具 (`RAG.list.length >= 8` 轮替)，每具布娃娃包含 8 个独立刚体（骨盆、躯干、头、双臂、双腿、头盔），总计 $8 \times 8 = 64$ 个刚体；
     - 建筑碎块上限为 96 个 (`DEBRIS.list.length >= 96` 轮替)，每个碎块为 1 个独立刚体；
     - 当两者同时存在时，`RAG.world` 中的活动刚体数高达 $64 + 96 = 160$ 个！
  3. **计算对数爆炸**:
     - 在 160 个刚体下，`NaiveBroadphase` 每个子步进需执行 $\frac{160 \times 159}{2} = 12,720$ 次碰撞对检测；
     - 单帧步进 2 次就是 **25,440 次碰撞检测**！
  4. **完全无意义的狭相求解**:
     最严重的设计矛盾在于：**游戏根本不需要这些刚体相互碰撞！**
     - 布娃娃和碎块的地面支撑是依靠 JS 手工调用的 `heightAt` / `ragDeckGround`（行 251-257、280-300）完成的；
     - 与建筑物墙壁的碰撞是依靠 `ragCollide` 对 `BOXES` 栅格手工推挤完成的（行 180-215）；
     - 刚体彼此之间（例如碎块与碎块、尸体与碎块、不同尸体之间）完全不需要发生任何接触约束！
     - 但由于创建刚体时未配置 `collisionFilterGroup` 与 `collisionFilterMask`（默认均为 1），Cannon.js 会强行对这 12,720 个碰撞对执行狭相（Box-Box、Box-Sphere）相交测试与流形构建，白白耗费极多主线程毫秒数！
- **优化建议**:
  1. **关闭刚体间的物理碰撞**: 将碎块与布娃娃刚体的碰撞组掩码设为 0，彻底阻止 Cannon.js 内部的狭相计算：
     ```javascript
     body.collisionFilterGroup = 0;
     body.collisionFilterMask = 0;
     ```
  2. **改用 SAPBroadphase**: 若未来需要刚体间碰撞，必须切换为 `CANNON.SAPBroadphase(RAG.world)`（扫掠修剪算法），其复杂度为 $O(N \log N)$ 甚至在时间相干性下接近 $O(N)$。

---

### 3. 【High】布娃娃与碎块销毁时 Cannon 刚体与形状未彻底解构
- **相关文件与位置**:
  - `js/12-ragdolls.js:121-135` (`removeRagdoll`)
  - `js/12-ragdolls.js:158-162` (`removeDebrisEntry`)
- **代码片段**:
  ```javascript
  // js/12-ragdolls.js:121-135
  function removeRagdoll(r){
    const i = RAG.list.indexOf(r);
    if(i < 0) return;
    for(const c of r.cons) RAG.world.removeConstraint(c);
    for(const p of r.parts){
      if(RAG.world.removeBody) RAG.world.removeBody(p.body); else RAG.world.remove(p.body);
      scene.remove(p.mesh);
      const g = p.mesh && p.mesh.geometry;
      if(g && typeof g.dispose === 'function') g.dispose();
    }
    RAG.list.splice(i, 1);
  }
  ```
- **问题分析**:
  虽然代码修复了 Three.js 的 `geometry.dispose()`，但在 Cannon.js 侧：
  1. `removeConstraint` 和 `removeBody` 只是将对象从世界数组中剔除；
  2. `CANNON.Body` 内部的 `shapes` 数组与 `shapeToWorldInv`、`body.world` 引用没有被重置；
  3. 每个刚体创建的 `CANNON.Box`、`CANNON.Sphere` 及其底层的顶点数组长期滞留在内存中等待 GC。
- **优化建议**:
  在移除刚体时，解绑其形状与事件监听：
  ```javascript
  p.body.shapes.length = 0;
  p.body.shapeToWorldInv = null;
  p.body.world = null;
  ```

---

## 三、 弹道系统、击中判定与投掷物缺陷 (Ballistics & Hit Detection)

### 1. 【Critical】高速弹丸隧穿 Bug (Bullet & Flak Tunneling Bug)
- **相关文件与位置**:
  - `js/16-aircraft.js:1074-1088` (`updateFlak`)
  - `js/15-vehicles.js:1662-1721` (`updateShells`)
- **代码片段**:
  ```javascript
  // js/16-aircraft.js:1087-1088
  f.pos.addScaledVector(f.vel, fdt);
  let boom = f.life <= 0;
  // ...
  // 1113-1115 行: 检测步兵
  if(Math.hypot(s.pos.x - f.pos.x, s.pos.z - f.pos.z) < 1.1 && Math.abs((s.pos.y + 1) - f.pos.y) < 2.2){
    // ...
  ```
- **问题分析**:
  1. **高炮弹片完全隧穿**:
     `FLAK_SPD` 为 460 m/s。在 60 FPS 下单步位移为 $460 \times 0.0167 = 7.68$ 米；在 30 FPS 下单步位移高达 **15.3 米**！
     然而，`updateFlak` 仅在弹丸位移**之后**的点位置，检查是否距离步兵小于 1.1 米（半径 1.1m 的球）。
     当步兵厚度仅为 0.5 米左右时，单帧跨越 15 米的弹丸有高达 **90% 以上的概率直接飞越步兵**，没有任何接触线段（Swept Volume）连续碰撞检测 (CCD)，造成显而易见的高速弹穿人、穿掩体 Bug。
  2. **主炮与火箭弹重力项分离缺陷**:
     在 `updateShells` 中（行 1662-1721）：
     ```javascript
     const step = s.vel.length() * sdt;
     const dir = s.vel.clone().normalize(); // 计算了当前瞬时方向
     s.vel.y -= SHELL_G * sdt;              // 修改了速度的 Y 分量
     // ...
     const wr = raycastWorld(s.pos, dir, hitD); // 沿旧的 dir 发射射线
     // ...
     s.pos.addScaledVector(dir, step);          // 沿旧的 dir 前移
     ```
     在步进中，射线检测和位移推进均使用的是重力衰减前的 `dir`，而 `s.vel.y` 却在半途被改写。这导致实际移动轨迹与下一帧计算的初速方向产生折线漂移，在以小角度俯冲射击地面时极易发生穿透地皮判定。
- **优化建议**:
  1. 对高炮弹 (`updateFlak`) 实施线段扫掠（Swept Segment）：
     ```javascript
     const nextPos = f.pos.clone().addScaledVector(f.vel, fdt);
     // 检测线段 (f.pos -> nextPos) 与目标的距离，而非仅仅检测 nextPos
     ```
  2. 规范 `updateShells` 的积分顺序：先应用重力加速度，更新速度矢量，再根据最新的速度计算 `dir`、`step` 并做扫掠射线检测与位置推进。

---

### 2. 【Critical】投掷物/航弹资源未释放与对局重置中的场景图泄漏
- **相关文件与位置**:
  - `js/13-combat.js:424-434` (`throwNade`)
  - `js/13-combat.js:612-613` (`updateNades`)
  - `js/16-aircraft.js:345-357` (`dropBomb`)
  - `js/23b-worldrestore.js:168` (`clearMatchEffects`)
- **代码片段**:
  ```javascript
  // js/13-combat.js:612-613
  if(ev==='blow'){ scene.remove(n.m); nades.splice(i,1); nadeExplode(n); continue; }
  if(ev==='fizzle'){ waterSplash(n.pos,0.8,false,true); scene.remove(n.m); nades.splice(i,1); continue; }
  
  // js/23b-worldrestore.js:168
  try{ nades.length=0; }catch(e){}
  ```
- **问题分析**:
  1. **几何体与材质显存泄漏**:
     - 每次投掷手雷 (`throwNade`) 调用 `buildNadeMesh`，新建了包含 Sphere、Torus、Cylinder、Box 等 5~8 个子网格的 Mesh Group；
     - 每次投放航弹 (`dropBomb`) 均新建了 `SphereGeometry` 与 `MeshLambertMaterial`；
     - 当手雷引爆 (`ev==='blow'`) 或落水熄火 (`ev==='fizzle'`) 时，代码仅执行了 `scene.remove(n.m)`，**从未对其子几何体调用 `dispose()`**！随着战斗进行，投出的数百枚手雷造成 GPU 几何显存持续泄漏。
  2. **对局重置导致幽灵网格留在场景中**:
     在游戏对局结束或重新开始时，`js/23b-worldrestore.js` 仅简单粗暴地执行 `nades.length = 0`。
     如果重置发生时场上有尚未引爆的飞行中手雷或航弹，这些网格体**连 `scene.remove()` 都没有被调用**，它们将永久遗留在 Three.js 主场景的渲染树中，成为看不见或定格在半空的幽灵网格！
- **优化建议**:
  1. 为投掷物建立销毁清理辅助函数：
     ```javascript
     function disposeNadeMesh(mesh){
       if(!mesh) return;
       scene.remove(mesh);
       mesh.traverse(child => {
         if(child.isMesh){
           if(child.geometry) child.geometry.dispose();
           // 若为独立创建材质则 dispose
         }
       });
     }
     ```
  2. 在 `updateNades` 引爆/熄火处及 `23b-worldrestore.js` 重置处全量调用该函数清理。

---

### 3. 【High】`fireBullet` 无索引空间查询与全量士兵压制遍历
- **相关文件与位置**:
  - `js/13-combat.js:207-366` (`fireBullet`)
  - `js/13-combat.js:173-196` (`raySoldiers`)
- **代码片段**:
  ```javascript
  // js/13-combat.js:224-233
  for(const t of tanks){ if(!t.alive) continue; const r=rayCyl(origin,dir,vehHitCyl(t),wallD); ... }
  for(const t of trucks){ if(!t.alive) continue; const r=rayCyl(origin,dir,truckHitCyl(t),wallD); ... }
  // ...
  // 351-363 行: 压制音效检测
  for(const s of soldiers){
    if(shooter.spectator) break;
    if(!s.alive||s.team===shooter.team) continue;
    const relX=s.pos.x-origin.x, relY=s.pos.y+1.4-origin.y, relZ=s.pos.z-origin.z;
    const tp=relX*dir.x+relY*dir.y+relZ*dir.z;
    if(tp>2&&tp<endD+1){
      const cx=origin.x+dir.x*tp-s.pos.x, cy=origin.y+dir.y*tp-(s.pos.y+1.4), cz=origin.z+dir.z*tp-s.pos.z;
      if(cx*cx+cy*cy+cz*cz<6){ s.suppression=Math.min(1.6,s.suppression+0.35); s.noticeThreat(shooter); }
    }
  }
  ```
- **问题分析**:
  1. **全场 O(N) 线性扫描**:
     在 `fireBullet` 中，每一发子弹都需要依次检测静态世界、水面、所有坦克、所有卡车、战机、舰艇，然后进入 `raySoldiers` 对全部 40 名存活士兵进行头球与身柱的双重碰撞求交。
  2. **双重全量士兵遍历**:
     当命中判定结束后，在 351-363 行，代码为了判定超声压制音效（Whizz）和压制值累加，**再次对全场所有士兵遍历了一遍**，计算每名士兵到弹道线段的垂直距离！
  3. **计算量分析**:
     当 40 名 Bot 与玩家持冲锋枪/机枪对射时，场景中平均每秒发射 200~400 发子弹。
     每秒产生的士兵求交检测次数为：$300 \times (40 + 40) = 24,000$ 次！这完全没有利用任何 2D/3D 空间分区网格加速。
- **优化建议**:
  1. 将存活步兵挂载到轻量级的 2D 空间栅格或粗粒度分块（Bucket Grid）中，射击时仅检测弹道包围盒覆盖的网格单元中的步兵；
  2. 将压制检测（Whizz）与射击命中检测合并为单次遍历，避免二次循环。

---

### 4. 【High】爆炸波阻挡判定全量触发密集 DDA 栅格光线投射
- **相关文件与位置**:
  - `js/13-combat.js:685-688` (`explodeAt`)
  - `js/13-combat.js:777-780` (`splashDamage`)
- **代码片段**:
  ```javascript
  // js/13-combat.js:776-780
  if(d>0.6){
    const dir=V3(s.pos.x-p.x,s.pos.y+0.9-p.y,s.pos.z-p.z).normalize();
    const block=raycastWorld(V3(p.x,p.y+0.25,p.z),dir,d);
    if(block&&block.dist<d-0.5) dmg*=0.25;
  }
  ```
- **问题分析**:
  当一颗手雷、航弹或大口径高爆弹爆炸时，半径 10~13 米内往往聚集了 5~15 名士兵。
  代码对圈内每一个士兵，均执行 `raycastWorld` 射线检测。`raycastWorld` 会执行：
  - DDA 2D 栅格遍历（最长步进达 70 步）；
  - `BOXES` 与 `CYLS` 的去重比对与精确 `rayBox` / `rayCyl` 求交；
  - 若 `dir.y < 0.35`，还会沿着射线进行步长 1.8m 的地形高度步进，并嵌套 6 次二分高度搜索！
  多名士兵同时处于爆圈内时，在同一帧内瞬间触发 15 次全图级 DDA 射线与近百次高度二分采样，极易引发掉帧卡顿。
- **优化建议**:
  1. 爆炸射线阻挡检测应限定最大检测距离为爆圈半径 $R$，并将射线终点约束在目标格内；
  2. 阻挡判定只关心“是否存在遮挡物”，一旦发现任何阻挡距离小于 $d - 0.5$ 应立即 `break` 退出遍历，无需通过 `raycastWorld` 求解全局最小距离与法向量；
  3. 屏蔽非必要的低仰角地形高度二分搜索（地形起伏不应阻挡爆炸近距破片）。

---

## 四、 载具模拟、流体动力学与大舰物理缺陷 (Vehicles & Naval Physics)

### 1. 【High】陆战载具多通道悬挂与路轮每帧密集网格查询
- **相关文件与位置**:
  - `js/15-vehicles.js:833-840` (`Tank.prototype.update` 碰撞推挤)
  - `js/15-vehicles.js:949-969` (`Tank.prototype.update` 悬挂与负重轮)
  - `js/15-vehicles.js:257-276` (`tankSurfH`)
  - `js/15c-specveh.js:123-166` (`GhostTank.prototype.update`)
- **代码片段**:
  ```javascript
  // js/15-vehicles.js:949-969
  const hF=tankSurfH(this.pos.x+sn2*2.4,this.pos.z+cs2*2.4), hB=tankSurfH(this.pos.x-sn2*2.4,this.pos.z-cs2*2.4);
  const hL=tankSurfH(this.pos.x-cs2*1.6,this.pos.z+sn2*1.6), hR=tankSurfH(this.pos.x+cs2*1.6,this.pos.z-sn2*1.6);
  // ...
  for(const wh of this.wheels){
    // ...
    const wgh=tankSurfH(wx,wz);
    // ...
  }
  ```
- **问题分析**:
  1. `tankSurfH` 内部不仅调用 `heightAt(x,z)`，还调用了 `eachBoxNear` 与 `eachCylNear` 检索障碍物顶面。
  2. 单台坦克每帧更新：
     - 碰撞推挤解算：2 passes × 3 个沿车身分布的采样圆 = **6 次网格查询**；
     - 底盘爬升：`tankRideH` = **1 次网格查询**；
     - 车体俯仰与侧倾姿态：前、后、左、右各 1 次 = **4 次网格查询**；
     - 独立负重轮行程模拟：每台坦克有 10~14 个负重轮，每个轮子每帧调用 1 次 `tankSurfH` = **10~14 次网格查询**！
  3. 单台坦克单帧调用高达 **21 ~ 25 次空间网格查询**。全场若有 4 辆坦克加 2 辆卡车加幽灵坦克，每帧执行近 **150 次网格遍历**。在绝大多数开阔平原地形上，这些查询 99% 的情况下 `BOXES` 候选集为空，造成极大 CPU 浪费。
- **优化建议**:
  1. 负重轮物理分级 (LOD)：对于远距离坦克或非玩家视角坦克，负重轮高度直接复用车体刚体高度加静态偏移，禁止逐轮执行 `tankSurfH`；
  2. 缓存网格标记：仅当坦克周围特定范围内存在 `crush` 或低矮障碍物时，才启用 `tankSurfH` 的盒子遍历，否则直接回退为极其轻量的 `heightAt(x, z)`。

---

### 2. 【Medium】大舰多舱室推挤在士兵循环中的闭包开销与重复空间解算
- **相关文件与位置**:
  - `js/04-collision.js:181` (`collideMove`)
  - `js/15h-capital.js:232-289` (`capPushBody`)
- **代码片段**:
  ```javascript
  // js/15h-capital.js:238-246
  const sup=(()=>{
    for(const s of capitalShips){
      if(pos.y<s.pos.y+s.deck.y-CAPITAL_CFG.stepUp) continue;
      capToLocal(s,pos.x,pos.z,_capL);
      if(!capDeckIn(s,_capL.x,_capL.z,-1.2)) continue;
      return s;
    }
    return null;
  })();
  ```
- **问题分析**:
  1. **闭包函数每帧频繁实例化**:
     在 `capPushBody` 的开头，通过立即执行的箭头函数表达式 `const sup = (() => { ... })()` 来判定当前脚下的承载舰艇。
     由于 `capPushBody` 在步兵物理移动 `collideMove` 中被调用，全场 40 名士兵每帧都会执行此闭包创建，产生无意义的垃圾回收开销。
  2. **冗余局部空间变换**:
     40 名士兵在陆地上行动时，虽然首行有 `if(!capitalShips.length) return;` 保护，但在海战地图上，所有在海滩、礁盘上的士兵每帧都会把坐标转换到每一艘大舰的局部坐标系中进行包围盒计算，缺乏粗粒度外接球过滤。
- **优化建议**:
  1. 消除立即执行闭包，改用普通局部变量循环；
  2. 在进行矩阵变换前，先计算士兵与大舰中心点的 2D 距离粗筛：`if (Math.abs(pos.x - s.pos.x) > s.spec.hullL * 0.5 + 10) continue;`。

---

### 3. 【Medium】海战流体微分角速度与除零数值风险
- **相关文件与位置**:
  - `js/15d-naval.js:964-966` (`NavalCraft._attitude`)
  - `js/15-vehicles.js:952` (`Tank.prototype.update`)
- **代码片段**:
  ```javascript
  // js/15d-naval.js:964-967
  const yawRate=(this.yaw-this._prevYaw)/dt;
  this._prevYaw=this.yaw;
  const accel=(this.vel-this.lastVel)/dt;
  this.lastVel=this.vel;
  ```
- **问题分析**:
  1. **角度环绕跳变引发巨大角速度脉冲**:
     `this.yaw` 的范围在 `[-Math.PI, Math.PI]`。当舰艇转向跨越 $\pm\pi$ 边界时（例如从 $3.14$ 转到 $-3.14$），`this.yaw - this._prevYaw` 瞬时达到约 $-6.28$！
     除以 $dt \approx 0.016$ 后，`yawRate` 瞬时变为 **$-392.5\text{ rad/s}$**！
     随后在 975 行计算侧倾 `lat = clamp(this.vel * yawRate, -3.2, 3.2)`，虽然有 `clamp` 限幅，但侧倾弹簧在此瞬间仍会遭受极限满格冲击，产生剧烈的视觉抽搐与弹簧过冲。
  2. **除零与极小步长未保护**:
     代码仅在 729 行有 `if(!(dt>0)) return;`，当 $dt$ 极小（如从后台唤醒或探针测试中 $dt = 10^{-7}$）时，`1 / dt` 会暴增至数千万，加速项计算存在溢出为 `Infinity` 进而污染 `rollV` / `roll` 变成 `NaN` 的隐患。
- **优化建议**:
  计算角速度差值必须使用环绕角修正函数 `angDiff`，并设定最小有效 $dt$：
  ```javascript
  const safeDt = Math.max(dt, 0.001);
  const yawDiff = angDiff(this.yaw, this._prevYaw);
  const yawRate = yawDiff / safeDt;
  this._prevYaw = this.yaw;
  const accel = (this.vel - this.lastVel) / safeDt;
  ```

---

## 五、 热循环垃圾回收 (GC Churn) 深度审计

### 1. 【High】`vehHitCyl` 与 `truckHitCyl` 高频临时对象分配
- **相关文件与位置**:
  - `js/15-vehicles.js:29-33`
  - `js/13-combat.js:226, 231` (`fireBullet`)
  - `js/15-vehicles.js:1686, 1691` (`updateShells`)
  - `js/20-player.js:1296-1297` (玩家准星拾取)
- **代码片段**:
  ```javascript
  // js/15-vehicles.js:29-30
  function vehHitCyl(t){ return {x:t.pos.x,z:t.pos.z,r:2.3,y0:t.pos.y,y1:t.pos.y+VEH_HIT_TOP}; }
  function truckHitCyl(t){ return {x:t.pos.x,z:t.pos.z,r:2.2,y0:t.pos.y+0.2,y1:t.pos.y+2.5}; }
  ```
- **问题分析**:
  `vehHitCyl` 与 `truckHitCyl` 是全库所有子弹、炮弹、火箭、观战索敌检测载具碰撞的核心接口。
  该函数内部**每次调用都返回一个新的对象字面量**。
  - 在 `fireBullet` 中，每颗子弹循环检测全场坦克与卡车，每次检测调用 1 次；
  - 在 `updateShells` 中，每颗炮弹每帧检测全场坦克与卡车，每次检测调用 1 次；
  - 在玩家每帧准星悬停检测中调用；
  - 在 40 人密集交火战场中，每秒仅此一处就能产生 **5,000 ~ 15,000 个垃圾对象**，直接加剧 V8 新生代内存区（Scavenge GC）的频繁垃圾回收。
- **优化建议**:
  将碰撞柱直接预分配并保存在载具实例自身上，或使用全局复用槽：
  ```javascript
  // 在 Tank / Truck 构造函数中初始化:
  this.hitCyl = { x: 0, z: 0, r: 2.3, y0: 0, y1: 0 };
  
  // 改造 vehHitCyl:
  function vehHitCyl(t){
    const c = t.hitCyl;
    c.x = t.pos.x; c.z = t.pos.z;
    c.y0 = t.pos.y; c.y1 = t.pos.y + VEH_HIT_TOP;
    return c;
  }
  ```

---

### 2. 【High】`rayCyl` 每次命中分配新结果对象
- **相关文件与位置**:
  - `js/03-terrain.js:1376-1392` (`rayCyl`)
- **代码片段**:
  ```javascript
  // js/03-terrain.js:1391
  return { t, nx, ny:0, nz };
  ```
- **对比分析**:
  同文件下方的 `rayBox`（行 1373）使用了全局预分配对象 `_rbR`:
  ```javascript
  _rbR.t=tmin; _rbR.nx=axis===0?sign:0; _rbR.ny=axis===1?sign:0; _rbR.nz=axis===2?sign:0;
  return _rbR;
  ```
  而 `rayCyl` 在求交成功时却每次 `return { t, nx, ny:0, nz }`，重新开辟内存！
  在所有树干、电线杆、士兵身体、载具圆柱求交命中时，持续产生微对象。
- **优化建议**:
  参照 `rayBox`，为 `rayCyl` 引入静态复用槽：
  ```javascript
  const _rcylR = { t: 0, nx: 0, ny: 0, nz: 0 };
  function rayCyl(o, dir, c, maxD){
    // ...
    _rcylR.t = t; _rcylR.nx = nx; _rcylR.ny = 0; _rcylR.nz = nz;
    return _rcylR;
  }
  ```

---

### 3. 【Medium】弹道与爆炸计算中的临时 Vector3 / V3 狂暴分配
- **相关文件与位置**:
  - `js/13-combat.js:338-340`: `RV.dot(V3(origin.x-camera.position.x,0,origin.z-camera.position.z).normalize())` (每枪分配)
  - `js/13-combat.js:685`: `const dir=V3(s.pos.x-p.x,s.pos.y+0.9-p.y,s.pos.z-p.z).normalize()` (爆炸每人分配)
  - `js/13-combat.js:777`: `const dir=V3(s.pos.x-p.x,s.pos.y+0.9-p.y,s.pos.z-p.z).normalize()` (溅射每人分配)
  - `js/15-vehicles.js:1663`: `const dir=s.vel.clone().normalize()` (每炮弹每帧分配)
  - `js/15-vehicles.js:1697`: `const p=V3(...)` (炮弹命中分配)
- **优化建议**:
  设立专用物理临时向量槽池（如 `_physV1`, `_physV2`, `_physDir`），彻底消灭战斗热循环中的 `clone()` 与 `V3()`。

---

## 六、 物理优化路线与改造方案 (Actionable Optimization Roadmap)

### 阶段一：稳定性与严重漏洞修复 (Critical Fixes)
1. **重构投掷物资源生命周期**:
   - 在 `updateNades` 中引爆或入水时，对 `n.m` 递归调用 `dispose()`；
   - 修复 `js/23b-worldrestore.js:168`，清空 `nades` 前必须先从 `scene` 移除并彻底释放所有残留模型。
2. **消减 Cannon.js 冗余碰撞计算**:
   - 将所有布娃娃部件与建筑碎块的刚体 `collisionFilterGroup` 与 `collisionFilterMask` 置为 `0`；
   - 彻底关闭 Cannon.js 内部 12,720 次/步的无效狭相碰撞求解，保留其单纯的质量、重力与点对点约束动力学。
3. **修复高速弹丸连续碰撞 (CCD)**:
   - 对高炮弹 `updateFlak` 引入前向线段检测，杜绝 460m/s 高速弹穿人 Bug；
   - 规范 `updateShells` 的重力更新与射线扫掠顺序。

### 阶段二：热循环 GC 清理与性能减负 (High-Priority GC & Query Optimization)
1. **消除碰撞几何字面量分配**:
   - 将 `vehHitCyl` 与 `truckHitCyl` 改造为返回实例自带的 `hitCyl` 引用；
   - 将 `rayCyl` 的返回对象改造为静态复用单例槽 `_rcylR`。
2. **轻量化爆炸遮挡检测**:
   - 限制爆炸遮挡射线的最大遍历距离为爆圈半径；
   - 发现第一个阻挡物立即早退，剥离低仰角地形二分高度检测。
3. **分级载具悬挂网格采样 (LOD)**:
   - 仅对玩家操控或 50 米以内的坦克执行路轮级 `tankSurfH` 采样；
   - 远距离载具负重轮直接绑定车体平面高，平地行驶跳过 `eachBoxNear` 检索。

### 阶段三：空间架构优化 (Architectural Enhancements)
1. **引入轻量动态实体栅格 (Dynamic Actor Grid)**:
   - 建立粗粒度（如 16m × 16m）的动态实体分区，将 40 名士兵与载具登记入格；
   - 子弹与爆炸判定仅检索相交栅格内的实体，将单发子弹的命中判定与压制检测复杂度从 $O(N)$ 降低至 $O(1)$。
2. **数值防护与步长防护**:
   - 对海战与载具的角速度计算引入 `angDiff` 环绕校正，杜绝跨越 $\pi$ 边界时的数值飞车。
