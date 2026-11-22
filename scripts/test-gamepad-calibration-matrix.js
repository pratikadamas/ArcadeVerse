const test = require('node:test');
const assert = require('node:assert/strict');
const GamepadCalibrationMatrix = require('../assets/js/gamepad-calibration-matrix.js');

test('GamepadCalibrationMatrix eliminates drift within inner deadzone', () => {
  const matrix = new GamepadCalibrationMatrix(null, {
    innerDeadzone: 0.15,
    outerDeadzone: 0.95
  });

  // Stick drift at 0.08 (below 0.15 threshold)
  const filtered = matrix.filterStick(0.06, 0.05);
  assert.equal(filtered.magnitude, 0);
  assert.equal(filtered.x, 0);
  assert.equal(filtered.y, 0);
});

test('GamepadCalibrationMatrix calculates response curves correctly', () => {
  const matrix = new GamepadCalibrationMatrix(null, {
    innerDeadzone: 0.0,
    outerDeadzone: 1.0,
    curveType: 'exponential',
    exponent: 2.0
  });

  // 0.5 magnitude squared = 0.25
  const curved = matrix.applyResponseCurve(0.5, 'exponential');
  assert.ok(Math.abs(curved - 0.25) < 0.001);

  // S-Curve test
  const scurve = matrix.applyResponseCurve(0.5, 'scurve');
  // 0.5 * 0.5 * (3 - 1) = 0.5
  assert.ok(Math.abs(scurve - 0.5) < 0.001);
});
