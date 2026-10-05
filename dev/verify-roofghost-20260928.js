// ─────────────────────────────────────────────
// dev/verify-roofghost-20260928.js —— 2026-09-28C 批独立验收:
//   ① 屋顶永久化 (用户裁定「不可破坏建筑的房顶也改为不可破坏」): pitchedRoof 无可毁承重墙 (未传 wallGs)
//      ⇒ 屋盖不再拿血量/不再挂 roof 标记, 整片按 B5 永久件档提亮; 有 wallGs 的房子照旧可塌 (阴性对照)。
//   ② 幽灵坦克开火静音 (用户裁定「开火没有音效」): fireCannon/firePlayerMG 零发声, 弹丸照常出膛;
//      阴性对照 = 真坦克 fireCannon 必须发声 (证明计数钩子没空转)。
//   ③ 幽灵坦克越野 (用户裁定「不被普通坦克能碾的东西阻挡」): crush 掩体整类穿越 (且**不被碾毁** ——
//      幽灵不破坏世界); 阴性对照 = 高永久墙 / dGroup 城墙仍然挡车 (证明放行没有放大成"穿一切")。
//
// 全部真启动沙箱 (与 verify-20260921B-speed.js 同一装法); 用法: node dev/verify-roofghost-20260928.js
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
let checks=0,failures=0;
const chk=(c,m)=>{ checks++; console.log((c?'  ✓ ':'  ✗ ')+m); if(!c) failures++; };

const {sandbox,document,window:winStub}=require('./_bootstub.js');
const V3c=sandbox.THREE.Vector3;
V3c.prototype.addScalar=function(s){ this.x+=s; this.y+=s; this.z+=s; return this; };
V3c.prototype.divideScalar=function(s){ s=s||1; this.x/=s; this.y/=s; this.z/=s; return this; };
for(const k of ['MeshLambertMaterial','MeshBasicMaterial','MeshStandardMaterial','MeshPhongMaterial','PointsMaterial','SpriteMaterial']){
	const C=sandbox.THREE[k];
	if(!C||!C.prototype) continue;
	if(!C.prototype.clone) C.prototype.clone=function(){ return new C(Object.assign({},this,{color:this.color})); };
	if(!C.prototype.dispose) C.prototype.dispose=function(){};
}
const AP=()=>({value:0,setValueAtTime(){},setTargetAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}});
class ACStub{
	createOscillator(){ return {frequency:AP(),detune:AP(),type:'',start(){},stop(){},connect(){},onended:null}; }
	createGain(){ return {gain:AP(),connect(){},disconnect(){}}; }
	createBuffer(){ return {getChannelData:()=>new Float32Array(16),duration:1,numberOfChannels:1}; }
	createBufferSource(){ return {buffer:null,loop:false,playbackRate:AP(),start(){},stop(){},connect(){},onended:null}; }
	createBiquadFilter(){ return {type:'',frequency:AP(),detune:AP(),Q:AP(),connect(){}}; }
	createDynamicsCompressor(){ return {threshold:AP(),ratio:AP(),attack:AP(),release:AP(),connect(){}}; }
	createStereoPanner(){ return {pan:AP(),connect(){}}; }
	resume(){ return Promise.resolve(); }
	get state(){ return 'running'; }
	get destination(){ return {}; }
	get currentTime(){ return 0; }
	get sampleRate(){ return 44100; }
}
sandbox.AudioContext=ACStub; sandbox.window.AudioContext=ACStub; sandbox.window.webkitAudioContext=ACStub;
delete sandbox.window.CANNON;
class PlaneAttr{
	constructor(gx,gy,w,h){ this.count=gx*gy; this.itemSize=3; this.array=new Float32Array(gx*gy*3); this._gx=gx; this._gy=gy; this._w=w; this._h=h; }
	getX(i){ return ((i%this._gx)/this._gx-0.5)*this._w; }
	getZ(i){ return (Math.floor(i/this._gx)/this._gy-0.5)*this._h; }
	getY(i){ return this.array[i*3+1]; }
	setX(i,v){ this.array[i*3]=v; } setY(i,v){ this.array[i*3+1]=v; } setZ(i,v){ this.array[i*3+2]=v; }
}
class PlaneGeoFix extends sandbox.THREE.BufferGeometry{
	constructor(w=1,h=1,sg=1,sh=1){ super(w,h); const gx=Math.max(1,sg|0)+1, gy=Math.max(1,sh|0)+1;
		this.parameters={width:w,height:h,widthSegments:gx-1,heightSegments:gy-1};
		this.attributes.position=new PlaneAttr(gx,gy,w,h); }
}
sandbox.THREE.PlaneGeometry=PlaneGeoFix;
function scriptList(){
	const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
	const out=[]; const re=/<script src="(js\/[^"?]+)/g; let m;
	while((m=re.exec(html))) out.push(m[1]);
	return out;
}
const FILES=scriptList();
function mulberry32(a){ return function(){ a|=0; a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }
function bootIdx(campIdx){
	const ctx=vm.createContext(Object.assign({},sandbox));
	ctx.document=document; ctx.window=winStub; ctx.globalThis=ctx;
	const M=Object.create(Math); M.random=mulberry32(42); ctx.Math=M;
	ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
	ctx.console={log(){},warn(){},error(){}};
	for(const f of FILES) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
	return ctx;
}
function idxOf(id){
	const ctx=vm.createContext(Object.assign({},sandbox));
	ctx.document=document; ctx.window=winStub; ctx.globalThis=ctx;
	ctx.localStorage={_s:{},getItem:()=>null,setItem(){},removeItem(){}};
	ctx.console={log(){},warn(){},error(){}};
	vm.runInContext(fs.readFileSync(path.join(root,'js/00-config.js'),'utf8'),ctx,{filename:'00-config.js'});
	return vm.runInContext(`CAMPAIGNS.findIndex(c=>c.id==='${id}')`,ctx);
}
console.log('═══ 2026-09-28C 批: 屋顶永久化 + 幽灵坦克静音/越野 · 独立验收 ═══');
console.log('   脚本表 ' + FILES.length + ' 个');

// ══════ ① 屋顶永久化 (诺曼底: 教堂+谷仓 = "墙打不烂"的房子; 柏林: 防空塔 = 可毁承重链阴性对照) ══════
const IDX_NORM=idxOf('normandy'), IDX_BER=idxOf('berlin');
const ctxN=bootIdx(IDX_NORM), runN=c=>vm.runInContext(c,ctxN);
const ctxB=bootIdx(IDX_BER), runB=c=>vm.runInContext(c,ctxB);
console.log('\n① 屋顶永久化 (真启动: 诺曼底 + 柏林):');
// 全局不变量 (柏林): 挂 roof 标记的碰撞盒必属"有血量 + 有可毁承重墙"的 ref —— 永久屋盖绝不入册
const scanB=runB(`(()=>{
	const out={roofBoxes:0,badHp:0,badCarry:0,refs:new Set()};
	for(const b of BOXES){
		if(b.dead||!b.roof) continue;
		out.roofBoxes++; out.refs.add(b.roof);
		if(!(b.roof.hp>0)) out.badHp++;
		if(!b.roof.carry||!b.roof.carry.length) out.badCarry++;
	}
	out.refs=undefined;
	return out;
})()`);
chk(scanB.roofBoxes>0, '①-0a 柏林全图存在挂 roof 标记的屋盖碰撞盒 ('+scanB.roofBoxes+' 个) —— 判据非空转');
chk(scanB.badHp===0&&scanB.badCarry===0, '①-0b 柏林: 每个 roof ref 都有 hp>0 且 carry(可毁承重墙)非空 (badHp='+scanB.badHp+' badCarry='+scanB.badCarry+')');
// 诺曼底: 教堂/谷仓足迹上层区 (minY > floor+4) —— 旧版这里有挂 roof 的碰撞带 (轰几炮顶先塌)
const zoneScan=regType=>`(()=>{
	const reg=BUILD_REG.find(r=>r.type==='${regType}');
	if(!reg) return {found:false};
	const out={found:true,roofInZone:0,permInZone:0};
	const mx=reg.w/2+2, mz=reg.d/2+2;
	for(const b of BOXES){
		if(b.dead) continue;
		if(b.minX>reg.x+mx||b.maxX<reg.x-mx||b.minZ>reg.z+mz||b.maxZ<reg.z-mz) continue;
		if(!(b.minY>reg.floor+4)) continue;
		if(b.roof) out.roofInZone++;
		if(b.perm) out.permInZone++;
	}
	return out;
})()`;
const ch=runN(zoneScan('church'));
chk(ch.found, '①-1a 诺曼底建有教堂 (BUILD_REG type=church)');
chk(ch.roofInZone===0, '①-1b 教堂足迹上层区 0 个挂 roof 的碰撞盒 (旧版>0: 墙打不烂、顶先塌) ');
chk(ch.permInZone>=4, '①-1c 教堂屋盖已按 B5 永久件档整片预标 (上层区 perm 盒 '+ch.permInZone+' 个 ≥4; 提亮已按 2026-09-28 裁定取消, 只留标记)');
const ba=runN(zoneScan('barn'));
chk(ba.found, '①-2a 诺曼底建有谷仓 (BUILD_REG type=barn)');
chk(ba.roofInZone===0&&ba.permInZone>=4, '①-2b 谷仓同口径: 上层区 roof 盒 0 个 + perm 盒 '+ba.permInZone+' 个 ≥4');
// 阴性对照 (诺曼底): 全图"可毁屋盖"总量在 05-world 改动前后都应 >0 —— 教堂/谷仓退出承伤链, 可毁房没有
const scanN=runN(`(()=>{
	let n=0, badHp=0;
	for(const b of BOXES){ if(b.dead||!b.roof) continue; n++; if(!(b.roof.hp>0)) badHp++; }
	return {n,badHp};
})()`);
chk(scanN.n>0, '①-3a 诺曼底仍有 '+scanN.n+' 个可毁屋盖盒 (可毁房的承伤链没有误伤)');
chk(scanN.badHp===0, '①-3b 诺曼底: 每个 roof ref 都有 hp>0');
chk(runN('typeof markPermPieces==="function" && markPermPieces()>=0')===true, '①-4 markPermPieces 二次幂等 (perm 预标件跳过, 不二次漂白)');

// ══════ ② 幽灵坦克开火静音 + ③ 越野穿越 (塔拉瓦) ══════
const ctxI=bootIdx(idxOf('island'));
winStub.RGRID_OFF=true; // 注入式夹具走全量回退路径 (RGRID 索引不认识运行期push的盒子)
const runI=c=>vm.runInContext(c,ctxI);
console.log('\n② 幽灵坦克开火静音 (真启动: 塔拉瓦; AudioSys 打计数钩):');
runI(`
	(()=>{
		globalThis.__snd={cannon:0,gunshot:0,fb:0};
		AudioSys.cannon=(d)=>{ __snd.cannon++; };
		AudioSys.gunshot=(k,d,p)=>{ __snd.gunshot++; };
		const _fb=fireBullet; // 机枪是即时命中射线 (不进 shells): 钩 fireBullet 证明"弹照打"
		fireBullet=(...a)=>{ __snd.fb++; return _fb(...a); };
		globalThis.__sh0=shells.length;
		const g=specVehGet();
		g.alive=true; g.spawned=true; g.cannonCd=0; g.mgT=0;
		g.fireCannon(V3(0,0.05,1).normalize());
		globalThis.__afterCannon=shells.length;
		g.firePlayerMG(V3(0,0.05,1).normalize());
	})();
`);
const snd=runI('({c:__snd.cannon,gs:__snd.gunshot,fb:__snd.fb,sh0:__sh0,sh1:shells.length})');
chk(snd.c===0, '②-1 幽灵坦克主炮开火 0 声炮响 (AudioSys.cannon 计数 = '+snd.c+')');
chk(snd.gs===0, '②-2 幽灵坦克同轴机枪 0 声枪响 (AudioSys.gunshot 计数 = '+snd.gs+')');
chk(snd.sh1===snd.sh0+1, '②-3a 静音不改观感: 主炮弹丸照常出膛 (shells '+snd.sh0+'→'+snd.sh1+')');
chk(snd.fb>=1, '②-3b 机枪弹照常出膛 (fireBullet 计数 = '+snd.fb+'; 即时命中射线, 无弹体可数)');
runI(`
	(()=>{
		const tk=new Tank(0,0); tk.pos.set(0,heightAt(0,0),0); tk.cannonCd=0; tk.isAI=false;
		tk.crewBot={isBot:true,team:0,_src:'verify'};
		tk.fireCannon(V3(0,0.05,1).normalize());
	})();
`);
const snd2=runI('__snd.cannon');
chk(snd2>=1, '②-4 阴性对照: 真坦克 fireCannon 发声 (cannon 计数 = '+snd2+') —— 钩子没空转');

console.log('\n③ 幽灵坦克越野穿越 (crush 掩体放行; 高墙/dGroup 仍阻挡):');
const driveFixture=runI(`
	globalThis.__fx=(()=>{
		// 挑净空平地 (探针卫生: 别在出生点贴着工事测): 干地 + 坡缓 + **行驶走廊** (z-8→z+6, |dx|≤2.5) 净空。
		// "净空"按幽灵**自己的阻挡口径**算: 会挡车的只有 高圆柱(r≥0.3 且高>TANK_STEP) / dGroup 城墙 /
		// 高>TANK_STEP 的非 crush 盒 —— 低矮件与 crush 件本来就是本批放行的对象, 不算阻挡。
		let best=null, dry=0;
		for(let x=-150;x<=150&&!best;x+=7) for(let z=-150;z<=150;z+=7){
			const h=heightAt(x,z);
			if(!(h>waterYAt(x,z)+0.4)) continue;
			dry++;
			let mx=0;
			for(const [dx,dz] of [[-5,-5],[5,-5],[-5,5],[5,5]]) mx=Math.max(mx,Math.abs(heightAt(x+dx,z+dz)-h));
			if(mx>1.2) continue;
			let blocked=false;
			for(let t=-8;t<=6&&!blocked;t+=1){
				const px=x, pz=z+t;
				// ★ eachBoxNear/eachCylNear 的全量回退分支不做区域预筛 (回调自筛, 与 15c/15-vehicles 同法)
				eachBoxNear(px-2.5,pz-2.5,px+2.5,pz+2.5,b=>{
					if(b.dead||b.maxX<px-2.5||b.minX>px+2.5||b.maxZ<pz-2.5||b.minZ>pz+2.5) return;
					if(b.crush) return;
					if((b.dGroup&&!b.dGroup.dead)||(b.maxY-b.gh)>TANK_STEP) blocked=true;
				});
				eachCylNear(px-2.5,pz-2.5,px+2.5,pz+2.5,c=>{
					if(c.x===undefined) return;
					if(Math.abs(c.x-px)>2.5+c.r||Math.abs(c.z-pz)>2.5+c.r) return;
					if(c.r>=0.3&&c.y1-c.y0>TANK_STEP) blocked=true;
				});
			}
			if(!blocked){ best={x,z,h}; break; }
		}
		globalThis.__fxDry=dry;
		return best;
	})();
	__fx
`);
chk(!!driveFixture, '③-0 找到净空平地夹具 '+(driveFixture?('@('+driveFixture.x+','+driveFixture.z+')'):''));
function driveCase(name, boxProps, expectPass){
	const r=runI(`
		(()=>{
			const f=__fx, x=f.x, z=f.z, h=f.h;
			const box=Object.assign({minX:x-3,maxX:x+3,minZ:z+0.2,maxZ:z+1.4,minY:h,maxY:h+3,gh:h,dead:false}, ${JSON.stringify(boxProps)});
			BOXES.push(box);
			const g=specVehGet();
			g.alive=true; g.spawned=true; g.playerDriven=false;
			g.pos.set(x,h,z-7); g.yaw=0; g.vel=10; g.turretYaw=0; g.turretPitch=0;
			for(let i=0;i<150;i++) g.update(1/60);
			const out={zFinal:g.pos.z, zPass:z+3.5, zWall:z+2.5, boxDead:!!box.dead, boxIn:BOXES.indexOf(box)>=0};
			BOXES.splice(BOXES.indexOf(box),1); // 摘除夹具, 不污染下一案
			return out;
		})()
	`);
	if(expectPass){
		chk(r.zFinal>r.zPass, '③ '+name+': 幽灵穿过去了 (末位 z='+r.zFinal.toFixed(2)+' > 界 '+r.zPass.toFixed(2)+')');
		chk(!r.boxDead, '③ '+name+': 掩体原样留存 (幽灵是"穿过去"不是"碾过去", boxDead='+r.boxDead+')');
	}else{
		chk(r.zFinal<r.zWall, '③ '+name+': 幽灵仍被挡住 (末位 z='+r.zFinal.toFixed(2)+' < 界 '+r.zWall.toFixed(2)+')');
	}
}
driveCase('③-a crush 掩体 3m (树篱/高掩体类: 放行与高度无关)', {crush:true}, true);
// 1.1m 沙袋类专案 (普通坦克 speed>1.5 才能碾的那一档):
const rCrush=runI(`
	(()=>{
		const f=__fx, x=f.x, z=f.z, h=f.h;
		const box={minX:x-3,maxX:x+3,minZ:z+0.2,maxZ:z+1.4,minY:h,maxY:h+1.1,gh:h,dead:false,crush:true};
		BOXES.push(box);
		const g=specVehGet();
		g.alive=true; g.spawned=true; g.playerDriven=false;
		g.pos.set(x,h,z-7); g.yaw=0; g.vel=10;
		for(let i=0;i<150;i++) g.update(1/60);
		const out={zFinal:g.pos.z, boxDead:!!box.dead};
		BOXES.splice(BOXES.indexOf(box),1);
		return out;
	})()
`);
chk(rCrush.zFinal>driveFixture.z+3.5, '③-crush 1.1m crush 掩体: 穿过去 (末位 z='+rCrush.zFinal.toFixed(2)+')');
chk(!rCrush.boxDead, '③-crush 且掩体不被碾毁 (boxDead='+rCrush.boxDead+')');
driveCase('③-b 高 3m 永久墙 (无 crush/无 dGroup)', {crush:false}, false);
driveCase('③-c 高 3m dGroup 城墙段', {crush:false,dGroup:{dead:false,hp:800}}, false);

console.log('\n═══ 合计: '+(checks-failures)+'/'+checks+' 项通过 ═══');
if(failures){ console.log('✘ 未通过 '+failures+' 项'); process.exitCode=1; } else console.log('✔ 全部通过');
