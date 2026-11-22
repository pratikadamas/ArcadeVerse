const test = require('node:test');
const assert = require('node:assert/strict');
const AnamorphicRoom = require('../assets/js/anamorphic-room.js');

test('AnamorphicRoom calculates 3D tilt coordinates based on normalized pointer', () => {
  const room = new AnamorphicRoom(null, { maxRotateX: 20, maxRotateY: 20 });
  const tilt = room.calculateTilt(0.5, -0.5);

  assert.equal(tilt.rotateX, 10);
  assert.equal(tilt.rotateY, 10);
});

test('AnamorphicRoom respects reduced motion preferences by freezing rotation', () => {
  const room = new AnamorphicRoom(null);
  room.reducedMotion = true;

  const tilt = room.calculateTilt(1.0, 1.0);
  assert.equal(tilt.rotateX, 0);
  assert.equal(tilt.rotateY, 0);
});
