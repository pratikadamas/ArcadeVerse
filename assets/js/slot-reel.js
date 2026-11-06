/**
 * ArcadeVerse Visual Slot Reel Spinning Animation for Random Game Picker
 * Author: Babin123456
 * High-tech animated spinning slot reel with decelerating cubic-bezier curve,
 * Web Audio tick synchronization, celebratory neon glow flash, and skip option.
 */

(function () {
  'use strict';

  let slotModal = null;
  let reelStrip = null;
  let reelAudioCtx = null;
  let isSpinning = false;
  let currentAnimationId = null;

  // Web Audio Sound Generator
  function getAudioContext() {
    if (!reelAudioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) reelAudioCtx = new AudioContext();
    }
    if (reelAudioCtx && reelAudioCtx.state === 'suspended') {
      reelAudioCtx.resume();
    }
    return reelAudioCtx;
  }

  function playTickSound(frequency = 600) {
    try {
      const actx = getAudioContext();
      if (!actx) return;
      const now = actx.currentTime;
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.connect(gain);
      gain.connect(actx.destination);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(frequency, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.04);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.start(now);
      osc.stop(now + 0.04);
    } catch (_) {}
  }

  function playWinFanfare() {
    try {
      const actx = getAudioContext();
      if (!actx) return;
      const now = actx.currentTime;
      const freqs = [440, 554.37, 659.25, 880];

      freqs.forEach((f, idx) => {
        const osc = actx.createOscillator();
        const gain = actx.createGain();
        osc.connect(gain);
        gain.connect(actx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + idx * 0.1);
        gain.gain.setValueAtTime(0.18, now + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.35);

        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.35);
      });
    } catch (_) {}
  }

  // Create Slot Reel Modal Structure
  function createSlotModal() {
    if (document.getElementById('slot-reel-modal')) return;

    slotModal = document.createElement('div');
    slotModal.id = 'slot-reel-modal';
    slotModal.className = 'slot-reel-modal hidden';
    slotModal.setAttribute('role', 'dialog');
    slotModal.setAttribute('aria-modal', 'true');
    slotModal.setAttribute('aria-label', 'Random Game Selector Reel');

    slotModal.innerHTML = `
      <div class="slot-reel-overlay" id="slot-reel-overlay"></div>
      <div class="slot-machine-cabinet">
        <div class="slot-cabinet-header">
          <div class="slot-header-glow">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="4" width="20" height="16" rx="2"></rect>
              <line x1="6" y1="4" x2="6" y2="20"></line>
              <line x1="18" y1="4" x2="18" y2="20"></line>
            </svg>
            <span>QUANTUM GAME ROULETTE</span>
          </div>
          <button id="btn-skip-slot" class="btn-skip-slot" title="Skip Animation">
            SKIP &rarr;
          </button>
        </div>

        <!-- Window with Center Payline Indicators -->
        <div class="slot-viewport-window">
          <div class="slot-payline payline-left"></div>
          <div class="slot-payline payline-right"></div>
          <div class="slot-center-target-glow"></div>

          <!-- Reel Strip (Vertical Scroll Container) -->
          <div class="slot-reel-strip" id="slot-reel-strip">
            <!-- Dynamically populated cards -->
          </div>
        </div>

        <div class="slot-cabinet-footer">
          <div class="slot-selection-title" id="slot-chosen-title">SELECTING ARENA TARGET...</div>
          <div class="slot-subtext">Cubic Bezier Velocity Dampening Active</div>
        </div>
      </div>
    `;

    document.body.appendChild(slotModal);

    document.getElementById('btn-skip-slot').addEventListener('click', skipAnimation);
    injectSlotCSS();
  }

  let chosenTargetGame = null;

  /**
   * Triggers the full 3-second animated slot reel sequence
   * @param {Array} games - List of games from GAMES_REGISTRY
   * @param {Function} onFinish - Callback with the chosen game object
   */
  function launchSlotPicker(games, onFinish) {
    if (isSpinning) return;
    if (!games || games.length === 0) return;

    if (!slotModal) createSlotModal();

    isSpinning = true;
    chosenTargetGame = games[Math.floor(Math.random() * games.length)];

    const strip = document.getElementById('slot-reel-strip');
    const titleDisplay = document.getElementById('slot-chosen-title');
    strip.innerHTML = '';
    titleDisplay.textContent = 'SPINNING ARCHIVES...';
    titleDisplay.classList.remove('won');

    // Build extended reel sequence: 35 randomized cards + final landing card
    const cardHeight = 110;
    const totalSpinItems = 38;
    const sequence = [];

    for (let i = 0; i < totalSpinItems - 1; i++) {
      sequence.push(games[Math.floor(Math.random() * games.length)]);
    }
    // Place winning target precisely at destination index
    const targetIndex = totalSpinItems - 2;
    sequence[targetIndex] = chosenTargetGame;

    // Populate DOM
    sequence.forEach((g, idx) => {
      const card = document.createElement('div');
      card.className = 'slot-card';
      if (idx === targetIndex) card.classList.add('target-winner');
      card.innerHTML = `
        <div class="slot-card-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 19 21 12 17 5 21 12 2"></polygon>
          </svg>
        </div>
        <div class="slot-card-meta">
          <span class="slot-card-category">${g.category || 'Arcade'}</span>
          <span class="slot-card-title">${escapeHTML(g.title)}</span>
        </div>
      `;
      strip.appendChild(card);
    });

    slotModal.classList.remove('hidden');

    // Reset initial translation
    strip.style.transition = 'none';
    strip.style.transform = 'translateY(0px)';

    // Compute target displacement
    // Target card center aligned with window center (viewport height = 240px, card = 110px)
    const viewportHeight = 240;
    const offsetCenter = (viewportHeight - cardHeight) / 2;
    const targetY = -(targetIndex * cardHeight - offsetCenter);

    // Audio tick player synchronized with speed
    let tickCount = 0;
    const tickInterval = setInterval(() => {
      if (!isSpinning) {
        clearInterval(tickInterval);
        return;
      }
      playTickSound(500 + (tickCount % 10) * 40);
      tickCount++;
      if (tickCount > 24) clearInterval(tickInterval);
    }, 110);

    // Start CSS transition with cubic-bezier easing deceleration
    requestAnimationFrame(() => {
      strip.style.transition = 'transform 3.0s cubic-bezier(0.12, 0.8, 0.22, 1)';
      strip.style.transform = `translateY(${targetY}px)`;
    });

    // Handle Animation Finish
    currentAnimationId = setTimeout(() => {
      finishSpin(onFinish);
    }, 3100);
  }

  function finishSpin(onFinish) {
    if (!isSpinning) return;
    isSpinning = false;
    clearTimeout(currentAnimationId);

    const titleDisplay = document.getElementById('slot-chosen-title');
    if (chosenTargetGame) {
      titleDisplay.textContent = `TARGET: ${chosenTargetGame.title.toUpperCase()}`;
      titleDisplay.classList.add('won');
      playWinFanfare();
    }

    setTimeout(() => {
      if (slotModal) slotModal.classList.add('hidden');
      if (typeof onFinish === 'function' && chosenTargetGame) {
        onFinish(chosenTargetGame);
      }
    }, 900);
  }

  function skipAnimation() {
    if (!isSpinning) return;
    isSpinning = false;
    clearTimeout(currentAnimationId);

    if (slotModal) slotModal.classList.add('hidden');
    if (chosenTargetGame && window.openGameModal) {
      window.openGameModal(chosenTargetGame);
    }
  }

  function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, (tag) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }

  // Intercept default random button
  function hookRandomGameButton() {
    const randomGameBtn = document.getElementById('random-game-btn');
    if (randomGameBtn) {
      // Clone button to wipe old single-timeout listeners cleanly
      const newBtn = randomGameBtn.cloneNode(true);
      randomGameBtn.parentNode.replaceChild(newBtn, randomGameBtn);

      newBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (typeof GAMES_REGISTRY !== 'undefined' && Array.isArray(GAMES_REGISTRY) && GAMES_REGISTRY.length > 0) {
          launchSlotPicker(GAMES_REGISTRY, (game) => {
            if (typeof window.openGameModal === 'function') {
              window.openGameModal(game, newBtn);
            }
          });
        }
      });
    }
  }

  // CSS Styles
  function injectSlotCSS() {
    if (document.getElementById('slot-reel-css')) return;

    const style = document.createElement('style');
    style.id = 'slot-reel-css';
    style.textContent = `
      .slot-reel-modal {
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .slot-reel-modal.hidden {
        display: none !important;
      }
      .slot-reel-overlay {
        position: absolute;
        inset: 0;
        background: rgba(5, 8, 15, 0.9);
        backdrop-filter: blur(8px);
      }
      .slot-machine-cabinet {
        position: relative;
        width: 90vw;
        max-width: 520px;
        background: rgba(15, 23, 42, 0.98);
        border: 2px solid #00f0ff;
        border-radius: 14px;
        box-shadow: 0 0 40px rgba(0, 240, 255, 0.35), inset 0 0 25px rgba(0, 240, 255, 0.1);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        font-family: 'Segoe UI', system-ui, monospace;
      }
      .slot-cabinet-header {
        padding: 14px 20px;
        background: rgba(8, 12, 20, 0.95);
        border-bottom: 1px solid #1e293b;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .slot-header-glow {
        display: flex;
        align-items: center;
        gap: 10px;
        color: #00f0ff;
        font-weight: 800;
        letter-spacing: 1.5px;
        font-size: 0.95rem;
        text-shadow: 0 0 10px rgba(0, 240, 255, 0.6);
      }
      .btn-skip-slot {
        background: rgba(30, 41, 59, 0.6);
        border: 1px solid #1e293b;
        color: #94a3b8;
        padding: 4px 12px;
        border-radius: 4px;
        font-size: 0.72rem;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s;
      }
      .btn-skip-slot:hover {
        border-color: #00f0ff;
        color: #fff;
      }
      .slot-viewport-window {
        height: 240px;
        position: relative;
        overflow: hidden;
        background: #020408;
        box-shadow: inset 0 10px 20px rgba(0, 0, 0, 0.8), inset 0 -10px 20px rgba(0, 0, 0, 0.8);
      }
      .slot-payline {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        width: 16px;
        height: 3px;
        background: #f43f5e;
        box-shadow: 0 0 8px #f43f5e;
        z-index: 10;
      }
      .payline-left { left: 0; }
      .payline-right { right: 0; }
      .slot-center-target-glow {
        position: absolute;
        top: 50%;
        left: 20px;
        right: 20px;
        height: 104px;
        transform: translateY(-50%);
        border: 1px dashed rgba(0, 240, 255, 0.4);
        border-radius: 8px;
        pointer-events: none;
        z-index: 5;
        box-shadow: 0 0 20px rgba(0, 240, 255, 0.15);
      }
      .slot-reel-strip {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        will-change: transform;
      }
      .slot-card {
        height: 110px;
        width: 88%;
        display: flex;
        align-items: center;
        gap: 16px;
        background: rgba(15, 23, 42, 0.85);
        border: 1px solid #1e293b;
        border-radius: 8px;
        padding: 0 20px;
        box-sizing: border-box;
        margin-bottom: 0px;
      }
      .slot-card-icon {
        width: 44px;
        height: 44px;
        border-radius: 8px;
        background: rgba(0, 240, 255, 0.12);
        border: 1px solid rgba(0, 240, 255, 0.4);
        display: flex;
        justify-content: center;
        align-items: center;
        color: #00f0ff;
      }
      .slot-card-meta {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .slot-card-category {
        font-size: 0.65rem;
        font-weight: bold;
        letter-spacing: 1px;
        color: #f43f5e;
        text-transform: uppercase;
      }
      .slot-card-title {
        font-size: 1.05rem;
        font-weight: 800;
        color: #fff;
      }
      .slot-cabinet-footer {
        padding: 14px 20px;
        background: rgba(8, 12, 20, 0.95);
        border-top: 1px solid #1e293b;
        text-align: center;
      }
      .slot-selection-title {
        font-size: 1rem;
        font-weight: 800;
        color: #00f0ff;
        letter-spacing: 1px;
        transition: all 0.3s ease;
      }
      .slot-selection-title.won {
        color: #10b981;
        text-shadow: 0 0 12px #10b981;
      }
      .slot-subtext {
        font-size: 0.68rem;
        color: #94a3b8;
        margin-top: 4px;
      }
    `;
    document.head.appendChild(style);
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hookRandomGameButton);
  } else {
    hookRandomGameButton();
  }

  // Global Export
  window.ArcadeSlotReel = {
    spin: launchSlotPicker
  };
})();
