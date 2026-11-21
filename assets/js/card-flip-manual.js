/**
 * ArcadeVerse - Dynamic 3D Flip Card with Vector Controls Schematic & Quick Manual
 * Architectural Implementation for Issue #1102
 *
 * Implements an interactive 3D card flip mechanism on catalog game cards:
 * - 3D perspective rotation (transform: rotateY(180deg), backface-visibility: hidden) at solid 60 FPS.
 * - Retro cyberpunk schematic layout on the card reverse face.
 * - Vector keyboard diagram dynamically highlighting WASD, Arrows, Space, and Mouse controls.
 * - 2-sentence objective rule summary extracted from game.json.
 * - Direct "Launch Game" trigger on card back.
 * - Full keyboard accessibility (Space/Enter, Escape to flip back, auto-flip on focusout).
 * - Touch-friendly interactions and prefers-reduced-motion compliance.
 * - Zero external CDN dependencies, 100% Vanilla JS.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ArcadeCardFlipManual = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let sharedAudioCtx = null;

  /**
   * Safe HTML attribute escaper.
   */
  function escapeAttr(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Safe HTML text escaper.
   */
  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Ensure string ends with a sentence terminator.
   */
  function ensurePeriod(str) {
    const trimmed = String(str || '').trim();
    if (!trimmed) return '';
    if (/[.!?]$/.test(trimmed)) return trimmed;
    return trimmed + '.';
  }

  /**
   * Splits a text block into grammatical sentences.
   */
  function splitSentences(text) {
    if (!text) return [];
    return String(text)
      .split(/(?<=[.!?])\s+/)
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length > 0; })
      .map(ensurePeriod);
  }

  /**
   * Procedural retro audio click on card flip.
   * Completely self-contained; gracefully skips if audio context is blocked.
   */
  function playFlipAudio() {
    try {
      if (typeof window === 'undefined') return;
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!sharedAudioCtx) {
        sharedAudioCtx = new AudioContextClass();
      }
      if (sharedAudioCtx.state === 'suspended') {
        sharedAudioCtx.resume();
      }
      const osc = sharedAudioCtx.createOscillator();
      const gain = sharedAudioCtx.createGain();
      const now = sharedAudioCtx.currentTime;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(740, now + 0.05);

      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

      osc.connect(gain);
      gain.connect(sharedAudioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.06);
    } catch (e) {
      // Audio is non-critical
    }
  }

  /**
   * Analyzes a game's metadata from game.json to deduce its active control scheme.
   * Supports explicit game.controls or intelligent deduction from tags, category, and description.
   *
   * @param {Object} game - Game metadata object
   * @returns {Object} Control scheme flags and textual descriptions
   */
  function analyzeControls(game) {
    if (!game) {
      return {
        wasd: true,
        arrows: true,
        space: true,
        mouse: false,
        touch: true,
        schemeText: 'Arrow Keys or WASD to navigate, Spacebar for action.',
        legendItems: [
          { key: 'ARROWS / WASD', label: 'Navigate / Steer' },
          { key: 'SPACE', label: 'Action / Jump' }
        ]
      };
    }

    const explicit = (game.controls && typeof game.controls === 'object') ? game.controls : {};
    const category = (game.category || '').toLowerCase();
    const title = (game.title || '').toLowerCase();
    const desc = (game.description || '').toLowerCase();
    const tags = Array.isArray(game.tags) ? game.tags.map(function (t) { return String(t).toLowerCase(); }) : [];
    const textBlob = (title + ' ' + category + ' ' + desc + ' ' + tags.join(' ')).toLowerCase();

    // Mouse / Cursor pointer detection
    const mouseExplicit = explicit.mouse !== undefined ? Boolean(explicit.mouse) : null;
    const isMouseFavored = (
      tags.includes('mouse') ||
      tags.includes('click') ||
      tags.includes('drag') ||
      tags.includes('puzzle') ||
      tags.includes('card') ||
      tags.includes('cards') ||
      tags.includes('board') ||
      tags.includes('wordle') ||
      tags.includes('trivia') ||
      tags.includes('match') ||
      tags.includes('memory') ||
      tags.includes('minesweeper') ||
      tags.includes('chess') ||
      tags.includes('connect') ||
      category.includes('puzzle') ||
      category.includes('strategy') ||
      category.includes('card') ||
      category.includes('board') ||
      textBlob.includes('click') ||
      textBlob.includes('drag') ||
      textBlob.includes('mouse') ||
      textBlob.includes('cursor') ||
      textBlob.includes('point and click')
    );
    const mouse = mouseExplicit !== null ? mouseExplicit : isMouseFavored;

    // WASD detection
    const wasdExplicit = explicit.wasd !== undefined ? Boolean(explicit.wasd) : null;
    const isWasdFavored = (
      tags.includes('wasd') ||
      tags.includes('fps') ||
      tags.includes('shooter') ||
      tags.includes('action') ||
      tags.includes('runner') ||
      tags.includes('platformer') ||
      tags.includes('racer') ||
      tags.includes('racing') ||
      tags.includes('driving') ||
      category.includes('action') ||
      category.includes('arcade') ||
      textBlob.includes('wasd') ||
      textBlob.includes('flight')
    );
    const wasd = wasdExplicit !== null ? wasdExplicit : isWasdFavored;

    // Arrow keys detection (Core retro standard for almost all non-pure-mouse games)
    const arrowsExplicit = explicit.arrows !== undefined ? Boolean(explicit.arrows) : null;
    const isArrowsFavored = (
      wasd ||
      tags.includes('arrow') ||
      tags.includes('arcade') ||
      tags.includes('retro') ||
      tags.includes('snake') ||
      tags.includes('pacman') ||
      tags.includes('breakout') ||
      tags.includes('pinball') ||
      tags.includes('physics') ||
      tags.includes('platformer') ||
      tags.includes('runner') ||
      tags.includes('maze') ||
      category.includes('arcade') ||
      category.includes('action') ||
      !textBlob.includes('mouse only')
    );
    const arrows = arrowsExplicit !== null ? arrowsExplicit : isArrowsFavored;

    // Spacebar detection (Jump / Shoot / Action)
    const spaceExplicit = explicit.space !== undefined ? Boolean(explicit.space) : null;
    const isSpaceFavored = (
      tags.includes('space') ||
      tags.includes('jump') ||
      tags.includes('shooter') ||
      tags.includes('action') ||
      tags.includes('pinball') ||
      tags.includes('platformer') ||
      tags.includes('runner') ||
      tags.includes('laser') ||
      textBlob.includes('jump') ||
      textBlob.includes('fire') ||
      textBlob.includes('blast') ||
      textBlob.includes('shoot') ||
      textBlob.includes('spacebar') ||
      category.includes('action') ||
      category.includes('arcade')
    );
    const space = spaceExplicit !== null ? spaceExplicit : isSpaceFavored;

    // Touch / Mobile responsiveness
    const touch = Boolean(
      explicit.touch ||
      game.responsive === true ||
      tags.includes('mobile') ||
      tags.includes('touch') ||
      mouse
    );

    // Build human-friendly legend
    const legendItems = [];
    if (wasd && arrows) {
      legendItems.push({ key: 'WASD / ARROWS', label: 'Move & Steer' });
    } else if (wasd) {
      legendItems.push({ key: 'WASD', label: 'Move / Steer' });
    } else if (arrows) {
      legendItems.push({ key: 'ARROWS', label: 'Directional Navigation' });
    }

    if (space) {
      const spaceLabel = (tags.includes('shooter') || textBlob.includes('shoot') || textBlob.includes('blast'))
        ? 'Fire Lasers / Shoot'
        : (tags.includes('pinball') ? 'Launch / Plunger' : 'Jump / Action');
      legendItems.push({ key: 'SPACE', label: spaceLabel });
    }

    if (mouse) {
      const mouseLabel = (tags.includes('drag') || textBlob.includes('drag'))
        ? 'Click & Drag Pieces'
        : (tags.includes('wordle') || tags.includes('card') ? 'Select & Confirm' : 'Aim & Left Click');
      legendItems.push({ key: 'MOUSE', label: mouseLabel });
    }

    if (touch && !mouse) {
      legendItems.push({ key: 'TOUCH', label: 'Tap & Swipe Controls' });
    }

    if (legendItems.length === 0) {
      legendItems.push({ key: 'ARROWS', label: 'Primary Directional Input' });
      legendItems.push({ key: 'SPACE', label: 'Action Confirm' });
    }

    const schemeParts = legendItems.map(function (item) {
      return item.key + ' to ' + item.label.toLowerCase();
    });
    const schemeText = schemeParts.join(', ') + '.';

    return {
      wasd: wasd,
      arrows: arrows,
      space: space,
      mouse: mouse,
      touch: touch,
      legendItems: legendItems,
      schemeText: schemeText
    };
  }

  /**
   * Synthesizes a contextual second sentence strategy guideline based on category/tags.
   */
  function getCategoryStrategy(game) {
    const cat = (game.category || '').toLowerCase();
    const tags = Array.isArray(game.tags) ? game.tags.join(' ').toLowerCase() : '';

    if (cat.includes('puzzle') || tags.includes('puzzle') || tags.includes('card') || tags.includes('board')) {
      return 'Analyze the board layout carefully to solve each puzzle with the fewest possible moves.';
    }
    if (cat.includes('strategy') || tags.includes('defense') || tags.includes('turret')) {
      return 'Manage defensive resources strategically to protect your perimeter against escalating waves.';
    }
    if (tags.includes('runner') || tags.includes('jumper')) {
      return 'Time every jump with precision to maintain momentum and dodge oncoming hazards.';
    }
    if (tags.includes('breakout') || tags.includes('pinball') || tags.includes('physics')) {
      return 'Control paddle angles and ball trajectory to trigger chain-reaction multiplier bonuses.';
    }
    if (tags.includes('shooter') || tags.includes('space') || tags.includes('action')) {
      return 'Dodge hazardous incoming fire and eliminate all hostile targets to set a high score.';
    }
    if (tags.includes('word') || tags.includes('trivia') || tags.includes('typing')) {
      return 'Formulate correct solutions before the countdown timer expires to maximize bonus points.';
    }
    if (cat.includes('horror')) {
      return 'Stay vigilant, manage your light sources, and navigate the darkness to survive.';
    }
    return 'Evade lethal obstacles, collect power-ups, and survive as long as possible.';
  }

  /**
   * Extracts a strictly 2-sentence objective rule summary from game.json.
   *
   * @param {Object} game - Game metadata object
   * @returns {Object} Object with sentence1, sentence2, and combined fullSummary
   */
  function extractManualSummary(game) {
    if (!game) {
      return {
        sentence1: 'Navigate the arcade arena and overcome escalating environmental challenges.',
        sentence2: 'Dodge hazards, score points, and aim for the top of the global leaderboard.',
        fullSummary: 'Navigate the arcade arena and overcome escalating environmental challenges. Dodge hazards, score points, and aim for the top of the global leaderboard.'
      };
    }

    // Check explicit manual field in game.json
    if (game.manual) {
      if (typeof game.manual === 'string') {
        const parts = splitSentences(game.manual);
        if (parts.length >= 2) {
          return {
            sentence1: parts[0],
            sentence2: parts[1],
            fullSummary: parts[0] + ' ' + parts[1]
          };
        } else if (parts.length === 1) {
          const s2 = getCategoryStrategy(game);
          return {
            sentence1: parts[0],
            sentence2: s2,
            fullSummary: parts[0] + ' ' + s2
          };
        }
      } else if (typeof game.manual === 'object') {
        const s1 = (game.manual.objective || game.manual.goal || game.manual.mission || '').trim();
        const s2 = (game.manual.rules || game.manual.strategy || game.manual.hazard || '').trim();
        if (s1 && s2) {
          const p1 = ensurePeriod(s1);
          const p2 = ensurePeriod(s2);
          return {
            sentence1: p1,
            sentence2: p2,
            fullSummary: p1 + ' ' + p2
          };
        }
      }
    }

    // Check explicit instructions field
    if (game.instructions && typeof game.instructions === 'string') {
      const parts = splitSentences(game.instructions);
      if (parts.length >= 2) {
        return {
          sentence1: parts[0],
          sentence2: parts[1],
          fullSummary: parts[0] + ' ' + parts[1]
        };
      }
    }

    // Extract from description
    const desc = (game.description || '').trim();
    const sentences = splitSentences(desc);

    if (sentences.length >= 2) {
      return {
        sentence1: sentences[0],
        sentence2: sentences[1],
        fullSummary: sentences[0] + ' ' + sentences[1]
      };
    } else if (sentences.length === 1) {
      const s1 = sentences[0];
      const s2 = getCategoryStrategy(game);
      return {
        sentence1: s1,
        sentence2: s2,
        fullSummary: s1 + ' ' + s2
      };
    }

    // Fallback if description is empty
    const s1 = 'Master the core mission objectives across challenging dynamic levels in ' + (game.title || 'this game') + '.';
    const s2 = getCategoryStrategy(game);
    return {
      sentence1: s1,
      sentence2: s2,
      fullSummary: s1 + ' ' + s2
    };
  }

  /**
   * Generates the vector keyboard diagram HTML with active and dimmed keys.
   */
  function renderVectorKeyboardHtml(controls) {
    const wasdClass = controls.wasd ? 'keycap-active' : 'keycap-dim';
    const arrowClass = controls.arrows ? 'keycap-active' : 'keycap-dim';
    const spaceClass = controls.space ? 'keycap-active' : 'keycap-dim';
    const mouseClass = controls.mouse ? 'keycap-active' : 'keycap-dim';

    const legendHtml = controls.legendItems.map(function (item) {
      return '<div class="legend-item"><span class="legend-key">' + escapeHTML(item.key) + '</span><span class="legend-sep">:</span><span class="legend-desc">' + escapeHTML(item.label) + '</span></div>';
    }).join('');

    return `
      <div class="schematic-diagram" role="img" aria-label="Vector Keyboard Controls Diagram">
        <div class="key-clusters-row">
          <!-- WASD Cluster -->
          <div class="key-cluster cluster-wasd" title="WASD Movement Cluster">
            <div class="key-row key-row-top">
              <span class="keycap-spacer"></span>
              <span class="keycap ${wasdClass}" data-key="W">W</span>
              <span class="keycap-spacer"></span>
            </div>
            <div class="key-row key-row-bottom">
              <span class="keycap ${wasdClass}" data-key="A">A</span>
              <span class="keycap ${wasdClass}" data-key="S">S</span>
              <span class="keycap ${wasdClass}" data-key="D">D</span>
            </div>
          </div>

          <!-- Arrows Cluster -->
          <div class="key-cluster cluster-arrows" title="Arrow Keys Cluster">
            <div class="key-row key-row-top">
              <span class="keycap-spacer"></span>
              <span class="keycap ${arrowClass}" data-key="ArrowUp" aria-label="Up Arrow">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>
              </span>
              <span class="keycap-spacer"></span>
            </div>
            <div class="key-row key-row-bottom">
              <span class="keycap ${arrowClass}" data-key="ArrowLeft" aria-label="Left Arrow">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
              </span>
              <span class="keycap ${arrowClass}" data-key="ArrowDown" aria-label="Down Arrow">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
              </span>
              <span class="keycap ${arrowClass}" data-key="ArrowRight" aria-label="Right Arrow">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
              </span>
            </div>
          </div>
        </div>

        <!-- Action Keys Row: Spacebar & Mouse -->
        <div class="action-keys-row">
          <div class="keycap keycap-space ${spaceClass}" data-key="Space" title="Spacebar Action">
            <span class="space-label">SPACEBAR</span>
          </div>
          <div class="keycap keycap-mouse ${mouseClass}" data-key="Mouse" title="Mouse / Pointer Click">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <rect x="5" y="2" width="14" height="20" rx="7"/>
              <line x1="12" y1="6" x2="12" y2="10"/>
            </svg>
            <span class="mouse-label">MOUSE</span>
          </div>
        </div>

        <!-- Dynamic Controls Legend -->
        <div class="schematic-legend" aria-hidden="true">
          ${legendHtml}
        </div>
      </div>
    `;
  }

  /**
   * Generates the "Controls & Manual" flip button HTML to mount on the card front.
   *
   * @param {Object} game - Game metadata object
   * @returns {string} HTML string for the flip button
   */
  function renderFlipButtonHtml(game) {
    const safeId = escapeAttr(game.id);
    const safeTitle = escapeAttr(game.title);

    return `
      <button type="button" class="btn-card-manual-flip" data-id="${safeId}" aria-label="Controls and Quick Manual for ${safeTitle}" title="Controls &amp; Manual (Flip Card)" aria-expanded="false" aria-controls="card-manual-${safeId}">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="manual-flip-icon" aria-hidden="true">
          <rect x="2" y="4" width="20" height="16" rx="2"/>
          <line x1="6" y1="8" x2="6" y2="8.01"/>
          <line x1="10" y1="8" x2="10" y2="8.01"/>
          <line x1="14" y1="8" x2="14" y2="8.01"/>
          <line x1="18" y1="8" x2="18" y2="8.01"/>
          <line x1="6" y1="12" x2="6" y2="12.01"/>
          <line x1="10" y1="12" x2="14" y2="12"/>
          <line x1="18" y1="12" x2="18" y2="12.01"/>
          <line x1="7" y1="16" x2="17" y2="16"/>
        </svg>
      </button>
    `;
  }

  /**
   * Generates the Card Back Blueprint HTML with vector controls and 2-sentence manual.
   *
   * @param {Object} game - Game metadata object
   * @returns {string} HTML string for the card reverse face
   */
  function renderCardBackHtml(game) {
    const safeId = escapeAttr(game.id);
    const safeTitle = escapeHTML(game.title);
    const safeCategory = escapeHTML(game.category || 'Arcade');
    const safeDifficulty = escapeHTML(game.difficulty || 'Normal');

    const controls = analyzeControls(game);
    const manual = extractManualSummary(game);
    const vectorKeyboardHtml = renderVectorKeyboardHtml(controls);

    return `
      <div class="game-card-back" id="card-manual-${safeId}" role="region" aria-label="Controls Blueprint and Manual for ${escapeAttr(game.title)}" aria-hidden="true">
        <!-- Blueprint Header -->
        <div class="schematic-header">
          <div class="schematic-title-group">
            <span class="schematic-badge">BLUEPRINT // 01</span>
            <span class="schematic-game-cat">${safeCategory}</span>
          </div>
          <button type="button" class="btn-card-flip-back" data-id="${safeId}" aria-label="Flip back to ${escapeAttr(game.title)} cover" title="Back to Game Card">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            <span>Back</span>
          </button>
        </div>

        <div class="schematic-body-scroll">
          <h4 class="schematic-game-title">${safeTitle}</h4>

          <!-- Input Schematic Vector Diagram -->
          <div class="schematic-section-label">INPUT SCHEMATIC</div>
          ${vectorKeyboardHtml}

          <!-- 2-Sentence Objective Rule Manual -->
          <div class="schematic-section-label">MISSION PROTOCOL</div>
          <div class="schematic-manual-box">
            <p class="manual-sentence-1">${escapeHTML(manual.sentence1)}</p>
            <p class="manual-sentence-2">${escapeHTML(manual.sentence2)}</p>
          </div>
        </div>

        <!-- Blueprint Footer -->
        <div class="schematic-footer">
          <div class="schematic-meta-chip">
            <span class="meta-label">DIFFICULTY:</span>
            <span class="meta-value">${safeDifficulty}</span>
          </div>
          <button type="button" class="btn-blueprint-launch" data-id="${safeId}">
            <span>Launch Game</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <polygon points="6 3 20 12 6 21 6 3"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Smoothly flips a card between front and back 3D orientation.
   *
   * @param {HTMLElement} cardEl - The .game-card container
   * @param {boolean} [toFlipped] - Optional target state. Toggles if undefined.
   */
  function flipCard(cardEl, toFlipped) {
    if (!cardEl) return;
    const isCurrentlyFlipped = cardEl.classList.contains('is-flipped');
    const targetState = typeof toFlipped === 'boolean' ? toFlipped : !isCurrentlyFlipped;

    if (targetState === isCurrentlyFlipped) return;

    if (targetState) {
      cardEl.classList.add('is-flipped');
    } else {
      cardEl.classList.remove('is-flipped');
    }

    const flipBtn = cardEl.querySelector('.btn-card-manual-flip');
    if (flipBtn) {
      flipBtn.setAttribute('aria-expanded', targetState ? 'true' : 'false');
    }

    const cardBack = cardEl.querySelector('.game-card-back');
    const cardFront = cardEl.querySelector('.game-card-front');

    if (cardBack) {
      cardBack.setAttribute('aria-hidden', targetState ? 'false' : 'true');
    }
    if (cardFront) {
      cardFront.setAttribute('aria-hidden', targetState ? 'true' : 'false');
    }

    playFlipAudio();

    // Focus management
    if (targetState) {
      // Focus the back-return button or launch button
      const returnBtn = cardEl.querySelector('.btn-card-flip-back');
      if (returnBtn) {
        setTimeout(function () { returnBtn.focus(); }, 120);
      }
    } else {
      // Return focus to flip button on front
      if (flipBtn) {
        setTimeout(function () { flipBtn.focus(); }, 120);
      }
    }
  }

  /**
   * Binds interactive events (click, keyboard, focusout, launch) to a card.
   *
   * @param {HTMLElement} cardEl - The .game-card container
   * @param {Object} game - Game metadata object
   */
  function bindCard(cardEl, game) {
    if (!cardEl) return;

    const flipBtn = cardEl.querySelector('.btn-card-manual-flip');
    if (flipBtn && !flipBtn.hasAttribute('data-bound')) {
      flipBtn.setAttribute('data-bound', 'true');
      flipBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        flipCard(cardEl, true);
      });

      // Space / Enter key support
      flipBtn.addEventListener('keydown', function (e) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          flipCard(cardEl, true);
        }
      });
    }

    const returnBtn = cardEl.querySelector('.btn-card-flip-back');
    if (returnBtn && !returnBtn.hasAttribute('data-bound')) {
      returnBtn.setAttribute('data-bound', 'true');
      returnBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        flipCard(cardEl, false);
      });
    }

    const launchBtn = cardEl.querySelector('.btn-blueprint-launch');
    if (launchBtn && !launchBtn.hasAttribute('data-bound')) {
      launchBtn.setAttribute('data-bound', 'true');
      launchBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();

        if (typeof window !== 'undefined' && typeof window.openGameModal === 'function') {
          window.openGameModal(game, launchBtn);
        } else {
          const frontPlay = cardEl.querySelector('.btn-play-trigger');
          if (frontPlay) {
            frontPlay.click();
          }
        }
      });
    }

    // Keyboard Escape to flip back when inside the card
    if (!cardEl.hasAttribute('data-esc-bound')) {
      cardEl.setAttribute('data-esc-bound', 'true');
      cardEl.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && cardEl.classList.contains('is-flipped')) {
          e.preventDefault();
          e.stopPropagation();
          flipCard(cardEl, false);
        }
      });

      // Automatically flips back when focus leaves the card
      cardEl.addEventListener('focusout', function (e) {
        if (!cardEl.classList.contains('is-flipped')) return;

        setTimeout(function () {
          if (typeof document !== 'undefined' && !cardEl.contains(document.activeElement)) {
            flipCard(cardEl, false);
          }
        }, 60);
      });
    }
  }

  /**
   * Enhances an existing .game-card with 3D flip capability and card back blueprint.
   * If the card already has .game-card-inner, it simply binds events.
   *
   * @param {HTMLElement} cardEl - The .game-card element
   * @param {Object} [game] - Optional game metadata object; looks up from GAMES_REGISTRY if omitted
   */
  function enhanceCard(cardEl, game) {
    if (!cardEl) return;
    const gameId = cardEl.getAttribute('data-game-id') || (game && game.id);

    let targetGame = game;
    if (!targetGame && typeof window !== 'undefined' && Array.isArray(window.GAMES_REGISTRY)) {
      targetGame = window.GAMES_REGISTRY.find(function (g) { return g.id === gameId; });
    }

    if (!targetGame) {
      targetGame = {
        id: gameId || 'arcade-game',
        title: cardEl.querySelector('.game-card-title')?.textContent?.trim() || 'Arcade Game',
        category: cardEl.querySelector('.game-category-tag')?.textContent?.trim() || 'Arcade',
        description: cardEl.querySelector('.game-card-desc')?.textContent?.trim() || ''
      };
    }

    // Check if inner flipper already exists
    let inner = cardEl.querySelector('.game-card-inner');
    if (!inner) {
      // Create inner wrapper and front/back faces
      inner = document.createElement('div');
      inner.className = 'game-card-inner';

      const front = document.createElement('div');
      front.className = 'game-card-front';

      // Move all current children into front
      while (cardEl.firstChild) {
        front.appendChild(cardEl.firstChild);
      }

      // Add flip button into preview if not present
      const preview = front.querySelector('.game-card-preview');
      if (preview && !preview.querySelector('.btn-card-manual-flip')) {
        const flipBtnHtml = renderFlipButtonHtml(targetGame);
        const temp = document.createElement('div');
        temp.innerHTML = flipBtnHtml;
        const flipBtn = temp.firstElementChild;
        const favBtn = preview.querySelector('.btn-card-favorite');
        if (favBtn) {
          preview.insertBefore(flipBtn, favBtn);
        } else {
          preview.appendChild(flipBtn);
        }
      }

      // Create card back
      const backHtml = renderCardBackHtml(targetGame);
      const tempBack = document.createElement('div');
      tempBack.innerHTML = backHtml;
      const back = tempBack.firstElementChild;

      inner.appendChild(front);
      inner.appendChild(back);
      cardEl.appendChild(inner);
    }

    bindCard(cardEl, targetGame);
    cardEl.setAttribute('data-card-flip-ready', 'true');
  }

  /**
   * Enhances all .game-card elements in a catalog grid container.
   *
   * @param {HTMLElement} [gridEl] - Grid container; defaults to document.getElementById('games-grid')
   */
  function enhanceGrid(gridEl) {
    if (typeof document === 'undefined') return;
    const grid = gridEl || document.getElementById('games-grid');
    if (!grid) return;

    const cards = grid.querySelectorAll('.game-card:not([data-card-flip-ready])');
    cards.forEach(function (card) {
      enhanceCard(card);
    });
  }

  /**
   * Global initializer: binds grid and sets up MutationObserver for dynamic catalog updates.
   */
  function init() {
    if (typeof document === 'undefined') return;

    enhanceGrid();

    const grid = document.getElementById('games-grid');
    if (grid && typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver(function (mutations) {
        let hasNewCards = false;
        mutations.forEach(function (m) {
          if (m.addedNodes.length > 0) hasNewCards = true;
        });
        if (hasNewCards) {
          enhanceGrid(grid);
        }
      });
      observer.observe(grid, { childList: true, subtree: false });
    }

    // Listen to custom event from app.js if dispatched
    if (typeof window !== 'undefined') {
      window.addEventListener('arcadeverse:cards-rendered', function () {
        enhanceGrid();
      });
    }
  }

  // Auto-init on DOMContentLoaded if running in browser
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  return {
    analyzeControls: analyzeControls,
    extractManualSummary: extractManualSummary,
    renderVectorKeyboardHtml: renderVectorKeyboardHtml,
    renderFlipButtonHtml: renderFlipButtonHtml,
    renderCardBackHtml: renderCardBackHtml,
    flipCard: flipCard,
    bindCard: bindCard,
    enhanceCard: enhanceCard,
    enhanceGrid: enhanceGrid,
    init: init
  };
});
