// 临时本地静态服务器 (仅调试用): node .serve.js
const http=require('http'), fs=require('fs'), path=require('path');
const root=__dirname;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.md':'text/plain; charset=utf-8'};
http.createServer((req,res)=>{
let p=decodeURIComponent(req.url.split('?')[0]);
if(p==='/') p='/Index.html';
const f=path.join(root,p);
if(!f.startsWith(root)){ res.writeHead(403); res.end(); return; }
fs.readFile(f,(e,d)=>{
if(e){ res.writeHead(404); res.end('404'); return; }
res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});
res.end(d);
});
}).listen(8000,()=>console.log('serving on http://localhost:8000/'));
