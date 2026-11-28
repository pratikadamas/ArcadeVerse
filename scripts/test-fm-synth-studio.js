const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('FM Synth studio stylesheet and script exist', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'fm-synth-studio.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'fm-synth-studio.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('.fm-synth-container'), 'Contains container style');
  assert.ok(css.includes('.fm-key'), 'Contains keyboard key style');
});

test('FMSynthStudio handles preset parameters and key mapping accurately', (t) => {
  const { FMSynthStudio } = require('../assets/js/fm-synth-studio.js');
  const synth = new FMSynthStudio();

  assert.strictEqual(synth.preset, 'slapBass');
  assert.ok(synth.params.modulationIndex > 0);

  assert.strictEqual(synth.setPreset('metallicBell'), true);
  assert.strictEqual(synth.params.harmonicRatio, 3.5);

  assert.strictEqual(synth.setPreset('invalid_preset'), false);

  assert.strictEqual(FMSynthStudio.KEY_MAP['a'], 261.63);
  assert.strictEqual(FMSynthStudio.KEY_MAP['h'], 440.00);
});
