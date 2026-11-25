/**
 * Automated Unit Test Suite for ArcadePlaylistShare
 * Issue #1098 - Curated Game Playlist Export via Base64 URL & Dynamic QR Code Sharing
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const shareEngine = require('../assets/js/playlist-share-engine.js');

test('ArcadePlaylistShare exports all required API methods', () => {
  assert.equal(shareEngine.HASH_PREFIX, '#playlist=');
  assert.equal(typeof shareEngine.encodePlaylistToken, 'function');
  assert.equal(typeof shareEngine.buildShareUrl, 'function');
  assert.equal(typeof shareEngine.decodePlaylistFromHash, 'function');
  assert.equal(typeof shareEngine.validateAgainstRegistry, 'function');
  assert.equal(typeof shareEngine.encodeQrMatrix, 'function');
  assert.equal(typeof shareEngine.generateQrSvg, 'function');
  assert.equal(typeof shareEngine.downloadQrCard, 'function');
  assert.equal(typeof shareEngine.openShareModal, 'function');
  assert.equal(typeof shareEngine.closeShareModal, 'function');
  assert.equal(typeof shareEngine.checkBootHash, 'function');
});

test('encodePlaylistToken and decodePlaylistFromHash roundtrip UTF-8 playlist titles and deduplicated IDs', () => {
  const playlist = {
    name: 'Top 5 Speedruns',
    games: ['cyber-snake_babin', 'quantum-2048_babin', 'cyber-snake_babin', 'whack-a-bug_babin']
  };

  const url = shareEngine.buildShareUrl(playlist, 'https://debasmitabose0.github.io/ArcadeVerse/');
  assert.ok(url.startsWith('https://debasmitabose0.github.io/ArcadeVerse/#playlist='));
  const token = url.split('#playlist=')[1];
  assert.ok(!token.includes('+'));
  assert.ok(!token.includes('/')); // URL-safe base64 check on token

  const decoded = shareEngine.decodePlaylistFromHash(url);
  assert.ok(decoded);
  assert.equal(decoded.title, 'Top 5 Speedruns');
  assert.deepEqual(decoded.games, ['cyber-snake_babin', 'quantum-2048_babin', 'whack-a-bug_babin']);
});

test('decodePlaylistFromHash rejects malformed or corrupted tokens', () => {
  assert.equal(shareEngine.decodePlaylistFromHash('#other=123'), null);
  assert.throws(() => shareEngine.decodePlaylistFromHash('#playlist=!!!invalid!!!'));
  assert.throws(() => shareEngine.decodePlaylistFromHash('#playlist=YWJj')); // valid b64 but not JSON
});

test('validateAgainstRegistry filters valid games and reports missing IDs cleanly', () => {
  const fakeRegistry = [
    { id: 'cyber-snake_babin', title: 'Cyber Snake' },
    { id: 'quantum-2048_babin', title: 'Quantum 2048' }
  ];

  const validated = shareEngine.validateAgainstRegistry(
    { title: 'Best Picks', games: ['cyber-snake_babin', 'non-existent-game', 'quantum-2048_babin'] },
    fakeRegistry
  );

  assert.equal(validated.title, 'Best Picks');
  assert.deepEqual(validated.validGames, ['cyber-snake_babin', 'quantum-2048_babin']);
  assert.deepEqual(validated.missingGames, ['non-existent-game']);
  assert.equal(validated.matchedEntries.length, 2);
});

test('encodeQrMatrix and generateQrSvg produce valid square QR matrix and crisp vector SVG', () => {
  const sampleUrl = 'https://debasmitabose0.github.io/ArcadeVerse/#playlist=eyJ0aXRsZSI6IlRlc3QiLCJnYW1lcyI6WyJjeWJlci1zbmFrZV9iYWJpbiJdfQ';
  const matrix = shareEngine.encodeQrMatrix(sampleUrl);

  assert.ok(Array.isArray(matrix));
  assert.ok(matrix.length >= 21, 'QR matrix must be at least Version 1 (21x21)');
  assert.equal(matrix.length, matrix[0].length, 'QR matrix must be square');
  // Top-left finder pattern corner check
  assert.equal(matrix[0][0], true);
  assert.equal(matrix[0][6], true);
  assert.equal(matrix[6][0], true);
  assert.equal(matrix[1][1], false);

  const svg = shareEngine.generateQrSvg(sampleUrl);
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(svg.includes('<path d="'));
  assert.ok(svg.endsWith('</svg>'));
});

test('Ensures zero Unicode emojis across all playlist share files', () => {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;

  const filesToCheck = [
    'assets/js/playlist-share-engine.js',
    'assets/css/playlist-share-engine.css',
    'assets/js/playlist-manager.js',
    'scripts/test-playlist-share-engine.js'
  ];

  for (const relPath of filesToCheck) {
    const fullPath = path.join(__dirname, '..', relPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.equal(emojiRegex.test(content), false, `Found forbidden Unicode emoji in ${relPath}`);
  }
});
