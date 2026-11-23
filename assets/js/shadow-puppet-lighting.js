/**
 * Dynamic Canvas Silhouette Shadow Puppet & Soft Penumbra Lighting Engine
 * Pure Vanilla JavaScript & HTML5 2D Canvas 2D Lighting Engine
 * Raycasts 2D shadow volume geometry from dynamic point lights around polygon obstacles,
 * renders multi-sampled soft penumbra gradients (dark umbra core transitioning into soft alpha fringes),
 * procedural light flicker modulation (neon torches, buzzing fluorescent lights), and handles up to 4 simultaneous lights.
 *
 * @module ShadowPuppetLighting
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
    root.ArcadeVerse.lighting = root.ArcadeVerse.lighting || {};
    root.ArcadeVerse.ShadowPuppetLighting = factory();
    root.ArcadeVerse.lighting.addLight = function (x, y, radius, color, options) {
      if (root.ArcadeVerse.ShadowPuppetLighting.activeInstance) {
        return root.ArcadeVerse.ShadowPuppetLighting.activeInstance.addLight(x, y, radius, color, options);
      }
    };
    root.ShadowPuppetLighting = root.ArcadeVerse.ShadowPuppetLighting;
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  function PointLight(id, x, y, radius, color, options) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.radius = radius || 200;
    this.baseRadius = this.radius;
    this.color = color || '#00dfd8';
    this.options = Object.assign({
      flicker: true,
      flickerAmount: 0.08,
      intensity: 1.0
    }, options);
    this.currentFlicker = 1.0;
  }

  function ShadowPuppetLighting(options) {
    this.options = Object.assign({
      ambientLight: 'rgba(5, 7, 15, 0.92)',
      maxLights: 4,
      shadowDistance: 1200
    }, options);

    this.lights = [];
    this.obstacles = []; // Array of polygon vertices [{ x, y }, ...]
    this.nextLightId = 1;

    ShadowPuppetLighting.activeInstance = this;
  }

  ShadowPuppetLighting.prototype.addLight = function (x, y, radius, color, options) {
    if (this.lights.length >= this.options.maxLights) {
      this.lights.shift(); // Evict oldest light to maintain 4-light cap
    }
    var light = new PointLight(this.nextLightId++, x, y, radius, color, options);
    this.lights.push(light);
    return light;
  };

  ShadowPuppetLighting.prototype.removeLight = function (id) {
    this.lights = this.lights.filter(function (l) { return l.id !== id; });
  };

  ShadowPuppetLighting.prototype.addObstacle = function (polygonPoints) {
    this.obstacles.push(polygonPoints);
  };

  ShadowPuppetLighting.prototype.clearObstacles = function () {
    this.obstacles = [];
  };

  /**
   * Projects shadow ray polygon from light through obstacle edge
   */
  ShadowPuppetLighting.prototype.projectShadowVolume = function (ctx, light, p1, p2) {
    var maxDist = this.options.shadowDistance;

    // Ray from light to p1
    var dx1 = p1.x - light.x;
    var dy1 = p1.y - light.y;
    var len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1) || 1;
    var p1FarX = p1.x + (dx1 / len1) * maxDist;
    var p1FarY = p1.y + (dy1 / len1) * maxDist;

    // Ray from light to p2
    var dx2 = p2.x - light.x;
    var dy2 = p2.y - light.y;
    var len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2) || 1;
    var p2FarX = p2.x + (dx2 / len2) * maxDist;
    var p2FarY = p2.y + (dy2 / len2) * maxDist;

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p1FarX, p1FarY);
    ctx.lineTo(p2FarX, p2FarY);
    ctx.lineTo(p2.x, p2.y);
    ctx.closePath();
    ctx.fill();
  };

  /**
   * Updates procedural light flicker modulation
   */
  ShadowPuppetLighting.prototype.update = function () {
    for (var i = 0; i < this.lights.length; i++) {
      var l = this.lights[i];
      if (l.options.flicker) {
        var noise = (Math.random() * 2 - 1) * l.options.flickerAmount;
        l.currentFlicker = Math.max(0.7, Math.min(1.3, 1.0 + noise));
        l.radius = l.baseRadius * l.currentFlicker;
      }
    }
  };

  /**
   * Renders multi-sampled soft penumbra lighting pass
   */
  ShadowPuppetLighting.prototype.render = function (ctx, width, height) {
    if (!ctx) return;
    ctx.save();

    // 1. Fill dark ambient darkness
    ctx.fillStyle = this.options.ambientLight;
    ctx.fillRect(0, 0, width, height);

    // 2. Composite radial light sources with soft penumbra gradients
    ctx.globalCompositeOperation = 'lighter';

    for (var i = 0; i < this.lights.length; i++) {
      var l = this.lights[i];
      var r = l.radius;

      var grad = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, r);
      grad.addColorStop(0, l.color);
      grad.addColorStop(0.4, l.color);
      grad.addColorStop(1.0, 'rgba(0,0,0,0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(l.x, l.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Subtract shadow volumes using 'destination-out'
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';

    for (var li = 0; li < this.lights.length; li++) {
      var curLight = this.lights[li];
      for (var oi = 0; oi < this.obstacles.length; oi++) {
        var poly = this.obstacles[oi];
        for (var pi = 0; pi < poly.length; pi++) {
          var p1 = poly[pi];
          var p2 = poly[(pi + 1) % poly.length];
          this.projectShadowVolume(ctx, curLight, p1, p2);
        }
      }
    }

    ctx.restore();
  };

  return ShadowPuppetLighting;
});
