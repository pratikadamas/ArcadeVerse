(function mount() {
  'use strict';
  const canvas = document.getElementById('scene');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const { prepareConvexPolygon, minimumBoundingBox, collideConvexPolygons } = window.ArcadeVerse.physics;
  const debug = document.getElementById('wireframes');
  const boxes = document.getElementById('boxes');
  const motion = document.getElementById('motion');
  const step = document.getElementById('step');
  const summary = document.getElementById('summary');
  const timing = document.getElementById('timings');

  const primary = ['#83f2df', '#cdacf8'];
  const pairCount = 60;
  const cols = 10;
  const cell = 100;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let running = !reducedMotion.matches;
  let frameId = 0;
  let lastTime;
  let elapsed = 0;
  let draws = 0;

  function prepareFixture(seed, sides, scale) {
    const points = Array.from({ length: sides }, (_, i) => {
      const angle = 2 * Math.PI * i / sides + seed * .18;
      const radial = scale * (.88 + .12 * Math.cos(i * 4 + seed));
      return { x: Math.cos(angle) * radial, y: Math.sin(angle) * radial };
    });
    points.push({ x: 0, y: 0 }, points[0]);
    const shape = prepareConvexPolygon(points);
    const bounds = {
      left: Math.min(...shape.vertices.map(p => p.x)),
      right: Math.max(...shape.vertices.map(p => p.x)),
      top: Math.min(...shape.vertices.map(p => p.y)),
      bottom: Math.max(...shape.vertices.map(p => p.y)),
    };
    return { shape, bounds, box: minimumBoundingBox(shape), points };
  }

  const pairs = Array.from({ length: pairCount }, (_, i) => ({
    a: prepareFixture(i, 5 + i % 4, 19),
    b: prepareFixture(i + 3, 5 + (i + 2) % 4, 14),
    x: (i % cols) * cell + 32,
    y: Math.floor(i / cols) * cell + 49,
    phase: i * .69,
    dx: 0, dy: 0, result: {},
  }));

  function placePairs(seconds) {
    for (const pair of pairs) {
      pair.dx = 25 + Math.sin(seconds * 1.6 + pair.phase) * 20;
      pair.dy = Math.cos(seconds * 1.14 + pair.phase) * 21;
    }
  }

  function solvePairs(offsets) {
    let contacts = 0;
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      const dx = offsets ? offsets[i * 2] : pair.dx;
      const dy = offsets ? offsets[i * 2 + 1] : pair.dy;
      const result = collideConvexPolygons(pair.a.shape, pair.b.shape, dx, dy, pair.result);
      contacts += Number(result.intersects);
    }
    return contacts;
  }

  function polygon(vertices, x, y, color, fill) {
    ctx.beginPath();
    vertices.forEach((point, i) => {
      if (i === 0) ctx.moveTo(x + point.x, y + point.y);
      else ctx.lineTo(x + point.x, y + point.y);
    });
    ctx.closePath();
    if (fill) { ctx.fillStyle = color; ctx.fill(); }
    else { ctx.strokeStyle = color; ctx.stroke(); }
  }

  function normalArrow(x, y, nx, ny, depth) {
    const distance = Math.max(10, Math.min(22, depth + 8));
    const endX = x + nx * distance;
    const endY = y + ny * distance;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(endX, endY);
    ctx.lineTo(endX - nx * 5 - ny * 3, endY - ny * 5 + nx * 3);
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - nx * 5 + ny * 3, endY - ny * 5 - nx * 3);
    ctx.strokeStyle = '#ffc87c';
    ctx.stroke();
  }

  function render() {
    placePairs(elapsed);
    const contacts = solvePairs();
    let boxOnly = 0;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 1.4;
    for (const pair of pairs) {
      const { a, b, dx, dy, x, y, result } = pair;
      const envelope = a.bounds.right >= b.bounds.left + dx && a.bounds.left <= b.bounds.right + dx
        && a.bounds.bottom >= b.bounds.top + dy && a.bounds.top <= b.bounds.bottom + dy;
      if (envelope && !result.intersects) boxOnly++;
      ctx.strokeStyle = '#303c50';
      ctx.strokeRect(x - 31, y - 48, 98, 98);
      polygon(a.shape.vertices, x, y, '#2e786e', true);
      polygon(b.shape.vertices, x + dx, y + dy, result.intersects ? '#9865a1' : '#55466e', true);
      if (boxes.checked) {
        ctx.setLineDash([3, 3]);
        polygon(a.box.corners, x, y, '#839aab', false);
        polygon(b.box.corners, x + dx, y + dy, '#839aab', false);
        ctx.setLineDash([]);
      }
      if (debug.checked) {
        polygon(a.shape.vertices, x, y, primary[0], false);
        polygon(b.shape.vertices, x + dx, y + dy, primary[1], false);
        if (result.depth > 0) normalArrow(x + dx, y + dy, result.normalX, result.normalY, result.depth);
      }
    }
    canvas.dataset.frame = String(++draws);
    canvas.dataset.wireframes = String(debug.checked);
    canvas.dataset.boxes = String(boxes.checked);
    summary.textContent = `${contacts} contacts · ${boxOnly} box-only hits avoided · ${pairCount} pairs`;
  }

  function animate(now) {
    frameId = 0;
    if (!running || document.hidden) return;
    if (lastTime !== undefined) elapsed += Math.min((now - lastTime) / 1000, .05);
    lastTime = now;
    render();
    frameId = requestAnimationFrame(animate);
  }

  function syncMotion() {
    motion.textContent = running ? 'Pause' : 'Play';
    step.disabled = running;
    lastTime = undefined;
    if (frameId) cancelAnimationFrame(frameId);
    frameId = running && !document.hidden ? requestAnimationFrame(animate) : 0;
  }

  motion.addEventListener('click', () => { running = !running; syncMotion(); });
  step.addEventListener('click', () => { elapsed += 1 / 20; render(); });
  debug.addEventListener('change', render);
  boxes.addEventListener('change', render);
  document.addEventListener('visibilitychange', syncMotion);
  window.addEventListener('pagehide', () => { cancelAnimationFrame(frameId); frameId = 0; });
  window.addEventListener('pageshow', syncMotion);
  reducedMotion.addEventListener('change', event => {
    if (event.matches) { running = false; syncMotion(); }
  });

  document.getElementById('benchmark').addEventListener('click', () => {
    for (let i = 0; i < 80; i++) { placePairs(i * .07); solvePairs(); }
    const groupSize = 12;
    const batches = Array.from({ length: 240 }, (_, i) => {
      placePairs(i * .07);
      return Float64Array.from(pairs.flatMap(pair => [pair.dx, pair.dy]));
    });
    const averagePerBatch = [];
    let hits = 0;
    // Group timings span multiple timer ticks even when one batch is faster
    // than the browser clock's precision.
    for (let i = 0; i < batches.length; i += groupSize) {
      const start = performance.now();
      for (let j = i; j < i + groupSize; j++) hits += solvePairs(batches[j]);
      averagePerBatch.push((performance.now() - start) / groupSize);
    }
    averagePerBatch.sort((a, b) => a - b);
    const median = (averagePerBatch[9] + averagePerBatch[10]) / 2;
    const p95 = averagePerBatch[18];
    timing.textContent = `60 pairs × 240 batches · median ${median.toFixed(3)} ms · p95 ${p95.toFixed(3)} ms · ${hits} contacts (12-batch group averages)`;
    render();
  });
  render();
  syncMotion();
})();
