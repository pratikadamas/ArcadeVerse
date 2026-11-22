/**
 * Neon Highway Hopper - Cyber Crossy Road Runner
 * ArcadeVerse (NSoC 2026) - Pure vanilla HTML5 Canvas + JS
 *
 * World model
 *  - The world is a stack of rows (lanes). Row 0 is the start, rows grow forward.
 *  - Columns are 0..COLS-1. Positions on a lane are in cell units (floats).
 *  - Cars, logs and trains are continuous rectangles that wrap on a ring.
 *  - The player always stands on an integer cell, except while riding a log
 *    (then x follows the log). Collision is rectangle vs rectangle in cell units.
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Constants                                                           */
  /* ------------------------------------------------------------------ */
  const COLS = 9;
  const CELL = 48;
  const VIEW_ROWS = 12;
  const W = COLS * CELL;
  const H = VIEW_ROWS * CELL;

  const HOP_TIME = 0.13;            // seconds per hop
  const RING_MIN = -4;              // lane objects live on a ring of left edges [RING_MIN, RING_MIN + RING_LEN)
  const RING_LEN = COLS + 8;
  const CAM_LEAD = 3.2;             // rows visible below the player
  const START_ROW = 0;
  const START_COL = 4;
  const HIT_INSET = 0.1;            // player rect is [x + inset, x + 1 - inset]
  const IDLE_GRACE = 2.5;           // seconds without forward progress before the drone starts moving
  const BIT_BONUS = 20;
  const MULT_STEP = 0.2;
  const MULT_MAX = 6;
  const BEST_KEY = 'neonHighwayHopper.best';
  const MUTE_KEY = 'neonHighwayHopper.muted';
  const CAR_COLORS = ['#19f3ff', '#ff2bd6', '#b6ff3c', '#ffb020', '#8a6bff', '#ff4d5e'];
  const FONT = "'Space Grotesk', 'Segoe UI', system-ui, sans-serif";

  /* ------------------------------------------------------------------ */
  /* Helpers                                                             */
  /* ------------------------------------------------------------------ */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const mod = (v, m) => ((v % m) + m) % m;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function storeGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function storeSet(key, value) {
    try { window.localStorage.setItem(key, String(value)); } catch (e) { /* storage unavailable */ }
  }

  function reducedMotion() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  /* ------------------------------------------------------------------ */
  /* DOM                                                                 */
  /* ------------------------------------------------------------------ */
  const $ = (id) => document.getElementById(id);
  const canvas = $('game-canvas');
  const ctx = canvas.getContext('2d');
  const el = {
    dist: $('dist-display'), score: $('score-display'), best: $('best-display'),
    bits: $('bits-display'), mult: $('mult-display'),
    start: $('start-overlay'), pause: $('pause-overlay'), over: $('gameover-overlay'), help: $('help-modal'),
    startBtn: $('start-btn'), restartBtn: $('restart-btn'), resumeBtn: $('resume-btn'),
    pauseRestartBtn: $('pause-restart-btn'), closeHelpBtn: $('close-help-btn'),
    helpBtn: $('help-btn'), soundBtn: $('sound-btn'), pauseBtn: $('pause-btn'),
    startHelp: $('start-help-btn'), pauseHelp: $('pause-help-btn'), overHelp: $('over-help-btn'),
    soundOn: $('sound-icon-on'), soundOff: $('sound-icon-off'),
    pauseIcon: $('pause-icon'), playIcon: $('play-icon'),
    reason: $('gameover-reason'), newBest: $('new-best-tag'),
    finalScore: $('final-score'), finalDist: $('final-dist'), finalBits: $('final-bits'), finalBest: $('final-best')
  };

  /* ------------------------------------------------------------------ */
  /* Audio (procedural, created only after a user gesture)               */
  /* ------------------------------------------------------------------ */
  let audio = null;
  let soundOn = storeGet(MUTE_KEY) !== '1';
  let masterGain = null;
  let limiterNode = null;
  const activeVoices = new Set();
  const MAX_VOICES = 6;

  function trackVoice(node) {
    if (!node) return node;
    while (activeVoices.size >= MAX_VOICES) {
      const oldest = activeVoices.values().next().value;
      if (oldest) {
        try {
          if (typeof oldest.stop === 'function') oldest.stop();
          if (typeof oldest.disconnect === 'function') oldest.disconnect();
        } catch (_) {}
        activeVoices.delete(oldest);
      } else {
        break;
      }
    }
    activeVoices.add(node);
    const onEnded = () => {
      activeVoices.delete(node);
    };
    if (typeof node.addEventListener === 'function') {
      node.addEventListener('ended', onEnded, { once: true });
    } else {
      node.onended = onEnded;
    }
    return node;
  }

  function stopAllAudio() {
    activeVoices.forEach((node) => {
      try {
        if (typeof node.stop === 'function') node.stop();
        if (typeof node.disconnect === 'function') node.disconnect();
      } catch (_) {}
    });
    activeVoices.clear();
  }

  function unlockAudio() {
    if (!audio) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) audio = new AC();
      } catch (e) { audio = null; }
    }
    if (audio && !masterGain) {
      masterGain = audio.createGain();
      masterGain.gain.setValueAtTime(0.5, audio.currentTime);
      try {
        const comp = audio.createDynamicsCompressor();
        comp.threshold.setValueAtTime(-0.5, audio.currentTime);
        comp.knee.setValueAtTime(0, audio.currentTime);
        comp.ratio.setValueAtTime(20.0, audio.currentTime);
        comp.attack.setValueAtTime(0.001, audio.currentTime);
        comp.release.setValueAtTime(0.05, audio.currentTime);
        limiterNode = comp;
        masterGain.connect(limiterNode);
        limiterNode.connect(audio.destination);
      } catch (_) {
        masterGain.connect(audio.destination);
      }
    }
    if (audio && audio.state === 'suspended') {
      try { audio.resume(); } catch (e) { /* ignore */ }
    }
  }

  function tone(freq, dur, type, vol, endFreq, delay) {
    if (!soundOn || !audio) return;
    try {
      const t0 = audio.currentTime + (delay || 0);
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, t0);
      if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + dur);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol || 0.08, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(masterGain || audio.destination);
      trackVoice(osc);
      osc.start(t0);
      osc.stop(t0 + dur + 0.03);
    } catch (e) { /* ignore audio failures */ }
  }

  function noise(dur, vol, cutoff) {
    if (!soundOn || !audio) return;
    try {
      const len = Math.max(1, Math.floor(audio.sampleRate * dur));
      const buf = audio.createBuffer(1, len, audio.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = audio.createBufferSource();
      const filter = audio.createBiquadFilter();
      const gain = audio.createGain();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff || 1200;
      gain.gain.value = vol || 0.15;
      src.buffer = buf;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain || audio.destination);
      trackVoice(src);
      src.start();
      src.stop(audio.currentTime + dur + 0.03);
    } catch (e) { /* ignore audio failures */ }
  }

  const sfx = {
    hop() { tone(440, 0.09, 'square', 0.045, 720); },
    bump() { tone(130, 0.07, 'triangle', 0.07, 90); },
    pickup() { tone(880, 0.1, 'sine', 0.09); tone(1320, 0.16, 'sine', 0.09, 1760, 0.07); },
    crash() { noise(0.5, 0.28, 900); tone(160, 0.45, 'sawtooth', 0.12, 38); },
    zap() { noise(0.35, 0.18, 3200); tone(900, 0.35, 'sawtooth', 0.08, 90); },
    warn() { tone(1040, 0.1, 'square', 0.04); },
    alarm() { tone(300, 0.2, 'sawtooth', 0.05, 220); },
    start() { tone(330, 0.09, 'triangle', 0.08); tone(495, 0.09, 'triangle', 0.08, null, 0.08); tone(660, 0.14, 'triangle', 0.08, null, 0.16); }
  };

  /* ------------------------------------------------------------------ */
  /* Game state                                                          */
  /* ------------------------------------------------------------------ */
  let state = 'ready';   // ready | playing | paused | dying | over
  let helpOpen = false;
  let rows = {};
  let gen = null;
  let player = null;
  let cam = 0;
  let lurker = 0;
  let idle = 0;
  let maxRow = 0;
  let score = 0;
  let bitsCollected = 0;
  let best = parseInt(storeGet(BEST_KEY), 10) || 0;
  let newBest = false;
  let deathT = 0;
  let deathKind = '';
  let buffered = null;
  let particles = [];
  let floaters = [];
  let shake = 0;
  let flash = 0;
  let clock = 0;
  let alarmT = 0;

  function multiplier() { return Math.min(MULT_MAX, 1 + MULT_STEP * bitsCollected); }
  function difficultyAt(r) { return clamp(r / 110, 0, 1); }

  /* ------------------------------------------------------------------ */
  /* Procedural lane generation                                          */
  /* ------------------------------------------------------------------ */
  function resetGenerator() {
    gen = { next: -6, type: 'grass', left: 0, idx: 0, len: 0, prev: 'grass', first: true, segments: 0, corridor: START_COL, roadDir: 1, riverDir: 1, railDir: 1 };
  }

  function weighted(map) {
    const keys = Object.keys(map);
    let total = 0;
    keys.forEach((k) => { total += map[k]; });
    let roll = Math.random() * total;
    for (let i = 0; i < keys.length; i++) {
      roll -= map[keys[i]];
      if (roll <= 0) return keys[i];
    }
    return keys[keys.length - 1];
  }

  function planSegment() {
    const r = gen.next;
    const d = difficultyAt(r);
    let type;
    if (gen.first) {
      type = 'grass';
    } else if (gen.prev === 'grass') {
      type = gen.segments <= 1 ? 'road' : weighted({ road: 0.5, river: 0.24 + 0.12 * d, rail: 0.16 + 0.12 * d });
    } else if (gen.prev === 'road') {
      type = weighted({ grass: 0.5, river: 0.2, rail: 0.2 });
    } else {
      type = 'grass';
    }
    let len;
    if (gen.first) len = 10;                                 // rows -6..3
    else if (type === 'grass') len = randInt(1, 3);
    else if (type === 'road') len = randInt(r < 12 ? 1 : 2, 3 + Math.floor(d * 2));
    else if (type === 'rail') len = Math.random() < 0.3 + 0.2 * d ? 2 : 1;
    else len = randInt(1, 2 + Math.floor(d * 1.5));
    const wasFirst = gen.first;
    gen.first = false;
    gen.type = type;
    gen.len = len;
    gen.left = len;
    gen.idx = 0;
    gen.segments += 1;
    // the clear corridor column of a grass strip; the start strip keeps the spawn column free
    gen.corridor = wasFirst ? START_COL : randInt(1, COLS - 2);
  }

  function ensureRows(upTo) {
    while (gen.next <= upTo) {
      if (gen.left <= 0) {
        gen.prev = gen.type;
        planSegment();
      }
      rows[gen.next] = makeRow(gen.next);
      gen.next += 1;
      gen.idx += 1;
      gen.left -= 1;
    }
  }

  function makeRow(r) {
    const d = difficultyAt(r);
    const row = { r: r, type: gen.type, bits: [], deco: [] };
    for (let i = 0; i < 3; i++) row.deco.push({ x: rand(8, W - 20), y: rand(8, CELL - 8), w: rand(6, 20) });

    if (row.type === 'grass') {
      row.pylons = new Set();
      const middle = gen.idx >= 1 && gen.idx <= gen.len - 2;
      if (middle) {
        for (let c = 0; c < COLS; c++) {
          if (c !== gen.corridor && row.pylons.size < 4 && Math.random() < 0.2) row.pylons.add(c);
        }
      }
      if (r > 3 && Math.random() < 0.38) {
        const free = [];
        for (let c = 0; c < COLS; c++) if (!row.pylons.has(c)) free.push(c);
        row.bits.push({ col: pick(free), log: null, off: 0, taken: false, phase: Math.random() * 6 });
      }
    } else if (row.type === 'road') {
      const dir = Math.random() < 0.85 ? -gen.roadDir : gen.roadDir;
      gen.roadDir = dir;
      row.dir = dir;
      row.speed = Math.min(6, rand(1.3, 2.3) * (1 + 1.1 * d));
      const n = clamp(Math.round(lerp(1.6, 3.6, d) + rand(-0.6, 0.6)), 1, 4);
      const spacing = RING_LEN / n;
      const maxJit = Math.max(0, (spacing - 3.6) / 2);
      const phase = Math.random() * RING_LEN;
      row.cars = [];
      for (let i = 0; i < n; i++) {
        const len = Math.random() < 0.25 + 0.15 * d ? 2 : 1;
        row.cars.push({
          x: RING_MIN + mod(phase + i * spacing + rand(-maxJit, maxJit), RING_LEN),
          len: len,
          color: pick(CAR_COLORS)
        });
      }
      if (Math.random() < 0.14) row.bits.push({ col: randInt(0, COLS - 1), log: null, off: 0, taken: false, phase: Math.random() * 6 });
    } else if (row.type === 'rail') {
      const dir = Math.random() < 0.5 ? -1 : 1;
      row.dir = dir;
      row.state = 'idle';
      row.timer = rand(1.2, 3.2);
      row.warnDur = lerp(1.5, 1.05, d);
      row.interval = [lerp(3.4, 1.7, d), lerp(5.0, 2.8, d)];
      row.trainSpeed = 17 + 8 * d;
      row.trainLen = 12;
      row.trainX = dir > 0 ? -row.trainLen : COLS;
      row.beep = 0;
    } else {
      const dir = Math.random() < 0.9 ? -gen.riverDir : gen.riverDir;
      gen.riverDir = dir;
      row.dir = dir;
      row.speed = Math.min(3.6, rand(0.9, 1.7) * (1 + 0.8 * d));
      const wide = d < 0.5;
      const n = wide ? 3 : 4;
      const spacing = RING_LEN / n;
      const phase = Math.random() * RING_LEN;
      row.logs = [];
      for (let i = 0; i < n; i++) {
        row.logs.push({
          x: RING_MIN + mod(phase + i * spacing, RING_LEN),
          len: wide ? randInt(3, 4) : randInt(2, 3)
        });
      }
      if (Math.random() < 0.3) {
        const log = pick(row.logs);
        row.bits.push({ col: 0, log: log, off: rand(0.5, log.len - 0.5), taken: false, phase: Math.random() * 6 });
      }
    }
    return row;
  }

  function getRow(r) {
    if (!rows[r]) ensureRows(r);
    return rows[r];
  }

  /* ------------------------------------------------------------------ */
  /* World update                                                        */
  /* ------------------------------------------------------------------ */
  function wrapObject(o, dir) {
    if (dir > 0 && o.x >= RING_MIN + RING_LEN) o.x -= RING_LEN;
    else if (dir < 0 && o.x < RING_MIN) o.x += RING_LEN;
  }

  function updateWorld(dt) {
    const lo = Math.floor(cam) - 2;
    const hi = Math.ceil(cam) + VIEW_ROWS + 1;
    for (const key in rows) {
      const row = rows[key];
      if (row.r < lo - 6) { delete rows[key]; continue; }
      if (row.type === 'road') {
        for (let i = 0; i < row.cars.length; i++) {
          const car = row.cars[i];
          car.x += row.dir * row.speed * dt;
          wrapObject(car, row.dir);
        }
      } else if (row.type === 'river') {
        for (let i = 0; i < row.logs.length; i++) {
          const log = row.logs[i];
          log.x += row.dir * row.speed * dt;
          wrapObject(log, row.dir);
        }
      } else if (row.type === 'rail' && row.r >= lo && row.r <= hi) {
        updateRail(row, dt);
      }
    }
  }

  function updateRail(row, dt) {
    if (row.state === 'idle') {
      row.timer -= dt;
      if (row.timer <= 0) { row.state = 'warn'; row.timer = row.warnDur; row.beep = 0; }
    } else if (row.state === 'warn') {
      row.timer -= dt;
      row.beep -= dt;
      if (row.beep <= 0) { row.beep = 0.22; sfx.warn(); }
      if (row.timer <= 0) {
        row.state = 'pass';
        row.trainX = row.dir > 0 ? -row.trainLen : COLS;
      }
    } else if (row.state === 'pass') {
      row.trainX += row.dir * row.trainSpeed * dt;
      if ((row.dir > 0 && row.trainX > COLS) || (row.dir < 0 && row.trainX + row.trainLen < 0)) {
        row.state = 'idle';
        row.timer = rand(row.interval[0], row.interval[1]);
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Game flow                                                           */
  /* ------------------------------------------------------------------ */
  function newGame() {
    rows = {};
    resetGenerator();
    cam = START_ROW - CAM_LEAD;
    ensureRows(Math.ceil(cam) + VIEW_ROWS + 6);
    player = { x: START_COL, row: START_ROW, vx: START_COL, vr: START_ROW, hop: null, platform: null, off: 0, bump: 0, face: 1 };
    lurker = START_ROW - 5;
    idle = 0;
    maxRow = START_ROW;
    score = 0;
    bitsCollected = 0;
    newBest = false;
    deathT = 0;
    deathKind = '';
    buffered = null;
    particles = [];
    floaters = [];
    shake = 0;
    flash = 0;
    alarmT = 0;
    updateHud(true);
  }

  function setOverlay(which) {
    el.start.classList.toggle('hidden', which !== 'start');
    el.pause.classList.toggle('hidden', which !== 'pause');
    el.over.classList.toggle('hidden', which !== 'over');
    const paused = which === 'pause';
    el.pauseIcon.classList.toggle('hidden', paused);
    el.playIcon.classList.toggle('hidden', !paused);
  }

  function startGame() {
    if (state !== 'ready') return;
    stopAllAudio();
    unlockAudio();
    newGame();
    state = 'playing';
    setOverlay(null);
    sfx.start();
  }

  function restartGame() {
    if (state !== 'over' && state !== 'paused') return;
    stopAllAudio();
    unlockAudio();
    newGame();
    state = 'playing';
    setOverlay(null);
    sfx.start();
  }

  function pauseGame() {
    if (state !== 'playing') return;
    state = 'paused';
    setOverlay('pause');
  }

  function resumeGame() {
    if (state !== 'paused') return;
    state = 'playing';
    buffered = null;
    setOverlay(null);
  }

  function togglePause() {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  }

  function openHelp() {
    if (helpOpen) return;
    if (state === 'playing') pauseGame();
    helpOpen = true;
    el.help.classList.remove('hidden');
    el.closeHelpBtn.focus();
  }

  function closeHelp() {
    if (!helpOpen) return;
    helpOpen = false;
    el.help.classList.add('hidden');
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }

  const DEATH_TEXT = {
    car: 'Flattened by freeway traffic.',
    train: 'Hit by a magnetic train.',
    laser: 'Fried by the laser river.',
    swept: 'Carried off the grid by a log.',
    drone: 'Caught by the scanner drone.'
  };

  function die(kind) {
    if (state !== 'playing') return;
    state = 'dying';
    deathKind = kind;
    deathT = 0;
    buffered = null;
    if (score > best) {
      best = score;
      newBest = true;
      storeSet(BEST_KEY, best);
    }
    const sx = player.vx * CELL + CELL / 2;
    const sy = rowTop(player.vr) + CELL / 2;
    const n = reducedMotion() ? 12 : 34;
    burst(sx, sy, n, kind === 'laser' || kind === 'swept' ? '#ff2bd6' : '#19f3ff', 220);
    burst(sx, sy, Math.floor(n / 2), '#ffffff', 140);
    if (kind === 'laser' || kind === 'swept') sfx.zap(); else sfx.crash();
    if (!reducedMotion()) shake = 0.45;
    flash = reducedMotion() ? 0.12 : 0.45;
    updateHud(false);
  }

  function showGameOver() {
    state = 'over';
    el.reason.textContent = DEATH_TEXT[deathKind] || 'Signal lost.';
    el.newBest.classList.toggle('hidden', !newBest);
    el.finalScore.textContent = String(score);
    el.finalDist.textContent = String(maxRow - START_ROW);
    el.finalBits.textContent = String(bitsCollected);
    el.finalBest.textContent = String(best);
    setOverlay('over');
    el.restartBtn.focus();
  }

  /* ------------------------------------------------------------------ */
  /* Player movement                                                     */
  /* ------------------------------------------------------------------ */
  function requestMove(dx, dr) {
    if (state !== 'playing' || helpOpen) return;
    if (player.hop) { buffered = { dx: dx, dr: dr }; return; }
    doMove(dx, dr);
  }

  function doMove(dx, dr) {
    const tx = Math.round(player.x) + dx;
    const tr = player.row + dr;
    if (dx !== 0) player.face = dx;
    if (tx < 0 || tx >= COLS) return bump();
    if (dr < 0 && tr < Math.floor(cam) + 1) return bump();
    const row = getRow(tr);
    if (row.type === 'grass' && row.pylons.has(tx)) return bump();
    player.hop = { t: 0, fx: player.x, fr: player.row, tx: tx, tr: tr };
    player.platform = null;
    sfx.hop();
  }

  function bump() {
    player.bump = 0.14;
    sfx.bump();
  }

  function addScore(points) {
    score += points;
  }

  function finishHop() {
    const hop = player.hop;
    player.x = hop.tx;
    player.row = hop.tr;
    player.hop = null;
    player.vx = player.x;
    player.vr = player.row;
    if (player.row > maxRow) {
      const gained = player.row - maxRow;
      for (let i = 0; i < gained; i++) addScore(Math.round(10 * multiplier()));
      maxRow = player.row;
      idle = 0;
      updateHud(false);
    }
    land();
    if (state === 'playing' && buffered) {
      const next = buffered;
      buffered = null;
      doMove(next.dx, next.dr);
    }
  }

  function land() {
    const row = getRow(player.row);
    if (row.type !== 'river') { player.platform = null; return; }
    const cx = player.x + 0.5;
    for (let i = 0; i < row.logs.length; i++) {
      const log = row.logs[i];
      if (cx >= log.x - 0.1 && cx <= log.x + log.len + 0.1) {
        player.platform = log;
        player.off = player.x - log.x;
        return;
      }
    }
    player.platform = null;
    die('laser');
  }

  function occupiedRow() {
    const hop = player.hop;
    if (hop) return hop.t < 0.5 ? hop.fr : hop.tr;
    return player.row;
  }

  function updatePlayer(dt) {
    if (player.bump > 0) player.bump = Math.max(0, player.bump - dt);
    if (player.hop) {
      const hop = player.hop;
      hop.t = Math.min(1, hop.t + dt / HOP_TIME);
      const e = hop.t * hop.t * (3 - 2 * hop.t);
      player.vx = lerp(hop.fx, hop.tx, e);
      player.vr = lerp(hop.fr, hop.tr, e);
      if (hop.t >= 1) finishHop();
    } else if (player.platform) {
      player.x = player.platform.x + player.off;
      player.vx = player.x;
      player.vr = player.row;
      if (player.x + 0.5 < 0 || player.x + 0.5 > COLS) die('swept');
    }
  }

  function checkCollisions() {
    if (state !== 'playing') return;
    const r = occupiedRow();
    const row = rows[r];
    if (!row) return;
    const left = player.vx + HIT_INSET;
    const right = player.vx + 1 - HIT_INSET;
    if (row.type === 'road') {
      for (let i = 0; i < row.cars.length; i++) {
        const car = row.cars[i];
        if (car.x < right && car.x + car.len > left) { die('car'); return; }
      }
    } else if (row.type === 'rail') {
      if (row.state === 'pass' && row.trainX < right && row.trainX + row.trainLen > left) { die('train'); return; }
    } else if (row.type === 'river') {
      if (!player.hop && !player.platform) { die('laser'); return; }
    }
    // quantum bits
    if (!player.hop || player.hop.t > 0.5) {
      const cx = player.vx + 0.5;
      for (let i = 0; i < row.bits.length; i++) {
        const bit = row.bits[i];
        if (bit.taken) continue;
        const bx = bit.log ? bit.log.x + bit.off : bit.col + 0.5;
        if (Math.abs(cx - bx) < 0.55) collectBit(bit, bx, r);
      }
    }
  }

  function collectBit(bit, bx, r) {
    bit.taken = true;
    bitsCollected += 1;
    const bonus = Math.round(BIT_BONUS * multiplier());
    addScore(bonus);
    sfx.pickup();
    const sx = bx * CELL;
    const sy = rowTop(r) + CELL / 2;
    burst(sx, sy, reducedMotion() ? 4 : 12, '#ffd84a', 120);
    floaters.push({ x: sx, y: sy - 10, text: '+' + bonus, life: 0.9, color: '#ffd84a' });
    updateHud(false, true);
  }

  function updateLurker(dt) {
    const d = difficultyAt(maxRow);
    const follow = maxRow - (5 - 1.5 * d);
    if (lurker < follow) lurker = follow;
    idle += dt;
    if (idle > IDLE_GRACE) {
      const t = idle - IDLE_GRACE;
      lurker += (0.7 + 0.35 * t) * dt;
      alarmT -= dt;
      if (alarmT <= 0) { alarmT = 0.7; sfx.alarm(); }
    }
    if (lurker > player.vr + 0.35) die('drone');
  }

  function updateCamera(dt) {
    const target = player.vr - CAM_LEAD;
    if (target > cam) cam += (target - cam) * Math.min(1, dt * 8);
    ensureRows(Math.ceil(cam) + VIEW_ROWS + 6);
  }

  /* ------------------------------------------------------------------ */
  /* Effects                                                             */
  /* ------------------------------------------------------------------ */
  function burst(x, y, n, color, speed) {
    for (let i = 0; i < n && particles.length < 260; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = rand(0.3, 1) * speed;
      particles.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: rand(0.35, 0.8), max: 0.8, color: color, size: rand(2, 4.5) });
    }
  }

  function updateEffects(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 380 * dt;
    }
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.life -= dt;
      f.y -= 36 * dt;
      if (f.life <= 0) floaters.splice(i, 1);
    }
    shake = Math.max(0, shake - dt);
    flash = Math.max(0, flash - dt * 1.4);
  }

  /* ------------------------------------------------------------------ */
  /* HUD                                                                 */
  /* ------------------------------------------------------------------ */
  const hudCache = {};
  function setText(key, node, text, pulse) {
    if (hudCache[key] === text) return;
    hudCache[key] = text;
    node.textContent = text;
    if (pulse) {
      node.classList.remove('pop');
      void node.offsetWidth;
      node.classList.add('pop');
    }
  }

  function updateHud(force, pulse) {
    if (force) { for (const k in hudCache) delete hudCache[k]; }
    setText('dist', el.dist, String(maxRow - START_ROW), false);
    setText('score', el.score, String(score), false);
    setText('best', el.best, String(Math.max(best, score)), false);
    setText('bits', el.bits, String(bitsCollected), !!pulse);
    setText('mult', el.mult, 'x' + multiplier().toFixed(1), !!pulse);
  }

  /* ------------------------------------------------------------------ */
  /* Rendering                                                           */
  /* ------------------------------------------------------------------ */
  function rowTop(r) { return H - (r - cam + 1) * CELL; }

  function rr(x, y, w, h, r) {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.arcTo(x + w, y, x + w, y + rad, rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.arcTo(x + w, y + h, x + w - rad, y + h, rad);
    ctx.lineTo(x + rad, y + h);
    ctx.arcTo(x, y + h, x, y + h - rad, rad);
    ctx.lineTo(x, y + rad);
    ctx.arcTo(x, y, x + rad, y, rad);
    ctx.closePath();
  }

  function glow(color, blur) { ctx.shadowColor = color; ctx.shadowBlur = blur; }
  function noGlow() { ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; }

  function drawGrass(row, y) {
    ctx.fillStyle = (row.r & 1) ? '#06211f' : '#072723';
    ctx.fillRect(0, y, W, CELL);
    ctx.strokeStyle = 'rgba(60,255,190,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 1; c < COLS; c++) { ctx.moveTo(c * CELL + 0.5, y); ctx.lineTo(c * CELL + 0.5, y + CELL); }
    ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5);
    ctx.stroke();
    ctx.fillStyle = 'rgba(80,255,200,0.22)';
    for (let i = 0; i < row.deco.length; i++) {
      const d = row.deco[i];
      ctx.fillRect(d.x, y + d.y, d.w, 2);
    }
  }

  function drawPylon(cx, y) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.ellipse(cx, y + 40, 15, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - 10, y + 39); ctx.lineTo(cx - 6, y + 12); ctx.lineTo(cx + 6, y + 12); ctx.lineTo(cx + 10, y + 39);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, y + 12, 0, y + 39);
    g.addColorStop(0, '#12525c'); g.addColorStop(1, '#061c24');
    ctx.fillStyle = g; ctx.fill();
    glow('#19f3ff', 8);
    ctx.strokeStyle = '#19f3ff'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 8, y + 24); ctx.lineTo(cx + 8, y + 24); ctx.stroke();
    noGlow();
    glow('#b6ff3c', 12);
    ctx.fillStyle = '#b6ff3c';
    ctx.beginPath(); ctx.arc(cx, y + 9, 4, 0, Math.PI * 2); ctx.fill();
    noGlow();
  }

  function drawRoad(row, y) {
    ctx.fillStyle = '#0a0c20';
    ctx.fillRect(0, y, W, CELL);
    ctx.fillStyle = 'rgba(255,255,255,0.025)';
    ctx.fillRect(0, y + CELL / 2 - 1, W, 2);
    const above = rows[row.r + 1];
    const below = rows[row.r - 1];
    if (above && above.type === 'road') {
      ctx.strokeStyle = 'rgba(255,43,214,0.55)';
      ctx.lineWidth = 2;
      ctx.setLineDash([14, 12]);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      ctx.setLineDash([]);
    } else {
      glow('#19f3ff', 10);
      ctx.strokeStyle = '#19f3ff'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(0, y + 1.5); ctx.lineTo(W, y + 1.5); ctx.stroke();
      noGlow();
    }
    if (!below || below.type !== 'road') {
      glow('#19f3ff', 10);
      ctx.strokeStyle = '#19f3ff'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(0, y + CELL - 1.5); ctx.lineTo(W, y + CELL - 1.5); ctx.stroke();
      noGlow();
    }
  }

  function drawCar(car, y, dir) {
    const x = car.x * CELL;
    const w = car.len * CELL;
    const color = car.color;
    glow(color, 14);
    rr(x + 4, y + 10, w - 8, CELL - 20, 8);
    const g = ctx.createLinearGradient(0, y + 10, 0, y + CELL - 10);
    g.addColorStop(0, '#171a3c'); g.addColorStop(1, '#0a0b1f');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
    noGlow();
    // cabin / windshield on the leading half
    const front = dir > 0 ? x + w - 4 : x + 4;
    const cabW = Math.min(14, w * 0.3);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.55;
    rr(dir > 0 ? front - cabW - 4 : front + 4, y + 15, cabW, CELL - 30, 3);
    ctx.fill();
    ctx.globalAlpha = 1;
    // roof stripe
    ctx.strokeStyle = color; ctx.globalAlpha = 0.45; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 12, y + CELL / 2); ctx.lineTo(x + w - 12, y + CELL / 2);
    ctx.stroke(); ctx.globalAlpha = 1;
    // headlights and tail lights
    const hx = dir > 0 ? x + w - 5 : x + 5;
    const tx = dir > 0 ? x + 5 : x + w - 5;
    glow('#fffbd0', 12);
    ctx.fillStyle = '#fffbd0';
    ctx.fillRect(hx - 2, y + 13, 4, 5); ctx.fillRect(hx - 2, y + CELL - 18, 4, 5);
    noGlow();
    ctx.fillStyle = '#ff2255';
    ctx.fillRect(tx - 2, y + 13, 4, 4); ctx.fillRect(tx - 2, y + CELL - 17, 4, 4);
    // headlight beam
    const beam = ctx.createLinearGradient(hx, 0, hx + dir * 34, 0);
    beam.addColorStop(0, 'rgba(255,251,208,0.28)'); beam.addColorStop(1, 'rgba(255,251,208,0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(hx, y + 13); ctx.lineTo(hx + dir * 34, y + 8); ctx.lineTo(hx + dir * 34, y + CELL - 8); ctx.lineTo(hx, y + CELL - 13);
    ctx.closePath(); ctx.fill();
  }

  function drawRail(row, y) {
    ctx.fillStyle = '#090b18';
    ctx.fillRect(0, y, W, CELL);
    ctx.strokeStyle = 'rgba(120,140,200,0.25)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 6; x < W; x += 16) { ctx.moveTo(x, y + 8); ctx.lineTo(x, y + CELL - 8); }
    ctx.stroke();
    glow('#7fa8ff', 8);
    ctx.strokeStyle = '#7fa8ff'; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, y + 15); ctx.lineTo(W, y + 15);
    ctx.moveTo(0, y + CELL - 15); ctx.lineTo(W, y + CELL - 15);
    ctx.stroke();
    noGlow();

    const warn = row.state === 'warn';
    const lampOn = warn && Math.floor(clock * 6) % 2 === 0;
    if (warn) {
      ctx.fillStyle = lampOn ? 'rgba(255,34,85,0.22)' : 'rgba(255,34,85,0.08)';
      ctx.fillRect(0, y, W, CELL);
    }
    // signal lamps on both sides
    const lamps = [[16, y + CELL / 2 - 8], [W - 16, y + CELL / 2 + 8]];
    for (let i = 0; i < 2; i++) {
      const on = warn && ((Math.floor(clock * 6) + i) % 2 === 0);
      if (on) glow('#ff2255', 18);
      ctx.fillStyle = on ? '#ff2255' : '#3b1020';
      ctx.beginPath(); ctx.arc(lamps[i][0], lamps[i][1], 6, 0, Math.PI * 2); ctx.fill();
      noGlow();
    }
    if (warn) {
      ctx.fillStyle = lampOn ? '#ff2255' : '#ff8aa3';
      ctx.font = '700 15px ' + FONT;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('TRAIN INCOMING', W / 2, y + CELL / 2 + 1);
    }

    if (row.state === 'pass') {
      const x = row.trainX * CELL;
      const w = row.trainLen * CELL;
      const dir = row.dir;
      // speed streaks
      ctx.fillStyle = 'rgba(180,210,255,0.12)';
      const sx = dir > 0 ? x - 120 : x + w;
      ctx.fillRect(sx, y + 10, 120, 2); ctx.fillRect(sx, y + CELL - 12, 120, 2);
      const cars = 3;
      const cw = w / cars;
      for (let i = 0; i < cars; i++) {
        const cx0 = x + i * cw + 2;
        glow('#9fc2ff', 14);
        rr(cx0, y + 5, cw - 4, CELL - 10, 8);
        const g = ctx.createLinearGradient(0, y + 5, 0, y + CELL - 5);
        g.addColorStop(0, '#2b3a66'); g.addColorStop(1, '#0f1530');
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = '#bcd4ff'; ctx.lineWidth = 2; ctx.stroke();
        noGlow();
        ctx.fillStyle = '#d8ecff';
        for (let k = 0; k < 6; k++) ctx.fillRect(cx0 + 14 + k * ((cw - 40) / 5), y + 16, 14, 8);
        ctx.fillStyle = '#19f3ff';
        ctx.fillRect(cx0 + 8, y + CELL - 16, cw - 20, 3);
      }
      const hx = dir > 0 ? x + w : x;
      glow('#fffbd0', 24);
      ctx.fillStyle = '#fffbd0';
      ctx.beginPath(); ctx.arc(hx, y + CELL / 2, 6, 0, Math.PI * 2); ctx.fill();
      noGlow();
    }
  }

  function drawRiver(row, y) {
    const g = ctx.createLinearGradient(0, y, 0, y + CELL);
    g.addColorStop(0, '#2a0524'); g.addColorStop(1, '#13031c');
    ctx.fillStyle = g;
    ctx.fillRect(0, y, W, CELL);
    // animated laser streams
    ctx.lineWidth = 2;
    glow('#ff2255', 8);
    for (let k = 0; k < 4; k++) {
      ctx.strokeStyle = k % 2 ? 'rgba(255,43,214,0.7)' : 'rgba(255,34,85,0.7)';
      ctx.setLineDash([26, 14]);
      ctx.lineDashOffset = -clock * 55 * row.dir * (1 + k * 0.15);
      const ly = y + 8 + k * 10.5;
      ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(W, ly); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
    noGlow();

    for (let i = 0; i < row.logs.length; i++) {
      const log = row.logs[i];
      const x = log.x * CELL;
      const w = log.len * CELL;
      if (x > W + 10 || x + w < -10) continue;
      glow('#19f3ff', 14);
      rr(x + 3, y + 7, w - 6, CELL - 14, 10);
      const lg = ctx.createLinearGradient(0, y + 7, 0, y + CELL - 7);
      lg.addColorStop(0, '#1c6c7c'); lg.addColorStop(1, '#0a3a4a');
      ctx.fillStyle = lg; ctx.fill();
      ctx.strokeStyle = '#7dfff0'; ctx.lineWidth = 2; ctx.stroke();
      noGlow();
      ctx.strokeStyle = 'rgba(125,255,240,0.55)';
      ctx.lineWidth = 2;
      for (let s = 0; s < log.len; s++) {
        const cx = x + s * CELL + CELL / 2;
        const d = row.dir * 6;
        ctx.beginPath();
        ctx.moveTo(cx - d, y + CELL / 2 - 7); ctx.lineTo(cx + d, y + CELL / 2); ctx.lineTo(cx - d, y + CELL / 2 + 7);
        ctx.stroke();
        if (s > 0) {
          ctx.strokeStyle = 'rgba(125,255,240,0.25)';
          ctx.beginPath(); ctx.moveTo(x + s * CELL, y + 11); ctx.lineTo(x + s * CELL, y + CELL - 11); ctx.stroke();
          ctx.strokeStyle = 'rgba(125,255,240,0.55)';
        }
      }
    }
  }

  function drawBit(cx, cy, phase) {
    const bob = Math.sin(clock * 3 + phase) * 2.5;
    const sx = Math.max(0.15, Math.abs(Math.cos(clock * 2.2 + phase)));
    ctx.save();
    ctx.translate(cx, cy + bob);
    ctx.scale(sx, 1);
    glow('#ffd84a', 16);
    ctx.fillStyle = '#ffd84a';
    ctx.beginPath();
    ctx.moveTo(0, -10); ctx.lineTo(9, 0); ctx.lineTo(0, 10); ctx.lineTo(-9, 0);
    ctx.closePath(); ctx.fill();
    noGlow();
    ctx.fillStyle = '#fff6c2';
    ctx.beginPath();
    ctx.moveTo(0, -5); ctx.lineTo(4, 0); ctx.lineTo(0, 5); ctx.lineTo(-4, 0);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawPlayer() {
    let sx = player.vx * CELL + CELL / 2;
    const rowY = rowTop(player.vr);
    let lift = 0;
    let scaleX = 1;
    let scaleY = 1;
    if (player.hop) {
      const t = player.hop.t;
      lift = Math.sin(t * Math.PI) * 15;
      scaleY = 1 + 0.18 * Math.sin(t * Math.PI);
      scaleX = 1 - 0.1 * Math.sin(t * Math.PI);
    } else {
      scaleY = 1 + 0.03 * Math.sin(clock * 5);
    }
    if (player.bump > 0) sx += Math.sin(player.bump * 90) * 2;
    const groundY = rowY + CELL - 8;
    let alpha = 1;
    if (state === 'dying' || state === 'over') {
      if (deathKind === 'car') {
        scaleY = 0.22; scaleX = 1.35;
        if (deathT > 0.45) alpha = 0;
      } else {
        alpha = 0;
      }
    }
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.ellipse(sx, groundY + 1, 13 - lift * 0.2, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    if (alpha <= 0) return;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(sx, groundY - lift);
    ctx.scale(scaleX, scaleY);
    // legs
    ctx.fillStyle = '#19f3ff';
    const step = player.hop ? 2 : 0;
    ctx.fillRect(-9, -7, 5, 7 - step);
    ctx.fillRect(4, -7, 5, 7 - step);
    // fins
    glow('#ff2bd6', 8);
    ctx.fillStyle = '#ff2bd6';
    ctx.beginPath(); ctx.moveTo(-12, -24); ctx.lineTo(-19, -33); ctx.lineTo(-8, -28); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(12, -24); ctx.lineTo(19, -33); ctx.lineTo(8, -28); ctx.closePath(); ctx.fill();
    noGlow();
    // body
    glow('#19f3ff', 14);
    rr(-13, -29, 26, 24, 8);
    const bg = ctx.createLinearGradient(0, -29, 0, -5);
    bg.addColorStop(0, '#0f4a63'); bg.addColorStop(1, '#06182a');
    ctx.fillStyle = bg; ctx.fill();
    ctx.strokeStyle = '#7dfff6'; ctx.lineWidth = 2.4; ctx.stroke();
    noGlow();
    // visor
    const vx = player.face * 1.5;
    glow('#ff2bd6', 10);
    rr(-9 + vx, -25, 18, 8, 4);
    ctx.fillStyle = '#ff2bd6'; ctx.fill();
    noGlow();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-5 + vx, -23, 3, 3); ctx.fillRect(2 + vx, -23, 3, 3);
    // chest light
    ctx.fillStyle = '#b6ff3c';
    ctx.fillRect(-5, -13, 10, 3);
    // antenna
    ctx.strokeStyle = '#7dfff6'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -29); ctx.lineTo(0, -36); ctx.stroke();
    glow('#ffd84a', 10);
    ctx.fillStyle = '#ffd84a';
    ctx.beginPath(); ctx.arc(0, -37, 3, 0, Math.PI * 2); ctx.fill();
    noGlow();
    ctx.restore();
  }

  function drawLurker() {
    const y = H - (lurker - cam) * CELL;
    if (y >= H + 20) return;
    const top = Math.min(y, H);
    const g = ctx.createLinearGradient(0, top, 0, top + 170);
    g.addColorStop(0, 'rgba(255,34,85,0.6)');
    g.addColorStop(1, 'rgba(50,0,18,0.92)');
    ctx.fillStyle = g;
    ctx.fillRect(0, top, W, H - top + 2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let yy = top + 4; yy < H; yy += 7) ctx.fillRect(0, yy, W, 2);
    glow('#ff2255', 18);
    ctx.strokeStyle = '#ff5577'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, top); ctx.lineTo(W, top); ctx.stroke();
    noGlow();
    // drone hovering on the scan line
    const dx = W / 2 + Math.sin(clock * 1.6) * W * 0.34;
    const dy = top - 16 + Math.sin(clock * 4) * 2;
    ctx.fillStyle = 'rgba(255,34,85,0.18)';
    ctx.beginPath(); ctx.moveTo(dx, dy + 6); ctx.lineTo(dx - 34, top + 2); ctx.lineTo(dx + 34, top + 2); ctx.closePath(); ctx.fill();
    glow('#ff2255', 14);
    ctx.fillStyle = '#1a0610';
    ctx.strokeStyle = '#ff5577'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 3 * i;
      const px = dx + Math.cos(a) * 14;
      const py = dy + Math.sin(a) * 9;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(dx - 14, dy); ctx.lineTo(dx - 26, dy - 4); ctx.moveTo(dx + 14, dy); ctx.lineTo(dx + 26, dy - 4); ctx.stroke();
    noGlow();
    ctx.fillStyle = '#ff2255';
    ctx.beginPath(); ctx.arc(dx, dy, 4, 0, Math.PI * 2); ctx.fill();
  }

  function drawScene() {
    ctx.fillStyle = '#03040b';
    ctx.fillRect(0, 0, W, H);
    const lo = Math.floor(cam) - 1;
    const hi = Math.ceil(cam) + VIEW_ROWS + 1;
    for (let r = hi; r >= lo; r--) {
      const row = rows[r];
      if (!row) continue;
      const y = rowTop(r);
      if (row.type === 'grass') drawGrass(row, y);
      else if (row.type === 'road') drawRoad(row, y);
      else if (row.type === 'rail') drawRail(row, y);
      else drawRiver(row, y);

      for (let i = 0; i < row.bits.length; i++) {
        const bit = row.bits[i];
        if (bit.taken) continue;
        const bx = bit.log ? bit.log.x + bit.off : bit.col + 0.5;
        drawBit(bx * CELL, y + CELL / 2, bit.phase);
      }
      if (row.type === 'grass') {
        row.pylons.forEach((c) => drawPylon(c * CELL + CELL / 2, y));
      } else if (row.type === 'road') {
        for (let i = 0; i < row.cars.length; i++) {
          const car = row.cars[i];
          if (car.x * CELL > W + 4 || (car.x + car.len) * CELL < -4) continue;
          drawCar(car, y, row.dir);
        }
      }
    }
  }

  function drawOverlayFx() {
    // particles
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      ctx.globalAlpha = clamp(p.life / 0.4, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    // floating texts
    ctx.font = '700 16px ' + FONT;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < floaters.length; i++) {
      const f = floaters[i];
      ctx.globalAlpha = clamp(f.life / 0.5, 0, 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    // drone proximity warning
    if (state === 'playing' || state === 'dying') {
      const gap = player.vr - lurker;
      const prox = clamp(1 - gap / 5, 0, 1);
      if (idle > 1.5 || prox > 0.4) {
        const pulse = 0.5 + 0.5 * Math.sin(clock * 9);
        const a = clamp(prox * 0.5 + (idle > IDLE_GRACE ? 0.2 : 0), 0, 0.7) * (0.6 + 0.4 * pulse);
        const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
        vg.addColorStop(0, 'rgba(255,34,85,0)');
        vg.addColorStop(1, 'rgba(255,34,85,' + a.toFixed(3) + ')');
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, W, H);
      }
      if (state === 'playing' && idle > 1.5) {
        const locked = idle > IDLE_GRACE;
        const on = !locked || Math.floor(clock * 5) % 2 === 0;
        if (on) {
          ctx.fillStyle = 'rgba(40,0,14,0.8)';
          rr(W / 2 - 92, 10, 184, 26, 13); ctx.fill();
          ctx.strokeStyle = '#ff2255'; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.fillStyle = '#ff7a93';
          ctx.font = '700 12px ' + FONT;
          ctx.fillText(locked ? 'SCANNER LOCKED - MOVE' : 'SCANNER WARMING UP', W / 2, 24);
        }
      }
    }
    if (flash > 0) {
      ctx.fillStyle = 'rgba(255,40,90,' + clamp(flash, 0, 0.5).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }
  }

  function draw() {
    ctx.save();
    if (shake > 0 && !reducedMotion()) {
      ctx.translate((Math.random() - 0.5) * 12 * (shake / 0.45), (Math.random() - 0.5) * 12 * (shake / 0.45));
    }
    drawScene();
    if (player) drawPlayer();
    drawLurker();
    drawOverlayFx();
    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /* Main loop                                                           */
  /* ------------------------------------------------------------------ */
  let lastTs = 0;

  function step(dt) {
    if (state === 'playing') {
      updatePlayer(dt);
      updateWorld(dt);
      if (state === 'playing' && player.platform && !player.hop) {
        // re-sync with the log after it moved this frame
        player.x = player.platform.x + player.off;
        player.vx = player.x;
        if (player.x + 0.5 < 0 || player.x + 0.5 > COLS) die('swept');
      }
      checkCollisions();
      if (state === 'playing') updateLurker(dt);
      updateCamera(dt);
      updateEffects(dt);
    } else if (state === 'dying') {
      deathT += dt;
      updateWorld(dt);
      updateEffects(dt);
      if (deathT >= 0.95) showGameOver();
    } else if (state === 'ready') {
      updateWorld(dt);
      updateEffects(dt);
    } else if (state === 'over') {
      updateEffects(dt);
    }
  }

  function frame(ts) {
    window.requestAnimationFrame(frame);
    if (!lastTs) lastTs = ts;
    let dt = (ts - lastTs) / 1000;
    lastTs = ts;
    if (!(dt > 0)) dt = 0;
    dt = Math.min(dt, 0.05);
    clock += dt;
    step(dt);
    draw();
  }

  /* ------------------------------------------------------------------ */
  /* Input                                                               */
  /* ------------------------------------------------------------------ */
  const KEY_MOVES = {
    ArrowUp: [0, 1], KeyW: [0, 1], w: [0, 1], W: [0, 1],
    ArrowDown: [0, -1], KeyS: [0, -1], s: [0, -1], S: [0, -1],
    ArrowLeft: [-1, 0], KeyA: [-1, 0], a: [-1, 0], A: [-1, 0],
    ArrowRight: [1, 0], KeyD: [1, 0], d: [1, 0], D: [1, 0]
  };

  function onKeyDown(e) {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    unlockAudio();
    const key = e.key;
    const onButton = e.target && e.target.tagName === 'BUTTON';

    if (key === 'Escape') {
      e.preventDefault();
      if (helpOpen) closeHelp();
      else togglePause();
      return;
    }
    if (key === 'p' || key === 'P') {
      if (helpOpen) return;
      togglePause();
      return;
    }
    if (key === 'h' || key === 'H' || key === '?') {
      if (helpOpen) closeHelp(); else openHelp();
      return;
    }
    if (helpOpen) return;

    if (key === 'Enter' || key === ' ') {
      if (onButton) return;       // let the focused button handle it
      e.preventDefault();
      if (state === 'ready') startGame();
      else if (state === 'over') restartGame();
      else if (state === 'paused') resumeGame();
      else if (key === ' ' && !e.repeat) requestMove(0, 1);
      return;
    }

    const mv = KEY_MOVES[e.code] || KEY_MOVES[key];
    if (mv) {
      e.preventDefault();
      if (state === 'playing') requestMove(mv[0], mv[1]);
    }
  }

  // Touch / pointer swipes: swipe in four directions, tap = forward.
  const SWIPE_MIN = 22;
  const TAP_MAX = 12;
  let ptr = null;

  canvas.addEventListener('pointerdown', (e) => {
    unlockAudio();
    ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, done: false };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    e.preventDefault();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!ptr || ptr.id !== e.pointerId || ptr.done) return;
    const dx = e.clientX - ptr.x;
    const dy = e.clientY - ptr.y;
    if (Math.hypot(dx, dy) >= SWIPE_MIN) {
      ptr.done = true;
      if (Math.abs(dx) > Math.abs(dy)) requestMove(dx > 0 ? 1 : -1, 0);
      else requestMove(0, dy < 0 ? 1 : -1);
    }
  });

  canvas.addEventListener('pointerup', (e) => {
    if (!ptr || ptr.id !== e.pointerId) return;
    const dx = e.clientX - ptr.x;
    const dy = e.clientY - ptr.y;
    if (!ptr.done && Math.hypot(dx, dy) <= TAP_MAX) requestMove(0, 1);
    ptr = null;
  });

  canvas.addEventListener('pointercancel', () => { ptr = null; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  /* ------------------------------------------------------------------ */
  /* UI wiring                                                           */
  /* ------------------------------------------------------------------ */
  function renderSoundIcons() {
    el.soundOn.classList.toggle('hidden', !soundOn);
    el.soundOff.classList.toggle('hidden', soundOn);
  }

  function bindButton(btn, fn) {
    btn.addEventListener('click', () => {
      unlockAudio();
      fn();
      if (btn.blur && btn !== el.closeHelpBtn) btn.blur();
    });
  }

  bindButton(el.startBtn, startGame);
  bindButton(el.restartBtn, restartGame);
  bindButton(el.resumeBtn, resumeGame);
  bindButton(el.pauseRestartBtn, restartGame);
  bindButton(el.closeHelpBtn, closeHelp);
  bindButton(el.helpBtn, () => { if (helpOpen) closeHelp(); else openHelp(); });
  bindButton(el.startHelp, openHelp);
  bindButton(el.pauseHelp, openHelp);
  bindButton(el.overHelp, openHelp);
  bindButton(el.pauseBtn, togglePause);
  bindButton(el.soundBtn, () => {
    soundOn = !soundOn;
    storeSet(MUTE_KEY, soundOn ? '0' : '1');
    renderSoundIcons();
    if (soundOn) sfx.pickup();
  });

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseGame();
    lastTs = 0;
  });

  /* ------------------------------------------------------------------ */
  /* Boot                                                                */
  /* ------------------------------------------------------------------ */
  renderSoundIcons();
  newGame();
  setOverlay('start');
  window.requestAnimationFrame(frame);

  // Clean audio on teardown (#507)
  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'ARCADEVERSE_TEARDOWN') {
      stopAllAudio();
      if (audio && audio.state !== 'closed') {
        try { audio.close(); } catch (_) {}
      }
    }
  });
})();
