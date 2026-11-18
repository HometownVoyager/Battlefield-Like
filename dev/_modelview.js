// ─────────────────────────────────────────────
// dev/_modelview.js —— 15e-navmodels 载具模型的**离屏渲染器** (纯 Node, 无浏览器/无 WebGL)
// 用法: node dev/_modelview.js lvt kami        # 每型出一张 2×2 视图表 → dev/out/model-<key>.png
//       node dev/_modelview.js lvt SIZE=1600  # 改单视图宽度 (默认 720)
//
// 为什么自写光栅器: 本轮"模型是否像样"必须**用眼睛看**, 而用户指定不做浏览器实机验证。
//   真 three r152 在 Node 里能给出世界空间几何 (几何/矩阵是纯数学), 缺的只是把三角形画成图 ——
//   这里用扁平着色 + z-buffer + 深度/件ID 边缘描线, 件与件的**接合缝隙**在图上直接可见。
// 视图表 (四格布局固定): 左上 = 左舷侧视 (艏朝右) / 右上 = 艏向正视 / 左下 = 俯视 (艏朝上) /
//                        右下 = 前上方 3/4 透视 (与游戏内追尾视角同一象限)。
// 地面线 + 1m 刻度 (侧视图) 给出实尺: 数字即米。
// ─────────────────────────────────────────────
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),zlib=require('zlib');
const root=path.resolve(__dirname,'..');
const KEYS=process.argv.slice(2).filter(a=>!/=/.test(a));
const ARG=Object.fromEntries(process.argv.slice(2).filter(a=>/=/.test(a)).map(a=>a.split('=')));
const PW=parseInt(ARG.SIZE||'720',10), PH=Math.round(PW*0.64);

// ══════════════ 真 three.js r152 (与 index.html CDN 同版) ══════════════
function loadRealTHREE(){
	const s={console,Math,JSON,Date,String,Number,Object,Array,Set,Map,Error,TypeError,isNaN,parseFloat,parseInt,
		self:null,globalThis:null,
		window:{addEventListener(){},removeEventListener(){},devicePixelRatio:1},
		document:{createElementNS:()=>({style:{}}),createElement:()=>({style:{},getContext:()=>null})},
		navigator:{userAgent:'node'},requestAnimationFrame:()=>0,cancelAnimationFrame(){},
		performance:{now:()=>Date.now()},setTimeout:()=>0,clearTimeout(){},
		URL:{createObjectURL(){return ''},revokeObjectURL(){}},Blob:function(){},Image:function(){}};
	s.self=s; s.globalThis=s;
	const ctx=vm.createContext(s);
	vm.runInContext(fs.readFileSync(path.join(root,'dev/vendor/three.min.js'),'utf8'),ctx,{filename:'three'});
	const T=vm.runInContext('THREE',ctx);
	if(!T||!T.REVISION) throw new Error('three.min.js 未挂上 THREE');
	return T;
}
const THREE=loadRealTHREE();
// ══════════════ 沙箱: 00-config + 15e (与 archive/dev-probes-cleanup-20261118/_naval-model-selfcheck.js (2026-11-19 效率批归档) 同一套) ══════════════
const texStub=()=>({__stub:true});
const sandbox={
	console,Math,JSON,Date,Array,Object,Set,Map,isNaN,parseInt,parseFloat,String,Number,Boolean,Error,THREE,
	TEX:{leaves:texStub(),grime:texStub(),metalBrush:texStub(),rust:texStub(),barnacle:texStub(),waterline:texStub(),deckWood:texStub(),wood:texStub(),
		steelPlate:texStub(),concrete:texStub(),canvas:texStub(),stencil:texStub()},
	TEAM_COL:[0x8fc1ff,0xff9c8a],
	localStorage:{_s:{},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];}},
	navigator:{maxTouchPoints:0,userAgent:'node'},
	document:{createElement:()=>({style:{},getContext:()=>null,width:0,height:0}),querySelector:()=>null,body:{appendChild(){},style:{}}},
	window:{addEventListener(){},innerWidth:1280,innerHeight:720},
	performance:{now:()=>Date.now()},requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},
	setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},
};
sandbox.globalThis=sandbox;
const ctx=vm.createContext(sandbox);
const load=f=>vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
load('js/00-config.js');
load('js/15e-navmodels.js');
const API=vm.runInContext('({NAVAL_SPEC,navBuildModel})',ctx);

// ══════════════ 几何取件 ══════════════
function collect(grp){
	grp.updateMatrixWorld(true);
	const parts=[];
	grp.traverse(o=>{
		if(!o.isMesh||!o.geometry) return;
		const g=o.geometry,pos=g.attributes.position,idx=g.index;
		const col=(o.material&&o.material.color)?o.material.color:new THREE.Color(1,1,1);
		const col3=[col.r,col.g,col.b];
		const tri=[];
		const n=idx?idx.count:pos.count;
		for(let i=0;i<n;i+=3){
			const ia=idx?idx.getX(i):i, ib=idx?idx.getX(i+1):i+1, ic=idx?idx.getX(i+2):i+2;
			const a=new THREE.Vector3().fromBufferAttribute(pos,ia).applyMatrix4(o.matrixWorld);
			const b=new THREE.Vector3().fromBufferAttribute(pos,ib).applyMatrix4(o.matrixWorld);
			const c=new THREE.Vector3().fromBufferAttribute(pos,ic).applyMatrix4(o.matrixWorld);
			tri.push([a,b,c]);
		}
		parts.push({name:o.name||'',col:col3,tri});
	});
	return parts;
}
// ══════════════ 极小位图字体 (5×7, 仅数字与几个符号, 给尺寸标注用) ══════════════
const FONT={
'0':['.###.','#...#','#..##','#.#.#','##..#','#...#','.###.'],
'1':['..#..','.##..','..#..','..#..','..#..','..#..','.###.'],
'2':['.###.','#...#','....#','...##','..#..','.#...','#####'],
'3':['####.','....#','....#','.###.','....#','....#','####.'],
'4':['...#.','..##.','.#.#.','#..#.','#####','...#.','...#.'],
'5':['#####','#....','####.','....#','....#','#...#','.###.'],
'6':['..##.','.#...','#....','####.','#...#','#...#','.###.'],
'7':['#####','....#','...#.','..#..','.#...','.#...','.#...'],
'8':['.###.','#...#','#...#','.###.','#...#','#...#','.###.'],
'9':['.###.','#...#','#...#','.####','....#','...#.','.##..'],
'.':['.....','.....','.....','.....','.....','.##..','.##..'],
'-':['.....','.....','.....','#####','.....','.....','.....'],
'm':['.....','.....','##.#.','#.#.#','#.#.#','#....','#....'],
' ':['.....','.....','.....','.....','.....','.....','.....'],
};
let SX=1; // 字号倍率 (render 时按面板宽设)
function drawText(buf,W,H,x,y,s,col){
	for(const ch of String(s)){
		const gl=FONT[ch]||FONT[' '];
		for(let r=0;r<7;r++)for(let c=0;c<5;c++){
			if(gl[r][c]!=='#') continue;
			for(let dy=0;dy<SX;dy++)for(let dx=0;dx<SX;dx++){
				const px=x+c*SX+dx, py=y+r*SX+dy;
				if(px<0||py<0||px>=W||py>=H) continue;
				const o=(py*W+px)*3; buf[o]=col[0];buf[o+1]=col[1];buf[o+2]=col[2];
			}
		}
		x+=6*SX;
	}
}
// ══════════════ PNG 编码 (真彩 + 无滤波 + zlib) ══════════════
const CRC=(()=>{const t=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(buf){let c=0xffffffff;for(const b of buf)c=CRC[(c^b)&0xff]^(c>>>8);return (c^0xffffffff)>>>0;}
function chunk(type,data){
	const len=Buffer.alloc(4); len.writeUInt32BE(data.length);
	const t=Buffer.from(type,'ascii'), body=Buffer.concat([t,data]);
	const crc=Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
	return Buffer.concat([len,body,crc]);
}
function writePNG(file,W,H,rgb){
	const raw=Buffer.alloc((W*3+1)*H);
	for(let y=0;y<H;y++){ raw[y*(W*3+1)]=0; rgb.copy(raw,y*(W*3+1)+1,y*W*3,(y+1)*W*3); }
	const ihdr=Buffer.alloc(13); ihdr.writeUInt32BE(W,0); ihdr.writeUInt32BE(H,4);
	ihdr[8]=8; ihdr[9]=2; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0;
	fs.writeFileSync(file,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),
		chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]));
}
// ══════════════ 光栅器 ══════════════
// 视图基: right/up/fwd (正交) 或 相机位置 + 目标 (透视)
function makeOrtho(bb,axis){
	const c=new THREE.Vector3(); bb.getCenter(c);
	const sz=new THREE.Vector3(); bb.getSize(sz);
	let right,up,fwd;
	if(axis==='side'){ fwd=new THREE.Vector3(1,0,0); up=new THREE.Vector3(0,1,0); }      // 从 -x 看 ⇒ 艏(+z)在右
	else if(axis==='front'){ fwd=new THREE.Vector3(0,0,-1); up=new THREE.Vector3(0,1,0); } // 从 +z 看 (艏朝观察者)
	else { fwd=new THREE.Vector3(0,-1,0); up=new THREE.Vector3(0,0,-1); }                  // 俯视, 艏朝上
	right=new THREE.Vector3().crossVectors(fwd,up).normalize();
	return {fwd,right,up,center:c,size:sz,ortho:true};
}
function makePersp(bb){
	const c=new THREE.Vector3(); bb.getCenter(c);
	const sz=new THREE.Vector3(); bb.getSize(sz);
	const R=Math.max(sz.x,sz.y,sz.z)*1.25;
	const eye=c.clone().add(new THREE.Vector3(0.72,-0.62,0.86).normalize().multiplyScalar(R*2.15));
	const fwd=eye.clone().sub(c).normalize();                       // 相机朝物体
	const up0=new THREE.Vector3(0,1,0);
	const right=new THREE.Vector3().crossVectors(up0,fwd).normalize().negate(); // 与正交同手性
	const up=new THREE.Vector3().crossVectors(fwd,right).normalize();
	return {eye,fwd,right,up,center:c,size:sz,ortho:false};
}
// 后上方 3/4 (看艉板/桨/舵/艉门)
function makePerspRear(bb){
	const c=new THREE.Vector3(); bb.getCenter(c);
	const sz=new THREE.Vector3(); bb.getSize(sz);
	const R=Math.max(sz.x,sz.y,sz.z)*1.25;
	const eye=c.clone().add(new THREE.Vector3(-0.62,-0.52,-0.92).normalize().multiplyScalar(R*1.95));
	const fwd=eye.clone().sub(c).normalize();
	const up0=new THREE.Vector3(0,1,0);
	const right=new THREE.Vector3().crossVectors(up0,fwd).normalize().negate();
	const up=new THREE.Vector3().crossVectors(fwd,right).normalize();
	return {eye,fwd,right,up,center:c,size:sz,ortho:false};
}
const lum=(c,l)=>Math.max(0,Math.min(255,Math.round(255*Math.pow(Math.max(0,Math.min(1,c*l)),0.86))));
function render(parts,view,W,H,opt){
	opt=opt||{};
	const rgb=Buffer.alloc(W*H*3);
	const zb=new Float32Array(W*H).fill(Infinity);
	const pb=new Int32Array(W*H).fill(-1);
	// 背景 (浅灰渐变)
	for(let y=0;y<H;y++)for(let x=0;x<W;x++){
		const t=y/H, g=232-18*t, o=(y*W+x)*3;
		rgb[o]=g;rgb[o+1]=g+2;rgb[o+2]=g+5;
	}
	// 投影
	const prj=[];
	if(view.ortho){
		const sz=view.size;
		const ext=(view.fwd.x!==0)?sz.z:((view.fwd.y!==0)?Math.max(sz.x,sz.z):sz.z);
		const extV=(view.fwd.x!==0)?sz.y:((view.fwd.y!==0)?sz.x:sz.y);
		let s=Math.min((W-40)/Math.max(1e-6,ext),(H-40)/Math.max(1e-6,extV));
		view._s=s;
		prj.push(p=>{
			const d=p.clone().sub(view.center);
			return [W/2+d.dot(view.right)*s, H/2-d.dot(view.up)*s, d.dot(view.fwd)];
		});
	}else{
		const s=Math.min(W,H)*0.5/Math.tan(0.42);
		prj.push(p=>{
			const d=p.clone().sub(view.eye);
			const z=d.dot(view.right), y=d.dot(view.up), x2=d.dot(view.fwd);
			const iz=Math.max(0.05,x2);
			return [W/2+z/x2*s, H/2-y/x2*s, x2];
		});
	}
	const P=prj[0];
	// 三角形光栅
	const L1=new THREE.Vector3(-0.45,0.72,0.52).normalize();
	const L2=new THREE.Vector3(0.75,0.22,-0.62).normalize();
	const nrm=new THREE.Vector3(), e1=new THREE.Vector3(), e2=new THREE.Vector3();
	const put=(partIdx,tri,colLit)=>{
		const q=tri.map(P);
		const x0=q[0][0],y0=q[0][1],x1=q[1][0],y1=q[1][1],x2=q[2][0],y2=q[2][1];
		const minx=Math.max(0,Math.floor(Math.min(x0,x1,x2))), maxx=Math.min(W-1,Math.ceil(Math.max(x0,x1,x2)));
		const miny=Math.max(0,Math.floor(Math.min(y0,y1,y2))), maxy=Math.min(H-1,Math.ceil(Math.max(y0,y1,y2)));
		if(minx>maxx||miny>maxy) return;
		const area=(x1-x0)*(y2-y0)-(x2-x0)*(y1-y0);
		if(Math.abs(area)<1e-9) return;
		const ia=1/area;
		for(let y=miny;y<=maxy;y++)for(let x=minx;x<=maxx;x++){
			const px=x+0.5, py=y+0.5;
			const w0=((x1-px)*(y2-py)-(x2-px)*(y1-py))*ia;
			const w1=((x2-px)*(y0-py)-(x0-px)*(y2-py))*ia;
			const w2=((x0-px)*(y1-py)-(x1-px)*(y0-py))*ia;
			if(w0<0||w1<0||w2<0) continue;
			const z=w0*q[0][2]+w1*q[1][2]+w2*q[2][2];
			const i=y*W+x;
			if(z>=zb[i]) continue;
			zb[i]=z; pb[i]=partIdx;
			const o=i*3; rgb[o]=colLit[0];rgb[o+1]=colLit[1];rgb[o+2]=colLit[2];
		}
	};
	for(let pi=0;pi<parts.length;pi++){
		const p=parts[pi];
		const base=opt.partCol?[60+(pi*53)%160,70+(pi*97)%150,80+(pi*29)%150]:[p.col[0]*255,p.col[1]*255,p.col[2]*255];
		for(const tri of p.tri){
			e1.subVectors(tri[1],tri[0]); e2.subVectors(tri[2],tri[0]);
			nrm.crossVectors(e1,e2);
			if(nrm.lengthSq()<1e-12) continue;
			nrm.normalize();
			const d1=Math.abs(nrm.dot(L1)), d2=Math.abs(nrm.dot(L2));
			const l=0.30+0.62*d1+0.30*d2;
			put(pi,tri,[lum(base[0]/255,l),lum(base[1]/255,l),lum(base[2]/255,l)]);
		}
	}
	// 地面线 (仅侧视/正视: 背景像素才画) + 1m 刻度
	const bg=(x,y)=>zb[y*W+x]===Infinity;
	const boxPts=(x0,y0,x1,y1,col)=>{ for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){ if(x<0||y<0||x>=W||y>=H||!bg(x,y)) continue; const o=(y*W+x)*3; rgb[o]=col[0];rgb[o+1]=col[1];rgb[o+2]=col[2]; } };
	if(view.ortho&&(view.fwd.x!==0||view.fwd.z!==0)){
		const A=P(new THREE.Vector3(-30,0,0)), B=P(new THREE.Vector3(30,0,0));
		const yl=Math.round(A[1]);
		boxPts(0,yl,W-1,yl,[150,150,155]);
		// 1m 刻度 (沿 z: 视角为侧视时 z 是横轴)
		const z0=Math.floor(view.center.z-view.size.z/2)-1, z1=Math.ceil(view.center.z+view.size.z/2)+1;
		for(let z=z0;z<=z1;z++){
			const p=P(new THREE.Vector3(0,0,z));
			boxPts(Math.round(p[0]),yl,Math.round(p[0]),yl+5,[110,110,118]);
			if(opt.measure){
				SX=Math.max(1,Math.round(W/720));
				drawText(rgb,W,H,Math.round(p[0])-3*SX,yl+7,String(z),[110,110,130]);
			}
		}
		// 尺寸标注: 总长 → 车底下方一行 "L=7.95" 由调用方给 (opt.dims)
		if(opt.dims){
			SX=Math.max(1,Math.round(W/720));
			const txt=opt.dims, tw=txt.length*6*SX;
			drawText(rgb,W,H,Math.round(W/2-tw/2),yl+10,txt,[70,70,80]);
		}
	}
	if(view.ortho&&view.fwd.y!==0&&opt.dims){   // 俯视: 也标一行
		SX=Math.max(1,Math.round(W/720));
		const txt=opt.dims, tw=txt.length*6*SX;
		drawText(rgb,W,H,Math.round(W/2-tw/2),H-14,txt,[70,70,80]);
	}
	// 边缘描线 (深度台阶 / 件号不同 ⇒ 画深线; 只画背景侧不遮模型)
	let dmin=Infinity,dmax=-Infinity;
	for(let i=0;i<zb.length;i++){ const v=zb[i]; if(v<Infinity){ if(v<dmin) dmin=v; if(v>dmax) dmax=v; } }
	if(!(dmin<Infinity)){ dmin=0; dmax=1; }
	const thr=(dmax-dmin)*0.012+1e-4;
	for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){
		const i=y*W+x;
		if(zb[i]===Infinity) continue;
		let edge=false;
		for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
			const j=(y+dy)*W+(x+dx);
			if(zb[j]===Infinity){ edge=true; break; }               // 轮廓
			if(Math.abs(zb[j]-zb[i])>thr){ edge=true; break; }      // 深度台阶
			if(pb[j]!==pb[i]){ edge=true; break; }                  // 件边界
		}
		if(!edge) continue;
		const o=i*3;
		rgb[o]=Math.round(rgb[o]*0.45); rgb[o+1]=Math.round(rgb[o+1]*0.45); rgb[o+2]=Math.round(rgb[o+2]*0.45);
	}
	return rgb;
}
// ══════════════ 主流程 ══════════════
fs.mkdirSync(path.join(root,'dev/out'),{recursive:true});
for(const k of KEYS){
	const D=API.NAVAL_SPEC[k];
	if(!D){ console.log(`?? 无此型: ${k}`); continue; }
	const R=API.navBuildModel(D);
	const parts=collect(R.grp);
	const bb=new THREE.Box3(); bb.makeEmpty();
	for(const p of parts) for(const t of p.tri) for(const v of t) bb.expandByPoint(v);
	const sz=new THREE.Vector3(); bb.getSize(sz);
	const nTri=parts.reduce((s,p)=>s+p.tri.length,0);
	console.log(`── ${k} (${D.name}) ── 件 ${parts.length} · 三角 ${nTri}`);
	console.log(`   包围盒 L(z)=${sz.z.toFixed(2)} W(x)=${sz.x.toFixed(2)} H(y)=${sz.y.toFixed(2)}  `
		+`(spec ${D.hullL}×${D.hullW}×${D.hullH})  底 y=${bb.min.y.toFixed(2)} 顶 y=${bb.max.y.toFixed(2)}`);
	const W=PW*2+4, H=PH*2+4;
	const out=Buffer.alloc(W*H*3,240);
	// 面板布局: 默认 侧视/正视/俯视/3-4 透; ZOOM=1 时改 4 个近景 (艏部舷侧 / 艉部舷侧 / 前上 3-4 / 尾后 3-4)
	let panels;
	if(ARG.ZOOM){
		const seg=Math.min(sz.z*0.40,Math.max(sz.z*0.22,3.0));
		const zbow=new THREE.Box3(bb.min.clone(),bb.max.clone());
		zbow.min.z=bb.max.z-seg;                       // 艏段 (含炮管/浮筒艏); 竖向不裁 ⇒ 桨舵/履带同时可见
		const zst=new THREE.Box3(bb.min.clone(),bb.max.clone());
		zst.max.z=bb.min.z+seg;                        // 艉段 (含艉架/桨/舵)
		panels=[['side','『艏部』',zbow],['side','『艉部』',zst],['34','',bb],['rear','',bb]];
	}else{
		panels=[['side',`L=${D.hullL} W=${D.hullW}`,null],['front',`W=${D.hullW}`,null],['top',`L=${D.hullL}`,null],['34','',null]];
	}
	panels.forEach((pt,idx)=>{
		const px=(idx%2)*(PW+4), py=Math.floor(idx/2)*(PH+4);
		const box=pt[2]||bb;
		const view=(pt[0]==='34')?makePersp(box):(pt[0]==='rear'?makePerspRear(box):makeOrtho(box,pt[0]));
		const buf=render(parts,view,PW,PH,{dims:pt[1],partCol:!!ARG.PARTS,measure:!!ARG.MEASURE});
		for(let y=0;y<PH;y++) for(let x=0;x<PW;x++){
			const so=(y*PW+x)*3, to=((py+y)*W+(px+x))*3;
			out[to]=buf[so];out[to+1]=buf[so+1];out[to+2]=buf[so+2];
		}
	});
	const file=path.join(root,`dev/out/model-${k}.png`);
	writePNG(file,W,H,out);
	console.log(`   → ${path.relative(root,file)}  (${W}×${H})`);
}
