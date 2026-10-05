// ─────────────────────────────────────────────
// dev/cdp.js —— 无头实机探针公共库 (2026-09-20 本批新建)
//
// 为什么需要它: 本仓库全部 dev/probe-*.js 都是 **沙箱桩** (dev/_bootstub.js) —— 它们把
// window/document/THREE 全都 stub 掉, 所以能验算法, 但**验不了真实 DOM/CSS/脚本链**。
// 用户实报的第 6 条("部分地图主菜单没有隐藏战斗 HUD")恰恰是"类挂没挂 / CSS 有没有生效"
// 这种只有真浏览器才能回答的问题。本文件用 Edge 的 CDP 通道补上这一层:
// 真开 index.html、真加载 three/cannon、真跑完主脚本链, 然后读 DOM 与 computed style。
//
// 用法:
//   const {openPage}=require('./cdp');
//   const pg=await openPage('http://localhost:8000/index.html');
//   await pg.waitFor('!!window.__sfBooted', 30000);
//   console.log(await pg.eval('document.body.className'));
//   await pg.screenshot('dev/out/shot.png');
//   await pg.close();
//
// 注意: 本文件只做"启浏览器 + 连 CDP + 求值/截图", 不含任何游戏断言 —— 断言写在各自探针里。
'use strict';
const {spawn}=require('child_process');
const fs=require('fs');
const os=require('os');
const path=require('path');
const http=require('http');

// 本机可用的 Chromium 内核浏览器 (按优先级): Edge 在 Windows 上恒有, 作为默认
const BROWSERS=[
'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

function pickBrowser(){
const env=process.env.SF_BROWSER;
if(env&&fs.existsSync(env)) return env;
for(const b of BROWSERS) if(fs.existsSync(b)) return b;
throw new Error('找不到 Edge/Chrome 可执行文件 (可用环境变量 SF_BROWSER 指定)');
}

function httpJson(url){
return new Promise((res,rej)=>{
http.get(url,r=>{
let s='';
r.on('data',d=>s+=d);
r.on('end',()=>{ try{ res(JSON.parse(s)); }catch(e){ rej(new Error('非 JSON 响应: '+s.slice(0,200))); } });
}).on('error',rej);
});
}

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

// 等到 CDP HTTP 端点就绪 (浏览器启动有延迟; 最多等 timeoutMs)
async function waitDevtools(port,timeoutMs){
const t0=Date.now();
for(;;){
try{ return await httpJson('http://127.0.0.1:'+port+'/json/version'); }
catch(e){ if(Date.now()-t0>timeoutMs) throw new Error('CDP 端点 '+port+' 未就绪: '+e.message); await sleep(150); }
}
}

class Page{
constructor(ws,url,proc,userDir){
this.ws=ws; this.url=url; this.proc=proc; this.userDir=userDir;
this._id=0; this._pending=new Map(); this._events=new Map(); this._closed=false;
this.consoleLog=[];   // {type,text} 全部 console 消息 (含 warn/error), 供探针断言"没有报错"
this.pageErrors=[];   // 未捕获异常 / 资源加载失败
ws.addEventListener('message',ev=>this._onMessage(ev.data));
ws.addEventListener('close',()=>{ this._closed=true; for(const p of this._pending.values()) p.rej(new Error('CDP 连接关闭')); this._pending.clear(); });
}
_onMessage(raw){
let m; try{ m=JSON.parse(raw); }catch(e){ return; }
if(m.id!==undefined){
const p=this._pending.get(m.id);
if(!p) return;
this._pending.delete(m.id);
if(m.error) p.rej(new Error(m.error.message||JSON.stringify(m.error)));
else p.res(m.result);
return;
}
// 事件
const args=m.params||{};
if(m.method==='Runtime.consoleAPICalled'){
const text=(args.args||[]).map(a=>a.value!==undefined?a.value:(a.description!==undefined?a.description:a.type)).join(' ');
this.consoleLog.push({type:args.type,text});
}
else if(m.method==='Runtime.exceptionThrown'){
const d=args.exceptionDetails||{};
this.pageErrors.push('EXCEPTION: '+(d.exception&&(d.exception.description||d.exception.value)||d.text||'?'));
}
else if(m.method==='Log.entryAdded'){
const e=args.entry||{};
this.consoleLog.push({type:e.level||'log',text:'['+(e.source||'log')+'] '+(e.text||'')});
if(e.level==='error') this.pageErrors.push('LOG-ERROR: '+(e.text||''));
}
const hs=this._events.get(m.method);
if(hs) for(const h of hs.slice()) h(args);
}
send(method,params){
if(this._closed) return Promise.reject(new Error('页面已关闭'));
const id=++this._id;
this.ws.send(JSON.stringify({id,method,params:params||{}}));
return new Promise((res,rej)=>{ this._pending.set(id,{res,rej}); });
}
on(method,handler){
if(!this._events.has(method)) this._events.set(method,[]);
this._events.get(method).push(handler);
}
// ── CDN 离线桩 (2026-09-20 本批) ──
// 为什么需要: index.html 从 cdn.jsdelivr.net 拉 three/cannon。外网一断, 整局启动链就崩
// (index.html 末尾 bootFail 兜底会解除首屏隐藏), 于是"实机验证"变成"网络可用性验证" ——
// 本机今天就断过一次网, 直接导致所有真浏览器探针 ERR_CONNECTION_TIMED_OUT。
// 做法: 用 Fetch 域拦 jsdelivr 请求, 从 dev/vendor/*.min.js 回填 (缺文件则放行到网络)。
enableCdnStub(){
if(this._cdnStub) return this._cdnStub;
const mapping=[
[/three@[\d.]+\/build\/three(\.min)?\.js$/, 'three.min.js'],
[/cannon@[\d.]+\/build\/cannon(\.min)?\.js$/, 'cannon.min.js'],
];
// 注意: 必须先把 this._cdnStub 赋成"最终返回的那个 promise", 不能在 .then 里再赋值并 return 它 ——
// 那会形成 promise 链自引用 (Chaining cycle detected), 本文件第一版就踩了这个坑。
this._cdnStub=this.send('Fetch.enable',{patterns:[{urlPattern:'*cdn.jsdelivr.net*',requestStage:'Request'}]})
.then(()=>{
this.on('Fetch.requestPaused',async p=>{
const url=p.request&&p.request.url||'';
for(const [re,name] of mapping){
if(!re.test(url)) continue;
const f=path.join(__dirname,'vendor',name);
if(!fs.existsSync(f)) break;
const body=fs.readFileSync(f).toString('base64');
try{
await this.send('Fetch.fulfillRequest',{requestId:p.requestId,responseCode:200,
responseHeaders:[{name:'Content-Type',value:'text/javascript; charset=utf-8'},{name:'Access-Control-Allow-Origin',value:'*'}],
body});
}catch(e){ try{ await this.send('Fetch.continueRequest',{requestId:p.requestId}); }catch(e2){} }
this.consoleLog.push({type:'log',text:'[cdn-stub] 本地回填 '+name+' ← '+url});
return;
}
try{ await this.send('Fetch.continueRequest',{requestId:p.requestId}); }catch(e){}
});
});
return this._cdnStub;
}
// 在页面上下文里求值 (awaitPromise=true: 支持 async IIFE / Promise)
async eval(expr,awaitPromise=true){
const r=await this.send('Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise,userGesture:true});
if(r.exceptionDetails){
const d=r.exceptionDetails;
throw new Error('页面求值抛错: '+((d.exception&&d.exception.description)||d.text));
}
return r.result?r.result.value:undefined;
}
// 轮询直到表达式为真 (返回 true) 或超时 (抛错)
async waitFor(expr,timeoutMs=30000,pollMs=200){
const t0=Date.now();
for(;;){
let v=false;
try{ v=await this.eval(expr); }catch(e){ /* 求值失败=还没就绪, 继续等 */ }
if(v) return true;
if(Date.now()-t0>timeoutMs) throw new Error('等待超时 ('+timeoutMs+'ms): '+expr+'  最近 console: '+JSON.stringify(this.consoleLog.slice(-6)));
await sleep(pollMs);
}
}
async goto(url,waitMs=0){
this.url=url;
await this.send('Page.navigate',{url});
if(waitMs) await sleep(waitMs);
}
async screenshot(file){
const fs2=require('fs'), p2=require('path');
const r=await this.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
fs2.mkdirSync(p2.dirname(file),{recursive:true});
fs2.writeFileSync(file,Buffer.from(r.data,'base64'));
return file;
}
// 合成点击 (按 CSS 选择器中心点): 用于"按钮点击→状态变化"这类只有真浏览器能验的交互
async click(selector){
const box=await this.eval(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}); if(!e) return null;
const r=e.getBoundingClientRect(); if(!r.width||!r.height) return null;
return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
if(!box) throw new Error('找不到可点击元素: '+selector);
for(const type of ['mousePressed','mouseReleased']){
await this.send('Input.dispatchMouseEvent',{type,x:box.x,y:box.y,button:'left',clickCount:1});
}
}
// 枚举触摸中心点 (触摸派发用; 与 click 分开是因为 #touchUI 的按钮**只绑 touchstart/touchend**, 不响应 click)
async centerOf(selector){
const box=await this.eval(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}); if(!e) return null;
const r=e.getBoundingClientRect(); if(!r.width||!r.height) return null;
return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)};})()`);
if(!box) throw new Error('找不到可触摸元素: '+selector);
return box;
}
// 真实触摸点击 (Input.dispatchTouchEvent): 本仓库的触控键 (#touchUI .tbtn) 由 24-main 的 bindBtn
// 只挂 touchstart/touchend, **不挂 click** —— 所以用鼠标事件点它们是点不动的 (2026-09-20 踩坑)。
async touch(selector){
const p=await this.centerOf(selector);
const tp=[{x:p.x,y:p.y,radiusX:2,radiusY:2,force:1,id:1}];
await this.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:tp});
await this.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
return p;
}
async key(code,key){
await this.send('Input.dispatchKeyEvent',{type:'keyDown',code,key:key||code,windowsVirtualKeyCode:0});
await this.send('Input.dispatchKeyEvent',{type:'keyUp',code,key:key||code,windowsVirtualKeyCode:0});
}
async close(){
try{ await this.send('Browser.close'); }catch(e){}
try{ this.ws.close(); }catch(e){}
try{ this.proc.kill(); }catch(e){}
// 清理临时用户数据目录 (浏览器进程可能还没退干净 → 容错)
await sleep(300);
try{ fs.rmSync(this.userDir,{recursive:true,force:true}); }catch(e){}
}
}

// 连上浏览器并新建一个页面 (about:blank), 已开启 Runtime/Log/Page 域
// opts.autoAcceptDialogs (默认 true): 自动接受 confirm()/alert()。
// 必要性: 本仓库很多流程用 confirm() 做二次确认 (如「新游戏会放弃当前战局」), 无头浏览器下
// 对话框会**永久阻塞**协议求值 —— 第一版探针就卡死在这里。
async function openPage(url,opts){
opts=opts||{};
const bin=pickBrowser();
const port=opts.port||(9200+Math.floor(Math.random()*300));
const userDir=opts.userDir||path.join(os.tmpdir(),'sf-cdp-'+port+'-'+Date.now());
const args=[
'--headless=new',
'--disable-gpu',
'--remote-debugging-port='+port,
'--user-data-dir='+userDir,
'--no-first-run','--no-default-browser-check','--disable-extensions',
'--disable-features=Translate,msEdgeSidebar',
'--window-size='+(opts.width||1280)+','+(opts.height||720),
'--hide-scrollbars',
'--autoplay-policy=no-user-gesture-required',
'--mute-audio',
'about:blank',
];
const proc=spawn(bin,args,{stdio:'ignore',windowsHide:true});
const ver=await waitDevtools(port,opts.launchTimeoutMs||20000);
const ws=new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((res,rej)=>{
ws.addEventListener('open',res,{once:true});
ws.addEventListener('error',()=>rej(new Error('CDP WebSocket 连接失败')),{once:true});
});
// 浏览器级连接 → 先建 target 再附着 (比直接用 /json/new 更稳: 新版 Edge 禁用了 /json/new 的 GET)
const bws=ws;
let bid=0; const bpend=new Map();
bws.addEventListener('message',ev=>{
let m; try{ m=JSON.parse(ev.data); }catch(e){ return; }
if(m.id!==undefined){ const p=bpend.get(m.id); if(p){ bpend.delete(m.id); m.error?p.rej(new Error(m.error.message)):p.res(m.result); } }
});
const bsend=(method,params)=>{ const id=++bid; bws.send(JSON.stringify({id,method,params:params||{}})); return new Promise((res,rej)=>bpend.set(id,{res,rej})); };
const {targetId}=await bsend('Target.createTarget',{url:'about:blank'});
const list=await httpJson('http://127.0.0.1:'+port+'/json/list');
const t=list.find(t=>t.id===targetId);
if(!t||!t.webSocketDebuggerUrl) throw new Error('拿不到页面 target 的 WebSocket 地址');
const pws=new WebSocket(t.webSocketDebuggerUrl);
await new Promise((res,rej)=>{
pws.addEventListener('open',res,{once:true});
pws.addEventListener('error',()=>rej(new Error('页面 CDP WebSocket 连接失败')),{once:true});
});
const page=new Page(pws,url,proc,userDir);
await page.send('Runtime.enable');
await page.send('Log.enable');
await page.send('Page.enable');
// opts.cdnStub !== false → 优先离线回填 jsdelivr 的 three/cannon (默认开启: 让实机验证不依赖外网)
if(opts.cdnStub!==false){ try{ await page.enableCdnStub(); }catch(e){ console.warn('[cdp] CDN 桩启用失败, 将走网络: '+e.message); } }
if(opts.autoAcceptDialogs!==false){
page.on('Page.javascriptDialogOpening',async p=>{
page.consoleLog.push({type:'dialog',text:'[dialog '+(p.type||'')+'] '+(p.message||'')});
try{ await page.send('Page.handleJavaScriptDialog',{accept:true}); }catch(e){}
});
}
if(url){ await page.goto(url); }
return page;
}

module.exports={openPage,pickBrowser,sleep};
