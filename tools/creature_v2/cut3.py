import numpy as np, cv2, pickle
from scipy import ndimage as ndi
from cut import CARDS, IM
EXC={'bK':[(937,183,1015,252)],'bQ':[(1250,178,1372,248)],'wK':[(230,178,352,242)],'wR':[(243,100,335,168)],'bR':[(243,325,335,394)],'wP':[(198,85,330,168)],'bP':[(198,326,330,412)]}
TH={'wK':34,'wQ':30,'wR':34,'wN':14,'wB':30,'wP':26,'bK':4.5,'bQ':7,'bR':8,'bN':7,'bB':8,'bP':6}
CLOSE={'wN':4,'wQ':9,'wK':2,'wP':2,'wB':2,'wR':6}
def feat(a,dark):
    a=a.astype(np.float32)
    return np.log1p(a)*30 if dark else a
out={}
DBG={}
for k,(n,(x0,y0,x1,y1),(cx0,cy0,cx1,cy1),dark) in CARDS.items():
    im=IM[n]; ins=14
    reg=np.zeros(im.shape[:2],bool); reg[cy0+ins:cy1-ins,cx0+ins:cx1-ins]=True; reg[y0:y1,x0:x1]=False
    px=feat(im[reg],dark)
    crit=(cv2.TERM_CRITERIA_EPS+cv2.TERM_CRITERIA_MAX_ITER,30,1.0)
    _,lab,cen=cv2.kmeans(px,6,None,crit,3,cv2.KMEANS_PP_CENTERS)
    cnt=np.bincount(lab.ravel(),minlength=6)
    raw=np.expm1(cen/30) if dark else cen
    br=raw.mean(1)
    pal=cen[(cnt>len(px)*0.04)&((br<60) if dark else (br>150))]
    sub=im[y0:y1,x0:x1]
    d=np.min(np.linalg.norm(feat(sub,dark)[:,:,None,:]-pal[None,None],axis=3),axis=2)
    fg=d>TH[k]
    DBG[k]=(sub.copy(),fg.copy())
    for (ex0,ey0,ex1,ey1) in EXC.get(k,[]):
        fg[max(0,ey0-y0):max(0,ey1-y0),max(0,ex0-x0):max(0,ex1-x0)]=False
    if not dark:
        fg=ndi.binary_opening(fg,iterations=1)
    else:
        # 대리석 결(가는 선)은 열림 연산으로 제거하고, 남은 본체에서 원래 마스크 안으로만 다시 키움
        st3=cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(7,7)).astype(bool)
        core=ndi.binary_opening(fg,structure=st3)
        lab0,n0=ndi.label(core); sz=ndi.sum(core,lab0,range(1,n0+1)); core=np.isin(lab0,[i+1 for i,v in enumerate(sz) if v>=0.04*sz.max()])
        fg=ndi.binary_dilation(core,structure=np.ones((3,3)),iterations=5,mask=fg)|core
    # grabcut refinement
    gc=np.where(fg,cv2.GC_PR_FGD,cv2.GC_PR_BGD).astype(np.uint8)
    gc[ndi.binary_erosion(fg,iterations=2)]=cv2.GC_FGD
    gc[~ndi.binary_dilation(fg,iterations=4)]=cv2.GC_BGD
    bgm=np.zeros((1,65));fgm=np.zeros((1,65))
    inp=sub.astype(np.uint8)
    if dark: inp=np.clip((inp/255.0)**0.45*255,0,255).astype(np.uint8)
    cv2.grabCut(inp,gc,None,bgm,fgm,3,cv2.GC_INIT_WITH_MASK)
    m=(gc==cv2.GC_FGD)|(gc==cv2.GC_PR_FGD)
    m|=ndi.binary_erosion(fg,iterations=1)
    for (ex0,ey0,ex1,ey1) in EXC.get(k,[]):
        m[max(0,ey0-y0):max(0,ey1-y0),max(0,ex0-x0):max(0,ex1-x0)]=False
    lab,nn=ndi.label(ndi.binary_dilation(m,iterations=3))
    sizes=ndi.sum(m,lab,range(1,nn+1)); big=max(sizes); keep=np.zeros_like(m)
    for i,s in enumerate(sizes,1):
        if s>=big*0.999: keep|=(lab==i)&m
    r=CLOSE.get(k,1)
    st=cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(2*r+1,2*r+1)).astype(bool)
    pad=np.pad(keep,r+1)
    big_=ndi.binary_dilation(pad,structure=st); big_=ndi.binary_fill_holes(big_); big_=ndi.binary_erosion(big_,structure=st)
    keep=(big_|pad)[r+1:-(r+1),r+1:-(r+1)]
    keep=ndi.binary_fill_holes(keep)
    ys,xs=np.where(keep)
    rgba=np.dstack([sub[:,:,::-1],(keep*255).astype(np.uint8)])
    out[k]=rgba[ys.min():ys.max()+1,xs.min():xs.max()+1]
pickle.dump(out,open('cut.pkl','wb'))
from PIL import Image
order=['wP','wN','wB','wR','wQ','wK','bP','bN','bB','bR','bQ','bK']
cw,ch=330,300
M=Image.new('RGB',(cw*6,ch*2),(120,180,100))
for i,k in enumerate(order):
    a=Image.fromarray(out[k]); s=min((cw-10)/a.width,(ch-10)/a.height); a=a.resize((round(a.width*s),round(a.height*s)),Image.NEAREST)
    M.paste(a,((i%6)*cw+(cw-a.width)//2,(i//6)*ch+ch-a.height-5),a)
M.save('montage.png')

import sys
rows=[]
for k in ['bB','bP','bR','bN']:
    sub,fg=DBG[k]; h=sub.shape[0]
    a=sub[:,:,::-1] if False else sub
    g=np.clip((a/255.0)**0.45*255,0,255).astype(np.uint8)
    f=np.repeat((fg*255).astype(np.uint8)[:,:,None],3,2)
    rows.append((np.hstack([g,f]),k))
from PIL import Image
W=max(r[0].shape[1] for r in rows)
H=sum(r[0].shape[0] for r in rows)
canvas=np.zeros((H,W,3),np.uint8); y=0
for r,k in rows:
    canvas[y:y+r.shape[0],:r.shape[1]]=r; y+=r.shape[0]
cv2.imwrite('dbg.png',cv2.resize(canvas,None,fx=1.5,fy=1.5,interpolation=cv2.INTER_NEAREST))
