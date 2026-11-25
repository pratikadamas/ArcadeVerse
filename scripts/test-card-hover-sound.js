/**
 * Automated Unit Test Suite for ArcadeCardHoverSound
 * Issue #1508 - Game Card Hover Sound Feedback with Subtle Retro Click Tones
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

function createMockStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); }
  };
}

global.localStorage = createMockStorage();

const hoverSound = require('../assets/js/card-hover-sound.js');

function createMockAudioContext() {
  const createdOscs = [];
  const createdGains = [];

  return {
    currentTime: 1.0,
    destination: { id: 'mock-destination' },
    createdOscs,
    createdGains,
    createOscillator: () => {
      const osc = {
        type: '',
        startedAt: null,
        stoppedAt: null,
        connectedTo: null,
        frequency: {
          value: null,
          setValueAtTime: (val) => { osc.frequency.value = val; }
        },
        connect: (dest) => { osc.connectedTo = dest; },
        start: (t) => { osc.startedAt = t; },
        stop: (t) => { osc.stoppedAt = t; }
      };
      createdOscs.push(osc);
      return osc;
    },
    createGain: () => {
      const gain = {
        initialGain: null,
        rampTarget: null,
        rampTime: null,
        connectedTo: null,
        gain: {
          setValueAtTime: (val) => { gain.initialGain = val; },
          exponentialRampToValueAtTime: (val, t) => {
            gain.rampTarget = val;
            gain.rampTime = t;
          }
        },
        connect: (dest) => { gain.connectedTo = dest; }
      };
      createdGains.push(gain);
      return gain;
    }
  };
}

test('ArcadeCardHoverSound exports required API and synthesis constants', () => {
  assert.equal(hoverSound.BLIP_FREQUENCY_HZ, 880);
  assert.equal(hoverSound.BLIP_DURATION_SEC, 0.03);
  assert.equal(typeof hoverSound.playBlip, 'function');
  assert.equal(typeof hoverSound.setEnabled, 'function');
  assert.equal(typeof hoverSound.isEnabled, 'function');
  assert.equal(typeof hoverSound.toggle, 'function');
  assert.equal(typeof hoverSound.isMasterMuted, 'function');
  assert.equal(typeof hoverSound.getMasterVolume, 'function');
});

test('playBlip synthesizes 880Hz triangle 30ms retro blip via Web Audio nodes', () => {
  global.localStorage.clear();
  hoverSound.setEnabled(true);
  hoverSound.resetDebounce();

  const mockCtx = createMockAudioContext();
  const played = hoverSound.playBlip({ ctx: mockCtx, nowMs: 1000 });

  assert.equal(played, true);
  assert.equal(mockCtx.createdOscs.length, 1);
  assert.equal(mockCtx.createdGains.length, 1);

  const osc = mockCtx.createdOscs[0];
  assert.equal(osc.type, 'triangle');
  assert.equal(osc.frequency.value, 880);
  assert.equal(osc.startedAt, 1.0);
  assert.ok(osc.stoppedAt >= 1.03 && osc.stoppedAt <= 1.04);

  const gain = mockCtx.createdGains[0];
  assert.ok(gain.initialGain > 0);
  assert.equal(gain.rampTarget, 0.0001);
  assert.equal(gain.rampTime, 1.03);
});

test('playBlip enforces debounce timing between rapid card hover events', () => {
  global.localStorage.clear();
  hoverSound.setEnabled(true);
  hoverSound.resetDebounce();

  const mockCtx = createMockAudioContext();

  // First event at 1000ms -> plays
  assert.equal(hoverSound.playBlip({ ctx: mockCtx, nowMs: 1000 }), true);
  // Rapid event 20ms later -> debounced
  assert.equal(hoverSound.playBlip({ ctx: mockCtx, nowMs: 1020 }), false);
  // Event after >= DEBOUNCE_MS (55ms) -> plays
  assert.equal(hoverSound.playBlip({ ctx: mockCtx, nowMs: 1065 }), true);

  assert.equal(mockCtx.createdOscs.length, 2);
});

test('playBlip respects Card Hover SFX toggle and global master mute', () => {
  global.localStorage.clear();
  hoverSound.resetDebounce();
  const mockCtx = createMockAudioContext();

  // Disabled via Card Hover SFX toggle
  hoverSound.setEnabled(false);
  assert.equal(hoverSound.playBlip({ ctx: mockCtx, nowMs: 2000 }), false);

  // Re-enabled, but global master mute is active
  hoverSound.setEnabled(true);
  global.localStorage.setItem('arcadeverse_muted', 'true');
  assert.equal(hoverSound.isMasterMuted(), true);
  assert.equal(hoverSound.playBlip({ ctx: mockCtx, nowMs: 2100 }), false);

  // Unmuted -> plays
  global.localStorage.setItem('arcadeverse_muted', 'false');
  assert.equal(hoverSound.isMasterMuted(), false);
  assert.equal(hoverSound.playBlip({ ctx: mockCtx, nowMs: 2200 }), true);
});

test('Ensures zero Unicode emojis across all card-hover-sound files', () => {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;

  const filesToCheck = [
    'assets/js/card-hover-sound.js',
    'assets/css/card-hover-sound.css',
    'scripts/test-card-hover-sound.js'
  ];

  for (const relPath of filesToCheck) {
    const fullPath = path.join(__dirname, '..', relPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.equal(emojiRegex.test(content), false, `Found forbidden Unicode emoji in ${relPath}`);
  }
});

