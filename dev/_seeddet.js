// dev/_seeddet.js —— 同一 ?seed=42 下世界构建是否逐位可复现 (只读)
// 判据: 两次独立 boot 的 OCC 占用格数 + 逐格哈希 + BOXES/CYLS 数必须相同 —— 若不同,
// 任何"按布局断言导航结果"的探针都是**在随机输入上做确定性断言**, 必然偶发。
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const SRC=f=>fs.readFileSync(path.join(root,f),'utf8');
const HEAD=['js/00-config.js','js/00b-i18n.js','js/01-audio.js','js/02-scene.js','js/03-terrain.js','js/04-collision.js','js/04b-fire.js',
'js/05-world.js','js/05a-buildings.js','js/05b-props.js','js/05c-layouts.js','js/06-engineering.js','js/07-nav.js','js/08-effects.js',
'js/09a-defs.js','js/09-weapons.js','js/10-viewmodel.js','js/11-soldiers.js','js/12-ragdolls.js','js/13-combat.js','js/14-bots.js',
'js/15-vehicles.js','js/15b-trucks.js','js/15c-specveh.js','js/15e-navmodels.js','js/15d-naval.js','js/15f-battery.js','js/15g-capmodels.js','js/15h-capital.js','js/16-aircraft.js',
'js/17-emplacements.js','js/18-game.js','js/19-input.js','js/20-player.js','js/20a-seats.js','js/21-match.js','js/22-hud.js',
'js/22a-menuart.js','js/23-deploy.js','js/23b-worldrestore.js','js/24-main.js'];
const {sandbox,document,window}=require('./_bootstub.js');
require('./_bootpatch.js').patch(sandbox);
const campIdx=parseInt(process.argv[2]||'8');
function boot(){
	const ctx=vm.createContext(Object.assign({},sandbox));
	ctx.document=document; ctx.window=window; ctx.globalThis=ctx;
	ctx.location={search:'?seed=42',href:'http://localhost/index.html',hostname:'localhost',protocol:'http:'};
	ctx.localStorage={_s:{sf_campaign:String(campIdx)},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}};
	ctx.console={log(){},warn(){},error(){}};
	for(const f of HEAD) vm.runInContext(SRC(f),ctx,{filename:f});
	try{ const b=document.getElementById('startBtn'); if(b&&typeof b.onclick==='function') vm.runInContext('document.getElementById("startBtn").onclick();',ctx); }catch(e){}
	return vm.runInContext(`(()=>{
	buildOccupancy();
	let h=0, n=0;
	for(let i=0;i<OCC.data.length;i++){ if(OCC.data[i]){ n++; h=(h*31+OCC.data[i]+i)|0; } }
	return {occN:OCC.N, blocked:n, hash:h, boxes:BOXES.length, cyls:CYLS.length, wires:wires.length};
	})()`,ctx);
}
const a=boot(), b=boot();
console.log(`图#${campIdx} 同一 ?seed=42 两次 boot:`);
console.log(`  #1 占用 ${a.blocked} 格 哈希 ${a.hash}  BOXES ${a.boxes} CYLS ${a.cyls} wires ${a.wires}`);
console.log(`  #2 占用 ${b.blocked} 格 哈希 ${b.hash}  BOXES ${b.boxes} CYLS ${b.cyls} wires ${b.wires}`);
const same=(a.blocked===b.blocked&&a.hash===b.hash&&a.boxes===b.boxes);
console.log(same?'  ⇒ 逐位可复现 ✓ (种子生效)':'  ⇒ **同一 seed 下世界构建不可复现** ✗ —— 布局里仍有 Math.random 路径');
process.exit(same?0:1);
