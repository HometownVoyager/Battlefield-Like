'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const stub = require('./_bootstub.js');
require('./_bootpatch.js').patch(stub.sandbox);
{ const P = Object.getPrototypeOf(stub.THREE.Group.prototype); if(!P.clear) P.clear = function(){ this.children.length = 0; }; }

function realCL(el){
  const set=new Set();
  if(el.className) el.className.split(/\s+/).filter(Boolean).forEach(c=>set.add(c));
  const sync=()=>{ el.className=[...set].join(' '); };
  return {
    add:(...cs)=>{cs.forEach(c=>set.add(c));sync();},
    remove:(...cs)=>{cs.forEach(c=>set.delete(c));sync();},
    toggle(c,f){ if(f===undefined){ set.has(c)?set.delete(c):set.add(c);} else if(f) set.add(c); else set.delete(c); sync(); return set.has(c); },
    contains:c=>set.has(c)
  };
}

const patchEl = e => {
  if(!e) return e;
  if(e.style && !e.style.setProperty) e.style.setProperty = function(k,v){ this[k]=v; };
  if(!e.__realCL){ e.classList = realCL(e); e.__realCL = 1; }
  return e;
};

{
  const og = stub.document.getElementById.bind(stub.document);
  const oc = stub.document.createElement.bind(stub.document);
  stub.document.getElementById = id => patchEl(og(id));
  stub.document.createElement = t => patchEl(oc(t));
}

const CANNON = (() => {
  const V3 = stub.THREE.Vector3;
  class Quat{constructor(){this.x=0;this.y=0;this.z=0;this.w=1;}set(){return this;}setFromEuler(){return this;}copy(){return this;}}
  return {
    Vec3:V3,Quaternion:Quat,
    World:class{constructor(){this.gravity=new V3();this.bodies=[];}addBody(b){this.bodies.push(b);}removeBody(b){const i=this.bodies.indexOf(b);if(i>=0)this.bodies.splice(i,1);}add(b){this.addBody(b);}remove(b){this.removeBody(b);}addConstraint(){}removeConstraint(){}step(){}},
    Body:class{constructor(o){Object.assign(this,o||{});this.shapes=[];this.position=new V3();this.velocity=new V3();this.angularVelocity=new V3();this.quaternion=new Quat();}addShape(s){this.shapes.push(s);}},
    Box:class{},Sphere:class{},Material:class{},ContactMaterial:class{},NaiveBroadphase:class{},PointToPointConstraint:class{},
  };
})();

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const FILES = [...html.matchAll(/src="(js\/[^"?]+)/g)].map(m => m[1]);

function boot(campIdx, zsub){
  for(const k in stub.byId) delete stub.byId[k];
  const ctx = vm.createContext(Object.assign({}, stub.sandbox));
  ctx.document = stub.document; ctx.window = stub.window; ctx.CANNON = CANNON;
  ctx.setTimeout = (f, t) => { f(); return 0; };
  ctx.clearTimeout = () => {};
  ctx.localStorage = {
    _s: { sf_campaign: String(campIdx), sf_pseed: '194406', ...(zsub ? { sf_zsub: zsub } : {}) },
    getItem(k){ return this._s[k] ?? null; },
    setItem(k,v){ this._s[k] = String(v); },
    removeItem(k){ delete this._s[k]; }
  };
  for(const f of FILES) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  return ctx;
}

let pass = 0, fail = 0;
function ok(cond, label){
  if(cond){ pass++; console.log('  ✔ ' + label); }
  else { fail++; console.log('  ✘ ' + label); }
}

console.log('== 验证 2026-10-11 刷新不误判结算 & 固定地图不出现收藏选项 ==');

// ── 专项 1: 刷新页面（Boot）后绝对不会误触发结算 ──
console.log('\n--- 专项 1: 刷新页面后状态与结算守卫 ---');
{
  // 1.1 双队丧尸模式刷新
  const ctxTeams = boot(0, 'teams');
  const GTeams = s => vm.runInContext(s, ctxTeams);
  ok(GTeams('menuHold === true'), '刷新后处于主菜单，menuHold 初始为 true');
  ok(GTeams('matchRunning === false'), '刷新后尚未开始对局，matchRunning 为 false');
  ok(GTeams('matchEndPending === null'), '刷新后 matchEndPending 必须为 null');
  ok(GTeams('matchOver === false'), '刷新后 matchOver 必须为 false');

  // 模拟推进 100 帧 loop (包含 updateFlags 等)
  GTeams(`
    for(let i = 0; i < 100; i++) {
      if(!gamePaused && !matchOver && !menuHold) {
        updateFlags(0.05);
      }
    }
  `);
  ok(GTeams('matchEndPending === null'), '多帧主循环后未触发 matchEndPending');
  ok(GTeams('matchOver === false'), '多帧主循环后未进入 matchOver');

  // 1.2 单队丧尸模式刷新
  const ctxSolo = boot(0, 'solo');
  const GSolo = s => vm.runInContext(s, ctxSolo);
  ok(GSolo('menuHold === true && matchRunning === false'), '单队模式刷新后 menuHold=true 且 matchRunning=false');
  ok(GSolo('matchEndPending === null && !matchOver'), '单队模式刷新后无结束判决');

  // 1.3 固定地图常规模式刷新 (Normandy, Stalingrad, etc.)
  const ctxNorm = boot(0, null);
  const GNorm = s => vm.runInContext(s, ctxNorm);
  ok(GNorm('menuHold === true && matchRunning === false'), '常规地图刷新后 menuHold=true 且 matchRunning=false');
  ok(GNorm('matchEndPending === null && !matchOver'), '常规地图刷新后无结束判决');
}

// ── 专项 2: 固定地图结算和暂停界面严禁出现收藏选项 ──
console.log('\n--- 专项 2: 固定地图暂停与结算界面隐藏收藏种子 ---');
{
  // 2.1 固定地图：诺曼底 (CAMPAIGN.id = 'normandy')
  const ctxFix = boot(0, null);
  const GFix = s => vm.runInContext(s, ctxFix);
  ok(GFix("CAMPAIGN.id !== 'procgen'"), '当前战役为固定地图 (normandy)');

  // 暂停界面测试
  GFix('syncPauseSeedLine();');
  const pLineHidden = GFix("document.getElementById('pauseSeedLine').classList.contains('hidden')");
  const pBtnHidden = GFix("document.getElementById('pauseSeedFavBtn').classList.contains('hidden')");
  ok(pLineHidden, '固定地图暂停界面 #pauseSeedLine 必须带 hidden');
  ok(pBtnHidden, '固定地图暂停界面 #pauseSeedFavBtn 必须带 hidden');

  // 结算界面测试
  GFix('syncEndSeedLine();');
  const eLineHidden = GFix("document.getElementById('endSeedLine').classList.contains('hidden')");
  const eBtnHidden = GFix("document.getElementById('endSeedFavBtn').classList.contains('hidden')");
  ok(eLineHidden, '固定地图结算界面 #endSeedLine 必须带 hidden');
  ok(eBtnHidden, '固定地图结算界面 #endSeedFavBtn 必须带 hidden');

  // 2.2 固定地图：斯大林格勒 (CAMPAIGN.id = 'stalingrad')
  const ctxStal = boot(1, null);
  const GStal = s => vm.runInContext(s, ctxStal);
  GStal('syncPauseSeedLine(); syncEndSeedLine();');
  ok(GStal("document.getElementById('pauseSeedLine').classList.contains('hidden')"), '斯大林格勒暂停界面种子收藏行隐藏');
  ok(GStal("document.getElementById('endSeedLine').classList.contains('hidden')"), '斯大林格勒结算界面种子收藏行隐藏');
}

// ── 专项 3: 程序化随机地图保留收藏选项 ──
console.log('\n--- 专项 3: 程序化随机地图结算和暂停界面保留收藏选项 ---');
{
  // 随机地图下标为 14 (procgen)
  const ctxPg = boot(14, null);
  const GPg = s => vm.runInContext(s, ctxPg);
  ok(GPg("CAMPAIGN.id === 'procgen'"), '当前战役为程序化随机地图 (procgen)');

  // 暂停界面测试
  GPg('syncPauseSeedLine();');
  const pLineVis = !GPg("document.getElementById('pauseSeedLine').classList.contains('hidden')");
  const pBtnVis = !GPg("document.getElementById('pauseSeedFavBtn').classList.contains('hidden')");
  const pSeedNum = GPg("document.getElementById('pauseSeedNum').textContent");
  ok(pLineVis && pBtnVis, '随机地图暂停界面 #pauseSeedLine 与收藏按钮必须显示');
  ok(pSeedNum === '194406', '随机地图暂停界面显示正确种子号 (' + pSeedNum + ')');

  // 结算界面测试
  GPg('syncEndSeedLine();');
  const eLineVis = !GPg("document.getElementById('endSeedLine').classList.contains('hidden')");
  const eBtnVis = !GPg("document.getElementById('endSeedFavBtn').classList.contains('hidden')");
  const eSeedNum = GPg("document.getElementById('endSeedNum').textContent");
  ok(eLineVis && eBtnVis, '随机地图结算界面 #endSeedLine 与收藏按钮必须显示');
  ok(eSeedNum === '194406', '随机地图结算界面显示正确种子号 (' + eSeedNum + ')');
}

// ── 专项 4: 正常开局游戏状态流转 ──
console.log('\n--- 专项 4: 正常开局游戏状态流转 ---');
{
  const ctxGame = boot(0, null);
  const G = s => vm.runInContext(s, ctxGame);
  G("document.getElementById('startBtn').onclick();");
  ok(G('menuHold === false'), '点击开局后 menuHold 变为 false');
  ok(G('matchRunning === true'), '点击开局后 matchRunning 变为 true');
  ok(G('matchOver === false'), '点击开局后 matchOver 为 false');
  ok(G('matchEndPending === null'), '点击开局后 matchEndPending 为 null');
}

console.log(`\n══ 测试完成: ${pass} 通过 / ${fail} 失败 ══`);
if (fail > 0) process.exit(1);
