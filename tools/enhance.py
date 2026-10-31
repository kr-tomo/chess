import numpy as np, cv2
from skimage import exposure
def enhance_dark(rgba, clip=0.03, gamma=0.68, sharp=0.9, sat=1.18, mix=0.8):
    a=rgba[...,3]; rgb=rgba[...,:3]
    lab=cv2.cvtColor(rgb,cv2.COLOR_RGB2LAB).astype(np.float32)
    L=lab[...,0]/255.0
    m=a>200
    fill=L.copy(); fill[~m]=L[m].mean() if m.any() else 0
    # 국소 대비(CLAHE) + 그림자 들어올리기
    eq=exposure.equalize_adapthist(fill,kernel_size=max(24,min(rgb.shape[:2])//6),clip_limit=clip)
    L2=np.clip(eq,0,1)**gamma
    L2=mix*L2+(1-mix)*L
    # 디테일 선명화
    bl=cv2.GaussianBlur(L2,(0,0),1.6); L3=np.clip(L2+sharp*(L2-bl),0,1)
    lab[...,0]=L3*255
    lab[...,1]=128+(lab[...,1]-128)*sat; lab[...,2]=128+(lab[...,2]-128)*sat
    out=cv2.cvtColor(np.clip(lab,0,255).astype(np.uint8),cv2.COLOR_LAB2RGB)
    return np.dstack([out,a])
