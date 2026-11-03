(function () {
  'use strict';

  /* ------------------------------------------------------------------
   * Cyber Maze Runner
   * Grid maze chase: tile-constrained movement, four drones with their
   * own pursuit rules, EMP nodes that flip the chase, procedural audio.
   * Legend: # wall, space void, . energy node, o EMP node, , empty floor,
   *         - pen door (drones only), P player start.
   * ------------------------------------------------------------------ */

  const MAP = [
    '###################',
    '#........#........#',
    '#o##.###.#.###.##o#',
    '#.................#',
    '#.##.#.#####.#.##.#',
    '#....#...#...#....#',
    '####.###.#.###.####',
    '   #.#.......#.#   ',
    '####.#.##-##.#.####',
    '####.#.#,,,#.#.####',
    '####.#.#####.#.####',
    '#.................#',
    '#.##.###.#.###.##.#',
    '#o...#...P...#...o#',
    '##.#.#.#####.#.#.##',
    '#....#...#...#....#',
    '#.######.#.######.#',
    '#.................#',
    '###################'
  ];

  const COLS = MAP[0].length;
  const ROWS = MAP.length;
  const TILE = 28;
  const W = COLS * TILE;
  const H = ROWS * TILE;
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  const DIRS = [[0, -1], [-1, 0], [0, 1], [1, 0]]; // up, left, down, right (tie-break order)
  const PEN = { x: 9, y: 9 };
  const EXIT = { x: 9, y: 7 };
  const PLAYER_START = { x: 9, y: 13 };
  const THEMES = ['#4f7cff', '#a855f7', '#10b981', '#f59e0b'];
  const SCHEDULE = [7, 20, 7, 20, 5, 20, 5, Infinity]; // scatter, chase, scatter, ...
  const START_LIVES = 3;
  const EXTRA_LIFE_EVERY = 10000;

  const DRONE_DEFS = [
    { id: 'blitz', color: '#ff2d6f', corner: [17, 1], start: [9, 7], release: 0 },
    { id: 'phantom', color: '#d946ef', corner: [1, 1], start: [8, 9], release: 2.5 },
    { id: 'vector', color: '#22d3ee', corner: [17, 17], start: [9, 9], release: 5 },
    { id: 'drifter', color: '#fb923c', corner: [1, 17], start: [10, 9], release: 8 }
  ];

  /* ---------------------------- DOM ---------------------------- */
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = W * DPR;
  canvas.height = H * DPR;

  const $ = (id) => document.getElementById(id);
  const el = {
    wrap: $('canvas-wrapper'),
    score: $('score-display'),
    best: $('best-display'),
    level: $('level-display'),
    lives: $('lives-display'),
    start: $('start-overlay'),
    pause: $('pause-overlay'),
    over: $('gameover-overlay'),
    help: $('help-modal'),
    soundBtn: $('sound-btn'),
    soundOn: $('sound-icon-on'),
    soundOff: $('sound-icon-off'),
    pauseBtn: $('pause-btn'),
    finalScore: $('final-score'),
    finalLevel: $('final-level'),
    finalBest: $('final-best'),
    overNote: $('gameover-note')
  };

  /* ------------------------- Storage --------------------------- */
  const store = {
    get(key) {
      try { return window.localStorage.getItem(key); } catch (e) { return null; }
    },
    set(key, value) {
      try { window.localStorage.setItem(key, value); } catch (e) { /* storage unavailable */ }
    }
  };

  /* --------------------------- Audio --------------------------- */
  const sfx = {
    ctx: null,
    enabled: store.get('cyberMazeRunner.sound') !== 'off',
    flip: false,
    ensure() {
      if (!this.enabled) return null;
      if (!this.ctx) {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return null;
        try { this.ctx = new Ctor(); } catch (e) { return null; }
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    },
    tone(freq, dur, type, vol, slideTo, delay) {
      const ac = this.ensure();
      if (!ac) return;
      const t0 = ac.currentTime + (delay || 0);
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol || 0.05, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    },
    pellet() { this.flip = !this.flip; this.tone(this.flip ? 520 : 390, 0.06, 'square', 0.04); },
    emp() { this.tone(180, 0.4, 'sawtooth', 0.07, 900); },
    eat() { this.tone(500, 0.18, 'square', 0.07, 1400); },
    death() { this.tone(640, 1.1, 'sawtooth', 0.08, 60); },
    ready() { [392, 523, 659].forEach((f, i) => this.tone(f, 0.14, 'triangle', 0.07, 0, i * 0.12)); },
    clear() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.08, 0, i * 0.12)); },
    life() { [784, 988, 1319].forEach((f, i) => this.tone(f, 0.12, 'square', 0.06, 0, i * 0.09)); },
    over() { [330, 262, 196, 131].forEach((f, i) => this.tone(f, 0.28, 'sawtooth', 0.06, 0, i * 0.22)); }
  };

  /* --------------------------- State --------------------------- */
  const G = {
    state: 'menu', // menu, ready, playing, dying, levelclear, gameover
    paused: false,
    helpOpen: false,
    helpAutoPaused: false,
    level: 1,
    score: 0,
    best: parseInt(store.get('cyberMazeRunner.best') || '0', 10) || 0,
    lives: START_LIVES,
    nextLife: EXTRA_LIFE_EVERY,
    speed: { player: 7, drone: 6.2 },
    pellets: [],
    pelletsLeft: 0,
    player: null,
    drones: [],
    want: null,
    mode: 'scatter',
    modeIdx: 0,
    modeTimer: 7,
    fright: 0,
    eatCombo: 0,
    timer: 0,
    freeze: 0,
    anim: 0,
    popups: [],
    flashWhite: false,
    layer: null,
    layerWhite: null
  };

  /* ----------------------- Maze helpers ------------------------ */
  function walkable(x, y, e) {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return false;
    const ch = MAP[y][x];
    if (ch === '#' || ch === ' ') return false;
    if (ch === '-') return !!e && (e.state === 'exit' || e.state === 'dead');
    return true;
  }

  function isWall(x, y) {
    return x >= 0 && y >= 0 && x < COLS && y < ROWS && MAP[y][x] === '#';
  }

  // First step of the shortest path from (sx, sy) to (gx, gy) for this entity, or null.
  function bfsDir(sx, sy, gx, gy, e) {
    if (sx === gx && sy === gy) return null;
    const start = sy * COLS + sx;
    const goal = gy * COLS + gx;
    const prev = new Int16Array(COLS * ROWS).fill(-1);
    const queue = [start];
    prev[start] = start;
    for (let head = 0; head < queue.length; head++) {
      const cur = queue[head];
      if (cur === goal) break;
      const cx = cur % COLS;
      const cy = (cur / COLS) | 0;
      for (let i = 0; i < DIRS.length; i++) {
        const nx = cx + DIRS[i][0];
        const ny = cy + DIRS[i][1];
        if (!walkable(nx, ny, e)) continue;
        const ni = ny * COLS + nx;
        if (prev[ni] !== -1) continue;
        prev[ni] = cur;
        queue.push(ni);
      }
    }
    if (prev[goal] === -1) return null;
    let cur = goal;
    while (prev[cur] !== start) cur = prev[cur];
    return [(cur % COLS) - sx, ((cur / COLS) | 0) - sy];
  }

  function newEntity(x, y) {
    return { tx: x, ty: y, dx: 0, dy: 0, prog: 0 };
  }

  const posX = (e) => e.tx + e.dx * e.prog;
  const posY = (e) => e.ty + e.dy * e.prog;

  // Move an entity along the grid. Decisions happen only on tile centres.
  function advance(e, dist, decide, onTile) {
    let guard = 12;
    while (dist > 1e-6 && guard-- > 0) {
      if (e.dx === 0 && e.dy === 0) {
        decide(e);
        if (e.dx === 0 && e.dy === 0) return;
      }
      const room = 1 - e.prog;
      if (dist < room) {
        e.prog += dist;
        return;
      }
      dist -= room;
      e.tx += e.dx;
      e.ty += e.dy;
      e.prog = 0;
      onTile(e);
      decide(e);
    }
  }

  /* ------------------------- Level setup ----------------------- */
  const speedFor = (level) => ({
    player: Math.min(8.6, 7 + 0.12 * (level - 1)),
    drone: Math.min(8.2, 6.2 + 0.4 * (level - 1))
  });
  const frightFor = (level) => Math.max(2, 7 - 0.8 * (level - 1));
  const scheduleFor = (idx) => {
    const base = SCHEDULE[idx];
    if (!isFinite(base)) return base;
    return idx % 2 === 0 ? base * Math.max(0.4, 1 - 0.12 * (G.level - 1)) : base;
  };

  function buildPellets() {
    G.pellets = [];
    G.pelletsLeft = 0;
    for (let y = 0; y < ROWS; y++) {
      const row = [];
      for (let x = 0; x < COLS; x++) {
        const ch = MAP[y][x];
        const v = ch === '.' ? 1 : ch === 'o' ? 2 : 0;
        if (v) G.pelletsLeft++;
        row.push(v);
      }
      G.pellets.push(row);
    }
  }

  function resetActors() {
    G.player = newEntity(PLAYER_START.x, PLAYER_START.y);
    G.player.face = [-1, 0];
    G.player.moving = false;
    G.want = null;
    G.fright = 0;
    G.drones = DRONE_DEFS.map((def) => {
      const d = newEntity(def.start[0], def.start[1]);
      d.id = def.id;
      d.color = def.color;
      d.corner = def.corner;
      d.reverse = false;
      if (def.release === 0) {
        d.state = 'normal';
        d.dx = -1;
      } else {
        d.state = 'pen';
        d.releaseIn = def.release;
      }
      return d;
    });
  }

  function resetModes() {
    G.modeIdx = 0;
    G.mode = 'scatter';
    G.modeTimer = scheduleFor(0);
  }

  function startLevel(n) {
    G.level = n;
    G.speed = speedFor(n);
    buildPellets();
    resetActors();
    resetModes();
    G.popups = [];
    G.flashWhite = false;
    const color = THEMES[(n - 1) % THEMES.length];
    G.layer = buildMazeLayer(color);
    G.layerWhite = buildMazeLayer('#f8fafc');
    G.state = 'ready';
    G.timer = 2.4;
    sfx.ready();
    updateHud();
  }

  function newGame() {
    G.score = 0;
    G.lives = START_LIVES;
    G.nextLife = EXTRA_LIFE_EVERY;
    G.paused = false;
    hideOverlays();
    startLevel(1);
  }

  /* --------------------------- Player -------------------------- */
  function decidePlayer(p) {
    if (G.want && walkable(p.tx + G.want[0], p.ty + G.want[1], null)) {
      p.dx = G.want[0];
      p.dy = G.want[1];
      p.face = [p.dx, p.dy];
    } else if ((p.dx !== 0 || p.dy !== 0) && walkable(p.tx + p.dx, p.ty + p.dy, null)) {
      // keep going
    } else {
      p.dx = 0;
      p.dy = 0;
    }
  }

  function onPlayerTile(p) {
    const v = G.pellets[p.ty][p.tx];
    if (!v) return;
    G.pellets[p.ty][p.tx] = 0;
    G.pelletsLeft--;
    if (v === 2) {
      addScore(50);
      sfx.emp();
      frightenDrones();
    } else {
      addScore(10);
      sfx.pellet();
    }
  }

  function setWant(dir) {
    G.want = dir;
    const p = G.player;
    if (G.state === 'playing' && p && (p.dx !== 0 || p.dy !== 0) && p.prog > 0 &&
        dir[0] === -p.dx && dir[1] === -p.dy) {
      // Reverse mid-tile: swap the tile we are heading for and keep the same position.
      p.tx += p.dx;
      p.ty += p.dy;
      p.dx = -p.dx;
      p.dy = -p.dy;
      p.prog = 1 - p.prog;
      p.face = [p.dx, p.dy];
    }
  }

  /* --------------------------- Drones -------------------------- */
  function chaseTarget(d) {
    const p = G.player;
    const f = p.face;
    switch (d.id) {
      case 'blitz':
        return [p.tx, p.ty];
      case 'phantom':
        return [p.tx + 4 * f[0], p.ty + 4 * f[1]];
      case 'vector': {
        const b = G.drones[0];
        const ax = p.tx + 2 * f[0];
        const ay = p.ty + 2 * f[1];
        return [2 * ax - b.tx, 2 * ay - b.ty];
      }
      default: { // drifter
        const dx = d.tx - p.tx;
        const dy = d.ty - p.ty;
        return dx * dx + dy * dy > 36 ? [p.tx, p.ty] : d.corner;
      }
    }
  }

  function decideDrone(d) {
    const open = [];
    for (let i = 0; i < DIRS.length; i++) {
      if (walkable(d.tx + DIRS[i][0], d.ty + DIRS[i][1], d)) open.push(DIRS[i]);
    }
    if (open.length === 0) {
      d.dx = 0;
      d.dy = 0;
      return;
    }

    if (d.state === 'dead' || d.state === 'exit') {
      const goal = d.state === 'dead' ? PEN : EXIT;
      const step = bfsDir(d.tx, d.ty, goal.x, goal.y, d);
      if (step) {
        d.dx = step[0];
        d.dy = step[1];
        return;
      }
    }

    if (d.reverse) {
      d.reverse = false;
      const back = open.find((o) => o[0] === -d.dx && o[1] === -d.dy);
      if (back) {
        d.dx = back[0];
        d.dy = back[1];
        return;
      }
    }

    const ahead = open.filter((o) => !(o[0] === -d.dx && o[1] === -d.dy));
    const list = ahead.length ? ahead : open;
    let pick = list[0];

    if (d.state === 'frightened') {
      pick = list[Math.floor(Math.random() * list.length)];
    } else {
      const target = G.mode === 'scatter' ? d.corner : chaseTarget(d);
      let best = Infinity;
      for (let i = 0; i < list.length; i++) {
        const nx = d.tx + list[i][0] - target[0];
        const ny = d.ty + list[i][1] - target[1];
        const dist = nx * nx + ny * ny;
        if (dist < best) {
          best = dist;
          pick = list[i];
        }
      }
    }
    d.dx = pick[0];
    d.dy = pick[1];
  }

  function onDroneTile(d) {
    if (d.state === 'exit' && d.tx === EXIT.x && d.ty === EXIT.y) {
      d.state = 'normal';
    } else if (d.state === 'dead' && d.tx === PEN.x && d.ty === PEN.y) {
      d.state = 'exit';
    }
  }

  function frightenDrones() {
    G.fright = frightFor(G.level);
    G.eatCombo = 0;
    G.drones.forEach((d) => {
      if (d.state === 'normal' || d.state === 'frightened') {
        if (d.state === 'normal') d.reverse = true;
        d.state = 'frightened';
      }
    });
  }

  function endFright() {
    G.fright = 0;
    G.drones.forEach((d) => {
      if (d.state === 'frightened') d.state = 'normal';
    });
  }

  function droneSpeed(d) {
    if (d.state === 'frightened') return G.speed.drone * 0.6;
    if (d.state === 'dead') return 14;
    if (d.state === 'exit') return 5;
    return G.speed.drone;
  }

  /* ---------------------------- Update ------------------------- */
  function addScore(n) {
    G.score += n;
    if (G.score > G.best) G.best = G.score;
    if (G.score >= G.nextLife) {
      G.nextLife += EXTRA_LIFE_EVERY;
      G.lives++;
      sfx.life();
      addPopup(posX(G.player) + 0.5, posY(G.player) + 0.5, '1UP', '#34d399');
    }
    updateHud();
  }

  function addPopup(tx, ty, text, color) {
    G.popups.push({ x: tx * TILE, y: ty * TILE, text, color, t: 0 });
  }

  function tickModes(dt) {
    if (G.fright > 0) {
      G.fright -= dt;
      if (G.fright <= 0) endFright();
      return;
    }
    if (!isFinite(G.modeTimer)) return;
    G.modeTimer -= dt;
    if (G.modeTimer <= 0) {
      G.modeIdx++;
      G.mode = G.modeIdx % 2 === 0 ? 'scatter' : 'chase';
      G.modeTimer = scheduleFor(G.modeIdx);
      G.drones.forEach((d) => { if (d.state === 'normal') d.reverse = true; });
    }
  }

  function checkCollisions() {
    const p = G.player;
    const px = posX(p);
    const py = posY(p);
    for (let i = 0; i < G.drones.length; i++) {
      const d = G.drones[i];
      if (d.state !== 'normal' && d.state !== 'frightened') continue;
      if (Math.hypot(posX(d) - px, posY(d) - py) >= 0.62) continue;
      if (d.state === 'frightened') {
        const pts = 200 << Math.min(G.eatCombo, 3);
        G.eatCombo++;
        d.state = 'dead';
        d.reverse = false;
        addPopup(px + 0.5, py + 0.5, String(pts), '#facc15');
        sfx.eat();
        G.freeze = 0.35;
        addScore(pts);
      } else {
        G.state = 'dying';
        G.timer = 1.6;
        sfx.death();
        return;
      }
    }
  }

  function update(dt) {
    G.anim += dt;

    for (let i = G.popups.length - 1; i >= 0; i--) {
      G.popups[i].t += dt;
      if (G.popups[i].t > 1) G.popups.splice(i, 1);
    }

    if (G.state === 'ready') {
      G.timer -= dt;
      if (G.timer <= 0) G.state = 'playing';
      return;
    }

    if (G.state === 'dying') {
      G.timer -= dt;
      if (G.timer <= 0) {
        G.lives--;
        updateHud();
        if (G.lives > 0) {
          resetActors();
          G.state = 'ready';
          G.timer = 1.8;
        } else {
          endGame();
        }
      }
      return;
    }

    if (G.state === 'levelclear') {
      G.timer -= dt;
      G.flashWhite = Math.floor(G.timer * 5) % 2 === 0;
      if (G.timer <= 0) startLevel(G.level + 1);
      return;
    }

    if (G.state !== 'playing') return;

    if (G.freeze > 0) {
      G.freeze -= dt;
      return;
    }

    tickModes(dt);

    const p = G.player;
    advance(p, G.speed.player * dt, decidePlayer, onPlayerTile);
    p.moving = p.dx !== 0 || p.dy !== 0;

    if (G.pelletsLeft <= 0) {
      G.state = 'levelclear';
      G.timer = 2;
      sfx.clear();
      return;
    }

    for (let i = 0; i < G.drones.length; i++) {
      const d = G.drones[i];
      if (d.state === 'pen') {
        d.releaseIn -= dt;
        if (d.releaseIn <= 0) d.state = 'exit';
        else continue;
      }
      advance(d, droneSpeed(d) * dt, decideDrone, onDroneTile);
    }

    checkCollisions();
  }

  function endGame() {
    G.state = 'gameover';
    store.set('cyberMazeRunner.best', String(G.best));
    el.finalScore.textContent = String(G.score);
    el.finalLevel.textContent = String(G.level);
    el.finalBest.textContent = String(G.best);
    el.overNote.textContent = G.score >= G.best && G.score > 0
      ? 'New best score. The drones will remember you.'
      : 'The drones caught you.';
    sfx.over();
    show(el.over);
  }

  /* --------------------------- Rendering ----------------------- */
  function buildMazeLayer(color) {
    const c = document.createElement('canvas');
    c.width = W * DPR;
    c.height = H * DPR;
    const g = c.getContext('2d');
    g.scale(DPR, DPR);
    g.fillStyle = '#04050d';
    g.fillRect(0, 0, W, H);

    g.globalAlpha = 0.12;
    g.fillStyle = color;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (MAP[y][x] === '#' || MAP[y][x] === ' ') g.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
    g.globalAlpha = 1;

    g.strokeStyle = color;
    g.lineWidth = 2;
    g.lineCap = 'round';
    g.shadowColor = color;
    g.shadowBlur = 10;
    g.beginPath();
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (MAP[y][x] !== '#') continue;
        const x0 = x * TILE;
        const y0 = y * TILE;
        if (y > 0 && !isWall(x, y - 1)) { g.moveTo(x0 + 1, y0 + 1); g.lineTo(x0 + TILE - 1, y0 + 1); }
        if (y < ROWS - 1 && !isWall(x, y + 1)) { g.moveTo(x0 + 1, y0 + TILE - 1); g.lineTo(x0 + TILE - 1, y0 + TILE - 1); }
        if (x > 0 && !isWall(x - 1, y)) { g.moveTo(x0 + 1, y0 + 1); g.lineTo(x0 + 1, y0 + TILE - 1); }
        if (x < COLS - 1 && !isWall(x + 1, y)) { g.moveTo(x0 + TILE - 1, y0 + 1); g.lineTo(x0 + TILE - 1, y0 + TILE - 1); }
      }
    }
    g.stroke();

    g.shadowBlur = 8;
    g.shadowColor = '#f472b6';
    g.fillStyle = '#f472b6';
    g.fillRect(EXIT.x * TILE + 3, (EXIT.y + 1) * TILE + TILE / 2 - 2, TILE - 6, 4);
    return c;
  }

  function drawPellets() {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const v = G.pellets[y][x];
        if (!v) continue;
        const cx = x * TILE + TILE / 2;
        const cy = y * TILE + TILE / 2;
        if (v === 1) {
          ctx.fillStyle = '#cfe0ff';
          ctx.beginPath();
          ctx.arc(cx, cy, 2.3, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const pulse = 6.5 + Math.sin(G.anim * 6) * 1.6;
          ctx.save();
          ctx.shadowColor = '#34d399';
          ctx.shadowBlur = 14;
          ctx.fillStyle = '#34d399';
          ctx.beginPath();
          ctx.arc(cx, cy, pulse, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          ctx.fillStyle = '#ecfdf5';
          ctx.beginPath();
          ctx.arc(cx, cy, 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  function drawPlayer() {
    const p = G.player;
    const x = (posX(p) + 0.5) * TILE;
    const y = (posY(p) + 0.5) * TILE;
    const r = TILE * 0.43;
    const ang = Math.atan2(p.face[1], p.face[0]);
    let mouth;
    let radius = r;
    if (G.state === 'dying') {
      const t = Math.min(1, 1 - G.timer / 1.6);
      mouth = 0.15 + t * (Math.PI - 0.15);
    } else {
      mouth = p.moving ? (Math.sin(G.anim * 18) * 0.5 + 0.5) * 0.45 + 0.04 : 0.18;
    }
    if (G.state === 'dying' && G.timer < 0.25) radius = r * (G.timer / 0.25);
    if (radius <= 0.5) return;
    ctx.save();
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, radius, ang + mouth, ang - mouth + Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawDrone(d) {
    const x = (posX(d) + 0.5) * TILE;
    const y = (posY(d) + 0.5) * TILE;
    const r = TILE * 0.42;
    ctx.save();
    ctx.translate(x, y);

    if (d.state !== 'dead') {
      let color = d.color;
      if (d.state === 'frightened') {
        const flash = G.fright < 2 && Math.floor(G.anim * 8) % 2 === 0;
        color = flash ? '#f8fafc' : '#2f45ff';
      }
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, -1, r, Math.PI, 0);
      ctx.lineTo(r, r);
      for (let i = 1; i <= 6; i++) {
        ctx.lineTo(r - i * (2 * r / 6), i % 2 === 1 ? r - 5 : r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    if (d.state === 'frightened') {
      ctx.fillStyle = '#fde68a';
      ctx.fillRect(-r * 0.45, -4, 3.5, 3.5);
      ctx.fillRect(r * 0.45 - 3.5, -4, 3.5, 3.5);
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, 5);
      for (let i = 1; i <= 4; i++) ctx.lineTo(-r * 0.6 + i * (r * 1.2 / 4), i % 2 ? 2 : 5);
      ctx.stroke();
    } else {
      const ox = d.dx * 1.8;
      const oy = d.dy * 1.8;
      [-r * 0.36, r * 0.36].forEach((ex) => {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex, -3, 3.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0b1020';
        ctx.beginPath();
        ctx.arc(ex + ox, -3 + oy, 1.9, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    ctx.restore();
  }

  function drawText(text, y, size, color) {
    ctx.save();
    ctx.font = '700 ' + size + 'px "Space Grotesk", ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = color;
    ctx.fillText(text, W / 2, y);
    ctx.restore();
  }

  function draw() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!G.layer) {
      ctx.fillStyle = '#04050d';
      ctx.fillRect(0, 0, W, H);
      return;
    }
    ctx.drawImage(G.flashWhite ? G.layerWhite : G.layer, 0, 0, W, H);
    drawPellets();

    if (G.state !== 'dying') G.drones.forEach(drawDrone);
    if (G.state !== 'levelclear' || G.flashWhite) drawPlayer();

    ctx.save();
    ctx.font = '700 13px "Space Grotesk", ui-monospace, monospace';
    ctx.textAlign = 'center';
    G.popups.forEach((p) => {
      ctx.globalAlpha = 1 - p.t;
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y - p.t * 22);
    });
    ctx.restore();

    if (G.state === 'ready') {
      drawText(G.level === 1 && G.score === 0 ? 'READY' : 'LEVEL ' + G.level, 11 * TILE + TILE / 2, 22, '#facc15');
    } else if (G.state === 'levelclear') {
      drawText('LEVEL CLEAR', H / 2, 26, '#34d399');
    }
  }

  /* ----------------------------- HUD --------------------------- */
  const HEART = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>';

  function updateHud() {
    el.score.textContent = String(G.score);
    el.best.textContent = String(G.best);
    el.level.textContent = String(G.level);
    el.lives.innerHTML = HEART.repeat(Math.max(0, G.lives));
    el.lives.setAttribute('aria-label', G.lives + ' lives remaining');
  }

  /* -------------------------- Overlays ------------------------- */
  const show = (node) => node.classList.remove('hidden');
  const hide = (node) => node.classList.add('hidden');

  function hideOverlays() {
    [el.start, el.pause, el.over, el.help].forEach(hide);
    G.helpOpen = false;
    G.helpAutoPaused = false;
  }

  function running() {
    return G.state === 'ready' || G.state === 'playing' || G.state === 'dying' || G.state === 'levelclear';
  }

  function pauseGame() {
    if (!running() || G.paused) return;
    G.paused = true;
    show(el.pause);
  }

  function resumeGame() {
    if (!G.paused) return;
    G.paused = false;
    hide(el.pause);
  }

  function openHelp() {
    if (G.helpOpen) return;
    G.helpOpen = true;
    if (running() && !G.paused) {
      G.paused = true;
      G.helpAutoPaused = true;
    }
    show(el.help);
  }

  function closeHelp() {
    if (!G.helpOpen) return;
    G.helpOpen = false;
    hide(el.help);
    if (G.helpAutoPaused) {
      G.helpAutoPaused = false;
      G.paused = false;
    }
  }

  function setSound(on) {
    sfx.enabled = on;
    store.set('cyberMazeRunner.sound', on ? 'on' : 'off');
    el.soundOn.classList.toggle('hidden', !on);
    el.soundOff.classList.toggle('hidden', on);
    el.soundBtn.setAttribute('aria-pressed', String(on));
    if (on) sfx.ensure();
  }

  /* --------------------------- Input --------------------------- */
  const KEYS = {
    ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
    ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
    ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
    ArrowRight: [1, 0], d: [1, 0], D: [1, 0]
  };

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (KEYS[e.key]) {
      e.preventDefault();
      if (!G.paused && !G.helpOpen) setWant(KEYS[e.key]);
      return;
    }
    if (e.key === 'p' || e.key === 'P') {
      if (G.paused && !G.helpOpen) resumeGame(); else pauseGame();
    } else if (e.key === 'Escape') {
      if (G.helpOpen) closeHelp();
      else if (G.paused) resumeGame();
      else pauseGame();
    } else if (e.key === 'm' || e.key === 'M') {
      setSound(!sfx.enabled);
    } else if ((e.key === 'Enter' || e.key === ' ') && !G.helpOpen) {
      if (G.state === 'menu' || G.state === 'gameover') {
        e.preventDefault();
        sfx.ensure();
        newGame();
      }
    }
  });

  let swipe = null;
  el.wrap.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.overlay')) return;
    swipe = { x: e.clientX, y: e.clientY };
  });
  el.wrap.addEventListener('pointermove', (e) => {
    if (!swipe || G.paused) return;
    const dx = e.clientX - swipe.x;
    const dy = e.clientY - swipe.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
    setWant(Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]);
    swipe = { x: e.clientX, y: e.clientY };
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((type) => {
    el.wrap.addEventListener(type, () => { swipe = null; });
  });

  $('start-btn').addEventListener('click', () => { sfx.ensure(); newGame(); });
  $('howto-start-btn').addEventListener('click', openHelp);
  $('restart-btn').addEventListener('click', () => { sfx.ensure(); newGame(); });
  $('restart-pause-btn').addEventListener('click', () => { sfx.ensure(); newGame(); });
  $('resume-btn').addEventListener('click', resumeGame);
  $('help-btn').addEventListener('click', openHelp);
  $('help-close').addEventListener('click', closeHelp);
  $('help-done').addEventListener('click', closeHelp);
  el.pauseBtn.addEventListener('click', () => { if (G.paused) resumeGame(); else pauseGame(); });
  el.soundBtn.addEventListener('click', () => setSound(!sfx.enabled));

  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
  window.addEventListener('pagehide', () => store.set('cyberMazeRunner.best', String(G.best)));

  /* ---------------------------- Loop --------------------------- */
  let last = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0);
    last = ts;
    if (!G.paused) update(dt);
    draw();
  }

  setSound(sfx.enabled);
  G.layer = buildMazeLayer(THEMES[0]);
  G.layerWhite = buildMazeLayer('#f8fafc');
  buildPellets();
  resetActors();
  updateHud();
  requestAnimationFrame(frame);
})();
