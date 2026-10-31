/*
 * Quantum Lunar Lander - ArcadeVerse
 * Pure vanilla Canvas physics lander: own vector integrator, procedural terrain,
 * particle exhaust and explosions, Web Audio SFX. No libraries.
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Constants                                                           */
  /* ------------------------------------------------------------------ */
  const H = 600;
  // Narrow portrait phones get a taller, narrower playfield so the ship stays readable.
  const W = (function () {
    try {
      if (window.matchMedia('(max-width: 600px) and (orientation: portrait)').matches) return 560;
    } catch (e) { /* ignore */ }
    return 840;
  })();
  const STEP = 1 / 120;            // fixed physics timestep (seconds)
  const MAX_FRAME = 0.1;           // clamp for a single frame delta
  const SEGS = 128;                // terrain segments
  const DX = W / SEGS;             // horizontal spacing of terrain vertices
  const PX_PER_M = 10;             // 10 logical pixels = 1 metre

  // Landing envelope (pixels per second / radians)
  const LIM = { vy: 35, vx: 25, tilt: 12 * Math.PI / 180 };

  // Ship tuning
  const SHIP = {
    thrust: 130,      // px/s^2 at full throttle
    torque: 4.5,     // rad/s^2 from the attitude jets
    maxOmega: 2.2,    // rad/s
    damp: 1.6,        // passive spin settling (1/s)
    burn: 10,         // fuel units per second at full throttle
    spoolUp: 8,
    spoolDown: 5
  };

  // Ship hull in local space (nose up). Used for collision.
  const HULL = [[0, -15], [8, -9], [10, 4], [15, 13], [-15, 13], [-10, 4], [-8, -9]];
  const HULL_CONVEX = [[0, -15], [9, -8], [15, 13], [-15, 13], [-9, -8]];
  const FEET = [[-15, 13], [15, 13]];
  const FOOT_Y = 13;
  const NOZZLE = [0, 9];
  const HULL_SAMPLES = (function () {
    const pts = [];
    for (let i = 0; i < HULL.length; i++) {
      const a = HULL[i];
      const b = HULL[(i + 1) % HULL.length];
      for (let k = 0; k < 4; k++) {
        const t = k / 4;
        pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    return pts;
  })();

  const PAD_DEFS = [
    { mult: 2, w: 112, min: 70, color: '#19e6ff', rgb: '25,230,255' },
    { mult: 3, w: 78, min: 54, color: '#ffb020', rgb: '255,176,32' },
    { mult: 5, w: 52, min: 42, color: '#ff2bd6', rgb: '255,43,214' }
  ];

  const FONT_HEAD = "800 13px Orbitron, 'Segoe UI', system-ui, sans-serif";
  const LS_BEST = 'qll_best_score_v1';
  const LS_SOUND = 'qll_sound_v1';

  /* ------------------------------------------------------------------ */
  /* DOM                                                                 */
  /* ------------------------------------------------------------------ */
  const $ = (id) => document.getElementById(id);
  const canvas = $('game-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;
  $('game-canvas').parentNode.style.setProperty('--ar', String(W / H));

  const el = {
    level: $('hud-level'), lives: $('hud-lives'), score: $('hud-score'), best: $('hud-best'),
    alt: $('hud-alt'), vs: $('hud-vs'), hs: $('hud-hs'), tilt: $('hud-tilt'),
    vsArrow: $('vs-arrow'), vsBar: $('vs-bar'), hsBar: $('hs-bar'), tiltBar: $('tilt-bar'),
    cardVs: $('card-vs'), cardHs: $('card-hs'), cardTilt: $('card-tilt'),
    fuelRow: $('fuel-row'), fuelFill: $('fuel-fill'), fuelText: $('fuel-text'), fuelTrack: $('fuel-track'),
    start: $('start-overlay'), pause: $('pause-overlay'), land: $('land-overlay'),
    crash: $('crash-overlay'), over: $('over-overlay'), help: $('help-modal'),
    pauseBtn: $('pause-btn'), pauseIcon: $('pause-icon'), playIcon: $('play-icon'),
    soundBtn: $('sound-btn'), soundOn: $('sound-icon-on'), soundOff: $('sound-icon-off'),
    helpBtn: $('help-btn')
  };

  /* ------------------------------------------------------------------ */
  /* Utilities                                                           */
  /* ------------------------------------------------------------------ */
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const TAU = Math.PI * 2;

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function mixSeed(run, level) {
    let h = (run ^ Math.imul(level, 0x9E3779B1)) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x85EBCA6B) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0xC2B2AE35) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
  }

  function wrapAngle(a) {
    while (a > Math.PI) a -= TAU;
    while (a < -Math.PI) a += TAU;
    return a;
  }

  function storeGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function storeSet(key, val) {
    try { window.localStorage.setItem(key, String(val)); } catch (e) { /* storage unavailable */ }
  }

  let reduceMotion = false;
  try {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reduceMotion = !!(mq && mq.matches);
    if (mq && mq.addEventListener) mq.addEventListener('change', (e) => { reduceMotion = e.matches; });
  } catch (e) { /* ignore */ }

  /* ------------------------------------------------------------------ */
  /* Level generation                                                    */
  /* ------------------------------------------------------------------ */
  function levelConfig(n) {
    return {
      gravity: Math.min(70, 34 + 4 * (n - 1)),                  // px/s^2
      fuel: Math.max(70, 100 - 4 * (n - 1)),
      padScale: Math.max(0.6, 1 - 0.06 * (n - 1)),
      rough: Math.min(1, 0.55 + 0.05 * n),
      well: n >= 3 ? Math.min(1, 0.4 + 0.15 * (n - 3)) : 0,    // anomaly strength
      drift: Math.min(55, 16 + 4 * n),
      tiltStart: Math.min(0.5, 0.04 * n)
    };
  }

  function genHeights(rng, rough) {
    const h = new Array(SEGS + 1).fill(0);
    h[0] = H * (0.68 + rng() * 0.14);
    h[SEGS] = H * (0.68 + rng() * 0.14);
    let amp = H * 0.3 * rough;
    for (let step = SEGS; step > 1; step >>= 1) {
      const half = step >> 1;
      for (let i = half; i < SEGS; i += step) {
        h[i] = (h[i - half] + h[i + half]) / 2 + (rng() * 2 - 1) * amp;
      }
      amp *= 0.56;
    }
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i <= SEGS; i++) { lo = Math.min(lo, h[i]); hi = Math.max(hi, h[i]); }
    const target = H * 0.44;
    const mid = (lo + hi) / 2;
    const scale = hi - lo > target ? target / (hi - lo) : 1;
    for (let i = 0; i <= SEGS; i++) h[i] = mid + (h[i] - mid) * scale;
    let shift = 0;
    const nlo = mid + (lo - mid) * scale;
    const nhi = mid + (hi - mid) * scale;
    if (nlo < H * 0.5) shift = H * 0.5 - nlo;
    if (nhi + shift > H * 0.94) shift = H * 0.94 - nhi;
    for (let i = 0; i <= SEGS; i++) h[i] = clamp(h[i] + shift, H * 0.5, H * 0.95);
    return h;
  }

  function buildLevel(n, runSeed) {
    const cfg = levelConfig(n);
    const seed = mixSeed(runSeed, n);
    const rng = mulberry32(seed);
    const T = genHeights(rng, cfg.rough);

    // Landing pads: one per third of the map, in shuffled multiplier order.
    const defs = PAD_DEFS.slice();
    for (let i = defs.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = defs[i]; defs[i] = defs[j]; defs[j] = t;
    }
    const zones = [[3, 40], [45, 82], [87, 124]];
    const pads = [];
    for (let z = 0; z < 3; z++) {
      const d = defs[z];
      const width = Math.max(d.min, d.w * cfg.padScale);
      const segs = Math.ceil(width / DX);
      const zs = zones[z][0];
      const ze = zones[z][1];
      const i0 = zs + Math.floor(rng() * Math.max(1, ze - zs - segs));
      const i1 = i0 + segs;
      let sum = 0;
      for (let i = i0; i <= i1; i++) sum += T[i];
      const y = clamp(sum / (i1 - i0 + 1), H * 0.64, H * 0.9);
      for (let i = i0; i <= i1; i++) T[i] = y;
      pads.push({ mult: d.mult, color: d.color, rgb: d.rgb, i0: i0, i1: i1, x0: i0 * DX, x1: i1 * DX, y: y });
    }
    pads.sort((a, b) => a.x0 - b.x0);

    // Spawn
    const spawn = {
      x: 130 + rng() * (W - 260),
      y: 70,
      vx: (rng() * 2 - 1) * cfg.drift,
      a: (rng() * 2 - 1) * cfg.tiltStart
    };

    // Gravity anomaly
    let well = null;
    if (cfg.well > 0) {
      let wx = 0, wy = 0;
      for (let tries = 0; tries < 30; tries++) {
        wx = 150 + rng() * (W - 300);
        wy = 150 + rng() * 150;
        if (Math.abs(wx - spawn.x) > W * 0.26 && groundAt(T, wx) - wy > 150) break;
      }
      well = { x: wx, y: wy, k: 280000 * cfg.well, soft: 60 };
    }

    // Decor
    const srng = mulberry32(seed ^ 0xA5A5A5);
    const stars = [];
    for (let i = 0; i < 140; i++) {
      stars.push({ x: srng() * W, y: srng() * H * 0.85, r: 0.4 + srng() * 1.3, p: srng() * TAU, s: 0.6 + srng() * 2 });
    }
    const planet = {
      x: srng() * W, y: 90 + srng() * 90, r: 70 + srng() * 70,
      hue: [270, 300, 200, 330][Math.floor(srng() * 4)],
      ring: srng() > 0.4
    };

    const level = { n: n, cfg: cfg, seed: seed, T: T, pads: pads, spawn: spawn, well: well, stars: stars, planet: planet };
    level.bgLayer = renderBgLayer(level);
    level.terrainLayer = renderTerrainLayer(level);
    return level;
  }

  function groundAt(T, x) {
    if (x <= 0) return T[0];
    if (x >= W) return T[SEGS];
    const f = x / DX;
    const i = Math.floor(f);
    const t = f - i;
    return T[i] + (T[i + 1] - T[i]) * t;
  }

  function makeLayer() {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    return c;
  }

  function renderBgLayer(level) {
    const c = makeLayer();
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#04051a');
    grad.addColorStop(0.55, '#0b0a2a');
    grad.addColorStop(1, '#1a0b33');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);

    const p = level.planet;
    const pg = g.createRadialGradient(p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.1, p.x, p.y, p.r);
    pg.addColorStop(0, 'hsla(' + p.hue + ',70%,45%,0.55)');
    pg.addColorStop(1, 'hsla(' + p.hue + ',70%,10%,0.5)');
    g.save();
    g.shadowColor = 'hsla(' + p.hue + ',90%,60%,0.8)';
    g.shadowBlur = 40;
    g.fillStyle = pg;
    g.beginPath();
    g.arc(p.x, p.y, p.r, 0, TAU);
    g.fill();
    g.restore();
    if (p.ring) {
      g.save();
      g.translate(p.x, p.y);
      g.rotate(-0.35);
      g.strokeStyle = 'hsla(' + p.hue + ',80%,70%,0.45)';
      g.lineWidth = 3;
      g.beginPath();
      g.ellipse(0, 0, p.r * 1.7, p.r * 0.38, 0, 0, TAU);
      g.stroke();
      g.restore();
    }
    // horizon haze
    const hz = g.createLinearGradient(0, H * 0.55, 0, H);
    hz.addColorStop(0, 'rgba(139,123,255,0)');
    hz.addColorStop(1, 'rgba(255,43,214,0.12)');
    g.fillStyle = hz;
    g.fillRect(0, H * 0.55, W, H * 0.45);
    return c;
  }

  function renderTerrainLayer(level) {
    const c = makeLayer();
    const g = c.getContext('2d');
    const T = level.T;
    // fill
    const fill = g.createLinearGradient(0, H * 0.45, 0, H);
    fill.addColorStop(0, '#1f1d52');
    fill.addColorStop(1, '#0a0a24');
    g.fillStyle = fill;
    g.beginPath();
    g.moveTo(0, H);
    for (let i = 0; i <= SEGS; i++) g.lineTo(i * DX, T[i]);
    g.lineTo(W, H);
    g.closePath();
    g.fill();

    // hatching under the surface
    g.strokeStyle = 'rgba(139,123,255,0.16)';
    g.lineWidth = 1;
    g.beginPath();
    for (let i = 1; i < SEGS; i += 2) {
      const x = i * DX;
      g.moveTo(x, T[i] + 6);
      g.lineTo(x, T[i] + 16 + ((i * 7) % 5) * 5);
    }
    g.stroke();

    // glowing surface line
    const path = () => {
      g.beginPath();
      g.moveTo(0, T[0]);
      for (let i = 1; i <= SEGS; i++) g.lineTo(i * DX, T[i]);
    };
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(139,123,255,0.14)';
    g.lineWidth = 9;
    path(); g.stroke();
    g.strokeStyle = 'rgba(139,123,255,0.35)';
    g.lineWidth = 4;
    path(); g.stroke();
    g.strokeStyle = '#a99dff';
    g.lineWidth = 1.8;
    path(); g.stroke();

    // pads
    level.pads.forEach((p) => {
      g.fillStyle = 'rgba(' + p.rgb + ',0.16)';
      g.fillRect(p.x0, p.y, p.x1 - p.x0, 10);
      g.lineCap = 'butt';
      g.strokeStyle = 'rgba(' + p.rgb + ',0.22)';
      g.lineWidth = 10;
      g.beginPath(); g.moveTo(p.x0, p.y); g.lineTo(p.x1, p.y); g.stroke();
      g.strokeStyle = 'rgba(' + p.rgb + ',0.5)';
      g.lineWidth = 5;
      g.beginPath(); g.moveTo(p.x0, p.y); g.lineTo(p.x1, p.y); g.stroke();
      g.strokeStyle = p.color;
      g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(p.x0, p.y); g.lineTo(p.x1, p.y); g.stroke();
    });
    return c;
  }

  /* ------------------------------------------------------------------ */
  /* Game state                                                          */
  /* ------------------------------------------------------------------ */
  let state = 'menu';       // menu | playing | paused | landed | crashed | over
  let runSeed = (Math.random() * 4294967296) >>> 0;
  let level = null;
  let levelNo = 1;
  let score = 0;
  let lives = 3;
  let cleared = 0;
  let bestScore = parseInt(storeGet(LS_BEST), 10) || 0;
  let newRecord = false;

  const ship = { x: 0, y: 0, vx: 0, vy: 0, a: 0, w: 0, throttle: 0, fuel: 100, fuelMax: 100, dead: false };
  let particles = [];
  let flameCarry = 0;
  let crater = null;
  let rings = [];
  let flash = 0;
  let shake = 0;
  let banner = null;
  let endTimer = 0;
  let pendingResult = null;
  let helpResume = false;
  let lastFocus = null;
  let acc = 0;
  let lastTs = 0;
  let timeAlive = 0;
  let fuelWarned = false;
  let nextBeep = 0;
  let wasEmpty = false;

  const keys = { left: false, right: false, thrust: false };
  const touch = { left: false, right: false, thrust: false };

  function loadLevel(n) {
    levelNo = n;
    level = buildLevel(n, runSeed);
    resetShip();
    particles = [];
    rings = [];
    crater = null;
    flash = 0;
    shake = 0;
    flameCarry = 0;
    fuelWarned = false;
    wasEmpty = false;
    banner = null;
  }

  function resetShip() {
    const s = level.spawn;
    ship.x = s.x;
    ship.y = s.y;
    ship.vx = s.vx;
    ship.vy = 0;
    ship.a = s.a;
    ship.w = 0;
    ship.throttle = 0;
    ship.fuelMax = level.cfg.fuel;
    ship.fuel = ship.fuelMax;
    ship.dead = false;
  }

  function newRun() {
    runSeed = (Math.random() * 4294967296) >>> 0;
    score = 0;
    lives = 3;
    cleared = 0;
    newRecord = false;
    loadLevel(1);
  }

  function startPlaying() {
    hideAllOverlays();
    state = 'playing';
    acc = 0;
    lastTs = 0;
    timeAlive = 0;
    nextBeep = 0;
    const g = (level.cfg.gravity / PX_PER_M).toFixed(1);
    banner = {
      text: 'LEVEL ' + levelNo,
      sub: 'Gravity ' + g + ' m/s2   Fuel ' + Math.round(level.cfg.fuel) + (level.well ? '   Anomaly detected' : ''),
      t: 2.6, max: 2.6
    };
    syncPauseButton();
    updateHud(true);
  }

  /* ------------------------------------------------------------------ */
  /* Overlay / modal management                                          */
  /* ------------------------------------------------------------------ */
  function hideAllOverlays() {
    [el.start, el.pause, el.land, el.crash, el.over].forEach((o) => o.classList.add('hidden'));
  }

  function showOverlay(o, focusId) {
    hideAllOverlays();
    o.classList.remove('hidden');
    clearInputs();
    const f = $(focusId);
    if (f) { try { f.focus({ preventScroll: true }); } catch (e) { f.focus(); } }
  }

  function syncPauseButton() {
    const paused = state === 'paused';
    el.pauseIcon.classList.toggle('hidden', paused);
    el.playIcon.classList.toggle('hidden', !paused);
  }

  function pauseGame() {
    if (state !== 'playing') return;
    state = 'paused';
    syncPauseButton();
    showOverlay(el.pause, 'resume-btn');
  }

  function resumeGame() {
    if (state !== 'paused') return;
    el.pause.classList.add('hidden');
    state = 'playing';
    acc = 0;
    lastTs = 0;
    syncPauseButton();
    ensureAudioRunning();
  }

  function openHelp() {
    if (!el.help.classList.contains('hidden')) return;
    lastFocus = document.activeElement;
    if (state === 'playing') {
      state = 'paused';
      helpResume = true;
      syncPauseButton();
    }
    clearInputs();
    el.help.classList.remove('hidden');
    $('help-done').focus();
  }

  function closeHelp() {
    if (el.help.classList.contains('hidden')) return;
    el.help.classList.add('hidden');
    if (helpResume) {
      helpResume = false;
      state = 'playing';
      acc = 0;
      lastTs = 0;
      syncPauseButton();
    }
    if (lastFocus && lastFocus.focus && !lastFocus.closest('.hidden')) {
      try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Audio (Web Audio, procedural, created after a user gesture)         */
  /* ------------------------------------------------------------------ */
  let soundOn = storeGet(LS_SOUND) !== '0';
  let actx = null;
  let master = null;
  let rumbleGain = null;
  let rumbleFilter = null;

  function initAudio() {
    if (actx) { ensureAudioRunning(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      actx = new AC();
      master = actx.createGain();
      master.gain.value = soundOn ? 0.7 : 0;
      master.connect(actx.destination);

      // looping brown noise for the engine rumble
      const len = actx.sampleRate * 2;
      const buf = actx.createBuffer(1, len, actx.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        d[i] = last * 3.5;
      }
      const src = actx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      rumbleFilter = actx.createBiquadFilter();
      rumbleFilter.type = 'lowpass';
      rumbleFilter.frequency.value = 160;
      rumbleGain = actx.createGain();
      rumbleGain.gain.value = 0;
      src.connect(rumbleFilter);
      rumbleFilter.connect(rumbleGain);
      rumbleGain.connect(master);
      src.start();
    } catch (e) {
      actx = null;
    }
  }

  function ensureAudioRunning() {
    if (actx && actx.state === 'suspended') {
      try { actx.resume(); } catch (e) { /* ignore */ }
    }
  }

  function setRumble(level01) {
    if (!actx || !rumbleGain) return;
    const t = actx.currentTime;
    try {
      rumbleGain.gain.setTargetAtTime(soundOn ? level01 * 0.9 : 0, t, 0.06);
      rumbleFilter.frequency.setTargetAtTime(140 + level01 * 520, t, 0.08);
    } catch (e) { /* ignore */ }
  }

  function tone(freq, start, dur, type, vol) {
    if (!actx || !soundOn) return;
    const t0 = actx.currentTime + start;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  function sfxLand(mult) {
    if (!actx || !soundOn) return;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    const count = mult >= 5 ? 5 : mult >= 3 ? 4 : 3;
    for (let i = 0; i < count; i++) tone(notes[i], i * 0.11, 0.5, 'triangle', 0.22);
    tone(notes[count - 1] / 2, 0, 0.7, 'sine', 0.12);
  }

  function sfxCrash() {
    if (!actx || !soundOn) return;
    const t0 = actx.currentTime;
    const len = Math.floor(actx.sampleRate * 1.1);
    const buf = actx.createBuffer(1, len, actx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const src = actx.createBufferSource();
    src.buffer = buf;
    const f = actx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(2400, t0);
    f.frequency.exponentialRampToValueAtTime(110, t0 + 1.0);
    const g = actx.createGain();
    g.gain.setValueAtTime(0.9, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 1.1);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t0);
    const o = actx.createOscillator();
    const og = actx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(110, t0);
    o.frequency.exponentialRampToValueAtTime(32, t0 + 0.6);
    og.gain.setValueAtTime(0.7, t0);
    og.gain.exponentialRampToValueAtTime(0.001, t0 + 0.7);
    o.connect(og);
    og.connect(master);
    o.start(t0);
    o.stop(t0 + 0.8);
  }

  function setSound(on) {
    soundOn = on;
    storeSet(LS_SOUND, on ? '1' : '0');
    el.soundOn.classList.toggle('hidden', !on);
    el.soundOff.classList.toggle('hidden', on);
    el.soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (master && actx) {
      try { master.gain.setTargetAtTime(on ? 0.7 : 0, actx.currentTime, 0.02); } catch (e) { /* ignore */ }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Input                                                               */
  /* ------------------------------------------------------------------ */
  function clearInputs() {
    keys.left = keys.right = keys.thrust = false;
    touch.left = touch.right = touch.thrust = false;
    ['btn-left', 'btn-right', 'btn-thrust'].forEach((id) => $(id).classList.remove('active'));
  }

  const KEYMAP = {
    ArrowUp: 'thrust', w: 'thrust', W: 'thrust',
    ArrowLeft: 'left', a: 'left', A: 'left',
    ArrowRight: 'right', d: 'right', D: 'right'
  };

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const helpOpen = !el.help.classList.contains('hidden');

    if (e.key === 'Escape') {
      e.preventDefault();
      if (helpOpen) closeHelp();
      else if (state === 'playing') pauseGame();
      else if (state === 'paused') resumeGame();
      return;
    }
    if ((e.key === 'p' || e.key === 'P') && !helpOpen) {
      if (state === 'playing') pauseGame();
      else if (state === 'paused') resumeGame();
      return;
    }
    const k = KEYMAP[e.key];
    if (k) {
      if (state === 'playing' && !helpOpen) {
        e.preventDefault();
        keys[k] = true;
        initAudio();
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    const k = KEYMAP[e.key];
    if (k) keys[k] = false;
  });

  window.addEventListener('blur', () => {
    clearInputs();
    if (state === 'playing') pauseGame();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearInputs();
      if (state === 'playing') pauseGame();
    }
    lastTs = 0;
  });

  function bindHold(id, key) {
    const b = $(id);
    const press = (e) => {
      e.preventDefault();
      touch[key] = true;
      b.classList.add('active');
      try { b.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      initAudio();
    };
    const release = () => {
      touch[key] = false;
      b.classList.remove('active');
    };
    b.addEventListener('pointerdown', press);
    b.addEventListener('pointerup', release);
    b.addEventListener('pointercancel', release);
    b.addEventListener('lostpointercapture', release);
    b.addEventListener('pointerleave', (e) => {
      let captured = false;
      try { captured = b.hasPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      if (!captured) release();
    });
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    // keyboard activation of the buttons (Enter/Space) does nothing on purpose
    b.addEventListener('click', (e) => e.preventDefault());
  }
  bindHold('btn-left', 'left');
  bindHold('btn-right', 'right');
  bindHold('btn-thrust', 'thrust');

  $('start-btn').addEventListener('click', () => {
    initAudio();
    newRun();
    startPlaying();
  });
  $('start-help-btn').addEventListener('click', openHelp);
  $('pause-help-btn').addEventListener('click', openHelp);
  $('resume-btn').addEventListener('click', resumeGame);
  $('next-btn').addEventListener('click', () => {
    initAudio();
    loadLevel(levelNo + 1);
    startPlaying();
  });
  $('retry-btn').addEventListener('click', () => {
    initAudio();
    loadLevel(levelNo);
    startPlaying();
  });
  $('restart-btn').addEventListener('click', () => {
    initAudio();
    newRun();
    startPlaying();
  });
  el.helpBtn.addEventListener('click', openHelp);
  $('help-close').addEventListener('click', closeHelp);
  $('help-done').addEventListener('click', closeHelp);
  el.help.addEventListener('pointerdown', (e) => { if (e.target === el.help) closeHelp(); });
  el.pauseBtn.addEventListener('click', () => {
    if (state === 'playing') pauseGame();
    else if (state === 'paused' && el.help.classList.contains('hidden')) resumeGame();
  });
  el.soundBtn.addEventListener('click', () => {
    initAudio();
    setSound(!soundOn);
  });

  // Keep Tab focus inside the manual while it is open.
  el.help.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const f = el.help.querySelectorAll('button');
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ------------------------------------------------------------------ */
  /* Physics                                                             */
  /* ------------------------------------------------------------------ */
  function wellAccel(w, x, y, out) {
    const dx = w.x - x;
    const dy = w.y - y;
    const d2 = dx * dx + dy * dy;
    const f = w.k / Math.pow(d2 + w.soft * w.soft, 1.5);
    out[0] = dx * f;
    out[1] = dy * f;
  }

  const _wa = [0, 0];

  function toWorld(px, py, x, y, a) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return [x + px * c - py * s, y + px * s + py * c];
  }

  function padAtX(x) {
    const ps = level.pads;
    for (let i = 0; i < ps.length; i++) {
      if (x >= ps[i].x0 - 0.01 && x <= ps[i].x1 + 0.01) return ps[i];
    }
    return null;
  }

  function findContacts() {
    const T = level.T;
    const out = [];
    const a = ship.a;
    // hull sample points vs terrain surface
    for (let i = 0; i < HULL_SAMPLES.length; i++) {
      const p = toWorld(HULL_SAMPLES[i][0], HULL_SAMPLES[i][1], ship.x, ship.y, a);
      if (p[0] < 0 || p[0] > W) continue;
      if (p[1] >= groundAt(T, p[0])) out.push({ x: p[0], y: p[1], pad: padAtX(p[0]) });
    }
    // jagged peaks poking inside the hull
    const c = Math.cos(a);
    const s = Math.sin(a);
    const i0 = Math.max(0, Math.floor((ship.x - 24) / DX));
    const i1 = Math.min(SEGS, Math.ceil((ship.x + 24) / DX));
    for (let i = i0; i <= i1; i++) {
      const wx = i * DX - ship.x;
      const wy = T[i] - ship.y;
      // world -> local (inverse rotation)
      const lx = wx * c + wy * s;
      const ly = -wx * s + wy * c;
      if (insideConvex(lx, ly)) out.push({ x: i * DX, y: T[i], pad: padAtX(i * DX) });
    }
    return out;
  }

  function insideConvex(px, py) {
    let sign = 0;
    const n = HULL_CONVEX.length;
    for (let i = 0; i < n; i++) {
      const a = HULL_CONVEX[i];
      const b = HULL_CONVEX[(i + 1) % n];
      const cr = (b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]);
      if (Math.abs(cr) < 0.02) return false; // on an edge counts as outside
      const sg = cr > 0 ? 1 : -1;
      if (sign === 0) sign = sg;
      else if (sg !== sign) return false;
    }
    return true;
  }

  function stepPhysics(dt) {
    const cfg = level.cfg;
    const left = keys.left || touch.left;
    const right = keys.right || touch.right;
    const thrustIn = keys.thrust || touch.thrust;

    // attitude: angular velocity with inertia and gentle settling
    const dir = (right ? 1 : 0) - (left ? 1 : 0);
    if (dir !== 0) ship.w += dir * SHIP.torque * dt;
    else ship.w *= Math.exp(-SHIP.damp * dt);
    ship.w = clamp(ship.w, -SHIP.maxOmega, SHIP.maxOmega);
    ship.a = wrapAngle(ship.a + ship.w * dt);

    // throttle spool
    const want = thrustIn && ship.fuel > 0 ? 1 : 0;
    ship.throttle += clamp(want - ship.throttle, -SHIP.spoolDown * dt, SHIP.spoolUp * dt);

    // forces
    let ax = 0;
    let ay = cfg.gravity;
    if (ship.fuel > 0 && ship.throttle > 0) {
      const acc2 = SHIP.thrust * ship.throttle;
      ax += Math.sin(ship.a) * acc2;
      ay -= Math.cos(ship.a) * acc2;
      ship.fuel = Math.max(0, ship.fuel - SHIP.burn * ship.throttle * dt);
    }
    if (level.well) {
      wellAccel(level.well, ship.x, ship.y, _wa);
      ax += _wa[0];
      ay += _wa[1];
    }

    // semi-implicit Euler
    ship.vx += ax * dt;
    ship.vy += ay * dt;
    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;

    // containment field at the sides and ceiling
    if (ship.x < 14) { ship.x = 14; if (ship.vx < 0) ship.vx = 0; ship.w *= 0.9; }
    if (ship.x > W - 14) { ship.x = W - 14; if (ship.vx > 0) ship.vx = 0; ship.w *= 0.9; }
    if (ship.y < -260) { ship.y = -260; if (ship.vy < 0) ship.vy = 0; }

    // fuel events
    if (ship.fuel <= 0 && !wasEmpty) {
      wasEmpty = true;
      banner = { text: 'OUT OF FUEL', sub: 'Engine offline', t: 2.2, max: 2.2, color: '#ff4560' };
    }

    // collision
    const contacts = findContacts();
    if (contacts.length) resolveContact(contacts);
  }

  function evaluateLanding(contacts) {
    const reasons = [];
    const vyD = ship.vy;
    const vxD = Math.abs(ship.vx);
    const tilt = Math.abs(ship.a);
    const rock = contacts.some((c) => !c.pad);
    const pad = contacts[0].pad;
    const samePad = pad && contacts.every((c) => c.pad === pad);

    if (rock) reasons.push('The hull struck rocky terrain.');
    if (samePad) {
      const fx = FEET.map((f) => toWorld(f[0], f[1], ship.x, ship.y, ship.a)[0]);
      const onPad = fx.every((x) => x >= pad.x0 - 0.5 && x <= pad.x1 + 0.5);
      if (!onPad) reasons.push('Landing gear missed the pad.');
    }
    if (vyD > LIM.vy) reasons.push('Vertical speed ' + (vyD / PX_PER_M).toFixed(1) + ' m/s is over the ' + (LIM.vy / PX_PER_M).toFixed(1) + ' limit.');
    if (vxD > LIM.vx) reasons.push('Horizontal speed ' + (vxD / PX_PER_M).toFixed(1) + ' m/s is over the ' + (LIM.vx / PX_PER_M).toFixed(1) + ' limit.');
    if (tilt > LIM.tilt) reasons.push('Tilt of ' + Math.round(tilt * 180 / Math.PI) + ' degrees is over the ' + Math.round(LIM.tilt * 180 / Math.PI) + ' degree limit.');
    return { ok: reasons.length === 0, reasons: reasons, pad: samePad ? pad : null };
  }

  function resolveContact(contacts) {
    const res = evaluateLanding(contacts);
    if (res.ok) landShip(res.pad);
    else crashShip(contacts, res.reasons);
  }

  /* ------------------------------------------------------------------ */
  /* Landing / crash outcomes                                            */
  /* ------------------------------------------------------------------ */
  function landShip(pad) {
    const vy = ship.vy;
    const soft = Math.round((1 - clamp(vy / LIM.vy, 0, 1)) * 50);
    const base = 100 + 25 * (levelNo - 1);
    const landScore = (base + soft) * pad.mult;
    const fuelBonus = Math.floor(ship.fuel) * 2;
    const total = landScore + fuelBonus;
    score += total;
    cleared += 1;
    let bonusLife = false;
    if (levelNo % 3 === 0 && lives < 5) { lives += 1; bonusLife = true; }
    saveBest();

    // settle the ship on the pad
    ship.y = pad.y - FOOT_Y;
    ship.a = 0;
    ship.vx = ship.vy = ship.w = 0;
    ship.throttle = 0;

    state = 'landed';
    const px = ship.x;
    burst(px, pad.y - 2, 40, [[61, 255, 154], [25, 230, 255], [255, 255, 255]], 160, 0.9, 'spark');
    rings.push({ x: px, y: pad.y, r: 8, max: 120, t: 0, life: 0.8, color: '61,255,154' });
    banner = { text: pad.mult + 'X LANDING', sub: '+' + total + ' points', t: 2.2, max: 2.2, color: '#3dff9a' };
    sfxLand(pad.mult);

    pendingResult = { type: 'land', vy: vy, pad: pad, soft: soft, landScore: landScore, fuelBonus: fuelBonus, total: total, bonusLife: bonusLife };
    endTimer = 1.1;
    updateHud(true);
  }

  function crashShip(contacts, reasons) {
    state = 'crashed';
    ship.dead = true;
    ship.throttle = 0;
    lives -= 1;
    saveBest();

    // impact point: lowest contact
    let c = contacts[0];
    for (let i = 1; i < contacts.length; i++) if (contacts[i].y > c.y) c = contacts[i];
    const ix = c.x;
    const iy = Math.min(c.y, groundAt(level.T, c.x));

    burst(ix, iy - 4, 110, [[255, 245, 200], [255, 160, 40], [255, 69, 96], [255, 43, 214]], 300, 1.4, 'spark');
    burst(ix, iy - 4, 40, [[140, 140, 170], [90, 90, 120]], 120, 1.6, 'dust');
    // ship debris
    for (let i = 0; i < 9; i++) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const sp = 70 + Math.random() * 190;
      particles.push({
        type: 'debris', x: ix, y: iy - 6,
        vx: Math.cos(ang) * sp + ship.vx * 0.2, vy: Math.sin(ang) * sp - 30,
        rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 12,
        len: 6 + Math.random() * 10, life: 2.2 + Math.random(), max: 3, r: 1
      });
    }
    rings.push({ x: ix, y: iy, r: 6, max: 110, t: 0, life: 0.55, color: '255,160,40' });
    crater = { x: ix, y: iy, r: 0, max: 18 + Math.min(14, ship.vy / 12), t: 0 };
    flash = reduceMotion ? 0 : 0.5;
    shake = reduceMotion ? 0 : 14;
    sfxCrash();

    pendingResult = { type: 'crash', reasons: reasons.length ? reasons : ['Structural failure.'] };
    endTimer = 1.5;
    updateHud(true);
  }

  function saveBest() {
    if (score > bestScore) {
      bestScore = score;
      newRecord = cleared > 0 || score > 0;
      storeSet(LS_BEST, bestScore);
    }
  }

  function finishRound() {
    const r = pendingResult;
    pendingResult = null;
    if (!r) return;
    if (r.type === 'land') {
      $('land-sub').textContent = 'Smooth touchdown at ' + (r.vy / PX_PER_M).toFixed(1) + ' m/s on level ' + levelNo + '.';
      $('land-mult').textContent = r.pad.mult + 'x';
      $('land-base').textContent = '+' + r.landScore;
      $('land-fuel').textContent = '+' + r.fuelBonus;
      $('land-total').textContent = '+' + r.total;
      $('land-life').classList.toggle('hidden', !r.bonusLife);
      showOverlay(el.land, 'next-btn');
    } else if (lives > 0) {
      $('crash-reason').textContent = r.reasons.slice(0, 2).join(' ');
      $('crash-lives').textContent = 'Ships remaining: ' + lives;
      showOverlay(el.crash, 'retry-btn');
    } else {
      state = 'over';
      $('over-reason').textContent = r.reasons.slice(0, 2).join(' ');
      $('over-score').textContent = String(score);
      $('over-levels').textContent = String(cleared);
      $('over-best').textContent = String(bestScore);
      $('over-record').classList.toggle('hidden', !newRecord);
      showOverlay(el.over, 'restart-btn');
    }
    updateHud(true);
  }

  /* ------------------------------------------------------------------ */
  /* Particles                                                           */
  /* ------------------------------------------------------------------ */
  const MAX_PARTICLES = 1200;

  function burst(x, y, count, colors, speed, life, type) {
    for (let i = 0; i < count; i++) {
      if (particles.length >= MAX_PARTICLES) break;
      const ang = Math.random() * TAU;
      const up = type === 'dust' ? 0.5 : 1;
      const sp = speed * (0.15 + Math.random() * 0.85);
      const col = colors[(Math.random() * colors.length) | 0];
      particles.push({
        type: type, x: x, y: y,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp * up - (type === 'dust' ? 20 : 40),
        life: life * (0.4 + Math.random() * 0.6), max: life,
        r: type === 'dust' ? 3 + Math.random() * 4 : 1.5 + Math.random() * 2.5,
        c: col
      });
    }
  }

  function emitExhaust(dt) {
    if (ship.dead || ship.throttle < 0.04) { flameCarry = 0; return; }
    const rate = 260 * ship.throttle;
    flameCarry += rate * dt;
    const n = Math.floor(flameCarry);
    flameCarry -= n;
    const a = ship.a;
    const dx = -Math.sin(a);
    const dy = Math.cos(a);       // exhaust direction (away from nose)
    const px = -dy;
    const py = dx;
    const nz = toWorld(NOZZLE[0], NOZZLE[1], ship.x, ship.y, a);
    for (let i = 0; i < n; i++) {
      if (particles.length >= MAX_PARTICLES) break;
      const sp = 200 + Math.random() * 120;
      const side = (Math.random() - 0.5) * 70;
      particles.push({
        type: 'flame', x: nz[0] + px * (Math.random() - 0.5) * 6, y: nz[1] + py * (Math.random() - 0.5) * 6,
        vx: ship.vx * 0.35 + dx * sp + px * side, vy: ship.vy * 0.35 + dy * sp + py * side,
        life: 0.22 + Math.random() * 0.3, max: 0.5, r: 2.2 + Math.random() * 2.4
      });
    }
    // dust kicked up near the ground
    const alt = groundAt(level.T, ship.x) - (ship.y + FOOT_Y);
    if (alt < 80 && ship.throttle > 0.3 && Math.random() < 0.6 * (1 - alt / 80) * 60 * dt) {
      const gx = ship.x + (Math.random() - 0.5) * 20;
      const dir = Math.random() < 0.5 ? -1 : 1;
      particles.push({
        type: 'dust', x: gx, y: groundAt(level.T, gx) - 2,
        vx: dir * (60 + Math.random() * 140), vy: -(10 + Math.random() * 40),
        life: 0.7, max: 0.7, r: 2 + Math.random() * 3, c: [150, 150, 190]
      });
    }
  }

  function emitJets(dt) {
    if (ship.dead || state !== 'playing') return;
    const dir = ((keys.right || touch.right) ? 1 : 0) - ((keys.left || touch.left) ? 1 : 0);
    if (!dir) return;
    if (Math.random() > 70 * dt) return;
    const a = ship.a;
    // small puff at the shoulder opposite to the turn
    const lx = -dir * 9;
    const ly = -9;
    const p = toWorld(lx, ly, ship.x, ship.y, a);
    const c = Math.cos(a);
    const s = Math.sin(a);
    particles.push({
      type: 'flame', x: p[0], y: p[1],
      vx: ship.vx + (-dir * c) * 60, vy: ship.vy + (-dir * s) * 60,
      life: 0.18, max: 0.25, r: 1.4
    });
  }

  function updateParticles(dt) {
    const T = level.T;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles[i] = particles[particles.length - 1]; particles.pop(); continue; }
      if (p.type === 'debris') {
        p.vy += 160 * dt;
        p.rot += p.vr * dt;
      } else if (p.type === 'spark') {
        p.vy += 110 * dt;
      } else if (p.type === 'dust') {
        p.vy += 12 * dt;
        p.vx *= Math.exp(-1.5 * dt);
      } else {
        p.vx *= Math.exp(-1.2 * dt);
        p.vy *= Math.exp(-1.2 * dt);
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const gy = groundAt(T, p.x);
      if (p.y > gy) {
        if (p.type === 'flame') {
          p.life = 0;
        } else if (p.type === 'debris' || p.type === 'spark') {
          p.y = gy - 1;
          p.vy = 0;
          p.vx *= 0.6;
          if (p.type === 'spark') p.life -= dt * 4;
          if (p.type === 'debris') p.vr *= 0.5;
        } else {
          p.y = gy - 1;
          p.vy *= -0.2;
        }
      }
    }
  }

  function updateEffects(dt) {
    emitExhaust(dt);
    emitJets(dt);
    updateParticles(dt);
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.t += dt;
      if (r.t >= r.life) rings.splice(i, 1);
    }
    if (crater && crater.t < 0.4) {
      crater.t += dt;
      crater.r = crater.max * Math.min(1, crater.t / 0.4);
    }
    if (flash > 0) flash = Math.max(0, flash - dt * 2);
    if (shake > 0) shake = Math.max(0, shake - dt * 28);
    if (banner) {
      banner.t -= dt;
      if (banner.t <= 0) banner = null;
    }
    if (pendingResult) {
      endTimer -= dt;
      if (endTimer <= 0) finishRound();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Rendering                                                           */
  /* ------------------------------------------------------------------ */
  function drawStars(t) {
    const stars = level.stars;
    ctx.fillStyle = '#cfd8ff';
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const tw = reduceMotion ? 0.75 : 0.55 + 0.45 * Math.sin(t * s.s + s.p);
      ctx.globalAlpha = tw;
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.globalAlpha = 1;
  }

  function drawWell(t) {
    const w = level.well;
    if (!w) return;
    ctx.save();
    ctx.translate(w.x, w.y);
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 90);
    g.addColorStop(0, 'rgba(255,43,214,0.55)');
    g.addColorStop(0.35, 'rgba(139,123,255,0.28)');
    g.addColorStop(1, 'rgba(139,123,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 90, 0, TAU);
    ctx.fill();
    const spin = reduceMotion ? 0 : t;
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.rotate(spin * (0.8 + i * 0.4) * (i % 2 ? -1 : 1));
      ctx.strokeStyle = 'rgba(' + (i === 1 ? '255,43,214' : '170,150,255') + ',' + (0.65 - i * 0.12) + ')';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([10 + i * 4, 8 + i * 3]);
      ctx.beginPath();
      ctx.arc(0, 0, 16 + i * 14, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = '#04051a';
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(190,175,255,0.8)';
    ctx.font = "700 10px Rajdhani, 'Segoe UI', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('QUANTUM ANOMALY', w.x, w.y + 62);
  }

  function drawPads(t) {
    ctx.font = FONT_HEAD;
    ctx.textAlign = 'center';
    level.pads.forEach((p) => {
      const mid = (p.x0 + p.x1) / 2;
      const pulse = reduceMotion ? 1 : 0.55 + 0.45 * Math.sin(t * 4 + p.mult);
      // beacons
      [p.x0, p.x1].forEach((bx) => {
        ctx.strokeStyle = 'rgba(' + p.rgb + ',0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(bx, p.y);
        ctx.lineTo(bx, p.y - 11);
        ctx.stroke();
        ctx.fillStyle = 'rgba(' + p.rgb + ',' + (0.35 + 0.65 * pulse) + ')';
        ctx.beginPath();
        ctx.arc(bx, p.y - 13, 3 + pulse, 0, TAU);
        ctx.fill();
      });
      ctx.fillStyle = p.color;
      ctx.fillText(p.mult + 'X', mid, p.y - 38);
    });
  }

  function drawTrajectory() {
    if (state !== 'playing' || ship.dead) return;
    const cfg = level.cfg;
    const dt = 1 / 30;
    let x = ship.x, y = ship.y, vx = ship.vx, vy = ship.vy;
    ctx.fillStyle = '#ffffff';
    let hit = null;
    for (let i = 0; i < 150; i++) {
      let ax = 0, ay = cfg.gravity;
      if (level.well) { wellAccel(level.well, x, y, _wa); ax += _wa[0]; ay += _wa[1]; }
      vx += ax * dt; vy += ay * dt;
      x += vx * dt; y += vy * dt;
      if (x < 0 || x > W) break;
      if (y + FOOT_Y >= groundAt(level.T, x)) { hit = { x: x, y: groundAt(level.T, x), vy: vy, vx: vx }; break; }
      if (i % 3 === 0 && y > -20) {
        ctx.globalAlpha = 0.45 * (1 - i / 160);
        ctx.fillRect(x - 1, y - 1, 2, 2);
      }
    }
    ctx.globalAlpha = 1;
    if (hit) {
      const pad = padAtX(hit.x);
      const ok = pad && hit.vy <= LIM.vy && Math.abs(hit.vx) <= LIM.vx;
      ctx.strokeStyle = ok ? 'rgba(61,255,154,0.8)' : 'rgba(255,69,96,0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(hit.x - 5, hit.y - 5); ctx.lineTo(hit.x + 5, hit.y + 5);
      ctx.moveTo(hit.x + 5, hit.y - 5); ctx.lineTo(hit.x - 5, hit.y + 5);
      ctx.stroke();
    }
  }

  function flameColor(t) {
    let r, g, b;
    if (t < 0.4) {
      const k = t / 0.4;
      r = 255; g = 245 - 95 * k; b = 200 - 160 * k;
    } else {
      const k = (t - 0.4) / 0.6;
      r = 255 - 40 * k; g = 150 - 110 * k; b = 40 + 110 * k;
    }
    return [r | 0, g | 0, b | 0];
  }

  function drawParticles(additive) {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const t = 1 - p.life / p.max;
      if (additive) {
        if (p.type === 'flame') {
          const c = flameColor(t);
          const a = Math.pow(1 - t, 1.2) * 0.9;
          ctx.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a.toFixed(2) + ')';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * (1 - t * 0.45), 0, TAU);
          ctx.fill();
        } else if (p.type === 'spark') {
          const a = clamp(p.life / p.max, 0, 1);
          ctx.fillStyle = 'rgba(' + p.c[0] + ',' + p.c[1] + ',' + p.c[2] + ',' + a.toFixed(2) + ')';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * (0.4 + a * 0.6), 0, TAU);
          ctx.fill();
        }
      } else if (p.type === 'dust') {
        const a = clamp(p.life / p.max, 0, 1) * 0.35;
        ctx.fillStyle = 'rgba(' + p.c[0] + ',' + p.c[1] + ',' + p.c[2] + ',' + a.toFixed(2) + ')';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1 + t), 0, TAU);
        ctx.fill();
      } else if (p.type === 'debris') {
        const a = clamp(p.life / 1.2, 0, 1);
        ctx.strokeStyle = 'rgba(25,230,255,' + a.toFixed(2) + ')';
        ctx.lineWidth = 2;
        const dx = Math.cos(p.rot) * p.len * 0.5;
        const dy = Math.sin(p.rot) * p.len * 0.5;
        ctx.beginPath();
        ctx.moveTo(p.x - dx, p.y - dy);
        ctx.lineTo(p.x + dx, p.y + dy);
        ctx.stroke();
      }
    }
  }

  function currentSafety() {
    return {
      vy: ship.vy <= LIM.vy,
      vx: Math.abs(ship.vx) <= LIM.vx,
      tilt: Math.abs(ship.a) <= LIM.tilt
    };
  }

  function drawShip(t) {
    if (ship.dead) return;
    const safe = currentSafety();
    const ok = safe.vy && safe.vx && safe.tilt;
    const gear = ok ? '#3dff9a' : '#ff4560';
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.a);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // engine core flame
    if (ship.throttle > 0.05) {
      const flick = reduceMotion ? 1 : 0.85 + 0.15 * Math.sin(t * 90);
      const len = (10 + ship.throttle * 22) * flick;
      const g = ctx.createLinearGradient(0, 9, 0, 9 + len);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.4, 'rgba(255,200,80,0.8)');
      g.addColorStop(1, 'rgba(255,60,120,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-4.5, 9);
      ctx.lineTo(4.5, 9);
      ctx.lineTo(0, 9 + len);
      ctx.closePath();
      ctx.fill();
    }

    // landing legs
    ctx.shadowColor = gear;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = gear;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-7, 3); ctx.lineTo(-13, 12); ctx.moveTo(-17, 13); ctx.lineTo(-11, 13);
    ctx.moveTo(7, 3); ctx.lineTo(13, 12); ctx.moveTo(17, 13); ctx.lineTo(11, 13);
    ctx.stroke();

    // nozzle
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#12142e';
    ctx.strokeStyle = '#8b7bff';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-4, 4); ctx.lineTo(4, 4); ctx.lineTo(6, 9); ctx.lineTo(-6, 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // hull
    ctx.shadowColor = '#19e6ff';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#0c1130';
    ctx.strokeStyle = '#19e6ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(8, -9);
    ctx.lineTo(9, 4);
    ctx.lineTo(-9, 4);
    ctx.lineTo(-8, -9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // window and stripe
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ff2bd6';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-8.5, 0); ctx.lineTo(8.5, 0);
    ctx.stroke();
    ctx.fillStyle = '#9ff3ff';
    ctx.beginPath();
    ctx.arc(0, -6, 2.6, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawRings() {
    for (let i = 0; i < rings.length; i++) {
      const r = rings[i];
      const k = r.t / r.life;
      ctx.strokeStyle = 'rgba(' + r.color + ',' + (0.8 * (1 - k)).toFixed(2) + ')';
      ctx.lineWidth = 3 * (1 - k) + 0.5;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, lerp(r.max * 0.1, r.max, k), lerp(r.max * 0.03, r.max * 0.3, k), 0, 0, TAU);
      ctx.stroke();
    }
  }

  function drawCrater() {
    if (!crater) return;
    ctx.save();
    ctx.fillStyle = 'rgba(3,3,12,0.9)';
    ctx.strokeStyle = 'rgba(255,140,60,0.8)';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#ff7a1a';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.ellipse(crater.x, crater.y + 1, crater.r, crater.r * 0.32, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawBanner() {
    if (!banner) return;
    const k = banner.t / banner.max;
    const a = clamp(Math.min(k * 4, (1 - k) * 8 + 0.2), 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.shadowColor = banner.color || '#19e6ff';
    ctx.shadowBlur = 16;
    ctx.fillStyle = banner.color || '#19e6ff';
    ctx.font = "800 30px Orbitron, 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(banner.text, W / 2, 150);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#c8d0f0';
    ctx.font = "600 17px Rajdhani, 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(banner.sub, W / 2, 176);
    ctx.restore();
  }

  function drawOffscreenMarker() {
    if (ship.dead || ship.y > -6) return;
    const alt = Math.max(0, groundAt(level.T, ship.x) - ship.y - FOOT_Y);
    ctx.save();
    ctx.fillStyle = '#19e6ff';
    ctx.beginPath();
    ctx.moveTo(ship.x, 8);
    ctx.lineTo(ship.x - 8, 22);
    ctx.lineTo(ship.x + 8, 22);
    ctx.closePath();
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.font = "700 12px Rajdhani, 'Segoe UI', sans-serif";
    ctx.fillText(Math.round(alt / PX_PER_M) + ' m', ship.x, 38);
    ctx.restore();
  }

  function drawHints(t) {
    if (state !== 'playing') return;
    if (ship.fuel > 0 && ship.fuel / ship.fuelMax < 0.2 && Math.floor(t * 3) % 2 === 0) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffb020';
      ctx.font = "800 14px Orbitron, 'Segoe UI', sans-serif";
      ctx.fillText('LOW FUEL', W / 2, 40);
      ctx.restore();
    }
  }

  function render(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (shake > 0 && !reduceMotion) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }
    ctx.drawImage(level.bgLayer, 0, 0);
    drawStars(t);
    drawWell(t);
    ctx.drawImage(level.terrainLayer, 0, 0);
    drawPads(t);
    drawCrater();
    drawTrajectory();
    drawParticles(false);
    ctx.globalCompositeOperation = 'lighter';
    drawParticles(true);
    ctx.globalCompositeOperation = 'source-over';
    drawShip(t);
    drawRings();
    drawOffscreenMarker();
    ctx.restore();
    if (flash > 0) {
      ctx.fillStyle = 'rgba(255,230,200,' + Math.min(0.5, flash).toFixed(2) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    drawBanner();
    drawHints(t);
  }

  /* ------------------------------------------------------------------ */
  /* HUD                                                                 */
  /* ------------------------------------------------------------------ */
  const hudCache = {};
  function setText(node, key, val) {
    if (hudCache[key] !== val) {
      hudCache[key] = val;
      node.textContent = val;
    }
  }
  function setCls(node, key, cls, on) {
    const k = key + cls;
    if (hudCache[k] !== on) {
      hudCache[k] = on;
      node.classList.toggle(cls, on);
    }
  }

  const SHIP_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 19 21 12 17 5 21 12 2"></polygon></svg>';

  function updateHud(force) {
    if (force) { for (const k in hudCache) delete hudCache[k]; }
    setText(el.level, 'level', String(levelNo));
    setText(el.score, 'score', String(score));
    setText(el.best, 'best', String(bestScore));
    const livesKey = 'lives' + lives;
    if (hudCache.livesKey !== livesKey) {
      hudCache.livesKey = livesKey;
      let html = '';
      for (let i = 0; i < Math.max(0, lives); i++) html += SHIP_ICON;
      el.lives.innerHTML = html || '<span>0</span>';
      el.lives.setAttribute('aria-label', lives + ' ships remaining');
    }

    const alt = Math.max(0, groundAt(level.T, ship.x) - (ship.y + FOOT_Y)) / PX_PER_M;
    const vyM = ship.vy / PX_PER_M;
    const vxM = Math.abs(ship.vx) / PX_PER_M;
    const tiltDeg = Math.abs(ship.a) * 180 / Math.PI;
    setText(el.alt, 'alt', alt.toFixed(1));
    setText(el.vs, 'vs', Math.abs(vyM).toFixed(1));
    setText(el.hs, 'hs', vxM.toFixed(1));
    setText(el.tilt, 'tilt', String(Math.round(tiltDeg)));
    setCls(el.vsArrow, 'vsa', 'up', vyM < 0);

    const sf = currentSafety();
    const live = state === 'playing' || state === 'paused';
    setCls(el.cardVs, 'cvs', 'safe', live && sf.vy);
    setCls(el.cardVs, 'cvsd', 'danger', live && !sf.vy);
    setCls(el.cardHs, 'chs', 'safe', live && sf.vx);
    setCls(el.cardHs, 'chsd', 'danger', live && !sf.vx);
    setCls(el.cardTilt, 'ctl', 'safe', live && sf.tilt);
    setCls(el.cardTilt, 'ctld', 'danger', live && !sf.tilt);
    const w1 = clamp(Math.max(0, vyM) / (LIM.vy / PX_PER_M * 2), 0, 1) * 100;
    const w2 = clamp(vxM / (LIM.vx / PX_PER_M * 2), 0, 1) * 100;
    const w3 = clamp(tiltDeg / (LIM.tilt * 180 / Math.PI * 2), 0, 1) * 100;
    el.vsBar.style.width = w1.toFixed(0) + '%';
    el.hsBar.style.width = w2.toFixed(0) + '%';
    el.tiltBar.style.width = w3.toFixed(0) + '%';

    const pct = clamp(ship.fuel / ship.fuelMax, 0, 1) * 100;
    el.fuelFill.style.width = pct.toFixed(1) + '%';
    setText(el.fuelText, 'fuel', Math.ceil(pct) + '%');
    el.fuelTrack.setAttribute('aria-valuenow', String(Math.ceil(pct)));
    setCls(el.fuelRow, 'fl', 'low', pct < 20 && pct > 0);
    setCls(el.fuelRow, 'fe', 'empty', pct <= 0);
  }

  /* ------------------------------------------------------------------ */
  /* Main loop                                                           */
  /* ------------------------------------------------------------------ */
  let hudTick = 0;

  function frame(ts) {
    requestAnimationFrame(frame);
    let dt = lastTs ? (ts - lastTs) / 1000 : 0;
    lastTs = ts;
    if (!(dt > 0)) dt = 0;
    dt = Math.min(dt, MAX_FRAME);
    const t = ts / 1000;

    if (state === 'playing') {
      acc += dt;
      timeAlive += dt;
      let guard = 0;
      while (acc >= STEP && guard++ < 20) {
        stepPhysics(STEP);
        acc -= STEP;
        if (state !== 'playing') { acc = 0; break; }
      }
      // low-fuel beeps
      if (state === 'playing' && ship.fuel > 0 && ship.fuel / ship.fuelMax < 0.2 && timeAlive > nextBeep) {
        tone(880, 0, 0.12, 'square', 0.08);
        nextBeep = timeAlive + 0.9;
      }
      if (state !== 'playing') nextBeep = 0;
    }
    if (state !== 'paused') updateEffects(dt);

    setRumble(state === 'playing' ? ship.throttle : 0);

    render(t);

    hudTick += dt;
    if (hudTick > 0.05 || state !== 'playing') {
      hudTick = 0;
      updateHud(false);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Init                                                                */
  /* ------------------------------------------------------------------ */
  setSound(soundOn);
  $('start-best').textContent = String(bestScore);
  loadLevel(1);
  updateHud(true);
  showOverlay(el.start, 'start-btn');
  requestAnimationFrame(frame);
})();
