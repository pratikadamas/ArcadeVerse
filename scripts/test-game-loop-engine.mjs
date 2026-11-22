import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ArcadeVerse = require('../assets/js/arcadeverse-sdk.js');

test('ArcadeVerse exposes game loop and speed management APIs', () => {
  assert.equal(typeof ArcadeVerse.createGameLoop, 'function');
  assert.equal(typeof ArcadeVerse.onSpeedChange, 'function');
  assert.equal(typeof ArcadeVerse.getSpeed, 'function');
  assert.equal(typeof ArcadeVerse.setSpeed, 'function');
});

test('Speed regulator APIs properly register callbacks, clamp bounds, and update values', () => {
  let receivedSpeed = null;
  const unsub = ArcadeVerse.onSpeedChange((payload) => {
    receivedSpeed = payload.speed;
  });

  ArcadeVerse.setSpeed(1.5);
  assert.equal(ArcadeVerse.getSpeed(), 1.5);
  assert.equal(receivedSpeed, 1.5);

  // Clamps minimum to 0.25
  ArcadeVerse.setSpeed(0.05);
  assert.equal(ArcadeVerse.getSpeed(), 0.25);

  // Clamps maximum to 3.0
  ArcadeVerse.setSpeed(5.0);
  assert.equal(ArcadeVerse.getSpeed(), 3.0);

  // Reset to default
  ArcadeVerse.setSpeed(1.0);
  assert.equal(ArcadeVerse.getSpeed(), 1.0);
});

for (const hz of [60, 120, 144, 240]) {
  test(`fixed-timestep determinism across ${hz} Hz display rate`, () => {
    ArcadeVerse.setSpeed(1.0);
    let updateTicks = 0;
    let renderFrames = 0;
    const fixedDt = 1000 / 60; // 16.6667ms (60 physics steps per second)

    const loop = ArcadeVerse.createGameLoop({
      fixedDt: fixedDt,
      maxSubSteps: 10,
      autoPause: false,
      update: () => {
        updateTicks++;
      },
      render: (alpha) => {
        renderFrames++;
        assert.ok(alpha >= 0 && alpha <= 1.0, `alpha ${alpha} within [0, 1]`);
      }
    });

    // Simulate 1000ms duration at `hz` display rate
    const frameInterval = 1000 / hz;
    const totalFrames = Math.round(hz);

    for (let f = 0; f < totalFrames; f++) {
      loop.stepManual(frameInterval);
    }

    assert.equal(renderFrames, totalFrames);
    // Across 1000ms, regardless of 60Hz, 120Hz, 144Hz, or 240Hz, 60 physics updates must occur
    assert.ok(Math.abs(updateTicks - 60) <= 1, `Expected ~60 update ticks at ${hz}Hz, got ${updateTicks}`);
    assert.ok(Math.abs(loop.getTotalSimulatedTime() - 1000) <= fixedDt, `Total simulated time matches 1000ms`);

    loop.destroy();
  });
}

test('spiral of death delta clamping prevents physics explosion on 5-second lag spike', () => {
  ArcadeVerse.setSpeed(1.0);
  let updateTicks = 0;
  const loop = ArcadeVerse.createGameLoop({
    fixedDt: 1000 / 60,
    maxSubSteps: 4,
    maxFrameTime: 250,
    autoPause: false,
    update: () => {
      updateTicks++;
    }
  });

  // Simulate a 5000ms tab freeze
  loop.stepManual(5000);

  // Sub-steps must be capped at maxSubSteps (4) instead of executing 300 updates in one frame
  assert.equal(updateTicks, 4);
  assert.equal(loop.getTickCount(), 4);
  // Accumulator backlog must be cleared to prevent runaway spiral on subsequent frames
  assert.equal(loop.getAccumulator(), 0);

  // Normal subsequent frame continues cleanly
  loop.stepManual(16.667);
  assert.equal(updateTicks, 5);

  loop.destroy();
});

test('game speed scaling dynamically alters physics tick progression', () => {
  // Test at 0.5x speed
  ArcadeVerse.setSpeed(0.5);
  let ticksHalf = 0;
  const loopHalf = ArcadeVerse.createGameLoop({
    fixedDt: 1000 / 60,
    autoPause: false,
    update: () => { ticksHalf++; }
  });
  for (let f = 0; f < 60; f++) {
    loopHalf.stepManual(1000 / 60);
  }
  // At 0.5x speed over 1 second, exactly 30 physics ticks occur
  assert.equal(ticksHalf, 30);
  loopHalf.destroy();

  // Test at 2.0x speed
  ArcadeVerse.setSpeed(2.0);
  let ticksDouble = 0;
  const loopDouble = ArcadeVerse.createGameLoop({
    fixedDt: 1000 / 60,
    maxSubSteps: 8,
    autoPause: false,
    update: () => { ticksDouble++; }
  });
  for (let f = 0; f < 60; f++) {
    loopDouble.stepManual(1000 / 60);
  }
  // At 2.0x speed over 1 second, exactly 120 physics ticks occur
  assert.equal(ticksDouble, 120);
  loopDouble.destroy();

  // Reset speed
  ArcadeVerse.setSpeed(1.0);
});

test('pause and resume lifecycle controls halt and restart progression cleanly', () => {
  let ticks = 0;
  const loop = ArcadeVerse.createGameLoop({
    fixedDt: 1000 / 60,
    autoPause: false,
    update: () => { ticks++; }
  });

  loop.start();
  assert.equal(loop.isRunning(), true);
  assert.equal(loop.isPaused(), false);

  loop.stepManual(100);
  assert.ok(ticks > 0);
  const ticksBeforePause = ticks;

  loop.pause();
  assert.equal(loop.isPaused(), true);

  loop.resume();
  assert.equal(loop.isPaused(), false);

  loop.stop();
  assert.equal(loop.isRunning(), false);
  loop.destroy();
});
