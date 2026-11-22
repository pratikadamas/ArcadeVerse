/**
 * Mode 7 Affine Texture Projection & Horizon Curvature Engine
 * Pure Vanilla JavaScript & HTML5 2D Canvas Scanline Renderer
 * Simulates classic 16-bit hardware Mode 7 perspective transformation
 * mapping a 2D tilemap or texture buffer onto a receding pseudo-3D ground plane.
 *
 * Mathematical Projection Formulas:
 * For each vertical scanline y from horizon to screen height:
 *   distance z = (cameraHeight * fov) / (y - horizonY)
 *   horizontal step = z / fov
 *   affine coordinates (u, v) rotated by camera angle theta:
 *     u = cameraX + z * cos(theta) - (x - screenWidth/2) * sin(theta) * step
 *     v = cameraY + z * sin(theta) + (x - screenWidth/2) * cos(theta) * step
 *
 * @module Mode7Projection
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
    root.ArcadeVerse.Mode7Projection = factory();
    root.ArcadeVerse.math = root.ArcadeVerse.math || {};
    root.ArcadeVerse.math.createMode7Renderer = root.ArcadeVerse.Mode7Projection.createRenderer;
    root.Mode7Projection = root.ArcadeVerse.Mode7Projection;
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  function Mode7Renderer(ctx, options) {
    this.ctx = ctx;
    this.options = Object.assign({
      width: 320,
      height: 240,
      fov: 200,
      cameraX: 128,
      cameraY: 128,
      cameraZ: 40, // Height above plane
      angle: 0, // Rotation in radians
      horizonY: 80, // Vertical scanline of horizon
      textureWidth: 256,
      textureHeight: 256,
      wrapMode: 'repeat' // 'repeat' or 'clamp'
    }, options);

    this.width = this.options.width;
    this.height = this.options.height;
    this.textureBuffer = null;
    this.outputBuffer = null;

    if (this.ctx && this.ctx.createImageData) {
      this.outputBuffer = this.ctx.createImageData(this.width, this.height);
    }
  }

  /**
   * Sets or generates the 2D source texture matrix (e.g. checkboard, tilemap, or runway)
   */
  Mode7Renderer.prototype.setTexture = function (uint8ClampedData, width, height) {
    this.textureBuffer = uint8ClampedData;
    this.options.textureWidth = width || this.options.textureWidth;
    this.options.textureHeight = height || this.options.textureHeight;
  };

  /**
   * Generates a procedural retro checkered runway texture for standalone sandboxes
   */
  Mode7Renderer.prototype.generateProceduralTexture = function (w, h) {
    w = w || this.options.textureWidth;
    h = h || this.options.textureHeight;
    var data = new Uint8ClampedArray(w * h * 4);
    var tileSize = 16;

    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var idx = (y * w + x) * 4;
        var cx = Math.floor(x / tileSize);
        var cy = Math.floor(y / tileSize);
        var isWhite = (cx + cy) % 2 === 0;

        if (isWhite) {
          // Neon turquoise / cyan tiles
          data[idx] = 16;
          data[idx + 1] = 185;
          data[idx + 2] = 129;
          data[idx + 3] = 255;
        } else {
          // Deep slate / navy tiles
          data[idx] = 15;
          data[idx + 1] = 23;
          data[idx + 2] = 42;
          data[idx + 3] = 255;
        }
      }
    }
    this.setTexture(data, w, h);
    return data;
  };

  /**
   * Calculates scanline affine projection parameters
   */
  Mode7Renderer.prototype.calculateScanline = function (screenY) {
    var horizon = this.options.horizonY;
    if (screenY <= horizon) return null;

    var dy = screenY - horizon;
    var distance = (this.options.cameraZ * this.options.fov) / dy;

    var cosA = Math.cos(this.options.angle);
    var sinA = Math.sin(this.options.angle);

    // Lateral step per horizontal screen pixel
    var stepScale = distance / this.options.fov;
    var stepX = -sinA * stepScale;
    var stepY = cosA * stepScale;

    // Center point in world space for this scanline
    var startWorldX = this.options.cameraX + distance * cosA - (this.width / 2) * stepX;
    var startWorldY = this.options.cameraY + distance * sinA - (this.width / 2) * stepY;

    return {
      distance: distance,
      startX: startWorldX,
      startY: startWorldY,
      stepX: stepX,
      stepY: stepY
    };
  };

  /**
   * Scanline-by-scanline rendering loop (60 FPS at 320x240 retro resolution)
   */
  Mode7Renderer.prototype.render = function () {
    if (!this.textureBuffer) {
      this.generateProceduralTexture();
    }
    if (!this.outputBuffer && this.ctx && this.ctx.createImageData) {
      this.outputBuffer = this.ctx.createImageData(this.width, this.height);
    }
    if (!this.outputBuffer) return;

    var outData = this.outputBuffer.data;
    var texData = this.textureBuffer;
    var tw = this.options.textureWidth;
    var th = this.options.textureHeight;
    var horizon = this.options.horizonY;

    // Render sky / upper horizon background
    for (var sy = 0; sy <= horizon; sy++) {
      for (var sx = 0; sx < this.width; sx++) {
        var skyIdx = (sy * this.width + sx) * 4;
        var grad = sy / horizon;
        outData[skyIdx] = Math.floor(10 + grad * 15);
        outData[skyIdx + 1] = Math.floor(10 + grad * 25);
        outData[skyIdx + 2] = Math.floor(35 + grad * 40);
        outData[skyIdx + 3] = 255;
      }
    }

    // Receding pseudo-3D ground plane scanlines
    for (var y = horizon + 1; y < this.height; y++) {
      var scan = this.calculateScanline(y);
      if (!scan) continue;

      var curU = scan.startX;
      var curV = scan.startY;
      var rowOffset = y * this.width * 4;

      for (var x = 0; x < this.width; x++) {
        var pixelIdx = rowOffset + x * 4;

        // Texture wrapping math
        var tu = Math.floor(curU) % tw;
        var tv = Math.floor(curV) % th;
        if (tu < 0) tu += tw;
        if (tv < 0) tv += th;

        var texIdx = (tv * tw + tu) * 4;

        // Fog / distance shading attenuation
        var fog = Math.max(0.15, Math.min(1.0, 1.0 - (scan.distance / 1200)));

        outData[pixelIdx] = Math.floor(texData[texIdx] * fog);
        outData[pixelIdx + 1] = Math.floor(texData[texIdx + 1] * fog);
        outData[pixelIdx + 2] = Math.floor(texData[texIdx + 2] * fog);
        outData[pixelIdx + 3] = 255;

        curU += scan.stepX;
        curV += scan.stepY;
      }
    }

    if (this.ctx && this.ctx.putImageData) {
      this.ctx.putImageData(this.outputBuffer, 0, 0);
    }
  };

  return {
    Mode7Renderer: Mode7Renderer,
    createRenderer: function (ctx, options) {
      return new Mode7Renderer(ctx, options);
    }
  };
});
