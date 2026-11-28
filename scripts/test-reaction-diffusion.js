const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Reaction-Diffusion CSS and JS files exist', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'reaction-diffusion.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'reaction-diffusion.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('.reaction-diffusion-container'), 'Contains container style');
  assert.ok(css.includes('.reaction-diffusion-hud'), 'Contains HUD style');
});

test('ReactionDiffusionEngine executes Gray-Scott PDE steps and preserves clamps', (t) => {
  const { ReactionDiffusionEngine } = require('../assets/js/reaction-diffusion.js');
  const engine = new ReactionDiffusionEngine(30, 30);

  assert.strictEqual(engine.setPreset('coral'), true);
  assert.strictEqual(engine.feed, 0.0545);

  // Initial step execution
  engine.step(1.0);
  engine.step(1.0);

  // Verify bounded concentration [0, 1]
  for (let i = 0; i < engine.size; i++) {
    assert.ok(engine.gridA[i] >= 0 && engine.gridA[i] <= 1, 'Chemical A clamped');
    assert.ok(engine.gridB[i] >= 0 && engine.gridB[i] <= 1, 'Chemical B clamped');
  }
});
