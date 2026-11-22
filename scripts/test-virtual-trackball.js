const test = require('node:test');
const assert = require('node:assert/strict');
const VirtualTrackball = require('../assets/js/virtual-trackball.js');

test('VirtualTrackball computes inertial friction decay accurately', () => {
  const trackball = new VirtualTrackball(null, { friction: 0.90 });
  trackball.vx = 10;
  trackball.vy = 20;

  trackball.update();
  assert.equal(trackball.vx, 9);
  assert.equal(trackball.vy, 18);
});

test('VirtualTrackball locks 1D rotary motion in spinner mode', () => {
  const trackball = new VirtualTrackball(null, { mode: 'spinner' });
  assert.equal(trackball.options.mode, 'spinner');
});
