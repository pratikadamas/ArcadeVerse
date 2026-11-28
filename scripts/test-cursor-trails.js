const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const { CursorTrailEngine, TRAIL_STYLES } = require('../assets/js/cursor-trails.js');

test('CursorTrailEngine exports all required trail styles', () => {
  assert.ok(TRAIL_STYLES);
  assert.ok(TRAIL_STYLES['pixel-sparkles'], 'pixel-sparkles style missing');
  assert.ok(TRAIL_STYLES['neon-comet'], 'neon-comet style missing');
  assert.ok(TRAIL_STYLES['rainbow-star'], 'rainbow-star style missing');
  assert.ok(TRAIL_STYLES['electric-arc'], 'electric-arc style missing');
  
  const engine = new CursorTrailEngine();
  const styles = engine.getAvailableStyles();
  assert.strictEqual(styles.length, 4);
});

test('CursorTrailEngine maintains a strictly pre-allocated object pool of 60 particles', () => {
  const engine = new CursorTrailEngine();
  assert.strictEqual(engine.poolSize, 60);
  assert.strictEqual(engine.particles.length, 60);
  assert.strictEqual(engine.activeCount, 0);

  // Allocate all particles
  const allocated = [];
  for (let i = 0; i < 60; i++) {
    const p = engine.allocateParticle();
    assert.ok(p, `Failed to allocate particle ${i}`);
    assert.strictEqual(p.active, true);
    allocated.push(p);
  }
  assert.strictEqual(engine.activeCount, 60);

  // 61st allocation should return null (zero dynamic garbage collection)
  const overflow = engine.allocateParticle();
  assert.strictEqual(overflow, null, 'Particle pool exceeded capacity without returning null');

  // Clearing should deactivate all particles
  engine.clearParticles();
  assert.strictEqual(engine.activeCount, 0);
  assert.strictEqual(engine.particles.every(p => !p.active), true);
});

test('Physics damping and emission scaling based on pointer velocity', () => {
  const engine = new CursorTrailEngine();
  engine.settings.enabled = true;

  // Fast flick emission (speed = 40)
  engine.emit(100, 100, 25, 25, 40);
  assert.ok(engine.activeCount >= 3, `Expected at least 3 particles on fast movement, got ${engine.activeCount}`);

  // Test physics update step
  const activeParticlesBefore = engine.particles.filter(p => p.active);
  const initialX = activeParticlesBefore[0].x;
  const initialVx = activeParticlesBefore[0].vx;

  engine.update();

  assert.ok(activeParticlesBefore[0].life > 0, 'Particle life did not increment');
  if (Math.abs(initialVx) > 0.001) {
    assert.notStrictEqual(activeParticlesBefore[0].x, initialX, 'Particle position did not update');
  }
});

test('Stationary cursor emits gentle ambient twinkling', () => {
  const engine = new CursorTrailEngine();
  engine.settings.enabled = true;
  engine.clearParticles();

  // Pointer rests stationary
  engine.hasPointerMoved = true;
  engine.pointerX = 200;
  engine.pointerY = 200;
  engine.velocity = 0;

  // Simulate multiple stationary update ticks
  for (let i = 0; i < 15; i++) {
    engine.update();
  }

  assert.ok(engine.activeCount >= 1, 'Stationary cursor did not emit ambient twinkling particle');
});

test('Settings toggles and style updates persist and function correctly', () => {
  const engine = new CursorTrailEngine();

  engine.setStyle('neon-comet');
  assert.strictEqual(engine.settings.style, 'neon-comet');

  engine.setStyle('electric-arc');
  assert.strictEqual(engine.settings.style, 'electric-arc');

  engine.setEnabled(false);
  assert.strictEqual(engine.settings.enabled, false);
  assert.strictEqual(engine.isRunning, false);
  assert.strictEqual(engine.activeCount, 0);

  // When disabled, emit should not allocate particles
  engine.emit(50, 50, 10, 10, 20);
  assert.strictEqual(engine.activeCount, 0);
});

test('Lifecycle and accessibility guardrails: halts on prefers-reduced-motion and modal gameplay', () => {
  const engine = new CursorTrailEngine();
  engine.settings.enabled = true;

  // Test prefers-reduced-motion
  engine.prefersReducedMotion = true;
  engine.start();
  assert.strictEqual(engine.isRunning, false, 'Engine started despite prefers-reduced-motion');

  engine.emit(50, 50, 10, 10, 20);
  assert.strictEqual(engine.activeCount, 0, 'Particles emitted despite prefers-reduced-motion');
  engine.prefersReducedMotion = false;

  // Test touch device guardrail
  engine.isTouchDevice = true;
  engine.start();
  assert.strictEqual(engine.isRunning, false, 'Engine started on touch-only device');
  engine.isTouchDevice = false;

  // Test modal active teardown
  engine.isModalActive = true;
  engine.start();
  assert.strictEqual(engine.isRunning, false, 'Engine started while modal is active');
});

test('Zero Unicode emojis in cursor-trails.js and test-cursor-trails.js', () => {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;

  const scriptContent = fs.readFileSync(path.resolve(__dirname, '../assets/js/cursor-trails.js'), 'utf8');
  assert.strictEqual(emojiRegex.test(scriptContent), false, 'Found forbidden Unicode emoji in cursor-trails.js');

  const testContent = fs.readFileSync(path.resolve(__dirname, 'test-cursor-trails.js'), 'utf8');
  assert.strictEqual(emojiRegex.test(testContent), false, 'Found forbidden Unicode emoji in test-cursor-trails.js');
});
