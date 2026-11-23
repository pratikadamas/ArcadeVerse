/**
 * Test Suite for ArcadeVerse Serverless GitHub Gist Cloud Sync Engine (#1111)
 *
 * Verifies:
 * - Save state serialization (av_* keys, settings, high scores)
 * - Schema and payload security validation (prototype pollution, type checking, limits)
 * - Obfuscated token storage and retrieval (sessionStorage / localStorage)
 * - Gist ID extraction and normalization from raw IDs and URLs
 * - Mocked client-side backup (POST/PATCH) and cross-device restore (GET)
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createTestEnvironment(initialLocalStorage = {}, mockFetchHandler = null) {
  const localStore = new Map(Object.entries(initialLocalStorage));
  const sessionStore = new Map();

  const context = {
    Date,
    Math,
    Number,
    String,
    Array,
    Object,
    Buffer,
    btoa: (str) => Buffer.from(str, 'binary').toString('base64'),
    atob: (b64) => Buffer.from(b64, 'base64').toString('binary'),
    setTimeout,
    clearTimeout,
    console: { log() {}, warn() {}, error() {} },
    localStorage: {
      length: localStore.size,
      key: (i) => Array.from(localStore.keys())[i] || null,
      getItem: (k) => localStore.get(k) || null,
      setItem: (k, v) => {
        localStore.set(k, String(v));
        context.localStorage.length = localStore.size;
      },
      removeItem: (k) => {
        localStore.delete(k);
        context.localStorage.length = localStore.size;
      }
    },
    sessionStorage: {
      getItem: (k) => sessionStore.get(k) || null,
      setItem: (k, v) => sessionStore.set(k, String(v)),
      removeItem: (k) => sessionStore.delete(k)
    },
    fetch: mockFetchHandler || (async () => ({ ok: false, status: 500 }))
  };

  context.self = context;
  context.window = context;

  const code = fs.readFileSync(path.join(__dirname, '../assets/js/gist-cloud-sync.js'), 'utf8');
  vm.runInNewContext(code, context);

  return {
    sync: context.GistCloudSync,
    localStore: localStore,
    sessionStore: sessionStore
  };
}

test('Serializes av_* game saves, settings, and high scores while protecting credentials', () => {
  const initialData = {
    'av_astro-courier_highScore': '4500',
    'av_chrono-shift_checkpoint': 'level-5',
    'arcadeverse_dda_mode': 'adaptive',
    'arcadeverse_gist_pat_enc': 'SECRET_TOKEN_DO_NOT_EXPORT',
    'unrelated_site_key': 'ignore_me'
  };

  const { sync } = createTestEnvironment(initialData);
  const payload = sync.serialize();

  assert.equal(payload.app, 'ArcadeVerse');
  assert.equal(payload.version, '1.2.0');
  assert.equal(typeof payload.exportedAt, 'string');
  assert.ok(payload.data['av_astro-courier_highScore'], 'Must contain av_ keys');
  assert.ok(payload.data['av_chrono-shift_checkpoint'], 'Must contain game progress');
  assert.ok(payload.data['arcadeverse_dda_mode'], 'Must contain settings');
  assert.equal(payload.data['unrelated_site_key'], undefined, 'Must ignore unrelated keys');
  assert.equal(payload.data['arcadeverse_gist_pat_enc'], undefined, 'Must never leak token');
});

test('Validates payload schema and rejects corrupted or malicious structures', () => {
  const { sync } = createTestEnvironment();

  // Valid payload
  const valid = sync.validate({
    app: 'ArcadeVerse',
    data: {
      'av_game_score': '100',
      'av_favorites': '["asteroid-miner"]'
    }
  });
  assert.equal(valid.isValid, true);
  assert.equal(valid.sanitized['av_game_score'], '100');

  // Reject non-object or null
  assert.equal(sync.validate(null).isValid, false);
  assert.equal(sync.validate('invalid json').isValid, false);
  assert.equal(sync.validate([]).isValid, false);

  // Reject empty payload
  assert.equal(sync.validate({ data: {} }).isValid, false);

  // Prototype pollution guard
  const polluted = sync.validate({
    data: {
      '__proto__': 'malicious',
      'constructor': 'malicious',
      'av_valid_key': 'clean'
    }
  });
  assert.equal(polluted.isValid, true);
  assert.equal(polluted.sanitized['av_valid_key'], 'clean');
  assert.equal(Object.prototype.hasOwnProperty.call(polluted.sanitized, '__proto__'), false);
  assert.equal(polluted.sanitized.constructor, undefined);
});

test('Manages and obfuscates GitHub PAT securely', () => {
  const { sync, sessionStore, localStore } = createTestEnvironment();

  // Ephemeral sessionStorage by default
  sync.setToken('ghp_test_token_123', false);
  assert.equal(sync.getToken(), 'ghp_test_token_123');
  assert.equal(sessionStore.get('arcadeverse_gist_pat'), 'ghp_test_token_123');
  assert.equal(localStore.has('arcadeverse_gist_pat_enc'), false);

  // Persisted token with obfuscation
  sync.setToken('ghp_test_token_456', true);
  assert.equal(sync.getToken(), 'ghp_test_token_456');
  assert.ok(localStore.has('arcadeverse_gist_pat_enc'));
  // Token in local storage must be obfuscated, not raw plaintext
  assert.notEqual(localStore.get('arcadeverse_gist_pat_enc'), 'ghp_test_token_456');

  // Clear token
  sync.clearToken();
  assert.equal(sync.getToken(), '');
  assert.equal(sessionStore.has('arcadeverse_gist_pat'), false);
  assert.equal(localStore.has('arcadeverse_gist_pat_enc'), false);
});

test('Performs serverless cloud backup to GitHub Gist via HTTPS REST API', async () => {
  let capturedRequest = null;
  const mockGistResponse = {
    id: 'a1b2c3d4e5f678901234567890abcdef',
    html_url: 'https://gist.github.com/a1b2c3d4e5f678901234567890abcdef',
    updated_at: '2026-11-20T19:00:00Z',
    files: {
      'arcadeverse-backup.json': {
        content: '{"app":"ArcadeVerse","data":{"av_score":"999"}}'
      }
    }
  };

  const mockFetch = async (url, options) => {
    capturedRequest = { url, options };
    return {
      ok: true,
      status: 201,
      json: async () => mockGistResponse
    };
  };

  const { sync, localStore } = createTestEnvironment(
    { 'av_test_key': 'high_score_100' },
    mockFetch
  );

  sync.setToken('ghp_mock_token_for_test', false);
  const result = await sync.backupToGist();

  assert.equal(result.success, true);
  assert.equal(result.gistId, 'a1b2c3d4e5f678901234567890abcdef');
  assert.ok(result.timestamp);
  assert.equal(capturedRequest.url, 'https://api.github.com/gists');
  assert.equal(capturedRequest.options.method, 'POST');
  assert.equal(capturedRequest.options.headers['Authorization'], 'Bearer ghp_mock_token_for_test');

  const parsedBody = JSON.parse(capturedRequest.options.body);
  assert.equal(parsedBody.public, false, 'Must create private Gist');
  assert.ok(parsedBody.files['arcadeverse-backup.json'], 'Must include backup filename');
  assert.equal(localStore.get('arcadeverse_last_gist_id'), 'a1b2c3d4e5f678901234567890abcdef');
});

test('Restores save state from Gist ID across devices and writes atomically', async () => {
  const mockGistContent = {
    app: 'ArcadeVerse',
    version: '1.2.0',
    data: {
      'av_astro-courier_highScore': '9999',
      'av_favorites': '["astro-courier_joitapaul"]',
      'arcadeverse_dda_mode': 'adaptive'
    }
  };

  const mockFetch = async (url, options) => {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        id: 'fedcba09876543210987654321fedcba',
        files: {
          'arcadeverse-backup.json': {
            content: JSON.stringify(mockGistContent)
          }
        }
      })
    };
  };

  const { sync, localStore } = createTestEnvironment({}, mockFetch);

  const result = await sync.restoreFromGist('https://gist.github.com/testuser/fedcba09876543210987654321fedcba');

  assert.equal(result.success, true);
  assert.equal(result.keysRestored, 3);
  assert.equal(localStore.get('av_astro-courier_highScore'), '9999');
  assert.equal(localStore.get('av_favorites'), '["astro-courier_joitapaul"]');
  assert.equal(localStore.get('arcadeverse_dda_mode'), 'adaptive');
  assert.equal(localStore.get('arcadeverse_last_gist_id'), 'fedcba09876543210987654321fedcba');
});
