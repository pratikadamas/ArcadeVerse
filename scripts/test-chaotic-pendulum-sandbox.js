const test = require('node:test');
const assert = require('node:assert');
const { ChaoticPendulumSandbox } = require('../assets/js/chaotic-pendulum-sandbox.js');

test('ChaoticPendulumSandbox updates state via RK4 numerical integration', () => {
  const sim = new ChaoticPendulumSandbox({ l1: 100, l2: 100, theta1: Math.PI / 2, theta2: Math.PI / 2 });
  const initialTheta1 = sim.theta1;

  sim.stepRK4(0.05);

  assert.notStrictEqual(sim.theta1, initialTheta1);
  assert.ok(sim.trail.length > 0);
});

test('ChaoticPendulumSandbox calculates accurate analytical bob positions', () => {
  const sim = new ChaoticPendulumSandbox({ l1: 100, l2: 100, theta1: 0, theta2: 0 });
  const p1 = sim.getBob1Position(0, 0);
  const p2 = sim.getTipPosition(0, 0);

  // Directly hanging down
  assert.strictEqual(Math.round(p1.x), 0);
  assert.strictEqual(Math.round(p1.y), 100);
  assert.strictEqual(Math.round(p2.x), 0);
  assert.strictEqual(Math.round(p2.y), 200);
});
