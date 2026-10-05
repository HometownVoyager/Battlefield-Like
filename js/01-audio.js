// ─────────────────────────────────────────────
// 01-audio.js —— 音频系统 AudioSys
// 源: Index.original.html 第 501-833 行
// 2026-09-17 音效停止批: 新增静默闸门 (kill 增益节点 + silenced 标记) 与 stopAll()/restoreAll() ——
//   结算 (endMatch) 与回主界面 (returnToMenu) 一律 stopAll: 立即静音 + 停引擎 + 挂起一切发声入口
//   (含 setTimeout/setInterval 里排队的来源, 如雷暴远雷与环境枪声/鸟鸣), 回战局/开新局 restoreAll 解除。
// ─────────────────────────────────────────────
'use strict';
const AudioSys = (() => {
let ctx=null, master=null, comp=null, noiseBuf=null, kill=null, uwLP=null;
let inited=false;
// 静默期 (结算页/主菜单): 一切发声入口挂起, 已发声的立即停。旧版只有 setAmbientMute (只压环境+引擎增益),
// 结算后排程的尾音/定时器触发的远雷照响, 而且 returnToMenu 里一句 setAmbientMute(false) 又把引擎增益
// 还原成上一帧的音量 —— 主菜单里那声"没停的战场音"即此 (用户实报)。
let silenced=false;
function init(){
if(inited) return; inited=true;
ctx = new (window.AudioContext||window.webkitAudioContext)();
comp = ctx.createDynamicsCompressor();
comp.threshold.value=-18; comp.ratio.value=6; comp.attack.value=0.002; comp.release.value=0.2;
master = ctx.createGain(); master.gain.value = SETTINGS.vol;
// 静默闸门: 插在压缩器与总音量之间 —— 一关闭, 所有正在发声的节点 (含已排程的尾音) 立即听不见
kill = ctx.createGain(); kill.gain.value = silenced?0.0001:1;
// 水下低通 (2026-09-18 塔拉瓦批): 串在压缩器与静默闸之间 —— 相机没入水面时全场景声音变闷
uwLP = ctx.createBiquadFilter(); uwLP.type='lowpass'; uwLP.frequency.value=20000; uwLP.Q.value=0.7;
comp.connect(uwLP); uwLP.connect(kill); kill.connect(master); master.connect(ctx.destination);
const len = ctx.sampleRate*2;
noiseBuf = ctx.createBuffer(1,len,ctx.sampleRate);
const d = noiseBuf.getChannelData(0);
for(let i=0;i<len;i++) d[i]=Math.random()*2-1;
startAmbient();
if(silenced) applySilence(); // 静默期里才初始化 (少见): 闸门立刻闭合, 环境层不许出声
}
function setVol(v){ if(master) master.gain.value=v; }
function resume(){ if(ctx&&ctx.state==='suspended') ctx.resume(); }
// ── 静默期开关 (2026-09-17 音效停止批) ──
// stopAll: 结算/回主界面用 —— 闭合闸门 (20ms 斜降, 免爆音) + 环境层归零 + 停掉全部持续声源 (引擎);
// restoreAll: 回战局/开新局用 —— 重开闸门 + 环境层回基准 (引擎由载具下一次 update 自行重建)。
function applySilence(){
if(!ctx) return;
const t0=ctx.currentTime;
try{ kill.gain.cancelScheduledValues(t0); kill.gain.setValueAtTime(kill.gain.value,t0); kill.gain.linearRampToValueAtTime(0.0001,t0+0.02); }catch(e){}
for(const a of ambMutes){ try{ a.g.gain.cancelScheduledValues(t0); a.g.gain.setTargetAtTime(0,t0,0.02); }catch(e){} }
for(const e of [...engines]) e.stop();
farWinN=0;
}
function stopAll(){
silenced=true;
applySilence();
}
function restoreAll(){
silenced=false;
if(!ctx) return;
const t0=ctx.currentTime;
try{ kill.gain.cancelScheduledValues(t0); kill.gain.setValueAtTime(kill.gain.value,t0); kill.gain.linearRampToValueAtTime(1,t0+0.06); }catch(e){}
for(const a of ambMutes){ try{ a.g.gain.setTargetAtTime(a.base,t0,0.2); }catch(e){} }
}
function isSilenced(){ return silenced; }
// 只读视图 (沙箱断言/实机诊断用): 闸门值 · 环境层增益 · 在管引擎数
function audioDebug(){
return {inited, silenced, gate:(kill&&kill.gain)?kill.gain.value:null, engines:engines.size,
ambients:ambMutes.map(a=>a.g.gain.value)};
}
function noiseSrc(){ const s=ctx.createBufferSource(); s.buffer=noiseBuf; s.loop=true; return s; }
function spatial(dist, maxD=180, pw=2){
const g = clamp(1-dist/maxD,0,1);
return { gain: pw===3?g*g*g:g*g, lp: lerp(600, 12000, g) };
}
function env(g, t0, peak, dec, sus=0.0001){
g.gain.setValueAtTime(0.0001,t0);
g.gain.linearRampToValueAtTime(peak, t0+0.004);
g.gain.exponentialRampToValueAtTime(Math.max(sus,0.0001), t0+dec);
}
let farWinT=0, farWinN=0;
function gunshot(type, dist=0, pan=0){
if(!inited) return; resume();
const t0=ctx.currentTime;
// 远处枪声限流: 100ms窗口最多4发, 防止远距离交火糊成一片
if(dist>70){
if(t0-farWinT>0.1){ farWinT=t0; farWinN=0; }
if(++farWinN>4) return;
}
const sp = spatial(dist, type==='sniper'?290:230, 3);
if(sp.gain<0.025) return;
// 玩家自己开枪音量增强
const selfB=dist<1.5?1.4:1;
const P = {
rifle:   { crack:2600, body:105, bd:0.075, v:0.82, tail:0.55 },
sniper:  { crack:2050, body:80,  bd:0.1,   v:1.0,  tail:0.78 },
smg:     { crack:3100, body:150, bd:0.05,  v:0.55, tail:0.32 },
pistol:  { crack:3400, body:185, bd:0.045, v:0.48, tail:0.26 },
mg:      { crack:2350, body:98,  bd:0.065, v:0.74, tail:0.5 },
}[type]||{crack:3000,body:140,bd:0.05,v:0.6,tail:0.35};
const panN = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
const out = ctx.createGain(); out.gain.value=1;
const lpO = ctx.createBiquadFilter(); lpO.type='lowpass'; lpO.frequency.value=sp.lp;
out.connect(lpO);
if(panN){ panN.pan.value=clamp(pan,-1,1); lpO.connect(panN); panN.connect(comp); } else lpO.connect(comp);
// 1) 枪口激波: 极短宽频噪声脆响
const n=noiseSrc();
const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=P.crack*rand(0.92,1.1); bp.Q.value=0.45;
const ng=ctx.createGain();
ng.gain.setValueAtTime(0.0001,t0);
ng.gain.linearRampToValueAtTime(P.v*sp.gain*selfB,t0+0.0015);
ng.gain.exponentialRampToValueAtTime(0.0001,t0+0.022);
n.connect(bp); bp.connect(ng); ng.connect(out); n.start(t0); n.stop(t0+0.05);
// 1b) 高频瞬态"啪"层: 让近处枪声清脆不发闷
const hfProx=clamp(1-dist/90,0,1);
if(hfProx>0.05){
const nh=noiseSrc();
const hp2=ctx.createBiquadFilter(); hp2.type='highpass'; hp2.frequency.value=4200;
const gh2=ctx.createGain();
gh2.gain.setValueAtTime(0.0001,t0);
gh2.gain.linearRampToValueAtTime(P.v*0.62*hfProx*selfB,t0+0.001);
gh2.gain.exponentialRampToValueAtTime(0.0001,t0+0.012);
nh.connect(hp2); hp2.connect(gh2); gh2.connect(out); nh.start(t0); nh.stop(t0+0.03);
}
// 2) 低频炮口冲击波: 近距离才有体感
const prox=clamp(1-dist/50,0,1);
if(prox>0.03){
const o=ctx.createOscillator(); o.type='sine';
o.frequency.setValueAtTime(P.body,t0);
o.frequency.exponentialRampToValueAtTime(42,t0+P.bd*2);
const og=ctx.createGain(); env(og,t0,P.v*0.52*prox*selfB,P.bd*2);
o.connect(og); og.connect(out); o.start(t0); o.stop(t0+P.bd*2+0.05);
const n3=noiseSrc(); const lp3=ctx.createBiquadFilter(); lp3.type='lowpass'; lp3.frequency.value=430;
const g3=ctx.createGain(); env(g3,t0,P.v*0.35*prox*selfB,P.bd*1.5);
n3.connect(lp3); lp3.connect(g3); g3.connect(out); n3.start(t0); n3.stop(t0+P.bd*1.5+0.05);
}
// 3) 旷野回声: 双拍延时模拟山壁/林地混响, 距离越远延迟越长
const far=clamp(dist/230,0,1);
if(far>0.08){
const taps=[t0+0.06+far*0.14, t0+0.14+far*0.28];
const vols=[P.v*sp.gain*far*0.28, P.v*sp.gain*far*0.16];
for(let ti=0;ti<2;ti++){
const n2=noiseSrc();
const lp2=ctx.createBiquadFilter(); lp2.type='lowpass'; lp2.frequency.value=lerp(1200,280,far)*(1-ti*0.35);
const g2=ctx.createGain();
g2.gain.setValueAtTime(0.0001,taps[ti]);
g2.gain.linearRampToValueAtTime(vols[ti],taps[ti]+0.022);
g2.gain.exponentialRampToValueAtTime(0.0001,taps[ti]+P.tail*(0.4+far*0.7)*(1-ti*0.3));
n2.connect(lp2); lp2.connect(g2); g2.connect(out);
n2.start(taps[ti]); n2.stop(taps[ti]+P.tail*(0.4+far*0.7)*(1-ti*0.3)+0.1);
}
}
}
function explosion(dist=0){
if(!inited) return;
const t0=ctx.currentTime; const sp=spatial(dist,400); if(sp.gain<0.02) return;
const o=ctx.createOscillator(); o.type='sine';
o.frequency.setValueAtTime(70,t0); o.frequency.exponentialRampToValueAtTime(24,t0+1.1);
const og=ctx.createGain(); env(og,t0,1.5*sp.gain,1.1);
o.connect(og); og.connect(comp); o.start(t0); o.stop(t0+1.2);
const n=noiseSrc(); const lp=ctx.createBiquadFilter(); lp.type='lowpass';
lp.frequency.setValueAtTime(Math.min(sp.lp,5000),t0); lp.frequency.exponentialRampToValueAtTime(120,t0+1.3);
const ng=ctx.createGain(); env(ng,t0,1.3*sp.gain,1.3);
n.connect(lp); lp.connect(ng); ng.connect(comp); n.start(t0); n.stop(t0+1.4);
}
function click(freq=2200, vol=0.25, dur=0.03){
if(!inited) return;
const t0=ctx.currentTime;
const n=noiseSrc(); const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=freq; bp.Q.value=2.5;
const g=ctx.createGain(); env(g,t0,vol,dur+0.04);
n.connect(bp); bp.connect(g); g.connect(comp); n.start(t0); n.stop(t0+dur+0.08);
}
function metalSlide(vol=0.2,dur=0.12,f0=900,f1=1600){
if(!inited) return;
const t0=ctx.currentTime;
const n=noiseSrc(); const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.Q.value=1.5;
bp.frequency.setValueAtTime(f0,t0); bp.frequency.linearRampToValueAtTime(f1,t0+dur);
const g=ctx.createGain();
g.gain.setValueAtTime(0.0001,t0); g.gain.linearRampToValueAtTime(vol,t0+dur*0.3);
g.gain.exponentialRampToValueAtTime(0.0001,t0+dur+0.03);
n.connect(bp); bp.connect(g); g.connect(comp); n.start(t0); n.stop(t0+dur+0.06);
}
function ping(){
if(!inited) return;
const t0=ctx.currentTime;
[5200,7800].forEach((f,i)=>{
const o=ctx.createOscillator(); o.type='sine'; o.frequency.value=f*rand(0.98,1.02);
const g=ctx.createGain(); env(g,t0,0.16/(i+1),0.5);
o.connect(g); g.connect(comp); o.start(t0); o.stop(t0+0.55);
});
}
function footstep(run=false, dist=0){
if(!inited) return;
const sp=spatial(dist,40); if(sp.gain<0.03) return;
const t0=ctx.currentTime;
const n=noiseSrc(); const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=run?500:380;
const g=ctx.createGain(); env(g,t0,(run?0.2:0.11)*sp.gain, 0.07);
n.connect(lp); lp.connect(g); g.connect(comp); n.start(t0); n.stop(t0+0.12);
}
function whizz(){
if(!inited) return;
const t0=ctx.currentTime;
const n=noiseSrc(); const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.Q.value=4;
bp.frequency.setValueAtTime(4200,t0); bp.frequency.exponentialRampToValueAtTime(900,t0+0.16);
const g=ctx.createGain();
g.gain.setValueAtTime(0.0001,t0); g.gain.linearRampToValueAtTime(0.22,t0+0.03);
g.gain.exponentialRampToValueAtTime(0.0001,t0+0.17);
n.connect(bp); bp.connect(g); g.connect(comp); n.start(t0); n.stop(t0+0.2);
}
function ricochet(dist){
if(!inited) return;
const sp=spatial(dist,80); if(sp.gain<0.03) return;
const t0=ctx.currentTime;
const o=ctx.createOscillator(); o.type='sine';
o.frequency.setValueAtTime(rand(2400,3600),t0);
o.frequency.exponentialRampToValueAtTime(rand(700,1100),t0+0.22);
const g=ctx.createGain(); env(g,t0,0.1*sp.gain,0.22);
o.connect(g); g.connect(comp); o.start(t0); o.stop(t0+0.25);
}
function hurt(){
if(!inited) return;
const t0=ctx.currentTime;
const o=ctx.createOscillator(); o.type='sawtooth';
o.frequency.setValueAtTime(220,t0); o.frequency.exponentialRampToValueAtTime(90,t0+0.15);
const g=ctx.createGain(); env(g,t0,0.2,0.15);
o.connect(g); g.connect(comp); o.start(t0); o.stop(t0+0.18);
}
function hitmarkSnd(kill){
if(!inited) return;
const t0=ctx.currentTime;
if(kill){
// 击杀确认: 低频重击 + 脆响 + 双音上行
const o1=ctx.createOscillator(); o1.type='sine';
o1.frequency.setValueAtTime(220,t0); o1.frequency.exponentialRampToValueAtTime(85,t0+0.13);
const g1=ctx.createGain(); env(g1,t0,0.55,0.14);
o1.connect(g1); g1.connect(comp); o1.start(t0); o1.stop(t0+0.17);
const n=noiseSrc(); const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=3400; bp.Q.value=1.4;
const gn=ctx.createGain(); env(gn,t0,0.3,0.045);
n.connect(bp); bp.connect(gn); gn.connect(comp); n.start(t0); n.stop(t0+0.08);
[[920,t0+0.03,0.34],[1380,t0+0.095,0.28]].forEach(([f,tt,v])=>{
const o=ctx.createOscillator(); o.type='triangle'; o.frequency.value=f;
const g=ctx.createGain();
g.gain.setValueAtTime(0.0001,tt);
g.gain.linearRampToValueAtTime(v,tt+0.012);
g.gain.exponentialRampToValueAtTime(0.0001,tt+0.24);
o.connect(g); g.connect(comp); o.start(tt); o.stop(tt+0.28);
});
} else {
const o=ctx.createOscillator(); o.type='square'; o.frequency.value=820;
const g=ctx.createGain(); env(g,t0,0.12,0.05);
o.connect(g); g.connect(comp); o.start(t0); o.stop(t0+0.09);
}
}
function mortarThunk(dist=0){
if(!inited) return;
const sp=spatial(dist,300); if(sp.gain<0.02) return;
const t0=ctx.currentTime;
const o=ctx.createOscillator(); o.type='sine';
o.frequency.setValueAtTime(165,t0); o.frequency.exponentialRampToValueAtTime(48,t0+0.18);
const g=ctx.createGain(); env(g,t0,0.85*sp.gain,0.2);
o.connect(g); g.connect(comp); o.start(t0); o.stop(t0+0.25);
const n=noiseSrc(); const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=900;
const g2=ctx.createGain(); env(g2,t0,0.5*sp.gain,0.09);
n.connect(lp); lp.connect(g2); g2.connect(comp); n.start(t0); n.stop(t0+0.14);
}
function nadeBounce(dist){
if(!inited) return;
const sp=spatial(dist,60); if(sp.gain<0.05) return;
click(600,0.3*sp.gain,0.04);
}
function cannon(dist=0,pan=0){
if(!inited) return; resume();
const t0=ctx.currentTime;
const sp=spatial(dist,500); if(sp.gain<0.02) return;
const o=ctx.createOscillator(); o.type='sine';
o.frequency.setValueAtTime(85,t0); o.frequency.exponentialRampToValueAtTime(26,t0+0.7);
const og=ctx.createGain(); env(og,t0,1.6*sp.gain,0.7);
o.connect(og); og.connect(comp); o.start(t0); o.stop(t0+0.8);
const n=noiseSrc(); const lp=ctx.createBiquadFilter(); lp.type='lowpass';
lp.frequency.setValueAtTime(Math.min(sp.lp,3800),t0); lp.frequency.exponentialRampToValueAtTime(160,t0+0.9);
const ng=ctx.createGain(); env(ng,t0,1.2*sp.gain,0.9);
n.connect(lp); lp.connect(ng); ng.connect(comp); n.start(t0); n.stop(t0+1);
}
function flakPop(dist=0){
if(!inited) return;
const t0=ctx.currentTime;
const sp=spatial(dist,300); if(sp.gain<0.02) return;
const n=noiseSrc(); const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=Math.min(sp.lp,1500);
const g=ctx.createGain(); env(g,t0,0.55*sp.gain,0.35);
n.connect(lp); lp.connect(g); g.connect(comp); n.start(t0); n.stop(t0+0.4);
}
const engines=new Set(); // 持续声源(坦克/飞机引擎): 暂停/结算时统一静音
function createEngine(kind){
const e={ nodes:null, kind, lastVol:0 };
e.update=(freq,vol)=>{
if(!inited){ return; }
// 静默期: 只记音量不出声 (结算/主菜单期载具不更新, 这里兜底"万一还被调用")
if(silenced){
e.lastVol=clamp(vol,0,0.4);
if(e.nodes){ try{ e.nodes.g.gain.setTargetAtTime(0,ctx.currentTime,0.05); }catch(err){} }
return;
}
if(!e.nodes){
const osc=ctx.createOscillator();
osc.type=kind==='plane'?'sawtooth':'triangle';
const osc2=ctx.createOscillator();
osc2.type='sawtooth'; osc2.detune.value=kind==='plane'?18:8;
const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=kind==='plane'?900:340;
const g=ctx.createGain(); g.gain.value=0;
osc.connect(lp); osc2.connect(lp); lp.connect(g); g.connect(comp);
osc.start(); osc2.start();
e.nodes={osc,osc2,g,lp};
engines.add(e);
}
e.lastVol=clamp(vol,0,0.4);
const t0=ctx.currentTime;
e.nodes.osc.frequency.setTargetAtTime(freq,t0,0.12);
e.nodes.osc2.frequency.setTargetAtTime(freq*0.5,t0,0.12);
e.nodes.g.gain.setTargetAtTime(e.lastVol,t0,0.12);
};
// 停: 增益归零 + 振荡器真停 + 节点置空 (2026-09-17: 旧版只把增益压到 0 且保留 nodes,
// 于是"停过的引擎"再 update 只会去改已停振荡器的频率 = 之后永远发不出声; 置空让下次 update 重建)
e.stop=()=>{
if(e.nodes){
try{
const t1=ctx.currentTime;
e.nodes.g.gain.setTargetAtTime(0,t1,0.1);
e.nodes.osc.stop(t1+0.2); e.nodes.osc2.stop(t1+0.2);
}catch(err){}
e.nodes=null;
}
engines.delete(e);
};
return e;
}
// 背景环境层(风噪/雨声)增益表: 暂停/对局结束静音, 恢复还原
const ambMutes=[];
function setAmbientMute(m){
if(!ctx) return;
// 静默期 (结算/主菜单) 优先: 此时 setAmbientMute(false) 不许把环境/引擎放开 (旧版 returnToMenu 就是这么漏的)
const mute=m||silenced;
for(const a of ambMutes) a.g.gain.setTargetAtTime(mute?0:a.base,ctx.currentTime,0.12);
for(const e of engines) if(e.nodes){ try{ e.nodes.g.gain.setTargetAtTime(mute?0:e.lastVol,ctx.currentTime,0.12); }catch(err){} }
}
function startAmbient(){
const n=noiseSrc(); const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=280;
const g=ctx.createGain(); g.gain.value=0.052;
const lfo=ctx.createOscillator(); lfo.frequency.value=0.13;
const lg=ctx.createGain(); lg.gain.value=90;
lfo.connect(lg); lg.connect(lp.frequency);
n.connect(lp); lp.connect(g); g.connect(comp); n.start(); lfo.start();
ambMutes.push({g,base:0.052});
// 雨声/风声环境层 (天气设计 §5-5): 增益收编 WX_CFG.audioLevel (小雨 0.055 / 暴雨 0.08 = 原校准值);
// 暴风雪走风声分支 —— 一期复用噪声源变调(低通)+低音量+慢 LFO 阵风, 换真风声资源=二期候选 (设计 §8⑥)。
if(WX_CFG.audioLevel>0){
const rn=noiseSrc();
if(WX_CFG.wind){
const wl=ctx.createBiquadFilter(); wl.type='lowpass'; wl.frequency.value=520; wl.Q.value=0.6;
const wg=ctx.createGain(); wg.gain.value=WX_CFG.audioLevel;
const wLfo=ctx.createOscillator(); wLfo.frequency.value=0.17;
const wLg=ctx.createGain(); wLg.gain.value=260;
wLfo.connect(wLg); wLg.connect(wl.frequency);
rn.connect(wl); wl.connect(wg); wg.connect(comp); rn.start(); wLfo.start();
ambMutes.push({g:wg,base:wg.gain.value});
}else{
const rl=ctx.createBiquadFilter(); rl.type='bandpass'; rl.frequency.value=1500; rl.Q.value=0.35;
const rg=ctx.createGain(); rg.gain.value=WX_CFG.audioLevel;
rn.connect(rl); rl.connect(rg); rg.connect(comp); rn.start();
ambMutes.push({g:rg,base:rg.gain.value});
}
}
// 远处机枪对射: 断续的闷响连射
setInterval(()=>{ if(Math.random()<0.45) distantMG(); }, 4600);
// 鸟鸣: 随机间隔的合成啁啾, 左右声道随机
setInterval(()=>{ if(Math.random()<0.55) bird(); }, 2400);
setTimeout(bird,1200);
}
function distantMG(){
if(silenced||gamePaused||matchOver) return;
if(!ctx) return;
const t0=ctx.currentTime;
const nCnt=randi(5,14), gap=rand(0.07,0.11);
const vol=rand(0.018,0.045);
const f=rand(400,700);
const panV=rand(-0.8,0.8);
const panN=ctx.createStereoPanner?ctx.createStereoPanner():null;
const bus=ctx.createGain(); bus.gain.value=1;
const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=900;
bus.connect(lp);
if(panN){ panN.pan.value=panV; lp.connect(panN); panN.connect(comp); } else lp.connect(comp);
for(let i=0;i<nCnt;i++){
const t=t0+i*gap*rand(0.9,1.1);
const o=ctx.createOscillator(); o.type='triangle'; o.frequency.value=f*rand(0.9,1.1);
const g=ctx.createGain();
g.gain.setValueAtTime(0.0001,t);
g.gain.linearRampToValueAtTime(vol,t+0.006);
g.gain.exponentialRampToValueAtTime(0.0001,t+0.05);
o.connect(g); g.connect(bus); o.start(t); o.stop(t+0.08);
}
}
// 入水/水花 (2026-09-18 塔拉瓦批): 物体入水/涉水冲击 —— 带通噪声爆发 + 低频"咕咚"
function splash(dist=0, big=false){
if(!inited) return;
const sp=spatial(dist,120); if(sp.gain<0.03) return;
const t0=ctx.currentTime;
const n=noiseSrc(); const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.Q.value=1.1;
bp.frequency.setValueAtTime(big?2600:2000,t0);
bp.frequency.exponentialRampToValueAtTime(big?700:520,t0+(big?0.3:0.16));
const g=ctx.createGain();
g.gain.setValueAtTime(0.0001,t0);
g.gain.linearRampToValueAtTime((big?0.5:0.26)*sp.gain,t0+0.012);
g.gain.exponentialRampToValueAtTime(0.0001,t0+(big?0.42:0.22));
n.connect(bp); bp.connect(g); g.connect(comp); n.start(t0); n.stop(t0+(big?0.5:0.3));
const o=ctx.createOscillator(); o.type='sine';
o.frequency.setValueAtTime(big?260:340,t0);
o.frequency.exponentialRampToValueAtTime(big?90:130,t0+0.18);
const og=ctx.createGain(); env(og,t0,(big?0.3:0.16)*sp.gain,0.22);
o.connect(og); og.connect(comp); o.start(t0); o.stop(t0+0.3);
}
// 水下闷响闸: 主链 (压缩器→静默闸) 之间串一只低通 —— 相机没入水面时把所有声音压成闷响
function setUnderwater(on){
if(!ctx||!uwLP) return;
const t0=ctx.currentTime;
try{
uwLP.frequency.cancelScheduledValues(t0);
uwLP.frequency.setValueAtTime(Math.max(60,uwLP.frequency.value),t0);
uwLP.frequency.linearRampToValueAtTime(on?420:20000,t0+(on?0.18:0.25));
}catch(e){}
}
function bird(){
// 夜档静音鸟鸣 (昼夜设计 §3.3): THEME.birds===false 是主题档 (winter/ruin/nightsea 等本来就无鸟), NIGHT_MODE 是全局夜档
if(silenced||!ctx||THEME.birds===false||NIGHT_MODE||gamePaused||matchOver) return;
const t0=ctx.currentTime;
const o=ctx.createOscillator(); o.type='sine';
const g=ctx.createGain(); g.gain.value=0;
let out=g;
if(ctx.createStereoPanner){
const pan=ctx.createStereoPanner();
pan.pan.value=rand(-0.85,0.85);
g.connect(pan); pan.connect(comp);
} else g.connect(comp);
o.connect(g);
const nCh=randi(2,5);
const dist=rand(0.4,1);
let t=t0+0.03;
for(let i=0;i<nCh;i++){
const f=rand(2300,3900);
o.frequency.setValueAtTime(f,t);
o.frequency.exponentialRampToValueAtTime(f*rand(1.12,1.42),t+rand(0.035,0.08));
if(Math.random()<0.4) o.frequency.exponentialRampToValueAtTime(f*rand(0.85,0.95),t+rand(0.09,0.13));
g.gain.setValueAtTime(0,t);
g.gain.linearRampToValueAtTime(rand(0.01,0.026)*dist,t+0.018);
g.gain.exponentialRampToValueAtTime(0.0001,t+rand(0.09,0.16));
t+=rand(0.11,0.28);
}
o.start(t0); o.stop(t+0.3);
}
const api = { init, gunshot, explosion, click, metalSlide, ping, footstep, whizz, ricochet, hurt, hitmarkSnd, nadeBounce, cannon, flakPop, createEngine, setVol, resume, mortarThunk, setAmbientMute, stopAll, restoreAll, isSilenced, audioDebug, splash, setUnderwater };
// ═════════════════════════════════════════════════════════════════════════════
// 【追加段】海战音效 (2026-09-20N 海战批, owner: naval-crew) —— 本段全部是新增行, 既有函数体一字不动;
//   插在静默闸门循环**之前**注册 ⇒ 新入口自动获得与既有入口完全对称的"静默期一律不发声"闸门 (§硬约束④)。
//
// 一、现状盘点 (为什么只做这四件 —— 派活前我逐行核过 15d/15f, 不重复发声):
//   15d-naval 已接完的: fireMain→cannon / fireSecondary·fireMG→gunshot('mg') / fireTorpedo→
//     metalSlide(180→60)+waterSplash(08-effects 已含 AudioSys.splash 入水扑通) / beginDestroy→explosion /
//     艇发动机→engines 表的 createEngine('tank') + _syncModel 里按 vel 与距离现算 freq·gain;
//   15f-battery 已接完的: 对海开火→cannon(与陆战 atGun 的 13-combat:166 同一调用口径)、炮位被毁→explosion。
//   ⇒ 岸炮对海这条**已经达标**, 本段不碰。
// 二、本段补的四件 (只读 15d 的公开字段与 craft.engine 对象, **一行都不改 15d/15f**):
//   ① 艇/两栖车的发动机"水声质感" —— 舰船与坦克听感的分水岭。复用既有 engines 对象, 只做**音色塑形**
//      (osc.type / osc2.detune / 低通截止, 频响与增益仍归 15d) + 随速度的周期性破水/履带瞬态;
//      两栖车按 15d 的 floating 字段在水陆双态间换音色: 履带态=闷响+咔哒, 浮航态=水声。
//   ② 鱼雷发射的压缩空气嘶声 + 水锤 (补在既有 metalSlide+splash 之上, 不替换它们)。
//   ③ 进水/沉没: flood 上升期的咕咚灌水 + sinking 起手的低频拖长与周期性气泡 + wreck 的沉降收束。
//   ④ 搁浅龙骨擦礁 (15d 未实现这一件): 搁浅态持续刮擦, 浅水带里有速度也刮。
// 三、硬约束落地:
//   ①只追加 (新增行, 既有函数体未改一行); ②全部走既有 engines 表 —— **常驻节点一个都不新增**
//     (只塑形既有 osc/osc2/lp), 一次性瞬态自带 stop (fire-and-forget, 与 gunshot 同规) ⇒
//     applySilence/stopAll 停引擎时本段不会留下任何还在响的节点, 不存在"载具销毁后引擎声不停";
//   ③一次性瞬态全部接 comp (主链) ⇒ 相机入水的 uwLP 低通一样管到它们, 与既有音效同一条链;
//   ④入口在闸门**之前**注册 ⇒ 静默期连函数体都不进 (与既有入口对称); 另加暂停/结算/菜单三态兜底。
// 四、性能: 距离剔除 110m (与 15d engine 的 clamp(0.3-dCam/110) 同档); 每台常驻节点 0 个新增,
//   瞬态按速度 1~3 次/秒、每次 2~4 个短节点 (全部自带 stop) ⇒ 节点预算与既有枪声同量级。
const NAVAL_AUD_CULL=110;    // 距离剔除半径 (与 15d _syncModel 的引擎衰减同档)
const _navalAud=new Map();   // craft → 本段自己的记账 (转速节拍/状态沿/鱼雷数沿); 不写 craft 上任何字段
function navalAudRpm(c){
const spd=(c.spec&&c.spec.spd)||1;
return clamp(Math.abs(c.vel||0)/spd,0,1.15);
}
// 听感档: 在水里跑 = 水声 (锯齿 + 更高的低通 + 更大的双振荡器拍频), 履带态 = 闷响 (三角)
function navalAudTimbre(c){
if(!c) return {wet:false,type:'triangle',lp:520,det:7,splash:0,clack:0};
const spec=c.spec||{}, isBoat=(c.kind==='boat'), wet=isBoat||!!c.floating;
return { wet, type: wet?'sawtooth':'triangle',
lp: wet?(isBoat?1500:820):((spec.key==='kami')?560:520),
det: wet?(isBoat?24:16):7,
splash: wet?(isBoat?1.0:0.8):0.16,
clack: wet?0:((spec.key==='kami')?1.0:0.9) };
}
// ── 一次性瞬态原语 (全部自带 stop, 全部接 comp 主链; 与既有 gunshot/metalSlide 同构造手法) ──
function navalAudHead(dist,maxD,pw){
if(!inited) return null;
const sp=spatial(dist,maxD||NAVAL_AUD_CULL,pw||2);
if(sp.gain<0.02) return null;
return {t0:ctx.currentTime,g:sp.gain};
}
function navalAudSplash(dist,vol){          // 破水/浪花拍击: 带通噪声下滑 + 低频"咕咚"
const h=navalAudHead(dist,NAVAL_AUD_CULL); if(!h) return;
const t0=h.t0, v=clamp(vol,0,0.4)*h.g;
const n=noiseSrc(); const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.Q.value=0.9;
bp.frequency.setValueAtTime(900,t0); bp.frequency.exponentialRampToValueAtTime(260,t0+0.16);
const g=ctx.createGain(); env(g,t0,v,0.2);
n.connect(bp); bp.connect(g); g.connect(comp); n.start(t0); n.stop(t0+0.28);
const o=ctx.createOscillator(); o.type='sine';
o.frequency.setValueAtTime(210,t0); o.frequency.exponentialRampToValueAtTime(78,t0+0.14);
const og=ctx.createGain(); env(og,t0,v*0.7,0.16);
o.connect(og); og.connect(comp); o.start(t0); o.stop(t0+0.22);
}
function navalAudClack(dist,vol){           // 履带咔哒 (两击)
const h=navalAudHead(dist,60); if(!h) return;
const t0=h.t0, v=clamp(vol,0,0.3)*h.g;
for(let i=0;i<2;i++){
const t=t0+i*rand(0.045,0.075);
const n=noiseSrc(); const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.Q.value=3.2;
bp.frequency.value=rand(1100,1550);
const g=ctx.createGain();
g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(v*(i?0.7:1),t+0.004);
g.gain.exponentialRampToValueAtTime(0.0001,t+0.045);
n.connect(bp); bp.connect(g); g.connect(comp); n.start(t); n.stop(t+0.07);
}
}
function navalAudGurgle(dist,vol){          // 进水咕咚 (带通在 260→180Hz 摆动 + 低频闷响)
const h=navalAudHead(dist,NAVAL_AUD_CULL); if(!h) return;
const t0=h.t0, v=clamp(vol,0,0.5)*h.g;
const n=noiseSrc(); const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.Q.value=1.6;
bp.frequency.setValueAtTime(rand(260,420),t0); bp.frequency.exponentialRampToValueAtTime(rand(150,240),t0+0.3);
const g=ctx.createGain();
g.gain.setValueAtTime(0.0001,t0); g.gain.linearRampToValueAtTime(v,t0+0.05);
g.gain.exponentialRampToValueAtTime(0.0001,t0+0.34);
n.connect(bp); bp.connect(g); g.connect(comp); n.start(t0); n.stop(t0+0.4);
const o=ctx.createOscillator(); o.type='sine';
o.frequency.setValueAtTime(rand(120,190),t0); o.frequency.exponentialRampToValueAtTime(58,t0+0.22);
const og=ctx.createGain(); env(og,t0,v*0.8,0.24);
o.connect(og); og.connect(comp); o.start(t0); o.stop(t0+0.3);
}
function navalAudSinkStart(dist){           // 沉没起手: 低频拖长 1.8s 下滑 + 水压噪声
const h=navalAudHead(dist,400); if(!h) return;
const t0=h.t0;
const o=ctx.createOscillator(); o.type='sine';
o.frequency.setValueAtTime(118,t0); o.frequency.exponentialRampToValueAtTime(34,t0+1.8);
const og=ctx.createGain();
og.gain.setValueAtTime(0.0001,t0); og.gain.linearRampToValueAtTime(0.85*h.g,t0+0.18);
og.gain.exponentialRampToValueAtTime(0.0001,t0+1.9);
o.connect(og); og.connect(comp); o.start(t0); o.stop(t0+2.0);
const n=noiseSrc(); const lp=ctx.createBiquadFilter(); lp.type='lowpass';
lp.frequency.setValueAtTime(900,t0); lp.frequency.exponentialRampToValueAtTime(140,t0+1.6);
const g=ctx.createGain(); env(g,t0,0.5*h.g,1.7);
n.connect(lp); lp.connect(g); g.connect(comp); n.start(t0); n.stop(t0+1.8);
}
function navalAudBubble(dist,vol){          // 气泡: 三连升调小泡
const h=navalAudHead(dist,NAVAL_AUD_CULL); if(!h) return;
const t0=h.t0, v=clamp(vol,0,0.3)*h.g;
for(let i=0;i<3;i++){
const t=t0+i*rand(0.05,0.11);
const o=ctx.createOscillator(); o.type='sine';
const f=rand(330,520)*(1+i*0.28);
o.frequency.setValueAtTime(f,t); o.frequency.exponentialRampToValueAtTime(f*1.7,t+0.05);
const g=ctx.createGain();
g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(v,t+0.006);
g.gain.exponentialRampToValueAtTime(0.0001,t+0.06);
o.connect(g); g.connect(comp); o.start(t); o.stop(t+0.1);
}
}
function navalAudSettle(dist){              // 残骸沉底: 金属呻吟 (复用 metalSlide 参数档) + 气泡
const h=navalAudHead(dist,260); if(!h) return;
metalSlide(0.28*h.g,0.9,90,260);
navalAudBubble(dist,0.16);
}
function navalAudKeel(dist,vol){            // 搁浅龙骨擦礁: 低频带通长刮擦 (与 metalSlide 同构造, 龙骨频率档)
const h=navalAudHead(dist,140); if(!h) return;
const t0=h.t0, dur=rand(0.28,0.5), v=clamp(vol,0,0.5)*h.g;
const n=noiseSrc(); const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.Q.value=1.2;
bp.frequency.setValueAtTime(rand(150,210),t0); bp.frequency.linearRampToValueAtTime(rand(300,420),t0+dur);
const g=ctx.createGain();
g.gain.setValueAtTime(0.0001,t0); g.gain.linearRampToValueAtTime(v,t0+dur*0.35);
g.gain.exponentialRampToValueAtTime(0.0001,t0+dur+0.04);
n.connect(bp); bp.connect(g); g.connect(comp); n.start(t0); n.stop(t0+dur+0.08);
}
function navalAudTorpAir(dist){             // 鱼雷发射: 压缩空气嘶声 + 水锤闷响 (入水扑通归 15d 的 waterSplash)
const h=navalAudHead(dist,NAVAL_AUD_CULL); if(!h) return;
const t0=h.t0;
const n=noiseSrc(); const hp=ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=1800;
const g=ctx.createGain();
g.gain.setValueAtTime(0.0001,t0); g.gain.linearRampToValueAtTime(0.5*h.g,t0+0.02);
g.gain.exponentialRampToValueAtTime(0.0001,t0+0.26);
n.connect(hp); hp.connect(g); g.connect(comp); n.start(t0); n.stop(t0+0.34);
const o=ctx.createOscillator(); o.type='sine';
o.frequency.setValueAtTime(150,t0); o.frequency.exponentialRampToValueAtTime(52,t0+0.2);
const og=ctx.createGain(); env(og,t0,0.6*h.g,0.22);
o.connect(og); og.connect(comp); o.start(t0); o.stop(t0+0.3);
}
// ── 发动机音色塑形 (只改写既有引擎的 osc.type / osc2.detune / 低通截止; 不新建常驻节点) ──
// 频响与增益仍归 15d _syncModel 的 engine.update (按 vel 与距离现算) —— 本段只管"音色", 不与它抢同一个参数。
function navalAudEngine(c,T){
const e=c&&c.engine;
if(!e||!e.nodes) return false;                 // 节点由 15d 首次 update 惰性创建; 静默期/未启用时不建
const n=e.nodes, t0=ctx.currentTime;
try{
if(n.osc&&n.osc.type!==undefined&&n.osc.type!==T.type) n.osc.type=T.type;
if(n.osc2&&n.osc2.detune&&typeof n.osc2.detune.setTargetAtTime==='function') n.osc2.detune.setTargetAtTime(T.det,t0,0.3);
if(n.lp&&n.lp.frequency&&typeof n.lp.frequency.setTargetAtTime==='function') n.lp.frequency.setTargetAtTime(T.lp,t0,0.25);
}catch(err){}
return true;
}
// 每帧入口 (由 20-player 的 updatePlayer 调用 —— 与 24-main 的 updateNaval 同频; 座位/HUD 无关, 每帧都跑)
// 2026-09-27M 时停修复批 (审计 P1-5): 两参 = (世界帧长 dt, 本体链帧长 ownDt)。旧版只收 pdt ⇒ 时停下
//   整片海战场静止而所有艇的发动机音色仍在塑形、破水/履带周期声照发 (与陆战载具"随 dt 一起停"不一致)。
//   现在逐艇解析: **只有观察者正在开的那一条** (specTimeRideDt → specRide 单源) 拿本体链帧长,
//   其余艇世界冻结 ⇒ 本帧整条跳过 (不推进任何计时、也不发任何周期声)。非时停时两者 ≡ dt ⇒ 零漂移。
function navalAudioTick(dt,ownDt){
// 静默闸门三态兜底 (闸门本身已挡"结算/主菜单"): 主循环在暂停/结算/菜单期整个冻结, 本就不该有帧推进;
// 这里再挡一次是为了"菜单里还在响"这类历史问题不再有第二个来源 —— 与既有机制同语义, 不另立一套。
if(typeof gamePaused!=='undefined'&&(gamePaused||matchOver||menuHold)) return;
if(typeof navalCraft==='undefined'||!Array.isArray(navalCraft)) return;
if(typeof dt!=='number') dt=1/60;                   // 缺参兜底 (探针/沙箱直调); dt=0 是**合法值** = 世界冻结
if(typeof ownDt!=='number') ownDt=dt;
// 记账表防漏: 对局退场会把 navalCraft 清空 (23-deploy/22-hud 的退场清理), 本表必须同步摘除
if(_navalAud.size>navalCraft.length){
const live=new Set(navalCraft);
for(const k of _navalAud.keys()) if(!live.has(k)) _navalAud.delete(k);
}
for(const c of navalCraft){
if(!c||!c.pos) continue;
const cdt=(typeof specTimeRideDt==='function')?specTimeRideDt(c,ownDt,dt):dt;
if(!(cdt>0)) continue;      // 世界冻结且不是我在开的艇 ⇒ 这一帧完全不动 (含周期声计时与音色塑形)
let st=_navalAud.get(c);
if(!st){
st={prevState:c.state,prevFlood:(typeof c.flood==='number'?c.flood:0),
prevTorp:(typeof c.torpLeft==='number'?c.torpLeft:null),
wetT:rand(0,0.5),clackT:rand(0,0.3),scrapeT:0,gurgleT:0,bubT:0,rpm:0};
_navalAud.set(c,st);
}
const rpm=navalAudRpm(c); st.rpm=rpm;
const dCam=(typeof camera!=='undefined'&&camera&&camera.position)?c.pos.distanceTo(camera.position):0;
const T=navalAudTimbre(c);
const audible=(dCam<NAVAL_AUD_CULL)&&c.state!=='wreck'&&c.alive!==false;
// ① 发动机音色 (每帧塑形; 静默期闸门已挡本函数, 这里不再判断 silenced)
navalAudEngine(c,T);
// ② 随速度的破水/履带周期声 (可听范围内有速度才发)
if(audible&&rpm>0.05){
st.wetT-=cdt;
if(T.splash>0&&rpm>0.1&&st.wetT<=0){
st.wetT=lerp(1.25,0.30,Math.min(1,rpm))/Math.max(0.4,T.splash);
navalAudSplash(dCam,(0.06+0.20*rpm)*T.splash);
}
st.clackT-=cdt;
if(T.clack>0&&st.clackT<=0){
st.clackT=lerp(0.85,0.24,Math.min(1,rpm));
navalAudClack(dCam,(0.035+0.075*rpm)*T.clack);
}
}
// ③ 进水 → 沉没 → 残骸 (15d 的 flood/state 公开字段; 只读)
const flood=(typeof c.flood==='number')?c.flood:0;
const dF=flood-st.prevFlood;
if(dF>0.0006){
st.gurgleT-=cdt;
if(st.gurgleT<=0){
st.gurgleT=clamp(0.75-dF*26,0.16,0.75);
if(audible) navalAudGurgle(dCam,clamp(0.05+dF*9,0.06,0.45));
}
}
if(c.state==='sinking'&&st.prevState!=='sinking'){ if(dCam<400) navalAudSinkStart(dCam); st.bubT=0.4; }
if(c.state==='sinking'&&dCam<NAVAL_AUD_CULL){
st.bubT-=cdt;
if(st.bubT<=0){ st.bubT=rand(0.55,1.35); navalAudBubble(dCam,0.1); }
}
if(c.state==='wreck'&&st.prevState!=='wreck'&&dCam<260) navalAudSettle(dCam);
// ④ 搁浅/浅水擦礁 (15d 未实现这一件): 搁浅态按速度持续刮擦; 浅水带里只要有速度也刮
const shallowPad=(typeof NAVAL_CFG!=='undefined'&&NAVAL_CFG.shallowPad)||0.45;
const inShallow=!!c.floating&&typeof c.depth==='number'&&c.depth>-1e8&&c.depth<((c.draft||0)+shallowPad);
if(audible&&(c.state==='ground'||(inShallow&&Math.abs(c.vel||0)>0.5))){
st.scrapeT-=cdt;
if(st.scrapeT<=0){
st.scrapeT=(c.state==='ground')?rand(0.36,0.5):rand(0.5,0.7);
const k=Math.min(1,Math.abs(c.vel||0)/2);
navalAudKeel(dCam,(c.state==='ground')?(0.30+0.25*k):0.22);
}
}
// ⑤ 鱼雷发射: torpLeft 减少 = 一次发射 (只读公开字段, 不改 15d 一行)
if(typeof c.torpLeft==='number'){
if(st.prevTorp!==null&&c.torpLeft<st.prevTorp&&dCam<NAVAL_AUD_CULL) navalAudTorpAir(dCam);
st.prevTorp=c.torpLeft;
}
// ⑥ 引擎生命周期收尾 (本段唯一一处写 craft 字段 —— 只写 15d 自己建的 engine 句柄, 且所有写入点都带说明):
// 为什么必须做: 15d 的残骸期每帧走 _respawnTick → engine.update(0,0), 而 createEngine.update 在节点被
//   stop 过之后会**重建**节点 (静音但常驻) ⇒ 每台残骸白占 4 个节点直到重生 (实测 55~70s 冷却全程)。
//   这里在残骸态把已经停过的引擎句柄摘掉: 15d 的全部 engine 调用点都有 `if(this.engine)` 守卫, 摘掉是安全的,
//   于是不再有静音残留、也不再有逐帧重建; 重生后 (alive) 补一个新的 ⇒ 与 15d 的"重生由载具 update 自己
//   重建引擎"同一语义 (createEngine 的 kind 沿用 15d 构造时的 'tank', 音色塑形仍由本段每帧接管)。
// 泄漏口径: 这是**回收**而非新增 —— 本段自身不新建任何常驻节点 (只塑形既有 osc/osc2/lp)。
if(!c.alive&&c.state==='wreck'){
if(c.engine){ try{ c.engine.stop(); }catch(e){} c.engine=null; }
}else if(c.alive&&!c.engine){
c.engine=createEngine('tank');
}
st.prevState=c.state; st.prevFlood=flood;
}
}
// 只读视图 (自检/实机诊断): 每台 craft 的转速参数 · 已塑形的音色 · 节点读数 · 记账表大小 · 在管引擎数
function navalAudioDebug(){
const out=[];
if(typeof navalCraft!=='undefined'&&Array.isArray(navalCraft)){
for(const c of navalCraft){
if(!c) continue;
const st=_navalAud.get(c), T=navalAudTimbre(c), e=c.engine, n=e&&e.nodes;
out.push({key:(c.spec&&c.spec.key)||'?',kind:c.kind,state:c.state,floating:!!c.floating,
rpm:+navalAudRpm(c).toFixed(3),
oscHz:(n&&n.osc&&n.osc.frequency)?+n.osc.frequency.value.toFixed(1):null,
gain:(n&&n.g&&n.g.gain)?+n.g.gain.value.toFixed(4):null,
timbre:T.type,lp:T.lp,det:T.det,splashMul:+T.splash.toFixed(2),clackMul:+T.clack.toFixed(2),
wetT:st?+st.wetT.toFixed(2):null,clackT:st?+st.clackT.toFixed(2):null,
flood:+(c.flood||0).toFixed(3),torpLeft:(typeof c.torpLeft==='number'?c.torpLeft:null),
dCam:(typeof camera!=='undefined'&&camera&&camera.position&&c.pos)?+c.pos.distanceTo(camera.position).toFixed(1):null});
}
}
return {crafts:out,mapSize:_navalAud.size,engines:engines.size,inited,silenced,
gate:(kill&&kill.gain)?kill.gain.value:null,uwLPFreq:(uwLP&&uwLP.frequency)?uwLP.frequency.value:null};
}
api.navalAudioTick=navalAudioTick;     // 挂进 api ⇒ 下面的闸门循环会一并包成"静默期一律不发声"
// 统一发声门控 (2026-09-17 音效停止批): 静默期 (结算页/主菜单) 里任何来源的调用一律不发声 ——
// 包括 setTimeout/setInterval 里排队的那些 (雷暴远雷就是真实来源: 它在结算之后才响, 旧版没有闸门,
// 于是"结算页上还在打雷")。createEngine 不过闸 (它返回引擎对象, 静默由引擎自身的 update 处理);
// init/resume/setVol/setAmbientMute/stopAll/restoreAll/isSilenced/audioDebug 是控制面, 也不能被闸掉。
{
const bypass=new Set(['init','resume','setVol','setAmbientMute','stopAll','restoreAll','isSilenced','audioDebug','createEngine','setUnderwater']);
for(const k of Object.keys(api)){
if(bypass.has(k)) continue;
const f=api[k];
if(typeof f!=='function') continue;
api[k]=(...a)=>silenced?undefined:f(...a);
}
}
// 海战音效只读视图**不过闸** (注册在闸门循环之后): 闸门只挡"发声", 不挡读数 —— 与既有 audioDebug 同在
// bypass 语义一侧 (结算页/主菜单里也要能诊断), 否则自检与实机探针在静默期会读到 undefined。
api.navalAudioDebug=navalAudioDebug;
return api;
})();
