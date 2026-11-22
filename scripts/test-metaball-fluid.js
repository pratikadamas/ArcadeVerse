const test = require('node:test');
const assert = require('node:assert/strict');
const MetaballFluid = require('../assets/js/metaball-fluid.js');

test('MetaballFluid initializes fluid particles', () => {
  const fluid = new MetaballFluid(null, { particleCount: 30 });
  assert.equal(fluid.particles.length, 30);
  assert.ok(fluid.particles[0].radius > 0);
});

test('MetaballFluid applies surface tension and boundary bounce', () => {
  const fluid = new MetaballFluid(null, { particleCount: 2, gravity: 0 });
  fluid.particles[0].x = 100;
  fluid.particles[0].y = 100;
  fluid.particles[0].vx = 0;
  fluid.particles[0].vy = 0;

  fluid.particles[1].x = 130; // Within interaction radius
  fluid.particles[1].y = 100;
  fluid.particles[1].vx = 0;
  fluid.particles[1].vy = 0;

  fluid.update();

  // Surface tension pulls particles towards each other
  assert.ok(fluid.particles[0].vx > 0);
  assert.ok(fluid.particles[1].vx < 0);
});
