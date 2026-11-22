const test = require('node:test');
const assert = require('node:assert');
const { VoiceCommandController } = require('../assets/js/voice-command-controller.js');

test('VoiceCommandController registers and fuzzy matches speech inputs', () => {
  const events = [];
  const mockTarget = {
    dispatchEvent: (evt) => events.push(evt)
  };

  const controller = new VoiceCommandController({ target: mockTarget });
  controller.registerCommand('jump', { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 });
  controller.registerCommand('shoot', { key: 'Space', code: 'Space', keyCode: 32 });

  // Exact match
  const match1 = controller.processTranscript('jump', 0.95);
  assert.strictEqual(match1.phrase, 'jump');
  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].key, 'ArrowUp');

  // Fuzzy match (Levenshtein distance 1: "shoo" -> "shoot")
  const match2 = controller.processTranscript('shoo', 0.88);
  assert.strictEqual(match2.phrase, 'shoot');
  assert.strictEqual(events.length, 2);
  assert.strictEqual(events[1].key, 'Space');
});
