const test = require('node:test');
const assert = require('node:assert');
const EuclideanModule = require('../assets/js/euclidean-rhythm.js');

test('EuclideanModule exports expected interfaces', () => {
  assert.ok(typeof EuclideanModule.generateEuclideanPattern === 'function', 'Should export generateEuclideanPattern');
  assert.ok(EuclideanModule.EuclideanEngine, 'Should export EuclideanEngine class');
  assert.ok(Array.isArray(EuclideanModule.DEFAULT_TRACKS), 'Should export DEFAULT_TRACKS array');
  assert.ok(typeof EuclideanModule.createStudio === 'function', 'Should export createStudio factory');
});

test('generateEuclideanPattern correctly computes canonical Cuban tresillo E(3,8)', () => {
  // E(3,8) is canonical [1, 0, 0, 1, 0, 0, 1, 0]
  const pattern = EuclideanModule.generateEuclideanPattern(8, 3);
  assert.strictEqual(pattern.length, 8);
  const pulseCount = pattern.filter(x => x === 1).length;
  assert.strictEqual(pulseCount, 3);
  assert.deepStrictEqual(pattern, [1, 0, 0, 1, 0, 0, 1, 0]);
});

test('generateEuclideanPattern correctly computes E(5,8) pulse count and distribution', () => {
  const pattern = EuclideanModule.generateEuclideanPattern(8, 5);
  assert.strictEqual(pattern.length, 8);
  const pulseCount = pattern.filter(x => x === 1).length;
  assert.strictEqual(pulseCount, 5);
  // Verify it contains exactly 5 ones and 3 zeros evenly distributed
  const zeroCount = pattern.filter(x => x === 0).length;
  assert.strictEqual(zeroCount, 3);
});

test('generateEuclideanPattern handles rotation shifts', () => {
  const base = EuclideanModule.generateEuclideanPattern(4, 2, 0); // [1, 0, 1, 0]
  const rotated = EuclideanModule.generateEuclideanPattern(4, 2, 1); // shifted by 1: [0, 1, 0, 1]
  assert.deepStrictEqual(base, [1, 0, 1, 0]);
  assert.deepStrictEqual(rotated, [0, 1, 0, 1]);
});

test('generateEuclideanPattern clamps edge cases (pulses = 0, pulses >= steps)', () => {
  const zeros = EuclideanModule.generateEuclideanPattern(6, 0);
  assert.deepStrictEqual(zeros, [0, 0, 0, 0, 0, 0]);

  const allOnes = EuclideanModule.generateEuclideanPattern(4, 4);
  assert.deepStrictEqual(allOnes, [1, 1, 1, 1]);

  const clamped = EuclideanModule.generateEuclideanPattern(4, 10);
  assert.deepStrictEqual(clamped, [1, 1, 1, 1]);
});

test('EuclideanEngine manages track state and BPM bounds', () => {
  const engine = new EuclideanModule.EuclideanEngine({ bpm: 130 });
  assert.strictEqual(engine.bpm, 130);

  engine.setBpm(400); // clamped to 300
  assert.strictEqual(engine.bpm, 300);

  engine.setBpm(10); // clamped to 30
  assert.strictEqual(engine.bpm, 30);

  const t0Pattern = engine.getTrackPattern(0);
  assert.ok(Array.isArray(t0Pattern));
  assert.strictEqual(t0Pattern.length, engine.tracks[0].steps);
});
