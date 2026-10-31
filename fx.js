/*
 * Phaser 렌더러 — 보드, 기물, 하이라이트, 이동/잡기 연출을 한 장의 투명 캔버스(#fx)에 그린다.
 * 입력(칸 선택)은 DOM 의 투명 판(#board .sq)이 그대로 맡고, 이 캔버스는 pointer-events 없음.
 * 캔버스가 화면 전체를 덮기 때문에 기물이 판 밖(패널 위)까지 튕겨나갈 수 있다.
 * game.js 는 window.PB.sync(view) 만 부르면 된다.
 */
(function () {
const Phaser = window.Phaser;

const THEMES = window.THEMES;
const PB = { ready: false };
window.PB = PB;

let game = null, scene = null, theme = THEMES[0], view = null, pending = null, geo = { x0: 0, y0: 0, sq: 40, d: 1 };
const pcs = new Map();           // 칸 -> 기물 {cont, spr, sh, code, sq, lift}
const bgImgs = [];
let overlays = [];
const anims = new Set();
const locked = new Set();
let builtKey = '';

const DPR = () => Math.min(window.devicePixelRatio || 1, 2);
const clamp = Phaser.Math.Clamp;
const rnd = (a, b) => a + Math.random() * (b - a);

function computeGeo() {
  const r = document.getElementById('board').getBoundingClientRect(), d = DPR();
  geo = { x0: r.left * d, y0: r.top * d, sq: r.width / 8 * d, d };
}
const bottom = () => (view ? view.bottom : 1);
function cellOf(sq) { const di = bottom() === 1 ? sq : 63 - sq; return { col: di & 7, row: di >> 3 }; }
function centerOf(sq) { const c = cellOf(sq); return { x: geo.x0 + (c.col + 0.5) * geo.sq, y: geo.y0 + (c.row + 0.5) * geo.sq }; }
function footOf(sq) { const c = cellOf(sq); return { x: geo.x0 + (c.col + 0.5) * geo.sq, y: geo.y0 + (c.row + 1) * geo.sq - geo.sq * (theme.pieces.bottom - 0.02) }; }
const depthOf = sq => 10 + cellOf(sq).row * 2;

// ---------- 텍스처 ----------
function makeTextures() {
  const mk = (key, w, h, draw) => {
    if (scene.textures.exists(key)) return;
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    scene.textures.addCanvas(key, c);
  };
  mk('dot', 64, 64, (g, w) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.5, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
  mk('shadow', 128, 64, (g) => { const gr = g.createRadialGradient(64, 32, 0, 64, 32, 62); gr.addColorStop(0, 'rgba(0,0,0,.75)'); gr.addColorStop(.6, 'rgba(0,0,0,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.save(); g.scale(1, .5); g.translate(0, 32); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); g.restore(); });
  mk('ring', 128, 128, (g) => { g.strokeStyle = '#fff'; g.lineWidth = 7; g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2); g.stroke(); });
  mk('star', 64, 64, (g) => { g.fillStyle = '#fff'; g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 6 : 31; g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } g.closePath(); g.fill(); });
  mk('burst', 256, 256, (g) => {   // 만화식 "팡" 별
    g.translate(128, 128); g.beginPath();
    for (let i = 0; i < 20; i++) { const a = i * Math.PI / 10, r = i % 2 ? 62 : 122; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    g.closePath(); g.fillStyle = '#ffe14d'; g.fill(); g.lineWidth = 9; g.strokeStyle = '#ff7a1a'; g.stroke();
    g.beginPath(); for (let i = 0; i < 20; i++) { const a = i * Math.PI / 10, r = i % 2 ? 30 : 66; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fillStyle = '#fff8d0'; g.fill();
  });
  mk('shard', 16, 16, (g) => { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, 3); g.lineTo(13, 0); g.lineTo(16, 12); g.lineTo(4, 16); g.closePath(); g.fill(); });
}

function addFrames() {
  for (const th of THEMES) {
    const pt = scene.textures.get('p-' + th.id), pd = th.pieces;
    if (!pt.has('00')) {
      const src = pt.getSourceImage(), fw = src.width / pd.cols, fh = src.height / pd.rows;
      for (let r = 0; r < pd.rows; r++) for (let c = 0; c < pd.cols; c++) pt.add('' + r + c, 0, c * fw, r * fh, fw, fh);
    }
    const bt = scene.textures.get('b-' + th.id), bd = th.board;
    if (!bt.has('light')) {
      const src = bt.getSourceImage(), cw = src.width / bd.cols;
      for (const k in bd.cell) bt.add(k, 0, bd.cell[k] * cw, 0, cw, src.height);
    }
  }
}

// ---------- 보드 / 기물 ----------
function frameOf(code) {
  const pd = theme.pieces, a = Math.abs(code);
  return '' + (code > 0 ? pd.row.w : pd.row.b) + pd.col['PNBRQK'[a - 1]];
}
function pieceScale() { return geo.sq / scene.textures.get('p-' + theme.id).get('00').width; }

function placeBoard() {
  const bk = 'b-' + theme.id, sc = geo.sq / scene.textures.get(bk).get('light').width * 1.012;
  for (let i = 0; i < 64; i++) {
    const col = i & 7, row = i >> 3, sqIdx = bottom() === 1 ? i : 63 - i, dark = ((sqIdx >> 3) + (sqIdx & 7)) & 1;
    let im = bgImgs[i];
    if (!im) { im = bgImgs[i] = scene.add.image(0, 0, bk, 'light').setDepth(0); }
    im.setTexture(bk, dark ? 'dark' : 'light').setPosition(geo.x0 + (col + 0.5) * geo.sq, geo.y0 + (row + 0.5) * geo.sq).setScale(sc);
  }
}

function makePiece(code, sq) {
  const key = 'p-' + theme.id, s = pieceScale();
  const cont = scene.add.container(0, 0);
  const sh = scene.add.image(0, -geo.sq * 0.02, 'shadow').setScale(geo.sq * 0.95 / 128).setAlpha(0.5);
  const spr = scene.add.image(0, 0, key, frameOf(code)).setOrigin(0.5, 1).setScale(s);
  cont.add([sh, spr]);
  const pc = { cont, spr, sh, code, sq, lift: 0 };
  placePiece(pc, sq);
  return pc;
}
function placePiece(pc, sq) {
  const f = footOf(sq);
  scene.tweens.killTweensOf([pc.cont, pc.sh]);
  pc.sq = sq; pc.lift = 0;
  pc.cont.setPosition(f.x, f.y).setScale(1).setRotation(0).setDepth(depthOf(sq)).setAlpha(1).setVisible(true);
  pc.sh.setY(-geo.sq * 0.02);
  pc.spr.setScale(pieceScale());
}
function killPiece(pc) {
  if (!pc) return;
  scene.tweens.killTweensOf([pc.cont, pc.sh, pc.spr]);
  pc.cont.destroy();
}
function clearPieces() { for (const pc of pcs.values()) killPiece(pc); pcs.clear(); }

function setLift(pc, on) {
  const want = on ? 1 : 0; if (pc.lift === want) return; pc.lift = want;
  const f = footOf(pc.sq), h = geo.sq * theme.pieces.aspect * 0.09;
  scene.tweens.killTweensOf([pc.cont, pc.sh]);
  scene.tweens.add({ targets: pc.cont, y: f.y - want * h, scaleX: 1 + 0.07 * want, scaleY: 1 + 0.07 * want, duration: 120, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: pc.sh, y: -geo.sq * 0.02 + want * h, duration: 120 });
}

function reconcile() {
  const v = view;
  for (let sq = 0; sq < 64; sq++) {
    if (locked.has(sq)) continue;
    const want = v.b[sq], pc = pcs.get(sq);
    if (pc && pc.code === want) { setLift(pc, v.sel === sq && !v.edit); continue; }
    if (pc) { killPiece(pc); pcs.delete(sq); }
    if (want) { const np = makePiece(want, sq); pcs.set(sq, np); setLift(np, false); }
  }
}

function buildOverlays() {
  for (const o of overlays) { scene.tweens.killTweensOf(o); o.destroy(); }
  overlays = [];
  const v = view, bk = 'b-' + theme.id, sc = geo.sq / scene.textures.get(bk).get('light').width * 1.012;
  const add = (sq, frame, depth, pulse) => {
    const c = centerOf(sq), im = scene.add.image(c.x, c.y, bk, frame).setScale(sc).setDepth(depth);
    overlays.push(im);
    if (pulse) scene.tweens.add({ targets: im, alpha: 0.55, duration: 560, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return im;
  };
  if (v.last) { add(v.last.f, 'last', 1); add(v.last.t, 'last', 1); }
  if (v.hint) { add(v.hint.f, 'hint', 2, true); add(v.hint.t, 'hint', 2, true); }
  if (v.sel >= 0 && !v.edit) add(v.sel, 'select', 3);
  if (v.check >= 0) add(v.check, 'check', 4, true);
  if (v.targets) for (const [sq, kind] of v.targets) add(sq, kind, 5);
}

// ---------- 연출 도구 ----------
function newAnim() {
  const a = { tw: [], tm: [], temps: new Set(), locks: [], settled: false, done: false, finishHooks: [] };
  anims.add(a); return a;
}
const T = (a, cfg) => { const t = scene.tweens.add(cfg); a.tw.push(t); return t; };
const CNT = (a, cfg) => { const t = scene.tweens.addCounter(cfg); a.tw.push(t); return t; };
const AFTER = (a, ms, fn) => { const e = scene.time.delayedCall(ms, fn); a.tm.push(e); return e; };
function temp(a, obj) { a.temps.add(obj); return obj; }
function dispose(a, obj) { if (!obj || !obj.scene) { a.temps.delete(obj); return; } scene.tweens.killTweensOf(obj); obj.destroy(); a.temps.delete(obj); }

function finishAnim(a) {
  if (a.done) return; a.done = true;
  for (const t of a.tw) { try { t.stop(); } catch (_) {} }
  for (const e of a.tm) { try { e.remove(false); } catch (_) {} }
  for (const o of [...a.temps]) dispose(a, o);
  for (const f of a.finishHooks) f();
  for (const s of a.locks) locked.delete(s);
  anims.delete(a);
}
function finishAll() { for (const a of [...anims]) finishAnim(a); }
const busy = () => { for (const a of anims) if (!a.settled) return true; return false; };

function ghost(a, pc, alpha, add) {
  const g = temp(a, scene.add.image(pc.cont.x, pc.cont.y, pc.spr.texture.key, pc.spr.frame.name).setOrigin(0.5, 1)
    .setScale(pc.spr.scaleX * pc.cont.scaleX, pc.spr.scaleY * pc.cont.scaleY).setRotation(pc.cont.rotation).setAlpha(alpha).setDepth(98));
  if (add) g.setBlendMode(Phaser.BlendModes.ADD);
  T(a, { targets: g, alpha: 0, duration: 220, onComplete: () => dispose(a, g) });
}

function particles(a, x, y, n, o) {
  const items = [];
  for (let i = 0; i < n; i++) {
    const ang = (o.dir !== undefined ? o.dir + rnd(-o.spread, o.spread) : rnd(0, Math.PI * 2)), sp = rnd(o.v0, o.v1) * geo.sq;
    const im = temp(a, scene.add.image(x, y, o.key || 'star').setDepth(120).setBlendMode(o.add === false ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD));
    if (o.tints) im.setTint(o.tints[i % o.tints.length]);
    const s0 = rnd(o.s0, o.s1) * geo.sq / 64;
    items.push({ im, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, s: s0, spin: rnd(-6, 6) });
    im.setScale(s0);
  }
  CNT(a, {
    from: 0, to: 1, duration: o.dur, ease: 'Quad.easeOut',
    onUpdate: tw => { const t = tw.getValue(); for (const p of items) { if (!p.im.scene) continue; p.im.x = x + p.vx * t; p.im.y = y + p.vy * t + (o.g || 0) * geo.sq * t * t; p.im.rotation = p.spin * t; p.im.setScale(p.s * (1 - 0.7 * t)); p.im.alpha = 1 - t * t; } },
    onComplete: () => items.forEach(p => dispose(a, p.im))
  });
}
function ring(a, x, y, size, color, dur) {
  const r = temp(a, scene.add.image(x, y, 'ring').setDepth(119).setBlendMode(Phaser.BlendModes.ADD).setTint(color).setScale(size * 0.1 / 128 * 2));
  T(a, { targets: r, scale: size / 128 * 2, alpha: 0, duration: dur, ease: 'Cubic.easeOut', onComplete: () => dispose(a, r) });
}
function flash(a, x, y, size) {
  const f = temp(a, scene.add.image(x, y, 'dot').setDepth(121).setBlendMode(Phaser.BlendModes.ADD).setScale(size / 64));
  T(a, { targets: f, alpha: 0, scale: size / 64 * 1.5, duration: 160, onComplete: () => dispose(a, f) });
}
function dust(a, x, y, n) {
  for (let i = 0; i < n; i++) {
    const d = temp(a, scene.add.image(x + rnd(-0.25, 0.25) * geo.sq, y + rnd(-0.03, 0.03) * geo.sq, 'dot').setDepth(97).setTint(0xe8dcc0).setAlpha(0.5).setScale(rnd(0.15, 0.3) * geo.sq / 64));
    T(a, { targets: d, x: d.x + rnd(-0.5, 0.5) * geo.sq, y: d.y - rnd(0.02, 0.18) * geo.sq, scale: d.scale * 2.4, alpha: 0, duration: rnd(260, 420), ease: 'Quad.easeOut', onComplete: () => dispose(a, d) });
  }
}
function shake(ms, power) { if (scene.cameras.main) scene.cameras.main.shake(ms, power); }

function shatter(a, pc, ux, uy, k) {   // 기물을 타일 조각으로 쪼개 흩뿌리며 소멸
  const key = 'p-' + theme.id, tex = scene.textures.get(key), fr = tex.get(pc.spr.frame.name), s = pieceScale();
  const NX = 4, NY = 5, tw_ = fr.width / NX, th_ = fr.height / NY, items = [];
  for (let i = 0; i < NY; i++) for (let j = 0; j < NX; j++) {
    const name = `${fr.name}_${i}_${j}`;
    if (!tex.has(name)) tex.add(name, 0, fr.cutX + j * tw_, fr.cutY + i * th_, tw_, th_);
    const lx = ((j + 0.5) * tw_ - fr.width / 2) * s, ly = ((i + 0.5) * th_ - fr.height) * s;
    const im = temp(a, scene.add.image(pc.cont.x + lx, pc.cont.y + ly, key, name).setScale(s).setDepth(115));
    const rx = lx / geo.sq, ry = (ly + fr.height * s * 0.5) / geo.sq;
    items.push({ im, x0: im.x, y0: im.y, vx: (ux * 1.6 + rx * 2.2 + rnd(-0.5, 0.5)) * geo.sq, vy: (uy * 1.6 + ry * 1.6 - rnd(0.2, 0.9)) * geo.sq, spin: rnd(-9, 9) });
  }
  CNT(a, {
    from: 0, to: 1, duration: 520 * k, ease: 'Sine.easeOut',
    onUpdate: tw => { const t = tw.getValue(); for (const p of items) { if (!p.im.scene) continue; p.im.x = p.x0 + p.vx * t; p.im.y = p.y0 + p.vy * t + geo.sq * 1.4 * t * t; p.im.rotation = p.spin * t; p.im.setScale(s * (1 - 0.55 * t)); p.im.alpha = 1 - t * t * t; } },
    onComplete: () => items.forEach(p => dispose(a, p.im))
  });
}

function fling(a, pc, ux, uy, k) {   // 포켓몬 테마: 부딪힌 방향 그대로 판 밖으로 튕겨나감
  const x0 = pc.cont.x, y0 = pc.cont.y, W = scene.scale.width, H = scene.scale.height;
  const ang = Math.atan2(uy, ux) + rnd(-0.1, 0.1), dx = Math.cos(ang), dy = Math.sin(ang);
  // 보드 사각형을 벗어나는 거리 + 여유 → 판 밖(패널 위)까지 날아간다
  const bx0 = geo.x0, bx1 = geo.x0 + geo.sq * 8, by0 = geo.y0 - geo.sq * 0.6, by1 = geo.y0 + geo.sq * 8;
  let L = 1e9;
  if (dx > 0.001) L = Math.min(L, (bx1 - x0) / dx); else if (dx < -0.001) L = Math.min(L, (bx0 - x0) / dx);
  if (dy > 0.001) L = Math.min(L, (by1 - y0) / dy); else if (dy < -0.001) L = Math.min(L, (by0 - y0) / dy);
  L = Math.min(L + geo.sq * 2.6, Math.hypot(W, H));
  const spin = (dx >= 0 ? 1 : -1) * rnd(10, 16), arc = geo.sq * rnd(0.5, 0.9);
  pc.cont.setDepth(125);
  temp(a, pc.cont);
  CNT(a, {
    from: 0, to: 1, duration: 760 * k, ease: 'Linear',
    onUpdate: tw => {
      const t = tw.getValue(), e = 1 - Math.pow(1 - t, 2.4);
      pc.cont.x = x0 + dx * L * e; pc.cont.y = y0 + dy * L * e - Math.sin(Math.PI * Math.min(1, t * 1.25)) * arc;
      pc.cont.rotation = spin * e; const s = 1 - 0.25 * t; pc.cont.setScale(s);
      pc.cont.alpha = t < 0.8 ? 1 : 1 - (t - 0.8) / 0.2;
      if (t < 0.7 && Math.random() < 0.5) { const g = temp(a, scene.add.image(pc.cont.x, pc.cont.y - geo.sq * 0.5, 'star').setBlendMode(Phaser.BlendModes.ADD).setTint(0xfff2a0).setDepth(124).setScale(rnd(0.15, 0.3) * geo.sq / 64)); T(a, { targets: g, alpha: 0, scale: 0, y: g.y + geo.sq * 0.2, duration: 300, onComplete: () => dispose(a, g) }); }
    },
    onComplete: () => { if (pc.cont.scene) { scene.tweens.killTweensOf([pc.cont, pc.sh, pc.spr]); pc.cont.destroy(); } a.temps.delete(pc.cont); }
  });
}

// ---------- 이동 / 잡기 ----------
function hopPose(pc, p0, dx, dy, t, hop, dir, dist) {
  const sw = Math.sin(Math.PI * t);
  pc.cont.x = p0.x + dx * t; pc.cont.y = p0.y + dy * t - sw * hop;
  pc.cont.rotation = dir * 0.15 * sw * Math.min(1, dist * 0.6 + 0.4) + Math.sin(t * 17) * 0.035 * (1 - t);
  pc.cont.scaleY = 1 + 0.09 * sw; pc.cont.scaleX = 1 - 0.05 * sw;
}
function settleBounce(a, pc, dir, k, amp) {   // 착지: 찌그러졌다가 출렁이며 복귀
  T(a, { targets: pc.cont, scaleX: 1.14, scaleY: 0.84, duration: 60 * k, ease: 'Quad.easeOut', onComplete: () => {
    a.settled = true;
    T(a, { targets: pc.cont, scaleX: 1, scaleY: 1, duration: 420 * k, ease: 'Elastic.easeOut' });
    pc.cont.rotation = -dir * amp;
    T(a, { targets: pc.cont, rotation: 0, duration: 520 * k, ease: 'Elastic.easeOut', onComplete: () => finishAnim(a) });
  } });
}

function startMoveAnim(an, prev) {
  const code = prev[an.f], mover = pcs.get(an.f);
  if (!code || !mover) return false;
  const k = an.fast ? 0.6 : 1, a = newAnim();
  let vSq = -1;
  if (prev[an.t]) vSq = an.t; else if (Math.abs(code) === 1 && (an.f & 7) !== (an.t & 7)) vSq = (an.f & ~7) | (an.t & 7);
  const victim = vSq >= 0 ? pcs.get(vSq) : null;
  const castle = Math.abs(code) === 6 && Math.abs((an.t & 7) - (an.f & 7)) === 2;
  const knight = Math.abs(code) === 2;
  // 소유권 이전: 출발 칸 -> 도착 칸
  pcs.delete(an.f); pcs.set(an.t, mover);
  a.locks.push(an.f, an.t); locked.add(an.f); locked.add(an.t);
  let rook = null;
  if (castle) {
    const rf = (an.f & ~7) | (an.t > an.f ? 7 : 0), rt = (an.f & ~7) | (an.t > an.f ? 5 : 3);
    rook = pcs.get(rf);
    if (rook) { pcs.delete(rf); pcs.set(rt, rook); a.locks.push(rf, rt); locked.add(rf); locked.add(rt); rook.to = rt; rook.from = rf; }
  }
  mover.sq = an.t;
  const p0 = footOf(an.f), p1 = footOf(an.t);
  const ddx = p1.x - p0.x, ddy = p1.y - p0.y, dist = Math.hypot(ddx, ddy) / geo.sq;
  const ux = ddx / (Math.hypot(ddx, ddy) || 1), uy = ddy / (Math.hypot(ddx, ddy) || 1), dir = ddx >= 0 ? 1 : -1;
  mover.cont.setDepth(100); scene.tweens.killTweensOf([mover.cont, mover.sh]); mover.sh.setY(-geo.sq * 0.02);
  mover.cont.setScale(1).setRotation(0).setPosition(p0.x, p0.y); mover.lift = 0;
  a.finishHooks.push(() => {
    placePiece(mover, an.t);
    if (victim && victim.cont.scene && !victim.gone) { killPiece(victim); }
    if (rook) placePiece(rook, rook.to);
    const nv = view && view.b ? view.b[an.t] : code;
    if (view && Math.abs(code) === 1 && nv && Math.abs(nv) !== 1) { /* 승급: reconcile 이 새 기물로 교체 */ }
  });
  const promoted = () => view && Math.abs(code) === 1 && view.b[an.t] && Math.abs(view.b[an.t]) !== 1;
  const land = () => {
    dust(a, p1.x, p1.y, 5);
    if (promoted()) { window.SFX && SFX.play('promote'); flash(a, p1.x, p1.y - geo.sq * 0.6, geo.sq * 1.6); particles(a, p1.x, p1.y - geo.sq * 0.6, 14, { key: 'star', v0: 0.5, v1: 1.3, s0: 0.2, s1: 0.45, dur: 600, tints: [0xffe680, 0xffffff, 0xffb020] }); }
    else window.SFX && SFX.play(castle ? 'castle' : 'move', theme.id === 'creature');
  };

  if (!victim) {
    // ---- 일반 이동: 웅크림 → 호를 그리며 빠르게 → 착지 찌그러짐 + 출렁임
    const dur = clamp(170 + dist * 55, 210, 470) * k, hop = (knight ? 0.55 : Math.min(0.1 + 0.03 * dist, 0.26)) * geo.sq;
    let lastGhost = 0;
    T(a, { targets: mover.cont, scaleX: 1.1, scaleY: 0.88, duration: 70 * k, ease: 'Quad.easeOut', onComplete: () => {
      CNT(a, { from: 0, to: 1, duration: dur, ease: 'Sine.easeInOut',
        onUpdate: tw => { hopPose(mover, p0, ddx, ddy, tw.getValue(), hop, dir, dist); const now = scene.time.now; if (dist > 1.3 && now - lastGhost > 34) { lastGhost = now; ghost(a, mover, 0.28, false); } },
        onComplete: () => { mover.cont.x = p1.x; mover.cont.y = p1.y; land(); settleBounce(a, mover, dir, k, 0.1); } });
    } });
    if (rook) {
      const r0 = footOf(rook.from), r1 = footOf(rook.to);
      rook.cont.setDepth(99).setPosition(r0.x, r0.y);
      T(a, { targets: rook.cont, x: r1.x, y: r1.y, duration: dur + 70 * k, ease: 'Back.easeOut' });
    }
    SFXSwish(dist, an.fast);
    return a;
  }

  // ---- 잡기: 뒤로 당겼다가 → 돌격 → 충돌, 상대는 소멸(일반) / 튕겨나감(포켓몬)
  const vf = footOf(vSq), uvx = vf.x - p0.x, uvy = vf.y - p0.y, ul = Math.hypot(uvx, uvy) || 1, vx = uvx / ul, vy = uvy / ul;
  const wx = p0.x - vx * geo.sq * 0.2, wy = p0.y - vy * geo.sq * 0.2;
  const qx = vf.x - vx * geo.sq * 0.36, qy = vf.y - vy * geo.sq * 0.36;
  const pokemon = theme.id === 'creature';
  victim.gone = false; locked.add(vSq); a.locks.push(vSq); pcs.delete(vSq);
  victim.cont.setDepth(99); scene.tweens.killTweensOf([victim.cont, victim.sh]);
  window.SFX && SFX.play('swish');
  T(a, { targets: mover.cont, x: wx, y: wy, scaleX: 1.08, scaleY: 0.9, rotation: -dir * 0.12, duration: 120 * k, ease: 'Quad.easeOut', onComplete: () => {
    let lastGhost = 0;
    CNT(a, { from: 0, to: 1, duration: 125 * k, ease: 'Cubic.easeIn',
      onUpdate: tw => {
        const t = tw.getValue(); mover.cont.x = wx + (qx - wx) * t; mover.cont.y = wy + (qy - wy) * t;
        mover.cont.rotation = -dir * 0.12 + dir * 0.4 * t; mover.cont.scaleX = 1.08 - 0.12 * t; mover.cont.scaleY = 0.9 + 0.2 * t;
        const now = scene.time.now; if (now - lastGhost > 18) { lastGhost = now; ghost(a, mover, 0.4, true); }
      },
      onComplete: () => {
        // 충돌
        const ix = (qx + vf.x) / 2, iy = (qy + vf.y) / 2 - geo.sq * 0.45;
        window.SFX && SFX.play(pokemon ? 'launch' : 'capture');
        shake(pokemon ? 170 : 130, pokemon ? 0.0055 : 0.004);
        flash(a, ix, iy, geo.sq * 2.1); ring(a, ix, iy, geo.sq * 2.4, pokemon ? 0xfff2a0 : 0xffffff, 300 * k);
        if (pokemon) {
          const b = temp(a, scene.add.image(ix, iy, 'burst').setDepth(122).setScale(geo.sq * 0.4 / 256).setRotation(rnd(-0.3, 0.3)));
          T(a, { targets: b, scale: geo.sq * 1.7 / 256, duration: 110, ease: 'Back.easeOut', yoyo: false, onComplete: () => T(a, { targets: b, alpha: 0, scale: geo.sq * 2 / 256, duration: 220, onComplete: () => dispose(a, b) }) });
          particles(a, ix, iy, 10, { key: 'star', v0: 0.8, v1: 2, s0: 0.25, s1: 0.5, dur: 480 * k, tints: [0xfff2a0, 0xffffff, 0xffc233] });
          AFTER(a, 40 * k, () => fling(a, victim, vx, vy, k));
          victim.gone = true;   // fling 이 소유 (finishAnim 에서 temp 로 정리)
        } else {
          particles(a, ix, iy, 16, { key: 'star', v0: 0.9, v1: 2.4, s0: 0.15, s1: 0.4, dur: 420 * k, tints: [0xffffff, 0xffe680, 0xff9d3a] });
          particles(a, ix, iy, 8, { key: 'shard', add: false, v0: 0.6, v1: 1.6, s0: 0.25, s1: 0.5, dur: 520 * k, g: 1.6, tints: victim.code > 0 ? [0xe8e8e8, 0xbbbbbb] : [0x333333, 0x666666] });
          victim.cont.setVisible(false);
          shatter(a, victim, vx, vy, k);
          victim.gone = true; temp(a, victim.cont); a.finishHooks.push(() => { if (victim.cont.scene) victim.cont.destroy(); });
        }
        // 히트스톱 후 공격자는 제자리로 반동하며 안착
        AFTER(a, 45 * k, () => {
          T(a, { targets: mover.cont, x: p1.x, y: p1.y, scaleX: 1.12, scaleY: 0.86, rotation: dir * 0.05, duration: 170 * k, ease: 'Back.easeOut', onComplete: () => { dust(a, p1.x, p1.y, 6); if (promoted()) { window.SFX && SFX.play('promote'); } settleBounce(a, mover, dir, k, 0.12); } });
        });
      } });
  } });
  return a;
}
function SFXSwish(dist, fast) { if (window.SFX && dist > 2.2 && !fast) SFX.play('swish'); }

// ---------- 유휴 시 렌더 정지 (배터리) ----------
let sleepTimer = 0;
function wake() { if (!game) return; clearTimeout(sleepTimer); try { if (!game.loop.running) game.loop.wake(); } catch (_) {} sleepTimer = setTimeout(maybeSleep, 700); }
function maybeSleep() {
  if (anims.size || (view && (view.hint || view.check >= 0))) { sleepTimer = setTimeout(maybeSleep, 500); return; }
  try { if (game.loop.running) game.loop.sleep(); } catch (_) {}
}

// ---------- 공개 API ----------
function fullRebuild() {
  finishAll(); clearPieces(); placeBoard(); builtKey = theme.id + ':' + bottom();
}

function sync(v) {
  v = { ...v, b: Int8Array.from(v.b) };
  if (!PB.ready) { pending = v; return; }
  wake();
  const prev = view, bkChanged = !prev || prev.bottom !== v.bottom;
  const an = v.anim && prev && !bkChanged && builtKey === theme.id + ':' + v.bottom ? v.anim : null;
  if (an) finishAll();
  view = v; computeGeo();
  if (bkChanged || builtKey !== theme.id + ':' + v.bottom) fullRebuild(); else placeBoard();
  let a = null;
  if (an && prev) { try { a = startMoveAnim(an, prev.b); } catch (e) { console.error(e); a = null; finishAll(); } }
  reconcile();
  buildOverlays();
  void a;
}

function relayout() {
  if (!PB.ready) return;
  wake();
  const d = DPR(), W = Math.max(1, Math.round(window.innerWidth * d)), H = Math.max(1, Math.round(window.innerHeight * d));
  game.scale.resize(W, H);
  const cv = game.canvas; cv.style.width = window.innerWidth + 'px'; cv.style.height = window.innerHeight + 'px';
  if (!view) return;
  computeGeo(); fullRebuild(); reconcile(); buildOverlays();
}

function setTheme(th) {
  theme = th;
  if (!PB.ready) return;
  wake();
  if (view) { computeGeo(); fullRebuild(); reconcile(); buildOverlays(); }
}

PB.sync = sync; PB.relayout = relayout; PB.setTheme = setTheme; PB.busy = busy;
PB.whenIdle = function (cb) { const t = () => (busy() ? setTimeout(t, 40) : cb()); t(); };

class Main extends Phaser.Scene {
  preload() { for (const th of THEMES) { this.load.image('p-' + th.id, th.pieces.src); this.load.image('b-' + th.id, th.board.src); } }
  create() {
    scene = this;
    makeTextures(); addFrames();
    PB.ready = true; PB.scene = this;
    relayout();
    if (pending) { const v = pending; pending = null; sync(v); }
  }
}

(function boot() {
  const d = DPR();
  game = new Phaser.Game({
    type: Phaser.AUTO, parent: 'fx', transparent: true,
    width: Math.round(window.innerWidth * d), height: Math.round(window.innerHeight * d),
    scale: { mode: Phaser.Scale.NONE }, banner: false, autoFocus: false, disableContextMenu: true,
    audio: { noAudio: true }, input: { mouse: false, touch: false, keyboard: false, gamepad: false },
    render: { antialias: true, mipmapFilter: 'LINEAR_MIPMAP_LINEAR' },
    scene: Main
  });
  PB.game = game;
  if (window.ResizeObserver) new ResizeObserver(() => relayout()).observe(document.getElementById('board'));
  window.addEventListener('resize', () => relayout());
})();
})();
