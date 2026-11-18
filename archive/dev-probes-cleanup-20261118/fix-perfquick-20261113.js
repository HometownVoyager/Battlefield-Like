// dev/fix-perfquick-20261113.js - one-shot patch script (2026-11-13 frame-perf batch, quick items)
// Applies 4 targeted fixes to pure-LF files via exact-string replacement (Edit tool would CRLF-ify).
'use strict';
const fs = require('fs');
function patch(file, pairs) {
  let s = fs.readFileSync(file, 'utf8');
  const hadCrlf = s.includes('\r\n');
  for (const [a, b] of pairs) {
    const n = s.split(a).length - 1;
    if (n !== 1) { console.error((n === 0 ? 'MISS' : 'NONUNIQUE(' + n + ')') + ' in ' + file + ': ' + JSON.stringify(a.slice(0, 70))); process.exitCode = 1; return; }
    s = s.replace(a, b);
  }
  if (hadCrlf !== s.includes('\r\n')) { console.error('EOL CHANGED ' + file); process.exitCode = 1; return; }
  fs.writeFileSync(file, s);
  console.log('OK ' + file);
}

// 1) js/25-zombies.js - real crash bug: B declared inside if-block, used by chain loop outside it
patch('js/25-zombies.js', [
  ["zBoomBlast(src){\n if(!this._boomDone){\n  this._boomDone=true;\n  const B=ZCFG.boomer, p=V3(this.pos.x,this.pos.y+0.9,this.pos.z);",
   "zBoomBlast(src){\n const B=ZCFG.boomer;   // 2026-11-13 fix: hoisted to fn scope - chain loop below reads B.chainR but old decl sat inside if(!this._boomDone) block (ReferenceError on every boomer blast)\n if(!this._boomDone){\n  this._boomDone=true;\n  const p=V3(this.pos.x,this.pos.y+0.9,this.pos.z);"]
]);

// 2) js/01-audio.js - engine audio change gate (skip setTargetAtTime when unchanged)
patch('js/01-audio.js', [
  ["if(silenced||audioTimeFrozen()){\ne.lastVol=clamp(vol,0,0.4);\nif(e.nodes){ try{ e.nodes.g.gain.setTargetAtTime(0,ctx.currentTime,0.05); }catch(err){} }\nreturn;\n}",
   "if(silenced||audioTimeFrozen()){\ne.lastVol=clamp(vol,0,0.4);\nif(e.nodes){ try{ e.nodes.g.gain.setTargetAtTime(0,ctx.currentTime,0.05); }catch(err){} }\ne._lastVolW=undefined;   // gain was forced to 0 here: clear the gate or post-freeze update with ~same vol would skip the restore write (2026-11-13 perf batch)\nreturn;\n}"],
  ["e.lastVol=clamp(vol,0,0.4);\nconst t0=ctx.currentTime;\ne.nodes.osc.frequency.setTargetAtTime(freq,t0,0.12);\ne.nodes.osc2.frequency.setTargetAtTime(freq*0.5,t0,0.12);\ne.nodes.g.gain.setTargetAtTime(e.lastVol,t0,0.12);\n};",
   "e.lastVol=clamp(vol,0,0.4);\n// 2026-11-13 perf batch: change gate - skip setTargetAtTime when freq/vol moved < threshold since last\n// actual write (0.8Hz / 0.004 steps are inaudible under the 0.12s smoothing; saves 3 param calls per\n// vehicle per frame during steady RPM). Forced-zero branch above clears _lastVolW; stop() clears both.\nconst t0=ctx.currentTime;\nif(e._lastFreq===undefined||Math.abs(freq-e._lastFreq)>=0.8){\ne.nodes.osc.frequency.setTargetAtTime(freq,t0,0.12);\ne.nodes.osc2.frequency.setTargetAtTime(freq*0.5,t0,0.12);\ne._lastFreq=freq;\n}\nif(e._lastVolW===undefined||Math.abs(e.lastVol-e._lastVolW)>=0.004){\ne.nodes.g.gain.setTargetAtTime(e.lastVol,t0,0.12);\ne._lastVolW=e.lastVol;\n}\n};"],
  ["}catch(err){}\ne.nodes=null;\n}\nengines.delete(e);",
   "}catch(err){}\ne.nodes=null;\ne._lastFreq=undefined; e._lastVolW=undefined;   // rebuilt nodes start silent: next update must write (2026-11-13 perf batch)\n}\nengines.delete(e);"]
]);

// 3) js/24-main.js - respawnTxt: skip DOM write when content unchanged (ceil changes 1/s, was 60/s)
patch('js/24-main.js', [
  ["el('respawnTxt').textContent=respawnCd>0?`(${Math.ceil(respawnCd)})`:'';",
   "const _rt=el('respawnTxt'), _rv=respawnCd>0?`(${Math.ceil(respawnCd)})`:'';\nif(_rt._lastRv!==_rv){ _rt._lastRv=_rv; _rt.textContent=_rv; }   // 2026-11-13 perf batch: identical content skips the DOM write (logic above still runs every frame)"]
]);

// 4) js/19-input.js - Tab repeat gate (held Tab re-fired the scoreboard chain every ~30ms)
patch('js/19-input.js', [
  ["if(e.code==='Tab'){ e.preventDefault(); document.getElementById('scoreboard').style.display='block'; updateScoreboard(); }",
   "if(e.code==='Tab'){ e.preventDefault(); if(e.repeat) return;   // 2026-11-13 perf batch: OS key-repeat must not re-run the scoreboard chain\n document.getElementById('scoreboard').style.display='block'; updateScoreboard(); }"]
]);
console.log('done');
