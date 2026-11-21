import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ArcadeVerse = require('../assets/js/arcadeverse-sdk.js');

test('Deterministic Replay APIs are properly exposed on ArcadeVerse SDK', () => {
  assert.equal(typeof ArcadeVerse.createSeededRNG, 'function');
  assert.equal(typeof ArcadeVerse.hashState, 'function');
  assert.equal(typeof ArcadeVerse.validateReplayEnvelope, 'function');
  assert.equal(typeof ArcadeVerse.createReplayRecorder, 'function');
  assert.equal(typeof ArcadeVerse.createReplayPlayer, 'function');
  assert.equal(typeof ArcadeVerse.replayInspector, 'object');
  assert.equal(typeof ArcadeVerse.replayInspector.validate, 'function');
  assert.equal(typeof ArcadeVerse.replayInspector.inspect, 'function');
  assert.equal(typeof ArcadeVerse.replayInspector.findFirstDivergence, 'function');
});

test('Mulberry32 Seeded RNG produces 100% deterministic sequences', () => {
  const seed = 987654321;
  const rng1 = ArcadeVerse.createSeededRNG(seed);
  const rng2 = ArcadeVerse.createSeededRNG(seed);

  const seq1 = [];
  const seq2 = [];
  for (let i = 0; i < 200; i++) {
    seq1.push(rng1.next());
    seq2.push(rng2.next());
  }

  assert.deepEqual(seq1, seq2, 'Identical seed must produce identical PRNG float sequence');

  // Verify nextInt bounds
  for (let i = 0; i < 100; i++) {
    const val = rng1.nextInt(10, 50);
    assert.ok(val >= 10 && val <= 50, `Value ${val} must be between 10 and 50`);
    assert.equal(Math.floor(val), val, 'Value must be integer');
  }

  // Different seed produces different sequence
  const rng3 = ArcadeVerse.createSeededRNG(12345);
  const seq3 = [];
  for (let i = 0; i < 10; i++) {
    seq3.push(rng3.next());
  }
  assert.notDeepEqual(seq1.slice(0, 10), seq3, 'Different seed must produce divergent sequence');
});

test('Canonical FNV-1a state hashing is order-independent and deterministic', () => {
  const stateA = { x: 100, y: 200, score: 50, inventory: ['sword', 'shield'] };
  const stateB = { score: 50, inventory: ['sword', 'shield'], y: 200, x: 100 };

  const hashA = ArcadeVerse.hashState(stateA);
  const hashB = ArcadeVerse.hashState(stateB);

  assert.equal(hashA, hashB, 'State hash must remain invariant under property permutation');
  assert.equal(typeof hashA, 'string');
  assert.equal(hashA.length, 8, '32-bit hex hash must be exactly 8 characters');

  // Divergent state produces different hash
  const stateC = { x: 101, y: 200, score: 50, inventory: ['sword', 'shield'] };
  assert.notEqual(hashA, ArcadeVerse.hashState(stateC), 'Different state must yield different hash');
});

test('Envelope validation rejects malformed, excessive, or incompatible data', () => {
  // Reject null or non-objects
  assert.equal(ArcadeVerse.validateReplayEnvelope(null).valid, false);
  assert.equal(ArcadeVerse.validateReplayEnvelope('not a json').valid, false);

  // Reject wrong magic
  assert.equal(ArcadeVerse.validateReplayEnvelope({ magic: 'FAKE', version: 1, seed: 1, inputs: [] }).valid, false);

  // Reject incompatible version
  assert.equal(ArcadeVerse.validateReplayEnvelope({ magic: 'AVREP', version: 99, seed: 1, inputs: [] }).valid, false);

  // Reject game ID mismatch
  assert.equal(ArcadeVerse.validateReplayEnvelope({ magic: 'AVREP', version: 1, gameId: 'cyber-racer', seed: 1, inputs: [] }, 'retro-shooter').valid, false);

  // Reject non-monotonic input ticks
  const nonMonotonic = {
    magic: 'AVREP',
    version: 1,
    gameId: 'test-game',
    seed: 123,
    inputs: [
      { tick: 10, type: 'jump' },
      { tick: 5, type: 'shoot' } // Backwards tick!
    ]
  };
  assert.equal(ArcadeVerse.validateReplayEnvelope(nonMonotonic).valid, false);

  // Reject oversized input arrays (> 100,000)
  const excessiveInputs = {
    magic: 'AVREP',
    version: 1,
    seed: 1,
    inputs: new Array(100001).fill({ tick: 0, type: 'idle' })
  };
  assert.equal(ArcadeVerse.validateReplayEnvelope(excessiveInputs).valid, false);
});

test('Sample Game 1 (Grid Runner): Multi-run determinism produces identical checkpoint hashes', () => {
  // Define a deterministic Grid Runner simulation
  function createGridRunner(seed) {
    const rng = ArcadeVerse.createSeededRNG(seed);
    return {
      x: 0,
      y: 0,
      score: 0,
      coins: 0,
      step: function (action) {
        if (action === 'UP') this.y -= 1;
        else if (action === 'DOWN') this.y += 1;
        else if (action === 'LEFT') this.x -= 1;
        else if (action === 'RIGHT') this.x += 1;

        // Deterministic coin spawn via RNG
        if (rng.next() > 0.6) {
          this.coins += 1;
          this.score += 10;
        }
        this.score += 1;
      },
      getState: function () {
        return { x: this.x, y: this.y, score: this.score, coins: this.coins };
      }
    };
  }

  const initialSeed = 424242;
  const recorder = ArcadeVerse.createReplayRecorder({
    gameId: 'grid-runner',
    seed: initialSeed,
    initialState: { x: 0, y: 0, score: 0, coins: 0 }
  });

  // Run initial recording run
  const gameRun1 = createGridRunner(initialSeed);
  const actions = ['RIGHT', 'RIGHT', 'DOWN', 'RIGHT', 'UP', 'RIGHT', 'DOWN', 'DOWN'];

  for (let tick = 0; tick < 50; tick++) {
    const actionIndex = tick % actions.length;
    const action = actions[actionIndex];
    if (tick % 5 === 0) {
      recorder.recordInput('MOVE', { dir: action });
      gameRun1.step(action);
    } else {
      gameRun1.step('IDLE');
    }

    if (tick % 10 === 0) {
      recorder.recordCheckpoint(gameRun1.getState());
    }
    recorder.tick();
  }

  const envelope = recorder.exportEnvelope();
  assert.equal(envelope.magic, 'AVREP');
  assert.equal(envelope.gameId, 'grid-runner');
  assert.equal(envelope.checkpoints.length, 5);

  // Run second independent replay run using createReplayPlayer
  const gameRun2 = createGridRunner(initialSeed);
  let checkpointsVerified = 0;
  let divergenceOccurred = false;

  const player = ArcadeVerse.createReplayPlayer(envelope, {
    gameId: 'grid-runner',
    getState: () => gameRun2.getState(),
    onCheckpoint: () => {
      checkpointsVerified++;
    },
    onDivergence: () => {
      divergenceOccurred = true;
    }
  });

  // Replay exactly 50 ticks matching original run
  for (let tick = 0; tick < 50; tick++) {
    const inputForTick = envelope.inputs.find(inp => inp.tick === tick);
    if (inputForTick) {
      gameRun2.step(inputForTick.data.dir);
    } else {
      gameRun2.step('IDLE');
    }
    player.step();
  }

  assert.equal(divergenceOccurred, false, 'No divergence must occur on identical replay');
  assert.equal(checkpointsVerified, 5, 'All 5 checkpoints must match exactly across runs');
  assert.deepEqual(gameRun1.getState(), gameRun2.getState(), 'End state must be bitwise identical');

  player.destroy();
});

test('Sample Game 2 (Physics Projectile): Replay verifies gravity, velocity, and bounce determinism', () => {
  function createPhysicsProjectile(seed) {
    const rng = ArcadeVerse.createSeededRNG(seed);
    return {
      x: 0,
      y: 100,
      vx: 5,
      vy: 0,
      gravity: 0.5,
      bounces: 0,
      step: function (impulse) {
        if (impulse && impulse.vy) this.vy += impulse.vy;
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity;

        // Ground bounce with deterministic damping
        if (this.y >= 300) {
          this.y = 300;
          this.vy = -this.vy * 0.8;
          this.bounces++;
          // Random wind resistance gust from RNG
          this.vx += (rng.next() - 0.5) * 0.1;
        }
      },
      getState: function () {
        return {
          x: Math.round(this.x * 100) / 100,
          y: Math.round(this.y * 100) / 100,
          bounces: this.bounces
        };
      }
    };
  }

  const seed = 777123;
  const recorder = ArcadeVerse.createReplayRecorder({
    gameId: 'physics-projectile',
    seed: seed
  });

  const p1 = createPhysicsProjectile(seed);
  for (let t = 0; t < 60; t++) {
    if (t === 10 || t === 30) {
      recorder.recordInput('BOOST', { vy: -4 });
      p1.step({ vy: -4 });
    } else {
      p1.step(null);
    }
    if (t % 15 === 0) {
      recorder.recordCheckpoint(p1.getState());
    }
    recorder.tick();
  }

  const envelope = recorder.exportEnvelope();
  const inspection = ArcadeVerse.replayInspector.inspect(envelope);
  assert.equal(inspection.valid, true);
  assert.equal(inspection.checkpointCount, 4);

  // Headless divergence check via inspector
  const p2 = createPhysicsProjectile(seed);
  const audit = ArcadeVerse.replayInspector.findFirstDivergence(envelope, (state, inputs) => {
    let impulse = null;
    if (inputs && inputs.length > 0) {
      for (const inp of inputs) {
        if (inp.type === 'BOOST') impulse = inp.data;
      }
    }
    p2.step(impulse);
    return p2.getState();
  });

  assert.equal(audit.valid, true);
  assert.equal(audit.match, true);
  assert.equal(audit.firstMismatch, null);
});

test('Replay Inspector accurately pinpoints the first divergent state and tick', () => {
  const seed = 555;
  const recorder = ArcadeVerse.createReplayRecorder({ gameId: 'divergence-test', seed: seed });

  let state = { count: 0 };
  for (let t = 0; t <= 30; t++) {
    state.count += 2;
    if (t === 10 || t === 20 || t === 30) {
      recorder.recordCheckpoint(state);
    }
    recorder.tick();
  }

  const envelope = recorder.exportEnvelope();

  // Intentionally inject a discrepancy at tick 20
  let replayState = { count: 0 };
  const audit = ArcadeVerse.replayInspector.findFirstDivergence(envelope, (s, inputs, rng, tick) => {
    replayState.count += 2;
    if (tick === 20) {
      // Simulating a desync or unrecorded memory corruption
      replayState.count += 999;
    }
    return replayState;
  });

  assert.equal(audit.valid, true);
  assert.equal(audit.match, false);
  assert.ok(audit.firstMismatch !== null);
  assert.equal(audit.firstMismatch.tick, 20);
  assert.notEqual(audit.firstMismatch.actualHash, audit.firstMismatch.expectedHash);
});

test('Replay player handles pause, resume, and teardown cleanly', () => {
  const recorder = ArcadeVerse.createReplayRecorder({ gameId: 'lifecycle-test', seed: 101 });
  for (let t = 0; t < 20; t++) {
    recorder.recordInput('KEY', { code: 'Space' });
    recorder.tick();
  }
  const envelope = recorder.exportEnvelope();

  const player = ArcadeVerse.createReplayPlayer(envelope, {
    autoPause: false
  });

  player.start();
  assert.equal(player.isRunning(), true);
  assert.equal(player.isPaused(), false);

  player.pause();
  assert.equal(player.isPaused(), true);

  player.resume();
  assert.equal(player.isPaused(), false);

  player.destroy();
  assert.equal(player.isRunning(), false);
});
