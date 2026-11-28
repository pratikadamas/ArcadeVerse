const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Fractal explorer CSS and JS files exist', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'fractal-explorer.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'fractal-explorer.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('.fractal-explorer-container'), 'Contains container style');
  assert.ok(css.includes('.fractal-hud'), 'Contains HUD style');
});

test('FractalExplorerEngine evaluates Mandelbrot interior and exterior points', (t) => {
  const { FractalExplorerEngine } = require('../assets/js/fractal-explorer.js');
  const engine = new FractalExplorerEngine(100, 100);

  // (0, 0) is guaranteed inside the Mandelbrot set
  const interior = engine.evaluatePoint(0.0, 0.0);
  assert.strictEqual(interior, -1, 'Interior point does not escape');

  // (2, 2) is guaranteed outside the Mandelbrot set
  const exterior = engine.evaluatePoint(2.0, 2.0);
  assert.ok(exterior > 0, 'Exterior point escapes rapidly');

  // Zooming updates center coordinate
  engine.zoomAt(50, 50, 2.0);
  assert.strictEqual(engine.zoom, 2.0);
});
