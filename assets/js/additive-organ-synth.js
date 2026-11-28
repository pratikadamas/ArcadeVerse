/**
 * Procedural Web Audio Additive Harmonic Organ & Drawbar Synthesizer
 * Constructs rich tonewheel organ and pipe sounds using periodic wave Fourier series,
 * vertical drawbars (16', 5 1/3', 8', 4', 2 2/3', 2', 1 3/5', 1 1/3', 1'),
 * rotary Leslie vibrato, and live spectrum bar graph.
 * Pure Vanilla JS, Web Audio API, zero dependencies, zero emojis.
 */
(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AdditiveOrganSynth = factory();
  }
}(typeof self !== 'undefined' ? self : this, function() {
  'use strict';

  // 9 classic tonewheel drawbar harmonic frequency multiplier ratios
  const DRAWBAR_RATIOS = [
    { label: "16'", harmonic: 1, subOctave: true, ratio: 0.5, name: 'Sub-Octave' },
    { label: "5 1/3'", harmonic: 3, subOctave: true, ratio: 1.5, name: 'Sub-3rd' },
    { label: "8'", harmonic: 2, subOctave: false, ratio: 1.0, name: 'Fundamental' },
    { label: "4'", harmonic: 4, subOctave: false, ratio: 2.0, name: '2nd Harmonic' },
    { label: "2 2/3'", harmonic: 6, subOctave: false, ratio: 3.0, name: '3rd Harmonic' },
    { label: "2'", harmonic: 8, subOctave: false, ratio: 4.0, name: '4th Harmonic' },
    { label: "1 3/5'", harmonic: 10, subOctave: false, ratio: 5.0, name: '5th Harmonic' },
    { label: "1 1/3'", harmonic: 12, subOctave: false, ratio: 6.0, name: '6th Harmonic' },
    { label: "1'", harmonic: 16, subOctave: false, ratio: 8.0, name: '8th Harmonic' }
  ];

  const PRESETS = {
    jazzOrgan: {
      name: 'Jazz Organ',
      drawbars: [8, 8, 8, 0, 0, 0, 0, 0, 0],
      leslie: true
    },
    gospelFull: {
      name: 'Gospel Full',
      drawbars: [8, 8, 8, 8, 8, 8, 8, 8, 8],
      leslie: false
    },
    cathedralPipe: {
      name: 'Cathedral Pipe',
      drawbars: [6, 0, 8, 6, 4, 3, 2, 1, 1],
      leslie: false
    },
    crystalBell: {
      name: 'Crystal Bell',
      drawbars: [0, 0, 4, 0, 6, 0, 8, 0, 8],
      leslie: true
    },
    retroLead: {
      name: 'Retro Lead',
      drawbars: [8, 0, 8, 8, 0, 8, 0, 4, 0],
      leslie: false
    }
  };

  /**
   * Computes normalized Fourier sine coefficients for Web Audio PeriodicWave
   * @param {number[]} drawbars - Array of 9 levels (0 to 8)
   * @returns {{ real: Float32Array, imag: Float32Array }}
   */
  function computePeriodicWaveTables(drawbars) {
    const numHarmonics = 17; // covers up to 16th harmonic
    const real = new Float32Array(numHarmonics);
    const imag = new Float32Array(numHarmonics);

    // Fundamental is at index 2 (representing ratio 1.0)
    // Drawbar harmonics map into integer indices:
    // 16' (0.5x) => approx mapped to fundamental sub-weight
    // 5 1/3' (1.5x) => harmonic 3
    // 8' (1.0x) => harmonic 2 (fundamental base)
    // 4' (2.0x) => harmonic 4
    // 2 2/3' (3.0x) => harmonic 6
    // 2' (4.0x) => harmonic 8
    // 1 3/5' (5.0x) => harmonic 10
    // 1 1/3' (6.0x) => harmonic 12
    // 1' (8.0x) => harmonic 16

    DRAWBAR_RATIOS.forEach((d, idx) => {
      const level = Math.max(0, Math.min(8, drawbars[idx] || 0)) / 8.0;
      if (d.harmonic < numHarmonics) {
        imag[d.harmonic] += level;
      }
    });

    // Normalize imag amplitudes to avoid audio clipping
    let maxAmp = 0;
    for (let i = 1; i < numHarmonics; i++) {
      if (imag[i] > maxAmp) maxAmp = imag[i];
    }

    if (maxAmp > 0) {
      for (let i = 1; i < numHarmonics; i++) {
        imag[i] /= maxAmp;
      }
    }

    return { real, imag };
  }

  class OrganEngine {
    constructor(options = {}) {
      this.drawbars = options.drawbars ? options.drawbars.slice() : [8, 8, 8, 0, 0, 0, 0, 0, 0];
      this.leslieEnabled = options.leslie !== undefined ? options.leslie : false;
      this.audioCtx = null;
      this.masterGain = null;
      this.leslieLFO = null;
      this.activeNotes = new Map(); // note -> { osc, gain }
      this.periodicWave = null;
    }

    initAudio() {
      if (!this.audioCtx) {
        const AudioContextClass = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
          this.masterGain = this.audioCtx.createGain();
          this.masterGain.gain.setValueAtTime(0.25, this.audioCtx.currentTime);
          this.masterGain.connect(this.audioCtx.destination);
          this.updateWave();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
    }

    setDrawbar(index, value) {
      if (index >= 0 && index < 9) {
        this.drawbars[index] = Math.max(0, Math.min(8, value));
        this.updateWave();
      }
    }

    setPreset(presetKey) {
      const p = PRESETS[presetKey];
      if (p) {
        this.drawbars = p.drawbars.slice();
        this.leslieEnabled = p.leslie;
        this.updateWave();
      }
    }

    updateWave() {
      if (!this.audioCtx) return;
      const { real, imag } = computePeriodicWaveTables(this.drawbars);
      this.periodicWave = this.audioCtx.createPeriodicWave(real, imag, { disableNormalization: false });

      // Update existing playing oscillators
      this.activeNotes.forEach(({ osc }) => {
        try {
          osc.setPeriodicWave(this.periodicWave);
        } catch (e) {}
      });
    }

    noteOn(midiNote, freq) {
      this.initAudio();
      if (!this.audioCtx || this.activeNotes.has(midiNote)) return;

      const osc = this.audioCtx.createOscillator();
      const noteGain = this.audioCtx.createGain();

      if (this.periodicWave) {
        osc.setPeriodicWave(this.periodicWave);
      } else {
        osc.type = 'sine';
      }

      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

      // Attack envelope
      const now = this.audioCtx.currentTime;
      noteGain.gain.setValueAtTime(0.001, now);
      noteGain.gain.linearRampToValueAtTime(0.5, now + 0.02);

      // Vibrato / Leslie LFO
      let lfo = null;
      if (this.leslieEnabled) {
        lfo = this.audioCtx.createOscillator();
        const lfoGain = this.audioCtx.createGain();
        lfo.frequency.setValueAtTime(6.0, now); // 6 Hz rotary spin
        lfoGain.gain.setValueAtTime(2.5, now);
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start(now);
      }

      osc.connect(noteGain);
      noteGain.connect(this.masterGain);
      osc.start(now);

      this.activeNotes.set(midiNote, { osc, gain: noteGain, lfo });
    }

    noteOff(midiNote) {
      if (!this.audioCtx || !this.activeNotes.has(midiNote)) return;

      const { osc, gain, lfo } = this.activeNotes.get(midiNote);
      const now = this.audioCtx.currentTime;

      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.08);

      setTimeout(() => {
        try {
          osc.stop();
          osc.disconnect();
          gain.disconnect();
          if (lfo) {
            lfo.stop();
            lfo.disconnect();
          }
        } catch (e) {}
      }, 100);

      this.activeNotes.delete(midiNote);
    }

    renderSpectrum(ctx, width, height) {
      ctx.clearRect(0, 0, width, height);

      const barWidth = width / 9;
      DRAWBAR_RATIOS.forEach((d, idx) => {
        const val = this.drawbars[idx] / 8.0;
        const barHeight = val * (height - 20);
        const x = idx * barWidth + barWidth * 0.15;
        const y = height - barHeight - 15;
        const w = barWidth * 0.7;

        // Bar fill
        const grad = ctx.createLinearGradient(0, y, 0, height - 15);
        grad.addColorStop(0, '#f59e0b');
        grad.addColorStop(1, '#78350f');
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, w, barHeight);

        // Bar label
        ctx.fillStyle = '#a89279';
        ctx.font = '10px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(d.label, x + w / 2, height - 3);
      });
    }
  }

  function createStudio(container, options = {}) {
    if (!container) return null;

    const engine = new OrganEngine(options);

    container.innerHTML = `
      <div class="organ-studio-container">
        <div class="organ-header">
          <h2 class="organ-title">Additive Harmonic Organ & Drawbar Studio</h2>
          <span style="font-size:0.85rem;color:var(--organ-muted);">9-Drawbar Tonewheel Console</span>
        </div>
        <div class="organ-workspace">
          <div class="organ-console-panel">
            <div class="organ-top-bar">
              <div class="organ-preset-group">
                <button class="organ-btn active" data-preset="jazzOrgan">Jazz Organ</button>
                <button class="organ-btn" data-preset="gospelFull">Gospel Full</button>
                <button class="organ-btn" data-preset="cathedralPipe">Cathedral Pipe</button>
                <button class="organ-btn" data-preset="crystalBell">Crystal Bell</button>
                <button class="organ-btn" data-preset="retroLead">Retro Lead</button>
              </div>
              <button class="organ-btn" id="organ-toggle-leslie">Rotary Leslie: ${engine.leslieEnabled ? 'ON' : 'OFF'}</button>
            </div>
            <div class="organ-drawbars-container" id="organ-drawbars-list"></div>
          </div>
          <div class="organ-spectrum-card">
            <span style="font-size:0.75rem;font-weight:700;color:var(--organ-muted);text-transform:uppercase;">Harmonic Spectrum Distribution</span>
            <canvas class="organ-spectrum-canvas" width="600" height="90"></canvas>
          </div>
          <div class="organ-keyboard-card">
            <div class="organ-keyboard" id="organ-keyboard-keys"></div>
          </div>
        </div>
      </div>
    `;

    const drawbarsList = container.querySelector('#organ-drawbars-list');
    const specCanvas = container.querySelector('.organ-spectrum-canvas');
    const specCtx = specCanvas.getContext('2d');
    const btnLeslie = container.querySelector('#organ-toggle-leslie');
    const keyboard = container.querySelector('#organ-keyboard-keys');

    // Build Drawbars
    DRAWBAR_RATIOS.forEach((d, idx) => {
      const slot = document.createElement('div');
      slot.className = 'organ-drawbar-slot';
      slot.innerHTML = `
        <span class="organ-drawbar-label">${d.label}</span>
        <input type="range" class="organ-drawbar-slider" data-idx="${idx}" min="0" max="8" value="${engine.drawbars[idx]}" />
        <span class="organ-drawbar-val" id="organ-drawbar-val-${idx}">${engine.drawbars[idx]}</span>
      `;
      drawbarsList.appendChild(slot);
    });

    drawbarsList.querySelectorAll('.organ-drawbar-slider').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.idx, 10);
        const val = parseInt(e.target.value, 10);
        engine.setDrawbar(idx, val);
        container.querySelector(`#organ-drawbar-val-${idx}`).textContent = val;
        engine.renderSpectrum(specCtx, specCanvas.width, specCanvas.height);
      });
    });

    // Presets
    container.querySelectorAll('.organ-preset-group .organ-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.organ-preset-group .organ-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        engine.setPreset(btn.dataset.preset);

        // Update UI sliders
        engine.drawbars.forEach((val, i) => {
          const slider = container.querySelector(`.organ-drawbar-slider[data-idx="${i}"]`);
          if (slider) slider.value = val;
          const valLabel = container.querySelector(`#organ-drawbar-val-${i}`);
          if (valLabel) valLabel.textContent = val;
        });

        btnLeslie.textContent = `Rotary Leslie: ${engine.leslieEnabled ? 'ON' : 'OFF'}`;
        btnLeslie.classList.toggle('active', engine.leslieEnabled);
        engine.renderSpectrum(specCtx, specCanvas.width, specCanvas.height);
      });
    });

    btnLeslie.addEventListener('click', () => {
      engine.leslieEnabled = !engine.leslieEnabled;
      btnLeslie.textContent = `Rotary Leslie: ${engine.leslieEnabled ? 'ON' : 'OFF'}`;
      btnLeslie.classList.toggle('active', engine.leslieEnabled);
    });

    // Build 1.5 octave piano keys (C4 to G5)
    const NOTES = [
      { note: 'C4', midi: 60, freq: 261.63, isBlack: false },
      { note: 'C#4', midi: 61, freq: 277.18, isBlack: true, left: 30 },
      { note: 'D4', midi: 62, freq: 293.66, isBlack: false },
      { note: 'D#4', midi: 63, freq: 311.13, isBlack: true, left: 74 },
      { note: 'E4', midi: 64, freq: 329.63, isBlack: false },
      { note: 'F4', midi: 65, freq: 349.23, isBlack: false },
      { note: 'F#4', midi: 66, freq: 369.99, isBlack: true, left: 162 },
      { note: 'G4', midi: 67, freq: 392.00, isBlack: false },
      { note: 'G#4', midi: 68, freq: 415.30, isBlack: true, left: 206 },
      { note: 'A4', midi: 69, freq: 440.00, isBlack: false },
      { note: 'A#4', midi: 70, freq: 466.16, isBlack: true, left: 250 },
      { note: 'B4', midi: 71, freq: 493.88, isBlack: false },
      { note: 'C5', midi: 72, freq: 523.25, isBlack: false }
    ];

    NOTES.forEach(n => {
      const key = document.createElement('div');
      if (n.isBlack) {
        key.className = 'organ-black-key';
        key.style.left = `${n.left}px`;
      } else {
        key.className = 'organ-white-key';
        key.textContent = n.note;
      }

      key.addEventListener('mousedown', () => {
        key.classList.add('active');
        engine.noteOn(n.midi, n.freq);
      });
      key.addEventListener('mouseup', () => {
        key.classList.remove('active');
        engine.noteOff(n.midi);
      });
      key.addEventListener('mouseleave', () => {
        if (key.classList.contains('active')) {
          key.classList.remove('active');
          engine.noteOff(n.midi);
        }
      });
      keyboard.appendChild(key);
    });

    engine.renderSpectrum(specCtx, specCanvas.width, specCanvas.height);

    return {
      engine,
      NOTES,
      renderSpectrum: () => engine.renderSpectrum(specCtx, specCanvas.width, specCanvas.height)
    };
  }

  return {
    DRAWBAR_RATIOS,
    PRESETS,
    computePeriodicWaveTables,
    OrganEngine,
    createStudio
  };
}));
