/* FABRIK point projection: Aristidou & Lasenby (2011), doi:10.1016/j.gmod.2011.05.003.
   This 2D helper adds bounded passes and relative joint-angle limits. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) {
    const sdk = root.ArcadeVerse || (root.ArcadeVerse = {});
    sdk.physics = Object.assign(sdk.physics || {}, api);
    api.mountIKLab(root.document);
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const TAU = Math.PI * 2;
  const wrap = angle => ((angle + Math.PI) % TAU + TAU) % TAU - Math.PI;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  function number(value, lo, hi) {
    if (!Number.isFinite(value) || value < lo || value > hi) throw new RangeError('Invalid bounded IK parameter.');
    return value;
  }
  function point(p) { if (!p) throw new TypeError('Expected a point.'); return { x: number(p.x, -1e6, 1e6), y: number(p.y, -1e6, 1e6) }; }
  function createIKChain(jointsCount, segmentLength, constraints = []) {
    number(jointsCount, 2, 64); number(segmentLength, .001, 10000);
    if (!Number.isInteger(jointsCount) || !Array.isArray(constraints) || constraints.length > jointsCount - 1) throw new RangeError('Use 2–64 joints and at most one limit per link.');
    const limits = Array.from({ length: jointsCount - 1 }, (_, i) => {
      const c = constraints[i]; if (c === undefined) return { min: -Math.PI, max: Math.PI };
      if (!c || typeof c !== 'object') throw new TypeError('Expected min/max limits in radians.');
      const min = number(c.min, -Math.PI, Math.PI), max = number(c.max, -Math.PI, Math.PI);
      if (min > max) throw new RangeError('Minimum angle must not exceed maximum.'); return { min, max };
    });
    const x = new Float64Array(jointsCount), y = new Float64Array(jointsCount), bestX = new Float64Array(jointsCount), bestY = new Float64Array(jointsCount);
    let base = { x: 0, y: 0 }, baseAngle = 0;
    function reset() {
      x[0] = base.x; y[0] = base.y; let angle = baseAngle;
      for (let i = 0; i < limits.length; i++) {
        angle += clamp(i % 2 ? -.17 : .19, limits[i].min, limits[i].max);
        x[i + 1] = x[i] + segmentLength * Math.cos(angle); y[i + 1] = y[i] + segmentLength * Math.sin(angle);
      }
    }
    reset();
    const chain = {
      get jointCount() { return jointsCount; },
      get reach() { return (jointsCount - 1) * segmentLength; },
      setRoot(origin, heading = 0) {
        const next = point(origin); number(heading, -1e6, 1e6);
        base = next; baseAngle = wrap(heading); reset(); return chain;
      },
      getPoints() { return Array.from(x, (value, i) => ({ x: value, y: y[i] })); },
      getLimits() { return limits.map(c => ({ ...c })); },
      solve(target, options = {}) {
        const t = point(target), passes = options.iterations ?? 5, tolerance = options.tolerance ?? .05;
        number(passes, 3, 5); number(tolerance, 1e-6, 1000);
        if (!Number.isInteger(passes)) throw new RangeError('Use 3–5 integer passes.');
        let bestError = Infinity, used = 0;
        for (let pass = 0; pass < passes; pass++) {
          x[jointsCount - 1] = t.x; y[jointsCount - 1] = t.y;
          // Reach from the target back toward the root while preserving link lengths.
          for (let i = jointsCount - 2; i >= 0; i--) {
            const dx = x[i] - x[i + 1], dy = y[i] - y[i + 1], d = Math.hypot(dx, dy);
            const ux = d > 1e-12 ? dx / d : -Math.cos(baseAngle + i * .13);
            const uy = d > 1e-12 ? dy / d : -Math.sin(baseAngle + i * .13);
            x[i] = x[i + 1] + segmentLength * ux; y[i] = y[i + 1] + segmentLength * uy;
          }
          // Anchor the root, then clamp each link relative to its parent heading.
          x[0] = base.x; y[0] = base.y; let parent = baseAngle;
          for (let i = 0; i < limits.length; i++) {
            const desired = Math.atan2(y[i + 1] - y[i], x[i + 1] - x[i]);
            parent += clamp(wrap(desired - parent), limits[i].min, limits[i].max);
            x[i + 1] = x[i] + segmentLength * Math.cos(parent); y[i + 1] = y[i] + segmentLength * Math.sin(parent);
          }
          const error = Math.hypot(x[jointsCount - 1] - t.x, y[jointsCount - 1] - t.y); used++;
          if (error < bestError) { bestError = error; bestX.set(x); bestY.set(y); }
          if (error <= tolerance) break;
        }
        x.set(bestX); y.set(bestY);
        return { converged: bestError <= tolerance, error: bestError, iterations: used,
          withinReach: Math.hypot(t.x - base.x, t.y - base.y) <= chain.reach };
      }
    };
    return Object.freeze(chain);
  }
  function createIKPreset(kind) {
    if (kind === 'arm') return [createIKChain(5, 48, [{ min: -Math.PI, max: Math.PI }, ...Array.from({ length: 3 }, () => ({ min: -1.7, max: 1.7 }))]).setRoot({ x: 170, y: 310 }, -.5)];
    if (kind === 'limb') return [createIKChain(3, 85, [{ min: -.8, max: .8 }, { min: 0, max: 2.6 }]).setRoot({ x: 340, y: 90 }, Math.PI / 2)];
    if (kind === 'tentacles') return [-1, 0, 1].map(i => createIKChain(9, 22, [{ min: -Math.PI, max: Math.PI }, ...Array.from({ length: 7 }, () => ({ min: -.85, max: .85 }))]).setRoot({ x: 170, y: 210 + i * 30 }, i * .4));
    throw new RangeError('Unknown IK preset.');
  }
  const mountedLabs = new WeakMap();
  function mountIKLab(doc) {
    const host = doc?.querySelector('[data-ik-lab]'); if (!host) return () => {};
    if (mountedLabs.has(host)) return mountedLabs.get(host);
    const win = doc.defaultView, canvas = host.querySelector('canvas'), context = canvas.getContext('2d');
    const status = host.querySelector('[data-ik-status]'); if (!context) { status.textContent = 'Canvas is unavailable. The solver API remains usable.'; return () => {}; }
    const preset = host.querySelector('select'), listeners = []; let chains = createIKPreset('arm'), target = { x: 300, y: 190 }, raf = null, settling = 0, disposed = false;
    function on(element, event, fn) { element.addEventListener(event, fn); listeners.push(() => element.removeEventListener(event, fn)); }
    function schedule() { if (!disposed && !doc.hidden && raf === null) raf = win.requestAnimationFrame(draw); }
    function move(next) { target = next; settling = 12; schedule(); }
    function draw() {
      raf = null; if (disposed || doc.hidden) return;
      const begin = win.performance.now(), results = chains.map(c => c.solve(target)), elapsed = win.performance.now() - begin;
      context.clearRect(0, 0, 800, 420); context.fillStyle = '#101a26'; context.fillRect(0, 0, 800, 420);
      for (const [index, c] of chains.entries()) {
        const points = c.getPoints(); context.strokeStyle = ['#67e8f9', '#c4b5fd', '#fbbf24'][index]; context.lineWidth = 8; context.lineCap = 'round'; context.beginPath(); context.moveTo(points[0].x, points[0].y);
        for (const p of points.slice(1)) context.lineTo(p.x, p.y); context.stroke();
        for (const p of points) { context.fillStyle = '#f8fafc'; context.beginPath(); context.arc(p.x, p.y, 5, 0, TAU); context.fill(); }
      }
      context.strokeStyle = '#fbbf24'; context.lineWidth = 2; context.beginPath(); context.arc(target.x, target.y, 10, 0, TAU); context.moveTo(target.x-16,target.y); context.lineTo(target.x+16,target.y); context.moveTo(target.x,target.y-16); context.lineTo(target.x,target.y+16); context.stroke();
      const residual = Math.max(...results.map(r => r.error));
      host.querySelector('[data-ik-reading]').textContent = `Target ${target.x.toFixed(0)}, ${target.y.toFixed(0)} · ${chains.length} chain(s) · maximum residual ${residual.toFixed(2)} px · solver ${elapsed.toFixed(3)} ms`;
      const message = results.every(r => r.converged) ? 'Target reached.' : 'Best bounded pose shown; the target may exceed reach or angle limits.';
      if (status.textContent !== message) status.textContent = message;
      if (--settling > 0 && results.some(r => !r.converged)) schedule();
    }
    const pointer = event => {
      if (event.pointerType === 'touch' && event.type === 'pointermove' && event.buttons === 0) return;
      const rect = canvas.getBoundingClientRect(); move({ x: clamp((event.clientX - rect.left) * 800 / rect.width, 0, 800), y: clamp((event.clientY - rect.top) * 420 / rect.height, 0, 420) });
    };
    on(canvas, 'pointerdown', pointer); on(canvas, 'pointermove', pointer);
    on(canvas, 'keydown', event => {
      const delta = { ArrowLeft: [-1,0], ArrowRight: [1,0], ArrowUp: [0,-1], ArrowDown: [0,1] }[event.key];
      if (!delta && event.key !== 'Home') return; event.preventDefault();
      const step = event.shiftKey ? 40 : 10; move(event.key === 'Home' ? {x:300,y:190} : {x:clamp(target.x+delta[0]*step,0,800),y:clamp(target.y+delta[1]*step,0,420)});
    });
    on(preset, 'change', () => { chains = createIKPreset(preset.value); move(target); });
    on(doc, 'visibilitychange', () => { if (doc.hidden && raf !== null) {win.cancelAnimationFrame(raf);raf=null;} else schedule(); });
    function dispose() { if (disposed) return; disposed = true; mountedLabs.delete(host); if (raf !== null) win.cancelAnimationFrame(raf);raf=null;for(const remove of listeners)remove(); }
    on(win, 'pagehide', event => { if (!event.persisted) dispose(); else if (raf !== null) {win.cancelAnimationFrame(raf);raf=null;} });
    on(win, 'pageshow', schedule); mountedLabs.set(host, dispose); move(target); return dispose;
  }
  return { createIKChain, createIKPreset, mountIKLab };
});
