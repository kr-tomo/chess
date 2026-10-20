/*
 * 테마/스프라이트 설정 — 리소스를 바꾸려면 같은 배치의 이미지로 교체하고 이 설정만 맞추면 됩니다.
 *
 * pieces : 시트 한 장. cols x rows 격자, 칸 하나의 가로세로 비율이 aspect (세로/가로).
 *          기물은 칸 아래쪽에 서 있고 위로 칸을 넘어가며, 클릭 판정은 항상 보드 칸 기준입니다.
 *          col  = 기물 종류(P N B R Q K)의 열 번호, row = 색(w 백 / b 흑)의 행 번호
 *          bottom = 기물 이미지의 아래 여백(칸 높이 대비 비율)
 * board  : 8열 x 1행 시트. light, dark, select(선택), dot(이동 가능), ring(잡기 가능), last(직전 수), check(체크), hint(훈수)
 * ui     : 배경 그라데이션(bg1,bg2), 보드 테두리(f1,f2), 기물 그림자 filter, 선택창 미리보기 색(pv)
 * PNG/WebP 같은 래스터 시트도 cols/rows/aspect 만 맞으면 그대로 사용할 수 있습니다.
 */
(function () {
  const cell = { light: 0, dark: 1, select: 2, dot: 3, ring: 4, last: 5, check: 6, hint: 7 };
  const mk = (id, name, ui) => ({
    id, name, ui,
    pieces: { src: `t-${id}-pieces.svg`, cols: 6, rows: 2, col: { P: 0, N: 1, B: 2, R: 3, Q: 4, K: 5 }, row: { w: 0, b: 1 }, aspect: 1.4, bottom: 0.06 },
    board: { src: `t-${id}-board.svg`, cols: 8, rows: 1, cell }
  });
  window.THEMES = [
    mk('steel', '스틸 & 네이비', { bg1: '#1f5560', bg2: '#07151b', f1: '#b98f58', f2: '#5b3f24', pv: ['#efe7d4', '#25262b'], filter: 'drop-shadow(0 3px 2px rgba(0,0,0,.5))' }),
    mk('classic', '클래식 우드', { bg1: '#3d2c20', bg2: '#120b07', f1: '#6b4423', f2: '#2e1c0e', pv: ['#ecd6ae', '#a9703f'], filter: 'drop-shadow(0 3px 2px rgba(0,0,0,.45))' }),
    mk('neon', '네온', { bg1: '#14265a', bg2: '#040815', f1: '#19e3ff', f2: '#07374d', pv: ['#1f2f58', '#0e1733'], filter: 'drop-shadow(0 0 4px rgba(90,230,255,.55)) drop-shadow(0 3px 2px rgba(0,0,0,.5))' }),
    mk('creature', '크리처 (오리지널)', { bg1: '#3f8650', bg2: '#10261a', f1: '#8c5a2a', f2: '#4d2f14', pv: ['#d3ec9f', '#8fc964'], filter: 'drop-shadow(0 3px 2px rgba(0,0,0,.4))' })
  ];
  window.SPRITES = window.THEMES[0];
})();
