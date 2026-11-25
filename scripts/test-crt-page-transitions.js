/**
 * Automated Unit Test Suite for ArcadeCrtTransitions
 * Issue #1097 - Retro CRT Cathode Tube Turn-Off & Glitch Page Transitions
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const crtTransitions = require('../assets/js/crt-page-transitions.js');

test('ArcadeCrtTransitions exports all required API methods and constants', () => {
  assert.ok(crtTransitions.TRANSITION_DURATION_MS <= 300, 'Transition must adhere to <= 300ms cap');
  assert.equal(crtTransitions.TRANSITION_DURATION_MS, 250);
  assert.ok(Array.isArray(crtTransitions.HUB_PAGES));
  assert.equal(typeof crtTransitions.isReducedMotion, 'function');
  assert.equal(typeof crtTransitions.isInternalHubLink, 'function');
  assert.equal(typeof crtTransitions.shouldBypassTransition, 'function');
  assert.equal(typeof crtTransitions.triggerShutdownNavigation, 'function');
  assert.equal(typeof crtTransitions.playPowerOnIfPending, 'function');
  assert.equal(typeof crtTransitions.clearOverlay, 'function');
  assert.equal(typeof crtTransitions.init, 'function');
});

test('isInternalHubLink identifies cross-page hub links and skips anchors/external URLs', () => {
  assert.equal(crtTransitions.isInternalHubLink('leaderboard.html', '/index.html'), true);
  assert.equal(crtTransitions.isInternalHubLink('docs.html#scoring', '/index.html'), true);
  assert.equal(crtTransitions.isInternalHubLink('./faqs.html', '/docs.html'), true);

  // Same page or anchors should not trigger full CRT page transition
  assert.equal(crtTransitions.isInternalHubLink('index.html', '/index.html'), false);
  assert.equal(crtTransitions.isInternalHubLink('#games-section', '/index.html'), false);
  assert.equal(crtTransitions.isInternalHubLink('https://github.com/DebasmitaBose0/ArcadeVerse', '/index.html'), false);
  assert.equal(crtTransitions.isInternalHubLink('mailto:test@example.com', '/index.html'), false);
});

test('shouldBypassTransition respects modifier keys, non-primary mouse buttons, and target=_blank', () => {
  const validLink = {
    getAttribute: (attr) => (attr === 'href' ? 'leaderboard.html' : null),
    hasAttribute: () => false
  };

  // Normal left click on hub link -> should NOT bypass (note: currentPathname defaults to '' -> index.html)
  assert.equal(crtTransitions.shouldBypassTransition({ button: 0 }, validLink), false);

  // Modifier keys -> MUST bypass for new tab / native browser behavior
  assert.equal(crtTransitions.shouldBypassTransition({ button: 0, ctrlKey: true }, validLink), true);
  assert.equal(crtTransitions.shouldBypassTransition({ button: 0, metaKey: true }, validLink), true);
  assert.equal(crtTransitions.shouldBypassTransition({ button: 0, shiftKey: true }, validLink), true);
  assert.equal(crtTransitions.shouldBypassTransition({ button: 1 }, validLink), true); // middle click

  const blankLink = {
    getAttribute: (attr) => (attr === 'target' ? '_blank' : 'leaderboard.html'),
    hasAttribute: () => false
  };
  assert.equal(crtTransitions.shouldBypassTransition({ button: 0 }, blankLink), true);
});

test('CSS stylesheet defines CRT shutdown, power-on keyframes, and prefers-reduced-motion fallback', () => {
  const css = fs.readFileSync(path.join(__dirname, '../assets/css/crt-page-transitions.css'), 'utf8');
  assert.ok(css.includes('@keyframes crt-tube-shutdown'));
  assert.ok(css.includes('@keyframes crt-tube-poweron'));
  assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'));
  assert.ok(css.includes('250ms'));
});

test('Ensures zero Unicode emojis across all CRT transition files', () => {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;

  const filesToCheck = [
    'assets/js/crt-page-transitions.js',
    'assets/css/crt-page-transitions.css',
    'scripts/test-crt-page-transitions.js'
  ];

  for (const relPath of filesToCheck) {
    const fullPath = path.join(__dirname, '..', relPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.equal(emojiRegex.test(content), false, `Found forbidden Unicode emoji in ${relPath}`);
  }
});
