/**
 * ArcadeVerse - 16-Band Audio Frequency Spectrum Analyzer
 * Hall of Fame Podium Equalizer Visualizer
 *
 * Features:
 * - 16-band FFT frequency analyzer with Web Audio API AnalyserNode
 * - Retro arcade discrete LED segment styling (Green -> Amber -> Red)
 * - Floating peak meters with gravity physics & drop velocity
 * - Smooth idle ambient sinusoidal chiptune wave animation mode
 * - 60 FPS requestAnimationFrame with visibility and reduced-motion awareness
 *
 * Author: ArcadeVerse Community (NSOC '26)
 */

(function () {
  'use strict';

  const BANDS_COUNT = 16;
  const LED_SEGMENTS_COUNT = 18;
  const LED_GAP = 2;
  const GRAVITY = 0.35;
  const PEAK_DECAY_DELAY = 12; // Frames before peak drops

  // Frequency labels corresponding to 16 ISO standard 1/3-octave center bands
  const FREQ_LABELS = [
    '40', '80', '160', '250', '400', '630', '1K', '1.6K',
    '2.5K', '4K', '6.3K', '8K', '10K', '12K', '14K', '16K'
  ];

  function computeAmbientBands(timer, bandsCount = BANDS_COUNT) {
    const values = new Array(bandsCount);
    for (let i = 0; i < bandsCount; i++) {
      const w1 = Math.sin(timer * 1.8 + i * 0.42);
      const w2 = Math.cos(timer * 0.9 - i * 0.31);
      const w3 = Math.sin(timer * 3.2 + i * 0.85) * 0.25;
      values[i] = Math.max(0.12, Math.min(1.0, ((w1 + w2 + w3) / 2.25) * 0.65 + 0.35));
    }
    return values;
  }

  function calculatePeakPhysics(currentValue, peakValue, dropSpeed, holdCounter, gravity = GRAVITY, decayDelay = PEAK_DECAY_DELAY) {
    if (currentValue >= peakValue) {
      return {
        peak: currentValue,
        speed: 0,
        hold: decayDelay
      };
    }
    if (holdCounter > 0) {
      return {
        peak: peakValue,
        speed: 0,
        hold: holdCounter - 1
      };
    }
    const newSpeed = dropSpeed + gravity * 0.0035;
    const newPeak = Math.max(0, peakValue - newSpeed);
    return {
      peak: newPeak,
      speed: newSpeed,
      hold: 0
    };
  }

  function getSegmentColors(seg, totalSegments = LED_SEGMENTS_COUNT, isActive = true) {
    let colorActive = '#10b981';
    let colorDim = 'rgba(16, 185, 129, 0.12)';
    let glowColor = 'rgba(16, 185, 129, 0.4)';

    if (seg >= 15) {
      colorActive = '#ef4444';
      colorDim = 'rgba(239, 68, 68, 0.12)';
      glowColor = 'rgba(239, 68, 68, 0.5)';
    } else if (seg >= 11) {
      colorActive = '#f59e0b';
      colorDim = 'rgba(245, 158, 11, 0.12)';
      glowColor = 'rgba(245, 158, 11, 0.45)';
    }

    return {
      fill: isActive ? colorActive : colorDim,
      glow: isActive ? glowColor : 'transparent',
      isActive
    };
  }

  function mapFrequencyTo16Bands(freqData, bandsCount = BANDS_COUNT) {
    const bands = new Array(bandsCount);
    if (!freqData || freqData.length === 0) {
      return bands.fill(0);
    }
    for (let i = 0; i < bandsCount; i++) {
      const binIdx = Math.min(Math.floor(i * (freqData.length / bandsCount)), freqData.length - 1);
      bands[i] = freqData[binIdx] / 255;
    }
    return bands;
  }

  class LeaderboardSpectrum {
    constructor() {
      this.canvas = null;
      this.ctx = null;
      this.container = null;
      this.statusBadge = null;

      // Audio analysis state
      this.audioCtx = null;
      this.analyser = null;
      this.audioSource = null;
      this.freqData = null;
      this.isAudioConnected = false;

      // Visual state
      this.peaks = new Array(BANDS_COUNT).fill(0);
      this.peakDropSpeeds = new Array(BANDS_COUNT).fill(0);
      this.peakHoldCounters = new Array(BANDS_COUNT).fill(0);
      this.bandValues = new Array(BANDS_COUNT).fill(0);
      this.currentMode = 'ambient'; // 'ambient' | 'live'
      this.ambientTimer = 0;

      // Lifecycle & performance
      this.rafId = null;
      this.isPaused = false;
      this.prefersReducedMotion = false;
      this.boundResize = this.handleResize.bind(this);
      this.boundVisibility = this.handleVisibilityChange.bind(this);
      this.boundMotion = this.handleReducedMotion.bind(this);
    }

    init() {
      if (typeof document === 'undefined') return;
      this.injectDOM();
      this.setupCanvas();
      this.bindAudioBus();
      this.bindSystemEvents();
      this.startLoop();
    }

    injectDOM() {
      const sectionHeader = document.querySelector('.section-header');
      if (!sectionHeader) return;

      const visualizerWrap = document.createElement('div');
      visualizerWrap.className = 'leaderboard-spectrum-wrap';
      visualizerWrap.id = 'leaderboard-spectrum-wrap';
      visualizerWrap.setAttribute('role', 'region');
      visualizerWrap.setAttribute('aria-label', 'Chiptune Audio Spectrum Analyzer');

      visualizerWrap.innerHTML = `
        <div class="spectrum-hud-header">
          <div class="spectrum-hud-title">
            <span class="hud-led-dot"></span>
            <span class="hud-title-text"><i data-lucide="activity"></i> CHIPTUNE 16-BAND EQUALIZER</span>
          </div>
          <div class="spectrum-hud-metrics">
            <span class="spectrum-status-badge" id="spectrum-status-badge">AMBIENT SYNTH WAVE</span>
            <button type="button" class="spectrum-test-btn" id="spectrum-test-btn" title="Trigger interactive chiptune chord test">
              <i data-lucide="volume-2"></i> Pulse Test
            </button>
          </div>
        </div>
        <div class="spectrum-canvas-container">
          <canvas id="leaderboard-spectrum-canvas" class="leaderboard-spectrum-canvas"></canvas>
        </div>
        <div class="spectrum-freq-axis">
          ${FREQ_LABELS.map(lbl => `<span class="freq-tag">${lbl}</span>`).join('')}
        </div>
      `;

      sectionHeader.parentNode.insertBefore(visualizerWrap, sectionHeader.nextSibling);
      this.container = visualizerWrap;
      this.statusBadge = document.getElementById('spectrum-status-badge');

      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons({ root: visualizerWrap });
      }

      const testBtn = document.getElementById('spectrum-test-btn');
      if (testBtn) {
        testBtn.addEventListener('click', () => this.triggerChiptunePulse());
      }
    }

    setupCanvas() {
      this.canvas = document.getElementById('leaderboard-spectrum-canvas');
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d', { alpha: true });
      this.handleResize();
    }

    handleResize() {
      if (!this.canvas || !this.container) return;
      const rect = this.canvas.getBoundingClientRect();
      const dpr = Math.max(window.devicePixelRatio || 1, 1);
      
      const displayWidth = Math.floor(rect.width || this.container.clientWidth - 40 || 800);
      const displayHeight = 110;

      this.canvas.width = Math.floor(displayWidth * dpr);
      this.canvas.height = Math.floor(displayHeight * dpr);
      this.canvas.style.height = `${displayHeight}px`;

      if (this.ctx) {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(dpr, dpr);
      }
    }

    bindAudioBus() {
      const attachAudio = () => {
        try {
          let ctx = null;
          if (window.SoundEngine && typeof window.SoundEngine.getAudioContext === 'function') {
            ctx = window.SoundEngine.getAudioContext();
          } else {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
              ctx = new AudioContextClass();
            }
          }

          if (ctx && ctx.state !== 'closed' && !this.analyser) {
            this.audioCtx = ctx;
            this.analyser = ctx.createAnalyser();
            this.analyser.fftSize = 64;
            this.analyser.smoothingTimeConstant = 0.82;
            this.freqData = new Uint8Array(this.analyser.frequencyBinCount);

            if (window.SoundEngine && window.SoundEngine.masterGain) {
              try {
                window.SoundEngine.masterGain.connect(this.analyser);
              } catch (_) {}
            }

            this.isAudioConnected = true;
          }
        } catch (_) {}
      };

      if (typeof window !== 'undefined') {
        window.addEventListener('click', attachAudio, { once: true });
        window.addEventListener('keydown', attachAudio, { once: true });
      }
    }

    triggerChiptunePulse() {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!this.audioCtx && AudioCtx) {
          this.audioCtx = new AudioCtx();
        }
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
          this.audioCtx.resume();
        }
        if (this.audioCtx && !this.analyser) {
          this.analyser = this.audioCtx.createAnalyser();
          this.analyser.fftSize = 64;
          this.analyser.smoothingTimeConstant = 0.8;
          this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
        }

        if (!this.audioCtx) return;

        const now = this.audioCtx.currentTime;
        const notes = [220, 330, 440, 660, 880];
        
        notes.forEach((freq, idx) => {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();

          osc.type = idx % 2 === 0 ? 'square' : 'sawtooth';
          osc.frequency.setValueAtTime(freq, now + idx * 0.05);

          gain.gain.setValueAtTime(0.12, now + idx * 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.35);

          osc.connect(gain);
          gain.connect(this.analyser);
          gain.connect(this.audioCtx.destination);

          osc.start(now + idx * 0.05);
          osc.stop(now + idx * 0.05 + 0.36);
        });

        if (this.statusBadge) {
          this.statusBadge.textContent = 'CHIPTUNE PULSE DETECTED';
          this.statusBadge.classList.add('active');
          setTimeout(() => {
            if (this.statusBadge) {
              this.statusBadge.classList.remove('active');
              this.statusBadge.textContent = this.currentMode === 'live' ? 'LIVE AUDIO ACTIVE' : 'AMBIENT SYNTH WAVE';
            }
          }, 1200);
        }
      } catch (_) {}
    }

    bindSystemEvents() {
      if (typeof window === 'undefined') return;
      window.addEventListener('resize', this.boundResize);
      document.addEventListener('visibilitychange', this.boundVisibility);

      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.prefersReducedMotion = mediaQuery.matches;
      if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', this.boundMotion);
      }
    }

    handleVisibilityChange() {
      if (typeof document !== 'undefined' && document.hidden) {
        this.pauseLoop();
      } else {
        this.startLoop();
      }
    }

    handleReducedMotion(e) {
      this.prefersReducedMotion = e.matches;
      if (this.prefersReducedMotion) {
        this.renderStaticFrame();
        this.pauseLoop();
      } else {
        this.startLoop();
      }
    }

    startLoop() {
      if (this.isPaused) {
        this.isPaused = false;
      }
      if (!this.rafId && !this.prefersReducedMotion && typeof requestAnimationFrame === 'function') {
        const tick = () => {
          this.render();
          this.rafId = requestAnimationFrame(tick);
        };
        this.rafId = requestAnimationFrame(tick);
      }
    }

    pauseLoop() {
      this.isPaused = true;
      if (this.rafId && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    }

    render() {
      if (!this.ctx || !this.canvas) return;

      const dpr = Math.max(window.devicePixelRatio || 1, 1);
      const width = this.canvas.width / dpr;
      const height = this.canvas.height / dpr;

      this.ctx.clearRect(0, 0, width, height);

      let hasLiveSignal = false;
      if (this.analyser && this.freqData) {
        this.analyser.getByteFrequencyData(this.freqData);
        let sum = 0;
        for (let i = 0; i < 16; i++) {
          sum += this.freqData[i];
        }
        if (sum > 25) {
          hasLiveSignal = true;
        }
      }

      this.ambientTimer += 0.038;

      if (hasLiveSignal) {
        this.currentMode = 'live';
        if (this.statusBadge && !this.statusBadge.classList.contains('active')) {
          this.statusBadge.textContent = 'LIVE AUDIO BUS ACTIVE';
          this.statusBadge.style.color = 'var(--neon-green, #10b981)';
        }
      } else {
        this.currentMode = 'ambient';
        if (this.statusBadge && !this.statusBadge.classList.contains('active')) {
          this.statusBadge.textContent = 'AMBIENT SYNTH WAVE';
          this.statusBadge.style.color = 'var(--neon-cyan, #38bdf8)';
        }
      }

      // Compute band values
      const targetBands = hasLiveSignal && this.freqData
        ? mapFrequencyTo16Bands(this.freqData, BANDS_COUNT)
        : computeAmbientBands(this.ambientTimer, BANDS_COUNT);

      for (let i = 0; i < BANDS_COUNT; i++) {
        this.bandValues[i] += (targetBands[i] - this.bandValues[i]) * 0.32;

        const physics = calculatePeakPhysics(
          this.bandValues[i],
          this.peaks[i],
          this.peakDropSpeeds[i],
          this.peakHoldCounters[i],
          GRAVITY,
          PEAK_DECAY_DELAY
        );

        this.peaks[i] = physics.peak;
        this.peakDropSpeeds[i] = physics.speed;
        this.peakHoldCounters[i] = physics.hold;
      }

      // Draw 16 columns of discrete retro LED segments
      const colWidth = (width - (BANDS_COUNT - 1) * 8) / BANDS_COUNT;
      const totalAvailableHeight = height - 12;
      const segmentHeight = Math.floor((totalAvailableHeight - (LED_SEGMENTS_COUNT - 1) * LED_GAP) / LED_SEGMENTS_COUNT);

      for (let col = 0; col < BANDS_COUNT; col++) {
        const x = Math.floor(col * (colWidth + 8));
        const activeSegments = Math.round(this.bandValues[col] * LED_SEGMENTS_COUNT);

        for (let seg = 0; seg < LED_SEGMENTS_COUNT; seg++) {
          const y = Math.floor(height - 6 - (seg + 1) * (segmentHeight + LED_GAP));
          const isActive = seg < activeSegments;
          const colors = getSegmentColors(seg, LED_SEGMENTS_COUNT, isActive);

          this.ctx.fillStyle = colors.fill;
          if (isActive) {
            this.ctx.shadowColor = colors.glow;
            this.ctx.shadowBlur = 6;
          } else {
            this.ctx.shadowBlur = 0;
          }

          this.ctx.beginPath();
          this.ctx.roundRect(x, y, colWidth, segmentHeight, 1.5);
          this.ctx.fill();
        }

        // Draw floating peak meter
        this.ctx.shadowBlur = 0;
        const peakSeg = Math.min(Math.floor(this.peaks[col] * LED_SEGMENTS_COUNT), LED_SEGMENTS_COUNT - 1);
        if (peakSeg > 0) {
          const peakY = Math.floor(height - 6 - (peakSeg + 1) * (segmentHeight + LED_GAP));
          this.ctx.fillStyle = '#38bdf8';
          this.ctx.shadowColor = '#38bdf8';
          this.ctx.shadowBlur = 8;
          this.ctx.fillRect(x, peakY, colWidth, 2.5);
        }
      }

      this.ctx.shadowBlur = 0;
    }

    renderStaticFrame() {
      if (!this.ctx || !this.canvas) return;
      const dpr = Math.max(window.devicePixelRatio || 1, 1);
      const width = this.canvas.width / dpr;
      const height = this.canvas.height / dpr;

      this.ctx.clearRect(0, 0, width, height);

      const colWidth = (width - (BANDS_COUNT - 1) * 8) / BANDS_COUNT;
      const totalAvailableHeight = height - 12;
      const segmentHeight = Math.floor((totalAvailableHeight - (LED_SEGMENTS_COUNT - 1) * LED_GAP) / LED_SEGMENTS_COUNT);

      for (let col = 0; col < BANDS_COUNT; col++) {
        const x = Math.floor(col * (colWidth + 8));
        const activeSegments = Math.round((Math.sin(col * 0.4) * 0.3 + 0.4) * LED_SEGMENTS_COUNT);

        for (let seg = 0; seg < LED_SEGMENTS_COUNT; seg++) {
          const y = Math.floor(height - 6 - (seg + 1) * (segmentHeight + LED_GAP));
          this.ctx.fillStyle = seg < activeSegments ? 'rgba(56, 189, 248, 0.7)' : 'rgba(56, 189, 248, 0.08)';
          this.ctx.beginPath();
          this.ctx.roundRect(x, y, colWidth, segmentHeight, 1);
          this.ctx.fill();
        }
      }
    }

    destroy() {
      this.pauseLoop();
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', this.boundResize);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', this.boundVisibility);
      }
      if (this.container && this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }
    }
  }

  // Export for browser
  if (typeof window !== 'undefined') {
    window.LeaderboardSpectrum = LeaderboardSpectrum;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        window.leaderboardSpectrum = new LeaderboardSpectrum();
        window.leaderboardSpectrum.init();
      });
    } else {
      window.leaderboardSpectrum = new LeaderboardSpectrum();
      window.leaderboardSpectrum.init();
    }
  }

  // Export for node tests
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      BANDS_COUNT,
      LED_SEGMENTS_COUNT,
      FREQ_LABELS,
      computeAmbientBands,
      calculatePeakPhysics,
      getSegmentColors,
      mapFrequencyTo16Bands,
      LeaderboardSpectrum
    };
  }
})();
