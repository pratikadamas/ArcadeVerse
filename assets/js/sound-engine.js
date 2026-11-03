/**
 * ArcadeVerse Global Web Audio Sound Engine
 * Procedural tactile acoustic audio synthesis using native Web Audio API
 * Realistic mechanical switch clicks and throttled responsive hover cues
 * Author: Babin Bid (@Babin123456)
 * Open Source for ArcadeVerse - NSOC Winter Edition 2026
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'arcadeverse_sound_settings';
  const MASTER_VOL_KEY = 'arcadeverse_master_volume';
  const MASTER_MUTE_KEY = 'arcadeverse_muted';

  const SoundEngine = {
    ctx: null,
    enabled: true,
    volume: 0.28,

    init() {
      this.loadSettings();
      this.renderControls();
      this.bindDOMSounds();
      this.bindWindowMessages();
    },

    getAudioContext() {
      if (!this.ctx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          this.ctx = new AudioContextClass();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    },

    loadSettings() {
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (saved && typeof saved.enabled === 'boolean') {
          this.enabled = saved.enabled;
          this.volume = typeof saved.volume === 'number' ? saved.volume : 0.28;
        } else {
          // Backward compatibility check with direct keys
          const legacyMuted = localStorage.getItem(MASTER_MUTE_KEY);
          const legacyVol = localStorage.getItem(MASTER_VOL_KEY);
          if (legacyMuted !== null) this.enabled = legacyMuted !== 'true';
          if (legacyVol !== null) this.volume = parseFloat(legacyVol) || 0.28;
        }
      } catch (_) {}
    },

    saveSettings() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          enabled: this.enabled,
          volume: this.volume
        }));
        localStorage.setItem(MASTER_MUTE_KEY, (!this.enabled).toString());
        localStorage.setItem(MASTER_VOL_KEY, this.volume.toString());
      } catch (_) {}
    },

    /**
     * Centralized Master Audio Bus: Dispatches mute and volume state to active game iframe
     */
    broadcastAudioConfig() {
      try {
        const gameIframe = document.getElementById('game-iframe');
        if (gameIframe && gameIframe.contentWindow) {
          gameIframe.contentWindow.postMessage({
            type: 'ARCADEVERSE_AUDIO_CONFIG',
            muted: !this.enabled,
            volume: this.volume
          }, '*');
        }
      } catch (_) {}
    },

    /**
     * Sets volume dynamically and synchronizes with active game iframe
     * @param {number} vol 0.0 to 1.0
     */
    setVolume(vol) {
      this.volume = Math.max(0, Math.min(1, Number(vol) || 0));
      this.saveSettings();
      this.broadcastAudioConfig();
    },

    /**
     * Toggles sound mute/unmute and synchronizes with active game iframe
     */
    toggleMute() {
      this.enabled = !this.enabled;
      this.saveSettings();
      this.broadcastAudioConfig();
      const btn = document.getElementById('global-sound-toggle-btn');
      if (btn) {
        btn.className = `sound-toggle-btn ${this.enabled ? 'sound-active' : 'sound-muted'}`;
        const label = btn.querySelector('.sound-label');
        if (label) label.textContent = this.enabled ? 'SFX ON' : 'SFX OFF';
        btn.setAttribute('aria-label', this.enabled ? 'Mute arcade UI audio' : 'Unmute arcade UI audio');
      }
      if (this.enabled) this.playClick();
    },

    bindWindowMessages() {
      // Allow embedded games to query current master volume on startup
      window.addEventListener('message', (e) => {
        if (!e.data || typeof e.data !== 'object') return;
        if (e.data.type === 'ARCADEVERSE_REQUEST_AUDIO_CONFIG') {
          this.broadcastAudioConfig();
        }
      });
    },

    // Realistic Physical Mechanical Switch Click
    playClick() {
      if (!this.enabled) return;
      const ctx = this.getAudioContext();
      if (!ctx) return;

      try {
        const now = ctx.currentTime;

        // 1. Sharp high-frequency mechanical switch pop (transient snap)
        const oscClick = ctx.createOscillator();
        const gainClick = ctx.createGain();

        oscClick.type = 'triangle';
        oscClick.frequency.setValueAtTime(1750, now);
        oscClick.frequency.exponentialRampToValueAtTime(75, now + 0.012);

        gainClick.gain.setValueAtTime(this.volume * 0.95, now);
        gainClick.gain.exponentialRampToValueAtTime(0.0001, now + 0.014);

        oscClick.connect(gainClick);
        gainClick.connect(ctx.destination);

        oscClick.start(now);
        oscClick.stop(now + 0.015);

        // 2. Subtle low acoustic bottom-out thump (physical keycap reverberation)
        const oscBody = ctx.createOscillator();
        const gainBody = ctx.createGain();

        oscBody.type = 'sine';
        oscBody.frequency.setValueAtTime(160, now + 0.003);
        oscBody.frequency.exponentialRampToValueAtTime(40, now + 0.024);

        gainBody.gain.setValueAtTime(this.volume * 0.45, now + 0.003);
        gainBody.gain.exponentialRampToValueAtTime(0.0001, now + 0.026);

        oscBody.connect(gainBody);
        gainBody.connect(ctx.destination);

        oscBody.start(now + 0.003);
        oscBody.stop(now + 0.028);
      } catch (_) {}
    },

    // Subtle tactile hover tick
    playHover() {
      if (!this.enabled) return;
      const ctx = this.getAudioContext();
      if (!ctx) return;

      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(720, now);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.02);

        gain.gain.setValueAtTime(this.volume * 0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.022);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.025);
      } catch (_) {}
    },

    playFilterSelect() {
      this.playClick();
      setTimeout(() => {
        if (!this.enabled) return;
        const ctx = this.getAudioContext();
        if (!ctx) return;
        try {
          const now = ctx.currentTime;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(640, now);
          osc.frequency.exponentialRampToValueAtTime(960, now + 0.04);
          gain.gain.setValueAtTime(this.volume * 0.4, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.05);
        } catch (_) {}
      }, 35);
    },

    playModalOpen() {
      this.playClick();
    },

    playModalClose() {
      this.playClick();
    },

    renderControls() {
      const container = document.querySelector('.nav-actions');
      if (!container || document.getElementById('global-sound-toggle-btn')) return;

      const btn = document.createElement('button');
      btn.id = 'global-sound-toggle-btn';
      btn.className = `sound-toggle-btn ${this.enabled ? 'sound-active' : 'sound-muted'}`;
      btn.type = 'button';
      btn.setAttribute('aria-label', this.enabled ? 'Mute arcade UI audio' : 'Unmute arcade UI audio');
      btn.title = 'Toggle Arcade UI Audio';
      btn.innerHTML = `
        <span class="eq-bars">
          <span class="eq-bar bar-1"></span>
          <span class="eq-bar bar-2"></span>
          <span class="eq-bar bar-3"></span>
        </span>
        <span class="sound-label">${this.enabled ? 'SFX ON' : 'SFX OFF'}</span>
      `;

      btn.addEventListener('click', () => {
        this.toggleMute();
      });

      container.prepend(btn);
    },

    bindDOMSounds() {
      let lastHoverTarget = null;
      let lastHoverTime = 0;

      // Global unlocker on first user interaction anywhere
      const unlockAudio = () => {
        this.getAudioContext();
        ['click', 'touchstart', 'keydown'].forEach(evt => {
          document.removeEventListener(evt, unlockAudio, { capture: true });
        });
      };
      ['click', 'touchstart', 'keydown'].forEach(evt => {
        document.addEventListener(evt, unlockAudio, { capture: true, passive: true });
      });

      // Subtle hover tick on interactive buttons and navigation
      document.addEventListener('mouseover', (e) => {
        const target = e.target.closest('.pill, .nav-item, .nav-link, .docs-nav-link, .sound-toggle-btn, .theme-toggle-btn, .btn-halloween-play, .halloween-card-icon, button, a.btn');
        if (!target) {
          lastHoverTarget = null;
          return;
        }
        if (target === lastHoverTarget) return;

        const now = Date.now();
        if (now - lastHoverTime < 200) return;

        lastHoverTarget = target;
        lastHoverTime = now;
        this.playHover();
      });

      document.addEventListener('click', (e) => {
        // Ensure AudioContext is active
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }

        if (e.target.closest('.pill, .category-pill')) {
          this.playFilterSelect();
        } else if (e.target.closest('.btn, .nav-item, .nav-link, .docs-nav-link, .faq-question, .rate-star-btn, .podium-trophy-btn, .table-trophy-btn, .theme-toggle-btn, .btn-play-trigger, .tool-portal-card, .game-card, .halloween-card, .btn-halloween-play, .modal-close-btn, .close-btn, button, a.cta-btn')) {
          this.playClick();
        }
      });
    }
  };

  window.SoundEngine = SoundEngine;
  document.addEventListener('DOMContentLoaded', () => SoundEngine.init());
})();
