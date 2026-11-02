import pickle, numpy as np, cv2, math
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as ndi
P=pickle.load(open('/home/claude/chess/work/new/cut.pkl','rb'))
SHEET=Image.open('/home/claude/chess/work/new/sheet_ped.png').convert('RGBA')
CW,CH,BASE=300,480,444
PAL={'w':dict(hi=(255,255,255),base=(236,240,248),shade=(190,200,222),deep=(150,160,190),line=(52,48,62)),
     'b':dict(hi=(255,230,130),base=(240,178,62),shade=(206,124,42),deep=(160,86,30),line=(58,34,18))}
def pom(arr,cx,cy,r,pal,B=3,seed=1,tufts=9,spike=0.16,flip=1):
    H,W=arr.shape[:2]; rng=np.random.RandomState(seed)
    gx,gy=np.meshgrid(np.arange(W),np.arange(H))
    # block-quantized coordinates
    qx=(gx//B)*B+B/2; qy=(gy//B)*B+B/2
    dx=qx-cx; dy=qy-cy; ang=np.arctan2(dy,dx); rad=np.hypot(dx,dy)
    edge=r*(1+spike*np.abs(np.sin(tufts*ang/2+seed))**1.3 - spike*0.5 + 0.05*np.sin(3*ang+seed))
    inside=rad<=edge
    # outline: inside cells with a neighbour (block-size away) outside
    def inn(ox,oy):
        x2=qx+ox*B-cx; y2=qy+oy*B-cy; a2=np.arctan2(y2,x2); r2=np.hypot(x2,y2)
        e2=r*(1+spike*np.abs(np.sin(tufts*a2/2+seed))**1.3 - spike*0.5 + 0.05*np.sin(3*a2+seed)); return r2<=e2
    border=inside&~(inn(1,0)&inn(-1,0)&inn(0,1)&inn(0,-1))
    # 면 음영: 왼쪽 위 광원, 방사형 털결
    nx=dx/r; ny=dy/r; lit=-(nx*0.6*flip+ny*0.8)           # 밝기 -1..1
    tuft=(np.sin(tufts*ang+seed*2)>0.55)&(rad>r*0.45)
    col=np.zeros((H,W,3),float)
    base=np.array(pal['base'],float); hi=np.array(pal['hi'],float); sh=np.array(pal['shade'],float); dp=np.array(pal['deep'],float)
    t=np.clip(lit,-1,1)
    for ch in range(3):
        c=np.where(t>0.35,hi[ch],np.where(t>-0.15,base[ch],np.where(t>-0.55,sh[ch],dp[ch])))
        c=np.where(tuft&(t<0.35),np.where(t>-0.15,sh[ch],dp[ch]),c)       # 털 가닥
        col[...,ch]=c
    col[border]=np.array(pal['line'],float)
    out=arr.copy(); m=inside
    out[...,:3]=np.where(m[...,None],col,out[...,:3]); out[...,3]=np.where(m,255,out[...,3]); return out
def make(kind,variant):
    a=P[kind+'B'].copy(); H,W=a.shape[:2]; pal=PAL[kind]
    a=np.pad(a,((14,0),(14,14),(0,0)))   # 여유
    H,W=a.shape[:2]; o=14
    # 집게 영역 지우기 (모자와 몸통은 보존)
    for (x0,x1) in ((0,40+o),(W-40-o,W)):
        a[40:100, x0:x1,3]=0
    cfg={ 1:dict(r=22,ly=84,dx=35,B=3,tufts=9,spike=0.15),
          2:dict(r=27,ly=88,dx=38,B=3,tufts=11,spike=0.2),
          3:dict(r=19,ly=92,dx=34,B=2,tufts=8,spike=0.12)}[variant]
    lx=cfg['dx']; rx=W-cfg['dx']
    a=pom(a,lx,cfg['ly'],cfg['r'],pal,B=cfg['B'],seed=2,tufts=cfg['tufts'],spike=cfg['spike'])
    a=pom(a,rx,cfg['ly'],cfg['r'],pal,B=cfg['B'],seed=5,tufts=cfg['tufts'],spike=cfg['spike'])
    ys,xs=np.where(a[...,3]>8); return a[ys.min():ys.max()+1,xs.min():xs.max()+1]
def prep(a):
    a=a.copy(); al=ndi.binary_erosion(a[...,3]>127,iterations=1); a[...,3]=cv2.GaussianBlur(np.where(al,255,0).astype(np.uint8),(0,0),0.7)
    ys,xs=np.where(a[...,3]>10); return a[ys.min():ys.max()+1,xs.min():xs.max()+1]
def rs(a,nw,nh):
    f=a.astype(np.float32); f[...,:3]*=f[...,3:]/255; f=cv2.resize(f,(nw,nh),interpolation=cv2.INTER_CUBIC)
    f[...,3]=np.clip(f[...,3],0,255); al=np.clip(f[...,3:]/255,1e-3,1); f[...,:3]=np.clip(f[...,:3]/al,0,255); return f.astype(np.uint8)
def clean(a):
    al=a[...,3]>127; lab,n=ndi.label(al); sz=ndi.sum(al,lab,range(1,n+1)); al=lab==1+int(np.argmax(sz))
    al=ndi.binary_opening(al,iterations=1); a=a.copy(); a[...,3]=np.where(al,255,0); return a
def pedestal(key,frac=0.27):
    a=clean(P[key]); h=a.shape[0]; b=a[int(h*(1-frac)):]
    ys,xs=np.where(b[...,3]>10); return Image.fromarray(b[ys.min():ys.max()+1,xs.min():xs.max()+1],'RGBA')
PED={'w':pedestal('wP'),'b':pedestal('bP')}
def cell(kind,art):
    a=prep(art); h,w=a.shape[:2]; s=min(290/w,262/h); cont=Image.fromarray(rs(a,round(w*s),round(h*s)),'RGBA')
    ped=PED[kind]; bw=int(np.clip(cont.width*0.78,170,236)); bh=round(bw*ped.height/ped.width); pi=ped.resize((bw,bh),Image.LANCZOS)
    nc=Image.new('RGBA',(CW,CH),(0,0,0,0)); nc.alpha_composite(pi,(round(CW/2-bw/2),BASE-bh))
    nc.alpha_composite(cont,(round(CW/2-cont.width/2),round(BASE-bh*0.45-cont.height))); return nc
def sheet_with(arts):
    out=SHEET.copy()
    for kind,art in arts.items():
        row=0 if kind=='w' else 1
        out.paste((0,0,0,0),(2*CW,row*CH,3*CW,(row+1)*CH)); out.alpha_composite(cell(kind,art),(2*CW,row*CH))
    return out
if __name__=='__main__':
    ORIG={'w':P['wB'],'b':P['bB']}
    sets={'현재':ORIG}
    for v in (1,2,3): sets[f'안 {v}']={k:make(k,v) for k in 'wb'}
    pickle.dump({n:{k:v for k,v in d.items()} for n,d in sets.items()},open('crab_sets.pkl','wb'))
    f=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',26)
    tiles=[]
    for n,d in sets.items():
        sh=sheet_with(d)
        for k in 'wb':
            row=0 if k=='w' else 1
            c=sh.crop((2*CW,row*CH+90,3*CW,(row+1)*CH)); bg=Image.new('RGBA',c.size,(240,228,220,255) if k=='w' else (160,84,60,255)); bg.alpha_composite(c); tiles.append(bg.convert('RGB'))
        sh.save(f'crab_sheet_{n.replace(" ","")}.png')
    W,H=tiles[0].size; m=Image.new('RGB',(W*4,(H+44)*2),(24,24,24)); dr=ImageDraw.Draw(m)
    for i,n in enumerate(sets):
        for j in range(2): m.paste(tiles[i*2+j],(i*W,j*(H+44)+44))
        dr.text((i*W+10,8),n,fill=(255,255,255),font=f)
    m.save('crab_samples.png'); print(m.size)
