포켓몬스터 테마 기물 시트 만들기 (src/creature-source.png 에서)
  cd tools
  python3 make_creature_sheet_cutout.py   # 12개 기물 배경 제거, 페디스털 글씨 제거 -> pieces.pkl
  python3 make_creature_sheet_compose.py  # 같은 배율/바닥선으로 정렬해 ../t-creature-pieces.png (6열x2행) 생성
필요: python3, numpy, scipy, opencv-python, pillow
