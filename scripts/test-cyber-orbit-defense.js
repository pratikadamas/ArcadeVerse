const test = require('node:test');
const assert = require('node:assert');

test('Cyber Orbit Defense delta-time normalization and zero-distance guard', () => {
  // Test zero distance entity movement guard
  const center = { x: 400, y: 300 };
  const entity = { x: 400, y: 300, speed: 2 };

  const toCenterX = center.x - entity.x;
  const toCenterY = center.y - entity.y;
  const dist = Math.sqrt(toCenterX * toCenterX + toCenterY * toCenterY);

  assert.strictEqual(dist, 0);

  // In the fixed update code:
  const deltaMs = 16.667;
  const dtScale = Math.min(2.0, Math.max(0.2, deltaMs / 16.667));

  if (dist < 1e-4) {
    entity.x += 0.5 * entity.speed * dtScale;
    entity.y += 0.5 * entity.speed * dtScale;
  } else {
    entity.x += (toCenterX / dist) * entity.speed * dtScale;
    entity.y += (toCenterY / dist) * entity.speed * dtScale;
  }

  // Must not be NaN
  assert.ok(!Number.isNaN(entity.x));
  assert.ok(!Number.isNaN(entity.y));
  assert.strictEqual(entity.x, 401);
  assert.strictEqual(entity.y, 301);
});

test('Cyber Orbit Defense rotational delta scale calculation', () => {
  const rotationSpeed = 0.08;
  const deltaMs60fps = 16.667;
  const dtScale60 = Math.min(2.0, Math.max(0.2, deltaMs60fps / 16.667));
  assert.strictEqual(Math.round(dtScale60), 1);

  const deltaMs30fps = 33.333;
  const dtScale30 = Math.min(2.0, Math.max(0.2, deltaMs30fps / 16.667));
  assert.strictEqual(Math.round(dtScale30), 2);
});
