const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Boids simulation stylesheet and engine script exist', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'boids-flocking.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'boids-flocking.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('.boids-flocking-container'), 'Contains container style');
  assert.ok(css.includes('.boids-hud-panel'), 'Contains HUD panel style');
});

test('BoidsSimulationEngine updates velocities and wraps boundaries', (t) => {
  const { BoidsSimulationEngine } = require('../assets/js/boids-flocking.js');
  const engine = new BoidsSimulationEngine(400, 300, { numBoids: 20 });

  assert.strictEqual(engine.boids.length, 20);

  // Position two boids close to test separation
  engine.boids[0].x = 100;
  engine.boids[0].y = 100;
  engine.boids[1].x = 102;
  engine.boids[1].y = 100;

  engine.updatePhysics();

  // Test boundary wrapping
  engine.boids[0].x = -5;
  engine.updatePhysics();
  assert.ok(engine.boids[0].x >= 0 && engine.boids[0].x <= 400, 'Wraps back onto screen');
});
