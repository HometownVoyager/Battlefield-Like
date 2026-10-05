// dev/_tankspawn-probe.js —— 坦克开局落位诊断 (临时探针, 只读)
//   问三件事: ①落点是否在占用格/建筑足迹/水里 ②落点坡度是否超出 TANK_SLOPE_MAX 的物理包线
//   ③车头朝向与"敌基地方向"的夹角 (出生即朝图外/横着站的定量证据)
// 用法: node dev/_tankspawn-probe.js [战役序号...]   (缺省 1 2 6 11)
'use strict';
const fs=require('fs'),path=require('path');
const probeSrc=fs.readFileSync(path.join(__dirname,'probe-spawn.js'),'utf8');
const cut=probeSrc.indexOf('const REPORT_FN=');
const head=probeSrc.slice(0,cut);
const tail=`
const idxs=(process.argv.slice(2).length?process.argv.slice(2):['1','2','6','11']).map(Number);
for(const ci of idxs){
const ctx=boot(ci,42);
vm.runInContext("(()=>{const b=document.getElementById('startBtn'); if(b&&b.onclick) b.onclick();})()",ctx);
const out=vm.runInContext(\`(()=>{
const rows=[];
rows.push('=== cam='+CAMPAIGN.id+' terr='+CAMPAIGN.terr+' 图='+MAP_SIZE+' 坦克数='+tanks.length+' ===');
for(const t of tanks){
const x=t.pos.x,z=t.pos.z;
const occ=occBlocked(x,z);
const ft=B_FOOT.filter(f=>{
const dx=x-f.x,dz=z-f.z;
const lx=dx*f.cs? 0:0;
const ax=dx*Math.cos(f.ry||0)-dz*Math.sin(f.ry||0), az=dx*Math.sin(f.ry||0)+dz*Math.cos(f.ry||0);
return Math.abs(ax)<=f.hw&&Math.abs(az)<=f.hd;
}).length;
const wd=waterDepthAt(x,z);
const riv=inRiverChannel(x,z);
// 落点周围 3m 的最大坡度 (与 03-terrain moscow 陡坡口径同法: 4m 中心差分)
const s4=4;
const gx=Math.abs(heightAt(x+s4,z)-heightAt(x-s4,z))/(2*s4);
const gz=Math.abs(heightAt(x,z+s4)-heightAt(x,z-s4))/(2*s4);
const slp=Math.atan(Math.max(gx,gz))*180/Math.PI;
const eb=BASES[1-t.team];
const face=Math.atan2(Math.sin(t.yaw),Math.cos(t.yaw));
const toE=eb?Math.atan2(eb.x-x,eb.z-z):0;
let dd=face-toE; while(dd>Math.PI)dd-=2*Math.PI; while(dd<-Math.PI)dd+=2*Math.PI;
// 朝前到图缘的距离
const dxf=Math.sin(t.yaw), dzf=Math.cos(t.yaw);
let edge=1e9;
if(dxf>1e-6) edge=Math.min(edge,(MAP_SIZE/2+20-x)/dxf); else if(dxf<-1e-6) edge=Math.min(edge,(-(MAP_SIZE/2+20)-x)/dxf);
if(dzf>1e-6) edge=Math.min(edge,(MAP_SIZE/2+20-z)/dzf); else if(dzf<-1e-6) edge=Math.min(edge,(-(MAP_SIZE/2+20)-z)/dzf);
let who='';
if(occ){
const hb=BOXES.filter(b=>!b.dead&&x>=b.minX&&x<=b.maxX&&z>=b.minZ&&z<=b.maxZ);
if(hb.length) who=' [盒×'+hb.length+' '+hb.slice(0,2).map(b=>'('+(b.maxX-b.minX).toFixed(1)+'×'+(b.maxY-b.minY).toFixed(1)+'×'+(b.maxZ-b.minZ).toFixed(1)+')@y'+b.minY.toFixed(1)).join(' ')+']';
let bc=null,bcd=1e9;
for(const c of CYLS){ const d=Math.hypot(x-c.x,z-c.z); if(d<bcd){bcd=d;bc=c;} }
if(bc&&bcd<bc.r+1) who+=' [圆柱 r='+bc.r.toFixed(2)+' d='+bcd.toFixed(2)+']';
const dd2=Math.hypot(x-(-285),z-0);
who+=' 距主基地'+dd2.toFixed(0)+'m';
}
rows.push('  T'+t.team+' v'+t.variant+' ('+x.toFixed(1)+','+z.toFixed(1)+') occ='+(occ?1:0)+' foot='+ft+' 水深='+(wd>-1e8?wd.toFixed(2):'-')+' 河道='+(riv?1:0)+' 坡度='+slp.toFixed(1)+'° 朝敌基地差='+(dd*180/Math.PI).toFixed(0)+'° 车头到图缘='+edge.toFixed(0)+'m'+who);
}
return rows;
})()\`,ctx);
for(const r of out) console.log(r);
}
`;
const tmp=path.join(__dirname,'_tankspawn-probe-tmp.js');
fs.writeFileSync(tmp,'// AUTO-GEN\n'+head+tail);
const {execFileSync}=require('child_process');
try{ console.log(execFileSync(process.execPath,[tmp,...process.argv.slice(2)],{encoding:'utf8',stdio:['ignore','pipe','pipe']})); }
catch(e){ console.log('ERR',e.stdout,e.stderr); }
