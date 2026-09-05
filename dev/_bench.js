// 临时基准: 诺曼底 600帧 全循环计时 (复用 probe-bots 的 boot)
const fs=require('fs'),path=require('path'),vm=require('vm');
const P=require('./probe-bots.js'); // 不行——probe-bots 是脚本会直接执行。改为独立小桩方案:
