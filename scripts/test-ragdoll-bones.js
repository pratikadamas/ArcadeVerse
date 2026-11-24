const test = require('node:test');
const assert = require('node:assert');
const { RagdollBonesEngine } = require('../assets/js/ragdoll-bones.js');

test('RagdollBonesEngine constructs skeletal hierarchy and updates Verlet integration', () => {
  const engine = new RagdollBonesEngine({ gravity: 0.5, bounds: { left: 0, top: 0, right: 800, bottom: 600 } });
  const ragdoll = engine.createRagdoll(400, 200, 1.0);

  assert.strictEqual(engine.points.length, 11);
  assert.strictEqual(engine.bones.length, 10);

  // Initial update ticks
  const initialHeadY = engine.points[ragdoll.head].y;
  engine.updateVerlet();
  assert.ok(engine.points[ragdoll.head].y > initialHeadY, 'Gravity should accelerate ragdoll downwards');
});

test('RagdollBonesEngine triggers dismemberment above threshold impulse', () => {
  const engine = new RagdollBonesEngine({ breakThreshold: 20 });
  const ragdoll = engine.createRagdoll(400, 200, 1.0);

  // Apply massive impulse to hand
  engine.applyImpulse(ragdoll.leftHand, 50, 0);

  const forearmBone = engine.bones.find(b => b.name === 'leftForearm');
  assert.ok(forearmBone);
  assert.strictEqual(forearmBone.broken, true);
  assert.ok(engine.severedLimbs.length > 0);
});
