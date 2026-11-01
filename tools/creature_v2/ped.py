import pickle, numpy as np, cv2
from PIL import Image
from scipy import ndimage as ndi
CW,CH,BASE=300,480,444
src=Image.open('/home/claude/chess/work/new/sheet_before_ped.png').convert('RGBA')
P=pickle.load(open('/home/claude/chess/work/new/cut.pkl','rb'))
def clean(a):
    al=a[...,3]>127; lab,n=ndi.label(al); sz=ndi.sum(al,lab,range(1,n+1)); al=lab==1+int(np.argmax(sz))
    al=ndi.binary_opening(al,iterations=1); a=a.copy(); a[...,3]=np.where(al,255,0); return a
def pedestal(key,frac=0.27):
    a=clean(P[key]); h=a.shape[0]; b=a[int(h*(1-frac)):]
    ys,xs=np.where(b[...,3]>10); return Image.fromarray(b[ys.min():ys.max()+1,xs.min():xs.max()+1],'RGBA')
PED={0:pedestal('wP'),1:pedestal('bP')}
def bbox(im):
    a=np.array(im)[...,3]; ys,xs=np.where(a>8); return xs.min(),ys.min(),xs.max()+1,ys.max()+1
out=Image.new('RGBA',src.size,(0,0,0,0))
OVER=0.55
for r in (0,1):
    for c in range(6):
        cell=src.crop((c*CW,r*CH,(c+1)*CW,(r+1)*CH)); x0,y0,x1,y1=bbox(cell); cont=cell.crop((x0,y0,x1,y1))
        if c==0:                        # 폰 1.1배 (바닥선 유지)
            cont=cont.resize((round(cont.width*1.1),round(cont.height*1.1)),Image.LANCZOS)
            nc=Image.new('RGBA',(CW,CH),(0,0,0,0)); nc.alpha_composite(cont,(round(CW/2-cont.width/2),y1-cont.height))
        elif (r,c)==(0,5):              # 백 킹: 이미 받침 있음
            nc=cell
        else:
            if (r,c)==(1,4):            # 흑 퀸 가로 1.1배 (높이 유지)
                cont=cont.resize((round(cont.width*1.1),cont.height),Image.LANCZOS)
            ped=PED[r]; bw=int(np.clip(cont.width*0.78,170,236)); bh=round(bw*ped.height/ped.width)
            pi=ped.resize((bw,bh),Image.LANCZOS)
            nc=Image.new('RGBA',(CW,CH),(0,0,0,0))
            nc.alpha_composite(pi,(round(CW/2-bw/2),BASE-bh))
            nc.alpha_composite(cont,(round(CW/2-cont.width/2),round(BASE-bh*(1-OVER)-cont.height)))
        out.alpha_composite(nc,(c*CW,r*CH))
out.save('/home/claude/chess/work/new/sheet_ped.png')
bg=Image.new('RGBA',out.size,(150,120,100,255)); bg.alpha_composite(out); bg.convert('RGB').resize((1200,640),Image.LANCZOS).save('/home/claude/chess/work/new/sheet_ped_check.png')
