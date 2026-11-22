const test = require('node:test');
const assert = require('node:assert/strict');
const InputMacroRecorder = require('../assets/js/input-macro-recorder.js');

test('InputMacroRecorder records keypress events with accurate timing offsets', () => {
  const recorder = new InputMacroRecorder({ gameId: 'test-game' });
  recorder.startRecording();
  assert.equal(recorder.isRecording, true);

  recorder.captureEvent({ type: 'keydown', key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 });
  recorder.captureEvent({ type: 'keyup', key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 });

  const seq = recorder.stopRecording();
  assert.equal(recorder.isRecording, false);
  assert.equal(seq.length, 2);
  assert.equal(seq[0].code, 'ArrowRight');
  assert.equal(seq[0].type, 'keydown');
  assert.equal(seq[1].type, 'keyup');
});

test('InputMacroRecorder filters trigger key from recorded sequence to avoid loops', () => {
  const recorder = new InputMacroRecorder({ gameId: 'test-game-trigger' });
  recorder.setTriggerKey('Space');
  recorder.startRecording();

  recorder.captureEvent({ type: 'keydown', key: ' ', code: 'Space', keyCode: 32 });
  recorder.captureEvent({ type: 'keydown', key: 'z', code: 'KeyZ', keyCode: 90 });

  const seq = recorder.stopRecording();
  assert.equal(seq.length, 1);
  assert.equal(seq[0].code, 'KeyZ');
});

test('InputMacroRecorder enforces rate-capping on virtual event dispatch', () => {
  const recorder = new InputMacroRecorder({ maxInputsPerSecond: 10 });
  const dispatched = [];
  const mockTarget = {
    dispatchEvent: (evt) => { dispatched.push(evt); return true; }
  };

  // Immediate succession calls
  const ok1 = recorder.dispatchVirtualKey({ type: 'keydown', key: 'x', code: 'KeyX', keyCode: 88 }, mockTarget);
  const ok2 = recorder.dispatchVirtualKey({ type: 'keydown', key: 'x', code: 'KeyX', keyCode: 88 }, mockTarget);

  assert.equal(ok1, true);
  assert.equal(ok2, false, 'Second event within minInterval must be blocked by rate-limiter');
});
