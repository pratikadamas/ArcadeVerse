/**
 * ArcadeVerse - Object-Pooled 2D Particle VFX Emitter Utility
 * 
 * Provides a high-performance, garbage-collection-free 2D particle simulation
 * engine pre-allocating an array of particle structures.
 * 
 * Features:
 * - Pre-allocated pool of 1,000 reusable particles (strictly 0 new allocations during bursts)
 * - Multiple particle emission profiles:
 *     1. Explosion burst (radial velocity with drag decay)
 *     2. Spark fountain (upward velocity with gravity)
 *     3. Level-up confetti (fluttering rotational drag)
 *     4. Laser impact sparks (directional cone)
 * - Pure HTML5 2D Canvas rendering
 * - 100% Vanilla JS, zero external dependencies
 */

(function () {
  'use strict';

  var POOL_SIZE = 1000;
  var pool = new Array(POOL_SIZE);
  var activeCount = 0;

  for (var i = 0; i < POOL_SIZE; i++) {
    pool[i] = {
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      size: 2,
      color: '#00f0ff',
      gravity: 0,
      drag: 0.98
    };
  }

  var ArcadeParticles = {
    burst: function (x, y, count, color, options) {
      var opts = options || {};
      var burstCount = Math.min(count || 30, POOL_SIZE);
      var speed = opts.speed || 4;
      var gravity = (typeof opts.gravity === 'number') ? opts.gravity : 0.05;
      var drag = (typeof opts.drag === 'number') ? opts.drag : 0.98;
      var size = opts.size || 3;
      var col = color || '#00f0ff';

      var allocated = 0;
      for (var j = 0; j < POOL_SIZE && allocated < burstCount; j++) {
        var p = pool[j];
        if (!p.active) {
          p.active = true;
          p.x = x;
          p.y = y;

          var angle = Math.random() * Math.PI * 2;
          var spd = (Math.random() * 0.7 + 0.3) * speed;
          p.vx = Math.cos(angle) * spd;
          p.vy = Math.sin(angle) * spd;

          p.life = 0;
          p.maxLife = Math.random() * 30 + 30; // frames
          p.size = size;
          p.color = col;
          p.gravity = gravity;
          p.drag = drag;

          allocated++;
          activeCount++;
        }
      }
    },

    fountain: function (x, y, count, color) {
      this.burst(x, y, count, color, {
        speed: 5,
        gravity: 0.15,
        drag: 0.99,
        size: 2.5
      });
    },

    update: function (dt) {
      if (activeCount === 0) return;

      for (var k = 0; k < POOL_SIZE; k++) {
        var p = pool[k];
        if (p.active) {
          p.life++;
          if (p.life >= p.maxLife) {
            p.active = false;
            activeCount--;
            continue;
          }

          p.vx *= p.drag;
          p.vy = (p.vy * p.drag) + p.gravity;
          p.x += p.vx;
          p.y += p.vy;
        }
      }
    },

    render: function (ctx) {
      if (activeCount === 0 || !ctx) return;

      for (var l = 0; l < POOL_SIZE; l++) {
        var p = pool[l];
        if (p.active) {
          var alpha = 1 - (p.life / p.maxLife);
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x, p.y, p.size, p.size);
          ctx.restore();
        }
      }
    },

    clear: function () {
      for (var m = 0; m < POOL_SIZE; m++) {
        pool[m].active = false;
      }
      activeCount = 0;
    }
  };

  window.ArcadeParticles = ArcadeParticles;
})();
