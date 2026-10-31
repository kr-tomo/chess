import pickle, numpy as np, cv2
from PIL import Image
from scipy import ndimage as ndi
P=pickle.load(open('cut.pkl','rb'))
CW,CH,BASE=300,480,444
HMAX={'P':250,'N':335,'B':335,'R':240,'Q':400,'K':400}
WMAX=292
COL={'P':0,'N':1,'B':2,'R':3,'Q':4,'K':5}
sheet=Image.new('RGBA',(CW*6,CH*2),(0,0,0,0))
for key,img in P.items():
    color,t=key[0],key[1]
    a=img.copy()
    al=a[...,3]>127
    al=ndi.binary_erosion(al,iterations=1)          # 배경 테두리 번짐 제거
    a[...,3]=np.where(al,255,0).astype(np.uint8)
    # 알파만 부드럽게
    a[...,3]=cv2.GaussianBlur(a[...,3],(0,0),0.7)
    ys,xs=np.where(a[...,3]>10); a=a[ys.min():ys.max()+1,xs.min():xs.max()+1]
    h,w=a.shape[:2]
    s=min(WMAX/w,HMAX[t]/h)
    # 색 번짐 방지: 미리 곱한 알파로 리사이즈
    f=a.astype(np.float32); f[...,:3]*=f[...,3:]/255
    nw,nh=round(w*s),round(h*s)
    f=cv2.resize(f,(nw,nh),interpolation=cv2.INTER_CUBIC)
    f[...,3]=np.clip(f[...,3],0,255); al_=np.clip(f[...,3:]/255,1e-3,1)
    f[...,:3]=np.clip(f[...,:3]/al_,0,255)
    im=Image.fromarray(f.astype(np.uint8),'RGBA')
    c=COL[t]; r=0 if color=='w' else 1
    x=round(c*CW+CW/2-nw/2); y=r*CH+BASE-nh
    sheet.alpha_composite(im,(x,y))
    print(key,(nw,nh),round(s,2))
sheet.save('t-creature-pieces.png')
bg=Image.new('RGBA',sheet.size,(150,200,110,255)); bg.alpha_composite(sheet); bg.convert('RGB').resize((1200,600),Image.LANCZOS).save('sheet_check.png')
