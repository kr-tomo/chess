// 부팅: 클래식 스크립트(sprites/engine/sfx)를 순서대로 읽고 → Phaser 렌더러(fx.js, ES 모듈) → game.js
const load = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error(src)); document.body.appendChild(s); });
(async () => {
  try {
    await load('sprites.js'); await load('engine.js'); await load('sfx.js');
    await import('./fx.js');
    await load('game.js');
  } catch (e) { console.error('boot failed', e); document.body.insertAdjacentHTML('beforeend', '<p style="position:fixed;top:40%;width:100%;text-align:center;color:#fff">불러오기 실패: ' + e.message + '</p>'); }
})();
