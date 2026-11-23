/**
 * ArcadeVerse Adaptive Resolution Scaling & Dynamic Canvas Sub-Sampler (#1060)
 * Continuously monitors frame pacing deltas and dynamically sub-samples backing canvas resolution
 * to guarantee 60 FPS gameplay on budget hardware, battery saver mode, or low-spec devices.
 * Author: Babin Bid (@Babin123456)
 * Open Source for ArcadeVerse - NSOC Winter Edition 2026
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ArcadeAdaptiveResolution = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var supervisedCanvases = new Map();
  var mode = 'auto'; // 'auto', 'high', 'low'

  function getBatterySupervisor(callback) {
    if (typeof navigator !== 'undefined' && typeof navigator.getBattery === 'function') {
      navigator.getBattery().then(function (battery) {
        callback(battery);
      }).catch(function () {});
    }
  }

  function enableAdaptiveResolution(canvas, options) {
    if (!canvas || supervisedCanvases.has(canvas)) return;

    var opts = options || {};
    var nativeWidth = opts.nativeWidth || canvas.width || 800;
    var nativeHeight = opts.nativeHeight || canvas.height || 600;

    var state = {
      canvas: canvas,
      nativeWidth: nativeWidth,
      nativeHeight: nativeHeight,
      currentScale: 1.0,
      recentDeltas: [],
      lowFpsDuration: 0,
      highFpsDuration: 0,
      lastTimestamp: performance.now(),
      rafId: null
    };

    function monitorFrame(now) {
      var delta = now - state.lastTimestamp;
      state.lastTimestamp = now;

      if (delta > 0 && delta < 200) {
        state.recentDeltas.push(delta);
        if (state.recentDeltas.length > 60) {
          state.recentDeltas.shift();
        }

        var avgDelta = state.recentDeltas.reduce(function (a, b) { return a + b; }, 0) / state.recentDeltas.length;
        var currentFps = 1000 / avgDelta;

        if (mode === 'auto') {
          if (currentFps < 42) {
            state.lowFpsDuration += delta;
            state.highFpsDuration = 0;
            if (state.lowFpsDuration > 2000) {
              // Scale down
              if (state.currentScale > 0.5) {
                applyScale(state, Math.max(0.5, state.currentScale - 0.15));
                state.lowFpsDuration = 0;
              }
            }
          } else if (currentFps >= 55) {
            state.highFpsDuration += delta;
            state.lowFpsDuration = 0;
            if (state.highFpsDuration > 5000) {
              // Scale back up
              if (state.currentScale < 1.0) {
                applyScale(state, Math.min(1.0, state.currentScale + 0.15));
                state.highFpsDuration = 0;
              }
            }
          }
        }
      }

      state.rafId = requestAnimationFrame(monitorFrame);
    }

    state.rafId = requestAnimationFrame(monitorFrame);
    supervisedCanvases.set(canvas, state);

    // Initial battery check
    getBatterySupervisor(function (battery) {
      if (battery.level < 0.20 && !battery.charging) {
        applyScale(state, 0.65);
      }
    });
  }

  function applyScale(state, scale) {
    state.currentScale = scale;
    var canvas = state.canvas;

    canvas.width = Math.round(state.nativeWidth * scale);
    canvas.height = Math.round(state.nativeHeight * scale);

    if (scale < 1.0) {
      canvas.style.imageRendering = 'pixelated';
    } else {
      canvas.style.imageRendering = 'auto';
    }
  }

  function disableAdaptiveResolution(canvas) {
    var state = supervisedCanvases.get(canvas);
    if (!state) return;

    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
    }
    applyScale(state, 1.0);
    supervisedCanvases.delete(canvas);
  }

  function setMode(newMode) {
    if (newMode !== 'auto' && newMode !== 'high' && newMode !== 'low') return;
    mode = newMode;

    supervisedCanvases.forEach(function (state) {
      if (mode === 'high') {
        applyScale(state, 1.0);
      } else if (mode === 'low') {
        applyScale(state, 0.5);
      }
    });
  }

  return {
    enableAdaptiveResolution: enableAdaptiveResolution,
    disableAdaptiveResolution: disableAdaptiveResolution,
    setMode: setMode,
    getMode: function () { return mode; },
    getSupervisedCount: function () { return supervisedCanvases.size; }
  };
});
