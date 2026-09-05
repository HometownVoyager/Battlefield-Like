// ─────────────────────────────────────────────
// 15a-defs.js —— 坦克定义数据表 (TANK_DEFS)
// 2026-08-24 由 15-vehicles.js 切分: 原第 10-15 行 (行为代码仍在 15-vehicles.js)
// ⚠️ 注意: Tank 类实际读取的是 00-config.js 里 FACTIONS[...].tanks (含全部 6 阵营);
//    本表仅为美苏两军的对照副本, 改数值请两处同步 (2026-08-30 reload 已 ×1/4, 玩家与 AI 共用)
//    2026-09-01 压制力增强: hp ×1.5 / 主炮 dmg ×~1.55 (与 FACTIONS 同步)
//    2026-09-02 移速增强: spd/rev ×1.3 (与 FACTIONS 同步)
// ─────────────────────────────────────────────
'use strict';
const TANK_DEFS=[
[{name:'M4 谢尔曼',hp:1200,spd:8.3,rev:4.4,turn:0.9,reload:1.3,tRate:2.4,dmg:520,col:0x586e40,colT:0x404e30,heavy:false,barrelL:3.3,hullL:5.8},
{name:'M26 潘兴',hp:1900,spd:6.5,rev:3.6,turn:0.7,reload:1.65,tRate:1.9,dmg:660,col:0x50663c,colT:0x3c5030,heavy:true,barrelL:4.1,hullL:6.4}],
[{name:'四号坦克',hp:1200,spd:8.1,rev:4.4,turn:0.9,reload:1.3,tRate:2.4,dmg:520,col:0x545a50,colT:0x3e4238,heavy:false,barrelL:3.5,hullL:5.8},
{name:'黑豹',hp:1900,spd:7.0,rev:3.6,turn:0.75,reload:1.6,tRate:2.0,dmg:660,col:0x5c5a48,colT:0x464438,heavy:true,barrelL:4.3,hullL:6.6}]
];
