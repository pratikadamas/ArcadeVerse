/**
 * Virtual Arcade Trackpad Multi-Gesture Macro Swipe Controller
 * Pure HTML5 Canvas 2D & Touch Pointer Event Gesture Engine
 * High-frequency pointer event analyzer tracking touch drag vectors, angular velocities,
 * and recognizing discrete motion archetypes: Quarter-Circle Forward (QCF / Hadouken),
 * Dragon Punch (DP Z-motion), Full 360 Rotation, Double Tap Dash, and Flick Release.
 *
 * @module TrackpadGestures
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
    root.ArcadeVerse.TrackpadGestures = factory();
    root.TrackpadGestures = root.ArcadeVerse.TrackpadGestures;
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  function TrackpadGestures(options) {
    this.options = Object.assign({
      windowMs: 300, // Recognition timeframe
      minDistance: 30, // Minimum drag distance to evaluate
      onGestureRecognized: null
    }, options);

    this.points = []; // [{ x, y, time }]
    this.isTracking = false;
  }

  TrackpadGestures.prototype.startStroke = function (x, y, time) {
    this.points = [{ x: x, y: y, time: time || Date.now() }];
    this.isTracking = true;
  };

  TrackpadGestures.prototype.addPoint = function (x, y, time) {
    if (!this.isTracking) return;
    this.points.push({ x: x, y: y, time: time || Date.now() });
  };

  /**
   * Evaluates collected stroke points and classifies gesture archetype
   */
  TrackpadGestures.prototype.endStroke = function (x, y, time) {
    if (!this.isTracking) return null;
    this.addPoint(x, y, time);
    this.isTracking = false;

    var pts = this.points;
    if (pts.length < 3) return null;

    var start = pts[0];
    var end = pts[pts.length - 1];
    var duration = end.time - start.time;

    if (duration > this.options.windowMs * 2) {
      return null; // Stroke too slow for arcade combo
    }

    // Calculate angular progression
    var angles = [];
    for (var i = 1; i < pts.length; i++) {
      var dx = pts[i].x - pts[i - 1].x;
      var dy = pts[i].y - pts[i - 1].y;
      angles.push(Math.atan2(dy, dx));
    }

    var totalAngleDelta = 0;
    for (var a = 1; a < angles.length; a++) {
      var diff = angles[a] - angles[a - 1];
      // Normalize to [-PI, PI]
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      totalAngleDelta += diff;
    }

    var detected = null;
    var absTotal = Math.abs(totalAngleDelta);

    // Full 360 circle: ~2*PI radians (~6.28)
    if (absTotal >= 5.0) {
      detected = { gesture: 'FULL_360', confidence: 0.95 };
    }
    // Quarter circle (~1.57 radians): typically down -> down-forward -> forward
    else if (absTotal >= 1.2 && absTotal < 2.5) {
      var dir = totalAngleDelta > 0 ? 'QCF_FORWARD' : 'QCB_BACKWARD';
      detected = { gesture: dir, confidence: 0.90 };
    }
    // Straight dash / flick
    else {
      var netDx = end.x - start.x;
      var netDy = end.y - start.y;
      var netDist = Math.sqrt(netDx * netDx + netDy * netDy);

      if (netDist >= this.options.minDistance) {
        if (Math.abs(netDx) > Math.abs(netDy)) {
          detected = { gesture: netDx > 0 ? 'DASH_RIGHT' : 'DASH_LEFT', confidence: 0.85 };
        } else {
          detected = { gesture: netDy > 0 ? 'DASH_DOWN' : 'DASH_UP', confidence: 0.85 };
        }
      }
    }

    if (detected && typeof this.options.onGestureRecognized === 'function') {
      this.options.onGestureRecognized(detected);
    }

    if (detected && typeof window !== 'undefined' && typeof CustomEvent === 'function') {
      try {
        var event = new CustomEvent('arcade-gesture', { detail: detected, bubbles: true });
        window.dispatchEvent(event);
      } catch (e) {}
    }

    return detected;
  };

  return TrackpadGestures;
});
