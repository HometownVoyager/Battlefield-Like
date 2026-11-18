const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const {sandbox,document,window,byId}=require('./_bootstub.js');
require('./_bootpatch.js').patch(sandbox);
const _O3=sandbox.THREE.Object3D;
if(_O3&&_O3.prototype&&!_O3.prototype.clear) _O3.prototype.clear=function(){ if(this.children) this.children.length=0; return this; };
sandbox.confirm=()=>true;
const handlers={}; sandbox.addEventListener=(t,f)=>{ (handlers[t]=handlers[t]||[]).push(f); }; sandbox.removeEventListener=()=>{};
const patchEl=e=>e;
{ const g=document.getElementById.bind(document),c=document.createElement.bind(document);
document.getElementById=id=>patchEl(g(id)); document.createElement=t=>patchEl(c(t)); }
const idxSrc=fs.readFileSync(path.join(root,'index.html'),'utf8');
const FILES=[...idxSrc.matchAll(/src="([^"?]+\.js)/g)].map(m=>m[1]).filter(f=>/^js\//.test(f));
const ctx=vm.createContext(Object.assign({},sandbox));
ctx.document=document; ctx.window=window; ctx.__evH=handlers;
const Quat=class{ constructor(){this.x=0;this.y=0;this.z=0;this.w=1;} set(x,y,z,w){this.x=x;this.y=y;this.z=z;this.w=w;return this;} setFromEuler(){return this;} setFromAxisAngle(){return this;} copy(q){Object.assign(this,q);return this;} mult(){return this;} normalize(){return this;} };
const CV3=sandbox.THREE.Vector3;
ctx.CANNON={Vec3:CV3,Quaternion:Quat,World:class{constructor(){this.bodies=[];}add(){}remove(){}step(){}},Body:class{constructor(o){Object.assign(this,o||{});this.position=new CV3();this.velocity=new CV3();this.angularVelocity=new CV3();this.quaternion=new Quat();}addShape(){}},Box:class{},Sphere:class{},Material:class{},ContactMaterial:class{},NaiveBroadphase:class{},PointToPointConstraint:class{}};
ctx.localStorage={_s:{sf_campaign:'0'},getItem(k){return (k in this._s)?this._s[k]:null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of FILES) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
const R=x=>vm.runInContext(x,ctx);
try{ R(`SPAWN_PROT=0; document.getElementById('startBtn').onclick();`); }catch(e){ console.log('boot err',e.message); }
console.log('applyMatrix4 src:', R(`THREE.Vector3.prototype.applyMatrix4?String(THREE.Vector3.prototype.applyMatrix4).slice(0,120):'MISSING'`));
console.log('stub V3 copy:', R(`String(THREE.Vector3.prototype.copy).slice(0,150)`));
