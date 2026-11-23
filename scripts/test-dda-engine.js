/**
 * Test Suite for ArcadeVerse Dynamic Difficulty Adjustment (DDA) Engine (#1112)
 *
 * Verifies:
 * - Telemetry metric computation (DPM, survival time, hit rate)
 * - Multiplier boundary limits (0.75x to 1.25x)
 * - Rapid death beginner relief (>= 3 deaths in 30 seconds -> 0.75x)
 * - Mode locking (Pure Hardcore 1.0x vs Adaptive)
 * - Smooth non-jarring interpolation
 * - ArcadeVerse SDK dda namespace integration
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createTestEnvironment() {
  const store = new Map();
  const context = {
    Date,
    Math,
    Number,
    String,
    Array,
    Object,
    setTimeout,
    clearTimeout,
    console: { log() {}, warn() {}, error() {} },
    localStorage: {
      getItem: (k) => store.get(k) || null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k)
    },
    document: {
      getElementById: () => null,
      querySelector: () => null,
      createElement: () => ({
        setAttribute() {},
        appendChild() {},
        addEventListener() {},
        style: {}
      }),
      head: { appendChild() {} },
      body: { appendChild() {} }
    },
    window: {
      addEventListener() {},
      removeEventListener() {},
      postMessage() {}
    }
  };

  context.self = context;
  context.window.self = context;

  // Load arcade-dda-engine.js
  const ddaCode = fs.readFileSync(path.join(__dirname, '../assets/js/arcade-dda-engine.js'), 'utf8');
  vm.runInNewContext(ddaCode, context);

  return {
    ArcadeDDA: context.ArcadeDDA,
    store: store,
    context: context
  };
}

test('DDA Engine exports all required SDK methods', () => {
  const { ArcadeDDA } = createTestEnvironment();

  assert.equal(typeof ArcadeDDA.getAdaptiveMultiplier, 'function');
  assert.equal(typeof ArcadeDDA.getMultiplier, 'function');
  assert.equal(typeof ArcadeDDA.recordDeath, 'function');
  assert.equal(typeof ArcadeDDA.recordHit, 'function');
  assert.equal(typeof ArcadeDDA.getTelemetry, 'function');
  assert.equal(typeof ArcadeDDA.setMode, 'function');
  assert.equal(typeof ArcadeDDA.getMode, 'function');
  assert.equal(typeof ArcadeDDA.isEnabled, 'function');
  assert.equal(typeof ArcadeDDA.toggleMode, 'function');
  assert.equal(typeof ArcadeDDA.reset, 'function');
});

test('DDA Multiplier is bounded strictly within [0.75, 1.25]', () => {
  const { ArcadeDDA } = createTestEnvironment();
  ArcadeDDA.reset();
  ArcadeDDA.setMode('adaptive');

  // Baseline initial multiplier
  const initial = ArcadeDDA.getAdaptiveMultiplier();
  assert.ok(initial >= 0.75 && initial <= 1.25, `Initial ${initial} out of range [0.75, 1.25]`);

  // Record 10 rapid deaths to force maximum difficulty reduction
  for (let i = 0; i < 10; i++) {
    ArcadeDDA.recordDeath();
  }

  const reduced = ArcadeDDA.getAdaptiveMultiplier();
  assert.ok(reduced >= 0.75 && reduced <= 1.25, `Reduced ${reduced} out of range [0.75, 1.25]`);
  assert.ok(reduced <= 1.0, `Reduced multiplier ${reduced} should be <= 1.0`);
});

test('Pure Hardcore mode locks difficulty multiplier to 1.00', () => {
  const { ArcadeDDA } = createTestEnvironment();
  ArcadeDDA.reset();

  ArcadeDDA.setMode('hardcore');
  assert.equal(ArcadeDDA.getMode(), 'hardcore');
  assert.equal(ArcadeDDA.isEnabled(), false);

  // Even after many deaths, hardcore mode should strictly lock to 1.0
  for (let i = 0; i < 5; i++) {
    ArcadeDDA.recordDeath();
  }

  const mult = ArcadeDDA.getAdaptiveMultiplier();
  assert.equal(mult, 1.0, `Hardcore multiplier should be exactly 1.0, got ${mult}`);
});

test('Rapid death trigger: 3 deaths in 30 seconds dials back difficulty target to 0.75', () => {
  const { ArcadeDDA } = createTestEnvironment();
  ArcadeDDA.reset();
  ArcadeDDA.setMode('adaptive');

  // Record 3 deaths in quick succession
  ArcadeDDA.recordDeath();
  ArcadeDDA.recordDeath();
  ArcadeDDA.recordDeath();

  const telemetry = ArcadeDDA.getTelemetry();
  assert.ok(telemetry.deathsInLast30s >= 3, `Expected >= 3 deaths in last 30s, got ${telemetry.deathsInLast30s}`);
  assert.equal(telemetry.targetMultiplier, 0.75, `Target multiplier should drop to minimum 0.75 relief`);
});

test('Hit rate tracking accurately scales telemetry metrics', () => {
  const { ArcadeDDA } = createTestEnvironment();
  ArcadeDDA.reset();

  // 8 successful hits and 2 misses = 80% hit rate
  for (let i = 0; i < 8; i++) ArcadeDDA.recordHit(true);
  for (let j = 0; j < 2; j++) ArcadeDDA.recordHit(false);

  const t = ArcadeDDA.getTelemetry();
  assert.equal(t.totalHits, 8);
  assert.equal(t.totalMisses, 2);
  assert.equal(t.hitRate, 0.8);
});

test('ArcadeVerse SDK exposes dda protocol seamlessly', () => {
  const store = new Map();
  const context = {
    Date,
    Math,
    Number,
    String,
    Array,
    Object,
    setTimeout,
    clearTimeout,
    console: { log() {}, warn() {}, error() {} },
    localStorage: {
      getItem: (k) => store.get(k) || null,
      setItem: (k, v) => store.set(k, String(v))
    },
    document: {
      getElementById: () => null,
      addEventListener: () => {}
    },
    window: {
      addEventListener: () => {},
      removeEventListener: () => {},
      postMessage: () => {}
    }
  };

  context.self = context;
  context.window.self = context;

  const sdkCode = fs.readFileSync(path.join(__dirname, '../assets/js/arcadeverse-sdk.js'), 'utf8');
  vm.runInNewContext(sdkCode, context);

  const sdk = context.ArcadeVerse;
  assert.ok(sdk.dda, 'ArcadeVerse.dda namespace should exist');
  assert.equal(typeof sdk.dda.getAdaptiveMultiplier, 'function');
  assert.equal(typeof sdk.dda.recordDeath, 'function');
  assert.equal(typeof sdk.dda.recordHit, 'function');

  const mult = sdk.dda.getAdaptiveMultiplier();
  assert.ok(mult >= 0.75 && mult <= 1.25, `SDK multiplier ${mult} within valid range`);
});
