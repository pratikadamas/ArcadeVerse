const test = require('node:test');
const assert = require('node:assert/strict');
const DopplerAudio = require('../assets/js/doppler-audio.js');

test('DopplerAudio calculates frequency pitch rise on approaching objects', () => {
  const doppler = new DopplerAudio();
  const sourcePos = { x: -100, y: 0 };
  const sourceVel = { vx: 80, vy: 0 }; // Moving towards listener
  const listenerPos = { x: 0, y: 0 };

  const shift = doppler.calculateDopplerShift(sourcePos, sourceVel, listenerPos);
  // Frequency must be shifted upwards (> 1.0) as source approaches
  assert.ok(shift.pitchRatio > 1.0);
  assert.equal(shift.distance, 100);
});

test('DopplerAudio calculates frequency pitch drop on receding objects', () => {
  const doppler = new DopplerAudio();
  const sourcePos = { x: 100, y: 0 };
  const sourceVel = { vx: 80, vy: 0 }; // Moving away from listener
  const listenerPos = { x: 0, y: 0 };

  const shift = doppler.calculateDopplerShift(sourcePos, sourceVel, listenerPos);
  // Frequency must be shifted downwards (< 1.0) as source recedes
  assert.ok(shift.pitchRatio < 1.0);
});
