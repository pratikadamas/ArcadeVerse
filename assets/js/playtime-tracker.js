/**
 * ArcadeVerse - Session Playtime Stopwatch & Rest Reminder Toast Notification
 * Architectural Implementation for Issue #1497
 *
 * - Tracks active tab gaming time using document.visibilityState (pauses on hidden tabs).
 * - Displays subtle live stopwatch pill in the navigation bar.
 * - Configurable break reminder intervals (20m, 30m, 45m, 60m, or Off) in settings drawer.
 * - Persists preferences and daily stats in localStorage ('arcadeverse_playtime_pref').
 * - Non-blocking reminder toast with "Snooze 10m" and "Dismiss" actions.
 * - 100% Vanilla JS; zero external libraries.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ArcadePlaytimeTracker = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STORAGE_KEY = 'arcadeverse_playtime_pref';
  var ALLOWED_INTERVALS = [20, 30, 45, 60, 0];
  var DEFAULT_INTERVAL_MIN = 30;
  var SNOOZE_MINUTES = 10;

  var sessionSeconds = 0;
  var totalSecondsToday = 0;
  var intervalMinutes = DEFAULT_INTERVAL_MIN;
  var nextReminderAtSec = DEFAULT_INTERVAL_MIN * 60;
  var isReminderVisible = false;
  var isPaused = false;
  var tickIntervalId = null;

  function getTodayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function loadPreferences() {
    try {
      if (typeof localStorage !== 'undefined') {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          var parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            if (ALLOWED_INTERVALS.indexOf(Number(parsed.intervalMinutes)) !== -1) {
              intervalMinutes = Number(parsed.intervalMinutes);
            }
            if (parsed.dateKey === getTodayKey() && typeof parsed.totalSecondsToday === 'number') {
              totalSecondsToday = Math.max(0, Math.floor(parsed.totalSecondsToday));
            }
          }
        }
      }
    } catch (_) {}
    nextReminderAtSec = intervalMinutes > 0 ? intervalMinutes * 60 : Infinity;
    return { intervalMinutes: intervalMinutes, totalSecondsToday: totalSecondsToday };
  }

  function savePreferences() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          intervalMinutes: intervalMinutes,
          totalSecondsToday: totalSecondsToday,
          dateKey: getTodayKey()
        }));
      }
    } catch (_) {}
  }

  /**
   * Formats seconds into MM:SS or H:MM:SS.
   *
   * @param {number} totalSec
   * @returns {string}
   */
  function formatDuration(totalSec) {
    var sec = Math.max(0, Math.floor(Number(totalSec) || 0));
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    var mm = String(m).padStart(2, '0');
    var ss = String(s).padStart(2, '0');
    return h > 0 ? h + ':' + mm + ':' + ss : mm + ':' + ss;
  }

  /**
   * Advances stopwatch by 1 second if tab is visible; pauses when hidden.
   *
   * @param {string} [visibilityOverride] - 'visible' | 'hidden'
   * @returns {{ sessionSeconds: number, paused: boolean, reminderTriggered: boolean }}
   */
  function tick(visibilityOverride) {
    var vis = visibilityOverride !== undefined
      ? visibilityOverride
      : (typeof document !== 'undefined' && document.visibilityState ? document.visibilityState : 'visible');

    if (vis === 'hidden') {
      isPaused = true;
      updateStopwatchUI();
      return { sessionSeconds: sessionSeconds, paused: true, reminderTriggered: false };
    }

    isPaused = false;
    sessionSeconds += 1;
    totalSecondsToday += 1;

    if (sessionSeconds % 15 === 0) {
      savePreferences();
    }

    var reminderTriggered = false;
    if (intervalMinutes > 0 && sessionSeconds >= nextReminderAtSec && !isReminderVisible) {
      reminderTriggered = true;
      showRestReminder();
    }

    updateStopwatchUI();
    return {
      sessionSeconds: sessionSeconds,
      paused: false,
      reminderTriggered: reminderTriggered
    };
  }

  function setIntervalPreference(minutes) {
    var m = Number(minutes);
    if (ALLOWED_INTERVALS.indexOf(m) === -1) {
      m = DEFAULT_INTERVAL_MIN;
    }
    intervalMinutes = m;
    nextReminderAtSec = m > 0 ? sessionSeconds + m * 60 : Infinity;
    savePreferences();
    return intervalMinutes;
  }

  function snoozeReminder(snoozeMin) {
    var mins = Number(snoozeMin) || SNOOZE_MINUTES;
    nextReminderAtSec = sessionSeconds + mins * 60;
    hideRestReminder();
    return nextReminderAtSec;
  }

  function dismissReminder() {
    nextReminderAtSec = intervalMinutes > 0 ? sessionSeconds + intervalMinutes * 60 : Infinity;
    hideRestReminder();
    return nextReminderAtSec;
  }

  function ensureToastEl() {
    if (typeof document === 'undefined' || !document.body) return null;
    var existing = document.getElementById('playtime-rest-toast');
    if (existing) return existing;

    var toast = document.createElement('div');
    toast.id = 'playtime-rest-toast';
    toast.className = 'playtime-rest-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.innerHTML =
      '<div class="playtime-toast-header">' +
      '  <div class="playtime-toast-icon" aria-hidden="true">' +
      '    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
      '      <circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>' +
      '    </svg>' +
      '  </div>' +
      '  <h4 class="playtime-toast-title">Healthy Gaming Break</h4>' +
      '</div>' +
      '<p class="playtime-toast-msg" id="playtime-toast-msg"></p>' +
      '<div class="playtime-toast-actions">' +
      '  <button type="button" class="playtime-toast-btn playtime-toast-btn-snooze" id="playtime-btn-snooze">Snooze 10m</button>' +
      '  <button type="button" class="playtime-toast-btn" id="playtime-btn-dismiss">Dismiss</button>' +
      '</div>';

    document.body.appendChild(toast);

    document.getElementById('playtime-btn-snooze').addEventListener('click', function () {
      snoozeReminder(SNOOZE_MINUTES);
    });
    document.getElementById('playtime-btn-dismiss').addEventListener('click', function () {
      dismissReminder();
    });

    return toast;
  }

  function showRestReminder() {
    isReminderVisible = true;
    if (typeof document === 'undefined') return;
    var toast = ensureToastEl();
    if (!toast) return;
    var mins = Math.max(1, Math.round(sessionSeconds / 60));
    var msgEl = document.getElementById('playtime-toast-msg');
    if (msgEl) {
      msgEl.textContent = "You've been gaming for " + mins + ' minutes! Time for a quick stretch and water break.';
    }
    toast.classList.add('is-visible');
  }

  function hideRestReminder() {
    isReminderVisible = false;
    if (typeof document === 'undefined') return;
    var toast = document.getElementById('playtime-rest-toast');
    if (toast) {
      toast.classList.remove('is-visible');
    }
  }

  function updateStopwatchUI() {
    if (typeof document === 'undefined') return;
    var pill = document.getElementById('playtime-stopwatch-pill');
    var timeEl = document.getElementById('playtime-stopwatch-text');
    if (pill) {
      pill.classList.toggle('is-paused', isPaused);
      pill.setAttribute('title', 'Active session playtime' + (isPaused ? ' (Paused)' : ''));
    }
    if (timeEl) {
      timeEl.textContent = formatDuration(sessionSeconds);
    }
  }

  function renderUI() {
    if (typeof document === 'undefined') return;

    var navActions = document.querySelector('.nav-actions');
    if (navActions && !document.getElementById('playtime-stopwatch-pill')) {
      var pill = document.createElement('div');
      pill.id = 'playtime-stopwatch-pill';
      pill.className = 'playtime-stopwatch-pill';
      pill.setAttribute('aria-label', 'Active Session Playtime');
      pill.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
        '  <circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>' +
        '</svg>' +
        '<span id="playtime-stopwatch-text">00:00</span>';
      navActions.prepend(pill);
    }

    var drawerBody = document.querySelector('#a11y-drawer .a11y-drawer-body');
    if (drawerBody && !document.getElementById('playtime-settings-panel')) {
      var panel = document.createElement('div');
      panel.id = 'playtime-settings-panel';
      panel.className = 'playtime-settings-panel';
      panel.innerHTML =
        '<label class="playtime-settings-label" for="playtime-interval-select">Rest Break Reminder</label>' +
        '<select class="playtime-settings-select" id="playtime-interval-select">' +
        '  <option value="20">20 mins</option>' +
        '  <option value="30">30 mins</option>' +
        '  <option value="45">45 mins</option>' +
        '  <option value="60">60 mins</option>' +
        '  <option value="0">Off</option>' +
        '</select>';
      drawerBody.appendChild(panel);

      var sel = document.getElementById('playtime-interval-select');
      sel.value = String(intervalMinutes);
      sel.addEventListener('change', function () {
        setIntervalPreference(sel.value);
      });
    }
  }

  function start() {
    loadPreferences();
    renderUI();
    updateStopwatchUI();

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', function () {
        isPaused = document.visibilityState === 'hidden';
        updateStopwatchUI();
        if (isPaused) savePreferences();
      });
    }

    if (tickIntervalId) clearInterval(tickIntervalId);
    tickIntervalId = setInterval(function () {
      tick();
    }, 1000);
  }

  function resetForTest() {
    sessionSeconds = 0;
    totalSecondsToday = 0;
    intervalMinutes = DEFAULT_INTERVAL_MIN;
    nextReminderAtSec = DEFAULT_INTERVAL_MIN * 60;
    isReminderVisible = false;
    isPaused = false;
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start);
    } else {
      start();
    }
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    ALLOWED_INTERVALS: ALLOWED_INTERVALS,
    DEFAULT_INTERVAL_MIN: DEFAULT_INTERVAL_MIN,
    SNOOZE_MINUTES: SNOOZE_MINUTES,
    formatDuration: formatDuration,
    loadPreferences: loadPreferences,
    setIntervalPreference: setIntervalPreference,
    tick: tick,
    snoozeReminder: snoozeReminder,
    dismissReminder: dismissReminder,
    resetForTest: resetForTest,
    getState: function () {
      return {
        sessionSeconds: sessionSeconds,
        totalSecondsToday: totalSecondsToday,
        intervalMinutes: intervalMinutes,
        nextReminderAtSec: nextReminderAtSec,
        isReminderVisible: isReminderVisible,
        isPaused: isPaused
      };
    }
  };
});
