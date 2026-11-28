const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Cloth physics stylesheets and script exist', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'cloth-physics.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'cloth-physics.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('.cloth-physics-container'), 'Contains container style');
  assert.ok(css.includes('.cloth-tools-panel'), 'Contains tools panel style');
});

test('ClothPhysicsEngine integrates Verlet steps and handles constraint cuts', (t) => {
  const { ClothPhysicsEngine } = require('../assets/js/cloth-physics.js');
  const engine = new ClothPhysicsEngine(6, 6, 15, { gravity: 0.5, tearDistance: 35 });

  assert.strictEqual(engine.points.length, 36);
  assert.ok(engine.constraints.length > 0);

  const initialConstraints = engine.constraints.length;

  // Run a few steps of Verlet physics
  engine.updatePhysics();
  engine.updatePhysics();

  // Bottom unpinned point should move down due to gravity
  const bottomPoint = engine.points[35];
  assert.ok(bottomPoint.y > 30 + 5 * 15, 'Point falls downward with gravity');

  // Cut constraints at center
  const pMid = engine.points[15];
  const cuts = engine.cutConstraintAt(pMid.x, pMid.y, 25);
  assert.ok(cuts > 0, 'Constraints severed by cutting tool');
  assert.strictEqual(engine.constraints.length, initialConstraints - cuts);
});
