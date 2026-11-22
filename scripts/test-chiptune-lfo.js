const test = require('node:test');
const assert = require('node:assert');
const { ChiptuneLFOSynthesizer } = require('../assets/js/chiptune-lfo.js');

test('ChiptuneLFOSynthesizer initializes and configures LFO voice presets', () => {
  const synth = new ChiptuneLFOSynthesizer();
  
  const voice = synth.createVoice({
    frequency: 440,
    type: 'square',
    lfoRate: 8,
    lfoDepth: 20,
    lfoType: 'sine',
    target: 'pitch'
  });

  assert.ok(voice);
  assert.strictEqual(voice.frequency, 440);
  assert.strictEqual(voice.lfoRate, 8);
  assert.strictEqual(voice.target, 'pitch');

  const laser = synth.playArcadeLaser();
  assert.strictEqual(laser.target, 'pitch');
  assert.strictEqual(laser.lfoRate, 35);

  const tremolo = synth.playAlarmTremolo();
  assert.strictEqual(tremolo.target, 'amplitude');
  assert.strictEqual(tremolo.lfoRate, 16);
});
