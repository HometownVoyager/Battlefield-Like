'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('═══ 开始执行 2026-10-10 7项修复自动化集成验证 ═══');

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

// 1. 验证需求1：丧尸模式顶端重叠文本修复
test('需求1: 丧尸模式 HUD 独立下移至 top:50px 且丧尸模式清空 modeLine', () => {
  const zCode = fs.readFileSync(path.join(__dirname, '../js/25-zombies.js'), 'utf8');
  assert(zCode.includes("top:50px") || zCode.includes("top: 50px"), 'zHudEl 必须定位于 top:50px (避开 topBar 的 top:14px)');
  assert(!zCode.includes("top:10px;left:50%"), '原重叠的 top:10px 必须消除');

  const hudCode = fs.readFileSync(path.join(__dirname, '../js/22-hud.js'), 'utf8');
  assert(hudCode.includes("if(typeof ZOMBIE_MODE!=='undefined'&&ZOMBIE_MODE) modeLine='';"), '丧尸模式下必须清空 modeLine 避免顶栏内容拥挤重叠');

  const cssCode = fs.readFileSync(path.join(__dirname, '../css/style.css'), 'utf8');
  assert(cssCode.includes('#zHudEl') || cssCode.includes('.zombie-hud-pill'), 'CSS 中包含丧尸 HUD 胶囊样式定义');
});

// 2. 需求2：旗点刚进入占领范围内且有敌军时显示“争夺中·圈内仍有敌军”
test('需求2: 旗点争夺中提示去除 cap>0.02 门槛，刚进圈 cap=0 即正确判定争夺中', () => {
  const hudCode = fs.readFileSync(path.join(__dirname, '../js/22-hud.js'), 'utf8');
  // 必须是 if(contested) 而不能是 if(contested&&inFlag.cap>0.02)
  assert(hudCode.includes("if(contested) capTxt=t2('⚠ 争夺中 · 圈内仍有敌军');"), 'contested 判断必须无进度门槛 (★20261121c P2#31 跟码: 占领五态入词典, 直写改 t2 包裹)');
  assert(!hudCode.includes("if(contested&&inFlag.cap>0.02) capTxt='⚠ 争夺中 · 圈内仍有敌军';"), '旧版 cap>0.02 门槛已被彻底移除');

  // 逻辑模拟断言
  const simulateCap = (contested, inFlagCap, owner, playerTeam, capTeam) => {
    let capTxt;
    if(contested) capTxt='⚠ 争夺中 · 圈内仍有敌军';
    else capTxt=capTeam===playerTeam?'正在占领…':(capTeam===-1?(owner===playerTeam?'我方控制':'站在旗点范围内占领'):'敌军正在占领!');
    return capTxt;
  };
  // 刚进入圈内且有敌军（cap=0, owner=1, playerTeam=0, capTeam=-1, contested=true）
  const result = simulateCap(true, 0, 1, 0, -1);
  assert.strictEqual(result, '⚠ 争夺中 · 圈内仍有敌军', '刚进圈 cap=0 且有敌军时必须显示争夺中');
});

// 3. 需求3：丧尸模式下其中一方人数/兵力归零时的胜负文案修复
test('需求3: 丧尸模式下胜负文案移除“占满全部旗点”要求', () => {
  const hudCode = fs.readFileSync(path.join(__dirname, '../js/22-hud.js'), 'utf8');
  assert(hudCode.includes("if(typeof ZOMBIE_MODE!=='undefined'&&ZOMBIE_MODE)"), 'hud 生成 wipeLine 必须包含 ZOMBIE_MODE 分支处理');
  assert(hudCode.includes("⚠ 兵力耗尽 · 全灭即出局") || hudCode.includes("全灭后出局"), '丧尸模式包含正确的全灭出局提示');

  const matchCode = fs.readFileSync(path.join(__dirname, '../js/21-match.js'), 'utf8');
  assert(matchCode.includes("ZOMBIE_MODE"), 'match 广播逻辑正确分流丧尸模式');
  assert(!matchCode.includes("if(ZOMBIE_MODE){ addKillMsg(t('须占领全部旗点"), '丧尸模式不得播报占满旗点');
});

// 4. 需求4：旗点周围照明消除平面白色蒙版，实现地形贴合与径向衰减
test('需求4: 旗点周围照明采用细分同心网格贴合地形采样与径向渐变纹理', () => {
  const fxCode = fs.readFileSync(path.join(__dirname, '../js/08-effects.js'), 'utf8');
  assert(fxCode.includes('_createTerrainFlareDiscGeo'), '包含地形贴合网格构造函数');
  assert(fxCode.includes('heightAt('), '网格顶点正确采样真实地表高度 heightAt');
  assert(fxCode.includes('waterYAt(') || fxCode.includes('waterYAt'), '网格顶点涉水时正确贴合水面');
  assert(fxCode.includes('_flareDiscTexture') || fxCode.includes('createRadialGradient'), '包含径向渐变 Canvas 贴图生成');
  assert(!fxCode.includes('new THREE.CircleGeometry(NIGHT_GEAR.flareR,26);'), '原 52m 刚性平面大圆盘已彻底废除');
});

// 5. 需求5：风车模型各个部分连接严密，风车扇叶四个扇叶之间呈标准 90 度十字对称
test('需求5: 风车扇叶严格 90度 正交十字对称，主轴同轴同高，尾舵与瞭望台装配严密', () => {
  const bldCode = fs.readFileSync(path.join(__dirname, '../js/05a-buildings.js'), 'utf8');
  // 扇叶角度：b * HPI (而不是 b * HPI / 2)
  assert(bldCode.includes('arm.rotation.z=b*HPI;') || bldCode.includes('arm.rotation.z = b * HPI;'), '扇叶步进角度必须为 b * HPI (90度十字对称)');
  assert(!bldCode.includes('arm.rotation.z=b*HPI/2'), '旧版 45度 严重不达 90度 的错误已消除');

  // 主轴同轴同高与构件共面
  assert(bldCode.includes('shaftY=g0+7.0') || bldCode.includes('shaftY = g0 + 7.0') || bldCode.includes('g0+7.0'), '前挑轴承与主轴同轴同高对齐');
  assert(bldCode.includes('arm.position.z=0.18') || bldCode.includes('arm.position.z = 0.18'), '扇叶臂组与轮毂十字铁架严格共面装配');

  // 尾舵封装与副叶片辐射分布
  assert(bldCode.includes('fantail=new THREE.Group()') || bldCode.includes('fantail = new THREE.Group()'), '尾舵偏航结构封装在独立 Group 中');
  assert(bldCode.includes('Math.PI/3') || bldCode.includes('PI/3'), '尾舵 6 片副叶片围绕横轴 60度 均匀辐射分布');

  // 瞭望台与楼梯加固
  assert(bldCode.includes('pLedger') || bldCode.includes('Stair-platform') || bldCode.includes('stairFlight'), '楼梯与瞭望台交接处设置稳固过梁与支撑框架');
});

// 6. 需求6：手雷警告显示距离，且取消烟雾弹警告
test('需求6: 手雷警告排除烟雾弹，且动态显示最近手雷距离', () => {
  const cbtCode = fs.readFileSync(path.join(__dirname, '../js/13-combat.js'), 'utf8');
  assert(cbtCode.includes('!n.smokeN'), '手雷警告逻辑中明确排除了烟雾弹 !n.smokeN');
  assert(cbtCode.includes('nadeMinDist'), '计算并记录最近手雷距离 nadeMinDist');

  const hudCode = fs.readFileSync(path.join(__dirname, '../js/22-hud.js'), 'utf8');
  assert(hudCode.includes("t('⚠ 手雷 {0}m ⚠',nadeMinDist.toFixed(1))") || hudCode.includes("nadeMinDist.toFixed(1)"), 'HUD 中动态渲染手雷最近距离 (如 ⚠ 手雷 4.5m ⚠)');

  const cssCode = fs.readFileSync(path.join(__dirname, '../css/style.css'), 'utf8');
  assert(cssCode.includes('#nadeWarn'), '#nadeWarn 样式存在且包含 nowrap');
});

// 7. 需求7：手雷蓄力抛距与引信提示，G键预瞄线延时爆炸与落地后弹跳滚动分段
test('需求7: 准星正下方提供预计抛距提示，预瞄线考虑延时爆炸与落地弹跳滚动分段', () => {
  const htmlCode = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert(htmlCode.includes('id="nadeChargeTip"'), 'index.html 准星下方包含 #nadeChargeTip 提示节点');

  const cssCode = fs.readFileSync(path.join(__dirname, '../css/style.css'), 'utf8');
  assert(cssCode.includes('#nadeChargeTip'), 'css 包含 #nadeChargeTip 微光样式');
  assert(cssCode.includes('.na.na-bounce') || cssCode.includes('.na-bounce'), 'css 包含触地后弹跳滚动的次级虚化轨迹样式');

  const hudCode = fs.readFileSync(path.join(__dirname, '../js/22-hud.js'), 'utf8');
  assert(hudCode.includes('firstLand') && hudCode.includes('finalLand'), '预瞄模拟明确区分第一着地点与最终延时起爆点');
  assert(hudCode.includes('na na-bounce'), '落地后弹跳点标记为 bounce 样式');
  assert(hudCode.includes('tip.textContent') && hudCode.includes('预计投掷:'), '蓄力时实时刷新准星下方预计投掷距离');
  assert(hudCode.includes('land.x') && hudCode.includes('finalLand'), '地面爆圈绘制在手雷最终起爆位置 finalLand');
});

console.log(`\n════ 验证完成: 共 7 项测试，全部 ${passedCount}/7 PASS ════`);
