(() => {
  'use strict';
  const C = window.Chess, THEMES = window.THEMES;
  let SP = THEMES[0];
  const $ = s => document.querySelector(s);
  const NAMES = { 1: '폰', 2: '나이트', 3: '비숍', 4: '룩', 5: '퀸', 6: '킹' };
  const LETTERS = { 1: 'P', 2: 'N', 3: 'B', 4: 'R', 5: 'Q', 6: 'K' };
  const OPT_DEFS = [
    { k: 'castling', label: '캐슬링', desc: '킹과 룩을 한 번에 움직이는 특수 수' },
    { k: 'ep', label: '앙파상', desc: '폰이 2칸 전진한 직후 옆에서 지나가며 잡기' },
    { k: 'dbl', label: '폰 2칸 전진', desc: '폰의 첫 수에 2칸 전진 허용' },
    { k: 'promoChoice', label: '승급 기물 직접 선택', desc: '끄면 자동으로 퀸 승급' },
    { k: 'fifty', label: '50수 무승부', desc: '폰 이동·잡기 없이 50수(양쪽 100수) 경과 시 무승부' },
    { k: 'threefold', label: '3회 동형 반복 무승부', desc: '같은 局面이 3번 나오면 무승부' },
    { k: 'insufficient', label: '기물 부족 무승부', desc: '체크메이트가 불가능한 기물 구성이면 무승부' },
    { k: 'kingCapture', label: '킹 잡기 승리', desc: '체크/체크메이트 없이 상대 킹을 직접 잡으면 승리' }
  ];
  const DEFAULT_OPTS = { castling: true, ep: true, dbl: true, promoChoice: true, fifty: true, threefold: true, insufficient: true, kingCapture: false };

  // ---------- 설정 ----------
  const S = { mode: 'pvp', human: 1, flip: false, theme: THEMES[0].id, opts: { ...DEFAULT_OPTS }, hintPref: { w: 0, b: 0 } };
  try {
    const raw = JSON.parse(localStorage.getItem('chess-settings') || 'null');
    if (raw) {
      if (['pvp', 'easy', 'hard'].includes(raw.mode)) S.mode = raw.mode;
      if (raw.human === 1 || raw.human === -1) S.human = raw.human;
      if (THEMES.some(t => t.id === raw.theme)) S.theme = raw.theme;
      if (raw.opts) for (const k in DEFAULT_OPTS) if (typeof raw.opts[k] === 'boolean') S.opts[k] = raw.opts[k];
      if (raw.hintPref) S.hintPref = { w: (raw.hintPref.w | 0) % 6, b: (raw.hintPref.b | 0) % 6 };
    }
  } catch (_) {}
  const save = () => { try { localStorage.setItem('chess-settings', JSON.stringify({ mode: S.mode, human: S.human, theme: S.theme, opts: S.opts, hintPref: S.hintPref })); } catch (_) {} };

  // ---------- AI (Worker, 실패 시 메인 스레드) ----------
  const AI = {
    worker: null, pending: new Map(), id: 0,
    init() {
      try {
        this.worker = new Worker('ai-worker.js');
        this.worker.onmessage = e => { const cb = this.pending.get(e.data.id); if (cb) { this.pending.delete(e.data.id); cb.cb(e.data.move); } };
        this.worker.onerror = () => {
          this.worker = null;
          const items = [...this.pending.values()]; this.pending.clear();
          items.forEach(it => setTimeout(() => it.cb(C.think(it.args.state, it.args.opts, it.args.level)), 30));
        };
      } catch (_) { this.worker = null; }
    },
    ask(state, opts, level, cb) {
      const id = ++this.id, args = { state, opts: { ...opts }, level };
      if (this.worker) { this.pending.set(id, { cb, args }); this.worker.postMessage({ id, ...args }); }
      else setTimeout(() => cb(C.think(state, args.opts, level)), 30);
    },
    reset() {
      if (this.worker) { try { this.worker.terminate(); } catch (_) {} this.worker = null; }
      this.pending.clear();
      this.init();
    }
  };

  // ---------- 상태 ----------
  let G = null;
  const ck = color => (color === 1 ? 'w' : 'b');
  const controlled = color => S.mode === 'pvp' || color === S.human;
  const bottomColor = () => { const base = S.mode === 'pvp' ? 1 : S.human; return S.flip ? -base : base; };
  const ctx = () => ({ ply: G.ply, fiftyStart: G.fiftyStart, threefoldStart: G.threefoldStart, keys: G.keys });
  const sqName = sq => 'abcdefgh'[sq & 7] + (8 - (sq >> 3));

  function newGame() {
    freshGame(C.initial(), { w: [], b: [] }, null, []);
    render();
    maybeAI();
  }

  // 새 게임 상태 만들기 (처음부터 / 리플레이에서 "이대로 게임 하기")
  function freshGame(s, cap, last, rec) {
    if (G && G.replay) { clearInterval(G.replay.timer); }
    AI.reset();
    G = {
      s, ply: 0, keys: [], fiftyStart: 0, threefoldStart: 0, last, over: null,
      capturedBy: { w: cap.w.slice(), b: cap.b.slice() }, hints: { ...S.hintPref }, hintMove: null, sel: -1, legal: [],
      edit: false, thinking: false, hinting: false, token: (G ? G.token : 0) + 1,
      rec, hist: [], replay: null, saved: false, preEdit: null, anim: null
    };
    G.keys.push({ key: C.key(G.s), ply: 0 });
    document.body.classList.remove('replaying');
    $('#editsw').checked = false;
    const r = refreshLegal();
    closeAll();
    return r;
  }

  // ---------- 기보 / 무르기 ----------
  const pad2 = n => String(n).padStart(2, '0');
  const toStore = s => ({ b: Array.from(s.b), t: s.t, c: s.c, ep: s.ep, hm: s.hm, fm: s.fm, k: s.k.slice() });
  const fromStore = o => ({ b: Int8Array.from(o.b), t: o.t, c: o.c, ep: o.ep, hm: o.hm, fm: o.fm, k: o.k.slice() });
  const moveCount = rec => rec.filter(e => e.k === 'm').length;
  const recBase = rec => (rec[0] && rec[0].start ? 1 : 0);

  function snap() {
    return { s: G.s, ply: G.ply, keys: G.keys.slice(), fiftyStart: G.fiftyStart, threefoldStart: G.threefoldStart, last: G.last,
      cap: { w: G.capturedBy.w.slice(), b: G.capturedBy.b.slice() }, hints: { ...G.hints }, recLen: G.rec.length };
  }
  function restore(sn) {
    G.s = sn.s; G.ply = sn.ply; G.keys = sn.keys.slice(); G.fiftyStart = sn.fiftyStart; G.threefoldStart = sn.threefoldStart;
    G.last = sn.last; G.capturedBy = { w: sn.cap.w.slice(), b: sn.cap.b.slice() }; G.hints = { ...sn.hints };
    G.rec.length = sn.recLen;
  }
  function undo() {
    if (!G || G.replay || G.edit || !G.hist.length) return;
    cancelPending(); hide('#result'); hide('#promo');
    let sn = G.hist.pop();
    if (S.mode !== 'pvp') while (sn.s.t !== S.human && G.hist.length) sn = G.hist.pop();   // 컴퓨터 대전: 내 차례로 되돌림
    restore(sn);
    G.over = null; G.sel = -1; G.hintMove = null; G.anim = null; G.saved = false;
    refreshLegal(); render(); maybeAI();
  }

  function buildFrames(rec) {
    const base = recBase(rec);
    let s = C.initial(), cap = { w: [], b: [] };
    if (base) { s = fromStore(rec[0].st); cap = { w: ((rec[0].cap || {}).w || []).slice(), b: ((rec[0].cap || {}).b || []).slice() }; }
    const frames = [{ s, last: null, cap }], entries = rec.slice(base);
    for (const e of entries) {
      const prev = frames[frames.length - 1], c2 = { w: prev.cap.w.slice(), b: prev.cap.b.slice() };
      let ns, last = null;
      if (e.k === 'e') ns = fromStore(e.st);
      else {
        const m = { f: e.f, t: e.to, fl: e.fl || null, p: e.p || 0 }, tgt = prev.s.b[m.t];
        if (tgt !== 0) c2[ck(prev.s.t)].push(Math.abs(tgt)); else if (m.fl === 'ep') c2[ck(prev.s.t)].push(1);
        ns = C.make(prev.s, m); last = { f: m.f, t: m.t };
      }
      frames.push({ s: ns, last, cap: c2 });
    }
    return { entries, frames };
  }

  // 저장소 (localStorage)
  function loadRecs() {
    try {
      const a = JSON.parse(localStorage.getItem('chess-records') || '[]');
      return Array.isArray(a) ? a.filter(r => r && Array.isArray(r.rec) && typeof r.name === 'string') : [];
    } catch (_) { return []; }
  }
  function storeRecs(list) {
    try { localStorage.setItem('chess-records', JSON.stringify(list)); return true; } catch (_) { return false; }
  }
  function defaultName() {
    const d = new Date(), ds = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    let mx = 0;
    for (const r of loadRecs()) { const m = r.name.startsWith(ds + ' #') && /^\d+$/.test(r.name.slice(ds.length + 2)) ? +r.name.slice(ds.length + 2) : 0; if (m > mx) mx = m; }
    return `${ds} #${mx + 1}`;
  }
  const resultText = () => !G.over ? '진행 중' : (G.over.r === 'd' ? '무승부' : G.over.r === 'w' ? '백 승' : '흑 승') + ` (${G.over.why})`;
  const modeLabel = () => S.mode === 'pvp' ? '2인' : S.mode === 'easy' ? '컴퓨터 쉬움' : '컴퓨터 어려움';

  let nameCb = null;
  function openName(title, value, cb) {
    $('#name-title').textContent = title; $('#name-in').value = value; nameCb = cb; show('#namebox');
    setTimeout(() => { try { $('#name-in').focus(); $('#name-in').select(); } catch (_) {} }, 50);
  }
  function nameOk() {
    const v = $('#name-in').value.trim().slice(0, 40); if (!v) return toast('이름을 입력하세요', 1400);
    hide('#namebox'); const cb = nameCb; nameCb = null; if (cb) cb(v);
  }
  function saveCurrent() {
    if (!moveCount(G.rec)) return toast('저장할 기보가 없습니다', 1500);
    openName('기보 이름', defaultName(), name => {
      const list = loadRecs();
      list.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, ts: Date.now(), result: resultText(), mode: modeLabel(), n: moveCount(G.rec), rec: G.rec.slice() });
      if (!storeRecs(list)) return toast('저장하지 못했습니다 (저장소 사용 불가)', 2400);
      G.saved = true; updateResultBtns(); toast('기보를 저장했습니다');
    });
  }
  function updateResultBtns() { const b = $('#btn-save-rec'); b.disabled = G.saved; b.textContent = G.saved ? '저장됨 ✓' : '기보 저장'; }

  function buildRecords() {
    const box = $('#rec-list'); box.innerHTML = '';
    const list = loadRecs().sort((a, b) => b.ts - a.ts);
    if (!list.length) { const e = mk('empty'); e.textContent = '저장된 기보가 없습니다.'; box.appendChild(e); return; }
    for (const r of list) {
      const row = mk('recrow'), info = mk('recinfo'), nm = mk('rn', 'b'), meta = mk('rm', 'span');
      nm.textContent = r.name;
      const d = new Date(r.ts || 0);
      meta.textContent = `${r.n || moveCount(r.rec)}수 · ${r.result || ''} · ${r.mode || ''} · ${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
      info.append(nm, meta);
      const play = mk('btn', 'button'), ren = mk('btn icon', 'button'), del = mk('btn icon', 'button');
      play.textContent = '▶ 재생'; ren.textContent = '✎'; del.textContent = '🗑';
      ren.setAttribute('aria-label', '이름 변경'); del.setAttribute('aria-label', '삭제');
      play.onclick = () => startReplay(r.rec, r.name);
      ren.onclick = () => openName('이름 변경', r.name, name => { const l = loadRecs(); const x = l.find(y => y.id === r.id); if (x) { x.name = name; storeRecs(l); } buildRecords(); });
      let armed = 0;
      del.onclick = () => {
        if (!armed) { armed = 1; del.textContent = '삭제?'; setTimeout(() => { armed = 0; del.textContent = '🗑'; }, 2500); return; }
        storeRecs(loadRecs().filter(y => y.id !== r.id)); buildRecords();
      };
      row.append(info, play, ren, del); box.appendChild(row);
    }
  }
  function openRecords() { hide('#menu'); buildRecords(); show('#records'); }

  // ---------- 리플레이 ----------
  function startReplay(rec, name) {
    if (G.edit) { $('#editsw').checked = false; setEdit(false); }
    cancelPending(); closeAll();
    if (G.replay) clearInterval(G.replay.timer);
    const { entries, frames } = buildFrames(rec);
    G.replay = { name, entries, frames, idx: 0, playing: false, timer: 0 };
    G.sel = -1; G.hintMove = null; G.anim = null;
    document.body.classList.add('replaying');
    render();
    if (entries.length) rpPlay(); else toast('기록된 수가 없습니다', 1500);
  }
  function rpGo(i, anim) {
    const R = G.replay; R.idx = i;
    G.anim = anim && R.frames[i].last ? { f: R.frames[i].last.f, t: R.frames[i].last.t } : null;
    render();
  }
  function rpPause() { const R = G.replay; if (!R) return; clearInterval(R.timer); R.playing = false; render(); }
  function rpPlay() {
    const R = G.replay, n = R.entries.length;
    if (R.idx >= n) { R.idx = 0; G.anim = null; }
    R.playing = true; clearInterval(R.timer);
    R.timer = setInterval(() => {
      if (R.idx >= n) return rpPause();
      rpGo(R.idx + 1, true);
      if (R.idx >= n) rpPause();
    }, 500);
    render();
  }
  function rpStep(d) {
    const R = G.replay; if (!R || R.playing) return;
    const i = R.idx + d; if (i < 0 || i > R.entries.length) return;
    rpGo(i, d > 0);
  }
  function rpExit() {
    if (!G.replay) return;
    clearInterval(G.replay.timer); G.replay = null; G.anim = null;
    document.body.classList.remove('replaying');
    render(); maybeAI();
  }
  function rpResume() {   // 일시정지된 局面에서 별개의 새 기보로 게임 시작
    const R = G.replay; if (!R || R.playing) return;
    const f = R.frames[R.idx];
    const s = fromStore(toStore(f.s));
    const cap = { w: f.cap.w.slice(), b: f.cap.b.slice() };
    const rec = [{ k: 'e', start: true, st: toStore(s), cap, txt: '시작' }];
    const r = freshGame(s, cap, f.last ? { ...f.last } : null, rec);
    G.over = r.over;
    render();
    if (G.over) showResult(); else maybeAI();
  }

  // 하단 기보 표시 (좌표 표기, 현재 수를 가운데로 흘림)
  let logKey = '';
  function renderLog() {
    const box = $('#log'), R = G.replay;
    const entries = R ? R.entries : G.rec.slice(recBase(G.rec));
    const cur = R ? R.idx - 1 : entries.length - 1;
    const key = (R ? 'r' : 'g') + entries.length + ':' + cur + ':' + (R ? R.name : '');
    if (key === logKey) return;
    const sameList = logKey.split(':')[0] === key.split(':')[0];
    logKey = key;
    box.innerHTML = '';
    entries.forEach((e, i) => {
      const t = mk('tk' + (i === cur ? ' cur' : '') + (e.k === 'e' ? ' ed' : ''), 'span');
      t.textContent = e.k === 'e' ? '✎' : (e.w ? e.n + '.' : '') + e.txt;
      t.dataset.i = i; box.appendChild(t);
    });
    if (!entries.length) { const t = mk('tk ph', 'span'); t.textContent = '기보: 아직 둔 수가 없습니다'; box.appendChild(t); }
    const el = box.children[Math.max(cur, 0)];
    try { if (el && el.offsetLeft !== undefined) box.scrollTo ? box.scrollTo({ left: el.offsetLeft - box.clientWidth / 2 + el.offsetWidth / 2, behavior: sameList ? 'smooth' : 'auto' }) : (box.scrollLeft = el.offsetLeft - box.clientWidth / 2); } catch (_) {}
  }

  function refreshLegal() {
    const r = C.gameStatus(G.s, S.opts, ctx());
    G.legal = r.moves.map(e => e.m);
    return r;
  }

  function cancelPending() {
    G.token++;
    if (G.thinking || G.hinting) AI.reset();
    G.thinking = false; G.hinting = false;
  }

  // ---------- 렌더 ----------
  function spriteStyle(el, def, col, row) {
    el.style.backgroundImage = `url(${def.src})`;
    el.style.backgroundSize = `${def.cols * 100}% ${def.rows * 100}%`;
    el.style.backgroundPosition = `${def.cols > 1 ? col * 100 / (def.cols - 1) : 0}% ${def.rows > 1 ? row * 100 / (def.rows - 1) : 0}%`;
  }
  function pieceSprite(el, code, def) {
    const a = Math.abs(code), pd = def || SP.pieces;
    spriteStyle(el, pd, pd.col[LETTERS[a]], code > 0 ? pd.row.w : pd.row.b);
  }
  function boardSprite(el, name) { spriteStyle(el, SP.board, SP.board.cell[name], 0); }

  const boardEl = $('#board'), cells = [];
  const axisR = [...$('#ranks').children], axisF = [...$('#files').children];
  function mk(cls, tag) { const e = document.createElement(tag || 'div'); e.className = cls; return e; }
  function applyTheme() {
    SP = THEMES.find(t => t.id === S.theme) || THEMES[0];
    const st = document.documentElement.style, u = SP.ui, p = SP.pieces;
    st.setProperty('--pc-aspect', String(p.aspect));
    st.setProperty('--pc-ratio', String(1 / p.aspect));
    st.setProperty('--pc-bottom', String(p.bottom));
    st.setProperty('--ov', `calc(var(--sq) * ${(p.aspect - 0.96).toFixed(3)})`);   // 기물이 보드 위로 넘어가는 높이
    st.setProperty('--bg1', u.bg1); st.setProperty('--bg2', u.bg2);
    st.setProperty('--f1', u.f1); st.setProperty('--f2', u.f2);
    st.setProperty('--pc-filter', u.filter);
    document.documentElement.setAttribute('data-theme', SP.id);
  }
  function setTheme(id) { S.theme = id; save(); applyTheme(); layout(); buildBoard(); render(); buildMenu(); }

  function buildBoard() {
    boardEl.innerHTML = ''; cells.length = 0;
    for (let i = 0; i < 64; i++) {
      const sq = mk('sq'), bg = mk('bg'), pc = mk('pc');
      const ov = { last: mk('ov last'), sel: mk('ov sel'), hint: mk('ov hint'), check: mk('ov check'), mv: mk('ov mv') };
      boardSprite(ov.last, 'last'); boardSprite(ov.sel, 'select'); boardSprite(ov.hint, 'hint'); boardSprite(ov.check, 'check'); boardSprite(ov.mv, 'dot');
      sq.append(bg, ov.last, ov.sel, ov.hint, ov.check, ov.mv, pc);
      sq.dataset.i = i;
      boardEl.appendChild(sq);
      cells.push({ sq, bg, pc, ov, dark: -1, code: 99, mvKind: 'dot' });
    }
  }

  const PN = {};
  for (const k of ['opp', 'me']) {
    const el = $(k === 'me' ? '#p-me' : '#p-opp');
    PN[k] = { el, dot: el.querySelector('.dot'), nm: el.querySelector('.top .nm'), cap: el.querySelector('.cap'), hint: el.querySelector('.hintbtn'), act: el.querySelector('.act'), top: el.querySelector('.top') };
  }
  const editInfo = $('#p-opp .editinfo'), rpInfo = $('#p-opp .rpinfo');

  function canHint(color) {
    return G.ply > 0 && G.hints[ck(color)] > 0 && G.s.t === color && controlled(color) &&
      !G.over && !G.edit && !G.thinking && !G.hinting;
  }

  function replayView() {
    const R = G.replay, f = R.frames[R.idx];
    return { s: f.s, last: f.last, capturedBy: f.cap, sel: -1, legal: [], edit: false, hintMove: null, over: null, thinking: false, hinting: false };
  }

  function renderPanel(k, V) {
    const rp = !!G.replay;
    const bottom = bottomColor(), color = k === 'me' ? bottom : -bottom, p = PN[k], side = ck(color);
    const human = !rp && controlled(color);
    p.el.classList.toggle('turn', !V.over && !V.edit && V.s.t === color);
    let name = color === 1 ? '백' : '흑';
    if (S.mode !== 'pvp' && !rp) name = human ? `나 (${name})` : `컴퓨터 ${S.mode === 'easy' ? '쉬움' : '어려움'} (${name})`;
    if (!rp && !human && G.thinking && G.s.t === color) name += ' · 생각 중…';
    if (human && G.hinting && G.s.t === color) name += ' · 훈수 계산 중…';
    p.nm.textContent = name;
    p.dot.className = 'dot ' + (color === 1 ? 'w' : 'b');
    p.cap.innerHTML = '';
    for (const t of V.capturedBy[side].slice().sort((x, y) => y - x)) {
      const d = mk('cp'); pieceSprite(d, -color * t); p.cap.appendChild(d);
    }
    const hb = p.hint;
    hb.style.display = human ? '' : 'none';
    if (!rp) {
      if (G.ply === 0) {
        hb.textContent = `💡 훈수 횟수 ${G.hints[side]}`; hb.disabled = false; hb.classList.add('pre');
      } else {
        hb.textContent = `💡 훈수 ${G.hints[side]}`; hb.disabled = !canHint(color); hb.classList.remove('pre');
      }
    }
    if (k === 'opp') {
      const e = G.edit;
      p.top.hidden = e; p.act.hidden = e || rp; editInfo.hidden = !e || rp; rpInfo.hidden = !rp;
      if (e) $('#btn-turn').textContent = `차례: ${G.s.t === 1 ? '백' : '흑'} ⇄`;
      if (rp) $('#rp-title').textContent = `▶ ${G.replay.name} · ${G.replay.idx}/${G.replay.entries.length}`;
    } else {
      p.act.hidden = rp; $('#p-me .rp').hidden = !rp;
      $('#btn-undo').disabled = rp || G.edit || !G.hist.length;
      if (rp) {
        const R = G.replay, n = R.entries.length;
        $('#rp-play').textContent = R.playing ? '⏸' : (R.idx >= n ? '↻' : '▶');
        $('#rp-prev').disabled = R.playing || R.idx <= 0;
        $('#rp-next').disabled = R.playing || R.idx >= n;
        $('#rp-resume').hidden = R.playing;
      }
    }
  }

  function render() {
    const V = G.replay ? replayView() : G;
    const bottom = bottomColor();
    const chk = !V.edit && C.inCheck(V.s);
    const kingSq = V.s.k[V.s.t === 1 ? 0 : 1];
    const targets = new Set();
    if (V.sel >= 0 && !V.edit) for (const m of V.legal) if (m.f === V.sel) targets.add(m.t);
    const hm = V.hintMove && V.hintMove.ply === G.ply ? V.hintMove : null;
    const an = G.anim; G.anim = null;
    for (let i = 0; i < 64; i++) {
      const sq = bottom === 1 ? i : 63 - i, c = cells[i], p = V.s.b[sq];
      const dark = ((sq >> 3) + (sq & 7)) & 1;
      if (c.dark !== dark) { c.dark = dark; boardSprite(c.bg, dark ? 'dark' : 'light'); }
      if (c.code !== p) {
        c.code = p;
        if (p) { pieceSprite(c.pc, p); c.pc.style.visibility = 'visible'; } else c.pc.style.visibility = 'hidden';
      }
      c.pc.classList.toggle('lift', V.sel === sq && !V.edit && p !== 0);
      if (an && sq === an.t && p !== 0) {   // 이동 애니메이션: 출발 칸에서 미끄러져 도착
        const fi = bottom === 1 ? an.f : 63 - an.f;
        c.pc.style.setProperty('--dx', `calc(${(fi & 7) - (i & 7)} * var(--sq))`);
        c.pc.style.setProperty('--dy', `calc(${(fi >> 3) - (i >> 3)} * var(--sq))`);
        c.pc.classList.remove('anim'); void c.pc.offsetWidth; c.pc.classList.add('anim'); c.sq.classList.add('moving');
        setTimeout(() => { c.pc.classList.remove('anim'); c.sq.classList.remove('moving'); }, 280);
      }
      c.ov.last.classList.toggle('on', !!V.last && (V.last.f === sq || V.last.t === sq));
      c.ov.sel.classList.toggle('on', V.sel === sq && !V.edit);
      c.ov.hint.classList.toggle('on', !!hm && (hm.f === sq || hm.t === sq));
      c.ov.check.classList.toggle('on', chk && sq === kingSq);
      const isT = targets.has(sq);
      c.ov.mv.classList.toggle('on', isT);
      if (isT) {
        const kind = p !== 0 || V.legal.some(m => m.f === V.sel && m.t === sq && m.fl === 'ep') ? 'ring' : 'dot';
        if (c.mvKind !== kind) { c.mvKind = kind; boardSprite(c.ov.mv, kind); }
      }
    }
    // 축 좌표 (보드 바깥): 판을 뒤집으면 함께 뒤집힘
    for (let j = 0; j < 8; j++) {
      axisR[j].textContent = String(bottom === 1 ? 8 - j : j + 1);
      axisF[j].textContent = 'abcdefgh'[bottom === 1 ? j : 7 - j];
    }
    boardEl.classList.toggle('edit', V.edit);
    renderPanel('opp', V); renderPanel('me', V);
    renderLog();
  }

  let toastTimer = 0;
  function toast(msg, ms = 1900) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), ms);
  }

  // ---------- 레이아웃: 어떤 비율에서도 스크롤 없이 보드를 최대로 ----------
  function layout() {
    const st = $('#stage'), r = st.getBoundingClientRect();
    const W = r.width, H = r.height, pad = 8, lab = 14, PH = 112, LW = 172, k = 1 + (SP.pieces.aspect - 0.96) / 8;   // k: 기물이 보드 위로 넘어가는 높이, lab: 축 좌표 여백
    const bp = Math.min(W - 2 * (pad + lab), (H - 2 * PH - lab) / k), bl = Math.min((H - 2 * pad - lab) / k, W - 2 * LW - 2 * lab);
    const land = bl > bp;
    let bs = Math.max(land ? bl : bp, 120);
    bs = Math.max(Math.floor(bs / 8) * 8, 120);
    document.body.classList.toggle('land', land);
    document.documentElement.style.setProperty('--bs', bs + 'px');
  }

  // ---------- 모달 ----------
  const show = id => $(id).classList.add('on');
  const hide = id => $(id).classList.remove('on');
  function closeAll() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('on')); }

  // ---------- 게임 진행 ----------
  function humanTurn() { return controlled(G.s.t); }

  function onBoard(e) {
    const el = e.target.closest('.sq'); if (!el) return;
    e.preventDefault();
    if (G.replay) return;
    const i = +el.dataset.i, sq = bottomColor() === 1 ? i : 63 - i;
    if (G.edit) return editSquare(sq);
    handleSquare(sq);
  }

  function handleSquare(sq) {
    if (G.replay || G.over || G.thinking || G.hinting || !humanTurn()) return;
    const p = G.s.b[sq], mine = p !== 0 && (p > 0 ? 1 : -1) === G.s.t;
    if (G.sel >= 0) {
      const mv = G.legal.filter(m => m.f === G.sel && m.t === sq);
      if (mv.length) {
        if (mv[0].p) return choosePromotion(mv);
        return doMove(mv[0]);
      }
    }
    G.sel = mine && G.sel !== sq ? sq : -1;
    render();
  }

  function choosePromotion(mvs) {
    if (!S.opts.promoChoice) return doMove(mvs.find(m => m.p === 5));
    const box = $('#promo-list'); box.innerHTML = '';
    for (const t of [5, 4, 3, 2]) {
      const b = mk('', 'button'); pieceSprite(b, G.s.t * t);
      b.setAttribute('aria-label', NAMES[t]);
      b.onclick = () => { hide('#promo'); doMove(mvs.find(m => m.p === t)); };
      box.appendChild(b);
    }
    show('#promo');
  }

  function doMove(m) {
    G.hist.push(snap());
    G.rec.push({ k: 'm', f: m.f, to: m.t, p: m.p || 0, fl: m.fl || null, n: G.s.fm, w: G.s.t === 1,
      txt: sqName(m.f) + sqName(m.t) + (m.p ? ' pnbrq'[m.p] : '') });
    const side = G.s.t, cap = G.s.b[m.t];
    if (G.hintMove && G.hintMove.ply === G.ply && G.hintMove.f === m.f && G.hintMove.t === m.t && controlled(side)) {
      G.hints[ck(side)] = Math.max(0, G.hints[ck(side)] - 1);   // 훈수대로 두면 차감
    }
    if (cap !== 0) G.capturedBy[ck(side)].push(Math.abs(cap));
    else if (m.fl === 'ep') G.capturedBy[ck(side)].push(1);
    G.s = C.make(G.s, m);
    G.ply++;
    G.keys.push({ key: C.key(G.s), ply: G.ply });
    G.last = { f: m.f, t: m.t }; G.anim = { f: m.f, t: m.t };
    G.sel = -1; G.hintMove = null;
    afterMove();
  }

  function afterMove() {
    const r = C.gameStatus(G.s, S.opts, ctx());
    G.legal = r.moves.map(e => e.m);
    G.over = r.over;
    render();
    if (G.over) return showResult();
    if (C.inCheck(G.s)) toast('체크!', 1400);
    maybeAI();
  }

  function showResult() {
    const o = G.over;
    $('#result-title').textContent = o.r === 'd' ? '무승부' : (o.r === 'w' ? '백 승리' : '흑 승리');
    $('#result-why').textContent = o.why;
    updateResultBtns();
    show('#result');
  }

  function maybeAI() {
    if (G.replay || G.over || G.edit || S.mode === 'pvp' || G.s.t === S.human || G.thinking) return;
    G.thinking = true; render();
    const tk = ++G.token, started = Date.now();
    AI.ask(G.s, S.opts, S.mode, mv => {
      if (tk !== G.token) return;
      const wait = Math.max(0, 450 - (Date.now() - started));
      setTimeout(() => {
        if (tk !== G.token) return;
        G.thinking = false;
        if (!mv) { render(); return; }
        const m = G.legal.find(x => x.f === mv.f && x.t === mv.t && x.p === mv.p && x.fl === mv.fl) || mv;
        doMove(m);
      }, wait);
    });
  }

  // ---------- 훈수 ----------
  function hintButton(color) {
    const side = ck(color);
    if (G.ply === 0) {   // 첫 수 전: 횟수 선택 토글
      G.hints[side] = (G.hints[side] + 1) % 6;
      S.hintPref[side] = G.hints[side]; save();
      return render();
    }
    if (!canHint(color)) return;
    if (G.hintMove && G.hintMove.ply === G.ply) { G.sel = G.hintMove.f; announceHint(G.hintMove); return render(); }
    G.hinting = true; render();
    const tk = ++G.token, ply = G.ply;
    AI.ask(G.s, S.opts, 'hint', mv => {
      if (tk !== G.token || ply !== G.ply) return;
      G.hinting = false;
      if (!mv) return render();
      G.hintMove = { ply, f: mv.f, t: mv.t, p: mv.p };
      G.sel = mv.f;
      announceHint(mv); render();
    });
  }
  function announceHint(mv) {
    const t = Math.abs(G.s.b[mv.f]);
    toast(`훈수: ${NAMES[t]} ${sqName(mv.f)} → ${sqName(mv.t)}${mv.p ? ` (${NAMES[mv.p]} 승급)` : ''}`, 3200);
  }

  // ---------- 편집 모드 ----------
  let pickerSq = -1;
  function setEdit(on) {
    if (on === G.edit) return;
    if (on) {
      cancelPending();
      G.preEdit = snap();
      G.edit = true; G.sel = -1; G.hintMove = null; G.over = null; hide('#result');
      toast('편집 모드: 말을 누르면 제거, 빈 칸을 누르면 배치', 2600);
      render();
    } else {
      G.edit = false; hide('#picker');
      editChanged(true);
      if (G.preEdit && C.key(G.preEdit.s) !== C.key(G.s)) {   // 편집으로 판이 바뀌면 기보에 편집 표시를 남기고 무르기 대상으로 등록
        G.hist.push(G.preEdit);
        G.rec.push({ k: 'e', st: toStore(G.s), txt: '✎' });
      }
      G.preEdit = null;
      const r = refreshLegal();
      G.over = r.over && (r.over.why === '체크메이트' || r.over.why === '스테일메이트' || r.over.why === '킹 포획' || r.over.why === '둘 수 있는 수 없음') ? r.over : null;
      render();
      if (G.over) showResult(); else maybeAI();
    }
  }
  // 편집 후에는 반복·50수 기준을 현재 局面부터 다시 센다
  function editChanged() {
    G.keys = [{ key: C.key(G.s), ply: G.ply }];
    G.threefoldStart = G.ply; G.fiftyStart = G.ply;
    G.last = null; G.hintMove = null;
  }
  function editSquare(sq) {
    const p = G.s.b[sq];
    if (p !== 0) {
      if (Math.abs(p) === 6) return toast('왕은 제거할 수 없습니다', 1400);
      G.s = C.setSquare(G.s, sq, 0); editChanged(); return render();
    }
    pickerSq = sq;
    const box = $('#picker-list'); box.innerHTML = '';
    for (const color of [1, -1]) for (const t of [1, 2, 3, 4, 5]) {
      const b = mk('', 'button'); pieceSprite(b, color * t);
      b.setAttribute('aria-label', (color === 1 ? '백 ' : '흑 ') + NAMES[t]);
      b.onclick = () => { hide('#picker'); G.s = C.setSquare(G.s, pickerSq, color * t); editChanged(); render(); };
      box.appendChild(b);
    }
    show('#picker');
  }

  // ---------- 설정 UI ----------
  function setSeg(sel, val) { document.querySelectorAll(sel + ' button').forEach(b => b.classList.toggle('on', b.dataset.v === String(val))); }
  function buildMenu() {
    const tb = $('#themes'); tb.innerHTML = '';
    for (const th of THEMES) {
      const b = mk('thbtn' + (th.id === S.theme ? ' on' : ''), 'button'), pv = mk('thprev');
      pv.style.background = `linear-gradient(90deg, ${th.ui.pv[0]} 50%, ${th.ui.pv[1]} 50%)`;
      for (const code of [2, -5]) {
        const e = mk('thpc'); e.style.width = '34px'; e.style.height = (34 * th.pieces.aspect) + 'px'; pieceSprite(e, code, th.pieces); pv.appendChild(e);
      }
      const nm = mk('', 'span'); nm.textContent = th.name;
      b.append(pv, nm); b.onclick = () => setTheme(th.id); tb.appendChild(b);
    }
    const box = $('#opts'); box.innerHTML = '';
    for (const d of OPT_DEFS) {
      const row = mk('opt'), txt = mk(''), label = mk('sw', 'label');
      txt.innerHTML = `<b>${d.label}</b><span class="d">${d.desc}</span>`;
      label.innerHTML = '<input type="checkbox"><span class="knob"></span>';
      const inp = label.querySelector('input'); inp.checked = !!S.opts[d.k];
      inp.onchange = () => setOpt(d.k, inp.checked);
      row.append(txt, label); box.appendChild(row);
    }
    setSeg('#seg-mode', S.mode); setSeg('#seg-color', S.human);
  }
  function setOpt(k, v) {
    S.opts[k] = v; save();
    if (k === 'fifty' && v) G.fiftyStart = G.ply;
    if (k === 'threefold' && v) G.threefoldStart = G.ply;
    G.sel = -1; G.hintMove = null;
    if (!G.edit) {
      const r = refreshLegal();
      if (!G.over && r.moves.length === 0) { G.over = r.over; render(); showResult(); return; }
    }
    render();
  }
  function settingsChanged() {
    save(); cancelPending(); G.sel = -1; G.hintMove = null;
    if (!G.edit) refreshLegal();
    render(); if (!$('#menu').classList.contains('on')) maybeAI();
  }

  // ---------- 이벤트 ----------
  function bind() {
    boardEl.addEventListener('pointerdown', onBoard);
    boardEl.addEventListener('contextmenu', e => e.preventDefault());
    PN.me.hint.onclick = () => hintButton(bottomColor());
    PN.opp.hint.onclick = () => hintButton(-bottomColor());
    $('#btn-menu').onclick = () => { buildMenu(); $('#btn-replay-now').disabled = !G.over; $('#btn-save-now').disabled = !moveCount(G.rec); show('#menu'); };
    $('#btn-close-menu').onclick = () => { hide('#menu'); maybeAI(); };
    $('#btn-flip').onclick = () => { S.flip = !S.flip; render(); };
    $('#editsw').onchange = e => setEdit(e.target.checked);
    $('#btn-turn').onclick = () => { G.s = { ...G.s, t: -G.s.t, ep: -1 }; editChanged(); render(); };
    $('#btn-new').onclick = () => { newGame(); };
    $('#btn-undo').onclick = undo;
    $('#btn-open-records').onclick = openRecords;
    $('#btn-save-now').onclick = () => { hide('#menu'); saveCurrent(); };
    $('#btn-replay-now').onclick = () => { if (G.over) startReplay(G.rec, '이번 판'); };
    $('#btn-save-rec').onclick = saveCurrent;
    $('#btn-replay').onclick = () => startReplay(G.rec, '이번 판');
    $('#btn-close-records').onclick = () => hide('#records');
    $('#name-ok').onclick = nameOk;
    $('#name-cancel').onclick = () => { nameCb = null; hide('#namebox'); };
    $('#name-in').addEventListener('keydown', e => { if (e.key === 'Enter') nameOk(); });
    $('#rp-play').onclick = () => { if (!G.replay) return; G.replay.playing ? rpPause() : rpPlay(); };
    $('#rp-prev').onclick = () => rpStep(-1);
    $('#rp-next').onclick = () => rpStep(1);
    $('#rp-resume').onclick = rpResume;
    $('#rp-exit').onclick = rpExit;
    $('#log').addEventListener('click', e => {
      const t = e.target.closest ? e.target.closest('.tk') : null;
      if (!t || !G.replay || t.dataset.i === undefined) return;
      rpPause(); rpGo(+t.dataset.i + 1, false);
    });
    $('#btn-result-new').onclick = () => newGame();
    $('#btn-result-close').onclick = () => hide('#result');
    $('#btn-picker-cancel').onclick = () => hide('#picker');
    document.querySelectorAll('#seg-mode button').forEach(b => b.onclick = () => { S.mode = b.dataset.v; setSeg('#seg-mode', S.mode); settingsChanged(); });
    document.querySelectorAll('#seg-color button').forEach(b => b.onclick = () => { S.human = +b.dataset.v; setSeg('#seg-color', S.human); settingsChanged(); });
    // 확대 방지 (핀치/더블탭)
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(t => document.addEventListener(t, e => e.preventDefault()));
    document.addEventListener('dblclick', e => e.preventDefault());
    window.addEventListener('resize', layout);
    window.addEventListener('orientationchange', () => setTimeout(layout, 120));
    if (window.visualViewport) window.visualViewport.addEventListener('resize', layout);
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  applyTheme();
  buildBoard();
  bind();
  layout();
  newGame();
  window.__chess = { get G() { return G; }, S, C };
})();
