// ─────────────────────────────────────────────
// dev/_loadcache.js —— 探针沙箱共享载入缓存 (2026-11-19 效率批)
// 背景: 每支探针 boot 一次就把全部 js/*.js fs.readFileSync+vm 编译一遍; 多 boot 探针
// (verify-boot/nav/navspots/destruct/fixbatch/specbatch/... 合计 60+ 次 boot/轮) 白白重复
// 读盘+编译 (全链 ≈82ms/boot, 实测读盘26ms+编译56ms)。本模块把"读+编译"变成进程级单次,
// 逐 ctx 仍是 script.runInContext —— 语义与 vm.runInContext(fs.readFileSync(f)) 逐位等价
// (编译是纯函数, 每次执行照旧), 纯机械省时。
// 用法:
//   const LC=require('./_loadcache.js');
//   // 原来: for(const f of files) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
//   // 改为: for(const f of files) LC.run(ctx,root,f);
//   const src=LC.src(root,'js/00-config.js');   // 只想要源码文本 (memo 过的读盘)
//   LC.script(root,f)                            // 想自己拿 vm.Script
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const SRC=new Map();   // absPath -> source text
const SCR=new Map();   // absPath -> vm.Script
function src(root,f){
const p=path.isAbsolute(f)?f:path.join(root,f);
let s=SRC.get(p);
if(s===undefined){ s=fs.readFileSync(p,'utf8'); SRC.set(p,s); }
return s;
}
function script(root,f){
const p=path.isAbsolute(f)?f:path.join(root,f);
let sc=SCR.get(p);
if(sc===undefined){ sc=new vm.Script(src(root,p),{filename:path.isAbsolute(f)?path.relative(root,f):f}); SCR.set(p,sc); }
return sc;
}
function run(ctx,root,f){ script(root,f).runInContext(ctx); }
module.exports={src,script,run};
