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


PLINTH = [('body', 'R', 25, 118, 50, 10, 5), ('body', 'R', 30, 109, 40, 11, 5)]


def classic_parts(t):
    if t == 'P':
        return PLINTH + [('body', 'P', stem(66, 7, 16)), ('body', 'E', 50, 66, 13, 4),
                         ('body', 'C', 50, 52, 12), ('hl', 'E', 45, 47, 4.5, 3)]
    if t == 'R':
        return PLINTH + [('body', 'P', stem(60, 9, 17)), ('body', 'R', 34, 55, 32, 8, 3),
                         ('body', 'P', "M33 34 H40 V41 H46 V34 H54 V41 H60 V34 H67 V54 L64 58 H36 L33 54 Z"),
                         ('line', 'P', "M35 50 H65")]
    if t == 'B':
        return PLINTH + [('body', 'P', stem(66, 7, 16)), ('body', 'E', 50, 66, 14, 4),
                         ('body', 'P', "M50 30 C63 38 66 52 59 64 L41 64 C34 52 37 38 50 30 Z"),
                         ('body', 'C', 50, 27, 5), ('line', 'P', "M54 40 L46 53"), ('hl', 'E', 45, 46, 3, 7)]
    if t == 'Q':
        return PLINTH + [('body', 'P', stem(64, 9, 18)), ('body', 'E', 50, 64, 17, 5),
                         ('body', 'P', "M31 48 L32 32 L41 42 L45 27 L50 40 L55 27 L59 42 L68 32 L69 48 "
                                       "C69 58 60 62 50 62 C40 62 31 58 31 48 Z"),
                         ('body', 'C', 32, 29, 3.4), ('body', 'C', 45, 24, 3.4),
                         ('body', 'C', 55, 24, 3.4), ('body', 'C', 68, 29, 3.4)]
    if t == 'K':
        return PLINTH + [('body', 'P', stem(64, 9, 18)), ('body', 'E', 50, 64, 17, 5),
                         ('body', 'P', "M33 62 C31 47 39 37 50 37 C61 37 69 47 67 62 Z"),
                         ('body', 'R', 46, 8, 8, 28, 2), ('body', 'R', 39, 15, 22, 8, 2),
                         ('hl', 'E', 42, 48, 3.5, 6)]
    if t == 'N':
        return PLINTH + [('body', 'P',
                          "M32 110 C32 98 34 90 40 82 C34 82 28 78 26 72 C24 68 22 66 20 62 C18 58 20 54 24 50 "
                          "C28 46 32 42 34 38 L38 26 L44 34 C48 32 52 32 54 34 C66 42 72 60 72 80 "
                          "C72 92 70 102 68 110 Z"),
                         ('line', 'P', "M55 38 C64 48 68 64 66 86"), ('dark', 'C', 38, 47, 2.6),
                         ('dark', 'C', 22, 59, 1.5), ('hl', 'E', 36, 58, 2.6, 7)]
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


# ---------------------------------------------------------------- 테마 정의
def cyl(stops):
    return dict(kind='h', stops=stops)


def vert(top, bottom):
    return dict(kind='v', stops=[top, bottom])


THEMES = [
    dict(id='classic', name='클래식 우드', parts=classic_parts,
         w=dict(fill=cyl(['#e6d6ae', '#fffaf0', '#e8d8ae', '#a68c5a']), stroke='#4a3418', line='#6b4c22', so=.75),
         b=dict(fill=cyl(['#4a382c', '#9a7e68', '#3d2a1e', '#120a05']), stroke='#000000', line='#000000', so=.85),
         board=dict(light='#ecd6ae', dark='#a9703f', grain=True, ov=('#f6f669', '#146432', '#cdd26a', '#3b82f6')),
         ui=dict(bg1='#3d2c20', bg2='#120b07', f1='#6b4423', f2='#2e1c0e', filter='drop-shadow(0 3px 2px rgba(0,0,0,.45))')),
    dict(id='steel', name='스틸 & 네이비', parts=classic_parts,
         w=dict(fill=cyl(['#aab3bd', '#ffffff', '#cfd6de', '#6f7a87']), stroke='#2a3038', line='#4b5560', so=.8),
         b=dict(fill=cyl(['#26344f', '#8aa2cc', '#1b2a47', '#060b18']), stroke='#04070f', line='#02040a', so=.9),
         board=dict(light='#efe7d4', dark='#25262b', grain=False, ov=('#f6f669', '#146432', '#cdd26a', '#3b82f6')),
         ui=dict(bg1='#1f5560', bg2='#07151b', f1='#b98f58', f2='#5b3f24', filter='drop-shadow(0 3px 2px rgba(0,0,0,.5))')),
    dict(id='neon', name='네온', parts=classic_parts,
         w=dict(fill=cyl(['#157e94', '#d2fcff', '#3fd3ea', '#0a4a5e']), stroke='#a8f4ff', line='#06323f', so=.95, sw=2),
         b=dict(fill=cyl(['#55197a', '#f1b0ff', '#b441d8', '#31104f']), stroke='#f4c4ff', line='#2a0640', so=.95, sw=2),
         board=dict(light='#1f2f58', dark='#0e1733', grain=False, grid='#2d5fa8',
                    ov=('#38e8ff', '#38e8ff', '#ff4fd8', '#ffd84a')),
         ui=dict(bg1='#14265a', bg2='#040815', f1='#19e3ff', f2='#07374d',
                 filter='drop-shadow(0 0 4px rgba(90,230,255,.55)) drop-shadow(0 3px 2px rgba(0,0,0,.5))')),
    dict(id='creature', name='크리처 (오리지널)', parts=creature_parts, scale=1.1,
         w=dict(fill=vert('#ffd89a', '#ec7a22'), belly='#fff3d2', accent='#e23b2e', stroke='#6a2b0c', line='#6a2b0c', so=.9, sw=1.8),
         b=dict(fill=vert('#9ad6ff', '#2f6fd6'), belly='#e8f6ff', accent='#1f46a8', stroke='#0f2a66', line='#0f2a66', so=.9, sw=1.8),
         board=dict(light='#d3ec9f', dark='#8fc964', grain=False, dots=True, ov=('#fff06a', '#1a6b30', '#f5e36a', '#4a8cff')),
         ui=dict(bg1='#3f8650', bg2='#10261a', f1='#8c5a2a', f2='#4d2f14', filter='drop-shadow(0 3px 2px rgba(0,0,0,.4))')),
]


# ---------------------------------------------------------------- SVG 출력
def part_svg(p, team, tid):
    role, shape, *a = p
    st = team
    sw = st.get('sw', 1.5)
    fill = {'body': f"url(#g{tid}{'w' if team is TW else 'b'})", 'belly': st.get('belly', '#fff'),
            'accent': st.get('accent', '#999'), 'white': '#ffffff', 'dark': '#231813', 'line': 'none',
            'hl': '#ffffff'}[role]
    if role == 'line':
        stroke = f' stroke="{st["line"]}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"'
    elif role == 'hl':
        stroke = ' opacity=".42"'
    elif role == 'dark':
        stroke = ''
    else:
        stroke = f' stroke="{st["stroke"]}" stroke-opacity="{st["so"]}" stroke-width="{sw}" stroke-linejoin="round"'
    f = f' fill="{fill}"' if role != 'line' else ''
    if shape == 'P':
        return f'<path d="{a[0]}"{f}{stroke}/>'
    if shape == 'C':
        return f'<circle cx="{a[0]}" cy="{a[1]}" r="{a[2]}"{f}{stroke}/>'
    if shape == 'E':
        return f'<ellipse cx="{a[0]}" cy="{a[1]}" rx="{a[2]}" ry="{a[3]}"{f}{stroke}/>'
    if shape == 'R':
        return f'<rect x="{a[0]}" y="{a[1]}" width="{a[2]}" height="{a[3]}" rx="{a[4]}"{f}{stroke}/>'
    raise ValueError(shape)


TW = TB = None


def gradient_def(tid, c, team):
    fl = team['fill']
    if fl['kind'] == 'h':
        s = fl['stops']; offs = [0, .25, .6, 1]
        stops = ''.join(f'<stop offset="{o}" stop-color="{col}"/>' for o, col in zip(offs, s))
        return f'<linearGradient id="g{tid}{c}" gradientUnits="userSpaceOnUse" x1="20" y1="0" x2="80" y2="0">{stops}</linearGradient>'
    s = fl['stops']
    return (f'<linearGradient id="g{tid}{c}" gradientUnits="userSpaceOnUse" x1="0" y1="25" x2="0" y2="126">'
            f'<stop offset="0" stop-color="{s[0]}"/><stop offset="1" stop-color="{s[1]}"/></linearGradient>')


def build_pieces(th):
    global TW, TB
    TW, TB = th['w'], th['b']
    tid = th['id'][:2]
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{CW*6}" height="{CH*2}" viewBox="0 0 {CW*6} {CH*2}">',
           '<defs>', gradient_def(tid, 'w', TW), gradient_def(tid, 'b', TB), '</defs>']
    for row, team in enumerate((TW, TB)):
        for col, t in enumerate(TYPES):
            out.append(f'<g transform="translate({col*CW},{row*CH})">')
            out.append('<ellipse cx="50" cy="125" rx="29" ry="5.5" fill="#000" opacity=".30"/>')
            sc = th.get('scale', 1)
            if sc != 1:
                out.append(f'<g transform="translate(50 125) scale({sc}) translate(-50 -125)">')
            for p in th['parts'](t):
                out.append(part_svg(p, team, tid))
            if sc != 1:
                out.append('</g>')
            out.append('</g>')
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


if __name__ == '__main__':
    prev = None
    if '--preview' in sys.argv:
        prev = sys.argv[sys.argv.index('--preview') + 1]
        os.makedirs(prev, exist_ok=True)
    for th in THEMES:
        open(os.path.join(OUT, f"t-{th['id']}-pieces.svg"), 'w').write(build_pieces(th))
        open(os.path.join(OUT, f"t-{th['id']}-board.svg"), 'w').write(build_board(th))
        if prev:
            preview(th, os.path.join(prev, f"{th['id']}.png"))
    build_icons()
    print('assets built')
