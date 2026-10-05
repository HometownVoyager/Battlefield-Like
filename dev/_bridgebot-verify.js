// dev/_bridgebot-verify.js —— 审计 23 判据: Bot 过桥不再穿桥落水 (2026-09-26E 水域审计批)
//   ① 口径判据 (缺陷本体): 桥面上 waterDepthAt (旧判据, 强制取河床) 必然 > SWIM_DEPTH ⇒ 旧代码判"游泳";
//      而水态单源 waterStateAt (新判据, "脚在水面之上 ⇒ dry") 必须判 dry —— 这就是"该用哪一支"的证据。
//   ② 端到端 (真跑): 把 Bot 放到桥西端、给一个桥东端的目标, 步进 900 帧:
//      旧实现会在桥面把 y 拽到桥下水面 (wy−0.95) ⇒ 永远到不了对岸; 新实现 y 全程贴在桥面, 且走到对岸。
//   ③ 阴性对照: 河心水面上的同款 Bot 必须**确实**进游泳态 (证明判据能看见"游泳"这件事, 不是恒 dry)。
// 用法: node dev/_bridgebot-verify.js [战役序号]   (缺省 7 = 胡康河谷, 主题就是大龙河巨桥)
'use strict';
const fs=require('fs'),path=require('path');
const probeSrc=fs.readFileSync(path.join(__dirname,'probe-spawn.js'),'utf8');
const cut=probeSrc.indexOf('const REPORT_FN=');
const head=probeSrc.slice(0,cut);
const tail=`
const ci=Number(process.argv[2]||7);
const ctx=boot(ci,42);
// 开局 (probe-spawn 的 boot 只建世界, 兵/Bot 在 startMatch 里生成; 用双引号避免吃掉外层模板)
const start=vm.runInContext("(()=>{try{const b=document.getElementById('startBtn'); if(b&&b.onclick){b.onclick();return 'ok';} return 'no-btn';}catch(e){return 'ERR '+String(e&&e.stack||e);}})()",ctx);
if(start!=="ok"){ console.log("  x startMatch: "+start); process.exit(1); }
const out=vm.runInContext(\`(()=>{
const rows=[];
const ok=(c,msg)=>rows.push((c?'  ✓ ':'  ✗ ')+msg);
if(typeof BRIDGES==='undefined'||!BRIDGES.length){ rows.push('  (本图无桥)'); return rows; }
const B=BRIDGES[0];
rows.push('=== cam='+CAMPAIGN.id+' 桥: '+JSON.stringify({x:B.x,z:B.z,len:B.len,kind:B.kind})+' ===');
// ① 口径判据: 桥面中心
const bx=B.x, bz=B.z;
const dep=waterDepthAt(bx,bz), ws=waterStateAt(bx,bz,heightAt(bx,bz));
ok(dep>SWIM_DEPTH, '旧判据 (waterDepthAt) 在桥面确实报"水深 '+dep.toFixed(2)+'m > SWIM_DEPTH" —— 缺陷本体成立');
ok(ws.state==='dry', '新判据 (waterStateAt) 在桥面判 '+ws.state+' (应为 dry, 脚在水面之上)');
// ② 端到端 (受控直行): 把 Bot 放在桥面中心, 沿桥轴 (sin,cos)(B.yaw) 直走 —— 走的就是 moveDir 的真实代码,
//    但不依赖寻路 (旧实现的失效点在 moveDir 的水态判定, 不在 A*)。
const byaw=(B.yaw===undefined)?0:B.yaw;
const ax=Math.sin(byaw), az=Math.cos(byaw);
const deck=heightAt(bx,bz);
const bot=soldiers.find(s=>s.team===0&&s.alive&&!s.onVehicle&&!s.inSquad)||soldiers.find(s=>s.alive);
bot.pos.set(bx,deck,bz); bot.alive=true; bot.hp=100; bot.path=null; bot.target=null; bot.unstickT=0;
const x0=bot.pos.x, z0=bot.pos.z;
let minY=1e9, maxY=-1e9, swimF=0, nan=0;
const dts=[1/60,1/30,1/20];
for(let f=0;f<480;f++){
nowT+=dts[f%3];
bot.moveDir(byaw,4.0,dts[f%3]);
if(!isFinite(bot.pos.y)) nan++;
if(onBridge(bot.pos.x,bot.pos.z)!==false&&bot.pos.y<minY) minY=bot.pos.y;   // 只在**桥面上**记 y (离开桥面后随地形下降是正常的)
if(bot.pos.y>maxY) maxY=bot.pos.y;
if(bot.swim) swimF++;
}
const adv=Math.hypot(bot.pos.x-x0,bot.pos.z-z0);
const drop=deck-minY;
// 旧实现的等价演算 (同一段代码的旧口径): 按 waterDepthAt>SWIM_DEPTH 判游泳 ⇒ 每帧把 y 拽向 max(wy-0.95, bed+0.12)
const wyB=waterYAt(bx,bz), bedB=heightAt(bx,bz,true);
const oldTarget=Math.max(wyB-FLOAT_PAD+ (FLOAT_PAD-0.95), bedB+0.12);
ok(nan===0, "端到端: 480 帧无 NaN");
ok(drop<0.6, "端到端: 沿桥轴直走时 y 全程贴在桥面 (桥面 "+deck.toFixed(2)+" 最低 "+minY.toFixed(2)+" 下坠 "+drop.toFixed(2)+"m; 旧口径每帧拽向 "+oldTarget.toFixed(2)+")");
const need=B.len*0.45;
ok(adv>need, "端到端: 沿桥轴走了桥长的一半以上 (480 帧推进 "+adv.toFixed(1)+"m, 阈值 "+need.toFixed(1)+"m = 桥长 "+B.len+"m×0.45)");
ok(swimF===0, "端到端: 全程不进游泳态 (swim 帧="+swimF+"/480)");
rows.push("    终点=("+bot.pos.x.toFixed(1)+","+bot.pos.z.toFixed(1)+") 仍在桥上="+(onBridge(bot.pos.x,bot.pos.z)!==false));
rows.push("    桥轴=("+ax.toFixed(3)+","+az.toFixed(3)+") 桥面高="+deck.toFixed(2)+" 桥下水面="+wyB.toFixed(2)+" 桥下河床="+bedB.toFixed(2)+" 桥面到河床="+(deck-bedB).toFixed(2)+"m");
// ③ 阴性对照: 河心水面上的 Bot 必须确实进游泳态
const rx=(typeof RIVER!=='undefined'&&RIVER)?RIVER.pts[1][0]:0, rz=(typeof RIVER!=='undefined'&&RIVER)?RIVER.pts[1][1]:0;
const b2=soldiers.find(s=>s!==bot&&s.alive&&!s.onVehicle);
if(b2){
b2.pos.set(rx,waterYAt(rx,rz)-FLOAT_PAD,rz); b2.alive=true; b2.hp=100; b2.path=null;
let sw2=0;
for(let f=0;f<30;f++){ nowT+=1/60; b2.update(1/60); if(b2.swim) sw2++; }
ok(sw2>0, '阴性对照: 河心水面上的 Bot 确实进游泳态 (swim 帧='+sw2+'/30) —— 判据不是恒 dry');
}
return rows;
})()\`,ctx);
for(const r of out) console.log(r);
const bad=out.filter(r=>r.indexOf('✗')>=0).length;
process.exit(bad?1:0);
`;
const tmp=path.join(__dirname,'_bridgebot-verify-tmp.js');
fs.writeFileSync(tmp,'// AUTO-GEN\n'+head+tail);
const {execFileSync}=require('child_process');
try{ console.log(execFileSync(process.execPath,[tmp,...process.argv.slice(2)],{encoding:'utf8',stdio:['ignore','pipe','pipe']})); }
catch(e){ console.log(e.stdout||''); console.log(e.stderr||''); }
