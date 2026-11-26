/**
 * ArcadeVerse - Customizable Game Category Badge Color Accent Studio
 * Architectural Implementation for Issue #1503
 *
 * - Manages CSS variables: --category-action, --category-puzzle,
 *   --category-arcade, --category-strategy, --category-retro, --category-rhythm.
 * - Provides 4 presets: Classic Neon, Pastel Synth, High-Contrast Accessible, Monochrome.
 * - Persists user customizations in localStorage ('arcadeverse_category_colors').
 * - Embeds live color pickers and Reset to Default inside the user settings drawer.
 * - 100% Vanilla JS and CSS3; zero external dependencies.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ArcadeBadgeColorStudio = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STORAGE_KEY = 'arcadeverse_category_colors';

  var CATEGORIES = ['action', 'puzzle', 'arcade', 'strategy', 'retro', 'rhythm'];

  var PRESETS = {
    'classic-neon': {
      label: 'Classic Neon',
      colors: {
        action: '#f43f5e',
        puzzle: '#a855f7',
        arcade: '#22d3ee',
        strategy: '#f59e0b',
        retro: '#10b981',
        rhythm: '#ec4899'
      }
    },
    'pastel-synth': {
      label: 'Pastel Synth',
      colors: {
        action: '#fda4af',
        puzzle: '#d8b4fe',
        arcade: '#67e8f9',
        strategy: '#fde68a',
        retro: '#6ee7b7',
        rhythm: '#f9a8d4'
      }
    },
    'high-contrast': {
      label: 'High-Contrast Accessible',
      colors: {
        action: '#ff3b30',
        puzzle: '#bf5af2',
        arcade: '#00f0ff',
        strategy: '#ffd60a',
        retro: '#30d158',
        rhythm: '#ff2d55'
      }
    },
    'monochrome': {
      label: 'Monochrome',
      colors: {
        action: '#f8fafc',
        puzzle: '#cbd5e1',
        arcade: '#e2e8f0',
        strategy: '#94a3b8',
        retro: '#ffffff',
        rhythm: '#cbd5e1'
      }
    }
  };

  var DEFAULT_COLORS = Object.assign({}, PRESETS['classic-neon'].colors);
  var currentColors = Object.assign({}, DEFAULT_COLORS);
  var activePreset = 'classic-neon';

  function isValidHex(hex) {
    return typeof hex === 'string' && /^#[0-9a-fA-F]{6}$/.test(hex.trim());
  }

  /**
   * Applies category CSS variables directly onto root document styles.
   *
   * @param {Object} [colorMap]
   * @param {Element} [rootEl]
   */
  function applyColors(colorMap, rootEl) {
    var colors = colorMap || currentColors;
    var target = rootEl || (typeof document !== 'undefined' ? document.documentElement : null);
    if (!target || !target.style || typeof target.style.setProperty !== 'function') return false;

    for (var i = 0; i < CATEGORIES.length; i++) {
      var cat = CATEGORIES[i];
      var val = isValidHex(colors[cat]) ? colors[cat].trim() : DEFAULT_COLORS[cat];
      target.style.setProperty('--category-' + cat, val);
    }
    return true;
  }

  function loadColors() {
    try {
      if (typeof localStorage !== 'undefined') {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          var parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            var source = parsed.colors && typeof parsed.colors === 'object' ? parsed.colors : parsed;
            for (var i = 0; i < CATEGORIES.length; i++) {
              var cat = CATEGORIES[i];
              if (isValidHex(source[cat])) {
                currentColors[cat] = source[cat].trim();
              }
            }
            if (typeof parsed.preset === 'string') {
              activePreset = parsed.preset;
            }
          }
        }
      }
    } catch (_) {}
    return Object.assign({}, currentColors);
  }

  function saveColors() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          preset: activePreset,
          colors: currentColors
        }));
      }
    } catch (_) {}
  }

  function applyPreset(presetId, rootEl) {
    var preset = PRESETS[presetId];
    if (!preset) return false;
    activePreset = presetId;
    currentColors = Object.assign({}, preset.colors);
    applyColors(currentColors, rootEl);
    saveColors();
    syncUI();
    return true;
  }

  function setCategoryColor(category, hexColor, rootEl) {
    var key = String(category || '').toLowerCase().trim();
    if (CATEGORIES.indexOf(key) === -1 || !isValidHex(hexColor)) return false;
    activePreset = 'custom';
    currentColors[key] = hexColor.trim();
    applyColors(currentColors, rootEl);
    saveColors();
    syncUI();
    return true;
  }

  function resetToDefault(rootEl) {
    activePreset = 'classic-neon';
    currentColors = Object.assign({}, DEFAULT_COLORS);
    applyColors(currentColors, rootEl);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (_) {}
    syncUI();
    return Object.assign({}, currentColors);
  }

  function getColors() {
    return Object.assign({}, currentColors);
  }

  function getActivePreset() {
    return activePreset;
  }

  function syncUI() {
    if (typeof document === 'undefined') return;
    var panel = document.getElementById('badge-color-studio-panel');
    if (!panel) return;

    panel.querySelectorAll('.badge-preset-btn').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-preset') === activePreset);
    });

    CATEGORIES.forEach(function (cat) {
      var input = document.getElementById('badge-color-picker-' + cat);
      if (input) input.value = currentColors[cat] || DEFAULT_COLORS[cat];
    });
  }

  function tagCardBadges(scope) {
    if (typeof document === 'undefined') return;
    var root = scope || document;
    var tags = root.querySelectorAll('.game-category-tag');
    for (var i = 0; i < tags.length; i++) {
      var text = (tags[i].textContent || '').trim().toLowerCase();
      if (CATEGORIES.indexOf(text) !== -1) {
        tags[i].setAttribute('data-category-key', text);
      }
    }
  }

  function renderStudioUI() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('badge-color-studio-panel')) return;

    var drawerBody = document.querySelector('#a11y-drawer .a11y-drawer-body');
    if (!drawerBody) return;

    var panel = document.createElement('div');
    panel.id = 'badge-color-studio-panel';
    panel.className = 'badge-studio-panel';

    var presetBtnsHtml = Object.keys(PRESETS).map(function (id) {
      return '<button type="button" class="badge-preset-btn' + (id === activePreset ? ' is-active' : '') + '" data-preset="' + id + '">' + PRESETS[id].label + '</button>';
    }).join('');

    var pickersHtml = CATEGORIES.map(function (cat) {
      var val = currentColors[cat] || DEFAULT_COLORS[cat];
      return (
        '<label class="badge-picker-row" for="badge-color-picker-' + cat + '">' +
        '  <span class="badge-picker-label">' + cat + '</span>' +
        '  <input type="color" class="badge-picker-input" id="badge-color-picker-' + cat + '" data-category="' + cat + '" value="' + val + '" aria-label="' + cat + ' badge color">' +
        '</label>'
      );
    }).join('');

    panel.innerHTML =
      '<div class="badge-studio-header">' +
      '  <h4 class="badge-studio-title">Category Badge Colors</h4>' +
      '  <button type="button" class="badge-studio-reset-btn" id="badge-studio-reset-btn">Reset to Default</button>' +
      '</div>' +
      '<div class="badge-studio-presets">' + presetBtnsHtml + '</div>' +
      '<div class="badge-studio-pickers">' + pickersHtml + '</div>';

    drawerBody.appendChild(panel);

    panel.querySelectorAll('.badge-preset-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        applyPreset(btn.getAttribute('data-preset'));
      });
    });

    panel.querySelectorAll('.badge-picker-input').forEach(function (inp) {
      inp.addEventListener('input', function () {
        setCategoryColor(inp.getAttribute('data-category'), inp.value);
      });
    });

    var resetBtn = document.getElementById('badge-studio-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        resetToDefault();
      });
    }
  }

  function init() {
    loadColors();
    applyColors(currentColors);
    renderStudioUI();
    tagCardBadges();

    if (typeof document !== 'undefined') {
      var grid = document.getElementById('games-grid');
      if (grid && typeof MutationObserver === 'function') {
        new MutationObserver(function () {
          tagCardBadges(grid);
        }).observe(grid, { childList: true, subtree: true });
      }
    }
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    CATEGORIES: CATEGORIES,
    PRESETS: PRESETS,
    DEFAULT_COLORS: DEFAULT_COLORS,
    applyColors: applyColors,
    loadColors: loadColors,
    applyPreset: applyPreset,
    setCategoryColor: setCategoryColor,
    resetToDefault: resetToDefault,
    getColors: getColors,
    getActivePreset: getActivePreset,
    tagCardBadges: tagCardBadges,
    renderStudioUI: renderStudioUI,
    init: init
  };
});
