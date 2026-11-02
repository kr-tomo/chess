import numpy as np, cv2, pickle
from PIL import Image, ImageDraw, ImageFont
from crab import P, prep, rs, cell, sheet_with, pom
MOSS=dict(hi=(112,122,64),base=(70,78,46),shade=(48,54,34),deep=(30,34,24),line=(22,24,18))
EYES={'w':((57,101),(91,101)),'b':((59,101),(94,101))}
def soft(mask,s=0.7): return cv2.GaussianBlur(mask.astype(np.float32),(0,0),s)
def blend(a,mask,color,alpha=1.0):
    m=(soft(mask)*alpha)[...,None]; a[...,:3]=np.clip(a[...,:3]*(1-m)+np.array(color)*m,0,255); a[...,3]=np.maximum(a[...,3],(m[...,0]*255).astype(np.uint8)); return a
def disc(H,W,cx,cy,r,sx=1,sy=1):
    y,x=np.mgrid[0:H,0:W]; return ((x-cx)/(r*sx))**2+((y-cy)/(r*sy))**2<=1
def eye(a,cx,cy):
    H,W=a.shape[:2]
    a=blend(a,disc(H,W,cx,cy,11),(104,56,40))          # 갈색 테두리
    a=blend(a,disc(H,W,cx,cy,9.2),(250,250,252))       # 튀어나온 흰자
    a=blend(a,disc(H,W,cx+1.2,cy-3,4.2),(18,14,16))     # 위를 보는 눈동자
    a=blend(a,disc(H,W,cx+2.4,cy-4.4,1.4),(255,255,255))
    return a
def cheeks(a,eyes):
    H,W=a.shape[:2]; (xl,y),(xr,_)=eyes
    a=blend(a,disc(H,W,xl-10,y+13,6.5,1,0.75),(236,140,146),0.7); a=blend(a,disc(H,W,xr+10,y+13,6.5,1,0.75),(236,140,146),0.7); return a
def mouth(a,eyes,teeth=(246,234,204)):
    H,W=a.shape[:2]; cx=(eyes[0][0]+eyes[1][0])/2; top=eyes[0][1]+14; bot=top+19; hw=23
    y,x=np.mgrid[0:H,0:W]
    def rr(hw_,t,b,r):
        dx=np.maximum(np.abs(x-cx)-(hw_-r),0); dy=np.maximum(np.maximum(t+r-y,y-(b-r)),0); return dx**2+dy**2<=r*r
    a=blend(a,rr(hw+1.6,top-1.6,bot+1.6,6),(54,24,30))   # 윤곽
    a=blend(a,rr(hw,top,bot,5),(120,40,58))              # 입 안
    a=blend(a,rr(hw-4,top+4,bot-4,3),(86,28,44),0.8)
    step=5.4; n=int(2*hw/step)
    for i in range(n):
        x0=cx-hw+1.5+i*step
        up=(i%2==0)
        a=blend(a,(x>=x0)&(x<x0+step-1.3)&(y>=top+0.5)&(y<top+(5.5 if up else 3.5)),teeth,0.95)       # 윗니
        a=blend(a,(x>=x0+step*0.5)&(x<x0+step*1.5-1.3)&(y<=bot-0.5)&(y>bot-(3.5 if up else 5.5))&(x<cx+hw-1),teeth,0.95)  # 아랫니
    return a
def tufts(a,kind,big=0):
    H,W=a.shape[:2]; o=0
    spots=[(31,100,12+big,3),(W-31,100,12+big,7),(43,91,7,11),(W-43,91,7,13),(25,129,8,17),(W-25,129,8,19)]
    for (x,y,r,sd) in spots:
        a=pom(a,x,y,r,MOSS,B=2,seed=sd,tufts=10,spike=0.55)
    return a
def make(kind,v):
    a=P[kind+'B'].copy(); eyes=EYES[kind]
    if v>=2: a=cheeks(a,eyes); 
    if v>=2:
        for (cx,cy) in eyes: a=eye(a,cx,cy)
    if v>=3: a=mouth(a,eyes)
    a=tufts(a,kind,big=2 if v>=4 else 0)
    return a
if __name__=='__main__':
    sets={'현재':{'w':P['wB'],'b':P['bB']}}
    for v in (1,2,3): sets[f'안 {v}']={k:make(k,v) for k in 'wb'}
    f=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',26)
    tiles=[]; CW,CH=300,480
    for n,d in sets.items():
        sh=sheet_with(d); sh.save(f'klawf_sheet_{n.replace(" ","")}.png')
        for k in 'wb':
            row=0 if k=='w' else 1
            c=sh.crop((2*CW,row*CH+90,3*CW,(row+1)*CH)); bg=Image.new('RGBA',c.size,(240,228,220,255) if k=='w' else (160,84,60,255)); bg.alpha_composite(c); tiles.append(bg.convert('RGB'))
    W,H=tiles[0].size; m=Image.new('RGB',(W*4,(H+44)*2),(24,24,24)); dr=ImageDraw.Draw(m)
    for i,n in enumerate(sets):
        for j in range(2): m.paste(tiles[i*2+j],(i*W,j*(H+44)+44))
        dr.text((i*W+10,8),n,fill=(255,255,255),font=f)
    m.save('klawf_samples.png'); print(m.size)
