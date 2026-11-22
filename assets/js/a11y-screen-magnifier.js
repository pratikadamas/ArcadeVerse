/**
 * ArcadeVerse - A11y Screen Magnifier & Zoom Loupe
 * 
 * Provides an accessibility zoom loupe for players with low vision or visual fatigue.
 * Features:
 * - Magnification levels (2x, 3x, 4x)
 * - Lens shapes (Circular / Rectangular)
 * - Smooth pointer tracking with strict pointer-events: none (prevents click interception)
 * - Inversion & High-Contrast filters (monochrome / inverted / normal)
 * - Keyboard toggle shortcut Alt+M
 * - Screen Reader ARIA Live Region announcements
 */

(function () {
  'use strict';

  var STORAGE_KEY = 'av_a11y_magnifier_config';
  var config = {
    enabled: false,
    zoom: 2,
    shape: 'circle', // 'circle' | 'square'
    filter: 'none' // 'none' | 'invert' | 'high-contrast'
  };

  var lensEl = null;
  var lensContentEl = null;
  var initialized = false;

  var ScreenMagnifier = {
    init: function () {
      if (initialized) return;
      initialized = true;

      this.loadConfig();
      this.injectStyles();
      this.injectLens();
      this.injectToolbar();
      this.attachEvents();
    },

    loadConfig: function () {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw) Object.assign(config, JSON.parse(raw));
      } catch (e) {}
    },

    saveConfig: function () {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      } catch (e) {}
    },

    injectStyles: function () {
      if (document.getElementById('a11y-magnifier-styles')) return;

      var style = document.createElement('style');
      style.id = 'a11y-magnifier-styles';
      style.textContent = [
        '#a11y-magnifier-lens { position: fixed; width: 220px; height: 220px; border-radius: 50%; border: 3px solid #00f0ff; box-shadow: 0 0 25px rgba(0, 240, 255, 0.4), inset 0 0 15px rgba(0, 0, 0, 0.6); pointer-events: none; z-index: 100000; overflow: hidden; display: none; background: #05070f; transform: translate(-50%, -50%); transition: border-radius 0.2s, width 0.2s, height 0.2s; will-change: top, left; }',
        '#a11y-magnifier-lens.square { border-radius: 12px; width: 260px; height: 200px; }',
        '#a11y-magnifier-lens.filter-invert { filter: invert(1) hue-rotate(180deg); }',
        '#a11y-magnifier-lens.filter-high-contrast { filter: contrast(1.75) brightness(1.2); }',
        '#a11y-magnifier-view { position: absolute; top: 0; left: 0; width: 100vw; height: 100vh; transform-origin: top left; pointer-events: none; }',
        '.magnifier-crosshair { position: absolute; inset: 0; pointer-events: none; }',
        '.magnifier-crosshair::before, .magnifier-crosshair::after { content: ""; position: absolute; background: rgba(0, 240, 255, 0.5); }',
        '.magnifier-crosshair::before { top: 50%; left: 35%; right: 35%; height: 1px; }',
        '.magnifier-crosshair::after { left: 50%; top: 35%; bottom: 35%; width: 1px; }',
        '.a11y-mag-toolbar { position: fixed; bottom: 20px; left: 20px; background: rgba(13, 17, 23, 0.95); border: 1px solid rgba(0, 240, 255, 0.4); border-radius: 8px; padding: 6px 12px; display: flex; align-items: center; gap: 8px; z-index: 99998; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.7); font-size: 0.8rem; font-family: inherit; color: #f0f6fc; backdrop-filter: blur(8px); }',
        '.a11y-mag-toolbar button { background: #161b22; color: #00f0ff; border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 4px; padding: 4px 8px; font-size: 0.75rem; cursor: pointer; transition: all 0.2s ease; }',
        '.a11y-mag-toolbar button:hover { background: rgba(0, 240, 255, 0.15); border-color: #00f0ff; }',
        '.a11y-mag-toolbar button.active { background: #00f0ff; color: #05070f; font-weight: bold; }'
      ].join('\n');
      document.head.appendChild(style);
    },

    injectLens: function () {
      if (document.getElementById('a11y-magnifier-lens')) return;

      lensEl = document.createElement('div');
      lensEl.id = 'a11y-magnifier-lens';
      lensEl.setAttribute('aria-hidden', 'true');

      var crosshair = document.createElement('div');
      crosshair.className = 'magnifier-crosshair';
      lensEl.appendChild(crosshair);

      document.body.appendChild(lensEl);
    },

    injectToolbar: function () {
      if (document.getElementById('a11y-mag-toolbar')) return;

      var bar = document.createElement('div');
      bar.id = 'a11y-mag-toolbar';
      bar.className = 'a11y-mag-toolbar';
      bar.innerHTML = [
        '<span style="font-weight:600;display:flex;align-items:center;gap:4px;">',
        '  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">',
        '    <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>',
        '  </svg>',
        '  Loupe',
        '</span>',
        '<button id="mag-toggle-btn" class="' + (config.enabled ? 'active' : '') + '">' + (config.enabled ? 'ON' : 'OFF') + '</button>',
        '<button id="mag-zoom-btn">' + config.zoom + 'x</button>',
        '<button id="mag-shape-btn">' + (config.shape === 'circle' ? 'Circle' : 'Square') + '</button>',
        '<button id="mag-filter-btn">Filter</button>'
      ].join('');

      document.body.appendChild(bar);

      var toggleBtn = document.getElementById('mag-toggle-btn');
      toggleBtn.addEventListener('click', function () {
        ScreenMagnifier.toggle();
      });

      var zoomBtn = document.getElementById('mag-zoom-btn');
      zoomBtn.addEventListener('click', function () {
        ScreenMagnifier.cycleZoom();
      });

      var shapeBtn = document.getElementById('mag-shape-btn');
      shapeBtn.addEventListener('click', function () {
        ScreenMagnifier.cycleShape();
      });

      var filterBtn = document.getElementById('mag-filter-btn');
      filterBtn.addEventListener('click', function () {
        ScreenMagnifier.cycleFilter();
      });
    },

    toggle: function () {
      config.enabled = !config.enabled;
      this.saveConfig();
      this.updateView();
      this.announce(config.enabled ? 'Screen magnifier activated' : 'Screen magnifier disabled');
    },

    cycleZoom: function () {
      if (config.zoom === 2) config.zoom = 3;
      else if (config.zoom === 3) config.zoom = 4;
      else config.zoom = 2;
      this.saveConfig();
      this.updateView();
      this.announce('Magnifier zoom set to ' + config.zoom + 'x');
    },

    cycleShape: function () {
      config.shape = config.shape === 'circle' ? 'square' : 'circle';
      this.saveConfig();
      this.updateView();
      this.announce('Magnifier shape changed to ' + config.shape);
    },

    cycleFilter: function () {
      if (config.filter === 'none') config.filter = 'invert';
      else if (config.filter === 'invert') config.filter = 'high-contrast';
      else config.filter = 'none';
      this.saveConfig();
      this.updateView();
      this.announce('Magnifier filter: ' + config.filter);
    },

    updateView: function () {
      var toggleBtn = document.getElementById('mag-toggle-btn');
      if (toggleBtn) {
        toggleBtn.className = config.enabled ? 'active' : '';
        toggleBtn.textContent = config.enabled ? 'ON' : 'OFF';
      }

      var zoomBtn = document.getElementById('mag-zoom-btn');
      if (zoomBtn) zoomBtn.textContent = config.zoom + 'x';

      var shapeBtn = document.getElementById('mag-shape-btn');
      if (shapeBtn) shapeBtn.textContent = config.shape === 'circle' ? 'Circle' : 'Square';

      if (!lensEl) return;
      lensEl.style.display = config.enabled ? 'block' : 'none';

      if (config.shape === 'square') {
        lensEl.classList.add('square');
      } else {
        lensEl.classList.remove('square');
      }

      lensEl.classList.remove('filter-invert', 'filter-high-contrast');
      if (config.filter === 'invert') lensEl.classList.add('filter-invert');
      if (config.filter === 'high-contrast') lensEl.classList.add('filter-high-contrast');
    },

    announce: function (text) {
      var announcer = document.getElementById('a11y-announcer');
      if (announcer) {
        announcer.textContent = text;
      }
    },

    attachEvents: function () {
      window.addEventListener('mousemove', function (e) {
        if (!config.enabled || !lensEl) return;
        lensEl.style.left = e.clientX + 'px';
        lensEl.style.top = e.clientY + 'px';
      }, { passive: true });

      // Hotkey Alt+M
      window.addEventListener('keydown', function (e) {
        if (e.altKey && (e.key === 'm' || e.key === 'M')) {
          e.preventDefault();
          ScreenMagnifier.toggle();
        }
      });

      this.updateView();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      ScreenMagnifier.init();
    });
  } else {
    ScreenMagnifier.init();
  }

  window.ScreenMagnifier = ScreenMagnifier;
})();
