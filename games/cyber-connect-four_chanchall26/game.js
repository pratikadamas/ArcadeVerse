/**
 * Cyber Connect Four - Minimax Core
 * ArcadeVerse community game (NSoC 2026, issue #376)
 * Pure vanilla HTML5 Canvas + Web Audio. No libraries.
 *
 * Layout of this file:
 *   1. Engine   - board rules, heuristic evaluation, minimax with alpha-beta (no DOM)
 *   2. Audio    - procedural Web Audio effects
 *   3. Game     - state machine, input, rendering, dialogs
 */
(function () {
  'use strict';

  /* ======================================================================
     1. ENGINE
     Board: Int8Array(42), index = row * 7 + col, row 0 is the bottom row.
     Players: 1 and 2, 0 is empty.
     ====================================================================== */
  const COLS = 7;
  const ROWS = 6;
  const SIZE = COLS * ROWS;
  const ORDER = [3, 2, 4, 1, 5, 0, 6];          // centre-outward move ordering
  const WIN = 100000;                            // score of a win, minus the ply it happens on
  const INF = 1000000000;
  const DIRS = [[0, 1], [1, 0], [1, 1], [-1, 1]]; // [dRow, dCol]: horizontal, vertical, two diagonals

  const COL_OF = new Int8Array(SIZE);
  const ROW_OF = new Int8Array(SIZE);
  for (let i = 0; i < SIZE; i++) { COL_OF[i] = i % COLS; ROW_OF[i] = (i / COLS) | 0; }

  // All 69 windows of four cells, stored flat (4 indices per window).
  const WINDOWS = (function () {
    const list = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        for (let d = 0; d < DIRS.length; d++) {
          const dr = DIRS[d][0], dc = DIRS[d][1];
          const er = r + dr * 3, ec = c + dc * 3;
          if (er < 0 || er >= ROWS || ec < 0 || ec >= COLS) continue;
          for (let k = 0; k < 4; k++) list.push((r + dr * k) * COLS + (c + dc * k));
        }
      }
    }
    return Int8Array.from(list);
  })();
  const WINDOW_COUNT = WINDOWS.length / 4;

  // For every cell, the windows it belongs to (used to keep per-window disc counts up to date).
  const CELL_WINDOWS = (function () {
    const lists = [];
    for (let i = 0; i < SIZE; i++) lists.push([]);
    for (let w = 0; w < WINDOW_COUNT; w++) for (let k = 0; k < 4; k++) lists[WINDOWS[w * 4 + k]].push(w);
    return lists.map(function (l) { return Int8Array.from(l); });
  })();

  // Heuristic weights (scores are always from the point of view of the side to move).
  // Weights were tuned by paired self-play between search depths (see the PR notes).
  const W_CENTRE = [0, 1, 1, 2, 1, 1, 0];   // per disc, by column: centre control
  const W_PAIR = 6;                         // two own discs + two empty in a window
  const W_THREE = 40;                       // three own discs + one empty in a window (a threat)
  const W_THREE_PLAYABLE_MOVER = 600;       // that empty cell can be filled right now and it is our move
  const W_THREE_PLAYABLE_WAITING = 40;      // the same, but for the side that does not have the move
  const W_OPP_THREE = 45;                   // opponent three + one empty (slightly above own, to favour defence)

  // A position keeps, besides the cells, how many discs each player has in each window of four
  // (w1, w2) and each player's centre score (cen), updated incrementally by play() and undo().
  // That makes evaluate() a single pass over 69 small counters. Always change a position through
  // play() and undo(), never by writing cells directly.
  function createPosition() {
    return {
      cells: new Int8Array(SIZE), heights: new Int8Array(COLS), count: 0,
      w1: new Int8Array(WINDOW_COUNT), w2: new Int8Array(WINDOW_COUNT), cen: new Int32Array(3)
    };
  }

  function clonePosition(p) {
    return {
      cells: Int8Array.from(p.cells), heights: Int8Array.from(p.heights), count: p.count,
      w1: Int8Array.from(p.w1), w2: Int8Array.from(p.w2), cen: Int32Array.from(p.cen)
    };
  }

  function canPlay(p, c) {
    return c >= 0 && c < COLS && p.heights[c] < ROWS;
  }

  // Drops a disc and returns the row it lands on.
  function play(p, c, who) {
    const r = p.heights[c];
    const i = r * COLS + c;
    p.cells[i] = who;
    p.heights[c] = r + 1;
    p.count++;
    const counts = who === 1 ? p.w1 : p.w2, list = CELL_WINDOWS[i];
    for (let k = 0; k < list.length; k++) counts[list[k]]++;
    p.cen[who] += W_CENTRE[c];
    return r;
  }

  function undo(p, c) {
    const r = --p.heights[c];
    const i = r * COLS + c;
    const who = p.cells[i];
    p.cells[i] = 0;
    p.count--;
    const counts = who === 1 ? p.w1 : p.w2, list = CELL_WINDOWS[i];
    for (let k = 0; k < list.length; k++) counts[list[k]]--;
    p.cen[who] -= W_CENTRE[c];
  }

  // Length of the same-colour line through (r, c) along one direction. The cell
  // itself is not read, so this works for a cell that is still empty ("would it win?").
  function lineLength(cells, r, c, who, dr, dc) {
    let n = 1;
    let rr = r + dr, cc = c + dc;
    while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && cells[rr * COLS + cc] === who) { n++; rr += dr; cc += dc; }
    rr = r - dr; cc = c - dc;
    while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && cells[rr * COLS + cc] === who) { n++; rr -= dr; cc -= dc; }
    return n;
  }

  function winsAt(cells, r, c, who) {
    for (let d = 0; d < 4; d++) {
      if (lineLength(cells, r, c, who, DIRS[d][0], DIRS[d][1]) >= 4) return true;
    }
    return false;
  }

  // The four cells (per winning line) that make the win through (r, c); used for the highlight.
  function winCells(cells, r, c, who) {
    const out = [];
    for (let d = 0; d < 4; d++) {
      const dr = DIRS[d][0], dc = DIRS[d][1];
      let back = 0, fwd = 0;
      while (true) {
        const rr = r - dr * (back + 1), cc = c - dc * (back + 1);
        if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS || cells[rr * COLS + cc] !== who) break;
        back++;
      }
      while (true) {
        const rr = r + dr * (fwd + 1), cc = c + dc * (fwd + 1);
        if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS || cells[rr * COLS + cc] !== who) break;
        fwd++;
      }
      if (back + fwd + 1 < 4) continue;
      const start = Math.min(0, fwd - 3);   // first offset of a four that contains (r, c)
      for (let k = start; k < start + 4; k++) {
        const idx = (r + dr * k) * COLS + (c + dc * k);
        if (out.indexOf(idx) < 0) out.push(idx);
      }
    }
    return out;
  }

  // Static evaluation from the point of view of `side`, the player to move.
  function evaluate(p, side) {
    const cells = p.cells, h = p.heights;
    const mineW = side === 1 ? p.w1 : p.w2;
    const theirW = side === 1 ? p.w2 : p.w1;
    let score = p.cen[side] - p.cen[3 - side];
    for (let w = 0; w < WINDOW_COUNT; w++) {
      const mine = mineW[w], theirs = theirW[w];
      if (mine > 0) {
        if (theirs > 0) continue;                       // a mixed window can never become a four
        if (mine === 2) score += W_PAIR;
        else if (mine === 3) {
          score += W_THREE;
          const gap = emptyCell(cells, w);
          if (h[COL_OF[gap]] === ROW_OF[gap]) score += W_THREE_PLAYABLE_MOVER;
        }
      } else if (theirs === 2) {
        score -= W_PAIR;
      } else if (theirs === 3) {
        score -= W_OPP_THREE;
        const gap = emptyCell(cells, w);
        if (h[COL_OF[gap]] === ROW_OF[gap]) score -= W_THREE_PLAYABLE_WAITING;
      }
    }
    return score;
  }

  // The one empty cell of a window that holds three discs of one player.
  function emptyCell(cells, w) {
    for (let k = 0; k < 4; k++) {
      const i = WINDOWS[w * 4 + k];
      if (cells[i] === 0) return i;
    }
    return -1;
  }

  const ABORT = { aborted: true };
  let nodeCount = 0;
  let deadline = Infinity;

  function clock() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }

  // Negamax with alpha-beta pruning (fail-soft). `depth` is the number of plies left.
  // Returns the value for `side`, who is to move. Wins score WIN - ply so faster wins
  // (and slower losses) are preferred.
  function negamax(p, side, depth, alpha, beta, ply) {
    if ((++nodeCount & 2047) === 0 && clock() > deadline) throw ABORT;
    if (p.count === SIZE) return 0;
    if (depth === 0) return evaluate(p, side);

    const h = p.heights, cells = p.cells, opp = 3 - side;
    let i, c;

    // 1. An immediate win ends the search of this node.
    for (i = 0; i < COLS; i++) {
      c = ORDER[i];
      if (h[c] < ROWS && winsAt(cells, h[c], c, side)) return WIN - (ply + 1);
    }

    // 2. With two or more opponent threats we are lost; with exactly one we must block it.
    //    Needs depth >= 2 so that the search could have seen the loss on its own.
    let forced = -1;
    if (depth >= 2) {
      let threats = 0;
      for (i = 0; i < COLS; i++) {
        c = ORDER[i];
        if (h[c] < ROWS && winsAt(cells, h[c], c, opp)) { threats++; forced = c; }
      }
      if (threats >= 2) return -(WIN - (ply + 2));
    }

    let best = -INF;
    const n = forced >= 0 ? 1 : COLS;
    for (i = 0; i < n; i++) {
      c = forced >= 0 ? forced : ORDER[i];
      if (h[c] >= ROWS) continue;
      play(p, c, side);
      const v = -negamax(p, opp, depth - 1, -beta, -alpha, ply + 1);
      undo(p, c);
      if (v > best) {
        best = v;
        if (v > alpha) {
          alpha = v;
          if (alpha >= beta) break;
        }
      }
    }
    return best;
  }

  // Chooses a move for `side` with iterative deepening up to `maxDepth` plies.
  // opts.timeMs: soft time budget; when it runs out the last fully searched depth is used.
  // opts.rand:   random source for choosing between equally good moves.
  // The input position is never modified.
  function search(pos, side, maxDepth, opts) {
    opts = opts || {};
    const rand = opts.rand || Math.random;
    const t0 = clock();
    deadline = opts.timeMs > 0 ? t0 + opts.timeMs : Infinity;
    nodeCount = 0;
    const p = clonePosition(pos);
    const opp = 3 - side;

    let cand = ORDER.filter(function (c) { return p.heights[c] < ROWS; });
    if (cand.length === 0) return { move: -1, score: 0, depth: 0, nodes: 0, ms: 0 };

    // A winning drop is always taken.
    for (let i = 0; i < cand.length; i++) {
      const c = cand[i];
      if (winsAt(p.cells, p.heights[c], c, side)) {
        return { move: c, score: WIN - 1, depth: 1, nodes: 0, ms: clock() - t0 };
      }
    }
    // A single opposing threat must be blocked (only meaningful when we look two plies ahead).
    if (maxDepth >= 2) {
      const blocks = cand.filter(function (c) { return winsAt(p.cells, p.heights[c], c, opp); });
      if (blocks.length === 1) cand = blocks;
    }

    let order = cand.slice();
    let bestMove = order[0], bestScore = 0, doneDepth = 0;
    try {
      for (let d = 1; d <= maxDepth; d++) {
        let alpha = -INF, best = -INF;
        let ties = [];
        const vals = {};
        for (let i = 0; i < order.length; i++) {
          const c = order[i];
          play(p, c, side);
          // Window (alpha, +INF) with alpha = best - 1 gives exact values for every move that
          // scores at least `best`, so equal-best moves can be told apart and chosen between.
          const v = -negamax(p, opp, d - 1, -INF, -alpha, 1);
          undo(p, c);
          vals[c] = v;
          if (v > best) { best = v; ties = [c]; alpha = best - 1; }
          else if (v === best) { ties.push(c); }
        }
        bestMove = ties[Math.min(ties.length - 1, Math.floor(rand() * ties.length))];
        bestScore = best;
        doneDepth = d;
        // Next iteration: best moves first (stable for equal values, so centre order is kept).
        order = order.map(function (c, idx) { return { c: c, v: vals[c], idx: idx }; })
          .sort(function (a, b) { return (b.v - a.v) || (a.idx - b.idx); })
          .map(function (o) { return o.c; });
        if (best >= WIN - 64) break;   // forced win found; a deeper search cannot find a faster one
      }
    } catch (e) {
      if (e !== ABORT) throw e;
    }
    return { move: bestMove, score: bestScore, depth: doneDepth, nodes: nodeCount, ms: clock() - t0 };
  }

  /* ======================================================================
     2. AUDIO (procedural Web Audio, no files)
     ====================================================================== */
  const MUTE_KEY = 'cyberConnectFour.muted.v1';
  const Sfx = (function () {
    let ctx = null, master = null;
    let userMuted = false;
    let hubMuted = false;
    try { userMuted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { /* storage unavailable */ }

    function ensure() {
      if (ctx) return ctx;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.5;
        const comp = ctx.createDynamicsCompressor();
        master.connect(comp);
        comp.connect(ctx.destination);
      } catch (e) { ctx = null; }
      return ctx;
    }

    function resume() {
      if (userMuted || hubMuted) return;
      const c = ensure();
      if (c && c.state === 'suspended') c.resume().catch(function () {});
    }

    function tone(freq, dur, type, vol, when, slideTo) {
      const t = ctx.currentTime + (when || 0);
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(master);
      o.start(t);
      o.stop(t + dur + 0.03);
    }

    function click(dur, vol, when, hpFreq) {
      const t = ctx.currentTime + (when || 0);
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = hpFreq || 1500;
      const g = ctx.createGain();
      g.gain.value = vol;
      src.connect(hp);
      hp.connect(g);
      g.connect(master);
      src.start(t);
    }

    const sounds = {
      land: function () { tone(220, 0.13, 'sine', 0.4, 0, 70); click(0.04, 0.18, 0, 1800); },
      bounce: function () { tone(150, 0.07, 'sine', 0.14, 0, 90); },
      cursor: function () { tone(520, 0.04, 'triangle', 0.06, 0); },
      start: function () { tone(330, 0.1, 'triangle', 0.16, 0); tone(495, 0.14, 'triangle', 0.16, 0.08); },
      invalid: function () { tone(130, 0.2, 'sawtooth', 0.12, 0, 80); },
      win: function () {
        [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tone(f, i === 3 ? 0.5 : 0.16, 'triangle', 0.2, i * 0.11); });
      },
      lose: function () {
        [392, 329.63, 261.63, 196].forEach(function (f, i) { tone(f, i === 3 ? 0.5 : 0.18, 'sawtooth', 0.1, i * 0.14); });
      },
      draw: function () { tone(440, 0.18, 'square', 0.08, 0); tone(349.23, 0.3, 'square', 0.08, 0.16); }
    };

    return {
      resume: resume,
      play: function (name) {
        if (userMuted || hubMuted) return;
        const c = ensure();
        if (!c || !sounds[name]) return;
        if (c.state === 'suspended') c.resume().catch(function () {});
        try { sounds[name](); } catch (e) { /* never let audio break the game */ }
      },
      isMuted: function () { return userMuted || hubMuted; },
      isUserMuted: function () { return userMuted; },
      setUserMuted: function (m) {
        userMuted = !!m;
        try { localStorage.setItem(MUTE_KEY, userMuted ? '1' : '0'); } catch (e) { /* ignore */ }
      },
      setHubMuted: function (m) { hubMuted = !!m; },
      suspend: function () { if (ctx && ctx.state === 'running') ctx.suspend().catch(function () {}); },
      close: function () {
        if (ctx) { try { ctx.close(); } catch (e) { /* ignore */ } ctx = null; master = null; }
      }
    };
  })();

  /* ======================================================================
     3. GAME
     ====================================================================== */

  // Canvas geometry in logical units (the canvas is scaled to its CSS size and DPR).
  const CELL = 76;
  const PAD = 14;
  const DROP_H = 84;
  const W = COLS * CELL + PAD * 2;                  // 560
  const PLATE_Y = DROP_H;
  const PLATE_H = ROWS * CELL + PAD * 2;            // 484
  const H = PLATE_Y + PLATE_H + 6;                  // 574
  const DROP_CY = DROP_H / 2 + 2;
  const DISC_R = 30;
  const HOLE_R = 32;

  const GRAVITY = 4800;          // px/s^2
  const REST = 0.22;             // bounce restitution
  const BOUNCE_MIN_V = 140;      // below this impact speed the disc just settles
  const AI_DELAY_MS = 320;       // short pause so the AI turn is readable
  const AI_TIME_BUDGET_MS = 800; // safety net for slow devices (falls back to last completed depth)
  const TALLY_KEY = 'cyberConnectFour.session.v1';

  const LEVELS = {
    easy: { depth: 2, label: 'Easy' },
    medium: { depth: 4, label: 'Medium' },
    hard: { depth: 6, label: 'Hard' }
  };
  const COLOR_NAME = { 1: 'pink', 2: 'cyan' };
  const PALETTE = {
    1: { light: '#ffb3d6', base: '#ff3d9a', dark: '#a3125d', glow: 'rgba(255, 61, 154, 0.85)', rgb: '255, 61, 154' },
    2: { light: '#b8f6ff', base: '#27e0ff', dark: '#0a7a94', glow: 'rgba(39, 224, 255, 0.85)', rgb: '39, 224, 255' }
  };
  const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

  const $ = function (id) { return document.getElementById(id); };
  const canvas = $('board');
  const ctx = canvas.getContext('2d');
  const els = {
    status: $('status'),
    boardText: $('board-text'),
    modeChip: $('mode-chip'),
    sc1: $('sc-1'), sc2: $('sc-2'),
    name1: $('sc-name-1'), name2: $('sc-name-2'),
    val1: $('sc-val-1'), val2: $('sc-val-2'), valD: $('sc-val-d'),
    actions: $('result-actions'),
    soundBtn: $('sound-btn'), soundOn: $('sound-icon-on'), soundOff: $('sound-icon-off'),
    menu: $('menu-dialog'), help: $('help-dialog'), pause: $('pause-dialog'),
    resumeBtn: $('resume-btn'), levelField: $('level-field')
  };

  const reducedQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  let reduced = !!(reducedQuery && reducedQuery.matches);
  if (reducedQuery) {
    const onReduced = function (e) { reduced = e.matches; dirty = true; };
    if (reducedQuery.addEventListener) reducedQuery.addEventListener('change', onReduced);
    else if (reducedQuery.addListener) reducedQuery.addListener(onReduced);
  }

  /* ---------- Session tally ---------- */
  function cleanCount(v) { return (typeof v === 'number' && isFinite(v) && v >= 0) ? Math.floor(v) : 0; }
  function blankTally() { return { ai: { p1: 0, p2: 0, d: 0 }, pvp: { p1: 0, p2: 0, d: 0 } }; }
  function loadTally() {
    const t = blankTally();
    try {
      const raw = sessionStorage.getItem(TALLY_KEY);
      if (raw) {
        const o = JSON.parse(raw);
        ['ai', 'pvp'].forEach(function (m) {
          if (o && o[m]) { t[m].p1 = cleanCount(o[m].p1); t[m].p2 = cleanCount(o[m].p2); t[m].d = cleanCount(o[m].d); }
        });
      }
    } catch (e) { /* ignore */ }
    return t;
  }
  function saveTally() { try { sessionStorage.setItem(TALLY_KEY, JSON.stringify(tally)); } catch (e) { /* ignore */ } }
  const tally = loadTally();

  /* ---------- State ---------- */
  const S = {
    phase: 'menu',          // 'menu' (nothing started yet) | 'playing' | 'over'
    mode: 'ai',             // 'ai' | 'pvp'
    level: 'medium',
    pos: createPosition(),
    turn: 1,
    starter: 1,
    nextStarter: 1,
    result: 0,              // 0 running, 1 or 2 winner, 3 draw
    winCells: [],
    lastIdx: -1,
    lastText: '',
    anim: null,             // falling disc {col,row,who,y,vy,target,bounced}
    aiPending: false,
    aiTimer: 0,
    holds: {},              // named pause holds: user, menu, help, hub
    hoverCol: -1,           // pointer column, -1 when none
    kbCol: 3,
    lastInput: 'key',       // 'key' | 'mouse' | 'touch' | 'pen'
    pressed: false,
    overAt: 0,
    thinkMs: 0,
    maxThinkMs: 0,
    thinkDepth: 0
  };

  let dirty = true;
  let rafId = 0;
  let lastTs = 0;
  let torn = false;
  let view = { scale: 1 };
  let plate = null;
  const sprites = {};

  function isPaused() {
    for (const k in S.holds) if (S.holds[k]) return true;
    return false;
  }
  function setHold(name, on) {
    const was = isPaused();
    S.holds[name] = !!on;
    const now = isPaused();
    if (was === now) return;
    if (now) {
      clearTimeout(S.aiTimer);
      S.aiTimer = 0;
      Sfx.suspend();
    } else {
      Sfx.resume();
      if (S.aiPending && !S.aiTimer && S.phase === 'playing') S.aiTimer = setTimeout(runAI, AI_DELAY_MS);
    }
    dirty = true;
  }

  function names() {
    return S.mode === 'ai' ? { 1: 'You', 2: 'AI' } : { 1: 'Player 1', 2: 'Player 2' };
  }

  function humanTurn() {
    return S.mode === 'pvp' || S.turn === 1;
  }

  function acceptingInput() {
    return S.phase === 'playing' && !isPaused() && !S.anim && !S.aiPending && humanTurn();
  }

  /* ---------- Status line and HUD ---------- */
  function turnText() {
    if (S.mode === 'ai') {
      return S.turn === 1 ? 'Your turn (pink). Pick a column.' : 'AI is thinking...';
    }
    return 'Player ' + S.turn + ' (' + COLOR_NAME[S.turn] + ') to move.';
  }

  function resultText() {
    if (S.result === 3) return 'Draw. The board is full.';
    if (S.mode === 'ai') return S.result === 1 ? 'You win! Four in a row.' : 'AI wins. Four in a row. Try again.';
    return 'Player ' + S.result + ' (' + COLOR_NAME[S.result] + ') wins with four in a row!';
  }

  function setStatus(text, win) {
    if (els.status.textContent !== text) els.status.textContent = text;
    els.status.classList.toggle('is-win', !!win);
  }

  function refreshStatus() {
    if (S.phase === 'menu') { setStatus('Choose a mode to begin.'); return; }
    if (S.phase === 'over') { setStatus(resultText(), S.result !== 3 && !(S.mode === 'ai' && S.result === 2)); return; }
    setStatus((S.lastText ? S.lastText + ' ' : '') + turnText());
  }

  function refreshHud() {
    const n = names();
    const t = S.mode === 'ai' ? tally.ai : tally.pvp;
    els.name1.textContent = n[1];
    els.name2.textContent = n[2];
    els.val1.textContent = String(t.p1);
    els.val2.textContent = String(t.p2);
    els.valD.textContent = String(t.d);
    const live = S.phase === 'playing';
    els.sc1.classList.toggle('is-turn', live && S.turn === 1);
    els.sc2.classList.toggle('is-turn', live && S.turn === 2);
    if (live) {
      els.sc1.setAttribute('aria-current', S.turn === 1 ? 'true' : 'false');
      els.sc2.setAttribute('aria-current', S.turn === 2 ? 'true' : 'false');
    } else {
      els.sc1.removeAttribute('aria-current');
      els.sc2.removeAttribute('aria-current');
    }
    els.modeChip.textContent = S.mode === 'ai'
      ? 'Player vs AI - ' + LEVELS[S.level].label + ' (depth ' + LEVELS[S.level].depth + ')'
      : 'Two players - one screen';
    els.actions.hidden = S.phase !== 'over';
  }

  function refreshBoardText() {
    const parts = [];
    for (let c = 0; c < COLS; c++) {
      const col = [];
      for (let r = 0; r < S.pos.heights[c]; r++) col.push(COLOR_NAME[S.pos.cells[r * COLS + c]]);
      parts.push('Column ' + (c + 1) + ': ' + (col.length ? col.join(', ') + ' from the bottom' : 'empty') + '.');
    }
    els.boardText.textContent = 'Board contents. ' + parts.join(' ');
  }

  function refreshAll() {
    refreshHud();
    refreshStatus();
    dirty = true;
  }

  /* ---------- Game flow ---------- */
  function resetBoard() {
    clearTimeout(S.aiTimer);
    S.aiTimer = 0;
    S.pos = createPosition();
    S.turn = S.starter;
    S.result = 0;
    S.winCells = [];
    S.lastIdx = -1;
    S.lastText = '';
    S.anim = null;
    S.aiPending = false;
    S.pressed = false;
    S.phase = 'playing';
    refreshBoardText();
    refreshAll();
    maybeStartAI();
  }

  function startGame() {
    const form = els.menu.querySelector('form');
    S.mode = form.elements.mode.value === 'pvp' ? 'pvp' : 'ai';
    S.level = LEVELS[form.elements.level.value] ? form.elements.level.value : 'medium';
    S.starter = 1;
    S.nextStarter = 1;
    resetBoard();
    Sfx.play('start');
    canvas.focus({ preventScroll: true });
  }

  function restart() {
    if (S.phase === 'menu') return;
    if (S.phase === 'over') S.starter = S.nextStarter;
    resetBoard();
    canvas.focus({ preventScroll: true });
  }

  function tryDrop(col) {
    if (!acceptingInput()) return false;
    if (!canPlay(S.pos, col)) {
      setStatus('Column ' + (col + 1) + ' is full. Pick another column.');
      Sfx.play('invalid');
      nudge = 1;
      dirty = true;
      return false;
    }
    startDrop(col, S.turn);
    return true;
  }

  function startDrop(col, who) {
    const row = play(S.pos, col, who);
    S.lastIdx = row * COLS + col;
    S.lastText = names()[who] + ' played column ' + (col + 1) + '.';
    S.hoverCol = -1;
    if (reduced) {
      Sfx.play('land');
      onLanded(col, row, who);
      return;
    }
    S.anim = { col: col, row: row, who: who, y: DROP_CY, vy: 0, target: cellY(row), bounced: false };
    dirty = true;
  }

  function onLanded(col, row, who) {
    S.anim = null;
    refreshBoardText();
    if (winsAt(S.pos.cells, row, col, who)) {
      endGame(who, winCells(S.pos.cells, row, col, who));
    } else if (S.pos.count === SIZE) {
      endGame(3, []);
    } else {
      S.turn = 3 - who;
      refreshAll();
      maybeStartAI();
    }
  }

  function endGame(result, cells) {
    S.phase = 'over';
    S.result = result;
    S.winCells = cells;
    S.overAt = performance.now();
    S.nextStarter = 3 - S.starter;
    const t = S.mode === 'ai' ? tally.ai : tally.pvp;
    if (result === 1) t.p1++; else if (result === 2) t.p2++; else t.d++;
    saveTally();
    refreshAll();
    refreshBoardText();
    if (result === 3) Sfx.play('draw');
    else if (S.mode === 'ai' && result === 2) Sfx.play('lose');
    else Sfx.play('win');
  }

  function maybeStartAI() {
    if (S.mode !== 'ai' || S.turn !== 2 || S.phase !== 'playing') return;
    S.aiPending = true;
    refreshStatus();
    if (!isPaused()) S.aiTimer = setTimeout(runAI, AI_DELAY_MS);
  }

  function runAI() {
    S.aiTimer = 0;
    if (torn || !S.aiPending || S.phase !== 'playing' || isPaused()) return;
    const res = search(S.pos, 2, LEVELS[S.level].depth, { timeMs: AI_TIME_BUDGET_MS });
    S.thinkMs = res.ms;
    S.thinkDepth = res.depth;
    if (res.ms > S.maxThinkMs) S.maxThinkMs = res.ms;
    let col = res.move;
    if (!canPlay(S.pos, col)) {
      col = ORDER.filter(function (c) { return canPlay(S.pos, c); })[0];
    }
    S.aiPending = false;
    startDrop(col, 2);
  }

  /* ---------- Geometry helpers ---------- */
  function cellX(c) { return PAD + CELL * (c + 0.5); }
  function cellY(r) { return PLATE_Y + PAD + CELL * (ROWS - r - 0.5); }

  function colFromClient(clientX) {
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * (W / rect.width);
    return Math.max(0, Math.min(COLS - 1, Math.floor((x - PAD) / CELL)));
  }

  /* ---------- Animation ---------- */
  function stepAnim(dt) {
    const a = S.anim;
    if (!a) return;
    let t = Math.min(dt, 0.05);
    while (t > 0 && S.anim) {
      const h = Math.min(t, 1 / 240);
      t -= h;
      a.vy += GRAVITY * h;
      a.y += a.vy * h;
      if (a.y >= a.target) {
        a.y = a.target;
        if (!a.bounced && a.vy > BOUNCE_MIN_V) {
          Sfx.play('land');
          a.vy = -a.vy * REST;
          a.bounced = true;
        } else {
          if (!a.bounced) Sfx.play('land'); else Sfx.play('bounce');
          onLanded(a.col, a.row, a.who);
          return;
        }
      }
    }
    dirty = true;
  }

  /* ---------- Rendering ---------- */
  let nudge = 0;   // brief shake after choosing a full column

  function rr(g, x, y, w, h, r) {
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function paintDisc(g, x, y, who, r) {
    const p = PALETTE[who];
    g.save();
    g.shadowColor = p.glow;
    g.shadowBlur = 12 * view.scale;   // shadowBlur is in device pixels, not affected by the transform
    const grad = g.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
    grad.addColorStop(0, p.light);
    grad.addColorStop(0.55, p.base);
    grad.addColorStop(1, p.dark);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // Shape mark so the two colours also differ without colour vision: ring vs diamond.
    g.save();
    g.strokeStyle = 'rgba(4, 8, 28, 0.6)';
    g.lineWidth = 3;
    g.beginPath();
    if (who === 1) {
      g.arc(x, y, r * 0.5, 0, Math.PI * 2);
    } else {
      const d = r * 0.5;
      g.moveTo(x, y - d); g.lineTo(x + d, y); g.lineTo(x, y + d); g.lineTo(x - d, y); g.closePath();
    }
    g.stroke();
    g.restore();
  }

  function buildSprites() {
    const s = view.scale;
    const glowPad = 16;
    const size = Math.ceil((DISC_R + glowPad) * 2 * s);
    [1, 2].forEach(function (who) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = size;
      const g = cv.getContext('2d');
      g.scale(s, s);
      paintDisc(g, DISC_R + glowPad, DISC_R + glowPad, who, DISC_R);
      sprites[who] = cv;
    });
  }

  function buildPlate() {
    const s = view.scale;
    plate = document.createElement('canvas');
    plate.width = canvas.width;
    plate.height = canvas.height;
    const g = plate.getContext('2d');
    g.scale(s, s);
    const grad = g.createLinearGradient(0, PLATE_Y, 0, PLATE_Y + PLATE_H);
    grad.addColorStop(0, '#2b42b0');
    grad.addColorStop(1, '#162270');
    g.beginPath();
    rr(g, 2, PLATE_Y, W - 4, PLATE_H, 20);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        g.moveTo(cellX(c) + HOLE_R, cellY(r));
        g.arc(cellX(c), cellY(r), HOLE_R, 0, Math.PI * 2);
      }
    }
    g.fillStyle = grad;
    g.fill('evenodd');
    // Neon frame.
    g.beginPath();
    rr(g, 2, PLATE_Y, W - 4, PLATE_H, 20);
    g.strokeStyle = 'rgba(140, 170, 255, 0.75)';
    g.lineWidth = 2;
    g.stroke();
    // Hole rims.
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        g.beginPath();
        g.arc(cellX(c), cellY(r), HOLE_R + 1.5, 0, Math.PI * 2);
        g.strokeStyle = 'rgba(6, 10, 44, 0.95)';
        g.lineWidth = 3;
        g.stroke();
        g.beginPath();
        g.arc(cellX(c), cellY(r), HOLE_R + 3.5, 0, Math.PI * 2);
        g.strokeStyle = 'rgba(150, 180, 255, 0.28)';
        g.lineWidth = 1.5;
        g.stroke();
      }
    }
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(1, rect.width);
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const pxW = Math.round(cssW * dpr);
    const pxH = Math.round(cssW * dpr * H / W);
    if (canvas.width !== pxW || canvas.height !== pxH) {
      canvas.width = pxW;
      canvas.height = pxH;
    }
    view.scale = canvas.width / W;
    buildPlate();
    buildSprites();
    dirty = true;
  }

  function previewColumn() {
    if (!acceptingInput()) return -1;
    if (S.hoverCol >= 0) return S.hoverCol;
    if (S.lastInput !== 'touch') return S.kbCol;
    return -1;
  }

  function drawBanner(g, text, color) {
    g.save();
    g.font = '700 22px ' + FONT;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const w = g.measureText(text).width + 40;
    g.beginPath();
    rr(g, W / 2 - w / 2, DROP_CY - 20, w, 40, 20);
    g.fillStyle = 'rgba(4, 6, 22, 0.88)';
    g.fill();
    g.strokeStyle = color;
    g.lineWidth = 2;
    g.stroke();
    g.fillStyle = color;
    g.fillText(text, W / 2, DROP_CY + 1);
    g.restore();
  }

  function draw(ts) {
    const s = view.scale;
    const g = ctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.setTransform(s, 0, 0, s, 0, 0);

    let shakeX = 0;
    if (nudge > 0) {
      shakeX = reduced ? 0 : Math.sin(ts / 22) * 5 * nudge;
      nudge = Math.max(0, nudge - 0.06);
      if (nudge > 0) dirty = true;
    }
    g.translate(shakeX, 0);

    const half = (DISC_R + 16);
    const spriteSize = half * 2;
    const over = S.phase === 'over';
    const won = over && S.winCells.length > 0;

    // Dark interior behind the plate (seen through the holes).
    g.beginPath();
    rr(g, 2, PLATE_Y, W - 4, PLATE_H, 20);
    g.fillStyle = '#050816';
    g.fill();

    // Settled discs.
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const idx = r * COLS + c;
        const who = S.pos.cells[idx];
        if (!who) continue;
        if (S.anim && S.anim.col === c && S.anim.row === r) continue;
        g.globalAlpha = (won && S.winCells.indexOf(idx) < 0) ? 0.4 : 1;
        g.drawImage(sprites[who], cellX(c) - half, cellY(r) - half, spriteSize, spriteSize);
      }
    }
    g.globalAlpha = 1;

    // Front plate with holes.
    g.setTransform(1, 0, 0, 1, shakeX * s, 0);
    g.drawImage(plate, 0, 0);
    g.setTransform(s, 0, 0, s, 0, 0);
    g.translate(shakeX, 0);

    // Column tint, ghost disc and landing marker for the column being aimed at.
    const pc = previewColumn();
    if (pc >= 0) {
      const who = S.turn;
      const row = S.pos.heights[pc];
      g.fillStyle = 'rgba(' + PALETTE[who].rgb + ', 0.1)';
      g.fillRect(cellX(pc) - CELL / 2, PLATE_Y + 4, CELL, PLATE_H - 8);
      const bob = reduced ? 0 : Math.sin(ts / 260) * 2.5;
      g.globalAlpha = row < ROWS ? 0.7 : 0.25;
      g.drawImage(sprites[who], cellX(pc) - half, DROP_CY + bob - half, spriteSize, spriteSize);
      g.globalAlpha = 1;
      if (row < ROWS) {
        g.save();
        g.setLineDash([5, 5]);
        g.strokeStyle = 'rgba(' + PALETTE[who].rgb + ', 0.8)';
        g.lineWidth = 2.5;
        g.beginPath();
        g.arc(cellX(pc), cellY(row), DISC_R - 2, 0, Math.PI * 2);
        g.stroke();
        g.restore();
      }
    }

    // AI thinking indicator in the drop zone.
    if (S.phase === 'playing' && S.aiPending && !S.anim) {
      for (let i = 0; i < 3; i++) {
        const pulse = reduced ? 1 : 0.5 + 0.5 * Math.sin(ts / 180 - i * 0.9);
        g.globalAlpha = 0.35 + 0.65 * pulse;
        g.drawImage(sprites[2], W / 2 + (i - 1) * 34 - half * 0.5, DROP_CY - half * 0.5, spriteSize * 0.5, spriteSize * 0.5);
      }
      g.globalAlpha = 1;
    }

    // Falling disc (drawn above the plate so its path stays readable).
    if (S.anim) {
      const a = S.anim;
      g.drawImage(sprites[a.who], cellX(a.col) - half, a.y - half, spriteSize, spriteSize);
    }

    // Last move marker.
    if (S.phase === 'playing' && S.lastIdx >= 0 && !S.anim) {
      g.beginPath();
      g.arc(cellX(COL_OF[S.lastIdx]), cellY(ROW_OF[S.lastIdx]), 6, 0, Math.PI * 2);
      g.fillStyle = 'rgba(255, 255, 255, 0.85)';
      g.fill();
    }

    // Winning four: glowing outline.
    if (won) {
      const pulse = reduced ? 1 : 0.65 + 0.35 * Math.sin(ts / 220);
      const rgb = PALETTE[S.result].rgb;
      const pts = S.winCells.map(function (i) { return { x: cellX(COL_OF[i]), y: cellY(ROW_OF[i]) }; });
      g.save();
      g.lineCap = 'round';
      g.lineJoin = 'round';
      if (pts.length >= 2) {
        // Connect the discs in line order (sorted along the dominant axis).
        const sorted = pts.slice().sort(function (a, b) { return (a.x - b.x) || (a.y - b.y); });
        g.beginPath();
        g.moveTo(sorted[0].x, sorted[0].y);
        for (let i = 1; i < sorted.length; i++) g.lineTo(sorted[i].x, sorted[i].y);
        g.strokeStyle = 'rgba(' + rgb + ', ' + (0.25 * pulse) + ')';
        g.lineWidth = 16;
        g.stroke();
      }
      g.shadowColor = 'rgba(255, 255, 255, 0.95)';
      g.shadowBlur = 22 * pulse * s;
      g.strokeStyle = 'rgba(255, 255, 255, ' + (0.7 + 0.3 * pulse) + ')';
      g.lineWidth = 4;
      pts.forEach(function (p) {
        g.beginPath();
        g.arc(p.x, p.y, DISC_R + 5, 0, Math.PI * 2);
        g.stroke();
      });
      g.restore();
    }

    // Result banner in the drop zone.
    if (over) {
      if (S.result === 3) drawBanner(g, 'DRAW', '#ffd84d');
      else if (S.mode === 'ai') drawBanner(g, S.result === 1 ? 'YOU WIN' : 'AI WINS', S.result === 1 ? '#ff7ab8' : '#6beeff');
      else drawBanner(g, 'PLAYER ' + S.result + ' WINS', S.result === 1 ? '#ff7ab8' : '#6beeff');
    }
  }

  function frame(ts) {
    if (torn) return;
    rafId = requestAnimationFrame(frame);
    const dt = Math.max(0, Math.min(0.05, (ts - lastTs) / 1000));
    lastTs = ts;
    if (!isPaused()) stepAnim(dt);
    const animating = !reduced && (
      (S.phase === 'over' && S.winCells.length > 0) ||
      (S.phase === 'playing' && (S.aiPending || previewColumn() >= 0))
    );
    if (dirty || animating || S.anim) {
      dirty = false;
      draw(ts);
    }
  }

  /* ---------- Input: pointer (mouse, pen, touch) ---------- */
  function updateCursorStyle() {
    canvas.classList.toggle('can-drop', acceptingInput() && S.hoverCol >= 0);
  }

  canvas.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch' && !S.pressed) return;
    S.lastInput = e.pointerType || 'mouse';
    S.hoverCol = colFromClient(e.clientX);
    S.kbCol = S.hoverCol;
    updateCursorStyle();
    dirty = true;
  });

  canvas.addEventListener('pointerleave', function (e) {
    if (S.pressed) return;
    S.hoverCol = -1;
    updateCursorStyle();
    dirty = true;
  });

  canvas.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    Sfx.resume();
    S.lastInput = e.pointerType || 'mouse';
    if (!acceptingInput()) return;
    S.pressed = true;
    S.hoverCol = colFromClient(e.clientX);
    S.kbCol = S.hoverCol;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    dirty = true;
  });

  canvas.addEventListener('pointerup', function (e) {
    if (!S.pressed) return;
    S.pressed = false;
    const col = colFromClient(e.clientX);
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (e.pointerType === 'touch') S.hoverCol = -1; else S.hoverCol = col;
    S.kbCol = col;
    tryDrop(col);
    updateCursorStyle();
    dirty = true;
  });

  canvas.addEventListener('pointercancel', function () {
    S.pressed = false;
    S.hoverCol = -1;
    dirty = true;
  });

  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  /* ---------- Input: keyboard ---------- */
  function anyDialogOpen() {
    return els.menu.open || els.help.open || els.pause.open;
  }

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    Sfx.resume();
    const k = e.key;
    const lk = k.length === 1 ? k.toLowerCase() : k;

    if (anyDialogOpen()) {
      if (lk === 'p' && els.pause.open && !els.help.open && !els.menu.open) {
        e.preventDefault();
        els.pause.close('resume');
      }
      return;
    }

    if (k === 'ArrowLeft' || k === 'ArrowRight') {
      e.preventDefault();
      S.lastInput = 'key';
      S.hoverCol = -1;
      const next = Math.max(0, Math.min(COLS - 1, S.kbCol + (k === 'ArrowLeft' ? -1 : 1)));
      if (next !== S.kbCol) Sfx.play('cursor');
      S.kbCol = next;
      dirty = true;
      return;
    }

    if (/^[1-7]$/.test(k)) {
      if (e.repeat) return;
      S.lastInput = 'key';
      S.kbCol = Number(k) - 1;
      S.hoverCol = -1;
      tryDrop(S.kbCol);
      dirty = true;
      return;
    }

    if (k === 'Enter' || k === ' ' || k === 'Spacebar') {
      const ae = document.activeElement;
      if (ae && ae !== document.body && ae !== canvas) return;   // buttons and links handle their own activation
      e.preventDefault();
      if (e.repeat) return;
      S.lastInput = 'key';
      S.hoverCol = -1;
      if (S.phase === 'over') {
        if (performance.now() - S.overAt > 700) restart();
      } else {
        tryDrop(S.kbCol);
      }
      dirty = true;
      return;
    }

    if (lk === 'r') { e.preventDefault(); restart(); return; }
    if (lk === 'p' || k === 'Escape') { if (S.phase === 'playing') { e.preventDefault(); openPause(); } return; }
    if (lk === 'm') { e.preventDefault(); toggleSound(); return; }
    if (lk === 'h' || k === '?') { e.preventDefault(); openHelp(); return; }
  });

  /* ---------- Dialogs ---------- */
  function openDialog(d) {
    if (d.open) return;
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
  }

  function syncMenuControls() {
    const form = els.menu.querySelector('form');
    const ai = form.elements.mode.value === 'ai';
    els.levelField.classList.toggle('is-disabled', !ai);
    Array.prototype.forEach.call(form.elements.level, function (r) { r.disabled = !ai; });
  }

  function openMenu() {
    const form = els.menu.querySelector('form');
    form.elements.mode.value = S.mode;
    form.elements.level.value = S.level;
    syncMenuControls();
    els.resumeBtn.hidden = S.phase === 'menu';
    setHold('menu', true);
    openDialog(els.menu);
  }

  function openPause() {
    if (S.phase !== 'playing' || anyDialogOpen()) return;
    setHold('user', true);
    openDialog(els.pause);
  }

  function openHelp() {
    if (els.help.open) return;
    setHold('help', true);
    openDialog(els.help);
  }

  els.menu.addEventListener('change', syncMenuControls);

  els.menu.addEventListener('close', function () {
    const rv = els.menu.returnValue;
    els.menu.returnValue = '';
    setHold('menu', false);
    if (S.phase === 'menu' || rv === 'start') startGame();
    else canvas.focus({ preventScroll: true });
  });

  els.pause.addEventListener('close', function () {
    const rv = els.pause.returnValue;
    els.pause.returnValue = '';
    setHold('user', false);
    if (rv === 'restart') restart();
    else if (rv === 'menu') openMenu();
    else canvas.focus({ preventScroll: true });
  });

  els.help.addEventListener('close', function () {
    setHold('help', false);
  });

  $('howto-menu-btn').addEventListener('click', openHelp);
  $('help-btn').addEventListener('click', openHelp);
  $('menu-btn').addEventListener('click', openMenu);
  $('menu-btn-2').addEventListener('click', openMenu);
  $('pause-btn').addEventListener('click', openPause);
  $('restart-btn').addEventListener('click', restart);
  $('again-btn').addEventListener('click', restart);
  $('reset-score-btn').addEventListener('click', function () {
    const fresh = blankTally();
    tally.ai = fresh.ai;
    tally.pvp = fresh.pvp;
    saveTally();
    refreshHud();
    $('reset-score-btn').textContent = 'Session score cleared';
    setTimeout(function () { $('reset-score-btn').textContent = 'Reset session score'; }, 1600);
  });

  /* ---------- Sound toggle ---------- */
  function refreshSoundButton() {
    const muted = Sfx.isUserMuted();
    els.soundOn.classList.toggle('hidden', muted);
    els.soundOff.classList.toggle('hidden', !muted);
    els.soundBtn.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
    els.soundBtn.setAttribute('title', (muted ? 'Sound is off' : 'Sound is on') + ' (M)');
  }

  function toggleSound() {
    Sfx.setUserMuted(!Sfx.isUserMuted());
    refreshSoundButton();
    if (!Sfx.isUserMuted()) { Sfx.resume(); Sfx.play('start'); }
  }
  els.soundBtn.addEventListener('click', toggleSound);

  /* ---------- Hub integration (ArcadeVerse lifecycle messages) ---------- */
  window.addEventListener('message', function (e) {
    const d = e && e.data;
    if (!d || typeof d !== 'object') return;
    switch (d.type) {
      case 'ARCADEVERSE_PAUSE': setHold('hub', true); break;
      case 'ARCADEVERSE_RESUME': setHold('hub', false); break;
      case 'ARCADEVERSE_AUDIO_CONFIG':
        if (typeof d.muted === 'boolean') Sfx.setHubMuted(d.muted);
        break;
      case 'ARCADEVERSE_TEARDOWN':
        torn = true;
        cancelAnimationFrame(rafId);
        clearTimeout(S.aiTimer);
        Sfx.close();
        break;
      default: break;
    }
  });

  /* ---------- Boot ---------- */
  window.addEventListener('resize', resize);
  if (typeof ResizeObserver === 'function') new ResizeObserver(resize).observe(canvas);
  canvas.addEventListener('focus', function () { dirty = true; });
  canvas.addEventListener('blur', function () { dirty = true; });

  resize();
  refreshSoundButton();
  refreshBoardText();
  refreshAll();
  rafId = requestAnimationFrame(function (ts) { lastTs = ts; frame(ts); });
  openMenu();

})();
