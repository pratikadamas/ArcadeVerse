const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('N-Body gravity CSS and JS files exist', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'nbody-gravity.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'nbody-gravity.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('.nbody-gravity-container'), 'Contains container style');
  assert.ok(css.includes('.nbody-hud'), 'Contains HUD style');
});

test('NBodyGravityEngine preserves gravitational force symmetry and advances orbits', (t) => {
  const { NBodyGravityEngine } = require('../assets/js/nbody-gravity.js');
  const engine = new NBodyGravityEngine(400, 400);

  assert.strictEqual(engine.bodies.length, 2, 'Starts with binary star preset');

  const b1 = engine.bodies[0];
  const b2 = engine.bodies[1];

  // Symmetric initial masses
  assert.strictEqual(b1.mass, b2.mass);

  // Compute accelerations
  const acc = engine.computeAccelerations();
  assert.strictEqual(Math.round(acc[0].ax + acc[1].ax), 0, 'Action-reaction force balance');

  // Step physics
  engine.updatePhysics(1.0);
  assert.ok(!isNaN(b1.x) && !isNaN(b1.y));
  assert.ok(!isNaN(b2.x) && !isNaN(b2.y));
});
