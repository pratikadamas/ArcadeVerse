/**
 * ArcadeVerse - Catalog Grid Density Scaling Slider
 * 
 * Provides an on-the-fly card density scaling controller for the ArcadeVerse games catalog.
 * Players can dynamically adjust card min-widths between Compact (180px), Comfortable (260px),
 * and Expanded (360px).
 * 
 * Features:
 * - Real-time CSS Custom Property manipulation (`--grid-card-min-width`)
 * - Responsive slider widget in the catalog toolbar
 * - Smooth CSS transitions without layout thrashing
 * - Persistent density setting stored in localStorage (`av_catalog_grid_density`)
 * - 100% Vanilla JS + CSS3, zero external dependencies
 */

(function () {
  'use strict';

  var STORAGE_KEY = 'av_catalog_grid_density';
  var DEFAULT_DENSITY = 260; // px
  var currentDensity = DEFAULT_DENSITY;
  var initialized = false;

  var CatalogDensitySlider = {
    init: function () {
      if (initialized) return;
      initialized = true;

      this.loadConfig();
      this.injectStyles();
      this.injectWidget();
      this.applyDensity(currentDensity);
    },

    loadConfig: function () {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          var val = parseInt(raw, 10);
          if (!isNaN(val) && val >= 180 && val <= 380) {
            currentDensity = val;
          }
        }
      } catch (e) {}
    },

    saveConfig: function () {
      try {
        localStorage.setItem(STORAGE_KEY, String(currentDensity));
      } catch (e) {}
    },

    injectStyles: function () {
      if (document.getElementById('catalog-density-styles')) return;

      var style = document.createElement('style');
      style.id = 'catalog-density-styles';
      style.textContent = [
        ':root { --grid-card-min-width: 260px; }',
        '.games-grid { grid-template-columns: repeat(auto-fill, minmax(var(--grid-card-min-width), 1fr)) !important; transition: grid-template-columns 0.2s ease; }',
        '.density-slider-widget { display: flex; align-items: center; gap: 8px; background: rgba(22, 27, 34, 0.8); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 4px 10px; font-size: 0.75rem; color: #8b949e; }',
        '.density-slider-widget input[type="range"] { width: 85px; accent-color: #00f0ff; cursor: pointer; }',
        '.density-slider-label { font-weight: bold; color: #00f0ff; min-width: 38px; }'
      ].join('\n');
      document.head.appendChild(style);
    },

    injectWidget: function () {
      if (document.getElementById('catalog-density-widget')) return;

      var targetRow = document.querySelector('.catalog-view-switcher') || document.querySelector('.search-sort-wrapper') || document.getElementById('search-wrapper');
      if (!targetRow) return;

      var widget = document.createElement('div');
      widget.id = 'catalog-density-widget';
      widget.className = 'density-slider-widget';
      widget.title = 'Adjust Catalog Card Scale / Density';

      widget.innerHTML = [
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">',
        '  <rect x="3" y="3" width="7" height="7"></rect>',
        '  <rect x="14" y="3" width="7" height="7"></rect>',
        '  <rect x="14" y="14" width="7" height="7"></rect>',
        '  <rect x="3" y="14" width="7" height="7"></rect>',
        '</svg>',
        '<input type="range" id="density-range-input" min="180" max="360" step="10" value="' + currentDensity + '" aria-label="Card grid density slider">',
        '<span class="density-slider-label" id="density-val-label">' + currentDensity + 'px</span>'
      ].join('');

      targetRow.appendChild(widget);

      var input = document.getElementById('density-range-input');
      var label = document.getElementById('density-val-label');

      if (input) {
        input.addEventListener('input', function () {
          var val = parseInt(this.value, 10);
          CatalogDensitySlider.applyDensity(val);
          if (label) label.textContent = val + 'px';
        });

        input.addEventListener('change', function () {
          CatalogDensitySlider.saveConfig();
        });
      }
    },

    applyDensity: function (val) {
      currentDensity = val;
      document.documentElement.style.setProperty('--grid-card-min-width', val + 'px');
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      CatalogDensitySlider.init();
    });
  } else {
    CatalogDensitySlider.init();
  }

  window.CatalogDensitySlider = CatalogDensitySlider;
})();
