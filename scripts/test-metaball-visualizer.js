const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Metaball visualizer CSS and JS files exist', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'metaball-visualizer.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'metaball-visualizer.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('.metaball-visualizer-container'), 'Contains container styling');
  assert.ok(css.includes('.metaball-canvas'), 'Contains canvas styling');
});

test('MetaballVisualizer evaluates scalar field and boundary reflections', (t) => {
  const { MetaballVisualizer } = require('../assets/js/metaball-visualizer.js');
  const viz = new MetaballVisualizer(100, 100, { numBalls: 4 });

  assert.strictEqual(viz.balls.length, 4);

  // Directly check scalar field near ball center
  const b0 = viz.balls[0];
  const fieldNear = viz.calculateScalarField(b0.x + 1, b0.y + 1);
  const fieldFar = viz.calculateScalarField(b0.x + 80, b0.y + 80);

  assert.ok(fieldNear > fieldFar, 'Field intensity is strictly higher near ball center');

  // Test physics step
  b0.x = -10; // Force out of bounds
  viz.updatePhysics();
  assert.ok(b0.x >= b0.radius, 'Reflects ball back into bounds');
});
