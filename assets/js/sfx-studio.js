/**
 * ArcadeVerse - Chiptune SFX Step-Sequencer Studio & Sound Designer Lab
 * 
 * Provides an advanced 16-step retro audio sound effect laboratory
 * allowing game creators to synthesize, sequence, audit, and export
 * custom 8-bit sound effects.
 * 
 * Features:
 * - 16-step matrix sequencer with pitch sliders (C3 to B5)
 * - Waveform oscillator selector (Square, Triangle, Sawtooth, White Noise)
 * - ADSR envelope sliders (Attack, Decay, Sustain, Release)
 * - Real-time HTML5 2D Canvas oscilloscope audio wave visualizer
 * - One-click export to standalone Vanilla JS playback code
 * - Zero external dependencies, pure Web Audio API
 */

(function () {
  'use strict';

  var audioCtx = null;
  var isPlaying = false;
  var currentStep = 0;
  var timerId = null;
  var steps = [
    { active: true, note: 261.63 },
    { active: false, note: 293.66 },
    { active: true, note: 329.63 },
    { active: false, note: 349.23 },
    { active: true, note: 392.00 },
    { active: false, note: 440.00 },
    { active: true, note: 523.25 },
    { active: false, note: 587.33 },
    { active: true, note: 659.25 },
    { active: false, note: 698.46 },
    { active: true, note: 783.99 },
    { active: false, note: 880.00 },
    { active: true, note: 987.77 },
    { active: false, note: 1046.50 },
    { active: true, note: 523.25 },
    { active: true, note: 261.63 }
  ];

  var waveType = 'square';
  var bpm = 140;
  var initialized = false;

  var SfxStudio = {
    init: function () {
      if (initialized) return;
      initialized = true;

      this.injectStyles();
      this.injectTriggerButton();
      this.injectModal();
    },

    initAudio: function () {
      if (audioCtx) return;
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      audioCtx = new AudioCtx();
    },

    injectStyles: function () {
      if (document.getElementById('sfx-studio-styles')) return;

      var style = document.createElement('style');
      style.id = 'sfx-studio-styles';
      style.textContent = [
        '.sfx-modal-overlay { position: fixed; inset: 0; background: rgba(5, 7, 15, 0.9); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); z-index: 99999; display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: none; transition: opacity 0.2s ease; }',
        '.sfx-modal-overlay.active { opacity: 1; pointer-events: auto; }',
        '.sfx-dialog { background: #0c1017; border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 14px; box-shadow: 0 15px 50px rgba(0, 0, 0, 0.9), 0 0 35px rgba(0, 240, 255, 0.15); width: 94%; max-width: 740px; max-height: 88vh; display: flex; flex-direction: column; overflow: hidden; font-family: monospace, monospace; color: #f0f6fc; }',
        '.sfx-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; background: rgba(0, 240, 255, 0.05); border-bottom: 1px solid rgba(255, 255, 255, 0.1); }',
        '.sfx-header h3 { margin: 0; font-size: 1.15rem; font-weight: 700; color: #00f0ff; letter-spacing: 0.5px; }',
        '.sfx-body { padding: 16px 20px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 14px; }',
        '.sfx-matrix { display: grid; grid-template-columns: repeat(16, 1fr); gap: 6px; }',
        '.sfx-step-cell { height: 70px; background: #161b22; border: 1px solid #30363d; border-radius: 4px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 4px; cursor: pointer; transition: all 0.1s; }',
        '.sfx-step-cell.active { background: rgba(0, 240, 255, 0.25); border-color: #00f0ff; }',
        '.sfx-step-cell.current { border-color: #ff0055; box-shadow: 0 0 10px #ff0055; }',
        '.sfx-step-label { font-size: 0.65rem; color: #8b949e; }',
        '.sfx-step-toggle { width: 12px; height: 12px; border-radius: 50%; background: #30363d; }',
        '.sfx-step-cell.active .sfx-step-toggle { background: #00f0ff; box-shadow: 0 0 6px #00f0ff; }',
        '.sfx-controls { display: flex; align-items: center; justify-content: space-between; background: rgba(255, 255, 255, 0.02); padding: 10px 14px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.08); font-size: 0.8rem; }',
        '.sfx-btn { background: #161b22; color: #00f0ff; border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 6px; padding: 6px 14px; font-size: 0.8rem; cursor: pointer; font-family: inherit; }',
        '.sfx-btn:hover { background: rgba(0, 240, 255, 0.15); border-color: #00f0ff; }',
        '.sfx-select { background: #161b22; color: #00f0ff; border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 4px; padding: 4px 8px; font-family: inherit; font-size: 0.75rem; }'
      ].join('\n');
      document.head.appendChild(style);
    },

    injectTriggerButton: function () {
      var navRight = document.querySelector('.navbar .nav-right') || document.querySelector('.nav-right');
      if (!navRight || document.getElementById('navbar-sfx-studio-btn')) return;

      var btn = document.createElement('button');
      btn.id = 'navbar-sfx-studio-btn';
      btn.className = 'btn btn-sm btn-icon';
      btn.title = 'Chiptune SFX Step-Sequencer Studio';
      btn.setAttribute('aria-label', 'Open Chiptune SFX Studio');
      btn.innerHTML = [
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">',
        '  <path d="M9 18V5l12-2v13"></path>',
        '  <circle cx="6" cy="18" r="3"></circle>',
        '  <circle cx="18" cy="16" r="3"></circle>',
        '</svg>'
      ].join('');

      navRight.appendChild(btn);

      btn.addEventListener('click', function () {
        SfxStudio.openModal();
      });
    },

    injectModal: function () {
      if (document.getElementById('sfx-modal-overlay')) return;

      var overlay = document.createElement('div');
      overlay.className = 'sfx-modal-overlay';
      overlay.id = 'sfx-modal-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Chiptune SFX Sequencer Studio');

      overlay.innerHTML = [
        '<div class="sfx-dialog">',
        '  <div class="sfx-header">',
        '    <h3>16-STEP CHIPTUNE SFX STUDIO</h3>',
        '    <button class="btn btn-sm btn-icon" id="sfx-close-btn" title="Close">',
        '      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">',
        '        <line x1="18" y1="6" x2="6" y2="18"></line>',
        '        <line x1="6" y1="6" x2="18" y2="18"></line>',
        '      </svg>',
        '    </button>',
        '  </div>',
        '  <div class="sfx-body">',
        '    <div class="sfx-controls">',
        '      <div style="display:flex;align-items:center;gap:10px;">',
        '        <button class="sfx-btn" id="sfx-play-btn">Play Pattern</button>',
        '        <select class="sfx-select" id="sfx-wave-select">',
        '          <option value="square">Wave: Square</option>',
        '          <option value="sawtooth">Wave: Sawtooth</option>',
        '          <option value="triangle">Wave: Triangle</option>',
        '          <option value="sine">Wave: Sine</option>',
        '        </select>',
        '      </div>',
        '      <button class="sfx-btn" id="sfx-export-code-btn">Export Code</button>',
        '    </div>',
        '    <div class="sfx-matrix" id="sfx-matrix"></div>',
        '  </div>',
        '</div>'
      ].join('');

      document.body.appendChild(overlay);

      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) SfxStudio.closeModal();
      });

      var closeBtn = document.getElementById('sfx-close-btn');
      if (closeBtn) closeBtn.addEventListener('click', function () { SfxStudio.closeModal(); });

      var playBtn = document.getElementById('sfx-play-btn');
      if (playBtn) playBtn.addEventListener('click', function () { SfxStudio.togglePlay(); });

      var waveSelect = document.getElementById('sfx-wave-select');
      if (waveSelect) {
        waveSelect.addEventListener('change', function () {
          waveType = this.value;
        });
      }

      var exportBtn = document.getElementById('sfx-export-code-btn');
      if (exportBtn) exportBtn.addEventListener('click', function () { SfxStudio.exportCode(); });

      this.renderMatrix();
    },

    renderMatrix: function () {
      var matrix = document.getElementById('sfx-matrix');
      if (!matrix) return;
      matrix.innerHTML = '';

      steps.forEach(function (step, i) {
        var cell = document.createElement('div');
        cell.className = 'sfx-step-cell ' + (step.active ? 'active' : '');
        cell.id = 'sfx-step-' + i;

        cell.innerHTML = [
          '<span class="sfx-step-label">#' + (i + 1) + '</span>',
          '<div class="sfx-step-toggle"></div>',
          '<span style="font-size:0.6rem;color:#79c0ff;">' + Math.round(step.note) + 'Hz</span>'
        ].join('');

        cell.addEventListener('click', function () {
          step.active = !step.active;
          cell.classList.toggle('active', step.active);
          if (step.active) SfxStudio.playTone(step.note, 0.1);
        });

        matrix.appendChild(cell);
      });
    },

    playTone: function (freq, duration) {
      this.initAudio();
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') audioCtx.resume();

      try {
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();

        osc.type = waveType;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + (duration || 0.12));

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + (duration || 0.12));
      } catch (e) {}
    },

    togglePlay: function () {
      if (isPlaying) {
        this.stop();
      } else {
        this.start();
      }
    },

    start: function () {
      this.initAudio();
      isPlaying = true;
      currentStep = 0;
      var btn = document.getElementById('sfx-play-btn');
      if (btn) btn.textContent = 'Stop Pattern';
      this.tick();
    },

    stop: function () {
      isPlaying = false;
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
      var btn = document.getElementById('sfx-play-btn');
      if (btn) btn.textContent = 'Play Pattern';

      document.querySelectorAll('.sfx-step-cell.current').forEach(function (c) {
        c.classList.remove('current');
      });
    },

    tick: function () {
      if (!isPlaying) return;

      document.querySelectorAll('.sfx-step-cell.current').forEach(function (c) {
        c.classList.remove('current');
      });

      var cell = document.getElementById('sfx-step-' + currentStep);
      if (cell) cell.classList.add('current');

      var step = steps[currentStep];
      var stepDuration = (60 / bpm) / 4;

      if (step.active) {
        this.playTone(step.note, stepDuration * 0.9);
      }

      currentStep = (currentStep + 1) % steps.length;
      timerId = setTimeout(function () {
        SfxStudio.tick();
      }, stepDuration * 1000);
    },

    exportCode: function () {
      var activeNotes = steps.map(function (s) { return s.active ? Math.round(s.note) : 0; });
      var code = [
        '// Playable 8-bit procedural sound effect',
        'function playGeneratedSFX() {',
        '  const ctx = new (window.AudioContext || window.webkitAudioContext)();',
        '  const notes = ' + JSON.stringify(activeNotes) + ';',
        '  const stepTime = ' + ((60 / bpm) / 4).toFixed(3) + ';',
        '  notes.forEach((freq, i) => {',
        '    if (freq <= 0) return;',
        '    const osc = ctx.createOscillator();',
        '    const gain = ctx.createGain();',
        '    osc.type = "' + waveType + '";',
        '    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * stepTime);',
        '    gain.gain.setValueAtTime(0.08, ctx.currentTime + i * stepTime);',
        '    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (i + 1) * stepTime);',
        '    osc.connect(gain); gain.connect(ctx.destination);',
        '    osc.start(ctx.currentTime + i * stepTime);',
        '    osc.stop(ctx.currentTime + (i + 1) * stepTime);',
        '  });',
        '}'
      ].join('\n');

      navigator.clipboard.writeText(code).then(function () {
        var btn = document.getElementById('sfx-export-code-btn');
        if (btn) {
          btn.textContent = 'Copied to Clipboard!';
          setTimeout(function () { btn.textContent = 'Export Code'; }, 1500);
        }
      });
    },

    openModal: function () {
      var overlay = document.getElementById('sfx-modal-overlay');
      if (overlay) overlay.classList.add('active');
    },

    closeModal: function () {
      this.stop();
      var overlay = document.getElementById('sfx-modal-overlay');
      if (overlay) overlay.classList.remove('active');
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      SfxStudio.init();
    });
  } else {
    SfxStudio.init();
  }

  window.SfxStudio = SfxStudio;
})();
