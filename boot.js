// 부팅: 모든 스크립트를 일반 스크립트로 순서대로 읽는다 (ES 모듈 미사용 → file:// 로 열어도 동작)
const load = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error(src)); document.body.appendChild(s); });
(async () => {
  if (location.protocol === 'file:') {
    document.body.insertAdjacentHTML('beforeend', '<div style="position:fixed;inset:0;z-index:99;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;background:#10242c;color:#fff;line-height:1.7">이 앱은 웹 서버(http/https)로 열어야 합니다.<br>파일을 더블클릭(file://)하면 브라우저 보안 때문에 이미지를 읽을 수 없습니다.<br>폴더에서 <b>python3 -m http.server 8000</b> 실행 후 http://localhost:8000 으로 접속하거나, 웹 호스팅에 올려 주세요.</div>');
    return;
  }
  try {
    await load('sprites.js'); await load('engine.js'); await load('sfx.js');
    await load('lib/phaser.min.js'); await load('fx.js');
    await load('game.js');
  } catch (e) { console.error('boot failed', e); document.body.insertAdjacentHTML('beforeend', '<p style="position:fixed;top:40%;width:100%;text-align:center;color:#fff">불러오기 실패: ' + e.message + '</p>'); }
})();
