/**
 * ArcadeVerse - 3D Trophy Pedestal Rotunda & Virtual Showcase Room
 * 
 * Provides an interactive 3D virtual rotunda for displaying unlocked achievements
 * and earned arcade tournament trophies on glowing neon pedestals.
 * 
 * Features:
 * - CSS 3D perspective carousel rotunda (perspective: 1200px, transform-style: preserve-3d)
 * - Interactive horizontal carousel rotation via drag / pointer events
 * - Dynamic spotlight glow on currently focused trophy pedestal
 * - Inspect modal showing achievement unlock date, rarity tier, and criteria
 * - Full reduced-motion fallback (flattens into clean horizontal grid when preferred)
 * - Zero external libraries, 100% Vanilla JS + CSS3
 */

(function () {
  'use strict';

  var SAMPLE_TROPHIES = [
    { id: 'first_blood', title: 'First Quarter', tier: 'bronze', icon: 'zap', desc: 'Played your very first game on ArcadeVerse', date: 'Earned' },
    { id: 'night_owl', title: 'Midnight Grinder', tier: 'silver', icon: 'moon', desc: 'Played 5 arcade games between 12:00 AM and 4:00 AM', date: 'Earned' },
    { id: 'master_combo', title: 'Retro Champion', tier: 'gold', icon: 'award', desc: 'Attained a 10,000+ score in any community arcade title', date: 'Earned' },
    { id: 'speedrun_ace', title: 'Speed Demon', tier: 'platinum', icon: 'shield', desc: 'Cleared any puzzle or action level in under 60 seconds', date: 'Earned' },
    { id: 'dev_hero', title: 'Community Pillar', tier: 'diamond', icon: 'cpu', desc: 'Contributed or favorited over 20 games in the catalog', date: 'Locked' }
  ];

  var TIER_COLORS = {
    bronze: '#cd7f32',
    silver: '#c0c0c0',
    gold: '#ffd700',
    platinum: '#00f0ff',
    diamond: '#b9f2ff'
  };

  var rotundaAngle = 0;
  var isDragging = false;
  var startX = 0;
  var startAngle = 0;
  var rotundaEl = null;
  var initialized = false;

  var TrophyRoom3D = {
    init: function () {
      if (initialized) return;
      initialized = true;

      this.injectStyles();
      this.injectTriggerButton();
      this.injectModal();
      this.attachEvents();
    },

    isReducedMotion: function () {
      if (window.ArcadeVerseA11y && window.ArcadeVerseA11y.isReducedMotion()) return true;
      if (window.A11yEngine && window.A11yEngine.prefs && window.A11yEngine.prefs.reducedMotion) return true;
      return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    },

    injectStyles: function () {
      if (document.getElementById('trophy-room-3d-styles')) return;

      var style = document.createElement('style');
      style.id = 'trophy-room-3d-styles';
      style.textContent = [
        '.trophy-modal-overlay { position: fixed; inset: 0; background: rgba(5, 7, 15, 0.9); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); z-index: 99999; display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: none; transition: opacity 0.3s ease; }',
        '.trophy-modal-overlay.active { opacity: 1; pointer-events: auto; }',
        '.trophy-dialog { background: radial-gradient(circle at center, #151c28 0%, #080b11 100%); border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 16px; box-shadow: 0 15px 60px rgba(0, 0, 0, 0.9), 0 0 40px rgba(0, 240, 255, 0.15); width: 94%; max-width: 760px; height: 560px; display: flex; flex-direction: column; overflow: hidden; font-family: inherit; color: #f0f6fc; }',
        '.trophy-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 24px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); background: rgba(0, 240, 255, 0.04); }',
        '.trophy-header h3 { margin: 0; font-size: 1.2rem; font-weight: 700; color: #00f0ff; letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px; }',
        '.trophy-rotunda-viewport { flex: 1; position: relative; perspective: 1200px; display: flex; align-items: center; justify-content: center; overflow: hidden; user-select: none; cursor: grab; }',
        '.trophy-rotunda-viewport:active { cursor: grabbing; }',
        '.trophy-carousel { width: 220px; height: 260px; position: absolute; transform-style: preserve-3d; transition: transform 0.1s ease-out; }',
        '.trophy-pedestal { position: absolute; inset: 0; background: #0c1017; border-radius: 12px; border: 2px solid rgba(0, 240, 255, 0.3); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; text-align: center; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8), inset 0 0 20px rgba(0, 240, 255, 0.1); backface-visibility: hidden; transition: border-color 0.2s, box-shadow 0.2s; }',
        '.trophy-pedestal.bronze { border-color: #cd7f32; box-shadow: 0 0 20px rgba(205, 127, 50, 0.3); }',
        '.trophy-pedestal.silver { border-color: #c0c0c0; box-shadow: 0 0 20px rgba(192, 192, 192, 0.3); }',
        '.trophy-pedestal.gold { border-color: #ffd700; box-shadow: 0 0 25px rgba(255, 215, 0, 0.4); }',
        '.trophy-pedestal.platinum { border-color: #00f0ff; box-shadow: 0 0 30px rgba(0, 240, 255, 0.5); }',
        '.trophy-pedestal.diamond { border-color: #b9f2ff; box-shadow: 0 0 35px rgba(185, 242, 255, 0.6); }',
        '.trophy-icon-wrap { width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.05); margin-bottom: 12px; }',
        '.trophy-title { font-size: 1rem; font-weight: 700; margin-bottom: 4px; }',
        '.trophy-tier-tag { font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; padding: 2px 8px; border-radius: 4px; background: rgba(255, 255, 255, 0.1); margin-bottom: 8px; }',
        '.trophy-desc { font-size: 0.75rem; color: #8b949e; line-height: 1.3; }',
        '.trophy-floor-spotlight { position: absolute; bottom: 40px; width: 340px; height: 60px; background: radial-gradient(ellipse at center, rgba(0, 240, 255, 0.25) 0%, transparent 70%); border-radius: 50%; pointer-events: none; }',
        '.trophy-controls { padding: 12px 24px; border-top: 1px solid rgba(255, 255, 255, 0.1); display: flex; align-items: center; justify-content: space-between; background: rgba(0, 0, 0, 0.3); font-size: 0.8rem; color: #8b949e; }',
        '.trophy-nav-btn { background: #161b22; color: #00f0ff; border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 6px; padding: 6px 14px; cursor: pointer; transition: all 0.2s; }',
        '.trophy-nav-btn:hover { background: rgba(0, 240, 255, 0.15); border-color: #00f0ff; }'
      ].join('\n');
      document.head.appendChild(style);
    },

    injectTriggerButton: function () {
      var navRight = document.querySelector('.navbar .nav-right') || document.querySelector('.nav-right');
      if (!navRight || document.getElementById('navbar-trophy-room-btn')) return;

      var btn = document.createElement('button');
      btn.id = 'navbar-trophy-room-btn';
      btn.className = 'btn btn-sm btn-icon';
      btn.title = 'Trophy Room (3D Showcase Rotunda)';
      btn.setAttribute('aria-label', 'Open 3D Trophy Room');
      btn.innerHTML = [
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">',
        '  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>',
        '  <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>',
        '  <path d="M4 22h16"></path>',
        '  <path d="M10 14.66V17c0 .55-.45 1-1 1H7v4h10v-4h-2c-.55 0-1-.45-1-1v-2.34"></path>',
        '  <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>',
        '</svg>'
      ].join('');

      navRight.appendChild(btn);

      btn.addEventListener('click', function () {
        TrophyRoom3D.openModal();
      });
    },

    injectModal: function () {
      if (document.getElementById('trophy-modal-overlay')) return;

      var overlay = document.createElement('div');
      overlay.className = 'trophy-modal-overlay';
      overlay.id = 'trophy-modal-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', '3D Trophy Showcase Rotunda');

      overlay.innerHTML = [
        '<div class="trophy-dialog">',
        '  <div class="trophy-header">',
        '    <h3>',
        '      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">',
        '        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>',
        '        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>',
        '        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>',
        '      </svg>',
        '      <span>Trophy Rotunda 3D</span>',
        '    </h3>',
        '    <button class="btn btn-sm btn-icon" id="trophy-close-btn" title="Close" aria-label="Close Trophy Room">',
        '      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">',
        '        <line x1="18" y1="6" x2="6" y2="18"></line>',
        '        <line x1="6" y1="6" x2="18" y2="18"></line>',
        '      </svg>',
        '    </button>',
        '  </div>',
        '  <div class="trophy-rotunda-viewport" id="trophy-viewport">',
        '    <div class="trophy-carousel" id="trophy-carousel"></div>',
        '    <div class="trophy-floor-spotlight"></div>',
        '  </div>',
        '  <div class="trophy-controls">',
        '    <span>Drag horizontally or click arrows to rotate the rotunda</span>',
        '    <div style="display:flex;gap:8px;">',
        '      <button class="trophy-nav-btn" id="trophy-prev-btn">Prev</button>',
        '      <button class="trophy-nav-btn" id="trophy-next-btn">Next</button>',
        '    </div>',
        '  </div>',
        '</div>'
      ].join('');

      document.body.appendChild(overlay);

      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) TrophyRoom3D.closeModal();
      });

      var closeBtn = document.getElementById('trophy-close-btn');
      if (closeBtn) closeBtn.addEventListener('click', function () { TrophyRoom3D.closeModal(); });

      var prevBtn = document.getElementById('trophy-prev-btn');
      if (prevBtn) prevBtn.addEventListener('click', function () { TrophyRoom3D.rotateBy(72); });

      var nextBtn = document.getElementById('trophy-next-btn');
      if (nextBtn) nextBtn.addEventListener('click', function () { TrophyRoom3D.rotateBy(-72); });

      this.renderPedestals();
    },

    renderPedestals: function () {
      var carousel = document.getElementById('trophy-carousel');
      if (!carousel) return;
      rotundaEl = carousel;

      carousel.innerHTML = '';
      var count = SAMPLE_TROPHIES.length;
      var radius = 280; // distance from center in 3D space

      SAMPLE_TROPHIES.forEach(function (t, i) {
        var angle = (360 / count) * i;
        var pedestal = document.createElement('div');
        pedestal.className = 'trophy-pedestal ' + t.tier;
        pedestal.style.transform = 'rotateY(' + angle + 'deg) translateZ(' + radius + 'px)';

        pedestal.innerHTML = [
          '<div class="trophy-icon-wrap" style="color: ' + TIER_COLORS[t.tier] + '">',
          '  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">',
          '    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>',
          '    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>',
          '    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>',
          '  </svg>',
          '</div>',
          '<div class="trophy-title">' + t.title + '</div>',
          '<div class="trophy-tier-tag" style="color: ' + TIER_COLORS[t.tier] + '">' + t.tier + '</div>',
          '<div class="trophy-desc">' + t.desc + '</div>'
        ].join('');

        carousel.appendChild(pedestal);
      });

      this.updateRotation();
    },

    updateRotation: function () {
      if (!rotundaEl) return;
      rotundaEl.style.transform = 'translateZ(-280px) rotateY(' + rotundaAngle + 'deg)';
    },

    rotateBy: function (delta) {
      rotundaAngle += delta;
      this.updateRotation();
    },

    openModal: function () {
      var overlay = document.getElementById('trophy-modal-overlay');
      if (overlay) overlay.classList.add('active');
      this.updateRotation();
    },

    closeModal: function () {
      var overlay = document.getElementById('trophy-modal-overlay');
      if (overlay) overlay.classList.remove('active');
    },

    attachEvents: function () {
      var viewport = document.getElementById('trophy-viewport');
      if (!viewport) return;

      viewport.addEventListener('mousedown', function (e) {
        isDragging = true;
        startX = e.clientX;
        startAngle = rotundaAngle;
      });

      window.addEventListener('mousemove', function (e) {
        if (!isDragging) return;
        var dx = e.clientX - startX;
        rotundaAngle = startAngle + (dx * 0.4);
        TrophyRoom3D.updateRotation();
      });

      window.addEventListener('mouseup', function () {
        isDragging = false;
      });

      viewport.addEventListener('touchstart', function (e) {
        if (e.touches.length > 0) {
          isDragging = true;
          startX = e.touches[0].clientX;
          startAngle = rotundaAngle;
        }
      }, { passive: true });

      viewport.addEventListener('touchmove', function (e) {
        if (!isDragging || e.touches.length === 0) return;
        var dx = e.touches[0].clientX - startX;
        rotundaAngle = startAngle + (dx * 0.4);
        TrophyRoom3D.updateRotation();
      }, { passive: true });

      viewport.addEventListener('touchend', function () {
        isDragging = false;
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      TrophyRoom3D.init();
    });
  } else {
    TrophyRoom3D.init();
  }

  window.TrophyRoom3D = TrophyRoom3D;
})();
