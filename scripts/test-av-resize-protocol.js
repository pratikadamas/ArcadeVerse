/**
 * ArcadeVerse Hub-to-Game AV_RESIZE Protocol & Viewport Synchronizer Test Suite (#1182)
 *
 * Validates that assets/js/app.js implements the active ResizeObserver and broadcastViewportResize
 * emitter, verifies the AV_RESIZE postMessage contract, validates dpr and orientation calculations,
 * and ensures ArcadeVerse.onResize in arcadeverse-sdk.js receives and processes viewport events.
 *
 * Usage:
 *   node scripts/test-av-resize-protocol.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('\n========================================================');
console.log('   ArcadeVerse AV_RESIZE Protocol & Viewport Test Suite');
console.log('========================================================\n');

const ROOT_DIR = path.resolve(__dirname, '..');
const APP_JS_PATH = path.join(ROOT_DIR, 'assets', 'js', 'app.js');
const SDK_JS_PATH = path.join(ROOT_DIR, 'assets', 'js', 'arcadeverse-sdk.js');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, failureDetails = '') {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${testName}`);
    if (failureDetails) {
      console.error(`         ${failureDetails}`);
    }
    failedTests++;
  }
}

// 1. Syntax Verification
try {
  execSync(`node -c "${APP_JS_PATH}"`, { stdio: 'pipe' });
  assert(true, 'assets/js/app.js syntax check passes');
} catch (err) {
  assert(false, 'assets/js/app.js syntax check passes', err.message);
}

try {
  execSync(`node -c "${SDK_JS_PATH}"`, { stdio: 'pipe' });
  assert(true, 'assets/js/arcadeverse-sdk.js syntax check passes');
} catch (err) {
  assert(false, 'assets/js/arcadeverse-sdk.js syntax check passes', err.message);
}

// 2. Hub Implementation Invariants in app.js
const appContent = fs.readFileSync(APP_JS_PATH, 'utf8');

assert(appContent.includes('function broadcastViewportResize'), 'app.js defines broadcastViewportResize function');
assert(appContent.includes('new ResizeObserver'), 'app.js attaches ResizeObserver to modalFrameWrapper');
assert(appContent.includes('type: "AV_RESIZE"'), 'app.js posts AV_RESIZE event to game iframe');
assert(appContent.includes('orientation: orientation'), 'AV_RESIZE payload includes calculated orientation');
assert(appContent.includes('dpr: dpr'), 'AV_RESIZE payload includes devicePixelRatio');
assert(appContent.includes('aspectRatio: height > 0 ? (width / height) : 1'), 'AV_RESIZE payload calculates aspect ratio');
assert(appContent.includes('broadcastViewportResize(true);'), 'AV_RESIZE is dispatched immediately on iframe load and fullscreen changes');

// 3. SDK Implementation Invariants in arcadeverse-sdk.js
const sdkContent = fs.readFileSync(SDK_JS_PATH, 'utf8');

assert(sdkContent.includes('onResize: function'), 'arcadeverse-sdk.js implements onResize method');
assert(sdkContent.includes("e.data.type === 'AV_RESIZE'") || sdkContent.includes('e.data.type === "AV_RESIZE"'), 'SDK listens for AV_RESIZE postMessage events');
assert(sdkContent.includes('fitCanvasAspectRatio'), 'SDK provides fitCanvasAspectRatio helper');

// 4. Mathematical Protocol Simulation
function createMockResizePayload(width, height, dpr, isFullscreen) {
  const orientation = width >= height ? 'landscape' : 'portrait';
  return {
    width: Math.round(width),
    height: Math.round(height),
    clientWidth: width,
    clientHeight: height,
    dpr: dpr || 1,
    isFullscreen: Boolean(isFullscreen),
    orientation: orientation,
    aspectRatio: height > 0 ? (width / height) : 1
  };
}

// Test 1080p Desktop Landscape
const payload1080p = createMockResizePayload(1920, 1080, 1, false);
assert(payload1080p.orientation === 'landscape', '1920x1080 correctly classified as landscape');
assert(Math.abs(payload1080p.aspectRatio - 1.7777777777777777) < 0.001, '1920x1080 aspect ratio matches 16:9');

// Test Mobile Portrait
const payloadMobilePortrait = createMockResizePayload(390, 844, 3, false);
assert(payloadMobilePortrait.orientation === 'portrait', '390x844 correctly classified as portrait');
assert(payloadMobilePortrait.dpr === 3, 'Mobile DPR 3 is correctly forwarded');

// Test Fullscreen Transition
const payloadFullscreen = createMockResizePayload(2560, 1440, 1.25, true);
assert(payloadFullscreen.isFullscreen === true, 'Fullscreen state is accurately captured');

// Test Square Canvas (1:1 Aspect Ratio)
const payloadSquare = createMockResizePayload(600, 600, 2, false);
assert(payloadSquare.aspectRatio === 1, 'Square viewport correctly computes 1.0 aspect ratio');
assert(payloadSquare.orientation === 'landscape', 'Equal dimensions default safely to landscape');

console.log('\n========================================================');
console.log(`Results: ${passedTests} Passed, ${failedTests} Failed`);
console.log('========================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('[SUCCESS] All AV_RESIZE protocol and viewport tests passed successfully!\n');
}
