// ═══ 临时诊断 (不入册): 军刀姿态真值测量 —— 3P 刀向/双臂分配/刀件驱动 + FP 根旋转/刀件曲线 ═══
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const stub=require('./_bootstub.js');
require('./_bootpatch.js').patch(stub.sandbox);
{const P=Object.getPrototypeOf(stub.THREE.Group.prototype); if(!P.clear) P.clear=function(){ this.children.length=0; };}
const _ensureStyle=e=>{ if(e&&e.style&&!e.style.setProperty) e.style.setProperty=(k,v)=>{ e.style[k]=v; }; return e; };
{const doc=stub.document,og=doc.getElementById.bind(doc),oc=doc.createElement.bind(doc);
doc.getElementById=id=>_ensureStyle(og(id));
doc.createElement=t=>_ensureStyle(oc(t));}
const CANNON=(()=>{
const V3=stub.THREE.Vector3;
class Quat{constructor(){this.x=0;this.y=0;this.z=0;this.w=1;}set(){return this;}setFromEuler(){return this;}copy(){return this;}}
return {
Vec3:V3,Quaternion:Quat,
World:class{constructor(){this.gravity=new V3();this.broadphase=null;this.solver={iterations:0};this.bodies=[];}addBody(b){this.bodies.push(b);}removeBody(b){const i=this.bodies.indexOf(b);if(i>=0)this.bodies.splice(i,1);}add(b){this.addBody(b);}remove(b){this.removeBody(b);}addConstraint(){}removeConstraint(){}step(){}},
Body:class{constructor(o){Object.assign(this,o||{});this.shapes=[];this.position=new V3();this.velocity=new V3();this.angularVelocity=new V3();this.quaternion=new Quat();this.angularDamping=0;this.linearDamping=0;}addShape(s){this.shapes.push(s);}},
Box:class{},Sphere:class{},Material:class{},ContactMaterial:class{},NaiveBroadphase:class{},PointToPointConstraint:class{},
};})();
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const FILES=[...html.matchAll(/src="(js\/[^"?]+)/g)].map(m=>m[1]);
const SRC=f=>fs.readFileSync(path.join(root,f),'utf8');
const ctx=vm.createContext(Object.assign({},stub.sandbox));
ctx.document=stub.document; ctx.window=stub.window; ctx.CANNON=CANNON;
ctx.localStorage={_s:{sf_campaign:'0',sf_pseed:'424242'},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
for(const f of FILES) vm.runInContext(SRC(f),ctx,{filename:f});
const G=s=>vm.runInContext(s,ctx);
G("document.getElementById('startBtn').onclick();");
G('if(!player.alive||!player.deployed) deployPlayer();');
G('for(const s of soldiers) s.protUntil=0; player.protUntil=0;');
// 姿态推帧 + 切槽助手 (照 verify-melee)
G('function _vmIdle(){ for(var i=0;i<50;i++){ if(VM.state==="idle") break; updateViewModel(1/60,player); } }');
G('function _toSabre(){ _vmIdle(); if(player.curSlot!==2) switchSlot(2,true); _vmIdle(); }');
G('function _avFrames(n){ for(var i=0;i<n;i++) updatePlayerAvatar(1/60); }');
// 欧拉旋转数值解算 (右手系): three.js Euler 语义 —— 'XYZ' ⇒ R=Rx·Ry·Rz (v'=Rx(Ry(Rz·v))),
// 'YXZ' ⇒ R=Ry·Rx·Rz (v'=Ry(Rx(Rz·v)))。3P gunG.rotation.order='YXZ' (js/11-soldiers.js),
// FP VM.root 默认 'XYZ' —— 按 order 参数选择, 旧版恒按 XYZ 算 = 对 3P 是错序真值。
const rotEuler=(e,v,order)=>{
const cx=Math.cos(e.x),sx=Math.sin(e.x),cy=Math.cos(e.y),sy=Math.sin(e.y),cz=Math.cos(e.z),sz=Math.sin(e.z);
let x=v.x*cz - v.y*sz, y=v.x*sz + v.y*cz, z=v.z;          // Rz
if(order==='YXZ'){
const y2=y*cx - z*sx, z2=y*sx + z*cx;                     // Rx
const x3=x*cy + z2*sy, z3=-x*sy + z2*cy;                  // Ry
return {x:x3,y:y2,z:z3};
}
const x2=x*cy + z*sy, z2=-x*sy + z*cy;                     // Ry
const y3=y*cx - z2*sx, z3=y*sx + z2*cx;                    // Rx
return {x:x2,y:y3,z:z3};
};
console.log('=== A. 3P 常态 (举刀) 真值 ===');
G('_toSabre(); var av=playerAvatarEnsure(); _avFrames(30);');
console.log('gunG.rotation =', JSON.stringify(G('({x:av.gunG.rotation.x,y:av.gunG.rotation.y,z:av.gunG.rotation.z})')), 'order=', G('av.gunG.rotation.order'));
console.log('gunG.position =', JSON.stringify(G('({x:av.gunG.position.x,y:av.gunG.position.y,z:av.gunG.position.z})')));
console.log('armR.sh.rot   =', JSON.stringify(G('({x:av.armR.sh.rotation.x,z:av.armR.sh.rotation.z})')));
console.log('armL.sh.rot   =', JSON.stringify(G('({x:av.armL.sh.rotation.x,z:av.armL.sh.rotation.z})')));
{
// 刀尖在 gunG 空间 = R_y(π)·(0,0.01,-0.837) = (0,0.01,+0.837); 经 gunG 欧拉旋转 → 躯干系方向
// ★三轮批: 按 rotation.order 真序解算, 同时打印两序对照 (旧版恒按 XYZ = 对 YXZ 的 gunG 是错序真值)
const e=G('({x:av.gunG.rotation.x,y:av.gunG.rotation.y,z:av.gunG.rotation.z})');
const ord=G('av.gunG.rotation.order');
const tipYXZ=rotEuler(e,{x:0,y:0.0135,z:0.837},ord||'YXZ');
const tipXYZ=rotEuler(e,{x:0,y:0.0135,z:0.837},'XYZ');
console.log('刀尖方向(躯干系, +z=面向) YXZ(真序) =', JSON.stringify({x:+tipYXZ.x.toFixed(3),y:+tipYXZ.y.toFixed(3),z:+tipYXZ.z.toFixed(3)}),
tipYXZ.z>0.05?'→ 前方✓':(tipYXZ.z<-0.05?'→ 后方✗✗':'→ 竖直'));
console.log('刀尖方向(躯干系, +z=面向) XYZ(对照) =', JSON.stringify({x:+tipXYZ.x.toFixed(3),y:+tipXYZ.y.toFixed(3),z:+tipXYZ.z.toFixed(3)}));
}
console.log('=== B. 3P 横斩 (slash) 采样: 谁在挥? 刀件动不动? ===');
G('startMelee("slash"); var _rows=[];');
for(let i=1;i<=30;i++){
G('updateViewModel(1/60,player); player.meleeCd=Math.max(0,player.meleeCd-1/60); updatePlayerAvatar(1/60);');
if(i===5||i===10||i===15||i===20||i===25){
const r=G('({t:'+(i/60).toFixed(2)+',kind:player.meleeKind,shL:+av.armL.sh.rotation.x.toFixed(2),shR:+av.armR.sh.rotation.x.toFixed(2),shLz:+av.armL.sh.rotation.z.toFixed(2),shRz:+av.armR.sh.rotation.z.toFixed(2),gX:+av.gunG.rotation.x.toFixed(2),gY:+av.gunG.rotation.y.toFixed(2),gpZ:+(av.gunG.position.z).toFixed(3),gpX:+(av.gunG.position.x).toFixed(3)})');
console.log('f'+i, JSON.stringify(r));
}
}
console.log('=== C. FP 常态/横斩 真值 ===');
G('_toSabre();');
console.log('VM.root.rotation =', JSON.stringify(G('({x:+VM.root.rotation.x.toFixed(3),y:+VM.root.rotation.y.toFixed(3),z:+VM.root.rotation.z.toFixed(3)})')));
console.log('VM.gun.rotation  =', JSON.stringify(G('({x:+VM.gunParts.gun.rotation.x.toFixed(3),y:+VM.gunParts.gun.rotation.y.toFixed(3),z:+VM.gunParts.gun.rotation.z.toFixed(3)})')));
{
// FP: 刀尖在 root 系 (0,0,-1) (刀身 -z), 经 root 欧拉 → 视空间 (-z=离镜头向前)
const e=G('({x:VM.root.rotation.x,y:VM.root.rotation.y,z:VM.root.rotation.z})');
const ord=G('VM.root.rotation.order')||'XYZ';
const tip=rotEuler(e,{x:0,y:0,z:-1},ord);
console.log('FP 刀尖方向(视空间, -z=向前, order='+ord+') =', JSON.stringify({x:+tip.x.toFixed(3),y:+tip.y.toFixed(3),z:+tip.z.toFixed(3)}),
tip.y>0.3?'→ 上举✓':'', tip.z<0?'向前✓':'向后✗✗');
}
G('player.meleeCd=0; startMelee("slash");');
for(let i=1;i<=30;i++){
G('updateViewModel(1/60,player); player.meleeCd=Math.max(0,player.meleeCd-1/60);');
if(i===5||i===10||i===15||i===20||i===25){
const r=G('({t:'+(i/60).toFixed(2)+',st:VM.state,gY:+VM.gunParts.gun.rotation.y.toFixed(2),gX:+VM.gunParts.gun.rotation.x.toFixed(2),gpZ:+VM.gunParts.gun.position.z.toFixed(3),gpX:+VM.gunParts.gun.position.x.toFixed(3)})');
console.log('FP f'+i, JSON.stringify(r));
}
}
