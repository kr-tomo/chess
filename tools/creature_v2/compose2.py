import pickle, numpy as np, cv2
from PIL import Image
from scipy import ndimage as ndi
P=pickle.load(open('cut.pkl','rb'))
CW,CH,BASE=300,480,444
# 체스 기물 비율: K > Q > B > N > R > P (높이), 폭도 같은 순서로 부피가 줄어들도록
HT={'K':315,'Q':295,'B':262,'N':250,'R':240,'P':200}
WMAX=290
COL={'P':0,'N':1,'B':2,'R':3,'Q':4,'K':5}
def prep(img):
    a=img.copy(); al=ndi.binary_erosion(a[...,3]>127,iterations=1)
    a[...,3]=cv2.GaussianBlur(np.where(al,255,0).astype(np.uint8),(0,0),0.7)
    ys,xs=np.where(a[...,3]>10); return a[ys.min():ys.max()+1,xs.min():xs.max()+1]
def resize(a,nw,nh):
    f=a.astype(np.float32); f[...,:3]*=f[...,3:]/255
    f=cv2.resize(f,(nw,nh),interpolation=cv2.INTER_CUBIC)
    f[...,3]=np.clip(f[...,3],0,255); al=np.clip(f[...,3:]/255,1e-3,1); f[...,:3]=np.clip(f[...,:3]/al,0,255)
    return f.astype(np.uint8)
sheet=Image.new('RGBA',(CW*6,CH*2),(0,0,0,0))
for key,img in P.items():
    color,t=key[0],key[1]; a=prep(img); h,w=a.shape[:2]
    if key=='wK' or key=='bK' and False:
        pass
    if key=='wK':
        # 가이오가: 세로로 늘리고 폰의 받침대를 깔아 킹의 높이를 확보
        a=resize(a,w,round(h*1.5)); h,w=a.shape[:2]
        ped=prep(P['wP']); ph,pw=ped.shape[:2]; base=ped[int(ph*0.72):]   # 받침대 부분
        bw=288; bh=round(base.shape[0]*bw/base.shape[1]); base=resize(base,bw,bh)
        wh=HT['K']-bh+14; ww=round(w*wh/h)
        if ww>WMAX: ww=WMAX; wh=round(h*ww/w)
        whale=resize(a,ww,wh)
        comp=Image.new('RGBA',(max(bw,ww),wh+bh-14),(0,0,0,0))
        comp.alpha_composite(Image.fromarray(base,'RGBA'),((comp.width-bw)//2,wh-14))
        comp.alpha_composite(Image.fromarray(whale,'RGBA'),((comp.width-ww)//2,0))
        im=comp; nw,nh=im.size
    else:
        if t=='R': a=resize(a,w,round(h*1.18)); h,w=a.shape[:2]
        s=min(WMAX/w,HT[t]/h); nw,nh=round(w*s),round(h*s)
        im=Image.fromarray(resize(a,nw,nh),'RGBA')
    c=COL[t]; r=0 if color=='w' else 1
    sheet.alpha_composite(im,(round(c*CW+CW/2-nw/2),r*CH+BASE-nh)); print(key,nw,nh)
sheet.save('t-creature-pieces.png')
bg=Image.new('RGBA',sheet.size,(150,200,110,255)); bg.alpha_composite(sheet); bg.convert('RGB').resize((1200,600),Image.LANCZOS).save('sheet_check.png')
