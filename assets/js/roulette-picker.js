/**
 * ArcadeVerse - Random Game Roulette Wheel Picker Modal
 * Architectural Implementation for Issue #1502
 *
 * - Filters candidate games based on active category / tag filters.
 * - Renders a segmented neon roulette wheel on <canvas> with ease-out cubic
 *   deceleration physics and celebratory landing glow.
 * - Synthesizes retro peg tick sounds during spin using Web Audio API (zero audio files).
 * - Displays winning game card with "Play Now!" and "Spin Again" actions.
 * - 100% Vanilla JS and CSS3; zero external libraries.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ArcadeRoulettePicker = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MAX_SLICES = 8;
  var SPIN_DURATION_MS = 3200;
  var SLICE_COLORS = [
    '#0891b2',
    '#7c3aed',
    '#db2777',
    '#059669',
    '#d97706',
    '#2563eb',
    '#e11d48',
    '#0d9488'
  ];

  var currentSlices = [];
  var currentRotationDeg = 0;
  var isSpinning = false;
  var selectedWinner = null;
  var audioCtx = null;

  /**
   * Filters catalog games by active category & tag filters.
   *
   * @param {Array<Object>} registry
   * @param {Object} [filters] - { category, tag }
   * @returns {Array<Object>}
   */
  function getCandidateGames(registry, filters) {
    var list = Array.isArray(registry) ? registry : [];
    if (list.length === 0) return [];

    var cat = filters && filters.category ? String(filters.category).toLowerCase().trim() : 'all';
    var tag = filters && filters.tag ? String(filters.tag).toLowerCase().trim() : '';

    var filtered = list.filter(function (game) {
      if (!game || !game.id) return false;
      if (cat && cat !== 'all' && cat !== 'favorites' && !cat.startsWith('playlist:')) {
        if (String(game.category || '').toLowerCase().trim() !== cat) return false;
      }
      if (tag) {
        var tags = Array.isArray(game.tags) ? game.tags.map(function (t) { return String(t).toLowerCase(); }) : [];
        if (tags.indexOf(tag) === -1) return false;
      }
      return true;
    });

    return filtered.length >= 2 ? filtered : list;
  }

  /**
   * Selects up to maxSlices random unique games for the roulette wheel.
   *
   * @param {Array<Object>} candidates
   * @param {number} [maxSlices=8]
   * @returns {Array<Object>}
   */
  function selectWheelSlices(candidates, maxSlices) {
    var limit = Math.max(2, Number(maxSlices) || MAX_SLICES);
    var pool = Array.isArray(candidates) ? candidates.slice() : [];
    // Fisher-Yates shuffle
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }
    return pool.slice(0, Math.min(limit, pool.length));
  }

  /**
   * Computes a smooth target rotation angle (in degrees) that lands on targetIndex.
   *
   * @param {number} sliceCount
   * @param {number} targetIndex
   * @param {number} [startAngleDeg=0]
   * @param {number} [extraTurns=5]
   * @returns {number}
   */
  function computeSpinTarget(sliceCount, targetIndex, startAngleDeg, extraTurns) {
    var count = Math.max(1, Number(sliceCount) || 1);
    var idx = ((Number(targetIndex) || 0) % count + count) % count;
    var sliceAngle = 360 / count;
    // Center of slice idx at 0deg rotation is (idx + 0.5) * sliceAngle clockwise from top
    // Rotating clockwise by theta places (360 - (theta % 360)) % 360 under the top pointer
    var desiredMod = (360 - ((idx + 0.5) * sliceAngle)) % 360;
    if (desiredMod < 0) desiredMod += 360;

    var base = Number(startAngleDeg) || 0;
    var currentMod = ((base % 360) + 360) % 360;
    var delta = desiredMod - currentMod;
    if (delta < 0) delta += 360;

    var turns = (Number(extraTurns) || 5) * 360;
    return base + turns + delta;
  }

  /**
   * Resolves which slice index sits under the top pointer for a given clockwise rotation.
   *
   * @param {number} finalAngleDeg
   * @param {number} sliceCount
   * @returns {number}
   */
  function resolveWinnerIndex(finalAngleDeg, sliceCount) {
    var count = Math.max(1, Number(sliceCount) || 1);
    var sliceAngle = 360 / count;
    var norm = ((Number(finalAngleDeg) || 0) % 360 + 360) % 360;
    var pointerPos = (360 - norm) % 360;
    var index = Math.floor(pointerPos / sliceAngle);
    return Math.max(0, Math.min(count - 1, index));
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function isMasterMuted() {
    try {
      if (typeof window !== 'undefined' && window.SoundEngine && typeof window.SoundEngine.enabled === 'boolean') {
        return !window.SoundEngine.enabled;
      }
      if (typeof localStorage !== 'undefined' && localStorage.getItem('arcadeverse_muted') === 'true') {
        return true;
      }
    } catch (_) {}
    return false;
  }

  /**
   * Synthesizes a crisp 18ms retro peg tick using Web Audio API.
   *
   * @param {Object} [ctxOverride]
   * @returns {boolean}
   */
  function playTickSound(ctxOverride) {
    if (isMasterMuted()) return false;

    var ctx = ctxOverride || audioCtx;
    if (!ctx && typeof window !== 'undefined') {
      if (window.SoundEngine && window.SoundEngine.ctx) {
        ctx = window.SoundEngine.ctx;
      } else {
        var AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          try {
            audioCtx = new AudioContextClass();
            ctx = audioCtx;
          } catch (_) {
            ctx = null;
          }
        }
      }
    }

    if (!ctx || typeof ctx.createOscillator !== 'function' || typeof ctx.createGain !== 'function') {
      return false;
    }

    try {
      var now = typeof ctx.currentTime === 'number' ? ctx.currentTime : 0;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1150, now);
      if (typeof osc.frequency.exponentialRampToValueAtTime === 'function') {
        osc.frequency.exponentialRampToValueAtTime(520, now + 0.018);
      }

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.02);
      return true;
    } catch (_) {
      return false;
    }
  }

  function drawWheel(canvas, slices, rotationDeg) {
    if (!canvas || typeof canvas.getContext !== 'function' || slices.length === 0) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var w = canvas.width;
    var h = canvas.height;
    var cx = w / 2;
    var cy = h / 2;
    var radius = Math.min(cx, cy) - 6;
    var sliceRad = (Math.PI * 2) / slices.length;
    var rotRad = ((rotationDeg - 90) * Math.PI) / 180;

    ctx.clearRect(0, 0, w, h);

    for (var i = 0; i < slices.length; i++) {
      var start = rotRad + i * sliceRad;
      var end = start + sliceRad;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, start, end);
      ctx.closePath();
      ctx.fillStyle = SLICE_COLORS[i % SLICE_COLORS.length];
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(start + sliceRad / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      var title = String(slices[i].title || slices[i].id || 'Game');
      if (title.length > 15) title = title.slice(0, 14) + '..';
      ctx.fillText(title, radius - 12, 4);
      ctx.restore();
    }

    // Center hub cap
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  function getActiveDOMFilters() {
    var filters = { category: 'all', tag: '' };
    if (typeof document === 'undefined') return filters;

    var activeCat = document.querySelector('#category-pills .pill.active');
    if (activeCat) {
      filters.category = activeCat.getAttribute('data-category') || 'all';
    }
    var activeTag = document.querySelector('#tag-filter-pills .tag-pill[aria-pressed="true"]');
    if (activeTag) {
      filters.tag = activeTag.getAttribute('data-tag') || '';
    }
    return filters;
  }

  function ensureModal() {
    if (typeof document === 'undefined') return null;
    var existing = document.getElementById('roulette-picker-modal');
    if (existing) return existing;

    var html = '' +
      '<div class="roulette-modal-overlay" id="roulette-picker-modal" role="dialog" aria-modal="true" aria-labelledby="roulette-modal-title" aria-hidden="true">' +
      '  <div class="roulette-modal-card">' +
      '    <div class="roulette-modal-header">' +
      '      <div class="roulette-modal-title-wrap">' +
      '        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
      '          <circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle>' +
      '          <line x1="12" y1="2" x2="12" y2="9"></line><line x1="12" y1="15" x2="12" y2="22"></line>' +
      '          <line x1="2" y1="12" x2="9" y2="12"></line><line x1="15" y1="12" x2="22" y2="12"></line>' +
      '        </svg>' +
      '        <h3 class="roulette-modal-title" id="roulette-modal-title">Random Game Roulette Wheel</h3>' +
      '      </div>' +
      '      <button type="button" class="roulette-modal-close" id="roulette-modal-close-btn" aria-label="Close Roulette Modal">' +
      '        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' +
      '      </button>' +
      '    </div>' +
      '    <div class="roulette-modal-body">' +
      '      <div class="roulette-wheel-stage" id="roulette-wheel-stage">' +
      '        <div class="roulette-pointer-arrow" aria-hidden="true"></div>' +
      '        <canvas class="roulette-canvas" id="roulette-canvas" width="300" height="300"></canvas>' +
      '      </div>' +
      '      <div class="roulette-winner-card" id="roulette-winner-card" hidden>' +
      '        <span class="roulette-winner-badge" id="roulette-winner-category"></span>' +
      '        <h4 class="roulette-winner-title" id="roulette-winner-title"></h4>' +
      '        <p class="roulette-winner-desc" id="roulette-winner-desc"></p>' +
      '      </div>' +
      '      <div class="roulette-actions-row">' +
      '        <button type="button" class="roulette-btn roulette-btn-spin" id="roulette-btn-spin-again">Spin Again</button>' +
      '        <button type="button" class="roulette-btn roulette-btn-play" id="roulette-btn-play-now" hidden>Play Now!</button>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    document.body.appendChild(wrap.firstElementChild);

    var modal = document.getElementById('roulette-picker-modal');
    document.getElementById('roulette-modal-close-btn').addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal();
    });
    document.getElementById('roulette-btn-spin-again').addEventListener('click', function () {
      spinWheel();
    });
    document.getElementById('roulette-btn-play-now').addEventListener('click', function () {
      if (!selectedWinner) return;
      var winner = selectedWinner;
      closeModal();
      if (window.ArcadeApp && typeof window.ArcadeApp.openGame === 'function') {
        window.ArcadeApp.openGame(winner.id);
      } else if (typeof window.openGameModal === 'function') {
        window.openGameModal(winner);
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) {
        closeModal();
      }
    });

    return modal;
  }

  function spinWheel() {
    if (isSpinning || typeof document === 'undefined') return;

    var registry = typeof GAMES_REGISTRY !== 'undefined' && Array.isArray(GAMES_REGISTRY) ? GAMES_REGISTRY : [];
    var candidates = getCandidateGames(registry, getActiveDOMFilters());
    currentSlices = selectWheelSlices(candidates, MAX_SLICES);
    if (currentSlices.length === 0) return;

    var canvas = document.getElementById('roulette-canvas');
    var stage = document.getElementById('roulette-wheel-stage');
    var winnerCard = document.getElementById('roulette-winner-card');
    var playBtn = document.getElementById('roulette-btn-play-now');
    var spinBtn = document.getElementById('roulette-btn-spin-again');

    if (stage) stage.classList.remove('is-winner-celebrating');
    if (winnerCard) winnerCard.hidden = true;
    if (playBtn) playBtn.hidden = true;
    if (spinBtn) spinBtn.disabled = true;

    var targetIndex = Math.floor(Math.random() * currentSlices.length);
    var startAngle = currentRotationDeg;
    var targetAngle = computeSpinTarget(currentSlices.length, targetIndex, startAngle, 5);
    var lastSliceIndex = resolveWinnerIndex(startAngle, currentSlices.length);

    var reducedMotion = typeof window !== 'undefined' && typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reducedMotion || typeof requestAnimationFrame !== 'function') {
      currentRotationDeg = targetAngle;
      drawWheel(canvas, currentSlices, currentRotationDeg);
      finishSpin(currentSlices[resolveWinnerIndex(currentRotationDeg, currentSlices.length)]);
      return;
    }

    isSpinning = true;
    var startTime = performance.now();

    function tickFrame(now) {
      var elapsed = now - startTime;
      var t = Math.min(1, elapsed / SPIN_DURATION_MS);
      var eased = easeOutCubic(t);
      currentRotationDeg = startAngle + (targetAngle - startAngle) * eased;

      drawWheel(canvas, currentSlices, currentRotationDeg);

      var sliceNow = resolveWinnerIndex(currentRotationDeg, currentSlices.length);
      if (sliceNow !== lastSliceIndex) {
        lastSliceIndex = sliceNow;
        playTickSound();
      }

      if (t < 1) {
        requestAnimationFrame(tickFrame);
      } else {
        isSpinning = false;
        var finalIdx = resolveWinnerIndex(currentRotationDeg, currentSlices.length);
        finishSpin(currentSlices[finalIdx]);
      }
    }

    requestAnimationFrame(tickFrame);
  }

  function finishSpin(winner) {
    selectedWinner = winner;
    var stage = document.getElementById('roulette-wheel-stage');
    var winnerCard = document.getElementById('roulette-winner-card');
    var playBtn = document.getElementById('roulette-btn-play-now');
    var spinBtn = document.getElementById('roulette-btn-spin-again');

    if (stage) stage.classList.add('is-winner-celebrating');
    if (spinBtn) spinBtn.disabled = false;

    if (winner && winnerCard) {
      document.getElementById('roulette-winner-category').textContent = winner.category || 'Arcade';
      document.getElementById('roulette-winner-title').textContent = winner.title || winner.id;
      document.getElementById('roulette-winner-desc').textContent = winner.description || '';
      winnerCard.hidden = false;
    }
    if (playBtn && winner) {
      playBtn.hidden = false;
    }
  }

  function openModal() {
    if (typeof document === 'undefined') return;
    var modal = ensureModal();
    if (!modal) return;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    spinWheel();
  }

  function closeModal() {
    if (typeof document === 'undefined') return;
    var modal = document.getElementById('roulette-picker-modal');
    if (modal) {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
    }
  }

  function injectTriggerButton() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('roulette-spin-trigger-btn')) return;

    var toolbar = document.querySelector('.games-toolbar-controls');
    if (!toolbar) return;

    var btn = document.createElement('button');
    btn.id = 'roulette-spin-trigger-btn';
    btn.type = 'button';
    btn.className = 'btn-roulette-wheel-trigger';
    btn.setAttribute('aria-label', 'Open Random Game Roulette Wheel');
    btn.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle>' +
      '<line x1="12" y1="2" x2="12" y2="9"></line><line x1="12" y1="15" x2="12" y2="22"></line>' +
      '</svg>' +
      '<span>Random Spin</span>';

    btn.addEventListener('click', openModal);
    toolbar.appendChild(btn);
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectTriggerButton);
    } else {
      injectTriggerButton();
    }
  }

  return {
    MAX_SLICES: MAX_SLICES,
    SPIN_DURATION_MS: SPIN_DURATION_MS,
    getCandidateGames: getCandidateGames,
    selectWheelSlices: selectWheelSlices,
    computeSpinTarget: computeSpinTarget,
    resolveWinnerIndex: resolveWinnerIndex,
    easeOutCubic: easeOutCubic,
    playTickSound: playTickSound,
    openModal: openModal,
    closeModal: closeModal,
    spinWheel: spinWheel
  };
});
