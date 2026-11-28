const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Rigid body sandbox CSS and JS files exist', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'rigid-body-sandbox.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'rigid-body-sandbox.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('.rigid-body-container'), 'Contains container style');
  assert.ok(css.includes('.rigid-body-canvas'), 'Contains canvas style');
});

test('RigidBodySandboxEngine integrates gravity and detects circle collisions', (t) => {
  const { RigidBodySandboxEngine } = require('../assets/js/rigid-body-sandbox.js');
  const engine = new RigidBodySandboxEngine(400, 300, { gravity: 0.5 });

  const c1 = engine.addCircle(100, 100, 15);
  const c2 = engine.addCircle(120, 100, 15);

  // Check collision overlap
  const col = engine.checkCircleCircle(c1, c2);
  assert.ok(col !== null, 'Overlapping circles trigger collision contact');
  assert.strictEqual(col.penetration, 10);

  // Update physics step
  engine.updatePhysics();
  assert.ok(c1.vy > 0, 'Gravity accelerates body downward');
  assert.ok(!isNaN(c1.x) && !isNaN(c1.y), 'Positions are valid numbers');
});
