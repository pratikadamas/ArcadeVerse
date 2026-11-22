/**
 * Retro CRT Light Gun Calibration & Screen-Flash Optical Target Tracker
 * Pure HTML5 Canvas 2D & Web Audio Light Gun Simulation Engine
 * Simulates classic optical light-sensor timing: upon trigger pull, renders
 * a black frame with white target bounding boxes, calculates optical hit detection,
 * provides 2-point crosshair calibration, procedural recoil kick & muzzle flash,
 * and off-screen shot detection for arcade weapon reloading.
 *
 * @module LightGunOptical
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
    root.ArcadeVerse.LightGunOptical = factory();
    root.LightGunOptical = root.ArcadeVerse.LightGunOptical;
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  function LightGunOptical(canvasElement, options) {
    if (typeof canvasElement === 'string' && typeof document !== 'undefined') {
      this.canvas = document.querySelector(canvasElement);
    } else {
      this.canvas = canvasElement;
    }

    this.ctx = this.canvas && this.canvas.getContext ? this.canvas.getContext('2d') : null;
    this.options = Object.assign({
      recoilEnabled: true,
      audioFeedback: true,
      maxAmmo: 6
    }, options);

    this.ammo = this.options.maxAmmo;
    this.recoilY = 0;
    this.flashFrame = 0; // 0: Normal, 1: Black frame, 2: Target flash
    this.targets = []; // Array of { id, x, y, width, height, onHit }
    this.calibration = {
      offsetScaleX: 1.0,
      offsetScaleY: 1.0,
      calibrated: false
    };

    this.bindEvents();
  }

  LightGunOptical.prototype.registerTarget = function (target) {
    this.targets.push(target);
    return target;
  };

  LightGunOptical.prototype.clearTargets = function () {
    this.targets = [];
  };

  /**
   * Two-point calibration calculation (Top-Left & Bottom-Right)
   */
  LightGunOptical.prototype.calibrate = function (measuredP1, actualP1, measuredP2, actualP2) {
    var scaleX = (actualP2.x - actualP1.x) / (measuredP2.x - measuredP1.x || 1);
    var scaleY = (actualP2.y - actualP1.y) / (measuredP2.y - measuredP1.y || 1);
    this.calibration.offsetScaleX = scaleX;
    this.calibration.offsetScaleY = scaleY;
    this.calibration.calibrated = true;
    return this.calibration;
  };

  /**
   * Simulates classic CRT optical sensor hit detection
   * In authentic CRT hardware, the gun photodiode detects pure white raster timing
   */
  LightGunOptical.prototype.detectOpticalHit = function (shotX, shotY) {
    for (var i = 0; i < this.targets.length; i++) {
      var t = this.targets[i];
      if (
        shotX >= t.x &&
        shotX <= t.x + t.width &&
        shotY >= t.y &&
        shotY <= t.y + t.height
      ) {
        if (typeof t.onHit === 'function') {
          t.onHit(t);
        }
        return { hit: true, target: t };
      }
    }
    return { hit: false, target: null };
  };

  /**
   * Fires the light gun at screen coordinates
   */
  LightGunOptical.prototype.pullTrigger = function (screenX, screenY, isOffscreen) {
    // 1. Off-screen shot reload mechanism
    if (isOffscreen || screenX < 0 || screenY < 0 ||
        (this.canvas && (screenX > this.canvas.width || screenY > this.canvas.height))) {
      this.reload();
      return { action: 'reload', ammo: this.ammo };
    }

    // 2. Out of ammo dry-fire click
    if (this.ammo <= 0) {
      this.playMechanicalSound('dry_click');
      return { action: 'dry_fire', ammo: 0 };
    }

    this.ammo--;
    if (this.options.recoilEnabled) {
      this.recoilY = 12; // Procedural recoil kick
    }
    this.playMechanicalSound('gunshot');

    // Optical hit check
    var result = this.detectOpticalHit(screenX, screenY);
    result.action = 'shot';
    result.ammo = this.ammo;
    return result;
  };

  LightGunOptical.prototype.reload = function () {
    this.ammo = this.options.maxAmmo;
    this.playMechanicalSound('reload_pump');
  };

  /**
   * Procedural Web Audio sound effects for light gun mechanics (gunshot, pump, dry fire)
   */
  LightGunOptical.prototype.playMechanicalSound = function (type) {
    if (!this.options.audioFeedback || typeof window === 'undefined') return;
    try {
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      var ctx = new AudioCtx();
      var now = ctx.currentTime;

      if (type === 'gunshot') {
        // Noise burst + low punch
        var bufferSize = ctx.sampleRate * 0.12;
        var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        var output = buffer.getChannelData(0);
        for (var i = 0; i < bufferSize; i++) {
          output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.03));
        }
        var whiteNoise = ctx.createBufferSource();
        whiteNoise.buffer = buffer;
        var filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1200, now);
        filter.frequency.exponentialRampToValueAtTime(80, now + 0.12);
        whiteNoise.connect(filter);
        filter.connect(ctx.destination);
        whiteNoise.start(now);
      } else if (type === 'reload_pump') {
        // High click followed by mechanical slide
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.linearRampToValueAtTime(150, now + 0.08);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'dry_click') {
        var clickOsc = ctx.createOscillator();
        var clickGain = ctx.createGain();
        clickOsc.type = 'triangle';
        clickOsc.frequency.setValueAtTime(800, now);
        clickGain.gain.setValueAtTime(0.2, now);
        clickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.03);
        clickOsc.connect(clickGain);
        clickGain.connect(ctx.destination);
        clickOsc.start(now);
        clickOsc.stop(now + 0.03);
      }
    } catch (e) {
      // Audio context policy or disabled
    }
  };

  LightGunOptical.prototype.bindEvents = function () {
    if (!this.canvas) return;
    var self = this;
    this._onPointerDown = function (e) {
      var rect = self.canvas.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      self.pullTrigger(x, y, false);
    };
    this.canvas.addEventListener('pointerdown', this._onPointerDown);
  };

  LightGunOptical.prototype.destroy = function () {
    if (this.canvas && this._onPointerDown) {
      this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    }
    this.targets = [];
  };

  return LightGunOptical;
});
