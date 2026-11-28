const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Drum sequencer CSS and JS files exist', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'drum-sequencer.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'drum-sequencer.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('.drum-sequencer-container'), 'Contains container style');
  assert.ok(css.includes('.drum-step-pad'), 'Contains step pad style');
});

test('DrumSequencerEngine loads presets and advances 16-step cycles', (t) => {
  const { DrumSequencerEngine } = require('../assets/js/drum-sequencer.js');
  const seq = new DrumSequencerEngine({ bpm: 128 });

  assert.strictEqual(seq.bpm, 128);
  assert.strictEqual(seq.pattern.kick.length, 16);
  assert.strictEqual(seq.pattern.kick[0], 1, 'Electro preset starts with kick on beat 1');

  // Advance clock
  const s0 = seq.step();
  assert.strictEqual(s0, 0);
  const s1 = seq.step();
  assert.strictEqual(s1, 1);

  // Toggle step
  seq.toggleStep('snare', 0);
  assert.strictEqual(seq.pattern.snare[0], 1);
  seq.toggleStep('snare', 0);
  assert.strictEqual(seq.pattern.snare[0], 0);
});
