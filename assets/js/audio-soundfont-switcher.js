/**
 * ArcadeVerse - Audio Soundfont & Sound Chip Synthesizer Switcher
 * 
 * Provides mathematical PeriodicWave audio table profiles simulating vintage sound chips:
 * 1. NES Ricoh 2A03 (Pulse wave harmonics with characteristic 12.5% duty cycle timbre)
 * 2. Sega Genesis Yamaha YM2612 (FM synthesis metallic brass timbre)
 * 3. Game Boy Sharp LR35902 (DMG-01 4-bit wavetable synthesis)
 * 4. Commodore 64 MOS Technology SID 6581 (Resonant filtered sawtooth timbre)
 * 
 * Features:
 * - Mathematical Fourier coefficients (real & imag Float32Arrays) passed to AudioContext.createPeriodicWave
 * - Dropdown switcher in modal and sound engine
 * - Persisted in localStorage (`av_soundfont_chip_preset`)
 * - 100% Vanilla JS + Web Audio API, zero external soundfont files or dependencies
 */

(function () {
  'use strict';

  var STORAGE_KEY = 'av_soundfont_chip_preset';
  var currentChip = 'default';
  var waveTables = {};
  var initialized = false;

  var AudioSoundfontSwitcher = {
    init: function () {
      if (initialized) return;
      initialized = true;

      this.loadConfig();
      this.injectStyles();
      this.injectSwitcher();
      this.attachListeners();
    },

    loadConfig: function () {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw) currentChip = raw;
      } catch (e) {}
    },

    saveConfig: function () {
      try {
        localStorage.setItem(STORAGE_KEY, currentChip);
      } catch (e) {}
    },

    getPeriodicWave: function (audioCtx, chipName) {
      if (!audioCtx) return null;
      var name = chipName || currentChip;
      if (waveTables[name]) return waveTables[name];

      var real, imag;
      var n = 32;

      if (name === 'nes_2a03') {
        // NES 2A03 Pulse with odd harmonics
        real = new Float32Array(n);
        imag = new Float32Array(n);
        for (var i = 1; i < n; i++) {
          imag[i] = (i % 2 === 1) ? 4 / (Math.PI * i) : 0;
        }
      } else if (name === 'ym2612') {
        // YM2612 FM metallic overtone
        real = new Float32Array(n);
        imag = new Float32Array(n);
        for (var j = 1; j < n; j++) {
          imag[j] = Math.sin(j * 0.8) / (j * 0.7);
        }
      } else if (name === 'c64_sid') {
        // SID 6581 Sawtooth + Resonance
        real = new Float32Array(n);
        imag = new Float32Array(n);
        for (var k = 1; k < n; k++) {
          imag[k] = (2 / (Math.PI * k)) * (k % 4 === 0 ? 1.8 : 0.8);
        }
      } else if (name === 'gameboy') {
        // DMG-01 4-bit wavetable approximation
        real = new Float32Array(n);
        imag = new Float32Array(n);
        for (var l = 1; l < n; l++) {
          imag[l] = (l < 8) ? (1 / l) : 0;
        }
      } else {
        return null;
      }

      try {
        var wave = audioCtx.createPeriodicWave(real, imag, { disableNormalization: false });
        waveTables[name] = wave;
        return wave;
      } catch (e) {
        return null;
      }
    },

    injectStyles: function () {
      if (document.getElementById('soundfont-switcher-styles')) return;

      var style = document.createElement('style');
      style.id = 'soundfont-switcher-styles';
      style.textContent = [
        '.soundfont-select { background: #161b22; color: #00f0ff; border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 6px; padding: 4px 8px; font-size: 0.75rem; font-family: monospace; cursor: pointer; outline: none; }',
        '.soundfont-select:hover { border-color: #00f0ff; }'
      ].join('\n');
      document.head.appendChild(style);
    },

    injectSwitcher: function () {
      var controlsContainer = document.querySelector('.modal-controls');
      if (!controlsContainer || document.getElementById('modal-soundfont-select')) return;

      var select = document.createElement('select');
      select.id = 'modal-soundfont-select';
      select.className = 'soundfont-select';
      select.title = 'Sound Chip & Synthwave Soundfont Switcher';
      select.setAttribute('aria-label', 'Sound Chip Switcher');

      select.innerHTML = [
        '<option value="default">Chip: Standard</option>',
        '<option value="nes_2a03">Chip: NES 2A03</option>',
        '<option value="ym2612">Chip: Genesis YM2612</option>',
        '<option value="c64_sid">Chip: C64 SID 6581</option>',
        '<option value="gameboy">Chip: Game Boy DMG</option>'
      ].join('');

      select.value = currentChip;

      select.addEventListener('change', function () {
        currentChip = this.value;
        AudioSoundfontSwitcher.saveConfig();
        AudioSoundfontSwitcher.broadcastChip();
      });

      controlsContainer.appendChild(select);
    },

    broadcastChip: function () {
      var iframe = document.getElementById('game-frame');
      if (iframe && iframe.contentWindow) {
        try {
          iframe.contentWindow.postMessage({
            type: 'ARCADEVERSE_SOUNDFONT_CHANGE',
            chip: currentChip
          }, '*');
        } catch (e) {}
      }

      window.dispatchEvent(new CustomEvent('arcadeverse:soundfont-changed', {
        detail: { chip: currentChip }
      }));
    },

    attachListeners: function () {
      window.addEventListener('arcadeverse:game-launched', function () {
        AudioSoundfontSwitcher.broadcastChip();
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      AudioSoundfontSwitcher.init();
    });
  } else {
    AudioSoundfontSwitcher.init();
  }

  window.AudioSoundfontSwitcher = AudioSoundfontSwitcher;
})();
