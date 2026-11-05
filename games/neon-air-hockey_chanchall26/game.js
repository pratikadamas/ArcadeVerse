/*
 * Neon Air Hockey: Plasma Puck Arena
 * Top-down air hockey on an HTML5 canvas, vanilla JavaScript only.
 *
 * Structure
 *   1. Config and helpers
 *   2. Sim            - fixed-step puck and mallet physics (no DOM, testable on its own)
 *   3. AIController   - predictive opponent working in a mirrored local frame
 *   4. Sound          - procedural Web Audio effects
 *   5. Renderer       - cached table layer, sprites, particles
 *   6. Game           - state machine, input, UI wiring, fixed-timestep loop
 *
 * Physics runs at a fixed 120 Hz step driven by an accumulator, so behaviour
 * does not depend on the display frame rate.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------
  // 1. Config and helpers
  // ---------------------------------------------------------------
  var CFG = {
    W: 400,              // table width in logical units
    H: 700,              // table height in logical units
    puckR: 17,
    malletR: 30,
    goalW: 160,          // width of each goal mouth
    cornerR: 56,         // rounded table corners (a puck cannot rest in a sharp corner)
    puckMass: 1,
    malletMass: 6,       // mass ratio used by the impulse (mallets are driven kinematically)
    eMallet: 0.82,       // restitution, puck vs mallet
    eWall: 0.9,          // restitution along the wall normal
    wallFriction: 0.025, // tangential speed lost per wall bounce
    drag: 0.32,          // air drag, 1/s
    maxSpeed: 1400,      // puck speed cap
    malletMaxSpeed: 1150,
    stallSpeed: 14,      // below this the puck counts as resting
    stallTime: 6,        // seconds of rest before the plasma pulse
    pinTime: 0.8,        // seconds pinned against a wall by a mallet before the pulse
    pulseSpeed: 320,
    step: 1 / 120
  };
  var STEP = CFG.step;
  var ARC_FACETS = 10;      // chords per rounded corner
  var TARGET_SCORE = 7;

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function makeRng(seed) {
    var s = (seed >>> 0) || 1;
    var f = function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.gauss = function () {
      var u = 1 - f(), v = f();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    return f;
  }

  /**
   * Circle-circle impulse. n points from b to a. Returns the impact speed
   * (closing speed along the normal) or 0 when the bodies are separating.
   * With kinematicB the second body is driven externally: it contributes its
   * mass to the impulse but its velocity is not changed.
   */
  function resolveCircles(a, b, nx, ny, e, kinematicB) {
    var rvn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
    if (rvn >= 0) return 0;
    var j = -(1 + e) * rvn / (1 / a.mass + 1 / b.mass);
    a.vx += (j / a.mass) * nx;
    a.vy += (j / a.mass) * ny;
    if (!kinematicB) {
      b.vx -= (j / b.mass) * nx;
      b.vy -= (j / b.mass) * ny;
    }
    return -rvn;
  }

  // ---------------------------------------------------------------
  // 2. Sim
  // ---------------------------------------------------------------
  function makeMallet(sim, side) {
    var c = sim.cfg;
    var hx = c.W / 2, hy = side === 0 ? c.H - 110 : 110;
    return {
      side: side, r: c.malletR, mass: c.malletMass,
      x: hx, y: hy, x0: hx, y0: hy, px: hx, py: hy,
      vx: 0, vy: 0, tx: hx, ty: hy,
      vmax: c.malletMaxSpeed, kd: 30, accel: 0,
      homeX: hx, homeY: hy
    };
  }

  function Sim(opts) {
    opts = opts || {};
    var c = this.cfg = {}, k;
    for (k in CFG) c[k] = CFG[k];
    for (k in opts) if (k !== 'seed') c[k] = opts[k];
    this.rng = makeRng(opts.seed == null ? 12345 : opts.seed);
    this.gx0 = c.W / 2 - c.goalW / 2;
    this.gx1 = c.W / 2 + c.goalW / 2;
    this.buildEdges();
    this.time = 0;
    this.events = [];
    this.puck = {
      x: c.W / 2, y: c.H / 2, px: c.W / 2, py: c.H / 2,
      vx: 0, vy: 0, r: c.puckR, mass: c.puckMass
    };
    this.mallets = [makeMallet(this, 0), makeMallet(this, 1)];
    this.frozen = false;
    this.scored = -1;      // side that just scored (0 = bottom player, 1 = top player), -1 none
    this.lastTouch = -1;
    this.stallT = 0;
    this.pinT = 0;
    this.squeezed = false;
    this.pulses = 0;
    this._hit = { s: 0, nx: 0, ny: 0, kind: 0 };
    this._tmp = { x: 0, y: 0 };
  }

  Sim.prototype.placePuck = function (x, y, vx, vy) {
    var p = this.puck;
    p.x = p.px = x; p.y = p.py = y;
    p.vx = vx || 0; p.vy = vy || 0;
    this.scored = -1;
    this.stallT = 0; this.pinT = 0; this.squeezed = false;
  };

  Sim.prototype.placeMallet = function (side, x, y) {
    var m = this.mallets[side];
    m.x = m.x0 = m.px = m.tx = x;
    m.y = m.y0 = m.py = m.ty = y;
    m.vx = 0; m.vy = 0;
  };

  Sim.prototype.capSpeed = function (p) {
    var sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy), mx = this.cfg.maxSpeed;
    if (sp > mx) { var k = mx / sp; p.vx *= k; p.vy *= k; }
  };

  // Clamp a point so a circle of radius `inset` stays inside the rounded table.
  Sim.prototype.clampInset = function (x, y, inset, out, arcScale) {
    var c = this.cfg, R = c.cornerR, W = c.W, H = c.H;
    x = clamp(x, inset, W - inset);
    y = clamp(y, inset, H - inset);
    var Ra = (R - inset) * (arcScale || 1);
    if (R - inset > 0) {
      var cx, cy;
      if (x < R && y < R) { cx = R; cy = R; }
      else if (x > W - R && y < R) { cx = W - R; cy = R; }
      else if (x < R && y > H - R) { cx = R; cy = H - R; }
      else if (x > W - R && y > H - R) { cx = W - R; cy = H - R; }
      else { out.x = x; out.y = y; return out; }
      var dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy);
      if (d > Ra) { var k = Ra / d; x = cx + dx * k; y = cy + dy * k; }
    }
    out.x = x; out.y = y;
    return out;
  };

  Sim.prototype.clampMallet = function (m, x, y, out) {
    var c = this.cfg, r = m.r;
    var minY = m.side === 0 ? c.H / 2 + r : r;
    var maxY = m.side === 0 ? c.H - r : c.H / 2 - r;
    return this.clampInset(clamp(x, r, c.W - r), clamp(y, minY, maxY), r, out);
  };

  Sim.prototype.moveMallet = function (m, dt) {
    var tmp = this._tmp;
    m.x0 = m.x; m.y0 = m.y;
    this.clampMallet(m, m.tx, m.ty, tmp);
    var vdx = (tmp.x - m.x) * m.kd, vdy = (tmp.y - m.y) * m.kd;
    var sp = Math.sqrt(vdx * vdx + vdy * vdy);
    if (sp > m.vmax) { var k = m.vmax / sp; vdx *= k; vdy *= k; }
    if (m.accel > 0) {
      var ax = vdx - m.vx, ay = vdy - m.vy;
      var al = Math.sqrt(ax * ax + ay * ay), lim = m.accel * dt;
      if (al > lim) { var q = lim / al; vdx = m.vx + ax * q; vdy = m.vy + ay * q; }
    }
    this.clampMallet(m, m.x + vdx * dt, m.y + vdy * dt, tmp);
    m.x = tmp.x; m.y = tmp.y;
    m.vx = (m.x - m.x0) / dt;
    m.vy = (m.y - m.y0) / dt;
  };

  Sim.prototype.step = function (dt) {
    var c = this.cfg, p = this.puck;
    this.events.length = 0;
    this.time += dt;
    this.moveMallet(this.mallets[0], dt);
    this.moveMallet(this.mallets[1], dt);
    var i;
    for (i = 0; i < 2; i++) { this.mallets[i].px = this.mallets[i].x0; this.mallets[i].py = this.mallets[i].y0; }
    p.px = p.x; p.py = p.y;
    if (this.frozen) return;
    var f = Math.exp(-c.drag * dt);
    p.vx *= f; p.vy *= f;
    this.capSpeed(p);
    this.advance(dt);
    this.resolveOverlaps();
    this.capSpeed(p);
    if (p.y < -p.r) this.scored = 0;
    else if (p.y > c.H + p.r) this.scored = 1;
    if (this.scored >= 0) this.events.push({ type: 'goal', side: this.scored });
    this.checkStall(dt);
  };

  // ----- continuous collision -------------------------------------
  // Earliest puck-mallet contact within [0, remain] seconds of motion. tNow is the
  // time already consumed in this step, so the mallet sits at (x0, y0) + v * tNow.
  Sim.prototype.malletHit = function (m, tNow, remain) {
    var p = this.puck;
    var mx = m.x0 + m.vx * tNow, my = m.y0 + m.vy * tNow;
    var dx = p.x - mx, dy = p.y - my;
    var rvx = p.vx - m.vx, rvy = p.vy - m.vy;
    var R = p.r + m.r;
    var a = rvx * rvx + rvy * rvy;
    if (a < 1e-12) return -1;
    var b = dx * rvx + dy * rvy;
    var cc = dx * dx + dy * dy - R * R;
    if (cc <= 0) return b < 0 ? 0 : -1;
    if (b >= 0) return -1;
    var disc = b * b - a * cc;
    if (disc < 0) return -1;
    var s = (-b - Math.sqrt(disc)) / a;
    return s <= remain ? (s < 0 ? 0 : s) : -1;
  };

  // Wall geometry in puck-centre space (the table inset by the puck radius). Straight rims are single
  // segments; each rounded corner is ARC_FACETS chords on the corner circle, so every wall is a plain
  // line segment with an exact swept test (no curved-surface special cases, no micro-bounce loops).
  // Edge layout (stride 7): inward normal (nx, ny), start (ax, ay), unit tangent (tx, ty), length.
  Sim.prototype.buildEdges = function () {
    var c = this.cfg, r = c.puckR, R = c.cornerR, W = c.W, H = c.H, Ra = R - r;
    var gx0 = this.gx0, gx1 = this.gx1, list = [], i, k;
    function add(nx, ny, ax, ay, tx, ty, len) { if (len > 1e-9) list.push(nx, ny, ax, ay, tx, ty, len); }
    add(1, 0, r, R, 0, 1, H - 2 * R);
    add(-1, 0, W - r, R, 0, 1, H - 2 * R);
    add(0, 1, R, r, 1, 0, gx0 - R);
    add(0, 1, gx1, r, 1, 0, W - R - gx1);
    add(0, -1, R, H - r, 1, 0, gx0 - R);
    add(0, -1, gx1, H - r, 1, 0, W - R - gx1);
    var dphi = Math.PI / 2 / ARC_FACETS;
    for (k = 0; k < 4; k++) {
      var ox = (k & 1) ? 1 : -1, oy = (k & 2) ? 1 : -1;
      var cx = (k & 1) ? W - R : R, cy = (k & 2) ? H - R : R;
      for (i = 0; i < ARC_FACETS; i++) {
        var a0 = i * dphi, a1 = (i + 1) * dphi, am = (a0 + a1) / 2;
        var ax = cx + Ra * ox * Math.cos(a0), ay = cy + Ra * oy * Math.sin(a0);
        var bx = cx + Ra * ox * Math.cos(a1), by = cy + Ra * oy * Math.sin(a1);
        var len = Math.sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay));
        add(-ox * Math.cos(am), -oy * Math.sin(am), ax, ay, (bx - ax) / len, (by - ay) / len, len);
      }
    }
    this.edges = new Float64Array(list);
    this.edgeCount = list.length / 7;
    this.arcScale = Math.cos(dphi / 2);   // circle that fits inside the facet polygon, used by the safety clamp
  };

  // Earliest wall, facet or goal post contact. Fills hit when earlier than hit.s.
  Sim.prototype.findWallHit = function (remain, hit) {
    var c = this.cfg, p = this.puck, r = p.r, H = c.H;
    var x = p.x, y = p.y, vx = p.vx, vy = p.vy, s, tol = 1e-6;
    var E = this.edges, n = this.edgeCount, j, o, nx, ny, vn, dn, u;
    for (j = 0; j < n; j++) {
      o = j * 7;
      nx = E[o]; ny = E[o + 1];
      vn = vx * nx + vy * ny;
      if (vn >= -1e-9) continue;                       // not moving towards this wall
      dn = (x - E[o + 2]) * nx + (y - E[o + 3]) * ny;   // distance inside the wall (negative if already past it)
      s = -dn / vn;
      if (s < 0) s = 0;
      if (s > remain || s >= hit.s) continue;
      u = (x + vx * s - E[o + 2]) * E[o + 4] + (y + vy * s - E[o + 3]) * E[o + 5];
      if (u < -tol || u > E[o + 6] + tol) continue;     // line is crossed outside this segment (goal mouth, other wall)
      hit.s = s; hit.nx = nx; hit.ny = ny; hit.kind = 1;
    }
    var a = vx * vx + vy * vy;
    if (a < 1e-12) return;
    // goal posts: circles of radius r around the four post points
    var i, px, py, dx, dy, b, cc, disc, d, qx, qy;
    for (i = 0; i < 4; i++) {
      px = (i & 1) ? this.gx1 : this.gx0;
      py = (i & 2) ? H : 0;
      dx = x - px; dy = y - py;
      b = dx * vx + dy * vy;
      if (b >= 0) continue;
      cc = dx * dx + dy * dy - r * r;
      if (cc <= 0) s = 0;
      else {
        disc = b * b - a * cc;
        if (disc < 0) continue;
        s = (-b - Math.sqrt(disc)) / a;
      }
      if (s <= remain && s < hit.s) {
        qx = x + vx * s - px; qy = y + vy * s - py;
        d = Math.sqrt(qx * qx + qy * qy);
        if (d < 1e-9) { qx = 0; qy = (i & 2) ? -1 : 1; d = 1; }
        hit.s = s; hit.nx = qx / d; hit.ny = qy / d; hit.kind = 2;
      }
    }
  };

  // Walls and posts: reflect the normal component with restitution, keep most tangential speed.
  Sim.prototype.bounceWall = function (nx, ny, kind) {
    var c = this.cfg, p = this.puck;
    var vn = p.vx * nx + p.vy * ny;
    if (vn >= 0) return;
    var tx = p.vx - vn * nx, ty = p.vy - vn * ny;
    var imp = -vn;
    // Resting contact (a slow puck creeping along the rim) is inelastic, so it cannot micro-bounce forever,
    // and the friction loss scales with the impact so gliding along a curved corner does not bleed speed.
    var fr = 1 - c.wallFriction * Math.min(1, imp / 200);
    var nvn = imp < 25 ? 0 : c.eWall * imp;
    p.vx = nvn * nx + tx * fr;
    p.vy = nvn * ny + ty * fr;
    if (-vn > 40) this.events.push({ type: kind === 2 ? 'post' : 'wall', speed: -vn, x: p.x, y: p.y });
  };

  Sim.prototype.malletImpact = function (m, tAt) {
    var c = this.cfg, p = this.puck;
    var mx = m.x0 + m.vx * tAt, my = m.y0 + m.vy * tAt;
    var dx = p.x - mx, dy = p.y - my, d = Math.sqrt(dx * dx + dy * dy);
    var nx, ny;
    if (d < 1e-9) { nx = 0; ny = m.side === 0 ? -1 : 1; } else { nx = dx / d; ny = dy / d; }
    var sp = resolveCircles(p, m, nx, ny, c.eMallet, true);
    if (sp > 0) {
      this.lastTouch = m.side;
      this.events.push({ type: 'mallet', side: m.side, speed: sp, x: p.x, y: p.y });
    }
    this.capSpeed(p);
  };

  Sim.prototype.advance = function (dt) {
    var p = this.puck, ms = this.mallets, hit = this._hit;
    var remain = dt, t = 0, it = 0;
    while (remain > 1e-10 && it++ < 24) {
      hit.s = remain + 1; hit.kind = 0;
      this.findWallHit(remain, hit);
      var mi = -1, best = hit.s, i, s;
      for (i = 0; i < 2; i++) {
        s = this.malletHit(ms[i], t, remain);
        if (s >= 0 && s < best) { best = s; mi = i; }
      }
      if (mi < 0 && hit.kind === 0) {
        p.x += p.vx * remain; p.y += p.vy * remain;
        remain = 0;
        break;
      }
      p.x += p.vx * best; p.y += p.vy * best;
      t += best; remain -= best;
      if (mi >= 0) this.malletImpact(ms[mi], t);
      else this.bounceWall(hit.nx, hit.ny, hit.kind);
    }
  };

  // ----- position fix-up ------------------------------------------
  Sim.prototype.nearWall = function (tol) {
    var c = this.cfg, p = this.puck, r = p.r, R = c.cornerR, W = c.W, H = c.H;
    var inMouth = p.x > this.gx0 && p.x < this.gx1;
    if (p.x - r <= tol || W - r - p.x <= tol) return true;
    if (!inMouth && (p.y - r <= tol || H - r - p.y <= tol)) return true;
    var Ra = R - r, cx = -1, cy = -1;
    if (p.x < R && p.y < R) { cx = R; cy = R; }
    else if (p.x > W - R && p.y < R) { cx = W - R; cy = R; }
    else if (p.x < R && p.y > H - R) { cx = R; cy = H - R; }
    else if (p.x > W - R && p.y > H - R) { cx = W - R; cy = H - R; }
    if (cx >= 0) {
      var dx = p.x - cx, dy = p.y - cy;
      if (Math.sqrt(dx * dx + dy * dy) >= Ra - tol) return true;
    }
    return false;
  };

  // Safety net: keep the puck centre inside the playable region and out of the posts.
  Sim.prototype.clampPuck = function () {
    var c = this.cfg, p = this.puck, r = p.r, W = c.W, H = c.H, tmp = this._tmp;
    var inMouth = p.x > this.gx0 && p.x < this.gx1;
    var inGoal = inMouth && (p.y < r || p.y > H - r);
    if (inGoal) {
      p.x = clamp(p.x, r, W - r);
    } else {
      this.clampInset(p.x, p.y, r, tmp, this.arcScale);
      p.x = tmp.x; p.y = tmp.y;
    }
    var i, px, py, dx, dy, d;
    for (i = 0; i < 4; i++) {
      px = (i & 1) ? this.gx1 : this.gx0;
      py = (i & 2) ? H : 0;
      dx = p.x - px; dy = p.y - py; d = Math.sqrt(dx * dx + dy * dy);
      if (d < r - 1e-6) {
        if (d < 1e-9) { dx = 0; dy = (i & 2) ? -1 : 1; d = 1; }
        p.x = px + dx / d * r; p.y = py + dy / d * r;
      }
    }
  };

  Sim.prototype.resolveOverlaps = function () {
    var p = this.puck, ms = this.mallets, c = this.cfg;
    for (var pass = 0; pass < 3; pass++) {
      this.clampPuck();
      var moved = false, i, m, dx, dy, d, R, nx, ny, sp;
      for (i = 0; i < 2; i++) {
        m = ms[i];
        dx = p.x - m.x; dy = p.y - m.y; d = Math.sqrt(dx * dx + dy * dy); R = p.r + m.r;
        if (d < R - 1e-4) {
          if (d < 1e-6) { nx = 0; ny = m.side === 0 ? -1 : 1; } else { nx = dx / d; ny = dy / d; }
          sp = resolveCircles(p, m, nx, ny, c.eMallet, true);
          if (sp > 0) {
            this.lastTouch = m.side;
            this.events.push({ type: 'mallet', side: m.side, speed: sp, x: p.x, y: p.y });
          }
          p.x = m.x + nx * R; p.y = m.y + ny * R;
          moved = true;
        }
      }
      if (!moved) break;
      this.clampPuck();
      // Still overlapping after the wall clamp means the puck is squeezed between a wall and a mallet:
      // the mallet gives way (a hand cannot push a puck through the rim).
      for (i = 0; i < 2; i++) {
        m = ms[i];
        dx = p.x - m.x; dy = p.y - m.y; d = Math.sqrt(dx * dx + dy * dy); R = p.r + m.r;
        if (d < R - 0.05) {
          if (d < 1e-6) { nx = 0; ny = m.side === 0 ? -1 : 1; } else { nx = dx / d; ny = dy / d; }
          this.clampMallet(m, m.x - nx * (R - d), m.y - ny * (R - d), this._tmp);
          m.x = this._tmp.x; m.y = this._tmp.y;
          this.squeezed = true;
        }
      }
    }
    this.capSpeed(p);
  };

  // A puck at rest (corner) or pinned behind a mallet gets a short plasma pulse towards open ice.
  Sim.prototype.checkStall = function (dt) {
    var c = this.cfg, p = this.puck;
    var sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    if (sp < c.stallSpeed) this.stallT += dt; else this.stallT = 0;
    var touching = false, i, m;
    for (i = 0; i < 2; i++) {
      m = this.mallets[i];
      var dx = p.x - m.x, dy = p.y - m.y;
      if (Math.sqrt(dx * dx + dy * dy) <= p.r + m.r + 2) touching = true;
    }
    if (this.squeezed || (touching && sp < 70 && this.nearWall(2.5))) this.pinT += dt; else this.pinT = 0;
    this.squeezed = false;
    if (this.stallT > c.stallTime || this.pinT > c.pinTime) this.releasePuck();
  };

  Sim.prototype.releasePuck = function () {
    var c = this.cfg, p = this.puck;
    var dx = c.W / 2 - p.x, dy = c.H / 2 - p.y, d = Math.sqrt(dx * dx + dy * dy), a;
    if (d < 40) { a = this.rng() * Math.PI * 2; dx = Math.cos(a); dy = Math.sin(a); }
    else { dx /= d; dy /= d; }
    for (var i = 0; i < 2; i++) {
      var m = this.mallets[i], mx = p.x - m.x, my = p.y - m.y, md = Math.sqrt(mx * mx + my * my);
      if (md < p.r + m.r + 6 && md > 1e-6) { dx += 1.5 * mx / md; dy += 1.5 * my / md; }
    }
    d = Math.sqrt(dx * dx + dy * dy) || 1;
    p.vx += dx / d * c.pulseSpeed;
    p.vy += dy / d * c.pulseSpeed;
    this.capSpeed(p);
    this.stallT = 0; this.pinT = 0; this.pulses++;
    this.events.push({ type: 'pulse', x: p.x, y: p.y });
  };

  // ---------------------------------------------------------------
  // 3. AIController
  // ---------------------------------------------------------------
  // Parameters per level. Everything the AI "knows" about the puck is delayed by
  // `reaction` seconds, blurred by `noise`, and only partly compensated (`comp`).
  var LEVELS = [
    {
      id: 'rookie', name: 'Rookie', blurb: 'Slow to react, wild aim. Good for learning the table.',
      reaction: 0.26, comp: 0.1, vmax: 380, kd: 10, accel: 3600, noise: 30, aimErr: 80, aimSmart: 0.05,
      replan: 0.25, attackSpeed: 180, hesitate: [0.5, 1.1], strikeSpeed: 320, defendY: 90,
      bank: 0, jab: 0, shade: 0.4, horizon: 0.7, follow: 40
    },
    {
      id: 'pro', name: 'Pro', blurb: 'Reads bank shots and picks a side of the goal. A fair fight.',
      reaction: 0.13, comp: 0.6, vmax: 640, kd: 16, accel: 8000, noise: 14, aimErr: 40, aimSmart: 0.45,
      replan: 0.09, attackSpeed: 400, hesitate: [0.15, 0.4], strikeSpeed: 600, defendY: 92,
      bank: 0.1, jab: 20, shade: 0.5, horizon: 1.1, follow: 55
    },
    {
      id: 'master', name: 'Master', blurb: 'Near-instant reads, sharp aim, bank shots. Bring your best flick.',
      reaction: 0.115, comp: 0.75, vmax: 700, kd: 18, accel: 10000, noise: 12, aimErr: 38, aimSmart: 0.7,
      replan: 0.07, attackSpeed: 520, hesitate: [0.05, 0.25], strikeSpeed: 690, defendY: 98,
      bank: 0.3, jab: 30, shade: 0.55, horizon: 1.3, follow: 60
    }
  ];

  var HIST_N = 128;
  var PATH_N = 112;

  /**
   * side: 1 plays the top half (local frame equals world frame),
   *       0 plays the bottom half (the y axis is mirrored so the logic is written once).
   * In the local frame the AI's own goal is at y = 0 and the opponent's goal at y = H.
   */
  function AIController(sim, side, params, seed) {
    this.sim = sim; this.side = side; this.P = params;
    this.rng = makeRng(seed || 99);
    this.hx = new Float64Array(HIST_N); this.hy = new Float64Array(HIST_N);
    this.hvx = new Float64Array(HIST_N); this.hvy = new Float64Array(HIST_N);
    this.hi = 0; this.hc = 0;
    this.px = new Float64Array(PATH_N); this.py = new Float64Array(PATH_N);
    this.pvy = new Float64Array(PATH_N); this.pn = 0;
    this.est = { x: 0, y: 0, vx: 0, vy: 0 };
    this.timer = 0;
    this.mode = 'guard';
    this.hold = false;       // true during countdown / celebration: stay on guard
    this.holdT = 0;
    this.aimSet = false; this.aimX = 0; this.aimY = 0; this.aimPuckX = 0; this.aimPuckY = 0;
    this.wx = sim.mallets[side].homeX; this.wy = sim.mallets[side].homeY;
    this.curV = params.vmax;
    this.lastCross = null;
  }

  AIController.prototype.ly = function (y) { return this.side === 1 ? y : this.sim.cfg.H - y; };
  AIController.prototype.lv = function (vy) { return this.side === 1 ? vy : -vy; };

  AIController.prototype.reset = function () {
    this.hc = 0; this.hi = 0; this.timer = 0; this.mode = 'guard'; this.aimSet = false; this.holdT = 0;
    var m = this.sim.mallets[this.side];
    this.wx = m.homeX; this.wy = m.homeY;
  };

  AIController.prototype.record = function () {
    var p = this.sim.puck, i = this.hi;
    this.hx[i] = p.x; this.hy[i] = p.y; this.hvx[i] = p.vx; this.hvy[i] = p.vy;
    this.hi = (i + 1) % HIST_N;
    if (this.hc < HIST_N) this.hc++;
  };

  AIController.prototype.delayedIndex = function (steps) {
    var n = Math.min(steps, this.hc - 1);
    if (n < 0) n = 0;
    return (this.hi - 1 - n + HIST_N * 2) % HIST_N;
  };

  // Coarse forward model with wall bounces and drag (ignores corner arcs and posts on purpose).
  AIController.prototype.integrate = function (e, T, store) {
    var c = this.sim.cfg, r = c.puckR, W = c.W, H = c.H, dtp = 1 / 60;
    var x = e.x, y = e.y, vx = e.vx, vy = e.vy;
    var df = Math.exp(-c.drag * dtp), ew = c.eWall;
    var gl = W / 2 - c.goalW / 2 + r, gr = W / 2 + c.goalW / 2 - r;
    var n = Math.min(Math.ceil(T / dtp), PATH_N), k;
    for (k = 0; k < n; k++) {
      vx *= df; vy *= df;
      x += vx * dtp; y += vy * dtp;
      if (x < r) { x = 2 * r - x; vx = -vx * ew; }
      else if (x > W - r) { x = 2 * (W - r) - x; vx = -vx * ew; }
      if (!(x > gl && x < gr)) {
        if (y < r) { y = 2 * r - y; vy = -vy * ew; }
        else if (y > H - r) { y = 2 * (H - r) - y; vy = -vy * ew; }
      }
      if (store) { this.px[k] = x; this.py[k] = y; this.pvy[k] = vy; }
      if (y < -r || y > H + r) { k++; break; }
    }
    if (store) this.pn = k;
    else { e.x = x; e.y = y; e.vx = vx; e.vy = vy; }
  };

  AIController.prototype.update = function (dt) {
    this.record();
    this.timer -= dt;
    if (this.timer <= 0) { this.timer = this.P.replan; this.think(); }
    var m = this.sim.mallets[this.side];
    m.tx = this.wx; m.ty = this.side === 1 ? this.wy : this.sim.cfg.H - this.wy;
    m.vmax = this.curV; m.kd = this.P.kd; m.accel = this.P.accel;
  };

  AIController.prototype.pickAim = function (e, ox) {
    var c = this.sim.cfg, P = this.P, rng = this.rng, W = c.W, H = c.H, r = c.puckR;
    var half = c.goalW / 2 - r - 10;
    var sgn;
    if (rng() < P.aimSmart) sgn = ox < W / 2 ? 1 : -1; else sgn = rng() < 0.5 ? -1 : 1;
    var gx = W / 2 + sgn * half * (0.35 + 0.65 * rng());
    var ax = gx, ay = H;
    if (rng() < P.bank) {
      // aim at the goal mirrored across the nearer side wall
      if (e.x < W / 2) ax = 2 * r - gx; else ax = 2 * (W - r) - gx;
    }
    ax += rng.gauss() * P.aimErr;
    this.aimX = ax; this.aimY = ay;
    this.aimPuckX = e.x; this.aimPuckY = e.y;
    this.aimSet = true;
  };

  AIController.prototype.think = function () {
    var sim = this.sim, c = sim.cfg, P = this.P, rng = this.rng, W = c.W, H = c.H;
    var side = this.side, m = sim.mallets[side], o = sim.mallets[1 - side];
    var s = this.delayedIndex(Math.round(P.reaction / c.step));
    var e = this.est;
    e.x = this.hx[s] + rng.gauss() * P.noise;
    e.y = this.ly(this.hy[s]) + rng.gauss() * P.noise * 0.6;
    e.vx = this.hvx[s] + rng.gauss() * P.noise * 1.5;
    e.vy = this.lv(this.hvy[s]) + rng.gauss() * P.noise * 1.5;
    if (P.comp > 0 && P.reaction > 0) this.integrate(e, P.comp * P.reaction, false);

    var mx = m.x, my = this.ly(m.y), ox = o.x;
    var speed = Math.sqrt(e.vx * e.vx + e.vy * e.vy);
    var inHalf = e.y < H / 2 + 8;
    var attack = inHalf && speed < P.attackSpeed && !this.hold;
    var tx, ty, curV = P.vmax, mode;

    if (attack) {
      mode = 'attack';
      if (this.mode !== 'attack') {
        this.holdT = P.hesitate[0] + rng() * (P.hesitate[1] - P.hesitate[0]);
        this.aimSet = false;
      }
      this.holdT -= P.replan;
      if (!this.aimSet || Math.abs(e.x - this.aimPuckX) + Math.abs(e.y - this.aimPuckY) > 60) this.pickAim(e, ox);

      var R = c.puckR + c.malletR, rm = c.malletR;
      var dirs = [], d, dx, dy, k;
      dx = this.aimX - e.x; dy = this.aimY - e.y; d = Math.sqrt(dx * dx + dy * dy) || 1;
      dirs.push(dx / d, dy / d);
      dx = W / 2 - e.x; dy = H * 0.6 - e.y; d = Math.sqrt(dx * dx + dy * dy) || 1;
      dirs.push(dx / d, dy / d);
      var sx = e.x < W / 2 ? 1 : -1;
      dx = sx; dy = 0.35; d = Math.sqrt(dx * dx + dy * dy);
      dirs.push(dx / d, dy / d);
      var dirx = dirs[0], diry = dirs[1], wux = 0, wuy = 0, found = false;
      for (k = 0; k < 3 && !found; k++) {
        var cdx = dirs[k * 2], cdy = dirs[k * 2 + 1];
        if (k < 2 && cdy < 0.05) continue;            // never drive the puck at our own goal
        wux = e.x - cdx * (R + 34); wuy = e.y - cdy * (R + 34);
        var bx = e.x - cdx * (R - 3), by = e.y - cdy * (R - 3);
        var inReach = wux >= rm - 6 && wux <= W - rm + 6 && wuy >= rm - 6 && wuy <= H / 2 - rm + 6 &&
                      bx >= rm - 6 && bx <= W - rm + 6 && by >= rm - 6 && by <= H / 2 - rm + 6;
        if (inReach) { dirx = cdx; diry = cdy; found = true; }
      }
      if (!found) {                                     // cornered puck: shove it along the wall towards the middle
        dirx = sx * 0.94; diry = 0.34;
        wux = e.x - dirx * (R + 34); wuy = e.y - diry * (R + 34);
      }
      var rx = mx - e.x, ry = my - e.y;
      var axial = rx * dirx + ry * diry;                // negative when behind the puck
      var lat = -rx * diry + ry * dirx;
      var perpx = -diry, perpy = dirx;
      if (axial < -R * 0.45 && Math.abs(lat) < R * 0.95) {
        if (this.holdT > 0) {
          tx = wux; ty = wuy; curV = P.vmax * 0.6;
        } else {
          tx = e.x + dirx * (R + P.follow); ty = e.y + diry * (R + P.follow); curV = P.strikeSpeed;
        }
      } else if (axial > -R * 0.5) {
        // In front of or beside the puck: walk around it, never through it. The waypoint sits well behind the
        // front threshold (-0.9R against -0.5R), so reaching it always hands over to the wind-up branch.
        var sg = lat >= 0 ? 1 : -1;
        tx = e.x + perpx * sg * (R + 26) - dirx * R * 0.9;
        ty = e.y + perpy * sg * (R + 26) - diry * R * 0.9;
      } else {
        tx = wux; ty = wuy;
      }
    } else {
      mode = 'guard';
      this.integrate(e, P.horizon, true);
      var cross = -1, i;
      for (i = 0; i < this.pn; i++) {
        if (this.py[i] <= P.defendY && this.pvy[i] < 0) { cross = i; break; }
      }
      var gl = W / 2 - c.goalW / 2 - 14, gr = W / 2 + c.goalW / 2 + 14;
      if (cross >= 0 && this.px[cross] > gl && this.px[cross] < gr) {
        mode = 'defend';
        tx = this.px[cross] + rng.gauss() * P.noise * 0.5;
        ty = P.defendY;
        var tc = (cross + 1) / 60;
        if (P.jab > 0 && tc < 0.2 && Math.abs(mx - tx) < 24) ty = P.defendY + P.jab;
      } else {
        tx = W / 2 + (e.x - W / 2) * P.shade;
        ty = P.defendY + 14;
      }
    }
    this.mode = mode;
    this.wx = tx; this.wy = ty; this.curV = curV;
  };

  // ---------------------------------------------------------------
  // 4. Sound (procedural Web Audio, nothing is downloaded)
  // ---------------------------------------------------------------
  function Sound() {
    this.ctx = null; this.master = null; this.muted = false; this.hubMuted = false;
    this.last = {};
  }
  Sound.prototype.ensure = function () {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') { try { this.ctx.resume(); } catch (e) { /* ignore */ } }
      return;
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
    } catch (e) { this.ctx = null; }
  };
  Sound.prototype.close = function () {
    if (this.ctx) { try { this.ctx.close(); } catch (e) { /* ignore */ } }
    this.ctx = null; this.master = null;
  };
  Sound.prototype.ok = function (key, gap) {
    if (this.muted || this.hubMuted || !this.ctx || this.ctx.state !== 'running') return false;
    var now = this.ctx.currentTime;
    if (this.last[key] && now - this.last[key] < gap) return false;
    this.last[key] = now;
    return true;
  };
  Sound.prototype.tone = function (type, f0, f1, dur, vol, delay) {
    var ctx = this.ctx, t = ctx.currentTime + (delay || 0);
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  };
  Sound.prototype.noise = function (dur, vol, freq) {
    var ctx = this.ctx, t = ctx.currentTime;
    var n = Math.max(1, Math.floor(ctx.sampleRate * dur));
    var buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0), i;
    for (i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = ctx.createBufferSource(); src.buffer = buf;
    var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.9;
    var g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  };
  Sound.prototype.hit = function (speed) {
    if (!this.ok('hit', 0.035)) return;
    var v = clamp(speed / 900, 0.15, 1);
    this.tone('triangle', 210 + 90 * v, 80, 0.13, 0.5 * v + 0.12);
    this.noise(0.05, 0.35 * v, 1400);
  };
  Sound.prototype.wall = function (speed) {
    if (!this.ok('wall', 0.04)) return;
    var v = clamp(speed / 900, 0.12, 1);
    this.tone('sine', 560, 380, 0.07, 0.3 * v + 0.06);
  };
  Sound.prototype.post = function () {
    if (!this.ok('post', 0.06)) return;
    this.tone('sine', 880, 880, 0.16, 0.22);
    this.tone('sine', 1320, 1320, 0.12, 0.12);
  };
  Sound.prototype.goal = function (mine) {
    if (!this.ok('goal', 0.3)) return;
    var notes = mine ? [523, 659, 784, 1047] : [392, 330, 262, 196], i;
    for (i = 0; i < notes.length; i++) this.tone(mine ? 'square' : 'sawtooth', notes[i], notes[i], 0.16, 0.16, i * 0.085);
    this.noise(0.25, 0.25, mine ? 3000 : 600);
  };
  Sound.prototype.tick = function (go) {
    if (!this.ok('tick', 0.1)) return;
    this.tone('sine', go ? 990 : 660, go ? 990 : 660, go ? 0.22 : 0.09, 0.22);
  };
  Sound.prototype.end = function (win) {
    if (!this.ok('end', 0.5)) return;
    var notes = win ? [523, 659, 784, 1047, 1319] : [330, 294, 262, 220], i;
    for (i = 0; i < notes.length; i++) this.tone('triangle', notes[i], notes[i], 0.22, 0.2, i * 0.12);
  };
  Sound.prototype.pulse = function () {
    if (!this.ok('pulse', 0.5)) return;
    this.tone('sine', 300, 900, 0.22, 0.2);
  };

  // ---------------------------------------------------------------
  // 5. Renderer helpers
  // ---------------------------------------------------------------
  var COL = {
    cyan: '#22e1ff', magenta: '#ff3dcb', amber: '#ffd24a',
    cyanRGB: '34,225,255', magRGB: '255,61,203', ambRGB: '255,210,74'
  };

  function tablePath(g, W, H, R, inset) {
    var x0 = inset, y0 = inset, x1 = W - inset, y1 = H - inset, r = R - inset;
    g.beginPath();
    g.moveTo(x0 + r, y0);
    g.lineTo(x1 - r, y0); g.arcTo(x1, y0, x1, y0 + r, r);
    g.lineTo(x1, y1 - r); g.arcTo(x1, y1, x1 - r, y1, r);
    g.lineTo(x0 + r, y1); g.arcTo(x0, y1, x0, y1 - r, r);
    g.lineTo(x0, y0 + r); g.arcTo(x0, y0, x0 + r, y0, r);
    g.closePath();
  }

  function buildTableLayer(pw, ph, cfg) {
    var W = cfg.W, H = cfg.H, R = cfg.cornerR;
    var cv = document.createElement('canvas');
    cv.width = pw; cv.height = ph;
    var g = cv.getContext('2d');
    g.scale(pw / W, ph / H);
    var gx0 = W / 2 - cfg.goalW / 2, gx1 = W / 2 + cfg.goalW / 2, i, j;

    var bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0d1033'); bg.addColorStop(0.5, '#080b24'); bg.addColorStop(1, '#0a1235');
    tablePath(g, W, H, R, 0);
    g.fillStyle = bg; g.fill();

    g.save();
    tablePath(g, W, H, R, 0); g.clip();
    var rg = g.createRadialGradient(W / 2, 0, 10, W / 2, 0, 330);
    rg.addColorStop(0, 'rgba(' + COL.magRGB + ',0.22)'); rg.addColorStop(1, 'rgba(' + COL.magRGB + ',0)');
    g.fillStyle = rg; g.fillRect(0, 0, W, H);
    var rg2 = g.createRadialGradient(W / 2, H, 10, W / 2, H, 330);
    rg2.addColorStop(0, 'rgba(' + COL.cyanRGB + ',0.22)'); rg2.addColorStop(1, 'rgba(' + COL.cyanRGB + ',0)');
    g.fillStyle = rg2; g.fillRect(0, 0, W, H);
    // air holes
    g.fillStyle = 'rgba(160,190,255,0.085)';
    for (i = 10; i < W; i += 16) for (j = 10; j < H; j += 16) { g.beginPath(); g.arc(i, j, 1.1, 0, 6.2832); g.fill(); }
    g.restore();

    // creases and face-off marks
    g.lineWidth = 2;
    g.strokeStyle = 'rgba(' + COL.magRGB + ',0.4)';
    g.beginPath(); g.arc(W / 2, 0, 92, 0, Math.PI); g.stroke();
    g.strokeStyle = 'rgba(' + COL.cyanRGB + ',0.4)';
    g.beginPath(); g.arc(W / 2, H, 92, Math.PI, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(200,220,255,0.22)';
    [[W * 0.25, H * 0.25], [W * 0.75, H * 0.25], [W * 0.25, H * 0.75], [W * 0.75, H * 0.75]].forEach(function (pt) {
      g.beginPath(); g.arc(pt[0], pt[1], 5, 0, 6.2832); g.fill();
    });

    // centre line and circle
    g.save();
    g.shadowColor = 'rgba(180,220,255,0.8)'; g.shadowBlur = 8;
    g.strokeStyle = 'rgba(200,225,255,0.55)'; g.lineWidth = 2.5;
    g.setLineDash([12, 9]);
    g.beginPath(); g.moveTo(8, H / 2); g.lineTo(W - 8, H / 2); g.stroke();
    g.setLineDash([]);
    g.beginPath(); g.arc(W / 2, H / 2, 60, 0, 6.2832); g.stroke();
    g.beginPath(); g.arc(W / 2, H / 2, 5, 0, 6.2832); g.fillStyle = 'rgba(200,225,255,0.8)'; g.fill();
    g.restore();

    // rim
    var rim = g.createLinearGradient(0, 0, 0, H);
    rim.addColorStop(0, COL.magenta); rim.addColorStop(0.5, '#7b6cff'); rim.addColorStop(1, COL.cyan);
    g.save();
    g.shadowColor = 'rgba(120,140,255,0.9)'; g.shadowBlur = 14;
    g.lineWidth = 5; g.strokeStyle = rim;
    tablePath(g, W, H, R, 2.5); g.stroke();
    g.restore();
    g.lineWidth = 1.2; g.strokeStyle = 'rgba(255,255,255,0.5)';
    tablePath(g, W, H, R, 2.5); g.stroke();

    // goal mouths: cut the rim, draw the goal line and glowing posts
    function mouth(y, col, rgb, dir) {
      g.fillStyle = '#05061a';
      g.fillRect(gx0, y === 0 ? -1 : H - 8, gx1 - gx0, 9);
      var gl = g.createLinearGradient(0, y, 0, y + dir * 40);
      gl.addColorStop(0, 'rgba(' + rgb + ',0.45)'); gl.addColorStop(1, 'rgba(' + rgb + ',0)');
      g.fillStyle = gl; g.fillRect(gx0, dir > 0 ? 0 : H - 40, gx1 - gx0, 40);
      g.save();
      g.shadowColor = col; g.shadowBlur = 14;
      g.strokeStyle = col; g.lineWidth = 3;
      g.beginPath(); g.moveTo(gx0, y + dir * 1.5); g.lineTo(gx1, y + dir * 1.5); g.stroke();
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(gx0, y, 6, 0, 6.2832); g.fill();
      g.beginPath(); g.arc(gx1, y, 6, 0, 6.2832); g.fill();
      g.restore();
    }
    mouth(0, COL.magenta, COL.magRGB, 1);
    mouth(H, COL.cyan, COL.cyanRGB, -1);
    return cv;
  }

  function buildMalletSprite(cfg, scale, rgb, hex) {
    var r = cfg.malletR, pad = 22, half = r + pad;
    var cv = document.createElement('canvas');
    cv.width = Math.ceil(half * 2 * scale); cv.height = cv.width;
    var g = cv.getContext('2d');
    g.scale(scale, scale);
    g.translate(half, half);
    var glow = g.createRadialGradient(0, 0, r * 0.7, 0, 0, r + pad);
    glow.addColorStop(0, 'rgba(' + rgb + ',0.5)'); glow.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = glow; g.beginPath(); g.arc(0, 0, r + pad, 0, 6.2832); g.fill();
    var body = g.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
    body.addColorStop(0, '#ffffff'); body.addColorStop(0.25, hex); body.addColorStop(1, 'rgba(' + rgb + ',0.35)');
    g.fillStyle = body; g.beginPath(); g.arc(0, 0, r, 0, 6.2832); g.fill();
    g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.beginPath(); g.arc(0, 0, r - 2, 0, 6.2832); g.stroke();
    var hd = g.createRadialGradient(-r * 0.12, -r * 0.14, 1, 0, 0, r * 0.46);
    hd.addColorStop(0, 'rgba(255,255,255,0.95)'); hd.addColorStop(1, 'rgba(' + rgb + ',0.9)');
    g.fillStyle = hd; g.beginPath(); g.arc(0, 0, r * 0.46, 0, 6.2832); g.fill();
    g.lineWidth = 2; g.strokeStyle = 'rgba(10,12,40,0.55)';
    g.beginPath(); g.arc(0, 0, r * 0.46, 0, 6.2832); g.stroke();
    return { cv: cv, half: half };
  }

  function buildPuckSprite(cfg, scale) {
    var r = cfg.puckR, pad = 18, half = r + pad;
    var cv = document.createElement('canvas');
    cv.width = Math.ceil(half * 2 * scale); cv.height = cv.width;
    var g = cv.getContext('2d');
    g.scale(scale, scale);
    g.translate(half, half);
    var glow = g.createRadialGradient(0, 0, r * 0.6, 0, 0, r + pad);
    glow.addColorStop(0, 'rgba(' + COL.ambRGB + ',0.6)'); glow.addColorStop(1, 'rgba(' + COL.ambRGB + ',0)');
    g.fillStyle = glow; g.beginPath(); g.arc(0, 0, r + pad, 0, 6.2832); g.fill();
    var body = g.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r);
    body.addColorStop(0, '#fff6cf'); body.addColorStop(0.45, '#2a2d5e'); body.addColorStop(1, '#0d0f2b');
    g.fillStyle = body; g.beginPath(); g.arc(0, 0, r, 0, 6.2832); g.fill();
    g.lineWidth = 3; g.strokeStyle = COL.amber;
    g.beginPath(); g.arc(0, 0, r - 1.5, 0, 6.2832); g.stroke();
    g.lineWidth = 1.2; g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.beginPath(); g.arc(0, 0, r * 0.55, 0, 6.2832); g.stroke();
    return { cv: cv, half: half };
  }

  // ---------------------------------------------------------------
  // 6. Game
  // ---------------------------------------------------------------
  function $(id) { return document.getElementById(id); }

  function storeGet(store, key) { try { return window[store].getItem(key); } catch (e) { return null; } }
  function storeSet(store, key, val) { try { window[store].setItem(key, val); } catch (e) { /* storage unavailable */ } }

  function Game() {
    this.cv = $('table');
    this.ctx = this.cv.getContext('2d');
    this.wrap = $('table-wrap');
    this.sim = new Sim({ seed: (Math.random() * 1e9) | 0 });
    this.levelIdx = 1;
    var savedLevel = parseInt(storeGet('localStorage', 'neonAirHockey.level'), 10);
    if (savedLevel >= 0 && savedLevel < LEVELS.length) this.levelIdx = savedLevel;
    this.ai = new AIController(this.sim, 1, LEVELS[this.levelIdx], (Math.random() * 1e9) | 0);
    this.sound = new Sound();
    this.sound.muted = storeGet('localStorage', 'neonAirHockey.muted') === '1';
    this.state = 'menu';
    this.prevState = 'menu';
    this.score = [0, 0];
    this.record = { w: 0, l: 0 };
    var rec = storeGet('sessionStorage', 'neonAirHockey.record');
    if (rec) { try { var o = JSON.parse(rec); this.record.w = o.w | 0; this.record.l = o.l | 0; } catch (e) { /* ignore */ } }
    this.serveSide = 0;
    this.cd = 0; this.lastCdNum = 0;
    this.goalT = 0; this.goalSide = -1; this.goalPos = { x: 0, y: 0 };
    this.acc = 0; this.last = 0; this.raf = 0;
    this.tx = this.sim.mallets[0].x; this.ty = this.sim.mallets[0].y;
    this.keys = {};
    this.touchActive = false;
    this.particles = [];
    this.rings = [];
    this.trail = [];
    this.flash = 0; this.flashCol = COL.cyanRGB;
    this.bannerTimer = 0;
    this.reduceMotion = false;
    this.helpOpen = false; this.helpReturn = null; this.helpFocusEl = null;
    this.scale = 1; this.layer = null; this.sprites = null; this.dead = false;
    this.bindDom();
    this.applyMotionPref();
    this.updateHud();
    this.updateSoundUi();
    this.showOverlay('start');
    this.resize();
    this.setStatus('Neon Air Hockey ready. Choose a level and start the match. First to ' + TARGET_SCORE + ' wins.');
  }

  Game.prototype.bindDom = function () {
    var self = this;
    var on = function (id, ev, fn) { var el = $(id); if (el) el.addEventListener(ev, fn); };
    on('btn-start', 'click', function () { self.sound.ensure(); self.startMatch(); });
    on('btn-howto-start', 'click', function () { self.openHelp($('btn-howto-start')); });
    on('btn-pause', 'click', function () { self.sound.ensure(); self.togglePause(); });
    on('btn-restart', 'click', function () { self.sound.ensure(); self.restart(); });
    on('btn-sound', 'click', function () { self.sound.ensure(); self.toggleMute(); });
    on('btn-help', 'click', function () { self.openHelp($('btn-help')); });
    on('btn-resume', 'click', function () { self.resume(); });
    on('btn-restart-pause', 'click', function () { self.restart(); });
    on('btn-howto-pause', 'click', function () { self.openHelp($('btn-howto-pause')); });
    on('btn-menu-pause', 'click', function () { self.toMenu(); });
    on('btn-again', 'click', function () { self.sound.ensure(); self.startMatch(); });
    on('btn-menu-over', 'click', function () { self.toMenu(); });
    on('btn-help-close', 'click', function () { self.closeHelp(); });
    on('btn-help-done', 'click', function () { self.closeHelp(); });
    var radios = document.querySelectorAll('input[name="level"]');
    Array.prototype.forEach.call(radios, function (r) {
      r.addEventListener('change', function () { if (r.checked) self.setLevel(parseInt(r.value, 10)); });
    });
    var chk = document.querySelector('input[name="level"][value="' + this.levelIdx + '"]');
    if (chk) chk.checked = true;

    window.addEventListener('keydown', function (e) { self.onKeyDown(e); });
    window.addEventListener('keyup', function (e) { self.onKeyUp(e); });
    window.addEventListener('blur', function () { self.keys = {}; });
    window.addEventListener('pointermove', function (e) { self.onPointer(e, false); }, { passive: true });
    this.wrap.addEventListener('pointerdown', function (e) { self.sound.ensure(); self.onPointer(e, true); });
    window.addEventListener('pointerup', function (e) { if (e.pointerType === 'touch') self.touchActive = false; });
    window.addEventListener('pointercancel', function (e) { if (e.pointerType === 'touch') self.touchActive = false; });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && (self.state === 'playing' || self.state === 'countdown')) self.pause(true);
    });
    window.addEventListener('message', function (e) {
      var d = e.data;
      if (!d || typeof d !== 'object') return;
      if (d.type === 'ARCADEVERSE_PAUSE') { if (self.state === 'playing' || self.state === 'countdown') self.pause(true); }
      else if (d.type === 'ARCADEVERSE_TEARDOWN') self.teardown();
      else if (d.type === 'ARCADEVERSE_AUDIO_CONFIG' && typeof d.muted === 'boolean') self.sound.hubMuted = d.muted;
      else if (d.type === 'AV_RESIZE') self.resize();
    });
    if (window.ResizeObserver) new ResizeObserver(function () { self.resize(); }).observe(this.wrap);
    else window.addEventListener('resize', function () { self.resize(); });
    var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    this.mq = mq;
    if (mq) {
      var h = function () { self.applyMotionPref(); };
      if (mq.addEventListener) mq.addEventListener('change', h); else if (mq.addListener) mq.addListener(h);
    }
  };

  Game.prototype.applyMotionPref = function () {
    this.reduceMotion = !!(this.mq && this.mq.matches);
    document.documentElement.classList.toggle('reduce-motion', this.reduceMotion);
    if (this.reduceMotion) { this.particles.length = 0; this.rings.length = 0; this.trail.length = 0; this.flash = 0; }
  };

  Game.prototype.teardown = function () {
    this.dead = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.sound.close();
  };

  // ----- layout / canvas sizing -----------------------------------
  Game.prototype.resize = function () {
    var rect = this.wrap.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    var pw = Math.round(rect.width * dpr), ph = Math.round(rect.height * dpr);
    if (pw === this.cv.width && ph === this.cv.height && this.layer) return;
    this.cv.width = pw; this.cv.height = ph;
    this.scale = pw / this.sim.cfg.W;
    this.layer = buildTableLayer(pw, ph, this.sim.cfg);
    this.sprites = {
      player: buildMalletSprite(this.sim.cfg, this.scale, COL.cyanRGB, COL.cyan),
      ai: buildMalletSprite(this.sim.cfg, this.scale, COL.magRGB, COL.magenta),
      puck: buildPuckSprite(this.sim.cfg, this.scale)
    };
    this.render(0);
  };

  // ----- UI helpers ------------------------------------------------
  Game.prototype.setStatus = function (msg) {
    var el = $('status');
    if (el) el.textContent = msg;
  };

  Game.prototype.updateHud = function () {
    $('score-you').textContent = String(this.score[0]);
    $('score-ai').textContent = String(this.score[1]);
    $('hud-level').textContent = LEVELS[this.levelIdx].name;
    $('rec-w').textContent = String(this.record.w);
    $('rec-l').textContent = String(this.record.l);
  };

  Game.prototype.updateSoundUi = function () {
    var b = $('btn-sound');
    var muted = this.sound.muted;
    b.setAttribute('aria-pressed', muted ? 'true' : 'false');
    b.setAttribute('aria-label', muted ? 'Sound is off. Turn sound on' : 'Sound is on. Turn sound off');
    b.title = muted ? 'Sound off (M)' : 'Sound on (M)';
    $('icon-sound-on').classList.toggle('hidden', muted);
    $('icon-sound-off').classList.toggle('hidden', !muted);
  };

  Game.prototype.updatePauseUi = function () {
    var paused = this.state === 'paused';
    var b = $('btn-pause');
    b.setAttribute('aria-label', paused ? 'Resume game' : 'Pause game');
    b.title = paused ? 'Resume (P)' : 'Pause (P)';
    $('icon-pause').classList.toggle('hidden', paused);
    $('icon-play').classList.toggle('hidden', !paused);
    var active = this.state === 'playing' || this.state === 'countdown' || this.state === 'goal' || paused;
    b.disabled = !active;
    $('btn-restart').disabled = this.state === 'menu';
  };

  Game.prototype.showOverlay = function (name) {
    var names = ['start', 'pause', 'over'];
    for (var i = 0; i < names.length; i++) {
      var el = $('overlay-' + names[i]);
      if (el) el.hidden = names[i] !== name;
    }
    var focusId = name === 'start' ? 'btn-start' : name === 'pause' ? 'btn-resume' : name === 'over' ? 'btn-again' : null;
    if (focusId) { try { $(focusId).focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    this.updatePauseUi();
  };

  Game.prototype.showBanner = function (text, kind, ms) {
    var b = $('banner');
    b.textContent = text;
    b.className = 'banner show ' + (kind || '');
    this.bannerTimer = ms || 700;
    // restart the CSS animation
    void b.offsetWidth;
  };

  Game.prototype.hideBanner = function () {
    var b = $('banner');
    b.className = 'banner';
    b.textContent = '';
    this.bannerTimer = 0;
  };

  Game.prototype.setLevel = function (idx) {
    this.levelIdx = idx;
    storeSet('localStorage', 'neonAirHockey.level', String(idx));
    this.ai = new AIController(this.sim, 1, LEVELS[idx], (Math.random() * 1e9) | 0);
    this.updateHud();
  };

  Game.prototype.toggleMute = function () {
    this.sound.muted = !this.sound.muted;
    storeSet('localStorage', 'neonAirHockey.muted', this.sound.muted ? '1' : '0');
    this.updateSoundUi();
    this.setStatus(this.sound.muted ? 'Sound off.' : 'Sound on.');
    if (!this.sound.muted) { this.sound.ensure(); this.sound.tick(false); }
  };

  // ----- match flow -------------------------------------------------
  Game.prototype.startMatch = function () {
    this.score = [0, 0];
    this.serveSide = 0;
    this.particles.length = 0; this.rings.length = 0; this.trail.length = 0; this.flash = 0;
    this.helpOpen = false; $('overlay-help').hidden = true;
    this.updateHud();
    this.showOverlay(null);
    this.beginServe();
    this.setStatus('Match started on ' + LEVELS[this.levelIdx].name + '. ' +
      (this.serveSide === 0 ? 'You serve.' : 'The AI serves.') + ' First to ' + TARGET_SCORE + ' wins. Score 0 to 0.');
    try { this.wrap.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  };

  Game.prototype.beginServe = function () {
    var c = this.sim.cfg;
    this.sim.frozen = true;
    this.sim.placePuck(c.W / 2, this.serveSide === 0 ? c.H * 0.64 : c.H * 0.36, 0, 0);
    this.sim.placeMallet(1, this.sim.mallets[1].homeX, this.sim.mallets[1].homeY);
    this.ai.reset();
    this.trail.length = 0;
    this.state = 'countdown';
    this.cd = 3 * 0.6;
    this.lastCdNum = 4;
    this.updatePauseUi();
  };

  Game.prototype.restart = function () {
    this.startMatch();
    this.setStatus('Match restarted. Score 0 to 0. First to ' + TARGET_SCORE + ' wins.');
  };

  Game.prototype.toMenu = function () {
    this.state = 'menu';
    this.sim.frozen = true;
    this.sim.placePuck(this.sim.cfg.W / 2, this.sim.cfg.H / 2, 0, 0);
    this.sim.placeMallet(1, this.sim.mallets[1].homeX, this.sim.mallets[1].homeY);
    this.score = [0, 0];
    this.hideBanner();
    this.updateHud();
    this.showOverlay('start');
    this.setStatus('Back at the start screen. Choose a level to play again.');
  };

  Game.prototype.pause = function (silent) {
    if (this.state !== 'playing' && this.state !== 'countdown' && this.state !== 'goal') return;
    this.prevState = this.state;
    this.state = 'paused';
    this.keys = {};
    this.showOverlay('pause');
    if (!silent) this.setStatus('Paused.');
    else this.setStatus('Paused automatically.');
  };

  Game.prototype.resume = function () {
    if (this.state !== 'paused') return;
    this.state = this.prevState;
    this.showOverlay(null);
    this.last = 0;
    this.setStatus('Resumed.');
    try { this.wrap.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  };

  Game.prototype.togglePause = function () {
    if (this.state === 'paused') this.resume(); else this.pause(false);
  };

  Game.prototype.openHelp = function (opener) {
    if (this.helpOpen) return;
    this.helpOpen = true;
    this.helpFocusEl = opener || null;
    if (this.state === 'playing' || this.state === 'countdown' || this.state === 'goal') this.pause(true);
    $('overlay-help').hidden = false;
    this.keys = {};
    try { $('btn-help-close').focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  };

  Game.prototype.closeHelp = function () {
    if (!this.helpOpen) return;
    this.helpOpen = false;
    $('overlay-help').hidden = true;
    var el = this.helpFocusEl;
    if (this.state === 'paused') this.setStatus('Paused. Press Resume or P to continue.');
    if (el && !el.closest('[hidden]')) { try { el.focus({ preventScroll: true }); return; } catch (e) { /* ignore */ } }
    var f = this.state === 'paused' ? 'btn-resume' : (this.state === 'menu' ? 'btn-start' : (this.state === 'over' ? 'btn-again' : null));
    if (f) { try { $(f).focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  };

  Game.prototype.onGoal = function (side) {
    this.score[side]++;
    this.goalSide = side;
    this.state = 'goal';
    var c = this.sim.cfg, p = this.sim.puck;
    this.goalPos.x = clamp(p.x, this.sim.gx0 + 20, this.sim.gx1 - 20);
    this.goalPos.y = side === 0 ? 0 : c.H;
    this.sim.frozen = true;
    this.serveSide = 1 - side;                         // the side that conceded serves
    var you = side === 0;
    this.sound.goal(you);
    this.spawnGoalFx(this.goalPos.x, this.goalPos.y, you ? COL.cyanRGB : COL.magRGB, you);
    this.updateHud();
    var done = this.score[side] >= TARGET_SCORE;
    this.goalT = done ? 2.0 : 1.5;
    this.showBanner(you ? 'GOAL' : 'AI SCORES', you ? 'good' : 'bad', done ? 1900 : 1400);
    this.setStatus((you ? 'Goal! You score. ' : 'The AI scores. ') + 'You ' + this.score[0] + ', AI ' + this.score[1] + '.');
    this.pendingEnd = done;
  };

  Game.prototype.afterGoal = function () {
    if (this.pendingEnd) { this.endMatch(); return; }
    this.beginServe();
    this.setStatus('Serve: ' + (this.serveSide === 0 ? 'you' : 'the AI') + '. Score ' + this.score[0] + ' to ' + this.score[1] + '.');
  };

  Game.prototype.endMatch = function () {
    var win = this.score[0] > this.score[1];
    this.state = 'over';
    if (win) this.record.w++; else this.record.l++;
    storeSet('sessionStorage', 'neonAirHockey.record', JSON.stringify(this.record));
    this.updateHud();
    this.hideBanner();
    $('over-title').textContent = win ? 'Victory' : 'Defeat';
    $('over-title').className = 'overlay-title ' + (win ? 'win' : 'lose');
    $('over-score').textContent = this.score[0] + ' : ' + this.score[1];
    $('over-note').textContent = win
      ? 'You beat the ' + LEVELS[this.levelIdx].name + ' AI.'
      : 'The ' + LEVELS[this.levelIdx].name + ' AI took this one.';
    $('over-w').textContent = String(this.record.w);
    $('over-l').textContent = String(this.record.l);
    this.sound.end(win);
    this.showOverlay('over');
    this.setStatus('Match over. ' + (win ? 'You win ' : 'The AI wins ') +
      Math.max(this.score[0], this.score[1]) + ' to ' + Math.min(this.score[0], this.score[1]) +
      '. Session record: ' + this.record.w + ' wins, ' + this.record.l + ' losses.');
  };

  // ----- effects -----------------------------------------------------
  Game.prototype.spawnGoalFx = function (x, y, rgb, mine) {
    this.rings.push({ x: x, y: y, t: 0, rgb: rgb });
    if (this.reduceMotion) return;
    var n = 150, i, a, sp, dirY = y === 0 ? 1 : -1;
    for (i = 0; i < n; i++) {
      a = Math.random() * Math.PI;
      sp = 80 + Math.random() * 520;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 100, y: y,
        vx: Math.cos(a) * sp * (Math.random() < 0.5 ? -1 : 1) * 0.9,
        vy: Math.sin(a) * sp * dirY,
        life: 0, max: 0.8 + Math.random() * 0.9, size: 1.5 + Math.random() * 3,
        rgb: Math.random() < 0.25 ? COL.ambRGB : rgb
      });
    }
    this.flash = 1; this.flashCol = rgb;
    if (this.particles.length > 600) this.particles.splice(0, this.particles.length - 600);
  };

  Game.prototype.sparks = function (x, y, speed, rgb) {
    if (this.reduceMotion) return;
    var n = Math.min(14, 3 + Math.floor(speed / 120)), i, a, sp;
    for (i = 0; i < n; i++) {
      a = Math.random() * 6.2832; sp = 60 + Math.random() * 240;
      this.particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 0.25 + Math.random() * 0.25, size: 1.2 + Math.random() * 1.8, rgb: rgb });
    }
    if (this.particles.length > 600) this.particles.splice(0, this.particles.length - 600);
  };

  Game.prototype.updateFx = function (dt) {
    var i, p;
    for (i = this.particles.length - 1; i >= 0; i--) {
      p = this.particles[i];
      p.life += dt;
      if (p.life >= p.max) { this.particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      var f = Math.exp(-2.2 * dt); p.vx *= f; p.vy *= f;
    }
    for (i = this.rings.length - 1; i >= 0; i--) {
      this.rings[i].t += dt;
      if (this.rings[i].t > 0.9) this.rings.splice(i, 1);
    }
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.4);
  };

  // ----- input -------------------------------------------------------
  Game.prototype.activeForInput = function () {
    return this.state === 'playing' || this.state === 'countdown' || this.state === 'goal';
  };

  Game.prototype.onPointer = function (e, down) {
    if (this.dead) return;
    var isTouch = e.pointerType === 'touch';
    if (isTouch) {
      if (down) this.touchActive = true;
      else if (!this.touchActive) return;
    }
    if (!this.activeForInput()) return;
    var rect = this.wrap.getBoundingClientRect();
    if (rect.width < 1) return;
    var c = this.sim.cfg;
    var x = (e.clientX - rect.left) * c.W / rect.width;
    var y = (e.clientY - rect.top) * c.H / rect.height;
    if (isTouch) y -= 26;                           // keep the mallet visible above the fingertip
    this.tx = x; this.ty = y;
  };

  var MOVE_KEYS = {
    arrowleft: 'l', a: 'l', arrowright: 'r', d: 'r', arrowup: 'u', w: 'u', arrowdown: 'd', s: 'd'
  };

  Game.prototype.onKeyDown = function (e) {
    if (this.dead || e.ctrlKey || e.metaKey || e.altKey) return;
    var key = (e.key || '').toLowerCase();
    if (this.helpOpen) {
      if (key === 'escape') { e.preventDefault(); this.closeHelp(); }
      else if (key === 'tab') this.trapTab(e);
      return;
    }
    if (key === 'escape' || key === 'p') {
      if (this.state === 'paused' || this.activeForInput()) { e.preventDefault(); this.togglePause(); }
      return;
    }
    if (key === 'm') { this.sound.ensure(); this.toggleMute(); return; }
    if (key === 'h' || key === '?') { this.openHelp(null); return; }
    if (key === 'r' && this.state !== 'menu') { e.preventDefault(); this.sound.ensure(); this.restart(); return; }
    var mk = MOVE_KEYS[key];
    if (mk && this.activeForInput()) {
      e.preventDefault();
      this.keys[mk] = true;
      this.sound.ensure();
    }
  };

  Game.prototype.onKeyUp = function (e) {
    var mk = MOVE_KEYS[(e.key || '').toLowerCase()];
    if (mk) this.keys[mk] = false;
  };

  Game.prototype.trapTab = function (e) {
    var root = $('overlay-help');
    var items = root.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])');
    if (!items.length) return;
    var first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  Game.prototype.applyKeys = function (dt) {
    var k = this.keys, sp = 560 * dt, dx = 0, dy = 0;
    if (k.l) dx -= 1; if (k.r) dx += 1; if (k.u) dy -= 1; if (k.d) dy += 1;
    if (!dx && !dy) return;
    if (dx && dy) { dx *= 0.7071; dy *= 0.7071; }
    var m = this.sim.mallets[0];
    // move the target from where the mallet actually is, so keys never run away from the mallet
    var bx = Math.abs(this.tx - m.x) + Math.abs(this.ty - m.y) > 80 ? m.x : this.tx;
    var by = Math.abs(this.tx - m.x) + Math.abs(this.ty - m.y) > 80 ? m.y : this.ty;
    this.tx = bx + dx * sp; this.ty = by + dy * sp;
  };

  // ----- fixed step ----------------------------------------------------
  Game.prototype.fixedUpdate = function (dt) {
    var sim = this.sim, st = this.state, i, ev;
    if (st === 'paused' || st === 'menu' || st === 'over') { this.updateFx(dt); return; }
    this.applyKeys(dt);
    var pm = sim.mallets[0];
    pm.tx = this.tx; pm.ty = this.ty;
    if (st === 'countdown') {
      this.ai.hold = true; this.ai.update(dt);
      sim.frozen = true; sim.step(dt);
      this.cd -= dt;
      var num = Math.max(1, Math.ceil(this.cd / 0.6 - 1e-9));
      if (this.cd > 0 && num !== this.lastCdNum) {
        this.lastCdNum = num;
        this.showBanner(String(num), 'count', 560);
        this.sound.tick(false);
      }
      if (this.cd <= 0) {
        this.state = 'playing';
        sim.frozen = false;
        this.ai.hold = false;
        this.showBanner('GO', 'go', 520);
        this.sound.tick(true);
        this.updatePauseUi();
      }
    } else if (st === 'playing') {
      this.ai.hold = false; this.ai.update(dt);
      sim.frozen = false; sim.step(dt);
      for (i = 0; i < sim.events.length; i++) {
        ev = sim.events[i];
        if (ev.type === 'mallet') {
          this.sound.hit(ev.speed);
          this.sparks(ev.x, ev.y, ev.speed, ev.side === 0 ? COL.cyanRGB : COL.magRGB);
        } else if (ev.type === 'wall') this.sound.wall(ev.speed);
        else if (ev.type === 'post') this.sound.post();
        else if (ev.type === 'pulse') {
          this.sound.pulse();
          this.setStatus('Plasma pulse freed the puck.');
        }
      }
      if (sim.scored >= 0) this.onGoal(sim.scored);
    } else if (st === 'goal') {
      this.ai.hold = true; this.ai.update(dt);
      sim.frozen = true; sim.step(dt);
      this.goalT -= dt;
      if (this.goalT <= 0) this.afterGoal();
    }
    this.updateFx(dt);
  };

  Game.prototype.advance = function (frameDt) {
    this.acc += Math.min(frameDt, 0.1);
    var n = 0;
    while (this.acc >= STEP - 1e-9 && n < 16) {
      this.fixedUpdate(STEP);
      this.acc -= STEP; n++;
    }
    if (n >= 16) this.acc = 0;
    if (this.acc < 0) this.acc = 0;
  };

  Game.prototype.loop = function (ts) {
    if (this.dead) return;
    var self = this;
    this.raf = requestAnimationFrame(function (t) { self.loop(t); });
    var dt = this.last ? (ts - this.last) / 1000 : 0;
    this.last = ts;
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt * 1000;
      if (this.bannerTimer <= 0) this.hideBanner();
    }
    this.advance(dt);
    this.render(this.acc / STEP);
  };

  // ----- drawing ---------------------------------------------------------
  Game.prototype.render = function (alpha) {
    var ctx = this.ctx, c = this.sim.cfg, W = c.W, H = c.H, sim = this.sim, i, p, m;
    if (!this.layer) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.cv.width, this.cv.height);
    ctx.drawImage(this.layer, 0, 0);
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);

    // faint score numerals
    ctx.save();
    ctx.font = '700 150px ui-monospace, Consolas, "Courier New", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(' + COL.magRGB + ',0.07)';
    ctx.fillText(String(this.score[1]), W / 2, H * 0.25);
    ctx.fillStyle = 'rgba(' + COL.cyanRGB + ',0.07)';
    ctx.fillText(String(this.score[0]), W / 2, H * 0.75);
    ctx.restore();

    var pk = sim.puck;
    var puckX = pk.px + (pk.x - pk.px) * alpha, puckY = pk.py + (pk.y - pk.py) * alpha;
    var inGoal = this.state === 'goal';

    // trail
    if (!this.reduceMotion) {
      var sp = Math.sqrt(pk.vx * pk.vx + pk.vy * pk.vy);
      if (this.state === 'playing') {
        this.trail.push(puckX, puckY);
        if (this.trail.length > 28) this.trail.splice(0, 2);
      } else if (this.trail.length) this.trail.splice(0, 2);
      if (this.trail.length >= 4 && sp > 120) {
        ctx.save();
        ctx.lineCap = 'round';
        var n = this.trail.length / 2;
        for (i = 1; i < n; i++) {
          var f = i / n;
          ctx.strokeStyle = 'rgba(' + COL.ambRGB + ',' + (f * 0.35 * Math.min(1, sp / 700)).toFixed(3) + ')';
          ctx.lineWidth = 2 + f * 15;
          ctx.beginPath();
          ctx.moveTo(this.trail[(i - 1) * 2], this.trail[(i - 1) * 2 + 1]);
          ctx.lineTo(this.trail[i * 2], this.trail[i * 2 + 1]);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // puck
    if (!inGoal || this.goalT > 0.9) {
      var pa = inGoal ? clamp((this.goalT - 0.9) / 0.6, 0, 1) : 1;
      ctx.globalAlpha = pa;
      var ps = this.sprites.puck;
      ctx.drawImage(ps.cv, puckX - ps.half, puckY - ps.half, ps.half * 2, ps.half * 2);
      ctx.globalAlpha = 1;
    }

    // mallets
    for (i = 0; i < 2; i++) {
      m = sim.mallets[i];
      var mxp = m.x0 + (m.x - m.x0) * alpha, myp = m.y0 + (m.y - m.y0) * alpha;
      var sprite = i === 0 ? this.sprites.player : this.sprites.ai;
      ctx.drawImage(sprite.cv, mxp - sprite.half, myp - sprite.half, sprite.half * 2, sprite.half * 2);
    }

    // particles and rings
    if (this.particles.length || this.rings.length) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (i = 0; i < this.particles.length; i++) {
        p = this.particles[i];
        var a = 1 - p.life / p.max;
        ctx.fillStyle = 'rgba(' + p.rgb + ',' + (a * 0.9).toFixed(3) + ')';
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      for (i = 0; i < this.rings.length; i++) {
        var rg = this.rings[i], k = rg.t / 0.9;
        ctx.strokeStyle = 'rgba(' + rg.rgb + ',' + ((1 - k) * 0.9).toFixed(3) + ')';
        ctx.lineWidth = 6 * (1 - k) + 1;
        ctx.beginPath();
        ctx.arc(rg.x, rg.y, 20 + k * (this.reduceMotion ? 120 : 330), 0, 6.2832);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (this.flash > 0 && !this.reduceMotion) {
      ctx.fillStyle = 'rgba(' + this.flashCol + ',' + (this.flash * 0.22).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  };

  // ---------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------
  function boot() {
    var game = new Game();
    game.loop(0);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
