import pickle, numpy as np
from PIL import Image
P=pickle.load(open('pieces.pkl','rb'))
CWp,CHp=300,480            # 칸 하나 (100 x 140 단위 x3)
BASE_Y=444                 # 페디스털 바닥선 (128단위)
tallest=max(p['h'] for p in P.values())
S=435/tallest              # 가장 큰 기물이 125단위가 되도록 모든 기물에 같은 배율
sheet=Image.new('RGBA',(CWp*6,CHp*2),(0,0,0,0))
for (r,c),p in P.items():
    im=Image.fromarray(p['img'],'RGBA')
    w,h=im.size; nw,nh=round(w*S),round(h*S)
    im=im.resize((nw,nh),Image.LANCZOS)
    x=round(c*CWp+CWp/2-p['cx']*S); y=r*CHp+BASE_Y-nh
    sheet.alpha_composite(im,(x,y))
sheet.save('../t-creature-pieces.png')
print('scale',round(S,3),sheet.size)
bg=Image.new('RGBA',sheet.size,(150,200,110,255)); bg.alpha_composite(sheet); bg.convert('RGB').resize((1200,560),Image.LANCZOS).save('sheet_check.png')
