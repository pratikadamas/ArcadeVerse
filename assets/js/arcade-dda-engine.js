/**
 * ArcadeVerse Dynamic Difficulty Adjustment (DDA) Adaptive Game Supervisor Engine (#1112)
 *
 * Real-time player telemetry analysis and dynamic difficulty scaling protocol.
 * Analyzes deaths per minute, average survival time, and hit rate to smoothly
 * compute an adaptive difficulty multiplier (0.75x to 1.25x).
 * Supports player mode locking between 'Adaptive' and 'Pure Hardcore' (fixed 1.0x).
 *
 * Open Source for ArcadeVerse - NSOC Winter Edition 2026
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var instance = factory();
    root.ArcadeDDA = instance;
    if (root.ArcadeVerse) {
      root.ArcadeVerse.dda = instance;
    }
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STORAGE_KEY = 'arcadeverse_dda_mode';
  var MIN_MULTIPLIER = 0.75;
  var MAX_MULTIPLIER = 1.25;
  var BASELINE_MULTIPLIER = 1.0;
  var RAPID_DEATH_WINDOW_MS = 30000; // 30 seconds
  var RAPID_DEATH_THRESHOLD = 3;     // 3 deaths in 30 seconds
  var LERP_RATE = 0.85;              // Exponential smoothing convergence rate

  // State
  var mode = 'adaptive'; // 'adaptive' | 'hardcore'
  var currentMultiplier = 1.0;
  var targetMultiplier = 1.0;
  var lastQueryTime = Date.now();
  var sessionStartTime = Date.now();
  var currentSurvivalStart = Date.now();
  var deathTimestamps = [];
  var survivalDurations = [];
  var totalHits = 0;
  var totalMisses = 0;
  var changeSubscribers = [];
  var isControlsMounted = false;

  // Initialize persisted user preference
  try {
    if (typeof localStorage !== 'undefined') {
      var savedMode = localStorage.getItem(STORAGE_KEY);
      if (savedMode === 'hardcore' || savedMode === 'adaptive') {
        mode = savedMode;
      }
    }
  } catch (_) {}

  /**
   * Helper: Clamp a numeric value between min and max
   */
  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  /**
   * Helper: Round number to 2 decimal places
   */
  function round2(val) {
    return Math.round(val * 100) / 100;
  }

  /**
   * Calculates ideal target multiplier from current telemetry
   * @returns {number} Target multiplier in [0.75, 1.25]
   */
  function computeTargetMultiplier() {
    if (mode === 'hardcore') {
      return BASELINE_MULTIPLIER;
    }

    var now = Date.now();

    // 1. Rapid Death Detection (Beginner relief: >= 3 deaths in 30 seconds)
    var recent30sDeaths = 0;
    for (var i = deathTimestamps.length - 1; i >= 0; i--) {
      if (now - deathTimestamps[i] <= RAPID_DEATH_WINDOW_MS) {
        recent30sDeaths++;
      } else {
        break;
      }
    }

    if (recent30sDeaths >= RAPID_DEATH_THRESHOLD) {
      // Immediate relief scaling: dials difficulty down to minimum
      return MIN_MULTIPLIER;
    }

    // 2. Deaths Per Minute (DPM) calculation
    var deathsInLast60s = 0;
    for (var j = deathTimestamps.length - 1; j >= 0; j--) {
      if (now - deathTimestamps[j] <= 60000) {
        deathsInLast60s++;
      } else {
        break;
      }
    }

    var sessionMinutes = Math.max(0.5, (now - sessionStartTime) / 60000);
    var dpm = deathsInLast60s > 0 ? deathsInLast60s : (deathTimestamps.length / sessionMinutes);

    // 3. Average Survival Time
    var totalSurvivalSeconds = 0;
    for (var s = 0; s < survivalDurations.length; s++) {
      totalSurvivalSeconds += survivalDurations[s];
    }
    // Include current ongoing life duration
    var currentLifeSeconds = Math.max(0, (now - currentSurvivalStart) / 1000);
    totalSurvivalSeconds += currentLifeSeconds;
    var survivalCount = survivalDurations.length + 1;
    var avgSurvival = totalSurvivalSeconds / survivalCount;

    // 4. Hit Rate / Accuracy ratio
    var totalAttempts = totalHits + totalMisses;
    var hitRate = totalAttempts > 0 ? (totalHits / totalAttempts) : 0.5;

    // 5. Synthesize composite difficulty delta
    var delta = 0.0;

    // DPM influence (-0.20 to +0.10)
    if (dpm >= 4.0) {
      delta -= 0.20;
    } else if (dpm >= 2.5) {
      delta -= 0.12;
    } else if (dpm >= 1.5) {
      delta -= 0.05;
    } else if (dpm === 0 && sessionMinutes >= 0.75) {
      delta += 0.10;
    }

    // Survival time influence (-0.10 to +0.10)
    if (avgSurvival < 12) {
      delta -= 0.08;
    } else if (avgSurvival < 20) {
      delta -= 0.04;
    } else if (avgSurvival > 60) {
      delta += 0.08;
    } else if (avgSurvival > 40) {
      delta += 0.04;
    }

    // Hit rate influence (-0.08 to +0.08)
    if (totalAttempts >= 6) {
      if (hitRate >= 0.85) {
        delta += 0.08;
      } else if (hitRate >= 0.70) {
        delta += 0.04;
      } else if (hitRate <= 0.25) {
        delta -= 0.08;
      } else if (hitRate <= 0.40) {
        delta -= 0.04;
      }
    }

    var computed = BASELINE_MULTIPLIER + delta;
    return clamp(computed, MIN_MULTIPLIER, MAX_MULTIPLIER);
  }

  /**
   * Applies smooth time-based interpolation toward target multiplier
   */
  function updateSmoothing() {
    var now = Date.now();
    var dt = Math.min(1.0, Math.max(0.016, (now - lastQueryTime) / 1000));
    lastQueryTime = now;

    targetMultiplier = computeTargetMultiplier();

    if (mode === 'hardcore') {
      // Return smoothly to baseline 1.0
      currentMultiplier += (BASELINE_MULTIPLIER - currentMultiplier) * Math.min(1.0, dt * 2.0);
      if (Math.abs(currentMultiplier - BASELINE_MULTIPLIER) < 0.005) {
        currentMultiplier = BASELINE_MULTIPLIER;
      }
    } else {
      // Exponential smoothing interpolation
      var step = dt * LERP_RATE;
      currentMultiplier += (targetMultiplier - currentMultiplier) * Math.min(1.0, step);
    }

    currentMultiplier = clamp(currentMultiplier, MIN_MULTIPLIER, MAX_MULTIPLIER);
  }

  /**
   * Notifies all registered subscribers of multiplier changes
   */
  function notifySubscribers() {
    var data = ArcadeDDA.getTelemetry();
    for (var i = 0; i < changeSubscribers.length; i++) {
      try {
        changeSubscribers[i](data.currentMultiplier, data);
      } catch (_) {}
    }
  }

  /**
   * Dispatches state to child game iframe via window.postMessage
   */
  function broadcastToIframe() {
    try {
      if (typeof window !== 'undefined') {
        var frame = document.getElementById('game-iframe');
        if (frame && frame.contentWindow) {
          frame.contentWindow.postMessage({
            type: 'ARCADEVERSE_DDA_CONFIG',
            payload: {
              mode: mode,
              enabled: mode === 'adaptive',
              multiplier: round2(currentMultiplier),
              targetMultiplier: round2(targetMultiplier)
            }
          }, '*');
        }
      }
    } catch (_) {}
  }

  var ArcadeDDA = {
    /**
     * Primary SDK API: Returns the current smoothed adaptive difficulty multiplier.
     * Scales between 0.75x and 1.25x in Adaptive mode, or exactly 1.0x in Hardcore mode.
     * @returns {number} Smoothed modifier e.g. 0.88
     */
    getAdaptiveMultiplier: function () {
      updateSmoothing();
      return round2(currentMultiplier);
    },

    /**
     * Alias for getAdaptiveMultiplier()
     */
    getMultiplier: function () {
      return this.getAdaptiveMultiplier();
    },

    /**
     * Reports a player death event to the DDA supervisor.
     * Updates death frequency metrics and checks for rapid beginner failures.
     */
    recordDeath: function () {
      var now = Date.now();
      deathTimestamps.push(now);

      var survivalSec = Math.max(0.5, (now - currentSurvivalStart) / 1000);
      survivalDurations.push(survivalSec);
      currentSurvivalStart = now;

      // Keep only recent death history (last 5 minutes)
      while (deathTimestamps.length > 50 || (deathTimestamps.length > 0 && now - deathTimestamps[0] > 300000)) {
        deathTimestamps.shift();
      }

      // Check if beginner died 3 times in 30 seconds
      var rapidDeaths = 0;
      for (var i = deathTimestamps.length - 1; i >= 0; i--) {
        if (now - deathTimestamps[i] <= RAPID_DEATH_WINDOW_MS) {
          rapidDeaths++;
        } else {
          break;
        }
      }

      if (rapidDeaths >= RAPID_DEATH_THRESHOLD) {
        targetMultiplier = MIN_MULTIPLIER;
      }

      updateSmoothing();
      notifySubscribers();
      broadcastToIframe();
    },

    /**
     * Reports a shot/hit or evasion event to compute player hit rate.
     * @param {boolean} [isHit=true] - True if shot hit target or obstacle evaded
     */
    recordHit: function (isHit) {
      if (isHit !== false) {
        totalHits++;
      } else {
        totalMisses++;
      }

      updateSmoothing();
      notifySubscribers();
    },

    /**
     * Sets the active supervisor mode: 'adaptive' or 'hardcore'
     * @param {string} newMode - 'adaptive' | 'hardcore'
     */
    setMode: function (newMode) {
      var normalized = String(newMode).toLowerCase();
      if (normalized === 'hardcore' || normalized === 'pure_hardcore') {
        mode = 'hardcore';
      } else {
        mode = 'adaptive';
      }

      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, mode);
        }
      } catch (_) {}

      updateSmoothing();
      this.updateButtonUI();
      notifySubscribers();
      broadcastToIframe();

      // Announce mode switch for screen readers
      if (typeof window !== 'undefined' && typeof window.announceToScreenReader === 'function') {
        var msg = mode === 'adaptive'
          ? 'Dynamic Balancing enabled: Adaptive mode active.'
          : 'Dynamic Balancing locked: Pure Hardcore mode active.';
        window.announceToScreenReader(msg);
      }
    },

    /**
     * Returns current operational mode ('adaptive' or 'hardcore')
     * @returns {string}
     */
    getMode: function () {
      return mode;
    },

    /**
     * Checks if dynamic adaptive scaling is active
     * @returns {boolean}
     */
    isEnabled: function () {
      return mode === 'adaptive';
    },

    /**
     * Toggles between Adaptive and Pure Hardcore
     * @returns {string} The new mode
     */
    toggleMode: function () {
      this.setMode(mode === 'adaptive' ? 'hardcore' : 'adaptive');
      return mode;
    },

    /**
     * Returns full supervisor telemetry breakdown
     * @returns {Object} Telemetry snapshot
     */
    getTelemetry: function () {
      var now = Date.now();
      var sessionMinutes = Math.max(0.1, (now - sessionStartTime) / 60000);
      var deathsLast60s = 0;
      var deathsLast30s = 0;

      for (var i = deathTimestamps.length - 1; i >= 0; i--) {
        var age = now - deathTimestamps[i];
        if (age <= 60000) deathsLast60s++;
        if (age <= 30000) deathsLast30s++;
      }

      var totalAttempts = totalHits + totalMisses;
      var hitRate = totalAttempts > 0 ? round2(totalHits / totalAttempts) : 0.5;

      var totalSurvival = 0;
      for (var s = 0; s < survivalDurations.length; s++) {
        totalSurvival += survivalDurations[s];
      }
      totalSurvival += Math.max(0, (now - currentSurvivalStart) / 1000);
      var avgSurvival = round2(totalSurvival / (survivalDurations.length + 1));

      return {
        mode: mode,
        enabled: mode === 'adaptive',
        currentMultiplier: round2(currentMultiplier),
        targetMultiplier: round2(targetMultiplier),
        deathsPerMinute: round2(deathsLast60s > 0 ? deathsLast60s : (deathTimestamps.length / sessionMinutes)),
        deathsInLast30s: deathsLast30s,
        totalDeaths: deathTimestamps.length,
        averageSurvivalSeconds: avgSurvival,
        hitRate: hitRate,
        totalHits: totalHits,
        totalMisses: totalMisses,
        sessionDurationSeconds: round2((now - sessionStartTime) / 1000)
      };
    },

    /**
     * Resets telemetry metrics for a new game session
     */
    reset: function () {
      var now = Date.now();
      sessionStartTime = now;
      currentSurvivalStart = now;
      lastQueryTime = now;
      deathTimestamps = [];
      survivalDurations = [];
      totalHits = 0;
      totalMisses = 0;
      targetMultiplier = mode === 'hardcore' ? BASELINE_MULTIPLIER : 1.0;
      currentMultiplier = targetMultiplier;
      this.updateButtonUI();
      broadcastToIframe();
    },

    /**
     * Subscribes to real-time multiplier adjustments
     * @param {Function} callback - Receives (multiplier, telemetry)
     * @returns {Function} Unsubscribe function
     */
    onMultiplierChange: function (callback) {
      if (typeof callback !== 'function') return function () {};
      changeSubscribers.push(callback);
      return function () {
        var idx = changeSubscribers.indexOf(callback);
        if (idx !== -1) changeSubscribers.splice(idx, 1);
      };
    },

    /**
     * Injects CSS stylesheet dynamically if not present
     */
    injectStyles: function () {
      if (typeof document === 'undefined') return;
      if (document.getElementById('arcade-dda-styles')) return;

      var link = document.createElement('link');
      link.id = 'arcade-dda-styles';
      link.rel = 'stylesheet';
      link.href = 'assets/css/arcade-dda-engine.css';
      document.head.appendChild(link);
    },

    /**
     * Mounts the Dynamic Balancing toggle into the modal controls toolbar
     */
    mountControls: function () {
      if (typeof document === 'undefined') return;
      var modalControls = document.querySelector('.modal-controls');
      if (!modalControls) return;

      this.injectStyles();

      if (document.getElementById('modal-dda-btn')) {
        this.updateButtonUI();
        return;
      }

      var ddaBtn = document.createElement('button');
      ddaBtn.id = 'modal-dda-btn';
      ddaBtn.type = 'button';
      ddaBtn.className = 'btn btn-sm btn-icon modal-dda-btn';

      var self = this;
      ddaBtn.addEventListener('click', function (e) {
        e.preventDefault();
        self.toggleMode();
      });

      // Insert before close-modal-btn or append
      var closeBtn = document.getElementById('close-modal-btn');
      if (closeBtn && closeBtn.parentNode === modalControls) {
        modalControls.insertBefore(ddaBtn, closeBtn);
      } else {
        modalControls.appendChild(ddaBtn);
      }

      isControlsMounted = true;
      this.updateButtonUI();
    },

    /**
     * Updates button visual icon, badge, and tooltip state
     */
    updateButtonUI: function () {
      if (typeof document === 'undefined') return;
      var btn = document.getElementById('modal-dda-btn');
      if (!btn) return;

      var isAdaptive = mode === 'adaptive';
      btn.className = 'btn btn-sm btn-icon modal-dda-btn ' + (isAdaptive ? 'active-adaptive' : 'active-hardcore');
      btn.setAttribute('aria-pressed', isAdaptive ? 'true' : 'false');

      var title = isAdaptive
        ? 'Dynamic Balancing: Adaptive (0.75x - 1.25x). Click to lock Pure Hardcore.'
        : 'Dynamic Balancing: Pure Hardcore (1.0x Fixed). Click to enable Adaptive.';

      btn.setAttribute('title', title);
      btn.setAttribute('aria-label', title);

      // SVG Icon: Balance Scale for Adaptive / Locked Shield for Hardcore
      if (isAdaptive) {
        btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="dda-icon-adaptive" aria-hidden="true">' +
          '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"></path>' +
          '<path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"></path>' +
          '<path d="M7 21h10"></path>' +
          '<path d="M12 3v18"></path>' +
          '<path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"></path>' +
          '</svg>';
      } else {
        btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="dda-icon-hardcore" aria-hidden="true">' +
          '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>' +
          '<circle cx="12" cy="11" r="1.5"></circle>' +
          '</svg>';
      }
    }
  };

  // Cross-iframe communication bridge
  if (typeof window !== 'undefined') {
    window.addEventListener('message', function (event) {
      if (!event || !event.data) return;
      var type = event.data.type;

      if (type === 'ARCADEVERSE_REQUEST_DDA_CONFIG') {
        broadcastToIframe();
      } else if (type === 'ARCADEVERSE_DDA_SET_MODE' && event.data.mode) {
        ArcadeDDA.setMode(event.data.mode);
      } else if (type === 'ARCADEVERSE_DDA_DEATH') {
        ArcadeDDA.recordDeath();
      } else if (type === 'ARCADEVERSE_DDA_HIT') {
        ArcadeDDA.recordHit(event.data.isHit);
      }
    });

    // Auto-mount when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        ArcadeDDA.mountControls();
      });
    } else {
      ArcadeDDA.mountControls();
    }
  }

  return ArcadeDDA;
});
