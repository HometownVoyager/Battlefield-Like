// ─────────────────────────────────────────────
// 19b-gamepad.js —— 手柄输入 (2026-09-28C 新增)
// 设计: 与触控同一套"合成输入"架构 —— 只写 keys.* / mouseDown / mouse2Down / yaw/pitch / tvDX/tvDY
// 这些键鼠/触屏共用的单源, 不另开第二套驾驶/开火逻辑 (20a/16/13 的消费端零改动)。
// 三入口共存: 手柄只在战斗中接管 (菜单/部署/结算面板仍用鼠标或手指), 拔线/换局统一松开全部按住态。
// 轮询入口 updateGamepad(pdt) 由 24-main 主循环逐帧调用 (typeof 守卫, 沙箱可整文件缺席)。
// 键位 (standard mapping, Xbox 布局):
//   RT 开火 · LT 瞄准(机瞄/同轴/机炮) · 左摇杆 移动(推满外圈=疾跑) · 右摇杆 视角 / TV制导
//   A 跳跃/上浮 · B 蹲/站 · X 互动(F) · Y 换弹(R) · LB 疾跑(按住) · RB 手雷(按住烹饪)
//   LS按 切枪 · RS按 近战(V) · Back 战况(按住) · Start 暂停
//   十字键: 上 绷带/观战气动飞行(H) · 下 趴(Z) · 左 烟雾(4; 工程兵=选工事5) · 右 AT雷(3)
// ─────────────────────────────────────────────
'use strict';
const PAD={on:false,idx:-1,prev:[],held:{}};
window.__sfPad=PAD;   // 沙箱探针/诊断入口 (只读)
// 连接/断开 (gamepadconnected 只在用户按键后才发 —— 连上即提示, 断开即全部释放, 防卡键)
function padConnected(gp){
PAD.on=true; PAD.idx=gp.index; PAD.prev=[]; PAD.held={};
if(typeof showScorePop==='function') showScorePop(t2('手柄已连接: {0}',String(gp.id||'').slice(0,40)));
}
function padDisconnected(index){
if(PAD.on&&index!==PAD.idx) return;   // 拔的不是当前手柄: 不动状态
PAD.on=false; PAD.idx=-1;
padReleaseAll();
if(typeof showScorePop==='function') showScorePop(t2('手柄已断开'));
}
if(typeof window.addEventListener==='function'){
window.addEventListener('gamepadconnected',e=>padConnected(e.gamepad));
window.addEventListener('gamepaddisconnected',e=>padDisconnected(e.gamepad.index));
}
// 合成键: 与 24-main 触控 kd/ku 同链 (派发 KeyboardEvent; 沙箱无事件管线时退化为直写 keys 表)
const padKd=c=>{ if(PAD.held[c]) return; PAD.held[c]=true; try{ dispatchEvent(new KeyboardEvent('keydown',{code:c})); }catch(e){ keys[c]=true; } };
const padKu=c=>{ if(!PAD.held[c]) return; delete PAD.held[c]; try{ dispatchEvent(new KeyboardEvent('keyup',{code:c})); }catch(e){ keys[c]=false; } };
function padReleaseAll(){
for(const c of Object.keys(PAD.held)) padKu(c);
PAD.held={};
mouseDown=false; mouse2Down=false; player.ads=false; keys.ShiftLeft=false;
keys.KeyW=keys.KeyS=keys.KeyA=keys.KeyD=false;
}
// LT = 瞄准: 门与键鼠右键/触屏瞄准逐条同款 (座位/巡飞弹/飞行中一律不进 ADS)
function padAds(on){
if(on){
mouse2Down=true;
if(player.alive&&!player.loiter&&!player.flying&&!player.onMG&&!player.onVehicle&&!player.onNaval&&!player.onAT&&!player.onAA&&!player.onMortar&&!player.onBattery) player.ads=true;
}else{ mouse2Down=false; player.ads=false; }
}
const PAD_DZ=0.22;
const padAxis=v=>{ const a=Math.abs(v); if(a<PAD_DZ) return 0; return Math.sign(v)*((a-PAD_DZ)/(1-PAD_DZ)); };
const PAD_MAP=[   // i = standard mapping 按钮号; dn 在"战斗中"的按下沿触发, up 在任何状态的抬起沿触发 (松键不丢)
{b:0, dn:()=>padKd('Space'), up:()=>padKu('Space')},                                   // A 跳
{b:1, dn:()=>padKd('KeyC'),  up:()=>padKu('KeyC')},                                    // B 蹲
{b:2, dn:()=>padKd('KeyF'),  up:()=>padKu('KeyF')},                                    // X 互动
{b:3, dn:()=>padKd('KeyR'),  up:()=>padKu('KeyR')},                                    // Y 换弹
{b:4, dn:null, up:null},                                                               // LB 疾跑 (下方逐帧合成, 不走沿)
{b:5, dn:()=>padKd('KeyG'),  up:()=>padKu('KeyG')},                                    // RB 手雷 (按住烹饪)
{b:6, dn:()=>padAds(true),   up:()=>padAds(false)},                                    // LT 瞄准
{b:7, dn:()=>{mouseDown=true;},  up:()=>{mouseDown=false;}},                           // RT 开火
{b:8, dn:()=>padKd('Tab'),   up:()=>padKu('Tab')},                                     // Back 战况 (按住)
{b:9, dn:()=>{ if(gamePaused||(player.deployed&&player.alive&&!matchOver)) togglePause(); }, up:null}, // Start 暂停
{b:10,dn:()=>{ if(player.alive&&player.deployed) switchSlot(player.curSlot===0?1:0); }, up:null},       // LS 切枪
{b:11,dn:()=>padKd('KeyV'),  up:()=>padKu('KeyV')},                                    // RS 近战
{b:12,dn:()=>padKd('KeyH'),  up:()=>padKu('KeyH')},                                    // 十字上 绷带/气动飞行
{b:13,dn:()=>padKd('KeyZ'),  up:()=>padKu('KeyZ')},                                    // 十字下 趴
{b:14,dn:()=>padKd(player.cls===4?'Digit5':'Digit4'), up:()=>{padKu('Digit4'); padKu('Digit5');}},      // 十字左 烟雾/选工事 (2026-09-28 兵种8→5: 工程=4; 迫击炮走 Digit6)
{b:15,dn:()=>padKd('Digit3'),up:()=>padKu('Digit3')},                                  // 十字右 AT雷
];
// 逐帧轮询 (pdt = 本体帧长: 观战时停下观察者仍可转头, 与键鼠同规)
window.updateGamepad=function(pdt){
if(!PAD.on||typeof navigator==='undefined'||typeof navigator.getGamepads!=='function') return;
let gp=null;
for(const g of navigator.getGamepads()){ if(g&&g.index===PAD.idx){ gp=g; break; } }
if(!gp){ padDisconnected(PAD.idx); return; }
const battle=player.alive&&player.deployed&&!gamePaused&&!matchOver;
const btns=gp.buttons||[];
for(let i=0;i<PAD_MAP.length&&i<btns.length;i++){
const pressed=!!(btns[i]&&btns[i].pressed);
const was=!!PAD.prev[i];
if(pressed&&!was){ if((battle||i===9)&&PAD_MAP[i].dn) PAD_MAP[i].dn(); }
else if(!pressed&&was){ if(PAD_MAP[i].up) PAD_MAP[i].up(); }
PAD.prev[i]=pressed;
}
const ax=gp.axes||[];
const lx=padAxis(ax[0]||0), ly=padAxis(ax[1]||0);
if(battle){
// 左摇杆 = 移动 (死区 0.35 档位化; 推满外圈+前推 = 疾跑, 与触屏摇杆同手势); LB 按住 = 常疾跑
keys.KeyW=ly<-0.35; keys.KeyS=ly>0.35; keys.KeyA=lx<-0.35; keys.KeyD=lx>0.35;
const mag=Math.hypot(lx,ly);
keys.ShiftLeft=!!(btns[4]&&btns[4].pressed)||(mag>0.92&&ly<-0.55);
// 右摇杆 = 视角 / TV 制导 (与键鼠触屏同一单源: 制导记账 tvDX/tvDY, 平时直写本体角)
const rx=padAxis(ax[2]||0), ry=padAxis(ax[3]||0);
if(player.loiter){
player.tvDX+=rx*1000*pdt; player.tvDY+=ry*1000*pdt;   // 满杆 ≈1000px/s ⇒ 恰好压住 2.5/1.9 rad·s⁻¹ 的角速度上限
}else if(rx||ry){
const zoom=lookZoomMul();
player.yaw-=rx*3.4*SETTINGS.sens*zoom*pdt;
player.pitch-=ry*2.4*SETTINGS.sens*zoom*pdt;
player.pitch=clamp(player.pitch,-1.45,1.45);
player.mouseDX=rx*16; player.mouseDY=ry*16;
}
}else{
// 非战斗 (死亡/部署/菜单/结算): 不接管但要**归还** —— 按住态逐帧清零, 防止切面板后车一直在走
if(keys.KeyW||keys.KeyS||keys.KeyA||keys.KeyD||keys.ShiftLeft||mouseDown||mouse2Down){
keys.KeyW=keys.KeyS=keys.KeyA=keys.KeyD=false; keys.ShiftLeft=false; mouseDown=false; mouse2Down=false; player.ads=false;
}
}
};
