/* 효과음 — WebAudio 합성 (별도 음원 파일 없음). SFX.on 으로 켜고 끔 */
(function () {
  let ctx = null, master = null, nbuf = null;
  const SFX = { on: true };
  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    try {
      ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.55;
      const comp = ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
      nbuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (_) { ctx = null; }
    return ctx;
  }
  SFX.unlock = function () { const c = ensure(); if (c && c.state === 'suspended') c.resume().catch(() => {}); };
  const live = () => SFX.on && ensure() && ctx.state !== 'closed';
  function env(g, t, a, d, vol) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function tone(f0, f1, dur, type, vol, delay, att) {
    const t = ctx.currentTime + (delay || 0), o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, att || 0.004, dur, vol); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + (att || 0.004) + 0.05);
  }
  function noise(dur, f0, f1, q, vol, delay, kind) {
    const t = ctx.currentTime + (delay || 0), s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = nbuf; s.loop = true; fl.type = kind || 'lowpass'; fl.Q.value = q || 0.8;
    fl.frequency.setValueAtTime(f0, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, 0.003, dur, vol); s.connect(fl); fl.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.06);
  }
  const r = (a, b) => a + Math.random() * (b - a);
  const S = {
    select() { tone(r(880, 940), 0, 0.05, 'triangle', 0.12); },
    move(soft) {
      if (soft) { tone(r(300, 340), r(520, 600), 0.12, 'sine', 0.3); noise(0.05, 2400, 900, 1, 0.05); return; }
      tone(r(170, 200), r(70, 85), 0.11, 'sine', 0.5); noise(0.045, 1800, 500, 0.9, 0.22); tone(r(900, 1100), 0, 0.03, 'square', 0.04);
    },
    swish() { noise(0.16, 500, 3200, 1.2, 0.12, 0, 'bandpass'); },
    capture() {
      noise(0.28, 4200, 300, 0.7, 0.55); tone(r(140, 160), 38, 0.3, 'sine', 0.7); tone(1900, 260, 0.08, 'sawtooth', 0.12);
      noise(0.12, 7000, 2000, 1, 0.12, 0.05, 'highpass');
    },
    launch() {
      noise(0.1, 3000, 400, 0.7, 0.45); tone(r(150, 170), 50, 0.2, 'sine', 0.55); tone(700, 1600, 0.09, 'square', 0.1);
      noise(0.55, 600, 2600, 1.4, 0.16, 0.04, 'bandpass'); tone(520, 190, 0.5, 'triangle', 0.09, 0.05);
      tone(1568, 0, 0.18, 'sine', 0.1, 0.5); tone(2093, 0, 0.22, 'sine', 0.09, 0.58);
    },
    castle() { S.move(); setTimeout(() => live() && S.move(), 130); },
    check() { tone(660, 0, 0.13, 'square', 0.1); tone(880, 0, 0.2, 'square', 0.1, 0.12); },
    promote() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0, 0.2, 'triangle', 0.16, i * 0.07)); },
    win() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0, 0.35, 'triangle', 0.17, i * 0.1)); },
    draw() { [523, 440, 392].forEach((f, i) => tone(f, 0, 0.3, 'triangle', 0.15, i * 0.14)); },
    flag() { tone(420, 180, 0.5, 'sawtooth', 0.14); tone(210, 90, 0.5, 'square', 0.08, 0.1); },
    undo() { tone(600, 300, 0.1, 'triangle', 0.14); },
    error() { tone(200, 150, 0.12, 'square', 0.08); }
  };
  SFX.play = function (name, a) { if (!live() || !S[name]) return; try { S[name](a); } catch (_) {} };
  window.SFX = SFX;
  ['pointerdown', 'keydown', 'touchend'].forEach(ev => document.addEventListener(ev, SFX.unlock, { passive: true }));
})();
