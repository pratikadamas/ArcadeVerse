const test = require('node:test');
const assert = require('node:assert/strict');
const GranularSoundLab = require('../assets/js/granular-sound-lab.js');

test('GranularSoundLab generates procedural source buffer without audio files', () => {
  const mockCtx = {
    sampleRate: 44100,
    currentTime: 0,
    createGain: () => ({
      gain: { setValueAtTime: () => {} },
      connect: () => {}
    }),
    createBuffer: (ch, len, rate) => ({
      duration: len / rate,
      getChannelData: () => new Float32Array(len)
    }),
    destination: {}
  };

  const lab = new GranularSoundLab(mockCtx);
  const buf = lab.generateProceduralBuffer(2.0);

  assert.ok(buf !== null);
  assert.equal(buf.duration, 2.0);
});

test('GranularSoundLab exports configuration JSON parameters', () => {
  const lab = new GranularSoundLab(null, { grainSize: 0.05, density: 30 });
  const config = JSON.parse(lab.exportConfig());

  assert.equal(config.grainSize, 0.05);
  assert.equal(config.density, 30);
});
