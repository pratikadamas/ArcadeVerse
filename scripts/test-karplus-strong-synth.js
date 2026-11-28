const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Karplus-Strong synth CSS and JS files exist', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'karplus-strong-synth.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'karplus-strong-synth.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('.karplus-synth-container'), 'Contains container style');
  assert.ok(css.includes('.karplus-string-wire'), 'Contains string wire style');
});

test('KarplusStrongSynth calculates accurate delay length and scale intervals', (t) => {
  const { KarplusStrongSynth } = require('../assets/js/karplus-strong-synth.js');
  const synth = new KarplusStrongSynth({ scale: 'pentatonic' });

  // A4 = 440 Hz at 44100 Hz sample rate should be ~100 samples
  const samples440 = KarplusStrongSynth.calculateDelaySamples(44100, 440);
  assert.strictEqual(samples440, 100);

  const freqs = synth.getFrequencies();
  assert.strictEqual(freqs.length, 6);
  assert.strictEqual(Math.round(freqs[0]), 262); // C4

  // Headless safe execution
  const res = synth.pluckString(0);
  assert.strictEqual(typeof res, 'boolean');
});
