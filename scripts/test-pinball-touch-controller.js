/**
 * Automated Unit Tests for Virtual Arcade Pinball Touch Controls (#1104)
 * Run via: node --test scripts/test-pinball-touch-controller.js
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const pinball = require('../assets/js/pinball-touch-controller.js');

test('isPinballGame identifies pinball and physics titles', () => {
  assert.equal(pinball.isPinballGame({ id: 'neon-pinball-dx_babin', title: 'Neon Pinball DX', category: 'Arcade' }), true);
  assert.equal(pinball.isPinballGame({ id: 'quantum-pinball_joitapaul', title: 'Quantum Pinball', category: 'Pinball' }), true);
  assert.equal(pinball.isPinballGame({ id: 'cyber-pachinko', title: 'Cyber Pachinko', category: 'Physics' }), true);
  assert.equal(pinball.isPinballGame({ id: 'flipper-frenzy', title: 'Flipper Frenzy', category: 'Action' }), true);

  // Unrelated games
  assert.equal(pinball.isPinballGame({ id: 'cyber-snake', title: 'Cyber Snake', category: 'Classic' }), false);
  assert.equal(pinball.isPinballGame({ id: 'space-invaders', title: 'Space Invaders', category: 'Shooter' }), false);
  assert.equal(pinball.isPinballGame(null), false);
});

test('calculatePlungerForce calculates Hookes law F = -kx with correct bounds', () => {
  // Zero drag
  const zero = pinball.calculatePlungerForce(0, 120, 1.0);
  assert.equal(zero.distance, 0);
  assert.equal(zero.compressionRatio, 0);
  assert.equal(zero.force, 0);
  assert.equal(zero.velocity, 0);

  // Halfway compression (60px / 120px = 0.5)
  const half = pinball.calculatePlungerForce(60, 120, 1.0);
  assert.equal(half.distance, 60);
  assert.equal(half.compressionRatio, 0.5);
  assert.equal(half.force, 0.5);
  assert.equal(half.velocity, 50.0);

  // Full compression (120px / 120px = 1.0)
  const full = pinball.calculatePlungerForce(120, 120, 1.0);
  assert.equal(full.distance, 120);
  assert.equal(full.compressionRatio, 1.0);
  assert.equal(full.force, 1.0);
  assert.equal(full.velocity, 100.0);

  // Clamp beyond maximum pull (200px -> clamped to 120px)
  const over = pinball.calculatePlungerForce(200, 120, 1.0);
  assert.equal(over.distance, 120);
  assert.equal(over.compressionRatio, 1.0);

  // Clamp negative pull (-50px -> clamped to 0px)
  const neg = pinball.calculatePlungerForce(-50, 120, 1.0);
  assert.equal(neg.distance, 0);
  assert.equal(neg.compressionRatio, 0);
});

test('triggerHaptic gracefully handles environments with or without Web Haptics', () => {
  // Safe execution without vibrate
  const origVibrate = typeof navigator !== 'undefined' ? navigator.vibrate : undefined;

  // Mock vibrate on existing navigator
  if (typeof navigator !== 'undefined') {
    navigator.vibrate = (pattern) => Boolean(pattern);
    assert.equal(pinball.triggerHaptic(15), true);
    navigator.vibrate = origVibrate;
  } else {
    assert.equal(pinball.triggerHaptic(15), false);
  }
});

test('PinballController manages independent flipper states and synthesizes key events', () => {
  const dispatchedEvents = [];
  const mockWindow = {
    document: {
      dispatchEvent(evt) {
        dispatchedEvents.push({ key: evt.key, code: evt.code, type: evt.type });
      }
    },
    KeyboardEvent: class MockKeyboardEvent {
      constructor(type, init) {
        this.type = type;
        this.key = init.key;
        this.code = init.code;
      }
    }
  };

  const controller = new pinball.PinballController();
  controller.getTargetWindow = () => mockWindow;

  // Actuate Left Flipper
  controller.setLeftFlipper(true);
  assert.equal(controller.leftFlipperActive, true);
  assert.ok(dispatchedEvents.some(e => e.code === 'ArrowLeft' && e.type === 'keydown'));
  assert.ok(dispatchedEvents.some(e => e.code === 'KeyA' && e.type === 'keydown'));

  // Release Left Flipper
  controller.setLeftFlipper(false);
  assert.equal(controller.leftFlipperActive, false);
  assert.ok(dispatchedEvents.some(e => e.code === 'ArrowLeft' && e.type === 'keyup'));

  // Actuate Right Flipper
  controller.setRightFlipper(true);
  assert.equal(controller.rightFlipperActive, true);
  assert.ok(dispatchedEvents.some(e => e.code === 'ArrowRight' && e.type === 'keydown'));

  // Release Right Flipper
  controller.setRightFlipper(false);
  assert.equal(controller.rightFlipperActive, false);
  assert.ok(dispatchedEvents.some(e => e.code === 'ArrowRight' && e.type === 'keyup'));
});

test('Multi-touch tracking supports simultaneous chords and independent touch sets', () => {
  const controller = new pinball.PinballController();
  controller.getTargetWindow = () => null;

  // Simulate two fingers on left flipper zone (e.g. resting thumb + tap)
  controller.leftTouchIds.add(101);
  controller.setLeftFlipper(true);
  assert.equal(controller.leftFlipperActive, true);

  controller.leftTouchIds.add(102);
  assert.equal(controller.leftTouchIds.size, 2);
  assert.equal(controller.leftFlipperActive, true);

  // Lift one finger, flipper must stay active
  controller.leftTouchIds.delete(101);
  assert.equal(controller.leftTouchIds.size, 1);
  assert.equal(controller.leftFlipperActive, true);

  // Meanwhile, touch right flipper simultaneously
  controller.rightTouchIds.add(201);
  controller.setRightFlipper(true);
  assert.equal(controller.rightFlipperActive, true);

  // Release second left finger: left flipper deactivates, right flipper remains active
  controller.leftTouchIds.delete(102);
  controller.setLeftFlipper(false);
  assert.equal(controller.leftFlipperActive, false);
  assert.equal(controller.rightFlipperActive, true);

  controller.releaseAll();
  assert.equal(controller.leftFlipperActive, false);
  assert.equal(controller.rightFlipperActive, false);
});

test('firePlunger translates pull distance into launch impulse and ignores micro-drags', () => {
  const dispatchedEvents = [];
  const mockWindow = {
    document: {
      dispatchEvent(evt) {
        dispatchedEvents.push({ key: evt.key, code: evt.code, type: evt.type });
      }
    },
    KeyboardEvent: class MockKeyboardEvent {
      constructor(type, init) {
        this.type = type;
        this.key = init.key;
        this.code = init.code;
      }
    }
  };

  const controller = new pinball.PinballController();
  controller.getTargetWindow = () => mockWindow;

  // Micro-drag (3px / 120px = 0.025 compression ratio) is safely ignored
  const micro = controller.firePlunger(3);
  assert.equal(dispatchedEvents.length, 0);

  // Full pull (100px) fires Space impulse
  const launch = controller.firePlunger(100);
  assert.equal(launch.distance, 100);
  assert.ok(launch.compressionRatio > 0.8);
  assert.ok(dispatchedEvents.some(e => e.code === 'Space' && e.type === 'keydown'));
});

test('Ensures zero Unicode emojis in pinball controller script and stylesheet', () => {
  const jsPath = require.resolve('../assets/js/pinball-touch-controller.js');
  const cssPath = require.resolve('../assets/css/pinball-touch-controller.css');

  const jsContent = fs.readFileSync(jsPath, 'utf8');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

  assert.equal(emojiRegex.test(jsContent), false, 'Found emoji in pinball-touch-controller.js');
  assert.equal(emojiRegex.test(cssContent), false, 'Found emoji in pinball-touch-controller.css');
});
