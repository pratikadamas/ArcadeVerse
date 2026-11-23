const test = require('node:test');
const assert = require('node:assert');
const { ParticleTextDissolve } = require('../assets/js/particle-text-dissolve.js');

test('ParticleTextDissolve spawns object-pooled particles across transition modes', () => {
  const vfx = new ParticleTextDissolve({ maxParticles: 500 });
  const particles = vfx.dissolveText('GAME OVER', 100, 100, { mode: 'gravity' });

  assert.ok(particles.length > 0);
  assert.strictEqual(vfx.active, true);
  assert.strictEqual(vfx.mode, 'gravity');

  // Update simulation
  const initialY = particles[0].y;
  vfx.update();
  assert.notStrictEqual(particles[0].y, initialY);
});

test('ParticleTextDissolve supports reversible assembly animation', () => {
  const vfx = new ParticleTextDissolve();
  const particles = vfx.dissolveText('VICTORY', 200, 200, { mode: 'assemble' });

  assert.strictEqual(vfx.mode, 'assemble');
  assert.ok(particles.length > 0);

  // Updates move particles towards origin
  const distBefore = Math.hypot(particles[0].originX - particles[0].x, particles[0].originY - particles[0].y);
  vfx.update();
  const distAfter = Math.hypot(particles[0].originX - particles[0].x, particles[0].originY - particles[0].y);
  assert.ok(distAfter < distBefore);
});
