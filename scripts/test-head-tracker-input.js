const test = require('node:test');
const assert = require('node:assert/strict');
const HeadTrackerInput = require('../assets/js/head-tracker-input.js');

test('HeadTrackerInput calculates optical centroid displacement', () => {
  const tracker = new HeadTrackerInput();
  const w = 160;
  const h = 120;
  const prevFrame = new Uint8ClampedArray(w * h * 4).fill(50);
  const curFrame = new Uint8ClampedArray(w * h * 4).fill(50);

  // Shift right-hand pixels to trigger rightwards motion
  for (let y = 40; y < 80; y++) {
    for (let x = 100; x < 140; x++) {
      const idx = (y * w + x) * 4;
      curFrame[idx] = 200;
    }
  }

  const motion = tracker.computeOpticalCentroid(curFrame, prevFrame, w, h);
  assert.ok(motion.motionEnergy > 0);
  assert.ok(motion.dx > 0); // Positive horizontal shift (rightwards)
});

test('HeadTrackerInput calculates dwell click timer progression', () => {
  const tracker = new HeadTrackerInput({ dwellTimeMs: 800, dwellRadiusPx: 20 });
  tracker.cursorX = 100;
  tracker.cursorY = 100;
  tracker.dwellAnchorX = 100;
  tracker.dwellAnchorY = 100;
  tracker.dwellStartTime = 1000;

  const resHalf = tracker.updateDwellState(1400); // 400ms elapsed -> 50%
  assert.equal(resHalf.dwelling, true);
  assert.ok(Math.abs(resHalf.progress - 0.5) < 0.05);

  const resFull = tracker.updateDwellState(1800); // 800ms elapsed -> 100% trigger
  assert.equal(resFull.triggered, true);
});
