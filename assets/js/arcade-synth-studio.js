/**
 * ArcadeVerse Interactive 8-Bit Chiptune Synthesizer & Soundboard Studio (#1054)
 * Zero-dependency Web Audio procedural chiptune sound effect generator, playable 1-octave piano,
 * ADSR envelope controls, instant presets, and one-click Vanilla JS code exporter.
 * Author: Babin Bid (@Babin123456)
 * Open Source for ArcadeVerse - NSOC Winter Edition 2026
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ArcadeSynthStudio = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var audioCtx = null;
  var modalEl = null;

  var KEY_MAP = {
    'a': 261.63, // C4
    'w': 277.18, // C#4
    's': 293.66, // D4
    'e': 311.13, // D#4
    'd': 329.63, // E4
    'f': 349.23, // F4
    't': 369.99, // F#4
    'g': 392.00, // G4
    'y': 415.30, // G#4
    'h': 440.00, // A4
    'u': 466.16, // A#4
    'j': 493.88, // B4
    'k': 523.25  // C5
  };

  var PRESETS = {
    jump: {
      type: 'square',
      startFreq: 150,
      endFreq: 600,
      attack: 0.01,
      decay: 0.15,
      sustain: 0.0,
      release: 0.05,
      code: "function playJump() {\n  const ctx = new (window.AudioContext || window.webkitAudioContext)();\n  const osc = ctx.createOscillator();\n  const gain = ctx.createGain();\n  osc.type = 'square';\n  osc.frequency.setValueAtTime(150, ctx.currentTime);\n  osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.15);\n  gain.gain.setValueAtTime(0.3, ctx.currentTime);\n  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);\n  osc.connect(gain);\n  gain.connect(ctx.destination);\n  osc.start();\n  osc.stop(ctx.currentTime + 0.2);\n}"
    },
    laser: {
      type: 'sawtooth',
      startFreq: 900,
      endFreq: 100,
      attack: 0.005,
      decay: 0.12,
      sustain: 0.0,
      release: 0.02,
      code: "function playLaser() {\n  const ctx = new (window.AudioContext || window.webkitAudioContext)();\n  const osc = ctx.createOscillator();\n  const gain = ctx.createGain();\n  osc.type = 'sawtooth';\n  osc.frequency.setValueAtTime(900, ctx.currentTime);\n  osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.12);\n  gain.gain.setValueAtTime(0.25, ctx.currentTime);\n  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);\n  osc.connect(gain);\n  gain.connect(ctx.destination);\n  osc.start();\n  osc.stop(ctx.currentTime + 0.15);\n}"
    },
    coin: {
      type: 'triangle',
      startFreq: 987.77,
      endFreq: 1318.51,
      attack: 0.01,
      decay: 0.25,
      sustain: 0.0,
      release: 0.05,
      code: "function playCoin() {\n  const ctx = new (window.AudioContext || window.webkitAudioContext)();\n  const now = ctx.currentTime;\n  const osc = ctx.createOscillator();\n  const gain = ctx.createGain();\n  osc.type = 'triangle';\n  osc.frequency.setValueAtTime(987.77, now);\n  osc.frequency.setValueAtTime(1318.51, now + 0.08);\n  gain.gain.setValueAtTime(0.3, now);\n  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);\n  osc.connect(gain);\n  gain.connect(ctx.destination);\n  osc.start(now);\n  osc.stop(now + 0.32);\n}"
    },
    explosion: {
      type: 'noise',
      startFreq: 120,
      endFreq: 40,
      attack: 0.01,
      decay: 0.35,
      sustain: 0.0,
      release: 0.05,
      code: "function playExplosion() {\n  const ctx = new (window.AudioContext || window.webkitAudioContext)();\n  const bufferSize = ctx.sampleRate * 0.35;\n  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);\n  const data = buffer.getChannelData(0);\n  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;\n  const noise = ctx.createBufferSource();\n  noise.buffer = buffer;\n  const filter = ctx.createBiquadFilter();\n  filter.type = 'lowpass';\n  filter.frequency.setValueAtTime(600, ctx.currentTime);\n  filter.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.35);\n  const gain = ctx.createGain();\n  gain.gain.setValueAtTime(0.35, ctx.currentTime);\n  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);\n  noise.connect(filter);\n  filter.connect(gain);\n  gain.connect(ctx.destination);\n  noise.start();\n}"
    },
    hit: {
      type: 'square',
      startFreq: 220,
      endFreq: 55,
      attack: 0.005,
      decay: 0.1,
      sustain: 0.0,
      release: 0.02,
      code: "function playHit() {\n  const ctx = new (window.AudioContext || window.webkitAudioContext)();\n  const osc = ctx.createOscillator();\n  const gain = ctx.createGain();\n  osc.type = 'square';\n  osc.frequency.setValueAtTime(220, ctx.currentTime);\n  osc.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 0.1);\n  gain.gain.setValueAtTime(0.3, ctx.currentTime);\n  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);\n  osc.connect(gain);\n  gain.connect(ctx.destination);\n  osc.start();\n  osc.stop(ctx.currentTime + 0.13);\n}"
    }
  };

  function getAudioContext() {
    if (!audioCtx) {
      try {
        var AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          audioCtx = new AudioContextClass();
        }
      } catch (_) {}
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(function () {});
    }
    return audioCtx;
  }

  function playTone(freq, type) {
    var ctx = getAudioContext();
    if (!ctx) return;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();

    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.26);
  }

  function playPreset(key) {
    var preset = PRESETS[key];
    if (!preset) return;

    if (preset.type === 'noise') {
      var ctx = getAudioContext();
      if (!ctx) return;
      var bufferSize = Math.floor(ctx.sampleRate * 0.35);
      var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      var data = buffer.getChannelData(0);
      for (var i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

      var noise = ctx.createBufferSource();
      noise.buffer = buffer;
      var filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.35);

      var gain = ctx.createGain();
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start();
      return;
    }

    var actx = getAudioContext();
    if (!actx) return;
    var osc = actx.createOscillator();
    var master = actx.createGain();

    osc.type = preset.type;
    osc.frequency.setValueAtTime(preset.startFreq, actx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(10, preset.endFreq), actx.currentTime + preset.decay);

    master.gain.setValueAtTime(0.25, actx.currentTime);
    master.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + preset.decay + 0.05);

    osc.connect(master);
    master.connect(actx.destination);

    osc.start();
    osc.stop(actx.currentTime + preset.decay + 0.06);
  }

  function renderModal() {
    if (document.getElementById('synth-studio-modal')) return;

    modalEl = document.createElement('div');
    modalEl.id = 'synth-studio-modal';
    modalEl.className = 'synth-studio-modal';
    modalEl.style.position = 'fixed';
    modalEl.style.top = '0';
    modalEl.style.left = '0';
    modalEl.style.width = '100vw';
    modalEl.style.height = '100vh';
    modalEl.style.background = 'rgba(10, 15, 26, 0.95)';
    modalEl.style.zIndex = '10000';
    modalEl.style.display = 'none';
    modalEl.style.justifyContent = 'center';
    modalEl.style.alignItems = 'center';
    modalEl.style.backdropFilter = 'blur(10px)';

    modalEl.innerHTML = [
      '<div class="synth-studio-card" style="background:#0f172a; border:1px solid rgba(0,245,255,0.3); border-radius:12px; width:90%; max-width:680px; max-height:90vh; overflow-y:auto; padding:24px; box-shadow:0 12px 48px rgba(0,0,0,0.8);">',
      '  <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:12px; margin-bottom:16px;">',
      '    <div>',
      '      <h2 style="font-size:1.25rem; color:var(--accent-primary, #00f5ff); margin:0;">Arcade Synth Studio</h2>',
      '      <div style="font-size:0.8rem; color:#8b9bb4;">Interactive 8-Bit Chiptune Synthesizer & Code Exporter</div>',
      '    </div>',
      '    <button type="button" id="synth-close-btn" style="background:none; border:none; color:#fff; font-size:1.5rem; cursor:pointer;">&times;</button>',
      '  </div>',
      '  <div style="margin-bottom:20px;">',
      '    <div style="font-size:0.85rem; font-weight:700; color:#fff; margin-bottom:8px;">Instant SFX Presets</div>',
      '    <div style="display:flex; gap:8px; flex-wrap:wrap;">',
      '      <button type="button" class="synth-preset-btn" data-preset="jump" style="background:#1e293b; color:#00f5ff; border:1px solid rgba(0,245,255,0.4); border-radius:6px; padding:6px 12px; font-weight:600; cursor:pointer;">Jump</button>',
      '      <button type="button" class="synth-preset-btn" data-preset="laser" style="background:#1e293b; color:#00f5ff; border:1px solid rgba(0,245,255,0.4); border-radius:6px; padding:6px 12px; font-weight:600; cursor:pointer;">Laser</button>',
      '      <button type="button" class="synth-preset-btn" data-preset="coin" style="background:#1e293b; color:#00f5ff; border:1px solid rgba(0,245,255,0.4); border-radius:6px; padding:6px 12px; font-weight:600; cursor:pointer;">Coin</button>',
      '      <button type="button" class="synth-preset-btn" data-preset="explosion" style="background:#1e293b; color:#00f5ff; border:1px solid rgba(0,245,255,0.4); border-radius:6px; padding:6px 12px; font-weight:600; cursor:pointer;">Explosion</button>',
      '      <button type="button" class="synth-preset-btn" data-preset="hit" style="background:#1e293b; color:#00f5ff; border:1px solid rgba(0,245,255,0.4); border-radius:6px; padding:6px 12px; font-weight:600; cursor:pointer;">Hit</button>',
      '    </div>',
      '  </div>',
      '  <div style="margin-bottom:20px;">',
      '    <div style="font-size:0.85rem; font-weight:700; color:#fff; margin-bottom:8px;">1-Octave Piano Keyboard (A-S-D-F-G-H-J-K)</div>',
      '    <div class="synth-keyboard" style="display:flex; gap:4px; height:80px; user-select:none;">',
      '      <button type="button" class="synth-key" data-key="a" style="flex:1; background:#fff; color:#000; border:none; border-radius:0 0 4px 4px; font-weight:700; cursor:pointer; display:flex; align-items:flex-end; justify-content:center; padding-bottom:6px;">C</button>',
      '      <button type="button" class="synth-key" data-key="s" style="flex:1; background:#fff; color:#000; border:none; border-radius:0 0 4px 4px; font-weight:700; cursor:pointer; display:flex; align-items:flex-end; justify-content:center; padding-bottom:6px;">D</button>',
      '      <button type="button" class="synth-key" data-key="d" style="flex:1; background:#fff; color:#000; border:none; border-radius:0 0 4px 4px; font-weight:700; cursor:pointer; display:flex; align-items:flex-end; justify-content:center; padding-bottom:6px;">E</button>',
      '      <button type="button" class="synth-key" data-key="f" style="flex:1; background:#fff; color:#000; border:none; border-radius:0 0 4px 4px; font-weight:700; cursor:pointer; display:flex; align-items:flex-end; justify-content:center; padding-bottom:6px;">F</button>',
      '      <button type="button" class="synth-key" data-key="g" style="flex:1; background:#fff; color:#000; border:none; border-radius:0 0 4px 4px; font-weight:700; cursor:pointer; display:flex; align-items:flex-end; justify-content:center; padding-bottom:6px;">G</button>',
      '      <button type="button" class="synth-key" data-key="h" style="flex:1; background:#fff; color:#000; border:none; border-radius:0 0 4px 4px; font-weight:700; cursor:pointer; display:flex; align-items:flex-end; justify-content:center; padding-bottom:6px;">A</button>',
      '      <button type="button" class="synth-key" data-key="j" style="flex:1; background:#fff; color:#000; border:none; border-radius:0 0 4px 4px; font-weight:700; cursor:pointer; display:flex; align-items:flex-end; justify-content:center; padding-bottom:6px;">B</button>',
      '      <button type="button" class="synth-key" data-key="k" style="flex:1; background:#fff; color:#000; border:none; border-radius:0 0 4px 4px; font-weight:700; cursor:pointer; display:flex; align-items:flex-end; justify-content:center; padding-bottom:6px;">C5</button>',
      '    </div>',
      '  </div>',
      '  <div>',
      '    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">',
      '      <span style="font-size:0.85rem; font-weight:700; color:#fff;">Vanilla JS Code Exporter</span>',
      '      <button type="button" id="synth-copy-code-btn" style="background:var(--accent-primary, #00f5ff); color:#000; border:none; border-radius:4px; padding:4px 12px; font-size:0.75rem; font-weight:700; cursor:pointer;">Copy Snippet</button>',
      '    </div>',
      '    <textarea id="synth-code-preview" readonly style="width:100%; height:140px; background:#0b1120; border:1px solid rgba(255,255,255,0.1); border-radius:6px; color:#38bdf8; font-family:monospace; font-size:0.8rem; padding:10px; resize:none;"></textarea>',
      '  </div>',
      '</div>'
    ].join('\n');

    document.body.appendChild(modalEl);

    document.getElementById('synth-close-btn').addEventListener('click', function () {
      modalEl.style.display = 'none';
    });

    modalEl.addEventListener('click', function (e) {
      if (e.target === modalEl) modalEl.style.display = 'none';
    });

    var codeArea = document.getElementById('synth-code-preview');
    codeArea.value = PRESETS.jump.code;

    var presetBtns = modalEl.querySelectorAll('.synth-preset-btn');
    presetBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-preset');
        playPreset(key);
        if (PRESETS[key]) {
          codeArea.value = PRESETS[key].code;
        }
      });
    });

    var keyBtns = modalEl.querySelectorAll('.synth-key');
    keyBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-key');
        if (KEY_MAP[key]) {
          playTone(KEY_MAP[key], 'square');
        }
      });
    });

    document.getElementById('synth-copy-code-btn').addEventListener('click', function () {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(codeArea.value);
        this.textContent = 'Copied!';
        var btn = this;
        setTimeout(function () { btn.textContent = 'Copy Snippet'; }, 1500);
      }
    });

    window.addEventListener('keydown', function (e) {
      if (modalEl.style.display === 'flex') {
        var char = e.key.toLowerCase();
        if (KEY_MAP[char]) {
          playTone(KEY_MAP[char], 'square');
        } else if (e.key === 'Escape') {
          modalEl.style.display = 'none';
        }
      }
    });
  }

  function openStudio() {
    renderModal();
    if (modalEl) modalEl.style.display = 'flex';
  }

  function init() {
    renderModal();
  }

  return {
    init: init,
    openStudio: openStudio,
    playTone: playTone,
    playPreset: playPreset
  };
});
