// ─────────────────────────────────────────────
// dev/probe-metro.js —— 柏林地铁网探针 (不进 Index.html)
// 用法: node dev/probe-metro.js
// 原理: 复用 probe-bots 桩 (THREE/DOM/WebAudio), 加载全部真实脚本并进入柏林战场, 检查:
//   ① 两站一区间几何: 坑底/地面/下沉量/站间距 (config.metro.halls/tunnel 驱动)
//   ② 隧道全程下沉 + 顶板 = 街面 (坦克/步兵照常过街)
//   ③ Bot 寻路连通: 北站厅 ↔ 南站厅 地下穿行 (NAV.findPath 路径穿过隧道区), 地面 ↔ 站厅
//   ④ 塔顶高炮登记 (FLAK_DECKS → AAGUNS yDeck)
// 判据: 任一硬断言失败 → 退出码 1 (供全量回归脚本串联)。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const src=fs.readFileSync(path.join(__dirname,'probe-bots.js'),'utf8');
const cut=src.indexOf('// ── 全战役乱斗推演 ──');
if(cut<0){ console.error('probe-bots harness cut not found'); process.exit(1); }
eval(src.slice(0,cut)+'\n;globalThis.__probe={boot};');
const ctx=globalThis.__probe.boot(2); // 柏林

const r=vm.runInContext(`(()=>{
const M=CITY.metro, HS=M.halls, T=M.tunnel;
const out={halls:[],tunnel:{},nav:{},flak:{}};
for(const A of HS){
const cx=(A.x0+A.x1)/2, cz=(A.z0+A.z1)/2;
out.halls.push({c:[+cx.toFixed(1),+cz.toFixed(1)],floor:+heightAt(cx,cz).toFixed(2),
out:+heightAt(A.x0-4,cz).toFixed(2),sink:+(heightAt(A.x0-4,cz)-heightAt(cx,cz)).toFixed(2),stair:A.stair,roof:A.roof});
}
const tx=(T.x0+T.x1)/2;
out.tunnel={z:[T.z0,T.z1],len:T.z1-T.z0,y0:+heightAt(tx,T.z0+3).toFixed(2),yMid:+heightAt(tx,(T.z0+T.z1)/2).toFixed(2),
y1:+heightAt(tx,T.z1-3).toFixed(2),nat0:+heightAt(T.x0-8,T.z0+3).toFixed(2),natMid:+heightAt(T.x0-8,(T.z0+T.z1)/2).toFixed(2)};
const hc=HS.map(A=>[(A.x0+A.x1)/2,(A.z0+A.z1)/2]);
out.gap=+Math.hypot(hc[0][0]-hc[1][0],hc[0][1]-hc[1][1]).toFixed(1);
// Bot 寻路: 入口亭 ↔ 入口亭 (必须走地下), 以及 站厅 ↔ 站厅
const thru=p=>!!p&&p.some(q=>Math.abs(q[0]+65)<4.5&&q[1]<12&&q[1]>-68);
const pA=NAV.findPath(-55,32.5,-41.6,-79), pB=NAV.findPath(-41.6,-79,-55,32.5), pC=NAV.findPath(-55,23,-55,-79);
out.nav.A2B=pA?pA.length:null; out.nav.A2B_under=thru(pA);
out.nav.B2A=pB?pB.length:null; out.nav.B2A_under=thru(pB);
out.nav.hall2hall=pC?pC.length:null; out.nav.hall2hall_under=thru(pC);
// 地面 → 北站厅 (经梯道)
const pD=NAV.findPath(-55,32.5,-55,25);
out.nav.topToHall=pD?pD.length:null;
// 站厅/隧道矩形内不得落道具 (freeSpot 让位; 落进去会沉入坑底)
let propsIn=0;
for(const p of PROPS){ for(const s of METRO_RECTS){ if(p.x>s.x0&&p.x<s.x1&&p.z>s.z0&&p.z<s.z1){ propsIn++; break; } } }
out.propsIn=propsIn;
out.flak.decks=(typeof FLAK_DECKS!=='undefined')?FLAK_DECKS.map(d=>[+d.x.toFixed(1),+d.z.toFixed(1),+d.y.toFixed(2)]):null;
out.flak.guns=(typeof AAGUNS!=='undefined')?AAGUNS.filter(g=>g.y>5).map(g=>[+g.x.toFixed(1),+g.z.toFixed(1),+g.y.toFixed(2)]):null;
return out;
})()`,ctx);

const errs=[];
const L=(k,v)=>console.log(`  ${k}: ${v}`);
console.log('== 柏林地铁网探针 ==');
L('站厅', r.halls.map((h,i)=>`#${i+1}@(${h.c[0]},${h.c[1]}) 坑底${h.floor} 庭外${h.out} 下沉${h.sink} 梯道${h.stair}/顶板${h.roof}`).join('  |  '));
L('站间距', r.gap+'m');
L('隧道', `z ${r.tunnel.z[0]}..${r.tunnel.z[1]} (${r.tunnel.len}m) 坑底 ${r.tunnel.y0}/${r.tunnel.yMid}/${r.tunnel.y1} 街面 ${r.tunnel.nat0}/${r.tunnel.natMid}`);
L('寻路 北亭→南亭', `${r.nav.A2B} 点 地下穿行=${r.nav.A2B_under}`);
L('寻路 南亭→北亭', `${r.nav.B2A} 点 地下穿行=${r.nav.B2A_under}`);
L('寻路 站厅↔站厅', `${r.nav.hall2hall} 点 地下穿行=${r.nav.hall2hall_under}`);
L('寻路 地面→站厅', `${r.nav.topToHall} 点`);
L('站内道具', r.propsIn+' 件 (应为 0)');
L('塔顶平台', JSON.stringify(r.flak.decks));
L('高炮(y>5)', JSON.stringify(r.flak.guns));

if(r.halls.length<2) errs.push(`地铁站 ${r.halls.length}<2`);
for(const [i,h] of r.halls.entries()){
if(h.sink<2.0) errs.push(`站厅${i+1}下沉 ${h.sink}<2.0`);
}
if(r.gap<60) errs.push(`站间距 ${r.gap}<60`);
for(const k of ['y0','yMid','y1']){
const nat=k==='y1'?r.tunnel.natMid:(k==='yMid'?r.tunnel.natMid:r.tunnel.nat0);
if(nat-r.tunnel[k]<2.0) errs.push(`隧道 ${k} 下沉不足 (${r.tunnel[k]} vs ${nat})`);
}
if(!r.nav.A2B_under) errs.push('Bot 无法从北站厅地下穿行到南站厅 (寻路未过隧道)');
if(!r.nav.B2A_under) errs.push('Bot 无法从南站厅地下穿行到北站厅 (寻路未过隧道)');
if(!r.nav.hall2hall_under) errs.push('站厅↔站厅 寻路未过隧道');
if(!r.nav.topToHall) errs.push('地面 → 站厅 寻路失败');
if(r.propsIn>0) errs.push(`站厅/隧道矩形内落了 ${r.propsIn} 件道具 (freeSpot 让位失效)`);
if(!r.flak.decks||!r.flak.decks.length) errs.push('FLAK_DECKS 空');
if(!r.flak.guns||!r.flak.guns.length) errs.push('塔顶高炮未登记 (AAGUNS y>5 空)');
if(errs.length){ console.log('地铁探针 FAIL:\n  '+errs.join('\n  ')); process.exit(1); }
console.log('地铁探针全部通过 ✓');
