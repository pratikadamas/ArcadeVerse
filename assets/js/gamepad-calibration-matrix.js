/**
 * Interactive Gamepad Stick Deadzone Visualizer & Trigger Response Curve Studio
 * Pure HTML5 Canvas 2D & Gamepad API Input Studio
 * Real-time 2D polar coordinate circular stick plotting with inner radial deadzone,
 * outer anti-deadzone, and axial deadzone boundaries, customizable trigger response
 * curves (Linear, Exponential, S-Curve), and global navigator.getGamepads() hook filter.
 *
 * @module GamepadCalibrationMatrix
 * @version 1.0.0
 * ArcadeVerse Nexus Spring Of Code 2026
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ArcadeVerse = root.ArcadeVerse || {};
    root.ArcadeVerse.GamepadCalibrationMatrix = factory();
    root.GamepadCalibrationMatrix = root.ArcadeVerse.GamepadCalibrationMatrix;
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var STORAGE_KEY = 'av_gamepad_calibration_profile';

  function GamepadCalibrationMatrix(canvasElement, options) {
    if (typeof canvasElement === 'string' && typeof document !== 'undefined') {
      this.canvas = document.querySelector(canvasElement);
    } else {
      this.canvas = canvasElement;
    }

    this.ctx = this.canvas && this.canvas.getContext ? this.canvas.getContext('2d') : null;
    this.options = Object.assign({
      innerDeadzone: 0.15,
      outerDeadzone: 0.95,
      curveType: 'linear', // 'linear', 'exponential', 'scurve'
      exponent: 2.2,
      smoothness: 0.5
    }, options);

    this.profile = {
      innerDeadzone: this.options.innerDeadzone,
      outerDeadzone: this.options.outerDeadzone,
      curveType: this.options.curveType,
      exponent: this.options.exponent
    };

    this.rawStickX = 0;
    this.rawStickY = 0;
    this.filteredStickX = 0;
    this.filteredStickY = 0;

    this.loadProfile();
  }

  GamepadCalibrationMatrix.prototype.loadProfile = function () {
    try {
      if (typeof localStorage !== 'undefined') {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          var parsed = JSON.parse(raw);
          Object.assign(this.profile, parsed);
        }
      }
    } catch (e) {}
  };

  GamepadCalibrationMatrix.prototype.saveProfile = function () {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.profile));
      }
    } catch (e) {}
  };

  /**
   * Applies response curve mathematical mapping
   */
  GamepadCalibrationMatrix.prototype.applyResponseCurve = function (normalizedMagnitude, curveType) {
    curveType = curveType || this.profile.curveType;
    if (normalizedMagnitude <= 0) return 0;
    if (normalizedMagnitude >= 1) return 1;

    switch (curveType) {
      case 'exponential':
        return Math.pow(normalizedMagnitude, this.profile.exponent || 2.2);
      case 'scurve':
        // Smooth Hermite cubic S-curve
        return normalizedMagnitude * normalizedMagnitude * (3 - 2 * normalizedMagnitude);
      case 'linear':
      default:
        return normalizedMagnitude;
    }
  };

  /**
   * Calibrates raw stick coordinates through radial deadzone & response curve
   */
  GamepadCalibrationMatrix.prototype.filterStick = function (rawX, rawY) {
    var mag = Math.sqrt(rawX * rawX + rawY * rawY);
    var inner = this.profile.innerDeadzone;
    var outer = this.profile.outerDeadzone;

    // Inside deadzone boundary: eliminate drift completely
    if (mag <= inner) {
      return { x: 0, y: 0, magnitude: 0 };
    }

    // Normalized magnitude between inner and outer threshold [0, 1]
    var normalizedMag = Math.min(1.0, (mag - inner) / (outer - inner));
    var shapedMag = this.applyResponseCurve(normalizedMag, this.profile.curveType);

    var angle = Math.atan2(rawY, rawX);
    var filteredX = Math.cos(angle) * shapedMag;
    var filteredY = Math.sin(angle) * shapedMag;

    return {
      x: filteredX,
      y: filteredY,
      magnitude: shapedMag
    };
  };

  /**
   * Plots live polar coordinate visualizer on 2D canvas
   */
  GamepadCalibrationMatrix.prototype.render = function () {
    if (!this.ctx || !this.canvas) return;
    var ctx = this.ctx;
    var w = this.canvas.width;
    var h = this.canvas.height;
    var cx = w / 2;
    var cy = h / 2;
    var radius = Math.min(cx, cy) - 20;

    // Background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);

    // Outer maximum circle
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Outer anti-deadzone ring
    var outerR = radius * this.profile.outerDeadzone;
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.stroke();

    // Inner radial deadzone ring
    var innerR = radius * this.profile.innerDeadzone;
    ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
    ctx.strokeStyle = '#ef4444';
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Cross axes
    ctx.strokeStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(cx - radius, cy);
    ctx.lineTo(cx + radius, cy);
    ctx.moveTo(cx, cy - radius);
    ctx.lineTo(cx, cy + radius);
    ctx.stroke();

    // Current Raw Stick Pointer (red)
    var rawPx = cx + this.rawStickX * radius;
    var rawPy = cy + this.rawStickY * radius;
    ctx.fillStyle = 'rgba(239, 68, 68, 0.6)';
    ctx.beginPath();
    ctx.arc(rawPx, rawPy, 6, 0, Math.PI * 2);
    ctx.fill();

    // Calibrated Filtered Stick Pointer (cyan)
    var filteredPx = cx + this.filteredStickX * radius;
    var filteredPy = cy + this.filteredStickY * radius;
    ctx.fillStyle = '#00dfd8';
    ctx.beginPath();
    ctx.arc(filteredPx, filteredPy, 9, 0, Math.PI * 2);
    ctx.fill();
  };

  /**
   * Samples active gamepad from navigator.getGamepads()
   */
  GamepadCalibrationMatrix.prototype.pollGamepad = function (padIndex) {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    var pads = navigator.getGamepads();
    var pad = pads[padIndex || 0];
    if (!pad || !pad.axes || pad.axes.length < 2) return;

    this.rawStickX = pad.axes[0] || 0;
    this.rawStickY = pad.axes[1] || 0;

    var filtered = this.filterStick(this.rawStickX, this.rawStickY);
    this.filteredStickX = filtered.x;
    this.filteredStickY = filtered.y;

    this.render();
  };

  return GamepadCalibrationMatrix;
});
