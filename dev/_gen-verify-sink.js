// 生成 dev/verify-sink.js: 以 verify-boot.js 的桩为底座, 升级 Audio/InstancedMesh/Matrix4/CANNON 桩, 拼接 verify-sink.body
'use strict';
const fs=require('fs'),path=require('path');
let s=fs.readFileSync(path.join(__dirname,'verify-boot.js'),'utf8');
const apBlock=`const AP=()=>({value:0,setValueAtTime(){},setTargetAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}});
const AC=class{
createOscillator(){return {frequency:AP(),detune:AP(),type:'',start(){},stop(){},connect(){},onended:null};}
createGain(){return {gain:AP(),connect(){},disconnect(){}};}
createBuffer(){return {getChannelData:()=>new Float32Array(16),duration:1,numberOfChannels:1};}
createBufferSource(){return {buffer:null,loop:false,playbackRate:AP(),start(){},stop(){},connect(){},onended:null};}
createBiquadFilter(){return {type:'',frequency:AP(),Q:AP(),connect(){}};}
createDynamicsCompressor(){return {threshold:AP(),ratio:AP(),attack:AP(),release:AP(),connect(){}};}
createStereoPanner(){return {pan:AP(),connect(){}};}
resume(){return Promise.resolve();}
get state(){return 'running';}
get destination(){return {};}
get currentTime(){return 0;}
get sampleRate(){return 44100;}
};`;
{
const a=s.indexOf('const AC=class{');
const endMark='get sampleRate(){return 44100;}\n};';
const b=s.indexOf(endMark,a);
if(a<0||b<0) throw new Error('AC block not found');
s=s.slice(0,a)+apBlock+s.slice(b+endMark.length);
}
{
const a=s.indexOf('AudioContext:class{createOscillator()');
const endMark='get sampleRate(){return 44100;}},';
const b=s.indexOf(endMark,a);
if(a<0||b<0) throw new Error('sandbox AudioContext not found');
s=s.slice(0,a)+'AudioContext:AC,'+s.slice(b+endMark.length);
}
const imOld='InstancedMesh:class extends Obj3{constructor(g,m,n){super();this.count=n;}setMatrixAt(){this.instanceMatrix={};}setColorAt(){this.instanceColor=this.instanceColor||{needsUpdate:false};}},';
if(!s.includes(imOld)) throw new Error('InstancedMesh anchor not found');
s=s.replace(imOld,'InstancedMesh:class extends Obj3{constructor(g,m,n){super();this.count=n;this.instanceMatrix={array:new Float32Array((n||1)*16),needsUpdate:false,itemSize:16};}setMatrixAt(i,mm){if(mm&&mm.elements)this.instanceMatrix.array.set(mm.elements,i*16);return this;}setColorAt(){if(!this.instanceColor)this.instanceColor={needsUpdate:false};return this;}},');
const umOld='updateMatrix(){}';
if(!s.includes(umOld)) throw new Error('updateMatrix anchor not found');
s=s.replace(umOld,'updateMatrix(){const e=this.matrix.elements||(this.matrix.elements=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]));e[12]=this.position.x;e[13]=this.position.y;e[14]=this.position.z;return this;}');
const m4Old='Matrix4:class{compose(){return this;}makeRotationFromEuler(){return this;}makeScale(){return this;}},';
if(!s.includes(m4Old)) throw new Error('Matrix4 anchor not found');
s=s.replace(m4Old,'Matrix4:class{constructor(){this.elements=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);}compose(p){const e=this.elements;if(p&&p.x!==undefined){e[12]=p.x;e[13]=p.y;e[14]=p.z;}return this;}makeScale(x,y,z){const e=this.elements;e.fill(0);e[0]=x;e[5]=y;e[10]=z;e[15]=1;return this;}makeRotationFromEuler(){return this;}identity(){return this;}},');
{
const anchor='sandbox.window=window;';
if(!s.includes(anchor)) throw new Error('sandbox anchor not found');
s=s.replace(anchor,anchor+'\nsandbox.CANNON=window.CANNON;');
}
const cOld=/CANNON:\{Body:class\{constructor\(o\)\{Object.assign\(this,o\|\|\{\}\);\}\},World:class\{add\(\)\{this.bodies=this.bodies\|\|\[\];\}\},Box:class\{constructor\(v\)\{this.v=v;\}\},Sphere:class\{\},Vec3:V3,Material:class\{\},ContactMaterial:class\{\}\},/;
if(!cOld.test(s)) throw new Error('CANNON anchor not found');
s=s.replace(cOld,'CANNON:{Body:class{constructor(o){Object.assign(this,o||{});this.position=new V3();this.velocity=new V3();this.angularVelocity=new V3();this.shapes=[];this.quaternion={setFromEuler(){return this;},set(){return this;}};}addShape(sh){this.shapes.push(sh);return this;}},World:class{constructor(){this.bodies=[];this.constraints=[];this.gravity=new V3();this.solver={iterations:0};}add(b){this.bodies.push(b);}addBody(b){this.bodies.push(b);}removeBody(b){const i=this.bodies.indexOf(b);if(i>=0)this.bodies.splice(i,1);}addConstraint(){}removeConstraint(){}},NaiveBroadphase:class{},Box:class{constructor(v){this.v=v;}},Sphere:class{constructor(r){this.r=r;}},Vec3:V3,PointToPointConstraint:class{},Material:class{},ContactMaterial:class{}},');
s=s.replace('remove(m){const i=this.children.indexOf(m);if(i>=0)this.children.splice(i,1);}','remove(m){const i=this.children.indexOf(m);if(i>=0){this.children.splice(i,1);m.parent=null;}}');
const cut=s.indexOf('const idx=process.argv[2]');
if(cut<0) throw new Error('tail marker not found');
s=s.slice(0,cut);
s+=fs.readFileSync(path.join(__dirname,'verify-sink.body'),'utf8');
fs.writeFileSync(path.join(__dirname,'verify-sink.js'),s);
console.log('verify-sink.js generated');
