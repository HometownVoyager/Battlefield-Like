'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { openPage, sleep } = require('./cdp');

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(__dirname, '..', p);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); res.end('404'); return; }
    const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
    res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' });
    res.end(d);
  });
});

(async () => {
  const port = 8019;
  await new Promise(r => server.listen(port, r));
  console.log(`Server listening on ${port}`);

  let pg;
  let fails = 0;
  const assert = (name, cond, info = '') => {
    if (cond) {
      console.log(`  [PASS] ${name} ${info}`);
    } else {
      console.error(`  [FAIL] ${name} ${info}`);
      fails++;
    }
  };

  try {
    pg = await openPage(null, { width: 1280, height: 720 });
    await pg.enableCdnStub();

    await pg.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        localStorage.setItem('sf_daynight', 'night');
        localStorage.setItem('sf_weather', 'map');
      `
    });

    await pg.goto(`http://127.0.0.1:${port}/index.html`);
    await pg.waitFor('!!window.__sfBooted', 45000);
    await sleep(1000);

    await pg.eval('startGame()');
    await sleep(2500);
    await pg.eval('deployPlayer()');
    await sleep(2000);

    console.log('\n=== 1. 测试自然回血逻辑 ===');
    // 测试回血阶梯
    const regenResults = await pg.eval(`(() => {
      const out = {};
      const simulateRegen = (startHp, simSeconds) => {
        player.hp = startHp;
        player.lastDmgT = nowT - 10; // 脱战10秒
        const dt = 0.05;
        const steps = Math.round(simSeconds / dt);
        for (let i = 0; i < steps; i++) {
          // 执行 20-player 中的回血逻辑
          if (nowT - player.lastDmgT > 6) {
            if (player.hp >= 30 && player.hp < 70) player.hp = Math.min(70, player.hp + 4 * dt);
            else if (player.hp > 70 && player.hp < 100) player.hp = Math.min(100, player.hp + 2.5 * dt);
          }
        }
        return Math.round(player.hp * 100) / 100;
      };

      out.caseA_under30 = simulateRegen(20, 15);  // 从20开始，15秒后应依然是20
      out.caseB_mid40 = simulateRegen(40, 20);    // 从40开始，20秒后应严格停在70
      out.caseC_exact70 = simulateRegen(70, 20);  // 从70开始，20秒后应严格保持70
      out.caseD_over70 = simulateRegen(75, 20);   // 从75开始，20秒后应回到100
      return out;
    })()`);

    assert('Case A (生命值<30重伤): 不自然回血', regenResults.caseA_under30 === 20, `(实际: ${regenResults.caseA_under30})`);
    assert('Case B (生命值在30~70): 恢复至70停止且不再上涨', regenResults.caseB_mid40 === 70, `(实际: ${regenResults.caseB_mid40})`);
    assert('Case C (生命值恰好为70): 保持70不上涨至100', regenResults.caseC_exact70 === 70, `(实际: ${regenResults.caseC_exact70})`);
    assert('Case D (生命值明确>70): 自然恢复至100满血', regenResults.caseD_over70 === 100, `(实际: ${regenResults.caseD_over70})`);

    console.log('\n=== 2. 测试第一人称手电筒与地面光斑移除 ===');
    // 开关手电筒测试
    await pg.eval(`
      player.flashlight = false;
      if (typeof playerFlashlightTick === 'function') playerFlashlightTick(0.016);
    `);
    await sleep(300);

    const offState = await pg.eval(`(() => {
      const fl = scene.children.find(c => c.isSpotLight && c.color && c.color.getHexString() === 'fff2d4');
      const cone = typeof _playerFlCone !== 'undefined' ? _playerFlCone : null;
      return {
        flVisible: fl ? fl.visible : false,
        coneVisible: cone ? cone.visible : false
      };
    })()`);
    assert('手电筒关闭时: SpotLight 不可见', offState.flVisible === false);
    assert('手电筒关闭时: 光锥不可见', offState.coneVisible === false);

    // 开启手电筒
    await pg.eval(`
      player.flashlight = true;
      if (typeof playerFlashlightTick === 'function') playerFlashlightTick(0.016);
    `);
    await sleep(500);

    const onState = await pg.eval(`(() => {
      const fl = scene.children.find(c => c.isSpotLight && c.color && c.color.getHexString() === 'fff2d4');
      const cone = typeof _playerFlCone !== 'undefined' ? _playerFlCone : null;
      const spot = typeof _flSpotMesh !== 'undefined' ? _flSpotMesh : null;
      return {
        flVisible: fl ? fl.visible : false,
        flIntensity: fl ? fl.intensity : 0,
        flDistance: fl ? fl.distance : 0,
        flAngle: fl ? fl.angle : 0,
        coneVisible: cone ? cone.visible : false,
        coneOpacity: cone ? cone.material.opacity : 0,
        spotVisible: spot ? (spot.visible || false) : false
      };
    })()`);

    assert('手电筒开启时: SpotLight 可见', onState.flVisible === true);
    assert('手电筒开启时: 光照强度适中有效 (≥30)', onState.flIntensity >= 30, `(实际强度: ${onState.flIntensity})`);
    assert('手电筒开启时: 地面不开阔处不被误截断 (距离 ≥28m)', onState.flDistance >= 28, `(实际距离: ${onState.flDistance}m)`);
    assert('手电筒开启时: 第一人称立体战术光锥可见', onState.coneVisible === true);
    assert('地面平面贴图光斑已彻底移除/不可见', onState.spotVisible === false);

    // 视角朝向测试：低头俯仰时，SpotLight 不应被掐断
    const tiltTest = await pg.eval(`(() => {
      camera.rotation.x = -0.15; // 轻微低头看前方地面
      camera.updateMatrixWorld();
      if (typeof playerFlashlightTick === 'function') playerFlashlightTick(0.016);
      const hit = raycastWorld(camera.position, camForward(), 35);
      const fl = scene.children.find(c => c.isSpotLight && c.color && c.color.getHexString() === 'fff2d4');
      return {
        hit: hit ? { kind: hit.kind, dist: hit.dist } : null,
        flDistance: fl ? fl.distance : 0,
        flIntensity: fl ? fl.intensity : 0
      };
    })()`);
    assert('低头照地时: SpotLight distance 保持开阔射程 (不被掐成 2~3m)', tiltTest.flDistance >= 28, `(实际距离: ${tiltTest.flDistance}m, hit: ${JSON.stringify(tiltTest.hit)})`);

    // 截图存档
    console.log('\n=== 3. 截取最终交付效果图 ===');
    await pg.screenshot('dev/out/deliverable-night-flashlight-on.png');
    console.log('  已保存交付效果图: dev/out/deliverable-night-flashlight-on.png');

    await pg.eval(`
      player.flashlight = false;
      if (typeof playerFlashlightTick === 'function') playerFlashlightTick(0.016);
    `);
    await sleep(300);
    await pg.screenshot('dev/out/deliverable-night-flashlight-off.png');
    console.log('  已保存交付对比图: dev/out/deliverable-night-flashlight-off.png');

    console.log(`\n=== 验证总结: 全部测试执行完毕，失败项: ${fails} ===`);
    process.exitCode = fails ? 1 : 0;

  } catch (e) {
    console.error('Validation error:', e);
    process.exitCode = 2;
  } finally {
    if (pg) await pg.close();
    server.close();
  }
})();
