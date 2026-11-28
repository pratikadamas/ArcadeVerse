/**
 * ArcadeVerse - Procedural Background Ambient Arcade Hall Chatter & Coin Drop Soundscape
 * Issue #1369
 *
 * Generates authentic, continuous arcade parlor background soundscapes using pure Web Audio API
 * without streaming large pre-recorded audio files.
 *
 * Procedural Soundscape Layers:
 * - Low-frequency crowd murmur (filtered white noise approximating brown/pink noise)
 * - Random distant arcade beeps (sporadic high-frequency square wave arpeggios)
 * - Occasional coin drop rattle and button microswitch clicks
 *
 * Interactive Volume & Ambient Preset Controls:
 * - Navbar toggle cycling Off / Quiet Background / Full Arcade Energy
 * - Automatic muting when a game modal is launched (arcadeverse:game-launched)
 * - Resumes on game close (arcadeverse:game-closed)
 * - Off by default; requires explicit user toggle to respect browser audio policies
 *
 * Pure Vanilla JS Web Audio API; zero external audio samples or libraries.
 * Author: Khushi Shah (@shahkhushi0307) - NSOC Winter Edition 2026
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'av_ambient_arcade_hall';
  const PRESETS = ['off', 'quiet', 'full'];

  const PRESET_LABELS = {
    off: 'Ambient Arcade Hall',
    quiet: 'Quiet Background',
    full: 'Full Arcade Energy'
  };

  const PRESET_SUB = {
    off: 'Ambient arcade hall sounds disabled',
    quiet: 'Soft crowd murmur with occasional distant beeps',
    full: 'Energetic arcade hall with frequent beeps, coin drops and clicks'
  };

  // Per-preset layer gains and beep cadence
  const PRESET_CONFIGS = {
    off: { murmur: 0, beep: 0, coin: 0, click: 0, beepIntervalMs: 99999 },
    quiet: { murmur: 0.025, beep: 0.018, coin: 0.014, click: 0.01, beepIntervalMs: 4500 },
    full: { murmur: 0.05, beep: 0.035, coin: 0.035, click: 0.025, beepIntervalMs: 1500 }
  };

  const AmbientArcadeHall = {
    preset: 'off',
    audioCtx: null,
    masterGain: null,
    noiseBuffer: null,
    noiseSource: null,
    noiseGain: null,
    noiseFilter: null,
    beepTimer: null,
    clickTimer: null,
    isPlaying: false,
    initialized: false,
    autoPaused: false,

    init() {
      if (this.initialized) return;
      this.initialized = true;

      this.loadPreset();
      this.injectStyles();
      this.injectNavbarControls();
      this.attachGameListeners();
      this.syncNavbarUI();

      // Only start audio if preset is not 'off' (respects off-by-default policy)
      if (this.preset !== 'off') {
        this.applyPreset(this.preset);
      }
    },

    loadPreset() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw && PRESETS.includes(raw)) {
          this.preset = raw;
        }
      } catch (_) {}
    },

    savePreset() {
      try {
        localStorage.setItem(STORAGE_KEY, this.preset);
      } catch (_) {}
    },

    // Lazily creates/resumes the shared AudioContext only on user gesture
    getAudioContext() {
      if (this.audioCtx) {
        if (this.audioCtx.state === 'suspended') {
          this.audioCtx.resume().catch(() => {});
        }
        return this.audioCtx;
      }
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      try {
        this.audioCtx = new AudioCtx();
        this.masterGain = this.audioCtx.createGain();
        this.masterGain.gain.setValueAtTime(0.4, this.audioCtx.currentTime);
        this.masterGain.connect(this.audioCtx.destination);
      } catch (e) {
        this.audioCtx = null;
        this.masterGain = null;
      }
      return this.audioCtx;
    },

    applyPreset(preset) {
      if (!PRESETS.includes(preset)) return;
      this.preset = preset;
      this.savePreset();
      this.syncNavbarUI();

      const ctx = this.getAudioContext();
      if (!ctx) return;

      const cfg = PRESET_CONFIGS[preset];
      this.stopMurmur();
      this.stopBeeps();
      this.stopClicks();

      if (preset === 'off') {
        this.isPlaying = false;
        this.announce('Ambient arcade hall disabled');
        return;
      }

      this.startMurmur(cfg.murmur);
      this.scheduleBeeps(cfg.beep, cfg.beepIntervalMs);
      this.scheduleClicks(cfg.click);
      this.isPlaying = true;
      this.announce(PRESET_LABELS[preset]);
    },

    cycle() {
      const idx = PRESETS.indexOf(this.preset);
      const next = PRESETS[(idx + 1) % PRESETS.length];
      this.applyPreset(next);
    },

    // ---- Crowd Murmur Layer (looped noise buffer + lowpass filter) ----
    generateNoiseBuffer(durationSec) {
      const ctx = this.getAudioContext();
      if (!ctx) return null;
      const sampleRate = ctx.sampleRate;
      const length = sampleRate * durationSec;
      const buffer = ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);

      // Brown-ish noise: cumulative sum of white noise (1/f^2 character) then normalize
      let last = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        last += white * 0.02;
        last = Math.max(-1, Math.min(1, last));
        data[i] = last;
      }
      return buffer;
    },

    startMurmur(gainVal) {
      if (this.noiseSource) this.stopMurmur();
      const ctx = this.getAudioContext();
      if (!ctx) return;

      try {
        this.noiseBuffer = this.generateNoiseBuffer(4); // 4-second loop
        if (!this.noiseBuffer) return;

        this.noiseSource = ctx.createBufferSource();
        this.noiseSource.buffer = this.noiseBuffer;
        this.noiseSource.loop = true;

        this.noiseFilter = ctx.createBiquadFilter();
        this.noiseFilter.type = 'lowpass';
        this.noiseFilter.frequency.setValueAtTime(450, ctx.currentTime);
        this.noiseFilter.Q.setValueAtTime(1, ctx.currentTime);

        this.noiseGain = ctx.createGain();
        this.noiseGain.gain.setValueAtTime(gainVal, ctx.currentTime);

        this.noiseSource.connect(this.noiseFilter);
        this.noiseFilter.connect(this.noiseGain);
        this.noiseGain.connect(this.masterGain);

        this.noiseSource.start(0);
      } catch (e) {}
    },

    stopMurmur() {
      try {
        if (this.noiseSource) {
          this.noiseSource.stop(0);
          this.noiseSource.disconnect();
          this.noiseSource = null;
        }
      } catch (_) {}
      this.noiseBuffer = null;
      this.noiseFilter = null;
      this.noiseGain = null;
    },

    // ---- Distant Arcade Beeps Layer (square wave arpeggios) ----
    playBeep(gainVal) {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'square';
        // Sporadic high-frequency beep
        const baseFreq = 880 + Math.random() * 1200;
        osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.6, ctx.currentTime + 0.12);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2500, ctx.currentTime);
        filter.Q.setValueAtTime(4, ctx.currentTime);

        const now = ctx.currentTime;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(gainVal, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.4);
      } catch (e) {}
    },

    scheduleBeeps(gainVal, intervalMs) {
      this.stopBeeps();
      if (!gainVal || intervalMs >= 99999) return;
      const tick = () => {
        if (!this.isPlaying || this.preset === 'off' || this.autoPaused) return;
        this.playBeep(gainVal);
        // Randomize interval slightly for natural feel
        const jitter = intervalMs * (0.7 + Math.random() * 0.6);
        this.beepTimer = setTimeout(tick, jitter);
      };
      this.beepTimer = setTimeout(tick, intervalMs);
    },

    stopBeeps() {
      if (this.beepTimer) {
        clearTimeout(this.beepTimer);
        this.beepTimer = null;
      }
    },

    // ---- Coin Drop & Microswitch Click Layer ----
    playCoin(gainVal) {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        // Metallic rattle: noise burst + high ping
        osc.type = 'square';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(3500, now + 0.08);

        filter.type = 'highpass';
        filter.frequency.setValueAtTime(900, now);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(gainVal, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.3);
      } catch (e) {}
    },

    playClick(gainVal) {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.03);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(gainVal, now + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.07);
      } catch (e) {}
    },

    scheduleClicks(gainVal) {
      this.stopClicks();
      if (!gainVal) return;
      const tick = () => {
        if (!this.isPlaying || this.preset === 'off' || this.autoPaused) return;
        // Occasionally layer a coin drop with a click
        if (Math.random() < 0.35) {
          this.playCoin(gainVal);
        }
        this.playClick(gainVal * 0.6);
        const delay = 1200 + Math.random() * 2200;
        this.clickTimer = setTimeout(tick, delay);
      };
      this.clickTimer = setTimeout(tick, 1500);
    },

    stopClicks() {
      if (this.clickTimer) {
        clearTimeout(this.clickTimer);
        this.clickTimer = null;
      }
    },

    // ---- UI / Controls ----
    injectStyles() {
      if (document.getElementById('ambient-arcade-hall-styles')) return;
      const style = document.createElement('style');
      style.id = 'ambient-arcade-hall-styles';
      style.textContent = [
        '.ambient-hall-btn {',
        '  background: rgba(15, 23, 42, 0.7);',
        '  border: 1px solid rgba(56, 189, 248, 0.35);',
        '  color: #94a3b8;',
        '  width: 38px; height: 38px;',
        '  border-radius: var(--radius-sm, 8px);',
        '  display: inline-flex; align-items: center; justify-content: center;',
        '  cursor: pointer; transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);',
        '  flex-shrink: 0; font-size: 0.8rem;',
        '}',
        '.ambient-hall-btn:hover {',
        '  color: #38bdf8; border-color: #38bdf8; background: rgba(56, 189, 248, 0.1);',
        '}',
        '.ambient-hall-btn.active {',
        '  color: #38bdf8; border-color: #38bdf8; background: rgba(56, 189, 248, 0.18);',
        '  box-shadow: 0 0 14px rgba(56, 189, 248, 0.35);',
        '}',
        '[data-theme="light"] .ambient-hall-btn {',
        '  background: #ffffff; border: 1px solid rgba(0, 0, 0, 0.15); color: #1e293b;',
        '}',
        '[data-theme="light"] .ambient-hall-btn:hover { color: #2563eb; border-color: #2563eb; }',
        '[data-theme="light"] .ambient-hall-btn.active { color: #2563eb; border-color: #2563eb; background: rgba(37, 99, 235, 0.08); }'
      ].join('\n');
      document.head.appendChild(style);
    },

    injectNavbarControls() {
      const navActions = document.querySelector('.nav-actions');
      if (!navActions || document.getElementById('ambient-hall-trigger')) return;

      const btn = document.createElement('button');
      btn.id = 'ambient-hall-trigger';
      btn.className = 'ambient-hall-btn';
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Ambient Arcade Hall Sounds');
      btn.setAttribute('title', 'Ambient Arcade Hall Sounds');
      btn.innerHTML = '<i data-lucide="volume-2" style="width:16px;height:16px;"></i>';
      navActions.appendChild(btn);
    },

    syncNavbarUI() {
      const btn = document.getElementById('ambient-hall-trigger');
      if (!btn) return;
      const active = this.preset !== 'off';
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-label', PRESET_LABELS[this.preset]);
      btn.setAttribute('title', PRESET_LABELS[this.preset] + ' - ' + PRESET_SUB[this.preset]);
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        try { window.lucide.createIcons({ nodes: [btn.querySelector('[data-lucide]')] }); } catch (_) {}
      }
    },

    announce(text) {
      const announcer = document.getElementById('a11y-announcer');
      if (announcer) {
        announcer.textContent = text;
      }
    },

    attachGameListeners() {
      // Pause ambient audio when a game launches to prevent audio conflict
      window.addEventListener('arcadeverse:game-launched', () => {
        if (!this.isPlaying || this.autoPaused) return;
        this.autoPaused = true;
        this.stopMurmur();
        this.stopBeeps();
        this.stopClicks();
      });

      // Resume ambient audio when the game closes, if preset was active
      window.addEventListener('arcadeverse:game-closed', () => {
        if (!this.autoPaused || this.preset === 'off') return;
        this.autoPaused = false;
        const cfg = PRESET_CONFIGS[this.preset];
        this.startMurmur(cfg.murmur);
        this.scheduleBeeps(cfg.beep, cfg.beepIntervalMs);
        this.scheduleClicks(cfg.click);
      });
    },

    bindEvents() {
      document.addEventListener('click', (e) => {
        const btn = e.target.closest('#ambient-hall-trigger');
        if (!btn) return;
        e.preventDefault();
        this.cycle();
      });
    },

    getPreset() {
      return this.preset;
    },

    isEnabled() {
      return this.preset !== 'off';
    }
  };

  window.AmbientArcadeHall = AmbientArcadeHall;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      AmbientArcadeHall.init();
      AmbientArcadeHall.bindEvents();
    });
  } else {
    AmbientArcadeHall.init();
    AmbientArcadeHall.bindEvents();
  }
})();
