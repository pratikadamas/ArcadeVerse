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
    unlocked: false,

    init() {
      this.loadSettings();
      this.renderControls();
      this.bindDOMSounds();
      this.bindWindowMessages();
      this.bindAudioUnlock();
    },

    /**
     * True once the user has interacted with the page. Browsers log
     * "The AudioContext was not allowed to start" if a context is created or
     * resumed before that, so nothing touches the context until then.
     */
    hasUserGesture() {
      const ua = navigator.userActivation;
      return this.unlocked || !!(ua && ua.hasBeenActive);
    },

    getAudioContext() {
      if (!this.ctx) {
        if (!this.hasUserGesture()) return null;
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          this.ctx = new AudioContextClass();
          this.ctx.onstatechange = () => this.updateAudioStatus();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended' && this.hasUserGesture()) {
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
     * Updates all sound toggle controls across the DOM (desktop navbar, mobile drawer, game modal)
     */
    updateUI() {
      // 1. Desktop Navbar Toggle Button
      const navBtn = document.getElementById('global-sound-toggle-btn');
      if (navBtn) {
        navBtn.className = `sound-toggle-btn ${this.enabled ? 'sound-active' : 'sound-muted'}`;
        const label = navBtn.querySelector('.sound-label');
        if (label) label.textContent = this.enabled ? 'SFX ON' : 'SFX OFF';
        const labelText = this.enabled ? 'Mute arcade UI audio' : 'Unmute arcade UI audio';
        navBtn.setAttribute('aria-label', labelText);
        navBtn.setAttribute('title', labelText);
      }

      // 2. Mobile Nav Drawer Toggle Item
      const mobileBtn = document.getElementById('mobile-sound-toggle-btn');
      if (mobileBtn) {
        const mobileLabel = mobileBtn.querySelector('.mobile-sound-text');
        if (mobileLabel) mobileLabel.textContent = this.enabled ? 'Sound SFX: ON' : 'Sound SFX: OFF';
        const mobileIconWrap = mobileBtn.querySelector('.mobile-sound-icon-wrap');
        if (mobileIconWrap) {
          mobileIconWrap.innerHTML = this.enabled
            ? '<i data-lucide="volume-2"></i>'
            : '<i data-lucide="volume-x"></i>';
        }
        const mLabelText = this.enabled ? 'Mute arcade sound effects' : 'Unmute arcade sound effects';
        mobileBtn.setAttribute('aria-label', mLabelText);
        mobileBtn.setAttribute('title', mLabelText);
      }

      // 3. Game Modal Topbar Sound Button
      const modalBtn = document.getElementById('modal-sound-btn');
      if (modalBtn) {
        const modalTitle = this.enabled ? 'Mute Game Audio (M)' : 'Unmute Game Audio (M)';
        modalBtn.setAttribute('title', modalTitle);
        modalBtn.setAttribute('aria-label', modalTitle);
        if (this.enabled) {
          modalBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="modal-sound-icon" aria-hidden="true">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
            </svg>
          `;
        } else {
          modalBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="modal-sound-icon" aria-hidden="true" style="opacity: 0.65;">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <line x1="23" y1="9" x2="17" y2="15"></line>
              <line x1="17" y1="9" x2="23" y2="15"></line>
            </svg>
          `;
        }
      }

      if (window.lucide) {
        lucide.createIcons();
      }

      window.dispatchEvent(new CustomEvent('arcadeverse:sound-mode-changed', {
        detail: {
          enabled: this.enabled,
          muted: !this.enabled,
          volume: this.volume
        }
      }));
    },

    /**
     * Sets mute state explicitly
     * @param {boolean} muted
     */
    setMuted(muted) {
      this.enabled = !muted;
      this.saveSettings();
      this.broadcastAudioConfig();
      this.updateUI();
    },

    /**
     * Toggles sound mute/unmute and synchronizes with active game iframe
     */
    toggleMute() {
      this.enabled = !this.enabled;
      this.saveSettings();
      this.broadcastAudioConfig();
      this.updateUI();
      this.updateAudioStatus();
      if (this.enabled) this.playClick();
    },

    /**
     * Audio unlock handshake for the game modal. The first real user gesture
     * (anywhere on the page, or inside a same-origin game iframe) resumes the
     * shared AudioContext and tells the game with ARCADEVERSE_AUDIO_UNLOCKED.
     * Until then a small banner in the modal asks the player to click or press a key.
     */
    bindAudioUnlock() {
      this._onGesture = (e) => {
        if (e.type === 'keydown' && ['Escape', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) return;
        this.unlock();
      };
      this._gestureEvents = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'];
      this.armUnlockListeners();

      window.addEventListener('arcadeverse:game-launched', () => {
        // A sticky activation (earlier click on the page) is enough to unlock right away
        if (!this.unlocked && navigator.userActivation && navigator.userActivation.hasBeenActive) {
          this.unlock(true);
        }
        this.ensureModalIndicator();
        this.updateAudioStatus();
      });

      const modal = document.getElementById('game-modal');
      if (modal) {
        new MutationObserver(() => {
          if (!modal.classList.contains('active')) this.removeUnlockBanner();
        }).observe(modal, { attributes: true, attributeFilter: ['class'] });
      }

      const frame = document.getElementById('game-iframe');
      if (frame) {
        frame.addEventListener('load', () => {
          if (!modal || !modal.classList.contains('active')) return;
          if (this.unlocked) {
            this.notifyGameUnlocked();
            return;
          }
          // Pointer and key events inside an iframe never bubble to the parent,
          // so listen on the game document directly (same-origin only).
          try {
            const doc = frame.contentDocument;
            if (doc) {
              this._gestureEvents.forEach((evt) => {
                doc.addEventListener(evt, this._onGesture, { capture: true, passive: true });
              });
            }
          } catch (_) {}
        });
      }
    },

    armUnlockListeners() {
      this._gestureEvents.forEach((evt) => {
        document.addEventListener(evt, this._onGesture, { capture: true, passive: true });
      });
    },

    unlock(force) {
      if (this.unlocked) return;
      const ua = navigator.userActivation;
      // Escape/modifier keys and touchstart do not count as a gesture for autoplay
      if (!force && ua && !ua.isActive) return;
      this.unlocked = true;
      this._gestureEvents.forEach((evt) => {
        document.removeEventListener(evt, this._onGesture, { capture: true });
      });
      const ctx = this.getAudioContext();
      const done = () => {
        console.log('AudioContext active');
        this.removeUnlockBanner();
        this.updateAudioStatus();
        this.notifyGameUnlocked();
      };
      if (!ctx || ctx.state === 'running') {
        done();
        return;
      }
      ctx.resume().then(done).catch(() => {
        this.unlocked = false;
        this.armUnlockListeners();
        this.updateAudioStatus();
      });
    },

    notifyGameUnlocked() {
      try {
        const gameIframe = document.getElementById('game-iframe');
        if (gameIframe && gameIframe.contentWindow) {
          gameIframe.contentWindow.postMessage({
            type: 'ARCADEVERSE_AUDIO_UNLOCKED',
            state: this.ctx ? this.ctx.state : 'running',
            muted: !this.enabled,
            volume: this.volume
          }, '*');
        }
      } catch (_) {}
    },

    ensureModalIndicator() {
      const controls = document.querySelector('#game-modal .modal-controls');
      const wrapper = document.querySelector('#game-modal .modal-frame-wrapper');
      if (!controls || !wrapper) return;

      if (!document.getElementById('modal-audio-indicator')) {
        const btn = document.createElement('button');
        btn.id = 'modal-audio-indicator';
        btn.type = 'button';
        btn.className = 'sound-toggle-btn modal-audio-indicator';
        btn.innerHTML = `
          <span class="eq-bars">
            <span class="eq-bar bar-1"></span>
            <span class="eq-bar bar-2"></span>
            <span class="eq-bar bar-3"></span>
          </span>
          <span class="sound-label"></span>
        `;
        btn.addEventListener('click', () => this.toggleMute());
        controls.prepend(btn);
      }

      if (!this.unlocked && this.enabled && !document.getElementById('audio-unlock-banner')) {
        const banner = document.createElement('button');
        banner.id = 'audio-unlock-banner';
        banner.type = 'button';
        banner.className = 'audio-unlock-banner';
        banner.innerHTML = `
          <span class="eq-bars">
            <span class="eq-bar bar-1"></span>
            <span class="eq-bar bar-2"></span>
            <span class="eq-bar bar-3"></span>
          </span>
          <span>Click or press any key to start audio</span>
        `;
        banner.addEventListener('click', () => {
          const frame = document.getElementById('game-iframe');
          if (frame) frame.focus();
        });
        wrapper.appendChild(banner);
      }
    },

    removeUnlockBanner() {
      const banner = document.getElementById('audio-unlock-banner');
      if (banner) banner.remove();
    },

    /** Syncs the modal audio indicator: locked (waiting for a gesture), on, or muted */
    updateAudioStatus() {
      const btn = document.getElementById('modal-audio-indicator');
      if (!btn) return;
      let state = 'sound-active';
      let text = 'AUDIO ON';
      if (!this.enabled) {
        state = 'sound-muted';
        text = 'MUTED';
      } else if (!this.ctx || this.ctx.state !== 'running') {
        state = 'sound-locked';
        text = 'AUDIO LOCKED';
      }
      btn.className = `sound-toggle-btn modal-audio-indicator ${state}`;
      btn.querySelector('.sound-label').textContent = text;
      btn.setAttribute('aria-label', `Game audio: ${text.toLowerCase()}. Click to ${this.enabled ? 'mute' : 'unmute'}`);
      btn.title = this.enabled ? 'Mute arcade audio' : 'Unmute arcade audio';
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
      // 1. Desktop Navbar Toggle Button
      const container = document.querySelector('.nav-actions');
      if (container && !document.getElementById('global-sound-toggle-btn')) {
        const btn = document.createElement('button');
        btn.id = 'global-sound-toggle-btn';
        btn.className = `sound-toggle-btn ${this.enabled ? 'sound-active' : 'sound-muted'}`;
        btn.type = 'button';
        const labelText = this.enabled ? 'Mute arcade UI audio' : 'Unmute arcade UI audio';
        btn.setAttribute('aria-label', labelText);
        btn.setAttribute('title', labelText);
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
      }

      // 2. Mobile Nav Drawer Toggle Item
      const mobileDrawer = document.querySelector('.mobile-nav-content');
      if (mobileDrawer && !document.getElementById('mobile-sound-toggle-btn')) {
        const mobileBtn = document.createElement('button');
        mobileBtn.id = 'mobile-sound-toggle-btn';
        mobileBtn.className = 'mobile-nav-item sound-toggle-btn-mobile';
        mobileBtn.type = 'button';
        mobileBtn.style.cssText = 'width: 100%; border: none; background: transparent; cursor: pointer; text-align: left; padding: 0.75rem 1rem; display: flex; align-items: center; gap: 0.75rem;';
        const mLabelText = this.enabled ? 'Mute arcade sound effects' : 'Unmute arcade sound effects';
        mobileBtn.setAttribute('aria-label', mLabelText);
        mobileBtn.setAttribute('title', mLabelText);
        mobileBtn.innerHTML = `
          <span class="mobile-nav-icon mobile-sound-icon-wrap">
            <i data-lucide="${this.enabled ? 'volume-2' : 'volume-x'}"></i>
          </span>
          <span class="mobile-sound-text">${this.enabled ? 'Sound SFX: ON' : 'Sound SFX: OFF'}</span>
        `;
        mobileBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.toggleMute();
        });

        const mobileThemeBtn = mobileDrawer.querySelector('.theme-toggle-btn');
        if (mobileThemeBtn && mobileThemeBtn.parentNode === mobileDrawer) {
          mobileDrawer.insertBefore(mobileBtn, mobileThemeBtn.nextSibling);
        } else {
          mobileDrawer.appendChild(mobileBtn);
        }
      }

      // 3. Game Modal Sound Button (if present in markup)
      const modalBtn = document.getElementById('modal-sound-btn');
      if (modalBtn && !modalBtn.dataset.soundBound) {
        modalBtn.dataset.soundBound = 'true';
        modalBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.toggleMute();
        });
      }

      this.updateUI();
    },

    bindDOMSounds() {
      let lastHoverTarget = null;
      let lastHoverTime = 0;

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
