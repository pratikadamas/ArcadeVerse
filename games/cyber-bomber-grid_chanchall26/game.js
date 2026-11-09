(function () {
  'use strict';

  /* ======================================================================
   * Cyber Bomber Grid: Blast Protocol
   *
   * Grid arena bomber. The file is organised in layers so the rules can be
   * run without any rendering:
   *   1. constants, seeded RNG, arena generation
   *   2. simulation (movement, charges, chain blasts, sudden death)
   *   3. danger prediction + planner (shared by every bot)
   *   4. bot personalities (hunter, block-breaker, cautious)
   *   5. audio (Web Audio, procedural)
   *   6. renderer (canvas)
   *   7. controller (input, rounds, lives, overlays, fixed timestep loop)
   *
   * Everything in the simulation advances in whole ticks of 1/60 s, so the
   * behaviour does not depend on the display frame rate.
   * ====================================================================== */

  /* ------------------------------ constants ----------------------------- */
  const COLS = 13;
  const ROWS = 11;
  const N = COLS * ROWS;
  const TILE = 48;
  const TPS = 60;
  const STEP_MS = 1000 / TPS;
  const MAX_FRAME_STEPS = 6;

  const FUSE_TICKS = 150;       // 2.5 s from placement to detonation
  const BLAST_TICKS = 36;       // blast cells stay lethal for 0.6 s
  const READY_TICKS = 108;
  const GO_TICKS = 40;
  const ROUND_TICKS = 6000;     // 100 s, then sudden death
  const ENDING_TICKS = 150;
  const SHRINK_EVERY = 10;      // one tile closes every 10 ticks in sudden death
  const SD_HORIZON = 210;       // bots look this far ahead for closing tiles (a full fuse plus blast)
  const DROP_CHANCE = 0.34;
  const BLOCK_DENSITY = 0.66;

  const BASE_RANGE = 2;
  const MAX_RANGE = 7;
  const BASE_CAP = 1;
  const MAX_CAP = 5;
  const PLAYER_SPEED = 4.2;     // tiles per second
  const SPEED_STEP = 0.55;
  const MAX_SPEED_LV = 4;
  const BOT_SPEED = 3.4;
  const BOT_SPEED_STEP = 0.25;
  const BOT_SPEED_MAX = 5.2;
  const INPUT_BUFFER = 9;
  const START_LIVES = 3;
  const INF = 100;              // "no route" marker in the planner

  const T_FLOOR = 0;
  const T_PILLAR = 1;
  const T_BLOCK = 2;
  const T_WALL = 3;
  const DX = [0, 1, 0, -1];     // up, right, down, left
  const DY = [-1, 0, 1, 0];

  const PERSONAS = {
    hunter: { key: 'hunter', name: 'Viper', color: '#ff2d6f', margin: 3, cool: 40, maxEsc: 99 },
    breaker: { key: 'breaker', name: 'Digger', color: '#fbbf24', margin: 3, cool: 25, maxEsc: 99 },
    warden: { key: 'warden', name: 'Warden', color: '#22d3ee', margin: 8, cool: 80, maxEsc: 5 }
  };
  const UPGRADE_NAMES = ['blast range', 'charge capacity', 'speed'];
  const UPGRADE_COLORS = ['#fb923c', '#22d3ee', '#a3e635'];

  /* --------------------------------- rng --------------------------------- */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ----------------------------- arena layout ----------------------------- */
  function isPillarAt(x, y) { return x % 2 === 1 && y % 2 === 1; }
  function inBounds(x, y) { return x >= 0 && y >= 0 && x < COLS && y < ROWS; }

  // Each corner keeps seven tiles clear: the corner, two tiles along each
  // edge and the two diagonal tiles next to the first pillar. A charge placed
  // on the corner always has a tile outside the blast within three steps.
  const CORNERS = [
    { x: 0, y: 0, sx: 1, sy: 1 },
    { x: COLS - 1, y: 0, sx: -1, sy: 1 },
    { x: 0, y: ROWS - 1, sx: 1, sy: -1 },
    { x: COLS - 1, y: ROWS - 1, sx: -1, sy: -1 }
  ];
  const CLEAR = new Uint8Array(N);
  (function markClearZones() {
    const offs = [[0, 0], [1, 0], [2, 0], [0, 1], [0, 2], [2, 1], [1, 2]];
    for (const c of CORNERS) {
      for (const o of offs) CLEAR[(c.y + o[1] * c.sy) * COLS + (c.x + o[0] * c.sx)] = 1;
    }
  })();

  // Order in which tiles turn into walls during sudden death: a clockwise
  // spiral from the outer ring inward, skipping pillars.
  const SPIRAL = (function buildSpiral() {
    const out = [];
    const seen = new Uint8Array(N);
    const add = function (x, y) {
      if (!inBounds(x, y)) return;
      const i = y * COLS + x;
      if (seen[i]) return;
      seen[i] = 1;
      if (!isPillarAt(x, y)) out.push(i);
    };
    const rings = Math.ceil(Math.min(COLS, ROWS) / 2);
    for (let r = 0; r < rings; r++) {
      for (let x = r; x <= COLS - 1 - r; x++) add(x, r);
      for (let y = r; y <= ROWS - 1 - r; y++) add(COLS - 1 - r, y);
      for (let x = COLS - 1 - r; x >= r; x--) add(x, ROWS - 1 - r);
      for (let y = ROWS - 1 - r; y >= r; y--) add(r, y);
    }
    return out;
  })();

  function generateArena(rng, density) {
    const grid = new Uint8Array(N);
    const dens = density === undefined ? BLOCK_DENSITY : density;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const i = y * COLS + x;
        if (isPillarAt(x, y)) grid[i] = T_PILLAR;
        else if (!CLEAR[i] && rng() < dens) grid[i] = T_BLOCK;
      }
    }
    return grid;
  }

  /* ------------------------------ blast shape ----------------------------- */
  // Plus-shaped blast. Pillars and walls stop it before the tile. A block is
  // part of the blast (it gets destroyed) and stops it. `destroyed` is an
  // optional overlay of blocks that are already gone (used by the planner).
  function blastCells(grid, x, y, range, destroyed, cells, blocks) {
    cells = cells || [];
    blocks = blocks || [];
    cells.push(y * COLS + x);
    for (let d = 0; d < 4; d++) {
      for (let k = 1; k <= range; k++) {
        const nx = x + DX[d] * k;
        const ny = y + DY[d] * k;
        if (!inBounds(nx, ny)) break;
        const i = ny * COLS + nx;
        const t = grid[i];
        if (t === T_PILLAR || t === T_WALL) break;
        cells.push(i);
        if (t === T_BLOCK && !(destroyed && destroyed[i])) { blocks.push(i); break; }
      }
    }
    return { cells: cells, blocks: blocks };
  }

  /* ------------------------------- simulation ----------------------------- */
  function emit(sim, type, data) {
    if (sim.onEvent) sim.onEvent(type, data);
  }

  function makeEntity(id, kind, personaKey, x, y, baseSpeed) {
    const persona = personaKey ? PERSONAS[personaKey] : null;
    return {
      id: id,
      kind: kind,
      persona: persona,
      name: kind === 'player' ? 'You' : persona.name,
      color: kind === 'player' ? '#a3e635' : persona.color,
      cx: x, cy: y, x: x, y: y, px: x, py: y, sx: x, sy: y, tx: x, ty: y,
      prog: 0, moving: false, midDone: false, dir: 2,
      alive: true, range: BASE_RANGE, cap: BASE_CAP, speedLv: 0,
      baseSpeed: baseSpeed, speed: baseSpeed,
      held: [], buf: -1, bufLeft: 0, bombReq: false,
      ai: persona ? { wait: 0, lastPlace: -9999, stuck: 0, seenIds: [], seenNext: 0, trapped: false, decideTick: -1 } : null,
      kills: 0, deathTick: -1, killer: -1, cause: ''
    };
  }

  // opts: seed, round, density, blank (pillars only), grid, ready, roundTicks,
  //       autopilot (persona key that drives the player entity), ents.
  function createSim(opts) {
    opts = opts || {};
    const seed = (opts.seed === undefined ? Math.floor(Math.random() * 4294967296) : opts.seed) >>> 0;
    const rng = mulberry32(seed);
    const sim = {
      seed: seed,
      rng: rng,
      aiRng: mulberry32((seed ^ 0x9e3779b9) >>> 0),
      tick: 0,
      round: opts.round || 1,
      phase: 'ready',
      readyLeft: opts.ready === undefined ? READY_TICKS : opts.ready,
      grid: null,
      charges: [],
      chargeAt: new Array(N).fill(null),
      pickAt: new Int8Array(N).fill(-1),
      blast: new Uint8Array(N),
      blastOwner: new Int8Array(N).fill(-1),
      blastCharge: new Int32Array(N).fill(-1),
      nextChargeId: 1,
      ents: [],
      sdStart: 0,
      sdIndex: 0,
      result: null,
      endLeft: 0,
      done: false,
      onEvent: null,
      stats: { placed: [0, 0, 0, 0], blocks: 0, detonations: 0, maxChain: 0, closed: 0 }
    };
    if (opts.grid) sim.grid = Uint8Array.from(opts.grid);
    else if (opts.blank) sim.grid = generateArena(rng, 0);
    else sim.grid = generateArena(rng, opts.density);
    sim.phase = sim.readyLeft > 0 ? 'ready' : 'play';
    sim.sdStart = sim.readyLeft + (opts.roundTicks === undefined ? ROUND_TICKS : opts.roundTicks);

    const botSpeed = Math.min(BOT_SPEED_MAX, BOT_SPEED + BOT_SPEED_STEP * (sim.round - 1));
    const specs = opts.ents || [
      { kind: 'player', persona: opts.autopilot || null, x: 0, y: 0 },
      { kind: 'hunter', persona: 'hunter', x: COLS - 1, y: ROWS - 1 },
      { kind: 'breaker', persona: 'breaker', x: COLS - 1, y: 0 },
      { kind: 'warden', persona: 'warden', x: 0, y: ROWS - 1 }
    ];
    specs.forEach(function (s, i) {
      const sp = s.speed || (s.kind === 'player' ? PLAYER_SPEED : botSpeed);
      sim.ents.push(makeEntity(i, s.kind, s.persona, s.x, s.y, sp));
    });
    return sim;
  }

  function canEnter(sim, e, x, y) {
    if (!inBounds(x, y)) return false;
    const i = y * COLS + x;
    if (sim.grid[i] !== T_FLOOR) return false;
    const c = sim.chargeAt[i];
    if (c && c.pass.indexOf(e.id) < 0) return false;
    return true;
  }

  function applyUpgrade(e, type) {
    if (type === 0) e.range = Math.min(MAX_RANGE, e.range + 1);
    else if (type === 1) e.cap = Math.min(MAX_CAP, e.cap + 1);
    else {
      e.speedLv = Math.min(MAX_SPEED_LV, e.speedLv + 1);
      e.speed = e.baseSpeed + e.speedLv * SPEED_STEP;
    }
  }

  function activeCharges(sim, id) {
    let n = 0;
    for (const c of sim.charges) if (c.owner === id) n++;
    return n;
  }

  function tryPlace(sim, e) {
    if (!e.alive || sim.phase !== 'play') return null;
    const i = e.cy * COLS + e.cx;
    if (sim.grid[i] !== T_FLOOR || sim.chargeAt[i]) return null;
    if (activeCharges(sim, e.id) >= e.cap) return null;
    const c = { id: sim.nextChargeId++, x: e.cx, y: e.cy, owner: e.id, range: e.range, placedTick: sim.tick, det: false, pass: [] };
    // Anyone standing on the tile (or about to step onto it) may walk off it.
    for (const o of sim.ents) {
      if (!o.alive) continue;
      if ((o.cx === c.x && o.cy === c.y) || (o.moving && !o.midDone && o.tx === c.x && o.ty === c.y)) c.pass.push(o.id);
    }
    sim.charges.push(c);
    sim.chargeAt[i] = c;
    sim.stats.placed[e.id] = (sim.stats.placed[e.id] || 0) + 1;
    emit(sim, 'place', { ent: e, charge: c });
    return c;
  }

  function killEntity(sim, e, killerId, cause) {
    if (!e.alive) return;
    e.alive = false;
    e.moving = false;
    e.deathTick = sim.tick;
    e.killer = killerId;
    e.cause = cause;
    if (killerId >= 0 && killerId !== e.id && sim.ents[killerId]) sim.ents[killerId].kills++;
    emit(sim, 'death', { ent: e, killer: killerId, cause: cause });
  }

  function onEnterCell(sim, e) {
    const i = e.cy * COLS + e.cx;
    const t = sim.pickAt[i];
    if (t >= 0) {
      sim.pickAt[i] = -1;
      applyUpgrade(e, t);
      emit(sim, 'pickup', { ent: e, type: t, idx: i });
    }
  }

  function pickManualDirection(sim, e) {
    const h = e.held;
    for (let k = h.length - 1; k >= 0; k--) {
      const d = h[k].d;
      if (canEnter(sim, e, e.cx + DX[d], e.cy + DY[d])) return d;
    }
    if (h.length === 0 && e.bufLeft > 0 && e.buf >= 0 && canEnter(sim, e, e.cx + DX[e.buf], e.cy + DY[e.buf])) {
      const d = e.buf;
      e.buf = -1;
      e.bufLeft = 0;
      return d;
    }
    return -1;
  }

  function pickDirection(sim, e) {
    if (!e.ai) return pickManualDirection(sim, e);
    const ai = e.ai;
    if (ai.wait > 0) { ai.wait--; return -1; }
    const r = aiDecide(sim, e);
    if (r.bomb && tryPlace(sim, e)) {
      ai.lastPlace = sim.tick;
      ai.wait = 1;
      return -1;
    }
    if (r.dir >= 0 && canEnter(sim, e, e.cx + DX[r.dir], e.cy + DY[r.dir])) return r.dir;
    ai.wait = 3;
    return -1;
  }

  function stepEntity(sim, e) {
    e.px = e.x;
    e.py = e.y;
    if (!e.alive) return;
    if (!e.ai) {
      if (e.bufLeft > 0) e.bufLeft--;
      if (e.bombReq) { e.bombReq = false; tryPlace(sim, e); }
    }
    let budget = e.speed / TPS;
    for (let guard = 0; guard < 3; guard++) {
      if (!e.moving) {
        const d = pickDirection(sim, e);
        if (d < 0) break;
        e.sx = e.cx; e.sy = e.cy;
        e.tx = e.cx + DX[d]; e.ty = e.cy + DY[d];
        e.prog = 0;
        e.moving = true;
        e.midDone = false;
        e.dir = d;
      }
      const need = 1 - e.prog;
      if (budget >= need - 1e-9) { budget -= need; e.prog = 1; } else { e.prog += budget; budget = 0; }
      e.x = e.sx + (e.tx - e.sx) * e.prog;
      e.y = e.sy + (e.ty - e.sy) * e.prog;
      if (!e.midDone && e.prog >= 0.5) {
        e.midDone = true;
        e.cx = e.tx;
        e.cy = e.ty;
        onEnterCell(sim, e);
      }
      if (e.prog >= 1) {
        e.moving = false;
        e.prog = 0;
        e.x = e.tx;
        e.y = e.ty;
      }
      if (budget <= 1e-9) break;
    }
  }

  // Detonates `initial` and everything their blasts reach. Iterative (a
  // queue), every charge is flagged before it is queued, so a charge can never
  // go off twice and a long chain cannot overflow the call stack.
  function detonate(sim, initial) {
    const queue = [];
    for (const c of initial) {
      if (!c.det) { c.det = true; queue.push(c); }
    }
    const seenBlock = new Uint8Array(N);
    const destroyed = [];
    const cells = [];
    const blks = [];
    let qi = 0;
    let cellCount = 0;
    while (qi < queue.length) {
      const c = queue[qi++];
      cells.length = 0;
      blks.length = 0;
      blastCells(sim.grid, c.x, c.y, c.range, null, cells, blks);
      for (const i of cells) {
        sim.blast[i] = BLAST_TICKS;
        sim.blastOwner[i] = c.owner;
        sim.blastCharge[i] = c.id;
        cellCount++;
        if (sim.pickAt[i] >= 0) {
          sim.pickAt[i] = -1;
          emit(sim, 'pickupLost', { idx: i });
        }
        const o = sim.chargeAt[i];
        if (o && !o.det) { o.det = true; queue.push(o); }
      }
      for (const b of blks) {
        if (!seenBlock[b]) { seenBlock[b] = 1; destroyed.push(b); }
      }
    }
    for (const c of queue) sim.chargeAt[c.y * COLS + c.x] = null;
    sim.charges = sim.charges.filter(function (c) { return !c.det; });
    sim.stats.detonations += queue.length;
    if (queue.length > sim.stats.maxChain) sim.stats.maxChain = queue.length;
    emit(sim, 'explode', { charges: queue, chain: queue.length, owner: initial[0].owner, single: initial.length === 1, cells: cellCount });
    // Blocks go after the whole chain has resolved, so upgrades they reveal
    // are not caught by the blast that revealed them.
    for (const b of destroyed) {
      sim.grid[b] = T_FLOOR;
      sim.stats.blocks++;
      emit(sim, 'block', { idx: b, owner: sim.blastOwner[b] });
      if (sim.rng() < DROP_CHANCE) {
        const r = sim.rng();
        const type = r < 0.4 ? 0 : (r < 0.75 ? 1 : 2);
        sim.pickAt[b] = type;
        emit(sim, 'drop', { idx: b, type: type });
      }
    }
  }

  function closeCell(sim, i) {
    if (sim.grid[i] === T_WALL || sim.grid[i] === T_PILLAR) return;
    sim.grid[i] = T_WALL;
    sim.stats.closed++;
    const ch = sim.chargeAt[i];
    if (ch) {
      sim.chargeAt[i] = null;
      sim.charges = sim.charges.filter(function (c) { return c !== ch; });
      emit(sim, 'chargeLost', { charge: ch });
    }
    sim.pickAt[i] = -1;
    for (const e of sim.ents) {
      if (!e.alive) continue;
      if (e.cy * COLS + e.cx === i) {
        killEntity(sim, e, -1, 'crush');
      } else if (e.moving && !e.midDone && e.ty * COLS + e.tx === i) {
        // The tile ahead became a wall: turn back to where we came from.
        const sx = e.sx, sy = e.sy;
        e.sx = e.tx; e.sy = e.ty;
        e.tx = sx; e.ty = sy;
        e.prog = 1 - e.prog;
        e.midDone = true;
        e.cx = e.tx; e.cy = e.ty;
      }
    }
    emit(sim, 'close', { idx: i });
  }

  function stepSim(sim) {
    sim.tick++;
    if (sim.phase === 'ready') {
      sim.readyLeft--;
      if (sim.readyLeft <= 0) { sim.phase = 'play'; emit(sim, 'go', {}); }
      return;
    }
    for (const e of sim.ents) stepEntity(sim, e);

    let due = null;
    for (const c of sim.charges) {
      if (sim.tick - c.placedTick >= FUSE_TICKS) (due || (due = [])).push(c);
    }
    if (due) detonate(sim, due);

    for (const e of sim.ents) {
      if (!e.alive) continue;
      const i = e.cy * COLS + e.cx;
      if (sim.blast[i] > 0) killEntity(sim, e, sim.blastOwner[i], 'blast');
    }
    for (let i = 0; i < N; i++) if (sim.blast[i] > 0) sim.blast[i]--;

    while (sim.sdIndex < SPIRAL.length && sim.tick >= sim.sdStart + sim.sdIndex * SHRINK_EVERY) {
      if (sim.sdIndex === 0) emit(sim, 'sdStart', {});
      closeCell(sim, SPIRAL[sim.sdIndex++]);
    }

    for (const c of sim.charges) {
      if (!c.pass.length) continue;
      c.pass = c.pass.filter(function (id) {
        const o = sim.ents[id];
        return o.alive && ((o.cx === c.x && o.cy === c.y) || (o.moving && !o.midDone && o.tx === c.x && o.ty === c.y));
      });
    }

    if (!sim.result) {
      const player = sim.ents[0];
      let botsAlive = false;
      for (let k = 1; k < sim.ents.length; k++) if (sim.ents[k].alive) botsAlive = true;
      if (!player.alive) sim.result = 'lose';
      else if (!botsAlive) sim.result = 'win';
      if (sim.result) {
        sim.endLeft = ENDING_TICKS;
        emit(sim, 'roundEnd', { result: sim.result });
      }
    } else if (--sim.endLeft <= 0) {
      sim.done = true;
    }
  }

  /* --------------------------- danger prediction -------------------------- */
  // Returns, for every tile, the windows (in ticks from now) during which it
  // is lethal. It replays the pending charges in time order with the same
  // blast and chain rules as the simulation, removing blocks as they fall, so
  // chains and blocks opened by earlier blasts are accounted for.
  // `extra` is an optional hypothetical charge {x, y, range} placed right now.
  function makeDanger(sim, extra) {
    const now = sim.tick;
    const wins = new Array(N).fill(null);
    const lastEnd = new Float32Array(N).fill(-Infinity);
    const closeAt = new Float32Array(N).fill(Infinity);
    let any = false;
    const add = function (i, s, e) {
      (wins[i] || (wins[i] = [])).push(s, e);
      if (e > lastEnd[i]) lastEnd[i] = e;
      any = true;
    };
    for (let i = 0; i < N; i++) if (sim.blast[i] > 0) add(i, 0, sim.blast[i] - 1);

    const list = [];
    for (const c of sim.charges) {
      list.push({ x: c.x, y: c.y, r: c.range, t: Math.max(0, c.placedTick + FUSE_TICKS - now), det: false });
    }
    if (extra) list.push({ x: extra.x, y: extra.y, r: extra.range, t: FUSE_TICKS, det: false });
    if (list.length) {
      const destroyed = new Uint8Array(N);
      const cells = [];
      const blks = [];
      for (;;) {
        let T = Infinity;
        for (const c of list) if (!c.det && c.t < T) T = c.t;
        if (T === Infinity) break;
        const queue = [];
        for (const c of list) if (!c.det && c.t <= T) { c.det = true; queue.push(c); }
        const hit = [];
        for (let qi = 0; qi < queue.length; qi++) {
          const c = queue[qi];
          cells.length = 0;
          blks.length = 0;
          blastCells(sim.grid, c.x, c.y, c.r, destroyed, cells, blks);
          for (const i of cells) {
            add(i, T, T + BLAST_TICKS - 1);
            const ix = i % COLS;
            const iy = (i / COLS) | 0;
            for (const o of list) {
              if (!o.det && o.x === ix && o.y === iy) { o.det = true; queue.push(o); }
            }
          }
          for (const b of blks) hit.push(b);
        }
        for (const b of hit) destroyed[b] = 1;
      }
    }
    for (let j = sim.sdIndex; j < SPIRAL.length; j++) {
      const t = sim.sdStart + j * SHRINK_EVERY - now;
      if (t > SD_HORIZON) break;
      closeAt[SPIRAL[j]] = Math.max(0, t);
      any = true;
    }
    return { wins: wins, lastEnd: lastEnd, closeAt: closeAt, any: any };
  }

  function enterableCell(sim, i, blockedIdx) {
    return sim.grid[i] === T_FLOOR && !sim.chargeAt[i] && i !== blockedIdx;
  }

  // Backward dynamic programme over time layers (one layer = one tile of
  // travel at speed S ticks per tile). h[k][i] is the number of steps needed,
  // standing on tile i at layer k, to reach a haven: a tile that is never
  // lethal again. INF means there is no safe way. A tile is safe at layer k if
  // no lethal window overlaps the time the entity occupies it (half a step
  // either side of the layer plus margin M).
  function planDP(sim, d, S, M, blockedIdx) {
    const half = S / 2 + M;
    let maxEnd = 0;
    for (let i = 0; i < N; i++) {
      if (d.lastEnd[i] > maxEnd) maxEnd = d.lastEnd[i];
      if (d.closeAt[i] !== Infinity && d.closeAt[i] > maxEnd) maxEnd = d.closeAt[i];
    }
    const L = Math.min(48, Math.max(3, Math.ceil((maxEnd + half) / S) + 2));
    const h = new Array(L + 1);
    const top = new Int8Array(N).fill(INF);
    for (let i = 0; i < N; i++) if (sim.grid[i] === T_FLOOR && d.closeAt[i] === Infinity) top[i] = 0;
    h[L] = top;
    for (let k = L - 1; k >= 0; k--) {
      const a = k * S - half;
      const b = k * S + half;
      const hk = new Int8Array(N).fill(INF);
      const hn = h[k + 1];
      for (let i = 0; i < N; i++) {
        if (sim.grid[i] !== T_FLOOR) continue;
        if (d.closeAt[i] <= b) continue;
        const w = d.wins[i];
        let ok = true;
        if (w) {
          for (let p = 0; p < w.length; p += 2) {
            if (w[p] <= b && w[p + 1] >= a) { ok = false; break; }
          }
        }
        if (!ok) continue;
        if (d.closeAt[i] === Infinity && d.lastEnd[i] < a) { hk[i] = 0; continue; }
        let best = hn[i];
        const x = i % COLS;
        const y = (i / COLS) | 0;
        for (let m = 0; m < 4; m++) {
          const nx = x + DX[m];
          const ny = y + DY[m];
          if (!inBounds(nx, ny)) continue;
          const j = ny * COLS + nx;
          if (!enterableCell(sim, j, blockedIdx)) continue;
          if (hn[j] < best) best = hn[j];
        }
        hk[i] = best >= INF ? INF : best + 1;
      }
      h[k] = hk;
    }
    return { h: h, L: L, S: S, half: half };
  }

  /* ---------------------------------- bots -------------------------------- */
  function distFrom(sim, sources, blockCost) {
    const dist = new Float32Array(N).fill(Infinity);
    const buckets = [[]];
    for (const s of sources) { dist[s] = 0; buckets[0].push(s); }
    for (let c = 0; c < buckets.length; c++) {
      const b = buckets[c];
      if (!b) continue;
      for (let q = 0; q < b.length; q++) {
        const i = b[q];
        if (dist[i] !== c) continue;
        const x = i % COLS;
        const y = (i / COLS) | 0;
        for (let m = 0; m < 4; m++) {
          const nx = x + DX[m];
          const ny = y + DY[m];
          if (!inBounds(nx, ny)) continue;
          const j = ny * COLS + nx;
          const t = sim.grid[j];
          let cost;
          if (t === T_FLOOR) { if (sim.chargeAt[j]) continue; cost = 1; }
          else if (t === T_BLOCK && blockCost > 0) cost = blockCost;
          else continue;
          const nd = c + cost;
          if (nd < dist[j]) { dist[j] = nd; (buckets[nd] || (buckets[nd] = [])).push(j); }
        }
      }
    }
    return dist;
  }

  function openness(sim, i) {
    const x = i % COLS;
    const y = (i / COLS) | 0;
    let n = 0;
    for (let m = 0; m < 4; m++) {
      const nx = x + DX[m];
      const ny = y + DY[m];
      if (inBounds(nx, ny) && enterableCell(sim, ny * COLS + nx, -1)) n++;
    }
    return n;
  }

  function enemiesOf(sim, e) {
    return sim.ents.filter(function (f) { return f !== e && f.alive; });
  }

  function nearestBy(list, e) {
    let best = null;
    let bd = Infinity;
    for (const f of list) {
      const d = Math.abs(f.cx - e.cx) + Math.abs(f.cy - e.cy);
      if (d < bd) { bd = d; best = f; }
    }
    return best;
  }

  function lineClear(sim, ax, ay, bx, by) {
    if (ax !== bx && ay !== by) return false;
    const dx = Math.sign(bx - ax);
    const dy = Math.sign(by - ay);
    let x = ax + dx;
    let y = ay + dy;
    while (x !== bx || y !== by) {
      if (sim.grid[y * COLS + x] !== T_FLOOR) return false;
      x += dx;
      y += dy;
    }
    return true;
  }

  function exposureTime(d, i) {
    let t = d.closeAt[i];
    const w = d.wins[i];
    if (w) for (let p = 0; p < w.length; p += 2) if (w[p + 1] >= 0 && w[p] < t) t = w[p];
    return t;
  }

  // Safe moves: for each of the four directions and for staying, the
  // planner's value at layer 1 (steps still needed to reach a haven).
  function aiDecide(sim, e) {
    const P = e.persona;
    const ai = e.ai;
    const cur = e.cy * COLS + e.cx;
    const S = TPS / e.speed;
    const d = makeDanger(sim, null);
    const plan = d.any ? planDP(sim, d, S, P.margin, -1) : null;
    const h1 = plan ? plan.h[1] : null;
    ai.decideTick = sim.tick;
    ai.seenIds = sim.charges.map(function (c) { return c.id; });
    ai.seenNext = sim.nextChargeId;
    ai.trapped = !!plan && plan.h[0][cur] >= INF;   // no safe route from here at all

    const viable = [];
    for (let m = 0; m < 4; m++) {
      const nx = e.cx + DX[m];
      const ny = e.cy + DY[m];
      if (!inBounds(nx, ny)) continue;
      const j = ny * COLS + nx;
      if (!enterableCell(sim, j, -1)) continue;
      if (h1 && h1[j] >= INF) continue;
      viable.push(m);
    }
    const ctx = { sim: sim, e: e, P: P, cur: cur, S: S, d: d, plan: plan, h1: h1, viable: viable };

    if (plan && plan.h[0][cur] !== 0) return flee(ctx);

    let r;
    if (e.persona.key === 'hunter') r = decideHunter(ctx);
    else if (e.persona.key === 'breaker') r = decideBreaker(ctx);
    else r = decideWarden(ctx);

    if (r.dir === -1 && !r.bomb) {
      ai.stuck++;
      if (ai.stuck > 40) {
        r = { dir: wander(ctx), bomb: false };
        if (ai.stuck > 60) ai.stuck = 0;
      }
    } else {
      ai.stuck = 0;
    }
    return r;
  }

  function flee(ctx) {
    const { sim, e, cur, h1, viable, d } = ctx;
    let bestDir = -2;
    let bestV = INF;
    let bestOpen = -1;
    const consider = function (dir, j) {
      const v = h1[j];
      if (v >= INF) return;
      const open = openness(sim, j);
      if (v < bestV || (v === bestV && open > bestOpen)) { bestV = v; bestOpen = open; bestDir = dir; }
    };
    consider(-1, cur);
    for (const m of viable) consider(m, (e.cy + DY[m]) * COLS + (e.cx + DX[m]));
    if (bestDir !== -2) return { dir: bestDir, bomb: false };

    // No safe route at all (for example boxed in by someone else's charge):
    // run to whichever neighbour is hit last.
    e.ai.trapped = true;
    let best = -1;
    let bt = exposureTime(d, cur);
    for (let m = 0; m < 4; m++) {
      const nx = e.cx + DX[m];
      const ny = e.cy + DY[m];
      if (!inBounds(nx, ny)) continue;
      const j = ny * COLS + nx;
      if (!enterableCell(sim, j, -1)) continue;
      const t = exposureTime(d, j);
      if (t > bt) { bt = t; best = m; }
    }
    return { dir: best, bomb: false };
  }

  function wander(ctx) {
    const { sim, e, viable } = ctx;
    if (!viable.length) return -1;
    if (viable.indexOf(e.dir) >= 0 && sim.aiRng() < 0.75) return e.dir;
    return viable[Math.floor(sim.aiRng() * viable.length)];
  }

  function stepToward(ctx, dist) {
    const { e, cur, viable } = ctx;
    let best = -1;
    let bv = dist[cur];
    for (const m of viable) {
      const v = dist[(e.cy + DY[m]) * COLS + (e.cx + DX[m])];
      if (v < bv || (v === bv && best >= 0 && m === e.dir)) { bv = v; best = m; }
    }
    return best;
  }

  function pickupGoal(ctx, maxDist) {
    const { sim, cur } = ctx;
    const dMe = distFrom(sim, [cur], 0);
    let bi = -1;
    let bd = maxDist + 1;
    for (let i = 0; i < N; i++) {
      if (sim.pickAt[i] >= 0 && dMe[i] < bd) { bd = dMe[i]; bi = i; }
    }
    if (bi < 0) return null;
    const dir = stepToward(ctx, distFrom(sim, [bi], 0));
    return dir >= 0 ? dir : null;
  }

  // Would a charge here be survivable? Replays the hypothetical charge in the
  // danger model and requires a safe route to a haven.
  function bombOK(ctx) {
    const { sim, e, P, S, cur } = ctx;
    if (sim.chargeAt[cur] || sim.phase !== 'play') return false;
    if (sim.tick - e.ai.lastPlace < P.cool) return false;
    if (activeCharges(sim, e.id) >= e.cap) return false;
    if (sim.tick >= sim.sdStart) {
      // In the closing arena only plant while a decent amount of floor is
      // still safe from the walls; a handful of tiles is no place for a fuse.
      let open = 0;
      for (let i = 0; i < N; i++) if (sim.grid[i] === T_FLOOR && ctx.d.closeAt[i] === Infinity) open++;
      if (open < 22) return false;
    }
    const d2 = makeDanger(sim, { x: e.cx, y: e.cy, range: e.range });
    const plan2 = planDP(sim, d2, S, P.margin, cur);
    const steps = plan2.h[0][cur];
    if (!(steps < INF && steps <= P.maxEsc)) return false;
    // Courtesy between bots: do not plant if it would take away the last
    // escape route of another bot that is already running from a blast
    // (a blocked lane, or a chain that sets this charge off early). The
    // player is deliberately not protected.
    for (const f of sim.ents) {
      if (f === e || !f.alive || !f.ai) continue;
      const fi = f.cy * COLS + f.cx;
      const Sf = TPS / f.speed;
      if (ctx.d.any) {
        const before = planDP(sim, ctx.d, Sf, f.persona.margin, -1).h[0][fi];
        if (before >= INF) continue;            // already beyond help
      } else {
        continue;                               // not running from anything
      }
      if (planDP(sim, d2, Sf, f.persona.margin, cur).h[0][fi] >= INF) return false;
    }
    return true;
  }

  function foeInZone(sim, e, zone, foes) {
    for (const f of foes) if (zone.cells.indexOf(f.cy * COLS + f.cx) >= 0) return true;
    return false;
  }

  function reachablePickupIn(sim, cur, zone) {
    const dMe = distFrom(sim, [cur], 0);
    for (const i of zone.cells) if (sim.pickAt[i] >= 0 && dMe[i] !== Infinity) return true;
    return false;
  }

  function standCells(sim) {
    const out = [];
    for (let i = 0; i < N; i++) {
      if (sim.grid[i] !== T_FLOOR || sim.chargeAt[i]) continue;
      const x = i % COLS;
      const y = (i / COLS) | 0;
      for (let m = 0; m < 4; m++) {
        const nx = x + DX[m];
        const ny = y + DY[m];
        if (inBounds(nx, ny) && sim.grid[ny * COLS + nx] === T_BLOCK) { out.push(i); break; }
      }
    }
    return out;
  }

  // Hunter: heads for the player, digs through blocks on the way, and plants
  // whenever the player is inside its blast.
  function decideHunter(ctx) {
    const { sim, e, cur } = ctx;
    const foes = enemiesOf(sim, e);
    if (!foes.length) return { dir: wander(ctx), bomb: false };
    let target = null;
    for (const f of foes) if (f.kind === 'player') target = f;
    if (!target) target = nearestBy(foes, e);
    const dT = distFrom(sim, [target.cy * COLS + target.cx], 4);
    const zone = blastCells(sim.grid, e.cx, e.cy, e.range, null);
    let blocked = false;
    let bestAll = Infinity;
    let bestIsBlock = false;
    for (let m = 0; m < 4; m++) {
      const nx = e.cx + DX[m];
      const ny = e.cy + DY[m];
      if (!inBounds(nx, ny)) continue;
      const j = ny * COLS + nx;
      const t = sim.grid[j];
      if (t === T_PILLAR || t === T_WALL) continue;
      if (dT[j] < bestAll) { bestAll = dT[j]; bestIsBlock = t === T_BLOCK; }
    }
    blocked = bestIsBlock && bestAll < dT[cur];
    if ((foeInZone(sim, e, zone, foes) || blocked) && bombOK(ctx)) return { dir: -1, bomb: true };
    const pk = pickupGoal(ctx, 3);
    if (pk !== null) return { dir: pk, bomb: false };
    return { dir: stepToward(ctx, dT), bomb: false };
  }

  // Block-breaker: collects upgrades, then goes to the nearest tile that
  // touches a block and plants. Takes a free shot at anyone in its blast.
  function decideBreaker(ctx) {
    const { sim, e, cur } = ctx;
    const foes = enemiesOf(sim, e);
    const zone = blastCells(sim.grid, e.cx, e.cy, e.range, null);
    const foeIn = foeInZone(sim, e, zone, foes);
    if (zone.blocks.length > 0 || foeIn) {
      const risky = !foeIn && reachablePickupIn(sim, cur, zone);
      if (!risky && bombOK(ctx)) return { dir: -1, bomb: true };
    }
    const pk = pickupGoal(ctx, 9);
    if (pk !== null) return { dir: pk, bomb: false };
    const src = standCells(sim);
    if (src.length) return { dir: stepToward(ctx, distFrom(sim, src, 0)), bomb: false };
    return decideHunter(ctx);
  }

  // Cautious: keeps away from enemies and their lines of fire, grabs upgrades,
  // and only plants when the escape is short and there is a wide time margin.
  function decideWarden(ctx) {
    const { sim, e, cur, viable } = ctx;
    const foes = enemiesOf(sim, e);
    const dMe = distFrom(sim, [cur], 0);
    const foeCells = foes.map(function (f) { return f.cy * COLS + f.cx; });
    let nearestFoe = Infinity;
    for (const i of foeCells) if (dMe[i] < nearestFoe) nearestFoe = dMe[i];
    let blocksLeft = false;
    for (let i = 0; i < N; i++) if (sim.grid[i] === T_BLOCK) { blocksLeft = true; break; }
    let pickupsLeft = false;
    for (let i = 0; i < N; i++) if (sim.pickAt[i] >= 0) { pickupsLeft = true; break; }
    const noWork = !blocksLeft && !pickupsLeft;

    // A safe shot is always welcome: plant when an enemy stands in the blast
    // and the (strict) escape check passes.
    const zone0 = blastCells(sim.grid, e.cx, e.cy, e.range, null);
    if (foes.length && foeInZone(sim, e, zone0, foes) && bombOK(ctx)) return { dir: -1, bomb: true };
    // Nothing left to dig and the arena is about to close: stop hiding.
    if (noWork && foes.length && sim.tick >= sim.sdStart - 900) return decideHunter(ctx);

    if (foes.length && nearestFoe <= (noWork ? 6 : 4)) {
      const dF = distFrom(sim, foeCells, 0);
      const score = function (i) {
        const x = i % COLS;
        const y = (i / COLS) | 0;
        const open = openness(sim, i);
        let exp = 0;
        for (const f of foes) {
          const dist = Math.abs(f.cx - x) + Math.abs(f.cy - y);
          if (dist <= f.range + 2 && lineClear(sim, x, y, f.cx, f.cy)) exp++;
        }
        return Math.min(dF[i], 12) * 2 + open - (open <= 1 ? 4 : 0) - exp * 3;
      };
      let best = -1;
      let bs = score(cur) + 0.01;
      for (const m of viable) {
        const s = score((e.cy + DY[m]) * COLS + (e.cx + DX[m])) + (m === e.dir ? 0.02 : 0);
        if (s > bs) { bs = s; best = m; }
      }
      return { dir: best, bomb: false };
    }

    const pk = pickupGoal(ctx, 12);
    if (pk !== null) return { dir: pk, bomb: false };

    if (blocksLeft && (!foes.length || nearestFoe > 6)) {
      const zone = blastCells(sim.grid, e.cx, e.cy, e.range, null);
      if (zone.blocks.length > 0 && !reachablePickupIn(sim, cur, zone) && bombOK(ctx)) return { dir: -1, bomb: true };
      const src = standCells(sim);
      if (src.length) return { dir: stepToward(ctx, distFrom(sim, src, 0)), bomb: false };
    }
    if (foes.length && nearestFoe > 6) {
      return { dir: stepToward(ctx, distFrom(sim, foeCells, 0)), bomb: false };
    }
    return { dir: -1, bomb: false };
  }

  /* ---------------------------------- audio ------------------------------- */
  const audio = { ctx: null, master: null, sfx: null, noiseBuf: null, muted: false };

  function audioInit() {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume().catch(function () {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      audio.ctx = new AC();
      const sdk = window.ArcadeVerse;
      audio.master = sdk && sdk.createMasterGain ? sdk.createMasterGain(audio.ctx) : null;
      if (!audio.master) {
        audio.master = audio.ctx.createGain();
        audio.master.connect(audio.ctx.destination);
      }
      audio.sfx = audio.ctx.createGain();
      audio.sfx.gain.value = audio.muted ? 0 : 0.7;
      audio.sfx.connect(audio.master);
      const len = Math.floor(audio.ctx.sampleRate * 1.2);
      audio.noiseBuf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
      const data = audio.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch (err) {
      audio.ctx = null;
    }
  }

  function setMuted(m) {
    audio.muted = m;
    if (audio.sfx) audio.sfx.gain.value = m ? 0 : 0.7;
  }

  function tone(freq, dur, type, vol, slideTo, delay) {
    if (!audio.ctx || audio.muted) return;
    const t0 = audio.ctx.currentTime + (delay || 0);
    const o = audio.ctx.createOscillator();
    const g = audio.ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(audio.sfx);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
  }

  function noise(dur, vol, f0, f1, delay) {
    if (!audio.ctx || audio.muted || !audio.noiseBuf) return;
    const t0 = audio.ctx.currentTime + (delay || 0);
    const src = audio.ctx.createBufferSource();
    src.buffer = audio.noiseBuf;
    const f = audio.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(f0, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t0 + dur);
    const g = audio.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(audio.sfx);
    src.start(t0);
    src.stop(t0 + dur + 0.03);
  }

  const sfx = {
    place: function () { tone(520, 0.09, 'square', 0.12, 330); },
    boom: function (chain) {
      const n = Math.min(chain, 6);
      for (let k = 0; k < n; k++) {
        noise(0.5, 0.5, 1400, 120, k * 0.07);
        tone(110, 0.4, 'sine', 0.5, 38, k * 0.07);
      }
    },
    pickup: function () { tone(660, 0.08, 'triangle', 0.16); tone(880, 0.08, 'triangle', 0.16, 0, 0.07); tone(1320, 0.12, 'triangle', 0.16, 0, 0.14); },
    botDown: function () { tone(300, 0.25, 'sawtooth', 0.14, 70); },
    playerDown: function () { tone(420, 0.7, 'sawtooth', 0.22, 45); noise(0.5, 0.3, 900, 100); },
    ready: function () { tone(440, 0.1, 'square', 0.12); },
    go: function () { tone(880, 0.22, 'square', 0.14); },
    clear: function () { [523, 659, 784, 1046].forEach(function (f, i) { tone(f, 0.16, 'triangle', 0.18, 0, i * 0.11); }); },
    over: function () { [392, 330, 262, 196].forEach(function (f, i) { tone(f, 0.28, 'sawtooth', 0.14, 0, i * 0.2); }); },
    alarm: function () { tone(180, 0.25, 'square', 0.15, 140); tone(180, 0.25, 'square', 0.15, 140, 0.32); },
    click: function () { tone(700, 0.04, 'square', 0.08); }
  };

  /* --------------------------------- state -------------------------------- */
  const G = {
    state: 'title',        // title | play | over
    sim: null,
    score: 0,
    lives: START_LIVES,
    round: 1,
    kills: 0,
    best: 0,
    paused: false,
    helpOpen: false,
    helpFrom: null,
    held: [],
    acc: 0,
    last: 0,
    bannerUntil: 0,
    goUntil: 0,
    handled: false,
    shake: 0,
    youUntil: 0
  };

  const reduceQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  let reduced = reduceQuery ? reduceQuery.matches : false;
  if (reduceQuery) {
    const onChange = function (ev) { reduced = ev.matches; };
    if (reduceQuery.addEventListener) reduceQuery.addEventListener('change', onChange);
    else if (reduceQuery.addListener) reduceQuery.addListener(onChange);
  }

  function storeGet(key) { try { return window.localStorage.getItem(key); } catch (e) { return null; } }
  function storeSet(key, val) { try { window.localStorage.setItem(key, val); } catch (e) { /* storage unavailable */ } }

  /* --------------------------------- DOM ---------------------------------- */
  const $ = function (id) { return document.getElementById(id); };
  const canvas = $('game-canvas');
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  const W = COLS * TILE;
  const H = ROWS * TILE;
  const FONT = (window.getComputedStyle(document.body).fontFamily) || 'sans-serif';
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);

  const el = {
    score: $('score-display'), best: $('best-display'), round: $('round-display'), lives: $('lives-display'),
    time: $('time-display'), timeCard: $('time-card'), status: $('status-line'),
    statRange: $('stat-range'), statCap: $('stat-cap'), statSpeed: $('stat-speed'),
    botViper: $('bot-viper'), botDigger: $('bot-digger'), botWarden: $('bot-warden'),
    banner: $('banner'), bannerText: $('banner-text'), bannerSub: $('banner-sub'),
    start: $('start-overlay'), pause: $('pause-overlay'), over: $('over-overlay'), help: $('help-modal'),
    pauseBtn: $('pause-btn'), soundBtn: $('sound-btn'), soundOn: $('sound-icon-on'), soundOff: $('sound-icon-off'),
    bomb: $('bomb-btn')
  };
  const hud = { score: -1, best: -1, round: -1, lives: -1, time: '', range: -1, cap: '', speed: -1, urgent: null, bots: '' };

  const HEART = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>';
  const HEART_LOST = HEART.replace('<svg ', '<svg class="lost" ');

  function setStatus(text) {
    if (el.status.textContent !== text) el.status.textContent = text;
  }

  function showBanner(text, sub, cls) {
    el.bannerText.textContent = text;
    el.bannerText.className = 'banner-text' + (cls ? ' ' + cls : '');
    el.bannerSub.textContent = sub || '';
    el.banner.classList.remove('hidden');
    // restart the entrance animation
    el.banner.style.animation = 'none';
    void el.banner.offsetWidth;
    el.banner.style.animation = '';
  }
  function hideBanner() { el.banner.classList.add('hidden'); }

  function fmtTime(ticks) {
    const s = Math.max(0, Math.ceil(ticks / TPS));
    return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
  }

  function updateHud() {
    const sim = G.sim;
    if (hud.score !== G.score) { hud.score = G.score; el.score.textContent = String(G.score); }
    if (hud.best !== G.best) { hud.best = G.best; el.best.textContent = String(G.best); }
    if (hud.round !== G.round) { hud.round = G.round; el.round.textContent = String(G.round); }
    if (hud.lives !== G.lives) {
      hud.lives = G.lives;
      let html = '';
      for (let i = 0; i < START_LIVES; i++) html += i < G.lives ? HEART : HEART_LOST;
      el.lives.innerHTML = html;
      el.lives.setAttribute('aria-label', G.lives + (G.lives === 1 ? ' life' : ' lives'));
    }
    if (!sim) return;
    const p = sim.ents[0];
    const left = Math.max(0, sim.sdStart - sim.tick);
    const sd = sim.tick >= sim.sdStart;
    const timeText = sd ? 'SUDDEN' : fmtTime(Math.min(ROUND_TICKS, left));
    if (hud.time !== timeText) { hud.time = timeText; el.time.textContent = timeText; }
    const urgent = sd || (left <= 10 * TPS && sim.phase === 'play');
    if (hud.urgent !== urgent) { hud.urgent = urgent; el.timeCard.classList.toggle('urgent', urgent); }
    if (hud.range !== p.range) { hud.range = p.range; el.statRange.textContent = String(p.range); }
    const capText = (p.cap - activeCharges(sim, 0)) + '/' + p.cap;
    if (hud.cap !== capText) { hud.cap = capText; el.statCap.textContent = capText; }
    if (hud.speed !== p.speedLv) { hud.speed = p.speedLv; el.statSpeed.textContent = String(p.speedLv); }
    const botKey = sim.ents.slice(1).map(function (b) { return b.alive ? '1' : '0'; }).join('');
    if (hud.bots !== botKey) {
      hud.bots = botKey;
      el.botViper.classList.toggle('dead', botKey[0] === '0');
      el.botDigger.classList.toggle('dead', botKey[1] === '0');
      el.botWarden.classList.toggle('dead', botKey[2] === '0');
      el.botViper.title = 'Viper ' + (botKey[0] === '0' ? '(down)' : '(active)');
      el.botDigger.title = 'Digger ' + (botKey[1] === '0' ? '(down)' : '(active)');
      el.botWarden.title = 'Warden ' + (botKey[2] === '0' ? '(down)' : '(active)');
    }
  }

  /* -------------------------------- particles ----------------------------- */
  const parts = [];
  const floaters = [];

  function burst(tx, ty, color, n, speed, life) {
    if (reduced) return;
    for (let k = 0; k < n && parts.length < 600; k++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.65);
      parts.push({ x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.6 + Math.random() * 0.4), max: life, color: color, size: 2 + Math.random() * 3 });
    }
  }

  function floater(tx, ty, text, color) {
    if (floaters.length > 24) floaters.shift();
    floaters.push({ x: (tx + 0.5) * TILE, y: (ty + 0.2) * TILE, text: text, color: color, life: 1.1 });
  }

  /* ------------------------------ sim callbacks --------------------------- */
  function addScore(n) {
    G.score += n;
    if (G.score > G.best) G.best = G.score;
  }

  function onSimEvent(type, data) {
    const sim = G.sim;
    switch (type) {
      case 'go':
        G.goUntil = sim.tick + GO_TICKS;
        G.youUntil = sim.tick + 150;
        showBanner('Go', '', '');
        setStatus('Round ' + G.round + ' started. Destroy all three bots.');
        sfx.go();
        break;
      case 'place':
        if (data.ent.id === 0) sfx.place();
        break;
      case 'explode': {
        sfx.boom(data.chain);
        if (!reduced) G.shake = Math.min(9, G.shake + 2 + data.chain * 1.2);
        for (const c of data.charges) burst(c.x, c.y, '#fbbf24', 10, 220, 0.5);
        if (data.single && data.owner === 0 && data.chain >= 2) {
          const bonus = 50 * (data.chain - 1);
          addScore(bonus);
          const c0 = data.charges[0];
          floater(c0.x, c0.y, 'Chain +' + bonus, '#fbbf24');
          setStatus('Chain reaction: ' + data.chain + ' charges. Bonus ' + bonus + '.');
        }
        break;
      }
      case 'block':
        burst(data.idx % COLS, (data.idx / COLS) | 0, '#c084fc', 7, 160, 0.55);
        if (data.owner === 0) addScore(10);
        break;
      case 'drop':
        burst(data.idx % COLS, (data.idx / COLS) | 0, UPGRADE_COLORS[data.type], 6, 110, 0.5);
        break;
      case 'pickupLost':
        burst(data.idx % COLS, (data.idx / COLS) | 0, '#94a3b8', 6, 120, 0.45);
        break;
      case 'pickup':
        burst(data.ent.cx, data.ent.cy, UPGRADE_COLORS[data.type], 12, 170, 0.5);
        if (data.ent.id === 0) {
          addScore(50);
          sfx.pickup();
          const p = data.ent;
          const lvl = data.type === 0 ? p.range : (data.type === 1 ? p.cap : p.speedLv);
          setStatus('Upgrade collected: ' + UPGRADE_NAMES[data.type] + ' ' + lvl + '.');
          floater(p.cx, p.cy, '+50', UPGRADE_COLORS[data.type]);
        }
        break;
      case 'death': {
        const e = data.ent;
        burst(e.cx, e.cy, e.color, 26, 260, 0.8);
        if (!reduced) G.shake = Math.min(9, G.shake + 4);
        if (e.id === 0) {
          sfx.playerDown();
          let why = 'You were caught in a blast.';
          if (data.cause === 'crush') why = 'The closing arena crushed you.';
          else if (data.killer === 0) why = 'You were caught in your own blast.';
          else if (data.killer > 0) why = 'You were caught in ' + G.sim.ents[data.killer].name + "'s blast.";
          G.deathNote = why;
        } else {
          sfx.botDown();
          if (data.killer === 0) {
            addScore(300);
            G.kills++;
            floater(e.cx, e.cy, '+300', '#ff2d6f');
            setStatus(e.name + ' destroyed. 300 points.');
          } else if (data.killer === e.id) {
            setStatus(e.name + ' was caught in its own blast.');
          } else if (data.cause === 'crush') {
            setStatus(e.name + ' was crushed by the closing arena.');
          } else {
            setStatus(e.name + ' was destroyed.');
          }
        }
        break;
      }
      case 'sdStart':
        sfx.alarm();
        showBanner('Sudden death', 'The arena is closing in', 'bad');
        G.bannerUntil = sim.tick + 110;
        setStatus('Sudden death. The outer tiles are turning into walls.');
        break;
      case 'roundEnd':
        onRoundEnd(data.result);
        break;
      default:
        break;
    }
  }

  function onRoundEnd(result) {
    const sim = G.sim;
    if (result === 'win') {
      const secs = Math.floor(Math.max(0, sim.sdStart - sim.tick) / TPS);
      const bonus = 500 + 5 * secs;
      addScore(bonus);
      sfx.clear();
      showBanner('Round clear', '+' + bonus + ' points', 'good');
      setStatus('Round ' + G.round + ' clear. Bonus ' + bonus + ' points.');
    } else {
      G.lives = Math.max(0, G.lives - 1);
      const note = G.deathNote || 'You were eliminated.';
      if (G.lives > 0) {
        showBanner('Eliminated', G.lives + (G.lives === 1 ? ' life left' : ' lives left'), 'bad');
        setStatus(note + ' ' + G.lives + (G.lives === 1 ? ' life left.' : ' lives left.'));
      } else {
        showBanner('Eliminated', 'No lives left', 'bad');
        setStatus(note + ' No lives left.');
      }
    }
    G.bannerUntil = sim.tick + ENDING_TICKS;
    storeSet('cyberBomberGridBest', String(G.best));
  }

  /* ------------------------------ round control --------------------------- */
  function newRound() {
    const sim = createSim({ round: G.round });
    sim.ents[0].held = G.held;
    sim.onEvent = onSimEvent;
    G.sim = sim;
    G.acc = 0;
    G.deathNote = '';
    G.shake = 0;
    G.bannerUntil = 0;
    G.goUntil = 0;
    G.youUntil = 0;
    G.handled = false;
    parts.length = 0;
    floaters.length = 0;
    hud.bots = '';
    sfx.ready();
    showBanner('Round ' + G.round, 'Get ready', '');
    setStatus('Round ' + G.round + '. Get ready.');
  }

  function startRun() {
    audioInit();
    G.score = 0;
    G.lives = START_LIVES;
    G.round = 1;
    G.kills = 0;
    G.state = 'play';
    G.paused = false;
    G.helpOpen = false;
    el.start.classList.add('hidden');
    el.pause.classList.add('hidden');
    el.over.classList.add('hidden');
    el.help.classList.add('hidden');
    newRound();
    refreshPauseButton();
  }

  function gameOver() {
    G.state = 'over';
    hideBanner();
    sfx.over();
    storeSet('cyberBomberGridBest', String(G.best));
    $('final-score').textContent = String(G.score);
    $('final-round').textContent = String(G.round);
    $('final-kills').textContent = String(G.kills);
    $('final-best').textContent = String(G.best);
    $('over-note').textContent = G.deathNote || 'All lives lost.';
    el.over.classList.remove('hidden');
    setStatus('Run over. Final score ' + G.score + '.');
    $('again-btn').focus({ preventScroll: true });
  }

  function afterStep() {
    const sim = G.sim;
    if (sim.phase === 'play' && G.bannerUntil && sim.tick >= G.bannerUntil && sim.result === null) {
      G.bannerUntil = 0;
      hideBanner();
    }
    if (G.goUntil && sim.tick >= G.goUntil) {
      G.goUntil = 0;
      if (!G.bannerUntil) hideBanner();
    }
    if (sim.done && !G.handled) {
      G.handled = true;
      if (sim.result === 'win') {
        G.round++;
        G.handled = false;
        newRound();
      } else if (G.lives <= 0) {
        gameOver();
      } else {
        G.handled = false;
        newRound();
      }
    }
  }

  /* --------------------------- pause, help, sound ------------------------- */
  function refreshPauseButton() {
    const on = G.paused;
    el.pauseBtn.setAttribute('aria-label', on ? 'Resume game' : 'Pause game');
    el.pauseBtn.title = on ? 'Resume (P)' : 'Pause (P)';
  }

  function pauseGame(force) {
    if (G.state !== 'play' || G.paused) return;
    G.paused = true;
    G.held.length = 0;
    updatePadVisual();
    el.pause.classList.remove('hidden');
    refreshPauseButton();
    setStatus('Paused.');
    if (!force) $('resume-btn').focus({ preventScroll: true });
  }

  function resumeGame() {
    if (G.state !== 'play' || !G.paused) return;
    G.paused = false;
    G.acc = 0;
    el.pause.classList.add('hidden');
    refreshPauseButton();
    setStatus('Resumed.');
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }

  function togglePause() {
    if (G.state !== 'play') return;
    if (G.paused) resumeGame(); else pauseGame(false);
  }

  function openHelp() {
    if (G.helpOpen) return;
    G.helpOpen = true;
    G.helpFrom = document.activeElement;
    G.held.length = 0;
    updatePadVisual();
    if (G.state === 'play' && !G.paused) pauseGame(true);
    el.help.classList.remove('hidden');
    $('help-close').focus({ preventScroll: true });
  }

  function closeHelp() {
    if (!G.helpOpen) return;
    G.helpOpen = false;
    el.help.classList.add('hidden');
    let target = G.helpFrom;
    if (!target || !document.body.contains(target) || target.offsetParent === null) {
      target = G.paused ? $('resume-btn') : (G.state === 'title' ? $('start-btn') : null);
    }
    if (target && target.focus) target.focus({ preventScroll: true });
  }

  function toggleSound() {
    audioInit();
    setMuted(!audio.muted);
    el.soundOn.classList.toggle('hidden', audio.muted);
    el.soundOff.classList.toggle('hidden', !audio.muted);
    el.soundBtn.setAttribute('aria-pressed', audio.muted ? 'true' : 'false');
    el.soundBtn.setAttribute('aria-label', audio.muted ? 'Unmute sound effects' : 'Mute sound effects');
    storeSet('cyberBomberGridMuted', audio.muted ? '1' : '0');
    setStatus(audio.muted ? 'Sound off.' : 'Sound on.');
    if (!audio.muted) sfx.click();
  }

  /* ---------------------------------- input ------------------------------- */
  const KEY_DIR = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3 };

  function pressDir(d, src) {
    const p = G.sim && G.sim.ents[0];
    for (let k = G.held.length - 1; k >= 0; k--) if (G.held[k].s === src) G.held.splice(k, 1);
    G.held.push({ d: d, s: src });
    if (p) { p.buf = d; p.bufLeft = INPUT_BUFFER; }
    updatePadVisual();
  }

  function releaseDir(src) {
    for (let k = G.held.length - 1; k >= 0; k--) if (G.held[k].s === src) G.held.splice(k, 1);
    updatePadVisual();
  }

  function requestBomb() {
    if (G.state !== 'play' || G.paused || G.helpOpen || !G.sim) return;
    audioInit();
    G.sim.ents[0].bombReq = true;
  }

  function updatePadVisual() {
    const btns = document.querySelectorAll('.pad-btn');
    for (const b of btns) {
      const d = Number(b.getAttribute('data-dir'));
      let on = false;
      for (const h of G.held) if (h.d === d && h.s.charAt(0) === 'p') on = true;
      b.classList.toggle('on', on);
    }
  }

  function isInteractive(target) {
    return !!(target && target.closest && target.closest('button, a, input, select, textarea'));
  }

  window.addEventListener('keydown', function (ev) {
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const code = ev.code;
    if (G.helpOpen) {
      if (code === 'Escape' || code === 'KeyH') { ev.preventDefault(); closeHelp(); }
      return;
    }
    if (code === 'KeyM') { toggleSound(); return; }
    if (code === 'KeyH') { openHelp(); return; }
    if (G.state === 'title') {
      if ((code === 'Enter' || code === 'Space') && !isInteractive(ev.target)) { ev.preventDefault(); startRun(); }
      return;
    }
    if (G.state === 'over') {
      if ((code === 'Enter' || code === 'Space' || code === 'KeyR') && !isInteractive(ev.target)) { ev.preventDefault(); startRun(); }
      else if (code === 'KeyR') startRun();
      return;
    }
    // state === 'play'
    if (code === 'KeyP' || code === 'Escape') { ev.preventDefault(); togglePause(); return; }
    if (code === 'KeyR') { ev.preventDefault(); startRun(); return; }
    if (G.paused) return;
    if (code in KEY_DIR) {
      ev.preventDefault();
      if (!ev.repeat) pressDir(KEY_DIR[code], 'k' + code);
      return;
    }
    if (code === 'Space') {
      ev.preventDefault();
      if (!ev.repeat) requestBomb();
    }
  });

  window.addEventListener('keyup', function (ev) {
    if (ev.code in KEY_DIR) releaseDir('k' + ev.code);
    else if (ev.code === 'Space' && G.state === 'play' && !G.helpOpen) ev.preventDefault();
  });

  window.addEventListener('blur', function () {
    G.held.length = 0;
    updatePadVisual();
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) pauseGame(true);
  });

  // Touch pad: pointer events so touch, pen and mouse all work.
  document.querySelectorAll('.pad-btn').forEach(function (btn) {
    const d = Number(btn.getAttribute('data-dir'));
    const src = 'p' + d;
    btn.addEventListener('pointerdown', function (ev) {
      ev.preventDefault();
      if (G.state !== 'play' || G.paused || G.helpOpen) return;
      audioInit();
      try { btn.setPointerCapture(ev.pointerId); } catch (e) { /* not supported */ }
      pressDir(d, src);
    });
    const up = function () { releaseDir(src); };
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('lostpointercapture', up);
    btn.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
  });

  el.bomb.addEventListener('pointerdown', function (ev) {
    ev.preventDefault();
    requestBomb();
  });
  el.bomb.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });

  function onClick(id, fn) {
    $(id).addEventListener('click', function (ev) {
      audioInit();
      fn();
      if (ev.detail > 0 && ev.currentTarget.blur) ev.currentTarget.blur();
    });
  }
  onClick('start-btn', startRun);
  onClick('howto-start-btn', openHelp);
  onClick('howto-pause-btn', openHelp);
  onClick('pause-btn', togglePause);
  onClick('resume-btn', resumeGame);
  onClick('restart-btn', startRun);
  onClick('restart-pause-btn', startRun);
  onClick('again-btn', startRun);
  onClick('sound-btn', toggleSound);
  onClick('help-btn', openHelp);
  onClick('help-close', closeHelp);
  onClick('help-done', closeHelp);

  /* -------------------------------- renderer ------------------------------ */
  function rr(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function makeLayer(w, h, fn) {
    const cv = document.createElement('canvas');
    cv.width = Math.round(w * DPR);
    cv.height = Math.round(h * DPR);
    const c = cv.getContext('2d');
    c.scale(DPR, DPR);
    fn(c);
    return cv;
  }

  function drawPillar(c, x, y) {
    const g = c.createLinearGradient(x, y, x + TILE, y + TILE);
    g.addColorStop(0, '#3a4672');
    g.addColorStop(1, '#141a36');
    rr(c, x + 3, y + 3, TILE - 6, TILE - 6, 6);
    c.fillStyle = g;
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = 'rgba(79,124,255,0.7)';
    c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.10)';
    c.lineWidth = 1;
    rr(c, x + 9, y + 9, TILE - 18, TILE - 18, 3);
    c.stroke();
    c.fillStyle = 'rgba(148,163,184,0.75)';
    for (const o of [[7, 7], [TILE - 7, 7], [7, TILE - 7], [TILE - 7, TILE - 7]]) {
      c.beginPath();
      c.arc(x + o[0], y + o[1], 1.8, 0, Math.PI * 2);
      c.fill();
    }
  }

  const floorLayer = makeLayer(W, H, function (c) {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        c.fillStyle = (x + y) % 2 ? '#080c1f' : '#0b1128';
        c.fillRect(x * TILE, y * TILE, TILE, TILE);
        c.strokeStyle = 'rgba(79,124,255,0.07)';
        c.lineWidth = 1;
        c.strokeRect(x * TILE + 0.5, y * TILE + 0.5, TILE - 1, TILE - 1);
        if (isPillarAt(x, y)) drawPillar(c, x * TILE, y * TILE);
      }
    }
  });

  const blockSprite = makeLayer(TILE, TILE, function (c) {
    const p = 4;
    const s = TILE - 8;
    const g = c.createLinearGradient(p, p, p + s, p + s);
    g.addColorStop(0, '#6d3fb5');
    g.addColorStop(1, '#2a1650');
    rr(c, p, p, s, s, 7);
    c.fillStyle = g;
    c.fill();
    c.save();
    c.clip();
    c.strokeStyle = 'rgba(255,255,255,0.12)';
    c.lineWidth = 3;
    for (let k = -3; k <= 4; k++) {
      c.beginPath();
      c.moveTo(p + k * 12, p + s);
      c.lineTo(p + k * 12 + s, p);
      c.stroke();
    }
    c.restore();
    rr(c, p, p, s, s, 7);
    c.lineWidth = 2;
    c.strokeStyle = 'rgba(192,132,252,0.8)';
    c.stroke();
    c.fillStyle = 'rgba(216,180,254,0.9)';
    rr(c, TILE / 2 - 5, TILE / 2 - 5, 10, 10, 3);
    c.fill();
  });

  const wallSprite = makeLayer(TILE, TILE, function (c) {
    c.fillStyle = '#1b0a12';
    c.fillRect(0, 0, TILE, TILE);
    c.save();
    c.beginPath();
    c.rect(2, 2, TILE - 4, TILE - 4);
    c.clip();
    c.strokeStyle = 'rgba(239,68,68,0.75)';
    c.lineWidth = 6;
    for (let k = -2; k <= 6; k++) {
      c.beginPath();
      c.moveTo(k * 14, TILE);
      c.lineTo(k * 14 + TILE, 0);
      c.stroke();
    }
    c.restore();
    c.strokeStyle = '#ef4444';
    c.lineWidth = 2;
    c.strokeRect(1, 1, TILE - 2, TILE - 2);
  });

  function drawPickup(c, type, cx, cy, t) {
    const bob = reduced ? 0 : Math.sin(t * 4) * 2;
    const col = UPGRADE_COLORS[type];
    c.save();
    c.translate(cx, cy + bob);
    c.fillStyle = 'rgba(8,12,31,0.92)';
    rr(c, -16, -16, 32, 32, 8);
    c.fill();
    c.lineWidth = 2.5;
    c.strokeStyle = col;
    c.stroke();
    c.strokeStyle = col;
    c.fillStyle = col;
    c.lineWidth = 3;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    if (type === 0) {
      c.beginPath();
      c.moveTo(0, -10); c.lineTo(0, 10);
      c.moveTo(-10, 0); c.lineTo(10, 0);
      c.stroke();
      c.beginPath();
      c.arc(0, 0, 4, 0, Math.PI * 2);
      c.fill();
    } else if (type === 1) {
      c.beginPath();
      c.arc(-3, 3, 7, 0, Math.PI * 2);
      c.stroke();
      c.beginPath();
      c.moveTo(4, -9); c.lineTo(4, -2);
      c.moveTo(0.5, -5.5); c.lineTo(7.5, -5.5);
      c.stroke();
    } else {
      c.beginPath();
      c.moveTo(3, -11); c.lineTo(-7, 2); c.lineTo(0, 2); c.lineTo(-3, 11); c.lineTo(8, -3); c.lineTo(1, -3); c.closePath();
      c.fill();
    }
    c.restore();
  }

  function drawCharge(c, ch, tick) {
    const cx = (ch.x + 0.5) * TILE;
    const cy = (ch.y + 0.5) * TILE;
    const age = tick - ch.placedTick;
    const left = FUSE_TICKS - age;
    const urgency = Math.min(1, Math.max(0, age / FUSE_TICKS));
    const pulse = reduced ? 0 : (Math.sin((age / TPS) * (1.4 + urgency * 7) * Math.PI * 2) * 0.5 + 0.5);
    const r = TILE * (0.27 + 0.045 * pulse);
    const hot = left < 45;
    const ring = hot ? '#ff4d4d' : (urgency > 0.6 ? '#fb7c3c' : '#fbbf24');
    const flash = hot && !reduced && ((left >> 2) & 1) === 0;
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.beginPath();
    c.ellipse(cx, cy + TILE * 0.27, r * 0.95, r * 0.4, 0, 0, Math.PI * 2);
    c.fill();
    const g = c.createRadialGradient(cx - r * 0.3, cy - r * 0.35, 2, cx, cy, r);
    g.addColorStop(0, flash ? '#ffffff' : '#3b4468');
    g.addColorStop(1, flash ? '#ffd0d0' : '#0b1020');
    c.fillStyle = g;
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 3;
    c.strokeStyle = ring;
    c.stroke();
    // fuse and spark
    c.strokeStyle = '#94a3b8';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(cx + r * 0.5, cy - r * 0.8);
    c.quadraticCurveTo(cx + r * 0.9, cy - r * 1.3, cx + r * 1.15, cy - r * 1.15);
    c.stroke();
    const sparkR = reduced ? 3 : 2.5 + pulse * 2;
    c.fillStyle = hot ? '#ffffff' : '#fde047';
    c.beginPath();
    c.arc(cx + r * 1.15, cy - r * 1.15, sparkR, 0, Math.PI * 2);
    c.fill();
  }

  function drawBlasts(c, sim) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < N; i++) {
      const b = sim.blast[i];
      if (b <= 0) continue;
      const f = b / BLAST_TICKS;
      const x = (i % COLS) * TILE;
      const y = ((i / COLS) | 0) * TILE;
      c.fillStyle = 'rgba(255,45,111,' + (0.28 + 0.4 * f).toFixed(3) + ')';
      c.fillRect(x, y, TILE, TILE);
      c.fillStyle = 'rgba(251,191,36,' + (0.35 + 0.55 * f).toFixed(3) + ')';
      c.fillRect(x + 7, y + 7, TILE - 14, TILE - 14);
      c.fillStyle = 'rgba(255,255,255,' + (0.4 + 0.6 * f).toFixed(3) + ')';
      c.fillRect(x + 15, y + 15, TILE - 30, TILE - 30);
    }
    c.restore();
  }

  function drawEntity(c, e, px, py, tick) {
    const cx = (px + 0.5) * TILE;
    const cy = (py + 0.5) * TILE;
    const s = TILE * 0.72;
    const dirx = DX[e.dir];
    const diry = DY[e.dir];
    c.fillStyle = 'rgba(0,0,0,0.38)';
    c.beginPath();
    c.ellipse(cx, cy + s * 0.46, s * 0.46, s * 0.17, 0, 0, Math.PI * 2);
    c.fill();

    if (e.persona && e.persona.key === 'warden') {
      c.strokeStyle = 'rgba(34,211,238,0.8)';
      c.lineWidth = 2;
      c.setLineDash([5, 4]);
      c.beginPath();
      c.arc(cx, cy - 1, s * 0.68, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
    }
    const g = c.createLinearGradient(cx, cy - s / 2, cx, cy + s / 2);
    g.addColorStop(0, e.color);
    g.addColorStop(1, shade(e.color, 0.45));
    rr(c, cx - s / 2, cy - s / 2 - 2, s, s, 10);
    c.fillStyle = g;
    c.fill();
    c.lineWidth = e.kind === 'player' ? 2.5 : 1.5;
    c.strokeStyle = e.kind === 'player' ? '#ffffff' : 'rgba(255,255,255,0.45)';
    c.stroke();

    if (e.persona && e.persona.key === 'hunter') {
      c.fillStyle = e.color;
      c.beginPath();
      c.moveTo(cx - s * 0.42, cy - s / 2 + 2); c.lineTo(cx - s * 0.3, cy - s / 2 - 10); c.lineTo(cx - s * 0.12, cy - s / 2 + 2); c.closePath();
      c.moveTo(cx + s * 0.42, cy - s / 2 + 2); c.lineTo(cx + s * 0.3, cy - s / 2 - 10); c.lineTo(cx + s * 0.12, cy - s / 2 + 2); c.closePath();
      c.fill();
    } else if (e.persona && e.persona.key === 'breaker') {
      c.fillStyle = '#7c4a03';
      c.strokeStyle = '#fde68a';
      c.lineWidth = 1.5;
      const dx = cx + dirx * s * 0.55;
      const dy = cy - 2 + diry * s * 0.55;
      rr(c, dx - 5, dy - 5, 10, 10, 2);
      c.fill();
      c.stroke();
    } else if (e.kind === 'player') {
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(cx, cy - s / 2 - 6, 3.2, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#ffffff';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(cx, cy - s / 2 - 3);
      c.lineTo(cx, cy - s / 2 + 2);
      c.stroke();
    }

    // visor
    const vx = dirx * s * 0.07;
    const vy = diry * s * 0.06;
    rr(c, cx - s * 0.34 + vx, cy - s * 0.2 + vy - 2, s * 0.68, s * 0.3, 6);
    c.fillStyle = '#050816';
    c.fill();
    c.fillStyle = e.kind === 'player' ? '#d9f99d' : '#ffffff';
    c.fillRect(cx - s * 0.2 + vx, cy - s * 0.1 + vy - 2, s * 0.12, s * 0.1);
    c.fillRect(cx + s * 0.08 + vx, cy - s * 0.1 + vy - 2, s * 0.12, s * 0.1);

    if (e.kind === 'player' && G.youUntil > tick) {
      const bob = reduced ? 0 : Math.sin(tick / 6) * 2;
      c.font = 'bold 12px ' + FONT;
      c.textAlign = 'center';
      c.lineWidth = 3;
      c.strokeStyle = '#04050d';
      c.strokeText('YOU', cx, cy - s / 2 - 16 + bob);
      c.fillStyle = '#a3e635';
      c.fillText('YOU', cx, cy - s / 2 - 16 + bob);
    }
  }

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.round(((n >> 16) & 255) * f);
    const g = Math.round(((n >> 8) & 255) * f);
    const b = Math.round((n & 255) * f);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function render(alpha, dtMs) {
    const sim = G.sim;
    const dt = dtMs / 1000;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!sim) return;
    ctx.save();
    if (G.shake > 0.3 && !reduced) {
      ctx.translate((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake);
      G.shake *= Math.pow(0.001, dt);
    } else {
      G.shake = 0;
    }
    const tSec = sim.tick / TPS;
    ctx.drawImage(floorLayer, 0, 0, W, H);

    for (let i = 0; i < N; i++) {
      const t = sim.grid[i];
      if (t === T_BLOCK) ctx.drawImage(blockSprite, (i % COLS) * TILE, ((i / COLS) | 0) * TILE, TILE, TILE);
      else if (t === T_WALL) ctx.drawImage(wallSprite, (i % COLS) * TILE, ((i / COLS) | 0) * TILE, TILE, TILE);
    }

    // tiles about to close in sudden death
    for (let j = sim.sdIndex; j < SPIRAL.length; j++) {
      const left = sim.sdStart + j * SHRINK_EVERY - sim.tick;
      if (left > 70) break;
      const i = SPIRAL[j];
      const f = reduced ? 0.4 : 0.25 + 0.25 * (Math.sin(sim.tick / 3) * 0.5 + 0.5);
      ctx.fillStyle = 'rgba(239,68,68,' + f.toFixed(3) + ')';
      ctx.fillRect((i % COLS) * TILE, ((i / COLS) | 0) * TILE, TILE, TILE);
      ctx.strokeStyle = 'rgba(239,68,68,0.9)';
      ctx.lineWidth = 2;
      ctx.strokeRect((i % COLS) * TILE + 2, ((i / COLS) | 0) * TILE + 2, TILE - 4, TILE - 4);
    }

    for (let i = 0; i < N; i++) {
      if (sim.pickAt[i] >= 0) drawPickup(ctx, sim.pickAt[i], ((i % COLS) + 0.5) * TILE, (((i / COLS) | 0) + 0.5) * TILE, tSec + i);
    }
    for (const ch of sim.charges) drawCharge(ctx, ch, sim.tick);

    const order = sim.ents.filter(function (e) { return e.alive; }).sort(function (a, b) { return a.y - b.y; });
    for (const e of order) {
      const ix = e.px + (e.x - e.px) * alpha;
      const iy = e.py + (e.y - e.py) * alpha;
      drawEntity(ctx, e, ix, iy, sim.tick);
    }
    drawBlasts(ctx, sim);

    // particles and floating text
    if (!reduced) {
      for (let k = parts.length - 1; k >= 0; k--) {
        const p = parts[k];
        p.life -= dt;
        if (p.life <= 0) { parts.splice(k, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.94;
        p.vy *= 0.94;
        ctx.globalAlpha = Math.max(0, p.life / p.max);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.globalAlpha = 1;
    }
    ctx.font = 'bold 15px ' + FONT;
    ctx.textAlign = 'center';
    for (let k = floaters.length - 1; k >= 0; k--) {
      const f = floaters[k];
      f.life -= dt;
      if (f.life <= 0) { floaters.splice(k, 1); continue; }
      if (!reduced) f.y -= 24 * dt;
      ctx.globalAlpha = Math.min(1, f.life * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#04050d';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    if (sim.tick >= sim.sdStart) {
      const f = reduced ? 0.55 : 0.4 + 0.25 * Math.sin(sim.tick / 8);
      ctx.strokeStyle = 'rgba(239,68,68,' + f.toFixed(3) + ')';
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, W - 6, H - 6);
    }
    ctx.restore();
  }

  /* --------------------------------- main loop ---------------------------- */
  let rafId = 0;
  let stopped = false;

  function frame(ts) {
    if (stopped) return;
    rafId = requestAnimationFrame(frame);
    const dt = Math.min(ts - (G.last || ts), 100);
    G.last = ts;
    if (G.state === 'play' && !G.paused && !G.helpOpen && G.sim) {
      G.acc += dt;
      let n = 0;
      while (G.acc >= STEP_MS && n < MAX_FRAME_STEPS) {
        stepSim(G.sim);
        G.acc -= STEP_MS;
        n++;
        afterStep();
        if (G.state !== 'play') break;
      }
      if (n === MAX_FRAME_STEPS) G.acc = 0;
    }
    render(G.state === 'play' && !G.paused ? Math.min(1, G.acc / STEP_MS) : 1, dt);
    updateHud();
  }

  function init() {
    const stored = Number(storeGet('cyberBomberGridBest'));
    G.best = isFinite(stored) && stored > 0 ? Math.floor(stored) : 0;
    if (storeGet('cyberBomberGridMuted') === '1') {
      audio.muted = true;
      el.soundOn.classList.add('hidden');
      el.soundOff.classList.remove('hidden');
      el.soundBtn.setAttribute('aria-pressed', 'true');
      el.soundBtn.setAttribute('aria-label', 'Unmute sound effects');
    }
    // Idle preview behind the start screen.
    G.sim = createSim({ round: 1 });
    G.sim.ents[0].held = G.held;
    G.sim.onEvent = onSimEvent;
    refreshPauseButton();
    updateHud();
    el.bomb.setAttribute('aria-label', 'Place charge');
    $('start-btn').focus({ preventScroll: true });
    rafId = requestAnimationFrame(frame);
  }

  // Hub lifecycle bridge (optional; the page also works on its own).
  const sdk = window.ArcadeVerse;
  if (sdk) {
    if (sdk.onPause) sdk.onPause(function () { pauseGame(true); });
    if (sdk.onTeardown) {
      sdk.onTeardown(function () {
        stopped = true;
        cancelAnimationFrame(rafId);
        if (audio.ctx && audio.ctx.state !== 'closed') audio.ctx.close().catch(function () {});
      });
    }
  }

  init();
})();
