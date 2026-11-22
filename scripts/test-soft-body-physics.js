const test = require('node:test');
const assert = require('node:assert/strict');
const SoftBodyPhysics = require('../assets/js/soft-body-physics.js');

test('SoftBody initializes mass-spring lattice points and interior springs', () => {
  const body = new SoftBodyPhysics.SoftBody(100, 100, 40, 8);
  assert.equal(body.points.length, 8);
  assert.ok(body.springs.length > 8);
  assert.ok(body.initialArea > 0);
});

test('SoftBody conserves area and solves spring deformation without numerical collapse', () => {
  const body = new SoftBodyPhysics.SoftBody(200, 200, 50, 10);
  const origArea = body.initialArea;

  // Step physics simulation across 60 frames
  for (let f = 0; f < 60; f++) {
    body.update({ x: 0, y: 0, width: 800, height: 600 });
  }

  const newArea = body.calculateArea();
  // Ensure the body has not collapsed or exploded numerically
  assert.ok(newArea > origArea * 0.4 && newArea < origArea * 2.0);
  assert.ok(Number.isFinite(body.centerPoint.x));
  assert.ok(Number.isFinite(body.centerPoint.y));
});
