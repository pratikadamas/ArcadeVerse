const test = require('node:test');
const assert = require('node:assert/strict');
const ChordedKeyboard = require('../assets/js/chorded-keyboard.js');

test('ChordedKeyboard resolves simultaneous multi-key clusters into named chords', () => {
  const keyboard = new ChordedKeyboard({ chordWindowMs: 50 });
  keyboard.registerChord(['KeyJ', 'KeyK'], 'SPECIAL_ATTACK');

  keyboard.handleKeyDown('KeyK', 1000);
  keyboard.handleKeyDown('KeyJ', 1010); // Arrives 10ms later within window

  const resolved = keyboard.resolveCurrentChord();
  assert.equal(resolved.chord, 'SPECIAL_ATTACK');
  assert.equal(resolved.count, 2);
  keyboard.destroy();
});

test('ChordedKeyboard prevents OS key-repeat duplication during chords', () => {
  const keyboard = new ChordedKeyboard({ chordWindowMs: 50 });
  keyboard.handleKeyDown('Space', 1000);
  keyboard.handleKeyDown('Space', 1005); // Duplicate keydown from repeat

  assert.equal(keyboard.pendingChordKeys.length, 1);
  keyboard.destroy();
});
