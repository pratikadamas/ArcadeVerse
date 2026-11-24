const test = require('node:test');
const assert = require('node:assert');
const { VoronoiBiomeSharding } = require('../assets/js/voronoi-biome-sharding.js');

test('VoronoiBiomeSharding generates seeds, relaxes centroids, and builds cells', () => {
  const map = new VoronoiBiomeSharding({ width: 800, height: 600, cellCount: 50 });
  const seeds = map.generateSeeds(50);
  assert.strictEqual(seeds.length, 50);

  // Relax Lloyd passes
  const start = performance.now();
  map.relaxLloyd(2);
  const duration = performance.now() - start;
  assert.ok(duration < 100, `Lloyd relaxation took ${duration}ms, expected under 100ms`);

  // Build polygons
  const cells = map.buildConvexPolygons();
  assert.strictEqual(cells.length, 50);
  assert.ok(cells[0].vertices.length >= 6);

  // Point-in-polygon and territory claim
  const pickedCell = map.selectCell(cells[0].x, cells[0].y);
  assert.ok(pickedCell);
  assert.strictEqual(pickedCell.id, cells[0].id);

  map.claimTerritory(pickedCell.id, 'Player1');
  assert.strictEqual(pickedCell.owner, 'Player1');
  assert.strictEqual(pickedCell.fortification, 2);
});

test('VoronoiBiomeSharding pointInPolygon accurately identifies bounding coordinates', () => {
  const map = new VoronoiBiomeSharding();
  const squarePoly = [
    { x: 10, y: 10 },
    { x: 50, y: 10 },
    { x: 50, y: 50 },
    { x: 10, y: 50 }
  ];

  assert.strictEqual(map.pointInPolygon(30, 30, squarePoly), true);
  assert.strictEqual(map.pointInPolygon(5, 5, squarePoly), false);
  assert.strictEqual(map.pointInPolygon(60, 60, squarePoly), false);
});
