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
    AI.reset();
    G = {
      s: C.initial(), ply: 0, keys: [], fiftyStart: 0, threefoldStart: 0, last: null, over: null,
      capturedBy: { w: [], b: [] }, hints: { ...S.hintPref }, hintMove: null, sel: -1, legal: [],
      edit: false, thinking: false, hinting: false, token: (G ? G.token : 0) + 1
    };
    G.keys.push({ key: C.key(G.s), ply: 0 });
    $('#editsw').checked = false;
    refreshLegal();
    closeAll();
    render();
    maybeAI();
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
  function mk(cls, tag) { const e = document.createElement(tag || 'div'); e.className = cls; return e; }
  function applyTheme() {
    SP = THEMES.find(t => t.id === S.theme) || THEMES[0];
    const st = document.documentElement.style, u = SP.ui, p = SP.pieces;
    st.setProperty('--pc-aspect', String(p.aspect));
    st.setProperty('--pc-ratio', String(1 / p.aspect));
    st.setProperty('--pc-bottom', String(p.bottom));
    st.setProperty('--bg1', u.bg1); st.setProperty('--bg2', u.bg2);
    st.setProperty('--f1', u.f1); st.setProperty('--f2', u.f2);
    st.setProperty('--pc-filter', u.filter);
    document.documentElement.setAttribute('data-theme', SP.id);
  }
  function setTheme(id) { S.theme = id; save(); applyTheme(); buildBoard(); render(); buildMenu(); }

  function buildBoard() {
    boardEl.innerHTML = ''; cells.length = 0;
    for (let i = 0; i < 64; i++) {
      const sq = mk('sq'), bg = mk('bg'), pc = mk('pc'), lr = mk('lab r', 'span'), lf = mk('lab f', 'span');
      const ov = { last: mk('ov last'), sel: mk('ov sel'), hint: mk('ov hint'), check: mk('ov check'), mv: mk('ov mv') };
      boardSprite(ov.last, 'last'); boardSprite(ov.sel, 'select'); boardSprite(ov.hint, 'hint'); boardSprite(ov.check, 'check'); boardSprite(ov.mv, 'dot');
      sq.append(bg, ov.last, ov.sel, ov.hint, ov.check, ov.mv, pc, lr, lf);
      sq.dataset.i = i;
      boardEl.appendChild(sq);
      cells.push({ sq, bg, pc, ov, lr, lf, dark: -1, code: 99, mvKind: 'dot' });
    }
  }

  const PN = {};
  for (const k of ['opp', 'me']) {
    const el = $(k === 'me' ? '#p-me' : '#p-opp');
    PN[k] = { el, dot: el.querySelector('.dot'), nm: el.querySelector('.top .nm'), cap: el.querySelector('.cap'), hint: el.querySelector('.hintbtn'), act: el.querySelector('.act'), top: el.querySelector('.top') };
  }
  const editInfo = $('#p-opp .editinfo');

  function canHint(color) {
    return G.ply > 0 && G.hints[ck(color)] > 0 && G.s.t === color && controlled(color) &&
      !G.over && !G.edit && !G.thinking && !G.hinting;
  }

  function renderPanel(k) {
    const bottom = bottomColor(), color = k === 'me' ? bottom : -bottom, p = PN[k], side = ck(color);
    const human = controlled(color);
    p.el.classList.toggle('turn', !G.over && !G.edit && G.s.t === color);
    let name = color === 1 ? '백' : '흑';
    if (S.mode !== 'pvp') name = human ? `나 (${name})` : `컴퓨터 ${S.mode === 'easy' ? '쉬움' : '어려움'} (${name})`;
    if (!human && G.thinking && G.s.t === color) name += ' · 생각 중…';
    if (human && G.hinting && G.s.t === color) name += ' · 훈수 계산 중…';
    p.nm.textContent = name;
    p.dot.className = 'dot ' + (color === 1 ? 'w' : 'b');
    p.cap.innerHTML = '';
    for (const t of G.capturedBy[side].slice().sort((a, b) => b - a)) {
      const d = mk('cp'); pieceSprite(d, -color * t); p.cap.appendChild(d);
    }
    const hb = p.hint;
    hb.style.display = human ? '' : 'none';
    if (G.ply === 0) {
      hb.textContent = `💡 훈수 횟수 ${G.hints[side]}`; hb.disabled = false; hb.classList.add('pre');
    } else {
      hb.textContent = `💡 훈수 ${G.hints[side]}`; hb.disabled = !canHint(color); hb.classList.remove('pre');
    }
    if (k === 'opp') {
      const e = G.edit;
      p.top.hidden = e; p.act.hidden = e; editInfo.hidden = !e;
      if (e) $('#btn-turn').textContent = `차례: ${G.s.t === 1 ? '백' : '흑'} ⇄`;
    }
  }

  function render() {
    const bottom = bottomColor();
    const chk = !G.edit && C.inCheck(G.s);
    const kingSq = G.s.k[G.s.t === 1 ? 0 : 1];
    const targets = new Set();
    if (G.sel >= 0 && !G.edit) for (const m of G.legal) if (m.f === G.sel) targets.add(m.t);
    const hm = G.hintMove && G.hintMove.ply === G.ply ? G.hintMove : null;
    const an = G.anim; G.anim = null;
    for (let i = 0; i < 64; i++) {
      const sq = bottom === 1 ? i : 63 - i, c = cells[i], p = G.s.b[sq];
      const dark = ((sq >> 3) + (sq & 7)) & 1;
      if (c.dark !== dark) { c.dark = dark; boardSprite(c.bg, dark ? 'dark' : 'light'); }
      if (c.code !== p) {
        c.code = p;
        if (p) { pieceSprite(c.pc, p); c.pc.style.visibility = 'visible'; } else c.pc.style.visibility = 'hidden';
      }
      c.pc.classList.toggle('lift', G.sel === sq && !G.edit && p !== 0);
      if (an && sq === an.t && p !== 0) {   // 이동 애니메이션: 출발 칸에서 미끄러져 도착
        const fi = bottom === 1 ? an.f : 63 - an.f;
        c.pc.style.setProperty('--dx', `calc(${(fi & 7) - (i & 7)} * var(--sq))`);
        c.pc.style.setProperty('--dy', `calc(${(fi >> 3) - (i >> 3)} * var(--sq))`);
        c.pc.classList.remove('anim'); void c.pc.offsetWidth; c.pc.classList.add('anim'); c.sq.classList.add('moving');
        setTimeout(() => { c.pc.classList.remove('anim'); c.sq.classList.remove('moving'); }, 280);
      }
      c.ov.last.classList.toggle('on', !!G.last && (G.last.f === sq || G.last.t === sq));
      c.ov.sel.classList.toggle('on', G.sel === sq && !G.edit);
      c.ov.hint.classList.toggle('on', !!hm && (hm.f === sq || hm.t === sq));
      c.ov.check.classList.toggle('on', chk && sq === kingSq);
      const isT = targets.has(sq);
      c.ov.mv.classList.toggle('on', isT);
      if (isT) {
        const kind = p !== 0 || G.legal.some(m => m.f === G.sel && m.t === sq && m.fl === 'ep') ? 'ring' : 'dot';
        if (c.mvKind !== kind) { c.mvKind = kind; boardSprite(c.ov.mv, kind); }
      }
      // 좌표 표시
      const row = i >> 3, col = i & 7;
      c.lr.textContent = col === 0 ? String(8 - (sq >> 3)) : '';
      c.lf.textContent = row === 7 ? 'abcdefgh'[sq & 7] : '';
      const cl = dark ? 'l' : 'd';
      c.lr.className = 'lab r ' + cl; c.lf.className = 'lab f ' + cl;
    }
    boardEl.classList.toggle('edit', G.edit);
    renderPanel('opp'); renderPanel('me');
  }

  let toastTimer = 0;
  function toast(msg, ms = 1900) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), ms);
  }

  // ---------- 레이아웃: 어떤 비율에서도 스크롤 없이 보드를 최대로 ----------
  function layout() {
    const st = $('#stage'), r = st.getBoundingClientRect();
    const W = r.width, H = r.height, pad = 10, PH = 96, LW = 168, k = 1 + .46 / 8;   // k: 기물이 보드 위로 넘어가는 높이
    const bp = Math.min(W - 2 * pad, (H - 2 * PH) / k), bl = Math.min((H - 2 * pad) / k, W - 2 * LW);
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
    const i = +el.dataset.i, sq = bottomColor() === 1 ? i : 63 - i;
    if (G.edit) return editSquare(sq);
    handleSquare(sq);
  }

  function handleSquare(sq) {
    if (G.over || G.thinking || G.hinting || !humanTurn()) return;
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
    show('#result');
  }

  function maybeAI() {
    if (G.over || G.edit || S.mode === 'pvp' || G.s.t === S.human || G.thinking) return;
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
      G.edit = true; G.sel = -1; G.hintMove = null; G.over = null; hide('#result');
      toast('편집 모드: 말을 누르면 제거, 빈 칸을 누르면 배치', 2600);
      render();
    } else {
      G.edit = false; hide('#picker');
      editChanged(true);
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
    $('#btn-menu').onclick = () => { buildMenu(); show('#menu'); };
    $('#btn-close-menu').onclick = () => { hide('#menu'); maybeAI(); };
    $('#btn-flip').onclick = () => { S.flip = !S.flip; render(); };
    $('#editsw').onchange = e => setEdit(e.target.checked);
    $('#btn-turn').onclick = () => { G.s = { ...G.s, t: -G.s.t, ep: -1 }; editChanged(); render(); };
    $('#btn-new').onclick = () => { newGame(); };
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
