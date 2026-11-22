/**
 * Procedural 2D Raymarched Metaball Plasma Caustics & Water Ripple Sandbox
 * Pure HTML5 Canvas 2D & Wave Equation Fluid Dynamics
 * Implements analytical multi-frequency sinusoidal plasma caustics,
 * 2D wave equation surface ripple propagation with refraction displacement,
 * and high-performance 160x120 sub-resolution rendering with bilinear upsampling.
 *
 * @module PlasmaCaustics
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
    root.ArcadeVerse.PlasmaCaustics = factory();
    root.PlasmaCaustics = root.ArcadeVerse.PlasmaCaustics;
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  function PlasmaCaustics(canvasElement, options) {
    if (typeof canvasElement === 'string' && typeof document !== 'undefined') {
      this.canvas = document.querySelector(canvasElement);
    } else {
      this.canvas = canvasElement;
    }

    this.ctx = this.canvas && this.canvas.getContext ? this.canvas.getContext('2d') : null;
    this.options = Object.assign({
      subWidth: 160,
      subHeight: 120,
      damping: 0.96,
      waveSpeed: 0.05,
      plasmaScale: 0.06
    }, options);

    this.subW = this.options.subWidth;
    this.subH = this.options.subHeight;
    var size = this.subW * this.subH;

    // Dual buffers for 2D wave equation simulation
    this.waveCurrent = new Float32Array(size);
    this.wavePrev = new Float32Array(size);

    this.offscreenCanvas = null;
    this.offscreenCtx = null;
    this.offscreenImgData = null;

    if (typeof document !== 'undefined' && document.createElement) {
      this.offscreenCanvas = document.createElement('canvas');
      this.offscreenCanvas.width = this.subW;
      this.offscreenCanvas.height = this.subH;
      this.offscreenCtx = this.offscreenCanvas.getContext('2d');
      if (this.offscreenCtx) {
        this.offscreenImgData = this.offscreenCtx.createImageData(this.subW, this.subH);
      }
    }

    this.time = 0;
    this.bindEvents();
  }

  /**
   * Disturbs water surface at normalized coordinates
   */
  PlasmaCaustics.prototype.dropRipple = function (normX, normY, strength, radius) {
    strength = strength || 10.0;
    radius = radius || 3;
    var cx = Math.floor(normX * this.subW);
    var cy = Math.floor(normY * this.subH);

    for (var dy = -radius; dy <= radius; dy++) {
      for (var dx = -radius; dx <= radius; dx++) {
        var px = cx + dx;
        var py = cy + dy;
        if (px >= 0 && px < this.subW && py >= 0 && py < this.subH) {
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= radius) {
            this.waveCurrent[py * this.subW + px] += strength * (1.0 - dist / radius);
          }
        }
      }
    }
  };

  /**
   * Solves 2D discrete Laplacian wave equation:
   * u(t+1) = 2*u(t) - u(t-1) + c^2 * [Laplacian(u)]
   */
  PlasmaCaustics.prototype.updateWaveSimulation = function () {
    var w = this.subW;
    var h = this.subH;
    var damp = this.options.damping;
    var curr = this.waveCurrent;
    var prev = this.wavePrev;

    for (var y = 1; y < h - 1; y++) {
      for (var x = 1; x < w - 1; x++) {
        var idx = y * w + x;
        // 4-point discrete Laplacian stencil
        var laplacian = curr[idx - 1] + curr[idx + 1] + curr[idx - w] + curr[idx + w] - (4 * curr[idx]);
        var nextVal = (2 * curr[idx] - prev[idx] + 0.5 * laplacian) * damp;
        prev[idx] = curr[idx];
        curr[idx] = nextVal;
      }
    }
  };

  /**
   * Evaluates multi-frequency sinusoidal plasma caustics
   */
  PlasmaCaustics.prototype.evaluatePlasma = function (x, y, t) {
    var s = this.options.plasmaScale;
    var v1 = Math.sin(x * s + t);
    var v2 = Math.sin((y * s + t) * 0.8);
    var v3 = Math.sin((x * s + y * s + t) * 0.7);
    var cx = x * s + 0.5 * Math.sin(t / 3);
    var cy = y * s + 0.5 * Math.cos(t / 2);
    var v4 = Math.sin(Math.sqrt(cx * cx + cy * cy + 1) + t);

    return (v1 + v2 + v3 + v4) * 0.25;
  };

  /**
   * Renders refracted caustics into offscreen buffer
   */
  PlasmaCaustics.prototype.renderBuffer = function () {
    if (!this.offscreenImgData) return;
    var data = this.offscreenImgData.data;
    var w = this.subW;
    var h = this.subH;
    var curr = this.waveCurrent;
    var t = this.time;

    for (var y = 1; y < h - 1; y++) {
      for (var x = 1; x < w - 1; x++) {
        var idx = y * w + x;

        // Wave normal gradient for refraction vector
        var gradX = (curr[idx + 1] - curr[idx - 1]) * 0.5;
        var gradY = (curr[idx + w] - curr[idx - w]) * 0.5;

        // Refracted coordinates
        var rx = x + gradX;
        var ry = y + gradY;

        var caustic = this.evaluatePlasma(rx, ry, t);
        // Intensity curve
        var brightness = Math.pow(Math.max(0, caustic + 0.65), 3.0);

        var pixelIdx = idx * 4;
        // Deep turquoise / aquatic water palette
        data[pixelIdx] = Math.floor(Math.min(255, brightness * 50));
        data[pixelIdx + 1] = Math.floor(Math.min(255, 120 + brightness * 110));
        data[pixelIdx + 2] = Math.floor(Math.min(255, 180 + brightness * 75));
        data[pixelIdx + 3] = 255;
      }
    }

    if (this.offscreenCtx && this.offscreenCtx.putImageData) {
      this.offscreenCtx.putImageData(this.offscreenImgData, 0, 0);
    }
  };

  PlasmaCaustics.prototype.update = function (deltaSec) {
    this.time += (deltaSec || 0.016);
    this.updateWaveSimulation();
  };

  PlasmaCaustics.prototype.render = function () {
    this.renderBuffer();
    if (this.ctx && this.offscreenCanvas && this.canvas) {
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.drawImage(this.offscreenCanvas, 0, 0, this.canvas.width, this.canvas.height);
    }
  };

  PlasmaCaustics.prototype.bindEvents = function () {
    if (!this.canvas) return;
    var self = this;
    this._onPointerMove = function (e) {
      var rect = self.canvas.getBoundingClientRect();
      var nx = (e.clientX - rect.left) / rect.width;
      var ny = (e.clientY - rect.top) / rect.height;
      self.dropRipple(nx, ny, 8.0, 2);
    };
    this.canvas.addEventListener('pointermove', this._onPointerMove);
  };

  PlasmaCaustics.prototype.destroy = function () {
    if (this.canvas && this._onPointerMove) {
      this.canvas.removeEventListener('pointermove', this._onPointerMove);
    }
  };

  return PlasmaCaustics;
});
