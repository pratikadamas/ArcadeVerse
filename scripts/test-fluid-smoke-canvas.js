const test = require('node:test');
const assert = require('node:assert');
const FluidModule = require('../assets/js/fluid-smoke-canvas.js');

test('FluidModule exports expected classes and factories', () => {
  assert.ok(FluidModule.FluidSolver2D, 'Should export FluidSolver2D');
  assert.ok(typeof FluidModule.createStudio === 'function', 'Should export createStudio');
});

test('FluidSolver2D initializes grids without NaNs', () => {
  const solver = new FluidModule.FluidSolver2D(32);
  assert.strictEqual(solver.N, 32);
  assert.strictEqual(solver.numCells, 34 * 34);

  // Check initial conditions are finite
  for (let i = 0; i < solver.numCells; i++) {
    assert.strictEqual(solver.u[i], 0);
    assert.strictEqual(solver.v[i], 0);
    assert.strictEqual(solver.densityR[i], 0);
  }
});

test('FluidSolver2D correctly injects density and velocity without bounds errors', () => {
  const solver = new FluidModule.FluidSolver2D(32);
  solver.addDensity(16, 16, 1.0, 0.5, 0.2, 2);
  solver.addVelocity(16, 16, 10.0, -5.0, 2);

  const idx = solver.IX(16, 16);
  assert.ok(solver.densityR[idx] > 0, 'Injected red density should be greater than 0');
  assert.ok(solver.densityG[idx] > 0, 'Injected green density should be greater than 0');
  assert.ok(solver.u[idx] > 0, 'Injected u velocity should be greater than 0');
  assert.ok(solver.v[idx] < 0, 'Injected v velocity should be negative');
});

test('FluidSolver2D executes simulation steps while preserving numerical stability', () => {
  const solver = new FluidModule.FluidSolver2D(24, { iterations: 10 });
  solver.addDensity(12, 12, 2.0, 1.0, 0.5, 3);
  solver.addVelocity(12, 12, 5.0, 5.0, 3);

  // Step 15 times
  for (let k = 0; k < 15; k++) {
    solver.step();
  }

  // Ensure no values blew up into NaN or Infinity
  for (let i = 0; i < solver.numCells; i++) {
    assert.ok(Number.isFinite(solver.u[i]), 'u velocity must remain finite');
    assert.ok(Number.isFinite(solver.v[i]), 'v velocity must remain finite');
    assert.ok(Number.isFinite(solver.densityR[i]), 'densityR must remain finite');
  }
});

test('FluidSolver2D enforces reflective boundary conditions', () => {
  const solver = new FluidModule.FluidSolver2D(16);
  solver.u[solver.IX(1, 8)] = 5.0;
  solver.setBnd(1, solver.u);

  // Normal boundary for horizontal velocity should negate at left border
  assert.strictEqual(solver.u[solver.IX(0, 8)], -5.0);
});

test('FluidSolver2D clear resets all state arrays cleanly', () => {
  const solver = new FluidModule.FluidSolver2D(16);
  solver.addDensity(8, 8, 1.0, 1.0, 1.0, 2);
  solver.clear();

  const idx = solver.IX(8, 8);
  assert.strictEqual(solver.densityR[idx], 0);
  assert.strictEqual(solver.densityG[idx], 0);
  assert.strictEqual(solver.u[idx], 0);
});
