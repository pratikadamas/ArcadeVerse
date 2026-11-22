const test = require('node:test');
const assert = require('node:assert/strict');
const BulletPatternSpline = require('../assets/js/bullet-pattern-spline.js');

test('BulletPatternSpline spawns rose and spiral barrages from object pool', () => {
  const spawner = new BulletPatternSpline({ poolSize: 200 });
  assert.equal(spawner.pool.length, 200);
  assert.equal(spawner.activeCount, 0);

  spawner.spawnRoseBarrage(100, 100, 4, 30);
  assert.equal(spawner.activeCount, 30);

  spawner.spawnSpiralBarrage(100, 100, 4, 10);
  assert.equal(spawner.activeCount, 70);
});

test('BulletPatternSpline reaps off-screen bullets automatically', () => {
  const spawner = new BulletPatternSpline({
    poolSize: 50,
    bounds: { x: 0, y: 0, width: 200, height: 200 }
  });

  const b = spawner.acquireBullet();
  b.x = 100;
  b.y = 100;
  b.vx = 200; // Flings bullet off screen in 1 step

  assert.equal(spawner.activeCount, 1);
  spawner.update(1.0);
  assert.equal(spawner.activeCount, 0);
  assert.equal(b.active, false);
});
