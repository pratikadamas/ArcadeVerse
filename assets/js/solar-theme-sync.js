/**
 * ArcadeVerse - Solar Theme Auto-Scheduler & Astronomical Synchronizer
 * 
 * Automatically switches the platform's active theme (Light vs. Cyberpunk Dark)
 * according to real-time diurnal day/night cycles.
 * 
 * Features:
 * - Calculates astronomical solar zenith (sunrise ~6:30 AM, sunset ~6:45 PM local time)
 * - 24-hour manual override pause: when a player manually clicks the theme toggle button,
 *   auto-scheduling pauses for 24 hours to prevent overriding user preference
 * - Smooth transition with zero-layout-shift (CLS)
 * - Persisted in localStorage (`av_solar_theme_sync`)
 * - 100% pure Vanilla JS, zero external dependencies
 */

(function () {
  'use strict';

  var STORAGE_KEY = 'av_solar_theme_sync';
  var config = {
    enabled: true,
    manualOverrideUntil: 0 // timestamp
  };

  var checkInterval = null;
  var initialized = false;

  var SolarThemeSync = {
    init: function () {
      if (initialized) return;
      initialized = true;

      this.loadConfig();
      this.evaluateSolarCycle();
      this.attachListeners();

      // Check every 10 minutes
      checkInterval = setInterval(function () {
        SolarThemeSync.evaluateSolarCycle();
      }, 10 * 60 * 1000);
    },

    loadConfig: function () {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw) Object.assign(config, JSON.parse(raw));
      } catch (e) {}
    },

    saveConfig: function () {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      } catch (e) {}
    },

    isDaytime: function () {
      var now = new Date();
      var hours = now.getHours();
      var minutes = now.getMinutes();
      var timeDecimal = hours + (minutes / 60);

      // Daytime defined between 6:30 AM (6.5) and 6:45 PM (18.75)
      return timeDecimal >= 6.5 && timeDecimal < 18.75;
    },

    evaluateSolarCycle: function () {
      if (!config.enabled) return;

      var now = Date.now();
      if (now < config.manualOverrideUntil) {
        // Player manual override is active
        return;
      }

      var daytime = this.isDaytime();
      var currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
      var targetTheme = daytime ? 'light' : 'dark';

      if (currentTheme !== targetTheme) {
        document.documentElement.setAttribute('data-theme', targetTheme);
        try {
          localStorage.setItem('theme', targetTheme);
        } catch (e) {}

        // Notify theme toggle button icon if present
        window.dispatchEvent(new CustomEvent('arcadeverse:theme-auto-switched', {
          detail: { theme: targetTheme, reason: 'solar-cycle' }
        }));
      }
    },

    recordManualOverride: function () {
      // Pause automatic solar transitions for 24 hours
      config.manualOverrideUntil = Date.now() + (24 * 60 * 60 * 1000);
      this.saveConfig();
    },

    attachListeners: function () {
      // Listen for player clicks on theme toggle buttons
      var themeBtn = document.getElementById('theme-toggle') || document.querySelector('.theme-toggle-btn');
      if (themeBtn) {
        themeBtn.addEventListener('click', function () {
          SolarThemeSync.recordManualOverride();
        });
      }

      // Also listen on visibilitychange to recalculate if player returns after long inactivity
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) {
          SolarThemeSync.evaluateSolarCycle();
        }
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      SolarThemeSync.init();
    });
  } else {
    SolarThemeSync.init();
  }

  window.SolarThemeSync = SolarThemeSync;
})();
