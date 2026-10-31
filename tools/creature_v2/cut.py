import numpy as np, cv2, pickle
from scipy import ndimage as ndi
# (img, key): creature rect in original image coords x0,y0,x1,y1 ; card rect for bg palette
CARDS = {
 # key: (img, creature_rect, card_rect, dark)
 'wK':(1,(48,52,352,182),(37,23,358,271),0),
 'wQ':(1,(380,38,610,245),(369,23,698,271),0),
 'bK':(1,(745,32,968,262),(709,23,1039,271),1),
 'bQ':(1,(1085,32,1292,258),(1050,23,1380,271),1),
 'wR':(2,(38,22,300,208),(28,2,358,239),0),
 'wN':(2,(392,12,586,228),(369,2,699,239),0),
 'wB':(2,(750,34,924,212),(709,2,1039,239),0),
 'bR':(2,(38,262,300,448),(28,244,358,467),1),
 'bN':(2,(392,258,580,450),(369,244,699,467),1),
 'bB':(2,(748,284,898,450),(709,244,1039,467),1),
 'wP':(3,(55,25,225,222),(2,2,332,237),0),
 'bP':(3,(55,262,225,455),(2,243,332,466),1),
}
IM={n:cv2.imread(f'/home/claude/chess/work/new/img{n}.jpg') for n in (1,2,3)}
def cut(key):
    n,(x0,y0,x1,y1),(cx0,cy0,cx1,cy1),dark=CARDS[key]
    im=IM[n]; 
    # background palette: card interior minus creature rect (inset 14px to avoid border ornaments)
    ins=14
    reg=np.zeros(im.shape[:2],bool); reg[cy0+ins:cy1-ins,cx0+ins:cx1-ins]=True
    reg[y0:y1,x0:x1]=False
    px=im[reg].astype(np.float32)
    # drop text pixels (extreme brightness vs bg): keep via kmeans, k=5
    Z=px; crit=(cv2.TERM_CRITERIA_EPS+cv2.TERM_CRITERIA_MAX_ITER,30,1.0)
    _,lab,cen=cv2.kmeans(Z,6,None,crit,3,cv2.KMEANS_PP_CENTERS)
    cnt=np.bincount(lab.ravel(),minlength=6)
    pal=cen[cnt>len(Z)*0.04]
    sub=im[y0:y1,x0:x1].astype(np.float32)
    d=np.min(np.linalg.norm(sub[:,:,None,:]-pal[None,None],axis=3),axis=2)
    return d,pal
if __name__=='__main__':
    import sys
    for k in CARDS:
        d,pal=cut(k); print(k,len(pal),np.round(pal).astype(int).tolist())
