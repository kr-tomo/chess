const CACHE = 'chess-v4';
const ASSETS = ['./', 'index.html', 'style.css', 'game.js', 'engine.js', 'ai-worker.js', 'sprites.js',
  't-steel-pieces.svg', 't-steel-board.svg', 't-classic-pieces.svg', 't-classic-board.svg', 't-lego-pieces.svg', 't-lego-board.svg', 't-creature-pieces.svg', 't-creature-board.svg', 'manifest.webmanifest', 'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(ASSETS.map(a => c.add(a).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// 캐시 우선 + 백그라운드 갱신 (스프라이트를 교체해도 다음 실행에 반영됨)
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const hit = await cache.match(req, { ignoreSearch: true });
    const net = fetch(req).then(res => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
