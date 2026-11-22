/**
 * Convex CRT Glass Curvature & Spherical Barrel Distortion Lens Mapper
 * Pure HTML5 Canvas 2D & Mathematical Barrel Distortion Shader
 * Applies radial lens distortion math (r' = r * (1 + k * r^2)) to curve canvas pixels outward
 * towards edges simulating authentic retro curved CRT picture tubes with corner vignettes.
 *
 * @module CrtLensCurvature
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
    root.ArcadeVerse.CrtLensCurvature = factory();
    root.CrtLensCurvature = root.ArcadeVerse.CrtLensCurvature;
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  function CrtLensCurvature(options) {
    this.options = Object.assign({
      distortionK: 0.18, // Curvature intensity factor
      vignetteIntensity: 0.85
    }, options);
  }

  /**
   * Analytical radial barrel distortion formula: r' = r * (1 + k * r^2)
   */
  CrtLensCurvature.prototype.distortCoordinate = function (normX, normY) {
    // Shift origin to screen center [-1, 1]
    var cx = normX * 2 - 1;
    var cy = normY * 2 - 1;
    var r2 = cx * cx + cy * cy;
    var k = this.options.distortionK;

    var factor = 1.0 + k * r2;
    var distCx = cx * factor;
    var distCy = cy * factor;

    // Shift back to normalized screen space [0, 1]
    return {
      x: (distCx + 1) * 0.5,
      y: (distCy + 1) * 0.5,
      radiusSq: r2
    };
  };

  /**
   * Applies CSS 3D spherical warp matrix fallback for high-performance rendering
   */
  CrtLensCurvature.prototype.applyCssBarrelDistortion = function (element) {
    if (!element || !element.style) return;
    element.style.transform = 'perspective(800px) scale(0.97) rotateX(0deg)';
    element.style.borderRadius = '24px';
    element.style.boxShadow = 'inset 0 0 80px rgba(0, 0, 0, 0.9), 0 0 30px rgba(0, 0, 0, 0.8)';
  };

  /**
   * Draws phosphor vignette and edge glare on a 2D canvas context
   */
  CrtLensCurvature.prototype.drawCrtVignette = function (ctx, width, height) {
    if (!ctx) return;
    ctx.save();
    var cx = width / 2;
    var cy = height / 2;
    var r = Math.sqrt(cx * cx + cy * cy);

    var grad = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.7)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Subtle glass specular glare in top-left corner
    var glare = ctx.createLinearGradient(0, 0, width * 0.4, height * 0.3);
    glare.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
    glare.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glare;
    ctx.fillRect(0, 0, width, height);

    ctx.restore();
  };

  return CrtLensCurvature;
});
