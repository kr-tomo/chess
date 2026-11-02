import numpy as np, cv2
from PIL import Image
from scipy import ndimage as ndi
CW,CH=300,480
sh=np.array(Image.open('klawf_sheet_안2.png').convert('RGBA')); out=sh.copy()
def smooth_cell(cell):
    A=cell[...,3]; m=A>110
    lab,n=ndi.label(m); 
    if n==0: return cell
    sz=ndi.sum(m,lab,range(1,n+1)); keep=np.isin(lab,[i+1 for i,s in enumerate(sz) if s>=0.01*sz.max()])
    keep=ndi.binary_fill_holes(keep)
    # 가는 털/점 제거 + 요철 평탄화
    f=cv2.GaussianBlur(keep.astype(np.float32),(0,0),1.6)
    f=cv2.GaussianBlur((f>0.5).astype(np.float32),(0,0),0.9)
    newA=np.clip((f-0.5)*2.4+0.5,0,1)
    # 색: 불투명이던 곳은 유지, 새로 생긴 곳/가장자리는 가장 가까운 확실한 색으로 채워 번짐 제거
    solid=ndi.binary_erosion(A>200,iterations=2)
    idx=ndi.distance_transform_edt(~solid,return_distances=False,return_indices=True)
    col=cell[...,:3][idx[0],idx[1]]
    edge=(newA>0)&~solid
    rgb=np.where(edge[...,None],col,cell[...,:3])
    res=np.dstack([rgb,(newA*255).astype(np.uint8)]); return res
for c in range(6):
    box=(slice(CH,2*CH),slice(c*CW,(c+1)*CW))
    out[box]=smooth_cell(sh[box])
Image.fromarray(out).save('sheet_final.png')
# 비교 (확대)
def bgc(a,col=(160,84,60)):
    im=Image.fromarray(a); b=Image.new('RGBA',im.size,col+(255,)); b.alpha_composite(im); return b.convert('RGB')
before=bgc(sh[CH:2*CH,:]); after=bgc(out[CH:2*CH,:])
m=Image.new('RGB',(1800,2*CH)); m.paste(before.crop((0,0,1800,CH)),(0,0)); m.paste(after.crop((0,0,1800,CH)),(0,CH)); m.save('smooth_compare.png')
