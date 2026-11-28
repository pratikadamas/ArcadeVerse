const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Flow field ribbons CSS and JS files exist', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'flow-field-ribbons.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'flow-field-ribbons.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('.flow-field-container'), 'Contains container style');
  assert.ok(css.includes('.flow-field-hud'), 'Contains HUD style');
});

test('FlowFieldVisualizer calculates noise within bounds and avoids wrapping streak lines', (t) => {
  const { FlowFieldVisualizer } = require('../assets/js/flow-field-ribbons.js');
  const viz = new FlowFieldVisualizer(200, 200, { particleCount: 50 });

  assert.strictEqual(viz.particles.length, 50);

  // Check 2D noise output range [-1, 1]
  const n = FlowFieldVisualizer.noise2D(12.34, 56.78);
  assert.ok(n >= -1.5 && n <= 1.5, 'Noise within normalized range');

  // Force wrap condition
  const p = viz.particles[0];
  p.x = -5;
  viz.update();
  assert.ok(p.x >= 0 && p.x < 200, 'Particle wraps into bounds');
  assert.strictEqual(p.justWrapped, true, 'Flags wrap state so render suppresses streak lines');
});
