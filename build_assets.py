#!/usr/bin/env python3
"""테마별 스프라이트(SVG)와 아이콘을 생성한다.  python3 build_assets.py [--preview 디렉터리]

기물 시트: 6열 x 2행, 칸 하나 = 100 x 140 (세로로 큰 입체 기물). 열 순서 P N B R Q K, 윗줄 = 백, 아랫줄 = 흑.
보드 시트: 8열 x 1행, 칸 하나 = 100 x 100. light, dark, select, dot, ring, last, check, hint.
"""
import math, os, re, sys

try:
    from PIL import Image, ImageDraw
except Exception:
    Image = None

OUT = os.path.dirname(os.path.abspath(__file__))
TYPES = ['P', 'N', 'B', 'R', 'Q', 'K']
CW, CH = 100, 140


# ---------------------------------------------------------------- 기하 (역할, 도형, 인자...)
def stem(yt, wt, wb=16, yb=111):
    a = yt + (yb - yt) * 0.45
    b = yt + (yb - yt) * 0.70
    return (f"M{50-wt} {yt} C{50-wt} {a:.1f} {50-wb+5} {b:.1f} {50-wb} {yb} L{50+wb} {yb} "
            f"C{50+wb-5} {b:.1f} {50+wt} {a:.1f} {50+wt} {yt} Z")


PLINTH = [('body', 'R', 21, 119, 58, 9, 4.5), ('body', 'R', 26, 112, 48, 8, 4),
          ('body', 'E', 50, 111, 22, 3.4),
          ('fine', 'P', "M23.5 123.6 H76.5"), ('fine', 'P', "M28.5 116.2 H71.5")]


def ring(y, rx, ry=3.6):
    return ('body', 'E', 50, y, rx, ry)


def beads(y, x0, x1, n, r):
    return [('bead', 'C', x0 + (x1 - x0) * k / (n - 1), y, r) for k in range(n)]


def classic_parts(t):
    if t == 'P':
        return PLINTH + [('body', 'P', stem(66, 6.5, 15.5, 110)), ring(88, 12.5, 3), ring(68, 14.5, 4),
                         ('body', 'R', 36, 62, 28, 6, 3), ('fine', 'P', "M38 64.6 H62"),
                         ('body', 'E', 50, 62, 10.5, 2.4), ('body', 'C', 50, 49, 12.5),
                         ('hl', 'E', 45.5, 44.5, 4, 3.2), ('hl', 'C', 43, 42.5, 1.4)]
    if t == 'R':
        return PLINTH + [('body', 'P', stem(70, 10, 16.5, 110)), ring(92, 13.5, 3), ring(72, 15, 3.6),
                         ('body', 'P', "M34 70 L36.5 48 H63.5 L66 70 Z"),
                         ('fine', 'P', "M36 58 H64"), ('fine', 'P', "M35 64 H65"),
                         ('body', 'R', 31, 41, 38, 8, 2.5),
                         ('body', 'R', 34, 24, 32, 12, 0),
                         ('inner', 'R', 34, 24, 32, 12, 0),
                         ('body', 'P', "M31 41 V22 H41 V30 H45 V22 H55 V30 H59 V22 H69 V41 Z"),
                         ('dark', 'R', 47.5, 53, 5, 11, 2), ('dark', 'R', 38, 53, 3.6, 8, 1.6),
                         ('dark', 'R', 58.4, 53, 3.6, 8, 1.6),
                         ('hl', 'E', 36.5, 33, 2.4, 8), ('line', 'P', "M31.5 41 H68.5"),
                         ('fine', 'P', "M41 22 V30 M45 22 V30 M55 22 V30 M59 22 V30")]
    if t == 'B':
        return PLINTH + [('body', 'P', stem(70, 7, 15.5, 110)), ring(90, 12.5, 3), ring(72, 15, 3.8)] + \
               beads(66.4, 40, 60, 6, 1.5) + [
                         ('body', 'R', 37, 63, 26, 6, 3),
                         ('body', 'P', "M50 20 C62 30 68 44 63 57 C61 62 57 64 50 64 C43 64 39 62 37 57 C32 44 38 30 50 20 Z"),
                         ('fine', 'P', "M38.5 58 C45 61 55 61 61.5 58"),
                         ('body', 'E', 50, 22.5, 5.4, 2.2), ('body', 'C', 50, 17, 5.4),
                         ('dark', 'P', "M55.5 33 C58.6 36 54.2 44 44.6 49.8 C48 43 52 38 55.5 33 Z"),
                         ('hl', 'E', 42.5, 43, 2.8, 8), ('hl', 'C', 48.2, 14.8, 1.5)]
    if t == 'Q':
        return PLINTH + [('body', 'P', stem(72, 8.5, 17, 110)), ring(92, 14, 3.2), ring(74, 16.5, 4),
                         ('body', 'R', 33, 66, 34, 7, 3.5),
                         ('body', 'P', "M32 62 L29 25 L34.5 40 L39 17 L44.5 36 L50 13 L55.5 36 L61 17 L65.5 40 L71 25 L68 62 "
                                       "C66 68 58 70 50 70 C42 70 34 68 32 62 Z"),
                         ('inner', 'P', "M44.5 36 L50 13 L55.5 36 L50 52 Z"),
                         ('body', 'E', 50, 61, 19.5, 4.4)] + beads(61.4, 34, 66, 9, 1.5) + [
                         ('body', 'C', 29, 23, 3.4), ('body', 'C', 39, 15.5, 3.4), ('body', 'C', 50, 11.5, 3.6),
                         ('body', 'C', 61, 15.5, 3.4), ('body', 'C', 71, 23, 3.4),
                         ('body', 'C', 50, 50, 2.4), ('body', 'C', 41, 53, 1.8), ('body', 'C', 59, 53, 1.8),
                         ('line', 'P', "M40 48 L41 59 M60 48 L59 59"), ('hl', 'E', 42, 44, 2.4, 8),
                         ('hl', 'C', 38.5, 14, 1.2), ('hl', 'C', 49, 10, 1.3)]
    if t == 'K':
        return PLINTH + [('body', 'P', stem(72, 8.5, 17, 110)), ring(92, 14, 3.2), ring(74, 16.5, 4),
                         ('body', 'R', 33, 66, 34, 7, 3.5),
                         ('body', 'P', "M32 64 C29 48 37 36 50 36 C63 36 71 48 68 64 C60 69 40 69 32 64 Z"),
                         ('body', 'E', 50, 62, 19, 4.4)] + beads(62.3, 34.5, 65.5, 9, 1.5) + [
                         ('line', 'P', "M38 59 C37 48 43 40 50 38 C57 40 63 48 62 59"),
                         ('line', 'P', "M50 38 V59"),
                         ('body', 'R', 46, 5, 8, 32, 2.5), ('body', 'R', 38, 12, 24, 8, 2.5),
                         ('body', 'C', 50, 6, 4), ('body', 'C', 38.5, 16, 3.8), ('body', 'C', 61.5, 16, 3.8),
                         ('body', 'C', 50, 16, 2.4), ('fine', 'P', "M50 10 V33"),
                         ('hl', 'E', 41.5, 50, 2.6, 8)]
    if t == 'N':
        return PLINTH + [('body', 'P', stem(96, 12, 17, 110)), ring(98, 14.5, 3.2),
                         ('body', 'P',
                          "M30 104 C28 94 31 86 37 80 C41 76 42 73 38 71 C29 69 22 65 20 59 C19 55 21 52 25 50 "
                          "C29 48 32 45 33 41 L34 31 L37 22 L41 29 C43 25 45 21 47 18 L49 28 "
                          "C60 30 70 44 71 64 C72 80 71 94 69 104 Z"),
                         ('inner', 'P', "M49 30 C59 33 66 46 67 66 C67 78 66 90 64 102 C62 90 62 78 61 66 C60 50 55 38 49 30 Z"),
                         ('inner', 'P', "M45 38 C52 42 58 54 59 68 C59 78 58 88 56 98 C55 86 55 74 53 64 C51 54 48 46 45 38 Z"),
                         ('inner', 'P', "M35.5 33 L37 24.5 L40.5 30 Z"), ('inner', 'P', "M44 28 L47 20 L48.5 28 Z"),
                         ('line', 'P', "M49 30 C59 33 65 45 66 62 C67 76 66 90 64 102"),
                         ('line', 'P', "M45 38 C52 42 58 54 59 68 C60 80 59 90 57 98"),
                         ('line', 'P', "M42 48 C47 54 51 64 52 76"),
                         ('fine', 'P', "M40 56 C44 62 44 70 40 74 M29 74 C34 78 40 78 44 74"),
                         ('line', 'P', "M23 59 Q29 65 36 63"),
                         ('line', 'P', "M25 51 L34 58 M35 44 C39 52 38 60 33 66"),
                         ('groove', 'E', 34.5, 40, 4.4, 3.5), ('dark', 'C', 34.5, 40.2, 2.7),
                         ('dark', 'E', 22.5, 56.5, 1.5, 2.4), ('fine', 'P', "M21 53 C24 52 26 54 26 56"),
                         ('white', 'C', 33.6, 39.3, 0.9), ('hl', 'E', 38, 78, 2.4, 6), ('hl', 'E', 30, 50, 1.4, 3)]
    raise KeyError(t)


def creature_parts(t):
    if t == 'P':   # 슬라임
        return [('body', 'P', "M25 121 C20 100 30 78 50 76 C70 78 80 100 75 121 C70 127 30 127 25 121 Z"),
                ('belly', 'E', 50, 108, 16, 11),
                ('accent', 'P', "M50 77 C47 66 53 59 63 61 C61 70 57 75 50 77 Z"),
                ('white', 'C', 40, 94, 6.5), ('white', 'C', 60, 94, 6.5),
                ('dark', 'C', 41, 95, 3.2), ('dark', 'C', 59, 95, 3.2),
                ('line', 'P', "M45 105 Q50 110 55 105"), ('hl', 'E', 36, 84, 5, 3)]
    if t == 'N':   # 뿔 달린 짐승
        return [('accent', 'P', "M36 40 L30 12 L45 33 Z"),
                ('accent', 'P', "M54 36 C70 38 80 54 80 74 C76 62 68 54 58 50 Z"),
                ('body', 'P',
                 "M30 122 C30 106 32 96 38 86 C32 86 26 82 24 76 C22 72 20 70 18 66 C16 62 18 58 22 54 "
                 "C26 50 30 46 32 42 L36 32 L44 38 C48 36 52 36 54 38 C66 46 72 64 72 84 "
                 "C72 98 70 112 68 122 Z"),
                ('belly', 'E', 40, 100, 9, 14),
                ('white', 'C', 36, 52, 5), ('dark', 'C', 35, 53, 2.6),
                ('dark', 'C', 21, 64, 1.5), ('line', 'P', "M32 72 Q38 76 44 72")]
    if t == 'B':   # 올빼미 마법사
        return [('body', 'P', "M29 122 C23 98 29 64 50 58 C71 64 77 98 71 122 C66 128 34 128 29 122 Z"),
                ('belly', 'E', 50, 100, 15, 20),
                ('accent', 'P', "M33 64 L50 14 L67 64 C58 68 42 68 33 64 Z"),
                ('accent', 'E', 50, 64, 23, 5), ('white', 'C', 50, 16, 4),
                ('white', 'C', 41, 82, 8), ('white', 'C', 59, 82, 8),
                ('dark', 'C', 42, 83, 4), ('dark', 'C', 58, 83, 4),
                ('accent', 'P', "M46 90 L54 90 L50 98 Z")]
    if t == 'R':   # 바위 골렘
        return [('body', 'E', 23, 100, 8, 11), ('body', 'E', 77, 100, 8, 11),
                ('body', 'P', "M28 122 L30 70 H36 V60 H44 V70 H56 V60 H64 V70 H70 L72 122 Z"),
                ('belly', 'R', 36, 80, 28, 24, 7),
                ('dark', 'C', 44, 91, 3.2), ('dark', 'C', 56, 91, 3.2), ('line', 'P', "M44 99 Q50 103 56 99"),
                ('line', 'P', "M31 114 H69")]
    if t == 'Q':   # 요정
        return [('accent', 'E', 29, 82, 19, 28), ('accent', 'E', 71, 82, 19, 28),
                ('belly', 'E', 31, 86, 11, 17), ('belly', 'E', 69, 86, 11, 17),
                ('body', 'P', "M36 122 C34 104 38 82 50 78 C62 82 66 104 64 122 C58 128 42 128 36 122 Z"),
                ('belly', 'E', 50, 104, 9, 14),
                ('body', 'C', 50, 62, 15),
                ('white', 'C', 44, 62, 4.5), ('white', 'C', 56, 62, 4.5),
                ('dark', 'C', 44, 63, 2.3), ('dark', 'C', 56, 63, 2.3), ('line', 'P', "M46 71 Q50 74 54 71"),
                ('accent', 'P', "M38 52 L39 34 L46 43 L50 30 L54 43 L61 34 L62 52 Z"), ('white', 'C', 50, 28, 3)]
    if t == 'K':   # 왕관 드래곤
        return [('accent', 'P', "M26 84 L10 62 L18 92 Z"), ('accent', 'P', "M74 84 L90 62 L82 92 Z"),
                ('body', 'E', 50, 94, 27, 30),
                ('belly', 'E', 50, 104, 17, 20),
                ('accent', 'P', "M32 72 L26 52 L40 66 Z"), ('accent', 'P', "M68 72 L74 52 L60 66 Z"),
                ('white', 'C', 40, 84, 6), ('white', 'C', 60, 84, 6),
                ('dark', 'C', 41, 85, 3), ('dark', 'C', 59, 85, 3), ('line', 'P', "M43 98 Q50 103 57 98"),
                ('accent', 'P', "M36 68 L38 44 L45 54 L50 38 L55 54 L62 44 L64 68 Z"), ('white', 'C', 50, 46, 3.4)]
    raise KeyError(t)


def lego_parts(t):
    out = []

    def brick(x, y, w, h, n=0):
        out.append(('body', 'R', x, y, w, h, 2.2))
        out.append(('hl', 'R', x + 2.2, y + 2, 3, h - 4, 1.5))
        for k in range(n):
            sx = x + w * (k + .5) / n
            out.append(('body', 'R', sx - 4.6, y - 3.6, 9.2, 5, 2))
            out.append(('body', 'E', sx, y - 3.6, 4.6, 2.2))

    def rbrick(cx, y, w, h, studs=True):   # 원통형(둥근) 브릭
        out.append(('body', 'R', cx - w / 2, y, w, h, w / 2.6))
        out.append(('hl', 'R', cx - w / 2 + 3, y + 4, 3, h - 8, 1.5))
        if studs:
            out.append(('body', 'R', cx - 4.6, y - 3.4, 9.2, 5, 2))
            out.append(('body', 'E', cx, y - 3.4, 4.6, 2.2))

    # 공통 받침: 넓은 판 + 한 단
    brick(22, 113, 56, 13, 5)
    if t == 'P':
        brick(32, 98, 36, 15, 3)
        rbrick(50, 72, 28, 26)
    elif t == 'R':
        brick(31, 98, 38, 15, 3)
        brick(31, 82, 38, 16, 3)
        brick(27, 64, 46, 18, 0)
        for x in (27, 43.7, 60.4):
            brick(x, 51, 12.6, 13, 1)
    elif t == 'N':
        brick(31, 98, 38, 15, 3)
        out.append(('body', 'P', "M31 98 V70 L27 62 V52 L40 38 L42 26 L52 28 L58 38 L69 48 V98 Z"))
        out.append(('hl', 'R', 34, 70, 3, 22, 1.5))
        out.append(('body', 'R', 45.4, 22, 9.2, 5, 2)); out.append(('body', 'E', 50, 22, 4.6, 2.2))
        out.append(('body', 'R', 58, 44, 9.2, 5, 2)); out.append(('body', 'E', 62.6, 44, 4.6, 2.2))
        out.append(('dark', 'C', 41, 48, 2.8)); out.append(('hl', 'C', 40.2, 47.2, 0.9))
        out.append(('dark', 'E', 29.5, 57, 1.6, 2.4))
        out.append(('line', 'P', "M54 36 L62 52 L62 90"))
    elif t == 'B':
        brick(33, 98, 34, 15, 3)
        brick(37, 78, 26, 20, 0)
        rbrick(50, 54, 24, 24, False)
        out.append(('body', 'R', 45, 46, 10, 6, 2)); out.append(('body', 'E', 50, 46, 5, 2.4))
        out.append(('body', 'C', 50, 40, 5))
        out.append(('dark', 'P', "M53 56 L58 58 L49 74 L45 72 Z"))
    elif t == 'Q':
        brick(33, 98, 34, 15, 3)
        brick(36, 76, 28, 22, 0)
        brick(30, 62, 40, 14, 0)
        for x, h in ((30, 22), (38.6, 14), (47.2, 28), (55.8, 14), (64.4, 22)):
            out.append(('body', 'R', x, 62 - h, 8.2, h, 2))
            out.append(('body', 'C', x + 4.1, 62 - h, 4.6))
    elif t == 'K':
        brick(33, 98, 34, 15, 3)
        brick(36, 76, 28, 22, 0)
        brick(30, 62, 40, 14, 0)
        brick(33, 50, 34, 12, 0)
        out.append(('body', 'R', 44, 12, 12, 40, 2.2))
        out.append(('body', 'R', 33, 22, 34, 12, 2.2))
        out.append(('hl', 'R', 46, 16, 3, 32, 1.5))
        out.append(('body', 'R', 45.4, 8, 9.2, 5, 2)); out.append(('body', 'E', 50, 8, 4.6, 2.2))
    return out


# ---------------------------------------------------------------- 테마 정의
def cyl(stops):
    return dict(kind='h', stops=stops)


def vert(top, bottom):
    return dict(kind='v', stops=[top, bottom])


THEMES = [
    dict(id='classic', name='클래식 우드', parts=classic_parts, shine=.75, felt='#1d3a24',
         tex=dict(f=(.55, .018, 11), w=(.45, .30, .10), sw=.22, b=(.75, .55, .40), sb=.10),
         w=dict(fill=cyl(['#e6d6ae', '#fffaf0', '#e8d8ae', '#a68c5a']), stroke='#4a3418', line='#6b4c22', so=.75),
         b=dict(fill=cyl(['#4a382c', '#9a7e68', '#3d2a1e', '#120a05']), stroke='#000000', line='#000000', so=.85),
         board=dict(light='#ecd6ae', dark='#a9703f', grain=True, ov=('#f6f669', '#146432', '#cdd26a', '#3b82f6')),
         ui=dict(bg1='#3d2c20', bg2='#120b07', f1='#6b4423', f2='#2e1c0e', filter='drop-shadow(0 3px 2px rgba(0,0,0,.45))')),
    dict(id='steel', name='스틸 & 네이비', parts=classic_parts, shine=.95, felt='#101a2c',
         tex=dict(f=(.02, .75, 5), w=(1, 1, 1), sw=.10, b=(.7, .8, 1), sb=.10),
         w=dict(fill=cyl(['#aab3bd', '#ffffff', '#cfd6de', '#6f7a87']), stroke='#2a3038', line='#4b5560', so=.8),
         b=dict(fill=cyl(['#26344f', '#8aa2cc', '#1b2a47', '#060b18']), stroke='#04070f', line='#02040a', so=.9),
         board=dict(light='#efe7d4', dark='#25262b', grain=False, ov=('#f6f669', '#146432', '#cdd26a', '#3b82f6')),
         ui=dict(bg1='#1f5560', bg2='#07151b', f1='#b98f58', f2='#5b3f24', filter='drop-shadow(0 3px 2px rgba(0,0,0,.5))')),
    dict(id='lego', name='레고 블럭', parts=lego_parts, shine=.55,
         w=dict(fill=vert('#ff6a5c', '#c7281c'), stroke='#6e0f08', line='#6e0f08', so=.9, sw=1.8),
         b=dict(fill=vert('#4f95ff', '#1646b8'), stroke='#08205e', line='#08205e', so=.9, sw=1.8),
         board=dict(light='#e8e1cc', dark='#7ea06c', grain=False, studs=True, ov=('#ffd91a', '#0d5c9e', '#ffe97a', '#ff7a1a')),
         ui=dict(bg1='#2a4f7a', bg2='#0a1624', f1='#f2c500', f2='#8a6f00', filter='drop-shadow(0 3px 2px rgba(0,0,0,.45))')),
    dict(id='creature', name='포켓몬스터', parts=creature_parts, scale=1.1, shine=.45, custom_png=True,
         w=dict(fill=vert('#ffd89a', '#ec7a22'), belly='#fff3d2', accent='#e23b2e', stroke='#6a2b0c', line='#6a2b0c', so=.9, sw=1.8),
         b=dict(fill=vert('#9ad6ff', '#2f6fd6'), belly='#e8f6ff', accent='#1f46a8', stroke='#0f2a66', line='#0f2a66', so=.9, sw=1.8),
         board=dict(light='#d3ec9f', dark='#8fc964', grain=False, dots=True, ov=('#fff06a', '#1a6b30', '#f5e36a', '#4a8cff')),
         ui=dict(bg1='#3f8650', bg2='#10261a', f1='#8c5a2a', f2='#4d2f14', filter='drop-shadow(0 3px 2px rgba(0,0,0,.4))')),
]


# ---------------------------------------------------------------- SVG 출력
def geo(shape, a):
    if shape == 'P':
        return 'path', f'd="{a[0]}"'
    if shape == 'C':
        return 'circle', f'cx="{a[0]}" cy="{a[1]}" r="{a[2]}"'
    if shape == 'E':
        return 'ellipse', f'cx="{a[0]}" cy="{a[1]}" rx="{a[2]}" ry="{a[3]}"'
    if shape == 'R':
        return 'rect', f'x="{a[0]}" y="{a[1]}" width="{a[2]}" height="{a[3]}" rx="{a[4]}"'
    raise ValueError(shape)


TW = TB = None


def part_svg(p, team, tid):
    role, shape, *a = p
    tag, g = geo(shape, a)
    sid = 'w' if team is TW else 'b'
    sw = team.get('sw', 1.5)
    st = f'stroke="{team["stroke"]}" stroke-opacity="{team["so"]}" stroke-width="{{w}}" stroke-linejoin="round"'
    shine = f'<{tag} {g} fill="url(#sh{tid})"/>'
    if role == 'body':
        return f'<{tag} {g} fill="url(#g{tid}{sid})" {st.format(w=sw)}/>' + shine
    if role == 'bead':
        return f'<{tag} {g} fill="url(#g{tid}{sid})" {st.format(w=sw * .55)}/>' + shine
    if role in ('belly', 'accent'):
        c = team.get('belly' if role == 'belly' else 'accent', '#999')
        return f'<{tag} {g} fill="{c}" {st.format(w=sw)}/>' + shine
    if role == 'white':
        return f'<{tag} {g} fill="#fff" {st.format(w=sw)}/>'
    if role == 'dark':
        return f'<{tag} {g} fill="#231813"/>'
    if role == 'hl':
        return f'<{tag} {g} fill="#fff" opacity=".42"/>'
    if role == 'inner':
        return f'<{tag} {g} fill="#000" opacity=".2"/>'
    if role == 'line':
        return f'<{tag} {g} fill="none" stroke="{team["line"]}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'
    if role == 'fine':
        return f'<{tag} {g} fill="none" stroke="{team["line"]}" stroke-opacity=".55" stroke-width="1.2" stroke-linecap="round"/>'
    if role == 'groove':
        return f'<{tag} {g} fill="#000" fill-opacity=".28" stroke="#000" stroke-opacity=".35" stroke-width="1" />'
    raise KeyError(role)


def ring_extras(p):
    """고리(타원) 아래쪽 그늘 선과 위쪽 반사 선 — 입체감"""
    role, shape, *a = p
    if role == 'body' and shape == 'E' and a[2] >= 10 and a[3] <= 6:
        cx, cy, rx, ry = a
        return (f'<path d="M{cx-rx} {cy} A{rx} {ry} 0 0 0 {cx+rx} {cy}" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="1.7"/>'
                f'<path d="M{cx-rx+2} {cy-.6} A{rx-2} {ry-.6} 0 0 1 {cx+rx-2} {cy-.6}" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="1.1"/>')
    return ''


def gradient_def(tid, c, team):
    fl = team['fill']
    if fl['kind'] == 'h':
        s = fl['stops']; offs = [0, .25, .6, 1]
        stops = ''.join(f'<stop offset="{o}" stop-color="{col}"/>' for o, col in zip(offs, s))
        return f'<linearGradient id="g{tid}{c}" gradientUnits="userSpaceOnUse" x1="20" y1="0" x2="80" y2="0">{stops}</linearGradient>'
    s = fl['stops']
    return (f'<linearGradient id="g{tid}{c}" gradientUnits="userSpaceOnUse" x1="0" y1="25" x2="0" y2="126">'
            f'<stop offset="0" stop-color="{s[0]}"/><stop offset="1" stop-color="{s[1]}"/></linearGradient>')


def shine_def(tid, k):
    return (f'<linearGradient id="sh{tid}" gradientUnits="userSpaceOnUse" x1="20" y1="0" x2="80" y2="0">'
            f'<stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".2" stop-color="#fff" stop-opacity="{.55*k:.2f}"/>'
            f'<stop offset=".34" stop-color="#fff" stop-opacity="0"/><stop offset=".62" stop-color="#000" stop-opacity="0"/>'
            f'<stop offset="1" stop-color="#000" stop-opacity="{.42*k:.2f}"/></linearGradient>')


def tex_def(tid, c, tx, rgb, strength):
    r, g, b = rgb
    return (f'<filter id="tx{tid}{c}" filterUnits="userSpaceOnUse" x="-10" y="-10" width="120" height="160" color-interpolation-filters="sRGB">'
            f'<feTurbulence type="fractalNoise" baseFrequency="{tx[0]} {tx[1]}" numOctaves="3" seed="{tx[2]}" result="n"/>'
            f'<feColorMatrix in="n" type="matrix" values="0 0 0 0 {r}  0 0 0 0 {g}  0 0 0 0 {b}  {strength*2.4:.2f} 0 0 0 {-strength*1.1:.2f}" result="gr"/>'
            f'<feComposite in="gr" in2="SourceAlpha" operator="in" result="gc"/>'
            f'<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="gc"/></feMerge></filter>')


def build_pieces(th):
    global TW, TB
    TW, TB = th['w'], th['b']
    tid = th['id'][:2]
    defs = [gradient_def(tid, 'w', TW), gradient_def(tid, 'b', TB), shine_def(tid, th.get('shine', .5))]
    tx = th.get('tex')
    if tx:
        defs.append(tex_def(tid, 'w', tx['f'], tx['w'], tx['sw']))
        defs.append(tex_def(tid, 'b', tx['f'], tx['b'], tx['sb']))
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{CW*6}" height="{CH*2}" viewBox="0 0 {CW*6} {CH*2}">',
           '<defs>', ''.join(defs), '</defs>']
    for row, team in enumerate((TW, TB)):
        sid = 'w' if row == 0 else 'b'
        for col, t in enumerate(TYPES):
            out.append(f'<g transform="translate({col*CW},{row*CH})">')
            out.append('<ellipse cx="50" cy="126" rx="30" ry="5.5" fill="#000" opacity=".32"/>')
            if th.get('felt'):
                out.append(f'<ellipse cx="50" cy="128" rx="26.5" ry="3.2" fill="{th["felt"]}"/>')
            out.append(f'<g filter="url(#tx{tid}{sid})">' if tx else '<g>')
            sc = th.get('scale', 1)
            if sc != 1:
                out.append(f'<g transform="translate(50 125) scale({sc}) translate(-50 -125)">')
            for p in th['parts'](t):
                out.append(part_svg(p, team, tid) + ring_extras(p))
            if sc != 1:
                out.append('</g>')
            out.append('</g></g>')
    out.append('</svg>')
    return ''.join(out)


def build_board(th):
    bd = th['board']
    sel, dot, last, hint = bd['ov']
    cells = []
    sq = lambda c: (f'<rect width="100" height="100" fill="{c}"/>'
                    '<rect width="100" height="100" fill="url(#bev)"/>')
    extra_l = extra_d = ''
    if bd.get('grain'):
        extra_l = ('<path d="M0 22C30 16 60 28 100 20M0 52C25 48 65 58 100 50M0 80C35 76 70 86 100 78" '
                   'stroke="#8a5a2a" stroke-opacity=".13" stroke-width="2" fill="none"/>')
        extra_d = ('<path d="M0 18C30 24 60 12 100 20M0 48C25 54 65 44 100 52M0 78C35 82 70 72 100 80" '
                   'stroke="#2a1608" stroke-opacity=".18" stroke-width="2" fill="none"/>')
    if bd.get('dots'):
        extra_l = '<g fill="#a9d36c" opacity=".55"><circle cx="20" cy="25" r="3"/><circle cx="70" cy="40" r="2.5"/><circle cx="45" cy="78" r="3"/><circle cx="85" cy="85" r="2"/></g>'
        extra_d = '<g fill="#6fae47" opacity=".55"><circle cx="30" cy="30" r="3"/><circle cx="75" cy="60" r="2.5"/><circle cx="20" cy="80" r="3"/><circle cx="60" cy="88" r="2"/></g>'
    if bd.get('studs'):
        for key, base in (('l', bd['light']), ('d', bd['dark'])):
            st = ('<circle cx="50" cy="53" r="21" fill="#000" opacity=".22"/><circle cx="50" cy="50" r="21" fill="#fff" opacity=".28"/>'
                  '<circle cx="50" cy="50" r="17" fill="' + base + '"/><ellipse cx="45" cy="44" rx="6" ry="4" fill="#fff" opacity=".35"/>')
            if key == 'l': extra_l += st
            else: extra_d += st
    if bd.get('grid'):
        g = f'<rect x=".75" y=".75" width="98.5" height="98.5" fill="none" stroke="{bd["grid"]}" stroke-opacity=".45" stroke-width="1.5"/>'
        extra_l += g; extra_d += g
    cells.append(sq(bd['light']) + extra_l)
    cells.append(sq(bd['dark']) + extra_d)
    cells.append(f'<rect width="100" height="100" fill="{sel}" fill-opacity=".55"/>')
    cells.append(f'<circle cx="50" cy="50" r="15" fill="{dot}" fill-opacity=".55"/>')
    cells.append(f'<circle cx="50" cy="50" r="44" fill="none" stroke="{dot}" stroke-opacity=".6" stroke-width="9"/>')
    cells.append(f'<rect width="100" height="100" fill="{last}" fill-opacity=".5"/>')
    cells.append('<rect width="100" height="100" fill="url(#rg)"/>')
    cells.append(f'<rect width="100" height="100" fill="{hint}" fill-opacity=".5"/>'
                 f'<rect x="3" y="3" width="94" height="94" fill="none" stroke="{hint}" stroke-width="6"/>')
    defs = ('<defs><linearGradient id="bev" x1="0" y1="0" x2="0" y2="1">'
            '<stop offset="0" stop-color="#fff" stop-opacity=".14"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/>'
            '<stop offset="1" stop-color="#000" stop-opacity=".14"/></linearGradient>'
            '<radialGradient id="rg"><stop offset="0" stop-color="#ff2b2b" stop-opacity=".95"/>'
            '<stop offset=".6" stop-color="#e00000" stop-opacity=".5"/><stop offset="1" stop-color="#e00000" stop-opacity="0"/></radialGradient></defs>')
    body = ''.join(f'<g transform="translate({i*100},0)">{c}</g>' for i, c in enumerate(cells))
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="100" viewBox="0 0 800 100">{defs}{body}</svg>'


# ---------------------------------------------------------------- 미리보기 (PIL, 단색 근사)
def flatten(d, steps=14):
    toks = re.findall(r'[MLCQZHV]|-?\d+\.?\d*', d)
    pts, i, cur, start = [], 0, (0, 0), (0, 0)
    cmd = None
    while i < len(toks):
        if toks[i] in 'MLCQZHV':
            cmd = toks[i]; i += 1
            if cmd == 'Z':
                pts.append(start); continue
        n = {'M': 2, 'L': 2, 'H': 1, 'V': 1, 'C': 6, 'Q': 4}[cmd]
        v = [float(x) for x in toks[i:i + n]]; i += n
        if cmd in 'ML':
            cur = (v[0], v[1]); pts.append(cur)
            if cmd == 'M': start = cur; cmd = 'L'
        elif cmd == 'H':
            cur = (v[0], cur[1]); pts.append(cur)
        elif cmd == 'V':
            cur = (cur[0], v[0]); pts.append(cur)
        elif cmd == 'C':
            p0 = cur; p1 = (v[0], v[1]); p2 = (v[2], v[3]); p3 = (v[4], v[5])
            for s in range(1, steps + 1):
                u = s / steps; w = 1 - u
                pts.append((w**3*p0[0]+3*w*w*u*p1[0]+3*w*u*u*p2[0]+u**3*p3[0],
                            w**3*p0[1]+3*w*w*u*p1[1]+3*w*u*u*p2[1]+u**3*p3[1]))
            cur = p3
    return pts


def preview(th, path, scale=3):
    if Image is None:
        return
    img = Image.new('RGBA', (CW * 6 * scale, CH * 2 * scale), (96, 120, 96, 255))
    dr = ImageDraw.Draw(img, 'RGBA')
    for row, team in enumerate((th['w'], th['b'])):
        st = team['fill']['stops']
        mid = st[2] if team['fill']['kind'] == 'h' else st[0]
        col_of = {'body': mid, 'belly': team.get('belly', '#fff'), 'accent': team.get('accent', '#888'),
                  'white': '#ffffff', 'dark': '#231813', 'hl': '#ffffffaa', 'line': team['line']}
        for col, t in enumerate(TYPES):
            ox, oy = col * CW * scale, row * CH * scale
            dr.ellipse([ox + 21*scale, oy + 119.5*scale, ox + 79*scale, oy + 130.5*scale], fill=(0, 0, 0, 80))
            for role, shape, *a in th['parts'](t):
                c = col_of[role]
                P = lambda x, y: (ox + x * scale, oy + y * scale)
                if shape == 'P':
                    pts = [P(*q) for q in flatten(a[0])]
                    if role == 'line':
                        dr.line(pts, fill=c, width=max(2, scale))
                    else:
                        dr.polygon(pts, fill=c, outline=team['stroke'])
                elif shape == 'C':
                    dr.ellipse([*P(a[0]-a[2], a[1]-a[2]), *P(a[0]+a[2], a[1]+a[2])], fill=c, outline=None if role in ('dark', 'white') else team['stroke'])
                elif shape == 'E':
                    dr.ellipse([*P(a[0]-a[2], a[1]-a[3]), *P(a[0]+a[2], a[1]+a[3])], fill=c, outline=None if role == 'hl' else team['stroke'])
                elif shape == 'R':
                    dr.rounded_rectangle([*P(a[0], a[1]), *P(a[0]+a[2], a[1]+a[3])], radius=a[4]*scale, fill=c, outline=team['stroke'])
    img.save(path)


# ---------------------------------------------------------------- 아이콘
def build_icons():
    icon = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#1f1812"/>'
            + ''.join(f'<rect x="{72+c*92}" y="{72+r*92}" width="92" height="92" fill="{"#a9703f" if (r+c)%2 else "#ecd6ae"}"/>'
                      for r in range(4) for c in range(4))
            + '<circle cx="256" cy="226" r="70" fill="#f6ecd4" stroke="#2b1c0e" stroke-width="14"/>'
              '<path d="M196 392C204 330 226 300 256 296C286 300 308 330 316 392Z" fill="#f6ecd4" stroke="#2b1c0e" stroke-width="14" stroke-linejoin="round"/>'
              '</svg>')
    open(os.path.join(OUT, 'icon.svg'), 'w').write(icon)
    if Image is None:
        return
    for size in (180, 192, 512):
        im = Image.new('RGB', (size, size), (31, 24, 18))
        d = ImageDraw.Draw(im)
        s = size / 512
        for r in range(4):
            for c in range(4):
                col = (169, 112, 63) if (r + c) % 2 else (236, 214, 174)
                d.rectangle([(72 + c * 92) * s, (72 + r * 92) * s, (72 + c * 92 + 92) * s, (72 + r * 92 + 92) * s], fill=col)
        d.ellipse([186 * s, 156 * s, 326 * s, 296 * s], fill=(246, 236, 212), outline=(43, 28, 14), width=max(2, int(14 * s)))
        d.polygon([(196 * s, 392 * s), (204 * s, 330 * s), (226 * s, 300 * s), (256 * s, 296 * s), (286 * s, 300 * s), (308 * s, 330 * s), (316 * s, 392 * s)],
                  fill=(246, 236, 212), outline=(43, 28, 14))
        im.save(os.path.join(OUT, f'icon-{size}.png'))


def render_png(svg_path, png_path, w, h, scale=3):
    """Chromium(Playwright)으로 SVG를 투명 PNG로 렌더링"""
    from playwright.sync_api import sync_playwright
    html = os.path.join(os.path.dirname(svg_path), '_render.html')
    open(html, 'w').write(f'<body style="margin:0;background:transparent"><img id="i" src="{os.path.basename(svg_path)}" width="{w}" height="{h}" style="display:block"></body>')
    with sync_playwright() as p:
        exe = '/opt/pw-browsers/chromium' if os.path.exists('/opt/pw-browsers/chromium') else None
        b = p.chromium.launch(executable_path=exe) if exe else p.chromium.launch()
        pg = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=scale).new_page()
        pg.goto('file://' + html); pg.wait_for_function("document.getElementById('i').complete")
        pg.wait_for_timeout(300)
        pg.screenshot(path=png_path, omit_background=True, clip={'x': 0, 'y': 0, 'width': w, 'height': h})
        b.close()
    os.remove(html)


if __name__ == '__main__':
    src = os.path.join(OUT, 'src'); os.makedirs(src, exist_ok=True)
    for th in THEMES:
        ps = os.path.join(src, f"t-{th['id']}-pieces.svg"); bs = os.path.join(src, f"t-{th['id']}-board.svg")
        open(bs, 'w').write(build_board(th))
        if not th.get('custom_png'):   # custom_png: 제공받은 일러스트로 tools/make_creature_sheet.py 가 만든 PNG를 그대로 사용
            open(ps, 'w').write(build_pieces(th))
            render_png(ps, os.path.join(OUT, f"t-{th['id']}-pieces.png"), CW * 6, CH * 2, 3)
        render_png(bs, os.path.join(OUT, f"t-{th['id']}-board.png"), 800, 100, 3)
        print('rendered', th['id'])
    build_icons()
    print('assets built')
