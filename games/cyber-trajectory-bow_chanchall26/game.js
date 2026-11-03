/**
 * Cyber Trajectory Bow - Neon Target Physics Breaker
 * ArcadeVerse community game (NSoC 2026, issue #244)
 * Pure vanilla HTML5 Canvas + Web Audio. No libraries.
 */
(function () {
  'use strict';

  /* ======================================================================
     Constants
     ====================================================================== */
  const W = 720;
  const H = 450;
  const FLOOR = 412;
  const STEP = 1 / 120;          // fixed physics step (shared by arrow + preview)
  const MAX_FRAME = 0.1;         // clamp for long frames
  const MAX_SUBSTEPS = 24;
  const BASE_G = 900;            // px/s^2 at 1.0x gravity
  const BOW = { x: 84, y: 352 };
  const ARROW_LEN = 34;
  const MAX_PULL = 130;
  const MIN_PULL = 14;
  const SPEED_MIN = 130;
  const SPEED_MAX = 1000;
  const REST = 0.55;             // energy kept on a bounce (normal axis)
  const TANG = 0.82;             // energy kept along the surface
  const MAX_BOUNCES = 5;
  const MAX_AGE = 10;
  const BLAST_R = 92;
  const FUSE = 0.13;
  const PREVIEW_STEPS = 720;
  const PREVIEW_EVERY = 6;
  const IDLE_ANGLE = -0.5;
  const ANGLE_UP = -1.48;
  const ANGLE_DOWN = 1.05;
  const STORE_KEY = 'cyberTrajectoryBow.v1';

  const COL = {
    cyan: '#00f0ff',
    green: '#39ff7a',
    amber: '#ffb020',
    pink: '#ff3d81',
    violet: '#c27bff',
    gold: '#ffe14d',
    white: '#ffffff'
  };

  const GRADES = {
    bullseye: { label: 'Bullseye', pts: 150, color: '#ffe14d' },
    perfect: { label: 'Perfect', pts: 100, color: '#3dffb0' },
    ricochet: { label: 'Ricochet', pts: 120, color: '#c27bff' },
    hit: { label: 'Hit', pts: 50, color: '#ffffff' }
  };

  /* ======================================================================
     Stage data
     ====================================================================== */
  const st = (x, y) => ({ type: 'static', x: x, y: y });
  const ar = (x, y, hp, motion) => ({ type: 'armor', x: x, y: y, hp: hp, motion: motion || null });
  const ex = (x, y) => ({ type: 'explosive', x: x, y: y });
  const mv = (motion) => ({ type: 'moving', motion: motion });
  const slide = (cx, cy, ax, ay, period, phase) => ({ kind: 'slide', cx: cx, cy: cy, ax: ax, ay: ay, period: period, phase: phase });
  const orbit = (cx, cy, r, period, phase) => ({ kind: 'orbit', cx: cx, cy: cy, r: r, period: period, phase: phase });

  const STAGES = [
    {
      name: 'Calibration', accent: '#00f0ff', ammo: 6,
      hint: 'Drag back from anywhere and release. Inner rings score more.',
      gravity: [1], wind: [[0, 0]], barriers: [],
      targets: [st(410, 335), st(540, 235), st(650, 340)]
    },
    {
      name: 'Moving Nodes', accent: '#39ff7a', ammo: 8,
      hint: 'New: moving nodes. Lead your shot.',
      gravity: [1], wind: [[0, 0]], barriers: [],
      targets: [st(350, 320), mv(slide(480, 250, 0, 85, 3.2, 0)), mv(slide(590, 170, 65, 0, 2.6, 1)), st(660, 355)]
    },
    {
      name: 'Armor Plating', accent: '#ffb020', ammo: 10,
      hint: 'New: armored nodes. Crack them with repeated hits.',
      gravity: [1], wind: [[0, 0]], barriers: [],
      targets: [ar(500, 320, 2), ar(610, 200, 3), st(400, 190), st(665, 350), mv(orbit(360, 300, 55, 4.2, 0))]
    },
    {
      name: 'Chain Reaction', accent: '#ff3d81', ammo: 5,
      hint: 'New: explosive nodes. Detonate one to chain the rest.',
      gravity: [1], wind: [[0, 0]],
      barriers: [{ x: 330, y: 332, w: 16, h: 80 }],
      targets: [ex(560, 300), ex(612, 254), ex(655, 320), st(522, 240), ar(650, 176, 2), st(470, 356)]
    },
    {
      name: 'Crosswind', accent: '#5aa9ff', ammo: 9,
      hint: 'New: wind. The preview line already includes it.',
      gravity: [1], wind: [[-130, 0]], barriers: [],
      targets: [st(430, 250), mv(slide(540, 310, 0, 60, 3, 0.5)), ar(600, 190, 2), ex(665, 330), st(630, 262), st(490, 120)]
    },
    {
      name: 'Low Gravity', accent: '#39ff7a', ammo: 10,
      hint: 'New: low gravity. Arrows fly far, so ease off the pull.',
      gravity: [0.5], wind: [[55, 0]], barriers: [],
      targets: [mv(orbit(520, 210, 85, 5, 0)), st(340, 110), st(610, 80), ar(620, 320, 3), ex(470, 340), ex(530, 360), st(670, 190)]
    },
    {
      name: 'Heavy Fall', accent: '#ff7a3d', ammo: 10,
      hint: 'New: heavy gravity, and the wind shifts every shot.',
      gravity: [1.5], wind: [[-100, 0], [80, 0], [-160, 0]],
      barriers: [{ x: 352, y: 236, w: 16, h: 176 }],
      targets: [st(480, 360), ex(545, 340), ar(610, 330, 3), st(650, 230), mv(slide(520, 190, 80, 0, 3.2, 0)), ar(430, 150, 2)]
    },
    {
      name: 'Storm Core', accent: '#c27bff', ammo: 11,
      hint: 'Final: wind and gravity both shift every shot.',
      gravity: [1, 0.6, 1.4, 0.8],
      wind: [[-150, -30], [110, -40], [-60, 50], [170, 0]],
      barriers: [{ x: 300, y: 200, w: 100, h: 12 }, { x: 520, y: 290, w: 14, h: 122 }],
      targets: [
        ar(450, 120, 3), ar(640, 225, 2), ex(600, 360), ex(655, 310),
        mv(orbit(410, 320, 60, 4.6, 0.5)), mv(slide(580, 130, 60, 35, 3.6, 0)),
        st(380, 90), st(692, 170)
      ]
    }
  ];

  /* ======================================================================
     Helpers
     ====================================================================== */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const $ = (id) => document.getElementById(id);

  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  /* ======================================================================
     Persistence (localStorage may throw: always guarded)
     ====================================================================== */
  const save = { unlocked: 1, best: 0, stars: {}, muted: false };

  function loadSave() {
    try {
      const raw = window.localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const o = JSON.parse(raw);
      if (o && typeof o === 'object') {
        save.unlocked = clamp(parseInt(o.unlocked, 10) || 1, 1, STAGES.length);
        save.best = Math.max(0, parseInt(o.best, 10) || 0);
        save.muted = !!o.muted;
        if (o.stars && typeof o.stars === 'object') {
          Object.keys(o.stars).forEach(function (k) {
            const v = clamp(parseInt(o.stars[k], 10) || 0, 0, 3);
            if (v > 0) save.stars[k] = v;
          });
        }
      }
    } catch (e) { /* storage unavailable: keep defaults in memory */ }
  }

  function persist() {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(save));
    } catch (e) { /* ignore */ }
  }

  /* ======================================================================
     Audio (procedural Web Audio, created only after a user gesture)
     ====================================================================== */
  const audio = {
    ctx: null,
    master: null,
    noiseBuf: null,
    muted: false,
    bow: null,

    ensure: function () {
      if (!this.ctx) {
        try {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return false;
          this.ctx = new AC();
          this.master = this.ctx.createGain();
          this.master.gain.value = this.muted ? 0 : 0.7;
          this.master.connect(this.ctx.destination);
          const len = Math.floor(this.ctx.sampleRate * 1.5);
          this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
          const d = this.noiseBuf.getChannelData(0);
          for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        } catch (e) {
          this.ctx = null;
          return false;
        }
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(function () { /* ignore */ });
      }
      return true;
    },

    ok: function () {
      return !!this.ctx && !this.muted;
    },

    setMuted: function (m) {
      this.muted = m;
      if (this.master) {
        this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.02);
      }
      if (m) this.drawStop();
    },

    tone: function (o) {
      if (!this.ok()) return;
      const c = this.ctx;
      const t = c.currentTime + (o.delay || 0);
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(o.f0, t);
      if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t + o.dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(o.vol, t + (o.attack || 0.006));
      g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + o.dur + 0.05);
    },

    noise: function (o) {
      if (!this.ok()) return;
      const c = this.ctx;
      const t = c.currentTime + (o.delay || 0);
      const src = c.createBufferSource();
      src.buffer = this.noiseBuf;
      const f = c.createBiquadFilter();
      f.type = o.type || 'bandpass';
      f.frequency.setValueAtTime(o.f0, t);
      if (o.f1) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + o.dur);
      f.Q.value = o.q || 1;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(o.vol, t + (o.attack || 0.004));
      g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
      src.connect(f);
      f.connect(g);
      g.connect(this.master);
      src.start(t, Math.random() * 0.3);
      src.stop(t + o.dur + 0.05);
    },

    drawStart: function () {
      if (!this.ok() || this.bow) return;
      const c = this.ctx;
      const o1 = c.createOscillator();
      const o2 = c.createOscillator();
      const f = c.createBiquadFilter();
      const g = c.createGain();
      o1.type = 'sawtooth';
      o2.type = 'triangle';
      f.type = 'lowpass';
      f.Q.value = 5;
      g.gain.value = 0.0001;
      o1.connect(f);
      o2.connect(f);
      f.connect(g);
      g.connect(this.master);
      o1.start();
      o2.start();
      this.bow = { o1: o1, o2: o2, f: f, g: g };
      this.drawUpdate(0);
    },

    // string tension: pitch and brightness rise with the pull fraction p (0..1)
    drawUpdate: function (p) {
      if (!this.bow || !this.ctx) return;
      const t = this.ctx.currentTime;
      const b = this.bow;
      b.o1.frequency.setTargetAtTime(70 + p * 190, t, 0.04);
      b.o2.frequency.setTargetAtTime(141 + p * 380, t, 0.04);
      b.f.frequency.setTargetAtTime(260 + p * 1700, t, 0.04);
      b.g.gain.setTargetAtTime(0.02 + p * 0.07, t, 0.04);
    },

    drawStop: function () {
      if (!this.bow || !this.ctx) return;
      const b = this.bow;
      this.bow = null;
      const t = this.ctx.currentTime;
      b.g.gain.cancelScheduledValues(t);
      b.g.gain.setTargetAtTime(0.0001, t, 0.02);
      try {
        b.o1.stop(t + 0.15);
        b.o2.stop(t + 0.15);
      } catch (e) { /* ignore */ }
    },

    release: function (p) {
      this.tone({ type: 'triangle', f0: 260 + p * 200, f1: 80, dur: 0.16, vol: 0.22 });
      this.noise({ type: 'highpass', f0: 800, f1: 3500 + p * 2500, dur: 0.22, vol: 0.12, q: 0.7 });
    },

    shatter: function () {
      this.noise({ type: 'bandpass', f0: 5200, f1: 1800, dur: 0.32, vol: 0.2, q: 0.9 });
      this.tone({ type: 'sine', f0: 1900, f1: 900, dur: 0.22, vol: 0.1 });
      this.tone({ type: 'sine', f0: 2700, f1: 1500, dur: 0.18, vol: 0.07, delay: 0.03 });
    },

    armor: function () {
      this.tone({ type: 'square', f0: 330, f1: 190, dur: 0.12, vol: 0.12 });
      this.noise({ type: 'bandpass', f0: 2400, f1: 900, dur: 0.1, vol: 0.14, q: 3 });
    },

    ricochet: function () {
      this.tone({ type: 'sine', f0: 1500, f1: 620, dur: 0.22, vol: 0.13 });
      this.tone({ type: 'triangle', f0: 2250, f1: 930, dur: 0.18, vol: 0.05, delay: 0.015 });
    },

    bounce: function () {
      this.tone({ type: 'sine', f0: 900, f1: 420, dur: 0.1, vol: 0.07 });
    },

    explode: function () {
      this.noise({ type: 'lowpass', f0: 2600, f1: 120, dur: 0.6, vol: 0.38, q: 0.7 });
      this.tone({ type: 'sine', f0: 140, f1: 38, dur: 0.5, vol: 0.34 });
    },

    clear: function () {
      const n = [523, 659, 784, 1047];
      for (let i = 0; i < n.length; i++) {
        this.tone({ type: 'triangle', f0: n[i], dur: 0.32, vol: 0.14, delay: i * 0.1 });
      }
    },

    fail: function () {
      const n = [392, 330, 262, 196];
      for (let i = 0; i < n.length; i++) {
        this.tone({ type: 'sawtooth', f0: n[i], f1: n[i] * 0.94, dur: 0.3, vol: 0.09, delay: i * 0.14 });
      }
    },

    click: function () {
      this.tone({ type: 'square', f0: 620, f1: 480, dur: 0.05, vol: 0.05 });
    }
  };

  /* ======================================================================
     DOM + canvas
     ====================================================================== */
  const canvas = $('game-canvas');
  const ctx = canvas.getContext('2d');
  let dpr = 1;
  let uiScale = 1;               // enlarges canvas text when the canvas is shown small (phones)
  let bgCanvas = null;
  let reduceMotion = false;
  try {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reduceMotion = mq.matches;
    const onMq = function (e) { reduceMotion = e.matches; };
    if (mq.addEventListener) mq.addEventListener('change', onMq);
    else if (mq.addListener) mq.addListener(onMq);
  } catch (e) { /* ignore */ }

  const overlays = {
    start: $('start-overlay'),
    pause: $('pause-overlay'),
    clear: $('clear-overlay'),
    fail: $('fail-overlay'),
    victory: $('victory-overlay'),
    help: $('help-overlay')
  };
  const primaryBtn = {
    start: 'start-btn',
    pause: 'resume-btn',
    clear: 'next-btn',
    fail: 'fail-retry-btn',
    victory: 'victory-again-btn',
    help: 'help-close-btn'
  };

  /* ======================================================================
     Game state
     ====================================================================== */
  const S = {
    mode: 'menu',               // menu | playing | clear | fail | victory
    paused: false,
    helpOpen: false,
    stageIdx: 0,
    t: 0,
    targets: [],
    barriers: [],
    arrow: null,
    ghosts: [],
    particles: [],
    rings: [],
    texts: [],
    streaks: [],
    ammo: 0,
    ammoMax: 0,
    shots: 0,
    hits: 0,
    score: 0,
    stageStartScore: 0,
    streak: 0,
    chain: 0,
    env: { wx: 0, wy: 0, g: BASE_G, gMul: 1 },
    aim: { active: false, id: null, sx: 0, sy: 0, px: 0, py: 0, angle: IDLE_ANGLE, pull: 0 },
    bowAngle: IDLE_ANGLE,
    endTimer: 0,
    ending: null,
    banner: null,
    shake: 0
  };

  /* ======================================================================
     Targets
     ====================================================================== */
  function targetPos(tg, t) {
    const m = tg.motion;
    if (!m) return [tg.x0, tg.y0];
    const th = (Math.PI * 2 * t) / m.period + m.phase;
    if (m.kind === 'orbit') return [m.cx + Math.cos(th) * m.r, m.cy + Math.sin(th) * m.r];
    return [m.cx + Math.sin(th) * m.ax, m.cy + Math.sin(th) * m.ay];
  }

  function makeTarget(spec, i) {
    const type = spec.type === 'moving' ? 'static' : spec.type;
    const tg = {
      type: type,
      kind: spec.type,
      motion: spec.motion || null,
      x0: spec.x || 0,
      y0: spec.y || 0,
      x: 0,
      y: 0,
      r: type === 'armor' ? 25 : type === 'explosive' ? 21 : 21,
      hp: spec.hp || 1,
      maxHp: spec.hp || 1,
      alive: true,
      fuse: 0,
      depth: 0,
      scored: false,
      flash: 0,
      seed: i * 1.7 + 0.6
    };
    const p = targetPos(tg, 0);
    tg.x = p[0];
    tg.y = p[1];
    return tg;
  }

  function targetColor(tg) {
    if (tg.type === 'armor') return COL.amber;
    if (tg.type === 'explosive') return COL.pink;
    return tg.motion ? COL.green : COL.cyan;
  }

  /* ======================================================================
     Physics: one shared integrator for the real arrow and the preview
     ====================================================================== */
  function makeArrow(angle, pull) {
    const sp = SPEED_MIN + (SPEED_MAX - SPEED_MIN) * clamp(pull / MAX_PULL, 0, 1);
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return {
      x: BOW.x + c * ARROW_LEN,
      y: BOW.y + s * ARROW_LEN,
      vx: c * sp,
      vy: s * sp,
      bounces: 0,
      age: 0,
      stuck: false,
      trail: [],
      tick: 0,
      scored: false,
      damaged: false,
      lastHit: null,
      lastHitT: -9
    };
  }

  // Advances an arrow by dt. Returns true when it bounced off a surface this step.
  function stepArrow(a, dt, env, barriers) {
    a.vx += env.wx * dt;
    a.vy += (env.g + env.wy) * dt;
    const px = a.x;
    const py = a.y;
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    a.age += dt;
    let bounced = false;

    for (let i = 0; i < barriers.length; i++) {
      const b = barriers[i];
      if (a.x > b.x && a.x < b.x + b.w && a.y > b.y && a.y < b.y + b.h) {
        if (px <= b.x || px >= b.x + b.w) {
          a.x = px <= b.x ? b.x - 0.5 : b.x + b.w + 0.5;
          a.vx = -a.vx * REST;
          a.vy *= TANG;
        } else {
          a.y = py <= b.y ? b.y - 0.5 : b.y + b.h + 0.5;
          a.vy = -a.vy * REST;
          a.vx *= TANG;
        }
        bounced = true;
        break;
      }
    }

    if (a.x < 0) {
      a.x = 0;
      a.vx = -a.vx * REST;
      a.vy *= TANG;
      bounced = true;
    } else if (a.x > W) {
      a.x = W;
      a.vx = -a.vx * REST;
      a.vy *= TANG;
      bounced = true;
    }

    if (a.y > FLOOR) {
      const impact = a.vy;
      a.y = FLOOR;
      a.vy = -a.vy * REST;
      a.vx *= TANG;
      if (impact > 60) bounced = true;
    }

    if (bounced) a.bounces++;
    if (a.y >= FLOOR - 0.01 && Math.hypot(a.vx, a.vy) < 260) a.stuck = true;
    return bounced;
  }

  // Dotted-line preview: identical integrator, constants and environment.
  function previewPath(angle, pull, env, barriers) {
    const a = makeArrow(angle, pull);
    const pts = [{ x: a.x, y: a.y }];
    let contact = false;
    for (let i = 1; i <= PREVIEW_STEPS; i++) {
      const b = stepArrow(a, STEP, env, barriers);
      if (b || a.stuck) {
        pts.push({ x: a.x, y: a.y });
        contact = true;
        break;
      }
      if (i % PREVIEW_EVERY === 0) pts.push({ x: a.x, y: a.y });
    }
    return { pts: pts, contact: contact };
  }

  /* ======================================================================
     Effects
     ====================================================================== */
  function addText(x, y, text, color, size, life) {
    S.texts.push({
      x: clamp(x, 44, W - 44),
      y: clamp(y, 22, FLOOR - 6),
      text: text,
      color: color || '#fff',
      size: size || 16,
      life: life || 1.3,
      max: life || 1.3
    });
  }

  function addRing(x, y, r1, color, life, width) {
    S.rings.push({ x: x, y: y, r1: r1, color: color, life: life, max: life, width: width || 3 });
  }

  function addSparks(x, y, n, color, speed) {
    if (reduceMotion) n = Math.ceil(n * 0.25);
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(0.3, 1) * speed;
      S.particles.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: rand(0.25, 0.6), max: 0.6, color: color, size: rand(1.2, 2.6), shard: false, rot: 0, vr: 0
      });
    }
    if (S.particles.length > 600) S.particles.splice(0, S.particles.length - 600);
  }

  function shatterFx(tg) {
    const col = targetColor(tg);
    const n = reduceMotion ? 7 : 26;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(80, 340);
      S.particles.push({
        x: tg.x, y: tg.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
        life: rand(0.45, 0.95), max: 0.95, color: i % 4 === 0 ? '#ffffff' : col,
        size: rand(3, 8), shard: true, rot: rand(0, 6.28), vr: rand(-12, 12)
      });
    }
    addRing(tg.x, tg.y, tg.r * 2.4, col, 0.35, 3);
    if (S.particles.length > 600) S.particles.splice(0, S.particles.length - 600);
  }

  function addShake(v) {
    if (!reduceMotion) S.shake = Math.max(S.shake, v);
  }

  function streakMult() {
    return 1 + 0.25 * Math.min(Math.max(S.streak - 1, 0), 8);
  }

  function addScore(n) {
    S.score += n;
    if (S.score > save.best) save.best = S.score;
  }

  /* ======================================================================
     Gameplay
     ====================================================================== */
  function applyEnv() {
    const stg = STAGES[S.stageIdx];
    const i = S.shots;
    const w = stg.wind[i % stg.wind.length];
    const gm = stg.gravity[i % stg.gravity.length];
    S.env.wx = w[0];
    S.env.wy = w[1];
    S.env.gMul = gm;
    S.env.g = BASE_G * gm;
    updateHud();
  }

  function setupStage(idx) {
    const stg = STAGES[idx];
    S.stageIdx = idx;
    S.t = 0;
    S.targets = stg.targets.map(makeTarget);
    S.barriers = stg.barriers.slice();
    S.arrow = null;
    S.ghosts = [];
    S.particles = [];
    S.rings = [];
    S.texts = [];
    S.ammo = stg.ammo;
    S.ammoMax = stg.ammo;
    S.shots = 0;
    S.hits = 0;
    S.streak = 0;
    S.chain = 0;
    S.endTimer = 0;
    S.ending = null;
    S.banner = null;
    S.shake = 0;
    S.bowAngle = IDLE_ANGLE;
    cancelAim();
    S.streaks = [];
    for (let i = 0; i < 34; i++) {
      S.streaks.push({ x: rand(0, W), y: rand(0, FLOOR), len: rand(18, 46) });
    }
    buildBackground(stg.accent);
    applyEnv();
  }

  function beginStage(idx, startScore) {
    hideAllOverlays();
    setupStage(idx);
    S.score = startScore;
    S.stageStartScore = startScore;
    S.mode = 'playing';
    S.paused = false;
    S.banner = {
      title: 'Stage ' + (idx + 1) + '  -  ' + STAGES[idx].name,
      sub: STAGES[idx].hint,
      t: 3.6
    };
    syncPauseButton();
    updateHud();
  }

  function restartStage() {
    audio.ensure();
    beginStage(S.stageIdx, S.stageStartScore);
  }

  function showMenu() {
    cancelAim();
    persist();
    S.mode = 'menu';
    S.paused = false;
    S.score = 0;
    setupStage(clamp(save.unlocked - 1, 0, STAGES.length - 1));
    hideAllOverlays();
    buildStageGrid();
    $('start-best').textContent = String(save.best);
    $('start-btn').textContent = save.unlocked > 1 ? 'Continue - Stage ' + save.unlocked : 'Launch Mission';
    showOverlay('start');
    syncPauseButton();
    updateHud();
  }

  function startRun(idx) {
    audio.ensure();
    audio.click();
    beginStage(idx, 0);
  }

  function canAim() {
    return S.mode === 'playing' && !S.paused && !S.helpOpen && !S.arrow && S.ammo > 0 && !S.ending;
  }

  function beginAim(x, y, id) {
    S.aim.active = true;
    S.aim.id = id;
    S.aim.sx = x;
    S.aim.sy = y;
    S.aim.px = x;
    S.aim.py = y;
    S.aim.pull = 0;
    S.aim.angle = S.bowAngle;
    if (S.banner) S.banner.t = Math.min(S.banner.t, 0.45);
    audio.ensure();
    audio.drawStart();
  }

  function updateAim(x, y) {
    const a = S.aim;
    a.px = x;
    a.py = y;
    const dx = a.sx - x;
    const dy = a.sy - y;
    const len = Math.hypot(dx, dy);
    a.pull = Math.min(len, MAX_PULL);
    if (len > 4) {
      let ang = Math.atan2(dy, dx);
      if (dx < 0) ang = dy < 0 ? ANGLE_UP : ANGLE_DOWN;
      a.angle = clamp(ang, ANGLE_UP, ANGLE_DOWN);
    }
    audio.drawUpdate(a.pull / MAX_PULL);
  }

  function cancelAim() {
    S.aim.active = false;
    S.aim.id = null;
    S.aim.pull = 0;
    audio.drawStop();
  }

  function fire() {
    const a = S.aim;
    const pull = a.pull;
    const angle = a.angle;
    cancelAim();
    if (pull < MIN_PULL || !canAim()) return;
    S.arrow = makeArrow(angle, pull);
    S.ammo--;
    S.shots++;
    S.chain = 0;
    S.bowAngle = angle;
    audio.release(pull / MAX_PULL);
    addSparks(BOW.x + Math.cos(angle) * 30, BOW.y + Math.sin(angle) * 30, 8, COL.cyan, 160);
    updateHud();
  }

  function endArrow(reason) {
    const a = S.arrow;
    if (!a) return;
    if (reason === 'stuck' || reason === 'gone') {
      S.ghosts.push({ x: a.x, y: a.y, angle: Math.atan2(a.vy, a.vx), life: 0.8 });
    }
    if (a.scored || a.damaged) {
      S.hits++;
    } else {
      if (S.streak > 0) addText(clamp(a.x, 60, W - 60), clamp(a.y, 60, FLOOR - 30), 'Streak lost', '#ff8aa8', 13, 1.1);
      S.streak = 0;
      addText(clamp(a.x, 50, W - 50), clamp(a.y - 18, 40, FLOOR - 10), 'Miss', '#9fb3d4', 15, 1);
    }
    S.arrow = null;
    applyEnv();
    const stg = STAGES[S.stageIdx];
    if (S.shots > 0 && (stg.wind.length > 1 || stg.gravity.length > 1) && S.ammo > 0) {
      addText(W / 2, 60, 'Conditions shifted', '#9fe9ff', 14, 1.4);
    }
  }

  function countAlive() {
    let n = 0;
    for (let i = 0; i < S.targets.length; i++) if (S.targets[i].alive) n++;
    return n;
  }

  function anyFuse() {
    for (let i = 0; i < S.targets.length; i++) {
      if (S.targets[i].alive && S.targets[i].fuse > 0) return true;
    }
    return false;
  }

  function destroyTarget(tg, pts, label) {
    tg.alive = false;
    tg.fuse = 0;
    shatterFx(tg);
    audio.shatter();
    addShake(3);
    if (pts > 0) {
      addScore(pts);
      addText(tg.x, tg.y - 6, label || ('+' + pts), '#ffffff', 15, 1.1);
    }
  }

  function explodeTarget(tg) {
    tg.fuse = 0;
    tg.alive = false;
    shatterFx(tg);
    S.chain++;
    if (!tg.scored) {
      const pts = Math.round((60 + 20 * tg.depth) * streakMult());
      addScore(pts);
      addText(tg.x, tg.y - 8, '+' + pts, '#ffffff', 15, 1.1);
    }
    audio.explode();
    addShake(9);
    addRing(tg.x, tg.y, BLAST_R, COL.pink, 0.5, 5);
    addRing(tg.x, tg.y, BLAST_R * 0.6, '#ffffff', 0.3, 2);
    addSparks(tg.x, tg.y, 34, COL.pink, 380);
    addSparks(tg.x, tg.y, 14, COL.gold, 260);

    for (let i = 0; i < S.targets.length; i++) {
      const o = S.targets[i];
      if (!o.alive || o === tg) continue;
      if (Math.hypot(o.x - tg.x, o.y - tg.y) > BLAST_R) continue;
      if (o.type === 'explosive') {
        if (o.fuse <= 0) {
          o.fuse = FUSE;
          o.depth = tg.depth + 1;
          o.flash = 0.2;
        }
      } else if (o.type === 'armor') {
        o.hp -= 2;
        o.flash = 0.25;
        if (o.hp <= 0) {
          S.chain++;
          destroyTarget(o, Math.round((60 + 20 * (tg.depth + 1)) * streakMult()));
        } else {
          addText(o.x, o.y - o.r - 14, 'Armor ' + o.hp + '/' + o.maxHp, COL.amber, 13, 1);
          addSparks(o.x, o.y, 10, COL.amber, 220);
        }
      } else {
        S.chain++;
        destroyTarget(o, Math.round((60 + 20 * (tg.depth + 1)) * streakMult()));
      }
    }
    if (S.chain >= 2) addText(tg.x, tg.y - 34, 'Chain x' + S.chain, COL.pink, 18, 1.5);
  }

  function pickGrade(frac, bounces) {
    if (bounces > 0) return 'ricochet';
    if (frac < 0.25) return 'bullseye';
    if (frac < 0.6) return 'perfect';
    return 'hit';
  }

  function arrowHitsTarget(a, tg, px, py, vx, vy) {
    a.damaged = true;
    const speed = Math.hypot(vx, vy) || 1;
    const off = Math.abs((tg.x - px) * vy - (tg.y - py) * vx) / speed;
    const frac = clamp(off / tg.r, 0, 1);

    if (tg.type === 'armor' && tg.hp > 1) {
      tg.hp--;
      tg.flash = 0.22;
      addScore(15);
      addText(tg.x, tg.y - tg.r - 14, 'Armor ' + tg.hp + '/' + tg.maxHp, COL.amber, 14, 1.1);
      addSparks(a.x, a.y, 12, COL.amber, 260);
      audio.armor();
      addShake(3);
      let nx = a.x - tg.x;
      let ny = a.y - tg.y;
      const nl = Math.hypot(nx, ny) || 1;
      nx /= nl;
      ny /= nl;
      const dot = a.vx * nx + a.vy * ny;
      if (dot < 0) {
        a.vx -= 1.5 * dot * nx;
        a.vy -= 1.5 * dot * ny;
      }
      a.vx *= 0.85;
      a.vy *= 0.85;
      a.x = tg.x + nx * (tg.r + 3);
      a.y = tg.y + ny * (tg.r + 3);
      a.bounces++;
      a.lastHit = tg;
      a.lastHitT = S.t;
      return;
    }

    // killing blow
    a.scored = true;
    S.streak++;
    const gradeKey = pickGrade(frac, a.bounces);
    const grade = GRADES[gradeKey];
    let base = grade.pts;
    if (gradeKey === 'ricochet' && frac < 0.25) base += 30;
    const mult = streakMult();
    const pts = Math.round(base * mult);
    tg.scored = true;
    addScore(pts);
    addText(tg.x, tg.y - tg.r - 12, grade.label, grade.color, 19, 1.5);
    addText(tg.x, tg.y - tg.r + 8, '+' + pts + (mult > 1 ? '  x' + mult.toFixed(2) : ''), '#ffffff', 14, 1.3);
    if (S.streak >= 2) addText(tg.x, tg.y + tg.r + 18, 'Streak ' + S.streak, COL.gold, 13, 1.2);
    if (gradeKey === 'ricochet') audio.ricochet();

    if (tg.type === 'explosive') {
      tg.fuse = 0.08;
      tg.depth = 0;
      tg.flash = 0.2;
      addSparks(a.x, a.y, 10, COL.pink, 240);
    } else {
      destroyTarget(tg, 0);
    }
    endArrow('hit');
  }

  function updateArrow(dt) {
    const a = S.arrow;
    const px = a.x;
    const py = a.y;
    const bounced = stepArrow(a, dt, S.env, S.barriers);
    a.tick++;
    if (a.tick % 2 === 0) {
      a.trail.push({ x: a.x, y: a.y });
      if (a.trail.length > 26) a.trail.shift();
    }
    if (bounced) {
      audio.bounce();
      addSparks(a.x, a.y, 7, COL.violet, 200);
      addRing(a.x, a.y, 14, COL.violet, 0.25, 2);
    }

    const sx = a.x - px;
    const sy = a.y - py;
    const segLen2 = sx * sx + sy * sy;
    let best = null;
    let bestF = 2;
    for (let i = 0; i < S.targets.length; i++) {
      const tg = S.targets[i];
      if (!tg.alive || tg.fuse > 0) continue;
      if (a.lastHit === tg && S.t - a.lastHitT < 0.14) continue;
      let f = 0;
      if (segLen2 > 0) f = clamp(((tg.x - px) * sx + (tg.y - py) * sy) / segLen2, 0, 1);
      const qx = px + sx * f;
      const qy = py + sy * f;
      if (Math.hypot(qx - tg.x, qy - tg.y) <= tg.r + 2 && f < bestF) {
        best = tg;
        bestF = f;
      }
    }
    if (best) {
      const f = bestF;
      a.x = px + sx * f;
      a.y = py + sy * f;
      arrowHitsTarget(a, best, px, py, a.vx, a.vy);
      return;
    }

    if (a.stuck) endArrow('stuck');
    else if (a.bounces > MAX_BOUNCES || a.age > MAX_AGE || a.y > H + 300) endArrow('gone');
  }

  function updateTargets(dt) {
    for (let i = 0; i < S.targets.length; i++) {
      const tg = S.targets[i];
      if (!tg.alive) continue;
      if (tg.motion) {
        const p = targetPos(tg, S.t);
        tg.x = p[0];
        tg.y = p[1];
      }
      if (tg.flash > 0) tg.flash -= dt;
      if (tg.fuse > 0) {
        tg.fuse -= dt;
        if (tg.fuse <= 0) explodeTarget(tg);
      }
    }
  }

  function stepWorld(dt) {
    S.t += dt;
    updateTargets(dt);
    if (S.arrow && S.mode === 'playing') updateArrow(dt);

    // idle bow eases back to rest angle
    if (!S.aim.active && !S.arrow) S.bowAngle = lerp(S.bowAngle, IDLE_ANGLE, 0.02);
    if (S.aim.active) S.bowAngle = S.aim.angle;

    // visual updates
    for (let i = S.particles.length - 1; i >= 0; i--) {
      const p = S.particles[i];
      p.life -= dt;
      if (p.life <= 0) { S.particles.splice(i, 1); continue; }
      p.vy += 420 * dt;
      p.vx *= 1 - 0.8 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    for (let i = S.rings.length - 1; i >= 0; i--) {
      S.rings[i].life -= dt;
      if (S.rings[i].life <= 0) S.rings.splice(i, 1);
    }
    for (let i = S.texts.length - 1; i >= 0; i--) {
      const t = S.texts[i];
      t.life -= dt;
      t.y -= 22 * dt;
      if (t.life <= 0) S.texts.splice(i, 1);
    }
    for (let i = S.ghosts.length - 1; i >= 0; i--) {
      S.ghosts[i].life -= dt;
      if (S.ghosts[i].life <= 0) S.ghosts.splice(i, 1);
    }
    if (S.shake > 0) S.shake = Math.max(0, S.shake - 30 * dt);
    if (S.banner) {
      S.banner.t -= dt;
      if (S.banner.t <= 0) S.banner = null;
    }
    // drifting wind streaks
    const wx = S.env.wx;
    const wy = S.env.wy;
    if (Math.abs(wx) + Math.abs(wy) > 1) {
      for (let i = 0; i < S.streaks.length; i++) {
        const s = S.streaks[i];
        s.x += wx * 1.6 * dt;
        s.y += wy * 1.6 * dt;
        if (s.x < -60) s.x = W + 20;
        if (s.x > W + 60) s.x = -20;
        if (s.y < -10) s.y = FLOOR;
        if (s.y > FLOOR + 10) s.y = 0;
      }
    }

    if (S.mode === 'playing') checkStageEnd(dt);
  }

  function checkStageEnd(dt) {
    if (S.arrow || anyFuse()) {
      S.ending = null;
      S.endTimer = 0;
      return;
    }
    if (countAlive() === 0) {
      if (S.ending !== 'clear') { S.ending = 'clear'; S.endTimer = 0.9; }
    } else if (S.ammo <= 0) {
      if (S.ending !== 'fail') { S.ending = 'fail'; S.endTimer = 1.0; }
    } else {
      S.ending = null;
      return;
    }
    S.endTimer -= dt;
    if (S.endTimer <= 0) {
      if (S.ending === 'clear') stageClear();
      else stageFail();
    }
  }

  function starsFor(ammoLeft, acc) {
    let s = 1;
    if (ammoLeft / S.ammoMax >= 0.34) s++;
    if (acc >= 0.65) s++;
    return s;
  }

  function starSvg(on, pop, delay) {
    return '<svg class="' + (on ? 'star-on' : 'star-off') + (on && pop ? ' star-pop' : '') + '" viewBox="0 0 24 24" stroke-width="1.8" stroke-linejoin="round"' +
      (on && pop ? ' style="animation-delay:' + delay + 's"' : '') + ' aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>';
  }

  function starRow(n, pop) {
    let html = '';
    for (let i = 0; i < 3; i++) html += starSvg(i < n, pop, 0.15 + i * 0.18);
    return html;
  }

  function stageClear() {
    cancelAim();
    const bonus = S.ammo * 100;
    const gained = S.score - S.stageStartScore;
    addScore(bonus);
    const acc = S.shots > 0 ? S.hits / S.shots : 0;
    const stars = starsFor(S.ammo, acc);
    const key = String(S.stageIdx + 1);
    if (!save.stars[key] || save.stars[key] < stars) save.stars[key] = stars;
    const last = S.stageIdx >= STAGES.length - 1;
    if (!last) save.unlocked = Math.max(save.unlocked, S.stageIdx + 2);
    persist();
    audio.clear();
    S.mode = last ? 'victory' : 'clear';

    $('clear-score').textContent = String(gained);
    $('clear-bonus').textContent = '+' + bonus;
    $('clear-acc').textContent = Math.round(acc * 100) + '%';
    $('clear-ammo').textContent = S.ammo + ' / ' + S.ammoMax;
    $('clear-total').textContent = String(S.score);
    $('clear-stars').innerHTML = starRow(stars, true);
    $('next-btn').classList.toggle('hidden', last);

    if (last) {
      let total = 0;
      for (let i = 1; i <= STAGES.length; i++) total += save.stars[String(i)] || 0;
      $('victory-score').textContent = String(S.score);
      $('victory-best').textContent = String(save.best);
      $('victory-star-count').textContent = total + ' / ' + STAGES.length * 3;
      $('victory-stars').innerHTML = starRow(Math.round(total / STAGES.length), true);
      showOverlay('victory');
    } else {
      showOverlay('clear');
    }
    updateHud();
  }

  function stageFail() {
    cancelAim();
    persist();
    audio.fail();
    S.mode = 'fail';
    const left = countAlive();
    $('fail-left').textContent = left + (left === 1 ? ' node' : ' nodes');
    $('fail-score').textContent = String(S.score);
    $('fail-best').textContent = String(save.best);
    showOverlay('fail');
  }

  /* ======================================================================
     Overlays / HUD / UI wiring
     ====================================================================== */
  function showOverlay(name) {
    overlays[name].classList.remove('hidden');
    const b = $(primaryBtn[name]);
    if (b) {
      try { b.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }
  }

  function hideOverlay(name) {
    overlays[name].classList.add('hidden');
  }

  function hideAllOverlays() {
    Object.keys(overlays).forEach(function (k) { overlays[k].classList.add('hidden'); });
    S.helpOpen = false;
  }

  function syncPauseButton() {
    $('pause-icon').classList.toggle('hidden', S.paused);
    $('play-icon').classList.toggle('hidden', !S.paused);
    $('pause-btn').setAttribute('aria-label', S.paused ? 'Resume game' : 'Pause game');
  }

  function pauseGame() {
    if (S.mode !== 'playing' || S.paused) return;
    S.paused = true;
    cancelAim();
    $('pause-stage').textContent = (S.stageIdx + 1) + ' - ' + STAGES[S.stageIdx].name;
    showOverlay('pause');
    syncPauseButton();
  }

  function resumeGame() {
    if (!S.paused) return;
    S.paused = false;
    hideOverlay('pause');
    syncPauseButton();
    lastTs = 0;
  }

  function togglePause() {
    if (S.paused) resumeGame();
    else pauseGame();
  }

  function openHelp() {
    if (S.helpOpen) return;
    if (S.mode === 'playing' && !S.paused) pauseGame();
    S.helpOpen = true;
    cancelAim();
    showOverlay('help');
  }

  function closeHelp() {
    if (!S.helpOpen) return;
    S.helpOpen = false;
    hideOverlay('help');
    const target = S.paused ? $('resume-btn') : S.mode === 'menu' ? $('start-btn') : null;
    if (target) {
      try { target.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }
  }

  function toggleSound() {
    audio.ensure();
    audio.setMuted(!audio.muted);
    save.muted = audio.muted;
    persist();
    $('sound-icon-on').classList.toggle('hidden', audio.muted);
    $('sound-icon-off').classList.toggle('hidden', !audio.muted);
    if (!audio.muted) audio.click();
  }

  function buildStageGrid() {
    const grid = $('stage-grid');
    let html = '';
    for (let i = 0; i < STAGES.length; i++) {
      const locked = i + 1 > save.unlocked;
      const stars = save.stars[String(i + 1)] || 0;
      let mini = '';
      if (locked) {
        mini = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>';
      } else {
        for (let k = 0; k < 3; k++) {
          mini += '<svg viewBox="0 0 24 24" class="' + (k < stars ? 'star-on' : 'star-off') + '" stroke-width="2" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>';
        }
      }
      html += '<button type="button" class="stage-tile" data-stage="' + i + '"' + (locked ? ' disabled' : '') +
        ' aria-label="Stage ' + (i + 1) + ' ' + STAGES[i].name + (locked ? ' locked' : '') + '">' +
        '<span class="stage-num">' + (i + 1) + '</span><span class="stage-name">' + STAGES[i].name +
        '</span><span class="mini-stars">' + mini + '</span></button>';
    }
    grid.innerHTML = html;
  }

  function updateAmmoIcons() {
    const box = $('hud-ammo');
    let html = '';
    for (let i = 0; i < S.ammoMax; i++) {
      html += '<svg class="' + (i < S.ammo ? '' : 'spent') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="4" y1="12" x2="20" y2="12"></line><polyline points="14 6 20 12 14 18"></polyline><polyline points="4 12 2 9"></polyline><polyline points="4 12 2 15"></polyline><polyline points="8 12 6 9"></polyline><polyline points="8 12 6 15"></polyline></svg>';
    }
    box.innerHTML = html;
    box.setAttribute('aria-label', S.ammo + ' of ' + S.ammoMax + ' arrows left');
  }

  let lastAmmoKey = '';
  function updateHud() {
    $('hud-stage').textContent = (S.stageIdx + 1) + '/' + STAGES.length;
    $('hud-score').textContent = String(S.score);
    $('hud-best').textContent = String(Math.max(save.best, S.score));
    $('hud-streak').textContent = S.streak > 0 ? S.streak + '  x' + streakMult().toFixed(2) : '0';
    const key = S.ammo + '/' + S.ammoMax + '/' + S.stageIdx;
    if (key !== lastAmmoKey) {
      lastAmmoKey = key;
      updateAmmoIcons();
    }
    const wx = S.env.wx;
    const wy = S.env.wy;
    const mag = Math.hypot(wx, wy);
    const wCard = $('hud-wind-card');
    if (mag < 1) {
      $('wind-val').textContent = 'Calm';
      $('wind-arrow').style.opacity = '0.3';
      wCard.classList.add('calm');
      wCard.classList.remove('windy');
    } else {
      $('wind-val').textContent = String(Math.round(mag / 10));
      $('wind-arrow').style.opacity = '1';
      $('wind-arrow').style.transform = 'rotate(' + (Math.atan2(wy, wx) * 180 / Math.PI) + 'deg)';
      wCard.classList.add('windy');
      wCard.classList.remove('calm');
    }
    $('grav-val').textContent = S.env.gMul.toFixed(2) + 'x';
    const gCard = $('hud-grav-card');
    gCard.classList.toggle('low', S.env.gMul < 0.99);
    gCard.classList.toggle('high', S.env.gMul > 1.01);
    gCard.classList.toggle('norm', S.env.gMul >= 0.99 && S.env.gMul <= 1.01);
  }

  /* ======================================================================
     Rendering
     ====================================================================== */
  function fitCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const cssW = canvas.getBoundingClientRect().width || W;
    uiScale = clamp(560 / cssW, 1, 1.5);
    buildBackground(STAGES[S.stageIdx].accent);
  }

  function glow(color, blur) {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur * dpr;
  }

  function noGlow() {
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
  }

  function buildBackground(accent) {
    const c = document.createElement('canvas');
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    const g = c.getContext('2d');
    g.scale(dpr, dpr);

    const sky = g.createLinearGradient(0, 0, 0, FLOOR);
    sky.addColorStop(0, '#02040c');
    sky.addColorStop(1, '#0a1230');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);

    // distant skyline (deterministic)
    let seed = 7;
    const rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let x = 0; x < W; x += 34) {
      const h = 28 + rnd() * 96;
      const w = 24 + rnd() * 18;
      g.fillStyle = 'rgba(18,28,64,0.7)';
      g.fillRect(x, FLOOR - h, w, h);
      g.fillStyle = rgba(accent, 0.22);
      for (let wy = FLOOR - h + 8; wy < FLOOR - 6; wy += 14) {
        if (rnd() > 0.6) g.fillRect(x + 5 + rnd() * (w - 12), wy, 3, 3);
      }
    }

    // grid
    g.strokeStyle = rgba(accent, 0.07);
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 0; x <= W; x += 40) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, FLOOR); }
    for (let y = 0; y <= FLOOR; y += 40) { g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); }
    g.stroke();

    // floor
    const fl = g.createLinearGradient(0, FLOOR, 0, H);
    fl.addColorStop(0, '#0b1636');
    fl.addColorStop(1, '#03050f');
    g.fillStyle = fl;
    g.fillRect(0, FLOOR, W, H - FLOOR);
    g.strokeStyle = rgba(accent, 0.18);
    g.beginPath();
    for (let i = -12; i <= 12; i++) {
      g.moveTo(W / 2 + i * 60, FLOOR);
      g.lineTo(W / 2 + i * 150, H);
    }
    g.moveTo(0, FLOOR + 14.5); g.lineTo(W, FLOOR + 14.5);
    g.moveTo(0, FLOOR + 28.5); g.lineTo(W, FLOOR + 28.5);
    g.stroke();
    g.shadowColor = accent;
    g.shadowBlur = 12 * dpr;
    g.strokeStyle = accent;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, FLOOR);
    g.lineTo(W, FLOOR);
    g.stroke();

    // frame glow on the side walls
    g.shadowBlur = 0;
    const lw = g.createLinearGradient(0, 0, 14, 0);
    lw.addColorStop(0, rgba(accent, 0.3));
    lw.addColorStop(1, rgba(accent, 0));
    g.fillStyle = lw;
    g.fillRect(0, 0, 14, FLOOR);
    const rw = g.createLinearGradient(W, 0, W - 14, 0);
    rw.addColorStop(0, rgba(accent, 0.3));
    rw.addColorStop(1, rgba(accent, 0));
    g.fillStyle = rw;
    g.fillRect(W - 14, 0, 14, FLOOR);

    bgCanvas = c;
  }

  function drawBarriers() {
    for (let i = 0; i < S.barriers.length; i++) {
      const b = S.barriers[i];
      ctx.save();
      glow(COL.violet, 12);
      ctx.fillStyle = 'rgba(80,40,140,0.55)';
      ctx.strokeStyle = COL.violet;
      ctx.lineWidth = 2;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
      noGlow();
      ctx.strokeStyle = rgba(COL.violet, 0.35);
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (b.w >= b.h) {
        for (let x = b.x + 8; x < b.x + b.w; x += 14) { ctx.moveTo(x, b.y + 1); ctx.lineTo(x - 6, b.y + b.h - 1); }
      } else {
        for (let y = b.y + 8; y < b.y + b.h; y += 14) { ctx.moveTo(b.x + 1, y); ctx.lineTo(b.x + b.w - 1, y - 6); }
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawMotionPath(tg) {
    const m = tg.motion;
    if (!m) return;
    ctx.save();
    ctx.strokeStyle = rgba(COL.green, 0.16);
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    if (m.kind === 'orbit') {
      ctx.arc(m.cx, m.cy, m.r, 0, Math.PI * 2);
    } else {
      ctx.moveTo(m.cx - m.ax, m.cy - m.ay);
      ctx.lineTo(m.cx + m.ax, m.cy + m.ay);
    }
    ctx.stroke();
    ctx.restore();
  }

  function hexPath(r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 3;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function drawTarget(tg, now) {
    const col = targetColor(tg);
    const r = tg.r;
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.004 + tg.seed);
    const flash = tg.flash > 0 ? Math.min(1, tg.flash / 0.2) : 0;
    ctx.save();
    ctx.translate(tg.x, tg.y);

    if (tg.type === 'explosive') {
      ctx.strokeStyle = rgba(COL.pink, 0.2 + 0.1 * pulse);
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, BLAST_R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    glow(col, 12 + 8 * pulse);
    ctx.lineWidth = 3;
    ctx.strokeStyle = col;
    ctx.fillStyle = rgba(col, 0.13);
    if (tg.type === 'armor') {
      hexPath(r);
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.lineWidth = 1.6;
      hexPath(r * 0.6);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (tg.type === 'explosive') {
      const spin = now * 0.002 + tg.seed;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = spin + (i * Math.PI) / 4;
        ctx.moveTo(Math.cos(a) * r * 0.32, Math.sin(a) * r * 0.32);
        ctx.lineTo(Math.cos(a) * r * (0.7 + 0.12 * pulse), Math.sin(a) * r * (0.7 + 0.12 * pulse));
      }
      ctx.stroke();
    }

    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2);
    ctx.fill();
    noGlow();

    if (tg.type === 'armor') {
      const dmg = tg.maxHp - tg.hp;
      ctx.strokeStyle = 'rgba(255,255,255,0.88)';
      ctx.lineWidth = 1.7;
      ctx.lineJoin = 'round';
      for (let k = 0; k < dmg; k++) {
        const a = tg.seed * 1.9 + k * 2.4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.1, Math.sin(a) * r * 0.1);
        ctx.lineTo(Math.cos(a + 0.28) * r * 0.45, Math.sin(a + 0.28) * r * 0.45);
        ctx.lineTo(Math.cos(a - 0.12) * r * 0.7, Math.sin(a - 0.12) * r * 0.7);
        ctx.lineTo(Math.cos(a + 0.18) * r * 1.0, Math.sin(a + 0.18) * r * 1.0);
        ctx.stroke();
      }
      // hit point pips
      const pw = 9;
      const gap = 3;
      const total = tg.maxHp * pw + (tg.maxHp - 1) * gap;
      for (let i = 0; i < tg.maxHp; i++) {
        const px = -total / 2 + i * (pw + gap);
        if (i < tg.hp) {
          ctx.fillStyle = col;
          ctx.fillRect(px, -r - 11, pw, 5);
        } else {
          ctx.strokeStyle = rgba(col, 0.5);
          ctx.lineWidth = 1;
          ctx.strokeRect(px + 0.5, -r - 10.5, pw - 1, 4);
        }
      }
    }

    if (tg.fuse > 0) {
      const blink = Math.floor(tg.fuse * 60) % 2 === 0;
      ctx.fillStyle = blink ? 'rgba(255,255,255,0.8)' : 'rgba(255,61,129,0.5)';
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.05, 0, Math.PI * 2);
      ctx.fill();
    } else if (flash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.6 * flash).toFixed(2) + ')';
      if (tg.type === 'armor') hexPath(r); else { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); }
      ctx.fill();
    }
    ctx.restore();
  }

  function drawArrowShape(x, y, ang, alpha, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.globalAlpha = alpha;
    glow(color || COL.green, 10);
    ctx.strokeStyle = color || '#d9ffe8';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-ARROW_LEN, 0);
    ctx.lineTo(-4, 0);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.lineTo(-7, -4.5);
    ctx.lineTo(-7, 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = COL.green;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-ARROW_LEN, 0); ctx.lineTo(-ARROW_LEN - 4, -4.5);
    ctx.moveTo(-ARROW_LEN + 5, 0); ctx.lineTo(-ARROW_LEN + 1, -4.5);
    ctx.moveTo(-ARROW_LEN, 0); ctx.lineTo(-ARROW_LEN - 4, 4.5);
    ctx.moveTo(-ARROW_LEN + 5, 0); ctx.lineTo(-ARROW_LEN + 1, 4.5);
    ctx.stroke();
    ctx.restore();
  }

  function drawBow(now) {
    const aiming = S.aim.active;
    const ang = aiming ? S.aim.angle : S.bowAngle;
    const frac = aiming ? S.aim.pull / MAX_PULL : 0;
    const pullV = frac * 40;

    // pedestal
    ctx.save();
    glow(COL.cyan, 10);
    ctx.strokeStyle = rgba(COL.cyan, 0.7);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(BOW.x, BOW.y + 20);
    ctx.lineTo(BOW.x, FLOOR);
    ctx.moveTo(BOW.x - 26, FLOOR);
    ctx.lineTo(BOW.x - 8, FLOOR - 16);
    ctx.lineTo(BOW.x + 8, FLOOR - 16);
    ctx.lineTo(BOW.x + 26, FLOOR);
    ctx.stroke();
    noGlow();
    ctx.restore();

    // power ring
    if (aiming) {
      ctx.save();
      ctx.translate(BOW.x, BOW.y);
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.arc(0, 0, 62, 0, Math.PI * 2);
      ctx.stroke();
      const hue = lerp(150, 330, frac);
      glow('hsl(' + hue + ',100%,60%)', 10);
      ctx.strokeStyle = 'hsl(' + hue + ',100%,62%)';
      ctx.beginPath();
      ctx.arc(0, 0, 62, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(BOW.x, BOW.y);
    ctx.rotate(ang);
    const tipY = 50;
    // limbs
    glow(COL.cyan, 14);
    ctx.strokeStyle = COL.cyan;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-8, -tipY);
    ctx.quadraticCurveTo(34, 0, -8, tipY);
    ctx.stroke();
    // grip
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(8, -7);
    ctx.lineTo(8, 7);
    ctx.stroke();
    // string
    ctx.strokeStyle = 'rgba(220,250,255,0.95)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-8, -tipY);
    ctx.lineTo(-pullV - 2, 0);
    ctx.lineTo(-8, tipY);
    ctx.stroke();
    // nocked arrow
    if (S.ammo > 0 && !S.arrow && (S.mode === 'playing' || S.mode === 'menu')) {
      const tail = -pullV - 2;
      glow(COL.green, 8);
      ctx.strokeStyle = '#d9ffe8';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(tail, 0);
      ctx.lineTo(tail + ARROW_LEN - 4, 0);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(tail + ARROW_LEN + 4, 0);
      ctx.lineTo(tail + ARROW_LEN - 7, -4.5);
      ctx.lineTo(tail + ARROW_LEN - 7, 4.5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = COL.green;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(tail, 0); ctx.lineTo(tail - 4, -4.5);
      ctx.moveTo(tail + 5, 0); ctx.lineTo(tail + 1, -4.5);
      ctx.moveTo(tail, 0); ctx.lineTo(tail - 4, 4.5);
      ctx.moveTo(tail + 5, 0); ctx.lineTo(tail + 1, 4.5);
      ctx.stroke();
    }
    noGlow();
    ctx.restore();
  }

  function drawPreview(now) {
    const a = S.aim;
    if (!a.active) return;
    if (a.pull < MIN_PULL) {
      ctx.save();
      ctx.fillStyle = 'rgba(190,225,255,0.75)';
      ctx.font = '600 ' + Math.round(13 * uiScale) + 'px Rajdhani, "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Pull further to arm', BOW.x + 20, BOW.y - 78);
      ctx.restore();
      return;
    }
    const pv = previewPath(a.angle, a.pull, S.env, S.barriers);
    ctx.save();
    glow(COL.cyan, 8);
    const n = pv.pts.length;
    for (let i = 0; i < n; i++) {
      const p = pv.pts[i];
      const isEnd = pv.contact && i === n - 1;
      if (isEnd) continue;
      const k = 1 - (i / Math.max(n, 1)) * 0.65;
      ctx.fillStyle = 'rgba(190,250,255,' + (0.95 * k).toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.6 * (0.6 + 0.4 * k), 0, Math.PI * 2);
      ctx.fill();
    }
    if (pv.contact) {
      const e = pv.pts[n - 1];
      ctx.strokeStyle = COL.violet;
      ctx.lineWidth = 2;
      glow(COL.violet, 10);
      ctx.beginPath();
      ctx.arc(e.x, e.y, 7 + 1.5 * Math.sin(now * 0.008), 0, Math.PI * 2);
      ctx.stroke();
    }
    noGlow();

    // drag handle
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(a.px, a.py);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(a.sx, a.sy, 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(a.px, a.py, 6, 0, Math.PI * 2);
    ctx.fill();

    // readout
    ctx.fillStyle = '#eaf4ff';
    ctx.font = '700 ' + Math.round(13 * uiScale) + 'px Orbitron, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    const deg = Math.round(-a.angle * 180 / Math.PI);
    ctx.fillText('PWR ' + Math.round((a.pull / MAX_PULL) * 100) + '  ANG ' + deg, BOW.x + 20, BOW.y - 78);
    ctx.restore();
  }

  function drawWindGauge() {
    const wx = S.env.wx;
    const wy = S.env.wy;
    const mag = Math.hypot(wx, wy);
    ctx.save();
    ctx.translate(W - 8 - 48 * uiScale, 8 + 16 * uiScale);
    ctx.scale(uiScale, uiScale);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.strokeStyle = 'rgba(0,240,255,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(-48, -16, 96, 32);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#8fa3c4';
    ctx.font = '700 9px Orbitron, "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('WIND', -42, -4);
    ctx.fillStyle = mag < 1 ? '#8fa3c4' : COL.cyan;
    ctx.font = '700 12px Orbitron, "Segoe UI", sans-serif';
    ctx.fillText(mag < 1 ? 'CALM' : String(Math.round(mag / 10)), -42, 11);
    if (mag >= 1) {
      const ang = Math.atan2(wy, wx);
      const len = 8 + Math.min(mag / 180, 1) * 14;
      ctx.translate(26, 0);
      ctx.rotate(ang);
      glow(COL.cyan, 6);
      ctx.strokeStyle = COL.cyan;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-len, 0);
      ctx.lineTo(len, 0);
      ctx.moveTo(len - 6, -5);
      ctx.lineTo(len, 0);
      ctx.lineTo(len - 6, 5);
      ctx.stroke();
    }
    ctx.restore();
  }

  function render(now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (S.shake > 0.1 && !reduceMotion) {
      ctx.translate(rand(-S.shake, S.shake) * 0.5, rand(-S.shake, S.shake) * 0.5);
    }
    if (bgCanvas) ctx.drawImage(bgCanvas, 0, 0, W, H);

    // wind streaks
    if (Math.abs(S.env.wx) + Math.abs(S.env.wy) > 1) {
      ctx.save();
      ctx.strokeStyle = 'rgba(150,230,255,0.14)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const ln = Math.hypot(S.env.wx, S.env.wy);
      const ux = S.env.wx / ln;
      const uy = S.env.wy / ln;
      const f = Math.min(ln / 120, 1.6);
      for (let i = 0; i < S.streaks.length; i++) {
        const s = S.streaks[i];
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - ux * s.len * f, s.y - uy * s.len * f);
      }
      ctx.stroke();
      ctx.restore();
    }

    drawBarriers();
    for (let i = 0; i < S.targets.length; i++) if (S.targets[i].alive) drawMotionPath(S.targets[i]);
    for (let i = 0; i < S.targets.length; i++) if (S.targets[i].alive) drawTarget(S.targets[i], now);

    for (let i = 0; i < S.ghosts.length; i++) {
      const g = S.ghosts[i];
      drawArrowShape(g.x, g.y, g.angle, Math.max(0, g.life / 0.8) * 0.8, '#9fb8c8');
    }

    // arrow + trail
    const a = S.arrow;
    if (a) {
      const tr = a.trail;
      ctx.save();
      ctx.lineCap = 'round';
      for (let i = 1; i < tr.length; i++) {
        const k = i / tr.length;
        ctx.strokeStyle = 'rgba(57,255,122,' + (0.5 * k).toFixed(2) + ')';
        ctx.lineWidth = 1 + 3 * k;
        glow(COL.green, 8 * k);
        ctx.beginPath();
        ctx.moveTo(tr[i - 1].x, tr[i - 1].y);
        ctx.lineTo(tr[i].x, tr[i].y);
        ctx.stroke();
      }
      ctx.restore();
      drawArrowShape(a.x, a.y, Math.atan2(a.vy, a.vx), 1, '#d9ffe8');
    }

    drawBow(now);
    drawPreview(now);

    // particles
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < S.particles.length; i++) {
      const p = S.particles[i];
      const k = clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = k;
      ctx.strokeStyle = p.color;
      ctx.fillStyle = p.color;
      if (p.shard) {
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x - Math.cos(p.rot) * p.size, p.y - Math.sin(p.rot) * p.size);
        ctx.lineTo(p.x + Math.cos(p.rot) * p.size, p.y + Math.sin(p.rot) * p.size);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * k + 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // rings
    ctx.save();
    for (let i = 0; i < S.rings.length; i++) {
      const r = S.rings[i];
      const k = 1 - r.life / r.max;
      ctx.globalAlpha = clamp(1 - k, 0, 1);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * (1 - k * 0.6);
      glow(r.color, 10);
      ctx.beginPath();
      ctx.arc(r.x, r.y, 4 + r.r1 * Math.sqrt(k), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // floating text
    ctx.save();
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    for (let i = 0; i < S.texts.length; i++) {
      const t = S.texts[i];
      const k = clamp(t.life / t.max, 0, 1);
      ctx.globalAlpha = Math.min(1, k * 2.2);
      ctx.font = '800 ' + Math.round(t.size * uiScale) + 'px Orbitron, "Segoe UI", sans-serif';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(2,4,12,0.85)';
      ctx.strokeText(t.text, t.x, t.y);
      glow(t.color, 8);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
      noGlow();
    }
    ctx.restore();
    ctx.restore();

    drawWindGauge();

    // stage banner
    if (S.banner && S.mode === 'playing') {
      const b = S.banner;
      const alpha = clamp(Math.min(b.t / 0.5, (3.6 - b.t) / 0.3), 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';
      const tpx = Math.round(20 * uiScale);
      const spx = Math.round(15 * uiScale);
      const titleTxt = b.title.toUpperCase();
      ctx.font = '800 ' + tpx + 'px Orbitron, "Segoe UI", sans-serif';
      const tw = ctx.measureText(titleTxt).width;
      ctx.font = '600 ' + spx + 'px Rajdhani, "Segoe UI", sans-serif';
      const sw = ctx.measureText(b.sub).width;
      const fit = Math.min(1, 690 / Math.max(tw, sw, 1));
      const boxW = Math.min(W - 20, Math.max(tw, sw) * fit + 36);
      const boxH = (tpx + spx) * fit + 26;
      const by = 46;
      ctx.fillStyle = 'rgba(2,6,16,0.62)';
      ctx.fillRect(W / 2 - boxW / 2, by, boxW, boxH);
      glow(COL.cyan, 12);
      ctx.fillStyle = COL.cyan;
      ctx.font = '800 ' + Math.round(tpx * fit) + 'px Orbitron, "Segoe UI", sans-serif';
      ctx.fillText(titleTxt, W / 2, by + 8 + tpx * fit);
      noGlow();
      ctx.fillStyle = '#d6e6ff';
      ctx.font = '600 ' + Math.round(spx * fit) + 'px Rajdhani, "Segoe UI", sans-serif';
      ctx.fillText(b.sub, W / 2, by + 14 + tpx * fit + spx * fit);
      ctx.restore();
    }
  }

  /* ======================================================================
     Main loop
     ====================================================================== */
  let lastTs = 0;
  let acc = 0;

  function frame(ts) {
    requestAnimationFrame(frame);
    if (!lastTs) lastTs = ts;
    let dt = (ts - lastTs) / 1000;
    lastTs = ts;
    if (!(dt > 0)) dt = 0;
    if (dt > MAX_FRAME) dt = MAX_FRAME;
    if (!S.paused) {
      acc += dt;
      let n = 0;
      while (acc >= STEP && n < MAX_SUBSTEPS) {
        stepWorld(STEP);
        acc -= STEP;
        n++;
      }
      if (n >= MAX_SUBSTEPS) acc = 0;
    }
    render(ts);
  }

  /* ======================================================================
     Input
     ====================================================================== */
  function toLogical(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (W / r.width),
      y: (e.clientY - r.top) * (H / r.height)
    };
  }

  canvas.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button === 2) {
      if (S.aim.active) cancelAim();
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (S.aim.active || !canAim()) return;
    e.preventDefault();
    const p = toLogical(e);
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    beginAim(p.x, p.y, e.pointerId);
  });

  canvas.addEventListener('pointermove', function (e) {
    if (!S.aim.active || e.pointerId !== S.aim.id) return;
    e.preventDefault();
    if (e.pointerType === 'mouse' && (e.buttons & 2)) {
      cancelAim();   // right button pressed while dragging cancels the shot
      return;
    }
    const p = toLogical(e);
    updateAim(p.x, p.y);
  });

  function endPointer(e, doFire) {
    if (!S.aim.active || e.pointerId !== S.aim.id) return;
    const p = toLogical(e);
    updateAim(p.x, p.y);
    if (doFire) fire();
    else cancelAim();
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  }

  canvas.addEventListener('pointerup', function (e) { endPointer(e, true); });
  canvas.addEventListener('pointercancel', function (e) { endPointer(e, false); });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  window.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (k === 'Escape') {
      if (S.helpOpen) closeHelp();
      else if (S.mode === 'playing') togglePause();
      return;
    }
    if (k === 'p' || k === 'P') {
      if (S.mode === 'playing' && !S.helpOpen) togglePause();
    } else if (k === 'r' || k === 'R') {
      if (!S.helpOpen && (S.mode === 'playing' || S.mode === 'fail' || S.mode === 'clear')) restartStage();
    } else if (k === 'm' || k === 'M') {
      toggleSound();
    } else if (k === 'h' || k === 'H') {
      if (S.helpOpen) closeHelp(); else openHelp();
    }
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      cancelAim();
      if (S.mode === 'playing') pauseGame();
    }
    lastTs = 0;
  });
  window.addEventListener('blur', function () {
    cancelAim();
    if (S.mode === 'playing' && !S.helpOpen) pauseGame();
  });
  window.addEventListener('resize', fitCanvas);

  // UI buttons
  $('sound-btn').addEventListener('click', toggleSound);
  $('pause-btn').addEventListener('click', function () {
    if (S.mode === 'playing' && !S.helpOpen) togglePause();
  });
  $('restart-btn').addEventListener('click', function () {
    if (S.mode !== 'menu') restartStage();
  });
  $('help-btn').addEventListener('click', function () {
    if (S.helpOpen) closeHelp(); else openHelp();
  });
  $('help-close-btn').addEventListener('click', closeHelp);
  $('help-x-btn').addEventListener('click', closeHelp);
  $('start-help-btn').addEventListener('click', openHelp);
  $('pause-help-btn').addEventListener('click', openHelp);
  $('start-btn').addEventListener('click', function () {
    startRun(clamp(save.unlocked - 1, 0, STAGES.length - 1));
  });
  $('stage-grid').addEventListener('click', function (e) {
    const tile = e.target.closest ? e.target.closest('.stage-tile') : null;
    if (!tile || tile.disabled) return;
    startRun(parseInt(tile.getAttribute('data-stage'), 10) || 0);
  });
  $('resume-btn').addEventListener('click', resumeGame);
  $('pause-restart-btn').addEventListener('click', restartStage);
  $('pause-menu-btn').addEventListener('click', showMenu);
  $('next-btn').addEventListener('click', function () {
    audio.ensure();
    beginStage(Math.min(S.stageIdx + 1, STAGES.length - 1), S.score);
  });
  $('clear-retry-btn').addEventListener('click', restartStage);
  $('clear-menu-btn').addEventListener('click', showMenu);
  $('fail-retry-btn').addEventListener('click', restartStage);
  $('fail-menu-btn').addEventListener('click', showMenu);
  $('victory-again-btn').addEventListener('click', function () { startRun(0); });
  $('victory-menu-btn').addEventListener('click', showMenu);

  // Clicking the dimmed backdrop of the help modal closes it
  overlays.help.addEventListener('click', function (e) {
    if (e.target === overlays.help) closeHelp();
  });

  /* ======================================================================
     Boot
     ====================================================================== */
  loadSave();
  audio.muted = save.muted;
  $('sound-icon-on').classList.toggle('hidden', audio.muted);
  $('sound-icon-off').classList.toggle('hidden', !audio.muted);
  fitCanvas();
  showMenu();
  requestAnimationFrame(frame);
})();
