/**
 * Automated Unit Test Suite for ArcadeCardPreviewPopover
 * Issue #1498 - Mini Game Preview Popover on Card Hover and Long-Press
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const popover = require('../assets/js/card-preview-popover.js');

const SAMPLE_REGISTRY = [
  {
    id: 'cyber-snake_babin',
    title: 'Cyber Snake',
    author: 'Babin Bid',
    category: 'Arcade',
    difficulty: 'Medium',
    description: 'Classic neon snake arcade challenge with keyboard arrow controls.',
    tags: ['arcade', 'retro', 'keyboard']
  }
];

test('ArcadeCardPreviewPopover exports required API methods and delay constants', () => {
  assert.equal(popover.HOVER_DELAY_MS, 400);
  assert.equal(popover.LONG_PRESS_MS, 480);
  assert.equal(typeof popover.computePopoverPosition, 'function');
  assert.equal(typeof popover.extractGameMetadata, 'function');
  assert.equal(typeof popover.scheduleShow, 'function');
  assert.equal(typeof popover.hidePopover, 'function');
});

test('computePopoverPosition flips to left when right edge would overflow viewport', () => {
  // Card on left side -> places popover on right
  const rightPos = popover.computePopoverPosition(
    { left: 40, right: 300, top: 120, bottom: 340 },
    { width: 286, height: 210 },
    { width: 1280, height: 720 }
  );
  assert.equal(rightPos.flippedLeft, false);
  assert.equal(rightPos.left, 312);
  assert.equal(rightPos.top, 120);

  // Card near right edge -> flips to left side of card
  const flippedPos = popover.computePopoverPosition(
    { left: 960, right: 1240, top: 600, bottom: 820 },
    { width: 286, height: 210 },
    { width: 1280, height: 720 }
  );
  assert.equal(flippedPos.flippedLeft, true);
  assert.ok(flippedPos.left < 960);
  assert.ok(flippedPos.top <= 720 - 210 - 10, 'Top must clamp within vertical viewport');
});

test('extractGameMetadata populates title, author, difficulty, and control icons from registry', () => {
  const meta = popover.extractGameMetadata('cyber-snake_babin', null, SAMPLE_REGISTRY);
  assert.equal(meta.title, 'Cyber Snake');
  assert.equal(meta.author, 'Babin Bid');
  assert.equal(meta.category, 'Arcade');
  assert.equal(meta.difficulty, 'Medium');
  assert.equal(meta.controls.keyboard, true);
  assert.equal(meta.controls.gamepad, true);
});

test('scheduleShow and hidePopover manage hover delay timer and clean dismissal', () => {
  popover.scheduleShow(null, 400);
  assert.equal(popover.getState().hasPendingTimer, true);

  popover.hidePopover();
  assert.equal(popover.getState().hasPendingTimer, false);
  assert.equal(popover.getState().isVisible, false);
});

test('Ensures zero Unicode emojis across all card-preview-popover files', () => {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;

  const filesToCheck = [
    'assets/js/card-preview-popover.js',
    'assets/css/card-preview-popover.css',
    'scripts/test-card-preview-popover.js'
  ];

  for (const relPath of filesToCheck) {
    const fullPath = path.join(__dirname, '..', relPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.equal(emojiRegex.test(content), false, `Found forbidden Unicode emoji in ${relPath}`);
  }
});
