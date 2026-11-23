/**
 * ArcadeVerse Service Worker Syntax & Caching Architecture Test Suite (#1181)
 *
 * Validates that sw.js is free from syntax errors, defines all required cache constants,
 * properly handles W3C Service Worker lifecycle events (install, activate, fetch, sync, message),
 * and contains no undeclared legacy identifiers.
 *
 * Usage:
 *   node scripts/test-service-worker-syntax.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('\n========================================================');
console.log('   ArcadeVerse Service Worker Syntax & Integrity Test');
console.log('========================================================\n');

const ROOT_DIR = path.resolve(__dirname, '..');
const SW_PATH = path.join(ROOT_DIR, 'sw.js');

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

// 1. File existence
assert(fs.existsSync(SW_PATH), 'sw.js file exists in repository root');

// 2. Syntax compilation with Node.js CLI (-c flag)
try {
  execSync(`node -c "${SW_PATH}"`, { stdio: 'pipe' });
  assert(true, 'sw.js passes Node.js syntax compiler check (zero syntax errors)');
} catch (err) {
  const errMsg = err.stderr ? err.stderr.toString().trim() : err.message;
  assert(false, 'sw.js passes Node.js syntax compiler check (zero syntax errors)', errMsg);
}

// 3. Static code analysis
const content = fs.readFileSync(SW_PATH, 'utf8');

// Required Cache Constants
assert(content.includes('const SHELL_CACHE ='), 'SHELL_CACHE constant is declared');
assert(content.includes('const RUNTIME_CACHE ='), 'RUNTIME_CACHE constant is declared');
assert(content.includes('const GAME_VAULT_CACHE ='), 'GAME_VAULT_CACHE constant is declared');
assert(content.includes('const GAME_CACHE_PREFIX ='), 'GAME_CACHE_PREFIX constant is declared');
assert(content.includes('const SHELL_ASSETS ='), 'SHELL_ASSETS array is declared');

// Elimination of Undeclared Identifier Bugs
assert(!content.includes('CORE_SHELL_ASSETS'), 'No references to undeclared CORE_SHELL_ASSETS');
assert(!content.includes('STATIC_CACHE_NAME'), 'No references to undeclared STATIC_CACHE_NAME');

// W3C Service Worker Lifecycle Handlers
assert(content.includes("addEventListener('install'"), 'install event listener is registered');
assert(content.includes("addEventListener('activate'"), 'activate event listener is registered');
assert(content.includes("addEventListener('fetch'"), 'fetch event listener is registered');
assert(content.includes("addEventListener('sync'"), 'Background Sync event listener is registered');
assert(content.includes("addEventListener('message'"), 'message lifecycle listener is registered');

// Cache Bucket & Offline Strategies
assert(content.includes('cache.addAll(SHELL_ASSETS)'), 'install precaches SHELL_ASSETS');
assert(content.includes('clients.claim()'), 'activate claims clients immediately');
assert(content.includes('skipWaiting'), 'skipWaiting command is handled in message listener');
assert(content.includes('AV_EVICT_GAME_CACHES'), 'AV_EVICT_GAME_CACHES LRU command is handled');

console.log('\n========================================================');
console.log(`Results: ${passedTests} Passed, ${failedTests} Failed`);
console.log('========================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('[SUCCESS] All Service Worker syntax and integrity checks passed!\n');
}
