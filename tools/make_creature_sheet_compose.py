import pickle, numpy as np
from PIL import Image
from enhance import enhance_dark
P=pickle.load(open('pieces.pkl','rb'))
CWp,CHp=300,480            # 칸 하나 (100 x 140 단위 x3)
BASE_Y=444                 # 페디스털 바닥선 (128단위)
tallest=max(p['h'] for p in P.values())
S=435/tallest              # 가장 큰 기물이 125단위가 되도록 모든 기물에 같은 배율
sheet=Image.new('RGBA',(CWp*6,CHp*2),(0,0,0,0))
for (r,c),p in P.items():
    img=p['img']
    if r==1:   # 흑 기물: 어두운 분위기는 유지하면서 그림자 속 디테일을 끌어올림 (루나아라/퀸은 이미 선명해 약하게)
        img=enhance_dark(img,clip=0.02,gamma=0.82,sharp=0.7,sat=1.25,mix=0.25 if c==4 else 0.6)
    im=Image.fromarray(img,'RGBA')
    w,h=im.size; nw,nh=round(w*S),round(h*S)
    im=im.resize((nw,nh),Image.LANCZOS)
    x=round(c*CWp+CWp/2-p['cx']*S); y=r*CHp+BASE_Y-nh
    sheet.alpha_composite(im,(x,y))
sheet.save('../assets/sprites/t-creature-pieces.png')
print('scale',round(S,3),sheet.size)
bg=Image.new('RGBA',sheet.size,(150,200,110,255)); bg.alpha_composite(sheet); bg.convert('RGB').resize((1200,560),Image.LANCZOS).save('sheet_check.png')
