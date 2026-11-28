const test = require('node:test');
const assert = require('node:assert');
const WFCModule = require('../assets/js/wfc-tilemap-generator.js');

test('WFCModule exports expected classes and tile constants', () => {
  assert.ok(Array.isArray(WFCModule.CIRCUIT_TILESET), 'Should export CIRCUIT_TILESET array');
  assert.ok(Array.isArray(WFCModule.ISLAND_TILESET), 'Should export ISLAND_TILESET array');
  assert.ok(typeof WFCModule.Mulberry32 === 'function', 'Should export PRNG');
  assert.ok(WFCModule.WFCSolver, 'Should export WFCSolver class');
  assert.ok(typeof WFCModule.createStudio === 'function', 'Should export createStudio factory');
});

test('Mulberry32 PRNG produces deterministic sequences from seed', () => {
  const prng1 = WFCModule.Mulberry32(42);
  const prng2 = WFCModule.Mulberry32(42);

  const seq1 = [prng1(), prng1(), prng1()];
  const seq2 = [prng2(), prng2(), prng2()];

  assert.deepStrictEqual(seq1, seq2, 'Same seed must generate identical pseudo-random numbers');
});

test('WFCSolver validates socket adjacency symmetry', () => {
  const solver = new WFCModule.WFCSolver(4, 4, WFCModule.CIRCUIT_TILESET, 100);

  // Cross (sockets: [1, 1, 1, 1]) can connect to Line H (sockets: [0, 1, 0, 1]) on East direction (dir 1)
  // Cross east socket is 1, Line H west socket (oppDir 3) is 1 -> match
  assert.strictEqual(solver.canConnect(1, 2, 1), true);

  // Line V (sockets: [1, 0, 1, 0]) east socket is 0; Cross west socket is 1 -> mismatch
  assert.strictEqual(solver.canConnect(3, 1, 1), false);
});

test('WFCSolver collapses cells and propagates constraints without errors', () => {
  const solver = new WFCModule.WFCSolver(6, 6, WFCModule.CIRCUIT_TILESET, 9999);
  assert.strictEqual(solver.collapsed.filter(c => c !== null).length, 0);

  // Run a few steps
  for (let i = 0; i < 5; i++) {
    solver.step();
  }

  const collapsedCount = solver.collapsed.filter(c => c !== null).length;
  assert.ok(collapsedCount >= 5, 'Should have collapsed at least 5 cells');
});

test('WFCSolver successfully solves small grid to completion', () => {
  const solver = new WFCModule.WFCSolver(4, 4, WFCModule.CIRCUIT_TILESET, 54321);
  const solved = solver.solve(10);

  assert.ok(solved, 'Solver should complete 4x4 grid without unrecoverable contradictions');
  assert.strictEqual(solver.isComplete, true);

  // Verify all cells are collapsed
  for (let i = 0; i < solver.totalCells; i++) {
    assert.ok(solver.collapsed[i] !== null, `Cell ${i} must be collapsed`);
  }
});
