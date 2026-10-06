// ─────────────────────────────────────────────
// 09a-defs.js —— 武器/兵种定义数据表 (WPN_DEFS / CLASSES / CLS_POOL)
// 2026-08-24 由 09-weapons.js 切分: 原第 6-65 行 (行为代码仍在 09-weapons.js)
// ── 阶段三 P1 平衡首轮 (2026-09-28, 缺陷登记 P1): 生态位数值进武器表, 玩家/Bot 共用 (fireBullet 单源) ──
//   fallS/fallE/fallF = 伤害随距离衰减曲线: fallS 米起线性衰减, fallE 米到地板 fallF (缺省 = 旧全局 40/220/0.45);
//   wSpd = 持枪移速系数 (20-player 步行 / 14-bots 移动同乘, 手枪 1.0 最快, 重武器最慢 0.9, 用户本批裁定);
//   headMul = 爆头倍率分档 (2026-09-28k 用户裁定"狙击>步枪>冲锋枪"): 镜狙击 2.5 > 步枪(栓动/半自动) 2.4 >
//   骑枪 2.1~2.2 > 自动步枪/轻机枪/卡宾 1.9 > 手枪 1.7 > 冲锋枪 1.6; 反坦克枪 1.5~1.6 反器材特例
//   (身体 90~95 已是一枪级), 火箭筒/迫击炮/巡飞弹 1 (对载具武器, 爆头倍率无意义)。
//   spreadHip/spreadAds = 腰射/瞄准散布 (度; 20-player 按 VM.adsBlend lerp, Bot 用自身瞄准模型不吃此表):
//   腰射单调口径 (2026-09-28k 梳理) = 手枪 2.5~2.7 < 卡宾 2.8 < 半自动 3.0 ≤ 冲锋枪/自动步枪 3.0~3.8 <
//   栓动 4.2~5.0 ≈ 骑枪 4.4~5.0 < 反坦克枪 6 (镜枪比同型机瞄 +0.5 = 镜具累赘; 骑枪短管应比全尺寸栓顺手);
//   瞄准加成倍数 (hip/ads) 分档 = 镜狙击 250 > 反坦克枪 60~100 > 栓动 35~60 > 半自动 21 > 骑枪 17~20 >
//   自动步枪/轻机枪 6.8~7.6 > 卡宾/手枪 5~6 > 冲锋枪 3.8~4 (冲锋枪=腰射武器, 瞄准收益最小是刻意设计);
//   另有瞄准后坐折扣分档 (scoped 0.7 / 非镜栓动 0.78 / 其余 0.85) 与呼吸 0.4 / 依托 0.35 (20-player)。
//   栓动步枪 reload 小幅加快 (3.1~3.7 → 2.6~2.9): 半自动(美军)与栓动的阵营差由"火力密度 vs 单发杀伤"生态位承担;
//   bar/dp28/type96/zb26/type11/m1903 为兵种合并后的非现役武器 (兵种表已不含, 定义保留供模型/审计工具)。
'use strict';
// vmLegacy:true = 第一人称换弹走旧版快速换匣 (2026-10-05 用户二次裁定: 手枪/冲锋枪换弹动作完全回调,
// 撤销当日重做的"携匣大回环"; 机枪/反坦克枪/栓动/漏夹不受此标记影响)。
const WPN_DEFS = {
garand:   { name:'M1 加兰德', mode:'半自动', type:'semi', snd:'rifle', dmg:36, headMul:2.4, rpm:300, mag:8, reserve:160, reload:2.4, spreadHip:3.0, spreadAds:0.14, recoil:1.35, recSide:0.35, adsFov:52, kick:0.075, enbloc:true, tracer:3, fallS:45, fallE:220, fallF:0.6, wSpd:0.95 },
thompson: { name:'汤普森 M1A1', mode:'全自动', type:'auto', snd:'smg', dmg:21, headMul:1.6, rpm:680, mag:30, reserve:300, reload:2.5, spreadHip:3.4, spreadAds:0.85, recoil:0.55, recSide:0.4, adsFov:56, kick:0.045, vmLegacy:true, tracer:4, fallS:22, fallE:110, fallF:0.3, wSpd:0.97 },
bar:      { name:'勃朗宁 BAR', mode:'全自动', type:'auto', snd:'mg', dmg:31, headMul:1.9, rpm:480, mag:20, reserve:200, reload:3.0, spreadHip:3.8, spreadAds:0.55, recoil:0.95, recSide:0.55, adsFov:54, kick:0.06, tracer:3, wSpd:0.94 },
springfield:{ name:'春田 M1903A4', mode:'栓动 · 4x', type:'bolt', snd:'sniper', dmg:96, headMul:2.5, rpm:50, mag:5, reserve:80, reload:2.8, spreadHip:5, spreadAds:0.02, recoil:2.6, recSide:0.5, adsFov:20, kick:0.12, scoped:true, boltT:1.05, tracer:1, fallS:90, fallE:300, fallF:0.85, wSpd:0.93 },
m1911:    { name:'柯尔特 M1911', mode:'半自动', type:'semi', snd:'pistol', dmg:26, headMul:1.7, rpm:420, mag:7, reserve:70, reload:1.9, spreadHip:2.6, spreadAds:0.5, recoil:0.8, recSide:0.4, adsFov:60, kick:0.05, pistol:true, vmLegacy:true, tracer:2, fallS:15, fallE:90, fallF:0.35, wSpd:1 },
kar98:    { name:'毛瑟 Kar98k', mode:'栓动', type:'bolt', snd:'sniper', dmg:78, headMul:2.4, rpm:52, mag:5, reserve:100, reload:2.7, spreadHip:4.5, spreadAds:0.08, recoil:2.4, recSide:0.45, adsFov:48, kick:0.11, boltT:1.0, tracer:1, fallS:70, fallE:260, fallF:0.8, wSpd:0.95 },
kar98zf:  { name:'Kar98k ZF41', mode:'栓动 · 4x', type:'bolt', snd:'sniper', dmg:96, headMul:2.5, rpm:50, mag:5, reserve:80, reload:2.8, spreadHip:5, spreadAds:0.02, recoil:2.6, recSide:0.5, adsFov:20, kick:0.12, scoped:true, boltT:1.05, tracer:1, fallS:90, fallE:300, fallF:0.85, wSpd:0.93 },
mp40:     { name:'MP40', mode:'全自动', type:'auto', snd:'smg', dmg:20, headMul:1.6, rpm:560, mag:32, reserve:320, reload:2.6, spreadHip:3.0, spreadAds:0.75, recoil:0.45, recSide:0.35, adsFov:56, kick:0.04, vmLegacy:true, tracer:4, fallS:22, fallE:110, fallF:0.3, wSpd:0.97 },
stg44:    { name:'STG 44', mode:'全自动', type:'auto', snd:'rifle', dmg:24, headMul:1.9, rpm:500, mag:30, reserve:240, reload:2.8, spreadHip:3.4, spreadAds:0.5, recoil:0.7, recSide:0.45, adsFov:54, kick:0.05, vmLegacy:true, tracer:3, fallS:38, fallE:180, fallF:0.5, wSpd:0.94 },
p38:      { name:'瓦尔特 P38', mode:'半自动', type:'semi', snd:'pistol', dmg:24, headMul:1.7, rpm:430, mag:8, reserve:80, reload:1.9, spreadHip:2.6, spreadAds:0.5, recoil:0.75, recSide:0.4, adsFov:60, kick:0.05, pistol:true, vmLegacy:true, tracer:2, fallS:15, fallE:90, fallF:0.35, wSpd:1 },
m1903:    { name:'春田 M1903', mode:'栓动', type:'bolt', snd:'sniper', dmg:78, headMul:2.4, rpm:54, mag:5, reserve:100, reload:2.7, spreadHip:4.5, spreadAds:0.1, recoil:2.3, recSide:0.45, adsFov:50, kick:0.1, boltT:0.95, tracer:1, fallS:70, fallE:260, fallF:0.8, wSpd:0.95 },
bazooka:  { name:'巴祖卡 M9', mode:'单发', type:'atlauncher', snd:'cannon', dmg:24, headMul:1, rpm:10, mag:1, reserve:16, reload:3.6, spreadHip:4.8, spreadAds:1.0, recoil:5.0, recSide:1.5, adsFov:52, kick:0.18, rocket:true, atDmg:360, tracer:1, wSpd:0.9 },
schreck:  { name:'坦克杀手 RPzB54', mode:'单发', type:'atlauncher', snd:'cannon', dmg:24, headMul:1, rpm:10, mag:1, reserve:16, reload:3.8, spreadHip:4.5, spreadAds:0.9, recoil:5.2, recSide:1.6, adsFov:50, kick:0.19, rocket:true, atDmg:380, tracer:1, wSpd:0.9 },
// ---- 苏军 ----
mosin:    { name:'莫辛-纳甘 M91/30', mode:'栓动', type:'bolt', snd:'sniper', dmg:78, headMul:2.4, rpm:50, mag:5, reserve:100, reload:2.7, spreadHip:4.5, spreadAds:0.08, recoil:2.5, recSide:0.45, adsFov:48, kick:0.11, boltT:1.05, tracer:1, fallS:70, fallE:260, fallF:0.8, wSpd:0.95 },
mosinpu:  { name:'莫辛-纳甘 PU', mode:'栓动 · 3.5x', type:'bolt', snd:'sniper', dmg:96, headMul:2.5, rpm:48, mag:5, reserve:80, reload:2.8, spreadHip:5, spreadAds:0.02, recoil:2.6, recSide:0.5, adsFov:21, kick:0.12, scoped:true, boltT:1.1, tracer:1, fallS:90, fallE:300, fallF:0.85, wSpd:0.93 },
ppsh:     { name:'波波沙 PPSh-41', mode:'全自动', type:'auto', snd:'smg', dmg:19, headMul:1.6, rpm:900, mag:71, reserve:426, reload:3.4, spreadHip:3.6, spreadAds:0.95, recoil:0.5, recSide:0.42, adsFov:56, kick:0.04, wg:'drum', vmLegacy:true, tracer:5, fallS:22, fallE:110, fallF:0.3, wSpd:0.97 },
dp28:     { name:'捷格加廖夫 DP-28', mode:'全自动', type:'auto', snd:'mg', dmg:30, headMul:1.9, rpm:520, mag:47, reserve:282, reload:4.2, spreadHip:4.0, spreadAds:0.55, recoil:0.9, recSide:0.5, adsFov:54, kick:0.06, wg:'pan', tracer:3, wSpd:0.94 },
tt33:     { name:'托卡列夫 TT-33', mode:'半自动', type:'semi', snd:'pistol', dmg:25, headMul:1.7, rpm:430, mag:8, reserve:80, reload:1.8, spreadHip:2.6, spreadAds:0.5, recoil:0.78, recSide:0.4, adsFov:60, kick:0.05, pistol:true, vmLegacy:true, tracer:2, fallS:15, fallE:90, fallF:0.35, wSpd:1 },
ptrd:     { name:'PTRD-41 反坦克枪', mode:'栓动 · 14.5mm', type:'bolt', snd:'sniper', dmg:95, headMul:1.6, rpm:22, mag:1, reserve:36, reload:2.8, spreadHip:6, spreadAds:0.06, recoil:4.2, recSide:0.8, adsFov:44, kick:0.22, boltT:1.5, atRifle:true, vehDmg:135, wg:'atr', tracer:1, fallS:80, fallE:280, fallF:0.8, wSpd:0.9 },
// ---- 日军 ----
arisaka:  { name:'三八式步枪', mode:'栓动', type:'bolt', snd:'sniper', dmg:78, headMul:2.4, rpm:54, mag:5, reserve:100, reload:2.6, spreadHip:4.2, spreadAds:0.07, recoil:2.2, recSide:0.4, adsFov:48, kick:0.1, boltT:0.95, tracer:1, fallS:70, fallE:260, fallF:0.8, wSpd:0.95 },
type97s:  { name:'九七式狙击枪', mode:'栓动 · 4x', type:'bolt', snd:'sniper', dmg:92, headMul:2.5, rpm:50, mag:5, reserve:80, reload:2.8, spreadHip:5, spreadAds:0.02, recoil:2.4, recSide:0.5, adsFov:20, kick:0.11, scoped:true, boltT:1.05, tracer:1, fallS:90, fallE:300, fallF:0.85, wSpd:0.93 },
type100:  { name:'一〇〇式冲锋枪', mode:'全自动', type:'auto', snd:'smg', dmg:19, headMul:1.6, rpm:520, mag:30, reserve:300, reload:2.6, spreadHip:3.1, spreadAds:0.8, recoil:0.42, recSide:0.35, adsFov:56, kick:0.04, tracer:4, fallS:22, fallE:110, fallF:0.3, wSpd:0.97 },
type96:   { name:'九六式轻机枪', mode:'全自动', type:'auto', snd:'mg', dmg:28, headMul:1.9, rpm:540, mag:30, reserve:300, reload:3.2, spreadHip:3.8, spreadAds:0.5, recoil:0.85, recSide:0.5, adsFov:54, kick:0.055, wg:'topmag', tracer:3, wSpd:0.94 },
nambu:    { name:'南部十四年式', mode:'半自动', type:'semi', snd:'pistol', dmg:22, headMul:1.7, rpm:420, mag:8, reserve:80, reload:1.9, spreadHip:2.5, spreadAds:0.5, recoil:0.7, recSide:0.35, adsFov:60, kick:0.045, pistol:true, vmLegacy:true, tracer:2, fallS:15, fallE:90, fallF:0.35, wSpd:1 },
type97at: { name:'九七式自动炮', mode:'半自动 · 20mm', type:'semi', snd:'sniper', dmg:90, headMul:1.5, rpm:60, mag:7, reserve:56, reload:4.2, spreadHip:6, spreadAds:0.1, recoil:3.8, recSide:0.8, adsFov:46, kick:0.2, atRifle:true, vehDmg:110, wg:'atr', tracer:1, fallS:80, fallE:280, fallF:0.8, wSpd:0.9 },
// ---- 国军 ----
zhongzheng:{ name:'中正式步骑枪', mode:'栓动', type:'bolt', snd:'sniper', dmg:78, headMul:2.4, rpm:52, mag:5, reserve:100, reload:2.7, spreadHip:4.5, spreadAds:0.08, recoil:2.4, recSide:0.45, adsFov:48, kick:0.11, boltT:1.0, tracer:1, fallS:70, fallE:260, fallF:0.8, wSpd:0.95 },
zhongzhengs:{ name:'中正式(狙击)', mode:'栓动 · 4x', type:'bolt', snd:'sniper', dmg:94, headMul:2.5, rpm:50, mag:5, reserve:80, reload:2.8, spreadHip:5, spreadAds:0.02, recoil:2.5, recSide:0.5, adsFov:20, kick:0.12, scoped:true, boltT:1.05, tracer:1, fallS:90, fallE:300, fallF:0.85, wSpd:0.93 },
mp18:     { name:'花机关 MP18', mode:'全自动', type:'auto', snd:'smg', dmg:20, headMul:1.6, rpm:500, mag:32, reserve:320, reload:2.9, spreadHip:3.2, spreadAds:0.85, recoil:0.48, recSide:0.4, adsFov:56, kick:0.04, wg:'sidemag', vmLegacy:true, tracer:4, fallS:22, fallE:110, fallF:0.3, wSpd:0.97 },
zb26:     { name:'捷克式 ZB-26', mode:'全自动', type:'auto', snd:'mg', dmg:31, headMul:1.9, rpm:500, mag:20, reserve:240, reload:3.1, spreadHip:3.8, spreadAds:0.5, recoil:0.92, recSide:0.5, adsFov:54, kick:0.06, wg:'topmag', tracer:3, wSpd:0.94 },
c96:      { name:'驳壳枪 C96', mode:'半自动', type:'semi', snd:'pistol', dmg:24, headMul:1.7, rpm:440, mag:10, reserve:100, reload:2.2, spreadHip:2.7, spreadAds:0.5, recoil:0.7, recSide:0.42, adsFov:58, kick:0.05, pistol:true, vmLegacy:true, tracer:2, fallS:15, fallE:90, fallF:0.35, wSpd:1 },
boys:     { name:'博伊斯反坦克枪', mode:'栓动 · 13.9mm', type:'bolt', snd:'sniper', dmg:92, headMul:1.6, rpm:24, mag:5, reserve:40, reload:3.0, spreadHip:6, spreadAds:0.06, recoil:4.0, recSide:0.8, adsFov:44, kick:0.21, boltT:1.4, atRifle:true, vehDmg:125, wg:'atr', tracer:1, fallS:80, fallE:280, fallF:0.8, wSpd:0.9 },
// ---- 八路军 ----
hanyang:  { name:'汉阳造八八式', mode:'栓动', type:'bolt', snd:'sniper', dmg:78, headMul:2.4, rpm:50, mag:5, reserve:90, reload:2.7, spreadHip:5.0, spreadAds:0.12, recoil:2.3, recSide:0.5, adsFov:48, kick:0.1, boltT:1.05, tracer:1, fallS:70, fallE:260, fallF:0.8, wSpd:0.95 },
c96auto:  { name:'快慢机(盒子炮)', mode:'全自动', type:'auto', snd:'smg', dmg:21, headMul:1.6, rpm:620, mag:20, reserve:240, reload:2.4, spreadHip:3.8, spreadAds:0.95, recoil:0.6, recSide:0.55, adsFov:56, kick:0.05, wg:'c96a', vmLegacy:true, tracer:4, fallS:22, fallE:110, fallF:0.3, wSpd:0.97 },
type11:   { name:'歪把子(缴获)', mode:'全自动', type:'auto', snd:'mg', dmg:27, headMul:1.9, rpm:480, mag:30, reserve:240, reload:3.8, spreadHip:4.2, spreadAds:0.6, recoil:0.9, recSide:0.55, adsFov:54, kick:0.055, wg:'hopper', tracer:3, wSpd:0.94 },
mortar:   { name:'轻型迫击炮', mode:'曲射支援', type:'semi', snd:'cannon', dmg:30, headMul:1, rpm:16, mag:1, reserve:32, reload:3.2, spreadHip:3, spreadAds:2.5, recoil:1.4, recSide:0.4, adsFov:62, kick:0.12, mortar:true, vmLegacy:true, tracer:1, wSpd:0.95 },
// ---- 支援兵种自卫武器 (弱化型) ----
m1carb:   { name:'M1 卡宾枪', mode:'半自动', type:'semi', snd:'smg', dmg:22, headMul:1.9, rpm:340, mag:15, reserve:150, reload:2.2, spreadHip:2.8, spreadAds:0.55, recoil:0.6, recSide:0.35, adsFov:56, kick:0.04, model:'garand', vmLegacy:true, tracer:3, fallS:30, fallE:150, fallF:0.45, wSpd:0.96 },
g33:      { name:'G33/40 骑枪', mode:'栓动', type:'bolt', snd:'sniper', dmg:60, headMul:2.2, rpm:48, mag:5, reserve:70, reload:2.7, spreadHip:4.4, spreadAds:0.22, recoil:2.2, recSide:0.5, adsFov:50, kick:0.1, boltT:1.15, model:'kar98', tracer:1, fallS:50, fallE:200, fallF:0.55, wSpd:0.96 },
m38carb:  { name:'莫辛 M38 骑枪', mode:'栓动', type:'bolt', snd:'sniper', dmg:62, headMul:2.2, rpm:46, mag:5, reserve:70, reload:2.7, spreadHip:4.6, spreadAds:0.24, recoil:2.3, recSide:0.5, adsFov:50, kick:0.1, boltT:1.2, model:'mosin', tracer:1, fallS:50, fallE:200, fallF:0.55, wSpd:0.96 },
type38c:  { name:'三八式骑枪', mode:'栓动', type:'bolt', snd:'sniper', dmg:58, headMul:2.2, rpm:50, mag:5, reserve:70, reload:2.6, spreadHip:4.4, spreadAds:0.22, recoil:2.0, recSide:0.45, adsFov:50, kick:0.09, boltT:1.1, model:'arisaka', tracer:1, fallS:50, fallE:200, fallF:0.55, wSpd:0.96 },
laotao:   { name:'老套筒(汉阳早期)', mode:'栓动', type:'bolt', snd:'sniper', dmg:54, headMul:2.1, rpm:44, mag:5, reserve:60, reload:2.9, spreadHip:5.0, spreadAds:0.3, recoil:2.2, recSide:0.55, adsFov:50, kick:0.1, boltT:1.25, model:'hanyang', tracer:1, fallS:50, fallE:200, fallF:0.55, wSpd:0.96 },
// ---- 实验模式·非史实 ----
loiter:   { name:'巡飞弹发射器', mode:'单发 · TV制导', type:'loiter', snd:'cannon', dmg:24, headMul:1, rpm:10, mag:1, reserve:4, reload:2.6, spreadHip:4.8, spreadAds:1.0, recoil:5.0, recSide:1.5, adsFov:52, kick:0.18, rocket:true, loiter:true, model:'bazooka', tracer:1, wSpd:0.9 },
// ---- 观战模式专属·非史实 (2026-09-17 观战扩展批) ----
// 观战模式: 副武器位(2号槽)一律换成这把连狙 (00-config playerClassWeapons / 23-deploy applySpectatorLoadout);
// 数值按用户裁定: **全自动** (2026-09-17 二改: 原半自动 → 全自动)、300 发/分、20 发弹匣、**后坐力压低** (recoil 1.8→1.0);
// scoped:true ⇒ 开镜走 4x 镜片遮罩+窄视场 (10-viewmodel/22-hud 同源), 观战弹药每 0.5s 自动回满 ⇒ 永不换弹。
specsniper:{ name:'观战连狙', mode:'全自动 · 4x', type:'auto', snd:'sniper', dmg:75, headMul:2.5, rpm:300, mag:20, reserve:200, reload:2.6, spreadHip:4.2, spreadAds:0.05, recoil:1.0, recSide:0.24, adsFov:24, kick:0.05, scoped:true, model:'springfield', vmLegacy:true, tracer:1, fallS:60, fallE:240, fallF:0.7, wSpd:0.95 },
};
// 兵种 8→5 (2026-09-28 阶段三 P1 首轮, 用户裁定):
//   冲锋枪手+突击兵 → **突击兵** (主武器只留冲锋枪, 德军例外=STG44; 燃烧弹/AT雷随突击兵保留);
//   迫击炮兵+工程兵 → **工程兵** (B/5 建造, 6 架设/回收迫击炮);
//   医护兵删除 —— 医疗箱改为工程兵建造菜单第 5 件 (06-engineering BUILD_MENU)。
// 索引即兵种: 0步枪兵 / 1突击兵 / 2狙击手 / 3反坦克兵 / 4工程兵 (全库 cls 硬编码已随本批重映射)。
// 投掷物为史实携带量的 ×2 (2026-08-30 用户指定: 全员身上物资翻倍)
// 2026-10-05 用户裁定: 突击兵手雷 5→2; 步枪兵新增 AT雷×2 —— atn 进本表直读 (clsGear 只保留反坦克兵
//   的阵营特例), 表上不再放死数据 (原 CLASSES[3].atn:6 与 clsGear 阵营算式双轨, 一直无人读, 随本批删)。
const CLASSES=[
{ name:'步枪兵', nades:4, smoke:2, atn:2 },
{ name:'突击兵', nades:2, smoke:2, incin:2, atn:4 },
{ name:'狙击手', nades:2, smoke:2 },
{ name:'反坦克兵', nades:2, smoke:0 },
{ name:'工程兵', nades:2, smoke:2 },
];
// Bot 兵种池 (14 槽): 支援密度=工程兵×3 (收拢原 迫击炮×1+工程×1+医护×2=4/14),
// 反坦克×3 (对 5v5 装甲的克制面), 步枪×4 / 突击×3 / 狙击×1。
const CLS_POOL=[0,0,0,0,1,1,1,2,3,3,3,4,4,4];
