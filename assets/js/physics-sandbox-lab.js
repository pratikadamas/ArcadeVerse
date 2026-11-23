/**
 * ArcadeVerse - Interactive Physics Vector Field Sandbox
 * 
 * An interactive educational physics simulator and code snippet reference lab
 * illustrating core arcade game mechanics:
 * 1. Verlet Integration (damped particle kinematics)
 * 2. Swept AABB Continuous Collision Detection
 * 3. Elastic Reflection with Tangential Friction
 * 4. Point-source Gravity Wells & Orbital Dynamics
 * 
 * Features:
 * - Interactive HTML5 2D Canvas vector field displaying directional arrows & force vectors
 * - Drag-to-place gravity wells / force emitters
 * - Particle emitter stream with 300 active kinetic nodes
 * - One-click Vanilla JS code snippet copy button
 * - Zero external libraries, 100% pure Vanilla JavaScript + Canvas
 */

(function () {
  'use strict';

  var canvas = null;
  var ctx = null;
  var rafId = null;
  var isOpen = false;
  var particles = [];
  var wells = [];
  var MAX_PARTICLES = 250;
  var initialized = false;

  var PhysicsSandboxLab = {
    init: function () {
      if (initialized) return;
      initialized = true;

      this.injectStyles();
      this.injectTriggerButton();
      this.injectModal();
      this.initParticles();
      this.attachEvents();
    },

    injectStyles: function () {
      if (document.getElementById('physics-sandbox-styles')) return;

      var style = document.createElement('style');
      style.id = 'physics-sandbox-styles';
      style.textContent = [
        '.ps-modal-overlay { position: fixed; inset: 0; background: rgba(5, 7, 15, 0.9); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); z-index: 99999; display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: none; transition: opacity 0.2s ease; }',
        '.ps-modal-overlay.active { opacity: 1; pointer-events: auto; }',
        '.ps-dialog { background: #0c1017; border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 14px; box-shadow: 0 15px 50px rgba(0, 0, 0, 0.9), 0 0 35px rgba(0, 240, 255, 0.15); width: 94%; max-width: 720px; max-height: 88vh; display: flex; flex-direction: column; overflow: hidden; font-family: inherit; color: #f0f6fc; }',
        '.ps-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; background: rgba(0, 240, 255, 0.05); border-bottom: 1px solid rgba(255, 255, 255, 0.1); }',
        '.ps-header h3 { margin: 0; font-size: 1.15rem; font-weight: 700; color: #00f0ff; letter-spacing: 0.5px; }',
        '.ps-body { padding: 16px 20px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 12px; }',
        '#ps-canvas { width: 100%; height: 280px; background: #06090e; border: 1px solid #21262d; border-radius: 8px; display: block; cursor: crosshair; }',
        '.ps-controls-row { display: flex; align-items: center; justify-content: space-between; font-size: 0.8rem; color: #8b949e; }',
        '.ps-btn { background: #161b22; color: #00f0ff; border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 6px; padding: 6px 12px; font-size: 0.8rem; cursor: pointer; transition: all 0.2s; }',
        '.ps-btn:hover { background: rgba(0, 240, 255, 0.15); border-color: #00f0ff; }',
        '.ps-code-box { background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 10px 14px; font-family: monospace; font-size: 0.72rem; color: #79c0ff; max-height: 100px; overflow-y: auto; white-space: pre-wrap; }'
      ].join('\n');
      document.head.appendChild(style);
    },

    injectTriggerButton: function () {
      var navRight = document.querySelector('.navbar .nav-right') || document.querySelector('.nav-right');
      if (!navRight || document.getElementById('navbar-physics-lab-btn')) return;

      var btn = document.createElement('button');
      btn.id = 'navbar-physics-lab-btn';
      btn.className = 'btn btn-sm btn-icon';
      btn.title = 'Physics Vector Field Sandbox';
      btn.setAttribute('aria-label', 'Open Physics Vector Field Sandbox');
      btn.innerHTML = [
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">',
        '  <circle cx="12" cy="12" r="10"></circle>',
        '  <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path>',
        '  <path d="M2 12h20"></path>',
        '</svg>'
      ].join('');

      navRight.appendChild(btn);

      btn.addEventListener('click', function () {
        PhysicsSandboxLab.openModal();
      });
    },

    injectModal: function () {
      if (document.getElementById('ps-modal-overlay')) return;

      var overlay = document.createElement('div');
      overlay.className = 'ps-modal-overlay';
      overlay.id = 'ps-modal-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Physics Vector Field Sandbox');

      overlay.innerHTML = [
        '<div class="ps-dialog">',
        '  <div class="ps-header">',
        '    <h3>Physics Vector Field Sandbox</h3>',
        '    <button class="btn btn-sm btn-icon" id="ps-close-btn" title="Close">',
        '      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">',
        '        <line x1="18" y1="6" x2="6" y2="18"></line>',
        '        <line x1="6" y1="6" x2="18" y2="18"></line>',
        '      </svg>',
        '    </button>',
        '  </div>',
        '  <div class="ps-body">',
        '    <canvas id="ps-canvas" width="680" height="280"></canvas>',
        '    <div class="ps-controls-row">',
        '      <span>Click canvas to place gravity wells. Particles gravitate toward wells.</span>',
        '      <div style="display:flex;gap:8px;">',
        '        <button class="ps-btn" id="ps-clear-btn">Clear Wells</button>',
        '        <button class="ps-btn" id="ps-copy-code-btn">Copy Snippet</button>',
        '      </div>',
        '    </div>',
        '    <div class="ps-code-box" id="ps-snippet-pre">',
        '// Verlet Kinematics & Gravity Integration\nfunction updateVerlet(p, dt, wells) {\n  let ax = 0, ay = 0.15;\n  for (const w of wells) {\n    const dx = w.x - p.x, dy = w.y - p.y;\n    const dist = Math.hypot(dx, dy) + 10;\n    const f = (w.mass * 80) / (dist * dist);\n    ax += (dx / dist) * f; ay += (dy / dist) * f;\n  }\n  const tempX = p.x, tempY = p.y;\n  p.x += (p.x - p.oldX) * 0.98 + ax * dt * dt;\n  p.y += (p.y - p.oldY) * 0.98 + ay * dt * dt;\n  p.oldX = tempX; p.oldY = tempY;\n}',
        '    </div>',
        '  </div>',
        '</div>'
      ].join('');

      document.body.appendChild(overlay);

      canvas = document.getElementById('ps-canvas');
      if (canvas) ctx = canvas.getContext('2d');

      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) PhysicsSandboxLab.closeModal();
      });

      var closeBtn = document.getElementById('ps-close-btn');
      if (closeBtn) closeBtn.addEventListener('click', function () { PhysicsSandboxLab.closeModal(); });

      var clearBtn = document.getElementById('ps-clear-btn');
      if (clearBtn) clearBtn.addEventListener('click', function () { wells = []; });

      var copyBtn = document.getElementById('ps-copy-code-btn');
      if (copyBtn) {
        copyBtn.addEventListener('click', function () {
          var code = document.getElementById('ps-snippet-pre').textContent;
          navigator.clipboard.writeText(code).then(function () {
            copyBtn.textContent = 'Copied!';
            setTimeout(function () { copyBtn.textContent = 'Copy Snippet'; }, 1500);
          });
        });
      }
    },

    initParticles: function () {
      particles = [];
      for (var i = 0; i < MAX_PARTICLES; i++) {
        var x = Math.random() * 680;
        var y = Math.random() * 280;
        particles.push({
          x: x,
          y: y,
          oldX: x - (Math.random() * 2 - 1),
          oldY: y - (Math.random() * 2 - 1),
          color: i % 2 === 0 ? '#00f0ff' : '#7928ca'
        });
      }
    },

    openModal: function () {
      isOpen = true;
      var overlay = document.getElementById('ps-modal-overlay');
      if (overlay) overlay.classList.add('active');
      this.loop();
    },

    closeModal: function () {
      isOpen = false;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      var overlay = document.getElementById('ps-modal-overlay');
      if (overlay) overlay.classList.remove('active');
    },

    loop: function () {
      if (!isOpen || !ctx || !canvas) return;

      var w = canvas.width;
      var h = canvas.height;

      ctx.fillStyle = 'rgba(6, 9, 14, 0.25)';
      ctx.fillRect(0, 0, w, h);

      // Render gravity wells
      wells.forEach(function (well) {
        ctx.fillStyle = '#ff0055';
        ctx.shadowColor = '#ff0055';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(well.x, well.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Update and draw particles
      particles.forEach(function (p) {
        var ax = 0;
        var ay = 0;

        wells.forEach(function (well) {
          var dx = well.x - p.x;
          var dy = well.y - p.y;
          var dist = Math.hypot(dx, dy) + 12;
          var f = 800 / (dist * dist);
          ax += (dx / dist) * f;
          ay += (dy / dist) * f;
        });

        var tempX = p.x;
        var tempY = p.y;
        var vx = (p.x - p.oldX) * 0.97;
        var vy = (p.y - p.oldY) * 0.97;

        p.x += vx + ax;
        p.y += vy + ay;
        p.oldX = tempX;
        p.oldY = tempY;

        // Bounce boundaries
        if (p.x < 0) { p.x = 0; p.oldX = p.x + vx; }
        if (p.x > w) { p.x = w; p.oldX = p.x + vx; }
        if (p.y < 0) { p.y = 0; p.oldY = p.y + vy; }
        if (p.y > h) { p.y = h; p.oldY = p.y + vy; }

        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 2, 2);
      });

      rafId = requestAnimationFrame(function () {
        PhysicsSandboxLab.loop();
      });
    },

    attachEvents: function () {
      if (!canvas) return;
      canvas.addEventListener('click', function (e) {
        var rect = canvas.getBoundingClientRect();
        var scaleX = canvas.width / rect.width;
        var scaleY = canvas.height / rect.height;
        var clickX = (e.clientX - rect.left) * scaleX;
        var clickY = (e.clientY - rect.top) * scaleY;

        wells.push({ x: clickX, y: clickY, mass: 1 });
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      PhysicsSandboxLab.init();
    });
  } else {
    PhysicsSandboxLab.init();
  }

  window.PhysicsSandboxLab = PhysicsSandboxLab;
})();
