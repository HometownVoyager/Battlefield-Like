// ─────────────────────────────────────────────
// dev/verify-svgtex.js —— SVG 材质精修输出校验沙箱 (不进 Index.html)
// 用法: node dev/verify-svgtex.js
// 原理: 桩化 THREE/DOM(无 Image → SVG_OK=false) 加载 00-config + 02-scene,
//       然后逐条调用 SVGTEX 登记的生成器, 对每个贴图 SVG 做:
//       ① XML 良构校验 (标签配平/属性引号/无裸 & <) ② url(#id) 引用闭合
//       ③ 滤镜 id 唯一 ④ 数值属性可解析 ⑤ data URI 编码往返一致
//       抓的是"浏览器里 SVG 解析失败 → 贴图永远停留在兜底版"这类问题。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
let failures=0;
const fail=(msg)=>{ failures++; console.error('  ✗ '+msg); };

// ── 通用小桩 (与 verify-boot 同款: canvas 2d 代理) ──
const mk2d=()=>new Proxy({}, { get(t,k){
if(k==='canvas') return {width:64,height:64};
if(typeof k==='symbol') return undefined;
if(!(k in t)) t[k]=(...a)=>mk2d();
return t[k];
}, set(t,k,v){ t[k]=v; return true; } });
const mkElement=(tag)=>{
const el={tagName:(tag||'div').toUpperCase(),style:{},classList:{add(){},remove(){},toggle(){},contains(){return false;}},
textContent:'',innerHTML:'',value:'',dataset:{},disabled:false,
children:[],appendChild(c){this.children.push(c);return c;},prepend(c){this.children.unshift(c);},
remove(){},addEventListener(){},removeEventListener(){},focus(){},
getContext:()=>mk2d(),width:0,height:0,
setAttribute(){},querySelector:()=>mkElement(),querySelectorAll:()=>[],
};
Object.defineProperty(el,'firstChild',{get(){ if(!el._fc) el._fc={textContent:''}; return el._fc; }});
return el;
};
const byId={};
const document={
createElement:t=>t==='canvas'?Object.assign(mkElement('canvas'),{width:0,height:0}):mkElement(t),
createElementNS:()=>mkElement('canvas'),
getElementById:id=>{ if(!byId[id]){ byId[id]=mkElement(); byId[id].id=id; } return byId[id]; },
querySelector:()=>mkElement(),querySelectorAll:()=>[],
body:mkElement('body'),head:mkElement('head'),
addEventListener(){},removeEventListener(){},hidden:false,pointerLockElement:null,exitPointerLock(){},
};
// ── THREE 最小桩 (只够 00-config + 02-scene 加载) ──
class V3{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;} set(x,y,z){this.x=x;this.y=y;this.z=z;return this;} setScalar(){return this;} copy(){return this;} clone(){return new V3();} multiplyScalar(){return this;}}
class Obj3{constructor(){this.position=new V3();this.rotation={set(){return this;}};this.scale=new V3(1,1,1);this.children=[];this.visible=true;this.frustumCulled=false;}
add(m){this.children.push(m);m.parent=this;return this;}remove(m){const i=this.children.indexOf(m);if(i>=0)this.children.splice(i,1);}
traverse(fn){fn(this);for(const c of this.children)if(c&&c.traverse)c.traverse(fn);}updateMatrix(){}}
class Geo{constructor(){this.parameters={};}translate(){return this;}setAttribute(){return this;}setIndex(){return this;}computeVertexNormals(){return this;}dispose(){}}
class _Color{constructor(c){this.c=c;}set(){return this;}}
const _wrapColor=c=>(typeof c==='number'||typeof c==='string')?{set(v){this.v=v;}}:(c&&typeof c==='object')?c:{set(){}};
const _mat=cls=>{ return class extends cls{constructor(o){super();Object.assign(this,o||{});this.color=_wrapColor(this.color);}}; };
const THREE={
WebGLRenderer:class{constructor(){this.domElement=Object.assign(mkElement('canvas'),{width:0,height:0});this.shadowMap={enabled:false,type:0};this.setSize=()=>{};this.setPixelRatio=()=>{};this.render=()=>{};this.clear=()=>{};this.clearDepth=()=>{};this.outputColorSpace='';this.setClearColor=()=>{};this.setAnimationLoop=()=>{};this.domElement.style={};}},
Scene:class extends Obj3{constructor(){super();this.fog=null;}},
PerspectiveCamera:class extends Obj3{constructor(){super();this.aspect=1;}updateProjectionMatrix(){}getWorldDirection(v){v.set(0,0,-1);return v;}},
Group:class extends Obj3{},Mesh:class extends Obj3{constructor(g,m){super();this.geometry=g;this.material=m;}},
Object3D:Obj3,Sprite:class extends Obj3{constructor(m){super();this.material=m||{};if(!this.material.color)this.material.color={set(){}};}},
Vector3:V3,Color:_Color,
Fog:class{constructor(c){this.color=new _Color(c);this.near=0;this.far=0;}},
SphereGeometry:Geo,PlaneGeometry:Geo,BoxGeometry:Geo,CylinderGeometry:Geo,
MeshLambertMaterial:_mat(class{constructor(){}}),
MeshBasicMaterial:_mat(class{constructor(){}}),
SpriteMaterial:_mat(class{constructor(){}}),
CanvasTexture:class{constructor(c){this.image=c;this.repeat={set(){}};this.needsUpdate=false;}clone(){return new THREE.CanvasTexture(this.image);}dispose(){}},
DirectionalLight:class extends Obj3{constructor(c,i){super();this.intensity=i||1;this.color=new _Color(c);this.target=new Obj3();this.shadow={mapSize:{setScalar(){}},map:null,bias:0,camera:{updateProjectionMatrix(){},left:0,right:0,top:0,bottom:0,far:0,near:0}};}},
HemisphereLight:class extends Obj3{constructor(a,b,i){super();this.intensity=i;}},
RepeatWrapping:1000,DoubleSide:2,BackSide:1,SRGBColorSpace:'srgb',PCFShadowMap:1,PCFSoftShadowMap:2,ACESFilmicToneMapping:4,
};
// ── 沙箱 ──
const sandbox={
console,Math,JSON,performance:{now:()=>Date.now()},
location:{search:'',reload(){},href:'http://localhost/'},
localStorage:{_s:{},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}},
navigator:{},document,window:{addEventListener(){}},
requestAnimationFrame:()=>0,cancelAnimationFrame(){},setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},
devicePixelRatio:1,innerWidth:1280,innerHeight:720,addEventListener(){},removeEventListener(){},
THREE,
};
sandbox.window.document=document;
vm.createContext(sandbox);
const load=(rel)=>vm.runInContext(fs.readFileSync(path.join(root,rel),'utf8'),sandbox,{filename:rel});
load('js/00-config.js');
load('js/02-scene.js');

// ══ 校验 ══
const g=(expr)=>vm.runInContext(expr,sandbox,{filename:'<probe>'});
const SVGTEX=g('SVGTEX'), TEX=g('TEX'), MAT=g('MAT'), SVG_OK=g('SVG_OK'), svgURI=g('svgURI');
const NAMES=Object.keys(SVGTEX);
console.log(`SVGTEX 登记生成器: ${NAMES.length} 个`);
if(NAMES.length<25) fail(`登记数 ${NAMES.length} < 预期 25 (16 TEX + 庄稼4 + 医疗箱 + 烟尘3 + 白噪4 = 28?)`);

// XML 良构: 标签配平 + 属性引号 + 无裸 & <
function checkXML(svg,tag){
const stack=[];
const re=/<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
let m,last=0;
while((m=re.exec(svg))){
const text=svg.slice(last,m.index);
if(/</.test(text)) fail(`${tag}: 文本中出现裸 '<' (偏移 ${last})`);
const amp=text.indexOf('&');
if(amp>=0 && !/^&(amp|lt|gt|quot|apos);/.test(text.slice(amp))) fail(`${tag}: 未转义 '&' (偏移 ${last+amp})`);
last=re.lastIndex;
const closing=m[1]==='/', name=m[2], self=m[4]==='/';
const attrs=m[3];
// 属性必须带引号
if(/=\s*[^"'\s]/.test(attrs.replace(/=\s*"[^"]*"/g,'').replace(/=\s*'[^']*'/g,''))) fail(`${tag}: <${name}> 存在未加引号的属性`);
if(closing){
const top=stack.pop();
if(top!==name) fail(`${tag}: 标签配平错误 </${name}> 期待 </${top||'EOF'}>`);
}else if(!self){
stack.push(name);
}
}
const tail=svg.slice(last);
if(/</.test(tail)) fail(`${tag}: 末尾文本含裸 '<'`);
if(stack.length) fail(`${tag}: 未闭合标签: ${stack.join(',')}`);
}
// url(#id) 引用闭合 + 滤镜 id 唯一
function checkRefs(svg,tag){
const ids=new Set();
let m; const idRe=/\bid="([^"]+)"/g;
while((m=idRe.exec(svg))) ids.add(m[1]);
const refRe=/url\(#([^')]+)\)/g;
while((m=refRe.exec(svg))) if(!ids.has(m[1])) fail(`${tag}: url(#${m[1]}) 无对应 id`);
// id 重复 (同文档内必须唯一)
const seen=new Set(); idRe.lastIndex=0;
while((m=idRe.exec(svg))){ if(seen.has(m[1])) fail(`${tag}: id "${m[1]}" 重复`); seen.add(m[1]); }
// 平铺贴图必须 stitchTiles + 满幅滤镜域
const tiled=['grass','snowGround','dirt','brick','plaster','stone','wood','woodDark','sandbag','metal','bark','roof','hay','hedge','track','grime','cloth','metalBrush','grainLight'];
if(tiled.includes(tag)){
if(!svg.includes('stitchTiles="stitch"')) fail(`${tag}: 平铺贴图缺少 stitchTiles="stitch"`);
if(/<feTurbulence[^>]*x="-/.test(svg)) fail(`${tag}: 滤镜域越界会破坏平铺`);
}
}
// 数值属性可解析
function checkNums(svg,tag){
const re=/(?:x|y|width|height|cx|cy|rx|ry|r|x1|x2|y1|y2|opacity|stop-opacity|stroke-width|scale|baseFrequency|numOctaves|seed|offset)="(-?[\d.]+(?:\s+-?[\d.]+)*)"/g;
let m;
while((m=re.exec(svg))){
for(const tok of m[1].split(/\s+/)){
const v=parseFloat(tok);
if(!isFinite(v)) fail(`${tag}: 属性值 ${tok} 非有限数`);
}
}
}
for(const name of NAMES){
const e=SVGTEX[name];
try{
const body=e.make();
if(typeof body!=='string'||body.length<20) fail(`${name}: 生成结果过短/非字符串`);
if(/<svg[\s>]/.test(body)) fail(`${name}: 生成器不应包含 <svg> 根 (由 svgURI 包裹)`);
checkXML(body,name);
checkRefs(body,name);
checkNums(body,name);
const uri=svgURI(e.w,e.h,body);
const round=decodeURIComponent(uri.split(',').slice(1).join(','));
if(!round.includes(`<svg xmlns="http://www.w3.org/2000/svg" width="${e.w}" height="${e.h}"`)) fail(`${name}: data URI 往返尺寸不符`);
if(/%00|data:image\/svg\+xml;charset=utf-8,$/.test(uri)) fail(`${name}: data URI 编码异常`);
}catch(err){ fail(`${name}: 生成器抛错 ${err.message}`); }
}
// TEX 库完成度: 每张贴图都应是 CanvasTexture 且登记过 SVG 重绘
const TEXS=['grass','snowGround','dirt','brick','plaster','stone','wood','woodDark','sandbag','metal','bark','leaves','roof','hay','hedge','track','grime','cloth','metalBrush','grainLight'];
for(const t of TEXS){
if(!TEX[t]) fail(`TEX.${t} 缺失`);
}
// MAT 引用抽查: rubble/metalDark 必须挂上共享噪点
if(!MAT.rubble.map) fail('MAT.rubble 未挂 grainLight 噪点贴图');
if(!MAT.metalDark.map) fail('MAT.metalDark 未挂 metalBrush 拉丝贴图');
// SVG_OK 在 Node 必须为 false (沙箱走兜底路径, 布局零漂移的前提)
if(SVG_OK) fail('Node 沙箱中 SVG_OK 应为 false');

// DUMP=<name> 环境变量: 解码打印某个生成器的 SVG 样例 (人工检查用)
if(process.env.DUMP){
const e=SVGTEX[process.env.DUMP];
if(!e){ console.error('无此生成器: '+process.env.DUMP); process.exit(1); }
console.log(decodeURIComponent(svgURI(e.w,e.h,e.make()).split(',').slice(1).join(',')));
}
console.log(failures? `\n✗ ${failures} 项失败` : '\n✓ verify-svgtex: 全部校验通过 (含 '+NAMES.length+' 个 SVG 生成器)');
process.exit(failures?1:0);
