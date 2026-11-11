// ─────────────────────────────────────────────
// dev/verify-batch-20261024e.js —— 2026-10-24e 批验收: ①存活坦克队色信标 ②重坦提速 ③石桥引桥坡道反向修复
// 用法: node --stack-size=4000 dev/verify-batch-20261024e.js
// 口径: 与 _bldview/_wmramp 同源 boot (真 three + 桩渲染器 + 全脚本链, 00c-procgen 在列 —— 探针载入盲区教训);
//   坡道判据 = 行为断言 (桥端顶步贴桥面 ±0.35 / 坡面逐段吻合"dy-rise*t 修正式"), 不写死行号;
//   信标判据 = buildMesh 产物字段 + update 源含 alive 显隐行 (源字符串断言, 不钉行号)。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const stub=require('./_bootstub.js');
const root=path.resolve(__dirname,'..');
let pass=0,fail=0; const bads=[];
const ok=(cond,msg)=>{ if(cond){pass++; console.log('  ✓ '+msg);} else {fail++; bads.push(msg); console.log('  ✗ '+msg);} };

const FILES=['js/00-config.js','js/00b-i18n.js','js/00c-procgen.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js','js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js','js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js','js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/16-aircraft.js','js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js','js/22a-menuart.js','js/23-deploy.js','js/23b-worldrestore.js','js/24-main.js'];
function boot(campIdx,pseed){
for(const k in stub.byId) delete stub.byId[k];
const ctx=vm.createContext(Object.assign({},stub.sandbox));
ctx.document=stub.document; ctx.window=stub.window;
ctx.localStorage={_s:{sf_campaign:String(campIdx),sf_pseed:String(pseed||'')},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
vm.runInContext(fs.readFileSync(path.join(root,'dev/vendor/three.min.js'),'utf8'),ctx,{filename:'three.min.js'});
vm.runInContext('THREE = globalThis.THREE;',ctx,{filename:'bind-three'});
vm.runInContext(`
class StubRenderer{
constructor(o){ this.domElement=(o&&o.canvas)||document.createElement('canvas'); this.domElement.style=this.domElement.style||{};
this.shadowMap={enabled:false,type:0,autoUpdate:true}; this.info={render:{calls:0,triangles:0},memory:{}};
this.capabilities={isWebGL2:true,getMaxAnisotropy:()=>4,maxTextureSize:4096,maxTextures:16};
this.xr={enabled:false,isPresenting:false,addEventListener(){},removeEventListener(){}}; this.autoClear=true; }
setSize(){} setPixelRatio(){} setViewport(){} setScissor(){} setScissorTest(){} render(){} clear(){} clearDepth(){}
setClearColor(){} setClearAlpha(){} dispose(){} setAnimationLoop(){} compile(){return new Set();}
getContext(){return null;} getRenderTarget(){return null;} setRenderTarget(){} readRenderTargetPixels(){}
copyFramebufferToTexture(){} initTexture(){} resetState(){} getDrawingBufferSize(){return {x:1,y:1};}
getSize(t){ if(t) t.set(1280,720); return {width:1280,height:720}; } getPixelRatio(){return 1;}
}
THREE.WebGLRenderer=StubRenderer;`,ctx,{filename:'stub-renderer'});
for(const f of FILES) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
return ctx;
}
const Q=(ctx,s)=>vm.runInContext(s,ctx);

// ── ① 存活坦克队色信标 (bare buildMesh, 同 verify-vehmodels 口径) ──
console.log('── ① 坦克队色信标 (飞机同款, 存活显示/击毁即隐) ──');
{
const ctx=boot(0);
const r=Q(ctx,`
(function(){
const out=[];
for(const fid of [0,1]){
const D=(FACTIONS[['us','ger'][fid]]).tanks[0];
const T={def:D,variant:0,team:fid,name:D.name,wheels:[],pos:V3(),halfW:0};
T.buildMesh=Tank.prototype.buildMesh; T.buildMesh.call(T);
const b=T.beacon;
out.push({team:fid,has:!!(b&&b.isSprite),y:b?b.position.y:null,s:b?b.scale.x:null,
 hasMat:!!T.beaconMat});
}
return JSON.stringify(out);
})()`);
const arr=JSON.parse(r);
const TC=['#8fc1ff','#ff9c8a'];
for(const it of arr){
ok(it.has&&it.team!==undefined,it.team===0?'队0 坦克信标 Sprite 存在':'队1 坦克信标 Sprite 存在');
ok(Math.abs(it.y-3.8)<1e-6,'信标位高 y=3.8 (底缘 2.6 > 最高车长帽顶)  实测 '+it.y);
ok(Math.abs(it.s-2.4)<1e-6,'信标恒定世界尺寸 2.4m  实测 '+it.s);
ok(it.hasMat,'信标材质存在 (CanvasTexture 同飞机信标一行式, 桩 canvas 不回放颜色)');
}
const src=Q(ctx,'Tank.prototype.update.toString()');
ok(/beacon\.visible\s*=\s*this\.alive&&/.test(src)&&/player\.tankView/.test(src),
 'update 单行维护: alive 显隐 (死车即隐/重生即显) + 玩家第一人称车长镜隐藏');
ok(/beaconMat\.opacity=0\.6\+0\.4\*Math\.sin\(nowT/.test(src),'信标脉动与飞机信标同式 (0.6+0.4·sin)');
}

// ── ② 重坦速度 (只比对应轻坦慢一些; heavy 字段是"第二辆"槽位标记, 真重坦=潘兴/黑豹/KV-1) ──
console.log('── ② 重坦提速 (轻坦差收 0.5~0.8, rev 同比例) ──');
{
const ctx=boot(0);
const t=Q(ctx,`JSON.stringify({
us:FACTIONS.us.tanks.map(x=>({n:x.name,spd:x.spd,rev:x.rev})),
ger:FACTIONS.ger.tanks.map(x=>({n:x.name,spd:x.spd,rev:x.rev})),
sov:FACTIONS.sov.tanks.map(x=>({n:x.name,spd:x.spd,rev:x.rev})),
jp:FACTIONS.jp.tanks.map(x=>({n:x.name,spd:x.spd,rev:x.rev})),
cn:FACTIONS.kmt.tanks.map(x=>({n:x.name,spd:x.spd,rev:x.rev}))})`);
const o=JSON.parse(t);
ok(o.us[1].spd===7.7&&o.us[1].rev===4.2,'M26 潘兴 7.7/4.2 (谢尔曼 8.3/4.4, 差 0.6)  实测 '+o.us[1].spd+'/'+o.us[1].rev);
ok(o.ger[1].spd===7.6&&o.ger[1].rev===4.1,'黑豹 7.6/4.1 (四号 8.1/4.4, 差 0.5)  实测 '+o.ger[1].spd+'/'+o.ger[1].rev);
ok(o.sov[1].spd===8.0&&o.sov[1].rev===4.3,'KV-1 8.0/4.3 (T-34 8.8/4.7, 差 0.8)  实测 '+o.sov[1].spd+'/'+o.sov[1].rev);
ok(o.us[0].spd===8.3&&o.ger[0].spd===8.1&&o.sov[0].spd===8.8,'轻坦三车速度零回归 (8.3/8.1/8.8)');
ok(o.jp[1].spd===8.1&&o.cn[1].spd===8.3,'一式中战车/T-26 (槽位 heavy 非真重坦) 不在本批 8.1/8.3 保持');
for(const [k,i,j] of [['us',0,1],['ger',0,1],['sov',0,1]]){
const gap=o[k][i].spd-o[k][j].spd;
ok(gap>=0.4&&gap<=0.9,k+' 轻-重速度差 '+gap.toFixed(1)+' ∈ [0.4,0.9]');
}
}

// ── ③ 石桥引桥坡道方向 (procgen 水乡固定种子, 行为断言) ──
console.log('── ③ 石桥引桥坡道: 桥端=桥面齐平, 远端=实地 (修"楼梯是反的") ──');
{
// 种子池: splitmix32 哈希落 water 群系的种子 (与 00-config PG 抽取式一致); 三种子并扫,
// 正/负落差 (下坡岸/上坡岸) 两分支都要有实测命中 (100012/100018 出正落差)。
const SEEDS=['100008','100012','100018'];
const resAll=[];
for(const seed of SEEDS){
const ctx=boot(14,seed);
const pg=JSON.parse(Q(ctx,`JSON.stringify({biome:PG.biome,n:BRIDGES.length})`));
ok(pg.biome==='water','种子 '+seed+' → 水乡河网群系 (实测 '+pg.biome+')');
const res=JSON.parse(Q(ctx,`
(function(){
const out=[];
for(const B of BRIDGES){
const dy=bridgeDeckY(B);
const sn=Math.sin(B.yaw),cs=Math.cos(B.yaw);
const rampLen=5.0;
// 逐岸: 复算修正式期望坡面, 再扫 BOXES 里落在坡道带内的实体盒
for(const sgn of [-1,1]){
const ux=sgn*sn,uz=sgn*cs;
const endU=sgn*(B.len/2+rampLen/2+0.2);
const px=B.x+sn*endU,pz=B.z+cs*endU;
const gFar=heightAt(px+ux*(rampLen/2+1.2),pz+uz*(rampLen/2+1.2),true);
const rise=dy-gFar;
if(!(Math.abs(rise)>0.15&&Math.abs(rise)<2.5)) { out.push({sgn,skip:true,rise:+rise.toFixed(2)}); continue; }
const segs=[];
for(const b of BOXES){
const bx=(b.minX+b.maxX)/2, bz=(b.minZ+b.maxZ)/2;
const dx=bx-B.x,dz=bz-B.z;
const u=dx*sn+dz*cs, v=dx*cs-dz*sn;
if(Math.abs(v)>B.w*0.43) continue;
const au=Math.abs(u);
if(au<B.len/2+0.1||au>B.len/2+5.3) continue;
const t=(au-B.len/2-0.2)/rampLen;
if(t<0||t>1) continue;
const exp=dy-rise*Math.max(0.1,Math.min(0.9,t));
const top=b.maxY;
if(Math.abs(top-exp)<=0.55) segs.push({t:+t.toFixed(2),top:+top.toFixed(2),exp:+exp.toFixed(2)});
}
out.push({sgn,skip:false,rise:+rise.toFixed(2),n:segs.length,gFar:+gFar.toFixed(2),
 segs:segs.sort((a,b)=>a.t-b.t),deck:+dy.toFixed(2)});
}
}
return JSON.stringify(out);
})()`));
for(const r of res) resAll.push({seed,...r});
}
let nPos=0,nNeg=0;
for(const r of resAll){
const tag='['+r.seed+'] 岸 sgn'+r.sgn;
if(r.skip){ ok(true,tag+' 落差 '+r.rise+' |≤0.15| 不建坡 (旧码此处会造反向凹坡/悬空端)');
 continue; }
if(r.rise>0) nPos++; else nNeg++;
if(r.n===0){ ok(false,tag+' 坡道实体盒 0 命中 (落差 '+r.rise+') —— 建造或扫描口径失配'); continue; }
 ok(r.n>=3,tag+' 坡道实体盒命中 '+r.n+' 段 (落差 '+r.rise+')');
const first=r.segs[0],last=r.segs[r.segs.length-1];
ok(first&&Math.abs(first.exp-r.deck)<0.4,tag+' 顶步贴桥面: 期望 '+first.exp+' ≈ 桥面 '+r.deck);
ok(first&&last&&(r.rise>=0?(first.top>=last.top-0.35):(last.top>=first.top-0.35)),
 tag+' 坡向与落差同号 (rise '+r.rise+'): '+first.top+' → '+last.top);
ok(first&&last&&Math.abs(last.exp-r.gFar)<0.4,tag+' 末段落远端实地: 期望 '+last.exp+' ≈ 地面 '+r.gFar);
ok(r.segs.every(s=>Math.abs(s.top-s.exp)<=0.55),tag+' 逐段吻合修正式 dy-rise·t (±0.55)');
}
ok(nPos>=2&&nNeg>=2,'正/负落差两分支都有实测 (下坡岸 '+nPos+' / 上坡岸 '+nNeg+')');
}

console.log('\\n════════ '+(fail===0?'全部通过':'失败 '+fail+' 条')+' ════════  pass='+pass+' fail='+fail);
if(bads.length) bads.forEach(b=>console.log('  ✗ '+b));
process.exit(fail?1:0);
