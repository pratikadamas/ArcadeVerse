/**
 * ArcadeVerse - In-Browser Retro Stamp Card & Daily Play Loyalty Punchcard
 * Issue #1372
 *
 * An interactive physical-styled 7-day loyalty punchcard drawer rendered with
 * vintage textured paper borders and stamped ink slots.
 *
 * Features:
 * - 100% client-side persistence in localStorage under `arcadeverse_punchcard`
 * - Procedural Web Audio mechanical stamp sound effect (zero audio files)
 * - Animated ink stamping ceremony with randomized rotation angle + smudge
 * - Day 7 holographic completion badge unlock + card reset
 * - Responsive drawer accessible from the daily streak counter in the header
 * - Pure Vanilla JS - no frameworks, no bundlers, no external audio assets
 *
 * Author: Khushi Shah (@shahkhushi0307) - NSOC Winter Edition 2026
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'arcadeverse_punchcard';
  const TOTAL_SLOTS = 7;

  const Punchcard = {
    el: null,
    backdrop: null,
    initialized: false,
    isOpen: false,

    // In-memory state
    state: {
      stamps: [],        // boolean[] length 7, which days are stamped
      lastStampDate: '', // ISO date string of last stamp
      completedCount: 0, // how many times day 7 was completed
      badges: []         // unlocked badge ids
    },

    // ---- Audio Context (procedural, lazy) ----
    audioCtx: null,

    getAudioContext() {
      if (this.audioCtx) return this.audioCtx;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      try {
        this.audioCtx = new AudioCtx();
      } catch (_) {
        this.audioCtx = null;
      }
      return this.audioCtx;
    },

    // ---- Persistence ----
    loadState() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed.stamps)) {
            this.state.stamps = parsed.stamps.slice(0, TOTAL_SLOTS);
          }
          if (typeof parsed.lastStampDate === 'string') {
            this.state.lastStampDate = parsed.lastStampDate;
          }
          if (typeof parsed.completedCount === 'number') {
            this.state.completedCount = parsed.completedCount;
          }
          if (Array.isArray(parsed.badges)) {
            this.state.badges = parsed.badges;
          }
        }
      } catch (_) {}
      this.ensureStateLength();
    },

    ensureStateLength() {
      while (this.state.stamps.length < TOTAL_SLOTS) {
        this.state.stamps.push(false);
      }
      this.state.stamps = this.state.stamps.slice(0, TOTAL_SLOTS);
      if (!this.state.lastStampDate) this.state.lastStampDate = '';
      if (typeof this.state.completedCount !== 'number') this.state.completedCount = 0;
      if (!Array.isArray(this.state.badges)) this.state.badges = [];
    },

    saveState() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch (_) {}
    },

    getUTCDayKey() {
      const now = new Date();
      return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
    },

    // ---- Stamping Logic ----
    isStampedToday() {
      return this.state.lastStampDate === this.getUTCDayKey();
    },

    stampToday() {
      if (this.isStampedToday()) return false;

      // Find first unstamped slot
      const slotIndex = this.state.stamps.findIndex(s => !s);
      if (slotIndex === -1) {
        // All slots filled -> reset for new week
        this.resetCard();
        return this.stampToday();
      }

      this.state.stamps[slotIndex] = true;
      this.state.lastStampDate = this.getUTCDayKey();
      this.saveState();

      // Play stamp sound
      this.playStampSound();

      // Check day 7 completion
      if (slotIndex === TOTAL_SLOTS - 1 && this.state.stamps.every(Boolean)) {
        this.unlockDay7Badge();
      }

      this.render();
      this.announce(this.state.stamps.filter(Boolean).length + ' of 7 days stamped');
      return true;
    },

    resetCard() {
      this.state.stamps = Array(TOTAL_SLOTS).fill(false);
      this.state.lastStampDate = '';
      this.state.completedCount += 1;
      this.saveState();
    },

    unlockDay7Badge() {
      const badgeId = 'holographic-day7';
      if (!this.state.badges.includes(badgeId)) {
        this.state.badges.push(badgeId);
        this.saveState();
      }
      this.announce('Day 7 complete! Holographic punchcard badge unlocked.');
    },

    hasBadge(badgeId) {
      return this.state.badges.includes(badgeId);
    },

    getStampedCount() {
      return this.state.stamps.filter(Boolean).length;
    },

    // ---- Procedural Stamp Sound (Web Audio API, zero files) ----
    playStampSound() {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      try {
        const now = ctx.currentTime;

        // 1. Mechanical thump body (low sine drop)
        const oscBody = ctx.createOscillator();
        const gainBody = ctx.createGain();
        oscBody.type = 'sine';
        oscBody.frequency.setValueAtTime(110, now);
        oscBody.frequency.exponentialRampToValueAtTime(40, now + 0.06);
        gainBody.gain.setValueAtTime(0.18, now);
        gainBody.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
        oscBody.connect(gainBody);
        gainBody.connect(ctx.destination);
        oscBody.start(now);
        oscBody.stop(now + 0.1);

        // 2. Inklike impact transient (triangle click)
        const oscClick = ctx.createOscillator();
        const gainClick = ctx.createGain();
        oscClick.type = 'triangle';
        oscClick.frequency.setValueAtTime(900, now);
        oscClick.frequency.exponentialRampToValueAtTime(200, now + 0.02);
        gainClick.gain.setValueAtTime(0.12, now);
        gainClick.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
        oscClick.connect(gainClick);
        gainClick.connect(ctx.destination);
        oscClick.start(now);
        oscClick.stop(now + 0.04);

        // 3. Paper rattle (bandpassed noise burst)
        const oscRattle = ctx.createOscillator();
        const gainRattle = ctx.createGain();
        const filterRattle = ctx.createBiquadFilter();
        oscRattle.type = 'sawtooth';
        oscRattle.frequency.setValueAtTime(150, now);
        oscRattle.frequency.exponentialRampToValueAtTime(40, now + 0.1);
        filterRattle.type = 'bandpass';
        filterRattle.frequency.setValueAtTime(900, now);
        filterRattle.Q.setValueAtTime(3, now);
        gainRattle.gain.setValueAtTime(0.05, now);
        gainRattle.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
        oscRattle.connect(filterRattle);
        filterRattle.connect(gainRattle);
        gainRattle.connect(ctx.destination);
        oscRattle.start(now);
        oscRattle.stop(now + 0.14);
      } catch (_) {}
    },

    // ---- Drawer UI ----
    injectStyles() {
      if (document.getElementById('arcade-punchcard-styles')) return;

      const style = document.createElement('style');
      style.id = 'arcade-punchcard-styles';
      style.textContent = [
        /* Punchcard Backdrop */
        '#arcade-punchcard-backdrop {',
        '  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6);',
        '  backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);',
        '  z-index: 1150; opacity: 0; pointer-events: none;',
        '  transition: opacity 0.25s ease;',
        '}',
        '#arcade-punchcard-backdrop.active { opacity: 1; pointer-events: all; }',

        /* Punchcard Drawer */
        '#arcade-punchcard-drawer {',
        '  position: fixed; bottom: 0; left: 0; right: 0;',
        '  width: 100%; max-width: 420px; margin: 0 auto;',
        '  background: #f5e6d3; /* vintage textured paper */',
        '  border: 2px solid #8b5a00;',
        '  border-top: none; border-radius: 20px 20px 0 0;',
        '  box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.5),',
        '            0 0 0 3px #d4a373 inset,',
        '            0 0 20px rgba(139, 90, 0, 0.3);',
        '  z-index: 1160; padding: 1.5rem 1.25rem 2rem;',
        '  transform: translateY(120%);',
        '  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);',
        '  box-sizing: border-box;',
        '  font-family: "Courier New", Courier, monospace;',
        '}',
        '#arcade-punchcard-drawer.active { transform: translateY(0); }',

        '@supports (bottom: env(safe-area-inset-bottom)) {',
        '  #arcade-punchcard-drawer {',
        '    bottom: max(1rem, env(safe-area-inset-bottom));',
        '  }',
        '}',

        /* Drawer Header */
        '.punchcard-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }',
        '.punchcard-header h2 { margin: 0; font-size: 1.15rem; color: #5c3a00; text-transform: uppercase; letter-spacing: 2px; }',
        '.punchcard-close { background: transparent; border: 1px solid #8b5a00; color: #5c3a00; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-size: 1rem; line-height: 1; display: flex; align-items: center; justify-content: center; }',
        '.punchcard-close:hover { background: rgba(139, 90, 0, 0.15); }',

        /* Progress */
        '.punchcard-progress { margin-bottom: 1.25rem; font-size: 0.85rem; color: #8b5a00; font-weight: bold; text-align: center; }',

        /* Slots Grid */
        '.punchcard-slots { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.5rem; margin-bottom: 1.25rem; }',

        '.punchcard-slot {',
        '  position: relative; width: 44px; height: 44px;',
        '  background: rgba(139, 90, 0, 0.12);',
        '  border: 1.5px solid #8b5a00;',
        '  border-radius: 8px;',
        '  display: flex; align-items: center; justify-content: center;',
        '  font-size: 0.7rem; font-weight: bold; color: #8b5a00;',
        '  cursor: pointer; transition: all 0.18s ease;',
        '}',
        '.punchcard-slot:hover { background: rgba(139, 90, 0, 0.25); transform: scale(1.05); }',
        '.punchcard-slot.stamped {',
        '  background: #d4a373; border-color: #5c3a00; color: #2a1800;',
        '  box-shadow: inset 0 0 8px rgba(0, 0, 0, 0.2);',
        '}',
        '.punchcard-slot.day-label { cursor: default; font-size: 0.6rem; }',

        /* Ink Stamp Overlay */
        '.punchcard-ink {',
        '  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;',
        '  opacity: 0; pointer-events: none;',
        '  font-size: 1.4rem; font-weight: bold; color: #5c3a00;',
        '  border: 2px solid #5c3a00; border-radius: 6px;',
        '  transition: opacity 0.2s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);',
        '}',
        '.punchcard-slot.stamped .punchcard-ink { opacity: 1; }',
        '.punchcard-ink.smudge { opacity: 0.35; filter: blur(1.5px); transform: scale(1.35) rotate(12deg); }',
        '.punchcard-ink.stamped { transform: scale(1) rotate(var(--ink-rotate, 0deg)); }',

        /* Holographic Badge */
        '.punchcard-badge {',
        '  display: none; flex-direction: column; align-items: center;',
        '  margin-top: 1rem; padding: 1rem;',
        '  background: linear-gradient(135deg, #ffd700, #ff69b4, #00ffff, #ffd700);',
        '  background-size: 300% 300%;',
        '  animation: punchcard-holo 3s ease-in-out infinite;',
        '  border-radius: 12px; border: 2px solid #ffffff;',
        '  box-shadow: 0 0 20px rgba(255, 215, 0, 0.6), 0 0 40px rgba(255, 105, 180, 0.4);',
        '}',
        '.punchcard-badge.visible { display: flex; }',
        '@keyframes punchcard-holo {',
        '  0% { background-position: 0% 50%; }',
        '  50% { background-position: 100% 50%; }',
        '  100% { background-position: 0% 50%; }',
        '}',
        '.punchcard-badge h3 { margin: 0.5rem 0 0.25rem; font-size: 0.85rem; color: #2a1800; text-transform: uppercase; letter-spacing: 1px; }',
        '.punchcard-badge p { margin: 0; font-size: 0.65rem; color: #5c3a00; text-align: center; }',

        /* Empty State Message */
        '.punchcard-empty { text-align: center; color: #8b5a00; font-size: 0.75rem; margin-top: 1rem; }',

        /* Stamp CTA */
        '.punchcard-cta {',
        '  margin-top: 1rem;',
        '  text-align: center;',
        '}',
        '.punchcard-btn {',
        '  display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;',
        '  width: 100%; max-width: 200px; padding: 0.75rem 1rem;',
        '  background: #5c3a00; color: #f5e6d3; border: none; border-radius: 8px;',
        '  font-family: inherit; font-weight: bold; font-size: 0.85rem;',
        '  cursor: pointer; text-transform: uppercase; letter-spacing: 1px;',
        '  box-shadow: 0 4px 0 #3d2600, 0 0 12px rgba(92, 58, 0, 0.4);',
        '  transition: all 0.15s ease;',
        '}',
        '.punchcard-btn:hover { background: #7a4e00; transform: translateY(-2px); }',
        '.punchcard-btn:active { transform: translateY(0); box-shadow: 0 2px 0 #3d2600; }',
        '.punchcard-btn.stamped { background: #8b5a00; cursor: not-allowed; opacity: 0.7; }',

        /* Light Theme Adaptation */
        '[data-theme="light"] #arcade-punchcard-drawer {',
        '  background: #faf3e4; border-color: #a67c00;',
        '  box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.15),',
        '            0 0 0 3px #d4a373 inset;',
        '}',
        '[data-theme="light"] .punchcard-header h2 { color: #7a4e00; }',
        '[data-theme="light"] .punchcard-progress { color: #a67c00; }',
        '[data-theme="light"] .punchcard-slot { background: rgba(166, 124, 0, 0.1); border-color: #a67c00; color: #a67c00; }',
        '[data-theme="light"] .punchcard-slot.stamped { background: #e3b87c; border-color: #5c3a00; color: #2a1800; }',
        '[data-theme="light"] .punchcard-close { border-color: #a67c00; color: #a67c00; }',
        '[data-theme="light"] .punchcard-close:hover { background: rgba(166, 124, 0, 0.15); }',

        /* Reduce Motion */
        'html.a11y-reduced-motion #arcade-punchcard-drawer { transition: none !important; }',
        'html.a11y-reduced-motion .punchcard-ink { transition: none !important; animation: none !important; }',
        'html.a11y-reduced-motion .punchcard-badge { animation: none !important; }'
      ].join('\n');

      document.head.appendChild(style);
    },

    render() {
      if (this.el) {
        this.el.remove();
        this.el = null;
      }
      if (this.backdrop) {
        this.backdrop.remove();
        this.backdrop = null;
      }

      this.el = document.createElement('div');
      this.el.id = 'arcade-punchcard-drawer';
      this.el.setAttribute('role', 'dialog');
      this.el.setAttribute('aria-modal', 'true');
      this.el.setAttribute('aria-label', 'Daily Loyalty Punchcard');
      this.el.className = this.isOpen ? 'active' : '';

      const stamped = this.getStampedCount();
      const day7Complete = this.state.stamps.every(Boolean);
      const isStampedToday = this.isStampedToday();
      const hasHolo = this.hasBadge('holographic-day7');

      const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

      const slotsHtml = this.state.stamps.map((stampedSlot, i) => {
        const isToday = i === new Date().getUTCDay() % 7;
        const inkRotate = (Math.random() * 30) - 15; // -15 to +15 degrees
        return `
          <div class="punchcard-slot ${stampedSlot ? 'stamped' : ''} ${isToday ? 'today' : ''}" 
               data-slot="${i}" 
               aria-label="Day ${i + 1}${stampedSlot ? ' stamped' : ' not stamped'}"
               role="button" tabindex="${stampedSlot ? -1 : 0}">
            <span class="day-label">${i + 1}</span>
            <div class="punchcard-ink ${stampedSlot ? 'stamped' : ''}" style="--ink-rotate: ${inkRotate}deg;">◆</div>
          </div>
        `;
      }).join('');

      this.el.innerHTML = `
        <div class="punchcard-header">
          <h2>LOYALTY PUNCHCARD</h2>
          <button type="button" class="punchcard-close" id="punchcard-close" aria-label="Close Punchcard">✕</button>
        </div>
        <div class="punchcard-progress">
          ${stamped} of ${TOTAL_SLOTS} days stamped${hasHolo ? ' • Holo Badge Unlocked!' : ''}
        </div>
        <div class="punchcard-slots">${slotsHtml}</div>
        ${day7Complete ? `
          <div class="punchcard-badge visible">
            <span style="font-size:2rem;">✧</span>
            <h3>Day 7 Complete</h3>
            <p>Holographic Loyalty Badge Unlocked • Card Reset</p>
          </div>
        ` : ''}
        <div class="punchcard-cta">
          ${isStampedToday || day7Complete
            ? `<button type="button" class="punchcard-btn punched" disabled aria-label="Already stamped today">STAMPED TODAY</button>`
            : `<button type="button" class="punchcard-btn" id="punchcard-stamp-btn" aria-label="Stamp today's loyalty slot">STAMP TODAY ◆</button>`}
        </div>
        <div class="punchcard-empty">
          ${hasHolo ? 'Visit daily to build your next streak.' : 'Stamp once per day. Complete 7 days for a holographic badge!'}
        </div>
      `;

      document.body.appendChild(this.el);

      this.backdrop = document.createElement('div');
      this.backdrop.id = 'arcade-punchcard-backdrop';
      this.backdrop.setAttribute('aria-hidden', 'true');
      this.backdrop.className = this.isOpen ? 'active' : '';
      document.body.appendChild(this.backdrop);

      // Bind drawer events
      const closeBtn = this.el.querySelector('#punchcard-close');
      if (closeBtn) closeBtn.addEventListener('click', () => this.close());

      const stampBtn = this.el.querySelector('#punchcard-stamp-btn');
      if (stampBtn) stampBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.stampToday();
      });

      this.backdrop.addEventListener('click', () => this.close());
    },

    open() {
      this.isOpen = true;
      this.render();
      document.body.style.overflow = 'hidden';
      this.announce('Loyalty punchcard opened');
    },

    close() {
      this.isOpen = false;
      this.render();
      document.body.style.overflow = '';
      if (window.ArcadeAnnouncer && typeof window.ArcadeAnnouncer.announce === 'function') {
        window.ArcadeAnnouncer.announce('Punchcard closed');
      }
    },

    toggle() {
      if (this.isOpen) this.close(); else this.open();
    },

    // ---- Screen Reader Announcer ----
    announce(text) {
      const announcer = document.getElementById('a11y-announcer');
      if (announcer) {
        announcer.textContent = text;
      }
    },

    // ---- Header Integration ----
    bindHeaderIntegration() {
      // Open drawer when daily streak button is clicked
      document.addEventListener('click', (e) => {
        const streakBtn = e.target.closest('#av-daily-streak-btn');
        if (streakBtn) {
          e.preventDefault();
          this.toggle();
        }
      });

      // Also open when clicking the daily streak badge in the daily challenge banner
      document.addEventListener('click', (e) => {
        const streakBadge = e.target.closest('.daily-streak-badge');
        if (streakBadge && !streakBadge.closest('#arcade-punchcard-drawer')) {
          e.preventDefault();
          this.toggle();
        }
      });

      // Close on Escape
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen) {
          this.close();
        }
      });
    },

    init() {
      if (this.initialized) return;
      this.initialized = true;

      this.loadState();
      this.injectStyles();
      this.bindHeaderIntegration();

      // Auto-open punchcard if a stamp is available and drawer was never opened
      // (subtle nudge on first visit)
    }
  };

  window.ArcadePunchcard = Punchcard;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Punchcard.init());
  } else {
    Punchcard.init();
  }
})();
