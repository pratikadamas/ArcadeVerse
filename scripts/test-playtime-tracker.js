/**
 * Automated Unit Test Suite for ArcadePlaytimeTracker
 * Issue #1497 - Session Playtime Stopwatch & Rest Reminder Toast Notification
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

function createMockStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); }
  };
}

global.localStorage = createMockStorage();

const tracker = require('../assets/js/playtime-tracker.js');

test('ArcadePlaytimeTracker exports required API methods and constants', () => {
  assert.equal(tracker.STORAGE_KEY, 'arcadeverse_playtime_pref');
  assert.deepEqual(tracker.ALLOWED_INTERVALS, [20, 30, 45, 60, 0]);
  assert.equal(tracker.DEFAULT_INTERVAL_MIN, 30);
  assert.equal(typeof tracker.formatDuration, 'function');
  assert.equal(typeof tracker.tick, 'function');
  assert.equal(typeof tracker.snoozeReminder, 'function');
  assert.equal(typeof tracker.dismissReminder, 'function');
  assert.equal(typeof tracker.setIntervalPreference, 'function');
});

test('formatDuration formats seconds into MM:SS and H:MM:SS cleanly', () => {
  assert.equal(tracker.formatDuration(0), '00:00');
  assert.equal(tracker.formatDuration(65), '01:05');
  assert.equal(tracker.formatDuration(1800), '30:00');
  assert.equal(tracker.formatDuration(3665), '1:01:05');
});

test('tick increments active time on visible tab and pauses when tab is hidden', () => {
  global.localStorage.clear();
  tracker.resetForTest();

  const r1 = tracker.tick('visible');
  assert.equal(r1.sessionSeconds, 1);
  assert.equal(r1.paused, false);

  const r2 = tracker.tick('hidden');
  assert.equal(r2.sessionSeconds, 1, 'Hidden tab must pause stopwatch');
  assert.equal(r2.paused, true);

  const r3 = tracker.tick('visible');
  assert.equal(r3.sessionSeconds, 2);
  assert.equal(r3.paused, false);
});

test('Rest reminder triggers at configured interval and supports 10-minute snooze', () => {
  global.localStorage.clear();
  tracker.resetForTest();
  tracker.setIntervalPreference(20); // 20 mins = 1200s

  // Advance 1199 visible ticks -> no reminder yet
  for (let i = 0; i < 1199; i++) {
    const res = tracker.tick('visible');
    assert.equal(res.reminderTriggered, false);
  }

  // 1200th tick -> triggers reminder
  const triggerRes = tracker.tick('visible');
  assert.equal(triggerRes.sessionSeconds, 1200);
  assert.equal(triggerRes.reminderTriggered, true);
  assert.equal(tracker.getState().isReminderVisible, true);

  // Snooze 10m -> hides reminder and schedules next at 1200 + 600 = 1800s
  const nextAt = tracker.snoozeReminder(10);
  assert.equal(nextAt, 1800);
  assert.equal(tracker.getState().isReminderVisible, false);

  // Preference persists in localStorage
  const saved = JSON.parse(global.localStorage.getItem('arcadeverse_playtime_pref'));
  assert.equal(saved.intervalMinutes, 20);
});

test('Ensures zero Unicode emojis across all playtime-tracker files', () => {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;

  const filesToCheck = [
    'assets/js/playtime-tracker.js',
    'assets/css/playtime-tracker.css',
    'scripts/test-playtime-tracker.js'
  ];

  for (const relPath of filesToCheck) {
    const fullPath = path.join(__dirname, '..', relPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.equal(emojiRegex.test(content), false, `Found forbidden Unicode emoji in ${relPath}`);
  }
});
