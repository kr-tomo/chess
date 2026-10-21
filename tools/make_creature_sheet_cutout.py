import numpy as np, cv2, sys
from scipy import ndimage as ndi
im=cv2.imread('../src/creature-source.png'); H,W=im.shape[:2]
rgb=im[:,:,::-1].astype(np.float32)
BG=np.array([183.,187.,190.],np.float32)
d=np.sqrt(((rgb-BG)**2).sum(2))

# ---- 라벨 글씨 지우기 (페디스털 앞면)
LAB={ # (row,col): (x0,y0,x1,y1)
 (0,0):(36,310,152,340),(0,1):(216,315,294,340),(0,2):(383,314,464,340),(0,3):(578,312,642,338),(0,4):(724,318,840,342),(0,5):(884,316,990,340),
 (1,0):(36,728,148,754),(1,1):(212,728,292,752),(1,2):(386,728,464,754),(1,3):(576,726,636,752),(1,4):(722,728,838,760),(1,5):(886,732,994,764)}
clean=im.copy()
gray=cv2.cvtColor(im,cv2.COLOR_BGR2GRAY)
med=cv2.medianBlur(gray,25)
mask=np.zeros((H,W),np.uint8)
for (r,c),(x0,y0,x1,y1) in LAB.items():
    diff=gray[y0:y1,x0:x1].astype(np.int16)-med[y0:y1,x0:x1].astype(np.int16)
    sub=(diff<-18) if r==0 else (diff>9)
    mask[y0:y1,x0:x1]=sub.astype(np.uint8)*255
mask=cv2.dilate(mask,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(3,3)),iterations=1)
clean=cv2.inpaint(clean,mask,3,cv2.INPAINT_TELEA)
cv2.imwrite('clean.png',clean)
rgb=clean[:,:,::-1].astype(np.float32)
d=np.sqrt(((rgb-BG)**2).sum(2))

# ---- 전경 마스크
def fgmask(tol, hole=120):
    cand=d<tol
    lab,n=ndi.label(cand)
    border=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
    sizes=ndi.sum(cand,lab,range(n+1))
    bg=np.zeros_like(cand)
    for i in range(1,n+1):
        if i in border or sizes[i]>hole: bg|=(lab==i)
    return ~bg

SPLIT_TOP=[0,168,352,513,709,862,1024]; SPLIT_BOT=[0,168,352,513,697,864,1024]
fg10=fgmask(10); fg26=fgmask(26,400)
pieces={}
for r in (0,1):
    ys=(0,400) if r==0 else (430,820)
    sp=SPLIT_TOP if r==0 else SPLIT_BOT
    for c in range(6):
        x0,x1=sp[c],sp[c+1]
        tol = fg26 if (r==0 and c==4) else fg10
        m=np.zeros((H,W),bool); m[ys[0]:ys[1],x0:x1]=tol[ys[0]:ys[1],x0:x1]
        m=ndi.binary_opening(m,iterations=1)
        lab,n=ndi.label(ndi.binary_dilation(m,iterations=3))
        if n==0: raise SystemExit('empty piece %d %d'%(r,c))
        sizes=ndi.sum(m,lab,range(1,n+1)); keep=np.zeros_like(m)
        big=max(sizes)
        for i,s in enumerate(sizes,1):
            if s>=big*0.02: keep|=(lab==i)&m
        keep=ndi.binary_closing(keep,iterations=2)
        keep=ndi.binary_fill_holes(keep) & (m | ndi.binary_dilation(keep,iterations=3))
        # 알파: 경계 띠에서만 배경과의 거리로 부드럽게
        band=ndi.binary_dilation(keep,iterations=3)&~ndi.binary_erosion(keep,iterations=3)
        a=np.where(keep,1.0,0.0).astype(np.float32)
        ar=np.clip((d-5)/22,0,1)
        a=np.where(band,np.where(ndi.binary_dilation(keep,iterations=3),ar,0),a)
        a=np.where(keep&~band,1.0,a)
        a=cv2.GaussianBlur(a,(0,0),0.6)
        a=np.where(keep|band,a,0)
        # 배경색 오염 제거
        al=np.clip(a,1e-3,1)[...,None]
        col=np.clip((rgb-(1-al)*BG)/al,0,255)
        col=np.where(a[...,None]>0.98,rgb,col)
        out=np.dstack([col,(a*255)[...,None]]).astype(np.uint8)
        ysl,xsl=np.where(a>0.02)
        bx0,bx1,by0,by1=xsl.min(),xsl.max()+1,ysl.min(),ysl.max()+1
        # 페디스털 중심: 아래쪽 12% 의 가로 중앙
        hh=by1-by0; low=(a[by1-int(hh*0.12):by1,:]>0.5); xs=np.where(low.any(0))[0]
        cx=(xs.min()+xs.max())/2
        pieces[(r,c)]=dict(img=out[by0:by1,bx0:bx1],cx=cx-bx0,w=bx1-bx0,h=hh)
        print(r,c,'bbox',bx0,by0,bx1,by1,'size',bx1-bx0,hh)
import pickle; pickle.dump(pieces,open('pieces.pkl','wb'))
