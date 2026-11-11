# Comprehensive Audit Report: AI, Navigation, Player Controller, HUD/DOM, WebAudio, & Match Lifecycle

> **文档管理规则**: **未完成的文档需要放在主目录，完成了的文档需要放到finished-docs文件夹**。本文档为已定稿的专项技术审计成果，存放于 `finished-docs/audit-reports/` 供性能优化与架构重构参考。

**Auditor:** `teammate-ai-systems`  
**Focus Files:**  
- `js/14-bots.js` (Bot AI, Perception, State Machine, Movement)  
- `js/07-nav.js` (A* Search, Navmesh, Connectivity Components)  
- `js/20-player.js` & `js/20a-seats.js` (Player Controller, Seat Management, Cameras, Interaction)  
- `js/22-hud.js` (HUD Hot Loop, DOM Reflows, Minimap & Compass 2D Canvas)  
- `js/01-audio.js` (WebAudio Graph, Pooling, Node Lifecycle, Timers)  
- `js/21-match.js` & `js/23b-worldrestore.js` & `js/18-game.js` (Match Lifecycle, Actor Retirement, State Reset)

---

## 1. Executive Summary

This deep-dive architectural and performance audit inspected the core gameplay simulation loop, artificial intelligence, navigation pathfinding, player vehicle/seat controller, user interface rendering, and audio engine. 

While the codebase has received several targeted bug fixes, multiple critical performance bottlenecks, garbage collection (GC) churn sources, unmetered raycast floods, DOM thrashing loops, memory leaks, and gameplay state corruption bugs were identified:

1. **AI & Perception Scalability:** Bot perception and target validation perform un-throttled physics raycasts (`raycastWorld`) and multi-layer line-of-sight checks against all combatants without spatial clustering or budget caps. With 32–64 bots, this generates thousands of raycasts per second. In movement steering, a single bot can perform up to 7 physics raycasts *per frame*.
2. **Navmesh Search & Data Structures:** The bi-directional A* search executes `heapPos.fill(-1)` (33,282 entries) on every single path request, and triggers a full $O(N^2)$ (16,641 iteration) array scan whenever the search trees fail to meet. Furthermore, incremental component re-labeling (`relabelRegion`) increments `compNext` indefinitely, causing `csize` to grow monotonically into a sparse array across long matches.
3. **Vehicle & Seat Logic Bugs:** Exiting a tank via the `F` key fails to reset `player.tankView = false`. If the player dismounts while in tank gunner sight mode, the scope overlay (`#scopeOv`) remains permanently frozen on the screen during infantry gameplay.
4. **HUD DOM Thrashing & Canvas Overhead:** The HUD hot loop contains cached writing helpers (`hudText`, `_hw`), but bypasses them for weapons, ammunition, match clocks, and squad info, writing unconditional `.textContent`, `.style.color`, and `.innerHTML` updates every single frame. The minimap recalculates `Math.cos`/`Math.sin` hundreds of times per tick and generates hundreds of temporary coordinate arrays.
5. **WebAudio Node Leaks:** Every gunshot, explosion, and impact creates 5–15 ephemeral Web Audio nodes (`GainNode`, `BiquadFilterNode`, `StereoPannerNode`) that are connected to the compressor but **never disconnected** via `disconnect()`. There is no node pooling, resulting in massive GC pressure and audio thread buffer allocation churn. Background interval timers also run indefinitely across matches.
6. **Lifecycle & Reset Leaks:** `setTimeout` handlers for player respawn/deploy screens and match finish screens lack cancellation handles. If a player returns to the main menu shortly after dying or finishing a match, orphaned callbacks fire seconds later and force open in-game HUD/deploy screens over the main menu. On match reset, Three.js geometries and materials of retired actors are disconnected from parent nodes but never `.dispose()`-d, leaking WebGL GPU buffers.

---

## 2. Bot AI Loop Scalability & CPU Bottlenecks (`js/14-bots.js`)

### 2.1 O(N²) Loops and Perception Raycast Floods
- **File & Lines:** `js/14-bots.js`: 598–643 (`perceive`), 3140–3151 (`navTorpWindow` infantry cluster scan)
- **Severity:** **Critical**
- **Description:**
  1. In `perceive()` (lines 606–643), every active bot iterates through all `combatants`. For each enemy passing distance and FOV filters, the bot runs:
     - `raycastWorld(eye, dir, dist)`
     - `smokeBlocksLOS(...)`
     - `cropBlocksLOS(...)`
     - `foliageBlocksLOS(...)`
     - `headDepthAt(...)`
     Bot perception runs every `0.16s` (`perceptT`). With 64 bots (32 vs 32), approximately 400 `perceive()` calls fire per second. If each bot checks an average of 10 visible enemies, this produces **~4,000 raycast queries per second** purely for line-of-sight polling, without any global raycast budget, time-slicing, or spatial hash acceleration.
  2. In gunboat target evaluation (`navTorpWindow`, lines 3140–3151), the AI scans for enemy infantry clusters:
     ```javascript
     for (const s of soldiers) {
       // ...
       for (const s2 of soldiers) {
         if (s2.alive && s2.team === team && Math.hypot(s2.pos.x - s.pos.x, s2.pos.z - s.pos.z) < 14) n++;
       }
       if (n < 2) continue;
       if (!navLOS(...)) continue;
     }
     ```
     This is an explicit $O(N^2)$ nested loop over all soldiers, with nested `Math.hypot` calculations and inner `navLOS` physics raycasts.
- **Recommended Optimization:**
  - Implement a shared spatial hash grid (e.g. 20m cells) for perception and cluster queries.
  - Impose a per-frame perception raycast budget (e.g., maximum 8–12 LOS raycasts across all bots per frame, staggered by priority/distance).
  - Use spatial cell entity counts instead of nested $O(N^2)$ loops over all soldiers.

---

### 2.2 Per-frame Steering Raycast Flood in `moveDir`
- **File & Lines:** `js/14-bots.js`: 2077–2089
- **Severity:** **High**
- **Description:**
  When bots navigate and move, `moveDir` performs local obstacle avoidance using `probe(a)`:
  ```javascript
  const probe = (a) => {
    const px = this.pos.x + Math.sin(a) * 1.1, pz = this.pos.z + Math.cos(a) * 1.1;
    if (occBlocked(px, pz, this.swim || this.onCapDeck)) return false;
    const low = raycastWorld(_prO.set(this.pos.x, this.pos.y + 0.35, this.pos.z), _prD.set(Math.sin(a), 0, Math.cos(a)), 1.1);
    return !low;
  };
  if (!probe(yaw)) {
    for (const da of [0.55, -0.55, 1.1, -1.1, 1.65, -1.65]) {
      if (probe(yaw + da)) { yaw += da; found = true; break; }
    }
  }
  ```
  If the forward direction is obstructed, the bot probes up to 6 alternate angles. Each probe executes `raycastWorld`. In dense areas, a single bot executes **up to 7 physics raycasts every frame**. For 50 moving bots, this peaks at **350 raycasts per frame** (over 20,000 raycasts/second at 60 FPS).
- **Recommended Optimization:**
  - Rely primarily on 2D occupancy raster (`occBlocked`) and elevation checks (`heightAt`) for local obstacle clearance.
  - Throttle knee-height physics raycasts to only fire when the bot has detected zero movement velocity (`stuckT > 0.2s`), rather than proactively every frame for every moving bot.

---

### 2.3 Single-Bot Pathfinding Budget Exhaustion in `stepToward`
- **File & Lines:** `js/14-bots.js`: 1161–1174, 1177–1186
- **Severity:** **High**
- **Description:**
  When a bot cannot find a direct path to an objective, `pushToward` calls `stepToward`:
  ```javascript
  for (let f = frac; f >= 0.25; f -= 0.25) {
    const px = this.pos.x + dx * f, pz = this.pos.z + dz * f;
    if (occBlocked(px, pz, true) || !freeSpot(px, pz, 0.6)) continue;
    if (this.setPathTo(px, pz)) return this.path;
  }
  ```
  `NAV.budget` is reset to `2` per frame in `24-main.js:75`. In `setPathTo`:
  ```javascript
  if (NAV.budget <= 0) { ... return false; }
  NAV.budget--;
  const p = NAV.findPath(this.pos.x, this.pos.z, x, z);
  ```
  If `stepToward` tests `f = 0.75`, `0.5`, `0.25`, and the first attempt fails, it immediately calls `setPathTo` on the next fraction during the *same frame*. A single bot in `stepToward` consumes the entire global frame budget (`NAV.budget`), starving all other bots from repathing.
- **Recommended Optimization:**
  - Cap each bot to at most **one** `setPathTo` call per frame. If it fails, schedule the fallback fraction search for the next frame.

---

### 2.4 High-frequency Garbage Collection (GC) Churn from Vector Allocations
- **File & Lines:** `js/14-bots.js`: 413, 2204, 2210, 2220, 2240, 2585, 2780, 3718
- **Severity:** **Medium**
- **Description:**
  Bots allocate temporary `THREE.Vector3` objects directly in combat and raycasting routines:
  - Line 413: `eyePos() { return V3(this.pos.x, this.pos.y + ..., this.pos.z); }` allocates a new `Vector3` every invocation. Called in lines 764, 776, 852, 1609, 1630, 1897, 2220, 3800.
  - Line 2240 in `aimShot`:
    `const muzzleP = eye.clone().addScaledVector(V3(Math.sin(this.yaw), this.pitch * 0.5, Math.cos(this.yaw)).normalize(), 0.7);`
    Clones `eye`, creates `V3()`, and passes `muzzleP` to `fireBullet`.
  - Line 2780: `raycastWorld(V3(ox,oy,oz), V3(hx/l,hy/l,hz/l), ...)` allocates 2 vectors per raycast.
  With hundreds of bullets fired per minute across 64 bots, thousands of `Vector3` objects are allocated and discarded, triggering V8 minor GC pauses.
- **Recommended Optimization:**
  - Utilize module-level reusable scratch vectors (`_tempV1`, `_tempV2`, `_eyePos`) rather than allocating new vectors or calling `.clone()`.

---

### 2.5 Unculled Animation & Leg IK Computation for Distant Bots
- **File & Lines:** `js/14-bots.js`: 2248–2320 (`updateMesh`)
- **Severity:** **Medium**
- **Description:**
  `updateMesh(dt, speed)` runs every frame for every active bot. It performs dampening calculations on `pelvis.position.y`, `pelvis.rotation.x`, `headG.rotation.y`, solves two-link analytical inverse kinematics for both legs (`legIK`, lines 2285–2290 and 2303–2310), and updates arm rotations.
  There is no distance culling or frustum culling. Bots that are 300 meters away, completely outside the player's view or occluded behind terrain/buildings, compute full leg IK and bone rotations at 60 FPS.
- **Recommended Optimization:**
  - Add LOD/distance culling: For bots further than 80m from the camera (or outside the camera frustum), skip leg IK and complex bone dampening, or update animations at a reduced frequency (e.g. 15 Hz).

---

## 3. Navmesh & A* Pathfinding Bottlenecks (`js/07-nav.js`)

### 3.1 Unbounded Array Growth (`compNext` and `csize`)
- **File & Lines:** `js/07-nav.js`: 73, 142, 170, 175
- **Severity:** **High**
- **Description:**
  Connected component IDs are stored in `comp` (`Int32Array(NN)`) and component sizes are stored in `csize` (`Array`).
  In `relabelRegion` (lines 170, 175):
  ```javascript
  csize[compNext] = bfsFill(sd, compNext); compNext++;
  // ...
  csize[compNext] = bfsFill(k, compNext); compNext++;
  ```
  `compNext` is an incrementing integer. It is only reset to `cid` during a full bake (`bakeComponents`, line 111).
  In matches with dynamic destructible walls, building collapses, or spreading fires, `bakeRegion` and `relabelRegion` are called repeatedly. `compNext` increases without bound, and `csize` expands into an ever-growing sparse JavaScript array, causing memory bloat and de-optimization of array lookups.
- **Recommended Optimization:**
  - Re-use freed component IDs from `ids` in `relabelRegion` rather than monotonically incrementing `compNext`, or compact/reset component tables periodically.

---

### 3.2 Full-Grid `NN` (16,641 iter) Scan on A* Convergence Miss
- **File & Lines:** `js/07-nav.js`: 405–414
- **Severity:** **High**
- **Description:**
  When bi-directional A* fails to find an established meet node in the closed set (`bestMeet < 0`), it falls back to a linear scan:
  ```javascript
  if (bestMeet < 0) {
    let bh = -1, bc = Infinity;
    for (let k = 0; k < NN; k++) {
      if (visitGen[k] !== gen && visitGen[k] !== gen + 1) continue;
      if (visitGenB[k] !== gen && visitGenB[k] !== gen + 1) continue;
      const c = gScore[k] + gScoreB[k];
      if (c < bc) { bc = c; bh = k; }
    }
    if (bh >= 0) { bestMeet = bh; bestCost = bc; }
  }
  ```
  `NN = N * N = 129 * 129 = 16,641`. Whenever two search trees do not settle on an optimal intersection point, this executes a 16,641-iteration loop across typed arrays on the main thread.
- **Recommended Optimization:**
  - Track touched frontier nodes during expansion in a small fixed-size buffer instead of scanning the entire map grid of 16,641 cells.

---

### 3.3 Large TypedArray Scrubbing Overhead (`heapPos.fill(-1)`)
- **File & Lines:** `js/07-nav.js`: 222, 299
- **Severity:** **Medium**
- **Description:**
  `heapPos` is an `Int32Array(NN * 2)` (33,282 elements).
  Line 299 executes:
  `heapPos.fill(-1);`
  This runs on **every invocation** of `findPath`. While typed array fills are fast, writing 33,282 elements sequentially multiple times per frame adds unnecessary cache pollution and CPU overhead.
- **Recommended Optimization:**
  - Only reset `heapPos` entries that were actually modified during the search (track touched indices in an array or stack, and reset only those indices when the search finishes).

---

### 3.4 Allocation Overhead in Path Reconstruction & Smoothing
- **File & Lines:** `js/07-nav.js`: 242, 259–276, 419–427, 441–464
- **Severity:** **Low**
- **Description:**
  1. `toG(sx, sz)` returns `[clamp(...), clamp(...)]`, allocating a 2-element array twice per path search.
  2. `fix(si, sj)` returns `[i, j]` or fallback `[i + di, j + dj]`.
  3. Path reconstruction (lines 421, 425) allocates `path.push([x, z])` tuples for every grid step, then copies them to `sm.push(path[far])`.
- **Recommended Optimization:**
  - Store paths as flat coordinate arrays `[x0, z0, x1, z1, ...]` or pre-allocate waypoint structures.

---

## 4. Player Controller, Seats, & Interaction Logic (`js/20-player.js`, `js/20a-seats.js`)

### 4.1 Critical Logic Bug: `player.tankView` Stuck on Vehicle Dismount
- **File & Lines:** `js/20-player.js`: 292–304; `js/20-player.js`: 1947–1959
- **Severity:** **Critical**
- **Description:**
  When a player in a tank presses `KeyC`, `player.tankView` toggles to `true` (`js/19-input.js:171`), switching the camera to gunner optics and displaying the scope overlay:
  `document.getElementById('scopeOv').style.display = 'block';` (`js/20-player.js:1956`).
  When the player exits the tank by pressing `F` (`js/20-player.js:276–304`):
  ```javascript
  t.playerDriven = false; t.isAI = true; t.vel = 0;
  player.onVehicle = null;
  // ... position offset search ...
  player.pos.y = standHeight(...);
  player.vel.set(0, 0, 0);
  VM.root.visible = true;
  document.getElementById('heatWrap').style.display = 'none';
  return;
  ```
  **`player.tankView` is NOT reset to `false`.**
  Furthermore, `updateCamera` skips the `if (p.onVehicle)` block because `p.onVehicle` is now `null`. Therefore, line 1959 (`scopeOv.style.display = 'none'`) is never reached.
  As a result:
  1. The sniper/tank scope overlay (`#scopeOv`) **remains permanently stuck on screen** while the player walks as infantry.
  2. If the player re-enters any vehicle, their camera starts in gunner sight mode unexpectedly.
- **Recommended Optimization:**
  In `js/20-player.js` line 293 (and wherever vehicles are exited), explicitly reset `player.tankView = false;` and ensure `document.getElementById('scopeOv').style.display = 'none';`.

---

### 4.2 Blocked Dismount Position Overwrite Fallback
- **File & Lines:** `js/20-player.js`: 294–298
- **Severity:** **Medium**
- **Description:**
  When exiting a tank, candidate positions are checked:
  ```javascript
  for (const off of [[3.2, 0], [-3.2, 0], [0, 4], [0, -4], [4, 4]]) {
    const px = t.pos.x + off[0], pz = t.pos.z + off[1];
    if (!occBlocked(px, pz)) { player.pos.set(px, 0, pz); break; }
    player.pos.set(t.pos.x + 3.2, 0, t.pos.z);
  }
  ```
  Notice line 297: `player.pos.set(t.pos.x + 3.2, 0, t.pos.z);` is inside the `for` loop body without an `else` guard. If `[3.2, 0]` is blocked by a wall or rock, line 297 sets `player.pos` to that blocked coordinate anyway. If none of the 5 offsets are clear, the player is left inside the blocked object.
- **Recommended Optimization:**
  Move the fallback assignment outside the loop and use `NAV.spawnSpot(t.pos.x, t.pos.z, 6)` or a verified free location.

---

### 4.3 High-Cost Raycasts & Trajectory Steps in Vehicle Update Loops
- **File & Lines:** `js/20a-seats.js`: 54–62, 97–120, 163–177, 649–661
- **Severity:** **High**
- **Description:**
  1. In `updatePlayerTank` (lines 54–62), when `p.tankView` is active, it fires a `raycastWorld` followed by a loop checking cylinder raycasts against every tank in `tanks` every frame.
  2. In `updatePlayerTank` (lines 97–120), ballistic pip prediction runs up to 36 simulation steps:
     ```javascript
     for (let i = 0; i < 36; i++) {
       sp2.y -= SHELL_G * 0.1;
       const step = sp2.length() * 0.1;
       const dirN = sp2.clone().normalize(); // ALLOCATION EVERY STEP
       const wr = raycastWorld(simP, dirN, step); // RAYCAST EVERY STEP
       if (wr) { ... break; }
       simP.addScaledVector(dirN, step);
       if (simP.y < heightAt(simP.x, simP.z)) { ... break; }
     }
     ```
     Even throttled to 10 Hz, this runs 36 `raycastWorld` calls and allocates 36 new vectors on each prediction tick.
  3. In `updatePlayerPlane` (lines 163–177), strafe pip raymarching runs a step-size 8 loop up to 600m against `heightAt` (up to 75 iterations), followed by CCIP bomb trajectory integration (up to 60 iterations) **every single frame**.
- **Recommended Optimization:**
  - In `updatePlayerTank`, reuse a preallocated scratch vector for `dirN` and check `heightAt` before issuing expensive `raycastWorld` queries.
  - In `updatePlayerPlane`, throttle strafe and CCIP calculations to 10–15 Hz rather than executing 135+ loop iterations every frame.

---

## 5. HUD Hot Loops, DOM Thrashing, & Canvas Overhead (`js/22-hud.js`)

### 5.1 Bypassed DOM Write Cache: Hot-loop `.textContent`, `.style.color`, and `.innerHTML` Thrashing
- **File & Lines:** `js/22-hud.js`: 767–842, 919, 923, 943–944
- **Severity:** **Critical**
- **Description:**
  `22-hud.js` introduced `hudText`, `hudHTML`, `hudStyle`, and `_hw` (lines 606–614) specifically to eliminate redundant DOM writes:
  *"包装语义 = 直接赋值 (幂等写), 只在值真的变了才落到 DOM"*
  However, in `updateHUD(dt)` (lines 767–842), **the hot loop directly bypasses this caching mechanism**:
  ```javascript
  el('wname').textContent = t2(w.def.name);
  el('wmode').textContent = w.def.mode;
  el('magN').textContent = w.mag;
  el('resN').textContent = '/ ' + w.reserve;
  el('magN').style.color = (...);
  el('nadeN').textContent = (...);
  ```
  These properties are written **unconditionally on every frame (60 FPS)**.
  Even when the player is idle and ammunition has not changed, the browser is forced to dirty DOM node layout and restyle text elements 60 times a second.
  Additionally:
  - Line 919: `el('tickets').innerHTML = ...` rebuilds and parses a large HTML string 10 times a second.
  - Line 923: `el('timeTxt').textContent = ...` writes the match timer string every 100ms even when the second hasn't changed.
  - Lines 943–944: `sqEl.innerHTML = ...` re-parses HTML every 100ms.
- **Recommended Optimization:**
  - Refactor lines 767–842 to use `hudText('wname', ...)`, `hudText('wmode', ...)`, `hudText('magN', ...)`, and `hudStyle('magN', 'color', ...)`.
  - In `tickets` and `squadHUD`, update child spans via `textContent` rather than assigning `.innerHTML` to parent containers.

---

### 5.2 Canvas Redraw Overhead in Minimap & Compass
- **File & Lines:** `js/22-hud.js`: 84–383 (`drawMinimap`), 571–597 (`drawCompass`)
- **Severity:** **High**
- **Description:**
  1. In `drawMinimap()` (lines 92–97):
     ```javascript
     const toMap = (x, z) => {
       let dx = x - cx, dz = z - cz;
       const c = Math.cos(rot), s = Math.sin(rot);
       const rx = dx * c - dz * s, rz = dx * s + dz * c;
       return [half + rx / range * half, half + rz / range * half];
     };
     ```
     `Math.cos(rot)` and `Math.sin(rot)` are calculated **inside `toMap` on every point**. With roads, crop fields, river vertices, bridges, flags, soldiers, vehicles, and rail lines, `toMap` is called 250–400 times per redraw. Recomputing sine and cosine 400 times per tick is completely redundant since `rot` is fixed for the frame.
  2. Every call to `toMap` allocates a new array `[x, y]`. That is **250–400 Array allocations every 100ms** (up to 4,000 objects per second) purely for temporary 2D screen positions.
  3. In `drawCompass()` (line 577):
     `const marks = [[0, '北'], [HPI, '西'], [Math.PI, '南'], [-HPI, '东'], ...];`
     The array of 8 orientation tuples is re-allocated on every compass redraw.
  4. Static terrain lines (rivers, roads, railway tracks, crop rectangles) are re-stroked from scratch on every tick.
- **Recommended Optimization:**
  - Hoist `const c = Math.cos(rot), s = Math.sin(rot);` outside `toMap`.
  - Pass a shared mutable point object `_mapPt.x = ..., _mapPt.y = ...` or use direct canvas methods without allocating `[x, y]` arrays.
  - Move static `marks` in `drawCompass` to a module-level constant.
  - Render static terrain layers to an offscreen background canvas once per map load, then blit/rotate it onto the minimap.

---

## 6. WebAudio Graph Leaks & Sound Engine Bottlenecks (`js/01-audio.js`)

### 6.1 AudioNode Disconnect Leak & Lack of Pooling
- **File & Lines:** `js/01-audio.js`: 75–146 (`gunshot`), 147–158 (`explosion`), 159–175 (`click`, `metalSlide`), 185–192 (`footstep`)
- **Severity:** **Critical**
- **Description:**
  In all one-shot sound effects, nodes are created and connected into the master compressor `comp`:
  ```javascript
  const n = noiseSrc();
  const bp = ctx.createBiquadFilter();
  const ng = ctx.createGain();
  n.connect(bp); bp.connect(ng); ng.connect(out);
  n.start(t0); n.stop(t0 + 0.05);
  ```
  `n.stop()` halts playback on the BufferSource, **but `bp` (BiquadFilterNode) and `ng` (GainNode) remain connected to downstream nodes (`out` and `comp`)**.
  In Web Audio implementations (particularly Chromium and WebKit), audio nodes that remain connected to an active sub-tree are retained by the audio graph until explicitly detached via `node.disconnect()`.
  Furthermore, there is zero pooling. During firefights where 40+ combatants fire automatic weapons (SMGs, MGs at 10–15 rounds/sec), **hundreds of WebAudio nodes are instantiated every second**, flooding the audio thread and causing major GC allocation spikes.
- **Recommended Optimization:**
  - Attach an `onended` callback to buffer sources and oscillators to invoke `.disconnect()` on all connected upstream filters and gain nodes.
  - Implement an object pool for frequently instantiated nodes (`GainNode`, `BiquadFilterNode`).

---

### 6.2 Zombie Interval Timers Running Indefinitely
- **File & Lines:** `js/01-audio.js`: 366–368
- **Severity:** **Medium**
- **Description:**
  In `startAmbient()`:
  ```javascript
  // 远处机枪对射: 断续的闷响连射
  setInterval(() => { if (Math.random() < 0.45) distantMG(); }, 4600);
  // 鸟鸣: 随机间隔的合成啁啾, 左右声道随机
  setInterval(() => { if (Math.random() < 0.55) bird(); }, 2400);
  ```
  These two `setInterval` timers are created anonymously without storing their timer IDs. They run continuously in the background, firing timers indefinitely while in the main menu, pause menu, or between match resets.
- **Recommended Optimization:**
  - Save timer handles in module-level variables (`_mgInterval`, `_birdInterval`) and clear them via `clearInterval()` in `stopAll()`, reinstating them in `restoreAll()`.

---

### 6.3 Map/Weather Audio State Desynchronization
- **File & Lines:** `js/01-audio.js`: 16, 31, 348–364
- **Severity:** **Medium**
- **Description:**
  `startAmbient()` is called once during `AudioSys.init()`. Weather ambient gain and filters are established from `WX_CFG.audioLevel` and `WX_CFG.wind`.
  However, `AudioSys.init()` guards against multiple calls via `if (inited) return;`.
  When a player switches campaigns or starts a new procedural match with different weather (e.g., from clear weather to heavy rain or snowstorm), `AudioSys.init()` does not re-run. As a result, the weather audio layer is never reconfigured or adapted to the new map's weather conditions.
- **Recommended Optimization:**
  - Expose an `updateWeatherAmbient()` method on `AudioSys` that is called during map setup in `23-deploy.js` or `21-match.js`.

---

### 6.4 Audio Voice Concurrency Flooding
- **File & Lines:** `js/01-audio.js`: 75–84, 185–192, 203–212
- **Severity:** **Medium**
- **Description:**
  While distant gunshots (`dist > 70`) are throttled to a maximum of 4 sounds per 100ms (lines 79–82), close-range gunshots, footsteps, impacts, and ricochets have no voice limit. When 20 bots fire simultaneously in close proximity, tens of synth and noise pipelines trigger concurrently, overloading the dynamics compressor (`comp`) and causing audio distortion and frame drops on the audio render thread.
- **Recommended Optimization:**
  - Implement a global sound voice management system (e.g., maximum 16 concurrent playback voices), prioritizing the player's sounds and nearest events.

---

## 7. Match Lifecycle, Map Reset, & Memory Leaks (`21-match.js`, `23b-worldrestore.js`, `18-game.js`)

### 7.1 Orphaned `setTimeout` Triggers Desynchronizing UI Screens
- **File & Lines:** `js/18-game.js`: 164–165; `js/21-match.js`: 440; `js/14-bots.js`: 1587
- **Severity:** **High**
- **Description:**
  1. In `player.die()` (`js/18-game.js`: 164–165):
     ```javascript
     setTimeout(() => { if (!this.alive) document.getElementById('blackOv').style.opacity = 0.75; }, dly);
     setTimeout(() => { if (!matchOver && !this.alive) showDeploy(true); }, dly + 700);
     ```
     These timeout IDs are never captured. If a player dies and immediately clicks "Return to Menu" (`returnToMenu()` sets `menuHold = true`, leaving `matchOver = false`), 2.8 seconds later `showDeploy(true)` fires in the background, unexpectedly popping the deploy screen open over the main menu.
  2. In `endMatch()` (`js/21-match.js`: 440):
     A 900ms `setTimeout` reveals the `#end` screen. If the player immediately starts a new game or navigates menus during this window, the timeout cannot be cancelled, forcing open the match-end overlay over the new match.
  3. In `14-bots.js` line 1587, melee damage uses a 380ms `setTimeout`. If the match ends or pauses, the melee damage callback still fires asynchronously.
- **Recommended Optimization:**
  - Store all lifecycle timeout IDs in dedicated variables and cancel them via `clearTimeout` in `retireMatchActors()` and `returnToMenu()`.

---

### 7.2 WebGL Geometry/Material GPU Leaks on Actor Retirement
- **File & Lines:** `js/22-hud.js`: 1183–1190; `js/14-bots.js`: 2450–2456; `js/23b-worldrestore.js`: 145–153
- **Severity:** **High**
- **Description:**
  When a match restarts, `retireMatchActors()` cleans up actors:
  ```javascript
  for (const s of soldiers) {
    if (s.mesh && s.mesh.root && s.mesh.root.parent) s.mesh.root.parent.remove(s.mesh.root);
  }
  for (const t of tanks) { ... t.grp.parent.remove(t.grp); }
  for (const p of planes) { ... p.grp.parent.remove(p.grp); }
  ```
  In Three.js, removing a mesh or group from its parent removes the object from the scene graph, **but does NOT release its GPU buffers**. Unless `geometry.dispose()` and `material.dispose()` are called on child meshes, WebGL buffers, textures, and shader programs remain allocated in GPU memory. Across multiple consecutive match replays, GPU memory consumption continuously escalates.
  Additionally, `BotDebug` lines (`scene.add(b.dbgLine)`) are added directly to `scene` and are never removed or disposed during actor retirement.
- **Recommended Optimization:**
  - Traverse meshes in `retireMatchActors()` and explicitly dispose all non-shared geometries, materials, and textures.
  - Ensure all debug lines in `BotDebug` are removed from `scene` and disposed.

---

### 7.3 Per-Frame Cloth Vertex Simulation & WebGL Buffer Re-uploads
- **File & Lines:** `js/21-match.js`: 206–214
- **Severity:** **Medium**
- **Description:**
  In `updateFlags(dt)`, cloth simulation is computed on the CPU for every flag on every frame:
  ```javascript
  const fp = f.flagGeo.attributes.position, fb = f.flagBase;
  for (let i = 0; i < fp.count; i++) {
    const bx = fb[i * 3], by = fb[i * 3 + 1], w = bx / 2.4;
    fp.setZ(i, (Math.sin(nowT * 4.2 + bx * 2.6 + f.x * 0.7) + Math.sin(nowT * 7.3 + by * 4.1 + f.z * 0.5) * 0.45) * 0.13 * w);
    fp.setX(i, bx + Math.sin(nowT * 2.2 + f.z) * 0.07 * w * w);
  }
  fp.needsUpdate = true;
  ```
  Setting `fp.needsUpdate = true` forces a WebGL `glBufferSubData` upload to the GPU for all flag geometries 60 times a second.
- **Recommended Optimization:**
  - Move the flag wave animation into a vertex shader (passing `nowT` as a uniform), eliminating per-frame CPU vertex updates and GPU buffer streaming entirely.

---

### 7.4 Stale Killfeed & Message DOM Elements Surviving Match Restart
- **File & Lines:** `js/21-match.js`: 494–502, 517–521, 553–559
- **Severity:** **Low**
- **Description:**
  `resetMatchState()` and `retireMatchActors()` reset gameplay variables, but do not clear active UI containers (`#killfeed`, `#killPops`, `#msgC`). When starting a new match immediately after ending one, old kill messages and score popups from the previous match remain visible for up to 5 seconds.
- **Recommended Optimization:**
  - In `resetMatchState()`, clear `el('killfeed').innerHTML = ''`, `el('killPops').innerHTML = ''`, and `el('msgC').textContent = ''`.

---

## 8. Summary Matrix: Severity, Impact, & Recommended Action Plan

| ID | Component | Issue Description | Severity | Impact | Recommended Solution |
|---|---|---|---|---|---|
| **AI-1** | `14-bots.js` | Bot perception runs ~4,000 raycasts/s with no spatial grid or global ray budget | **Critical** | Major CPU framerate drops with 32–64 bots | Implement spatial grid hash; cap total perception raycasts per frame |
| **AI-2** | `14-bots.js` | `moveDir` fires up to 7 physics raycasts per moving bot per frame | **High** | Up to 20k raycasts/s during steering | Rely on 2D occupancy grid; restrict knee raycasts to stuck bots |
| **AI-3** | `14-bots.js` | `stepToward` loop consumes all remaining pathfinding budget in a single frame | **High** | Starves all other bots from pathfinding | Limit each bot to 1 repath attempt per frame |
| **AI-4** | `14-bots.js` | Ephemeral `Vector3` allocations in `eyePos` and `aimShot` | **Medium** | High GC allocation rate, triggering stutter | Use reusable scratch vectors (`_tempV1`, etc.) |
| **AI-5** | `14-bots.js` | Full Leg IK & bone matrices evaluated for all distant bots | **Medium** | Unnecessary CPU load for invisible bots | Add distance/frustum animation LOD |
| **NAV-1** | `07-nav.js` | `compNext` monotonically increases, expanding `csize` indefinitely | **High** | Sparse array memory bloat across long matches | Recycle component IDs in `relabelRegion` |
| **NAV-2** | `07-nav.js` | Full-grid 16,641 iteration scan when search trees fail to meet | **High** | Frame freeze spikes on impossible paths | Track touched frontier nodes in a compact list |
| **NAV-3** | `07-nav.js` | `heapPos.fill(-1)` scrubs 33,282 entries on every path query | **Medium** | CPU memory write overhead in hot path | Reset only modified heap indices via dirty stack |
| **PLR-1** | `20-player.js` | `player.tankView` not reset on `F` dismount | **Critical** | Tank scope overlay permanently stuck on screen | Set `player.tankView = false` on dismount |
| **PLR-2** | `20-player.js` | Fallback assignment in dismount loop sets blocked coordinate | **Medium** | Player spawns inside collision geometry | Move fallback outside loop; query safe spot |
| **PLR-3** | `20a-seats.js`| 36-step ballistic integration and 75-step plane raymarching in hot loop | **High** | CPU stalls when aiming/flying | Cache predictions; throttle to 10–15 Hz |
| **HUD-1** | `22-hud.js` | Hot loop writes `.textContent` and `.innerHTML` every frame | **Critical** | Severe DOM reflows and layout recalculations | Route all updates through `hudText` cache |
| **HUD-2** | `22-hud.js` | Minimap recomputes `cos`/`sin` 400x/tick and allocates 400 arrays | **High** | GC churn and unnecessary math calculations | Hoist trig math; reuse point scratch objects |
| **AUD-1** | `01-audio.js` | WebAudio nodes never disconnected; zero node pooling | **Critical** | Audio graph memory leak; GC pressure | Disconnect nodes on `onended`; implement node pool |
| **AUD-2** | `01-audio.js` | Orphaned `setInterval` for bird/distant MG sounds | **Medium** | Timers fire indefinitely in menus | Track and clear interval handles on stop |
| **AUD-3** | `01-audio.js` | Weather ambient sounds never reconfigured on map change | **Medium** | Audio desync with new map's weather | Expose and call `updateWeatherAmbient` on reset |
| **RES-1** | `18-game.js` | Untracked `setTimeout` for deploy screen popups | **High** | In-game deploy screen pops up over main menu | Store timeout IDs; clear them on exit to menu |
| **RES-2** | `22-hud.js` | Mesh retirement removes objects but does not dispose GPU buffers | **High** | WebGL VRAM and buffer memory leaks | Call `geometry.dispose()` & `material.dispose()` |
| **RES-3** | `21-match.js` | CPU cloth vertex wave animation with 60 FPS GPU uploads | **Medium** | Continuous CPU load and GPU buffer bus traffic | Move flag wave simulation to vertex shader |
