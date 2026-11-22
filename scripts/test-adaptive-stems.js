const test = require('node:test');
const assert = require('node:assert/strict');
const AdaptiveStems = require('../assets/js/adaptive-stems.js');

test('AdaptiveStems contains synchronized audio stem state presets', () => {
  assert.ok(AdaptiveStems.STATES.calm);
  assert.ok(AdaptiveStems.STATES.exploration);
  assert.ok(AdaptiveStems.STATES.combat);
  assert.ok(AdaptiveStems.STATES.boss);
});

test('AdaptiveStems maps intensity curves smoothly across stems', () => {
  const mockGains = {};
  const mockCtx = {
    currentTime: 0,
    createGain: () => {
      const g = {
        gain: {
          value: 0,
          setValueAtTime: (v) => { g.gain.value = v; },
          setTargetAtTime: (v) => { g.gain.value = v; }
        },
        connect: () => {}
      };
      return g;
    },
    destination: {}
  };

  const stems = new AdaptiveStems(mockCtx);
  stems.setIntensity(1.0); // Maximum boss/combat intensity
  assert.equal(stems.stemGains.drums.gain.value, 1.0);
  assert.ok(Math.abs(stems.stemGains.lead.gain.value - 0.996) < 0.001);
});
