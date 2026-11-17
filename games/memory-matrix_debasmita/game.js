/**
 * Quantum Memory Matrix - Logic & Audio Engine
 * Pure Vanilla JavaScript Memory Puzzle with Multi-Grid Difficulties & Procedural Web Audio
 * Author: Debasmita Bose & Babin Bid
 * NSOC Winter Edition 2026
 */

(() => {
  'use strict';

  const matrixGrid = document.getElementById("matrix-grid");
  const movesCountEl = document.getElementById("moves-count");
  const pairsCountEl = document.getElementById("pairs-count");
  const totalPairsCountEl = document.getElementById("total-pairs-count");
  const timerValEl = document.getElementById("timer-val");
  const bestRecordEl = document.getElementById("best-record-text");
  const restartBtn = document.getElementById("restart-btn");
  const winOverlay = document.getElementById("win-overlay");
  const winSummary = document.getElementById("win-summary");
  const newRecordBadge = document.getElementById("new-record-badge");
  const playAgainBtn = document.getElementById("play-again-btn");
  const soundToggleBtn = document.getElementById("sound-toggle-btn");
  const soundIcon = document.getElementById("sound-icon");
  const diffBtns = document.querySelectorAll(".diff-btn");

  const GLYPH_POOL = [
    "zap", "gem", "rocket", "bot",
    "sparkles", "dna", "flame", "globe",
    "shield", "cpu", "atom", "orbit"
  ];

  const GLYPH_ICONS = {
    "atom": '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="1"></circle><path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z"></path><path d="M15.7 20.2c4.54-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5Z"></path></svg>',
    "zap": '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>',
    "gem": '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12l4 6-10 13L2 9Z"></path><path d="M11 3 8 9l4 13 4-13-3-6"></path><path d="M2 9h20"></path></svg>',
    "rocket": '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"></path><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"></path></svg>',
    "bot": '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"></path><rect width="16" height="12" x="4" y="8" rx="2"></rect><path d="M2 14h2"></path><path d="M20 14h2"></path><path d="M15 13v2"></path><path d="M9 13v2"></path></svg>',
    "sparkles": '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path><path d="M5 3v4"></path><path d="M19 17v4"></path><path d="M3 5h4"></path><path d="M17 19h4"></path></svg>',
    "dna": '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m2 15 5.5-5.5"></path><path d="m2 9 5.5 5.5"></path><path d="m9 2 5.5 5.5"></path><path d="m9 22 5.5-5.5"></path><path d="m16 9 5.5-5.5"></path><path d="m16 15 5.5 5.5"></path><path d="M2 2a10 10 0 0 1 20 20"></path><path d="M22 2A10 10 0 0 1 2 22"></path></svg>',
    "flame": '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>',
    "globe": '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>',
    "shield": '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>',
    "cpu": '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg>',
    "orbit": '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z"></path></svg>',
    "volume-2": '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>',
    "volume-x": '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>'
  };

  const DIFFICULTIES = {
    cadet: { pairs: 6, cols: 4, gridClass: "grid-3x4", label: "Cadet" },
    agent: { pairs: 8, cols: 4, gridClass: "grid-4x4", label: "Agent" },
    architect: { pairs: 10, cols: 5, gridClass: "grid-4x5", label: "Architect" }
  };

  let currentDiff = "agent";
  let cardsArray = [];
  let flippedCards = [];
  let matchedPairs = 0;
  let moves = 0;
  let timer = 0;
  let timerInterval = null;
  let isLockBoard = false;
  let soundEnabled = true;
  let audioCtx = null;

  // Web Audio Synthesizer
  function initAudio() {
    if (!audioCtx) {
      const AudioClass = window.AudioContext || window.webkitAudioContext;
      if (AudioClass) audioCtx = new AudioClass();
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  }

  function playTone(freq, type = "sine", duration = 0.1, gainVal = 0.14) {
    if (!soundEnabled) return;
    initAudio();
    if (!audioCtx) return;

    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (_) {}
  }

  function playFlipSound() {
    playTone(480, "triangle", 0.05, 0.1);
  }

  function playMatchSound() {
    if (!soundEnabled) return;
    initAudio();
    if (!audioCtx) return;
    [659, 880, 1046].forEach((f, i) => {
      setTimeout(() => playTone(f, "sine", 0.12, 0.15), i * 65);
    });
  }

  function playMismatchSound() {
    playTone(180, "sawtooth", 0.12, 0.14);
  }

  function playWinSound() {
    if (!soundEnabled) return;
    initAudio();
    if (!audioCtx) return;
    [523, 659, 784, 1046, 1318].forEach((f, i) => {
      setTimeout(() => playTone(f, "triangle", 0.22, 0.18), i * 110);
    });
  }

  // Best Record Storage
  function getBestRecord(diff) {
    try {
      const raw = localStorage.getItem(`arcadeverse_memory_best_${diff}`);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function saveBestRecord(diff, movesVal, timeVal) {
    try {
      localStorage.setItem(`arcadeverse_memory_best_${diff}`, JSON.stringify({
        moves: movesVal,
        time: timeVal,
        date: new Date().toISOString().slice(0, 10)
      }));
    } catch (_) {}
  }

  function updateBestRecordDisplay() {
    const best = getBestRecord(currentDiff);
    if (best) {
      const mins = String(Math.floor(best.time / 60)).padStart(2, "0");
      const secs = String(best.time % 60).padStart(2, "0");
      bestRecordEl.textContent = `${best.moves} moves (${mins}:${secs})`;
    } else {
      bestRecordEl.textContent = "--";
    }
  }

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  function initGame() {
    clearInterval(timerInterval);
    timer = 0;
    moves = 0;
    matchedPairs = 0;
    flippedCards = [];
    isLockBoard = false;

    movesCountEl.textContent = "0";
    pairsCountEl.textContent = "0";
    timerValEl.textContent = "00:00";
    winOverlay.classList.add("hidden");
    newRecordBadge.classList.add("hidden");

    const cfg = DIFFICULTIES[currentDiff];
    totalPairsCountEl.textContent = cfg.pairs;
    updateBestRecordDisplay();

    // Prepare Cards: take required pair count from glyph pool and duplicate
    const activeGlyphs = GLYPH_POOL.slice(0, cfg.pairs);
    cardsArray = [...activeGlyphs, ...activeGlyphs];
    shuffle(cardsArray);

    renderBoard(cfg);
    startTimer();
  }

  function renderBoard(cfg) {
    matrixGrid.innerHTML = "";
    matrixGrid.className = `matrix-grid ${cfg.gridClass}`;

    cardsArray.forEach((glyph, index) => {
      const card = document.createElement("div");
      card.classList.add("card");
      card.dataset.glyph = glyph;
      card.dataset.index = index;
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.setAttribute("aria-label", `Memory Card ${index + 1}`);

      card.innerHTML = `
        <div class="card-face card-front">${GLYPH_ICONS['atom']}</div>
        <div class="card-face card-back">${GLYPH_ICONS[glyph] || ''}</div>
      `;

      card.addEventListener("click", () => handleCardClick(card));
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleCardClick(card);
        }
      });

      matrixGrid.appendChild(card);
    });
  }

  function handleCardClick(card) {
    if (isLockBoard) return;
    if (card === flippedCards[0]) return;
    if (card.classList.contains("matched") || card.classList.contains("flipped")) return;

    playFlipSound();
    card.classList.add("flipped");
    flippedCards.push(card);

    if (flippedCards.length === 2) {
      moves++;
      movesCountEl.textContent = moves;
      checkForMatch();
    }
  }

  function checkForMatch() {
    const [first, second] = flippedCards;
    const isMatch = first.dataset.glyph === second.dataset.glyph;

    if (isMatch) {
      disableMatchedCards();
    } else {
      unflipCards();
    }
  }

  function disableMatchedCards() {
    playMatchSound();
    flippedCards.forEach((card) => {
      card.classList.add("matched");
    });
    matchedPairs++;
    pairsCountEl.textContent = matchedPairs;
    flippedCards = [];

    const cfg = DIFFICULTIES[currentDiff];
    if (matchedPairs === cfg.pairs) {
      endGame();
    }
  }

  function unflipCards() {
    isLockBoard = true;
    playMismatchSound();
    setTimeout(() => {
      flippedCards.forEach((card) => {
        card.classList.remove("flipped");
      });
      flippedCards = [];
      isLockBoard = false;
    }, 850);
  }

  function startTimer() {
    timerInterval = setInterval(() => {
      timer++;
      const mins = String(Math.floor(timer / 60)).padStart(2, "0");
      const secs = String(timer % 60).padStart(2, "0");
      timerValEl.textContent = `${mins}:${secs}`;
    }, 1000);
  }

  function endGame() {
    clearInterval(timerInterval);
    playWinSound();

    const mins = String(Math.floor(timer / 60)).padStart(2, "0");
    const secs = String(timer % 60).padStart(2, "0");
    winSummary.textContent = `You solved the ${DIFFICULTIES[currentDiff].label} matrix in ${moves} moves and ${mins}:${secs}!`;

    // Check Best Record
    const prevBest = getBestRecord(currentDiff);
    let isNewRecord = false;
    if (!prevBest || moves < prevBest.moves || (moves === prevBest.moves && timer < prevBest.time)) {
      saveBestRecord(currentDiff, moves, timer);
      isNewRecord = true;
      newRecordBadge.classList.remove("hidden");
      updateBestRecordDisplay();
    }

    winOverlay.classList.remove("hidden");
  }

  // Event Listeners
  restartBtn.addEventListener("click", initGame);
  playAgainBtn.addEventListener("click", initGame);

  // Sound Toggle
  soundToggleBtn.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    if (soundIcon) {
      soundIcon.innerHTML = soundEnabled ? GLYPH_ICONS['volume-2'] : GLYPH_ICONS['volume-x'];
    }
    soundToggleBtn.title = soundEnabled ? "Mute Sound" : "Enable Sound";
  });

  // Difficulty Switcher
  diffBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      diffBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentDiff = btn.dataset.diff || "agent";
      initGame();
    });
  });

  // Start on load
  initGame();
})();
