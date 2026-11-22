/**
 * Dynamic Vector Glyph Radar & Minimap Projection Engine for Canvas Games
 * Pure Vanilla JavaScript & HTML5 2D Canvas Radar Overlay
 * Renders an authentic glowing circular CRT vector radar screen with a sweeping
 * 360-degree radar beam, exponential phosphorescent blip decay, off-screen edge-clamped
 * directional chevron blips, toggleable zoom levels, and plug-and-play entity registration.
 *
 * @module RadarMinimap
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
    root.ArcadeVerse.RadarMinimap = factory();
    root.RadarMinimap = root.ArcadeVerse.RadarMinimap;
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  function RadarMinimap(options) {
    this.options = Object.assign({
      radarRadius: 80,
      worldRange: 1000,
      sweepSpeed: 0.05, // Radians per frame
      zoom: 1.0, // 0.5x, 1x, 2x
      opacity: 0.85,
      colorway: '#00ffcc'
    }, options);

    this.entities = {}; // id -> { getX, getY, type, color }
    this.sweepAngle = 0;
    this.playerX = 0;
    this.playerY = 0;
  }

  RadarMinimap.prototype.registerEntity = function (id, entityDef) {
    this.entities[id] = entityDef;
    return this;
  };

  RadarMinimap.prototype.unregisterEntity = function (id) {
    delete this.entities[id];
  };

  RadarMinimap.prototype.setPlayerPosition = function (x, y) {
    this.playerX = x;
    this.playerY = y;
  };

  RadarMinimap.prototype.setZoom = function (zoomLevel) {
    this.options.zoom = Math.max(0.2, Math.min(4.0, zoomLevel));
  };

  /**
   * Transforms world coordinates relative to player into radar polar/screen coordinates
   */
  RadarMinimap.prototype.projectCoordinate = function (worldX, worldY) {
    var relX = (worldX - this.playerX) * this.options.zoom;
    var relY = (worldY - this.playerY) * this.options.zoom;

    var dist = Math.sqrt(relX * relX + relY * relY);
    var angle = Math.atan2(relY, relX);

    var maxDist = this.options.worldRange * this.options.zoom;
    var isOffscreen = dist > maxDist;

    // Normalised distance [0, 1]
    var normDist = isOffscreen ? 1.0 : (dist / maxDist);
    var clampedDist = normDist * this.options.radarRadius;

    return {
      x: Math.cos(angle) * clampedDist,
      y: Math.sin(angle) * clampedDist,
      distance: dist,
      angle: angle,
      isOffscreen: isOffscreen
    };
  };

  /**
   * Advances 360-degree radar beam sweep
   */
  RadarMinimap.prototype.update = function () {
    this.sweepAngle += this.options.sweepSpeed;
    if (this.sweepAngle >= Math.PI * 2) {
      this.sweepAngle -= Math.PI * 2;
    }
  };

  /**
   * Pure 2D Canvas vector rendering overlay
   */
  RadarMinimap.prototype.render = function (ctx, screenX, screenY) {
    if (!ctx) return;
    var r = this.options.radarRadius;
    var color = this.options.colorway;

    ctx.save();
    ctx.translate(screenX, screenY);
    ctx.globalAlpha = this.options.opacity;

    // 1. CRT Radar phosphor dark circle
    ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // 2. Concentric range rings
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = this.options.opacity * 0.4;

    for (var ring = 1; ring <= 3; ring++) {
      ctx.beginPath();
      ctx.arc(0, 0, (r / 3) * ring, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Cross reticle
    ctx.beginPath();
    ctx.moveTo(-r, 0); ctx.lineTo(r, 0);
    ctx.moveTo(0, -r); ctx.lineTo(0, r);
    ctx.stroke();

    // 3. Sweeping 360-degree beam
    ctx.globalAlpha = this.options.opacity * 0.6;
    var sweepGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    sweepGradient.addColorStop(0, color);
    sweepGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = sweepGradient;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, this.sweepAngle - 0.4, this.sweepAngle);
    ctx.closePath();
    ctx.fill();

    // 4. Center player blip
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();

    // 5. Tracked entity blips & off-screen clamped chevrons
    for (var id in this.entities) {
      if (!Object.prototype.hasOwnProperty.call(this.entities, id)) continue;
      var ent = this.entities[id];
      var ex = typeof ent.getX === 'function' ? ent.getX() : ent.x;
      var ey = typeof ent.getY === 'function' ? ent.getY() : ent.y;

      var proj = this.projectCoordinate(ex, ey);
      ctx.fillStyle = ent.color || color;

      if (!proj.isOffscreen) {
        // Inner blip
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Edge-clamped chevron indicator
        ctx.save();
        ctx.translate(proj.x, proj.y);
        ctx.rotate(proj.angle);
        ctx.beginPath();
        ctx.moveTo(4, 0);
        ctx.lineTo(-4, -3);
        ctx.lineTo(-2, 0);
        ctx.lineTo(-4, 3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // Outer CRT bezel ring
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = this.options.opacity;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  };

  return RadarMinimap;
});
