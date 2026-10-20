/* 체스 엔진: 규칙, 변형 룰, AI(쉬움/어려움/훈수) — 메인 스레드와 Web Worker 양쪽에서 사용 */
(function (g) {
  'use strict';
  const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
  const VAL = [0, 100, 320, 330, 500, 900, 20000];
  const MATE = 100000, INF = 1e9;

  // 위쪽(0행)이 8랭크, 백 기준 평가표
  const PST = [null,
    [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5,
     0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
    [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30,
     -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
    [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10,
     -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
    [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5,
     -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
    [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5,
     0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
    [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30,
     -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10,
     20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20]
  ];

  const DIRS = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
  const KN_D = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  const RAY = [], KNT = [], KGT = [];
  for (let sq = 0; sq < 64; sq++) {
    const r = sq >> 3, c = sq & 7;
    RAY[sq] = DIRS.map(([dr, dc]) => {
      const a = []; let rr = r + dr, cc = c + dc;
      while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) { a.push(rr * 8 + cc); rr += dr; cc += dc; }
      return a;
    });
    const ok = (rr, cc) => rr >= 0 && rr < 8 && cc >= 0 && cc < 8;
    KNT[sq] = KN_D.filter(([dr, dc]) => ok(r + dr, c + dc)).map(([dr, dc]) => (r + dr) * 8 + c + dc);
    KGT[sq] = DIRS.filter(([dr, dc]) => ok(r + dr, c + dc)).map(([dr, dc]) => (r + dr) * 8 + c + dc);
  }
  const CR = new Array(64).fill(0);
  CR[60] = 3; CR[4] = 12; CR[63] = 1; CR[56] = 2; CR[7] = 4; CR[0] = 8;

  function initial() {
    const b = new Int8Array(64);
    const back = [R, N, B, Q, K, B, N, R];
    for (let c = 0; c < 8; c++) { b[c] = -back[c]; b[8 + c] = -P; b[48 + c] = P; b[56 + c] = back[c]; }
    return { b, t: 1, c: 15, ep: -1, hm: 0, fm: 1, k: [60, 4] };
  }

  function attacked(b, sq, by) {
    const r = sq >> 3, c = sq & 7;
    const pr = by === 1 ? r + 1 : r - 1;
    if (pr >= 0 && pr < 8) {
      if (c > 0 && b[pr * 8 + c - 1] === by * P) return true;
      if (c < 7 && b[pr * 8 + c + 1] === by * P) return true;
    }
    const kn = KNT[sq];
    for (let i = 0; i < kn.length; i++) if (b[kn[i]] === by * N) return true;
    const kg = KGT[sq];
    for (let i = 0; i < kg.length; i++) if (b[kg[i]] === by * K) return true;
    for (let d = 0; d < 8; d++) {
      const ray = RAY[sq][d];
      for (let i = 0; i < ray.length; i++) {
        const p = b[ray[i]];
        if (p) {
          if (d < 4) { if (p === by * R || p === by * Q) return true; }
          else if (p === by * B || p === by * Q) return true;
          break;
        }
      }
    }
    return false;
  }

  function inCheck(s) {
    const ks = s.k[s.t === 1 ? 0 : 1];
    return ks >= 0 && attacked(s.b, ks, -s.t);
  }

  // 의사 합법 수 생성. caps=true면 잡기/승급만
  function gen(s, o, caps) {
    const b = s.b, t = s.t, out = [], kcap = !!o.kingCapture;
    const add = (f, to, fl, p) => out.push({ f, t: to, fl: fl || null, p: p || 0 });
    for (let f = 0; f < 64; f++) {
      const pc = b[f];
      if (pc === 0 || (pc > 0 ? 1 : -1) !== t) continue;
      const a = pc > 0 ? pc : -pc, r = f >> 3, c = f & 7;
      if (a === P) {
        const dir = t === 1 ? -1 : 1, sr = t === 1 ? 6 : 1, pr = t === 1 ? 0 : 7, nr = r + dir;
        if (nr < 0 || nr > 7) continue;
        const fwd = nr * 8 + c;
        if (b[fwd] === 0) {
          if (nr === pr) { add(f, fwd, null, Q); add(f, fwd, null, R); add(f, fwd, null, B); add(f, fwd, null, N); }
          else if (!caps) {
            add(f, fwd);
            if (o.dbl !== false && r === sr) { const f2 = (nr + dir) * 8 + c; if (b[f2] === 0) add(f, f2, 'dbl'); }
          }
        }
        for (const dc of [-1, 1]) {
          const cc = c + dc; if (cc < 0 || cc > 7) continue;
          const to = nr * 8 + cc, v = b[to];
          if (v !== 0) {
            if ((v > 0 ? 1 : -1) !== t && (kcap || (v > 0 ? v : -v) !== K)) {
              if (nr === pr) { add(f, to, null, Q); add(f, to, null, R); add(f, to, null, B); add(f, to, null, N); }
              else add(f, to);
            }
          } else if (o.ep && s.ep === to) add(f, to, 'ep');
        }
        continue;
      }
      if (a === N || a === K) {
        const arr = a === N ? KNT[f] : KGT[f];
        for (let i = 0; i < arr.length; i++) {
          const to = arr[i], v = b[to];
          if (v === 0) { if (!caps) add(f, to); }
          else if ((v > 0 ? 1 : -1) !== t && (kcap || (v > 0 ? v : -v) !== K)) add(f, to);
        }
        if (a === K && o.castling && !caps) {
          const home = t === 1 ? 60 : 4;
          if (f === home) {
            const rk = t === 1 ? R : -R, kb = t === 1 ? 1 : 4, qb = t === 1 ? 2 : 8;
            if (kcap || !attacked(b, f, -t)) {
              if ((s.c & kb) && b[home + 3] === rk && b[home + 1] === 0 && b[home + 2] === 0 &&
                  (kcap || (!attacked(b, home + 1, -t) && !attacked(b, home + 2, -t)))) add(f, home + 2, 'cK');
              if ((s.c & qb) && b[home - 4] === rk && b[home - 1] === 0 && b[home - 2] === 0 && b[home - 3] === 0 &&
                  (kcap || (!attacked(b, home - 1, -t) && !attacked(b, home - 2, -t)))) add(f, home - 2, 'cQ');
            }
          }
        }
      } else {
        const d0 = a === B ? 4 : 0, d1 = a === R ? 4 : 8;
        for (let d = d0; d < d1; d++) {
          const ray = RAY[f][d];
          for (let i = 0; i < ray.length; i++) {
            const to = ray[i], v = b[to];
            if (v === 0) { if (!caps) add(f, to); continue; }
            if ((v > 0 ? 1 : -1) !== t && (kcap || (v > 0 ? v : -v) !== K)) add(f, to);
            break;
          }
        }
      }
    }
    return out;
  }

  function make(s, m) {
    const b = s.b.slice(), t = s.t, pc = b[m.f], cap = b[m.t];
    const apc = pc > 0 ? pc : -pc;
    let ep = -1, hm = s.hm + 1;
    if (apc === P || cap !== 0) hm = 0;
    b[m.t] = pc; b[m.f] = 0;
    if (m.fl === 'ep') b[m.t + (t === 1 ? 8 : -8)] = 0;
    if (m.p) b[m.t] = t * m.p;
    if (m.fl === 'cK') { b[m.t - 1] = b[m.t + 1]; b[m.t + 1] = 0; }
    else if (m.fl === 'cQ') { b[m.t + 1] = b[m.t - 2]; b[m.t - 2] = 0; }
    else if (m.fl === 'dbl') ep = (m.f + m.t) >> 1;
    const k = s.k.slice();
    if (apc === K) k[t === 1 ? 0 : 1] = m.t;
    if (cap !== 0 && (cap > 0 ? cap : -cap) === K) k[cap > 0 ? 0 : 1] = -1;
    return { b, t: -t, c: s.c & ~(CR[m.f] | CR[m.t]), ep, hm, fm: s.fm + (t === -1 ? 1 : 0), k };
  }

  function expand(s, o, caps) {
    const list = gen(s, o, caps), res = [], ki = s.t === 1 ? 0 : 1;
    for (let i = 0; i < list.length; i++) {
      const m = list[i], n = make(s, m);
      if (!o.kingCapture) {
        const ks = n.k[ki];
        if (ks >= 0 && attacked(n.b, ks, -s.t)) continue;
      }
      let ord = 0;
      const v = s.b[m.t];
      if (v !== 0) ord = 10000 + 10 * VAL[v > 0 ? v : -v] - VAL[Math.abs(s.b[m.f])] / 10;
      else if (m.fl === 'ep') ord = 10500;
      if (m.p) ord += VAL[m.p]; else if (m.fl === 'cK' || m.fl === 'cQ') ord += 5;
      res.push({ m, n, o: ord });
    }
    res.sort((x, y) => y.o - x.o);
    return res;
  }

  function key(s) {
    let k = '';
    for (let i = 0; i < 64; i++) k += String.fromCharCode(s.b[i] + 10);
    return k + s.t + ',' + s.c + ',' + s.ep;
  }

  function insufficient(s) {
    const minors = [];
    for (let i = 0; i < 64; i++) {
      const p = s.b[i], a = p > 0 ? p : -p;
      if (a === P || a === R || a === Q) return false;
      if (a === N || a === B) minors.push({ a, sc: ((i >> 3) + (i & 7)) & 1 });
    }
    if (minors.length <= 1) return true;
    if (minors.every(x => x.a === B && x.sc === minors[0].sc)) return true;
    return false;
  }

  // ctx: { ply, fiftyStart, threefoldStart, keys:[{key,ply}] } — 룰은 켠 시점 이후의 수에만 적용된다
  function gameStatus(s, o, ctx) {
    const moves = expand(s, o);
    let over = null;
    if (s.k[0] < 0) over = { r: 'b', why: '킹 포획' };
    else if (s.k[1] < 0) over = { r: 'w', why: '킹 포획' };
    else if (moves.length === 0) {
      if (o.kingCapture) over = { r: 'd', why: '둘 수 있는 수 없음' };
      else if (inCheck(s)) over = { r: s.t === 1 ? 'b' : 'w', why: '체크메이트' };
      else over = { r: 'd', why: '스테일메이트' };
    } else if (o.insufficient && insufficient(s)) over = { r: 'd', why: '기물 부족' };
    else if (o.fifty && Math.min(s.hm, ctx.ply - ctx.fiftyStart) >= 100) over = { r: 'd', why: '50수 규칙' };
    else if (o.threefold) {
      const k = key(s); let n = 0;
      for (const h of ctx.keys) if (h.ply >= ctx.threefoldStart && h.key === k) n++;
      if (n >= 3) over = { r: 'd', why: '3회 동형 반복' };
    }
    return { over, moves };
  }

  function setSquare(s, sq, code) {
    const b = s.b.slice(); b[sq] = code;
    return { b, t: s.t, c: s.c & ~CR[sq], ep: -1, hm: 0, fm: s.fm, k: s.k.slice() };
  }

  // ---------- AI ----------
  let nodes = 0, stopFlag = false, deadline = 0;

  function evaluate(s) {
    let sc = 0; const b = s.b;
    for (let i = 0; i < 64; i++) {
      const p = b[i]; if (!p) continue;
      if (p > 0) sc += VAL[p] + PST[p][i];
      else sc -= VAL[-p] + PST[-p][((7 - (i >> 3)) << 3) + (i & 7)];
    }
    return s.t === 1 ? sc : -sc;
  }

  function quiesce(s, o, alpha, beta, qd) {
    if ((++nodes & 2047) === 0 && Date.now() > deadline) stopFlag = true;
    if (stopFlag) return 0;
    const stand = evaluate(s);
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    if (qd >= 6) return alpha;
    const list = expand(s, o, true);
    for (let i = 0; i < list.length; i++) {
      const v = -quiesce(list[i].n, o, -beta, -alpha, qd + 1);
      if (stopFlag) return 0;
      if (v >= beta) return v;
      if (v > alpha) alpha = v;
    }
    return alpha;
  }

  function nega(s, o, depth, alpha, beta, ply) {
    if ((++nodes & 2047) === 0 && Date.now() > deadline) stopFlag = true;
    if (stopFlag) return 0;
    if (depth <= 0) return quiesce(s, o, alpha, beta, 0);
    const list = expand(s, o);
    if (o.kingCapture) {
      for (let i = 0; i < list.length; i++) if (Math.abs(s.b[list[i].m.t]) === K) return MATE - ply;
    }
    if (!list.length) {
      if (o.kingCapture) return 0;
      return inCheck(s) ? -MATE + ply : 0;
    }
    let best = -INF;
    for (let i = 0; i < list.length; i++) {
      const v = -nega(list[i].n, o, depth - 1, -beta, -alpha, ply + 1);
      if (stopFlag) return 0;
      if (v > best) { best = v; if (v > alpha) { alpha = v; if (alpha >= beta) break; } }
    }
    return best;
  }

  // level: 'easy' | 'hard' | 'hint'  → 이동 {f,t,fl,p} 또는 null
  function think(s, o, level) {
    o = o || {};
    const list = expand(s, o);
    if (!list.length) return null;
    if (o.kingCapture) for (const e of list) if (Math.abs(s.b[e.m.t]) === K) return e.m;
    if (level === 'easy') {
      let best = null, bs = -INF;
      for (const e of list) {
        const v = -evaluate(e.n) + Math.random() * 220;
        if (v > bs) { bs = v; best = e; }
      }
      return best.m;
    }
    const ms = level === 'hint' ? 1800 : 2000;
    for (const e of list) e.o += Math.random() * 3;
    list.sort((x, y) => y.o - x.o);
    nodes = 0; stopFlag = false; deadline = Date.now() + ms;
    let best = list[0];
    for (let d = 1; d <= 8; d++) {
      let alpha = -INF, cur = null, cs = -INF;
      for (const e of list) {
        const v = -nega(e.n, o, d - 1, -INF, -alpha, 1);
        if (stopFlag) break;
        if (v > cs) { cs = v; cur = e; }
        if (v > alpha) alpha = v;
      }
      if (stopFlag || !cur) break;
      best = cur;
      list.splice(list.indexOf(cur), 1); list.unshift(cur);
      if (cs > MATE - 200 || cs < -MATE + 200) break;
    }
    return best.m;
  }

  g.Chess = { initial, make, expand, inCheck, gameStatus, key, setSquare, think, insufficient, attacked };
})(typeof self !== 'undefined' ? self : this);
