// ─────────────────────────────────────────────
// 01-audio.js —— 音频系统 AudioSys
// 源: Index.original.html 第 501-833 行
// ★2026-11-15c 音效完全推倒重写批 (用户令: "音效完全推倒并重新设计和制造一套…足够细分, 不要吝惜"):
//   合成内核推倒重造 —— 声明式分层档案表 (GUN_PROFILES/CANNON_PROFILES/EXPLOSION_PROFILES/ENGINE_KINDS)
//   + 每发 ±5~10% 频点/增益随机变奏 + cannon/explosion 真声像 (pan 参数旧版收了不用, 本批实接)。
//   细分档位: 每把在役枪械一条独立音色档案 (~40 条) + 载具/固定机枪 9 条 + 炮 13 条 + 爆炸 17 kind
//   + 引擎 9 档 (日系坦克全系/重坦/轻中坦三档 + 飞机星型/直列两档 + 卡车新增 + 两栖/艇 + 巡飞弹)。
//   ★全部函数签名向后兼容 (新参数一律尾加可选; explosion/cannon 第一参收到数字 = 旧调用口径回落
//   generic 档), 静默闸门/时停冻结账/海战追加段契约 (osc/osc2/g/lp 节点名 + navalAudEngine 三写点)
//   原样保留; bypass 13 键 Set 原文不动。
// 2026-11-15 音效重制批: 一次性瞬态全部分层重造 + 引擎三层化 (osc3+纹理噪声) —— 已被本批档案表收编。
// 2026-09-17 音效停止批: 静默闸门 (kill 增益节点 + silenced 标记) 与 stopAll()/restoreAll()。
// 2026-09-20N 海战追加段: navalAudioTick 逐艇塑形/周期声账 (本批原文保留, 仅重生建档 kind 随 15d 口径)。
// ─────────────────────────────────────────────
'use strict';
const AudioSys = (() => {
let ctx=null, master=null, comp=null, noiseBuf=null, kill=null, uwLP=null;
let inited=false;
// 静默期 (结算页/主菜单): 一切发声入口挂起, 已发声的立即停。旧版只有 setAmbientMute (只压环境+引擎增益),
// 结算后排程的尾音/定时器触发的远雷照响, 而且 returnToMenu 里一句 setAmbientMute(false) 又把引擎增益
// 还原成上一帧的音量 —— 主菜单里那声"没停的战场音"即此 (用户实报)。
let silenced=false;
// ★2026-11-04b 时停音频批 (用户实报: 时停期间发动机引擎仍有声音, "应该还有其他类似的问题"):
//   静默闸门只认"结算/主菜单" (silenced), 时停 dt=0 时载具 update 仍照常调 engine.update(freq,vol),
//   连续振荡器/环境层/定时器周期声全都照响 —— 战场冻住了声音没冻住。这里立一条与 silenced 并列的
//   "时停冻结"账: 由 24-main 每帧按 specTimeFrozen() 单源喂入 (有变化才动作, 稳态零 WebAudio 写入),
//   冻结时引擎增益归零/环境层归零/周期声与延迟尾音一律不出声, 解冻按各自 lastVol/base 原样恢复。
//   与 silenced 同优先级: 任一为真都算静音, 解冻不会把结算页的静默闸门偷偷放开。
let timeFrozen=false;
function audioTimeFrozen(){ return !!(timeFrozen||(typeof specTimeFrozen==='function'&&specTimeFrozen())); }
function setTimeFrozenMute(on){
const want=!!on;
if(want===timeFrozen) return;
timeFrozen=want;
if(!ctx) return;
const t0=ctx.currentTime;
// 环境层 (风噪/雨声/暴风雪): 冻结归零, 解冻回各自的 base (与 setAmbientMute 同款口径)
for(const a of ambMutes){ try{ a.g.gain.cancelScheduledValues(t0); a.g.gain.setTargetAtTime(want?0:a.base,t0,0.08); }catch(e){} }
// 全部在管引擎: 冻结把增益压到 0, 解冻按 lastVol 还原 (振荡器不停, 免重建时的爆音)
for(const e of engines) if(e.nodes){ try{ e.nodes.g.gain.cancelScheduledValues(t0); e.nodes.g.gain.setTargetAtTime(want?0:e.lastVol,t0,0.08); }catch(err){} }
}
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
// 时停未解除时不许把环境层放开 (回战局/开新局与 K 解冻可能不同帧)
for(const a of ambMutes){ try{ a.g.gain.setTargetAtTime(audioTimeFrozen()?0:a.base,t0,0.2); }catch(e){} }
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
function scheduleNodeRelease(nodes, delaySec){
setTimeout(()=>{
for(let i=0;i<nodes.length;i++){
const n=nodes[i];
if(n){ try{ n.disconnect(); }catch(e){} }
}
},(delaySec+0.1)*1000);
}
// ═════════════════════════════════════════════════════════════════════════════
// ★2026-11-15c 推倒重写批: 音色档案表 (声明式分层参数, 单一数据源)
// 字段约定:
//   枪 GUN_PROFILES: crack=枪口激波带通频点 / crack2=第二峰倍率 / q=裂响带宽 / mid=中频"机身"带频点 /
//     bd=机身衰减 / thump=低频冲击起点(0=无) / v=基准响度 / tail=旷野回声尾长 / hf=近场高频脆层增益 /
//     mech=自发机械咔哒层增益 (dist<2 才出) / maxD=可听距离 (缺省 230)
//   炮 CANNON_PROFILES: thumpF/thumpE/thumpD=炮口锤滑音 / boomV / blastF=膛压中频带 / blastV /
//     lp0·sweepD=气浪低通下扫 / echoV·echoDelay·echoD=炮口回响拍 / hiss=火箭发动机尾焰嘶声
//   爆 EXPLOSION_PROFILES: subF/subE/subD/subV=次声重锤滑音 / bodyF·bodyV=爆心中频"砰" /
//     blastV·lp0·sweepD=气浪下扫 / hfW=近场高频碎裂 / pops=殉爆连响次数 / maxD
//   引擎 ENGINE_KINDS: wave=主振荡器型 / det=第二振荡器失谐分 / lp=低通截止 / nzF=纹理噪声带 /
//     nz=噪声混合率 / pitch=转速→频率倍率 (日系小引擎高转速嘶吼 / 重坦低沉)
// ═════════════════════════════════════════════════════════════════════════════
// ── 家族缺省档 (旧 snd 五类字符串仍直接可用 = 向后兼容) ──
const GUN_PROFILES={
rifle:   { crack:2600, crack2:1.6, mid:1255, bd:0.075, thump:105, v:0.82, tail:0.55 },
sniper:  { crack:2050, crack2:1.6, mid:1080, bd:0.1,   thump:80,  v:1.0,  tail:0.78, maxD:290 },
smg:     { crack:3100, crack2:1.6, mid:1570, bd:0.05,  thump:150, v:0.55, tail:0.32 },
pistol:  { crack:3400, crack2:1.6, mid:1815, bd:0.045, thump:185, v:0.48, tail:0.26 },
mg:      { crack:2350, crack2:1.6, mid:1206, bd:0.065, thump:98,  v:0.74, tail:0.5 },
// ── 美军 ──
// M1 加兰德 (.30-06 半自动): 与栓动同弹但半自动短后座, 响度饱满, 机械层是漏夹前后各一记
garand:    { crack:2700, crack2:1.62, mid:1230, bd:0.078, thump:112, v:0.84, tail:0.58, mech:1.1 },
// 汤普森 (.45 ACP): 重弹头低频厚 "突突"
thompson:  { crack:2900, crack2:1.5,  mid:1500, bd:0.055, thump:165, v:0.6,  tail:0.3,  mech:0.7 },
// 柯尔特 M1911 (.45): 手枪里的闷厚档
m1911:     { crack:3200, crack2:1.5,  mid:1720, bd:0.05,  thump:190, v:0.52, tail:0.27, mech:0.9 },
// 春田 M1903A4 (镜狙): 长管低沉长尾
springfield:{crack:2100, crack2:1.55, mid:1060, bd:0.105, thump:82,  v:1.02, tail:0.8,  mech:1.25, maxD:290 },
// 春田 M1903 (非镜栓动): 同族 .30-06, 镜略短尾
m1903:     { crack:2080, crack2:1.55, mid:1045, bd:0.1,   thump:84,  v:0.96, tail:0.72, mech:1.2 },
// 勃朗宁 BAR (.30-06 自动): 退役兵种保留定义
bar:       { crack:2400, crack2:1.58, mid:1180, bd:0.07,  thump:104, v:0.78, tail:0.52, mech:0.6 },
// M1 卡宾枪 (.30 卡宾): 轻快 pop
m1carb:    { crack:3300, crack2:1.5,  mid:1700, bd:0.042, thump:170, v:0.44, tail:0.22, mech:0.8 },
// ── 德军 ──
// 毛瑟 Kar98k (7.92): 清脆利落的德国裂响
kar98:     { crack:2150, crack2:1.62, mid:1075, bd:0.095, thump:88,  v:0.95, tail:0.72, mech:1.2 },
kar98zf:   { crack:2100, crack2:1.55, mid:1050, bd:0.1,   thump:86,  v:1.0,  tail:0.78, mech:1.25, maxD:290 },
mp40:      { crack:3200, crack2:1.5,  mid:1620, bd:0.048, thump:175, v:0.5,  tail:0.28, mech:0.65 },
// STG 44 (7.92 Kurz): 中间威力弹, 介于步枪与冲锋枪之间
stg44:     { crack:2500, crack2:1.58, mid:1300, bd:0.07,  thump:118, v:0.72, tail:0.44, mech:0.6 },
p38:       { crack:3400, crack2:1.5,  mid:1780, bd:0.046, thump:180, v:0.48, tail:0.24, mech:0.85 },
// G33/40 骑枪: 短管清脆
g33:       { crack:3000, crack2:1.55, mid:1560, bd:0.05,  thump:150, v:0.62, tail:0.4,  mech:1.1 },
// ── 苏军 ──
// 莫辛-纳甘 (7.62x54R): 俄罗斯重 boom
mosin:     { crack:2050, crack2:1.58, mid:1030, bd:0.1,   thump:84,  v:0.98, tail:0.76, mech:1.2 },
mosinpu:   { crack:2000, crack2:1.55, mid:1010, bd:0.105, thump:82,  v:1.0,  tail:0.8,  mech:1.25, maxD:290 },
// 波波沙 (7.62x25 托卡列夫): 急促尖脆
ppsh:      { crack:3600, crack2:1.45, mid:1840, bd:0.04,  thump:190, v:0.46, tail:0.22, mech:0.5 },
dp28:      { crack:2300, crack2:1.58, mid:1170, bd:0.068, thump:100, v:0.76, tail:0.5,  mech:0.55 },
tt33:      { crack:3500, crack2:1.45, mid:1820, bd:0.044, thump:188, v:0.46, tail:0.22, mech:0.85 },
// PTRD-41 (14.5mm): 反坦克枪重锤
ptrd:      { crack:1700, crack2:1.4,  mid:950,  bd:0.12,  thump:62,  v:1.24, tail:0.95, mech:1.3,  maxD:300 },
// ── 日军 ──
// 三八式 (6.5mm 友坂): 弱装药低焰, 报告声偏闷细 ("铁棒"感)
arisaka:   { crack:2450, crack2:1.5,  mid:1150, bd:0.08,  thump:108, v:0.74, tail:0.55, mech:1.2 },
type97s:   { crack:2400, crack2:1.5,  mid:1130, bd:0.085, thump:106, v:0.78, tail:0.62, mech:1.25, maxD:290 },
// 一〇〇式 (8mm 南部): 手枪弹冲锋枪, 弱
type100:   { crack:3250, crack2:1.48, mid:1760, bd:0.043, thump:182, v:0.48, tail:0.24, mech:0.65 },
type96:    { crack:2500, crack2:1.52, mid:1160, bd:0.066, thump:102, v:0.7,  tail:0.46, mech:0.55 },
// 南部十四年式 (8mm): "棒槌"弱响
nambu:     { crack:3300, crack2:1.45, mid:1860, bd:0.04,  thump:192, v:0.42, tail:0.2,  mech:0.9 },
// 九七式自动炮 (20mm 半自动): 自动炮级重锤
type97at:  { crack:1750, crack2:1.4,  mid:980,  bd:0.115, thump:66,  v:1.2,  tail:0.9,  mech:1.1,  maxD:300 },
// ── 国军 ──
// 中正式 (7.92 毛瑟仿): 与 Kar98 同族但枪口略散
zhongzheng:{ crack:2200, crack2:1.58, mid:1080, bd:0.09,  thump:90,  v:0.92, tail:0.68, mech:1.2 },
zhongzhengs:{crack:2150, crack2:1.55, mid:1060, bd:0.095, thump:88,  v:0.96, tail:0.74, mech:1.25, maxD:290 },
mp18:      { crack:3150, crack2:1.5,  mid:1660, bd:0.047, thump:172, v:0.52, tail:0.3,  mech:0.7 },
zb26:      { crack:2350, crack2:1.58, mid:1190, bd:0.07,  thump:100, v:0.78, tail:0.52, mech:0.55 },
// 驳壳枪 C96 (7.63 毛瑟): 脆高 "盒子炮"
c96:       { crack:3350, crack2:1.48, mid:1800, bd:0.045, thump:178, v:0.5,  tail:0.24, mech:0.9 },
// 博伊斯 (13.9mm): 反坦克枪
boys:      { crack:1850, crack2:1.42, mid:970,  bd:0.115, thump:68,  v:1.16, tail:0.85, mech:1.3,  maxD:300 },
// ── 八路军 ──
// 汉阳造 (7.88 老钢): 比 中正式 略钝的"老响"
hanyang:   { crack:2250, crack2:1.52, mid:1090, bd:0.095, thump:92,  v:0.88, tail:0.62, mech:1.15 },
c96auto:   { crack:3300, crack2:1.46, mid:1790, bd:0.046, thump:180, v:0.5,  tail:0.24, mech:0.6 },
type11:    { crack:2550, crack2:1.5,  mid:1180, bd:0.064, thump:104, v:0.66, tail:0.44, mech:0.55 },
// 骑枪/卡宾档: 短管亮快
m38carb:   { crack:2300, crack2:1.52, mid:1100, bd:0.085, thump:96,  v:0.8,  tail:0.5,  mech:1.15 },
type38c:   { crack:2700, crack2:1.5,  mid:1400, bd:0.06,  thump:132, v:0.7,  tail:0.42, mech:1.15 },
laotao:    { crack:2150, crack2:1.5,  mid:1050, bd:0.1,   thump:94,  v:0.84, tail:0.58, mech:1.1 },
// ── 观战/工具 ──
specsniper:{ crack:2400, crack2:1.55, mid:1150, bd:0.08,  thump:100, v:0.85, tail:0.6,  mech:0.6,  maxD:290 },
// ── 载具/固定机枪 (FACTION_MG.style / MG_BULLET_DEF / 航炮 / 舰载) ──
// 坦克同轴机枪
vcoax:     { crack:2350, crack2:1.55, mid:1200, bd:0.065, thump:100, v:0.72, tail:0.5,  mech:0 },
// MG42: 1100 发/分 "撕布" —— 每发更高频更亮
mg_mg42:   { crack:2650, crack2:1.6,  mid:1280, bd:0.06,  thump:106, v:0.8,  tail:0.55, mech:0 },
// 九二式重机枪: 440 发/分 保弹板慢沉 "咚-咚-咚"
mg_92:     { crack:1950, crack2:1.45, mid:1000, bd:0.085, thump:84,  v:0.86, tail:0.62, mech:0 },
// 马克沁 M1910 (水冷套筒): 悶
mg_maxim:  { crack:2100, crack2:1.45, mid:1040, bd:0.075, thump:90,  v:0.78, tail:0.55, mech:0 },
// M1919A4 (气冷)
mg_air:    { crack:2450, crack2:1.55, mid:1220, bd:0.062, thump:102, v:0.74, tail:0.5,  mech:0 },
// 航空机枪 (机载同步/翼炮): 高空清亮
planeMG:   { crack:2800, crack2:1.55, mid:1350, bd:0.055, thump:112, v:0.7,  tail:0.42, mech:0 },
// 舰载 .50 双联
navalSec:  { crack:2250, crack2:1.5,  mid:1150, bd:0.065, thump:98,  v:0.8,  tail:0.55, mech:0 },
// 舰载单管机枪
navalMG:   { crack:2350, crack2:1.5,  mid:1180, bd:0.063, thump:100, v:0.75, tail:0.5,  mech:0 },
// 20mm 高炮 (四联 Flakvierling 连射)
flak20:    { crack:2700, crack2:1.55, mid:1400, bd:0.05,  thump:120, v:0.72, tail:0.4,  mech:0 },
};
// ── 炮声档案 ──
const CANNON_PROFILES={
generic:  { thumpF:85, thumpE:26, thumpD:0.7,  boomV:1.6,  blastF:200, blastV:0.9,  lp0:3800, sweepD:0.9,  echoV:0.3,  echoDelay:0.11, echoD:0.29 },
// 日系坦克炮 (九七式 57mm 低初速): 浅 "咣" —— 膛压低, 锤短回响小
tkJp:     { thumpF:72, thumpE:24, thumpD:0.55, boomV:1.3,  blastF:170, blastV:0.75, lp0:3000, sweepD:0.8,  echoV:0.24, echoDelay:0.1,  echoD:0.26 },
// 中型坦克炮 (75mm): 与旧通用档同源
tkMed:    { thumpF:85, thumpE:26, thumpD:0.7,  boomV:1.6,  blastF:200, blastV:0.9,  lp0:3800, sweepD:0.9,  echoV:0.3,  echoDelay:0.11, echoD:0.29 },
// 重型坦克炮 (90mm/75L70/76F-34 重档): 深锤长尾
tkHeavy:  { thumpF:62, thumpE:20, thumpD:0.9,  boomV:1.9,  blastF:160, blastV:1.05, lp0:3200, sweepD:1.1,  echoV:0.38, echoDelay:0.13, echoD:0.36 },
// 固定反坦克炮 (高速长管): 更脆更冲
atgun:    { thumpF:95, thumpE:30, thumpD:0.5,  boomV:1.5,  blastF:260, blastV:0.95, lp0:4500, sweepD:0.7,  echoV:0.28, echoDelay:0.09, echoD:0.24 },
// 海岸重炮 (反舰): 最重一档
battery:  { thumpF:52, thumpE:16, thumpD:1.2,  boomV:2.1,  blastF:130, blastV:1.2,  lp0:2600, sweepD:1.3,  echoV:0.45, echoDelay:0.15, echoD:0.45 },
// ── 舰炮 (按 NAVAL_SPEC.key) ──
naval_lvt:   { thumpF:90, thumpE:32, thumpD:0.45, boomV:1.2,  blastF:280, blastV:0.7,  lp0:4200, sweepD:0.65, echoV:0.22, echoDelay:0.09, echoD:0.22 },  // 37mm
naval_kami:  { thumpF:58, thumpE:18, thumpD:1.0,  boomV:1.8,  blastF:150, blastV:1.05, lp0:2800, sweepD:1.1,  echoV:0.36, echoDelay:0.13, echoD:0.36 },  // 120mm 榴弹
naval_pt:    { thumpF:88, thumpE:30, thumpD:0.5,  boomV:1.25, blastF:260, blastV:0.75, lp0:4000, sweepD:0.7,  echoV:0.24, echoDelay:0.1,  echoD:0.24 },
naval_gyorai:{ thumpF:95, thumpE:35, thumpD:0.4,  boomV:1.1,  blastF:300, blastV:0.65, lp0:4400, sweepD:0.6,  echoV:0.2,  echoDelay:0.09, echoD:0.2 },
// ── 火箭筒发射 (hiss=发动机尾焰嘶声层) ──
rocket_bazooka: { thumpF:110, thumpE:45, thumpD:0.3,  boomV:0.9,  blastF:320, blastV:0.6,  lp0:2400, sweepD:0.5,  echoV:0.15, echoDelay:0.08, echoD:0.18, hiss:0.3 },
rocket_schreck: { thumpF:100, thumpE:40, thumpD:0.35, boomV:1.0,  blastF:300, blastV:0.68, lp0:2200, sweepD:0.55, echoV:0.16, echoDelay:0.08, echoD:0.2,  hiss:0.36 },
rocket_loiter:  { thumpF:130, thumpE:60, thumpD:0.25, boomV:0.7,  blastF:400, blastV:0.5,  lp0:2000, sweepD:0.4,  echoV:0.12, echoDelay:0.08, echoD:0.15, hiss:0.28 },
};
// ── 爆炸档案 ──
const EXPLOSION_PROFILES={
// 通用 (explodeAt 无 kind 兜底 / 旧数字调用口径): 与 11-15 重制档同源
generic:  { subF:58, subE:18, subD:1.4,  subV:1.7,  bodyF:260, bodyV:1.05, bodyD:0.22, blastV:1.3,  lp0:5000, sweepD:1.4,  hfW:0.55, maxD:400 },
frag:     { subF:70, subE:22, subD:0.9,  subV:1.2,  bodyF:300, bodyV:0.9,  bodyD:0.2,  blastV:0.9,  lp0:4500, sweepD:1.0,  hfW:0.7,  maxD:360 },
atcharge: { subF:55, subE:18, subD:1.2,  subV:1.5,  bodyF:240, bodyV:1.0,  bodyD:0.24, blastV:1.2,  lp0:3800, sweepD:1.2,  hfW:0.5,  maxD:400 },
mine:     { subF:55, subE:18, subD:1.2,  subV:1.5,  bodyF:240, bodyV:1.0,  bodyD:0.24, blastV:1.2,  lp0:3800, sweepD:1.2,  hfW:0.5,  maxD:400 },
mortar:   { subF:65, subE:20, subD:1.0,  subV:1.35, bodyF:270, bodyV:1.0,  bodyD:0.22, blastV:1.1,  lp0:4200, sweepD:1.1,  hfW:0.6,  maxD:380 },
bomb:     { subF:45, subE:14, subD:1.7,  subV:2.0,  bodyF:200, bodyV:1.15, bodyD:0.26, blastV:1.6,  lp0:5200, sweepD:1.7,  hfW:0.8,  maxD:460 },
// 坦克/舰炮弹落地: 短促脆响 + 中锤
shell:    { subF:75, subE:24, subD:0.6,  subV:1.1,  bodyF:340, bodyV:1.0,  bodyD:0.18, blastV:0.85, lp0:5000, sweepD:0.7,  hfW:1.0,  maxD:380 },
// 弹药殉爆 (坦克/卡车/飞机击毁): 大 + pops=殉爆连响
tankdie:  { subF:50, subE:16, subD:1.4,  subV:1.8,  bodyF:220, bodyV:1.1,  bodyD:0.24, blastV:1.4,  lp0:4600, sweepD:1.5,  hfW:0.7,  pops:3, maxD:420 },
truckdie: { subF:60, subE:20, subD:1.0,  subV:1.4,  bodyF:260, bodyV:1.0,  bodyD:0.22, blastV:1.1,  lp0:4200, sweepD:1.1,  hfW:0.6,  pops:1, maxD:380 },
planedie: { subF:48, subE:15, subD:1.5,  subV:1.7,  bodyF:210, bodyV:1.1,  bodyD:0.24, blastV:1.3,  lp0:4400, sweepD:1.6,  hfW:0.7,  pops:2, maxD:440 },
// 舰艇中弹/被毁
navalShell:{subF:55, subE:17, subD:1.1,  subV:1.6,  bodyF:230, bodyV:1.05, bodyD:0.24, blastV:1.3,  lp0:4000, sweepD:1.2,  hfW:0.5,  maxD:440 },
naval:    { subF:55, subE:17, subD:1.1,  subV:1.6,  bodyF:230, bodyV:1.05, bodyD:0.24, blastV:1.3,  lp0:4000, sweepD:1.2,  hfW:0.5,  maxD:440 },
// 鱼雷 (水下): 最沉最闷 —— 低通压掉高频
torpedo:  { subF:40, subE:12, subD:1.8,  subV:2.0,  bodyF:180, bodyV:1.0,  bodyD:0.26, blastV:1.2,  lp0:2400, sweepD:1.8,  hfW:0.3,  maxD:460 },
// 越境重炮犁地 (兵临城下 TB 炮火)
barrage:  { subF:52, subE:16, subD:1.3,  subV:1.7,  bodyF:210, bodyV:1.1,  bodyD:0.24, blastV:1.35, lp0:3600, sweepD:1.5,  hfW:0.4,  maxD:440 },
// 雷暴远雷: 只剩天穹闷响 (无碎裂无弹片, 可听距离拉满)
thunder:  { subF:42, subE:13, subD:2.2,  subV:1.6,  bodyF:150, bodyV:0.8,  bodyD:0.3,  blastV:1.0,  lp0:1200, sweepD:2.4,  hfW:0,    debV:0, maxD:999 },
// 油桶/油料: 亮 pop
drum:     { subF:80, subE:26, subD:0.5,  subV:1.0,  bodyF:320, bodyV:0.95, bodyD:0.18, blastV:1.0,  lp0:4800, sweepD:0.7,  hfW:1.2,  maxD:340 },
// 结构坍塌 (楼板/高墙/炮台): 持续闷隆 + 大量散落
collapse: { subF:44, subE:14, subD:1.6,  subV:1.5,  bodyF:190, bodyV:0.9,  bodyD:0.3,  blastV:0.9,  lp0:2000, sweepD:1.8,  hfW:0.2,  debV:0.28, maxD:420 },
batterydie:{subF:48, subE:15, subD:1.5,  subV:1.6,  bodyF:200, bodyV:1.0,  bodyD:0.26, blastV:1.0,  lp0:2400, sweepD:1.6,  hfW:0.2,  debV:0.26, pops:1, maxD:420 },
// 巡飞弹战斗部
loiter:   { subF:75, subE:24, subD:0.7,  subV:1.1,  bodyF:300, bodyV:0.9,  bodyD:0.2,  blastV:0.9,  lp0:4400, sweepD:0.8,  hfW:0.8,  maxD:360 },
};
// ── 引擎档位表 ──
const ENGINE_KINDS={
// 轻中坦 (谢尔曼/四号/T-34/维克斯/T-26): 与旧 'tank' 档同源
tankSmall:  { wave:'triangle', det:8,  lp:340, nzF:420,  nz:0.35, pitch:1.0 },
// 日系全系 (九七式/一式+缴获, chiha 形): 风冷小引擎高转速嘶吼 —— 更糙 (saw)、更亮、噪声颗粒更粗
tankJp:     { wave:'sawtooth', det:12, lp:480, nzF:640,  nz:0.45, pitch:1.35 },
// 重坦 (潘兴/黑豹/KV-1): 大排量低沉 V12 —— 低通压深、转速档低
tankBig:    { wave:'triangle', det:6,  lp:240, nzF:320,  nz:0.3,  pitch:0.8 },
// 直列液冷机 (P-51/BF-109/零式/隼 剪影机鼻): 平滑高转嗡鸣
planeInline:{ wave:'sawtooth', det:18, lp:900, nzF:1400, nz:0.5,  pitch:1.0 },
// 星型气冷机 (P-47/FW-190/La-5/IL-2/霍克III/伊-16/九九式): 粗哑 "大喇叭" 拍频更强、亚八度更重
planeRadial:{ wave:'sawtooth', det:26, lp:700, nzF:950,  nz:0.55, pitch:0.85 },
// 运输卡车 (2026-11-15c 新增: 车队首次有引擎声): 中速方波 "哒哒" 柴油味
truck:      { wave:'square',   det:10, lp:420, nzF:700,  nz:0.45, pitch:1.1 },
// 两栖履带 (LVT/卡米): 基档=坦克系; 每帧音色由海战追加段 navalAudEngine 塑形接管 (契约不变)
amph:       { wave:'triangle', det:8,  lp:340, nzF:420,  nz:0.35, pitch:0.95 },
// 汽艇 (PT/九三式鱼雷艇): 基档=高转系; 同上由海战追加段接管
boat:       { wave:'sawtooth', det:16, lp:800, nzF:1100, nz:0.45, pitch:1.0 },
// 巡飞弹 (小型螺旋桨电驱): 高频细嗡
loiter:     { wave:'sawtooth', det:14, lp:1200, nzF:1800, nz:0.5,  pitch:1.6 },
};
// 旧档别名 (在册探针/空桩兼容: verify-batch-20261114 直调 createEngine('tank'))
const ENGINE_ALIASES={ tank:'tankSmall', plane:'planeInline' };
// 声像辅助: 世界坐标 → [-1,1] 声像 (相机右向量 · 方向XZ)。cannon/explosion/gunshot 真声像共用。
function panOf(pos){
if(typeof camera==='undefined'||!camera||!camera.matrixWorld||!camera.position||!pos) return 0;
const e=camera.matrixWorld.elements;
const rx=e[0], rz=e[2];   // 相机右基向量 (matrixWorld 列主序首列) 的 XZ 分量
const dx=pos.x-camera.position.x, dz=pos.z-camera.position.z;
const L=Math.hypot(dx,dz);
if(L<0.001) return 0;
return clamp((dx*rx+dz*rz)/L,-1,1);
}
let farWinT=0, farWinN=0;
// ── 枪声合成器 (2026-11-15c 推倒重写): 档案表驱动 + 每发变奏 ──
// 第一参收音色 id (WPN_DEFS.sid / 旧 snd 家族串); 未登记 id 回落 rifle 档。
function gunshot(id, dist=0, pan=0){
if(!inited) return; resume();
const t0=ctx.currentTime;
// 远处枪声限流: 100ms窗口最多4发, 防止远距离交火糊成一片
if(dist>70){
if(t0-farWinT>0.1){ farWinT=t0; farWinN=0; }
if(++farWinN>4) return;
}
const P=GUN_PROFILES[id]||GUN_PROFILES.rifle;
const sp=spatial(dist, P.maxD||230, 3);
if(sp.gain<0.025) return;
// 玩家自己开枪音量增强
const selfB=dist<1.5?1.4:1;
// 每发变奏: 频点 ±7% / 响度 ±9% —— 连发不重样 (2026-11-15c)
const jf=a=>a*rand(0.93,1.07);
const jv=a=>a*rand(0.91,1.1);
const panN = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
const out = ctx.createGain(); out.gain.value=1;
const lpO = ctx.createBiquadFilter(); lpO.type='lowpass'; lpO.frequency.value=sp.lp;
out.connect(lpO);
if(panN){ panN.pan.value=clamp(pan,-1,1); lpO.connect(panN); panN.connect(comp); } else lpO.connect(comp);
const relNodes=[out,lpO];
if(panN) relNodes.push(panN);
// 1) 枪口激波: 极短宽频噪声脆响 + +60% 频率窄带"第二峰" (双峰"两层脆"质感, 11-15 重制批口径)
const n=noiseSrc();
const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=jf(P.crack); bp.Q.value=P.q||0.45;
const ng=ctx.createGain();
ng.gain.setValueAtTime(0.0001,t0);
ng.gain.linearRampToValueAtTime(jv(P.v)*sp.gain*selfB,t0+0.0015);
ng.gain.exponentialRampToValueAtTime(0.0001,t0+0.022);
n.connect(bp); bp.connect(ng); ng.connect(out); n.start(t0); n.stop(t0+0.05);
relNodes.push(n,bp,ng);
const n1b=noiseSrc();
const bp1b=ctx.createBiquadFilter(); bp1b.type='bandpass'; bp1b.frequency.value=jf(P.crack*(P.crack2||1.6)); bp1b.Q.value=0.9;
const ng1b=ctx.createGain();
ng1b.gain.setValueAtTime(0.0001,t0);
ng1b.gain.linearRampToValueAtTime(jv(P.v*0.45)*sp.gain*selfB,t0+0.001);
ng1b.gain.exponentialRampToValueAtTime(0.0001,t0+0.014);
n1b.connect(bp1b); bp1b.connect(ng1b); ng1b.connect(out); n1b.start(t0); n1b.stop(t0+0.03);
relNodes.push(n1b,bp1b,ng1b);
// 1b) 高频瞬态"啪"层: 让近处枪声清脆不发闷 (hf=0 的档案跳过)
const hfW2=P.hf===undefined?0.62:P.hf;
const hfProx=clamp(1-dist/90,0,1);
if(hfW2>0.05&&hfProx>0.05){
const nh=noiseSrc();
const hp2=ctx.createBiquadFilter(); hp2.type='highpass'; hp2.frequency.value=4200;
const gh2=ctx.createGain();
gh2.gain.setValueAtTime(0.0001,t0);
gh2.gain.linearRampToValueAtTime(jv(P.v*hfW2)*hfProx*selfB,t0+0.001);
gh2.gain.exponentialRampToValueAtTime(0.0001,t0+0.012);
nh.connect(hp2); hp2.connect(gh2); gh2.connect(out); nh.start(t0); nh.stop(t0+0.03);
relNodes.push(nh,hp2,gh2);
}
// 1c) 中频"机身"层: 枪声的"肉" (mid=带通频点, bd=衰减)
const midW=clamp(1-dist/110,0,1);
if(midW>0.04){
const nm=noiseSrc();
const bm=ctx.createBiquadFilter(); bm.type='bandpass'; bm.frequency.value=jf(P.mid); bm.Q.value=0.75;
const gm=ctx.createGain(); env(gm,t0,jv(P.v*0.5)*midW*sp.gain*selfB,P.bd*1.7);
nm.connect(bm); bm.connect(gm); gm.connect(out); nm.start(t0); nm.stop(t0+P.bd*1.7+0.06);
relNodes.push(nm,bm,gm);
}
// 2) 低频炮口冲击波: 近距离才有体感 (thump=起点滑音)
const prox=clamp(1-dist/50,0,1);
if(P.thump>0&&prox>0.03){
const o=ctx.createOscillator(); o.type='sine';
o.frequency.setValueAtTime(jf(P.thump),t0);
o.frequency.exponentialRampToValueAtTime(42,t0+P.bd*2);
const og=ctx.createGain(); env(og,t0,jv(P.v*0.52)*prox*selfB,P.bd*2);
o.connect(og); og.connect(out); o.start(t0); o.stop(t0+P.bd*2+0.05);
const n3=noiseSrc(); const lp3=ctx.createBiquadFilter(); lp3.type='lowpass'; lp3.frequency.value=430;
const g3=ctx.createGain(); env(g3,t0,jv(P.v*0.35)*prox*selfB,P.bd*1.5);
n3.connect(lp3); lp3.connect(g3); g3.connect(out); n3.start(t0); n3.stop(t0+P.bd*1.5+0.05);
relNodes.push(o,og,n3,lp3,g3);
}
// 2b) 自发枪械操作感 (dist<2 专用): 闭锁回位+抛壳两记金属轻咔 (+28ms/+46ms), mech=0 的载具机枪档跳过
const mechW=P.mech===undefined?1:P.mech;
if(dist<2&&mechW>0.05){
for(const [tt2,f2,v2] of [[t0+0.028,2450,0.05*mechW],[t0+0.046,3150,0.034*mechW]]){
const nc=noiseSrc();
const bc=ctx.createBiquadFilter(); bc.type='bandpass'; bc.frequency.value=jf(f2); bc.Q.value=4.5;
const gc=ctx.createGain();
gc.gain.setValueAtTime(0.0001,tt2);
gc.gain.linearRampToValueAtTime(v2*selfB,tt2+0.003);
gc.gain.exponentialRampToValueAtTime(0.0001,tt2+0.03);
nc.connect(bc); bc.connect(gc); gc.connect(out); nc.start(tt2); nc.stop(tt2+0.05);
relNodes.push(nc,bc,gc);
}
}
// 3) 旷野回声: 双拍延时模拟山壁/林地混响, 距离越远延迟越长
let maxEchoDur=0.1;
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
const tailDur=P.tail*(0.4+far*0.7)*(1-ti*0.3);
g2.gain.exponentialRampToValueAtTime(0.0001,taps[ti]+tailDur);
n2.connect(lp2); lp2.connect(g2); g2.connect(out);
n2.start(taps[ti]); n2.stop(taps[ti]+tailDur+0.1);
relNodes.push(n2,lp2,g2);
const endD=(taps[ti]-t0)+tailDur+0.1;
if(endD>maxEchoDur) maxEchoDur=endD;
}
}
scheduleNodeRelease(relNodes, Math.max(0.3, maxEchoDur));
}
// ── 爆炸合成器 (2026-11-15c 推倒重写): kind 档案驱动 ──
// 第一参收 kind 串; 收到数字 = 旧调用口径 (只传 dist) 回落 generic 档 —— 向后兼容。
function explosion(kind, dist=0, pan=0){
if(!inited) return;
if(typeof kind==='number'){ dist=kind; kind='generic'; }
const P=EXPLOSION_PROFILES[kind]||EXPLOSION_PROFILES.generic;
const t0=ctx.currentTime;
const sp=spatial(dist,P.maxD||400); if(sp.gain<0.02) return;
const rel=[];
const panN = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
const out = ctx.createGain(); out.gain.value=1;
const lpO = ctx.createBiquadFilter(); lpO.type='lowpass'; lpO.frequency.value=sp.lp;
out.connect(lpO);
if(panN){ panN.pan.value=clamp(pan,-1,1); lpO.connect(panN); panN.connect(comp); } else lpO.connect(comp);
rel.push(out,lpO); if(panN) rel.push(panN);
// ① 次声重锤: subF→subE 滑音 subD 秒 ("地面在震"的体感)
const o=ctx.createOscillator(); o.type='sine';
o.frequency.setValueAtTime(P.subF,t0); o.frequency.exponentialRampToValueAtTime(P.subE,t0+P.subD);
const og=ctx.createGain(); env(og,t0,P.subV*sp.gain,P.subD);
o.connect(og); og.connect(out); o.start(t0); o.stop(t0+P.subD+0.1); rel.push(o,og);
// ② 爆心中频"砰": 带通 bodyF 短促一记 (骨架层)
const nb=noiseSrc(); const bp2=ctx.createBiquadFilter(); bp2.type='bandpass'; bp2.frequency.value=P.bodyF; bp2.Q.value=0.7;
const g2=ctx.createGain(); env(g2,t0,P.bodyV*sp.gain,P.bodyD||0.22);
nb.connect(bp2); bp2.connect(g2); g2.connect(out); nb.start(t0); nb.stop(t0+(P.bodyD||0.22)+0.1); rel.push(nb,bp2,g2);
// ③ 主体气浪: 低通 lp0→100 下扫 sweepD
const n=noiseSrc(); const lp=ctx.createBiquadFilter(); lp.type='lowpass';
lp.frequency.setValueAtTime(Math.min(sp.lp,P.lp0),t0); lp.frequency.exponentialRampToValueAtTime(100,t0+P.sweepD);
const ng=ctx.createGain(); env(ng,t0,P.blastV*sp.gain,P.sweepD);
n.connect(lp); lp.connect(ng); ng.connect(out); n.start(t0); n.stop(t0+P.sweepD+0.1); rel.push(n,lp,ng);
// ④ 近场高频碎裂: hfW>0 且 60m 内才有 (破片初始动能的"哗")
const hfW2=P.hfW||0;
const hf=clamp(1-dist/60,0,1);
if(hfW2>0.05&&hf>0.05){
const nh=noiseSrc(); const hp2=ctx.createBiquadFilter(); hp2.type='highpass'; hp2.frequency.value=3400;
const gh2=ctx.createGain(); env(gh2,t0,hfW2*hf*sp.gain,0.05);
nh.connect(hp2); hp2.connect(gh2); gh2.connect(out); nh.start(t0); nh.stop(t0+0.1); rel.push(nh,hp2,gh2);
}
// ⑤ 弹片散落尾音: 0.12~0.95s 间散布 2~5 记小带通噼啪 (debV 覆盖档位; thunder debV=0 跳过)
const debV2=P.debV===undefined?0.17:P.debV;
if(debV2>0){
const nDeb=dist<90?randi(3,5):2;
const debW=clamp(1-dist/140,0,1);
for(let k=0;k<nDeb;k++){
const tt=t0+rand(0.12,0.95);
const nd=noiseSrc();
const bd=ctx.createBiquadFilter(); bd.type='bandpass'; bd.frequency.value=rand(480,1650); bd.Q.value=2.2;
const gd=ctx.createGain();
gd.gain.setValueAtTime(0.0001,tt);
gd.gain.linearRampToValueAtTime(debV2*sp.gain*debW*rand(0.5,1),tt+0.006);
gd.gain.exponentialRampToValueAtTime(0.0001,tt+0.05);
nd.connect(bd); bd.connect(gd); gd.connect(out); nd.start(tt); nd.stop(tt+0.09); rel.push(nd,bd,gd);
}
}
// ⑥ 殉爆连响 (pops>0): 弹药架连环小爆 —— 坦克/卡车/飞机击毁的"嘭…嘭…嘭"
if(P.pops>0){
for(let k=0;k<P.pops;k++){
const tt=t0+rand(0.15,0.8);
const po=ctx.createOscillator(); po.type='sine';
po.frequency.setValueAtTime(rand(80,120),tt); po.frequency.exponentialRampToValueAtTime(40,tt+0.16);
const pg=ctx.createGain(); env(pg,tt,0.35*sp.gain*rand(0.6,1),0.16);
po.connect(pg); pg.connect(out); po.start(tt); po.stop(tt+0.22); rel.push(po,pg);
const pn=noiseSrc(); const pb=ctx.createBiquadFilter(); pb.type='bandpass'; pb.frequency.value=rand(420,760); pb.Q.value=1.2;
const pgn=ctx.createGain(); env(pgn,tt,0.22*sp.gain*rand(0.5,1),0.12);
pn.connect(pb); pb.connect(pgn); pgn.connect(out); pn.start(tt); pn.stop(tt+0.18); rel.push(pn,pb,pgn);
}
}
scheduleNodeRelease(rel, P.subD+0.6);
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
// 脚步 (2026-11-15 重制批口径原样保留): 闷响层 + 鞋底擦地"沙"层 + 逐步随机化
function footstep(run=false, dist=0){
if(!inited) return;
const sp=spatial(dist,40); if(sp.gain<0.03) return;
const t0=ctx.currentTime;
const rel=[];
const n=noiseSrc(); const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=(run?500:380)*rand(0.85,1.15);
const g=ctx.createGain(); env(g,t0,(run?0.2:0.11)*sp.gain, 0.07);
n.connect(lp); lp.connect(g); g.connect(comp); n.start(t0); n.stop(t0+0.12); rel.push(n,lp,g);
const n2=noiseSrc(); const bp2=ctx.createBiquadFilter(); bp2.type='bandpass'; bp2.frequency.value=rand(900,1500); bp2.Q.value=1.2;
const g2=ctx.createGain(); env(g2,t0+0.012,(run?0.085:0.045)*sp.gain, 0.05);
n2.connect(bp2); bp2.connect(g2); g2.connect(comp); n2.start(t0+0.012); n2.stop(t0+0.1); rel.push(n2,bp2,g2);
scheduleNodeRelease(rel, 0.18);
}
// 弹道呼啸 (11-15 重制批口径保留): 高频窄带下扫 + 低频气浪衬底
function whizz(){
if(!inited) return;
const t0=ctx.currentTime;
const rel=[];
const n=noiseSrc(); const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.Q.value=4;
bp.frequency.setValueAtTime(4200,t0); bp.frequency.exponentialRampToValueAtTime(900,t0+0.16);
const g=ctx.createGain();
g.gain.setValueAtTime(0.0001,t0); g.gain.linearRampToValueAtTime(0.22,t0+0.03);
g.gain.exponentialRampToValueAtTime(0.0001,t0+0.17);
n.connect(bp); bp.connect(g); g.connect(comp); n.start(t0); n.stop(t0+0.2); rel.push(n,bp,g);
const n2=noiseSrc(); const lp2=ctx.createBiquadFilter(); lp2.type='lowpass'; lp2.frequency.value=620;
const g2=ctx.createGain();
g2.gain.setValueAtTime(0.0001,t0); g2.gain.linearRampToValueAtTime(0.14,t0+0.035);
g2.gain.exponentialRampToValueAtTime(0.0001,t0+0.19);
n2.connect(lp2); lp2.connect(g2); g2.connect(comp); n2.start(t0); n2.stop(t0+0.22); rel.push(n2,lp2,g2);
scheduleNodeRelease(rel, 0.28);
}
// 跳弹 (11-15 重制批口径保留): 金属下滑哨 + 撞击瞬间的带通噪声一记
function ricochet(dist){
if(!inited) return;
const sp=spatial(dist,80); if(sp.gain<0.03) return;
const t0=ctx.currentTime;
const o=ctx.createOscillator(); o.type='sine';
o.frequency.setValueAtTime(rand(2400,3600),t0);
o.frequency.exponentialRampToValueAtTime(rand(700,1100),t0+0.22);
const g=ctx.createGain(); env(g,t0,0.1*sp.gain,0.22);
o.connect(g); g.connect(comp); o.start(t0); o.stop(t0+0.25);
const n=noiseSrc(); const bp2=ctx.createBiquadFilter(); bp2.type='bandpass'; bp2.frequency.value=rand(1800,2600); bp2.Q.value=1.6;
const g2=ctx.createGain(); env(g2,t0,0.14*sp.gain,0.05);
n.connect(bp2); bp2.connect(g2); g2.connect(comp); n.start(t0); n.stop(t0+0.09);
scheduleNodeRelease([o,g,n,bp2,g2], 0.32);
}
// 受伤闷哼 (11-15 重制批口径保留): 锯齿滑音 + 同滑正弦衬底, 过低通滤出"闷哼"的嗓音感
function hurt(){
if(!inited) return;
const t0=ctx.currentTime;
const o=ctx.createOscillator(); o.type='sawtooth';
o.frequency.setValueAtTime(220,t0); o.frequency.exponentialRampToValueAtTime(90,t0+0.15);
const o2=ctx.createOscillator(); o2.type='sine';
o2.frequency.setValueAtTime(150,t0); o2.frequency.exponentialRampToValueAtTime(65,t0+0.13);
const f=ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=620;
const g=ctx.createGain(); env(g,t0,0.22,0.15);
const g2=ctx.createGain(); env(g2,t0,0.13,0.13);
o.connect(f); o2.connect(f); f.connect(g); g.connect(comp); g2.connect(comp);
o.start(t0); o.stop(t0+0.18); o2.start(t0); o2.stop(t0+0.16);
scheduleNodeRelease([o,o2,f,g,g2], 0.25);
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
// 迫击炮闷响 (11-15 重制批口径保留): 管压"咚" + 出膛气浪拖尾
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
const n3=noiseSrc(); const lp3=ctx.createBiquadFilter(); lp3.type='lowpass';
lp3.frequency.setValueAtTime(700,t0); lp3.frequency.exponentialRampToValueAtTime(200,t0+0.3);
const g3=ctx.createGain(); env(g3,t0+0.02,0.32*sp.gain,0.32);
n3.connect(lp3); lp3.connect(g3); g3.connect(comp); n3.start(t0+0.02); n3.stop(t0+0.4);
scheduleNodeRelease([o,g,n,lp,g2,n3,lp3,g3], 0.5);
}
function nadeBounce(dist){
if(!inited) return;
const sp=spatial(dist,60); if(sp.gain<0.05) return;
click(600,0.3*sp.gain,0.04);
}
// ── 炮声合成器 (2026-11-15c 推倒重写): profile 档案驱动 + 真声像 ──
// 第一参收 profile 串 (tkJp/tkMed/tkHeavy/atgun/battery/naval_*/rocket_*); 收到数字 = 旧调用口径回落 generic。
// 与 explosion 的区分: 更短更冲, 有金属感的膛压冲击; 火箭档带发动机尾焰嘶声。
function cannon(prof, dist=0, pan=0){
if(!inited) return; resume();
if(typeof prof==='number'){ dist=prof; prof='generic'; }
const P=CANNON_PROFILES[prof]||CANNON_PROFILES.generic;
const t0=ctx.currentTime;
const sp=spatial(dist,500); if(sp.gain<0.02) return;
const rel=[];
const panN = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
const out = ctx.createGain(); out.gain.value=1;
const lpO = ctx.createBiquadFilter(); lpO.type='lowpass'; lpO.frequency.value=sp.lp;
out.connect(lpO);
if(panN){ panN.pan.value=clamp(pan,-1,1); lpO.connect(panN); panN.connect(comp); } else lpO.connect(comp);
rel.push(out,lpO); if(panN) rel.push(panN);
// ① 炮口锤: thumpF→thumpE 滑音
const o=ctx.createOscillator(); o.type='sine';
o.frequency.setValueAtTime(P.thumpF,t0); o.frequency.exponentialRampToValueAtTime(P.thumpE,t0+P.thumpD);
const og=ctx.createGain(); env(og,t0,P.boomV*sp.gain,P.thumpD);
o.connect(og); og.connect(out); o.start(t0); o.stop(t0+P.thumpD+0.1); rel.push(o,og);
// ② 主体气浪: 低通 lp0→160 下扫 sweepD
const n=noiseSrc(); const lp=ctx.createBiquadFilter(); lp.type='lowpass';
lp.frequency.setValueAtTime(Math.min(sp.lp,P.lp0),t0); lp.frequency.exponentialRampToValueAtTime(160,t0+P.sweepD);
const ng=ctx.createGain(); env(ng,t0,P.blastV*sp.gain,P.sweepD);
n.connect(lp); lp.connect(ng); ng.connect(out); n.start(t0); n.stop(t0+P.sweepD+0.1); rel.push(n,lp,ng);
// ③ 膛压中频"砰": 带通 blastF 0.18s —— 炮弹出膛的骨架声
const nb=noiseSrc(); const bp2=ctx.createBiquadFilter(); bp2.type='bandpass'; bp2.frequency.value=P.blastF; bp2.Q.value=0.8;
const g2=ctx.createGain(); env(g2,t0,P.blastV*0.9*sp.gain,0.18);
nb.connect(bp2); bp2.connect(g2); g2.connect(out); nb.start(t0); nb.stop(t0+0.24); rel.push(nb,bp2,g2);
// ④ 炮口回响拍: echoDelay 后一记低通噪声 (开阔地炮声的"回一下")
const nr=noiseSrc(); const lr=ctx.createBiquadFilter(); lr.type='lowpass'; lr.frequency.value=800;
const gr=ctx.createGain();
gr.gain.setValueAtTime(0.0001,t0+P.echoDelay);
gr.gain.linearRampToValueAtTime(P.echoV*sp.gain,t0+P.echoDelay+0.04);
gr.gain.exponentialRampToValueAtTime(0.0001,t0+P.echoDelay+P.echoD);
nr.connect(lr); lr.connect(gr); gr.connect(out); nr.start(t0+P.echoDelay); nr.stop(t0+P.echoDelay+P.echoD+0.1); rel.push(nr,lr,gr);
// ⑤ 火箭发动机尾焰嘶声 (rocket_* 档): 高通拖尾
if(P.hiss>0){
const nh=noiseSrc(); const hp2=ctx.createBiquadFilter(); hp2.type='highpass'; hp2.frequency.value=1800;
const gh2=ctx.createGain();
gh2.gain.setValueAtTime(0.0001,t0);
gh2.gain.linearRampToValueAtTime(P.hiss*sp.gain,t0+0.03);
gh2.gain.exponentialRampToValueAtTime(0.0001,t0+0.42);
nh.connect(hp2); hp2.connect(gh2); gh2.connect(out); nh.start(t0); nh.stop(t0+0.5); rel.push(nh,hp2,gh2);
}
scheduleNodeRelease(rel, P.sweepD+0.5);
}
// 高炮"咚" (11-15 重制批口径保留): 低通爆响 + 中频"砰"一记
function flakPop(dist=0){
if(!inited) return;
const t0=ctx.currentTime;
const sp=spatial(dist,300); if(sp.gain<0.02) return;
const n=noiseSrc(); const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=Math.min(sp.lp,1500);
const g=ctx.createGain(); env(g,t0,0.55*sp.gain,0.35);
n.connect(lp); lp.connect(g); g.connect(comp); n.start(t0); n.stop(t0+0.4);
const n2=noiseSrc(); const bp2=ctx.createBiquadFilter(); bp2.type='bandpass'; bp2.frequency.value=380; bp2.Q.value=0.9;
const g2=ctx.createGain(); env(g2,t0,0.4*sp.gain,0.12);
n2.connect(bp2); bp2.connect(g2); g2.connect(comp); n2.start(t0); n2.stop(t0+0.18);
scheduleNodeRelease([n,lp,g,n2,bp2,g2], 0.55);
}
const engines=new Set(); // 持续声源(坦克/飞机/卡车/舰艇引擎): 暂停/结算时统一静音
// ── 引擎合成器 (2026-11-15c 推倒重写): ENGINE_KINDS 档案驱动 ──
// kind 档决定音色 (振荡器型/失谐/低通/纹理噪声带/转速倍率 pitch); 频响与增益仍归各载具 update。
// ★契约: osc/osc2/g/lp 四节点名与语义原样保留 (海战音色塑形段 navalAudEngine 只写 osc.type/osc2.detune/
//   lp.frequency); osc3/ns/nbp/ng2 三层化节点并联进同一低通与增益, 静音/冻结账不变。
function createEngine(kind){
let K=ENGINE_KINDS[kind];
if(!K) K=ENGINE_KINDS[ENGINE_ALIASES[kind]]||ENGINE_KINDS.tankSmall;
const pm=K.pitch||1;
const e={ nodes:null, kind, lastVol:0, kindK:K };
e.update=(freq,vol)=>{
if(!inited){ return; }
// 静默期 / 时停冻结期: 只记音量不出声 (结算/主菜单/时停里载具不更新, 这里兜底"万一还被调用")
if(silenced||audioTimeFrozen()){
e.lastVol=clamp(vol,0,0.4);
if(e.nodes){ try{ e.nodes.g.gain.setTargetAtTime(0,ctx.currentTime,0.05); }catch(err){} }
e._lastVolW=undefined;   // gain was forced to 0 here: clear the gate or post-freeze update with ~same vol would skip the restore write (2026-11-13 perf batch)
return;
}
if(!e.nodes){
const osc=ctx.createOscillator();
osc.type=K.wave;
const osc2=ctx.createOscillator();
osc2.type='sawtooth'; osc2.detune.value=K.det;
// 三层化 (11-15 重制批口径保留): 次八度正弦 (osc3) + 纹理噪声 (ns→nbp→ng2)
const osc3=ctx.createOscillator(); osc3.type='sine';
const ns=noiseSrc();
const nbp=ctx.createBiquadFilter(); nbp.type='bandpass'; nbp.frequency.value=K.nzF; nbp.Q.value=0.6;
const ng2=ctx.createGain(); ng2.gain.value=0;
const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=K.lp;
const g=ctx.createGain(); g.gain.value=0;
osc.connect(lp); osc2.connect(lp); osc3.connect(lp); lp.connect(g);
ns.connect(nbp); nbp.connect(ng2); ng2.connect(g);
g.connect(comp);
osc.start(); osc2.start(); osc3.start(); ns.start();
e.nodes={osc,osc2,g,lp,osc3,ns,nbp,ng2};
engines.add(e);
}
e.lastVol=clamp(vol,0,0.4);
// 2026-11-13 perf batch: change gate - skip setTargetAtTime when freq/vol moved < threshold since last
// actual write (0.8Hz / 0.004 steps are inaudible under the 0.12s smoothing). ★2026-11-15c: 频率写入
// 按档案 pitch 倍率缩放 (同一调用口径下日系高转嘶吼/重坦低沉), 变更门仍按原始 freq 计。
const t0=ctx.currentTime;
if(e._lastFreq===undefined||Math.abs(freq-e._lastFreq)>=0.8){
e.nodes.osc.frequency.setTargetAtTime(freq*pm,t0,0.12);
e.nodes.osc2.frequency.setTargetAtTime(freq*0.5*pm,t0,0.12);
if(e.nodes.osc3) e.nodes.osc3.frequency.setTargetAtTime(freq*0.25*pm,t0,0.12);
e._lastFreq=freq;
}
if(e._lastVolW===undefined||Math.abs(e.lastVol-e._lastVolW)>=0.004){
e.nodes.g.gain.setTargetAtTime(e.lastVol,t0,0.12);
// 纹理噪声电平随音量走 (档案 nz 混合率)
if(e.nodes.ng2) e.nodes.ng2.gain.setTargetAtTime(e.lastVol*K.nz,t0,0.12);
e._lastVolW=e.lastVol;
}
};
// 停: 增益归零 + 振荡器真停 + 节点置空 (2026-09-17: 旧版只把增益压到 0 且保留 nodes,
// 于是"停过的引擎"再 update 只会去改已停振荡器的频率 = 之后永远发不出声; 置空让下次 update 重建)
e.stop=()=>{
if(e.nodes){
try{
const t1=ctx.currentTime;
e.nodes.g.gain.setTargetAtTime(0,t1,0.1);
e.nodes.osc.stop(t1+0.2); e.nodes.osc2.stop(t1+0.2);
if(e.nodes.osc3) e.nodes.osc3.stop(t1+0.2);
if(e.nodes.ns) e.nodes.ns.stop(t1+0.2);
}catch(err){}
e.nodes=null;
e._lastFreq=undefined; e._lastVolW=undefined;   // rebuilt nodes start silent: next update must write (2026-11-13 perf batch)
}
engines.delete(e);
};
return e;
}
// 背景环境层(风噪/雨声)增益表: 暂停/对局结束静音, 恢复还原
const ambMutes=[];
function setAmbientMute(m){
if(!ctx) return;
// 静默期 (结算/主菜单) / 时停冻结期 优先: 此时 setAmbientMute(false) 不许把环境/引擎放开
const mute=m||silenced||audioTimeFrozen();
for(const a of ambMutes) a.g.gain.setTargetAtTime(mute?0:a.base,ctx.currentTime,0.12);
for(const e of engines) if(e.nodes){ try{ e.nodes.g.gain.setTargetAtTime(mute?0:e.lastVol,ctx.currentTime,0.12); }catch(err){} }
}
let _wxGainNode=null;
function updateWeatherAmbient(){
if(!ctx) return;
const targetLevel=(audioTimeFrozen())?0:((typeof WX_CFG!=='undefined'&&WX_CFG.audioLevel)?WX_CFG.audioLevel:0);
if(_wxGainNode){
_wxGainNode.gain.setTargetAtTime(targetLevel,ctx.currentTime,0.2);
// 冻结期别把 base 记成 0 (解冻时 setAmbientMute/restoreAll 要按真基准还原雨声/风声)
if(!audioTimeFrozen()){
const mIdx=ambMutes.findIndex(a=>a.g===_wxGainNode);
if(mIdx>=0) ambMutes[mIdx].base=targetLevel;
}
}
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
_wxGainNode=wg;
ambMutes.push({g:wg,base:wg.gain.value});
}else{
const rl=ctx.createBiquadFilter(); rl.type='bandpass'; rl.frequency.value=1500; rl.Q.value=0.35;
const rg=ctx.createGain(); rg.gain.value=WX_CFG.audioLevel;
rn.connect(rl); rl.connect(rg); rg.connect(comp); rn.start();
_wxGainNode=rg;
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
if(silenced||audioTimeFrozen()||gamePaused||matchOver) return;
if(!ctx) return;
const t0=ctx.currentTime;
const nCnt=randi(5,14), gap=rand(0.07,0.11);
const vol=rand(0.018,0.045);
const f=rand(400,700);
const panV=rand(-0.8,0.8);
const panN=ctx.createStereoPanner?ctx.createStereoPanner():null;
const bus=ctx.createGain(); bus.gain.value=1;
const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=rand(650,1150);
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
// 入水/水花 (2026-09-18 塔拉瓦批; 2026-11-15 音效重制批升级): 物体入水/涉水冲击 ——
//   三层: 入水裂响 (带通下扫) + 水体"咕咚" (低频滑音) + 高速水膜嘶声 / 大物回浪 (条件层)。
//   ★第 3/4 参 (size=入水物尺寸档 0.5~4, spd=入水速度 m/s)。旧调用 splash(dist,big) 全兼容。
//   ★2026-11-15c: 四参签名契约原样保留 (verify-waterentry T1 跟走)。
function splash(dist=0, big=false, size=1, spd=0){
if(!inited) return;
const sp=spatial(dist,120); if(sp.gain<0.03) return;
const t0=ctx.currentTime;
const sz=clamp(size,0.5,4), spC=clamp(spd,0,25);
const rel=[];
// ① 入水裂响: 带通下扫 —— 频点按尺寸降 (大物排水声沉), 按速度抬 (高速入水更"炸")
const f0=(big?2300:2900)/Math.sqrt(sz)*(1+spC*0.012);
const dur1=(big?0.3:0.16)+sz*0.06;
const n=noiseSrc(); const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.Q.value=1.1;
bp.frequency.setValueAtTime(f0,t0);
bp.frequency.exponentialRampToValueAtTime(f0*0.27,t0+dur1);
const g=ctx.createGain();
g.gain.setValueAtTime(0.0001,t0);
g.gain.linearRampToValueAtTime((big?0.5:0.26)*sp.gain*clamp(0.75+sz*0.18,0.75,1.5)*(1+spC*0.02),t0+0.012);
g.gain.exponentialRampToValueAtTime(0.0001,t0+dur1+(big?0.12:0.06));
n.connect(bp); bp.connect(g); g.connect(comp); n.start(t0); n.stop(t0+dur1+0.2); rel.push(n,bp,g);
// ② 水体"咕咚": 低频滑音 —— 频点/时长随尺寸 (坦克入水是"咚————", 士兵是"咚")
const o=ctx.createOscillator(); o.type='sine';
o.frequency.setValueAtTime((big?260:340)/Math.sqrt(sz),t0);
o.frequency.exponentialRampToValueAtTime(big?90:130,t0+0.16+sz*0.05);
const og=ctx.createGain(); env(og,t0,(big?0.3:0.16)*sp.gain*clamp(0.8+sz*0.15,0.8,1.4),0.2+sz*0.05);
o.connect(og); og.connect(comp); o.start(t0); o.stop(t0+0.3+sz*0.1); rel.push(o,og);
// ③ 高速水膜嘶声: spd>6 才出 (俯冲入水"咻——啪"里的那道"咻")
if(spC>6){
const nh=noiseSrc(); const hp2=ctx.createBiquadFilter(); hp2.type='highpass'; hp2.frequency.value=4500;
const gh2=ctx.createGain();
gh2.gain.setValueAtTime(0.0001,t0);
gh2.gain.linearRampToValueAtTime(clamp(spC*0.016,0.08,0.4)*sp.gain,t0+0.02);
gh2.gain.exponentialRampToValueAtTime(0.0001,t0+0.14);
nh.connect(hp2); hp2.connect(gh2); gh2.connect(comp); nh.start(t0); nh.stop(t0+0.2); rel.push(nh,hp2,gh2);
}
// ④ 大物回浪: big 时 +0.18s 一记低通拍岸 (载具/炮弹级入水的"回涌"尾)
if(big){
const nr=noiseSrc(); const lr=ctx.createBiquadFilter(); lr.type='lowpass'; lr.frequency.value=520;
const gr=ctx.createGain();
gr.gain.setValueAtTime(0.0001,t0+0.18);
gr.gain.linearRampToValueAtTime(0.28*sp.gain*clamp(sz*0.35,0.4,1.2),t0+0.24);
gr.gain.exponentialRampToValueAtTime(0.0001,t0+0.55);
nr.connect(lr); lr.connect(gr); gr.connect(comp); nr.start(t0+0.18); nr.stop(t0+0.6); rel.push(nr,lr,gr);
}
scheduleNodeRelease(rel, 0.7);
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
if(silenced||audioTimeFrozen()||!ctx||THEME.birds===false||NIGHT_MODE||gamePaused||matchOver) return;
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
// 丧尸低吼 (2026-10-06 丧尸模式): 一次性低频锯齿滑音 + 低通, 距离衰减 —— 无循环源 ⇒ endMatch stopAll 链零负担
function zgroan(dist){
if(!inited) return;
const t0=ctx.currentTime;
const o=ctx.createOscillator(); o.type='sawtooth';
const base=rand(70,110);
o.frequency.setValueAtTime(base,t0);
o.frequency.linearRampToValueAtTime(base*rand(0.7,0.9),t0+0.5);
o.frequency.linearRampToValueAtTime(base*rand(0.55,0.75),t0+1.0);
const g=ctx.createGain();
const vol=0.14*Math.pow(Math.max(0,1-dist/48),2);
g.gain.setValueAtTime(0,t0);
g.gain.linearRampToValueAtTime(vol,t0+0.12);
g.gain.linearRampToValueAtTime(0.0001,t0+1.1);
const f=ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=420;
o.connect(f); f.connect(g); g.connect(comp);
o.start(t0); o.stop(t0+1.15);
}
const api = { init, gunshot, explosion, click, metalSlide, ping, footstep, whizz, ricochet, hurt, zgroan, hitmarkSnd, nadeBounce, cannon, flakPop, createEngine, setVol, resume, mortarThunk, setAmbientMute, stopAll, restoreAll, isSilenced, audioDebug, splash, setUnderwater, setTimeFrozenMute, audioTimeFrozen, panOf };
// ═════════════════════════════════════════════════════════════════════════════
// 【追加段】海战音效 (2026-09-20N 海战批, owner: naval-crew) —— 2026-11-15c 推倒重写批原文保留:
//   navalAudioTick/navalAud* 原语与塑形契约 (osc/osc2/lp 三写点) 一字未动, 唯一改动 = 重生建档
//   kind 随 15d 构造口径 ('tank' → amph/boat, 见 ⑥ 内注)。
// 一、现状盘点 (为什么只做这四件 —— 派活前我逐行核过 15d/15f, 不重复发声):
//   15d-naval 已接完的: fireMain→cannon / fireSecondary·fireMG→gunshot / fireTorpedo→
//     metalSlide(180→60)+waterSplash(08-effects 已含 AudioSys.splash 入水扑通) / beginDestroy→explosion /
//     艇发动机→engines 表的 createEngine + _syncModel 里按 vel 与距离现算 freq·gain;
//   15f-battery 已接完的: 对海开火→cannon、炮位被毁→explosion。
// 二、本段四件 (只读 15d 的公开字段与 craft.engine 对象, 一行都不改 15d/15f):
//   ① 艇/两栖车的发动机"水声质感"; ② 鱼雷发射压缩空气嘶声+水锤; ③ 进水/沉没/残骸; ④ 搁浅龙骨擦礁。
// 三、硬约束落地: 只追加不新增常驻节点; 瞬态全接 comp 主链; 入口在闸门之前注册; 暂停/结算/菜单三态兜底。
// 四、性能: 距离剔除 110m; 瞬态 1~3 次/秒、每次 2~4 个短节点 (全部自带 stop)。
const NAVAL_AUD_CULL=110;    // 距离剔除半径 (与 15d engine 的衰减同档)
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
// ── 一次性瞬态原语 (全部自带 stop, 全部接 comp 主链; 与 gunshot/metalSlide 同构造手法) ──
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
//   stop 过之后会**重建**节点 (静音但常驻) ⇒ 每台残骸白占 4 个音频节点直到重生 (实测 55~70s 冷却全程)。
//   这里在残骸态把已经停过的引擎句柄摘掉: 15d 的全部 engine 调用点都有 `if(this.engine)` 守卫, 摘掉是安全的,
//   于是不再有静音残留、也不再有逐帧重建; 重生后 (alive) 补一个新的 ⇒ 与 15d 的"重生由载具 update 自己
//   重建引擎"同一语义。★2026-11-15c: kind 与 15d 构造口径一致 (amph/boat 按 craft.kind), 不再回 'tank'。
// 泄漏口径: 这是**回收**而非新增 —— 本段自身不新建任何常驻节点 (只塑形既有 osc/osc2/lp)。
if(!c.alive&&c.state==='wreck'){
if(c.engine){ try{ c.engine.stop(); }catch(e){} c.engine=null; }
}else if(c.alive&&!c.engine){
c.engine=createEngine(c.kind==='boat'?'boat':'amph');
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
api.updateWeatherAmbient=updateWeatherAmbient;
// 统一发声门控 (2026-09-17 音效停止批): 静默期 (结算页/主菜单) 里任何来源的调用一律不发声 ——
// 包括 setTimeout/setInterval 里排队的那些 (雷暴远雷就是真实来源: 它在结算之后才响, 旧版没有闸门,
// 于是"结算页上还在打雷")。createEngine 不过闸 (它返回引擎对象, 静默由引擎自身的 update 处理);
// init/resume/setVol/setAmbientMute/stopAll/restoreAll/isSilenced/audioDebug 是控制面, 也不能被闸掉。
{
const bypass=new Set(['init','resume','setVol','setAmbientMute','stopAll','restoreAll','isSilenced','audioDebug','createEngine','setUnderwater','updateWeatherAmbient','setTimeFrozenMute','audioTimeFrozen']);
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
