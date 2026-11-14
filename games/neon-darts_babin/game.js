/**
 * Neon Darts 501 — Precision Reticle Cyber Bullseye Target Game
 * Author: Babin123456
 * Accurate Radial Scoring Geometry, Lissajous Sway Reticle, Web Audio Engine
 */

(function () {
  'use strict';

  // Standard London Dartboard Segment Arrangement (Clockwise starting from top 12 o'clock)
  const DARTBOARD_SECTORS = [
    20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5
  ];

  // Radii proportions normalized against board radius R
  const RADII = {
    INNER_BULL: 0.038,
    OUTER_BULL: 0.095,
    TRIPLE_INNER: 0.54,
    TRIPLE_OUTER: 0.62,
    DOUBLE_INNER: 0.88,
    DOUBLE_OUTER: 0.98
  };

  // Game States
  let mode = '501'; // '501' or 'clock'
  let scoreRemaining = 501;
  let dartsInHand = 3;
  let currentTurnScore = 0;
  let turnThrows = [];
  let totalDartsThrown = 0;
  let totalPointsScored = 0;
  let hits180 = 0;
  let clockTarget = 1;
  let isLegFinished = false;

  // Aiming & Physics
  let mousePos = { x: 300, y: 300 };
  let lissajousTime = 0;
  let swayOffset = { x: 0, y: 0 };
  let windSpeed = 1.2;
  let windAngle = Math.PI / 4;
  let isCharging = false;
  let chargePower = 0;
  let chargeDirection = 1;
  let thrownDarts = []; // { x, y, score, text, turn }
  let audioCtx = null;
  let soundEnabled = true;
  let animFrameId = null;

  // DOM Elements
  const canvas = document.getElementById('dartboard-canvas');
  const ctx = canvas.getContext('2d');
  const scoreRemainingElem = document.getElementById('score-remaining');
  const turnScoreElem = document.getElementById('turn-score');
  const turnDartsHistory = document.getElementById('turn-darts-history');
  const dartIconsContainer = document.getElementById('dart-icons-container');
  const checkoutSuggestion = document.getElementById('checkout-suggestion');
  const powerIndicator = document.getElementById('power-indicator');
  const announcementBanner = document.getElementById('throw-announcement');
  const announcementText = document.getElementById('announcement-text');
  const windVectorSvg = document.getElementById('wind-vector-svg');
  const windSpeedVal = document.getElementById('wind-speed-val');
  const statAvgElem = document.getElementById('stat-avg');
  const statTotalDartsElem = document.getElementById('stat-total-darts');
  const stat180sElem = document.getElementById('stat-180s');
  const statClockTargetElem = document.getElementById('stat-clock-target');
  const throwLogList = document.getElementById('throw-log-list');

  const btnMode501 = document.getElementById('mode-501');
  const btnModeClock = document.getElementById('mode-clock');
  const btnAudio = document.getElementById('btn-audio');
  const svgAudioOn = document.getElementById('svg-audio-on');
  const svgAudioOff = document.getElementById('svg-audio-off');
  const btnReset = document.getElementById('btn-reset');

  // Web Audio Synth
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playSound(type) {
    if (!soundEnabled) return;
    try {
      const actx = getAudioContext();
      if (!actx) return;
      const now = actx.currentTime;

      if (type === 'thud') {
        // Realistic dartboard thud: fast pitch drop + subtle noise
        const osc = actx.createOscillator();
        const gain = actx.createGain();
        osc.connect(gain);
        gain.connect(actx.destination);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(35, now + 0.12);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'bull') {
        const osc = actx.createOscillator();
        const gain = actx.createGain();
        osc.connect(gain);
        gain.connect(actx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880, now + 0.1); // A5
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'bust') {
        const osc = actx.createOscillator();
        const gain = actx.createGain();
        osc.connect(gain);
        gain.connect(actx.destination);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.linearRampToValueAtTime(80, now + 0.3);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      }
    } catch (e) {
      // Audio fallback
    }
  }

  // Update Crosswind Vector
  function randomizeWind() {
    windSpeed = parseFloat((Math.random() * 2.2 + 0.4).toFixed(1));
    windAngle = Math.random() * Math.PI * 2;
    const deg = (windAngle * 180 / Math.PI) + 90;
    windVectorSvg.style.transform = `rotate(${deg}deg)`;
    windSpeedVal.textContent = `${windSpeed} m/s`;
  }

  // Calculate Dartboard Segment Hit
  function evaluateDartHit(x, y) {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const maxR = canvas.width * 0.42;

    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const normDist = dist / maxR;

    // Off-board miss
    if (normDist > RADII.DOUBLE_OUTER + 0.05) {
      return { score: 0, multiplier: 0, base: 0, text: 'MISS' };
    }

    // Inner Bullseye (50 pts, counted as double 25 for checkout)
    if (normDist <= RADII.INNER_BULL) {
      return { score: 50, multiplier: 2, base: 25, isDouble: true, text: 'BULLSEYE (50)' };
    }

    // Outer Bull (25 pts)
    if (normDist <= RADII.OUTER_BULL) {
      return { score: 25, multiplier: 1, base: 25, isDouble: false, text: 'OUTER BULL (25)' };
    }

    // Angle calculation for 20 sectors
    // Top sector 20 is centered at -PI/2
    let angle = Math.atan2(dy, dx); // [-PI, PI]
    // Rotate coordinate system so sector 20 center is at 0
    // Each sector spans (2 * PI) / 20 = PI / 10 rad = 18 deg
    let sectorAngle = angle + (Math.PI / 2) + (Math.PI / 20);
    if (sectorAngle < 0) sectorAngle += Math.PI * 2;
    sectorAngle = sectorAngle % (Math.PI * 2);

    const sectorIndex = Math.floor(sectorAngle / (Math.PI / 10));
    const baseScore = DARTBOARD_SECTORS[sectorIndex % 20];

    // Determine Ring Multiplier
    if (normDist >= RADII.TRIPLE_INNER && normDist <= RADII.TRIPLE_OUTER) {
      return {
        score: baseScore * 3,
        multiplier: 3,
        base: baseScore,
        isDouble: false,
        text: `TRIPLE ${baseScore} (${baseScore * 3})`
      };
    } else if (normDist >= RADII.DOUBLE_INNER && normDist <= RADII.DOUBLE_OUTER) {
      return {
        score: baseScore * 2,
        multiplier: 2,
        base: baseScore,
        isDouble: true,
        text: `DOUBLE ${baseScore} (${baseScore * 2})`
      };
    } else if (normDist > RADII.DOUBLE_OUTER) {
      return { score: 0, multiplier: 0, base: baseScore, text: 'OFF WIRE (0)' };
    } else {
      return {
        score: baseScore,
        multiplier: 1,
        base: baseScore,
        isDouble: false,
        text: `SINGLE ${baseScore}`
      };
    }
  }

  // Suggest checkout for 501
  function getCheckoutRoute(rem) {
    if (rem > 170 || rem <= 1) return 'NO OUT ROUTE';
    if (rem === 50) return 'BULLSEYE';
    if (rem <= 40 && rem % 2 === 0) return `DOUBLE ${rem / 2}`;
    if (rem === 170) return 'T20 - T20 - BULL';
    if (rem === 167) return 'T20 - T19 - BULL';
    if (rem === 164) return 'T20 - T18 - BULL';
    if (rem === 160) return 'T20 - T20 - D20';
    if (rem === 100) return 'T20 - D20';
    if (rem === 60) return 'S20 - D20';
    return `REMAINING: ${rem}`;
  }

  // Execute Throw
  function throwDart() {
    if (isLegFinished || dartsInHand <= 0) return;

    // Apply sway + wind + power error
    const windEffectX = Math.cos(windAngle) * windSpeed * 7;
    const windEffectY = Math.sin(windAngle) * windSpeed * 7;

    // Sweet spot error: power sweet spot is between 65% and 80%
    const sweetCenter = 72.5;
    const powerError = Math.abs(chargePower - sweetCenter) * 0.45;
    const randomScatter = (Math.random() - 0.5) * powerError;

    const hitX = mousePos.x + swayOffset.x + windEffectX + randomScatter;
    const hitY = mousePos.y + swayOffset.y + windEffectY + randomScatter;

    const hit = evaluateDartHit(hitX, hitY);
    playSound(hit.score >= 50 ? 'bull' : 'thud');

    totalDartsThrown++;
    dartsInHand--;
    thrownDarts.push({ x: hitX, y: hitY, score: hit.score, text: hit.text });

    if (mode === '501') {
      handle501Throw(hit);
    } else {
      handleClockThrow(hit);
    }

    updateUI();

    // Check end of 3-dart turn (only if leg is still active)
    if (!isLegFinished && dartsInHand === 0) {
      setTimeout(endTurn, 1000);
    }
  }

  function handle501Throw(hit) {
    const potentialRemaining = scoreRemaining - hit.score;
    turnThrows.push(hit);

    // Bust conditions:
    // 1. Remainder < 0
    // 2. Remainder === 1 (cannot finish with a double)
    // 3. Remainder === 0 but did NOT hit a double or bullseye
    if (potentialRemaining < 0 || potentialRemaining === 1 || (potentialRemaining === 0 && !hit.isDouble)) {
      playSound('bust');
      showAnnouncement('BUST! Score resets to turn start.');
      scoreRemaining += currentTurnScore; // Reset turn points
      currentTurnScore = 0;
      dartsInHand = 0; // Force end turn
    } else if (potentialRemaining === 0 && hit.isDouble) {
      scoreRemaining = 0;
      currentTurnScore += hit.score;
      totalPointsScored += hit.score;
      dartsInHand = 0; // Immediately lock remaining turn throws
      isLegFinished = true;
      playSound('bull');
      showAnnouncement(`LEG WON! Final checkout: ${hit.text}`);
      logMessage(`Leg completed in ${totalDartsThrown} darts!`);

      // Trigger victory celebration modal & post score to platform bridge
      try {
        if (window.ArcadeVerse && typeof window.ArcadeVerse.postGameOver === 'function') {
          window.ArcadeVerse.postGameOver({ score: totalPointsScored, dartsThrown: totalDartsThrown, won: true });
        }
        if (window.ArcadeVerse && typeof window.ArcadeVerse.postScore === 'function') {
          window.ArcadeVerse.postScore(totalPointsScored);
        }
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'ARCADEVERSE_GAME_OVER', score: totalPointsScored, dartsThrown: totalDartsThrown, won: true }, '*');
          window.parent.postMessage({ type: 'ARCADEVERSE_GAME_SCORE', score: totalPointsScored }, '*');
        }
      } catch (_) {}

      setTimeout(() => {
        if (isLegFinished) {
          showVictoryModal(`Checked out on ${hit.text}`);
        }
      }, 500);
    } else {
      scoreRemaining = potentialRemaining;
      currentTurnScore += hit.score;
      totalPointsScored += hit.score;
      showAnnouncement(`${hit.text}`);
      logMessage(`Dart ${3 - dartsInHand}: ${hit.text} (Rem: ${scoreRemaining})`);
    }
  }

  function handleClockThrow(hit) {
    if (hit.base === clockTarget && hit.score > 0) {
      playSound('bull');
      showAnnouncement(`HIT TARGET #${clockTarget}!`);
      logMessage(`Clock target #${clockTarget} hit!`);
      clockTarget++;
      if (clockTarget > 20) {
        dartsInHand = 0;
        isLegFinished = true;
        showAnnouncement('AROUND THE CLOCK COMPLETE!');
        logMessage(`Course cleared in ${totalDartsThrown} darts!`);
        try {
          if (window.ArcadeVerse && typeof window.ArcadeVerse.postGameOver === 'function') {
            window.ArcadeVerse.postGameOver({ score: totalDartsThrown, dartsThrown: totalDartsThrown, won: true });
          }
          if (window.ArcadeVerse && typeof window.ArcadeVerse.postScore === 'function') {
            window.ArcadeVerse.postScore(totalPointsScored || 20);
          }
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({ type: 'ARCADEVERSE_GAME_OVER', score: totalDartsThrown, dartsThrown: totalDartsThrown, won: true }, '*');
            window.parent.postMessage({ type: 'ARCADEVERSE_GAME_SCORE', score: totalPointsScored || 20 }, '*');
          }
        } catch (_) {}
        setTimeout(() => {
          if (isLegFinished) {
            showVictoryModal('Course cleared in 20 sectors!');
          }
        }, 500);
      }
    } else {
      showAnnouncement(`MISSED TARGET #${clockTarget} (${hit.text})`);
    }
  }

  function endTurn() {
    if (isLegFinished) return;
    if (currentTurnScore === 180) {
      hits180++;
      showAnnouncement('MAXIMUM 180!');
    }

    turnThrows = [];
    currentTurnScore = 0;
    dartsInHand = 3;
    thrownDarts = []; // Clear board for next turn
    randomizeWind();
    updateUI();
  }

  function showAnnouncement(msg) {
    announcementText.textContent = msg;
    announcementBanner.classList.remove('hidden');
    setTimeout(() => {
      announcementBanner.classList.add('hidden');
    }, 1800);
  }

  function logMessage(msg) {
    const li = document.createElement('li');
    li.textContent = msg;
    throwLogList.prepend(li);
    if (throwLogList.children.length > 20) {
      throwLogList.removeChild(throwLogList.lastChild);
    }
  }

  function updateUI() {
    scoreRemainingElem.textContent = scoreRemaining;
    turnScoreElem.textContent = currentTurnScore;

    // Darts pip icons
    const pips = dartIconsContainer.querySelectorAll('.dart-pip');
    pips.forEach((pip, idx) => {
      pip.classList.toggle('active', idx < dartsInHand);
    });

    // Turn darts history
    const historySpans = turnDartsHistory.querySelectorAll('span');
    historySpans.forEach((span, idx) => {
      if (turnThrows[idx]) {
        span.textContent = `Dart ${idx + 1}: ${turnThrows[idx].text}`;
      } else {
        span.textContent = `Dart ${idx + 1}: --`;
      }
    });

    // Checkout Guide
    checkoutSuggestion.textContent = getCheckoutRoute(scoreRemaining);

    // Telemetry Stats
    const avg = totalDartsThrown > 0 ? ((totalPointsScored / totalDartsThrown) * 3).toFixed(1) : '0.0';
    statAvgElem.textContent = avg;
    statTotalDartsElem.textContent = totalDartsThrown;
    stat180sElem.textContent = hits180;
    statClockTargetElem.textContent = `#${clockTarget}`;
  }

  // Victory Celebration Modal
  function ensureVictoryStyles() {
    if (document.getElementById('victory-modal-styles')) return;
    const style = document.createElement('style');
    style.id = 'victory-modal-styles';
    style.textContent = `
      .victory-overlay {
        position: absolute;
        inset: 0;
        background: rgba(8, 12, 20, 0.88);
        backdrop-filter: blur(8px);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 100;
        animation: victoryFadeIn 0.3s ease;
      }
      @keyframes victoryFadeIn {
        from { opacity: 0; transform: scale(0.96); }
        to { opacity: 1; transform: scale(1); }
      }
      .victory-modal {
        background: rgba(15, 23, 42, 0.95);
        border: 2px solid var(--neon-cyan, #00f0ff);
        border-radius: 12px;
        box-shadow: 0 0 35px rgba(0, 240, 255, 0.45), inset 0 0 20px rgba(0, 240, 255, 0.08);
        padding: 24px 30px;
        max-width: 460px;
        width: 90%;
        text-align: center;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .victory-badge {
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .victory-badge svg {
        width: 52px;
        height: 52px;
        stroke: var(--neon-cyan, #00f0ff);
        filter: drop-shadow(0 0 10px rgba(0, 240, 255, 0.7));
      }
      .victory-title {
        font-family: var(--font-mono, monospace);
        font-size: 1.5rem;
        font-weight: 900;
        letter-spacing: 2px;
        color: #fff;
        text-shadow: 0 0 14px rgba(0, 240, 255, 0.8);
      }
      .victory-checkout {
        font-size: 0.9rem;
        color: var(--neon-green, #10b981);
        font-family: var(--font-mono, monospace);
        letter-spacing: 1px;
      }
      .victory-stats-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin: 6px 0;
      }
      .victory-stat-card {
        background: rgba(8, 12, 20, 0.75);
        border: 1px solid var(--border-dim, #1e293b);
        border-radius: 8px;
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .victory-stat-label {
        font-size: 0.7rem;
        color: var(--text-muted, #94a3b8);
        font-weight: bold;
        letter-spacing: 0.5px;
      }
      .victory-stat-val {
        font-family: var(--font-mono, monospace);
        font-size: 1.25rem;
        font-weight: bold;
        color: #fff;
      }
      .victory-actions {
        display: flex;
        gap: 12px;
        justify-content: center;
        margin-top: 6px;
      }
      .victory-btn {
        flex: 1;
        padding: 10px 16px;
        border-radius: 6px;
        font-family: var(--font-mono, monospace);
        font-weight: 800;
        font-size: 0.85rem;
        letter-spacing: 1px;
        cursor: pointer;
        transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
      }
      .victory-btn-primary {
        background: var(--neon-cyan, #00f0ff);
        color: #080c14;
        border: 1px solid var(--neon-cyan, #00f0ff);
        box-shadow: 0 0 16px rgba(0, 240, 255, 0.4);
      }
      .victory-btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 0 24px rgba(0, 240, 255, 0.7);
      }
      .victory-btn-secondary {
        background: transparent;
        color: var(--neon-cyan, #00f0ff);
        border: 1px solid var(--border-neon, #00f0ff);
      }
      .victory-btn-secondary:hover {
        background: rgba(0, 240, 255, 0.12);
        transform: translateY(-2px);
      }
    `;
    document.head.appendChild(style);
  }

  function createVictoryModal() {
    ensureVictoryStyles();
    const overlay = document.createElement('div');
    overlay.id = 'victory-overlay';
    overlay.className = 'victory-overlay hidden';
    overlay.innerHTML = `
      <div class="victory-modal" role="dialog" aria-labelledby="victory-modal-title" aria-modal="true">
        <div class="victory-badge" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <circle cx="12" cy="12" r="6"></circle>
            <circle cx="12" cy="12" r="2"></circle>
            <path d="M12 2v2"></path>
            <path d="M12 20v2"></path>
            <path d="M2 12h2"></path>
            <path d="M20 12h2"></path>
          </svg>
        </div>
        <h2 id="victory-modal-title" class="victory-title">LEG WON!</h2>
        <div id="victory-checkout-text" class="victory-checkout">Checked out on Double 20</div>
        <div class="victory-stats-grid">
          <div class="victory-stat-card">
            <span class="victory-stat-label">FINAL SCORE</span>
            <span id="victory-final-score" class="victory-stat-val">501</span>
          </div>
          <div class="victory-stat-card">
            <span class="victory-stat-label">TOTAL DARTS</span>
            <span id="victory-total-darts" class="victory-stat-val">0</span>
          </div>
          <div class="victory-stat-card">
            <span class="victory-stat-label">3-DART AVG</span>
            <span id="victory-avg" class="victory-stat-val">0.0</span>
          </div>
          <div class="victory-stat-card">
            <span class="victory-stat-label">180s HIT</span>
            <span id="victory-180s" class="victory-stat-val">0</span>
          </div>
        </div>
        <div class="victory-actions">
          <button id="btn-next-leg" class="victory-btn victory-btn-primary" type="button">PLAY NEXT LEG</button>
          <button id="btn-restart-match" class="victory-btn victory-btn-secondary" type="button">RESTART MATCH</button>
        </div>
      </div>
    `;

    const container = document.querySelector('.cabinet-container') || document.body;
    container.appendChild(overlay);

    overlay.querySelector('#btn-next-leg').addEventListener('click', () => {
      startNextLeg();
    });

    overlay.querySelector('#btn-restart-match').addEventListener('click', () => {
      hideVictoryModal();
      resetLeg();
    });

    window.addEventListener('keydown', (e) => {
      if (isLegFinished && e.key === 'Enter') {
        const ov = document.getElementById('victory-overlay');
        if (ov && !ov.classList.contains('hidden')) {
          e.preventDefault();
          startNextLeg();
        }
      }
    });

    return overlay;
  }

  function showVictoryModal(checkoutText) {
    let overlay = document.getElementById('victory-overlay');
    if (!overlay) {
      overlay = createVictoryModal();
    }
    const avg = totalDartsThrown > 0 ? ((totalPointsScored / totalDartsThrown) * 3).toFixed(1) : '0.0';
    document.getElementById('victory-modal-title').textContent = mode === '501' ? 'LEG WON!' : 'ROUND WON!';
    document.getElementById('victory-checkout-text').textContent = checkoutText || 'Checkout Completed!';
    document.getElementById('victory-final-score').textContent = totalPointsScored;
    document.getElementById('victory-total-darts').textContent = totalDartsThrown;
    document.getElementById('victory-avg').textContent = avg;
    document.getElementById('victory-180s').textContent = hits180;
    overlay.classList.remove('hidden');
  }

  function hideVictoryModal() {
    const overlay = document.getElementById('victory-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
    }
  }

  function startNextLeg() {
    hideVictoryModal();
    isLegFinished = false;
    scoreRemaining = 501;
    dartsInHand = 3;
    currentTurnScore = 0;
    turnThrows = [];
    thrownDarts = [];
    clockTarget = 1;
    randomizeWind();
    updateUI();
    showAnnouncement(mode === '501' ? 'NEXT LEG // 501' : 'AROUND THE CLOCK');
    logMessage(mode === '501' ? `New leg started. Double or Bull to finish! (Match total darts: ${totalDartsThrown})` : 'New clock round started!');
  }

  // Reset Match
  function resetLeg() {
    hideVictoryModal();
    isLegFinished = false;
    scoreRemaining = 501;
    dartsInHand = 3;
    currentTurnScore = 0;
    turnThrows = [];
    totalDartsThrown = 0;
    totalPointsScored = 0;
    hits180 = 0;
    clockTarget = 1;
    thrownDarts = [];
    throwLogList.innerHTML = '<li>Leg reset. Double or Bull to finish!</li>';
    randomizeWind();
    updateUI();
  }

  // Draw Dartboard
  function drawDartboard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const maxR = canvas.width * 0.42;

    // Background Shadow & Backing
    ctx.fillStyle = '#0a0e17';
    ctx.beginPath();
    ctx.arc(cx, cy, maxR * 1.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.stroke();

    const sectorAngle = (Math.PI * 2) / 20;
    const startAngleOffset = -Math.PI / 2 - (sectorAngle / 2);

    // Draw 20 Radial Sectors
    for (let i = 0; i < 20; i++) {
      const a1 = startAngleOffset + i * sectorAngle;
      const a2 = a1 + sectorAngle;
      const num = DARTBOARD_SECTORS[i];
      const isAlt = (i % 2 === 0);

      // Single Outer Ring
      ctx.fillStyle = isAlt ? '#090d16' : '#e2e8f0';
      drawArcSegment(cx, cy, maxR * RADII.TRIPLE_OUTER, maxR * RADII.DOUBLE_INNER, a1, a2);

      // Single Inner Ring
      ctx.fillStyle = isAlt ? '#090d16' : '#e2e8f0';
      drawArcSegment(cx, cy, maxR * RADII.OUTER_BULL, maxR * RADII.TRIPLE_INNER, a1, a2);

      // Triple Ring
      ctx.fillStyle = isAlt ? '#dc2626' : '#16a34a';
      drawArcSegment(cx, cy, maxR * RADII.TRIPLE_INNER, maxR * RADII.TRIPLE_OUTER, a1, a2);

      // Double Ring
      ctx.fillStyle = isAlt ? '#dc2626' : '#16a34a';
      drawArcSegment(cx, cy, maxR * RADII.DOUBLE_INNER, maxR * RADII.DOUBLE_OUTER, a1, a2);

      // Sector Number Labels
      const midAngle = (a1 + a2) / 2;
      const textR = maxR * 1.07;
      const tx = cx + Math.cos(midAngle) * textR;
      const ty = cy + Math.sin(midAngle) * textR;

      ctx.fillStyle = (mode === 'clock' && num === clockTarget) ? '#00f0ff' : '#94a3b8';
      ctx.font = 'bold 15px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(num, tx, ty);
    }

    // Outer Bullseye (Green)
    ctx.fillStyle = '#16a34a';
    ctx.beginPath();
    ctx.arc(cx, cy, maxR * RADII.OUTER_BULL, 0, Math.PI * 2);
    ctx.fill();

    // Inner Bullseye (Red)
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(cx, cy, maxR * RADII.INNER_BULL, 0, Math.PI * 2);
    ctx.fill();

    // Wire Grid Overlay
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    [RADII.INNER_BULL, RADII.OUTER_BULL, RADII.TRIPLE_INNER, RADII.TRIPLE_OUTER, RADII.DOUBLE_INNER, RADII.DOUBLE_OUTER].forEach(rNorm => {
      ctx.beginPath();
      ctx.arc(cx, cy, maxR * rNorm, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Thrown Darts Pins
    thrownDarts.forEach(d => {
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.arc(d.x, d.y, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x + 8, d.y - 14);
      ctx.stroke();
    });

    // Crosshair Reticle with Lissajous Sway
    drawReticle(cx, cy);
  }

  function drawArcSegment(cx, cy, rInner, rOuter, a1, a2) {
    ctx.beginPath();
    ctx.arc(cx, cy, rOuter, a1, a2);
    ctx.arc(cx, cy, rInner, a2, a1, true);
    ctx.closePath();
    ctx.fill();
  }

  function drawReticle() {
    const rx = mousePos.x + swayOffset.x;
    const ry = mousePos.y + swayOffset.y;

    // Glowing reticle ring
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(rx, ry, 16, 0, Math.PI * 2);
    ctx.stroke();

    // Reticle crosshair lines
    ctx.beginPath();
    ctx.moveTo(rx - 22, ry);
    ctx.lineTo(rx - 8, ry);
    ctx.moveTo(rx + 8, ry);
    ctx.lineTo(rx + 22, ry);
    ctx.moveTo(rx, ry - 22);
    ctx.lineTo(rx, ry - 8);
    ctx.moveTo(rx, ry + 8);
    ctx.lineTo(rx, ry + 22);
    ctx.stroke();

    // Center dot
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(rx, ry, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Animation Loop
  function loop() {
    lissajousTime += 0.04;
    // Lissajous figure-8 swaying pattern
    swayOffset.x = Math.sin(lissajousTime * 1.5) * 14;
    swayOffset.y = Math.sin(lissajousTime * 3.0) * 10;

    // Power charge oscillating bar
    if (isCharging) {
      chargePower += chargeDirection * 3.2;
      if (chargePower >= 100) {
        chargePower = 100;
        chargeDirection = -1;
      } else if (chargePower <= 0) {
        chargePower = 0;
        chargeDirection = 1;
      }
      powerIndicator.style.width = `${chargePower}%`;
    }

    drawDartboard();
    animFrameId = requestAnimationFrame(loop);
  }

  // Pointer & Throw Controls
  canvas.addEventListener('mousemove', (e) => {
    if (isLegFinished) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    mousePos.x = (e.clientX - rect.left) * scaleX;
    mousePos.y = (e.clientY - rect.top) * scaleY;
  });

  canvas.addEventListener('mousedown', () => {
    if (isLegFinished) return;
    isCharging = true;
    chargePower = 0;
    chargeDirection = 1;
  });

  window.addEventListener('mouseup', () => {
    if (isCharging) {
      isCharging = false;
      if (!isLegFinished) {
        throwDart();
      }
      chargePower = 0;
      powerIndicator.style.width = '0%';
    }
  });

  // Touch controls
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (isLegFinished) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const touch = e.touches[0];
    mousePos.x = (touch.clientX - rect.left) * scaleX;
    mousePos.y = (touch.clientY - rect.top) * scaleY;
    isCharging = true;
    chargePower = 0;
    chargeDirection = 1;
  });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (isLegFinished) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const touch = e.touches[0];
    mousePos.x = (touch.clientX - rect.left) * scaleX;
    mousePos.y = (touch.clientY - rect.top) * scaleY;
  });

  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (isCharging) {
      isCharging = false;
      if (!isLegFinished) {
        throwDart();
      }
      chargePower = 0;
      powerIndicator.style.width = '0%';
    }
  });

  // Mode Selection
  btnMode501.addEventListener('click', () => {
    mode = '501';
    btnMode501.classList.add('active');
    btnModeClock.classList.remove('active');
    resetLeg();
  });

  btnModeClock.addEventListener('click', () => {
    mode = 'clock';
    btnModeClock.classList.add('active');
    btnMode501.classList.remove('active');
    resetLeg();
  });

  btnReset.addEventListener('click', resetLeg);

  btnAudio.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    svgAudioOn.classList.toggle('hidden', !soundEnabled);
    svgAudioOff.classList.toggle('hidden', soundEnabled);
  });

  // Lifecycle Bridge & Message Listener
  window.addEventListener('message', (e) => {
    const data = e.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'ARCADEVERSE_TEARDOWN') {
      if (animFrameId) cancelAnimationFrame(animFrameId);
      if (audioCtx) {
        audioCtx.close().catch(() => {});
      }
    } else if (data.type === 'ARCADEVERSE_AUDIO_CONFIG' && typeof data.muted === 'boolean') {
      soundEnabled = !data.muted;
      svgAudioOn.classList.toggle('hidden', !soundEnabled);
      svgAudioOff.classList.toggle('hidden', soundEnabled);
    }
  });

  if (window.ArcadeVerse) {
    if (typeof window.ArcadeVerse.onTeardown === 'function') {
      window.ArcadeVerse.onTeardown(() => {
        if (animFrameId) cancelAnimationFrame(animFrameId);
        if (audioCtx) audioCtx.close().catch(() => {});
      });
    }
  }

  // Init
  randomizeWind();
  updateUI();
  animFrameId = requestAnimationFrame(loop);
})();
