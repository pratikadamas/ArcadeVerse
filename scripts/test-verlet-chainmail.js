const test = require('node:test');
const assert = require('node:assert');
const { VerletClothSimulation } = require('../assets/js/verlet-chainmail.js');

test('VerletClothSimulation builds pinned particle grid and solves constraints', () => {
  const cloth = new VerletClothSimulation({ cols: 6, rows: 8, spacing: 15 });
  assert.strictEqual(cloth.particles.length, 48);

  // Top row must be pinned
  for (let c = 0; c < 6; c++) {
    assert.strictEqual(cloth.particles[c].pinned, true);
  }

  // Bottom particle is not pinned
  const bottomIdx = 47;
  assert.strictEqual(cloth.particles[bottomIdx].pinned, false);

  const initialY = cloth.particles[bottomIdx].y;
  cloth.update(4);
  assert.ok(cloth.particles[bottomIdx].y > initialY, 'Gravity should displace bottom nodes downwards');
});

test('VerletClothSimulation applies aerodynamic wind forces', () => {
  const cloth = new VerletClothSimulation({ cols: 4, rows: 4, wind: 0 });
  const bottomIdx = 15;
  const initialX = cloth.particles[bottomIdx].x;

  cloth.applyWind(2.5);
  cloth.update(3);
  assert.ok(cloth.particles[bottomIdx].x > initialX, 'Wind force should push cloth horizontally');
});
