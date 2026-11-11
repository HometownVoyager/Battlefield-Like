# 布局快照渲染 (自检用): python dev/_pgpng.py dev/_pgsnap-<seed>.json dev/_pgsnap-<seed>.png
import json,sys,math
from PIL import Image,ImageDraw,ImageFont
J=json.load(open(sys.argv[1],encoding='utf-8')); OUT=sys.argv[2]
S=380; SC=2.0                      # 每米像素
W=int(S*SC)
img=Image.new('RGB',(W,W),(38,44,34))
dr=ImageDraw.Draw(img)
def P(x,z): return (W/2+x*SC, W/2+z*SC)
# 农田
FCOL={'wheat':(150,140,70),'corn':(130,140,60),'pasture':(90,120,70),'till':(110,96,70),'rice':(70,120,90)}
for f in J['fields']:
 a=P(f['x0'],f['z0']); b=P(f['x1'],f['z1'])
 dr.rectangle([min(a[0],b[0]),min(a[1],b[1]),max(a[0],b[0]),max(a[1],b[1])],fill=FCOL.get(f['t'],(120,120,80)),outline=(80,90,60))
# 林地
for w in J['woods']:
 c=P(w['x'],w['z']); r=w['r']*SC
 dr.ellipse([c[0]-r,c[1]-r,c[0]+r,c[1]+r],fill=(44,64,42))
# 汊港/鱼塘
D=J.get('delta')
if D:
 for ch in D.get('channels',[]):
  dr.line([P(*p) for p in ch],fill=(52,86,120),width=5)
 for pd in D.get('ponds',[]):
  c=P(pd['x'],pd['z']); r=pd['r']*SC
  dr.ellipse([c[0]-r,c[1]-r,c[0]+r,c[1]+r],fill=(58,96,130),outline=(90,120,140))
R=J.get('river')
if R:
 pt=[P(*p) for p in R['pts']]
 dr.line(pt,fill=(58,104,140),width=int(R['w']*2*SC))
 for i in range(0,len(pt)-1):
  pass
# 路网
STY={'main':((196,190,170),3),'trunk0':((168,160,148),3),'trunk1':((168,160,148),3),'sub':((150,146,136),2),'lane':((132,128,120),2)}
for p in J['polys']:
 col,wd=STY.get(p['cls'],((140,140,140),2))
 dr.line([P(*q) for q in p['pts']],fill=col,width=wd)
# 铁路
if J.get('rail'):
 dr.line([P(*q) for q in J['rail']],fill=(120,90,60),width=2)
# 桥
for b in (J.get('bridges') or []):
 px,pz=math.sin(b['yaw']),math.cos(b['yaw']); hx,hl=b['len']/2,b['w']/2
 pts=[(b['x']+px*hx-pz*hl,b['z']+pz*hx+px*hl),(b['x']+px*hx+pz*hl,b['z']+pz*hx-px*hl),
      (b['x']-px*hx+pz*hl,b['z']-pz*hx-px*hl),(b['x']-px*hx-pz*hl,b['z']-pz*hx+px*hl)]
 dr.polygon([P(*q) for q in pts],fill=(210,200,170),outline=(90,90,90))
# 地块 (建筑)
for L in J['lots']:
 ry=L['ry']; w,d=L['w']/2,L['d']/2
 cs=[( w,-d),(-w,-d),(-w, d),( w, d)]
 q=[(L['x']+c[0]*math.cos(ry)+c[1]*math.sin(ry), L['z']-c[0]*math.sin(ry)+c[1]*math.cos(ry)) for c in cs]
 dr.polygon([P(*t) for t in q],fill=(212,178,140),outline=(90,70,50))
# 旗点
for f in J['flags']:
 c=P(f['x'],f['z']); r=max(4,f['r']*SC)
 dr.ellipse([c[0]-r,c[1]-r,c[0]+r,c[1]+r],outline=(230,70,70),width=3)
 try: ft=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',13)
 except: ft=None
 dr.text((c[0]+r+2,c[1]-7),f['id'],fill=(255,220,220),font=ft)
# 基地/核心
for i,b in enumerate(J['bases']):
 c=P(b['x'],b['z']); dr.rectangle([c[0]-7,c[1]-7,c[0]+7,c[1]+7],fill=(80,140,230) if i==0 else (230,160,80))
c=P(*[J['core']['x'],J['core']['z']]); dr.line([c[0]-8,c[1],c[0]+8,c[1]],fill=(120,255,220),width=2); dr.line([c[0],c[1]-8,c[0],c[1]+8],fill=(120,255,220),width=2)
dr.text((6,4),'seed %s  %s/%s  flags=%d lots=%d'%(J['seed'],J['biome'],J['theme'],len(J['flags']),len(J['lots'])),fill=(230,230,230))
img.save(OUT)
print('→',OUT)
