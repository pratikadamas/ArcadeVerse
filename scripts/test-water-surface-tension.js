const test = require('node:test');
const assert = require('node:assert');
const { WaterSurfacePhysics } = require('../assets/js/water-surface-tension.js');

test('WaterSurfacePhysics creates spring-mass nodes and propagates splash wave', () => {
  const water = new WaterSurfacePhysics({ width: 800, height: 400, baseHeight: 250, columnsCount: 40 });
  assert.strictEqual(water.nodes.length, 40);

  // Splash in the middle (x = 400)
  water.splash(400, 30);
  assert.notStrictEqual(water.nodes[20].velocity, 0);

  // Simulate update steps
  water.update(4);

  // Surface should have displaced from baseHeight
  const centerElev = water.getSurfaceElevation(400);
  assert.notStrictEqual(centerElev, 250);

  // Lateral node should have received transferred wave motion
  const neighborElev = water.getSurfaceElevation(380);
  assert.ok(Math.abs(neighborElev - 250) > 0.01);
});
