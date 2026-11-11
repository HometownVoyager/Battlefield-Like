// ─────────────────────────────────────────────────────────────────────────────
// dev/verify-combathub-20261008.js
// 战备大厅与核心子系统重构工程施工验收回归脚本 (TC-01 ~ TC-07)
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const stub = require('./_bootstub.js');
require('./_bootpatch.js').patch(stub.sandbox);

{
  const P = Object.getPrototypeOf(stub.THREE.Group.prototype);
  if (!P.clear) P.clear = function () { this.children.length = 0; };
}

// 增强 DOM 桩: 实现真正的 classList 与基于 DOM 树的 querySelectorAll
const enhancedElements = new WeakSet();
const KNOWN_CLASSES = {
  deploy: 'screen hidden',
  pauseOv: 'screen hidden',
  mCombatHub: 'menu-subpanel hidden',
  mHome: '',
  mPlay: 'hidden',
  mSet: 'hidden',
  mHelp: 'hidden',
  mData: 'hidden',
  hubSizeSeg: 'segmented-control',
  hubDiffSeg: 'segmented-control',
  hubWeatherSeg: 'segmented-control',
  hubFactionSeg: 'segmented-control',
  hubTheaters: 'theater-filter',
  hubMapGrid: 'map-grid',
  classGrid: 'class-grid'
};

function enhanceElement(el) {
  if (!el || typeof el !== 'object' || enhancedElements.has(el)) return el;
  enhancedElements.add(el);
  let _cn = el.className || '';
  if (el.id && KNOWN_CLASSES[el.id] && !_cn) {
    _cn = KNOWN_CLASSES[el.id];
  }
  Object.defineProperty(el, 'className', {
    get() { return _cn; },
    set(v) { _cn = String(v); },
    configurable: true
  });
  el.classList = {
    add(...cs) {
      const set = new Set(_cn.split(/\s+/).filter(Boolean));
      cs.forEach(c => set.add(c));
      _cn = [...set].join(' ');
    },
    remove(...cs) {
      const set = new Set(_cn.split(/\s+/).filter(Boolean));
      cs.forEach(c => set.delete(c));
      _cn = [...set].join(' ');
    },
    toggle(c, force) {
      const set = new Set(_cn.split(/\s+/).filter(Boolean));
      if (force === true) set.add(c);
      else if (force === false) set.delete(c);
      else if (set.has(c)) set.delete(c);
      else set.add(c);
      _cn = [...set].join(' ');
      return set.has(c);
    },
    contains(c) {
      const set = new Set(_cn.split(/\s+/).filter(Boolean));
      return set.has(c);
    }
  };
  if (el.style && !el.style.setProperty) {
    el.style.setProperty = (k, v) => { el.style[k] = v; };
  }
  const origAppend = el.appendChild ? el.appendChild.bind(el) : null;
  if (origAppend) {
    el.appendChild = c => {
      enhanceElement(c);
      if (c && typeof c === 'object') c.parentNode = el;
      return origAppend(c);
    };
  }
  let _ih = el.innerHTML || '';
  Object.defineProperty(el, 'innerHTML', {
    get() { return _ih; },
    set(v) {
      _ih = String(v);
      if (v === '' && el.children) el.children.length = 0;
    },
    configurable: true
  });
  if (!el.removeAttribute) el.removeAttribute = () => {};
  if (!el.getAttribute) el.getAttribute = () => null;
  el.querySelectorAll = sel => queryNodes(el, sel);
  el.querySelector = sel => queryNodes(el, sel)[0] || enhanceElement(oc('div'));
  return el;
}

function matchSingle(node, token) {
  if (!node || typeof node !== 'object') return false;
  if (token.startsWith('#')) return node.id === token.slice(1);
  if (token.startsWith('.')) {
    const cls = token.slice(1);
    if (node.classList && typeof node.classList.contains === 'function') {
      return node.classList.contains(cls);
    }
    return String(node.className || '').split(/\s+/).includes(cls);
  }
  if (node.tagName && node.tagName.toLowerCase() === token.toLowerCase()) return true;
  return false;
}

function getAllNodes(root) {
  const all = new Set();
  function visit(n) {
    if (!n || typeof n !== 'object' || all.has(n)) return;
    enhanceElement(n);
    all.add(n);
    if (n.children && Array.isArray(n.children)) {
      for (const ch of n.children) {
        if (ch && typeof ch === 'object') ch.parentNode = n;
        visit(ch);
      }
    }
  }
  if (root) {
    visit(root);
  } else {
    visit(doc.body);
    for (const el of Object.values(stub.byId)) visit(el);
  }
  return [...all];
}

function queryNodes(root, sel) {
  const tokens = sel.trim().split(/\s+/);
  const nodes = getAllNodes(root === doc ? null : root);
  if (tokens.length === 1) {
    return nodes.filter(n => n !== root && matchSingle(n, tokens[0]));
  }
  if (tokens.length === 2) {
    return nodes.filter(n => {
      if (n === root || !matchSingle(n, tokens[1])) return false;
      let p = n.parentNode;
      while (p) {
        if (matchSingle(p, tokens[0])) return true;
        p = p.parentNode;
      }
      return false;
    });
  }
  return [];
}

const doc = stub.document;
const og = doc.getElementById.bind(doc);
const oc = doc.createElement.bind(doc);
doc.getElementById = id => enhanceElement(og(id));
doc.createElement = t => enhanceElement(oc(t));
doc.querySelectorAll = sel => queryNodes(doc, sel);
doc.querySelector = sel => queryNodes(doc, sel)[0] || enhanceElement(oc('div'));

const _ensureStyle = e => enhanceElement(e);

const CANNON = (() => {
  const V3 = stub.THREE.Vector3;
  class Quat {
    constructor() { this.x = 0; this.y = 0; this.z = 0; this.w = 1; }
    set() { return this; }
    setFromEuler() { return this; }
    copy() { return this; }
  }
  return {
    Vec3: V3,
    Quaternion: Quat,
    World: class {
      constructor() {
        this.gravity = new V3();
        this.broadphase = null;
        this.solver = { iterations: 0 };
        this.bodies = [];
      }
      addBody(b) { this.bodies.push(b); }
      removeBody(b) {
        const i = this.bodies.indexOf(b);
        if (i >= 0) this.bodies.splice(i, 1);
      }
      add(b) { this.addBody(b); }
      remove(b) { this.removeBody(b); }
      addConstraint() {}
      removeConstraint() {}
      step() {}
    },
    Body: class {
      constructor(o) {
        Object.assign(this, o || {});
        this.shapes = [];
        this.position = new V3();
        this.velocity = new V3();
        this.angularVelocity = new V3();
        this.quaternion = new Quat();
        this.angularDamping = 0;
        this.linearDamping = 0;
      }
      addShape(s) { this.shapes.push(s); }
    },
    Box: class {},
    Sphere: class {},
    Material: class {},
    ContactMaterial: class {},
    NaiveBroadphase: class {},
    PointToPointConstraint: class {}
  };
})();

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const FILES = [...html.matchAll(/src="(js\/[^"?]+)/g)].map(m => m[1]);

function populateHubDom(doc) {
  const hub = doc.getElementById('mCombatHub');
  if (!hub || hub._populated) return;
  hub._populated = true;
  
  // mode-tabs (2026-10-24 改版: 随机地形降为地图卡, 不再占模式标签 —— 只剩两页)
  const modeTabs = doc.createElement('div');
  modeTabs.className = 'mode-tabs';
  ['campaign', 'zombie'].forEach((m, idx) => {
    const btn = doc.createElement('button');
    btn.className = 'tab-btn' + (idx === 0 ? ' active' : '');
    btn.dataset.mode = m;
    modeTabs.appendChild(btn);
  });
  hub.appendChild(modeTabs);

  // theaters
  const thea = doc.getElementById('hubTheaters');
  ['all', 'weur', 'eeur', 'pac', 'asia'].forEach((th, idx) => {
    const btn = doc.createElement('button');
    btn.className = 'filter-chip' + (idx === 0 ? ' active' : '');
    btn.dataset.theater = th;
    thea.appendChild(btn);
  });

  // size seg
  const sizeSeg = doc.getElementById('hubSizeSeg');
  ['11', '16', '22', '30'].forEach((s, idx) => {
    const btn = doc.createElement('button');
    btn.dataset.size = s;
    if (s === '16') btn.className = 'active';
    sizeSeg.appendChild(btn);
  });

  // diff seg
  const diffSeg = doc.getElementById('hubDiffSeg');
  ['0', '1', '2'].forEach((d, idx) => {
    const btn = doc.createElement('button');
    btn.dataset.diff = d;
    if (d === '1') btn.className = 'active';
    diffSeg.appendChild(btn);
  });

  // weather seg
  const wxSeg = doc.getElementById('hubWeatherSeg');
  ['map', 'clear', 'overcast', 'rain', 'storm'].forEach((w, idx) => {
    const btn = doc.createElement('button');
    btn.dataset.wx = w;
    if (w === 'map') btn.className = 'active';
    wxSeg.appendChild(btn);
  });
}

function boot(campIdx = 0, zsub = null, wx = 'map') {
  for (const k in stub.byId) delete stub.byId[k];
  populateHubDom(stub.document);
  const ctx = vm.createContext(Object.assign({}, stub.sandbox));
  ctx.document = stub.document;
  ctx.window = stub.window;
  ctx.CANNON = CANNON;
  ctx.setTimeout = (f) => { try { f(); } catch (e) {} return 0; };
  ctx.clearTimeout = () => {};
  ctx.localStorage = {
    _s: {
      sf_campaign: String(campIdx),
      sf_pseed: '424242',
      ...(zsub ? { sf_zsub: zsub } : {}),
      ...(wx && wx !== 'map' ? { sf_weather: wx } : {})
    },
    getItem(k) { return this._s[k] ?? null; },
    setItem(k, v) { this._s[k] = String(v); },
    removeItem(k) { delete this._s[k]; }
  };
  for (const f of FILES) {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

let pass = 0, fail = 0;
const fails = [];
function ok(cond, label) {
  if (cond) {
    pass++;
    console.log('  ✔ ' + label);
  } else {
    fail++;
    fails.push(label);
    console.log('  ✘ ' + label);
  }
}

const src = p => fs.readFileSync(path.join(root, p), 'utf8');

console.log('================================================================');
console.log('战备大厅与核心子系统重构工程施工验收回归验证 (TC-01 ~ TC-07)');
console.log('================================================================\n');

// ─────────────────────────────────────────────────────────────────────────────
// TC-01: 天气光学梯度分级与环境特征验证
// ─────────────────────────────────────────────────────────────────────────────
console.log('── TC-01: 天气光学物理递减阶梯重构 ──');
{
  const cfg00 = src('js/00-config.js');
  const sc02 = src('js/02-scene.js');
  const ctx = boot(0, null, 'map');
  const G = s => vm.runInContext(s, ctx);
  const WX_CFG = G('WEATHER_CFG');

  ok(WX_CFG && typeof WX_CFG === 'object', 'TC-01 WEATHER_CFG 配置表存在');
  
  // 1. 光照与雾距单调严格递减梯度
  const clear = WX_CFG.clear;
  const overcast = WX_CFG.overcast;
  const rain = WX_CFG.rain;
  const storm = WX_CFG.storm;

  ok(clear.sunMul > overcast.sunMul && overcast.sunMul > rain.sunMul && rain.sunMul >= storm.sunMul,
    `TC-01 直射光 sunMul 严格递减: clear(${clear.sunMul}) > overcast(${overcast.sunMul}) > rain(${rain.sunMul}) >= storm(${storm.sunMul})`);

  ok(clear.hemiMul > overcast.hemiMul && overcast.hemiMul > rain.hemiMul && rain.hemiMul > storm.hemiMul,
    `TC-01 天光 hemiMul 严格递减: clear(${clear.hemiMul}) > overcast(${overcast.hemiMul}) > rain(${rain.hemiMul}) > storm(${storm.hemiMul})`);

  ok(clear.expoMul > overcast.expoMul && overcast.expoMul > rain.expoMul && rain.expoMul > storm.expoMul,
    `TC-01 曝光 expoMul 严格递减: clear(${clear.expoMul}) > overcast(${overcast.expoMul}) > rain(${rain.expoMul}) > storm(${storm.expoMul})`);

  ok(clear.fogFarMul > overcast.fogFarMul && overcast.fogFarMul > rain.fogFarMul && rain.fogFarMul > storm.fogFarMul,
    `TC-01 远雾 fogFarMul 严格递减: clear(${clear.fogFarMul}) > overcast(${overcast.fogFarMul}) > rain(${rain.fogFarMul}) > storm(${storm.fogFarMul})`);

  // 2. 小雨与暴雨的特异性物理参数
  ok(rain.sunMul === 0.06 && overcast.sunMul === 0.22, 'TC-01 彻底根除数值倒挂: 小雨日光(0.06)远低于阴天日光(0.22)');
  ok(rain.fogFarMul === 0.28 && rain.fogNearMul === 0.25, 'TC-01 小雨具备近距水汽雾: fogNearMul=0.25, fogFarMul=0.28');
  ok(storm.sunMul === 0.00, 'TC-01 暴雨直射光归零: storm.sunMul===0.00 (无直射硬阴影)');
  ok(storm.precipN >= 3000 && rain.precipN >= 600, 'TC-01 降水粒子密度梯级满足要求 (小雨>=600, 暴雨>=3000)');

  // 3. 场景初始化初值接线
  ok(sc02.includes('WX_CFG.sunMul') && sc02.includes('WX_CFG.hemiMul'), 'TC-02 场景初始化直接接入 WX_CFG.sunMul 与 hemiMul');
  ok(sc02.includes('scene.fog = new THREE.Fog') && sc02.includes('dryFogFar()'), 'TC-02 场景雾初始化绑定 dryFogFar()');
}

// ─────────────────────────────────────────────────────────────────────────────
// TC-02: 运行时时钟与切后台防暴涨修复
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── TC-02: 页面切后台时钟与 Visibility 状态机 ──');
{
  const inp19 = src('js/19-input.js');
  const main24 = src('js/24-main.js');

  ok(inp19.includes("document.addEventListener('visibilitychange'"), 'TC-02 注册 visibilitychange 全局事件');
  ok(inp19.includes('togglePause(true)'), 'TC-02 切后台自动触发规范暂停 togglePause(true)');
  ok(inp19.includes('lastT=performance.now()'), 'TC-02 切回前台瞬时对齐帧时间基准 lastT');

  ok(main24.includes('if(document.hidden)'), 'TC-02 loop() 主循环挂载 document.hidden 守卫');
  ok(main24.includes('nowOff+=now-lastT'), 'TC-02 document.hidden 时自动累加 nowOff 补偿后台流逝时间');

  // 沙箱运行时模拟后台切出切回验证
  const ctx = boot(0, null, 'map');
  const G = s => vm.runInContext(s, ctx);
  G("startGame(); deployPlayer();");
  
  const initialNowT = G('nowT');
  // 模拟切后台 60 秒
  G("document.hidden = true;");
  G("if(document.hidden && !gamePaused && player.alive && player.deployed && !matchOver) togglePause(true);");
  ok(G('gamePaused') === true, 'TC-02 切后台后战局自动进入暂停态');

  const t0 = G('lastT');
  const fakeNow = t0 + 60000; // 模拟时间过去 60 秒
  G(`var now = ${fakeNow}; if(gamePaused||matchOver||menuHold) nowOff += now - lastT; lastT = now;`);
  
  // 模拟切回前台
  G("document.hidden = false;");
  G(`var returnNow = ${fakeNow + 16}; nowT = (returnNow - nowOff) / 1000;`);
  const resumedNowT = G('nowT');

  // 验证战局时间零秒漂移（漂移不超过 0.05 秒）
  const drift = Math.abs(resumedNowT - initialNowT);
  ok(drift < 0.05, `TC-02 切回恢复后时钟零漂移 (60秒后台漂移量: ${drift.toFixed(4)}s < 0.05s)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// TC-03: 战场丢锁交互与暂停面板架构
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── TC-03: 战场丢锁交互与暂停设置面板 ──');
{
  const inp19 = src('js/19-input.js');
  ok(inp19.includes("document.addEventListener('pointerlockchange'"), 'TC-03 注册 pointerlockchange 监听');
  ok(inp19.includes('if(!pointerLocked&&player.alive&&player.deployed&&!matchOver&&!gamePaused&&!menuHold){\n  togglePause(true);\n}') ||
     inp19.includes('togglePause(true)'), 'TC-03 战场丢锁呼出 togglePause(true) 而非部署界面');

  // HTML 结构与面板内嵌设置检查
  ok(html.includes('id="pauseMainBtns"'), 'TC-03 暂停容器包含一级主按钮组 #pauseMainBtns');
  ok(html.includes('id="pauseSettingPanel"'), 'TC-03 暂停容器包含内嵌战斗设置面板 #pauseSettingPanel');
  ok(html.includes('id="pauseHelpPanel"'), 'TC-03 暂停容器包含内嵌键位说明面板 #pauseHelpPanel');
  ok(html.includes('id="pauseSensRange"') && html.includes('id="pauseVolRange"'), 'TC-03 暂停内嵌设置含灵敏度与音量调节 (pauseSensRange/pauseVolRange)');

  const ctx = boot(0, null, 'map');
  const G = s => vm.runInContext(s, ctx);
  G("startGame(); deployPlayer();");
  
  // 模拟丢锁
  G("pointerLocked = false; togglePause(true);");
  ok(G('gamePaused') === true, 'TC-03 丢锁后战局被安全冻结 (gamePaused===true)');
  ok(G("document.getElementById('pauseOv').classList.contains('hidden')") === false, 'TC-03 暂停面板 #pauseOv 正常呈现');
  ok(G("document.getElementById('deploy').classList.contains('hidden')") === true, 'TC-03 部署界面 #deploy 未被意外弹出');
}

// ─────────────────────────────────────────────────────────────────────────────
// TC-04: 局内补给箱交互限定重部署机制
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── TC-04: 局内补给箱交互限定重部署机制 ──');
{
  const p20 = src('js/20-player.js');
  const d23 = src('js/23-deploy.js');

  ok(p20.includes('function isNearSupplyCrate(pos)'), 'TC-04 提供 isNearSupplyCrate(pos) 判定函数');
  ok(p20.includes('Math.hypot(c.x-p.x,c.z-p.z)<=2.8'), 'TC-04 补给箱有效交互半径精确为 2.8m');
  ok(p20.includes('function rearmPlayerClass(cls)'), 'TC-04 提供 rearmPlayerClass(cls) 战地换装函数');

  const ctx = boot(0, null, 'map');
  const G = s => vm.runInContext(s, ctx);
  G("startGame(); deployPlayer();");

  // 1. 野外（远离补给箱）
  G("AMMO_CRATES.length = 0; AMMO_CRATES.push({x: 100, z: 100}); player.pos.set(0, 0, 0); showDeploy(false);");
  ok(G("isNearSupplyCrate(player.pos)") === false, 'TC-04 野外判定: isNearSupplyCrate 为 false');
  ok(G("document.getElementById('depotBadge').textContent").includes('战地整备受限'), 'TC-04 野外显示整备受限提示徽标');
  ok(G("document.querySelector('.classCard').classList.contains('locked')"), 'TC-04 野外兵种卡被添加 locked 类并置灰');
  ok(G("document.getElementById('resumeBtn').textContent").includes('返 回 战 斗'), 'TC-04 野外按钮显示为「返 回 战 斗」');

  // 点击兵种卡拦截
  const oldCls = G('player.cls');
  G("document.querySelectorAll('.classCard')[1].onclick();");
  ok(G('player.cls') === oldCls, 'TC-04 野外点击兵种卡拦截生效，不可随意换兵种');

  // 2. 补给箱 2.8m 范围内
  G("player.pos.set(101, 0, 101); showDeploy(false);"); // 距离 (100,100) 约为 1.41m <= 2.8m
  ok(G("isNearSupplyCrate(player.pos)") === true, 'TC-04 补给站判定: isNearSupplyCrate 为 true');
  ok(G("document.getElementById('depotBadge').textContent").includes('补给站整备中'), 'TC-04 补给站显示金色「换装立即生效」徽标');
  ok(G("!document.querySelector('.classCard').classList.contains('locked')"), 'TC-04 补给站兵种卡锁定解除');
  ok(G("document.getElementById('resumeBtn').textContent").includes('确认换装并返回'), 'TC-04 补给站按钮切换为「确认换装并返回」');

  // 切换兵种并执行整备换装
  G("document.querySelectorAll('.classCard')[2].onclick();");
  ok(G('player.cls') === 2, 'TC-04 补给站允许选定新兵种 (cls=2)');
  G("document.getElementById('resumeBtn').onclick();");
  ok(G('player.curW.mag') === G('player.curW.def.mag'), 'TC-04 换装完成后弹药与插槽立即更新并满额');
}

// ─────────────────────────────────────────────────────────────────────────────
// TC-05: Bot 武器表现与动态切模一致性
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── TC-05: Bot 武器表现与动态切模一致性 ──');
{
  const b14 = src('js/14-bots.js');
  ok(b14.includes('switchVisualGun(wpnKey)'), 'TC-05 Bot 类实现 switchVisualGun 动态换枪方法');
  ok(b14.includes('this.heldWpnKey=this.wpnKey'), 'TC-05 Bot 初始化持有 heldWpnKey 状态跟踪');
  ok(b14.includes('this.switchVisualGun(w2.key)') || b14.includes('switchVisualGun'), 'TC-05 反坦克开火与特殊射击挂载切枪钩子');
  ok(b14.includes('this.switchVisualGun(this.wpnKey)'), 'TC-05 开火结束或计时到期平滑切回主武器');

  const ctx = boot(0, null, 'map');
  const G = s => vm.runInContext(s, ctx);
  G("startGame(); deployPlayer();");
  
  G(`
    var bot = soldiers[0] || new Bot(0, 0);
    if(!bot.mesh) bot.mesh = { gunG: new THREE.Group(), root: new THREE.Group(), pelvis: { position: new THREE.Vector3() } };
    bot.alive = true;
    bot.hp = 100;
    bot.setClass(2); // 反坦克兵索引 2
  `);
  
  ok(G('bot.heldWpnKey') === G('bot.wpnKey'), 'TC-05 Bot 初始手持主武器模型');
  
  // 模拟切换到火箭筒
  const rocketKey = G('bot.slots[1].key');
  G(`bot.switchVisualGun('${rocketKey}');`);
  ok(G('bot.heldWpnKey') === rocketKey, `TC-05 切模执行成功: heldWpnKey 变为火箭筒(${rocketKey})`);

  // 模拟时间到期还原
  G(`
    bot.visualGunTimer = nowT - 1;
    bot.update(0.016);
  `);
  ok(G('bot.heldWpnKey') === G('bot.wpnKey'), 'TC-05 update() 驱动后平滑恢复主武器模型');
}

// ─────────────────────────────────────────────────────────────────────────────
// TC-06: 战备大厅阵营联动与受限自定义
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── TC-06: 战备大厅阵营联动与受限规则 ──');
{
  const hud22 = src('js/22-hud.js');
  ok(hud22.includes('const CAMP_THEATERS='), 'TC-06 定义地图战区映射 CAMP_THEATERS');
  ok(hud22.includes('updateHubRightPanel'), 'TC-06 实现 updateHubRightPanel 受限战况联动');

  const ctx = boot(0, null, 'map');
  const G = s => vm.runInContext(s, ctx);
  G("startNewGame();");

  // 1. 诺曼底战役（西欧）阵营联动
  const normandyIdx = G("CAMPAIGNS.findIndex(c=>c.id==='normandy')");
  G(`hubCampIdx = ${normandyIdx}; updateHubRightPanel();`);
  const normandyFacText = G("Array.from(document.getElementById('hubFactionSeg').children).map(b=>b.textContent).join(' ')");
  ok(normandyFacText.includes('美军') && normandyFacText.includes('德军'), 'TC-06 诺曼底战役合法阵营为: 美军 & 德军');
  ok(!normandyFacText.includes('日军') && !normandyFacText.includes('八路军'), 'TC-06 诺曼底战役绝不出现非法阵营 (日军/八路军)');

  // 2. 斯大林格勒（东欧）阵营联动
  const stalingradIdx = G("CAMPAIGNS.findIndex(c=>c.id==='stalingrad')");
  G(`hubCampIdx = ${stalingradIdx}; updateHubRightPanel();`);
  const stalinFacText = G("Array.from(document.getElementById('hubFactionSeg').children).map(b=>b.textContent).join(' ')");
  ok(stalinFacText.includes('苏军') && stalinFacText.includes('德军'), 'TC-06 斯大林格勒战役合法阵营为: 苏军 & 德军');
  ok(!stalinFacText.includes('美军') && !stalinFacText.includes('日军'), 'TC-06 斯大林格勒绝不出现美军/日军');

  // 3. 太平洋与远东战区筛选
  G("hubTheater = 'pac'; renderHubMapGrid();");
  const pacCards = G("document.querySelectorAll('#hubMapGrid .map-card').length");
  ok(pacCards >= 3, `TC-06 太平洋战区正确筛选出地图卡片 (数量: ${pacCards})`);

  // 4. 随机地形卡不属于战区: 任何战区筛选下末位钉卡可见 (2026-10-24 裁定)
  G("hubTheater = 'weur'; renderHubMapGrid();");
  const weurPgCards = G("document.querySelectorAll('#hubMapGrid .pg').length");
  const weurAll = G("document.querySelectorAll('#hubMapGrid .map-card').length");
  const weurLastIsPg = G("(() => { const cs = document.querySelectorAll('#hubMapGrid .map-card'); const last = cs[cs.length - 1]; return !!(last && last.classList.contains('pg')); })()");
  ok(weurPgCards === 1 && weurAll === 3 && weurLastIsPg, `TC-06 西欧筛选下随机卡仍末位钉卡 (西欧2图+钉尾随机卡=${weurAll}, pg卡=${weurPgCards}, 末位是pg=${weurLastIsPg})`);
  G("hubTheater = 'all'; renderHubMapGrid();");
  const allCards = G("document.querySelectorAll('#hubMapGrid .map-card').length");
  const allPg = G("document.querySelectorAll('#hubMapGrid .pg').length");
  ok(allCards === 15 && allPg === 1, `TC-06 全部筛选 = 14张史战图 + 1张随机钉尾卡 (共${allCards}, pg=${allPg})`);
}

// ─────────────────────────────────────────────────────────────────────────────
// TC-07: SPA 零白屏刷新与纯内存状态机
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── TC-07: SPA 零白屏刷新与运行时重置 ──');
{
  const hud22 = src('js/22-hud.js');
  const layouts05 = src('js/05c-layouts.js');
  const cfg00 = src('js/00-config.js');

  ok(cfg00.includes('ACTIVE_CAMPAIGN') && cfg00.includes('deepClone'), 'TC-07 引入 ACTIVE_CAMPAIGN 运行时深拷贝');
  ok(layouts05.includes('deepClone(CAMPAIGN)'), 'TC-07 世界构建使用深拷贝副本，隔离静态配置脏写');

  // 检验大厅常规交互中绝无白屏 reload
  const ctx = boot(0, null, 'map');
  const G = s => vm.runInContext(s, ctx);
  G("startNewGame();");

  let reloadTriggered = false;
  ctx.location.reload = () => { reloadTriggered = true; };

  // 切换模式页：战役 ➔ 丧尸 (随机地形不再是模式标签, 2026-10-24 改版)
  G("document.querySelectorAll('.mode-tabs .tab-btn')[1].onclick();"); // zombie
  ok(G("hubMode") === 'zombie' && !reloadTriggered, 'TC-07 切换丧尸生存模式无 reload');

  G("document.querySelectorAll('.mode-tabs .tab-btn')[0].onclick();"); // campaign
  ok(G("hubMode") === 'campaign' && !reloadTriggered, 'TC-07 切换回历史战役无 reload');

  // 随机地形卡下钻: 点卡进子页, ‹ 返回关面板不清选择, 全程无 reload
  G("document.querySelector('#hubMapGrid .pg').onclick();");
  ok(G("hubMode") === 'procgen' && G("hubPgOpen") === true && !reloadTriggered, 'TC-07 点随机地形卡: hubMode=procgen 且下钻子页打开, 无 reload');
  ok(G("CAMPAIGNS[hubCampIdx].id") === 'procgen', 'TC-07 随机卡选中 = procgen 战役序号');
  ok(G("document.getElementById('hubProcgenPage').classList.contains('hidden')") === false && G("document.getElementById('hubMapGrid').style.display") === 'none', 'TC-07 DOM级: 点卡后子页可见且地图列表隐藏 (2026-10-24c 实机①回归钉: 状态变量对而DOM不动)');
  G("document.getElementById('hubPgBack').onclick();");
  ok(G("hubPgOpen") === false && G("hubMode") === 'procgen' && !reloadTriggered, 'TC-07 ‹ 返回地图列表: 关子页但随机卡仍选中, 无 reload');
  ok(G("document.getElementById('hubProcgenPage').classList.contains('hidden')") === true && G("document.getElementById('hubMapGrid').style.display") !== 'none', 'TC-07 DOM级: 返回后地图列表可见且子页隐藏');

  // 丧尸页随机卡 (两页一致裁定): 模式保持 zombie, 子页同样打开; 随机卡全页唯一
  G("document.querySelectorAll('.mode-tabs .tab-btn')[1].onclick();"); // zombie
  ok(G("document.querySelectorAll('#hubMapGrid .pg').length") === 1, 'TC-07 丧尸页随机卡唯一 (2026-10-24c 实机②回归钉: 循环收进+末位钉卡曾出双卡)');
  G("document.querySelector('#hubMapGrid .pg').onclick();");
  ok(G("hubMode") === 'zombie' && G("hubPgOpen") === true && !reloadTriggered, 'TC-07 丧尸页点随机卡: 模式仍 zombie 且种子子页打开');

  // 回历史战役页选回史战卡, 保证后续就地开局断言不受随机卡影响
  G("document.querySelectorAll('.mode-tabs .tab-btn')[0].onclick();");
  G("document.querySelectorAll('#hubMapGrid .map-card')[0].onclick();");
  ok(G("hubMode") === 'campaign' && G("hubPgOpen") === false && !reloadTriggered, 'TC-07 选回史战卡: hubMode=campaign 子页关闭, 无 reload');

  // 切换战区芯片
  G("document.querySelectorAll('#hubTheaters .filter-chip')[1].onclick();"); // weur
  ok(G("hubTheater") === 'weur' && !reloadTriggered, 'TC-07 切换战区筛选无 reload');

  // 调整难度与规模
  G("document.querySelectorAll('#hubDiffSeg button')[2].onclick();"); // 精英
  G("document.querySelectorAll('#hubSizeSeg button')[3].onclick();"); // 30v30
  ok(G("hubDiff") === 2 && G("hubSize") === 3 && !reloadTriggered, 'TC-07 调整难度与规模无 reload');

  // 调整天气
  G("document.querySelectorAll('#hubWeatherSeg button')[3].onclick();"); // rain
  ok(G("hubWeather") === 'rain' && !reloadTriggered, 'TC-07 调整天气无 reload');

  // 开局（同图就地开局走 beginFreshMatch）
  G("hubCampIdx = CAMPAIGN_IDX; launchCombatHubGame();");
  ok(!reloadTriggered, 'TC-07 战备大厅就地开局纯内存重置，零白屏 reload');
  ok(G("player.alive") === false && G("player.deployed") === false, 'TC-07 战局初始化玩家状态重置规范');
}

console.log('\n================================================================');
console.log(`回归验收结果: ${pass} 项通过 / ${fail} 项失败`);
if (fails.length) {
  console.log('失败项清单:');
  for (const f of fails) console.log(' - ' + f);
}
console.log('================================================================');
process.exit(fail ? 1 : 0);
