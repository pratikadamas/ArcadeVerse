const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Chiptune arpeggiator CSS and JS files exist', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'chiptune-arpeggiator.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'chiptune-arpeggiator.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('.chiptune-arpeggiator-card'), 'Contains card styling');
  assert.ok(css.includes('.chiptune-oscilloscope'), 'Contains oscilloscope styling');
});

test('ChiptuneArpeggiator calculates accurate note frequencies and chord formulas', (t) => {
  const { ChiptuneArpeggiator } = require('../assets/js/chiptune-arpeggiator.js');

  // A4 should be exactly 440 Hz
  const a4 = ChiptuneArpeggiator.noteToFrequency('A', 4);
  assert.strictEqual(Math.round(a4), 440);

  // A5 should be 880 Hz
  const a5 = ChiptuneArpeggiator.noteToFrequency('A', 5);
  assert.strictEqual(Math.round(a5), 880);

  // C4 should be ~261.63 Hz
  const c4 = ChiptuneArpeggiator.noteToFrequency('C', 4);
  assert.strictEqual(Math.round(c4), 262);

  const arp = new ChiptuneArpeggiator({ rootNote: 'C', chordType: 'major', rootOctave: 4 });
  const chord = arp.getChordFrequencies();
  assert.strictEqual(chord.length, 4); // Root, Third, Fifth, Octave
  assert.ok(chord[0] < chord[1] && chord[1] < chord[2] && chord[2] < chord[3]);
});
