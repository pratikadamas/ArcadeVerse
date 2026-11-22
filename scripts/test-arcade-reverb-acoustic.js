const test = require('node:test');
const assert = require('node:assert/strict');
const ArcadeReverbAcoustic = require('../assets/js/arcade-reverb-acoustic.js');

test('ArcadeReverbAcoustic contains authentic retro acoustic presets', () => {
  assert.ok(ArcadeReverbAcoustic.PRESETS.arcade_hall);
  assert.ok(ArcadeReverbAcoustic.PRESETS.dungeon_cavern);
  assert.ok(ArcadeReverbAcoustic.PRESETS.metallic_corridor);
  assert.ok(ArcadeReverbAcoustic.PRESETS.concrete_basement);
});

test('ArcadeReverbAcoustic synthesizes procedural IR buffer without audio files', () => {
  const mockCtx = {
    sampleRate: 44100,
    createBuffer: (channels, length, sampleRate) => ({
      numberOfChannels: channels,
      length: length,
      sampleRate: sampleRate,
      getChannelData: () => new Float32Array(length)
    })
  };

  const reverb = new ArcadeReverbAcoustic(mockCtx);
  const irBuffer = reverb.generateImpulseResponse(ArcadeReverbAcoustic.PRESETS.arcade_hall);

  assert.ok(irBuffer !== null);
  assert.equal(irBuffer.numberOfChannels, 2);
  assert.ok(irBuffer.length > 0);
});
