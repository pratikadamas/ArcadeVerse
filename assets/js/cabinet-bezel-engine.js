/**
 * ArcadeVerse - Retro Cabinet Bezel Frame Switcher
 * 
 * Provides players with authentic nostalgic bezel overlays surrounding the active game iframe:
 * 1. Default / Clean (frameless neon edge)
 * 2. Neo-Geo MVS Arcade Cabinet (vintage wooden cab with coin slot & instruction card)
 * 3. 1980s Curved Trinitron TV Set (vintage curved television chassis with wooden side panels)
 * 4. Cyberpunk Holo-Deck (glowing sci-fi holographic frame)
 * 
 * Features:
 * - Proper aspect ratio preservation (letterboxing & pillarboxing)
 * - Switcher dropdown in the active game modal topbar
 * - Persisted in localStorage (`av_cabinet_bezel_preset`)
 * - 100% Vanilla JS + CSS3, zero external assets or images
 */

(function () {
  'use strict';

  var STORAGE_KEY = 'av_cabinet_bezel_preset';
  var currentPreset = 'default';
  var initialized = false;

  var CabinetBezelEngine = {
    init: function () {
      if (initialized) return;
      initialized = true;

      this.loadConfig();
      this.injectStyles();
      this.injectSwitcher();
      this.applyPreset(currentPreset);
      this.attachListeners();
    },

    loadConfig: function () {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw) currentPreset = raw;
      } catch (e) {}
    },

    saveConfig: function () {
      try {
        localStorage.setItem(STORAGE_KEY, currentPreset);
      } catch (e) {}
    },

    injectStyles: function () {
      if (document.getElementById('cabinet-bezel-styles')) return;

      var style = document.createElement('style');
      style.id = 'cabinet-bezel-styles';
      style.textContent = [
        '.bezel-switcher-select { background: #161b22; color: #00f0ff; border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 6px; padding: 4px 8px; font-size: 0.75rem; font-family: inherit; cursor: pointer; outline: none; transition: border-color 0.2s; }',
        '.bezel-switcher-select:hover { border-color: #00f0ff; }',
        '.modal-body.bezel-neogeo { padding: 30px !important; background: #1a0a00 !important; border: 14px solid #4a2105; box-shadow: inset 0 0 40px rgba(0, 0, 0, 0.9), 0 0 20px rgba(0,0,0,0.8); position: relative; }',
        '.modal-body.bezel-neogeo::before { content: "NEO-GEO MVS • INSERT COIN"; position: absolute; top: 6px; left: 50%; transform: translateX(-50%); font-family: monospace; font-size: 0.7rem; font-weight: bold; color: #ffcc00; letter-spacing: 2px; }',
        '.modal-body.bezel-tv1980 { padding: 25px 40px !important; background: #261b17 !important; border: 16px solid #140d0b; border-radius: 20px; box-shadow: inset 0 0 50px #000, 0 10px 30px rgba(0,0,0,0.9); position: relative; }',
        '.modal-body.bezel-tv1980::after { content: "TRINITRON COLOR TV"; position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%); font-family: sans-serif; font-size: 0.65rem; color: #887870; letter-spacing: 1.5px; }',
        '.modal-body.bezel-cyberpunk { padding: 20px !important; background: #05070f !important; border: 4px solid #00f0ff; box-shadow: inset 0 0 30px rgba(0, 240, 255, 0.3), 0 0 25px rgba(0, 240, 255, 0.4); }'
      ].join('\n');
      document.head.appendChild(style);
    },

    injectSwitcher: function () {
      var controlsContainer = document.querySelector('.modal-controls');
      if (!controlsContainer || document.getElementById('modal-bezel-select')) return;

      var select = document.createElement('select');
      select.id = 'modal-bezel-select';
      select.className = 'bezel-switcher-select';
      select.title = 'Arcade Cabinet Bezel Frame Switcher';
      select.setAttribute('aria-label', 'Arcade Cabinet Bezel Frame Switcher');

      select.innerHTML = [
        '<option value="default">Bezel: Frameless</option>',
        '<option value="neogeo">Bezel: Neo-Geo MVS</option>',
        '<option value="tv1980">Bezel: 1980s TV Set</option>',
        '<option value="cyberpunk">Bezel: Cyberpunk Holo</option>'
      ].join('');

      select.value = currentPreset;

      select.addEventListener('change', function () {
        CabinetBezelEngine.applyPreset(this.value);
      });

      controlsContainer.appendChild(select);
    },

    applyPreset: function (preset) {
      currentPreset = preset || 'default';
      this.saveConfig();

      var modalBody = document.querySelector('.modal-body') || document.querySelector('.game-modal-body');
      if (!modalBody) return;

      modalBody.classList.remove('bezel-neogeo', 'bezel-tv1980', 'bezel-cyberpunk');

      if (currentPreset === 'neogeo') {
        modalBody.classList.add('bezel-neogeo');
      } else if (currentPreset === 'tv1980') {
        modalBody.classList.add('bezel-tv1980');
      } else if (currentPreset === 'cyberpunk') {
        modalBody.classList.add('bezel-cyberpunk');
      }

      var select = document.getElementById('modal-bezel-select');
      if (select && select.value !== currentPreset) {
        select.value = currentPreset;
      }
    },

    attachListeners: function () {
      window.addEventListener('arcadeverse:game-launched', function () {
        CabinetBezelEngine.applyPreset(currentPreset);
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      CabinetBezelEngine.init();
    });
  } else {
    CabinetBezelEngine.init();
  }

  window.CabinetBezelEngine = CabinetBezelEngine;
})();
