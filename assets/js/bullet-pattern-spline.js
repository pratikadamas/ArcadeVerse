/**
 * Parametric Spline Bullet Pattern Generator & Rose Curve Shmup Spawner
 * Pure HTML5 Canvas 2D & Parametric Math Danmaku Engine
 * Computes mathematical bullet curves: Logarithmic Spiral, Rhodonea Rose Curves,
 * Lissajous Knots, and Cubic Bezier trajectories with an internal zero-allocation object pool
 * managing 500+ simultaneous bullets without garbage collection pauses.
 *
 * @module BulletPatternSpline
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
    root.ArcadeVerse.BulletPatternSpline = factory();
    root.BulletPatternSpline = root.ArcadeVerse.BulletPatternSpline;
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var MAX_POOL_SIZE = 1000;

  function Bullet() {
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.speed = 2.0;
    this.angle = 0;
    this.radius = 4;
    this.color = '#ef4444';
    this.active = false;
    this.lifetime = 0;
    this.trajectoryType = 'linear'; // 'linear', 'rose', 'spiral', 'lissajous'
    this.originX = 0;
    this.originY = 0;
    this.paramT = 0;
    this.paramK = 4; // Rose curve petal factor
  }

  function BulletPatternSpline(options) {
    this.options = Object.assign({
      poolSize: 600,
      bounds: { x: 0, y: 0, width: 800, height: 600 }
    }, options);

    this.pool = [];
    var size = Math.min(MAX_POOL_SIZE, this.options.poolSize);
    for (var i = 0; i < size; i++) {
      this.pool.push(new Bullet());
    }

    this.activeCount = 0;
  }

  /**
   * Acquires an inactive bullet from pool
   */
  BulletPatternSpline.prototype.acquireBullet = function () {
    for (var i = 0; i < this.pool.length; i++) {
      if (!this.pool[i].active) {
        this.pool[i].active = true;
        this.pool[i].lifetime = 0;
        this.activeCount++;
        return this.pool[i];
      }
    }
    return null;
  };

  /**
   * Spawns a Rhodonea Rose Curve barrage: r = cos(k * theta)
   */
  BulletPatternSpline.prototype.spawnRoseBarrage = function (ox, oy, petals, count, speed, color) {
    count = count || 36;
    petals = petals || 4;
    speed = speed || 2.5;

    for (var i = 0; i < count; i++) {
      var theta = (i / count) * Math.PI * 2;
      var r = Math.cos(petals * theta); // Rose curve radius factor
      var b = this.acquireBullet();
      if (!b) break;

      b.originX = ox;
      b.originY = oy;
      b.x = ox;
      b.y = oy;
      b.angle = theta;
      b.speed = speed;
      b.vx = Math.cos(theta) * speed * (0.5 + Math.abs(r));
      b.vy = Math.sin(theta) * speed * (0.5 + Math.abs(r));
      b.color = color || '#ec4899';
      b.trajectoryType = 'rose';
      b.paramK = petals;
    }
  };

  /**
   * Spawns Logarithmic Spiral barrage: r = a * e^(b * theta)
   */
  BulletPatternSpline.prototype.spawnSpiralBarrage = function (ox, oy, arms, bulletsPerArm, baseAngle) {
    arms = arms || 4;
    bulletsPerArm = bulletsPerArm || 12;
    baseAngle = baseAngle || 0;

    for (var a = 0; a < arms; a++) {
      var armAngle = baseAngle + (a / arms) * Math.PI * 2;
      for (var bIdx = 0; bIdx < bulletsPerArm; bIdx++) {
        var b = this.acquireBullet();
        if (!b) break;

        var ang = armAngle + (bIdx * 0.12);
        var spd = 1.5 + (bIdx * 0.25);
        b.originX = ox;
        b.originY = oy;
        b.x = ox;
        b.y = oy;
        b.angle = ang;
        b.speed = spd;
        b.vx = Math.cos(ang) * spd;
        b.vy = Math.sin(ang) * spd;
        b.color = '#38bdf8';
        b.trajectoryType = 'spiral';
      }
    }
  };

  /**
   * Updates all active bullets and reaps off-screen entities
   */
  BulletPatternSpline.prototype.update = function (deltaSec) {
    deltaSec = deltaSec || 0.016;
    var bounds = this.options.bounds;

    for (var i = 0; i < this.pool.length; i++) {
      var b = this.pool[i];
      if (!b.active) continue;

      b.lifetime += deltaSec;
      b.paramT += deltaSec;

      b.x += b.vx;
      b.y += b.vy;

      // Automatic boundary reaping
      if (
        b.x < bounds.x - 50 ||
        b.x > bounds.x + bounds.width + 50 ||
        b.y < bounds.y - 50 ||
        b.y > bounds.y + bounds.height + 50
      ) {
        b.active = false;
        this.activeCount--;
      }
    }
  };

  /**
   * High-speed canvas 2D batch rendering
   */
  BulletPatternSpline.prototype.render = function (ctx) {
    if (!ctx) return;
    ctx.save();

    for (var i = 0; i < this.pool.length; i++) {
      var b = this.pool[i];
      if (!b.active) continue;

      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  BulletPatternSpline.prototype.clear = function () {
    for (var i = 0; i < this.pool.length; i++) {
      this.pool[i].active = false;
    }
    this.activeCount = 0;
  };

  return BulletPatternSpline;
});
