const test = require('node:test');
const assert = require('node:assert/strict');
const HapticRhythmAdapter = require('../assets/js/haptic-rhythm-adapter.js');

test('HapticRhythmAdapter contains calibrated vibration patterns', () => {
  assert.ok(HapticRhythmAdapter.PATTERNS.soft_tap);
  assert.ok(HapticRhythmAdapter.PATTERNS.heavy_impact);
  assert.ok(HapticRhythmAdapter.PATTERNS.dual_heartbeat);
  assert.ok(HapticRhythmAdapter.PATTERNS.failure_buzz);
});

test('HapticRhythmAdapter honors enabled toggle and plays patterns', () => {
  const adapter = new HapticRhythmAdapter({ enabled: true });
  assert.equal(adapter.enabled, true);

  const played = adapter.playPattern('soft_tap');
  assert.equal(played, true);

  adapter.setEnabled(false);
  assert.equal(adapter.enabled, false);
  assert.equal(adapter.playPattern('soft_tap'), false);
});
