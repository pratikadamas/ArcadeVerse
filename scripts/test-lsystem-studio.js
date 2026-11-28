const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('L-System studio CSS and JS files exist', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'lsystem-studio.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'lsystem-studio.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('.lsystem-container'), 'Contains container style');
  assert.ok(css.includes('.lsystem-hud'), 'Contains HUD style');
});

test('LSystemEngine expands grammar, respects caps, and interprets stack correctly', (t) => {
  const { LSystemEngine } = require('../assets/js/lsystem-studio.js');
  const engine = new LSystemEngine({ preset: 'kochSnowflake' });

  // 1 iteration on Koch snowflake
  const exp = engine.expandAxiom('F', { 'F': 'F+F' }, 2);
  assert.strictEqual(exp, 'F+F+F+F');

  // Verify stack-based push / pop interpretation
  const lines = engine.interpret('F[+F]-F', 100, 100);
  assert.strictEqual(lines.length, 3, 'Interprets 3 forward lines');

  // Check safety cap
  const bigRules = { 'A': 'AAAAAAAAAAAAAAAAAAAA' };
  const capped = engine.expandAxiom('A', bigRules, 10);
  assert.ok(capped.length <= LSystemEngine.MAX_STRING_LENGTH, 'Safety length limit enforced');
});
