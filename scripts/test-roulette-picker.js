/**
 * Automated Unit Test Suite for ArcadeRoulettePicker
 * Issue #1502 - Random Game Roulette Wheel Picker Modal for Indecisive Players
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const roulette = require('../assets/js/roulette-picker.js');

const SAMPLE_REGISTRY = [
  { id: 'g1', title: 'Snake', category: 'Arcade', tags: ['retro'] },
  { id: 'g2', title: 'Chess', category: 'Strategy', tags: ['board'] },
  { id: 'g3', title: 'Pong', category: 'Arcade', tags: ['retro'] },
  { id: 'g4', title: 'Tetris', category: 'Puzzle', tags: ['retro'] },
  { id: 'g5', title: 'Space Shooter', category: 'Action', tags: ['shooter'] },
  { id: 'g6', title: 'Racer', category: 'Arcade', tags: ['speed'] },
  { id: 'g7', title: 'Wordle', category: 'Puzzle', tags: ['word'] },
  { id: 'g8', title: 'Tower Defense', category: 'Strategy', tags: ['tactical'] },
  { id: 'g9', title: 'Breakout', category: 'Arcade', tags: ['retro'] },
  { id: 'g10', title: 'Rhythm Beat', category: 'Rhythm', tags: ['music'] }
];

test('ArcadeRoulettePicker exports all required API methods', () => {
  assert.equal(roulette.MAX_SLICES, 8);
  assert.equal(typeof roulette.getCandidateGames, 'function');
  assert.equal(typeof roulette.selectWheelSlices, 'function');
  assert.equal(typeof roulette.computeSpinTarget, 'function');
  assert.equal(typeof roulette.resolveWinnerIndex, 'function');
  assert.equal(typeof roulette.easeOutCubic, 'function');
  assert.equal(typeof roulette.playTickSound, 'function');
});

test('getCandidateGames filters by category/tag and falls back cleanly when < 2 match', () => {
  const arcade = roulette.getCandidateGames(SAMPLE_REGISTRY, { category: 'Arcade' });
  assert.equal(arcade.length, 4);
  assert.ok(arcade.every((g) => g.category === 'Arcade'));

  const retro = roulette.getCandidateGames(SAMPLE_REGISTRY, { tag: 'retro' });
  assert.equal(retro.length, 4);

  // Only 1 Rhythm game -> falls back to full registry so wheel always has >= 2 slices
  const singleFallback = roulette.getCandidateGames(SAMPLE_REGISTRY, { category: 'Rhythm' });
  assert.equal(singleFallback.length, SAMPLE_REGISTRY.length);
});

test('selectWheelSlices caps slices at MAX_SLICES with unique games', () => {
  const slices = roulette.selectWheelSlices(SAMPLE_REGISTRY, 8);
  assert.equal(slices.length, 8);
  const ids = new Set(slices.map((s) => s.id));
  assert.equal(ids.size, 8);
});

test('computeSpinTarget and resolveWinnerIndex deterministically align target slice under pointer', () => {
  for (const sliceCount of [4, 6, 8, 12]) {
    for (let targetIdx = 0; targetIdx < sliceCount; targetIdx++) {
      const targetAngle = roulette.computeSpinTarget(sliceCount, targetIdx, 45, 5);
      assert.ok(targetAngle > 45 + 5 * 360 - 1, 'Spin must include full forward rotations');
      const resolved = roulette.resolveWinnerIndex(targetAngle, sliceCount);
      assert.equal(resolved, targetIdx, `Expected slice ${targetIdx} for count=${sliceCount}, got ${resolved}`);
    }
  }
});

test('playTickSound synthesizes retro tick via Web Audio API without external files', () => {
  let oscCount = 0;
  let gainCount = 0;
  const mockCtx = {
    currentTime: 0.5,
    destination: {},
    createOscillator: () => {
      oscCount++;
      return {
        type: '',
        frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
        connect: () => {},
        start: () => {},
        stop: () => {}
      };
    },
    createGain: () => {
      gainCount++;
      return {
        gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
        connect: () => {}
      };
    }
  };

  assert.equal(roulette.playTickSound(mockCtx), true);
  assert.equal(oscCount, 1);
  assert.equal(gainCount, 1);
});

test('Ensures zero Unicode emojis across all roulette-picker files', () => {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;

  const filesToCheck = [
    'assets/js/roulette-picker.js',
    'assets/css/roulette-picker.css',
    'scripts/test-roulette-picker.js'
  ];

  for (const relPath of filesToCheck) {
    const fullPath = path.join(__dirname, '..', relPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.equal(emojiRegex.test(content), false, `Found forbidden Unicode emoji in ${relPath}`);
  }
});
