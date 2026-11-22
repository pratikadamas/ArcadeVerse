const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const {
  convexHull, prepareConvexPolygon, minimumBoundingBox, collideConvexPolygons,
} = require('../assets/js/convex-hull-collision.js');

const p = (x, y) => ({ x, y });
const rectangle = (x, y, w, h) => [p(x, y), p(x + w, y), p(x + w, y + h), p(x, y + h)];
const near = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) <= tolerance, `${a} ≠ ${b}`);

test('monotone chain drops duplicate, interior and collinear edge points in counterclockwise order', () => {
  assert.deepEqual(convexHull([p(1, 1), p(2, 2), p(0, 2), p(2, 0), p(1, 0), p(0, 0), p(0, 0)]),
    [p(0, 0), p(2, 0), p(2, 2), p(0, 2)]);
});

test('empty, duplicate-only and collinear hulls have no polygonal area', () => {
  const solid = prepareConvexPolygon(rectangle(0, 0, 4, 3));
  const degenerate = [[], [p(1, 1)], [p(2, 2), p(0, 0), p(1, 1), p(2, 2)]];
  assert.deepEqual(convexHull(degenerate[2]), [p(0, 0), p(2, 2)]);
  for (const points of degenerate) {
    const hull = prepareConvexPolygon(points);
    assert.equal(minimumBoundingBox(hull), null);
    assert.equal(collideConvexPolygons(solid, hull).intersects, false);
  }
});

test('prepared vertices are immutable and independent of the input', () => {
  const points = rectangle(0, 0, 4, 3);
  const shape = prepareConvexPolygon(points);
  points[0].x = 200;
  assert.deepEqual(shape.vertices[0], p(0, 0));
  assert.ok(Object.isFrozen(shape) && Object.isFrozen(shape.vertices) && Object.isFrozen(shape.vertices[0]));
});

test('rejects invalid inputs and raw shapes rather than silently returning a collision', () => {
  for (const invalid of [null, [], [null], [p(Infinity, 0)], [p(0, '1')], [p(1e8, 0)], Array(4097).fill(p(0, 0))]) {
    if (Array.isArray(invalid) && !invalid.length) continue;
    assert.throws(() => convexHull(invalid));
  }
  const shape = prepareConvexPolygon(rectangle(0, 0, 2, 2));
  assert.throws(() => collideConvexPolygons({}, shape));
  assert.throws(() => collideConvexPolygons(shape, shape, NaN));
});

test('rejects AABB phantom overlaps and handles parallel rectangle edges', () => {
  const a = prepareConvexPolygon([p(0, 0), p(3, 0), p(0, 3)]);
  const b = prepareConvexPolygon([p(1.7, 1.7), p(3, 1.7), p(1.7, 3)]);
  assert.equal(collideConvexPolygons(a, b).intersects, false);

  const rect = prepareConvexPolygon(rectangle(0, 0, 4, 3));
  const overlapping = collideConvexPolygons(rect, rect, 3, .25);
  assert.deepEqual(overlapping, {
    intersects: true, touching: false, depth: 1, normalX: 1, normalY: 0, mtvX: 1, mtvY: 0,
  });
  const touching = collideConvexPolygons(rect, rect, 4, 3);
  assert.ok(touching.intersects && touching.touching);
  assert.equal(touching.depth, 0);
  assert.equal(collideConvexPolygons(rect, rect, 4.001, 3).intersects, false);
});

test('uses the nearest exit under containment rather than the smaller interval length', () => {
  const container = prepareConvexPolygon(rectangle(-10, -10, 20, 20));
  const inside = prepareConvexPolygon(rectangle(-1, -1, 2, 2));
  const hit = collideConvexPolygons(container, inside, 5, 0);
  assert.equal(hit.depth, 6);
  assert.equal(hit.mtvX, 6);
  assert.equal(hit.normalY, 0);
  assert.ok(collideConvexPolygons(container, inside, 5 + hit.mtvX, hit.mtvY).touching);
  const swapped = collideConvexPolygons(inside, container, -5, 0);
  near(swapped.mtvX, -hit.mtvX);
  near(swapped.depth, hit.depth);
  assert.equal(collideConvexPolygons(container, container).depth, 20);
});

test('an oriented 6 by 2 rectangle has its real minimum box, not its larger AABB', () => {
  const angle = Math.PI / 5;
  const rotate = ({ x, y }) => p(x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle));
  const points = rectangle(-3, -1, 6, 2).map(rotate);
  const box = minimumBoundingBox(prepareConvexPolygon(points));
  near(box.area, 12);
  near(box.width * box.height, 12);
  assert.equal(box.corners.length, 4);
  for (const point of points) assert.ok(box.corners.some(c => Math.hypot(c.x - point.x, c.y - point.y) < 1e-8));
});

test('result reuse fully clears old hits and invalid axes cannot yield stale normals', () => {
  const shape = prepareConvexPolygon(rectangle(0, 0, 2, 2));
  const result = {};
  assert.equal(collideConvexPolygons(shape, shape, 1, 0, result), result);
  assert.equal(result.depth, 1);
  collideConvexPolygons(shape, shape, 50, 0, result);
  assert.deepEqual(result, { intersects: false, touching: false, depth: 0, normalX: 0, normalY: 0, mtvX: 0, mtvY: 0 });
});

function orient(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

// Independent polygon intersection oracle: proper edge crossings, or point containment.
function intersectsByEdges(a, b) {
  const contains = (hull, v) => hull.every((u, i) => orient(u, hull[(i + 1) % hull.length], v) >= 0);
  const crossSegments = (u, v, w, z) => orient(u, v, w) * orient(u, v, z) < 0 && orient(w, z, u) * orient(w, z, v) < 0;
  return contains(a, b[0]) || contains(b, a[0])
    || a.some((u, i) => b.some((v, j) => crossSegments(u, a[(i + 1) % a.length], v, b[(j + 1) % b.length])));
}

test('matches independent geometry and gives separating MTVs for 400 seeded moving pairs', () => {
  let state = 822;
  function random() {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  }
  const cloud = () => Array.from({ length: 13 }, () => p(random() * 16 - 8, random() * 16 - 8));
  let penetrations = 0;
  for (let i = 0; i < 400; i++) {
    const a = prepareConvexPolygon(cloud());
    const b = prepareConvexPolygon(cloud());
    const dx = (random() - .5) * 40;
    const dy = (random() - .5) * 40;
    const worldB = b.vertices.map(v => p(v.x + dx, v.y + dy));
    const hit = collideConvexPolygons(a, b, dx, dy);
    assert.equal(hit.intersects, intersectsByEdges(a.vertices, worldB), `pair ${i}`);
    if (!(hit.depth > 0)) continue;
    penetrations++;
    near(Math.hypot(hit.normalX, hit.normalY), 1);
    near(Math.hypot(hit.mtvX, hit.mtvY), hit.depth);
    const reversed = collideConvexPolygons(b, a, -dx, -dy);
    near(reversed.depth, hit.depth);
    near(reversed.mtvX, -hit.mtvX);
    near(reversed.mtvY, -hit.mtvY);
    const fullyMoved = collideConvexPolygons(a, b, dx + hit.mtvX, dy + hit.mtvY);
    assert.ok(fullyMoved.touching, `pair ${i} did not reach boundary`);
    assert.ok(collideConvexPolygons(a, b, dx + hit.mtvX * .99, dy + hit.mtvY * .99).depth > 0);
  }
  assert.ok(penetrations > 100);
});

test('exports from CommonJS and extends the browser SDK without replacing physics helpers', () => {
  const prior = { physics: { gravity: 9.81 } };
  const window = { document: {}, ArcadeVerse: prior };
  vm.runInNewContext(readFileSync(require.resolve('../assets/js/convex-hull-collision.js'), 'utf8'), { window });
  assert.equal(window.ArcadeVerse, prior);
  assert.equal(window.ArcadeVerse.physics.gravity, 9.81);
  assert.equal(typeof window.ArcadeVerse.physics.collideConvexPolygons, 'function');
  assert.equal(globalThis.ArcadeVerse, undefined);
});
