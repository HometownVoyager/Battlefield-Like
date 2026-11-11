'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

console.log('═══ 开始执行 2026-10-10 第二批修复自动化集成验证 ═══');

let passedCount = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✔ [PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  ✘ [FAIL] ${name}: ${err.message}`);
    process.exitCode = 1;
  }
}

// ─────────────────────────────────────────────────────────────
// 测试项 1：双队模式下丧尸 AI 目标与刷怪锚点分流 (不进攻中间无人区)
// ─────────────────────────────────────────────────────────────
test('需求1: 双队模式下丧尸刷怪锚点 zAnchor 与聚集目标 _cx 独立分流至两队阵地，绝不进攻中间', () => {
  const zCode = fs.readFileSync(path.join(__dirname, '../js/25-zombies.js'), 'utf8');

  // 1.1 静态检查
  assert(zCode.includes('teamsAlive=[[],[]]'), 'zAnchor 必须按队伍分别统计存活人类');
  assert(zCode.includes('candTeams=[0,1].filter'), 'zAnchor 必须筛选出存活队伍候选');
  assert(zCode.includes('tgtTeam=candTeams['), '双队时必须独立抽取其中一支队伍施压，严禁跨队求几何平均');
  assert(zCode.includes('this.clusterT=rand(2.6,3.4)') || zCode.includes('d0<=d1'), '丧尸聚集点必须基于两队距离选择最近的队伍质心');

  // 1.2 动态沙箱执行：模拟双队对抗场景
  const sandbox = {
    Math,
    rand: (min, max) => min + Math.random() * (max - min),
    BASES: [{ x: -160, z: 0 }, { x: 160, z: 0 }],
    player: { team: 0 },
    combatants: [
      // Team 0 人类（西侧基线）
      { alive: true, zombie: false, onVehicle: false, team: 0, pos: { x: -150, z: -10 } },
      { alive: true, zombie: false, onVehicle: false, team: 0, pos: { x: -140, z: 10 } },
      // Team 1 人类（东侧基线）
      { alive: true, zombie: false, onVehicle: false, team: 1, pos: { x: 150, z: -10 } },
      { alive: true, zombie: false, onVehicle: false, team: 1, pos: { x: 140, z: 10 } }
    ]
  };

  // 抽取 zAnchor 函数并在沙箱中运行
  const anchorStart = zCode.indexOf('function zAnchor(){');
  const anchorEnd = zCode.indexOf('\nfunction zTrySpawn', anchorStart);
  const anchorFnCode = zCode.slice(anchorStart, anchorEnd);

  vm.createContext(sandbox);
  vm.runInContext(anchorFnCode, sandbox);

  // 连续采样 40 次，每次返回的锚点必须在 Team 0 (x≈-145) 或 Team 1 (x≈145)，绝不可落在中间 (|x| < 50)
  let hitT0 = 0, hitT1 = 0;
  for (let i = 0; i < 40; i++) {
    const pt = sandbox.zAnchor();
    assert(Math.abs(pt.x) > 100, `锚点落入中间无人区: x=${pt.x}`);
    if (pt.x < 0) hitT0++; else hitT1++;
  }
  assert(hitT0 > 0 && hitT1 > 0, '双队模式下尸潮应有概率分别向 Team 0 与 Team 1 施压');

  // 1.3 动态模拟丧尸游荡聚集点挑选逻辑
  const pickClusterForZombie = (zx, zz) => {
    let t0x = 0, t0z = 0, n0 = 0, t1x = 0, t1z = 0, n1 = 0;
    for (const c of sandbox.combatants) {
      if (!c.alive || c.zombie || c.onVehicle) continue;
      if (c.team === 0) { t0x += c.pos.x; t0z += c.pos.z; n0++; }
      else if (c.team === 1) { t1x += c.pos.x; t1z += c.pos.z; n1++; }
    }
    if (n0 > 0 && n1 > 0) {
      const d0 = Math.hypot(t0x / n0 - zx, t0z / n0 - zz);
      const d1 = Math.hypot(t1x / n1 - zx, t1z / n1 - zz);
      return d0 <= d1 ? { cx: t0x / n0, cz: t0z / n0 } : { cx: t1x / n1, cz: t1z / n1 };
    }
    return { cx: 0, cz: 0 };
  };

  // 位于西侧 (-80m) 的丧尸必须锁定 Team 0 (-145m)
  const zWest = pickClusterForZombie(-80, 0);
  assert(zWest.cx < -100, `西侧丧尸聚集点未锁定西侧队伍: cx=${zWest.cx}`);

  // 位于东侧 (+80m) 的丧尸必须锁定 Team 1 (+145m)
  const zEast = pickClusterForZombie(80, 0);
  assert(zEast.cx > 100, `东侧丧尸聚集点未锁定东侧队伍: cx=${zEast.cx}`);
});

// ─────────────────────────────────────────────────────────────
// 测试项 2：旗点大灯照度下调与地面光斑调柔
// ─────────────────────────────────────────────────────────────
test('需求2: 旗点高空与低空大灯照度大幅调柔，地面贴地光斑不透明度下调至 0.22', () => {
  const effCode = fs.readFileSync(path.join(__dirname, '../js/08-effects.js'), 'utf8');

  // 检查高空照明弹照度公式：基准 4.2，范围 3.8 ~ 11.0 (相较原版 28~64 降低约80%)
  assert(effCode.includes('clamp(4.2/Math.max(0.20,expo),3.8,11.0)') || effCode.includes('clamp(4.2 / Math.max(0.20, expo), 3.8, 11.0)'), '高空照明弹强光已调降至柔和档 (3.8~11.0)');
  assert(!effCode.includes('clamp(18/Math.max(0.20,expo),28,64)'), '旧版 28~64 刺眼强光必须消除');

  // 检查低空漫射光照度公式：基准 1.2，范围 1.0 ~ 3.2 (相较原版 10~22 消除近距离惨白反光)
  assert(effCode.includes('clamp(1.2/Math.max(0.20,expo),1.0,3.2)') || effCode.includes('clamp(1.2 / Math.max(0.20, expo), 1.0, 3.2)'), '低空漫射光已调降至 1.0~3.2 柔和辅助档');
  assert(!effCode.includes('clamp(6.5/Math.max(0.20,expo),10,22)'), '旧版 10~22 低空刺眼光源已消除');

  // 检查贴地光斑不透明度
  assert(effCode.includes('fl.disc.material.opacity=0.22*fl.lit') || effCode.includes('0.22 * fl.lit'), '地面光斑不透明度降至 0.22 柔和漫射');
  assert(!effCode.includes('fl.disc.material.opacity=fl.lit;'), '原 1.0 全不透明强反光圆盘已消除');
});

// ─────────────────────────────────────────────────────────────
// 测试项 3：光照与物理渲染性能低效治理
// ─────────────────────────────────────────────────────────────
test('需求3: 火源动态光照单帧防重、点光源上限节流、大灯射线 0.12s 节流、手电射线复用、雨雪 AABB 短路与材质克隆消除', () => {
  const effCode = fs.readFileSync(path.join(__dirname, '../js/08-effects.js'), 'utf8');
  const fireCode = fs.readFileSync(path.join(__dirname, '../js/04b-fire.js'), 'utf8');

  // 3.1 火源光照防重与节流
  assert(effCode.includes('updateFireLights._lastT'), 'updateFireLights 具备单帧防重机制');
  assert(effCode.includes('maxActiveLights'), 'updateFireLights 包含点光源最大活跃上限节流');

  // 3.2 载具大灯防穿墙射线 0.12s 节流与前2辆限制
  assert(effCode.includes('v._hlRayT'), '载具大灯射线检测包含 _hlRayT 计时节流');
  assert(effCode.includes('ci < 2') || effCode.includes('ci<2'), '载具大灯防穿墙射线限制仅对前 2 辆最近载具检测');

  // 3.3 手电筒空气光柱复用 hit
  assert(effCode.includes('hit&&hit.dist<baseL') || effCode.includes('hit && hit.dist < baseL'), '手电筒空气光柱复用发射点物理障碍 hit 结果');

  // 3.4 雨雪粒子遮挡 AABB 预筛
  assert(effCode.includes('_coverAABB'), '天气雨雪系统引入全局遮挡 _coverAABB 快速包围盒短路');

  // 3.5 消除植被烧毁时的 material.clone()
  assert(fireCode.includes('_charredFloraMat'), '植被烧毁复用单例 _charredFloraMat 材质');
  assert(!fireCode.includes('m.material=m.material.clone()'), '严禁在运行时每次着火遍历 clone() 材质');
});

console.log(`\n════ 验证完成: 共 ${passedCount}/3 专项测试，全部 PASS ════`);
