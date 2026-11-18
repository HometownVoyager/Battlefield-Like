// dev/fix-deathcam-anchor-20261113.js - retarget 2 anchors in verify-dynreload-deathcam probe
// to the 2026-11-13 perf-batch guarded forms of the kcInd / killcam-filter lines (judge-follows-code).
'use strict';
const fs = require('fs');
const f = 'dev/verify-dynreload-deathcam-20261112.js';
let s = fs.readFileSync(f, 'utf8');
const had = s.includes('\r\n');
const pairs = [
  ["&&s20.includes(\"const kci=document.getElementById('kcInd'); if(kci) kci.classList.remove('hidden');\"));",
   "&&s20.includes(\"const kci=document.getElementById('kcInd'); if(kci&&kci.classList.contains('hidden')) kci.classList.remove('hidden');\"));"],
  ["['js/20-player.js', \"renderer.domElement.style.filter='grayscale(0.62) contrast(1.05) brightness(0.92)'; // killcam 滤镜: 部分去饱和 (全灰过苛), 窗口结束由 killcamEnd 还原 'none'\",",
   "['js/20-player.js', \"if(renderer.domElement.style.filter!=='grayscale(0.62) contrast(1.05) brightness(0.92)') renderer.domElement.style.filter='grayscale(0.62) contrast(1.05) brightness(0.92)'; // killcam 滤镜: 部分去饱和 (全灰过苛), 窗口结束由 killcamEnd 还原 'none' —— 2026-11-13 卡顿批: 恒定串改判等单次写 (旧版每帧重写 style.filter = 死亡期卡顿病灶)\","]
];
for (const [a, b] of pairs) {
  const n = s.split(a).length - 1;
  if (n !== 1) { console.error((n ? 'NONUNIQUE(' + n + ')' : 'MISS') + ': ' + a.slice(0, 60)); process.exitCode = 1; process.exit(1); }
  s = s.replace(a, b);
}
if (had !== s.includes('\r\n')) { console.error('EOL CHANGED'); process.exit(1); }
fs.writeFileSync(f, s);
console.log('OK anchors retargeted');
