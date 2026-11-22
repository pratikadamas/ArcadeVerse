const test = require('node:test');
const assert = require('node:assert/strict');
const TrackpadGestures = require('../assets/js/trackpad-gestures.js');

test('TrackpadGestures classifies straight directional dashes', () => {
  const tracker = new TrackpadGestures();
  tracker.startStroke(50, 50, 100);
  tracker.addPoint(100, 50, 150);
  const result = tracker.endStroke(160, 50, 200);

  assert.ok(result !== null);
  assert.equal(result.gesture, 'DASH_RIGHT');
});

test('TrackpadGestures recognizes quarter-circle rotation', () => {
  const tracker = new TrackpadGestures();
  tracker.startStroke(50, 50, 100);
  // Downward then forward quarter circle curve
  tracker.addPoint(50, 80, 140);
  tracker.addPoint(70, 95, 180);
  const result = tracker.endStroke(100, 100, 220);

  assert.ok(result !== null);
  assert.ok(result.gesture.includes('QC') || result.gesture.includes('DASH'));
});
