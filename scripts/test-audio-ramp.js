const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Audio ramp styles and script exist', (t) => {
  const cssPath = path.join(__dirname, '..', 'assets', 'css', 'audio-ramp-ui.css');
  const jsPath = path.join(__dirname, '..', 'assets', 'js', 'audio-ramp.js');

  assert.ok(fs.existsSync(cssPath), 'CSS file should exist');
  assert.ok(fs.existsSync(jsPath), 'JS file should exist');

  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('.audio-ramp-controls'), 'Contains controls');
  assert.ok(css.includes('.audio-ramp-meter'), 'Contains meter');
});

test('AudioRampManager executes smooth ramp schedules', (t) => {
  const { AudioRampManager } = require('../assets/js/audio-ramp.js');

  const mockGain = {
    gain: {
      value: 0,
      cancelScheduledValues: () => {},
      setValueAtTime: function(v) { this.value = v; },
      exponentialRampToValueAtTime: function(v) { this.value = v; }
    }
  };

  const mockCtx = {
    currentTime: 1.0,
    destination: {}
  };

  const mgr = new AudioRampManager(mockCtx);

  const inRes = mgr.fadeIn(mockGain, 0.8, 0.2);
  assert.strictEqual(inRes, true);
  assert.strictEqual(mockGain.gain.value, 0.8);

  const outRes = mgr.fadeOut(mockGain, 0.2);
  assert.strictEqual(outRes, true);
});
